// The new Kubernetes exams: the CKA-style practical of stage 1 on kube-lite,
// the CI deployment exam of block 6a, and the real-VM exam of stage 2 judged
// on trainer-check.sh facts. Every simulator task is false at the start and
// passes after a reference solution; the real-VM checks hold on the facts of
// a finished cluster and fail on the facts of an unfinished one.

import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { registry } from '../src/core/registry';
import type { Check, ExamTask, Facts, TerminalSetup } from '../src/core/types';
import { createSimMachine, stripAnsi } from '../src/engine/terminal/shell';

async function solve(setup: TerminalSetup, lines: string[], check: Check): Promise<{ pass: boolean; out: string; start: Facts; end: Facts }> {
  const m = await createSimMachine(setup);
  const start = await m.facts();
  let out = '';
  for (const line of lines) out += `$ ${line}\n${stripAnsi((await m.exec(line)).out)}`;
  const end = await m.facts();
  return { pass: evaluateCheck(check, end, start).pass, out, start, end };
}

const CKA: Record<string, string[]> = {
  deploy: [
    'kubectl create namespace billing',
    'kubectl -n billing create deployment invoice --image=trainer/web:1.1 --replicas=3 --port=80',
    "kubectl -n billing patch deployment invoice -p '{\"spec\":{\"template\":{\"metadata\":{\"labels\":{\"tier\":\"backend\"}}}}}'",
    'cluster ff 60s',
  ],
  nodeport: ['kubectl expose deployment web --name=web-public --type=NodePort --port=80', "kubectl patch svc web-public -p '{\"spec\":{\"ports\":[{\"port\":80,\"nodePort\":30080}]}}'", 'cluster ff 5s'],
  rolling: ["kubectl patch deployment web -p '{\"spec\":{\"strategy\":{\"rollingUpdate\":{\"maxUnavailable\":0,\"maxSurge\":1}}}}'", 'kubectl set image deployment/web web=trainer/web:1.1', 'cluster ff 120s'],
  undo: ['kubectl rollout history deployment/web', 'kubectl rollout undo deployment/web --to-revision=1', 'cluster ff 120s'],
  nodeselector: [
    'kubectl label node worker-1 disk=ssd',
    'kubectl run fast --image=trainer/web:1.0 --dry-run=client -o yaml > fast.yaml',
    "sed -i 's/^spec:$/spec:\\n  nodeSelector:\\n    disk: ssd/' fast.yaml",
    'kubectl apply -f fast.yaml',
    'cluster ff 30s',
  ],
  daemonset: [
    'cat > ds.yaml <<\'EOF\'\napiVersion: apps/v1\nkind: DaemonSet\nmetadata:\n  name: node-agent\n  namespace: kube-system\nspec:\n  selector:\n    matchLabels:\n      app: node-agent\n  template:\n    metadata:\n      labels:\n        app: node-agent\n    spec:\n      tolerations:\n      - key: node-role.kubernetes.io/control-plane\n        operator: Exists\n        effect: NoSchedule\n      containers:\n      - name: agent\n        image: trainer/client:1.0\n        command: ["sleep", "infinity"]\nEOF',
    'kubectl apply -f ds.yaml',
    'cluster ff 30s',
  ],
  secret: [
    'kubectl create secret generic db-cred --from-literal=password=s3cr3t',
    'kubectl patch deployment api -p \'{"spec":{"template":{"spec":{"containers":[{"name":"api","env":[{"name":"DB_PASSWORD","valueFrom":{"secretKeyRef":{"name":"db-cred","key":"password"}}}]}]}}}}\'',
    'cluster ff 60s',
  ],
  limits: ['kubectl describe pod -l app=cache', 'kubectl patch deployment cache -p \'{"spec":{"template":{"spec":{"containers":[{"name":"cache","resources":{"limits":{"memory":"512Mi"}}}]}}}}\'', 'cluster ff 60s'],
  job: [
    'cat > job.yaml <<\'EOF\'\napiVersion: batch/v1\nkind: Job\nmetadata:\n  name: report\nspec:\n  completions: 3\n  parallelism: 1\n  template:\n    spec:\n      restartPolicy: Never\n      containers:\n      - name: report\n        image: trainer/job:1.0\n        env:\n        - name: DURATION\n          value: "5"\nEOF',
    'kubectl apply -f job.yaml',
    'cluster ff 60s',
  ],
  'probe-path': ['kubectl -n shop describe pod -l app=shop', 'kubectl -n shop patch deployment shop -p \'{"spec":{"template":{"spec":{"containers":[{"name":"shop","readinessProbe":{"httpGet":{"path":"/ready","port":80}}}]}}}}\'', 'cluster ff 90s'],
  'probe-port': ['kubectl -n shop describe pod -l app=shop', 'kubectl -n shop patch deployment shop -p \'{"spec":{"template":{"spec":{"containers":[{"name":"shop","readinessProbe":{"httpGet":{"path":"/ready","port":80}}}]}}}}\'', 'cluster ff 90s'],
  image: ['kubectl -n orders get pods', 'kubectl -n orders set image deployment/orders-api orders-api=trainer/web:1.1', 'cluster ff 60s'],
  ingress: [
    'cat > ing.yaml <<\'EOF\'\napiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: shop\nspec:\n  rules:\n  - host: shop.example.com\n    http:\n      paths:\n      - path: /\n        pathType: Prefix\n        backend:\n          service:\n            name: web\n            port:\n              number: 80\nEOF',
    'kubectl apply -f ing.yaml',
    'cluster ff 2s',
  ],
  startup: ['kubectl patch deployment catalog -p \'{"spec":{"template":{"spec":{"containers":[{"name":"catalog","startupProbe":{"httpGet":{"path":"/healthz","port":80},"periodSeconds":5,"failureThreshold":20}}]}}}}\'', 'cluster ff 180s'],
  affinity: [
    'cat > batch.yaml <<\'EOF\'\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: batch\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: batch\n  template:\n    metadata:\n      labels:\n        app: batch\n    spec:\n      affinity:\n        nodeAffinity:\n          requiredDuringSchedulingIgnoredDuringExecution:\n            nodeSelectorTerms:\n            - matchExpressions:\n              - key: kubernetes.io/hostname\n                operator: NotIn\n                values: ["worker-2"]\n      containers:\n      - name: batch\n        image: trainer/web:1.0\nEOF',
    'kubectl apply -f batch.yaml',
    'cluster ff 30s',
  ],
  deadline: ["sed -i 's/^spec:$/spec:\\n  activeDeadlineSeconds: 60/' import.yaml", 'cat import.yaml', 'kubectl apply -f import.yaml', 'cluster ff 90s'],
  history: ["kubectl patch deployment web -p '{\"spec\":{\"revisionHistoryLimit\":2}}'", 'cluster ff 10s'],
};

