// The kernel side of the simulated machine (tier A): namespaces, cgroup v2,
// capabilities, procfs, mounts and overlayfs. It keeps the model small and
// honest: every number a lesson shows comes from here, and the same state
// produces the files under /proc and /sys/fs/cgroup, the output of ps, lsns
// and mount, and the facts the checks read.
//
// Sources: namespaces(7), pid_namespaces(7), user_namespaces(7), cgroups(7),
// Documentation/admin-guide/cgroup-v2.rst, capabilities(7), proc(5),
// Documentation/filesystems/overlayfs.rst.

import type { Cred, ProcFact, Snapshotable } from '../../core/types';
import { FsError, ROOT_CRED, normalize, type KCred, type Vfs } from './vfs';

// ── namespaces ──

export type NsType = 'cgroup' | 'ipc' | 'mnt' | 'net' | 'pid' | 'time' | 'user' | 'uts';
export const NS_TYPES: NsType[] = ['cgroup', 'ipc', 'mnt', 'net', 'pid', 'time', 'user', 'uts'];

/** The inode numbers of the initial namespaces, as on a freshly booted kernel. */
export const HOST_NS: Record<NsType, number> = {
  time: 4026531834,
  cgroup: 4026531835,
  pid: 4026531836,
  user: 4026531837,
  uts: 4026531838,
  ipc: 4026531839,
  net: 4026531840,
  mnt: 4026531841,
};

export interface NsRec {
  id: number;
  type: NsType;
  /** The namespace this one was created from (pid and user namespaces nest). */
  parent?: number;
  /** uts: the host name inside. */
  hostname?: string;
  /** mnt: the pid namespace whose /proc is mounted (the view of ps). */
  procPidNs?: number;
  /** pid: host pid of the init process (pid 1 inside); 'dead' after it exited. */
  init?: number;
  state?: 'empty' | 'alive' | 'dead';
  nextPid?: number;
  /** user: one line of uid_map, "0 1000 1". */
  uidMap?: [number, number, number];
  /** net: interfaces brought up inside. */
  loUp?: boolean;
}

// ── capabilities ──

export const CAPS = [
  'chown', 'dac_override', 'dac_read_search', 'fowner', 'fsetid', 'kill', 'setgid', 'setuid', 'setpcap', 'linux_immutable',
  'net_bind_service', 'net_broadcast', 'net_admin', 'net_raw', 'ipc_lock', 'ipc_owner', 'sys_module', 'sys_rawio', 'sys_chroot', 'sys_ptrace',
  'sys_pacct', 'sys_admin', 'sys_boot', 'sys_nice', 'sys_resource', 'sys_time', 'sys_tty_config', 'mknod', 'lease', 'audit_write',
  'audit_control', 'setfcap', 'mac_override', 'mac_admin', 'syslog', 'wake_alarm', 'block_suspend', 'audit_read', 'perfmon', 'bpf',
  'checkpoint_restore',
] as const;
export type CapName = (typeof CAPS)[number];

export const CAP_FULL = (1n << BigInt(CAPS.length)) - 1n;
export const capHex = (mask: bigint) => mask.toString(16).padStart(16, '0');
export const capMask = (hex: string | undefined) => (hex ? BigInt('0x' + hex) : 0n);
export const capBit = (name: string) => {
  const i = CAPS.indexOf(name.toLowerCase().replace(/^cap_/, '') as CapName);
  return i < 0 ? null : 1n << BigInt(i);
};
export function hasCapHex(hex: string | undefined, name: CapName): boolean {
  return (capMask(hex) & (1n << BigInt(CAPS.indexOf(name)))) !== 0n;
}
/** "cap_chown,cap_dac_override" for a mask; "=ep" style is done by the callers. */
export function capNames(mask: bigint): string[] {
  return CAPS.filter((_, i) => mask & (1n << BigInt(i))).map((c) => `cap_${c}`);
}

/** Credentials with the capability flags the VFS understands. */
export function kcred(cred: Cred, capEff: string | undefined): KCred {
  if (cred.uid !== 0) return cred;
  return { ...cred, dac: hasCapHex(capEff, 'dac_override'), dacRead: hasCapHex(capEff, 'dac_read_search'), fowner: hasCapHex(capEff, 'fowner'), chown: hasCapHex(capEff, 'chown') };
}

// ── processes as the kernel sees them ──

/** Extra fields the kernel keeps on each process (stored on the ProcFact). */
export interface KProc extends ProcFact {
  ns: Record<NsType, number>;
  /** The pid in each pid namespace from the host down: [hostPid, …, innermost]. */
  nspid: number[];
  cgroup: string;
  capEff: string;
  root: string;
  seccomp: 0 | 2;
  threads: number;
  /** Resident memory, KiB. */
  rss: number;
  /** Wanted CPU, percent of one CPU (yes = 100). */
  cpuWant: number;
  nice: number;
  start: number;
  tty: string;
  /** Signals the process handles itself (does not die from). */
  ignores?: string[];
  listen?: number[];
  unit?: string;
  /** Growth of rss in KiB per second (leaky, memhog in the background). */
  grow?: number;
  /** Stop growing at this rss (KiB). */
  growTo?: number;
  /** A sleep that ends at this virtual time (ms). */
  until?: number;
  job?: number;
}

