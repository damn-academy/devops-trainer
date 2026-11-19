// kube-scheduler-lite (05 §5.4): filter → score → bind, with the real
// plugin names and the real FailedScheduling message:
//   0/3 nodes are available: 1 node(s) had untolerated taint {k: v}, 2 Insufficient memory.
//   preemption: 0/3 nodes are available: 1 Preemption is not helpful for scheduling, 2 No preemption victims found for incoming pod.

import type { Cluster } from './cluster';
import { bytes, cpuMilli, iso, type Obj } from './util';

export interface FilterResult {
  node: string;
  ok: boolean;
  /** The reason in the FailedScheduling wording. */
  reason?: string;
  plugin?: string;
  /** Resource shortage: preemption could help in principle (no victims here). */
  resources?: boolean;
}

export function podRequests(spec: Obj): { cpu: number; memory: number } {
  let cpu = 0;
  let memory = 0;
  for (const c of spec?.containers ?? []) {
    const r = c.resources?.requests ?? c.resources?.limits ?? {};
    cpu += cpuMilli(r.cpu);
    memory += bytes(r.memory);
  }
  return { cpu, memory };
}

export function tolerates(tolerations: Obj[] | undefined, taint: Obj): boolean {
  return (tolerations ?? []).some((t) => {
    if (t.effect && t.effect !== taint.effect) return false;
    if (t.operator === 'Exists') return !t.key || t.key === taint.key;
    return t.key === taint.key && (t.value ?? '') === (taint.value ?? '');
  });
}

function matchesNodeSelectorTerm(term: Obj, node: Obj): boolean {
  for (const e of term.matchExpressions ?? []) {
    const v = node.metadata.labels?.[e.key];
    if (e.operator === 'In' && !e.values?.includes(v)) return false;
    if (e.operator === 'NotIn' && e.values?.includes(v)) return false;
    if (e.operator === 'Exists' && v === undefined) return false;
    if (e.operator === 'DoesNotExist' && v !== undefined) return false;
  }
  for (const f of term.matchFields ?? []) if (f.key === 'metadata.name' && f.operator === 'In' && !f.values?.includes(node.metadata.name)) return false;
  return true;
}

/** Requested resources on a node by pods that are not finished. */
export function nodeUsage(c: Cluster, node: string): { cpu: number; memory: number; pods: number } {
  let cpu = 0;
  let memory = 0;
  let pods = 0;
  for (const p of c.list('Pod')) {
    if (p.spec.nodeName !== node || p.status?.phase === 'Succeeded' || p.status?.phase === 'Failed') continue;
    const r = podRequests(p.spec);
    cpu += r.cpu;
    memory += r.memory;
    pods++;
  }
  return { cpu, memory, pods };
}

/** Run every filter plugin for one pod on every node. */
export function filterNodes(c: Cluster, pod: Obj): FilterResult[] {
  const req = podRequests(pod.spec);
  return c.list('Node').map((n): FilterResult => {
    const name = n.metadata.name;
    const taints: Obj[] = n.spec?.taints ?? [];
    if (n.spec?.unschedulable && !tolerates(pod.spec.tolerations, { key: 'node.kubernetes.io/unschedulable', effect: 'NoSchedule' })) return { node: name, ok: false, plugin: 'NodeUnschedulable', reason: "node(s) were unschedulable" };
    const sel = pod.spec.nodeSelector ?? {};
    if (Object.entries(sel).some(([k, v]) => n.metadata.labels?.[k] !== v)) return { node: name, ok: false, plugin: 'NodeAffinity', reason: "node(s) didn't match Pod's node affinity/selector" };
    const terms: Obj[] | undefined = pod.spec.affinity?.nodeAffinity?.requiredDuringSchedulingIgnoredDuringExecution?.nodeSelectorTerms;
    if (terms?.length && !terms.some((t) => matchesNodeSelectorTerm(t, n))) return { node: name, ok: false, plugin: 'NodeAffinity', reason: "node(s) didn't match Pod's node affinity/selector" };
    const bad = taints.find((t) => (t.effect === 'NoSchedule' || t.effect === 'NoExecute') && !tolerates(pod.spec.tolerations, t));
    if (bad) return { node: name, ok: false, plugin: 'TaintToleration', reason: `node(s) had untolerated taint {${bad.key}: ${bad.value ?? ''}}` };
    const alloc = n.status?.allocatable ?? {};
    const used = nodeUsage(c, name);
    const short: string[] = [];
    if (used.pods + 1 > Number(alloc.pods ?? 110)) short.push('Too many pods');
    if (req.cpu && used.cpu + req.cpu > cpuMilli(alloc.cpu)) short.push('Insufficient cpu');
    if (req.memory && used.memory + req.memory > bytes(alloc.memory)) short.push('Insufficient memory');
    if (short.length) return { node: name, ok: false, plugin: 'NodeResourcesFit', reason: short.join(', '), resources: true };
    return { node: name, ok: true };
  });
}

