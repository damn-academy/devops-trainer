// systemd on the simulated machine: unit files on disk, the loaded
// configuration, unit states, Restart=/StartLimit*= behaviour, one cgroup per
// service with MemoryMax=/TasksMax=/CPUQuota=, and the journal.
//
// The rules follow systemd.service(5), systemd.unit(5), systemd.exec(5) and
// systemd.resource-control(5) of systemd 257 (Debian 13): Restart=no by
// default, RestartSec=100ms, StartLimitIntervalSec=10s, StartLimitBurst=5;
// on-failure restarts on a non-zero code, an unclean signal, a timeout;
// on-abnormal on a signal or timeout but not on a non-zero code.

import type { Snapshotable } from '../../core/types';
import { CAP_FULL, capBit, capHex, type KProc } from './kernel';
import { PROGRAMS, isBgError, type RunAs, type ServiceCtx, type SimMachine } from './shell';
import { ROOT_CRED } from './vfs';

export interface JournalEntry {
  at: number;
  ident: string;
  pid: number;
  msg: string;
  unit?: string;
  /** syslog priority: 3 err, 4 warning, 5 notice, 6 info. */
  prio: number;
  boot: number;
  kernel?: boolean;
}

export interface UnitConfig {
  name: string;
  path: string;
  hash: string;
  description: string;
  type: 'simple' | 'exec' | 'oneshot' | 'forking' | 'notify';
  execStart: string;
  user?: string;
  workingDirectory?: string;
  restart: 'no' | 'on-success' | 'on-failure' | 'on-abnormal' | 'on-abort' | 'on-watchdog' | 'always';
  restartSec: number;
  startLimitBurst: number;
  startLimitIntervalSec: number;
  timeoutStopSec: number;
  wantedBy: string[];
  after: string[];
  wants: string[];
  props: Record<string, string>;
  dropIns: string[];
  hasInstall: boolean;
  remainAfterExit: boolean;
}

export interface UnitState {
  name: string;
  active: 'active' | 'inactive' | 'failed' | 'activating' | 'deactivating';
  sub: 'running' | 'dead' | 'failed' | 'exited' | 'auto-restart';
  result: 'success' | 'exit-code' | 'signal' | 'core-dump' | 'start-limit-hit' | 'oom-kill' | 'resources' | 'timeout';
  mainPid: number;
  since: number;
  nRestarts: number;
  starts: number[];
  exec?: { pid: number; code: 'exited' | 'killed' | 'dumped'; status: string; cmd: string };
  restartAt?: number;
  config?: UnitConfig;
  stopping?: boolean;
  cpuMs: number;
}

interface SystemdSnapshot {
  units: UnitState[];
  journal: JournalEntry[];
  boot: number;
}

const UNIT_DIRS = ['/etc/systemd/system', '/run/systemd/system', '/usr/lib/systemd/system'];

export function parseDuration(v: string | undefined, def: number): number {
  if (v === undefined || v.trim() === '') return def;
  const s = v.trim();
  if (s === 'infinity') return Infinity;
  let total = 0;
  let matched = false;
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*(ms|msec|s|sec|m|min|h|hr)?/g)) {
    matched = true;
    const n = Number(m[1]);
    const u = m[2] ?? 's';
    total += n * ({ ms: 1, msec: 1, s: 1000, sec: 1000, m: 60000, min: 60000, h: 3600000, hr: 3600000 }[u] ?? 1000);
  }
  return matched ? total : def;
}

/** Parse an INI unit file plus drop-ins into sections (later assignments win; an empty one resets lists). */
export function parseUnitText(texts: string[]): Record<string, Record<string, string[]>> {
  const out: Record<string, Record<string, string[]>> = {};
  for (const text of texts) {
    let sec = '';
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || line.startsWith(';')) continue;
      const sm = /^\[(.+)\]$/.exec(line);
      if (sm) {
        sec = sm[1];
        out[sec] ??= {};
        continue;
      }
      const eq = line.indexOf('=');
      if (eq < 0 || !sec) continue;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim();
      const list = (out[sec][k] ??= []);
      if (v === '') list.length = 0;
      else list.push(v);
    }
  }
  return out;
}

const hashText = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
};

export class Systemd implements Snapshotable {
  units = new Map<string, UnitState>();
  journal: JournalEntry[] = [];
  bootId = 1;

  /** While replaying due restarts, the time of the restart being replayed. */
  private clock: number | undefined;

  constructor(private m: SimMachine) {}

  private now(): number {
    return this.clock ?? this.m.now();
  }

  // ── journal ──
  log(ident: string, pid: number, msg: string, o: { unit?: string; prio?: number; kernel?: boolean } = {}): void {
    this.journal.push({ at: this.now(), ident, pid, msg, unit: o.unit, prio: o.prio ?? 6, boot: this.bootId, kernel: o.kernel });
    if (this.journal.length > 3000) this.journal.splice(0, 500);
  }

  private sys(unit: string, msg: string, prio = 6): void {
    this.log('systemd', 1, msg, { unit, prio });
  }

  // ── names and files ──
  static normalize(name: string): string {
    return /\.(service|target|timer|socket|mount|slice|scope|path)$/.test(name) ? name : `${name}.service`;
  }

  findFile(name: string): string | null {
    for (const d of UNIT_DIRS) {
      const p = `${d}/${name}`;
      if (this.m.vfs.statAs(p, ROOT_CRED)) return p;
    }
    return null;
  }

  dropInsOf(name: string): string[] {
    const out: string[] = [];
    for (const d of UNIT_DIRS) {
      const dir = `${d}/${name}.d`;
      try {
        for (const f of this.m.vfs.readdirAs(dir, ROOT_CRED)) if (f.endsWith('.conf')) out.push(`${dir}/${f}`);
      } catch {
        /* no drop-ins */
      }
    }
    return out.sort();
  }

