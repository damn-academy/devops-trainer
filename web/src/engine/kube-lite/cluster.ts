import { bootstrapRbac } from './rbac';
// kube-lite: an in-browser model of a Kubernetes control plane (05 §5).
//
//  store      — objects with resourceVersion from one monotonic counter, a
//               change log (the k8s.timeline facts) and watch subscribers;
//               optimistic locking gives a real Conflict on a stale version.
//  apiserver  — create / apply / replace / patch / delete with defaults
//               (mutating admission) and validation, messages in the format
//               of the real kube-apiserver.
//  loop       — a virtual clock; every tick runs the controllers, the
//               scheduler and the kubelets until nothing changes.
//
// Every piece of state is plain JSON, so the cluster is Snapshotable and the
// terminal's "Reset this screen" and saved progress work without special
// cases. Nothing here touches the DOM.

import { installAddons, newAddonState, runAddons, type AddonId, type AddonState } from './addons';
import { lookupImage } from './images';
import { KindTable, apiVersionOf, type KindInfo } from './kinds';
import { applyDefaults, validate } from './admission';
import { runControllers } from './controllers';
import { runKubelets, type PodRuntime } from './kubelet';
import { runScheduler } from './scheduler';
import { DNS1123_LABEL, DNS1123_SUBDOMAIN, Rand, clone, deepEqual, getPath, iso, isObj, mergePatch, strategicMerge, type Obj } from './util';

export const K8S_VERSION = 'v1.37.1+k3s1';
export const T0 = Date.UTC(2026, 10, 18, 9, 0, 0);

export type ComponentId = 'etcd' | 'apiserver' | 'scheduler' | 'controller-manager' | 'kube-proxy' | 'coredns' | 'cni' | 'netpol';

export interface Components {
  etcd: boolean;
  apiserver: boolean;
  scheduler: boolean;
  'controller-manager': boolean;
  'kube-proxy': boolean;
  /** CoreDNS is a Deployment in kube-system; false = not installed. */
  coredns: boolean;
  /** The CNI plugin (flannel in k3s) on every node. */
  cni: boolean;
  /** Whether the CNI enforces NetworkPolicy (k3s: the embedded kube-router does). */
  netpol: boolean;
}

export interface NodeSim {
  name: string;
  ip: string;
  podCIDR: string;
  role: 'control-plane' | 'worker';
  power: boolean;
  kubelet: boolean;
  runtime: boolean;
  /** Increments on every power cycle: containers do not survive a reboot. */
  boot: number;
  lastLease: number;
  nextIp: number;
  images: string[];
  cpu: string;
  memory: string;
  labels: Record<string, string>;
}

export interface Change {
  rv: number;
  at: number;
  type: 'ADDED' | 'MODIFIED' | 'DELETED';
  kind: string;
  ns: string;
  name: string;
  /** A few fields a check over time may want (phase, replicas, ready…). */
  summary?: Record<string, unknown>;
}

export interface ClusterOptions {
  nodes?: string[];
  components?: Partial<Components>;
  controlPlaneTaint?: boolean;
  /** Skip the kube-system workloads (CoreDNS) — the constructor builds them itself. */
  bare?: boolean;
  seed?: number;
  /** Add-ons installed at boot (the layered constructor); undefined: a plain k3s-like cluster. */
  addons?: AddonId[];
  /** The CNI replaces kube-proxy (Cilium with kubeProxyReplacement). */
  proxyReplacement?: boolean;
}

export interface ClusterState {
  volumeFiles?: Record<string, Record<string, string>>;
  helmRepos?: Record<string, string>;
  authorizationDecisions?: Obj[];
  v: 1;
  now: number;
  rv: number;
  seed: number;
  objects: Obj[];
  timeline: Change[];
  components: Components;
  nodes: NodeSim[];
  runtime: Record<string, PodRuntime>;
  /** kube-proxy's last synced view (frozen while kube-proxy is stopped). */
  proxy: ProxyTable;
  forwards: { local: number; ns: string; target: string; port: number }[];
  rr: Record<string, number>;
  custom: KindInfo[];
  /** Machine clock reading at the last sync (real time → virtual time). */
  lastReal: number | null;
  nextClusterIP: number;
  nextNodePort: number;
  addons?: AddonState | null;
}

export interface ProxyTable {
  /** "ns/svc:port" → endpoints "ip:port" of ready pods, as kube-proxy last wrote them. */
  services: Record<string, { clusterIP: string; port: number; protocol: string; nodePort?: number; endpoints: string[]; portName?: string }>;
  syncedAt: number;
}

export class ApiError extends Error {
  constructor(
    public code: number,
    public reason: string,
    message: string,
    /** Printed as is (not wrapped in "Error from server"). */
    public raw = false,
  ) {
    super(message);
  }
  /** What kubectl prints. */
  print(): string {
    if (this.raw) return this.message;
    return `Error from server (${this.reason}): ${this.message}`;
  }
}

export const DEFAULT_COMPONENTS: Components = {
  etcd: true,
  apiserver: true,
  scheduler: true,
  'controller-manager': true,
  'kube-proxy': true,
  coredns: true,
  cni: true,
  netpol: true,
};

const key = (kind: string, ns: string | undefined, name: string) => `${kind}/${ns ?? ''}/${name}`;

type Listener = (c: Change, obj: Obj | undefined) => void;

