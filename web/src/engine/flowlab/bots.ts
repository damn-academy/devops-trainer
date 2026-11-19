// Bots, policy replays and counterfactuals (07 §8.12).
//
// Baseline bot: how teams work without the method — no limits, first in first
// out, everything urgent goes straight into work, no internal improvements,
// the first option of every dilemma.
// Reference bot: one rule set for every scenario so the reference is
// reproducible — limit = people on the stage + 1, pull by CD3, free people
// swarm a stage whose queue is at least twice its limit, take the listed
// improvements at once, deploy as often as possible, the reference option of
// every dilemma.
//
// Counterfactuals replay the learner's run as a policy (the decisions they
// made and how full they kept each column), change one decision, and compare.

import { bi, fmt, type Bi } from '../../core/i18n';
import { metrics } from './metrics';
import { act, autopull, candidates, colName, createState, dilemmaOf, endDay, inColumn, limitOf, workColumns } from './sim';
import type { Action, DayTrace, FlowMetrics, Scenario, Stage, State, WorkStage } from './types';

export type BotKind = 'baseline' | 'reference';

/** People whose home is a stage: the base of the reference limit. */
export function peopleAt(s: State | Scenario, stage: Stage): number {
  return s.people.filter((p) => p.home === stage && p.from === undefined).length;
}

export function referenceLimit(sc: Scenario, stage: Stage): number | null {
  if (stage === 'deploy' || stage === 'backlog' || stage === 'done') return null;
  return sc.refWip?.[stage] ?? peopleAt(sc, stage) + 1;
}

function botMorning(s: State, sc: Scenario, kind: BotKind): void {
  // Every change goes through act(), so a bot run has a trace like the learner's and can be replayed.
  for (const p of s.people) if (p.station !== p.home) act(s, sc, { k: 'station', role: p.role, stage: p.home });
  const dl = dilemmaOf(sc, s.pending);
  if (dl) {
    const opt = (kind === 'reference' ? dl.options.find((o) => o.reference) : dl.options.find((o) => o.baseline)) ?? dl.options[0];
    act(s, sc, { k: 'decide', dilemma: dl.id, option: opt.id });
  }
  if (kind === 'baseline') {
    // No limits, but people do not start everything at once either: each keeps up to three tasks going.
    const cap: Partial<Record<Stage, number>> = {};
    for (const col of workColumns(sc)) cap[col] = col === 'deploy' ? Infinity : Math.max(3, 3 * peopleAt(s, col));
    autopull(s, sc, { skipImprovements: true, cap });
    return;
  }
  if (s.caps.autoDeploy && s.policies.deploy.mode !== 'on-merge') act(s, sc, { k: 'policy', deploy: { mode: 'on-merge' } });
  autopull(s, sc);
  // Swarming: a free person helps the stage whose queue is at least twice its limit.
  for (const p of s.people) {
    if (p.station === 'ops') continue;
    const busy = inColumn(s, p.station).some((c) => c.sub === 'doing');
    if (busy) continue;
    let best: WorkStage | null = null;
    let bestRatio = 2;
    for (const col of workColumns(sc)) {
      if (col === 'deploy' || col === p.station) continue;
      const lim = limitOf(s, col) ?? peopleAt(s, col) + 1;
      const queue = candidates(s, sc, col).length + inColumn(s, col).filter((c) => c.sub === 'doing').length;
      if (queue / lim >= bestRatio) {
        bestRatio = queue / lim;
        best = col as WorkStage;
      }
    }
    if (best) act(s, sc, { k: 'station', role: p.role, stage: best });
  }
  if (sc.columns.includes('deploy') && s.policies.deploy.mode !== 'on-merge' && inColumn(s, 'deploy').length) act(s, sc, { k: 'deploy' });
}

export function runBot(sc: Scenario, seed: number, kind: BotKind): State {
  const s = createState(sc, seed);
  act(s, sc, { k: 'policy', auto: false, pullOrder: kind === 'baseline' ? 'fifo' : 'cd3' });
  for (const col of workColumns(sc)) act(s, sc, { k: 'wip', stage: col, limit: kind === 'baseline' ? null : referenceLimit(sc, col) });
  if (kind === 'reference') for (const id of sc.refImprovements ?? []) act(s, sc, { k: 'prioritize', card: id });
  while (!s.finished) {
    botMorning(s, sc, kind);
    endDay(s, sc);
  }
  return s;
}

