import { describe, it, expect } from 'vitest';
import { Cluster } from '../src/engine/kube-lite/cluster';
import { apiClient, identity, canI } from '../src/engine/kube-lite/rbac';
import { renderChart, runHelm, helmReleases } from '../src/engine/kube-lite/helm';
import { clusterFacts } from '../src/engine/kube-lite/facts';
import { resolve } from '../src/engine/kube-lite/network';
import { statefulRevisions } from '../src/engine/kube-lite/statefulset';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import { createSimMachine } from '../src/engine/terminal/shell';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import kubeModule from '../src/engine/kube-lite/module';
import { k8sState } from '../src/engine/kube-lite/state';
import { podExec } from '../src/engine/kube-lite/kubectl/podshell';
import type { Obj } from '../src/engine/kube-lite/util';

const registry = createTerminalRegistry();
for (const command of [...BUILTINS, ...BASIC_COMMANDS, ...(kubeModule.commands ?? [])]) registry.commands.add(command);
registry.setup.push(...(kubeModule.setup ?? []));
const machine = () => createSimMachine({ ext: { k8s: {} } }, { registry });
const ns = (c: Cluster, name: string) => c.create({ apiVersion: 'v1', kind: 'Namespace', metadata: { name } });
const role = (c: Cluster, namespace: string, name: string, rules: Obj[], user = 'developer') => {
  c.create({ apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'Role', metadata: { name, namespace }, rules });
  c.create({ apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'RoleBinding', metadata: { name, namespace }, roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name }, subjects: [{ kind: 'User', apiGroup: 'rbac.authorization.k8s.io', name: user }] });
};

describe('RBAC API boundary and CLI', () => {
  it('denies before reading or mutating, scopes bindings, groups and resourceNames', () => {
    const c = new Cluster(); ns(c, 'prod');
    const who = identity('developer'), api = apiClient(c, who);
    expect(() => api.list('Pod', 'prod')).toThrow('pods is forbidden: User "developer" cannot list resource "pods" in API group "" in the namespace "prod"');
    role(c, 'prod', 'reader', [{ apiGroups: [''], resources: ['pods', 'pods/log'], verbs: ['get'], resourceNames: ['web'] }]);
    expect(canI(c, who, 'get', 'pods', '', 'prod', 'web')).toBe(true);
    expect(canI(c, who, 'get', 'pods/log', '', 'prod', 'web')).toBe(true);
    expect(canI(c, who, 'get', 'pods/exec', '', 'prod', 'web')).toBe(false);
    expect(canI(c, who, 'list', 'pods', '', 'prod')).toBe(false);
    expect(canI(c, who, 'get', 'pods', '', 'default', 'web')).toBe(false);
    expect(() => api.create({ apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'x', namespace: 'prod' } })).toThrow('cannot create');
    expect(c.get('ConfigMap', 'prod', 'x')).toBeUndefined();
    c.create({ apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'ClusterRoleBinding', metadata: { name: 'viewers' }, roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'view' }, subjects: [{ kind: 'Group', apiGroup: 'rbac.authorization.k8s.io', name: 'readers' }] });
    expect(canI(c, identity('jane', ['readers']), 'list', 'pods', '', 'prod')).toBe(true);
    expect(canI(c, identity('jane', ['readers']), 'get', 'secrets', '', 'prod', 'x')).toBe(false);
    expect(clusterFacts(c).rbac?.decisions.some(d => !d.allowed)).toBe(true);
  });
  it('prints Forbidden, can-i, get and describe; supports imperative forms and contexts', async () => {
    const m = await machine();
    expect((await m.exec('kubectl create namespace prod')).exit).toBe(0);
    const denied = await m.exec('kubectl --as=developer get pods -n prod');
    expect(denied.out).toBe('Error from server (Forbidden): pods is forbidden: User "developer" cannot list resource "pods" in API group "" in the namespace "prod"\n');
    expect((await m.exec('kubectl create role reader --verb=get,list --resource=pods,pods/log -n prod')).out).toContain('role.rbac.authorization.k8s.io/reader created');
    expect((await m.exec('kubectl create rolebinding read --role=reader --user=developer -n prod')).out).toContain('created');
    expect((await m.exec('kubectl auth can-i list pods --as developer -n prod')).out).toBe('yes\n');
    expect((await m.exec("kubectl auth can-i '*' '*'")).out).toBe('yes\n');
    expect((await m.exec('kubectl auth can-i list pods --as developer -A')).out).toBe('no\n');
    expect((await m.exec('kubectl auth can-i --list --as developer -n prod')).out).toMatch(/Resources\s+Non-Resource URLs\s+Resource Names\s+Verbs/);
    expect((await m.exec('kubectl describe role reader -n prod')).out).toContain('PolicyRule:');
    expect((await m.exec('kubectl get rolebinding -n prod')).out).toMatch(/NAME\s+ROLE\s+AGE/);
    expect((await m.exec('kubectl describe rolebinding read -n prod')).out).toContain('Subjects:');
    expect((await m.exec('kubectl create serviceaccount robot -n prod')).out).toContain('serviceaccount/robot created');
    expect((await m.exec('kubectl --context developer get pods -n prod')).out).toBe('No resources found in prod namespace.\n');
  });
  it('uses the pod service account for in-pod kubectl and bearer curl', () => {
    const c = new Cluster();
    c.create({ apiVersion: 'v1', kind: 'Pod', metadata: { name: 'client' }, spec: { containers: [{ name: 'client', image: 'trainer/client:1.0' }] } }); c.advance(10_000);
    const p = c.get('Pod', 'default', 'client')!, ct = p.spec.containers[0];
    expect(podExec(c, p, ct, ['kubectl', 'get', 'pods']).err).toContain('system:serviceaccount:default:default');
    role(c, 'default', 'pod-reader', [{ apiGroups: [''], resources: ['pods'], verbs: ['list'] }], 'system:serviceaccount:default:default');
    expect(podExec(c, p, ct, ['kubectl', 'get', 'pods']).out).toContain('client');
    expect(podExec(c, p, ct, ['sh', '-c', 'curl -k -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" https://kubernetes.default.svc/api/v1/namespaces/default/pods']).out).toContain('"kind": "Pod"');
  });
});

