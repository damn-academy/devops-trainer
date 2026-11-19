// tfsim: the Terraform/OpenTofu core the course needs (06 §5.1, narrow scope):
// load *.tf, evaluate variables, locals, references, count and functions,
// refresh state against Edu Cloud, diff into create / update / replace /
// delete, apply in dependency order, write terraform.tfstate (format v4).

import type { FsApi } from '../../../core/types';
import { Cloud, CloudError, type Attrs } from './cloud';
import { formatDiag, HclError, isUnknown, parseHcl, UNKNOWN, Unknown, type Diag, type Expr, type HclBlock, type Value } from './hcl';

export const TF_VERSION = '1.13.4';
export const PROVIDER = { source: 'registry.terraform.io/edu/edu', version: '1.4.0' };

// ── the provider schema ──

interface AttrSpec {
  type: 'string' | 'number' | 'bool' | 'map';
  required?: boolean;
  /** Changing it forces a new resource. */
  force?: boolean;
  computed?: boolean;
  default?: Value;
}

export const SCHEMA: Record<string, Record<string, AttrSpec>> = {
  edu_network: {
    name: { type: 'string', required: true },
    cidr: { type: 'string', required: true, force: true },
    id: { type: 'string', computed: true },
  },
  edu_vm: {
    name: { type: 'string', required: true },
    image: { type: 'string', required: true, force: true },
    cores: { type: 'number', default: 2 },
    memory_gb: { type: 'number', default: 2 },
    zone: { type: 'string', default: 'edu-central-1a', force: true },
    network_id: { type: 'string', required: true, force: true },
    labels: { type: 'map', default: {} },
    id: { type: 'string', computed: true },
    private_ip: { type: 'string', computed: true },
    public_ip: { type: 'string', computed: true },
    status: { type: 'string', computed: true },
  },
  edu_dns_record: {
    zone: { type: 'string', required: true, force: true },
    name: { type: 'string', required: true, force: true },
    type: { type: 'string', default: 'A', force: true },
    ttl: { type: 'number', default: 300 },
    value: { type: 'string', required: true },
    id: { type: 'string', computed: true },
    fqdn: { type: 'string', computed: true },
  },
};

// ── state file (format version 4) ──

export interface StateInstance {
  index_key?: number;
  schema_version: number;
  attributes: Attrs;
  dependencies?: string[];
}
export interface StateResource {
  /** "module.web" for a resource of a child module; absent in the root module. */
  module?: string;
  mode: 'managed';
  type: string;
  name: string;
  provider: string;
  instances: StateInstance[];
}
export interface StateFile {
  version: 4;
  terraform_version: string;
  serial: number;
  lineage: string;
  outputs: Record<string, { value: unknown; type: string }>;
  resources: StateResource[];
}

export function emptyState(lineage: string): StateFile {
  return { version: 4, terraform_version: TF_VERSION, serial: 0, lineage, outputs: {}, resources: [] };
}

export interface Instance {
  addr: string;
  type: string;
  name: string;
  /** Name of the child module ("web" for module.web), absent in the root module. */
  module?: string;
  index?: number;
  attrs: Attrs;
  deps: string[];
}

export function stateInstances(s: StateFile | null): Instance[] {
  if (!s) return [];
  const out: Instance[] = [];
  for (const r of s.resources)
    for (const i of r.instances) {
      const module = r.module?.replace(/^module\./, '');
      out.push({ addr: `${rAddr({ type: r.type, name: r.name, module })}${i.index_key !== undefined ? `[${i.index_key}]` : ''}`, type: r.type, name: r.name, ...(module ? { module } : {}), index: i.index_key, attrs: i.attributes, deps: i.dependencies ?? [] });
    }
  return out;
}

/** The resource address without an instance key: edu_vm.web, module.web.edu_vm.this. */
export function rAddr(r: { type: string; name: string; module?: string }): string {
  return `${r.module ? `module.${r.module}.` : ''}${r.type}.${r.name}`;
}

/** Parses an instance address: [module.M.]type.name[index]. */
export function parseAddr(addr: string): { type: string; name: string; module?: string; index?: number } | null {
  const m = /^(?:module\.([\w-]+)\.)?([a-z][a-z0-9_]*)\.([\w-]+)(?:\[(\d+)\])?$/.exec(addr);
  if (!m) return null;
  return { type: m[2], name: m[3], ...(m[1] ? { module: m[1] } : {}), ...(m[4] !== undefined ? { index: Number(m[4]) } : {}) };
}

/** Groups instances back into state resources (root and child modules). */
export function groupInstances(insts: Instance[]): StateResource[] {
  const groups = new Map<string, StateResource>();
  for (const i of [...insts].sort((a, b) => (a.addr < b.addr ? -1 : 1))) {
    const k = rAddr(i);
    if (!groups.has(k)) groups.set(k, { ...(i.module ? { module: `module.${i.module}` } : {}), mode: 'managed', type: i.type, name: i.name, provider: `provider["${PROVIDER.source}"]`, instances: [] });
    groups.get(k)!.instances.push({ ...(i.index !== undefined ? { index_key: i.index } : {}), schema_version: 0, attributes: i.attrs, ...(i.deps.length ? { dependencies: i.deps } : {}) });
  }
  return [...groups.values()];
}

export function buildState(prev: StateFile, insts: Instance[], outputs: StateFile['outputs']): StateFile {
  return { ...prev, serial: prev.serial + 1, terraform_version: TF_VERSION, outputs, resources: groupInstances(insts) };
}

// ── configuration ──

export interface ResourceConf {
  type: string;
  name: string;
  /** The child module this resource belongs to (module.<module>), absent in the root. */
  module?: string;
  block: HclBlock;
  count?: Expr;
  lifecycle: { createBeforeDestroy: boolean; preventDestroy: boolean; ignoreChanges: string[] };
  dependsOn: string[];
}

export interface Config {
  files: Record<string, string>;
  variables: Map<string, { block: HclBlock; default?: Expr; type?: string }>;
  locals: Map<string, Expr>;
  resources: ResourceConf[];
  outputs: Map<string, { expr: Expr; sensitive: boolean }>;
  hasProvider: boolean;
  /** Local module calls: name → source directory (relative to the root). */
  modules: Map<string, { source: string; dir: string }>;
  /** moved { from, to } blocks. */
  moved: { from: string; to: string }[];
  /** import { to, id } blocks. */
  imports: { to: string; id: string; line: number; file: string }[];
}

export class TfError extends Error {
  constructor(
    public diags: Diag[],
    public files?: Record<string, string>,
  ) {
    super(diags.map((d) => d.summary).join('; '));
  }
}

function exprRefs(e: Expr, out: Set<string> = new Set()): Set<string> {
  switch (e.k) {
    case 'ref': {
      const [a, b, c, d] = e.path;
      if (typeof a === 'string' && typeof b === 'string' && a in SCHEMA) out.add(`${a}.${b}`);
      else if (a === 'module' && typeof b === 'string' && typeof c === 'string' && c in SCHEMA && typeof d === 'string') out.add(`module.${b}.${c}.${d}`);
      for (const p of e.path) if (typeof p === 'object') exprRefs(p, out);
      break;
    }
    case 'tpl':
      for (const p of e.parts) if (typeof p !== 'string') exprRefs(p, out);
      break;
    case 'list':
      e.items.forEach((x) => exprRefs(x, out));
      break;
    case 'obj':
      e.items.forEach(([, x]) => exprRefs(x, out));
      break;
    case 'call':
      e.args.forEach((x) => exprRefs(x, out));
      break;
    case 'bin':
      exprRefs(e.a, out);
      exprRefs(e.b, out);
      break;
    case 'not':
    case 'neg':
      exprRefs(e.a, out);
      break;
    case 'cond':
      exprRefs(e.c, out);
      exprRefs(e.a, out);
      exprRefs(e.b, out);
      break;
  }
  return out;
}

/** Rebuilds an expression, replacing references through `ref` (null keeps the node). */
function mapRefs(e: Expr, ref: (x: Extract<Expr, { k: 'ref' }>) => Expr | null): Expr {
  const m = (x: Expr) => mapRefs(x, ref);
  switch (e.k) {
    case 'ref': {
      const path = e.path.map((p) => (typeof p === 'object' ? m(p) : p));
      const self = { ...e, path };
      return ref(self) ?? self;
    }
    case 'tpl':
      return { ...e, parts: e.parts.map((p) => (typeof p === 'string' ? p : m(p))) };
    case 'list':
      return { ...e, items: e.items.map(m) };
    case 'obj':
      return { ...e, items: e.items.map(([k, x]) => [k, m(x)] as [string, Expr]) };
    case 'call':
      return { ...e, args: e.args.map(m) };
    case 'bin':
      return { ...e, a: m(e.a), b: m(e.b) };
    case 'not':
    case 'neg':
      return { ...e, a: m(e.a) };
    case 'cond':
      return { ...e, c: m(e.c), a: m(e.a), b: m(e.b) };
    default:
      return e;
  }
}

