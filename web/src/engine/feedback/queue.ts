import { openDB } from 'idb';
import type { Report } from './data';
export interface Entry { id: string; body: string; attempts: number; next: number; blocked?: boolean }
export interface QueueStore { put(entry: Entry): Promise<unknown>; all(): Promise<Entry[]>; remove(id: string): Promise<unknown> }
export function indexedQueue(): QueueStore {
  const db = openDB('dt-feedback', 1, { upgrade(db) { db.createObjectStore('reports', { keyPath: 'id' }); } });
  return { put: async e => (await db).put('reports', e), all: async () => (await db).getAll('reports'), remove: async id => (await db).delete('reports', id) };
}
export class FeedbackQueue {
  private running = false;
  constructor(private store: QueueStore, private endpoint: string, private send: typeof fetch = (...args) => fetch(...args), private now = Date.now) {}
  async enqueue(report: Report) { await this.store.put({ id: report.id, body: JSON.stringify(report), attempts: 0, next: 0 }); }
  async flush(): Promise<string[]> {
    if (this.running || !this.endpoint) return [];
    this.running = true;
    const sent: string[] = [];
    try {
      for (const entry of await this.store.all()) {
        if (entry.blocked || entry.next > this.now()) continue;
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          let body: BodyInit = entry.body;
          if (typeof CompressionStream !== 'undefined') {
            body = await new Response(new Response(entry.body).body!.pipeThrough(new CompressionStream('gzip'))).blob();
            headers['Content-Encoding'] = 'gzip';
          }
          const response = await this.send(this.endpoint, { method: 'POST', headers, body, credentials: 'omit', signal: AbortSignal.timeout(15000) });
          if (!response.ok) {
            if (response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)) entry.blocked = true;
            throw new Error('Upload failed');
          }
          await this.store.remove(entry.id); sent.push(entry.id);
        } catch {
          entry.attempts++; entry.next = this.now() + Math.min(3600000, 1000 * 2 ** Math.min(entry.attempts, 12));
          await this.store.put(entry);
        }
      }
    } finally { this.running = false; }
    return sent;
  }
}
