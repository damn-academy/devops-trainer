// flowlab engine: randomness, the day rules (07 §8.3–8.5), metrics, bots,
// counterfactuals and the `flow` terminal command with facts.flow.

import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { replayLog } from '../src/engine/flowlab/board';
import { bots, counterfactuals, passLine, policyTrace, replayPolicy, runBot } from '../src/engine/flowlab/bots';
import { flowCommand, flowFacts, flowSetup, session } from '../src/engine/flowlab/cli';
import { explainHits } from '../src/engine/flowlab/debrief';
import { little, median, metrics, percentile } from '../src/engine/flowlab/metrics';
import { hash32, mulberry32, rand } from '../src/engine/flowlab/rng';
import { P10, P5, S0, S1, S2 } from '../src/engine/flowlab/scenarios';
import { act, canMove, capacity, createState, detectMinutes, diagnoseMinutes, endDay, inColumn, pFail, restoreMinutes, runToEnd, weinberg } from '../src/engine/flowlab/sim';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import { createSimMachine, stripAnsi } from '../src/engine/terminal/shell';
import type { Scenario, State } from '../src/engine/flowlab/types';

const r2 = (x: number) => Math.round(x * 100) / 100;

describe('flowlab randomness', () => {
  it('mulberry32 is deterministic and roughly uniform', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 2000 }, () => a());
    expect(xs.slice(0, 5)).toEqual(Array.from({ length: 5 }, () => b()));
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('keyed streams are pure and independent of call order', () => {
    expect(rand(7, 'cap:QA:3')).toBe(rand(7, 'cap:QA:3'));
    expect(rand(7, 'cap:QA:3')).not.toBe(rand(7, 'cap:QA:4'));
    expect(rand(7, 'cap:QA:3')).not.toBe(rand(8, 'cap:QA:3'));
    expect(hash32('a')).not.toBe(hash32('b'));
  });

  it('a decision does not reshuffle anybody’s dice (common random numbers)', () => {
    const p = S1.people[3];
    const before = [1, 2, 3, 4, 5].map((d) => capacity(S1, 7, p, d));
    const s = createState(S1, 7);
    act(s, S1, { k: 'wip', stage: 'dev', limit: 2 });
    runToEnd(s, S1);
    expect([1, 2, 3, 4, 5].map((d) => capacity(S1, 7, p, d))).toEqual(before);
  });
});

describe('flowlab formulas (07 §8.4)', () => {
  it('reproduces the calibration table of the deployment risk', () => {
    const table: [number, number, number][] = [
      [1, 0, 0.07],
      [1, 0.6, 0.04],
      [5, 0, 0.28],
      [8, 0, 0.44],
      [10, 0, 0.54],
      [10, 0.6, 0.27],
    ];
    for (const [b, ta, want] of table) expect(r2(pFail(Array(b).fill(0.05), ta, b))).toBeCloseTo(want, 1);
    expect(pFail(Array(40).fill(0.08), 0)).toBe(0.9);
  });

  it('detection depends on what watches the shop', () => {
    expect(detectMinutes('none', 'down', 1, 0.999)).toBe(240);
    expect(detectMinutes('host-check', 'down', 1, 0.999)).toBe(30);
    expect(detectMinutes('host-check', 'checkout-broken', 0.2, 0.999)).toBe(240);
    expect(detectMinutes('slo-alerts', 'checkout-broken', 0.2, 0.999)).toBe(5);
    // burn 8 between the thresholds 6 and 14.4: 2160 / 8 = 270 → capped at 240
    expect(detectMinutes('slo-alerts', 'slow', 0.008, 0.999)).toBe(240);
    expect(detectMinutes('slo-alerts', 'slow', 0.012, 0.999)).toBe(180);
  });

  it('diagnosis grows with the batch, the absent expert and blame; restore depends on rollback', () => {
    expect(diagnoseMinutes(1, false, false)).toBe(30);
    expect(diagnoseMinutes(10, false, false)).toBe(98);
    expect(diagnoseMinutes(1, true, false)).toBe(180);
    expect(diagnoseMinutes(1, true, true)).toBe(30);
    expect(diagnoseMinutes(1, false, false, true)).toBe(60);
    expect(restoreMinutes(true)).toBe(10);
    expect(restoreMinutes(false)).toBe(120);
  });

  it('Weinberg’s switching table', () => {
    expect([1, 2, 3, 4, 5, 9].map(weinberg)).toEqual([1, 0.8, 0.6, 0.4, 0.25, 0.25]);
  });

  it('percentiles and medians', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], 0.85)).toBe(17);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

