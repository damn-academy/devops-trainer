// HTTP/1.1 over the lab host's TCP: an incremental message parser
// (Content-Length, chunked, close-delimited; Expect: 100-continue), a server
// loop with keep-alive and pipelining, a client for the load balancer and
// webhooks, and a virtual-host mux (by Host header and by local address).

import type { LabHost } from './host';
import type { TcpConn } from './tcp';
import { concat, dec, ipToNum, numToIp, utf8 } from './wire';

export interface HttpRequest {
  method: string;
  /** The raw request target: '/v1/projects?limit=5'. */
  target: string;
  path: string;
  query: URLSearchParams;
  version: string;
  /** Lowercase names; repeated headers joined with ', '. */
  headers: Record<string, string>;
  body: Uint8Array;
  /** Host header without the port, lowercase. */
  host: string;
  remote: { ip: string; port: number };
  local: { ip: string; port: number };
  vlan: number;
}

export interface HttpResponse {
  status: number;
  headers?: Record<string, string>;
  body?: Uint8Array | string;
}

export type HttpHandler = (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;

export const REASON: Record<number, string> = {
  100: 'Continue',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  206: 'Partial Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  411: 'Length Required',
  412: 'Precondition Failed',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  416: 'Range Not Satisfiable',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export const MAX_BODY = 64 * 1024 * 1024;

export interface ParsedMessage {
  /** Request: method, target; response: status, reason. */
  start: [string, string, string];
  headers: Record<string, string>;
  body: Uint8Array;
}

type Phase = 'head' | 'body' | 'chunk-size' | 'chunk-data' | 'chunk-crlf' | 'trailer' | 'until-close';

/**
 * An incremental HTTP/1.x message parser. Feed bytes; complete messages come
 * out of `feed`. For responses, `noBody(status, method)` rules apply.
 */
export class HttpParser {
  private buf: Uint8Array = new Uint8Array(0);
  private phase: Phase = 'head';
  private cur: { start: [string, string, string]; headers: Record<string, string> } | null = null;
  private need = 0;
  private parts: Uint8Array[] = [];
  private size = 0;
  /** Set for a request with Expect: 100-continue once its head is in. */
  onContinue: (() => void) | null = null;
  error: string | null = null;

  constructor(
    private kind: 'request' | 'response',
    /** For responses: the method of the request it answers (HEAD has no body). */
    public method = 'GET',
  ) {}

  feed(data: Uint8Array): ParsedMessage[] {
    const out: ParsedMessage[] = [];
    this.buf = this.buf.length ? concat([this.buf, data]) : data;
    for (;;) {
      if (this.error) return out;
      const m = this.step();
      if (m === 'more') break;
      if (m) out.push(m);
    }
    return out;
  }

  /** The connection closed: a close-delimited body ends here. */
  end(): ParsedMessage | null {
    if (this.phase === 'until-close' && this.cur) {
      this.parts.push(this.buf);
      this.buf = new Uint8Array(0);
      return this.finish();
    }
    return null;
  }

  private finish(): ParsedMessage {
    const m = { start: this.cur!.start, headers: this.cur!.headers, body: concat(this.parts) };
    this.cur = null;
    this.parts = [];
    this.size = 0;
    this.phase = 'head';
    return m;
  }

  private line(): string | null {
    for (let i = 0; i + 1 < this.buf.length; i++)
      if (this.buf[i] === 13 && this.buf[i + 1] === 10) {
        const s = dec.decode(this.buf.subarray(0, i));
        this.buf = this.buf.subarray(i + 2);
        return s;
      }
    return null;
  }

  private step(): ParsedMessage | null | 'more' {
    switch (this.phase) {
      case 'head': {
        let end = -1;
        for (let i = 0; i + 3 < this.buf.length; i++)
          if (this.buf[i] === 13 && this.buf[i + 1] === 10 && this.buf[i + 2] === 13 && this.buf[i + 3] === 10) {
            end = i;
            break;
          }
        if (end < 0) {
          if (this.buf.length > 64 * 1024) this.error = 'header too large';
          return 'more';
        }
        const text = dec.decode(this.buf.subarray(0, end));
        this.buf = this.buf.subarray(end + 4);
        const lines = text.split('\r\n');
        // Tolerate empty lines before a request (RFC 9112 §2.2).
        while (lines.length && !lines[0]) lines.shift();
        const first = lines.shift() ?? '';
        let start: [string, string, string];
        if (this.kind === 'request') {
          const m = /^([A-Z]+) (\S+) (HTTP\/1\.[01])$/.exec(first);
          if (!m) {
            this.error = `bad request line: ${first.slice(0, 80)}`;
            return null;
          }
          start = [m[1], m[2], m[3]];
        } else {
          const m = /^(HTTP\/1\.[01]) (\d{3}) ?(.*)$/.exec(first);
          if (!m) {
            this.error = `bad status line: ${first.slice(0, 80)}`;
            return null;
          }
          start = [m[2], m[3], m[1]];
        }
        const headers: Record<string, string> = {};
        for (const l of lines) {
          const i = l.indexOf(':');
          if (i <= 0) continue;
          const k = l.slice(0, i).trim().toLowerCase();
          const v = l.slice(i + 1).trim();
          headers[k] = headers[k] !== undefined ? `${headers[k]}, ${v}` : v;
        }
        this.cur = { start, headers };
        const te = (headers['transfer-encoding'] ?? '').toLowerCase();
        if (this.kind === 'response') {
          const st = Number(start[0]);
          if (this.method === 'HEAD' || st === 204 || st === 304 || (st >= 100 && st < 200)) {
            if (st >= 100 && st < 200) {
              this.cur = null;
              return null;
            }
            return this.finish();
          }
        }
        if (te.includes('chunked')) {
          this.phase = 'chunk-size';
        } else if (headers['content-length'] !== undefined) {
          const n = Number(headers['content-length']);
          if (!Number.isFinite(n) || n < 0) {
            this.error = 'bad Content-Length';
            return null;
          }
          if (n > MAX_BODY) {
            this.error = 'body too large';
            return null;
          }
          this.need = n;
          this.phase = 'body';
        } else if (this.kind === 'response') {
          this.phase = 'until-close';
          return 'more';
        } else return this.finish();
        if (this.kind === 'request' && (headers['expect'] ?? '').toLowerCase() === '100-continue') this.onContinue?.();
        return null;
      }
      case 'body': {
        const n = Math.min(this.need, this.buf.length);
        if (n) {
          this.parts.push(this.buf.slice(0, n));
          this.buf = this.buf.subarray(n);
          this.need -= n;
        }
        if (this.need > 0) return 'more';
        return this.finish();
      }
      case 'chunk-size': {
        const l = this.line();
        if (l === null) return 'more';
        const n = parseInt(l.split(';')[0].trim(), 16);
        if (!Number.isFinite(n) || n < 0) {
          this.error = 'bad chunk size';
          return null;
        }
        if (n === 0) {
          this.phase = 'trailer';
          return null;
        }
        this.size += n;
        if (this.size > MAX_BODY) {
          this.error = 'body too large';
          return null;
        }
        this.need = n;
        this.phase = 'chunk-data';
        return null;
      }
      case 'chunk-data': {
        const n = Math.min(this.need, this.buf.length);
        if (n) {
          this.parts.push(this.buf.slice(0, n));
          this.buf = this.buf.subarray(n);
          this.need -= n;
        }
        if (this.need > 0) return 'more';
        this.phase = 'chunk-crlf';
        return null;
      }
      case 'chunk-crlf': {
        const l = this.line();
        if (l === null) return 'more';
        this.phase = 'chunk-size';
        return null;
      }
      case 'trailer': {
        const l = this.line();
        if (l === null) return 'more';
        if (l === '') return this.finish();
        return null;
      }
      case 'until-close':
        this.parts.push(this.buf);
        this.buf = new Uint8Array(0);
        return 'more';
    }
  }
}

export function serializeResponse(r: HttpResponse, o: { head?: boolean; close?: boolean } = {}): Uint8Array {
  const body = r.body === undefined ? new Uint8Array(0) : typeof r.body === 'string' ? utf8(r.body) : r.body;
  const h: Record<string, string> = { server: 'lab-host/1.0', date: new Date().toUTCString(), ...lower(r.headers ?? {}) };
  if (r.status !== 204 && r.status !== 304) h['content-length'] = String(body.length);
  if (o.close) h['connection'] = 'close';
  let head = `HTTP/1.1 ${r.status} ${REASON[r.status] ?? 'Unknown'}\r\n`;
  for (const [k, v] of Object.entries(h)) head += `${canon(k)}: ${v}\r\n`;
  head += '\r\n';
  return o.head || r.status === 204 || r.status === 304 ? utf8(head) : concat([utf8(head), body]);
}

export function serializeRequest(r: { method: string; target: string; headers: Record<string, string>; body?: Uint8Array | string }): Uint8Array {
  const body = r.body === undefined ? new Uint8Array(0) : typeof r.body === 'string' ? utf8(r.body) : r.body;
  const h = lower(r.headers);
  if (body.length || ['POST', 'PUT', 'PATCH'].includes(r.method)) h['content-length'] = String(body.length);
  let head = `${r.method} ${r.target} HTTP/1.1\r\n`;
  for (const [k, v] of Object.entries(h)) head += `${canon(k)}: ${v}\r\n`;
  return concat([utf8(head + '\r\n'), body]);
}

function lower(h: Record<string, string>): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) o[k.toLowerCase()] = v;
  return o;
}

