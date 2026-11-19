// A shell inside a container (04 §11.1: "the shell inside `docker exec -it …
// sh` is the Стенд with the container's FS"). Each container command runs on
// a SimMachine whose file system is the container view, whose commands are
// only the binaries the image has, whose process table is the container's
// pid namespace and whose hostname is the container's. After the command the
// change set goes back into the upper layer, volumes and bind mounts.

import { bi } from '../../core/i18n';
import type { CmdContext, ExecResult, FsApi, ShellCommand, SimMachineApi, TerminalSession, UserAccount } from '../../core/types';
import { createTerminalRegistry, terminalRegistry } from '../terminal/registry';
import { SimMachine } from '../terminal/shell';
import { ROOT_CRED } from '../terminal/vfs';
import { FAMILY_BINS } from './catalog';
import { diff, type LayerEntry, type LayerFiles } from './layers';
import { commitChanges, containerView } from './rootfs';
import type { ContainerRec, DockerSnapshot } from './state';
import { shellQuote } from './util';

/** What the network commands inside a container need to know about where they run. */
export interface ContainerCtx {
  host: SimMachineApi;
  st: DockerSnapshot;
  containerId: string;
}

/** Hooks other dsim files register (HTTP, DNS) so this file does not import the engine. */
export const containerHooks: {
  fetch?: (from: ContainerCtx, url: string) => { status: number; body: string; error?: string };
  resolve?: (from: ContainerCtx, name: string) => string | null;
} = {};

export function familyOf(files: LayerFiles): 'alpine' | 'busybox' | 'debian' | 'scratch' {
  const os = files['/etc/os-release']?.text ?? '';
  if (/alpine/i.test(os)) return 'alpine';
  if (/debian/i.test(os)) return 'debian';
  if (files['/bin/busybox']) return 'busybox';
  return 'scratch';
}

/** Does a program name exist in the container's PATH (or as an absolute path)? */
export function findExecutable(files: LayerFiles, name: string, env: Record<string, string>): string | null {
  const exists = (p: string) => {
    const e = resolveLink(files, p);
    return e && e.t === 'f' ? p : null;
  };
  if (name.includes('/')) return exists(name.startsWith('/') ? name : `/${name}`);
  const path = (env.PATH ?? '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin').split(':');
  for (const d of path) {
    const hit = exists(`${d}/${name}`);
    if (hit) return hit;
  }
  return null;
}

function resolveLink(files: LayerFiles, p: string, depth = 0): LayerEntry | undefined {
  const e = files[p];
  if (!e || e.t !== 'l' || depth > 8) return e;
  const t = e.target ?? '';
  const next = t.startsWith('/') ? t : `${p.slice(0, p.lastIndexOf('/')) || ''}/${t}`;
  return resolveLink(files, next.replace(/\/+/g, '/'), depth + 1);
}

function parsePasswd(text: string): UserAccount[] {
  return text
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split(':'))
    .filter((f) => f.length >= 7)
    .map((f) => ({ name: f[0], uid: Number(f[2]), gid: Number(f[3]), home: f[5] || '/', shell: f[6] || '/bin/sh', groups: [Number(f[3])] }));
}

