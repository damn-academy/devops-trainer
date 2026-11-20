import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import { createSimMachine, stripAnsi, type SimMachine } from '../src/engine/terminal/shell';
import kubeModule from '../src/engine/kube-lite/module';
import { Cluster } from '../src/engine/kube-lite/cluster';
import { k8sState } from '../src/engine/kube-lite/state';
import { failedMessage } from '../src/engine/kube-lite/scheduler';
import { kubeProxyHash, base32, sha256, hex, age } from '../src/engine/kube-lite/util';
import type { TerminalSetup } from '../src/core/types';

const reg = createTerminalRegistry();
for (const c of [...BUILTINS, ...BASIC_COMMANDS]) reg.commands.add(c);
for (const c of kubeModule.commands ?? []) reg.commands.add(c);
reg.facts.push(...(kubeModule.facts ?? []));
reg.setup.push(...(kubeModule.setup ?? []));

const mk = (k8s: unknown = {}, extra: TerminalSetup = {}) => createSimMachine({ ...extra, ext: { k8s } }, { registry: reg });
const run = async (m: SimMachine, line: string) => {
  const r = await m.exec(line);
  return { ...r, out: stripAnsi(r.out) };
};
const cl = (m: SimMachine) => k8sState(m).cluster!;
const ff = (m: SimMachine, ms: number) => cl(m).advance(ms);

