// The resource types kube-lite serves (05 §5.3, MVP subset): how they are
// named in kubectl, which group/version they live in, whether they are
// namespaced. Custom resources from a CRD are added at runtime with the
// same shape.

export interface KindInfo {
  kind: string;
  group: string;
  version: string;
  plural: string;
  singular: string;
  short: string[];
  namespaced: boolean;
  /** Not creatable by users (managed by controllers or the kubelet). */
  readOnly?: boolean;
  /** Defined by a CustomResourceDefinition. */
  custom?: boolean;
}

export const apiVersionOf = (k: KindInfo) => (k.group ? `${k.group}/${k.version}` : k.version);

const k = (kind: string, group: string, version: string, plural: string, short: string[], namespaced = true, extra: Partial<KindInfo> = {}): KindInfo => ({
  kind,
  group,
  version,
  plural,
  singular: kind.toLowerCase(),
  short,
  namespaced,
  ...extra,
});

export const BUILTIN_KINDS: KindInfo[] = [
  k('Pod', '', 'v1', 'pods', ['po']),
  k('Service', '', 'v1', 'services', ['svc']),
  k('ConfigMap', '', 'v1', 'configmaps', ['cm']),
  k('Secret', '', 'v1', 'secrets', []),
  k('Namespace', '', 'v1', 'namespaces', ['ns'], false),
  k('Node', '', 'v1', 'nodes', ['no'], false),
  k('Event', '', 'v1', 'events', ['ev']),
  k('Endpoints', '', 'v1', 'endpoints', ['ep'], true, { readOnly: true }),
  k('ServiceAccount', '', 'v1', 'serviceaccounts', ['sa']),
  k('PersistentVolumeClaim', '', 'v1', 'persistentvolumeclaims', ['pvc']),
  k('PersistentVolume', '', 'v1', 'persistentvolumes', ['pv'], false),
  k('Deployment', 'apps', 'v1', 'deployments', ['deploy']),
  k('ReplicaSet', 'apps', 'v1', 'replicasets', ['rs']),
  k('DaemonSet', 'apps', 'v1', 'daemonsets', ['ds']),
  k('Job', 'batch', 'v1', 'jobs', []),
  k('EndpointSlice', 'discovery.k8s.io', 'v1', 'endpointslices', []),
  k('Ingress', 'networking.k8s.io', 'v1', 'ingresses', ['ing']),
  k('IngressClass', 'networking.k8s.io', 'v1', 'ingressclasses', [], false),
  k('NetworkPolicy', 'networking.k8s.io', 'v1', 'networkpolicies', ['netpol']),
  k('StorageClass', 'storage.k8s.io', 'v1', 'storageclasses', ['sc'], false),
  k('HorizontalPodAutoscaler', 'autoscaling', 'v2', 'horizontalpodautoscalers', ['hpa']),
  k('Lease', 'coordination.k8s.io', 'v1', 'leases', []),
  k('CustomResourceDefinition', 'apiextensions.k8s.io', 'v1', 'customresourcedefinitions', ['crd', 'crds'], false),
];

/** The order `kubectl api-resources` prints and `get all` uses. */
export const GET_ALL = ['Pod', 'Service', 'DaemonSet', 'Deployment', 'ReplicaSet', 'Job'];

export class KindTable {
  private list: KindInfo[];
  constructor(custom: KindInfo[] = []) {
    this.list = [...BUILTIN_KINDS, ...custom];
  }
  all(): KindInfo[] {
    return this.list;
  }
  custom(): KindInfo[] {
    return this.list.filter((x) => x.custom);
  }
  add(info: KindInfo): void {
    this.list = this.list.filter((x) => !(x.kind === info.kind && x.group === info.group));
    this.list.push(info);
  }
  remove(kind: string, group: string): void {
    this.list = this.list.filter((x) => !(x.custom && x.kind === kind && x.group === group));
  }
  /** By kind and apiVersion as written in a manifest. */
  byKind(kind: string, apiVersion?: string): KindInfo | undefined {
    return this.list.find((x) => x.kind === kind && (!apiVersion || apiVersionOf(x) === apiVersion));
  }
  /** By what a learner types: pods, pod, po, deploy, deployments.apps, Deployment. */
  resolve(word: string): KindInfo | undefined {
    const w = word.toLowerCase();
    const [name, ...groupParts] = w.split('.');
    const group = groupParts.join('.');
    return this.list.find(
      (x) =>
        (x.plural === name || x.singular === name || x.short.includes(name) || x.kind.toLowerCase() === name) &&
        (!group || x.group === group || (group.startsWith(x.group) && x.group !== '')),
    );
  }
  /** pods → "pod", deployments.apps → "deployment.apps" as kubectl prints after a verb. */
  ref(info: KindInfo): string {
    return info.group ? `${info.singular}.${info.group}` : info.singular;
  }
}