function stateful(c: Cluster, replicas = 3, policy = 'OrderedReady') {
  const manifests = renderChart('postgres-like', 'db', 'default', { replicaCount: replicas, persistence: { storageClass: 'csi-hostpath-sc' } });
  manifests[1].spec.podManagementPolicy = policy;
  for (const o of manifests) c.apply(o);
  return c.get('StatefulSet', 'default', 'db')!;
}
describe('StatefulSet reconciliation', () => {
  it('orders startup, binds individual PVCs, resolves stable DNS, and keeps claims on scale down', () => {
    const c = new Cluster({ addons: ['csi-hostpath'] }); stateful(c);
    expect(c.list('Pod', 'default').map(p => p.metadata.name)).toEqual(['db-0']);
    c.advance(90_000);
    expect(c.get('StatefulSet', 'default', 'db')!.status.readyReplicas).toBe(3);
    expect(c.list('PersistentVolumeClaim', 'default')).toHaveLength(3);
    expect(c.list('PersistentVolumeClaim', 'default').every(p => p.status.phase === 'Bound')).toBe(true);
    expect(resolve(c, 'default', 'db-0.db.default.svc.cluster.local').ips).toEqual([c.get('Pod', 'default', 'db-0')!.status.podIP]);
    c.patch('StatefulSet', 'default', 'db', { spec: { replicas: 1 } });
    expect(c.get('Pod', 'default', 'db-2')!.metadata.deletionTimestamp).toBeTruthy();
    expect(c.get('Pod', 'default', 'db-1')!.metadata.deletionTimestamp).toBeUndefined();
    c.advance(90_000);
    expect(c.list('Pod', 'default').map(p => p.metadata.name)).toEqual(['db-0']);
    expect(c.list('PersistentVolumeClaim', 'default')).toHaveLength(3);
    expect(clusterFacts(c).statefulsets?.[0].pvcs).toHaveLength(3);
  });
  it('supports Parallel startup, reverse rolling update, partition, history and undo', async () => {
    const m = await machine(); const c = k8sState(m).cluster!;
    const s = stateful(c, 3, 'Parallel');
    expect(c.list('Pod', 'default')).toHaveLength(3);
    // Bind static storage for this test by disabling claims before creating would change the template; install the add-on scenario in the other test.
    for (const p of c.list('PersistentVolumeClaim', 'default')) c.putStatus(p, { phase: 'Bound' });
    c.advance(30_000);
    const old = c.get('Pod', 'default', 'db-0')!.metadata.uid;
    c.patch('StatefulSet', 'default', 'db', { spec: { updateStrategy: { rollingUpdate: { partition: 1 } }, template: { spec: { containers: [{ name: 'postgres-like', image: 'trainer/web:2.0', ports: [{ containerPort: 5432, name: 'http' }] }] } } } });
    expect(c.get('Pod', 'default', 'db-2')!.metadata.deletionTimestamp).toBeTruthy();
    c.advance(120_000);
    expect(c.get('Pod', 'default', 'db-0')!.metadata.uid).toBe(old);
    expect(c.get('Pod', 'default', 'db-1')!.spec.containers[0].image).toBe('trainer/web:2.0');
    expect(statefulRevisions(c, s)).toHaveLength(2);
    expect((await m.exec('kubectl get sts')).out).toMatch(/NAME\s+READY\s+AGE/);
    expect((await m.exec('kubectl describe sts db')).out).toContain('Volume Claims:');
    expect((await m.exec('kubectl rollout history sts/db')).out).toMatch(/REVISION\s+CHANGE-CAUSE/);
    expect((await m.exec('kubectl rollout undo sts/db')).out).toContain('rolled back');
    c.advance(120_000);
    expect(c.get('Pod', 'default', 'db-2')!.spec.containers[0].image).toBe('trainer/web:1.0');
  });
});

