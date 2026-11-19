// The CKA-style exam of stage 1 (05 §10.2, exam E; 10 §6): sixteen practical
// tasks on kube-lite, 120 minutes, pass at 66%, no critical tasks — the shape
// of the Linux Foundation exam, not its content. Each task has its own small
// cluster; the documentation reader is limited to `kubectl explain`, `--help`
// and the kubernetes.io snapshots (DL5), the mentor is off. Three tasks (a
// quarter of the weight) need fields the lessons never showed. This is the
// optional `pro` part of the block: the block exam stays k8s-1.exam.

import { bi } from '../../core/i18n';
import type { Exam, Facts, TerminalSetup } from '../../core/types';
import type { K8sFacts } from '../../engine/kube-lite/facts';
import type { Obj } from '../../engine/kube-lite/util';
import { WEB_DEPLOY, client, deploy, ns, svc } from './setups';

const k8s = (f: Facts) => f.k8s as K8sFacts;
const obj = (f: Facts | undefined, kind: string, nsName: string | undefined, name: string): Obj | undefined =>
  f ? k8s(f).objects.find((o) => o.kind === kind && o.metadata?.name === name && (nsName === undefined || (o.metadata?.namespace ?? '') === nsName)) : undefined;
const dep = (f: Facts, nsName: string, name: string) => k8s(f).deployments.find((d) => d.ns === nsName && d.name === name);
const uid = (f: Facts | undefined, kind: string, nsName: string, name: string) => obj(f, kind, nsName, name)?.metadata?.uid;
const sameObject = (f: Facts, start: Facts | undefined, kind: string, nsName: string, name: string) => !start || (!!uid(f, kind, nsName, name) && uid(f, kind, nsName, name) === uid(start, kind, nsName, name));
const containers = (o: Obj | undefined): Obj[] => o?.spec?.template?.spec?.containers ?? o?.spec?.containers ?? [];
const reach = (f: Facts, from: string, to: string) => k8s(f).reach?.find((r) => r.from === from && r.to === to)?.status ?? 0;
const ownedPods = (f: Facts, nsName: string, owner: string) => k8s(f).pods.filter((p) => p.ns === nsName && p.owner === owner);
const decode = (s: string | undefined) => {
  try {
    return s === undefined ? undefined : atob(s);
  } catch {
    return undefined;
  }
};
/** '512Mi', '1Gi', '300M' → MiB. */
export function mebibytes(q: unknown): number {
  const m = /^(\d+(?:\.\d+)?)(Ki|Mi|Gi|K|M|G)?$/.exec(String(q ?? ''));
  if (!m) return 0;
  const n = Number(m[1]);
  const mul: Record<string, number> = { Ki: 1 / 1024, Mi: 1, Gi: 1024, K: 1000 / 1048576, M: 1e6 / 1048576, G: 1e9 / 1048576 };
  return m[2] ? n * mul[m[2]] : n / 1048576;
}

const setup = (manifests: string[], extra: Partial<TerminalSetup> & { k8s?: Record<string, unknown> } = {}): TerminalSetup => {
  const { k8s: k, ...rest } = extra;
  return { hostname: 'cka', ...rest, ext: { k8s: { manifests, ...(k ?? {}) } } };
};

const PROBE_DEPLOY = (path: string, port: number) =>
  deploy('shop', 'shop', 2, 'trainer/web:1.0', { app: 'shop' }).replace(
    '        - containerPort: 80\n',
    `        - containerPort: 80\n        readinessProbe:\n          httpGet:\n            path: ${path}\n            port: ${port}\n          periodSeconds: 5\n`,
  );

const CACHE = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: cache
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cache
  template:
    metadata:
      labels:
        app: cache
    spec:
      containers:
      - name: cache
        image: trainer/hog:1.0
        env:
        - name: MEM_MB
          value: "300"
        resources:
          requests:
            memory: 128Mi
          limits:
            memory: 256Mi
`;

const SLOW_START = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: catalog
spec:
  replicas: 2
  selector:
    matchLabels:
      app: catalog
  template:
    metadata:
      labels:
        app: catalog
    spec:
      containers:
      - name: catalog
        image: trainer/web:2.1
        ports:
        - containerPort: 80
        livenessProbe:
          httpGet:
            path: /healthz
            port: 80
          periodSeconds: 5
          failureThreshold: 3
`;

