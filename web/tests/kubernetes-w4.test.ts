// Stage 1 exam, placement, the NetworkPolicy section and stage 2 of the
// Kubernetes block: every new task is solvable on a fresh machine and false
// before the learner acts; the egress extension of kube-lite; the arithmetic
// of the new explainers; the output self-check against real command output.

import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { registry } from '../src/core/registry';
import type { Check, Facts, Section, TerminalSetup } from '../src/core/types';
import { createSimMachine, stripAnsi } from '../src/engine/terminal/shell';
import { blobFacts, type CheckBlob } from '../src/engine/kube-lite/checkblob';
import { matchSigns, type OutputSign } from '../src/engine/kube-lite/ui/output-check';
import { netpolFlows } from '../src/blocks/kubernetes/explainers/netpol';
import { loopWave } from '../src/blocks/kubernetes/explainers/loop-chain';
import { certState } from '../src/blocks/kubernetes/explainers/kubeadm-init';
import { tokenValid } from '../src/blocks/kubernetes/explainers/tls-bootstrap';
import { restoreOutcome } from '../src/blocks/kubernetes/explainers/etcd-restore';
import { skewProblems } from '../src/blocks/kubernetes/explainers/upgrade';

const DENY = 'apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: default-deny\n  namespace: pay\nspec:\n  podSelector: {}\n  policyTypes:\n  - Ingress\n';
const ALLOW_AND = 'apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-frontend\n  namespace: pay\nspec:\n  podSelector:\n    matchLabels:\n      app: pay\n  ingress:\n  - from:\n    - namespaceSelector:\n        matchLabels:\n          kubernetes.io/metadata.name: shop\n      podSelector:\n        matchLabels:\n          role: frontend\n    ports:\n    - port: 80\n';
const ALLOW_OR = ALLOW_AND.replace('      podSelector:\n        matchLabels:\n          role: frontend', '    - podSelector:\n        matchLabels:\n          role: frontend');
const ALLOW_NS = 'apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: only-shop\n  namespace: pay\nspec:\n  podSelector: {}\n  ingress:\n  - from:\n    - namespaceSelector:\n        matchLabels:\n          kubernetes.io/metadata.name: shop\n';
const EGRESS = 'apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: shop-egress\n  namespace: shop\nspec:\n  podSelector: {}\n  policyTypes:\n  - Egress\n  egress:\n  - to:\n    - namespaceSelector:\n        matchLabels:\n          kubernetes.io/metadata.name: pay\n    ports:\n    - port: 80\n  - to:\n    - namespaceSelector:\n        matchLabels:\n          kubernetes.io/metadata.name: kube-system\n      podSelector:\n        matchLabels:\n          k8s-app: kube-dns\n    ports:\n    - port: 53\n      protocol: UDP\n';
const EGRESS_NO_DNS = EGRESS.slice(0, EGRESS.indexOf('  - to:\n    - namespaceSelector:\n        matchLabels:\n          kubernetes.io/metadata.name: kube-system'));

const FILES = { 'deny.yaml': DENY, 'and.yaml': ALLOW_AND, 'or.yaml': ALLOW_OR, 'ns.yaml': ALLOW_NS, 'egress.yaml': EGRESS, 'egress-nodns.yaml': EGRESS_NO_DNS };
const withFiles = (s: TerminalSetup): TerminalSetup => ({ ...s, files: [...(s.files ?? []), ...Object.entries(FILES).map(([p, content]) => ({ path: `~/${p}`, content }))] });

async function solve(setup: TerminalSetup, lines: string[], check: Check): Promise<{ pass: boolean; out: string; start: Facts; end: Facts }> {
  const m = await createSimMachine(withFiles(setup));
  const start = await m.facts();
  let out = '';
  for (const line of lines) out = stripAnsi((await m.exec(line)).out);
  const end = await m.facts();
  return { pass: evaluateCheck(check, end, start).pass, out, start, end };
}

