import { reconcileStatefulSet } from './statefulset';
// kube-controller-manager-lite: each controller is a real reconcile loop
// (05 §6.3): it reads the desired state from the store, compares it with what
// exists and makes one step towards it. None of them remembers events; they
// look at the current state every time (level-triggered), so a missed change
// costs nothing.

import { qosClass, selects, selectsMap } from './admission';
import type { Cluster } from './cluster';
import { tolerates } from './scheduler';
import { clone, deepEqual, intOrPercent, iso, parseDuration, templateHash, type Obj } from './util';

export const NODE_MONITOR_GRACE = 50_000;

const ownerRef = (o: Obj) => ({ apiVersion: o.apiVersion, kind: o.kind, name: o.metadata.name, uid: o.metadata.uid, controller: true, blockOwnerDeletion: true });
export const controllerOf = (o: Obj): Obj | undefined => (o.metadata.ownerReferences ?? []).find((r: Obj) => r.controller);

const isActive = (p: Obj) => !p.metadata.deletionTimestamp && p.status?.phase !== 'Succeeded' && p.status?.phase !== 'Failed';
export const podReady = (p: Obj) => (p.status?.conditions ?? []).some((x: Obj) => x.type === 'Ready' && x.status === 'True');
const readySince = (p: Obj) => Date.parse((p.status?.conditions ?? []).find((x: Obj) => x.type === 'Ready')?.lastTransitionTime ?? '') || 0;
const available = (c: Cluster, p: Obj, minReady: number) => podReady(p) && !p.metadata.deletionTimestamp && c.now - readySince(p) >= minReady * 1000;

export function runControllers(c: Cluster): void {
  nodeLifecycle(c);
  namespaces(c);
  for (const d of c.list('Deployment')) deployment(c, d);
  for (const rs of c.list('ReplicaSet')) replicaSet(c, rs);
  for (const j of c.list('Job')) job(c, j);
  for (const s of c.list('StatefulSet')) reconcileStatefulSet(c, s);
  for (const ds of c.list('DaemonSet')) daemonSet(c, ds);
  garbageCollector(c);
  for (const s of c.list('Service')) endpointSlices(c, s);
}

// ── node lifecycle: Lease timeouts, taints, eviction ──

function nodeLifecycle(c: Cluster): void {
  for (const node of c.list('Node')) {
    const sim = c.node(node.metadata.name);
    if (!sim) continue;
    const ready = (node.status?.conditions ?? []).find((x: Obj) => x.type === 'Ready');
    let taints: Obj[] = clone(node.spec?.taints ?? []);
    const has = (k: string, e: string) => taints.some((t) => t.key === k && t.effect === e);
    const setTaints = (keyName: string, on: boolean) => {
      for (const effect of ['NoSchedule', 'NoExecute']) {
        if (on && !has(keyName, effect)) taints.push({ key: keyName, effect, ...(effect === 'NoExecute' ? { timeAdded: iso(c.now) } : {}) });
        if (!on) taints = taints.filter((t) => !(t.key === keyName && t.effect === effect));
      }
    };
    if (c.now - sim.lastLease > NODE_MONITOR_GRACE && ready?.status !== 'Unknown') {
      const st = clone(node.status);
      for (const cond of st.conditions) {
        cond.status = 'Unknown';
        cond.reason = 'NodeStatusUnknown';
        cond.message = 'Kubelet stopped posting node status.';
        cond.lastTransitionTime = iso(c.now);
      }
      const updated = c.putStatus(node, st);
      c.event(updated, 'Normal', 'NodeNotReady', `Node ${node.metadata.name} status is now: NodeNotReady`, 'node-controller');
      // MarkPodsNotReady: the pods of a lost node stop being Ready, so EndpointSlices drop them.
      for (const p of c.list('Pod').filter((x) => x.spec.nodeName === node.metadata.name)) {
        const conds = (p.status?.conditions ?? []).map((x: Obj) => (x.type === 'Ready' || x.type === 'ContainersReady' ? { ...x, status: 'False', lastTransitionTime: iso(c.now) } : x));
        c.putStatus(p, { ...p.status, conditions: conds });
        c.event(p, 'Warning', 'NodeNotReady', 'Node is not ready', 'node-controller');
      }
    }
    const fresh = c.get('Node', undefined, node.metadata.name)!;
    const st = (fresh.status?.conditions ?? []).find((x: Obj) => x.type === 'Ready')?.status;
    setTaints('node.kubernetes.io/unreachable', st === 'Unknown');
    setTaints('node.kubernetes.io/not-ready', st === 'False');
    if (!deepEqual(taints, fresh.spec?.taints ?? [])) {
      const spec = { ...fresh.spec, taints };
      if (!taints.length) delete spec.taints;
      c.put({ ...fresh, spec });
    }
    // NoExecute taint eviction (the taint manager).
    const noExec = taints.filter((t) => t.effect === 'NoExecute');
    if (!noExec.length) continue;
    for (const p of c.list('Pod').filter((x) => x.spec.nodeName === node.metadata.name && !x.metadata.deletionTimestamp)) {
      let evictAt = Infinity;
      let evict = false;
      for (const t of noExec) {
        const tol = (p.spec.tolerations ?? []).find((x: Obj) => tolerates([x], t));
        const added = Date.parse(t.timeAdded ?? iso(c.now));
        if (!tol) {
          evict = true;
          evictAt = Math.min(evictAt, added);
        } else if (typeof tol.tolerationSeconds === 'number') {
          evict = true;
          evictAt = Math.min(evictAt, added + tol.tolerationSeconds * 1000);
        }
      }
      if (evict && c.now >= evictAt) {
        c.event(p, 'Normal', 'TaintManagerEviction', `Marking for deletion Pod ${p.metadata.namespace}/${p.metadata.name}`, 'taint-eviction-controller');
        c.put({ ...p, metadata: { ...p.metadata, deletionTimestamp: iso(c.now + (p.spec.terminationGracePeriodSeconds ?? 30) * 1000), deletionGracePeriodSeconds: p.spec.terminationGracePeriodSeconds ?? 30 } });
      }
    }
  }
}

