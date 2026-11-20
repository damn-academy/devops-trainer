// What the kernel isolates and limits, as commands: unshare, nsenter, lsns,
// chroot, capsh, getpcaps, getcap, setcap, busybox. Semantics follow
// namespaces(7), pid_namespaces(7), user_namespaces(7), chroot(2),
// capabilities(7) and util-linux 2.41 / libcap 2.75.

import { bi } from '../../../core/i18n';
import type { CmdContext, ShellCommand } from '../../../core/types';
import { CAPS, CAP_FULL, HOST_NS, NS_TYPES, capBit, capHex, capMask, capNames, hasCapHex, type KProc, type NsType } from '../kernel';
import { ForkError, type SimMachine } from '../shell';
import { ROOT_CRED, normalize } from '../vfs';
import { cmdDoc } from './util';

const M = (ctx: CmdContext) => ctx.machine as unknown as SimMachine;
const me = (ctx: CmdContext) => {
  const m = M(ctx);
  return (m.procs.get((ctx as CmdContext & { pid?: number }).pid ?? 0) as KProc | undefined) ?? m.shellProc();
};
const can = (ctx: CmdContext, cap: Parameters<typeof hasCapHex>[1]) => ctx.user.uid === 0 && hasCapHex(me(ctx).capEff, cap);

const FLAG_NS: Record<string, NsType> = { u: 'uts', p: 'pid', m: 'mnt', n: 'net', i: 'ipc', U: 'user', C: 'cgroup', T: 'time' };
const LONG_NS: Record<string, NsType> = { uts: 'uts', pid: 'pid', mount: 'mnt', net: 'net', ipc: 'ipc', user: 'user', cgroup: 'cgroup', time: 'time' };

const isShell = (a: string | undefined) => !a || /(^|\/)(ba)?sh$/.test(a);