export class Cluster {
  authorizationDecisions: Obj[] = [];
  volumeFiles: Record<string, Record<string, string>> = {};
  helmRepos: Record<string, string> = {};
  now: number;
  rv: number;
  rand: Rand;
  kinds: KindTable;
  components: Components;
  nodes: NodeSim[];
  runtime: Record<string, PodRuntime> = {};
  proxy: ProxyTable = { services: {}, syncedAt: 0 };
  forwards: ClusterState['forwards'] = [];
  rr: Record<string, number> = {};
  timeline: Change[] = [];
  lastReal: number | null = null;
  nextClusterIP = 20;
  nextNodePort = 30080;
  /** Add-ons and their controllers' memory; null on a plain cluster (Ingress status as k3s ServiceLB gives). */
  addons: AddonState | null = null;
  private objs = new Map<string, Obj>();
  private listeners = new Set<Listener>();
  /** Set while a tick runs controllers: writes they make are not "user" writes. */
  private inLoop = false;

  constructor(o: ClusterOptions = {}) {
    this.now = T0 - 4 * 86_400_000;
    this.rv = 1000;
    this.rand = new Rand(o.seed ?? 42);
    this.kinds = new KindTable();
    this.components = { ...DEFAULT_COMPONENTS, ...(o.components ?? {}) };
    const names = o.nodes ?? ['cp-1', 'worker-1', 'worker-2'];
    this.nodes = names.map((name, i) => ({
      name,
      ip: `192.168.56.${11 + i}`,
      podCIDR: `10.42.${i}.0/24`,
      role: i === 0 ? 'control-plane' : 'worker',
      power: true,
      kubelet: true,
      runtime: true,
      boot: 1,
      lastLease: this.now,
      nextIp: 2,
      images: [],
      cpu: '2',
      memory: '4015948Ki',
      labels: {},
    }));
    if (o.addons || o.proxyReplacement) this.addons = newAddonState(o.addons ?? [], !!o.proxyReplacement);
    bootstrapRbac(this);
    this.boot(o);
  }

  // ── boot ──

