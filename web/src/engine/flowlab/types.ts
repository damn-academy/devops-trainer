// flowlab model types (07 §8.2, adapted to the MVP board: Backlog → Analysis
// → Dev → Test → Deploy → Done, plus an operations lane). The state is a plain
// serialisable object; the day function in sim.ts is deterministic for a seed.

import type { Bi } from '../../core/i18n';

/** Columns of the board. `ops` is the operations lane (incidents and routine requests). */
export type Stage = 'backlog' | 'analysis' | 'dev' | 'test' | 'deploy' | 'done' | 'ops';
/** Stages where work points are spent. */
export type WorkStage = 'analysis' | 'dev' | 'test' | 'ops';
export const WORK_STAGES: readonly WorkStage[] = ['analysis', 'dev', 'test', 'ops'];

/** Work item types: features and defects for customers, unplanned incident work, routine requests, improvements (automation, tech debt). */
export type WorkType = 'feature' | 'bug' | 'incident' | 'toil' | 'improvement';
export type Lane = 'standard' | 'expedite' | 'ops';
export type PullOrder = 'fifo' | 'cod' | 'cd3';
export type Monitoring = 'none' | 'host-check' | 'slo-alerts';

/** What an improvement changes for good once it is delivered. */
export interface Effect {
  testAutomation?: number;
  ci?: boolean;
  autoDeploy?: boolean;
  rollback?: boolean;
  monitoring?: Monitoring;
  runbooks?: boolean;
  toilAutomation?: number;
}

export interface Card {
  id: string;
  title: Bi;
  type: WorkType;
  lane: Lane;
  /** Points of work per stage. A stage with 0 (or absent) is passed at once. */
  work: Partial<Record<WorkStage, number>>;
  done: Partial<Record<WorkStage, number>>;
  stage: Stage;
  /** In a work column: still being worked on, or finished and waiting to be pulled. */
  sub: 'doing' | 'done';
  /** Day it appeared on the board (start of lead time). */
  createdDay: number;
  /** Day it was first pulled out of the backlog (start of cycle time). */
  startedDay?: number;
  /** Day development finished: the change is in the shared code (start of DORA lead time for changes). */
  committedDay?: number;
  deployedDay?: number;
  finishedDay?: number;
  /** Cost of delay, roubles per day while the card is not delivered. */
  codDaily: number;
  /** Contribution to deployment risk, 0.03..0.08. */
  risk: number;
  effect?: Effect;
  /** Only the operations engineer can do it, unless there is a runbook. */
  opsOnly?: boolean;
  /** Days on which someone actually worked on the card (flow efficiency). */
  workedDays: number;
  incident?: string;
  tags?: string[];
  /** Due day for fixed-date work (a promo). */
  dueDay?: number;
  /** The card appears on the board only from this day (an outage nobody has noticed yet). */
  visibleFrom?: number;
}

export interface Person {
  role: string;
  label: Bi;
  /** Stages this person is trained for; elsewhere they work at half speed (swarming). */
  skills: WorkStage[];
  /** Capacity distribution for a day: one face is drawn per day. */
  die: number[];
  /** The column the person works in today. */
  station: WorkStage;
  /** The column they return to by default. */
  home: WorkStage;
  /** Inclusive day ranges when the person is away. */
  away?: [number, number][];
  /** First day the person is on the team (a hire). */
  from?: number;
}

export type DeployPolicy = { mode: 'train'; every: number } | { mode: 'manual' } | { mode: 'on-merge' };

export interface Policies {
  /** WIP limit per column; null or absent = no limit. Counts the doing and done parts of the column. */
  wip: Partial<Record<Stage, number | null>>;
  /** Strict mode: a move into a full column is refused instead of highlighted. */
  strictWip: boolean;
  pullOrder: PullOrder;
  deploy: DeployPolicy;
  /** Autopilot: each morning pull cards by pullOrder up to the limits. */
  auto: boolean;
}

export interface Caps {
  /** Share of checks done by machines, 0..1. */
  testAutomation: number;
  ci: boolean;
  autoDeploy: boolean;
  rollback: boolean;
  monitoring: Monitoring;
  runbooks: boolean;
  /** Share of routine requests handled by a script, 0..1. */
  toilAutomation: number;
  /** After blame: people stay silent, diagnosis takes twice as long. */
  silence?: boolean;
}

