// ansim: the Ansible semantics the course needs (06 §4.1) — inventory and
// groups, variables with the usual precedence, plays, tasks, modules with an
// honest `changed`, facts, handlers, when/loop/register, check mode and diff.
// Output follows the default callback of ansible-core.

import { parse as parseYaml } from 'yaml';
import type { FsApi } from '../../../core/types';
import { createSimMachine } from '../../../engine/terminal/shell';
import type { TerminalRegistry } from '../../../engine/terminal/registry';
import { unifiedHunks } from '../../git-cicd/git/diff';
import { Host, PACKAGES } from './hosts';
import { evalWhen, JinjaError, render, renderText, type Vars } from './jinja';

export const ANSIBLE_VERSION = '2.19.3';

// ── inventory ──

export interface Inventory {
  groups: Map<string, { hosts: Set<string>; vars: Vars; children: Set<string> }>;
  hostvars: Map<string, Vars>;
}

function scalar(v: string): unknown {
  if (/^-?\d+$/.test(v)) return Number(v);
  if (/^(true|yes)$/i.test(v)) return true;
  if (/^(false|no)$/i.test(v)) return false;
  return v.replace(/^["'](.*)["']$/, '$1');
}

function kv(line: string): Vars {
  const out: Vars = {};
  for (const m of line.matchAll(/(\w+)=("[^"]*"|'[^']*'|\S+)/g)) out[m[1]] = scalar(m[2]);
  return out;
}

export function parseInventory(text: string, path = 'inventory'): Inventory {
  const inv: Inventory = { groups: new Map([['all', { hosts: new Set(), vars: {}, children: new Set() }], ['ungrouped', { hosts: new Set(), vars: {}, children: new Set() }]]), hostvars: new Map() };
  const group = (n: string) => {
    if (!inv.groups.has(n)) inv.groups.set(n, { hosts: new Set(), vars: {}, children: new Set() });
    return inv.groups.get(n)!;
  };
  const addHost = (g: string, h: string, vars: Vars) => {
    group(g).hosts.add(h);
    inv.hostvars.set(h, { ...(inv.hostvars.get(h) ?? {}), ...vars });
  };
  if (/\.(ya?ml)$/.test(path) || /^\s*all\s*:/m.test(text)) {
    const y = (parseYaml(text) ?? {}) as Record<string, unknown>;
    const walk = (name: string, node: Record<string, unknown> | null) => {
      group(name);
      if (!node) return;
      for (const [h, v] of Object.entries((node.hosts as Record<string, Vars | null>) ?? {})) addHost(name, h, v ?? {});
      Object.assign(group(name).vars, (node.vars as Vars) ?? {});
      for (const [c, cv] of Object.entries((node.children as Record<string, Record<string, unknown> | null>) ?? {})) {
        group(name).children.add(c);
        walk(c, cv);
      }
    };
    for (const [g, node] of Object.entries(y)) walk(g, node as Record<string, unknown>);
  } else {
    let cur = 'ungrouped';
    let mode: 'hosts' | 'vars' | 'children' = 'hosts';
    for (const raw of text.split('\n')) {
      const line = raw.replace(/[#;].*$/, '').trim();
      if (!line) continue;
      const sec = /^\[([\w.-]+)(?::(vars|children))?\]$/.exec(line);
      if (sec) {
        cur = sec[1];
        mode = (sec[2] as 'vars' | 'children') ?? 'hosts';
        group(cur);
        continue;
      }
      if (mode === 'vars') Object.assign(group(cur).vars, kv(line));
      else if (mode === 'children') {
        group(cur).children.add(line);
        group(line);
      } else {
        const [h, ...rest] = line.split(/\s+/);
        addHost(cur, h, kv(rest.join(' ')));
      }
    }
  }
  // Every host is in all; hosts without a group are in ungrouped.
  for (const [h] of inv.hostvars) {
    group('all').hosts.add(h);
    const inSome = [...inv.groups.entries()].some(([g, x]) => g !== 'all' && g !== 'ungrouped' && x.hosts.has(h));
    if (!inSome) group('ungrouped').hosts.add(h);
    else group('ungrouped').hosts.delete(h);
  }
  return inv;
}

export function groupHosts(inv: Inventory, g: string, seen = new Set<string>()): string[] {
  const grp = inv.groups.get(g);
  if (!grp || seen.has(g)) return [];
  seen.add(g);
  const out = new Set(grp.hosts);
  for (const c of grp.children) for (const h of groupHosts(inv, c, seen)) out.add(h);
  return [...out];
}

export function groupsOf(inv: Inventory, host: string): string[] {
  return [...inv.groups.keys()].filter((g) => groupHosts(inv, g).includes(host));
}

/** Host patterns: all, a group, a host, a:b (union), a:&b (intersection), a:!b (exclusion). */
export function matchHosts(inv: Inventory, pattern: string): string[] {
  let result: string[] = [];
  const order = [...inv.hostvars.keys()];
  for (const part of pattern.split(/[:,]/).filter(Boolean)) {
    const neg = part.startsWith('!');
    const and = part.startsWith('&');
    const name = part.replace(/^[!&]/, '');
    const hosts = name === 'all' || name === '*' ? order : inv.groups.has(name) ? groupHosts(inv, name) : inv.hostvars.has(name) ? [name] : order.filter((h) => new RegExp(`^${name.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(h));
    if (neg) result = result.filter((h) => !hosts.includes(h));
    else if (and) result = result.filter((h) => hosts.includes(h));
    else result = [...new Set([...result, ...hosts])];
  }
  return order.filter((h) => result.includes(h));
}

// ── variables ──

function readVarsFile(fs: FsApi, base: string): Vars {
  for (const ext of ['', '.yml', '.yaml']) {
    const p = base + ext;
    if (fs.stat(p)?.type === 'f') {
      try {
        return ((parseYaml(fs.readFile(p)) as Vars) ?? {}) as Vars;
      } catch {
        return {};
      }
    }
  }
  return {};
}

export function hostVars(fs: FsApi, inv: Inventory, invDir: string, host: string): Vars {
  const groups = groupsOf(inv, host).filter((g) => g !== 'all');
  let v: Vars = { ...(inv.groups.get('all')?.vars ?? {}), ...readVarsFile(fs, `${invDir}/group_vars/all`) };
  for (const g of groups) v = { ...v, ...(inv.groups.get(g)?.vars ?? {}), ...readVarsFile(fs, `${invDir}/group_vars/${g}`) };
  v = { ...v, ...(inv.hostvars.get(host) ?? {}), ...readVarsFile(fs, `${invDir}/host_vars/${host}`) };
  return { ...v, inventory_hostname: host, group_names: groups.filter((g) => g !== 'ungrouped').sort(), groups: Object.fromEntries([...inv.groups.keys()].map((g) => [g, groupHosts(inv, g)])) };
}

export function factsOf(h: Host): Vars {
  const m = h.db().meta;
  const f = {
    hostname: m.name,
    nodename: m.name,
    os_family: m.os_family,
    distribution: m.distribution,
    distribution_version: m.distribution_version,
    distribution_major_version: m.distribution_version.split('.')[0],
    default_ipv4: { address: m.ip, interface: 'eth0' },
    memtotal_mb: m.memtotal_mb,
    processor_vcpus: m.vcpus,
    pkg_mgr: m.os_family === 'Debian' ? 'apt' : 'dnf',
    service_mgr: 'systemd',
    date_time: { iso8601: '2026-11-18T09:00:00Z', date: '2026-11-18' },
  };
  return { ansible_facts: f, ...Object.fromEntries(Object.entries(f).map(([k, v]) => [`ansible_${k}`, v])) };
}

// ── modules ──

export interface ModResult {
  changed: boolean;
  failed?: boolean;
  skipped?: boolean;
  msg?: string;
  rc?: number;
  stdout?: string;
  stderr?: string;
  diff?: { path: string; before: string; after: string };
  [k: string]: unknown;
}

export interface ModCtx {
  host: Host;
  args: Vars;
  check: boolean;
  /** Directory of the playbook (files/ and templates/ are looked up here). */
  base: string;
  ctlFs: FsApi;
  vars: Vars;
  /** Commands available on managed hosts (the control machine's registry). */
  registry?: TerminalRegistry;
}

type Module = (c: ModCtx) => Promise<ModResult> | ModResult;

const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v === undefined || v === null || v === '' ? [] : String(v).split(',').map((s) => s.trim()));

function fileResult(c: ModCtx, path: string, after: string, mode?: string): ModResult {
  const before = c.host.read(path);
  const modeNow = c.host.mode(path);
  const contentChanged = before !== after;
  const modeChanged = mode !== undefined && modeNow !== mode.padStart(4, '0');
  const changed = contentChanged || modeChanged;
  if (changed && !c.check) c.host.write(path, after, mode !== undefined ? parseInt(mode, 8) : undefined);
  return { changed, dest: path, ...(contentChanged ? { diff: { path, before: before ?? '', after } } : {}) };
}

function localFile(c: ModCtx, sub: 'files' | 'templates', src: string): string | null {
  for (const p of [src.startsWith('/') ? src : `${c.base}/${sub}/${src}`, `${c.base}/${src}`]) if (c.ctlFs.stat(p)?.type === 'f') return c.ctlFs.readFile(p);
  return null;
}

function pkgModule(c: ModCtx, os: 'Debian' | 'RedHat' | null): ModResult {
  const db = c.host.db();
  if (os && db.meta.os_family !== os) return { changed: false, failed: true, msg: os === 'Debian' ? 'Could not find aptitude. Please ensure it is installed.' : 'Could not find dnf' };
  const names = list(c.args.name ?? c.args.pkg);
  const state = String(c.args.state ?? 'present');
  let changed = false;
  for (const n of names) {
    const pkgName = n.replace(/=.*$/, '');
    if (!PACKAGES[pkgName]) return { changed: false, failed: true, msg: `No package matching '${pkgName}' is available` };
    const has = pkgName in db.packages;
    if ((state === 'present' || state === 'latest' || state === 'installed') && !has) {
      changed = true;
      if (!c.check) c.host.install(pkgName);
    } else if ((state === 'absent' || state === 'removed') && has) {
      changed = true;
      if (!c.check) c.host.uninstall(pkgName);
    }
  }
  return { changed, ...(c.args.update_cache ? { cache_updated: true } : {}) };
}

export const MODULES: Record<string, Module> = {
  ping: (c) => (c.host.db().meta.python ? { changed: false, ping: 'pong' } : { changed: false, failed: true, msg: 'MODULE FAILURE' }),
  setup: (c) => ({ changed: false, ansible_facts: factsOf(c.host).ansible_facts }),
  debug: (c) => {
    if (c.args.var !== undefined) {
      const name = String(c.args.var);
      const v = render(`{{ ${name} }}`, c.vars);
      return { changed: false, [name]: v } as ModResult;
    }
    return { changed: false, msg: String(c.args.msg ?? 'Hello world!') };
  },
  apt: (c) => pkgModule(c, 'Debian'),
  package: (c) => pkgModule(c, null),
  dnf: (c) => pkgModule(c, 'RedHat'),
  copy: (c) => {
    const dest = String(c.args.dest ?? '');
    if (!dest) return { changed: false, failed: true, msg: 'missing required arguments: dest' };
    let content: string | null;
    if (c.args.content !== undefined) content = String(c.args.content);
    else if (c.args.src !== undefined) {
      content = localFile(c, 'files', String(c.args.src));
      if (content === null) return { changed: false, failed: true, msg: `Could not find or access '${c.args.src}'\nSearched in:\n\t${c.base}/files/${c.args.src}\n\t${c.base}/${c.args.src} on the Ansible Controller.\nIf you are using a module and expect the file to exist on the remote, see the remote_src option` };
    } else return { changed: false, failed: true, msg: 'src (or content) is required' };
    const path = dest.endsWith('/') || c.host.isDir(dest) ? `${dest.replace(/\/$/, '')}/${String(c.args.src ?? 'file').split('/').pop()}` : dest;
    return fileResult(c, path, content, c.args.mode !== undefined ? String(c.args.mode) : undefined);
  },
  template: (c) => {
    const src = String(c.args.src ?? '');
    const dest = String(c.args.dest ?? '');
    if (!src || !dest) return { changed: false, failed: true, msg: `missing required arguments: ${!src ? 'src' : 'dest'}` };
    const text = localFile(c, 'templates', src);
    if (text === null) return { changed: false, failed: true, msg: `Could not find or access '${src}'\nSearched in:\n\t${c.base}/templates/${src}\n\t${c.base}/${src} on the Ansible Controller.` };
    let out: string;
    try {
      out = renderText(text, c.vars);
    } catch (e) {
      return { changed: false, failed: true, msg: `AnsibleUndefinedVariable: ${(e as Error).message}` };
    }
    return fileResult(c, dest, out, c.args.mode !== undefined ? String(c.args.mode) : undefined);
  },
  file: (c) => {
    const path = String(c.args.path ?? c.args.dest ?? '');
    const state = String(c.args.state ?? 'file');
    const exists = c.host.exists(path);
    if (state === 'absent') {
      if (exists && !c.check) c.host.remove(path);
      return { changed: exists, path, state };
    }
    if (state === 'directory') {
      const changed = !c.host.isDir(path);
      if (changed && !c.check) c.ctlFs.mkdir(c.host.p(path), { parents: true });
      return { changed, path, state };
    }
    if (state === 'touch') {
      if (!c.check) c.host.write(path, c.host.read(path) ?? '');
      return { changed: true, path, state };
    }
    if (!exists) return { changed: false, failed: true, msg: `file (${path}) is absent, cannot continue`, path };
    if (c.args.mode !== undefined && c.host.mode(path) !== String(c.args.mode).padStart(4, '0')) {
      if (!c.check) c.ctlFs.chmod(c.host.p(path), parseInt(String(c.args.mode), 8));
      return { changed: true, path };
    }
    return { changed: false, path };
  },
  lineinfile: (c) => {
    const path = String(c.args.path ?? c.args.dest ?? '');
    const line = c.args.line !== undefined ? String(c.args.line) : undefined;
    const state = String(c.args.state ?? 'present');
    const before = c.host.read(path);
    if (before === null) {
      if (!c.args.create) return { changed: false, failed: true, rc: 257, msg: `Destination ${path} does not exist !` };
    }
    const lines = before === null ? [] : before.replace(/\n$/, '').split('\n').filter((l, i, a) => !(l === '' && i === a.length - 1 && before === ''));
    const re = c.args.regexp !== undefined ? new RegExp(String(c.args.regexp)) : null;
    let next = [...lines];
    if (state === 'absent') next = lines.filter((l) => !(re ? re.test(l) : l === line));
    else {
      if (line === undefined) return { changed: false, failed: true, msg: 'line is required with state=present' };
      const idx = re ? lines.map((l, i) => (re.test(l) ? i : -1)).filter((i) => i >= 0).pop() ?? -1 : lines.indexOf(line);
      if (idx >= 0) next[idx] = line;
      else if (!lines.includes(line)) next.push(line);
    }
    const after = next.length ? next.join('\n') + '\n' : '';
    return fileResult(c, path, after);
  },
  service: (c) => {
    const name = String(c.args.name ?? '');
    const db = c.host.db();
    const svc = db.services[name];
    if (!svc) return { changed: false, failed: true, msg: `Could not find the requested service ${name}: host` };
    const state = c.args.state !== undefined ? String(c.args.state) : undefined;
    let changed = false;
    const next = { ...svc };
    if (state === 'started' && svc.state !== 'started') ((next.state = 'started'), (changed = true));
    if (state === 'stopped' && svc.state !== 'stopped') ((next.state = 'stopped'), (changed = true));
    if (state === 'restarted' || state === 'reloaded') {
      next.state = 'started';
      next.restarts++;
      changed = true;
    }
    if (c.args.enabled !== undefined && !!c.args.enabled !== svc.enabled) ((next.enabled = !!c.args.enabled), (changed = true));
    if (changed && !c.check) c.host.update((d) => (d.services[name] = next));
    return { changed, name, state: next.state, enabled: next.enabled };
  },
  systemd_service: (c) => MODULES.service(c),
  systemd: (c) => MODULES.service(c),
  user: (c) => {
    const name = String(c.args.name ?? '');
    const db = c.host.db();
    const state = String(c.args.state ?? 'present');
    const u = db.users[name];
    if (state === 'absent') {
      if (u && !c.check) c.host.update((d) => delete d.users[name]);
      return { changed: !!u, name, state };
    }
    const want = { shell: String(c.args.shell ?? u?.shell ?? '/bin/sh'), groups: c.args.groups !== undefined ? list(c.args.groups) : u?.groups ?? [], home: u?.home ?? `/home/${name}` };
    if (c.args.append && u) want.groups = [...new Set([...u.groups, ...want.groups])];
    const changed = !u || JSON.stringify(u) !== JSON.stringify(want);
    if (changed && !c.check) {
      c.host.update((d) => (d.users[name] = want));
      if (!c.host.exists(want.home)) c.ctlFs.mkdir(c.host.p(want.home), { parents: true });
    }
    return { changed, name, state, shell: want.shell };
  },
  command: (c) => runOnHost(c, false),
  shell: (c) => runOnHost(c, true),
};

const FQCN = new Map<string, string>([
  ...Object.keys(MODULES).map((k) => [`ansible.builtin.${k}`, k] as [string, string]),
  ...Object.keys(MODULES).map((k) => [`ansible.legacy.${k}`, k] as [string, string]),
  ...Object.keys(MODULES).map((k) => [k, k] as [string, string]),
]);

export function resolveModule(name: string): string | undefined {
  return FQCN.get(name);
}

/** command and shell: run the line on a scratch machine that holds the host's files, then copy changes back. */
async function runOnHost(c: ModCtx, shell: boolean): Promise<ModResult> {
  const cmd = String(c.args._raw_params ?? c.args.cmd ?? '');
  if (!cmd) return { changed: false, failed: true, msg: 'no command given', rc: 256 };
  if (c.args.creates && c.host.exists(String(c.args.creates))) return { changed: false, rc: 0, stdout: `skipped, since ${c.args.creates} exists`, cmd };
  if (c.args.removes && !c.host.exists(String(c.args.removes))) return { changed: false, rc: 0, stdout: `skipped, since ${c.args.removes} does not exist`, cmd };
  if (c.check) return { changed: false, skipped: true, msg: 'Command would have run if not in check mode', cmd };
  if (!shell && /[|><;&]|\$\(/.test(cmd)) {
    // The command module does not use a shell: the operators become arguments.
  }
  const files = c.host.files();
  const m = await createSimMachine({ user: 'root', hostname: c.host.name, cwd: String(c.args.chdir ?? '/root') }, { registry: c.registry, id: c.host.name });
  for (const [p, t] of Object.entries(files)) {
    const dir = p.slice(0, p.lastIndexOf('/')) || '/';
    if (!m.rootFs.exists(dir)) m.rootFs.mkdir(dir, { parents: true });
    m.rootFs.writeFile(p, t);
  }
  const r = await m.exec(shell ? cmd : cmd.replace(/([|><;&])/g, '\\$1'));
  const after: Record<string, string> = {};
  for (const root of ['/etc', '/var/www', '/srv', '/opt', '/home', '/tmp', '/root', '/var/log']) {
    const walk = (d: string) => {
      if (!m.rootFs.exists(d)) return;
      for (const e of m.rootFs.readdir(d)) {
        const p = `${d}/${e}`;
        const st = m.rootFs.stat(p);
        if (st?.type === 'd') walk(p);
        else if (st?.type === 'f') after[p] = m.rootFs.readFile(p);
      }
    };
    walk(root);
  }
  for (const [p, t] of Object.entries(after)) if (files[p] !== t && !p.startsWith('/etc/passwd') && !p.startsWith('/etc/group') && p !== '/etc/hostname' && p !== '/etc/shells' && p !== '/etc/os-release' && !p.startsWith('/root/.bashrc')) c.host.write(p, t);
  m.dispose();
  const out = r.out.replace(/\n$/, '');
  return { changed: true, rc: r.exit, stdout: out, stdout_lines: out ? out.split('\n') : [], failed: r.exit !== 0, cmd, ...(r.exit !== 0 ? { msg: 'non-zero return code' } : {}) };
}

// ── playbooks ──

export interface TaskDef {
  name?: string;
  module: string;
  args: Vars;
  raw: Record<string, unknown>;
}

const TASK_KEYS = new Set(['name', 'when', 'loop', 'with_items', 'register', 'notify', 'become', 'become_user', 'changed_when', 'failed_when', 'ignore_errors', 'tags', 'vars', 'listen', 'check_mode', 'diff', 'delegate_to', 'run_once', 'no_log', 'environment', 'args', 'loop_control', 'until', 'retries', 'delay']);

export class PlaybookError extends Error {}

export function taskOf(raw: Record<string, unknown>): TaskDef {
  const keys = Object.keys(raw).filter((k) => !TASK_KEYS.has(k));
  if (!keys.length) throw new PlaybookError(`no module/action detected in task.`);
  if (keys.length > 1) throw new PlaybookError(`conflicting action statements: ${keys.join(', ')}`);
  const name = keys[0];
  const mod = resolveModule(name);
  if (!mod) throw new PlaybookError(`couldn't resolve module/action '${name}'. This often indicates a misspelling, missing collection, or incorrect module path.`);
  let args: Vars = {};
  const v = raw[name];
  if (typeof v === 'string') {
    if (mod === 'command' || mod === 'shell') args = { _raw_params: v, ...((raw.args as Vars) ?? {}) };
    else args = kv(v);
  } else if (v && typeof v === 'object') args = { ...(v as Vars) };
  if ((mod === 'command' || mod === 'shell') && args.cmd !== undefined) args._raw_params = args.cmd;
  return { name: raw.name as string | undefined, module: mod, args: { ...args, ...((raw.args as Vars) ?? {}) }, raw };
}

export interface PlayDef {
  name?: string;
  hosts: string;
  gather_facts?: boolean;
  vars?: Vars;
  tasks?: Record<string, unknown>[];
  handlers?: Record<string, unknown>[];
}

export function parsePlaybook(text: string): PlayDef[] {
  let y: unknown;
  try {
    y = parseYaml(text);
  } catch (e) {
    throw new PlaybookError(`Syntax Error while loading YAML.\n  ${(e as Error).message.split('\n')[0]}`);
  }
  if (!Array.isArray(y)) throw new PlaybookError('A playbook must be a list of plays, got a dict instead');
  for (const p of y as PlayDef[]) {
    if (!p || typeof p !== 'object' || !('hosts' in p)) throw new PlaybookError("the field 'hosts' is required but was not set");
    for (const t of [...(p.tasks ?? []), ...(p.handlers ?? [])]) taskOf(t);
  }
  return y as PlayDef[];
}

// ── the run ──

export type Status = 'ok' | 'changed' | 'failed' | 'skipped' | 'unreachable';

export interface RunRecord {
  playbook: string;
  check: boolean;
  at: number;
  tasks: { task: string; module: string; host: string; status: Status; handler?: boolean }[];
  recap: Record<string, Record<'ok' | 'changed' | 'unreachable' | 'failed' | 'skipped' | 'rescued' | 'ignored', number>>;
}

export interface RunOpts {
  check: boolean;
  diff: boolean;
  limit?: string;
  extraVars: Vars;
  forceHandlers: boolean;
  color: boolean;
  verbose: number;
}

const stars = (s: string) => `${s} ${'*'.repeat(Math.max(3, 79 - s.length))}`;

export async function runPlaybook(
  fs: FsApi,
  inv: Inventory,
  invDir: string,
  plays: PlayDef[],
  base: string,
  o: RunOpts,
  out: (s: string) => void,
  name: string,
  registry?: TerminalRegistry,
): Promise<{ rc: number; record: RunRecord }> {
  const G = (s: string) => (o.color ? `\x1b[32m${s}\x1b[0m` : s);
  const Y = (s: string) => (o.color ? `\x1b[33m${s}\x1b[0m` : s);
  const R = (s: string) => (o.color ? `\x1b[31m${s}\x1b[0m` : s);
  const C = (s: string) => (o.color ? `\x1b[36m${s}\x1b[0m` : s);
  const record: RunRecord = { playbook: name, check: o.check, at: Date.now(), tasks: [], recap: {} };
  const recap = (h: string) => (record.recap[h] ??= { ok: 0, changed: 0, unreachable: 0, failed: 0, skipped: 0, rescued: 0, ignored: 0 });
  const dead = new Set<string>();
  let anyFail = false;
  let unreach = false;
  const limit = o.limit ? new Set(matchHosts(inv, o.limit)) : null;
  for (const play of plays) {
    const all = matchHosts(inv, String(play.hosts)).filter((h) => !limit || limit.has(h));
    out(`\n${stars(`PLAY [${play.name ?? play.hosts}]`)}\n`);
    if (!all.length) {
      out(`${C('skipping: no hosts matched')}\n`);
      continue;
    }
    const vars = new Map<string, Vars>();
    for (const h of all) vars.set(h, { ...hostVars(fs, inv, invDir, h), ...(play.vars ?? {}), ...o.extraVars, ansible_check_mode: o.check });
    const notified = new Map<string, Set<string>>();
    const live = () => all.filter((h) => !dead.has(h));
    const doTask = async (raw: Record<string, unknown>, label: string, handler: boolean, hostsFor: string[]) => {
      const t = taskOf(raw);
      out(`\n${stars(`${handler ? 'RUNNING HANDLER' : 'TASK'} [${label}]`)}\n`);
      for (const h of hostsFor) {
        const host = new Host(fs, h);
        const v = vars.get(h)!;
        const meta = Host.exists(fs, h) ? host.db().meta : null;
        if (!meta || !meta.reachable) {
          const ip = String(v.ansible_host ?? meta?.ip ?? h);
          out(R(`fatal: [${h}]: UNREACHABLE! => {"changed": false, "msg": "Failed to connect to the host via ssh: ${meta ? `ssh: connect to host ${ip} port 22: Connection timed out` : `ssh: Could not resolve hostname ${ip}: Name or service not known`}", "unreachable": true}`) + '\n');
          recap(h).unreachable++;
          record.tasks.push({ task: label, module: t.module, host: h, status: 'unreachable', handler });
          dead.add(h);
          unreach = true;
          continue;
        }
        if (!meta.python && t.module !== 'raw') {
          out(R(`fatal: [${h}]: FAILED! => {"changed": false, "module_stderr": "/bin/sh: 1: /usr/bin/python3: not found\\n", "module_stdout": "", "msg": "The module failed to execute correctly, you probably need to set the interpreter.\\nSee stdout/stderr for the exact error", "rc": 127}`) + '\n');
          recap(h).failed++;
          record.tasks.push({ task: label, module: t.module, host: h, status: 'failed', handler });
          dead.add(h);
          anyFail = true;
          continue;
        }
        const loopSrc = raw.loop ?? raw.with_items;
        let items: unknown[] = [undefined];
        try {
          if (loopSrc !== undefined) {
            const l = typeof loopSrc === 'string' ? render(loopSrc, v) : loopSrc;
            items = Array.isArray(l) ? l : [l];
          }
        } catch (e) {
          out(R(`fatal: [${h}]: FAILED! => {"msg": "${(e as Error).message}"}`) + '\n');
          recap(h).failed++;
          dead.add(h);
          anyFail = true;
          continue;
        }
        let hostChanged = false;
        let hostFailed = false;
        let allSkipped = true;
        const results: ModResult[] = [];
        for (const item of items) {
          const iv = item === undefined ? v : { ...v, item };
          const tag = item === undefined ? '' : ` => (item=${typeof item === 'object' ? JSON.stringify(item) : item})`;
          try {
            if (raw.when !== undefined && !evalWhen(raw.when, iv)) {
              out(C(`skipping: [${h}]${tag}`) + '\n');
              results.push({ changed: false, skipped: true });
              continue;
            }
          } catch (e) {
            out(R(`fatal: [${h}]: FAILED! => {"msg": "The conditional check '${raw.when}' failed. The error was: error while evaluating conditional (${raw.when}): ${(e as Error).message}"}`) + '\n');
            hostFailed = true;
            break;
          }
          allSkipped = false;
          let args: Vars;
          try {
            args = Object.fromEntries(Object.entries(t.args).map(([k, a]) => [k, typeof a === 'string' ? render(a, iv) : a]));
          } catch (e) {
            const msg = e instanceof JinjaError ? `The task includes an option with an undefined variable. The error was: ${e.message}` : (e as Error).message;
            out(R(`fatal: [${h}]: FAILED! => {"msg": ${JSON.stringify(msg)}}`) + '\n');
            hostFailed = true;
            break;
          }
          const res = await MODULES[t.module]({ host, args, check: o.check || raw.check_mode === true, base, ctlFs: fs, vars: iv, registry });
          if (raw.changed_when !== undefined) res.changed = evalWhen(raw.changed_when, { ...iv, ...res, result: res });
          if (raw.failed_when !== undefined) res.failed = evalWhen(raw.failed_when, { ...iv, ...res, result: res });
          results.push(res);
          if (o.diff && res.diff && res.changed) out(`--- before: ${res.diff.path}\n+++ after: ${res.diff.path}\n${unifiedHunks(res.diff.before, res.diff.after)}\n`);
          const json = (r: ModResult) => {
            const { diff: _d, ...rest } = r;
            void _d;
            return JSON.stringify(rest);
          };
          if (res.failed) {
            out(R(`fatal: [${h}]: FAILED! => ${json(res)}`) + '\n');
            if (raw.ignore_errors) out(C('...ignoring') + '\n');
            hostFailed = !raw.ignore_errors;
            if (raw.ignore_errors) recap(h).ignored++;
            if (hostFailed) break;
            continue;
          }
          if (res.skipped) {
            out(C(`skipping: [${h}]${tag}`) + '\n');
            continue;
          }
          if (t.module === 'debug') {
            out(G(`ok: [${h}]${tag} => ${JSON.stringify({ ...(res.msg !== undefined ? { msg: res.msg } : Object.fromEntries(Object.entries(res).filter(([k]) => k !== 'changed'))) }, null, 4).replace(/\n/g, '\n')}`) + '\n');
            continue;
          }
          if (res.changed) hostChanged = true;
          const shown = o.verbose && (t.module === 'command' || t.module === 'shell') ? ` => ${json(res)}` : '';
          out((res.changed ? Y(`changed: [${h}]${tag}${shown}`) : G(`ok: [${h}]${tag}${shown}`)) + '\n');
        }
        const status: Status = hostFailed ? 'failed' : allSkipped || results.every((r) => r.skipped) ? 'skipped' : hostChanged ? 'changed' : 'ok';
        record.tasks.push({ task: label, module: t.module, host: h, status, handler });
        if (raw.register) {
          const reg = items.length > 1 || loopSrc !== undefined ? { changed: hostChanged, results } : { ...(results[0] ?? { changed: false }), changed: hostChanged };
          v[String(raw.register)] = reg;
        }
        if (status === 'failed') {
          recap(h).failed++;
          dead.add(h);
          anyFail = true;
          continue;
        }
        if (status === 'skipped') recap(h).skipped++;
        else {
          recap(h).ok++;
          if (status === 'changed') recap(h).changed++;
        }
        if (status === 'changed' && raw.notify && !handler) {
          for (const n of list(raw.notify)) {
            if (!notified.has(n)) notified.set(n, new Set());
            notified.get(n)!.add(h);
          }
        }
      }
    };
    try {
      if (play.gather_facts !== false) {
        out(`\n${stars('TASK [Gathering Facts]')}\n`);
        for (const h of live()) {
          const meta = Host.exists(fs, h) ? new Host(fs, h).db().meta : null;
          if (!meta || !meta.reachable) {
            const ip = String(vars.get(h)!.ansible_host ?? meta?.ip ?? h);
            out(R(`fatal: [${h}]: UNREACHABLE! => {"changed": false, "msg": "Failed to connect to the host via ssh: ${meta ? `ssh: connect to host ${ip} port 22: Connection timed out` : `ssh: Could not resolve hostname ${ip}: Name or service not known`}", "unreachable": true}`) + '\n');
            recap(h).unreachable++;
            dead.add(h);
            unreach = true;
            continue;
          }
          if (!meta.python) {
            out(R(`fatal: [${h}]: FAILED! => {"ansible_facts": {}, "changed": false, "failed_modules": {"ansible.legacy.setup": {"failed": true, "module_stderr": "/bin/sh: 1: /usr/bin/python3: not found\\n", "msg": "The module failed to execute correctly, you probably need to set the interpreter.\\nSee stdout/stderr for the exact error", "rc": 127}}, "msg": "The following modules failed to execute: ansible.legacy.setup\\n"}`) + '\n');
            recap(h).failed++;
            dead.add(h);
            anyFail = true;
            continue;
          }
          Object.assign(vars.get(h)!, factsOf(new Host(fs, h)));
          out(G(`ok: [${h}]`) + '\n');
          recap(h).ok++;
        }
      }
      for (const raw of play.tasks ?? []) {
        const hs = live();
        if (!hs.length) break;
        const t = taskOf(raw);
        await doTask(raw, t.name ?? `${t.module}`, false, hs);
      }
    } finally {
      // Handlers: once, at the end of the play, on hosts that notified them (and are alive, unless forced).
      for (const hraw of play.handlers ?? []) {
        const hname = String(hraw.name ?? '');
        const listen = list(hraw.listen);
        const hosts = new Set<string>();
        for (const n of [hname, ...listen]) for (const h of notified.get(n) ?? []) hosts.add(h);
        const run = [...hosts].filter((h) => o.forceHandlers || !dead.has(h));
        if (run.length) await doTask(hraw, hname, true, run);
      }
    }
  }
  out(`\n${stars('PLAY RECAP')}\n`);
  for (const [h, r] of Object.entries(record.recap)) {
    const col = r.failed || r.unreachable ? R : r.changed ? Y : G;
    out(`${col(h.padEnd(26))} : ${G(`ok=${r.ok}`)}    ${(r.changed ? Y : (s: string) => s)(`changed=${r.changed}`)}    ${(r.unreachable ? R : (s: string) => s)(`unreachable=${r.unreachable}`)}    ${(r.failed ? R : (s: string) => s)(`failed=${r.failed}`)}    skipped=${r.skipped}    rescued=${r.rescued}    ignored=${r.ignored}   \n`);
  }
  out('\n');
  return { rc: unreach ? 4 : anyFail ? 2 : 0, record };
}
