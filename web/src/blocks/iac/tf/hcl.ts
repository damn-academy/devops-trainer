// A subset of HCL (the Terraform/OpenTofu configuration language) for the
// course: blocks with labels, attributes, nested blocks, comments, strings
// with ${…} interpolation, numbers, bools, null, lists, objects, references,
// function calls, arithmetic, comparisons and the conditional operator.
// Diagnostics carry file and line, so errors print the way Terraform does.

export type Expr =
  | { k: 'lit'; v: Value; line: number }
  | { k: 'tpl'; parts: (string | Expr)[]; line: number }
  | { k: 'ref'; path: (string | number | Expr)[]; line: number; src: string }
  | { k: 'list'; items: Expr[]; line: number }
  | { k: 'obj'; items: [string, Expr][]; line: number }
  | { k: 'call'; name: string; args: Expr[]; line: number }
  | { k: 'bin'; op: string; a: Expr; b: Expr; line: number }
  | { k: 'not'; a: Expr; line: number }
  | { k: 'neg'; a: Expr; line: number }
  | { k: 'cond'; c: Expr; a: Expr; b: Expr; line: number };

export type Value = string | number | boolean | null | Value[] | { [k: string]: Value } | Unknown;
export class Unknown {
  readonly unknown = true;
}
export const UNKNOWN = new Unknown();
export const isUnknown = (v: unknown): v is Unknown => v instanceof Unknown;

export interface Attr {
  name: string;
  expr: Expr;
  line: number;
}

export interface HclBlock {
  type: string;
  labels: string[];
  attrs: Attr[];
  blocks: HclBlock[];
  line: number;
  file: string;
}

export interface Diag {
  severity: 'error' | 'warning';
  summary: string;
  detail: string;
  file?: string;
  line?: number;
  context?: string;
}

export class HclError extends Error {
  constructor(public diag: Diag) {
    super(diag.summary);
  }
}

type Tok = { t: 'id' | 'num' | 'str' | 'heredoc' | 'op' | 'nl' | 'eof'; v: string; line: number; parts?: (string | Tok[])[] };

function lexString(src: string, i: number, line: number): { end: number; parts: (string | Tok[])[] } {
  // i points after the opening quote. Returns raw parts: literal text and token lists of ${…}.
  const parts: (string | Tok[])[] = [];
  let buf = '';
  while (i < src.length) {
    const c = src[i];
    if (c === '"') return { end: i + 1, parts: [...parts, buf] };
    if (c === '\n') throw new HclError({ severity: 'error', summary: 'Unterminated template string', detail: 'No closing marker was found for the string.', line });
    if (c === '\\') {
      const n = src[i + 1];
      buf += n === 'n' ? '\n' : n === 't' ? '\t' : n === '"' ? '"' : n === '\\' ? '\\' : '\\' + n;
      i += 2;
      continue;
    }
    if (c === '$' && src[i + 1] === '{') {
      parts.push(buf);
      buf = '';
      let depth = 1;
      let j = i + 2;
      while (j < src.length && depth) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') depth--;
        if (depth) j++;
      }
      parts.push(lex(src.slice(i + 2, j), line).filter((t) => t.t !== 'nl' && t.t !== 'eof'));
      i = j + 1;
      continue;
    }
    buf += c;
    i++;
  }
  throw new HclError({ severity: 'error', summary: 'Unterminated template string', detail: 'No closing marker was found for the string.', line });
}

