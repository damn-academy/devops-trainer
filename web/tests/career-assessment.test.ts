// Assessment engine: FSRS review queue, placement scoring and retakes, exam
// variants and scoring, the rubric with fuzzy quote matching.

import { describe, expect, it } from 'vitest';
import type { Exam, PlacementTask, StoreEvent } from '../src/core/types';
import { beyondShare, examGate, lintExam, pickTasks, protocol, rng, scoreExam } from '../src/engine/quiz/exam';
import { buildCards, buildQueue, forecast, pickCandidate, Rating, ratingFor, REVIEW_EVENT, State, type Candidate } from '../src/engine/quiz/fsrs';
import { lintPlacement, nextVariant, retakeState, scorePlacement, tasksOf, variantsOf } from '../src/engine/quiz/placement';
import { apologyCount, commandShare, coveredPoints, fillerCount, INTERVIEW_RUBRIC, matchQuote, parseGrader, rubricPassed, statusParts, verifyScores, wordDistance, words } from '../src/engine/quiz/rubric';

const b = (s: string) => ({ ru: s, en: s });
let seq = 0;
const ev = (t: string, e: Record<string, unknown>): StoreEvent => ({ id: `e${seq++}`, t, ...e }) as unknown as StoreEvent;

describe('FSRS review', () => {
  it('maps outcomes to ratings (01 §12)', () => {
    expect(ratingFor({ correct: false, confidence: 3, ms: 1000, normMs: 30000 })).toBe(Rating.Again);
    expect(ratingFor({ correct: true, confidence: 1, ms: 1000, normMs: 30000 })).toBe(Rating.Hard);
    expect(ratingFor({ correct: true, confidence: 2, ms: 70000, normMs: 30000 })).toBe(Rating.Hard);
    expect(ratingFor({ correct: true, confidence: 2, ms: 20000, normMs: 30000 })).toBe(Rating.Good);
    expect(ratingFor({ correct: true, confidence: 3, ms: 10000, normMs: 30000 })).toBe(Rating.Easy);
    expect(ratingFor({ correct: true, confidence: 3, ms: 10000, normMs: 30000, hinted: true })).toBe(Rating.Hard);
  });

  it('creates cards from lessons and placement and moves them on reviews', () => {
    const log = [
      ev('2026-11-01T10:00:00.000Z', { kind: 'lesson.done', lesson: 'l1', concepts: ['a', 'b'] }),
      ev('2026-11-01T11:00:00.000Z', { kind: 'placement.result', block: 'x', claimed: 'intermediate', passed: true, score: 0.9, failed: ['t'], concepts: ['c', 'd'], gaps: ['d'] }),
    ];
    let cards = buildCards(log);
    expect([...cards.keys()].sort()).toEqual(['a', 'b', 'c']);
    expect(cards.get('a')!.card.due.toISOString()).toBe('2026-11-02T10:00:00.000Z');
    expect(cards.get('c')!.card.due.toISOString()).toBe('2026-11-04T11:00:00.000Z');
    log.push(ev('2026-11-02T10:00:00.000Z', { kind: REVIEW_EVENT, concept: 'a', item: 'q1', format: 'mcq', rating: Rating.Good, correct: true, confidence: 2, ms: 9000 }));
    cards = buildCards(log);
    const a = cards.get('a')!;
    expect(a.reviews).toBe(1);
    expect(a.formats).toEqual(['mcq']);
    expect(a.card.state).not.toBe(State.New);
    expect(a.card.due.getTime()).toBeGreaterThan(Date.parse('2026-11-02T10:00:00.000Z'));
  });

  it('a confident mistake comes back the same day and is flagged', () => {
    const log = [
      ev('2026-11-01T10:00:00.000Z', { kind: 'lesson.done', lesson: 'l1', concepts: ['a'] }),
      ev('2026-11-02T10:00:00.000Z', { kind: REVIEW_EVENT, concept: 'a', item: 'q1', format: 'mcq', rating: Rating.Again, correct: false, confidence: 3, ms: 9000 }),
    ];
    const a = buildCards(log).get('a')!;
    expect(a.confidentMiss).toBe(true);
    expect(a.card.due.getTime() - Date.parse('2026-11-02T10:00:00.000Z')).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  it('good intervals grow and again is shorter than easy', () => {
    const log = [ev('2026-11-01T10:00:00.000Z', { kind: 'lesson.done', lesson: 'l1', concepts: ['a'] })];
    const card = buildCards(log).get('a')!.card;
    const f = forecast(card, new Date('2026-11-02T10:00:00.000Z'));
    expect(f.again).toBeLessThan(f.good);
    expect(f.good).toBeLessThanOrEqual(f.easy);
  });

  it('takes another format than last time and a sandbox task every third review', () => {
    const list: Candidate[] = [
      { id: 'q1', format: 'mcq', seconds: 30 },
      { id: 'q2', format: 'order', seconds: 50 },
      { id: 't1', format: 'task', seconds: 90, desktop: true },
    ];
    const card = { concept: 'a', card: {} as never, formats: ['mcq'], rightFormats: ['mcq'], items: ['q1'], reviews: 1, confidentMiss: false };
    expect(pickCandidate(card, list)!.id).toBe('q2');
    expect(pickCandidate({ ...card, reviews: 2 }, list)!.id).toBe('t1');
    expect(pickCandidate({ ...card, reviews: 2 }, list, true)!.id).toBe('q2');
  });

  it('builds a mixed queue within the budget', () => {
    const log: StoreEvent[] = [];
    for (let i = 0; i < 40; i++) log.push(ev('2026-11-01T10:00:00.000Z', { kind: 'lesson.done', lesson: `l${i}`, concepts: [`${i % 2 ? 'linux' : 'net'}.c${i}`] }));
    const cards = buildCards(log);
    const q = buildQueue(cards, {
      now: new Date('2026-11-05T10:00:00.000Z'),
      blockOf: (c) => c.split('.')[0],
      candidates: (c) => [{ id: `q-${c}`, format: 'mcq', seconds: 30 }],
    });
    expect(q.length).toBe(30);
    expect(q[0].concept.split('.')[0]).not.toBe(q[1].concept.split('.')[0]);
    const short = buildQueue(cards, { now: new Date('2026-11-05T10:00:00.000Z'), blockOf: () => 'x', candidates: (c) => [{ id: c, format: 'task', seconds: 90 }], minutes: 3 });
    expect(short.length).toBe(2);
  });
});

describe('placement', () => {
  const quiz = (id: string, key = false, variant?: number): PlacementTask => ({
    id,
    level: 'intermediate',
    key,
    concepts: [`c.${id}`],
    variant,
    kind: 'quiz',
    item: { id: `q.${id}`, kind: 'mcq', prompt: b('?'), options: [{ id: 'a', text: 'a', correct: true }, { id: 'b', text: 'b', why: b('no') }] },
  });

  it('needs 80% rounded up and every key task; guesses do not count', () => {
    const tasks = ['1', '2', '3', '4', '5', '6'].map((x, i) => quiz(x, i === 0));
    const all = tasks.map((t) => ({ id: t.id, right: true }));
    expect(scorePlacement(tasks, all).passed).toBe(true);
    expect(scorePlacement(tasks, all).needed).toBe(5);
    const oneWrong = all.map((a, i) => (i === 5 ? { ...a, right: false } : a));
    const r = scorePlacement(tasks, oneWrong);
    expect(r.passed).toBe(true);
    expect(r.gaps).toEqual(['c.6']);
    const keyMissed = all.map((a, i) => (i === 0 ? { ...a, right: false } : a));
    expect(scorePlacement(tasks, keyMissed).passed).toBe(false);
    const guesses = all.map((a, i) => (i < 2 ? { ...a, guessed: true } : a));
    const g = scorePlacement(tasks, guesses);
    expect(g.passed).toBe(false);
    expect(g.guessed).toEqual(['1', '2']);
  });

  it('switches the variant on a retake after 72 hours, then goes module by module', () => {
    const tasks = [quiz('a'), quiz('b', false, 1), quiz('c', false, 2)];
    expect(variantsOf(tasks, 'intermediate')).toEqual([1, 2]);
    expect(tasksOf(tasks, 'intermediate', 2).map((t) => t.id)).toEqual(['a', 'c']);
    const h1 = [{ claimed: 'intermediate' as const, passed: false, at: '2026-11-01T10:00:00.000Z' }];
    expect(nextVariant(tasks, 'intermediate', [])).toBe(1);
    expect(nextVariant(tasks, 'intermediate', h1)).toBe(2);
    expect(retakeState(h1, 'intermediate', new Date('2026-11-02T10:00:00.000Z')).allowed).toBe(false);
    expect(retakeState(h1, 'intermediate', new Date('2026-11-04T10:00:01.000Z')).allowed).toBe(true);
    const h2 = [...h1, { claimed: 'intermediate' as const, passed: false, at: '2026-11-05T10:00:00.000Z' }];
    const s = retakeState(h2, 'intermediate', new Date('2026-11-20T10:00:00.000Z'));
    expect(s.allowed).toBe(false);
    expect(s.moduleByModule).toBe(true);
    expect(retakeState(h2, 'experienced', new Date('2026-11-05T11:00:00.000Z')).allowed).toBe(true);
  });

  it('lints the contract of a check', () => {
    expect(lintPlacement([quiz('a'), quiz('b')])).toContainEqual(expect.stringContaining('expected 5–10'));
  });
});

describe('exams', () => {
  const task = (id: string, weight: number, extra: Partial<Exam['tasks'][number]> = {}) =>
    ({ id, weight, kind: 'quiz', item: { id: `q.${id}`, kind: 'mcq', prompt: b('?'), options: [{ id: 'a', text: 'a', correct: true }, { id: 'b', text: 'b', why: b('no') }] }, ...extra }) as Exam['tasks'][number];
  const exam: Exam = {
    id: 'x',
    block: 'linux',
    title: b('x'),
    intro: b('x'),
    pass: 0.7,
    allowedDocs: ['man'],
    tasks: [task('t1', 40, { critical: true }), task('t2a', 30, { pool: 'p' }), task('t2b', 30, { pool: 'p' }), task('t3', 30, { beyond: true })],
  };

  it('picks one task per pool from the seed, deterministically', () => {
    const v1 = pickTasks(exam, 'seed-1').map((t) => t.id);
    expect(v1.length).toBe(3);
    expect(v1[0]).toBe('t1');
    expect(['t2a', 't2b']).toContain(v1[1]);
    expect(pickTasks(exam, 'seed-1').map((t) => t.id)).toEqual(v1);
    const seen = new Set(Array.from({ length: 20 }, (_, i) => pickTasks(exam, `s${i}`)[1].id));
    expect(seen.size).toBe(2);
    expect(rng('a')()).toBe(rng('a')());
  });

  it('scores with weights, critical tasks and the threshold', () => {
    const tasks = pickTasks(exam, 'k');
    const all = new Map(tasks.map((t) => [t.id, 1]));
    expect(scoreExam(exam, tasks, all).passed).toBe(true);
    const noCritical = new Map(all).set('t1', 0);
    const r = scoreExam(exam, tasks, noCritical);
    expect(r.passed).toBe(false);
    expect(r.criticalFailed).toEqual(['t1']);
    const noBeyond = new Map(all).set('t3', 0);
    expect(scoreExam(exam, tasks, noBeyond).score).toBeCloseTo(0.7);
    expect(scoreExam(exam, tasks, noBeyond).passed).toBe(true);
    expect(beyondShare(tasks)).toBeCloseTo(0.3);
  });

  it('lints the frame and gates retakes at 24 hours', () => {
    expect(lintExam(exam)).toEqual([]);
    expect(lintExam({ ...exam, tasks: [task('a', 50), task('b', 40)] })).toEqual(expect.arrayContaining([expect.stringContaining('sum to 90'), 'no critical task', expect.stringContaining('below 10%')]));
    const h = [{ mode: 'exam' as const, passed: false, at: '2026-11-01T10:00:00.000Z' }];
    expect(examGate(h, new Date('2026-11-01T20:00:00.000Z')).allowed).toBe(false);
    expect(examGate(h, new Date('2026-11-02T10:00:01.000Z')).allowed).toBe(true);
    expect(examGate([{ mode: 'training', passed: false, at: '2026-11-01T10:00:00.000Z' }], new Date('2026-11-01T11:00:00.000Z')).allowed).toBe(true);
  });

  it('writes a protocol with the readiness mark', () => {
    const p = protocol({ exam: 'x', title: 'x', seed: 's', mode: 'exam', started: 'a', finished: 'b', minutes: 10, overTime: false, score: 1, passed: true, checks: [], docOpens: [], explain: [{ id: 'e1', covered: 3, of: 4 }] });
    expect(p.readinessMark).toBe(true);
    expect(p.authenticity).toBe('self');
  });
});

describe('rubric and quotes', () => {
  it('normalises words and measures word distance', () => {
    expect(words('Ёлка, «ёж» и CGroups!')).toEqual(['елка', 'еж', 'и', 'cgroups']);
    expect(wordDistance(['a', 'b', 'c'], ['a', 'x', 'c'])).toBe(1);
  });

  it('accepts a quote with one recognition slip and rejects an invented one', () => {
    const transcript = 'Ну, контейнер это обычный процесс хоста, ядро показывает ему свой вид системы через пространства имён, а ресурсы ограничивает через си группы.';
    expect(matchQuote('ядро показывает ему свой вид системы через пространства имён', transcript).ok).toBe(true);
    expect(matchQuote('ядро показывает ему свой вид системы через пространство имён', transcript).ok).toBe(true);
    expect(matchQuote('у контейнера есть собственное ядро и гипервизор', transcript).ok).toBe(false);
  });

  it('lowers scores without confirmed evidence to 1', () => {
    const tr = 'Про seccomp не знаю, посмотрел бы в документации Docker, раздел про безопасность.';
    const v = verifyScores(
      [
        { id: 'honesty', score: 3, evidence: 'про seccomp не знаю посмотрел бы в документации docker' },
        { id: 'depth', score: 3, evidence: 'назвал компромисс между скоростью и изоляцией' },
        { id: 'communication', score: 1, evidence: null },
      ],
      tr,
    );
    expect(v.map((s) => s.score)).toEqual([3, 1, 1]);
    expect(v[1].lowered).toBe(true);
    expect(rubricPassed(INTERVIEW_RUBRIC, v)).toBe(false);
    expect(rubricPassed(INTERVIEW_RUBRIC, INTERVIEW_RUBRIC.criteria.map((c) => ({ id: c.id, score: 2, evidence: 'x' })))).toBe(true);
    expect(rubricPassed(INTERVIEW_RUBRIC, INTERVIEW_RUBRIC.criteria.map((c) => ({ id: c.id, score: c.id === 'honesty' ? 0 : 3, evidence: 'x' })))).toBe(false);
  });

  it('parses the grader schema from a chatty answer', () => {
    const g = parseGrader('Here you go:\n{"answers":[{"q":"a","criteria":[{"id":"structure","score":"2","evidence":"so","note":"n"},{"id":"x","score":9}]}],"summary":{"strong":["s"]}}');
    expect(g!.answers[0].criteria[0]).toMatchObject({ id: 'structure', score: 2, evidence: 'so' });
    expect(g!.answers[0].criteria[1].score).toBe(3);
    expect(parseGrader('no json')).toBeNull();
  });

  it('counts fillers, apologies, command share, key points and status parts', () => {
    expect(fillerCount('Ну, я как бы инженер, типа того. Ну вот.', 'ru')).toBe(5);
    expect(fillerCount('Um, I like, you know, deploy things', 'en')).toBe(3);
    expect(apologyCount('К сожалению, я пока только учусь', 'ru')).toBe(2);
    expect(commandShare('`nslookup host`')).toBeGreaterThan(0.9);
    expect(commandShare('DNS turns a name into an address; the resolver asks the root, then the zone server, and caches the answer for the TTL.')).toBe(0);
    expect(coveredPoints('Общее ядро с хостом, а изоляция через namespaces', [
      { id: 'kernel', text: b('k'), any: ['общее ядро', 'shared kernel'] },
      { id: 'cg', text: b('c'), any: ['cgroup'] },
    ])).toEqual(['kernel']);
    expect(statusParts('Оплата у 30% пользователей отдаёт 504, откатываем выкладку, следующий статус в 14:40')).toEqual({ impact: true, action: true, next: true });
  });
});
