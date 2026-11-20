// `flow` — the board in a terminal. The placement checks and the exam run
// short flowlab scenarios in the lab terminal; the goal is checked by a
// predicate over facts.flow (07 §8.10), never by what was typed.

import { bi } from '../../core/i18n';
import type { CmdContext, FactsProvider, SetupHook, ShellCommand, SimMachineApi, Snapshotable } from '../../core/types';
import { bots, passLine } from './bots';
import { finished, metrics } from './metrics';
import { scenario } from './scenarios';
import { act, capacity, colName, createState, endDay, inColumn, limitOf, workColumns } from './sim';
import type { Action, FlowMetrics, Scenario, Stage, State, WorkStage } from './types';

/** The flowlab run attached to a simulated machine. Survives snapshots and reset. */
export class FlowSession implements Snapshotable {
  sc: Scenario | null = null;
  s: State | null = null;
  /** Actions per day, to rebuild the state on restore. */
  private actions: Action[][] = [];

  start(id: string, seed?: number): void {
    this.sc = scenario(id);
    this.s = createState(this.sc, seed ?? this.sc.defaultSeed);
    this.actions = [[]];
  }

  act(a: Action) {
    const r = act(this.s!, this.sc!, a);
    if (r.ok) this.actions[this.actions.length - 1].push(a);
    return r;
  }

  next(): void {
    endDay(this.s!, this.sc!);
    this.actions.push([]);
  }

  snapshot(): unknown {
    return this.sc && this.s ? { id: this.sc.id, seed: this.s.seed, actions: this.actions } : null;
  }

  restore(snap: unknown): void {
    const v = snap as { id: string; seed: number; actions: Action[][] } | null;
    if (!v) {
      this.sc = this.s = null;
      return;
    }
    this.start(v.id, v.seed);
    v.actions.forEach((day, i) => {
      for (const a of day) this.act(a);
      if (i < v.actions.length - 1) this.next();
    });
  }
}

export const session = (m: SimMachineApi) => m.ext('flowlab', () => new FlowSession());

const STAGES: Record<string, Stage> = { backlog: 'backlog', ready: 'backlog', analysis: 'analysis', dev: 'dev', test: 'test', deploy: 'deploy', done: 'done', ops: 'ops' };

const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length));

function board(sc: Scenario, s: State, all = false): string {
  const lines: string[] = [];
  lines.push(`${sc.title.en} · seed ${s.seed} · day ${s.history.length + (s.finished ? 0 : 1)} of ${sc.days}${s.finished ? ' · finished' : ''}`);
  for (const col of sc.columns) {
    const cards = s.cards.filter((c) => c.stage === col && c.lane !== 'ops' && (c.visibleFrom ?? 0) <= s.day);
    const lim = limitOf(s, col);
    const head = `${pad(colName(sc, col).en, 10)} ${String(cards.length).padStart(2)}${lim !== null ? `/${lim}` : '  '}`;
    const people = s.people.filter((p) => p.station === col).map((p) => p.role);
    const shown = col === 'done' ? `${cards.length} delivered` : cards.slice(0, all ? undefined : 8).map((c) => `${c.id}${c.sub === 'done' && col !== 'backlog' ? '✓' : ''}`).join(' ') + (!all && cards.length > 8 ? ` +${cards.length - 8}` : '');
    lines.push(`  ${head}  ${people.length ? `[${people.join(',')}] ` : ''}${shown}`);
    if (col !== 'backlog' && col !== 'done') {
      const stage = col as WorkStage;
      const cap = s.people.filter(p => p.station === col).reduce((sum, p) => sum + capacity(sc, s.seed, p, s.day) * (p.skills.includes(stage) ? 1 : 0.5), 0);
      const remaining = cards.reduce((sum, c) => sum + Math.max(0, (c.work[stage] ?? 0) - (c.done[stage] ?? 0)), 0);
      lines.push(`    capacity today: ${cap}; work remaining: ${remaining}`);
    }
  }
  if (sc.hasOps) {
    const ops = s.cards.filter((c) => c.stage === 'ops' && (c.visibleFrom ?? 0) <= s.day);
    lines.push(`  ${pad('Ops lane', 10)} ${String(ops.length).padStart(2)}    ${ops.slice(0, 6).map((c) => c.id).join(' ')}`);
  }
  if (s.pending) {
    const d = sc.dilemmas.find((x) => x.id === s.pending)!;
    lines.push('', `Decision needed (${d.id}): ${d.text.en}`, ...d.options.map((o) => `  flow decide ${d.id} ${o.id}   — ${o.label.en}`));
  }
  return lines.join('\n') + '\n';
}