describe('the CKA-style exam of stage 1', () => {
  const exam = registry.exams.get('k8s-1.exam.cka')!;
  it('has the CKA shape: sixteen tasks per variant, 120 minutes, 66%, a quarter beyond the course', () => {
    expect(exam.block).toBe('k8s-1');
    expect(exam.minutes).toBe(120);
    expect(exam.pass).toBe(0.66);
    const variant = exam.tasks.filter((t) => t.pool !== 'probe' || t.id === 'probe-path');
    expect(variant.length).toBe(16);
    const total = variant.reduce((s, t) => s + t.weight, 0);
    const beyond = variant.filter((t) => t.beyond).reduce((s, t) => s + t.weight, 0);
    expect(beyond / total).toBeGreaterThanOrEqual(0.2);
    expect(beyond / total).toBeLessThanOrEqual(0.3);
    for (const t of variant.filter((x) => x.beyond)) if (t.kind === 'task') expect(t.task.docStep).toBe(5);
  });
  for (const t of registry.exams.get('k8s-1.exam.cka')!.tasks as (ExamTask & { kind: 'task' })[]) {
    it(`task ${t.id} is false at the start and passes after a reference solution`, async () => {
      const lines = CKA[t.id];
      expect(lines, `no reference solution for ${t.id}`).toBeTruthy();
      const r = await solve(t.setup, lines, t.task.check);
      expect(evaluateCheck(t.task.check, r.start, r.start).pass, `${t.id} at the start`).toBe(false);
      expect(r.pass, `${t.id}\n${r.out}`).toBe(true);
    }, 30_000);
  }
});

// ── block 6a: deploying to Kubernetes from CI ──

