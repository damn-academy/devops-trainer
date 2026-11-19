// The Kubernetes block (05): stage 1 in the browser (k8s-1) and stage 2–3 on
// real machines (k8s-2). The engine — kube-lite, kubectl, the widgets — lives
// in src/engine/kube-lite; this module is the textbook on top of it.

import { defineModule } from '../../core/define';
import { bi } from '../../core/i18n';
import type { Block, Facts } from '../../core/types';
import { fromModel } from '../../engine/explainer/render';
import type { K8sFacts } from '../../engine/kube-lite/facts';
import { CONCEPTS } from './concepts';
import { applyPathModel } from './explainers/apply-path';
import { dispatchModel } from './explainers/dispatch';
import { ingressPathModel } from './explainers/ingress-path';
import { ndotsModel } from './explainers/ndots';
import { nodeDownModel } from './explainers/node-down';
import { podNetworkModel } from './explainers/pod-network';
import { reconcileModel } from './explainers/reconcile';
import { rollingModel } from './explainers/rolling';
import { schedulerModel } from './explainers/scheduler';
import { servicePathModel } from './explainers/service-path';
import { firstPodLesson, podQuiz, reconcileLesson, reconcileQuiz, whyLesson, whyQuiz } from './lessons/a-basics';
import { archQuiz, architectureLesson, deployQuiz, deploymentsLesson, operatorQuiz, operatorsLesson } from './lessons/b-workloads';
import { dnsLesson, dnsQuiz, ingressLesson, ingressQuiz, networkLesson, networkQuiz, serviceQuiz, servicesLesson, troubleQuiz, troubleshootLesson } from './lessons/c-network';
import { configLesson, configQuiz, healthLesson, healthQuiz, helmLesson, helmQuiz } from './lessons/d-config';
import { kubeadmLesson, realQuiz, singleNodeLesson } from './lessons/e-real';
import { SERVICE_BROKEN, ns } from './setups';
import { R, S, src } from './sources';

const k8s = (f: Facts) => f.k8s as K8sFacts;

const quiz = [...whyQuiz, ...podQuiz, ...reconcileQuiz, ...deployQuiz, ...archQuiz, ...operatorQuiz, ...networkQuiz, ...serviceQuiz, ...dnsQuiz, ...ingressQuiz, ...troubleQuiz, ...configQuiz, ...healthQuiz, ...helmQuiz, ...realQuiz];
const byId = (id: string) => quiz.find((q) => q.id === id)!;

