import { describe, expect, it } from 'vitest';
import { Cluster } from '../src/engine/kube-lite/cluster';
import { helmReleases, renderChart, runHelm } from '../src/engine/kube-lite/helm';
import { canI, identity } from '../src/engine/kube-lite/rbac';
import { podExec } from '../src/engine/kube-lite/kubectl/podshell';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import { createSimMachine } from '../src/engine/terminal/shell';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import kubeModule from '../src/engine/kube-lite/module';
import { k8sState } from '../src/engine/kube-lite/state';
import type { Obj } from '../src/engine/kube-lite/util';
const registry = createTerminalRegistry();
for (const command of [...BUILTINS, ...BASIC_COMMANDS, ...(kubeModule.commands ?? [])]) registry.commands.add(command);
registry.setup.push(...(kubeModule.setup ?? []));
const machine = () => createSimMachine({ ext: { k8s: {} } }, { registry });
const helm = (c: Cluster, line: string) => runHelm(c, line.split(' '), () => '');
const exec = (c: Cluster, pod: Obj, ...args: string[]) => podExec(c, pod, pod.spec.containers[0], args);

describe('lesson fidelity regressions', () => {
  it('1: resolves RBAC groups and subresources and lists qualified resources', async () => {
    const m = await machine();
    for (const kind of ['role', 'clusterrole']) {
      expect((await m.exec(`kubectl create ${kind} reader --verb=get,list --resource=deployments,ingresses,pods/log,deployments.apps/scale`)).exit).toBe(0);
      const c = k8sState(m).cluster!;
      expect(c.get(kind === 'role' ? 'Role' : 'ClusterRole', 'default', 'reader')!.rules).toEqual([
        { apiGroups: ['apps'], resources: ['deployments'], verbs: ['get', 'list'] },
        { apiGroups: ['networking.k8s.io'], resources: ['ingresses'], verbs: ['get', 'list'] },
        { apiGroups: [''], resources: ['pods/log'], verbs: ['get', 'list'] },
        { apiGroups: ['apps'], resources: ['deployments/scale'], verbs: ['get', 'list'] },
      ]);
    }
    await m.exec('kubectl create rolebinding reader --role=reader --user=alice');
    expect((await m.exec('kubectl auth can-i list deployments --as=alice')).out).toBe('yes\n');
    const listed = await m.exec('kubectl auth can-i --list --as=alice');
    expect(listed.out).toContain('deployments.apps');
    expect(listed.out).toContain('ingresses.networking.k8s.io');
  });
  it.each(['nginx-web', 'postgres-like', 'podinfo'])('2: default chart %s becomes ready with platform dependencies', chart => {
    const c = new Cluster({ addons: ['csi-hostpath'] });
    const r = helm(c, `install demo ${chart} --wait --timeout=120s`);
    expect(r.err).toBe(''); expect(r.code).toBe(0);
    expect(c.get(chart === 'postgres-like' ? 'StatefulSet' : 'Deployment', 'default', 'demo')!.status.readyReplicas).toBe(1);
  });
  it('3: failed upgrade stays failed through rollback', () => {
    const c = new Cluster();
    expect(helm(c, 'install demo nginx-web --wait').code).toBe(0);
    expect(helm(c, 'upgrade demo nginx-web --set image.tag=missing --wait --timeout=5s').code).toBe(1);
    expect(helmReleases(c).map(r => r.status)).toEqual(['deployed', 'failed']);
    expect(helm(c, 'rollback demo 1').code).toBe(0);
    expect(helmReleases(c).map(r => r.status)).toEqual(['superseded', 'failed', 'deployed']);
    expect(c.get('Secret', 'default', 'sh.helm.release.v1.demo.v2')!.metadata.labels.status).toBe('failed');
    c.advance(60_000);
    expect(c.get('Deployment', 'default', 'demo')!.status.readyReplicas).toBe(1);
  });
  it('4: an otherwise unprivileged account has default self-review rights', async () => {
    const m = await machine();
    const result = await m.exec('kubectl auth can-i --list --as=nobody');
    for (const resource of ['selfsubjectaccessreviews.authorization.k8s.io', 'selfsubjectrulesreviews.authorization.k8s.io', 'selfsubjectreviews.authentication.k8s.io']) expect(result.out).toContain(resource);
    expect(result.out).toContain('[create]');
    const c = k8sState(m).cluster!;
    expect(canI(c, identity('nobody'), 'create', 'selfsubjectreviews', 'authentication.k8s.io')).toBe(true);
    expect(canI(c, identity('nobody'), 'list', 'pods', '', 'default')).toBe(false);
  });
  it('5: PV files survive StatefulSet replacement, rescheduling and snapshots; emptyDir does not', () => {
    const c = new Cluster({ addons: ['csi-hostpath'] });
    const objects = renderChart('postgres-like', 'db', 'default', { replicaCount: 2 });
    const spec = objects[1].spec.template.spec;
    spec.volumes = [{ name: 'scratch', emptyDir: {} }];
    spec.containers[0].volumeMounts.push({ name: 'scratch', mountPath: '/scratch' });
    objects.forEach(o => c.create(o)); c.advance(90_000);
    const first = c.get('Pod', 'default', 'db-0')!;
    expect(exec(c, first, 'sh', '-c', 'echo first>/data/log; echo second >>/data/log; echo transient >/scratch/log').code).toBe(0);
    expect(exec(c, first, 'cat', '/data/log').out).toBe('first\nsecond\n');
    const other = c.get('Pod', 'default', 'db-1')!;
    expect(exec(c, other, 'cat', '/data/log').code).toBe(1);
    const readOnly = { ...first.spec.containers[0], volumeMounts: [{ name: 'data', mountPath: '/data', readOnly: true }] };
    expect(podExec(c, first, readOnly, ['sh', '-c', 'echo lost >/data/log']).err).toContain('Read-only file system');
    expect(exec(c, first, 'sh', '-c', "echo 'literal > ; &&' >/data/quoted").code).toBe(0);
    expect(exec(c, first, 'cat', '/data/quoted').out).toBe('literal > ; &&\n');
    c.patch('Pod', 'default', 'db-0', { spec: { containers: [{ ...first.spec.containers[0], image: 'trainer/web:1.1' }] } });
    c.advance(10_000);
    const restarted = c.get('Pod', 'default', 'db-0')!;
    expect(restarted.metadata.uid).toBe(first.metadata.uid);
    expect(exec(c, restarted, 'cat', '/data/log').out).toBe('first\nsecond\n');
    expect(exec(c, restarted, 'cat', '/scratch/log').out).toBe('transient\n');
    c.patch('Node', undefined, first.spec.nodeName, { spec: { unschedulable: true } });
    c.delete('Pod', 'default', 'db-0', { grace: 0 }); c.advance(90_000);
    const next = c.get('Pod', 'default', 'db-0')!;
    expect(next.metadata.uid).not.toBe(first.metadata.uid);
    expect(next.spec.nodeName).not.toBe(first.spec.nodeName);
    expect(exec(c, next, 'cat', '/data/log').out).toBe('first\nsecond\n');
    expect(exec(c, next, 'cat', '/scratch/log').code).toBe(1);
    expect(exec(c, next, 'sh', '-c', 'echo replacement >/data/log').code).toBe(0);
    const copy = new Cluster(); copy.restore(c.snapshot());
    expect(exec(copy, copy.get('Pod', 'default', 'db-0')!, 'cat', '/data/log').out).toBe('replacement\n');
    expect(Object.keys(copy.volumeFiles).some(key => key.startsWith(`pod:${first.metadata.uid}:`))).toBe(false);
  });
  it('6: in-pod rollout uses SA rights; run overrides and CSIDriver are supported', async () => {
    const m = await machine(); const c = k8sState(m).cluster!;
    await m.exec('kubectl create deployment web --image=trainer/web:1.0');
    const override = JSON.stringify({ spec: { serviceAccountName: 'deployer' }, metadata: { labels: { task: 'ci' } } });
    await m.exec('kubectl create serviceaccount deployer');
    const result = await m.exec(`kubectl run client --image=trainer/client:1.0 --overrides='${override}'`);
    expect(result.exit).toBe(0); expect(result.out).not.toContain('does not model');
    c.advance(30_000);
    const pod = c.get('Pod', 'default', 'client')!;
    expect(pod.spec.serviceAccountName).toBe('deployer'); expect(pod.metadata.labels.task).toBe('ci');
    expect(exec(c, pod, 'kubectl', 'set', 'image', 'deployment/web', 'web=trainer/web:1.1').err).toContain('Forbidden');
    await m.exec('kubectl create role deployer --verb=get,list,patch --resource=deployments,replicasets');
    await m.exec('kubectl create rolebinding deployer --role=deployer --serviceaccount=default:deployer');
    expect(exec(c, pod, 'kubectl', '-n', 'default', 'set', 'image', 'deployment/web', 'web=trainer/web:1.1').code).toBe(0);
    expect(exec(c, pod, 'kubectl', 'rollout', 'status', 'deployment/web', '--timeout=90s').out).toContain('successfully rolled out');
    expect(exec(c, pod, 'kubectl', 'rollout', 'undo', 'deployment/web').code).toBe(0);
    expect(c.get('Deployment', 'default', 'web')!.spec.template.spec.containers[0].image).toBe('trainer/web:1.0');
    expect(exec(c, pod, 'kubectl', 'rollout', 'restart', 'deployment/web').code).toBe(0);
    expect(c.get('Deployment', 'default', 'web')!.spec.template.metadata.annotations['kubectl.kubernetes.io/restartedAt']).toBeTruthy();
    expect(exec(c, pod, 'kubectl', 'set', 'image', 'deployment/web', 'web=trainer/web:1.1', '--as=admin').code).toBe(1);
    expect((await m.exec('kubectl get csidrivers')).exit).toBe(0);
    expect((await m.exec("kubectl run broken --image=busybox:1.37 --overrides='{bad}'")).exit).toBe(1);
    expect(c.get('Pod', 'default', 'broken')).toBeUndefined();
    expect((await m.exec(`kubectl run dry --image=busybox:1.37 --overrides='${override}' --dry-run=server`)).exit).toBe(0);
    expect(c.get('Pod', 'default', 'dry')).toBeUndefined();
  });
  it('7: core binder reports FailedBinding without add-ons and binds static volumes', () => {
    const c = new Cluster();
    c.create({ apiVersion: 'v1', kind: 'PersistentVolumeClaim', metadata: { name: 'data' }, spec: { accessModes: ['ReadWriteOnce'], resources: { requests: { storage: '1Gi' } } } });
    c.advance(2000);
    expect(c.addons).toBeNull();
    expect(c.list('Event').some(e => e.reason === 'FailedBinding' && e.message === 'no persistent volumes available for this claim and no storage class is set')).toBe(true);
    c.create({ apiVersion: 'v1', kind: 'PersistentVolume', metadata: { name: 'disk' }, spec: { capacity: { storage: '2Gi' }, accessModes: ['ReadWriteOnce'], hostPath: { path: '/disk' }, persistentVolumeReclaimPolicy: 'Retain' } });
    c.advance(2000);
    expect(c.get('PersistentVolumeClaim', 'default', 'data')!.spec.volumeName).toBe('disk');
    expect(c.get('PersistentVolumeClaim', 'default', 'data')!.status.phase).toBe('Bound');
    expect(c.get('PersistentVolume', undefined, 'disk')!.status.phase).toBe('Bound');
  });
  it('8: helm --kube-context selects identity and namespace without changing current context', async () => {
    const m = await machine();
    await m.exec('kubectl create namespace team');
    await m.exec('kubectl config set-context team --user=default --namespace=team');
    await m.exec('kubectl config set-context reader --user=nobody --namespace=team');
    expect((await m.exec('helm --kube-context team install demo nginx-web --wait')).exit).toBe(0);
    expect(k8sState(m).cluster!.get('Deployment', 'team', 'demo')).toBeTruthy();
    expect((await m.exec('helm list --kube-context=team')).out).toContain('demo');
    expect((await m.exec('helm list --kube-context=reader')).out).toContain('forbidden');
    expect((await m.exec('helm list --kube-context=missing')).out).toContain('does not exist');
    expect((await m.exec('helm list')).out).not.toContain('demo');
    expect((await m.exec('helm list --kube-context team -n default')).out).not.toContain('demo');
  });
});