  private boot(o: ClusterOptions): void {
    const was = this.components;
    // Boot with a working control plane, then switch off what the scenario removes.
    this.components = { ...DEFAULT_COMPONENTS, coredns: was.coredns };
    for (const ns of ['default', 'kube-system', 'kube-public', 'kube-node-lease']) this.sysCreate({ apiVersion: 'v1', kind: 'Namespace', metadata: { name: ns } });
    for (const n of this.nodes) {
      const labels: Obj = {
        'beta.kubernetes.io/arch': 'amd64',
        'beta.kubernetes.io/os': 'linux',
        'kubernetes.io/arch': 'amd64',
        'kubernetes.io/hostname': n.name,
        'kubernetes.io/os': 'linux',
        ...(n.role === 'control-plane' ? { 'node-role.kubernetes.io/control-plane': 'true', 'node-role.kubernetes.io/master': 'true' } : {}),
        ...n.labels,
      };
      this.sysCreate({
        apiVersion: 'v1',
        kind: 'Node',
        metadata: { name: n.name, labels, annotations: { 'flannel.alpha.coreos.com/public-ip': n.ip, 'node.alpha.kubernetes.io/ttl': '0', 'trainer.dev/simulated': 'true' } },
        spec: { podCIDR: n.podCIDR, podCIDRs: [n.podCIDR], providerID: `k3s://${n.name}`, ...(n.role === 'control-plane' && o.controlPlaneTaint ? { taints: [{ key: 'node-role.kubernetes.io/control-plane', effect: 'NoSchedule' }] } : {}) },
        status: nodeStatus(n, true, this.now),
      });
      this.sysCreate({ apiVersion: 'coordination.k8s.io/v1', kind: 'Lease', metadata: { name: n.name, namespace: 'kube-node-lease' }, spec: { holderIdentity: n.name, leaseDurationSeconds: 40, renewTime: iso(this.now) } });
    }
    this.sysCreate({
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name: 'kubernetes', namespace: 'default', labels: { component: 'apiserver', provider: 'kubernetes' } },
      spec: { clusterIP: '10.43.0.1', ports: [{ name: 'https', port: 443, protocol: 'TCP', targetPort: 6443 }], type: 'ClusterIP', sessionAffinity: 'None' },
    });
    this.sysCreate({
      apiVersion: 'discovery.k8s.io/v1',
      kind: 'EndpointSlice',
      metadata: { name: 'kubernetes', namespace: 'default', labels: { 'kubernetes.io/service-name': 'kubernetes' } },
      addressType: 'IPv4',
      endpoints: [{ addresses: [this.nodes[0].ip], conditions: { ready: true } }],
      ports: [{ name: 'https', port: 6443, protocol: 'TCP' }],
    });
    if (was.coredns && !o.bare) {
      this.sysCreate({
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { name: 'coredns', namespace: 'kube-system' },
        data: {
          Corefile:
            '.:53 {\n    errors\n    health\n    ready\n    kubernetes cluster.local in-addr.arpa ip6.arpa {\n      pods insecure\n      fallthrough in-addr.arpa ip6.arpa\n    }\n    hosts /etc/coredns/NodeHosts {\n      ttl 60\n      reload 15s\n      fallthrough\n    }\n    prometheus :9153\n    forward . /etc/resolv.conf\n    cache 30\n    loop\n    reload\n    loadbalance\n}\n',
        },
      });
      this.sysCreate({
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: 'coredns', namespace: 'kube-system', labels: { 'k8s-app': 'kube-dns', 'kubernetes.io/name': 'CoreDNS' } },
        spec: {
          replicas: 1,
          selector: { matchLabels: { 'k8s-app': 'kube-dns' } },
          template: {
            metadata: { labels: { 'k8s-app': 'kube-dns' } },
            spec: {
              priorityClassName: 'system-cluster-critical',
              nodeSelector: { 'kubernetes.io/os': 'linux' },
              tolerations: [
                { key: 'CriticalAddonsOnly', operator: 'Exists' },
                { key: 'node-role.kubernetes.io/control-plane', operator: 'Exists', effect: 'NoSchedule' },
              ],
              containers: [
                {
                  name: 'coredns',
                  image: 'rancher/mirrored-coredns-coredns:1.12.3',
                  ports: [
                    { containerPort: 53, name: 'dns', protocol: 'UDP' },
                    { containerPort: 53, name: 'dns-tcp', protocol: 'TCP' },
                    { containerPort: 9153, name: 'metrics', protocol: 'TCP' },
                  ],
                  resources: { limits: { memory: '170Mi' }, requests: { cpu: '100m', memory: '70Mi' } },
                  readinessProbe: { httpGet: { path: '/ready', port: 8181 }, periodSeconds: 2 },
                  livenessProbe: { httpGet: { path: '/health', port: 8080 }, initialDelaySeconds: 60, periodSeconds: 10 },
                },
              ],
            },
          },
        },
      });
      this.sysCreate({
        apiVersion: 'v1',
        kind: 'Service',
        metadata: { name: 'kube-dns', namespace: 'kube-system', labels: { 'k8s-app': 'kube-dns', 'kubernetes.io/name': 'CoreDNS' } },
        spec: {
          selector: { 'k8s-app': 'kube-dns' },
          clusterIP: '10.43.0.10',
          ports: [
            { name: 'dns', port: 53, protocol: 'UDP', targetPort: 53 },
            { name: 'dns-tcp', port: 53, protocol: 'TCP', targetPort: 53 },
            { name: 'metrics', port: 9153, protocol: 'TCP', targetPort: 9153 },
          ],
        },
      });
      // CoreDNS sits on the control-plane node, as in a fresh k3s.
      this.nodes[0].images.push('rancher/mirrored-coredns-coredns:1.12.3');
    }
    if (this.addons?.installed.length) installAddons(this, this.addons.installed);
    this.advance(30_000);
    // Everything that exists at boot is "a few days old", as on a cluster you are given.
    const back = 4 * 86_400_000 - 30_000;
    for (const obj of this.objs.values()) {
      if (obj.kind === 'Event') {
        this.objs.delete(key('Event', obj.metadata.namespace, obj.metadata.name));
        continue;
      }
      obj.metadata.creationTimestamp = iso(Date.parse(obj.metadata.creationTimestamp) - 0);
      if (obj.status?.startTime) obj.status.startTime = obj.metadata.creationTimestamp;
    }
    this.now += back;
    for (const n of this.nodes) n.lastLease = this.now;
    this.timeline = [];
    this.components = { ...was };
    for (const n of this.nodes) this.renewLease(n);
    this.tick();
  }

  // ── store ──

  get(kind: string, ns: string | undefined, name: string): Obj | undefined {
    const o = this.objs.get(key(kind, this.nsOf(kind, ns), name));
    return o;
  }

  list(kind: string, ns?: string, name?: string): Obj[] {
    const out: Obj[] = [];
    for (const o of this.objs.values()) if (o.kind === kind && (ns === undefined || o.metadata.namespace === ns) && (name === undefined || o.metadata.name === name)) out.push(o);
    return out.sort((a, b) => (a.metadata.namespace ?? '').localeCompare(b.metadata.namespace ?? '') || a.metadata.name.localeCompare(b.metadata.name));
  }

  all(): Obj[] {
    return [...this.objs.values()];
  }

  private nsOf(kind: string, ns: string | undefined): string | undefined {
    const info = this.kinds.byKind(kind);
    if (info && !info.namespaced) return undefined;
    return ns;
  }

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private record(type: Change['type'], obj: Obj): void {
    const c: Change = { rv: this.rv, at: this.now, type, kind: obj.kind, ns: obj.metadata.namespace ?? '', name: obj.metadata.name, summary: summarize(obj) };
    if (obj.kind !== 'Event' && obj.kind !== 'Lease') {
      this.timeline.push(c);
      if (this.timeline.length > 600) this.timeline.splice(0, this.timeline.length - 600);
    }
    for (const fn of this.listeners) fn(c, type === 'DELETED' ? undefined : obj);
  }

  /** Write an object to the store: a new resourceVersion, generation on spec changes. */
  put(obj: Obj, opts: { expectRv?: string } = {}): Obj {
    const k = key(obj.kind, obj.metadata.namespace, obj.metadata.name);
    const prev = this.objs.get(k);
    if (opts.expectRv && prev && prev.metadata.resourceVersion !== opts.expectRv) {
      throw new ApiError(
        409,
        'Conflict',
        `Operation cannot be fulfilled on ${this.pluralOf(obj.kind)} "${obj.metadata.name}": the object has been modified; please apply your changes to the latest version and try again`,
      );
    }
    const next = clone(obj);
    if (prev) {
      next.metadata.uid = prev.metadata.uid;
      next.metadata.creationTimestamp = prev.metadata.creationTimestamp;
      if (prev.metadata.generation !== undefined) {
        const specChanged = !deepEqual(prev.spec, next.spec) || (obj.kind === 'Deployment' && !deepEqual(prev.metadata.annotations?.['kubectl.kubernetes.io/restartedAt'], next.metadata.annotations?.['kubectl.kubernetes.io/restartedAt']));
        next.metadata.generation = prev.metadata.generation + (specChanged ? 1 : 0);
      }
      if (deepEqual({ ...prev, metadata: { ...prev.metadata, resourceVersion: '' } }, { ...next, metadata: { ...next.metadata, resourceVersion: '' } })) return prev;
    } else {
      next.metadata.uid ??= this.rand.uid();
      next.metadata.creationTimestamp ??= iso(this.now);
      if (['StatefulSet', 'Deployment', 'ReplicaSet', 'DaemonSet', 'Job', 'Pod', 'Service', 'Namespace', 'CustomResourceDefinition'].includes(obj.kind) || this.kinds.byKind(obj.kind)?.custom) next.metadata.generation ??= 1;
      if (obj.kind === 'Pod' || obj.kind === 'Service' || obj.kind === 'Namespace' || obj.kind === 'Node' || obj.kind === 'Event') delete next.metadata.generation;
    }
    this.rv++;
    next.metadata.resourceVersion = String(this.rv);
    this.objs.set(k, next);
    this.record(prev ? 'MODIFIED' : 'ADDED', next);
    return next;
  }

  remove(kind: string, ns: string | undefined, name: string): Obj | undefined {
    const k = key(kind, this.nsOf(kind, ns), name);
    const prev = this.objs.get(k);
    if (!prev) return undefined;
    this.objs.delete(k);
    this.rv++;
    if (prev.kind === 'Pod') {
      delete this.runtime[prev.metadata.uid];
      for (const key of Object.keys(this.volumeFiles)) if (key.startsWith(`pod:${prev.metadata.uid}:`)) delete this.volumeFiles[key];
    }
    if (prev.kind === 'PersistentVolume') delete this.volumeFiles[`pv:${prev.metadata.uid}`];
    if (prev.kind === 'CustomResourceDefinition') {
      const info = crdKind(prev);
      if (info) {
        for (const o of this.list(info.kind)) this.remove(info.kind, o.metadata.namespace, o.metadata.name);
        this.kinds.remove(info.kind, info.group);
      }
    }
    this.record('DELETED', { ...prev, metadata: { ...prev.metadata, resourceVersion: String(this.rv) } });
    return prev;
  }

  /** Change status only (the /status subresource controllers and kubelets write). */
  putStatus(obj: Obj, status: Obj): Obj {
    if (deepEqual(obj.status, status)) return obj;
    return this.put({ ...obj, status });
  }

  pluralOf(kind: string): string {
    const info = this.kinds.byKind(kind);
    if (!info) return kind.toLowerCase() + 's';
    return info.group ? `${info.plural}.${info.group}` : info.plural;
  }

  // ── events ──

  event(involved: Obj, type: 'Normal' | 'Warning', reason: string, message: string, source: string, sourceHost?: string): void {
    if (!this.components.apiserver || !this.components.etcd) return;
    const ns = involved.metadata.namespace ?? 'default';
    for (const e of this.list('Event', ns)) {
      if (e.involvedObject.uid === involved.metadata.uid && e.reason === reason && e.message === message) {
        this.put({ ...e, count: (e.count ?? 1) + 1, lastTimestamp: iso(this.now) });
        return;
      }
    }
    const name = `${involved.metadata.name}.${(this.rv + 1).toString(16).padStart(16, '0').slice(-16)}`;
    this.put({
      apiVersion: 'v1',
      kind: 'Event',
      metadata: { name, namespace: ns },
      involvedObject: {
        apiVersion: involved.apiVersion,
        kind: involved.kind,
        name: involved.metadata.name,
        namespace: involved.metadata.namespace,
        uid: involved.metadata.uid,
        resourceVersion: involved.metadata.resourceVersion,
      },
      reason,
      message,
      source: { component: source, ...(sourceHost ? { host: sourceHost } : {}) },
      firstTimestamp: iso(this.now),
      lastTimestamp: iso(this.now),
      count: 1,
      type,
      reportingComponent: source,
      reportingInstance: sourceHost ?? '',
    });
    const events = this.list('Event');
    if (events.length > 400) {
      events.sort((a, b) => Number(a.metadata.resourceVersion) - Number(b.metadata.resourceVersion));
      for (const e of events.slice(0, events.length - 400)) this.objs.delete(key('Event', e.metadata.namespace, e.metadata.name));
    }
  }

  eventsFor(obj: Obj): Obj[] {
    return this.list('Event', obj.metadata.namespace ?? 'default')
      .filter((e) => e.involvedObject.uid === obj.metadata.uid)
      .sort((a, b) => Date.parse(a.firstTimestamp) - Date.parse(b.firstTimestamp) || Number(a.metadata.resourceVersion) - Number(b.metadata.resourceVersion));
  }

  // ── the API server ──

  /** kubectl reaches the API server, or gets the error it would get. */
  reachable(): void {
    if (!this.components.apiserver) throw new ApiError(0, '', 'The connection to the server 127.0.0.1:6443 was refused - did you specify the right host or port?', true);
    if (!this.components.etcd) throw new ApiError(500, 'InternalError', 'Error from server: etcdserver: request timed out', true);
  }

  private sysCreate(obj: Obj): Obj {
    const info = this.kinds.byKind(obj.kind)!;
    const o = applyDefaults(this, clone(obj), info, undefined);
    return this.put(o);
  }

  /** POST: create a new object. */
  create(input: Obj, opts: { dryRun?: boolean; namespace?: string; fieldManager?: string } = {}): Obj {
    this.reachable();
    const obj = clone(input);
    const info = this.resolveManifest(obj);
    obj.apiVersion = apiVersionOf(info);
    obj.metadata ??= {};
    if (info.readOnly) throw new ApiError(405, 'MethodNotAllowed', `the server does not allow this method on the requested resource`);
    if (info.namespaced) {
      const ns = obj.metadata.namespace ?? opts.namespace ?? 'default';
      if (opts.namespace && obj.metadata.namespace && opts.namespace !== obj.metadata.namespace) {
        throw new ApiError(400, 'BadRequest', `the namespace from the provided object "${obj.metadata.namespace}" does not match the namespace "${opts.namespace}". You must pass '--namespace=${obj.metadata.namespace}' to perform this operation.`, true);
      }
      obj.metadata.namespace = ns;
      const nsObj = this.get('Namespace', undefined, ns);
      if (!nsObj) throw new ApiError(404, 'NotFound', `namespaces "${ns}" not found`);
      if (nsObj.metadata.deletionTimestamp && !opts.dryRun)
        throw new ApiError(403, 'Forbidden', `${this.pluralOf(info.kind)} "${obj.metadata.name ?? ''}" is forbidden: unable to create new content in namespace ${ns} because it is being terminated`);
    } else delete obj.metadata.namespace;
    if (!obj.metadata.name && obj.metadata.generateName) obj.metadata.name = obj.metadata.generateName + this.rand.suffix();
    if (!obj.metadata.name) throw new ApiError(422, 'Invalid', `${info.kind} in version "${info.version}" cannot be handled as a ${info.kind}: resource name may not be empty`, false);
    const nameRe = info.kind === 'Namespace' || info.kind === 'Service' ? DNS1123_LABEL : DNS1123_SUBDOMAIN;
    if (!nameRe.test(obj.metadata.name)) {
      const what = nameRe === DNS1123_LABEL ? 'label' : 'subdomain';
      const rule =
        what === 'label'
          ? "a lowercase RFC 1123 label must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character (e.g. 'my-name',  or '123-abc', regex used for validation is '[a-z0-9]([-a-z0-9]*[a-z0-9])?')"
          : "a lowercase RFC 1123 subdomain must consist of lower case alphanumeric characters, '-' or '.', and must start and end with an alphanumeric character (e.g. 'example.com', regex used for validation is '[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*')";
      throw new ApiError(422, 'Invalid', `The ${info.kind} "${obj.metadata.name}" is invalid: metadata.name: Invalid value: "${obj.metadata.name}": ${rule}`, true);
    }
    if (this.get(info.kind, obj.metadata.namespace, obj.metadata.name)) throw new ApiError(409, 'AlreadyExists', `${this.pluralOf(info.kind)} "${obj.metadata.name}" already exists`);
    delete obj.metadata.resourceVersion;
    delete obj.metadata.uid;
    delete obj.metadata.creationTimestamp;
    if (info.kind !== 'Node') delete obj.status;
    const defaulted = applyDefaults(this, obj, info, undefined);
    if (info.kind === 'Pod' && !this.get('ServiceAccount', obj.metadata.namespace, defaulted.spec.serviceAccountName)) throw new ApiError(403, 'Forbidden', `pods "${obj.metadata.name}" is forbidden: error looking up service account ${obj.metadata.namespace}/${defaulted.spec.serviceAccountName}: serviceaccount "${defaulted.spec.serviceAccountName}" not found`);
    validate(this, defaulted, info, undefined);
    if (opts.dryRun) return { ...defaulted, metadata: { ...defaulted.metadata, uid: this.rand.uid(), creationTimestamp: iso(this.now) } };
    const stored = this.put(defaulted);
    if (info.kind === 'CustomResourceDefinition') this.registerCrd(stored);
    this.settle();
    return this.get(info.kind, stored.metadata.namespace, stored.metadata.name) ?? stored;
  }

  /** PUT: replace an existing object (kubectl replace, edit, controllers). */
  replace(input: Obj, opts: { dryRun?: boolean } = {}): Obj {
    this.reachable();
    const info = this.resolveManifest(input);
    const ns = info.namespaced ? (input.metadata?.namespace ?? 'default') : undefined;
    const prev = this.get(info.kind, ns, input.metadata.name);
    if (!prev) throw new ApiError(404, 'NotFound', `${this.pluralOf(info.kind)} "${input.metadata.name}" not found`);
    const obj = clone(input);
    obj.metadata.namespace = ns;
    if (ns === undefined) delete obj.metadata.namespace;
    obj.status = prev.status;
    const defaulted = applyDefaults(this, obj, info, prev);
    validate(this, defaulted, info, prev);
    if (opts.dryRun) return defaulted;
    const stored = this.put(defaulted, { expectRv: input.metadata.resourceVersion });
    this.settle();
    return stored;
  }

  /**
   * kubectl apply (client side): create, or a three-way merge of the last
   * applied configuration, the live object and the new manifest — so fields
   * set by `kubectl scale` survive an apply that does not mention them.
   */
  apply(input: Obj, opts: { dryRun?: boolean; namespace?: string } = {}): { obj: Obj; result: 'created' | 'configured' | 'unchanged' } {
    this.reachable();
    const desired = clone(input);
    const info = this.resolveManifest(desired);
    desired.metadata ??= {};
    const ns = info.namespaced ? (desired.metadata.namespace ?? opts.namespace ?? 'default') : undefined;
    const lastApplied = JSON.stringify(sortKeysDeep({ ...desired, metadata: { ...desired.metadata, ...(info.namespaced ? { namespace: ns } : {}) } }));
    const annotated = { ...desired, metadata: { ...desired.metadata, annotations: { ...(desired.metadata.annotations ?? {}), 'kubectl.kubernetes.io/last-applied-configuration': lastApplied + '\n' } } };
    const live = this.get(info.kind, ns, desired.metadata.name ?? '');
    if (!live) return { obj: this.create(annotated, { dryRun: opts.dryRun, namespace: opts.namespace }), result: 'created' };
    const prevApplied = parseJson(live.metadata.annotations?.['kubectl.kubernetes.io/last-applied-configuration']) ?? {};
    const merged = threeWay(clone(live), prevApplied, annotated) as Obj;
    merged.metadata.namespace = ns;
    if (ns === undefined) delete merged.metadata.namespace;
    const defaulted = applyDefaults(this, merged, info, live);
    validate(this, defaulted, info, live);
    const same = deepEqual({ ...defaulted, metadata: { ...defaulted.metadata, resourceVersion: '' } }, { ...live, metadata: { ...live.metadata, resourceVersion: '' } });
    if (opts.dryRun) return { obj: defaulted, result: same ? 'unchanged' : 'configured' };
    if (same) return { obj: live, result: 'unchanged' };
    const stored = this.put(defaulted);
    this.settle();
    return { obj: stored, result: 'configured' };
  }

  /** PATCH (merge patch; strategic merge is the same for the fields the course uses). */
  patch(kind: string, ns: string | undefined, name: string, patch: Obj, opts: { dryRun?: boolean; status?: boolean; strategic?: boolean } = {}): Obj {
    this.reachable();
    const info = this.kinds.byKind(kind)!;
    const prev = this.get(kind, ns, name);
    if (!prev) throw new ApiError(404, 'NotFound', `${this.pluralOf(kind)} "${name}" not found`);
    const merged = (opts.strategic ? strategicMerge(prev, patch) : mergePatch(prev, patch)) as Obj;
    if (!opts.status) merged.status = prev.status;
    const defaulted = applyDefaults(this, merged, info, prev);
    validate(this, defaulted, info, prev);
    if (opts.dryRun) return defaulted;
    const stored = this.put(defaulted);
    this.settle();
    return stored;
  }

  /**
   * DELETE. Pods get a deletionTimestamp and are removed by their kubelet
   * after the grace period; namespaces go Terminating until the namespace
   * controller empties them; dependents follow their owner through the
   * garbage collector (background), or lose the ownerReference (orphan).
   */
  delete(kind: string, ns: string | undefined, name: string, opts: { cascade?: 'background' | 'foreground' | 'orphan'; grace?: number; force?: boolean; dryRun?: boolean } = {}): Obj {
    this.reachable();
    const obj = this.get(kind, ns, name);
    if (!obj) throw new ApiError(404, 'NotFound', `${this.pluralOf(kind)} "${name}" not found`);
    if (opts.dryRun) return obj;
    if (opts.cascade === 'orphan') {
      for (const dep of this.all()) {
        const refs = dep.metadata.ownerReferences as Obj[] | undefined;
        if (refs?.some((r) => r.uid === obj.metadata.uid)) this.put({ ...dep, metadata: { ...dep.metadata, ownerReferences: refs.filter((r) => r.uid !== obj.metadata.uid) } });
      }
    }
    if (kind === 'Pod') {
      const grace = opts.force ? 0 : (opts.grace ?? obj.spec.terminationGracePeriodSeconds ?? 30);
      if (!obj.spec.nodeName || grace === 0 || obj.status?.phase === 'Succeeded' || obj.status?.phase === 'Failed') this.remove('Pod', ns, name);
      else if (!obj.metadata.deletionTimestamp) this.put({ ...obj, metadata: { ...obj.metadata, deletionTimestamp: iso(this.now + grace * 1000), deletionGracePeriodSeconds: grace } });
    } else if (kind === 'Namespace') {
      if (['default', 'kube-system', 'kube-public', 'kube-node-lease'].includes(name)) throw new ApiError(403, 'Forbidden', `namespaces "${name}" is forbidden: this namespace may not be deleted`);
      if (!obj.metadata.deletionTimestamp) this.put({ ...obj, metadata: { ...obj.metadata, deletionTimestamp: iso(this.now) }, spec: { finalizers: ['kubernetes'] }, status: { phase: 'Terminating' } });
    } else this.remove(kind, ns, name);
    this.settle();
    return obj;
  }

  /** Resolve kind + apiVersion of a manifest or throw the error kubectl prints. */
  resolveManifest(obj: Obj): KindInfo {
    if (!isObj(obj) || !obj.kind || !obj.apiVersion) throw new ApiError(400, 'BadRequest', 'error validating data: [apiVersion not set, kind not set]; if you choose to ignore these errors, turn validation off with --validate=false', true);
    const info = this.kinds.byKind(obj.kind, obj.apiVersion);
    if (!info) {
      const anyVersion = this.kinds.byKind(obj.kind);
      const hint = anyVersion ? ` (this kind is served as ${apiVersionOf(anyVersion)})` : '';
      throw new ApiError(
        404,
        'NotFound',
        `resource mapping not found for name: "${obj.metadata?.name ?? ''}" namespace: "${obj.metadata?.namespace ?? ''}" from "STDIN": no matches for kind "${obj.kind}" in version "${obj.apiVersion}"\nensure CRDs are installed first${hint}`,
        true,
      );
    }
    return info;
  }

  private registerCrd(crd: Obj): void {
    const info = crdKind(crd);
    if (!info) return;
    this.kinds.add(info);
    this.put({ ...crd, status: { acceptedNames: crd.spec.names, conditions: [{ type: 'Established', status: 'True', reason: 'InitialNamesAccepted', message: 'the initial names have been accepted', lastTransitionTime: iso(this.now) }], storedVersions: [info.version] } });
  }

  // ── nodes ──

  node(name: string): NodeSim | undefined {
    return this.nodes.find((n) => n.name === name);
  }

  nodeAlive(n: NodeSim): boolean {
    return n.power && n.kubelet;
  }

  renewLease(n: NodeSim): void {
    n.lastLease = this.now;
    const lease = this.get('Lease', 'kube-node-lease', n.name);
    if (lease) this.put({ ...lease, spec: { ...lease.spec, renewTime: iso(this.now) } });
  }

  allocateIp(n: NodeSim): string {
    const base = n.podCIDR.replace(/\.0\/24$/, '');
    const used = new Set(Object.values(this.runtime).filter((r) => r.node === n.name && r.ip).map((r) => r.ip));
    for (let i = 0; i < 250; i++) {
      const ip = `${base}.${n.nextIp}`;
      n.nextIp = n.nextIp >= 254 ? 2 : n.nextIp + 1;
      if (!used.has(ip)) return ip;
    }
    return `${base}.254`;
  }

  allocateClusterIP(): string {
    const used = new Set(this.list('Service').map((s) => s.spec.clusterIP));
    for (;;) {
      const n = this.nextClusterIP;
      this.nextClusterIP += 37;
      const ip = `10.43.${Math.floor(n / 250) % 250}.${(n % 250) + 2}`;
      if (!used.has(ip)) return ip;
    }
  }

  allocateNodePort(): number {
    const used = new Set(this.list('Service').flatMap((s) => (s.spec.ports ?? []).map((p: Obj) => p.nodePort)));
    while (used.has(this.nextNodePort)) this.nextNodePort++;
    return this.nextNodePort++;
  }

  // ── the clock ──

  /** Move virtual time forward; controllers, the scheduler and kubelets run every second. */
  advance(ms: number): void {
    const target = this.now + Math.max(0, ms);
    while (this.now < target) {
      this.now = Math.min(target, this.now + 1000);
      this.tick();
    }
  }

  /** Sync with the machine clock (real seconds pass as virtual seconds, at most a minute at a time). */
  syncReal(machineNow: number): void {
    if (this.lastReal === null) {
      this.lastReal = machineNow;
      return;
    }
    const d = Math.min(60_000, Math.max(0, machineNow - this.lastReal));
    this.lastReal = machineNow;
    if (d >= 250) this.advance(d);
  }

  /** Run every loop at the current time until nothing changes (after a write). */
  settle(): void {
    if (this.inLoop) return;
    this.tick();
  }

  private tick(): void {
    if (this.inLoop) return;
    this.inLoop = true;
    try {
      for (let pass = 0; pass < 30; pass++) {
        const before = this.rv;
        runKubelets(this);
        if (this.components.apiserver && this.components.etcd) {
          if (this.components['controller-manager']) runControllers(this);
          if (this.components.scheduler) runScheduler(this);
          runAddons(this);
        }
        if ((this.components['kube-proxy'] || (this.addons?.proxyReplacement && this.components.cni)) && this.components.apiserver) this.proxy = proxyTable(this);
        if (this.rv === before) break;
      }
    } finally {
      this.inLoop = false;
    }
  }

  // ── snapshot ──

  snapshot(): ClusterState {
    return clone({
      v: 1,
      now: this.now,
      rv: this.rv,
      seed: this.rand.seed,
      objects: [...this.objs.values()],
      timeline: this.timeline,
      components: this.components,
      nodes: this.nodes,
      runtime: this.runtime,
      proxy: this.proxy,
      forwards: this.forwards,
      rr: this.rr,
      custom: this.kinds.custom(),
      lastReal: this.lastReal,
      nextClusterIP: this.nextClusterIP,
      nextNodePort: this.nextNodePort,
      addons: this.addons,
      volumeFiles: this.volumeFiles,
      helmRepos: this.helmRepos,
      authorizationDecisions: this.authorizationDecisions,
    } satisfies ClusterState);
  }

  restore(raw: unknown): void {
    const s = clone(raw as ClusterState);
    if (!s || s.v !== 1) return;
    this.now = s.now;
    this.rv = s.rv;
    this.rand = new Rand(s.seed);
    this.objs = new Map(s.objects.map((o) => [key(o.kind, o.metadata.namespace, o.metadata.name), o]));
    this.timeline = s.timeline;
    this.components = s.components;
    this.nodes = s.nodes;
    this.runtime = s.runtime;
    this.proxy = s.proxy;
    this.forwards = s.forwards;
    this.rr = s.rr;
    this.kinds = new KindTable(s.custom);
    this.lastReal = s.lastReal;
    this.nextClusterIP = s.nextClusterIP;
    this.nextNodePort = s.nextNodePort;
    this.addons = s.addons ?? null;
    this.volumeFiles = s.volumeFiles ?? {};
    this.helmRepos = s.helmRepos ?? {};
    this.authorizationDecisions = s.authorizationDecisions ?? [];
  }

  /** Image behaviour for a container, with the node cache. */
  image(ref: string) {
    return lookupImage(ref);
  }
}

