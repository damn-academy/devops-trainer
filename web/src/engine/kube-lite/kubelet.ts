// kubelet-lite (05 §5.4): one per node. It renews its Lease every 10 s,
// reports the node condition, and turns pods bound to its node into
// "containers": sandbox and IP from the CNI, image pull (or ErrImagePull →
// ImagePullBackOff), start, probes, crashes with CrashLoopBackOff
// (10 s doubling to 300 s), OOMKilled at the memory limit, graceful
// termination. It writes only pod status and events, through the API, like
// the real kubelet.

import type { Cluster, NodeSim } from './cluster';
import { nodeStatus } from './cluster';
import { fqImage, imageDigest, imageRef, lookupImage, type ImageBehaviour } from './images';
import { podReady } from './controllers';
import { bytes, deepEqual, hex, iso, sha256, type Obj } from './util';

export interface ContainerRuntime {
  name: string;
  image: string;
  state: 'waiting' | 'running' | 'terminated';
  reason?: string;
  message?: string;
  startedAt?: number;
  finishedAt?: number;
  exitCode?: number;
  restartCount: number;
  /** When the next pull / restart is due. */
  nextAt?: number;
  backoff: number;
  pullBackoff: number;
  pulling?: boolean;
  /** When the process exits by itself (crash, job end, OOM). */
  exitAt?: number;
  exitReason?: string;
  exitWith?: number;
  ready: boolean;
  /** A started probe has succeeded once (startupProbe). */
  started: boolean;
  probeFails: { live: number; ready: number; startup: number };
  lastProbe: { live: number; ready: number; startup: number };
  logs: string[];
  prevLogs: string[];
  lastTerm?: { exitCode: number; reason: string; startedAt: number; finishedAt: number };
  id: string;
  boot: number;
}

export interface PodRuntime {
  uid: string;
  ns: string;
  name: string;
  node: string;
  ip?: string;
  sandbox: boolean;
  sandboxFailAt?: number;
  containers: ContainerRuntime[];
  killAt?: number;
  boot: number;
}

const BACKOFF0 = 10_000;
const BACKOFF_MAX = 300_000;
const PULL_MS = 1500;

function fill(s: string, pod: Obj, rt: PodRuntime, env: Record<string, string>, ct: Obj): string {
  const port = (ct.ports?.[0]?.containerPort as number | undefined) ?? lookupImage(ct.image)?.ports[0] ?? 80;
  return s
    .replace(/\{pod\}/g, pod.metadata.name)
    .replace(/\{ip\}/g, rt.ip ?? '')
    .replace(/\{port\}/g, String(lookupImage(ct.image)?.ports[0] ?? port))
    .replace(/\{version\}/g, imageRef(ct.image).split(':').pop() ?? '')
    .replace(/\{env:(\w+)\}/g, (_m, k: string) => env[k] ?? '');
}

