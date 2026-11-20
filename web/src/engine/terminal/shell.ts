// The tier-A simulated machine ("Стенд"): a virtual file system, users, a
// process table, a kernel model (namespaces, cgroups, capabilities, mounts),
// systemd, and a bash-like shell with PATH lookup, jobs, compound commands
// and nested sessions (su, sudo -i, unshare, chroot, ssh to localhost). It
// implements the Machine interface, so the terminal widget and the checks do
// not know they talk to a simulator.

import { bi, t } from '../../core/i18n';
import type {
  CmdContext,
  Cred,
  ExecResult,
  Facts,
  FileFact,
  FsApi,
  GroupEntry,
  Machine,
  ProcFact,
  ProcTable,
  ShellCommand,
  SimEvent,
  SimMachineApi,
  Snapshotable,
  TermEffect,
  TermRecord,
  TerminalSession,
  TerminalSetup,
  UserAccount,
} from '../../core/types';
import { controlIncomplete, groupOf, hasGroup, parseControl, splitAndOr, type CNode } from './control';
import { globToRegExp, hasGlob, parse, type AndOr, type Pipeline, type SimpleCommand, type Word } from './parser';
import { terminalRegistry, type TerminalRegistry } from './registry';
import { CAP_FULL, HOST_NS, Kernel, MEM_BASE_USED, MEM_CACHE, MEM_TOTAL, NS_TYPES, capHex, kcred, type KProc, type NsType } from './kernel';
import { Systemd } from './systemd';
import { FsError, ROOT_CRED, Vfs, basename, isFsError, joinPath, normalize, octal, type VfsSnapshot } from './vfs';

export const KERNEL = '6.12.0-dt-sim';
export const KERNEL_CMDLINE = 'BOOT_IMAGE=/boot/vmlinuz-6.12.0-dt-sim root=/dev/sda1 ro quiet';

/** Strip ANSI escape sequences (for facts and output matching). */
export function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
}

class ExitSignal {
  constructor(public code: number) {}
}

export class ForkError extends Error {}

export interface ShellOpts {
  errexit: boolean;
  nounset: boolean;
  xtrace: boolean;
  pipefail: boolean;
}

const defaultOpts = (): ShellOpts => ({ errexit: false, nounset: false, xtrace: false, pipefail: false });

/** Who a command runs as when it is not the session user (sudo, systemd User=). */
export interface RunAs {
  user: UserAccount;
  capEff: string;
}

/** A command started by systemd as the main process of a unit. */
export interface ServiceCtx {
  unit: string;
  /** Set when the script hands over to a long-running program (exec web-demo …). */
  daemon?: string[];
}

interface Frame {
  out: (s: string) => void;
  err: (s: string) => void;
  args: string[];
  isatty: boolean;
  cwd?: string;
  opts?: ShellOpts;
  as?: RunAs;
  root?: string;
  loopInput?: string[];
  service?: ServiceCtx;
  interactive?: boolean;
  /** The process that runs the commands of this frame (the shell or a script). */
  ppid?: number;
}

/** Signal names and numbers (signal(7), x86). */
export const SIGNALS: [string, number][] = [
  ['HUP', 1], ['INT', 2], ['QUIT', 3], ['ILL', 4], ['TRAP', 5], ['ABRT', 6], ['BUS', 7], ['FPE', 8], ['KILL', 9], ['USR1', 10],
  ['SEGV', 11], ['USR2', 12], ['PIPE', 13], ['ALRM', 14], ['TERM', 15], ['STKFLT', 16], ['CHLD', 17], ['CONT', 18], ['STOP', 19], ['TSTP', 20],
  ['TTIN', 21], ['TTOU', 22], ['URG', 23], ['XCPU', 24], ['XFSZ', 25], ['VTALRM', 26], ['PROF', 27], ['WINCH', 28], ['IO', 29], ['PWR', 30], ['SYS', 31],
];
export const sigNum = (name: string) => SIGNALS.find(([n]) => n === name)?.[1];
export const sigName = (n: number) => SIGNALS.find(([, x]) => x === n)?.[0];
/** Parse "TERM", "SIGTERM", "15", "-9" into a signal name. */
export function parseSignal(s: string): string | null {
  const v = s.replace(/^-/, '').toUpperCase().replace(/^SIG/, '');
  if (/^\d+$/.test(v)) return sigName(Number(v)) ?? null;
  return sigNum(v) ? v : null;
}

const TERMINATING = new Set(['HUP', 'INT', 'QUIT', 'ILL', 'TRAP', 'ABRT', 'BUS', 'FPE', 'KILL', 'USR1', 'SEGV', 'USR2', 'PIPE', 'ALRM', 'TERM', 'STKFLT', 'XCPU', 'XFSZ', 'VTALRM', 'PROF', 'IO', 'PWR', 'SYS']);
const STOPPING = new Set(['STOP', 'TSTP', 'TTIN', 'TTOU']);

class Procs implements ProcTable {
  table = new Map<number, KProc>();
  next = 100;
  onExit?: (p: KProc, code: number, reason: string, sig?: string) => void;
  defaults: () => Omit<KProc, 'pid' | 'ppid' | 'uid' | 'state' | 'cmd' | 'argv'> = () => ({
    ns: { ...HOST_NS },
    nspid: [],
    cgroup: '/system.slice',
    capEff: capHex(CAP_FULL),
    root: '/',
    seccomp: 0,
    threads: 1,
    rss: 1200,
    cpuWant: 0,
    nice: 0,
    start: Date.now(),
    tty: '?',
  });
  constructor(private emit: (ev: { t: string; [k: string]: unknown }) => void) {}
  list(): ProcFact[] {
    return [...this.table.values()].sort((a, b) => a.pid - b.pid);
  }
  get(pid: number): KProc | undefined {
    return this.table.get(pid);
  }
  spawn(p: { cmd: string; argv?: string[]; uid?: number; ppid?: number; state?: ProcFact['state']; pid?: number; [k: string]: unknown }): number {
    const pid = typeof p.pid === 'number' ? p.pid : this.next++;
    if (pid >= this.next) this.next = pid + 1;
    const { cmd, argv, uid, ppid, state, ...rest } = p;
    const base = this.defaults();
    const proc = { ...base, ...rest, pid, ppid: ppid ?? 1, uid: uid ?? 0, state: state ?? 'S', cmd, argv: argv ?? [cmd] } as KProc;
    if (!proc.nspid?.length) proc.nspid = [pid];
    this.table.set(pid, proc);
    this.emit({ t: 'proc.spawn', pid, ppid: ppid ?? 1, cmd, uid: uid ?? 0 });
    return pid;
  }
  /** Deliver a signal; default actions as in signal(7). Returns false if there is no such pid. */
  kill(pid: number, sig = 'TERM'): boolean {
    const p = this.table.get(pid);
    if (!p) return false;
    const name = sig.replace(/^SIG/, '').toUpperCase();
    const handled = (p.ignores ?? []).includes(name) && name !== 'KILL' && name !== 'STOP';
    this.emit({ t: 'proc.signal', pid, sig: name, handled });
    if (handled) return true;
    if (name === 'KILL' || TERMINATING.has(name)) this.exit(pid, 128 + (sigNum(name) ?? 15), 'signal', name);
    else if (STOPPING.has(name)) p.state = 'T';
    else if (name === 'CONT') p.state = p.cpuWant > 0 ? 'R' : 'S';
    return true;
  }
  exit(pid: number, code: number, reason = 'exit', sig?: string): void {
    const p = this.table.get(pid);
    if (!p) return;
    this.table.delete(pid);
    this.emit({ t: 'proc.exit', pid, code, reason, sig });
    this.onExit?.(p, code, reason, sig);
  }
  snapshot() {
    return { next: this.next, procs: [...this.table.values()] };
  }
  restore(s: { next: number; procs: KProc[] }) {
    this.next = s.next;
    this.table = new Map(s.procs.map((p) => [p.pid, { ...p }]));
  }
}

/** A program that keeps running in the background or as a service. */
export interface ProgramSpec {
  /** `prog &`: the process to put in the table (fields of KProc), or an error. */
  background?(argv: string[], m: SimMachine, as: RunAs): Partial<KProc> | { error: string; exit: number };
  /** Started by systemd (or by exec at the end of a unit's script): does it come up, and what does it log? */
  daemon?(argv: string[], m: SimMachine, as: RunAs, unit: string): DaemonStart;
}

export interface DaemonStart {
  ok: boolean;
  logs: string[];
  exit?: number;
  listen?: number[];
  rss?: number;
  threads?: number;
  /** Extra processes of the service (nginx workers). */
  children?: { cmd: string; argv: string[]; uid?: number }[];
  ignores?: string[];
}

export function isBgError(x: Partial<KProc> | { error: string; exit: number }): x is { error: string; exit: number } {
  return typeof (x as { error?: unknown }).error === 'string';
}

/** Long-running programs known to the machine; command modules register theirs. */
export const PROGRAMS = new Map<string, ProgramSpec>();
export function registerProgram(name: string, spec: ProgramSpec): void {
  PROGRAMS.set(name, spec);
}

/** Set by the bridge to the network engine: put the programs that listen into its world before its commands run. */
let netBridge: ((m: SimMachine, cmd: string) => void) | undefined;
export function setNetBridge(fn: (m: SimMachine, cmd: string) => void): void {
  netBridge = fn;
}

/** Commands that live in /usr/sbin (administration). */
export const SBIN = new Set(['useradd', 'usermod', 'userdel', 'groupadd', 'chpasswd', 'chroot', 'mkfs.ext4', 'mkfs', 'fdisk', 'sshd', 'nginx', 'capsh', 'getcap', 'setcap', 'getpcaps', 'blkid', 'cron', 'ip']);
/** Commands that exist only after `apt install` of their package. */
export const PACKAGED = new Map<string, string>();

export interface Job {
  n: number;
  pid: number;
  line: string;
  state: 'Running' | 'Stopped' | 'Done' | 'Killed' | 'Terminated';
  code?: number;
  notified?: boolean;
}

interface Session {
  user: string;
  cwd: string;
  vars: Record<string, string>;
  exported: string[];
  pid: number;
  opts: ShellOpts;
  label?: string;
}

export interface SimMachineOptions {
  id?: string;
  hostname?: string;
  registry?: TerminalRegistry;
  cols?: number;
}

export interface SimSnapshot {
  v: 2;
  fs: VfsSnapshot;
  users: UserAccount[];
  groups: GroupEntry[];
  vars: Record<string, string>;
  exported: string[];
  cwd: string;
  user: string;
  hostname: string;
  history: string[];
  term: TermRecord[];
  procs: ReturnType<Procs['snapshot']>;
  lastExit: number;
  ext: Record<string, unknown>;
  shellPid: number;
  stack: Session[];
  jobs: Job[];
  opts: ShellOpts;
  aliases: [string, string][];
  offset: number;
}

const DEFAULT_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';

export class SimMachine implements SimMachineApi {
  readonly kind = 'sim' as const;
  readonly id: string;
  hostname: string;
  readonly vfs = new Vfs();
  readonly rootFs: FsApi;
  readonly procs: Procs;
  readonly kernel: Kernel;
  users: UserAccount[] = [];
  groups: GroupEntry[] = [];
  vars: Record<string, string> = {};
  private exported = new Set<string>();
  private cwdPath = '/';
  private userName = 'root';
  private lastExit = 0;
  private hist: string[] = [];
  private term: TermRecord[] = [];
  private listeners = new Set<(ev: SimEvent) => void>();
  private extState = new Map<string, unknown>();
  private pendingExt: Record<string, unknown> = {};
  private effects: TermEffect[] = [];
  shellPid = 0;
  private stack: Session[] = [];
  jobs: Job[] = [];
  opts: ShellOpts = defaultOpts();
  aliases = new Map<string, string>();
  private sessions: (TerminalSession & { dispose?(): void })[] = [];
  private local = new Map<string, ShellCommand>();
  /** The pid of the command running right now (for /proc/self and ps). */
  current = 0;
  readonly registry: TerminalRegistry;
  cols: number;
  /** Virtual clock: starts at a fixed course date so outputs are reproducible. */
  private clockBase = Date.UTC(2026, 10, 18, 9, 0, 0);
  private clockStart = Date.now();
  private offset = 0;
  private lastTick = 0;
  readonly bootAt: number;

