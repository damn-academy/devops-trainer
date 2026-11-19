// Models of what the main process of a container does (04 §11.4). The
// simulator does not run real binaries; it knows a handful of programs of the
// course images and reads the rest from the files the learner can see: an
// nginx config, a Python script. The rule of PID 1 lives in engine.ts.

import { HELLO } from './hello';
import { findExecutable } from './cmachine';
import type { LayerFiles } from './layers';
import type { ContainerRec, ProgramRun } from './state';

export interface Resolved {
  run: ProgramRun;
  /** Lines the program prints when it starts (stdout or stderr). */
  logs: { s: 'stdout' | 'stderr'; line: string }[];
  /** A command line the engine runs in the container's shell (oneshot commands like `echo hi`, `sh -c "…"`). */
  script?: string;
  /** Files the program writes when it starts (a log file inside the container). */
  writes?: { path: string; text: string }[];
  /** The runtime could not start the process at all: the daemon's error and the exit code. */
  startError?: { message: string; code: number };
}

const SHELLS = ['sh', 'ash', 'bash', 'dash'];

const base = (p: string) => p.slice(p.lastIndexOf('/') + 1);

function fileText(files: LayerFiles, p: string): string | undefined {
  const e = files[p];
  return e?.t === 'f' ? e.text : undefined;
}

/** argv the container starts with: ENTRYPOINT + CMD, either replaced by run arguments. */
export function containerArgv(c: ContainerRec): string[] {
  return [...(c.config.Entrypoint ?? []), ...(c.config.Cmd ?? [])];
}

/** Can this container open a TCP connection to host:port right now? */
export type Probe = (host: string, port: number) => 'ok' | 'unresolved' | 'refused';

export function resolveProgram(c: ContainerRec, files: LayerFiles, env: Record<string, string>, opts: { arch: string; interactive: boolean; probe?: Probe }): Resolved {
  const argv = containerArgv(c);
  const none: ProgramRun = { kind: 'oneshot', comm: '', argv, listens: [], handles: [], memoryMb: 1, readyAfterMs: 0, exitCode: 0 };
  if (!argv.length) return { run: none, logs: [], startError: { message: 'no command specified', code: 125 } };
  if (opts.arch !== 'amd64') {
    const exe = findExecutable(files, argv[0], env) ?? argv[0];
    return { run: { ...none, comm: base(argv[0]), exitCode: 255 }, logs: [{ s: 'stderr', line: `exec ${exe}: exec format error` }] };
  }
  const exe = findExecutable(files, argv[0], env);
  if (!exe) {
    const what = argv[0].includes('/') ? `no such file or directory` : `executable file not found in $PATH`;
    return {
      run: { ...none, comm: base(argv[0]), exitCode: 127 },
      logs: [],
      startError: { message: `failed to create task for container: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: error during container init: exec: "${argv[0]}": ${what}: unknown`, code: 127 },
    };
  }
  probe = opts.probe;
  return program(c, files, env, argv, opts.interactive);
}

let probe: Probe | undefined;