/** Appends attribute steps to an expression that stands for a value (module output, variable). */
function withRest(e: Expr, rest: (string | number | Expr)[], diag: () => Diag): Expr {
  if (!rest.length) return e;
  if (e.k === 'ref') return { ...e, path: [...e.path, ...rest], src: `${e.src}.${rest.filter((x) => typeof x !== 'object').join('.')}` };
  throw new TfError([diag()]);
}

function normPath(p: string): string {
  const out: string[] = [];
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..' && out.length && out[out.length - 1] !== '..') out.pop();
    else out.push(seg);
  }
  return (p.startsWith('/') ? '/' : '') + out.join('/');
}

interface RawModule {
  variables: Map<string, { block: HclBlock; default?: Expr; type?: string }>;
  locals: Map<string, Expr>;
  resources: HclBlock[];
  outputs: Map<string, { expr: Expr; sensitive: boolean }>;
  modules: HclBlock[];
  moved: HclBlock[];
  imports: HclBlock[];
  files: Record<string, string>;
}

function readModule(fs: FsApi, dir: string, prefix: string, diags: Diag[], root: boolean): RawModule | null {
  const raw: RawModule = { variables: new Map(), locals: new Map(), resources: [], outputs: new Map(), modules: [], moved: [], imports: [], files: {} };
  let names: string[];
  try {
    names = fs.readdir(dir).filter((n) => n.endsWith('.tf')).sort();
  } catch {
    return null;
  }
  if (!names.length) return null;
  for (const n of names) raw.files[`${prefix}${n}`] = fs.readFile(`${dir}/${n}`);
  for (const [file, text] of Object.entries(raw.files)) {
    let blocks: HclBlock[];
    try {
      blocks = parseHcl(text, file);
    } catch (e) {
      if (e instanceof HclError) {
        diags.push(e.diag);
        continue;
      }
      throw e;
    }
    for (const b of blocks) {
      if (b.type === 'terraform') continue;
      if (b.type === 'provider') {
        if (b.labels[0] !== 'edu') diags.push({ severity: 'error', summary: 'Unsupported provider', detail: `This training environment has only the "edu" provider (Edu Cloud).`, file, line: b.line });
        if (!root) diags.push({ severity: 'warning', summary: 'Provider configuration in a module', detail: 'A module should not configure providers itself: it inherits them from the root module.', file, line: b.line });
        (raw as RawModule & { hasProvider?: boolean }).hasProvider = true;
        continue;
      }
      if (b.type === 'variable') {
        const def = b.attrs.find((a) => a.name === 'default');
        const type = b.attrs.find((a) => a.name === 'type');
        raw.variables.set(b.labels[0], { block: b, default: def?.expr, type: type?.expr.k === 'ref' ? String(type.expr.path[0]) : undefined });
        continue;
      }
      if (b.type === 'locals') {
        for (const a of b.attrs) raw.locals.set(a.name, a.expr);
        continue;
      }
      if (b.type === 'output') {
        const v = b.attrs.find((a) => a.name === 'value');
        if (!v) diags.push({ severity: 'error', summary: 'Missing required argument', detail: 'The argument "value" is required, but no definition was found.', file, line: b.line, context: `output "${b.labels[0]}"` });
        else raw.outputs.set(b.labels[0], { expr: v.expr, sensitive: b.attrs.some((a) => a.name === 'sensitive' && a.expr.k === 'lit' && a.expr.v === true) });
        continue;
      }
      if (b.type === 'resource') raw.resources.push(b);
      else if (b.type === 'module') {
        if (root) raw.modules.push(b);
        else diags.push({ severity: 'error', summary: 'Unsupported block type', detail: 'Nested module calls are not part of this training simulator: call modules from the root module.', file, line: b.line });
      } else if (b.type === 'moved') raw.moved.push(b);
      else if (b.type === 'import') {
        if (root) raw.imports.push(b);
        else diags.push({ severity: 'error', summary: 'Invalid import configuration', detail: 'An import block was detected in a child module. Import blocks are only allowed in the root module.', file, line: b.line });
      } else if (b.type === 'data') diags.push({ severity: 'error', summary: 'Unsupported block type', detail: 'Blocks of type "data" are not part of this training simulator yet.', file, line: b.line });
      else diags.push({ severity: 'error', summary: 'Unsupported block type', detail: `Blocks of type "${b.type}" are not expected here.`, file, line: b.line });
    }
  }
  return raw;
}

function resourceConf(b: HclBlock, module: string | undefined, cfg: Config, diags: Diag[]): void {
  const [type, name] = b.labels;
  const file = b.file;
  const ctx = `resource "${type}" "${name}"`;
  if (b.labels.length !== 2) {
    diags.push({ severity: 'error', summary: 'Missing name for resource', detail: 'All resource blocks must have 2 labels (type, name).', file, line: b.line });
    return;
  }
  const schema = SCHEMA[type];
  if (!schema) {
    diags.push({ severity: 'error', summary: 'Invalid resource type', detail: `The provider edu/edu does not support resource type "${type}".`, file, line: b.line, context: ctx });
    return;
  }
  if (cfg.resources.some((r) => r.type === type && r.name === name && r.module === module)) {
    diags.push({ severity: 'error', summary: 'Duplicate resource "' + type + '" configuration', detail: `A ${type} resource named "${name}" was already declared. Resource names must be unique per type in each module.`, file, line: b.line });
    return;
  }
  for (const a of b.attrs) {
    if (['count', 'depends_on', 'provider', 'for_each'].includes(a.name)) continue;
    const spec = schema[a.name];
    if (!spec) diags.push({ severity: 'error', summary: 'Unsupported argument', detail: `An argument named "${a.name}" is not expected here.`, file, line: a.line, context: ctx });
    else if (spec.computed) diags.push({ severity: 'error', summary: 'Invalid or unknown key', detail: `The attribute "${a.name}" is read-only: it is computed by the cloud.`, file, line: a.line, context: ctx });
  }
  for (const [k, spec] of Object.entries(schema)) if (spec.required && !b.attrs.some((a) => a.name === k)) diags.push({ severity: 'error', summary: 'Missing required argument', detail: `The argument "${k}" is required, but no definition was found.`, file, line: b.line, context: ctx });
  const lc = b.blocks.find((x) => x.type === 'lifecycle');
  const lit = (n: string) => {
    const a = lc?.attrs.find((x) => x.name === n);
    return a?.expr.k === 'lit' ? a.expr.v : undefined;
  };
  const ic = lc?.attrs.find((x) => x.name === 'ignore_changes')?.expr;
  const dep = b.attrs.find((a) => a.name === 'depends_on')?.expr;
  cfg.resources.push({
    type,
    name,
    ...(module ? { module } : {}),
    block: b,
    count: b.attrs.find((a) => a.name === 'count')?.expr,
    lifecycle: { createBeforeDestroy: lit('create_before_destroy') === true, preventDestroy: lit('prevent_destroy') === true, ignoreChanges: ic?.k === 'list' ? ic.items.map((x) => (x.k === 'ref' ? String(x.path[0]) : '')) : [] },
    dependsOn: dep?.k === 'list' ? dep.items.filter((x) => x.k === 'ref').map((x) => (module ? `module.${module}.` : '') + (x as { src: string }).src) : [],
  });
}

const refSrc = (e: Expr | undefined) => (e?.k === 'ref' ? e.src : undefined);

