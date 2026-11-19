// A LogQL subset (06 §7.3 C14, O11) over the Shop logs: stream selectors,
// line filters, the json and logfmt parsers, label filters, line_format,
// unwrap; range aggregations (count_over_time, rate, bytes_over_time,
// sum/avg/min/max/quantile_over_time) and vector aggregations (sum, avg, min,
// max, count, topk, bottomk with by/without), arithmetic and comparisons
// between metric results. Errors use Loki's wording.

import type { Labels } from '../prom/data';
import type { LogDb, LogStream } from './data';

export class LogQLError extends Error {}

type MatchOp = '=' | '!=' | '=~' | '!~';
interface Matcher {
  name: string;
  op: MatchOp;
  value: string;
}

type Stage =
  | { k: 'line'; op: '|=' | '!=' | '|~' | '!~'; value: string }
  | { k: 'json' }
  | { k: 'logfmt' }
  | { k: 'label'; name: string; op: string; value: string | number; num: boolean }
  | { k: 'format'; tpl: string }
  | { k: 'unwrap'; name: string };

export interface LogExpr {
  k: 'log';
  matchers: Matcher[];
  stages: Stage[];
}

export type MetricExpr =
  | { k: 'range'; fn: string; log: LogExpr; range: number; param?: number; by?: string[]; without?: string[] }
  | { k: 'agg'; fn: string; by?: string[]; without?: string[]; param?: number; inner: MetricExpr }
  | { k: 'bin'; op: string; a: MetricExpr; b: MetricExpr }
  | { k: 'num'; v: number };

export type LogQLExpr = LogExpr | MetricExpr;

export type LogResult =
  | { type: 'streams'; data: { labels: Labels; entries: { ts: number; line: string }[] }[] }
  | { type: 'vector'; data: { labels: Labels; value: number }[] }
  | { type: 'scalar'; value: number };

/** A duration in seconds; decimals allowed, as in label filters (duration > 1.5s). */
function durSeconds(v: string): number | null {
  const re = /(\d+(?:\.\d+)?)(ms|s|m|h|d)/g;
  let total = 0;
  let used = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(v))) {
    total += Number(m[1]) * { ms: 0.001, s: 1, m: 60, h: 3600, d: 86400 }[m[2] as 'ms']!;
    used += m[0].length;
  }
  return used && used === v.length ? total : null;
}

const RANGE_FNS = ['count_over_time', 'rate', 'bytes_over_time', 'bytes_rate', 'sum_over_time', 'avg_over_time', 'min_over_time', 'max_over_time', 'quantile_over_time', 'absent_over_time'];
const UNWRAP_FNS = ['sum_over_time', 'avg_over_time', 'min_over_time', 'max_over_time', 'quantile_over_time'];
const AGG_FNS = ['sum', 'avg', 'min', 'max', 'count', 'topk', 'bottomk'];

// ── tokens ──

interface Tok {
  t: 'id' | 'str' | 'num' | 'dur' | 'op' | 'eof';
  v: string;
  pos: number;
}

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '"' || c === '`') {
      let j = i + 1;
      let v = '';
      while (j < src.length && src[j] !== c) {
        if (c === '"' && src[j] === '\\' && j + 1 < src.length) {
          const n = src[j + 1];
          v += n === 'n' ? '\n' : n === 't' ? '\t' : n;
          j += 2;
          continue;
        }
        v += src[j++];
      }
      if (j >= src.length) throw new LogQLError(`parse error at line 1, col ${i + 1}: literal not terminated`);
      out.push({ t: 'str', v, pos: i });
      i = j + 1;
      continue;
    }
    const dur = /^\d+(?:\.\d+)?(?:ms|s|m|h|d)(?:\d+(?:ms|s|m|h))*/.exec(src.slice(i));
    if (dur && !/[\w.]/.test(src[i + dur[0].length] ?? '')) {
      out.push({ t: 'dur', v: dur[0], pos: i });
      i += dur[0].length;
      continue;
    }
    const num = /^\d+(?:\.\d+)?(?:e[+-]?\d+)?/i.exec(src.slice(i));
    if (num) {
      out.push({ t: 'num', v: num[0], pos: i });
      i += num[0].length;
      continue;
    }
    const id = /^[a-zA-Z_][\w.]*/.exec(src.slice(i));
    if (id) {
      out.push({ t: 'id', v: id[0], pos: i });
      i += id[0].length;
      continue;
    }
    const op = /^(\|=|\|~|!=|!~|=~|==|>=|<=|\||=|>|<|\(|\)|\{|\}|\[|\]|,|\+|-|\*|\/|%)/.exec(src.slice(i));
    if (op) {
      out.push({ t: 'op', v: op[0], pos: i });
      i += op[0].length;
      continue;
    }
    throw new LogQLError(`parse error at line 1, col ${i + 1}: syntax error: unexpected ${c}`);
  }
  out.push({ t: 'eof', v: '', pos: src.length });
  return out;
}

