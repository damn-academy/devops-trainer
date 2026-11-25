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