function metricsText(m: FlowMetrics, sc: Scenario): string {
  const rows: [string, string | number][] = [
    ['done (delivered)', m.doneCount],
    ['money net (RUB)', m.moneyNet],
    ['wip average', m.wipAvg],
    ['throughput / day', m.thAvg],
    ['cycle time p50 (d)', m.cycleP50],
    ['cycle time p85 (d)', m.cycleP85],
  ];
  if (sc.columns.includes('deploy')) rows.push(['deployments', m.deploys], ['change failure rate', m.cfr], ['lead time for changes (d)', m.changeLeadMedianDays], ['recovery median (min)', m.recoveryMedianMin]);
  return rows.map(([k, v]) => `  ${pad(k, 28)} ${v}`).join('\n') + '\n';
}

const HELP = `Usage: flow <command> [args]
Drive a flowlab board from the terminal: one call = one decision, "flow next" ends the day.

Commands:
  flow status                  show the board: columns, cards, limits, people
  flow wip <column> <n|none>   set or remove the WIP limit of a column
  flow move <card> <column>    pull a card into the next column
  flow pull <column>           pull the next card into a column by the pull order
  flow station <role> <column> move a person to work in another column
  flow auto on|off             autopilot: every morning pull cards up to the limits
  flow policy pull fifo|cod|cd3
  flow policy deploy train:<days>|manual|on-merge
  flow deploy                  deploy everything waiting in the Deploy column today
  flow decide <id> <option>    answer a decision note
  flow next [days]             end the day (or several days)
  flow metrics                 flow and delivery metrics so far
  flow goal                    the goal of this run and how far you are
  flow reset [seed]            start the run again

Columns: backlog analysis dev test deploy done ops
`;

const MAN = {
  section: 1,
  sections: [
    { id: 'NAME', body: 'flow - drive a flowlab board (work in progress, pull, deployments) from the shell' },
    { id: 'SYNOPSIS', body: 'flow status\nflow wip COLUMN N|none\nflow move CARD COLUMN\nflow station ROLE COLUMN\nflow auto on|off\nflow policy pull fifo|cod|cd3\nflow policy deploy train:DAYS|manual|on-merge\nflow next [DAYS]' },
    {
      id: 'DESCRIPTION',
      body: 'flow runs one scenario of the flowlab simulator on this machine. Every command is one decision of the planning phase; flow next ends the day, and the team spends its capacity on the cards in progress.\nA person working on k cards at once keeps only part of their time (1.0, 0.8, 0.6, 0.4, 0.25 for k = 1..5+), split between the cards.\nCards move only forward, one column at a time, and only from the done part of the previous column (pull).',
    },
    {
      id: 'OPTIONS',
      body: 'wip COLUMN N\n    Set the WIP limit of COLUMN to N cards (doing and done parts together). none removes the limit.\nauto on\n    Every morning pull cards right to left, by the pull order, up to the WIP limits. Without limits the autopilot starts everything it can.\npolicy pull fifo|cod|cd3\n    Order of pulling: oldest first, highest cost of delay first, or highest cost of delay divided by remaining work (CD3).\npolicy deploy train:DAYS\n    Deploy everything waiting every DAYS days (a release train).\npolicy deploy manual\n    Deploy when you run flow deploy (continuous delivery with a button, once deployments are one click).\npolicy deploy on-merge\n    Every change that passed the test stage is deployed the same day, by itself (continuous deployment). Needs one-click deploy.\nstation ROLE COLUMN\n    Move a person to another column for the following days. Outside their own stage a person works at half speed.\nnext [DAYS]\n    End the day; with DAYS, end that many days in a row.',
    },
    { id: 'EXIT STATUS', body: '0 on success, 1 when the decision was refused (the reason is printed), 2 on a usage error.' },
    { id: 'EXAMPLES', body: 'flow wip analysis 2\nflow auto on\nflow next 5\nflow metrics' },
    { id: 'SEE ALSO', body: 'The Kanban Guide, "Flow Metrics"; Little, J.D.C. (1961), "A Proof for the Queuing Formula: L = λW".' },
  ],
};

function parseStage(s: string | undefined): Stage | null {
  return s ? (STAGES[s.toLowerCase()] ?? null) : null;
}

