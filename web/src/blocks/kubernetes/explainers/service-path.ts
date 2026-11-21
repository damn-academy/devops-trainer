// Э7 (05 §6.9): a request through a Service and kube-proxy. The client asks
// DNS, connects to the ClusterIP — an address that no interface has — and the
// node kernel rewrites it to one pod IP by the rules kube-proxy wrote from the
// EndpointSlice. The replicas knob rewrites the probabilities of the rules
// (1/N, 1/(N−1), …, the rest); keep-alive shows why the balance looks unequal.
//
// Reading order: at first only the client, the Service and its pods are on
// screen; CoreDNS, the EndpointSlice, kube-proxy and the kernel rules appear
// when the request needs them.

import { defineModel } from '../../../core/define';
import { bi, fmt, t, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { box, D, edge, fmtb, idsOf, LEGEND_BASE, mark, metric, only } from './kit';

type P = { replicas: number; mode: string; keepalive: boolean; unready: boolean };

/** kube-proxy (iptables): the probability of the i-th KUBE-SEP rule among n endpoints. */
export function ruleProbabilities(n: number): number[] {
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? 1 : 1 / (n - i)));
}

/** 100 requests over the ready endpoints: equal shares, or all on one with keep-alive. */
export function distribution(n: number, keepalive: boolean): number[] {
  if (n <= 0) return [];
  if (keepalive) return Array.from({ length: n }, (_, i) => (i === 0 ? 100 : 0));
  const base = Math.floor(100 / n);
  return Array.from({ length: n }, (_, i) => base + (i < 100 - base * n ? 1 : 0));
}

const POD_IPS = ['10.42.1.15', '10.42.2.9', '10.42.0.22', '10.42.1.31', '10.42.2.17'];

const KERNEL = bi('Правила пишет kube-proxy, а исполняет их ядро узла.', 'kube-proxy writes the rules; the kernel runs them.');
const POD = (i: number) => box(`p${i + 1}`, `web-${i + 1}`, 'process', 'box', [300 + i * 220, 410, 170, 52], 'container', bi('Один из подов сервиса web. Процесс в нём слушает порт 80.', 'A pod of Service web, listening on 80.'), bi('Под создал ReplicaSet.', 'Created by the ReplicaSet.'), { doc: D.service, sub: POD_IPS[i] });

