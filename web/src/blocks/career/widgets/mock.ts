// The mock interviewer (10 §9.3), text mode. The course picks the questions
// (only blocks the learner has worked on), the learner's own AI plays the
// interviewer and asks follow-ups, then a separate call at temperature 0
// grades every answer on the interview rubric; scores above 1 need a quote
// that is found in the answer, otherwise they drop to 1. Without an AI the
// same interview runs with the course's follow-ups and a self-review on the
// same rubric.

import { clear, h, icon, put } from '../../../core/dom';
import { bi, fmt, lang, t } from '../../../core/i18n';
import { registry } from '../../../core/registry';
import { href } from '../../../core/router';
import { store } from '../../../core/store';
import type { ChatMessage, Mounted, WidgetReg } from '../../../core/types';
import { INTERVIEW_RUBRIC, meanScore, parseGrader, rubricPassed, verifyScores, ANSWER_PARTS, PART_TITLES, type CriterionScore, type Score } from '../../../engine/quiz/rubric';
import { rng } from '../../../engine/quiz/exam';
import { prose } from './ui';
import { aiChat, aiReady } from '../ai';
import { CARDS, type InterviewCard } from '../data/questions';
import { eventsOf, scoreDots } from './ui';

const M = {
  intro: bi(
    'Учебное интервью на позицию junior DevOps, около 30 минут текстом: самопрезентация, пять технических вопросов с уточнениями, ситуационный вопрос, поведенческий вопрос и ваши вопросы компании. Отвечайте так, как ответили бы вслух.',
    'A practice interview for a junior DevOps role, about 30 minutes in text: a self-presentation, five technical questions with follow-ups, a situational question, a behavioural question and your questions to the company. Answer as you would aloud.',
  ),
  aiOn: bi('Интервьюер работает на вашей нейросети: он задаёт уточнения, а после интервью разбирает ответы по рубрике.', 'The interviewer runs on your own AI: it asks follow-ups and reviews the answers on the rubric afterwards.'),
  aiOff: bi('Нейросеть не подключена: интервью пройдёт с уточнениями курса, а разбор вы сделаете сами по той же рубрике. Подключить свою нейросеть можно в ', 'No AI connected: the interview runs with the course’s follow-ups, and you review it yourself on the same rubric. You can connect your own AI in '),
  settings: bi('настройках', 'the settings'),
  start: bi('Начать интервью', 'Start the interview'),
  send: bi('Ответить', 'Answer'),
  you: bi('Вы', 'You'),
  them: bi('Интервьюер', 'Interviewer'),
  thinking: bi('Интервьюер думает…', 'The interviewer is thinking…'),
  grade: bi('Завершить и разобрать', 'Finish and review'),
  grading: bi('Нейросеть разбирает ответы…', 'The AI is reviewing the answers…'),
  self: bi('Разбор по рубрике', 'Review on the rubric'),
  selfLede: bi('Для каждого ответа честно поставьте баллы, сверяясь с эталоном и ключевыми пунктами. Якоря баллов — под каждым критерием.', 'For each answer score yourself honestly against the model answer and key points. The anchors are under each criterion.'),
  save: bi('Посчитать итог', 'Compute the result'),
  mean: bi('Средний балл: {m} из 3', 'Mean score: {m} of 3'),
  passed: bi('Этот прогон — на уровне «готов к живому собеседованию».', 'This run is at the “ready for a live interview” level.'),
  notPassed: bi('Пока ниже порога: средний 2 и ни одного нуля по честности.', 'Below the bar for now: a mean of 2 and no zero for honesty.'),
  ready: bi('Три мок-интервью подряд выше порога — пора к людям: найдите того, кто проведёт живое мок-интервью.', 'Three mock interviews in a row above the bar — time for people: find someone to run a live mock interview.'),
  unconfirmed: bi('не подтверждено цитатой', 'not confirmed by a quote'),
  model: bi('Эталон и ключевые пункты', 'Model answer and key points'),
  again: bi('Новое интервью', 'A new interview'),
  aiFail: bi('Нейросеть не вернула разбор по схеме — оцените ответы сами.', 'The AI did not return a review in the expected format — score the answers yourself.'),
  workOn: bi('Над чем поработать', 'What to work on'),
  strong: bi('Сильные стороны', 'Strengths'),
};

