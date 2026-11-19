// The flowlab day engine (07 §8.3–8.5). Pure TypeScript, no DOM. A run is
// createState() → for each day: actions (act) → endDay(). Everything random is
// keyed (rng.ts), so the same seed and the same decisions give the same run,
// and a different decision changes only what follows from it.

import { bi, fmt, type Bi } from '../../core/i18n';
import { BUGS, CAUSE_CARD, FEATURES, TOIL, TRAFFIC_INCIDENT } from './catalog';
import { pick, rand, randInt } from './rng';
import type { Action, Card, CardSpec, DayTrace, DeployRecord, Dilemma, DilemmaEffect, IncidentKind, IncidentRecord, LogEntry, Person, Scenario, Stage, State, WorkStage } from './types';

/** Weinberg, "Quality Software Management", vol. 1: share of useful time for k parallel tasks. */
export const WEINBERG = [1, 0.8, 0.6, 0.4, 0.25];
export const weinberg = (k: number) => (k <= 0 ? 0 : WEINBERG[Math.min(k, 5) - 1]);
/** Work outside one's own stage goes at half speed (swarming, 07 §8.3). */
export const OFF_SKILL = 0.5;
/** Points the operations engineer spends on one manual deployment. */
export const DEPLOY_COST = 2;
/** Minutes of peak traffic per day an open load incident hurts customers. */
export const EXPOSURE_MIN = 90;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const round2 = (x: number) => Math.round(x * 100) / 100;
const remaining = (c: Card, s: WorkStage) => Math.max(0, (c.work[s] ?? 0) - (c.done[s] ?? 0));
const isWorkStage = (s: Stage): s is WorkStage => s === 'analysis' || s === 'dev' || s === 'test' || s === 'ops';

/**
 * Probability that a deployment of b changes fails (07 §8.4). Each change
 * carries its own risk, automated checks remove part of it, and in a big batch
 * changes interact, so the risk of each grows with the batch size.
 */
export function pFail(risks: number[], testAutomation: number, b = risks.length): number {
  let ok = 1;
  for (const r of risks) ok *= 1 - r * (1 - testAutomation) * (1 + 0.05 * (b - 1));
  return clamp(1 - 0.98 * ok, 0, 0.9);
}

/** Minutes to notice an outage, by what watches the shop (07 §8.4). */
export function detectMinutes(monitoring: State['caps']['monitoring'], kind: IncidentKind, badRatio: number, sloTarget: number): number {
  if (monitoring === 'none') return 240;
  if (monitoring === 'host-check') return kind === 'down' ? 30 : 240;
  const burn = badRatio / (1 - sloTarget);
  if (burn >= 14.4) return 5;
  if (burn >= 6) return Math.min(240, Math.round(2160 / burn));
  return 240;
}

export function diagnoseMinutes(batch: number, opsAway: boolean, runbooks: boolean, silence = false): number {
  return Math.round(30 * (1 + 0.25 * (batch - 1)) * (opsAway && !runbooks ? 6 : 1) * (silence ? 2 : 1));
}

export const restoreMinutes = (rollback: boolean) => (rollback ? 10 : 120);

export function isSaleDay(sc: Scenario, d: number): boolean {
  return !!sc.sale && d >= sc.sale.from && d <= sc.sale.to;
}
/** Traffic multiplier of a day. */
export const trafficMult = (sc: Scenario, d: number) => (isSaleDay(sc, d) ? sc.sale!.mult : 1);

function personPresent(p: Person, d: number): boolean {
  if (p.from !== undefined && d < p.from) return false;
  return !(p.away ?? []).some(([a, b]) => d >= a && d <= b);
}

/** Capacity of a person for a day: one face of their die, keyed by role and day. */
export function capacity(sc: Scenario, seed: number, p: Person, d: number): number {
  if (!personPresent(p, d)) return 0;
  if (sc.deterministic || p.die.length === 1) return p.die[0];
  return pick(seed, `cap:${p.role}:${d}`, p.die);
}

function makeCard(spec: CardSpec, id: string, day: number, seed: number): Card {
  const size = Object.values(spec.work).reduce((a, b) => a + (b ?? 0), 0);
  return {
    id,
    title: spec.title,
    type: spec.type,
    lane: spec.lane ?? (spec.type === 'toil' || spec.type === 'incident' ? 'ops' : 'standard'),
    work: { ...spec.work },
    done: {},
    stage: spec.lane === 'ops' || spec.type === 'toil' || spec.type === 'incident' ? 'ops' : 'backlog',
    sub: 'doing',
    createdDay: day,
    codDaily: spec.codDaily ?? 0,
    risk: spec.risk ?? round2(clamp(0.03 + 0.005 * size + 0.01 * rand(seed, `risk:${id}`), 0.03, 0.08)),
    effect: spec.effect,
    opsOnly: spec.opsOnly,
    workedDays: 0,
    tags: spec.tags,
    dueDay: spec.dueDay,
  };
}

const nextId = (s: State, prefix: string) => {
  s.seq[prefix] = (s.seq[prefix] ?? 0) + 1;
  return `${prefix}${s.day}-${s.seq[prefix]}`;
};

export function log(s: State, kind: LogEntry['kind'], text: Bi, extra: Partial<LogEntry> = {}): void {
  s.log.push({ day: s.day, kind, text, ...extra });
}

/** Columns a card can be in, in board order. */
export const workColumns = (sc: Scenario): Stage[] => sc.columns.filter((c) => c !== 'backlog' && c !== 'done');

export function visible(s: State, c: Card): boolean {
  return c.visibleFrom === undefined || c.visibleFrom <= s.day;
}

