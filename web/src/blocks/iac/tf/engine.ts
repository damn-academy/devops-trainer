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
  index?: number;
  attrs: Attrs;
  deps: string[];
}

export function stateInstances(s: StateFile | null): Instance[] {
  if (!s) return [];
  const out: Instance[] = [];
  for (const r of s.resources)
    for (const i of r.instances) out.push({ addr: `${r.type}.${r.name}${i.index_key !== undefined ? `[${i.index_key}]` : ''}`, type: r.type, name: r.name, index: i.index_key, attrs: i.attributes, deps: i.dependencies ?? [] });
  return out;
}

export function buildState(prev: StateFile, insts: Instance[], outputs: StateFile['outputs']): StateFile {
  const groups = new Map<string, StateResource>();
  for (const i of [...insts].sort((a, b) => (a.addr < b.addr ? -1 : 1))) {
    const k = `${i.type}.${i.name}`;
    if (!groups.has(k)) groups.set(k, { mode: 'managed', type: i.type, name: i.name, provider: `provider["${PROVIDER.source}"]`, instances: [] });
    groups.get(k)!.instances.push({ ...(i.index !== undefined ? { index_key: i.index } : {}), schema_version: 0, attributes: i.attrs, ...(i.deps.length ? { dependencies: i.deps } : {}) });
  }
  return { ...prev, serial: prev.serial + 1, terraform_version: TF_VERSION, outputs, resources: [...groups.values()] };
}

// ── configuration ──

