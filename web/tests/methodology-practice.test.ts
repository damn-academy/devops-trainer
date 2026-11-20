// The short `flow` practices of the methodology block: every goal is reachable
// by the reference solution, the typical mistakes fail with their own
// explanation, and the numbers the practice quizzes quote hold on the board.

import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { registry } from '../src/core/registry';
import type { Facts, Task, TerminalSetup } from '../src/core/types';
import { flowCommand, flowFacts, flowSetup } from '../src/engine/flowlab/cli';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import { createSimMachine } from '../src/engine/terminal/shell';

const reg = createTerminalRegistry();
for (const c of [...BUILTINS, ...BASIC_COMMANDS, flowCommand]) reg.commands.add(c);
reg.facts.push(flowFacts);
reg.setup.push(flowSetup);

/** The terminal section of a lesson: its setup and goals. */
function lab(lessonId: string, sectionId: string): { setup: TerminalSetup; tasks: Task[]; levels?: string[] } {
  const s = registry.lessons.get(lessonId)!.sections.find((x) => x.id === sectionId)!;
  if (s.kind !== 'terminal') throw new Error(`${lessonId} § ${sectionId} is not a terminal section`);
  return { setup: s.setup, tasks: s.tasks, levels: s.levels };
}

type Flow = { daysDone: number; finished: number; done: { count: number }; metrics: Record<string, number>; decided: Record<string, string> };

/**
 * Plays commands the way the lab does: after every command each goal not yet
 * passed is checked, and a passed goal stays passed. `restart` stands for the
 * "Reset machine" button: the machine goes back to the state after its setup.
 */
async function play(l: { setup: TerminalSetup; tasks: Task[] }, lines: string[]) {
  const m = await createSimMachine(l.setup, { registry: reg });
  const startSnap = await m.snapshot();
  const start = await m.facts();
  const passed = new Set<string>();
  let facts: Facts = start;
  for (const line of lines) {
    if (line === 'restart') await m.restore(startSnap);
    else await m.exec(line);
    facts = await m.facts();
    for (const t of l.tasks) if (!passed.has(t.id) && evaluateCheck(t.check, facts, start).pass) passed.add(t.id);
  }
  const say = (id: string) => {
    const r = evaluateCheck(l.tasks.find((t) => t.id === id)!.check, facts, start);
    return r.pass ? 'PASS' : (r.say?.ru ?? '');
  };
  return { passed, say, flow: facts.flow as unknown as Flow };
}

const ids = (l: { tasks: Task[] }) => l.tasks.map((t) => t.id);

describe('lesson 4, work in progress: the jam and the limits on the five-day board', () => {
  const l = lab('methodology.flow', 'practice-wip');
  const LIMITS = ['flow wip analysis 2', 'flow wip dev 3', 'flow wip test 2'];

  it('is shown to beginners and intermediates and has 2–4 goals with hints and chips', () => {
    expect(l.levels).toEqual(['beginner', 'intermediate']);
    expect(l.tasks.length).toBeGreaterThanOrEqual(2);
    expect(l.tasks.length).toBeLessThanOrEqual(4);
    for (const t of l.tasks) expect([t.chips, t.hints?.H1, t.hints?.H2, t.hints?.H3].every(Boolean)).toBe(true);
  });

  it('the reference solution reaches every goal, with the numbers the quiz quotes', async () => {
    const r = await play(l, ['flow next 5', 'flow metrics', 'flow reset', ...LIMITS, 'flow next 5', 'flow metrics']);
    expect([...r.passed].sort()).toEqual(ids(l).sort());
    expect(r.flow.done.count).toBe(6);
    expect(r.flow.metrics.cycleP50).toBe(3);
    const jam = await play(l, ['flow next 5']);
    expect(jam.flow.done.count).toBe(0);
    expect(jam.flow.metrics.wipAvg).toBe(14);
  });

  it('typical mistakes fail with their explanation', async () => {
    expect((await play(l, [...LIMITS, 'flow next 5', 'flow metrics'])).say('jam')).toContain('уже с лимитами');
    expect((await play(l, ['flow next 5'])).say('jam')).toContain('посмотреть на итог');
    expect((await play(l, ['flow wip dev 3'])).say('limits')).toContain('не у всех колонок');
    expect((await play(l, ['flow next 2', ...LIMITS, 'flow next 3', 'flow metrics'])).say('flow')).toContain('лимит не возвращает');
    expect((await play(l, ['flow wip analysis 3', 'flow wip dev 3', 'flow wip test 3', 'flow next 5', 'flow metrics'])).say('flow')).toContain('великоваты');
    expect((await play(l, ['flow wip analysis 1', 'flow wip dev 1', 'flow wip test 1', 'flow next 5', 'flow metrics'])).say('flow')).toContain('слишком малы');
    // Right after the first goal the third one has nothing to say yet: the jam is what the learner was asked to see.
    expect((await play(l, ['flow next 5', 'flow metrics'])).say('flow')).toBe('');
  });
});