/** Cards in a column that count toward its WIP limit (standard and expedite lanes). */
export function inColumn(s: State, stage: Stage): Card[] {
  return s.cards.filter((c) => c.stage === stage && c.lane !== 'ops' && visible(s, c));
}

export const limitOf = (s: State, stage: Stage) => s.policies.wip[stage] ?? null;

export function createState(sc: Scenario, seed = sc.defaultSeed): State {
  const s: State = {
    scenario: sc.id,
    seed,
    day: 1,
    finished: false,
    cards: [],
    people: sc.people.map((p) => ({ ...p, away: p.away?.map((r) => [...r] as [number, number]) })),
    policies: { ...sc.policies, wip: { ...sc.policies.wip }, deploy: { ...sc.policies.deploy } },
    caps: { ...sc.caps },
    money: { codLost: 0, downtimeLost: 0, revenue: 0, extra: 0 },
    deploys: [],
    incidents: [],
    history: [],
    log: [],
    decided: {},
    deployToday: false,
    freezeUntil: 0,
    priority: [],
    trace: [],
    seen: {},
    predictions: [],
    seq: {},
  };
  sc.backlog.forEach((spec, i) => s.cards.push(makeCard(spec, spec.id ?? `B${i + 1}`, 1, seed)));
  morning(s, sc);
  return s;
}

function traceOf(s: State): DayTrace {
  let t = s.trace[s.trace.length - 1];
  if (!t || t.day !== s.day) {
    t = { day: s.day, actions: [], load: {}, count: {} };
    s.trace.push(t);
  }
  return t;
}

// ── morning: arrivals, routine, events, dilemmas ──

function morning(s: State, sc: Scenario): void {
  const d = s.day;
  const seed = s.seed;
  const a = sc.arrivals;
  if (a && d >= (a.fromDay ?? 2) && d <= (a.untilDay ?? sc.days)) {
    const added: string[] = [];
    for (let i = 0; i < a.perDay; i++) {
      const key = `arr:${d}:${i}`;
      const isBug = a.pool === 'mixed' && rand(seed, `${key}:type`) < 0.25;
      const title = pick(seed, `${key}:title`, isBug ? BUGS : FEATURES);
      const work: CardSpec['work'] = {};
      for (const [st, range] of Object.entries(a.work) as [WorkStage, [number, number]][]) work[st] = randInt(seed, `${key}:${st}`, range[0], range[1]);
      const cod = a.cod ? Math.round(randInt(seed, `${key}:cod`, a.cod[0], a.cod[1]) / 500) * 500 : 0;
      const c = makeCard({ title, type: isBug ? 'bug' : 'feature', work, codDaily: isBug ? cod * 2 : cod }, `F${d}-${i + 1}`, d, seed);
      s.cards.push(c);
      added.push(c.title.ru);
    }
    if (a.perDay) log(s, 'event', fmt(bi('Новых карточек в очереди: {n}.', 'New cards in the queue: {n}.'), { n: a.perDay }));
  }
  if (sc.toil && sc.hasOps) {
    const raw = sc.toil.base + Math.floor(d / sc.toil.growEvery);
    const n = Math.round(raw * (1 - s.caps.toilAutomation));
    for (let i = 0; i < n; i++) {
      const id = `T${d}-${i + 1}`;
      s.cards.push(makeCard({ title: pick(seed, `toil:${d}:${i}`, TOIL), type: 'toil', lane: 'ops', work: { ops: 1 } }, id, d, seed));
    }
    if (n) log(s, 'event', fmt(bi('В дорожку эксплуатации пришло рутинных заявок: {n}.', 'Routine requests arrived in the operations lane: {n}.'), { n }), { why: 'toil' });
  }
  if (sc.trafficIncidents && sc.hasOps) {
    const traffic = isSaleDay(sc, d) ? 1 : 0.15;
    const p = sc.trafficIncidents.base + sc.trafficIncidents.k * traffic;
    if (rand(seed, `traffic:${d}`) < p) openTrafficIncident(s, sc);
  }
  for (const dl of sc.dilemmas) {
    if (dl.day === d && !(dl.id in s.decided)) {
      s.pending = dl.id;
      log(s, 'event', dl.text, { tone: 'warn' });
    }
  }
  if (isSaleDay(sc, d) && sc.sale && d === sc.sale.from) log(s, 'event', fmt(bi('Распродажа: трафик и выручка ×{m} до {to}-го дня.', 'Sale: traffic and revenue ×{m} until day {to}.'), { m: sc.sale.mult, to: sc.sale.to }), { tone: 'warn' });
  for (const p of s.people) {
    for (const [from, to] of p.away ?? []) if (from === d) log(s, 'event', fmt(bi('{r} в отпуске до {to}-го дня.', '{re} is on leave until day {to}.'), { r: p.label.ru, re: p.label.en, to }), { tone: 'warn' });
  }
}

function openTrafficIncident(s: State, sc: Scenario): void {
  const d = s.day;
  const badRatio = round2(0.05 + 0.15 * rand(s.seed, `trafficBad:${d}`));
  const target = sc.slo?.target ?? 0.999;
  const detect = detectMinutes(s.caps.monitoring, 'traffic', badRatio, target);
  const id = `I${d}`;
  const card = makeCard({ title: TRAFFIC_INCIDENT, type: 'incident', lane: 'ops', work: { ops: 3 }, opsOnly: true }, id, d, s.seed);
  card.incident = id;
  // Nobody watches the error rate: the team learns about it from customers the next morning.
  if (detect >= 240) card.visibleFrom = d + 1;
  s.cards.push(card);
  s.incidents.push({ id, day: d, kind: 'traffic', cause: 'traffic', badRatio, detect, diagnose: 0, restore: 0, downtime: 0, batch: 0, lost: 0, badMinutes: 0, open: true, card: id });
  if (detect < 240) log(s, 'incident', fmt(bi('Оповещение: под нагрузкой не проходит {p}% запросов. Карточка в дорожке эксплуатации.', 'Alert: under load {p}% of requests fail. A card is in the operations lane.'), { p: Math.round(badRatio * 100) }), { tone: 'err', why: 'error-budget' });
}

