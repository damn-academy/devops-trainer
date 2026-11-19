// Small helpers of the Docker simulator: hashing, ids, sizes, Docker-style
// relative times and the column tables the Docker CLI prints.

/** sha256 of a string as 64 hex chars, through WebCrypto (browsers and Node 20+). */
export async function sha256hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function digestOf(data: string): Promise<string> {
  return `sha256:${await sha256hex(data)}`;
}

/** JSON with sorted keys: the same object always gives the same bytes, so the same digest. */
export function canonicalJson(v: unknown): string {
  return JSON.stringify(sortKeys(v));
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      const x = (v as Record<string, unknown>)[k];
      if (x !== undefined) out[k] = sortKeys(x);
    }
    return out;
  }
  return v;
}

/** The 12-character short id Docker prints: first 12 hex digits, without "sha256:". */
export function shortId(id: string): string {
  return id.replace(/^sha256:/, '').slice(0, 12);
}

/** Docker's human sizes: 1.2kB, 8.31MB, 1.05GB (decimal units, three significant digits). */
export function dockerSize(bytes: number): string {
  if (bytes < 1000) return `${bytes}B`;
  const units = ['kB', 'MB', 'GB', 'TB'];
  let v = bytes;
  let i = -1;
  do {
    v /= 1000;
    i++;
  } while (v >= 1000 && i < units.length - 1);
  const s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return `${s.replace(/\.?0+$/, (m) => (m.startsWith('.') ? '' : m))}${units[i]}`;
}

/** "3 seconds", "About a minute", "5 minutes", "2 hours" — go-units HumanDuration. */
export function humanDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 1) return 'Less than a second';
  if (s === 1) return '1 second';
  if (s < 60) return `${s} seconds`;
  const m = Math.round(s / 60);
  if (m === 1) return 'About a minute';
  if (m < 60) return `${m} minutes`;
  const h = Math.round(s / 3600);
  if (h === 1) return 'About an hour';
  if (h < 48) return `${h} hours`;
  if (h < 24 * 14) return `${Math.floor(h / 24)} days`;
  if (h < 24 * 60) return `${Math.floor(h / 24 / 7)} weeks`;
  if (h < 24 * 365 * 2) return `${Math.floor(h / 24 / 30)} months`;
  return `${Math.floor(h / 24 / 365)} years`;
}

export function ago(ms: number): string {
  return `${humanDuration(ms)} ago`;
}

/** Parse 64m, 512M, 1g, 100k, plain bytes — as `--memory` does. Returns bytes or NaN. */
export function parseBytes(s: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*([bkmgt]?)i?b?$/i.exec(s.trim());
  if (!m) return NaN;
  const mult: Record<string, number> = { '': 1, b: 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4 };
  return Math.round(Number(m[1]) * mult[m[2].toLowerCase()]);
}

/** Lay out rows in columns separated by three spaces, like the Docker CLI's tabwriter. */
export function table(header: string[], rows: string[][]): string {
  const all = [header, ...rows];
  const widths = header.map((_, i) => Math.max(...all.map((r) => [...(r[i] ?? '')].length)));
  return (
    all
      .map((r) =>
        r
          .map((c, i) => (i === r.length - 1 ? c : c + ' '.repeat(widths[i] - [...c].length + 3)))
          .join('')
          .trimEnd(),
      )
      .join('\n') + '\n'
  );
}

/** Truncate the COMMAND column like `docker ps`: quoted, at most 20 visible characters, an ellipsis inside the quotes. */
export function truncCommand(cmd: string, max = 20): string {
  const chars = [...cmd];
  const body = chars.length > max ? chars.slice(0, max - 1).join('') + '…' : cmd;
  return `"${body}"`;
}

/** argv the way Docker prints COMMAND: words joined by spaces, no quoting. */
export function joinArgv(argv: string[]): string {
  return argv.join(' ');
}

/** Single-quote a word for a shell line when it needs it. */
export function shellQuote(w: string): string {
  if (w === '') return "''";
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(w)) return w;
  return `'${w.replace(/'/g, `'\\''`)}'`;
}

/** Deterministic pseudo-random names: "quirky_hopper" style, from a counter. */
const ADJ = ['admiring', 'brave', 'calm', 'eager', 'focused', 'gifted', 'happy', 'jolly', 'keen', 'loving', 'modest', 'nifty', 'optimistic', 'quirky', 'serene', 'tender', 'vibrant', 'wizardly', 'zealous', 'elegant'];
const NAMES = ['hopper', 'lovelace', 'turing', 'ritchie', 'thompson', 'torvalds', 'knuth', 'liskov', 'hamilton', 'dijkstra', 'wozniak', 'kernighan', 'stallman', 'babbage', 'shannon', 'noether', 'curie', 'goldberg', 'perlman', 'yonath'];

export function containerName(n: number): string {
  return `${ADJ[(n * 7 + 3) % ADJ.length]}_${NAMES[(n * 11 + 5) % NAMES.length]}`;
}

export function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
}

/** Split a shell-form string into words (quotes respected), for CMD/ENTRYPOINT/RUN parsing. */
export function splitWords(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q: string | null = null;
  let has = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === q) q = null;
      else if (c === '\\' && q === '"' && i + 1 < s.length) cur += s[++i];
      else cur += c;
    } else if (c === '"' || c === "'") {
      q = c;
      has = true;
    } else if (/\s/.test(c)) {
      if (cur || has) out.push(cur);
      cur = '';
      has = false;
    } else if (c === '\\' && i + 1 < s.length) cur += s[++i];
    else cur += c;
  }
  if (cur || has) out.push(cur);
  return out;
}
