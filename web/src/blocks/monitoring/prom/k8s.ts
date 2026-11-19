// The "Shop" running in Kubernetes (06 §7.10, C16): series of
// kube-state-metrics (from API objects) and of cAdvisor in the kubelet (from
// the cgroup files of every container). One api pod leaks memory and is
// OOM-killed every ~20 minutes; the worker is held at its CPU limit and
// throttled; the second worker replica stays Pending for lack of CPU.

import type { Labels, Series, Tsdb } from './data';

const NS = 'shop';
const Mi = 1024 * 1024;

interface PodSpec {
  pod: string;
  container: string;
  deployment: string;
  node: string;
  cpuLimit: number;
  cpuRequest: number;
  memLimit: number;
  memRequest: number;
  /** Average CPU use, cores. */
  cpu: number;
  /** Steady memory working set, bytes. */
  mem: number;
  pending?: boolean;
  leak?: boolean;
}

export const K8S_PODS: PodSpec[] = [
  { pod: 'api-6f9c7d-2xkqp', container: 'api', deployment: 'api', node: 'node-1', cpuLimit: 1, cpuRequest: 0.25, memLimit: 512 * Mi, memRequest: 256 * Mi, cpu: 0.21, mem: 210 * Mi },
  { pod: 'api-6f9c7d-8mzt4', container: 'api', deployment: 'api', node: 'node-2', cpuLimit: 1, cpuRequest: 0.25, memLimit: 512 * Mi, memRequest: 256 * Mi, cpu: 0.19, mem: 205 * Mi },
  { pod: 'api-6f9c7d-q7rvn', container: 'api', deployment: 'api', node: 'node-3', cpuLimit: 1, cpuRequest: 0.25, memLimit: 512 * Mi, memRequest: 256 * Mi, cpu: 0.2, mem: 190 * Mi, leak: true },
  { pod: 'frontend-58b7f4-k2l9d', container: 'frontend', deployment: 'frontend', node: 'node-1', cpuLimit: 0.5, cpuRequest: 0.1, memLimit: 256 * Mi, memRequest: 128 * Mi, cpu: 0.08, mem: 96 * Mi },
  { pod: 'frontend-58b7f4-x8w2c', container: 'frontend', deployment: 'frontend', node: 'node-2', cpuLimit: 0.5, cpuRequest: 0.1, memLimit: 256 * Mi, memRequest: 128 * Mi, cpu: 0.07, mem: 92 * Mi },
  { pod: 'worker-7c4d9b-5hxpl', container: 'worker', deployment: 'worker', node: 'node-3', cpuLimit: 0.2, cpuRequest: 0.2, memLimit: 256 * Mi, memRequest: 256 * Mi, cpu: 0.199, mem: 140 * Mi },
  { pod: 'worker-7c4d9b-r2vbn', container: 'worker', deployment: 'worker', node: '', cpuLimit: 0.2, cpuRequest: 0.2, memLimit: 256 * Mi, memRequest: 256 * Mi, cpu: 0, mem: 0, pending: true },
];

const DEPLOYMENTS = [
  { deployment: 'api', spec: 3 },
  { deployment: 'frontend', spec: 2 },
  { deployment: 'worker', spec: 2 },
];

/** Minutes before NOW at which the leaking api container is OOM-killed. */
export const OOM_AT_MIN = [70, 50, 30, 10];
const LEAK_FROM_MIN = 90;

export const K8S_META: Tsdb['meta'] = {
  kube_pod_status_phase: { type: 'gauge', help: 'The pods current phase.' },
  kube_pod_container_status_restarts_total: { type: 'counter', help: 'The number of container restarts per container.' },
  kube_pod_container_status_last_terminated_reason: { type: 'gauge', help: 'Describes the last reason the container was in terminated state.' },
  kube_pod_container_resource_limits: { type: 'gauge', help: 'The number of requested limit resource by a container.' },
  kube_pod_container_resource_requests: { type: 'gauge', help: 'The number of requested request resource by a container.' },
  kube_deployment_spec_replicas: { type: 'gauge', help: 'Number of desired pods for a deployment.' },
  kube_deployment_status_replicas_available: { type: 'gauge', help: 'The number of available replicas per deployment.' },
  kube_node_status_condition: { type: 'gauge', help: 'The condition of a cluster node.' },
  container_cpu_usage_seconds_total: { type: 'counter', help: 'Cumulative cpu time consumed in seconds.' },
  container_memory_working_set_bytes: { type: 'gauge', help: 'Current working set in bytes.' },
  container_spec_memory_limit_bytes: { type: 'gauge', help: 'Memory limit for the container.' },
  container_cpu_cfs_periods_total: { type: 'counter', help: 'Number of elapsed enforcement period intervals.' },
  container_cpu_cfs_throttled_periods_total: { type: 'counter', help: 'Number of throttled period intervals.' },
  container_oom_events_total: { type: 'counter', help: 'Count of out of memory events observed for the container.' },
};

