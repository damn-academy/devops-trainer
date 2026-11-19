// promtool and amtool against the training Prometheus (the "Shop" dataset)
// and the files in the learner's directory. The dataset of a lab is chosen
// by the setup hook `prom` and kept in /etc/prometheus/.dataset.

import { parse as parseYaml } from 'yaml';
import type { CmdContext, SetupHook, ShellCommand } from '../../../core/types';
import { bi } from '../../../core/i18n';
import { dataset, type Incident } from './data';
import { parseAm, parseRules, routeAlert, type Route } from './alerts';
import { formatLabels, query } from './promql';

const DATASET = '/etc/prometheus/.dataset';

export function datasetOf(ctx: CmdContext): Incident {
  const fs = ctx.machine.rootFs;
  return fs.exists(DATASET) ? (fs.readFile(DATASET).trim() as Incident) : 'none';
}

export const promSetupHook: SetupHook = {
  key: 'prom',
  apply(m, value) {
    const v = (value ?? {}) as { incident?: Incident };
    if (!m.rootFs.exists('/etc/prometheus')) m.rootFs.mkdir('/etc/prometheus', { parents: true });
    m.rootFs.writeFile(DATASET, `${v.incident ?? 'none'}\n`);
  },
};

function checkConfig(ctx: CmdContext, file: string): boolean {
  ctx.out(`Checking ${file}\n`);
  let y: { global?: Record<string, string>; scrape_configs?: { job_name?: string; scrape_interval?: string; metrics_path?: string; static_configs?: { targets?: string[] }[] }[]; rule_files?: string[] };
  try {
    y = (parseYaml(ctx.fs.readFile(file)) ?? {}) as typeof y;
  } catch (e) {
    ctx.out(`  FAILED: parsing YAML file ${file}: ${(e as Error).message.split('\n')[0]}\n`);
    return false;
  }
  const errs: string[] = [];
  const jobs = new Set<string>();
  for (const sc of y.scrape_configs ?? []) {
    if (!sc.job_name) errs.push('job_name is empty');
    else if (jobs.has(sc.job_name)) errs.push(`found multiple scrape configs with job name "${sc.job_name}"`);
    jobs.add(sc.job_name ?? '');
    for (const s of sc.static_configs ?? []) for (const t of s.targets ?? []) if (!/^[\w.-]+:\d+$/.test(t)) errs.push(`"${t}" is not a valid hostname`);
    for (const k of ['scrape_interval', 'scrape_timeout']) {
      const v = (sc as Record<string, string | undefined>)[k];
      if (v !== undefined && !/^(\d+(ms|s|m|h))+$/.test(v)) errs.push(`not a valid duration string: "${v}"`);
    }
  }
  if (errs.length) {
    ctx.out(`  FAILED: parsing YAML file ${file}: ${errs[0]}\n`);
    return false;
  }
  ctx.out(` SUCCESS: ${file} is valid prometheus config file syntax\n`);
  let ok = true;
  for (const r of y.rule_files ?? []) {
    ctx.out('\n');
    ok = checkRules(ctx, r) && ok;
  }
  return ok;
}

function checkRules(ctx: CmdContext, file: string): boolean {
  ctx.out(`Checking ${file}\n`);
  if (!ctx.fs.exists(file)) {
    ctx.out(`  FAILED:\n${file}: open ${file}: no such file or directory\n`);
    return false;
  }
  const { groups, errors } = parseRules(ctx.fs.readFile(file), file);
  if (errors.length) {
    ctx.out(`  FAILED:\n${errors.join('\n')}\n`);
    return false;
  }
  const n = groups.reduce((a, g) => a + g.rules.length, 0);
  ctx.out(`  SUCCESS: ${n} rules found\n`);
  return true;
}

export const promtoolCommand: ShellCommand = {
  name: 'promtool',
  summary: bi('Инструменты Prometheus: проверка конфигурации и правил, запросы PromQL.', 'Prometheus tools: checking config and rules, PromQL queries.'),
  help: `usage: promtool [<flags>] <command> [<args> ...]

Tooling for the Prometheus monitoring system.

Commands:
  check config <config-files>...
    Check if the config files are valid or not.

  check rules <rule-files>...
    Check if the rule files are valid or not.

  query instant <server> <expr>
    Run instant query.

  query range [<flags>] <server> <expr>
    Run range query.
        --start=START  Query range start time (RFC3339 or Unix timestamp).
        --end=END      Query range end time (RFC3339 or Unix timestamp).
        --step=STEP    Query step size (duration).
`,
  run(ctx) {
    const [a, b, ...rest] = ctx.argv.slice(1);
    if (a === 'check' && (b === 'config' || b === 'rules')) {
      if (!rest.length) {
        ctx.err(`promtool: error: required argument '${b === 'config' ? 'config-files' : 'rule-files'}' not provided\n`);
        return 1;
      }
      let ok = true;
      for (const f of rest) {
        if (!ctx.fs.exists(f)) {
          ctx.out(`Checking ${f}\n  FAILED: open ${f}: no such file or directory\n`);
          ok = false;
          continue;
        }
        ok = (b === 'config' ? checkConfig(ctx, f) : checkRules(ctx, f)) && ok;
        ctx.out('\n');
      }
      return ok ? 0 : 1;
    }
    if (a === 'query' && (b === 'instant' || b === 'range')) {
      const args = rest.filter((x) => !x.startsWith('--'));
      const [server, expr] = args;
      if (!server || expr === undefined) {
        ctx.err(`promtool: error: required argument '${server ? 'expr' : 'server'}' not provided\n`);
        return 1;
      }
      if (!/^https?:\/\/(localhost|prometheus|127\.0\.0\.1)(:9090)?\/?$/.test(server)) {
        ctx.err(`query error: Post "${server.replace(/\/$/, '')}/api/v1/query": dial tcp: lookup ${server.replace(/^https?:\/\//, '').split(/[:/]/)[0]}: no such host\n`);
        return 1;
      }
      const db = dataset(datasetOf(ctx));
      try {
        if (b === 'instant') {
          const r = query(db, expr);
          if (r.type === 'scalar') ctx.out(`scalar: ${r.value} @[${db.end / 1000}]\n`);
          else if (r.type === 'vector') for (const s of r.data) ctx.out(`${formatLabels(s.labels)} => ${Number.isInteger(s.value) ? s.value : +s.value.toFixed(6)} @[${db.end / 1000}]\n`);
          return 0;
        }
        const step = Number((rest.find((x) => x.startsWith('--step='))?.slice(7) ?? '300').replace(/s$/, ''));
        const end = db.end;
        const start = end - 3_600_000;
        for (let t = start; t <= end; t += step * 1000) {
          const r = query(db, expr, t);
          if (r.type === 'vector') for (const s of r.data) ctx.out(`${formatLabels(s.labels)} => ${+s.value.toFixed(6)} @[${t / 1000}]\n`);
        }
        return 0;
      } catch (e) {
        ctx.err(`query error: bad_data: invalid parameter "query": ${(e as Error).message}\n`);
        return 1;
      }
    }
    ctx.err(`promtool: error: expected command but got "${[a, b].filter(Boolean).join(' ')}", try --help\n`);
    return 1;
  },
};

