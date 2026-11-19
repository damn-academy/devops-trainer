// The stage-1 block exam (05 §10.2, 10 §6): a shift on a cluster, run on
// kube-lite. Cards "from the tracker", every task checked by the cluster's
// facts; the documentation reader is limited to kubectl explain, --help and
// the kubernetes.io snapshots (DL5), the AI is off. Pools give each retake
// another fault; two tasks need a field the lessons did not teach.

import { bi } from '../../core/i18n';
import type { Exam, Facts, TerminalSetup } from '../../core/types';
import type { K8sFacts } from '../../engine/kube-lite/facts';
import type { Obj } from '../../engine/kube-lite/util';
import { CLIENT_POD, DNS_BROKEN, EXAM_LIKE, NETPOL_LAB, SERVICE_BROKEN, WEB_DEPLOY, client, deploy, ns, svc } from './setups';

const k8s = (f: Facts) => f.k8s as K8sFacts;
const reach = (f: Facts, from: string, to: string) => k8s(f).reach?.find((r) => r.from === from && r.to === to)?.status ?? 0;
const podUids = (f: Facts | undefined, nsName: string, app: string) => (f ? k8s(f).pods.filter((p) => p.ns === nsName && p.labels.app === app).map((p) => p.uid).sort().join() : '');
const obj = (f: Facts, kind: string, nsName: string, name: string): Obj | undefined => k8s(f).objects.find((o) => o.kind === kind && o.metadata?.namespace === nsName && o.metadata?.name === name);

export const EXAM_SETUPS = {
  store: { hostname: 'laptop', ext: { k8s: { manifests: [ns('store'), client('store')] } } } as TerminalSetup,
  svcPort: { hostname: 'laptop', ext: { k8s: { manifests: [ns('prod'), deploy('api', 'prod', 2, 'trainer/web:1.0', { app: 'api' }), svc('api', 'prod', { app: 'api' }, 80, 8080), client('prod')] } } } as TerminalSetup,
  rollback: { hostname: 'laptop', ext: { k8s: { manifests: [WEB_DEPLOY, WEB_DEPLOY.replace('trainer/web:1.0', 'trainer/web:1.1'), WEB_DEPLOY.replace('trainer/web:1.0', 'trainer/web:2.0')], settle: 120_000 } } } as TerminalSetup,
  drain: { hostname: 'laptop', ext: { k8s: { manifests: [deploy('web', 'default', 3, 'trainer/web:1.0', { app: 'web' }), CLIENT_POD] } } } as TerminalSetup,
  config: { hostname: 'laptop', ext: { k8s: { manifests: [deploy('web', 'default', 2, 'trainer/web:1.0', { app: 'web' })] } } } as TerminalSetup,
};