  /** Read and parse a unit from disk (what daemon-reload does). */
  readConfig(name: string): UnitConfig | null {
    const path = this.findFile(name);
    if (!path) return null;
    const dropIns = this.dropInsOf(name);
    const texts = [path, ...dropIns].map((p) => {
      try {
        return this.m.vfs.readFileAs(p, ROOT_CRED);
      } catch {
        return '';
      }
    });
    const ini = parseUnitText(texts);
    const last = (sec: string, k: string) => ini[sec]?.[k]?.[ini[sec][k].length - 1];
    const all = (sec: string, k: string) => (ini[sec]?.[k] ?? []).flatMap((v) => v.split(/\s+/)).filter(Boolean);
    const props: Record<string, string> = {};
    for (const sec of ['Unit', 'Service', 'Install']) for (const [k, v] of Object.entries(ini[sec] ?? {})) if (v.length) props[k] = v.join(' ');
    const restart = (last('Service', 'Restart') ?? 'no') as UnitConfig['restart'];
    return {
      name,
      path,
      hash: hashText(texts.join('\u0000')),
      description: last('Unit', 'Description') ?? '',
      type: (last('Service', 'Type') ?? 'simple') as UnitConfig['type'],
      execStart: last('Service', 'ExecStart') ?? '',
      user: last('Service', 'User'),
      workingDirectory: last('Service', 'WorkingDirectory'),
      restart: ['no', 'on-success', 'on-failure', 'on-abnormal', 'on-abort', 'on-watchdog', 'always'].includes(restart) ? restart : 'no',
      restartSec: parseDuration(last('Service', 'RestartSec'), 100),
      startLimitBurst: Number(last('Unit', 'StartLimitBurst') ?? last('Service', 'StartLimitBurst') ?? 5),
      startLimitIntervalSec: parseDuration(last('Unit', 'StartLimitIntervalSec') ?? last('Service', 'StartLimitInterval'), 10000),
      timeoutStopSec: parseDuration(last('Service', 'TimeoutStopSec'), 90000),
      wantedBy: all('Install', 'WantedBy'),
      after: all('Unit', 'After'),
      wants: all('Unit', 'Wants'),
      props,
      dropIns,
      hasInstall: !!(ini.Install && (ini.Install.WantedBy?.length || ini.Install.RequiredBy?.length || ini.Install.Alias?.length)),
      remainAfterExit: /^(yes|true|1)$/i.test(last('Service', 'RemainAfterExit') ?? ''),
    };
  }

  state(name: string): UnitState {
    let s = this.units.get(name);
    if (!s) {
      s = { name, active: 'inactive', sub: 'dead', result: 'success', mainPid: 0, since: this.now(), nRestarts: 0, starts: [], cpuMs: 0 };
      this.units.set(name, s);
    }
    return s;
  }

  /** The configuration in memory; loaded from disk on first use, like systemd does for unknown units. */
  config(name: string): UnitConfig | null {
    const s = this.units.get(name);
    if (s?.config) return s.config;
    const c = this.readConfig(name);
    if (c) this.state(name).config = c;
    return c;
  }

  /** Did the unit file change on disk since it was loaded? */
  changedOnDisk(name: string): boolean {
    const s = this.units.get(name);
    if (!s?.config) return false;
    const fresh = this.readConfig(name);
    return !!fresh && fresh.hash !== s.config.hash;
  }

  daemonReload(): void {
    for (const [name, s] of this.units) {
      const c = this.readConfig(name);
      if (c) s.config = c;
      else if (s.active === 'inactive' || s.active === 'failed') this.units.delete(name);
    }
    this.sys('', 'Reloading requested from client PID 1 (systemctl)...');
    this.sys('', 'Reloading finished in 112 ms.');
  }

  enabledState(name: string): 'enabled' | 'disabled' | 'static' | 'not-found' | 'generated' {
    const c = this.config(name) ?? this.readConfig(name);
    if (!c) return 'not-found';
    for (const t of c.wantedBy.length ? c.wantedBy : ['multi-user.target']) {
      if (this.m.vfs.statAs(`/etc/systemd/system/${t}.wants/${name}`, ROOT_CRED, false)) return 'enabled';
    }
    return c.hasInstall ? 'disabled' : 'static';
  }

  enable(name: string): { ok: boolean; lines: string[] } {
    const c = this.readConfig(name);
    if (!c) return { ok: false, lines: [`Failed to enable unit: Unit ${name} does not exist`] };
    if (!c.hasInstall) {
      return {
        ok: true,
        lines: [
          'The unit files have no installation config (WantedBy=, RequiredBy=, UpheldBy=,',
          'Also=, or Alias= settings in the [Install] section, and DefaultInstance= for',
          'template units). This means they are not meant to be enabled or disabled using systemctl.',
        ],
      };
    }
    const lines: string[] = [];
    for (const t of c.wantedBy) {
      const dir = `/etc/systemd/system/${t}.wants`;
      const link = `${dir}/${name}`;
      if (!this.m.vfs.statAs(dir, ROOT_CRED)) this.m.vfs.mkdirAs(dir, ROOT_CRED, { parents: true });
      if (this.m.vfs.statAs(link, ROOT_CRED, false)) continue;
      this.m.vfs.symlinkAs(c.path, link, ROOT_CRED);
      lines.push(`Created symlink '${link}' → '${c.path}'.`);
    }
    return { ok: true, lines };
  }

  disable(name: string): string[] {
    const lines: string[] = [];
    const c = this.readConfig(name);
    for (const t of c?.wantedBy.length ? c.wantedBy : ['multi-user.target']) {
      const link = `/etc/systemd/system/${t}.wants/${name}`;
      if (this.m.vfs.statAs(link, ROOT_CRED, false)) {
        this.m.vfs.unlinkAs(link, ROOT_CRED);
        lines.push(`Removed '${link}'.`);
      }
    }
    return lines;
  }

