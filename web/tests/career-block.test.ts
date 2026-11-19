// Career block logic: drills and their scoring, the vacancy analyzer, the
// resume linter, the explainers' models, the block's exams and placement.

import { describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { lintExam, pickTasks } from '../src/engine/quiz/exam';
import { lintPlacement } from '../src/engine/quiz/placement';
import { DRILLS, DRILL_504 } from '../src/blocks/career/data/drills';
import { CARDS } from '../src/blocks/career/data/questions';
import { PETS, PET_PATHS } from '../src/blocks/career/data/pets';
import { finishStatus, isRight, matchCommand, move, pickVariant, scoreDrill, startDrill, type Drill, type DrillState } from '../src/blocks/career/drill-engine';
import { analyze, extractRequirements } from '../src/blocks/career/vacancy';
import { emptyResume, lintResume, resumeReady, toJsonResume, toText, type Resume } from '../src/blocks/career/resume';
import { symptomOf } from '../src/blocks/career/explainers/symptom';
import { funnelNumbers } from '../src/blocks/career/explainers/funnel';
import { quoteCheck } from '../src/blocks/career/explainers/quote';
import { fsrsRun } from '../src/blocks/career/explainers/fsrs';
import { reviewOk } from '../src/blocks/career/widgets/oncall';
import { measurePitch } from '../src/blocks/career/widgets/pitch';
import { pickQuestions } from '../src/blocks/career/widgets/mock';
import { LINUX_EXAM } from '../src/blocks/career/exams';
import { createSimMachine } from '../src/engine/terminal/shell';
import { evaluateCheck } from '../src/core/check';

/** Walk a drill taking the first right option at every step. */
function walk(d: Drill, variant: string, status = 'Оплата у 30% пользователей: 504. Откатили релиз, следующий статус в 15:00.'): DrillState {
  let s = startDrill(d, variant);
  while (!s.done) {
    const step = d.steps[s.step];
    const opt = step.options.find((o) => isRight(o, variant));
    if (!opt) throw new Error(`${d.id}/${variant}: no right option at ${step.id}`);
    s = move(d, s, opt.id).state;
  }
  return finishStatus(s, status);
}

describe('drills', () => {
  it('every step of every variant has a right move, and a clean walk scores 3 everywhere', () => {
    for (const d of DRILLS)
      for (const v of d.variants) {
        const s = walk(d, v.id);
        expect(scoreDrill(d, s).map((c) => c.score)).toEqual([3, 3, 3, 3, 3]);
      }
  });

  it('a destructive move before evidence zeroes safety; hiding the symptom caps the result', () => {
    let s = startDrill(DRILL_504, 'slow-sql');
    s = move(DRILL_504, s, 'restart').state;
    expect(s.step).toBe(0);
    s = move(DRILL_504, s, 'timeout').state;
    let w = s;
    while (!w.done) w = move(DRILL_504, w, DRILL_504.steps[w.step].options.find((o) => isRight(o, 'slow-sql'))!.id).state;
    const sc = Object.fromEntries(scoreDrill(DRILL_504, finishStatus(w, '')).map((c) => [c.id, c.score]));
    expect(sc.safety).toBe(0);
    expect(sc.level).toBe(0);
    expect(sc.result).toBe(1);
    expect(sc.communication).toBe(0);
  });

  it('rolling back the release is wrong when the cause is the firewall rule', () => {
    let s = startDrill(DRILL_504, 'drop-rule');
    for (const id of ['ask', 'curl', 'errlog', 'connecting', 'ss', 'nft']) s = move(DRILL_504, s, id).state;
    const r = move(DRILL_504, s, 'rollback-release');
    expect(r.right).toBe(false);
    expect(r.why.en).toContain('wrong change');
    expect(String(r.output)).toContain('31% → 31%');
  });

  it('typed commands pick moves and variants avoid the previous one', () => {
    expect(matchCommand(DRILL_504.steps[1], 'curl -sv https://shop.example/checkout')?.id).toBe('curl');
    expect(matchCommand(DRILL_504.steps[1], 'ls')).toBeUndefined();
    for (let i = 0; i < 20; i++) expect(pickVariant(DRILL_504, 'pool')).not.toBe('pool');
  });
});

describe('vacancy analyzer', () => {
  const vacancy = `Junior DevOps Engineer

Чем заниматься:
Поддерживать Kubernetes-кластеры и Jenkins

Требования:
Linux на уровне администрирования
Docker, docker compose
GitLab CI
Ansible

Будет плюсом:
Kubernetes
Zabbix`;

  it('splits required and nice-to-have and skips duties', () => {
    const reqs = extractRequirements(vacancy);
    const by = Object.fromEntries(reqs.map((r) => [r.term.id, r.required]));
    expect(by).toMatchObject({ linux: true, compose: true, 'gitlab-ci': true, ansible: true, k8s: false, zabbix: false });
    expect(by.jenkins).toBeUndefined();
  });

  it('applies the 60% rule', () => {
    const reqs = extractRequirements(vacancy);
    const state = (b: string) => (['linux', 'containers', 'cicd'].includes(b) ? 'exam' : b === 'k8s-1' ? 'started' : 'none') as 'exam' | 'started' | 'none';
    const a = analyze(reqs, state);
    expect(a.required).toBeCloseTo(0.75);
    expect(a.verdict).toBe('apply');
    expect(a.toLearn[0]).toBe('iac');
    expect(a.outside).toContain('Zabbix');
    expect(analyze(reqs, () => 'none').verdict).toBe('not-yet');
    expect(analyze([], () => 'none').verdict).toBe('empty');
  });
});

describe('resume linter', () => {
  const good: Resume = {
    ...emptyResume('en'),
    name: 'Anna',
    label: 'Junior DevOps Engineer',
    summary: 'Moving from support to DevOps.',
    github: 'https://github.com/anna',
    skills: [{ name: 'Docker', evidence: ['pet:pet3'] }],
    projects: [{ name: 'Shop in compose', url: 'https://github.com/anna/shop', highlights: ['Set up a GitLab CI pipeline that builds three images'] }],
    work: [{ company: 'Telecom', position: 'Support specialist', years: '2021–2025', bridge: true, highlights: ['Located problems from logs and escalated with a write-up'] }],
  };

  it('passes a good CV and fails the errors', () => {
    expect(resumeReady(lintResume(good))).toBe(true);
    const bad = { ...good, label: 'Sales manager', skills: [{ name: 'Kubernetes', evidence: [] }], photo: true };
    const ids = lintResume(bad).filter((i) => !i.ok).map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['CV1', 'CV2', 'CV8']));
    expect(resumeReady(lintResume(bad))).toBe(false);
  });

  it('warns on duties, empty phrases and pet projects posing as jobs', () => {
    const r = { ...good, summary: 'Fast learner and team player', work: [...good.work, { company: 'Pet project', position: 'DevOps Engineer', years: '2025', bridge: false, highlights: ['Responsible for servers', 'More'] }] };
    const failed = lintResume(r).filter((i) => !i.ok).map((i) => i.id);
    expect(failed).toEqual(expect.arrayContaining(['CV4', 'CV5', 'CV6', 'CV10']));
  });

  it('exports JSON Resume and text', () => {
    const j = toJsonResume(good) as { basics: { label: string }; skills: { 'x-trainer': { evidence: string[] } }[] };
    expect(j.basics.label).toBe('Junior DevOps Engineer');
    expect(j.skills[0]['x-trainer'].evidence).toEqual(['pet:pet3']);
    expect(toText(good)).toContain('Skills');
  });
});

