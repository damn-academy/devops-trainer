// The Jinja2 subset Ansible playbooks in the course use: {{ expr }} with
// filters, {% if %}/{% elif %}/{% else %}/{% endif %}, {% for x in xs %} and
// conditions for `when:` (==, !=, <, >, in, not in, and, or, not, is defined,
// is undefined, attribute and index access, literals).

export type Vars = Record<string, unknown>;

export class JinjaError extends Error {}

type Tok = { t: 'name' | 'num' | 'str' | 'op'; v: string };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const end = src.indexOf(c, i + 1);
      if (end < 0) throw new JinjaError(`unexpected end of string in ${src}`);
      out.push({ t: 'str', v: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (num) {
      out.push({ t: 'num', v: num[0] });
      i += num[0].length;
      continue;
    }
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (name) {
      out.push({ t: 'name', v: name[0] });
      i += name[0].length;
      continue;
    }
    const op = /^(==|!=|<=|>=|[<>|.()[\],:+\-*/~])/.exec(src.slice(i));
    if (op) {
      out.push({ t: 'op', v: op[0] });
      i += op[0].length;
      continue;
    }
    throw new JinjaError(`unexpected char '${c}' in ${src}`);
  }
  return out;
}

const UNDEF = Symbol('undefined');

class E {
  i = 0;
  constructor(
    private toks: Tok[],
    private vars: Vars,
    private src: string,
  ) {}
  peek(v?: string): Tok | undefined {
    const t = this.toks[this.i];
    return v === undefined || (t && t.v === v && (t.t === 'op' || t.t === 'name')) ? t : undefined;
  }
  eat(v: string): boolean {
    if (this.peek(v)) {
      this.i++;
      return true;
    }
    return false;
  }
  done(): boolean {
    return this.i >= this.toks.length;
  }
  expr(): unknown {
    return this.or();
  }
  or(): unknown {
    let a = this.and();
    while (this.eat('or')) {
      const b = this.and();
      a = truthy(a) ? a : b;
    }
    return a;
  }
  and(): unknown {
    let a = this.not();
    while (this.eat('and')) {
      const b = this.not();
      a = truthy(a) ? b : a;
    }
    return a;
  }
  not(): unknown {
    if (this.eat('not')) return !truthy(this.not());
    return this.cmp();
  }
  cmp(): unknown {
    const a = this.add();
    const t = this.peek();
    if (t && ['==', '!=', '<', '>', '<=', '>='].includes(t.v) && t.t === 'op') {
      this.i++;
      const b = this.add();
      const x = a === UNDEF ? undefined : a;
      const y = b === UNDEF ? undefined : b;
      switch (t.v) {
        case '==':
          return String(x) === String(y) && typeof x === typeof y ? true : x == y; // eslint-disable-line eqeqeq
        case '!=':
          return !(x == y); // eslint-disable-line eqeqeq
        case '<':
          return Number(x) < Number(y);
        case '>':
          return Number(x) > Number(y);
        case '<=':
          return Number(x) <= Number(y);
        case '>=':
          return Number(x) >= Number(y);
      }
    }
    if (this.peek('in') || (this.peek('not') && this.toks[this.i + 1]?.v === 'in')) {
      const neg = this.eat('not');
      this.eat('in');
      const b = this.add();
      const has = Array.isArray(b) ? b.some((x) => String(x) === String(a)) : typeof b === 'string' ? b.includes(String(a)) : b && typeof b === 'object' ? String(a) in (b as object) : false;
      return neg ? !has : has;
    }
    if (this.eat('is')) {
      const neg = this.eat('not');
      const test = this.toks[this.i++]?.v;
      let r: boolean;
      if (test === 'defined') r = a !== UNDEF;
      else if (test === 'undefined') r = a === UNDEF;
      else if (test === 'none') r = a === null;
      else if (test === 'changed') r = !!(a as { changed?: boolean })?.changed;
      else if (test === 'failed') r = !!(a as { failed?: boolean })?.failed;
      else if (test === 'succeeded' || test === 'success') r = !(a as { failed?: boolean })?.failed;
      else throw new JinjaError(`no test named '${test}'`);
      return neg ? !r : r;
    }
    return a;
  }
  add(): unknown {
    let a = this.filtered();
    for (;;) {
      if (this.eat('+')) {
        const b = this.filtered();
        a = typeof a === 'number' && typeof b === 'number' ? a + b : Array.isArray(a) && Array.isArray(b) ? [...a, ...b] : `${str(a)}${str(b)}`;
      } else if (this.eat('~')) a = `${str(a)}${str(this.filtered())}`;
      else if (this.eat('-')) a = Number(a) - Number(this.filtered());
      else if (this.eat('*')) a = Number(a) * Number(this.filtered());
      else return a;
    }
  }
  filtered(): unknown {
    let v = this.postfix();
    while (this.eat('|')) {
      const name = this.toks[this.i++]?.v ?? '';
      const args: unknown[] = [];
      if (this.eat('(')) {
        while (!this.eat(')')) {
          args.push(this.expr());
          this.eat(',');
          if (this.done()) throw new JinjaError(`unexpected end in ${this.src}`);
        }
      }
      v = applyFilter(name, v, args);
    }
    return v;
  }
  postfix(): unknown {
    let v = this.primary();
    for (;;) {
      if (this.eat('.')) {
        const k = this.toks[this.i++]?.v ?? '';
        v = v !== UNDEF && v !== null && typeof v === 'object' && k in (v as object) ? (v as Record<string, unknown>)[k] : UNDEF;
      } else if (this.eat('[')) {
        const k = this.expr();
        this.eat(']');
        v = v !== UNDEF && v !== null && typeof v === 'object' && String(k) in (v as object) ? (v as Record<string, unknown>)[String(k)] : UNDEF;
      } else return v;
    }
  }
  primary(): unknown {
    const t = this.toks[this.i++];
    if (!t) throw new JinjaError(`unexpected end of template in ${this.src}`);
    if (t.t === 'num') return Number(t.v);
    if (t.t === 'str') return t.v;
    if (t.t === 'op' && t.v === '(') {
      const v = this.expr();
      this.eat(')');
      return v;
    }
    if (t.t === 'op' && t.v === '[') {
      const items: unknown[] = [];
      while (!this.eat(']')) {
        items.push(this.expr());
        this.eat(',');
        if (this.done()) throw new JinjaError(`unexpected end in ${this.src}`);
      }
      return items;
    }
    if (t.t === 'name') {
      if (t.v === 'true' || t.v === 'True') return true;
      if (t.v === 'false' || t.v === 'False') return false;
      if (t.v === 'none' || t.v === 'None') return null;
      return t.v in this.vars ? this.vars[t.v] : UNDEF;
    }
    throw new JinjaError(`unexpected '${t.v}' in ${this.src}`);
  }
}