const lesson = (id: string) => registry.lessons.get(id)!;
const terminalTask = (lessonId: string, sectionId: string, taskId: string) => {
  const s = lesson(lessonId).sections.find((x) => x.id === sectionId) as Section & { kind: 'terminal' };
  return { setup: s.setup, check: s.tasks.find((t) => t.id === taskId)!.check };
};

describe('kube-lite: NetworkPolicy egress', () => {
  it('a default-deny egress without the DNS rule breaks names, with it pay answers and dev/web does not', async () => {
    const setup = terminalTask('k8s-1.netpol', 'lab', 'egress').setup;
    const m = await createSimMachine(withFiles(setup));
    expect(stripAnsi((await m.exec('kubectl -n shop exec client -- curl -s http://pay.pay')).out)).toMatch(/Hello from pay-/);
    await m.exec('kubectl apply -f egress-nodns.yaml');
    expect(stripAnsi((await m.exec('kubectl -n shop exec client -- curl http://pay.pay')).out)).toMatch(/Could not resolve host: pay\.pay/);
    expect(stripAnsi((await m.exec('kubectl -n shop exec client -- nslookup pay.pay')).out)).toMatch(/timed out/);
    await m.exec('kubectl apply -f egress.yaml');
    expect(stripAnsi((await m.exec('kubectl -n shop exec client -- curl -s http://pay.pay')).out)).toMatch(/Hello from pay-/);
    expect(stripAnsi((await m.exec('kubectl -n shop exec client -- curl -m 2 http://web.dev')).out)).toMatch(/curl: \(28\)/);
    expect(stripAnsi((await m.exec('kubectl -n shop exec client -- curl http://example.com')).out)).toMatch(/curl: \(28\)/);
    expect(stripAnsi((await m.exec('kubectl -n dev exec client -- curl -s http://web.dev')).out)).toMatch(/Hello from web-/);
  });
});

/** Reference solutions: lesson/section/task → command lines. */
const LAB_SOLUTIONS: Record<string, string[]> = {
  'k8s-1.netpol/lab/deny': ['kubectl apply -f deny.yaml', 'cluster ff 2s'],
  'k8s-1.netpol/lab/frontend': ['kubectl apply -f deny.yaml', 'kubectl apply -f and.yaml', 'cluster ff 2s'],
  'k8s-1.netpol/lab/egress': ['kubectl apply -f egress.yaml', 'cluster ff 2s'],
  'k8s-1.dns/broken/fix': ['kubectl -n kube-system scale deployment coredns --replicas=1', 'cluster ff 30s'],
};

describe('new lab reference solutions pass, and the checks are false at the start', () => {
  for (const [key, lines] of Object.entries(LAB_SOLUTIONS)) {
    it(key, async () => {
      const [l, s, t] = key.split('/');
      const { setup, check } = terminalTask(l, s, t);
      const r = await solve(setup, lines, check);
      expect(evaluateCheck(check, r.start, r.start).pass, `${key} at the start`).toBe(false);
      expect(r.pass, `${key}\n${r.out}`).toBe(true);
    });
  }
  it('the OR form of the frontend policy is rejected with its own explanation', async () => {
    const { setup, check } = terminalTask('k8s-1.netpol', 'lab', 'frontend');
    const r = await solve(setup, ['kubectl apply -f deny.yaml', 'kubectl apply -f or.yaml', 'cluster ff 2s'], check);
    const res = evaluateCheck(check, r.end, r.start);
    expect(res.pass).toBe(false);
    expect(res.say?.en).toMatch(/OR/);
  });
  it('an egress policy without DNS is explained', async () => {
    const { setup, check } = terminalTask('k8s-1.netpol', 'lab', 'egress');
    const r = await solve(setup, ['kubectl apply -f egress-nodns.yaml', 'cluster ff 2s'], check);
    const res = evaluateCheck(check, r.end, r.start);
    expect(res.pass).toBe(false);
    expect(res.say?.en).toMatch(/DNS rule/);
  });
});

