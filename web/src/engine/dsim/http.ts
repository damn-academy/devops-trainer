// Where an HTTP request ends up (04 §6.7, X6): from the host to a published
// port (DNAT to the container's address), to a container address on a Docker
// network, from one container to another by name (embedded DNS only on
// user-defined networks). The answer comes from the program model: files
// under nginx's root, the JSON of the Python API. `curl` on the host uses it.
//
// Extension point for the networks builder: `machine.ext('http', …)` is an
// HttpRouter; a fuller curl from sim-net can call `router.request(...)` for
// addresses Docker owns and fall back to its own network model otherwise.

import { bi } from '../../core/i18n';
import type { ShellCommand, SimMachineApi } from '../../core/types';
import { containerHooks, type ContainerCtx } from './cmachine';
import { dockerOf, refreshSync } from './engine';
import { containerView } from './rootfs';
import type { ContainerRec, DockerSnapshot } from './state';

export interface HttpAnswer {
  status: number;
  body: string;
  headers?: Record<string, string>;
  /** A transport error instead of an answer (curl exit code and message). */
  error?: { code: number; message: string };
  /** Which container answered, for "what happened". */
  via?: string;
}

const running = (c: ContainerRec) => c.status === 'running' && c.program?.kind === 'server';

function answerFrom(m: SimMachineApi, st: DockerSnapshot, c: ContainerRec, path: string, client: string): HttpAnswer {
  const prog = c.program!;
  if (prog.http?.root) {
    const view = containerView(st, c, m.rootFs).files;
    let p = `${prog.http.root.replace(/\/$/, '')}${path.split('?')[0]}`;
    if (view[p]?.t === 'd' || p.endsWith('/')) p = `${p.replace(/\/$/, '')}/index.html`;
    const e = view[p];
    if (prog.comm === 'nginx') c.logs.push({ t: Date.now(), s: 'stdout', line: `${client} - - [18/Nov/2026:09:01:00 +0000] "GET ${path} HTTP/1.1" ${e?.t === 'f' ? 200 : 404} ${e?.t === 'f' ? e.size : 153} "-" "curl/8.14.1" "-"` });
    if (e?.t === 'f') return { status: 200, body: e.text ?? '', headers: { 'Content-Type': prog.http.contentType ?? 'text/html', Server: prog.comm === 'nginx' ? 'nginx/1.30.0' : 'busybox httpd' }, via: c.name };
    return { status: 404, body: '<html>\r\n<head><title>404 Not Found</title></head>\r\n<body>\r\n<center><h1>404 Not Found</h1></center>\r\n<hr><center>nginx/1.30.0</center>\r\n</body>\r\n</html>\r\n', via: c.name };
  }
  if (prog.comm === 'postgres') return { status: 0, body: '', error: { code: 52, message: 'Empty reply from server' }, via: c.name };
  return { status: 200, body: prog.http?.body ?? 'OK', headers: { 'Content-Type': prog.http?.contentType ?? 'text/plain', Server: 'BaseHTTP/0.6 Python/3.13.9' }, via: c.name };
}

const refused = (host: string, port: number): HttpAnswer => ({ status: 0, body: '', error: { code: 7, message: `Failed to connect to ${host} port ${port} after 0 ms: Couldn't connect to server` } });
const reset = (): HttpAnswer => ({ status: 0, body: '', error: { code: 56, message: 'Recv failure: Connection reset by peer' } });

/** A container listening on `port` inside its network namespace: bound to 0.0.0.0 answers, 127.0.0.1 only to itself. */
function toContainer(m: SimMachineApi, st: DockerSnapshot, c: ContainerRec, port: number, path: string, client: string, fromInside: boolean, host: string): HttpAnswer {
  if (!running(c)) return refused(host, port);
  const l = c.program!.listens.find((x) => x.port === port);
  if (!l) return refused(host, port);
  if (l.bind === '127.0.0.1' && !fromInside) return reset();
  return answerFrom(m, st, c, path, client);
}

