// A PromQL subset engine (06 §7.4–7.6): instant and range vector selectors
// with the four matchers and offset; rate, irate, increase, delta,
// *_over_time, changes, absent, histogram_quantile, label_replace, abs,
// round, time(); aggregation (sum, avg, min, max, count, topk, bottomk)
// with by/without; arithmetic and comparison operators (with bool) and vector
// matching with on/ignoring and group_left/group_right. Semantics follow
// Prometheus 3: range windows are left-open, instant selectors look back 5m,
// rate extrapolates to the window boundaries like extrapolatedRate().

import { seriesKey, type Labels, type Tsdb } from './data';

export type Node =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'sel'; name?: string; matchers: Matcher[]; range?: number; offset?: number }
  | { t: 'sub'; e: Node; range: number; step?: number }
  | { t: 'call'; fn: string; args: Node[] }
  | { t: 'agg'; op: string; by?: string[]; without?: string[]; param?: Node; e: Node }
  | { t: 'bin'; op: string; a: Node; b: Node; bool: boolean; on?: string[]; ignoring?: string[]; group?: 'left' | 'right'; include: string[] }
  | { t: 'neg'; e: Node }
  | { t: 'paren'; e: Node };

export interface Matcher {
  name: string;
  op: '=' | '!=' | '=~' | '!~';
  value: string;
}

export interface Sample {
  labels: Labels;
  value: number;
}

export type Result = { type: 'vector'; data: Sample[] } | { type: 'scalar'; value: number } | { type: 'matrix'; data: { labels: Labels; samples: [number, number][] }[] } | { type: 'string'; value: string };

export class PromQLError extends Error {
  constructor(
    msg: string,
    public pos?: number,
  ) {
    super(msg);
  }
}

const DUR: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000, y: 31_536_000_000 };
export function parseDuration(s: string): number {
  const re = /(\d+)(ms|s|m|h|d|w|y)/g;
  let total = 0;
  let consumed = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    total += Number(m[1]) * DUR[m[2]];
    consumed += m[0].length;
  }
  if (!consumed || consumed !== s.length) throw new PromQLError(`not a valid duration string: "${s}"`);
  return total;
}

