// Goal checks for the RBAC, StatefulSet and Helm tasks, computed from the
// facts of the cluster. RBAC questions are answered by kube-lite's own
// authorizer over the RBAC objects in the facts, so a check says "yes"
// exactly when `kubectl auth can-i` would.

import type { Facts } from '../../core/types';
import type { Cluster } from '../../engine/kube-lite/cluster';
import type { K8sFacts } from '../../engine/kube-lite/facts';
import { canI, identity } from '../../engine/kube-lite/rbac';
import type { Obj } from '../../engine/kube-lite/util';

const k8s = (f: Facts) => f.k8s as K8sFacts;

/** A read-only stand-in for the cluster, enough for the authorizer. */
function store(f: Facts): Cluster {
  const objects = k8s(f).objects;
  const list = (kind: string, ns?: string) => objects.filter((o) => o.kind === kind && (ns === undefined || o.metadata?.namespace === ns));
  const get = (kind: string, ns: string | undefined, name: string) => objects.find((o) => o.kind === kind && o.metadata?.name === name && (ns === undefined || o.metadata?.namespace === ns));
  return { list, get } as unknown as Cluster;
}

const GROUP: Record<string, string> = { deployments: 'apps', statefulsets: 'apps', replicasets: 'apps', daemonsets: 'apps', jobs: 'batch', roles: 'rbac.authorization.k8s.io', rolebindings: 'rbac.authorization.k8s.io' };

/** May `user` do `verb` on `resource` (plural, "pods/log" for a subresource) in namespace `ns`? */
export function may(f: Facts | undefined, user: string, verb: string, resource: string, ns?: string): boolean {
  if (!f) return false;
  return canI(store(f), identity(user), verb, resource, GROUP[resource.split('/')[0]] ?? '', ns);
}

export const sa = (ns: string, name: string) => `system:serviceaccount:${ns}:${name}`;

export const objOf = (f: Facts | undefined, kind: string, ns: string | undefined, name: string): Obj | undefined =>
  f ? k8s(f).objects.find((o) => o.kind === kind && o.metadata?.name === name && (ns === undefined || o.metadata?.namespace === ns)) : undefined;

export const objsOf = (f: Facts | undefined, kind: string, ns?: string): Obj[] => (f ? k8s(f).objects.filter((o) => o.kind === kind && (ns === undefined || o.metadata?.namespace === ns)) : []);

/** Bindings (in any namespace) whose subjects name this user or service account. */
export const bindingsFor = (f: Facts | undefined, kind: 'RoleBinding' | 'ClusterRoleBinding', subject: { kind: 'User' | 'ServiceAccount'; name: string; namespace?: string }): Obj[] =>
  objsOf(f, kind).filter((b) => (b.subjects ?? []).some((s: Obj) => s.kind === subject.kind && s.name === subject.name && (subject.kind === 'User' || (s.namespace ?? b.metadata?.namespace) === subject.namespace)));

/** Authorization decisions the API server made for this user. */
export const decisions = (f: Facts | undefined, user: string): Obj[] => (f ? (k8s(f).rbac?.decisions ?? []).filter((d) => d.user === user) : []);

/** A rule that names workloads of the group apps in the core group (""), where they do not exist. */
export const deploymentsInCoreGroup = (f: Facts | undefined, ns?: string) =>
  [...(ns ? objsOf(f, 'Role', ns) : []), ...objsOf(f, 'ClusterRole')].some((r) => (r.rules ?? []).some((x: Obj) => (x.apiGroups ?? []).includes('') && !(x.apiGroups ?? []).includes('apps') && (x.resources ?? []).some((res: string) => ['deployments', 'statefulsets', 'daemonsets', 'replicasets'].includes(res))));

// ── StatefulSets ──

export interface StsFact {
  ns: string;
  name: string;
  replicas: number;
  ready: number;
  currentRevision?: string;
  updateRevision?: string;
  ordinals: { name: string; ordinal: number; ready: boolean; pvcs: string[] }[];
  pvcs: { name: string; phase?: string; volume?: string }[];
}
export const stsOf = (f: Facts | undefined, ns: string, name: string): StsFact | undefined => (f ? (k8s(f).statefulsets as StsFact[] | undefined)?.find((s) => s.ns === ns && s.name === name) : undefined);
export const podOf = (f: Facts | undefined, ns: string, name: string) => (f ? k8s(f).pods.find((p) => p.ns === ns && p.name === name) : undefined);
export const claimOf = (f: Facts | undefined, ns: string, name: string) => objOf(f, 'PersistentVolumeClaim', ns, name);

// ── Helm ──

export interface ReleaseFact {
  name: string;
  namespace: string;
  revision: number;
  chart: string;
  status: string;
  values: Obj;
  manifest: Obj[];
  description: string;
}
export const releaseOf = (f: Facts | undefined, ns: string, name: string): ReleaseFact | undefined =>
  f ? ((k8s(f).helm?.releases ?? []) as unknown as ReleaseFact[]).find((r) => r.namespace === ns && r.name === name) : undefined;
export const revisionsOf = (f: Facts | undefined, ns: string, name: string): ReleaseFact[] =>
  f ? ((k8s(f).helm?.revisions ?? []) as unknown as ReleaseFact[]).filter((r) => r.namespace === ns && r.name === name).sort((a, b) => a.revision - b.revision) : [];
export const deploymentOf = (f: Facts | undefined, ns: string, name: string) => (f ? k8s(f).deployments.find((d) => d.ns === ns && d.name === name) : undefined);