export interface MountRec {
  id: number;
  source: string;
  target: string;
  fstype: string;
  options: string;
  /** The mnt namespace it was made in (host mounts are seen everywhere). */
  ns: number;
  /** Inode of the mounted root and of the directory it hides (for umount). */
  ino?: number;
  hidden?: number;
  /** overlay: the dirs and the baseline of the merged tree. */
  overlay?: { lower: string[]; upper: string; work: string; base: Record<string, string> };
  /** Applied to the tree right now (private mounts of other namespaces are not). */
  applied?: boolean;
  size?: number;
}

export interface DmesgLine {
  at: number;
  msg: string;
}

/** Machine memory, KiB: a small VM. */
export const MEM_TOTAL = 2_013_184;
export const MEM_BASE_USED = 412_000;
export const MEM_CACHE = 820_000;

const CG = '/sys/fs/cgroup';

export const CG_CONTROLS: Record<string, { def: string; rw: boolean; root?: boolean }> = {
  'cgroup.controllers': { def: 'cpuset cpu io memory hugetlb pids rdma misc', rw: false, root: true },
  'cgroup.subtree_control': { def: '', rw: true, root: true },
  'cgroup.procs': { def: '', rw: true, root: true },
  'cgroup.events': { def: 'populated 0\nfrozen 0', rw: false },
  'cgroup.type': { def: 'domain', rw: true },
  'cpu.max': { def: 'max 100000', rw: true },
  'cpu.stat': { def: 'usage_usec 0\nuser_usec 0\nsystem_usec 0\nnr_periods 0\nnr_throttled 0\nthrottled_usec 0', rw: false, root: true },
  'cpu.weight': { def: '100', rw: true },
  'memory.current': { def: '0', rw: false },
  'memory.high': { def: 'max', rw: true },
  'memory.max': { def: 'max', rw: true },
  'memory.peak': { def: '0', rw: false },
  'memory.events': { def: 'low 0\nhigh 0\nmax 0\noom 0\noom_kill 0\noom_group_kill 0', rw: false },
  'memory.oom.group': { def: '0', rw: true },
  'memory.stat': { def: 'anon 0\nfile 0\nkernel 0', rw: false, root: true },
  'pids.current': { def: '0', rw: false },
  'pids.max': { def: 'max', rw: true },
  'pids.events': { def: 'max 0', rw: false },
};

/** Parse a memory limit as cgroupfs does: "max", bytes, or K/M/G suffixes. */
export function parseBytes(v: string): number | 'max' | null {
  const s = v.trim();
  if (s === 'max') return 'max';
  const m = /^(\d+)([KMGkmg])?$/.exec(s);
  if (!m) return null;
  const mul = { k: 1024, m: 1024 ** 2, g: 1024 ** 3 }[(m[2] ?? '').toLowerCase()] ?? 1;
  return Number(m[1]) * mul;
}

export function fmtKiB(kib: number): string {
  if (kib >= 1024 * 1024) return `${(kib / 1024 / 1024).toFixed(1)}Gi`;
  if (kib >= 1024) return `${(kib / 1024).toFixed(kib % 1024 ? 1 : 0)}Mi`;
  return `${kib}Ki`;
}

export interface KernelSnapshot {
  ns: NsRec[];
  nextNs: number;
  mounts: MountRec[];
  nextMount: number;
  fileCaps: [number, string][];
  dmesg: DmesgLine[];
  activeMnt: number;
}

/** What the kernel needs from the machine. */
export interface KernelHost {
  vfs: Vfs;
  now(): number;
  procs: { list(): ProcFact[]; get(pid: number): ProcFact | undefined };
  /** Kill a process with a signal from the kernel (OOM). */
  kernelKill(pid: number, sig: string, reason: string): void;
  /** The process whose view of /proc we draw (the shell of the active session). */
  viewPid(): number;
  userName(uid: number): string;
}

export class Kernel implements Snapshotable {
  ns = new Map<number, NsRec>();
  nextNs = 4026532200;
  mounts: MountRec[] = [];
  nextMount = 30;
  fileCaps = new Map<number, string>();
  dmesg: DmesgLine[] = [];
  /** The mnt namespace whose private mounts are applied to the tree now. */
  activeMnt = HOST_NS.mnt;
  private procSig = '';

  constructor(private host: KernelHost) {
    for (const t of NS_TYPES) this.ns.set(HOST_NS[t], { id: HOST_NS[t], type: t, state: 'alive', init: 1, nextPid: 1, loUp: true });
    this.ns.get(HOST_NS.mnt)!.procPidNs = HOST_NS.pid;
  }