/** The environment a container sees: env, envFrom, valueFrom (ConfigMap/Secret/fieldRef). */
export function containerEnv(c: Cluster, pod: Obj, ct: Obj): { env: Record<string, string>; missing?: string } {
  const ns = pod.metadata.namespace;
  const env: Record<string, string> = {};
  for (const from of ct.envFrom ?? []) {
    if (from.configMapRef) {
      const cm = c.get('ConfigMap', ns, from.configMapRef.name);
      if (!cm) {
        if (from.configMapRef.optional) continue;
        return { env, missing: `configmap "${from.configMapRef.name}" not found` };
      }
      for (const [k, v] of Object.entries(cm.data ?? {})) env[(from.prefix ?? '') + k] = String(v);
    }
    if (from.secretRef) {
      const s = c.get('Secret', ns, from.secretRef.name);
      if (!s) {
        if (from.secretRef.optional) continue;
        return { env, missing: `secret "${from.secretRef.name}" not found` };
      }
      for (const [k, v] of Object.entries(s.data ?? {})) env[(from.prefix ?? '') + k] = decode(String(v));
    }
  }
  for (const e of ct.env ?? []) {
    if (e.value !== undefined) env[e.name] = String(e.value);
    else if (e.valueFrom?.configMapKeyRef) {
      const r = e.valueFrom.configMapKeyRef;
      const cm = c.get('ConfigMap', ns, r.name);
      if (!cm) {
        if (r.optional) continue;
        return { env, missing: `configmap "${r.name}" not found` };
      }
      if (!(r.key in (cm.data ?? {}))) {
        if (r.optional) continue;
        return { env, missing: `couldn't find key ${r.key} in ConfigMap ${ns}/${r.name}` };
      }
      env[e.name] = String(cm.data[r.key]);
    } else if (e.valueFrom?.secretKeyRef) {
      const r = e.valueFrom.secretKeyRef;
      const s = c.get('Secret', ns, r.name);
      if (!s) {
        if (r.optional) continue;
        return { env, missing: `secret "${r.name}" not found` };
      }
      if (!(r.key in (s.data ?? {}))) return { env, missing: `couldn't find key ${r.key} in Secret ${ns}/${r.name}` };
      env[e.name] = decode(String(s.data[r.key]));
    } else if (e.valueFrom?.fieldRef) {
      const f = e.valueFrom.fieldRef.fieldPath;
      env[e.name] = f === 'metadata.name' ? pod.metadata.name : f === 'metadata.namespace' ? ns : f === 'spec.nodeName' ? pod.spec.nodeName : f === 'status.podIP' ? (pod.status?.podIP ?? '') : '';
    }
  }
  for (const v of pod.spec.volumes ?? []) {
    if (v.configMap && !v.configMap.optional && !c.get('ConfigMap', ns, v.configMap.name)) return { env, missing: `configmap "${v.configMap.name}" not found` };
    if (v.secret && !v.secret.optional && !c.get('Secret', ns, v.secret.secretName)) return { env, missing: `secret "${v.secret.secretName}" not found` };
  }
  return { env };
}

function decode(b: string): string {
  try {
    const bin = atob(b);
    return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
  } catch {
    return b;
  }
}

/** The answer of one probe of a running container, as the kubelet would see it. */
export function probeResult(rt: PodRuntime, cr: ContainerRuntime, probe: Obj, now: number): { ok: boolean; message: string } {
  const img = lookupImage(cr.image);
  const warm = !img?.warmup || now - (cr.startedAt ?? now) >= img.warmup;
  if (probe.exec) return { ok: warm, message: warm ? '' : 'command timed out' };
  if (probe.tcpSocket) {
    const port = Number(probe.tcpSocket.port);
    const ok = !!img?.ports.includes(port) && warm;
    return { ok, message: ok ? '' : `dial tcp ${rt.ip}:${port}: connect: connection refused` };
  }
  if (probe.httpGet) {
    const port = Number(probe.httpGet.port);
    const path = probe.httpGet.path ?? '/';
    if (!img?.ports.includes(port)) return { ok: false, message: `Get "http://${rt.ip}:${port}${path}": dial tcp ${rt.ip}:${port}: connect: connection refused` };
    if (!warm) return { ok: false, message: `Get "http://${rt.ip}:${port}${path}": context deadline exceeded (Client.Timeout exceeded while awaiting headers)` };
    const http = img.http ?? [];
    if (!http.includes(path) && !(port === 8181 && path === '/ready') && !(port === 8080 && path === '/health')) return { ok: false, message: `HTTP probe failed with statuscode: 404` };
    return { ok: true, message: '' };
  }
  return { ok: true, message: '' };
}

function behaviour(ref: string): ImageBehaviour | undefined {
  return lookupImage(ref);
}

function containerId(seed: string): string {
  return hex(sha256(seed));
}