export function nodeStatus(n: NodeSim, ready: boolean | 'unknown', now: number, why?: { reason: string; message: string }): Obj {
  const t = iso(now);
  const cond = (type: string, status: string, reason: string, message: string) => ({ type, status, reason, message, lastHeartbeatTime: t, lastTransitionTime: t });
  const readyCond =
    ready === 'unknown'
      ? cond('Ready', 'Unknown', 'NodeStatusUnknown', 'Kubelet stopped posting node status.')
      : ready
        ? cond('Ready', 'True', 'KubeletReady', 'kubelet is posting ready status')
        : cond('Ready', 'False', why?.reason ?? 'KubeletNotReady', why?.message ?? 'container runtime is down');
  const pressure = (type: string, reason: string, message: string) => (ready === 'unknown' ? cond(type, 'Unknown', 'NodeStatusUnknown', 'Kubelet stopped posting node status.') : cond(type, 'False', reason, message));
  return {
    addresses: [
      { type: 'InternalIP', address: n.ip },
      { type: 'Hostname', address: n.name },
    ],
    allocatable: { cpu: n.cpu, 'ephemeral-storage': '19586931083', memory: n.memory, pods: '110' },
    capacity: { cpu: n.cpu, 'ephemeral-storage': '20134592Ki', memory: n.memory, pods: '110' },
    conditions: [
      pressure('MemoryPressure', 'KubeletHasSufficientMemory', 'kubelet has sufficient memory available'),
      pressure('DiskPressure', 'KubeletHasNoDiskPressure', 'kubelet has no disk pressure'),
      pressure('PIDPressure', 'KubeletHasSufficientPID', 'kubelet has sufficient PID available'),
      readyCond,
    ],
    daemonEndpoints: { kubeletEndpoint: { Port: 10250 } },
    nodeInfo: {
      architecture: 'amd64',
      containerRuntimeVersion: 'containerd://2.1.4-k3s1',
      kernelVersion: '6.8.0-88-generic',
      kubeProxyVersion: K8S_VERSION,
      kubeletVersion: K8S_VERSION,
      operatingSystem: 'linux',
      osImage: 'Ubuntu 24.04.3 LTS',
      machineID: (n.name + '0000000000000000000000000000').slice(0, 32).replace(/[^0-9a-f]/g, 'a'),
    },
    images: n.images.map((i) => ({ names: [i], sizeBytes: lookupImage(i)?.size ?? 1_000_000 })),
  };
}

