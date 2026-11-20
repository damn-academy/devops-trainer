// Cluster add-ons (05 §6.2, the layered constructor): what a platform team
// installs on top of a bare Kubernetes so that a site is reachable from the
// office by name, a database gets a disk, HTTPS has a certificate, a
// Deployment scales by load, the cluster follows a Git repository and an
// alert fires. Each add-on is installed the way it is in life — a namespace,
// its CRDs, Deployments or DaemonSets, a Service — and its controller works
// only while its pod runs: remove the add-on and the objects it served stay
// in the API, but nobody acts on them, so the symptom is the real one.
//
//  metallb            — EXTERNAL-IP for Services of type LoadBalancer, ARP on the office network
//  traefik            — Gateway API (Gateway, HTTPRoute) and Ingress → HTTP routing by host and path, TLS from Secrets
//  csi-hostpath       — the StorageClass and the CSI provisioner: a PVC gets a PV
//  cert-manager       — Certificate → a Secret of type kubernetes.io/tls signed by the office CA
//  metrics-server     — the Metrics API: kubectl top and the HPA controller
//  flux               — source-controller and kustomize-controller: Git → the cluster, drift reverted
//  prometheus, node-exporter, kube-state-metrics — scrape targets and alerts
//
// The PV binder and the HPA controller are part of kube-controller-manager,
// so they run here only while it runs.

import type { Cluster } from './cluster';
import { controllerOf, podReady, resolveTargetPort } from './controllers';
import { parseManifests } from './manifests';
import { httpFrom, podByIp, type HttpResult } from './network';
import { podServing } from './kubelet';
import { bytes, clone, cpuMilli, deepEqual, fnv32a, hex, iso, sha256, type Obj } from './util';

export type AddonId = 'metallb' | 'traefik' | 'csi-hostpath' | 'cert-manager' | 'metrics-server' | 'flux' | 'prometheus' | 'node-exporter' | 'kube-state-metrics';
export const ADDON_IDS: AddonId[] = ['metallb', 'traefik', 'csi-hostpath', 'cert-manager', 'metrics-server', 'flux', 'prometheus', 'node-exporter', 'kube-state-metrics'];

export interface GitCommit {
  sha: string;
  message: string;
  at: number;
  /** The whole tree at this commit: path → content. */
  files: Record<string, string>;
}

export interface AddonState {
  installed: AddonId[];
  /** The CNI routes Services itself (Cilium with kubeProxyReplacement). */
  proxyReplacement: boolean;
  /** The repository Flux watches (main branch, newest commit last). */
  git: GitCommit[];
  /** CPU (millicores) the users' requests cost the pods of a Deployment together: "ns/name" → m. */
  load: Record<string, number>;
  /** Alert key → when its condition first held. */
  alerts: Record<string, number>;
  /** Scrape target → when it first failed (for TargetDown). */
  down: Record<string, number>;
  lastScrape: number;
  hpaSyncAt: number;
  /** HPA "ns/name" → the recommendations of the last five minutes and the last sync. */
  hpa: Record<string, { at: number; recs: { at: number; n: number }[] }>;
  flux: { fetchedAt: number; appliedAt: number; fetched?: string; applied?: string; inventory: string[] };
}

export const LB_POOL = { from: 240, to: 250, prefix: '192.168.56.' };
/** The office DNS: every name under .example points at the first address of the MetalLB pool. */
export const OFFICE_DOMAIN = '.example';
export const OFFICE_IP = `${LB_POOL.prefix}${LB_POOL.from}`;
export const GIT_URL = 'https://git.example.com/team/cluster.git';
export const HTTPS_CA = 'office-ca';

export function newAddonState(installed: AddonId[] = [], proxyReplacement = false): AddonState {
  return {
    installed: [...installed],
    proxyReplacement,
    git: [{ sha: commitSha('initial', {}, 0), message: 'Initial commit: an empty apps directory', at: 0, files: { 'apps/.keep': '' } }],
    load: {},
    alerts: {},
    down: {},
    lastScrape: 0,
    hpaSyncAt: 0,
    hpa: {},
    flux: { fetchedAt: 0, appliedAt: 0, inventory: [] },
  };
}

function commitSha(message: string, files: Record<string, string>, at: number): string {
  return hex(sha256(`${message}\n${at}\n${JSON.stringify(files)}`)).slice(0, 40);
}

export const has = (c: Cluster, id: AddonId) => !!c.addons?.installed.includes(id);

// ── images of the add-ons (the course registry knows them) ──

export const ADDON_IMAGES = {
  metallbController: 'quay.io/metallb/controller:v0.15.2',
  metallbSpeaker: 'quay.io/metallb/speaker:v0.15.2',
  traefik: 'traefik:v3.6.1',
  csi: 'registry.k8s.io/sig-storage/hostpathplugin:v1.17.0',
  certManager: 'quay.io/jetstack/cert-manager-controller:v1.19.1',
  certWebhook: 'quay.io/jetstack/cert-manager-webhook:v1.19.1',
  metricsServer: 'registry.k8s.io/metrics-server/metrics-server:v0.8.0',
  source: 'ghcr.io/fluxcd/source-controller:v1.7.3',
  kustomize: 'ghcr.io/fluxcd/kustomize-controller:v1.7.2',
  prometheus: 'quay.io/prometheus/prometheus:v3.7.3',
  nodeExporter: 'quay.io/prometheus/node-exporter:v1.10.2',
  ksm: 'registry.k8s.io/kube-state-metrics/kube-state-metrics:v2.17.0',
};

// ── installation ──

const crd = (group: string, kind: string, plural: string, short: string[], scope: 'Namespaced' | 'Cluster', version = 'v1'): Obj => ({
  apiVersion: 'apiextensions.k8s.io/v1',
  kind: 'CustomResourceDefinition',
  metadata: { name: `${plural}.${group}` },
  spec: {
    group,
    names: { kind, plural, singular: kind.toLowerCase(), shortNames: short, listKind: `${kind}List` },
    scope,
    versions: [{ name: version, served: true, storage: true, schema: { openAPIV3Schema: { type: 'object', 'x-kubernetes-preserve-unknown-fields': true } } }],
  },
});

const workload = (kind: 'Deployment' | 'DaemonSet', ns: string, name: string, labels: Record<string, string>, image: string, ports: number[], extra: Obj = {}): Obj => ({
  apiVersion: 'apps/v1',
  kind,
  metadata: { name, namespace: ns, labels },
  spec: {
    ...(kind === 'Deployment' ? { replicas: 1 } : {}),
    selector: { matchLabels: labels },
    template: {
      metadata: { labels },
      spec: {
        tolerations: [{ key: 'node-role.kubernetes.io/control-plane', operator: 'Exists', effect: 'NoSchedule' }],
        containers: [{ name: extra.container ?? name, image, ports: ports.map((p) => ({ containerPort: p, protocol: 'TCP' })), ...(extra.args ? { args: extra.args } : {}) }],
      },
    },
  },
});

const ns = (name: string): Obj => ({ apiVersion: 'v1', kind: 'Namespace', metadata: { name, labels: { 'kubernetes.io/metadata.name': name } } });