function run(ctx: CmdContext): number {
  const f = session(ctx.machine);
  const [, sub, ...args] = ctx.argv;
  if (!sub || sub === 'help' || sub === '-h') {
    ctx.out(HELP);
    return sub ? 0 : 2;
  }
  if (!f.s || !f.sc) {
    if (sub === 'reset' && args[0]) {
      f.start(args[0], args[1] ? Number(args[1]) : undefined);
      ctx.out(board(f.sc!, f.s!));
      return 0;
    }
    ctx.err('flow: no scenario on this machine\n');
    return 1;
  }
  const sc = f.sc;
  const s = f.s;
  const refused = (r: { ok: boolean; reason?: { en: string } }) => {
    if (r.ok) return false;
    ctx.err(`flow: ${r.reason?.en ?? 'refused'}\n`);
    return true;
  };
  switch (sub) {
    case 'backlog':
      ctx.out(s.cards.filter(c => c.stage === 'backlog' && (c.visibleFrom ?? 0) <= s.day).map(c => `${c.id}  ${c.title.en}`).join('\n') + '\n');
      return 0;
    case 'status':
    case 'board':
      ctx.out(board(sc, s, args.includes('--all')));
      return 0;
    case 'wip': {
      const st = parseStage(args[0]);
      if (!st || !workColumns(sc).includes(st) || !args[1]) {
        ctx.err('flow wip: usage: flow wip <column> <n|none>\n');
        return 2;
      }
      const limit = args[1] === 'none' ? null : Number(args[1]);
      if (limit !== null && !Number.isInteger(limit)) {
        ctx.err(`flow wip: not a number: ${args[1]}\n`);
        return 2;
      }
      if (refused(f.act({ k: 'wip', stage: st, limit }))) return 1;
      ctx.out(`limit of ${st}: ${limit ?? 'none'}\n`);
      return 0;
    }
    case 'move': {
      const st = parseStage(args[1]);
      if (!args[0] || !st) {
        ctx.err('flow move: usage: flow move <card> <column>\n');
        return 2;
      }
      const r = f.act({ k: 'move', card: args[0], to: st });
      if (refused(r)) return 1;
      ctx.out(`${args[0]} → ${st}${r.overLimit ? ' (over the limit)' : ''}\n`);
      return 0;
    }
    case 'pull': {
      const st = parseStage(args[0]);
      if (!st) {
        ctx.err('flow pull: usage: flow pull <column>\n');
        return 2;
      }
      const r = f.act({ k: 'pull', stage: st });
      if (refused(r)) return 1;
      ctx.out(`${r.moved?.join(' ')} → ${st}\n`);
      return 0;
    }
    case 'station': {
      const st = parseStage(args[1]);
      if (!args[0] || !st || st === 'backlog' || st === 'done' || st === 'deploy') {
        ctx.err('flow station: usage: flow station <role> <analysis|dev|test|ops>\n');
        return 2;
      }
      if (refused(f.act({ k: 'station', role: args[0].toUpperCase(), stage: st as WorkStage }))) return 1;
      ctx.out(`${args[0].toUpperCase()} now works in ${st}\n`);
      return 0;
    }
    case 'auto':
      if (args[0] !== 'on' && args[0] !== 'off') {
        ctx.err('flow auto: usage: flow auto on|off\n');
        return 2;
      }
      f.act({ k: 'policy', auto: args[0] === 'on' });
      ctx.out(`autopilot ${args[0]}\n`);
      return 0;
    case 'policy': {
      if (args[0] === 'pull' && ['fifo', 'cod', 'cd3'].includes(args[1] ?? '')) {
        f.act({ k: 'policy', pullOrder: args[1] as 'fifo' | 'cod' | 'cd3' });
        ctx.out(`pull order: ${args[1]}\n`);
        return 0;
      }
      if (args[0] === 'deploy' && args[1]) {
        const m = /^train:(\d+)$/.exec(args[1]);
        const deploy = m ? { mode: 'train' as const, every: Number(m[1]) } : args[1] === 'manual' ? { mode: 'manual' as const } : args[1] === 'on-merge' ? { mode: 'on-merge' as const } : null;
        if (!deploy) {
          ctx.err(`flow policy deploy: unknown mode: ${args[1]}\n`);
          return 2;
        }
        if (refused(f.act({ k: 'policy', deploy }))) return 1;
        ctx.out(`deployments: ${args[1]}\n`);
        return 0;
      }
      ctx.err('flow policy: usage: flow policy pull fifo|cod|cd3 | flow policy deploy train:<days>|manual|on-merge\n');
      return 2;
    }
    case 'deploy':
      if (refused(f.act({ k: 'deploy' }))) return 1;
      ctx.out(`deployment of ${inColumn(s, 'deploy').length} change(s) planned for today\n`);
      return 0;
    case 'decide':
      if (refused(f.act({ k: 'decide', dilemma: args[0] ?? '', option: args[1] ?? '' }))) return 1;
      ctx.out(`decided: ${args[0]} → ${args[1]}\n`);
      return 0;
    case 'next': {
      const n = Math.max(1, Math.min(sc.days, Number(args[0] ?? 1) || 1));
      for (let i = 0; i < n && !s.finished; i++) {
        if (s.pending && i > 0) break;
        f.next();
      }
      const h = s.history[s.history.length - 1];
      ctx.out(`day ${h.day} ended: ${h.delivered} delivered today, ${h.doneTotal} in total, ${h.wip} in progress\n`);
      if (s.finished) ctx.out('the run is finished: flow metrics, flow goal\n');
      else if (s.pending) ctx.out(`a decision note is waiting: flow status\n`);
      return 0;
    }
    case 'metrics':
      ctx.out(metricsText(metrics(s, sc), sc));
      return 0;
    case 'goal': {
      const m = metrics(s, sc);
      const line = passLine(sc, s.seed);
      ctx.out(`${sc.goal.en}\n  done so far: ${m.doneCount}; pass line: ${Math.ceil(line.doneCount)} done, cycle time p85 ≤ ${line.cycleP85} d; money net: ${m.moneyNet} RUB\n`);
      return 0;
    }
    case 'reset':
      f.start(sc.id, args[0] ? Number(args[0]) : s.seed);
      ctx.out(board(f.sc!, f.s!));
      return 0;
  }
  ctx.err(`flow: unknown command: ${sub}\n`);
  return 2;
}

