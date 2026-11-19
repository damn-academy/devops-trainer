// "Show what you know" for both Kubernetes blocks (01 §4, 05 §2). Beginners
// get the readiness check of 05 §2.1 (Docker and networks, not Kubernetes);
// Intermediate and Experienced get tasks on a training cluster checked by
// its facts, plus key questions. Retakes after 72 hours take variant 2.

import { bi } from '../../core/i18n';
import type { Facts, PlacementTask, QuizItem } from '../../core/types';
import type { K8sFacts } from '../../engine/kube-lite/facts';
import type { Obj } from '../../engine/kube-lite/util';
import { EXAM_SETUPS } from './exam';
import { DEPLOY_LAB, NETPOL_LAB, SERVICE_BROKEN, TROUBLE_LAB, ns } from './setups';

const k8s = (f: Facts) => f.k8s as K8sFacts;
const reach = (f: Facts, from: string, to: string) => k8s(f).reach?.find((r) => r.from === from && r.to === to)?.status ?? 0;

/** The bank, looked up by id; placement items get ids of their own so answers are not mixed with lesson answers. */
export function placementFor(quiz: QuizItem[]) {
  const pick = (id: string, as: string): QuizItem => ({ ...quiz.find((q) => q.id === id)!, id: as });

  const stage1: PlacementTask[] = [
    {
      id: 'k8s.place.b1',
      level: 'beginner',
      key: true,
      concepts: ['k8s.desired-state'],
      kind: 'quiz',
      item: {
        id: 'k8s.place.q.image',
        kind: 'mcq',
        prompt: bi('Чем образ отличается от контейнера?', 'How is an image different from a container?'),
        options: [
          { id: 'right', text: bi('Образ состоит из неизменяемых слоёв и настроек, а контейнер работает как процесс, запущенный из образа', 'An image is an immutable set of layers and settings; a container is a process started from it'), correct: true },
          { id: 'proc', text: bi('Образ работает как запущенный процесс, а контейнер лежит файлом на диске', 'An image is a running process, a container is a file on disk'), why: bi('Всё наоборот, потому что образ лежит в хранилище и ничего не делает, пока из него не запустили контейнер.', 'The other way round: an image sits in storage and does nothing until a container is started from it.') },
          { id: 'same', text: bi('Это одно и то же', 'They are the same thing'), why: bi('Из одного образа можно запустить сколько угодно контейнеров, значит, это разные вещи.', 'You can start any number of containers from one image — so they are different things.') },
        ],
        explain: bi('Без этого различия Kubernetes не объяснить, потому что под ссылается на образ, а kubelet запускает из этого образа контейнеры.', 'Kubernetes cannot be explained without this distinction: a pod refers to an image, and the kubelet starts containers from it.'),
      },
    },
    {
      id: 'k8s.place.b2',
      level: 'beginner',
      key: false,
      concepts: ['k8s.network-model'],
      kind: 'quiz',
      item: {
        id: 'k8s.place.q.ports',
        kind: 'mcq',
        prompt: bi('На сервере `ss -ltn` показывает `0.0.0.0:80` и `0.0.0.0:8080`. Что это значит?', 'On a server `ss -ltn` shows `0.0.0.0:80` and `0.0.0.0:8080`. What does it mean?'),
        options: [
          { id: 'right', text: bi('Это два слушающих сокета на всех адресах машины, и к ним обращаются по разным портам', 'Two listening sockets on every address of the machine, reached by different ports'), correct: true },
          { id: 'ips', text: bi('У машины два IP-адреса', 'The machine has two IP addresses'), why: bi('0.0.0.0 означает «все адреса машины», а различаются здесь порты, а не адреса.', '0.0.0.0 means "every address of the machine"; what differs here is the ports, not the addresses.') },
          { id: 'one', text: bi('Это один и тот же сокет', 'The same socket'), why: bi('Сокет определяется адресом и портом, и раз порты разные, разные и сокеты.', 'A socket is defined by an address and a port; different ports — different sockets.') },
        ],
      },
    },
    { id: 'k8s.place.i1', level: 'intermediate', key: true, concepts: ['k8s.pod', 'k8s.replicaset'], kind: 'quiz', item: pick('k8s.q.pod.delete', 'k8s.place.q.delete') },
    { id: 'k8s.place.i2', level: 'intermediate', key: false, concepts: ['k8s.deployment'], kind: 'quiz', item: pick('k8s.q.dep.order', 'k8s.place.q.order') },
    {
      id: 'k8s.place.i3',
      level: 'intermediate',
      key: true,
      concepts: ['k8s.deployment', 'k8s.service', 'k8s.namespace'],
      kind: 'task',
      setup: { hostname: 'laptop', ext: { k8s: { manifests: [ns('shop'), 'apiVersion: v1\nkind: Pod\nmetadata:\n  name: client\n  namespace: shop\nspec:\n  containers:\n  - name: client\n    image: trainer/client:1.0\n'] } } },
      task: {
        id: 'shop',
        prompt: bi('Создайте в namespace `shop` Deployment `web` из образа `trainer/web:1.0` на три реплики и Service `web` на порту 80. Под `client` должен получать ответ по адресу `http://web.shop`.', 'In namespace `shop`: Deployment `web` from `trainer/web:1.0` with 3 replicas and Service `web` on port 80. Pod `client` must get an answer from `http://web.shop`.'),
        check: { when: "k8s.deployments[ns=shop][name=web].ready=3 && k8s.reach[from='shop/client'][to='web.shop'].status=200" },
      },
    },
    {
      id: 'k8s.place.i4',
      level: 'intermediate',
      key: false,
      variant: 1,
      concepts: ['k8s.rolling-update'],
      kind: 'task',
      setup: DEPLOY_LAB,
      task: {
        id: 'rollout',
        prompt: bi('Примените файл `~/web.yaml` и переведите Deployment `web` на образ `trainer/web:1.1`: все четыре пода должны работать на новой версии.', 'Apply `~/web.yaml` and move Deployment `web` to `trainer/web:1.1`: all 4 pods must run the new version.'),
        check: { when: "k8s.deployments[ns=default][name=web].image='trainer/web:1.1' && k8s.deployments[ns=default][name=web].updated=4 && k8s.deployments[ns=default][name=web].ready=4" },
      },
    },
    {
      id: 'k8s.place.i4b',
      level: 'intermediate',
      key: false,
      variant: 2,
      concepts: ['k8s.revision'],
      kind: 'task',
      setup: EXAM_SETUPS.rollback,
      task: {
        id: 'undo',
        prompt: bi('Deployment `web` обновили до версии, контейнеры которой аварийно завершаются сразу после запуска. Верните последнюю работавшую версию так, чтобы были готовы четыре пода.', 'Deployment `web` was rolled out to a version that crashes. Bring back the last working version: 4 ready pods.'),
        check: { when: "k8s.deployments[ns=default][name=web].image='trainer/web:1.1' && k8s.deployments[ns=default][name=web].ready>=4" },
      },
    },
    { id: 'k8s.place.i5', level: 'intermediate', key: false, concepts: ['k8s.cluster-dns'], kind: 'quiz', item: pick('k8s.q.dns.name', 'k8s.place.q.dns') },
    { id: 'k8s.place.i6', level: 'intermediate', key: false, concepts: ['k8s.ingress'], kind: 'quiz', item: pick('k8s.q.in.504', 'k8s.place.q.504') },
    { id: 'k8s.place.e1', level: 'experienced', key: true, concepts: ['k8s.clusterip', 'k8s.kube-proxy'], kind: 'quiz', item: pick('k8s.q.svc.ip', 'k8s.place.q.ip') },
    {
      id: 'k8s.place.e2',
      level: 'experienced',
      key: true,
      variant: 1,
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
    {
      id: 'k8s.place.e2b',
      level: 'experienced',
      key: true,
      variant: 2,
      concepts: ['k8s.service', 'k8s.networkpolicy'],
      kind: 'task',
      setup: TROUBLE_LAB,
      task: {
        id: 'ladder',
        prompt: bi('Под `client` в namespace `shop` не может обратиться ни к `web` в namespace shop, ни к `pay` в namespace pay. Почините оба пути, не пересоздавая поды и не удаляя политику в namespace pay.', 'Pod `client` in namespace `shop` reaches neither `web` (shop) nor `pay` (namespace pay). Fix both paths without recreating pods and without deleting the policy in pay.'),
        check: { when: "k8s.reach[from='shop/client'][to='web.shop'].status=200 && k8s.reach[from='shop/client'][to='pay.pay'].status=200 && k8s.objects[kind=NetworkPolicy][metadata.name=only-shop-frontend]#=1" },
      },
    },
    { id: 'k8s.place.e3', level: 'experienced', key: false, concepts: ['k8s.resources'], kind: 'quiz', item: pick('k8s.q.h.reason', 'k8s.place.q.oom') },
    {
      id: 'k8s.place.e4',
      level: 'experienced',
      key: true,
      concepts: ['k8s.node', 'k8s.scheduler'],
      kind: 'task',
      setup: EXAM_SETUPS.drain,
      task: {
        id: 'maint',
        prompt: bi('Выведите `worker-2` на обслуживание так, чтобы новых подов на нём не было, рабочих подов из namespace `default` тоже, а у `web` всё это время должно быть три готовых пода.', 'Take `worker-2` out for maintenance: no new pods may land on it, no workload pods of `default` may stay, and `web` keeps three ready pods all along.'),
        check: {
          when: (f) => {
            const k = k8s(f);
            return !!k.nodes.find((n) => n.name === 'worker-2')?.unschedulable && !k.pods.some((p) => p.ns === 'default' && p.node === 'worker-2' && p.owner) && (k.deployments.find((d) => d.name === 'web')?.ready ?? 0) >= 3;
          },
        },
      },
    },
    {
      id: 'k8s.place.e5',
      level: 'experienced',
      key: false,
      concepts: ['k8s.networkpolicy', 'k8s.default-deny'],
      kind: 'task',
      setup: NETPOL_LAB,
      task: {
        id: 'np',
        prompt: bi('Закройте namespace `pay` для всех, кроме подов с меткой role=frontend из namespace `shop`. Клиент из namespace `dev` с той же меткой должен остаться снаружи.', 'Close `pay` to everyone except role=frontend pods of namespace `shop`. The client from `dev` with the same label must stay outside.'),
        check: {
          when: (f) =>
            reach(f, 'shop/client', 'pay.pay') === 200 &&
            reach(f, 'dev/client', 'pay.pay') !== 200 &&
            k8s(f).objects.some((o) => o.kind === 'NetworkPolicy' && o.metadata?.namespace === 'pay' && (o.spec?.ingress ?? []).some((r: Obj) => (r.from ?? []).some((p: Obj) => p.namespaceSelector && p.podSelector))),
        },
      },
    },
    { id: 'k8s.place.e6', level: 'experienced', key: false, concepts: ['k8s.networkpolicy'], kind: 'quiz', item: pick('k8s.q.np.or', 'k8s.place.q.or') },
    { id: 'k8s.place.e7', level: 'experienced', key: false, concepts: ['k8s.networkpolicy', 'k8s.cni'], kind: 'quiz', item: pick('k8s.q.tr.cni', 'k8s.place.q.cni') },
  ];

  const stage2: PlacementTask[] = [
    { id: 'k8s2.place.i1', level: 'intermediate', key: true, concepts: ['k8s.cgroup-driver'], kind: 'quiz', item: pick('k8s.q.prep.cgroup', 'k8s2.place.q.cgroup') },
    { id: 'k8s2.place.i2', level: 'intermediate', key: false, concepts: ['k8s.kubeadm', 'k8s.static-pod'], kind: 'quiz', item: pick('k8s.q.real.static', 'k8s2.place.q.static') },
    { id: 'k8s2.place.i3', level: 'intermediate', key: false, concepts: ['k8s.cni'], kind: 'quiz', item: pick('k8s.q.cni.pending', 'k8s2.place.q.pending') },
    { id: 'k8s2.place.1', level: 'experienced', key: true, concepts: ['k8s.etcd-snapshot'], kind: 'quiz', item: pick('k8s.q.real.etcdutl', 'k8s2.place.q.etcdutl') },
    { id: 'k8s2.place.e2', level: 'experienced', key: true, concepts: ['k8s.tls-bootstrap'], kind: 'quiz', item: pick('k8s.q.adm.hash', 'k8s2.place.q.hash') },
    { id: 'k8s2.place.e3', level: 'experienced', key: true, concepts: ['k8s.version-skew'], kind: 'quiz', item: pick('k8s.q.up.skew', 'k8s2.place.q.skew') },
    { id: 'k8s2.place.e4', level: 'experienced', key: false, concepts: ['k8s.kubeadm', 'k8s.pki'], kind: 'quiz', item: pick('k8s.q.adm.phases', 'k8s2.place.q.phases') },
    { id: 'k8s2.place.e5', level: 'experienced', key: false, concepts: ['k8s.etcd-snapshot'], kind: 'quiz', item: pick('k8s.q.etcd.order', 'k8s2.place.q.restore') },
  ];
  return { stage1, stage2 };
}
