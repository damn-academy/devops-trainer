// A small GitOps controller for the kube-lite cluster: the Argo CD
// Application resource (argoproj.io/v1alpha1) and the loop that keeps the
// cluster equal to a directory of a Git repository on the training forge.
// It is a reconciler like the ones the learner met in Kubernetes and IaC:
// read the desired state (the manifests at the target revision), read the
// live state, compare, act according to the sync policy, write status.
//
// What it does, in Argo CD terms:
//  - status.sync.status Synced / OutOfSync, status.sync.revision;
//  - status.health.status Healthy / Progressing / Degraded / Missing;
//  - automated sync once per new revision; selfHeal re-syncs live drift;
//    prune deletes tracked objects that left Git (otherwise OutOfSync);
//  - a manual sync is an `operation.sync` field patched into the Application
//    (what `argocd app sync` does through the API);
//  - syncOptions CreateNamespace=true; tracking by the annotation
//    argocd.argoproj.io/tracking-id (the default of Argo CD 3).
// The stand reconciles after every command; a real Argo CD looks at the
// repository every three minutes or when a webhook arrives.

import type { SetupHook, SimMachineApi } from '../../core/types';
import { ForgeProject, projectOfUrl } from '../git-cicd/git/forge';
import type { Cluster } from '../../engine/kube-lite/cluster';
import { IMAGES } from '../../engine/kube-lite/images';
import { parseManifests } from '../../engine/kube-lite/manifests';
import { k8sState } from '../../engine/kube-lite/state';
import type { Obj } from '../../engine/kube-lite/util';

export const ARGO_IMAGE = 'quay.io/argoproj/argocd:v3.1.9';
if (!IMAGES[ARGO_IMAGE]) IMAGES[ARGO_IMAGE] = { size: 187_695_104, ports: [8080, 8082, 8083], http: ['/healthz'], logs: ['argocd {version} serving on port 8080'], tools: ['sh', 'cat', 'ls', 'env'] };

export const APP_CRD: Obj = {
  apiVersion: 'apiextensions.k8s.io/v1',
  kind: 'CustomResourceDefinition',
  metadata: { name: 'applications.argoproj.io', labels: { 'app.kubernetes.io/name': 'applications.argoproj.io', 'app.kubernetes.io/part-of': 'argocd' } },
  spec: {
    group: 'argoproj.io',
    names: { kind: 'Application', listKind: 'ApplicationList', plural: 'applications', singular: 'application', shortNames: ['app', 'apps'] },
    scope: 'Namespaced',
    versions: [{ name: 'v1alpha1', served: true, storage: true, schema: { openAPIV3Schema: { type: 'object', 'x-kubernetes-preserve-unknown-fields': true } } }],
  },
};

const argoDeploy = (name: string): Obj => ({
  apiVersion: 'apps/v1',
  kind: 'Deployment',
  metadata: { name, namespace: 'argocd', labels: { 'app.kubernetes.io/name': name, 'app.kubernetes.io/part-of': 'argocd' } },
  spec: { replicas: 1, selector: { matchLabels: { 'app.kubernetes.io/name': name } }, template: { metadata: { labels: { 'app.kubernetes.io/name': name } }, spec: { containers: [{ name, image: ARGO_IMAGE, ports: [{ containerPort: 8080 }] }] } } },
});

const TRACK = 'argocd.argoproj.io/tracking-id';
const trackingId = (app: string, o: Obj, ns: string | undefined) => `${app}:${(o.apiVersion ?? '').includes('/') ? o.apiVersion.split('/')[0] : ''}/${o.kind}:${ns ?? ''}/${o.metadata?.name}`;

// ── comparing desired with live ──

/** Is every field of `want` present and equal in `have`? (status and tracking are ignored) */
export function contains(want: unknown, have: unknown): boolean {
  if (want === null || typeof want !== 'object') return want === have || (typeof want === 'number' && String(want) === String(have));
  if (Array.isArray(want)) return Array.isArray(have) && want.length === have.length && want.every((w, i) => contains(w, have[i]));
  if (!have || typeof have !== 'object') return false;
  return Object.entries(want as Record<string, unknown>).every(([k, v]) => contains(v, (have as Record<string, unknown>)[k]));
}

