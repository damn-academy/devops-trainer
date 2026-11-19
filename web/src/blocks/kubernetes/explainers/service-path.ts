// Э7 (05 §6.9): a request through a Service and kube-proxy. The client asks
// DNS, connects to the ClusterIP — an address that no interface has — and the
// node kernel rewrites it to one pod IP by the rules kube-proxy wrote from the
// EndpointSlice. The replicas knob rewrites the probabilities of the rules
// (1/N, 1/(N−1), …, the rest); keep-alive shows why the balance looks unequal.

import { defineModel } from '../../../core/define';
import { bi, fmt, t, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { D, edge, metric, node } from './kit';

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

export const servicePathModel = defineModel<P>({
  id: 'k8s.service-path',
  block: 'k8s-1',
  title: bi('Запрос через Service и kube-proxy', 'A request through a Service and kube-proxy'),
  summary: bi('ClusterIP не висит ни на одном интерфейсе. Это адрес, который ядро узла подменяет на IP одного из подов по правилам, которые kube-proxy написал из EndpointSlice.', 'A ClusterIP is not on any interface. It is an address the node kernel replaces with the IP of one of the pods, by rules kube-proxy wrote from the EndpointSlice.'),
  concepts: ['k8s.service', 'k8s.kube-proxy', 'k8s.endpointslice'],
  diagram: {
    width: 960,
    height: 500,
    nodes: [
      node('client', bi('под client', 'pod client'), 'process', 'box', 24, 40, 180, 56, bi('Делает curl http://web: сначала DNS, потом connect() к полученному адресу.', 'Runs curl http://web: DNS first, then connect() to the address it got.'), bi('вы', 'you'), 'kubectl exec client -- curl -v http://web', D.service, '10.42.0.40'),
      node('dns', 'CoreDNS', 'l7', 'box', 24, 170, 180, 52, bi('Отвечает на web.default.svc.cluster.local адресом ClusterIP 10.43.12.7.', 'Answers web.default.svc.cluster.local with the ClusterIP 10.43.12.7.'), bi('kube-system', 'kube-system'), 'kubectl exec client -- nslookup web', D.dns),
      node('nf', bi('ядро узла: netfilter (nat)', 'node kernel: netfilter (nat)'), 'kernel', 'bar', 24, 290, 912, 64, bi('Цепочки KUBE-SERVICES → KUBE-SVC-… → KUBE-SEP-…: пакет на ClusterIP получает DNAT на IP пода. Ответ conntrack переводит обратно.', 'Chains KUBE-SERVICES → KUBE-SVC-… → KUBE-SEP-…: a packet to the ClusterIP gets DNAT to a pod IP. conntrack translates the reply back.'), bi('kube-proxy пишет правила; ядро их исполняет', 'kube-proxy writes the rules; the kernel executes them'), 'cluster iptables worker-1', D.vip, 'KUBE-SVC-LOLE4ISW44XBNF3G'),
      node('svc', bi('Service web', 'Service web'), 'l4', 'pill', 300, 40, 220, 56, bi('Объект: селектор app=web, port 80 → targetPort 80. ClusterIP 10.43.12.7 — запись в объекте, а не интерфейс.', 'An object: selector app=web, port 80 → targetPort 80. ClusterIP 10.43.12.7 is a field of the object, not an interface.'), bi('вы (kubectl expose / apply)', 'you (kubectl expose / apply)'), 'kubectl get svc web -o wide', D.service, '10.43.12.7:80'),
      node('slice', bi('EndpointSlice web-…', 'EndpointSlice web-…'), 'obj', 'doc', 300, 150, 220, 80, bi('Список готовых адресов подов, которые выбрал селектор. Неготовый под здесь есть, но с ready: false.', 'The list of ready addresses of the pods the selector picked. A not-ready pod is listed too, with ready: false.'), bi('контроллер EndpointSlice', 'the EndpointSlice controller'), 'kubectl get endpointslices -l kubernetes.io/service-name=web', D.slices, t(bi('готовых: 3', '3 ready'))),
      node('kp', 'kube-proxy', 'l4', 'box', 600, 160, 180, 52, bi('Смотрит Service и EndpointSlice и переписывает правила ядра своего узла. Сам пакеты не пересылает.', 'Watches Services and EndpointSlices and rewrites its node’s kernel rules. It does not forward packets itself.'), bi('DaemonSet / k3s', 'a DaemonSet / k3s'), 'cluster iptables worker-1', D.vip),
      node('p1', 'web-1', 'process', 'box', 300, 410, 170, 52, bi('Под Service: слушает 80.', 'A Service pod: listens on 80.'), bi('ReplicaSet', 'the ReplicaSet'), undefined, D.service, POD_IPS[0]),
      node('p2', 'web-2', 'process', 'box', 520, 410, 170, 52, bi('Под Service: слушает 80.', 'A Service pod: listens on 80.'), bi('ReplicaSet', 'the ReplicaSet'), undefined, D.service, POD_IPS[1]),
      node('p3', 'web-3', 'process', 'box', 740, 410, 170, 52, bi('Под Service: слушает 80.', 'A Service pod: listens on 80.'), bi('ReplicaSet', 'the ReplicaSet'), undefined, D.service, POD_IPS[2]),
    ],
    edges: [
      edge('e-dns', 'client', 'dns', 'A web? → 10.43.12.7', bi('DNS-запрос имени Service.', 'A DNS query for the Service name.'), bi('резолвер пода', 'the pod resolver')),
      edge('e-conn', 'client', 'nf', 'connect 10.43.12.7:80', bi('Пакет уходит на ClusterIP — и попадает в цепочки netfilter узла.', 'The packet goes to the ClusterIP — and enters the node’s netfilter chains.'), bi('ядро', 'the kernel'), { via: [[230, 68], [230, 290]], labelAt: 0.55 }),
      edge('e-sel', 'svc', 'slice', 'selector app=web', bi('Контроллер EndpointSlice ищет поды по селектору и пишет их адреса.', 'The EndpointSlice controller finds pods by the selector and writes their addresses.'), bi('kube-controller-manager', 'kube-controller-manager')),
      edge('e-watch', 'slice', 'kp', 'watch', bi('kube-proxy получает адреса и пересчитывает правила.', 'kube-proxy gets the addresses and recomputes the rules.'), bi('kube-proxy', 'kube-proxy')),
      edge('e-rules', 'kp', 'nf', 'iptables-restore', bi('Новые правила загружаются в ядро одной транзакцией.', 'The new rules are loaded into the kernel in one transaction.'), bi('kube-proxy', 'kube-proxy')),
      edge('e-p1', 'nf', 'p1', 'DNAT → :80', bi('Правило KUBE-SEP подменило адрес назначения на IP этого пода.', 'A KUBE-SEP rule replaced the destination with this pod’s IP.'), bi('ядро', 'the kernel')),
      edge('e-p2', 'nf', 'p2', 'DNAT → :80', bi('Правило KUBE-SEP подменило адрес назначения на IP этого пода.', 'A KUBE-SEP rule replaced the destination with this pod’s IP.'), bi('ядро', 'the kernel')),
      edge('e-p3', 'nf', 'p3', 'DNAT → :80', bi('Правило KUBE-SEP подменило адрес назначения на IP этого пода.', 'A KUBE-SEP rule replaced the destination with this pod’s IP.'), bi('ядро', 'the kernel')),
    ],
  },
  params: [
    {
      id: 'replicas',
      label: bi('replicas', 'replicas'),
      kind: 'range',
      min: 1,
      max: 5,
      step: 1,
      default: 3,
      near: 'slice',
      predict: {
        prompt: bi('Подов стало больше. Какая вероятность у первого правила KUBE-SEP?', 'There are more pods now. What is the probability of the first KUBE-SEP rule?'),
        options: [
          { id: 'inv', text: bi('1/N — по числу подов', '1/N — by the number of pods') },
          { id: 'half', text: bi('Всегда 0.5', 'Always 0.5') },
        ],
        resolve: () => 'inv',
      },
    },
    { id: 'mode', label: bi('Режим kube-proxy', 'kube-proxy mode'), kind: 'choice', default: 'iptables', options: [{ id: 'iptables', label: bi('iptables', 'iptables') }, { id: 'nftables', label: bi('nftables', 'nftables') }, { id: 'ipvs', label: bi('IPVS (устаревший)', 'IPVS (deprecated)') }], near: 'kp', levels: ['intermediate', 'experienced'] },
    {
      id: 'keepalive',
      label: bi('Клиент держит соединение (keep-alive)', 'The client keeps the connection (keep-alive)'),
      kind: 'toggle',
      default: false,
      near: 'client',
      predict: {
        prompt: bi('Клиент шлёт 100 запросов по одному соединению. Как они разойдутся по подам?', 'The client sends 100 requests over one connection. How do they spread over the pods?'),
        options: [
          { id: 'one', text: bi('Все на один под', 'All to one pod') },
          { id: 'equal', text: bi('Поровну', 'Equally') },
        ],
        resolve: (_p, n) => (metric(n, 'pod1') === 100 ? 'one' : 'equal'),
      },
    },
    {
      id: 'unready',
      label: bi('Проба готовности web-2 не проходит', 'The web-2 readiness probe fails'),
      kind: 'toggle',
      default: false,
      near: 'p2',
      levels: ['intermediate', 'experienced'],
      predict: {
        prompt: bi('web-2 не готов. Его перезапустят?', 'web-2 is not ready. Will it be restarted?'),
        options: [
          { id: 'out', text: bi('Нет: его просто уберут из правил, процесс живёт', 'No: it is just removed from the rules, the process lives on') },
          { id: 'restart', text: bi('Да, kubelet перезапустит контейнер', 'Yes, the kubelet restarts the container') },
        ],
        resolve: () => 'out',
      },
    },
  ],
  breaks: [
    { id: 'selector', label: bi('Селектор не совпадает с метками (app: wbe)', 'The selector does not match the labels (app: wbe)'), remove: ['e-sel'], layer: 'L4', boundary: 'network', predict: { prompt: bi('Селектор с опечаткой. Что скажет curl?', 'The selector has a typo. What does curl say?'), options: [{ id: 'refused', text: bi('Connection refused — сразу', 'Connection refused — at once') }, { id: 'timeout', text: bi('Тайм-аут', 'A timeout') }, { id: 'dns', text: bi('Could not resolve host', 'Could not resolve host') }], resolve: () => 'refused' } },
    { id: 'targetport', label: bi('targetPort 8080, а под слушает 80', 'targetPort 8080, but the pod listens on 80'), remove: ['e-p1', 'e-p2', 'e-p3'], layer: 'L4', boundary: 'network', predict: { prompt: bi('Service шлёт на 8080, процесс слушает 80. Что будет?', 'The Service sends to 8080, the process listens on 80. What happens?'), options: [{ id: 'rst', text: bi('Под ответит RST — Connection refused', 'The pod answers RST — Connection refused') }, { id: 'ok', text: bi('Kubernetes возьмёт containerPort', 'Kubernetes takes containerPort instead') }], resolve: () => 'rst' } },
    { id: 'no-kp', label: bi('kube-proxy остановлен (Service создан после остановки)', 'kube-proxy stopped (the Service was created after that)'), remove: ['kp', 'e-watch', 'e-rules'], layer: 'L4', boundary: 'network', predict: { prompt: bi('kube-proxy не работает, Service новый. Что скажет curl?', 'kube-proxy is down, the Service is new. What does curl say?'), options: [{ id: 'timeout', text: bi('Тайм-аут: правила для этого ClusterIP нет', 'A timeout: there is no rule for this ClusterIP') }, { id: 'refused', text: bi('Connection refused', 'Connection refused') }], resolve: () => 'timeout' } },
  ],
  metrics: [
    { id: 'pod1', label: bi('запросов на web-1 из 100', 'requests to web-1 of 100') },
    { id: 'pod2', label: bi('на web-2', 'to web-2') },
    { id: 'pod3', label: bi('на web-3', 'to web-3') },
  ],
  run(p, broken): Step[] {
    const s: Step[] = [];
    const total = Math.min(p.replicas, 5);
    const ready = Array.from({ length: total }, (_, i) => !(p.unready && i === 1));
    const readyIdx = ready.map((r, i) => (r ? i : -1)).filter((i) => i >= 0);
    const dist = distribution(readyIdx.length, p.keepalive);
    const per = [0, 0, 0];
    readyIdx.forEach((idx, k) => {
      if (idx < 3) per[idx] = dist[k];
    });
    const metrics = { pod1: per[0], pod2: per[1], pod3: per[2] };
    const offPods: Record<string, 'off'> = {};
    for (let i = total; i < 3; i++) offPods[`p${i + 1}`] = 'off';
    s.push({ id: 'dns', label: 'DNS', caption: bi('Клиент спрашивает CoreDNS: web.default.svc.cluster.local → 10.43.12.7 (ClusterIP Service).', 'The client asks CoreDNS: web.default.svc.cluster.local → 10.43.12.7 (the Service ClusterIP).'), focus: ['client', 'e-dns', 'dns'], tokens: [{ edge: 'e-dns', label: 'web?' }], states: { ...offPods }, metrics: { pod1: 0, pod2: 0, pod3: 0 } });
    if (broken.has('selector')) {
      s.push({ id: 'empty', label: bi('пусто', 'empty'), caption: bi('Селектор app: wbe не находит ни одного пода: EndpointSlice пуст, и kube-proxy пишет для этого ClusterIP правило REJECT.', 'The selector app: wbe finds no pods: the EndpointSlice is empty, and kube-proxy writes a REJECT rule for this ClusterIP.'), focus: ['svc', 'slice', 'nf'], states: { slice: 'err' }, values: { slice: '0 endpoints', nf: '-j REJECT' }, metrics: { pod1: 0, pod2: 0, pod3: 0 }, broken: { at: 'slice', message: '-A KUBE-SERVICES -d 10.43.12.7/32 -p tcp -m comment --comment "default/web has no endpoints" -m tcp --dport 80 -j REJECT --reject-with icmp-port-unreachable\n$ kubectl exec client -- curl -sS http://web\ncurl: (7) Failed to connect to web port 80 after 2 ms: Couldn\'t connect to server', caption: bi('Service находит поды только по меткам: проверьте `kubectl get endpointslices` и `kubectl get pods --show-labels`.', 'A Service finds pods only by labels: check `kubectl get endpointslices` and `kubectl get pods --show-labels`.') } });
      return s;
    }
    s.push({ id: 'slice', label: 'EndpointSlice', caption: fmt(bi('EndpointSlice знает {n} адрес(а) подов с app=web; готовых — {r}.', 'The EndpointSlice knows {n} pod address(es) with app=web; {r} ready.'), { n: total, r: readyIdx.length }), focus: ['svc', 'e-sel', 'slice'], values: { slice: `${readyIdx.length} ready${p.unready ? ', web-2 ready: false' : ''}` }, states: p.unready ? { p2: 'warn' } : {} });
    if (broken.has('no-kp')) {
      s.push({ id: 'norule', label: bi('нет правила', 'no rule'), caption: bi('Адреса подов в EndpointSlice есть, но kube-proxy не работает — правила для нового ClusterIP нет. Пакет на 10.43.12.7 уходит по маршруту по умолчанию в никуда.', 'The pod addresses are in the EndpointSlice, but kube-proxy is not running — there is no rule for the new ClusterIP. The packet to 10.43.12.7 leaves through the default route into nowhere.'), focus: ['kp', 'nf'], states: { kp: 'off' }, metrics: { pod1: 0, pod2: 0, pod3: 0 }, broken: { at: 'nf', message: '$ kubectl exec client -- curl -sS http://web\ncurl: (28) Failed to connect to web port 80 after 130412 ms: Couldn\'t connect to server', caption: bi('старые Service продолжают работать (их правила остались в ядре), новые — нет: kube-proxy только пишет правила, пакеты пересылает ядро.', 'old Services keep working (their rules stay in the kernel), new ones do not: kube-proxy only writes rules, the kernel forwards packets.') } });
      return s;
    }
    const probs = ruleProbabilities(readyIdx.length).map((x) => x.toFixed(5));
    const modeText: Record<string, Bi> = {
      iptables: fmt(bi('kube-proxy (iptables) записал цепочку KUBE-SVC с правилами KUBE-SEP: вероятности {p} — каждое следующее правило делит остаток, поэтому доли равные.', 'kube-proxy (iptables) wrote a KUBE-SVC chain with KUBE-SEP rules: probabilities {p} — each next rule splits what is left, so the shares are equal.'), { p: probs.join(', ') }),
      nftables: bi('kube-proxy (nftables) записал в таблицу ip kube-proxy карту: numgen random mod N vmap { 0 : endpoint-…, 1 : … } — та же логика одной операцией.', 'kube-proxy (nftables) wrote a map into the table ip kube-proxy: numgen random mod N vmap { 0 : endpoint-…, 1 : … } — the same logic in one operation.'),
      ipvs: bi('Режим IPVS: ClusterIP висит на фиктивном интерфейсе kube-ipvs0, балансирует модуль ядра IPVS. Режим объявлен устаревшим — в новых кластерах iptables или nftables.', 'IPVS mode: the ClusterIP sits on the dummy interface kube-ipvs0, the IPVS kernel module balances. The mode is deprecated — new clusters use iptables or nftables.'),
    };
    s.push({ id: 'rules', label: bi('правила', 'rules'), caption: modeText[p.mode] ?? modeText.iptables, focus: ['e-watch', 'kp', 'e-rules', 'nf'], tokens: [{ edge: 'e-watch' }, { edge: 'e-rules', label: 'iptables-restore' }], values: { nf: p.mode === 'nftables' ? 'numgen random mod ' + readyIdx.length : `KUBE-SVC → ${readyIdx.length} × KUBE-SEP` } });
    s.push({ id: 'connect', label: 'connect', caption: bi('Клиент открывает соединение на 10.43.12.7:80. Ни у одного интерфейса нет этого адреса — пакет перехватывает цепочка KUBE-SERVICES ещё до маршрутизации.', 'The client connects to 10.43.12.7:80. No interface has this address — the KUBE-SERVICES chain catches the packet before routing.'), focus: ['e-conn', 'nf'], tokens: [{ edge: 'e-conn', label: 'dst 10.43.12.7:80' }] });
    if (broken.has('targetport')) {
      s.push({ id: 'rst', label: 'RST', caption: bi('DNAT отправил пакет на 10.42.1.15:8080, но процесс в поде слушает 80: ядро пода отвечает RST.', 'DNAT sent the packet to 10.42.1.15:8080, but the process in the pod listens on 80: the pod kernel answers RST.'), focus: ['nf', 'p1'], states: { p1: 'err' }, metrics: { pod1: 0, pod2: 0, pod3: 0 }, broken: { at: 'p1', message: '$ kubectl exec client -- curl -sS http://web\ncurl: (7) Failed to connect to web port 80 after 1 ms: Couldn\'t connect to server', caption: bi('Service шлёт на targetPort; containerPort — только описание. Какой порт слушает процесс, покажет `kubectl exec <pod> -- ss -ltn`.', 'A Service sends to targetPort; containerPort is only a description. Which port the process listens on: `kubectl exec <pod> -- ss -ltn`.') } });
      return s;
    }
    const first = readyIdx[0] ?? 0;
    s.push({ id: 'dnat', label: 'DNAT', caption: fmt(bi('Правило KUBE-SEP выбрано случайно: адрес назначения 10.43.12.7:80 заменён на {ip}:80. Дальше пакет идёт как обычный пакет из пода в под.', 'A KUBE-SEP rule was chosen at random: the destination 10.43.12.7:80 is replaced with {ip}:80. From here the packet goes like any pod-to-pod packet.'), { ip: POD_IPS[first] }), focus: [`e-p${first + 1}`, `p${first + 1}`], tokens: [{ edge: `e-p${first + 1}`, label: `dst ${POD_IPS[first]}:80` }], states: { [`p${first + 1}`]: 'ok' } });
    s.push({ id: 'reply', label: bi('ответ', 'reply'), caption: bi('Ответ пода идёт с его IP; conntrack помнит трансляцию и возвращает источник 10.43.12.7 — клиент так и не узнал адрес пода.', 'The pod replies from its IP; conntrack remembers the translation and restores the source 10.43.12.7 — the client never learns the pod address.'), focus: ['nf', 'e-conn'], tokens: [{ edge: 'e-conn', reverse: true, label: 'src 10.43.12.7' }] });
    s.push({ id: 'hundred', label: '×100', caption: p.keepalive ? bi('100 запросов по одному соединению: правило выбирается при установке соединения, дальше conntrack ведёт его на тот же под. Отсюда «неравная» балансировка.', '100 requests over one connection: the rule is chosen when the connection is set up, then conntrack keeps it on the same pod. Hence the "unequal" balancing.') : fmt(bi('100 новых соединений разошлись почти поровну: {d}.', '100 new connections spread almost equally: {d}.'), { d: readyIdx.map((i, k) => `web-${i + 1} ${dist[k]}`).join(', ') }), focus: ['p1', 'p2', 'p3'].slice(0, total), metrics });
    return s;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('Поломка: путь остановился там, где это видно и в настоящем кластере.', 'A break: the path stops where you would see it in a real cluster too.') : bi('Поломка убрана: запрос снова доходит до пода.', 'The break is removed: the request reaches a pod again.');
    switch (change.id) {
      case 'replicas': {
        const n = b.replicas as number;
        return fmt(bi('{n} подов: вероятности правил {p} — так каждый под получает 1/{n} соединений.', '{n} pods: rule probabilities {p} — so every pod gets 1/{n} of the connections.'), { n, p: ruleProbabilities(n).map((x) => x.toFixed(2)).join(', ') });
      }
      case 'keepalive':
        return b.keepalive ? bi('Keep-alive: одно соединение — один выбор правила — все запросы на один под.', 'Keep-alive: one connection — one choice of rule — all requests to one pod.') : bi('Каждый запрос — новое соединение и новый выбор правила.', 'Every request is a new connection and a new choice of rule.');
      case 'unready':
        return b.unready ? fmt(bi('web-2 неготов: в EndpointSlice ready: false, правила KUBE-SEP для него нет — процесс жив, но трафика не получает. Теперь {d}.', 'web-2 is not ready: ready: false in the EndpointSlice, no KUBE-SEP rule for it — the process lives but gets no traffic. Now {d}.'), { d: `web-1 ${metric(next, 'pod1')}, web-3 ${metric(next, 'pod3')}` }) : bi('web-2 снова готов и вернулся в правила.', 'web-2 is ready again and back in the rules.');
      case 'mode':
        return b.mode === 'ipvs' ? bi('IPVS: та же идея, другой механизм ядра; режим устаревший.', 'IPVS: the same idea, another kernel mechanism; the mode is deprecated.') : fmt(bi('Режим {m}: правила другие по форме, решение то же — DNAT на один из готовых подов.', 'Mode {m}: the rules look different, the decision is the same — DNAT to one of the ready pods.'), { m: b.mode as string });
    }
    return bi('Путь пересчитан.', 'The path is recomputed.');
  },
});