// ── moves ──

export interface MoveCheck {
  ok: boolean;
  reason?: Bi;
  overLimit?: boolean;
}

export function canMove(s: State, sc: Scenario, cardId: string, to: Stage): MoveCheck {
  const c = s.cards.find((x) => x.id === cardId);
  if (!c || !visible(s, c)) return { ok: false, reason: bi('Такой карточки нет на доске.', 'There is no such card on the board.') };
  if (c.lane === 'ops') return { ok: false, reason: bi('Карточки дорожки эксплуатации не двигают по колонкам: их берёт тот, кто стоит на дорожке.', 'Operations-lane cards do not move between columns: whoever works the lane takes them.') };
  if (c.stage === 'done') return { ok: false, reason: bi('Карточка уже у покупателей.', 'The card is already with the customers.') };
  const cols = sc.columns;
  const i = cols.indexOf(c.stage);
  if (cols[i + 1] !== to) return { ok: false, reason: bi('Карточку можно вытянуть только в следующую колонку.', 'A card can only be pulled into the next column.') };
  if (c.stage !== 'backlog' && c.sub !== 'done') return { ok: false, reason: bi('Работа на этом этапе ещё не закончена: тянуть дальше можно только из «готово».', 'The work at this stage is not finished: you can only pull from “done”.') };
  if (to === 'done') return { ok: false, reason: bi('В «Готово» карточка попадает сама — после выкладки или когда закончен последний этап.', 'A card gets to Done by itself: after the deployment, or when the last stage is finished.') };
  const lim = limitOf(s, to);
  const over = lim !== null && inColumn(s, to).length >= lim && c.lane !== 'expedite';
  if (over && s.policies.strictWip) return { ok: false, overLimit: true, reason: fmt(bi('Лимит колонки {l} исчерпан (строгий режим).', 'The column limit of {l} is used up (strict mode).'), { l: lim }) };
  return { ok: true, overLimit: over };
}

function placeInto(s: State, c: Card, to: Stage): void {
  c.stage = to;
  c.sub = 'doing';
  if (c.startedDay === undefined && to !== 'backlog') c.startedDay = s.day;
  if (isWorkStage(to) && remaining(c, to) <= 0) c.sub = 'done';
  if (to === 'deploy') c.sub = 'done';
}

function sortForPull(s: State, list: Card[]): Card[] {
  const order = s.policies.pullOrder;
  const left = (c: Card) => Object.keys(c.work).reduce((a, k) => a + remaining(c, k as WorkStage), 0) || 1;
  const pri = (c: Card) => (s.priority.includes(c.id) ? 0 : c.lane === 'expedite' ? 1 : 2);
  return [...list].sort((a, b) => {
    const p = pri(a) - pri(b);
    if (p) return p;
    if (order === 'cod' && b.codDaily !== a.codDaily) return b.codDaily - a.codDaily;
    if (order === 'cd3') {
      const d = b.codDaily / left(b) - a.codDaily / left(a);
      if (Math.abs(d) > 1e-9) return d;
    }
    return a.createdDay - b.createdDay || a.id.localeCompare(b.id, 'en', { numeric: true });
  });
}

/** Candidates to pull into a column: the backlog for the first column, else the "done" part of the previous one. */
export function candidates(s: State, sc: Scenario, to: Stage): Card[] {
  const i = sc.columns.indexOf(to);
  if (i <= 0) return [];
  const prev = sc.columns[i - 1];
  return s.cards.filter((c) => c.stage === prev && c.lane !== 'ops' && visible(s, c) && (prev === 'backlog' || c.sub === 'done'));
}

export interface AutoPullOpts {
  /** Cap per column on top of the WIP limit (how full the learner kept it). */
  cap?: Partial<Record<Stage, number>>;
  /** The baseline team does not take internal improvements. */
  skipImprovements?: boolean;
  /** Pull only into this column, at most n cards. */
  only?: Stage;
  n?: number;
}

/** The autopilot: pull cards right to left, by pullOrder, up to the limits. Returns ids moved. */
export function autopull(s: State, sc: Scenario, o: AutoPullOpts = {}): string[] {
  const moved: string[] = [];
  const cols = workColumns(sc).filter((c) => !o.only || c === o.only);
  for (let i = cols.length - 1; i >= 0; i--) {
    const to = cols[i];
    if (to === 'deploy' && s.policies.deploy.mode === 'on-merge') continue;
    const lim = Math.min(limitOf(s, to) ?? Infinity, o.cap?.[to] ?? Infinity, o.n ?? Infinity);
    let list = sortForPull(s, candidates(s, sc, to));
    if (o.skipImprovements) list = list.filter((c) => c.type !== 'improvement');
    let pulledHere = 0;
    for (const c of list) {
      const count = inColumn(s, to).length;
      const expedite = c.lane === 'expedite';
      if (!expedite && count >= lim) break;
      if (o.n !== undefined && pulledHere >= o.n) break;
      placeInto(s, c, to);
      moved.push(c.id);
      pulledHere++;
    }
  }
  return moved;
}

// ── dilemmas ──

function selectCards(s: State, sel: string): Card[] {
  if (sel.startsWith('tag:')) return s.cards.filter((c) => c.tags?.includes(sel.slice(4)));
  return s.cards.filter((c) => c.id === sel);
}