// ── namespaces: default ServiceAccount, kube-root-ca.crt, termination ──

function namespaces(c: Cluster): void {
  for (const ns of c.list('Namespace')) {
    const name = ns.metadata.name;
    if (ns.metadata.deletionTimestamp) {
      const left = c.all().filter((o) => o.metadata.namespace === name);
      for (const o of left) {
        if (o.kind === 'Pod' && o.spec.nodeName && c.node(o.spec.nodeName)?.power && c.node(o.spec.nodeName)?.kubelet) {
          if (!o.metadata.deletionTimestamp) c.put({ ...o, metadata: { ...o.metadata, deletionTimestamp: iso(c.now + 30_000), deletionGracePeriodSeconds: 30 } });
        } else c.remove(o.kind, name, o.metadata.name);
      }
      if (!c.all().some((o) => o.metadata.namespace === name)) c.remove('Namespace', undefined, name);
      continue;
    }
    if (!c.get('ServiceAccount', name, 'default')) c.put({ apiVersion: 'v1', kind: 'ServiceAccount', metadata: { name: 'default', namespace: name } });
    if (!c.get('ConfigMap', name, 'kube-root-ca.crt'))
      c.put({
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { name: 'kube-root-ca.crt', namespace: name, annotations: { 'kubernetes.io/description': "Contains a CA bundle that can be used to verify the kube-apiserver when using internal endpoints such as the internal service IP or kubernetes.default.svc. No other usage is guaranteed across distributions of Kubernetes clusters." } },
        data: { 'ca.crt': '-----BEGIN CERTIFICATE-----\nMIIBdzCCAR2gAwIBAgIBADAKBggqhkjOPQQDAjAjMSEwHwYDVQQDDBhrM3Mtc2Vy\ndmVyLWNhQDE3NjMzNzQ0MDAwHhcNMjYxMTE0MDkwMDAwWhcNMzYxMTEyMDkwMDAw\n-----END CERTIFICATE-----\n' },
      });
  }
}

// ── Deployment: ReplicaSets per pod template, rolling update ──

export function newRsReplicas(d: Obj, all: Obj[], newRs: Obj | undefined): number {
  const replicas = d.spec.replicas ?? 1;
  if (d.spec.strategy?.type === 'Recreate') return replicas;
  const surge = intOrPercent(d.spec.strategy?.rollingUpdate?.maxSurge, replicas, true);
  const current = all.reduce((s, rs) => s + (rs.spec.replicas ?? 0), 0);
  const maxTotal = replicas + surge;
  const cur = newRs?.spec.replicas ?? 0;
  if (current >= maxTotal) return cur;
  return Math.min(replicas, cur + (maxTotal - current));
}

function revisionOf(rs: Obj): number {
  return Number(rs.metadata.annotations?.['deployment.kubernetes.io/revision'] ?? 0);
}