/** Start (or restart) a container process. */
function start(c: Cluster, pod: Obj, rt: PodRuntime, cr: ContainerRuntime, ct: Obj, env: Record<string, string>): void {
  const img = behaviour(ct.image)!;
  cr.state = 'running';
  cr.reason = undefined;
  cr.message = undefined;
  cr.startedAt = c.now;
  cr.ready = false;
  cr.started = !ct.startupProbe;
  cr.probeFails = { live: 0, ready: 0, startup: 0 };
  cr.lastProbe = { live: c.now, ready: c.now - 60_000, startup: c.now };
  cr.prevLogs = cr.logs;
  cr.id = containerId(`${rt.uid}/${cr.name}/${cr.restartCount}`);
  cr.logs = (img.logs ?? []).map((l) => `${iso(c.now)} ${fill(l, pod, rt, env, ct)}`);
  if ((ct.command ?? []).length || (ct.args ?? []).length) {
    const line = [...(ct.command ?? []), ...(ct.args ?? [])].join(' ');
    const echo = /^(?:sh -c )?echo (.*)$/.exec(line);
    if (echo) cr.logs.push(`${iso(c.now)} ${echo[1].replace(/^["']|["']$/g, '')}`);
  }
  cr.exitAt = undefined;
  cr.exitReason = undefined;
  cr.exitWith = undefined;
  if (img.exitAfter) {
    cr.exitAt = c.now + img.exitAfter;
    cr.exitWith = img.exitCode ?? 1;
    cr.exitReason = (img.exitCode ?? 1) === 0 ? 'Completed' : 'Error';
  }
  if (img.fromEnv) {
    cr.exitAt = c.now + Number(env.DURATION ?? '5') * 1000;
    cr.exitWith = Number(env.EXIT_CODE ?? '0');
    cr.exitReason = cr.exitWith === 0 ? 'Completed' : 'Error';
  }
  // busybox-like images exit at once unless told to sleep.
  if (!img.ports.length && !img.fromEnv && !img.memMiB && !['trainer/client:1.0'].includes(imageRef(ct.image))) {
    const line = [...(ct.command ?? []), ...(ct.args ?? [])].join(' ');
    const sleep = /sleep (\d+|infinity)/.exec(line);
    if (!sleep) {
      cr.exitAt = c.now + 200;
      cr.exitWith = 0;
      cr.exitReason = 'Completed';
    } else if (sleep[1] !== 'infinity') {
      cr.exitAt = c.now + Number(sleep[1]) * 1000;
      cr.exitWith = 0;
      cr.exitReason = 'Completed';
    }
  }
  const memLimit = bytes(ct.resources?.limits?.memory);
  const want = img.memMiB === 'MEM_MB' ? Number(env.MEM_MB ?? '64') : (img.memMiB ?? 0);
  if (memLimit && want * 2 ** 20 > memLimit) {
    cr.exitAt = c.now + 800;
    cr.exitWith = 137;
    cr.exitReason = 'OOMKilled';
  }
  c.event(pod, 'Normal', 'Created', `Created container: ${cr.name}`, 'kubelet', rt.node);
  c.event(pod, 'Normal', 'Started', `Started container ${cr.name}`, 'kubelet', rt.node);
}

function terminate(c: Cluster, pod: Obj, rt: PodRuntime, cr: ContainerRuntime, code: number, reason: string): void {
  cr.lastTerm = { exitCode: code, reason, startedAt: cr.startedAt ?? c.now, finishedAt: c.now };
  if (reason === 'Error' && behaviour(cr.image)?.crashLine) cr.logs.push(`${iso(c.now)} ${behaviour(cr.image)!.crashLine}`);
  const policy = pod.spec.restartPolicy ?? 'Always';
  const restart = policy === 'Always' || (policy === 'OnFailure' && code !== 0);
  cr.ready = false;
  if (!restart) {
    cr.state = 'terminated';
    cr.exitCode = code;
    cr.reason = reason;
    cr.finishedAt = c.now;
    return;
  }
  // A container that ran for 10 minutes gets its back-off reset.
  if (c.now - (cr.startedAt ?? c.now) > 600_000) cr.backoff = 0;
  cr.backoff = cr.backoff ? Math.min(cr.backoff * 2, BACKOFF_MAX) : BACKOFF0;
  cr.state = 'waiting';
  cr.reason = 'CrashLoopBackOff';
  cr.message = `back-off ${Math.round(cr.backoff / 1000) >= 60 ? `${Math.round(cr.backoff / 60_000)}m0s` : `${Math.round(cr.backoff / 1000)}s`} restarting failed container=${cr.name} pod=${pod.metadata.name}_${pod.metadata.namespace}(${pod.metadata.uid})`;
  cr.nextAt = c.now + cr.backoff;
  c.event(pod, 'Warning', 'BackOff', `Back-off restarting failed container ${cr.name} in pod ${pod.metadata.name}_${pod.metadata.namespace}(${pod.metadata.uid})`, 'kubelet', rt.node);
}

