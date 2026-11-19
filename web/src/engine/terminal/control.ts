// Compound commands of the bash subset: if/elif/else/fi, for … in … do/done,
// while/until … do/done. The source is split into statements on unquoted
// newlines and `;`, keywords are recognised at the start of a statement, and
// the result is a small tree; simple statements are handed to parser.ts.

import { extractHeredocs } from './parser';

export type CNode =
  | { k: 'cmd'; src: string }
  | { k: 'if'; arms: { cond: CNode[]; body: CNode[] }[]; els?: CNode[] }
  | { k: 'for'; v: string; words: string | null; body: CNode[] }
  | { k: 'while'; until: boolean; cond: CNode[]; body: CNode[]; input?: string };

export type ControlResult = { ok: true; nodes: CNode[] } | { ok: false; error: string; incomplete: boolean };

const OPENERS = new Set(['if', 'for', 'while', 'until']);
const KEYWORDS = new Set(['if', 'then', 'elif', 'else', 'fi', 'for', 'do', 'done', 'while', 'until']);

/**
 * Split a script into statements: unquoted newlines and `;` separate them
 * (`;;` and `;` inside quotes, $(…) or a here-document do not). A statement
 * keeps `&&`, `||`, `|` and `&` for parser.ts.
 */
export function splitStatements(src: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q: string | null = null;
  let depth = 0;
  // { … } groups and ( … ) subshells: their inner ; and newlines do not split the statement.
  let group = 0;
  const atWordStart = () => /(^|[\s;&|(])$/.test(cur);
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (!q && depth === 0) {
      if (c === '{' && atWordStart() && /[\s]/.test(src[i + 1] ?? '')) group++;
      else if (c === '}' && group > 0 && /(^|[\s;])$/.test(cur) && /^($|[\s;&|)<>])/.test(src[i + 1] ?? '')) group--;
      else if (c === '(' && atWordStart() && src[i - 1] !== '$') group++;
      else if (c === ')' && group > 0) group--;
    }
    if (q) {
      cur += c;
      if (c === '\\' && q === '"' && i + 1 < src.length) {
        cur += src[++i];
        continue;
      }
      if (c === q) q = null;
      continue;
    }
    if (c === '\\' && i + 1 < src.length) {
      if (src[i + 1] === '\n') {
        i++;
        continue;
      }
      cur += c + src[++i];
      continue;
    }
    if (c === "'" || c === '"') {
      q = c;
      cur += c;
      continue;
    }
    if (c === '#' && (cur === '' || /\s$/.test(cur)) && depth === 0) {
      while (i < src.length && src[i] !== '\n') i++;
      i--;
      continue;
    }
    if (c === '$' && src[i + 1] === '(') {
      depth++;
      cur += '$(';
      i++;
      continue;
    }
    if (c === '(' && depth > 0) depth++;
    if (c === ')' && depth > 0) depth--;
    if (depth === 0 && group === 0 && (c === '\n' || (c === ';' && src[i + 1] !== ';'))) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Split off a leading keyword: "then echo hi" → ['then', 'echo hi']. */
function headWord(stmt: string): [string, string] {
  const m = /^([a-z]+)(?:\s+([\s\S]*))?$/.exec(stmt);
  if (m && KEYWORDS.has(m[1])) return [m[1], (m[2] ?? '').trim()];
  return ['', stmt];
}

class Incomplete extends Error {}

/** Parse a script into compound nodes. Plain lines become { k: 'cmd' }. */
export function parseControl(src: string): ControlResult {
  // Here-documents may contain keyword-looking lines: protect their bodies first.
  let docSafe: string;
  try {
    extractHeredocs(src);
    docSafe = src;
  } catch {
    return { ok: false, error: 'here-document delimited by end-of-file', incomplete: true };
  }
  const stmts = protectHeredocs(docSafe);
  // Expand keywords that follow on the same statement: "then echo x" → "then", "echo x".
  const flat: string[] = [];
  for (const s of stmts) {
    let rest = s;
    for (;;) {
      const [kw, tail] = headWord(rest);
      if (!kw) {
        flat.push(rest);
        break;
      }
      if (kw === 'for' || kw === 'if' || kw === 'while' || kw === 'until' || kw === 'elif') {
        flat.push(rest);
        break;
      }
      flat.push(kw);
      if (kw === 'done' && tail.startsWith('<')) {
        flat[flat.length - 1] = `done ${tail}`;
        break;
      }
      if (!tail) break;
      rest = tail;
    }
  }
  let i = 0;
  const block = (stop: string[]): CNode[] => {
    const nodes: CNode[] = [];
    while (i < flat.length) {
      const s = flat[i];
      const [kw, tail] = headWord(s);
      if (kw && stop.includes(kw)) return nodes;
      i++;
      if (!kw) {
        nodes.push({ k: 'cmd', src: s });
        continue;
      }
      if (kw === 'if') {
        const arms: { cond: CNode[]; body: CNode[] }[] = [];
        let cond = [{ k: 'cmd', src: tail } as CNode, ...block(['then'])];
        let els: CNode[] | undefined;
        for (;;) {
          if (i >= flat.length) throw new Incomplete();
          i++; // then
          const body = block(['elif', 'else', 'fi']);
          arms.push({ cond, body });
          if (i >= flat.length) throw new Incomplete();
          const [k2, t2] = headWord(flat[i]);
          i++;
          if (k2 === 'elif') {
            cond = [{ k: 'cmd', src: t2 }, ...block(['then'])];
            continue;
          }
          if (k2 === 'else') {
            els = block(['fi']);
            if (i >= flat.length) throw new Incomplete();
            i++;
          }
          break;
        }
        nodes.push({ k: 'if', arms, els });
        continue;
      }
      if (kw === 'for') {
        const m = /^([A-Za-z_][A-Za-z0-9_]*)(?:\s+in(?:\s+([\s\S]*))?)?$/.exec(tail);
        if (!m) throw new SyntaxError(`syntax error near \`${tail.split(/\s/)[0] || 'for'}'`);
        if (i >= flat.length) throw new Incomplete();
        const [k2] = headWord(flat[i]);
        if (k2 !== 'do') throw new SyntaxError("syntax error near unexpected token, expected `do'");
        i++;
        const body = block(['done']);
        if (i >= flat.length) throw new Incomplete();
        i++;
        nodes.push({ k: 'for', v: m[1], words: m[2] === undefined && !/\sin\b/.test(tail) ? null : (m[2] ?? ''), body });
        continue;
      }
      if (kw === 'while' || kw === 'until') {
        const cond = [{ k: 'cmd', src: tail } as CNode, ...block(['do'])];
        if (i >= flat.length) throw new Incomplete();
        i++;
        const body = block(['done']);
        if (i >= flat.length) throw new Incomplete();
        const doneStmt = flat[i];
        i++;
        const input = /^done\s*<\s*(\S+)/.exec(doneStmt)?.[1];
        nodes.push({ k: 'while', until: kw === 'until', cond, body, input });
        continue;
      }
      throw new SyntaxError(`syntax error near unexpected token \`${kw}'`);
    }
    if (stop.length) throw new Incomplete();
    return nodes;
  };
  try {
    const nodes = block([]);
    return { ok: true, nodes };
  } catch (e) {
    if (e instanceof Incomplete) return { ok: false, error: 'syntax error: unexpected end of file', incomplete: true };
    return { ok: false, error: (e as Error).message, incomplete: false };
  }
}

/** Statements, keeping a here-document attached to the statement that opens it. */
function protectHeredocs(src: string): string[] {
  if (!src.includes('<<')) return splitStatements(src);
  const lines = src.split('\n');
  const out: string[] = [];
  let buf: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const delims = [...line.matchAll(/<<-?[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/g)].map((m) => m[2]);
    if (!delims.length) {
      buf.push(line);
      continue;
    }
    if (buf.length) out.push(...splitStatements(buf.join('\n')));
    buf = [];
    const chunk = [line];
    for (const d of delims) {
      while (++i < lines.length) {
        chunk.push(lines[i]);
        if (lines[i].replace(/^\t+/, '') === d) break;
      }
    }
    out.push(chunk.join('\n'));
  }
  if (buf.length) out.push(...splitStatements(buf.join('\n')));
  return out;
}

/** Is this source an unfinished compound command (an `if` without `fi`…)? */
export function controlIncomplete(src: string): boolean {
  const r = parseControl(src);
  return !r.ok && r.incomplete;
}

export function hasControl(src: string): boolean {
  return splitStatements(src).some((s) => OPENERS.has(headWord(s)[0]));
}

/** A statement split at top-level && and ||, keeping { … } and ( … ) whole. */
export function splitAndOr(stmt: string): { parts: string[]; ops: ('&&' | '||')[] } {
  const parts: string[] = [];
  const ops: ('&&' | '||')[] = [];
  let cur = '';
  let q: string | null = null;
  let depth = 0;
  let group = 0;
  for (let i = 0; i < stmt.length; i++) {
    const c = stmt[i];
    if (q) {
      cur += c;
      if (c === '\\' && q === '"') cur += stmt[++i] ?? '';
      else if (c === q) q = null;
      continue;
    }
    if (c === "'" || c === '"') {
      q = c;
      cur += c;
      continue;
    }
    if (c === '$' && stmt[i + 1] === '(') {
      depth++;
      cur += '$(';
      i++;
      continue;
    }
    if (depth > 0) {
      if (c === '(') depth++;
      if (c === ')') depth--;
      cur += c;
      continue;
    }
    if (c === '{' && /(^|\s)$/.test(cur)) group++;
    if (c === '}' && group > 0 && /(^|[\s;])$/.test(cur)) group--;
    if (c === '(') group++;
    if (c === ')' && group > 0) group--;
    if (group === 0 && (stmt.startsWith('&&', i) || stmt.startsWith('||', i))) {
      parts.push(cur.trim());
      ops.push(stmt.slice(i, i + 2) as '&&' | '||');
      cur = '';
      i++;
      continue;
    }
    cur += c;
  }
  parts.push(cur.trim());
  return { parts, ops };
}

/** "{ a; b; }" → brace group body; "( a; b )" → subshell body; otherwise null. */
export function groupOf(part: string): { kind: 'brace' | 'sub'; body: string } | null {
  const t = part.trim();
  const brace = /^\{\s([\s\S]*?);?\s*\}$/.exec(t);
  if (brace) return { kind: 'brace', body: brace[1] };
  const sub = /^\(([\s\S]*)\)$/.exec(t);
  if (sub && !t.startsWith('((')) return { kind: 'sub', body: sub[1] };
  return null;
}

/** Does the statement contain a { … } group or a ( … ) subshell at the top level? */
export function hasGroup(stmt: string): boolean {
  return splitAndOr(stmt).parts.some((p) => groupOf(p) !== null);
}