  // ── namespaces ──
  newNs(type: NsType, from: NsRec | undefined, extra: Partial<NsRec> = {}): NsRec {
    const rec: NsRec = { id: this.nextNs++, type, parent: from?.id, ...extra };
    if (type === 'uts') rec.hostname = extra.hostname ?? from?.hostname;
    if (type === 'pid') {
      rec.state = 'empty';
      rec.nextPid = 1;
    }
    if (type === 'mnt') rec.procPidNs = extra.procPidNs ?? from?.procPidNs ?? HOST_NS.pid;
    this.ns.set(rec.id, rec);
    return rec;
  }

  /** The pid-namespace chain of a pid ns, from the host down. */
  pidChain(nsId: number): number[] {
    const chain: number[] = [];
    let cur: NsRec | undefined = this.ns.get(nsId);
    while (cur) {
      chain.unshift(cur.id);
      cur = cur.parent !== undefined ? this.ns.get(cur.parent) : undefined;
    }
    return chain;
  }

  /** The pid of process p as seen from pid namespace `view`, or null if it is not visible there. */
  pidIn(p: KProc, view: number): number | null {
    const chain = this.pidChain(p.ns.pid);
    const i = chain.indexOf(view);
    if (i < 0) return null;
    return p.nspid[i] ?? null;
  }

  /** Allocate the pids for a new process in pid namespace `nsId` (and its ancestors). */
  allocPid(hostPid: number, nsId: number): number[] {
    const chain = this.pidChain(nsId);
    return chain.map((id, i) => {
      if (i === 0) return hostPid;
      const rec = this.ns.get(id)!;
      const n = rec.nextPid ?? 1;
      rec.nextPid = n + 1;
      if (n === 1) {
        rec.init = hostPid;
        rec.state = 'alive';
      }
      return n;
    });
  }

  hostnameOf(utsId: number, fallback: string): string {
    return this.ns.get(utsId)?.hostname ?? fallback;
  }

  // ── cgroups ──

  /** Create the cgroup root and the tree systemd keeps (init.scope, system.slice, user.slice). */
  bootCgroups(): void {
    const vfs = this.host.vfs;
    vfs.mkdirAs('/sys/fs', ROOT_CRED, { parents: true });
    if (!vfs.statAs(CG, ROOT_CRED)) vfs.mkdirAs(CG, ROOT_CRED);
    this.populate(CG, true);
    for (const d of ['init.scope', 'system.slice', 'user.slice', 'user.slice/user-1000.slice', 'user.slice/user-1000.slice/session-1.scope']) this.mkCgroup(`${CG}/${d}`);
    this.writeCtl(`${CG}/system.slice/cgroup.subtree_control`, 'cpu memory pids');
    this.writeCtl(`${CG}/user.slice/cgroup.subtree_control`, 'cpu memory pids');
  }

  mkCgroup(abs: string): void {
    const vfs = this.host.vfs;
    if (!vfs.statAs(abs, ROOT_CRED)) {
      const saved = vfs.hooks.afterMkdir;
      vfs.hooks.afterMkdir = undefined;
      vfs.mkdirAs(abs, ROOT_CRED, { parents: true });
      vfs.hooks.afterMkdir = saved;
    }
    this.populate(abs, false);
  }

  private populate(dir: string, root: boolean): void {
    const vfs = this.host.vfs;
    for (const [name, spec] of Object.entries(CG_CONTROLS)) {
      if (root && !spec.root) continue;
      const p = `${dir}/${name}`;
      if (vfs.statAs(p, ROOT_CRED)) continue;
      this.writeCtl(p, spec.def);
      vfs.chmodAs(p, spec.rw ? 0o644 : 0o444, ROOT_CRED);
    }
  }

  private writeCtl(path: string, value: string): void {
    const vfs = this.host.vfs;
    const saved = vfs.hooks.beforeWrite;
    vfs.hooks.beforeWrite = undefined;
    try {
      vfs.writeFileAs(path, value ? value.replace(/\n?$/, '\n') : '', ROOT_CRED);
    } finally {
      vfs.hooks.beforeWrite = saved;
    }
  }

  readCtl(cg: string, name: string): string {
    try {
      return this.host.vfs.readFileAs(`${CG}${cg === '/' ? '' : cg}/${name}`, ROOT_CRED).trim();
    } catch {
      return '';
    }
  }

  /** Every cgroup path ("/", "/system.slice", …) that exists as a directory. */
  cgroupPaths(): string[] {
    const ino = this.host.vfs.inoOf(CG);
    if (ino === undefined) return ['/'];
    const out = ['/'];
    for (const e of this.host.vfs.listFrom(ino)) if (e.stat.type === 'd') out.push('/' + e.rel);
    return out;
  }

  isCgroupPath(abs: string): string | null {
    const n = normalize(abs);
    if (n === CG) return '/';
    return n.startsWith(CG + '/') ? n.slice(CG.length) : null;
  }

  limitOf(cg: string, name: 'memory.max' | 'memory.high' | 'pids.max'): number {
    const v = this.readCtl(cg, name);
    if (!v || v === 'max') return Infinity;
    return Number(v);
  }

  cpuQuota(cg: string): number {
    const v = this.readCtl(cg, 'cpu.max');
    const [q, p] = (v || 'max 100000').split(/\s+/);
    if (q === 'max') return Infinity;
    return (Number(q) / Number(p || 100000)) * 100;
  }