  constructor(opts: SimMachineOptions = {}) {
    this.id = opts.id ?? 'host';
    this.hostname = opts.hostname ?? 'trainer';
    this.registry = opts.registry ?? terminalRegistry;
    this.cols = opts.cols ?? 80;
    this.vfs.clock = () => this.now();
    this.rootFs = this.vfs.view(ROOT_CRED, () => '/');
    this.procs = new Procs((ev) => this.emit(ev));
    this.procs.defaults = () => ({
      ns: { ...HOST_NS },
      nspid: [],
      cgroup: '/system.slice',
      capEff: capHex(CAP_FULL),
      root: '/',
      seccomp: 0,
      threads: 1,
      rss: 1200,
      cpuWant: 0,
      nice: 0,
      start: this.now(),
      tty: '?',
    });
    this.procs.onExit = (p, code, reason, sig) => this.onProcExit(p, code, reason, sig);
    this.kernel = new Kernel({
      vfs: this.vfs,
      now: () => this.now(),
      procs: this.procs,
      kernelKill: (pid, sig) => this.procs.kill(pid, sig),
      viewPid: () => this.shellPid,
      userName: (uid) => this.users.find((u) => u.uid === uid)?.name ?? String(uid),
    });
    this.extState.set('kernel', this.kernel);
    this.bootAt = this.now() - 3 * 60 * 1000;
    this.boot();
  }

  now(): number {
    return this.clockBase + (Date.now() - this.clockStart) + this.offset;
  }

  /** Move the virtual clock forward (sleep, waiting for a restart) and let timers fire. */
  advance(ms: number): void {
    this.offset += Math.max(0, ms);
    this.tick();
  }

  get systemd(): Systemd {
    return this.ext('systemd', () => new Systemd(this));
  }

  // ── boot ──
  private boot(): void {
    const fs = this.vfs;
    const dirs: [string, number][] = [
      ['/bin', 0o755],
      ['/boot', 0o755],
      ['/dev', 0o755],
      ['/dev/pts', 0o755],
      ['/etc', 0o755],
      ['/etc/systemd/system', 0o755],
      ['/etc/systemd/system/multi-user.target.wants', 0o755],
      ['/etc/sudoers.d', 0o750],
      ['/etc/ssh', 0o755],
      ['/etc/apt', 0o755],
      ['/etc/cron.d', 0o755],
      ['/home', 0o755],
      ['/media', 0o755],
      ['/mnt', 0o755],
      ['/opt', 0o755],
      ['/proc', 0o555],
      ['/root', 0o700],
      ['/run', 0o755],
      ['/sbin', 0o755],
      ['/srv', 0o755],
      ['/sys', 0o555],
      ['/tmp', 0o1777],
      ['/usr', 0o755],
      ['/usr/bin', 0o755],
      ['/usr/sbin', 0o755],
      ['/usr/lib/systemd/system', 0o755],
      ['/usr/local', 0o755],
      ['/usr/local/bin', 0o755],
      ['/usr/local/sbin', 0o755],
      ['/usr/share', 0o755],
      ['/usr/share/doc', 0o755],
      ['/var', 0o755],
      ['/var/lib', 0o755],
      ['/var/lib/dpkg', 0o755],
      ['/var/lib/apt/lists', 0o755],
      ['/var/log', 0o755],
      ['/var/log/journal', 0o2755],
      ['/var/spool/cron/crontabs', 0o1730],
      ['/var/tmp', 0o1777],
    ];
    for (const [d, mode] of dirs) {
      fs.mkdirAs(d, ROOT_CRED, { parents: true });
      fs.chmodAs(d, mode, ROOT_CRED);
    }
    fs.symlinkAs('usr/lib', '/lib', ROOT_CRED);
    fs.mknod('/dev/null', 'null');
    fs.mknod('/dev/tty', 'tty');
    fs.mknod('/dev/zero', 'zero');
    fs.mknod('/dev/pts/0', 'tty', { mode: 0o620, uid: 1000, gid: 5 });
    fs.mknod('/dev/sda', 'blk:sda', { gid: 6 });
    fs.mknod('/dev/sda1', 'blk:sda1', { gid: 6 });
    fs.mknod('/dev/sdb', 'blk:sdb', { gid: 6 });
    this.groups = [
      { name: 'root', gid: 0 },
      { name: 'daemon', gid: 1 },
      { name: 'adm', gid: 4 },
      { name: 'tty', gid: 5 },
      { name: 'disk', gid: 6 },
      { name: 'sudo', gid: 27 },
      { name: 'www-data', gid: 33 },
      { name: 'shadow', gid: 42 },
      { name: 'users', gid: 100 },
      { name: 'systemd-journal', gid: 999 },
      { name: 'nogroup', gid: 65534 },
    ];
    this.users = [
      { name: 'root', uid: 0, gid: 0, home: '/root', shell: '/bin/bash', groups: [0] },
      { name: 'daemon', uid: 1, gid: 1, home: '/usr/sbin', shell: '/usr/sbin/nologin', groups: [1] },
      { name: 'www-data', uid: 33, gid: 33, home: '/var/www', shell: '/usr/sbin/nologin', groups: [33] },
      { name: 'nobody', uid: 65534, gid: 65534, home: '/nonexistent', shell: '/usr/sbin/nologin', groups: [65534] },
    ];
    const etc: [string, string, number?][] = [
      ['/etc/hostname', `${this.hostname}\n`],
      ['/etc/os-release', 'PRETTY_NAME="Debian GNU/Linux 13 (trixie)"\nNAME="Debian GNU/Linux"\nVERSION_ID="13"\nVERSION="13 (trixie)"\nVERSION_CODENAME=trixie\nID=debian\nHOME_URL="https://www.debian.org/"\n'],
      ['/etc/debian_version', '13.1\n'],
      ['/etc/shells', '/bin/sh\n/bin/bash\n/usr/bin/bash\n'],
      ['/etc/hosts', `127.0.0.1\tlocalhost\n127.0.1.1\t${this.hostname}\n::1\t\tlocalhost ip6-localhost ip6-loopback\n`],
      ['/etc/fstab', '# <file system> <mount point> <type> <options> <dump> <pass>\nUUID=3b8f6c1e-5d1a-4f6e-9a57-2c1f0e7d9a10 /    ext4 errors=remount-ro 0 1\n'],
      ['/etc/sudoers', 'Defaults\tenv_reset\nDefaults\tsecure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"\nroot\tALL=(ALL:ALL) ALL\n%sudo\tALL=(ALL:ALL) ALL\n@includedir /etc/sudoers.d\n', 0o440],
      ['/etc/sudoers.d/90-learner', '# the trainer machine: members of sudo run commands without a password\n%sudo ALL=(ALL:ALL) NOPASSWD: ALL\n', 0o440],
      ['/etc/profile', 'if [ "$(id -u)" -eq 0 ]; then\n  PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"\nelse\n  PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"\nfi\nexport PATH\n'],
      ['/etc/bash.bashrc', '# System-wide .bashrc file for interactive bash(1) shells.\nPS1=\'\\u@\\h:\\w\\$ \'\n'],
      ['/etc/crontab', 'SHELL=/bin/sh\nPATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin\n# m h dom mon dow user\tcommand\n17 *\t* * *\troot\tcd / && run-parts --report /etc/cron.hourly\n25 6\t* * *\troot\ttest -x /usr/sbin/anacron || run-parts --report /etc/cron.daily\n'],
      ['/etc/ssh/sshd_config', 'Include /etc/ssh/sshd_config.d/*.conf\n#Port 22\n#PermitRootLogin prohibit-password\n#StrictModes yes\n#PubkeyAuthentication yes\nPasswordAuthentication no\nKbdInteractiveAuthentication no\nUsePAM yes\nX11Forwarding yes\nPrintMotd no\nSubsystem\tsftp\t/usr/lib/openssh/sftp-server\n'],
      ['/etc/apt/sources.list', 'deb http://deb.debian.org/debian trixie main\ndeb http://deb.debian.org/debian trixie-updates main\ndeb http://security.debian.org/debian-security trixie-security main\n'],
      ['/etc/shadow', 'root:*:20409:0:99999:7:::\ndaemon:*:20409:0:99999:7:::\nwww-data:*:20409:0:99999:7:::\nnobody:*:20409:0:99999:7:::\n', 0o640],
    ];
    for (const [p, text, mode] of etc) {
      fs.writeFileAs(p, text, ROOT_CRED);
      if (mode !== undefined) fs.chmodAs(p, mode, ROOT_CRED);
    }
    fs.chownAs('/etc/shadow', 0, 42, ROOT_CRED);
    fs.writeFileAs('/boot/vmlinuz-6.12.0-dt-sim', '', ROOT_CRED);
    fs.writeFileAs('/boot/config-6.12.0-dt-sim', 'CONFIG_CGROUPS=y\nCONFIG_MEMCG=y\nCONFIG_NAMESPACES=y\nCONFIG_USER_NS=y\nCONFIG_PID_NS=y\nCONFIG_OVERLAY_FS=m\nCONFIG_SECCOMP_FILTER=y\n', ROOT_CRED);
    this.addUser('learner', { uid: 1000, groups: ['adm', 'sudo', 'users'] });
    this.syncEtc();
    this.installStubs();
    this.vfs.hooks = {
      beforeWrite: (abs, data, append, cred) =>
        this.kernel.cgroupWrite(abs, data, append, cred, (pid, cg) => {
          const view = this.pidByView(pid);
          if (!view) return false;
          view.cgroup = cg;
          return true;
        }),
      afterMkdir: (abs) => {
        const rel = this.kernel.isCgroupPath(abs);
        if (rel !== null && rel !== '/') this.kernel.mkCgroup(abs);
      },
      beforeRmdir: (abs) => this.kernel.cgroupRmdir(abs),
    };
    this.kernel.bootCgroups();
    for (const [source, target, fstype, options] of [
      ['/dev/sda1', '/', 'ext4', 'rw,relatime,errors=remount-ro'],
      ['udev', '/dev', 'devtmpfs', 'rw,nosuid,relatime,size=987596k,mode=755'],
      ['proc', '/proc', 'proc', 'rw,nosuid,nodev,noexec,relatime'],
      ['sysfs', '/sys', 'sysfs', 'rw,nosuid,nodev,noexec,relatime'],
      ['cgroup2', '/sys/fs/cgroup', 'cgroup2', 'rw,nosuid,nodev,noexec,relatime,nsdelegate,memory_recursiveprot'],
      ['tmpfs', '/run', 'tmpfs', 'rw,nosuid,nodev,noexec,relatime,size=201320k,mode=755'],
      ['tmpfs', '/tmp', 'tmpfs', 'rw,nosuid,nodev,size=1006592k,nr_inodes=1048576'],
    ]) {
      this.kernel.attach({ source, target, fstype, options, ns: HOST_NS.mnt });
    }
    this.procs.spawn({ pid: 1, cmd: 'systemd', argv: ['/sbin/init'], uid: 0, ppid: 0, cgroup: '/init.scope', rss: 11800, start: this.bootAt });
    this.procs.spawn({ pid: 2, cmd: 'kthreadd', argv: ['[kthreadd]'], uid: 0, ppid: 0, cgroup: '/', rss: 0, start: this.bootAt });
    this.systemd.boot();
    this.kernel.log(`Linux version ${KERNEL} (builder@trainer) #1 SMP PREEMPT_DYNAMIC Debian 6.12.0`);
    this.kernel.log(`Command line: ${KERNEL_CMDLINE}`);
    this.kernel.log('Memory: 1966080K/2097152K available');
    this.kernel.log('EXT4-fs (sda1): mounted filesystem with ordered data mode. Quota mode: none.');
    this.kernel.log('Run /sbin/init as init process');
    this.login('learner');
  }

  /** Program stubs in /usr/bin and /usr/sbin, so PATH lookup, `ls /usr/bin` and `which` look real. */
  installStubs(): void {
    for (const c of this.registry.commands.list()) {
      if (c.builtin || PACKAGED.has(c.name)) continue;
      for (const n of [c.name, ...(c.aliases ?? [])]) this.installStub(n);
    }
    for (const sh of ['sh', 'bash']) {
      const p = `/bin/${sh}`;
      if (!this.vfs.statAs(p, ROOT_CRED)) {
        this.vfs.writeFileAs(p, `#!/usr/bin/sim\n# ${sh}: the GNU Bourne-Again SHell (simulated)\n`, ROOT_CRED);
        this.vfs.chmodAs(p, 0o755, ROOT_CRED);
      }
    }
  }

  installStub(name: string, dir?: string): string {
    const d = dir ?? (SBIN.has(name) ? '/usr/sbin' : '/usr/bin');
    const p = `${d}/${name}`;
    if (!this.vfs.statAs(p, ROOT_CRED)) {
      this.vfs.writeFileAs(p, `#!/usr/bin/sim\n# ${name}: a simulated program of DevOps Trainer\n`, ROOT_CRED);
      this.vfs.chmodAs(p, 0o755, ROOT_CRED);
    }
    return p;
  }