import type { SimMachine } from '../src/engine/terminal/shell';
import { A7_GOOD_CI } from '../src/blocks/git-cicd/content/cicd-k8s';
import { TAG_ONLY_CI } from '../src/blocks/kubernetes/exam-cicd';

const SITE = '/home/learner/site';
const write = (m: SimMachine, path: string, text: string) => {
  m.rootFs.writeFile(path, text);
  m.rootFs.chown(path, 1000, 1000);
};
const sh = async (m: SimMachine, ...lines: string[]) => {
  let out = '';
  for (const l of lines) out += `$ ${l}\n${stripAnsi((await m.exec(l)).out)}`;
  return out;
};
const GOOD_TAGS = A7_GOOD_CI;
const WITH_WAIT = TAG_ONLY_CI.replace('web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA\n', 'web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA\n    - kubectl rollout status deployment/web --timeout=120s\n').replace('stages: [build, deploy]', 'stages: [build, deploy, rollback]') +
  '\nrollback_staging:\n  stage: rollback\n  image: bitnami/kubectl:1.34\n  when: on_failure\n  script:\n    - kubectl rollout undo deployment/web\n  rules:\n    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\n      when: on_failure\n';
const PRODUCTION_CI = A7_GOOD_CI.replace('stages: [build, deploy, rollback]', 'stages: [build, deploy, rollback, production]') +
  '\ndeploy_production:\n  stage: production\n  image: bitnami/kubectl:1.34\n  environment: production\n  needs: [deploy_staging]\n  script:\n    - kubectl -n production set image deployment/web web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA\n    - kubectl -n production rollout status deployment/web --timeout=120s\n  rules:\n    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\n      when: manual\n';
const CAUSE_CI = A7_GOOD_CI.replace('    - kubectl set image deployment/web', '    - kubectl annotate deployment/web kubernetes.io/change-cause="commit $CI_COMMIT_SHORT_SHA" --overwrite\n    - kubectl set image deployment/web');

type Step = string | { write: string; text: string };
const CICD: Record<string, Step[]> = {
  'key-missing': ['git commit --allow-empty -m deploy', 'git push', 'glab variable set KUBECONFIG --type file --protected < ~/deployer.kubeconfig', 'git commit --allow-empty -m again', 'git push'],
  'key-plain': ['git commit --allow-empty -m deploy', 'git push', 'glab ci trace deploy_staging', 'glab variable set KUBECONFIG --type file --protected < ~/deployer.kubeconfig', 'git commit --allow-empty -m again', 'git push'],
  tag: [{ write: `${SITE}/.gitlab-ci.yml`, text: GOOD_TAGS }, 'git commit -am "Deploy the commit tag"', 'git push'],
  gate: [{ write: `${SITE}/.gitlab-ci.yml`, text: WITH_WAIT }, 'git commit -am "Wait and roll back"', 'git push', { write: `${SITE}/Dockerfile`, text: 'FROM trainer/web:2.0\nCOPY src/ /usr/share/web/\n' }, 'git commit -am "Move to web 2.0"', 'git push'],
  production: [{ write: `${SITE}/.gitlab-ci.yml`, text: PRODUCTION_CI }, 'git commit -am "Production by a button"', 'git push', 'glab ci status', 'glab ci trigger deploy_production'],
  cause: [{ write: `${SITE}/.gitlab-ci.yml`, text: CAUSE_CI }, 'git commit -am "Record the cause"', 'git push', 'kubectl -n staging rollout history deployment/web'],
};

async function runSteps(setup: TerminalSetup, steps: Step[]): Promise<{ m: SimMachine; start: Facts; out: string }> {
  const m = await createSimMachine(setup);
  const start = await m.facts();
  let out = '';
  for (const s of steps) {
    if (typeof s === 'string') out += await sh(m, s);
    else write(m, s.write, s.text);
  }
  return { m, start, out };
}

