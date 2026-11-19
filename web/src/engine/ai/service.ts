// The page side of the AI: a small facade over ai.worker.ts with promises and
// async iterators, plus the human wording of every error (09 §4.1).

import { bi, type Bi } from '../../core/i18n';
import type { AiErrorCode, ChatRequest, TestResult } from './client';
import { AiError } from './client';
import type { AiSettings, AiStatus } from './engine';
import type { AiIn, AiOut } from './protocol';

type Pending = { resolve(m: AiOut): void; onDelta?(t: string): void };

/** Distributive Omit, so each message keeps its own fields. */
type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;

export interface AiPort {
  post(m: AiIn): void;
  onmessage: ((m: AiOut) => void) | null;
}

function workerPort(): AiPort {
  const w = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module', name: 'ai' });
  const port: AiPort = { post: (m) => w.postMessage(m), onmessage: null };
  w.onmessage = (ev: MessageEvent<AiOut>) => port.onmessage?.(ev.data);
  return port;
}

export class AiService {
  private port: AiPort | null = null;
  private pending = new Map<number, Pending>();
  private seq = 1;
  private listeners = new Set<(s: AiStatus) => void>();
  status: AiStatus = { configured: false, hasKey: false, settings: null, locked: false };
  ready: Promise<AiStatus>;

  constructor(private makePort: () => AiPort = workerPort) {
    this.ready = typeof Worker === 'undefined' && makePort === workerPort ? Promise.resolve(this.status) : this.refresh();
  }

  private ensure(): AiPort {
    if (this.port) return this.port;
    const port = this.makePort();
    port.onmessage = (m) => {
      const p = this.pending.get(m.id);
      if (!p) return;
      if (m.op === 'delta') return p.onDelta?.(m.text);
      this.pending.delete(m.id);
      p.resolve(m);
    };
    this.port = port;
    return port;
  }

  private call(m: WithoutId<AiIn>, onDelta?: (t: string) => void): { id: number; done: Promise<AiOut> } {
    const id = this.seq++;
    const done = new Promise<AiOut>((resolve) => this.pending.set(id, { resolve, onDelta }));
    this.ensure().post({ ...m, id } as AiIn);
    return { id, done };
  }

  private async statusCall(m: WithoutId<AiIn>): Promise<AiStatus> {
    const r = await this.call(m).done;
    if (r.op === 'error') throw new AiError(r.code, r.detail, r.status);
    if (r.op !== 'status') throw new AiError('other', 'unexpected reply');
    this.status = r.status;
    for (const fn of this.listeners) fn(r.status);
    return r.status;
  }

  onChange(fn: (s: AiStatus) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  refresh(): Promise<AiStatus> {
    return this.statusCall({ op: 'status' });
  }
  configure(settings: AiSettings, key?: string): Promise<AiStatus> {
    return this.statusCall({ op: 'configure', settings, key });
  }
  forget(): Promise<AiStatus> {
    return this.statusCall({ op: 'forget' });
  }
  lock(on: boolean): Promise<AiStatus> {
    return this.statusCall({ op: 'lock', on });
  }

  async test(): Promise<TestResult> {
    const r = await this.call({ op: 'test' }).done;
    if (r.op === 'test') return r.result;
    if (r.op === 'error') return { ok: false, ms: 0, streamed: false, text: '', error: r.code, detail: r.detail };
    throw new AiError('other');
  }

  async models(): Promise<string[]> {
    const r = await this.call({ op: 'models' }).done;
    if (r.op === 'models') return r.models;
    if (r.op === 'error') throw new AiError(r.code, r.detail, r.status);
    return [];
  }

  /** Stream an answer. `abort()` stops it. */
  stream(req: ChatRequest, onDelta: (t: string) => void): { done: Promise<string>; abort(): void } {
    const { id, done } = this.call({ op: 'chat', req }, onDelta);
    return {
      done: done.then((r) => {
        if (r.op === 'done') return r.text;
        if (r.op === 'error') throw new AiError(r.code, r.detail, r.status);
        throw new AiError('other');
      }),
      abort: () => this.ensure().post({ op: 'abort', id: this.seq++, target: id }),
    };
  }
}

let shared: AiService | null = null;
/** The one AI service of the page (created on first use, so the worker starts only when needed). */
export function ai(): AiService {
  shared ??= new AiService();
  return shared;
}

/** Human sentences for error codes (09 §4.1). */
export const ERRORS: Record<AiErrorCode, Bi> = {
  auth: bi('Провайдер не принял ключ: проверьте, что он скопирован целиком и не отозван.', 'The provider rejected the key: check that it was copied whole and has not been revoked.'),
  quota: bi('На балансе провайдера закончились деньги или исчерпан лимит ключа.', 'The provider balance is empty or the key’s limit is used up.'),
  rate: bi('Слишком много запросов подряд — провайдер просит подождать. Повторите через минуту.', 'Too many requests in a row — the provider asks to wait. Try again in a minute.'),
  model: bi('У провайдера нет такой модели. Нажмите «Загрузить список» и выберите из него.', 'The provider has no such model. Press “Load the list” and pick one from it.'),
  'bad-url': bi('По этому адресу нет API в формате OpenAI. Адрес должен заканчиваться перед `/chat/completions`, например `…/v1`; разрешены https:// и http://localhost.', 'There is no OpenAI-style API at this address. It should stop before `/chat/completions`, e.g. `…/v1`; https:// and http://localhost are allowed.'),
  cors: bi('Браузер не получил ответа: провайдер не разрешает запросы со страниц (CORS), адрес неверен или нет сети.', 'The browser got no answer: the provider does not allow requests from web pages (CORS), the address is wrong, or there is no network.'),
  'local-down': bi('Локальный сервер не ответил: Ollama не запущена, не разрешён адрес курса в `OLLAMA_ORIGINS`, или браузер запретил доступ к локальной сети (Chrome спрашивает об этом отдельно — разрешение включается в настройках сайта).', 'The local server did not answer: Ollama is not running, the course address is not in `OLLAMA_ORIGINS`, or the browser blocked local network access (Chrome asks about it separately — the permission is in the site settings).'),
  server: bi('У провайдера ошибка на сервере. Обычно это проходит само; попробуйте позже.', 'The provider has a server error. It usually passes by itself; try later.'),
  empty: bi('Провайдер ответил пустым текстом. Попробуйте другую модель.', 'The provider answered with empty text. Try another model.'),
  aborted: bi('Ответ остановлен.', 'The answer was stopped.'),
  locked: bi('Идёт экзамен: наставник выключен до конца попытки.', 'An exam is on: the tutor is off until the attempt ends.'),
  'no-provider': bi('Нейросеть не подключена. Подключите её в настройках.', 'No AI is connected. Connect one in the settings.'),
  other: bi('Что-то пошло не так.', 'Something went wrong.'),
};
