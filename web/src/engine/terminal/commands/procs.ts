// Processes and signals: ps, pstree, top, kill, pkill, pgrep, killall,
// nohup, nice, yes — and the lab programs of the Linux block (memhog,
// leaky, threads-demo, burner, spawner, sigdemo, web-demo) plus the daemons
// systemd starts (cron, sshd, nginx, journald). Output formats follow
// procps-ng 4 and bash 5.2.

import { bi } from '../../../core/i18n';
import type { CmdContext, ShellCommand } from '../../../core/types';
import { HOST_NS, MEM_BASE_USED, MEM_CACHE, MEM_TOTAL, hasCapHex, type KProc } from '../kernel';
import { ForkError, SIGNALS, parseSignal, registerProgram, sigNum, type RunAs, type SimMachine } from '../shell';
import { ROOT_CRED } from '../vfs';
import { cmdDoc, parseArgs, usageError } from './util';

const M = (ctx: CmdContext) => ctx.machine as unknown as SimMachine;

/** Processes visible from the current session, with the pid as seen there. */
export function visibleProcs(m: SimMachine): (KProc & { vpid: number; vppid: number })[] {
  const view = m.procView();
  return (m.procs.list() as KProc[])
    .map((p) => {
      const vpid = m.viewPid(p, view);
      const parent = m.procs.get(p.ppid) as KProc | undefined;
      return vpid === null ? null : { ...p, vpid, vppid: parent ? (m.viewPid(parent, view) ?? 0) : 0 };
    })
    .filter((p): p is KProc & { vpid: number; vppid: number } => p !== null)
    .sort((a, b) => a.vpid - b.vpid);
}

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const minsec = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

function cpuTime(m: SimMachine, p: KProc): number {
  return Math.max(0, (m.now() - p.start) * (m.cpuOf(p) / 100)) + (p.pid < 100 ? 1200 : 0);
}

function stat(m: SimMachine, p: KProc & { vpid: number }): string {
  let s: string = p.state === 'R' || m.cpuOf(p) > 0 ? 'R' : p.state;
  if (p.nice > 0) s += 'N';
  if (p.nice < 0) s += '<';
  if (p.cmd === 'bash' || p.cmd === 'sshd' || p.vpid === 1) s += 's';
  if (p.threads > 1) s += 'l';
  if (p.tty !== '?' && (p.pid === m.current || p.pid === m.shellPid)) s += '+';
  return s;
}

const cmdline = (p: KProc) => (p.argv[0]?.startsWith('[') ? p.argv[0] : p.argv.join(' '));
const userOf = (m: SimMachine, uid: number) => {
  const n = m.userName_(uid);
  return n.length > 8 ? n.slice(0, 7) + '+' : n;
};

const PS_FIELDS: Record<string, { head: string; right?: boolean; get(m: SimMachine, p: KProc & { vpid: number; vppid: number }): string }> = {
  pid: { head: 'PID', right: true, get: (_m, p) => String(p.vpid) },
  ppid: { head: 'PPID', right: true, get: (_m, p) => String(p.vppid) },
  user: { head: 'USER', get: (m, p) => userOf(m, p.uid) },
  uid: { head: 'UID', right: true, get: (m, p) => String(m.displayUid(p.uid)) },
  stat: { head: 'STAT', get: (m, p) => stat(m, p) },
  state: { head: 'S', get: (_m, p) => p.state },
  comm: { head: 'COMMAND', get: (_m, p) => p.cmd },
  cmd: { head: 'CMD', get: (_m, p) => cmdline(p) },
  args: { head: 'COMMAND', get: (_m, p) => cmdline(p) },
  command: { head: 'COMMAND', get: (_m, p) => cmdline(p) },
  rss: { head: 'RSS', right: true, get: (_m, p) => String(p.rss) },
  vsz: { head: 'VSZ', right: true, get: (_m, p) => String(p.rss ? p.rss * 3 + 2400 : 0) },
  '%cpu': { head: '%CPU', right: true, get: (m, p) => m.cpuOf(p).toFixed(1) },
  '%mem': { head: '%MEM', right: true, get: (_m, p) => ((p.rss / MEM_TOTAL) * 100).toFixed(1) },
  nlwp: { head: 'NLWP', right: true, get: (_m, p) => String(p.threads) },
  ni: { head: 'NI', right: true, get: (_m, p) => String(p.nice) },
  tty: { head: 'TT', get: (_m, p) => p.tty },
  time: { head: 'TIME', right: true, get: (m, p) => clock(cpuTime(m, p)) },
  etime: { head: 'ELAPSED', right: true, get: (m, p) => minsec(m.now() - p.start) },
  cgroup: { head: 'CGROUP', get: (_m, p) => `0::${p.cgroup}` },
  pidns: { head: 'PIDNS', right: true, get: (_m, p) => String(p.ns.pid) },
  utsns: { head: 'UTSNS', right: true, get: (_m, p) => String(p.ns.uts) },
  unit: { head: 'UNIT', get: (_m, p) => p.unit ?? '-' },
};