function applyEffect(s: State, sc: Scenario, e: DilemmaEffect): void {
  const first = workColumns(sc)[0];
  if ('start' in e) for (const sel of e.start) for (const c of selectCards(s, sel)) if (c.stage === 'backlog') placeInto(s, c, first);
  if ('startTop' in e) {
    const list = s.cards.filter((c) => c.stage === 'backlog' && c.tags?.includes(e.startTop.tag)).sort((a, b) => b.codDaily - a.codDaily);
    for (const c of list.slice(0, e.startTop.n)) placeInto(s, c, first);
  }
  if ('addCards' in e) e.addCards.forEach((spec) => s.cards.push(makeCard(spec, spec.id ?? nextId(s, 'X'), s.day, s.seed)));
  if ('hire' in e) s.people.push({ role: e.hire.role, label: e.hire.label, skills: e.hire.skills, die: e.hire.die, station: e.hire.station, home: e.hire.station, from: e.hire.from });
  if ('money' in e) s.money.extra += e.money;
  if ('caps' in e) Object.assign(s.caps, e.caps);
  if ('deployNow' in e) s.deployToday = true;
  if ('freeze' in e) s.freezeUntil = s.day + e.freeze - 1;
  if ('prioritize' in e) {
    s.priority.push(e.prioritize);
    const c = s.cards.find((x) => x.id === e.prioritize);
    if (c && c.stage === 'backlog') placeInto(s, c, first);
  }
}

export function dilemmaOf(sc: Scenario, id: string | undefined): Dilemma | undefined {
  return id ? sc.dilemmas.find((d) => d.id === id) : undefined;
}

// ── actions ──

export interface ActResult {
  ok: boolean;
  reason?: Bi;
  overLimit?: boolean;
  moved?: string[];
}

/** Apply one action of the planning phase. Applied actions are written to the day trace. */
export function act(s: State, sc: Scenario, a: Action): ActResult {
  if (s.finished) return { ok: false, reason: bi('Сценарий закончен.', 'The scenario is over.') };
  let res: ActResult = { ok: true };
  switch (a.k) {
    case 'move': {
      const chk = canMove(s, sc, a.card, a.to);
      if (!chk.ok) return chk;
      const c = s.cards.find((x) => x.id === a.card)!;
      placeInto(s, c, a.to);
      res = { ok: true, overLimit: chk.overLimit, moved: [c.id] };
      break;
    }
    case 'pull': {
      const moved = autopull(s, sc, { only: a.stage, n: 1 });
      if (!moved.length) return { ok: false, reason: bi('Тянуть нечего или лимит колонки исчерпан.', 'Nothing to pull, or the column limit is used up.') };
      res = { ok: true, moved };
      break;
    }
    case 'wip':
      if (a.limit !== null && (a.limit < 1 || a.limit > 30)) return { ok: false, reason: bi('Лимит — число от 1 до 30.', 'A limit is a number from 1 to 30.') };
      s.policies.wip[a.stage] = a.limit;
      break;
    case 'station': {
      const p = s.people.find((x) => x.role === a.role);
      if (!p) return { ok: false, reason: bi('Нет такого человека в команде.', 'There is no such person on the team.') };
      if (a.stage !== 'ops' && !sc.columns.includes(a.stage)) return { ok: false, reason: bi('Нет такой колонки.', 'There is no such column.') };
      if (a.stage === 'ops' && !sc.hasOps) return { ok: false, reason: bi('На этой доске нет дорожки эксплуатации.', 'This board has no operations lane.') };
      p.station = a.stage;
      break;
    }
    case 'deploy':
      if (!sc.columns.includes('deploy')) return { ok: false, reason: bi('На этой доске нет выкладки.', 'This board has no deployment.') };
      if (!inColumn(s, 'deploy').length) return { ok: false, reason: bi('В колонке «Выкладка» пусто.', 'The Deploy column is empty.') };
      s.deployToday = true;
      break;
    case 'decide': {
      const dl = dilemmaOf(sc, a.dilemma);
      const opt = dl?.options.find((o) => o.id === a.option);
      if (!dl || !opt) return { ok: false, reason: bi('Нет такого варианта.', 'There is no such option.') };
      if (a.dilemma in s.decided) return { ok: false, reason: bi('Решение уже принято.', 'The decision is already made.') };
      s.decided[a.dilemma] = a.option;
      if (s.pending === a.dilemma) s.pending = undefined;
      for (const e of opt.effects) applyEffect(s, sc, e);
      log(s, 'decision', opt.label, { why: opt.why });
      break;
    }
    case 'policy':
      if (a.deploy?.mode === 'on-merge' && !s.caps.autoDeploy) return { ok: false, reason: bi('Выкладка сама по себе возможна только после улучшения «Выкладка кнопкой и откат».', 'Deploying by itself needs the improvement “One-click deploy and rollback” first.') };
      if (a.pullOrder) s.policies.pullOrder = a.pullOrder;
      if (a.deploy) s.policies.deploy = { ...a.deploy };
      if (a.strictWip !== undefined) s.policies.strictWip = a.strictWip;
      if (a.auto !== undefined) s.policies.auto = a.auto;
      break;
    case 'prioritize':
      if (!s.priority.includes(a.card)) s.priority.push(a.card);
      break;
  }
  traceOf(s).actions.push(a);
  return res;
}

// ── the day ──

