// .gitlab-ci.yml → pipeline description, with the checks GitLab's linter makes
// on the subset the course uses: YAML syntax, top-level keywords, job keys,
// stages, `needs`, `rules`, `extends`, `default:`. Messages follow GitLab's
// wording so the learner recognises them in a real project.

import { isMap, isScalar, isSeq, LineCounter, parseDocument, type Node as YNode } from 'yaml';

export interface CiRule {
  if?: string;
  changes?: string[];
  when?: When;
  allowFailure?: boolean;
  variables?: Record<string, string>;
}

export type When = 'on_success' | 'on_failure' | 'always' | 'manual' | 'never' | 'delayed';

export interface CiJob {
  name: string;
  stage: string;
  image?: string;
  script: string[];
  beforeScript: string[];
  afterScript: string[];
  variables: Record<string, string>;
  rules?: CiRule[];
  only?: string[];
  except?: string[];
  when: When;
  allowFailure: boolean;
  /** null: no `needs` key (stage order); []: needs nothing, starts at once. */
  needs: { job: string; artifacts: boolean; optional: boolean }[] | null;
  artifacts?: { paths: string[]; expireIn?: string; when: 'on_success' | 'on_failure' | 'always'; untracked?: boolean };
  cache?: { key: string; keyFiles?: string[]; paths: string[]; policy: 'pull-push' | 'pull' | 'push' };
  environment?: { name: string; url?: string; action?: string };
  tags: string[];
  retry: number;
  timeout?: string;
  resourceGroup?: string;
  line: number;
}

export interface CiConfig {
  stages: string[];
  variables: Record<string, string>;
  jobs: CiJob[];
}

export interface CiIssue {
  line: number;
  message: string;
}

export interface CiParse {
  config: CiConfig | null;
  errors: CiIssue[];
  warnings: CiIssue[];
}

const TOP = new Set(['stages', 'variables', 'default', 'include', 'workflow', 'image', 'services', 'before_script', 'after_script', 'cache', 'pages']);
const JOB_KEYS = new Set([
  'script', 'before_script', 'after_script', 'stage', 'image', 'services', 'variables', 'rules', 'only', 'except', 'when', 'allow_failure', 'needs', 'artifacts', 'cache',
  'environment', 'tags', 'dependencies', 'retry', 'timeout', 'interruptible', 'extends', 'parallel', 'resource_group', 'coverage', 'release', 'trigger', 'inherit', 'id_tokens',
  'secrets', 'hooks', 'start_in', 'manual_confirmation',
]);
const DEFAULT_KEYS = new Set(['image', 'services', 'before_script', 'after_script', 'cache', 'tags', 'retry', 'timeout', 'interruptible', 'artifacts', 'hooks', 'id_tokens']);
const WHEN = new Set(['on_success', 'on_failure', 'always', 'manual', 'never', 'delayed']);
const DEFAULT_STAGES = ['build', 'test', 'deploy'];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function strList(v: unknown): string[] | null {
  if (v === undefined || v === null) return [];
  if (typeof v === 'string') return [v];
  if (typeof v === 'number' || typeof v === 'boolean') return [String(v)];
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const x of v) {
      if (Array.isArray(x)) {
        const inner = strList(x);
        if (!inner) return null;
        out.push(...inner);
      } else if (typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean') out.push(String(x));
      else return null;
    }
    return out;
  }
  return null;
}

function vars(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isObj(v)) return out;
  for (const [k, x] of Object.entries(v)) out[k] = isObj(x) ? String(x.value ?? '') : String(x ?? '');
  return out;
}

function deepMerge(base: Obj, over: Obj): Obj {
  const out: Obj = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k] as Obj, v) : v;
  return out;
}