/** The table kube-proxy programs: ClusterIP:port → ready endpoints. */
export function proxyTable(c: Cluster): ProxyTable {
  const services: ProxyTable['services'] = {};
  const slices = c.list('EndpointSlice');
  for (const svc of c.list('Service')) {
    if (!svc.spec.clusterIP || svc.spec.clusterIP === 'None') continue;
    for (const p of svc.spec.ports ?? []) {
      const eps: string[] = [];
      for (const sl of slices) {
        if (sl.metadata.namespace !== svc.metadata.namespace || sl.metadata.labels?.['kubernetes.io/service-name'] !== svc.metadata.name) continue;
        const sp = (sl.ports ?? []).find((x: Obj) => (x.name ?? '') === (p.name ?? '') && (x.protocol ?? 'TCP') === (p.protocol ?? 'TCP'));
        if (!sp) continue;
        for (const e of sl.endpoints ?? []) if (e.conditions?.ready !== false) eps.push(`${e.addresses[0]}:${sp.port}`);
      }
      services[`${svc.metadata.namespace}/${svc.metadata.name}:${p.name ?? ''}:${p.protocol ?? 'TCP'}`] = {
        clusterIP: svc.spec.clusterIP,
        port: p.port,
        protocol: p.protocol ?? 'TCP',
        nodePort: p.nodePort,
        endpoints: eps,
        portName: p.name,
      };
    }
  }
  return { services, syncedAt: c.now };
}

