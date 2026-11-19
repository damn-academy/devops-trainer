// kubectl for kube-lite (05 §5.5). Output follows kubectl v1.37; a flag
// that exists in kubectl but is not modelled gets a trainer line rather
// than "unknown flag"; a resource the training cluster lacks gets the real
// "the server doesn't have a resource type" plus a trainer line.

import YAML from 'yaml';
import type { CmdContext, ShellCommand, SimMachineApi } from '../../../core/types';
import { bi } from '../../../core/i18n';
import { b64 } from '../admission';
import { ApiError, Cluster, K8S_VERSION } from '../cluster';
import { controllerOf, podReady, templateWithoutHash } from '../controllers';
import { imageRef, lookupImage } from '../images';
import { GET_ALL, apiVersionOf, type KindInfo } from '../kinds';
import { ManifestError, parseManifests } from '../manifests';
import { clusterOf, K8sState, KUBECONFIG_PATH, machineNow } from '../state';
import { age, clone, intOrPercent, isObj, iso, mergePatch, pad, parseDuration, strategicMerge, type Obj } from '../util';
import { bool, distance, list, parseArgs, str, type FlagDef, type Parsed } from './args';
import { describe, podTemplateText, rfc1123 } from './describe';
import { explainText, findField } from './explain';
import { HELP } from './help';
import { podExec, tokenize } from './podshell';
import { customColumns, forOutput, jsonpath, listOf, printTable, sortBy, tableFor, toYaml } from './printers';

export interface KubectlIO {
  out: string;
  err: string;
  code: number;
}

interface Ctx {
  m: SimMachineApi;
  c: Cluster;
  ns: string;
  out: (s: string) => void;
  err: (s: string) => void;
  stdin: string;
  readFile: (p: string) => string;
  isDir: (p: string) => boolean;
  listDir: (p: string) => string[];
  p: Parsed;
  sub: string;
  verbose: number;
  quiet?: boolean;
}

const TRAINER = '\x1b[2m(trainer)\x1b[0m';

class Fail extends Error {
  constructor(
    public text: string,
    public code = 1,
  ) {
    super(text);
  }
}

const fail = (text: string, code = 1): never => {
  throw new Fail(text.endsWith('\n') ? text : text + '\n', code);
};

// ── flag sets ──

const OUT: FlagDef = { long: 'output', short: 'o', value: true };
const SEL: FlagDef = { long: 'selector', short: 'l', value: true };
const ALLNS: FlagDef = { long: 'all-namespaces', short: 'A' };
const FILE: FlagDef = { long: 'filename', short: 'f', value: true, multi: true };
const DRY: FlagDef = { long: 'dry-run', value: 'optional' };
const REC: FlagDef = { long: 'recursive', short: 'R' };

const FLAGS: Record<string, FlagDef[]> = {
  get: [OUT, SEL, ALLNS, FILE, { long: 'field-selector', value: true }, { long: 'show-labels' }, { long: 'watch', short: 'w' }, { long: 'no-headers' }, { long: 'sort-by', value: true }, { long: 'label-columns', short: 'L', value: true, multi: true }, REC],
  describe: [SEL, ALLNS, FILE],
  apply: [FILE, OUT, DRY, REC],
  create: [FILE, OUT, DRY, { long: 'image', value: true, multi: true }, { long: 'replicas', short: 'r', value: true }, { long: 'port', value: true }, { long: 'tcp', value: true, multi: true }, { long: 'node-port', value: true }, { long: 'clusterip', value: true }, { long: 'from-literal', value: true, multi: true }, { long: 'from-file', value: true, multi: true }, { long: 'from-env-file', value: true, multi: true }, { long: 'type', value: true }, { long: 'restart', value: true }, REC],
  run: [OUT, DRY, { long: 'image', value: true }, { long: 'env', value: true, multi: true }, { long: 'port', value: true }, { long: 'labels', short: 'l', value: true }, { long: 'restart', value: true }, { long: 'command' }, { long: 'stdin', short: 'i' }, { long: 'tty', short: 't' }, { long: 'rm' }],
  expose: [OUT, DRY, { long: 'port', value: true }, { long: 'target-port', value: true }, { long: 'name', value: true }, { long: 'type', value: true }, { long: 'protocol', value: true }, SEL],
  scale: [FILE, { long: 'replicas', value: true }, { long: 'current-replicas', value: true }, SEL],
  delete: [FILE, SEL, ALLNS, { long: 'all' }, { long: 'force' }, { long: 'now' }, { long: 'grace-period', value: true }, { long: 'cascade', value: 'optional' }, { long: 'wait', value: 'optional' }, DRY],
  logs: [{ long: 'container', short: 'c', value: true }, { long: 'previous', short: 'p' }, { long: 'follow', short: 'f' }, { long: 'tail', value: true }, { long: 'since', value: true }, SEL, { long: 'all-containers' }, { long: 'prefix' }, { long: 'timestamps' }],
  exec: [{ long: 'container', short: 'c', value: true }, { long: 'stdin', short: 'i' }, { long: 'tty', short: 't' }],
  'port-forward': [{ long: 'address', value: true }],
  rollout: [{ long: 'revision', value: true }, { long: 'to-revision', value: true }, { long: 'timeout', value: true }, { long: 'watch', short: 'w', value: 'optional' }, DRY, SEL],
  set: [FILE, SEL, { long: 'all' }, DRY, OUT],
  label: [{ long: 'overwrite' }, SEL, { long: 'all' }, FILE, DRY],
  annotate: [{ long: 'overwrite' }, SEL, { long: 'all' }, FILE, DRY],
  patch: [{ long: 'patch', short: 'p', value: true }, { long: 'type', value: true }, FILE, DRY, OUT],
  explain: [{ long: 'recursive' }, { long: 'api-version', value: true }, OUT],
  config: [OUT, { long: 'minify' }, { long: 'raw' }, { long: 'current' }, { long: 'namespace', value: true }, { long: 'cluster', value: true }, { long: 'user', value: true }, { long: 'no-headers' }],
  wait: [{ long: 'for', value: true }, { long: 'timeout', value: true }, SEL, { long: 'all' }, FILE],
  cordon: [SEL, DRY],
  uncordon: [SEL, DRY],
  drain: [{ long: 'ignore-daemonsets' }, { long: 'delete-emptydir-data' }, { long: 'force' }, { long: 'grace-period', value: true }, { long: 'timeout', value: true }, SEL, DRY],
  taint: [{ long: 'overwrite' }, SEL, { long: 'all' }],
  events: [{ long: 'for', value: true }, { long: 'types', value: true }, ALLNS, OUT, { long: 'watch', short: 'w' }],
  'cluster-info': [],
  version: [OUT, { long: 'client' }],
  'api-resources': [OUT, { long: 'namespaced', value: true }, { long: 'no-headers' }],
  'api-versions': [],
  top: [SEL, ALLNS],
  edit: [OUT],
};

const COMMANDS = Object.keys(FLAGS);

// ── kubeconfig ──

interface Kubeconfig {
  current: string;
  contexts: { name: string; cluster: string; user: string; namespace?: string }[];
  raw: Obj;
  path: string;
}

function readKubeconfig(m: SimMachineApi, explicit?: string): Kubeconfig | null {
  const home = m.user().home;
  const path = explicit ?? m.vars.KUBECONFIG ?? KUBECONFIG_PATH(home);
  try {
    const text = m.rootFs.readFile(path.replace(/^~/, home));
    const raw = YAML.parse(text) as Obj;
    if (!isObj(raw)) return null;
    return {
      current: raw['current-context'] ?? '',
      contexts: (raw.contexts ?? []).map((x: Obj) => ({ name: x.name, cluster: x.context?.cluster, user: x.context?.user, namespace: x.context?.namespace })),
      raw,
      path: path.replace(/^~/, home),
    };
  } catch {
    return null;
  }
}

function writeKubeconfig(m: SimMachineApi, kc: Kubeconfig): void {
  m.rootFs.writeFile(kc.path, YAML.stringify(kc.raw));
}

// ── resolving what the learner typed ──

function resolveKind(x: Ctx, word: string): KindInfo {
  const info = x.c.kinds.resolve(word);
  if (!info) {
    const known = ['statefulsets', 'sts', 'cronjobs', 'cj', 'persistentvolumeclaims', 'pvc', 'persistentvolumes', 'pv', 'storageclasses', 'sc', 'roles', 'rolebindings', 'clusterroles', 'clusterrolebindings', 'horizontalpodautoscalers', 'hpa', 'gateways', 'httproutes', 'poddisruptionbudgets', 'pdb', 'limitranges', 'resourcequotas', 'ingressclasses', 'gatewayclasses', 'certificatesigningrequests', 'csr', 'controllerrevisions'];
    const plain = word.toLowerCase().split('.')[0];
    const extra = known.includes(plain) || known.includes(plain + 's') ? `\n${TRAINER} this resource is not in the training cluster yet; it exists on the real stage.` : '';
    fail(`error: the server doesn't have a resource type "${word}"${extra}`);
  }
  return info!;
}

/** pods web | pod/web svc/api | deploy,rs | all */
function targets(x: Ctx, args: string[]): { info: KindInfo; names: string[] }[] {
  if (!args.length) return [];
  if (args.some((a) => a.includes('/'))) {
    return args.map((a) => {
      const [k, n] = a.split('/');
      if (!n) fail(`error: arguments in resource/name form must have a single resource and name`);
      return { info: resolveKind(x, k), names: [n] };
    });
  }
  const [kinds, ...names] = args;
  const out: { info: KindInfo; names: string[] }[] = [];
  for (const k of kinds.split(',')) {
    if (k === 'all') for (const kk of GET_ALL) out.push({ info: x.c.kinds.byKind(kk)!, names });
    else out.push({ info: resolveKind(x, k), names });
  }
  return out;
}

function kindRef(x: Ctx, info: KindInfo): string {
  return x.c.kinds.ref(info);
}

// ── label and field selectors ──

export function matchLabels(sel: string, labels: Obj | undefined): boolean {
  const l = labels ?? {};
  const parts = sel.match(/[^,]+\([^)]*\)|[^,]+/g) ?? [];
  return parts.every((raw) => {
    const p = raw.trim();
    let m: RegExpMatchArray | null;
    if ((m = /^([\w./-]+)\s+in\s+\(([^)]*)\)$/.exec(p))) return m[2].split(',').map((s) => s.trim()).includes(l[m[1]]);
    if ((m = /^([\w./-]+)\s+notin\s+\(([^)]*)\)$/.exec(p))) return !m[2].split(',').map((s) => s.trim()).includes(l[m[1]]);
    if ((m = /^([\w./-]+)\s*!=\s*(.*)$/.exec(p))) return l[m[1]] !== m[2];
    if ((m = /^([\w./-]+)\s*==?\s*(.*)$/.exec(p))) return l[m[1]] === m[2];
    if ((m = /^!([\w./-]+)$/.exec(p))) return !(m[1] in l);
    return p in l;
  });
}