function strip(o: Obj): Obj {
  const { status: _s, ...rest } = o;
  void _s;
  return rest;
}

/** spec.ignoreDifferences: JSON pointers of fields Argo CD leaves to someone else (an autoscaler, a person). */
function ignoredPointers(app: Obj, o: Obj): string[] {
  const rules = (app.spec?.ignoreDifferences ?? []) as Obj[];
  const group = (o.apiVersion ?? '').includes('/') ? o.apiVersion.split('/')[0] : '';
  return rules.filter((r) => r.kind === o.kind && (r.group ?? '') === group && (!r.name || r.name === o.metadata?.name)).flatMap((r) => (r.jsonPointers ?? []) as string[]);
}

function pointer(o: Obj, p: string, value?: unknown, set = false): unknown {
  const parts = p.split('/').slice(1).map((x) => x.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur: Obj | undefined = o;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[parts[i]];
  }
  const last = parts[parts.length - 1];
  if (!cur || typeof cur !== 'object') return undefined;
  if (set) {
    if (value === undefined) delete cur[last];
    else cur[last] = value;
  }
  return cur[last];
}

/** The desired object with ignored fields removed (for comparing) or taken from live (for applying). */
function withIgnored(app: Obj, d: Obj, live: Obj | undefined, mode: 'compare' | 'apply'): Obj {
  const ptrs = ignoredPointers(app, d);
  if (!ptrs.length) return d;
  const copy = JSON.parse(JSON.stringify(d)) as Obj;
  for (const p of ptrs) pointer(copy, p, mode === 'compare' || !live ? undefined : pointer(live, p), mode === 'compare' || !!live);
  return copy;
}

interface Desired {
  obj: Obj;
  ns: string | undefined;
}

interface Loaded {
  revision: string | null;
  desired: Desired[];
  error?: string;
}

function namespaced(c: Cluster, kind: string): boolean {
  try {
    return c.resolveManifest({ apiVersion: kind === 'Namespace' ? 'v1' : 'v1', kind, metadata: { name: 'x' } }).namespaced;
  } catch {
    return true;
  }
}

function load(m: SimMachineApi, c: Cluster, app: Obj): Loaded {
  const src = app.spec?.source ?? {};
  const project = projectOfUrl(String(src.repoURL ?? ''));
  const repoErr = `Failed to load target state: failed to generate manifest for source 1 of 1: rpc error: code = Unknown desc = failed to list refs: repository not found`;
  if (!project || !ForgeProject.exists(m.rootFs, project)) return { revision: null, desired: [], error: repoErr };
  const repo = new ForgeProject(m.rootFs, project).repo;
  const rev = String(src.targetRevision ?? 'HEAD');
  const oid = rev === 'HEAD' ? repo.headOid() : repo.resolve(`refs/heads/${rev}`) ?? repo.resolve(`refs/tags/${rev}`) ?? repo.resolve(rev);
  if (!oid) return { revision: null, desired: [], error: `Failed to load target state: failed to generate manifest for source 1 of 1: rpc error: code = Unknown desc = unable to resolve '${rev}' to a commit SHA` };
  const dir = String(src.path ?? '.').replace(/^\.\/?/, '').replace(/\/$/, '');
  const files = [...repo.commitFiles(oid).entries()].filter(([p]) => (dir ? p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes('/') : !p.includes('/')) && /\.(ya?ml|json)$/.test(p)).sort(([a], [b]) => a.localeCompare(b));
  if (!files.length) return { revision: oid, desired: [], error: `Failed to load target state: failed to generate manifest for source 1 of 1: rpc error: code = Unknown desc = ${dir || '.'}: app path does not exist` };
  const destNs = app.spec?.destination?.namespace as string | undefined;
  const desired: Desired[] = [];
  for (const [p, e] of files) {
    try {
      for (const obj of parseManifests(repo.readBlob(e.oid), p)) {
        if (!obj?.kind || !obj.metadata?.name) continue;
        const ns = namespaced(c, obj.kind) ? (obj.metadata.namespace ?? destNs ?? 'default') : undefined;
        desired.push({ obj, ns });
      }
    } catch (err) {
      return { revision: oid, desired: [], error: `Failed to load target state: failed to generate manifest for source 1 of 1: rpc error: code = Unknown desc = Manifest generation error (cached): ${(err as Error).message.replace(/^error: /, '')}` };
    }
  }
  return { revision: oid, desired };
}

