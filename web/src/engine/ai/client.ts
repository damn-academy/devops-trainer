// OpenAI-compatible Chat Completions over fetch, with streaming parsed by hand
// (09 §4.2): no SDK, one request, Server-Sent Events read line by line from the
// response body. Errors come back as codes; the interface turns them into
// human sentences in the learner's language.

import { isLocalUrl, normalizeBase } from './providers';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
}

export interface Endpoint {
  api?: 'anthropic';
  baseUrl: string;
  model: string;
  key?: string;
  headers?: Record<string, string>;
}

export type AiErrorCode = 'auth' | 'quota' | 'rate' | 'model' | 'bad-url' | 'cors' | 'local-down' | 'server' | 'empty' | 'aborted' | 'locked' | 'no-provider' | 'other';

export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    readonly detail = '',
    readonly status?: number,
  ) {
    super(`${code}${status ? ` (${status})` : ''}${detail ? `: ${detail}` : ''}`);
  }
}

/** Splits an SSE byte stream into `data:` payloads (events end with a blank line). */
export class SseParser {
  private buf = '';
  feed(chunk: string): string[] {
    this.buf += chunk.replace(/\r\n?/g, '\n');
    const out: string[] = [];
    let i: number;
    while ((i = this.buf.indexOf('\n\n')) >= 0) {
      const event = this.buf.slice(0, i);
      this.buf = this.buf.slice(i + 2);
      const data = event
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).replace(/^ /, ''))
        .join('\n');
      if (data) out.push(data);
    }
    return out;
  }
  /** What is left when the stream closes without a final blank line. */
  flush(): string[] {
    const rest = this.buf;
    this.buf = '';
    return rest ? this.feed(rest + '\n\n') : [];
  }
}

/** Text deltas of one chat.completion.chunk payload; null at [DONE]. */
export function deltaOf(payload: string): string | null {
  if (payload.trim() === '[DONE]') return null;
  try {
    const j = JSON.parse(payload) as { choices?: { delta?: { content?: string | null }; message?: { content?: string } }[]; error?: { message?: string; code?: string | number } };
    if (j.error) throw new AiError(classifyBody(String(j.error.code ?? ''), j.error.message ?? ''), j.error.message ?? '');
    return j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content ?? '';
  } catch (e) {
    if (e instanceof AiError) throw e;
    return '';
  }
}

function classifyBody(code: string, message: string): AiErrorCode {
  const s = `${code} ${message}`.toLowerCase();
  if (/insufficient_quota|insufficient balance|insufficient_balance|payment|credits/.test(s)) return 'quota';
  if (/model.*(not|does not|doesn't) exist|model_not_found|unknown model|invalid model|no such model|not a valid model/.test(s)) return 'model';
  if (/rate.?limit/.test(s)) return 'rate';
  if (/api key|unauthori[sz]ed|invalid_api_key|authentication/.test(s)) return 'auth';
  return 'other';
}

/** Map an HTTP error response to a code. */
export function classifyHttp(status: number, body: string): AiErrorCode {
  const fromBody = classifyBody('', body);
  if (status === 401 || status === 403) return fromBody === 'quota' ? 'quota' : 'auth';
  if (status === 402) return 'quota';
  if (status === 429) return fromBody === 'quota' ? 'quota' : 'rate';
  if (status === 404) return fromBody === 'model' ? 'model' : 'bad-url';
  if (status === 400 && fromBody !== 'other') return fromBody;
  if (status >= 500) return 'server';
  return fromBody;
}

function headers(ep: Endpoint): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...(ep.headers ?? {}) };
  if (ep.api === 'anthropic') {
    h['anthropic-version'] = '2023-06-01';
    h['anthropic-dangerous-direct-browser-access'] = 'true';
    if (ep.key) h['x-api-key'] = ep.key;
    return h;
  }
  if (ep.key) h.Authorization = `Bearer ${ep.key}`;
  return h;
}

function checkUrl(base: string): string {
  const b = normalizeBase(base);
  try {
    const u = new URL(b);
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && isLocalUrl(b))) throw new AiError('bad-url', 'only https:// or http://localhost');
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError('bad-url', base);
  }
  return b;
}

function networkError(e: unknown, base: string, signal?: AbortSignal): AiError {
  if (signal?.aborted || (e as Error)?.name === 'AbortError') return new AiError('aborted');
  if (e instanceof AiError) return e;
  // A TypeError from fetch is all the browser tells: blocked by CORS, refused, offline.
  return new AiError(isLocalUrl(base) ? 'local-down' : 'cors', (e as Error)?.message ?? '');
}