function fieldValue(o: Obj, f: string): string | undefined {
  switch (f) {
    case 'metadata.name':
      return o.metadata.name;
    case 'metadata.namespace':
      return o.metadata.namespace;
    case 'status.phase':
      return o.status?.phase;
    case 'spec.nodeName':
      return o.spec?.nodeName ?? '';
    case 'reason':
      return o.reason;
    case 'type':
      return o.type;
    case 'involvedObject.name':
      return o.involvedObject?.name;
    case 'involvedObject.kind':
      return o.involvedObject?.kind;
    default:
      return undefined;
  }
}

function matchFields(x: Ctx, sel: string, o: Obj): boolean {
  return sel.split(',').every((p) => {
    const m = /^([\w.]+)\s*(!=|==|=)\s*(.*)$/.exec(p.trim());
    if (!m) fail(`error: invalid field selector "${p}"`);
    const v = fieldValue(o, m![1]);
    if (v === undefined) fail(`Error from server (BadRequest): Unable to find "${x.c.pluralOf(o.kind)}" that match label selector "", field selector "${sel}": "${m![1]}" is not a known field selector: only "metadata.name", "metadata.namespace"`);
    return m![2] === '!=' ? v !== m![3] : v === m![3];
  });
}

// ── objects of a kind, with Endpoints derived from EndpointSlices ──

function endpointsFor(c: Cluster, ns?: string): Obj[] {
  return c
    .list('Service', ns)
    .filter((s) => s.spec.selector || s.metadata.name === 'kubernetes')
    .map((s) => {
      const slices = c.list('EndpointSlice', s.metadata.namespace).filter((x) => x.metadata.labels?.['kubernetes.io/service-name'] === s.metadata.name);
      const ready = slices.flatMap((sl) => (sl.endpoints ?? []).filter((e: Obj) => e.conditions?.ready !== false).map((e: Obj) => ({ ip: e.addresses[0], nodeName: e.nodeName, targetRef: e.targetRef })));
      const ports = slices[0]?.ports ?? [];
      return {
        apiVersion: 'v1',
        kind: 'Endpoints',
        metadata: { name: s.metadata.name, namespace: s.metadata.namespace, creationTimestamp: s.metadata.creationTimestamp, labels: s.metadata.labels, uid: s.metadata.uid + '-ep' },
        subsets: ready.length ? [{ addresses: ready, ports }] : undefined,
      };
    });
}

function objectsOf(x: Ctx, info: KindInfo, allNs: boolean): Obj[] {
  const ns = info.namespaced && !allNs ? x.ns : undefined;
  if (info.kind === 'Endpoints') return endpointsFor(x.c, ns);
  let objs = x.c.list(info.kind, ns);
  if (info.kind === 'Event') objs = objs.sort((a, b) => Date.parse(a.lastTimestamp) - Date.parse(b.lastTimestamp) || Number(a.metadata.resourceVersion) - Number(b.metadata.resourceVersion));
  return objs;
}

function notFound(x: Ctx, info: KindInfo, name: string): string {
  return `Error from server (NotFound): ${x.c.pluralOf(info.kind)} "${name}" not found\n`;
}

function getOne(x: Ctx, info: KindInfo, name: string, ns = x.ns): Obj {
  if (info.kind === 'Endpoints') {
    const e = endpointsFor(x.c, info.namespaced ? ns : undefined).find((o) => o.metadata.name === name);
    if (!e) fail(notFound(x, info, name));
    return e!;
  }
  const o = x.c.get(info.kind, info.namespaced ? ns : undefined, name);
  if (!o) fail(notFound(x, info, name));
  return o!;
}

// ── output ──

function outputFormat(x: Ctx): string {
  return str(x.p, 'output') ?? '';
}

function printObjects(x: Ctx, items: Obj[], single: boolean): boolean {
  const o = outputFormat(x);
  if (!o || o === 'wide') return false;
  if (o === 'yaml') x.out(toYaml(single ? forOutput(items[0]) : listOf(items)));
  else if (o === 'json') x.out(JSON.stringify(single ? forOutput(items[0]) : listOf(items), null, 4) + '\n');
  else if (o === 'name') x.out(items.map((i) => `${kindRef(x, x.c.kinds.byKind(i.kind) ?? x.c.kinds.byKind('Pod')!)}/${i.metadata.name}`).join('\n') + (items.length ? '\n' : ''));
  else if (o.startsWith('jsonpath=') || o.startsWith('jsonpath-as-json=')) {
    const tpl = o.slice(o.indexOf('=') + 1).replace(/^'|'$/g, '');
    x.out(jsonpath(single ? forOutput(items[0]) : listOf(items), tpl));
  } else if (o.startsWith('custom-columns=')) x.out(customColumns(items, o.slice('custom-columns='.length), bool(x.p, 'no-headers')));
  else fail(`error: unable to match a printer suitable for the output format "${o}", allowed formats are: custom-columns,custom-columns-file,go-template,go-template-file,json,jsonpath,jsonpath-as-json,jsonpath-file,name,template,templatefile,wide,yaml`);
  return true;
}

// ── reading -f ──