/** LeastAllocated (higher is better, 0–100) plus a small ImageLocality bonus. */
export function scoreNode(c: Cluster, pod: Obj, node: Obj): number {
  const req = podRequests(pod.spec);
  const used = nodeUsage(c, node.metadata.name);
  const alloc = node.status?.allocatable ?? {};
  // The scheduler counts a pod without requests as 100m CPU and 200 MiB (non-zero defaults).
  const cpu = used.cpu + (req.cpu || 100);
  const mem = used.memory + (req.memory || 200 * 2 ** 20);
  const cpuFree = Math.max(0, 1 - cpu / Math.max(1, cpuMilli(alloc.cpu)));
  const memFree = Math.max(0, 1 - mem / Math.max(1, bytes(alloc.memory)));
  const least = ((cpuFree + memFree) / 2) * 100;
  const sim = c.node(node.metadata.name);
  const images = (pod.spec.containers ?? []).filter((ct: Obj) => sim?.images.includes(String(ct.image))).length;
  return Math.round(least) + images * 3 - used.pods * 0.01;
}

/** The FailedScheduling message from filter results. */
export function failedMessage(results: FilterResult[]): string {
  const total = results.length;
  const count = (items: string[]) => {
    const m = new Map<string, number>();
    for (const r of items) m.set(r, (m.get(r) ?? 0) + 1);
    // kube-scheduler sorts the formatted "<count> <reason>" strings (sort.Strings).
    return [...m.entries()].map(([r, n]) => `${n} ${r}`).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  };
  const reasons: string[] = [];
  for (const r of results) if (!r.ok && r.reason) for (const part of r.reason.split(', ')) reasons.push(part);
  const pre = count(results.filter((r) => !r.ok).map((r) => (r.resources ? 'No preemption victims found for incoming pod' : 'Preemption is not helpful for scheduling')));
  return `0/${total} nodes are available: ${count(reasons).join(', ')}. preemption: 0/${total} nodes are available: ${pre.join(', ')}.`;
}

/** One scheduling pass: every pending pod without a node. */
export function runScheduler(c: Cluster): void {
  const pods = c.list('Pod').filter((p) => !p.spec.nodeName && !p.metadata.deletionTimestamp && (p.spec.schedulerName ?? 'default-scheduler') === 'default-scheduler');
  pods.sort((a, b) => (b.spec.priority ?? 0) - (a.spec.priority ?? 0) || a.metadata.creationTimestamp.localeCompare(b.metadata.creationTimestamp));
  for (const pod of pods) {
    const results = filterNodes(c, pod);
    const fit = results.filter((r) => r.ok);
    if (!fit.length) {
      const msg = failedMessage(results);
      const cond = (pod.status?.conditions ?? []).find((x: Obj) => x.type === 'PodScheduled');
      if (!cond || cond.message !== msg) {
        c.putStatus(pod, { ...pod.status, phase: 'Pending', conditions: [{ type: 'PodScheduled', status: 'False', reason: 'Unschedulable', message: msg, lastProbeTime: null, lastTransitionTime: iso(c.now) }] });
      }
      const fresh = c.get('Pod', pod.metadata.namespace, pod.metadata.name)!;
      const last = c.eventsFor(fresh).filter((e) => e.reason === 'FailedScheduling').pop();
      // The scheduler retries; an unchanged message is re-reported about once a minute.
      if (!last || last.message !== msg || c.now - Date.parse(last.lastTimestamp) >= 60_000) c.event(fresh, 'Warning', 'FailedScheduling', msg, 'default-scheduler');
      continue;
    }
    const nodes = c.list('Node');
    let best = fit[0].node;
    let bestScore = -Infinity;
    for (const r of fit) {
      const s = scoreNode(c, pod, nodes.find((n) => n.metadata.name === r.node)!);
      if (s > bestScore) {
        bestScore = s;
        best = r.node;
      }
    }
    // The Binding subresource: nodeName is set by the API server on POST …/binding.
    const bound = c.put({
      ...pod,
      spec: { ...pod.spec, nodeName: best },
      status: { ...pod.status, conditions: [{ type: 'PodScheduled', status: 'True', lastProbeTime: null, lastTransitionTime: iso(c.now) }] },
    });
    c.event(bound, 'Normal', 'Scheduled', `Successfully assigned ${pod.metadata.namespace}/${pod.metadata.name} to ${best}`, 'default-scheduler');
  }
}