const EXAM_SOLUTIONS: Record<string, string[]> = {
  deploy: ['kubectl -n store create deployment catalog --image=trainer/web:1.1 --replicas=3', 'kubectl -n store expose deployment catalog --port=80', 'cluster ff 30s'],
  'svc-selector': ['kubectl -n prod patch svc api -p \'{"spec":{"selector":{"app":"api-v2"}}}\'', 'cluster ff 3s'],
  'svc-port': ['kubectl -n prod patch svc api -p \'{"spec":{"ports":[{"port":80,"targetPort":80}]}}\'', 'cluster ff 3s'],
  rollback: ['kubectl rollout undo deployment/web', 'cluster ff 90s'],
  drain: ['kubectl drain worker-2 --ignore-daemonsets --force', 'cluster ff 60s'],
  dns: ['kubectl -n kube-system scale deployment coredns --replicas=1', 'cluster ff 30s'],
  pending: ['kubectl -n exam delete pod report', 'kubectl -n exam run report --image=trainer/web:1.0', 'cluster ff 30s'],
  config: ['kubectl create configmap web-config --from-literal=GREETING=Hello', 'kubectl patch deployment web -p \'{"spec":{"template":{"spec":{"containers":[{"name":"web","envFrom":[{"configMapRef":{"name":"web-config"}}]}]}}}}\'', 'cluster ff 60s'],
  netpol: ['kubectl apply -f ns.yaml', 'cluster ff 2s'],
  grace: ['kubectl patch deployment web -p \'{"spec":{"template":{"spec":{"terminationGracePeriodSeconds":5}}}}\'', 'cluster ff 30s'],
};

describe('the stage-1 exam', () => {
  const exam = registry.exams.get('k8s-1.exam')!;
  it('is wired to the block and has DL5 tasks with solution tokens', () => {
    expect(registry.blocks.get('k8s-1')!.exam).toBe('k8s-1.exam');
    expect(exam.tasks.length).toBeGreaterThanOrEqual(9);
    const dl5 = exam.tasks.filter((t) => t.kind === 'task' && t.task.docStep === 5);
    expect(dl5.length).toBeGreaterThanOrEqual(2);
    for (const t of dl5) if (t.kind === 'task') expect(t.task.solutionTokens?.length).toBeGreaterThan(0);
    expect(exam.allowedDocs).toContain('kubectl-explain');
  });
  for (const t of registry.exams.get('k8s-1.exam')!.tasks) {
    it(`task ${t.id} is solvable and not true at the start`, async () => {
      expect(t.kind).toBe('task');
      if (t.kind !== 'task') return;
      const lines = EXAM_SOLUTIONS[t.id];
      expect(lines, `no reference solution for ${t.id}`).toBeTruthy();
      const r = await solve(t.setup, lines, t.task.check);
      expect(evaluateCheck(t.task.check, r.start, r.start).pass, `${t.id} at the start`).toBe(false);
      expect(r.pass, `${t.id}\n${r.out}`).toBe(true);
    });
  }
  it('the selector task does not accept recreated pods', async () => {
    const t = exam.tasks.find((x) => x.id === 'svc-selector')!;
    if (t.kind !== 'task') throw new Error('task');
    const r = await solve(t.setup, ['kubectl -n prod patch svc api -p \'{"spec":{"selector":{"app":"api-v2"}}}\'', 'kubectl -n prod delete pods -l app=api-v2', 'cluster ff 30s'], t.task.check);
    expect(r.pass).toBe(false);
  });
});