export const flowCommand: ShellCommand = {
  name: 'flow',
  summary: bi('Доска flowlab в терминале: лимиты, вытягивание, дни', 'The flowlab board in the terminal: limits, pull, days'),
  help: HELP,
  man: MAN,
  run,
  complete: (args) => (args.length <= 1 ? ['status', 'wip', 'move', 'pull', 'station', 'auto', 'policy', 'deploy', 'decide', 'next', 'metrics', 'goal', 'reset'] : ['backlog', 'analysis', 'dev', 'test', 'deploy', 'ops', 'on', 'off']),
};

/** facts.flow (07 §8.10): everything a check needs, derived values computed in advance. */
export const flowFacts: FactsProvider = {
  scope: 'flow',
  collect(m) {
    const f = session(m);
    if (!f.s || !f.sc) return { scenario: null };
    const s = f.s;
    const sc = f.sc;
    const me = metrics(s, sc);
    const b = bots(sc, s.seed);
    const line = passLine(sc, s.seed);
    const byType: Record<string, number> = {};
    for (const c of finished(s)) byType[c.type] = (byType[c.type] ?? 0) + 1;
    const wip: Record<string, number | null> = {};
    for (const col of workColumns(sc)) wip[col] = limitOf(s, col);
    const ok = (x: boolean) => (x ? 1 : 0);
    return {
      scenario: sc.id,
      seed: s.seed,
      day: s.day,
      daysDone: s.history.length,
      finished: ok(s.finished),
      done: { count: me.doneCount, byType },
      metrics: me,
      policies: { wip, pullOrder: s.policies.pullOrder, deploy: s.policies.deploy.mode },
      bots: { baseline: b.baseline, reference: b.reference },
      passLine: line,
      pass: {
        done: ok(me.doneCount >= line.doneCount),
        cycle: ok(me.cycleP85 <= line.cycleP85),
        money: ok(me.moneyNet >= line.moneyNet),
        budget: ok(me.budgetLeftRatio >= line.budgetLeftRatio),
        cfr: ok(me.cfr <= line.cfr),
      },
      decided: { ...s.decided },
    };
  },
};

/** TerminalSetup.ext.flow = { scenario: 'p5', seed?: number }. */
export const flowSetup: SetupHook = {
  key: 'flow',
  apply(m, value) {
    const v = value as { scenario: string; seed?: number };
    session(m).start(v.scenario, v.seed);
  },
};
