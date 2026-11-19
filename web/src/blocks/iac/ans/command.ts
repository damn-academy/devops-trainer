// ansible, ansible-playbook, ansible-inventory and ansible-doc on the control
// machine; the `ans` facts scope and the `ans` setup hook (managed hosts).

import type { CmdContext, FactsProvider, SetupHook, ShellCommand, SimMachineApi } from '../../../core/types';
import { bi } from '../../../core/i18n';
import type { TerminalRegistry } from '../../../engine/terminal/registry';
import { publish } from '../../git-cicd/shared/hub';
import { ANSIBLE_DOCS, renderAnsibleDoc } from './docs';
import { ANSIBLE_VERSION, factsOf, hostVars, MODULES, matchHosts, parseInventory, parsePlaybook, PlaybookError, resolveModule, runPlaybook, taskOf, type Inventory, type RunRecord } from './engine';
import { Host, HOSTS_ROOT, type HostSpec } from './hosts';
import { render, type Vars } from './jinja';

const RUNS = `${HOSTS_ROOT}/.runs.json`;

const registryOf = (ctx: CmdContext): TerminalRegistry | undefined => (ctx.machine as unknown as { registry?: TerminalRegistry }).registry;

function iniValue(text: string, section: string, key: string): string | undefined {
  let cur = '';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const s = /^\[(.+)\]$/.exec(line);
    if (s) cur = s[1];
    else if (cur === section) {
      const m = /^([\w_]+)\s*=\s*(.*)$/.exec(line);
      if (m && m[1] === key) return m[2].trim();
    }
  }
  return undefined;
}

function loadInventory(ctx: CmdContext, args: string[]): { inv: Inventory; dir: string; warn: string } {
  let path: string | undefined;
  const i = args.findIndex((a) => a === '-i' || a === '--inventory' || a === '--inventory-file');
  if (i >= 0) path = args[i + 1];
  const eq = args.find((a) => a.startsWith('--inventory='));
  if (eq) path = eq.slice(12);
  if (!path && ctx.fs.exists('ansible.cfg')) path = iniValue(ctx.fs.readFile('ansible.cfg'), 'defaults', 'inventory');
  if (!path && ctx.fs.exists('/etc/ansible/hosts')) path = '/etc/ansible/hosts';
  if (!path || !ctx.fs.exists(path)) {
    return { inv: parseInventory(''), dir: ctx.cwd, warn: path ? `[WARNING]: Unable to parse ${ctx.fs.resolve(path)} as an inventory source\n[WARNING]: No inventory was parsed, only implicit localhost is available\n` : '[WARNING]: No inventory was parsed, only implicit localhost is available\n' };
  }
  const abs = ctx.fs.resolve(path);
  if (ctx.fs.stat(abs)?.type === 'd') {
    const files = ctx.fs.readdir(abs).filter((f) => !f.startsWith('.') && ctx.fs.stat(`${abs}/${f}`)?.type === 'f');
    const text = files.map((f) => ctx.fs.readFile(`${abs}/${f}`)).join('\n');
    return { inv: parseInventory(text, files[0] ?? ''), dir: abs, warn: '' };
  }
  return { inv: parseInventory(ctx.fs.readFile(abs), abs), dir: abs.slice(0, abs.lastIndexOf('/')) || '/', warn: '' };
}

function extraVars(args: string[]): Vars {
  const out: Vars = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-e' || args[i] === '--extra-vars') {
      const v = args[++i] ?? '';
      if (v.trim().startsWith('{')) Object.assign(out, JSON.parse(v));
      else for (const m of v.matchAll(/(\w+)=("[^"]*"|'[^']*'|\S+)/g)) out[m[1]] = m[2].replace(/^["'](.*)["']$/, '$1');
    }
  }
  return out;
}

function saveRun(ctx: CmdContext, rec: RunRecord): void {
  const fs = ctx.machine.rootFs;
  let runs: RunRecord[] = [];
  try {
    runs = fs.exists(RUNS) ? (JSON.parse(fs.readFile(RUNS)) as RunRecord[]) : [];
  } catch {
    runs = [];
  }
  runs.push(rec);
  if (!fs.exists(HOSTS_ROOT)) fs.mkdir(HOSTS_ROOT, { parents: true });
  fs.writeFile(RUNS, JSON.stringify(runs.slice(-20)));
  for (const t of rec.tasks) ctx.machine.emit({ t: 'ans.task', host: t.host, task: t.task, status: t.status });
  publish({ t: 'ans.run', run: rec });
}

