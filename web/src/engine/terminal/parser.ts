// A command-line parser for the subset of bash the course uses:
// quotes ('…', "…", \x), variables ($VAR, ${VAR}, $?, $$, $#, $@, $1…),
// command substitution $(…), pipes |, redirects > >> < 2> 2>> 2>&1 &> >&2,
// lists with && || ; & and # comments, here-documents <<EOF / <<'EOF' / <<-EOF.
// Expansion happens at run time, so $? sees the exit code of the previous
// command in the same line. Compound commands (if, for, while) are split
// out before this parser runs (control.ts).

export type WordPart =
  | { kind: 'lit'; text: string; quoted: boolean }
  | { kind: 'var'; name: string; quoted: boolean }
  | { kind: 'sub'; src: string; quoted: boolean };

export type Word = WordPart[];

export interface Redirect {
  fd: 0 | 1 | 2;
  op: '>' | '>>' | '<' | 'dup' | '<<';
  /** Here-document body (op '<<'); `expand` is false when the delimiter was quoted. */
  heredoc?: { body: string; expand: boolean };
  /** File target; for 'dup' the fd to duplicate into (2>&1 → fd 2, to 1). */
  target?: Word;
  to?: 1 | 2;
}

export interface SimpleCommand {
  assigns: { name: string; value: Word }[];
  words: Word[];
  redirects: Redirect[];
}

export interface Pipeline {
  cmds: SimpleCommand[];
  negate: boolean;
}

export interface AndOr {
  first: Pipeline;
  rest: { op: '&&' | '||'; pipeline: Pipeline }[];
  background: boolean;
}

export type Script = AndOr[];

export type ParseResult = { ok: true; script: Script } | { ok: false; error: string; incomplete: boolean };

type Tok = { t: 'word'; w: Word } | { t: 'op'; v: string } | { t: 'redir'; fd: 0 | 1 | 2; op: '>' | '>>' | '<' | 'dup' | '<<'; to?: 1 | 2; doc?: number };

class Incomplete extends Error {}

const HEREDOC_MARK = '\u0001';

/**
 * Cut here-document bodies out of the source. `cat <<EOF\nline\nEOF` becomes
 * `cat <<\u00010` with body 0 = "line\n". Throws Incomplete when a delimiter
 * line has not arrived yet (the terminal then asks for more lines).
 */
