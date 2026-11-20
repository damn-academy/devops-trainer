// Small resumable UI drafts. Machine snapshots remain in the progress database.
export function readDraft<T>(key: string): T | undefined {
  try { return JSON.parse(localStorage.getItem(`dt.draft.${key}`) ?? 'null') ?? undefined; }
  catch { return undefined; }
}
export function writeDraft(key: string, value: unknown): void {
  try { localStorage.setItem(`dt.draft.${key}`, JSON.stringify(value)); } catch { /* Private mode or full storage. */ }
}
export function clearDraft(key: string): void {
  try { localStorage.removeItem(`dt.draft.${key}`); } catch { /* Storage is optional. */ }
}