// ── parser ──

class Parser {
  i = 0;
  constructor(private toks: Tok[]) {}
  peek(o = 0) {
    return this.toks[this.i + o];
  }
  next() {
    return this.toks[this.i++];
  }
  is(v: string) {
    return this.peek().v === v && this.peek().t !== 'str';
  }
  expect(v: string): Tok {
    const t = this.next();
    if (t.v !== v || t.t === 'str') throw new LogQLError(`parse error at line 1, col ${t.pos + 1}: syntax error: unexpected ${t.t === 'eof' ? '$end' : t.v || t.t}, expecting ${v}`);
    return t;
  }
  query(): LogQLExpr {
    const e = this.expr();
    if (this.peek().t !== 'eof') throw new LogQLError(`parse error at line 1, col ${this.peek().pos + 1}: syntax error: unexpected ${this.peek().v}`);
    return e;
  }
  expr(): LogQLExpr {
    let a = this.term();
    while (['+', '-', '>', '<', '>=', '<=', '==', '!='].includes(this.peek().v) && this.peek().t === 'op') {
      const op = this.next().v;
      const b = this.term();
      a = { k: 'bin', op, a: this.metric(a), b: this.metric(b) };
    }
    return a;
  }
  term(): LogQLExpr {
    let a = this.unary();
    while (['*', '/', '%'].includes(this.peek().v) && this.peek().t === 'op') {
      const op = this.next().v;
      const b = this.unary();
      a = { k: 'bin', op, a: this.metric(a), b: this.metric(b) };
    }
    return a;
  }
  metric(e: LogQLExpr): MetricExpr {
    if (e.k === 'log') throw new LogQLError('parse error : a log query cannot be used in a binary operation: aggregate it with a range function first, for example count_over_time({…}[5m])');
    return e;
  }
  unary(): LogQLExpr {
    const t = this.peek();
    if (t.t === 'num') {
      this.next();
      return { k: 'num', v: Number(t.v) };
    }
    if (t.v === '(' && t.t === 'op') {
      this.next();
      const e = this.expr();
      this.expect(')');
      return e;
    }
    if (t.v === '{' && t.t === 'op') return this.logExpr();
    if (t.t === 'id' && RANGE_FNS.includes(t.v)) return this.rangeAgg();
    if (t.t === 'id' && AGG_FNS.includes(t.v)) return this.vectorAgg();
    throw new LogQLError(`parse error at line 1, col ${t.pos + 1}: syntax error: unexpected ${t.t === 'eof' ? '$end' : t.v}${t.t === 'id' ? ' (a query starts with a stream selector {label="value"} or a function such as count_over_time)' : ''}`);
  }
  logExpr(): LogExpr {
    this.expect('{');
    const matchers: Matcher[] = [];
    while (!this.is('}')) {
      const name = this.next();
      if (name.t !== 'id') throw new LogQLError(`parse error at line 1, col ${name.pos + 1}: syntax error: unexpected ${name.v}, expecting IDENTIFIER`);
      const op = this.next();
      if (!['=', '!=', '=~', '!~'].includes(op.v)) throw new LogQLError(`parse error at line 1, col ${op.pos + 1}: syntax error: unexpected ${op.v}, expecting = or != or =~ or !~`);
      const val = this.next();
      if (val.t !== 'str') throw new LogQLError(`parse error at line 1, col ${val.pos + 1}: syntax error: unexpected ${val.v}, expecting STRING`);
      matchers.push({ name: name.v, op: op.v as MatchOp, value: val.v });
      if (this.is(',')) this.next();
    }
    this.expect('}');
    if (!matchers.length) throw new LogQLError('parse error : queries require at least one regexp or equality matcher that does not have an empty-compatible value. For instance, app=~".*" does not meet this requirement, but app=~".+" will');
    if (matchers.every((m) => (m.op === '=~' && new RegExp(`^(?:${m.value})$`).test('')) || m.op === '!=' || m.op === '!~')) throw new LogQLError('parse error : queries require at least one regexp or equality matcher that does not have an empty-compatible value. For instance, app=~".*" does not meet this requirement, but app=~".+" will');
    const stages: Stage[] = [];
    for (;;) {
      const t = this.peek();
      if (t.t !== 'op') break;
      if (['|=', '!=', '|~', '!~'].includes(t.v)) {
        this.next();
        const s = this.next();
        if (s.t !== 'str') throw new LogQLError(`parse error at line 1, col ${s.pos + 1}: syntax error: unexpected ${s.v}, expecting STRING`);
        if (t.v === '|~' || t.v === '!~') {
          try {
            new RegExp(s.v);
          } catch (e) {
            throw new LogQLError(`parse error : error parsing regexp: ${(e as Error).message}`);
          }
        }
        stages.push({ k: 'line', op: t.v as '|=', value: s.v });
        continue;
      }
      if (t.v === '|') {
        this.next();
        const w = this.next();
        if (w.v === 'json') stages.push({ k: 'json' });
        else if (w.v === 'logfmt') stages.push({ k: 'logfmt' });
        else if (w.v === 'line_format') {
          const s = this.next();
          if (s.t !== 'str') throw new LogQLError(`parse error at line 1, col ${s.pos + 1}: syntax error: unexpected ${s.v}, expecting STRING`);
          stages.push({ k: 'format', tpl: s.v });
        } else if (w.v === 'unwrap') {
          const n = this.next();
          if (n.t !== 'id') throw new LogQLError(`parse error at line 1, col ${n.pos + 1}: syntax error: unexpected ${n.v}, expecting IDENTIFIER`);
          stages.push({ k: 'unwrap', name: n.v });
        } else if (w.t === 'id') {
          for (;;) {
            const op = this.next();
            if (!['=', '==', '!=', '>', '>=', '<', '<=', '=~', '!~'].includes(op.v)) throw new LogQLError(`parse error at line 1, col ${op.pos + 1}: syntax error: unexpected ${op.v}`);
            const val = this.next();
            const num = val.t === 'num' || val.t === 'dur';
            if (val.t !== 'str' && !num) throw new LogQLError(`parse error at line 1, col ${val.pos + 1}: syntax error: unexpected ${val.v}`);
            stages.push({ k: 'label', name: w.v, op: op.v === '==' ? '=' : op.v, value: val.t === 'num' ? Number(val.v) : val.t === 'dur' ? durSeconds(val.v)! : val.v, num });
            if ((this.is(',') || this.is('and')) && this.peek(1).t === 'id') {
              this.next();
              const nx = this.next();
              w.v = nx.v;
              continue;
            }
            break;
          }
        } else throw new LogQLError(`parse error at line 1, col ${w.pos + 1}: syntax error: unexpected ${w.v}`);
        continue;
      }
      break;
    }
    return { k: 'log', matchers, stages };
  }
  range(): number {
    this.expect('[');
    const d = this.next();
    if (d.t !== 'dur' || durSeconds(d.v) === null) throw new LogQLError(`parse error at line 1, col ${d.pos + 1}: syntax error: unexpected ${d.v}, expecting DURATION`);
    this.expect(']');
    return durSeconds(d.v)! * 1000;
  }
  rangeAgg(): MetricExpr {
    const fn = this.next().v;
    this.expect('(');
    let param: number | undefined;
    if (fn === 'quantile_over_time') {
      const p = this.next();
      if (p.t !== 'num') throw new LogQLError(`parse error at line 1, col ${p.pos + 1}: syntax error: unexpected ${p.v}, expecting NUMBER`);
      param = Number(p.v);
      this.expect(',');
    }
    const log = this.logExpr();
    const range = this.range();
    this.expect(')');
    const unwrap = log.stages.some((s) => s.k === 'unwrap');
    if (UNWRAP_FNS.includes(fn) && !unwrap) throw new LogQLError(`parse error : invalid aggregation ${fn} without unwrap`);
    if (!UNWRAP_FNS.includes(fn) && unwrap) throw new LogQLError(`parse error : invalid aggregation ${fn} with unwrap`);
    // Unwrapped range aggregations may group their samples: quantile_over_time(…) by (route).
    let by: string[] | undefined;
    let without: string[] | undefined;
    if (this.is('by') || this.is('without')) {
      if (!UNWRAP_FNS.includes(fn)) throw new LogQLError(`parse error : grouping not allowed for ${fn} aggregation`);
      if (this.next().v === 'by') by = this.labelList();
      else without = this.labelList();
    }
    return { k: 'range', fn, log, range, param, by, without };
  }
  labelList(): string[] {
    this.expect('(');
    const out: string[] = [];
    while (!this.is(')')) {
      const t = this.next();
      if (t.t !== 'id') throw new LogQLError(`parse error at line 1, col ${t.pos + 1}: syntax error: unexpected ${t.v}, expecting IDENTIFIER`);
      out.push(t.v);
      if (this.is(',')) this.next();
    }
    this.expect(')');
    return out;
  }
  vectorAgg(): MetricExpr {
    const fn = this.next().v;
    let by: string[] | undefined;
    let without: string[] | undefined;
    const grouping = () => {
      if (this.is('by')) {
        this.next();
        by = this.labelList();
      } else if (this.is('without')) {
        this.next();
        without = this.labelList();
      }
    };
    grouping();
    this.expect('(');
    let param: number | undefined;
    if (fn === 'topk' || fn === 'bottomk') {
      const p = this.next();
      if (p.t !== 'num') throw new LogQLError(`parse error at line 1, col ${p.pos + 1}: syntax error: unexpected ${p.v}, expecting NUMBER`);
      param = Number(p.v);
      this.expect(',');
    }
    const inner = this.expr();
    this.expect(')');
    if (!by && !without) grouping();
    return { k: 'agg', fn, by, without, param, inner: this.metric(inner) };
  }
}