export function lex(src: string, startLine = 1): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let line = startLine;
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') {
      toks.push({ t: 'nl', v: '\n', line });
      line++;
      i++;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') {
      i++;
      continue;
    }
    if (c === '#' || (c === '/' && src[i + 1] === '/')) {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const chunk = src.slice(i, end < 0 ? src.length : end + 2);
      line += (chunk.match(/\n/g) ?? []).length;
      i += chunk.length;
      continue;
    }
    if (c === '"') {
      const r = lexString(src, i + 1, line);
      toks.push({ t: 'str', v: '', line, parts: r.parts });
      i = r.end;
      continue;
    }
    if (c === '<' && src[i + 1] === '<') {
      const m = /^<<-?([A-Z_]+)\n/.exec(src.slice(i));
      if (m) {
        const endRe = new RegExp(`\\n\\s*${m[1]}\\s*(\\n|$)`);
        const rest = src.slice(i + m[0].length);
        const em = endRe.exec('\n' + rest);
        const body = em ? rest.slice(0, Math.max(0, em.index - 1) + 1) : rest;
        const text = body.endsWith('\n') ? body : body + '\n';
        toks.push({ t: 'str', v: '', line, parts: [m[0].startsWith('<<-') ? text.replace(/^[ \t]+/gm, '') : text] });
        const consumed = m[0].length + (em ? em.index - 1 + em[0].length : rest.length);
        line += (src.slice(i, i + consumed).match(/\n/g) ?? []).length;
        i += consumed;
        toks.push({ t: 'nl', v: '\n', line: line - 1 });
        continue;
      }
    }
    const num = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (num) {
      toks.push({ t: 'num', v: num[0], line });
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(src.slice(i));
    if (id) {
      toks.push({ t: 'id', v: id[0], line });
      i += id[0].length;
      continue;
    }
    const op = /^(==|!=|<=|>=|&&|\|\||=>|\.\.\.|[{}[\]()=,.:?+\-*/%<>!])/.exec(src.slice(i));
    if (op) {
      toks.push({ t: 'op', v: op[0], line });
      i += op[0].length;
      continue;
    }
    throw new HclError({ severity: 'error', summary: 'Invalid character', detail: `This character is not used within the language: ${JSON.stringify(c)}`, line });
  }
  toks.push({ t: 'eof', v: '', line });
  return toks;
}

class P {
  i = 0;
  constructor(
    private toks: Tok[],
    private file: string,
  ) {}
  peek(off = 0): Tok {
    return this.toks[Math.min(this.i + off, this.toks.length - 1)];
  }
  next(): Tok {
    return this.toks[this.i++];
  }
  skipNl(): void {
    while (this.peek().t === 'nl') this.i++;
  }
  is(v: string): boolean {
    const t = this.peek();
    return t.t === 'op' && t.v === v;
  }
  expect(v: string, what: string): Tok {
    const t = this.next();
    if (t.t !== 'op' || t.v !== v) this.fail(t, `Missing ${what}`, `Expected ${JSON.stringify(v)} here.`);
    return t;
  }
  fail(t: Tok, summary: string, detail: string): never {
    throw new HclError({ severity: 'error', summary, detail, file: this.file, line: t.line });
  }

  body(end: string | null): { attrs: Attr[]; blocks: HclBlock[] } {
    const attrs: Attr[] = [];
    const blocks: HclBlock[] = [];
    for (;;) {
      this.skipNl();
      const t = this.peek();
      if (end && t.t === 'op' && t.v === end) {
        this.next();
        return { attrs, blocks };
      }
      if (t.t === 'eof') {
        if (end) this.fail(t, 'Unclosed configuration block', 'There is no closing brace for this block before the end of the file. This may be caused by incorrect brace nesting elsewhere in this file.');
        return { attrs, blocks };
      }
      if (t.t !== 'id') this.fail(t, 'Argument or block definition required', 'An argument or block definition is required here.');
      this.next();
      if (this.is('=')) {
        this.next();
        const expr = this.expr();
        const after = this.peek();
        if (after.t !== 'nl' && after.t !== 'eof' && !(after.t === 'op' && after.v === end)) this.fail(after, 'Missing newline after argument', 'An argument definition must end with a newline.');
        if (attrs.some((a) => a.name === t.v)) this.fail(t, 'Attribute redefined', `The argument "${t.v}" was already set. Each argument may be set only once.`);
        attrs.push({ name: t.v, expr, line: t.line });
        continue;
      }
      const labels: string[] = [];
      while (this.peek().t === 'str' || this.peek().t === 'id') {
        const l = this.next();
        labels.push(l.t === 'str' ? (l.parts ?? []).filter((p) => typeof p === 'string').join('') : l.v);
      }
      if (!this.is('{')) this.fail(this.peek(), 'Invalid block definition', 'Either a quoted string block label or an opening brace ("{") is expected here.');
      this.next();
      const b = this.body('}');
      blocks.push({ type: t.v, labels, attrs: b.attrs, blocks: b.blocks, line: t.line, file: this.file });
    }
  }