export const k8sExam: Exam = {
  id: 'k8s-1.exam',
  block: 'k8s-1',
  title: bi('Смена в кластере', 'A shift on the cluster'),
  intro: bi(
    'Девять карточек из трекера, у каждой свой кластер. Сначала разберитесь, что сломано и на какой ступени, потом чините — так, как написано в карточке: где сказано «не пересоздавая», пересоздание не засчитывается. Открыты только `kubectl explain`, справка `--help` и страницы kubernetes.io; наставник выключен. Задания проверяются по состоянию кластера, а не по набранным командам.',
    'Nine cards from the tracker, each with its own cluster. First work out what is broken and on which step, then fix it — the way the card says: where it says "without recreating", recreating does not count. Only `kubectl explain`, the `--help` output and the kubernetes.io pages are open; the mentor is off. Tasks are checked by the state of the cluster, not by the commands typed.',
  ),
  story: bi(
    'Вы — дежурный инженер платформенной команды интернет-магазина. За смену в трекер пришли карточки от команд каталога, платежей и аналитики. Кластер тренировочный, но все ошибки в нём — из настоящих разборов инцидентов.',
    'You are the on-call engineer of an online shop’s platform team. During the shift, cards came into the tracker from the catalogue, payments and analytics teams. The cluster is a training one, but every fault in it comes from real incident reviews.',
  ),
  minutes: 90,
  pass: 0.7,
  allowedDocs: ['kubectl-explain', 'help', 'kubernetes.io'],
  tasks: [
    {
      id: 'deploy',
      weight: 1,
      critical: true,
      kind: 'task',
      setup: EXAM_SETUPS.store,
      task: {
        id: 'x-deploy',
        prompt: bi('«Каталогу нужен свой сервис»: в namespace `store` — Deployment `catalog` из `trainer/web:1.1` на 3 реплики и Service `catalog` на порту 80. Под `client` из `store` должен получать ответ по `http://catalog`.', '“The catalogue needs its service”: in namespace `store` — a Deployment `catalog` from `trainer/web:1.1` with 3 replicas and a Service `catalog` on port 80. Pod `client` in `store` must get an answer from `http://catalog`.'),
        check: { when: "k8s.deployments[ns=store][name=catalog].ready=3 && k8s.deployments[ns=store][name=catalog].image='trainer/web:1.1' && k8s.reach[from='store/client'][to='catalog.store'].status=200" },
        concepts: ['k8s.deployment', 'k8s.service'],
      },
    },
    {
      id: 'svc-selector',
      pool: 'svc',
      weight: 1,
      critical: true,
      kind: 'task',
      setup: SERVICE_BROKEN,
      task: {
        id: 'x-svc-selector',
        prompt: bi('«API платежей молчит»: Service `api` в namespace `prod` не отвечает. Почините, не пересоздавая поды.', '“The payments API is silent”: Service `api` in namespace `prod` does not answer. Fix it without recreating the pods.'),
        check: { when: (f, start) => reach(f, 'prod/client', 'api.prod') === 200 && (!start || podUids(f, 'prod', 'api-v2') === podUids(start, 'prod', 'api-v2')) },
        concepts: ['k8s.service', 'k8s.endpointslice'],
      },
    },
    {
      id: 'svc-port',
      pool: 'svc',
      weight: 1,
      critical: true,
      kind: 'task',
      setup: EXAM_SETUPS.svcPort,
      task: {
        id: 'x-svc-port',
        prompt: bi('«API платежей молчит»: Service `api` в namespace `prod` не отвечает. Почините, не пересоздавая поды.', '“The payments API is silent”: Service `api` in namespace `prod` does not answer. Fix it without recreating the pods.'),
        check: { when: (f, start) => reach(f, 'prod/client', 'api.prod') === 200 && (!start || podUids(f, 'prod', 'api') === podUids(start, 'prod', 'api')) },
        concepts: ['k8s.service'],
      },
    },
    {
      id: 'rollback',
      weight: 1,
      kind: 'task',
      setup: EXAM_SETUPS.rollback,
      task: {
        id: 'x-rollback',
        prompt: bi('«После выкатки сайт наполовину лежит»: Deployment `web` выкатили на новую версию, и она падает. Верните последнюю работающую версию, не удаляя Deployment: все 4 пода должны быть готовы.', '“Half the site is down after the rollout”: Deployment `web` was rolled out to a new version, and it crashes. Bring back the last working version without deleting the Deployment: all 4 pods must be ready.'),
        check: {
          when: (f, start) => {
            const d = k8s(f).deployments.find((x) => x.ns === 'default' && x.name === 'web');
            const uid = (x?: Facts) => (x ? obj(x, 'Deployment', 'default', 'web')?.metadata?.uid : undefined);
            return !!d && d.ready >= 4 && d.image === 'trainer/web:1.1' && (!start || uid(f) === uid(start));
          },
          fail: [{ if: (f) => k8s(f).deployments.find((x) => x.name === 'web')?.image === 'trainer/web:1.0', say: bi('1.0 работает, но последняя работающая версия — 1.1. Посмотрите историю выкаток.', '1.0 works, but the last working version is 1.1. Look at the rollout history.') }],
        },
        concepts: ['k8s.revision', 'k8s.rolling-update'],
      },
    },
    {
      id: 'drain',
      weight: 1,
      kind: 'task',
      setup: EXAM_SETUPS.drain,
      task: {
        id: 'x-drain',
        prompt: bi('«Плановая замена диска на worker-2»: выведите узел на обслуживание — новых подов на нём быть не должно, рабочих подов из namespace `default` тоже. `web` при этом должен оставаться с тремя готовыми подами.', '“A planned disk replacement on worker-2”: take the node out for maintenance — no new pods may land on it, and no workload pods of namespace `default` may stay there. `web` must keep three ready pods meanwhile.'),
        check: {
          when: (f) => {
            const k = k8s(f);
            const node = k.nodes.find((n) => n.name === 'worker-2');
            return !!node?.unschedulable && !k.pods.some((p) => p.ns === 'default' && p.node === 'worker-2' && p.owner) && (k.deployments.find((d) => d.name === 'web')?.ready ?? 0) >= 3;
          },
        },
        concepts: ['k8s.node', 'k8s.scheduler'],
      },
    },
    {
      id: 'dns',
      weight: 1,
      kind: 'task',
      setup: DNS_BROKEN,
      task: {
        id: 'x-dns',
        prompt: bi('«Ничего не открывается по имени»: под `client` в `shop` не может достучаться до `web` по имени. По IP всё работает. Почините кластер.', '“Nothing opens by name”: pod `client` in `shop` cannot reach `web` by name. By IP everything works. Fix the cluster.'),
        check: { when: "k8s.reach[from='shop/client'][to='web.shop'].status=200" },
        concepts: ['k8s.cluster-dns'],
      },
    },
    {
      id: 'pending',
      weight: 1,
      kind: 'task',
      setup: EXAM_LIKE,
      task: {
        id: 'x-pending',
        prompt: bi('«Отчёт аналитики не запускается»: под `report` в namespace `exam` не стартует. Добейтесь, чтобы он работал.', '“The analytics report does not start”: pod `report` in namespace `exam` does not start. Get it running.'),
        check: { when: 'k8s.pods[ns=exam][name=report].ready=true' },
        concepts: ['k8s.events', 'k8s.pod'],
      },
    },
    {
      id: 'config',
      weight: 1,
      kind: 'task',
      setup: EXAM_SETUPS.config,
      task: {
        id: 'x-config',
        prompt: bi('«Приветствие должно настраиваться без пересборки»: создайте ConfigMap `web-config` с ключом `GREETING=Hello` и подключите его к Deployment `web` переменными окружения. Оба пода должны работать с новой настройкой.', '“The greeting must be configurable without a rebuild”: create a ConfigMap `web-config` with the key `GREETING=Hello` and attach it to Deployment `web` as environment variables. Both pods must run with the new setting.'),
        check: {
          when: (f) => {
            const cm = obj(f, 'ConfigMap', 'default', 'web-config');
            const d = obj(f, 'Deployment', 'default', 'web');
            const cts: Obj[] = d?.spec?.template?.spec?.containers ?? [];
            const uses = cts.some((c) => (c.envFrom ?? []).some((e: Obj) => e.configMapRef?.name === 'web-config') || (c.env ?? []).some((e: Obj) => e.valueFrom?.configMapKeyRef?.name === 'web-config'));
            const dep = k8s(f).deployments.find((x) => x.name === 'web');
            return cm?.data?.GREETING === 'Hello' && uses && !!dep && dep.updated >= 2 && dep.ready >= 2;
          },
        },
        concepts: ['k8s.configmap'],
      },
    },
    {
      id: 'netpol',
      weight: 1,
      beyond: true,
      kind: 'task',
      setup: NETPOL_LAB,
      task: {
        id: 'x-netpol',
        prompt: bi('«Платёжный сервис должен быть доступен только магазину»: в `pay` пускать только поды из namespace `shop` (из любого другого namespace — нет). Политики пишите сами; удалять поды нельзя.', '“The payment service must be reachable by the shop only”: let into `pay` only pods from namespace `shop` (none from any other namespace). Write the policies yourself; deleting pods is not allowed.'),
        check: { when: (f) => reach(f, 'shop/client', 'pay.pay') === 200 && reach(f, 'dev/client', 'pay.pay') !== 200 && k8s(f).pods.filter((p) => p.name === 'client').length >= 2 },
        docStep: 5,
        beyond: true,
        solutionTokens: ['namespaceSelector', 'kubernetes.io/metadata.name'],
        concepts: ['k8s.networkpolicy'],
      },
    },
    {
      id: 'grace',
      weight: 1,
      beyond: true,
      kind: 'task',
      setup: EXAM_SETUPS.config,
      task: {
        id: 'x-grace',
        prompt: bi('«Выкатка ждёт полминуты на каждом поде»: приложение `web` завершается за секунду, а Kubernetes ждёт его 30 секунд. Найдите в документации поле пода, которое задаёт это время, и поставьте 5 секунд в шаблоне Deployment `web`.', '“A rollout waits half a minute on every pod”: the `web` application exits in a second, but Kubernetes waits 30 seconds for it. Find in the documentation the pod field that sets this time and set 5 seconds in the template of Deployment `web`.'),
        check: { when: 'k8s.objects[kind=Deployment][metadata.name=web].spec.template.spec.terminationGracePeriodSeconds=5' },
        docStep: 5,
        beyond: true,
        solutionTokens: ['terminationGracePeriodSeconds'],
        concepts: ['k8s.pod'],
      },
    },
  ],
  explain: [
    { id: 'loop', prompt: bi('Под удалили руками, а через секунду появился новый. Объясните, кто и почему его создал.', 'A pod was deleted by hand, and a second later a new one appeared. Explain who created it and why.'), keyPoints: [bi('ReplicaSet хранит желаемое число подов', 'The ReplicaSet holds the desired number of pods'), bi('контроллер ReplicaSet сравнивает желаемое с фактическим и создаёт недостающее', 'the ReplicaSet controller compares desired with actual and creates what is missing'), bi('он смотрит на состояние, а не на события: удаление — просто новая разница', 'it looks at the state, not at events: the deletion is just a new difference')] },
    { id: 'clusterip', prompt: bi('Где «живёт» ClusterIP Service и что происходит с пакетом, отправленным на него?', 'Where does a Service ClusterIP "live", and what happens to a packet sent to it?'), keyPoints: [bi('ни на одном интерфейсе: только в правилах kube-proxy в ядре каждого узла', 'on no interface: only in kube-proxy’s rules in the kernel of every node'), bi('пакет получает DNAT на IP одного из готовых подов из EndpointSlice', 'the packet is DNATed to the IP of one of the ready pods from the EndpointSlice'), bi('ответ переводится обратно через conntrack', 'the reply is translated back through conntrack')] },
    { id: 'node', prompt: bi('Узел с тремя подами внезапно выключился. Расскажите, что и когда произойдёт.', 'A node with three pods suddenly powered off. Tell what will happen and when.'), keyPoints: [bi('kubelet перестаёт продлевать Lease; примерно через 40–50 секунд узел NotReady', 'the kubelet stops renewing its Lease; after about 40–50 seconds the node is NotReady'), bi('узел получает taint, и через 5 минут поды с него выселяются', 'the node gets a taint, and after 5 minutes its pods are evicted'), bi('ReplicaSet создаёт замену на других узлах; одиночный под без хозяина не вернётся', 'the ReplicaSet creates replacements on other nodes; a lone pod with no owner does not come back')] },
  ],
};