describe('the exam of block 6a', () => {
  const exam = registry.exams.get('cicd-k8s.exam')!;
  it('belongs to the block and reaches its page', () => {
    expect(exam.block).toBe('cicd-k8s');
    expect(registry.blocks.has('cicd-k8s')).toBe(true);
    expect(exam.tasks.filter((t) => t.pool === 'key').length).toBe(2);
    expect(exam.tasks.some((t) => t.kind === 'task' && t.task.docStep === 5 && t.beyond)).toBe(true);
  });
  for (const t of registry.exams.get('cicd-k8s.exam')!.tasks as (ExamTask & { kind: 'task' })[]) {
    it(`task ${t.id} is false at the start and passes after a reference solution`, async () => {
      const steps = CICD[t.id];
      expect(steps, `no reference solution for ${t.id}`).toBeTruthy();
      const r = await runSteps(t.setup, steps);
      expect(evaluateCheck(t.task.check, r.start, r.start).pass, `${t.id} at the start`).toBe(false);
      const res = evaluateCheck(t.task.check, await r.m.facts(), r.start);
      expect(res.pass, `${t.id}\n${r.out}`).toBe(true);
    }, 60_000);
  }
  it('production updated by itself is not accepted', async () => {
    const t = exam.tasks.find((x) => x.id === 'production') as ExamTask & { kind: 'task' };
    const r = await runSteps(t.setup, [{ write: `${SITE}/.gitlab-ci.yml`, text: PRODUCTION_CI.replace('      when: manual\n', '') }, 'git commit -am "Auto production"', 'git push']);
    const res = evaluateCheck(t.task.check, await r.m.facts(), r.start);
    expect(res.pass).toBe(false);
    expect(res.say?.en).toMatch(/by itself/);
  }, 60_000);
});

// ── stage 2: the kubeadm cluster on the learner's own VMs ──

import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { decodeHostBlob, hostFacts, hostProblems, judgeReal } from '../src/app/real/facts';
import { cluster, etcdDataDir, snapshot, stage2Exam } from '../src/blocks/kubernetes/exam-real';
import type { RealTask } from '../src/core/types';

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString().replace(/\.\d+Z$/, 'Z');
const MIN = 60_000;

interface ClusterState {
  version: string;
  cordoned?: string;
  notReady?: string;
  restoredDir: string;
  kubeadmDataDir: string;
  exam: { before: boolean; after: boolean };
  breakCase?: string;
  cron?: boolean;
  schedulerDown?: boolean;
}

const node = (name: string, s: ClusterState) => ({
  kind: 'Node',
  metadata: { name, labels: { 'kubernetes.io/hostname': name, ...(name === 'cp-1' ? { 'node-role.kubernetes.io/control-plane': '' } : {}) } },
  spec: { podCIDR: `10.244.${name === 'cp-1' ? 0 : name === 'worker-1' ? 1 : 2}.0/24`, ...(s.cordoned === name ? { unschedulable: true } : {}) },
  status: {
    conditions: [{ type: 'Ready', status: s.notReady === name ? 'Unknown' : 'True', lastTransitionTime: name === 'worker-2' ? iso(5 * MIN) : iso(300 * MIN) }],
    nodeInfo: { kubeletVersion: s.version, kernelVersion: '6.8.0-88-generic', osImage: 'Ubuntu 24.04.3 LTS', containerRuntimeVersion: 'containerd://1.7.28' },
  },
});
const mirrorPod = (component: string, s: ClusterState) => ({
  kind: 'Pod',
  metadata: { name: `${component}-cp-1`, namespace: 'kube-system', uid: component, ownerReferences: [{ kind: 'Node', name: 'cp-1' }], labels: { component } },
  spec: { nodeName: 'cp-1', containers: [{ name: component, image: `registry.k8s.io/${component}:${s.version}` }] },
  status: { phase: 'Running', conditions: [{ type: 'Ready', status: component === 'kube-scheduler' && s.schedulerDown ? 'False' : 'True' }], containerStatuses: [{ name: component, restartCount: 0, state: { running: { startedAt: iso(10 * MIN) } } }] },
});
const pod = (ns: string, name: string, nodeName: string, labels: Record<string, string>, phase = 'Running') => ({
  kind: 'Pod',
  metadata: { name, namespace: ns, uid: name, labels },
  spec: { nodeName, containers: [{ name: 'c', image: 'x' }] },
  status: { phase, conditions: [{ type: 'Ready', status: phase === 'Running' ? 'True' : 'False' }] },
});

