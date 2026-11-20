import type { Cluster } from './cluster';
import { controllerOf, podReady } from './controllers';
import { clone, templateHash, type Obj } from './util';

export function statefulRevisions(c: Cluster, s: Obj): Obj[] {
  return c.list('ControllerRevision', s.metadata.namespace).filter(r => controllerOf(r)?.uid === s.metadata.uid).sort((a, b) => a.revision - b.revision);
}
export function reconcileStatefulSet(c: Cluster, s: Obj): void {
  if (s.metadata.deletionTimestamp) return;
  const ns = s.metadata.namespace, name = s.metadata.name, spec = s.spec;
  const owner = { apiVersion: s.apiVersion, kind: s.kind, name, uid: s.metadata.uid, controller: true, blockOwnerDeletion: true };
  const revName = `${name}-${templateHash(spec.template)}`;
  let revisions = statefulRevisions(c, s);
  if (!revisions.some(r => r.metadata.name === revName)) {
    c.put({ apiVersion: 'apps/v1', kind: 'ControllerRevision', metadata: { name: revName, namespace: ns, ownerReferences: [owner] }, revision: Math.max(0, ...revisions.map(r => r.revision)) + 1, data: { spec: { template: clone(spec.template) } } });
    revisions = statefulRevisions(c, s);
  } else if (s.status?.updateRevision && s.status.updateRevision !== revName) {
    const rev = revisions.find(r => r.metadata.name === revName)!;
    c.put({ ...rev, revision: Math.max(...revisions.map(r => r.revision)) + 1 });
  }
  const start = spec.ordinals?.start ?? 0, end = start + spec.replicas;
  const ordinal = (p: Obj) => Number(p.metadata.name.slice(name.length + 1));
  const pods = c.list('Pod', ns).filter(p => controllerOf(p)?.uid === s.metadata.uid).sort((a, b) => ordinal(a) - ordinal(b));
  const parallel = spec.podManagementPolicy === 'Parallel';
  const current = s.status?.currentRevision ?? revName;
  const partition = spec.updateStrategy?.rollingUpdate?.partition ?? 0;
  const revisionFor = (i: number) => i < partition ? current : revName;
  const remove = (p: Obj) => { if (!p.metadata.deletionTimestamp) c.delete('Pod', ns, p.metadata.name); };
  const condemned = pods.filter(p => ordinal(p) >= end || ordinal(p) < start).reverse();
  if (condemned.length) {
    for (const p of condemned) { remove(p); if (!parallel) break; }
  } else {
    for (let i = start; i < end; i++) {
      const p = pods.find(p => ordinal(p) === i);
      if (p) { if (!parallel && (!podReady(p) || p.metadata.deletionTimestamp)) break; continue; }
      const revision = revisionFor(i);
      const tpl = clone(revisions.find(r => r.metadata.name === revision)?.data.spec.template ?? spec.template);
      const volumes = [...(tpl.spec.volumes ?? [])];
      for (const claim of spec.volumeClaimTemplates ?? []) {
        const claimName = `${claim.metadata.name}-${name}-${i}`;
        if (!c.get('PersistentVolumeClaim', ns, claimName)) c.create({ ...clone(claim), apiVersion: 'v1', kind: 'PersistentVolumeClaim', metadata: { ...clone(claim.metadata), name: claimName, namespace: ns } });
        const v = { name: claim.metadata.name, persistentVolumeClaim: { claimName } };
        const at = volumes.findIndex(v => v.name === claim.metadata.name);
        if (at < 0) volumes.push(v); else volumes[at] = v;
      }
      c.create({ apiVersion: 'v1', kind: 'Pod', metadata: { ...tpl.metadata, name: `${name}-${i}`, namespace: ns, labels: { ...tpl.metadata?.labels, 'statefulset.kubernetes.io/pod-name': `${name}-${i}`, 'apps.kubernetes.io/pod-index': String(i), 'controller-revision-hash': revision }, ownerReferences: [owner] }, spec: { ...tpl.spec, hostname: `${name}-${i}`, subdomain: spec.serviceName, volumes } });
      if (!parallel) break;
    }
    if (spec.updateStrategy.type === 'RollingUpdate' && pods.length === spec.replicas && pods.every(p => !p.metadata.deletionTimestamp)) {
      for (const p of [...pods].reverse()) {
        if (ordinal(p) < partition) break;
        if (p.metadata.labels?.['controller-revision-hash'] !== revName) { if (pods.every(other => other === p || podReady(other))) remove(p); break; }
        if (!podReady(p)) break;
      }
    }
  }
  const active = c.list('Pod', ns).filter(p => controllerOf(p)?.uid === s.metadata.uid && !p.metadata.deletionTimestamp);
  const updated = active.filter(p => p.metadata.labels?.['controller-revision-hash'] === revName).length;
  const ready = active.filter(podReady).length;
  const currentRevision = updated === spec.replicas && ready === spec.replicas ? revName : current;
  c.putStatus(s, { observedGeneration: s.metadata.generation, replicas: active.length, readyReplicas: ready, availableReplicas: ready, currentReplicas: active.filter(p => p.metadata.labels?.['controller-revision-hash'] === currentRevision).length, updatedReplicas: updated, currentRevision, updateRevision: revName, collisionCount: 0 });
}