const unshare: ShellCommand = {
  ...cmdDoc({
    name: 'unshare',
    summary: bi('запустить программу в новых пространствах имён', 'run a program in new namespaces'),
    whatis: 'run program in new namespaces',
    synopsis: ['unshare [options] [program [arguments]]'],
    description:
      'The unshare command creates new namespaces (as specified by the command-line options described below) and then executes the specified program. If program is not given, then "${SHELL}" is run (default: /bin/sh).\nA namespace changes what a process sees: its own host name (uts), its own numbering of processes (pid), its own mount table (mount), its own network stack (net), its own users (user). Creating namespaces other than user needs root (CAP_SYS_ADMIN).',
    options: [
      ['-u, --uts', 'Create a new UTS namespace: the host name and domain name.'],
      ['-p, --pid', 'Create a new PID namespace. The children of unshare (not unshare itself) are in it: use --fork.'],
      ['-f, --fork', 'Fork the specified program as a child process of unshare rather than running it directly. This is useful when creating a new PID namespace.'],
      ['--mount-proc[=mountpoint]', 'Just before running the program, mount the proc filesystem at mountpoint (default is /proc). This is useful when creating a new PID namespace. It also implies creating a new mount namespace.'],
      ['-m, --mount', 'Create a new mount namespace.'],
      ['-n, --net', 'Create a new network namespace.'],
      ['-i, --ipc', 'Create a new IPC namespace.'],
      ['-U, --user', 'Create a new user namespace.'],
      ['-r, --map-root-user', 'Run the program only after the current effective user and group IDs have been mapped to the superuser UID and GID in the newly created user namespace.'],
      ['-C, --cgroup', 'Create a new cgroup namespace.'],
      ['-T, --time', 'Create a new time namespace.'],
    ],
    examples: [
      ['sudo unshare --uts bash', 'A shell with its own host name: hostname inside changes nothing outside.'],
      ['sudo unshare --pid --fork --mount-proc bash', 'A shell that is PID 1 of its own process tree; ps sees only it.'],
      ['unshare --user --map-root-user bash', 'Root inside the namespace, an ordinary user outside.'],
    ],
    seeAlso: 'clone(2), unshare(2), namespaces(7), nsenter(1), lsns(8)',
  }),
  async run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1);
    const want = new Set<NsType>();
    let fork = false;
    let mountProc = false;
    let mapRoot = false;
    let i = 0;
    for (; i < args.length; i++) {
      const a = args[i];
      if (a === '--') {
        i++;
        break;
      }
      if (!a.startsWith('-')) break;
      if (a.startsWith('--')) {
        const n = a.slice(2).split('=')[0];
        if (LONG_NS[n]) want.add(LONG_NS[n]);
        else if (n === 'fork') fork = true;
        else if (n === 'mount-proc') {
          mountProc = true;
          want.add('mnt');
        } else if (n === 'map-root-user') {
          mapRoot = true;
          want.add('user');
        } else {
          ctx.err(`unshare: unrecognized option '${a}'\nTry 'unshare --help' for more information.\n`);
          return 1;
        }
        continue;
      }
      for (const c of a.slice(1)) {
        if (FLAG_NS[c]) want.add(FLAG_NS[c]);
        else if (c === 'f') fork = true;
        else if (c === 'r') {
          mapRoot = true;
          want.add('user');
        } else {
          ctx.err(`unshare: invalid option -- '${c}'\nTry 'unshare --help' for more information.\n`);
          return 1;
        }
      }
    }
    const prog = args.slice(i);
    const userNs = want.has('user');
    if (!userNs && !can(ctx, 'sys_admin')) {
      ctx.err('unshare: unshare failed: Operation not permitted\n');
      return 1;
    }
    const parent = m.shellProc();
    const ns: Partial<Record<NsType, number>> = {};
    let pidChild: number | undefined;
    for (const t of NS_TYPES) {
      if (!want.has(t)) continue;
      const from = m.kernel.ns.get(parent.ns[t]);
      const rec = m.kernel.newNs(t, from, t === 'uts' ? { hostname: m.utsHostname() } : t === 'user' && mapRoot ? { uidMap: [0, ctx.user.uid, 1] } : {});
      if (t === 'pid') pidChild = rec.id;
      else ns[t] = rec.id;
    }
    if (pidChild !== undefined && fork) ns.pid = pidChild;
    if (mountProc && ns.mnt) {
      const mnt = m.kernel.ns.get(ns.mnt)!;
      mnt.procPidNs = pidChild ?? parent.ns.pid;
      m.kernel.mounts.push({ id: m.kernel.nextMount++, source: 'proc', target: '/proc', fstype: 'proc', options: 'rw,nosuid,nodev,noexec,relatime', ns: ns.mnt, applied: true });
    }
    let capEff = me(ctx).capEff;
    if (userNs) capEff = capHex(CAP_FULL);
    if (isShell(prog[0])) {
      try {
        m.pushShell({ ns, pidChildNs: pidChild !== undefined && !fork ? pidChild : undefined, capEff, user: ctx.user.name, label: 'bash' });
      } catch (e) {
        if (e instanceof ForkError) {
          ctx.err(`unshare: ${e.message}\n`);
          return 1;
        }
        throw e;
      }
      return 0;
    }
    // A single program in the new namespaces: start a session for it, run it, leave.
    try {
      m.pushShell({ ns, pidChildNs: pidChild !== undefined && !fork ? pidChild : undefined, capEff, user: ctx.user.name, label: prog[0].split('/').pop() });
    } catch (e) {
      if (e instanceof ForkError) {
        ctx.err(`unshare: ${e.message}\n`);
        return 1;
      }
      throw e;
    }
    const r = await ctx.shell.run(prog.map((a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`)).join(' '));
    ctx.out(r.out);
    ctx.err(r.err);
    m.popShell(r.exit);
    return r.exit;
  },
};

const nsenter: ShellCommand = {
  ...cmdDoc({
    name: 'nsenter',
    summary: bi('войти в пространства имён другого процесса', 'run a program in the namespaces of another process'),
    whatis: 'run program in different namespaces',
    synopsis: ['nsenter [options] [program [arguments]]'],
    description: 'The nsenter command executes program in the namespace(s) that are specified in the command-line options. If program is not given, then "${SHELL}" is run. The namespaces are those of the process given with --target.',
    options: [
      ['-t, --target PID', 'Specify a target process to get contexts from.'],
      ['-a, --all', 'Enter all namespaces of the target process.'],
      ['-u, --uts', 'Enter the UTS namespace.'],
      ['-p, --pid', 'Enter the PID namespace.'],
      ['-m, --mount', 'Enter the mount namespace.'],
      ['-n, --net', 'Enter the network namespace.'],
      ['-i, --ipc', 'Enter the IPC namespace.'],
      ['-U, --user', 'Enter the user namespace.'],
    ],
    seeAlso: 'setns(2), namespaces(7), unshare(1), lsns(8)',
  }),
  async run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1);
    let target: number | undefined;
    const want = new Set<NsType>();
    let i = 0;
    for (; i < args.length; i++) {
      const a = args[i];
      if (a === '-t' || a === '--target') target = Number(args[++i]);
      else if (/^-t\d+$/.test(a)) target = Number(a.slice(2));
      else if (a.startsWith('--target=')) target = Number(a.slice(9));
      else if (a === '-a' || a === '--all') NS_TYPES.forEach((t) => want.add(t));
      else if (a.startsWith('--') && LONG_NS[a.slice(2)]) want.add(LONG_NS[a.slice(2)]);
      else if (/^-[upmniUCT]+$/.test(a)) for (const c of a.slice(1)) want.add(FLAG_NS[c]);
      else if (a === '--') {
        i++;
        break;
      } else break;
    }
    if (target === undefined) {
      ctx.err('nsenter: neither filename nor target pid supplied for ns/' + ([...want][0] ?? 'mnt') + '\n');
      return 1;
    }
    if (!can(ctx, 'sys_admin')) {
      ctx.err('nsenter: reassociate to namespace \'ns/' + ([...want][0] ?? 'mnt') + "' failed: Operation not permitted\n");
      return 1;
    }
    const t = m.pidByView(target);
    if (!t) {
      ctx.err(`nsenter: cannot open /proc/${target}/ns/${[...want][0] ?? 'mnt'}: No such file or directory\n`);
      return 1;
    }
    const ns: Partial<Record<NsType, number>> = {};
    for (const k of want) ns[k] = t.ns[k];
    const prog = args.slice(i);
    m.pushShell({ ns, user: 'root', label: 'bash', root: want.has('mnt') ? t.root : undefined });
    if (isShell(prog[0])) return 0;
    const r = await ctx.shell.run(prog.join(' '));
    ctx.out(r.out);
    ctx.err(r.err);
    m.popShell(r.exit);
    return r.exit;
  },
};

const lsns: ShellCommand = {
  ...cmdDoc({
    name: 'lsns',
    section: 8,
    summary: bi('показать пространства имён', 'list namespaces'),
    whatis: 'list namespaces',
    synopsis: ['lsns [options] [namespace]'],
    description: 'lsns lists information about all the currently accessible namespaces or about the given namespace. The namespace identifier is an inode number. NPROCS is the number of processes in it, PID the lowest one, COMMAND its command line.\nAn ordinary user sees only the namespaces of their own processes.',
    options: [['-t, --type type', 'Display the specified type of namespaces only: mnt, net, ipc, user, pid, uts, cgroup, time.'], ['-p, --task pid', 'Display only the namespaces held by the process with this pid.']],
    seeAlso: 'nsenter(1), unshare(1), namespaces(7)',
  }),
  run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1);
    const ti = args.findIndex((a) => a === '-t' || a === '--type');
    const type = ti >= 0 ? args[ti + 1] : undefined;
    const pi = args.findIndex((a) => a === '-p' || a === '--task');
    const pid = pi >= 0 ? Number(args[pi + 1]) : undefined;
    const procs = (m.procs.list() as KProc[]).filter((p) => ctx.user.uid === 0 || p.uid === ctx.user.uid);
    const rows: string[] = [];
    const target = pid !== undefined ? m.pidByView(pid) : undefined;
    for (const n of [...m.kernel.ns.values()].sort((a, b) => a.id - b.id)) {
      if (type && n.type !== (type === 'mount' ? 'mnt' : type)) continue;
      if (target && target.ns[n.type] !== n.id) continue;
      const inNs = procs.filter((p) => p.ns[n.type] === n.id);
      if (!inNs.length) continue;
      const first = inNs.sort((a, b) => a.pid - b.pid)[0];
      rows.push(`${String(n.id).padStart(10)} ${n.type.padEnd(6)} ${String(inNs.length).padStart(6)} ${String(m.viewPid(first) ?? first.pid).padStart(5)} ${m.userName_(first.uid).padEnd(7)} ${first.argv.join(' ')}`);
    }
    ctx.out('        NS TYPE   NPROCS   PID USER    COMMAND\n' + rows.join('\n') + (rows.length ? '\n' : ''));
    return 0;
  },
};

const chroot: ShellCommand = {
  ...cmdDoc({
    name: 'chroot',
    section: 8,
    summary: bi('запустить программу с другим корнем файлов', 'run a program with a different root directory'),
    whatis: 'run command or interactive shell with special root directory',
    synopsis: ['chroot [OPTION] NEWROOT [COMMAND [ARG]...]'],
    description:
      'Run COMMAND with root directory set to NEWROOT. If no command is given, run "$SHELL -i" (default: /bin/sh -i).\nOnly the view of files changes: processes, the network and the host name stay shared, and root inside can get out again. The command must exist inside NEWROOT, with its libraries: a directory with busybox is the simplest root.',
    seeAlso: 'chroot(2), pivot_root(2), namespaces(7)',
    url: 'https://man7.org/linux/man-pages/man8/chroot.8.html',
  }),
  async run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1).filter((a) => !a.startsWith('--'));
    const dir = args[0];
    if (!dir) {
      ctx.err("chroot: missing operand\nTry 'chroot --help' for more information.\n");
      return 125;
    }
    if (!can(ctx, 'sys_chroot')) {
      ctx.err(`chroot: cannot change root directory to '${dir}': Operation not permitted\n`);
      return 125;
    }
    const cur = m.shellProc().root;
    const abs = normalize(cur === '/' ? ctx.fs.resolve(dir) : cur + ctx.fs.resolve(dir));
    const st = m.vfs.statAs(abs, ROOT_CRED);
    if (!st || st.type !== 'd') {
      ctx.err(`chroot: cannot change root directory to '${dir}': ${st ? 'Not a directory' : 'No such file or directory'}\n`);
      return 125;
    }
    const prog = args.slice(1).length ? args.slice(1) : ['/bin/sh', '-i'];
    const inner = prog[0].startsWith('/') ? prog[0] : `/usr/bin/${prog[0]}`;
    const found = [inner, `/bin/${prog[0]}`, `/usr/sbin/${prog[0]}`].find((p) => m.vfs.statAs(normalize(abs + p), ROOT_CRED));
    if (!found) {
      ctx.err(`chroot: failed to run command '${prog[0]}': No such file or directory\n`);
      return 127;
    }
    if (isShell(prog[0]) && (prog.length === 1 || prog[1] === '-i')) {
      m.pushShell({ user: ctx.user.name, capEff: me(ctx).capEff, root: abs, cwd: '/', label: prog[0].split('/').pop(), env: { PATH: '/bin:/sbin:/usr/bin:/usr/sbin', HOME: '/' } });
      return 0;
    }
    return m.runArgv(ctx, [found, ...prog.slice(1)], { user: ctx.user, capEff: me(ctx).capEff }, { root: abs, cwd: '/', env: { PATH: '/bin:/sbin:/usr/bin:/usr/sbin' } });
  },
};

function capText(mask: bigint): string {
  if (mask === CAP_FULL) return '=ep';
  if (mask === 0n) return '=';
  return capNames(mask).join(',') + '=ep';
}

const capsh: ShellCommand = {
  ...cmdDoc({
    name: 'capsh',
    summary: bi('показать или урезать привилегии процесса', 'show or reduce the capabilities of a process'),
    whatis: 'capability shell wrapper',
    synopsis: ['capsh [OPTION]...'],
    description: 'Linux capability support and use can be explored and constrained with this tool. root is not one permission but about forty separate capabilities (capabilities(7)); capsh --print shows them, capsh --drop=cap_x -- -c "command" runs a shell command without them.',
    options: [
      ['--print', 'Display prevailing capability and related state.'],
      ['--drop=cap-list', 'Remove the listed capabilities from the prevailing bounding set (and from the effective set of the shell that follows). Requires CAP_SETPCAP.'],
      ['--decode=N', 'Translate the hexadecimal capability mask N (as in /proc/PID/status CapEff:) into names.'],
      ['-- [args]', 'Execute /bin/bash with trailing arguments: capsh --drop=cap_chown -- -c "chown nobody f".'],
    ],
    seeAlso: 'capabilities(7), getpcaps(8), setcap(8)',
    url: 'https://man7.org/linux/man-pages/man1/capsh.1.html',
  }),
  async run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1);
    let mask = capMask(me(ctx).capEff);
    if (ctx.user.uid !== 0) mask = 0n;
    const dd = args.indexOf('--');
    const opts = dd >= 0 ? args.slice(0, dd) : args;
    const rest = dd >= 0 ? args.slice(dd + 1) : null;
    for (const o of opts) {
      if (o.startsWith('--decode=')) {
        const v = BigInt('0x' + o.slice(9).replace(/^0x/, ''));
        ctx.out(`0x${v.toString(16).padStart(16, '0')}=${capNames(v).join(',')}\n`);
        return 0;
      }
      if (o === '--print') {
        ctx.out(`Current: ${capText(mask)}\nBounding set =${capNames(ctx.user.uid === 0 ? mask : CAP_FULL).join(',')}\nAmbient set =\nCurrent IAB: ${mask === CAP_FULL || ctx.user.uid !== 0 ? '' : capNames(CAP_FULL & ~mask).map((c) => `!${c}`).join(',')}\nSecurebits: 00/0x0/1'b0 (no-new-privs=0)\n secure-noroot: no (unlocked)\nuid=${m.displayUid(ctx.user.uid)}(${m.userName_(ctx.user.uid)}) euid=${m.displayUid(ctx.user.uid)}(${m.userName_(ctx.user.uid)})\ngid=${ctx.user.gid}(${m.groupName_(ctx.user.gid)})\n`);
        continue;
      }
      if (o.startsWith('--drop=')) {
        if (!hasCapHex(me(ctx).capEff, 'setpcap') || ctx.user.uid !== 0) {
          ctx.err('unable to raise CAP_SETPCAP for BSET changes: Operation not permitted\n');
          return 1;
        }
        for (const n of o.slice(7).split(',')) {
          const b = capBit(n);
          if (b === null) {
            ctx.err(`unknown capability "${n}"\n`);
            return 1;
          }
          mask &= ~b;
        }
        continue;
      }
      ctx.err(`capsh: unknown option ${o}\n`);
      return 1;
    }
    if (!rest) return 0;
    if (!rest.length) {
      m.pushShell({ user: ctx.user.name, capEff: capHex(mask), label: 'bash' });
      return 0;
    }
    const line = rest[0] === '-c' ? (rest[1] ?? '') : rest.join(' ');
    return m.runLineAs(line, { user: ctx.user, capEff: capHex(mask) }, { out: ctx.out, err: ctx.err, cwd: ctx.cwd, ppid: me(ctx).pid });
  },
};