/** The container's environment: image Env, then -e, plus HOSTNAME and HOME as Docker sets them. */
export function containerEnv(c: ContainerRec, user?: UserAccount): Record<string, string> {
  const env: Record<string, string> = { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' };
  for (const kv of c.config.Env ?? []) {
    const i = kv.indexOf('=');
    if (i > 0) env[kv.slice(0, i)] = kv.slice(i + 1);
  }
  env.HOSTNAME = c.config.Hostname;
  env.HOME = user?.home ?? '/root';
  if (c.config.Tty) env.TERM = 'xterm';
  return env;
}

export interface OpenedContainer {
  cm: SimMachine;
  family: ReturnType<typeof familyOf>;
  /** Write the changes made since the last commit back into the container. */
  commit(): void;
}

/** Build the container's machine. `user` is "uid[:gid]" or a name, as `-u` takes. */
export async function openContainer(ctx: ContainerCtx, c: ContainerRec, opts: { user?: string; workdir?: string; extraEnv?: Record<string, string> } = {}): Promise<OpenedContainer> {
  const hostFs = ctx.host.rootFs;
  const view = containerView(ctx.st, c, hostFs);
  const family = familyOf(view.files);
  const bins = new Set(FAMILY_BINS[family]);
  for (const p of Object.keys(view.files)) if (/^\/(usr\/)?(local\/)?s?bin\//.test(p)) bins.add(p.slice(p.lastIndexOf('/') + 1));
  const reg = createTerminalRegistry();
  for (const cmd of commandsFor(family, bins)) reg.commands.add(cmd);
  const cm = new SimMachine({ id: `ctr-${c.id.slice(0, 12)}`, hostname: c.config.Hostname, registry: reg });
  cm.ext<ContainerCtx>('dsim.ctx', () => ctx);
  const fs = cm.rootFs;
  // Clear what the simulated machine boots with: the container has only its image.
  for (const top of fs.readdir('/')) if (!['dev', 'proc', 'sys'].includes(top)) removeTree(fs, `/${top}`);
  // Binaries become program stubs the simulated shell can run (`#!/usr/bin/sim`); busybox applets are symlinks to one stub.
  const files = withStubs(view.files);
  const paths = Object.keys(files).sort();
  for (const p of paths) {
    const e = files[p];
    try {
      if (e.t === 'd') {
        if (!fs.exists(p)) fs.mkdir(p, { parents: true });
        fs.chmod(p, e.mode);
        fs.chown(p, e.uid, e.gid);
      } else if (e.t === 'l') {
        if (!fs.lstat(p)) fs.symlink(e.target ?? '', p);
      } else if (e.t === 'f') {
        fs.writeFile(p, e.text ?? '');
        fs.chmod(p, e.mode);
        fs.chown(p, e.uid, e.gid);
      }
    } catch {
      /* /dev, /proc entries of the image: the machine has its own */
    }
  }
  // Users from the image's /etc/passwd; `-u 1001` without an entry is a nameless uid.
  const users = parsePasswd(view.files['/etc/passwd']?.text ?? 'root:x:0:0:root:/root:/bin/sh\n');
  cm.users = users.length ? users : [{ name: 'root', uid: 0, gid: 0, home: '/root', shell: '/bin/sh', groups: [0] }];
  cm.groups = (view.files['/etc/group']?.text ?? 'root:x:0:\n')
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split(':'))
    .map((f) => ({ name: f[0], gid: Number(f[2]) }));
  const userSpec = opts.user || c.hostConfig.user || c.config.User || 'root';
  const account = accountFor(cm, userSpec);
  cm.switchUser(account.name);
  // The pid namespace of the container: its own numbering, PID 1 is the main process.
  // Keep only the shell this machine runs commands in (it becomes the exec'd `sh`), then add the container's processes.
  const shellProc = cm.procs
    .list()
    .filter((p) => p.cmd === 'bash')
    .sort((a, b) => b.pid - a.pid)[0];
  cm.procs.restore({ next: 1, procs: shellProc ? [{ ...shellProc, cmd: 'sh', argv: ['sh'], ppid: 0 } as never] : [] });
  for (const p of c.procs) cm.procs.spawn({ pid: p.nspid, ppid: p.ppid, uid: 0, state: p.state, cmd: p.comm, argv: p.argv });
  // Environment as the container has it (exported), and the working directory.
  const env = { ...containerEnv(c, account), ...(opts.extraEnv ?? {}) };
  for (const k of ['USER', 'LOGNAME', 'SHELL', 'LANG', 'TERM', 'HOSTNAME']) if (!(k in env)) await cm.exec(`unset ${k}`);
  for (const [k, v] of Object.entries(env)) await cm.exec(`export ${k}=${shellQuote(v)}`);
  const wd = opts.workdir || c.config.WorkingDir || '/';
  await cm.exec(`cd ${shellQuote(wd)} 2>/dev/null || cd /`);
  let baseline = snapshotFiles(cm);
  return {
    cm,
    family,
    commit() {
      const now = snapshotFiles(cm);
      const change = diff(baseline, now);
      const weights = cm.ext<Map<string, number>>('dsim.weights', () => new Map());
      for (const [p, e] of Object.entries(change)) if (e.t === 'f' && weights.has(p)) e.size = weights.get(p)!;
      for (const p of Object.keys(change)) if (/^\/(proc|sys|dev)(\/|$)/.test(p)) delete change[p];
      // unchanged weights of image files survive: only real changes are committed
      for (const [p, e] of Object.entries(change)) {
        const before = files[p];
        if (before && e.t === 'f' && before.t === 'f' && (before.text ?? '') === (e.text ?? '') && before.mode === e.mode && before.uid === e.uid) delete change[p];
      }
      commitChanges(ctx.st, c, change, hostFs, view.mountOf);
      baseline = now;
    },
  };
}

/** `\x7fELF x86_64 nginx` → a stub named after the file; a foreign architecture gets a stub no command answers to. */
export function withStubs(files: LayerFiles): LayerFiles {
  const out: LayerFiles = {};
  for (const [p, e] of Object.entries(files)) {
    if (e.t === 'f' && e.text?.startsWith('\x7fELF')) {
      const name = p.slice(p.lastIndexOf('/') + 1);
      const foreign = /aarch64|i386/.test(e.text);
      const target = foreign ? 'exec-format-error' : /busybox/.test(e.text) ? 'busybox' : name;
      out[p] = { ...e, text: `#!/usr/bin/sim\n# ${target}: ${e.text.slice(5).trim()}\n` };
    } else out[p] = e;
  }
  return out;
}

function accountFor(cm: SimMachine, spec: string): UserAccount {
  const [u, g] = spec.split(':');
  const byName = cm.users.find((x) => x.name === u);
  if (byName) return byName;
  const uid = Number(u);
  const byUid = cm.users.find((x) => x.uid === uid);
  if (byUid) return byUid;
  const gid = g !== undefined && /^\d+$/.test(g) ? Number(g) : Number.isFinite(uid) ? 0 : 0;
  const acct: UserAccount = { name: Number.isFinite(uid) ? String(uid) : u, uid: Number.isFinite(uid) ? uid : 0, gid, home: '/', shell: '/bin/sh', groups: [gid] };
  cm.users = [...cm.users, acct];
  return acct;
}

function removeTree(fs: FsApi, p: string): void {
  const st = fs.lstat(p);
  if (!st) return;
  if (st.type === 'd') {
    for (const n of fs.readdir(p)) removeTree(fs, `${p}/${n}`);
    fs.rmdir(p);
  } else fs.unlink(p);
}

/** The container file system as layer entries (for diffing before/after a command). */
export function snapshotFiles(cm: SimMachine): LayerFiles {
  const out: LayerFiles = {};
  for (const { path, stat, text } of cm.vfs.list()) {
    if (path === '/' || /^\/(proc|sys|dev)(\/|$)/.test(path)) continue;
    if (stat.type === 'd') out[path] = { t: 'd', mode: stat.mode & 0o7777, uid: stat.uid, gid: stat.gid, size: 0 };
    else if (stat.type === 'l') out[path] = { t: 'l', mode: 0o777, uid: stat.uid, gid: stat.gid, size: 0, target: stat.target };
    else if (stat.type === 'f') out[path] = { t: 'f', mode: stat.mode & 0o7777, uid: stat.uid, gid: stat.gid, size: stat.size, text: text ?? cm.vfs.readFileAs(path, ROOT_CRED) };
  }
  return out;
}

// ── commands inside a container ────────────────────────────────────────────

const ctxOf = (c: CmdContext) => c.machine.ext<ContainerCtx | null>('dsim.ctx', () => null);

const local = (name: string, run: (c: CmdContext) => number | Promise<number>, summary = bi('команда внутри контейнера', 'a command inside a container')): ShellCommand => ({ name, summary, run });

const LOCAL: Record<string, ShellCommand> = {
  ps: local('ps', (c) => {
    c.out('PID   USER     TIME  COMMAND\n');
    for (const p of c.machine.procs.list()) {
      const u = c.machine.users.find((x) => x.uid === p.uid)?.name ?? String(p.uid);
      c.out(`${String(p.pid).padStart(5)} ${u.padEnd(8)}  0:00 ${p.argv.join(' ')}\n`);
    }
    return 0;
  }),
  hostname: local('hostname', (c) => {
    if (c.argv[1]) {
      c.err('hostname: sethostname: Operation not permitted\n');
      return 1;
    }
    c.out(`${c.machine.hostname}\n`);
    return 0;
  }),
  env: local('env', (c) => {
    for (const [k, v] of Object.entries(c.env)) if (k !== 'PWD' || c.env.PWD) c.out(`${k}=${v}\n`);
    return 0;
  }),
  printenv: local('printenv', (c) => {
    const names = c.argv.slice(1);
    if (!names.length) for (const [k, v] of Object.entries(c.env)) c.out(`${k}=${v}\n`);
    let code = 0;
    for (const n of names) {
      if (n in c.env) c.out(`${c.env[n]}\n`);
      else code = 1;
    }
    return code;
  }),
  id: local('id', (c) => {
    const u = c.user;
    const g = c.machine.groups.find((x) => x.gid === u.gid);
    const flag = c.argv[1];
    if (flag === '-u') c.out(`${u.uid}\n`);
    else if (flag === '-g') c.out(`${u.gid}\n`);
    else if (flag === '-un') c.out(`${u.name}\n`);
    else {
      const named = c.machine.users.some((x) => x.uid === u.uid && x.name !== String(u.uid));
      c.out(`uid=${u.uid}${named ? `(${u.name})` : ''} gid=${u.gid}${g ? `(${g.name})` : ''}${u.uid === 0 ? ' groups=0(root)' : ''}\n`);
    }
    return 0;
  }),
  whoami: local('whoami', (c) => {
    const u = c.user;
    if (u.name === String(u.uid) && u.uid !== 0) {
      c.err(`whoami: unknown uid ${u.uid}\n`);
      return 1;
    }
    c.out(`${u.name}\n`);
    return 0;
  }),
  uname: local('uname', (c) => {
    const a = c.argv.slice(1).join('');
    if (a.includes('r')) c.out('6.12.0-dt-sim\n');
    else if (a.includes('m')) c.out('x86_64\n');
    else if (a.includes('a')) c.out(`Linux ${c.machine.hostname} 6.12.0-dt-sim #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux\n`);
    else c.out('Linux\n');
    return 0;
  }),
  sleep: local('sleep', () => 0),
  mount: local('mount', (c) => {
    const x = ctxOf(c);
    const ct = x?.st.containers.find((k) => k.id === x.containerId);
    c.out('overlay on / type overlay (rw,relatime,lowerdir=/var/lib/docker/overlay2/l/…,upperdir=/var/lib/docker/overlay2/…/diff,workdir=/var/lib/docker/overlay2/…/work)\n');
    c.out('proc on /proc type proc (rw,nosuid,nodev,noexec,relatime)\n');
    c.out('tmpfs on /dev type tmpfs (rw,nosuid,size=65536k,mode=755)\n');
    for (const m of ct?.mounts ?? []) {
      const opt = m.ro ? 'ro' : 'rw';
      if (m.type === 'tmpfs') c.out(`tmpfs on ${m.target} type tmpfs (${opt},nosuid,nodev,noexec,relatime)\n`);
      else c.out(`/dev/sda1 on ${m.target} type ext4 (${opt},relatime)\n`);
    }
    return 0;
  }),
  nslookup: local('nslookup', (c) => {
    const x = ctxOf(c);
    const name = c.argv[1];
    if (!name) {
      c.err('Usage: nslookup HOST [DNS_SERVER]\n');
      return 1;
    }
    const ip = x && containerHooks.resolve ? containerHooks.resolve(x, name) : null;
    const ct = x?.st.containers.find((k) => k.id === x.containerId);
    const userNet = ct ? Object.keys(ct.networks).some((n) => !['bridge', 'host', 'none'].includes(n)) : false;
    const server = userNet ? '127.0.0.11' : '192.168.65.7';
    c.out(`Server:\t\t${server}\nAddress:\t${server}:53\n\n`);
    if (!ip) {
      c.err(`** server can't find ${name}: NXDOMAIN\n\n`);
      return 1;
    }
    c.out(`Non-authoritative answer:\nName:\t${name}\nAddress: ${ip}\n\n`);
    return 0;
  }),
  ping: local('ping', (c) => {
    const x = ctxOf(c);
    const target = c.argv.filter((a, i) => i > 0 && !a.startsWith('-') && !/^\d+$/.test(a)).pop();
    if (!target) {
      c.err('BusyBox v1.37.0 multi-call binary.\n\nUsage: ping [OPTIONS] HOST\n');
      return 1;
    }
    const ip = /^\d+\.\d+\.\d+\.\d+$/.test(target) ? target : x && containerHooks.resolve ? containerHooks.resolve(x, target) : null;
    if (!ip) {
      c.err(`ping: bad address '${target}'\n`);
      return 1;
    }
    const res = x && containerHooks.fetch ? containerHooks.fetch(x, `icmp://${ip}`) : { status: 0, body: '' };
    c.out(`PING ${target} (${ip}): 56 data bytes\n`);
    if (res.status !== 200) {
      c.out(`\n--- ${target} ping statistics ---\n1 packets transmitted, 0 packets received, 100% packet loss\n`);
      return 1;
    }
    c.out(`64 bytes from ${ip}: seq=0 ttl=64 time=0.081 ms\n\n--- ${target} ping statistics ---\n1 packets transmitted, 1 packets received, 0% packet loss\nround-trip min/avg/max = 0.081/0.081/0.081 ms\n`);
    return 0;
  }),
  wget: local('wget', (c) => {
    const x = ctxOf(c);
    const args = c.argv.slice(1);
    const quiet = args.some((a) => /^-q/.test(a));
    const toStdout = args.some((a) => a === '-O-' || a === '-qO-') || args.includes('-O') && args[args.indexOf('-O') + 1] === '-';
    const url = args.filter((a) => !a.startsWith('-') && a !== '-').pop();
    if (!url) {
      c.err('BusyBox v1.37.0 multi-call binary.\n\nUsage: wget [-cqS] [-O FILE] URL...\n');
      return 1;
    }
    const full = /^https?:\/\//.test(url) ? url : `http://${url}`;
    const r = x && containerHooks.fetch ? containerHooks.fetch(x, full) : { status: 0, body: '', error: 'network unreachable' };
    if (r.error) {
      c.err(`wget: ${r.error}\n`);
      return 1;
    }
    if (!quiet) c.err(`Connecting to ${new URL(full).host} (${new URL(full).host})\n`);
    if (r.status >= 400) {
      c.err(`wget: server returned error: HTTP/1.1 ${r.status}\n`);
      return 1;
    }
    if (toStdout) c.out(r.body);
    else {
      c.fs.writeFile('index.html', r.body);
      if (!quiet) c.err("saving to 'index.html'\n'index.html' saved\n");
    }
    return 0;
  }),
  kill: local('kill', (c) => {
    const args = c.argv.slice(1);
    const sig = args[0]?.startsWith('-') ? args.shift()!.slice(1) : 'TERM';
    let code = 0;
    for (const a of args) if (!c.machine.procs.kill(Number(a), sig)) {
      c.err(`sh: can't kill pid ${a}: No such process\n`);
      code = 1;
    }
    return code;
  }),
  cp: local('cp', (c) => {
    const ops = c.argv.slice(1).filter((a) => !a.startsWith('-'));
    if (ops.length < 2) {
      c.err('cp: missing destination file operand\n');
      return 1;
    }
    const dst = ops.pop()!;
    for (const src of ops) {
      try {
        const target = c.fs.stat(dst)?.type === 'd' ? `${dst}/${src.slice(src.lastIndexOf('/') + 1)}` : dst;
        c.fs.writeFile(target, c.fs.readFile(src));
      } catch (e) {
        c.err(`cp: can't stat '${src}': ${(e as { text?: string }).text ?? 'error'}\n`);
        return 1;
      }
    }
    return 0;
  }),
  head: local('head', (c) => {
    const n = c.argv.includes('-n') ? Number(c.argv[c.argv.indexOf('-n') + 1]) : 10;
    const f = c.argv.slice(1).filter((a, i, all) => !a.startsWith('-') && all[i - 1] !== '-n')[0];
    const text = f ? c.fs.readFile(f) : c.stdin;
    c.out(text.split('\n').slice(0, n).join('\n') + (text ? '\n' : ''));
    return 0;
  }),
  chmod: local('chmod', (c) => {
    const [mode, ...files] = c.argv.slice(1);
    for (const f of files) c.fs.chmod(f, parseInt(mode, 8));
    return 0;
  }),
  chown: local('chown', (c) => {
    const [spec, ...files] = c.argv.slice(1);
    const [u, g] = spec.split(':');
    const uid = /^\d+$/.test(u) ? Number(u) : c.machine.users.find((x) => x.name === u)?.uid ?? 0;
    const gid = g !== undefined ? (/^\d+$/.test(g) ? Number(g) : c.machine.groups.find((x) => x.name === g)?.gid ?? 0) : uid;
    try {
      for (const f of files) c.fs.chown(f, uid, gid);
    } catch (e) {
      c.err(`chown: ${files[0]}: ${(e as { text?: string }).text ?? 'Operation not permitted'}\n`);
      return 1;
    }
    return 0;
  }),
  date: local('date', (c) => {
    c.out(`${new Date(Date.UTC(2026, 10, 18, 9, 0, 0)).toUTCString().replace('GMT', 'UTC')}\n`);
    return 0;
  }),
  which: local('which', (c) => {
    let code = 0;
    for (const n of c.argv.slice(1)) {
      const cmd = c.machine.lookup(n);
      if (cmd) c.out(`/usr/bin/${n}\n`);
      else code = 1;
    }
    return code;
  }),
};

/** Commands an image of this family has: the core command when it exists, a container version otherwise. */
function commandsFor(family: string, bins: Set<string>): ShellCommand[] {
  const out: ShellCommand[] = [];
  const add = (c: ShellCommand) => {
    if (!out.some((x) => x.name === c.name || x.aliases?.includes(c.name))) out.push(c);
  };
  const global = (n: string) => terminalRegistry.commands.get(n);
  // Built-ins of any shell.
  for (const b of ['cd', 'export', 'unset', 'true', 'false', 'history', 'echo', 'pwd']) {
    const g = global(b);
    if (g && (bins.has('sh') || ['true', 'false'].includes(b))) add({ ...g, aliases: [] });
  }
  if (family === 'scratch') return out;
  const sh = global('bash');
  if (sh) {
    if (bins.has('bash')) add({ ...sh, name: 'bash', aliases: ['sh'] });
    else if (bins.has('sh')) add({ ...sh, name: 'sh', aliases: bins.has('ash') ? ['ash'] : [] });
  }
  const containerAware = new Set(['ps', 'hostname', 'env', 'printenv', 'id', 'whoami', 'uname', 'mount', 'nslookup', 'ping', 'wget', 'kill', 'sleep', 'date']);
  for (const n of bins) {
    if (['sh', 'bash', 'ash', 'dash'].includes(n)) continue;
    if (containerAware.has(n) && LOCAL[n]) add(LOCAL[n]);
    else if (global(n) && !global(n)!.builtin) add({ ...global(n)!, aliases: [] });
    else if (LOCAL[n]) add(LOCAL[n]);
  }
  return out;
}

/** An interactive shell in a container, attached to the host terminal (`docker exec -it web sh`). */
export class ContainerSession implements TerminalSession {
  constructor(
    private opened: OpenedContainer,
    private c: ContainerRec,
    private onExit: (code: number) => void | Promise<void>,
  ) {}

  prompt(): string {
    const cm = this.opened.cm;
    const u = cm.user();
    const cwd = cm.cwd();
    if (this.opened.family === 'debian') return `${u.name === String(u.uid) && u.uid ? 'I have no name!' : u.name}@${this.c.config.Hostname}:${cwd}${u.uid === 0 ? '#' : '$'} `;
    return `${cwd} ${u.uid === 0 ? '#' : '$'} `;
  }

  complete(line: string): string[] {
    return this.opened.cm.complete(line);
  }

  async exec(line: string): Promise<ExecResult & { done?: boolean }> {
    const m = /^\s*exit(?:\s+(\d+))?\s*$/.exec(line);
    if (m) {
      const code = Number(m[1] ?? 0);
      await this.onExit(code);
      return { out: 'exit\n', exit: code, done: true };
    }
    const r = await this.opened.cm.exec(line);
    this.opened.commit();
    return r;
  }
}