const color = (ctx: CmdContext, args: string[]) => ctx.isatty && !args.includes('--no-color');

/** Ad-hoc: ansible PATTERN -m MODULE -a ARGS */
async function adhoc(ctx: CmdContext): Promise<number> {
  const args = ctx.argv.slice(1);
  if (args.includes('--version')) {
    ctx.out(`ansible [core ${ANSIBLE_VERSION}]\n  config file = ${ctx.fs.exists('ansible.cfg') ? ctx.fs.resolve('ansible.cfg') : 'None'}\n  python version = 3.13.5\n  jinja version = 3.1.6\n`);
    return 0;
  }
  const { inv, dir, warn } = loadInventory(ctx, args);
  const pattern = args.find((a, i) => !a.startsWith('-') && !['-i', '-m', '-a', '-e', '--inventory', '--module-name', '--args', '-l', '--limit'].includes(args[i - 1] ?? ''));
  if (!pattern) {
    ctx.err('usage: ansible [-h] [--version] [-v] [-b] [-i INVENTORY] [-a MODULE_ARGS] [-m MODULE_NAME] pattern\nansible: error: the following arguments are required: pattern\n');
    return 2;
  }
  const mi = args.findIndex((a) => a === '-m' || a === '--module-name');
  const ai = args.findIndex((a) => a === '-a' || a === '--args');
  const modName = mi >= 0 ? args[mi + 1] : 'ansible.builtin.command';
  const check = args.includes('--check') || args.includes('-C');
  const mod = resolveModule(modName);
  if (warn) ctx.err(warn);
  const hosts = matchHosts(inv, pattern);
  if (!hosts.length) {
    ctx.err(`[WARNING]: Could not match supplied host pattern, ignoring: ${pattern}\n`);
    return 0;
  }
  if (!mod) {
    ctx.err(`ERROR! couldn't resolve module/action '${modName}'. This often indicates a misspelling, missing collection, or incorrect module path.\n`);
    return 1;
  }
  const t = taskOf({ [modName]: ai >= 0 ? args[ai + 1] : mod === 'command' ? '' : {} });
  const col = color(ctx, args);
  const G = (s: string) => (col ? `\x1b[32m${s}\x1b[0m` : s);
  const Y = (s: string) => (col ? `\x1b[33m${s}\x1b[0m` : s);
  const R = (s: string) => (col ? `\x1b[31m${s}\x1b[0m` : s);
  let rc = 0;
  for (const h of hosts) {
    const host = new Host(ctx.machine.rootFs, h);
    const meta = Host.exists(ctx.machine.rootFs, h) ? host.db().meta : null;
    const vars = { ...hostVars(ctx.machine.rootFs, inv, dir, h), ...extraVars(args) };
    if (!meta || !meta.reachable) {
      const ip = String(vars.ansible_host ?? meta?.ip ?? h);
      ctx.out(R(`${h} | UNREACHABLE! => {\n    "changed": false,\n    "msg": "Failed to connect to the host via ssh: ${meta ? `ssh: connect to host ${ip} port 22: Connection timed out` : `ssh: Could not resolve hostname ${ip}: Name or service not known`}",\n    "unreachable": true\n}`) + '\n');
      rc = 4;
      continue;
    }
    if (!meta.python) {
      ctx.out(R(`${h} | FAILED! => {\n    "changed": false,\n    "module_stderr": "/bin/sh: 1: /usr/bin/python3: not found\\n",\n    "module_stdout": "",\n    "msg": "The module failed to execute correctly, you probably need to set the interpreter.\\nSee stdout/stderr for the exact error",\n    "rc": 127\n}`) + '\n');
      rc = 2;
      continue;
    }
    const v = { ...vars, ...factsOf(host) };
    const a = Object.fromEntries(Object.entries(t.args).map(([k, x]) => [k, typeof x === 'string' ? render(x, v) : x]));
    const res = await MODULES[t.module]({ host, args: a, check, base: ctx.cwd, ctlFs: ctx.machine.rootFs, vars: v, registry: registryOf(ctx) });
    if (t.module === 'command' || t.module === 'shell') {
      const head = res.failed ? R(`${h} | FAILED | rc=${res.rc} >>`) : res.skipped ? Y(`${h} | SKIPPED`) : Y(`${h} | CHANGED | rc=${res.rc} >>`);
      ctx.out(`${head}\n${res.stdout ?? res.msg ?? ''}${res.failed ? 'non-zero return code' : ''}\n`);
      if (res.failed) rc = 2;
      continue;
    }
    const { diff: _d, ...shown } = res;
    void _d;
    const body = JSON.stringify(t.module === 'setup' ? { ansible_facts: res.ansible_facts, changed: false } : shown, null, 4);
    if (res.failed) {
      ctx.out(R(`${h} | FAILED! => ${body}`) + '\n');
      rc = 2;
    } else ctx.out((res.changed ? Y(`${h} | CHANGED => ${body}`) : G(`${h} | SUCCESS => ${body}`)) + '\n');
  }
  return rc;
}