describe('lesson 6, the bottleneck: the beginner finds the slow stage and swarms it', () => {
  const l = lab('methodology.bottleneck', 'practice-beginner');

  it('is the beginner’s practice; intermediates keep the documentation task', () => {
    expect(l.levels).toEqual(['beginner']);
    const find = registry.lessons.get('methodology.bottleneck')!.sections.find((s) => s.id === 'find')!;
    expect(find.levels).toEqual(['intermediate']);
  });

  it('the reference solution reaches every goal, with the numbers the quiz quotes', async () => {
    const r = await play(l, ['flow next 4', 'flow status', 'flow station DEV-2 test', 'flow next 6']);
    expect([...r.passed].sort()).toEqual(ids(l).sort());
    expect(r.flow.done.count).toBe(7);
    expect((await play(l, ['flow next 10'])).flow.done.count).toBe(5);
  });

  it('typical mistakes fail with their explanation', async () => {
    expect((await play(l, ['flow next 4'])).say('look')).toContain('flow status');
    expect((await play(l, ['flow next 4', 'flow next 6'])).say('swarm')).toContain('проверял один');
    expect((await play(l, ['flow next 4', 'flow station DEV-2 analysis', 'flow next 6'])).say('swarm')).toContain('проверял один');
    const both = await play(l, ['flow next 4', 'flow station DEV-1 test', 'flow station DEV-2 test', 'flow next 6']);
    expect(both.flow.done.count).toBe(4);
    expect(both.say('swarm')).toContain('оба разработчика');
    expect((await play(l, ['flow wip analysis none', 'flow wip dev none', 'flow wip test none', 'flow station DEV-2 test', 'flow next 10'])).say('swarm')).toContain('flow reset');
  });

  it('requires one developer at testing even when the delivery count is sufficient', async () => {
    const m = await createSimMachine(l.setup, { registry: reg });
    const facts = await m.facts();
    const flow = facts.flow as Record<string, unknown>;
    Object.assign(flow, { daysDone: 10, done: { count: 7 } });
    const check = l.tasks.find(t => t.id === 'swarm')!.check;
    expect(evaluateCheck(check, facts).pass).toBe(false);
    flow.people = { 'DEV-1': { station: 'dev' }, 'DEV-2': { station: 'test' } };
    expect(evaluateCheck(check, facts).pass).toBe(true);
    flow.people = { 'DEV-1': { station: 'test' }, 'DEV-2': { station: 'test' } };
    expect(evaluateCheck(check, facts).pass).toBe(false);
  });

  it.each(['restart', 'flow reset'])('%s keeps the limits of the setup', async (reset) => {
    const r = await play(l, ['flow next 10', reset, 'flow next 4', 'flow status', 'flow station DEV-2 test', 'flow next 6']);
    expect(r.passed.has('swarm')).toBe(true);
  });
});