export function parseLogQL(src: string): LogQLExpr {
  if (!src.trim()) throw new LogQLError('parse error : syntax error: unexpected $end');
  return new Parser(lex(src)).query();
}

// ── evaluation ──

const keyOf = (l: Labels) =>
  Object.keys(l)
    .sort()
    .map((k) => `${k}=${JSON.stringify(l[k])}`)
    .join(',');

function matches(l: Labels, ms: Matcher[]): boolean {
  return ms.every((m) => {
    const v = l[m.name] ?? '';
    if (m.op === '=') return v === m.value;
    if (m.op === '!=') return v !== m.value;
    const re = new RegExp(`^(?:${m.value})$`);
    return m.op === '=~' ? re.test(v) : !re.test(v);
  });
}

function flatten(o: unknown, prefix: string, out: Labels): void {
  if (o && typeof o === 'object' && !Array.isArray(o)) for (const [k, v] of Object.entries(o)) flatten(v, prefix ? `${prefix}_${k}` : k, out);
  else if (prefix) out[prefix.replace(/[^\w]/g, '_')] = o === null ? '' : String(o);
}

function logfmt(line: string): Labels {
  const out: Labels = {};
  const re = /([\w.-]+)=("(?:[^"\\]|\\.)*"|\S*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out[m[1].replace(/[^\w]/g, '_')] = m[2].startsWith('"') ? m[2].slice(1, -1).replace(/\\"/g, '"') : m[2];
  return out;
}