async function playbook(ctx: CmdContext): Promise<number> {
  const args = ctx.argv.slice(1);
  if (args.includes('--version')) {
    ctx.out(`ansible-playbook [core ${ANSIBLE_VERSION}]\n`);
    return 0;
  }
  const { inv, dir, warn } = loadInventory(ctx, args);
  const skipNext = new Set(['-i', '--inventory', '-e', '--extra-vars', '-l', '--limit', '--start-at-task', '-t', '--tags']);
  const files = args.filter((a, i) => !a.startsWith('-') && !skipNext.has(args[i - 1] ?? ''));
  if (!files.length) {
    ctx.err('usage: ansible-playbook [-h] [--version] [-v] [-i INVENTORY] [--check] [--diff] playbook [playbook ...]\nansible-playbook: error: the following arguments are required: playbook\n');
    return 2;
  }
  if (warn) ctx.err(warn);
  const li = args.findIndex((a) => a === '-l' || a === '--limit');
  const si = args.findIndex((a) => a === '--start-at-task');
  let rc = 0;
  for (const f of files) {
    if (!ctx.fs.exists(f)) {
      ctx.err(`ERROR! the playbook: ${f} could not be found\n`);
      return 1;
    }
    let plays;
    try {
      plays = parsePlaybook(ctx.fs.readFile(f));
    } catch (e) {
      ctx.err(`ERROR! ${(e as Error).message}\n\nThe error appears to be in '${ctx.fs.resolve(f)}'.\n`);
      return 4;
    }
    if (si >= 0) {
      // Skip tasks before the named one, as --start-at-task does.
      const name = args[si + 1];
      let found = false;
      for (const p of plays) {
        const idx = (p.tasks ?? []).findIndex((t) => t.name === name);
        if (!found && idx >= 0) {
          p.tasks = (p.tasks ?? []).slice(idx);
          found = true;
        } else if (!found) p.tasks = [];
      }
      if (!found) {
        ctx.err(`ERROR! No matching task "${name}" found. Note: --start-at-task can only follow static includes.\n`);
        return 1;
      }
    }
    const full = ctx.fs.resolve(f);
    const base = full.slice(0, full.lastIndexOf('/')) || '/';
    try {
      const r = await runPlaybook(
        ctx.machine.rootFs,
        inv,
        dir,
        plays,
        base,
        { check: args.includes('--check') || args.includes('-C'), diff: args.includes('--diff') || args.includes('-D'), limit: li >= 0 ? args[li + 1] : undefined, extraVars: extraVars(args), forceHandlers: args.includes('--force-handlers'), color: color(ctx, args), verbose: args.filter((a) => /^-v+$/.test(a)).reduce((n, a) => n + a.length - 1, 0) },
        ctx.out,
        f,
        registryOf(ctx),
      );
      saveRun(ctx, r.record);
      rc = Math.max(rc, r.rc);
    } catch (e) {
      if (e instanceof PlaybookError) {
        ctx.err(`ERROR! ${e.message}\n`);
        return 4;
      }
      throw e;
    }
  }
  return rc;
}