export function loadConfig(fs: FsApi, dir: string): Config {
  const diags: Diag[] = [];
  const root = readModule(fs, dir, '', diags, true);
  if (!root) throw new TfError([{ severity: 'error', summary: 'No configuration files', detail: `Apply requires configuration to be present. Applying without a configuration would mark\neverything for destruction, which is normally not what is desired. If you would like to\ndestroy everything, run 'terraform destroy' instead.` }]);
  const cfg: Config = { files: { ...root.files }, variables: root.variables, locals: new Map(), resources: [], outputs: new Map(), hasProvider: !!(root as RawModule & { hasProvider?: boolean }).hasProvider, modules: new Map(), moved: [], imports: [] };

  // Child modules are flattened into the root: their resources get the address
  // module.<name>.<type>.<name>, var.* is replaced by the call's arguments,
  // local.* by the module's locals, module.<name>.<output> by the output's
  // expression. Evaluation then works on one graph, as Terraform's does.
  const calls = new Map(root.modules.map((b) => [b.labels[0], b]));
  const children = new Map<string, RawModule>();
  for (const [name, b] of calls) {
    const src = b.attrs.find((a) => a.name === 'source')?.expr;
    if (!src || src.k !== 'lit' || typeof src.v !== 'string') {
      diags.push({ severity: 'error', summary: 'Missing required argument', detail: 'The argument "source" is required, but no definition was found.', file: b.file, line: b.line, context: `module "${name}"` });
      continue;
    }
    const source = src.v;
    if (!/^\.\.?\//.test(source)) {
      diags.push({ severity: 'error', summary: 'Module not available', detail: `This training environment has no module registry: use a local module with a path that starts with "./" (got "${source}").`, file: b.file, line: src.line, context: `module "${name}"` });
      continue;
    }
    const childDir = normPath(`${dir === '.' ? '' : dir + '/'}${source}`) || '.';
    const rel = normPath(source);
    const raw = readModule(fs, childDir, `${rel}/`, diags, false);
    if (!raw) {
      diags.push({ severity: 'error', summary: 'Unreadable module directory', detail: `The directory ${source} does not exist or cannot be read.`, file: b.file, line: src.line, context: `module "${name}"` });
      continue;
    }
    children.set(name, raw);
    cfg.modules.set(name, { source, dir: rel });
    Object.assign(cfg.files, raw.files);
  }

  const outputExpr = new Map<string, Expr>();
  const resolving = new Set<string>();
  // Root expressions: module.<m>.<output> → the output's (already substituted) expression.
  const rootRef = (x: Extract<Expr, { k: 'ref' }>): Expr | null => {
    const [a, b, c] = x.path;
    if (a !== 'module' || typeof b !== 'string') return null;
    if (!calls.has(b)) {
      diags.push({ severity: 'error', summary: 'Reference to undeclared module', detail: `No module call named "${b}" is declared in the root module.`, line: x.line });
      return null;
    }
    if (typeof c !== 'string' || c in SCHEMA) return null;
    const out = moduleOutput(b, c, x.line);
    if (!out) return null;
    return withRest(out, x.path.slice(3), () => ({ severity: 'error', summary: 'Unsupported attribute', detail: `The output "${c}" of module "${b}" is not an object.`, line: x.line }));
  };
  const moduleOutput = (m: string, o: string, line: number): Expr | null => {
    const key = `${m}.${o}`;
    if (outputExpr.has(key)) return outputExpr.get(key)!;
    const raw = children.get(m);
    if (!raw) return null;
    const out = raw.outputs.get(o);
    if (!out) {
      diags.push({ severity: 'error', summary: 'Unsupported attribute', detail: `This object does not have an attribute named "${o}". The module "${m}" declares no output "${o}".`, line });
      return null;
    }
    if (resolving.has(key)) {
      diags.push({ severity: 'error', summary: `Cycle: module.${m}.${o}`, detail: '' });
      return null;
    }
    resolving.add(key);
    const e = childExpr(m, out.expr);
    resolving.delete(key);
    outputExpr.set(key, e);
    return e;
  };
  const argCache = new Map<string, Map<string, Expr>>();
  const argsOf = (m: string): Map<string, Expr> => {
    if (argCache.has(m)) return argCache.get(m)!;
    const b = calls.get(m)!;
    const args = new Map<string, Expr>();
    argCache.set(m, args);
    const raw = children.get(m)!;
    for (const a of b.attrs) {
      if (['source', 'version', 'count', 'for_each', 'depends_on', 'providers'].includes(a.name)) continue;
      if (!raw.variables.has(a.name)) diags.push({ severity: 'error', summary: 'Unsupported argument', detail: `An argument named "${a.name}" is not expected here: the module "${m}" has no variable "${a.name}".`, file: b.file, line: a.line, context: `module "${m}"` });
      else args.set(a.name, mapRefs(a.expr, rootRef));
    }
    for (const [v, spec] of raw.variables) if (!args.has(v) && !spec.default) diags.push({ severity: 'error', summary: 'Missing required argument', detail: `The argument "${v}" is required, but no definition was found.`, file: b.file, line: b.line, context: `module "${m}"` });
    return args;
  };
  const childExpr = (m: string, e: Expr): Expr => {
    const raw = children.get(m)!;
    const args = argsOf(m);
    const seenLocals = new Set<string>();
    const sub = (x: Extract<Expr, { k: 'ref' }>): Expr | null => {
      const [a, b] = x.path;
      const rest = x.path.slice(2);
      if (a === 'var' && typeof b === 'string') {
        const given = args.get(b) ?? raw.variables.get(b)?.default;
        if (!given) {
          if (!raw.variables.has(b)) diags.push({ severity: 'error', summary: 'Reference to undeclared input variable', detail: `An input variable with the name "${b}" has not been declared. This variable can be declared with a variable "${b}" {} block.`, line: x.line });
          return { k: 'lit', v: null, line: x.line };
        }
        return withRest(given, rest, () => ({ severity: 'error', summary: 'Unsupported attribute', detail: `var.${b} is not an object.`, line: x.line }));
      }
      if (a === 'local' && typeof b === 'string') {
        const le = raw.locals.get(b);
        if (!le) {
          diags.push({ severity: 'error', summary: 'Reference to undeclared local value', detail: `A local value with the name "${b}" has not been declared.`, line: x.line });
          return { k: 'lit', v: null, line: x.line };
        }
        if (seenLocals.has(b)) return { k: 'lit', v: null, line: x.line };
        seenLocals.add(b);
        const r = withRest(mapRefs(le, sub), rest, () => ({ severity: 'error', summary: 'Unsupported attribute', detail: `local.${b} is not an object.`, line: x.line }));
        seenLocals.delete(b);
        return r;
      }
      if (typeof a === 'string' && a in SCHEMA) return { ...x, path: ['module', m, ...x.path], src: `module.${m}.${x.src}` };
      if (a === 'module') {
        diags.push({ severity: 'error', summary: 'Unsupported block type', detail: 'Nested module calls are not part of this training simulator.', line: x.line });
        return null;
      }
      return null;
    };
    return mapRefs(e, sub);
  };

  const withAttrs = (b: HclBlock, f: (e: Expr) => Expr): HclBlock => ({ ...b, attrs: b.attrs.map((a) => ({ ...a, expr: a.name === 'depends_on' ? a.expr : f(a.expr) })) });
  for (const [n, e] of root.locals) cfg.locals.set(n, mapRefs(e, rootRef));
  for (const b of root.resources) resourceConf(withAttrs(b, (e) => mapRefs(e, rootRef)), undefined, cfg, diags);
  for (const [m, raw] of children) for (const b of raw.resources) resourceConf(withAttrs(b, (e) => childExpr(m, e)), m, cfg, diags);
  for (const [n, o] of root.outputs) cfg.outputs.set(n, { ...o, expr: mapRefs(o.expr, rootRef) });
  for (const [m, raw] of [['', root] as [string, RawModule], ...children]) {
    for (const b of raw.moved) {
      const from = refSrc(b.attrs.find((a) => a.name === 'from')?.expr);
      const to = refSrc(b.attrs.find((a) => a.name === 'to')?.expr);
      if (!from || !to) diags.push({ severity: 'error', summary: 'Missing required argument', detail: 'A moved block needs both "from" and "to" addresses.', file: b.file, line: b.line });
      else cfg.moved.push({ from: m ? `module.${m}.${from}` : from, to: m ? `module.${m}.${to}` : to });
    }
  }
  for (const b of root.imports) {
    const to = refSrc(b.attrs.find((a) => a.name === 'to')?.expr);
    const idE = b.attrs.find((a) => a.name === 'id')?.expr;
    if (!to || !idE || idE.k !== 'lit' || typeof idE.v !== 'string') {
      diags.push({ severity: 'error', summary: 'Missing required argument', detail: 'An import block needs "to" (a resource address) and "id" (the ID of the object in the cloud, a string).', file: b.file, line: b.line });
      continue;
    }
    const pa = parseAddr(to);
    if (!pa || !cfg.resources.some((r) => r.type === pa.type && r.name === pa.name && r.module === pa.module)) {
      diags.push({ severity: 'error', summary: 'Configuration for import target does not exist', detail: `The configuration for the given import target ${to} does not exist. All target instances must have an associated configuration to be imported.`, file: b.file, line: b.line });
      continue;
    }
    cfg.imports.push({ to, id: idE.v, line: b.line, file: b.file });
  }

  // References to undeclared resources and variables.
  const declared = new Set(cfg.resources.map((r) => rAddr(r)));
  const walkRefs = (e: Expr, file: string, ctx: string) => {
    const visit = (x: Expr): void => {
      if (x.k === 'ref') {
        const [a, b, c, d] = x.path;
        if (typeof a === 'string' && a in SCHEMA && typeof b === 'string' && !declared.has(`${a}.${b}`)) diags.push({ severity: 'error', summary: 'Reference to undeclared resource', detail: `A managed resource "${a}" "${b}" has not been declared in the root module.`, file, line: x.line, context: ctx });
        else if (a === 'module' && typeof c === 'string' && c in SCHEMA && typeof d === 'string' && !declared.has(`module.${b}.${c}.${d}`)) diags.push({ severity: 'error', summary: 'Reference to undeclared resource', detail: `A managed resource "${c}" "${d}" has not been declared in module.${b}.`, file, line: x.line, context: ctx });
        else if (a === 'var' && typeof b === 'string' && !cfg.variables.has(b)) diags.push({ severity: 'error', summary: 'Reference to undeclared input variable', detail: `An input variable with the name "${b}" has not been declared. This variable can be declared with a variable "${b}" {} block.`, file, line: x.line, context: ctx });
        else if (a === 'local' && typeof b === 'string' && !cfg.locals.has(b)) diags.push({ severity: 'error', summary: 'Reference to undeclared local value', detail: `A local value with the name "${b}" has not been declared.`, file, line: x.line, context: ctx });
        else if (typeof a === 'string' && /^[a-z]+_[a-z_]+$/.test(a) && !(a in SCHEMA) && typeof b === 'string') diags.push({ severity: 'error', summary: 'Reference to undeclared resource', detail: `A managed resource "${a}" "${b}" has not been declared in the root module.`, file, line: x.line, context: ctx });
        for (const p of x.path) if (typeof p === 'object') visit(p);
      } else if (x.k === 'tpl') x.parts.forEach((p) => typeof p !== 'string' && visit(p));
      else if (x.k === 'list') x.items.forEach(visit);
      else if (x.k === 'obj') x.items.forEach(([, y]) => visit(y));
      else if (x.k === 'call') x.args.forEach(visit);
      else if (x.k === 'bin') (visit(x.a), visit(x.b));
      else if (x.k === 'not' || x.k === 'neg') visit(x.a);
      else if (x.k === 'cond') (visit(x.c), visit(x.a), visit(x.b));
    };
    visit(e);
  };
  for (const r of cfg.resources) if (!r.module) for (const a of r.block.attrs) if (a.name !== 'depends_on') walkRefs(a.expr, r.block.file, `resource "${r.type}" "${r.name}"`);
  for (const r of cfg.resources) if (r.module) for (const a of r.block.attrs) if (a.name !== 'depends_on') walkRefs(mapRefs(a.expr, (x) => (x.path[0] === 'var' ? { k: 'lit', v: null, line: x.line } : null)), r.block.file, `module.${r.module} resource "${r.type}" "${r.name}"`);
  for (const [n, o] of cfg.outputs) walkRefs(o.expr, Object.keys(cfg.files)[0], `output "${n}"`);
  // Cycles.
  const deps = new Map(cfg.resources.map((r) => [rAddr(r), new Set([...r.block.attrs.flatMap((a) => [...exprRefs(a.expr)]), ...r.dependsOn])]));
  const state = new Map<string, number>();
  const cycle: string[] = [];
  const dfs = (n: string, stack: string[]): boolean => {
    if (state.get(n) === 2) return false;
    if (state.get(n) === 1) {
      cycle.push(...stack.slice(stack.indexOf(n)));
      return true;
    }
    state.set(n, 1);
    for (const d of deps.get(n) ?? []) if (deps.has(d) && dfs(d, [...stack, d])) return true;
    state.set(n, 2);
    return false;
  };
  for (const n of deps.keys())
    if (dfs(n, [n])) {
      diags.push({ severity: 'error', summary: `Cycle: ${cycle.join(', ')}`, detail: '' });
      break;
    }
  const errors = diags.filter((d) => d.severity === 'error');
  if (errors.length) throw new TfError(errors, cfg.files);
  return cfg;
}