function healthOf(c: Cluster, d: Desired): string {
  const live = c.get(d.obj.kind, d.ns, d.obj.metadata.name);
  if (!live) return 'Missing';
  if (d.obj.kind === 'Deployment') {
    const want = live.spec?.replicas ?? 1;
    const st = live.status ?? {};
    if ((st.availableReplicas ?? 0) >= want && (st.updatedReplicas ?? 0) >= want) return 'Healthy';
    const pods = c.list('Pod', d.ns).filter((p) => p.metadata.ownerReferences?.length && Object.entries(live.spec?.selector?.matchLabels ?? {}).every(([k, v]) => p.metadata.labels?.[k] === v));
    if (pods.some((p) => (p.status?.containerStatuses ?? []).some((cs: Obj) => /CrashLoopBackOff|ImagePullBackOff|ErrImagePull/.test(cs.state?.waiting?.reason ?? '')))) return 'Degraded';
    return 'Progressing';
  }
  return 'Healthy';
}

const worst = (hs: string[]) => (['Missing', 'Degraded', 'Progressing', 'Healthy'].find((h) => hs.includes(h)) ?? 'Healthy');

/** One pass of the controller over one Application. */
export function reconcileApp(m: SimMachineApi, c: Cluster, app: Obj): void {
  const name = app.metadata.name;
  const policy = app.spec?.syncPolicy ?? {};
  const auto = policy.automated;
  const prev = app.status ?? {};
  const now = new Date(c.now).toISOString().replace(/\.\d+Z$/, 'Z');
  const L = load(m, c, app);
  const tracked = () => c.all().filter((o) => typeof o.metadata?.annotations?.[TRACK] === 'string' && String(o.metadata.annotations[TRACK]).startsWith(`${name}:`));
  const compare = () => {
    const keys = new Set(L.desired.map((d) => trackingId(name, d.obj, d.ns)));
    const resources = L.desired.map((d) => {
      const live = c.get(d.obj.kind, d.ns, d.obj.metadata.name);
      const synced = !!live && contains(strip(withIgnored(app, d.obj, live, 'compare')), live);
      return { group: (d.obj.apiVersion ?? '').includes('/') ? d.obj.apiVersion.split('/')[0] : '', version: String(d.obj.apiVersion ?? '').split('/').pop(), kind: d.obj.kind, namespace: d.ns, name: d.obj.metadata.name, status: synced ? 'Synced' : 'OutOfSync', health: { status: healthOf(c, d) } };
    });
    const extra = tracked().filter((o) => !keys.has(String(o.metadata.annotations[TRACK])));
    for (const o of extra) resources.push({ group: '', version: String(o.apiVersion ?? '').split('/').pop(), kind: o.kind, namespace: o.metadata.namespace, name: o.metadata.name, status: 'OutOfSync', health: { status: 'Healthy' }, requiresPruning: true } as (typeof resources)[number]);
    return { resources, extra, synced: resources.every((r) => r.status === 'Synced') };
  };
  if (L.error) {
    c.putStatus(app, { ...prev, sync: { status: 'Unknown', revision: L.revision ?? prev.sync?.revision }, health: { status: prev.health?.status ?? 'Unknown' }, conditions: [{ type: 'ComparisonError', message: L.error, lastTransitionTime: now }], reconciledAt: now });
    return;
  }
  let cmp = compare();
  const op = app.operation?.sync;
  const lastSynced = prev.operationState?.syncResult?.revision;
  const wantAuto = !!auto && !cmp.synced && (lastSynced !== L.revision || auto.selfHeal === true);
  let operationState = prev.operationState;
  let history: Obj[] = prev.history ?? [];
  if (op || wantAuto) {
    const prune = op ? op.prune === true || auto?.prune === true : auto?.prune === true;
    const createNs = (policy.syncOptions ?? []).includes('CreateNamespace=true');
    let error = '';
    for (const d of L.desired) {
      try {
        if (d.ns && createNs && !c.get('Namespace', undefined, d.ns)) c.apply({ apiVersion: 'v1', kind: 'Namespace', metadata: { name: d.ns } });
        const respect = (policy.syncOptions ?? []).includes('RespectIgnoreDifferences=true');
        const base = respect ? withIgnored(app, d.obj, c.get(d.obj.kind, d.ns, d.obj.metadata.name), 'apply') : d.obj;
        const obj = { ...base, metadata: { ...base.metadata, ...(d.ns ? { namespace: d.ns } : {}), annotations: { ...(d.obj.metadata.annotations ?? {}), [TRACK]: trackingId(name, d.obj, d.ns) } } };
        c.apply(obj, { namespace: d.ns });
      } catch (e) {
        error ||= `${d.obj.kind}/${d.obj.metadata.name}: ${(e as Error).message.replace(/^Error from server \(\w+\): /, '')}`;
      }
    }
    if (prune && !error) for (const o of cmp.extra) c.delete(o.kind, o.metadata.namespace, o.metadata.name);
    c.advance(10_000);
    operationState = error
      ? { operation: { sync: { revision: L.revision, prune } }, phase: 'Failed', message: `one or more objects failed to apply, reason: ${error}`, startedAt: now, finishedAt: now, syncResult: { revision: L.revision } }
      : { operation: { sync: { revision: L.revision, prune }, initiatedBy: op ? { username: 'admin' } : { automated: true } }, phase: 'Succeeded', message: 'successfully synced (all tasks run)', startedAt: now, finishedAt: now, syncResult: { revision: L.revision } };
    if (!error) history = [...history, { id: history.length, revision: L.revision, deployedAt: now, source: app.spec?.source }].slice(-10);
    cmp = compare();
  }
  const fresh = c.get('Application', 'argocd', name) ?? app;
  const status = {
    sync: { status: cmp.synced ? 'Synced' : 'OutOfSync', revision: L.revision, comparedTo: { source: app.spec?.source, destination: app.spec?.destination } },
    health: { status: worst(cmp.resources.filter((r) => !(r as { requiresPruning?: boolean }).requiresPruning).map((r) => r.health.status)) },
    resources: cmp.resources,
    ...(operationState ? { operationState } : {}),
    ...(history.length ? { history } : {}),
    reconciledAt: now,
    sourceType: 'Directory',
  };
  if (op) {
    const { operation: _o, ...rest } = fresh;
    void _o;
    c.put({ ...rest, status });
  } else c.putStatus(fresh, status);
}