function program(c: ContainerRec, files: LayerFiles, env: Record<string, string>, argv: string[], interactive: boolean): Resolved {
  const name = base(argv[0]);
  const run = (r: Partial<ProgramRun>): ProgramRun => ({ kind: 'idle', comm: name, argv, listens: [], handles: [], memoryMb: 2, readyAfterMs: 0, ...r });

  // Entrypoint scripts of the official images: they prepare things and `exec "$@"`.
  if (name === 'docker-entrypoint.sh' && argv.length > 1) {
    const inner = program(c, files, env, argv.slice(1), interactive);
    if (base(argv[1]) === 'nginx') {
      const pre = [
        '/docker-entrypoint.sh: /docker-entrypoint.d/ is not empty, will attempt to perform configuration',
        '/docker-entrypoint.sh: Looking for shell scripts in /docker-entrypoint.d/',
        '/docker-entrypoint.sh: Launching /docker-entrypoint.d/10-listen-on-ipv6-by-default.sh',
        '10-listen-on-ipv6-by-default.sh: info: Getting the checksum of /etc/nginx/conf.d/default.conf',
        '10-listen-on-ipv6-by-default.sh: info: Enabled listen on IPv6 in /etc/nginx/conf.d/default.conf',
        '/docker-entrypoint.sh: Launching /docker-entrypoint.d/20-envsubst-on-templates.sh',
        '/docker-entrypoint.sh: Launching /docker-entrypoint.d/30-tune-worker-processes.sh',
        '/docker-entrypoint.sh: Configuration complete; ready for start up',
      ];
      return { ...inner, logs: [...pre.map((line) => ({ s: 'stdout' as const, line })), ...inner.logs] };
    }
    return inner;
  }

  if (name === 'hello') return { run: run({ kind: 'oneshot', exitCode: 0 }), logs: HELLO.split('\n').map((line) => ({ s: 'stdout' as const, line })) };

  if (SHELLS.includes(name)) {
    const ci = argv.indexOf('-c');
    if (ci < 0) {
      // A shell without a script reads stdin: with -it it waits for you, without it sees EOF and exits.
      return interactive ? { run: run({ kind: 'idle', comm: name }), logs: [] } : { run: run({ kind: 'oneshot', exitCode: 0 }), logs: [] };
    }
    const script = argv[ci + 1] ?? '';
    const parts = script.split(/\s*(?:;|&&|\|\|)\s*/).filter(Boolean);
    if (parts.length === 1 && !/[|<>]/.test(script)) {
      // One simple command: the shell execs it, the program replaces sh as PID 1.
      const words = parts[0].trim().split(/\s+/);
      const exe = findExecutable(files, words[0], env);
      if (exe && isLongRunning(words)) return program(c, files, env, words, interactive);
      if (exe && ['nginx', 'httpd', 'python', 'python3', 'postgres', 'worker'].includes(base(words[0]))) return program(c, files, env, words, interactive);
    } else {
      const first = parts[0].trim().split(/\s+/);
      if (findExecutable(files, first[0], env) && (isLongRunning(first) || ['nginx', 'httpd', 'python', 'python3', 'worker'].includes(base(first[0])))) {
        const inner = program(c, files, env, first, interactive);
        // sh stays PID 1 and waits for its child: it has no handler for SIGTERM and does not pass it on.
        return { ...inner, run: { ...inner.run, shellParent: true, comm: name, handles: [] } };
      }
      if (parts.some((p) => isLongRunning(p.trim().split(/\s+/)))) return { run: run({ kind: 'idle', comm: name }), logs: [], script: parts.filter((p) => !isLongRunning(p.trim().split(/\s+/))).join('; ') };
    }
    return { run: run({ kind: 'oneshot', comm: name }), logs: [], script };
  }

  if (isLongRunning(argv)) return { run: run({ kind: 'idle' }), logs: [] };

  if (name === 'nginx') {
    const daemonOff = argv.join(' ').includes('daemon off');
    if (!daemonOff) return { run: run({ kind: 'oneshot', exitCode: 0, daemonized: true }), logs: [] };
    if (c.hostConfig.readonlyRootfs && !c.mounts.some((m) => m.target === '/var/cache/nginx')) {
      return { run: run({ kind: 'oneshot', exitCode: 1 }), logs: [{ s: 'stderr', line: '2026/11/18 09:00:00 [emerg] 1#1: mkdir() "/var/cache/nginx/client_temp" failed (30: Read-only file system)' }, { s: 'stderr', line: 'nginx: [emerg] mkdir() "/var/cache/nginx/client_temp" failed (30: Read-only file system)' }] };
    }
    if (c.hostConfig.readonlyRootfs && !c.mounts.some((m) => m.target === '/run')) {
      return { run: run({ kind: 'oneshot', exitCode: 1 }), logs: [{ s: 'stderr', line: 'nginx: [emerg] open() "/run/nginx.pid" failed (30: Read-only file system)' }] };
    }
    const caps = effectiveCaps(c);
    const uid = Number(/^\d+/.exec(c.hostConfig.user || c.config.User || '0')?.[0] ?? 0);
    const needs: [string, string][] = [['CHOWN', 'nginx: [emerg] chown("/var/cache/nginx/client_temp", 101) failed (1: Operation not permitted)'], ['SETGID', 'nginx: [emerg] setgid(101) failed (1: Operation not permitted)'], ['SETUID', 'nginx: [emerg] setuid(101) failed (1: Operation not permitted)']];
    for (const [cap, msg] of needs) if (uid === 0 && !caps.has(cap)) return { run: run({ kind: 'oneshot', exitCode: 1 }), logs: [{ s: 'stderr', line: msg }] };
    const conf = fileText(files, '/etc/nginx/conf.d/default.conf') ?? '';
    const port = Number(/listen\s+(\d+)/.exec(conf)?.[1] ?? 80);
    const root = /root\s+([^;\s]+);/.exec(conf)?.[1] ?? '/usr/share/nginx/html';
    if (port < 1024 && (uid !== 0 || !caps.has('NET_BIND_SERVICE')) && !(c.hostConfig.sysctls['net.ipv4.ip_unprivileged_port_start'] === '0')) {
      return { run: run({ kind: 'oneshot', exitCode: 1 }), logs: [{ s: 'stderr', line: `nginx: [emerg] bind() to 0.0.0.0:${port} failed (13: Permission denied)` }] };
    }
    return {
      run: run({ kind: 'server', comm: 'nginx', listens: [{ port, bind: '0.0.0.0', proto: 'tcp' }], handles: ['TERM', 'QUIT', 'INT', 'HUP'], http: { root, contentType: 'text/html' }, memoryMb: 7 }),
      logs: [
        { s: 'stderr', line: '2026/11/18 09:00:00 [notice] 1#1: using the "epoll" event method' },
        { s: 'stderr', line: '2026/11/18 09:00:00 [notice] 1#1: nginx/1.30.0' },
        { s: 'stderr', line: '2026/11/18 09:00:00 [notice] 1#1: start worker processes' },
      ],
    };
  }

  if (name === 'httpd') {
    const fg = argv.includes('-f');
    if (!fg) return { run: run({ kind: 'oneshot', exitCode: 0, daemonized: true }), logs: [] };
    const pi = argv.indexOf('-p');
    const hi = argv.indexOf('-h');
    const port = pi > 0 ? Number(argv[pi + 1].split(':').pop()) : 80;
    return { run: run({ kind: 'server', comm: 'httpd', listens: [{ port, bind: '0.0.0.0', proto: 'tcp' }], handles: [], http: { root: hi > 0 ? argv[hi + 1] : c.config.WorkingDir || '/', contentType: 'text/html' }, memoryMb: 1 }), logs: [] };
  }

  if (/^python(3(\.\d+)?)?$/.test(name)) return python(c, files, env, argv, interactive, run);

  if (name === 'postgres') {
    const pw = env.POSTGRES_PASSWORD || env.POSTGRES_HOST_AUTH_METHOD;
    const dataDir = env.PGDATA || '/var/lib/postgresql/data';
    if (!pw) {
      return {
        run: run({ kind: 'oneshot', exitCode: 1 }),
        logs: [
          'Error: Database is uninitialized and superuser password is not specified.',
          '       You must specify POSTGRES_PASSWORD to a non-empty value for the',
          '       superuser. For example, "-e POSTGRES_PASSWORD=password" on "docker run".',
          '',
          '       You may also use "POSTGRES_HOST_AUTH_METHOD=trust" to allow all',
          '       connections without a password. This is *not* recommended.',
        ].map((line) => ({ s: 'stderr' as const, line })),
      };
    }
    const initialised = !!files[`${dataDir}/PG_VERSION`];
    const logs = initialised
      ? ['', 'PostgreSQL Database directory appears to contain a database; Skipping initialization', '']
      : ['The files belonging to this database system will be owned by user "postgres".', 'creating subdirectories ... ok', 'Success. You can now start the database server.', '', 'PostgreSQL init process complete; ready for start up.', ''];
    logs.push('2026-11-18 09:00:02.512 UTC [1] LOG:  starting PostgreSQL 17.6 on x86_64-pc-linux-musl', '2026-11-18 09:00:02.513 UTC [1] LOG:  listening on IPv4 address "0.0.0.0", port 5432', '2026-11-18 09:00:02.530 UTC [1] LOG:  database system is ready to accept connections');
    return { run: run({ kind: 'server', comm: 'postgres', listens: [{ port: 5432, bind: '0.0.0.0', proto: 'tcp' }], handles: ['TERM', 'INT', 'QUIT'], memoryMb: 40, readyAfterMs: 2500, http: { body: '' } }), logs: logs.map((line) => ({ s: 'stdout' as const, line })) };
  }

  if (name === 'worker') {
    return { run: run({ kind: 'idle', comm: 'worker', memoryMb: 90, handles: ['TERM'] }), logs: [{ s: 'stdout', line: 'worker: started, filling a 90 MiB cache' }, { s: 'stdout', line: 'worker: cache ready, waiting for jobs' }] };
  }

  const goProg = /go program: listens :(\d+)(?:, says "(.*)")?/.exec(fileText(files, findExecutable(files, argv[0], env) ?? '') ?? '');
  if (goProg) return { run: run({ kind: 'server', listens: [{ port: Number(goProg[1]), bind: '0.0.0.0', proto: 'tcp' }], handles: ['TERM', 'INT'], http: { body: goProg[2] ?? 'ok', contentType: 'text/plain' }, memoryMb: 6 }), logs: [{ s: 'stderr', line: `${new Date(Date.UTC(2026, 10, 18, 9, 0, 0)).toISOString().slice(0, 19).replace('T', ' ').replace(/-/g, '/')} listening on :${goProg[1]}` }] };

  if (name === 'tool') return { run: run({ kind: 'oneshot', exitCode: 0 }), logs: [{ s: 'stdout', line: 'tool 1.0.0 (linux/amd64)' }] };

  // A busybox or coreutils program: run it in the container's shell, it prints and exits.
  if (['echo', 'ls', 'cat', 'env', 'printenv', 'id', 'hostname', 'uname', 'pwd', 'whoami', 'ps', 'date', 'nslookup', 'ping', 'wget', 'true', 'false', 'mount', 'grep', 'head'].includes(name)) {
    return { run: run({ kind: 'oneshot', comm: name }), logs: [], script: argv.map(quoteWord).join(' ') };
  }
  return { run: run({ kind: 'idle', note: 'dsim: the trainer does not know what this program does; it keeps running like `sleep infinity`.' }), logs: [] };
}