function stepContainer(c: Cluster, node: NodeSim, pod: Obj, rt: PodRuntime, cr: ContainerRuntime, ct: Obj): void {
  const img = behaviour(ct.image);
  if (cr.state === 'running') {
    if (cr.exitAt !== undefined && c.now >= cr.exitAt) {
      if (cr.exitReason === 'OOMKilled') cr.logs.push(`${iso(c.now)} allocating memory…`);
      terminate(c, pod, rt, cr, cr.exitWith ?? 1, cr.exitReason ?? 'Error');
      return;
    }
    // Probes.
    const run = (kind: 'live' | 'ready' | 'startup', probe: Obj | undefined) => {
      if (!probe) return;
      const initial = (probe.initialDelaySeconds ?? 0) * 1000;
      const period = (probe.periodSeconds ?? 10) * 1000;
      if (c.now - (cr.startedAt ?? c.now) < initial) return;
      if (c.now - cr.lastProbe[kind] < period && !(kind === 'ready' && cr.lastProbe.ready < (cr.startedAt ?? 0) + initial)) return;
      cr.lastProbe[kind] = c.now;
      const r = probeResult(rt, cr, probe, c.now);
      const label = kind === 'live' ? 'Liveness' : kind === 'ready' ? 'Readiness' : 'Startup';
      if (r.ok) {
        cr.probeFails[kind] = 0;
        if (kind === 'ready') cr.ready = true;
        if (kind === 'startup') cr.started = true;
        return;
      }
      cr.probeFails[kind]++;
      c.event(pod, 'Warning', 'Unhealthy', `${label} probe failed: ${r.message}`, 'kubelet', rt.node);
      if (cr.probeFails[kind] >= (probe.failureThreshold ?? 3)) {
        if (kind === 'ready') cr.ready = false;
        else {
          c.event(pod, 'Normal', 'Killing', `Container ${cr.name} failed ${kind === 'live' ? 'liveness' : 'startup'} probe, will be restarted`, 'kubelet', rt.node);
          terminate(c, pod, rt, cr, img?.ignoresTerm ? 137 : 143, 'Error');
        }
      }
    };
    if (!cr.started) run('startup', ct.startupProbe);
    if (cr.started) {
      run('live', ct.livenessProbe);
      if (cr.state !== 'running') return;
      if (ct.readinessProbe) run('ready', ct.readinessProbe);
      else cr.ready = true;
    }
    return;
  }
  if (cr.state === 'terminated') return;
  // waiting: config → image → start
  if (cr.nextAt !== undefined && c.now < cr.nextAt) return;
  const { env, missing } = containerEnv(c, pod, ct);
  if (missing) {
    if (cr.reason !== 'CreateContainerConfigError' || c.now - (cr.nextAt ?? 0) >= 10_000) c.event(pod, 'Warning', 'Failed', `Error: ${missing}`, 'kubelet', rt.node);
    cr.reason = 'CreateContainerConfigError';
    cr.message = missing;
    cr.nextAt = c.now + 10_000;
    return;
  }
  const ref = String(ct.image);
  const until = (cr as ContainerRuntime & { backoffUntil?: number }).backoffUntil;
  if (cr.reason === 'ErrImagePull' && until && c.now < until) {
    cr.reason = 'ImagePullBackOff';
    cr.message = `Back-off pulling image "${ref}"`;
    c.event(pod, 'Normal', 'BackOff', `Back-off pulling image "${ref}"`, 'kubelet', rt.node);
    c.event(pod, 'Warning', 'Failed', 'Error: ImagePullBackOff', 'kubelet', rt.node);
    cr.nextAt = until;
    return;
  }
  const cached = node.images.includes(ref);
  if (!cached || ct.imagePullPolicy === 'Always') {
    if (!cr.pulling) {
      cr.pulling = true;
      cr.reason = cr.reason === 'ImagePullBackOff' ? 'ImagePullBackOff' : 'ContainerCreating';
      cr.nextAt = c.now + (img ? PULL_MS : 1000);
      c.event(pod, 'Normal', 'Pulling', `Pulling image "${ref}"`, 'kubelet', rt.node);
      return;
    }
    cr.pulling = false;
    if (!img) {
      const fq = fqImage(ref);
      const msg = `Failed to pull image "${ref}": rpc error: code = NotFound desc = failed to pull and unpack image "${fq}": failed to resolve reference "${fq}": ${fq}: not found`;
      c.event(pod, 'Warning', 'Failed', msg, 'kubelet', rt.node);
      c.event(pod, 'Warning', 'Failed', 'Error: ErrImagePull', 'kubelet', rt.node);
      cr.pullBackoff = cr.pullBackoff ? Math.min(cr.pullBackoff * 2, BACKOFF_MAX) : BACKOFF0;
      // ErrImagePull right after the failure, ImagePullBackOff while waiting.
      cr.reason = 'ErrImagePull';
      cr.message = msg.replace(/^Failed to pull image "[^"]+": /, '');
      cr.nextAt = c.now + 1000;
      (cr as ContainerRuntime & { backoffUntil?: number }).backoffUntil = c.now + cr.pullBackoff;
      return;
    }
    if (!node.images.includes(ref)) node.images.push(ref);
    c.event(pod, 'Normal', 'Pulled', `Successfully pulled image "${ref}" in 1.512s (1.512s including waiting). Image size: ${img.size} bytes.`, 'kubelet', rt.node);
  } else if (cr.restartCount === 0 && cr.state === 'waiting' && !cr.startedAt) {
    c.event(pod, 'Normal', 'Pulled', `Container image "${ref}" already present on machine`, 'kubelet', rt.node);
  }
  if (cr.reason === 'CrashLoopBackOff') cr.restartCount++;
  start(c, pod, rt, cr, ct, env);
}