describe('Helm release lifecycle', () => {
  it('renders changed values, installs, upgrades, rolls back and persists revisions as Secrets', () => {
    const c = new Cluster();
    const helm = (s: string) => runHelm(c, s.split(' '), () => 'replicaCount: 2\nimage:\n  tag: "1.26"\n');
    expect(helm('repo add training https://charts.example.test').code).toBe(0);
    expect(helm('repo list').out).toMatch(/NAME\s+URL/);
    expect(helm('search repo nginx').out).toContain('training/nginx-web');
    expect(helm('show values training/nginx-web').out).toContain('replicaCount: 1');
    expect(helm('template web training/nginx-web -f values.yaml --set replicaCount=3').out).toContain('replicas: 3');
    expect(helm('lint training/nginx-web').code).toBe(0);
    expect(helm('install web training/nginx-web -f values.yaml').code).toBe(0);
    expect(c.get('Deployment', 'default', 'web')!.spec.replicas).toBe(2);
    expect(helm('upgrade web training/nginx-web --set replicaCount=4').code).toBe(0);
    expect(helm('list -A').out).toMatch(/NAME\s+NAMESPACE\s+REVISION\s+UPDATED\s+STATUS\s+CHART\s+APP VERSION/);
    expect(helm('history web').out).toMatch(/REVISION\s+UPDATED\s+STATUS/);
    expect(helm('get values web').out).toContain('replicaCount: 4');
    expect(helm('get manifest web').out).toContain('kind: Deployment');
    expect(helm('status web').out).toContain('REVISION: 2');
    expect(helm('upgrade web training/nginx-web --set replicaCount=-1').err).toContain('UPGRADE FAILED');
    expect(c.get('Deployment', 'default', 'web')!.spec.replicas).toBe(4);
    expect(helm('rollback web 1').code).toBe(0);
    expect(c.get('Deployment', 'default', 'web')!.spec.replicas).toBe(2);
    expect(c.get('Secret', 'default', 'sh.helm.release.v1.web.v3')!.type).toBe('helm.sh/release.v1');
    expect(helmReleases(c).map(r => r.status)).toEqual(['superseded', 'superseded', 'deployed']);
    const copy = new Cluster(); copy.restore(c.snapshot());
    expect(copy.helmRepos).toEqual(c.helmRepos);
    expect(clusterFacts(copy).helm?.revisions).toHaveLength(3);
    expect(helm('uninstall web').code).toBe(0);
    expect(helmReleases(c)).toHaveLength(0);
    expect(c.get('Deployment', 'default', 'web')).toBeUndefined();
    expect(helm('upgrade web training/podinfo --install').code).toBe(0);
  });
});