function readSources(x: Ctx): { file: string; objs: Obj[] }[] {
  const files = list(x.p, 'filename');
  if (!files.length) fail(`error: must specify one of -f and -k\n\nerror: no objects passed to ${x.sub}`);
  const out: { file: string; objs: Obj[] }[] = [];
  for (const f of files) {
    if (f === '-') {
      out.push({ file: 'STDIN', objs: parseManifests(x.stdin, 'STDIN') });
      continue;
    }
    if (/^https?:\/\//.test(f)) fail(`${TRAINER} the training cluster has no internet access; save the manifest to a file and use -f <file>.`);
    let paths: string[];
    if (x.isDir(f)) paths = x.listDir(f).filter((n) => /\.(ya?ml|json)$/.test(n)).sort().map((n) => `${f.replace(/\/$/, '')}/${n}`);
    else paths = [f];
    for (const path of paths) {
      let text: string;
      try {
        text = x.readFile(path);
      } catch {
        fail(`error: the path "${path}" does not exist`);
      }
      out.push({ file: path, objs: parseManifests(text!, path) });
    }
  }
  return out;
}

function dryRun(x: Ctx): 'client' | 'server' | undefined {
  const d = str(x.p, 'dry-run');
  if (!d || d === 'none') return undefined;
  if (d !== 'client' && d !== 'server') fail(`error: Invalid dry-run value (${d}). Must be "none", "server", or "client".`);
  return d as 'client' | 'server';
}

function suffix(x: Ctx): string {
  const d = dryRun(x);
  return d ? ` (${d === 'client' ? 'dry run' : 'server dry run'})` : '';
}

function verboseReq(x: Ctx, verb: string, path: string, status: string): void {
  if (x.verbose < 6) return;
  const t = new Date(x.c.now);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  x.err(`I${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}.${p(t.getUTCMilliseconds(), 3)}123   41871 round_trippers.go:632] "Response" verb="${verb}" url="https://127.0.0.1:6443${path}" status="${status}" milliseconds=4\n`);
}

function apiPath(info: KindInfo, ns: string | undefined, name?: string): string {
  const base = info.group ? `/apis/${info.group}/${info.version}` : `/api/${info.version}`;
  return `${base}${info.namespaced && ns ? `/namespaces/${ns}` : ''}/${info.plural}${name ? `/${name}` : ''}`;
}

// ── commands ──

function cmdGet(x: Ctx): void {
  const allNs = bool(x.p, 'all-namespaces');
  let groups: { info: KindInfo; names: string[] }[];
  if (list(x.p, 'filename').length) {
    groups = readSources(x).flatMap((s) => s.objs.map((o) => ({ info: x.c.resolveManifest(o), names: [o.metadata?.name] })));
  } else {
    if (!x.p.args.length) fail(`You must specify the type of resource to get. Use "kubectl api-resources" for a complete list of supported resources.\n\nerror: Required resource not specified.\nUse "kubectl explain <resource>" for a detailed description of that resource (e.g. kubectl explain pods).\nSee 'kubectl get -h' for help and examples`);
    groups = targets(x, x.p.args);
  }
  const multi = groups.length > 1 || x.p.args[0] === 'all' || x.p.args.some((a) => a.includes('/'));
  const sel = str(x.p, 'selector');
  const fsel = str(x.p, 'field-selector');
  const out = outputFormat(x);
  const collected: { info: KindInfo; objs: Obj[] }[] = [];
  let errors = '';
  for (const g of groups) {
    if (g.info.kind === 'Endpoints') x.err('Warning: v1 Endpoints is deprecated in v1.33+; use discovery.k8s.io/v1 EndpointSlice\n');
    let objs: Obj[];
    if (g.names.length) {
      objs = [];
      for (const n of g.names) {
        try {
          objs.push(getOne(x, g.info, n));
        } catch (e) {
          if (e instanceof Fail) errors += e.text;
          else throw e;
        }
      }
    } else objs = objectsOf(x, g.info, allNs);
    if (sel) objs = objs.filter((o) => matchLabels(sel, o.metadata.labels));
    if (fsel) objs = objs.filter((o) => matchFields(x, fsel, o));
    const sortKey = str(x.p, 'sort-by');
    if (sortKey) objs = sortBy(objs, sortKey);
    verboseReq(x, 'GET', apiPath(g.info, allNs ? undefined : x.ns, g.names[0]), errors ? '404 Not Found' : '200 OK');
    collected.push({ info: g.info, objs });
  }
  const items = collected.flatMap((g) => g.objs);
  if (out && out !== 'wide') {
    if (items.length || !errors) printObjects(x, items, !multi && groups.length === 1 && groups[0].names.length === 1 && items.length === 1);
  } else {
    const blocks: string[] = [];
    for (const g of collected) {
      if (!g.objs.length) continue;
      blocks.push(
        printTable(x.c, g.info.kind, g.objs, {
          wide: out === 'wide',
          allNamespaces: allNs && g.info.namespaced,
          showLabels: bool(x.p, 'show-labels'),
          noHeaders: bool(x.p, 'no-headers'),
          withKind: multi ? kindRef(x, g.info) : undefined,
          labelColumns: list(x.p, 'label-columns').flatMap((l) => l.split(',')),
        }),
      );
    }
    if (blocks.length) x.out(blocks.join('\n'));
    else if (!errors) x.err(allNs || !groups.every((g) => g.info.namespaced) ? 'No resources found\n' : `No resources found in ${x.ns} namespace.\n`);
  }
  if (errors) {
    x.err(errors);
    throw new Fail('', 1);
  }
  if (bool(x.p, 'watch') && collected.length === 1) watch(x, collected[0].info, allNs, sel);
}

/** -w: let virtual time run and print every row that changes (a minute at most). */
function watch(x: Ctx, info: KindInfo, allNs: boolean, sel?: string): void {
  const t = tableFor(x.c, info.kind);
  const row = (o: Obj) => (allNs ? [o.metadata.namespace ?? ''] : []).concat(t.rows(o).map((cell, i) => (i === t.head.indexOf('AGE') ? '' : cell))).join('\u0000');
  const seen = new Map<string, string>();
  for (const o of objectsOf(x, info, allNs)) seen.set(o.metadata.uid, row(o));
  let quiet = 0;
  let changes = 0;
  const lines: string[][] = [];
  for (let s = 0; s < 90 && quiet < 15; s++) {
    x.c.advance(1000);
    let changed = false;
    const now = objectsOf(x, info, allNs).filter((o) => !sel || matchLabels(sel, o.metadata.labels));
    for (const o of now) {
      const r = row(o);
      if (seen.get(o.metadata.uid) !== r) {
        seen.set(o.metadata.uid, r);
        lines.push([...(allNs ? [o.metadata.namespace ?? ''] : []), ...t.rows(o)]);
        changed = true;
      }
    }
    for (const uid of [...seen.keys()]) {
      if (!now.some((o) => o.metadata.uid === uid)) seen.delete(uid);
    }
    if (changed) {
      changes++;
      quiet = 0;
    } else quiet++;
  }
  if (lines.length) x.out(pad(lines).split('\n').filter(Boolean).join('\n') + '\n');
  x.out(`${TRAINER} watch ended after ${changes ? 'the changes settled' : '15 quiet seconds'} (virtual time moved on; on a real cluster -w runs until Ctrl+C).\n`);
}

function cmdDescribe(x: Ctx): void {
  if (!x.p.args.length && !list(x.p, 'filename').length) fail(`You must specify the type of resource to describe. Use "kubectl api-resources" for a complete list of supported resources.\nerror: Required resource not specified.`);
  const allNs = bool(x.p, 'all-namespaces');
  const sel = str(x.p, 'selector');
  const groups = list(x.p, 'filename').length ? readSources(x).flatMap((s) => s.objs.map((o) => ({ info: x.c.resolveManifest(o), names: [o.metadata?.name] }))) : targets(x, x.p.args);
  const outs: string[] = [];
  let missing = '';
  for (const g of groups) {
    let objs: Obj[];
    if (g.names.length) {
      objs = [];
      for (const n of g.names) {
        const exact = g.info.kind === 'Endpoints' ? endpointsFor(x.c, x.ns).find((o) => o.metadata.name === n) : x.c.get(g.info.kind, g.info.namespaced ? x.ns : undefined, n);
        if (exact) objs.push(exact);
        else {
          const pref = objectsOf(x, g.info, false).filter((o) => o.metadata.name.startsWith(n));
          if (pref.length) objs.push(...pref);
          else missing += notFound(x, g.info, n);
        }
      }
    } else objs = objectsOf(x, g.info, allNs);
    if (sel) objs = objs.filter((o) => matchLabels(sel, o.metadata.labels));
    for (const o of objs) outs.push(describe(x.c, o));
  }
  if (outs.length) x.out(outs.join('\n\n'));
  if (missing) {
    x.err(missing);
    throw new Fail('', 1);
  }
  if (!outs.length) x.err(`No resources found in ${x.ns} namespace.\n`);
}

function created(x: Ctx, o: Obj, verb: string): void {
  const info = x.c.kinds.byKind(o.kind)!;
  if (outputFormat(x)) {
    printObjects(x, [o], true);
    return;
  }
  x.out(`${kindRef(x, info)}/${o.metadata.name} ${verb}${suffix(x)}\n`);
}

function cmdApply(x: Ctx, mode: 'apply' | 'create'): void {
  const srcs = readSources(x);
  const dr = dryRun(x);
  let errs = '';
  for (const s of srcs) {
    for (const obj of s.objs) {
      try {
        if (dr === 'client') {
          const info = x.c.resolveManifest(obj);
          const exists = !!x.c.get(info.kind, info.namespaced ? (obj.metadata?.namespace ?? x.ns) : undefined, obj.metadata?.name ?? '');
          if (outputFormat(x)) printObjects(x, [obj], true);
          else x.out(`${kindRef(x, info)}/${obj.metadata?.name} ${mode === 'apply' ? (exists ? 'configured' : 'created') : 'created'} (dry run)\n`);
          continue;
        }
        if (mode === 'apply') {
          const r = x.c.apply(obj, { namespace: x.ns, dryRun: dr === 'server' });
          const info = x.c.kinds.byKind(r.obj.kind)!;
          verboseReq(x, r.result === 'created' ? 'POST' : 'PATCH', apiPath(info, r.obj.metadata.namespace, r.result === 'created' ? undefined : r.obj.metadata.name), r.result === 'created' ? '201 Created' : '200 OK');
          if (outputFormat(x)) printObjects(x, [r.obj], true);
          else x.out(`${kindRef(x, info)}/${r.obj.metadata.name} ${r.result}${suffix(x)}\n`);
        } else {
          const o = x.c.create(obj, { namespace: x.ns, dryRun: dr === 'server' });
          verboseReq(x, 'POST', apiPath(x.c.kinds.byKind(o.kind)!, o.metadata.namespace), '201 Created');
          created(x, o, 'created');
        }
      } catch (e) {
        if (e instanceof ApiError) {
          const where = e.reason === 'AlreadyExists' && mode === 'create' ? `Error from server (AlreadyExists): error when creating "${s.file}": ${e.message}` : e.raw ? e.message : `Error from server (${e.reason}): error when ${mode === 'apply' ? 'creating' : 'creating'} "${s.file}": ${e.message}`;
          errs += where.replace('from "STDIN"', `from "${s.file}"`) + '\n';
        } else throw e;
      }
    }
  }
  if (errs) fail(errs);
}

function containerName(image: string): string {
  const r = imageRef(image).split('@')[0];
  const last = r.split('/').pop() ?? r;
  return last.replace(/:.*$/, '').replace(/[^a-z0-9-]/g, '-');
}

function clientObj(x: Ctx, o: Obj): void {
  // --dry-run=client -o yaml prints what the client would send.
  if (dryRun(x) === 'client') {
    if (outputFormat(x)) printObjects(x, [o], true);
    else x.out(`${kindRef(x, x.c.kinds.byKind(o.kind)!)}/${o.metadata.name} created (dry run)\n`);
    return;
  }
  try {
    const made = x.c.create(o, { namespace: x.ns, dryRun: dryRun(x) === 'server' });
    created(x, made, 'created');
  } catch (e) {
    if (e instanceof ApiError) fail(e.print());
    throw e;
  }
}

function fromSources(x: Ctx, kind: 'cm' | 'secret'): Obj {
  const data: Obj = {};
  for (const lit of list(x.p, 'from-literal')) {
    const i = lit.indexOf('=');
    if (i < 1) fail(`error: invalid literal source ${lit}, expected key=value`);
    data[lit.slice(0, i)] = lit.slice(i + 1);
  }
  for (const f of list(x.p, 'from-file')) {
    const i = f.indexOf('=');
    const key = i > 0 ? f.slice(0, i) : undefined;
    const path = i > 0 ? f.slice(i + 1) : f;
    if (x.isDir(path)) {
      for (const n of x.listDir(path)) data[n] = x.readFile(`${path.replace(/\/$/, '')}/${n}`);
      continue;
    }
    let text: string;
    try {
      text = x.readFile(path);
    } catch {
      fail(`error: error reading ${path}: no such file or directory`);
    }
    data[key ?? path.split('/').pop()!] = text!;
  }
  for (const f of list(x.p, 'from-env-file')) {
    let text: string;
    try {
      text = x.readFile(f);
    } catch {
      fail(`error: error reading ${f}: no such file or directory`);
    }
    for (const line of text!.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0) data[t.slice(0, i)] = t.slice(i + 1);
    }
  }
  if (kind === 'secret') for (const k of Object.keys(data)) data[k] = b64(String(data[k]));
  return data;
}

function cmdCreate(x: Ctx): void {
  const [what, ...rest] = x.p.args;
  if (!what) return cmdApply(x, 'create');
  const name = rest[0];
  const need = (n: string | undefined, usage: string) => {
    if (!n) fail(`error: exactly one NAME is required, got 0\nSee '${usage}' for help and examples`);
  };
  switch (what) {
    case 'deployment':
    case 'deploy': {
      need(name, 'kubectl create deployment -h');
      const images = list(x.p, 'image');
      if (!images.length) fail('error: required flag(s) "image" not set');
      const port = str(x.p, 'port');
      const containers = images.map((img) => ({ image: img, name: containerName(img), resources: {}, ...(port ? { ports: [{ containerPort: Number(port) }] } : {}), ...(x.p.rest?.length ? { command: x.p.rest } : {}) }));
      const labels = { app: name };
      return clientObj(x, {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { creationTimestamp: null, labels, name },
        spec: { replicas: Number(str(x.p, 'replicas') ?? 1), selector: { matchLabels: labels }, strategy: {}, template: { metadata: { creationTimestamp: null, labels }, spec: { containers } } },
        status: {},
      });
    }
    case 'service':
    case 'svc': {
      const [type, sname] = rest;
      if (!type) {
        x.out(HELP['create service']);
        return;
      }
      if (!['clusterip', 'nodeport', 'loadbalancer'].includes(type)) fail(`error: unknown command "${type}" for "kubectl create service"`);
      need(sname, `kubectl create service ${type} -h`);
      const tcp = list(x.p, 'tcp');
      const headless = str(x.p, 'clusterip') === 'None';
      if (!tcp.length && !headless) fail('error: at least one tcp port specifier must be provided');
      const ports = tcp.map((t) => {
        const [p, tp] = t.split(':');
        return { name: `${p}-${tp ?? p}`, port: Number(p), protocol: 'TCP', targetPort: /^\d+$/.test(tp ?? p) ? Number(tp ?? p) : tp, ...(type !== 'clusterip' && str(x.p, 'node-port') ? { nodePort: Number(str(x.p, 'node-port')) } : {}) };
      });
      return clientObj(x, {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: { creationTimestamp: null, labels: { app: sname }, name: sname },
        spec: { ...(headless ? { clusterIP: 'None' } : {}), ports, selector: { app: sname }, type: type === 'clusterip' ? 'ClusterIP' : type === 'nodeport' ? 'NodePort' : 'LoadBalancer' },
        status: { loadBalancer: {} },
      });
    }
    case 'configmap':
    case 'cm':
      need(name, 'kubectl create configmap -h');
      return clientObj(x, { apiVersion: 'v1', data: fromSources(x, 'cm'), kind: 'ConfigMap', metadata: { creationTimestamp: null, name } });
    case 'secret': {
      const [type, sname] = rest;
      if (type !== 'generic') {
        if (!type) {
          x.out('Create a secret with specified type.\n\nAvailable Commands:\n  docker-registry   Create a secret for use with a Docker registry\n  generic           Create a secret from a local file, directory, or literal value\n  tls               Create a TLS secret\n');
          return;
        }
        fail(`${TRAINER} \`kubectl create secret ${type}\` is not modelled in the training cluster; use \`generic\` here — ${type} works on the real stage.`);
      }
      need(sname, 'kubectl create secret generic -h');
      return clientObj(x, { apiVersion: 'v1', data: fromSources(x, 'secret'), kind: 'Secret', metadata: { creationTimestamp: null, name: sname }, ...(str(x.p, 'type') ? { type: str(x.p, 'type') } : {}) });
    }
    case 'namespace':
    case 'ns':
      need(name, 'kubectl create namespace -h');
      return clientObj(x, { apiVersion: 'v1', kind: 'Namespace', metadata: { creationTimestamp: null, name }, spec: {}, status: {} });
    case 'job': {
      need(name, 'kubectl create job -h');
      const img = str(x.p, 'image');
      if (!img) fail('error: either --image or --from must be specified');
      return clientObj(x, { apiVersion: 'batch/v1', kind: 'Job', metadata: { creationTimestamp: null, name }, spec: { template: { metadata: { creationTimestamp: null }, spec: { containers: [{ image: img, name, resources: {}, ...(x.p.rest?.length ? { command: x.p.rest } : {}) }], restartPolicy: 'Never' } } }, status: {} });
    }
    default:
      fail(`error: unknown command "${what}" for "kubectl create"\n\nDid you mean this?\n${['deployment', 'service', 'configmap', 'secret', 'namespace', 'job'].filter((c) => distance(c, what) <= 3).map((c) => `\t${c}`).join('\n') || '\tdeployment'}`);
  }
}

