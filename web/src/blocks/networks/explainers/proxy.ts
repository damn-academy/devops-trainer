// E-504 (03 §7.9): where 504 and 502 come from. The steps are computed by the
// same nginx model the terminal uses (engine/sim-net), so the explainer and
// the lab never disagree: proxy_read_timeout and proxy_connect_timeout 60 s,
// proxy_next_upstream "error timeout", no retry of a POST, max_fails=1.

import { defineModel } from '../../../core/define';
import { fmt } from '../../../core/i18n';
import type { Step } from '../../../core/types';
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
  node(id, id, 'process', [560, y, 160, 64], card(['Бэкенд: приложение на 8080. Отвечает на /report за столько секунд, сколько займёт запрос к базе.', 'A backend: the application on 8080. It answers /report in as many seconds as the database query takes.'], ['Разработчики; запускает systemd или оркестратор.', 'The developers; systemd or an orchestrator runs it.'], `curl -s -o /dev/null -w '%{http_code} %{time_total}\\n' http://${id === 'app1' ? '10.0.2.21' : '10.0.2.22'}:8080/report`), { sub: id === 'app1' ? '10.0.2.21:8080' : '10.0.2.22:8080' });

export const proxyModel = defineModel<P>({
  id: 'net.proxy504',
  block: 'networks',
  title: b('Откуда берутся 504 и 502', 'Where 504 and 502 come from'),
  summary: b('Код ответа говорит, кто его написал. Клиент → nginx → два бэкенда → база. Двигайте время ответа базы и таймаут прокси, ломайте бэкенды.', 'The status code tells who wrote it. Client → nginx → two backends → database. Move the database time and the proxy timeout, break the backends.'),
  diagram: {
    width: 960,
    height: 420,
    nodes: [
      node('client', b('Клиент', 'Client'), 'user', [24, 120, 144, 64], card(['Браузер или curl. Он видит только ответ nginx: код и заголовок Server.', 'A browser or curl. It sees only nginx’s answer: the code and the Server header.'], ['Пользователь.', 'The user.'], 'curl -sv http://shop.lab/report'), { sub: '10.0.0.5' }),
      node('nginx', 'nginx', 'l7', [264, 112, 176, 80], card(['Обратный прокси перед бэкендами. Если бэкенд не ответил вовремя — пишет 504 сам; если соединение не удалось или ответ испорчен — 502. Каждая неудачная попытка — строка в error.log.', 'A reverse proxy in front of the backends. If a backend did not answer in time it writes 504 itself; if the connection failed or the answer was garbage, 502. Every failed attempt is a line in error.log.'], ['Администратор: /etc/nginx/conf.d/shop.conf.', 'The administrator: /etc/nginx/conf.d/shop.conf.'], 'tail /var/log/nginx/error.log', DOC.nginxProxy), { sub: 'read_timeout 60s' }),
      appNode('app1', 40),
      appNode('app2', 200),
      node('db', b('База', 'Database'), 'store', [808, 120, 128, 64], card(['Медленный запрос к базе — частая причина 504: приложение ждёт базу, nginx ждёт приложение.', 'A slow database query is a common cause of 504: the application waits for the database, nginx waits for the application.'], ['Администратор БД.', 'The DBA.'])),
      node('log', 'error.log', 'obj', [264, 296, 448, 96], card(['/var/log/nginx/error.log. «while connecting to upstream» — не удалось подключиться (сеть, фильтр, процесс); «while reading response header» — подключились, но ответа не дождались (медленное приложение).', '/var/log/nginx/error.log. “while connecting to upstream” means the connection failed (network, filter, process); “while reading response header” means it connected but the answer never came (a slow application).'], ['nginx.', 'nginx.'], 'tail -f /var/log/nginx/error.log'), { shape: 'doc', sub: '0 lines' }),
    ],
    edges: [
      edge('e-c', 'client', 'nginx', 'GET /report', card(['Запрос клиента. Соединение клиента с nginx в порядке — иначе не было бы никакого кода ответа.', 'The client’s request. The client’s connection to nginx is fine — otherwise there would be no status code at all.'], ['—', '—'])),
      edge('e-1', 'nginx', 'app1', 'proxy_pass', card(['nginx подключается к первому серверу группы upstream и пересылает запрос.', 'nginx connects to the first server of the upstream group and forwards the request.'], ['—', '—'], undefined, DOC.nginxNext), { via: [[500, 72]], labelAt: 0.4 }),
      edge('e-2', 'nginx', 'app2', b('повтор', 'retry'), card(['proxy_next_upstream error timeout (по умолчанию): после ошибки соединения или таймаута nginx повторяет запрос на следующем сервере — если метод идемпотентный.', 'proxy_next_upstream error timeout (the default): after a connection error or a timeout nginx retries on the next server — if the method is idempotent.'], ['—', '—'], undefined, DOC.nginxNext), { via: [[500, 232]], labelAt: 0.4 }),
      edge('e-1d', 'app1', 'db', 'SQL', card(['Запрос приложения к базе.', 'The application’s query to the database.'], ['—', '—']), { via: [[760, 72], [760, 136]] }),
      edge('e-2d', 'app2', 'db', 'SQL', card(['Запрос второго бэкенда к той же базе.', 'The second backend’s query to the same database.'], ['—', '—']), { via: [[760, 232], [760, 168]] }),
      edge('e-log', 'nginx', 'log', b('строка', 'line'), card(['Одна строка на каждую неудачную попытку, с адресом upstream.', 'One line per failed attempt, with the upstream address.'], ['nginx.', 'nginx.'])),
    ],
  },
  params: [
    {
      id: 'db',
      label: b('Время ответа приложения', 'Application response time'),
      kind: 'range',
      min: 1,
      max: 120,
      step: 1,
      unit: 's',
      default: 75,
      near: 'db',
      predict: {
        prompt: b('Прежде чем менять: сейчас приложение отвечает за 75 с, таймаут nginx 60 с, бэкендов два. Сколько ждал клиент?', 'Before you change it: right now the application answers in 75 s, nginx’s timeout is 60 s, there are two backends. How long did the client wait?'),
        options: [
          { id: '60', text: b('60 секунд', '60 seconds') },
          { id: '120', text: b('120 секунд: nginx подождал каждый бэкенд', '120 seconds: nginx waited for each backend') },
          { id: '75', text: b('75 секунд', '75 seconds') },
        ],
        resolve: (prev) => {
          const w = lastMetric(prev, 'waited') ?? 0;
          return w >= 100 ? '120' : w >= 70 ? '75' : '60';
        },
      },
    },
    { id: 'read', label: b('proxy_read_timeout', 'proxy_read_timeout'), kind: 'range', min: 5, max: 300, step: 5, unit: 's', default: 60, near: 'nginx' },
    {
      id: 'backends',
      label: b('Бэкендов в upstream', 'Backends in the upstream'),
      kind: 'choice',
      default: '2',
      options: [
        { id: '1', label: b('один', 'one') },
        { id: '2', label: b('два', 'two') },
      ],
      near: 'app2',
    },
    { id: 'next', label: b('proxy_next_upstream', 'proxy_next_upstream'), kind: 'toggle', default: true, near: 'e-2', levels: ['intermediate', 'experienced'] },
    {
      id: 'method',
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
        prompt: b('Тот же медленный бэкенд, но запрос — POST. Повторит ли nginx его на втором сервере?', 'The same slow backend, but the request is a POST. Will nginx retry it on the second server?'),
        options: [
          { id: 'no', text: b('Нет: запрос уже ушёл, повтор мог бы, например, создать второй заказ', 'No: the request was already sent; a retry could, say, create a second order') },
          { id: 'yes', text: b('Да, так же как GET', 'Yes, just like a GET') },
        ],
        resolve: (_p, next) => ((lastMetric(next, 'lines') ?? 0) > 1 ? 'yes' : 'no'),
      },
    },
  ],
  breaks: [
    {
      id: 'app1-down',
      label: b('Процесс app1 упал', 'The app1 process crashed'),
      remove: ['app1'],
      layer: 'L4',
      predict: {
        prompt: b('Процесс на app1 упал, машина жива. Что получит клиент?', 'The process on app1 crashed; the machine is alive. What does the client get?'),
        options: [
          { id: '200', text: b('200: nginx получит RST и повторит запрос на app2', '200: nginx gets an RST and retries on app2') },
          { id: '502', text: b('502', '502') },
          { id: '504', text: b('504', '504') },
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
        prompt: b('Машина app1 выключена совсем. Чем это отличается для nginx от упавшего процесса?', 'The app1 machine is off entirely. How is that different for nginx from a crashed process?'),
        options: [
          { id: 'slow', text: b('Отказа не будет: nginx ждёт соединения до proxy_connect_timeout', 'There is no refusal: nginx waits for the connection until proxy_connect_timeout') },
          { id: 'same', text: b('Ничем: мгновенный отказ', 'No difference: an instant refusal') },
        ],
        resolve: (_p, next) => ((lastMetric(next, 'waited') ?? 0) >= 3 ? 'slow' : 'same'),
      },
    },
    {
      id: 'app2-500',
      label: b('app2 потерял базу и отвечает 500', 'app2 lost the database and answers 500'),
      remove: ['e-2d'],
      layer: 'L7',
      predict: {
        prompt: b('app2 жив, но сам отвечает 500. Повторит ли nginx запрос?', 'app2 is alive but answers 500 itself. Will nginx retry the request?'),
        options: [
          { id: 'no', text: b('Нет: 500 — это ответ, а не ошибка соединения; он уйдёт клиенту', 'No: 500 is an answer, not a connection error; it goes to the client') },
          { id: 'yes', text: b('Да, на app1', 'Yes, on app1') },
        ],
        resolve: (_p, next) => (lastMetric(next, 'code') === 500 ? 'no' : 'yes'),
      },
    },
  ],
  metrics: [
    { id: 'code', label: b('код клиенту', 'code to the client') },
    { id: 'waited', label: b('ждал клиент', 'client waited'), unit: 's' },
    { id: 'lines', label: b('строк в error.log', 'lines in error.log') },
  ],
  run(p, broken): Step[] {
    const o = proxyOutcome(p, broken);
    const two = p.backends === '2';
    const steps: Step[] = [];
    const base = { app2: two ? undefined : 'off' };
    steps.push({ id: 'req', label: 'GET', caption: fmt(b('Клиент отправляет {m} /report. nginx принимает запрос: до него сеть работает.', 'The client sends {m} /report. nginx accepts it: the network up to nginx works.'), { m: p.method }), focus: ['e-c', 'nginx'], tokens: [{ edge: 'e-c', label: `${p.method} /report` }], states: { ...(base.app2 ? { app2: 'off', 'e-2': 'off', 'e-2d': 'off' } : {}), nginx: 'on' }, values: { nginx: `read_timeout ${p.read}s`, log: '0 lines' }, metrics: { lines: 0, waited: 0 } });
    let t = 0;
    o.attempts.forEach((a, i) => {
      const id = a.addr.startsWith('10.0.2.21') ? 'app1' : 'app2';
      const e = id === 'app1' ? 'e-1' : 'e-2';
      const n = i + 1;
      if (a.result === 'refused') {
        steps.push({ id: `a${n}`, label: `${id}: RST`, caption: fmt(b('nginx подключается к {id} — и сразу получает RST: порт никто не слушает. В error.log: «connect() failed (111: Connection refused) while connecting to upstream».', 'nginx connects to {id} and gets an RST at once: nobody listens on the port. error.log: “connect() failed (111: Connection refused) while connecting to upstream”.'), { id }), focus: [e, id, 'e-log'], tokens: [{ edge: e, label: 'SYN' }, { edge: e, reverse: true, label: 'RST' }], states: { [id]: 'err' }, values: { log: `${n} line${n > 1 ? 's' : ''}` }, metrics: { lines: n, waited: t } });
      } else if (a.result === 'connect-timeout' || a.result === 'unreachable') {
        t += 60;
        steps.push({ id: `a${n}`, label: `${id}: SYN…`, caption: fmt(b('nginx шлёт SYN на {id} и ждёт: ни отказа, ни ответа. Через proxy_connect_timeout (60 с) — строка «upstream timed out (110: Connection timed out) while connecting to upstream».', 'nginx sends a SYN to {id} and waits: no refusal, no answer. After proxy_connect_timeout (60 s): “upstream timed out (110: Connection timed out) while connecting to upstream”.'), { id }), focus: [e, id, 'e-log'], tokens: [{ edge: e, label: 'SYN' }], states: { [id]: 'err' }, values: { log: `${n} line${n > 1 ? 's' : ''}` }, metrics: { lines: n, waited: t } });
      } else if (a.result === 'read-timeout') {
        steps.push({ id: `w${n}`, label: b(`${id}: ждёт`, `${id}: waits`), caption: fmt(b('Соединение с {id} установлено, запрос отправлен. Приложение ждёт базу, nginx ждёт заголовки ответа. Таймер proxy_read_timeout идёт.', 'The connection to {id} is up and the request sent. The application waits for the database, nginx waits for the response headers. The proxy_read_timeout timer runs.'), { id }), focus: [e, id === 'app1' ? 'e-1d' : 'e-2d', 'db'], tokens: [{ edge: e, label: 'GET /report' }, { edge: id === 'app1' ? 'e-1d' : 'e-2d', label: 'SELECT …' }], states: { [id]: 'wait', db: 'wait' }, metrics: { lines: n - 1, waited: t } });
        t += p.read;
        steps.push({ id: `a${n}`, label: `${id}: ${p.read}s`, caption: fmt(b('Прошло {r} с — ответа нет. nginx закрывает соединение и пишет «upstream timed out (110: Connection timed out) while reading response header from upstream».', '{r} s passed with no answer. nginx closes the connection and writes “upstream timed out (110: Connection timed out) while reading response header from upstream”.'), { r: p.read }), focus: [id, 'e-log', 'log'], states: { [id]: 'err' }, values: { log: `${n} line${n > 1 ? 's' : ''}` }, metrics: { lines: n, waited: t } });
      } else {
        t = o.waited;
        steps.push({ id: `a${n}`, label: `${id}: ${a.status}`, caption: a.status === 200 ? fmt(b('{id} отвечает за {s} с — уложился в таймаут. nginx передаёт ответ клиенту.', '{id} answers in {s} s — within the timeout. nginx passes the answer to the client.'), { id, s: p.db }) : fmt(b('{id} отвечает сам — кодом {c}. Для nginx это нормальный ответ, не ошибка upstream: он передаёт его клиенту без повтора.', '{id} answers by itself — with {c}. For nginx this is a normal answer, not an upstream error: it passes it to the client without a retry.'), { id, c: a.status ?? 0 }), focus: [e, id], tokens: [{ edge: e, reverse: true, label: String(a.status) }], states: { [id]: a.status === 200 ? 'ok' : 'warn' }, metrics: { lines: o.lines.length, waited: t } });
      }
      if (i < o.attempts.length - 1) steps.push({ id: `r${n}`, label: b('повтор', 'retry'), caption: b('proxy_next_upstream error timeout: nginx повторяет тот же запрос на следующем сервере группы и на 10 секунд помечает неудачный как недоступный (max_fails=1, fail_timeout=10s).', 'proxy_next_upstream error timeout: nginx retries the same request on the next server of the group and marks the failed one unavailable for 10 seconds (max_fails=1, fail_timeout=10s).'), focus: ['e-2', 'nginx'], metrics: { lines: n, waited: t } });
    });
    const writer = o.status === 504 || o.status === 502 ? 'nginx' : o.attempts[o.attempts.length - 1]?.addr.startsWith('10.0.2.22') ? 'app2' : 'app1';
    const text: Record<number, [string, string]> = {
      200: ['Клиент получает 200. Пользователь ничего не заметил, но в error.log остались строки о неудачных попытках — их видит только дежурный.', 'The client gets 200. The user noticed nothing, but error.log keeps lines about the failed attempts — only the on-call engineer sees them.'],
      500: ['Клиент получает 500 — его написало приложение, а не nginx. Искать причину надо в логах приложения.', 'The client gets 500 — the application wrote it, not nginx. Look for the cause in the application’s logs.'],
      502: ['Клиент получает 502 Bad Gateway: nginx не смог получить ответ — соединение отвергнуто или оборвано. Код написал nginx.', 'The client gets 502 Bad Gateway: nginx could not get an answer — the connection was refused or broken. nginx wrote the code.'],
      504: ['Клиент получает 504 Gateway Time-out: nginx не дождался upstream. Код написал nginx, причина — дальше, у бэкенда.', 'The client gets 504 Gateway Time-out: nginx did not wait long enough for the upstream. nginx wrote the code; the cause is further on, at the backend.'],
    };
    const tx = text[o.status] ?? text[502];
    const fault = o.status >= 500;
    steps.push({
      id: 'resp',
      label: String(o.status),
      caption: fmt(b(`${tx[0]} Ждал клиент {w} с.`, `${tx[1]} The client waited {w} s.`), { w: o.waited }),
      focus: ['e-c', writer],
      tokens: [{ edge: 'e-c', reverse: true, label: String(o.status) }],
      states: { client: fault ? 'err' : 'ok', [writer]: fault ? 'warn' : 'ok' },
      metrics: { code: o.status, waited: o.waited, lines: o.lines.length },
      ...(fault
        ? {
            broken: {
              at: writer,
              message: `$ curl -s -o /dev/null -w '%{http_code}\\n' http://shop.lab/report\n${o.status}\n$ tail -n ${Math.max(1, o.lines.length)} /var/log/nginx/error.log\n${o.lines.map((l) => l.replace(/, client:.*?, upstream:/, ', … upstream:')).join('\n') || '(empty)'}`,
              caption: o.status === 504 ? b('504 написал nginx: сеть до него в порядке, ответ не пришёл от бэкенда. Строки лога говорят, на каком шаге.', 'nginx wrote the 504: the network up to it is fine; the answer did not come from the backend. The log lines say at which step.') : o.status === 502 ? b('502 написал nginx: подключиться к бэкенду не удалось. «while connecting» в логе — проблема сети, фильтра или процесса.', 'nginx wrote the 502: it could not connect to the backend. “while connecting” in the log points to the network, a filter or the process.') : b('500 написало приложение: nginx тут только курьер.', 'the application wrote the 500: nginx is only the courier here.'),
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
    if (change.kind === 'break' && !change.on) return fmt(b('Поломка убрана: клиент получает {c} через {w} с.', 'The break is removed: the client gets {c} after {w} s.'), { c: c1 ?? 0, w: w1 });
    return fmt(b('Код {a} → {c}, клиент ждал {w} с, строк в error.log: {l}. Первым срабатывает самый короткий таймер на пути.', 'Code {a} → {c}, the client waited {w} s, error.log lines: {l}. The shortest timer on the path fires first.'), { a: c0 ?? 0, c: c1 ?? 0, w: w1, l: l1 });
  },
});