export function hostRequest(m: SimMachineApi, host: string, port: number, path: string): HttpAnswer {
  const st = dockerOf(m).s;
  refreshSync(m, st);
  const local = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', m.hostname].includes(host);
  if (local) {
    for (const c of st.containers) {
      if (c.status !== 'running') continue;
      if (c.hostConfig.networkMode === 'host' && c.program?.listens.some((x) => x.port === port)) return answerFrom(m, st, c, path, '127.0.0.1');
      const b = c.hostConfig.portBindings.find((p) => p.hostPort === port && p.proto === 'tcp');
      if (b) {
        // the published port is a DNAT rule to the container's address: 172.17.0.2:80
        return toContainer(m, st, c, b.containerPort, path, '172.17.0.1', false, host);
      }
    }
    return refused(host, port);
  }
  for (const c of st.containers) {
    for (const n of Object.values(c.networks)) if (n.ip === host) return toContainer(m, st, c, port, path, '172.17.0.1', false, host);
  }
  if (/^[a-z]/i.test(host) && st.containers.some((c) => c.name === host)) return { status: 0, body: '', error: { code: 6, message: `Could not resolve host: ${host}` } };
  return { status: 0, body: '', error: { code: 7, message: `Failed to connect to ${host} port ${port} after 3 ms: Couldn't connect to server` } };
}

/** DNS from inside a container: names of containers on the same user-defined network (embedded DNS 127.0.0.11). */
function resolveFrom(from: ContainerCtx, name: string): string | null {
  const st = from.st;
  const me = st.containers.find((c) => c.id === from.containerId);
  if (!me) return null;
  if (name === 'localhost') return '127.0.0.1';
  if (name === me.config.Hostname || name === me.name) return Object.values(me.networks)[0]?.ip || '127.0.0.1';
  for (const [net, ep] of Object.entries(me.networks)) {
    if (['bridge', 'host', 'none'].includes(net)) continue;
    void ep;
    for (const c of st.containers) {
      if (c === me || !c.networks[net] || c.status !== 'running') continue;
      if (c.networks[net].aliases.includes(name) || c.name === name || c.compose?.service === name) return c.networks[net].ip;
    }
  }
  if (name === 'host.docker.internal') return null;
  return null;
}

function containerFetch(from: ContainerCtx, url: string): { status: number; body: string; error?: string } {
  const st = from.st;
  const me = st.containers.find((c) => c.id === from.containerId);
  if (!me) return { status: 0, body: '', error: 'no container' };
  const m = from.host;
  if (url.startsWith('icmp://')) {
    const ip = url.slice(7);
    if (me.networks.none) return { status: 0, body: '' };
    if (ip.startsWith('127.')) return { status: 200, body: '' };
    const sameNet = st.containers.some((c) => c.status === 'running' && Object.entries(c.networks).some(([n, e]) => e.ip === ip && me.networks[n]));
    const gateway = st.networks.some((n) => n.gateway === ip && me.networks[n.name]);
    const outside = !/^172\.(1[6-9]|2\d|3[01])\./.test(ip) && st.ipForward && !me.networks.none;
    return { status: sameNet || gateway || outside ? 200 : 0, body: '' };
  }
  const u = new URL(url);
  const port = Number(u.port || 80);
  if (me.networks.none) return { status: 0, body: '', error: `can't connect to remote host: Network unreachable` };
  const host = u.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    const r = toContainer(m, st, me, port, u.pathname, '127.0.0.1', true, host);
    return r.error ? { status: 0, body: '', error: `can't connect to remote host (127.0.0.1): Connection refused` } : { status: r.status, body: r.body };
  }
  const ip = /^\d+\.\d+\.\d+\.\d+$/.test(host) ? host : resolveFrom(from, host);
  if (!ip) return { status: 0, body: '', error: `bad address '${host}'` };
  const target = st.containers.find((c) => Object.entries(c.networks).some(([n, e]) => e.ip === ip && me.networks[n]));
  if (!target) return { status: 0, body: '', error: `can't connect to remote host (${ip}): ${st.containers.some((c) => Object.values(c.networks).some((e) => e.ip === ip)) ? 'Connection timed out' : 'Connection refused'}` };
  const r = toContainer(m, st, target, port, u.pathname, Object.values(me.networks)[0]?.ip ?? '', false, host);
  if (r.error) return { status: 0, body: '', error: r.error.code === 56 ? 'error getting response: Connection reset by peer' : `can't connect to remote host (${ip}): Connection refused` };
  return { status: r.status, body: r.body };
}

containerHooks.resolve = resolveFrom;
containerHooks.fetch = containerFetch;