function scaleRs(c: Cluster, d: Obj, rs: Obj, to: number): Obj {
  const from = rs.spec.replicas ?? 0;
  if (from === to) return rs;
  const updated = c.put({ ...rs, spec: { ...rs.spec, replicas: to }, metadata: { ...rs.metadata, annotations: { ...rs.metadata.annotations, 'deployment.kubernetes.io/desired-replicas': String(d.spec.replicas ?? 1), 'deployment.kubernetes.io/max-replicas': String((d.spec.replicas ?? 1) + intOrPercent(d.spec.strategy?.rollingUpdate?.maxSurge, d.spec.replicas ?? 1, true)) } } });
  c.event(d, 'Normal', 'ScalingReplicaSet', `Scaled ${to > from ? 'up' : 'down'} replica set ${rs.metadata.name} from ${from} to ${to}`, 'deployment-controller');
  return updated;
}

export function templateWithoutHash(t: Obj): Obj {
  const out = clone(t);
  if (out.metadata?.labels) delete out.metadata.labels['pod-template-hash'];
  return out;
}

function deployment(c: Cluster, d: Obj): void {
  const ns = d.metadata.namespace;
  const owned = c.list('ReplicaSet', ns).filter((rs) => controllerOf(rs)?.uid === d.metadata.uid);
  const hash = templateHash(templateWithoutHash(d.spec.template));
  let newRs = owned.find((rs) => rs.metadata.labels?.['pod-template-hash'] === hash);
  const old = owned.filter((rs) => rs !== newRs);
  const maxRev = owned.reduce((m, rs) => Math.max(m, revisionOf(rs)), 0);
  if (!d.spec.paused) {
    if (!newRs) {
      const tpl = clone(d.spec.template);
      tpl.metadata.labels = { ...(tpl.metadata.labels ?? {}), 'pod-template-hash': hash };
      const replicas = old.length ? newRsReplicas(d, owned, undefined) : d.spec.strategy?.type === 'Recreate' && old.some((r) => r.spec.replicas > 0) ? 0 : (d.spec.replicas ?? 1);
      const rs = {
        apiVersion: 'apps/v1',
        kind: 'ReplicaSet',
        metadata: {
          name: `${d.metadata.name}-${hash}`,
          namespace: ns,
          labels: tpl.metadata.labels,
          annotations: {
            'deployment.kubernetes.io/desired-replicas': String(d.spec.replicas ?? 1),
            'deployment.kubernetes.io/max-replicas': String((d.spec.replicas ?? 1) + intOrPercent(d.spec.strategy?.rollingUpdate?.maxSurge, d.spec.replicas ?? 1, true)),
            'deployment.kubernetes.io/revision': String(maxRev + 1),
            ...(d.metadata.annotations?.['kubernetes.io/change-cause'] ? { 'kubernetes.io/change-cause': d.metadata.annotations['kubernetes.io/change-cause'] } : {}),
          },
          ownerReferences: [ownerRef(d)],
          generation: 1,
        },
        spec: { replicas: d.spec.strategy?.type === 'Recreate' && old.some((r) => r.spec.replicas > 0) ? 0 : replicas, minReadySeconds: d.spec.minReadySeconds ?? 0, selector: { matchLabels: { ...d.spec.selector.matchLabels, 'pod-template-hash': hash } }, template: tpl },
        status: { replicas: 0 },
      };
      newRs = c.put(rs);
      if (rs.spec.replicas > 0) c.event(d, 'Normal', 'ScalingReplicaSet', `Scaled up replica set ${rs.metadata.name} from 0 to ${rs.spec.replicas}`, 'deployment-controller');
    } else if (old.length && revisionOf(newRs) < maxRev) {
      // A rollback: an old template is current again and gets the next revision.
      newRs = c.put({ ...newRs, metadata: { ...newRs.metadata, annotations: { ...newRs.metadata.annotations, 'deployment.kubernetes.io/revision': String(maxRev + 1), ...(d.metadata.annotations?.['kubernetes.io/change-cause'] ? { 'kubernetes.io/change-cause': d.metadata.annotations['kubernetes.io/change-cause'] } : {}) } } });
      c.event(d, 'Normal', 'DeploymentRollback', `Rolled back deployment "${d.metadata.name}" to revision ${revisionOf(newRs)}`, 'deployment-controller');
    }
    const replicas = d.spec.replicas ?? 1;
    const all = () => c.list('ReplicaSet', ns).filter((rs) => controllerOf(rs)?.uid === d.metadata.uid);
    if (d.spec.strategy?.type === 'Recreate') {
      let anyOld = false;
      for (const rs of old) {
        if ((rs.spec.replicas ?? 0) > 0) scaleRs(c, d, rs, 0);
        if (c.list('Pod', ns).some((p) => controllerOf(p)?.uid === rs.metadata.uid)) anyOld = true;
      }
      if (!anyOld) scaleRs(c, d, newRs, replicas);
    } else {
      const unavailable = intOrPercent(d.spec.strategy?.rollingUpdate?.maxUnavailable, replicas, false);
      const oldActive = old.filter((rs) => (rs.spec.replicas ?? 0) > 0);
      if (!oldActive.length) newRs = scaleRs(c, d, newRs, replicas);
      else {
        newRs = scaleRs(c, d, newRs, newRsReplicas(d, all(), newRs));
        // Scale old ReplicaSets down without going under the availability floor.
        const rsNow = all();
        const allPods = rsNow.reduce((s, rs) => s + (rs.spec.replicas ?? 0), 0);
        const minAvailable = replicas - unavailable;
        const newUnavailable = (newRs.spec.replicas ?? 0) - (newRs.status?.availableReplicas ?? 0);
        let maxScaledDown = allPods - minAvailable - newUnavailable;
        if (maxScaledDown > 0) {
          const olds = rsNow.filter((rs) => rs.metadata.uid !== newRs!.metadata.uid && (rs.spec.replicas ?? 0) > 0).sort((a, b) => a.metadata.creationTimestamp.localeCompare(b.metadata.creationTimestamp));
          // First the unhealthy replicas of old ReplicaSets…
          for (const rs of olds) {
            if (maxScaledDown <= 0) break;
            const unhealthy = (rs.spec.replicas ?? 0) - (rs.status?.availableReplicas ?? 0);
            if (unhealthy <= 0) continue;
            const by = Math.min(unhealthy, maxScaledDown);
            scaleRs(c, d, rs, rs.spec.replicas - by);
            maxScaledDown -= by;
          }
          // …then healthy ones, while enough pods stay available.
          const now2 = all();
          const availableTotal = now2.reduce((s, rs) => s + (rs.status?.availableReplicas ?? 0), 0);
          let canDown = Math.min(maxScaledDown, availableTotal - minAvailable);
          for (const rs of now2.filter((r) => r.metadata.uid !== newRs!.metadata.uid && (r.spec.replicas ?? 0) > 0).sort((a, b) => a.metadata.creationTimestamp.localeCompare(b.metadata.creationTimestamp))) {
            if (canDown <= 0) break;
            const by = Math.min(rs.spec.replicas, canDown);
            scaleRs(c, d, rs, rs.spec.replicas - by);
            canDown -= by;
          }
        }
      }
    }
    // Revision history: keep revisionHistoryLimit old ReplicaSets at zero.
    const limit = d.spec.revisionHistoryLimit ?? 10;
    const zero = all()
      .filter((rs) => rs.metadata.uid !== newRs!.metadata.uid && (rs.spec.replicas ?? 0) === 0 && (rs.status?.replicas ?? 0) === 0)
      .sort((a, b) => revisionOf(a) - revisionOf(b));
    for (const rs of zero.slice(0, Math.max(0, zero.length - limit))) c.remove('ReplicaSet', ns, rs.metadata.name);
  }
  // Status.
  const rsAll = c.list('ReplicaSet', ns).filter((rs) => controllerOf(rs)?.uid === d.metadata.uid);
  const sum = (f: (rs: Obj) => number) => rsAll.reduce((s, rs) => s + f(rs), 0);
  const replicas = d.spec.replicas ?? 1;
  const statusReplicas = sum((rs) => rs.status?.replicas ?? 0);
  const updated = newRs?.status?.replicas ?? 0;
  const ready = sum((rs) => rs.status?.readyReplicas ?? 0);
  const avail = sum((rs) => rs.status?.availableReplicas ?? 0);
  const maxUnavailable = d.spec.strategy?.type === 'Recreate' ? 0 : intOrPercent(d.spec.strategy?.rollingUpdate?.maxUnavailable, replicas, false);
  const prev: Obj = d.status ?? {};
  const prevCond = (t: string) => (prev.conditions ?? []).find((x: Obj) => x.type === t);
  const isAvailable = avail >= replicas - maxUnavailable;
  const complete = updated === replicas && (newRs?.status?.availableReplicas ?? 0) === replicas && statusReplicas === replicas;
  const cond = (type: string, status: string, reason: string, message: string, touchUpdate = true): Obj => {
    const p = prevCond(type);
    const same = p && p.status === status && p.reason === reason;
    return {
      type,
      status,
      lastUpdateTime: same && !touchUpdate ? p.lastUpdateTime : iso(c.now),
      lastTransitionTime: p && p.status === status ? p.lastTransitionTime : iso(c.now),
      reason,
      message,
    };
  };
  const counts = { replicas: statusReplicas, updated, ready, avail };
  const progressed = !deepEqual(counts, { replicas: prev.replicas ?? 0, updated: prev.updatedReplicas ?? 0, ready: prev.readyReplicas ?? 0, avail: prev.availableReplicas ?? 0 }) || prev.observedGeneration !== d.metadata.generation;
  const rsName = newRs?.metadata.name ?? d.metadata.name;
  let progressing: Obj;
  const pc = prevCond('Progressing');
  if (complete) progressing = cond('Progressing', 'True', 'NewReplicaSetAvailable', `ReplicaSet "${rsName}" has successfully progressed.`, pc?.reason !== 'NewReplicaSetAvailable');
  else if (d.spec.paused) progressing = cond('Progressing', 'Unknown', 'DeploymentPaused', 'Deployment is paused');
  else if (pc && pc.reason === 'ProgressDeadlineExceeded' && !progressed) progressing = pc;
  else if (!progressed && pc && c.now - Date.parse(pc.lastUpdateTime) > (d.spec.progressDeadlineSeconds ?? 600) * 1000)
    progressing = cond('Progressing', 'False', 'ProgressDeadlineExceeded', `ReplicaSet "${rsName}" has timed out progressing.`);
  else progressing = cond('Progressing', 'True', 'ReplicaSetUpdated', `ReplicaSet "${rsName}" is progressing.`, progressed || !pc);
  if (!progressed && pc && progressing.reason === pc.reason && progressing.status === pc.status) progressing = { ...progressing, lastUpdateTime: pc.lastUpdateTime };
  const availableCond = isAvailable ? cond('Available', 'True', 'MinimumReplicasAvailable', 'Deployment has minimum availability.', false) : cond('Available', 'False', 'MinimumReplicasUnavailable', 'Deployment does not have minimum availability.', false);
  if (prevCond('Available')?.status === availableCond.status) availableCond.lastUpdateTime = prevCond('Available').lastUpdateTime;
  const status: Obj = {
    observedGeneration: d.metadata.generation,
    replicas: statusReplicas,
    updatedReplicas: updated,
    readyReplicas: ready,
    availableReplicas: avail,
    unavailableReplicas: Math.max(0, replicas - avail),
    conditions: [availableCond, progressing],
  };
  for (const k of ['readyReplicas', 'availableReplicas', 'unavailableReplicas', 'updatedReplicas', 'replicas'] as const) if (!status[k]) delete status[k];
  c.putStatus(c.get('Deployment', ns, d.metadata.name)!, status);
}