export function extractHeredocs(src: string): { src: string; docs: { body: string; expand: boolean }[] } {
  if (!src.includes('<<')) return { src, docs: [] };
  const lines = src.split('\n');
  const docs: { body: string; expand: boolean }[] = [];
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const pending: { delim: string; strip: boolean; expand: boolean; idx: number }[] = [];
    let q: string | null = null;
    let rebuilt = '';
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (q) {
        if (c === q) q = null;
        rebuilt += c;
        continue;
      }
      if (c === "'" || c === '"') {
        q = c;
        rebuilt += c;
        continue;
      }
      if (c === '#' && (j === 0 || /\s/.test(line[j - 1]))) {
        rebuilt += line.slice(j);
        break;
      }
      const m = c === '<' && line[j + 1] === '<' && line[j + 2] !== '<' ? /^<<(-?)[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2/.exec(line.slice(j)) : null;
      if (m) {
        const idx = docs.length + pending.length;
        pending.push({ delim: m[3], strip: m[1] === '-', expand: m[2] === '', idx });
        rebuilt += `<<${HEREDOC_MARK}${idx}`;
        j += m[0].length - 1;
        continue;
      }
      rebuilt += c;
    }
    line = rebuilt;
    out.push(line);
    for (const p of pending) {
      const body: string[] = [];
      let found = false;
      while (++i < lines.length) {
        const l = p.strip ? lines[i].replace(/^\t+/, '') : lines[i];
        if (l === p.delim) {
          found = true;
          break;
        }
        body.push(l);
      }
      if (!found) throw new Incomplete();
      docs[p.idx] = { body: body.length ? body.join('\n') + '\n' : '', expand: p.expand };
    }
  }
  return { src: out.join('\n'), docs };
}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = src.length;
  const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\n';
  const special = (c: string) => isSpace(c) || c === '|' || c === '&' || c === ';' || c === '<' || c === '>' || c === '(' || c === ')';

  const readVar = (quoted: boolean): WordPart => {
    // at src[i] === '$'
    i++;
    const c = src[i];
    if (c === '{') {
      const end = src.indexOf('}', i);
      if (end < 0) throw new Incomplete();
      const name = src.slice(i + 1, end);
      i = end + 1;
      return { kind: 'var', name, quoted };
    }
    if (c === '(') {
      let depth = 1;
      let j = i + 1;
      while (j < n && depth > 0) {
        if (src[j] === '(') depth++;
        else if (src[j] === ')') depth--;
        if (depth > 0) j++;
      }
      if (depth > 0) throw new Incomplete();
      const inner = src.slice(i + 1, j);
      i = j + 1;
      return { kind: 'sub', src: inner, quoted };
    }
    if (c !== undefined && /[?$#@!*0-9]/.test(c)) {
      i++;
      return { kind: 'var', name: c, quoted };
    }
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (m) {
      i += m[0].length;
      return { kind: 'var', name: m[0], quoted };
    }
    return { kind: 'lit', text: '$', quoted };
  };

  while (i < n) {
    const c = src[i];
    if (isSpace(c)) {
      i++;
      continue;
    }
    if (c === '#') break; // comment to end of line
    // operators
    if (src.startsWith('&&', i) || src.startsWith('||', i)) {
      toks.push({ t: 'op', v: src.slice(i, i + 2) });
      i += 2;
      continue;
    }
    if (src.startsWith('&>', i)) {
      const append = src[i + 2] === '>';
      toks.push({ t: 'redir', fd: 1, op: append ? '>>' : '>' });
      toks.push({ t: 'redir', fd: 2, op: 'dup', to: 1 });
      i += append ? 3 : 2;
      continue;
    }
    if (c === '|' || c === ';' || c === '&') {
      toks.push({ t: 'op', v: c });
      i++;
      continue;
    }
    if (src.startsWith(`<<${HEREDOC_MARK}`, i)) {
      const m = /^<<\u0001(\d+)/.exec(src.slice(i))!;
      toks.push({ t: 'redir', fd: 0, op: '<<', doc: Number(m[1]) });
      i += m[0].length;
      continue;
    }
    // redirects, with an optional fd digit right before
    const rm = /^([012])?(>>|>&([12])|>|<)/.exec(src.slice(i));
    if (rm) {
      const fd = (rm[1] !== undefined ? Number(rm[1]) : rm[2] === '<' ? 0 : 1) as 0 | 1 | 2;
      if (rm[3]) toks.push({ t: 'redir', fd, op: 'dup', to: Number(rm[3]) as 1 | 2 });
      else toks.push({ t: 'redir', fd, op: rm[2] as '>' | '>>' | '<' });
      i += rm[0].length;
      continue;
    }
    // a word
    const word: Word = [];
    let lit = '';
    const flush = (quoted: boolean) => {
      if (lit) word.push({ kind: 'lit', text: lit, quoted });
      lit = '';
    };
    while (i < n && !special(src[i])) {
      const ch = src[i];
      if (ch === "'") {
        flush(false);
        const end = src.indexOf("'", i + 1);
        if (end < 0) throw new Incomplete();
        word.push({ kind: 'lit', text: src.slice(i + 1, end), quoted: true });
        i = end + 1;
      } else if (ch === '"') {
        flush(false);
        i++;
        let s = '';
        let closed = false;
        while (i < n) {
          const d = src[i];
          if (d === '"') {
            closed = true;
            i++;
            break;
          }
          if (d === '\\' && i + 1 < n && '"\\$`\n'.includes(src[i + 1])) {
            s += src[i + 1];
            i += 2;
          } else if (d === '$') {
            if (s) word.push({ kind: 'lit', text: s, quoted: true });
            s = '';
            word.push(readVar(true));
          } else {
            s += d;
            i++;
          }
        }
        if (!closed) throw new Incomplete();
        // An empty "" still makes an (empty) argument.
        word.push({ kind: 'lit', text: s, quoted: true });
      } else if (ch === '\\') {
        if (i + 1 >= n) throw new Incomplete();
        flush(false);
        word.push({ kind: 'lit', text: src[i + 1], quoted: true });
        i += 2;
      } else if (ch === '$') {
        flush(false);
        word.push(readVar(false));
      } else {
        lit += ch;
        i++;
      }
    }
    flush(false);
    if (word.length) toks.push({ t: 'word', w: word });
    else if (i < n && (src[i] === '(' || src[i] === ')')) throw new SyntaxError(`syntax error near unexpected token \`${src[i]}'`);
  }
  return toks;
}

const ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/;

