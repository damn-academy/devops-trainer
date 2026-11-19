// Small builders for the Kubernetes process explainers: nodes and edges with
// their cards, and the doc links the cards point to.

import type { Bi } from '../../../core/i18n';
import type { ColorFamily, DiagramEdge, DiagramNode, DocRef, ElementCard, QText, Step } from '../../../core/types';

export const D = {
  components: { url: 'https://kubernetes.io/docs/concepts/overview/components/', label: 'kubernetes.io › Components' },
  apiserver: { page: 'web/kubernetes.io/docs/concepts/overview/components', anchor: 'control-plane-components', line: 'kube-apiserver' },
  controller: { page: 'web/kubernetes.io/docs/concepts/architecture/controller', anchor: 'controller-pattern' },
  scheduler: { page: 'web/kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler', anchor: 'kube-scheduler-implementation', line: 'Filtering' },
  nodes: { page: 'web/kubernetes.io/docs/concepts/architecture/nodes', anchor: 'node-controller', line: '5 minutes' },
  deployment: { page: 'web/kubernetes.io/docs/concepts/workloads/controllers/deployment', anchor: 'max-surge' },
  rs: { page: 'web/kubernetes.io/docs/concepts/workloads/controllers/replicaset', anchor: 'how-a-replicaset-works' },
  service: { page: 'web/kubernetes.io/docs/concepts/services-networking/service', anchor: 'defining-a-service', line: 'targetPort' },
  vip: { page: 'web/kubernetes.io/docs/reference/networking/virtual-ips', anchor: 'proxy-mode-iptables' },
  slices: { page: 'web/kubernetes.io/docs/concepts/services-networking/endpoint-slices', anchor: 'conditions' },
  network: { page: 'web/kubernetes.io/docs/concepts/cluster-administration/networking', anchor: 'the-kubernetes-network-model' },
  dns: { page: 'web/kubernetes.io/docs/concepts/services-networking/dns-pod-service', anchor: 'namespaces-of-services', line: 'ndots:5' },
  ingress: { page: 'web/kubernetes.io/docs/concepts/services-networking/ingress', anchor: 'prerequisites' },
  gateway: { url: 'https://gateway-api.sigs.k8s.io/', label: 'gateway-api.sigs.k8s.io' },
  lifecycle: { page: 'web/kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle', anchor: 'container-restarts' },
  probes: { page: 'web/kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes', anchor: 'DESCRIPTION' },
  flannel: { url: 'https://github.com/flannel-io/flannel/blob/master/Documentation/backends.md', label: 'flannel › Backends' },
  cri: { url: 'https://kubernetes.io/docs/concepts/architecture/cri/', label: 'kubernetes.io › Container Runtime Interface' },
  cni: { url: 'https://www.cni.dev/docs/spec/', label: 'cni.dev › Specification' },
} satisfies Record<string, DocRef>;

export function node(id: string, label: QText, family: ColorFamily, shape: DiagramNode['shape'], x: number, y: number, w: number, h: number, what: Bi, who: Bi, see?: string, doc?: DocRef, sub?: string): DiagramNode {
  const card: ElementCard = { what, who, ...(see ? { see } : {}), ...(doc ? { doc } : {}) };
  return { id, label, family, shape, x, y, w, h, card, ...(sub ? { sub } : {}) };
}

export function edge(id: string, from: string, to: string, label: QText, what: Bi, who: Bi, o: { via?: [number, number][]; dashed?: boolean; labelAt?: number; see?: string; doc?: DocRef } = {}): DiagramEdge {
  return { id, from, to, label, card: { what, who, ...(o.see ? { see: o.see } : {}), ...(o.doc ? { doc: o.doc } : {}) }, ...(o.via ? { via: o.via } : {}), ...(o.dashed ? { dashed: true } : {}), ...(o.labelAt !== undefined ? { labelAt: o.labelAt } : {}) };
}

export const last = (s: Step[]) => s[s.length - 1];
export const metric = (s: Step[], k: string) => last(s)?.metrics?.[k] ?? 0;
export const anyBroken = (s: Step[]) => s.some((x) => x.broken);