export function kubeSeries(ts: (i: number) => number, steps: number, end: number, rand: () => number): Series[] {
  const out: Series[] = [];
  const series = (labels: Labels): Series => {
    const s = { labels, samples: [] as [number, number][] };
    out.push(s);
    return s;
  };
  const KSM = { job: 'kube-state-metrics', instance: 'kube-state-metrics:8080' };
  const kubelet = (node: string) => ({ job: 'kubelet', instance: `${node}:10250`, metrics_path: '/metrics/cadvisor', node });
  const oomTimes = OOM_AT_MIN.map((m) => end - m * 60_000);
  const leakFrom = end - LEAK_FROM_MIN * 60_000;
  const upKsm = series({ __name__: 'up', ...KSM });
  const upKubelet = ['node-1', 'node-2', 'node-3'].map((n) => series({ __name__: 'up', job: 'kubelet', instance: `${n}:10250`, metrics_path: '/metrics/cadvisor' }));
  for (let i = 0; i <= steps; i++) {
    upKsm.samples.push([ts(i), 1]);
    for (const u of upKubelet) u.samples.push([ts(i), 1]);
  }
  for (const d of DEPLOYMENTS) {
    const spec = series({ __name__: 'kube_deployment_spec_replicas', ...KSM, namespace: NS, deployment: d.deployment });
    const avail = series({ __name__: 'kube_deployment_status_replicas_available', ...KSM, namespace: NS, deployment: d.deployment });
    for (let i = 0; i <= steps; i++) {
      const t = ts(i);
      spec.samples.push([t, d.spec]);
      const running = K8S_PODS.filter((p) => p.deployment === d.deployment && !p.pending).length;
      // The leaking api pod is not Ready for a minute after each OOM kill.
      const down = d.deployment === 'api' && oomTimes.some((o) => t >= o && t < o + 60_000) ? 1 : 0;
      avail.samples.push([t, running - down]);
    }
  }
  for (const node of ['node-1', 'node-2', 'node-3']) {
    for (const status of ['true', 'false', 'unknown']) {
      const s = series({ __name__: 'kube_node_status_condition', ...KSM, node, condition: 'Ready', status });
      for (let i = 0; i <= steps; i++) s.samples.push([ts(i), status === 'true' ? 1 : 0]);
    }
  }
  for (const p of K8S_PODS) {
    const base = { namespace: NS, pod: p.pod };
    const cbase = { ...base, container: p.container };
    for (const phase of ['Pending', 'Running', 'Succeeded', 'Failed', 'Unknown']) {
      const s = series({ __name__: 'kube_pod_status_phase', ...KSM, ...base, phase });
      const on = p.pending ? phase === 'Pending' : phase === 'Running';
      for (let i = 0; i <= steps; i++) s.samples.push([ts(i), on ? 1 : 0]);
    }
    for (const [name, mem, cpu] of [['kube_pod_container_resource_limits', p.memLimit, p.cpuLimit], ['kube_pod_container_resource_requests', p.memRequest, p.cpuRequest]] as const) {
      const m = series({ __name__: name, ...KSM, ...cbase, ...(p.node ? { node: p.node } : {}), resource: 'memory', unit: 'byte' });
      const c = series({ __name__: name, ...KSM, ...cbase, ...(p.node ? { node: p.node } : {}), resource: 'cpu', unit: 'core' });
      for (let i = 0; i <= steps; i++) {
        m.samples.push([ts(i), mem]);
        c.samples.push([ts(i), cpu]);
      }
    }
    if (p.pending) continue;
    const restarts = series({ __name__: 'kube_pod_container_status_restarts_total', ...KSM, ...cbase });
    const reason = p.leak ? series({ __name__: 'kube_pod_container_status_last_terminated_reason', ...KSM, ...cbase, reason: 'OOMKilled' }) : null;
    const kl = kubelet(p.node);
    const cpuS = series({ __name__: 'container_cpu_usage_seconds_total', ...kl, ...cbase, cpu: 'total' });
    const memS = series({ __name__: 'container_memory_working_set_bytes', ...kl, ...cbase });
    const limS = series({ __name__: 'container_spec_memory_limit_bytes', ...kl, ...cbase });
    const per = series({ __name__: 'container_cpu_cfs_periods_total', ...kl, ...cbase });
    const thr = series({ __name__: 'container_cpu_cfs_throttled_periods_total', ...kl, ...cbase });
    const oom = series({ __name__: 'container_oom_events_total', ...kl, ...cbase });
    let cpuAcc = 0;
    let perAcc = 0;
    let thrAcc = 0;
    let n = 0;
    let lastStart = leakFrom;
    for (let i = 0; i <= steps; i++) {
      const t = ts(i);
      const killed = oomTimes.filter((o) => o <= t);
      if (p.leak && killed.length > n) {
        n = killed.length;
        lastStart = killed[killed.length - 1];
        cpuAcc = 0; // a new container: a new cgroup, the counter starts again
      }
      const dt = (ts(1) - ts(0)) / 1000;
      const use = p.cpu * (0.85 + 0.3 * rand());
      const used = Math.min(use, p.cpuLimit);
      cpuAcc += used * dt;
      const periods = dt * 10; // 100 ms CFS periods
      perAcc += periods;
      if (p.deployment === 'worker') thrAcc += periods * (0.55 + 0.1 * rand());
      else if (used > p.cpuLimit * 0.9) thrAcc += periods * 0.05;
      let mem = p.mem * (0.97 + 0.06 * rand());
      if (p.leak && t >= leakFrom) {
        const since = (t - lastStart) / 60_000;
        mem = Math.min(p.memLimit * 0.995, p.mem + (since / 20) * (p.memLimit - p.mem));
      }
      cpuS.samples.push([t, Math.round(cpuAcc * 1000) / 1000]);
      memS.samples.push([t, Math.round(mem)]);
      limS.samples.push([t, p.memLimit]);
      per.samples.push([t, Math.round(perAcc)]);
      thr.samples.push([t, Math.round(thrAcc)]);
      oom.samples.push([t, n]);
      restarts.samples.push([t, n]);
      if (reason && n > 0) reason.samples.push([t, 1]);
    }
    if (reason && !reason.samples.length) out.splice(out.indexOf(reason), 1);
  }
  return out;
}