const ps: ShellCommand = {
  ...cmdDoc({
    name: 'ps',
    summary: bi('показать процессы', 'report a snapshot of the current processes'),
    whatis: 'report a snapshot of the current processes',
    synopsis: ['ps [options]'],
    description:
      'ps displays information about a selection of the active processes. It reads the information from /proc.\nThis version of ps accepts several kinds of options: UNIX options, which may be grouped and must be preceded by a dash (ps -ef); BSD options, which may be grouped and must not be used with a dash (ps aux).\nBy default, ps selects all processes with the same effective user ID as the current user and associated with the same terminal as the invoker.',
    options: [
      ['a', 'Lift the BSD-style "only yourself" restriction (with x: all processes).'],
      ['u', 'Display user-oriented format.'],
      ['x', 'Lift the BSD-style "must have a tty" restriction.'],
      ['-e, -A', 'Select all processes.'],
      ['-f', 'Do full-format listing: UID, PID, PPID, C, STIME, TTY, TIME, CMD.'],
      ['-L', 'Show threads, possibly with LWP and NLWP columns.'],
      ['-C cmdlist', 'Select by command name.'],
      ['-p pidlist', 'Select by process ID.'],
      ['-u userlist', 'Select by effective user ID (EUID) or name.'],
      ['-o format', 'User-defined format: a list of column names separated by commas, for example -o pid,ppid,stat,comm.'],
      ['--sort spec', 'Specify sorting order: [+|-]key[,[+|-]key[,...]]. -rss: by resident memory, largest first.'],
    ],
    extra: [
      {
        id: 'STANDARD FORMAT SPECIFIERS',
        body: 'args      COMMAND   command with all its arguments as a string.\ncomm      COMMAND   command name (only the executable name).\n%cpu      %CPU      cpu utilization of the process in "##.#" format.\n%mem      %MEM      ratio of the process\'s resident set size to the physical memory on the machine.\nnlwp      NLWP      number of lwps (threads) in the process.\nni        NI        nice value.\npid       PID       a number representing the process ID.\nppid      PPID      parent process ID.\nrss       RSS       resident set size, the non-swapped physical memory that a task has used (in kilobytes).\nstat      STAT      multi-character process state.\nuser      USER      effective user name.\netime     ELAPSED   elapsed time since the process was started.\ncgroup    CGROUP    display control groups to which the process belongs.\npidns     PIDNS     unique inode number describing the namespace the process belongs to.',
      },
      {
        id: 'PROCESS STATE CODES',
        body: 'D    uninterruptible sleep (usually IO)\nI    Idle kernel thread\nR    running or runnable (on run queue)\nS    interruptible sleep (waiting for an event to complete)\nT    stopped by job control signal\nZ    defunct ("zombie") process, terminated but not reaped by its parent\n\nFor BSD formats and when the stat keyword is used, additional characters may be displayed:\n<    high-priority (not nice to other users)\nN    low-priority (nice to other users)\nl    is multi-threaded\ns    is a session leader\n+    is in the foreground process group',
      },
    ],
    examples: [
      ['ps aux', 'Every process on the machine, user-oriented.'],
      ['ps -ef --forest', 'Every process with its parent (PPID).'],
      ['ps -eLf', 'Every thread: LWP is the thread id, NLWP the number of threads.'],
      ['ps -eo pid,rss,comm --sort=-rss | head', 'The processes that use the most memory.'],
    ],
    seeAlso: 'pgrep(1), pstree(1), top(1), proc(5)',
  }),
  run(ctx) {
    const m = M(ctx);
    if (!ctx.fs.exists('/proc/1') && !ctx.fs.exists('/proc/self')) {
      ctx.err('Error, do this: mount -t proc proc /proc\n');
      return 1;
    }
    const raw = ctx.argv.slice(1);
    let bsd = '';
    const opts = new Set<string>();
    let fields: string[] | null = null;
    let sortKey: string | undefined;
    const sel: { C?: string[]; p?: number[]; u?: string[] } = {};
    for (let i = 0; i < raw.length; i++) {
      const a = raw[i];
      if (/^[auxfwe]+$/.test(a) && !a.startsWith('-')) {
        bsd += a;
        continue;
      }
      if (a === '-o' || a === 'o') fields = (raw[++i] ?? '').split(',').filter(Boolean);
      else if (a.startsWith('-o')) fields = a.slice(2).split(',');
      else if (a === '--sort') sortKey = raw[++i];
      else if (a.startsWith('--sort=')) sortKey = a.slice(7);
      else if (a === '-C') sel.C = (raw[++i] ?? '').split(',');
      else if (a === '-p' || a === '--pid') sel.p = (raw[++i] ?? '').split(',').map(Number);
      else if (a === '-u' || a === '-U' || a === '--user') sel.u = (raw[++i] ?? '').split(',');
      else if (a === '--forest' || a === '--no-headers') opts.add(a);
      else if (/^-[eAfLlFjH]+$/.test(a)) for (const c of a.slice(1)) opts.add(c === 'A' ? 'e' : c);
      else if (/^-[eAfLlFjH]+o$/.test(a)) {
        for (const c of a.slice(1, -1)) opts.add(c === 'A' ? 'e' : c);
        fields = (raw[++i] ?? '').split(',').filter(Boolean);
      }
      else {
        ctx.err(`error: unsupported option (BSD syntax)\n\nUsage:\n ps [options]\n\n Try 'ps --help <simple|list|output|threads|misc|all>'\n  or 'ps --help <s|l|o|t|m|a>'\n for additional help text.\n\nFor more details see ps(1).\n`);
        return 1;
      }
    }
    let list = visibleProcs(m);
    const all = opts.has('e') || (bsd.includes('a') && bsd.includes('x'));
    if (sel.C) list = list.filter((p) => sel.C!.includes(p.cmd));
    else if (sel.p) list = list.filter((p) => sel.p!.includes(p.vpid));
    else if (sel.u) list = list.filter((p) => sel.u!.includes(m.userName_(p.uid)) || sel.u!.includes(String(p.uid)));
    else if (!all) {
      if (bsd.includes('x')) list = list.filter((p) => p.uid === ctx.user.uid);
      else if (bsd.includes('a')) list = list.filter((p) => p.tty !== '?');
      else list = list.filter((p) => p.tty === 'pts/0' && p.uid === ctx.user.uid && (p.pid === m.shellPid || p.ppid === m.shellPid || p.pid === m.current || m.depth() > 0));
    }
    if (sortKey) {
      for (const key of sortKey.split(',').reverse()) {
        const desc = key.startsWith('-');
        const k = key.replace(/^[-+]/, '');
        const f = PS_FIELDS[k] ?? PS_FIELDS[k.toLowerCase()];
        if (!f) continue;
        list.sort((a, b) => {
          const va = f.get(m, a);
          const vb = f.get(m, b);
          const r = f.right ? Number(va) - Number(vb) : va.localeCompare(vb);
          return desc ? -r : r;
        });
      }
    }
    const threads = opts.has('L');
    const rowsOf = (p: (typeof list)[number]) => (threads ? Array.from({ length: Math.max(1, p.threads) }, (_, t) => ({ p, lwp: p.vpid + t })) : [{ p, lwp: p.vpid }]);
    let head: string[];
    let rows: string[][];
    let rightCols: boolean[];
    if (fields) {
      head = fields.map((f) => (f.includes('=') ? f.split('=')[1] : (PS_FIELDS[f]?.head ?? f.toUpperCase())));
      rows = list.flatMap(rowsOf).map(({ p, lwp }) => fields!.map((f) => (f === 'lwp' || f === 'tid' ? String(lwp) : (PS_FIELDS[f.split('=')[0]]?.get(m, p) ?? '-'))));
      rightCols = fields.map((f) => !!PS_FIELDS[f.split('=')[0]]?.right || f === 'lwp');
      if (fields.includes('lwp')) head = head.map((h, i) => (fields![i] === 'lwp' ? 'LWP' : h));
    } else if (bsd.includes('u')) {
      head = ['USER', 'PID', '%CPU', '%MEM', 'VSZ', 'RSS', 'TTY', 'STAT', 'START', 'TIME', 'COMMAND'];
      rows = list.map((p) => [userOf(m, p.uid), String(p.vpid), m.cpuOf(p).toFixed(1), ((p.rss / MEM_TOTAL) * 100).toFixed(1), String(p.rss ? p.rss * 3 + 2400 : 0), String(p.rss), p.tty, stat(m, p), hhmm(p.start), minsec(cpuTime(m, p)), cmdline(p)]);
      rightCols = [false, true, true, true, true, true, false, false, false, true, false];
    } else if (opts.has('f') || opts.has('F')) {
      head = threads ? ['UID', 'PID', 'PPID', 'LWP', 'C', 'NLWP', 'STIME', 'TTY', 'TIME', 'CMD'] : ['UID', 'PID', 'PPID', 'C', 'STIME', 'TTY', 'TIME', 'CMD'];
      rows = list.flatMap(rowsOf).map(({ p, lwp }) => (threads ? [userOf(m, p.uid), String(p.vpid), String(p.vppid), String(lwp), String(Math.round(m.cpuOf(p))), String(p.threads), hhmm(p.start), p.tty, clock(cpuTime(m, p)), cmdline(p)] : [userOf(m, p.uid), String(p.vpid), String(p.vppid), String(Math.round(m.cpuOf(p))), hhmm(p.start), p.tty, clock(cpuTime(m, p)), cmdline(p)]));
      rightCols = threads ? [false, true, true, true, true, true, false, false, true, false] : [false, true, true, true, false, false, true, false];
    } else {
      head = threads ? ['PID', 'LWP', 'TTY', 'TIME', 'CMD'] : ['PID', 'TTY', 'TIME', 'CMD'];
      rows = list.flatMap(rowsOf).map(({ p, lwp }) => (threads ? [String(p.vpid), String(lwp), p.tty, clock(cpuTime(m, p)), p.cmd] : [String(p.vpid), p.tty, clock(cpuTime(m, p)), p.cmd]));
      rightCols = threads ? [true, true, false, true, false] : [true, false, true, false];
    }
    const table = opts.has('--no-headers') ? rows : [head, ...rows];
    const widths = head.map((_, i) => Math.max(...table.map((r) => (i === head.length - 1 ? 0 : r[i].length)), i === 1 && !fields && !bsd ? 8 : 0));
    const minW: Record<string, number> = { PID: 7, PPID: 7, LWP: 7, USER: 8, UID: 8, TTY: 8 };
    for (const r of table) {
      ctx.out(
        r
          .map((c, i) => {
            if (i === r.length - 1) return c;
            const w = Math.max(widths[i], minW[head[i]] ?? 0);
            return rightCols[i] ? c.padStart(w) : c.padEnd(w);
          })
          .join(' ')
          .slice(0, ctx.isatty ? ctx.cols : 4096) + '\n',
      );
    }
    return list.length ? 0 : 1;
  },
};