export function resourceDeps(_cfg: Config, r: ResourceConf): string[] {
  return [...new Set([...r.block.attrs.flatMap((a) => [...exprRefs(a.expr)]), ...r.dependsOn])].filter((d) => d !== rAddr(r));
}

/** Resource names in an order where dependencies come first. */
export function topoOrder(cfg: Config): ResourceConf[] {
  const out: ResourceConf[] = [];
  const seen = new Set<string>();
  const visit = (r: ResourceConf) => {
    const k = rAddr(r);
    if (seen.has(k)) return;
    seen.add(k);
    for (const d of resourceDeps(cfg, r)) {
      const dr = cfg.resources.find((x) => rAddr(x) === d);
      if (dr) visit(dr);
    }
    out.push(r);
  };
  cfg.resources.forEach(visit);
  return out;
}

// ── evaluation ──

export interface EvalScope {
  vars: Record<string, Value>;
  locals: Map<string, Expr>;
  resources: (type: string, name: string, module?: string) => Value | undefined;
  count?: number;
  file?: string;
}

const typeName = (v: Value) => (v === null ? 'null' : isUnknown(v) ? 'unknown' : Array.isArray(v) ? 'list' : typeof v === 'object' ? 'object' : typeof v);

function evalErr(e: Expr, summary: string, detail: string, scope: EvalScope): never {
  throw new TfError([{ severity: 'error', summary, detail, file: scope.file, line: e.line }]);
}

function ipToInt(ip: string): number {
  return ip.split('.').reduce((n, x) => n * 256 + Number(x), 0);
}
function intToIp(n: number): string {
  return [24, 16, 8, 0].map((s) => Math.floor(n / 2 ** s) % 256).join('.');
}

const FUNCS: Record<string, (args: Value[]) => Value> = {
  length: ([v]) => (typeof v === 'string' ? v.length : Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0),
  upper: ([v]) => String(v).toUpperCase(),
  lower: ([v]) => String(v).toLowerCase(),
  join: ([sep, list]) => (list as Value[]).map(String).join(String(sep)),
  concat: (args) => (args as Value[][]).flat(),
  contains: ([list, v]) => (list as Value[]).some((x) => JSON.stringify(x) === JSON.stringify(v)),
  element: ([list, i]) => (list as Value[])[Number(i) % (list as Value[]).length],
  lookup: ([m, k, d]) => ((m as Record<string, Value>)[String(k)] ?? d ?? null),
  tostring: ([v]) => String(v),
  tonumber: ([v]) => Number(v),
  max: (args) => Math.max(...args.map(Number)),
  min: (args) => Math.min(...args.map(Number)),
  format: ([f, ...rest]) => {
    let i = 0;
    return String(f).replace(/%[sdv%]/g, (m) => (m === '%%' ? '%' : String(rest[i++])));
  },
  cidrsubnet: ([prefix, newbits, netnum]) => {
    const [ip, len] = String(prefix).split('/');
    const L = Number(len) + Number(newbits);
    if (L > 32) throw new Error(`insufficient address space to extend prefix of ${len} by ${newbits}`);
    const base = ipToInt(ip) & (len === '0' ? 0 : ~(2 ** (32 - Number(len)) - 1) >>> 0);
    return `${intToIp((base + Number(netnum) * 2 ** (32 - L)) >>> 0)}/${L}`;
  },
};

