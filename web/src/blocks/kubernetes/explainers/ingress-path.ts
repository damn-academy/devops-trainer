// Э8 (05 §6.10): from outside to a pod, and where 502 and 504 come from.
// Client → node:NodePort (or an external load balancer) → the pod of the
// Gateway/Ingress controller (a reverse proxy) → HTTPRoute → Service →
// pod. The proxy starts a new TCP connection to the pod; when the pod is
// slower than the proxy timeout, the 504 comes from the proxy, not the app.
//
// Reading order: at first only the browser and the pod are on screen; every
// hop between them appears when the request reaches it.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { box, D, edge, idsOf, LEGEND_BASE, mark, metric, only } from './kit';

type P = { entry: string; api: string; etp: string; response: number; timeout: number };

const PROXY = bi('Контроллер входа.', 'The ingress controller.');

const diagram = {
  width: 960,
  height: 460,
  nodes: [
    box('client', bi('Браузер', 'Browser'), 'user', 'box', [20, 40, 160, 56], 'browser', bi('Пользователь в интернете с адресом 203.0.113.50 открывает shop.example.test.', 'A user on the internet, 203.0.113.50.'), bi('Браузер принадлежит пользователю.', 'The user’s browser.'), { see: 'curl -v -H "Host: shop.example.test" http://<node-ip>:<nodePort>/', doc: D.ingress, sub: '203.0.113.50' }),
    box('lb', bi('Балансировщик', 'Load balancer'), 'l4', 'box', [210, 40, 160, 56], 'router', bi('Внешний адрес Service типа LoadBalancer. Его даёт облачный балансировщик, встроенный в k3s ServiceLB или MetalLB, и ведёт он на порт NodePort каждого узла.', 'The external IP of a LoadBalancer Service, leading to the node ports.'), bi('Создаёт cloud-controller-manager, ServiceLB или MetalLB.', 'cloud-controller-manager, ServiceLB or MetalLB.'), { see: 'kubectl get svc -A', doc: D.service }),
    box('node', 'worker-1 :30443', 'node', 'rack', [400, 30, 180, 76], 'server', bi('Порт NodePort из диапазона 30000–32767 открыт на каждом узле. Правило KUBE-NODEPORTS в ядре узла ведёт его на Service контроллера входа.', 'A NodePort open on every node; KUBE-NODEPORTS leads it to the ingress controller Service.'), bi('Правило пишет kube-proxy.', 'kube-proxy writes the rule.'), { see: 'cluster iptables worker-1', doc: D.service, sub: 'KUBE-NODEPORTS' }),
    box('proxy', bi('Контроллер входа (Traefik)', 'Ingress controller (Traefik)'), 'l7', 'box', [610, 40, 200, 56], 'process', bi('Обратный прокси, который работает подом. Он принимает HTTP и HTTPS, выбирает маршрут по имени сайта и пути и открывает к Service приложения новое соединение.', 'A reverse proxy pod: picks a route by host and path and opens a NEW connection to the Service.'), bi('Ставится Helm-чартом; в k3s это Traefik.', 'A Helm chart; Traefik in k3s.'), { see: 'kubectl -n kube-system logs deploy/traefik', doc: D.gateway }),
    box('route', bi('Правило маршрута', 'Route rule'), 'obj', 'doc', [610, 170, 200, 76], 'file', bi('Правило HTTPRoute или Ingress: сайт shop.example.test и путь / ведут на Service web, порт 80. Это правило читает контроллер входа, а не kube-proxy.', 'shop.example.test, path / → Service web:80; read by the ingress controller.'), bi('Правило пишет команда приложения.', 'The application team.'), { see: 'kubectl describe httproute web', doc: D.gateway }),
    box('svc', bi('Service web', 'Service web'), 'l4', 'pill', [400, 386, 180, 50], 'switch', bi('Обычный Service с адресом ClusterIP: от прокси до пода запрос идёт тем же путём, что вы видели на схеме Service.', 'An ordinary ClusterIP: the same path as in the Service diagram.'), bi('Service создали вы.', 'You created it.'), { see: 'kubectl get endpointslices -l kubernetes.io/service-name=web', doc: D.service }),
    box('pod', bi('Под web', 'Pod web'), 'process', 'box', [650, 383, 170, 56], 'container', bi('Приложение магазина. Сколько секунд оно готовит ответ, задаёт ручка «Сколько секунд под готовит ответ».', 'The application; its response time is a knob.'), bi('Под создал Deployment.', 'The Deployment.'), { doc: D.service, sub: '10.42.1.15:80' }),
  ],
  edges: [
    edge('e-in', 'client', 'lb', bi('запрос сайта', 'site request'), bi('HTTP-запрос браузера на внешний адрес.', 'The browser’s request.'), bi('Отправляет браузер.', 'The browser.')),
    edge('e-direct', 'client', 'node', bi('прямо на порт узла', 'straight to the node port'), bi('Без балансировщика браузер обращается прямо на адрес узла и порт NodePort.', 'Without a load balancer, straight to a node’s NodePort.'), bi('Отправляет браузер.', 'The browser.'), { via: [[100, 140], [490, 140]], labelAt: 0.5 }),
    edge('e-np', 'lb', 'node', bi('на порт узла', 'to the node port'), bi('Балансировщик отправляет запрос на порт NodePort одного из узлов.', 'The load balancer sends to a node port.'), bi('Отправляет балансировщик.', 'The load balancer.')),
    edge('e-dnat', 'node', 'proxy', bi('на под прокси', 'to the proxy pod'), bi('Ядро узла переводит NodePort на под контроллера входа. При externalTrafficPolicy: Cluster оно ещё и подменяет адрес отправителя на адрес узла.', 'The node translates to the proxy pod (Cluster also SNATs).'), bi('Правило пишет kube-proxy.', 'kube-proxy.')),
    edge('e-route', 'proxy', 'route', bi('сайт и путь', 'host and path'), bi('Прокси ищет правило по имени сайта (заголовок Host) и пути.', 'The proxy matches Host and path.'), PROXY),
    edge('e-svc', 'proxy', 'svc', bi('новое соединение', 'new connection'), bi('Новое соединение от прокси к Service. Адрес пользователя теперь передаётся в заголовке X-Forwarded-For.', 'A new connection; the client IP travels in X-Forwarded-For.'), PROXY, { via: [[596, 150], [490, 150]], labelAt: 0.6 }),
    edge('e-pod', 'svc', 'pod', bi('на под', 'to the pod'), bi('Обычный путь от Service к поду.', 'The ordinary Service → pod path.'), bi('Правило пишет kube-proxy.', 'kube-proxy.')),
  ],
};

