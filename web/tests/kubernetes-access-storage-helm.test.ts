// The hands-on tasks of the access, storage and Helm lessons and the RBAC and
// StatefulSet exam tasks: every goal is false at the start, the reference
// solution passes it, and the typical mistakes fail with their own
// explanation.

import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { registry } from '../src/core/registry';
import type { CheckResult, ExamTask, Section, Task } from '../src/core/types';
import { createSimMachine, stripAnsi } from '../src/engine/terminal/shell';

const SA_CI = '--as=system:serviceaccount:prod:ci-deployer';

async function lab(lessonId: string, sectionId: string) {
  const lesson = registry.lessons.get(lessonId)!;
  const s = lesson.sections.find((x) => x.id === sectionId) as Section & { kind: 'terminal' };
  expect(s, `${lessonId}/${sectionId}`).toBeTruthy();
  const m = await createSimMachine(s.setup);
  const start = await m.facts();
  let log = '';
  const task = (id: string): Task => {
    const t = s.tasks.find((x) => x.id === id);
    expect(t, `${lessonId}/${sectionId}/${id}`).toBeTruthy();
    return t!;
  };
  return {
    start,
    log: () => log,
    async run(...lines: string[]) {
      for (const line of lines) log += `$ ${line}\n${stripAnsi((await m.exec(line)).out)}`;
    },
    async check(id: string): Promise<CheckResult> {
      return evaluateCheck(task(id).check, await m.facts(), start);
    },
    atStart(id: string): boolean {
      return evaluateCheck(task(id).check, start, start).pass;
    },
    failIndex(id: string, r: CheckResult) {
      return r.say ? (task(id).check.fail ?? []).findIndex((x) => x.say === r.say) : -1;
    },
  };
}
type Lab = Awaited<ReturnType<typeof lab>>;

async function expectPass(l: Lab, id: string) {
  expect(l.atStart(id), `${id} at the start`).toBe(false);
  const r = await l.check(id);
  expect(r.pass, `${id}\n${l.log()}`).toBe(true);
}
async function expectFail(l: Lab, id: string, index: number) {
  const r = await l.check(id);
  expect(r.pass, `${id} must fail\n${l.log()}`).toBe(false);
  expect(l.failIndex(id, r), `${id}: explanation\n${l.log()}`).toBe(index);
}