export function evaluate(e: Expr, scope: EvalScope): Value {
  switch (e.k) {
    case 'lit':
      return e.v;
    case 'tpl': {
      let s = '';
      for (const p of e.parts) {
        if (typeof p === 'string') s += p;
        else {
          const v = evaluate(p, scope);
          if (isUnknown(v)) return UNKNOWN;
          s += String(v);
        }
      }
      return s;
    }
    case 'list':
      return e.items.map((x) => evaluate(x, scope));
    case 'obj':
      return Object.fromEntries(e.items.map(([k, x]) => [k, evaluate(x, scope)]));
    case 'cond': {
      const c = evaluate(e.c, scope);
      if (isUnknown(c)) return UNKNOWN;
      return c ? evaluate(e.a, scope) : evaluate(e.b, scope);
    }
    case 'not': {
      const v = evaluate(e.a, scope);
      return isUnknown(v) ? UNKNOWN : !v;
    }
    case 'neg': {
      const v = evaluate(e.a, scope);
      return isUnknown(v) ? UNKNOWN : -Number(v);
    }
    case 'bin': {
      const a = evaluate(e.a, scope);
      const b = evaluate(e.b, scope);
      if (isUnknown(a) || isUnknown(b)) return UNKNOWN;
      switch (e.op) {
        case '+':
          return Number(a) + Number(b);
        case '-':
          return Number(a) - Number(b);
        case '*':
          return Number(a) * Number(b);
        case '/':
          return Number(a) / Number(b);
        case '%':
          return Number(a) % Number(b);
        case '==':
          return JSON.stringify(a) === JSON.stringify(b);
        case '!=':
          return JSON.stringify(a) !== JSON.stringify(b);
        case '<':
          return Number(a) < Number(b);
        case '>':
          return Number(a) > Number(b);
        case '<=':
          return Number(a) <= Number(b);
        case '>=':
          return Number(a) >= Number(b);
        case '&&':
          return !!a && !!b;
        case '||':
          return !!a || !!b;
      }
      return null;
    }
    case 'call': {
      const fn = FUNCS[e.name];
      if (!fn) evalErr(e, 'Call to unknown function', `There is no function named "${e.name}".`, scope);
      const args = e.args.map((x) => evaluate(x, scope));
      if (args.some(isUnknown)) return UNKNOWN;
      try {
        return fn(args);
      } catch (err) {
        evalErr(e, 'Error in function call', `Call to function "${e.name}" failed: ${(err as Error).message}.`, scope);
      }
    }
    // falls through (never reached)
    case 'ref': {
      const path = e.path.map((p) => (typeof p === 'object' ? evaluate(p, scope) : p));
      const [a, b, ...rest] = path;
      let v: Value | undefined;
      if (a === 'var') {
        v = scope.vars[String(b)];
        if (v === undefined) evalErr(e, 'No value for required variable', `The root module input variable "${b}" is not set, and has no default value.`, scope);
      } else if (a === 'local') {
        const le = scope.locals.get(String(b));
        v = le ? evaluate(le, scope) : undefined;
      } else if (a === 'count') {
        if (scope.count === undefined) evalErr(e, 'Reference to "count" in non-counted context', 'The "count" object can only be used in resource blocks when the "count" argument is set.', scope);
        v = scope.count;
      } else if (a === 'path') v = '.';
      else if (typeof a === 'string' && a in SCHEMA) {
        v = scope.resources(a, String(b));
      } else if (a === 'module' && typeof rest[0] === 'string' && rest[0] in SCHEMA) {
        const [type, name, ...more] = rest;
        v = scope.resources(String(type), String(name), String(b));
        rest.splice(0, rest.length, ...more);
      } else evalErr(e, 'Invalid reference', `A reference to a resource type must be followed by at least one attribute access, specifying the resource name.`, scope);
      for (const k of rest) {
        if (isUnknown(v)) return UNKNOWN;
        if (Array.isArray(v)) {
          if (typeof k !== 'number') evalErr(e, 'Missing resource instance key', `Because ${a}.${b} has "count" set, its attributes must be accessed on specific instances.\n\nFor example, to correlate with indices of a referring resource, use:\n    ${a}.${b}[count.index]`, scope);
          v = v[k];
          if (v === undefined) evalErr(e, 'Invalid index', `The given key does not identify an element in this collection value: the collection has ${(scope.resources(String(a), String(b)) as Value[]).length} elements.`, scope);
        } else if (v && typeof v === 'object') {
          const next: Value | undefined = (v as Record<string, Value>)[String(k)];
          if (next === undefined) evalErr(e, 'Unsupported attribute', `This object has no argument, nested block, or exported attribute named "${k}".`, scope);
          v = next;
        } else evalErr(e, 'Unsupported attribute', `Can't access attributes on a primitive-typed value (${typeName(v ?? null)}).`, scope);
      }
      return v ?? null;
    }
  }
}

export function resolveVars(cfg: Config, given: Record<string, string>, tfvars: Record<string, string>, env: Record<string, string>): { vars: Record<string, Value>; diags: Diag[] } {
  const vars: Record<string, Value> = {};
  const diags: Diag[] = [];
  const scope: EvalScope = { vars: {}, locals: new Map(), resources: () => undefined };
  for (const [name, v] of cfg.variables) {
    const raw = given[name] ?? tfvars[name] ?? env[`TF_VAR_${name}`];
    let val: Value | undefined = raw !== undefined ? (v.type === 'number' || /^-?\d+(\.\d+)?$/.test(raw) && v.type !== 'string' ? Number(raw) : v.type === 'bool' ? raw === 'true' : raw) : v.default ? evaluate(v.default, scope) : undefined;
    if (v.type === 'number' && typeof val === 'string') {
      diags.push({ severity: 'error', summary: 'Invalid value for input variable', detail: `The given value is not suitable for var.${name}: a number is required.`, file: v.block.file, line: v.block.line });
      val = undefined;
    }
    if (val === undefined) {
      diags.push({ severity: 'error', summary: 'No value for required variable', detail: `The root module input variable "${name}" is not set, and has no default value. Use a -var or -var-file command line argument to provide a value for this variable.`, file: v.block.file, line: v.block.line });
      continue;
    }
    vars[name] = val;
  }
  for (const [name, v] of cfg.variables) {
    if (!(name in vars)) continue;
    for (const vb of v.block.blocks.filter((b) => b.type === 'validation')) {
      const cond = vb.attrs.find((a) => a.name === 'condition');
      const msg = vb.attrs.find((a) => a.name === 'error_message');
      if (!cond) continue;
      const ok = evaluate(cond.expr, { ...scope, vars, file: vb.file });
      if (ok === false) diags.push({ severity: 'error', summary: 'Invalid value for variable', detail: `${msg ? String(evaluate(msg.expr, { ...scope, vars })) : 'The value is invalid.'}\n\nThis was checked by the validation rule at ${vb.file}:${vb.line}.`, file: vb.file, line: cond.line, context: `var.${name}` });
    }
  }
  return { vars, diags };
}

export function parseTfvars(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Za-z_][\w-]*)\s*=\s*(.+?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
  return out;
}

// ── plan ──

export type Action = 'create' | 'update' | 'replace' | 'delete' | 'noop' | 'read';

export interface Change {
  addr: string;
  type: string;
  name: string;
  module?: string;
  index?: number;
  /** The object is brought under management by an import block in this plan. */
  importing?: string;
  /** The instance was at this address before a moved block. */
  movedFrom?: string;
  action: Action;
  before: Attrs | null;
  after: Attrs | null;
  /** Attributes whose change forces replacement. */
  forces: string[];
  createBeforeDestroy: boolean;
  deps: string[];
  reason?: string;
}

export interface Drift {
  addr: string;
  kind: 'changed' | 'deleted';
  before: Attrs;
  after?: Attrs;
}

export interface Plan {
  changes: Change[];
  drift: Drift[];
  refreshed: Instance[];
  outputs: Record<string, Value>;
  vars: Record<string, Value>;
  targeted: boolean;
  priorOutputs: Record<string, unknown>;
  /** moved blocks that renamed instances of the prior state. */
  moves: { from: string; to: string }[];
  /** import blocks that bring existing cloud objects into the state. */
  imports: { addr: string; id: string }[];
}

const canon = (v: unknown) => JSON.stringify(v ?? null);