const pstree: ShellCommand = {
  ...cmdDoc({
    name: 'pstree',
    summary: bi('показать процессы деревом родителей', 'display a tree of processes'),
    whatis: 'display a tree of processes',
    synopsis: ['pstree [-p] [-u] [pid | user]'],
    description: 'pstree shows running processes as a tree. The tree is rooted at either pid or init if pid is omitted. Identical branches are merged by putting them in square brackets and prefixing them with the repetition count.',
    options: [
      ['-p, --show-pids', 'Show PIDs. PIDs are shown as decimal numbers in parentheses after each process name. -p implicitly disables compaction.'],
      ['-u, --uid-changes', 'Show uid transitions.'],
    ],
    seeAlso: 'ps(1), top(1), proc(5)',
  }),
  run(ctx) {
    const m = M(ctx);
    const showPid = ctx.argv.includes('-p') || ctx.argv.includes('--show-pids');
    const list = visibleProcs(m).filter((p) => p.cmd !== 'kthreadd');
    const root = Number(ctx.argv.slice(1).find((x) => /^\d+$/.test(x)) ?? list[0]?.vpid ?? 1);
    const kids = (pid: number) => list.filter((p) => p.vppid === pid && p.vpid !== pid);
    const label = (p: (typeof list)[number]) => `${p.cmd}${showPid ? `(${p.vpid})` : ''}${p.threads > 1 ? `───${showPid ? '' : `${p.threads - 1}*[`}{${p.cmd}}${showPid ? `(${p.vpid + 1})` : ']'}` : ''}`;
    const out: string[] = [];
    const walk = (p: (typeof list)[number], prefix: string, first: boolean, last: boolean) => {
      const me = label(p);
      const children = kids(p.vpid);
      let groups: { p: (typeof list)[number]; n: number }[] = children.map((c) => ({ p: c, n: 1 }));
      if (!showPid) {
        const merged: typeof groups = [];
        for (const g of groups) {
          const same = merged.find((x) => x.p.cmd === g.p.cmd && !kids(g.p.vpid).length && !kids(x.p.vpid).length);
          if (same) same.n++;
          else merged.push(g);
        }
        groups = merged;
      }
      if (!groups.length) {
        out[out.length - 1] = (out[out.length - 1] ?? '') + me;
        return;
      }
      void first;
      void last;
      const startLen = (out[out.length - 1] ?? '').length;
      out[out.length - 1] = (out[out.length - 1] ?? '') + me;
      const pad = ' '.repeat(startLen + me.length);
      groups.forEach((g, i) => {
        const conn = groups.length === 1 ? '───' : i === 0 ? '─┬─' : i === groups.length - 1 ? ' └─' : ' ├─';
        if (i > 0) out.push(prefix + pad.slice(prefix.length));
        out[out.length - 1] += conn + (g.n > 1 ? `${g.n}*[` : '');
        walk(g.p, (prefix + pad.slice(prefix.length)) + (i === groups.length - 1 || groups.length === 1 ? '   ' : ' │ '), i === 0, i === groups.length - 1);
        if (g.n > 1) out[out.length - 1] += ']';
      });
    };
    const r = list.find((p) => p.vpid === root);
    if (!r) return 1;
    out.push('');
    walk(r, '', true, true);
    // fix the vertical bars of the continuation lines
    ctx.out(out.map((l) => l.replace(/\s+$/, '')).join('\n') + '\n');
    return 0;
  },
};

function topText(m: SimMachine, sortMem: boolean, only?: number[]): string {
  const list = visibleProcs(m).filter((p) => !only || only.includes(p.vpid));
  const now = m.now();
  const up = Math.floor((now - m.bootAt) / 60000);
  const busy = list.reduce((s, p) => s + m.cpuOf(p), 0);
  const us = Math.min(100, busy * 0.92 + 0.3);
  const sy = Math.min(100 - us, busy * 0.08 + 0.2);
  const used = MEM_BASE_USED + list.reduce((s, p) => s + p.rss, 0);
  const free = Math.max(0, MEM_TOTAL - used - MEM_CACHE);
  const load = (busy / 100 + 0.08).toFixed(2);
  const st = (s: string) => list.filter((p) => (s === 'R' ? m.cpuOf(p) > 0 || p.state === 'R' : p.state === s && !(s === 'S' && m.cpuOf(p) > 0))).length;
  const mib = (k: number) => (k / 1024).toFixed(1).padStart(9);
  const head = [
    `top - ${new Date(now).toISOString().slice(11, 19)} up ${up} min,  1 user,  load average: ${load}, ${(Number(load) * 0.7).toFixed(2)}, ${(Number(load) * 0.4).toFixed(2)}`,
    `Tasks: ${String(list.length).padStart(3)} total, ${String(st('R')).padStart(3)} running, ${String(st('S')).padStart(3)} sleeping, ${String(st('T')).padStart(3)} stopped, ${String(st('Z')).padStart(3)} zombie`,
    `%Cpu(s): ${us.toFixed(1).padStart(4)} us, ${sy.toFixed(1).padStart(4)} sy,  0.0 ni, ${Math.max(0, 100 - us - sy - 0.1).toFixed(1).padStart(4)} id,  0.1 wa,  0.0 hi,  0.0 si,  0.0 st`,
    `MiB Mem : ${mib(MEM_TOTAL)} total, ${mib(free)} free, ${mib(used)} used, ${mib(MEM_CACHE)} buff/cache`,
    `MiB Swap:       0.0 total,       0.0 free,       0.0 used. ${mib(free + MEM_CACHE * 0.85)} avail Mem`,
    '',
    '    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND',
  ];
  const sorted = [...list].sort((a, b) => (sortMem ? b.rss - a.rss : m.cpuOf(b) - m.cpuOf(a) || b.rss - a.rss || a.vpid - b.vpid));
  const rows = sorted.map((p) => {
    const t = cpuTime(m, p);
    const time = `${Math.floor(t / 60000)}:${String(Math.floor((t % 60000) / 1000)).padStart(2, '0')}.${String(Math.floor((t % 1000) / 10)).padStart(2, '0')}`;
    return `${String(p.vpid).padStart(7)} ${userOf(m, p.uid).padEnd(8)}  ${String(20 + p.nice).padStart(2)} ${String(p.nice).padStart(3)} ${String(p.rss ? p.rss * 3 + 2400 : 0).padStart(7)} ${String(p.rss).padStart(6)} ${String(Math.round(p.rss * 0.6)).padStart(6)} ${m.cpuOf(p) > 0 ? 'R' : p.state} ${m.cpuOf(p).toFixed(1).padStart(5)} ${((p.rss / MEM_TOTAL) * 100).toFixed(1).padStart(5)} ${time.padStart(9)} ${p.cmd}`;
  });
  return [...head, ...rows].join('\n') + '\n';
}