const stage1: Block = {
  id: 'k8s-1',
  order: 60,
  title: bi('Kubernetes, этап 1', 'Kubernetes, stage 1'),
  summary: bi(
    'Kubernetes из блоков, цикл согласования, поды, Deployment, планировщик и kubelet, оператор, сеть Kubernetes целиком, конфигурация и здоровье подов — на кластере в браузере.',
    'Kubernetes from blocks, the reconcile loop, pods, Deployments, the scheduler and the kubelet, an operator, Kubernetes networking end to end, configuration and pod health — on a cluster in the browser.',
  ),
  checklistStep: '05',
  requires: ['containers'],
  levels: {
    beginner: bi('Уверенный Docker, кластер не видел', 'Confident with Docker, never seen a cluster'),
    intermediate: bi('kubectl apply по инструкции', 'kubectl apply by instructions'),
    experienced: bi('Сам пишет манифесты, цель — уровень CKA', 'Writes manifests, aims at CKA level'),
  },
  hours: { beginner: 85, intermediate: 54, experienced: 31 },
  lessons: [
    'k8s-1.why',
    'k8s-1.first-pod',
    'k8s-1.reconcile',
    'k8s-1.deployments',
    'k8s-1.architecture',
    'k8s-1.operators',
    'k8s-1.network',
    'k8s-1.services',
    'k8s-1.dns',
    'k8s-1.ingress',
    'k8s-1.troubleshoot',
    'k8s-1.config',
    'k8s-1.health',
    'k8s-1.helm',
  ],
  sources: src([S.overview, S.components, S.networking, S.kubectl], [R.what, R.components, R.cheatsheet]),
  docSources: ['kubectl-explain', 'help', 'kubernetes.io'],
  placement: [
    { id: 'k8s.place.i1', level: 'intermediate', key: true, concepts: ['k8s.pod', 'k8s.replicaset'], kind: 'quiz', item: { ...byId('k8s.q.pod.delete'), id: 'k8s.place.q.delete' } },
    { id: 'k8s.place.i2', level: 'intermediate', key: false, concepts: ['k8s.deployment'], kind: 'quiz', item: { ...byId('k8s.q.dep.order'), id: 'k8s.place.q.order' } },
    {
      id: 'k8s.place.i3',
      level: 'intermediate',
      key: true,
      concepts: ['k8s.deployment', 'k8s.service', 'k8s.namespace'],
      kind: 'task',
      setup: { hostname: 'laptop', ext: { k8s: { manifests: [ns('shop'), 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: client\n  namespace: shop\nspec:\n  containers:\n  - name: client\n    image: trainer/client:1.0\n'] } } },
      task: {
        id: 'shop',
        prompt: bi('В namespace `shop`: Deployment `web` из `trainer/web:1.0` на 3 реплики и Service `web` на порту 80. Под `client` должен получать ответ по `http://web.shop`.', 'In namespace `shop`: Deployment `web` from `trainer/web:1.0` with 3 replicas and Service `web` on port 80. Pod `client` must get an answer from `http://web.shop`.'),
        check: { when: "k8s.deployments[ns=shop][name=web].ready=3 && k8s.reach[from='shop/client'][to='web.shop'].status=200" },
      },
    },
    { id: 'k8s.place.e1', level: 'experienced', key: true, concepts: ['k8s.clusterip', 'k8s.kube-proxy'], kind: 'quiz', item: { ...byId('k8s.q.svc.ip'), id: 'k8s.place.q.ip' } },
    {
      id: 'k8s.place.e2',
      level: 'experienced',
      key: true,
      concepts: ['k8s.service', 'k8s.endpointslice', 'k8s.label'],
      kind: 'task',
      setup: SERVICE_BROKEN,
      task: {
        id: 'fix',
        prompt: bi('Service `api` в namespace `prod` не отвечает. Почините его, не пересоздавая поды.', 'Service `api` in namespace `prod` does not answer. Fix it without recreating the pods.'),
        check: {
          when: (f, start) => {
            const s = k8s(f).services.find((x) => x.ns === 'prod' && x.name === 'api');
            const uids = (x?: Facts) => (x ? k8s(x).pods.filter((p) => p.ns === 'prod' && p.labels.app === 'api-v2').map((p) => p.uid).sort().join() : '');
            return !!s && s.endpoints >= 2 && (!start || uids(f) === uids(start));
          },
        },
      },
    },
    { id: 'k8s.place.e3', level: 'experienced', key: false, concepts: ['k8s.resources'], kind: 'quiz', item: { ...byId('k8s.q.h.reason'), id: 'k8s.place.q.oom' } },
  ],
};

const stage2: Block = {
  id: 'k8s-2',
  order: 70,
  title: bi('Kubernetes, этап 2–3: настоящие машины', 'Kubernetes, stages 2–3: real machines'),
  summary: bi('Один настоящий узел на k3s с Gateway и Helm, затем полный кластер kubeadm на трёх ВМ: Cilium, сертификаты, etcd, обновление, поломка и починка. Проверка — агентом, уборка — обязательна.', 'One real node on k3s with a Gateway and Helm, then a full kubeadm cluster on three VMs: Cilium, certificates, etcd, an upgrade, a break and a fix. The check is done by an agent, the cleanup is mandatory.'),
  checklistStep: '05',
  requires: ['k8s-1'],
  levels: {
    beginner: bi('Прошёл этап 1; идёт по полному чеклисту', 'Finished stage 1; follows the full checklist'),
    intermediate: bi('Прошёл этап 1; чеклист как каркас', 'Finished stage 1; the checklist as a skeleton'),
    experienced: bi('Прошёл этап 1; собирает с нуля по документации', 'Finished stage 1; builds from scratch with the documentation'),
  },
  hours: { beginner: 14, intermediate: 12, experienced: 10 },
  lessons: ['k8s-2.single-node', 'k8s-2.kubeadm'],
  sources: src([S.k3s, S.kubeadm, S.etcdRecovery], [R.installKubeadm, R.what]),
  docSources: ['kubernetes.io', 'help'],
  placement: [{ id: 'k8s2.place.1', level: 'experienced', key: true, concepts: ['k8s.kubeadm'], kind: 'quiz', item: { ...byId('k8s.q.real.etcdutl'), id: 'k8s2.place.q.etcdutl' } }],
};

export default defineModule({
  blocks: [stage1, stage2],
  lessons: [whyLesson, firstPodLesson, reconcileLesson, deploymentsLesson, architectureLesson, operatorsLesson, networkLesson, servicesLesson, dnsLesson, ingressLesson, troubleshootLesson, configLesson, healthLesson, helmLesson, singleNodeLesson, kubeadmLesson],
  concepts: CONCEPTS,
  quiz,
  explainers: [dispatchModel, reconcileModel, rollingModel, schedulerModel, applyPathModel, nodeDownModel, podNetworkModel, servicePathModel, ndotsModel, ingressPathModel].map((m) => fromModel(m as never)),
});