const botCache = new Map<string, { baseline: FlowMetrics; reference: FlowMetrics; baselineState: State; referenceState: State }>();

/** Both bots on the learner's seed (cached: a run is deterministic). */
export function bots(sc: Scenario, seed: number) {
  const key = `${sc.id}:${seed}`;
  let v = botCache.get(key);
  if (!v) {
    const b = runBot(sc, seed, 'baseline');
    const r = runBot(sc, seed, 'reference');
    v = { baseline: metrics(b, sc), reference: metrics(r, sc), baselineState: b, referenceState: r };
    botCache.set(key, v);
  }
  return v;
}

/** The pass line of a metric: baseline + 0.6 × (reference − baseline) on the same seed (07 §8.12). */
export function passLine(sc: Scenario, seed: number): FlowMetrics {
  const { baseline, reference } = bots(sc, seed);
  const out = {} as FlowMetrics;
  for (const k of Object.keys(baseline) as (keyof FlowMetrics)[]) out[k] = Math.round((baseline[k] + 0.6 * (reference[k] - baseline[k])) * 100) / 100;
  return out;
}

// ── policy replay ──

/** The learner's day as a policy: decisions and settings, not individual card moves. */
function asPolicy(t: DayTrace, s: State): Action[] {
  const out: Action[] = [];
  for (const a of t.actions) {
    if (a.k === 'pull') continue;
    if (a.k === 'move') {
      const c = s.cards.find((x) => x.id === a.card);
      if (c?.type === 'improvement' && a.to !== 'deploy') out.push({ k: 'prioritize', card: a.card });
      continue;
    }
    out.push(a);
  }
  return out;
}

export interface TraceDay {
  day: number;
  actions: Action[];
  load: Partial<Record<Stage, number>>;
  count: Partial<Record<Stage, number>>;
}

/** The learner's run as a list of policy days (from the trace of a played state). */
export function policyTrace(played: State): TraceDay[] {
  return played.trace.map((t) => ({ day: t.day, actions: asPolicy(t, played), load: { ...t.load }, count: { ...t.count } }));
}

/** Replay a policy trace on a fresh state: the autopilot pulls up to how full the learner kept each column. */
export function replayPolicy(sc: Scenario, seed: number, trace: TraceDay[]): State {
  const s = createState(sc, seed);
  for (const t of trace) {
    if (s.finished) break;
    for (const a of t.actions) {
      act(s, sc, a);
    }
    endDay(s, sc, { autopull: { cap: t.load } });
  }
  return s;
}

// ── counterfactuals ──

export interface Counterfactual {
  id: string;
  day: number;
  /** What the learner did. */
  did: Bi;
  /** The alternative that was replayed. */
  alt: Bi;
  /** One sentence with numbers from both runs. */
  effect: Bi;
  /** > 0: the learner's decision was better than the alternative. */
  score: number;
  you: FlowMetrics;
  other: FlowMetrics;
  why?: string;
}

type Mod = { id: string; day: number; did: Bi; alt: Bi; why?: string; apply: (t: TraceDay[]) => TraceDay[] };

const cloneTrace = (t: TraceDay[]) => t.map((d) => ({ day: d.day, actions: [...d.actions], load: { ...d.load }, count: { ...d.count } }));