export interface DeployRecord {
  id: string;
  day: number;
  cards: string[];
  failed: boolean;
  pFail: number;
  /** A hotfix deployment caused by an incident (deployment rework). */
  unplanned: boolean;
  incident?: string;
  /** Lead time for changes of each card: deployedDay − committedDay (days). */
  leads: number[];
}

export type IncidentKind = 'checkout-broken' | 'slow' | 'down' | 'traffic';

export interface IncidentRecord {
  id: string;
  day: number;
  kind: IncidentKind;
  cause: 'deploy' | 'traffic';
  badRatio: number;
  detect: number;
  diagnose: number;
  restore: number;
  /** Minutes the customers were affected, so far. */
  downtime: number;
  batch: number;
  /** Lost revenue, roubles. */
  lost: number;
  /** Error-budget minutes spent (downtime weighted by the share of failing requests and the traffic). */
  badMinutes: number;
  /** For traffic incidents: open until the ops card is done. */
  open: boolean;
  resolvedDay?: number;
  card?: string;
}

/** Per-day snapshot for the charts (end of the day). */
export interface DaySnap {
  day: number;
  /** Cards in each column at the end of the day (standard and expedite lanes). */
  counts: Record<string, number>;
  /** Cards started but not finished at some point of the day. */
  wip: number;
  /** Cards delivered this day. */
  delivered: number;
  /** Cumulative delivered. */
  doneTotal: number;
  /** Points the operations person spent on routine, incidents and other work. */
  ops: { toil: number; unplanned: number; other: number; capacity: number };
  codLost: number;
  downtimeLost: number;
  badMinutes: number;
  /** Idle capacity points per role. */
  idle: Record<string, number>;
}

export interface LogEntry {
  day: number;
  kind: 'event' | 'obs' | 'deploy' | 'incident' | 'decision' | 'info';
  text: Bi;
  /** Theory card id ("why?"). */
  why?: string;
  /** State icon: ok / warn / err. */
  tone?: 'ok' | 'warn' | 'err';
}

/** Effects of a dilemma option, applied when the learner chooses it. */
export type DilemmaEffect =
  | { start: string[] } // move these cards (by tag "tag:x" or id) out of the backlog into the first column
  | { startTop: { tag: string; n: number } }
  | { addCards: CardSpec[] }
  | { hire: { role: string; label: Bi; die: number[]; skills: WorkStage[]; station: WorkStage; from: number } }
  | { money: number }
  | { caps: Partial<Caps> }
  | { deployNow: true }
  | { freeze: number } // no deploys for n days
  | { prioritize: string };

export interface DilemmaOption {
  id: string;
  label: Bi;
  /** What the reference bot chooses. */
  reference?: boolean;
  /** What the baseline bot chooses (default: the first option). */
  baseline?: boolean;
  /** Shown in the evening log and in the debrief. */
  explain: Bi;
  effects: DilemmaEffect[];
  why?: string;
}

export interface Dilemma {
  id: string;
  day: number;
  text: Bi;
  options: DilemmaOption[];
}

export interface CardSpec {
  id?: string;
  title: Bi;
  type: WorkType;
  lane?: Lane;
  work: Partial<Record<WorkStage, number>>;
  codDaily?: number;
  risk?: number;
  effect?: Effect;
  opsOnly?: boolean;
  tags?: string[];
  dueDay?: number;
}

/** Which instruments and controls a scenario shows: terms appear only after their lesson. */
export interface Features {
  wipLimits: boolean;
  cfd: boolean;
  cycle: boolean;
  throughput: boolean;
  dora: boolean;
  budget: boolean;
  stations: boolean;
  pullOrder: boolean;
  deployPolicy: boolean;
}