const top: ShellCommand = {
  ...cmdDoc({
    name: 'top',
    summary: bi('процессы по нагрузке, сводка машины', 'processes by load and a summary of the machine'),
    whatis: 'display Linux processes',
    synopsis: ['top -hv | -bcEeHiOSs1 -d secs -n max -u|U user -p pids -o field -w [cols]'],
    description:
      'The top program provides a dynamic real-time view of a running system. It can display system summary information as well as a list of processes or threads currently being managed by the Linux kernel.\nThe summary: uptime and load average (1, 5, 15 minutes), the number of tasks in each state, CPU time split into us (user), sy (system), ni, id (idle), wa (waiting for I/O), and memory: total, free, used, buff/cache, avail.\nOn this simulated machine top shows one snapshot (q closes it); run it again to refresh.',
    options: [
      ['-b, --batch', 'Starts top in Batch mode: output goes to standard output, useful with -n 1 and a pipe.'],
      ['-n, --iterations=NUMBER', 'Specifies the maximum number of iterations, or frames, top should produce before ending.'],
      ['-o, --sort-override=FIELD', 'Specifies the name of the field on which tasks will be sorted (%CPU, %MEM).'],
      ['-p, --pid=PIDLIST', 'Monitor only processes with specified process IDs.'],
    ],
    extra: [
      { id: '2a. UPTIME and LOAD Averages', body: 'This portion consists of a single line containing: program or window name, current time and length of time since last boot, total number of users, system load avg over the last 1, 5 and 15 minutes. The load average is the average number of processes that are running or waiting to run (R) or waiting for disk (D); compare it with the number of CPUs.' },
      { id: '2b. TASK and CPU States', body: 'us: time running un-niced user processes\nsy: time running kernel processes\nni: time running niced user processes\nid: time spent in the kernel idle handler\nwa: time waiting for I/O completion' },
    ],
    seeAlso: 'ps(1), free(1), uptime(1), proc(5)',
  }),
  run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1);
    const batch = args.some((a) => /^-[a-z]*b/.test(a) || a === '--batch');
    const oi = args.findIndex((a) => a === '-o');
    const sortMem = (oi >= 0 && /MEM|RES/i.test(args[oi + 1] ?? '')) || args.includes('-M');
    const pi = args.findIndex((a) => a === '-p');
    const only = pi >= 0 ? (args[pi + 1] ?? '').split(',').map(Number) : undefined;
    const text = topText(m, sortMem, only);
    if (batch || !ctx.isatty) ctx.out(text);
    else ctx.effect({ kind: 'pager', title: 'top (one snapshot; q to quit, run top again to refresh)', text });
    return 0;
  },
};

/** Deliver a signal from the current session, with the kernel's rules for init processes (pid_namespaces(7)). */
export function sendSignal(m: SimMachine, ctx: CmdContext, target: KProc, sig: string): 'ok' | 'perm' | 'ignored' {
  const sender = m.procs.get((ctx as CmdContext & { pid?: number }).pid || m.shellPid) as KProc | undefined;
  const capKill = ctx.user.uid === 0 && hasCapHex(m.shellProc().capEff, 'kill');
  if (ctx.user.uid !== target.uid && !capKill && ctx.cred.uid !== 0) return 'perm';
  if (ctx.user.uid !== 0 && ctx.user.uid !== target.uid) return 'perm';
  const nsRec = m.kernel.ns.get(target.ns.pid);
  const isInit = target.pid === 1 || (nsRec && nsRec.id !== HOST_NS.pid && nsRec.init === target.pid);
  if (isInit) {
    const handled = (target.ignores ?? []).includes(sig);
    const fromAncestor = sender ? !m.kernel.pidChain(sender.ns.pid).includes(target.ns.pid) || sender.ns.pid !== target.ns.pid : true;
    if (target.pid === 1) return sig === 'KILL' || sig === 'STOP' ? 'ignored' : handled ? 'ok' : 'ignored';
    if (!handled && !(fromAncestor && (sig === 'KILL' || sig === 'STOP'))) return 'ignored';
  }
  if ((target.ignores ?? []).includes(sig) && sig !== 'KILL' && sig !== 'STOP') onHandled(m, target, sig);
  m.procs.kill(target.pid, sig);
  return 'ok';
}

/** What a process with a handler does with a signal. */
function onHandled(m: SimMachine, p: KProc, sig: string): void {
  if (p.cmd === 'nginx' && sig === 'HUP') {
    const line = `${new Date(m.now()).toISOString().replace('T', ' ').slice(0, 19).replace(/-/g, '/')} [notice] ${p.pid}#${p.pid}: signal 1 (SIGHUP) received from ${m.shellPid}, reconfiguring\n`;
    try {
      m.vfs.writeFileAs('/var/log/nginx/error.log', line, ROOT_CRED, { append: true });
    } catch {
      /* no log dir */
    }
  }
  if (p.cmd === 'sigdemo') m.vfs.writeFileAs('/tmp/sigdemo.log', `sigdemo[${p.pid}]: got SIG${sig}, handled\n`, ROOT_CRED, { append: true });
  if (p.cmd === 'sshd' && sig === 'HUP' && m.systemd) m.systemd.log('sshd', p.pid, 'Received SIGHUP; restarting.', { unit: 'ssh.service' });
}