/** S0 by hand: pull one card a day. */
function s0OneAtATime(): State {
  const s = createState(S0);
  while (!s.finished) {
    if (s.pending) act(s, S0, { k: 'decide', dilemma: s.pending, option: 'one' });
    if (!inColumn(s, 'dev').length) act(s, S0, { k: 'pull', stage: 'dev' });
    endDay(s, S0);
  }
  return s;
}

describe('S0 "One desk": finishing beats starting', () => {
  it('one at a time: one task a day', () => {
    const s = s0OneAtATime();
    expect(metrics(s, S0).doneCount).toBe(8);
    expect(s.history.map((h) => h.doneTotal)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('everything at once: nothing is finished in eight days', () => {
    const s = createState(S0);
    act(s, S0, { k: 'move', card: 'B1', to: 'dev' });
    endDay(s, S0);
    act(s, S0, { k: 'decide', dilemma: 's0-all', option: 'all' });
    runToEnd(s, S0);
    expect(metrics(s, S0).doneCount).toBe(1);
    // 11 tasks in progress with 3 points each: 3 × 0.25 / 11 ≈ 0.068 points a day each
    const n1 = s.cards.find((c) => c.id === 'N1')!;
    expect(r2(n1.done.dev!)).toBeCloseTo(r2((0.75 / 11) * 7), 2);
  });

  it('the bots bracket the goal', () => {
    const b = bots(S0, S0.defaultSeed);
    expect(b.reference.doneCount).toBeGreaterThanOrEqual(6);
    expect(b.baseline.doneCount).toBeLessThan(6);
  });
});

describe('moves follow pull and limits', () => {
  it('only to the next column, only from "done"', () => {
    const s = createState(S1, 7);
    expect(canMove(s, S1, 'B1', 'dev').ok).toBe(false);
    expect(canMove(s, S1, 'B1', 'analysis').ok).toBe(true);
    act(s, S1, { k: 'move', card: 'B1', to: 'analysis' });
    expect(canMove(s, S1, 'B1', 'dev').ok).toBe(false);
    expect(s.cards.find((c) => c.id === 'B1')!.startedDay).toBe(1);
  });

  it('strict mode refuses a move into a full column, normal mode highlights it', () => {
    const s = createState(S1, 7);
    act(s, S1, { k: 'wip', stage: 'analysis', limit: 1 });
    act(s, S1, { k: 'move', card: 'B1', to: 'analysis' });
    expect(act(s, S1, { k: 'move', card: 'B2', to: 'analysis' }).overLimit).toBe(true);
    act(s, S1, { k: 'policy', strictWip: true });
    const r = act(s, S1, { k: 'move', card: 'B3', to: 'analysis' });
    expect(r.ok).toBe(false);
    expect(r.overLimit).toBe(true);
  });

  it('cards cannot be put into Done by hand', () => {
    const s = createState(S0);
    act(s, S0, { k: 'move', card: 'B1', to: 'dev' });
    endDay(s, S0);
    expect(s.cards.find((c) => c.id === 'B1')!.stage).toBe('done');
    expect(canMove(s, S0, 'B2', 'done').ok).toBe(false);
  });
});

describe('the run is deterministic and replayable', () => {
  it('same seed and decisions give the same run; a saved log rebuilds it', () => {
    const play = () => {
      const s = createState(S2, 42);
      act(s, S2, { k: 'wip', stage: 'dev', limit: 3 });
      act(s, S2, { k: 'policy', auto: true });
      runToEnd(s, S2);
      return s;
    };
    expect(metrics(play(), S2)).toEqual(metrics(play(), S2));
    const run = { v: 1 as const, scenario: 's2', seed: 42, days: [{ a: [{ k: 'wip', stage: 'dev', limit: 3 } as const] }, { a: [] }, { a: [] }] };
    const s = replayLog(S2, run);
    expect(s.history.length).toBe(2);
  });

  it('a policy replay of a bot run reproduces it', () => {
    const r = runBot(S1, 3, 'reference');
    const again = replayPolicy(S1, 3, policyTrace(r));
    expect(metrics(again, S1).doneCount).toBe(metrics(r, S1).doneCount);
  });
});

describe('bots and pass lines (07 §8.12)', () => {
  const pool: [Scenario, number[]][] = [
    [S1, [7, 1, 2, 3]],
    [S2, [42, 1, 2, 3]],
    [P10, [11, 1, 2, 3]],
  ];
  it('the reference beats the baseline on every seed of the pool', () => {
    for (const [sc, seeds] of pool) {
      for (const seed of seeds) {
        const { baseline, reference } = bots(sc, seed);
        expect(reference.cycleP85, `${sc.id}:${seed}`).toBeLessThan(baseline.cycleP85);
        expect(reference.doneCount, `${sc.id}:${seed}`).toBeGreaterThan(baseline.doneCount);
        expect(reference.moneyNet, `${sc.id}:${seed}`).toBeGreaterThan(baseline.moneyNet);
      }
    }
  });

  it('the pass line lies between the two bots', () => {
    const { baseline, reference } = bots(S1, 7);
    const line = passLine(S1, 7);
    expect(line.cycleP85).toBeLessThanOrEqual(baseline.cycleP85);
    expect(line.cycleP85).toBeGreaterThanOrEqual(reference.cycleP85);
  });

  it('in Black Friday the reference automates, deploys small and keeps the budget better', () => {
    const { baseline, reference, referenceState } = bots(S2, 42);
    expect(referenceState.caps.autoDeploy).toBe(true);
    expect(reference.deploys).toBeGreaterThan(baseline.deploys);
    expect(reference.budgetLeftRatio).toBeGreaterThan(baseline.budgetLeftRatio);
    expect(reference.promoByDue).toBeGreaterThanOrEqual(baseline.promoByDue);
  });

  it('Little’s law holds approximately on a stable reference run', () => {
    const s = runBot(S1, 7, 'reference');
    const l = little(s);
    expect(Math.abs(l.wip - l.product) / l.wip).toBeLessThan(0.35);
  });
});

describe('counterfactuals (07 §10)', () => {
  it('finds the decisions that changed the result, with numbers from both runs', () => {
    const s = createState(S1, 7);
    while (!s.finished) {
      if (s.pending) act(s, S1, { k: 'decide', dilemma: s.pending, option: 'all' });
      endDay(s, S1, { autopull: {} });
    }
    const cf = counterfactuals(S1, s);
    expect(cf.length).toBeGreaterThan(0);
    expect(cf.length).toBeLessThanOrEqual(3);
    for (const c of cf) {
      expect(c.effect.ru.length).toBeGreaterThan(10);
      expect(c.effect.en.length).toBeGreaterThan(10);
    }
    // Starting all five promo tasks without limits should be worse than the alternatives.
    expect(cf.some((c) => c.score < 0)).toBe(true);
  });
});

describe('explain it yourself', () => {
  it('finds key ideas by stems in both languages', () => {
    expect(explainHits(S1, 'Лимит уменьшает очередь и переключения, а по закону Литтла время цикла падает')).toEqual([true, true, true, true]);
    expect(explainHits(S1, 'A limit cuts the queue')).toEqual([true, true, false, false]);
  });
});

describe('`flow` in the terminal and facts.flow', () => {
  const reg = createTerminalRegistry();
  for (const c of [...BUILTINS, ...BASIC_COMMANDS, flowCommand]) reg.commands.add(c);
  reg.facts.push(flowFacts);
  reg.setup.push(flowSetup);
  const mk = (scenario: string) => createSimMachine({ ext: { flow: { scenario } } }, { registry: reg });

  it('drives the board and reports facts', async () => {
    const m = await mk('p5');
    const st = stripAnsi((await m.exec('flow status')).out);
    expect(st).toContain('Analysis');
    expect((await m.exec('flow backlog')).out).toContain('B1');
    expect((await m.exec('flow status --all')).out).not.toMatch(/ \+\d/);
    expect((await m.exec('flow metrics')).out).toContain('money net (RUB)');
    expect((await m.exec('flow goal')).out).toContain('money net:');
    expect((await m.exec('flow wip analysis 2')).exit).toBe(0);
    expect((await m.exec('flow wip nowhere 2')).exit).toBe(2);
    expect((await m.exec('flow move B1 test')).exit).toBe(1);
    const f = (await m.facts()).flow as { daysDone: number; policies: { wip: Record<string, number | null> } };
    expect(f.policies.wip.analysis).toBe(2);
    expect(f.daysDone).toBe(0);
  });

  it('exposes current stations, autopilot and deployment interval without reading output', async () => {
    const m = await mk('s2');
    await m.exec('flow station DEV-2 test');
    await m.exec('flow auto on');
    await m.exec('flow policy deploy train:2');
    await m.exec('echo unrelated');
    expect(evaluateCheck({ when: 'flow.people.DEV-2.station=test && flow.policies.auto=1 && flow.policies.deploy=train && flow.policies.deployEvery=2' }, await m.facts()).pass).toBe(true);
    await m.exec('flow auto off');
    await m.exec('flow policy deploy manual');
    expect((await m.facts()).flow).toMatchObject({ policies: { auto: 0, deploy: 'manual', deployEvery: null } });
    // Facts must not expose mutable simulator state.
    const facts = (await m.facts()).flow as { people: Record<string, { station: string }> };
    facts.people['DEV-2'].station = 'dev';
    expect((await m.facts()).flow).toMatchObject({ people: { 'DEV-2': { station: 'test' } } });
  });

  it('reports routine ops share separately from incidents over the last ten days', async () => {
    const m = await mk('s2');
    expect((await m.facts()).flow).toMatchObject({ ops: { toilShare10: 0 } });
    const f = session(m);
    while (!f.s!.finished) f.next();
    const days = f.s!.history.slice(-10);
    const cap = days.reduce((n, h) => n + h.ops.capacity, 0);
    const toil = days.reduce((n, h) => n + h.ops.toil, 0);
    expect(cap).toBeGreaterThan(0);
    expect(toil).toBeGreaterThan(0);
    expect((await m.facts()).flow).toMatchObject({ ops: { toilShare10: toil / cap } });
    // An older busy day is outside the window; incidents are not routine work.
    f.s!.history = Array.from({ length: 11 }, (_, i) => ({ ...days[0], day: i + 1,
      ops: { ...days[0].ops, capacity: 10, toil: i === 0 ? 10 : 2, unplanned: 3 } }));
    expect((await m.facts()).flow).toMatchObject({ ops: { toilShare10: 0.2 }, metrics: { opsToilShare10: 0.5 } });
    const noOps = await mk('p5');
    await noOps.exec('flow next 5');
    expect((await noOps.facts()).flow).toMatchObject({ ops: { toilShare10: 0 } });
  });

  it('the intermediate placement goal: reference limits pass, no limits fail', async () => {
    const goal = { when: 'flow.daysDone>=5 && flow.pass.done=1' };
    const good = await mk('p5');
    for (const line of ['flow wip analysis 2', 'flow wip dev 2', 'flow wip test 2', 'flow next 5']) await good.exec(line);
    expect(evaluateCheck(goal, await good.facts()).pass).toBe(true);
    const bad = await mk('p5');
    await bad.exec('flow next 5');
    expect(evaluateCheck(goal, await bad.facts()).pass).toBe(false);
  });

  it('survives a snapshot and restore', async () => {
    const m = await mk('p5');
    await m.exec('flow wip dev 2');
    await m.exec('flow next 2');
    const snap = await m.snapshot();
    const m2 = await createSimMachine({}, { registry: reg });
    await m2.restore(snap);
    const f = (await m2.facts()).flow as { daysDone: number; policies: { wip: Record<string, number | null> } };
    expect(f.daysDone).toBe(2);
    expect(f.policies.wip.dev).toBe(2);
  });

  it('resets to captured setup, including after snapshots and a new seed', async () => {
    const m = await createSimMachine({ ext: { flow: { scenario: 's2', seed: 42 } }, script: [
      'flow auto on', 'flow wip analysis 2', 'flow wip dev 3', 'flow wip test 2',
      'flow policy pull cd3', 'flow policy deploy train:2', 'flow station DEV-2 test',
    ] }, { registry: reg });
    const initial = (await m.facts()).flow;
    await m.exec('flow auto off');
    await m.exec('flow policy deploy manual');
    await m.exec('flow policy pull fifo');
    await m.exec('flow wip dev none');
    await m.exec('flow station DEV-2 dev');
    await m.exec('flow next 5');
    const snap = await m.snapshot();
    const other = await mk('p5');
    await other.restore(snap);
    for (const machine of [m, other]) {
      await machine.exec('flow reset');
      expect((await machine.facts()).flow).toEqual(initial);
      await machine.exec('flow next 2');
      await machine.exec('flow reset');
      expect((await machine.facts()).flow).toEqual(initial);
      await machine.exec('flow reset 77');
      expect((await machine.facts()).flow).toMatchObject({ seed: 77, daysDone: 0,
        policies: { auto: 1, deploy: 'train', deployEvery: 2, pullOrder: 'cd3', wip: { dev: 3 } } });
    }
  });

  it('P5 is deterministic: the numbers in the placement prompt hold', () => {
    const { baseline, reference } = bots(P5, P5.defaultSeed);
    expect(baseline.doneCount).toBe(3);
    expect(reference.doneCount).toBe(6);
  });

  it('captures setup scripts that start a scenario and advance days without ext.flow', async () => {
    const m = await createSimMachine({ script: [
      'flow reset s1 7', 'flow auto on', 'flow wip analysis 2',
      'flow next 2', 'flow decide s1-promo top', 'flow next',
    ] }, { registry: reg });
    const initial = structuredClone(session(m).s);
    expect(initial!.history).toHaveLength(3);
    expect(initial!.decided['s1-promo']).toBe('top');
    const snap = await m.snapshot();
    const restored = await mk('p5');
    await restored.restore(snap);
    for (const machine of [m, restored]) {
      for (let i = 0; i < 2; i++) {
        await machine.exec('flow next 15');
        await machine.exec('flow reset');
        expect(session(machine).s).toEqual(initial);
      }
    }
  });

  it('keeps scenario defaults for setups without scripts and legacy snapshots', async () => {
    const m = await mk('s2');
    const initial = structuredClone(session(m).s);
    await m.exec('flow auto on');
    await m.exec('flow next 2');
    await m.exec('flow reset');
    expect(session(m).s).toEqual(initial);
    session(m).restore({ id: 's2', seed: initial!.seed, actions: [[{ k: 'policy', auto: true }], []] });
    await m.exec('flow reset');
    expect(session(m).s).toEqual(initial);
  });
});