/** End the day: work, deployments, incidents, costs, charts, observations; then the next morning. */
export function endDay(s: State, sc: Scenario, o: { autopull?: AutoPullOpts } = {}): void {
  if (s.finished) return;
  const d = s.day;
  const dl = dilemmaOf(sc, s.pending);
  if (dl) {
    const opt = dl.options.find((x) => x.baseline) ?? dl.options[0];
    act(s, sc, { k: 'decide', dilemma: dl.id, option: opt.id });
  }
  if (s.policies.auto || o.autopull) autopull(s, sc, o.autopull ?? {});
  const tr = traceOf(s);
  // How full the learner kept each column — only where they held work back (something could have been pulled).
  for (const col of workColumns(sc)) {
    tr.count[col] = inColumn(s, col).length;
    if (candidates(s, sc, col).length) tr.load[col] = tr.count[col];
  }

  // Capacity of the day.
  const cap = new Map<string, number>();
  for (const p of s.people) cap.set(p.role, capacity(sc, s.seed, p, d));
  const opsPerson = s.people.find((p) => p.role === 'OPS');
  const opsAway = !!opsPerson && cap.get('OPS') === 0;
  const opsLog = { toil: 0, unplanned: 0, other: 0, capacity: opsPerson ? (cap.get('OPS') ?? 0) : 0 };

  // A manual deployment costs the operations engineer two points, taken first.
  const waiting = inColumn(s, 'deploy');
  const mode = s.policies.deploy.mode === 'on-merge' && !s.caps.autoDeploy ? 'manual' : s.policies.deploy.mode;
  let deployPlanned = false;
  if (waiting.length && d > s.freezeUntil) {
    if (mode === 'manual' && s.deployToday) deployPlanned = true;
    if (mode === 'train' && (s.deployToday || d % (s.policies.deploy as { every: number }).every === 0)) deployPlanned = true;
  }
  let deployBlocked = false;
  if (deployPlanned && !s.caps.autoDeploy) {
    const c = cap.get('OPS') ?? 0;
    if (c < DEPLOY_COST) {
      deployPlanned = false;
      deployBlocked = true;
    } else {
      cap.set('OPS', c - DEPLOY_COST);
      opsLog.other += DEPLOY_COST;
    }
  }

  // Work.
  const idle: Record<string, number> = {};
  const worked = new Set<string>();
  const spread: Record<string, number> = {};
  const byStation = new Map<WorkStage, Person[]>();
  for (const p of s.people) if ((cap.get(p.role) ?? 0) > 0) byStation.set(p.station, [...(byStation.get(p.station) ?? []), p]);
  for (const [station, people] of byStation) {
    if (station === 'ops') {
      for (const p of people) {
        let left = cap.get(p.role)!;
        const factor = p.skills.includes('ops') ? 1 : OFF_SKILL;
        const queue = s.cards
          .filter((c) => c.stage === 'ops' && c.sub === 'doing' && visible(s, c) && (!c.opsOnly || p.role === 'OPS' || s.caps.runbooks))
          .sort((a, b) => (a.type === 'incident' ? 0 : 1) - (b.type === 'incident' ? 0 : 1) || a.createdDay - b.createdDay || a.id.localeCompare(b.id, 'en', { numeric: true }));
        for (const c of queue) {
          if (left <= 1e-9) break;
          const need = remaining(c, 'ops') / factor;
          const use = Math.min(left, need);
          c.done.ops = (c.done.ops ?? 0) + use * factor;
          left -= use;
          worked.add(c.id);
          if (p.role === 'OPS') {
            if (c.type === 'toil') opsLog.toil += use;
            else opsLog.unplanned += use;
          }
        }
        idle[p.role] = round2(left);
      }
      continue;
    }
    const cards = inColumn(s, station)
      .filter((c) => c.sub === 'doing')
      .sort((a, b) => (a.lane === 'expedite' ? 0 : 1) - (b.lane === 'expedite' ? 0 : 1) || (a.startedDay ?? 0) - (b.startedDay ?? 0) || a.id.localeCompare(b.id, 'en', { numeric: true }));
    if (!cards.length) {
      for (const p of people) idle[p.role] = cap.get(p.role)!;
      continue;
    }
    // Who works on what: fewer cards than people → several people on one card; more → each person on several.
    const mine = new Map<string, Card[]>();
    people.forEach((p) => mine.set(p.role, []));
    if (cards.length <= people.length) people.forEach((p, j) => mine.get(p.role)!.push(cards[j % cards.length]));
    else cards.forEach((c, i) => mine.get(people[i % people.length].role)!.push(c));
    for (const p of people) {
      const list = mine.get(p.role)!;
      spread[p.role] = list.length;
      const factor = p.skills.includes(station) ? 1 : OFF_SKILL;
      let pool = cap.get(p.role)! * weinberg(list.length);
      let open = list.filter((c) => remaining(c, station) > 0);
      // Leftover of a finished card goes to the person's other cards the same day.
      while (pool > 1e-9 && open.length) {
        const share = pool / open.length;
        pool = 0;
        for (const c of open) {
          const need = remaining(c, station) / factor;
          const use = Math.min(share, need);
          c.done[station] = (c.done[station] ?? 0) + use * factor;
          pool += share - use;
          worked.add(c.id);
        }
        open = open.filter((c) => remaining(c, station) > 1e-9);
      }
      idle[p.role] = round2(pool);
    }
  }
  for (const id of worked) {
    const c = s.cards.find((x) => x.id === id)!;
    c.workedDays++;
  }

  // Stage completion.
  const lastWork = workColumns(sc).filter((x) => x !== 'deploy').slice(-1)[0];
  const hasDeploy = sc.columns.includes('deploy');
  const delivered: Card[] = [];
  for (const c of s.cards) {
    if (!isWorkStage(c.stage) || c.sub !== 'doing') continue;
    if (remaining(c, c.stage) > 1e-9) continue;
    c.done[c.stage] = c.work[c.stage] ?? 0;
    c.sub = 'done';
    if (c.stage === 'dev' && c.committedDay === undefined) c.committedDay = d;
    if (c.stage === 'ops') {
      c.stage = 'done';
      c.finishedDay = d;
      const inc = c.incident ? s.incidents.find((x) => x.id === c.incident) : undefined;
      if (inc && inc.open) {
        inc.open = false;
        inc.resolvedDay = d;
        log(s, 'incident', bi('Нагрузку разобрали: сайт снова отвечает быстро.', 'The load problem is fixed: the site responds quickly again.'), { tone: 'ok' });
      }
    }
  }
  for (const c of s.cards) {
    if (c.lane === 'ops' || c.stage !== lastWork || c.sub !== 'done') continue;
    if (!hasDeploy) {
      c.stage = 'done';
      c.finishedDay = d;
      delivered.push(c);
    } else if (mode === 'on-merge' && s.caps.autoDeploy) placeInto(s, c, 'deploy');
  }

  // Deployments.
  if (hasDeploy) {
    const batches: Card[][] = [];
    if (mode === 'on-merge' && s.caps.autoDeploy && d > s.freezeUntil) for (const c of inColumn(s, 'deploy')) batches.push([c]);
    else if (deployPlanned) batches.push(inColumn(s, 'deploy'));
    batches.forEach((batch, idx) => deliver(s, sc, batch, idx, opsAway, delivered));
    if (deployBlocked) log(s, 'deploy', bi('Выкладка не состоялась: у эксплуатации нет времени или её нет на месте.', 'No deployment today: operations has no time or is away.'), { tone: 'warn' });
  }
  for (const c of delivered) if (c.effect) applyImprovement(s, c);

  // Load incidents hurt customers while they are open.
  const mult = trafficMult(sc, d);
  for (const inc of s.incidents) {
    if (inc.cause !== 'traffic' || (!inc.open && inc.resolvedDay !== d)) continue;
    const minutes = inc.resolvedDay === d ? EXPOSURE_MIN / 2 : EXPOSURE_MIN;
    inc.downtime += minutes;
    inc.badMinutes += minutes * inc.badRatio * mult;
    const lost = minutes * sc.revenuePerMin * mult * inc.badRatio;
    inc.lost += lost;
    s.money.downtimeLost += lost;
  }

  // Cost of delay and waiting routine.
  let codToday = 0;
  for (const c of s.cards) {
    if (c.stage === 'done' || !visible(s, c)) continue;
    if (c.lane !== 'ops') codToday += c.codDaily;
    else if (c.type === 'toil') codToday += sc.toil?.waitCost ?? 0;
  }
  s.money.codLost += codToday;
  s.money.revenue += sc.revenuePerMin * 1440 * mult;

  // Snapshot for the charts.
  const counts: Record<string, number> = {};
  for (const col of sc.columns) counts[col] = s.cards.filter((c) => c.stage === col && c.lane !== 'ops' && visible(s, c) && !(col === 'done' && c.type === 'incident')).length;
  const wip = s.cards.filter((c) => c.lane !== 'ops' && c.startedDay !== undefined && c.startedDay <= d && (c.finishedDay === undefined || c.finishedDay >= d)).length;
  const prevTotal = s.history[s.history.length - 1]?.doneTotal ?? 0;
  const deliveredCount = delivered.filter((c) => c.lane !== 'ops').length;
  s.history.push({
    day: d,
    counts,
    wip,
    delivered: deliveredCount,
    doneTotal: prevTotal + deliveredCount,
    ops: opsLog,
    codLost: s.money.codLost,
    downtimeLost: s.money.downtimeLost,
    badMinutes: s.incidents.reduce((a, x) => a + x.badMinutes, 0),
    idle,
  });

  observe(s, sc, spread, idle);
  resolvePredictions(s);

  // Next morning.
  s.deployToday = false;
  s.day++;
  if (s.day > sc.days) {
    s.finished = true;
    s.day = sc.days;
    return;
  }
  morning(s, sc);
}