  /** The cgroup and its ancestors, nearest first: /a/b → ['/a/b', '/a', '/']. */
  ancestors(cg: string): string[] {
    const out: string[] = [];
    let cur = cg;
    for (;;) {
      out.push(cur);
      if (cur === '/') break;
      cur = cur.slice(0, cur.lastIndexOf('/')) || '/';
    }
    return out;
  }

  procsIn(cg: string, deep: boolean): KProc[] {
    return (this.host.procs.list() as KProc[]).filter((p) => p.cgroup === cg || (deep && (cg === '/' || p.cgroup.startsWith(cg + '/'))));
  }

  memUsage(cg: string): number {
    return this.procsIn(cg, true).reduce((s, p) => s + p.rss * 1024, 0);
  }

  pidsUsage(cg: string): number {
    return this.procsIn(cg, true).reduce((s, p) => s + Math.max(1, p.threads), 0);
  }

  bumpEvent(cg: string, file: 'memory.events' | 'pids.events', key: string): void {
    const text = this.readCtl(cg, file);
    const lines = text.split('\n').map((l) => {
      const [k, v] = l.split(' ');
      return k === key ? `${k} ${Number(v) + 1}` : l;
    });
    this.writeCtl(`${CG}${cg === '/' ? '' : cg}/${file}`, lines.join('\n'));
  }

  eventCount(cg: string, file: 'memory.events' | 'pids.events', key: string): number {
    const line = this.readCtl(cg, file)
      .split('\n')
      .find((l) => l.startsWith(key + ' '));
    return line ? Number(line.split(' ')[1]) : 0;
  }

  /**
   * Can the cgroup of `cg` take `extra` more bytes? Returns the cgroup whose
   * memory.max would be crossed, or null.
   */
  memBlocker(cg: string, extraBytes: number): string | null {
    for (const a of this.ancestors(cg)) {
      if (a === '/') break;
      const max = this.limitOf(a, 'memory.max');
      if (this.memUsage(a) + extraBytes > max) return a;
    }
    return null;
  }

  /** Is the whole machine out of memory after taking `extra` more bytes? */
  globalOom(extraBytes: number): boolean {
    const used = MEM_BASE_USED * 1024 + (this.host.procs.list() as KProc[]).reduce((s, p) => s + p.rss * 1024, 0);
    return used + extraBytes > MEM_TOTAL * 1024;
  }

  /** Which process the OOM killer picks in a cgroup: the biggest. */
  oomVictim(cg: string | null): KProc | undefined {
    const pool = cg ? this.procsIn(cg, true) : (this.host.procs.list() as KProc[]).filter((p) => p.pid !== 1);
    return [...pool].sort((a, b) => b.rss - a.rss)[0];
  }

  /** Kill the biggest process of a cgroup (or of the machine) and log it like the kernel. */
  oomKill(cg: string | null, trigger: KProc): KProc | undefined {
    const victim = this.oomVictim(cg);
    if (!victim) return undefined;
    const name = victim.cmd;
    if (cg) {
      this.bumpEvent(cg, 'memory.events', 'max');
      this.bumpEvent(cg, 'memory.events', 'oom');
      this.bumpEvent(cg, 'memory.events', 'oom_kill');
    }
    this.log(`${trigger.cmd} invoked oom-killer: gfp_mask=0xcc0(GFP_KERNEL), order=0, oom_score_adj=0`);
    if (cg) this.log(`memory: usage ${Math.round(this.memUsage(cg) / 1024)}kB, limit ${Math.round(this.limitOf(cg, 'memory.max') / 1024)}kB, failcnt ${this.eventCount(cg, 'memory.events', 'max')}`);
    this.log(
      `${cg ? 'Memory cgroup out of memory' : 'Out of memory'}: Killed process ${victim.pid} (${name}) total-vm:${victim.rss + 4200}kB, anon-rss:${victim.rss}kB, file-rss:0kB, shmem-rss:0kB, UID:${victim.uid} pgtables:84kB oom_score_adj:0`,
    );
    this.host.kernelKill(victim.pid, 'KILL', 'oom');
    return victim;
  }

  log(msg: string): void {
    this.dmesg.push({ at: this.host.now(), msg });
    if (this.dmesg.length > 400) this.dmesg.shift();
  }

  /** Write cgroup counters (memory.current, pids.current, cgroup.procs, cgroup.events) from the process table. */
  syncCgroups(): void {
    for (const cg of this.cgroupPaths()) {
      const dir = `${CG}${cg === '/' ? '' : cg}`;
      const own = this.procsIn(cg, false);
      this.writeCtl(`${dir}/cgroup.procs`, own.map((p) => p.pid).join('\n'));
      if (cg === '/') continue;
      const mem = this.memUsage(cg);
      this.writeCtl(`${dir}/memory.current`, String(mem));
      const peak = Number(this.readCtl(cg, 'memory.peak') || 0);
      if (mem > peak) this.writeCtl(`${dir}/memory.peak`, String(mem));
      this.writeCtl(`${dir}/pids.current`, String(this.pidsUsage(cg)));
      this.writeCtl(`${dir}/cgroup.events`, `populated ${this.procsIn(cg, true).length ? 1 : 0}\nfrozen 0`);
    }
  }

