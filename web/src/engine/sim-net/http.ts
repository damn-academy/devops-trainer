// HTTP in netlab (03 §8.2): applications that answer by route with a delay,
// and an nginx reverse proxy that follows the real defaults — proxy_connect_timeout
// and proxy_read_timeout 60 s, proxy_next_upstream "error timeout", max_fails=1,
// fail_timeout=10s, no retry of a non-idempotent request, one error.log line per
// failed attempt. TLS certificates are checked by the rules curl applies: name,
// dates, trust chain. There is no cryptography: certificates are records.

import { appendHostFile, COURSE_DATE, readHostFile, tcpConnect, tcpData, type Cert, type FileIo, type Service, type World } from './world';

export const NGINX_VERSION = 'nginx/1.26.3';
export const CURL_VERSION = '8.14.1';

export const REASONS: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Temporarily Unavailable',
  504: 'Gateway Time-out',
};

export interface HttpRequest {
  method: string;
  path: string;
  host: string;
  headers: [string, string][];
  /** Address of the client as the server sees it. */
  client: string;
}

export interface HttpResponse {
  status: number;
  headers: [string, string][];
  body: string;
  /** Seconds the server took from request to the first byte of the answer. */
  wait: number;
  /** For a proxy: the upstream addresses tried, as $upstream_addr prints them. */
  upstreamAddr?: string;
}

// ── nginx configuration (a subset with the real defaults) ──────────────────

export interface UpstreamServer {
  addr: string;
  port: number;
  maxFails: number;
  failTimeout: number;
  down?: boolean;
  backup?: boolean;
}

export interface NginxLocation {
  path: string;
  proxyPass?: string;
  ret?: { code: number; url?: string };
  connectTimeout: number;
  readTimeout: number;
  nextUpstream: string[];
}

export interface NginxServer {
  listen: number;
  serverName: string[];
  locations: NginxLocation[];
}

export interface NginxConf {
  upstreams: Record<string, UpstreamServer[]>;
  servers: NginxServer[];
  errors: string[];
}

const KNOWN = new Set([
  'upstream',
  'server',
  'listen',
  'server_name',
  'location',
  'proxy_pass',
  'proxy_read_timeout',
  'proxy_connect_timeout',
  'proxy_send_timeout',
  'proxy_next_upstream',
  'proxy_next_upstream_tries',
  'proxy_next_upstream_timeout',
  'proxy_set_header',
  'proxy_http_version',
  'return',
  'root',
  'index',
  'access_log',
  'error_log',
  'ssl_certificate',
  'ssl_certificate_key',
  'keepalive_timeout',
  'add_header',
  'include',
  'http',
  'events',
  'worker_processes',
  'keepalive',
]);

/** "60s", "60", "2m", "500ms" → seconds. */
export function nginxTime(v: string): number {
  const m = /^(\d+(?:\.\d+)?)(ms|s|m|h)?$/.exec(v.trim());
  if (!m) return NaN;
  const n = Number(m[1]);
  return m[2] === 'ms' ? n / 1000 : m[2] === 'm' ? n * 60 : m[2] === 'h' ? n * 3600 : n;
}

