// The subset of Go templates the Docker CLI's --format uses (04 §11.3):
// fields `.A.B`, `{{json .X}}`, `{{range .X}}…{{end}}`, `{{index .X "k"}}`,
// `{{len .X}}`, `{{upper}}`/`{{lower}}`, `{{if}}…{{else}}…{{end}}`, and the
// `table` prefix. Anything else is a clear error, as the real CLI gives.

type Node = { k: 'text'; v: string } | { k: 'expr'; v: string } | { k: 'range'; v: string; body: Node[] } | { k: 'if'; v: string; body: Node[]; else: Node[] };

export class TemplateError extends Error {}

function lex(src: string): { k: 'text' | 'tag'; v: string }[] {
  const out: { k: 'text' | 'tag'; v: string }[] = [];
  let i = 0;
  while (i < src.length) {
    const a = src.indexOf('{{', i);
    if (a < 0) {
      out.push({ k: 'text', v: src.slice(i) });
      break;
    }
    if (a > i) out.push({ k: 'text', v: src.slice(i, a) });
    const b = src.indexOf('}}', a);
    if (b < 0) throw new TemplateError(`template: :1: unclosed action`);
    out.push({ k: 'tag', v: src.slice(a + 2, b).trim().replace(/^-\s*|\s*-$/g, '') });
    i = b + 2;
  }
  return out;
}

function parse(tokens: { k: 'text' | 'tag'; v: string }[], pos = { i: 0 }, until: string[] = []): { nodes: Node[]; end?: string } {
  const nodes: Node[] = [];
  while (pos.i < tokens.length) {
    const t = tokens[pos.i++];
    if (t.k === 'text') nodes.push({ k: 'text', v: t.v });
    else if (until.includes(t.v)) return { nodes, end: t.v };
    else if (t.v.startsWith('range ')) {
      const r = parse(tokens, pos, ['end']);
      nodes.push({ k: 'range', v: t.v.slice(6).trim(), body: r.nodes });
    } else if (t.v.startsWith('if ')) {
      const r = parse(tokens, pos, ['end', 'else']);
      let els: Node[] = [];
      if (r.end === 'else') els = parse(tokens, pos, ['end']).nodes;
      nodes.push({ k: 'if', v: t.v.slice(3).trim(), body: r.nodes, else: els });
    } else nodes.push({ k: 'expr', v: t.v });
  }
  return { nodes };
}

function field(data: unknown, path: string): unknown {
  if (path === '.') return data;
  let cur: unknown = data;
  for (const part of path.split('.').filter(Boolean)) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') throw new TemplateError(`template: :1: can't evaluate field ${part} in type ${typeof cur}`);
    const obj = cur as Record<string, unknown>;
    if (!(part in obj)) throw new TemplateError(`template: :1:2: executing "" at <.${part}>: can't evaluate field ${part} in type ${Array.isArray(obj) ? 'slice' : 'struct'}`);
    cur = obj[part];
  }
  return cur;
}

function words(expr: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr))) out.push(m[1] !== undefined ? JSON.stringify(m[1]) : m[2]);
  return out;
}

function value(w: string, dot: unknown): unknown {
  if (w.startsWith('"')) return JSON.parse(w);
  if (/^-?\d+$/.test(w)) return Number(w);
  if (w.startsWith('.')) return field(dot, w);
  throw new TemplateError(`template: :1: function "${w}" not defined`);
}

function evalExpr(expr: string, dot: unknown): unknown {
  // pipelines: {{.Name | upper}}
  const stages = expr.split('|').map((s) => s.trim());
  let v: unknown = evalCall(stages[0], dot);
  for (const s of stages.slice(1)) v = evalCall(`${s} __piped__`, dot, v);
  return v;
}

function evalCall(expr: string, dot: unknown, piped?: unknown): unknown {
  const w = words(expr);
  const args = () => w.slice(1).map((x) => (x === '__piped__' ? piped : value(x, dot)));
  switch (w[0]) {
    case 'json':
      return JSON.stringify(args()[0] ?? null);
    case 'len': {
      const a = args()[0];
      return Array.isArray(a) ? a.length : a && typeof a === 'object' ? Object.keys(a).length : String(a ?? '').length;
    }
    case 'index': {
      const [obj, ...keys] = args();
      let cur: unknown = obj;
      for (const k of keys) cur = (cur as Record<string, unknown> | undefined)?.[k as string];
      return cur;
    }
    case 'upper':
      return String(args()[0] ?? '').toUpperCase();
    case 'lower':
      return String(args()[0] ?? '').toLowerCase();
    case 'join': {
      const [list, sep] = args();
      return (list as unknown[]).join(String(sep));
    }
    case 'println':
      return args().map(show).join(' ') + '\n';
    default:
      if (w.length === 1) return value(w[0], dot);
      throw new TemplateError(`template: :1: function "${w[0]}" not defined`);
  }
}

function show(v: unknown): string {
  if (v === undefined || v === null) return '<no value>';
  if (Array.isArray(v)) return `[${v.map(show).join(' ')}]`;
  if (typeof v === 'object') return `map[${Object.entries(v as Record<string, unknown>)
    .map(([k, x]) => `${k}:${show(x)}`)
    .join(' ')}]`;
  return String(v);
}

function truthy(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === 'object') return Object.keys(v).length > 0;
  return !!v;
}

function exec(nodes: Node[], dot: unknown): string {
  let out = '';
  for (const n of nodes) {
    if (n.k === 'text') out += n.v;
    else if (n.k === 'expr') out += show(evalExpr(n.v, dot));
    else if (n.k === 'if') out += truthy(evalExpr(n.v, dot)) ? exec(n.body, dot) : exec(n.else, dot);
    else {
      const list = evalExpr(n.v, dot);
      if (Array.isArray(list)) for (const x of list) out += exec(n.body, x);
      else if (list && typeof list === 'object') for (const x of Object.values(list)) out += exec(n.body, x);
    }
  }
  return out;
}

/** Render a --format template for one object. Escapes \t and \n as the CLI does. */
export function render(tpl: string, data: unknown): string {
  const src = tpl.replace(/\\t/g, '\t').replace(/\\n/g, '\n');
  return exec(parse(lex(src)).nodes, data);
}

/** For `table …` formats: the header row, built from field names (.ID → CONTAINER ID as Docker names them). */
export function tableHeader(tpl: string, names: Record<string, string>): string {
  return render(
    tpl.replace(/\{\{\s*\.(\w+)\s*\}\}/g, (_, f: string) => names[f] ?? f.toUpperCase()),
    {},
  );
}