/** The objects an installer (helm install / kubectl apply of the release manifests) creates for each add-on. */
export function addonManifests(id: AddonId): Obj[] {
  switch (id) {
    case 'metallb':
      return [
        ns('metallb-system'),
        crd('metallb.io', 'IPAddressPool', 'ipaddresspools', [], 'Namespaced', 'v1beta1'),
        crd('metallb.io', 'L2Advertisement', 'l2advertisements', [], 'Namespaced', 'v1beta1'),
        workload('Deployment', 'metallb-system', 'controller', { app: 'metallb', component: 'controller' }, ADDON_IMAGES.metallbController, [7472]),
        workload('DaemonSet', 'metallb-system', 'speaker', { app: 'metallb', component: 'speaker' }, ADDON_IMAGES.metallbSpeaker, [7472]),
        { apiVersion: 'metallb.io/v1beta1', kind: 'IPAddressPool', metadata: { name: 'office', namespace: 'metallb-system' }, spec: { addresses: [`${LB_POOL.prefix}${LB_POOL.from}-${LB_POOL.prefix}${LB_POOL.to}`], autoAssign: true } },
        { apiVersion: 'metallb.io/v1beta1', kind: 'L2Advertisement', metadata: { name: 'office', namespace: 'metallb-system' }, spec: { ipAddressPools: ['office'] } },
      ];
    case 'traefik': {
      const labels = { 'app.kubernetes.io/name': 'traefik', 'app.kubernetes.io/instance': 'traefik-traefik' };
      return [
        ns('traefik'),
        crd('gateway.networking.k8s.io', 'GatewayClass', 'gatewayclasses', ['gc'], 'Cluster'),
        crd('gateway.networking.k8s.io', 'Gateway', 'gateways', ['gtw'], 'Namespaced'),
        crd('gateway.networking.k8s.io', 'HTTPRoute', 'httproutes', [], 'Namespaced'),
        { apiVersion: 'networking.k8s.io/v1', kind: 'IngressClass', metadata: { name: 'traefik', annotations: { 'ingressclass.kubernetes.io/is-default-class': 'true' } }, spec: { controller: 'traefik.io/ingress-controller' } },
        { apiVersion: 'gateway.networking.k8s.io/v1', kind: 'GatewayClass', metadata: { name: 'traefik' }, spec: { controllerName: 'traefik.io/gateway-controller' } },
        { apiVersion: 'gateway.networking.k8s.io/v1', kind: 'Gateway', metadata: { name: 'traefik-gateway', namespace: 'traefik' }, spec: { gatewayClassName: 'traefik', listeners: [{ name: 'web', port: 8000, protocol: 'HTTP', allowedRoutes: { namespaces: { from: 'All' } } }] } },
        workload('Deployment', 'traefik', 'traefik', labels, ADDON_IMAGES.traefik, [8000, 8443, 8080], { args: ['--entryPoints.web.address=:8000/tcp', '--entryPoints.websecure.address=:8443/tcp', '--providers.kubernetesingress', '--providers.kubernetesgateway', '--ping=true'] }),
        {
          apiVersion: 'v1',
          kind: 'Service',
          metadata: { name: 'traefik', namespace: 'traefik', labels },
          spec: {
            type: 'LoadBalancer',
            selector: labels,
            ports: [
              { name: 'web', port: 80, protocol: 'TCP', targetPort: 8000 },
              { name: 'websecure', port: 443, protocol: 'TCP', targetPort: 8443 },
            ],
          },
        },
      ];
    }
    case 'csi-hostpath':
      return [
        workload('Deployment', 'kube-system', 'csi-hostpathplugin', { 'app.kubernetes.io/name': 'csi-hostpathplugin' }, ADDON_IMAGES.csi, [9898], { container: 'hostpath' }),
        {
          apiVersion: 'storage.k8s.io/v1',
          kind: 'StorageClass',
          metadata: { name: 'csi-hostpath-sc', annotations: { 'storageclass.kubernetes.io/is-default-class': 'true' } },
          provisioner: 'hostpath.csi.k8s.io',
          reclaimPolicy: 'Delete',
          volumeBindingMode: 'Immediate',
          allowVolumeExpansion: true,
        },
      ];
    case 'cert-manager':
      return [
        ns('cert-manager'),
        crd('cert-manager.io', 'Certificate', 'certificates', ['cert', 'certs'], 'Namespaced'),
        crd('cert-manager.io', 'CertificateRequest', 'certificaterequests', ['cr', 'crs'], 'Namespaced'),
        crd('cert-manager.io', 'ClusterIssuer', 'clusterissuers', [], 'Cluster'),
        workload('Deployment', 'cert-manager', 'cert-manager', { 'app.kubernetes.io/name': 'cert-manager', 'app.kubernetes.io/component': 'controller' }, ADDON_IMAGES.certManager, [9402], { container: 'cert-manager-controller', args: ['--cluster-resource-namespace=$(POD_NAMESPACE)', '--enable-gateway-api'] }),
        workload('Deployment', 'cert-manager', 'cert-manager-webhook', { 'app.kubernetes.io/name': 'webhook', 'app.kubernetes.io/component': 'webhook' }, ADDON_IMAGES.certWebhook, [10250], { container: 'cert-manager-webhook' }),
        { apiVersion: 'v1', kind: 'Secret', metadata: { name: HTTPS_CA, namespace: 'cert-manager' }, type: 'kubernetes.io/tls', data: { 'tls.crt': 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk9GRklDRS1DQQotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0tCg==', 'tls.key': 'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk9GRklDRS1DQS1LRVkKLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLQo=' } },
        { apiVersion: 'cert-manager.io/v1', kind: 'ClusterIssuer', metadata: { name: HTTPS_CA }, spec: { ca: { secretName: HTTPS_CA } } },
      ];
    case 'metrics-server':
      return [
        workload('Deployment', 'kube-system', 'metrics-server', { 'k8s-app': 'metrics-server' }, ADDON_IMAGES.metricsServer, [10250], { args: ['--cert-dir=/tmp', '--secure-port=10250', '--kubelet-preferred-address-types=InternalIP', '--metric-resolution=15s'] }),
        { apiVersion: 'v1', kind: 'Service', metadata: { name: 'metrics-server', namespace: 'kube-system', labels: { 'k8s-app': 'metrics-server' } }, spec: { selector: { 'k8s-app': 'metrics-server' }, ports: [{ name: 'https', port: 443, protocol: 'TCP', targetPort: 10250 }] } },
      ];
    case 'flux':
      return [
        ns('flux-system'),
        crd('source.toolkit.fluxcd.io', 'GitRepository', 'gitrepositories', ['gitrepo'], 'Namespaced'),
        crd('kustomize.toolkit.fluxcd.io', 'Kustomization', 'kustomizations', ['ks'], 'Namespaced'),
        workload('Deployment', 'flux-system', 'source-controller', { app: 'source-controller' }, ADDON_IMAGES.source, [9090], { container: 'manager' }),
        workload('Deployment', 'flux-system', 'kustomize-controller', { app: 'kustomize-controller' }, ADDON_IMAGES.kustomize, [8080], { container: 'manager' }),
        { apiVersion: 'source.toolkit.fluxcd.io/v1', kind: 'GitRepository', metadata: { name: 'flux-system', namespace: 'flux-system' }, spec: { interval: '1m0s', ref: { branch: 'main' }, url: GIT_URL } },
        { apiVersion: 'kustomize.toolkit.fluxcd.io/v1', kind: 'Kustomization', metadata: { name: 'apps', namespace: 'flux-system' }, spec: { interval: '5m0s', path: './apps', prune: true, sourceRef: { kind: 'GitRepository', name: 'flux-system' } } },
      ];
    case 'prometheus':
      return [
        ns('monitoring'),
        workload('Deployment', 'monitoring', 'prometheus', { 'app.kubernetes.io/name': 'prometheus' }, ADDON_IMAGES.prometheus, [9090], { args: ['--config.file=/etc/prometheus/prometheus.yml', '--storage.tsdb.retention.time=15d'] }),
        { apiVersion: 'v1', kind: 'Service', metadata: { name: 'prometheus', namespace: 'monitoring', labels: { 'app.kubernetes.io/name': 'prometheus' } }, spec: { selector: { 'app.kubernetes.io/name': 'prometheus' }, ports: [{ name: 'web', port: 9090, protocol: 'TCP', targetPort: 9090 }] } },
      ];
    case 'node-exporter':
      return [ns('monitoring'), workload('DaemonSet', 'monitoring', 'node-exporter', { 'app.kubernetes.io/name': 'node-exporter' }, ADDON_IMAGES.nodeExporter, [9100])];
    case 'kube-state-metrics':
      return [
        ns('monitoring'),
        workload('Deployment', 'monitoring', 'kube-state-metrics', { 'app.kubernetes.io/name': 'kube-state-metrics' }, ADDON_IMAGES.ksm, [8080, 8081]),
        { apiVersion: 'v1', kind: 'Service', metadata: { name: 'kube-state-metrics', namespace: 'monitoring', labels: { 'app.kubernetes.io/name': 'kube-state-metrics' } }, spec: { selector: { 'app.kubernetes.io/name': 'kube-state-metrics' }, ports: [{ name: 'http-metrics', port: 8080, protocol: 'TCP', targetPort: 8080 }] } },
      ];
  }
}

/** Install the add-ons into a cluster whose control plane runs (at boot). */
export function installAddons(c: Cluster, ids: AddonId[]): void {
  const order = ADDON_IDS.filter((id) => ids.includes(id));
  for (const id of order) {
    for (const o of addonManifests(id)) {
      if (c.get(o.kind, o.metadata.namespace, o.metadata.name)) continue;
      try {
        c.create(o, { namespace: o.metadata.namespace });
      } catch (e) {
        console.warn(`add-on ${id}: ${o.kind}/${o.metadata.name}: ${(e as Error).message}`);
      }
    }
  }
}

// ── is an add-on working right now ──

const SELECTORS: Record<string, { ns: string; key: string; value: string }> = {
  'metallb-controller': { ns: 'metallb-system', key: 'component', value: 'controller' },
  'metallb-speaker': { ns: 'metallb-system', key: 'component', value: 'speaker' },
  traefik: { ns: 'traefik', key: 'app.kubernetes.io/name', value: 'traefik' },
  'csi-hostpath': { ns: 'kube-system', key: 'app.kubernetes.io/name', value: 'csi-hostpathplugin' },
  'cert-manager': { ns: 'cert-manager', key: 'app.kubernetes.io/name', value: 'cert-manager' },
  'metrics-server': { ns: 'kube-system', key: 'k8s-app', value: 'metrics-server' },
  'source-controller': { ns: 'flux-system', key: 'app', value: 'source-controller' },
  'kustomize-controller': { ns: 'flux-system', key: 'app', value: 'kustomize-controller' },
  prometheus: { ns: 'monitoring', key: 'app.kubernetes.io/name', value: 'prometheus' },
  'node-exporter': { ns: 'monitoring', key: 'app.kubernetes.io/name', value: 'node-exporter' },
  'kube-state-metrics': { ns: 'monitoring', key: 'app.kubernetes.io/name', value: 'kube-state-metrics' },
};

export function addonPods(c: Cluster, which: keyof typeof SELECTORS | string): Obj[] {
  const s = SELECTORS[which];
  if (!s) return [];
  return c.list('Pod', s.ns).filter((p) => p.metadata.labels?.[s.key] === s.value && !p.metadata.deletionTimestamp);
}

/** At least one pod of the add-on's workload runs and is Ready. */
export function running(c: Cluster, which: string): boolean {
  const base = which.startsWith('metallb') ? 'metallb' : which.endsWith('-controller') ? 'flux' : which;
  if (!c.addons || !c.addons.installed.includes(base as AddonId)) return false;
  return addonPods(c, which).some((p) => podServing(c, p));
}

// ── helpers ──

function throttledEvent(c: Cluster, obj: Obj, type: 'Normal' | 'Warning', reason: string, message: string, source: string, every = 15_000): void {
  const last = c.eventsFor(obj).filter((e) => e.reason === reason && e.message === message).pop();
  if (last && c.now - Date.parse(last.lastTimestamp) < every) return;
  c.event(obj, type, reason, message, source);
}

const cond = (c: Cluster, type: string, status: 'True' | 'False' | 'Unknown', reason: string, message: string, prev?: Obj[]): Obj => {
  const was = (prev ?? []).find((x: Obj) => x.type === type);
  return { type, status, reason, message, lastTransitionTime: was && was.status === status ? was.lastTransitionTime : iso(c.now), observedGeneration: 1 };
};

function setStatus(c: Cluster, obj: Obj, status: Obj): void {
  const fresh = c.get(obj.kind, obj.metadata.namespace, obj.metadata.name);
  if (fresh && !deepEqual(fresh.status, status)) c.putStatus(fresh, status);
}

// ── the loop ──

/** Run every add-on controller once (called on each tick while the API works). */
export function runAddons(c: Cluster): void {
  if (c.components['controller-manager']) pvBinder(c);
  if (!c.addons) return;
  if (running(c, 'metallb-controller')) metallb(c);
  if (running(c, 'traefik')) traefikStatus(c);
  if (running(c, 'cert-manager')) certManager(c);
  if (c.components['controller-manager']) {
    if (c.now - c.addons.hpaSyncAt >= 15_000) {
      c.addons.hpaSyncAt = c.now;
      for (const h of c.list('HorizontalPodAutoscaler')) hpa(c, h);
    }
  }
  if (running(c, 'csi-hostpath')) csiProvisioner(c);
  flux(c);
  if (c.now - c.addons.lastScrape >= 30_000) {
    c.addons.lastScrape = c.now;
    if (running(c, 'prometheus')) scrape(c);
  }
}

// ── MetalLB: addresses for Services of type LoadBalancer ──

function metallb(c: Cluster): void {
  const used = new Set(c.list('Service').flatMap((s) => (s.status?.loadBalancer?.ingress ?? []).map((i: Obj) => i.ip)));
  for (const s of c.list('Service')) {
    if (s.spec.type !== 'LoadBalancer' || s.spec.loadBalancerClass || (s.status?.loadBalancer?.ingress ?? []).length) continue;
    let ip: string | undefined;
    for (let n = LB_POOL.from; n <= LB_POOL.to && !ip; n++) if (!used.has(`${LB_POOL.prefix}${n}`)) ip = `${LB_POOL.prefix}${n}`;
    if (!ip) {
      throttledEvent(c, s, 'Warning', 'AllocationFailed', 'Failed to allocate IP for "' + `${s.metadata.namespace}/${s.metadata.name}` + '": no available IPs', 'metallb-controller', 60_000);
      continue;
    }
    used.add(ip);
    const fresh = c.putStatus(s, { ...s.status, loadBalancer: { ingress: [{ ip, ipMode: 'VIP' }] } });
    c.event(fresh, 'Normal', 'IPAllocated', `Assigned IP ["${ip}"]`, 'metallb-controller');
  }
}

/** The address of a LoadBalancer Service answers on the office network (a speaker answers ARP for it). */
export function lbAnnounced(c: Cluster, ip: string): boolean {
  return running(c, 'metallb-speaker') && c.list('Service').some((s) => (s.status?.loadBalancer?.ingress ?? []).some((i: Obj) => i.ip === ip));
}

// ── Traefik: Gateway API and Ingress ──

export function ingressClassOf(c: Cluster, ing: Obj): string | undefined {
  const named = ing.spec?.ingressClassName ?? ing.metadata.annotations?.['kubernetes.io/ingress.class'];
  if (named) return named;
  return c.list('IngressClass').find((k) => k.metadata.annotations?.['ingressclass.kubernetes.io/is-default-class'] === 'true')?.metadata.name;
}

const isTraefikIngress = (c: Cluster, ing: Obj) => {
  const cls = ingressClassOf(c, ing);
  const k = cls ? c.get('IngressClass', undefined, cls) : undefined;
  return k?.spec?.controller === 'traefik.io/ingress-controller';
};

const traefikGateways = (c: Cluster) => c.list('Gateway').filter((g) => c.get('GatewayClass', undefined, g.spec?.gatewayClassName ?? '')?.spec?.controllerName === 'traefik.io/gateway-controller');

const hostMatches = (pattern: string | undefined, host: string) => !pattern || pattern === host || (pattern.startsWith('*.') && host.endsWith(pattern.slice(1)));

/** The routes of an HTTPRoute attached to a Gateway (namespace defaults to the route's). */
const attached = (r: Obj, g: Obj) => (r.spec?.parentRefs ?? []).some((p: Obj) => p.name === g.metadata.name && (p.namespace ?? r.metadata.namespace) === g.metadata.namespace);

function lbAddresses(c: Cluster): string[] {
  return (c.get('Service', 'traefik', 'traefik')?.status?.loadBalancer?.ingress ?? []).map((i: Obj) => i.ip);
}

function traefikStatus(c: Cluster): void {
  const ips = lbAddresses(c);
  for (const gc of c.list('GatewayClass')) {
    if (gc.spec?.controllerName !== 'traefik.io/gateway-controller') continue;
    setStatus(c, gc, { conditions: [cond(c, 'Accepted', 'True', 'Accepted', 'Handled by Traefik controller', gc.status?.conditions)] });
  }
  for (const g of traefikGateways(c)) {
    const listeners = (g.spec?.listeners ?? []).map((l: Obj) => {
      const ref = l.tls?.certificateRefs?.[0]?.name;
      const ok = l.protocol !== 'HTTPS' || (ref && c.get('Secret', g.metadata.namespace, ref));
      const prev = (g.status?.listeners ?? []).find((x: Obj) => x.name === l.name)?.conditions;
      return {
        name: l.name,
        attachedRoutes: c.list('HTTPRoute').filter((r) => attached(r, g)).length,
        supportedKinds: [{ group: 'gateway.networking.k8s.io', kind: 'HTTPRoute' }],
        conditions: [
          cond(c, 'Accepted', 'True', 'Accepted', 'No error found', prev),
          cond(c, 'ResolvedRefs', ok ? 'True' : 'False', ok ? 'ResolvedRefs' : 'InvalidCertificateRef', ok ? 'No error found' : `Error while retrieving certificate: secret ${g.metadata.namespace}/${ref} does not exist`, prev),
          cond(c, 'Programmed', 'True', 'Programmed', 'No error found', prev),
        ],
      };
    });
    setStatus(c, g, { addresses: ips.map((ip) => ({ type: 'IPAddress', value: ip })), conditions: [cond(c, 'Accepted', 'True', 'Accepted', 'Gateway successfully scheduled', g.status?.conditions), cond(c, 'Programmed', 'True', 'Programmed', 'Gateway successfully scheduled', g.status?.conditions)], listeners });
  }
  for (const r of c.list('HTTPRoute')) {
    const parents = traefikGateways(c)
      .filter((g) => attached(r, g))
      .map((g) => {
        const missing = (r.spec?.rules ?? []).flatMap((x: Obj) => x.backendRefs ?? []).find((b: Obj) => !c.get('Service', b.namespace ?? r.metadata.namespace, b.name));
        const prev = (r.status?.parents ?? []).find((p: Obj) => p.parentRef?.name === g.metadata.name)?.conditions;
        return {
          controllerName: 'traefik.io/gateway-controller',
          parentRef: { group: 'gateway.networking.k8s.io', kind: 'Gateway', name: g.metadata.name, namespace: g.metadata.namespace },
          conditions: [cond(c, 'Accepted', 'True', 'Accepted', 'Route successfully attached to Gateway', prev), cond(c, 'ResolvedRefs', missing ? 'False' : 'True', missing ? 'BackendNotFound' : 'ResolvedRefs', missing ? `Cannot load HTTPBackendRef ${r.metadata.namespace}/${missing.name}: service not found` : 'Resolved refs', prev)],
        };
      });
    setStatus(c, r, { parents });
  }
  for (const ing of c.list('Ingress')) {
    if (!isTraefikIngress(c, ing)) continue;
    const want = { loadBalancer: ips.length ? { ingress: ips.map((ip) => ({ ip })) } : {} };
    if (!deepEqual(ing.status, want)) c.putStatus(ing, want);
  }
}

export const CURL_SELF_SIGNED =
  'curl: (60) SSL certificate problem: self-signed certificate\nMore details here: https://curl.se/docs/sslcerts.html\n\ncurl failed to verify the legitimacy of the server and therefore could not\nestablish a secure connection to it. To learn more about this situation and\nhow to fix it, please visit the webpage mentioned above.';

interface Backend {
  ns: string;
  name: string;
  port?: number;
  via: string;
}

/** The route Traefik picks for host and path on an entry point (web: 8000, websecure: 8443). */
function matchRoute(c: Cluster, entry: 'web' | 'websecure', host: string, path: string): Backend | undefined {
  const port = entry === 'web' ? 8000 : 8443;
  let best: (Backend & { len: number }) | undefined;
  const consider = (b: Backend, pp: string, exact: boolean) => {
    const ok = exact ? path === pp : pp === '/' || path === pp || path.startsWith(pp.endsWith('/') ? pp : `${pp}/`);
    if (ok && (!best || pp.length > best.len)) best = { ...b, len: pp.length };
  };
  for (const g of traefikGateways(c)) {
    const listeners = (g.spec?.listeners ?? []).filter((l: Obj) => l.port === port && hostMatches(l.hostname, host));
    if (!listeners.length) continue;
    for (const r of c.list('HTTPRoute')) {
      if (!attached(r, g)) continue;
      if ((r.spec?.hostnames ?? []).length && !(r.spec.hostnames as string[]).some((hn) => hostMatches(hn, host))) continue;
      for (const rule of r.spec?.rules ?? [{}]) {
        const b = (rule.backendRefs ?? [])[0];
        if (!b) continue;
        const backend = { ns: b.namespace ?? r.metadata.namespace, name: b.name, port: b.port, via: `HTTPRoute ${r.metadata.name}` };
        const matches: Obj[] = rule.matches ?? [{ path: { type: 'PathPrefix', value: '/' } }];
        for (const m of matches) consider(backend, m.path?.value ?? '/', m.path?.type === 'Exact');
      }
    }
  }
  for (const ing of c.list('Ingress')) {
    if (!isTraefikIngress(c, ing)) continue;
    for (const r of ing.spec?.rules ?? []) {
      if (!hostMatches(r.host, host)) continue;
      for (const p of r.http?.paths ?? []) {
        const s = p.backend?.service;
        if (s) consider({ ns: ing.metadata.namespace, name: s.name, port: s.port?.number, via: `Ingress ${ing.metadata.name}` }, p.path ?? '/', p.pathType === 'Exact');
      }
    }
  }
  return best;
}

/** The TLS Secret Traefik would serve for a host, and whether the office laptop trusts it. */
export function tlsFor(c: Cluster, host: string): { configured: boolean; secret?: Obj; trusted: boolean } {
  const verdict = (secret: Obj | undefined) => ({
    configured: true,
    secret,
    trusted: !!secret && secret.type === 'kubernetes.io/tls' && secret.metadata.annotations?.['cert-manager.io/issuer-name'] === HTTPS_CA && (secret.metadata.annotations?.['cert-manager.io/alt-names'] ?? '').split(',').includes(host),
  });
  for (const g of traefikGateways(c)) {
    const l = (g.spec?.listeners ?? []).find((x: Obj) => x.protocol === 'HTTPS' && x.port === 8443 && hostMatches(x.hostname, host));
    if (l) return verdict(l.tls?.certificateRefs?.[0]?.name ? c.get('Secret', g.metadata.namespace, l.tls.certificateRefs[0].name) : undefined);
  }
  for (const ing of c.list('Ingress')) {
    if (!isTraefikIngress(c, ing)) continue;
    const t = (ing.spec?.tls ?? []).find((x: Obj) => (x.hosts ?? []).includes(host));
    if (t) return verdict(t.secretName ? c.get('Secret', ing.metadata.namespace, t.secretName) : undefined);
  }
  return { configured: false, trusted: false };
}

/** What Traefik in its pod answers to a request for host/path. */
function traefikServe(c: Cluster, ctrl: Obj, entry: 'web' | 'websecure', host: string, path: string, insecure: boolean, trace: string[]): HttpResult {
  if (entry === 'websecure') {
    const t = tlsFor(c, host);
    if (!t.trusted) {
      trace.push(`Traefik: no valid certificate for ${host}, it presents its built-in "TRAEFIK DEFAULT CERT"`);
      if (!insecure) return { ok: false, exit: 60, error: CURL_SELF_SIGNED, trace };
    } else trace.push(`Traefik: TLS for ${host} with Secret ${t.secret!.metadata.name}, signed by ${HTTPS_CA}`);
  }
  const m = matchRoute(c, entry, host, path);
  if (!m) {
    trace.push(`Traefik: no route for ${host}${path} on the entry point ${entry}: 404`);
    return { ok: true, status: 404, body: '404 page not found', exit: 0, trace };
  }
  const svc = c.get('Service', m.ns, m.name);
  const slices = c.list('EndpointSlice', m.ns).filter((s) => s.metadata.labels?.['kubernetes.io/service-name'] === m.name);
  const ready = slices.flatMap((s) => (s.endpoints ?? []).filter((e: Obj) => e.conditions?.ready).map((e: Obj) => e.addresses[0]));
  if (!svc || !ready.length) {
    trace.push(`Traefik: ${m.via} → Service ${m.name} has no ready endpoints: 503`);
    return { ok: true, status: 503, body: 'no available server', exit: 0, trace };
  }
  const sp = (svc.spec.ports ?? []).find((p: Obj) => p.port === m.port) ?? svc.spec.ports?.[0];
  const key = `traefik:${m.ns}/${m.name}`;
  const n = (c.rr[key] = (c.rr[key] ?? -1) + 1);
  const ip = ready[n % ready.length];
  const pod = podByIp(c, ip);
  const tp = pod ? (resolveTargetPort(pod, sp?.targetPort) ?? sp?.port) : sp?.port;
  trace.push(`Traefik: ${m.via} sends ${host}${path} to Service ${m.name}, straight to the pod ${ip}:${tp} from its EndpointSlice`);
  const r = httpFrom(c, ctrl, `${ip}:${tp}${path}`);
  trace.push(...r.trace);
  if (!r.ok) return { ok: true, status: r.exit === 28 ? 504 : 502, body: r.exit === 28 ? 'Gateway Timeout' : 'Bad Gateway', exit: 0, trace };
  return { ...r, trace };
}

/** Where a name points from a computer in the office network. */
export function officeResolve(c: Cluster, host: string): string | undefined {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
  const node = c.nodes.find((n) => n.name === host);
  if (node) return node.ip;
  if (host.endsWith(OFFICE_DOMAIN) && host !== OFFICE_DOMAIN.slice(1)) return OFFICE_IP;
  return undefined;
}

/**
 * curl from a computer in the office network (192.168.56.0/24, the same
 * network as the nodes): a NodePort on a node, or the address MetalLB
 * announces, then kube-proxy's rule, then the pod — the ingress controller
 * routes further by host and path.
 */
export function outsideHttp(c: Cluster, url: string, o: { insecure?: boolean } = {}): HttpResult {
  const trace: string[] = [];
  const m = /^(?:(https?):\/\/)?([^/:]+)(?::(\d+))?(\/.*)?$/.exec(url.trim());
  if (!m) return { ok: false, exit: 3, error: 'curl: (3) URL rejected: Malformed input to a URL function', trace };
  const scheme = m[1] ?? 'http';
  const host = m[2];
  const port = Number(m[3] ?? (scheme === 'https' ? 443 : 80));
  const path = m[4] ?? '/';
  const fail = (exit: number, ms: number, why: string): HttpResult => {
    trace.push(why);
    return { ok: false, exit, error: `curl: (${exit}) Failed to connect to ${host} port ${port} after ${ms} ms: Couldn't connect to server`, trace };
  };
  const ip = officeResolve(c, host);
  if (!ip) {
    trace.push(`the office DNS knows no name ${host}`);
    return { ok: false, exit: 6, error: `curl: (6) Could not resolve host: ${host}`, trace };
  }
  trace.push(`office DNS: ${host} → ${ip}`);
  const node = c.nodes.find((n) => n.ip === ip);
  let svc: Obj | undefined;
  let sp: Obj | undefined;
  if (node) {
    if (!node.power) return fail(7, 3071, `${node.name} is powered off: nobody answers ARP for ${ip}`);
    svc = c.list('Service').find((s) => (s.spec.ports ?? []).some((p: Obj) => p.nodePort === port));
    sp = svc?.spec.ports.find((p: Obj) => p.nodePort === port);
    if (!svc) return fail(7, 1, `${ip}:${port}: no NodePort with this number, the node's kernel answers RST`);
  } else {
    svc = c.list('Service').find((s) => s.spec.type === 'LoadBalancer' && (s.status?.loadBalancer?.ingress ?? []).some((i: Obj) => i.ip === ip));
    if (!svc || !lbAnnounced(c, ip)) return fail(7, 3074, `${ip}: no machine in the office network answers ARP for this address (MetalLB does not announce it)`);
    sp = svc.spec.ports.find((p: Obj) => p.port === port);
    if (!sp) return fail(7, 1, `${ip}:${port}: the Service ${svc.metadata.name} has no port ${port}`);
    trace.push(`MetalLB: the speaker answers ARP for ${ip}, the packet arrives at a node`);
  }
  const entry = Object.entries(c.proxy.services).find(([k, v]) => k.startsWith(`${svc!.metadata.namespace}/${svc!.metadata.name}:`) && v.port === sp!.port && v.protocol === 'TCP');
  if (!entry) return node ? fail(7, 1, `${ip}:${port}: kube-proxy wrote no NodePort rule, nothing listens`) : fail(28, 130407, `${ip}:${port}: the node has no rule for this address (kube-proxy is not running), the packet is dropped`);
  const [k, e] = entry;
  if (!e.endpoints.length) return fail(7, 2, `${svc.metadata.name}: no ready endpoints, kube-proxy's rule is REJECT`);
  const n = (c.rr[k] = (c.rr[k] ?? -1) + 1);
  const target = e.endpoints[n % e.endpoints.length];
  trace.push(`kube-proxy DNAT ${ip}:${port} → ${target}`);
  const [pip, pport] = target.split(':');
  const pod = podByIp(c, pip);
  if (!pod) return fail(28, 130412, `${target}: the pod is gone, but the rule is still there`);
  if (pod.metadata.labels?.['app.kubernetes.io/name'] === 'traefik') {
    if (!podServing(c, pod)) return fail(7, 1, `the Traefik pod ${pod.metadata.name} does not run`);
    return traefikServe(c, pod, Number(pport) === 8443 ? 'websecure' : 'web', host, path, !!o.insecure, trace);
  }
  if (scheme === 'https') {
    trace.push(`${pod.metadata.name} speaks plain HTTP on ${pport}`);
    return { ok: false, exit: 35, error: 'curl: (35) OpenSSL/3.0.13: error:0A00010B:SSL routines::wrong version number', trace };
  }
  const r = httpFrom(c, null, `${pip}:${pport}${path}`);
  return { ...r, error: r.error?.replace(pip, host), trace: [...trace, ...r.trace] };
}

// ── cert-manager ──

function certManager(c: Cluster): void {
  // ClusterIssuers: Ready when their CA Secret exists.
  for (const iss of c.list('ClusterIssuer')) {
    const sec = iss.spec?.ca?.secretName ? c.get('Secret', 'cert-manager', iss.spec.ca.secretName) : undefined;
    const ok = !!sec;
    setStatus(c, iss, { conditions: [cond(c, 'Ready', ok ? 'True' : 'False', ok ? 'KeyPairVerified' : 'ErrGetKeyPair', ok ? 'Signing CA verified' : `Error getting keypair for CA issuer: secret "${iss.spec?.ca?.secretName}" not found`, iss.status?.conditions)] });
  }
  // ingress-shim: an annotated Ingress with tls gets a Certificate per Secret.
  for (const ing of c.list('Ingress')) {
    const issuer = ing.metadata.annotations?.['cert-manager.io/cluster-issuer'];
    if (!issuer) continue;
    for (const t of ing.spec?.tls ?? []) {
      if (!t.secretName) continue;
      const have = c.get('Certificate', ing.metadata.namespace, t.secretName);
      const spec = { dnsNames: t.hosts ?? [], issuerRef: { group: 'cert-manager.io', kind: 'ClusterIssuer', name: issuer }, secretName: t.secretName, usages: ['digital signature', 'key encipherment'] };
      if (have && deepEqual(have.spec, spec)) continue;
      const obj = {
        apiVersion: 'cert-manager.io/v1',
        kind: 'Certificate',
        metadata: { name: t.secretName, namespace: ing.metadata.namespace, ownerReferences: [{ apiVersion: 'networking.k8s.io/v1', kind: 'Ingress', name: ing.metadata.name, uid: ing.metadata.uid, controller: true, blockOwnerDeletion: true }], generation: 1 },
        spec,
      };
      const stored = have ? c.put({ ...have, spec }) : c.put(obj);
      c.event(ing, 'Normal', have ? 'UpdateCertificate' : 'CreateCertificate', `Successfully ${have ? 'updated' : 'created'} Certificate "${t.secretName}"`, 'cert-manager-ingress-shim');
      void stored;
    }
  }
  // gateway-shim: an annotated Gateway gets a Certificate per HTTPS listener.
  for (const g of c.list('Gateway')) {
    const issuer = g.metadata.annotations?.['cert-manager.io/cluster-issuer'];
    if (!issuer) continue;
    for (const l of g.spec?.listeners ?? []) {
      const secretName = l.tls?.certificateRefs?.[0]?.name;
      if (l.protocol !== 'HTTPS' || !secretName || !l.hostname) continue;
      const have = c.get('Certificate', g.metadata.namespace, secretName);
      const spec = { dnsNames: [l.hostname], issuerRef: { group: 'cert-manager.io', kind: 'ClusterIssuer', name: issuer }, secretName, usages: ['digital signature', 'key encipherment'] };
      if (have && deepEqual(have.spec, spec)) continue;
      if (have) c.put({ ...have, spec });
      else c.put({ apiVersion: 'cert-manager.io/v1', kind: 'Certificate', metadata: { name: secretName, namespace: g.metadata.namespace, ownerReferences: [{ apiVersion: 'gateway.networking.k8s.io/v1', kind: 'Gateway', name: g.metadata.name, uid: g.metadata.uid, controller: true, blockOwnerDeletion: true }], generation: 1 }, spec });
      c.event(g, 'Normal', have ? 'UpdateCertificate' : 'CreateCertificate', `Successfully ${have ? 'updated' : 'created'} Certificate "${secretName}"`, 'cert-manager-gateway-shim');
    }
  }
  // Certificates: issue the Secret once the issuer is Ready.
  for (const cert of c.list('Certificate')) {
    const ns = cert.metadata.namespace;
    const iss = c.get('ClusterIssuer', undefined, cert.spec?.issuerRef?.name ?? '');
    const issuerReady = (iss?.status?.conditions ?? []).some((x: Obj) => x.type === 'Ready' && x.status === 'True');
    const sec = c.get('Secret', ns, cert.spec.secretName);
    const names = (cert.spec.dnsNames ?? []).join(',');
    const valid = !!sec && sec.metadata.annotations?.['cert-manager.io/alt-names'] === names && sec.metadata.annotations?.['cert-manager.io/issuer-name'] === cert.spec.issuerRef?.name;
    if (valid) {
      setStatus(c, cert, { conditions: [cond(c, 'Ready', 'True', 'Ready', 'Certificate is up to date and has not expired', cert.status?.conditions)], notAfter: iso(Date.parse(sec!.metadata.creationTimestamp) + 90 * 86_400_000), notBefore: sec!.metadata.creationTimestamp, renewalTime: iso(Date.parse(sec!.metadata.creationTimestamp) + 60 * 86_400_000), revision: 1 });
      continue;
    }
    if (!iss || !issuerReady) {
      setStatus(c, cert, { conditions: [cond(c, 'Ready', 'False', 'DoesNotExist', 'Issuing certificate as Secret does not exist', cert.status?.conditions), cond(c, 'Issuing', 'True', 'DoesNotExist', 'Issuing certificate as Secret does not exist', cert.status?.conditions)] });
      throttledEvent(c, cert, 'Warning', 'IssuerNotReady', `Referenced "ClusterIssuer" not found: clusterissuer.cert-manager.io "${cert.spec?.issuerRef?.name}" not found`, 'cert-manager-certificates-issuing', 60_000);
      continue;
    }
    // Issue: a CertificateRequest signed by the CA, then the Secret.
    const crName = `${cert.metadata.name}-1`;
    if (!c.get('CertificateRequest', ns, crName)) {
      c.event(cert, 'Normal', 'Issuing', 'Issuing certificate as Secret does not exist', 'cert-manager-certificates-trigger');
      c.put({
        apiVersion: 'cert-manager.io/v1',
        kind: 'CertificateRequest',
        metadata: { name: crName, namespace: ns, ownerReferences: [{ apiVersion: 'cert-manager.io/v1', kind: 'Certificate', name: cert.metadata.name, uid: cert.metadata.uid, controller: true, blockOwnerDeletion: true }], annotations: { 'cert-manager.io/certificate-name': cert.metadata.name, 'cert-manager.io/certificate-revision': '1' }, generation: 1 },
        spec: { issuerRef: cert.spec.issuerRef, request: 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURSBSRVFVRVNULS0tLS0K', username: 'system:serviceaccount:cert-manager:cert-manager', usages: cert.spec.usages },
        status: { conditions: [cond(c, 'Approved', 'True', 'cert-manager.io', 'Certificate request has been approved by cert-manager.io'), cond(c, 'Ready', 'True', 'Issued', 'Certificate fetched from issuer successfully')] },
      });
      c.event(cert, 'Normal', 'Requested', `Created new CertificateRequest resource "${crName}"`, 'cert-manager-certificates-request-manager');
    }
    const secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      type: 'kubernetes.io/tls',
      metadata: {
        name: cert.spec.secretName,
        namespace: ns,
        labels: { 'controller.cert-manager.io/fao': 'true' },
        annotations: { 'cert-manager.io/alt-names': names, 'cert-manager.io/certificate-name': cert.metadata.name, 'cert-manager.io/common-name': '', 'cert-manager.io/issuer-group': 'cert-manager.io', 'cert-manager.io/issuer-kind': 'ClusterIssuer', 'cert-manager.io/issuer-name': cert.spec.issuerRef.name },
      },
      data: { 'ca.crt': 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk9GRklDRS1DQQotLS0tLUVORCBDRVJUSUZJQ0FURS0tLS0tCg==', 'tls.crt': 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tClNJVEUKLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo=', 'tls.key': 'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tClNJVEUtS0VZCi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS0K' },
    };
    if (sec) c.put({ ...sec, ...secret, metadata: { ...sec.metadata, ...secret.metadata } });
    else c.put(secret);
    c.event(cert, 'Normal', 'Issuing', 'The certificate has been successfully issued', 'cert-manager-certificates-issuing');
  }
}

// ── storage: the PV binder (kube-controller-manager) and the CSI provisioner ──

const claimKey = (pvc: Obj) => `${pvc.metadata.namespace}/${pvc.metadata.name}`;
const defaultClass = (c: Cluster) => c.list('StorageClass').find((s) => s.metadata.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true');

function pvBinder(c: Cluster): void {
  const SRC = 'persistentvolume-controller';
  for (let pvc of c.list('PersistentVolumeClaim')) {
    if (pvc.metadata.deletionTimestamp) continue;
    if (pvc.status?.phase === 'Bound') continue;
    // Retroactive default StorageClass assignment (on since v1.28).
    if (pvc.spec.storageClassName === undefined) {
      const d = defaultClass(c);
      if (d) pvc = c.put({ ...pvc, spec: { ...pvc.spec, storageClassName: d.metadata.name } });
    }
    const pv = c.list('PersistentVolume').find((v) => v.spec?.claimRef?.uid === pvc.metadata.uid || (v.spec?.claimRef && `${v.spec.claimRef.namespace}/${v.spec.claimRef.name}` === claimKey(pvc) && !v.spec.claimRef.uid))
      ?? c.list('PersistentVolume').find(v => !v.spec?.claimRef && (!v.status?.phase || v.status.phase === 'Available')
        && (!pvc.spec.volumeName || pvc.spec.volumeName === v.metadata.name)
        && (v.spec.storageClassName ?? '') === (pvc.spec.storageClassName ?? '')
        && bytes(v.spec.capacity?.storage ?? '0') >= bytes(pvc.spec.resources?.requests?.storage ?? '0')
        && (pvc.spec.accessModes ?? []).every((mode: string) => (v.spec.accessModes ?? []).includes(mode))
        && (v.spec.volumeMode ?? 'Filesystem') === (pvc.spec.volumeMode ?? 'Filesystem')
        && Object.entries(pvc.spec.selector?.matchLabels ?? {}).every(([key, value]) => v.metadata.labels?.[key] === value));
    if (pv) {
      if (pv.spec.claimRef?.uid !== pvc.metadata.uid) c.put({ ...pv, spec: { ...pv.spec, claimRef: { apiVersion: 'v1', kind: 'PersistentVolumeClaim', name: pvc.metadata.name, namespace: pvc.metadata.namespace, uid: pvc.metadata.uid } } });
      const bound = c.put({
        ...pvc,
        metadata: { ...pvc.metadata, annotations: { ...(pvc.metadata.annotations ?? {}), 'pv.kubernetes.io/bind-completed': 'yes', 'pv.kubernetes.io/bound-by-controller': 'yes' } },
        spec: { ...pvc.spec, volumeName: pv.metadata.name },
        status: { phase: 'Bound', accessModes: pv.spec.accessModes, capacity: pv.spec.capacity },
      });
      c.putStatus(c.get('PersistentVolume', undefined, pv.metadata.name)!, { phase: 'Bound' });
      void bound;
      continue;
    }
    const cls: string | undefined = pvc.spec.storageClassName;
    if (cls === undefined || cls === '') {
      throttledEvent(c, pvc, 'Normal', 'FailedBinding', 'no persistent volumes available for this claim and no storage class is set', SRC);
      continue;
    }
    const sc = c.get('StorageClass', undefined, cls);
    if (!sc) {
      throttledEvent(c, pvc, 'Warning', 'ProvisioningFailed', `storageclass.storage.k8s.io "${cls}" not found`, SRC);
      continue;
    }
    if (pvc.metadata.annotations?.['volume.kubernetes.io/storage-provisioner'] !== sc.provisioner) {
      pvc = c.put({ ...pvc, metadata: { ...pvc.metadata, annotations: { ...(pvc.metadata.annotations ?? {}), 'volume.beta.kubernetes.io/storage-provisioner': sc.provisioner, 'volume.kubernetes.io/storage-provisioner': sc.provisioner } } });
    }
    throttledEvent(
      c,
      pvc,
      'Normal',
      'ExternalProvisioning',
      `Waiting for a volume to be created either by the external provisioner '${sc.provisioner}' or manually by the system administrator. If volume creation is delayed, please verify that the provisioner is running and correctly registered.`,
      SRC,
    );
  }
  // Released volumes with reclaimPolicy Delete go away with their claim.
  for (const pv of c.list('PersistentVolume')) {
    const ref = pv.spec?.claimRef;
    if (!ref || pv.status?.phase !== 'Bound') continue;
    const claim = c.get('PersistentVolumeClaim', ref.namespace, ref.name);
    if (!claim || claim.metadata.uid !== ref.uid) {
      if (pv.spec.persistentVolumeReclaimPolicy === 'Delete') c.remove('PersistentVolume', undefined, pv.metadata.name);
      else c.putStatus(pv, { phase: 'Released' });
    }
  }
}

function csiProvisioner(c: Cluster): void {
  const SRC = 'hostpath.csi.k8s.io_csi-hostpathplugin-0_3f1d2c7a-5b8e-4d61-9a0c-7e2b4f6d8c10';
  for (const pvc of c.list('PersistentVolumeClaim')) {
    if (pvc.status?.phase === 'Bound' || pvc.metadata.deletionTimestamp) continue;
    const sc = pvc.spec.storageClassName ? c.get('StorageClass', undefined, pvc.spec.storageClassName) : undefined;
    if (!sc || sc.provisioner !== 'hostpath.csi.k8s.io') continue;
    const name = `pvc-${pvc.metadata.uid}`;
    if (c.get('PersistentVolume', undefined, name)) continue;
    c.event(pvc, 'Normal', 'Provisioning', `External provisioner is provisioning volume for claim "${claimKey(pvc)}"`, SRC);
    c.put({
      apiVersion: 'v1',
      kind: 'PersistentVolume',
      metadata: { name, annotations: { 'pv.kubernetes.io/provisioned-by': 'hostpath.csi.k8s.io', 'volume.kubernetes.io/provisioner-deletion-secret-name': '', 'volume.kubernetes.io/provisioner-deletion-secret-namespace': '' }, finalizers: ['external-provisioner.volume.kubernetes.io/finalizer', 'kubernetes.io/pv-protection'] },
      spec: {
        accessModes: pvc.spec.accessModes ?? ['ReadWriteOnce'],
        capacity: { storage: pvc.spec.resources?.requests?.storage ?? '1Gi' },
        claimRef: { apiVersion: 'v1', kind: 'PersistentVolumeClaim', name: pvc.metadata.name, namespace: pvc.metadata.namespace, uid: pvc.metadata.uid, resourceVersion: pvc.metadata.resourceVersion },
        csi: { driver: 'hostpath.csi.k8s.io', volumeHandle: pvc.metadata.uid.replace(/-/g, '').slice(0, 8) + '-' + pvc.metadata.uid.slice(9, 13) + '-11f0-a1b2-0242ac120002', volumeAttributes: { kind: 'file', 'storage.kubernetes.io/csiProvisionerIdentity': '1763456400000-7351-hostpath.csi.k8s.io' } },
        persistentVolumeReclaimPolicy: sc.reclaimPolicy ?? 'Delete',
        storageClassName: sc.metadata.name,
        volumeMode: pvc.spec.volumeMode ?? 'Filesystem',
      },
      status: { phase: 'Pending' },
    });
    c.event(pvc, 'Normal', 'ProvisioningSucceeded', `Successfully provisioned volume ${name}`, SRC);
  }
}

// ── metrics: what metrics-server reports, and the HPA controller ──

/** Owner Deployment "ns/name" of a pod (pod → ReplicaSet → Deployment). */
function deploymentOf(c: Cluster, pod: Obj): string | undefined {
  const rsRef = controllerOf(pod);
  if (rsRef?.kind !== 'ReplicaSet') return undefined;
  const rs = c.get('ReplicaSet', pod.metadata.namespace, rsRef.name);
  const d = rs ? controllerOf(rs) : undefined;
  return d?.kind === 'Deployment' ? `${pod.metadata.namespace}/${d.name}` : undefined;
}

/** CPU (millicores) and memory (bytes) a pod uses now: its idle cost plus its share of the users' load. */
export function podUsage(c: Cluster, pod: Obj): { cpu: number; memory: number } {
  const h = fnv32a(pod.metadata.uid);
  const img = String(pod.spec.containers?.[0]?.image ?? '');
  const heavy = /prometheus:|kube-state-metrics|traefik|cert-manager|metrics-server|fluxcd|coredns/.test(img);
  let cpu = (heavy ? 3 : 1) + (h % 3);
  const memory = (heavy ? 24 + (h % 40) : 3 + (h % 5)) * 2 ** 20;
  const d = deploymentOf(c, pod);
  const load = d ? (c.addons?.load[d] ?? 0) : 0;
  if (load && d) {
    const peers = c.list('Pod', pod.metadata.namespace).filter((p) => deploymentOf(c, p) === d && podServing(c, p));
    if (peers.some((p) => p.metadata.uid === pod.metadata.uid)) cpu += Math.round(load / peers.length);
  }
  return { cpu, memory };
}

export const metricsAvailable = (c: Cluster) => running(c, 'metrics-server');

export const METRICS_MISSING = 'unable to get metrics for resource cpu: unable to fetch metrics from resource metrics API: the server could not find the requested resource (get pods.metrics.k8s.io)';

function hpa(c: Cluster, h: Obj): void {
  const SRC = 'horizontal-pod-autoscaler';
  const ns = h.metadata.namespace;
  const ref = h.spec?.scaleTargetRef ?? {};
  const target = ref.kind === 'Deployment' ? c.get('Deployment', ns, ref.name) : undefined;
  const metric = (h.spec?.metrics ?? []).find((m: Obj) => m.type === 'Resource' && m.resource?.name === 'cpu');
  const want: number = metric?.resource?.target?.averageUtilization ?? 80;
  const min = h.spec?.minReplicas ?? 1;
  const max = h.spec?.maxReplicas ?? 1;
  const prev: Obj[] = h.status?.conditions ?? [];
  if (!target) {
    setStatus(c, h, { currentReplicas: 0, desiredReplicas: 0, conditions: [cond(c, 'AbleToScale', 'False', 'FailedGetScale', `the HPA controller was unable to get the target's current scale: deployments/scale.apps "${ref.name}" not found`, prev)] });
    throttledEvent(c, h, 'Warning', 'FailedGetScale', `deployments/scale.apps "${ref.name}" not found`, SRC, 60_000);
    return;
  }
  const current = target.spec.replicas ?? 1;
  const base = { currentReplicas: current, desiredReplicas: current, lastScaleTime: h.status?.lastScaleTime };
  const pods = c.list('Pod', ns).filter((p) => deploymentOf(c, p) === `${ns}/${ref.name}` && podReady(p) && !p.metadata.deletionTimestamp);
  const fail = (reason: string, why: string) => {
    setStatus(c, h, { ...base, currentMetrics: null, conditions: [cond(c, 'AbleToScale', 'True', 'SucceededGetScale', 'the HPA controller was able to get the target\'s current scale', prev), cond(c, 'ScalingActive', 'False', reason, `the HPA was unable to compute the replica count: ${why}`, prev)] });
    throttledEvent(c, h, 'Warning', reason, why, SRC, 60_000);
    throttledEvent(c, h, 'Warning', 'FailedComputeMetricsReplicas', `invalid metrics (1 invalid out of 1), first error is: failed to get cpu resource metric value: ${why}`, SRC, 60_000);
  };
  if (!metricsAvailable(c)) return fail('FailedGetResourceMetric', `failed to get cpu utilization: ${METRICS_MISSING}`);
  const noReq = pods.find((p) => !(p.spec.containers ?? []).every((ct: Obj) => cpuMilli(ct.resources?.requests?.cpu)));
  if (noReq) return fail('FailedGetResourceMetric', `failed to get cpu utilization: missing request for cpu in container ${noReq.spec.containers[0].name} of Pod ${noReq.metadata.name}`);
  if (!pods.length) return fail('FailedGetResourceMetric', 'failed to get cpu utilization: did not receive metrics for targeted pods (pods might be unready)');
  let used = 0;
  let req = 0;
  for (const p of pods) {
    used += podUsage(c, p).cpu;
    req += (p.spec.containers ?? []).reduce((s: number, ct: Obj) => s + cpuMilli(ct.resources?.requests?.cpu), 0);
  }
  const util = Math.round((used / req) * 100);
  const ratio = util / want;
  let rec = Math.abs(ratio - 1) <= 0.1 ? current : Math.ceil(pods.length * ratio);
  rec = Math.max(min, Math.min(max, rec));
  const key = `${ns}/${h.metadata.name}`;
  const st = (c.addons!.hpa[key] ??= { at: 0, recs: [] });
  st.recs = [...st.recs.filter((r) => c.now - r.at < 300_000), { at: c.now, n: rec }];
  // Scale-down stabilisation: the highest recommendation of the last five minutes.
  const desired = rec < current ? Math.max(...st.recs.map((r) => r.n)) : rec;
  const status: Obj = {
    ...base,
    desiredReplicas: desired,
    currentMetrics: [{ type: 'Resource', resource: { name: 'cpu', current: { averageUtilization: util, averageValue: `${Math.round(used / pods.length)}m` } } }],
    conditions: [
      cond(c, 'AbleToScale', 'True', desired === current ? 'ReadyForNewScale' : 'SucceededRescale', desired === current ? 'recommended size matches current size' : `the HPA controller was able to update the target scale to ${desired}`, prev),
      cond(c, 'ScalingActive', 'True', 'ValidMetricFound', 'the HPA was able to successfully calculate a replica count from cpu resource utilization (percentage of request)', prev),
      cond(c, 'ScalingLimited', rec === max && ratio > 1 ? 'True' : 'False', rec === max && ratio > 1 ? 'TooManyReplicas' : 'DesiredWithinRange', rec === max && ratio > 1 ? 'the desired replica count is more than the maximum replica count' : 'the desired count is within the acceptable range', prev),
    ],
  };
  if (desired !== current) {
    c.put({ ...target, spec: { ...target.spec, replicas: desired } });
    status.lastScaleTime = iso(c.now);
    status.currentReplicas = current;
    c.event(h, 'Normal', 'SuccessfulRescale', `New size: ${desired}; reason: ${desired > current ? 'cpu resource utilization (percentage of request) above target' : 'All metrics below target'}`, SRC);
  }
  setStatus(c, h, status);
}

// ── Flux ──

export function gitHead(c: Cluster): GitCommit | undefined {
  return c.addons?.git[c.addons.git.length - 1];
}

/** A commit pushed to main: the given files replace or add paths in the tree (null removes a path). */
export function gitCommit(c: Cluster, files: Record<string, string | null>, message: string): { commit: GitCommit; parent: GitCommit; changed: string[] } {
  const st = (c.addons ??= newAddonState());
  const parent = st.git[st.git.length - 1];
  const tree = { ...parent.files };
  const changed: string[] = [];
  for (const [p, v] of Object.entries(files)) {
    if (v === null) {
      if (p in tree) changed.push(p);
      delete tree[p];
    } else {
      if (tree[p] !== v) changed.push(p);
      tree[p] = v;
    }
  }
  const commit = { sha: commitSha(message, tree, c.now), message, at: c.now, files: tree };
  st.git.push(commit);
  return { commit, parent, changed };
}

const FLUX_LABELS = { 'kustomize.toolkit.fluxcd.io/name': 'apps', 'kustomize.toolkit.fluxcd.io/namespace': 'flux-system' };
const invKey = (o: Obj) => `${o.kind}/${o.metadata.namespace ?? ''}/${o.metadata.name}`;

function flux(c: Cluster): void {
  const st = c.addons!;
  const repo = c.get('GitRepository', 'flux-system', 'flux-system');
  if (repo && running(c, 'source-controller') && (!st.flux.fetchedAt || c.now - st.flux.fetchedAt >= 60_000)) {
    st.flux.fetchedAt = c.now;
    const head = gitHead(c)!;
    const rev = `main@sha1:${head.sha}`;
    if (st.flux.fetched !== rev) {
      st.flux.fetched = rev;
      c.event(repo, 'Normal', 'NewArtifact', `stored artifact for commit '${head.message.split('\n')[0]}'`, 'source-controller');
    }
    setStatus(c, repo, { artifact: { revision: rev, path: `gitrepository/flux-system/flux-system/${head.sha}.tar.gz`, lastUpdateTime: iso(head.at || c.now) }, conditions: [cond(c, 'Ready', 'True', 'Succeeded', `stored artifact for revision '${rev}'`, repo.status?.conditions)], observedGeneration: 1 });
  }
  const ks = c.get('Kustomization', 'flux-system', 'apps');
  if (!ks || !running(c, 'kustomize-controller') || !st.flux.fetched) return;
  if (st.flux.applied === st.flux.fetched && c.now - st.flux.appliedAt < 300_000) return;
  st.flux.appliedAt = c.now;
  const sha = st.flux.fetched.split(':')[1];
  const commit = st.git.find((x) => x.sha === sha)!;
  const objs: Obj[] = [];
  try {
    for (const [p, text] of Object.entries(commit.files).sort()) {
      if (!p.startsWith('apps/') || !/\.ya?ml$/.test(p)) continue;
      for (const o of parseManifests(text, p)) objs.push(o);
    }
  } catch (e) {
    setStatus(c, ks, { conditions: [cond(c, 'Ready', 'False', 'BuildFailed', `kustomize build failed: ${(e as Error).message}`, ks.status?.conditions)], lastAttemptedRevision: st.flux.fetched });
    return;
  }
  const keep: string[] = [];
  let failed = '';
  let changed = 0;
  for (const o of objs) {
    const desired = clone(o);
    desired.metadata ??= {};
    desired.metadata.labels = { ...(desired.metadata.labels ?? {}), ...FLUX_LABELS };
    try {
      const r = c.apply(desired, { namespace: desired.metadata.namespace ?? 'default' });
      keep.push(invKey(r.obj));
      if (r.result !== 'unchanged') changed++;
    } catch (e) {
      failed ||= `${o.kind}/${o.metadata?.name} dry-run failed: ${(e as Error).message}`;
    }
  }
  // Prune: what this Kustomization applied before and is gone from Git now.
  for (const k of st.flux.inventory) {
    if (keep.includes(k)) continue;
    const [kind, ns, name] = k.split('/');
    if (c.get(kind, ns || undefined, name)) {
      try {
        c.delete(kind, ns || undefined, name);
      } catch {
        /* already gone */
      }
    }
  }
  st.flux.inventory = keep;
  const rev = st.flux.fetched;
  if (failed) {
    setStatus(c, ks, { conditions: [cond(c, 'Ready', 'False', 'ReconciliationFailed', failed, ks.status?.conditions)], lastAttemptedRevision: rev, lastAppliedRevision: st.flux.applied });
    throttledEvent(c, ks, 'Warning', 'ReconciliationFailed', failed, 'kustomize-controller', 60_000);
    return;
  }
  const first = st.flux.applied !== rev;
  st.flux.applied = rev;
  setStatus(c, ks, { conditions: [cond(c, 'Ready', 'True', 'ReconciliationSucceeded', `Applied revision: ${rev}`, ks.status?.conditions)], lastAppliedRevision: rev, lastAttemptedRevision: rev, inventory: { entries: keep.map((k) => ({ id: k, v: 'v1' })) }, observedGeneration: 1 });
  if (first || changed) c.event(ks, 'Normal', 'ReconciliationSucceeded', `Reconciliation finished in 312ms, next run in 5m0s`, 'kustomize-controller');
}

// ── Prometheus ──

export interface Target {
  job: string;
  instance: string;
  health: 'up' | 'down';
  lastError: string;
}

/** What Prometheus discovers through the API and how its last scrape went. */
export function promTargets(c: Cluster): Target[] {
  const out: Target[] = [{ job: 'prometheus', instance: 'localhost:9090', health: 'up', lastError: '' }];
  if (has(c, 'node-exporter')) {
    for (const n of c.nodes) {
      const pod = addonPods(c, 'node-exporter').find((p) => p.spec.nodeName === n.name);
      const up = !!pod && podServing(c, pod);
      out.push({ job: 'node-exporter', instance: `${n.ip}:9100`, health: up ? 'up' : 'down', lastError: up ? '' : `Get "http://${n.ip}:9100/metrics": dial tcp ${n.ip}:9100: connect: connection refused` });
    }
  }
  if (has(c, 'kube-state-metrics')) {
    const pod = addonPods(c, 'kube-state-metrics')[0];
    const up = !!pod && podServing(c, pod);
    const ip = pod?.status?.podIP ?? '10.42.1.9';
    out.push({ job: 'kube-state-metrics', instance: `${ip}:8080`, health: up ? 'up' : 'down', lastError: up ? '' : `Get "http://${ip}:8080/metrics": context deadline exceeded` });
  }
  return out;
}

function crashLooping(c: Cluster): Obj[] {
  return c.list('Pod').filter((p) => (p.status?.containerStatuses ?? []).some((s: Obj) => s.state?.waiting?.reason === 'CrashLoopBackOff' || (s.restartCount > 0 && s.lastState?.terminated && c.now - Date.parse(s.lastState.terminated.finishedAt) < 300_000)));
}

interface AlertRule {
  name: string;
  forMs: number;
  severity: string;
  summary: string;
  /** label sets for which the expression holds now. */
  eval: (c: Cluster, t: Target[]) => Record<string, string>[];
}

export const ALERT_RULES: AlertRule[] = [
  { name: 'Watchdog', forMs: 0, severity: 'none', summary: 'An alert that should always be firing to certify that Alertmanager is working properly.', eval: () => [{}] },
  {
    name: 'KubePodCrashLooping',
    forMs: 15 * 60_000,
    severity: 'warning',
    summary: 'Pod is crash looping.',
    eval: (c, t) => (t.some((x) => x.job === 'kube-state-metrics' && x.health === 'up') ? crashLooping(c).map((p) => ({ namespace: p.metadata.namespace, pod: p.metadata.name, container: p.spec.containers[0].name, reason: 'CrashLoopBackOff' })) : []),
  },
  {
    name: 'TargetDown',
    forMs: 10 * 60_000,
    severity: 'warning',
    summary: 'One or more targets are unreachable.',
    eval: (_c, t) => [...new Set(t.filter((x) => x.health === 'down').map((x) => x.job))].map((job) => ({ job })),
  },
];

const alertKey = (name: string, labels: Record<string, string>) => `${name}${JSON.stringify(labels)}`;

function scrape(c: Cluster): void {
  const st = c.addons!;
  const t = promTargets(c);
  const live = new Set<string>();
  for (const r of ALERT_RULES) for (const l of r.eval(c, t)) live.add(alertKey(r.name, l));
  for (const k of Object.keys(st.alerts)) if (!live.has(k)) delete st.alerts[k];
  for (const k of live) st.alerts[k] ??= c.now;
}

export function promAlerts(c: Cluster): { name: string; labels: Record<string, string>; state: 'pending' | 'firing'; activeAt: string; severity: string; summary: string }[] {
  const st = c.addons;
  if (!st) return [];
  const out = [];
  for (const r of ALERT_RULES) {
    for (const l of r.eval(c, promTargets(c))) {
      const since = st.alerts[alertKey(r.name, l)];
      if (since === undefined) continue;
      out.push({ name: r.name, labels: l, state: c.now - since >= r.forMs ? ('firing' as const) : ('pending' as const), activeAt: iso(since), severity: r.severity, summary: r.summary });
    }
  }
  return out;
}

/** The HTTP API of the Prometheus pod (answered by the image of the pod). */
export function prometheusHttp(c: Cluster, path: string): string {
  const [p, q = ''] = path.split('?');
  if (p === '/-/ready' || p === '/-/healthy') return 'Prometheus Server is Ready.';
  if (p === '/api/v1/targets') {
    const active = promTargets(c).map((t) => ({ labels: { instance: t.instance, job: t.job }, scrapePool: t.job, scrapeUrl: `http://${t.instance}/metrics`, lastError: t.lastError, health: t.health }));
    return JSON.stringify({ status: 'success', data: { activeTargets: active, droppedTargets: [] } });
  }
  if (p === '/api/v1/alerts') {
    const alerts = promAlerts(c).map((a) => ({ labels: { alertname: a.name, ...a.labels, severity: a.severity }, annotations: { summary: a.summary }, state: a.state, activeAt: a.activeAt, value: '1e+00' }));
    return JSON.stringify({ status: 'success', data: { alerts } });
  }
  if (p === '/api/v1/query') {
    const query = decodeURIComponent(q.replace(/^query=/, '').replace(/\+/g, ' '));
    if (query === 'up') {
      const result = promTargets(c).map((t) => ({ metric: { __name__: 'up', instance: t.instance, job: t.job }, value: [c.now / 1000, t.health === 'up' ? '1' : '0'] }));
      return JSON.stringify({ status: 'success', data: { resultType: 'vector', result } });
    }
    return JSON.stringify({ status: 'success', data: { resultType: 'vector', result: [] } });
  }
  return '404 page not found';
}

/** Memory of a node in bytes (for kubectl top nodes). */
export const nodeMemory = (mem: string) => bytes(mem);