function fixture(s: ClusterState): Record<string, unknown> {
  const items = (xs: unknown[]) => ({ kind: 'List', items: xs });
  const nodes = ['cp-1', 'worker-1', 'worker-2'].map((n) => node(n, s));
  return {
    nodes: items(nodes),
    namespaces: items([{ kind: 'Namespace', metadata: { name: 'default', creationTimestamp: iso(600 * MIN) } }, ...(s.exam.before ? [{ kind: 'Namespace', metadata: { name: 'exam-before', creationTimestamp: iso(120 * MIN) } }] : []), ...(s.exam.after ? [{ kind: 'Namespace', metadata: { name: 'exam-after', creationTimestamp: iso(30 * MIN) } }] : [])]),
    pods: items([
      ...['etcd', 'kube-apiserver', 'kube-controller-manager', 'kube-scheduler'].map((c) => mirrorPod(c, s)),
      pod('kube-system', 'coredns-1', 'worker-1', { 'k8s-app': 'kube-dns' }),
      ...['a', 'b', 'c'].map((x) => pod('default', `exam-web-${x}`, 'worker-1', { app: 'exam-web' }, s.schedulerDown ? 'Pending' : 'Running')),
    ]),
    'deployments.apps': items([{ kind: 'Deployment', metadata: { name: 'exam-web', namespace: 'default' }, spec: { replicas: 3, template: { spec: { containers: [{ image: 'nginx:1.27' }] } } }, status: { readyReplicas: s.schedulerDown ? 0 : 3 } }]),
    'daemonsets.apps': items([{ kind: 'DaemonSet', metadata: { name: 'cilium', namespace: 'kube-system' }, status: { desiredNumberScheduled: 3, numberReady: s.notReady ? 2 : 3 } }]),
    'cronjobs.batch': items(s.cron ? [{ kind: 'CronJob', metadata: { name: 'etcd-backup', namespace: 'kube-system' }, spec: { schedule: '0 3 * * *', jobTemplate: { spec: { template: { spec: { containers: [{ command: ['etcdutl', 'snapshot', 'save', '/backup/etcd.db'] }] } } } } } }] : []),
    'jobs.batch': items(s.cron ? [{ kind: 'Job', metadata: { name: 'etcd-backup-1', namespace: 'kube-system', ownerReferences: [{ kind: 'CronJob', name: 'etcd-backup' }] }, status: { succeeded: 1 } }] : []),
    'cm-kubeadm-config': { kind: 'ConfigMap', metadata: { name: 'kubeadm-config', namespace: 'kube-system' }, data: { ClusterConfiguration: `apiVersion: kubeadm.k8s.io/v1beta4\nkind: ClusterConfiguration\nkubernetesVersion: ${s.version}\netcd:\n  local:\n    dataDir: ${s.kubeadmDataDir}\nnetworking:\n  podSubnet: 10.244.0.0/16\n` } },
    ...(s.breakCase ? { 'cm-exam-break': { kind: 'ConfigMap', metadata: { name: 'exam-break', namespace: 'default', creationTimestamp: iso(30 * MIN) }, data: { case: s.breakCase } } } : {}),
  };
}

const FAKE_KUBECTL = `#!/usr/bin/env bash
args="$*"
case "$args" in
  *"get --raw=/readyz"*) echo ok ;;
  *"api-resources -o name"*) printf 'nodes\\nnamespaces\\npods\\nservices\\ndeployments.apps\\ndaemonsets.apps\\nreplicasets.apps\\njobs.batch\\ncronjobs.batch\\nendpointslices.discovery.k8s.io\\n' ;;
  *"version --client -o json"*) echo '{"clientVersion":{"gitVersion":"v1.37.1"}}' ;;
  *"version -o json"*) echo '{"serverVersion":{"gitVersion":"v1.37.1"}}' ;;
  *"config current-context"*) echo kubernetes-admin@kubernetes ;;
  *"get configmap "*) name=$(echo "$args" | sed -E 's/.*get configmap ([^ ]+).*/\\1/'); [ -f "$FIX/cm-$name.json" ] && cat "$FIX/cm-$name.json" || exit 1 ;;
  *" -A -o json"*) res=$(echo "$args" | sed -E 's/.*get ([^ ]+) -A.*/\\1/'); [ -f "$FIX/$res.json" ] && cat "$FIX/$res.json" || echo '{"kind":"List","items":[]}' ;;
  *) echo "fake kubectl: unexpected: $args" >&2; exit 1 ;;
esac
`;
const FAKES: Record<string, string> = {
  kubectl: FAKE_KUBECTL,
  etcdutl: '#!/usr/bin/env bash\necho \'{"hash":3032573812,"revision":48211,"totalKey":1290,"totalSize":5242880,"version":"3.6.5"}\'\n',
  kubeadm: '#!/usr/bin/env bash\necho "$KUBEADM_VERSION"\n',
  kubelet: '#!/usr/bin/env bash\necho "Kubernetes $KUBEADM_VERSION"\n',
  systemctl: '#!/usr/bin/env bash\ncase "$1" in show) printf "ActiveState=active\\nSubState=running\\nUnitFileState=enabled\\nNRestarts=0\\n" ;; list-timers) ;; esac\n',
  // GNU stat -c on the trainer's own (macOS) test machine.
  stat: '#!/usr/bin/env bash\nif [ "$1" = "-c" ]; then f="$3"; case "$2" in %s) exec /usr/bin/stat -f %z "$f" 2>/dev/null || exec /usr/bin/env -i stat -c %s "$f" ;; %Y) exec /usr/bin/stat -f %m "$f" 2>/dev/null || exec /usr/bin/env -i stat -c %Y "$f" ;; esac; fi\nexec /usr/bin/stat "$@"\n',
};