function canon(k: string): string {
  if (k === 'etag') return 'ETag';
  return k.replace(/(^|-)([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
}

export interface HttpLogEntry {
  at: number;
  vlan: number;
  from: string;
  host: string;
  method: string;
  target: string;
  status: number;
  ms: number;
  reqBytes: number;
  resBytes: number;
}

/** Serve HTTP on one accepted connection. */
export function serveConn(c: TcpConn, handler: HttpHandler, log?: (e: HttpLogEntry) => void, now: () => number = () => Date.now()): void {
  const parser = new HttpParser('request');
  parser.onContinue = () => c.write('HTTP/1.1 100 Continue\r\n\r\n');
  const queue: ParsedMessage[] = [];
  let busy = false;
  let peerDone = false;
  const pump = async () => {
    if (busy) return;
    busy = true;
    while (queue.length) {
      const m = queue.shift()!;
      const t0 = now();
      const [method, target, version] = m.start;
      const close = (m.headers['connection'] ?? '').toLowerCase() === 'close' || (version === 'HTTP/1.0' && (m.headers['connection'] ?? '').toLowerCase() !== 'keep-alive');
      const qi = target.indexOf('?');
      let path = qi < 0 ? target : target.slice(0, qi);
      if (/^https?:\/\//.test(path)) path = '/' + path.replace(/^https?:\/\/[^/]*\/?/, '');
      let decodedPath = path;
      try {
        decodedPath = decodeURIComponent(path);
      } catch {
        /* keep raw */
      }
      const req: HttpRequest = {
        method,
        target,
        path: decodedPath,
        query: new URLSearchParams(qi < 0 ? '' : target.slice(qi + 1)),
        version,
        headers: m.headers,
        body: m.body,
        host: (m.headers['host'] ?? '').replace(/:\d+$/, '').toLowerCase(),
        remote: { ip: numToIp(c.remote.ip), port: c.remote.port },
        local: { ip: numToIp(c.local.ip), port: c.local.port },
        vlan: c.vlan,
      };
      let res: HttpResponse;
      try {
        res = await handler(req);
      } catch (e) {
        res = { status: 500, headers: { 'content-type': 'text/plain' }, body: `internal error: ${(e as Error).message}\n` };
      }
      const bytes = serializeResponse(res, { head: method === 'HEAD', close });
      if (c.state === 'CLOSED') break;
      c.write(bytes);
      log?.({ at: t0, vlan: c.vlan, from: req.remote.ip, host: req.host || req.local.ip, method, target, status: res.status, ms: now() - t0, reqBytes: m.body.length, resBytes: bytes.length });
      if (close) {
        c.end();
        queue.length = 0;
        break;
      }
    }
    busy = false;
    if (peerDone && !queue.length) c.end();
  };
  c.onData((d) => {
    const msgs = parser.feed(d);
    if (parser.error) {
      c.write(serializeResponse({ status: 400, headers: { 'content-type': 'text/plain' }, body: `${parser.error}\n` }, { close: true }));
      c.end();
      return;
    }
    queue.push(...msgs);
    void pump();
  });
  c.onEnd(() => {
    peerDone = true;
    if (!busy) c.end();
  });
}

/** Serve HTTP on a port of the host. */
export function serveHttp(host: LabHost, port: number, handler: HttpHandler, o: { accept?: (local: number, vlan: number) => boolean; log?: (e: HttpLogEntry) => void } = {}): () => void {
  return host.listen({ port, accept: o.accept, onConn: (c) => serveConn(c, handler, o.log, () => host.clock.now()) });
}

export interface ClientResponse {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
}

/** One HTTP request from the lab host to a machine (new connection, Connection: close). */
export async function httpRequest(
  host: LabHost,
  o: { ip: string; port: number; method?: string; target: string; headers?: Record<string, string>; body?: Uint8Array | string; vlan?: number; timeoutMs?: number },
): Promise<ClientResponse> {
  const c = await host.connect(ipToNum(o.ip), o.port, { vlan: o.vlan, timeoutMs: o.timeoutMs ?? 3000 });
  const method = o.method ?? 'GET';
  const parser = new HttpParser('response', method);
  return new Promise((resolve, reject) => {
    const timer = host.clock.setTimeout(() => {
      c.destroy('timeout');
      reject(new Error(`${method} http://${o.ip}:${o.port}${o.target}: timed out`));
    }, o.timeoutMs ?? 10000);
    let done = false;
    const finish = (m: ParsedMessage | null, err?: string) => {
      if (done) return;
      done = true;
      host.clock.clearTimeout(timer);
      if (m) resolve({ status: Number(m.start[0]), headers: m.headers, body: m.body });
      else reject(new Error(err ?? 'connection closed before a response'));
      if (c.state !== 'CLOSED') c.end();
    };
    c.onData((d) => {
      const msgs = parser.feed(d);
      if (parser.error) finish(null, parser.error);
      else if (msgs.length) finish(msgs[0]);
    });
    c.onEnd(() => finish(parser.end()));
    c.onClose((err) => finish(parser.end(), err));
    c.write(serializeRequest({ method, target: o.target, headers: { host: o.ip, 'user-agent': 'lab-host/1.0', connection: 'close', ...(o.headers ?? {}) }, body: o.body }));
  });
}

// ── virtual hosts ──

export interface Route {
  /** Host names (exact or '*.suffix'). */
  hosts?: string[];
  /** Local addresses (the request arrived at this IP). */
  ips?: string[];
  handler: HttpHandler;
}

export class HttpMux {
  private routes: Route[] = [];
  fallback: HttpHandler = (req) => ({ status: 404, headers: { 'content-type': 'text/plain' }, body: `no service for host ${req.host || req.local.ip}\n` });

  add(r: Route): () => void {
    this.routes.push(r);
    return () => {
      this.routes = this.routes.filter((x) => x !== r);
    };
  }

  match(req: HttpRequest): Route | undefined {
    // A route bound to an address wins: a VIP or 169.254.169.254 answers whatever the Host header says.
    const byIp = this.routes.find((r) => r.ips?.includes(req.local.ip));
    if (byIp) return byIp;
    const h = req.host;
    return this.routes.find((r) => r.hosts?.some((x) => (x.startsWith('*.') ? h.endsWith(x.slice(1)) : x === h)));
  }

  handle: HttpHandler = (req) => (this.match(req)?.handler ?? this.fallback)(req);
}

export function json(status: number, body: unknown, headers: Record<string, string> = {}): HttpResponse {
  return { status, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? '' : JSON.stringify(body, null, 2) + '\n' };
}

export function text(status: number, body: string, headers: Record<string, string> = {}): HttpResponse {
  return { status, headers: { 'content-type': 'text/plain; charset=utf-8', ...headers }, body };
}