  /** The validating side of writes under /sys/fs/cgroup (cgroup-v2.rst "Interface Files"). */
  cgroupWrite(abs: string, data: string, append: boolean, cred: Cred, movePid: (pid: number, cg: string) => boolean): string | 'skip' | undefined {
    const rel = this.isCgroupPath(abs);
    if (rel === null) return undefined;
    const name = rel.slice(rel.lastIndexOf('/') + 1);
    const cg = rel.slice(0, rel.lastIndexOf('/')) || '/';
    const spec = CG_CONTROLS[name];
    if (!spec) throw new FsError('EACCES', abs);
    if (!spec.rw) throw new FsError('EACCES', abs);
    if (cred.uid !== 0) return undefined; // the VFS rejects it by mode bits
    if (data === '' && !append) return 'skip';
    const v = data.trim();
    switch (name) {
      case 'memory.max':
      case 'memory.high': {
        const b = parseBytes(v);
        if (b === null) throw new FsError('EINVAL', abs);
        const out = b === 'max' ? 'max' : String(Math.floor(b / 4096) * 4096);
        if (name === 'memory.max' && b !== 'max') this.pendingLimit = { cg, bytes: Number(out) };
        return out + '\n';
      }
      case 'pids.max': {
        if (v !== 'max' && !/^\d+$/.test(v)) throw new FsError('EINVAL', abs);
        return v + '\n';
      }
      case 'cpu.max': {
        const m = /^(max|\d+)(?:\s+(\d+))?$/.exec(v);
        if (!m) throw new FsError('EINVAL', abs);
        const period = m[2] ?? (this.readCtl(cg, 'cpu.max').split(/\s+/)[1] || '100000');
        if (m[1] !== 'max' && Number(m[1]) < 1000) throw new FsError('EINVAL', abs);
        return `${m[1]} ${period}\n`;
      }
      case 'cpu.weight':
      case 'memory.oom.group':
        if (!/^\d+$/.test(v)) throw new FsError('EINVAL', abs);
        return v + '\n';
      case 'cgroup.type':
        if (v !== 'threaded') throw new FsError('EINVAL', abs);
        return 'threaded\n';
      case 'cgroup.subtree_control': {
        const cur = new Set(this.readCtl(cg, 'cgroup.subtree_control').split(/\s+/).filter(Boolean));
        for (const tok of v.split(/\s+/)) {
          const m = /^([+-])(cpu|memory|pids|io|cpuset)$/.exec(tok);
          if (!m) throw new FsError('EINVAL', abs);
          if (m[1] === '+') cur.add(m[2]);
          else cur.delete(m[2]);
        }
        return [...cur].join(' ') + '\n';
      }
      case 'cgroup.procs': {
        for (const tok of v.split(/\s+/)) {
          if (!/^\d+$/.test(tok) || !movePid(Number(tok), cg)) throw new FsError('EINVAL', abs);
        }
        return 'skip';
      }
    }
    return undefined;
  }

  /** Set by a memory.max write; the machine enforces it right after the write lands. */
  pendingLimit: { cg: string; bytes: number } | null = null;

  /** rmdir on a cgroup: refuses with EBUSY while it has processes or children, else removes its control files. */
  cgroupRmdir(abs: string): boolean {
    const rel = this.isCgroupPath(abs);
    if (rel === null || rel === '/') return false;
    const vfs = this.host.vfs;
    if (this.procsIn(rel, false).length) throw new FsError('EBUSY', abs);
    const entries = vfs.readdirAs(abs, ROOT_CRED);
    for (const e of entries) {
      const st = vfs.statAs(`${abs}/${e}`, ROOT_CRED);
      if (st?.type === 'd') throw new FsError('EBUSY', abs);
    }
    for (const e of entries) vfs.unlinkAs(`${abs}/${e}`, ROOT_CRED);
    return false;
  }

  // ── procfs ──