function lineOf(doc: ReturnType<typeof parseDocument>, lc: LineCounter, path: (string | number)[]): number {
  let node: unknown = doc.contents;
  let line = 1;
  for (const key of path) {
    if (isMap(node)) {
      const pair = node.items.find((p) => isScalar(p.key) && String(p.key.value) === String(key));
      if (!pair) break;
      const k = pair.key as YNode;
      if (k.range) line = lc.linePos(k.range[0]).line;
      node = pair.value;
    } else if (isSeq(node) && typeof key === 'number') {
      const item = node.items[key] as YNode | undefined;
      if (item?.range) line = lc.linePos(item.range[0]).line;
      node = item;
    } else break;
  }
  return line;
}

export function parseCi(text: string): CiParse {
  const errors: CiIssue[] = [];
  const warnings: CiIssue[] = [];
  const lc = new LineCounter();
  const doc = parseDocument(text, { lineCounter: lc, prettyErrors: false, uniqueKeys: true });
  if (doc.errors.length) {
    for (const e of doc.errors) {
      const pos = e.linePos?.[0];
      errors.push({ line: pos?.line ?? 1, message: `(<unknown>): ${e.message.split('\n')[0].replace(/ at line \d+, column \d+:?$/, '')} at line ${pos?.line ?? 1} column ${pos?.col ?? 1}` });
    }
    return { config: null, errors, warnings };
  }
  const root = doc.toJS({ maxAliasCount: 50 }) as unknown;
  if (root === null || root === undefined) {
    errors.push({ line: 1, message: 'Please provide content of .gitlab-ci.yml' });
    return { config: null, errors, warnings };
  }
  if (!isObj(root)) {
    errors.push({ line: 1, message: 'Invalid configuration format' });
    return { config: null, errors, warnings };
  }
  const L = (...p: (string | number)[]) => lineOf(doc, lc, p);

  let stages = DEFAULT_STAGES;
  if ('stages' in root) {
    const s = strList(root.stages);
    if (!s) errors.push({ line: L('stages'), message: 'stages config should be an array of strings' });
    else stages = s;
  }
  const allStages = ['.pre', ...stages, '.post'];
  const globalVars = vars(root.variables);
  let defaults: Obj = {};
  if (isObj(root.default)) {
    for (const k of Object.keys(root.default)) if (!DEFAULT_KEYS.has(k)) errors.push({ line: L('default', k), message: `default config contains unknown keys: ${k}` });
    defaults = root.default;
  }
  // Top-level image/before_script etc. are the deprecated globals: they act like default:.
  for (const k of ['image', 'services', 'before_script', 'after_script', 'cache']) if (k in root && !(k in defaults)) defaults = { ...defaults, [k]: root[k] };

  const raw: Record<string, Obj> = {};
  for (const [k, v] of Object.entries(root)) {
    if (TOP.has(k)) continue;
    if (!isObj(v)) {
      errors.push({ line: L(k), message: `jobs:${k} config should be a hash` });
      continue;
    }
    raw[k] = v;
  }
  // extends: resolve hidden templates and other jobs, deepest first.
  const resolved = new Map<string, Obj>();
  const resolve = (name: string, chain: string[]): Obj => {
    if (resolved.has(name)) return resolved.get(name)!;
    const job = raw[name];
    if (!job) return {};
    let base: Obj = {};
    const ext = strList(job.extends) ?? [];
    for (const e of ext) {
      if (chain.includes(e)) {
        errors.push({ line: L(name, 'extends'), message: `${name}: circular dependency detected in \`extends\`` });
        continue;
      }
      if (!raw[e]) {
        errors.push({ line: L(name, 'extends'), message: `${name}: unknown key in \`extends\` (${e})` });
        continue;
      }
      base = deepMerge(base, resolve(e, [...chain, e]));
    }
    const { extends: _drop, ...own } = job;
    void _drop;
    const out = deepMerge(base, own);
    resolved.set(name, out);
    return out;
  };

  const jobs: CiJob[] = [];
  for (const name of Object.keys(raw)) {
    const j0 = resolve(name, [name]);
    if (name.startsWith('.')) continue;
    const j = { ...Object.fromEntries(Object.entries(defaults).filter(([k]) => !(k in j0))), ...j0 } as Obj;
    const unknown = Object.keys(raw[name]).filter((k) => !JOB_KEYS.has(k));
    if (unknown.length) errors.push({ line: L(name, unknown[0]), message: `jobs:${name} config contains unknown keys: ${unknown.join(', ')}` });
    if (!('script' in j) && !('trigger' in j)) errors.push({ line: L(name), message: `jobs:${name} config should implement the script:, run:, or trigger: keyword` });
    const script = strList(j.script);
    if (script === null) errors.push({ line: L(name, 'script'), message: `jobs:${name}:script config should be a string or a nested array of strings up to 10 levels deep` });
    const stage = j.stage === undefined ? 'test' : String(j.stage);
    if (!allStages.includes(stage)) errors.push({ line: L(name, 'stage'), message: `${name} job: chosen stage ${stage} does not exist; available stages are ${allStages.join(', ')}` });
    let when: When = 'on_success';
    if (j.when !== undefined) {
      if (!WHEN.has(String(j.when))) errors.push({ line: L(name, 'when'), message: `jobs:${name} when unknown value: ${String(j.when)}` });
      else when = String(j.when) as When;
    }
    let rules: CiRule[] | undefined;
    if (j.rules !== undefined) {
      if (!Array.isArray(j.rules)) errors.push({ line: L(name, 'rules'), message: `jobs:${name}:rules config should be an array of hashes` });
      else {
        rules = [];
        j.rules.forEach((r, i) => {
          if (!isObj(r)) {
            errors.push({ line: L(name, 'rules', i), message: `jobs:${name}:rules:rule config should be a hash` });
            return;
          }
          const bad = Object.keys(r).filter((k) => !['if', 'changes', 'exists', 'when', 'allow_failure', 'variables', 'needs', 'start_in'].includes(k));
          if (bad.length) errors.push({ line: L(name, 'rules', i), message: `jobs:${name}:rules:rule config contains unknown keys: ${bad.join(', ')}` });
          if (r.when !== undefined && !WHEN.has(String(r.when))) errors.push({ line: L(name, 'rules', i), message: `jobs:${name}:rules:rule when unknown value: ${String(r.when)}` });
          const changes = isObj(r.changes) ? strList(r.changes.paths) : strList(r.changes);
          rules!.push({ if: r.if === undefined ? undefined : String(r.if), changes: r.changes === undefined ? undefined : changes ?? [], when: r.when as When | undefined, allowFailure: r.allow_failure === undefined ? undefined : !!r.allow_failure, variables: vars(r.variables) });
        });
      }
      if (j.only !== undefined || j.except !== undefined) errors.push({ line: L(name, 'rules'), message: `jobs:${name} config key may not be used with \`rules\`: only` + (j.except !== undefined ? ', except' : '') });
    }
    let needs: CiJob['needs'] = null;
    if (j.needs !== undefined) {
      if (!Array.isArray(j.needs)) errors.push({ line: L(name, 'needs'), message: `jobs:${name}:needs config should be an array` });
      else
        needs = j.needs.map((n) =>
          typeof n === 'string' ? { job: n, artifacts: true, optional: false } : isObj(n) ? { job: String(n.job ?? ''), artifacts: n.artifacts !== false, optional: !!n.optional } : { job: String(n), artifacts: true, optional: false },
        );
    }
    let artifacts: CiJob['artifacts'];
    if (j.artifacts !== undefined) {
      if (!isObj(j.artifacts)) errors.push({ line: L(name, 'artifacts'), message: `jobs:${name}:artifacts config should be a hash` });
      else {
        const paths = strList(j.artifacts.paths);
        if (paths === null) errors.push({ line: L(name, 'artifacts', 'paths'), message: `jobs:${name}:artifacts paths should be an array of strings` });
        const aw = String(j.artifacts.when ?? 'on_success');
        artifacts = { paths: paths ?? [], expireIn: j.artifacts.expire_in === undefined ? undefined : String(j.artifacts.expire_in), when: (['on_success', 'on_failure', 'always'].includes(aw) ? aw : 'on_success') as 'on_success', untracked: !!j.artifacts.untracked };
      }
    }
    let cache: CiJob['cache'];
    if (j.cache !== undefined) {
      const c = Array.isArray(j.cache) ? j.cache[0] : j.cache;
      if (!isObj(c)) errors.push({ line: L(name, 'cache'), message: `jobs:${name}:cache config should be a hash or an array of hashes` });
      else {
        const k = c.key;
        const keyFiles = isObj(k) ? strList(k.files) ?? [] : undefined;
        const policy = String(c.policy ?? 'pull-push');
        if (!['pull-push', 'pull', 'push'].includes(policy)) errors.push({ line: L(name, 'cache', 'policy'), message: `jobs:${name}:cache policy should be pull-push, push, or pull, or a variable` });
        cache = { key: isObj(k) ? '' : String(k ?? 'default'), keyFiles, paths: strList(c.paths) ?? [], policy: policy as 'pull' };
      }
    }
    let environment: CiJob['environment'];
    if (j.environment !== undefined) {
      if (typeof j.environment === 'string') environment = { name: j.environment };
      else if (isObj(j.environment) && j.environment.name) environment = { name: String(j.environment.name), url: j.environment.url ? String(j.environment.url) : undefined, action: j.environment.action ? String(j.environment.action) : undefined };
      else errors.push({ line: L(name, 'environment'), message: `jobs:${name}:environment name can't be blank` });
    }
    const retryRaw = isObj(j.retry) ? j.retry.max : j.retry;
    const retry = retryRaw === undefined ? 0 : Number(retryRaw);
    if (Number.isNaN(retry) || retry < 0 || retry > 2) errors.push({ line: L(name, 'retry'), message: `jobs:${name}:retry config must be between 0 and 2` });
    const allowFailure = j.allow_failure === undefined ? when === 'manual' : isObj(j.allow_failure) ? true : !!j.allow_failure;
    jobs.push({
      name,
      stage,
      image: isObj(j.image) ? String(j.image.name ?? '') : j.image === undefined ? undefined : String(j.image),
      script: script ?? [],
      beforeScript: strList(j.before_script) ?? [],
      afterScript: strList(j.after_script) ?? [],
      variables: vars(j.variables),
      rules,
      only: j.only === undefined ? undefined : isObj(j.only) ? strList(j.only.refs) ?? [] : strList(j.only) ?? [],
      except: j.except === undefined ? undefined : isObj(j.except) ? strList(j.except.refs) ?? [] : strList(j.except) ?? [],
      when,
      allowFailure,
      needs,
      artifacts,
      cache,
      environment,
      tags: strList(j.tags) ?? [],
      retry: Number.isNaN(retry) ? 0 : retry,
      timeout: j.timeout === undefined ? undefined : String(j.timeout),
      resourceGroup: j.resource_group === undefined ? undefined : String(j.resource_group),
      line: L(name),
    });
  }
  if (!jobs.length && !errors.length) errors.push({ line: 1, message: 'jobs config should contain at least one visible job' });
  // Semantic checks the schema cannot make.
  const byName = new Map(jobs.map((j) => [j.name, j]));
  for (const j of jobs) {
    for (const n of j.needs ?? []) {
      const dep = byName.get(n.job);
      if (!dep) {
        if (!n.optional) errors.push({ line: lineOf(doc, lc, [j.name, 'needs']), message: `'${j.name}' job needs '${n.job}' job, but '${n.job}' does not exist in the pipeline. This might be because of the only, except, or rules keywords. To need a job that sometimes does not exist in the pipeline, use needs:optional.` });
        continue;
      }
      if (allStages.indexOf(dep.stage) > allStages.indexOf(j.stage)) errors.push({ line: lineOf(doc, lc, [j.name, 'needs']), message: `${j.name} job: need ${n.job} is not defined in current or prior stages` });
    }
  }
  // Cycles in needs.
  const visiting = new Set<string>();
  const done = new Set<string>();
  const dfs = (n: string): boolean => {
    if (done.has(n)) return false;
    if (visiting.has(n)) return true;
    visiting.add(n);
    for (const d of byName.get(n)?.needs ?? []) if (byName.has(d.job) && dfs(d.job)) return true;
    visiting.delete(n);
    done.add(n);
    return false;
  };
  for (const j of jobs) if (dfs(j.name)) {
    errors.push({ line: j.line, message: `The pipeline has circular dependencies` });
    break;
  }
  // Warnings the linter shows.
  for (const j of jobs) {
    if (j.only || j.except) warnings.push({ line: j.line, message: `jobs:${j.name}: only and except are not being actively developed. Use rules instead.` });
  }
  return { config: errors.length ? null : { stages: allStages, variables: globalVars, jobs }, errors, warnings };
}