const ALL = idsOf(diagram);

export const ingressPathModel = defineModel<P>({
  id: 'k8s.ingress-path',
  block: 'k8s-1',
  title: bi('Как запрос из интернета доходит до пода', 'How a request from the internet reaches a pod'),
  summary: bi(
    'Запрос из интернета сначала попадает на порт узла, напрямую или через внешний балансировщик, потом в обратный прокси контроллера входа, который по имени сайта и пути выбирает Service, и только затем через обычный Service доходит до пода. На этом пути у прокси свой тайм-аут, и ошибки 502, 503 и 504 часто пишет он, а не приложение.',
    'A request reaches a node port (directly or via a load balancer), then the ingress proxy that picks a Service by host and path, then the pod. The proxy has its own timeout, and 502, 503 and 504 often come from it.',
  ),
  intro: bi(
    'Сейчас на схеме браузер пользователя и под приложения. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». Участники между браузером и подом будут появляться, когда до них дойдёт запрос. Под схемой показан код ответа, который получит браузер. Потом увеличьте в «Параметрах» время ответа пода так, чтобы оно превысило тайм-аут прокси, и посмотрите, кто вернёт ошибку.',
    'For now: the browser and the pod. Press “Start from the first step” and go on with “Step forward”: the hops appear as the request reaches them. The status code is shown under the diagram. Then raise the pod’s response time above the proxy timeout and see who returns the error.',
  ),
  legend: [
    ...LEGEND_BASE,
    mark('icon:browser', 'браузер пользователя', 'the user’s browser'),
    mark('icon:server', 'узел кластера с портом NodePort', 'a node with its NodePort'),
    mark('icon:process', 'обратный прокси контроллера входа', 'the ingress reverse proxy'),
    mark('ok', 'ответ дошёл', 'the answer arrived'),
    mark('warn', 'прокси не дождался ответа', 'the proxy gave up waiting'),
    mark('err', 'здесь запрос сломался', 'the request broke here'),
  ],
  stopLabel: bi('Запрос остановился', 'The request stopped'),
  concepts: ['k8s.nodeport', 'k8s.ingress', 'k8s.gateway-api'],
  diagram,
  params: [
    { id: 'entry', label: bi('Куда приходит браузер', 'Where the browser comes in'), kind: 'choice', default: 'lb', group: bi('Как запрос входит в кластер', 'How the request enters'), options: [{ id: 'nodeport', label: bi('прямо на порт узла (NodePort)', 'straight to the NodePort') }, { id: 'lb', label: bi('на внешний адрес балансировщика (LoadBalancer)', 'to a LoadBalancer') }], near: 'lb' },
    {
      id: 'etp',
      label: bi('Куда узел может отправить запрос (externalTrafficPolicy)', 'Where the node may send it (externalTrafficPolicy)'),
      kind: 'choice',
      default: 'Cluster',
      group: bi('Как запрос входит в кластер', 'How the request enters'),
      options: [
        { id: 'Cluster', label: bi('Cluster, то есть на прокси на любом узле', 'Cluster: a proxy on any node') },
        { id: 'Local', label: bi('Local, то есть только на прокси на этом узле', 'Local: only a proxy on this node') },
      ],
      near: 'node',
      levels: ['intermediate', 'experienced'],
      predict: {
        prompt: bi('Вы меняете externalTrafficPolicy. Какой адрес пользователя увидит контроллер входа при новом значении?', 'You change externalTrafficPolicy. Which client address will the proxy see?'),
        options: [
          { id: 'real', text: bi('Настоящий адрес пользователя, 203.0.113.50', 'The real one, 203.0.113.50') },
          { id: 'node', text: bi('Адрес узла, через который пришёл запрос', 'The node’s address') },
        ],
        resolve: (_p, n) => (n.some((s) => s.id === 'local') ? 'real' : 'node'),
      },
    },
    { id: 'api', label: bi('Каким объектом записан маршрут', 'The route object'), kind: 'choice', default: 'gateway', group: bi('Правило маршрута', 'The route rule'), options: [{ id: 'gateway', label: bi('HTTPRoute из Gateway API', 'HTTPRoute (Gateway API)') }, { id: 'ingress', label: bi('Ingress, старый способ', 'Ingress (legacy)') }], near: 'route' },
    {
      id: 'response',
      label: bi('Сколько секунд под готовит ответ', 'Seconds the pod takes to answer'),
      kind: 'range',
      min: 0,
      max: 60,
      step: 5,
      default: 0,
      near: 'pod',
      group: bi('Время ответа', 'Timing'),
      predict: {
        prompt: bi('Вы меняете время, за которое под готовит ответ, а тайм-аут прокси остаётся прежним. Какой ответ получит браузер?', 'You change the pod’s response time; the proxy timeout stays. What does the browser get?'),
        options: [
          { id: 'ok', text: bi('Код 200 и страницу от приложения', '200 from the application') },
          { id: 'proxy', text: bi('504 Gateway Timeout от прокси', '504 from the proxy') },
          { id: 'app', text: bi('500 от приложения', '500 from the application') },
        ],
        resolve: (_p, n) => (metric(n, 'status') === 504 ? 'proxy' : 'ok'),
      },
    },
    { id: 'timeout', label: bi('Сколько секунд прокси ждёт ответа пода', 'Seconds the proxy waits'), kind: 'range', min: 5, max: 60, step: 5, default: 30, near: 'proxy', group: bi('Время ответа', 'Timing') },
  ],
  breaks: [
    { id: 'no-pods', label: bi('У Service web нет ни одного готового пода', 'Service web has no ready pods'), remove: ['e-pod'], layer: 'L7', boundary: 'network', predict: { prompt: bi('У Service web нет готовых подов, а прокси работает. Что получит браузер?', 'No ready pods. What does the browser get?'), options: [{ id: '503', text: bi('Прокси ответит кодом 503, потому что отправить запрос некуда', '503 from the proxy') }, { id: 'timeout', text: bi('Долгое ожидание и тайм-аут соединения', 'A connection timeout') }], resolve: () => '503' } },
    { id: 'reset', label: bi('Приложение обрывает соединение посреди ответа', 'The application drops the connection mid-answer'), remove: ['e-svc'], layer: 'L7', boundary: 'network', predict: { prompt: bi('Приложение обрывает соединение посреди ответа. Что получит браузер?', 'The app drops the connection mid-answer. What does the browser get?'), options: [{ id: '502', text: bi('502 Bad Gateway от прокси', '502 from the proxy') }, { id: '500', text: bi('500 от приложения', '500 from the application') }], resolve: () => '502' } },
  ],
  metrics: [
    { id: 'status', label: bi('код ответа браузеру', 'status code') },
    { id: 'seconds', label: bi('секунд ждал браузер', 'seconds waited') },
  ],
  run(p, broken): Step[] {
    const s: Step[] = [];
    const first = only(ALL, 'client', 'pod');
    if (p.entry === 'lb') {
      s.push({
        id: 'browser',
        label: bi('браузер', 'browser'),
        caption: bi('Пользователь открывает shop.example.test, и браузер отправляет запрос на внешний адрес сайта, то есть на балансировщик.', 'The browser sends the request to the site’s external address, the load balancer.'),
        focus: ['client', 'e-in'],
        reveal: ['lb', 'e-in'],
        tokens: [{ edge: 'e-in', label: 'GET / Host: shop.example.test' }],
        say: { client: bi('Браузер отправляет запрос на внешний адрес shop.example.test.', 'The browser sends to shop.example.test.') },
        states: first,
        metrics: { status: 0, seconds: 0 },
      });
      s.push({
        id: 'lb',
        label: bi('балансировщик', 'load balancer'),
        caption: bi('Балансировщик выбирает один из узлов и отправляет запрос на его порт NodePort 30443.', 'The load balancer picks a node and sends to its NodePort 30443.'),
        focus: ['lb', 'e-np'],
        reveal: ['node', 'e-np'],
        tokens: [{ edge: 'e-np', label: ':30443' }],
        say: { lb: bi('Балансировщик отправляет запрос на порт 30443 узла worker-1.', 'The load balancer sends to worker-1:30443.') },
        metrics: { status: 0, seconds: 0 },
      });
    } else
      s.push({
        id: 'np',
        label: 'NodePort',
        caption: bi('Браузер обращается прямо на адрес узла и порт 30443. Так можно обойтись без балансировщика, но тогда пользователю нужно знать адреса узлов.', 'The browser goes straight to a node and port 30443; no load balancer, but the client must know the nodes.'),
        focus: ['client', 'e-direct'],
        reveal: ['node', 'e-direct'],
        tokens: [{ edge: 'e-direct', label: 'worker-1:30443' }],
        say: { client: bi('Браузер отправляет запрос прямо на порт 30443 узла worker-1.', 'The browser goes straight to worker-1:30443.') },
        states: first,
        metrics: { status: 0, seconds: 0 },
      });
    s.push(
      p.etp === 'Local'
        ? {
            id: 'local',
            label: 'Local',
            caption: bi('При externalTrafficPolicy: Local узел отправляет запрос только на под прокси, который работает на нём самом, и адрес отправителя не подменяет. Поэтому прокси видит настоящий адрес пользователя. Узел, на котором пода прокси нет, на запросы не отвечает, и балансировщик исключает его.', 'Local: only to a proxy pod on this node, no SNAT: the proxy sees the real client IP.'),
            focus: ['node', 'e-dnat'],
            reveal: ['proxy', 'e-dnat'],
            tokens: [{ edge: 'e-dnat', label: 'src 203.0.113.50' }],
            say: { node: bi('Узел отправляет запрос на под прокси на себе и оставляет адрес пользователя.', 'The node sends to its own proxy pod, keeping the client address.') },
            metrics: { status: 0, seconds: 0 },
          }
        : {
            id: 'cluster',
            label: 'Cluster',
            caption: bi('При externalTrafficPolicy: Cluster узел может отправить запрос на под прокси на соседнем узле и для этого подменяет адрес отправителя на свой. Поэтому прокси видит адрес узла, а не пользователя.', 'Cluster: the node may send to a proxy on another node and SNATs: the proxy sees the node IP.'),
            focus: ['node', 'e-dnat'],
            reveal: ['proxy', 'e-dnat'],
            tokens: [{ edge: 'e-dnat', label: 'src 192.168.56.12' }],
            say: { node: bi('Узел отправляет запрос на под прокси и подменяет адрес отправителя своим.', 'The node sends to a proxy pod and replaces the source with its own.') },
            metrics: { status: 0, seconds: 0 },
          },
    );
    s.push({
      id: 'route',
      label: p.api === 'gateway' ? 'HTTPRoute' : 'Ingress',
      caption:
        p.api === 'gateway'
          ? bi('Прокси находит правило HTTPRoute: сайт shop.example.test и путь / ведут на Service web, порт 80. В Gateway API обязанности разделены: GatewayClass описывает инфраструктуру, Gateway настраивает администратор кластера, а HTTPRoute пишет команда приложения.', 'The proxy finds the HTTPRoute: shop.example.test, / → web:80. Roles: GatewayClass, Gateway, HTTPRoute.')
          : bi('Прокси находит правило Ingress: сайт shop.example.test и путь / ведут на Service web, порт 80. API Ingress заморожен, а самый распространённый контроллер ingress-nginx снят с поддержки в марте 2026 года.', 'The proxy finds the Ingress rule; Ingress is frozen, ingress-nginx retired in March 2026.'),
      focus: ['proxy', 'e-route'],
      reveal: ['route', 'e-route'],
      tokens: [{ edge: 'e-route', label: 'shop.example.test /' }],
      say: { proxy: bi('Прокси ищет правило для сайта shop.example.test и пути /.', 'The proxy matches shop.example.test and /.') },
      metrics: { status: 0, seconds: 0 },
    });
    if (broken.has('no-pods')) {
      s.push({
        id: '503',
        label: '503',
        caption: bi('У Service web нет ни одного готового пода, и прокси некуда отправить запрос. Ответ пользователю прокси составляет сам.', 'Service web has no ready pods; the proxy answers itself.'),
        focus: ['proxy'],
        reveal: ['svc'],
        say: { proxy: bi('Прокси не находит у Service web ни одного готового пода и отвечает 503 сам.', 'No ready pods: the proxy answers 503 itself.') },
        states: { svc: 'err' },
        metrics: { status: 503, seconds: 0 },
        broken: { at: 'svc', message: 'HTTP/1.1 503 Service Unavailable\ncontent-length: 19\n\nno available server', caption: bi('на Service. Ответ 503 пришёл от прокси, поэтому причину ищите в EndpointSlice и в проверках готовности подов, а не в коде приложения.', 'at the Service: the 503 came from the proxy; look at EndpointSlices and readiness checks, not the code.') },
      });
      return s;
    }
    s.push({
      id: 'new-conn',
      label: bi('соединение', 'new connection'),
      caption: bi('Прокси открывает новое TCP-соединение к Service web на порт 80. Соединение браузера закончилось на прокси, а адрес пользователя теперь передаётся в заголовке X-Forwarded-For.', 'The proxy opens a new TCP connection to web:80; the client IP travels in X-Forwarded-For.'),
      focus: ['proxy', 'e-svc'],
      reveal: ['svc', 'e-svc'],
      tokens: [{ edge: 'e-svc', label: 'X-Forwarded-For: 203.0.113.50' }],
      say: { proxy: bi('Прокси открывает к Service web новое соединение.', 'The proxy opens a new connection to web.') },
      metrics: { status: 0, seconds: 0 },
    });
    if (broken.has('reset')) {
      s.push({
        id: '502',
        label: '502',
        caption: bi('Под обрывает соединение посреди ответа, и прокси не получает от приложения правильного ответа. Пользователю он отвечает 502 Bad Gateway.', 'The pod drops the connection; the proxy returns 502.'),
        focus: ['proxy'],
        say: { proxy: bi('Приложение оборвало соединение, и прокси отвечает браузеру 502.', 'The app dropped it; the proxy returns 502.') },
        states: { proxy: 'err' },
        metrics: { status: 502, seconds: 0 },
        broken: { at: 'e-svc', message: 'HTTP/1.1 502 Bad Gateway\n\nBad Gateway', caption: bi('между прокси и подом. Кодом 502 прокси сообщает об ошибке того, кто стоит за ним, поэтому причину ищите в логах пода и в числе его перезапусков.', 'between proxy and pod: 502 is the proxy speaking about what is behind it; check the pod logs and restarts.') },
      });
      return s;
    }
    s.push({
      id: 'svc',
      label: 'Service',
      caption: bi('Дальше путь обычный, и ядро узла заменяет адрес Service на адрес пода, и запрос приходит в под web.', 'Then the usual path: the Service address becomes the pod address.'),
      focus: ['svc', 'e-pod'],
      reveal: ['e-pod'],
      tokens: [{ edge: 'e-pod', label: 'dst 10.42.1.15:80' }],
      say: { svc: bi('Service отправляет запрос на под web, 10.42.1.15.', 'The Service sends it to 10.42.1.15.') },
      metrics: { status: 0, seconds: 0 },
    });
    if (p.response > p.timeout) {
      s.push({
        id: '504',
        label: '504',
        caption: fmt(bi('Под готовит ответ {r} с, а прокси ждёт только {t} с. Прокси сдаётся первым и отвечает браузеру 504 Gateway Timeout. Приложение тут ни при чём, потому что оно ещё работает над ответом, который уже никому не нужен.', 'The pod takes {r} s, the proxy waits {t} s: the proxy gives up and returns 504; the app is still working.'), { r: p.response, t: p.timeout }),
        focus: ['proxy'],
        say: { proxy: fmt(bi('Прокси ждал ответа {t} с, не дождался и отвечает браузеру 504.', 'The proxy waited {t} s and returns 504.'), { t: p.timeout }) },
        states: { proxy: 'warn', client: 'err' },
        metrics: { status: 504, seconds: p.timeout },
      });
      return s;
    }
    s.push({
      id: '200',
      label: '200',
      caption: p.response ? fmt(bi('Под ответил за {r} с, быстрее, чем истёк тайм-аут прокси. Ответ возвращается по тем же соединениям, и браузер получает страницу с кодом 200.', 'The pod answered in {r} s, under the timeout: the browser gets 200.'), { r: p.response }) : bi('Под ответил сразу. Ответ возвращается по тем же соединениям, и браузер получает страницу с кодом 200.', 'The pod answered at once: the browser gets 200.'),
      focus: ['pod'],
      say: { pod: p.response ? fmt(bi('Под отдаёт страницу за {r} с, и она возвращается браузеру с кодом 200.', 'The pod answers in {r} s; the browser gets 200.'), { r: p.response }) : bi('Под сразу отдаёт страницу, и она возвращается браузеру с кодом 200.', 'The pod answers at once; the browser gets 200.') },
      states: { pod: 'ok', client: 'ok' },
      metrics: { status: 200, seconds: p.response },
    });
    return s;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? fmt(bi('Браузер получает код {c}, и отдаёт его прокси, а не приложение.', 'Status {c}, from the proxy, not the app.'), { c: metric(next, 'status') }) : bi('Поломка убрана.', 'The break is removed.');
    switch (change.id) {
      case 'response':
      case 'timeout':
        return metric(next, 'status') === 504
          ? fmt(bi('Под готовит ответ {r} с, это дольше тайм-аута прокси в {t} с, поэтому браузер получает 504 от прокси.', '{r} s > {t} s: 504 from the proxy.'), { r: b.response as number, t: b.timeout as number })
          : fmt(bi('Под готовит ответ {r} с и укладывается в тайм-аут прокси в {t} с, поэтому браузер получает 200.', '{r} s ≤ {t} s: 200.'), { r: b.response as number, t: b.timeout as number });
      case 'etp':
        return b.etp === 'Local' ? bi('При Local адрес пользователя сохраняется, но узлы без пода прокси выпадают из балансировщика.', 'Local: the client IP is kept; nodes without a proxy pod drop out.') : bi('При Cluster прокси видит адрес узла, зато запрос может принять любой узел.', 'Cluster: SNAT to the node IP, but any node takes the request.');
      case 'api':
        return b.api === 'gateway' ? bi('С Gateway API путь тот же, но маршрут записан в HTTPRoute, а вход описывает объект Gateway.', 'Gateway API: the same path; the rule is an HTTPRoute.') : bi('С Ingress всё описано одним объектом; этот API заморожен, и новые возможности появляются в Gateway API.', 'Ingress: one object; frozen, new features go to Gateway API.');
      case 'entry':
        return b.entry === 'lb' ? bi('Запросы идут через балансировщик, и у сайта появляется один внешний адрес перед портами всех узлов.', 'Via a LoadBalancer: one external IP in front of the node ports.') : bi('Запросы идут напрямую на порт узла. Так тоже работает, но пользователю нужно знать адреса узлов.', 'Straight to the NodePort: the client must know the nodes.');
    }
    return bi('Путь пересчитан.', 'The path is recomputed.');
  },
});
