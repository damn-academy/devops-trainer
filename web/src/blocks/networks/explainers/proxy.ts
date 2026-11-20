// E-504 (03 §7.9): where 504 and 502 come from. The steps are computed by the
// same nginx model the terminal uses (engine/sim-net), so the explainer and
// the lab never disagree: proxy_read_timeout and proxy_connect_timeout 60 s,
// proxy_next_upstream "error timeout", no retry of a POST, max_fails=1.
//
// Reading order: at the first step only the client and nginx are on the
// diagram; the backends, the database and error.log appear when nginx reaches
// them. The acting block says in a callout what it does, requests and answers
// travel along the lines as cards, and error.log counts its lines.

import { defineModel } from '../../../core/define';
import { bi, fmt, t as tr } from '../../../core/i18n';
import type { ElementState, Step } from '../../../core/types';
import { serveHttp } from '../../../engine/sim-net/http';
import { proxy, rule } from '../../../engine/sim-net/presets';
import { b, card, DOC, edge, lastMetric, node } from './kit';

type P = { db: number; read: number; backends: string; next: boolean; method: string };

export interface ProxyOutcome {
  status: number;
  waited: number;
  lines: string[];
  attempts: { addr: string; result: 'ok' | 'refused' | 'connect-timeout' | 'read-timeout' | 'unreachable' | 'status'; status?: number }[];
}

/** Run one request through the nginx model with these knobs and breaks. */
export function proxyOutcome(p: P, broken: ReadonlySet<string>): ProxyOutcome {
  const two = p.backends === '2';
  const conf = `upstream backend {\n    server 10.0.2.21:8080;\n${two ? '    server 10.0.2.22:8080;\n' : ''}}\nserver {\n    listen 80;\n    server_name shop.lab;\n    location / {\n        proxy_pass http://backend;\n        proxy_read_timeout ${p.read}s;\n${p.next ? '' : '        proxy_next_upstream off;\n'}    }\n}\n`;
  const built = proxy({ reportDelay: p.db, conf, app2DbDown: broken.has('app2-500'), app1Down: broken.has('app1-down') });
  const w = built.world;
  w.local = 'client';
  const lb = w.hosts.lb;
  lb.files = { ...built.files, '/var/log/nginx/error.log': '' };
  if (broken.has('app1-off')) w.hosts.app1.off = true;
  if (broken.has('drop')) w.hosts.app1.nf.filter.INPUT.rules.push(rule('DROP', { proto: 'tcp', dport: 8080 }));
  if (!two) delete w.hosts.app2;
  const svc = lb.services.find((s) => s.kind === 'nginx')!;
  const t0 = w.clock;
  const res = serveHttp(w, undefined, 'lb', svc, { method: p.method, path: '/report', host: 'shop.lab', headers: [], client: '10.0.0.5' });
  const lines = (lb.files['/var/log/nginx/error.log'] ?? '').split('\n').filter(Boolean);
  const attempts: ProxyOutcome['attempts'] = [];
  for (const l of lines) {
    const addr = /upstream: "http:\/\/([\d.:]+)/.exec(l)?.[1] ?? '';
    attempts.push({ addr, result: l.includes('refused') ? 'refused' : l.includes('No route') ? 'unreachable' : l.includes('while connecting') ? 'connect-timeout' : 'read-timeout' });
  }
  const tried = (res.upstreamAddr ?? '').split(', ').filter(Boolean);
  if (tried.length > attempts.length) attempts.push({ addr: tried[tried.length - 1], result: res.status === 200 ? 'ok' : 'status', status: res.status });
  return { status: res.status, waited: Math.round((w.clock - t0) / 100) / 10, lines, attempts };
}