  // ── running units ──

  private cgroupOf(name: string): string {
    return `/system.slice/${name}`;
  }

  private setupCgroup(c: UnitConfig): string {
    const cg = this.cgroupOf(c.name);
    this.m.kernel.mkCgroup(`/sys/fs/cgroup${cg}`);
    const w = (file: string, v: string) => this.m.vfs.writeFileAs(`/sys/fs/cgroup${cg}/${file}`, v + '\n', ROOT_CRED);
    const saved = this.m.vfs.hooks.beforeWrite;
    this.m.vfs.hooks.beforeWrite = undefined;
    try {
      const mem = c.props.MemoryMax;
      w('memory.max', mem && mem !== 'infinity' ? String(memBytes(mem)) : 'max');
      const high = c.props.MemoryHigh;
      w('memory.high', high && high !== 'infinity' ? String(memBytes(high)) : 'max');
      const tasks = c.props.TasksMax;
      w('pids.max', tasks && tasks !== 'infinity' ? tasks : 'max');
      const quota = c.props.CPUQuota;
      w('cpu.max', quota ? `${Math.round(parseFloat(quota) * 1000)} 100000` : 'max 100000');
    } finally {
      this.m.vfs.hooks.beforeWrite = saved;
    }
    return cg;
  }

  private runAs(c: UnitConfig): RunAs | { error: string } {
    const user = this.m.users.find((u) => u.name === (c.user ?? 'root'));
    if (!user) return { error: 'user' };
    let caps = user.uid === 0 ? CAP_FULL : 0n;
    if (c.props.CapabilityBoundingSet && user.uid === 0) {
      let b = 0n;
      for (const n of c.props.CapabilityBoundingSet.split(/\s+/)) b |= capBit(n) ?? 0n;
      caps &= b;
    }
    if (c.props.AmbientCapabilities) for (const n of c.props.AmbientCapabilities.split(/\s+/)) caps |= capBit(n) ?? 0n;
    return { user, capEff: capHex(caps) };
  }