  addUser(name: string, o: { uid?: number; home?: string; groups?: string[]; shell?: string; createHome?: boolean } = {}): UserAccount {
    const existing = this.users.find((u) => u.name === name);
    if (existing) return existing;
    const uid = o.uid ?? Math.max(999, ...this.users.filter((u) => u.uid < 60000).map((u) => u.uid)) + 1;
    let g = this.groups.find((x) => x.name === name);
    if (!g) {
      g = { name, gid: this.groups.some((x) => x.gid === uid) ? Math.max(1000, ...this.groups.filter((x) => x.gid < 60000).map((x) => x.gid)) + 1 : uid };
      this.groups.push(g);
    }
    const extra = (o.groups ?? []).map((gn) => {
      let gg = this.groups.find((x) => x.name === gn);
      if (!gg) {
        gg = { name: gn, gid: Math.max(1000, ...this.groups.filter((x) => x.gid < 60000).map((x) => x.gid)) + 1 };
        this.groups.push(gg);
      }
      return gg.gid;
    });
    const home = o.home ?? `/home/${name}`;
    const u: UserAccount = { name, uid, gid: g.gid, home, shell: o.shell ?? '/bin/bash', groups: [g.gid, ...extra.filter((x) => x !== g!.gid)] };
    this.users.push(u);
    if (o.createHome !== false && !this.vfs.statAs(home, ROOT_CRED)) {
      this.vfs.mkdirAs(home, ROOT_CRED, { parents: true });
      this.vfs.chownAs(home, uid, g.gid, ROOT_CRED);
      this.vfs.chmodAs(home, 0o750, ROOT_CRED);
      this.vfs.writeFileAs(`${home}/.bashrc`, '# ~/.bashrc: executed by bash(1) for non-login shells.\n', ROOT_CRED);
      this.vfs.chownAs(`${home}/.bashrc`, uid, g.gid, ROOT_CRED);
      this.vfs.writeFileAs(`${home}/.profile`, '# ~/.profile: executed by the command interpreter for login shells.\n', ROOT_CRED);
      this.vfs.chownAs(`${home}/.profile`, uid, g.gid, ROOT_CRED);
    }
    this.syncEtc();
    return u;
  }

  syncEtc(): void {
    const passwd = this.users.map((u) => `${u.name}:x:${u.uid}:${u.gid}:${u.name === 'root' ? 'root' : u.uid >= 1000 && u.uid < 60000 ? `${u.name},,,` : u.name}:${u.home}:${u.shell}`).join('\n') + '\n';
    const group =
      this.groups
        .map((g) => {
          const members = this.users.filter((u) => u.groups.includes(g.gid) && u.gid !== g.gid).map((u) => u.name);
          return `${g.name}:x:${g.gid}:${members.join(',')}`;
        })
        .join('\n') + '\n';
    this.vfs.writeFileAs('/etc/passwd', passwd, ROOT_CRED);
    this.vfs.writeFileAs('/etc/group', group, ROOT_CRED);
    let shadow = '';
    try {
      shadow = this.vfs.readFileAs('/etc/shadow', ROOT_CRED);
    } catch {
      /* first boot */
    }
    const known = new Set(shadow.split('\n').map((l) => l.split(':')[0]));
    const add = this.users.filter((u) => !known.has(u.name)).map((u) => `${u.name}:${u.uid >= 1000 && u.uid < 60000 ? '$y$j9T$trainer$Qm3xVvT0pR8kH2sJ9wL1cF5nA7dE4gB6' : '*'}:20409:0:99999:7:::`);
    if (add.length && this.vfs.statAs('/etc/shadow', ROOT_CRED)) this.vfs.writeFileAs('/etc/shadow', shadow + add.join('\n') + '\n', ROOT_CRED);
  }

  private envFor(u: UserAccount): Record<string, string> {
    return {
      HOME: u.home,
      USER: u.name,
      LOGNAME: u.name,
      SHELL: u.shell,
      PATH: DEFAULT_PATH,
      PWD: u.home,
      HOSTNAME: this.hostname,
      TERM: 'xterm-256color',
      LANG: 'C.UTF-8',
    };
  }

  private login(name: string): void {
    const u = this.users.find((x) => x.name === name)!;
    for (const s of this.stack.reverse()) if (this.procs.get(s.pid)) this.procs.exit(s.pid, 0, 'exit');
    this.stack = [];
    this.kernel.activateMnt(HOST_NS.mnt);
    this.userName = u.name;
    this.cwdPath = u.home;
    this.vars = this.envFor(u);
    this.exported = new Set(Object.keys(this.vars));
    this.opts = defaultOpts();
    const old = this.shellPid;
    this.shellPid = 0;
    if (old) this.procs.exit(old, 0, 'exit');
    this.shellPid = this.procs.spawn({
      cmd: 'bash',
      argv: ['-bash'],
      uid: u.uid,
      ppid: 1,
      cgroup: u.uid === 0 ? '/user.slice' : `/user.slice/user-${u.uid}.slice/session-1.scope`,
      capEff: u.uid === 0 ? capHex(CAP_FULL) : capHex(0n),
      tty: 'pts/0',
      rss: 5200,
    });
    if (u.uid !== 0 && !this.kernel.cgroupPaths().includes(`/user.slice/user-${u.uid}.slice/session-1.scope`)) this.kernel.mkCgroup(`/sys/fs/cgroup/user.slice/user-${u.uid}.slice/session-1.scope`);
  }

  switchUser(name: string): boolean {
    if (!this.users.some((u) => u.name === name)) return false;
    this.login(name);
    return true;
  }

  user(): UserAccount {
    return this.users.find((u) => u.name === this.userName) ?? this.users[0];
  }

  shellProc(): KProc {
    return this.procs.get(this.shellPid) ?? (this.procs.get(1) as KProc);
  }

  cred(u: UserAccount = this.user(), capEff?: string): Cred {
    return kcred({ uid: u.uid, gid: u.gid, groups: u.groups }, capEff ?? (u.uid === this.user().uid ? this.shellProc().capEff : capHex(u.uid === 0 ? CAP_FULL : 0n)));
  }

  cwd(): string {
    return this.cwdPath;
  }

  /** The uid a process shows for a real uid, through the user namespace of the shell. */
  displayUid(uid: number): number {
    const userNs = this.kernel.ns.get(this.shellProc().ns.user);
    if (!userNs?.uidMap) return uid;
    const [inside, outside, count] = userNs.uidMap;
    return uid >= outside && uid < outside + count ? inside + (uid - outside) : 65534;
  }

  userName_(uid: number): string {
    const shown = this.displayUid(uid);
    return this.users.find((u) => u.uid === shown)?.name ?? String(shown);
  }

  /** The name a file's group shows, through the user namespace. */
  groupName_(gid: number): string {
    const userNs = this.kernel.ns.get(this.shellProc().ns.user);
    const g = userNs?.uidMap ? (gid === userNs.uidMap[1] ? 0 : 65534) : gid;
    return this.groups.find((x) => x.gid === g)?.name ?? String(g);
  }

  ext<T>(key: string, init: () => T): T {
    if (!this.extState.has(key)) {
      const v = init();
      this.extState.set(key, v);
      if (key in this.pendingExt && isSnapshotable(v)) {
        v.restore(this.pendingExt[key]);
        delete this.pendingExt[key];
      }
    }
    return this.extState.get(key) as T;
  }

  emit(ev: { t: string; [k: string]: unknown }): void {
    const full = { ...ev, at: this.now(), machine: this.id } as SimEvent;
    for (const fn of this.listeners) fn(full);
  }