const PLACEMENT_SOLUTIONS: Record<string, string[]> = {
  'k8s.place.i3': ['kubectl -n shop create deployment web --image=trainer/web:1.0 --replicas=3', 'kubectl -n shop expose deployment web --port=80', 'cluster ff 30s'],
  'k8s.place.i4': ['kubectl apply -f web.yaml', 'cluster ff 20s', 'kubectl set image deployment/web web=trainer/web:1.1', 'kubectl rollout status deployment/web', 'cluster ff 30s'],
  'k8s.place.i4b': ['kubectl rollout undo deployment/web', 'cluster ff 90s'],
  'k8s.place.e2': ['kubectl -n prod patch svc api -p \'{"spec":{"selector":{"app":"api-v2"}}}\'', 'cluster ff 3s'],
  'k8s.place.e2b': ['kubectl -n shop patch svc web -p \'{"spec":{"ports":[{"port":80,"targetPort":80}]}}\'', 'kubectl -n shop label pod client role=frontend', 'cluster ff 3s'],
  'k8s.place.e4': ['kubectl drain worker-2 --ignore-daemonsets --force', 'cluster ff 60s'],
  'k8s.place.e5': ['kubectl apply -f deny.yaml', 'kubectl apply -f and.yaml', 'cluster ff 2s'],
};

describe('placement', () => {
  const b1 = registry.blocks.get('k8s-1')!;
  const b2 = registry.blocks.get('k8s-2')!;
  it('covers all three levels in stage 1 and two in stage 2, with key tasks', () => {
    for (const lv of ['beginner', 'intermediate', 'experienced'] as const) expect(b1.placement.some((p) => p.level === lv && p.key), lv).toBe(true);
    expect(b1.placement.length).toBeGreaterThanOrEqual(15);
    expect(b2.placement.length).toBeGreaterThanOrEqual(8);
    expect(new Set([...b1.placement, ...b2.placement].map((p) => (p.kind === 'quiz' ? p.item.id : p.id))).size).toBe(b1.placement.length + b2.placement.length);
  });
  for (const p of registry.blocks.get('k8s-1')!.placement) {
    if (p.kind !== 'task') continue;
    it(`${p.id} is solvable and not true at the start`, async () => {
      const lines = PLACEMENT_SOLUTIONS[p.id];
      expect(lines, `no reference solution for ${p.id}`).toBeTruthy();
      const r = await solve(p.setup, lines, p.task.check);
      expect(evaluateCheck(p.task.check, r.start, r.start).pass).toBe(false);
      expect(r.pass, `${p.id}\n${r.out}`).toBe(true);
    });
  }
});