const kill: ShellCommand = {
  name: 'kill',
  builtin: true,
  summary: bi('послать сигнал процессу', 'send a signal to a process'),
  help: `kill: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]
    Send a signal to a job.

    Send the processes identified by PID or JOBSPEC the signal named by
    SIGSPEC or SIGNUM.  If neither SIGSPEC nor SIGNUM is present, then
    SIGTERM is assumed.

    Options:
      -s sig	SIG is a signal name
      -n sig	SIG is a signal number
      -l	list the signal names; if arguments follow \`-l' they are
    		assumed to be signal numbers for which names should be listed

    Kill is a shell builtin for two reasons: it allows job IDs to be used
    instead of process IDs, and allows processes to be killed if the limit
    on processes that you can create is reached.

    Exit Status:
    Returns success unless an invalid option is given or an error occurs.`,
  man: cmdDoc({
    name: 'kill',
    summary: bi('', ''),
    whatis: 'send a signal to a process',
    synopsis: ['kill [-signal|-s signal] pid...', 'kill -l [number]'],
    description: 'The default signal for kill is TERM. Use -l to list available signals. Particularly useful signals include HUP, INT, KILL, STOP, CONT, and 0. Signals may be specified in three ways: -9, -SIGKILL or -KILL.\nThe process decides what to do with most signals (it may have a handler); KILL and STOP are handled by the kernel and cannot be caught or ignored.',
    options: [['-s, --signal signal', 'The signal to send. It may be given as a name or a number.'], ['-l, --list [number]', 'Print a list of signal names, or convert the given signal number to a name.']],
    extra: [{ id: 'NOTES', body: 'Your shell (command line interpreter) may have a built-in kill command (bash does: see help kill). A process killed by signal N exits with status 128+N: SIGTERM 143, SIGKILL 137.' }],
    examples: [['kill 1234', 'Ask process 1234 to finish (SIGTERM).'], ['kill -9 1234', 'Kill it; the process cannot refuse (SIGKILL).'], ['kill -HUP $(cat /run/nginx.pid)', 'Ask nginx to re-read its configuration.']],
    seeAlso: 'bash(1), killall(1), pkill(1), signal(7)',
  }).man,
  run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1);
    let sig = 'TERM';
    if (args[0] === '-l' || args[0] === '-L') {
      if (args[1]) {
        const n = Number(args[1]);
        const name = parseSignal(args[1]);
        ctx.out((Number.isNaN(n) ? String(sigNum(name ?? '') ?? '') : (name ?? '')) + '\n');
        return 0;
      }
      const lines: string[] = [];
      for (let i = 0; i < SIGNALS.length; i += 5) lines.push(SIGNALS.slice(i, i + 5).map(([n, k]) => `${String(k).padStart(2)}) SIG${n}`.padEnd(15)).join(' ').trimEnd());
      ctx.out(lines.join('\n') + '\n');
      return 0;
    }
    if (args[0] === '-s' || args[0] === '-n') {
      const s = parseSignal(args[1] ?? '');
      if (!s) {
        ctx.err(`bash: kill: ${args[1]}: invalid signal specification\n`);
        return 1;
      }
      sig = s;
      args.splice(0, 2);
    } else if (args[0]?.startsWith('-') && args[0] !== '--') {
      const s = parseSignal(args[0]);
      if (!s && args[0] !== '-0') {
        ctx.err(`bash: kill: ${args[0].slice(1)}: invalid signal specification\n`);
        return 1;
      }
      sig = s ?? '0';
      args.shift();
    }
    if (!args.length) {
      ctx.err('kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]\n');
      return 2;
    }
    let exit = 0;
    for (const a of args) {
      let target: KProc | undefined;
      if (a.startsWith('%')) {
        const n = Number(a.slice(1) || m.jobs[m.jobs.length - 1]?.n);
        const j = m.jobs.find((x) => x.n === n && (x.state === 'Running' || x.state === 'Stopped'));
        if (!j) {
          ctx.err(`bash: kill: ${a}: no such job\n`);
          exit = 1;
          continue;
        }
        target = m.procs.get(j.pid) as KProc | undefined;
      } else if (/^-?\d+$/.test(a)) target = m.pidByView(Number(a));
      else {
        ctx.err(`bash: kill: ${a}: arguments must be process or job IDs\n`);
        exit = 1;
        continue;
      }
      if (!target) {
        ctx.err(`bash: kill: (${a}) - No such process\n`);
        exit = 1;
        continue;
      }
      if (sig === '0') continue;
      const r = sendSignal(m, ctx, target, sig);
      if (r === 'perm') {
        ctx.err(`bash: kill: (${a}) - Operation not permitted\n`);
        exit = 1;
      }
    }
    return exit;
  },
};

function matchProcs(m: SimMachine, ctx: CmdContext, args: string[], name: string): { procs: (KProc & { vpid: number })[]; sig: string; error?: number; flags: Set<string> } {
  const flags = new Set<string>();
  let sig = 'TERM';
  let user: string | undefined;
  let pattern: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-u') user = args[++i];
    else if (a === '--signal') sig = parseSignal(args[++i] ?? '') ?? sig;
    else if (/^-[fxnolc]+$/.test(a)) for (const c of a.slice(1)) flags.add(c);
    else if (a.startsWith('-') && parseSignal(a)) sig = parseSignal(a)!;
    else pattern = a;
  }
  if (pattern === undefined) {
    ctx.err(`${name}: no matching criteria specified\nTry \`${name} --help' for more information.\n`);
    return { procs: [], sig, error: 2, flags };
  }
  let re: RegExp;
  try {
    re = flags.has('x') ? new RegExp(`^(?:${pattern})$`) : new RegExp(pattern);
  } catch {
    return { procs: [], sig, error: 2, flags };
  }
  const self = (ctx as CmdContext & { pid?: number }).pid;
  let list = visibleProcs(m).filter((p) => p.pid !== self && p.cmd !== 'kthreadd' && re.test(flags.has('f') ? p.argv.join(' ') : p.cmd));
  if (user) list = list.filter((p) => m.userName_(p.uid) === user || String(p.uid) === user);
  if (flags.has('o')) list = list.sort((a, b) => a.start - b.start || a.vpid - b.vpid).slice(0, 1);
  if (flags.has('n')) list = list.sort((a, b) => b.start - a.start || b.vpid - a.vpid).slice(0, 1);
  return { procs: list, sig, flags };
}

