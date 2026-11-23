// The Kubernetes block (05): stage 1 in the browser (k8s-1) and stage 2–3 on
// real machines (k8s-2). The engine — kube-lite, kubectl, the widgets — lives
// in src/engine/kube-lite; this module is the textbook on top of it.
// k8s-2 covers stage 2: one kuberoot node (the local lab or your own VM), then kubeadm on three real VMs.

import { defineModule } from '../../core/define';
import { bi } from '../../core/i18n';
import type { Block } from '../../core/types';
import { fromModel } from '../../engine/explainer/render';
import { CONCEPTS } from './concepts';
import { STAGE2_DOCS } from './docs';
import { k8sExam } from './exam';
import { etcdRestoreModel } from './explainers/etcd-restore';
import { kubeadmInitModel } from './explainers/kubeadm-init';
import { loopChainModel } from './explainers/loop-chain';
import { netpolModel } from './explainers/netpol';
import { tlsBootstrapModel } from './explainers/tls-bootstrap';
import { upgradeModel } from './explainers/upgrade';
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
import { netpolLesson, netpolQuiz } from './lessons/c2-netpol';
import { addonsLesson, addonsQuiz } from './lessons/g-addons';
import { storageLesson, storageQuiz } from './lessons/h-storage';
import { scalingLesson, scalingQuiz } from './lessons/i-scaling';
import { accessLesson, accessQuiz } from './lessons/j-access';
import { realQuiz, singleNodeLesson } from './lessons/e-real';
import { KUBEADM_LESSONS, stage2Quiz } from './lessons/f-kubeadm';
import { placementFor } from './placement';
import { R, S, src } from './sources';

// The newer exams are a chunk of their own (see exams-extra.ts).
const { EXTRA_EXAMS } = await import('./exams-extra');

const quiz = [...whyQuiz, ...podQuiz, ...reconcileQuiz, ...deployQuiz, ...archQuiz, ...operatorQuiz, ...networkQuiz, ...serviceQuiz, ...dnsQuiz, ...ingressQuiz, ...netpolQuiz, ...troubleQuiz, ...configQuiz, ...storageQuiz, ...healthQuiz, ...scalingQuiz, ...helmQuiz, ...accessQuiz, ...addonsQuiz, ...realQuiz, ...stage2Quiz];
const placement = placementFor(quiz);

const stage1: Block = {
  id: 'k8s-1',
  order: 60,
  title: bi('Kubernetes, этап 1', 'Kubernetes, stage 1'),
  summary: bi(
    'Вы соберёте Kubernetes из блоков на кластере в браузере: узнаете, как работает цикл согласования, что такое поды и Deployment, как планировщик и kubelet запускают поды и что делает оператор. Вы научитесь настраивать поды, хранить их данные, следить за их здоровьем и масштабировать под нагрузкой, разберёте, как устроена сеть Kubernetes от пода до входа снаружи, и узнаете, кто с какими правами работает с кластером.',
    'You assemble Kubernetes from blocks on a cluster in the browser: you learn how the reconcile loop works, what pods and Deployments are, how the scheduler and the kubelet start pods and what an operator does. You learn to configure pods, keep their data, watch their health and scale them under load, see how the Kubernetes network is built from a pod to the entry from outside, and find out who works with the cluster and with which rights.',
  ),
  checklistStep: '05',
  requires: ['containers'],
  levels: {
    beginner: bi('Прошёл блок «Контейнеры» нашего курса, но кластера не видел', 'Has done our Containers block, never seen a cluster'),
    intermediate: bi('Запускал kubectl apply по инструкции', 'kubectl apply by instructions'),
    experienced: bi('Сам пишу манифесты и готовлюсь к уровню CKA', 'Writes manifests, aims at CKA level'),
  },
  hours: { beginner: 87, intermediate: 55, experienced: 32 },
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
    'k8s-1.netpol',
    'k8s-1.troubleshoot',
    'k8s-1.config',
    'k8s-1.storage',
    'k8s-1.health',
    'k8s-1.scaling',
    'k8s-1.helm',
    'k8s-1.access',
    'k8s-1.addons',
  ],
  sources: src([S.overview, S.components, S.networking, S.kubectl], [R.what, R.components, R.cheatsheet]),
  docSources: ['kubectl-explain', 'help', 'kubernetes.io'],
  placement: placement.stage1,
  exam: k8sExam.id,
};