  on(fn: (ev: SimEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  lookup(name: string): ShellCommand | undefined {
    return this.local.get(name) ?? this.registry.commands.get(name);
  }

  attach(session: TerminalSession & { dispose?(): void }): void {
    this.sessions.push(session);
  }

  addLocalCommand(cmd: ShellCommand): void {
    for (const n of [cmd.name, ...(cmd.aliases ?? [])]) {
      this.local.set(n, cmd);
      if (!cmd.builtin) this.installStub(n);
    }
  }

  // ── sessions: nested shells ──

  /**
   * Start a nested interactive shell (su, sudo -i, unshare, nsenter, chroot,
   * ssh to localhost). `exit` returns to the outer one.
   */
  pushShell(o: { user?: string; cwd?: string; env?: Record<string, string>; ns?: Partial<Record<NsType, number>>; pidChildNs?: number; root?: string; capEff?: string; label?: string; login?: boolean; cgroup?: string }): number {
    const parent = this.shellProc();
    this.stack.push({ user: this.userName, cwd: this.cwdPath, vars: { ...this.vars }, exported: [...this.exported], pid: this.shellPid, opts: { ...this.opts }, label: undefined });
    const u = this.users.find((x) => x.name === (o.user ?? this.userName))!;
    const ns = { ...parent.ns, ...(o.ns ?? {}) };
    const nsRec = this.kernel.ns.get(ns.pid);
    if (nsRec?.state === 'dead') throw new ForkError('fork: Cannot allocate memory');
    const pid = this.forkRaw({ cmd: o.label ?? 'bash', argv: [o.label ?? (o.login ? '-bash' : 'bash')], uid: u.uid, ppid: parent.pid, ns, root: o.root ?? parent.root, capEff: o.capEff ?? (u.uid === 0 ? capHex(CAP_FULL) : capHex(0n)), cgroup: o.cgroup ?? parent.cgroup, tty: parent.tty, rss: 4800, pidChildNs: o.pidChildNs });
    this.shellPid = pid;
    this.userName = u.name;
    if (o.login) {
      this.vars = { ...this.envFor(u), ...(o.env ?? {}) };
      this.exported = new Set(Object.keys(this.vars));
      this.cwdPath = o.cwd ?? (this.vfs.statAs(normalize((o.root && o.root !== '/' ? o.root : '') + u.home), ROOT_CRED) ? u.home : '/');
    } else {
      this.vars = { ...this.vars, ...(o.env ?? {}) };
      for (const k of Object.keys(o.env ?? {})) this.exported.add(k);
      this.cwdPath = o.cwd ?? this.cwdPath;
    }
    this.vars.PWD = this.cwdPath;
    this.opts = defaultOpts();
    this.kernel.activateMnt(ns.mnt);
    return pid;
  }

  /** Leave a nested shell (exit). Returns false when this is the login shell. */
  popShell(code = 0): boolean {
    const s = this.stack.pop();
    if (!s) return false;
    const pid = this.shellPid;
    this.shellPid = s.pid;
    this.userName = s.user;
    this.cwdPath = s.cwd;
    this.vars = s.vars;
    this.exported = new Set(s.exported);
    this.opts = s.opts;
    if (this.procs.get(pid)) this.procs.exit(pid, code, 'exit');
    this.kernel.activateMnt(this.shellProc().ns.mnt);
    return true;
  }

  depth(): number {
    return this.stack.length;
  }

  // ── processes ──

  /** Spawn a process with pids allocated in its pid namespace chain. */
  forkRaw(p: Partial<KProc> & { cmd: string; argv: string[]; uid: number; ppid: number; pidChildNs?: number }): number {
    const parent = this.procs.get(p.ppid) as (KProc & { pidChildNs?: number }) | undefined;
    const ns = { ...(p.ns ?? parent?.ns ?? HOST_NS) };
    if (!p.ns && parent?.pidChildNs) ns.pid = parent.pidChildNs;
    const pidNs = this.kernel.ns.get(ns.pid);
    if (pidNs && pidNs.state === 'dead') throw new ForkError('fork: Cannot allocate memory');
    const pid = this.procs.next;
    const nspid = this.kernel.allocPid(pid, ns.pid);
    const threads = Math.max(1, Math.min(1024, Math.floor(p.threads ?? 1)));
    for (let t = 1; t < threads; t++) this.kernel.allocPid(pid + t, ns.pid);
    const result = this.procs.spawn({ ...p, threads, ns, nspid, pid, start: this.now() } as never);
    this.procs.next = Math.max(this.procs.next, pid + threads);
    return result;
  }

  /** fork() as the shell does for a command: inherits the shell's namespaces, cgroup and root; checks pids.max. */
  fork(spec: { cmd: string; argv: string[]; as: RunAs; ppid?: number; root?: string; extra?: Partial<KProc> }): number {
    const parent = (this.procs.get(spec.ppid ?? this.shellPid) ?? this.shellProc()) as KProc;
    const cg = spec.extra?.cgroup ?? parent.cgroup;
    for (const a of this.kernel.ancestors(cg)) {
      if (a === '/') break;
      const max = this.kernel.limitOf(a, 'pids.max');
      if (this.kernel.pidsUsage(a) + 1 > max) {
        this.kernel.bumpEvent(a, 'pids.events', 'max');
        throw new ForkError('fork: retry: Resource temporarily unavailable');
      }
    }
    return this.forkRaw({
      cmd: spec.cmd.slice(0, 15),
      argv: spec.argv,
      uid: spec.as.user.uid,
      ppid: parent.pid,
      ns: { ...parent.ns, pid: (parent as KProc & { pidChildNs?: number }).pidChildNs ?? parent.ns.pid },
      root: spec.root ?? parent.root,
      capEff: spec.as.capEff,
      cgroup: cg,
      tty: parent.tty,
      rss: 900,
      state: 'R',
      ...(spec.extra ?? {}),
    });
  }

  private onProcExit(p: KProc, code: number, reason: string, sig?: string): void {
    // Orphans go to the init of their pid namespace (pid_namespaces(7)); the host init is 1.
    const nsRec = this.kernel.ns.get(p.ns.pid);
    const isNsInit = nsRec && nsRec.id !== HOST_NS.pid && nsRec.init === p.pid;
    for (const child of this.procs.list() as KProc[]) {
      if (child.ppid !== p.pid) continue;
      const childNs = this.kernel.ns.get(child.ns.pid);
      child.ppid = childNs && childNs.id !== HOST_NS.pid && childNs.init && childNs.init !== p.pid ? childNs.init : 1;
    }
    if (isNsInit) {
      nsRec.state = 'dead';
      for (const q of this.procs.list() as KProc[]) if (this.kernel.pidChain(q.ns.pid).includes(nsRec.id)) this.procs.exit(q.pid, 137, 'signal', 'KILL');
    }
    const job = this.jobs.find((j) => j.pid === p.pid && (j.state === 'Running' || j.state === 'Stopped'));
    if (job) {
      job.state = sig === 'KILL' ? 'Killed' : sig === 'TERM' ? 'Terminated' : sig ? 'Killed' : 'Done';
      job.code = code;
    }
    if (p.pid === this.shellPid && this.stack.length) this.popShell(code);
    if (this.extState.has('systemd')) this.systemd.onExit(p, code, sig, reason);
  }

  /** What a reboot does to the machine (systemd.reboot calls it): processes, sessions, tmpfs, mounts. */
  rebootReset(): void {
    this.stack = [];
    for (const session of this.sessions) session.dispose?.();
    this.sessions = [];
    for (const p of this.procs.list()) if (p.pid !== 1 && p.pid !== 2) this.procs.table.delete(p.pid);
    this.jobs = [];
    for (const m of [...this.kernel.mounts]) if (!['/', '/dev', '/proc', '/sys', '/sys/fs/cgroup', '/run', '/tmp'].includes(m.target) || m.ino !== undefined) this.kernel.detach(m.target);
    for (const dir of ['/tmp', '/run']) {
      for (const name of this.vfs.readdirAs(dir, ROOT_CRED)) {
        if (dir === '/run' && name === 'systemd') continue;
        this.rmTreeRoot(`${dir}/${name}`);
      }
    }
    for (const cg of this.kernel.cgroupPaths().reverse()) {
      if (['/', '/init.scope', '/system.slice', '/user.slice'].includes(cg) || cg.startsWith('/user.slice/user-1000.slice')) continue;
      try {
        this.vfs.rmdirAs(`/sys/fs/cgroup${cg}`, ROOT_CRED);
      } catch {
        /* busy */
      }
    }
    this.offset += 40_000;
    this.kernel.dmesg = [];
    this.kernel.log(`Linux version ${KERNEL} (builder@trainer) #1 SMP PREEMPT_DYNAMIC Debian 6.12.0`);
    this.kernel.log(`Command line: ${KERNEL_CMDLINE}`);
    this.kernel.log('Run /sbin/init as init process');
    this.shellPid = 0;
    this.login(this.users.some((u) => u.name === 'learner') ? 'learner' : 'root');
  }

  private rmTreeRoot(abs: string): void {
    const st = this.vfs.statAs(abs, ROOT_CRED, false);
    if (!st) return;
    if (st.type === 'd') {
      for (const n of this.vfs.readdirAs(abs, ROOT_CRED)) this.rmTreeRoot(`${abs}/${n}`);
      this.vfs.rmdirAs(abs, ROOT_CRED);
    } else this.vfs.unlinkAs(abs, ROOT_CRED);
  }

  /** Find a process by a pid typed in the current pid namespace view. */
  pidByView(pid: number): KProc | undefined {
    const view = this.shellProc().ns.pid;
    return (this.procs.list() as KProc[]).find((p) => this.kernel.pidIn(p, view) === pid);
  }

  /** The pid namespace whose /proc the shell sees (ps reads it). */
  procView(): number {
    const mnt = this.kernel.ns.get(this.shellProc().ns.mnt);
    return mnt?.procPidNs ?? HOST_NS.pid;
  }

  /** The pid of a process as the current session sees it, or null. */
  viewPid(p: KProc, view = this.procView()): number | null {
    return this.kernel.pidIn(p, view);
  }

  /** Allocate memory for a running process; runs the OOM killer when a limit is crossed. Returns false if the process was killed. */
  allocate(pid: number, kib: number): boolean {
    const p = this.procs.get(pid);
    if (!p) return false;
    const bytes = kib * 1024;
    const high = this.kernel.ancestors(p.cgroup).find((a) => a !== '/' && this.kernel.memUsage(a) + bytes > this.kernel.limitOf(a, 'memory.high'));
    if (high) this.kernel.bumpEvent(high, 'memory.events', 'high');
    const blocker = this.kernel.memBlocker(p.cgroup, bytes);
    if (blocker) {
      this.kernel.oomKill(blocker, p);
      if (!this.procs.get(pid)) return false;
    } else if (this.kernel.globalOom(bytes)) {
      this.kernel.oomKill(null, p);
      if (!this.procs.get(pid)) return false;
    }
    p.rss += kib;
    return true;
  }

  /** Timers: sleeps end, leaky programs grow, systemd restarts units. */
  tick(): void {
    const now = this.now();
    const dt = this.lastTick ? Math.max(0, now - this.lastTick) : 0;
    this.lastTick = now;
    for (const p of this.procs.list() as KProc[]) {
      if (!this.procs.get(p.pid)) continue;
      if (p.until !== undefined && p.state !== 'T' && now >= p.until) this.procs.exit(p.pid, 0, 'exit');
      else if (p.grow && p.state !== 'T' && dt > 0 && (p.growTo === undefined || p.rss < p.growTo)) {
        const kib = Math.min(Math.round((p.grow * dt) / 1000), p.growTo === undefined ? Infinity : p.growTo - p.rss);
        // grow in steps so the OOM killer fires at the limit, not far beyond it
        const steps = Math.min(64, Math.max(1, Math.ceil(kib / 4096)));
        for (let i = 0; i < steps && this.procs.get(p.pid); i++) this.allocate(p.pid, Math.round(kib / steps));
      }
    }
    if (this.extState.has('systemd')) this.systemd.tick(now);
  }

  /** Refresh /proc and the cgroup counters for the current view. */
  syncKernel(): void {
    this.kernel.syncCgroups();
    const used = MEM_BASE_USED + (this.procs.list() as KProc[]).reduce((s, p) => s + p.rss, 0);
    const free = Math.max(0, MEM_TOTAL - used - MEM_CACHE);
    const cpu = (this.procs.list() as KProc[]).filter((p) => p.state === 'R' || p.cpuWant > 0).reduce((s, p) => s + this.cpuOf(p), 0) / 100;
    const load = (cpu + 0.08).toFixed(2);
    this.kernel.syncProc(
      { pidNs: this.procView(), self: this.current ? (this.kernel.pidIn(this.procs.get(this.current) as KProc, this.procView()) ?? 0) : (this.kernel.pidIn(this.shellProc(), this.procView()) ?? 0) },
      {
        hostname: this.utsHostname(),
        uptime: this.now() - this.bootAt,
        load: `${load} ${(Number(load) * 0.7).toFixed(2)} ${(Number(load) * 0.4).toFixed(2)}`,
        cmdline: KERNEL_CMDLINE,
        mem: { MemTotal: MEM_TOTAL, MemFree: free, MemAvailable: free + Math.round(MEM_CACHE * 0.85), Buffers: 42_312, Cached: MEM_CACHE, SwapTotal: 0, SwapFree: 0 },
      },
    );
  }

  /** CPU percent a process gets now: what it wants, capped by cpu.max of its cgroups, 0 when stopped. */
  cpuOf(p: KProc): number {
    if (p.state === 'T' || p.state === 'Z' || !p.cpuWant) return 0;
    let cap = 100;
    for (const a of this.kernel.ancestors(p.cgroup)) {
      if (a === '/') break;
      const q = this.kernel.cpuQuota(a);
      if (q < Infinity) {
        const hungry = this.kernel.procsIn(a, true).filter((x) => x.cpuWant > 0 && x.state !== 'T').length || 1;
        cap = Math.min(cap, q / hungry);
      }
    }
    const busy = (this.procs.list() as KProc[]).filter((x) => x.cpuWant > 0 && x.state !== 'T').length || 1;
    return Math.round(Math.min(p.cpuWant, cap, 100 / busy) * 10) / 10;
  }

  utsHostname(): string {
    return this.kernel.hostnameOf(this.shellProc().ns.uts, this.hostname);
  }

  setUtsHostname(name: string): void {
    const uts = this.shellProc().ns.uts;
    if (uts === HOST_NS.uts) {
      this.hostname = name;
      this.vars.HOSTNAME = name;
    } else {
      const rec = this.kernel.ns.get(uts);
      if (rec) rec.hostname = name;
    }
  }

  // ── prompt and completion ──
  prompt(): string {
    if (this.sessions.length) return this.sessions[this.sessions.length - 1].prompt();
    const u = this.user();
    const shownUid = this.displayUid(u.uid);
    const name = this.users.find((x) => x.uid === shownUid)?.name ?? u.name;
    const home = this.vars.HOME ?? u.home;
    const cwd = this.cwdPath === home ? '~' : home !== '/' && this.cwdPath.startsWith(home + '/') ? '~' + this.cwdPath.slice(home.length) : this.cwdPath;
    if (this.shellProc().root !== '/' && !this.vfs.statAs(this.shellProc().root + '/bin/bash', ROOT_CRED)) {
      return `${cwd} ${shownUid === 0 ? '#' : '$'} `;
    }
    const sign = shownUid === 0 ? '\x1b[35m#\x1b[0m' : '$';
    return `\x1b[33m${name}@${this.utsHostname()}\x1b[0m:\x1b[34m${cwd}\x1b[0m${sign} `;
  }

  complete(line: string): string[] {
    if (this.sessions.length) return this.sessions[this.sessions.length - 1].complete?.(line) ?? [];
    const m = /(\S*)$/.exec(line);
    const word = m ? m[1] : '';
    const before = line.slice(0, line.length - word.length);
    const isCmd = !before.trim() || /(\||&&|\|\||;|sudo)\s*$/.test(before);
    if (isCmd && !word.includes('/')) {
      const names = new Set([...this.registry.commands.names(), ...this.local.keys()]);
      return [...names].filter((n) => n.startsWith(word)).sort();
    }
    const fs = this.fsFor(this.user());
    const expanded = word.startsWith('~') ? (this.vars.HOME ?? this.user().home) + word.slice(1) : word;
    const slash = expanded.lastIndexOf('/');
    const dirPart = slash >= 0 ? expanded.slice(0, slash + 1) : '';
    const prefix = slash >= 0 ? expanded.slice(slash + 1) : expanded;
    let entries: string[] = [];
    try {
      entries = fs.readdir(dirPart || '.');
    } catch {
      const first = before.trim().split(/\s+/)[0];
      const cmd = this.lookup(first);
      return cmd?.complete?.(before.trim().split(/\s+/).slice(1)).filter((c) => c.startsWith(word)) ?? [];
    }
    const shownDir = slash >= 0 ? word.slice(0, word.length - prefix.length) : '';
    const paths = entries
      .filter((e) => e.startsWith(prefix) && (prefix.startsWith('.') || !e.startsWith('.')))
      .map((e) => {
        const st = fs.stat(dirPart + e);
        return shownDir + e + (st?.type === 'd' ? '/' : '');
      });
    if (!paths.length && !word.includes('/')) {
      const first = before.trim().split(/\s+/)[0];
      const cmd = this.lookup(first);
      const extra = cmd?.complete?.(before.trim().split(/\s+/).slice(1)) ?? [];
      return extra.filter((c) => c.startsWith(word));
    }
    return paths;
  }

  fsFor(u: UserAccount, cwd?: () => string, root?: string, capEff?: string): FsApi {
    const r = root ?? this.shellProc().root ?? '/';
    return this.vfs.view(this.cred(u, capEff), cwd ?? (() => this.cwdPath), () => r);
  }

  // ── execution ──
  async exec(line: string): Promise<ExecResult> {
    if (this.sessions.length) {
      const top = this.sessions[this.sessions.length - 1];
      const r = await top.exec(line);
      if (r.done) this.sessions.pop();
      if (line.trim()) {
        this.hist.push(line);
        this.term.push({ line, exit: r.exit, out: stripAnsi(r.out) });
        if (this.term.length > 20) this.term.shift();
      }
      this.emit({ t: 'cmd.done', tty: 'main', line, exit: r.exit });
      return { out: r.out, exit: r.exit, effects: r.effects };
    }
    this.effects = [];
    if (line.trim()) this.hist.push(line);
    this.tick();
    let out = '';
    const write = (s: string) => {
      out += s;
    };
    let exit: number;
    try {
      exit = await this.runLine(line, { out: write, err: write, args: ['bash'], isatty: true, interactive: true, opts: this.opts, ppid: this.shellPid });
    } catch (e) {
      if (!(e instanceof ExitSignal)) throw e;
      exit = e.code;
      this.lastExit = exit;
      if (this.stack.length) {
        out += 'exit\n';
        this.popShell(exit);
      }
    }
    this.kernel.syncOverlays();
    this.tick();
    if (this.extState.has('systemd')) {
      await this.systemd.settleBoot();
      await this.systemd.settle();
    }
    if (exit === 2 && /syntax error/.test(out) && /<[^<>\n]+>/.test(line)) {
      out += '\nВместо текста в угловых скобках подставьте своё значение без скобок. Например, ssh <IP> нужно заменить на ssh 192.0.2.10.\n';
    }
    out += this.jobNotes();
    const effects = this.effects;
    this.effects = [];
    if (line.trim()) {
      this.term.push({ line, exit, out: stripAnsi(out) });
      if (this.term.length > 20) this.term.shift();
    }
    this.emit({ t: 'cmd.done', tty: 'main', line, exit, cwd: this.cwdPath, user: this.userName });
    return { out, exit, effects: effects.length ? effects : undefined };
  }

  /** "[1]+  Done   sleep 5" lines for jobs that ended since the last prompt. */
  private jobNotes(): string {
    let s = '';
    const live = this.jobs.filter((j) => !j.notified && j.state !== 'Running' && j.state !== 'Stopped');
    for (const j of live) {
      j.notified = true;
      const label = j.state === 'Done' && j.code ? `Exit ${j.code}` : j.state;
      s += `[${j.n}]+  ${label.padEnd(24)}${j.line}\n`;
    }
    this.jobs = this.jobs.filter((j) => !j.notified);
    return s;
  }

  /** Run a line in a frame; used by exec, scripts and `sh -c`. */
  async runLine(line: string, frame: Frame): Promise<number> {
    const r = parseControl(line);
    if (!r.ok) {
      frame.err(`bash: ${r.error}\n`);
      this.lastExit = 2;
      return 2;
    }
    try {
      await this.runNodes(r.nodes, frame, false);
    } catch (e) {
      if (e instanceof ExitSignal) this.lastExit = e.code;
      throw e;
    }
    return this.lastExit;
  }

  private async runNodes(nodes: CNode[], frame: Frame, cond: boolean): Promise<void> {
    for (const n of nodes) {
      if (n.k === 'cmd' && hasGroup(n.src)) {
        await this.runGroups(n.src, frame, cond);
        continue;
      }
      if (n.k === 'cmd') {
        const r = parse(n.src);
        if (!r.ok) {
          frame.err(`bash: ${r.error}\n`);
          this.lastExit = 2;
          continue;
        }
        for (const ao of r.script) {
          await this.runAndOr(ao, frame);
          if (frame.opts?.errexit && !cond && this.lastExit !== 0 && !ao.rest.length && !ao.first.negate) throw new ExitSignal(this.lastExit);
        }
        continue;
      }
      if (n.k === 'if') {
        let ran = false;
        for (const arm of n.arms) {
          await this.runNodes(arm.cond, frame, true);
          if (this.lastExit === 0) {
            await this.runNodes(arm.body, frame, cond);
            ran = true;
            break;
          }
        }
        if (!ran) {
          if (n.els) await this.runNodes(n.els, frame, cond);
          else this.lastExit = 0;
        }
        continue;
      }
      if (n.k === 'for') {
        const words = n.words === null ? frame.args.slice(1) : await this.expandWords(n.words, frame);
        let guard = 0;
        this.lastExit = 0;
        for (const w of words) {
          if (++guard > 10000) break;
          this.vars[n.v] = w;
          await this.runNodes(n.body, frame, cond);
        }
        continue;
      }
      if (n.k === 'while') {
        const saved = frame.loopInput;
        if (n.input) {
          try {
            const fs = this.fsFor(frame.as?.user ?? this.user(), () => frame.cwd ?? this.cwdPath, frame.root);
            const target = (await this.expandWords(n.input, frame))[0] ?? n.input;
            frame.loopInput = fs.readFile(target).split('\n');
            if (frame.loopInput[frame.loopInput.length - 1] === '') frame.loopInput.pop();
          } catch (e) {
            if (isFsError(e)) {
              frame.err(`bash: ${n.input}: ${e.text}\n`);
              this.lastExit = 1;
              continue;
            }
            throw e;
          }
        }
        let guard = 0;
        let status = 0;
        for (;;) {
          if (++guard > 1000) {
            frame.err('bash: the simulator stops a loop after 1000 rounds\n');
            break;
          }
          await this.runNodes(n.cond, frame, true);
          const ok = this.lastExit === 0;
          if (ok === n.until) break;
          await this.runNodes(n.body, frame, cond);
          status = this.lastExit;
        }
        this.lastExit = status;
        frame.loopInput = saved;
      }
    }
  }

  /** A statement with { … } groups or ( … ) subshells joined by && and ||. */
  private async runGroups(src: string, frame: Frame, cond: boolean): Promise<void> {
    const { parts, ops } = splitAndOr(src);
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        const op = ops[i - 1];
        if ((op === '&&' && this.lastExit !== 0) || (op === '||' && this.lastExit === 0)) continue;
      }
      const g = groupOf(parts[i]);
      if (!g) {
        await this.runNodes([{ k: 'cmd', src: parts[i] }], frame, true);
        continue;
      }
      if (g.kind === 'brace') await this.runLine(g.body, frame);
      else {
        const sub: Frame = { ...frame, cwd: frame.cwd ?? this.cwdPath, opts: { ...(frame.opts ?? defaultOpts()) }, interactive: false };
        try {
          await this.runLine(g.body, sub);
        } catch (e) {
          if (!(e instanceof ExitSignal)) throw e;
          this.lastExit = e.code;
        }
      }
    }
    if (frame.opts?.errexit && !cond && this.lastExit !== 0 && !ops.length) throw new ExitSignal(this.lastExit);
  }