const Q = {
  hello: bi('Здравствуйте! Я тимлид команды платформы. Начнём с простого: расскажите о себе.', 'Hello! I lead the platform team. Let us start simple: tell me about yourself.'),
  situational: bi('Ситуация: пользователи пишут, что магазин отдаёт 504. Вы дежурный. Что будете делать?', 'A situation: users say the shop returns 504. You are on call. What will you do?'),
  situationalFollow: bi('Журнал ошибок nginx говорит «upstream timed out … while connecting to upstream». Что дальше?', 'The nginx error log says “upstream timed out … while connecting to upstream”. What next?'),
  behavioural: bi('Расскажите о случае, когда вы ошиблись. Что произошло и что вы сделали потом?', 'Tell me about a time you made a mistake. What happened and what did you do afterwards?'),
  yours: bi('Какие у вас есть вопросы к нам?', 'What questions do you have for us?'),
  bye: bi('Спасибо, на этом всё. Сейчас посмотрим, как прошло.', 'Thank you, that is all. Let us see how it went.'),
};

interface Turn {
  id: string;
  kind: 'pitch' | 'tech' | 'situational' | 'behavioural' | 'yours';
  card?: InterviewCard;
  question: string;
  answers: string[];
  followups: string[];
}

/** Blocks the learner has worked on: lessons opened, exams taken or placement passed. */
export function touchedBlocks(): Set<string> {
  const s = new Set<string>();
  for (const id of Object.keys(store.state.lessons)) {
    const b = registry.blockOf(id);
    if (b) s.add(b.id);
  }
  for (const id of Object.keys(store.state.exams)) {
    const ex = registry.exams.get(id);
    if (ex) s.add(ex.block);
  }
  for (const [b, list] of Object.entries(store.state.placement)) if (list.some((r) => r.passed)) s.add(b);
  return s;
}

export function pickQuestions(seed: string, blocks: Set<string>, n = 5): InterviewCard[] {
  const r = rng(seed);
  const order = (xs: InterviewCard[]) => xs.map((c) => [r(), c] as const).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  const mine = order(CARDS.filter((c) => blocks.has(c.block)));
  const rest = order(CARDS.filter((c) => !blocks.has(c.block)));
  return [...mine, ...rest].slice(0, n);
}

function systemPrompt(turns: Turn[]): string {
  const list = turns.filter((x) => x.card).map((x) => `- ${x.card!.question.en} (key points: ${x.card!.points.map((p) => p.text.en).join('; ')})`).join('\n');
  return [
    'You are an interviewer for a junior DevOps position, the lead of a platform team.',
    `Speak ${lang() === 'ru' ? 'Russian' : 'English'}. Be brief, like a real person.`,
    'You never hint, never grade aloud and never give the answer.',
    'When asked for a follow-up, ask exactly one short question: "why", "what if…", or "how do you know?", about what the candidate just said. If the candidate says they do not know, ask how and where exactly they would find out.',
    'Do not bring up topics outside this list:',
    list,
  ].join('\n');
}

function graderPrompt(turns: Turn[]): string {
  const crit = INTERVIEW_RUBRIC.criteria.map((c) => `- ${c.id}: ${c.anchors.map((a, i) => `${i}=${a.en}`).join('; ')}`).join('\n');
  const qa = turns
    .filter((x) => x.kind !== 'yours')
    .map((x) => `### ${x.id}\nQuestion: ${x.question}${x.card ? `\nKey points: ${x.card.points.map((p) => p.text.en).join('; ')}` : ''}\nFollow-ups: ${x.followups.join(' | ') || '—'}\nCandidate:\n"""${x.answers.join('\n---\n')}"""`)
    .join('\n\n');
  return [
    'Grade a junior DevOps mock interview. Temperature 0. Reply with JSON only.',
    `Rubric, every criterion 0–3:\n${crit}`,
    'For every score above 1 put in "evidence" an exact quote from that answer of the candidate; scores without a quote found in the answer are discarded.',
    'Schema: {"answers":[{"q":"<id>","criteria":[{"id":"correctness","score":0,"evidence":"…","note":"…"}]}],"summary":{"strong":["…"],"work_on":["…"]}}',
    `Write "note" and "summary" in ${lang() === 'ru' ? 'Russian' : 'English'}.`,
    qa,
  ].join('\n\n');
}

