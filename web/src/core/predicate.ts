// The predicate language over facts (09 §2.3), TypeScript side.
//
//   predicate := disj
//   disj      := conj ('||' conj)*
//   conj      := unary ('&&' unary)*
//   unary     := '!' unary | '(' predicate ')' | term
//   term      := path (op value)?          -- no op: "at least one exists"
//   path      := step ('.' step)*
//   step      := ident sel* '#'? | '#'     -- '#': number of elements
//   sel       := '[' field op value ']'    -- filter array elements
//              | '[' field ']'             -- keep elements where field exists
//              | '[' string ']'            -- dictionary key: files['/etc/hosts']
//              | '[' first|last|int ']'    -- index
//   op        := = != < <= > >= has in ~ =~
//   value     := number | size | duration | string | bare-word | macro | '[' value, … ']'
//   size      := number (Ki|Mi|Gi|K|M|G|k)   -- binary, as the kernel and systemd
//   duration  := number (ms|s|m|h)            -- milliseconds
//   macro     := @pid(cmd) | @start.<path> | @now
//
// Semantics: a path through an array means "some element"; `#` counts;
// `has` tests array membership; `in` tests list membership; `~` is substring
// (strings only); `=~` is a regular expression; 'max' compares as +∞;
// comparing with a set (macro or list) by `=` means "is in".

export type Value = string | number | boolean | null | Value[] | { [k: string]: unknown };

type Op = '=' | '!=' | '<' | '<=' | '>' | '>=' | 'has' | 'in' | '~' | '=~';

type Sel =
  | { kind: 'filter'; field: string[]; op?: Op; value?: Lit }
  | { kind: 'key'; key: string }
  | { kind: 'index'; index: 'first' | 'last' | number };

type Step = { kind: 'field'; name: string; sels: Sel[]; count: boolean } | { kind: 'count' };

type Lit =
  | { kind: 'num'; v: number }
  | { kind: 'str'; v: string; bare: boolean }
  | { kind: 'list'; v: Lit[] }
  | { kind: 'macro'; name: 'pid' | 'start' | 'now'; arg?: string; path?: Step[] };

export type Node =
  | { kind: 'or' | 'and'; items: Node[] }
  | { kind: 'not'; item: Node }
  | { kind: 'term'; path: Step[]; op?: Op; value?: Lit; src: string };

export class PredicateError extends Error {
  constructor(
    msg: string,
    public pos: number,
  ) {
    super(msg);
  }
}

const SIZE: Record<string, number> = { Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, K: 1024, M: 1024 ** 2, G: 1024 ** 3, k: 1000 };
const DUR: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 };

class Parser {
  i = 0;
  constructor(private src: string) {}

  fail(msg: string): never {
    throw new PredicateError(`${msg} at ${this.i} in "${this.src}"`, this.i);
  }
  ws(): void {
    while (this.i < this.src.length && /\s/.test(this.src[this.i])) this.i++;
  }
  peek(s: string): boolean {
    this.ws();
    return this.src.startsWith(s, this.i);
  }
  eat(s: string): boolean {
    if (this.peek(s)) {
      this.i += s.length;
      return true;
    }
    return false;
  }
  expect(s: string): void {
    if (!this.eat(s)) this.fail(`expected '${s}'`);
  }