  /** Split ExecStart into argv; the leading "-", "@", "+" prefixes are dropped. */
  private argvOf(exec: string): string[] {
    const words = exec.replace(/^[-@+!:]+/, '').match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
    return words.map((w) => w.replace(/^["']|["']$/g, ''));
  }

  /** Start the main process. Returns false when the process is not running afterwards. */
  private async launch(s: UnitState, c: UnitConfig): Promise<void> {
    const now = this.now();
    s.starts = s.starts.filter((t) => now - t < c.startLimitIntervalSec);
    s.starts.push(now);
    if (s.starts.length > c.startLimitBurst) {
      s.active = 'failed';
      s.sub = 'failed';
      s.result = 'start-limit-hit';
      s.restartAt = undefined;
      s.since = now;
      this.sys(c.name, `${c.name}: Start request repeated too quickly.`, 4);
      this.sys(c.name, `${c.name}: Failed with result 'start-limit-hit'.`, 4);
      this.sys(c.name, `Failed to start ${label(c)}.`, 3);
      return;
    }
    const argv = this.argvOf(c.execStart);
    const fail = (status: string, msgs: string[], pid: number) => {
      for (const msg of msgs) this.log('(' + (argv[0]?.split('/').pop() ?? c.name) + ')', pid, msg, { unit: c.name, prio: 3 });
      s.exec = { pid, code: 'exited', status, cmd: c.execStart };
      this.mainExited(s, c, Number(status.split('/')[0]), undefined);
    };
    s.active = 'activating';
    s.sub = 'running';
    s.result = 'success';
    s.since = now;
    const pidGuess = this.m.procs.next;
    if (!argv.length) {
      this.sys(c.name, `${c.name}: Service has no ExecStart=, ExecStop=, or SuccessAction=. Refusing.`, 3);
      s.active = 'failed';
      s.sub = 'failed';
      s.result = 'resources';
      return;
    }
    const as = this.runAs(c);
    if ('error' in as) {
      fail('217/USER', [`${c.name}: Failed to determine user credentials: No such process`, `${c.name}: Failed at step USER spawning ${argv[0]}: No such process`], pidGuess);
      return;
    }
    let path = argv[0];
    if (!path.startsWith('/')) {
      const found = ['/usr/local/sbin', '/usr/local/bin', '/usr/sbin', '/usr/bin'].map((d) => `${d}/${path}`).find((p) => this.m.vfs.statAs(p, ROOT_CRED));
      if (!found) {
        fail('203/EXEC', [`${c.name}: Failed to locate executable ${path}: No such file or directory`, `${c.name}: Failed at step EXEC spawning ${path}: No such file or directory`], pidGuess);
        return;
      }
      path = found;
    }
    const fs = this.m.fsFor(as.user, () => '/', '/', as.capEff);
    const st = this.m.vfs.statAs(path, ROOT_CRED);
    if (!st) {
      fail('203/EXEC', [`${c.name}: Failed to locate executable ${path}: No such file or directory`, `${c.name}: Failed at step EXEC spawning ${path}: No such file or directory`], pidGuess);
      return;
    }
    if (!fs.access(path, 'x') || st.type !== 'f') {
      fail('203/EXEC', [`${c.name}: Failed at step EXEC spawning ${path}: Permission denied`], pidGuess);
      return;
    }
    if (c.workingDirectory && !this.m.vfs.statAs(c.workingDirectory.replace(/^-/, ''), ROOT_CRED)) {
      fail('200/CHDIR', [`${c.name}: Changing to the requested working directory failed: No such file or directory`, `${c.name}: Failed at step CHDIR spawning ${path}: No such file or directory`], pidGuess);
      return;
    }
    const cg = this.setupCgroup(c);
    const text = this.m.vfs.readFileAs(path, ROOT_CRED);
    const stub = /^#!\/usr\/bin\/sim\n# (\S+):/.exec(text)?.[1];
    const cwd = c.workingDirectory?.replace(/^-/, '') ?? '/';
    const extra: Partial<KProc> = { cgroup: cg, unit: c.name, seccomp: c.props.SystemCallFilter ? 2 : 0, tty: '?' };
    const startDaemon = (dargv: string[], pid?: number): boolean => {
      const name = dargv[0].split('/').pop()!;
      const spec = PROGRAMS.get(name);
      if (!spec?.daemon && !spec?.background) return false;
      const mainPid = pid ?? this.m.forkRaw({ cmd: name, argv: dargv, uid: as.user.uid, ppid: 1, capEff: as.capEff, ...extra });
      const p = this.m.procs.get(mainPid) as KProc;
      if (pid) {
        p.cmd = name.slice(0, 15);
        p.argv = dargv;
      }
      if (spec.daemon) {
        const r = spec.daemon(dargv, this.m, as, c.name);
        for (const l of r.logs) this.log(name, mainPid, l, { unit: c.name, prio: r.ok ? 6 : 3 });
        if (!r.ok) {
          s.exec = { pid: mainPid, code: 'exited', status: `${r.exit ?? 1}/FAILURE`, cmd: c.execStart };
          this.m.procs.table.delete(mainPid);
          this.mainExited(s, c, r.exit ?? 1, undefined);
          return true;
        }
        p.listen = r.listen;
        if (r.rss) p.rss = r.rss;
        if (r.threads) p.threads = r.threads;
        if (r.ignores) p.ignores = r.ignores;
        for (const ch of r.children ?? []) this.m.forkRaw({ cmd: ch.cmd, argv: ch.argv, uid: ch.uid ?? as.user.uid, ppid: mainPid, capEff: as.capEff, ...extra, rss: 3200 });
      } else if (spec.background) {
        const r = spec.background(dargv, this.m, as);
        if (isBgError(r)) {
          this.log(name, mainPid, r.error.trim(), { unit: c.name, prio: 3 });
          this.m.procs.table.delete(mainPid);
          s.exec = { pid: mainPid, code: 'exited', status: `${r.exit}/FAILURE`, cmd: c.execStart };
          this.mainExited(s, c, r.exit, undefined);
          return true;
        }
        Object.assign(p, r, { cgroup: cg, unit: c.name });
        if (r.until !== undefined) p.until = this.now() + (r.until as number);
      }
      s.mainPid = mainPid;
      s.active = 'active';
      s.sub = 'running';
      s.since = this.now();
      this.sys(c.name, `Started ${label(c)}.`);
      return true;
    };
    if (stub && startDaemon([path, ...argv.slice(1)])) return;
    // A script or a short program: run it now, its output goes to the journal.
    const ident = path.split('/').pop()!;
    const pid = this.m.forkRaw({ cmd: ident, argv: [path, ...argv.slice(1)], uid: as.user.uid, ppid: 1, capEff: as.capEff, ...extra });
    s.mainPid = pid;
    if (c.type !== 'oneshot') {
      s.active = 'active';
      this.sys(c.name, `Started ${label(c)}.`);
    } else this.sys(c.name, `Starting ${label(c)}...`);
    const service: ServiceCtx = { unit: c.name };
    let buf = '';
    const sink = (t: string) => {
      buf += t;
      const lines = buf.split('\n');
      buf = lines.pop()!;
      for (const l of lines) this.log(ident, pid, l, { unit: c.name });
    };
    let code: number;
    if (stub) {
      const ctxLike = { out: sink, err: sink };
      code = await this.m.runLineAs([path, ...argv.slice(1)].map(shq).join(' '), as, { ...ctxLike, cwd, service, ppid: pid });
    } else code = await this.m.runScript(text, [path, ...argv.slice(1)], { writeOut: sink, writeErr: sink, cwd, as, service, ppid: pid });
    if (buf) this.log(ident, pid, buf, { unit: c.name });
    if (!this.m.procs.get(pid)) return; // killed meanwhile (OOM): mainExited already ran
    if (service.daemon && startDaemon(service.daemon, pid)) return;
    s.exec = { pid, code: 'exited', status: code === 0 ? '0/SUCCESS' : `${code}/${code === 1 ? 'FAILURE' : code === 2 ? 'INVALIDARGUMENT' : 'FAILURE'}`, cmd: c.execStart };
    this.m.procs.table.delete(pid);
    this.m.emit({ t: 'proc.exit', pid, code, reason: 'exit' });
    this.mainExited(s, c, code, undefined);
  }

  /** The main process is gone: decide between inactive, failed and a scheduled restart. */
  mainExited(s: UnitState, c: UnitConfig, code: number, sig: string | undefined, oom = false): void {
    const now = this.now();
    for (const p of this.m.kernel.procsIn(this.cgroupOf(c.name), false)) if (p.pid !== s.mainPid) this.m.procs.table.delete(p.pid);
    s.mainPid = 0;
    if (s.stopping) {
      s.stopping = false;
      s.active = 'inactive';
      s.sub = 'dead';
      s.result = 'success';
      s.since = now;
      this.sys(c.name, `${c.name}: Deactivated successfully.`);
      this.sys(c.name, `Stopped ${label(c)}.`);
      return;
    }
    const clean = sig ? ['HUP', 'INT', 'TERM', 'PIPE'].includes(sig) : code === 0;
    const success = !sig && code === 0;
    if (oom) {
      this.sys(c.name, `${c.name}: A process of this unit has been killed by the OOM killer.`, 4);
    }
    if (sig) this.sys(c.name, `${c.name}: Main process exited, code=killed, status=${sigNo(sig)}/${sig}`, success ? 6 : 5);
    else if (!success) this.sys(c.name, `${c.name}: Main process exited, code=exited, status=${code}/${code === 203 ? 'EXEC' : code === 217 ? 'USER' : code === 200 ? 'CHDIR' : 'FAILURE'}`, 5);
    s.result = success ? 'success' : oom ? 'oom-kill' : sig ? 'signal' : 'exit-code';
    if (!success && !clean) this.sys(c.name, `${c.name}: Failed with result '${s.result}'.`, 4);
    else if (sig && clean) {
      this.sys(c.name, `${c.name}: Failed with result 'signal'.`, 4);
    }
    const restart =
      c.restart === 'always' ||
      (c.restart === 'on-success' && success) ||
      (c.restart === 'on-failure' && !success && !(sig && clean)) ||
      (c.restart === 'on-abnormal' && !!sig && !clean) ||
      (c.restart === 'on-abort' && !!sig && ['ABRT', 'SEGV', 'QUIT'].includes(sig));
    if (restart) {
      s.active = 'activating';
      s.sub = 'auto-restart';
      s.restartAt = now + c.restartSec;
      s.since = now;
      return;
    }
    s.since = now;
    if (success) {
      s.active = c.type === 'oneshot' && c.remainAfterExit ? 'active' : 'inactive';
      s.sub = c.type === 'oneshot' && c.remainAfterExit ? 'exited' : 'dead';
      if (c.type === 'oneshot') this.sys(c.name, `Finished ${label(c)}.`);
      this.sys(c.name, `${c.name}: Deactivated successfully.`);
    } else {
      s.active = 'failed';
      s.sub = 'failed';
      if (sig && clean) s.result = 'signal';
    }
  }

  /** Called by the machine whenever a process leaves the table. */
  onExit(p: KProc, code: number, sig?: string, reason?: string): void {
    for (const s of this.units.values()) {
      if (s.mainPid !== p.pid || !s.config) continue;
      s.exec = { pid: p.pid, code: sig ? 'killed' : 'exited', status: sig ? `${sigNo(sig)}/${sig}` : `${code}/${code ? 'FAILURE' : 'SUCCESS'}`, cmd: s.config.execStart };
      this.mainExited(s, s.config, code, sig, reason === 'oom' || this.oomRecent(p.pid));
    }
  }

  private oomRecent(pid: number): boolean {
    return this.m.kernel.dmesg.slice(-3).some((d) => d.msg.includes(`Killed process ${pid} `));
  }

  /** Process due restarts (async: a unit's main program may be a script). */
  async settle(): Promise<void> {
    for (let guard = 0; guard < 60; guard++) {
      const now = this.m.now();
      const due = [...this.units.values()].filter((s) => s.restartAt !== undefined && s.restartAt <= now).sort((a, b) => a.restartAt! - b.restartAt!)[0];
      if (!due || !due.config) return;
      const at = due.restartAt!;
      due.restartAt = undefined;
      this.clock = at;
      try {
        due.nRestarts++;
        this.sys(due.name, `${due.name}: Scheduled restart job, restart counter is at ${due.nRestarts}.`);
        this.sys(due.name, `Stopped ${label(due.config)}.`);
        await this.launch(due, due.config);
      } finally {
        this.clock = undefined;
      }
    }
  }

  /** Sync part of the timers: nothing to do now, restarts need settle(). */
  tick(now: number): void {
    void now;
  }

  async start(name: string): Promise<{ ok: boolean; lines: string[] }> {
    const c = this.config(name);
    if (!c) return { ok: false, lines: [`Failed to start ${name}: Unit ${name} not found.`] };
    const lines: string[] = [];
    if (this.changedOnDisk(name)) lines.push(`Warning: The unit file, source configuration file or drop-ins of ${name} changed on disk. Run 'systemctl daemon-reload' to reload units.`);
    const s = this.state(name);
    if (s.active === 'active' || (s.active === 'activating' && s.sub !== 'auto-restart')) return { ok: true, lines };
    if (s.result === 'start-limit-hit' && s.active === 'failed') {
      lines.push(
        `Job for ${name} failed because the service was attempted to start too often.`,
        `See "systemctl status ${name}" and "journalctl -xeu ${name}" for details.`,
        `To force a start use "systemctl reset-failed ${name}"`,
        `followed by "systemctl start ${name}" again.`,
      );
      return { ok: false, lines };
    }
    s.restartAt = undefined;
    await this.launch(s, c);
    if (c.type === 'oneshot' && s.active === 'failed') {
      lines.push(`Job for ${name} failed because the control process exited with error code.`, `See "systemctl status ${name}" and "journalctl -xeu ${name}" for details.`);
      return { ok: false, lines };
    }
    if ((c.type === 'exec' || /^20\d\/|^21\d\//.test(s.exec?.status ?? '')) && s.active === 'failed' && s.exec?.status.match(/^2\d\d\//)) {
      lines.push(`Job for ${name} failed because the control process exited with error code.`, `See "systemctl status ${name}" and "journalctl -xeu ${name}" for details.`);
      return { ok: false, lines };
    }
    return { ok: true, lines };
  }

  stop(name: string): { ok: boolean; lines: string[] } {
    const c = this.config(name);
    const s = this.units.get(name);
    if (!c) return { ok: false, lines: [`Failed to stop ${name}: Unit ${name} not loaded.`] };
    if (!s || !s.mainPid) {
      if (s) {
        s.restartAt = undefined;
        if (s.active !== 'failed') {
          s.active = 'inactive';
          s.sub = 'dead';
        }
      }
      return { ok: true, lines: [] };
    }
    this.sys(name, `Stopping ${label(c)}...`);
    s.stopping = true;
    s.restartAt = undefined;
    const main = this.m.procs.get(s.mainPid) as KProc | undefined;
    if (main?.ignores?.includes('TERM')) {
      this.m.advance(Math.min(c.timeoutStopSec, 90000));
      this.sys(name, `${name}: State 'stop-sigterm' timed out. Killing.`, 4);
      this.sys(name, `${name}: Killing process ${s.mainPid} (${main.cmd}) with signal SIGKILL.`, 4);
      this.m.procs.kill(s.mainPid, 'KILL');
    } else this.m.procs.kill(s.mainPid, 'TERM');
    if (this.units.get(name)?.mainPid) this.mainExited(s, c, 0, 'TERM');
    return { ok: true, lines: [] };
  }

  async restart(name: string): Promise<{ ok: boolean; lines: string[] }> {
    const s = this.units.get(name);
    if (s?.mainPid) this.stop(name);
    if (s) {
      s.result = 'success';
      if (s.active === 'failed') s.active = 'inactive';
    }
    return this.start(name);
  }

  resetFailed(name?: string): void {
    for (const s of this.units.values()) {
      if (name && s.name !== name) continue;
      s.starts = [];
      if (s.active === 'failed') {
        s.active = 'inactive';
        s.sub = 'dead';
        s.result = 'success';
      }
    }
  }

  // ── boot and reboot ──

  /** Base system units and their files (Debian 13). */
  boot(): void {
    const unit = (name: string, text: string, enable = true) => {
      const p = `/usr/lib/systemd/system/${name}`;
      if (!this.m.vfs.statAs(p, ROOT_CRED)) this.m.vfs.writeFileAs(p, text, ROOT_CRED);
      if (enable) {
        const link = `/etc/systemd/system/multi-user.target.wants/${name}`;
        if (!this.m.vfs.statAs(link, ROOT_CRED, false)) this.m.vfs.symlinkAs(p, link, ROOT_CRED);
      }
    };
    unit('systemd-journald.service', '[Unit]\nDescription=Journal Service\nDefaultDependencies=no\n\n[Service]\nType=notify\nExecStart=/usr/lib/systemd/systemd-journald\nRestart=always\nRestartSec=0\n', false);
    unit('cron.service', '[Unit]\nDescription=Regular background program processing daemon\nDocumentation=man:cron(8)\nAfter=remote-fs.target nss-user-lookup.target\n\n[Service]\nEnvironmentFile=-/etc/default/cron\nExecStart=/usr/sbin/cron -f $EXTRA_OPTS\nIgnoreSIGPIPE=false\nKillMode=process\nRestart=on-failure\nSyslogFacility=cron\n\n[Install]\nWantedBy=multi-user.target\n');
    unit('ssh.service', '[Unit]\nDescription=OpenBSD Secure Shell server\nDocumentation=man:sshd(8) man:sshd_config(5)\nAfter=network.target auditd.service\n\n[Service]\nExecStartPre=/usr/sbin/sshd -t\nExecStart=/usr/sbin/sshd -D $SSHD_OPTS\nExecReload=/bin/kill -HUP $MAINPID\nKillMode=process\nRestart=on-failure\nRestartPreventExitStatus=255\nType=notify\nRuntimeDirectory=sshd\nRuntimeDirectoryMode=0755\n\n[Install]\nWantedBy=multi-user.target\nAlias=sshd.service\n');
    for (const p of ['/usr/lib/systemd/systemd-journald']) {
      if (!this.m.vfs.statAs(p, ROOT_CRED)) {
        this.m.vfs.writeFileAs(p, '#!/usr/bin/sim\n# systemd-journald: journal service\n', ROOT_CRED);
        this.m.vfs.chmodAs(p, 0o755, ROOT_CRED);
      }
    }
    this.bootUnits(true);
  }

  /** Start what is wanted by multi-user.target, plus journald. */
  bootUnits(first: boolean): void {
    const at = first ? this.m.bootAt : this.now();
    this.log('kernel', 0, `Linux version 6.12.0-dt-sim (builder@trainer) #1 SMP PREEMPT_DYNAMIC Debian 6.12.0`, { kernel: true });
    this.log('kernel', 0, 'Run /sbin/init as init process', { kernel: true });
    this.log('systemd', 1, 'systemd 257.8-1~deb13u2 running in system mode (+PAM +AUDIT +SELINUX +APPARMOR +IMA +SMACK +SECCOMP +GCRYPT -GNUTLS +OPENSSL +ACL +BLKID +CURL +ELFUTILS +FIDO2 +IDN2 -IDN +IPTC +KMOD +LIBCRYPTSETUP +LIBFDISK +PCRE2 +PWQUALITY +P11KIT +QRENCODE +TPM2 +BZIP2 +LZ4 +XZ +ZLIB +ZSTD +BPF_FRAMEWORK +BTF -XKBCOMMON -UTMP +SYSVINIT +LIBARCHIVE)');
    this.log('systemd', 1, `Hostname set to <${this.m.hostname}>.`);
    const jd = this.state('systemd-journald.service');
    jd.config = this.readConfig('systemd-journald.service') ?? undefined;
    jd.mainPid = this.m.forkRaw({ cmd: 'systemd-journal', argv: ['/usr/lib/systemd/systemd-journald'], uid: 0, ppid: 1, cgroup: '/system.slice/systemd-journald.service', rss: 9800, start: at, seccomp: 2 });
    this.m.kernel.mkCgroup('/sys/fs/cgroup/system.slice/systemd-journald.service');
    jd.active = 'active';
    jd.sub = 'running';
    jd.since = at;
    let wants: string[] = [];
    try {
      wants = this.m.vfs.readdirAs('/etc/systemd/system/multi-user.target.wants', ROOT_CRED);
    } catch {
      wants = [];
    }
    for (const name of wants) {
      const c = this.readConfig(name);
      if (!c) continue;
      const s = this.state(name);
      s.config = c;
      void this.launchSync(s, c, at);
    }
    this.log('systemd', 1, 'Reached target multi-user.target - Multi-User System.');
    this.log('systemd', 1, `Startup finished in 1.204s (kernel) + 2.870s (userspace) = 4.075s.`);
  }

  /** At boot only daemons are started (no async scripts): good enough for base units and enabled daemons. */
  private launchSync(s: UnitState, c: UnitConfig, at: number): void {
    const argv = this.argvOf(c.execStart);
    const path = argv[0];
    const st = path ? this.m.vfs.statAs(path, ROOT_CRED) : null;
    if (!st) {
      this.pendingBoot.push(c.name);
      return;
    }
    const text = this.m.vfs.readFileAs(path, ROOT_CRED);
    const stub = /^#!\/usr\/bin\/sim\n# (\S+):/.exec(text)?.[1];
    if (!stub || !PROGRAMS.get(stub)?.daemon) {
      this.pendingBoot.push(c.name);
      return;
    }
    const as = this.runAs(c);
    if ('error' in as) {
      this.pendingBoot.push(c.name);
      return;
    }
    const cg = this.setupCgroup(c);
    const r = PROGRAMS.get(stub)!.daemon!(argv, this.m, as, c.name);
    if (!r.ok) {
      this.pendingBoot.push(c.name);
      return;
    }
    const pid = this.m.forkRaw({ cmd: stub, argv, uid: as.user.uid, ppid: 1, capEff: as.capEff, cgroup: cg, unit: c.name, rss: r.rss ?? 4000, start: at, threads: r.threads ?? 1, listen: r.listen, ignores: r.ignores, seccomp: c.props.SystemCallFilter ? 2 : 0 });
    for (const ch of r.children ?? []) this.m.forkRaw({ cmd: ch.cmd, argv: ch.argv, uid: ch.uid ?? as.user.uid, ppid: pid, cgroup: cg, unit: c.name, rss: 3200, start: at });
    for (const l of r.logs) this.log(stub, pid, l, { unit: c.name });
    s.mainPid = pid;
    s.active = 'active';
    s.sub = 'running';
    s.since = at;
    s.starts = [at];
    this.sys(c.name, `Started ${label(c)}.`);
  }

  /** Units that need a script run at boot; started by settleBoot(). */
  pendingBoot: string[] = [];

  async settleBoot(): Promise<void> {
    const list = this.pendingBoot;
    this.pendingBoot = [];
    for (const name of list) await this.start(name);
  }

  /** A reboot: every process but PID 1 ends, tmpfs is emptied, enabled units start again. */
  async reboot(): Promise<void> {
    this.log('systemd', 1, 'System is rebooting.');
    for (const s of this.units.values()) {
      s.restartAt = undefined;
      s.mainPid = 0;
      s.active = 'inactive';
      s.sub = 'dead';
      s.result = 'success';
      s.starts = [];
      s.nRestarts = 0;
    }
    this.bootId++;
    this.m.rebootReset();
    this.bootUnits(false);
    await this.settleBoot();
  }

  // ── output ──

  status(name: string, lines = 10): { text: string; code: number } {
    const c = this.config(name);
    const s = this.units.get(name);
    if (!c) return { text: `Unit ${name} could not be found.\n`, code: 4 };
    const st = s ?? this.state(name);
    const en = this.enabledState(name);
    const now = this.now();
    const dot = st.active === 'active' ? '\x1b[32m●\x1b[0m' : st.active === 'failed' ? '\x1b[31m×\x1b[0m' : '○';
    const activeText =
      st.active === 'active'
        ? `\x1b[32mactive (${st.sub})\x1b[0m`
        : st.active === 'failed'
          ? `\x1b[31mfailed\x1b[0m (Result: ${st.result})`
          : st.active === 'activating'
            ? `activating (${st.sub})`
            : `inactive (dead)`;
    const since = st.active === 'inactive' && !st.exec ? '' : ` since ${longTime(st.since)}; ${ago(now - st.since)} ago`;
    const out: string[] = [];
    out.push(`${dot} ${name}${c.description ? ` - ${c.description}` : ''}`);
    out.push(`     Loaded: loaded (${c.path}; ${en}; preset: enabled)`);
    if (c.dropIns.length) {
      out.push(`    Drop-In: ${c.dropIns[0].slice(0, c.dropIns[0].lastIndexOf('/'))}`);
      out.push(`             └─${c.dropIns.map((d) => d.split('/').pop()).join(', ')}`);
    }
    out.push(`     Active: ${activeText}${since}`);
    if (st.active === 'activating' && st.sub === 'auto-restart') out.push(`    Process: ${st.exec?.pid ?? 0} ExecStart=${c.execStart} (code=${st.exec?.code ?? 'exited'}, status=${st.exec?.status ?? '1/FAILURE'})`);
    if (st.active === 'failed' && st.exec) out.push(`    Process: ${st.exec.pid} ExecStart=${c.execStart} (code=${st.exec.code}, status=${st.exec.status})`);
    if (st.mainPid) {
      const p = this.m.procs.get(st.mainPid) as KProc | undefined;
      out.push(`   Main PID: ${st.mainPid} (${p?.cmd ?? '?'})`);
      const procs = this.m.kernel.procsIn(this.cgroupOf(name), false);
      const tasks = procs.reduce((n, x) => n + x.threads, 0);
      const tmax = c.props.TasksMax ?? '4915';
      out.push(`      Tasks: ${tasks} (limit: ${tmax})`);
      const mem = procs.reduce((n, x) => n + x.rss, 0);
      out.push(`     Memory: ${(mem / 1024).toFixed(1)}M${c.props.MemoryMax ? ` (max: ${c.props.MemoryMax} available: ${(memBytes(c.props.MemoryMax) / 1048576 - mem / 1024).toFixed(1)}M)` : ''}`);
      out.push(`        CPU: ${Math.max(8, Math.round((now - st.since) / 900))}ms`);
      out.push(`     CGroup: ${this.cgroupOf(name)}`);
      procs.forEach((x, i) => out.push(`             ${i === procs.length - 1 ? '└─' : '├─'}${x.pid} ${x.argv.join(' ')}`));
    } else if (st.active === 'failed' && st.exec) {
      out.push(`   Main PID: ${st.exec.pid} (code=${st.exec.code}, status=${st.exec.status})`);
    }
    const j = this.journal.filter((e) => e.unit === name).slice(-lines);
    if (j.length) {
      out.push('');
      for (const e of j) out.push(fmtEntry(e, this.m.hostname));
    }
    const code = st.active === 'active' ? 0 : st.active === 'failed' ? 3 : 3;
    return { text: out.join('\n') + '\n', code };
  }

  show(name: string): Record<string, string> {
    const c = this.config(name);
    const s = this.units.get(name) ?? this.state(name);
    return {
      Id: name,
      Description: c?.description ?? '',
      LoadState: c ? 'loaded' : 'not-found',
      ActiveState: s.active,
      SubState: s.sub,
      Result: s.result,
      MainPID: String(s.mainPid),
      NRestarts: String(s.nRestarts),
      ExecMainStatus: s.exec ? s.exec.status.split('/')[0] : '0',
      FragmentPath: c?.path ?? '',
      DropInPaths: c?.dropIns.join(' ') ?? '',
      UnitFileState: this.enabledState(name),
      Type: c?.type ?? 'simple',
      Restart: c?.restart ?? 'no',
      RestartUSec: c ? fmtUsec(c.restartSec) : '100ms',
      StartLimitBurst: String(c?.startLimitBurst ?? 5),
      StartLimitIntervalUSec: c ? fmtUsec(c.startLimitIntervalSec) : '10s',
      User: c?.user ?? '',
      ControlGroup: s.mainPid ? this.cgroupOf(name) : '',
      MemoryMax: c?.props.MemoryMax ? String(memBytes(c.props.MemoryMax)) : 'infinity',
      TasksMax: c?.props.TasksMax ?? '4915',
      CPUQuotaPerSecUSec: c?.props.CPUQuota ? `${Math.round(parseFloat(c.props.CPUQuota) * 10)}ms` : 'infinity',
      SystemCallFilter: c?.props.SystemCallFilter ?? '',
      ProtectHome: c?.props.ProtectHome ?? 'no',
      CapabilityBoundingSet: c?.props.CapabilityBoundingSet ?? 'cap_chown cap_dac_override … (all)',
      AmbientCapabilities: c?.props.AmbientCapabilities ?? '',
      WantedBy: c?.wantedBy.join(' ') ?? '',
      After: c?.after.join(' ') ?? '',
    };
  }

  facts(): Record<string, unknown> {
    const units: Record<string, unknown> = {};
    const names = new Set([...this.units.keys()]);
    for (const d of UNIT_DIRS) {
      try {
        for (const f of this.m.vfs.readdirAs(d, ROOT_CRED)) if (f.endsWith('.service')) names.add(f);
      } catch {
        /* none */
      }
    }
    for (const n of names) {
      const s = this.units.get(n);
      const c = s?.config ?? this.readConfig(n);
      units[n] = {
        name: n,
        active: s?.active ?? 'inactive',
        sub: s?.sub ?? 'dead',
        result: s?.result ?? 'success',
        enabled: this.enabledState(n),
        mainPid: s?.mainPid ?? 0,
        restarts: s?.nRestarts ?? 0,
        loaded: !!s?.config,
        stale: this.changedOnDisk(n),
        props: { ...(c?.props ?? {}), FragmentPath: c?.path ?? '', DropInPaths: c?.dropIns.join(' ') ?? '' },
      };
    }
    return {
      units,
      journal: this.journal.map((e) => ({ unit: e.unit, ident: e.ident, msg: e.msg, prio: e.prio, boot: e.boot })),
      boot: this.bootId,
    };
  }

  snapshot(): SystemdSnapshot {
    return { units: [...this.units.values()].map((u) => ({ ...u })), journal: this.journal.map((e) => ({ ...e })), boot: this.bootId };
  }

  restore(snap: unknown): void {
    const s = snap as SystemdSnapshot;
    this.units = new Map(s.units.map((u) => [u.name, { ...u }]));
    this.journal = s.journal.map((e) => ({ ...e }));
    this.bootId = s.boot;
  }
}

function label(c: UnitConfig): string {
  return c.description ? `${c.name} - ${c.description}` : c.name;
}

function sigNo(sig: string): number {
  return ({ HUP: 1, INT: 2, QUIT: 3, ABRT: 6, KILL: 9, SEGV: 11, PIPE: 13, TERM: 15 } as Record<string, number>)[sig] ?? 15;
}

function shq(a: string): string {
  return /^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`;
}

export function memBytes(v: string): number {
  const m = /^(\d+(?:\.\d+)?)([KMGT])?$/i.exec(v.trim());
  if (!m) return Number(v) || 0;
  const mul = { K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4 }[(m[2] ?? '').toUpperCase()] ?? 1;
  return Math.round(Number(m[1]) * mul);
}

function fmtUsec(ms: number): string {
  if (ms === Infinity) return 'infinity';
  if (ms < 1000) return `${ms}ms`;
  if (ms % 60000 === 0) return `${ms / 60000}min`;
  return `${ms / 1000}s`;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n: number) => String(n).padStart(2, '0');

export function longTime(ms: number): string {
  const d = new Date(ms);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())} UTC`;
}

export function shortTime(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`;
}

export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

export function fmtEntry(e: JournalEntry, host: string): string {
  return `${shortTime(e.at)} ${host} ${e.kernel ? 'kernel' : `${e.ident}[${e.pid}]`}: ${e.msg}`;
}