function cmdRun(x: Ctx): void {
  const name = x.p.args[0];
  if (!name) fail(`error: NAME is required for run\nSee 'kubectl run -h' for help and examples`);
  const image = str(x.p, 'image');
  if (!image) fail('error: required flag(s) "image" not set');
  const labels: Obj = {};
  const lab = str(x.p, 'labels');
  if (lab) for (const kv of lab.split(',')) labels[kv.split('=')[0]] = kv.split('=')[1] ?? '';
  else labels.run = name;
  const env = list(x.p, 'env').map((e) => ({ name: e.slice(0, e.indexOf('=')), value: e.slice(e.indexOf('=') + 1) }));
  const port = str(x.p, 'port');
  const restart = str(x.p, 'restart') ?? 'Always';
  if (!['Always', 'OnFailure', 'Never'].includes(restart)) fail(`error: invalid restart policy: ${restart}`);
  const ct: Obj = { image: image!, name };
  if (x.p.rest?.length) ct[bool(x.p, 'command') ? 'command' : 'args'] = x.p.rest;
  if (env.length) ct.env = env;
  if (port) ct.ports = [{ containerPort: Number(port) }];
  ct.resources = {};
  const pod = { apiVersion: 'v1', kind: 'Pod', metadata: { creationTimestamp: null, labels, name }, spec: { containers: [ct], dnsPolicy: 'ClusterFirst', restartPolicy: restart }, status: {} };
  if (dryRun(x) === 'client') {
    if (outputFormat(x)) printObjects(x, [pod], true);
    else x.out(`pod/${name} created (dry run)\n`);
    return;
  }
  try {
    const made = x.c.create(pod, { namespace: x.ns });
    if (outputFormat(x)) printObjects(x, [made], true);
    else x.out(`pod/${name} created\n`);
  } catch (e) {
    if (e instanceof ApiError) fail(e.print());
    throw e;
  }
  if (bool(x.p, 'stdin') || bool(x.p, 'tty')) {
    x.out(`${TRAINER} -it attaches your terminal to the container. Here, run commands in it one at a time: kubectl exec ${name} -- <command>${bool(x.p, 'rm') ? ` (and delete it with: kubectl delete pod ${name})` : ''}.\n`);
  }
}

function cmdExpose(x: Ctx): void {
  const t = targets(x, x.p.args);
  if (!t.length || !t[0].names.length) fail(`error: You must provide one or more resources by argument or filename.\nExample resource specifications include:\n   '-f rsrc.yaml'\n   '--filename=rsrc.json'\n   '<resource> <name>'\n   '<resource>'`);
  const { info, names } = t[0];
  const o = getOne(x, info, names[0]);
  let selector: Obj | undefined;
  let ports: Obj[] = [];
  if (info.kind === 'Pod') {
    selector = o.metadata.labels;
    ports = (o.spec.containers ?? []).flatMap((c: Obj) => c.ports ?? []);
  } else if (['Deployment', 'ReplicaSet', 'DaemonSet'].includes(info.kind)) {
    if (o.spec.selector?.matchExpressions?.length) fail(`error: cannot expose a ${info.kind} with a selector that contains matchExpressions`);
    selector = o.spec.selector?.matchLabels;
    ports = (o.spec.template.spec.containers ?? []).flatMap((c: Obj) => c.ports ?? []);
  } else if (info.kind === 'Service') {
    selector = o.spec.selector;
    ports = (o.spec.ports ?? []).map((p: Obj) => ({ containerPort: p.port }));
  } else fail(`error: cannot expose a ${info.kind}`);
  const port = str(x.p, 'port');
  if (!port && !ports.length) fail(`error: couldn't find port via --port flag or introspection\nSee 'kubectl expose -h' for help and examples`);
  const tp = str(x.p, 'target-port');
  const name = str(x.p, 'name') ?? o.metadata.name;
  const specPorts = port
    ? [{ port: Number(port), protocol: str(x.p, 'protocol') ?? 'TCP', targetPort: tp ? (/^\d+$/.test(tp) ? Number(tp) : tp) : Number(port) }]
    : ports.map((p, i) => ({ ...(ports.length > 1 ? { name: `port-${i + 1}` } : {}), port: p.containerPort, protocol: p.protocol ?? 'TCP', targetPort: tp ? (/^\d+$/.test(tp) ? Number(tp) : tp) : p.containerPort }));
  const type = str(x.p, 'type');
  const svc = { apiVersion: 'v1', kind: 'Service', metadata: { creationTimestamp: null, labels: o.metadata.labels, name }, spec: { ports: specPorts, selector, ...(type ? { type } : {}) }, status: { loadBalancer: {} } };
  if (dryRun(x) === 'client') {
    if (outputFormat(x)) printObjects(x, [svc], true);
    else x.out(`service/${name} exposed (dry run)\n`);
    return;
  }
  try {
    x.c.create(svc, { namespace: x.ns });
  } catch (e) {
    if (e instanceof ApiError) fail(e.print());
    throw e;
  }
  x.out(`service/${name} exposed\n`);
}

function cmdScale(x: Ctx): void {
  const r = str(x.p, 'replicas');
  if (r === undefined) fail('error: required flag(s) "replicas" not set');
  const n = Number(r);
  if (!Number.isInteger(n) || n < 0) fail('error: The --replicas=COUNT flag is required, and COUNT must be greater than or equal to 0');
  const t = list(x.p, 'filename').length ? readSources(x).flatMap((s) => s.objs.map((o) => ({ info: x.c.resolveManifest(o), names: [o.metadata.name] }))) : targets(x, x.p.args);
  if (!t.length || !t[0].names.length) fail('error: resource(s) were provided, but no name was specified');
  for (const { info, names } of t) {
    if (!['Deployment', 'ReplicaSet'].includes(info.kind) && !info.custom) fail(`error: no scaler has been implemented for {"${info.group}" "${info.kind}"}`);
    for (const name of names) {
      const o = getOne(x, info, name);
      const cur = str(x.p, 'current-replicas');
      if (cur !== undefined && Number(cur) !== (o.spec.replicas ?? 1)) fail(`error: Expected replicas to be ${cur}, was ${o.spec.replicas ?? 1}`);
      x.c.patch(info.kind, x.ns, name, { spec: { replicas: n } });
      x.out(`${kindRef(x, info)}/${name} scaled\n`);
    }
  }
}

function waitGone(x: Ctx, kind: string, ns: string | undefined, name: string, max = 40): void {
  for (let i = 0; i < max && x.c.get(kind, ns, name); i++) x.c.advance(1000);
}

function cmdDelete(x: Ctx): void {
  const force = bool(x.p, 'force');
  const grace = bool(x.p, 'now') ? 1 : str(x.p, 'grace-period') !== undefined ? Number(str(x.p, 'grace-period')) : undefined;
  if (grace === 0 && !force) fail('error: --grace-period=0 must have --force specified');
  const cascadeRaw = str(x.p, 'cascade') ?? 'background';
  if (!['background', 'orphan', 'foreground', 'true', 'false'].includes(cascadeRaw)) fail(`error: invalid cascade value (${cascadeRaw}). Must be "background", "foreground", or "orphan".`);
  const wait = str(x.p, 'wait') !== 'false';
  const dr = dryRun(x);
  let items: { info: KindInfo; ns?: string; name: string }[] = [];
  if (list(x.p, 'filename').length) {
    for (const s of readSources(x)) for (const o of s.objs) {
      const info = x.c.resolveManifest(o);
      items.push({ info, ns: info.namespaced ? (o.metadata.namespace ?? x.ns) : undefined, name: o.metadata.name });
    }
  } else {
    if (!x.p.args.length) fail(`error: You must provide one or more resources by argument or filename.\nExample resource specifications include:\n   '-f rsrc.yaml'\n   '--filename=rsrc.json'\n   '<resource> <name>'\n   '<resource>'`);
    const sel = str(x.p, 'selector');
    const all = bool(x.p, 'all');
    for (const g of targets(x, x.p.args)) {
      if (g.names.length) items.push(...g.names.map((n) => ({ info: g.info, ns: g.info.namespaced ? x.ns : undefined, name: n })));
      else if (sel || all) {
        let objs = objectsOf(x, g.info, bool(x.p, 'all-namespaces'));
        if (sel) objs = objs.filter((o) => matchLabels(sel, o.metadata.labels));
        items.push(...objs.map((o) => ({ info: g.info, ns: o.metadata.namespace, name: o.metadata.name })));
      } else fail(`error: resource(s) were provided, but no name was specified`);
    }
    if (!items.length) {
      x.err(`No resources found\n`);
      return;
    }
  }
  if (force) x.err('Warning: Immediate deletion does not wait for confirmation that the running resource has been terminated. The resource may continue to run on the cluster indefinitely.\n');
  let errs = '';
  for (const it of items) {
    try {
      x.c.delete(it.info.kind, it.ns, it.name, { cascade: (cascadeRaw === 'false' ? 'orphan' : cascadeRaw === 'true' ? 'background' : cascadeRaw) as 'background' | 'orphan' | 'foreground', grace, force, dryRun: !!dr });
      verboseReq(x, 'DELETE', apiPath(it.info, it.ns, it.name), '200 OK');
      x.out(`${force ? '' : ''}${kindRef(x, it.info)} "${it.name}" ${force ? 'force deleted' : 'deleted'}${it.ns ? ` from ${it.ns} namespace` : ''}${suffix(x)}\n`);
      if (wait && !dr && !force && (it.info.kind === 'Pod' || it.info.kind === 'Namespace')) waitGone(x, it.info.kind, it.ns, it.name, it.info.kind === 'Pod' ? (grace ?? 30) + 5 : 60);
    } catch (e) {
      if (e instanceof ApiError) errs += e.print() + '\n';
      else throw e;
    }
  }
  if (errs) fail(errs);
}

function podFor(x: Ctx, ref: string): Obj {
  if (ref.includes('/')) {
    const [k, n] = ref.split('/');
    const info = resolveKind(x, k);
    if (info.kind === 'Pod') return getOne(x, info, n);
    const owner = getOne(x, info, n);
    let pods: Obj[] = [];
    if (info.kind === 'Service') pods = x.c.list('Pod', x.ns).filter((p) => Object.entries(owner.spec.selector ?? {}).every(([kk, v]) => p.metadata.labels?.[kk] === v));
    else {
      const sel = owner.spec.selector?.matchLabels ?? {};
      pods = x.c.list('Pod', x.ns).filter((p) => Object.entries(sel).every(([kk, v]) => p.metadata.labels?.[kk] === v));
    }
    pods = pods.filter((p) => !p.metadata.deletionTimestamp).sort((a, b) => Number(podReady(b)) - Number(podReady(a)) || a.metadata.creationTimestamp.localeCompare(b.metadata.creationTimestamp));
    if (!pods.length) fail(`error: timed out waiting for the condition`);
    return pods[0];
  }
  return getOne(x, x.c.kinds.byKind('Pod')!, ref);
}