// ── rules:if expressions (GitLab CI/CD expression syntax, the common subset) ──

type Tok = { t: 'var' | 'str' | 're' | 'null' | 'op' | 'lp' | 'rp'; v: string };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '$') {
      const m = /^\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/.exec(src.slice(i));
      if (!m) throw new Error(`invalid expression syntax`);
      out.push({ t: 'var', v: m[1] });
      i += m[0].length;
    } else if (c === '"' || c === "'") {
      const end = src.indexOf(c, i + 1);
      if (end < 0) throw new Error('invalid expression syntax');
      out.push({ t: 'str', v: src.slice(i + 1, end) });
      i = end + 1;
    } else if (c === '/') {
      let j = i + 1;
      while (j < src.length && src[j] !== '/') j += src[j] === '\\' ? 2 : 1;
      const flags = /^[imsx]*/.exec(src.slice(j + 1))![0];
      out.push({ t: 're', v: src.slice(i + 1, j) + '/' + flags });
      i = j + 1 + flags.length;
    } else if (src.startsWith('null', i)) {
      out.push({ t: 'null', v: '' });
      i += 4;
    } else if (/^(==|!=|=~|!~|&&|\|\|)/.test(src.slice(i))) {
      out.push({ t: 'op', v: src.slice(i, i + 2) });
      i += 2;
    } else if (c === '(') {
      out.push({ t: 'lp', v: c });
      i++;
    } else if (c === ')') {
      out.push({ t: 'rp', v: c });
      i++;
    } else throw new Error('invalid expression syntax');
  }
  return out;
}