const ETCD_YAML = (dir: string) => `apiVersion: v1\nkind: Pod\nmetadata:\n  name: etcd\n  namespace: kube-system\nspec:\n  containers:\n  - name: etcd\n    command:\n    - etcd\n    - --data-dir=/var/lib/etcd\n  volumes:\n  - hostPath:\n      path: ${dir}\n      type: DirectoryOrCreate\n    name: etcd-data\n`;

function runCheck(s: ClusterState, nonce = 'k8sexam'): string {
  const dir = mkdtempSync(join(tmpdir(), 'k8s-exam-'));
  const bin = join(dir, 'bin');
  const fix = join(dir, 'fix');
  const root = join(dir, 'root');
  for (const d of [bin, fix, join(root, 'etc/kubernetes/manifests'), join(root, 'etc/cni/net.d'), join(root, 'opt/backup'), join(root, `${s.restoredDir}/member`), join(root, 'var/lib/etcd/member')]) mkdirSync(d, { recursive: true });
  for (const [name, text] of Object.entries(FAKES)) {
    writeFileSync(join(bin, name), text);
    chmodSync(join(bin, name), 0o755);
  }
  for (const [name, v] of Object.entries(fixture(s))) writeFileSync(join(fix, `${name}.json`), JSON.stringify(v));
  writeFileSync(join(root, 'etc/kubernetes/manifests/etcd.yaml'), ETCD_YAML(s.restoredDir));
  writeFileSync(join(root, 'etc/kubernetes/manifests/kube-apiserver.yaml'), 'apiVersion: v1\nkind: Pod\nspec:\n  containers:\n  - command:\n    - kube-apiserver\n    - --etcd-servers=https://127.0.0.1:2379\n');
  writeFileSync(join(root, 'etc/kubernetes/manifests/kube-controller-manager.yaml'), 'apiVersion: v1\nkind: Pod\n');
  if (!s.schedulerDown) writeFileSync(join(root, 'etc/kubernetes/manifests/kube-scheduler.yaml'), 'apiVersion: v1\nkind: Pod\n');
  writeFileSync(join(root, 'etc/cni/net.d/05-cilium.conflist'), '{"cniVersion":"0.3.1","name":"cilium","plugins":[{"type":"cilium-cni"}]}');
  writeFileSync(join(root, 'opt/backup/etcd.db'), 'bbolt');
  const script = resolve(__dirname, '../public/check/trainer-check.sh');
  return execFileSync('bash', [script, '--nonce', nonce, '--machine', 'cp-1', '--track', 'k8s-2', '--snapshot', '/opt/backup/etcd.db'], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FIX: fix, TRAINER_CHECK_ROOT: root, KUBECONFIG: join(dir, 'kubeconfig'), KUBEADM_VERSION: s.version },
    encoding: 'utf8',
  });
}

const DONE: ClusterState = { version: 'v1.37.1', restoredDir: '/var/lib/etcd-restore', kubeadmDataDir: '/var/lib/etcd-restore', exam: { before: true, after: false }, breakCase: 'scheduler', cron: true };
const realTask = (id: string) => (stage2Exam.tasks.find((t) => t.id === id) as ExamTask & { kind: 'real' }).real as RealTask;

