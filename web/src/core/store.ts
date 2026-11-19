// Local-first progress store (09 §3, 00 §6.8). The event log in IndexedDB is
// the single source; progress is replayed from it. Every event is written as
// it happens — there is no save button, a closed tab loses nothing.
// Machine snapshots and small per-viewer state go to a key-value store.
// Export/import moves the log between devices without an account; the
// account and sync come later through `setAccount`.

import { openDB, type IDBPDatabase } from 'idb';
import { apply, emptyProgress, replay, reminderDue, type Progress } from './progress';
import type { NewEvent, StoreEvent } from './types';

export interface Backend {
  load(): Promise<StoreEvent[]>;
  append(e: StoreEvent): Promise<void>;
  replace(events: StoreEvent[]): Promise<void>;
  getKV<T>(key: string): Promise<T | undefined>;
  setKV(key: string, value: unknown): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryBackend implements Backend {
  events: StoreEvent[] = [];
  kv = new Map<string, unknown>();
  async load() {
    return [...this.events];
  }
  async append(e: StoreEvent) {
    this.events.push(e);
  }
  async replace(events: StoreEvent[]) {
    this.events = [...events];
  }
  async getKV<T>(key: string) {
    return this.kv.get(key) as T | undefined;
  }
  async setKV(key: string, value: unknown) {
    this.kv.set(key, value);
  }
  async clear() {
    this.events = [];
    this.kv.clear();
  }
}

const DB = 'devops-trainer';

export class IdbBackend implements Backend {
  private db: Promise<IDBPDatabase>;
  constructor() {
    this.db = openDB(DB, 1, {
      upgrade(db) {
        db.createObjectStore('events', { keyPath: 'id' });
        db.createObjectStore('kv');
      },
    });
  }
  async load() {
    const all = (await (await this.db).getAll('events')) as StoreEvent[];
    return all.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.id < b.id ? -1 : 1));
  }
  async append(e: StoreEvent) {
    await (await this.db).put('events', e);
  }
  async replace(events: StoreEvent[]) {
    const db = await this.db;
    const tx = db.transaction('events', 'readwrite');
    await tx.store.clear();
    for (const e of events) await tx.store.put(e);
    await tx.done;
  }
  async getKV<T>(key: string) {
    return (await (await this.db).get('kv', key)) as T | undefined;
  }
  async setKV(key: string, value: unknown) {
    await (await this.db).put('kv', value, key);
  }
  async clear() {
    const db = await this.db;
    await db.clear('events');
    await db.clear('kv');
  }
}

/** Sign-in arrives in a later phase; until then nobody is signed in. */
export interface AccountProvider {
  signedIn(): boolean;
  /** Called after every local event so a provider can sync the log. */
  push?(e: StoreEvent): void;
}

export const EXPORT_FORMAT = 'devops-trainer/progress@1';