const diagram = {
  width: 960,
  height: 490,
  nodes: [
    box('client', bi('Под client', 'Pod client'), 'process', 'box', [24, 40, 190, 56], 'container', bi('Под, из которого вы выполняете `curl http://web`. Сначала он узнаёт адрес по имени через DNS, потом открывает соединение с этим адресом.', 'Runs curl http://web: DNS first, then connects.'), bi('Под запустили вы.', 'You started it.'), { see: 'kubectl exec client -- curl -v http://web', doc: D.service, sub: '10.42.0.40' }),
    box('dns', 'CoreDNS', 'l7', 'box', [24, 200, 190, 52], 'dns', bi('Сервер имён кластера. На имя web.default.svc.cluster.local он отвечает адресом Service, 10.43.12.7.', 'Answers web.default.svc.cluster.local with 10.43.12.7.'), bi('Работает подами в namespace kube-system.', 'Pods in kube-system.'), { see: 'kubectl exec client -- nslookup web', doc: D.dns }),
    box('nf', bi('Правила ядра узла (netfilter)', 'Node kernel rules (netfilter)'), 'kernel', 'bar', [24, 296, 912, 60], 'router', bi('Цепочки правил KUBE-SERVICES, KUBE-SVC и KUBE-SEP в ядре узла. Пакет, адресованный ClusterIP, получает здесь новый адрес назначения — IP одного из подов, а ответ ядро переводит обратно.', 'KUBE-SERVICES → KUBE-SVC → KUBE-SEP: a packet to the ClusterIP gets a pod IP; the reply is translated back.'), KERNEL, { see: 'cluster iptables worker-1', doc: D.vip, sub: 'KUBE-SVC-LOLE4ISW44XBNF3G' }),
    box('svc', bi('Service web', 'Service web'), 'l4', 'pill', [300, 40, 230, 56], 'file', bi('Объект Service с селектором app=web и портом 80, который ведёт на порт 80 подов (targetPort). Адрес 10.43.12.7, ClusterIP, — это поле объекта, а не сетевой интерфейс.', 'Selector app=web, port 80 → targetPort 80; the ClusterIP 10.43.12.7 is a field, not an interface.'), bi('Service создаёте вы командой `kubectl expose` или `kubectl apply`.', 'You create it.'), { see: 'kubectl get svc web -o wide', doc: D.service, sub: '10.43.12.7:80' }),
    box('slice', bi('EndpointSlice сервиса web', 'EndpointSlice of web'), 'obj', 'doc', [300, 150, 230, 80], 'file', bi('Список адресов подов, которые выбрал селектор Service. Неготовый под тоже попадает в список, но с пометкой ready: false.', 'The addresses of the pods the selector picked; a not-ready pod is listed with ready: false.'), bi('Список ведёт контроллер EndpointSlice.', 'Kept by the EndpointSlice controller.'), { see: 'kubectl get endpointslices -l kubernetes.io/service-name=web', doc: D.slices, sub: '' }),
    box('kp', 'kube-proxy', 'l4', 'box', [610, 160, 190, 52], 'process', bi('kube-proxy следит за Service и EndpointSlice и переписывает правила ядра на своём узле, а сами пакеты по этим правилам пересылает ядро.', 'Watches Services and EndpointSlices and rewrites the kernel rules; it forwards nothing.'), bi('Работает на каждом узле.', 'Runs on every node.'), { see: 'cluster iptables worker-1', doc: D.vip }),
    POD(0),
    POD(1),
    POD(2),
  ],
  edges: [
    edge('e-dns', 'client', 'dns', bi('адрес имени web', 'address of web'), bi('Запрос DNS, в котором под спрашивает адрес имени web.', 'A DNS query for the Service name.'), bi('Спрашивает резолвер пода.', 'The pod’s resolver.')),
    edge('e-conn', 'client', 'nf', bi('соединение на ClusterIP', 'connect to ClusterIP'), bi('Пакет на ClusterIP попадает в цепочки правил ядра узла.', 'The packet to the ClusterIP enters the kernel chains.'), bi('Пакет отправляет ядро.', 'The kernel.'), { via: [[248, 68], [248, 296]], labelAt: 0.8 }),
    edge('e-sel', 'svc', 'slice', bi('поды с app=web', 'pods with app=web'), bi('Контроллер EndpointSlice ищет поды по селектору и записывает их адреса.', 'Finds pods by selector and writes their addresses.'), bi('kube-controller-manager', 'kube-controller-manager')),
    edge('e-watch', 'slice', 'kp', bi('адреса подов', 'pod addresses'), bi('kube-proxy получает адреса и пересчитывает правила.', 'kube-proxy gets the addresses and recomputes rules.'), bi('kube-proxy', 'kube-proxy')),
    edge('e-rules', 'kp', 'nf', bi('новые правила', 'new rules'), bi('Новые правила загружаются в ядро одной операцией.', 'Loaded into the kernel in one transaction.'), bi('kube-proxy', 'kube-proxy'), { labelAt: 0.12 }),
    edge('e-p1', 'nf', 'p1', bi('новый адрес :80', 'rewritten :80'), bi('Правило KUBE-SEP заменило адрес назначения на IP этого пода.', 'A KUBE-SEP rule replaced the destination with this pod’s IP.'), KERNEL, { labelAt: 0.65 }),
    edge('e-p2', 'nf', 'p2', bi('новый адрес :80', 'rewritten :80'), bi('Правило KUBE-SEP заменило адрес назначения на IP этого пода.', 'A KUBE-SEP rule replaced the destination with this pod’s IP.'), KERNEL, { labelAt: 0.65 }),
    edge('e-p3', 'nf', 'p3', bi('новый адрес :80', 'rewritten :80'), bi('Правило KUBE-SEP заменило адрес назначения на IP этого пода.', 'A KUBE-SEP rule replaced the destination with this pod’s IP.'), KERNEL, { labelAt: 0.65 }),
  ],
};