export const mockWidget: WidgetReg = {
  id: 'career.mock',
  mount(el, _props, ctx): Mounted {
    const root = h('div.cw-mock');
    let disposed = false;

    const intro = () => {
      clear(root);
      const ai = aiReady();
      put(
        root,
        prose(M.intro),
        ai ? h('p.small', {}, icon('ask'), ' ', t(M.aiOn)) : h('p.small.muted', {}, t(M.aiOff), h('a', { href: href({ name: 'settings' }) }, t(M.settings)), '.'),
        h('button.btn.primary', { type: 'button', onclick: () => run() }, icon('play'), t(M.start)),
      );
    };

    const run = () => {
      const ai = aiReady();
      const seed = Date.now().toString(36);
      const cards = pickQuestions(seed, touchedBlocks());
      const turns: Turn[] = [
        { id: 'pitch', kind: 'pitch', question: t(Q.hello), answers: [], followups: [] },
        ...cards.map((c): Turn => ({ id: c.id, kind: 'tech', card: c, question: t(c.question), answers: [], followups: [] })),
        { id: 'situational', kind: 'situational', question: t(Q.situational), answers: [], followups: [] },
        { id: 'behavioural', kind: 'behavioural', question: t(Q.behavioural), answers: [], followups: [] },
        { id: 'yours', kind: 'yours', question: t(Q.yours), answers: [], followups: [] },
      ];
      let i = 0;
      let asked = 0; // follow-ups asked for the current turn
      const chat = h('ol.cw-chat', { 'aria-live': 'polite' });
      const ta = h('textarea.cw-answer', { rows: 4, 'aria-label': t(M.you) }) as HTMLTextAreaElement;
      const send = h('button.btn.primary', { type: 'button' }, t(M.send)) as HTMLButtonElement;
      const say = (who: 'them' | 'you', text: string) => {
        chat.append(h('li', { class: `cw-msg ${who}` }, h('span.cw-who', {}, t(who === 'them' ? M.them : M.you)), h('p', {}, text)));
        chat.lastElementChild?.scrollIntoView?.({ block: 'nearest' });
      };
      const followupFor = async (turn: Turn): Promise<string | null> => {
        if (turn.kind === 'situational') return asked === 0 ? t(Q.situationalFollow) : null;
        if (turn.kind !== 'tech' || asked >= (ai ? 2 : 1)) return null;
        if (!ai) return turn.card!.followups[0] ? t(turn.card!.followups[0]) : null;
        if (asked === 1 && turn.answers[turn.answers.length - 1].length > 400) return null;
        const msgs: ChatMessage[] = [
          { role: 'system', content: systemPrompt(turns) },
          { role: 'assistant', content: turn.question },
          ...turn.answers.flatMap((a, k): ChatMessage[] => [{ role: 'user', content: a }, ...(turn.followups[k] ? [{ role: 'assistant' as const, content: turn.followups[k] }] : [])]),
          { role: 'user', content: 'Ask one follow-up question now.' },
        ];
        try {
          const q = (await aiChat(msgs, { temperature: 0.4 })).trim();
          return q || null;
        } catch {
          return turn.card!.followups[0] ? t(turn.card!.followups[0]) : null;
        }
      };
      const next = async () => {
        const answer = ta.value.trim();
        if (!answer) return;
        ta.value = '';
        say('you', answer);
        const turn = turns[i];
        turn.answers.push(answer);
        send.disabled = true;
        const wait = h('li.cw-msg.them.muted', {}, t(M.thinking));
        chat.append(wait);
        const f = await followupFor(turn);
        wait.remove();
        if (disposed) return;
        if (f) {
          asked++;
          turn.followups.push(f);
          say('them', f);
        } else {
          i++;
          asked = 0;
          if (i >= turns.length) {
            say('them', t(Q.bye));
            send.disabled = true;
            ta.disabled = true;
            return void grade(turns, ai);
          }
          say('them', turns[i].question);
        }
        send.disabled = false;
        ta.focus();
      };
      send.addEventListener('click', () => void next());
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void next();
      });
      clear(root);
      root.append(chat, ta, h('div.row', {}, send, h('span.small.muted', {}, '⌘/Ctrl + Enter')));
      say('them', turns[0].question);
      ta.focus();
    };

    const grade = async (turns: Turn[], ai: boolean) => {
      const graded = turns.filter((x) => x.kind !== 'yours');
      if (ai) {
        const box = h('p.muted', {}, t(M.grading));
        root.append(box);
        try {
          const g = parseGrader(await aiChat([{ role: 'user', content: graderPrompt(turns) }], { temperature: 0, json: true }));
          box.remove();
          if (g && g.answers.length) {
            const byQ = new Map(graded.map((x) => [x.id, x]));
            const results = g.answers.filter((a) => byQ.has(a.q)).map((a) => ({ turn: byQ.get(a.q)!, scores: verifyScores(a.criteria, byQ.get(a.q)!.answers.join('\n')) }));
            return result(results, true, g.summary);
          }
          root.append(h('p.err', {}, t(M.aiFail)));
        } catch (e) {
          box.remove();
          root.append(h('p.err', {}, (e as Error).message));
        }
      }
      selfReview(graded);
    };

    const selfReview = (graded: Turn[]) => {
      const form = h('div.cw-self');
      const picks = new Map<string, Map<string, Score>>();
      for (const turn of graded) {
        const m = new Map<string, Score>();
        picks.set(turn.id, m);
        form.append(
          h(
            'section.cw-self-q',
            {},
            h('h4', {}, turn.question),
            h('blockquote.cw-quote', {}, turn.answers.join('\n\n')),
            turn.card
              ? h('details', {}, h('summary', {}, t(M.model)), h('dl.cw-model', {}, ...ANSWER_PARTS.flatMap((p) => [h('dt', {}, t(PART_TITLES[p])), h('dd', {}, prose(turn.card!.model[p]))])), h('ul', {}, ...turn.card.points.map((kp) => h('li', {}, t(kp.text)))))
              : null,
            h(
              'div.cw-crit',
              {},
              ...INTERVIEW_RUBRIC.criteria.map((c) => {
                const sel = h('select', { 'aria-label': t(c.title) }, h('option', { value: '' }, '—'), ...c.anchors.map((a, k) => h('option', { value: String(k) }, `${k} — ${t(a)}`))) as HTMLSelectElement;
                sel.addEventListener('change', () => (sel.value === '' ? m.delete(c.id) : m.set(c.id, Number(sel.value) as Score)));
                return h('label.cw-crit-row', {}, h('span', {}, t(c.title)), sel);
              }),
            ),
          ),
        );
      }
      const btn = h('button.btn.primary', { type: 'button' }, t(M.save));
      btn.addEventListener('click', () => {
        const results = graded.map((turn) => ({ turn, scores: INTERVIEW_RUBRIC.criteria.map((c): CriterionScore => ({ id: c.id, score: picks.get(turn.id)!.get(c.id) ?? 1, evidence: null })) }));
        result(results, false);
      });
      put(root, h('h3', {}, t(M.self)), h('p.small', {}, t(M.selfLede)), form, h('div.row', {}, btn));
    };

    const result = (results: { turn: Turn; scores: CriterionScore[] }[], ai: boolean, summary?: { strong?: string[]; work_on?: string[] }) => {
      const all = results.flatMap((r) => r.scores);
      const perCriterion = INTERVIEW_RUBRIC.criteria.map((c) => {
        const xs = all.filter((s) => s.id === c.id);
        return { id: c.id, score: (xs.length ? Math.round(meanScore(xs)) : 0) as Score, evidence: 'mean', zero: xs.some((s) => s.score === 0) };
      });
      const mean = meanScore(all);
      const honestyZero = all.some((s) => s.id === 'honesty' && s.score === 0);
      const passed = !honestyZero && mean >= INTERVIEW_RUBRIC.pass && rubricPassed(INTERVIEW_RUBRIC, perCriterion);
      store.record({ kind: 'x.career.mock', mean, honestyZero, passed, ai, n: results.length });
      const last3 = eventsOf<{ passed: boolean }>('x.career.mock').slice(-3);
      const ready = last3.length === 3 && last3.every((e) => e.passed);
      clear(root);
      put(
        root,
        h('h3', {}, t(fmt(M.mean, { m: mean.toFixed(1) }))),
        h('p', {}, t(passed ? M.passed : M.notPassed)),
        ready ? h('p.cw-ready', {}, icon('check'), ' ', t(M.ready)) : null,
        h('table.cw-rubric', {}, h('tbody', {}, ...INTERVIEW_RUBRIC.criteria.map((c) => {
          const pc = perCriterion.find((x) => x.id === c.id)!;
          return h('tr', {}, h('th', { scope: 'row' }, t(c.title)), h('td', {}, scoreDots(pc.score)), h('td.small', {}, t(c.anchors[pc.score])));
        }))),
        ...results.map((r) =>
          h(
            'details.cw-answer-review',
            {},
            h('summary', {}, r.turn.question, ' · ', meanScore(r.scores).toFixed(1)),
            h('ul.small', {}, ...r.scores.map((s) => h('li', {}, `${t(INTERVIEW_RUBRIC.criteria.find((c) => c.id === s.id)?.title ?? bi(s.id, s.id))}: ${s.score}`, s.lowered ? h('span.cw-mark.warn', {}, ` — ${t(M.unconfirmed)}`) : s.evidence && ai ? h('span.muted', {}, ` — «${s.evidence}»`) : null, s.note ? h('span.muted', {}, ` — ${s.note}`) : null))),
          ),
        ),
        summary?.strong?.length ? h('div', {}, h('h4', {}, t(M.strong)), h('ul', {}, ...summary.strong.map((x) => h('li', {}, x)))) : null,
        summary?.work_on?.length ? h('div', {}, h('h4', {}, t(M.workOn)), h('ul', {}, ...summary.work_on.map((x) => h('li', {}, x)))) : null,
        h('button.btn.ghost', { type: 'button', onclick: intro }, icon('repeat'), t(M.again)),
      );
      ctx.complete();
    };

    clear(el);
    el.append(root);
    if (eventsOf('x.career.mock').length) ctx.complete();
    intro();
    return {
      dispose: () => {
        disposed = true;
        clear(el);
      },
      describe: () => t(bi('Мок-интервью', 'Mock interview')),
    };
  },
};

