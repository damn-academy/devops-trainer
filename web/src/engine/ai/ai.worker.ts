// The AI worker (09 §4.2): holds the settings and the key and makes the
// requests. The page sends questions and receives text; it never needs the key
// again after the learner typed it.

/// <reference lib="webworker" />

import { AiError } from './client';
import { AiEngine } from './engine';
import { idbKv, MemoryKv } from './keystore';
import type { AiIn, AiOut } from './protocol';

declare const self: DedicatedWorkerGlobalScope;

const enginePromise: Promise<AiEngine> = idbKv()
  .catch(() => new MemoryKv())
  .then((kv) => new AiEngine(kv));

const post = (m: AiOut) => self.postMessage(m);
const fail = (id: number, e: unknown) => {
  const err = e instanceof AiError ? e : new AiError('other', (e as Error)?.message ?? String(e));
  post({ op: 'error', id, code: err.code, detail: err.detail, status: err.status });
};

self.onmessage = async (ev: MessageEvent<AiIn>) => {
  const m = ev.data;
  const engine = await enginePromise;
  try {
    switch (m.op) {
      case 'status':
        post({ op: 'status', id: m.id, status: await engine.status() });
        break;
      case 'configure':
        post({ op: 'status', id: m.id, status: await engine.configure(m.settings, m.key) });
        break;
      case 'forget':
        post({ op: 'status', id: m.id, status: await engine.forget() });
        break;
      case 'lock':
        engine.lock(m.on);
        post({ op: 'status', id: m.id, status: await engine.status() });
        break;
      case 'test':
        post({ op: 'test', id: m.id, result: await engine.test() });
        break;
      case 'models':
        post({ op: 'models', id: m.id, models: await engine.models() });
        break;
      case 'chat': {
        const text = await engine.chat(m.id, m.req, (d) => post({ op: 'delta', id: m.id, text: d }));
        post({ op: 'done', id: m.id, text });
        break;
      }
      case 'abort':
        engine.abort(m.target);
        break;
    }
  } catch (e) {
    fail(m.id, e);
  }
};