function pickContainer(x: Ctx, pod: Obj, verb: 'logs' | 'exec'): Obj {
  const name = str(x.p, 'container');
  const cs: Obj[] = pod.spec.containers ?? [];
  if (name) {
    const ct = cs.find((c) => c.name === name);
    if (!ct) fail(verb === 'logs' ? `error: container ${name} is not valid for pod ${pod.metadata.name}` : `Error from server (BadRequest): container ${name} is not valid for pod ${pod.metadata.name}`);
    return ct!;
  }
  if (cs.length > 1 && verb === 'logs') fail(`error: a container name must be specified for pod ${pod.metadata.name}, choose one of: [${cs.map((c) => c.name).join(' ')}]`);
  if (cs.length > 1) x.err(`Defaulted container "${cs[0].name}" out of: ${cs.map((c) => c.name).join(', ')}\n`);
  return cs[0];
}

function cmdLogs(x: Ctx): void {
  const sel = str(x.p, 'selector');
  let pods: Obj[];
  if (sel) pods = x.c.list('Pod', x.ns).filter((p) => matchLabels(sel, p.metadata.labels));
  else {
    if (!x.p.args.length) fail(`error: expected 'logs [-f] [-p] (POD | TYPE/NAME) [-c CONTAINER]'.\nPOD or TYPE/NAME is a required argument for the logs command\nSee 'kubectl logs -h' for help and examples`);
    pods = [podFor(x, x.p.args[0])];
    if (x.p.args[1] && !str(x.p, 'container')) x.p.flags.container = x.p.args[1];
  }
  const prev = bool(x.p, 'previous');
  const tailN = str(x.p, 'tail') !== undefined ? Number(str(x.p, 'tail')) : sel ? 10 : -1;
  const ts = bool(x.p, 'timestamps');
  const prefix = bool(x.p, 'prefix') || (sel !== undefined && pods.length > 1 && bool(x.p, 'prefix'));
  for (const pod of pods) {
    const cts = bool(x.p, 'all-containers') ? pod.spec.containers : [pickContainer(x, pod, 'logs')];
    for (const ct of cts) {
      const rt = x.c.runtime[pod.metadata.uid];
      const cr = rt?.containers.find((c) => c.name === ct.name);
      const status = pod.status?.containerStatuses?.find((s: Obj) => s.name === ct.name);
      if (prev) {
        if (!cr?.lastTerm) fail(`Error from server (BadRequest): previous terminated container "${ct.name}" in pod "${pod.metadata.name}" not found`);
      } else if (!cr || (!cr.startedAt && cr.state === 'waiting')) {
        const reason = status?.state?.waiting?.reason ?? 'ContainerCreating';
        const why = reason === 'ImagePullBackOff' || reason === 'ErrImagePull' ? 'trying and failing to pull image' : reason === 'CreateContainerConfigError' ? 'CreateContainerConfigError' : reason;
        fail(`Error from server (BadRequest): container "${ct.name}" in pod "${pod.metadata.name}" is waiting to start: ${why}`);
      }
      let lines = prev ? cr!.prevLogs : cr!.logs;
      if (tailN >= 0) lines = lines.slice(-tailN);
      for (const l of lines) {
        const sp = l.indexOf(' ');
        const text = ts ? l : l.slice(sp + 1);
        x.out(`${prefix ? `[pod/${pod.metadata.name}/${ct.name}] ` : ''}${text}\n`);
      }
    }
  }
  if (bool(x.p, 'follow')) x.out(`${TRAINER} -f keeps streaming new lines on a real cluster until Ctrl+C; here it prints what there is.\n`);
}