describe('lesson 7, batches: queue the promo tasks and pull by CD3', () => {
  const l = lab('methodology.batch', 'practice');

  it('the reference solution reaches every goal, with the numbers the quiz quotes', async () => {
    const r = await play(l, ['flow policy pull cd3', 'flow next 15', 'flow status', 'flow decide s1-promo top', 'flow next 15', 'flow metrics']);
    expect([...r.passed].sort()).toEqual(ids(l).sort());
    expect(r.flow.metrics.cycleP85).toBe(5);
    const all = await play(l, ['flow policy pull cd3', 'flow next 15', 'flow decide s1-promo all', 'flow next 15']);
    expect(all.flow.metrics.cycleP85).toBeGreaterThanOrEqual(12);
    expect(all.flow.metrics.cycleP85).toBeLessThanOrEqual(13);
  });

  it('other honest orders of the same steps also pass', async () => {
    const later = await play(l, ['flow next 15', 'flow decide s1-promo top', 'flow policy pull cd3', 'flow next 15', 'flow metrics']);
    expect([...later.passed].sort()).toEqual(ids(l).sort());
    const early = await play(l, ['flow policy pull cd3', 'flow decide s1-promo top', 'flow next 15', 'flow next 15', 'flow metrics']);
    expect([...early.passed].sort()).toEqual(ids(l).sort());
  });

  it('typical mistakes fail with their explanation', async () => {
    expect((await play(l, ['flow policy pull cod'])).say('order')).toContain('не смотрит, сколько в ней работы');
    const skipped = await play(l, ['flow policy pull cd3', 'flow next 15', 'flow next 15', 'flow metrics']);
    expect(skipped.flow.decided['s1-promo']).toBe('all');
    expect(skipped.say('promo')).toContain('одной партией');
    expect(skipped.say('result')).toContain('одной партией');
    expect((await play(l, ['flow next 15', 'flow decide s1-promo refuse'])).say('promo')).toContain('40 000');
    expect((await play(l, ['flow next 15', 'flow decide s1-promo top', 'flow next 15', 'flow metrics'])).say('result')).toContain('по старшинству');
    expect((await play(l, ['flow auto off', 'flow next 15', 'flow decide s1-promo top', 'flow next 15'])).say('result')).toContain('flow reset');
  });
});

describe('lesson 8, Agile: a Sprint planned with limits, run and reviewed', () => {
  const l = lab('methodology.agile', 'practice-sprint');

  it('the reference solution reaches every goal', async () => {
    const r = await play(l, ['flow wip analysis 2', 'flow wip dev 3', 'flow wip test 2', 'flow next 5', 'flow metrics']);
    expect([...r.passed].sort()).toEqual(ids(l).sort());
  });

  it('the first goal accepts exactly the plans that meet the Sprint Goal', async () => {
    for (const a of [1, 2]) for (const d of [2, 3]) for (const t of [1, 2]) {
      const r = await play(l, [`flow wip analysis ${a}`, `flow wip dev ${d}`, `flow wip test ${t}`, 'flow next 5', 'flow metrics']);
      expect([a, d, t, r.passed.has('plan'), r.passed.has('review')]).toEqual([a, d, t, r.flow.done.count >= 6, r.flow.done.count >= 6]);
    }
  });

  it('typical mistakes fail with their explanation', async () => {
    expect((await play(l, ['flow next 1', 'flow wip analysis 2', 'flow wip dev 3', 'flow wip test 2'])).say('plan')).toContain('Спринт уже идёт');
    expect((await play(l, ['flow wip analysis 3', 'flow wip dev 3', 'flow wip test 3'])).say('plan')).toContain('больше, чем «люди плюс один»');
    expect((await play(l, ['flow wip analysis 2', 'flow wip dev 1', 'flow wip test 2'])).say('plan')).toContain('второму нечего делать');
    expect((await play(l, ['flow wip analysis 1', 'flow wip dev 3', 'flow wip test 2'])).say('plan')).toContain('занимает место');
    expect((await play(l, ['flow wip analysis 3', 'flow wip dev 3', 'flow wip test 3', 'flow next 5', 'flow metrics'])).say('review')).toContain('меньше прогноза');
    expect((await play(l, ['flow next 5', 'flow metrics'])).say('review')).toContain('меньше прогноза');
  });
});