function toNumber(v: string | undefined): number | null {
  if (v === undefined || v === '') return null;
  const d = durSeconds(v);
  if (d !== null) return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface Row {
  ts: number;
  line: string;
  labels: Labels;
  value?: number;
}

/** Runs the pipeline over every matching stream in [from, to]; returns the rows that survive. */
function pipeline(db: LogDb, e: LogExpr, from: number, to: number): Row[] {
  const rows: Row[] = [];
  const re = e.stages.map((s) => (s.k === 'line' && (s.op === '|~' || s.op === '!~') ? new RegExp(s.value) : s.k === 'label' && (s.op === '=~' || s.op === '!~') ? new RegExp(`^(?:${s.value})$`) : null));
  for (const st of db.streams as LogStream[]) {
    if (!matches(st.labels, e.matchers)) continue;
    for (const en of st.entries) {
      if (en.ts <= from || en.ts > to) continue;
      let line = en.line;
      let labels: Labels = { ...st.labels };
      let value: number | undefined;
      let keep = true;
      for (let i = 0; i < e.stages.length && keep; i++) {
        const s = e.stages[i];
        if (s.k === 'line') {
          if (s.op === '|=') keep = line.includes(s.value);
          else if (s.op === '!=') keep = !line.includes(s.value);
          else if (s.op === '|~') keep = re[i]!.test(line);
          else keep = !re[i]!.test(line);
        } else if (s.k === 'json') {
          try {
            const o = JSON.parse(line);
            const x: Labels = {};
            flatten(o, '', x);
            labels = { ...labels, ...x };
          } catch {
            labels = { ...labels, __error__: 'JSONParserErr', __error_details__: 'Value looks like object, but can\'t find closing \'}\' symbol' };
          }
        } else if (s.k === 'logfmt') labels = { ...labels, ...logfmt(line) };
        else if (s.k === 'label') {
          const v = labels[s.name];
          if (s.num) {
            const n = toNumber(v);
            const x = s.value as number;
            keep = n !== null && (s.op === '=' ? n === x : s.op === '!=' ? n !== x : s.op === '>' ? n > x : s.op === '>=' ? n >= x : s.op === '<' ? n < x : n <= x);
          } else {
            const x = String(s.value);
            const cur = v ?? '';
            keep = s.op === '=' ? cur === x : s.op === '!=' ? cur !== x : s.op === '=~' ? re[i]!.test(cur) : s.op === '!~' ? !re[i]!.test(cur) : false;
          }
        } else if (s.k === 'format') line = s.tpl.replace(/\{\{\s*\.([\w]+)\s*\}\}/g, (_m, k: string) => labels[k] ?? '');
        else if (s.k === 'unwrap') {
          const n = toNumber(labels[s.name]);
          if (n === null) labels = { ...labels, __error__: 'SampleExtractionErr' };
          else value = n;
          const { [s.name]: _drop, ...rest } = labels;
          void _drop;
          labels = rest;
        }
      }
      if (keep) rows.push({ ts: en.ts, line, labels, value });
    }
  }
  return rows;
}

function quantile(q: number, xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const r = q * (s.length - 1);
  const lo = Math.floor(r);
  const hi = Math.ceil(r);
  return s[lo] + (s[hi] - s[lo]) * (r - lo);
}

function evalMetric(db: LogDb, e: MetricExpr, t: number): { labels: Labels; value: number }[] | number {
  if (e.k === 'num') return e.v;
  if (e.k === 'range') {
    const rows = pipeline(db, e.log, t - e.range, t);
    const groups = new Map<string, { labels: Labels; rows: Row[] }>();
    const grouped = (l: Labels): Labels => (e.by ? Object.fromEntries(e.by.filter((k) => k in l).map((k) => [k, l[k]])) : e.without ? Object.fromEntries(Object.entries(l).filter(([k]) => !e.without!.includes(k))) : l);
    for (const r of rows) {
      if (r.labels.__error__ && UNWRAP_FNS.includes(e.fn)) throw new LogQLError(`pipeline error: '${r.labels.__error__}' for series: '${keyOf(r.labels)}'.\nUse a label filter to intentionally skip this error. (e.g | __error__!="${r.labels.__error__}").\nTo skip all potential errors you can match empty errors.(e.g __error__="")\nThe label filter can also be specified after unwrap. (e.g | unwrap latency | __error__="" )`);
      const gl = grouped(r.labels);
      const k = keyOf(gl);
      if (!groups.has(k)) groups.set(k, { labels: gl, rows: [] });
      groups.get(k)!.rows.push(r);
    }
    if (e.fn === 'absent_over_time') return groups.size ? [] : [{ labels: Object.fromEntries(e.log.matchers.filter((m) => m.op === '=').map((m) => [m.name, m.value])), value: 1 }];
    const secs = e.range / 1000;
    const out: { labels: Labels; value: number }[] = [];
    for (const g of groups.values()) {
      if (g.labels.__error__ && UNWRAP_FNS.includes(e.fn)) throw new LogQLError(`pipeline error: '${g.labels.__error__}' for series: '${keyOf(g.labels)}'.\nUse a label filter to intentionally skip this error. (e.g | __error__!="${g.labels.__error__}").\nTo skip all potential errors you can match empty errors.(e.g __error__="")\nThe label filter can also be specified after unwrap. (e.g | unwrap latency | __error__="" )`);
      const vals = g.rows.map((r) => r.value ?? 0);
      const bytes = g.rows.reduce((n, r) => n + new TextEncoder().encode(r.line).length, 0);
      const v =
        e.fn === 'count_over_time' ? g.rows.length
        : e.fn === 'rate' ? g.rows.length / secs
        : e.fn === 'bytes_over_time' ? bytes
        : e.fn === 'bytes_rate' ? bytes / secs
        : e.fn === 'sum_over_time' ? vals.reduce((a, b) => a + b, 0)
        : e.fn === 'avg_over_time' ? vals.reduce((a, b) => a + b, 0) / vals.length
        : e.fn === 'min_over_time' ? Math.min(...vals)
        : e.fn === 'max_over_time' ? Math.max(...vals)
        : quantile(e.param ?? 0.5, vals);
      out.push({ labels: g.labels, value: v });
    }
    return out;
  }
  if (e.k === 'agg') {
    const inner = evalMetric(db, e.inner, t);
    if (typeof inner === 'number') throw new LogQLError('parse error : unexpected scalar inside an aggregation');
    const groupKey = (l: Labels): Labels => (e.by ? Object.fromEntries(e.by.filter((k) => k in l).map((k) => [k, l[k]])) : e.without ? Object.fromEntries(Object.entries(l).filter(([k]) => !e.without!.includes(k))) : {});
    if (e.fn === 'topk' || e.fn === 'bottomk') {
      const groups = new Map<string, { labels: Labels; value: number }[]>();
      for (const s of inner) {
        const k = keyOf(groupKey(s.labels));
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(s);
      }
      return [...groups.values()].flatMap((g) => [...g].sort((a, b) => (e.fn === 'topk' ? b.value - a.value : a.value - b.value)).slice(0, e.param ?? 1));
    }
    const groups = new Map<string, { labels: Labels; vals: number[] }>();
    for (const s of inner) {
      const gl = groupKey(s.labels);
      const k = keyOf(gl);
      if (!groups.has(k)) groups.set(k, { labels: gl, vals: [] });
      groups.get(k)!.vals.push(s.value);
    }
    return [...groups.values()].map((g) => ({
      labels: g.labels,
      value: e.fn === 'sum' ? g.vals.reduce((a, b) => a + b, 0) : e.fn === 'avg' ? g.vals.reduce((a, b) => a + b, 0) / g.vals.length : e.fn === 'min' ? Math.min(...g.vals) : e.fn === 'max' ? Math.max(...g.vals) : g.vals.length,
    }));
  }
  const a = evalMetric(db, e.a, t);
  const b = evalMetric(db, e.b, t);
  const op = (x: number, y: number): number | null => {
    switch (e.op) {
      case '+':
        return x + y;
      case '-':
        return x - y;
      case '*':
        return x * y;
      case '/':
        return x / y;
      case '%':
        return x % y;
      case '>':
        return x > y ? x : null;
      case '<':
        return x < y ? x : null;
      case '>=':
        return x >= y ? x : null;
      case '<=':
        return x <= y ? x : null;
      case '==':
        return x === y ? x : null;
      case '!=':
        return x !== y ? x : null;
    }
    return null;
  };
  if (typeof a === 'number' && typeof b === 'number') return op(a, b) ?? NaN;
  if (typeof b === 'number') return (a as { labels: Labels; value: number }[]).flatMap((s) => (op(s.value, b) === null ? [] : [{ labels: s.labels, value: op(s.value, b)! }]));
  if (typeof a === 'number') return b.flatMap((s) => (op(a, s.value) === null ? [] : [{ labels: s.labels, value: op(a, s.value)! }]));
  const right = new Map(b.map((s) => [keyOf(s.labels), s]));
  return a.flatMap((s) => {
    const o = right.get(keyOf(s.labels));
    if (!o) return [];
    const v = op(s.value, o.value);
    return v === null ? [] : [{ labels: s.labels, value: v }];
  });
}

export interface LogQueryOpts {
  /** End of the range (default: the end of the dataset). */
  end?: number;
  /** Range for log queries, ms (default 1 hour). */
  since?: number;
  limit?: number;
  direction?: 'backward' | 'forward';
}

export function isMetric(e: LogQLExpr): e is MetricExpr {
  return e.k !== 'log';
}

export function runLogQL(db: LogDb, src: string, o: LogQueryOpts = {}): LogResult {
  const e = parseLogQL(src);
  const end = o.end ?? db.end;
  if (isMetric(e)) {
    const r = evalMetric(db, e, end);
    if (typeof r === 'number') return { type: 'scalar', value: r };
    return { type: 'vector', data: r.sort((x, y) => keyOf(x.labels).localeCompare(keyOf(y.labels))) };
  }
  if (e.stages.some((s) => s.k === 'unwrap')) throw new LogQLError('parse error : unwrap is only allowed inside a range aggregation such as sum_over_time');
  const rows = pipeline(db, e, end - (o.since ?? 3_600_000), end);
  rows.sort((a, b) => (o.direction === 'forward' ? a.ts - b.ts : b.ts - a.ts));
  const limited = rows.slice(0, o.limit ?? 100);
  const streams = new Map<string, { labels: Labels; entries: { ts: number; line: string }[] }>();
  for (const r of limited) {
    const k = keyOf(r.labels);
    if (!streams.has(k)) streams.set(k, { labels: r.labels, entries: [] });
    streams.get(k)!.entries.push({ ts: r.ts, line: r.line });
  }
  return { type: 'streams', data: [...streams.values()] };
}

/** All entries of a stream result, newest first (or in the order asked), with their labels. */
export function flatEntries(r: LogResult, forward = false): { ts: number; line: string; labels: Labels }[] {
  if (r.type !== 'streams') return [];
  return r.data.flatMap((s) => s.entries.map((e) => ({ ...e, labels: s.labels }))).sort((a, b) => (forward ? a.ts - b.ts : b.ts - a.ts));
}

export function formatLogLabels(l: Labels): string {
  return `{${Object.keys(l)
    .sort()
    .map((k) => `${k}="${l[k]}"`)
    .join(', ')}}`;
}

/** Label names and values of the streams (logcli labels). */
export function labelValues(db: LogDb, name?: string): string[] {
  if (!name) return [...new Set(db.streams.flatMap((s) => Object.keys(s.labels)))].sort();
  return [...new Set(db.streams.map((s) => s.labels[name]).filter((v): v is string => v !== undefined))].sort();
}