function str(v: unknown): string {
  if (v === UNDEF || v === undefined) return '';
  if (v === null) return 'None';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function truthy(v: unknown): boolean {
  if (v === UNDEF || v === undefined || v === null || v === false || v === 0 || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return !['false', 'no', 'off', '0'].includes(v.toLowerCase());
  return true;
}

function applyFilter(name: string, v: unknown, args: unknown[]): unknown {
  switch (name) {
    case 'default':
    case 'd':
      return v === UNDEF || (args[1] && !truthy(v)) ? args[0] : v;
    case 'upper':
      return str(v).toUpperCase();
    case 'lower':
      return str(v).toLowerCase();
    case 'join':
      return Array.isArray(v) ? v.map(str).join(args[0] === undefined ? '' : str(args[0])) : str(v);
    case 'length':
    case 'count':
      return Array.isArray(v) || typeof v === 'string' ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0;
    case 'bool':
      return truthy(v);
    case 'int':
      return Math.trunc(Number(v)) || 0;
    case 'string':
      return str(v);
    case 'trim':
      return str(v).trim();
    case 'replace':
      return str(v).split(str(args[0])).join(str(args[1]));
    case 'regex_replace':
      return str(v).replace(new RegExp(str(args[0]), 'g'), str(args[1]).replace(/\\(\d)/g, '$$$1'));
    case 'first':
      return Array.isArray(v) ? v[0] : UNDEF;
    case 'last':
      return Array.isArray(v) ? v[v.length - 1] : UNDEF;
    case 'sort':
      return Array.isArray(v) ? [...v].sort() : v;
    case 'unique':
      return Array.isArray(v) ? [...new Set(v)] : v;
    case 'to_json':
      return JSON.stringify(v);
    case 'to_nice_yaml':
      return toYaml(v);
    case 'quote':
      return `'${str(v).replace(/'/g, `'"'"'`)}'`;
    case 'dict2items':
      return v && typeof v === 'object' ? Object.entries(v).map(([key, value]) => ({ key, value })) : [];
    case 'combine':
      return { ...(v as object), ...(args[0] as object) };
    case 'mandatory':
      if (v === UNDEF) throw new JinjaError('Mandatory variable has not been overridden');
      return v;
  }
  throw new JinjaError(`template error while templating string: Could not load "${name}": 'Could not load "${name}": '${name}''. String: {{ … | ${name} }}`);
}

function toYaml(v: unknown, ind = ''): string {
  if (Array.isArray(v)) return v.map((x) => `${ind}- ${typeof x === 'object' && x ? '\n' + toYaml(x, ind + '  ') : str(x)}`).join('\n') + '\n';
  if (v && typeof v === 'object') return Object.entries(v).map(([k, x]) => `${ind}${k}: ${typeof x === 'object' && x ? '\n' + toYaml(x, ind + '  ') : str(x)}`).join('\n') + '\n';
  return str(v) + '\n';
}

/** Evaluate an expression (the inside of {{ }} or a `when:`). Undefined names stay undefined. */
export function evalExpr(src: string, vars: Vars): unknown {
  const e = new E(lex(src), vars, src);
  const v = e.expr();
  if (!e.done()) throw new JinjaError(`template error while templating string: unexpected token. String: {{ ${src} }}`);
  return v;
}

export function isUndefined(v: unknown): boolean {
  return v === UNDEF;
}

/** `when:` — a bare expression (or a list of them, all must hold). */
export function evalWhen(cond: unknown, vars: Vars): boolean {
  const list = Array.isArray(cond) ? cond : [cond];
  return list.every((c) => (typeof c === 'boolean' ? c : truthy(evalExpr(String(c).replace(/^\{\{\s*|\s*\}\}$/g, ''), vars))));
}

/** Render a template string. A string that is exactly "{{ x }}" keeps the value's type (lists, numbers). */
export function render(text: string, vars: Vars): unknown {
  const whole = /^\{\{\s*([\s\S]+?)\s*\}\}$/.exec(text);
  if (whole && !text.slice(2, -2).includes('{{')) {
    const v = evalExpr(whole[1], vars);
    if (v === UNDEF) throw new JinjaError(`'${whole[1].split(/[ .|[]/)[0]}' is undefined`);
    return v;
  }
  return renderText(text, vars);
}

export function renderText(text: string, vars: Vars): string {
  // Tokenise into text, {{ }} and {% %}.
  const parts: { k: 'text' | 'out' | 'tag'; v: string }[] = [];
  const re = /\{\{([\s\S]*?)\}\}|\{%-?([\s\S]*?)-?%\}|\{#[\s\S]*?#\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    parts.push({ k: 'text', v: text.slice(last, m.index) });
    if (m[1] !== undefined) parts.push({ k: 'out', v: m[1].trim() });
    else if (m[2] !== undefined) parts.push({ k: 'tag', v: m[2].trim() });
    last = m.index + m[0].length;
    // Jinja's trim_blocks (Ansible enables it): a newline right after a block tag is removed.
    if (m[2] !== undefined && text[last] === '\n') last++;
  }
  parts.push({ k: 'text', v: text.slice(last) });
  let pos = 0;
  const run = (scope: Vars, stop: string[]): { out: string; end: string } => {
    let out = '';
    while (pos < parts.length) {
      const p = parts[pos++];
      if (p.k === 'text') out += p.v;
      else if (p.k === 'out') {
        const v = evalExpr(p.v, scope);
        if (v === UNDEF) throw new JinjaError(`'${p.v.split(/[ .|[]/)[0]}' is undefined`);
        out += str(v);
      } else {
        const word = p.v.split(/\s+/)[0];
        if (stop.includes(word)) return { out, end: p.v };
        if (word === 'if') {
          let cond = truthy(evalExpr(p.v.slice(2), scope));
          let taken = false;
          for (;;) {
            const start = pos;
            const body = run(scope, ['elif', 'else', 'endif']);
            if (cond && !taken) {
              out += body.out;
              taken = true;
            }
            void start;
            if (body.end.startsWith('endif')) break;
            if (body.end.startsWith('elif')) cond = !taken && truthy(evalExpr(body.end.slice(4), scope));
            else cond = !taken;
          }
        } else if (word === 'for') {
          const fm = /^for\s+(\w+)\s+in\s+(.+)$/.exec(p.v);
          if (!fm) throw new JinjaError(`bad for: ${p.v}`);
          const list = evalExpr(fm[2], scope);
          const items = Array.isArray(list) ? list : list && typeof list === 'object' ? Object.keys(list) : [];
          const bodyStart = pos;
          if (!items.length) run(scope, ['endfor']);
          items.forEach((item, idx) => {
            pos = bodyStart;
            out += run({ ...scope, [fm[1]]: item, loop: { index: idx + 1, index0: idx, first: idx === 0, last: idx === items.length - 1 } }, ['endfor']).out;
          });
        } else if (word === 'set') {
          const sm = /^set\s+(\w+)\s*=\s*(.+)$/.exec(p.v);
          if (sm) scope[sm[1]] = evalExpr(sm[2], scope);
        } else throw new JinjaError(`Encountered unknown tag '${word}'.`);
      }
    }
    return { out, end: '' };
  };
  return run({ ...vars }, []).out;
}