export function reconcileAll(m: SimMachineApi): void {
  const c = k8sState(m).cluster;
  if (!c || !c.kinds.byKind('Application')) return;
  for (const app of c.list('Application', 'argocd')) {
    try {
      reconcileApp(m, c, app);
    } catch (e) {
      console.warn('gitops reconcile failed', (e as Error).message);
    }
  }
}

// ── the setup hook: install "Argo CD" into the cluster of ext.k8s ──

export interface GitopsSetup {
  /** Applications created before the prompt (YAML). */
  apps?: string[];
}

const watching = new WeakSet<SimMachineApi>();

export const gitopsSetupHook: SetupHook = {
  key: 'gitops',
  apply(m, value) {
    const v = (value ?? {}) as GitopsSetup;
    const c = k8sState(m).cluster;
    if (!c) return;
    c.apply({ apiVersion: 'v1', kind: 'Namespace', metadata: { name: 'argocd' } });
    c.apply(APP_CRD);
    for (const d of ['argocd-server', 'argocd-repo-server', 'argocd-application-controller']) c.apply(argoDeploy(d));
    for (const text of v.apps ?? []) for (const doc of parseManifests(text, 'app.yaml')) c.apply(doc, { namespace: 'argocd' });
    c.advance(30_000);
    reconcileAll(m);
    c.advance(15_000);
    reconcileAll(m);
    c.timeline = [];
    if (!watching.has(m)) {
      watching.add(m);
      m.on((ev) => {
        if (ev.t === 'cmd.done') reconcileAll(m);
      });
    }
  },
};