function deliver(s: State, sc: Scenario, batch: Card[], idx: number, opsAway: boolean, delivered: Card[]): void {
  const d = s.day;
  if (!batch.length) return;
  const b = batch.length;
  const p = pFail(batch.map((c) => c.risk), s.caps.testAutomation, b);
  const failed = rand(s.seed, `deploy:${d}:${idx}:${batch.map((c) => c.id).join(',')}`) < p;
  const rec: DeployRecord = { id: `D${d}-${idx + 1}`, day: d, cards: batch.map((c) => c.id), failed, pFail: round2(p), unplanned: false, leads: batch.map((c) => d - (c.committedDay ?? d)) };
  s.deploys.push(rec);
  let culprit: Card | undefined;
  if (failed) {
    const r = rand(s.seed, `impact:${d}:${idx}`);
    const kind: IncidentKind = r < 0.6 ? 'checkout-broken' : r < 0.8 ? 'slow' : 'down';
    const badRatio = kind === 'down' ? 1 : kind === 'slow' ? 0.05 : round2(0.05 + 0.25 * rand(s.seed, `impactBad:${d}:${idx}`));
    const target = sc.slo?.target ?? 0.999;
    const detect = detectMinutes(s.caps.monitoring, kind, badRatio, target);
    const diagnose = diagnoseMinutes(b, opsAway, s.caps.runbooks, s.caps.silence);
    const restore = restoreMinutes(s.caps.rollback);
    const downtime = detect + diagnose + restore;
    const mult = trafficMult(sc, d);
    const lost = downtime * sc.revenuePerMin * mult * badRatio;
    const inc: IncidentRecord = { id: `I${d}-${idx + 1}`, day: d, kind, cause: 'deploy', badRatio, detect, diagnose, restore, downtime, batch: b, lost, badMinutes: downtime * badRatio * mult, open: false, resolvedDay: d };
    s.incidents.push(inc);
    s.money.downtimeLost += lost;
    rec.incident = inc.id;
    culprit = pick(s.seed, `culprit:${d}:${idx}`, batch);
    log(
      s,
      'incident',
      fmt(
        bi(
          'Выкладка из {b} изм. сломала сайт ({k}). Заметили через {det} мин, искали причину {dia} мин, восстановили за {res} мин: всего {all} мин.',
          'A deployment of {b} changes broke the site ({ke}). Noticed after {det} min, diagnosed in {dia} min, restored in {res} min: {all} min in total.',
        ),
        { b, k: kindName(kind).ru, ke: kindName(kind).en, det: detect, dia: diagnose, res: restore, all: downtime },
      ),
      { tone: 'err', why: 'batch' },
    );
    if (s.caps.rollback) {
      // The faulty change is rolled back and goes back to development.
      culprit.stage = 'dev';
      culprit.sub = 'doing';
      culprit.work.dev = (culprit.work.dev ?? 0) + 1;
      culprit.done.dev = culprit.done.dev ?? 0;
      culprit.done.test = 0;
    } else {
      // No rollback: a hotfix goes out the same day as a second, unplanned deployment.
      s.deploys.push({ id: `D${d}-${idx + 1}h`, day: d, cards: [], failed: false, pFail: 0, unplanned: true, incident: inc.id, leads: [] });
    }
    if (sc.hasOps) {
      const cause = makeCard({ title: CAUSE_CARD, type: 'incident', lane: 'ops', work: { ops: 2 } }, `C${d}-${idx + 1}`, d, s.seed);
      cause.incident = inc.id;
      s.cards.push(cause);
    }
  } else {
    log(s, 'deploy', fmt(bi('Выкладка из {b} изм. прошла без сбоя (риск был {p}%).', 'A deployment of {b} changes went fine (the risk was {p}%).'), { b, p: Math.round(p * 100) }), { tone: 'ok' });
  }
  for (const c of batch) {
    if (c === culprit && s.caps.rollback) continue;
    c.stage = 'done';
    c.sub = 'done';
    c.deployedDay = d;
    c.finishedDay = d;
    delivered.push(c);
  }
}