// ── ReplicaSet: keep N pods that match the selector ──

/** Which pods a scale-down removes first (controller.ActivePods ordering). */
export function deletionRank(a: Obj, b: Obj): number {
  const k = (p: Obj) => [p.spec.nodeName ? 1 : 0, p.status?.phase === 'Pending' ? 0 : p.status?.phase === 'Unknown' ? 1 : 2, podReady(p) ? 1 : 0, -Date.parse(p.metadata.creationTimestamp)];
  const ka = k(a);
  const kb = k(b);
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
  return 0;
}

function replicaSet(c: Cluster, rs: Obj): void {
  const ns = rs.metadata.namespace;
  const pods = c.list('Pod', ns);
  // Adopt orphans that match, release owned pods that no longer match.
  for (const p of pods) {
    const ctl = controllerOf(p);
    const match = selects(rs.spec.selector, p.metadata.labels);
    if (!ctl && match && isActive(p)) {
      c.put({ ...p, metadata: { ...p.metadata, ownerReferences: [...(p.metadata.ownerReferences ?? []), ownerRef(rs)] } });
    } else if (ctl?.uid === rs.metadata.uid && !match) {
      c.put({ ...p, metadata: { ...p.metadata, ownerReferences: (p.metadata.ownerReferences ?? []).filter((r: Obj) => r.uid !== rs.metadata.uid) } });
    }
  }
  const owned = c.list('Pod', ns).filter((p) => controllerOf(p)?.uid === rs.metadata.uid);
  const active = owned.filter(isActive);
  const want = rs.spec.replicas ?? 1;
  if (active.length < want) {
    for (let i = active.length; i < want; i++) {
      const tpl = clone(rs.spec.template);
      const pod = c.create(
        { apiVersion: 'v1', kind: 'Pod', metadata: { generateName: `${rs.metadata.name}-`, namespace: ns, labels: tpl.metadata?.labels ?? {}, annotations: tpl.metadata?.annotations, ownerReferences: [ownerRef(rs)] }, spec: tpl.spec },
        {},
      );
      c.event(rs, 'Normal', 'SuccessfulCreate', `Created pod: ${pod.metadata.name}`, 'replicaset-controller');
    }
  } else if (active.length > want) {
    const victims = [...active].sort(deletionRank).slice(0, active.length - want);
    for (const p of victims) {
      c.delete('Pod', ns, p.metadata.name);
      c.event(rs, 'Normal', 'SuccessfulDelete', `Deleted pod: ${p.metadata.name}`, 'replicaset-controller');
    }
  }
  const now = c.list('Pod', ns).filter((p) => controllerOf(p)?.uid === rs.metadata.uid && isActive(p));
  const fresh = c.get('ReplicaSet', ns, rs.metadata.name)!;
  const status: Obj = {
    replicas: now.length,
    fullyLabeledReplicas: now.length,
    readyReplicas: now.filter(podReady).length,
    availableReplicas: now.filter((p) => available(c, p, rs.spec.minReadySeconds ?? 0)).length,
    terminatingReplicas: owned.filter((p) => p.metadata.deletionTimestamp).length,
    observedGeneration: rs.metadata.generation,
  };
  for (const k of ['readyReplicas', 'availableReplicas', 'fullyLabeledReplicas', 'terminatingReplicas'] as const) if (!status[k]) delete status[k];
  c.putStatus(fresh, status);
}