export function plan(
  cfg: Config,
  prior: StateFile | null,
  cloud: Cloud,
  o: { vars: Record<string, Value>; refresh?: boolean; replace?: string[]; destroy?: boolean; target?: string[] },
): Plan {
  // moved blocks rename instances of the prior state before anything else.
  let priorInsts = stateInstances(prior);
  const moves: Plan['moves'] = [];
  for (const mv of cfg.moved) {
    const hits = priorInsts.filter((i) => i.addr === mv.from || i.addr.startsWith(mv.from + '['));
    for (const i of hits) {
      const to = i.addr === mv.from ? mv.to : mv.to + i.addr.slice(mv.from.length);
      if (priorInsts.some((x) => x.addr === to)) continue;
      const pa = parseAddr(to);
      if (!pa) continue;
      moves.push({ from: i.addr, to });
      priorInsts = priorInsts.map((x) => (x === i ? { ...x, addr: to, type: pa.type, name: pa.name, module: pa.module, index: pa.index } : x));
    }
  }
  // Refresh: read every resource the state knows from the cloud.
  const drift: Drift[] = [];
  const refreshed: Instance[] = [];
  for (const inst of priorInsts) {
    if (o.refresh === false) {
      refreshed.push(inst);
      continue;
    }
    const real = cloud.get(String(inst.attrs.id));
    if (!real) {
      drift.push({ addr: inst.addr, kind: 'deleted', before: inst.attrs });
      continue;
    }
    if (canon(real.attrs) !== canon(inst.attrs)) drift.push({ addr: inst.addr, kind: 'changed', before: inst.attrs, after: real.attrs });
    refreshed.push({ ...inst, attrs: { ...real.attrs } });
  }
  // import blocks: an object that exists in the cloud joins the state under its address.
  const imports: Plan['imports'] = [];
  for (const im of cfg.imports) {
    if (refreshed.some((i) => i.addr === im.to)) continue;
    const real = cloud.get(im.id);
    const pa = parseAddr(im.to)!;
    if (!real || real.type !== pa.type) throw new TfError([{ severity: 'error', summary: 'Cannot import non-existent remote object', detail: `While attempting to import an existing object to "${im.to}", the provider detected that no object exists with the given id. Only pre-existing objects can be imported; check that the id is correct and that it is associated with the provider's configured region or endpoint, or use "terraform apply" to create a new remote object for this resource.`, file: im.file, line: im.line }]);
    imports.push({ addr: im.to, id: im.id });
    refreshed.push({ addr: im.to, type: pa.type, name: pa.name, ...(pa.module ? { module: pa.module } : {}), index: pa.index, attrs: { ...real.attrs }, deps: [] });
  }
  const byAddr = new Map(refreshed.map((i) => [i.addr, i]));
  const changes: Change[] = [];
  const planned = new Map<string, Attrs>();
  const scope = (count?: number, file?: string): EvalScope => ({
    vars: o.vars,
    locals: cfg.locals,
    count,
    file,
    resources: (type, name, module) => {
      const r = cfg.resources.find((x) => x.type === type && x.name === name && x.module === module);
      if (!r) return undefined;
      const base = rAddr(r);
      const insts = [...planned.entries()].filter(([a]) => a === base || a.startsWith(`${base}[`));
      if (r.count) return insts.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([, v]) => v as Value);
      return (insts[0]?.[1] as Value) ?? UNKNOWN;
    },
  });
  if (!o.destroy) {
    for (const r of topoOrder(cfg)) {
      const n = r.count ? evaluate(r.count, scope(undefined, r.block.file)) : null;
      if (r.count && (typeof n !== 'number' || n < 0)) throw new TfError([{ severity: 'error', summary: 'Invalid count argument', detail: 'The given "count" argument value is unsuitable: must be a whole number.', file: r.block.file, line: r.block.line }]);
      const indexes = n === null ? [undefined] : Array.from({ length: n as number }, (_, i) => i);
      const schema = SCHEMA[r.type];
      const deps = resourceDeps(cfg, r);
      for (const idx of indexes) {
        const addr = `${rAddr(r)}${idx !== undefined ? `[${idx}]` : ''}`;
        const s = scope(idx, r.block.file);
        const desired: Attrs = {};
        for (const [k, spec] of Object.entries(schema)) {
          if (spec.computed) continue;
          const a = r.block.attrs.find((x) => x.name === k);
          let v: Value = a ? evaluate(a.expr, s) : spec.default ?? null;
          if (!isUnknown(v) && v !== null) {
            if (spec.type === 'number' && typeof v !== 'number') {
              if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
              else throw new TfError([{ severity: 'error', summary: 'Incorrect attribute value type', detail: `Inappropriate value for attribute "${k}": a number is required.`, file: r.block.file, line: a?.line, context: `resource "${r.type}" "${r.name}"` }]);
            }
            if (spec.type === 'string' && typeof v === 'number') v = String(v);
            if (spec.type === 'string' && typeof v !== 'string') throw new TfError([{ severity: 'error', summary: 'Incorrect attribute value type', detail: `Inappropriate value for attribute "${k}": string required.`, file: r.block.file, line: a?.line, context: `resource "${r.type}" "${r.name}"` }]);
          }
          desired[k] = v;
        }
        const before = byAddr.get(addr);
        if (!before) {
          const after: Attrs = { ...desired };
          for (const [k, spec] of Object.entries(schema)) if (spec.computed) after[k] = UNKNOWN;
          planned.set(addr, after);
          changes.push({ addr, type: r.type, name: r.name, ...(r.module ? { module: r.module } : {}), index: idx, action: 'create', before: null, after, forces: [], createBeforeDestroy: false, deps });
          continue;
        }
        const diffKeys = Object.keys(desired).filter((k) => !r.lifecycle.ignoreChanges.includes(k) && !isUnknown(desired[k]) && canon(desired[k]) !== canon(before.attrs[k]));
        const unknownForce = Object.keys(desired).filter((k) => isUnknown(desired[k]) && schema[k]?.force && !r.lifecycle.ignoreChanges.includes(k));
        const forces = [...diffKeys, ...unknownForce].filter((k) => schema[k]?.force);
        const replaceAsked = (o.replace ?? []).includes(addr);
        if (forces.length || replaceAsked) {
          const after: Attrs = { ...before.attrs, ...Object.fromEntries(Object.entries(desired).filter(([k]) => !r.lifecycle.ignoreChanges.includes(k))) };
          for (const [k, spec] of Object.entries(schema)) if (spec.computed) after[k] = UNKNOWN;
          planned.set(addr, after);
          changes.push({ addr, type: r.type, name: r.name, ...(r.module ? { module: r.module } : {}), index: idx, action: 'replace', before: before.attrs, after, forces, createBeforeDestroy: r.lifecycle.createBeforeDestroy, deps, reason: replaceAsked && !forces.length ? 'requested' : undefined });
        } else if (diffKeys.length || Object.keys(desired).some((k) => isUnknown(desired[k]) && !r.lifecycle.ignoreChanges.includes(k))) {
          const after: Attrs = { ...before.attrs };
          for (const k of Object.keys(desired)) if (!r.lifecycle.ignoreChanges.includes(k)) after[k] = desired[k];
          planned.set(addr, after);
          changes.push({ addr, type: r.type, name: r.name, ...(r.module ? { module: r.module } : {}), index: idx, action: 'update', before: before.attrs, after, forces: [], createBeforeDestroy: false, deps });
        } else {
          planned.set(addr, before.attrs);
          changes.push({ addr, type: r.type, name: r.name, ...(r.module ? { module: r.module } : {}), index: idx, action: 'noop', before: before.attrs, after: before.attrs, forces: [], createBeforeDestroy: false, deps });
        }
      }
    }
  }
  const inConfig = new Set(changes.map((c) => c.addr));
  for (const inst of refreshed) {
    if (inConfig.has(inst.addr)) continue;
    const r = cfg.resources.find((x) => x.type === inst.type && x.name === inst.name && x.module === inst.module);
    if (r?.lifecycle.preventDestroy) throw new TfError([{ severity: 'error', summary: 'Instance cannot be destroyed', detail: `Resource ${inst.addr} has lifecycle.prevent_destroy set, but the plan calls for this resource to be destroyed. To avoid this error and continue with the plan, either disable lifecycle.prevent_destroy or reduce the scope of the plan using the -target option.`, file: r.block.file, line: r.block.line }]);
    changes.push({ addr: inst.addr, type: inst.type, name: inst.name, ...(inst.module ? { module: inst.module } : {}), index: inst.index, action: 'delete', before: inst.attrs, after: null, forces: [], createBeforeDestroy: false, deps: inst.deps, reason: o.destroy ? undefined : r ? 'count' : 'no-config' });
  }
  for (const c of changes) {
    if (c.action !== 'replace') continue;
    const r = cfg.resources.find((x) => x.type === c.type && x.name === c.name && x.module === c.module);
    if (r?.lifecycle.preventDestroy) throw new TfError([{ severity: 'error', summary: 'Instance cannot be destroyed', detail: `Resource ${c.addr} has lifecycle.prevent_destroy set, but the plan calls for this resource to be destroyed.`, file: r.block.file, line: r.block.line }]);
  }
  // -target: keep the targets and everything they depend on.
  let targeted = false;
  if (o.target?.length) {
    targeted = true;
    const keep = new Set<string>();
    const add = (addr: string) => {
      for (const c of changes) {
        const base = c.addr.replace(/\[\d+\]$/, '');
        if ((c.addr === addr || base === addr) && !keep.has(c.addr)) {
          keep.add(c.addr);
          c.deps.forEach(add);
        }
      }
    };
    o.target.forEach(add);
    for (const c of changes) if (!keep.has(c.addr) && c.action !== 'noop') c.action = 'noop';
  }
  for (const c of changes) {
    const im = imports.find((i) => i.addr === c.addr);
    if (im) {
      c.importing = im.id;
      const i = refreshed.find((x) => x.addr === c.addr);
      if (i) i.deps = c.deps;
    }
    const mv = moves.find((m) => m.to === c.addr);
    if (mv) c.movedFrom = mv.from;
  }
  const outputs: Record<string, Value> = {};
  if (!o.destroy) for (const [n, out] of cfg.outputs) outputs[n] = evaluate(out.expr, scope(undefined, Object.keys(cfg.files)[0]));
  const priorOutputs = Object.fromEntries(Object.entries(prior?.outputs ?? {}).map(([k, v]) => [k, v.value]));
  return { changes, drift, refreshed, outputs, vars: o.vars, targeted, priorOutputs, moves, imports };
}

/** Whether a plan has anything to do: changes, moves or imports. */
/** Outputs whose value differs from the state (or is not known yet). */
export function changedOutputs(p: Plan): [string, Value][] {
  return Object.entries(p.outputs).filter(([k, v]) => isUnknown(v) || canon(v) !== canon(p.priorOutputs[k]));
}