describe('authorization and rollout failure cases', () => {
  it('prevents RBAC escalation, immutable roleRef edits and context impersonation', async () => {
    const c = new Cluster();
    role(c, 'default', 'manager', [{ apiGroups: ['rbac.authorization.k8s.io'], resources: ['roles', 'rolebindings'], verbs: ['create', 'patch'] }]);
    const api = apiClient(c, identity('developer'));
    expect(() => api.create({ apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'Role', metadata: { name: 'escalation' }, rules: [{ apiGroups: ['*'], resources: ['*'], verbs: ['*'] }] })).toThrow('permissions not currently held');
    expect(() => api.create({ apiVersion: 'rbac.authorization.k8s.io/v1', kind: 'RoleBinding', metadata: { name: 'escalation' }, roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'cluster-admin' }, subjects: [{ kind: 'User', name: 'developer' }] })).toThrow('permissions not currently held');
    expect(() => c.patch('RoleBinding', 'default', 'manager', { roleRef: { name: 'other' } })).toThrow('cannot change roleRef');
    const m = await machine();
    expect((await m.exec('kubectl --context developer --as admin get secrets')).out).toContain('cannot impersonate');
  });
  it('does not mount or use a token when automount is disabled and rejects missing accounts', () => {
    const c = new Cluster();
    const pod = c.create({ apiVersion: 'v1', kind: 'Pod', metadata: { name: 'no-token' }, spec: { automountServiceAccountToken: false, containers: [{ name: 'client', image: 'trainer/client:1.0' }] } });
    expect(podExec(c, pod, pod.spec.containers[0], ['kubectl', 'get', 'pods']).err).toContain('Unauthorized');
    expect(() => c.create({ apiVersion: 'v1', kind: 'Pod', metadata: { name: 'missing' }, spec: { serviceAccountName: 'missing', containers: [{ name: 'client', image: 'trainer/client:1.0' }] } })).toThrow('serviceaccount "missing" not found');
  });
  it('waits for readiness in OrderedReady, supports OnDelete, and validates immutable fields', () => {
    const c = new Cluster();
    const objects = renderChart('postgres-like', 'db', 'default', { replicaCount: 2, persistence: { enabled: false }, image: { tag: 'does-not-exist' } });
    for (const o of objects) c.apply(o);
    c.advance(30_000);
    expect(c.list('Pod', 'default').map(p => p.metadata.name)).toEqual(['db-0']);
    expect(c.get('StatefulSet', 'default', 'db')!.status.readyReplicas).toBe(0);
    c.patch('StatefulSet', 'default', 'db', { spec: { updateStrategy: { type: 'OnDelete' }, template: { spec: { containers: [{ name: 'postgres-like', image: 'trainer/web:1.0' }] } } } });
    expect(c.get('Pod', 'default', 'db-0')!.spec.containers[0].image).toContain('does-not-exist');
    c.delete('Pod', 'default', 'db-0', { force: true }); c.advance(30_000);
    expect(c.get('StatefulSet', 'default', 'db')!.status.readyReplicas).toBe(2);
    expect(() => c.patch('StatefulSet', 'default', 'db', { spec: { serviceName: 'other' } })).toThrow('immutable StatefulSet');
  });
  it('prints rollout completion and times out on an unhealthy StatefulSet', async () => {
    const m = await machine(), c = k8sState(m).cluster!;
    for (const o of renderChart('postgres-like', 'db', 'default', { persistence: { enabled: false } })) c.apply(o);
    expect((await m.exec('kubectl rollout status sts/db --timeout=60s')).out).toContain('statefulset rolling update complete 1 pods at revision db-');
    expect((await m.exec('kubectl scale sts/db --replicas=2')).out).toContain('statefulset.apps/db scaled');
    c.advance(20_000);
    c.patch('StatefulSet', 'default', 'db', { spec: { template: { spec: { containers: [{ name: 'postgres-like', image: 'missing:not-found' }] } } } });
    expect((await m.exec('kubectl rollout status sts/db --timeout=60s')).out).toContain('timed out waiting for the condition');
    expect((await m.exec('kubectl rollout undo sts/db --to-revision=1')).exit).toBe(0);
    c.advance(120_000);
    expect((await m.exec('kubectl rollout status sts/db --timeout=60s')).exit).toBe(0);
  });
  it('isolates Helm namespaces, rejects foreign resources and records failed waits', () => {
    const c = new Cluster();
    const helm = (s: string) => runHelm(c, s.split(' '), () => '');
    c.create({ apiVersion: 'v1', kind: 'Service', metadata: { name: 'taken' }, spec: { ports: [{ port: 80 }] } });
    expect(helm('install taken nginx-web').err).toContain('invalid ownership metadata');
    expect(helm('install web nginx-web -n dev --create-namespace --set image.tag=1.26').code).toBe(0);
    expect(c.get('Deployment', 'dev', 'web')!.spec.template.spec.containers[0].image).toBe('nginx:1.26');
    expect(helm('list').out).not.toContain('web');
    expect(helm('list -A').out).toContain('web');
    expect(helm('install bad nginx-web --set image.tag=does-not-exist --wait --timeout=5s').err).toContain('context deadline exceeded');
    expect(helmReleases(c).find(r => r.name === 'bad')!.status).toBe('failed');
    expect(helm('uninstall web -n dev --keep-history').code).toBe(0);
    expect(helmReleases(c, 'dev')[0].status).toBe('uninstalled');
    c.components.apiserver = false;
    expect(helm('template offline nginx-web -n absent').code).toBe(0);
  });
  it('registers Helm in the shell and honors kubeconfig identity', async () => {
    const m = await machine();
    expect((await m.exec('helm repo add training https://charts.example.test')).exit).toBe(0);
    expect((await m.exec('helm install demo training/podinfo --set replicaCount=2')).out).toContain('STATUS: deployed');
    expect((await m.exec('helm list')).out).toContain('podinfo-1.0.0');
    await m.exec('kubectl config use-context developer');
    expect((await m.exec('helm list')).out).toContain('cannot list resource "secrets"');
    expect((await m.exec('helm template local training/nginx-web')).out).toContain('kind: Deployment');
  });
});