describe('explainer models', () => {
  it('504 turns into a slow 200 when the app answers within the timeout', () => {
    expect(symptomOf({ cause: 'slow-sql', appSec: 35, timeout: 30 }).status).toBe(504);
    expect(symptomOf({ cause: 'slow-sql', appSec: 20, timeout: 30 }).status).toBe(200);
    expect(symptomOf({ cause: 'drop-rule', appSec: 1, timeout: 120 }).log).toBe('connecting');
  });

  it('funnel follows Little’s law and the pause empties the board', () => {
    const a = funnelNumbers({ rate: 12, reply: 15, letter: false, tech: 30 });
    const b = funnelNumbers({ rate: 24, reply: 15, letter: false, tech: 30 });
    expect(b.wip).toBeCloseTo(2 * a.wip);
    expect(b.weeksToOffer).toBeLessThan(a.weeksToOffer);
    expect(funnelNumbers({ rate: 12, reply: 15, letter: true, tech: 30 }).perWeek.reply).toBeGreaterThan(a.perWeek.reply);
    expect(funnelNumbers({ rate: 12, reply: 15, letter: false, tech: 30 }, true).wip).toBe(0);
  });

  it('the quote tolerance separates a recognition slip from an invention', () => {
    expect(quoteCheck('slip', 0.15).ru.ok && quoteCheck('slip', 0.15).en.ok).toBe(true);
    expect(quoteCheck('slip', 0).ru.ok).toBe(false);
    expect(quoteCheck('invented', 0.15).ru.ok || quoteCheck('invented', 0.15).en.ok).toBe(false);
  });

  it('FSRS: a higher target means more reviews; a confident miss comes back within minutes', () => {
    const lo = fsrsRun({ retention: 0.85, outcome: 'good', before: 2, confident: false });
    const hi = fsrsRun({ retention: 0.95, outcome: 'good', before: 2, confident: false });
    expect(hi.interval).toBeLessThan(lo.interval);
    expect(hi.perMonth).toBeGreaterThanOrEqual(lo.perMonth);
    expect(fsrsRun({ retention: 0.9, outcome: 'good', before: 2, confident: true }).interval).toBeLessThan(1);
  });

  it('every career explainer is registered with a linted model', () => {
    for (const id of ['career.symptom', 'career.quote', 'career.funnel', 'career.fsrs']) expect(registry.explainers.get(id)?.model).toBeTruthy();
  });
});