  /** Rebuild /proc for the pid namespace the active shell sees. Cheap when nothing changed. */
  syncProc(view: { pidNs: number; self: number }, extra: { hostname: string; uptime: number; load: string; cmdline: string; mem: Record<string, number> }): void {
    const procs = (this.host.procs.list() as KProc[]).filter((p) => this.pidIn(p, view.pidNs) !== null);
    const sig = JSON.stringify([view, procs.map((p) => [p.pid, p.state, p.rss, p.threads, p.cgroup, p.ns, p.capEff, p.uid, p.root, p.cmd, p.argv.length, p.seccomp]), extra.mem.MemAvailable, Math.floor(extra.uptime / 1000)]);
    if (sig === this.procSig) return;
    this.procSig = sig;
    const vfs = this.host.vfs;
    const saved = vfs.hooks;
    vfs.hooks = {};
    try {
      for (const name of vfs.readdirAs('/proc', ROOT_CRED)) this.rmTree(`/proc/${name}`);
      const w = (p: string, text: string) => {
        vfs.writeFileAs(p, text, ROOT_CRED);
        vfs.chmodAs(p, 0o444, ROOT_CRED);
      };
      const d = (p: string, mode = 0o555) => {
        vfs.mkdirAs(p, ROOT_CRED);
        vfs.chmodAs(p, mode, ROOT_CRED);
      };
      for (const p of procs) {
        const pid = this.pidIn(p, view.pidNs)!;
        const base = `/proc/${pid}`;
        d(base);
        const chain = this.pidChain(p.ns.pid);
        const inner = p.nspid.slice(chain.indexOf(view.pidNs));
        const ppidProc = this.host.procs.get(p.ppid) as KProc | undefined;
        const ppid = ppidProc ? (this.pidIn(ppidProc, view.pidNs) ?? 0) : 0;
        const u = p.uid;
        const caps = p.capEff;
        const stateName = { R: 'R (running)', S: 'S (sleeping)', D: 'D (disk sleep)', T: 'T (stopped)', Z: 'Z (zombie)', I: 'I (idle)' }[p.state];
        w(
          `${base}/status`,
          [
            `Name:\t${p.cmd.slice(0, 15)}`,
            'Umask:\t0022',
            `State:\t${stateName}`,
            `Tgid:\t${pid}`,
            `Pid:\t${pid}`,
            `PPid:\t${ppid}`,
            `Uid:\t${u}\t${u}\t${u}\t${u}`,
            `Gid:\t${u}\t${u}\t${u}\t${u}`,
            `NStgid:\t${inner.join('\t')}`,
            `NSpid:\t${inner.join('\t')}`,
            `VmRSS:\t${String(p.rss).padStart(8)} kB`,
            `Threads:\t${p.threads}`,
            `SigCgt:\t${(p.ignores ?? []).length ? '0000000000004a02' : '0000000000000000'}`,
            `CapInh:\t0000000000000000`,
            `CapPrm:\t${caps}`,
            `CapEff:\t${caps}`,
            `CapBnd:\t${capHex(CAP_FULL)}`,
            `CapAmb:\t0000000000000000`,
            `NoNewPrivs:\t${p.seccomp ? 1 : 0}`,
            `Seccomp:\t${p.seccomp}`,
            `Seccomp_filters:\t${p.seccomp ? 1 : 0}`,
            'Cpus_allowed_list:\t0',
          ].join('\n') + '\n',
        );
        w(`${base}/cmdline`, p.argv.join('\u0000') + '\u0000');
        w(`${base}/comm`, p.cmd.slice(0, 15) + '\n');
        w(`${base}/cgroup`, `0::${p.cgroup}\n`);
        d(`${base}/ns`, 0o511);
        for (const t of NS_TYPES) vfs.symlinkAs(`${t}:[${p.ns[t]}]`, `${base}/ns/${t}`, ROOT_CRED);
        vfs.symlinkAs(p.root, `${base}/root`, ROOT_CRED);
        vfs.symlinkAs('/', `${base}/cwd`, ROOT_CRED);
        vfs.symlinkAs(p.argv[0]?.startsWith('/') ? p.argv[0] : `/usr/bin/${p.cmd}`, `${base}/exe`, ROOT_CRED);
        d(`${base}/fd`, 0o500);
        for (const fd of ['0', '1', '2']) vfs.symlinkAs(p.tty === '?' ? '/dev/null' : `/dev/${p.tty}`, `${base}/fd/${fd}`, ROOT_CRED);
        d(`${base}/task`);
        for (let t = 0; t < Math.max(1, p.threads); t++) {
          const tid = t === 0 ? pid : pid + t;
          d(`${base}/task/${tid}`);
          w(`${base}/task/${tid}/comm`, (t === 0 ? p.cmd : `${p.cmd.slice(0, 8)}-w${t}`) + '\n');
        }
        // ownership: the files of a process belong to its user
        for (const e of vfs.listFrom(vfs.inoOf(base)!)) if (e.stat.type !== 'l') vfs.chownAs(`${base}/${e.rel}`, u, u, ROOT_CRED);
        vfs.chownAs(base, u, u, ROOT_CRED);
      }
      if (procs.some((p) => this.pidIn(p, view.pidNs) === view.self)) vfs.symlinkAs(String(view.self), '/proc/self', ROOT_CRED);
      const m = extra.mem;
      w(
        '/proc/meminfo',
        ['MemTotal', 'MemFree', 'MemAvailable', 'Buffers', 'Cached', 'SwapTotal', 'SwapFree'].map((k) => `${(k + ':').padEnd(16)}${String(m[k] ?? 0).padStart(8)} kB`).join('\n') + '\n',
      );
      w('/proc/loadavg', `${extra.load} 1/${procs.length} ${Math.max(...procs.map((p) => p.pid), 1)}\n`);
      w('/proc/uptime', `${(extra.uptime / 1000).toFixed(2)} ${((extra.uptime / 1000) * 0.9).toFixed(2)}\n`);
      w('/proc/cmdline', extra.cmdline + '\n');
      w('/proc/version', 'Linux version 6.12.0-dt-sim (builder@trainer) (gcc (Debian 14.2.0-19) 14.2.0, GNU ld (GNU Binutils for Debian) 2.44) #1 SMP PREEMPT_DYNAMIC Debian 6.12.0\n');
      w('/proc/cpuinfo', 'processor\t: 0\nvendor_id\t: GenuineIntel\nmodel name\t: Simulated x86 CPU\ncpu MHz\t\t: 2400.000\ncpu cores\t: 1\n');
      w('/proc/mounts', this.mountsText());
      d('/proc/sys');
      d('/proc/sys/kernel');
      w('/proc/sys/kernel/hostname', extra.hostname + '\n');
      w('/proc/sys/kernel/dmesg_restrict', '1\n');
      w('/proc/sys/kernel/pid_max', '4194304\n');
    } finally {
      vfs.hooks = saved;
    }
  }