export function kindName(k: IncidentKind): Bi {
  switch (k) {
    case 'checkout-broken':
      return bi('не проходит оформление заказа', 'checkout fails');
    case 'slow':
      return bi('сайт медленный', 'the site is slow');
    case 'down':
      return bi('сайт недоступен', 'the site is down');
    case 'traffic':
      return bi('нагрузка', 'load');
  }
}

function applyImprovement(s: State, c: Card): void {
  const e = c.effect!;
  if (e.testAutomation) s.caps.testAutomation = Math.min(0.9, round2(s.caps.testAutomation + e.testAutomation));
  if (e.toilAutomation) s.caps.toilAutomation = Math.min(0.9, round2(s.caps.toilAutomation + e.toilAutomation));
  if (e.ci) s.caps.ci = true;
  if (e.autoDeploy) s.caps.autoDeploy = true;
  if (e.rollback) s.caps.rollback = true;
  if (e.runbooks) s.caps.runbooks = true;
  if (e.monitoring) s.caps.monitoring = e.monitoring;
  log(s, 'info', fmt(bi('Улучшение «{t}» работает: это навсегда.', 'The improvement “{e}” is live: for good.'), { t: c.title.ru, e: c.title.en }), { tone: 'ok', why: 'automation' });
}

// ── observations (07 §8.9): words of the current lesson, at most two a day ──