/** Parse the subset of nginx.conf the trainer uses. Unknown directives and broken braces are errors, as with nginx -t. */
export function parseNginx(text: string, file = '/etc/nginx/conf.d/default.conf'): NginxConf {
  const conf: NginxConf = { upstreams: {}, servers: [], errors: [] };
  const tokens: { t: string; line: number }[] = [];
  text.split('\n').forEach((raw, i) => {
    const line = raw.replace(/#.*/, '');
    for (const m of line.matchAll(/"[^"]*"|'[^']*'|[{};]|[^\s{};]+/g)) tokens.push({ t: m[0], line: i + 1 });
  });
  type Ctx = { kind: string; arg?: string; dirs: Record<string, string[]> };
  const stack: Ctx[] = [{ kind: 'main', dirs: {} }];
  let cur: string[] = [];
  let curLine = 1;
  let upstream: string | null = null;
  let server: NginxServer | null = null;
  let location: NginxLocation | null = null;
  // Directives are inherited after the whole file is read (as nginx merges them), so their order does not matter.
  const pending: { loc: NginxLocation; chain: Ctx[] }[] = [];
  const finishLocation = () => {
    if (!location || !server) return;
    pending.push({ loc: location, chain: [...stack] });
    server.locations.push(location);
    location = null;
  };
  for (const tok of tokens) {
    if (tok.t === '{') {
      const [name, ...args] = cur;
      if (!name) {
        conf.errors.push(`unexpected "{" in ${file}:${tok.line}`);
        continue;
      }
      if (!KNOWN.has(name)) conf.errors.push(`unknown directive "${name}" in ${file}:${curLine}`);
      stack.push({ kind: name, arg: args.join(' '), dirs: {} });
      if (name === 'upstream') {
        upstream = args[0];
        conf.upstreams[upstream] = [];
      } else if (name === 'server' && !upstream) {
        server = { listen: 80, serverName: [], locations: [] };
      } else if (name === 'location') {
        location = { path: args[args.length - 1] ?? '/', connectTimeout: 60, readTimeout: 60, nextUpstream: ['error', 'timeout'] };
      }
      cur = [];
      continue;
    }
    if (tok.t === '}') {
      if (cur.length) conf.errors.push(`unexpected "}" in ${file}:${tok.line}`);
      const ctx = stack.pop();
      if (!ctx || stack.length === 0) {
        conf.errors.push(`unexpected "}" in ${file}:${tok.line}`);
        stack.push({ kind: 'main', dirs: {} });
        continue;
      }
      if (ctx.kind === 'location') {
        stack.push(ctx);
        finishLocation();
        stack.pop();
      } else if (ctx.kind === 'server' && server && !upstream) {
        if (!server.locations.length) {
          stack.push(ctx);
          location = { path: '/', connectTimeout: 60, readTimeout: 60, nextUpstream: ['error', 'timeout'] };
          const pp = ctx.dirs.proxy_pass;
          const rt = ctx.dirs.return;
          if (pp) location.proxyPass = pp[0];
          if (rt) location.ret = { code: Number(rt[0]), url: rt[1] };
          finishLocation();
          stack.pop();
        }
        conf.servers.push(server);
        server = null;
      } else if (ctx.kind === 'upstream') upstream = null;
      cur = [];
      continue;
    }
    if (tok.t === ';') {
      const [name, ...args] = cur;
      cur = [];
      if (!name) continue;
      if (!KNOWN.has(name)) {
        conf.errors.push(`unknown directive "${name}" in ${file}:${curLine}`);
        continue;
      }
      const ctx = stack[stack.length - 1];
      if (ctx.kind === 'upstream' && name === 'server' && upstream) {
        const [addr, port] = args[0].split(':');
        const s: UpstreamServer = { addr, port: Number(port ?? 80), maxFails: 1, failTimeout: 10 };
        for (const a of args.slice(1)) {
          if (a.startsWith('max_fails=')) s.maxFails = Number(a.slice(10));
          else if (a.startsWith('fail_timeout=')) s.failTimeout = nginxTime(a.slice(13));
          else if (a === 'down') s.down = true;
          else if (a === 'backup') s.backup = true;
        }
        conf.upstreams[upstream].push(s);
        continue;
      }
      ctx.dirs[name] = args;
      if (name.startsWith('proxy_') && /timeout$/.test(name) && Number.isNaN(nginxTime(args[0] ?? ''))) conf.errors.push(`"${name}" directive invalid value in ${file}:${curLine}`);
      if (server && name === 'listen') server.listen = Number(String(args[0]).split(':').pop()?.replace(/\D.*$/, '')) || 80;
      if (server && name === 'server_name') server.serverName = args;
      if (location && name === 'proxy_pass') location.proxyPass = args[0];
      if (location && name === 'return') location.ret = { code: Number(args[0]), url: args[1] };
      continue;
    }
    if (!cur.length) curLine = tok.line;
    cur.push(tok.t.replace(/^["']|["']$/g, ''));
  }
  for (const { loc, chain } of pending) {
    const inherited = (key: string): string[] | undefined => {
      for (let i = chain.length - 1; i >= 0; i--) if (chain[i].dirs[key]) return chain[i].dirs[key];
      return undefined;
    };
    const read = inherited('proxy_read_timeout');
    const conn = inherited('proxy_connect_timeout');
    loc.readTimeout = read ? nginxTime(read[0]) : 60;
    loc.connectTimeout = conn ? nginxTime(conn[0]) : 60;
    loc.nextUpstream = inherited('proxy_next_upstream') ?? ['error', 'timeout'];
  }
  if (cur.length) conf.errors.push(`unexpected end of file, expecting ";" or "}" in ${file}:${curLine}`);
  else if (stack.length > 1) conf.errors.push(`unexpected end of file, expecting "}" in ${file}:${tokens[tokens.length - 1]?.line ?? 1}`);
  return conf;
}

// ── time formats ───────────────────────────────────────────────────────────

const p2 = (n: number) => String(n).padStart(2, '0');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 2026/11/18 09:02:00 — the error.log date. */
export function errLogDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}/${p2(d.getUTCMonth() + 1)}/${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`;
}

/** 18/Nov/2026:09:02:00 +0000 — the access.log date. */
export function accessLogDate(ms: number): string {
  const d = new Date(ms);
  return `${p2(d.getUTCDate())}/${MON[d.getUTCMonth()]}/${d.getUTCFullYear()}:${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())} +0000`;
}

/** Wed, 18 Nov 2026 09:00:00 GMT — the Date header. */
export function httpDate(ms: number): string {
  return new Date(ms).toUTCString();
}

// ── servers ────────────────────────────────────────────────────────────────

function errorPage(status: number): string {
  const r = `${status} ${REASONS[status] ?? ''}`;
  return `<html>\r\n<head><title>${r}</title></head>\r\n<body>\r\n<center><h1>${r}</h1></center>\r\n<hr><center>nginx</center>\r\n</body>\r\n</html>\r\n`;
}

function respond(w: World, status: number, body: string, server: string, extra: [string, string][] = [], wait = 0): HttpResponse {
  return {
    status,
    body,
    wait,
    headers: [['Server', server], ['Date', httpDate(w.clock)], ['Content-Type', body.startsWith('<') ? 'text/html' : 'text/plain; charset=utf-8'], ['Content-Length', String(body.length)], ['Connection', 'keep-alive'], ...extra],
  };
}

const IDEMPOTENT = new Set(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS', 'TRACE']);

/** Serve one request on a service (application or nginx). Advances the clock by the server's time. */
export function serveHttp(w: World, io: FileIo | undefined, hostId: string, svc: Service, req: HttpRequest): HttpResponse {
  if (svc.kind === 'nginx' && svc.nginx) return serveNginx(w, io, hostId, svc, req);
  const app = svc.http ?? { routes: {} };
  const server = app.server ?? 'gunicorn';
  if (app.dbDown) {
    const t = app.dbTimeout ?? 30;
    w.clock += t * 1000;
    if (app.log) appendHostFile(w, io, hostId, '/var/log/app.log', `${errLogDate(w.clock)} ERROR db connection refused (after ${t}s) path=${req.path}\n`);
    return respond(w, 500, 'internal error: database unavailable\n', server, [], t);
  }
  const route = app.routes[req.path] ?? app.routes[Object.keys(app.routes).filter((k) => k.endsWith('*') && req.path.startsWith(k.slice(0, -1))).sort((a, b) => b.length - a.length)[0] ?? ''] ?? (req.path === '/' ? undefined : undefined);
  if (!route) return respond(w, 404, 'not found\n', server);
  const delay = route.delay ?? 0.004;
  w.clock += delay * 1000;
  if (app.log) appendHostFile(w, io, hostId, '/var/log/app.log', app.log.replace('{path}', req.path).replace('{delay}', delay.toFixed(1)).replace('{date}', errLogDate(w.clock)) + '\n');
  const extra: [string, string][] = Object.entries(route.headers ?? {});
  if (route.location) extra.push(['Location', route.location.replace('{path}', req.path)]);
  return respond(w, route.status, route.body ?? (route.status >= 300 && route.status < 400 ? '' : 'ok\n'), server, extra, delay);
}

/** The nginx configuration this service runs: the loaded text, or the file on disk if never reloaded. */
export function nginxConfText(w: World, io: FileIo | undefined, hostId: string, svc: Service): string {
  return svc.nginx?.loaded ?? readHostFile(w, io, hostId, svc.nginx?.conf ?? '') ?? '';
}

function serveNginx(w: World, io: FileIo | undefined, hostId: string, svc: Service, req: HttpRequest): HttpResponse {
  const ng = svc.nginx!;
  const conf = parseNginx(nginxConfText(w, io, hostId, svc), ng.conf);
  const vhost = conf.servers.find((s) => s.listen === svc.port && s.serverName.includes(req.host.split(':')[0])) ?? conf.servers.find((s) => s.listen === svc.port) ?? conf.servers[0];
  const t0 = w.clock;
  const access = (status: number, bytes: number, up?: string) =>
    appendHostFile(w, io, hostId, '/var/log/nginx/access.log', `${req.client} - - [${accessLogDate(w.clock)}] "${req.method} ${req.path} HTTP/1.1" ${status} ${bytes} "-" "curl/${CURL_VERSION}"${up ? ` upstream=${up}` : ''}\n`);
  if (!vhost) {
    const r = respond(w, 404, errorPage(404), NGINX_VERSION);
    access(404, r.body.length);
    return r;
  }
  const loc = [...vhost.locations].sort((a, b) => b.path.length - a.path.length).find((l) => req.path.startsWith(l.path)) ?? vhost.locations[0];
  if (loc?.ret) {
    const url = (loc.ret.url ?? '').replace('$host', req.host).replace('$request_uri', req.path).replace('$server_name', vhost.serverName[0] ?? req.host);
    const r = respond(w, loc.ret.code, loc.ret.code >= 300 && loc.ret.code < 400 ? errorPage(loc.ret.code) : '', NGINX_VERSION, url ? [['Location', url]] : []);
    access(r.status, r.body.length);
    return r;
  }
  if (!loc?.proxyPass) {
    const r = respond(w, 200, '<!doctype html><title>Welcome to nginx!</title>\n', NGINX_VERSION);
    access(200, r.body.length);
    return r;
  }
  const target = loc.proxyPass.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const peers: UpstreamServer[] = conf.upstreams[target] ?? [{ addr: target.split(':')[0], port: Number(target.split(':')[1] ?? 80), maxFails: 1, failTimeout: 10 }];
  ng.failedUntil ??= {};
  const key = (s: UpstreamServer) => `${s.addr}:${s.port}`;
  const live = peers.filter((s) => !s.down && !s.backup);
  const order: UpstreamServer[] = [];
  const start = (ng.rr ?? 0) % Math.max(1, live.length);
  ng.rr = (ng.rr ?? 0) + 1;
  for (let i = 0; i < live.length; i++) order.push(live[(start + i) % live.length]);
  const healthy = order.filter((s) => (ng.failedUntil![key(s)] ?? 0) <= w.clock);
  const attempts = healthy.length ? healthy : [];
  const tried: string[] = [];
  const nu = loc.nextUpstream;
  const retryable = (cond: 'error' | 'timeout') => !nu.includes('off') && nu.includes(cond);
  let lastStatus = 502;
  const connNo = 1 + (w.counter % 900);
  const errLine = (msg: string, s: UpstreamServer) => {
    appendHostFile(
      w,
      io,
      hostId,
      '/var/log/nginx/error.log',
      `${errLogDate(w.clock)} [error] ${ng.pid}#${ng.pid}: *${connNo} ${msg}, client: ${req.client}, server: ${vhost.serverName[0] ?? '_'}, request: "${req.method} ${req.path} HTTP/1.1", upstream: "http://${key(s)}${req.path}", host: "${req.host}"\n`,
    );
  };
  if (!attempts.length) {
    appendHostFile(w, io, hostId, '/var/log/nginx/error.log', `${errLogDate(w.clock)} [error] ${ng.pid}#${ng.pid}: *${1 + (w.counter % 900)} no live upstreams while connecting to upstream, client: ${req.client}, server: ${vhost.serverName[0] ?? '_'}, request: "${req.method} ${req.path} HTTP/1.1", upstream: "http://${target}${req.path}", host: "${req.host}"\n`);
    const r = respond(w, 502, errorPage(502), NGINX_VERSION);
    access(502, r.body.length);
    return r;
  }
  for (let i = 0; i < attempts.length; i++) {
    const s = attempts[i];
    tried.push(key(s));
    const c = tcpConnect(w, hostId, s.addr, s.port, { timeoutMs: loc.connectTimeout * 1000 });
    const markFailed = () => {
      if (s.maxFails > 0 && live.length > 1) ng.failedUntil![key(s)] = w.clock + s.failTimeout * 1000;
    };
    if (!c.ok) {
      const cond: 'error' | 'timeout' = c.error === 'timeout' ? 'timeout' : 'error';
      if (c.error === 'timeout') errLine('upstream timed out (110: Connection timed out) while connecting to upstream', s);
      else if (c.error === 'unreachable') errLine('connect() failed (113: No route to host) while connecting to upstream', s);
      else if (c.error === 'no-route') errLine('connect() failed (101: Network is unreachable) while connecting to upstream', s);
      else errLine('connect() failed (111: Connection refused) while connecting to upstream', s);
      markFailed();
      lastStatus = cond === 'timeout' ? 504 : 502;
      if (retryable(cond) && i < attempts.length - 1) continue;
      break;
    }
    const svc2 = c.service!;
    tcpData(w, hostId, s.addr, c.sport, s.port, 80 + req.path.length, `HTTP: ${req.method} ${req.path} HTTP/1.0`);
    const before = w.clock;
    const res = serveHttp(w, io, c.host!, svc2, { ...req, client: c.seenSrc ?? req.client });
    if (res.wait > loc.readTimeout) {
      w.clock = before + loc.readTimeout * 1000;
      errLine('upstream timed out (110: Connection timed out) while reading response header from upstream', s);
      markFailed();
      lastStatus = 504;
      if (retryable('timeout') && IDEMPOTENT.has(req.method) && i < attempts.length - 1) continue;
      break;
    }
    tcpData(w, c.host!, c.seenSrc ?? "", s.port, c.sport, res.body.length + 120, `HTTP: HTTP/1.1 ${res.status} ${REASONS[res.status] ?? ''}`);
    if (nu.includes(`http_${res.status}`) && i < attempts.length - 1 && IDEMPOTENT.has(req.method)) {
      lastStatus = res.status;
      continue;
    }
    const out: HttpResponse = { ...res, headers: [['Server', NGINX_VERSION], ...res.headers.filter(([k]) => k !== 'Server')], wait: (w.clock - t0) / 1000, upstreamAddr: tried.join(', ') };
    access(out.status, out.body.length, out.upstreamAddr);
    return out;
  }
  const r = respond(w, lastStatus, errorPage(lastStatus), NGINX_VERSION, [], (w.clock - t0) / 1000);
  r.upstreamAddr = tried.join(', ');
  access(r.status, r.body.length, r.upstreamAddr);
  return r;
}

// ── TLS certificate checks (what curl reports) ─────────────────────────────

export type TlsError = 'expired' | 'not-yet-valid' | 'name-mismatch' | 'untrusted-chain' | 'self-signed';

/** Wildcard matching as RFC 6125: *.example.com matches one label. */
export function nameMatches(pattern: string, host: string): boolean {
  const p = pattern.toLowerCase();
  const h = host.toLowerCase();
  if (p === h) return true;
  if (p.startsWith('*.')) {
    const rest = p.slice(2);
    const dot = h.indexOf('.');
    return dot > 0 && h.slice(dot + 1) === rest;
  }
  return false;
}

export function checkCert(cert: Cert, host: string, now = COURSE_DATE): TlsError | undefined {
  if (cert.chain === 'self-signed') return 'self-signed';
  if (cert.chain === 'incomplete') return 'untrusted-chain';
  if (Date.parse(cert.notAfter) < now) return 'expired';
  if (Date.parse(cert.notBefore) > now) return 'not-yet-valid';
  if (!cert.san.some((n) => nameMatches(n, host))) return 'name-mismatch';
  return undefined;
}

export const CURL_TLS_MESSAGE: Record<TlsError, string> = {
  expired: 'SSL certificate problem: certificate has expired',
  'not-yet-valid': 'SSL certificate problem: certificate is not yet valid',
  'name-mismatch': "SSL: no alternative certificate subject name matches target host name '{host}'",
  'untrusted-chain': 'SSL certificate problem: unable to get local issuer certificate',
  'self-signed': 'SSL certificate problem: self-signed certificate',
};

/** "Nov 30 23:59:59 2026 GMT" as curl prints certificate dates. */
export function certDate(iso: string): string {
  const d = new Date(iso);
  return `${MON[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, ' ')} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())} ${d.getUTCFullYear()} GMT`;
}
