// The Kubernetes block (05): stage 1 in the browser (k8s-1) and stage 2–3 on
// real machines (k8s-2). The engine — kube-lite, kubectl, the widgets — lives
// in src/engine/kube-lite; this module is the textbook on top of it.
// k8s-2 covers stage 2: one k3s node, then kubeadm on three real VMs.

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
import { realQuiz, singleNodeLesson } from './lessons/e-real';
import { KUBEADM_LESSONS, stage2Quiz } from './lessons/f-kubeadm';
import { placementFor } from './placement';
import { R, S, src } from './sources';

// The newer exams are a chunk of their own (see exams-extra.ts).
const { EXTRA_EXAMS } = await import('./exams-extra');

const quiz = [...whyQuiz, ...podQuiz, ...reconcileQuiz, ...deployQuiz, ...archQuiz, ...operatorQuiz, ...networkQuiz, ...serviceQuiz, ...dnsQuiz, ...ingressQuiz, ...netpolQuiz, ...troubleQuiz, ...configQuiz, ...healthQuiz, ...helmQuiz, ...realQuiz, ...stage2Quiz];
const placement = placementFor(quiz);

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
    'k8s-1.netpol',
    'k8s-1.troubleshoot',
    'k8s-1.config',
    'k8s-1.health',
    'k8s-1.helm',
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
  summary: bi('Один настоящий узел на k3s с Gateway и Helm, затем кластер kubeadm на трёх ВМ, которые вы заказываете сами: подготовка узлов, init и join, сертификаты и статические поды, Cilium, снимок и восстановление etcd, обновление, поломка и починка. Проверка — по фактам кластера и по выводу команд, уборка — обязательна.', 'One real node on k3s with a Gateway and Helm, then a kubeadm cluster on three VMs you order yourself: node preparation, init and join, certificates and static pods, Cilium, an etcd snapshot and restore, an upgrade, a break and a repair. The check is by the cluster’s facts and by command output, the cleanup is mandatory.'),
  checklistStep: '05',
  requires: ['k8s-1'],
  levels: {
    beginner: bi('Прошёл этап 1; идёт по полному чеклисту', 'Finished stage 1; follows the full checklist'),
    intermediate: bi('Прошёл этап 1; чеклист как каркас', 'Finished stage 1; the checklist as a skeleton'),
    experienced: bi('Прошёл этап 1; собирает с нуля по документации', 'Finished stage 1; builds from scratch with the documentation'),
  },
  hours: { beginner: 14, intermediate: 12, experienced: 10 },
  lessons: ['k8s-2.single-node', ...KUBEADM_LESSONS.map((l) => l.id)],
  sources: src([S.k3s, S.kubeadm, S.etcdRecovery, S.skew], [R.installKubeadm, R.what]),
  docSources: ['kubernetes.io', 'help'],
  placement: placement.stage2,
  exam: 'k8s-2.exam',
};

export default defineModule({
  blocks: [stage1, stage2],
  lessons: [whyLesson, firstPodLesson, reconcileLesson, deploymentsLesson, architectureLesson, operatorsLesson, networkLesson, servicesLesson, dnsLesson, ingressLesson, netpolLesson, troubleshootLesson, configLesson, healthLesson, helmLesson, singleNodeLesson, ...KUBEADM_LESSONS],
  concepts: CONCEPTS,
  quiz,
  explainers: [dispatchModel, reconcileModel, loopChainModel, rollingModel, schedulerModel, applyPathModel, nodeDownModel, podNetworkModel, servicePathModel, ndotsModel, ingressPathModel, netpolModel, kubeadmInitModel, tlsBootstrapModel, etcdRestoreModel, upgradeModel].map((m) => fromModel(m as never)),
  docs: STAGE2_DOCS,
  exams: [k8sExam, ...EXTRA_EXAMS],
});