// ── Job ──

function job(c: Cluster, j: Obj): void {
  const ns = j.metadata.namespace;
  const st: Obj = clone(j.status ?? {});
  const finished = (st.conditions ?? []).some((x: Obj) => (x.type === 'Complete' || x.type === 'Failed') && x.status === 'True');
  if (finished) {
    const ttl = j.spec.ttlSecondsAfterFinished;
    const at = Date.parse(st.completionTime ?? (st.conditions ?? []).find((x: Obj) => x.type === 'Failed')?.lastTransitionTime ?? '');
    if (typeof ttl === 'number' && at && c.now >= at + ttl * 1000) c.delete('Job', ns, j.metadata.name);
    return;
  }
  st.startTime ??= iso(c.now);
  const pods = c.list('Pod', ns).filter((p) => controllerOf(p)?.uid === j.metadata.uid);
  const succeeded = pods.filter((p) => p.status?.phase === 'Succeeded').length;
  const failedPods = pods.filter((p) => p.status?.phase === 'Failed').length;
  const restarts = pods.reduce((s, p) => s + (p.status?.containerStatuses ?? []).reduce((x: number, cs: Obj) => x + (cs.restartCount ?? 0), 0), 0);
  const failed = failedPods + (j.spec.template.spec.restartPolicy === 'OnFailure' ? restarts : 0);
  const active = pods.filter(isActive);
  const completions = j.spec.completions ?? 1;
  const finish = (type: 'Complete' | 'Failed', reason?: string, message?: string) => {
    for (const p of active) c.delete('Pod', ns, p.metadata.name);
    const conds = [
      ...(type === 'Complete' ? [{ type: 'SuccessCriteriaMet', status: 'True', lastProbeTime: iso(c.now), lastTransitionTime: iso(c.now), reason: 'CompletionsReached', message: 'Reached expected number of succeeded pods' }] : [{ type: 'FailureTarget', status: 'True', lastProbeTime: iso(c.now), lastTransitionTime: iso(c.now), reason, message }]),
      { type, status: 'True', lastProbeTime: iso(c.now), lastTransitionTime: iso(c.now), ...(reason ? { reason, message } : { reason: 'CompletionsReached', message: 'Reached expected number of succeeded pods' }) },
    ];
    c.putStatus(c.get('Job', ns, j.metadata.name)!, { ...st, active: undefined, ready: 0, succeeded: succeeded || undefined, failed: failed || undefined, terminating: 0, conditions: conds, ...(type === 'Complete' ? { completionTime: iso(c.now) } : {}) });
    c.event(j, type === 'Complete' ? 'Normal' : 'Warning', type === 'Complete' ? 'Completed' : reason!, type === 'Complete' ? 'Job completed' : message!, 'job-controller');
  };
  if (succeeded >= completions) return finish('Complete');
  if (failed > (j.spec.backoffLimit ?? 6)) return finish('Failed', 'BackoffLimitExceeded', 'Job has reached the specified backoff limit');
  if (typeof j.spec.activeDeadlineSeconds === 'number' && c.now - Date.parse(st.startTime) >= j.spec.activeDeadlineSeconds * 1000) return finish('Failed', 'DeadlineExceeded', 'Job was active longer than specified deadline');
  const want = Math.min(j.spec.parallelism ?? 1, completions - succeeded) - active.length;
  for (let i = 0; i < want; i++) {
    const tpl = clone(j.spec.template);
    const pod = c.create({ apiVersion: 'v1', kind: 'Pod', metadata: { generateName: `${j.metadata.name}-`, namespace: ns, labels: tpl.metadata?.labels ?? {}, ownerReferences: [ownerRef(j)] }, spec: tpl.spec });
    c.event(j, 'Normal', 'SuccessfulCreate', `Created pod: ${pod.metadata.name}`, 'job-controller');
  }
  const now = c.list('Pod', ns).filter((p) => controllerOf(p)?.uid === j.metadata.uid);
  c.putStatus(c.get('Job', ns, j.metadata.name)!, { ...st, active: now.filter(isActive).length || undefined, ready: now.filter(podReady).length, succeeded: succeeded || undefined, failed: failed || undefined, terminating: 0, uncountedTerminatedPods: {} });
}

