export interface Attempt { input: string; answer: string }
export function loadAttempts(id: string): Attempt[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`dt.trainers.${id}`) ?? '[]');
    return Array.isArray(value) && value.every(v => v && typeof v.input === 'string' && typeof v.answer === 'string') ? value.slice(-50) : [];
  } catch { return []; }
}
export function saveAttempts(id: string, attempts: Attempt[]) {
  try { localStorage.setItem(`dt.trainers.${id}`, JSON.stringify(attempts.slice(-50))); } catch { /* Optional storage. */ }
}

/** Drafts are independent of submitted attempts; unavailable storage is harmless. */
export function loadDraft<T>(id: string, fallback: T): T {
  try {
    const value = JSON.parse(localStorage.getItem(`dt.draft.${id}`) ?? 'null');
    if (value === null || typeof value !== typeof fallback || Array.isArray(value) !== Array.isArray(fallback)) return fallback;
    return value as T;
  } catch { return fallback; }
}
export function saveDraft(id: string, value: unknown) {
  try { localStorage.setItem(`dt.draft.${id}`, JSON.stringify(value)); } catch { /* Optional storage. */ }
}
export function clearDraft(id: string) {
  try { localStorage.removeItem(`dt.draft.${id}`); } catch { /* Optional storage. */ }
}
