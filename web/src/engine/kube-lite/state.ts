// The cluster attached to a simulated machine (SimMachineApi.ext('k8s')),
// the kubeconfig file kubectl reads, and the TerminalSetup.ext.k8s hook.

import YAML from 'yaml';
import type { SimMachineApi, Snapshotable } from '../../core/types';
import { Cluster, type ClusterOptions, type Components } from './cluster';
import { parseManifests } from './manifests';
import { runKubectl } from './kubectl/index';

export interface K8sSetup {
  /** Node names; default cp-1, worker-1, worker-2. */
  nodes?: string[];
  components?: Partial<Components>;
  controlPlaneTaint?: boolean;
  /** Manifests (YAML, several documents allowed) applied before the learner gets the prompt. */
  manifests?: string[];
  /** Commands run with kubectl as the cluster admin before the prompt (kubectl create deployment …). */
  kubectl?: string[];
  /** Virtual time to let pass after the manifests (default 30s). */
  settle?: number;
  /** Namespace of the default context. */
  namespace?: string;
  /** Extra contexts in the kubeconfig: name → namespace. */
  contexts?: Record<string, string>;
  /** Node power or component changes after the manifests ("the cluster you are given is broken"). */
  after?: { power?: Record<string, boolean>; components?: Partial<Components>; kubelet?: Record<string, boolean> };
  /** Start without CoreDNS (constructor runs). */
  bare?: boolean;
  seed?: number;
}

export class K8sState implements Snapshotable {
  cluster: Cluster | null = null;
  snapshot(): unknown {
    return this.cluster ? this.cluster.snapshot() : null;
  }
  restore(s: unknown): void {
    if (!s) {
      this.cluster = null;
      return;
    }
    const c = this.cluster ?? new Cluster({ nodes: (s as { nodes: { name: string }[] }).nodes.map((n) => n.name) });
    c.restore(s);
    this.cluster = c;
  }
}

export function k8sState(m: SimMachineApi): K8sState {
  return m.ext('k8s', () => new K8sState());
}

/** The cluster of this machine; created on first use when a kubeconfig exists. */
export function clusterOf(m: SimMachineApi, opts?: ClusterOptions): Cluster {
  const st = k8sState(m);
  if (!st.cluster) st.cluster = new Cluster(opts);
  return st.cluster;
}

export function machineNow(m: SimMachineApi): number {
  const anyM = m as unknown as { now?: () => number };
  return typeof anyM.now === 'function' ? anyM.now() : Date.now();
}

export const KUBECONFIG_PATH = (home: string) => `${home}/.kube/config`;

export function kubeconfigYaml(namespace: string | undefined, contexts: Record<string, string> = {}): string {
  const ctx = (name: string, ns?: string) => ({ context: { cluster: 'default', user: 'default', ...(ns ? { namespace: ns } : {}) }, name });
  const cfg = {
    apiVersion: 'v1',
    clusters: [{ cluster: { 'certificate-authority-data': 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUJkekNDQVIyZ0F3SUJBZ0lCQURBS0JnZ3Foa2pPUFFRREFqQWpNU0V3SHdZRFZRUUREQmhyTTNNdGMyVnkKLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo=', server: 'https://127.0.0.1:6443' }, name: 'default' }],
    contexts: [ctx('default', namespace), ...Object.entries(contexts).map(([n, ns]) => ctx(n, ns))],
    'current-context': 'default',
    kind: 'Config',
    preferences: {},
    users: [{ name: 'default', user: { 'client-certificate-data': 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUJrVENDQVRlZ0F3SUJBZ0lJUkVEQUNURUQKLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo=', 'client-key-data': 'LS0tLS1CRUdJTiBFQyBQUklWQVRFIEtFWS0tLS0tCk1IY0NBUUVFSUhSRURBQ1RFRAotLS0tLUVORCBFQyBQUklWQVRFIEtFWS0tLS0tCg==' } }],
  };
  return YAML.stringify(cfg);
}

/** The TerminalSetup.ext.k8s hook: a cluster, a kubeconfig, the scenario manifests. */
export async function applyK8sSetup(m: SimMachineApi, value: unknown): Promise<void> {
  const v = (value ?? {}) as K8sSetup;
  const st = k8sState(m);
  const c = new Cluster({ nodes: v.nodes, components: v.bare ? { ...v.components, coredns: false } : v.components, controlPlaneTaint: v.controlPlaneTaint, bare: v.bare, seed: v.seed });
  st.cluster = c;
  const login = m.users.find((u) => u.name === 'learner') ?? m.users.find((u) => u.uid >= 1000);
  for (const u of [login, m.users.find((x) => x.name === 'root')]) {
    if (!u) continue;
    const dir = `${u.home}/.kube`;
    if (!m.rootFs.exists(dir)) m.rootFs.mkdir(dir, { parents: true });
    m.rootFs.writeFile(KUBECONFIG_PATH(u.home), kubeconfigYaml(v.namespace, v.contexts));
    m.rootFs.chmod(KUBECONFIG_PATH(u.home), 0o600);
    m.rootFs.chown(dir, u.uid, u.gid);
    m.rootFs.chown(KUBECONFIG_PATH(u.home), u.uid, u.gid);
  }
  for (const text of v.manifests ?? []) {
    for (const doc of parseManifests(text, 'setup.yaml')) {
      try {
        c.apply(doc, { namespace: doc.metadata?.namespace });
      } catch (e) {
        console.warn('k8s setup manifest failed', (e as Error).message);
      }
    }
  }
  if (v.kubectl?.length) {
    for (const line of v.kubectl) await runKubectl(m, c, line.split(/\s+/).filter(Boolean).slice(line.startsWith('kubectl') ? 1 : 0), { quiet: true });
  }
  c.advance(v.settle ?? 30_000);
  if (v.after) {
    for (const [n, on] of Object.entries(v.after.power ?? {})) {
      const node = c.node(n);
      if (node) node.power = on;
    }
    for (const [n, on] of Object.entries(v.after.kubelet ?? {})) {
      const node = c.node(n);
      if (node) node.kubelet = on;
    }
    Object.assign(c.components, v.after.components ?? {});
    c.advance(1000);
  }
  c.timeline = [];
  c.lastReal = machineNow(m);
}