// ── DaemonSet: one pod on every node it may run on ──

const DS_TOLERATIONS = [
  { key: 'node.kubernetes.io/not-ready', operator: 'Exists', effect: 'NoExecute' },
  { key: 'node.kubernetes.io/unreachable', operator: 'Exists', effect: 'NoExecute' },
  { key: 'node.kubernetes.io/disk-pressure', operator: 'Exists', effect: 'NoSchedule' },
  { key: 'node.kubernetes.io/memory-pressure', operator: 'Exists', effect: 'NoSchedule' },
  { key: 'node.kubernetes.io/pid-pressure', operator: 'Exists', effect: 'NoSchedule' },
  { key: 'node.kubernetes.io/unschedulable', operator: 'Exists', effect: 'NoSchedule' },
];

function daemonSet(c: Cluster, ds: Obj): void {
  const ns = ds.metadata.namespace;
  const tpl = ds.spec.template;
  const tolerations = [...(tpl.spec.tolerations ?? []), ...DS_TOLERATIONS];
  const owned = c.list('Pod', ns).filter((p) => controllerOf(p)?.uid === ds.metadata.uid);
  const eligible = c.list('Node').filter((n) => {
    const sel = tpl.spec.nodeSelector ?? {};
    if (Object.entries(sel).some(([k, v]) => n.metadata.labels?.[k] !== v)) return false;
    return !(n.spec?.taints ?? []).some((t: Obj) => t.effect === 'NoSchedule' && !t.key.startsWith('node.kubernetes.io/') && !tolerates(tolerations, t));
  });
  const nodeOf = (p: Obj) => p.spec.nodeName ?? p.spec.affinity?.nodeAffinity?.requiredDuringSchedulingIgnoredDuringExecution?.nodeSelectorTerms?.[0]?.matchFields?.[0]?.values?.[0];
  const hash = templateHash(tpl);
  for (const n of eligible) {
    const name = n.metadata.name;
    if (owned.some((p) => nodeOf(p) === name && !p.metadata.deletionTimestamp)) continue;
    const spec = clone(tpl.spec);
    spec.tolerations = tolerations;
    spec.affinity = { nodeAffinity: { requiredDuringSchedulingIgnoredDuringExecution: { nodeSelectorTerms: [{ matchFields: [{ key: 'metadata.name', operator: 'In', values: [name] }] }] } } };
    const pod = c.create({ apiVersion: 'v1', kind: 'Pod', metadata: { generateName: `${ds.metadata.name}-`, namespace: ns, labels: { ...(tpl.metadata?.labels ?? {}), 'controller-revision-hash': hash, 'pod-template-generation': String(ds.metadata.generation ?? 1) }, ownerReferences: [ownerRef(ds)] }, spec });
    c.event(ds, 'Normal', 'SuccessfulCreate', `Created pod: ${pod.metadata.name}`, 'daemonset-controller');
  }
  for (const p of owned) if (!eligible.some((n) => n.metadata.name === nodeOf(p)) && !p.metadata.deletionTimestamp) c.delete('Pod', ns, p.metadata.name);
  const now = c.list('Pod', ns).filter((p) => controllerOf(p)?.uid === ds.metadata.uid && isActive(p));
  c.putStatus(c.get('DaemonSet', ns, ds.metadata.name)!, {
    currentNumberScheduled: now.filter((p) => p.spec.nodeName).length,
    desiredNumberScheduled: eligible.length,
    numberAvailable: now.filter(podReady).length || undefined,
    numberMisscheduled: 0,
    numberReady: now.filter(podReady).length,
    numberUnavailable: eligible.length - now.filter(podReady).length || undefined,
    observedGeneration: ds.metadata.generation,
    updatedNumberScheduled: now.length,
  });
}