async function machineFacts(s: ClusterState) {
  const out = runCheck(s);
  expect(out).toContain('-----BEGIN TRAINER FACTS-----');
  const f = hostFacts(await decodeHostBlob(out));
  return f;
}

describe('the stage-2 exam on real machines', () => {
  it('is the block exam of k8s-2 and is collected by trainer-check.sh', () => {
    expect(registry.blocks.get('k8s-2')!.exam).toBe('k8s-2.exam');
    expect(stage2Exam.real?.collector?.name).toBe('trainer-check.sh');
    expect(stage2Exam.real?.collector?.text).toContain('dt.host-check/v1');
    expect(stage2Exam.tasks.filter((t) => t.pool === 'break').length).toBe(3);
    const variant = stage2Exam.tasks.filter((t) => t.pool !== 'break' || t.id === 'break-scheduler');
    const total = variant.reduce((s, t) => s + t.weight, 0);
    const beyond = variant.filter((t) => t.beyond).reduce((s, t) => s + t.weight, 0);
    expect(beyond / total).toBeGreaterThanOrEqual(0.2);
    for (const t of stage2Exam.tasks.filter((x) => x.beyond)) expect((t as ExamTask & { kind: 'real' }).real.solutionTokens?.length).toBeGreaterThan(0);
  });

  it('the node block decodes into facts the page accepts, with the cluster, the snapshot and the manifests', async () => {
    const f = await machineFacts(DONE);
    expect(hostProblems(f, { nonce: 'k8sexam', machine: 'cp-1', track: 'k8s-2' })).toEqual([]);
    expect(cluster(f)?.nodes.length).toBe(3);
    expect(snapshot(f)?.status?.totalKey).toBe(1290);
    expect(etcdDataDir(f)).toBe('/var/lib/etcd-restore');
  });

  it('a finished cluster passes every goal of every task', async () => {
    const f = await machineFacts(DONE);
    for (const t of stage2Exam.tasks) {
      if (t.kind !== 'real' || !t.real.goals) continue;
      const s = t.id.startsWith('break-') ? await machineFacts({ ...DONE, breakCase: t.id.slice(6) }) : f;
      const r = judgeReal(t.real, { 'cp-1': s });
      expect(r.goals.filter((g) => !g.result?.pass).map((g) => g.goal.id), t.id).toEqual([]);
      expect(r.score, t.id).toBe(1);
    }
  }, 60_000);

  it('an unfinished cluster fails where it should and says why', async () => {
    const f = await machineFacts({ version: 'v1.36.4', cordoned: 'worker-2', notReady: 'worker-1', restoredDir: '/var/lib/etcd', kubeadmDataDir: '/var/lib/etcd', exam: { before: true, after: true }, schedulerDown: true, breakCase: 'scheduler' });
    const failed = (id: string) => judgeReal(realTask(id), { 'cp-1': f }).goals.filter((g) => !g.result?.pass).map((g) => g.goal.id);
    expect(failed('nodes')).toEqual(['ready']);
    expect(failed('upgrade')).toEqual(['config', 'apiserver', 'kubelets', 'uncordoned']);
    expect(failed('restore')).toEqual(['lost', 'datadir']);
    expect(failed('break-scheduler')).toEqual(['back', 'web']);
    expect(failed('schedule')).toEqual(['scheduled', 'ran']);
    expect(failed('datadir')).toEqual(['recorded']);
    const lost = judgeReal(realTask('restore'), { 'cp-1': f }).goals.find((g) => g.goal.id === 'lost');
    expect(lost?.result?.say?.en).toMatch(/etcd-data/);
  }, 60_000);

  it('a block with another code or from another machine is refused', async () => {
    const f = hostFacts(await decodeHostBlob(runCheck(DONE, 'other')));
    expect(hostProblems(f, { nonce: 'k8sexam', machine: 'cp-1', track: 'k8s-2' }).length).toBeGreaterThan(0);
  });

  it('the cleanup accepts an empty list only', () => {
    const t = realTask('cleanup');
    expect(t.paste!.accept.some((re) => re.test('[]\n'))).toBe(true);
    expect(t.paste!.accept.some((re) => re.test('[{"id":1,"name":"cp-1"}]'))).toBe(false);
  });
});