describe('the new explainers compute what the lessons say', () => {
  it('NetworkPolicy: AND, OR, typo, port, flannel, egress', () => {
    const p = { policy: 'and', egress: false, dns: false, cni: 'kube-router' };
    const ok = (f: ReturnType<typeof netpolFlows>) => f.filter((x) => x.allowed && x.id !== 'net').map((x) => x.id);
    expect(ok(netpolFlows(p))).toEqual(['fe']);
    expect(ok(netpolFlows({ ...p, policy: 'or' }))).toEqual(['fe', 'cl']);
    expect(ok(netpolFlows({ ...p, policy: 'deny' }))).toEqual([]);
    expect(ok(netpolFlows({ ...p, policy: 'none' }))).toEqual(['fe', 'cl', 'dbg']);
    expect(ok(netpolFlows(p, new Set(['typo'])))).toEqual([]);
    expect(ok(netpolFlows(p, new Set(['port'])))).toEqual([]);
    expect(ok(netpolFlows({ ...p, policy: 'deny', cni: 'flannel' }))).toEqual(['fe', 'cl', 'dbg']);
    const e = netpolFlows({ ...p, egress: true });
    expect(e.find((x) => x.id === 'fe')!.at).toBe('dns');
    expect(e.find((x) => x.id === 'net')!.allowed).toBe(false);
    expect(netpolFlows({ ...p, egress: true, dns: true }).find((x) => x.id === 'fe')!.allowed).toBe(true);
  });
  it('the chain of loops stops at the stopped loop', () => {
    expect(loopWave({ replicas: 5, action: 'scale', workers: 2 }).fired).toEqual(['deploy', 'rs', 'sched', 'kubelet', 'status']);
    expect(loopWave({ replicas: 5, action: 'scale', workers: 2 }, new Set(['sched'])).stop).toBe('sched');
    expect(loopWave({ replicas: 5, action: 'scale', workers: 2 }, new Set(['cm'])).fired).toEqual([]);
    expect(loopWave({ replicas: 2, action: 'scale', workers: 2 }).created).toBe(0);
    expect(loopWave({ replicas: 3, action: 'image', workers: 2 }).newRs).toBe(true);
  });
  it('certificates, tokens, restore and skew', () => {
    expect(certState(0, false).leafLeftDays).toBe(365);
    expect(certState(12, false).expired).toBe(true);
    expect(certState(24, true).expired).toBe(false);
    expect(tokenValid(1, 24)).toBe(true);
    expect(tokenValid(48, 24)).toBe(false);
    expect(tokenValid(48, 0)).toBe(true);
    expect(restoreOutcome({ after: 20, tool: 'etcdutl', stopApi: true }).lost).toBe(20);
    expect(restoreOutcome({ after: 20, tool: 'etcdctl', stopApi: true }).ok).toBe(false);
    expect(skewProblems(36, 37, 36, 37)).toContain('the kubelet must not be newer than kube-apiserver');
    expect(skewProblems(37, 37, 36, 37)).toEqual([]);
    expect(skewProblems(38, 38, 36, 38)[0]).toMatch(/1 minor version/);
  });
});

/** The signs of each output self-check, against output as the real tools print it. */
const REAL_OUTPUT: Record<string, { good: string; bad: string }> = {
  'k8s-2.prepare/selfcheck': {
    good: 'overlay               212992  0\nbr_netfilter           32768  0\nnet.ipv4.ip_forward = 1\nnet.bridge.bridge-nf-call-iptables = 1\n            SystemdCgroup = true\nv1.36.3\nkubeadm\nkubectl\nkubelet\n',
    bad: 'NAME      TYPE SIZE USED PRIO\n/swap.img file   4G   0B   -2\nnet.ipv4.ip_forward = 0\n            SystemdCgroup = false\nv1.37.1\n',
  },
  'k8s-2.kubeadm/check-init': {
    good: 'etcd.yaml\nkube-apiserver.yaml\nkube-controller-manager.yaml\nkube-scheduler.yaml\n[check-expiration] Reading configuration from the "kubeadm-config" ConfigMap in namespace "kube-system"...\n\nCERTIFICATE                EXPIRES                  RESIDUAL TIME   CERTIFICATE AUTHORITY   EXTERNALLY MANAGED\nadmin.conf                 Nov 18, 2027 09:12 UTC   364d            ca                      no\napiserver                  Nov 18, 2027 09:12 UTC   364d            ca                      no\n\nCERTIFICATE AUTHORITY   EXPIRES                  RESIDUAL TIME   EXTERNALLY MANAGED\nca                      Nov 16, 2036 09:12 UTC   9y              no\netcd-ca                 Nov 16, 2036 09:12 UTC   9y              no\n',
    bad: 'ls: cannot access \'/etc/kubernetes/manifests\': No such file or directory\n',
  },
  'k8s-2.kubeadm/check-join': {
    good: 'total 12\n-rw------- 1 root root 2826 Nov 18 09:20 kubelet-client-2026-11-18-09-20-11.pem\nlrwxrwxrwx 1 root root   59 Nov 18 09:20 kubelet-client-current.pem -> /var/lib/kubelet/pki/kubelet-client-2026-11-18-09-20-11.pem\n-rw-r--r-- 1 root root 2258 Nov 18 09:20 kubelet.crt\n-rw------- 1 root root 1675 Nov 18 09:20 kubelet.key\nkubelet.conf\nmanifests\npki\n',
    bad: 'total 8\n-rw-r--r-- 1 root root 2258 Nov 18 09:20 kubelet.crt\nbootstrap-kubelet.conf\nmanifests\npki\n',
  },
  'k8s-2.cni/status': {
    good: '    /¯¯\\\n /¯¯\\__/¯¯\\    Cilium:             OK\n \\__/¯¯\\__/    Operator:           OK\n /¯¯\\__/¯¯\\    Envoy DaemonSet:    OK\n\nDaemonSet              cilium                   Desired: 3, Ready: 3/3, Available: 3/3\nDeployment             cilium-operator          Desired: 1, Ready: 1/1, Available: 1/1\nCluster Pods:          5/5 managed by Cilium\n',
    bad: '    /¯¯\\\n /¯¯\\__/¯¯\\    Cilium:             1 errors\n \\__/¯¯\\__/    Operator:           OK\nDaemonSet              cilium                   Desired: 3, Ready: 2/3, Available: 2/3\nCluster Pods:          3/5 managed by Cilium\n',
  },
  'k8s-2.etcd/status': {
    good: '+----------+----------+------------+------------+---------+\n|   HASH   | REVISION | TOTAL KEYS | TOTAL SIZE | VERSION |\n+----------+----------+------------+------------+---------+\n| 2c3c0d5a |    18342 |        912 |     5.1 MB |   3.6.0 |\n+----------+----------+------------+------------+---------+\n',
    bad: 'Error: stat /opt/backup/etcd.db: no such file or directory\n',
  },
  'k8s-2.repair/empty': { good: '[]\n', bad: '[\n  {\n    "id": 4211,\n    "name": "cp-1"\n  }\n]\n' },
};