  private async expandWords(src: string, frame: Frame): Promise<string[]> {
    const r = parse(src);
    if (!r.ok || !r.script.length) return [];
    const out: string[] = [];
    const cmd = r.script[0].first.cmds[0];
    if (!cmd) return [];
    for (const w of cmd.words) out.push(...(await this.expand(w, frame)));
    return out;
  }

  private async runAndOr(ao: AndOr, frame: Frame): Promise<void> {
    if (ao.background) {
      await this.runBackground(ao, frame);
      return;
    }
    this.lastExit = await this.runPipeline(ao.first, frame);
    for (const { op, pipeline } of ao.rest) {
      if ((op === '&&' && this.lastExit === 0) || (op === '||' && this.lastExit !== 0)) this.lastExit = await this.runPipeline(pipeline, frame);
    }
  }

  /** `cmd &`: long-running programs become jobs; anything else runs now and is reported Done. */
  private async runBackground(ao: AndOr, frame: Frame): Promise<void> {
    const n = Math.max(0, ...this.jobs.map((j) => j.n)) + 1;
    const single = !ao.rest.length && ao.first.cmds.length === 1 ? ao.first.cmds[0] : null;
    const line = this.lineOf(ao);
    if (single) {
      const argv: string[] = [];
      for (const w of single.words) argv.push(...(await this.expand(w, frame)));
      const name = argv[0] ? basename(argv[0]) : '';
      const spec = PROGRAMS.get(name);
      if (spec?.background && this.resolveCommand(argv[0], frame).kind !== 'none') {
        const as = this.runAs(frame);
        const proc = spec.background(argv, this, as);
        if (isBgError(proc)) {
          frame.err(proc.error);
          this.lastExit = proc.exit;
          return;
        }
        let pid: number;
        try {
          pid = this.fork({ cmd: name, argv, as, ppid: frame.ppid, extra: { state: proc.cpuWant ? 'R' : 'S', ...proc, job: n } });
        } catch (e) {
          if (e instanceof ForkError) {
            frame.err(`bash: ${e.message}\n`);
            this.lastExit = 254;
            return;
          }
          throw e;
        }
        if (proc.until !== undefined) (this.procs.get(pid) as KProc).until = this.now() + (proc.until as number);
        const shown = this.viewPid(this.procs.get(pid) as KProc, this.shellProc().ns.pid) ?? pid;
        this.jobs.push({ n, pid, line, state: 'Running' });
        if (frame.interactive) frame.err(`[${n}] ${shown}\n`);
        this.vars['!'] = String(shown);
        this.lastExit = 0;
        return;
      }
    }
    if (frame.interactive) frame.err(`[${n}] ${this.procs.next}\n`);
    await this.runAndOr({ ...ao, background: false }, frame);
    this.jobs.push({ n, pid: -1, line, state: 'Done', code: this.lastExit });
    this.lastExit = 0;
  }

  private lineOf(ao: AndOr): string {
    const word = (w: Word) => w.map((p) => (p.kind === 'lit' ? p.text : p.kind === 'var' ? `$${p.name}` : `$(${p.src})`)).join('');
    const pl = (p: Pipeline) => p.cmds.map((c) => c.words.map(word).join(' ')).join(' | ');
    return [pl(ao.first), ...ao.rest.map((r) => `${r.op} ${pl(r.pipeline)}`)].join(' ');
  }

  private async runPipeline(pl: Pipeline, frame: Frame): Promise<number> {
    const firstWord = pl.cmds[0]?.words[0];
    if (firstWord?.length === 1 && firstWord[0].kind === 'lit' && !firstWord[0].quoted && firstWord[0].text === 'time') {
      const first = { ...pl.cmds[0], words: pl.cmds[0].words.slice(1) };
      const portable = first.words[0]?.[0];
      if (portable?.kind === 'lit' && portable.text === '-p') first.words = first.words.slice(1);
      const netClock = () => (this.extState.get('net') as { world?: { clock: number } } | undefined)?.world?.clock ?? 0;
      const networkStarted = netClock();
      const started = this.now();
      const result = await this.runPipeline({ ...pl, cmds: [first, ...pl.cmds.slice(1)] }, frame);
      const seconds = Math.max(0, this.now() - started, netClock() - networkStarted) / 1000;
      frame.err(`real ${seconds.toFixed(3)}\nuser 0.000\nsys 0.000\n`);
      return result;
    }
    let input = '';
    let exit = 0;
    const statuses: number[] = [];
    // A pipeline's readers already exist while its writer runs. Keep literal
    // downstream commands visible to ps without evaluating substitutions twice.
    const readers = new Map<number, number>();
    try {
      for (let i = 1; i < pl.cmds.length; i++) {
        const words = pl.cmds[i].words;
        if (!words.length || words.some(w => w.some(p => p.kind !== 'lit'))) continue;
        const argv = words.map(w => w.map(p => p.kind === 'lit' ? p.text : '').join(''));
        readers.set(i, this.fork({ cmd: argv[0], argv, as: frame.as ?? { user: this.user(), capEff: this.shellProc().capEff }, ppid: frame.ppid }));
      }
      for (let i = 0; i < pl.cmds.length; i++) {
        const reader = readers.get(i);
        if (reader !== undefined) { this.procs.exit(reader, 0); readers.delete(i); }
        const last = i === pl.cmds.length - 1;
        const r = await this.runSimple(pl.cmds[i], input, frame, last, i > 0, pl.cmds.length > 1);
        input = r.stdout;
        exit = r.exit;
        statuses.push(exit);
      }
    } finally { for (const pid of readers.values()) this.procs.exit(pid, 0); }
    if (input) frame.out(input);
    this.vars.PIPESTATUS = statuses.join(' ');
    if (frame.opts?.pipefail) exit = [...statuses].reverse().find((s) => s !== 0) ?? 0;
    return pl.negate ? (exit === 0 ? 1 : 0) : exit;
  }