const pgrep: ShellCommand = {
  ...cmdDoc({
    name: 'pgrep',
    summary: bi('найти номера процессов по имени', 'look up processes by name'),
    whatis: 'look up, signal, or wait for processes based on name and other attributes',
    synopsis: ['pgrep [options] pattern', 'pkill [options] pattern'],
    description: 'pgrep looks through the currently running processes and lists the process IDs which match the selection criteria to stdout. pkill will send the specified signal (by default SIGTERM) to each process instead of listing them on stdout.\nThe pattern is an extended regular expression matched against the process name (or, with -f, the full command line).',
    options: [
      ['-signal, --signal signal', '(pkill only) Defines the signal to send to each matched process.'],
      ['-f, --full', 'The pattern is normally only matched against the process name. When -f is set, the full command line is used.'],
      ['-l, --list-name', 'List the process name as well as the process ID. (pgrep only.)'],
      ['-n, --newest', 'Select only the newest (most recently started) of the matching processes.'],
      ['-o, --oldest', 'Select only the oldest (least recently started) of the matching processes.'],
      ['-u, --euid euid,...', 'Only match processes whose effective user ID is listed.'],
      ['-x, --exact', 'Only match processes whose names (or command lines if -f is specified) exactly match the pattern.'],
    ],
    exit: '0  One or more processes matched the criteria.\n1  No processes matched or none of them could be signalled.\n2  Syntax error in the command line.',
    seeAlso: 'ps(1), kill(1), signal(7)',
  }),
  run(ctx) {
    const m = M(ctx);
    const r = matchProcs(m, ctx, ctx.argv.slice(1), 'pgrep');
    if (r.error) return r.error;
    for (const p of r.procs) ctx.out(r.flags.has('l') ? `${p.vpid} ${p.cmd}\n` : `${p.vpid}\n`);
    return r.procs.length ? 0 : 1;
  },
};

const pkill: ShellCommand = {
  name: 'pkill',
  summary: bi('послать сигнал процессам по имени', 'signal processes by name'),
  help: `Usage:
 pkill [options] <pattern>

Options:
 -<sig>, --signal <sig>    signal to send (either number or name)
 -f, --full                use full process name to match
 -n, --newest              select most recently started
 -o, --oldest              select least recently started
 -u, --euid <ID,...>       match by effective IDs
 -x, --exact               match exactly with the command name

For more details see pgrep(1).`,
  run(ctx) {
    const m = M(ctx);
    const r = matchProcs(m, ctx, ctx.argv.slice(1), 'pkill');
    if (r.error) return r.error;
    let any = false;
    for (const p of r.procs) {
      const res = sendSignal(m, ctx, p, r.sig);
      if (res === 'perm') ctx.err(`pkill: killing pid ${p.vpid} failed: Operation not permitted\n`);
      else any = true;
    }
    return any ? 0 : 1;
  },
};

const killall: ShellCommand = {
  ...cmdDoc({
    name: 'killall',
    summary: bi('послать сигнал всем процессам с этим именем', 'kill processes by name'),
    whatis: 'kill processes by name',
    synopsis: ['killall [-s signal|-signal] name ...'],
    description: 'killall sends a signal to all processes running any of the specified commands. If no signal name is specified, SIGTERM is sent.',
    seeAlso: 'kill(1), pkill(1)',
  }),
  run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1);
    let sig = 'TERM';
    if (args[0]?.startsWith('-') && parseSignal(args[0])) sig = parseSignal(args.shift()!)!;
    if (args[0] === '-s') {
      args.shift();
      sig = parseSignal(args.shift() ?? '') ?? sig;
    }
    let exit = 0;
    for (const n of args) {
      const list = visibleProcs(m).filter((p) => p.cmd === n);
      if (!list.length) {
        ctx.err(`${n}: no process found\n`);
        exit = 1;
      }
      for (const p of list) if (sendSignal(m, ctx, p, sig) === 'perm') exit = 1;
    }
    return exit;
  },
};

const nohup: ShellCommand = {
  ...cmdDoc({
    name: 'nohup',
    summary: bi('запустить команду, которая не завершится при закрытии терминала', 'run a command immune to hangups'),
    whatis: 'run a command immune to hangups, with output to a non-tty',
    synopsis: ['nohup COMMAND [ARG]...'],
    description: "Run COMMAND, ignoring hangup signals. If standard output is a terminal, append output to 'nohup.out' if possible, '$HOME/nohup.out' otherwise.",
    seeAlso: 'setsid(1), disown (bash builtin)',
  }),
  async run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1);
    if (!args.length) return usageError(ctx, 'missing operand');
    ctx.err("nohup: ignoring input and appending output to 'nohup.out'\n");
    let out = '';
    const code = await m.runArgv({ ...ctx, out: (s: string) => (out += s), err: (s: string) => (out += s) } as CmdContext, args, { user: ctx.user, capEff: m.shellProc().capEff });
    if (out) ctx.fs.writeFile('nohup.out', out, { append: true });
    return code;
  },
};

const nice: ShellCommand = {
  ...cmdDoc({
    name: 'nice',
    summary: bi('запустить с другим приоритетом', 'run a program with modified scheduling priority'),
    whatis: 'run a program with modified scheduling priority',
    synopsis: ['nice [OPTION] [COMMAND [ARG]...]'],
    description: 'Run COMMAND with an adjusted niceness, which affects process scheduling. With no COMMAND, print the current niceness. Niceness values range from -20 (most favorable to the process) to 19 (least favorable to the process). Only root may lower the niceness.',
    options: [['-n, --adjustment=N', 'add integer N to the niceness (default 10)']],
    seeAlso: 'renice(1), nice(2)',
  }),
  async run(ctx) {
    const a = parseArgs(ctx.argv.slice(1), { withValue: 'n', long: { adjustment: 'n' } });
    if (!a.operands.length) {
      ctx.out('0\n');
      return 0;
    }
    const m = M(ctx);
    return m.runArgv(ctx, a.operands, { user: ctx.user, capEff: m.shellProc().capEff });
  },
};

const yes: ShellCommand = {
  ...cmdDoc({
    name: 'yes',
    summary: bi('бесконечно печатать строку', 'output a string repeatedly until killed'),
    whatis: 'output a string repeatedly until killed',
    synopsis: ['yes [STRING]...'],
    description: "Repeatedly output a line with all specified STRING(s), or 'y'. It never stops by itself: it ends when the reader closes the pipe (SIGPIPE), on Ctrl+C or a signal. yes > /dev/null & keeps one CPU busy.",
    seeAlso: 'head(1)',
  }),
  run(ctx) {
    const s = (ctx.argv.slice(1).join(' ') || 'y') + '\n';
    if (!ctx.isatty) {
      ctx.out(s.repeat(5000));
      return 0;
    }
    ctx.out(s.repeat(40));
    ctx.out('^C\n');
    ctx.err('\x1b[2m(yes never stops by itself; the simulator pressed Ctrl+C for you)\x1b[0m\n');
    return 130;
  },
};

// ── lab programs ──

const labDoc = (name: string, ru: string, en: string, synopsis: string, description: string) =>
  cmdDoc({ name, summary: bi(ru, en), whatis: en, synopsis: [synopsis], description, seeAlso: 'ps(1), kill(1)', url: 'https://man7.org/linux/man-pages/man1/ps.1.html' });

