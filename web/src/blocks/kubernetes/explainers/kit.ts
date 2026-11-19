// Small builders for the Kubernetes process explainers: nodes and edges with
// their cards, the doc links the cards point to, the picture that starts with
// a few elements and grows, and the legend marks every explainer shares.

import { bi, pluralRu, type Bi } from '../../../core/i18n';
import type { ColorFamily, DiagramEdge, DiagramNode, DocRef, ElementCard, ElementState, LegendMark, NodeIcon, NodeWork, QText, Step } from '../../../core/types';

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
  netpol: { page: 'web/kubernetes.io/docs/concepts/services-networking/network-policies', anchor: 'behavior-of-to-and-from-selectors' },
  kubeadmInit: { page: 'help/kubeadm-init', anchor: 'DESCRIPTION', line: 'control-plane' },
  kubeadmJoin: { page: 'help/kubeadm-join', anchor: 'DESCRIPTION', line: 'discovery-token-ca-cert-hash' },
  pki: { page: 'web/kubernetes.io/docs/setup/best-practices/certificates', anchor: 'how-certificates-are-used-by-your-cluster' },
  staticPods: { page: 'web/kubernetes.io/docs/tasks/configure-pod-container/static-pod', anchor: 'DESCRIPTION', line: 'mirror Pod' },
  tlsBootstrap: { page: 'web/kubernetes.io/docs/reference/access-authn-authz/kubelet-tls-bootstrapping', anchor: 'approval' },
  etcdRecovery: { url: 'https://etcd.io/docs/v3.6/op-guide/recovery/', label: 'etcd.io › Disaster recovery' },
  upgrade: { url: 'https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-upgrade/', label: 'kubernetes.io › Upgrading kubeadm clusters' },
  drain: { page: 'web/kubernetes.io/docs/tasks/administer-cluster/safely-drain-node', anchor: 'use-kubectl-drain-to-remove-a-node-from-service' },
  skew: { page: 'web/kubernetes.io/docs/setup/release/version-skew-policy', anchor: 'kubelet', line: 'must not be newer' },
} satisfies Record<string, DocRef>;

/** A node with a pictogram: `box(id, label, family, shape, [x, y, w, h], icon, what, who, { see, doc, sub })`. */
export function box(id: string, label: QText, family: ColorFamily, shape: DiagramNode['shape'], at: [number, number, number, number], icon: NodeIcon, what: Bi, who: Bi, o: { see?: string; doc?: DocRef; sub?: string; work?: NodeWork } = {}): DiagramNode {
  const [x, y, w, h] = at;
  const card: ElementCard = { what, who, ...(o.see ? { see: o.see } : {}), ...(o.doc ? { doc: o.doc } : {}) };
  return { id, label, family, shape, x, y, w, h, icon, card, ...(o.sub ? { sub: o.sub } : {}), ...(o.work ? { work: o.work } : {}) };
}

/** States of the first step: every element of `all` is hidden except `shown`. */
export function only(all: string[], ...shown: string[]): Record<string, ElementState> {
  return Object.fromEntries(all.filter((id) => !shown.includes(id)).map((id) => [id, 'hidden' as ElementState]));
}

/** Ids of every node and edge of a diagram, for `only`. */
export const idsOf = (d: { nodes: { id: string }[]; edges: { id: string }[] }) => [...d.nodes.map((n) => n.id), ...d.edges.map((e) => e.id)];

/** The legend marks every Kubernetes explainer starts with; each adds its pictograms and states. */
export const LEGEND_BASE: { mark: LegendMark; text: Bi }[] = [
  { mark: 'active', text: bi('блок, который работает на этом шаге', 'the block working at this step') },
  { mark: 'say', text: bi('что этот блок делает прямо сейчас', 'what that block is doing now') },
  { mark: 'token', text: bi('что передаётся по линии дальше', 'what is handed on along the line') },
];

export const mark = (m: LegendMark, ru: string, en: string) => ({ mark: m, text: bi(ru, en) });

export function edge(id: string, from: string, to: string, label: QText, what: Bi, who: Bi, o: { via?: [number, number][]; dashed?: boolean; labelAt?: number; see?: string; doc?: DocRef } = {}): DiagramEdge {
  return { id, from, to, label, card: { what, who, ...(o.see ? { see: o.see } : {}), ...(o.doc ? { doc: o.doc } : {}) }, ...(o.via ? { via: o.via } : {}), ...(o.dashed ? { dashed: true } : {}), ...(o.labelAt !== undefined ? { labelAt: o.labelAt } : {}) };
}

export const last = (s: Step[]) => s[s.length - 1];
export const metric = (s: Step[], k: string) => last(s)?.metrics?.[k] ?? 0;
export const anyBroken = (s: Step[]) => s.some((x) => x.broken);

/** fmt with values that may themselves be bilingual: {v} takes v.ru in Russian and v.en in English. */
export function fmtb(b: Bi, vars: Record<string, string | number | Bi>): Bi {
  const fill = (s: string, lang: 'ru' | 'en') =>
    s.replace(/\{(\w+)\}/g, (m, k) => {
      const v = vars[k];
      if (v === undefined) return m;
      return typeof v === 'object' ? v[lang] : String(v);
    });
  return { ru: fill(b.ru, 'ru'), en: fill(b.en, 'en') };
}

/** A number with its noun in both languages: num(3, ['под', 'пода', 'подов'], ['pod', 'pods']) → «3 пода» / “3 pods”. */
export function num(n: number, ru: [string, string, string], en: [string, string]): Bi {
  return { ru: `${n} ${pluralRu(n, ru)}`, en: `${n} ${n === 1 ? en[0] : en[1]}` };
}
export const PODS: [[string, string, string], [string, string]] = [['под', 'пода', 'подов'], ['pod', 'pods']];
