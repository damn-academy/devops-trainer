// The AI engine: settings, the key and the requests. It runs inside
// ai.worker.ts (09 §4.2), so after the learner types the key the page never
// holds it again; tests drive it directly with an in-memory store and a fake
// fetch. While an exam attempt is on, the engine refuses every chat request.

import { AiError, listModels, streamChat, testEndpoint, type ChatRequest, type Endpoint, type Fetch, type TestResult } from './client';
import { KeyStore, type Kv } from './keystore';
import { normalizeBase, preset, type ProviderId } from './providers';

export interface AiSettings {
  provider: ProviderId;
  baseUrl: string;
  model: string;
  /** Keep the key encrypted in IndexedDB; false keeps it in worker memory until the tab closes. */
  remember: boolean;
}

export interface AiStatus {
  configured: boolean;
  hasKey: boolean;
  settings: AiSettings | null;
  locked: boolean;
}

const SETTINGS = 'settings';

export class AiEngine {
  private keys: KeyStore;
  private settings: AiSettings | null = null;
  private loaded = false;
  private locked = false;
  private aborts = new Map<number, AbortController>();

  constructor(
    private kv: Kv,
    private f: Fetch = (...a) => fetch(...a),
    subtle?: SubtleCrypto,
  ) {
    this.keys = new KeyStore(kv, subtle);
  }

  private async load() {
    if (this.loaded) return;
    this.settings = (await this.kv.get<AiSettings>(SETTINGS)) ?? null;
    this.loaded = true;
  }

  async status(): Promise<AiStatus> {
    await this.load();
    const key = await this.keys.get();
    const needsKey = this.settings ? preset(this.settings.provider).needsKey : true;
    return { configured: !!this.settings && (!needsKey || !!key), hasKey: !!key, settings: this.settings, locked: this.locked };
  }

  /** Save settings; a new key replaces the old one, an empty key keeps it. */
  async configure(s: AiSettings, key?: string): Promise<AiStatus> {
    await this.load();
    const clean: AiSettings = { ...s, baseUrl: normalizeBase(s.baseUrl || preset(s.provider).baseUrl), model: s.model.trim() };
    this.settings = clean;
    await this.kv.set(SETTINGS, clean);
    const existing = await this.keys.get();
    if (key && key.trim()) await this.keys.put(key.trim(), clean.remember);
    else if (existing) await this.keys.put(existing, clean.remember);
    return this.status();
  }

  async forget(): Promise<AiStatus> {
    await this.keys.forget();
    await this.kv.del(SETTINGS);
    this.settings = null;
    return this.status();
  }

  /** Exam attempts lock the tutor (09 §4.5, mode `exam`). */
  lock(on: boolean): void {
    this.locked = on;
    if (on) for (const a of this.aborts.values()) a.abort();
  }

  private async endpoint(): Promise<Endpoint> {
    await this.load();
    if (!this.settings) throw new AiError('no-provider');
    const p = preset(this.settings.provider);
    const key = (await this.keys.get()) ?? undefined;
    if (p.needsKey && !key) throw new AiError('no-provider', 'no key');
    if (!this.settings.model) throw new AiError('model', 'no model chosen');
    return { baseUrl: this.settings.baseUrl || p.baseUrl, model: this.settings.model, key, headers: p.headers, api: p.api };
  }

  async test(): Promise<TestResult> {
    try {
      return await testEndpoint(await this.endpoint(), this.f);
    } catch (e) {
      const err = e instanceof AiError ? e : new AiError('other', (e as Error).message);
      return { ok: false, ms: 0, streamed: false, text: '', error: err.code, detail: err.detail };
    }
  }

  async models(): Promise<string[]> {
    await this.load();
    if (!this.settings) throw new AiError('no-provider');
    const p = preset(this.settings.provider);
    const key = (await this.keys.get()) ?? undefined;
    return listModels({ baseUrl: this.settings.baseUrl || p.baseUrl, model: '', key, headers: p.headers, api: p.api }, this.f);
  }

  /** Stream one answer; `onDelta` gets text pieces. Resolves with the full text. */
  async chat(id: number, req: ChatRequest, onDelta: (text: string) => void): Promise<string> {
    if (this.locked) throw new AiError('locked');
    const ac = new AbortController();
    this.aborts.set(id, ac);
    let text = '';
    try {
      for await (const d of streamChat(await this.endpoint(), req, ac.signal, this.f)) {
        if (this.locked) throw new AiError('locked');
        text += d;
        onDelta(d);
      }
      return text;
    } finally {
      this.aborts.delete(id);
    }
  }

  abort(id: number): void {
    this.aborts.get(id)?.abort();
  }
}