export function hasWork(p: Plan): boolean {
  return p.changes.some((c) => c.action !== 'noop') || p.moves.length > 0 || p.imports.length > 0;
}

export function summary(p: Plan): { add: number; change: number; destroy: number; import: number } {
  let add = 0;
  let change = 0;
  let destroy = 0;
  for (const c of p.changes) {
    if (c.action === 'create') add++;
    else if (c.action === 'update') change++;
    else if (c.action === 'delete') destroy++;
    else if (c.action === 'replace') {
      add++;
      destroy++;
    }
  }
  return { add, change, destroy, import: p.imports.length };
}

// ── rendering ──

export interface Colors {
  g: (s: string) => string;
  y: (s: string) => string;
  r: (s: string) => string;
  b: (s: string) => string;
  d: (s: string) => string;
}
export const NO_COLOR: Colors = { g: (s) => s, y: (s) => s, r: (s) => s, b: (s) => s, d: (s) => s };
export const COLOR: Colors = { g: (s) => `\x1b[32m${s}\x1b[0m`, y: (s) => `\x1b[33m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`, b: (s) => `\x1b[1m${s}\x1b[0m`, d: (s) => `\x1b[2m${s}\x1b[0m` };

export function fmtValue(v: unknown, indent = '      '): string {
  if (isUnknown(v)) return '(known after apply)';
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.length ? `[\n${v.map((x) => `${indent}    ${fmtValue(x, indent + '    ')},`).join('\n')}\n${indent}]` : '[]';
  const entries = Object.entries(v as object);
  if (!entries.length) return '{}';
  const w = Math.max(...entries.map(([k]) => JSON.stringify(k).length));
  return `{\n${entries.map(([k, x]) => `${indent}    ${JSON.stringify(k).padEnd(w)} = ${fmtValue(x, indent + '    ')}`).join('\n')}\n${indent}}`;
}

function attrLines(c: Change, col: Colors, symbolFor: (k: string) => string): string[] {
  const keys = [...new Set([...Object.keys(c.before ?? {}), ...Object.keys(c.after ?? {})])].sort();
  const w = Math.max(...keys.map((k) => k.length));
  const lines: string[] = [];
  let hidden = 0;
  for (const k of keys) {
    const a = c.before?.[k];
    const b = c.after?.[k];
    const same = canon(a) === canon(b) && !isUnknown(b);
    if (c.action === 'update' && same && k !== 'id' && k !== 'name') {
      hidden++;
      continue;
    }
    if ((a === null || a === undefined) && (b === null || b === undefined)) continue;
    const sym = symbolFor(k);
    const pad = k.padEnd(w);
    let text: string;
    if (c.action === 'create') text = `${sym} ${pad} = ${fmtValue(b)}`;
    else if (c.action === 'delete') text = `${sym} ${pad} = ${fmtValue(a)} -> null`;
    else if (same) text = `  ${pad} = ${fmtValue(a)}`;
    else text = `${sym} ${pad} = ${fmtValue(a)} -> ${fmtValue(b)}${c.forces.includes(k) ? col.r(' # forces replacement') : ''}`;
    lines.push(`      ${text}`);
  }
  if (hidden) lines.push(col.d(`        # (${hidden} unchanged attribute${hidden === 1 ? '' : 's'} hidden)`));
  return lines;
}