  private lookupVar(name: string, frame: Frame): string | undefined {
    const dm = /^([A-Za-z_][A-Za-z0-9_]*):?-(.*)$/.exec(name);
    if (dm) {
      const v = this.lookupVar(dm[1], frame) ?? '';
      return v === '' ? dm[2] : v;
    }
    const len = /^#([A-Za-z_][A-Za-z0-9_]*)$/.exec(name);
    if (len) return String((this.lookupVar(len[1], frame) ?? '').length);
    if (name === '?') return String(this.lastExit);
    if (name === '$') return String(this.viewPid(this.shellProc(), this.shellProc().ns.pid) ?? this.shellPid);
    if (name === 'BASHPID') return String(this.viewPid(this.shellProc(), this.shellProc().ns.pid) ?? this.shellPid);
    if (name === '#') return String(Math.max(0, frame.args.length - 1));
    if (name === '@' || name === '*') return frame.args.slice(1).join(' ');
    if (/^\d+$/.test(name)) return frame.args[Number(name)] ?? '';
    if (name === 'PWD') return frame.cwd ?? this.cwdPath;
    if (name === 'RANDOM') return String(Math.floor(Math.random() * 32768));
    if (name === 'UID') return String(this.displayUid((frame.as?.user ?? this.user()).uid));
    if (name === 'EUID') return String(this.displayUid((frame.as?.user ?? this.user()).uid));
    if (name === 'HOSTNAME') return this.utsHostname();
    if (name === 'SECONDS') return String(Math.floor((this.now() - this.bootAt) / 1000));
    return this.vars[name];
  }

  /** $(( … )): integer arithmetic with variables. */
  arith(expr: string, frame: Frame): string {
    const src = expr.replace(/\$?\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (_m, n: string) => String(Number(this.lookupVar(n, frame) ?? 0) || 0));
    if (!/^[\d\s+\-*/%()<>=!&|]*$/.test(src)) return '0';
    try {
      const v = Function(`"use strict"; return (${src.replace(/\//g, '/')});`)() as number;
      return String(Math.trunc(typeof v === 'boolean' ? Number(v) : v));
    } catch {
      return '0';
    }
  }

