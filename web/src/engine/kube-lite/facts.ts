// facts.k8s (09 §2.2 extension): the same shape from the simulator and from
// a real cluster (the blob of trainer-check.sh), so one predicate checks
// both:
//   k8s.objects[kind=Deployment][metadata.name=web].status.readyReplicas>=3
//   k8s.pods[ns=shop][ready=true]#>=3
//   k8s.nodes[ready=true]#>=3

import type { Cluster } from './cluster';
import { controllerOf, podReady } from './controllers';
import { podStatusWord } from './kubectl/printers';
import { httpFrom } from './network';
import type { Obj } from './util';

export interface PodFact {
  ns: string;
  name: string;
  phase: string;
  status: string;
  ready: boolean;
  node: string;
  ip: string;
  restarts: number;
  image: string;
  owner: string;
  labels: Record<string, string>;
  uid: string;
}

export interface NodeFact {
  name: string;
  ready: boolean;
  roles: string[];
  version: string;
  kernel: string;
  osImage: string;
  runtime: string;
  podCIDR: string;
  unschedulable: boolean;
  taints: string[];
}

export interface K8sFacts {
  env: 'sim' | 'real';
  context?: string;
  objects: Obj[];
  pods: PodFact[];
  nodes: NodeFact[];
  deployments: { ns: string; name: string; replicas: number; ready: number; available: number; updated: number; image: string }[];
  services: { ns: string; name: string; type: string; clusterIP: string; ports: string; selector: string; endpoints: number }[];
  components?: Record<string, boolean>;
  /** Simulator only: an HTTP probe from every pod named "client" to every Service (05 §5.6 probes). */
  reach?: { from: string; to: string; status: number; exit: number }[];
  timeline?: { rv: number; at: number; type: string; kind: string; ns: string; name: string; summary?: Record<string, unknown> }[];
  /** Real stage: what trainer-check.sh saw that proves it is not a simulator. */
  proof?: { nonce?: string; kernel?: string; collectedAt?: string; client?: string };
  absent?: string[];
}

export function summarizeObjects(objects: Obj[]): Pick<K8sFacts, 'pods' | 'nodes' | 'deployments' | 'services'> {
  const pods = objects
    .filter((o) => o.kind === 'Pod')
    .map(
      (p): PodFact => ({
        ns: p.metadata.namespace,
        name: p.metadata.name,
        phase: p.status?.phase ?? 'Pending',
        status: podStatusWord(p),
        ready: podReady(p),
        node: p.spec?.nodeName ?? '',
        ip: p.status?.podIP ?? '',
        restarts: (p.status?.containerStatuses ?? []).reduce((s: number, c: Obj) => s + (c.restartCount ?? 0), 0),
        image: (p.spec?.containers ?? []).map((c: Obj) => c.image).join(','),
        owner: controllerOf(p) ? `${controllerOf(p)!.kind}/${controllerOf(p)!.name}` : '',
        labels: p.metadata.labels ?? {},
        uid: p.metadata.uid,
      }),
    );
  const nodes = objects
    .filter((o) => o.kind === 'Node')
    .map(
      (n): NodeFact => ({
        name: n.metadata.name,
        ready: (n.status?.conditions ?? []).some((c: Obj) => c.type === 'Ready' && c.status === 'True'),
        roles: Object.keys(n.metadata.labels ?? {}).filter((k) => k.startsWith('node-role.kubernetes.io/')).map((k) => k.split('/')[1]),
        version: n.status?.nodeInfo?.kubeletVersion ?? '',
        kernel: n.status?.nodeInfo?.kernelVersion ?? '',
        osImage: n.status?.nodeInfo?.osImage ?? '',
        runtime: n.status?.nodeInfo?.containerRuntimeVersion ?? '',
        podCIDR: n.spec?.podCIDR ?? '',
        unschedulable: !!n.spec?.unschedulable,
        taints: (n.spec?.taints ?? []).map((t: Obj) => `${t.key}:${t.effect}`),
      }),
    );
  const slices = objects.filter((o) => o.kind === 'EndpointSlice');
  const deployments = objects
    .filter((o) => o.kind === 'Deployment')
    .map((d) => ({
      ns: d.metadata.namespace,
      name: d.metadata.name,
      replicas: d.spec?.replicas ?? 1,
      ready: d.status?.readyReplicas ?? 0,
      available: d.status?.availableReplicas ?? 0,
      updated: d.status?.updatedReplicas ?? 0,
      image: (d.spec?.template?.spec?.containers ?? []).map((c: Obj) => c.image).join(','),
    }));
  const services = objects
    .filter((o) => o.kind === 'Service')
    .map((s) => ({
      ns: s.metadata.namespace,
      name: s.metadata.name,
      type: s.spec?.type ?? 'ClusterIP',
      clusterIP: s.spec?.clusterIP ?? '',
      ports: (s.spec?.ports ?? []).map((p: Obj) => `${p.port}:${p.targetPort}/${p.protocol ?? 'TCP'}`).join(','),
      selector: Object.entries(s.spec?.selector ?? {}).map(([k, v]) => `${k}=${v}`).join(','),
      endpoints: slices.filter((x) => x.metadata.namespace === s.metadata.namespace && x.metadata.labels?.['kubernetes.io/service-name'] === s.metadata.name).reduce((n, x) => n + (x.endpoints ?? []).filter((e: Obj) => e.conditions?.ready !== false).length, 0),
    }));
  return { pods, nodes, deployments, services };
}

export function clusterFacts(c: Cluster): K8sFacts {
  const objects = c
    .all()
    .filter((o) => o.kind !== 'Event' && o.kind !== 'Lease')
    .map((o) => {
      const copy = JSON.parse(JSON.stringify(o)) as Obj;
      delete copy.metadata?.managedFields;
      if (copy.metadata?.annotations) delete copy.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration'];
      return copy;
    });
  return {
    env: 'sim',
    context: 'default',
    objects,
    ...summarizeObjects(objects),
    components: { ...c.components, ...Object.fromEntries(c.nodes.flatMap((n) => [[`power.${n.name}`, n.power], [`kubelet.${n.name}`, n.kubelet]])) },
    timeline: c.timeline.slice(-300),
    reach: reach(c),
  };
}

/** curl from each pod named client to each Service by its full name; counters are restored, so a check changes nothing. */
function reach(c: Cluster): K8sFacts['reach'] {
  const out: NonNullable<K8sFacts['reach']> = [];
  const saved = JSON.stringify(c.rr);
  const clients = c.list('Pod').filter((p) => p.metadata.name === 'client' && !p.metadata.deletionTimestamp);
  for (const cl of clients) {
    for (const s of c.list('Service')) {
      if (s.metadata.namespace === 'kube-system' || s.metadata.name === 'kubernetes') continue;
      const port = s.spec.ports?.[0]?.port ?? 80;
      const r = httpFrom(c, cl, `http://${s.metadata.name}.${s.metadata.namespace}.svc.cluster.local:${port}/`);
      out.push({ from: `${cl.metadata.namespace}/${cl.metadata.name}`, to: `${s.metadata.name}.${s.metadata.namespace}`, status: r.status ?? 0, exit: r.exit });
    }
  }
  c.rr = JSON.parse(saved);
  return out;
}