  parse(): Node {
    const n = this.disj();
    this.ws();
    if (this.i < this.src.length) this.fail('unexpected input');
    return n;
  }
  disj(): Node {
    const items = [this.conj()];
    while (this.eat('||')) items.push(this.conj());
    return items.length === 1 ? items[0] : { kind: 'or', items };
  }
  conj(): Node {
    const items = [this.unary()];
    while (this.eat('&&')) items.push(this.unary());
    return items.length === 1 ? items[0] : { kind: 'and', items };
  }
  unary(): Node {
    if (this.peek('!') && !this.peek('!=')) {
      this.i++;
      return { kind: 'not', item: this.unary() };
    }
    if (this.eat('(')) {
      const n = this.disj();
      this.expect(')');
      return n;
    }
    return this.term();
  }
  term(): Node {
    this.ws();
    const start = this.i;
    const path = this.path();
    const op = this.op();
    const value = op ? this.value() : undefined;
    return { kind: 'term', path, op, value, src: this.src.slice(start, this.i).trim() };
  }
  ident(): string {
    this.ws();
    const m = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(this.src.slice(this.i));
    if (!m) this.fail('expected a name');
    // A trailing '-' belongs to an operator-free bare word only inside values; in paths names are [A-Za-z0-9_-].
    this.i += m[0].length;
    return m[0];
  }
  path(): Step[] {
    const steps: Step[] = [this.step()];
    while (this.src[this.i] === '.') {
      this.i++;
      steps.push(this.step());
    }
    return steps;
  }
  step(): Step {
    if (this.src[this.i] === '#') {
      this.i++;
      return { kind: 'count' };
    }
    const name = this.ident();
    const sels: Sel[] = [];
    while (this.src[this.i] === '[') {
      this.i++;
      sels.push(this.sel());
      this.expect(']');
    }
    let count = false;
    if (this.src[this.i] === '#') {
      this.i++;
      count = true;
    }
    return { kind: 'field', name, sels, count };
  }
  sel(): Sel {
    this.ws();
    const c = this.src[this.i];
    if (c === "'" || c === '"') return { kind: 'key', key: this.string() };
    const m = /^(first|last|-?\d+)\s*\]/.exec(this.src.slice(this.i));
    if (m) {
      this.i += m[1].length;
      return { kind: 'index', index: m[1] === 'first' || m[1] === 'last' ? m[1] : Number(m[1]) };
    }
    const field = [this.ident()];
    while (this.src[this.i] === '.') {
      this.i++;
      field.push(this.ident());
    }
    const op = this.op();
    if (!op) return { kind: 'filter', field };
    return { kind: 'filter', field, op, value: this.value() };
  }
  op(): Op | undefined {
    this.ws();
    for (const o of ['<=', '>=', '!=', '=~', '=', '<', '>', '~'] as const) {
      if (this.src.startsWith(o, this.i)) {
        this.i += o.length;
        return o;
      }
    }
    for (const o of ['has', 'in'] as const) {
      if (this.src.startsWith(o, this.i) && /[\s'"[@]/.test(this.src[this.i + o.length] ?? '')) {
        this.i += o.length;
        return o;
      }
    }
    return undefined;
  }
  string(): string {
    const q = this.src[this.i];
    this.i++;
    let out = '';
    while (this.i < this.src.length && this.src[this.i] !== q) {
      if (this.src[this.i] === '\\' && this.i + 1 < this.src.length) {
        out += this.src[this.i + 1];
        this.i += 2;
      } else out += this.src[this.i++];
    }
    if (this.src[this.i] !== q) this.fail('unclosed string');
    this.i++;
    return out;
  }
  value(): Lit {
    this.ws();
    const c = this.src[this.i];
    if (c === "'" || c === '"') return { kind: 'str', v: this.string(), bare: false };
    if (c === '[') {
      this.i++;
      const v: Lit[] = [];
      if (!this.eat(']')) {
        do v.push(this.value());
        while (this.eat(','));
        this.expect(']');
      }
      return { kind: 'list', v };
    }
    if (c === '@') return this.macro();
    // bare word: up to whitespace, ] ) , or && ||
    let j = this.i;
    while (j < this.src.length && !/[\s\]),]/.test(this.src[j]) && !this.src.startsWith('&&', j) && !this.src.startsWith('||', j)) j++;
    const word = this.src.slice(this.i, j);
    if (!word) this.fail('expected a value');
    this.i = j;
    const num = /^(-?\d+(?:\.\d+)?)(Ki|Mi|Gi|K|M|G|k|ms|s|m|h)?$/.exec(word);
    if (num) {
      const n = Number(num[1]);
      const u = num[2];
      if (!u) return { kind: 'num', v: n };
      if (u in SIZE) return { kind: 'num', v: n * SIZE[u] };
      return { kind: 'num', v: n * DUR[u] };
    }
    return { kind: 'str', v: word, bare: true };
  }
  macro(): Lit {
    this.i++; // @
    const name = this.ident();
    if (name === 'pid') {
      this.expect('(');
      let j = this.i;
      while (j < this.src.length && this.src[j] !== ')') j++;
      const arg = this.src.slice(this.i, j).trim();
      this.i = j;
      this.expect(')');
      return { kind: 'macro', name: 'pid', arg };
    }
    if (name === 'start') {
      this.expect('.');
      return { kind: 'macro', name: 'start', path: this.path() };
    }
    if (name === 'now') return { kind: 'macro', name: 'now' };
    return this.fail(`unknown macro @${name}`);
  }
}