export function parse(src: string): ParseResult {
  let toks: Tok[];
  let docs: { body: string; expand: boolean }[] = [];
  try {
    const ex = extractHeredocs(src);
    docs = ex.docs;
    toks = tokenize(ex.src);
  } catch (e) {
    if (e instanceof Incomplete) return { ok: false, error: 'unexpected EOF while looking for matching quote', incomplete: true };
    return { ok: false, error: (e as Error).message, incomplete: false };
  }
  let p = 0;
  const err = (tok: string): ParseResult => ({ ok: false, error: `syntax error near unexpected token \`${tok}'`, incomplete: false });

  const script: Script = [];
  let andor: AndOr | null = null;
  let pipeline: Pipeline = { cmds: [], negate: false };
  let cmd: SimpleCommand = { assigns: [], words: [], redirects: [] };
  let pendingOp: '&&' | '||' | null = null;

  const endCmd = (): boolean => {
    if (!cmd.words.length && !cmd.assigns.length && !cmd.redirects.length) return false;
    pipeline.cmds.push(cmd);
    cmd = { assigns: [], words: [], redirects: [] };
    return true;
  };
  const endPipeline = (): boolean => {
    if (!pipeline.cmds.length) return false;
    if (!andor) andor = { first: pipeline, rest: [], background: false };
    else andor.rest.push({ op: pendingOp!, pipeline });
    pipeline = { cmds: [], negate: false };
    pendingOp = null;
    return true;
  };

  while (p < toks.length) {
    const tk = toks[p++];
    if (tk.t === 'word') {
      const first = tk.w[0];
      if (!cmd.words.length && tk.w.length >= 1 && first.kind === 'lit' && !first.quoted && ASSIGN.test(first.text)) {
        const eq = first.text.indexOf('=');
        const value: Word = [];
        const rest = first.text.slice(eq + 1);
        if (rest) value.push({ kind: 'lit', text: rest, quoted: false });
        value.push(...tk.w.slice(1));
        cmd.assigns.push({ name: first.text.slice(0, eq), value });
      } else if (!cmd.words.length && !cmd.assigns.length && !pipeline.cmds.length && first.kind === 'lit' && !first.quoted && first.text === '!' && tk.w.length === 1) {
        pipeline.negate = true;
      } else cmd.words.push(tk.w);
      continue;
    }
    if (tk.t === 'redir') {
      if (tk.op === 'dup') {
        cmd.redirects.push({ fd: tk.fd, op: 'dup', to: tk.to });
        continue;
      }
      if (tk.op === '<<') {
        cmd.redirects.push({ fd: 0, op: '<<', heredoc: docs[tk.doc ?? 0] ?? { body: '', expand: false } });
        continue;
      }
      const target = toks[p++];
      if (!target || target.t !== 'word') return target ? err(target.t === 'op' ? target.v : '>') : err('newline');
      cmd.redirects.push({ fd: tk.fd, op: tk.op as '>' | '>>' | '<', target: target.w });
      continue;
    }
    // operators
    if (tk.v === '|') {
      if (!endCmd()) return err('|');
      continue;
    }
    if (tk.v === '&&' || tk.v === '||') {
      if (!endCmd() && !pipeline.cmds.length) return err(tk.v);
      if (!endPipeline()) return err(tk.v);
      pendingOp = tk.v;
      continue;
    }
    if (tk.v === ';' || tk.v === '&') {
      endCmd();
      if (pendingOp && !pipeline.cmds.length) return err(tk.v);
      const had = endPipeline();
      if (!had && !andor) return err(tk.v);
      if (andor) {
        (andor as AndOr).background = tk.v === '&';
        script.push(andor);
      }
      andor = null;
      continue;
    }
  }
  endCmd();
  if (pipeline.negate && !pipeline.cmds.length) return { ok: false, error: 'syntax error: unexpected end of file', incomplete: true };
  if (pendingOp && !pipeline.cmds.length) return { ok: false, error: 'syntax error: unexpected end of file', incomplete: true };
  const lastPipeIncomplete = toks.length && toks[toks.length - 1].t === 'op' && (toks[toks.length - 1] as { v: string }).v === '|';
  if (lastPipeIncomplete) return { ok: false, error: 'syntax error: unexpected end of file', incomplete: true };
  endPipeline();
  if (andor) script.push(andor);
  return { ok: true, script };
}

/** Does the word contain unquoted glob characters? */
export function hasGlob(w: Word): boolean {
  return w.some((p) => p.kind === 'lit' && !p.quoted && /[*?[]/.test(p.text));
}

/** Convert a glob pattern to a RegExp (for one path component). */
export function globToRegExp(pat: string): RegExp {
  let re = '^';
  for (let i = 0; i < pat.length; i++) {
    const c = pat[i];
    if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '[') {
      const end = pat.indexOf(']', i + 1);
      if (end < 0) re += '\\[';
      else {
        let cls = pat.slice(i + 1, end);
        if (cls.startsWith('!')) cls = '^' + cls.slice(1);
        re += `[${cls.replace(/\\/g, '\\\\')}]`;
        i = end;
      }
    } else re += c.replace(/[.+^${}()|\\]/g, '\\$&');
  }
  return new RegExp(re + '$');
}