// ── garbage collector: dependents whose owners are gone ──

function garbageCollector(c: Cluster): void {
  const uids = new Set(c.all().map((o) => o.metadata.uid));
  for (const o of c.all()) {
    const refs: Obj[] = o.metadata.ownerReferences ?? [];
    if (!refs.length) continue;
    if (refs.some((r) => uids.has(r.uid))) continue;
    if (o.kind === 'Pod') {
      if (!o.metadata.deletionTimestamp) c.delete('Pod', o.metadata.namespace, o.metadata.name);
    } else c.delete(o.kind, o.metadata.namespace, o.metadata.name);
  }
}

// ── EndpointSlice: the addresses of the pods a Service selects ──

export function resolveTargetPort(pod: Obj, target: unknown): number | undefined {
  if (typeof target === 'number') return target;
  if (/^\d+$/.test(String(target))) return Number(target);
  for (const ct of pod.spec.containers ?? []) for (const p of ct.ports ?? []) if (p.name === target) return p.containerPort;
  return undefined;
}

function endpointSlices(c: Cluster, svc: Obj): void {
  const ns = svc.metadata.namespace;
  if (!svc.spec.selector || svc.metadata.name === 'kubernetes') return;
  const existing = c.list('EndpointSlice', ns).filter((s) => s.metadata.labels?.['kubernetes.io/service-name'] === svc.metadata.name && s.metadata.labels?.['endpointslice.kubernetes.io/managed-by'] === 'endpointslice-controller.k8s.io');
  const pods = c.list('Pod', ns).filter((p) => selectsMap(svc.spec.selector, p.metadata.labels) && p.status?.podIP && p.status?.phase !== 'Succeeded' && p.status?.phase !== 'Failed');
  const first = pods[0];
  const ports = (svc.spec.ports ?? []).map((p: Obj) => ({ name: p.name ?? '', port: first ? (resolveTargetPort(first, p.targetPort) ?? p.port) : typeof p.targetPort === 'number' ? p.targetPort : null, protocol: p.protocol ?? 'TCP' }));
  const endpoints = pods.map((p) => {
    const terminating = !!p.metadata.deletionTimestamp;
    const ready = podReady(p) && !terminating;
    return {
      addresses: [p.status.podIP],
      conditions: { ready, serving: podReady(p), terminating },
      nodeName: p.spec.nodeName,
      targetRef: { kind: 'Pod', name: p.metadata.name, namespace: ns, uid: p.metadata.uid },
    };
  });
  const body = { addressType: 'IPv4', endpoints, ports: ports.map((p: Obj) => (p.port === null ? { name: p.name, protocol: p.protocol } : p)) };
  if (!existing.length) {
    const name = `${svc.metadata.name}-${c.rand.suffix()}`;
    c.put({
      apiVersion: 'discovery.k8s.io/v1',
      kind: 'EndpointSlice',
      metadata: {
        name,
        namespace: ns,
        generateName: `${svc.metadata.name}-`,
        labels: { 'endpointslice.kubernetes.io/managed-by': 'endpointslice-controller.k8s.io', 'kubernetes.io/service-name': svc.metadata.name, ...(svc.metadata.labels ?? {}) },
        annotations: { 'endpoints.kubernetes.io/last-change-trigger-time': iso(c.now) },
        ownerReferences: [{ apiVersion: 'v1', kind: 'Service', name: svc.metadata.name, uid: svc.metadata.uid, controller: true, blockOwnerDeletion: true }],
        generation: 1,
      },
      ...body,
    });
    return;
  }
  const sl = existing[0];
  const cur = { addressType: sl.addressType, endpoints: sl.endpoints ?? [], ports: sl.ports ?? [] };
  if (!deepEqual(cur, body)) c.put({ ...sl, ...body, metadata: { ...sl.metadata, generation: (sl.metadata.generation ?? 1) + 1, annotations: { ...(sl.metadata.annotations ?? {}), 'endpoints.kubernetes.io/last-change-trigger-time': iso(c.now) } } });
}

export { qosClass, parseDuration };