const cache = new Map<string, Node>();

/** Parse a predicate; throws PredicateError with the position on a syntax error. */
export function compile(src: string): Node {
  let n = cache.get(src);
  if (!n) {
    n = new Parser(src).parse();
    cache.set(src, n);
  }
  return n;
}

interface Env {
  facts: unknown;
  start?: unknown;
  matched: string[];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Walk a path from `root`; returns every value reached (existential semantics). */
function walk(root: unknown, steps: Step[], env: Env): unknown[] {
  let cur: unknown[] = [root];
  for (const st of steps) {
    const next: unknown[] = [];
    if (st.kind === 'count') {
      for (const v of cur) next.push(Array.isArray(v) ? v.length : isObj(v) ? Object.keys(v).length : v === undefined ? 0 : 1);
      cur = next;
      continue;
    }
    for (const v of cur) {
      const pick = (o: unknown) => {
        if (isObj(o) && st.name in o) next.push(o[st.name]);
      };
      if (Array.isArray(v)) v.forEach(pick);
      else pick(v);
    }
    cur = next;
    for (const sel of st.sels) cur = cur.flatMap((v) => applySel(v, sel, env));
    if (st.count) cur = cur.map((v) => (Array.isArray(v) ? v.length : isObj(v) ? Object.keys(v).length : 0));
  }
  return cur;
}

function applySel(v: unknown, sel: Sel, env: Env): unknown[] {
  if (sel.kind === 'key') {
    if (isObj(v) && sel.key in v) return [v[sel.key]];
    if (Array.isArray(v)) return v.filter(isObj).filter((o) => sel.key in o).map((o) => o[sel.key]);
    return [];
  }
  if (sel.kind === 'index') {
    if (!Array.isArray(v) || v.length === 0) return [];
    const i = sel.index === 'first' ? 0 : sel.index === 'last' ? v.length - 1 : sel.index < 0 ? v.length + sel.index : sel.index;
    return i >= 0 && i < v.length ? [v[i]] : [];
  }
  // filter: arrays keep the elements that match; dictionaries filter their values
  const items = Array.isArray(v) ? v : isObj(v) ? Object.values(v) : [];
  const keep = items.filter((el) => {
    const vals = walk(el, [{ kind: 'field', name: sel.field[0], sels: [], count: false }, ...sel.field.slice(1).map((n) => ({ kind: 'field' as const, name: n, sels: [], count: false }))], env);
    if (!sel.op) return vals.some(present);
    return vals.some((x) => compare(x, sel.op!, resolveLit(sel.value!, env)));
  });
  return [keep];
}

function present(v: unknown): boolean {
  if (v === undefined || v === null || v === false) return false;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

type Resolved = { set: false; v: unknown } | { set: true; v: unknown[] };

function resolveLit(l: Lit, env: Env): Resolved {
  switch (l.kind) {
    case 'num':
      return { set: false, v: l.v };
    case 'str':
      if (l.bare && (l.v === 'true' || l.v === 'false')) return { set: false, v: l.v === 'true' };
      return { set: false, v: l.v };
    case 'list':
      return { set: true, v: l.v.map((x) => resolveLit(x, env)).flatMap((r) => (r.set ? r.v : [r.v])) };
    case 'macro':
      if (l.name === 'now') return { set: false, v: Date.now() };
      if (l.name === 'pid') {
        const procs = isObj(env.facts) && Array.isArray(env.facts.procs) ? (env.facts.procs as { pid: number; cmd: string }[]) : [];
        const pids = procs.filter((p) => p.cmd === l.arg).map((p) => p.pid);
        return pids.length ? { set: false, v: Math.min(...pids) } : { set: false, v: undefined };
      }
      return { set: true, v: env.start === undefined ? [] : walk(env.start, l.path!, env) };
  }
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (v === 'max') return Infinity;
  return undefined;
}

function compare(lhs: unknown, op: Op, rhs: Resolved): boolean {
  if (op === 'has') {
    if (!Array.isArray(lhs)) return false;
    const want = rhs.set ? rhs.v : [rhs.v];
    return want.some((w) => lhs.some((x) => eq(x, w)));
  }
  if (Array.isArray(lhs)) return lhs.some((x) => compare(x, op, rhs));
  if (op === 'in' || (rhs.set && (op === '=' || op === '!='))) {
    const list = rhs.set ? rhs.v : Array.isArray(rhs.v) ? rhs.v : [rhs.v];
    const inside = list.some((w) => eq(lhs, w));
    return op === '!=' ? !inside : inside;
  }
  const r = rhs.v;
  switch (op) {
    case '=':
      return eq(lhs, r);
    case '!=':
      return lhs !== undefined && !eq(lhs, r);
    case '~':
      return typeof lhs === 'string' && typeof r === 'string' && lhs.includes(r);
    case '=~':
      if (typeof lhs !== 'string' || typeof r !== 'string') return false;
      try {
        return new RegExp(r, 'm').test(lhs);
      } catch {
        return false;
      }
    default: {
      const a = num(lhs);
      const b = num(r);
      if (a === undefined || b === undefined) {
        if (typeof lhs === 'string' && typeof r === 'string') return cmpOrder(lhs < r ? -1 : lhs > r ? 1 : 0, op);
        return false;
      }
      return cmpOrder(a < b ? -1 : a > b ? 1 : 0, op);
    }
  }
}

function cmpOrder(c: number, op: Op): boolean {
  return op === '<' ? c < 0 : op === '<=' ? c <= 0 : op === '>' ? c > 0 : c >= 0;
}

function eq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'string') return String(a) === b;
  if (typeof a === 'string' && typeof b === 'number') return a === String(b);
  if (typeof a === 'boolean' && typeof b === 'string') return String(a) === b;
  if (a === 'max' && b === Infinity) return true;
  return false;
}