const IMPORT_JOB = `apiVersion: batch/v1
kind: Job
metadata:
  name: import
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: import
        image: trainer/job:1.0
        env:
        - name: DURATION
          value: "3600"
`;

const API_DEPLOY = deploy('api', 'default', 2, 'trainer/web:1.0', { app: 'api' });

const history = (images: string[]) => images.map((img) => WEB_DEPLOY.replace('trainer/web:1.0', img));

export const CKA_SETUPS = {
  empty: setup([]),
  web3: setup([deploy('web', 'default', 3, 'trainer/web:1.0', { app: 'web' })]),
  rolling: setup([WEB_DEPLOY]),
  undo: setup(history(['trainer/web:1.0', 'trainer/web:1.1', 'trainer/web:2.0']), { k8s: { settle: 120_000 } }),
  nodes: setup([]),
  daemon: setup([], { k8s: { controlPlaneTaint: true } }),
  secret: setup([API_DEPLOY]),
  cache: setup([CACHE]),
  probePath: setup([ns('shop'), PROBE_DEPLOY('/readyz', 80), svc('shop', 'shop', { app: 'shop' }), client('shop')]),
  probePort: setup([ns('shop'), PROBE_DEPLOY('/ready', 8080), svc('shop', 'shop', { app: 'shop' }), client('shop')]),
  image: setup([ns('orders'), deploy('orders-api', 'orders', 2, 'trainer/web:1.10', { app: 'orders-api' })]),
  ingress: setup([deploy('web', 'default', 2, 'trainer/web:1.0', { app: 'web' }), svc('web', 'default', { app: 'web' })]),
  slow: setup([SLOW_START], { k8s: { settle: 30_000 } }),
  batch: setup([]),
  deadline: setup([], { files: [{ path: '~/import.yaml', content: IMPORT_JOB }] }),
  limit: setup(history(['trainer/web:8080', 'trainer/web:2.1', 'trainer/web:1.0', 'trainer/web:1.1']), { k8s: { settle: 180_000 } }),
};

