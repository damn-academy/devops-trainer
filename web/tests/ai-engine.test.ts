import { describe, expect, it } from 'vitest';
import { AiError, chat, classifyHttp, deltaOf, listModels, SseParser, streamChat, testEndpoint, type Fetch } from '../src/engine/ai/client';
import { AiEngine } from '../src/engine/ai/engine';
import { KeyStore, MemoryKv } from '../src/engine/ai/keystore';
import { isLocalUrl, normalizeBase, ollamaCommands, PROVIDERS } from '../src/engine/ai/providers';

const chunk = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

/** A fetch that answers chat requests with an SSE stream split at awkward places. */
function sseFetch(parts: string[], seen: { url?: string; init?: RequestInit }[] = []): Fetch {
  return (async (url: string, init?: RequestInit) => {
    seen.push({ url, init });
    const body = parts.map(chunk).join('') + 'data: [DONE]\n\n';
    const bytes = new TextEncoder().encode(body);
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7));
        c.close();
      },
    });
    return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }) as Fetch;
}

const errFetch = (status: number, body: string): Fetch => (async () => new Response(body, { status })) as Fetch;

describe('SSE and chunks', () => {
  it('splits events and joins multi-line data', () => {
    const p = new SseParser();
    expect(p.feed('data: a\n\nda')).toEqual(['a']);
    expect(p.feed('ta: b\r\ndata: c\r\n\r\n: comment\n\n')).toEqual(['b\nc']);
    expect(p.feed('data: tail')).toEqual([]);
    expect(p.flush()).toEqual(['tail']);
  });

  it('reads deltas, [DONE] and errors in the stream', () => {
    expect(deltaOf(JSON.stringify({ choices: [{ delta: { content: 'hi' } }] }))).toBe('hi');
    expect(deltaOf(JSON.stringify({ choices: [{ delta: { role: 'assistant' } }] }))).toBe('');
    expect(deltaOf('[DONE]')).toBeNull();
    expect(() => deltaOf(JSON.stringify({ error: { message: 'Insufficient Balance' } }))).toThrow(AiError);
  });

  it('classifies HTTP errors into human categories', () => {
    expect(classifyHttp(401, '{"error":{"message":"Invalid API key"}}')).toBe('auth');
    expect(classifyHttp(402, '')).toBe('quota');
    expect(classifyHttp(429, '{"error":{"code":"insufficient_quota"}}')).toBe('quota');
    expect(classifyHttp(429, 'Rate limit reached')).toBe('rate');
    expect(classifyHttp(404, '{"error":{"message":"The model `x` does not exist"}}')).toBe('model');
    expect(classifyHttp(404, 'Not Found')).toBe('bad-url');
    expect(classifyHttp(503, '')).toBe('server');
  });
});