it('keeps training deployer grants visible, scoped to setup namespaces and optional', async () => {
  const setup = { namespace: 'staging', manifests: ['apiVersion: v1\nkind: Namespace\nmetadata:\n  name: staging\n---\napiVersion: v1\nkind: Namespace\nmetadata:\n  name: production\n'] };
  const m = await createSimMachine({ ext: { k8s: setup } }, { registry });
  const c = k8sState(m).cluster!;
  expect(canI(c, identity('deployer'), 'patch', 'deployments', 'apps', 'staging', 'web')).toBe(true);
  expect(canI(c, identity('deployer'), 'patch', 'deployments', 'apps', 'production', 'web')).toBe(true);
  ns(c, 'later');
  expect(canI(c, identity('deployer'), 'patch', 'deployments', 'apps', 'later', 'web')).toBe(false);
  expect(canI(c, identity('deployer'), 'get', 'secrets', '', 'staging', 'key')).toBe(false);
  const isolated = await createSimMachine({ ext: { k8s: { ...setup, trainingDeployer: false } } }, { registry });
  expect(canI(k8sState(isolated).cluster!, identity('deployer'), 'patch', 'deployments', 'apps', 'staging', 'web')).toBe(false);
});

it('checks pods/exec but runs the container with its own mounted files', async () => {
  const m = await machine(), c = k8sState(m).cluster!;
  c.create({ apiVersion: 'v1', kind: 'Secret', metadata: { name: 'mounted' }, stringData: { message: 'inside-container' } });
  c.create({ apiVersion: 'v1', kind: 'Pod', metadata: { name: 'client' }, spec: { volumes: [{ name: 'secret', secret: { secretName: 'mounted' } }], containers: [{ name: 'client', image: 'trainer/client:1.0', volumeMounts: [{ name: 'secret', mountPath: '/mounted' }] }] } });
  role(c, 'default', 'exec', [{ apiGroups: [''], resources: ['pods'], verbs: ['get'] }]);
  c.advance(10_000);
  expect((await m.exec('kubectl --as developer exec client -- cat /mounted/message')).out).toContain('cannot create resource "pods/exec"');
  c.patch('Role', 'default', 'exec', { rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get'] }, { apiGroups: [''], resources: ['pods/exec'], verbs: ['create'] }] });
  expect((await m.exec('kubectl --as developer exec client -- cat /mounted/message')).out).toContain('inside-container');
  expect((await m.exec('kubectl --as developer get secret mounted')).out).toContain('Forbidden');
});

it('enforces resourceNames for filtered lists and authorizes watch separately', async () => {
  const m = await machine(), c = k8sState(m).cluster!;
  for (const name of ['one', 'two']) c.create({ apiVersion: 'v1', kind: 'ConfigMap', metadata: { name } });
  role(c, 'default', 'named-reader', [{ apiGroups: [''], resources: ['configmaps'], verbs: ['list'], resourceNames: ['one'] }]);
  expect((await m.exec('kubectl --as developer get configmaps')).out).toContain('Forbidden');
  const filtered = await m.exec('kubectl --as developer get configmaps --field-selector=metadata.name=one');
  expect(filtered.exit).toBe(0);
  expect(filtered.out).toContain('one');
  expect(filtered.out).not.toContain('two');
  expect((await m.exec('kubectl --as developer get configmaps --field-selector=metadata.name=one -w')).out).toContain('cannot watch');
});