function candidatesMods(sc: Scenario, played: State, trace: TraceDay[]): Mod[] {
  const mods: Mod[] = [];
  trace.forEach((t, ti) => {
    t.actions.forEach((a, ai) => {
      const without = (tr: TraceDay[]) => {
        const c = cloneTrace(tr);
        c[ti].actions.splice(ai, 1);
        return c;
      };
      if (a.k === 'decide') {
        const dl = dilemmaOf(sc, a.dilemma);
        const mine = dl?.options.find((o) => o.id === a.option);
        const other = dl?.options.find((o) => o.id !== a.option && o.reference) ?? dl?.options.find((o) => o.id !== a.option && o.baseline) ?? dl?.options.find((o) => o.id !== a.option);
        if (!dl || !mine || !other) return;
        mods.push({
          id: `decide:${a.dilemma}`,
          day: t.day,
          did: mine.label,
          alt: other.label,
          why: other.why ?? mine.why,
          apply: (tr) => {
            const c = cloneTrace(tr);
            c[ti].actions[ai] = { k: 'decide', dilemma: a.dilemma, option: other.id };
            return c;
          },
        });
      }
      if (a.k === 'wip') {
        const ref = referenceLimit(sc, a.stage);
        const alt = a.limit === ref ? null : ref;
        const name = colName(sc, a.stage);
        mods.push({
          id: `wip:${a.stage}:${t.day}`,
          day: t.day,
          did: a.limit === null ? fmt(bi('Сняли лимит колонки «{c}»', 'Removed the limit of “{e}”'), { c: name.ru, e: name.en }) : fmt(bi('Лимит колонки «{c}» = {l}', 'Limit of “{e}” = {l}'), { c: name.ru, e: name.en, l: a.limit }),
          alt: alt === null ? fmt(bi('без лимита в «{c}»', 'no limit in “{e}”'), { c: name.ru, e: name.en }) : fmt(bi('лимит {l} (людей на этапе + 1)', 'a limit of {l} (people on the stage + 1)'), { l: alt }),
          why: 'wip',
          apply: (tr) => {
            const c = cloneTrace(tr);
            c[ti].actions[ai] = { k: 'wip', stage: a.stage, limit: alt };
            return c;
          },
        });
      }
      if (a.k === 'station') {
        const name = a.stage === 'ops' ? bi('эксплуатация', 'operations') : colName(sc, a.stage);
        mods.push({ id: `station:${a.role}:${t.day}`, day: t.day, did: fmt(bi('{r} перешёл в «{c}»', '{r} moved to “{e}”'), { r: a.role, c: name.ru, e: name.en }), alt: bi('остаться на своём этапе', 'stay at their own stage'), why: 'bottleneck', apply: without });
      }
      if (a.k === 'prioritize') {
        const card = played.cards.find((x) => x.id === a.card);
        if (card) mods.push({ id: `improve:${a.card}`, day: t.day, did: fmt(bi('Взяли в работу «{t}»', 'Started “{e}”'), { t: card.title.ru, e: card.title.en }), alt: bi('не брать это улучшение', 'not to take this improvement'), why: 'automation', apply: without });
      }
      if (a.k === 'policy' && a.deploy) {
        mods.push({ id: `deploy:${t.day}`, day: t.day, did: bi('Поменяли способ выкладки', 'Changed how deployments happen'), alt: bi('прежний способ выкладки', 'the previous way of deploying'), why: 'batch', apply: without });
      }
    });
  });
  // Improvements the learner never started.
  for (const c of played.cards) {
    if (c.type !== 'improvement' || c.startedDay !== undefined || !trace.length) continue;
    mods.push({
      id: `improve-skip:${c.id}`,
      day: 1,
      did: fmt(bi('Не взяли «{t}»', 'Did not take “{e}”'), { t: c.title.ru, e: c.title.en }),
      alt: bi('взять это улучшение в первый день', 'take this improvement on day one'),
      why: 'automation',
      apply: (tr) => {
        const x = cloneTrace(tr);
        x[0].actions.unshift({ k: 'prioritize', card: c.id });
        return x;
      },
    });
  }
  // Overloaded columns without a limit: the first day each column held more than people + 1.
  for (const col of workColumns(sc)) {
    const ref = referenceLimit(sc, col);
    if (ref === null) continue;
    const i = trace.findIndex((t) => (t.count[col] ?? 0) > ref + 1);
    if (i < 0) continue;
    const n = Math.max(...trace.slice(i).map((t) => t.count[col] ?? 0));
    const name = colName(sc, col);
    mods.push({
      id: `load:${col}`,
      day: trace[i].day,
      did: fmt(bi('Держали в «{c}» до {n} карточек', 'Kept up to {n} cards in “{e}”'), { c: name.ru, e: name.en, n }),
      alt: fmt(bi('не больше {l} карточек в «{c}»', 'at most {l} cards in “{e}”'), { l: ref, c: name.ru, e: name.en }),
      why: 'wip',
      apply: (tr) =>
        cloneTrace(tr).map((t, j) => {
          if (j >= i) t.load[col] = Math.min(t.load[col] ?? Infinity, ref);
          return t;
        }),
    });
  }
  return mods.slice(0, 12);
}