  /** Expand one word into fields: variables, $(…), field splitting, ~ and globs. */
  private async expand(w: Word, frame: Frame, assignment = false): Promise<string[]> {
    const fields: string[] = [];
    let cur = '';
    let has = false;
    let globbable = '';
    let quotedSeen = false;
    for (let idx = 0; idx < w.length; idx++) {
      const p = w[idx];
      if (p.kind === 'lit') {
        let text = p.text;
        if (idx === 0 && !p.quoted && (text === '~' || text.startsWith('~/'))) text = (this.vars.HOME ?? this.user().home) + text.slice(1);
        if (assignment && !p.quoted) {
          const home = this.vars.HOME ?? this.user().home;
          text = text.replace(/(^|:|^[A-Za-z_][A-Za-z0-9_]*=)~(?=\/|:|$)/g, (match, prefix: string, offset: number) => prefix || idx === 0 || offset > 0 ? prefix + home : match);
        }
        cur += text;
        globbable += p.quoted ? text.replace(/[*?[\]]/g, '\\$&') : text;
        has = true;
        if (p.quoted) quotedSeen = true;
        continue;
      }
      if (p.kind === 'var' && p.name === '@' && p.quoted) {
        const args = frame.args.slice(1);
        args.forEach((a, i) => {
          if (i > 0) {
            fields.push(cur);
            cur = '';
          }
          cur += a;
        });
        has = has || args.length > 0;
        if (!args.length && !cur && w.length === 1) return fields;
        continue;
      }
      let value: string;
      if (p.kind === 'var') {
        const v = this.lookupVar(p.name, frame);
        if (v === undefined && frame.opts?.nounset && !/^[?$#@*0-9!]$/.test(p.name) && !p.name.includes('-')) {
          frame.err(`bash: ${p.name}: unbound variable\n`);
          throw new ExitSignal(1);
        }
        value = v ?? '';
      } else if (p.src.startsWith('(') && p.src.endsWith(')')) {
        value = this.arith(p.src.slice(1, -1), frame);
      } else {
        let captured = '';
        const sub: Frame = { ...frame, out: (s) => (captured += s), isatty: false, interactive: false };
        try {
          await this.runLine(p.src, sub);
        } catch (e) {
          if (!(e instanceof ExitSignal)) throw e;
        }
        value = captured.replace(/\n+$/, '');
      }
      if (p.quoted) {
        cur += value;
        globbable += value.replace(/[*?[\]]/g, '\\$&');
        has = true;
        quotedSeen = true;
      } else {
        const pieces = value.split(/[ \t\n]+/);
        for (let k = 0; k < pieces.length; k++) {
          if (k > 0) {
            if (has || cur) fields.push(cur);
            cur = '';
            globbable = '';
            has = false;
          }
          if (pieces[k]) {
            cur += pieces[k];
            globbable += pieces[k];
            has = true;
          }
        }
      }
    }
    if (has || cur || quotedSeen) {
      if (hasGlob(w)) {
        const matches = this.glob(globbable, frame);
        if (matches.length) {
          fields.push(...matches);
          return fields;
        }
      }
      fields.push(cur);
    }
    return fields;
  }

  private expandHeredoc(body: string, frame: Frame): string {
    return body.replace(/\$\{([^}]+)\}|\$([A-Za-z_][A-Za-z0-9_]*|[?$#@0-9])/g, (_m, a: string | undefined, b: string | undefined) => this.lookupVar((a ?? b)!, frame) ?? '');
  }

  private glob(pattern: string, frame: Frame): string[] {
    const fs = this.fsFor(frame.as?.user ?? this.user(), () => frame.cwd ?? this.cwdPath, frame.root);
    const abs = pattern.startsWith('/');
    const parts = pattern.split('/').filter((x, i) => x !== '' || i === 0);
    let bases: string[] = [abs ? '/' : ''];
    for (const part of parts) {
      if (part === '') continue;
      const next: string[] = [];
      const isPat = /(^|[^\\])[*?[]/.test(part);
      for (const base of bases) {
        if (!isPat) {
          const lit = part.replace(/\\(.)/g, '$1');
          const candidate = base === '/' ? `/${lit}` : base ? `${base}/${lit}` : lit;
          if (fs.lstat(candidate)) next.push(candidate);
          continue;
        }
        const re = globToRegExp(part.replace(/\\([*?[\]])/g, '[$1]'));
        let entries: string[] = [];
        try {
          entries = fs.readdir(base || '.');
        } catch {
          continue;
        }
        for (const e of entries) {
          if (e.startsWith('.') && !part.startsWith('.')) continue;
          if (re.test(e)) next.push(base === '/' ? `/${e}` : base ? `${base}/${e}` : e);
        }
      }
      bases = next;
      if (!bases.length) return [];
    }
    return bases.sort();
  }

  private runAs(frame: Frame): RunAs {
    if (frame.as) return frame.as;
    return { user: this.user(), capEff: this.shellProc().capEff };
  }

  private async runSimple(cmd: SimpleCommand, stdin: string, frame: Frame, last: boolean, piped: boolean, inPipeline: boolean): Promise<{ stdout: string; exit: number }> {
    void piped;
    const env: Record<string, string> = {};
    for (const a of cmd.assigns) env[a.name] = (await this.expand(a.value, frame, true)).join(' ');
    const argv: string[] = [];
    for (let i = 0; i < cmd.words.length; i++) {
      const w = cmd.words[i];
      if (i === 0 && frame.interactive && w.length === 1 && w[0].kind === 'lit' && !w[0].quoted && this.aliases.has(w[0].text)) {
        argv.push(...this.aliases.get(w[0].text)!.split(/\s+/).filter(Boolean));
        continue;
      }
      argv.push(...(await this.expand(w, frame, ['export', 'readonly', 'declare', 'local'].includes(argv[0]) && w[0]?.kind === 'lit' && /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0].text))));
    }
    const as = this.runAs(frame);
    const fs = this.fsFor(as.user, () => frame.cwd ?? this.cwdPath, frame.root, as.capEff);
    if (frame.opts?.xtrace && argv.length) frame.err(`+ ${[...Object.entries(env).map(([k, v]) => `${k}=${v}`), ...argv].map(quoteTrace).join(' ')}\n`);

    // redirects
    let stdoutFile: { path: string; append: boolean } | null = null;
    let stderrFile: { path: string; append: boolean } | null = null;
    let errToOut = false;
    let outToErr = false;
    let input = stdin;
    for (const r of cmd.redirects) {
      if (r.op === 'dup') {
        if (r.fd === 2 && r.to === 1) {
          errToOut = true;
          if (stdoutFile) stderrFile = stdoutFile;
        }
        if (r.fd === 1 && r.to === 2) outToErr = true;
        continue;
      }
      if (r.op === '<<') {
        input = r.heredoc!.expand ? this.expandHeredoc(r.heredoc!.body, frame) : r.heredoc!.body;
        continue;
      }
      const target = (await this.expand(r.target!, frame)).join(' ');
      try {
        if (r.op === '<') input = fs.readFile(target);
        else {
          const spec = { path: target, append: r.op === '>>' };
          if (!spec.append) fs.writeFile(target, '');
          else if (!fs.exists(target)) fs.writeFile(target, '');
          if (r.fd === 2) stderrFile = spec;
          else {
            stdoutFile = spec;
            if (errToOut) errToOut = false;
          }
        }
      } catch (e) {
        if (isFsError(e)) {
          frame.err(`bash: ${target}: ${e.text}\n`);
          return { stdout: '', exit: 1 };
        }
        throw e;
      }
    }

    if (!argv.length) {
      for (const [k, v] of Object.entries(env)) this.vars[k] = v;
      return { stdout: '', exit: 0 };
    }

    let stdoutBuf = '';
    let stderrBuf = '';
    // The last command of a pipeline writes straight to the terminal, so stdout and stderr keep their order.
    const direct = last && !stdoutFile && !stderrFile;
    const writeOut = (s: string) => {
      if (outToErr) {
        if (direct) frame.err(s);
        else stderrBuf += s;
      } else if (direct) frame.out(s);
      else stdoutBuf += s;
    };
    const writeErr = (s: string) => {
      if (errToOut) {
        if (direct) frame.out(s);
        else stdoutBuf += s;
      } else if (direct) frame.err(s);
      else stderrBuf += s;
    };
    const isatty = last && frame.isatty && !stdoutFile && !outToErr;
    const exit = await this.invoke(argv, { env, stdin: input, writeOut, writeErr, isatty, frame, fs, as, inPipeline });

    const route = (text: string, file: { path: string; append: boolean } | null, fallback: (s: string) => void) => {
      if (!text) return;
      if (file) {
        try {
          fs.writeFile(file.path, text, { append: true });
          const lim = this.kernel.pendingLimit;
          if (lim) {
            this.kernel.pendingLimit = null;
            this.enforceLimit(lim.cg);
          }
        } catch (e) {
          if (isFsError(e)) frame.err(e.code === 'EINVAL' || e.code === 'EBUSY' ? `bash: ${argv[0]}: write error: ${e.text}\n` : `bash: ${file.path}: ${e.text}\n`);
          else throw e;
        }
      } else fallback(text);
    };
    let pipedOut = '';
    route(stdoutBuf, stdoutFile, (s) => (pipedOut += s));
    route(stderrBuf, stderrFile, frame.err);
    return { stdout: pipedOut, exit };
  }

  /** After memory.max is lowered: if the group is already above it, the OOM killer runs in the group. */
  enforceLimit(cg: string): void {
    let guard = 0;
    while (this.kernel.memUsage(cg) > this.kernel.limitOf(cg, 'memory.max') && guard++ < 20) {
      const victim = this.kernel.oomVictim(cg);
      if (!victim) break;
      this.kernel.oomKill(cg, victim);
    }
  }

  /** Where a command name leads: a builtin, a program found in PATH, a script, or nothing. */
  resolveCommand(name: string, frame: Frame | null, fsOverride?: FsApi, pathOverride?: string): { kind: 'builtin' | 'program' | 'script' | 'none' | 'noperm' | 'dir' | 'badbin'; cmd?: ShellCommand; path?: string; text?: string } {
    const builtin = this.lookup(name);
    if (builtin?.builtin) return { kind: 'builtin', cmd: builtin };
    if (this.local.has(name)) return { kind: 'program', cmd: this.local.get(name), path: `/usr/bin/${name}` };
    const as = frame ? this.runAs(frame) : { user: this.user(), capEff: this.shellProc().capEff };
    const fs = fsOverride ?? this.fsFor(as.user, () => frame?.cwd ?? this.cwdPath, frame?.root, as.capEff);
    const probe = (path: string): ReturnType<SimMachine['resolveCommand']> | null => {
      let st;
      try {
        st = fs.stat(path);
      } catch {
        return null;
      }
      if (!st) return null;
      if (st.type === 'd') return { kind: 'dir', path };
      if (!fs.access(path, 'x')) return { kind: 'noperm', path };
      let text = '';
      try {
        text = fs.readFile(path);
      } catch {
        return { kind: 'noperm', path };
      }
      const sim = /^#!\/usr\/bin\/sim\n# (\S+):/.exec(text);
      if (sim) {
        let target = sim[1];
        if (target === 'busybox') {
          const applet = basename(path);
          target = applet === 'busybox' ? 'busybox' : applet;
        }
        const c = this.lookup(target);
        return c ? { kind: 'program', cmd: c, path } : { kind: 'badbin', path };
      }
      return { kind: 'script', path, text };
    };
    if (name.includes('/')) return probe(name) ?? { kind: 'none', path: name };
    const pathVar = pathOverride ?? this.vars.PATH ?? DEFAULT_PATH;
    let noperm: ReturnType<SimMachine['resolveCommand']> | null = null;
    for (const dir of pathVar.split(':')) {
      if (!dir) continue;
      const r = probe(`${dir.replace(/\/$/, '')}/${name}`);
      if (!r || r.kind === 'dir') continue;
      if (r.kind === 'noperm') {
        noperm ??= r;
        continue;
      }
      return r;
    }
    return noperm ?? { kind: 'none' };
  }

  private async invoke(
    argv: string[],
    io: { env: Record<string, string>; stdin: string; writeOut: (s: string) => void; writeErr: (s: string) => void; isatty: boolean; frame: Frame; fs: FsApi; as: RunAs; inPipeline?: boolean; pathOverride?: string },
  ): Promise<number> {
    const name = argv[0];
    const r = this.resolveCommand(name, io.frame, io.fs, io.env.PATH ?? io.pathOverride);
    switch (r.kind) {
      case 'none':
        if (name.includes('/')) {
          io.writeErr(`bash: ${name}: No such file or directory\n`);
          return 127;
        }
        io.writeErr(`${io.frame.root && io.frame.root !== '/' ? 'sh' : 'bash'}: ${name}: command not found\n`);
        if (['nano', 'vim', 'vi', 'edit'].includes(name)) io.writeErr(t(bi('Для изменения файла в этом терминале используйте sed или запишите текст командой printf с перенаправлением >. В лаборатории с настоящим Linux можно открыть nano или vim.\n', 'Use sed or printf with > to edit files in this terminal. The real Linux lab supports nano and vim.\n')));
        return 127;
      case 'dir':
        io.writeErr(`bash: ${name}: Is a directory\n`);
        return 126;
      case 'noperm':
        io.writeErr(`bash: ${name.includes('/') ? name : r.path}: Permission denied\n`);
        return 126;
      case 'badbin':
        io.writeErr(`bash: ${r.path}: cannot execute binary file: Exec format error\n`);
        return 126;
      case 'script': {
        const text = r.text ?? '';
        const shebang = /^#!\s*(\S+)/.exec(text)?.[1];
        if (shebang && !/\/(ba)?sh$|\/env$/.test(shebang)) {
          const st = io.fs.stat(shebang);
          if (!st) {
            io.writeErr(`bash: ${name}: ${shebang}: bad interpreter: No such file or directory\n`);
            return 126;
          }
        } else if (shebang && !io.fs.stat(shebang)) {
          io.writeErr(`bash: ${name}: ${shebang}: bad interpreter: No such file or directory\n`);
          return 126;
        }
        let pid: number;
        try {
          pid = this.fork({ cmd: basename(r.path!), argv: [shebang ?? '/bin/bash', r.path!, ...argv.slice(1)], as: io.as, ppid: io.frame.ppid, root: io.frame.root });
        } catch (e) {
          if (e instanceof ForkError) {
            io.writeErr(`bash: ${e.message}\n`);
            return 254;
          }
          throw e;
        }
        const code = await this.asChildShell(() => this.runScript(text, [io.fs.resolve(r.path!), ...argv.slice(1)], {
          writeOut: io.writeOut,
          writeErr: io.writeErr,
          cwd: io.frame.cwd ?? this.cwdPath,
          as: io.as,
          root: io.frame.root,
          service: io.frame.service,
          ppid: pid,
          stdin: io.stdin,
        }), io.env);
        const alive = this.procs.get(pid);
        if (alive) this.procs.exit(pid, code, 'exit');
        return alive ? code : 137;
      }
    }
    let cmd = r.cmd!;
    // Inside a new network namespace only the kernel model knows what the process sees.
    const own = this.registry.commands.fallback(cmd.name);
    if (own && this.shellProc().ns.net !== HOST_NS.net) cmd = own;
    else if (own) netBridge?.(this, cmd.name);
    if (cmd.help && !cmd.handlesHelp && argv.slice(1).includes('--help')) {
      io.writeOut(cmd.help.endsWith('\n') ? cmd.help : cmd.help + '\n');
      return 0;
    }
    // A long-running program inside a unit's script: the service is up.
    if (io.frame.service && PROGRAMS.get(cmd.name)?.daemon) {
      io.frame.service.daemon = [r.path ?? cmd.name, ...argv.slice(1)];
      throw new ExitSignal(0);
    }
    let pid = 0;
    if (!cmd.builtin) {
      try {
        pid = this.fork({ cmd: basename(name), argv: [r.path ?? name, ...argv.slice(1)], as: io.as, ppid: io.frame.ppid, root: io.frame.root });
      } catch (e) {
        if (e instanceof ForkError) {
          io.writeErr(`bash: ${e.message}\n`);
          return 254;
        }
        throw e;
      }
    }
    const prevCurrent = this.current;
    this.current = pid || this.shellPid;
    this.syncKernel();
    const cwdNow = () => io.frame.cwd ?? this.cwdPath;
    const ctx: CmdContext = {
      argv,
      stdin: io.stdin,
      isatty: io.isatty,
      cols: this.cols,
      out: io.writeOut,
      err: io.writeErr,
      env: { ...Object.fromEntries([...this.exported].filter((k) => k in this.vars).map((k) => [k, this.vars[k]])), ...(io.as.user.uid !== this.user().uid ? { USER: io.as.user.name, LOGNAME: io.as.user.name, HOME: io.as.user.home } : {}), ...io.env, PWD: cwdNow() },
      cwd: cwdNow(),
      user: io.as.user,
      cred: this.cred(io.as.user, io.as.capEff),
      fs: io.fs,
      machine: this,
      effect: (e) => this.effects.push(e),
      shell: {
        chdir: (p) => {
          const abs = normalize(joinPath(cwdNow(), p));
          if (io.frame.cwd !== undefined) io.frame.cwd = abs;
          else {
            this.vars.OLDPWD = this.cwdPath;
            this.cwdPath = abs;
            this.vars.PWD = abs;
          }
        },
        setVar: (n, v, exported) => {
          if (v === undefined) {
            delete this.vars[n];
            this.exported.delete(n);
          } else {
            this.vars[n] = v;
            if (exported) this.exported.add(n);
          }
        },
        run: async (line, o) => {
          let out = '';
          let err = '';
          const f: Frame = { out: (s) => (out += s), err: (s) => (err += s), args: o?.args ?? ['sh'], isatty: false, cwd: cwdNow(), as: io.as, root: io.frame.root, opts: defaultOpts(), ppid: pid || io.frame.ppid };
          let exit: number;
          try {
            exit = await this.runLine(line, f);
          } catch (e) {
            if (e instanceof ExitSignal) exit = e.code;
            else throw e;
          }
          return { out, err, exit };
        },
        history: () => [...this.hist],
      },
    };
    (ctx as CmdContext & { pid: number; frame: Frame }).pid = pid;
    (ctx as CmdContext & { pid: number; frame: Frame }).frame = io.frame;
    this.emit({ t: 'proc.exec', cmd: name, argv, uid: io.as.user.uid, pid });
    let code: number;
    try {
      code = await cmd.run(ctx);
    } catch (e) {
      if (e instanceof ExitSignal) {
        if (pid && this.procs.get(pid)) this.procs.exit(pid, e.code, 'exit');
        this.current = prevCurrent;
        throw e;
      }
      if (e instanceof ForkError) {
        io.writeErr(`bash: ${e.message}\n`);
        code = 254;
      } else if (isFsError(e)) {
        io.writeErr(`${name}: ${e.path}: ${e.text}\n`);
        code = 1;
      } else {
        io.writeErr(`${name}: ${(e as Error).message}\n`);
        code = 1;
      }
    }
    this.current = prevCurrent;
    if (pid) {
      if (this.procs.get(pid)) this.procs.exit(pid, code, 'exit');
      else if (code !== 0 || !io.inPipeline) {
        // killed while running (OOM, kill -9 from a script): bash reports it like this
        if (code === 137 || code === 0) {
          io.writeErr('Killed\n');
          code = 137;
        }
      }
    }
    return code;
  }

  /**
   * Run fn as a child shell would: it sees only the exported variables (plus
   * per-command assignments), and nothing it sets survives in this shell.
   */
  async asChildShell<T>(fn: () => Promise<T>, extra: Record<string, string> = {}): Promise<T> {
    const savedVars = this.vars;
    const savedExported = this.exported;
    const savedOpts = this.opts;
    const env: Record<string, string> = {};
    for (const k of this.exported) if (k in this.vars) env[k] = this.vars[k];
    this.vars = { ...env, ...extra };
    this.exported = new Set(Object.keys(this.vars));
    try {
      return await fn();
    } finally {
      this.vars = savedVars;
      this.exported = savedExported;
      this.opts = savedOpts;
    }
  }

  /** Run a script: compound commands, positional parameters, `exit` ends it. */
  async runScript(
    text: string,
    args: string[],
    io: { writeOut: (s: string) => void; writeErr: (s: string) => void; cwd?: string; as?: RunAs; root?: string; service?: ServiceCtx; ppid?: number; stdin?: string; source?: boolean },
  ): Promise<number> {
    const frame: Frame = {
      out: io.writeOut,
      err: io.writeErr,
      args,
      isatty: false,
      cwd: io.source ? undefined : (io.cwd ?? this.cwdPath),
      as: io.as,
      root: io.root,
      service: io.service,
      opts: io.source ? this.opts : defaultOpts(),
      ppid: io.ppid ?? this.shellPid,
      loopInput: io.stdin ? io.stdin.split('\n').filter((l, i, a) => i < a.length - 1 || l !== '') : undefined,
    };
    const body = text.startsWith('#!') ? text.slice(text.indexOf('\n') + 1) : text;
    try {
      await this.runLine(body, frame);
    } catch (e) {
      if (e instanceof ExitSignal) return e.code;
      throw e;
    }
    return this.lastExit;
  }

  /** Thrown by the `exit` built-in. */
  exitSignal(code: number): never {
    throw new ExitSignal(code);
  }

  /** The `read` built-in takes lines from a `while … done < file` loop or from stdin. */
  readLine(ctx: CmdContext): string | null {
    const frame = (ctx as CmdContext & { frame?: Frame }).frame;
    if (frame?.loopInput) return frame.loopInput.length ? frame.loopInput.shift()! : null;
    if (ctx.stdin) {
      const lines = ctx.stdin.split('\n');
      return lines[0] ?? null;
    }
    return null;
  }

  shellOptsOf(ctx: CmdContext): ShellOpts {
    const frame = (ctx as CmdContext & { frame?: Frame }).frame;
    return frame?.opts ?? this.opts;
  }

  frameArgs(ctx: CmdContext): string[] | undefined {
    return (ctx as CmdContext & { frame?: Frame }).frame?.args;
  }

  /** Run argv as another user with given capabilities (sudo, systemd User=, capsh). */
  async runArgv(ctx: CmdContext, argv: string[], as: RunAs, o: { root?: string; cwd?: string; env?: Record<string, string>; service?: ServiceCtx; ppid?: number } = {}): Promise<number> {
    const parentFrame = (ctx as CmdContext & { frame?: Frame }).frame;
    const frame: Frame = {
      out: ctx.out,
      err: ctx.err,
      args: ['bash'],
      isatty: ctx.isatty,
      cwd: o.cwd ?? ctx.cwd,
      as,
      root: o.root ?? parentFrame?.root,
      opts: defaultOpts(),
      service: o.service,
      ppid: o.ppid ?? ((ctx as CmdContext & { pid?: number }).pid || this.shellPid),
    };
    const fs = this.fsFor(as.user, () => frame.cwd ?? this.cwdPath, frame.root, as.capEff);
    return this.invoke(argv, { env: o.env ?? {}, stdin: ctx.stdin, writeOut: ctx.out, writeErr: ctx.err, isatty: ctx.isatty, frame, fs, as, pathOverride: o.env?.PATH });
  }

  /** Run a whole command line as another user (sudo bash -c, service scripts). */
  async runLineAs(line: string, as: RunAs, io: { out: (s: string) => void; err: (s: string) => void; cwd?: string; service?: ServiceCtx; ppid?: number; args?: string[]; stdin?: string }): Promise<number> {
    const frame: Frame = { out: io.out, err: io.err, args: io.args ?? ['bash'], isatty: false, cwd: io.cwd ?? '/', as, opts: defaultOpts(), service: io.service, ppid: io.ppid ?? 1, loopInput: io.stdin ? io.stdin.split('\n').filter((l, i, a) => i < a.length - 1 || l !== '') : undefined };
    try {
      return await this.runLine(line, frame);
    } catch (e) {
      if (e instanceof ExitSignal) return e.code;
      throw e;
    }
  }

  // ── facts, snapshots ──
  async facts(scope?: string[]): Promise<Facts> {
    if (this.extState.has('systemd')) {
      await this.systemd.settleBoot();
      await this.systemd.settle();
    }
    return this.factsSync(scope);
  }

  factsSync(scope?: string[]): Facts {
    this.tick();
    this.syncKernel();
    const files: Record<string, FileFact> = {};
    for (const { path, stat, text } of this.vfs.list()) {
      if (path.startsWith('/proc/') && /^\/proc\/\d+\/(fd|ns|task)\//.test(path)) continue;
      files[path] = {
        exists: true,
        type: stat.type,
        mode: octal(stat.mode),
        uid: stat.uid,
        gid: stat.gid,
        owner: this.users.find((u) => u.uid === stat.uid)?.name,
        group: this.groups.find((g) => g.gid === stat.gid)?.name,
        size: stat.size,
        ino: stat.ino,
        nlink: stat.nlink,
        mtime: new Date(stat.mtime).toISOString(),
        text: text !== undefined && text.length <= 65536 ? text : undefined,
        target: stat.target,
      };
      const ff = files[path] as FileFact & Record<string, unknown>;
      ff.perm = permOf(stat.mode);
      if ((stat as { dev?: string }).dev) ff.dev = (stat as { dev?: string }).dev;
      const caps = this.kernel.fileCaps.get(stat.ino);
      if (caps) ff.caps = caps;
    }
    const u = this.user();
    const procList = (this.procs.list() as KProc[]).map((p) => ({ ...p, user: this.users.find((x) => x.uid === p.uid)?.name, cpu: this.cpuOf(p) }));
    const facts: Facts = {
      schema: 'dt.facts/v1',
      env: { kind: 'sim', machine: this.id, kernel: KERNEL, at: new Date(this.now()).toISOString() },
      user: { name: u.name, uid: u.uid, gid: u.gid },
      cwd: this.cwdPath,
      hostname: this.hostname,
      vars: { ...this.vars, '?': String(this.lastExit) },
      procs: procList,
      files,
      term: { main: [...this.term] },
      users: this.users.map((x) => ({ ...x, groupNames: x.groups.map((g) => this.groups.find((gg) => gg.gid === g)?.name ?? String(g)) })),
      groups: this.groups.map((g) => ({ ...g, members: this.users.filter((x) => x.groups.includes(g.gid)).map((x) => x.name) })),
    };
    facts.shell = { depth: this.stack.length, pid: this.shellPid, user: this.userName, hostname: this.utsHostname(), ns: { ...this.shellProc().ns }, root: this.shellProc().root, cgroup: this.shellProc().cgroup, opts: { ...this.opts } };
    facts.cgroups = this.kernel.cgroupPaths().map((cg) => ({
      path: cg,
      procs: this.kernel.procsIn(cg, false).map((p) => p.pid),
      memory: { max: limitFact(this.kernel.readCtl(cg, 'memory.max')), high: limitFact(this.kernel.readCtl(cg, 'memory.high')), current: this.kernel.memUsage(cg), events: kv(this.kernel.readCtl(cg, 'memory.events')) },
      pids: { max: limitFact(this.kernel.readCtl(cg, 'pids.max')), current: this.kernel.pidsUsage(cg), events: kv(this.kernel.readCtl(cg, 'pids.events')) },
      cpu: { max: this.kernel.readCtl(cg, 'cpu.max'), quota: this.kernel.cpuQuota(cg) === Infinity ? 'max' : this.kernel.cpuQuota(cg) },
      controllers: this.kernel.readCtl(cg, 'cgroup.subtree_control').split(/\s+/).filter(Boolean),
    }));
    facts.ns = [...this.kernel.ns.values()].map((n) => ({ ...n, procs: (this.procs.list() as KProc[]).filter((p) => p.ns[n.type] === n.id).map((p) => p.pid) }));
    facts.mounts = this.kernel.visibleMounts().map((m) => ({ source: m.source, target: m.target, type: m.fstype, options: m.options, lower: m.overlay?.lower.join(':'), upper: m.overlay?.upper }));
    facts.jobs = this.jobs.map((j) => ({ ...j }));
    facts.dmesg = this.kernel.dmesg.map((d) => d.msg);
    if (this.extState.has('systemd')) Object.assign(facts, this.systemd.facts());
    for (const p of this.registry.facts) {
      if (scope && !scope.includes(p.scope)) continue;
      try {
        facts[p.scope] = p.collect(this);
      } catch (e) {
        facts[p.scope] = { error: (e as Error).message };
      }
    }
    return facts;
  }

  async snapshot(): Promise<SimSnapshot> {
    const ext: Record<string, unknown> = { ...this.pendingExt };
    for (const [k, v] of this.extState) if (isSnapshotable(v)) ext[k] = v.snapshot();
    return structuredCloneSafe({
      v: 2,
      fs: this.vfs.snapshot(),
      users: this.users,
      groups: this.groups,
      vars: this.vars,
      exported: [...this.exported],
      cwd: this.cwdPath,
      user: this.userName,
      hostname: this.hostname,
      history: this.hist,
      term: this.term,
      procs: this.procs.snapshot(),
      lastExit: this.lastExit,
      ext,
      shellPid: this.shellPid,
      stack: this.stack,
      jobs: this.jobs,
      opts: this.opts,
      aliases: [...this.aliases],
      offset: this.offset,
    });
  }

  async restore(snap: unknown): Promise<void> {
    const s = structuredCloneSafe(snap as SimSnapshot);
    if (!s || (s.v !== 2 && (s as { v: number }).v !== 1)) throw new Error('unknown snapshot format');
    for (const session of this.sessions) session.dispose?.();
    this.sessions = [];
    this.vfs.restore(s.fs);
    this.users = s.users;
    this.groups = s.groups;
    this.vars = s.vars;
    this.exported = new Set(s.exported);
    this.cwdPath = s.cwd;
    this.userName = s.user;
    this.hostname = s.hostname;
    this.hist = s.history;
    this.term = s.term;
    this.procs.restore(s.procs);
    this.lastExit = s.lastExit;
    this.shellPid = s.shellPid ?? this.shellPid;
    this.stack = s.stack ?? [];
    this.jobs = s.jobs ?? [];
    this.opts = s.opts ?? defaultOpts();
    this.aliases = new Map(s.aliases ?? []);
    this.offset = s.offset ?? this.offset;
    this.pendingExt = { ...s.ext };
    for (const [k, v] of this.extState) {
      if (isSnapshotable(v) && k in this.pendingExt) {
        v.restore(this.pendingExt[k]);
        delete this.pendingExt[k];
      }
    }
  }

  dispose(): void {
    for (const session of this.sessions) session.dispose?.();
    this.sessions = [];
    this.listeners.clear();
  }

  // ── setup ──
  async applySetup(setup: TerminalSetup = {}): Promise<void> {
    if (setup.hostname) {
      this.hostname = setup.hostname;
      this.vfs.writeFileAs('/etc/hostname', `${setup.hostname}\n`, ROOT_CRED);
    }
    for (const u of setup.users ?? []) this.addUser(u.name, { uid: u.uid, groups: u.groups, home: u.home });
    const loginName = setup.user ?? 'learner';
    if (!this.users.some((u) => u.name === loginName)) this.addUser(loginName);
    const home = this.users.find((u) => u.name === loginName)!.home;
    for (const f of setup.files ?? []) {
      const path = f.path.startsWith('~') ? home + f.path.slice(1) : f.path;
      const parent = path.slice(0, path.lastIndexOf('/')) || '/';
      const fileOwner = this.users.find((u) => u.name === (f.owner ?? loginName));
      // Missing parent directories belong to the owner of the file, as if they had created them.
      let cur = '';
      for (const part of parent.split('/').filter(Boolean)) {
        cur += '/' + part;
        if (this.vfs.statAs(cur, ROOT_CRED)) continue;
        this.vfs.mkdirAs(cur, ROOT_CRED);
        if (fileOwner) this.vfs.chownAs(cur, fileOwner.uid, fileOwner.gid, ROOT_CRED);
      }
      if (f.type === 'd') {
        if (!this.vfs.statAs(path, ROOT_CRED)) this.vfs.mkdirAs(path, ROOT_CRED, { parents: true });
      } else if (f.type === 'l') {
        this.vfs.symlinkAs(f.target ?? '', path, ROOT_CRED);
      } else this.vfs.writeFileAs(path, f.content ?? '', ROOT_CRED);
      if (f.mode && f.type !== 'l') this.vfs.chmodAs(path, parseInt(f.mode, 8), ROOT_CRED);
      const owner = this.users.find((u) => u.name === (f.owner ?? loginName));
      const group = f.group ? this.groups.find((g) => g.name === f.group) : undefined;
      if (owner && f.type !== 'l') this.vfs.chownAs(path, owner.uid, group?.gid ?? owner.gid, ROOT_CRED);
    }
    for (const hook of this.registry.setup) {
      if (setup.ext && hook.key in setup.ext) await hook.apply(this, setup.ext[hook.key]);
    }
    if (setup.script?.length) {
      this.login('root');
      for (const line of setup.script) {
        try {
          await this.runLine(line, { out: () => {}, err: () => {}, args: ['setup'], isatty: false, ppid: this.shellPid, opts: defaultOpts() });
        } catch (e) {
          if (!(e instanceof ExitSignal)) throw e;
        }
        this.kernel.syncOverlays();
        await this.systemd.settleBoot();
        await this.systemd.settle();
      }
    }
    this.login(loginName);
    for (const [k, v] of Object.entries(setup.env ?? {})) {
      this.vars[k] = v;
      this.exported.add(k);
    }
    if (setup.cwd) {
      const cwd = setup.cwd.startsWith('~') ? home + setup.cwd.slice(1) : setup.cwd;
      this.cwdPath = normalize(cwd);
      this.vars.PWD = this.cwdPath;
    }
    this.term = [];
    this.hist = [];
    this.lastExit = 0;
    this.jobs = this.jobs.filter((j) => j.state === 'Running' || j.state === 'Stopped');
    this.tick();
    for (const hook of this.registry.setup) await hook.complete?.(this);
  }
}

function quoteTrace(a: string): string {
  return /^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`;
}

/** perm {u,g,o} as 'rwx' strings and the special bits, for checks (02 §4.4). */
export function permOf(mode: number): { u: string; g: string; o: string; setuid: boolean; setgid: boolean; sticky: boolean } {
  const tri = (shift: number) => `${mode & (4 << shift) ? 'r' : '-'}${mode & (2 << shift) ? 'w' : '-'}${mode & (1 << shift) ? 'x' : '-'}`;
  return { u: tri(6), g: tri(3), o: tri(0), setuid: !!(mode & 0o4000), setgid: !!(mode & 0o2000), sticky: !!(mode & 0o1000) };
}

function limitFact(v: string): number | 'max' {
  return !v || v === 'max' ? 'max' : Number(v.split(/\s+/)[0]);
}

function kv(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of text.split('\n')) {
    const [k, v] = l.split(' ');
    if (k) out[k] = Number(v);
  }
  return out;
}

function isSnapshotable(v: unknown): v is Snapshotable {
  return typeof v === 'object' && v !== null && typeof (v as Snapshotable).snapshot === 'function' && typeof (v as Snapshotable).restore === 'function';
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Make a machine and apply a setup: what every terminal section and quiz check does. */
export async function createSimMachine(setup?: TerminalSetup, opts?: SimMachineOptions): Promise<SimMachine> {
  const m = new SimMachine({ hostname: setup?.hostname, ...opts });
  await m.applySetup(setup);
  return m;
}

/** Would this line need a continuation ("> ") because of an open quote, a trailing pipe, an unfinished if/for/while or a here-document? */
export function needsMore(line: string): boolean {
  const r = parse(line);
  if (!r.ok && r.incomplete) return true;
  return controlIncomplete(line);
}

export type { Machine };
export { FsError, NS_TYPES };