/** Evaluate a `rules:if` expression against CI variables. Undefined variables are null. */
export function evalIf(expr: string, env: Record<string, string>): boolean {
  const toks = lex(expr);
  let p = 0;
  type V = string | null | { re: RegExp };
  const val = (): V => {
    const t = toks[p++];
    if (!t) throw new Error('invalid expression syntax');
    if (t.t === 'var') return env[t.v] ?? null;
    if (t.t === 'str') return t.v;
    if (t.t === 'null') return null;
    if (t.t === 're') {
      const k = t.v.lastIndexOf('/');
      return { re: new RegExp(t.v.slice(0, k), t.v.slice(k + 1).replace('x', '')) };
    }
    throw new Error('invalid expression syntax');
  };
  const truthy = (v: V) => v !== null && v !== '' && typeof v === 'string';
  const cmp = (): boolean => {
    if (toks[p]?.t === 'lp') {
      p++;
      const r = or();
      if (toks[p++]?.t !== 'rp') throw new Error('invalid expression syntax');
      return r;
    }
    const a = val();
    const op = toks[p];
    if (op?.t === 'op' && ['==', '!=', '=~', '!~'].includes(op.v)) {
      p++;
      const b = val();
      if (op.v === '==' || op.v === '!=') {
        const eq = typeof a === 'object' && a ? false : typeof b === 'object' && b ? false : a === b;
        return op.v === '==' ? eq : !eq;
      }
      const re = typeof b === 'object' && b ? b.re : null;
      if (!re) throw new Error('invalid expression syntax');
      const m = typeof a === 'string' && re.test(a);
      return op.v === '=~' ? m : !m;
    }
    return truthy(a);
  };
  const and = (): boolean => {
    let r = cmp();
    while (toks[p]?.t === 'op' && toks[p].v === '&&') {
      p++;
      const b = cmp();
      r = r && b;
    }
    return r;
  };
  const or = (): boolean => {
    let r = and();
    while (toks[p]?.t === 'op' && toks[p].v === '||') {
      p++;
      const b = and();
      r = r || b;
    }
    return r;
  };
  const r = or();
  if (p !== toks.length) throw new Error('invalid expression syntax');
  return r;
}