const memhog: ShellCommand = {
  ...labDoc('memhog', 'учебная программа: занять N МиБ памяти', 'a lab program: allocate N MiB of memory', 'memhog MIB', 'memhog allocates MIB mebibytes of memory, one MiB at a time, touching every page so it really is resident, and prints a counter. Then it exits and the memory is freed. Started with &, it keeps holding the memory until it is killed.\nIn a cgroup with a lower memory.max the kernel OOM killer kills it with SIGKILL (exit status 137).'),
  run(ctx) {
    const m = M(ctx);
    const n = Number(ctx.argv[1] ?? 64);
    if (!Number.isFinite(n) || n <= 0) return usageError(ctx, 'MIB must be a positive number');
    const pid = (ctx as CmdContext & { pid: number }).pid;
    for (let i = 1; i <= n; i++) {
      if (!m.allocate(pid, 1024)) return 137;
      m.advance(20);
      if (i % 8 === 0 || i === n) ctx.out(`memhog: ${i} MiB\n`);
    }
    ctx.out(`memhog: allocated ${n} MiB, exiting\n`);
    return 0;
  },
};
registerProgram('memhog', {
  background: (argv) => {
    const n = Number(argv[1] ?? 64);
    return { rss: 900, grow: 4096, growTo: n * 1024 + 900 } as Partial<KProc>;
  },
});

const leaky: ShellCommand = {
  ...labDoc('leaky', 'учебная программа: утечка памяти', 'a lab program that leaks memory', 'leaky [MIB_PER_SECOND]', 'leaky grows by MIB_PER_SECOND (default 4) mebibytes of resident memory every second and never frees it, like a program with a memory leak. Start it with & and watch memory.current of its cgroup.'),
  run(ctx) {
    const m = M(ctx);
    const rate = Number(ctx.argv[1] ?? 4);
    const pid = (ctx as CmdContext & { pid: number }).pid;
    for (let s = 1; s <= 30; s++) {
      for (let k = 0; k < rate; k++) if (!m.allocate(pid, 1024)) return 137;
      m.advance(1000);
      if (s % 5 === 0) ctx.out(`leaky: rss ${Math.round((m.procs.get(pid) as KProc).rss / 1024)} MiB\n`);
    }
    ctx.err('\x1b[2m(leaky would grow until something stops it; the simulator stopped it after 30 seconds — start it with & to watch it in the background)\x1b[0m\n');
    return 130;
  },
};
registerProgram('leaky', { background: (argv) => ({ rss: 1100, grow: Number(argv[1] ?? 4) * 1024, cpuWant: 3 }) });

const threadsDemo: ShellCommand = {
  ...labDoc('threads-demo', 'учебная программа: процесс с N потоками', 'a lab program: one process with N threads', 'threads-demo N', 'threads-demo starts N threads named worker-1…worker-N inside one process and keeps running. ps -eLf shows one line per thread (LWP), /proc/PID/task has one directory per thread.'),
  run(ctx) {
    const n = Number(ctx.argv[1] ?? 4);
    ctx.out(`threads-demo: ${n} threads started (worker-1..worker-${n}) in process ${(ctx as CmdContext & { pid: number }).pid}\n`);
    ctx.err('\x1b[2m(threads-demo keeps running on a real machine; start it with & to look at its threads)\x1b[0m\n');
    return 0;
  },
};
registerProgram('threads-demo', { background: (argv) => ({ threads: Number(argv[1] ?? 4) + 1, rss: 2600 }) });

const burner: ShellCommand = {
  ...labDoc('burner', 'учебная программа: нагрузить процессор', 'a lab program that keeps a CPU busy', 'burner', 'burner spins on the CPU forever at nice 10, so the machine stays responsive. Start it with & and look at top or at cpu.stat of its cgroup.'),
  run(ctx) {
    ctx.err('\x1b[2m(burner never ends; start it with &)\x1b[0m\n');
    return 130;
  },
};
registerProgram('burner', { background: () => ({ cpuWant: 100, nice: 10, rss: 800, state: 'R' }) });
registerProgram('yes', { background: () => ({ cpuWant: 100, rss: 700, state: 'R' }) });
registerProgram('sleep', {
  background: (argv) => {
    const v = argv[1] ?? '';
    if (v === 'infinity') return { rss: 600 };
    const mt = /^(\d+(?:\.\d+)?)([smhd]?)$/.exec(v);
    if (!mt) return { error: `sleep: invalid time interval '${v}'\n`, exit: 1 };
    return { rss: 600, until: Number(mt[1]) * ({ s: 1000, m: 60000, h: 3600000, d: 86400000, '': 1000 }[mt[2]] ?? 1000) } as Partial<KProc>;
  },
});

const spawner: ShellCommand = {
  ...labDoc('spawner', 'учебная программа: породить N процессов', 'a lab program that starts N child processes', 'spawner N', 'spawner starts N child processes (sleep 3600) and exits; the children stay. In a cgroup with pids.max the fork that crosses the limit fails with "Resource temporarily unavailable".'),
  run(ctx) {
    const m = M(ctx);
    const n = Number(ctx.argv[1] ?? 10);
    const pid = (ctx as CmdContext & { pid: number }).pid;
    const as: RunAs = { user: ctx.user, capEff: (m.procs.get(pid) as KProc | undefined)?.capEff ?? '0' };
    for (let i = 1; i <= n; i++) {
      try {
        m.fork({ cmd: 'sleep', argv: ['sleep', '3600'], as, ppid: pid, extra: { until: m.now() + 3_600_000, state: 'S', rss: 600 } as Partial<KProc> });
      } catch (e) {
        if (e instanceof ForkError) {
          ctx.err(`spawner: fork #${i}: Resource temporarily unavailable\n`);
          ctx.out(`spawner: started ${i - 1} of ${n}\n`);
          return 1;
        }
        throw e;
      }
    }
    ctx.out(`spawner: started ${n} of ${n}\n`);
    return 0;
  },
};

const sigdemo: ShellCommand = {
  ...labDoc('sigdemo', 'учебная программа: перехватывает сигналы', 'a lab program that catches signals', 'sigdemo [--no-handler]', 'sigdemo installs handlers for SIGTERM, SIGINT, SIGHUP and SIGUSR1: it writes "got SIGxxx" to /tmp/sigdemo.log and keeps running. SIGKILL and SIGSTOP cannot be caught: the kernel acts on them without asking the process. With --no-handler it installs no handlers.'),
  run(ctx) {
    ctx.err('\x1b[2m(sigdemo waits for signals; start it with & and send it some with kill)\x1b[0m\n');
    return 0;
  },
};
registerProgram('sigdemo', { background: (argv) => ({ ignores: argv.includes('--no-handler') ? [] : ['TERM', 'INT', 'HUP', 'USR1'], rss: 900 }) });

/** Ports in use on the machine (by any process). */
export function listening(m: SimMachine): { port: number; p: KProc }[] {
  return (m.procs.list() as KProc[]).flatMap((p) => (p.listen ?? []).map((port) => ({ port, p })));
}