describe('lesson 11, DORA: deployments every two days against every five', () => {
  const l = lab('methodology.dora', 'practice');
  const RUN = ['flow next 20', 'flow next 20', 'flow next 20', 'flow next 20', 'flow next 20'];
  const answers = (t: string, b: string, r: string) => ['flow next 20', `flow decide s2-toil ${t}`, 'flow next 20', `flow decide s2-blame ${b}`, 'flow next 20', `flow decide s2-release ${r}`, 'flow next 20'];

  it('the reference solution reaches every goal', async () => {
    const r = await play(l, [...RUN, 'flow metrics', 'restart', 'flow policy deploy train:2', ...RUN, 'flow metrics']);
    expect([...r.passed].sort()).toEqual(ids(l).sort());
  });

  it('checks the train interval even after unrelated output, and rejects the default', async () => {
    expect((await play(l, ['flow policy deploy train:5'])).passed.has('often')).toBe(false);
    expect((await play(l, ['flow policy deploy train:3'])).passed.has('often')).toBe(false);
    const m = await createSimMachine(l.setup, { registry: reg });
    await m.exec('flow policy deploy train:2');
    await m.exec('echo unrelated');
    expect(evaluateCheck(l.tasks.find(t => t.id === 'often')!.check, await m.facts()).pass).toBe(true);
  });

  it('whatever the learner answers to the notes, the goals hold and lead time gets shorter (the quiz)', async () => {
    for (const t of ['hire', 'automate', 'leave']) for (const b of ['name', 'review']) for (const r of ['big', 'small']) {
      const slow = await play(l, [...answers(t, b, r), 'flow metrics']);
      expect([t, b, r, slow.passed.has('as-is')]).toEqual([t, b, r, true]);
      for (const train of ['train:2', 'train:1']) {
        const fast = await play(l, [`flow policy deploy ${train}`, ...answers(t, b, r), 'flow metrics']);
        expect([train, t, b, r, fast.passed.has('compare')]).toEqual([train, t, b, r, true]);
        expect(fast.flow.metrics.changeLeadMedianDays).toBeLessThan(slow.flow.metrics.changeLeadMedianDays);
        expect(fast.flow.metrics.deploys).toBeGreaterThanOrEqual(2 * slow.flow.metrics.deploys);
      }
    }
  });

  it('typical mistakes fail with their explanation', async () => {
    expect((await play(l, ['flow policy deploy train:2', ...RUN, 'flow metrics'])).say('as-is')).toContain('больше пяти');
    expect((await play(l, ['flow policy deploy manual'])).say('often')).toContain('flow deploy');
    expect((await play(l, [...RUN, 'flow metrics'])).say('compare')).toContain('второй прогон повторит первый');
    expect((await play(l, ['flow policy deploy train:2', ...answers('automate', 'review', 'freeze'), 'flow metrics'])).say('compare')).toContain('заморозкой');
    expect((await play(l, ['flow wip dev none', 'flow policy deploy train:2', ...RUN, 'flow metrics'])).say('compare')).toContain('flow reset');
  });
});

describe('the practices of the block', () => {
  const practices: [string, string][] = [
    ['methodology.flow', 'practice-wip'],
    ['methodology.bottleneck', 'practice-beginner'],
    ['methodology.batch', 'practice'],
    ['methodology.agile', 'practice-sprint'],
    ['methodology.dora', 'practice'],
  ];

  it('each is followed by a quiz about the run, shown to the same levels', () => {
    for (const [lesson, section] of practices) {
      const l = registry.lessons.get(lesson)!;
      const practice = l.sections.find((s) => s.id === section)!;
      const quiz = l.sections.find((s) => s.id === 'exit-practice')!;
      expect(quiz.kind).toBe('quiz');
      for (const level of practice.levels ?? []) expect(quiz.levels).toContain(level);
    }
  });

  it('a beginner never meets two lessons in a row without something to do', () => {
    const block = registry.blocks.get('methodology')!;
    const hands = block.lessons.map((id) =>
      registry.lessons.get(id)!.sections.some((s) => (!s.levels || s.levels.includes('beginner')) && (s.kind === 'terminal' || s.kind === 'widget' || s.kind === 'explainer' || (s.kind === 'docs' && s.mode === 'find'))),
    );
    let gap = 0;
    for (const h of hands) {
      gap = h ? 0 : gap + 1;
      expect(gap).toBeLessThanOrEqual(1);
    }
  });

  it('every chip is a short command a phone keyboard can take', () => {
    for (const [lesson, section] of practices) for (const t of lab(lesson, section).tasks) expect(t.chips!.length).toBeLessThanOrEqual(28);
  });
});
