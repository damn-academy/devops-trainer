// logcli against the training Loki (the Shop logs of the lab's dataset): query
// (log and metric queries), instant-query, labels, series. Output follows
// logcli: the request line and common labels on stderr, entries on stdout.

import type { CmdContext, ShellCommand } from '../../../core/types';
import { bi } from '../../../core/i18n';
import { parseDuration } from '../prom/promql';
import { datasetOf } from '../prom/commands';
import { iso, logDataset } from './data';
import { flatEntries, formatLogLabels, isMetric, labelValues, LogQLError, parseLogQL, runLogQL, type LogResult } from './logql';

export const LOGCLI_HELP = `usage: logcli [<flags>] <command> [<args> ...]

A command-line for loki.

Flags:
      --help             Show context-sensitive help.
      --addr="http://localhost:3100"
                         Server address. Can also be set using LOKI_ADDR env var.
  -q, --quiet            Suppress query metadata.
  -o, --output=default   Specify output mode [default, raw, jsonl]. raw suppresses
                         log labels and timestamp.

Commands:
  query [<flags>] <query>
    Run a LogQL query.

      --limit=30         Limit on number of entries to print. Setting it to 0 will
                         fetch all entries.
      --since=1h         Lookback window.
      --forward          Scan forwards through logs.

  instant-query [<flags>] <query>
    Run an instant LogQL query (a metric query evaluated at one moment).

  labels [<flags>] [<label>]
    Find values for a given label.

  series [<flags>] <matcher>
    Run series query.
`;

function opts(args: string[]) {
  const o = { limit: 30, since: 3_600_000, output: 'default', quiet: false, forward: false, rest: [] as string[] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const val = () => (a.includes('=') ? a.slice(a.indexOf('=') + 1) : args[++i] ?? '');
    if (a === '-q' || a === '--quiet') o.quiet = true;
    else if (a === '--forward') o.forward = true;
    else if (a.startsWith('--limit')) o.limit = Number(val());
    else if (a.startsWith('--since')) o.since = parseDuration(val());
    else if (a === '-o' || a.startsWith('--output') || a.startsWith('-o=')) o.output = val();
    else if (a.startsWith('--addr')) val();
    else o.rest.push(a);
  }
  return o;
}

function printVector(ctx: CmdContext, r: LogResult, end: number): void {
  if (r.type === 'scalar') {
    ctx.out(JSON.stringify([end / 1000, String(r.value)]) + '\n');
    return;
  }
  if (r.type !== 'vector') return;
  ctx.out(JSON.stringify(r.data.map((s) => ({ metric: s.labels, value: [end / 1000, String(Number.isInteger(s.value) ? s.value : +s.value.toFixed(6))] })), null, 2) + '\n');
}

function run(ctx: CmdContext): number {
  const [cmd, ...args] = ctx.argv.slice(1);
  if (!cmd || cmd === '--help' || cmd === '-h' || args.includes('--help')) {
    ctx.out(LOGCLI_HELP);
    return cmd ? 0 : 1;
  }
  const o = opts(args);
  const db = logDataset(datasetOf(ctx));
  const addr = ctx.env.LOKI_ADDR ?? 'http://localhost:3100';
  try {
    if (cmd === 'labels') {
      const name = o.rest[0];
      if (!o.quiet) ctx.err(`${addr}/loki/api/v1/${name ? `label/${name}/values` : 'labels'}?end=${db.end}000000&start=${db.end - o.since}000000\n`);
      for (const v of labelValues(db, name)) ctx.out(v + '\n');
      return 0;
    }
    if (cmd === 'series') {
      const sel = o.rest[0];
      if (!sel) {
        ctx.err('logcli: error: required argument \'matcher\' not provided\n');
        return 1;
      }
      const e = parseLogQL(sel);
      if (isMetric(e) || e.stages.length) throw new LogQLError('parse error : series queries take a plain stream selector, like {app="api"}');
      const r = runLogQL(db, sel, { since: o.since, limit: 1e9 });
      const seen = new Set<string>();
      for (const s of r.type === 'streams' ? r.data : []) {
        const k = formatLogLabels(s.labels);
        if (!seen.has(k)) ctx.out(k + '\n');
        seen.add(k);
      }
      return 0;
    }
    if (cmd === 'query' || cmd === 'instant-query') {
      const q = o.rest[0];
      if (q === undefined) {
        ctx.err('logcli: error: required argument \'query\' not provided, try --help\n');
        return 1;
      }
      const e = parseLogQL(q);
      if (!o.quiet) ctx.err(`${addr}/loki/api/v1/${cmd === 'instant-query' ? 'query' : 'query_range'}?direction=${o.forward ? 'FORWARD' : 'BACKWARD'}&end=${db.end}000000&limit=${o.limit}&query=${encodeURIComponent(q)}&start=${db.end - o.since}000000\n`);
      if (isMetric(e)) {
        printVector(ctx, runLogQL(db, q), db.end);
        return 0;
      }
      if (cmd === 'instant-query') throw new LogQLError('parse error : instant queries need a metric query, for example count_over_time({app="api"}[5m])');
      const r = runLogQL(db, q, { since: o.since, limit: o.limit === 0 ? 1e9 : o.limit, direction: o.forward ? 'forward' : 'backward' });
      const rows = flatEntries(r, o.forward);
      const common = rows.length ? Object.fromEntries(Object.entries(rows[0].labels).filter(([k, v]) => rows.every((x) => x.labels[k] === v))) : {};
      if (!o.quiet && o.output === 'default') ctx.err(`Common labels: ${formatLogLabels(common)}\n`);
      for (const x of rows) {
        if (o.output === 'raw') ctx.out(x.line + '\n');
        else if (o.output === 'jsonl') ctx.out(JSON.stringify({ labels: x.labels, line: x.line, timestamp: iso(x.ts) }) + '\n');
        else {
          const own = Object.fromEntries(Object.entries(x.labels).filter(([k]) => !(k in common)));
          ctx.out(`${iso(x.ts)} ${Object.keys(own).length ? formatLogLabels(own) + ' ' : ''}${x.line}\n`);
        }
      }
      if (!o.quiet && rows.length >= o.limit && o.limit > 0) ctx.err(`(the limit of ${o.limit} entries was reached; use --limit to see more)\n`);
      return 0;
    }
    ctx.err(`logcli: error: expected command but got "${cmd}", try --help\n`);
    return 1;
  } catch (e) {
    if (e instanceof LogQLError) {
      ctx.err(`Error response from server: ${e.message} (<nil>) attempts remaining: 0\nQuery failed: Run out of attempts while querying the server\n`);
      return 1;
    }
    throw e;
  }
}

export const logcliCommand: ShellCommand = {
  name: 'logcli',
  summary: bi('Клиент Loki: запросы LogQL к журналам магазина.', 'The Loki client: LogQL queries over the Shop logs.'),
  help: LOGCLI_HELP,
  handlesHelp: true,
  run,
  complete: (args) => (args.length <= 1 ? ['query', 'instant-query', 'labels', 'series'] : []),
};