  private rmTree(abs: string): void {
    const vfs = this.host.vfs;
    const st = vfs.statAs(abs, ROOT_CRED, false);
    if (!st) return;
    if (st.type === 'd') {
      for (const n of vfs.readdirAs(abs, ROOT_CRED)) this.rmTree(`${abs}/${n}`);
      vfs.rmdirAs(abs, ROOT_CRED);
    } else vfs.unlinkAs(abs, ROOT_CRED);
  }

  // ── mounts ──

  /** Mounts visible in a mnt namespace: host ones plus its own. */
  visibleMounts(mntNs: number = this.activeMnt): MountRec[] {
    return this.mounts.filter((m) => m.ns === HOST_NS.mnt || m.ns === mntNs);
  }

  mountsText(mntNs: number = this.activeMnt): string {
    return this.visibleMounts(mntNs)
      .map((m) => `${m.source} ${m.target} ${m.fstype} ${m.options} 0 0`)
      .join('\n') + '\n';
  }

  /** Attach a tree (by inode) at a directory; remembers what it hides. */
  attach(rec: Omit<MountRec, 'id' | 'applied' | 'hidden'>): MountRec {
    const m: MountRec = { ...rec, id: this.nextMount++, applied: false };
    this.mounts.push(m);
    if (m.ino !== undefined) this.apply(m);
    else m.applied = true;
    return m;
  }

  private apply(m: MountRec): void {
    if (m.applied || m.ino === undefined) return;
    m.hidden = this.host.vfs.swapDir(m.target, m.ino);
    m.applied = true;
  }

  private unapply(m: MountRec): void {
    if (!m.applied || m.hidden === undefined) return;
    m.ino = this.host.vfs.swapDir(m.target, m.hidden);
    m.applied = false;
  }

  /** Detach the topmost mount at a target. */
  detach(target: string): MountRec | null {
    const t = normalize(target);
    const list = this.visibleMounts().filter((m) => m.target === t);
    const m = list[list.length - 1];
    if (!m) return null;
    if (m.ino !== undefined || m.hidden !== undefined) this.unapply(m);
    this.mounts = this.mounts.filter((x) => x !== m);
    return m;
  }

  /** Switch which mnt namespace's private mounts are on the tree (entering/leaving a session). */
  activateMnt(ns: number): void {
    if (ns === this.activeMnt) return;
    for (const m of [...this.mounts].reverse()) if (m.ns === this.activeMnt && m.ns !== HOST_NS.mnt) this.unapply(m);
    this.activeMnt = ns;
    for (const m of this.mounts) if (m.ns === ns && m.ns !== HOST_NS.mnt) this.apply(m);
  }

  // ── overlayfs: merged = upper over lowers; changes in merged go to upper ──

  /** Build the merged tree of an overlay and its baseline. */
  overlayMerge(lower: string[], upper: string): { ino: number; base: Record<string, string> } {
    const vfs = this.host.vfs;
    const merged = vfs.newDir();
    const layers = [...lower].reverse().concat(upper ? [upper] : []);
    for (const layer of layers) {
      const ino = vfs.inoOf(layer);
      if (ino === undefined) throw new FsError('ENOENT', layer);
      for (const e of vfs.listFrom(ino)) {
        const target = this.pathIn(merged, e.rel);
        const exists = vfs.statAs(target.abs, ROOT_CRED, false);
        if (e.stat.type === 'c' && e.stat.dev === 'whiteout') {
          if (exists) this.rmTree(target.abs);
          continue;
        }
        if (exists && exists.type === 'd' && e.stat.type === 'd') continue;
        if (exists) this.rmTree(target.abs);
        if (e.stat.type === 'd') vfs.mkdirAs(target.abs, ROOT_CRED);
        else if (e.stat.type === 'l') vfs.symlinkAs(e.stat.target ?? '', target.abs, ROOT_CRED);
        else if (e.stat.type === 'c') vfs.mknod(target.abs, e.stat.dev ?? 'null');
        else vfs.writeFileAs(target.abs, e.text ?? '', ROOT_CRED);
        if (e.stat.type !== 'l') {
          vfs.chmodAs(target.abs, e.stat.mode, ROOT_CRED);
          vfs.chownAs(target.abs, e.stat.uid, e.stat.gid, ROOT_CRED);
        }
      }
    }
    this.detachScratch();
    return { ino: merged, base: this.treeSig(merged) };
  }