let seq = 0;
function newId(): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${(seq++).toString(36)}-${rnd}`;
}

export class Store {
  private backend: Backend = new MemoryBackend();
  private events: StoreEvent[] = [];
  private progress: Progress = emptyProgress();
  private listeners = new Set<(p: Progress, e?: StoreEvent) => void>();
  private writes: Promise<unknown> = Promise.resolve();
  private snapTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private account: AccountProvider = { signedIn: () => false };
  persisted: boolean | null = null;
  ready = false;
  /** Set when IndexedDB is not available (private mode in some browsers): progress lives for this tab. */
  volatile = false;

  async init(backend?: Backend): Promise<void> {
    if (backend) this.backend = backend;
    else {
      try {
        if (typeof indexedDB === 'undefined') throw new Error('no IndexedDB');
        this.backend = new IdbBackend();
      } catch {
        this.backend = new MemoryBackend();
        this.volatile = true;
      }
    }
    try {
      this.events = await this.backend.load();
    } catch {
      this.backend = new MemoryBackend();
      this.volatile = true;
      this.events = [];
    }
    this.progress = replay(this.events);
    this.ready = true;
    this.emit();
  }

  get state(): Progress {
    return this.progress;
  }

  get log(): readonly StoreEvent[] {
    return this.events;
  }

  subscribe(fn: (p: Progress, e?: StoreEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e?: StoreEvent): void {
    for (const fn of this.listeners) fn(this.progress, e);
  }

  /** Record an event: applied at once, written to disk at once (auto-save). */
  record(ev: NewEvent): StoreEvent {
    const full = { ...ev, id: newId(), t: new Date().toISOString() } as StoreEvent;
    this.events.push(full);
    apply(this.progress, full);
    this.writes = this.writes.then(() => this.backend.append(full)).catch(() => {
      this.volatile = true;
    });
    this.account.push?.(full);
    this.emit(full);
    return full;
  }

  /** Resolves when every recorded event has reached the backend. */
  flush(): Promise<unknown> {
    return this.writes;
  }

  // ── snapshots and small values (machine state, drafts) ──
  async getKV<T>(key: string): Promise<T | undefined> {
    try {
      return await this.backend.getKV<T>(key);
    } catch {
      return undefined;
    }
  }

  setKV(key: string, value: unknown): Promise<void> {
    return this.backend.setKV(key, value).catch(() => {});
  }

  /** Save a snapshot shortly after the last change (machines change on every command). */
  saveSnapshot(key: string, value: unknown, delayMs = 300): void {
    clearTimeout(this.snapTimers.get(key));
    this.snapTimers.set(
      key,
      setTimeout(() => {
        this.snapTimers.delete(key);
        void this.setKV(`snap:${key}`, value);
      }, delayMs),
    );
  }

  loadSnapshot<T>(key: string): Promise<T | undefined> {
    return this.getKV<T>(`snap:${key}`);
  }

  // ── export / import ──
  exportJSON(): string {
    this.record({ kind: 'progress.export' });
    return JSON.stringify({ format: EXPORT_FORMAT, exportedAt: new Date().toISOString(), events: this.events }, null, 1);
  }

  /** Merge an exported log into this one (union by event id, sorted by time). */
  async importJSON(text: string): Promise<{ added: number }> {
    let data: { format?: string; events?: StoreEvent[] };
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('not a JSON file');
    }
    if (data.format !== EXPORT_FORMAT || !Array.isArray(data.events)) throw new Error('not a DevOps Trainer progress file');
    const known = new Set(this.events.map((e) => e.id));
    const fresh = data.events.filter((e) => e && typeof e.id === 'string' && typeof e.t === 'string' && typeof e.kind === 'string' && !known.has(e.id));
    const merged = [...this.events, ...fresh].sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : a.id < b.id ? -1 : 1));
    this.events = merged;
    await this.backend.replace(merged);
    this.progress = replay(merged);
    this.record({ kind: 'progress.import', added: fresh.length });
    return { added: fresh.length };
  }

  /** Forget all local progress (Settings, after the learner confirms). */
  async reset(): Promise<void> {
    await this.backend.clear();
    this.events = [];
    this.progress = emptyProgress();
    this.emit();
  }

  // ── keeping data alive ──
  /** Ask the browser not to evict our storage (Safari clears sites after 7 days without visits). */
  async requestPersist(): Promise<boolean | null> {
    try {
      if (!navigator.storage?.persist) return (this.persisted = null);
      this.persisted = (await navigator.storage.persisted?.()) || (await navigator.storage.persist());
    } catch {
      this.persisted = null;
    }
    return this.persisted;
  }

  setAccount(p: AccountProvider): void {
    this.account = p;
  }

  signedIn(): boolean {
    return this.account.signedIn();
  }

  /** Whether to show the weekly line "export or sign in". */
  reminderDue(now = new Date()): boolean {
    return reminderDue(this.progress, now, this.signedIn());
  }
}

/** The app-wide store. */
export const store = new Store();