function newContainer(ct: Obj, boot: number): ContainerRuntime {
  return { name: ct.name, image: ct.image, state: 'waiting', reason: 'ContainerCreating', restartCount: 0, backoff: 0, pullBackoff: 0, ready: false, started: false, probeFails: { live: 0, ready: 0, startup: 0 }, lastProbe: { live: 0, ready: 0, startup: 0 }, logs: [], prevLogs: [], id: '', boot };
}

/** Build the pod status the kubelet reports from its runtime view. */
export function podStatus(c: Cluster, pod: Obj, rt: PodRuntime, node: NodeSim): Obj {
  const prev: Obj = pod.status ?? {};
  const t = (ms?: number) => (ms ? iso(ms) : undefined);
  const cs = rt.containers.map((cr) => {
    const ct = (pod.spec.containers ?? []).find((x: Obj) => x.name === cr.name) ?? {};
    const state: Obj =
      cr.state === 'running'
        ? { running: { startedAt: t(cr.startedAt) } }
        : cr.state === 'terminated'
          ? { terminated: { containerID: `containerd://${cr.id}`, exitCode: cr.exitCode, finishedAt: t(cr.finishedAt), reason: cr.reason, startedAt: t(cr.startedAt) } }
          : { waiting: { reason: cr.reason ?? 'ContainerCreating', ...(cr.message ? { message: cr.message } : {}) } };
    const out: Obj = {
      allocatedResources: ct.resources?.requests,
      containerID: cr.id ? `containerd://${cr.id}` : undefined,
      image: ct.image,
      imageID: cr.id ? imageDigest(ct.image, (s) => hex(sha256(s))) : '',
      lastState: cr.lastTerm ? { terminated: { containerID: `containerd://${containerId(`${rt.uid}/${cr.name}/${cr.restartCount - 1}`)}`, exitCode: cr.lastTerm.exitCode, finishedAt: t(cr.lastTerm.finishedAt), reason: cr.lastTerm.reason, startedAt: t(cr.lastTerm.startedAt) } } : {},
      name: cr.name,
      ready: cr.state === 'running' && cr.ready,
      restartCount: cr.restartCount,
      started: cr.state === 'running',
      state,
      volumeMounts: (ct.volumeMounts ?? []).map((m: Obj) => ({ mountPath: m.mountPath, name: m.name, ...(m.readOnly ? { readOnly: true, recursiveReadOnly: 'Disabled' } : {}) })),
    };
    if (!out.allocatedResources) delete out.allocatedResources;
    if (!out.containerID) delete out.containerID;
    return out;
  });
  const allRunning = rt.containers.length > 0 && rt.containers.every((x) => x.state === 'running');
  const allReady = allRunning && rt.containers.every((x) => x.ready);
  const policy = pod.spec.restartPolicy ?? 'Always';
  let phase = 'Pending';
  if (rt.containers.some((x) => x.startedAt)) phase = 'Running';
  if (policy !== 'Always' && rt.containers.length && rt.containers.every((x) => x.state === 'terminated')) phase = rt.containers.every((x) => x.exitCode === 0) ? 'Succeeded' : 'Failed';
  const nodeUnknown = (c.get('Node', undefined, node.name)?.status?.conditions ?? []).some((x: Obj) => x.type === 'Ready' && x.status === 'Unknown');
  const prevCond = (type: string) => (prev.conditions ?? []).find((x: Obj) => x.type === type);
  const cond = (type: string, ok: boolean, reason?: string) => {
    const p = prevCond(type);
    const status = ok ? 'True' : 'False';
    return { type, status, lastProbeTime: null, lastTransitionTime: p && p.status === status ? p.lastTransitionTime : iso(c.now), ...(reason && !ok ? { reason } : {}) };
  };
  const done = phase === 'Succeeded' || phase === 'Failed';
  const containersReady = allReady && !nodeUnknown;
  const conditions = [
    cond('PodReadyToStartContainers', rt.sandbox),
    cond('Initialized', true),
    cond('Ready', containersReady, done ? 'PodCompleted' : 'ContainersNotReady'),
    cond('ContainersReady', containersReady, done ? 'PodCompleted' : 'ContainersNotReady'),
    cond('PodScheduled', true),
  ];
  return {
    ...prev,
    phase,
    conditions,
    hostIP: node.ip,
    hostIPs: [{ ip: node.ip }],
    ...(rt.ip ? { podIP: rt.ip, podIPs: [{ ip: rt.ip }] } : {}),
    qosClass: prev.qosClass,
    startTime: prev.startTime ?? iso(c.now),
    containerStatuses: cs,
  };
}