function inventoryCmd(ctx: CmdContext): number {
  const args = ctx.argv.slice(1);
  const { inv, dir, warn } = loadInventory(ctx, args);
  if (warn) ctx.err(warn);
  if (args.includes('--graph')) {
    const draw = (g: string, ind: string, seen: Set<string>) => {
      const grp = inv.groups.get(g)!;
      ctx.out(`${ind}@${g}:\n`);
      for (const c of [...grp.children].sort()) if (!seen.has(c)) draw(c, ind + '  |--', new Set([...seen, c]));
      for (const h of [...grp.hosts].sort()) ctx.out(`${ind}  |--${h}\n`);
    };
    const top = [...inv.groups.keys()].filter((g) => g !== 'all' && ![...inv.groups.values()].some((x) => x.children.has(g)) && (inv.groups.get(g)!.hosts.size || inv.groups.get(g)!.children.size));
    ctx.out('@all:\n');
    for (const g of top.sort((a, b) => (a === 'ungrouped' ? 1 : b === 'ungrouped' ? -1 : a.localeCompare(b)))) draw(g, '  |--', new Set([g]));
    return 0;
  }
  const hi = args.indexOf('--host');
  if (hi >= 0) {
    ctx.out(JSON.stringify(Object.fromEntries(Object.entries(hostVars(ctx.machine.rootFs, inv, dir, args[hi + 1])).filter(([k]) => !['groups', 'group_names', 'inventory_hostname'].includes(k))), null, 4) + '\n');
    return 0;
  }
  const out: Record<string, unknown> = { _meta: { hostvars: Object.fromEntries([...inv.hostvars.keys()].map((h) => [h, inv.hostvars.get(h)])) } };
  for (const [g, x] of inv.groups) if (x.hosts.size || x.children.size || g === 'all') out[g] = { ...(x.hosts.size ? { hosts: [...x.hosts] } : {}), ...(x.children.size || g === 'all' ? { children: g === 'all' ? [...inv.groups.keys()].filter((k) => k !== 'all' && ![...inv.groups.values()].some((y) => y.children.has(k)) && (inv.groups.get(k)!.hosts.size || inv.groups.get(k)!.children.size)) : [...x.children] } : {}) };
  ctx.out(JSON.stringify(out, null, 4) + '\n');
  return 0;
}