/** Docker's default capability set (moby oci/caps/defaults.go), changed by --cap-drop/--cap-add/--privileged. */
export const DEFAULT_CAPS = ['CHOWN', 'DAC_OVERRIDE', 'FSETID', 'FOWNER', 'MKNOD', 'NET_RAW', 'SETGID', 'SETUID', 'SETFCAP', 'SETPCAP', 'NET_BIND_SERVICE', 'SYS_CHROOT', 'KILL', 'AUDIT_WRITE'];

export function effectiveCaps(c: ContainerRec): Set<string> {
  if (c.hostConfig.privileged) return new Set([...DEFAULT_CAPS, 'SYS_ADMIN', 'NET_ADMIN', 'SYS_PTRACE', 'SYS_MODULE']);
  const drop = c.hostConfig.capDrop.map((x) => x.toUpperCase());
  const caps = new Set(drop.includes('ALL') ? [] : DEFAULT_CAPS.filter((x) => !drop.includes(x)));
  for (const a of c.hostConfig.capAdd) caps.add(a.toUpperCase());
  return caps;
}

function quoteWord(w: string): string {
  return /^[\w@%+=:,./-]+$/.test(w) ? w : `'${w.replace(/'/g, `'\\''`)}'`;
}

function isLongRunning(words: string[]): boolean {
  const n = base(words[0] ?? '');
  if (n === 'sleep') return words[1] === 'infinity' || Number(words[1]) >= 30;
  if (n === 'tail') return words.includes('-f');
  if (n === 'top') return true;
  return false;
}

/**
 * Python: the simulator reads the script. Required variables (`os.environ["X"]`),
 * the address an HTTPServer binds to, a SIGTERM handler and what it prints are
 * all visible in the code, so a learner can predict the behaviour from it.
 */
function python(c: ContainerRec, files: LayerFiles, env: Record<string, string>, argv: string[], interactive: boolean, run: (r: Partial<ProgramRun>) => ProgramRun): Resolved {
  const args = argv.slice(1).filter((a) => a !== '-u');
  const unbuffered = argv.includes('-u') || !!env.PYTHONUNBUFFERED;
  if (!args.length) return interactive ? { run: run({ kind: 'idle', comm: 'python3' }), logs: [] } : { run: run({ kind: 'oneshot', comm: 'python3', exitCode: 0 }), logs: [] };
  if (args[0] === '-c') return { run: run({ kind: 'oneshot', comm: 'python3', exitCode: 0 }), logs: [] };
  const wd = c.config.WorkingDir || '/';
  const path = args[0].startsWith('/') ? args[0] : `${wd === '/' ? '' : wd}/${args[0]}`;
  const code = fileText(files, path);
  if (code === undefined) {
    return { run: run({ kind: 'oneshot', comm: 'python3', exitCode: 2 }), logs: [{ s: 'stderr', line: `python3: can't open file '${path}': [Errno 2] No such file or directory` }] };
  }
  const lines = code.split('\n');
  const required = [...code.matchAll(/os\.environ\[["'](\w+)["']\]/g)].map((m) => m[1]);
  for (const r of required) {
    if (!(r in env)) {
      const lineNo = lines.findIndex((l) => l.includes(`os.environ["${r}"]`) || l.includes(`os.environ['${r}']`)) + 1;
      const src = lines[lineNo - 1] ?? '';
      return {
        run: run({ kind: 'oneshot', comm: 'python3', exitCode: 1 }),
        logs: ['Traceback (most recent call last):', `  File "${path}", line ${lineNo}, in <module>`, `    ${src.trim()}`, '  File "<frozen os>", line 717, in __getitem__', `KeyError: '${r}'`].map((line) => ({ s: 'stderr' as const, line })),
      };
    }
  }
  const vars: Record<string, string> = {};
  const conn = /socket\.create_connection\(\(\s*(\w+),\s*(\d+)\)/.exec(code);
  for (const m of code.matchAll(/^(\w+)\s*=\s*(?:int\()?os\.environ(?:\.get\(["'](\w+)["'],\s*["']([^"']*)["']\)|\[["'](\w+)["']\])\)?/gm)) {
    vars[m[1]] = m[2] ? (env[m[2]] ?? m[3]) : env[m[4]] ?? '';
  }
  for (const m of code.matchAll(/^(\w+)\s*=\s*["']([^"']*)["']\s*$/gm)) vars[m[1]] ??= m[2];
  for (const m of code.matchAll(/^(\w+)\s*=\s*(\d+)\s*$/gm)) vars[m[1]] ??= m[2];
  if (conn && probe) {
    const host = vars[conn[1]] ?? conn[1];
    const r = probe(host, Number(conn[2]));
    if (r !== 'ok') {
      const lineNo = lines.findIndex((l) => l.includes('socket.create_connection')) + 1;
      const tail = r === 'unresolved' ? ['socket.gaierror: [Errno -2] Name or service not known'] : ['ConnectionRefusedError: [Errno 111] Connection refused'];
      return {
        run: run({ kind: 'oneshot', comm: 'python3', exitCode: 1 }),
        logs: ['Traceback (most recent call last):', `  File "${path}", line ${lineNo}, in <module>`, `    ${lines[lineNo - 1]?.trim() ?? ''}`, '  File "/usr/local/lib/python3.13/socket.py", line 840, in create_connection', ...tail].map((line) => ({ s: 'stderr' as const, line })),
      };
    }
  }
  const val = (expr: string) => {
    const e = expr.trim();
    const lit = /^["']([^"']*)["']$/.exec(e);
    if (lit) return lit[1];
    if (/^\d+$/.test(e)) return e;
    return vars[e] ?? '';
  };
  const fstr = (s: string) => s.replace(/\{(\w+)\}/g, (_, v: string) => vars[v] ?? '');
  const handles = /signal\.signal\(\s*signal\.SIGTERM/.test(code) ? ['TERM', 'INT'] : ['INT'];
  const prints: { s: 'stdout' | 'stderr'; line: string }[] = [];
  for (const m of code.matchAll(/^print\((f?)["'](.*?)["'](?:,[^)]*)?\)/gm)) prints.push({ s: 'stdout', line: m[1] ? fstr(m[2]) : m[2] });
  const srv = /HTTPServer\(\(\s*([^,]+),\s*([^)]+)\)/.exec(code);
  if (srv) {
    const bind = val(srv[1]) || '0.0.0.0';
    const port = Number(val(srv[2].replace(/^int\((.*)\)$/, '$1'))) || 8000;
    const dumps = /json\.dumps\(\{(.*?)\}\)/.exec(code);
    let body = 'OK';
    if (dumps) {
      const obj: Record<string, string> = {};
      for (const kv of dumps[1].matchAll(/["'](\w+)["']\s*:\s*([^,}]+)/g)) obj[kv[1]] = val(kv[2]);
      body = JSON.stringify(obj).replace(/","/g, '", "').replace(/":"/g, '": "');
    } else {
      const w = /wfile\.write\(b?["'](.*?)["']\)/.exec(code);
      if (w) body = w[1];
    }
    const flushes = /flush\s*=\s*True/.test(code) || unbuffered;
    return { run: run({ kind: 'server', comm: 'python', listens: [{ port, bind, proto: 'tcp' }], handles, http: { body, contentType: 'application/json' }, memoryMb: 18 }), logs: flushes ? prints : [] };
  }
  const logOpen = /^(\w+)\s*=\s*open\((\w+|["'][^"']+["']),\s*["']a["']/m.exec(code);
  if (logOpen) {
    const target = val(logOpen[2]);
    const written = [...code.matchAll(new RegExp(`^${logOpen[1]}\\.write\\(["'](.*?)(?:\\\\n)?["']\\)`, 'gm'))].map((x) => x[1]);
    const link = files[target];
    const toStdout = target === '/dev/stdout' || (link?.t === 'l' && link.target === '/dev/stdout');
    const run2 = run({ kind: /while True/.test(code) ? 'idle' : 'oneshot', comm: 'python', handles, memoryMb: 9, exitCode: 0 });
    return toStdout ? { run: run2, logs: written.map((line) => ({ s: 'stdout' as const, line })) } : { run: run2, logs: [], writes: [{ path: target, text: written.map((l) => l + '\n').join('') }] };
  }
  if (/while True|serve_forever|time\.sleep\(/.test(code)) return { run: run({ kind: 'idle', comm: 'python', handles, memoryMb: 12 }), logs: unbuffered ? prints : [] };
  return { run: run({ kind: 'oneshot', comm: 'python', exitCode: 0, handles }), logs: prints };
}