const getpcaps: ShellCommand = {
  ...cmdDoc({ name: 'getpcaps', section: 8, summary: bi('привилегии процесса по номеру', 'show the capabilities of a process'), whatis: 'list process capabilities', synopsis: ['getpcaps pid...'], description: 'getpcaps displays the capabilities on the processes indicated by the pid value(s) given on the command line.', seeAlso: 'capsh(1), capabilities(7)' }),
  run(ctx) {
    const m = M(ctx);
    let exit = 0;
    for (const a of ctx.argv.slice(1)) {
      const p = m.pidByView(Number(a));
      if (!p) {
        ctx.err(`Failed to get cap for pid ${a}: (No such process)\n`);
        exit = 1;
        continue;
      }
      ctx.out(`${a}: ${capText(capMask(p.capEff))}\n`);
    }
    return exit;
  },
};

const getcap: ShellCommand = {
  ...cmdDoc({
    name: 'getcap',
    section: 8,
    summary: bi('показать привилегии файла программы', 'show the file capabilities of a program'),
    whatis: 'examine file capabilities',
    synopsis: ['getcap [-r] filename [ ... ]'],
    description: 'getcap displays the name and capabilities of each specified file. A file capability (set with setcap) is given to the process when the program starts, without making the whole program setuid root.',
    options: [['-r', 'enables recursive search.']],
    seeAlso: 'setcap(8), capabilities(7)',
  }),
  run(ctx) {
    const m = M(ctx);
    const rec = ctx.argv.includes('-r');
    const paths = ctx.argv.slice(1).filter((a) => !a.startsWith('-'));
    const show = (p: string) => {
      const ino = m.vfs.inoOf(ctx.fs.resolve(p));
      const c = ino !== undefined ? m.kernel.fileCaps.get(ino) : undefined;
      if (c) ctx.out(`${p} ${c}\n`);
    };
    for (const p of paths) {
      if (rec && ctx.fs.stat(p)?.type === 'd') {
        const root = m.vfs.inoOf(ctx.fs.resolve(p));
        if (root !== undefined) for (const e of m.vfs.listFrom(root)) if (e.stat.type === 'f') show(`${p.replace(/\/$/, '')}/${e.rel}`);
      } else show(p);
    }
    return 0;
  },
};