describe('streamChat', () => {
  const ep = { baseUrl: 'https://api.example.com/v1/', model: 'm', key: 'sk-test' };

  it('posts an OpenAI chat request with stream: true and yields deltas', async () => {
    const seen: { url?: string; init?: RequestInit }[] = [];
    const out: string[] = [];
    for await (const d of streamChat(ep, { messages: [{ role: 'user', content: 'q' }], maxTokens: 10, temperature: 0.3 }, undefined, sseFetch(['Hel', 'lo, ', 'мир'], seen))) out.push(d);
    expect(out.join('')).toBe('Hello, мир');
    expect(seen[0].url).toBe('https://api.example.com/v1/chat/completions');
    const body = JSON.parse(String(seen[0].init?.body));
    expect(body).toMatchObject({ model: 'm', stream: true, max_tokens: 10 });
    expect((seen[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
  });

  it('accepts a non-streamed JSON answer', async () => {
    const f = (async () => new Response(JSON.stringify({ choices: [{ message: { content: 'whole' } }] }), { headers: { 'content-type': 'application/json' } })) as Fetch;
    expect(await chat(ep, { messages: [], maxTokens: 5, temperature: 0 }, undefined, f)).toBe('whole');
  });

  it('turns failures into codes', async () => {
    await expect(chat(ep, { messages: [], maxTokens: 5, temperature: 0 }, undefined, errFetch(401, 'Unauthorized'))).rejects.toMatchObject({ code: 'auth', status: 401 });
    const boom = (async () => {
      throw new TypeError('Failed to fetch');
    }) as Fetch;
    await expect(chat(ep, { messages: [], maxTokens: 5, temperature: 0 }, undefined, boom)).rejects.toMatchObject({ code: 'cors' });
    await expect(chat({ ...ep, baseUrl: 'http://localhost:11434/v1' }, { messages: [], maxTokens: 5, temperature: 0 }, undefined, boom)).rejects.toMatchObject({ code: 'local-down' });
    await expect(chat({ ...ep, baseUrl: 'http://evil.example/v1' }, { messages: [], maxTokens: 5, temperature: 0 }, undefined, boom)).rejects.toMatchObject({ code: 'bad-url' });
  });

  it('measures the connection check and notices streaming', async () => {
    let t = 0;
    const r = await testEndpoint(ep, sseFetch(['re', 'ady']), () => (t += 50));
    expect(r).toMatchObject({ ok: true, streamed: true, text: 'ready' });
    expect(r.firstMs).toBeGreaterThan(0);
    expect((await testEndpoint(ep, errFetch(402, ''))).error).toBe('quota');
  });

  it('lists models from both OpenAI and Ollama shapes', async () => {
    const f = (async () => new Response(JSON.stringify({ data: [{ id: 'b' }, { id: 'a' }], models: [{ name: 'qwen2.5:7b' }] }))) as Fetch;
    expect(await listModels(ep, f)).toEqual(['a', 'b', 'qwen2.5:7b']);
  });
});

describe('providers', () => {
  it('has the presets of the design and clean URLs', () => {
    expect(PROVIDERS.map((p) => p.id)).toEqual(['deepseek', 'openrouter', 'openai', 'ollama', 'custom']);
    expect(normalizeBase('https://x.io/v1/chat/completions/')).toBe('https://x.io/v1');
    expect(isLocalUrl('http://127.0.0.1:11434/v1')).toBe(true);
    expect(isLocalUrl('https://api.deepseek.com')).toBe(false);
    expect(ollamaCommands('https://course.example').map((c) => c.os)).toEqual(['macOS', 'Linux', 'Windows']);
    expect(ollamaCommands('https://course.example')[0].cmd).toContain('OLLAMA_ORIGINS "https://course.example"');
  });
});

describe('KeyStore', () => {
  it('stores the key encrypted under a non-extractable AES-GCM key', async () => {
    const kv = new MemoryKv();
    const ks = new KeyStore(kv);
    await ks.put('sk-secret-123', true);
    const wrap = kv.map.get('wrap-key') as CryptoKey;
    expect(wrap.extractable).toBe(false);
    expect(wrap.algorithm).toMatchObject({ name: 'AES-GCM' });
    await expect(crypto.subtle.exportKey('raw', wrap)).rejects.toBeTruthy();
    const sealed = kv.map.get('api-key') as { data: ArrayBuffer };
    expect(new TextDecoder().decode(sealed.data)).not.toContain('sk-secret');
    // A new tab: nothing in memory, the key is decrypted from the store.
    expect(await new KeyStore(kv).get()).toBe('sk-secret-123');
  });

  it('keeps the key only in memory when told not to remember', async () => {
    const kv = new MemoryKv();
    const ks = new KeyStore(kv);
    await ks.put('sk-remembered', true);
    await ks.put('sk-tab-only', false);
    expect(await ks.get()).toBe('sk-tab-only');
    expect(await ks.stored()).toBe(false);
    expect(await new KeyStore(kv).get()).toBeNull();
  });

  it('forgets everything', async () => {
    const kv = new MemoryKv();
    const ks = new KeyStore(kv);
    await ks.put('sk-x', true);
    await ks.forget();
    expect(kv.map.size).toBe(0);
    expect(await ks.get()).toBeNull();
  });
});

describe('AiEngine', () => {
  it('configures, streams, and refuses while an exam is on', async () => {
    const seen: { url?: string; init?: RequestInit }[] = [];
    const e = new AiEngine(new MemoryKv(), sseFetch(['an', 'swer'], seen));
    expect((await e.status()).configured).toBe(false);
    const st = await e.configure({ provider: 'deepseek', baseUrl: '', model: 'deepseek-flash', remember: true }, ' sk-abc ');
    expect(st).toMatchObject({ configured: true, hasKey: true, settings: { baseUrl: 'https://api.deepseek.com' } });
    const deltas: string[] = [];
    expect(await e.chat(1, { messages: [{ role: 'user', content: 'q' }], maxTokens: 10, temperature: 0 }, (d) => deltas.push(d))).toBe('answer');
    expect(deltas).toEqual(['an', 'swer']);
    expect((seen[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer sk-abc');
    e.lock(true);
    await expect(e.chat(2, { messages: [], maxTokens: 1, temperature: 0 }, () => {})).rejects.toMatchObject({ code: 'locked' });
    e.lock(false);
    expect((await e.forget()).configured).toBe(false);
  });

  it('keeps the old key when settings change without a new one, and Ollama needs none', async () => {
    const e = new AiEngine(new MemoryKv(), sseFetch(['ok']));
    await e.configure({ provider: 'openrouter', baseUrl: '', model: 'x', remember: true }, 'sk-or');
    expect((await e.configure({ provider: 'openrouter', baseUrl: '', model: 'y', remember: false })).hasKey).toBe(true);
    const ol = new AiEngine(new MemoryKv(), sseFetch(['ok']));
    expect((await ol.configure({ provider: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5:7b', remember: true })).configured).toBe(true);
    expect((await ol.test()).ok).toBe(true);
  });

  it('reports a missing provider as a code, not a crash', async () => {
    const e = new AiEngine(new MemoryKv(), sseFetch([]));
    expect((await e.test()).error).toBe('no-provider');
  });
});