function webDemoStart(argv: string[], m: SimMachine, as: RunAs): { ok: boolean; logs: string[]; exit?: number; listen?: number[] } {
  const i = argv.indexOf('--port');
  const port = Number(i >= 0 ? argv[i + 1] : (argv.find((a) => a.startsWith('--port='))?.slice(7) ?? 8080));
  const path = argv[0]?.startsWith('/') ? argv[0] : '/usr/local/bin/web-demo';
  const ino = m.vfs.inoOf(path) ?? m.vfs.inoOf('/usr/bin/web-demo');
  const fileCap = ino !== undefined && /cap_net_bind_service/.test(m.kernel.fileCaps.get(ino) ?? '');
  if (port < 1024 && !hasCapHex(as.capEff, 'net_bind_service') && !fileCap) return { ok: false, logs: [`web-demo: listen tcp :${port}: bind: permission denied`], exit: 1 };
  if (listening(m).some((l) => l.port === port)) return { ok: false, logs: [`web-demo: listen tcp :${port}: bind: address already in use`], exit: 1 };
  const cfgI = argv.indexOf('--config');
  if (cfgI >= 0) {
    const cfg = argv[cfgI + 1];
    if (!m.vfs.statAs(cfg, ROOT_CRED)) return { ok: false, logs: [`web-demo: open ${cfg}: no such file or directory`], exit: 1 };
  }
  return { ok: true, logs: [`web-demo: listening on :${port}`], listen: [port] };
}

const webDemo: ShellCommand = {
  ...labDoc('web-demo', 'учебный веб-сервер', 'a lab web server', 'web-demo [--port N] [--config FILE]', 'web-demo answers HTTP requests with a one-line page. It listens on --port (default 8080). Ports below 1024 need root or the capability CAP_NET_BIND_SERVICE. With --config it refuses to start if the file is missing.'),
  run(ctx) {
    const m = M(ctx);
    const r = webDemoStart(ctx.argv, m, { user: ctx.user, capEff: (m.procs.get((ctx as CmdContext & { pid: number }).pid) as KProc | undefined)?.capEff ?? '0' });
    for (const l of r.logs) (r.ok ? ctx.out : ctx.err)(l + '\n');
    if (!r.ok) return r.exit ?? 1;
    ctx.err('\x1b[2m(a server keeps running in the foreground; on this machine start it with & or as a systemd service)\x1b[0m\n');
    return 0;
  },
};
registerProgram('web-demo', {
  background: (argv, m, as) => {
    const r = webDemoStart(argv, m, as);
    return r.ok ? { listen: r.listen, rss: 6400, threads: 3 } : { error: r.logs.join('\n') + '\n', exit: r.exit ?? 1 };
  },
  daemon: (argv, m, as) => ({ ...webDemoStart(argv, m, as), rss: 6400, threads: 3 }),
});

// ── daemons systemd starts ──

const daemonCmd = (name: string, whatis: string, desc: string): ShellCommand => ({
  ...cmdDoc({ name, section: 8, summary: bi(`служба ${name}`, `the ${name} daemon`), whatis, synopsis: [`${name} [options]`], description: desc, seeAlso: 'systemctl(1), journalctl(1)' }),
  run(ctx) {
    if (name === 'nginx' && (ctx.argv.includes('-t') || ctx.argv.includes('-T'))) {
      let conf = '';
      try {
        conf = ctx.fs.readFile('/etc/nginx/nginx.conf');
      } catch {
        ctx.err('nginx: [emerg] open() "/etc/nginx/nginx.conf" failed (2: No such file or directory)\nnginx: configuration file /etc/nginx/nginx.conf test failed\n');
        return 1;
      }
      const bad = nginxConfError(conf);
      if (bad) {
        ctx.err(`nginx: [emerg] ${bad} in /etc/nginx/nginx.conf\nnginx: configuration file /etc/nginx/nginx.conf test failed\n`);
        return 1;
      }
      ctx.err('nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful\n');
      return 0;
    }
    if (name === 'nginx' && ctx.argv.includes('-v')) {
      ctx.err('nginx version: nginx/1.26.3\n');
      return 0;
    }
    if (name === 'sshd' && ctx.argv.includes('-t')) return 0;
    ctx.err(`${name}: this is a daemon; start it with systemctl start (it runs in the background, managed by systemd)\n`);
    return 1;
  },
});

function nginxConfError(conf: string): string | null {
  let depth = 0;
  for (const c of conf) {
    if (c === '{') depth++;
    if (c === '}') depth--;
    if (depth < 0) return 'unexpected "}"';
  }
  if (depth > 0) return 'unexpected end of file, expecting "}"';
  const bad = /^\s*(listen|server_name|root)\s+[^;{}\n]+$/m.exec(conf);
  if (bad) return `directive "${bad[1]}" is not terminated by ";"`;
  return null;
}

registerProgram('cron', { daemon: () => ({ ok: true, logs: ['(CRON) INFO (pidfile fd = 3)', '(CRON) INFO (Running @reboot jobs)'], rss: 2700 }) });
registerProgram('sshd', { daemon: () => ({ ok: true, logs: ['Server listening on 0.0.0.0 port 22.', 'Server listening on :: port 22.'], listen: [22], rss: 8200, ignores: ['HUP'] }) });
registerProgram('systemd-journald', { daemon: () => ({ ok: true, logs: [], rss: 9800 }) });
registerProgram('nginx', {
  daemon: (_argv, m) => {
    let conf = '';
    try {
      conf = m.vfs.readFileAs('/etc/nginx/nginx.conf', ROOT_CRED);
    } catch {
      return { ok: false, logs: ['nginx: [emerg] open() "/etc/nginx/nginx.conf" failed (2: No such file or directory)'], exit: 1 };
    }
    const bad = nginxConfError(conf);
    if (bad) return { ok: false, logs: [`nginx: [emerg] ${bad} in /etc/nginx/nginx.conf`], exit: 1 };
    const port = Number(/listen\s+(\d+)/.exec(conf)?.[1] ?? 80);
    if (listening(m).some((l) => l.port === port)) return { ok: false, logs: [`nginx: [emerg] bind() to 0.0.0.0:${port} failed (98: Address already in use)`], exit: 1 };
    try {
      m.vfs.writeFileAs('/run/nginx.pid', `${m.procs.next}\n`, ROOT_CRED);
    } catch {
      /* no /run */
    }
    return { ok: true, logs: [], listen: [port], rss: 2100, ignores: ['HUP'], children: [{ cmd: 'nginx', argv: ['nginx: worker process'], uid: 33 }, { cmd: 'nginx', argv: ['nginx: worker process'], uid: 33 }] };
  },
});

export const PROC_COMMANDS: ShellCommand[] = [
  ps,
  pstree,
  top,
  kill,
  pgrep,
  pkill,
  killall,
  nohup,
  nice,
  yes,
  memhog,
  leaky,
  threadsDemo,
  burner,
  spawner,
  sigdemo,
  webDemo,
  daemonCmd('cron', 'daemon to execute scheduled commands', 'cron is started by systemd (cron.service). It wakes up every minute, examines all stored crontabs and runs the commands that are due.'),
  daemonCmd('sshd', 'OpenSSH daemon', 'sshd (OpenSSH Daemon) is the daemon program for ssh(1). It listens for connections from clients on port 22. sshd -t checks the configuration file and exits.'),
  daemonCmd('nginx', 'HTTP and reverse proxy server', 'nginx is an HTTP and reverse proxy server. It is started by systemd (nginx.service): a master process as root and worker processes as www-data. nginx -t tests the configuration file; kill -HUP of the master reloads it.'),
];

export { topText };