export interface Scenario {
  id: string;
  title: Bi;
  brief: Bi;
  goal: Bi;
  days: number;
  defaultSeed: number;
  /** Columns on the board, in order, from backlog to done. */
  columns: Stage[];
  /** Custom names for columns (S0 calls dev "In progress"). */
  columnNames?: Partial<Record<Stage, Bi>>;
  hasOps: boolean;
  people: Person[];
  backlog: CardSpec[];
  /** Cards arriving each morning from day 2 on. */
  arrivals?: { perDay: number; fromDay?: number; untilDay?: number; pool: 'features' | 'mixed'; work: Partial<Record<WorkStage, [number, number]>>; cod?: [number, number] };
  policies: Policies;
  caps: Caps;
  dilemmas: Dilemma[];
  /** Daily routine requests to the operations lane: count = base + day / grow, reduced by toilAutomation. */
  toil?: { base: number; growEvery: number; waitCost: number };
  /** Random traffic incidents: probability base + k × traffic(day). */
  trafficIncidents?: { base: number; k: number };
  /** Sale days: traffic and revenue × mult. */
  sale?: { from: number; to: number; mult: number };
  slo?: { target: number };
  /** Revenue per minute while the shop works, roubles. */
  revenuePerMin: number;
  features: Features;
  /** Theory cards ("why?") available in this scenario. */
  theory: string[];
  /** Reference WIP limits where "people on the stage + 1" is not the best rule (one person, equal cards). */
  refWip?: Partial<Record<Stage, number>>;
  /** Improvements the reference bot takes at once. */
  refImprovements?: string[];
  /** Fixed capacity (no dice) for teaching scenarios. */
  deterministic?: boolean;
  /** The debrief question "explain it yourself" and the key ideas looked for in the answer. */
  explain: { prompt: Bi; keys: { label: Bi; ru: string[]; en: string[] }[]; model: Bi };
}

export type Action =
  | { k: 'move'; card: string; to: Stage }
  | { k: 'pull'; stage: Stage }
  | { k: 'wip'; stage: Stage; limit: number | null }
  | { k: 'station'; role: string; stage: WorkStage }
  | { k: 'deploy' }
  | { k: 'decide'; dilemma: string; option: string }
  | { k: 'policy'; pullOrder?: PullOrder; deploy?: DeployPolicy; strictWip?: boolean; auto?: boolean }
  /** Replay-only: prefer this card when the autopilot pulls (an improvement the learner started). */
  | { k: 'prioritize'; card: string };

/** What the learner did on one day, and how full they kept each column (for policy replays). */
export interface DayTrace {
  day: number;
  actions: Action[];
  /** Cap per column: cards after planning, recorded only where work was held back (something could still be pulled). */
  load: Partial<Record<Stage, number>>;
  /** Cards in each column after planning, before the work of the day. */
  count: Partial<Record<Stage, number>>;
}

export interface State {
  scenario: string;
  seed: number;
  /** The day being planned (1-based). */
  day: number;
  finished: boolean;
  cards: Card[];
  people: Person[];
  policies: Policies;
  caps: Caps;
  money: { codLost: number; downtimeLost: number; revenue: number; extra: number };
  deploys: DeployRecord[];
  incidents: IncidentRecord[];
  history: DaySnap[];
  log: LogEntry[];
  /** Dilemma waiting for an answer today. */
  pending?: string;
  decided: Record<string, string>;
  /** Manual deploy requested for today. */
  deployToday: boolean;
  /** No deploys until this day (inclusive). */
  freezeUntil: number;
  /** Cards the autopilot pulls first. */
  priority: string[];
  trace: DayTrace[];
  /** Observation ids with the last day they were shown. */
  seen: Record<string, number>;
  /** Learner predictions: asked on day, answer, resolved later. */
  predictions: { id: string; day: number; choice: string; before: number; resolved?: string }[];
  /** Counter for ids of cards created during the run. */
  seq: Record<string, number>;
}

/** Numbers the debrief, the checks and the bots compare (07 §8.10). */
export interface FlowMetrics {
  days: number;
  doneCount: number;
  doneFeatures: number;
  wipAvg: number;
  thAvg: number;
  th1to5: number;
  th6to10: number;
  cycleAvg: number;
  cycleP50: number;
  cycleP85: number;
  leadP85: number;
  flowEfficiency: number;
  deploys: number;
  deployFreq7: number;
  changeLeadMedianDays: number;
  cfr: number;
  recoveryMedianMin: number;
  reworkRate: number;
  budgetMin: number;
  budgetLeftMin: number;
  budgetLeftRatio: number;
  saleBadMinutes: number;
  extraSpending: number;
  codLost: number;
  downtimeLost: number;
  moneyNet: number;
  opsToilShare10: number;
  promoByDue: number;
  incidents: number;
}