describe('output self-checks match what the real tools print', () => {
  for (const [key, out] of Object.entries(REAL_OUTPUT)) {
    it(key, () => {
      const [l, s] = key.split('/');
      const sec = lesson(l).sections.find((x) => x.id === s) as Section & { kind: 'widget' };
      expect(sec.widget).toBe('k8s.output-check');
      const signs = (sec.props as { signs: OutputSign[] }).signs;
      expect(matchSigns(out.good, signs).filter((x) => !x.pass).map((x) => x.id)).toEqual([]);
      expect(matchSigns(out.bad, signs).some((x) => !x.pass)).toBe(true);
    });
  }
});

describe('trainer-check facts judge the kubeadm lessons', () => {
  const node = (name: string, version: string, extra: Record<string, unknown> = {}) => ({ kind: 'Node', metadata: { name, labels: name === 'cp-1' ? { 'node-role.kubernetes.io/control-plane': '' } : {} }, spec: { podCIDR: `10.244.${name === 'cp-1' ? 0 : name.slice(-1)}.0/24`, ...extra }, status: { conditions: [{ type: 'Ready', status: 'True' }], nodeInfo: { kubeletVersion: version, kernelVersion: '6.8.0-88-generic' } } });
  const pod = (ns: string, name: string, image: string, nodeName: string, ip = '') => ({ kind: 'Pod', metadata: { name, namespace: ns, uid: name, labels: {} }, spec: { nodeName, containers: [{ name: 'c', image }] }, status: { phase: 'Running', podIP: ip, conditions: [{ type: 'Ready', status: 'True' }] } });
  const blob = (version: string): CheckBlob => ({
    schema: 'dt.k8s-check/v1',
    nonce: 'n',
    resources: {
      nodes: { items: [node('cp-1', version), node('worker-1', version), node('worker-2', version)] },
      namespaces: { items: [{ kind: 'Namespace', metadata: { name: 'before-backup' } }] },
      pods: { items: [pod('kube-system', 'kube-apiserver-cp-1', `registry.k8s.io/kube-apiserver:${version}`, 'cp-1'), pod('kube-system', 'etcd-cp-1', 'registry.k8s.io/etcd:3.6.5-0', 'cp-1'), pod('kube-system', 'coredns-7c65d6cfc9-abcde', 'registry.k8s.io/coredns/coredns:v1.12.1', 'worker-1'), pod('default', 'web-1', 'nginx:1.29', 'worker-1', '10.244.1.5'), pod('default', 'web-2', 'nginx:1.29', 'worker-2', '10.244.2.5'), pod('default', 'web-3', 'nginx:1.29', 'worker-1', '10.244.1.6')] },
      deployments: { items: [{ kind: 'Deployment', metadata: { name: 'web', namespace: 'default' }, spec: { replicas: 3, template: { spec: { containers: [{ image: 'nginx:1.29' }] } } }, status: { readyReplicas: 3, availableReplicas: 3, updatedReplicas: 3 } }] },
      daemonsets: { items: [{ kind: 'DaemonSet', metadata: { name: 'cilium', namespace: 'kube-system' }, status: { numberReady: 3 } }] },
      configmaps: { items: [{ kind: 'ConfigMap', metadata: { name: 'kubeadm-config', namespace: 'kube-system' }, data: { ClusterConfiguration: `apiVersion: kubeadm.k8s.io/v1beta4\nkind: ClusterConfiguration\nkubernetesVersion: ${version}\nnetworking:\n  podSubnet: 10.244.0.0/16\n  serviceSubnet: 10.96.0.0/12\n` } }] },
    },
  });
  const checksOf = (l: string) => ((lesson(l).sections.find((s) => s.id === 'real') as Section & { kind: 'widget' }).props as { checks: { id: string; when: string }[] }).checks;
  const failing = (l: string, b: CheckBlob) => checksOf(l).filter((c) => !evaluateCheck({ when: c.when }, blobFacts(b)).pass).map((c) => c.id);

  it('kubeadm, cni and etcd pass on a healthy 1.36 cluster', () => {
    expect(failing('k8s-2.kubeadm', blob('v1.36.4'))).toEqual([]);
    expect(failing('k8s-2.cni', blob('v1.36.4'))).toEqual([]);
    expect(failing('k8s-2.etcd', blob('v1.36.4'))).toEqual([]);
  });
  it('the upgrade check fails on 1.36 and passes on 1.37', () => {
    expect(failing('k8s-2.upgrade', blob('v1.36.4'))).toEqual(expect.arrayContaining(['cfg', 'api', 'nodes']));
    expect(failing('k8s-2.upgrade', blob('v1.37.1'))).toEqual([]);
  });
  it('a namespace created after the snapshot fails the restore check', () => {
    const b = blob('v1.36.4');
    b.resources.namespaces!.items!.push({ kind: 'Namespace', metadata: { name: 'after-backup' } });
    expect(failing('k8s-2.etcd', b)).toEqual(['after']);
  });
});

describe('stage 2 is a block of its own', () => {
  it('has the six kubeadm lessons after the k3s node, each with quizzes and sources', () => {
    const b = registry.blocks.get('k8s-2')!;
    expect(b.lessons).toEqual(['k8s-2.single-node', 'k8s-2.prepare', 'k8s-2.kubeadm', 'k8s-2.cni', 'k8s-2.etcd', 'k8s-2.upgrade', 'k8s-2.repair']);
    for (const id of b.lessons) {
      const l = lesson(id);
      expect(l.sections.some((s) => s.kind === 'quiz'), id).toBe(true);
      expect(l.sources.en.length && l.sources.ru.length, id).toBeTruthy();
    }
    const explainers = [...registry.explainers.values()].filter((e) => e.block === 'k8s-2').map((e) => e.id);
    expect(explainers).toEqual(expect.arrayContaining(['k8s.kubeadm-init', 'k8s.tls-bootstrap', 'k8s.etcd-restore', 'k8s.upgrade']));
  });
});