export const ckaExam: Exam = {
  id: 'k8s-1.exam.cka',
  block: 'k8s-1',
  title: bi('Практика в духе CKA', 'A CKA-style practical'),
  intro: bi(
    'Шестнадцать задач на 120 минут, как на экзамене Certified Kubernetes Administrator: у каждой свой кластер, каждая проверяется по состоянию кластера, а не по набранным командам. Порог — 66%, критических задач нет, но веса разные. Три задачи требуют полей, которых не было в уроках: их ищут в `kubectl explain` и на страницах kubernetes.io, как на настоящем экзамене. Это необязательная часть блока: зачётным остаётся экзамен «Смена в кластере».',
    'Sixteen tasks in 120 minutes, as at the Certified Kubernetes Administrator exam: each has its own cluster, each is checked by the state of the cluster, not by the commands typed. The pass mark is 66%, there are no critical tasks, but the weights differ. Three tasks need fields the lessons never showed: you look them up in `kubectl explain` and on the kubernetes.io pages, as at the real exam. This is an optional part of the block: the block exam is still “A shift on the cluster”.',
  ),
  story: bi(
    'Вас взяли администратором кластера в компанию, где до этого кластером занимались все понемногу. Первая неделя — шестнадцать заявок от команд, по одной на кластер. Задачи независимы: начинайте с тех, что знаете, и не застревайте на одной дольше десяти минут.',
    'You have been hired as the cluster administrator at a company where everybody looked after the cluster a little until now. The first week brings sixteen requests from the teams, one per cluster. The tasks are independent: start with the ones you know and do not get stuck on one for longer than ten minutes.',
  ),
  minutes: 120,
  pass: 0.66,
  retakeHours: 72,
  allowedDocs: ['kubectl-explain', 'help', 'kubernetes.io'],
  tasks: [
    {
      id: 'deploy',
      weight: 2,
      kind: 'task',
      setup: CKA_SETUPS.empty,
      task: {
        id: 'cka-deploy',
        prompt: bi(
          'Команда биллинга просит своё пространство: создайте namespace `billing` и в нём Deployment `invoice` из образа `trainer/web:1.1` на три реплики. У подов должны быть метки `app=invoice` и `tier=backend`, контейнер слушает порт 80.',
          'The billing team asks for its own space: create namespace `billing` and in it a Deployment `invoice` from the image `trainer/web:1.1` with three replicas. The pods must carry the labels `app=invoice` and `tier=backend`; the container listens on port 80.',
        ),
        check: {
          when: (f) => {
            const d = dep(f, 'billing', 'invoice');
            const labels = obj(f, 'Deployment', 'billing', 'invoice')?.spec?.template?.metadata?.labels ?? {};
            return !!d && d.ready >= 3 && d.image === 'trainer/web:1.1' && labels.app === 'invoice' && labels.tier === 'backend';
          },
          fail: [{ if: (f) => !!dep(f, 'billing', 'invoice') && !obj(f, 'Deployment', 'billing', 'invoice')?.spec?.template?.metadata?.labels?.tier, say: bi('Deployment есть, но в шаблоне пода нет метки tier=backend. Метки подов задаются в spec.template.metadata.labels.', 'The Deployment exists, but the pod template has no tier=backend label. Pod labels live in spec.template.metadata.labels.') }],
        },
        concepts: ['k8s.deployment', 'k8s.namespace', 'k8s.label'],
      },
    },
    {
      id: 'nodeport',
      weight: 2,
      kind: 'task',
      setup: CKA_SETUPS.web3,
      task: {
        id: 'cka-nodeport',
        prompt: bi(
          'Внешний балансировщик ходит на узлы по порту 30080. Опубликуйте Deployment `web` сервисом `web-public` типа NodePort: порт сервиса 80, порт на узлах — ровно 30080. За сервисом должны стоять все три пода.',
          'The external load balancer comes to the nodes on port 30080. Publish Deployment `web` as a Service `web-public` of type NodePort: service port 80, node port exactly 30080. All three pods must stand behind the Service.',
        ),
        check: {
          when: (f) => {
            const s = obj(f, 'Service', 'default', 'web-public');
            const sf = k8s(f).services.find((x) => x.ns === 'default' && x.name === 'web-public');
            return s?.spec?.type === 'NodePort' && (s.spec.ports ?? []).some((p: Obj) => p.port === 80 && p.nodePort === 30080) && (sf?.endpoints ?? 0) >= 3;
          },
          fail: [
            { if: (f) => !!obj(f, 'Service', 'default', 'web-public') && obj(f, 'Service', 'default', 'web-public')?.spec?.type !== 'NodePort', say: bi('Сервис есть, но не NodePort: снаружи на узлы до него не достучаться.', 'The Service exists but is not a NodePort: nobody outside can reach it on the nodes.') },
            { if: (f) => (k8s(f).services.find((x) => x.name === 'web-public')?.endpoints ?? 1) === 0, say: bi('У сервиса нет конечных точек: селектор не совпадает с метками подов web.', 'The Service has no endpoints: its selector does not match the labels of the web pods.') },
          ],
        },
        concepts: ['k8s.service', 'k8s.nodeport'],
      },
    },
    {
      id: 'rolling',
      weight: 2,
      kind: 'task',
      setup: CKA_SETUPS.rolling,
      task: {
        id: 'cka-rolling',
        prompt: bi(
          'Выкатите Deployment `web` на `trainer/web:1.1` так, чтобы во время выкатки ни на секунду не становилось меньше четырёх готовых подов, а лишним мог быть только один. Deployment не пересоздавать.',
          'Roll Deployment `web` out to `trainer/web:1.1` so that during the rollout there are never fewer than four ready pods, with at most one extra. Do not recreate the Deployment.',
        ),
        check: {
          when: (f, start) => {
            const d = dep(f, 'default', 'web');
            const ru = obj(f, 'Deployment', 'default', 'web')?.spec?.strategy?.rollingUpdate ?? {};
            return !!d && d.image === 'trainer/web:1.1' && d.ready >= 4 && d.updated >= 4 && String(ru.maxUnavailable) === '0' && String(ru.maxSurge) === '1' && sameObject(f, start, 'Deployment', 'default', 'web');
          },
          fail: [{ if: (f) => dep(f, 'default', 'web')?.image === 'trainer/web:1.1' && String(obj(f, 'Deployment', 'default', 'web')?.spec?.strategy?.rollingUpdate?.maxUnavailable) !== '0', say: bi('Версия новая, но стратегия прежняя: maxUnavailable: 1 разрешает терять один готовый под. Нужно 0.', 'The version is new but the strategy is the old one: maxUnavailable: 1 allows losing one ready pod. It must be 0.') }],
        },
        concepts: ['k8s.rolling-update'],
      },
    },
    {
      id: 'undo',
      weight: 2,
      kind: 'task',
      setup: CKA_SETUPS.undo,
      task: {
        id: 'cka-undo',
        prompt: bi(
          'Аудиторы требуют, чтобы Deployment `web` работал ровно на той версии, с которой он начинался, — на первой ревизии из истории выкаток. Верните её, не удаляя Deployment; все четыре пода должны быть готовы.',
          'The auditors require Deployment `web` to run exactly the version it started with — the first revision in the rollout history. Bring it back without deleting the Deployment; all four pods must be ready.',
        ),
        check: {
          when: (f, start) => {
            const d = dep(f, 'default', 'web');
            return !!d && d.image === 'trainer/web:1.0' && d.ready >= 4 && sameObject(f, start, 'Deployment', 'default', 'web');
          },
          fail: [{ if: (f) => dep(f, 'default', 'web')?.image === 'trainer/web:1.1', say: bi('Это предыдущая ревизия, а не первая. Посмотрите историю выкаток: у отката есть флаг, который выбирает номер ревизии.', 'That is the previous revision, not the first. Look at the rollout history: the undo has a flag that picks the revision number.') }],
        },
        concepts: ['k8s.revision'],
      },
    },
    {
      id: 'nodeselector',
      weight: 2,
      kind: 'task',
      setup: CKA_SETUPS.nodes,
      task: {
        id: 'cka-nodeselector',
        prompt: bi(
          'На worker-1 поставили быстрый диск. Отметьте узел меткой `disk=ssd` и запустите под `fast` из `trainer/web:1.0`, который может работать только на узлах с этой меткой.',
          'worker-1 got a fast disk. Mark the node with the label `disk=ssd` and start a pod `fast` from `trainer/web:1.0` that may run only on nodes with this label.',
        ),
        check: {
          when: (f) => {
            const node = obj(f, 'Node', undefined, 'worker-1');
            const pod = obj(f, 'Pod', 'default', 'fast');
            const p = k8s(f).pods.find((x) => x.ns === 'default' && x.name === 'fast');
            const pinned = pod?.spec?.nodeSelector?.disk === 'ssd' || JSON.stringify(pod?.spec?.affinity ?? {}).includes('"disk"');
            return node?.metadata?.labels?.disk === 'ssd' && pinned && p?.node === 'worker-1' && p.ready;
          },
          fail: [{ if: (f) => !!obj(f, 'Pod', 'default', 'fast') && !obj(f, 'Pod', 'default', 'fast')?.spec?.nodeSelector && !obj(f, 'Pod', 'default', 'fast')?.spec?.affinity, say: bi('Под мог попасть на worker-1 случайно: в его spec ничего не привязывает его к метке disk=ssd.', 'The pod may have landed on worker-1 by chance: nothing in its spec ties it to the disk=ssd label.') }],
        },
        concepts: ['k8s.scheduler', 'k8s.label'],
      },
    },
    {
      id: 'daemonset',
      weight: 2,
      kind: 'task',
      setup: CKA_SETUPS.daemon,
      task: {
        id: 'cka-daemonset',
        prompt: bi(
          'Команде наблюдения нужен агент на каждом узле, включая control plane: DaemonSet `node-agent` в namespace `kube-system` из образа `trainer/client:1.0` с командой `sleep infinity`. Под агента должен работать на всех трёх узлах.',
          'The observability team needs an agent on every node, the control plane included: a DaemonSet `node-agent` in namespace `kube-system` from the image `trainer/client:1.0` with the command `sleep infinity`. An agent pod must run on all three nodes.',
        ),
        check: {
          when: (f) => {
            const pods = ownedPods(f, 'kube-system', 'DaemonSet/node-agent').filter((p) => p.ready);
            return new Set(pods.map((p) => p.node)).size >= 3 && pods.some((p) => p.node === 'cp-1');
          },
          fail: [{ if: (f) => ownedPods(f, 'kube-system', 'DaemonSet/node-agent').length > 0 && !ownedPods(f, 'kube-system', 'DaemonSet/node-agent').some((p) => p.node === 'cp-1'), say: bi('Агенты стоят только на рабочих узлах: у cp-1 taint control-plane, и поды без допуска к нему туда не идут.', 'The agents run on the workers only: cp-1 has the control-plane taint, and pods without a toleration for it do not go there.') }],
        },
        concepts: ['k8s.scheduler', 'k8s.node'],
      },
    },
    {
      id: 'secret',
      weight: 2,
      kind: 'task',
      setup: CKA_SETUPS.secret,
      task: {
        id: 'cka-secret',
        prompt: bi(
          'Приложению `api` нужен пароль базы. Создайте Secret `db-cred` с ключом `password` и значением `s3cr3t` и передайте его в Deployment `api` переменной окружения `DB_PASSWORD` — ссылкой на Secret, а не текстом в манифесте. Оба пода должны работать с новой переменной.',
          'The `api` application needs the database password. Create a Secret `db-cred` with the key `password` and the value `s3cr3t` and pass it to Deployment `api` as the environment variable `DB_PASSWORD` — by a reference to the Secret, not as text in the manifest. Both pods must run with the new variable.',
        ),
        check: {
          when: (f) => {
            const s = obj(f, 'Secret', 'default', 'db-cred');
            const value = s?.stringData?.password ?? decode(s?.data?.password);
            const env = containers(obj(f, 'Deployment', 'default', 'api')).flatMap((c) => c.env ?? []);
            const ref = env.find((e: Obj) => e.name === 'DB_PASSWORD')?.valueFrom?.secretKeyRef;
            const d = dep(f, 'default', 'api');
            return value === 's3cr3t' && ref?.name === 'db-cred' && ref?.key === 'password' && !!d && d.updated >= 2 && d.ready >= 2;
          },
          fail: [{ if: (f) => containers(obj(f, 'Deployment', 'default', 'api')).some((c) => (c.env ?? []).some((e: Obj) => e.name === 'DB_PASSWORD' && e.value)), say: bi('Пароль записан в манифест открытым текстом: его видит каждый, кто может прочитать Deployment. Нужна ссылка valueFrom.secretKeyRef.', 'The password is written into the manifest as plain text: everyone who can read the Deployment sees it. You need a valueFrom.secretKeyRef reference.') }],
        },
        concepts: ['k8s.secret'],
      },
    },
    {
      id: 'limits',
      weight: 2,
      kind: 'task',
      setup: CKA_SETUPS.cache,
      task: {
        id: 'cka-limits',
        prompt: bi(
          'Deployment `cache` всё время перезапускается. Выясните причину и почините так, чтобы кеш работал и дальше получал свои 300 МиБ (переменная `MEM_MB` остаётся прежней).',
          'Deployment `cache` keeps restarting. Find the cause and fix it so that the cache keeps running and still gets its 300 MiB (the `MEM_MB` variable stays as it is).',
        ),
        check: {
          when: (f) => {
            const c = containers(obj(f, 'Deployment', 'default', 'cache'))[0];
            const mem = (c?.env ?? []).find((e: Obj) => e.name === 'MEM_MB')?.value;
            const d = dep(f, 'default', 'cache');
            const pods = k8s(f).pods.filter((p) => p.ns === 'default' && p.labels.app === 'cache' && p.ready);
            return mem === '300' && mebibytes(c?.resources?.limits?.memory) >= 300 && !!d && d.ready >= 1 && pods.some((p) => p.restarts === 0);
          },
          fail: [{ if: (f) => (containers(obj(f, 'Deployment', 'default', 'cache'))[0]?.env ?? []).find((e: Obj) => e.name === 'MEM_MB')?.value !== '300', say: bi('Кеш перестал падать, потому что ему урезали память, — но так он перестанет быть кешем. Поднимите лимит, а не потребность.', 'The cache stopped crashing because its memory was cut, but then it is no longer a cache. Raise the limit, not the need.') }],
        },
        concepts: ['k8s.resources', 'k8s.crashloop'],
      },
    },
    {
      id: 'job',
      weight: 2,
      kind: 'task',
      setup: CKA_SETUPS.empty,
      task: {
        id: 'cka-job',
        prompt: bi(
          'Аналитикам нужен разовый расчёт: Job `report` из образа `trainer/job:1.0` с переменной `DURATION=5`, который должен успешно выполниться три раза, по одному запуску за раз.',
          'The analysts need a one-off calculation: a Job `report` from the image `trainer/job:1.0` with the variable `DURATION=5` that must complete successfully three times, one run at a time.',
        ),
        check: {
          when: (f) => {
            const j = obj(f, 'Job', 'default', 'report');
            return j?.spec?.completions === 3 && (j.spec.parallelism ?? 1) === 1 && (j.status?.succeeded ?? 0) >= 3;
          },
        },
        concepts: ['k8s.controller', 'k8s.pod'],
      },
    },
    {
      id: 'probe-path',
      pool: 'probe',
      weight: 2,
      kind: 'task',
      setup: CKA_SETUPS.probePath,
      task: {
        id: 'cka-probe-path',
        prompt: bi(
          'Магазин не открывается: под `client` в `shop` не получает ответа от `http://shop`, хотя оба пода `shop` в статусе Running. Почините, не удаляя Deployment.',
          'The shop does not open: pod `client` in `shop` gets no answer from `http://shop`, although both `shop` pods are Running. Fix it without deleting the Deployment.',
        ),
        check: { when: (f, start) => reach(f, 'shop/client', 'shop.shop') === 200 && (dep(f, 'shop', 'shop')?.ready ?? 0) >= 2 && sameObject(f, start, 'Deployment', 'shop', 'shop') && containers(obj(f, 'Deployment', 'shop', 'shop')).some((c) => !!c.readinessProbe) },
        concepts: ['k8s.probe', 'k8s.endpointslice'],
      },
    },
    {
      id: 'probe-port',
      pool: 'probe',
      weight: 2,
      kind: 'task',
      setup: CKA_SETUPS.probePort,
      task: {
        id: 'cka-probe-port',
        prompt: bi(
          'Магазин не открывается: под `client` в `shop` не получает ответа от `http://shop`, хотя оба пода `shop` в статусе Running. Почините, не удаляя Deployment.',
          'The shop does not open: pod `client` in `shop` gets no answer from `http://shop`, although both `shop` pods are Running. Fix it without deleting the Deployment.',
        ),
        check: { when: (f, start) => reach(f, 'shop/client', 'shop.shop') === 200 && (dep(f, 'shop', 'shop')?.ready ?? 0) >= 2 && sameObject(f, start, 'Deployment', 'shop', 'shop') && containers(obj(f, 'Deployment', 'shop', 'shop')).some((c) => !!c.readinessProbe) },
        concepts: ['k8s.probe', 'k8s.endpointslice'],
      },
    },
    {
      id: 'image',
      weight: 2,
      kind: 'task',
      setup: CKA_SETUPS.image,
      task: {
        id: 'cka-image',
        prompt: bi(
          'Deployment `orders-api` в namespace `orders` выкатили вчера вечером, и с тех пор ни один его под не запустился. Разработчики говорят, что хотели версию 1.1. Почините Deployment, не удаляя его.',
          'Deployment `orders-api` in namespace `orders` was rolled out last night, and since then not one of its pods has started. The developers say they meant version 1.1. Fix the Deployment without deleting it.',
        ),
        check: {
          when: (f, start) => {
            const d = dep(f, 'orders', 'orders-api');
            return !!d && d.image === 'trainer/web:1.1' && d.ready >= 2 && sameObject(f, start, 'Deployment', 'orders', 'orders-api');
          },
        },
        concepts: ['k8s.events', 'k8s.deployment'],
      },
    },
    {
      id: 'ingress',
      weight: 2,
      kind: 'task',
      setup: CKA_SETUPS.ingress,
      task: {
        id: 'cka-ingress',
        prompt: bi(
          'Сайт переезжает на адрес `shop.example.com`. Создайте Ingress `shop`, который отправляет все пути этого хоста (тип пути Prefix, путь `/`) на Service `web`, порт 80.',
          'The site moves to `shop.example.com`. Create an Ingress `shop` that sends every path of this host (path type Prefix, path `/`) to Service `web`, port 80.',
        ),
        check: {
          when: (f) => {
            const rules: Obj[] = obj(f, 'Ingress', 'default', 'shop')?.spec?.rules ?? [];
            return rules.some((r) => r.host === 'shop.example.com' && (r.http?.paths ?? []).some((p: Obj) => p.path === '/' && p.pathType === 'Prefix' && p.backend?.service?.name === 'web' && (p.backend.service.port?.number === 80 || p.backend.service.port?.name === 'http')));
          },
        },
        concepts: ['k8s.ingress'],
      },
    },
    {
      id: 'startup',
      weight: 2,
      kind: 'task',
      setup: CKA_SETUPS.slow,
      task: {
        id: 'cka-startup',
        prompt: bi(
          'Новая версия каталога прогревает кеш 40 секунд, и проба живости убивает её раньше, чем она успевает ответить. Добейтесь, чтобы оба пода `catalog` стали готовы и больше не перезапускались. Пробу живости не убирайте: после старта она нужна.',
          'The new version of the catalogue warms its cache for 40 seconds, and the liveness probe kills it before it can answer. Get both `catalog` pods ready and no longer restarting. Do not remove the liveness probe: it is needed after the start.',
        ),
        check: {
          when: (f) => {
            const cts = containers(obj(f, 'Deployment', 'default', 'catalog'));
            const d = dep(f, 'default', 'catalog');
            const pods = k8s(f).pods.filter((p) => p.ns === 'default' && p.labels.app === 'catalog' && p.ready && p.restarts === 0);
            return cts.some((c) => !!c.livenessProbe) && !!d && d.ready >= 2 && d.updated >= 2 && pods.length >= 2;
          },
          fail: [{ if: (f) => !containers(obj(f, 'Deployment', 'default', 'catalog')).some((c) => !!c.livenessProbe), say: bi('Проба живости пропала: зависший после старта каталог теперь никто не перезапустит.', 'The liveness probe is gone: nobody will restart the catalogue now if it hangs after the start.') }],
        },
        concepts: ['k8s.probe'],
      },
    },
    {
      id: 'affinity',
      weight: 3,
      beyond: true,
      kind: 'task',
      setup: CKA_SETUPS.batch,
      task: {
        id: 'cka-affinity',
        prompt: bi(
          'Узел worker-2 скоро сдают в ремонт. Запустите Deployment `batch` из `trainer/web:1.0` на три реплики так, чтобы его поды никогда не попадали на worker-2. Метки узлов не трогайте, `nodeName` и taint не используйте: правило должно быть записано в самом Deployment.',
          'Node worker-2 is going in for repair soon. Start a Deployment `batch` from `trainer/web:1.0` with three replicas so that its pods never land on worker-2. Do not touch the node labels, do not use `nodeName` or taints: the rule must be written in the Deployment itself.',
        ),
        check: {
          when: (f, start) => {
            const tmpl = obj(f, 'Deployment', 'default', 'batch')?.spec?.template?.spec ?? {};
            const pods = k8s(f).pods.filter((p) => p.ns === 'default' && p.labels.app === 'batch' && p.ready);
            const labelsKept = !start || k8s(f).nodes.every((n) => JSON.stringify(obj(f, 'Node', undefined, n.name)?.metadata?.labels) === JSON.stringify(obj(start, 'Node', undefined, n.name)?.metadata?.labels));
            const tainted = k8s(f).nodes.some((n) => n.taints.some((t) => !t.startsWith('node-role') && !t.startsWith('node.kubernetes.io')));
            return pods.length >= 3 && pods.every((p) => p.node !== 'worker-2') && !!tmpl.affinity?.nodeAffinity && !tmpl.nodeName && labelsKept && !tainted;
          },
        },
        docStep: 5,
        beyond: true,
        solutionTokens: ['nodeAffinity', 'NotIn', 'requiredDuringSchedulingIgnoredDuringExecution'],
        concepts: ['k8s.scheduler'],
      },
    },
    {
      id: 'deadline',
      weight: 3,
      beyond: true,
      kind: 'task',
      setup: CKA_SETUPS.deadline,
      task: {
        id: 'cka-deadline',
        prompt: bi(
          'Ночной импорт иногда зависает и висит сутками. Манифест Job лежит в `~/import.yaml`. Сделайте так, чтобы Kubernetes сам останавливал Job `import`, если тот работает дольше 60 секунд, и запустите его.',
          'The nightly import sometimes hangs and stays stuck for days. The Job manifest is in `~/import.yaml`. Make Kubernetes itself stop Job `import` if it runs longer than 60 seconds, and start it.',
        ),
        check: {
          when: (f) => {
            const j = obj(f, 'Job', 'default', 'import');
            const s = j?.spec?.activeDeadlineSeconds;
            return typeof s === 'number' && s > 0 && s <= 60 && (j?.status?.conditions ?? []).some((c: Obj) => c.type === 'Failed' && c.status === 'True' && c.reason === 'DeadlineExceeded');
          },
        },
        docStep: 5,
        beyond: true,
        solutionTokens: ['activeDeadlineSeconds'],
        concepts: ['k8s.controller', 'k8s.pod'],
      },
    },
    {
      id: 'history',
      weight: 3,
      beyond: true,
      kind: 'task',
      setup: CKA_SETUPS.limit,
      task: {
        id: 'cka-history',
        prompt: bi(
          'В namespace копятся старые ReplicaSet: у Deployment `web` их уже четыре. Пусть Kubernetes хранит для отката только две прежние версии и сам удаляет остальные. Deployment не пересоздавать.',
          'Old ReplicaSets pile up in the namespace: Deployment `web` already has four. Let Kubernetes keep only two previous versions for a rollback and delete the rest by itself. Do not recreate the Deployment.',
        ),
        check: {
          when: (f, start) => {
            const d = obj(f, 'Deployment', 'default', 'web');
            const rs = k8s(f).objects.filter((o) => o.kind === 'ReplicaSet' && (o.metadata?.ownerReferences ?? []).some((r: Obj) => r.kind === 'Deployment' && r.name === 'web'));
            return d?.spec?.revisionHistoryLimit === 2 && rs.length <= 3 && (dep(f, 'default', 'web')?.ready ?? 0) >= 4 && sameObject(f, start, 'Deployment', 'default', 'web');
          },
        },
        docStep: 5,
        beyond: true,
        solutionTokens: ['revisionHistoryLimit'],
        concepts: ['k8s.revision', 'k8s.replicaset'],
      },
    },
  ],
  explain: [
    {
      id: 'requests',
      prompt: bi('Чем requests отличаются от limits и кто из компонентов кластера смотрит на каждое из них?', 'How do requests differ from limits, and which components of the cluster look at each of them?'),
      keyPoints: [
        bi('requests читает планировщик: под встаёт только на узел, где сумма requests помещается в свободную ёмкость', 'requests are read by the scheduler: a pod lands only on a node where the sum of requests fits the free capacity'),
        bi('limits исполняет ядро через cgroup на узле: выход за лимит памяти — OOMKilled, за лимит CPU — притормаживание', 'limits are enforced by the kernel through the cgroup on the node: going over the memory limit means OOMKilled, over the CPU limit means throttling'),
        bi('без limits под может съесть узел, без requests планировщик не знает, сколько под займёт', 'without limits a pod can eat the node; without requests the scheduler does not know how much the pod will take'),
      ],
    },
    {
      id: 'probes',
      prompt: bi('Под Running, но в сервис трафик не идёт. Какие пробы бывают и как каждая из них влияет на этот симптом?', 'A pod is Running but no traffic reaches it through the Service. What probes are there, and how does each of them bear on this symptom?'),
      keyPoints: [
        bi('readiness решает, стоит ли под в EndpointSlice сервиса: не готов — трафика нет, но под не перезапускают', 'readiness decides whether the pod is in the Service’s EndpointSlice: not ready means no traffic, but the pod is not restarted'),
        bi('liveness перезапускает контейнер, когда проба проваливается подряд failureThreshold раз', 'liveness restarts the container when the probe fails failureThreshold times in a row'),
        bi('startup держит остальные пробы, пока медленное приложение стартует', 'startup holds the other probes back while a slow application starts'),
      ],
    },
  ],
};
