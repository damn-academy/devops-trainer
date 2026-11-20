import { openDB } from 'idb';
import type { Report } from './data';
export interface Reply { id: string; author: 'author' | 'learner'; message: string; time: string }
export interface Thread { status: string; fixedBuild: string; fixedAt: string; merged: boolean; replies: Reply[] }
export interface Follow { id: string; token: string; message: string; type: string; context: Record<string, unknown>; thread?: Thread; seen?: string; fixedSeen?: boolean; checked?: number }
const db = () => openDB('dt-feedback-threads', 1, { upgrade(d) { d.createObjectStore('threads', { keyPath: 'id' }); } });
export const endpoint = () => (import.meta.env.VITE_FEEDBACK_URL ?? (import.meta.env.DEV ? '/api/feedback' : '')).replace(/\/$/, '');
export const follows = async (): Promise<Follow[]> => (await db()).getAll('threads');
export const saveFollow = async (f: Follow) => { await (await db()).put('threads', f); window.dispatchEvent(new Event('feedback-updated')); };
export const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
export async function remember(r: Report) {
  if (!r.followToken) return;
  const existing = await (await db()).get('threads', r.id);
  if (!existing) await saveFollow({ id: r.id, token: r.followToken, message: r.message, type: r.type ?? 'report', context: r.context });
}
export function revision(t?: Thread): string { return t ? JSON.stringify([t.status, t.fixedBuild, t.merged, t.replies.filter(r => r.author === 'author').map(r => r.id)]) : ''; }
export function unread(f: Follow) { return !!f.thread && revision(f.thread) !== (f.seen ?? revision({ ...f.thread, status: 'new', merged: false, fixedBuild: '', replies: [] })); }
let checking: Promise<void> | undefined;
export function checkThreads(force = false): Promise<void> {
  if (checking) return checking;
  checking = (async () => {
    if (!endpoint()) return;
    for (const f of await follows()) {
      if (!force && Date.now() - (f.checked ?? 0) < 86400000) continue;
      f.checked = Date.now(); await saveFollow(f);
      try {
        const res = await fetch(`${endpoint()}/${encodeURIComponent(f.id)}?token=${encodeURIComponent(f.token)}`, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(10000) });
        if (!res.ok) continue;
        const thread = await res.json() as Thread;
        // Re-read to preserve seen flags if the learner opened a thread while fetching.
        const current = await (await db()).get('threads', f.id) as Follow;
        await saveFollow({ ...current, thread });
      } catch { /* Keep the last received thread available offline. */ }
    }
  })().finally(() => { checking = undefined; });
  return checking;
}
export async function replyTo(f: Follow, message: string, id: string) {
  const res = await fetch(`${endpoint()}/${encodeURIComponent(f.id)}?token=${encodeURIComponent(f.token)}`, {
    method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, id }), signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error('Reply failed');
  f.thread = await res.json(); f.seen = revision(f.thread); await saveFollow(f);
}
export function statusText(t?: Thread) {
  if (!t) return 'Сообщение сохранено и ожидает отправки.';
  const status: Record<string, string> = { new: 'получено', triaged: 'разбираем', fixed: t.fixedAt ? `исправлено в версии от ${new Date(t.fixedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}` : 'исправлено', wontfix: 'не будем менять, ответ ниже', duplicate: 'уже известно, объединили с другим сообщением' };
  return (t.merged ? 'уже известно, объединили с другим сообщением · ' : '') + (status[t.status] ?? 'получено');
}
export async function exportWithFeedback(progress: string) { return JSON.stringify({ ...JSON.parse(progress), feedback: await follows() }, null, 1); }
export async function importFeedback(progress: string) {
  const entries: unknown = JSON.parse(progress).feedback;
  if (!Array.isArray(entries)) return;
  for (const item of entries) {
    if (!item || typeof item !== 'object' || !/^[a-zA-Z0-9_-]{8,80}$/.test(item.id) || !/^[a-f0-9]{64}$/.test(item.token) || typeof item.message !== 'string') continue;
    // Import only capabilities and display context, never untrusted cached server replies.
    if (!(await (await db()).get('threads', item.id))) await saveFollow({ id: item.id, token: item.token, message: item.message.slice(0,12000), type: item.type === 'contact' ? 'contact' : 'report', context: item.context && typeof item.context === 'object' ? item.context : {} });
  }
}