function tree(r: Route, ind: string, last: boolean, out: string[], root = false): void {
  const label = root ? 'default-route' : `{${(r.matchers ?? []).join(',')}}`;
  out.push(`${ind}${root ? '└── ' : last ? '└── ' : '├── '}${label}${r.continue ? '  continue: true' : ''}  receiver: ${r.receiver ?? '(inherited)'}`);
  const kids = r.routes ?? [];
  kids.forEach((c, i) => tree(c, ind + (root || last ? '    ' : '│   '), i === kids.length - 1, out));
}

export const amtoolCommand: ShellCommand = {
  name: 'amtool',
  summary: bi('Инструмент Alertmanager: проверка конфигурации и маршрутов.', 'The Alertmanager tool: checking config and routes.'),
  help: `usage: amtool [<flags>] <command> [<args> ...]

View and modify the current Alertmanager state.

Commands:
  check-config [<check-files>...]
    Validate alertmanager config files

  config routes show [<flags>]
    Show the routing tree

  config routes test [<flags>] [<labels>...]
    Test alert routing
        --config.file=CONFIG.FILE  Config file to be tested.
        --verify.receivers=VERIFY.RECEIVERS  Checks if specified receivers matches resolved receivers.
`,
  run(ctx) {
    const args = ctx.argv.slice(1);
    const cfgFlag = args.find((a) => a.startsWith('--config.file='))?.slice(14);
    const readCfg = (f: string) => {
      if (!ctx.fs.exists(f)) {
        ctx.err(`amtool: error: open ${f}: no such file or directory\n`);
        return null;
      }
      return parseAm(ctx.fs.readFile(f));
    };
    if (args[0] === 'check-config') {
      let ok = true;
      for (const f of args.slice(1).filter((a) => !a.startsWith('-'))) {
        const r = readCfg(f);
        if (!r) return 1;
        if (r.errors.length) {
          ctx.out(`Checking '${f}'  FAILED: ${r.errors[0]}\n\n`);
          ok = false;
          continue;
        }
        ctx.out(`Checking '${f}'  SUCCESS\nFound:\n - global config\n - route\n - ${r.config!.inhibit_rules.length} inhibit rules\n - ${r.config!.receivers.length} receivers\n - 0 templates\n\n`);
      }
      return ok ? 0 : 1;
    }
    if (args[0] === 'config' && args[1] === 'routes') {
      const file = cfgFlag ?? (ctx.fs.exists('alertmanager.yml') ? 'alertmanager.yml' : undefined);
      if (!file) {
        ctx.err('amtool: error: required flag --config.file not provided\n');
        return 1;
      }
      const r = readCfg(file);
      if (!r) return 1;
      if (!r.config) {
        ctx.err(`amtool: error: ${r.errors[0]}\n`);
        return 1;
      }
      if (args[2] === 'show') {
        const out: string[] = ['Routing tree:'];
        tree(r.config.route, '', true, out, true);
        ctx.out(out.join('\n') + '\n');
        return 0;
      }
      if (args[2] === 'test') {
        const labels: Record<string, string> = {};
        for (const a of args.slice(3)) {
          const m = /^([A-Za-z_]\w*)=(.*)$/.exec(a);
          if (m) labels[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
        }
        const res = routeAlert(r.config, labels);
        const verify = args.find((a) => a.startsWith('--verify.receivers='))?.slice(19);
        ctx.out(res.receivers.join(',') + '\n');
        if (verify !== undefined && verify !== res.receivers.join(',')) {
          ctx.out(`WARNING: Expected receivers did not match resolved receivers.\n`);
          return 1;
        }
        return 0;
      }
    }
    ctx.err(`amtool: error: expected command but got "${args.join(' ')}", try --help\n`);
    return 1;
  },
};
