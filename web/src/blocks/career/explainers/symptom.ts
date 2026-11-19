// О-2 "The situational question: from symptom to cause" (10 §5.2). One
// request path, three hidden causes, one method. Knobs: the hidden cause, the
// application's response time against proxy_read_timeout. Break: restarting
// everything before collecting evidence.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';

type P = { cause: string; appSec: number; timeout: number };

const NGINX_DOC = { url: 'https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_read_timeout', label: 'nginx › proxy_read_timeout' };

export interface SymptomRun {
  /** HTTP status the user sees. */
  status: number;
  /** The last words of the nginx error-log line, or null when there is no error. */
  log: 'reading' | 'connecting' | null;
}

/** What the user sees for a cause and the timings (connect timeout is separate and stays 60 s). */
export function symptomOf(p: P): SymptomRun {
  if (p.cause === 'drop-rule') return { status: 504, log: 'connecting' };
  if (p.cause === 'pool') return p.timeout > 30 ? { status: 500, log: null } : { status: 504, log: 'reading' };
  return p.appSec < p.timeout ? { status: 200, log: null } : { status: 504, log: 'reading' };
}

const card = (whatRu: string, whatEn: string, whoRu: string, whoEn: string, see?: string) => ({ what: bi(whatRu, whatEn), who: bi(whoRu, whoEn), see });