export interface ResourceConf {
  type: string;
  name: string;
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
      const [a, b] = e.path;
      if (typeof a === 'string' && typeof b === 'string' && a in SCHEMA) out.add(`${a}.${b}`);
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

export function loadConfig(fs: FsApi, dir: string): Config {
  const files: Record<string, string> = {};
  for (const f of fs.readdir(dir).filter((n) => n.endsWith('.tf')).sort()) files[f] = fs.readFile(`${dir}/${f}`);
  if (!Object.keys(files).length) throw new TfError([{ severity: 'error', summary: 'No configuration files', detail: `Apply requires configuration to be present. Applying without a configuration would mark\neverything for destruction, which is normally not what is desired. If you would like to\ndestroy everything, run 'terraform destroy' instead.` }]);
  const cfg: Config = { files, variables: new Map(), locals: new Map(), resources: [], outputs: new Map(), hasProvider: false };
  const diags: Diag[] = [];
  for (const [file, text] of Object.entries(files)) {
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
        cfg.hasProvider = true;
        continue;
      }
      if (b.type === 'variable') {
        const def = b.attrs.find((a) => a.name === 'default');
        const type = b.attrs.find((a) => a.name === 'type');
        cfg.variables.set(b.labels[0], { block: b, default: def?.expr, type: type?.expr.k === 'ref' ? String(type.expr.path[0]) : undefined });
        continue;
      }
      if (b.type === 'locals') {
        for (const a of b.attrs) cfg.locals.set(a.name, a.expr);
        continue;
      }
      if (b.type === 'output') {
        const v = b.attrs.find((a) => a.name === 'value');
        if (!v) diags.push({ severity: 'error', summary: 'Missing required argument', detail: 'The argument "value" is required, but no definition was found.', file, line: b.line, context: `output "${b.labels[0]}"` });
        else cfg.outputs.set(b.labels[0], { expr: v.expr, sensitive: b.attrs.some((a) => a.name === 'sensitive' && a.expr.k === 'lit' && a.expr.v === true) });
        continue;
      }
      if (b.type === 'resource') {
        const [type, name] = b.labels;
        const ctx = `resource "${type}" "${name}"`;
        if (b.labels.length !== 2) {
          diags.push({ severity: 'error', summary: 'Missing name for resource', detail: 'All resource blocks must have 2 labels (type, name).', file, line: b.line });
          continue;
        }
        const schema = SCHEMA[type];
        if (!schema) {
          diags.push({ severity: 'error', summary: 'Invalid resource type', detail: `The provider edu/edu does not support resource type "${type}".`, file, line: b.line, context: ctx });
          continue;
        }
        if (cfg.resources.some((r) => r.type === type && r.name === name)) {
          diags.push({ severity: 'error', summary: 'Duplicate resource "' + type + '" configuration', detail: `A ${type} resource named "${name}" was already declared. Resource names must be unique per type in each module.`, file, line: b.line });
          continue;
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
          block: b,
          count: b.attrs.find((a) => a.name === 'count')?.expr,
          lifecycle: { createBeforeDestroy: lit('create_before_destroy') === true, preventDestroy: lit('prevent_destroy') === true, ignoreChanges: ic?.k === 'list' ? ic.items.map((x) => (x.k === 'ref' ? String(x.path[0]) : '')) : [] },
          dependsOn: dep?.k === 'list' ? dep.items.filter((x) => x.k === 'ref').map((x) => (x as { src: string }).src) : [],
        });
        continue;
      }
      if (b.type === 'data' || b.type === 'module') {
        diags.push({ severity: 'error', summary: `Unsupported block type`, detail: `Blocks of type "${b.type}" are not part of this training simulator yet.`, file, line: b.line });
        continue;
      }
      diags.push({ severity: 'error', summary: 'Unsupported block type', detail: `Blocks of type "${b.type}" are not expected here.`, file, line: b.line });
    }
  }
  // References to undeclared resources and variables.
  const declared = new Set(cfg.resources.map((r) => `${r.type}.${r.name}`));
  const walkRefs = (e: Expr, file: string, ctx: string) => {
    const visit = (x: Expr): void => {
      if (x.k === 'ref') {
        const [a, b] = x.path;
        if (typeof a === 'string' && a in SCHEMA && typeof b === 'string' && !declared.has(`${a}.${b}`)) diags.push({ severity: 'error', summary: 'Reference to undeclared resource', detail: `A managed resource "${a}" "${b}" has not been declared in the root module.`, file, line: x.line, context: ctx });
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
  for (const r of cfg.resources) for (const a of r.block.attrs) if (a.name !== 'depends_on') walkRefs(a.expr, r.block.file, `resource "${r.type}" "${r.name}"`);
  for (const [n, o] of cfg.outputs) walkRefs(o.expr, Object.keys(files)[0], `output "${n}"`);
  // Cycles.
  const deps = new Map(cfg.resources.map((r) => [`${r.type}.${r.name}`, new Set([...r.block.attrs.flatMap((a) => [...exprRefs(a.expr)]), ...r.dependsOn])]));
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
  for (const n of deps.keys()) if (dfs(n, [n])) {
    diags.push({ severity: 'error', summary: `Cycle: ${cycle.join(', ')}`, detail: '' });
    break;
  }
  if (diags.length) throw new TfError(diags, files);
  return cfg;
}

export function resourceDeps(_cfg: Config, r: ResourceConf): string[] {
  return [...new Set([...r.block.attrs.flatMap((a) => [...exprRefs(a.expr)]), ...r.dependsOn])].filter((d) => d !== `${r.type}.${r.name}`);
}

/** Resource names in an order where dependencies come first. */
export function topoOrder(cfg: Config): ResourceConf[] {
  const out: ResourceConf[] = [];
  const seen = new Set<string>();
  const visit = (r: ResourceConf) => {
    const k = `${r.type}.${r.name}`;
    if (seen.has(k)) return;
    seen.add(k);
    for (const d of resourceDeps(cfg, r)) {
      const dr = cfg.resources.find((x) => `${x.type}.${x.name}` === d);
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
  resources: (type: string, name: string) => Value | undefined;
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
  index?: number;
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
}

const canon = (v: unknown) => JSON.stringify(v ?? null);

export function plan(
  cfg: Config,
  prior: StateFile | null,
  cloud: Cloud,
  o: { vars: Record<string, Value>; refresh?: boolean; replace?: string[]; destroy?: boolean; target?: string[] },
): Plan {
  // Refresh: read every resource the state knows from the cloud.
  const drift: Drift[] = [];
  const refreshed: Instance[] = [];
  for (const inst of stateInstances(prior)) {
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
  const byAddr = new Map(refreshed.map((i) => [i.addr, i]));
  const changes: Change[] = [];
  const planned = new Map<string, Attrs>();
  const scope = (count?: number, file?: string): EvalScope => ({
    vars: o.vars,
    locals: cfg.locals,
    count,
    file,
    resources: (type, name) => {
      const r = cfg.resources.find((x) => x.type === type && x.name === name);
      if (!r) return undefined;
      const insts = [...planned.entries()].filter(([a]) => a === `${type}.${name}` || a.startsWith(`${type}.${name}[`));
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
        const addr = `${r.type}.${r.name}${idx !== undefined ? `[${idx}]` : ''}`;
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
          changes.push({ addr, type: r.type, name: r.name, index: idx, action: 'create', before: null, after, forces: [], createBeforeDestroy: false, deps });
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
          changes.push({ addr, type: r.type, name: r.name, index: idx, action: 'replace', before: before.attrs, after, forces, createBeforeDestroy: r.lifecycle.createBeforeDestroy, deps, reason: replaceAsked && !forces.length ? 'requested' : undefined });
        } else if (diffKeys.length || Object.keys(desired).some((k) => isUnknown(desired[k]) && !r.lifecycle.ignoreChanges.includes(k))) {
          const after: Attrs = { ...before.attrs };
          for (const k of Object.keys(desired)) if (!r.lifecycle.ignoreChanges.includes(k)) after[k] = desired[k];
          planned.set(addr, after);
          changes.push({ addr, type: r.type, name: r.name, index: idx, action: 'update', before: before.attrs, after, forces: [], createBeforeDestroy: false, deps });
        } else {
          planned.set(addr, before.attrs);
          changes.push({ addr, type: r.type, name: r.name, index: idx, action: 'noop', before: before.attrs, after: before.attrs, forces: [], createBeforeDestroy: false, deps });
        }
      }
    }
  }
  const inConfig = new Set(changes.map((c) => c.addr));
  for (const inst of refreshed) {
    if (inConfig.has(inst.addr)) continue;
    const r = cfg.resources.find((x) => x.type === inst.type && x.name === inst.name);
    if (r?.lifecycle.preventDestroy) throw new TfError([{ severity: 'error', summary: 'Instance cannot be destroyed', detail: `Resource ${inst.addr} has lifecycle.prevent_destroy set, but the plan calls for this resource to be destroyed. To avoid this error and continue with the plan, either disable lifecycle.prevent_destroy or reduce the scope of the plan using the -target option.`, file: r.block.file, line: r.block.line }]);
    changes.push({ addr: inst.addr, type: inst.type, name: inst.name, index: inst.index, action: 'delete', before: inst.attrs, after: null, forces: [], createBeforeDestroy: false, deps: inst.deps, reason: o.destroy ? undefined : r ? 'count' : 'no-config' });
  }
  for (const c of changes) {
    if (c.action !== 'replace') continue;
    const r = cfg.resources.find((x) => x.type === c.type && x.name === c.name);
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
  const outputs: Record<string, Value> = {};
  if (!o.destroy) for (const [n, out] of cfg.outputs) outputs[n] = evaluate(out.expr, scope(undefined, Object.keys(cfg.files)[0]));
  const priorOutputs = Object.fromEntries(Object.entries(prior?.outputs ?? {}).map(([k, v]) => [k, v.value]));
  return { changes, drift, refreshed, outputs, vars: o.vars, targeted, priorOutputs };
}

export function summary(p: Plan): { add: number; change: number; destroy: number } {
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
  return { add, change, destroy };
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
  const lines = [`  ${col.b(`# ${c.addr}`)} ${col.b(what)}`];
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
      if (d.kind === 'deleted') out += `  ${col.b(`# ${d.addr}`)} has been deleted\n  ${col.r('-')} resource "${d.addr.split('.')[0]}" "${d.addr.split('.')[1].replace(/\[\d+\]$/, '')}" {\n      ${col.r('-')} id = ${JSON.stringify(d.before.id)} -> null\n    }\n\n`;
      else {
        const keys = Object.keys(d.after!).filter((k) => canon(d.after![k]) !== canon(d.before[k]));
        const w = Math.max(...keys.map((k) => k.length), 2);
        out += `  ${col.b(`# ${d.addr}`)} has changed\n  ${col.y('~')} resource "${d.addr.split('.')[0]}" "${d.addr.split('.')[1].replace(/\[\d+\]$/, '')}" {\n${keys.map((k) => `      ${col.y('~')} ${k.padEnd(w)} = ${fmtValue(d.before[k])} -> ${fmtValue(d.after![k])}`).join('\n')}\n        ${'id'.padEnd(w)} = ${JSON.stringify(d.before.id)}\n    }\n\n`;
      }
    }
    out += `\nUnless you have made equivalent changes to your configuration, or ignored the\nrelevant attributes using ignore_changes, the following plan may include\nactions to undo or respond to these changes.\n\n${'─'.repeat(77)}\n`;
  }
  const real = p.changes.filter((c) => c.action !== 'noop');
  if (!real.length) {
    const outputsChanged = false;
    out += `\n${col.g(col.b('No changes.'))} ${col.b('Your infrastructure matches the configuration.')}\n\nTerraform has compared your real infrastructure against your configuration\nand found no differences, so no changes are needed.\n`;
    void outputsChanged;
    return out;
  }
  const kinds = new Set(real.map((c) => c.action));
  out += `\nTerraform used the selected providers to generate the following execution\nplan. Resource actions are indicated with the following symbols:\n`;
  if (kinds.has('create')) out += `  ${col.g('+')} create\n`;
  if (kinds.has('update')) out += `  ${col.y('~')} update in-place\n`;
  if (kinds.has('delete')) out += `  ${col.r('-')} destroy\n`;
  if (real.some((c) => c.action === 'replace' && !c.createBeforeDestroy)) out += `${col.r('-')}/${col.g('+')} destroy and then create replacement\n`;
  if (real.some((c) => c.action === 'replace' && c.createBeforeDestroy)) out += `${col.g('+')}/${col.r('-')} create replacement and then destroy\n`;
  out += `\nTerraform will perform the following actions:\n\n`;
  for (const c of real) out += renderChange(c, col) + '\n\n';
  const s = summary(p);
  out += `${col.b('Plan:')} ${s.add} to add, ${s.change} to change, ${s.destroy} to destroy.\n`;
  const outs = Object.entries(p.outputs).filter(([k, v]) => isUnknown(v) || canon(v) !== canon(p.priorOutputs[k]));
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
  done: { add: number; change: number; destroy: number };
}

export function apply(cfg: Config, prior: StateFile, p: Plan, cloud: Cloud, col: Colors, write: (s: StateFile) => void): ApplyResult {
  let insts = [...p.refreshed];
  const done = { add: 0, change: 0, destroy: 0 };
  let log = '';
  const real = new Map<string, Attrs>(insts.map((i) => [i.addr, i.attrs]));
  const scope = (count?: number, file?: string): EvalScope => ({
    vars: p.vars,
    locals: cfg.locals,
    count,
    file,
    resources: (type, name) => {
      const r = cfg.resources.find((x) => x.type === type && x.name === name);
      const hits = [...real.entries()].filter(([a]) => a === `${type}.${name}` || a.startsWith(`${type}.${name}[`));
      if (r?.count) return hits.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(([, v]) => v as Value);
      return (hits[0]?.[1] as Value) ?? UNKNOWN;
    },
  });
  const desiredFor = (c: Change): Attrs => {
    const r = cfg.resources.find((x) => x.type === c.type && x.name === c.name)!;
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
    const r = cfg.resources.find((x) => x.type === c.type && x.name === c.name);
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
        insts.push({ addr: c.addr, type: c.type, name: c.name, index: c.index, attrs: made.attrs, deps });
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