const setcap: ShellCommand = {
  ...cmdDoc({
    name: 'setcap',
    section: 8,
    summary: bi('дать программе отдельную привилегию', 'give a program a single capability'),
    whatis: 'set file capabilities',
    synopsis: ['setcap [-q] [-n <rootuid>] [-v] {capabilities|-|-r} filename [ ... ]'],
    description: 'setcap sets the capabilities of each specified filename to the capabilities specified. The capabilities are in the form cap_name=flags, where flags are e (effective), i (inheritable), p (permitted): cap_net_bind_service=+ep lets the program listen on ports below 1024 without root.\n-r removes them. Requires CAP_SETFCAP. Copying the file (cp) loses the capability; it belongs to that inode.',
    options: [['-r', 'Remove the capability set from the file.'], ['-v', 'Verify that the specified capabilities are currently associated with the file.']],
    seeAlso: 'getcap(8), capabilities(7)',
  }),
  run(ctx) {
    const m = M(ctx);
    const args = ctx.argv.slice(1).filter((a) => a !== '-q');
    if (args.length < 2) {
      ctx.err('usage: setcap [-h] [-q] [-v] [-n <rootid>] (-r|-|<caps>) <filename> [ ... (-r|-|<capsN>) <filenameN> ]\n');
      return 1;
    }
    if (!can(ctx, 'setfcap')) {
      ctx.err('unable to set CAP_SETFCAP effective capability: Operation not permitted\n');
      return 1;
    }
    const [spec, file] = args;
    const ino = m.vfs.inoOf(ctx.fs.resolve(file));
    const st = ctx.fs.stat(file);
    if (ino === undefined || !st) {
      ctx.err(`Failed to set capabilities on file '${file}': No such file or directory\n`);
      return 1;
    }
    if (st.type !== 'f') {
      ctx.err(`Failed to set capabilities on file '${file}': Operation not supported\n`);
      return 1;
    }
    if (spec === '-r') {
      m.kernel.fileCaps.delete(ino);
      return 0;
    }
    const mm = /^((?:cap_[a-z_]+,?)+)[=+]([eip+=]+)$/i.exec(spec.replace('=+', '+'));
    if (!mm || mm[1].split(',').filter(Boolean).some((c) => capBit(c) === null)) {
      ctx.err(`fatal error: Invalid argument\nusage: setcap [-h] [-q] [-v] [-n <rootid>] (-r|-|<caps>) <filename>\n\nNote <filename> must be a regular (non-symlink) file.\n`);
      return 1;
    }
    m.kernel.fileCaps.set(ino, `${mm[1].replace(/,$/, '').toLowerCase()}=${mm[2].replace(/[+=]/g, '').split('').sort().join('')}`);
    return 0;
  },
};