  expr(): Expr {
    const c = this.or();
    if (this.is('?')) {
      this.next();
      const a = this.expr();
      this.expect(':', 'false expression');
      const b = this.expr();
      return { k: 'cond', c, a, b, line: c.line };
    }
    return c;
  }
  or(): Expr {
    let a = this.and();
    while (this.is('||')) {
      this.next();
      a = { k: 'bin', op: '||', a, b: this.and(), line: a.line };
    }
    return a;
  }
  and(): Expr {
    let a = this.cmp();
    while (this.is('&&')) {
      this.next();
      a = { k: 'bin', op: '&&', a, b: this.cmp(), line: a.line };
    }
    return a;
  }
  cmp(): Expr {
    let a = this.add();
    while (['==', '!=', '<', '>', '<=', '>='].some((o) => this.is(o))) {
      const op = this.next().v;
      a = { k: 'bin', op, a, b: this.add(), line: a.line };
    }
    return a;
  }
  add(): Expr {
    let a = this.mul();
    while (this.is('+') || this.is('-')) {
      const op = this.next().v;
      a = { k: 'bin', op, a, b: this.mul(), line: a.line };
    }
    return a;
  }
  mul(): Expr {
    let a = this.unary();
    while (this.is('*') || this.is('/') || this.is('%')) {
      const op = this.next().v;
      a = { k: 'bin', op, a, b: this.unary(), line: a.line };
    }
    return a;
  }
  unary(): Expr {
    if (this.is('!')) {
      const t = this.next();
      return { k: 'not', a: this.unary(), line: t.line };
    }
    if (this.is('-')) {
      const t = this.next();
      return { k: 'neg', a: this.unary(), line: t.line };
    }
    return this.postfix(this.primary());
  }
  postfix(e: Expr): Expr {
    for (;;) {
      if (this.is('.') && e.k === 'ref') {
        this.next();
        const t = this.next();
        if (t.t !== 'id' && t.t !== 'num') this.fail(t, 'Invalid attribute name', 'An attribute name is required after a dot.');
        e = { ...e, path: [...e.path, t.t === 'num' ? Number(t.v) : t.v], src: `${e.src}.${t.v}` };
      } else if (this.is('[') && e.k === 'ref') {
        this.next();
        this.skipNl();
        const idx = this.expr();
        this.skipNl();
        this.expect(']', 'close bracket');
        const lit = idx.k === 'lit' && (typeof idx.v === 'number' || typeof idx.v === 'string') ? idx.v : idx;
        e = { ...e, path: [...e.path, lit as string | number | Expr], src: `${e.src}[${idx.k === 'lit' ? JSON.stringify(idx.v) : '…'}]` };
      } else return e;
    }
  }
  primary(): Expr {
    const t = this.next();
    if (t.t === 'num') return { k: 'lit', v: Number(t.v), line: t.line };
    if (t.t === 'str') {
      const parts: (string | Expr)[] = (t.parts ?? []).map((p) => {
        if (typeof p === 'string') return p;
        const sub = new P([...p, { t: 'eof', v: '', line: t.line }], this.file);
        return sub.expr();
      });
      if (parts.every((p) => typeof p === 'string')) return { k: 'lit', v: parts.join(''), line: t.line };
      return { k: 'tpl', parts, line: t.line };
    }
    if (t.t === 'id') {
      if (t.v === 'true' || t.v === 'false') return { k: 'lit', v: t.v === 'true', line: t.line };
      if (t.v === 'null') return { k: 'lit', v: null, line: t.line };
      if (this.is('(')) {
        this.next();
        const args: Expr[] = [];
        this.skipNl();
        while (!this.is(')')) {
          args.push(this.expr());
          this.skipNl();
          if (this.is(',')) {
            this.next();
            this.skipNl();
          } else break;
        }
        this.skipNl();
        this.expect(')', 'closing parenthesis');
        return { k: 'call', name: t.v, args, line: t.line };
      }
      return { k: 'ref', path: [t.v], line: t.line, src: t.v };
    }
    if (t.t === 'op' && t.v === '(') {
      const e = this.expr();
      this.expect(')', 'closing parenthesis');
      return e;
    }
    if (t.t === 'op' && t.v === '[') {
      const items: Expr[] = [];
      this.skipNl();
      while (!this.is(']')) {
        items.push(this.expr());
        this.skipNl();
        if (this.is(',')) {
          this.next();
          this.skipNl();
        } else break;
      }
      this.skipNl();
      this.expect(']', 'close bracket');
      return { k: 'list', items, line: t.line };
    }
    if (t.t === 'op' && t.v === '{') {
      const items: [string, Expr][] = [];
      this.skipNl();
      while (!this.is('}')) {
        const k = this.next();
        const key = k.t === 'str' ? (k.parts ?? []).filter((p) => typeof p === 'string').join('') : k.v;
        if (!this.is('=') && !this.is(':')) this.fail(this.peek(), 'Missing key/value separator', 'Expected an equals sign ("=") to mark the beginning of the attribute value.');
        this.next();
        items.push([key, this.expr()]);
        this.skipNl();
        if (this.is(',')) this.next();
        this.skipNl();
      }
      this.next();
      return { k: 'obj', items, line: t.line };
    }
    this.fail(t, 'Invalid expression', 'Expected the start of an expression, but found an invalid expression token.');
  }
}