/** Glob for rules:changes and artifact paths: *, ** and ?. */
export function globMatch(pattern: string, path: string): boolean {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      re += '.*';
      i++;
      if (pattern[i + 1] === '/') i++;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`).test(path) || (pattern.endsWith('/') && path.startsWith(pattern)) || path.startsWith(pattern.replace(/\/$/, '') + '/');
}

export interface Decision {
  included: boolean;
  when: When;
  allowFailure: boolean;
  reason: string;
}

/** Does a job get into a pipeline for this event, and how (rules, or only/except)? */
export function decide(job: CiJob, env: Record<string, string>, changed: string[]): Decision {
  if (job.rules) {
    for (const [i, r] of job.rules.entries()) {
      let ok = true;
      if (r.if !== undefined) ok = evalIf(r.if, env);
      if (ok && r.changes !== undefined && env.CI_PIPELINE_SOURCE !== 'push' && env.CI_PIPELINE_SOURCE !== 'merge_request_event') ok = true;
      else if (ok && r.changes !== undefined) ok = r.changes.some((g) => changed.some((f) => globMatch(g, f)));
      if (ok) {
        // A rule without its own when inherits the job-level when (GitLab: rules:when > job when > on_success).
        const when = r.when ?? job.when ?? 'on_success';
        if (when === 'never') return { included: false, when, allowFailure: false, reason: `rules[${i}] matched with when: never` };
        return { included: true, when, allowFailure: r.allowFailure ?? (job.allowFailure && when !== 'manual' ? true : false), reason: `rules[${i}] matched${r.if ? `: ${r.if}` : ''}` };
      }
    }
    return { included: false, when: 'never', allowFailure: false, reason: 'no rule matched' };
  }
  const ref = env.CI_COMMIT_REF_NAME ?? '';
  const refMatches = (list: string[]) =>
    list.some((x) =>
      x === 'branches' ? !env.CI_COMMIT_TAG : x === 'tags' ? !!env.CI_COMMIT_TAG : x === 'merge_requests' ? env.CI_PIPELINE_SOURCE === 'merge_request_event' : x.startsWith('/') ? new RegExp(x.slice(1, x.lastIndexOf('/'))).test(ref) : x === ref,
    );
  if (job.only && !refMatches(job.only)) return { included: false, when: 'never', allowFailure: false, reason: `only: ${job.only.join(', ')}` };
  if (job.except && refMatches(job.except)) return { included: false, when: 'never', allowFailure: false, reason: `except: ${job.except.join(', ')}` };
  // Without rules a job runs on branch and tag pipelines, not on merge request pipelines.
  if (!job.only && env.CI_PIPELINE_SOURCE === 'merge_request_event') return { included: false, when: 'never', allowFailure: false, reason: 'jobs without rules do not run in merge request pipelines' };
  return { included: true, when: job.when, allowFailure: job.allowFailure, reason: 'no rules: the job always runs' };
}
