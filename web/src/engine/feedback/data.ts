import { maskSecrets } from '../ai/prompt.ts';

export const MAX_BYTES = 256 * 1024;
export const categories = ['text', 'unclear', 'broken', 'crash', 'suggestion', 'other'] as const;
export interface Report {
  schema: 'dt.feedback/v1'; id: string; time: string; category: string; message: string; contact: string;
  website: string; context: Record<string, unknown>; attachments: Record<string, unknown>; omitted: string[];
}
const secretKey = /(?:password|passwd|secret|token|api.?key|authorization|private.?key|client-key-data)/i;
/** Mask strings individually so JSON quoting cannot hide a credential assignment. */
export function sanitize(value: unknown): unknown {
  if (typeof value === 'string') return maskSecrets(value
    .replace(/(\b[A-Za-z_][A-Za-z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|PRIVATE_KEY|ACCESS_KEY)[A-Za-z0-9_]*\s*=\s*)(?:"[^"]*"|'[^']*'|[^\s;]+)/gi, '$1«hidden»')
    .replace(/\bBasic\s+[A-Za-z0-9+/]+=*/gi, 'Basic «hidden»')
    .replace(/(:\/\/)[^\s/@:]+:[^\s/@]+@/g, '$1«hidden»@')
    .replace(/(["'](?:api[_-]?key|token|password|secret)["']\s*:\s*)["'][^"']*["']/gi, '$1"«hidden»"').replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')).replace(/\b(api[_-]?key|token|password|secret)\s+["']?[^\s"']+/gi, '$1 «hidden»');
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, secretKey.test(k) ? '«hidden»' : sanitize(v)]));
  return value;
}
export const bytes = (s: string) => new TextEncoder().encode(s).length;
export function prepare(report: Report, limit = MAX_BYTES): Report {
  const safe = sanitize(report) as Report;
  // Discard whole attachments, preserving valid JSON and explicitly naming omissions.
  for (const key of Object.keys(safe.attachments).sort((a,b) => bytes(JSON.stringify(safe.attachments[b])) - bytes(JSON.stringify(safe.attachments[a])))) {
    if (bytes(JSON.stringify(safe)) <= limit) break;
    delete safe.attachments[key]; safe.omitted.push(key);
  }
  if (bytes(JSON.stringify(safe)) > limit) throw new Error('Report exceeds size limit');
  return safe;
}
export type Snapshot = () => unknown | Promise<unknown>;
const sources = new Map<HTMLElement, Snapshot>();
export function registerFeedbackSnapshot(el: HTMLElement, snapshot: Snapshot): () => void {
  sources.set(el, snapshot); return () => sources.delete(el);
}
export async function snapshots(target?: Element): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [el, fn] of sources) {
    if (!el.isConnected || (target && !el.contains(target) && !target.contains(el))) continue;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      out[el.dataset.feedbackLab ?? `environment-${Object.keys(out).length}`] = await Promise.race([
        Promise.resolve().then(fn), new Promise((resolve) => { timer = setTimeout(() => resolve({ unavailable: 'Snapshot timed out; the environment may be unresponsive.' }), 2000); }),
      ]);
    } catch { out[`environment-${Object.keys(out).length}`] = { unavailable: 'Snapshot failed' }; }
    finally { clearTimeout(timer); }
  }
  return out;
}
export function selectionContext(selection: Selection | null): { text: string; sentence: string } | undefined {
  const text = selection?.toString().trim().slice(0, 4000);
  if (!text) return;
  const surrounding = selection?.anchorNode?.parentElement?.textContent ?? text;
  const at = surrounding.indexOf(text);
  return { text, sentence: surrounding.slice(Math.max(0, at - 250), Math.max(0, at) + text.length + 250) };
}

/** Keep command logs in one independently removable attachment. */
export function separateTerminal(value: unknown): { state: unknown; records: unknown[] } {
  const records: unknown[] = [];
  const visit = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(visit);
    if (!v || typeof v !== 'object') return v;
    return Object.fromEntries(Object.entries(v).filter(([key, item]) => {
      if (['term', 'transcript', 'history', 'console'].includes(key)) { records.push(item); return false; }
      return true;
    }).map(([key, item]) => [key, visit(item)]));
  };
  return { state: visit(value), records };
}