describe('k8s-1.access', () => {
  it('lab-who: own rights, the developer’s rights, the Forbidden message', async () => {
    const l = await lab('k8s-1.access', 'lab-who');
    await l.run('kubectl auth can-i --list --as=developer');
    await expectFail(l, 'mine', 0);
    await l.run('kubectl auth can-i --list');
    await expectPass(l, 'mine');
    await l.run('kubectl auth can-i --list -n prod');
    await expectFail(l, 'dev-list', 0);
    await l.run('kubectl auth can-i --list --as=developer -n prod');
    expect(l.log()).toContain('selfsubjectaccessreviews.authorization.k8s.io');
    await expectPass(l, 'dev-list');
    await l.run('kubectl -n prod get pods');
    await expectFail(l, 'forbidden', 0);
    await l.run('kubectl --context developer get pods');
    await expectFail(l, 'forbidden', 1);
    await l.run('kubectl --context developer -n prod get pods');
    await expectPass(l, 'forbidden');
  });

  it('lab-grant: the reference Role and RoleBinding, then the check as the developer', async () => {
    const l = await lab('k8s-1.access', 'lab-grant');
    await l.run('kubectl create role pod-reader -n prod --verb=get,list,watch --resource=pods,pods/log', 'kubectl create rolebinding developer-pod-reader -n prod --role=pod-reader --user=developer');
    await expectPass(l, 'role');
    await l.run('kubectl --context developer -n prod get pods');
    await expectFail(l, 'verify', 0);
    await l.run('kubectl auth can-i delete pods --as=developer -n prod');
    await expectPass(l, 'verify');
  });

  const grantMistakes: [string, string[], number][] = [
    ['nothing at all', ['kubectl get pods -n prod'], 0],
    ['a role without a binding', ['kubectl create role pod-reader -n prod --verb=get,list,watch --resource=pods,pods/log'], 1],
    ['a ClusterRoleBinding', ['kubectl create clusterrole pod-reader --verb=get,list,watch --resource=pods,pods/log', 'kubectl create clusterrolebinding developer-pod-reader --clusterrole=pod-reader --user=developer'], 2],
    ['the delete verb', ['kubectl create role pod-reader -n prod --verb=get,list,watch,delete --resource=pods,pods/log', 'kubectl create rolebinding developer-pod-reader -n prod --role=pod-reader --user=developer'], 3],
    ['no pods/log', ['kubectl create role pod-reader -n prod --verb=get,list,watch --resource=pods', 'kubectl create rolebinding developer-pod-reader -n prod --role=pod-reader --user=developer'], 4],
    ['the binding in another namespace', ['kubectl create role pod-reader -n prod --verb=get,list,watch --resource=pods,pods/log', 'kubectl create rolebinding developer-pod-reader -n dev --role=pod-reader --user=developer'], 5],
  ];
  for (const [name, lines, index] of grantMistakes)
    it(`lab-grant: ${name} fails with its explanation`, async () => {
      const l = await lab('k8s-1.access', 'lab-grant');
      await l.run(...lines);
      await expectFail(l, 'role', index);
    });

  it('lab-ci: kubectl create role resolves deployments to the group apps, so the short form passes too', async () => {
    const l = await lab('k8s-1.access', 'lab-ci');
    await l.run('kubectl create serviceaccount ci-deployer -n prod', 'kubectl create role deployer -n prod --verb=get,list,watch,patch --resource=deployments', 'kubectl create rolebinding ci-deployer -n prod --role=deployer --serviceaccount=prod:ci-deployer');
    await expectPass(l, 'sa');
  });

  it('lab-ci: least privilege for the pipeline, the rollout as the account, a pod with its token', async () => {
    const l = await lab('k8s-1.access', 'lab-ci');
    await l.run('kubectl create serviceaccount ci-deployer -n prod');
    await l.run('kubectl create role deployer -n prod --verb=get,list,watch,patch --resource=deployments.apps', 'kubectl create rolebinding ci-deployer -n prod --role=deployer --serviceaccount=prod:ci-deployer');
    await expectPass(l, 'sa');
    await l.run(`kubectl ${SA_CI} -n prod set image deployment/web web=trainer/web:1.1`, `kubectl ${SA_CI} -n prod rollout status deployment/web`);
    await expectFail(l, 'sa-run', 1);
    await l.run(`kubectl auth can-i delete deployments ${SA_CI} -n prod`);
    await expectPass(l, 'sa-run');
    await l.run('kubectl apply -f status.yaml');
    await expectFail(l, 'pod-token', 0);
    await l.run('kubectl create serviceaccount status-reader -n prod', 'kubectl apply -f status.yaml', 'cluster ff 20s', 'kubectl -n prod exec status-page -- kubectl get pods');
    await expectFail(l, 'pod-token', 2);
    await l.run('kubectl create role pod-list -n prod --verb=get,list,watch --resource=pods', 'kubectl create rolebinding status-reader -n prod --role=pod-list --serviceaccount=prod:status-reader', 'kubectl -n prod exec status-page -- kubectl get pods');
    await expectPass(l, 'pod-token');
  }, 60_000);

  const ciMistakes: [string, string[], number][] = [
    ['deployments in the core group', [`cat > core.yaml <<'EOF'\napiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: deployer\n  namespace: prod\nrules:\n- apiGroups: [\"\"]\n  resources: [deployments]\n  verbs: [get, list, watch, patch]\nEOF`, 'kubectl apply -f core.yaml', `kubectl patch role deployer -n prod --type=merge -p '{"rules":[{"apiGroups":[""],"resources":["deployments"],"verbs":["get","list","watch","patch"]}]}'`, 'kubectl create rolebinding ci-deployer -n prod --role=deployer --serviceaccount=prod:ci-deployer'], 1],
    ['a user instead of the service account', ['kubectl create role deployer -n prod --verb=get,list,watch,patch --resource=deployments.apps', 'kubectl create rolebinding ci-deployer -n prod --role=deployer --user=ci-deployer'], 2],
    ['the ready role edit', ['kubectl create rolebinding ci-deployer -n prod --clusterrole=edit --serviceaccount=prod:ci-deployer'], 3],
    ['a ClusterRoleBinding', ['kubectl create clusterrole deployer --verb=get,list,watch,patch --resource=deployments.apps', 'kubectl create clusterrolebinding ci-deployer --clusterrole=deployer --serviceaccount=prod:ci-deployer'], 4],
  ];
  for (const [name, lines, index] of ciMistakes)
    it(`lab-ci: ${name} fails with its explanation`, async () => {
      const l = await lab('k8s-1.access', 'lab-ci');
      await l.run('kubectl create serviceaccount ci-deployer -n prod', ...lines);
      await expectFail(l, 'sa', index);
    });

  it('lab-ci: a rollout done as the administrator does not prove the account’s rights', async () => {
    const l = await lab('k8s-1.access', 'lab-ci');
    await l.run('kubectl create serviceaccount ci-deployer -n prod', 'kubectl create role deployer -n prod --verb=get,list,watch,patch --resource=deployments.apps', 'kubectl create rolebinding ci-deployer -n prod --role=deployer --serviceaccount=prod:ci-deployer', 'kubectl -n prod set image deployment/web web=trainer/web:1.1', 'cluster ff 60s');
    await expectFail(l, 'sa-run', 0);
  });

  it('lab-why: the binding in the wrong namespace and the ClusterRole bound by a RoleBinding', async () => {
    const l = await lab('k8s-1.access', 'lab-why');
    await l.run('kubectl get rolebindings -A');
    await expectFail(l, 'wrong-ns', 1);
    await expectFail(l, 'cluster-wide', 1);
    await l.run('kubectl create rolebinding developer-logs -n prod --role=log-reader --user=developer');
    await expectPass(l, 'wrong-ns');
    await l.run('kubectl create clusterrolebinding pod-watcher --clusterrole=pod-lister --serviceaccount=monitoring:pod-watcher');
    await expectPass(l, 'cluster-wide');
  });

  it('lab-why: too broad fixes fail', async () => {
    const l = await lab('k8s-1.access', 'lab-why');
    await l.run('kubectl create clusterrolebinding developer-view --clusterrole=view --user=developer', 'kubectl create clusterrolebinding pod-watcher --clusterrole=view --serviceaccount=monitoring:pod-watcher');
    await expectFail(l, 'wrong-ns', 0);
    await expectFail(l, 'cluster-wide', 0);
  });
});