const ALL = idsOf(diagram);

export const servicePathModel = defineModel<P>({
  id: 'k8s.service-path',
  frame: 'visible',
  block: 'k8s-1',
  title: bi('Как запрос проходит через Service', 'How a request passes through a Service'),
  summary: bi(
    'Адрес Service, ClusterIP, не принадлежит ни одному сетевому интерфейсу. Когда под отправляет на него пакет, ядро узла заменяет адрес назначения на IP одного из подов по правилам, которые kube-proxy составил из списка готовых подов (EndpointSlice). Схема показывает этот путь и считает, как сто запросов распределяются по подам.',
    'A ClusterIP is on no interface: the node kernel replaces it with a pod IP by rules kube-proxy built from the EndpointSlice. The diagram counts how 100 requests spread over the pods.',
  ),
  intro: bi(
    'Сейчас на схеме под client и три пода сервиса web. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». Под client выполнит `curl http://web`, и схема покажет, кто превращает имя web в адрес конкретного пода. Карточка на линии показывает адрес назначения пакета, и следите, как он меняется. Потом меняйте в «Параметрах» число подов и включите повторное использование соединения (keep-alive), а напоследок сломайте селектор или порт в блоке «Сломать».',
    'For now: pod client and the three pods of Service web. Press “Start from the first step” and go on with “Step forward”: client runs `curl http://web`, and the diagram shows who turns the name into a pod address. Watch the destination on the card change. Then change the pod count and keep-alive, and break the selector or the port.',
  ),
  legend: [
    ...LEGEND_BASE,
    mark('icon:container', 'под', 'a pod'),
    mark('icon:file', 'объект API: Service или EndpointSlice', 'an API object'),
    mark('icon:router', 'правила ядра узла', 'the node kernel rules'),
    mark('icon:dns', 'сервер имён CoreDNS', 'CoreDNS'),
    mark('ok', 'под получил запрос', 'the pod got the request'),
    mark('warn', 'под не готов и запросов не получает', 'the pod is not ready'),
    mark('pale', 'такого пода сейчас нет', 'no such pod now'),
  ],
  stopLabel: bi('Запрос остановился', 'The request stopped'),
  concepts: ['k8s.service', 'k8s.kube-proxy', 'k8s.endpointslice'],
  diagram,
  params: [
    {
      id: 'replicas',
      label: bi('Сколько подов за Service', 'Pods behind the Service'),
      kind: 'range',
      min: 1,
      max: 5,
      step: 1,
      default: 3,
      near: 'slice',
      group: bi('Service и его поды', 'The Service and its pods'),
      predict: {
        prompt: bi('Вы меняете число подов за Service. С какой вероятностью первое правило KUBE-SEP отправит соединение на первый под?', 'You change the pod count. With what probability does the first KUBE-SEP rule pick the first pod?'),
        options: [
          { id: 'inv', text: bi('Один к числу готовых подов (1/N)', '1/N of the ready pods') },
          { id: 'half', text: bi('Всегда одна вторая, при любом числе подов', 'Always 0.5') },
        ],
        resolve: () => 'inv',
      },
    },
    {
      id: 'unready',
      label: bi('web-2 не проходит проверку готовности', 'web-2 fails its readiness check'),
      kind: 'toggle',
      default: false,
      near: 'p2',
      levels: ['intermediate', 'experienced'],
      group: bi('Service и его поды', 'The Service and its pods'),
      predict: {
        prompt: bi('Под web-2 перестал проходить проверку готовности, но процесс в нём работает. Что с ним сделает кластер?', 'web-2 fails its readiness check, the process runs. What does the cluster do?'),
        options: [
          { id: 'out', text: bi('Уберёт его из правил, а процесс оставит работать', 'Remove it from the rules, leave the process running') },
          { id: 'restart', text: bi('kubelet перезапустит контейнер', 'The kubelet restarts the container') },
        ],
        resolve: () => 'out',
      },
    },
    {
      id: 'keepalive',
      label: bi('Клиент отправляет все запросы по одному соединению (keep-alive)', 'The client sends everything over one connection (keep-alive)'),
      kind: 'toggle',
      default: false,
      near: 'client',
      group: bi('Клиент', 'The client'),
      predict: {
        prompt: bi('Клиент отправляет сто запросов по одному соединению. Как они распределятся по подам?', 'The client sends 100 requests over one connection. How do they spread?'),
        options: [
          { id: 'one', text: bi('Все сто уйдут на один под', 'All to one pod') },
          { id: 'equal', text: bi('Поровну между подами', 'Equally') },
        ],
        resolve: (_p, n) => (metric(n, 'pod1') === 100 ? 'one' : 'equal'),
      },
    },
    { id: 'mode', label: bi('Как kube-proxy записывает правила', 'How kube-proxy writes the rules'), kind: 'choice', default: 'iptables', options: [{ id: 'iptables', label: bi('iptables', 'iptables') }, { id: 'nftables', label: bi('nftables', 'nftables') }, { id: 'ipvs', label: bi('IPVS (устаревший режим)', 'IPVS (deprecated)') }], near: 'kp', levels: ['intermediate', 'experienced'], group: bi('kube-proxy', 'kube-proxy') },
  ],
  breaks: [
    { id: 'selector', label: bi('В селекторе Service опечатка, и вместо app: web написано app: wbe', 'A typo in the selector: app: wbe'), remove: ['e-sel'], layer: 'L4', boundary: 'network', predict: { prompt: bi('В селекторе Service опечатка, и он не находит ни одного пода. Что напечатает `curl http://web`?', 'The selector finds no pods. What does `curl http://web` print?'), options: [{ id: 'refused', text: bi('Сразу же откажет в соединении (Couldn’t connect)', 'An immediate refusal') }, { id: 'timeout', text: bi('Будет долго ждать и закончится тайм-аутом', 'A long wait, then a timeout') }, { id: 'dns', text: bi('Сообщение Could not resolve host о том, что имя не найдено', 'Could not resolve host') }], resolve: () => 'refused' } },
    { id: 'targetport', label: bi('В Service указан targetPort 8080, а процесс в поде слушает 80', 'targetPort is 8080, the process listens on 80'), remove: ['e-p1', 'e-p2', 'e-p3'], layer: 'L4', boundary: 'network', predict: { prompt: bi('Service отправляет пакеты на порт 8080, а процесс в поде слушает порт 80. Что будет?', 'The Service sends to 8080, the process listens on 80. What happens?'), options: [{ id: 'rst', text: bi('Под откажет в соединении, потому что на порту 8080 никто не слушает', 'The pod refuses: nobody listens on 8080') }, { id: 'ok', text: bi('Kubernetes сам возьмёт порт из containerPort', 'Kubernetes uses containerPort instead') }], resolve: () => 'rst' } },
    { id: 'no-kp', label: bi('kube-proxy остановлен, а Service создан уже после этого', 'kube-proxy stopped before the Service was created'), remove: ['kp', 'e-watch', 'e-rules'], layer: 'L4', boundary: 'network', predict: { prompt: bi('kube-proxy не работает, а Service создан уже после его остановки. Что напечатает `curl http://web`?', 'kube-proxy is down and the Service is new. What does curl print?'), options: [{ id: 'timeout', text: bi('Запрос завершится по тайм-ауту, потому что правила для этого ClusterIP в ядре нет', 'A timeout: no rule for this ClusterIP') }, { id: 'refused', text: bi('Сразу же откажет в соединении', 'An immediate refusal') }], resolve: () => 'timeout' } },
  ],
  metrics: [
    { id: 'pod1', label: bi('запросов из ста на web-1', 'of 100 to web-1') },
    { id: 'pod2', label: bi('на web-2', 'to web-2') },
    { id: 'pod3', label: bi('на web-3', 'to web-3') },
    { id: 'rest', label: bi('на web-4 и web-5 вместе', 'to web-4 and web-5 together') },
  ],
  run(p, broken): Step[] {
    const s: Step[] = [];
    const total = Math.min(p.replicas, 5);
    const ready = Array.from({ length: total }, (_, i) => !(p.unready && i === 1));
    const readyIdx = ready.map((r, i) => (r ? i : -1)).filter((i) => i >= 0);
    const dist = distribution(readyIdx.length, p.keepalive);
    const per = [0, 0, 0, 0, 0];
    readyIdx.forEach((idx, k) => {
      per[idx] = dist[k];
    });
    const metrics = { pod1: per[0], pod2: per[1], pod3: per[2], rest: per[3] + per[4] };
    const zero = { pod1: 0, pod2: 0, pod3: 0, rest: 0 };
    const offPods: Record<string, 'off'> = {};
    for (let i = total; i < 3; i++) offPods[`p${i + 1}`] = 'off';
    s.push({
      id: 'dns',
      label: 'DNS',
      caption: bi('Под client выполняет `curl http://web` и сначала спрашивает у CoreDNS, какой адрес у имени web. CoreDNS отвечает адресом Service, 10.43.12.7. Это ClusterIP, а не адрес какого-нибудь пода.', 'client asks CoreDNS for web and gets 10.43.12.7, the ClusterIP, not a pod address.'),
      focus: ['dns', 'e-dns'],
      reveal: ['dns', 'e-dns'],
      tokens: [{ edge: 'e-dns', label: 'web → 10.43.12.7' }],
      say: { dns: bi('CoreDNS отвечает, что у имени web адрес 10.43.12.7.', 'CoreDNS answers: web is 10.43.12.7.') },
      states: { ...only(ALL, 'client', 'p1', 'p2', 'p3'), ...offPods },
      metrics: zero,
    });
    if (broken.has('selector')) {
      s.push({
        id: 'empty',
        label: bi('пусто', 'empty'),
        caption: bi('Селектор app: wbe не находит ни одного пода, поэтому EndpointSlice пуст, и kube-proxy записывает для этого ClusterIP правило, которое сразу отвергает соединения.', 'app: wbe finds no pods: the EndpointSlice is empty and kube-proxy writes a REJECT rule.'),
        focus: ['slice'],
        reveal: ['svc', 'e-sel', 'slice', 'nf'],
        say: { slice: bi('В EndpointSlice нет ни одного адреса, потому что селектор не нашёл подов.', 'The EndpointSlice is empty.') },
        states: { slice: 'err' },
        values: { slice: t(bi('адресов: 0', '0 endpoints')), nf: '-j REJECT' },
        metrics: zero,
        broken: { at: 'slice', message: '-A KUBE-SERVICES -d 10.43.12.7/32 -p tcp -m comment --comment "default/web has no endpoints" -m tcp --dport 80 -j REJECT --reject-with icmp-port-unreachable\n$ kubectl exec client -- curl -sS http://web\ncurl: (7) Failed to connect to web port 80 after 2 ms: Couldn\'t connect to server', caption: bi('на списке подов. Service находит поды только по меткам, поэтому сравните вывод `kubectl get endpointslices` и `kubectl get pods --show-labels`, потому что пустой список подов выдаёт такую поломку сразу.', 'at the pod list: compare `kubectl get endpointslices` with `kubectl get pods --show-labels`.') },
      });
      return s;
    }
    s.push({
      id: 'slice',
      label: 'EndpointSlice',
      caption: fmt(bi('Контроллер EndpointSlice нашёл по селектору app=web поды и записал их адреса. Всего адресов {n}, из них готовых {r}. Только готовые поды будут получать запросы.', 'The EndpointSlice lists {n} pods, {r} ready; only ready ones get requests.'), { n: total, r: readyIdx.length }),
      focus: ['slice', 'e-sel'],
      reveal: ['svc', 'slice', 'e-sel'],
      tokens: [{ edge: 'e-sel', label: 'app=web' }],
      say: { slice: fmt(bi('В EndpointSlice записаны адреса подов с меткой app=web, и готовы из них {r}.', 'The EndpointSlice holds the app=web pods, {r} ready.'), { r: readyIdx.length }) },
      values: { slice: t(fmt(bi('готовых: {r}{x}', '{r} ready{x}'), { r: readyIdx.length, x: p.unready ? ', web-2 ready: false' : '' })) },
      states: p.unready ? { p2: 'warn' } : {},
      metrics: zero,
    });
    if (broken.has('no-kp')) {
      s.push({
        id: 'norule',
        label: bi('нет правила', 'no rule'),
        caption: bi('Адреса подов в EndpointSlice есть, но kube-proxy не работает, и правила для нового ClusterIP в ядре нет. Пакет на 10.43.12.7 уходит по маршруту по умолчанию в никуда.', 'The addresses exist, but kube-proxy is down: no rule for the new ClusterIP, the packet goes nowhere.'),
        focus: ['nf'],
        reveal: ['nf', 'kp'],
        say: { nf: bi('В ядре узла нет правила для адреса 10.43.12.7.', 'No kernel rule for 10.43.12.7.') },
        states: { kp: 'err' },
        metrics: zero,
        broken: { at: 'nf', message: "$ kubectl exec client -- curl -sS http://web\ncurl: (28) Failed to connect to web port 80 after 130412 ms: Couldn't connect to server", caption: bi('в ядре узла. Старые Service продолжают работать, потому что их правила остались в ядре, а новые нет: kube-proxy только пишет правила, а пакеты пересылает ядро.', 'in the kernel: old Services still work, new ones do not; kube-proxy only writes rules.') },
      });
      return s;
    }
    const probs = ruleProbabilities(readyIdx.length).map((x) => x.toFixed(2));
    const probsRu = probs.map((x) => x.replace('.', ','));
    const modeText: Record<string, Bi> = {
      iptables: fmt(bi('kube-proxy записывает в ядро цепочку правил. Первое правило выбирает свой под с вероятностью {p0r}, каждое следующее делит остаток. Вероятности {pr} кажутся неравными, но каждому поду достаётся одинаковая доля соединений.', 'kube-proxy writes a chain of rules into the kernel. The first rule picks its pod with probability {p0}, each next one splits what is left. The probabilities {p} look unequal, yet every pod gets an equal share.'), { p0: probs[0] ?? '1', p: probs.join(', '), p0r: probsRu[0] ?? '1', pr: probsRu.join('; ') }),
      nftables: bi('kube-proxy в режиме nftables записывает в ядро таблицу, в которой случайное число выбирает один из готовых подов одной операцией. Логика та же, что у iptables, только короче.', 'nftables: a random number picks a ready pod in one operation.'),
      ipvs: bi('В режиме IPVS адрес Service назначен служебному интерфейсу kube-ipvs0, а соединения распределяет модуль ядра IPVS. Этот режим объявлен устаревшим, и в новых кластерах используют iptables или nftables.', 'IPVS: the ClusterIP sits on kube-ipvs0 and the IPVS module balances; the mode is deprecated.'),
    };
    s.push({
      id: 'rules',
      label: bi('правила', 'rules'),
      caption: modeText[p.mode] ?? modeText.iptables,
      focus: ['kp', 'e-watch', 'e-rules'],
      reveal: ['kp', 'e-watch', 'e-rules', 'nf'],
      tokens: [{ edge: 'e-rules', label: p.mode === 'nftables' ? `numgen mod ${readyIdx.length}` : `${readyIdx.length} × KUBE-SEP` }],
      say: { kp: bi('kube-proxy переписывает правила в ядре узла.', 'kube-proxy rewrites the rules in the node’s kernel.') },
      values: { nf: p.mode === 'nftables' ? `numgen random mod ${readyIdx.length}` : `KUBE-SVC → ${readyIdx.length} × KUBE-SEP` },
      metrics: zero,
    });
    s.push({
      id: 'connect',
      label: bi('соединение', 'connect'),
      caption: bi('Под client открывает соединение на 10.43.12.7, порт 80. Ни у одного интерфейса в кластере нет такого адреса, поэтому пакет перехватывает цепочка KUBE-SERVICES в ядре узла ещё до того, как ядро станет искать маршрут.', 'client connects to 10.43.12.7:80; no interface has it, so KUBE-SERVICES catches the packet before routing.'),
      focus: ['client', 'e-conn'],
      reveal: ['e-conn'],
      tokens: [{ edge: 'e-conn', label: 'dst 10.43.12.7:80' }],
      say: { client: bi('Под client отправляет пакет на адрес Service 10.43.12.7, порт 80.', 'client sends to 10.43.12.7:80.') },
      metrics: zero,
    });
    if (broken.has('targetport')) {
      s.push({
        id: 'rst',
        label: 'RST',
        caption: bi('Ядро заменило адрес назначения на 10.42.1.15, порт 8080, но процесс в поде слушает порт 80. На 8080 никто не слушает, и ядро пода отвечает отказом в соединении.', 'DNAT sent it to 10.42.1.15:8080, but the process listens on 80: the pod answers RST.'),
        focus: ['p1', 'e-p1'],
        reveal: ['e-p1'],
        tokens: [{ edge: 'e-p1', label: `dst ${POD_IPS[0]}:8080` }],
        say: { p1: bi('На порт 8080 в поде web-1 никто не слушает, и под отказывает в соединении.', 'Nobody listens on 8080 in web-1: refused.') },
        states: { p1: 'err' },
        metrics: zero,
        broken: { at: 'p1', message: "$ kubectl exec client -- curl -sS http://web\ncurl: (7) Failed to connect to web port 80 after 1 ms: Couldn't connect to server", caption: bi('на поде. Service отправляет пакеты на targetPort, а containerPort в описании пода — только справка для людей. Какой порт на самом деле слушает процесс, покажет `kubectl exec <под> -- ss -ltn`.', 'at the pod: a Service sends to targetPort; containerPort is only a description. Check with `kubectl exec <pod> -- ss -ltn`.') },
      });
      return s;
    }
    const first = readyIdx[0] ?? 0;
    s.push({
      id: 'dnat',
      label: bi('новый адрес', 'rewrite'),
      caption: fmt(bi('Правило выбрало под случайным образом, и ядро заменило адрес назначения 10.43.12.7:80 на {ip}:80. Дальше пакет идёт как обычный пакет из пода в под.', 'A rule picked a pod: 10.43.12.7:80 becomes {ip}:80; from here it is an ordinary pod-to-pod packet.'), { ip: POD_IPS[first] }),
      focus: ['nf', `e-p${first + 1}`],
      reveal: [`e-p${first + 1}`],
      tokens: [{ edge: `e-p${first + 1}`, label: `dst ${POD_IPS[first]}:80` }],
      say: { nf: fmt(bi('Ядро меняет адрес назначения на {ip}, адрес пода web-{n}.', 'The kernel rewrites 10.43.12.7 to {ip}, web-{n}.'), { ip: POD_IPS[first], n: first + 1 }) },
      states: { [`p${first + 1}`]: 'ok' },
      metrics: zero,
    });
    s.push({
      id: 'reply',
      label: bi('ответ', 'reply'),
      caption: bi('Под отвечает со своего адреса, но ядро помнит сделанную замену (это работа модуля conntrack) и возвращает в ответе адрес отправителя 10.43.12.7. Поэтому под client так и не узнаёт, какой под ему ответил.', 'conntrack restores the source 10.43.12.7, so client never learns the pod address.'),
      focus: ['nf', 'e-conn'],
      tokens: [{ edge: 'e-conn', reverse: true, label: 'src 10.43.12.7' }],
      say: { nf: bi('Ядро возвращает в ответе адрес Service вместо адреса пода.', 'The kernel puts the Service address back in the reply.') },
      metrics: zero,
    });
    s.push({
      id: 'hundred',
      label: bi('сто запросов', '100 requests'),
      caption: p.keepalive
        ? bi('Сто запросов идут по одному соединению. Правило выбирает под только при открытии соединения, а потом ядро ведёт всё соединение на тот же под. Поэтому все сто запросов попадают на один под, и балансировка выглядит неравной.', '100 requests on one connection: the rule picks a pod only at connect time, so all go to one pod.')
        : readyIdx.length === 1
          ? bi('Все сто новых соединений ушли на web-1, потому что других готовых подов за Service нет.', 'All 100 new connections went to web-1, because there are no other ready pods behind the Service.')
          : fmtb(bi('Правила выбирают под случайно, поэтому каждому из {n} подов в среднем достаётся равная доля из ста новых соединений: {d}. В настоящем кластере числа каждый раз немного отличаются от средних.', 'The rules pick a pod at random, so each of the {n} pods gets on average an equal share of the 100 new connections: {d}. In a real cluster the numbers differ a little from the average each time.'), { n: readyIdx.length, d: readyIdx.map((i, k) => `web-${i + 1} ${dist[k]}`).join(', ') }),
      focus: ['client'],
      say: { client: p.keepalive ? bi('Под client отправляет сто запросов по одному и тому же соединению.', 'client sends 100 requests over one connection.') : bi('Под client открывает сто новых соединений.', 'client opens 100 new connections.') },
      metrics,
    });
    return s;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break')
      return change.on
        ? bi('Путь остановился там же, где остановился бы в настоящем кластере.', 'The path stops where it would in a real cluster.')
        : bi('Поломка убрана, и запрос снова доходит до пода.', 'Fixed: the request reaches a pod again.');
    switch (change.id) {
      case 'replicas': {
        const n = b.replicas as number;
        return fmt(bi('Подов теперь {n}, и вероятности правил стали такими: {pr}. Так каждый под получает 1/{n} всех соединений.', '{n} pods: probabilities {p}, each pod gets 1/{n}.'), { n, p: ruleProbabilities(n).map((x) => x.toFixed(2)).join(', '), pr: ruleProbabilities(n).map((x) => x.toFixed(2).replace('.', ',')).join('; ') });
      }
      case 'keepalive':
        return b.keepalive ? bi('С keep-alive соединение одно, правило выбирается один раз, и все запросы уходят на один под.', 'Keep-alive: one connection, one pick, one pod.') : bi('Без keep-alive каждый запрос открывает новое соединение, и правило выбирает под заново.', 'Each request is a new connection and a new pick.');
      case 'unready':
        return b.unready
          ? fmt(bi('web-2 не готов, поэтому в EndpointSlice у него записано ready: false, и правила для него нет. Процесс работает, но запросов не получает. Теперь распределение такое: {d}.', 'web-2 is not ready: no rule for it; now {d}.'), { d: `web-1 ${metric(next, 'pod1')}, web-3 ${metric(next, 'pod3')}` })
          : bi('web-2 снова готов и вернулся в правила.', 'web-2 is ready and back in the rules.');
      case 'mode':
        return b.mode === 'ipvs' ? bi('Режим IPVS устроен иначе, но решает ту же задачу, и этот режим объявлен устаревшим.', 'IPVS: the same idea, another mechanism; deprecated.') : fmt(bi('В режиме {m} правила выглядят иначе, но решение остаётся тем же, и адрес заменяется адресом одного из готовых подов.', 'Mode {m}: different rules, the same decision.'), { m: b.mode as string });
    }
    return bi('Путь пересчитан.', 'The path is recomputed.');
  },
});