type Tok = { k: 'id' | 'num' | 'str' | 'op' | 'dur' | 'eof'; v: string; pos: number };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '#') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      let v = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\' && c !== '`') {
          const n = src[j + 1];
          v += n === 'n' ? '\n' : n === 't' ? '\t' : n;
          j += 2;
        } else v += src[j++];
      }
      if (j >= src.length) throw new PromQLError(`1:${i + 1}: parse error: unterminated quoted string ${src.slice(i)}`, i);
      out.push({ k: 'str', v, pos: i });
      i = j + 1;
      continue;
    }
    const dur = /^(\d+(ms|s|m|h|d|w|y))+/.exec(src.slice(i));
    if (dur && out.length && out[out.length - 1].v === '[' || dur && out.length && ['offset', ':'].includes(out[out.length - 1].v)) {
      out.push({ k: 'dur', v: dur![0], pos: i });
      i += dur![0].length;
      continue;
    }
    const num = /^(\d+\.?\d*(e[+-]?\d+)?|\.\d+|Inf|NaN)/i.exec(src.slice(i));
    if (num && !/^[A-Za-z_]/.test(src.slice(i)) || (num && /^(Inf|NaN)\b/i.test(src.slice(i)))) {
      out.push({ k: 'num', v: num![0], pos: i });
      i += num![0].length;
      continue;
    }
    const id = /^[A-Za-z_:][A-Za-z0-9_:]*/.exec(src.slice(i));
    if (id) {
      out.push({ k: 'id', v: id[0], pos: i });
      i += id[0].length;
      continue;
    }
    const op = /^(==|!=|=~|!~|>=|<=|[+\-*/%^<>(){}[\],=:])/.exec(src.slice(i));
    if (op) {
      out.push({ k: 'op', v: op[0], pos: i });
      i += op[0].length;
      continue;
    }
    throw new PromQLError(`1:${i + 1}: parse error: unexpected character: '${c}'`, i);
  }
  out.push({ k: 'eof', v: '', pos: src.length });
  return out;
}

const AGG = new Set(['sum', 'avg', 'min', 'max', 'count', 'topk', 'bottomk', 'stddev', 'group']);
const FUNCS = new Set(['deriv', 'predict_linear', 'rate', 'irate', 'increase', 'delta', 'avg_over_time', 'max_over_time', 'min_over_time', 'sum_over_time', 'count_over_time', 'changes', 'resets', 'absent', 'absent_over_time', 'histogram_quantile', 'label_replace', 'abs', 'round', 'ceil', 'floor', 'time', 'vector', 'scalar', 'clamp_min', 'clamp_max', 'sort', 'sort_desc', 'timestamp']);
const RANGE_FUNCS = new Set(['deriv', 'predict_linear', 'rate', 'irate', 'increase', 'delta', 'avg_over_time', 'max_over_time', 'min_over_time', 'sum_over_time', 'count_over_time', 'changes', 'resets', 'absent_over_time']);
const PREC: Record<string, number> = { or: 1, and: 2, unless: 2, '==': 3, '!=': 3, '<': 3, '>': 3, '<=': 3, '>=': 3, '+': 4, '-': 4, '*': 5, '/': 5, '%': 5, '^': 6 };

class Parser {
  i = 0;
  constructor(private toks: Tok[]) {}
  peek(): Tok {
    return this.toks[this.i];
  }
  next(): Tok {
    return this.toks[this.i++];
  }
  isOp(v: string): boolean {
    const t = this.peek();
    return (t.k === 'op' || t.k === 'id') && t.v === v;
  }
  expect(v: string, ctx: string): void {
    const t = this.next();
    if (t.v !== v) this.fail(t, `unexpected ${t.k === 'eof' ? 'end of input' : `"${t.v}"`} in ${ctx}, expected "${v}"`);
  }
  fail(t: Tok, msg: string): never {
    throw new PromQLError(`1:${t.pos + 1}: parse error: ${msg}`, t.pos);
  }
  parse(): Node {
    const n = this.expr(0);
    const t = this.peek();
    if (t.k !== 'eof') this.fail(t, `unexpected "${t.v}"`);
    return n;
  }
  expr(min: number): Node {
    let a = this.unary();
    for (;;) {
      const t = this.peek();
      const op = t.v;
      const p = PREC[op];
      if ((t.k !== 'op' && !['and', 'or', 'unless'].includes(op)) || p === undefined || p < min) return a;
      this.next();
      let bool = false;
      if (this.isOp('bool')) {
        this.next();
        bool = true;
      }
      let on: string[] | undefined;
      let ignoring: string[] | undefined;
      let group: 'left' | 'right' | undefined;
      let include: string[] = [];
      if (this.isOp('on') || this.isOp('ignoring')) {
        const w = this.next().v;
        const ls = this.labelList();
        if (w === 'on') on = ls;
        else ignoring = ls;
        if (this.isOp('group_left') || this.isOp('group_right')) {
          group = this.next().v === 'group_left' ? 'left' : 'right';
          if (this.isOp('(')) include = this.labelList();
        }
      }
      const b = this.expr(op === '^' ? p : p + 1);
      a = { t: 'bin', op, a, b, bool, on, ignoring, group, include };
    }
  }
  labelList(): string[] {
    this.expect('(', 'grouping opts');
    const out: string[] = [];
    while (!this.isOp(')')) {
      const t = this.next();
      if (t.k !== 'id') this.fail(t, `unexpected "${t.v}" in grouping opts, expected label`);
      out.push(t.v);
      if (this.isOp(',')) this.next();
    }
    this.next();
    return out;
  }
  unary(): Node {
    if (this.isOp('-')) {
      this.next();
      return { t: 'neg', e: this.unary() };
    }
    if (this.isOp('+')) {
      this.next();
      return this.unary();
    }
    return this.postfix(this.primary());
  }
  postfix(n: Node): Node {
    for (;;) {
      if (this.isOp('[')) {
        this.next();
        const d = this.next();
        if (d.k !== 'dur') this.fail(d, `unexpected "${d.v}" in subquery or range selector, expected duration`);
        if (this.isOp(':')) {
          this.next();
          let step: number | undefined;
          if (this.peek().k === 'dur') step = parseDuration(this.next().v);
          this.expect(']', 'subquery selector');
          n = { t: 'sub', e: n, range: parseDuration(d.v), step };
          continue;
        }
        this.expect(']', 'range selector');
        if (n.t !== 'sel' || n.range) this.fail(d, 'ranges only allowed for vector selectors');
        n = { ...n, range: parseDuration(d.v) };
      } else if (this.isOp('offset')) {
        this.next();
        const d = this.next();
        if (d.k !== 'dur') this.fail(d, `unexpected "${d.v}" in offset, expected duration`);
        if (n.t !== 'sel') this.fail(d, 'offset modifier must be preceded by a selector');
        n = { ...n, offset: parseDuration(d.v) };
      } else return n;
    }
  }
  primary(): Node {
    const t = this.next();
    if (t.k === 'num') return { t: 'num', v: /^inf$/i.test(t.v) ? Infinity : /^nan$/i.test(t.v) ? NaN : Number(t.v) };
    if (t.k === 'str') return { t: 'str', v: t.v };
    if (t.k === 'op' && t.v === '(') {
      const e = this.expr(0);
      this.expect(')', 'paren expression');
      return { t: 'paren', e };
    }
    if (t.k === 'op' && t.v === '{') {
      this.i--;
      return this.selector(undefined);
    }
    if (t.k === 'id') {
      if (AGG.has(t.v) && (this.isOp('(') || this.isOp('by') || this.isOp('without'))) return this.aggregation(t.v);
      if (this.isOp('(')) {
        if (!FUNCS.has(t.v)) this.fail(t, `unknown function with name "${t.v}"`);
        this.next();
        const args: Node[] = [];
        while (!this.isOp(')')) {
          args.push(this.expr(0));
          if (this.isOp(',')) this.next();
          else if (!this.isOp(')')) this.fail(this.peek(), `unexpected "${this.peek().v}" in function call`);
        }
        this.next();
        return { t: 'call', fn: t.v, args };
      }
      return this.selector(t.v);
    }
    this.fail(t, `unexpected ${t.k === 'eof' ? 'end of input' : `"${t.v}"`}`);
  }
  selector(name: string | undefined): Node {
    const matchers: Matcher[] = [];
    if (this.isOp('{')) {
      this.next();
      while (!this.isOp('}')) {
        const l = this.next();
        if (l.k !== 'id') this.fail(l, `unexpected "${l.v}" in label matching, expected label`);
        const op = this.next();
        if (!['=', '!=', '=~', '!~'].includes(op.v)) this.fail(op, `unexpected "${op.v}" in label matching, expected label matching operator`);
        const v = this.next();
        if (v.k !== 'str') this.fail(v, `unexpected "${v.v}" in label matching, expected string`);
        matchers.push({ name: l.v, op: op.v as Matcher['op'], value: v.v });
        if (this.isOp(',')) this.next();
        else if (!this.isOp('}')) this.fail(this.peek(), `unexpected "${this.peek().v}" in label matching, expected "," or "}"`);
      }
      this.next();
    }
    if (!name && !matchers.some((m) => !(m.op === '=~' && /^\.\*$/.test(m.value)) && !(m.op === '=' && m.value === '') && !(m.op === '!~'))) throw new PromQLError('vector selector must contain at least one non-empty matcher');
    return { t: 'sel', name, matchers };
  }
  aggregation(op: string): Node {
    let by: string[] | undefined;
    let without: string[] | undefined;
    if (this.isOp('by') || this.isOp('without')) {
      const w = this.next().v;
      const ls = this.labelList();
      if (w === 'by') by = ls;
      else without = ls;
    }
    this.expect('(', 'aggregation');
    let param: Node | undefined;
    if (op === 'topk' || op === 'bottomk') {
      param = this.expr(0);
      this.expect(',', 'aggregation');
    }
    const e = this.expr(0);
    this.expect(')', 'aggregation');
    if (this.isOp('by') || this.isOp('without')) {
      const w = this.next().v;
      const ls = this.labelList();
      if (w === 'by') by = ls;
      else without = ls;
    }
    return { t: 'agg', op, by, without, param, e };
  }
}

export function parse(src: string): Node {
  if (!src.trim()) throw new PromQLError('1:1: parse error: no expression found in input');
  return new Parser(lex(src)).parse();
}

// ── evaluation ──

const LOOKBACK = 5 * 60_000;

function matches(l: Labels, name: string | undefined, ms: Matcher[]): boolean {
  if (name && l.__name__ !== name) return false;
  for (const m of ms) {
    const v = l[m.name] ?? '';
    if (m.op === '=' && v !== m.value) return false;
    if (m.op === '!=' && v === m.value) return false;
    if (m.op === '=~' && !new RegExp(`^(?:${m.value})$`).test(v)) return false;
    if (m.op === '!~' && new RegExp(`^(?:${m.value})$`).test(v)) return false;
  }
  return true;
}

function dropName(l: Labels): Labels {
  const { __name__: _n, ...rest } = l;
  void _n;
  return rest;
}

/** Samples of a series in (from, to] — left-open, as in Prometheus 3. */
function window(samples: [number, number][], from: number, to: number): [number, number][] {
  let lo = 0;
  let hi = samples.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid][0] <= from) lo = mid + 1;
    else hi = mid;
  }
  const out: [number, number][] = [];
  for (let i = lo; i < samples.length && samples[i][0] <= to; i++) out.push(samples[i]);
  return out;
}

function extrapolated(pts: [number, number][], from: number, to: number, isCounter: boolean, isRate: boolean): number | null {
  if (pts.length < 2) return null;
  let result = pts[pts.length - 1][1] - pts[0][1];
  if (isCounter) {
    let prev = pts[0][1];
    for (const [, v] of pts.slice(1)) {
      if (v < prev) result += prev;
      prev = v;
    }
  }
  const sampledInterval = (pts[pts.length - 1][0] - pts[0][0]) / 1000;
  const avgInterval = sampledInterval / (pts.length - 1);
  let durToStart = (pts[0][0] - from) / 1000;
  let durToEnd = (to - pts[pts.length - 1][0]) / 1000;
  if (isCounter && result > 0 && pts[0][1] >= 0) {
    const durToZero = sampledInterval * (pts[0][1] / result);
    if (durToZero < durToStart) durToStart = durToZero;
  }
  const threshold = avgInterval * 1.1;
  const extendStart = durToStart < threshold ? durToStart : avgInterval / 2;
  const extendEnd = durToEnd < threshold ? durToEnd : avgInterval / 2;
  void (durToEnd = 0);
  const factor = (sampledInterval + extendStart + extendEnd) / sampledInterval;
  result *= factor;
  return isRate ? result / ((to - from) / 1000) : result;
}

export interface EvalCtx {
  db: Tsdb;
  /** Evaluation timestamp, ms. */
  t: number;
}

function isCounterName(db: Tsdb, name: string | undefined): boolean {
  if (!name) return true;
  if (name.endsWith('_total') || name.endsWith('_bucket') || name.endsWith('_count') || name.endsWith('_sum')) return true;
  return db.meta[name]?.type === 'counter';
}

function vec(r: Result, what: string): Sample[] {
  if (r.type === 'vector') return r.data;
  throw new PromQLError(`expected type instant vector in ${what}, got ${r.type === 'matrix' ? 'range vector' : r.type}`);
}

function sig(l: Labels, on?: string[], ignoring?: string[]): string {
  const keys = on ? on : Object.keys(l).filter((k) => k !== '__name__' && !(ignoring ?? []).includes(k));
  return keys
    .sort()
    .map((k) => `${k}=${l[k] ?? ''}`)
    .join(',');
}

function applyOp(op: string, a: number, b: number): number {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return a / b;
    case '%':
      return a % b;
    case '^':
      return a ** b;
    case '==':
      return a === b ? 1 : 0;
    case '!=':
      return a !== b ? 1 : 0;
    case '>':
      return a > b ? 1 : 0;
    case '<':
      return a < b ? 1 : 0;
    case '>=':
      return a >= b ? 1 : 0;
    case '<=':
      return a <= b ? 1 : 0;
  }
  throw new PromQLError(`unknown operator ${op}`);
}
const CMP = new Set(['==', '!=', '>', '<', '>=', '<=']);

export function bucketQuantile(q: number, buckets: { le: number; count: number }[]): number {
  if (q < 0) return -Infinity;
  if (q > 1) return Infinity;
  const bs = [...buckets].sort((x, y) => x.le - y.le);
  if (bs.length < 2 || bs[bs.length - 1].le !== Infinity) return NaN;
  const total = bs[bs.length - 1].count;
  if (total === 0) return NaN;
  const rank = q * total;
  let i = bs.findIndex((b) => b.count >= rank);
  if (i === bs.length - 1) return bs[bs.length - 2].le;
  if (i === 0 && bs[0].le <= 0) return bs[0].le;
  let start = 0;
  let countBefore = 0;
  if (i > 0) {
    start = bs[i - 1].le;
    countBefore = bs[i - 1].count;
  }
  const inBucket = bs[i].count - countBefore;
  if (inBucket === 0) {
    i = Math.max(0, i);
    return bs[i].le;
  }
  return start + (bs[i].le - start) * ((rank - countBefore) / inBucket);
}

export function evaluate(n: Node, ctx: EvalCtx): Result {
  const { db, t } = ctx;
  switch (n.t) {
    case 'num':
      return { type: 'scalar', value: n.v };
    case 'str':
      return { type: 'string', value: n.v };
    case 'paren':
      return evaluate(n.e, ctx);
    case 'neg': {
      const r = evaluate(n.e, ctx);
      if (r.type === 'scalar') return { type: 'scalar', value: -r.value };
      return { type: 'vector', data: vec(r, 'unary expression').map((s) => ({ labels: dropName(s.labels), value: -s.value })) };
    }
    case 'sel': {
      const at = t - (n.offset ?? 0);
      const hits = db.series.filter((s) => matches(s.labels, n.name, n.matchers));
      if (n.range) return { type: 'matrix', data: hits.map((s) => ({ labels: s.labels, samples: window(s.samples, at - n.range!, at) })).filter((x) => x.samples.length) };
      const data: Sample[] = [];
      for (const s of hits) {
        const w = window(s.samples, at - LOOKBACK, at);
        if (w.length) data.push({ labels: s.labels, value: w[w.length - 1][1] });
      }
      return { type: 'vector', data };
    }
    case 'sub': {
      const step = n.step ?? 60_000;
      const series = new Map<string, { labels: Labels; samples: [number, number][] }>();
      for (let ts = Math.ceil((t - n.range) / step) * step; ts <= t; ts += step) {
        if (ts <= t - n.range) continue;
        for (const s of vec(evaluate(n.e, { db, t: ts }), 'subquery')) {
          const k = seriesKey(s.labels);
          if (!series.has(k)) series.set(k, { labels: s.labels, samples: [] });
          series.get(k)!.samples.push([ts, s.value]);
        }
      }
      return { type: 'matrix', data: [...series.values()] };
    }
    case 'call':
      return call(n, ctx);
    case 'agg':
      return aggregate(n, ctx);
    case 'bin':
      return binary(n, ctx);
  }
}

function call(n: Extract<Node, { t: 'call' }>, ctx: EvalCtx): Result {
  const { db, t } = ctx;
  const arg = (i: number) => evaluate(n.args[i], ctx);
  if (RANGE_FUNCS.has(n.fn)) {
    const want = n.fn === 'predict_linear' ? 2 : 1;
    if (n.args.length !== want) throw new PromQLError(`expected ${want} argument(s) in call to "${n.fn}", got ${n.args.length}`);
    let ahead = 0;
    if (n.fn === 'predict_linear') {
      const sc = arg(1);
      if (sc.type !== 'scalar') throw new PromQLError(`expected type scalar in call to function "predict_linear", got ${sc.type}`);
      ahead = sc.value;
    }
    const a = n.args[0];
    if (!(a.t === 'sel' && a.range) && a.t !== 'sub') throw new PromQLError(`ranges only allowed for vector selectors`.replace(/.*/, `expected type range vector in call to function "${n.fn}", got instant vector`));
    const m = evaluate(a, ctx);
    if (m.type !== 'matrix') throw new PromQLError(`expected type range vector in call to function "${n.fn}", got ${m.type}`);
    const range = a.t === 'sel' ? a.range! : a.range;
    const at = t - (a.t === 'sel' ? a.offset ?? 0 : 0);
    if (n.fn === 'absent_over_time') return { type: 'vector', data: m.data.length ? [] : [{ labels: a.t === 'sel' ? Object.fromEntries(a.matchers.filter((x) => x.op === '=').map((x) => [x.name, x.value])) : {}, value: 1 }] };
    const out: Sample[] = [];
    for (const s of m.data) {
      const pts = s.samples;
      let v: number | null = null;
      const counter = isCounterName(db, s.labels.__name__);
      switch (n.fn) {
        case 'deriv':
        case 'predict_linear': {
          // Simple linear regression over the window, time in seconds relative to the evaluation time.
          if (pts.length < 2) break;
          const xs = pts.map((p) => (p[0] - at) / 1000);
          const mx = xs.reduce((a2, b2) => a2 + b2, 0) / xs.length;
          const my = pts.reduce((a2, p) => a2 + p[1], 0) / pts.length;
          let num = 0;
          let den = 0;
          pts.forEach((p, i) => {
            num += (xs[i] - mx) * (p[1] - my);
            den += (xs[i] - mx) ** 2;
          });
          const slope = den ? num / den : 0;
          v = n.fn === 'deriv' ? slope : my - slope * mx + slope * ahead;
          break;
        }
        case 'rate':
          v = extrapolated(pts, at - range, at, true, true);
          break;
        case 'increase':
          v = extrapolated(pts, at - range, at, true, false);
          break;
        case 'delta':
          v = extrapolated(pts, at - range, at, false, false);
          break;
        case 'irate': {
          if (pts.length < 2) break;
          const [t1, v1] = pts[pts.length - 2];
          const [t2, v2] = pts[pts.length - 1];
          v = (v2 < v1 ? v2 : v2 - v1) / ((t2 - t1) / 1000);
          break;
        }
        case 'avg_over_time':
          v = pts.reduce((x, p) => x + p[1], 0) / pts.length;
          break;
        case 'max_over_time':
          v = Math.max(...pts.map((p) => p[1]));
          break;
        case 'min_over_time':
          v = Math.min(...pts.map((p) => p[1]));
          break;
        case 'sum_over_time':
          v = pts.reduce((x, p) => x + p[1], 0);
          break;
        case 'count_over_time':
          v = pts.length;
          break;
        case 'changes':
        case 'resets': {
          let c = 0;
          for (let i = 1; i < pts.length; i++) if (n.fn === 'changes' ? pts[i][1] !== pts[i - 1][1] : pts[i][1] < pts[i - 1][1]) c++;
          v = c;
          break;
        }
      }
      void counter;
      if (v !== null && !Number.isNaN(v)) out.push({ labels: n.fn.endsWith('_over_time') && n.fn !== 'last_over_time' ? dropName(s.labels) : dropName(s.labels), value: v });
    }
    return { type: 'vector', data: out };
  }
  switch (n.fn) {
    case 'time':
      return { type: 'scalar', value: t / 1000 };
    case 'vector': {
      const s = arg(0);
      return { type: 'vector', data: [{ labels: {}, value: s.type === 'scalar' ? s.value : NaN }] };
    }
    case 'scalar': {
      const v = vec(arg(0), 'call to function "scalar"');
      return { type: 'scalar', value: v.length === 1 ? v[0].value : NaN };
    }
    case 'absent': {
      const v = vec(arg(0), 'call to function "absent"');
      const a = n.args[0];
      return { type: 'vector', data: v.length ? [] : [{ labels: a.t === 'sel' ? Object.fromEntries(a.matchers.filter((x) => x.op === '=').map((x) => [x.name, x.value])) : {}, value: 1 }] };
    }
    case 'abs':
    case 'ceil':
    case 'floor':
    case 'round': {
      const v = vec(arg(0), `call to function "${n.fn}"`);
      const f = n.fn === 'abs' ? Math.abs : n.fn === 'ceil' ? Math.ceil : n.fn === 'floor' ? Math.floor : Math.round;
      return { type: 'vector', data: v.map((s) => ({ labels: dropName(s.labels), value: f(s.value) })) };
    }
    case 'clamp_min':
    case 'clamp_max': {
      const v = vec(arg(0), `call to function "${n.fn}"`);
      const lim = arg(1);
      const x = lim.type === 'scalar' ? lim.value : NaN;
      return { type: 'vector', data: v.map((s) => ({ labels: dropName(s.labels), value: n.fn === 'clamp_min' ? Math.max(s.value, x) : Math.min(s.value, x) })) };
    }
    case 'sort':
    case 'sort_desc': {
      const v = [...vec(arg(0), 'sort')];
      v.sort((a, b) => (n.fn === 'sort' ? a.value - b.value : b.value - a.value));
      return { type: 'vector', data: v };
    }
    case 'timestamp':
      return { type: 'vector', data: vec(arg(0), 'timestamp').map((s) => ({ labels: dropName(s.labels), value: t / 1000 })) };
    case 'histogram_quantile': {
      const q = arg(0);
      if (q.type !== 'scalar') throw new PromQLError('expected type scalar in call to function "histogram_quantile", got instant vector');
      const v = vec(arg(1), 'call to function "histogram_quantile"');
      const groups = new Map<string, { labels: Labels; buckets: { le: number; count: number }[] }>();
      for (const s of v) {
        if (s.labels.le === undefined) continue;
        const { le, ...rest } = dropName(s.labels);
        const k = seriesKey(rest);
        if (!groups.has(k)) groups.set(k, { labels: rest, buckets: [] });
        groups.get(k)!.buckets.push({ le: le === '+Inf' ? Infinity : Number(le), count: s.value });
      }
      return { type: 'vector', data: [...groups.values()].map((g) => ({ labels: g.labels, value: bucketQuantile(q.value, g.buckets) })).filter((s) => !Number.isNaN(s.value)) };
    }
    case 'label_replace': {
      const v = vec(arg(0), 'call to function "label_replace"');
      const [dst, rep, srcL, re] = [1, 2, 3, 4].map((i) => {
        const r = arg(i);
        if (r.type !== 'string') throw new PromQLError(`expected type string in call to function "label_replace", got ${r.type}`);
        return r.value;
      });
      const rx = new RegExp(`^(?:${re})$`);
      return {
        type: 'vector',
        data: v.map((s) => {
          const m = rx.exec(s.labels[srcL] ?? '');
          if (!m) return s;
          const value = rep.replace(/\$(\d+)|\$\{(\d+)\}/g, (_x, a: string, b: string) => m[Number(a ?? b)] ?? '');
          const labels = { ...s.labels };
          if (value) labels[dst] = value;
          else delete labels[dst];
          return { labels, value: s.value };
        }),
      };
    }
  }
  throw new PromQLError(`unknown function with name "${n.fn}"`);
}

function aggregate(n: Extract<Node, { t: 'agg' }>, ctx: EvalCtx): Result {
  const v = vec(evaluate(n.e, ctx), `aggregation expression`);
  const keyLabels = (l: Labels): Labels => {
    const d = dropName(l);
    if (n.by) return Object.fromEntries(n.by.filter((k) => k in d).map((k) => [k, d[k]]));
    if (n.without) return Object.fromEntries(Object.entries(d).filter(([k]) => !n.without!.includes(k)));
    return {};
  };
  const groups = new Map<string, { labels: Labels; items: Sample[] }>();
  for (const s of v) {
    const kl = keyLabels(s.labels);
    const k = seriesKey(kl);
    if (!groups.has(k)) groups.set(k, { labels: kl, items: [] });
    groups.get(k)!.items.push(s);
  }
  if (n.op === 'topk' || n.op === 'bottomk') {
    const p = n.param ? evaluate(n.param, ctx) : { type: 'scalar' as const, value: 1 };
    const k = p.type === 'scalar' ? p.value : 1;
    const out: Sample[] = [];
    for (const g of groups.values()) out.push(...[...g.items].sort((a, b) => (n.op === 'topk' ? b.value - a.value : a.value - b.value)).slice(0, k));
    return { type: 'vector', data: out };
  }
  const data: Sample[] = [];
  for (const g of groups.values()) {
    const xs = g.items.map((s) => s.value);
    let value: number;
    switch (n.op) {
      case 'sum':
        value = xs.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        value = xs.reduce((a, b) => a + b, 0) / xs.length;
        break;
      case 'min':
        value = Math.min(...xs);
        break;
      case 'max':
        value = Math.max(...xs);
        break;
      case 'count':
        value = xs.length;
        break;
      case 'group':
        value = 1;
        break;
      case 'stddev': {
        const m = xs.reduce((a, b) => a + b, 0) / xs.length;
        value = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
        break;
      }
      default:
        throw new PromQLError(`unknown aggregation ${n.op}`);
    }
    data.push({ labels: g.labels, value });
  }
  return { type: 'vector', data };
}

function binary(n: Extract<Node, { t: 'bin' }>, ctx: EvalCtx): Result {
  const a = evaluate(n.a, ctx);
  const b = evaluate(n.b, ctx);
  const cmp = CMP.has(n.op);
  if (a.type === 'scalar' && b.type === 'scalar') {
    if (cmp && !n.bool) throw new PromQLError('comparisons between scalars must use BOOL modifier');
    return { type: 'scalar', value: applyOp(n.op, a.value, b.value) };
  }
  if (['and', 'or', 'unless'].includes(n.op)) {
    const A = vec(a, 'set operation');
    const B = vec(b, 'set operation');
    const sigs = new Set(B.map((s) => sig(s.labels, n.on, n.ignoring)));
    if (n.op === 'and') return { type: 'vector', data: A.filter((s) => sigs.has(sig(s.labels, n.on, n.ignoring))) };
    if (n.op === 'unless') return { type: 'vector', data: A.filter((s) => !sigs.has(sig(s.labels, n.on, n.ignoring))) };
    const asigs = new Set(A.map((s) => sig(s.labels, n.on, n.ignoring)));
    return { type: 'vector', data: [...A, ...B.filter((s) => !asigs.has(sig(s.labels, n.on, n.ignoring)))] };
  }
  const keepName = cmp && !n.bool;
  if (a.type === 'scalar' || b.type === 'scalar') {
    const v = vec(a.type === 'scalar' ? b : a, 'binary expression');
    const sc = (a.type === 'scalar' ? a : b) as { value: number };
    const data: Sample[] = [];
    for (const s of v) {
      const r = a.type === 'scalar' ? applyOp(n.op, sc.value, s.value) : applyOp(n.op, s.value, sc.value);
      if (cmp && !n.bool) {
        if (r) data.push({ labels: s.labels, value: s.value });
      } else data.push({ labels: dropName(s.labels), value: r });
    }
    return { type: 'vector', data };
  }
  const A = vec(a, 'binary expression');
  const B = vec(b, 'binary expression');
  const right = new Map<string, Sample[]>();
  for (const s of B) {
    const k = sig(s.labels, n.on, n.ignoring);
    right.set(k, [...(right.get(k) ?? []), s]);
  }
  if (!n.group) {
    const leftSigs = new Map<string, number>();
    for (const s of A) leftSigs.set(sig(s.labels, n.on, n.ignoring), (leftSigs.get(sig(s.labels, n.on, n.ignoring)) ?? 0) + 1);
    for (const [k, c] of leftSigs) if (c > 1 && right.has(k)) throw new PromQLError('found duplicate series for the match group on the left hand-side of the operation: many-to-many matching not allowed: matching labels must be unique on one side');
    for (const [k, rs] of right) if (rs.length > 1 && leftSigs.has(k)) throw new PromQLError('found duplicate series for the match group on the right hand-side of the operation: many-to-many matching not allowed: matching labels must be unique on one side');
  }
  const data: Sample[] = [];
  for (const s of A) {
    const k = sig(s.labels, n.on, n.ignoring);
    const rs = right.get(k);
    if (!rs?.length) continue;
    const r = rs[0];
    const value = applyOp(n.op, s.value, r.value);
    let labels: Labels;
    if (n.group === 'left') {
      labels = dropName(s.labels);
      for (const inc of n.include) if (r.labels[inc] !== undefined) labels[inc] = r.labels[inc];
    } else labels = n.on ? Object.fromEntries(n.on.filter((x) => s.labels[x] !== undefined).map((x) => [x, s.labels[x]])) : dropName(Object.fromEntries(Object.entries(s.labels).filter(([x]) => !(n.ignoring ?? []).includes(x))));
    if (keepName) {
      if (value) data.push({ labels: n.on || n.ignoring ? labels : s.labels, value: s.value });
    } else data.push({ labels, value });
  }
  return { type: 'vector', data };
}

/** Instant query: parse and evaluate at time t. */
export function query(db: Tsdb, src: string, t = db.end): Result {
  return evaluate(parse(src), { db, t });
}

/** Range query: the expression at each step, as a matrix. */
export function queryRange(db: Tsdb, src: string, start: number, end: number, step: number): { labels: Labels; samples: [number, number][] }[] {
  const node = parse(src);
  const series = new Map<string, { labels: Labels; samples: [number, number][] }>();
  for (let t = start; t <= end; t += step) {
    const r = evaluate(node, { db, t });
    const v = r.type === 'scalar' ? [{ labels: {}, value: r.value }] : r.type === 'vector' ? r.data : [];
    for (const s of v) {
      const k = seriesKey(s.labels);
      if (!series.has(k)) series.set(k, { labels: s.labels, samples: [] });
      series.get(k)!.samples.push([t, s.value]);
    }
  }
  return [...series.values()];
}

export function formatLabels(l: Labels): string {
  const name = l.__name__ ?? '';
  const rest = Object.entries(l).filter(([k]) => k !== '__name__');
  return `${name}{${rest.map(([k, v]) => `${k}="${v}"`).join(', ')}}`;
}

/** promql_equiv (06 §7.6, simplified): the same label sets and values within 1e-6 at several moments. */
export function equivalent(db: Tsdb, a: string, b: string, times: number[] = [db.end, db.end - 20 * 60_000, db.end - 70 * 60_000]): { ok: boolean; why?: string } {
  for (const t of times) {
    let ra: Result;
    let rb: Result;
    try {
      ra = query(db, a, t);
      rb = query(db, b, t);
    } catch (e) {
      return { ok: false, why: (e as Error).message };
    }
    const norm = (r: Result) => (r.type === 'scalar' ? [{ labels: {}, value: r.value }] : r.type === 'vector' ? r.data : []).map((s) => ({ k: seriesKey(dropName(s.labels)), v: s.value }));
    const A = norm(ra);
    const B = new Map(norm(rb).map((x) => [x.k, x.v]));
    if (A.length !== B.size) return { ok: false, why: `${A.length} series instead of ${B.size}` };
    for (const x of A) {
      const y = B.get(x.k);
      if (y === undefined) return { ok: false, why: `unexpected labels {${x.k}}` };
      if (!(Math.abs(x.v - y) <= 1e-6 * Math.max(1, Math.abs(y))) && !(Number.isNaN(x.v) && Number.isNaN(y))) return { ok: false, why: `value ${x.v} instead of ${y} for {${x.k}}` };
    }
  }
  return { ok: true };
}