function docCmd(ctx: CmdContext): number {
  const args = ctx.argv.slice(1);
  if (args.includes('-l') || args.includes('--list')) {
    for (const p of ANSIBLE_DOCS) ctx.out(`${p.title.padEnd(32)} ${p.sections.find((s) => s.id === 'NAME')!.body.split(' - ')[1]}\n`);
    return 0;
  }
  const name = args.find((a) => !a.startsWith('-'));
  if (!name) {
    ctx.err('usage: ansible-doc [-h] [--version] [-l] [-s] [plugin ...]\nansible-doc: error: Incorrect options passed\n');
    return 2;
  }
  const full = name.includes('.') ? name : `ansible.builtin.${name}`;
  const page = ANSIBLE_DOCS.find((p) => p.title === full);
  if (!page) {
    ctx.err(`[WARNING]: ${name} was not found\n`);
    return 1;
  }
  if (args.includes('-s') || args.includes('--snippet')) {
    const opts = page.sections.find((s) => s.id === 'OPTIONS')!.body.split('\n\n');
    ctx.out(`- name: ${page.sections.find((s) => s.id === 'NAME')!.body.split(' - ')[1]}\n  ${full}:\n${opts.map((o) => `      ${o.split('\n')[0].slice(2).padEnd(18)} # ${o.split('\n')[1].trim().slice(0, 50)}`).join('\n')}\n`);
    return 0;
  }
  const text = renderAnsibleDoc(page);
  if (ctx.isatty) ctx.effect({ kind: 'pager', title: full, text });
  else ctx.out(text);
  return 0;
}

const SUMMARY = bi('Ansible: настройка серверов по описанию из инвентаря и плейбуков.', 'Ansible: configuring servers from an inventory and playbooks.');

export const ansibleCommands: ShellCommand[] = [
  {
    name: 'ansible',
    summary: SUMMARY,
    help: 'usage: ansible [-h] [--version] [-v] [-b] [-C] [-i INVENTORY] [-a MODULE_ARGS] [-m MODULE_NAME] [-e EXTRA_VARS] pattern\n\nDefine and run a single task \'playbook\' against a set of hosts\n\npositional arguments:\n  pattern               host pattern\n\noptions:\n  -a, --args MODULE_ARGS\n                        The action\'s options in space separated k=v format: -a\n                        \'opt1=val1 opt2=val2\' or a json string: -a \'{"opt1":\n                        "val1", "opt2": "val2"}\'\n  -C, --check           don\'t make any changes; instead, try to predict some of\n                        the changes that may occur\n  -i, --inventory INVENTORY\n                        specify inventory host path or comma separated host list\n  -m, --module-name MODULE_NAME\n                        Name of the action to execute (default=command)\n',
    run: adhoc,
  },
  {
    name: 'ansible-playbook',
    summary: SUMMARY,
    help: 'usage: ansible-playbook [-h] [--version] [-v] [-i INVENTORY] [-l SUBSET] [-e EXTRA_VARS] [-C] [-D] [--force-handlers] [--start-at-task START_AT_TASK] playbook [playbook ...]\n\nRuns Ansible playbooks, executing the defined tasks on the targeted hosts.\n\npositional arguments:\n  playbook              Playbook(s)\n\noptions:\n  -C, --check           don\'t make any changes; instead, try to predict some of\n                        the changes that may occur\n  -D, --diff            when changing (small) files and templates, show the\n                        differences in those files; works great with --check\n  -e, --extra-vars EXTRA_VARS\n                        set additional variables as key=value or YAML/JSON, if\n                        filename prepend with @\n  --force-handlers      run handlers even if a task fails\n  -i, --inventory INVENTORY\n                        specify inventory host path or comma separated host list\n  -l, --limit SUBSET    further limit selected hosts to an additional pattern\n  --start-at-task START_AT_TASK\n                        start the playbook at the task matching this name\n  -v, --verbose         Causes Ansible to print more debug messages.\n',
    run: playbook,
  },
  {
    name: 'ansible-inventory',
    summary: SUMMARY,
    help: 'usage: ansible-inventory [-h] [-i INVENTORY] [--list | --host HOST | --graph] [group]\n\nShow Ansible inventory information, by default it uses the inventory script JSON format\n\noptions:\n  --graph               create inventory graph, if supplying pattern it must be a valid group name.\n  --host HOST           Output specific host info, works as inventory script\n  --list                Output all hosts info, works as inventory script\n',
    run: inventoryCmd,
  },
  {
    name: 'ansible-doc',
    summary: bi('Документация модулей Ansible в терминале.', 'Ansible module documentation in the terminal.'),
    help: 'usage: ansible-doc [-h] [--version] [-l] [-s] [plugin ...]\n\nplugin documentation tool\n\npositional arguments:\n  plugin                Plugin\n\noptions:\n  -l, --list            List available plugins.\n  -s, --snippet         Show playbook snippet for these plugin types: inventory, lookup, module\n',
    run: docCmd,
  },
];

// ── facts and setup ──

export interface AnsFacts {
  hosts: { name: string; ip: string; reachable: boolean; python: boolean; os_family: string; packages: string[]; services: Record<string, { state: string; enabled: boolean; restarts: number }>; users: string[]; files: Record<string, string> }[];
  runs: RunRecord[];
}

export function ansFacts(m: SimMachineApi): AnsFacts {
  const fs = m.rootFs;
  const hosts = Host.list(fs).map((n) => {
    const h = new Host(fs, n);
    const db = h.db();
    return { name: n, ip: db.meta.ip, reachable: db.meta.reachable, python: db.meta.python, os_family: db.meta.os_family, packages: Object.keys(db.packages).sort(), services: db.services, users: Object.keys(db.users).sort(), files: h.files() };
  });
  let runs: RunRecord[] = [];
  try {
    runs = fs.exists(RUNS) ? (JSON.parse(fs.readFile(RUNS)) as RunRecord[]) : [];
  } catch {
    runs = [];
  }
  return { hosts, runs };
}

export const ansFactsProvider: FactsProvider = { scope: 'ans', collect: ansFacts };

/** ext.ans: { hosts: HostSpec[] } */
export const ansSetupHook: SetupHook = {
  key: 'ans',
  apply(m, value) {
    const v = value as { hosts?: HostSpec[] };
    (v.hosts ?? []).forEach((spec, i) => Host.create(m.rootFs, spec, i));
  },
};

export const hostFact = (f: Record<string, unknown>, name: string) => (f.ans as AnsFacts | undefined)?.hosts.find((h) => h.name === name);
export const lastRun = (f: Record<string, unknown>) => {
  const r = (f.ans as AnsFacts | undefined)?.runs ?? [];
  return r[r.length - 1];
};
export const runs = (f: Record<string, unknown>) => (f.ans as AnsFacts | undefined)?.runs ?? [];