export function runKubelets(c: Cluster): void {
  const apiUp = c.components.apiserver && c.components.etcd;
  for (const node of c.nodes) {
    if (!c.nodeAlive(node)) continue;
    if (!apiUp) continue;
    // Heartbeat: the Lease every 10 s; the node condition every 10 s or on change.
    const nodeObj = c.get('Node', undefined, node.name);
    if (nodeObj) {
      const why = !node.runtime
        ? { reason: 'KubeletNotReady', message: 'container runtime is down' }
        : !c.components.cni
          ? { reason: 'KubeletNotReady', message: 'container runtime network not ready: NetworkReady=false reason:NetworkPluginNotReady message:Network plugin returns error: cni plugin not initialized' }
          : undefined;
      const want = nodeStatus(node, !why, c.now, why);
      const cur = nodeObj.status ?? {};
      const curReady = (cur.conditions ?? []).find((x: Obj) => x.type === 'Ready');
      const wantReady = want.conditions.find((x: Obj) => x.type === 'Ready');
      const changed = curReady?.status !== wantReady.status || !deepEqual(cur.images, want.images);
      if (changed || c.now - node.lastLease >= 10_000) {
        if (curReady?.status === wantReady.status) {
          want.conditions = want.conditions.map((x: Obj) => ({ ...x, lastTransitionTime: (cur.conditions ?? []).find((y: Obj) => y.type === x.type)?.lastTransitionTime ?? x.lastTransitionTime }));
        }
        if (changed) {
          const fresh = c.putStatus(nodeObj, want);
          if (curReady?.status !== wantReady.status) c.event(fresh, 'Normal', wantReady.status === 'True' ? 'NodeReady' : 'NodeNotReady', `Node ${node.name} status is now: ${wantReady.status === 'True' ? 'NodeReady' : 'NodeNotReady'}`, 'kubelet', node.name);
        } else if (c.now - node.lastLease >= 60_000) c.putStatus(nodeObj, want);
      }
      if (c.now - node.lastLease >= 10_000) c.renewLease(node);
    }
    const pods = c.list('Pod').filter((p) => p.spec.nodeName === node.name);
    const seen = new Set<string>();
    for (const pod of pods) {
      seen.add(pod.metadata.uid);
      let rt = c.runtime[pod.metadata.uid];
      if (rt && rt.boot !== node.boot) {
        // The node rebooted: the sandbox and containers are gone; start again.
        rt.sandbox = false;
        rt.boot = node.boot;
        for (const cr of rt.containers) {
          if (cr.state === 'running') {
            cr.lastTerm = { exitCode: 255, reason: 'Unknown', startedAt: cr.startedAt ?? c.now, finishedAt: c.now };
            cr.restartCount++;
          }
          cr.state = 'waiting';
          cr.reason = 'ContainerCreating';
          cr.nextAt = undefined;
          cr.startedAt = cr.startedAt ?? undefined;
        }
      }
      if (pod.metadata.deletionTimestamp) {
        if (!rt || !rt.sandbox) {
          c.remove('Pod', pod.metadata.namespace, pod.metadata.name);
          continue;
        }
        if (rt.killAt === undefined) {
          const grace = (pod.metadata.deletionGracePeriodSeconds ?? 30) * 1000;
          const slow = rt.containers.some((cr) => behaviour(cr.image)?.ignoresTerm && cr.state === 'running');
          rt.killAt = c.now + (slow ? grace : Math.min(grace, 1000));
          for (const cr of rt.containers) if (cr.state === 'running') c.event(pod, 'Normal', 'Killing', `Stopping container ${cr.name}`, 'kubelet', node.name);
        }
        if (c.now >= rt.killAt) {
          c.remove('Pod', pod.metadata.namespace, pod.metadata.name);
          delete c.runtime[pod.metadata.uid];
        }
        continue;
      }
      if (!rt) {
        rt = c.runtime[pod.metadata.uid] = { uid: pod.metadata.uid, ns: pod.metadata.namespace, name: pod.metadata.name, node: node.name, sandbox: false, containers: (pod.spec.containers ?? []).map((ct: Obj) => newContainer(ct, node.boot)), boot: node.boot };
      }
      // Containers whose image changed in the spec are restarted with the new image.
      for (const ct of pod.spec.containers ?? []) {
        const cr = rt.containers.find((x) => x.name === ct.name);
        if (cr && cr.image !== ct.image) {
          if (cr.state === 'running') c.event(pod, 'Normal', 'Killing', `Container ${cr.name} definition changed, will be restarted`, 'kubelet', node.name);
          cr.image = ct.image;
          cr.state = 'waiting';
          cr.reason = 'ContainerCreating';
          cr.nextAt = undefined;
          cr.pulling = false;
          cr.restartCount++;
        }
      }
      if (!node.runtime) continue;
      if (!rt.sandbox) {
        if (!c.components.cni) {
          if (!rt.sandboxFailAt || c.now - rt.sandboxFailAt >= 30_000) {
            rt.sandboxFailAt = c.now;
            c.event(pod, 'Warning', 'FailedCreatePodSandBox', `Failed to create pod sandbox: rpc error: code = Unknown desc = failed to setup network for sandbox "${containerId(pod.metadata.uid).slice(0, 64)}": plugin type="flannel" failed (add): failed to load flannel 'subnet.env' file: open /run/flannel/subnet.env: no such file or directory. Check the flannel pod logs`, 'kubelet', node.name);
          }
          c.putStatus(pod, podStatus(c, pod, rt, node));
          continue;
        }
        rt.sandbox = true;
        rt.ip = rt.ip ?? c.allocateIp(node);
      }
      for (const cr of rt.containers) {
        const ct = (pod.spec.containers ?? []).find((x: Obj) => x.name === cr.name);
        if (ct) stepContainer(c, node, pod, rt, cr, ct);
      }
      const fresh = c.get('Pod', pod.metadata.namespace, pod.metadata.name);
      if (fresh) c.putStatus(fresh, podStatus(c, fresh, rt, node));
    }
    // Pods this kubelet still runs but the API no longer has: stop them.
    for (const [uid, rt] of Object.entries(c.runtime)) if (rt.node === node.name && !seen.has(uid)) delete c.runtime[uid];
  }
}

/** Is a pod serving traffic (ready, running, its node alive)? */
export function podServing(c: Cluster, pod: Obj): boolean {
  const rt = c.runtime[pod.metadata.uid];
  const node = rt ? c.node(rt.node) : undefined;
  return !!rt && !!node && c.nodeAlive(node) && node.runtime && rt.containers.every((x) => x.state === 'running') && rt.boot === node.boot && podReady(pod);
}

/** Is the process of a pod up (even if not Ready) — what a direct connection to the pod IP reaches. */
export function podProcessUp(c: Cluster, pod: Obj): boolean {
  const rt = c.runtime[pod.metadata.uid];
  const node = rt ? c.node(rt.node) : undefined;
  return !!rt && !!node && node.power && node.runtime && rt.boot === node.boot && rt.containers.some((x) => x.state === 'running');
}