export function parseHcl(text: string, file: string): HclBlock[] {
  try {
    const p = new P(lex(text), file);
    const b = p.body(null);
    if (b.attrs.length) {
      const a = b.attrs[0];
      throw new HclError({ severity: 'error', summary: 'Unsupported argument', detail: `An argument named "${a.name}" is not expected here.`, file, line: a.line });
    }
    return b.blocks;
  } catch (e) {
    if (e instanceof HclError) {
      e.diag.file ??= file;
      throw e;
    }
    throw e;
  }
}

/** Terraform's diagnostic box. */
export function formatDiag(d: Diag, sources: Record<string, string>, color = false): string {
  const red = (s: string) => (color ? `\x1b[31m${s}\x1b[0m` : s);
  const yel = (s: string) => (color ? `\x1b[33m${s}\x1b[0m` : s);
  const bar = d.severity === 'error' ? red('│') : yel('│');
  const lines = [d.severity === 'error' ? red('╷') : yel('╷'), `${bar} ${color ? '\x1b[1m' : ''}${d.severity === 'error' ? red('Error: ') : yel('Warning: ')}${d.summary}${color ? '\x1b[0m' : ''}`, bar];
  if (d.file && d.line) {
    const src = sources[d.file]?.split('\n')[d.line - 1];
    lines.push(`${bar}   on ${d.file} line ${d.line}${d.context ? `, in ${d.context}` : ''}:`);
    if (src !== undefined) lines.push(`${bar}   ${String(d.line).padStart(2)}: ${src}`);
    lines.push(bar);
  }
  for (const l of d.detail.split('\n')) lines.push(`${bar} ${l}`);
  lines.push(d.severity === 'error' ? red('╵') : yel('╵'));
  return lines.join('\n') + '\n';
}