const busybox: ShellCommand = {
  ...cmdDoc({
    name: 'busybox',
    summary: bi('много маленьких программ в одном файле', 'many small programs in one file'),
    whatis: 'The Swiss Army Knife of Embedded Linux',
    synopsis: ['busybox <applet> [arguments...]', '<applet> [arguments...]  (via a link named after the applet)'],
    description: 'BusyBox combines tiny versions of many common UNIX utilities into a single small executable. The program decides what to be by the name it was started with: a symbolic link sh -> busybox runs the shell, ls -> busybox runs ls. That is why a directory with busybox and its links is enough to be a root for chroot.',
    seeAlso: 'chroot(8)',
    url: 'https://busybox.net/downloads/BusyBox.html',
  }),
  async run(ctx) {
    const m = M(ctx);
    let argv = ctx.argv;
    const self = argv[0].split('/').pop();
    if (self === 'busybox') argv = argv.slice(1);
    const applet = argv[0]?.split('/').pop();
    if (!applet || applet === '--list') {
      ctx.out('BusyBox v1.37.0 (Debian 1:1.37.0-6) multi-call binary.\n\nCurrently defined functions:\n\tcat, chmod, cp, echo, hostname, id, ls, mkdir, mount, ps, pwd, rm, sh, sleep, touch, umount\n');
      return 0;
    }
    if (applet === 'sh' || applet === 'ash') {
      if (argv[1] === '-c') {
        const r = await ctx.shell.run(argv[2] ?? '');
        ctx.out(r.out);
        ctx.err(r.err);
        return r.exit;
      }
      m.pushShell({ label: 'sh' });
      return 0;
    }
    const cmd = m.lookup(applet);
    if (!cmd || applet === 'busybox') {
      ctx.err(`${applet}: applet not found\n`);
      return 127;
    }
    return cmd.run({ ...ctx, argv });
  },
};

export const KERNEL_COMMANDS: ShellCommand[] = [unshare, nsenter, lsns, chroot, capsh, getpcaps, getcap, setcap, busybox];

export { CAPS, HOST_NS };