export function renderChange(c: Change, col: Colors): string {
  const head = `resource "${c.type}" "${c.name}"`;
  const color = c.action === 'create' ? col.g : c.action === 'update' ? col.y : col.r;
  const sym = c.action === 'create' ? '+' : c.action === 'update' ? '~' : c.action === 'delete' ? '-' : c.createBeforeDestroy ? '+/-' : '-/+';
  const what =
    c.action === 'create'
      ? 'will be created'
      : c.action === 'update'
        ? 'will be updated in-place'
        : c.action === 'delete'
          ? 'will be destroyed'
          : c.reason === 'requested'
            ? 'will be replaced, as requested'
            : 'must be replaced';
  const lines: string[] = [];
  if (c.action !== 'noop') lines.push(`  ${col.b(`# ${c.addr}`)} ${col.b(what)}`);
  else if (c.movedFrom) lines.push(`  ${col.b(`# ${c.movedFrom}`)} ${col.b(`has moved to ${c.addr}`)}`);
  else if (c.importing) lines.push(`  ${col.b(`# ${c.addr}`)} ${col.b('will be imported')}`);
  if (c.action !== 'noop' && c.movedFrom) lines.push(`    # (moved from ${c.movedFrom})`);
  if (c.action !== 'noop' && c.importing) lines.push(`    # (imported from "${c.importing}")`);
  if (c.action === 'noop') {
    const keys = Object.keys(c.after ?? {}).sort();
    const w = Math.max(...keys.map((k) => k.length));
    lines.push(`    resource "${c.type}" "${c.name}" {`, ...keys.filter((k) => c.after![k] !== null && c.after![k] !== undefined).map((k) => `        ${k.padEnd(w)} = ${fmtValue(c.after![k], '        ')}`), '    }');
    return lines.join('\n');
  }
  if (c.action === 'delete' && c.reason === 'no-config') lines.push(`  # (because ${c.addr} is not in configuration)`);
  if (c.action === 'delete' && c.reason === 'count') lines.push(`  # (because index [${c.index}] is out of range for count)`);
  lines.push(`${color(sym.padStart(3))} ${head} {`);
  lines.push(
    ...attrLines(c, col, (k) => {
      if (c.action === 'create') return col.g('+');
      if (c.action === 'delete') return col.r('-');
      const a = c.before?.[k];
      const b = c.after?.[k];
      if (canon(a) === canon(b) && !isUnknown(b)) return ' ';
      return col.y('~');
    }),
  );
  lines.push('    }');
  return lines.join('\n');
}

export function renderPlan(p: Plan, col: Colors, mode: 'plan' | 'apply' | 'destroy'): string {
  let out = '';
  const driftShown = p.drift.filter((d) => d.kind === 'deleted' || d.after);
  if (driftShown.length) {
    out += `\n${col.b('Note: Objects have changed outside of Terraform')}\n\nTerraform detected the following changes made outside of Terraform since the\nlast "terraform apply" which may have affected this plan:\n\n`;
    for (const d of driftShown) {
      const da = parseAddr(d.addr) ?? { type: d.addr.split('.')[0], name: d.addr.split('.')[1] ?? '' };
      if (d.kind === 'deleted') out += `  ${col.b(`# ${d.addr}`)} has been deleted\n  ${col.r('-')} resource "${da.type}" "${da.name}" {\n      ${col.r('-')} id = ${JSON.stringify(d.before.id)} -> null\n    }\n\n`;
      else {
        const keys = Object.keys(d.after!).filter((k) => canon(d.after![k]) !== canon(d.before[k]));
        const w = Math.max(...keys.map((k) => k.length), 2);
        out += `  ${col.b(`# ${d.addr}`)} has changed\n  ${col.y('~')} resource "${da.type}" "${da.name}" {\n${keys.map((k) => `      ${col.y('~')} ${k.padEnd(w)} = ${fmtValue(d.before[k])} -> ${fmtValue(d.after![k])}`).join('\n')}\n        ${'id'.padEnd(w)} = ${JSON.stringify(d.before.id)}\n    }\n\n`;
      }
    }
    out += `\nUnless you have made equivalent changes to your configuration, or ignored the\nrelevant attributes using ignore_changes, the following plan may include\nactions to undo or respond to these changes.\n\n${'─'.repeat(77)}\n`;
  }
  const real = p.changes.filter((c) => c.action !== 'noop' || c.importing || c.movedFrom);
  if (!real.length) {
    const outs = mode === 'destroy' ? [] : changedOutputs(p);
    if (outs.length) {
      // Like Terraform: an output-only change is still a change, applied to the state alone.
      out += `\nChanges to Outputs:\n`;
      for (const [k, v] of outs) out += k in p.priorOutputs ? `  ${col.y('~')} ${k} = ${fmtValue(p.priorOutputs[k], '  ')} -> ${fmtValue(v, '  ')}\n` : `  ${col.g('+')} ${k} = ${fmtValue(v, '  ')}\n`;
      out += `\nYou can apply this plan to save these new output values to the Terraform\nstate, without changing any real infrastructure.\n`;
      return out;
    }
    out += `\n${col.g(col.b('No changes.'))} ${col.b('Your infrastructure matches the configuration.')}\n\nTerraform has compared your real infrastructure against your configuration\nand found no differences, so no changes are needed.\n`;
    return out;
  }
  const kinds = new Set(real.filter((c) => c.action !== 'noop').map((c) => c.action));
  if (kinds.size) out += `\nTerraform used the selected providers to generate the following execution\nplan. Resource actions are indicated with the following symbols:\n`;
  if (kinds.has('create')) out += `  ${col.g('+')} create\n`;
  if (kinds.has('update')) out += `  ${col.y('~')} update in-place\n`;
  if (kinds.has('delete')) out += `  ${col.r('-')} destroy\n`;
  if (real.some((c) => c.action === 'replace' && !c.createBeforeDestroy)) out += `${col.r('-')}/${col.g('+')} destroy and then create replacement\n`;
  if (real.some((c) => c.action === 'replace' && c.createBeforeDestroy)) out += `${col.g('+')}/${col.r('-')} create replacement and then destroy\n`;
  out += `\nTerraform will perform the following actions:\n\n`;
  for (const c of real) out += renderChange(c, col) + '\n\n';
  const s = summary(p);
  out += `${col.b('Plan:')} ${s.import ? `${s.import} to import, ` : ''}${s.add} to add, ${s.change} to change, ${s.destroy} to destroy.\n`;
  const outs = changedOutputs(p);
  if (outs.length && mode !== 'destroy') {
    out += `\nChanges to Outputs:\n`;
    for (const [k, v] of outs) out += k in p.priorOutputs ? `  ${col.y('~')} ${k} = ${fmtValue(p.priorOutputs[k], '  ')} -> ${fmtValue(v, '  ')}\n` : `  ${col.g('+')} ${k} = ${fmtValue(v, '  ')}\n`;
  }
  if (p.targeted) out += `\n${formatDiag({ severity: 'warning', summary: 'Resource targeting is in effect', detail: 'You are creating a plan with the -target option, which means that the result of this plan\nmay not represent all of the changes requested by the current configuration.\n\nThe -target option is not for routine use, and is provided only for exceptional situations\nsuch as recovering from errors or mistakes, or when Terraform specifically suggests to use it\nas part of an error message.' }, {}, col !== NO_COLOR)}`;
  return out;
}

// ── apply ──

export interface ApplyResult {
  state: StateFile;
  log: string;
  error?: string;
  done: { add: number; change: number; destroy: number; import: number };
}

export function apply(cfg: Config, prior: StateFile, p: Plan, cloud: Cloud, col: Colors, write: (s: StateFile) => void): ApplyResult {
  let insts = [...p.refreshed];
  const done = { add: 0, change: 0, destroy: 0, import: 0 };
  let log = '';
  for (const im of p.imports) {
    log += `${col.b(`${im.addr}: Importing... [id=${im.id}]`)}\n${col.b(`${im.addr}: Import complete [id=${im.id}]`)}\n`;
    done.import++;
  }
  const real = new Map<string, Attrs>(insts.map((i) => [i.addr, i.attrs]));
  const scope = (count?: number, file?: string): EvalScope => ({
    vars: p.vars,
    locals: cfg.locals,
    count,
    file,
    resources: (type, name, module) => {
      const r = cfg.resources.find((x) => x.type === type && x.name === name && x.module === module);
      const base = rAddr({ type, name, module });
      const hits = [...real.entries()].filter(([a]) => a === base || a.startsWith(`${base}[`));
      if (r?.count) return hits.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([, v]) => v as Value);
      return (hits[0]?.[1] as Value) ?? UNKNOWN;
    },
  });
  const desiredFor = (c: Change): Attrs => {
    const r = cfg.resources.find((x) => x.type === c.type && x.name === c.name && x.module === c.module)!;
    const s = scope(c.index, r.block.file);
    const out: Attrs = {};
    for (const [k, spec] of Object.entries(SCHEMA[c.type])) {
      if (spec.computed) continue;
      if (r.lifecycle.ignoreChanges.includes(k) && c.before) {
        out[k] = c.before[k];
        continue;
      }
      const a = r.block.attrs.find((x) => x.name === k);
      let v = a ? evaluate(a.expr, s) : spec.default ?? null;
      if (spec.type === 'number' && typeof v === 'string') v = Number(v);
      out[k] = v as unknown;
    }
    return out;
  };
  const t = (n: number) => `${n}s`;
  const save = () => {
    const outputs: StateFile['outputs'] = {};
    for (const [n, o] of cfg.outputs) {
      try {
        const v = evaluate(o.expr, scope(undefined, Object.keys(cfg.files)[0]));
        if (!isUnknown(v)) outputs[n] = { value: v, type: typeof v === 'number' ? 'number' : 'string' };
      } catch {
        /* outputs that cannot be computed yet are left out */
      }
    }
    prior = buildState(prior, insts, outputs);
    write(prior);
  };
  const order = p.changes.filter((c) => c.action !== 'noop');
  const creates = order.filter((c) => c.action !== 'delete');
  const deletes = order.filter((c) => c.action === 'delete').reverse();
  const fail = (c: Change, e: unknown, verb: string): ApplyResult => {
    const msg = e instanceof CloudError ? `${e.status} ${e.message}` : (e as Error).message;
    const r = cfg.resources.find((x) => x.type === c.type && x.name === c.name && x.module === c.module);
    log += '\n' + formatDiag({ severity: 'error', summary: `${verb} ${c.type.replace('edu_', '').replace('dns_record', 'DNS record').replace('vm', 'VM')}: ${msg}`, detail: '', file: r?.block.file, line: r?.block.line, context: `resource "${c.type}" "${c.name}"` }, cfg.files, col !== NO_COLOR);
    save();
    return { state: prior, log, error: msg, done };
  };
  try {
    for (const c of deletes) {
      log += `${col.b(`${c.addr}: Destroying... [id=${c.before!.id}]`)}\n`;
      try {
        cloud.delete(String(c.before!.id));
      } catch (e) {
        return fail(c, e, 'deleting');
      }
      insts = insts.filter((i) => i.addr !== c.addr);
      real.delete(c.addr);
      done.destroy++;
      log += `${col.b(`${c.addr}: Destruction complete after ${t(1)}`)}\n`;
    }
    for (const c of creates) {
      const want = desiredFor(c);
      if (c.action === 'create' || c.action === 'replace') {
        if (c.action === 'replace' && !c.createBeforeDestroy) {
          log += `${col.b(`${c.addr}: Destroying... [id=${c.before!.id}]`)}\n`;
          try {
            cloud.delete(String(c.before!.id));
          } catch (e) {
            return fail(c, e, 'deleting');
          }
          insts = insts.filter((i) => i.addr !== c.addr);
          done.destroy++;
          log += `${col.b(`${c.addr}: Destruction complete after ${t(2)}`)}\n`;
        }
        log += `${col.b(`${c.addr}: Creating...`)}\n`;
        let made;
        try {
          made = cloud.create(c.type, want);
        } catch (e) {
          return fail(c, e, 'creating');
        }
        const deps = c.deps;
        insts = insts.filter((i) => i.addr !== c.addr || c.createBeforeDestroy);
        if (c.action === 'replace' && c.createBeforeDestroy) {
          log += `${col.b(`${c.addr}: Creation complete after ${t(c.type === 'edu_vm' ? 21 : 2)} [id=${made.id}]`)}\n${col.b(`${c.addr} (deposed object): Destroying... [id=${c.before!.id}]`)}\n`;
          try {
            cloud.delete(String(c.before!.id));
          } catch (e) {
            return fail(c, e, 'deleting');
          }
          insts = insts.filter((i) => i.addr !== c.addr);
          done.destroy++;
          log += `${col.b(`${c.addr} (deposed object): Destruction complete after ${t(1)}`)}\n`;
        } else log += `${col.b(`${c.addr}: Creation complete after ${t(c.type === 'edu_vm' ? 21 : 2)} [id=${made.id}]`)}\n`;
        insts.push({ addr: c.addr, type: c.type, name: c.name, ...(c.module ? { module: c.module } : {}), index: c.index, attrs: made.attrs, deps });
        real.set(c.addr, made.attrs);
        done.add++;
      } else {
        const changed = Object.fromEntries(Object.entries(want).filter(([k, v]) => canon(v) !== canon(c.before![k])));
        log += `${col.b(`${c.addr}: Modifying... [id=${c.before!.id}]`)}\n`;
        let upd;
        try {
          upd = cloud.update(String(c.before!.id), changed);
        } catch (e) {
          return fail(c, e, 'updating');
        }
        insts = insts.map((i) => (i.addr === c.addr ? { ...i, attrs: upd.attrs } : i));
        real.set(c.addr, upd.attrs);
        done.change++;
        log += `${col.b(`${c.addr}: Modifications complete after ${t(c.type === 'edu_vm' && 'cores' in changed ? 14 : 1)} [id=${c.before!.id}]`)}\n`;
      }
      save();
    }
  } finally {
    /* state is written after every resource */
  }
  save();
  return { state: prior, log, done };
}

export { Unknown };