const stage2: Block = {
  id: 'k8s-2',
  order: 70,
  title: bi('Kubernetes, этап 2: настоящие машины', 'Kubernetes, stage 2: real machines'),
  summary: bi('Сначала вы запустите один настоящий узел kuberoot в локальной лаборатории курса или на своей машине: поставите через Helm контроллер входа с поддержкой Gateway API и приложение, запустите базу данных в StatefulSet и проверите права доступа. Затем вы соберёте кластер kubeadm на трёх виртуальных машинах, которые закажете сами: подготовите узлы, выполните init и join, разберётесь с сертификатами и статическими подами, настроите сеть Cilium, сделаете снимок etcd и восстановите кластер из него, обновите кластер, а в конце намеренно сломаете его и почините. Результат проверяется по фактам кластера и по выводу команд, а уборка в конце обязательна.', 'First you run one real kuberoot node in the course’s local lab or on your own machine: you install an ingress controller with the Gateway API and an application with Helm, run a database in a StatefulSet and check access rights. Then you build a kubeadm cluster on three virtual machines you order yourself: you prepare the nodes, run init and join, work through certificates and static pods, set up the Cilium network, take an etcd snapshot and restore the cluster from it, upgrade the cluster, and at the end you break it on purpose and repair it. The check is by the cluster’s facts and by command output, and the cleanup at the end is mandatory.'),
  checklistStep: '05',
  requires: ['k8s-1'],
  levels: {
    beginner: bi('Кластера своими руками ещё не ставил и иду по полному чеклисту', 'Has never installed a cluster by hand; follows the full checklist'),
    intermediate: bi('Ставил одноузловой кластер вроде k3s, kind или minikube, но kubeadm не запускал', 'Has installed a one-node cluster such as k3s, kind or minikube, never ran kubeadm'),
    experienced: bi('Собирал кластер через kubeadm и восстанавливал etcd из снимка', 'Has built a cluster with kubeadm and restored etcd from a snapshot'),
  },
  hours: { beginner: 14, intermediate: 12, experienced: 10 },
  lessons: ['k8s-2.single-node', ...KUBEADM_LESSONS.map((l) => l.id)],
  sources: src([S.kuberoot, S.kubeadm, S.etcdRecovery, S.skew], [R.installKubeadm, R.what]),
  docSources: ['kubernetes.io', 'help'],
  placement: placement.stage2,
  exam: 'k8s-2.exam',
};

export default defineModule({
  blocks: [stage1, stage2],
  lessons: [whyLesson, firstPodLesson, reconcileLesson, deploymentsLesson, architectureLesson, operatorsLesson, networkLesson, servicesLesson, dnsLesson, ingressLesson, netpolLesson, troubleshootLesson, configLesson, storageLesson, healthLesson, scalingLesson, helmLesson, accessLesson, addonsLesson, singleNodeLesson, ...KUBEADM_LESSONS],
  concepts: CONCEPTS,
  quiz,
  explainers: [dispatchModel, reconcileModel, loopChainModel, rollingModel, schedulerModel, applyPathModel, nodeDownModel, podNetworkModel, servicePathModel, ndotsModel, ingressPathModel, netpolModel, kubeadmInitModel, tlsBootstrapModel, etcdRestoreModel, upgradeModel].map((m) => fromModel(m as never)),
  docs: STAGE2_DOCS,
  exams: [k8sExam, ...EXTRA_EXAMS],
});
