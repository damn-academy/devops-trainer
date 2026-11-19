// Line diffs and three-way merge for the simulated Git. Files in the course are
// small, so a longest-common-subsequence table is fast enough and gives the
// same hunks a reader expects from `git diff`.

export type Op = { kind: 'eq' | 'del' | 'add'; line: string; a: number; b: number };

export function splitLines(text: string): string[] {
  if (!text) return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Edit script from a to b: equal, deleted and added lines with their 0-based positions. */
export function diffLines(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  // Trim the common prefix and suffix first: most edits touch a few lines.
  let pre = 0;
  while (pre < n && pre < m && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < n - pre && suf < m - pre && a[n - 1 - suf] === b[m - 1 - suf]) suf++;
  const A = a.slice(pre, n - suf);
  const B = b.slice(pre, m - suf);
  const ops: Op[] = [];
  for (let i = 0; i < pre; i++) ops.push({ kind: 'eq', line: a[i], a: i, b: i });
  const N = A.length;
  const M = B.length;
  const L: Uint32Array[] = [];
  for (let i = 0; i <= N; i++) L.push(new Uint32Array(M + 1));
  for (let i = N - 1; i >= 0; i--) for (let j = M - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  let i = 0;
  let j = 0;
  while (i < N || j < M) {
    if (i < N && j < M && A[i] === B[j]) {
      ops.push({ kind: 'eq', line: A[i], a: pre + i, b: pre + j });
      i++;
      j++;
    } else if (i < N && (j >= M || L[i + 1][j] >= L[i][j + 1])) {
      // Deletions first, as `git diff` prints them.
      ops.push({ kind: 'del', line: A[i], a: pre + i, b: pre + j });
      i++;
    } else {
      ops.push({ kind: 'add', line: B[j], a: pre + i, b: pre + j });
      j++;
    }
  }
  for (let k = 0; k < suf; k++) ops.push({ kind: 'eq', line: a[n - suf + k], a: n - suf + k, b: m - suf + k });
  return ops;
}

export interface DiffColors {
  meta: (s: string) => string;
  hunk: (s: string) => string;
  add: (s: string) => string;
  del: (s: string) => string;
}

const plain: DiffColors = { meta: (s) => s, hunk: (s) => s, add: (s) => s, del: (s) => s };

/** Unified diff hunks (3 lines of context), without the file header. */
export function unifiedHunks(aText: string, bText: string, c: DiffColors = plain, context = 3): string {
  const a = splitLines(aText);
  const b = splitLines(bText);
  const ops = diffLines(a, b);
  const changes = ops.map((o, i) => (o.kind === 'eq' ? -1 : i)).filter((i) => i >= 0);
  if (!changes.length) return '';
  const groups: [number, number][] = [];
  for (const idx of changes) {
    const lo = Math.max(0, idx - context);
    const hi = Math.min(ops.length - 1, idx + context);
    const last = groups[groups.length - 1];
    if (last && lo <= last[1] + 1) last[1] = Math.max(last[1], hi);
    else groups.push([lo, hi]);
  }
  let out = '';
  for (const [lo, hi] of groups) {
    const slice = ops.slice(lo, hi + 1);
    const aStart = slice.find((o) => o.kind !== 'add')?.a ?? slice[0].a;
    const bStart = slice.find((o) => o.kind !== 'del')?.b ?? slice[0].b;
    const aLen = slice.filter((o) => o.kind !== 'add').length;
    const bLen = slice.filter((o) => o.kind !== 'del').length;
    const range = (start: number, len: number) => (len === 1 ? `${start + 1}` : `${len === 0 ? start : start + 1},${len}`);
    out += c.hunk(`@@ -${range(aStart, aLen)} +${range(bStart, bLen)} @@`) + '\n';
    for (const o of slice) {
      if (o.kind === 'eq') out += ` ${o.line}\n`;
      else if (o.kind === 'del') out += c.del(`-${o.line}`) + '\n';
      else out += c.add(`+${o.line}`) + '\n';
    }
  }
  return out;
}

/** Count of added and deleted lines (for `--stat` and commit summaries). */
export function lineStats(aText: string, bText: string): { add: number; del: number } {
  const ops = diffLines(splitLines(aText), splitLines(bText));
  return { add: ops.filter((o) => o.kind === 'add').length, del: ops.filter((o) => o.kind === 'del').length };
}

interface Chunk {
  /** Range in base [start, end) replaced by `lines`. */
  start: number;
  end: number;
  lines: string[];
}

function chunks(base: string[], other: string[]): Chunk[] {
  const ops = diffLines(base, other);
  const out: Chunk[] = [];
  let cur: Chunk | null = null;
  let basePos = 0;
  for (const o of ops) {
    if (o.kind === 'eq') {
      if (cur) out.push(cur);
      cur = null;
      basePos = o.a + 1;
      continue;
    }
    if (!cur) cur = { start: basePos, end: basePos, lines: [] };
    if (o.kind === 'del') {
      cur.end = o.a + 1;
      basePos = o.a + 1;
    } else cur.lines.push(o.line);
  }
  if (cur) out.push(cur);
  return out;
}

export interface MergeResult {
  text: string;
  conflicts: number;
}

/**
 * diff3-style merge of two edits of `base`. Changes that do not touch the same
 * lines are combined; overlapping changes become a conflict block with the
 * markers Git writes.
 */
export function merge3(baseText: string, oursText: string, theirsText: string, labels: { ours: string; theirs: string }): MergeResult {
  if (oursText === theirsText) return { text: oursText, conflicts: 0 };
  if (baseText === oursText) return { text: theirsText, conflicts: 0 };
  if (baseText === theirsText) return { text: oursText, conflicts: 0 };
  const base = splitLines(baseText);
  const ours = splitLines(oursText);
  const theirs = splitLines(theirsText);
  const A = chunks(base, ours).map((c) => ({ ...c, side: 'ours' as const }));
  const B = chunks(base, theirs).map((c) => ({ ...c, side: 'theirs' as const }));
  const all = [...A, ...B].sort((x, y) => x.start - y.start || x.end - y.end);
  const out: string[] = [];
  let pos = 0;
  let conflicts = 0;
  let i = 0;
  while (i < all.length) {
    // Group chunks that overlap (or touch at the same insertion point).
    let start = all[i].start;
    let end = all[i].end;
    const group = [all[i]];
    i++;
    // Changes that overlap or touch are one region, as in Git: adjacent edits by both sides conflict.
    while (i < all.length && all[i].start <= end) {
      end = Math.max(end, all[i].end);
      start = Math.min(start, all[i].start);
      group.push(all[i]);
      i++;
    }
    for (let k = pos; k < start; k++) out.push(base[k]);
    const sides = new Set(group.map((g) => g.side));
    const render = (side: 'ours' | 'theirs') => {
      const lines: string[] = [];
      let p = start;
      for (const g of group.filter((x) => x.side === side)) {
        for (let k = p; k < g.start; k++) lines.push(base[k]);
        lines.push(...g.lines);
        p = g.end;
      }
      for (let k = p; k < end; k++) lines.push(base[k]);
      return lines;
    };
    if (sides.size === 1) out.push(...render(group[0].side));
    else {
      const o = render('ours');
      const t = render('theirs');
      if (o.join('\n') === t.join('\n')) out.push(...o);
      else {
        conflicts++;
        out.push(`<<<<<<< ${labels.ours}`, ...o, '=======', ...t, `>>>>>>> ${labels.theirs}`);
      }
    }
    pos = end;
  }
  for (let k = pos; k < base.length; k++) out.push(base[k]);
  return { text: out.length ? out.join('\n') + '\n' : '', conflicts };
}

export function hasConflictMarkers(text: string): boolean {
  return /^(<{7} |={7}$|>{7} )/m.test(text);
}