export const symptomModel = defineModel<P>({
  id: 'career.symptom',
  block: 'career',
  title: bi('От симптома к причине: откуда берётся 504', 'From symptom to cause: where a 504 comes from'),
  summary: bi('Каждое наблюдение исключает часть гипотез. Меняй скрытую причину и время ответа — метод остаётся тем же.', 'Each observation rules out some hypotheses. Change the hidden cause and the response time: the method stays the same.'),
  concepts: ['career.situational', 'career.mitigate-first'],
  diagram: {
    width: 960,
    height: 480,
    nodes: [
      { id: 'user', label: bi('Пользователь', 'User'), sub: 'POST /checkout', family: 'user', x: 16, y: 40, w: 160, h: 64, card: card('Браузер пользователя. Видит только итог: код ответа и время.', 'The user’s browser. It only sees the outcome: the status code and the time.', 'Пользователь, жмущий «Оплатить».', 'A user pressing “Pay”.', 'curl -sv https://shop.example/checkout') },
      { id: 'dns', label: 'DNS', sub: 'shop.example → 203.0.113.10', family: 'l7', x: 16, y: 216, w: 224, h: 56, card: card('Превращает имя магазина в адрес. Если бы он сломался, до nginx запрос бы не дошёл.', 'Turns the shop’s name into an address. If it were broken, the request would never reach nginx.', 'Резолвер провайдера и авторитативный сервер зоны.', 'The provider’s resolver and the zone’s authoritative server.', 'dig shop.example') },
      { id: 'nginx', label: 'nginx', sub: 'proxy_read_timeout 30s', family: 'l7', x: 272, y: 40, w: 176, h: 64, card: card('Обратный прокси: принимает HTTPS и передаёт запрос приложению. Отдаёт 504, когда не дождался его ответа.', 'The reverse proxy: accepts HTTPS and passes the request to the application. Returns 504 when it gets no answer in time.', 'Служба nginx на web-1.', 'The nginx service on web-1.', 'tail /var/log/nginx/error.log') },
      { id: 'fw', label: bi('Межсетевой экран', 'Firewall'), sub: 'nftables', family: 'l3', x: 544, y: 40, w: 152, h: 64, card: card('Правила, которые пропускают или отбрасывают пакеты. Отброшенный SYN выглядит как долгое молчание.', 'Rules that pass or drop packets. A dropped SYN looks like a long silence.', 'Сетевая команда, правила выкатываются отдельно от релизов.', 'The network team; rules roll out separately from releases.', 'nft list ruleset') },
      { id: 'app', label: bi('Приложение', 'Application'), sub: '10.0.0.12:8000', family: 'process', x: 784, y: 40, w: 160, h: 64, card: card('Сервис магазина. Ответ на /checkout зависит от базы; /health — нет.', 'The shop service. The answer on /checkout depends on the database; /health does not.', 'Релиз 14:05 через конвейер.', 'The 14:05 release through the pipeline.', "curl -w '%{time_total}' http://10.0.0.12:8000/health") },
      { id: 'db', label: bi('База данных', 'Database'), sub: 'orders: 4.1M rows', family: 'store', x: 784, y: 232, w: 160, h: 64, card: card('Хранит заказы. Запрос без индекса читает всю таблицу.', 'Stores the orders. A query without an index reads the whole table.', 'PostgreSQL на отдельной машине.', 'PostgreSQL on its own machine.', 'журнал медленных запросов / slow query log') },
      { id: 'errlog', label: 'error.log', sub: '—', family: 'obj', shape: 'doc', x: 272, y: 232, w: 176, h: 64, card: card('Журнал ошибок nginx. Последние слова строки отличают «не дождался ответа» от «не смог соединиться».', 'The nginx error log. The last words of the line tell “no answer in time” from “could not connect”.', 'nginx пишет сам при каждой ошибке upstream.', 'nginx writes it on every upstream error.', 'tail /var/log/nginx/error.log') },
      { id: 'hyp', label: bi('Гипотезы', 'Hypotheses'), sub: '8', family: 'neutral', shape: 'buffer', x: 16, y: 360, w: 432, h: 72, card: card('Что могло сломаться: DNS, сертификат, сеть клиента, nginx, межсетевой экран, приложение, пул соединений, база. Улики их гасят.', 'What could be broken: DNS, the certificate, the client network, nginx, the firewall, the application, the connection pool, the database. Evidence rules them out.', 'Дежурный, по мере сбора улик.', 'The on-call engineer, as evidence comes in.') },
    ],
    edges: [
      { id: 'e-dns', from: 'user', to: 'dns', label: bi('имя → адрес', 'name → address'), card: card('Первый шаг любого запроса — найти адрес по имени.', 'The first step of any request is finding the address for the name.', 'Резолвер.', 'The resolver.') },
      { id: 'e-https', from: 'user', to: 'nginx', label: 'HTTPS', card: { ...card('Соединение до прокси: если ответ пришёл от nginx, этот участок цел.', 'The connection to the proxy: if the answer came from nginx, this part is intact.', 'Браузер и nginx.', 'The browser and nginx.'), doc: { url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/504', label: 'MDN › 504' } } },
      { id: 'e-proxy', from: 'nginx', to: 'fw', label: 'proxy_pass', card: { ...card('nginx передаёт запрос приложению и ждёт ответа не дольше proxy_read_timeout.', 'nginx passes the request to the application and waits no longer than proxy_read_timeout.', 'Конфигурация nginx.', 'The nginx configuration.'), doc: NGINX_DOC } },
      { id: 'e-fw', from: 'fw', to: 'app', label: 'SYN :8000', card: card('Пакеты к приложению проходят через правила межсетевого экрана.', 'Packets to the application pass through the firewall rules.', 'Ядро по правилам nftables.', 'The kernel, by the nftables rules.', 'ss -tn dst 10.0.0.12') },
      { id: 'e-sql', from: 'app', to: 'db', label: 'SQL', card: card('Обработчик оформления ходит в базу; пока база думает, ответа nginx нет.', 'The checkout handler queries the database; while the database thinks, nginx gets no answer.', 'Код приложения через пул соединений.', 'The application code, through its connection pool.') },
      { id: 'e-log', from: 'nginx', to: 'errlog', label: bi('пишет причину', 'writes the reason'), card: card('Каждая ошибка upstream — строка в журнале.', 'Every upstream error is a line in the log.', 'nginx.', 'nginx.') },
      { id: 'e-hyp', from: 'errlog', to: 'hyp', label: bi('улика гасит гипотезы', 'evidence rules out hypotheses'), via: [[360, 328]], card: card('Каждое наблюдение отбрасывает гипотезы, которые ему противоречат.', 'Each observation drops the hypotheses that contradict it.', 'Дежурный.', 'The on-call engineer.') },
    ],
  },
  params: [
    {
      id: 'cause',
      label: bi('Скрытая причина', 'Hidden cause'),
      kind: 'choice',
      default: 'slow-sql',
      options: [
        { id: 'slow-sql', label: bi('запрос без индекса', 'a query without an index') },
        { id: 'pool', label: bi('пул соединений исчерпан', 'the connection pool is exhausted') },
        { id: 'drop-rule', label: bi('правило drop на порт 8000', 'a drop rule on port 8000') },
      ],
      near: 'errlog',
      predict: {
        prompt: bi('Причина — правило, отбрасывающее пакеты. Чем закончится строка в error.log?', 'The cause is a rule that drops packets. How will the error.log line end?'),
        options: [
          { id: 'reading', text: bi('…while reading response header from upstream', '…while reading response header from upstream') },
          { id: 'connecting', text: bi('…while connecting to upstream', '…while connecting to upstream') },
        ],
        resolve: (_p, next) => (next.some((s) => s.values?.errlog?.includes('connecting')) ? 'connecting' : 'reading'),
      },
    },
    {
      id: 'appSec',
      label: bi('Время ответа приложения на /checkout', 'Application response time on /checkout'),
      kind: 'range',
      min: 1,
      max: 90,
      step: 1,
      unit: 's',
      default: 35,
      near: 'app',
      predict: {
        prompt: bi('Приложение стало отвечать быстрее таймаута nginx. Что увидит пользователь?', 'The application now answers faster than the nginx timeout. What does the user see?'),
        options: [
          { id: '504', text: bi('504', '504') },
          { id: '200', text: bi('200, но медленно', '200, but slowly') },
        ],
        resolve: (_p, next) => (next[next.length - 1]?.metrics?.status === 200 ? '200' : '504'),
      },
    },
    { id: 'timeout', label: bi('proxy_read_timeout', 'proxy_read_timeout'), kind: 'range', min: 10, max: 120, step: 5, unit: 's', default: 30, near: 'nginx', levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    {
      id: 'restart-first',
      label: bi('Перезапустить всё до сбора улик', 'Restart everything before collecting evidence'),
      remove: ['errlog', 'e-log', 'e-hyp'],
      boundary: 'process',
      predict: {
        prompt: bi('Ты перезапустил nginx и приложение до чтения журналов. Сколько гипотез останется?', 'You restarted nginx and the application before reading the logs. How many hypotheses remain?'),
        options: [
          { id: '1', text: bi('Одна: перезапуск всё починил', 'One: the restart fixed it') },
          { id: '5', text: bi('Пять: улики стёрты, причина на месте', 'Five: the evidence is gone, the cause is still there') },
          { id: '0', text: bi('Ни одной', 'None') },
        ],
        resolve: (_p, next) => String(next[next.length - 1]?.metrics?.hyp ?? 0),
      },
    },
  ],
  metrics: [
    { id: 'hyp', label: bi('гипотез осталось', 'hypotheses left') },
    { id: 'status', label: bi('код у пользователя', 'status the user sees') },
    { id: 'down', label: bi('простой', 'downtime'), unit: 'min' },
  ],
  run(p, broken): Step[] {
    const s = symptomOf(p);
    const steps: Step[] = [];
    if (s.status === 200) {
      return [
        { id: 'req', label: 'POST', caption: fmt(bi('Пользователь жмёт «Оплатить»; nginx передаёт запрос приложению и ждёт до {t} с.', 'The user presses “Pay”; nginx passes the request on and waits up to {t} s.'), { t: p.timeout }), focus: ['user', 'e-https', 'nginx', 'e-proxy'], tokens: [{ edge: 'e-https' }, { edge: 'e-proxy' }], values: { nginx: `proxy_read_timeout ${p.timeout}s` }, metrics: { hyp: 8, status: 0, down: 0 } },
        { id: 'slow', label: bi('ждём', 'wait'), caption: fmt(bi('Приложение отвечает через {a} с — раньше таймаута.', 'The application answers after {a} s, before the timeout.'), { a: p.appSec }), focus: ['app', 'e-sql', 'db'], states: { app: 'warn', db: 'warn' }, values: { app: `${p.appSec}s` } },
        { id: 'ok', label: '200', caption: bi('Пользователь получает 200, но ждёт долго. Это не 504, а медленная страница: та же причина, другой симптом.', 'The user gets 200 but waits a long time. Not a 504 but a slow page: the same cause, another symptom.'), focus: ['user', 'e-https'], states: { user: 'warn' }, values: { user: `200 · ${p.appSec}s` }, metrics: { hyp: 8, status: 200, down: 0 } },
      ];
    }
    steps.push(
      { id: 'symptom', label: bi('симптом', 'symptom'), caption: fmt(bi('Симптом: у всех на оформлении — {c}.', 'The symptom: checkout fails for everyone with {c}.'), { c: s.status }), focus: ['user', 'e-https', 'nginx'], states: { user: 'err' }, values: { user: `HTTP/2 ${s.status}`, hyp: '8', nginx: `proxy_read_timeout ${p.timeout}s` }, fill: { hyp: 1 }, metrics: { hyp: 8, status: s.status, down: 2 } },
      { id: 'observe', label: 'curl -sv', caption: bi('`curl -sv`: соединение и TLS прошли, ответ подписан `server: nginx`. DNS, сеть клиента и сертификат исключены.', '`curl -sv`: the connection and TLS went through, the answer is signed `server: nginx`. DNS, the client network and the certificate are ruled out.'), focus: ['e-https', 'dns', 'nginx'], tokens: [{ edge: 'e-https', label: 'SYN' }], states: { dns: 'ok', 'e-dns': 'ok', 'e-https': 'ok' }, values: { hyp: '5' }, fill: { hyp: 5 / 8 }, metrics: { hyp: 5, status: s.status, down: 4 } },
    );
    if (broken.has('restart-first')) {
      steps.push({
        id: 'restart',
        label: 'restart',
        caption: bi('Перезапустили nginx и приложение «на всякий случай». Журналы прошлых запусков пропали, гипотез всё так же пять.', 'nginx and the application were restarted “just in case”. The logs of previous runs are gone; there are still five hypotheses.'),
        focus: ['nginx', 'app'],
        states: { nginx: 'wait', app: 'wait' },
        values: { hyp: '5' },
        fill: { hyp: 5 / 8 },
        metrics: { hyp: 5, status: s.status, down: 9 },
        broken: { at: 'nginx', message: '$ tail /var/log/nginx/error.log\n(empty)\n…a minute later: HTTP/2 504 again', caption: bi('перезапуск стёр улики и не убрал причину: симптом вернулся с первой волной запросов.', 'the restart wiped the evidence and left the cause: the symptom came back with the first wave of requests.') },
      });
      return steps;
    }
    const line = s.log === 'connecting' ? 'while connecting to upstream' : 'while reading response header';
    steps.push({
      id: 'log',
      label: 'error.log',
      caption: s.log === 'connecting' ? bi('В журнале «while connecting to upstream»: nginx даже не установил соединение. Ветка «сеть до приложения».', 'The log says “while connecting to upstream”: nginx did not even connect. The branch is “the network to the application”.') : s.status === 500 ? bi('nginx получил от приложения 500: соединение есть, приложение само сдалось по своему таймауту.', 'nginx got a 500 from the application: there is a connection, the application gave up on its own timeout.') : bi('В журнале «while reading response header»: соединение есть, ответа нет. Ветка «приложение и то, чего оно ждёт».', 'The log says “while reading response header”: connected, no answer. The branch is “the application and what it waits for”.'),
      focus: ['e-log', 'errlog', 'e-hyp'],
      tokens: [{ edge: 'e-log' }, { edge: 'e-hyp' }],
      values: { errlog: s.log ? line : 'upstream returned 500', hyp: '3' },
      fill: { hyp: 3 / 8 },
      metrics: { hyp: 3, status: s.status, down: 6 },
    });
    if (p.cause === 'drop-rule') {
      steps.push(
        { id: 'narrow', label: 'ss -tn', caption: bi('`ss -tn`: соединения висят в SYN-SENT — SYN ушёл, ответа нет. Кто-то молча отбрасывает пакеты.', '`ss -tn`: connections hang in SYN-SENT — the SYN went out and nothing came back. Something silently drops packets.'), focus: ['e-proxy', 'fw', 'e-fw'], tokens: [{ edge: 'e-proxy', label: 'SYN' }], states: { 'e-fw': 'err' }, values: { hyp: '1' }, fill: { hyp: 1 / 8 }, metrics: { hyp: 1, status: 504, down: 9 } },
        { id: 'cause', label: 'nft', caption: bi('`nft list ruleset`: правило из выкатки сетевиков в 14:08 отбрасывает порт 8000.', '`nft list ruleset`: a rule from the network team’s 14:08 rollout drops port 8000.'), focus: ['fw'], states: { fw: 'err' }, values: { fw: 'tcp dport 8000 drop' }, metrics: { hyp: 1, status: 504, down: 11 } },
        { id: 'mitigate', label: bi('откат правила', 'roll back rule'), caption: bi('Откатываем то, что изменилось, — правило, а не релиз. Доля ошибок падает с 31% до 0,3% за минуту.', 'Roll back what changed — the rule, not the release. The error share drops from 31% to 0.3% in a minute.'), focus: ['fw', 'e-fw', 'app'], tokens: [{ edge: 'e-fw' }], states: { fw: 'ok', 'e-fw': 'ok', user: 'ok' }, values: { user: 'HTTP/2 200' }, metrics: { hyp: 0, status: 200, down: 12 } },
      );
    } else {
      const slow = p.cause === 'slow-sql';
      steps.push(
        { id: 'narrow', label: bi('мимо nginx', 'bypass nginx'), caption: slow ? fmt(bi('Напрямую: /health — 0,01 с, /checkout — {a} с. Тормозит один обработчик.', 'Directly: /health takes 0.01 s, /checkout {a} s. One handler is slow.'), { a: p.appSec }) : bi('Напрямую: /health — 0,01 с, /checkout падает с 500 через 30 с. Обработчик чего-то ждёт.', 'Directly: /health takes 0.01 s, /checkout fails with 500 after 30 s. The handler waits for something.'), focus: ['app'], states: { app: 'warn' }, values: { app: slow ? `/checkout ${p.appSec}s` : '/checkout 500 @30s', hyp: '1' }, fill: { hyp: 1 / 8 }, metrics: { hyp: 1, status: s.status, down: 9 } },
        { id: 'cause', label: slow ? 'Seq Scan' : 'QueuePool', caption: slow ? bi('Журнал медленных запросов: новый запрос релиза 14:05 читает всю таблицу заказов — индекса нет.', 'The slow query log: a new query from the 14:05 release reads the whole orders table — there is no index.') : bi('Журнал приложения: пул из пяти соединений исчерпан — новый код держит сессию, пока ждёт платёжный сервис.', 'The application log: the pool of five connections is exhausted — the new code holds a session while waiting for the payments service.'), focus: slow ? ['db', 'e-sql'] : ['app', 'e-sql'], states: slow ? { db: 'err', 'e-sql': 'err' } : { app: 'err', 'e-sql': 'err' }, values: slow ? { db: 'Seq Scan 34.8s' } : { app: 'pool 5/5 busy' }, metrics: { hyp: 1, status: s.status, down: 11 } },
        { id: 'mitigate', label: bi('откат релиза', 'roll back release'), caption: bi('Откатываем то, что изменилось, — релиз 14:05. Доля ошибок падает до 0,4%; чинить будем миграцией через конвейер.', 'Roll back what changed — the 14:05 release. The error share falls to 0.4%; the fix goes out as a migration through the pipeline.'), focus: ['app', 'e-sql', 'db'], states: { app: 'ok', db: 'ok', 'e-sql': 'ok', user: 'ok' }, values: { user: 'HTTP/2 200' }, metrics: { hyp: 0, status: 200, down: 14 } },
      );
    }
    steps.push({ id: 'status', label: bi('статус', 'status'), caption: bi('Статус команде: влияние, что сделано, когда следующее сообщение. Затем разбор без виноватых.', 'A status to the team: the impact, what was done, when the next message comes. Then a blameless review.'), focus: ['user'], states: { user: 'ok' }, metrics: { hyp: 0, status: 200, down: steps[steps.length - 1].metrics?.down ?? 12 } });
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    const last = (x: Step[]) => x[x.length - 1]?.metrics ?? {};
    if (change.kind === 'break') return change.on ? bi('Перезапуск до улик: журналы пусты, гипотез по-прежнему пять, симптом вернулся.', 'A restart before evidence: the logs are empty, five hypotheses remain, the symptom is back.') : bi('Улики снова собираются по порядку: журнал ошибок сужает ветку.', 'Evidence is collected in order again: the error log narrows the branch.');
    if (change.id === 'cause') return fmt(bi('Причина сменилась ({a} → {b}), а первые шаги метода — те же; изменилась строка журнала и ветка, куда она ведёт.', 'The cause changed ({a} → {b}), but the first steps of the method stay; only the log line and the branch it leads to changed.'), { a: String(a.cause), b: String(b.cause) });
    const s0 = last(prev).status;
    const s1 = last(next).status;
    if (b.cause === 'drop-rule') return bi('При отброшенном SYN время ответа приложения не важно: nginx не может даже соединиться.', 'With the SYN dropped, the application’s response time does not matter: nginx cannot even connect.');
    if (s0 === s1) return fmt(bi('Ответ за {a} с при таймауте {t} с: пользователь видит то же самое.', 'An answer in {a} s against a {t} s timeout: the user sees the same.'), { a: b.appSec, t: b.timeout });
    return next.some((x) => x.metrics?.status === 200) && !next.some((x) => x.metrics?.status === 504)
      ? fmt(bi('Приложение отвечает за {a} с — быстрее таймаута {t} с: 504 сменился на медленный 200.', 'The application answers in {a} s, under the {t} s timeout: the 504 became a slow 200.'), { a: b.appSec, t: b.timeout })
      : fmt(bi('Ответ за {a} с не укладывается в {t} с: nginx сдаётся и отдаёт 504.', 'An answer in {a} s does not fit in {t} s: nginx gives up and returns 504.'), { a: b.appSec, t: b.timeout });
  },
});