const SCALE: Partial<Record<keyof FlowMetrics, number>> = { moneyNet: 20000, cycleP85: 2, cfr: 0.2, budgetLeftRatio: 0.5 };
const BETTER_HIGH: Partial<Record<keyof FlowMetrics, boolean>> = { moneyNet: true, cycleP85: false, cfr: false, budgetLeftRatio: true };

function scales(sc: Scenario, seed: number): Record<string, number> {
  const { baseline, reference } = bots(sc, seed);
  const out: Record<string, number> = {};
  for (const k of Object.keys(SCALE) as (keyof FlowMetrics)[]) out[k] = Math.max(Math.abs(baseline[k] - reference[k]), SCALE[k]!);
  return out;
}

function keysFor(sc: Scenario): (keyof FlowMetrics)[] {
  const k: (keyof FlowMetrics)[] = ['moneyNet', 'cycleP85'];
  if (sc.columns.includes('deploy')) k.push('cfr');
  if (sc.features.budget) k.push('budgetLeftRatio');
  return k;
}

export function effectSentence(key: keyof FlowMetrics, you: number, other: number): Bi {
  const money = (x: number) => `${Math.round(x / 1000)} 000 ₽`;
  const usd = (x: number) => `$${Math.round(x / 80).toLocaleString('en-US')}`;
  switch (key) {
    case 'cycleP85':
      return fmt(bi('время цикла p85 было бы {o} дн. вместо {y}', 'cycle time p85 would have been {o} d instead of {y}'), { o: other, y: you });
    case 'moneyNet':
      return fmt(bi('итог по деньгам был бы {o} вместо {y}', 'the money result would have been {oe} instead of {ye}'), { o: money(other), y: money(you), oe: usd(other), ye: usd(you) });
    case 'cfr':
      return fmt(bi('доля неудачных выкладок была бы {o}% вместо {y}%', 'the change failure rate would have been {o}% instead of {y}%'), { o: Math.round(other * 100), y: Math.round(you * 100) });
    case 'budgetLeftRatio':
      return fmt(bi('остаток бюджета ошибок был бы {o}% вместо {y}%', 'the error budget left would have been {o}% instead of {y}%'), { o: Math.round(other * 100), y: Math.round(you * 100) });
    default:
      return fmt(bi('{k}: {o} вместо {y}', '{k}: {o} instead of {y}'), { k: String(key), o: other, y: you });
  }
}

/** The decisions that changed the result most (07 §10, screen 3). */
export function counterfactuals(sc: Scenario, played: State, top = 3): Counterfactual[] {
  const trace = policyTrace(played);
  if (!trace.length) return [];
  const base = replayPolicy(sc, played.seed, trace);
  const you = metrics(base, sc);
  const sc_ = scales(sc, played.seed);
  const keys = keysFor(sc);
  const out: Counterfactual[] = [];
  for (const m of candidatesMods(sc, played, trace)) {
    const other = metrics(replayPolicy(sc, played.seed, m.apply(trace)), sc);
    let score = 0;
    let bestKey = keys[0];
    let bestAbs = -1;
    for (const k of keys) {
      const dlt = ((you[k] - other[k]) / sc_[k]) * (BETTER_HIGH[k] ? 1 : -1);
      score += dlt;
      if (Math.abs(dlt) > bestAbs) {
        bestAbs = Math.abs(dlt);
        bestKey = k;
      }
    }
    if (bestAbs < 0.05) continue;
    const sent = effectSentence(bestKey, you[bestKey], other[bestKey]);
    const effect = fmt(bi('Если бы {a}: {s}.', 'Had you chosen {ae}: {se}.'), { a: m.alt.ru, s: sent.ru, ae: m.alt.en, se: sent.en });
    out.push({ id: m.id, day: m.day, did: m.did, alt: m.alt, effect, score: Math.round(score * 100) / 100, you, other, why: m.why });
  }
  return out.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, top);
}