describe('k8s-1.storage', () => {
  it('lab-noclass: the event, and a default class that binds the claim in place', async () => {
    const l = await lab('k8s-1.storage', 'lab-noclass');
    await l.run('kubectl describe pvc notes');
    await expectPass(l, 'why');
    await l.run('kubectl apply -f class.yaml', 'cluster ff 10s');
    await expectFail(l, 'fix', 0);
    await l.run('kubectl annotate storageclass hostpath storageclass.kubernetes.io/is-default-class=true', 'cluster ff 10s', 'kubectl get pvc notes');
    await expectPass(l, 'fix');
  });

  it('lab-noclass: recreating the claim does not count', async () => {
    const l = await lab('k8s-1.storage', 'lab-noclass');
    await l.run('kubectl apply -f class.yaml', 'kubectl annotate storageclass hostpath storageclass.kubernetes.io/is-default-class=true', 'kubectl delete pvc notes', 'kubectl apply -f notes.yaml', 'cluster ff 10s');
    await expectFail(l, 'fix', 2);
  });

  it('lab-sts: three replicas with their own claims, a replica by its stable name', async () => {
    const l = await lab('k8s-1.storage', 'lab-sts');
    await l.run('kubectl apply -f web.yaml', 'cluster ff 60s', 'kubectl get pods,pvc');
    await expectPass(l, 'create');
    await l.run('kubectl exec client -- curl -s http://web-1.web');
    await expectFail(l, 'dns', 0);
    await l.run('kubectl exec client -- curl -s http://web-0.web');
    await expectPass(l, 'dns');
    await l.run('kubectl exec client -- nslookup web-0.web');
    expect((await l.check('dns')).pass).toBe(true);
  });

  it('lab-sts-life: the same name and disk, claims kept on scale-down, the old claim back on scale-up', async () => {
    const l = await lab('k8s-1.storage', 'lab-sts-life');
    await l.run(`kubectl exec web-1 -- sh -c 'echo order-42 > /data/orders.txt'`, `kubectl exec web-1 -- sh -c 'echo session-7 > /cache/session.txt'`, 'kubectl exec web-1 -- cat /data/orders.txt');
    expect((await l.check('same-name')).pass, 'reading before the deletion does not count').toBe(false);
    await l.run('kubectl delete pod web-1', 'cluster ff 30s', 'kubectl exec web-1 -- cat /data/orders.txt');
    await expectPass(l, 'same-name');
    await l.run('kubectl exec web-1 -- cat /cache/session.txt');
    await expectPass(l, 'emptydir');
    await l.run('kubectl scale statefulset web --replicas=1', 'cluster ff 60s');
    await expectPass(l, 'scale-down');
    await l.run('kubectl scale statefulset web --replicas=3', 'cluster ff 60s');
    await expectPass(l, 'scale-up');
  });

  it('lab-sts-life: a file not written before the deletion is reported', async () => {
    const l = await lab('k8s-1.storage', 'lab-sts-life');
    await l.run('kubectl delete pod web-1', 'cluster ff 30s', 'kubectl exec web-1 -- cat /data/orders.txt');
    await expectFail(l, 'same-name', 2);
  });

  it('lab-sts-life: recreating the StatefulSet and deleting claims fail', async () => {
    const l = await lab('k8s-1.storage', 'lab-sts-life');
    await l.run(`kubectl exec web-1 -- sh -c 'echo order-42 > /data/orders.txt'`, 'kubectl delete statefulset web', 'cluster ff 30s', 'kubectl apply -f web.yaml', 'cluster ff 60s', 'kubectl exec web-1 -- cat /data/orders.txt');
    await expectFail(l, 'same-name', 0);
    const k = await lab('k8s-1.storage', 'lab-sts-life');
    await k.run('kubectl scale statefulset web --replicas=1', 'cluster ff 60s', 'kubectl delete pvc data-web-1 data-web-2', 'cluster ff 10s');
    await expectFail(k, 'scale-down', 0);
  });

  it('lab-sts-update: a partitioned update and rollout undo; without the partition every replica changes', async () => {
    const l = await lab('k8s-1.storage', 'lab-sts-update');
    await l.run(`kubectl patch statefulset web -p '{"spec":{"updateStrategy":{"type":"RollingUpdate","rollingUpdate":{"partition":2}}}}'`, 'kubectl set image statefulset/web web=trainer/web:1.1', 'cluster ff 60s');
    await expectPass(l, 'partition');
    await l.run('kubectl rollout undo statefulset/web', 'cluster ff 60s');
    await expectPass(l, 'undo');
    const k = await lab('k8s-1.storage', 'lab-sts-update');
    await k.run('kubectl set image statefulset/web web=trainer/web:1.1', 'cluster ff 90s');
    await expectFail(k, 'partition', 0);
  });

  it('the old Pending lab still works', async () => {
    const l = await lab('k8s-1.storage', 'lab');
    await l.run('kubectl get storageclass');
    await expectPass(l, 'sc');
  });
});