function crdKind(crd: Obj): KindInfo | undefined {
  const s = crd.spec;
  if (!s?.names?.kind || !s.group) return undefined;
  const version = (s.versions ?? []).find((v: Obj) => v.served !== false)?.name ?? 'v1';
  return {
    kind: s.names.kind,
    group: s.group,
    version,
    plural: s.names.plural ?? s.names.kind.toLowerCase() + 's',
    singular: s.names.singular ?? s.names.kind.toLowerCase(),
    short: s.names.shortNames ?? [],
    namespaced: (s.scope ?? 'Namespaced') === 'Namespaced',
    custom: true,
  };
}

function summarize(o: Obj): Record<string, unknown> | undefined {
  switch (o.kind) {
    case 'Pod':
      return { phase: o.status?.phase, node: o.spec?.nodeName, ready: o.status?.conditions?.find((c: Obj) => c.type === 'Ready')?.status === 'True', terminating: !!o.metadata.deletionTimestamp };
    case 'Deployment':
    case 'ReplicaSet':
      return { replicas: o.spec?.replicas, readyReplicas: o.status?.readyReplicas ?? 0, availableReplicas: o.status?.availableReplicas ?? 0, updatedReplicas: o.status?.updatedReplicas };
    case 'Node':
      return { ready: o.status?.conditions?.find((c: Obj) => c.type === 'Ready')?.status };
    default:
      return undefined;
  }
}

function parseJson(s: string | undefined): Obj | undefined {
  if (!s) return undefined;
  try {
    return JSON.parse(s) as Obj;
  } catch {
    return undefined;
  }
}

function sortKeysDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (isObj(v)) return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeysDeep(v[k])]));
  return v;
}

/**
 * The three-way merge of client-side apply: keys in `desired` win, keys that
 * were in `last` but are gone from `desired` are removed, everything else
 * stays as it is live (status, fields other actors set).
 */
export function threeWay(live: unknown, last: unknown, desired: unknown): unknown {
  if (!isObj(desired) || !isObj(live)) return clone(desired);
  const out: Obj = { ...live };
  const prev = isObj(last) ? last : {};
  for (const [k, v] of Object.entries(desired)) out[k] = isObj(v) && isObj(out[k]) ? threeWay(out[k], prev[k], v) : clone(v);
  for (const k of Object.keys(prev)) if (!(k in desired) && k !== 'status') delete out[k];
  return out;
}

export { getPath };