function evalNode(n: Node, env: Env): boolean {
  switch (n.kind) {
    case 'or':
      return n.items.some((x) => evalNode(x, env));
    case 'and':
      return n.items.every((x) => evalNode(x, env));
    case 'not':
      return !evalNode(n.item, env);
    case 'term': {
      const vals = walk(env.facts, n.path, env);
      const ok = n.op ? vals.some((v) => compare(v, n.op!, resolveLit(n.value!, env))) : vals.some(present);
      env.matched.push(`${ok ? '✓' : '✗'} ${n.src}`);
      return ok;
    }
  }
}

/** Evaluate a predicate over facts. `start` is the snapshot taken when the attempt started (for @start). */
export function evaluate(pred: string, facts: unknown, start?: unknown): { pass: boolean; matched: string[] } {
  const env: Env = { facts, start, matched: [] };
  const pass = evalNode(compile(pred), env);
  return { pass, matched: env.matched };
}

/** True if the predicate reads typed command text, which `when` must never do (09 §2.4). */
export function readsTypedText(pred: string): boolean {
  const n = compile(pred);
  const visit = (x: Node): boolean => {
    if (x.kind === 'term') return x.path.some((s) => s.kind === 'field' && (s.name === 'line' || s.name === 'history'));
    if (x.kind === 'not') return visit(x.item);
    return x.items.some(visit);
  };
  return visit(n);
}