describe('k8s-1.helm', () => {
  it('the whole lab: repo, template, install, -f, a failed upgrade and helm rollback', async () => {
    const l = await lab('k8s-1.helm', 'lab');
    await l.run('helm show values training/podinfo');
    await expectFail(l, 'repo', 0);
    await l.run('helm repo add training https://charts.example.test', 'helm search repo training');
    await expectPass(l, 'repo');
    await l.run('helm template shop training/podinfo');
    await expectFail(l, 'template', 1);
    await l.run('helm template shop training/podinfo --set replicaCount=2');
    await expectPass(l, 'template');
    await l.run('helm install shop training/podinfo --set replicaCount=2', 'cluster ff 30s');
    await expectPass(l, 'install');
    await l.run('helm upgrade shop training/podinfo -f prod.yaml', 'cluster ff 60s', 'helm get values shop');
    await expectPass(l, 'values-file');
    await l.run('helm upgrade shop training/podinfo -f prod.yaml --set image.tag=2.0 --wait --timeout 60s');
    await expectFail(l, 'rollback', 2);
    await l.run('helm history shop', 'helm rollback shop 2', 'cluster ff 60s');
    await expectPass(l, 'rollback');
  }, 60_000);

  it('typical Helm mistakes fail with their explanation', async () => {
    const a = await lab('k8s-1.helm', 'lab');
    await a.run('helm repo add training https://charts.example.test', 'helm install shop training/podinfo');
    await expectFail(a, 'template', 0);
    await a.run('cluster ff 30s');
    await expectFail(a, 'install', 1);
    await a.run('helm upgrade shop training/podinfo --set replicaCount=3', 'cluster ff 30s');
    await expectFail(a, 'values-file', 0);

    const b = await lab('k8s-1.helm', 'lab');
    await b.run('helm repo add training https://charts.example.test', 'helm install shop training/podinfo --set replicaCount=2', 'helm upgrade shop training/podinfo -f prod.yaml', 'cluster ff 60s', 'helm upgrade shop training/podinfo -f prod.yaml --set image.tag=2.0', 'cluster ff 30s', 'kubectl rollout undo deployment/shop', 'cluster ff 90s');
    await expectFail(b, 'rollback', 0);
    await b.run('helm rollback shop 1', 'cluster ff 60s');
    await expectFail(b, 'rollback', 1);
  }, 60_000);

  it('the experienced lab: values precedence and the release Secrets', async () => {
    const l = await lab('k8s-1.helm', 'lab-deep');
    await l.run('helm repo add training https://charts.example.test', 'helm template shop training/podinfo -f prod.yaml');
    await expectFail(l, 'precedence', 0);
    await l.run('helm template shop training/podinfo -f prod.yaml --set replicaCount=5');
    await expectPass(l, 'precedence');
    await l.run('helm install shop training/podinfo', 'kubectl get secrets -l owner=helm');
    await expectFail(l, 'secrets', 0);
    await l.run('helm upgrade shop training/podinfo -f prod.yaml', 'kubectl get secrets -l owner=helm --show-labels');
    await expectPass(l, 'secrets');
  });
});