describe('trainers', () => {
  it('a blameless review needs times, impact, two system conditions and owners, without blame', () => {
    const ok = { timeline: '14:05 release; 14:10 alert; 14:24 rollback', impact: '30% of checkout requests failed', factors: 'the migration passed review on a small staging table\nno alert on checkout latency', actions: 'add a latency alert — owner: platform, by 25.11' };
    expect(reviewOk(ok)).toBe(true);
    expect(reviewOk({ ...ok, factors: 'Petrov did not check the query; human error' })).toBe(false);
  });

  it('measures a pitch', () => {
    const m = measurePitch('Ну, я пять лет в поддержке. К сожалению, опыта нет. Мой проект — github.com/me/shop.', 'ru', 75, 4);
    expect(m.apologies).toBe(1);
    expect(m.concrete).toBe(true);
    expect(m.seconds).toBe(75);
  });

  it('the mock interviewer asks about blocks the learner worked on first', () => {
    const qs = pickQuestions('seed', new Set(['linux']), 5);
    expect(qs.length).toBe(5);
    expect(qs[0].block).toBe('linux');
    expect(new Set(qs.map((q) => q.id)).size).toBe(5);
    expect(CARDS.every((c) => c.points.length >= 3 && c.followups.length >= 1)).toBe(true);
  });

  it('pet projects cover the eight projects of the checklist and every path exists', () => {
    expect(PETS.filter((p) => /^\d$/.test(p.n)).length).toBe(8);
    for (const path of Object.values(PET_PATHS)) for (const id of path) expect(PETS.some((p) => p.id === id)).toBe(true);
  });
});

describe('exams and placement', () => {
  it('the exams of this folder follow the frame', async () => {
    const { BLOCK_EXAMS } = await import('../src/blocks/career/exams');
    for (const ex of BLOCK_EXAMS) expect([ex.id, lintExam(ex)]).toEqual([ex.id, []]);
  });

  it('the career placement follows the contract', () => {
    expect(lintPlacement(registry.blocks.get('career')!.placement, { career: true })).toEqual([]);
  });

  it('the Linux exam is solvable on the simulator', async () => {
    const run = async (taskId: string, lines: string[]) => {
      const t = pickTasks(LINUX_EXAM, 'x').concat(LINUX_EXAM.tasks).find((x) => x.id === taskId)!;
      if (t.kind !== 'task') throw new Error('not a task');
      const m = await createSimMachine(t.setup);
      const start = await m.facts();
      for (const l of lines) await m.exec(l);
      const r = evaluateCheck(t.task.check, await m.facts(), start);
      m.dispose();
      return r.pass;
    };
    expect(await run('dirs', ['mkdir -p ~/shop/logs ~/shop/backup'])).toBe(true);
    expect(await run('env', ['echo PORT=8080 >> ~/shop/config/app.env'])).toBe(true);
    expect(await run('env', ['echo PORT=8080 > ~/shop/config/app.env'])).toBe(false);
    expect(await run('errors-a', ['grep ERROR /var/log/shop/app.log > ~/errors.txt'])).toBe(true);
    expect(await run('errors-b', ['grep \'" 504 \' /var/log/shop/access.log > ~/504.txt'])).toBe(true);
    expect(await run('lock', ['rm ~/shop/data/.lock'])).toBe(true);
    expect(await run('lock', ['rm -r ~/shop/data'])).toBe(false);
    expect(await run('count', ["grep -c 'payment gateway timeout' /var/log/shop/app.log > ~/gateway.txt"])).toBe(true);
  });
});

describe('git exam', () => {
  it('is solvable with the git simulator', async () => {
    const { GIT_EXAM } = await import('../src/blocks/career/exams');
    const run = async (taskId: string, lines: string[]) => {
      const t = GIT_EXAM.tasks.find((x) => x.id === taskId)!;
      if (t.kind !== 'task') throw new Error('not a task');
      const m = await createSimMachine(t.setup);
      const start = await m.facts();
      const outs: string[] = [];
      for (const l of lines) outs.push((await m.exec(l)).out);
      const r = evaluateCheck(t.task.check, await m.facts(), start);
      m.dispose();
      return r.pass ? true : outs.join('|');
    };
    expect(await run('menu', ['git add menu.html', 'git commit -m "Add the menu page"'])).toBe(true);
    expect(await run('menu', ['git add .', 'git commit -m "Add everything"'])).not.toBe(true);
    expect(await run('branch', ['git switch -c fix/title', "sed -i 's/Edu Cafe!/Edu Cafe/' index.html", 'git add index.html', 'git commit -m "Fix the title"', 'git switch main', 'git merge fix/title'])).toBe(true);
    expect(await run('secret', ['git rm --cached .env', 'echo .env > .gitignore', 'git add .gitignore', 'git commit -m "Stop tracking .env"'])).toBe(true);
    expect(await run('secret', ['git rm .env', 'echo .env > .gitignore', 'git add .gitignore', 'git commit -m "Remove .env"'])).not.toBe(true);
    expect(await run('revert', ['git revert --no-edit HEAD'])).toBe(true);
    expect(await run('revert', ['git reset --hard HEAD~1'])).not.toBe(true);
  });
});