describe('utilities', () => {
  it('computes SHA-256 and kube-proxy chain hashes', () => {
    expect(hex(sha256('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(base32(new Uint8Array([0x66, 0x6f, 0x6f]))).toBe('MZXW6');
    expect(kubeProxyHash('default/web', 'tcp')).toMatch(/^[A-Z2-7]{16}$/);
  });
  it('prints ages like kubectl', () => {
    expect(age(5_000)).toBe('5s');
    expect(age(150_000)).toBe('2m30s');
    expect(age(3 * 3600_000 + 60_000)).toBe('3h1m');
    expect(age(4 * 86_400_000)).toBe('4d');
  });
  it('formats FailedScheduling as the scheduler does', () => {
    const msg = failedMessage([
      { node: 'cp-1', ok: false, reason: 'node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }', plugin: 'TaintToleration' },
      { node: 'w1', ok: false, reason: 'Insufficient memory', resources: true },
      { node: 'w2', ok: false, reason: 'Insufficient memory', resources: true },
    ]);
    expect(msg).toBe(
      '0/3 nodes are available: 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }, 2 Insufficient memory. preemption: 0/3 nodes are available: 1 Preemption is not helpful for scheduling, 2 No preemption victims found for incoming pod.',
    );
  });
});

describe('kube-lite cluster', () => {
  it('boots three Ready nodes with CoreDNS running', async () => {
    const m = await mk();
    const nodes = await run(m, 'kubectl get nodes');
    expect(nodes.out).toMatch(/cp-1\s+Ready\s+control-plane,master\s+4d\s+v1\.37\.1\+k3s1/);
    expect(nodes.out).toMatch(/worker-2\s+Ready\s+<none>/);
    const sys = await run(m, 'kubectl get pods -n kube-system');
    expect(sys.out).toMatch(/coredns-\w+-\w{5}\s+1\/1\s+Running\s+0\s+4d/);
    expect((await run(m, 'kubectl get pods')).out).toBe('No resources found in default namespace.\n');
  });

  it('creates a Deployment → ReplicaSet → Pods and keeps the count', async () => {
    const m = await mk();
    const r = await run(m, 'kubectl create deployment web --image=trainer/web:1.0 --replicas=3');
    expect(r.out).toBe('deployment.apps/web created\n');
    ff(m, 10_000);
    const d = await run(m, 'kubectl get deploy web');
    expect(d.out).toMatch(/web\s+3\/3\s+3\s+3\s+\d+s/);
    const pods = cl(m).list('Pod', 'default');
    expect(pods).toHaveLength(3);
    expect(pods.every((p) => p.metadata.ownerReferences[0].kind === 'ReplicaSet')).toBe(true);
    expect(new Set(pods.map((p) => p.spec.nodeName)).size).toBeGreaterThan(1);
    const victim = pods[0].metadata.name;
    const del = await run(m, `kubectl delete pod ${victim}`);
    expect(del.out).toBe(`pod "${victim}" deleted from default namespace\n`);
    ff(m, 5000);
    const after = cl(m).list('Pod', 'default');
    expect(after).toHaveLength(3);
    expect(after.map((p) => p.metadata.name)).not.toContain(victim);
  });

  it('rolls out a new image without going under the availability floor and rolls back', async () => {
    const m = await mk();
    await run(m, 'kubectl create deployment web --image=trainer/web:1.0 --replicas=4');
    ff(m, 10_000);
    const c = cl(m);
    let minAvailable = 99;
    const off = c.on(() => {
      const d = c.get('Deployment', 'default', 'web');
      if (d?.status?.availableReplicas !== undefined) minAvailable = Math.min(minAvailable, d.status.availableReplicas);
    });
    expect((await run(m, 'kubectl set image deployment/web web=trainer/web:1.1')).out).toBe('deployment.apps/web image updated\n');
    const st = await run(m, 'kubectl rollout status deployment/web');
    off();
    expect(st.out).toContain('Waiting for deployment "web" rollout to finish');
    expect(st.out.trim().split('\n').pop()).toBe('deployment "web" successfully rolled out');
    expect(minAvailable).toBeGreaterThanOrEqual(3); // 4 replicas, maxUnavailable 25% → at least 3 available
    expect(c.list('Pod', 'default').filter((p) => !p.metadata.deletionTimestamp).every((p) => p.spec.containers[0].image === 'trainer/web:1.1')).toBe(true);
    const hist = await run(m, 'kubectl rollout history deployment/web');
    expect(hist.out).toMatch(/REVISION\s+CHANGE-CAUSE\n1\s+<none>\n2\s+<none>/);
    expect((await run(m, 'kubectl rollout undo deployment/web --to-revision=1')).out).toBe('deployment.apps/web rolled back\n');
    await run(m, 'kubectl rollout status deployment/web');
    expect(c.list('Pod', 'default').filter((p) => !p.metadata.deletionTimestamp).every((p) => p.spec.containers[0].image === 'trainer/web:1.0')).toBe(true);
    expect((await run(m, 'kubectl rollout history deployment/web')).out).toMatch(/2\s+<none>\n3\s+<none>/);
  });

  it('rejects maxSurge=0 with maxUnavailable=0 with the real message', async () => {
    const m = await mk(
      {},
      {
        files: [
          {
            path: '~/web.yaml',
            content: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  replicas: 2\n  selector:\n    matchLabels: {app: web}\n  strategy:\n    rollingUpdate: {maxSurge: 0, maxUnavailable: 0}\n  template:\n    metadata:\n      labels: {app: web}\n    spec:\n      containers:\n      - name: web\n        image: trainer/web:1.0\n',
          },
        ],
      },
    );
    const r = await run(m, 'kubectl apply -f web.yaml');
    expect(r.exit).toBe(1);
    expect(r.out).toContain('The Deployment "web" is invalid: spec.strategy.rollingUpdate.maxUnavailable: Invalid value: intstr.IntOrString{Type:0, IntVal:0, StrVal:""}: may not be 0 when `maxSurge` is 0');
  });

  it('keeps fields set by kubectl scale through a later apply (three-way merge)', async () => {
    const yaml = 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\nspec:\n  selector:\n    matchLabels: {app: web}\n  template:\n    metadata:\n      labels: {app: web}\n    spec:\n      containers:\n      - name: web\n        image: trainer/web:1.0\n';
    const m = await mk({}, { files: [{ path: '~/web.yaml', content: yaml }] });
    expect((await run(m, 'kubectl apply -f web.yaml')).out).toBe('deployment.apps/web created\n');
    await run(m, 'kubectl scale deployment web --replicas=4');
    expect((await run(m, 'kubectl apply -f web.yaml')).out).toBe('deployment.apps/web unchanged\n');
    expect(cl(m).get('Deployment', 'default', 'web')!.spec.replicas).toBe(4);
  });

  it('shows ErrImagePull → ImagePullBackOff for a tag that does not exist', async () => {
    const m = await mk();
    await run(m, 'kubectl run report --image=trainer/web:typo');
    ff(m, 4000);
    const s = (await run(m, 'kubectl get pod report')).out;
    expect(s).toMatch(/report\s+0\/1\s+(ErrImagePull|ImagePullBackOff)/);
    ff(m, 3000);
    expect((await run(m, 'kubectl get pod report')).out).toMatch(/ImagePullBackOff/);
    const d = (await run(m, 'kubectl describe pod report')).out;
    expect(d).toContain('Failed to pull image "trainer/web:typo": rpc error: code = NotFound desc = failed to pull and unpack image "docker.io/trainer/web:typo"');
    expect(d).toMatch(/Back-off pulling image "trainer\/web:typo"/);
  });

  it('puts a crashing container into CrashLoopBackOff with growing back-off and keeps previous logs', async () => {
    const m = await mk();
    await run(m, 'kubectl run crash --image=trainer/web:2.0');
    ff(m, 6000);
    expect((await run(m, 'kubectl get pod crash')).out).toMatch(/crash\s+0\/1\s+CrashLoopBackOff\s+0/);
    ff(m, 40_000);
    const out = (await run(m, 'kubectl get pod crash')).out;
    expect(out).toMatch(/crash\s+0\/1\s+(CrashLoopBackOff|Running|Error)\s+[12] \(\d+s ago\)/);
    expect((await run(m, 'kubectl logs crash --previous')).out).toContain('panic: config not found');
  });

  it('leaves an unschedulable pod Pending with a FailedScheduling event', async () => {
    const m = await mk();
    const yaml = 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: big\nspec:\n  containers:\n  - name: big\n    image: trainer/web:1.0\n    resources:\n      requests:\n        memory: 8Gi\n';
    await m.rootFs.writeFile('/home/learner/big.yaml', yaml);
    await run(m, 'kubectl apply -f big.yaml');
    ff(m, 2000);
    expect((await run(m, 'kubectl get pod big')).out).toMatch(/big\s+0\/1\s+Pending/);
    expect((await run(m, 'kubectl describe pod big')).out).toContain('0/3 nodes are available: 3 Insufficient memory. preemption: 0/3 nodes are available: 3 No preemption victims found for incoming pod.');
  });

  it('a stopped scheduler leaves pods Pending with no events at all; a stopped controller-manager creates no ReplicaSet', async () => {
    const m = await mk({ components: { scheduler: false } });
    await run(m, 'kubectl run p --image=trainer/web:1.0');
    ff(m, 5000);
    expect(cl(m).get('Pod', 'default', 'p')!.spec.nodeName).toBeUndefined();
    expect((await run(m, 'kubectl describe pod p')).out).toMatch(/Node:\s+<none>/);
    expect((await run(m, 'kubectl describe pod p')).out).toMatch(/Events:\s+<none>/);
    const m2 = await mk({ components: { 'controller-manager': false } });
    await run(m2, 'kubectl create deployment web --image=trainer/web:1.0 --replicas=3');
    ff(m2, 5000);
    expect((await run(m2, 'kubectl get deploy web')).out).toMatch(/web\s+0\/3\s+0\s+0/);
    expect(cl(m2).list('ReplicaSet', 'default')).toHaveLength(0);
  });

  it('a node that loses power goes Unknown after the grace period and its pods are replaced after 300 s', async () => {
    const m = await mk();
    await run(m, 'kubectl create deployment web --image=trainer/web:1.0 --replicas=3');
    ff(m, 10_000);
    const c = cl(m);
    const onW2 = c.list('Pod', 'default').filter((p) => p.spec.nodeName === 'worker-2').map((p) => p.metadata.name);
    expect(onW2.length).toBeGreaterThan(0);
    await run(m, 'cluster power off worker-2');
    ff(m, 40_000);
    expect((await run(m, 'kubectl get node worker-2')).out).toMatch(/worker-2\s+Ready/);
    ff(m, 15_000);
    expect((await run(m, 'kubectl get node worker-2')).out).toMatch(/worker-2\s+NotReady/);
    expect(c.get('Node', undefined, 'worker-2')!.spec.taints.map((t: { key: string }) => t.key)).toContain('node.kubernetes.io/unreachable');
    ff(m, 310_000);
    const pods = c.list('Pod', 'default');
    const alive = pods.filter((p) => !p.metadata.deletionTimestamp);
    expect(alive.filter((p) => p.spec.nodeName !== 'worker-2').length).toBe(3);
    expect(pods.filter((p) => onW2.includes(p.metadata.name)).every((p) => p.metadata.deletionTimestamp)).toBe(true);
    expect((await run(m, 'kubectl get pods')).out).toMatch(/Terminating/);
    await run(m, 'cluster power on worker-2');
    ff(m, 15_000);
    expect(c.list('Pod', 'default').filter((p) => onW2.includes(p.metadata.name))).toHaveLength(0);
    expect((await run(m, 'kubectl get node worker-2')).out).toMatch(/worker-2\s+Ready/);
  });

  it('routes a Service by name through DNS, kube-proxy and the EndpointSlice; breaks where it should', async () => {
    const m = await mk();
    await run(m, 'kubectl create deployment web --image=trainer/web:1.0 --replicas=2 --port=80');
    await run(m, 'kubectl expose deployment web --port=80');
    await run(m, 'kubectl run client --image=trainer/client:1.0 --command -- sleep infinity');
    ff(m, 10_000);
    const ok = await run(m, 'kubectl exec client -- curl -s http://web');
    expect(ok.out).toMatch(/^Hello from web-\w+-\w{5} \(10\.42\.\d+\.\d+\), version 1\.0\n$/);
    expect((await run(m, 'kubectl exec client -- nslookup web')).out).toContain('Name:\tweb.default.svc.cluster.local');
    expect((await run(m, 'kubectl exec client -- cat /etc/resolv.conf')).out).toBe('search default.svc.cluster.local svc.cluster.local cluster.local\nnameserver 10.43.0.10\noptions ndots:5\n');
    const slices = await run(m, 'kubectl get endpointslices -l kubernetes.io/service-name=web');
    expect(slices.out).toMatch(/web-\w{5}\s+IPv4\s+80\s+10\.42\.\d+\.\d+,10\.42\.\d+\.\d+/);
    const ipt = (await run(m, 'cluster iptables cp-1')).out;
    const svcIp = cl(m).get('Service', 'default', 'web')!.spec.clusterIP;
    expect(ipt).toMatch(new RegExp(`-A KUBE-SERVICES -d ${svcIp.replace(/\./g, '\\.')}/32 -p tcp -m comment --comment "default/web cluster IP" -m tcp --dport 80 -j KUBE-SVC-[A-Z2-7]{16}`));
    expect(ipt).toContain('--probability 0.50000000000');
    expect((await run(m, 'cluster ip addr cp-1')).out).not.toContain(svcIp);
    // Break the selector: endpoints empty → REJECT → connection refused.
    await run(m, `kubectl patch service web -p '{"spec":{"selector":{"app":"wbe"}}}'`);
    const refused = await run(m, 'kubectl exec client -- curl -s http://web');
    expect(refused.exit).toBe(7);
    expect(refused.out).toContain('command terminated with exit code 7');
    await run(m, `kubectl patch service web -p '{"spec":{"selector":{"app":"web"}}}'`);
    expect((await run(m, 'kubectl exec client -- curl -s http://web')).exit).toBe(0);
    // DNS down: the name fails, the IP still works.
    await run(m, 'cluster stop coredns');
    expect((await run(m, 'kubectl exec client -- curl -sS http://web')).out).toContain('curl: (6) Could not resolve host: web');
    expect((await run(m, `kubectl exec client -- curl -s http://${svcIp}`)).exit).toBe(0);
  });

  it('a stopped kube-proxy keeps old rules but gives new Services no rule', async () => {
    const m = await mk();
    await run(m, 'kubectl create deployment web --image=trainer/web:1.0 --port=80');
    await run(m, 'kubectl expose deployment web --port=80');
    await run(m, 'kubectl run client --image=trainer/client:1.0');
    ff(m, 8000);
    await run(m, 'cluster stop kube-proxy');
    await run(m, 'kubectl expose deployment web --port=80 --name=web2');
    ff(m, 3000);
    expect((await run(m, 'kubectl exec client -- curl -s http://web')).exit).toBe(0);
    const r = await run(m, 'kubectl exec client -- curl http://web2');
    expect(r.out).toContain("curl: (28) Failed to connect to web2 port 80");
  });

  it('explains fields like kubectl explain', async () => {
    const m = await mk();
    const r = await run(m, 'kubectl explain deployment.spec.strategy.rollingUpdate.maxSurge');
    expect(r.out).toMatch(/^GROUP:      apps\nKIND:       Deployment\nVERSION:    v1\n\nFIELD: maxSurge <IntOrString>\n\nDESCRIPTION:\n    The maximum number of pods/);
    const pod = await run(m, 'kubectl explain pod.spec.containers');
    expect(pod.out).toContain('FIELDS:\n  args\t<[]string>');
    expect(pod.out).toContain('  name\t<string> -required-');
    expect((await run(m, 'kubectl explain pod.spec.nope')).out).toContain('error: field "nope" does not exist');
  });

  it('prints client dry-run objects and supports kubeconfig contexts', async () => {
    const m = await mk({ contexts: { staging: 'staging' } });
    const y = await run(m, 'kubectl run web --image=trainer/web:1.0 --dry-run=client -o yaml');
    expect(y.out).toBe('apiVersion: v1\nkind: Pod\nmetadata:\n  creationTimestamp: null\n  labels:\n    run: web\n  name: web\nspec:\n  containers:\n  - image: trainer/web:1.0\n    name: web\n    resources: {}\n  dnsPolicy: ClusterFirst\n  restartPolicy: Always\nstatus: {}\n');
    const ctx = await run(m, 'kubectl config get-contexts');
    expect(ctx.out).toMatch(/CURRENT\s+NAME\s+CLUSTER\s+AUTHINFO\s+NAMESPACE\n\*\s+default\s+default\s+default\s*\n\s+staging\s+default\s+default\s+staging/);
    await run(m, 'kubectl create namespace staging');
    expect((await run(m, 'kubectl config use-context staging')).out).toBe('Switched to context "staging".\n');
    await run(m, 'kubectl run x --image=trainer/web:1.0');
    expect(cl(m).get('Pod', 'staging', 'x')).toBeTruthy();
  });

  it('reports a missing kubeconfig and a stopped API server as kubectl does', async () => {
    const plain = await createSimMachine({}, { registry: reg });
    expect((await run(plain, 'kubectl get pods')).out).toContain('The connection to the server localhost:8080 was refused - did you specify the right host or port?');
    const m = await mk({ components: { apiserver: false } });
    expect((await run(m, 'kubectl get pods')).out).toContain('The connection to the server 127.0.0.1:6443 was refused - did you specify the right host or port?');
  });

  it('explains unknown and unsupported flags differently', async () => {
    const m = await mk();
    expect((await run(m, 'kubectl get pods --bogus')).out).toContain("error: unknown flag: --bogus\nSee 'kubectl get --help' for usage.");
    expect((await run(m, 'kubectl apply -f x.yaml --server-side')).out).toContain('the flag --server-side exists in kubectl');
    expect((await run(m, 'kubectl get imaginaryresources')).out).toContain('error: the server doesn\'t have a resource type "imaginaryresources"');
    expect((await run(m, 'kubectl gte pods')).out).toContain('Did you mean this?\n\tget');
  });

  it('survives a snapshot and restore of the machine', async () => {
    const m = await mk();
    await run(m, 'kubectl create deployment web --image=trainer/web:1.0 --replicas=2');
    ff(m, 8000);
    const snap = await m.snapshot();
    await run(m, 'kubectl delete deployment web');
    expect(cl(m).get('Deployment', 'default', 'web')).toBeUndefined();
    await m.restore(snap);
    expect(cl(m).get('Deployment', 'default', 'web')).toBeTruthy();
    expect((await run(m, 'kubectl get deploy web')).out).toMatch(/web\s+2\/2/);
  });

  it('gives checks k8s facts that predicates read', async () => {
    const m = await mk();
    await run(m, 'kubectl create namespace shop');
    await run(m, 'kubectl create deployment web -n shop --image=trainer/web:1.0 --replicas=3');
    ff(m, 10_000);
    const f = await m.facts();
    expect(evaluateCheck({ when: 'k8s.deployments[ns=shop][name=web].ready>=3' }, f).pass).toBe(true);
    expect(evaluateCheck({ when: 'k8s.pods[ns=shop][ready=true]#=3' }, f).pass).toBe(true);
    expect(evaluateCheck({ when: 'k8s.objects[kind=Deployment][metadata.name=web].spec.replicas=3' }, f).pass).toBe(true);
    expect(evaluateCheck({ when: 'k8s.nodes[ready=true]#=3' }, f).pass).toBe(true);
  });

  it('keeps resourceVersion monotonic and returns Conflict on a stale write', () => {
    const c = new Cluster({ nodes: ['a'] });
    const cm = c.create({ apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'x' }, data: { a: '1' } });
    const rv1 = Number(cm.metadata.resourceVersion);
    const cm2 = c.replace({ ...cm, data: { a: '2' } });
    expect(Number(cm2.metadata.resourceVersion)).toBeGreaterThan(rv1);
    expect(() => c.replace({ ...cm, data: { a: '3' } })).toThrow(/the object has been modified/);
  });

  it('runs a Job to completion and garbage-collects pods of a deleted ReplicaSet', async () => {
    const m = await mk();
    await run(m, 'kubectl create job once --image=trainer/job:1.0');
    ff(m, 15_000);
    expect((await run(m, 'kubectl get job once')).out).toMatch(/once\s+Complete\s+1\/1/);
    await run(m, 'kubectl create deployment web --image=trainer/web:1.0 --replicas=2');
    ff(m, 6000);
    const rs = cl(m).list('ReplicaSet', 'default')[0].metadata.name;
    await run(m, `kubectl delete rs ${rs} --cascade=orphan`);
    ff(m, 3000);
    // The Deployment creates a new ReplicaSet that adopts the orphans (same template hash → same name).
    expect(cl(m).list('Pod', 'default').filter((p) => p.metadata.labels?.app === 'web' && !p.metadata.deletionTimestamp)).toHaveLength(2);
  });
});