describe('the RBAC and StatefulSet exam tasks reject the typical mistakes', () => {
  const examTask = (exam: string, id: string) => registry.exams.get(exam)!.tasks.find((t) => t.id === id) as ExamTask & { kind: 'task' };
  const solve = async (t: ExamTask & { kind: 'task' }, lines: string[]) => {
    const m = await createSimMachine(t.setup);
    const start = await m.facts();
    for (const line of lines) await m.exec(line);
    return evaluateCheck(t.task.check, await m.facts(), start);
  };
  it('stage 1: a ClusterRoleBinding gives the developer too much', async () => {
    const r = await solve(examTask('k8s-1.exam', 'rbac'), ['kubectl create clusterrolebinding dev --clusterrole=view --user=developer']);
    expect(r.pass).toBe(false);
  });
  it('stage 1: a Deployment with one shared claim is not a StatefulSet', async () => {
    const r = await solve(examTask('k8s-1.exam', 'sts'), ['kubectl create deployment queue --image=trainer/web:1.0 --replicas=3', 'cluster ff 60s']);
    expect(r.pass).toBe(false);
  });
  it('CKA: workloads in the core group fail with the explanation', async () => {
    const t = examTask('k8s-1.exam.cka', 'rbac');
    const r = await solve(t, [`cat > cr.yaml <<'EOF'\napiVersion: rbac.authorization.k8s.io/v1\nkind: ClusterRole\nmetadata:\n  name: deployment-clusterrole\nrules:\n- apiGroups: [\"\"]\n  resources: [deployments, statefulsets, daemonsets]\n  verbs: [create]\nEOF`, 'kubectl apply -f cr.yaml', `kubectl patch clusterrole deployment-clusterrole --type=merge -p '{"rules":[{"apiGroups":[""],"resources":["deployments","statefulsets","daemonsets"],"verbs":["create"]}]}'`, 'kubectl -n app-team1 create serviceaccount cicd-token', 'kubectl -n app-team1 create rolebinding cicd-token --clusterrole=deployment-clusterrole --serviceaccount=app-team1:cicd-token']);
    expect(r.pass).toBe(false);
    expect(r.say).toBe(t.task.check.fail![0].say);
  });
  it('CKA: an update without the partition fails with the explanation', async () => {
    const t = examTask('k8s-1.exam.cka', 'sts');
    const r = await solve(t, ['kubectl set image statefulset/db db=trainer/web:1.1', 'cluster ff 90s']);
    expect(r.pass).toBe(false);
    expect(r.say).toBe(t.task.check.fail![0].say);
  });
});