function cmdExec(x: Ctx): void {
  if (!x.p.args.length) fail(`error: expected 'exec (POD | TYPE/NAME) [-c CONTAINER] [flags] -- COMMAND [args...]'.\nPOD or TYPE/NAME is a required argument for the exec command\nSee 'kubectl exec -h' for help and examples`);
  if (!x.p.dash) {
    if (x.p.args.length > 1) fail(`error: exec [POD] [COMMAND] is not supported anymore. Use exec [POD] -- [COMMAND] instead\nSee 'kubectl exec -h' for help and examples`);
    fail(`error: you must specify at least one command for the container`);
  }
  const pod = podFor(x, x.p.args[0]);
  const ct = pickContainer(x, pod, 'exec');
  const status = pod.status?.containerStatuses?.find((s: Obj) => s.name === ct.name);
  if (pod.status?.phase === 'Succeeded' || pod.status?.phase === 'Failed') fail(`error: cannot exec into a container in a completed pod; current phase is ${pod.status.phase}`);
  if (!status?.state?.running) fail(`error: Internal error occurred: unable to upgrade connection: container not found ("${ct.name}")`);
  const argv = x.p.rest ?? [];
  const interactive = (bool(x.p, 'stdin') || bool(x.p, 'tty')) && argv.length === 1 && ['sh', 'bash', 'ash', '/bin/sh', '/bin/bash'].includes(argv[0]);
  if (interactive) {
    const tools = lookupImage(ct.image)?.tools ?? [];
    if (!tools.includes(argv[0].replace(/^\/bin\//, ''))) {
      x.err(`error: Internal error occurred: Internal error occurred: error executing command in container: failed to exec in container: failed to start exec "${pod.metadata.uid.slice(0, 12)}": OCI runtime exec failed: exec failed: unable to start container process: exec: "${argv[0]}": executable file not found in $PATH: unknown\n`);
      throw new Fail('', 1);
    }
    const m = x.m;
    if (m.attach) {
      const c = x.c;
      m.attach({
        prompt: () => `${pod.metadata.name}:/# `,
        exec: async (line: string) => {
          const t = line.trim();
          if (t === 'exit' || t === 'logout') return { out: 'exit\n', exit: 0, done: true };
          if (!t) return { out: '', exit: 0 };
          c.syncReal(machineNow(m));
          const fresh = c.get('Pod', pod.metadata.namespace, pod.metadata.name);
          if (!fresh) return { out: 'command terminated with exit code 137\n', exit: 137, done: true };
          const r = podExec(c, fresh, ct, tokenize(t));
          return { out: r.out + r.err, exit: r.code };
        },
      });
      return;
    }
    x.out(`${TRAINER} an interactive shell needs a terminal that can be attached; run commands one at a time here: kubectl exec ${pod.metadata.name} -- <command>\n`);
    return;
  }
  const r = podExec(x.c, pod, ct, argv);
  x.out(r.out);
  if (r.err) x.err(r.err);
  if (r.code !== 0) {
    if (!r.err.startsWith('error: Internal error')) x.err(`command terminated with exit code ${r.code}\n`);
    throw new Fail('', r.code);
  }
}

function cmdPortForward(x: Ctx): void {
  const [ref, ...pairs] = x.p.args;
  if (!ref || !pairs.length) fail(`error: TYPE/NAME and list of ports are required for port-forward\nSee 'kubectl port-forward -h' for help and examples`);
  const pod = podFor(x, ref.includes('/') ? ref : `pod/${ref}`);
  if (!pod.status?.containerStatuses?.some((s: Obj) => s.state?.running)) fail(`error: unable to forward port because pod is not running. Current status=${pod.status?.phase ?? 'Pending'}`);
  for (const pair of pairs) {
    const [l, r] = pair.includes(':') ? pair.split(':') : [pair, pair];
    let remote = Number(r);
    if (ref.startsWith('svc/') || ref.startsWith('service/')) {
      const svc = getOne(x, x.c.kinds.byKind('Service')!, ref.split('/')[1]);
      const sp = (svc.spec.ports ?? []).find((p: Obj) => String(p.port) === r || p.name === r);
      if (!sp) fail(`error: Service ${svc.metadata.name} does not have a service port ${r}`);
      remote = typeof sp.targetPort === 'number' ? sp.targetPort : Number(sp.targetPort) || 80;
    }
    const local = Number(l || remote);
    x.c.forwards = x.c.forwards.filter((f) => f.local !== local);
    x.c.forwards.push({ local, ns: pod.metadata.namespace, target: pod.metadata.name, port: remote });
    x.out(`Forwarding from 127.0.0.1:${local} -> ${remote}\nForwarding from [::1]:${local} -> ${remote}\n`);
  }
  x.out(`${TRAINER} the forward keeps running in the background of this terminal. Open the page with: cluster open http://localhost:${x.c.forwards[x.c.forwards.length - 1].local}/\n`);
}

function revisions(x: Ctx, d: Obj): Obj[] {
  return x.c
    .list('ReplicaSet', d.metadata.namespace)
    .filter((r) => controllerOf(r)?.uid === d.metadata.uid)
    .sort((a, b) => Number(a.metadata.annotations?.['deployment.kubernetes.io/revision'] ?? 0) - Number(b.metadata.annotations?.['deployment.kubernetes.io/revision'] ?? 0));
}

function rolloutMessage(d: Obj): { done: boolean; msg: string; failed?: boolean } {
  const name = d.metadata.name;
  if ((d.status?.observedGeneration ?? 0) < (d.metadata.generation ?? 1)) return { done: false, msg: 'Waiting for deployment spec update to be observed...' };
  const prog = (d.status?.conditions ?? []).find((c: Obj) => c.type === 'Progressing');
  if (prog?.reason === 'ProgressDeadlineExceeded') return { done: true, failed: true, msg: `error: deployment "${name}" exceeded its progress deadline` };
  const want = d.spec.replicas ?? 1;
  const updated = d.status?.updatedReplicas ?? 0;
  const total = d.status?.replicas ?? 0;
  const avail = d.status?.availableReplicas ?? 0;
  if (updated < want) return { done: false, msg: `Waiting for deployment "${name}" rollout to finish: ${updated} out of ${want} new replicas have been updated...` };
  if (total > updated) return { done: false, msg: `Waiting for deployment "${name}" rollout to finish: ${total - updated} old replicas are pending termination...` };
  if (avail < updated) return { done: false, msg: `Waiting for deployment "${name}" rollout to finish: ${avail} of ${updated} updated replicas are available...` };
  return { done: true, msg: `deployment "${name}" successfully rolled out` };
}

function cmdRollout(x: Ctx): void {
  const [verb, ...rest] = x.p.args;
  if (!verb) {
    x.out(HELP.rollout);
    return;
  }
  const t = targets(x, rest);
  if (!t.length || !t[0].names.length) fail(`error: required resource not specified`);
  const { info, names } = t[0];
  if (!['Deployment', 'DaemonSet'].includes(info.kind)) fail(`error: no ${verb === 'status' ? 'status viewer' : 'history viewer'} has been implemented for "${info.kind}"`);
  const name = names[0];
  const d = getOne(x, info, name);
  const ref = `${kindRef(x, info)}/${name}`;
  switch (verb) {
    case 'status': {
      if (info.kind !== 'Deployment') {
        x.out(`daemon set "${name}" successfully rolled out\n`);
        return;
      }
      const timeout = str(x.p, 'timeout') ? parseDuration(str(x.p, 'timeout')!) : 0;
      const watchOn = str(x.p, 'watch') !== 'false';
      let last = '';
      const start = x.c.now;
      for (;;) {
        const cur = x.c.get('Deployment', x.ns, name)!;
        const r = rolloutMessage(cur);
        if (r.msg !== last) {
          if (r.failed) fail(r.msg);
          x.out(r.msg + '\n');
          last = r.msg;
        }
        if (r.done || !watchOn) return;
        if (timeout && x.c.now - start >= timeout) fail('error: timed out waiting for the condition');
        if (x.c.now - start > ((cur.spec.progressDeadlineSeconds ?? 600) + 30) * 1000) fail(`error: deployment "${name}" exceeded its progress deadline`);
        x.c.advance(1000);
      }
    }
    case 'history': {
      const revs = revisions(x, d);
      const want = str(x.p, 'revision');
      if (want) {
        const rs = revs.find((r) => r.metadata.annotations?.['deployment.kubernetes.io/revision'] === want);
        if (!rs) fail(`error: unable to find the specified revision`);
        const tpl = templateWithoutHash(rs!.spec.template);
        tpl.metadata.labels['pod-template-hash'] = rs!.metadata.labels['pod-template-hash'];
        x.out(`${ref} with revision #${want}\n` + describeTemplate(tpl));
        return;
      }
      const rows = [['REVISION', 'CHANGE-CAUSE'], ...revs.map((r) => [r.metadata.annotations?.['deployment.kubernetes.io/revision'] ?? '?', r.metadata.annotations?.['kubernetes.io/change-cause'] ?? '<none>'])];
      x.out(`${ref} \n${pad(rows, 2)}\n`);
      return;
    }
    case 'undo': {
      const revs = revisions(x, d);
      const to = str(x.p, 'to-revision');
      const current = Math.max(0, ...revs.map((r) => Number(r.metadata.annotations?.['deployment.kubernetes.io/revision'] ?? 0)));
      let target: Obj | undefined;
      if (to && to !== '0') {
        target = revs.find((r) => r.metadata.annotations?.['deployment.kubernetes.io/revision'] === to);
        if (!target) fail(`error: unable to find specified revision ${to} in history`);
      } else {
        const older = revs.filter((r) => Number(r.metadata.annotations?.['deployment.kubernetes.io/revision'] ?? 0) < current);
        target = older[older.length - 1];
        if (!target) fail(`error: no rollout history found for deployment "${name}"`);
      }
      const tpl = templateWithoutHash(target!.spec.template);
      if (JSON.stringify(templateWithoutHash(d.spec.template)) === JSON.stringify(tpl)) {
        x.out(`${ref} skipped rollback (current template already matches revision ${target!.metadata.annotations?.['deployment.kubernetes.io/revision']})\n`);
        return;
      }
      if (dryRun(x)) {
        x.out(`${ref} Pod Template:\n` + describeTemplate(tpl) + `\n${ref} rolled back (dry run)\n`);
        return;
      }
      const fresh = clone(d);
      fresh.spec.template = tpl;
      x.c.replace(fresh);
      x.out(`${ref} rolled back\n`);
      return;
    }
    case 'restart': {
      const tpl = clone(d.spec.template);
      tpl.metadata.annotations = { ...(tpl.metadata.annotations ?? {}), 'kubectl.kubernetes.io/restartedAt': iso(x.c.now) };
      x.c.patch(info.kind, x.ns, name, { spec: { template: tpl } });
      x.out(`${ref} restarted\n`);
      return;
    }
    case 'pause':
    case 'resume': {
      const paused = verb === 'pause';
      if (!!d.spec.paused === paused) fail(`error: ${ref} is ${paused ? 'already paused' : 'not paused'}`);
      x.c.patch(info.kind, x.ns, name, { spec: { paused: paused ? true : null } });
      x.out(`${ref} ${paused ? 'paused' : 'resumed'}\n`);
      return;
    }
    default:
      fail(`error: unknown command "${verb}" for "kubectl rollout"`);
  }
}

function describeTemplate(tpl: Obj): string {
  return podTemplateText(tpl);
}

function cmdSet(x: Ctx): void {
  const [what, ...rest] = x.p.args;
  if (what !== 'image' && what !== 'env') fail(what ? `${TRAINER} \`kubectl set ${what}\` is not modelled in the training cluster; use kubectl patch or apply.` : `error: unknown command "" for "kubectl set"`);
  const pairs = rest.filter((a) => a.includes('=') || a.endsWith('-'));
  const res = rest.filter((a) => !pairs.includes(a));
  const t = targets(x, res);
  if (!t.length || !t[0].names.length) fail(`error: you must specify resources by --filename when --local is set.\nExample resource specifications include:\n   '-f rsrc.yaml'\n   '--filename=rsrc.json'`);
  if (!pairs.length) fail(what === 'image' ? 'error: at least one image update is required' : 'error: at least one environment variable must be provided');
  for (const { info, names } of t) {
    for (const name of names) {
      const o = clone(getOne(x, info, name));
      const spec = info.kind === 'Pod' ? o.spec : o.spec.template.spec;
      if (what === 'image') {
        for (const pr of pairs) {
          const [cn, img] = pr.split('=');
          const targetsCt = cn === '*' ? spec.containers : spec.containers.filter((ct: Obj) => ct.name === cn);
          if (!targetsCt.length) fail(`error: unable to find container named "${cn}"`);
          for (const ct of targetsCt) ct.image = img;
        }
      } else {
        for (const pr of pairs) {
          for (const ct of spec.containers) {
            ct.env = (ct.env ?? []).filter((e: Obj) => e.name !== pr.split('=')[0].replace(/-$/, ''));
            if (!pr.endsWith('-')) ct.env.push({ name: pr.split('=')[0], value: pr.slice(pr.indexOf('=') + 1) });
            if (!ct.env.length) delete ct.env;
          }
        }
      }
      try {
        if (dryRun(x)) {
          x.out(`${kindRef(x, info)}/${name} ${what === 'image' ? 'image' : 'env'} updated (dry run)\n`);
          continue;
        }
        x.c.replace(o);
      } catch (e) {
        if (e instanceof ApiError) fail(e.print());
        throw e;
      }
      x.out(`${kindRef(x, info)}/${name} ${what === 'image' ? 'image' : 'env'} updated\n`);
    }
  }
}

function cmdLabel(x: Ctx, field: 'labels' | 'annotations'): void {
  const pairs = x.p.args.filter((a, i) => i > 0 && (a.includes('=') || /-$/.test(a)));
  const res = x.p.args.filter((a) => !pairs.includes(a));
  const sel = str(x.p, 'selector');
  let objs: Obj[] = [];
  const t = targets(x, res);
  if (!t.length) fail(`error: one or more resources must be specified as <resource> <name> or <resource>/<name>`);
  for (const g of t) {
    if (g.names.length) objs.push(...g.names.map((n) => getOne(x, g.info, n)));
    else if (sel || bool(x.p, 'all')) objs.push(...objectsOf(x, g.info, false).filter((o) => !sel || matchLabels(sel, o.metadata.labels)));
    else fail(`error: resource(s) were provided, but no name was specified`);
  }
  if (!pairs.length) fail(`error: at least one ${field === 'labels' ? 'label' : 'annotation'} update is required`);
  const verb = field === 'labels' ? 'labeled' : 'annotated';
  for (const o of objs) {
    const info = x.c.kinds.byKind(o.kind)!;
    const cur: Obj = { ...(o.metadata[field] ?? {}) };
    let removed = false;
    for (const pr of pairs) {
      if (pr.endsWith('-') && !pr.includes('=')) {
        if (pr.slice(0, -1) in cur) removed = true;
        delete cur[pr.slice(0, -1)];
        continue;
      }
      const [k, ...v] = pr.split('=');
      const val = v.join('=');
      if (k in cur && cur[k] !== val && !bool(x.p, 'overwrite')) fail(`error: '${k}' already has a value (${cur[k]}), and --overwrite is false`);
      cur[k] = val;
    }
    const patch: Obj = { metadata: { [field]: Object.fromEntries([...Object.keys(o.metadata[field] ?? {}).filter((k) => !(k in cur)).map((k) => [k, null]), ...Object.entries(cur)]) } };
    try {
      if (!dryRun(x)) x.c.patch(o.kind, o.metadata.namespace, o.metadata.name, patch);
    } catch (e) {
      if (e instanceof ApiError) fail(e.print());
      throw e;
    }
    const only = pairs.every((p) => p.endsWith('-') && !p.includes('='));
    x.out(`${kindRef(x, info)}/${o.metadata.name} ${only && removed ? (field === 'labels' ? 'unlabeled' : 'annotated') : verb}${suffix(x)}\n`);
  }
}

function cmdPatch(x: Ctx): void {
  const t = targets(x, x.p.args);
  if (!t.length || !t[0].names.length) fail('error: resource(s) were provided, but no name was specified');
  const raw = str(x.p, 'patch');
  if (!raw) fail('error: must specify -p to patch');
  let patch: unknown;
  try {
    patch = YAML.parse(raw!);
  } catch {
    fail(`error: unable to parse "${raw}": yaml: did not find expected node content`);
  }
  const type = str(x.p, 'type') ?? 'strategic';
  for (const { info, names } of t) {
    for (const name of names) {
      const o = getOne(x, info, name);
      let next: Obj;
      if (type === 'json') {
        next = clone(o);
        for (const op of patch as Obj[]) {
          const parts = String(op.path).split('/').slice(1).map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
          let cur: Obj = next;
          for (const pt of parts.slice(0, -1)) cur = cur[pt] as Obj;
          const last = parts[parts.length - 1];
          const arr = Array.isArray(cur) ? (cur as unknown[]) : null;
          if (op.op === 'remove') {
            if (arr) arr.splice(Number(last), 1);
            else delete cur[last];
          } else if (arr && last === '-') arr.push(op.value);
          else cur[last] = op.value;
        }
        try {
          if (JSON.stringify(next) === JSON.stringify(o)) {
            x.out(`${kindRef(x, info)}/${name} patched (no change)\n`);
            continue;
          }
          x.c.replace(next);
        } catch (e) {
          if (e instanceof ApiError) fail(e.print());
          throw e;
        }
      } else {
        const before = JSON.stringify(o);
        try {
          const merged = (type === 'merge' ? mergePatch(o, patch) : strategicMerge(o, patch)) as Obj;
          if (JSON.stringify(merged) === before) {
            x.out(`${kindRef(x, info)}/${name} patched (no change)\n`);
            continue;
          }
          if (!dryRun(x)) x.c.patch(info.kind, info.namespaced ? x.ns : undefined, name, patch as Obj, { strategic: type !== 'merge' });
        } catch (e) {
          if (e instanceof ApiError) fail(e.print());
          throw e;
        }
      }
      x.out(`${kindRef(x, info)}/${name} patched${suffix(x)}\n`);
    }
  }
}

function cmdExplain(x: Ctx): void {
  const what = x.p.args[0];
  if (!what) fail(`You must specify the type of resource to explain. Use "kubectl api-resources" for a complete list of supported resources.\n\nerror: Required resource not specified.\nSee 'kubectl explain -h' for help and examples`);
  const [kindWord, ...path] = what!.split('.');
  const info = x.c.kinds.resolve(kindWord);
  if (!info) fail(`error: the server doesn't have a resource type "${kindWord}"`);
  const t = findField(info!.kind, path);
  if ('error' in t) fail(t.error.startsWith("error: couldn't") ? `${TRAINER} field documentation for ${info!.kind} is not in the training corpus; it is on kubernetes.io › Reference › Kubernetes API.` : t.error);
  x.out(explainText(t as Exclude<typeof t, { error: string }>, bool(x.p, 'recursive')));
}

function cmdConfig(x: Ctx): void {
  const [verb, arg] = x.p.args;
  const kc = readKubeconfig(x.m, str(x.p, 'kubeconfig'));
  if (!verb) {
    x.out(HELP.config);
    return;
  }
  if (!kc) fail(`error: stat ${KUBECONFIG_PATH(x.m.user().home)}: no such file or directory`);
  const k = kc!;
  switch (verb) {
    case 'current-context':
      if (!k.current) fail('error: current-context is not set');
      x.out(k.current + '\n');
      return;
    case 'get-contexts': {
      const rows = [['CURRENT', 'NAME', 'CLUSTER', 'AUTHINFO', 'NAMESPACE'], ...k.contexts.filter((c) => !arg || c.name === arg).map((c) => [c.name === k.current ? '*' : '', c.name, c.cluster, c.user, c.namespace ?? ''])];
      if (str(x.p, 'output') === 'name') x.out(k.contexts.map((c) => c.name).join('\n') + '\n');
      else x.out(pad(bool(x.p, 'no-headers') ? rows.slice(1) : rows));
      return;
    }
    case 'use-context':
      if (!arg) fail(`error: Unexpected args: []\nSee 'kubectl config use-context -h' for help and examples`);
      if (!k.contexts.some((c) => c.name === arg)) fail(`error: no context exists with the name: "${arg}"`);
      k.raw['current-context'] = arg;
      writeKubeconfig(x.m, k);
      x.out(`Switched to context "${arg}".\n`);
      return;
    case 'set-context': {
      const name = bool(x.p, 'current') ? k.current : arg;
      if (!name) fail('error: you must specify a non-empty context name or --current');
      let entry = (k.raw.contexts as Obj[]).find((c) => c.name === name);
      const isNew = !entry;
      if (!entry) {
        entry = { name, context: {} };
        k.raw.contexts.push(entry);
      }
      const ns = str(x.p, 'namespace');
      if (ns !== undefined) entry.context.namespace = ns;
      if (str(x.p, 'cluster')) entry.context.cluster = str(x.p, 'cluster');
      if (str(x.p, 'user')) entry.context.user = str(x.p, 'user');
      writeKubeconfig(x.m, k);
      x.out(`Context "${name}" ${isNew ? 'created' : 'modified'}.\n`);
      return;
    }
    case 'view': {
      const view = clone(k.raw);
      if (bool(x.p, 'minify')) {
        const ctx = (view.contexts as Obj[]).find((c) => c.name === view['current-context']);
        view.contexts = ctx ? [ctx] : [];
        view.clusters = (view.clusters as Obj[]).filter((c) => c.name === ctx?.context?.cluster);
        view.users = (view.users as Obj[]).filter((u) => u.name === ctx?.context?.user);
      }
      if (!bool(x.p, 'raw')) {
        for (const c of view.clusters ?? []) if (c.cluster?.['certificate-authority-data']) c.cluster['certificate-authority-data'] = 'DATA+OMITTED';
        for (const u of view.users ?? []) {
          if (u.user?.['client-certificate-data']) u.user['client-certificate-data'] = 'DATA+OMITTED';
          if (u.user?.['client-key-data']) u.user['client-key-data'] = 'DATA+OMITTED';
        }
      }
      x.out(toYaml(view));
      return;
    }
    default:
      fail(`${TRAINER} \`kubectl config ${verb}\` is not modelled here; view, get-contexts, current-context, use-context and set-context are.`);
  }
}

function conditionMet(o: Obj | undefined, cond: string): boolean {
  if (!o) return false;
  const [name, want = 'true'] = cond.split('=');
  const conds: Obj[] = o.status?.conditions ?? [];
  return conds.some((c) => c.type.toLowerCase() === name.toLowerCase() && c.status.toLowerCase() === want.toLowerCase());
}

function cmdWait(x: Ctx): void {
  const forArg = str(x.p, 'for') ?? '';
  if (!forArg) fail('error: --for must be specified');
  const timeout = parseDuration(str(x.p, 'timeout') ?? '30s');
  const sel = str(x.p, 'selector');
  const t = targets(x, x.p.args);
  const objs: { info: KindInfo; name: string }[] = [];
  for (const g of t) {
    if (g.names.length) objs.push(...g.names.map((n) => ({ info: g.info, name: n })));
    else objs.push(...objectsOf(x, g.info, false).filter((o) => !sel || matchLabels(sel, o.metadata.labels)).map((o) => ({ info: g.info, name: o.metadata.name })));
  }
  if (!objs.length) fail('error: no matching resources found');
  const start = x.c.now;
  for (const it of objs) {
    for (;;) {
      const o = x.c.get(it.info.kind, it.info.namespaced ? x.ns : undefined, it.name);
      if (forArg === 'delete') {
        if (!o) {
          x.out(`${kindRef(x, it.info)}/${it.name} condition met\n`);
          break;
        }
      } else if (forArg.startsWith('condition=')) {
        if (!o && x.c.now === start) fail(notFound(x, it.info, it.name));
        if (conditionMet(o, forArg.slice(10))) {
          x.out(`${kindRef(x, it.info)}/${it.name} condition met\n`);
          break;
        }
      } else if (forArg.startsWith('jsonpath=')) {
        const m = /^jsonpath=\{?([^}=]+)\}?=(.*)$/.exec(forArg);
        if (!m) fail(`error: jsonpath wait format must be --for=jsonpath='{.status.readyReplicas}'=3`);
        if (o && jsonpath(o, `{${m![1].startsWith('.') ? m![1] : '.' + m![1]}}`) === m![2]) {
          x.out(`${kindRef(x, it.info)}/${it.name} condition met\n`);
          break;
        }
      } else fail(`error: unrecognized condition: "${forArg}"`);
      if (x.c.now - start >= timeout) fail(`error: timed out waiting for the condition on ${x.c.pluralOf(it.info.kind)}/${it.name}`);
      x.c.advance(1000);
    }
  }
}

function cmdCordon(x: Ctx, on: boolean): void {
  const name = x.p.args[0];
  if (!name) fail(`error: USAGE: ${on ? 'cordon' : 'uncordon'} NODE [flags]`);
  const n = getOne(x, x.c.kinds.byKind('Node')!, name);
  if (!!n.spec?.unschedulable === on) {
    x.out(`node/${name} already ${on ? 'cordoned' : 'uncordoned'}\n`);
    return;
  }
  x.c.patch('Node', undefined, name, { spec: { unschedulable: on ? true : null } });
  x.out(`node/${name} ${on ? 'cordoned' : 'uncordoned'}\n`);
}

function cmdDrain(x: Ctx): void {
  const name = x.p.args[0];
  if (!name) fail('error: USAGE: drain NODE [flags]');
  getOne(x, x.c.kinds.byKind('Node')!, name);
  const pods = x.c.list('Pod').filter((p) => p.spec.nodeName === name && !p.metadata.deletionTimestamp && p.status?.phase !== 'Succeeded' && p.status?.phase !== 'Failed');
  const ds = pods.filter((p) => controllerOf(p)?.kind === 'DaemonSet');
  const bare = pods.filter((p) => !controllerOf(p));
  const errs: string[] = [];
  if (ds.length && !bool(x.p, 'ignore-daemonsets')) errs.push(`cannot delete DaemonSet-managed Pods (use --ignore-daemonsets to ignore): ${ds.map((p) => `${p.metadata.namespace}/${p.metadata.name}`).join(', ')}`);
  if (bare.length && !bool(x.p, 'force')) errs.push(`cannot delete Pods that declare no controller (use --force to override): ${bare.map((p) => `${p.metadata.namespace}/${p.metadata.name}`).join(', ')}`);
  x.c.patch('Node', undefined, name, { spec: { unschedulable: true } });
  x.out(`node/${name} cordoned\n`);
  if (errs.length) fail(`error: unable to drain node "${name}" due to error: ${errs.join(', ')}, continuing command...\nThere are pending nodes to be drained:\n ${name}\n${errs.map((e) => `error: ${e}`).join('\n')}`);
  if (ds.length) x.err(`Warning: ignoring DaemonSet-managed Pods: ${ds.map((p) => `${p.metadata.namespace}/${p.metadata.name}`).join(', ')}\n`);
  if (bare.length) x.err(`Warning: deleting Pods that declare no controller: ${bare.map((p) => `${p.metadata.namespace}/${p.metadata.name}`).join(', ')}\n`);
  const evict = pods.filter((p) => controllerOf(p)?.kind !== 'DaemonSet');
  for (const p of evict) {
    x.out(`evicting pod ${p.metadata.namespace}/${p.metadata.name}\n`);
    x.c.delete('Pod', p.metadata.namespace, p.metadata.name);
  }
  for (const p of evict) {
    waitGone(x, 'Pod', p.metadata.namespace, p.metadata.name, 40);
    x.out(`pod/${p.metadata.name} evicted\n`);
  }
  x.out(`node/${name} drained\n`);
}

function cmdTaint(x: Ctx): void {
  const [kind, name, ...specs] = x.p.args;
  if (!kind || !name || !specs.length) fail(`error: at least one taint update is required`);
  const info = resolveKind(x, kind);
  if (info.kind !== 'Node') fail(`error: invalid resource type ${kind}, only node types are supported`);
  const n = getOne(x, info, name);
  let taints: Obj[] = clone(n.spec?.taints ?? []);
  let removed = false;
  for (const sp of specs) {
    if (sp.endsWith('-')) {
      const body = sp.slice(0, -1);
      const [k, effect] = body.split(':');
      const before = taints.length;
      taints = taints.filter((t) => !(t.key === k.split('=')[0] && (!effect || t.effect === effect)));
      if (taints.length === before) fail(`error: taint "${body}" not found`);
      removed = true;
      continue;
    }
    const m = /^([^=:]+)(?:=([^:]*))?:(NoSchedule|PreferNoSchedule|NoExecute)$/.exec(sp);
    if (!m) fail(`error: invalid taint spec: ${sp}, unknown taint effect or missing effect; must be one of NoSchedule, PreferNoSchedule, NoExecute`);
    if (taints.some((t) => t.key === m![1] && t.effect === m![3]) && !bool(x.p, 'overwrite')) fail(`error: node ${name} already has ${m![1]} taint(s) with same effect(s) and --overwrite is false`);
    taints = taints.filter((t) => !(t.key === m![1] && t.effect === m![3]));
    taints.push({ key: m![1], ...(m![2] ? { value: m![2] } : {}), effect: m![3], ...(m![3] === 'NoExecute' ? { timeAdded: iso(x.c.now) } : {}) });
  }
  x.c.patch('Node', undefined, name, { spec: { taints: taints.length ? taints : null } });
  x.out(`node/${name} ${removed ? 'untainted' : 'tainted'}\n`);
}

function cmdApiResources(x: Ctx): void {
  const nsFilter = str(x.p, 'namespaced');
  const rows = x.c.kinds
    .all()
    .filter((k) => nsFilter === undefined || String(k.namespaced) === nsFilter)
    .sort((a, b) => a.plural.localeCompare(b.plural))
    .map((k) => [k.plural, k.short.join(','), apiVersionOf(k), String(k.namespaced), k.kind]);
  if (str(x.p, 'output') === 'name') x.out(rows.map((r) => (r[2].includes('/') ? `${r[0]}.${r[2].split('/')[0]}` : r[0])).join('\n') + '\n');
  else x.out(pad(bool(x.p, 'no-headers') ? rows : [['NAME', 'SHORTNAMES', 'APIVERSION', 'NAMESPACED', 'KIND'], ...rows]));
}

function cmdEvents(x: Ctx): void {
  const allNs = bool(x.p, 'all-namespaces');
  let evs = objectsOf(x, x.c.kinds.byKind('Event')!, allNs);
  const forObj = str(x.p, 'for');
  if (forObj) {
    const [k, n] = forObj.includes('/') ? forObj.split('/') : ['pod', forObj];
    const info = resolveKind(x, k);
    evs = evs.filter((e) => e.involvedObject.kind === info.kind && e.involvedObject.name === n);
  }
  const types = str(x.p, 'types');
  if (types) evs = evs.filter((e) => types.split(',').includes(e.type));
  if (!evs.length) {
    x.err(`No events found in ${x.ns} namespace.\n`);
    return;
  }
  const rows = evs.map((e) => [...(allNs ? [e.metadata.namespace] : []), age(x.c.now - Date.parse(e.lastTimestamp)), e.type, e.reason, `${e.involvedObject.kind}/${e.involvedObject.name}`, e.message]);
  x.out(pad([[...(allNs ? ['NAMESPACE'] : []), 'LAST SEEN', 'TYPE', 'REASON', 'OBJECT', 'MESSAGE'], ...rows]));
}

// ── dispatch ──

export async function runKubectl(m: SimMachineApi, cluster: Cluster | null, argv: string[], o: { stdin?: string; fs?: CmdContext['fs']; quiet?: boolean } = {}): Promise<KubectlIO> {
  let out = '';
  let err = '';
  const sub0 = argv.find((a, i) => !a.startsWith('-') && !['-n', '--namespace', '--context', '--kubeconfig'].includes(argv[i - 1] ?? '')) ?? '';
  const sub = COMMANDS.includes(sub0) ? sub0 : sub0;
  const subIdx = argv.indexOf(sub0);
  const rest = subIdx >= 0 ? [...argv.slice(0, subIdx), ...argv.slice(subIdx + 1)] : argv;
  const helpKey = (() => {
    const words = [sub, ...rest.filter((a) => !a.startsWith('-')).slice(0, 2)];
    for (let n = words.length; n > 0; n--) {
      const k = words.slice(0, n).join(' ');
      if (HELP[k] !== undefined) return k;
    }
    return sub;
  })();
  if (!sub0) {
    if (argv.includes('--help') || argv.includes('-h') || !argv.length) return { out: HELP[''], err: '', code: 0 };
  }
  if (sub0 === 'help') return { out: HELP[argv[subIdx + 1] ?? ''] ?? HELP[''], err: '', code: 0 };
  if (argv.includes('--help') || argv.includes('-h')) {
    const text = HELP[helpKey];
    if (text) return { out: text, err: '', code: 0 };
    return { out: `${TRAINER} the full help of "kubectl ${helpKey}" is on kubernetes.io › Reference › kubectl.\n`, err: '', code: 0 };
  }
  if (sub0 === 'options') return { out: 'The following options can be passed to any command:\n\n    --context=\'\':\n\tThe name of the kubeconfig context to use\n\n    --kubeconfig=\'\':\n\tPath to the kubeconfig file to use for CLI requests.\n\n    -n, --namespace=\'\':\n\tIf present, the namespace scope for this CLI request\n\n    -v, --v=0:\n\tnumber for the log level verbosity\n', err: '', code: 0 };
  if (!FLAGS[sub]) {
    const near = COMMANDS.filter((c) => distance(c, sub) <= 2);
    return { out: '', err: `error: unknown command "${sub}" for "kubectl"${near.length ? `\n\nDid you mean this?\n${near.map((c) => `\t${c}`).join('\n')}` : ''}\n`, code: 1 };
  }
  const p = parseArgs(rest, FLAGS[sub]);
  if (p.error) return { out: '', err: `${p.error}\nSee 'kubectl ${sub} --help' for usage.\n`, code: 1 };
  if (p.unsupported) err += `${TRAINER} the flag ${p.unsupported} exists in kubectl, but the training cluster does not model it — it works on the real stage.\n`;
  if (sub === 'version' && bool(p, 'client')) return { out: `Client Version: v1.37.1\nKustomize Version: v5.7.1\n`, err, code: 0 };
  const kc = readKubeconfig(m, str(p, 'kubeconfig'));
  if (!kc && sub !== 'config') return { out: '', err: err + 'The connection to the server localhost:8080 was refused - did you specify the right host or port?\n', code: 1 };
  const ctxName = str(p, 'context') ?? kc?.current;
  const ctx = kc?.contexts.find((c) => c.name === ctxName);
  if (kc && sub !== 'config' && !ctx) return { out: '', err: err + `error: context "${ctxName}" does not exist\n`, code: 1 };
  const c = cluster ?? clusterOf(m);
  c.syncReal(machineNow(m));
  const fs = o.fs ?? m.rootFs;
  const x: Ctx = {
    m,
    c,
    ns: str(p, 'namespace') ?? ctx?.namespace ?? 'default',
    out: (s) => (out += s),
    err: (s) => (err += s),
    stdin: o.stdin ?? '',
    readFile: (path) => fs.readFile(path),
    isDir: (path) => fs.stat(path)?.type === 'd',
    listDir: (path) => fs.readdir(path),
    p,
    sub,
    verbose: Number(str(p, 'v') ?? 0),
    quiet: o.quiet,
  };
  try {
    if (!['config', 'explain', 'version', 'api-resources', 'api-versions'].includes(sub) || (sub === 'version' && !bool(p, 'client'))) {
      if (sub !== 'config' && sub !== 'explain') c.reachable();
    }
    switch (sub) {
      case 'get':
        cmdGet(x);
        break;
      case 'describe':
        cmdDescribe(x);
        break;
      case 'apply':
        cmdApply(x, 'apply');
        break;
      case 'create':
        cmdCreate(x);
        break;
      case 'run':
        cmdRun(x);
        break;
      case 'expose':
        cmdExpose(x);
        break;
      case 'scale':
        cmdScale(x);
        break;
      case 'delete':
        cmdDelete(x);
        break;
      case 'logs':
        cmdLogs(x);
        break;
      case 'exec':
        cmdExec(x);
        break;
      case 'port-forward':
        cmdPortForward(x);
        break;
      case 'rollout':
        cmdRollout(x);
        break;
      case 'set':
        cmdSet(x);
        break;
      case 'label':
        cmdLabel(x, 'labels');
        break;
      case 'annotate':
        cmdLabel(x, 'annotations');
        break;
      case 'patch':
        cmdPatch(x);
        break;
      case 'explain':
        cmdExplain(x);
        break;
      case 'config':
        cmdConfig(x);
        break;
      case 'wait':
        cmdWait(x);
        break;
      case 'cordon':
        cmdCordon(x, true);
        break;
      case 'uncordon':
        cmdCordon(x, false);
        break;
      case 'drain':
        cmdDrain(x);
        break;
      case 'taint':
        cmdTaint(x);
        break;
      case 'events':
        cmdEvents(x);
        break;
      case 'api-resources':
        cmdApiResources(x);
        break;
      case 'api-versions':
        x.out([...new Set(c.kinds.all().map(apiVersionOf))].sort().join('\n') + '\n');
        break;
      case 'version':
        x.out(`Client Version: v1.37.1\nKustomize Version: v5.7.1\nServer Version: ${K8S_VERSION}\n`);
        break;
      case 'cluster-info':
        x.out(`\x1b[0;32mKubernetes control plane\x1b[0m is running at \x1b[0;33mhttps://127.0.0.1:6443\x1b[0m\n${c.get('Service', 'kube-system', 'kube-dns') ? '\x1b[0;32mCoreDNS\x1b[0m is running at \x1b[0;33mhttps://127.0.0.1:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy\x1b[0m\n' : ''}\nTo further debug and diagnose cluster problems, use 'kubectl cluster-info dump'.\n`);
        break;
      case 'top':
        fail('error: Metrics API not available');
        break;
      case 'edit':
        fail(`${TRAINER} kubectl edit opens a text editor on the object. In the training terminal change objects with kubectl apply -f <file>, kubectl patch, kubectl set image or kubectl scale — the API server sees the same update.`);
    }
    return { out, err, code: 0 };
  } catch (e) {
    if (e instanceof Fail) return { out, err: err + e.text, code: e.code };
    if (e instanceof ApiError) return { out, err: err + e.print() + '\n', code: 1 };
    if (e instanceof ManifestError) return { out, err: err + e.message + '\n', code: 1 };
    throw e;
  }
}

export function kubectlCommand(): ShellCommand {
  return {
    name: 'kubectl',
    summary: bi('Управляет кластером Kubernetes через его API-сервер', 'Controls a Kubernetes cluster through its API server'),
    help: HELP[''],
    handlesHelp: true,
    async run(ctx) {
      const r = await runKubectl(ctx.machine, k8sCluster(ctx.machine), ctx.argv.slice(1), { stdin: ctx.stdin, fs: ctx.fs });
      if (r.out) ctx.out(r.out);
      if (r.err) ctx.err(r.err);
      return r.code;
    },
    complete(args) {
      if (args.length <= 1) return COMMANDS;
      const sub = args[0];
      if (['get', 'describe', 'delete', 'explain', 'edit', 'label', 'annotate', 'patch', 'scale', 'expose', 'rollout', 'wait'].includes(sub))
        return ['pods', 'deployments', 'replicasets', 'services', 'endpointslices', 'nodes', 'namespaces', 'configmaps', 'secrets', 'events', 'jobs', 'daemonsets', 'ingresses', 'networkpolicies', 'all'];
      if (sub === 'create') return ['deployment', 'service', 'configmap', 'secret', 'namespace', 'job'];
      if (sub === 'config') return ['view', 'get-contexts', 'current-context', 'use-context', 'set-context'];
      return [];
    },
  };
}

function k8sCluster(m: SimMachineApi): Cluster | null {
  return m.ext<K8sState>('k8s', () => new K8sState()).cluster;
}

export { rfc1123, intOrPercent };