export type Fetch = typeof fetch;

/** Stream the answer: yields text deltas as they arrive. */
export async function* streamChat(ep: Endpoint, req: ChatRequest, signal?: AbortSignal, f: Fetch = fetch): AsyncGenerator<string> {
  const base = checkUrl(ep.baseUrl);
  let res: Response;
  try {
    res = await f(`${base}/${ep.api === 'anthropic' ? 'messages' : 'chat/completions'}`, {
      method: 'POST',
      headers: headers(ep),
      body: JSON.stringify({ model: ep.model, ...(ep.api === 'anthropic' ? { system: req.messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n'), messages: req.messages.filter(m => m.role !== 'system') } : { messages: req.messages }), max_tokens: req.maxTokens, temperature: req.temperature, stream: true }),
      signal,
    });
  } catch (e) {
    throw networkError(e, base, signal);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new AiError(classifyHttp(res.status, body), body.slice(0, 300), res.status);
  }
  const type = res.headers.get('content-type') ?? '';
  if (!res.body || !type.includes('event-stream')) {
    // Some gateways ignore stream: true and answer with one JSON object.
    const text = ep.api === 'anthropic' ? anthropicDelta(await res.text()) : deltaOf(await res.text());
    if (text) yield text;
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  const sse = new SseParser();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      const payloads = done ? sse.flush() : sse.feed(dec.decode(value, { stream: true }));
      for (const p of payloads) {
        const d = ep.api === 'anthropic' ? anthropicDelta(p) : deltaOf(p);
        if (d === null) return;
        if (d) yield d;
      }
      if (done) return;
    }
  } catch (e) {
    throw networkError(e, base, signal);
  } finally {
    reader.releaseLock?.();
  }
}

/** The whole answer as one string. */
export async function chat(ep: Endpoint, req: ChatRequest, signal?: AbortSignal, f: Fetch = fetch): Promise<string> {
  let out = '';
  for await (const d of streamChat(ep, req, signal, f)) out += d;
  return out;
}

/** GET /models where the provider has it. */
export async function listModels(ep: Endpoint, f: Fetch = fetch): Promise<string[]> {
  const base = checkUrl(ep.baseUrl);
  let res: Response;
  try {
    res = await f(`${base}/models`, { headers: headers(ep) });
  } catch (e) {
    throw networkError(e, base);
  }
  if (!res.ok) throw new AiError(classifyHttp(res.status, await res.text().catch(() => '')), '', res.status);
  const j = (await res.json()) as { data?: { id: string }[]; models?: { name?: string; id?: string }[] };
  const ids = (j.data ?? []).map((m) => m.id).concat((j.models ?? []).map((m) => m.id ?? m.name ?? ''));
  return [...new Set(ids.filter(Boolean))].sort();
}

export interface TestResult {
  ok: boolean;
  ms: number;
  /** Time to the first streamed piece of text. */
  firstMs?: number;
  /** More than one delta arrived: streaming really works. */
  streamed: boolean;
  text: string;
  error?: AiErrorCode;
  detail?: string;
}

/** The "Check" button: a one-word question, latency and streaming (09 §4.1). */
export async function testEndpoint(ep: Endpoint, f: Fetch = fetch, now: () => number = () => performance.now()): Promise<TestResult> {
  const t0 = now();
  let firstMs: number | undefined;
  let parts = 0;
  let text = '';
  try {
    for await (const d of streamChat(ep, { messages: [{ role: 'user', content: 'Reply with one word: ready' }], maxTokens: 8, temperature: 0 }, undefined, f)) {
      firstMs ??= Math.round(now() - t0);
      parts++;
      text += d;
    }
    if (!text.trim()) return { ok: false, ms: Math.round(now() - t0), streamed: false, text, error: 'empty' };
    return { ok: true, ms: Math.round(now() - t0), firstMs, streamed: parts > 1, text: text.trim() };
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError('other', (e as Error).message);
    return { ok: false, ms: Math.round(now() - t0), streamed: false, text, error: err.code, detail: err.detail };
  }
}

export function anthropicDelta(payload: string): string | null {
  const j = JSON.parse(payload);
  if (j.type === 'error') throw new AiError(classifyBody(j.error?.type ?? '', j.error?.message ?? ''), j.error?.message ?? '');
  if (j.type === 'message_stop') return null;
  if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta') return j.delta.text;
  return j.content?.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('') ?? '';
}