function observe(s: State, sc: Scenario, spread: Record<string, number>, idle: Record<string, number>): void {
  const d = s.day;
  const out: { id: string; text: Bi; why?: string }[] = [];
  const can = (id: string) => (s.seen[id] ?? -99) <= d - 5;
  for (const [role, k] of Object.entries(spread)) {
    if (k >= 3 && can('multitask')) {
      out.push({ id: 'multitask', text: fmt(bi('{r} вёл сразу {k} карточки: из каждого часа полезно только {u}%, остальное ушло на переключение.', '{r} worked on {k} cards at once: only {u}% of each hour was useful, the rest went into switching.'), { r: role, k, u: Math.round(weinberg(k) * 100) }), why: 'switching' });
      break;
    }
  }
  if (sc.features.wipLimits && can('wip-over')) {
    for (const col of workColumns(sc)) {
      const lim = limitOf(s, col);
      const n = inColumn(s, col).length;
      if (lim !== null && n > lim) {
        out.push({ id: 'wip-over', text: fmt(bi('В колонке «{c}» {n} карточек при лимите {l}.', 'The “{e}” column holds {n} cards with a limit of {l}.'), { c: colName(sc, col).ru, e: colName(sc, col).en, n, l: lim }), why: 'wip' });
        break;
      }
    }
  }
  for (const [role, left] of Object.entries(idle)) {
    const p = s.people.find((x) => x.role === role);
    if (!p || p.station === 'ops' || left < 1.5 || !can('starvation')) continue;
    const i = sc.columns.indexOf(p.station);
    const prev = sc.columns[i - 1];
    const waitingBefore = prev ? s.cards.filter((c) => c.stage === prev && c.lane !== 'ops' && (prev === 'backlog' || c.sub === 'done')).length : 0;
    if (waitingBefore > 0) {
      out.push({ id: 'starvation', text: fmt(bi('{r} простоял {x} очк.: в его колонке не было начатой работы, а перед ней ждали карточки ({w}).', '{r} had {x} points idle: nothing was started in their column while {w} cards waited in front of it.'), { r: role, x: left, w: waitingBefore }), why: 'pull' });
      break;
    }
  }
  if (sc.features.cfd && s.history.length >= 4 && can('band')) {
    for (const col of workColumns(sc)) {
      const h = s.history.slice(-4).map((x) => x.counts[col] ?? 0);
      if (h[3] > h[2] && h[2] > h[1] && h[1] > h[0] && h[3] >= 3) {
        out.push({ id: 'band', text: fmt(bi('Полоса «{c}» на накопительной диаграмме растёт три дня подряд: работа копится перед следующим этапом или в нём самом.', 'The “{e}” band of the cumulative flow diagram has grown three days in a row: work piles up in or after this stage.'), { c: colName(sc, col).ru, e: colName(sc, col).en }), why: 'bottleneck' });
        break;
      }
    }
  }
  const lastDeploy = s.deploys.filter((x) => x.day === d && x.failed && x.cards.length >= 5)[0];
  if (lastDeploy && can('big-batch')) {
    const inc = s.incidents.find((x) => x.id === lastDeploy.incident);
    out.unshift({ id: 'big-batch', text: fmt(bi('В выкладке было {b} изменений, поиск причины занял {m} мин: неясно, какое из них сломало сайт.', 'The deployment carried {b} changes; finding the cause took {m} min: it was unclear which of them broke the site.'), { b: lastDeploy.cards.length, m: inc?.diagnose ?? 0 }), why: 'batch' });
  }
  if (sc.hasOps && s.history.length >= 3 && can('toil-half')) {
    const last = s.history.slice(-3);
    if (last.every((x) => x.ops.capacity > 0 && x.ops.toil / x.ops.capacity > 0.5)) out.push({ id: 'toil-half', text: bi('Третий день подряд больше половины времени эксплуатации уходит на рутинные заявки.', 'For the third day running, more than half of operations time goes to routine requests.'), why: 'toil' });
  }
  if (sc.features.budget && sc.slo && can('budget')) {
    const allowed = (1 - sc.slo.target) * 30 * 1440;
    const bad = s.history[s.history.length - 1]?.badMinutes ?? 0;
    if (bad > allowed) out.push({ id: 'budget', text: fmt(bi('Бюджет ошибок на 30 дней ({a} мин) уже израсходован: {b} плохих минут.', 'The 30-day error budget ({a} min) is spent: {b} bad minutes.'), { a: round2(allowed), b: Math.round(bad) }), why: 'error-budget' });
  }
  for (const o of out.slice(0, 2)) {
    s.seen[o.id] = d;
    log(s, 'obs', o.text, { why: o.why });
  }
}

export function colName(sc: Scenario, col: Stage): Bi {
  return sc.columnNames?.[col] ?? COLUMN_NAMES[col];
}

export const COLUMN_NAMES: Record<Stage, Bi> = {
  backlog: bi('Бэклог', 'Backlog'),
  analysis: bi('Анализ', 'Analysis'),
  dev: bi('Разработка', 'Dev'),
  test: bi('Проверка', 'Test'),
  deploy: bi('Выкладка', 'Deploy'),
  done: bi('Готово', 'Done'),
  ops: bi('Эксплуатация', 'Operations'),
};

// ── predictions (07 §8.9): asked before a key change, answered five days later ──

/** Average cycle time of cards finished in the window [from, to]. */
export function cycleAvgBetween(s: State, from: number, to: number): number {
  const list = s.cards.filter((c) => c.lane !== 'ops' && c.finishedDay !== undefined && c.startedDay !== undefined && c.finishedDay >= from && c.finishedDay <= to);
  if (!list.length) return 0;
  return list.reduce((a, c) => a + (c.finishedDay! - c.startedDay! + 1), 0) / list.length;
}

export function predict(s: State, id: string, choice: string): void {
  if (s.predictions.some((p) => p.id === id)) return;
  s.predictions.push({ id, day: s.day, choice, before: cycleAvgBetween(s, s.day - 5, s.day - 1) });
}

function resolvePredictions(s: State): void {
  for (const p of s.predictions) {
    if (p.resolved || s.day < p.day + 5) continue;
    const after = cycleAvgBetween(s, p.day + 1, s.day);
    const before = p.before || after;
    const actual = after < before * 0.9 ? 'down' : after > before * 1.1 ? 'up' : 'same';
    p.resolved = actual;
    const said = { down: bi('уменьшится', 'go down'), up: bi('вырастет', 'go up'), same: bi('не изменится', 'stay the same') };
    log(
      s,
      'info',
      fmt(bi('Ваше предсказание: время цикла {c}. Вышло: {a} дн. → {b} дн., то есть {r}.', 'Your prediction: cycle time would {ce}. Result: {a} d → {b} d, so it did {re}.'), {
        c: said[p.choice as keyof typeof said]?.ru ?? p.choice,
        ce: said[p.choice as keyof typeof said]?.en ?? p.choice,
        a: round2(before),
        b: round2(after),
        r: said[actual].ru,
        re: actual === 'same' ? 'not change' : said[actual].en,
      }),
      { tone: p.choice === actual ? 'ok' : 'warn', why: 'little' },
    );
  }
}

/** Run the rest of the scenario on autopilot (used by "skip to the end" and tests). */
export function runToEnd(s: State, sc: Scenario, o: { autopull?: AutoPullOpts } = {}): State {
  while (!s.finished) endDay(s, sc, o);
  return s;
}