  /** A scratch mount point to address a detached tree by path while building it. */
  private scratch: { ino: number; hidden: number } | null = null;
  private pathIn(ino: number, rel: string): { abs: string } {
    const vfs = this.host.vfs;
    if (!this.scratch || this.scratch.ino !== ino) {
      this.detachScratch();
      if (!vfs.statAs('/run/.overlay-scratch', ROOT_CRED)) vfs.mkdirAs('/run/.overlay-scratch', ROOT_CRED, { parents: true });
      this.scratch = { ino, hidden: vfs.swapDir('/run/.overlay-scratch', ino) };
    }
    return { abs: `/run/.overlay-scratch/${rel}` };
  }
  private detachScratch(): void {
    if (!this.scratch) return;
    this.host.vfs.swapDir('/run/.overlay-scratch', this.scratch.hidden);
    this.scratch = null;
  }

  private treeSig(ino: number): Record<string, string> {
    const out: Record<string, string> = {};
    for (const e of this.host.vfs.listFrom(ino)) out[e.rel] = `${e.stat.type}:${e.stat.mode}:${e.stat.uid}:${e.stat.type === 'f' ? (e.text ?? '') : (e.stat.target ?? '')}`;
    return out;
  }

  /** After a command: copy up what changed in merged, put whiteouts for what was deleted. */
  syncOverlays(): void {
    const vfs = this.host.vfs;
    for (const m of this.mounts) {
      if (!m.overlay || !m.applied || m.ino === undefined) continue;
      const ino = vfs.inoOf(m.target);
      if (ino === undefined) continue;
      const now = this.treeSig(ino);
      const base = m.overlay.base;
      if (JSON.stringify(now) === JSON.stringify(base)) continue;
      const upper = m.overlay.upper;
      for (const [rel, sig] of Object.entries(now)) {
        if (base[rel] === sig) continue;
        const src = `${m.target}/${rel}`;
        const dst = `${upper}/${rel}`;
        const st = vfs.statAs(src, ROOT_CRED, false)!;
        const parent = dst.slice(0, dst.lastIndexOf('/'));
        if (!vfs.statAs(parent, ROOT_CRED)) vfs.mkdirAs(parent, ROOT_CRED, { parents: true });
        const ex = vfs.statAs(dst, ROOT_CRED, false);
        if (ex && !(ex.type === 'd' && st.type === 'd')) this.rmTree(dst);
        if (st.type === 'd') {
          if (!vfs.statAs(dst, ROOT_CRED)) vfs.mkdirAs(dst, ROOT_CRED);
        } else if (st.type === 'l') vfs.symlinkAs(st.target ?? '', dst, ROOT_CRED);
        else vfs.writeFileAs(dst, vfs.readFileAs(src, ROOT_CRED), ROOT_CRED);
        if (st.type !== 'l') {
          vfs.chmodAs(dst, st.mode, ROOT_CRED);
          vfs.chownAs(dst, st.uid, st.gid, ROOT_CRED);
        }
      }
      const inLower = (rel: string) => m.overlay!.lower.some((l) => vfs.statAs(`${l}/${rel}`, ROOT_CRED, false));
      for (const rel of Object.keys(base)) {
        if (rel in now) continue;
        const parentGone = rel.includes('/') && !(rel.slice(0, rel.lastIndexOf('/')) in now);
        if (parentGone) continue;
        const dst = `${upper}/${rel}`;
        if (vfs.statAs(dst, ROOT_CRED, false)) this.rmTree(dst);
        if (inLower(rel)) {
          const parent = dst.slice(0, dst.lastIndexOf('/'));
          if (!vfs.statAs(parent, ROOT_CRED)) vfs.mkdirAs(parent, ROOT_CRED, { parents: true });
          vfs.mknod(dst, 'whiteout');
        }
      }
      m.overlay.base = now;
    }
  }

  // ── snapshots ──
  snapshot(): KernelSnapshot {
    return {
      ns: [...this.ns.values()],
      nextNs: this.nextNs,
      mounts: this.mounts.map((m) => ({ ...m })),
      nextMount: this.nextMount,
      fileCaps: [...this.fileCaps],
      dmesg: [...this.dmesg],
      activeMnt: this.activeMnt,
    };
  }

  restore(s: unknown): void {
    const k = s as KernelSnapshot;
    this.ns = new Map(k.ns.map((n) => [n.id, { ...n }]));
    this.nextNs = k.nextNs;
    this.mounts = k.mounts.map((m) => ({ ...m }));
    this.nextMount = k.nextMount;
    this.fileCaps = new Map(k.fileCaps);
    this.dmesg = [...k.dmesg];
    this.activeMnt = k.activeMnt;
    this.procSig = '';
  }
}