/** HTTP status a published port answers with right now, for facts: http['localhost:8080']=200. */
export function httpFacts(m: SimMachineApi): Record<string, { status: number; body: string; error?: string }> {
  const st = dockerOf(m).s;
  const out: Record<string, { status: number; body: string; error?: string }> = {};
  const ports = new Set<number>();
  for (const c of st.containers) for (const p of c.hostConfig.portBindings) ports.add(p.hostPort);
  for (const c of st.containers) if (c.hostConfig.networkMode === 'host') for (const l of c.program?.listens ?? []) ports.add(l.port);
  for (const p of ports) {
    const r = hostRequest(m, 'localhost', p, '/');
    out[`localhost:${p}`] = { status: r.status, body: r.body.slice(0, 2000), error: r.error?.message };
  }
  return out;
}

export const curl: ShellCommand = {
  name: 'curl',
  summary: bi('сделать HTTP-запрос и показать ответ', 'make an HTTP request and print the answer'),
  help: `Usage: curl [options...] <url>
 -f, --fail                 Fail fast with no output on HTTP errors
 -i, --show-headers         Show response headers in output
 -I, --head                 Show document info only
 -o, --output <file>        Write to file instead of stdout
 -s, --silent               Silent mode
 -S, --show-error           Show error even when -s is used
 -v, --verbose              Make the operation more talkative
 -w, --write-out <format>   Use output FORMAT after completion

This is not the full help; it is a simulated curl that knows the addresses
of the simulated machine and its containers.`,
  run(ctx) {
    const args = ctx.argv.slice(1);
    const flags = new Set<string>();
    let url: string | undefined;
    let outFile: string | undefined;
    let writeOut: string | undefined;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-o' || a === '--output') outFile = args[++i];
      else if (a === '-w' || a === '--write-out') writeOut = args[++i];
      else if (/^-[a-zA-Z]+$/.test(a)) for (const ch of a.slice(1)) flags.add(ch);
      else if (a === '--fail') flags.add('f');
      else if (a === '--silent') flags.add('s');
      else if (a === '--head') flags.add('I');
      else if (a === '--show-headers' || a === '--include') flags.add('i');
      else if (a.startsWith('-')) continue;
      else url = a;
    }
    if (!url) {
      ctx.err("curl: try 'curl --help' or 'curl --manual' for more information\n");
      return 2;
    }
    const full = /^https?:\/\//.test(url) ? url : `http://${url}`;
    let u: URL;
    try {
      u = new URL(full);
    } catch {
      ctx.err(`curl: (3) URL rejected: Malformed input to a URL function\n`);
      return 3;
    }
    if (u.protocol === 'https:') {
      ctx.err(`curl: (7) Failed to connect to ${u.hostname} port 443 after 0 ms: Couldn't connect to server\n`);
      return 7;
    }
    const router = ctx.machine.ext<HttpRouter>('http', () => new HttpRouter());
    const r = router.request(ctx.machine, u.hostname, Number(u.port || 80), u.pathname + u.search);
    if (r.error) {
      if (!flags.has('s') || flags.has('S')) ctx.err(`curl: (${r.error.code}) ${r.error.message}\n`);
      return r.error.code;
    }
    if (flags.has('f') && r.status >= 400) {
      if (!flags.has('s') || flags.has('S')) ctx.err(`curl: (22) The requested URL returned error: ${r.status}\n`);
      return 22;
    }
    const head = `HTTP/1.1 ${r.status} ${r.status === 200 ? 'OK' : r.status === 404 ? 'Not Found' : ''}\r\n${Object.entries(r.headers ?? {})
      .map(([k, v]) => `${k}: ${v}\r\n`)
      .join('')}Content-Length: ${r.body.length}\r\n\r\n`;
    let text = flags.has('I') ? head : flags.has('i') ? head + r.body : r.body;
    if (writeOut) text += writeOut.replace(/%\{http_code\}/g, String(r.status)).replace(/\\n/g, '\n');
    if (outFile) ctx.fs.writeFile(outFile, r.body);
    else ctx.out(text.replace(/\r\n/g, '\n'));
    return 0;
  },
};

/** The HTTP view of the machine; dsim answers for Docker's addresses. Other engines may extend `handlers`. */
export class HttpRouter {
  handlers: ((m: SimMachineApi, host: string, port: number, path: string) => HttpAnswer | null)[] = [];
  request(m: SimMachineApi, host: string, port: number, path: string): HttpAnswer {
    for (const h of this.handlers) {
      const r = h(m, host, port, path);
      if (r) return r;
    }
    return hostRequest(m, host, port, path);
  }
}
