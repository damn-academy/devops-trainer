import { templateWithoutHash } from './controllers';
import { apiClient, identity } from './rbac';
// Training charts use deterministic renderers; values are merged like Helm values files.
import YAML from 'yaml';
import type { ShellCommand } from '../../core/types';
import { bi } from '../../core/i18n';
import { b64, unb64 } from './admission';
import type { Cluster } from './cluster';
import { clusterOf } from './state';
import { clone, deepEqual, mergePatch, pad, parseDuration, type Obj } from './util';
import { parseArgs, str, bool, list } from './kubectl/args';

const charts: Record<string, Obj> = {
  'nginx-web': { replicaCount: 1, image: { repository: 'nginx', tag: '1.27' }, service: { port: 80, type: 'ClusterIP' }, resources: {} },
  'postgres-like': { replicaCount: 1, image: { repository: 'trainer/web', tag: '1.0' }, service: { port: 5432, type: 'ClusterIP' }, persistence: { enabled: true, size: '1Gi', storageClass: 'csi-hostpath-sc' }, resources: {} },
  'podinfo': { replicaCount: 1, image: { repository: 'trainer/web', tag: '1.0' }, service: { port: 80, type: 'ClusterIP' }, env: {}, resources: {} },
};
export interface HelmRelease { name: string; namespace: string; revision: number; chart: string; status: string; values: Obj; manifest: Obj[]; updated: string; description: string }
export function helmReleases(c: Cluster, ns?: string): HelmRelease[] {
  return c.list('Secret', ns).filter(s => s.type === 'helm.sh/release.v1').flatMap(s => {
    try { return [JSON.parse(unb64(s.data.release)) as HelmRelease]; } catch { return []; }
  }).sort((a, b) => a.name.localeCompare(b.name) || a.revision - b.revision);
}
function save(c: Cluster, r: HelmRelease): void {
  const name = `sh.helm.release.v1.${r.name}.v${r.revision}`;
  const o = { apiVersion: 'v1', kind: 'Secret', metadata: { name, namespace: r.namespace, labels: { owner: 'helm', name: r.name, status: r.status, version: String(r.revision) } }, type: 'helm.sh/release.v1', data: { release: b64(JSON.stringify(r)) } };
  if (c.get('Secret', r.namespace, name)) c.replace(o); else c.create(o);
}
export function renderChart(chart: string, name: string, ns: string, overrides: Obj = {}): Obj[] {
  const defaults = charts[chart];
  if (!defaults) throw new Error(`chart "${chart}" not found`);
  const v = mergePatch(clone(defaults), overrides) as Obj;
  if (!Number.isInteger(v.replicaCount) || v.replicaCount < 0) throw new Error('values don\'t meet the specifications of the schema(s): replicaCount: Must be a non-negative integer');
  if (!v.image?.repository || !v.image?.tag) throw new Error('execution error: image.repository and image.tag are required');
  if (!Number.isInteger(v.service?.port) || v.service.port < 1 || v.service.port > 65535) throw new Error('values don\'t meet the specifications of the schema(s): service.port: Must be between 1 and 65535');
  const labels = { 'app.kubernetes.io/name': chart, 'app.kubernetes.io/instance': name };
  const metadata = { name, namespace: ns, labels: { ...labels, 'app.kubernetes.io/managed-by': 'Helm' }, annotations: { 'meta.helm.sh/release-name': name, 'meta.helm.sh/release-namespace': ns } };
  const stateful = chart === 'postgres-like';
  const container: Obj = { name: chart, image: `${v.image.repository}:${v.image.tag}`, ports: [{ containerPort: v.service.port, name: 'http' }], resources: v.resources, env: Object.entries(v.env ?? {}).map(([name, value]) => ({ name, value: String(value) })) };
  const spec: Obj = { replicas: v.replicaCount, selector: { matchLabels: labels }, template: { metadata: { labels }, spec: { containers: [container] } } };
  if (stateful) {
    spec.serviceName = name;
    if (v.persistence.enabled) {
      spec.volumeClaimTemplates = [{ metadata: { name: 'data' }, spec: { accessModes: ['ReadWriteOnce'], resources: { requests: { storage: v.persistence.size } }, ...(v.persistence.storageClass ? { storageClassName: v.persistence.storageClass } : {}) } }];
      container.volumeMounts = [{ name: 'data', mountPath: '/data' }];
    }
  }
  return [{ apiVersion: 'v1', kind: 'Service', metadata: clone(metadata), spec: { type: v.service.type, ...(stateful ? { clusterIP: 'None' } : {}), selector: labels, ports: [{ port: v.service.port, targetPort: 'http', name: 'http' }] } }, { apiVersion: 'apps/v1', kind: stateful ? 'StatefulSet' : 'Deployment', metadata: clone(metadata), spec }];
}
const manifests = (objects: Obj[]) => objects.map(o => YAML.stringify(o)).join('---\n');
const latest = (releases: HelmRelease[]) => [...new Map(releases.map(r => [`${r.namespace}/${r.name}`, r])).values()];
export function runHelm(c: Cluster, argv: string[], readFile: (path: string) => string): { out: string; err: string; code: number } {
  const p = parseArgs(argv, [{ long: 'kube-context', value: true }, { long: 'set', value: true, multi: true }, { long: 'values', short: 'f', value: true, multi: true }, { long: 'install', short: 'i' }, { long: 'all-namespaces', short: 'A' }, { long: 'all', short: 'a' }, { long: 'create-namespace' }, { long: 'wait' }, { long: 'timeout', value: true }, { long: 'reuse-values' }, { long: 'keep-history' }, { long: 'output', short: 'o', value: true }]);
  const ns = str(p, 'namespace') ?? 'default';
  const [cmd, name, arg] = p.args;
  try {
    if (p.error || p.unsupported) throw new Error(p.error ?? `unsupported flag ${p.unsupported}`);
    const offline = ['repo', 'search', 'show', 'template', 'lint'].includes(cmd);
    if (!offline) c.reachable();
    const all = offline ? [] : helmReleases(c, ns), history = all.filter(r => r.name === name), current = history.at(-1);
    const required = () => { if (!current) throw new Error(`release: not found`); return current; };
    const chartName = (ref: string) => {
      const parts = (ref ?? '').split('/');
      if (parts.length === 2 && !c.helmRepos[parts[0]]) throw new Error(`repo ${parts[0]} not found`);
      const key = parts.at(-1)!;
      if (!charts[key]) throw new Error(`chart "${ref}" not found`);
      return key;
    };
    const values = (base: Obj = {}): Obj => {
      let v = clone(base);
      for (const file of list(p, 'values')) {
        const parsed = YAML.parse(readFile(file));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`failed to parse ${file}: values must be a mapping`);
        v = mergePatch(v, parsed) as Obj;
      }
      for (const setting of list(p, 'set').flatMap(s => s.split(','))) {
        const at = setting.indexOf('=');
        if (at < 1) throw new Error(`failed parsing --set data: key "${setting}" has no value`);
        const path = setting.slice(0, at).split('.');
        if (path.some(k => ['__proto__', 'constructor', 'prototype'].includes(k))) throw new Error('invalid values key');
        let target = v;
        for (const key of path.slice(0, -1)) { if (!target[key] || typeof target[key] !== 'object') target[key] = {}; target = target[key]; }
        const raw = setting.slice(at + 1);
        target[path.at(-1)!] = /^(true|false|null|-?(0|[1-9][0-9]*))$/.test(raw) ? YAML.parse(raw) : raw;
      }
      return v;
    };
    const status = (r: HelmRelease) => `NAME: ${r.name}\nLAST DEPLOYED: ${r.updated}\nNAMESPACE: ${r.namespace}\nSTATUS: ${r.status}\nREVISION: ${r.revision}\nDESCRIPTION: ${r.description}\n`;
    let out = '';
    switch (cmd) {
      case 'repo':
        if (name === 'add') { const url = p.args[3]; if (!arg || !/^https?:\/\//.test(url ?? '')) throw new Error('helm repo add requires NAME and URL'); c.helmRepos[arg] = url; out = `"${arg}" has been added to your repositories\n`; }
        else if (name === 'list') out = pad([['NAME', 'URL'], ...Object.entries(c.helmRepos)]);
        else if (name === 'update') out = 'Hang tight while we grab the latest from your chart repositories...\nUpdate Complete. ⎈Happy Helming!⎈\n';
        else throw new Error('unknown repo command');
        break;
      case 'search':
        if (name !== 'repo') throw new Error('expected search repo');
        out = pad([['NAME', 'CHART VERSION', 'APP VERSION', 'DESCRIPTION'], ...Object.keys(c.helmRepos).flatMap(repo => Object.keys(charts).map(chart => [`${repo}/${chart}`, '1.0.0', String(charts[chart].image.tag), 'Training chart'])).filter(row => !arg || row[0].includes(arg))]); break;
      case 'show': if (name !== 'values') throw new Error('expected show values'); out = YAML.stringify(charts[chartName(arg)]); break;
      case 'template': case 'lint': {
        const chart = chartName(cmd === 'lint' ? name : arg ?? name);
        const rendered = renderChart(chart, cmd === 'lint' || !arg ? 'release-name' : name, ns, values());
        out = cmd === 'lint' ? `==> Linting ${name}\n\n1 chart(s) linted, 0 chart(s) failed\n` : manifests(rendered); break;
      }
      case 'install': case 'upgrade': {
        if (!name || !arg) throw new Error(`"helm ${cmd}" requires 2 arguments`);
        if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name) || name.length > 53) throw new Error('invalid release name');
        if (cmd === 'install' && current && current.status !== 'uninstalled') throw new Error('cannot re-use a name that is still in use');
        if (cmd === 'upgrade' && !current && !bool(p, 'install')) throw new Error(`"${name}" has no deployed releases`);
        const chart = chartName(arg);
        const v = values(bool(p, 'reuse-values') ? current?.values : {});
        const rendered = renderChart(chart, name, ns, v);
        if (!c.get('Namespace', undefined, ns) && bool(p, 'create-namespace')) c.create({ apiVersion: 'v1', kind: 'Namespace', metadata: { name: ns } });
        // Validate the entire desired release before writing workloads.
        for (const o of rendered) {
          const live = c.get(o.kind, ns, o.metadata.name);
          if (live && (live.metadata.annotations?.['meta.helm.sh/release-name'] !== name || live.metadata.annotations?.['meta.helm.sh/release-namespace'] !== ns)) throw new Error(`rendered manifests contain a resource that already exists: ${o.kind} "${o.metadata.name}" exists and cannot be imported into the current release: invalid ownership metadata`);
          if (live) c.apply(o, { dryRun: true }); else c.create(o, { dryRun: true });
        }
        const r: HelmRelease = { name, namespace: ns, revision: (current?.revision ?? 0) + 1, chart, status: 'deployed', values: v, manifest: rendered, updated: new Date(c.now).toISOString(), description: current ? 'Upgrade complete' : 'Install complete' };
        for (const o of rendered) c.apply(o);
        for (const old of current?.manifest ?? []) if (!rendered.some(o => o.kind === old.kind && o.metadata.name === old.metadata.name) && c.get(old.kind, ns, old.metadata.name)) c.delete(old.kind, ns, old.metadata.name);
        save(c, r);
        if (bool(p, 'wait')) {
          const timeout = parseDuration(str(p, 'timeout') ?? '5m');
          const deadline = c.now + timeout;
          const pending = () => rendered.some(o => {
            if (o.spec?.replicas === undefined) return false;
            const live = c.get(o.kind, ns, o.metadata.name);
            if (live?.kind === 'Deployment') {
              const rs = c.list('ReplicaSet', ns).find(rs => rs.metadata.ownerReferences?.some((owner: Obj) => owner.uid === live.metadata.uid) && deepEqual(templateWithoutHash(rs.spec.template), templateWithoutHash(live.spec.template)));
              if ((rs?.status?.readyReplicas ?? 0) < o.spec.replicas) return true;
            }
            return !live || (live.status?.observedGeneration ?? 0) < live.metadata.generation
              || (live.status?.readyReplicas ?? 0) < o.spec.replicas
              || (live.status?.updatedReplicas ?? 0) < o.spec.replicas;
          });
          while (c.now < deadline && pending()) c.advance(Math.min(1000, deadline - c.now));
          if (pending()) { save(c, { ...r, status: 'failed', description: 'context deadline exceeded' }); throw new Error('context deadline exceeded'); }
        }
        for (const deployed of history.filter(r => r.status === 'deployed')) save(c, { ...deployed, status: 'superseded' });
        out = `Release "${name}" ${current ? 'has been upgraded' : 'has been installed'}. Happy Helming!\n` + status(r); break;
      }
      case 'list': {
        const rs = latest(helmReleases(c, bool(p, 'all-namespaces') ? undefined : ns)).filter(r => bool(p, 'all') || r.status !== 'uninstalled');
        out = str(p, 'output') === 'json' ? JSON.stringify(rs) + '\n' : pad([['NAME', 'NAMESPACE', 'REVISION', 'UPDATED', 'STATUS', 'CHART', 'APP VERSION'], ...rs.map(r => [r.name, r.namespace, String(r.revision), r.updated, r.status, `${r.chart}-1.0.0`, String(charts[r.chart].image.tag)])]); break;
      }
      case 'status': out = status(required()); break;
      case 'get': {
        const r = all.filter(r => r.name === arg).at(-1); if (!r) throw new Error('release: not found');
        if (name === 'manifest') out = manifests(r.manifest);
        else if (name === 'values') out = (bool(p, 'all') ? 'COMPUTED VALUES:\n' + YAML.stringify(mergePatch(charts[r.chart], r.values)) : 'USER-SUPPLIED VALUES:\n' + (Object.keys(r.values).length ? YAML.stringify(r.values) : 'null\n'));
        else throw new Error('expected get values or manifest'); break;
      }
      case 'history': required(); out = pad([['REVISION', 'UPDATED', 'STATUS', 'CHART', 'APP VERSION', 'DESCRIPTION'], ...history.map(r => [String(r.revision), r.updated, r.status, `${r.chart}-1.0.0`, String(charts[r.chart].image.tag), r.description])]); break;
      case 'rollback': {
        const old = required(); const revision = Number(arg ?? 0); const target = revision ? history.find(r => r.revision === revision) : history.at(-2);
        if (!target) throw new Error(`release has no revision ${arg ?? 0}`);
        for (const o of target.manifest) c.apply(o, { dryRun: true });
        for (const o of target.manifest) c.apply(o);
        for (const deployed of history.filter(r => r.status === 'deployed')) save(c, { ...deployed, status: 'superseded' });
        save(c, { ...clone(target), revision: old.revision + 1, status: 'deployed', updated: new Date(c.now).toISOString(), description: `Rollback to ${target.revision}` });
        out = 'Rollback was a success! Happy Helming!\n'; break;
      }
      case 'uninstall': {
        const r = required();
        for (const o of r.manifest) if (c.get(o.kind, ns, o.metadata.name)) c.delete(o.kind, ns, o.metadata.name);
        if (bool(p, 'keep-history')) save(c, { ...r, status: 'uninstalled' });
        else for (const release of history) c.delete('Secret', ns, `sh.helm.release.v1.${name}.v${release.revision}`);
        out = `release "${name}" uninstalled\n`; break;
      }
      default: throw new Error(`unknown command "${cmd}" for "helm"`);
    }
    return { out, err: '', code: 0 };
  } catch (e) { return { out: '', err: `Error: ${['install', 'upgrade'].includes(cmd) ? cmd.toUpperCase() + ' FAILED: ' : ''}${(e as Error).message}\n`, code: 1 }; }
}
export function helmCommand(): ShellCommand {
  return { name: 'helm', summary: bi('Управление учебными Helm charts', 'Manage training Helm charts'), async run(ctx) { const cluster = clusterOf(ctx.machine);
    let namespace = 'default', user = 'default';
    const args = ctx.argv.slice(1);
    const at = args.findIndex(a => a === '--kube-context' || a.startsWith('--kube-context='));
    const requested = at < 0 ? undefined : args[at].includes('=') ? args[at].slice('--kube-context='.length) : args[at + 1];
    try {
      const config = YAML.parse(ctx.machine.rootFs.readFile(ctx.machine.vars.KUBECONFIG ?? `${ctx.machine.user().home}/.kube/config`));
      const contextName = requested ?? config['current-context'];
      const context = config.contexts.find((c: Obj) => c.name === contextName)?.context;
      if (!context) { ctx.err(`Error: context "${contextName}" does not exist\n`); return 1; }
      namespace = context.namespace ?? 'default'; user = context.user ?? 'default';
    } catch {
      if (requested !== undefined) { ctx.err(`Error: context "${requested}" does not exist\n`); return 1; }
    }
    const r = runHelm(apiClient(cluster, identity(user)), ['--namespace', namespace, ...args], path => ctx.fs.readFile(path)); ctx.out(r.out); ctx.err(r.err); return r.code; } };
}