const appNode = (id: string, y: number) =>
  node(
    id,
    id,
    'process',
    [560, y, 160, 64],
    card(
      ['Сервер приложения, которое слушает порт 8080. На запрос /report оно отвечает через столько секунд, сколько занимает запрос к базе данных.', 'A backend: the application on 8080. It answers /report in as many seconds as the database query takes.'],
      ['Приложение пишут разработчики, а запускает его служба systemd.', 'The developers; systemd or an orchestrator runs it.'],
      `curl -s -o /dev/null -w '%{http_code} %{time_total}\\n' http://${id === 'app1' ? '10.0.2.21' : '10.0.2.22'}:8080/report`,
    ),
    { sub: id === 'app1' ? '10.0.2.21:8080' : '10.0.2.22:8080', icon: 'server', work: 'dots' },
  );

const logLines = (n: number) => tr(bi(`строк: ${n}`, `${n} line${n === 1 ? '' : 's'}`));
const HIDDEN: Record<string, ElementState> = Object.fromEntries(['app1', 'app2', 'db', 'log', 'e-1', 'e-2', 'e-1d', 'e-2d', 'e-log'].map((id) => [id, 'hidden' as ElementState]));

export const proxyModel = defineModel<P>({
  id: 'net.proxy504',
  frame: 'visible',
  block: 'networks',
  title: b('Откуда берутся ошибки 504 и 502', 'Where 504 and 502 come from'),
  summary: b(
    'Клиент запрашивает страницу /report у nginx, а nginx передаёт запрос одному из двух серверов приложения, которые ходят в общую базу данных. Схема показывает, кто и почему пишет клиенту код ответа, сам nginx или приложение. Под файлом error.log показано, сколько строк nginx в него записал.',
    'The client asks nginx for /report, and nginx passes the request to one of two backends that share a database. The diagram shows who writes the status code to the client and why: nginx itself or the application. Under error.log you see how many lines nginx wrote.',
  ),
  intro: b(
    'Схема соберётся по шагам, и сейчас на ней только клиент и nginx. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко у подсвеченного блока говорит, что он делает, а карточка на линии показывает запрос или ответ.\n\nПосле первого прохода двигайте время ответа приложения и срок ожидания nginx, оставьте один сервер приложения, смените метод на POST, а потом ломайте серверы приложения по-разному в блоке «Сломать».',
    'The diagram builds itself step by step: now it shows only the client and nginx. Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout at the highlighted block says what it does; the card on the line shows a request or an answer.\n\nAfter the first pass move the application time and nginx’s timeout, keep one backend, switch the method to POST, then break the backends in different ways in “Break it”.',
  ),
  legend: [
    { mark: 'active', text: b('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: b('что этот блок делает', 'what it does') },
    { mark: 'token', text: b('запрос или ответ на линии', 'a request or an answer on the line') },
    { mark: 'icon:browser', text: b('клиент', 'client') },
    { mark: 'icon:server', text: b('nginx и серверы приложения', 'nginx and the backends') },
    { mark: 'icon:database', text: b('база данных', 'database') },
    { mark: 'icon:file', text: b('журнал ошибок nginx', 'nginx’s error log') },
    { mark: 'wait', text: b('блок ждёт ответа', 'the block waits for an answer') },
    { mark: 'warn', text: b('этот блок написал клиенту ошибку', 'this block wrote the error to the client') },
    { mark: 'err', text: b('попытка связаться с сервером приложения не удалась', 'an attempt to reach the server failed') },
    { mark: 'ok', text: b('клиент получил страницу', 'the client got the page') },
  ],
  stopLabel: b('Клиент получил ошибку', 'The client got an error'),
  diagram: {
    width: 960,
    height: 420,
    nodes: [
      node('client', b('Клиент', 'Client'), 'user', [24, 120, 144, 64], card(['Браузер или curl. Клиент видит только ответ nginx: код и заголовок Server.', 'A browser or curl. It sees only nginx’s answer: the code and the Server header.'], ['Запрос отправляет пользователь.', 'The user.'], 'curl -sv http://shop.lab/report'), { sub: '10.0.0.5', icon: 'browser' }),
      node('nginx', 'nginx', 'l7', [264, 112, 176, 80], card(['Обратный прокси перед серверами приложения. Если сервер приложения не ответил вовремя, nginx сам пишет клиенту код 504, а если соединиться не удалось или ответ испорчен, пишет 502. Каждую неудачную попытку nginx записывает строкой в error.log.', 'A reverse proxy in front of the backends. If a backend did not answer in time it writes 504 itself; if the connection failed or the answer was garbage, 502. Every failed attempt is a line in error.log.'], ['nginx настраивает администратор в файле /etc/nginx/conf.d/shop.conf.', 'The administrator: /etc/nginx/conf.d/shop.conf.'], 'tail /var/log/nginx/error.log', DOC.nginxProxy), { sub: 'read_timeout 60s', icon: 'server', work: 'spin' }),
      appNode('app1', 40),
      appNode('app2', 200),
      node('db', b('База данных', 'Database'), 'store', [800, 120, 136, 64], card(['Медленный запрос к базе данных часто становится причиной ошибки 504, потому что приложение ждёт базу, а nginx ждёт приложение.', 'A slow database query is a common cause of 504: the application waits for the database, nginx waits for the application.'], ['Базу обслуживает администратор баз данных.', 'The DBA.']), { icon: 'database' }),
      node('log', 'error.log', 'obj', [264, 296, 448, 96], card(['Файл /var/log/nginx/error.log. Строка с «while connecting to upstream» означает, что подключиться не удалось, и причина в сети, фильтре или процессе. Строка с «while reading response header» означает, что подключение удалось, но ответа nginx не дождался, то есть приложение работает медленно.', '/var/log/nginx/error.log. “while connecting to upstream” means the connection failed (network, filter, process); “while reading response header” means it connected but the answer never came (a slow application).'], ['Строки пишет nginx.', 'nginx.'], 'tail -f /var/log/nginx/error.log'), { shape: 'doc', sub: logLines(0), icon: 'file' }),
    ],
    edges: [
      edge('e-c', 'client', 'nginx', 'GET /report', card(['Запрос клиента. Соединение клиента с nginx в порядке, иначе клиент не получил бы никакого кода ответа.', 'The client’s request. The client’s connection to nginx is fine — otherwise there would be no status code at all.'], ['Запрос отправляет клиент.', 'The client.'])),
      edge('e-1', 'nginx', 'app1', 'proxy_pass', card(['nginx подключается к первому серверу группы upstream и пересылает ему запрос.', 'nginx connects to the first server of the upstream group and forwards the request.'], ['Запрос пересылает nginx.', 'nginx.'], undefined, DOC.nginxNext), { via: [[500, 72]], labelAt: 0.4 }),
      edge('e-2', 'nginx', 'app2', b('повтор', 'retry'), card(['По умолчанию действует настройка proxy_next_upstream error timeout: после ошибки соединения или истёкшего срока ожидания nginx повторяет запрос на следующем сервере, если повтор безопасен для этого метода.', 'proxy_next_upstream error timeout (the default): after a connection error or a timeout nginx retries on the next server — if the method is idempotent.'], ['Запрос повторяет nginx.', 'nginx.'], undefined, DOC.nginxNext), { via: [[500, 232]], labelAt: 0.4 }),
      edge('e-1d', 'app1', 'db', 'SQL', card(['Запрос приложения к базе данных.', 'The application’s query to the database.'], ['Запрос отправляет приложение.', 'The application.']), { via: [[760, 72], [760, 136]] }),
      edge('e-2d', 'app2', 'db', 'SQL', card(['Запрос второго сервера приложения к той же базе.', 'The second backend’s query to the same database.'], ['Запрос отправляет приложение.', 'The application.']), { via: [[760, 232], [760, 168]] }),
      edge('e-log', 'nginx', 'log', b('строка', 'line'), card(['nginx записывает по одной строке на каждую неудачную попытку, вместе с адресом сервера приложения.', 'One line per failed attempt, with the upstream address.'], ['Строку пишет nginx.', 'nginx.']), { labelAt: 0.75 }),
    ],
  },
  params: [
    {
      id: 'db',
      group: b('Серверы приложения', 'The backends'),
      label: b('За сколько секунд приложение отвечает на /report', 'Application response time'),
      kind: 'range',
      min: 1,
      max: 120,
      step: 1,
      unit: { ru: 'с', en: 's' },
      default: 75,
      near: 'db',
      predict: {
        prompt: b('Сейчас приложение отвечает за 75 секунд, nginx ждёт ответа 60 секунд, а серверов приложения два. Сколько секунд клиент ждал ответа в исходной схеме?', 'Before you change it: right now the application answers in 75 s, nginx’s timeout is 60 s, there are two backends. How long did the client wait?'),
        options: [
          { id: '60', text: b('60 секунд, потому что nginx ждёт ответа 60 секунд', '60 seconds, because nginx waits 60 seconds for an answer') },
          { id: '120', text: b('120 секунд, потому что nginx подождал каждый из двух серверов', '120 seconds: nginx waited for each backend') },
          { id: '75', text: b('75 секунд, потому что столько приложение строит отчёт', '75 seconds, because that is how long the app builds the report') },
        ],
        resolve: (prev) => {
          const w = lastMetric(prev, 'waited') ?? 0;
          return w >= 100 ? '120' : w >= 70 ? '75' : '60';
        },
      },
    },
    {
      id: 'backends',
      group: b('Серверы приложения', 'The backends'),
      label: b('Сколько серверов приложения в группе upstream', 'Backends in the upstream'),
      kind: 'choice',
      default: '2',
      options: [
        { id: '1', label: b('один', 'one') },
        { id: '2', label: b('два', 'two') },
      ],
      near: 'app2',
    },
    { id: 'read', group: b('Настройки nginx', 'nginx settings'), label: b('Сколько секунд nginx ждёт ответа приложения (proxy_read_timeout)', 'proxy_read_timeout'), kind: 'range', min: 5, max: 300, step: 5, unit: { ru: 'с', en: 's' }, default: 60, near: 'nginx' },
    { id: 'next', group: b('Настройки nginx', 'nginx settings'), label: b('nginx повторяет запрос на другом сервере (proxy_next_upstream)', 'proxy_next_upstream'), kind: 'toggle', default: true, near: 'e-2', levels: ['intermediate', 'experienced'] },
    {
      id: 'method',
      group: b('Что отправил клиент', 'What the client sent'),
      label: b('Метод запроса', 'Request method'),
      kind: 'choice',
      default: 'GET',
      options: [
        { id: 'GET', label: b('GET', 'GET') },
        { id: 'POST', label: b('POST', 'POST') },
      ],
      near: 'e-c',
      levels: ['intermediate', 'experienced'],
      predict: {
        prompt: b('Сервер приложения по-прежнему медленный, но клиент отправил запрос методом POST. Повторит ли nginx этот запрос на втором сервере?', 'The same slow backend, but the request is a POST. Will nginx retry it on the second server?'),
        options: [
          { id: 'no', text: b('Нет, потому что запрос уже ушёл, и повтор мог бы, например, создать второй заказ', 'No: the request was already sent; a retry could, say, create a second order') },
          { id: 'yes', text: b('Да, так же, как запрос GET', 'Yes, just like a GET') },
        ],
        resolve: (_p, next) => ((lastMetric(next, 'lines') ?? 0) > 1 ? 'yes' : 'no'),
      },
    },
  ],
  breaks: [
    {
      id: 'app1-down',
      label: b('Процесс приложения на app1 аварийно завершился', 'The app1 process crashed'),
      remove: ['app1'],
      layer: 'L4',
      predict: {
        prompt: b('Процесс приложения на app1 аварийно завершился, а сама машина работает. Приложение на app2 строит отчёт столько секунд, сколько задано над схемой. Что получит клиент?', 'The application process on app1 has crashed, while the machine itself is up. The application on app2 builds the report in as many seconds as set above the diagram. What does the client get?'),
        options: [
          { id: '502', text: b('Код 502: nginx получил отказ от app1 и сразу написал клиенту ошибку', '502: nginx got a refusal from app1 and wrote the error to the client at once') },
          { id: '504', text: b('Код 504: nginx повторил запрос на app2, а app2 не успел ответить в срок', '504: nginx retried on app2, and app2 did not answer in time') },
          { id: '200', text: b('Код 200: nginx повторил запрос на app2, и app2 успел ответить в срок', '200: nginx retried on app2, and app2 answered in time') },
        ],
        resolve: (_p, next) => String(lastMetric(next, 'code') ?? 0),
      },
    },
    {
      id: 'app1-off',
      label: b('Машина app1 выключена', 'The app1 machine is powered off'),
      remove: ['app1', 'e-1d'],
      layer: 'L3',
      predict: {
        prompt: b('Машина app1 выключена целиком. Чем это для nginx отличается от аварийно завершившегося процесса?', 'The app1 machine is off entirely. How is that different for nginx from a crashed process?'),
        options: [
          { id: 'slow', text: b('Отказа не будет, и nginx будет ждать соединения до конца срока proxy_connect_timeout', 'There is no refusal: nginx waits for the connection until proxy_connect_timeout') },
          { id: 'same', text: b('Ничем не отличается, отказ придёт так же мгновенно', 'No difference: an instant refusal') },
        ],
        resolve: (_p, next) => ((lastMetric(next, 'waited') ?? 0) >= 3 ? 'slow' : 'same'),
      },
    },
    {
      id: 'app2-500',
      label: b('Приложение на app2 не может подключиться к базе и отвечает кодом 500', 'app2 cannot connect to the database and answers 500'),
      remove: ['e-2d'],
      layer: 'L7',
      predict: {
        prompt: b('Приложение на app2 работает, но само отвечает кодом 500. Повторит ли nginx запрос на другом сервере?', 'app2 is alive but answers 500 itself. Will nginx retry the request?'),
        options: [
          { id: 'no', text: b('Нет, потому что код 500 считается ответом, а не ошибкой соединения, и nginx передаст его клиенту', 'No: 500 is an answer, not a connection error; it goes to the client') },
          { id: 'yes', text: b('Да, nginx повторит запрос на app1', 'Yes, on app1') },
        ],
        resolve: (_p, next) => (lastMetric(next, 'code') === 500 ? 'no' : 'yes'),
      },
    },
  ],
  metrics: [
    { id: 'code', label: b('код ответа клиенту', 'code to the client') },
    { id: 'waited', label: b('клиент ждал', 'client waited'), unit: { ru: 'с', en: 's' } },
    { id: 'lines', label: b('строк в error.log', 'lines in error.log') },
  ],
  run(p, broken): Step[] {
    const o = proxyOutcome(p, broken);
    const two = p.backends === '2';
    const steps: Step[] = [];
    steps.push({
      id: 'req',
      label: 'GET',
      caption: fmt(b('Клиент отправляет запрос {m} /report, и nginx его принимает, потому что сеть до nginx работает.', 'The client sends {m} /report. nginx accepts it: the network up to nginx works.'), { m: p.method }),
      focus: ['client', 'e-c', 'nginx'],
      tokens: [{ edge: 'e-c', label: `${p.method} /report` }],
      say: { nginx: fmt(b('nginx принимает запрос {m} /report и выбирает сервер приложения.', 'nginx accepts {m} /report and picks a backend.'), { m: p.method }) },
      states: { ...HIDDEN, nginx: 'on' },
      values: { nginx: `read_timeout ${p.read}s`, log: logLines(0) },
      metrics: { lines: 0, waited: 0 },
    });
    let t = 0;
    let logShown = false;
    const showLog = () => {
      const r: Record<string, ElementState> = logShown ? {} : { log: 'on', 'e-log': 'on' };
      logShown = true;
      return r;
    };
    o.attempts.forEach((a, i) => {
      const id = a.addr.startsWith('10.0.2.21') ? 'app1' : 'app2';
      const e = id === 'app1' ? 'e-1' : 'e-2';
      const ed = id === 'app1' ? 'e-1d' : 'e-2d';
      const n = i + 1;
      if (a.result === 'refused') {
        steps.push({
          id: `a${n}`,
          label: `${id}: RST`,
          caption: fmt(b('nginx подключается к {id} и сразу получает отказ RST, потому что порт никто не слушает. В error.log появляется строка «connect() failed (111: Connection refused) while connecting to upstream».', 'nginx connects to {id} and gets an RST at once: nobody listens on the port. error.log: “connect() failed (111: Connection refused) while connecting to upstream”.'), { id }),
          focus: [e, id, 'e-log'],
          tokens: [{ edge: e, label: 'SYN' }, { edge: e, reverse: true, label: 'RST' }],
          say: { nginx: fmt(b('nginx получает от {id} отказ и записывает его в error.log.', 'nginx gets a refusal from {id} and logs it.'), { id }) },
          states: { [id]: 'err', [e]: 'on', ...showLog() },
          values: { log: logLines(n) },
          metrics: { lines: n, waited: t },
        });
      } else if (a.result === 'connect-timeout' || a.result === 'unreachable') {
        t += 60;
        steps.push({
          id: `a${n}`,
          label: `${id}: SYN…`,
          caption: fmt(b('nginx отправляет SYN на {id} и ждёт, но не получает ни отказа, ни ответа. Когда истекают 60 секунд proxy_connect_timeout, в error.log появляется строка «upstream timed out (110: Connection timed out) while connecting to upstream».', 'nginx sends a SYN to {id} and waits: no refusal, no answer. After proxy_connect_timeout (60 s): “upstream timed out (110: Connection timed out) while connecting to upstream”.'), { id }),
          focus: [e, id, 'e-log'],
          tokens: [{ edge: e, label: 'SYN' }],
          say: { nginx: fmt(b('nginx 60 секунд ждёт, пока {id} ответит на SYN, и записывает неудачу в error.log.', 'nginx waits 60 s for {id} to answer the SYN and logs the failure.'), { id }) },
          states: { [id]: 'err', [e]: 'on', ...showLog() },
          values: { log: logLines(n) },
          metrics: { lines: n, waited: t },
        });
      } else if (a.result === 'read-timeout') {
        steps.push({
          id: `w${n}`,
          label: b(`${id}: ждёт`, `${id}: waits`),
          caption: fmt(b('Соединение с {id} установлено, и запрос отправлен. Приложение ждёт базу данных, nginx ждёт заголовки ответа, а таймер proxy_read_timeout тем временем идёт.', 'The connection to {id} is up and the request sent. The application waits for the database, nginx waits for the response headers. The proxy_read_timeout timer runs.'), { id }),
          focus: [e, id, ed, 'db'],
          tokens: [{ edge: e, label: 'GET /report' }, { edge: ed, label: 'SELECT …' }],
          say: { [id]: fmt(b('Приложение на {id} отправило запрос в базу данных и ждёт результата.', 'The application on {id} queried the database and waits.'), { id }) },
          states: { [id]: 'wait', db: 'wait', [e]: 'on', [ed]: 'on' },
          metrics: { lines: n - 1, waited: t },
        });
        t += p.read;
        steps.push({
          id: `a${n}`,
          label: `${id}: ${p.read}s`,
          caption: fmt(b('Прошло {r} с, а ответа нет. nginx закрывает соединение и записывает в error.log строку «upstream timed out (110: Connection timed out) while reading response header from upstream».', '{r} s passed with no answer. nginx closes the connection and writes “upstream timed out (110: Connection timed out) while reading response header from upstream”.'), { r: p.read }),
          focus: ['nginx', id, 'e-log', 'log'],
          say: { nginx: fmt(b('nginx не дождался ответа от {id} за {r} с и записывает это в error.log.', 'nginx got no answer from {id} in {r} s and logs it.'), { id, r: p.read }) },
          states: { [id]: 'err', ...showLog() },
          values: { log: logLines(n) },
          metrics: { lines: n, waited: t },
        });
      } else {
        t = o.waited;
        steps.push({
          id: `a${n}`,
          label: `${id}: ${a.status}`,
          caption:
            a.status === 200
              ? fmt(b('Приложение на {id} отвечает за {s} с и укладывается в срок ожидания, поэтому nginx передаёт ответ клиенту.', '{id} answers in {s} s — within the timeout. nginx passes the answer to the client.'), { id, s: p.db })
              : fmt(b('Приложение на {id} отвечает само, кодом {c}. Для nginx это обычный ответ, а не ошибка соединения, поэтому он передаёт его клиенту без повтора.', '{id} answers by itself — with {c}. For nginx this is a normal answer, not an upstream error: it passes it to the client without a retry.'), { id, c: a.status ?? 0 }),
          focus: [e, id],
          tokens: [{ edge: e, reverse: true, label: String(a.status) }],
          say: { [id]: fmt(b('Приложение на {id} отвечает кодом {c}.', 'The application on {id} answers {c}.'), { id, c: a.status ?? 0 }) },
          states: { [id]: a.status === 200 ? 'ok' : 'warn', [e]: 'on', ...(a.status === 200 ? { db: 'on', [ed]: 'on' } : {}) },
          metrics: { lines: o.lines.length, waited: t },
        });
      }
      if (i < o.attempts.length - 1)
        steps.push({
          id: `r${n}`,
          label: b('повтор', 'retry'),
          caption: b('Настройка proxy_next_upstream error timeout велит nginx повторить тот же запрос на следующем сервере группы. Неудачный сервер nginx на 10 секунд помечает недоступным (max_fails=1, fail_timeout=10s).', 'proxy_next_upstream error timeout: nginx retries the same request on the next server of the group and marks the failed one unavailable for 10 seconds (max_fails=1, fail_timeout=10s).'),
          focus: ['nginx', 'e-2'],
          tokens: [{ edge: 'e-2', label: `${p.method} /report` }],
          say: { nginx: b('nginx повторяет запрос на следующем сервере приложения.', 'nginx retries on the next backend.') },
          states: two ? { app2: 'on', 'e-2': 'on' } : {},
          metrics: { lines: n, waited: t },
        });
    });
    const writer = o.status === 504 || o.status === 502 ? 'nginx' : o.attempts[o.attempts.length - 1]?.addr.startsWith('10.0.2.22') ? 'app2' : 'app1';
    const text: Record<number, [string, string]> = {
      200: o.lines.length
        ? ['Клиент получает код 200, и пользователь ничего не замечает. Но в error.log остались строки о неудачных попытках, и увидит их только дежурный инженер.', 'The client gets 200. The user noticed nothing, but error.log keeps lines about the failed attempts — only the on-call engineer sees them.']
        : ['Клиент получает код 200, и пользователь ничего не замечает. Первая же попытка удалась, поэтому в error.log ничего не записано.', 'The client gets 200 and the user notices nothing. The first attempt succeeded, so nothing was written to error.log.'],
      500: ['Клиент получает код 500, и написало его приложение, а не nginx. Искать причину нужно в журналах приложения.', 'The client gets 500 — the application wrote it, not nginx. Look for the cause in the application’s logs.'],
      502: ['Клиент получает код 502 Bad Gateway, потому что соединение с сервером приложения было отвергнуто или оборвано и nginx не получил ответа. Этот код написал nginx.', 'The client gets 502 Bad Gateway: nginx could not get an answer — the connection was refused or broken. nginx wrote the code.'],
      504: ['Клиент получает код 504 Gateway Time-out, потому что nginx не дождался ответа сервера приложения. Код написал nginx, а причина лежит дальше, у сервера приложения.', 'The client gets 504 Gateway Time-out: nginx did not wait long enough for the upstream. nginx wrote the code; the cause is further on, at the backend.'],
    };
    const tx = text[o.status] ?? text[502];
    const fault = o.status >= 500;
    steps.push({
      id: 'resp',
      label: String(o.status),
      caption: fmt(b(`${tx[0]} Клиент ждал ответа {w} с.`, `${tx[1]} The client waited {w} s.`), { w: o.waited }),
      focus: ['e-c', writer],
      tokens: [{ edge: 'e-c', reverse: true, label: String(o.status) }],
      say: { [writer]: fault ? fmt(writer === 'nginx' ? b('nginx сам пишет клиенту ответ с кодом {c}, потому что сервер приложения не дал ответа.', 'nginx itself writes the {c} to the client: the backend gave no answer.') : b('Сервер приложения {w} сам ответил кодом {c}, а nginx передаёт этот ответ клиенту без изменений.', 'Backend {w} itself answered {c}; nginx passes it on unchanged.'), { c: o.status, w: writer }) : b('nginx передаёт клиенту готовую страницу.', 'nginx passes the page to the client.') },
      states: { client: fault ? 'err' : 'ok', [writer]: fault ? 'warn' : 'ok' },
      metrics: { code: o.status, waited: o.waited, lines: o.lines.length },
      ...(fault
        ? {
            broken: {
              at: writer,
              message: `$ curl -s -o /dev/null -w '%{http_code}\\n' http://shop.lab/report\n${o.status}\n$ tail -n ${Math.max(1, o.lines.length)} /var/log/nginx/error.log\n${o.lines.map((l) => l.replace(/, client:.*?, upstream:/, ', … upstream:')).join('\n') || '(empty)'}`,
              caption:
                o.status === 504
                  ? b('Код 504 написал nginx. Сеть до nginx в порядке, а ответа не прислал сервер приложения, и строки журнала показывают, на каком шаге это случилось.', 'nginx wrote the 504: the network up to it is fine; the answer did not come from the backend. The log lines say at which step.')
                  : o.status === 502
                    ? b('Код 502 написал nginx, потому что ему не удалось подключиться к серверу приложения. Слова «while connecting» в журнале указывают на сеть, фильтр или процесс.', 'nginx wrote the 502: it could not connect to the backend. “while connecting” in the log points to the network, a filter or the process.')
                    : b('Код 500 написало приложение, а nginx только передал его клиенту.', 'the application wrote the 500: nginx is only the courier here.'),
            },
          }
        : {}),
    });
    return steps;
  },
  explainDelta(prev, next, change) {
    const c0 = lastMetric(prev, 'code');
    const c1 = lastMetric(next, 'code');
    const w1 = lastMetric(next, 'waited') ?? 0;
    const l1 = lastMetric(next, 'lines') ?? 0;
    if (change.kind === 'break' && !change.on) return fmt(b('Поломку убрали, и клиент получает код {c} через {w} с.', 'The break is removed: the client gets {c} after {w} s.'), { c: c1 ?? 0, w: w1 });
    return c0 === c1
      ? fmt(b('Код ответа остался прежним, {c}, клиент ждал {w} с, а число строк в журнале error.log равно {l}. Первым срабатывает самый короткий таймер на пути запроса.', 'Code stays {c}, the client waited {w} s, error.log lines: {l}. The shortest timer on the path fires first.'), { c: c1 ?? 0, w: w1, l: l1 })
      : fmt(b('Код ответа изменился с {a} на {c}, клиент ждал {w} с, а число строк в журнале error.log равно {l}. Первым срабатывает самый короткий таймер на пути запроса.', 'Code {a} → {c}, the client waited {w} s, error.log lines: {l}. The shortest timer on the path fires first.'), { a: c0 ?? 0, c: c1 ?? 0, w: w1, l: l1 });
  },
});
