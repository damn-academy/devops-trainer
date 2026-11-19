// Э8 (05 §6.10): from outside to a pod, and where 502 and 504 come from.
// Client → node:NodePort (or an external load balancer) → the pod of the
// Gateway/Ingress controller (a reverse proxy) → HTTPRoute → Service →
// pod. The proxy starts a new TCP connection to the pod; when the pod is
// slower than the proxy timeout, the 504 comes from the proxy, not the app.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { D, edge, metric, node } from './kit';

type P = { entry: string; api: string; etp: string; response: number; timeout: number };

export const ingressPathModel = defineModel<P>({
  id: 'k8s.ingress-path',
  block: 'k8s-1',
  title: bi('Снаружи до пода: NodePort, балансировщик, Gateway', 'From outside to a pod: NodePort, a load balancer, a Gateway'),
  summary: bi('Запрос из интернета проходит через порт узла или внешний балансировщик, затем через обратный прокси контроллера входа, и только потом — через обычный Service к поду.', 'A request from the internet passes a node port or an external load balancer, then the reverse proxy of the ingress controller, and only then an ordinary Service to the pod.'),
  concepts: ['k8s.nodeport', 'k8s.ingress', 'k8s.gateway-api'],
  diagram: {
    width: 960,
    height: 400,
    nodes: [
      node('client', bi('браузер', 'browser'), 'user', 'box', 20, 40, 150, 56, bi('Клиент из интернета: 203.0.113.50.', 'A client on the internet: 203.0.113.50.'), bi('пользователь', 'a user'), 'curl -v -H "Host: shop.example.test" http://<node-ip>:<nodePort>/', D.ingress, '203.0.113.50'),
      node('lb', bi('балансировщик', 'load balancer'), 'l4', 'box', 210, 40, 150, 56, bi('Внешний IP Service типа LoadBalancer: облачный балансировщик, ServiceLB в k3s или MetalLB. Ведёт на NodePort узлов.', 'The external IP of a LoadBalancer Service: a cloud load balancer, ServiceLB in k3s or MetalLB. It leads to the node ports.'), bi('cloud-controller-manager / ServiceLB / MetalLB', 'cloud-controller-manager / ServiceLB / MetalLB'), 'kubectl get svc -A', D.service),
      node('node', 'worker-1 :30443', 'node', 'rack', 400, 30, 170, 76, bi('NodePort: порт 30000–32767 открыт на каждом узле; правило KUBE-NODEPORTS ведёт его на Service контроллера входа.', 'A NodePort: a port 30000–32767 open on every node; a KUBE-NODEPORTS rule leads it to the ingress controller Service.'), bi('kube-proxy', 'kube-proxy'), 'cluster iptables worker-1', D.service, 'KUBE-NODEPORTS'),
      node('proxy', bi('контроллер входа (traefik)', 'ingress controller (traefik)'), 'l7', 'box', 610, 40, 190, 56, bi('Обратный прокси под: принимает HTTP(S), выбирает маршрут по имени хоста и пути и открывает НОВОЕ соединение к Service приложения.', 'A reverse proxy pod: accepts HTTP(S), picks a route by host name and path and opens a NEW connection to the application Service.'), bi('Helm-чарт контроллера (в k3s — Traefik)', 'the controller Helm chart (Traefik in k3s)'), 'kubectl -n kube-system logs deploy/traefik', D.gateway),
      node('route', bi('HTTPRoute / Ingress', 'HTTPRoute / Ingress'), 'obj', 'doc', 610, 150, 190, 76, bi('Правило: shop.example.test, путь / → Service web:80. Его читает контроллер входа, а не kube-proxy.', 'The rule: shop.example.test, path / → Service web:80. The ingress controller reads it, not kube-proxy.'), bi('команда приложения', 'the application team'), 'kubectl describe httproute web', D.gateway),
      node('svc', bi('Service web', 'Service web'), 'l4', 'pill', 400, 280, 170, 50, bi('Обычный ClusterIP: от прокси до пода путь тот же, что в Э7.', 'An ordinary ClusterIP: from the proxy to the pod the path is the same as in the Service explainer.'), bi('вы', 'you'), 'kubectl get endpointslices -l kubernetes.io/service-name=web', D.service),
      node('pod', bi('под web', 'pod web'), 'process', 'box', 640, 280, 160, 56, bi('Приложение. Его время ответа — ползунок.', 'The application. Its response time is a knob.'), bi('Deployment', 'the Deployment'), undefined, D.service, '10.42.1.15:80'),
    ],
    edges: [
      edge('e-in', 'client', 'lb', 'GET / Host: shop.example.test', bi('HTTP-запрос клиента.', 'The client’s HTTP request.'), bi('браузер', 'the browser')),
      edge('e-np', 'lb', 'node', 'dst node:30443', bi('Балансировщик (или клиент напрямую) приходит на NodePort узла.', 'The load balancer (or the client directly) arrives at the node port.'), bi('балансировщик', 'the load balancer')),
      edge('e-dnat', 'node', 'proxy', 'DNAT → proxy pod', bi('kube-proxy переводит NodePort на под контроллера входа (при externalTrafficPolicy: Cluster ещё и SNAT на IP узла).', 'kube-proxy translates the NodePort to the ingress controller pod (with externalTrafficPolicy: Cluster also SNAT to the node IP).'), bi('kube-proxy', 'kube-proxy')),
      edge('e-route', 'proxy', 'route', 'match host + path', bi('Прокси ищет правило по Host и пути.', 'The proxy finds the rule by Host and path.'), bi('контроллер входа', 'the ingress controller')),
      edge('e-svc', 'proxy', 'svc', bi('новое TCP → web:80', 'new TCP → web:80'), bi('Новое соединение от прокси к Service. Клиентский IP теперь в заголовке X-Forwarded-For.', 'A new connection from the proxy to the Service. The client IP now travels in the X-Forwarded-For header.'), bi('контроллер входа', 'the ingress controller'), { via: [[700, 250], [485, 250]], labelAt: 0.5 }),
      edge('e-pod', 'svc', 'pod', 'DNAT → pod', bi('Обычный путь Service → под.', 'The ordinary Service → pod path.'), bi('kube-proxy', 'kube-proxy')),
    ],
  },
  params: [
    { id: 'entry', label: bi('Вход', 'Entry'), kind: 'choice', default: 'lb', options: [{ id: 'nodeport', label: bi('прямо на NodePort', 'straight to the NodePort') }, { id: 'lb', label: bi('через LoadBalancer', 'through a LoadBalancer') }], near: 'lb' },
    { id: 'api', label: bi('Объект правила', 'The rule object'), kind: 'choice', default: 'gateway', options: [{ id: 'gateway', label: bi('Gateway API (HTTPRoute)', 'Gateway API (HTTPRoute)') }, { id: 'ingress', label: bi('Ingress (наследие)', 'Ingress (legacy)') }], near: 'route' },
    {
      id: 'etp',
      label: bi('externalTrafficPolicy', 'externalTrafficPolicy'),
      kind: 'choice',
      default: 'Cluster',
      options: [
        { id: 'Cluster', label: bi('Cluster', 'Cluster') },
        { id: 'Local', label: bi('Local', 'Local') },
      ],
      near: 'node',
      levels: ['intermediate', 'experienced'],
      predict: {
        prompt: bi('externalTrafficPolicy: Local. Какой IP клиента увидит контроллер входа?', 'externalTrafficPolicy: Local. Which client IP does the ingress controller see?'),
        options: [
          { id: 'real', text: bi('Настоящий: 203.0.113.50', 'The real one: 203.0.113.50') },
          { id: 'node', text: bi('IP узла', 'The node IP') },
        ],
        resolve: (_p, n) => (n.some((s) => s.id === 'local') ? 'real' : 'node'),
      },
    },
    {
      id: 'response',
      label: bi('Время ответа пода, с', 'Pod response time, s'),
      kind: 'range',
      min: 0,
      max: 60,
      step: 5,
      default: 0,
      near: 'pod',
      predict: {
        prompt: bi('Под отвечает дольше таймаута прокси. Кто отдаст клиенту ошибку?', 'The pod answers slower than the proxy timeout. Who gives the client the error?'),
        options: [
          { id: 'proxy', text: bi('Прокси: 504 Gateway Timeout', 'The proxy: 504 Gateway Timeout') },
          { id: 'app', text: bi('Приложение: 500', 'The application: 500') },
        ],
        resolve: (_p, n) => (metric(n, 'status') === 504 ? 'proxy' : 'app'),
      },
    },
    { id: 'timeout', label: bi('Таймаут прокси, с', 'Proxy timeout, s'), kind: 'range', min: 5, max: 60, step: 5, default: 30, near: 'proxy' },
  ],
  breaks: [
    { id: 'no-pods', label: bi('У Service нет готовых подов', 'The Service has no ready pods'), remove: ['e-pod'], layer: 'L7', boundary: 'network', predict: { prompt: bi('Готовых подов нет. Что получит браузер?', 'There are no ready pods. What does the browser get?'), options: [{ id: '503', text: bi('503 от прокси', '503 from the proxy') }, { id: 'timeout', text: bi('Тайм-аут соединения', 'A connection timeout') }], resolve: () => '503' } },
    { id: 'reset', label: bi('Приложение закрывает соединение', 'The application closes the connection'), remove: ['e-svc'], layer: 'L7', boundary: 'network', predict: { prompt: bi('Под оборвал соединение посреди ответа. Что получит браузер?', 'The pod dropped the connection mid-response. What does the browser get?'), options: [{ id: '502', text: bi('502 Bad Gateway от прокси', '502 Bad Gateway from the proxy') }, { id: '500', text: bi('500 от приложения', '500 from the application') }], resolve: () => '502' } },
  ],
  metrics: [
    { id: 'status', label: bi('код ответа', 'status code') },
    { id: 'seconds', label: bi('ждали', 'waited'), unit: 's' },
  ],
  run(p, broken): Step[] {
    const s: Step[] = [];
    if (p.entry === 'lb') s.push({ id: 'lb', label: 'LB', caption: bi('Браузер идёт на внешний IP. Балансировщик выбирает узел и отправляет на его NodePort.', 'The browser goes to the external IP. The load balancer picks a node and sends to its NodePort.'), focus: ['client', 'e-in', 'lb', 'e-np'], tokens: [{ edge: 'e-in', label: 'GET /' }, { edge: 'e-np' }], metrics: { status: 0, seconds: 0 } });
    else s.push({ id: 'np', label: 'NodePort', caption: bi('Браузер идёт прямо на IP узла и порт 30443 — так можно и без балансировщика, но клиент должен знать узлы.', 'The browser goes straight to a node IP and port 30443 — possible without a load balancer, but the client has to know the nodes.'), focus: ['client', 'e-np', 'node'], tokens: [{ edge: 'e-np', label: 'GET /' }], metrics: { status: 0, seconds: 0 } });
    s.push(
      p.etp === 'Local'
        ? { id: 'local', label: 'Local', caption: bi('externalTrafficPolicy: Local — узел шлёт только на поды прокси на себе, без SNAT: прокси видит настоящий IP 203.0.113.50. Узел без такого пода не отвечает, и балансировщик его исключает.', 'externalTrafficPolicy: Local — the node sends only to proxy pods on itself, without SNAT: the proxy sees the real IP 203.0.113.50. A node without such a pod does not answer, and the load balancer drops it.'), focus: ['node', 'e-dnat', 'proxy'], tokens: [{ edge: 'e-dnat', label: 'src 203.0.113.50' }] }
        : { id: 'cluster', label: 'Cluster', caption: bi('externalTrafficPolicy: Cluster — узел может отправить на под прокси на соседнем узле и для этого делает SNAT: прокси видит IP узла, а не клиента.', 'externalTrafficPolicy: Cluster — the node may send to a proxy pod on another node and SNATs for that: the proxy sees the node IP, not the client.'), focus: ['node', 'e-dnat', 'proxy'], tokens: [{ edge: 'e-dnat', label: 'src 192.168.56.12' }] },
    );
    s.push({ id: 'route', label: p.api === 'gateway' ? 'HTTPRoute' : 'Ingress', caption: p.api === 'gateway' ? bi('Прокси находит HTTPRoute: Host shop.example.test, путь / → Service web:80. Роли разделены: GatewayClass — инфраструктура, Gateway — администратор, HTTPRoute — команда приложения.', 'The proxy finds the HTTPRoute: Host shop.example.test, path / → Service web:80. The roles are split: GatewayClass — infrastructure, Gateway — the cluster admin, HTTPRoute — the application team.') : bi('Прокси находит правило Ingress: host shop.example.test, path / → service web port 80. Ingress — заморожено; ingress-nginx снят с поддержки в марте 2026.', 'The proxy finds the Ingress rule: host shop.example.test, path / → service web port 80. Ingress is frozen; ingress-nginx was retired in March 2026.'), focus: ['proxy', 'e-route', 'route'], tokens: [{ edge: 'e-route' }] });
    if (broken.has('no-pods')) {
      s.push({ id: '503', label: '503', caption: bi('У Service web нет готовых адресов: прокси некуда отправить запрос, и ответ клиенту формирует он сам.', 'The web Service has no ready addresses: the proxy has nowhere to send the request, and it builds the reply itself.'), focus: ['proxy', 'svc'], states: { svc: 'err' }, metrics: { status: 503, seconds: 0 }, broken: { at: 'svc', message: 'HTTP/1.1 503 Service Unavailable\ncontent-length: 19\n\nno available server', caption: bi('503 пришёл от прокси: поищите причину в EndpointSlice и пробах готовности, а не в коде приложения.', '503 came from the proxy: look for the cause in the EndpointSlice and readiness probes, not in the application code.') } });
      return s;
    }
    s.push({ id: 'new-conn', label: bi('новое соединение', 'new connection'), caption: bi('Прокси открывает новое TCP-соединение к web:80 — дальше обычный путь Service → под. Исходный IP клиента едет в X-Forwarded-For.', 'The proxy opens a new TCP connection to web:80 — then the ordinary Service → pod path. The original client IP travels in X-Forwarded-For.'), focus: ['e-svc', 'svc', 'e-pod', 'pod'], tokens: [{ edge: 'e-svc', label: 'X-Forwarded-For' }, { edge: 'e-pod' }] });
    if (broken.has('reset')) {
      s.push({ id: '502', label: '502', caption: bi('Под оборвал соединение посреди ответа: прокси не получил корректного ответа от «вышестоящего» сервера.', 'The pod dropped the connection mid-response: the proxy got no valid reply from the "upstream" server.'), focus: ['e-svc', 'proxy'], states: { proxy: 'err' }, metrics: { status: 502, seconds: 0 }, broken: { at: 'e-svc', message: 'HTTP/1.1 502 Bad Gateway\n\nBad Gateway', caption: bi('502 — это прокси говорит о том, кто за ним: ищите в логах пода и в его перезапусках.', '502 is the proxy speaking about what is behind it: look in the pod logs and its restarts.') } });
      return s;
    }
    if (p.response > p.timeout) {
      s.push({ id: '504', label: '504', caption: fmt(bi('Под отвечает {r} с, а прокси ждёт {t} с: прокси сдаётся первым и отдаёт клиенту 504 — приложение тут ни при чём, оно ещё работает над ответом.', 'The pod takes {r} s, the proxy waits {t} s: the proxy gives up first and returns 504 — the application has nothing to do with it, it is still working on the answer.'), { r: p.response, t: p.timeout }), focus: ['proxy', 'pod'], states: { proxy: 'warn' }, metrics: { status: 504, seconds: p.timeout } });
      return s;
    }
    s.push({ id: '200', label: '200', caption: fmt(bi('Под ответил за {r} с — меньше таймаута: ответ идёт обратно по тем же соединениям, клиент получает 200.', 'The pod answered in {r} s — under the timeout: the reply goes back along the same connections, the client gets 200.'), { r: p.response }), focus: ['pod', 'proxy', 'client'], states: { pod: 'ok', client: 'ok' }, metrics: { status: 200, seconds: p.response } });
    return s;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? fmt(bi('Код {c} — и отдаёт его прокси, а не приложение.', 'Status {c} — and the proxy gives it, not the application.'), { c: metric(next, 'status') }) : bi('Поломка убрана.', 'The break is removed.');
    switch (change.id) {
      case 'response':
      case 'timeout':
        return metric(next, 'status') === 504 ? fmt(bi('Ответ {r} с > таймаута {t} с → 504 от прокси.', 'Response {r} s > timeout {t} s → 504 from the proxy.'), { r: b.response as number, t: b.timeout as number }) : fmt(bi('Ответ {r} с ≤ таймаута {t} с → 200.', 'Response {r} s ≤ timeout {t} s → 200.'), { r: b.response as number, t: b.timeout as number });
      case 'etp':
        return b.etp === 'Local' ? bi('Local: без SNAT, прокси видит IP клиента; узлы без пода прокси выпадают из балансировщика.', 'Local: no SNAT, the proxy sees the client IP; nodes without a proxy pod drop out of the load balancer.') : bi('Cluster: SNAT на IP узла, зато любой узел может принять запрос.', 'Cluster: SNAT to the node IP, but any node can take the request.');
      case 'api':
        return b.api === 'gateway' ? bi('Gateway API: тот же путь, но правило — HTTPRoute, а вход описывает Gateway.', 'Gateway API: the same path, but the rule is an HTTPRoute and the entry is described by a Gateway.') : bi('Ingress: одно правило на всё; API заморожен, новые возможности идут в Gateway API.', 'Ingress: one object for everything; the API is frozen, new features go into the Gateway API.');
      case 'entry':
        return b.entry === 'lb' ? bi('Через LoadBalancer: внешний IP перед NodePort узлов.', 'Through a LoadBalancer: an external IP in front of the node ports.') : bi('Прямо на NodePort: работает, но клиенту нужно знать IP узлов.', 'Straight to the NodePort: it works, but the client must know the node IPs.');
    }
    return bi('Путь пересчитан.', 'The path is recomputed.');
  },
});
