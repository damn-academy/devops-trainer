// О-2 "The situational question: from symptom to cause" (10 §5.2). One
// request path, three hidden causes, one method. Knobs: the hidden cause, the
// application's response time against proxy_read_timeout. Break: restarting
// everything before collecting evidence.
//
// Reading order: the picture is built from zero. At the start there are only
// the user's browser and the on-call engineer's list of hypotheses. Every
// observation brings in the part of the system it looks at: the answer of
// `curl -sv` brings nginx (and shows DNS as ruled out), the error log line
// appears under nginx, the application and the firewall appear when the
// engineer checks them. The block that produces the evidence says in a
// callout what it shows, the evidence itself travels along the line as a
// card, and the list of hypotheses shrinks under the diagram.

import { defineModel } from '../../../core/define';
import { bi, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { fmtb, nouned, startWith, tr } from './util';

/** The size of the orders table under the database node. */
const ORDERS = () => tr('orders: 4,1 млн строк', 'orders: 4.1M rows');

const sec = (x: number) => nouned(x, ['секунду', 'секунды', 'секунд'], ['second', 'seconds']);
const secGen = (x: number) => nouned(x, ['секунды', 'секунд', 'секунд'], ['second', 'seconds']);

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

const ALL = ['user', 'dns', 'nginx', 'errlog', 'fw', 'app', 'db', 'hyp', 'e-dns', 'e-https', 'e-proxy', 'e-fw', 'e-sql', 'e-log'];

const CAUSE: Record<string, Bi> = {
  'slow-sql': bi('медленный запрос к базе без индекса', 'a slow query without an index'),
  pool: bi('исчерпанный пул соединений с базой', 'an exhausted connection pool'),
  'drop-rule': bi('правило межсетевого экрана, которое отбрасывает пакеты', 'a firewall rule that drops packets'),
};

export const symptomModel = defineModel<P>({
  id: 'career.symptom',
  block: 'career',
  title: bi('Как найти причину ошибки 504', 'From symptom to cause: where a 504 comes from'),
  summary: bi(
    'Пользователи жалуются, что оплата в магазине заканчивается ошибкой 504. Дежурный инженер по очереди смотрит на части системы, и каждое наблюдение вычёркивает из его списка часть гипотез, пока не останется одна причина. Скрытую причину выбираете вы, а метод поиска остаётся тем же.',
    'Users complain that checkout ends with a 504. The on-call engineer looks at the parts of the system one by one, and every observation crosses some hypotheses off the list until one cause is left. You choose the hidden cause; the method stays the same.',
  ),
  intro: bi(
    'Схема собирается по шагам, и сейчас на ней только браузер пользователя и список гипотез дежурного. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Каждое наблюдение добавляет на схему ту часть системы, на которую смотрит дежурный. Облачко у подсвеченного блока говорит, что этот блок показывает, карточка на линии несёт саму улику, а счётчик «гипотез осталось» под схемой уменьшается.\n\nКогда дойдёте до отката, выберите в «Параметрах» другую скрытую причину и пройдите поиск ещё раз.',
    'The diagram builds itself as you go, and now it shows only the user’s browser and the on-call engineer’s list of hypotheses. Press “Start from the first step”, then go on with “Step forward” above the diagram. Every observation adds the part of the system the engineer looks at. The callout at the highlighted block says what that block shows, the card on the line carries the evidence itself, and the “hypotheses left” counter under the diagram goes down.\n\nOnce you reach the rollback, choose another hidden cause in “Parameters” and walk the search again.',
  ),
  legend: [
    { mark: 'active', text: bi('часть системы, на которую дежурный смотрит сейчас', 'the part of the system the engineer looks at now') },
    { mark: 'say', text: bi('что эта часть показывает', 'what that part shows') },
    { mark: 'token', text: bi('улика, то есть ответ команды или строка журнала', 'the evidence, that is, a command’s answer or a log line') },
    { mark: 'icon:browser', text: bi('браузер пользователя', 'the user’s browser') },
    { mark: 'icon:server', text: bi('обратный прокси nginx', 'the nginx reverse proxy') },
    { mark: 'icon:lock', text: bi('межсетевой экран', 'the firewall') },
    { mark: 'icon:process', text: bi('приложение магазина', 'the shop application') },
    { mark: 'ok', text: bi('гипотеза об этой части исключена', 'this part is ruled out') },
    { mark: 'warn', text: bi('здесь что-то подозрительно', 'something suspicious here') },
    { mark: 'err', text: bi('найденная причина', 'the cause found') },
  ],
  stopLabel: bi('Поиск причины остановился', 'The search stopped'),
  concepts: ['career.situational', 'career.mitigate-first'],
  diagram: {
    width: 960,
    height: 480,
    nodes: [
      { id: 'user', label: bi('Браузер', 'Browser'), icon: 'browser', work: 'dots', sub: 'POST /checkout', family: 'user', x: 16, y: 40, w: 160, h: 64, card: card('Браузер покупателя, который нажал кнопку «Оплатить». Пользователь видит только итог: код ответа и то, сколько секунд он ждал.', 'The browser of a customer who pressed “Pay”. The user only sees the outcome: the status code and how long they waited.', 'Браузер запускает сам покупатель. Дежурный повторяет его запрос командой `curl -sv`.', 'The customer runs the browser; the engineer repeats the request with `curl -sv`.', 'curl -sv https://shop.example/checkout') },
      { id: 'dns', label: 'DNS', icon: 'dns', sub: '203.0.113.10', family: 'l7', x: 16, y: 216, w: 160, h: 64, card: card('Система имён, которая превращает имя магазина в адрес сервера. Если бы она не работала, запрос не дошёл бы даже до nginx.', 'Turns the shop’s name into an address. If it were broken, the request would never reach nginx.', 'Отвечают резолвер провайдера и сервер, который хранит записи зоны магазина.', 'The provider’s resolver and the zone’s authoritative server.', 'dig shop.example') },
      { id: 'nginx', label: 'nginx', icon: 'server', work: 'spin', sub: 'proxy_read_timeout 30s', family: 'l7', x: 264, y: 40, w: 176, h: 64, card: { ...card('nginx служит обратным прокси, то есть принимает соединение HTTPS от браузера и передаёт запрос приложению. Если приложение не ответило за время proxy_read_timeout, nginx сам отвечает браузеру кодом 504 Gateway Timeout.', 'The reverse proxy: accepts HTTPS from the browser and passes the request to the application. If the application does not answer within proxy_read_timeout, nginx itself answers 504 Gateway Timeout.', 'Служба nginx работает на сервере web-1 и настроена файлом конфигурации сайта.', 'The nginx service on web-1, configured by the site’s config file.', 'tail /var/log/nginx/error.log'), doc: NGINX_DOC } },
      { id: 'errlog', label: bi('Журнал ошибок nginx', 'nginx error log'), icon: 'file', sub: 'error.log', family: 'obj', x: 228, y: 216, w: 248, h: 64, card: card('Файл /var/log/nginx/error.log, в который nginx записывает каждую неудачу при обращении к приложению. По последним словам строки видно, что случилось: «while connecting to upstream» означает, что nginx не установил соединение, а «while reading response header» означает, что соединение есть, но ответа не было.', 'The file /var/log/nginx/error.log where nginx records every failure to reach the application. The last words tell what happened: “while connecting” means no connection, “while reading response header” means connected but no answer.', 'Строки пишет сам nginx.', 'nginx writes it.', 'tail /var/log/nginx/error.log') },
      { id: 'fw', label: bi('Межсетевой экран', 'Firewall'), icon: 'lock', sub: 'nftables', family: 'l3', x: 528, y: 40, w: 160, h: 64, card: card('Правила, по которым ядро сервера пропускает или отбрасывает пакеты. Когда пакет отброшен, об отказе никто не сообщает, и отправитель не получает никакого ответа и продолжает ждать.', 'Rules by which the kernel passes or drops packets. A dropped packet is not refused aloud: the sender just gets no answer and waits.', 'Правила вводят сетевые инженеры, и делают это отдельно от выпусков приложения.', 'The network team rolls the rules out, separately from releases.', 'nft list ruleset') },
      { id: 'app', label: bi('Приложение', 'Application'), icon: 'process', work: 'spin', sub: '10.0.0.12:8000', family: 'process', x: 784, y: 40, w: 160, h: 64, card: card('Сервис магазина. Страница проверки /health отвечает сразу, а ответ на /checkout зависит от базы данных.', 'The shop service. The /health page answers at once; the answer on /checkout depends on the database.', 'Новую версию выложили в 14:05 через конвейер.', 'The new version went out at 14:05 through the pipeline.', "curl -w '%{time_total}' http://10.0.0.12:8000/health") },
      { id: 'db', label: bi('База данных', 'Database'), icon: 'database', work: 'spin', sub: 'orders: 4.1M rows', family: 'store', x: 784, y: 216, w: 160, h: 64, card: card('PostgreSQL, в котором хранятся заказы. Запрос, для которого нет индекса, читает таблицу целиком, а в таблице orders 4,1 миллиона строк.', 'PostgreSQL storing the orders. A query without an index reads the whole table, and orders has 4.1 million rows.', 'База работает на отдельной машине, её обслуживает администратор баз данных.', 'A separate machine, looked after by the DBA.', 'tail /var/log/postgresql/postgresql.log') },
      { id: 'hyp', label: bi('Гипотезы дежурного', 'The engineer’s hypotheses'), sub: '8', family: 'neutral', shape: 'buffer', x: 16, y: 360, w: 448, h: 80, card: card('Список того, что могло сломаться: DNS, сертификат, сеть пользователя, сам nginx, межсетевой экран, приложение, пул соединений с базой и сама база. Каждое наблюдение вычёркивает гипотезы, которые ему противоречат, и список становится короче.', 'What could be broken: DNS, the certificate, the user’s network, nginx itself, the firewall, the application, the connection pool and the database. Every observation crosses out the hypotheses that contradict it.', 'Список ведёт дежурный инженер.', 'The on-call engineer keeps it.') },
    ],
    edges: [
      { id: 'e-dns', from: 'user', to: 'dns', label: bi('поиск адреса по имени', 'address lookup'), card: card('На первом шаге любого запроса браузер узнаёт адрес сервера по имени магазина.', 'At the first step of any request the browser finds the server’s address by the shop’s name.', 'Вопрос задаёт система компьютера пользователя.', 'The user’s system asks.') },
      { id: 'e-https', from: 'user', to: 'nginx', label: 'HTTPS', card: { ...card('Соединение браузера с nginx. Если ответ пришёл от nginx, значит, этот участок пути работает, то есть имя нашлось, соединение установлено и сертификат принят.', 'The browser’s connection to nginx. If the answer came from nginx, this part works: the name resolved, the connection opened, the certificate was accepted.', 'Соединение открывает браузер, принимает nginx.', 'The browser opens it, nginx accepts it.'), doc: { url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/504', label: 'MDN › 504' } } },
      { id: 'e-proxy', from: 'nginx', to: 'fw', label: bi('запрос приложению', 'request to the app'), card: { ...card('nginx передаёт запрос приложению (директива proxy_pass) и ждёт ответа не дольше proxy_read_timeout.', 'nginx passes the request on (proxy_pass) and waits no longer than proxy_read_timeout.', 'Такое поведение задаёт конфигурация nginx.', 'The nginx configuration.'), doc: NGINX_DOC } },
      { id: 'e-fw', from: 'fw', to: 'app', label: bi('порт 8000', 'port 8000'), card: card('Пакеты к приложению проходят через правила межсетевого экрана.', 'Packets to the application pass the firewall rules.', 'Пакеты пропускает или отбрасывает ядро по правилам nftables.', 'The kernel, by the nftables rules.', 'ss -tn dst 10.0.0.12') },
      { id: 'e-sql', from: 'app', to: 'db', label: bi('запрос SQL', 'SQL query'), card: card('Обработчик оплаты обращается к базе. Пока база выполняет запрос, nginx не получает от приложения ответа.', 'The checkout handler queries the database; while it works, nginx gets no answer.', 'Запрос отправляет код приложения через пул соединений.', 'The application code, through its connection pool.') },
      { id: 'e-log', from: 'nginx', to: 'errlog', label: bi('записывает причину', 'writes the reason'), card: card('Каждая неудача при обращении к приложению становится строкой журнала.', 'Every failure to reach the application becomes a log line.', 'Строку пишет nginx.', 'nginx.') },
    ],
  },
  params: [
    {
      id: 'cause',
      label: bi('Что сломалось на самом деле', 'What really broke'),
      kind: 'choice',
      default: 'slow-sql',
      group: bi('Скрытая причина сбоя', 'The hidden cause'),
      options: [
        { id: 'slow-sql', label: bi('новый запрос к базе идёт без индекса', 'a new query runs without an index') },
        { id: 'pool', label: bi('кончились соединения с базой в пуле приложения', 'the application’s connection pool is exhausted') },
        { id: 'drop-rule', label: bi('новое правило межсетевого экрана отбрасывает пакеты на порт 8000', 'a new firewall rule drops packets to port 8000') },
      ],
      near: 'hyp',
      predict: {
        prompt: bi('Вы выбираете другую скрытую причину сбоя. Изменятся ли первые два шага поиска, то есть жалоба пользователя и проверка командой `curl -sv`?', 'You choose another hidden cause. Will the first two steps of the search change, that is, the user’s complaint and the `curl -sv` check?'),
        options: [
          { id: 'same', text: bi('Нет, первые шаги одинаковы при любой причине, а меняются строка журнала и то, куда она ведёт', 'No, the first steps are the same for any cause, and what changes is the log line and where it leads') },
          { id: 'differ', text: bi('Да, для каждой причины дежурный начинает с другой проверки', 'Yes, for every cause the engineer starts with a different check') },
        ],
        resolve: (prev, next) => (prev.slice(0, 2).map((s) => s.id).join() === next.slice(0, 2).map((s) => s.id).join() ? 'same' : 'differ'),
      },
    },
    {
      id: 'appSec',
      label: bi('За сколько секунд приложение отвечает на /checkout', 'How many seconds the application takes on /checkout'),
      kind: 'range',
      min: 1,
      max: 90,
      step: 1,
      default: 35,
      near: 'app',
      group: bi('Сколько длится ожидание', 'How long the waiting lasts'),
      predict: {
        prompt: bi('Вы меняете время, за которое приложение отвечает на /checkout, а nginx по-прежнему ждёт ответа не дольше, чем указано в proxy_read_timeout. Что увидит пользователь при новом значении?', 'You change how long the application takes on /checkout, while nginx still waits no longer than proxy_read_timeout. What does the user see with the new value?'),
        options: [
          { id: '504', text: bi('Ошибку 504, как и раньше', 'A 504, as before') },
          { id: '200', text: bi('Страницу с кодом 200, но после долгого ожидания', 'A page with 200, after a long wait') },
        ],
        resolve: (_p, next) => (next.some((x) => x.id === 'slow') ? '200' : '504'),
      },
    },
    { id: 'timeout', label: bi('Сколько секунд nginx ждёт ответа (proxy_read_timeout)', 'How many seconds nginx waits (proxy_read_timeout)'), kind: 'range', min: 10, max: 120, step: 5, default: 30, near: 'nginx', levels: ['intermediate', 'experienced'], group: bi('Сколько длится ожидание', 'How long the waiting lasts') },
  ],
  breaks: [
    {
      id: 'restart-first',
      label: bi('Перезапустить nginx и приложение, не прочитав журналы', 'Restart nginx and the application without reading the logs'),
      remove: ['errlog', 'e-log'],
      boundary: 'process',
      predict: {
        prompt: bi('Проверка командой `curl -sv` уже вычеркнула три гипотезы из восьми, и осталось пять. Теперь вы перезапускаете nginx и приложение, не прочитав журналы. Сколько гипотез останется после перезапуска?', '`curl -sv` has already crossed out three of eight hypotheses; five are left. Now you restart nginx and the application without reading the logs. How many hypotheses are left after the restart?'),
        options: [
          { id: '0', text: bi('Ни одной, потому что перезапуск устранил причину', 'None, because the restart removed the cause') },
          { id: '5', text: bi('Пять, потому что журналы стёрты, а причина осталась на месте', 'Five, because the logs are wiped and the cause is still there') },
          { id: '1', text: bi('Одна, потому что после перезапуска сразу видно, что было не так', 'One, because after the restart it is obvious what was wrong') },
        ],
        resolve: (_p, next) => String(next[next.length - 1]?.metrics?.hyp ?? 0),
      },
    },
  ],
  metrics: [
    { id: 'hyp', label: bi('гипотез осталось', 'hypotheses left') },
    { id: 'down', label: bi('минут с начала сбоя', 'minutes since the failure began') },
  ],
  run(p, broken): Step[] {
    const s = symptomOf(p);
    const steps: Step[] = [];
    if (s.status === 200) {
      const slowRun: Step[] = [
        {
          id: 'req',
          label: bi('запрос', 'request'),
          caption: bi('Пользователь нажимает «Оплатить», и браузер отправляет запрос POST /checkout. По адресу магазина ему отвечает nginx, который стоит перед приложением.', 'The user presses “Pay” and the browser sends POST /checkout. nginx, in front of the application, takes it.'),
          focus: ['user', 'e-https'],
          reveal: ['nginx', 'e-https'],
          tokens: [{ edge: 'e-https', label: 'POST /checkout' }],
          say: { user: bi('Браузер отправляет запрос оплаты и ждёт ответа.', 'The browser sends the checkout request and waits.') },
          states: startWith(ALL, 'user', 'hyp'),
          values: { nginx: `proxy_read_timeout ${p.timeout}s` },
          metrics: { hyp: 8, down: 0 },
        },
        {
          id: 'wait',
          label: bi('ждёт', 'waits'),
          caption: fmtb(bi('nginx передаёт запрос приложению и готов ждать ответа до {t} секунд. Межсетевой экран пропускает пакеты, так что запрос доходит до приложения.', 'nginx passes the request on and is ready to wait up to {t} seconds. The firewall lets the packets through.'), { t: p.timeout }),
          focus: ['nginx', 'e-proxy'],
          reveal: ['e-proxy', 'fw', 'e-fw', 'app'],
          tokens: [{ edge: 'e-proxy', label: 'POST /checkout' }],
          say: { nginx: fmtb(bi('nginx передал запрос приложению и ждёт ответа не дольше {t} секунд.', 'nginx passed the request on and waits up to {t} s.'), { t: p.timeout }) },
          states: { fw: 'ok', 'e-fw': 'ok' },
          metrics: { hyp: 8, down: 0 },
        },
        {
          id: 'slow',
          label: bi('ответ', 'answer'),
          caption: fmtb(bi('Приложение отвечает через {a}. Это дольше обычного, потому что запрос к базе выполняется медленно, но тайм-аут nginx, то есть предельное время ожидания ответа, к этому времени ещё не истёк, поэтому nginx дожидается ответа.', 'The application answers after {a}: slower than usual because of the database, but before the nginx timeout, so nginx waits it out.'), { a: sec(p.appSec) }),
          focus: ['app', 'e-fw'],
          reveal: ['e-sql', 'db'],
          tokens: [{ edge: 'e-fw', label: `200 · ${p.appSec} s`, reverse: true }],
          say: { app: fmtb(bi('Приложение отвечает через {a}, медленно, но раньше, чем истекает тайм-аут nginx.', 'The application answers after {a}: slow, but within the timeout.'), { a: sec(p.appSec) }) },
          states: { app: 'warn', db: 'warn' },
          values: { app: `${p.appSec}s` },
          metrics: { hyp: 8, down: 0 },
        },
        {
          id: 'ok',
          label: '200',
          caption: fmtb(bi('Браузер получает страницу с кодом 200, но пользователь ждал её {a}. Ошибки 504 больше нет, зато страница открывается медленно. Причина осталась той же, а симптом сменился, и теперь пользователи жалуются на то, что оплата «висит».', 'The browser gets a 200 page, but the user waited {a}. No 504, but a slow page: the same cause, another symptom.'), { a: sec(p.appSec) }),
          focus: ['user', 'e-https'],
          tokens: [{ edge: 'e-https', label: 'HTTP/2 200', reverse: true }],
          say: { user: fmtb(bi('Страница оплаты открылась, но только через {a}.', 'The checkout page opened, but after {a}.'), { a: sec(p.appSec) }) },
          states: { user: 'warn' },
          values: { user: `200 · ${p.appSec}s` },
          metrics: { hyp: 8, down: 0 },
        },
      ];
      if (broken.has('restart-first'))
        slowRun.push({
          id: 'restart',
          label: bi('перезапуск', 'restart'),
          caption: bi('Пользователи жалуются, что оплата «висит», и дежурный перезапускает nginx и приложение, не прочитав журналы. Через минуту страница снова открывается так же медленно, потому что запрос к базе остался прежним, а записи журналов о медленных запросах пропали.', 'Users complain that checkout hangs, and the engineer restarts nginx and the application without reading the logs. A minute later the page is as slow as before, because the database query has not changed, and the log records about the slow queries are gone.'),
          focus: ['nginx'],
          say: { nginx: bi('nginx запущен заново, журналы пусты, а страница по-прежнему медленная.', 'nginx starts afresh with empty logs; the page is still slow.') },
          states: { nginx: 'wait' },
          metrics: { hyp: 8, down: 0 },
          broken: { at: 'nginx', message: '$ tail /var/log/nginx/error.log\n(empty)\n…a minute later: /checkout 200 after ' + p.appSec + ' s', caption: bi('на перезапуске. Перезапуск не трогает причину медленной страницы, а улики стирает.', 'at the restart: it leaves the cause and wipes the evidence.') },
        });
      return slowRun;
    }
    steps.push(
      {
        id: 'symptom',
        label: bi('жалоба', 'complaint'),
        caption: fmtb(bi('Пользователи жалуются, что у всех, кто оплачивает заказ, страница отвечает ошибкой {c}. У дежурного в списке восемь гипотез, и пока ни одну нельзя вычеркнуть.', 'Users complain: everyone who pays gets {c}. The engineer has eight hypotheses, none of which can be crossed out yet.'), { c: s.status }),
        focus: ['user'],
        say: { user: fmtb(bi('После нажатия «Оплатить» браузер показывает ошибку {c}.', 'After “Pay” the browser shows {c}.'), { c: s.status }) },
        states: { ...startWith(ALL, 'user', 'hyp'), user: 'err' },
        values: { user: `HTTP/2 ${s.status}`, hyp: '8', nginx: `proxy_read_timeout ${p.timeout}s`, db: ORDERS() },
        fill: { hyp: 1 },
        metrics: { hyp: 8, down: 2 },
      },
      {
        id: 'curl',
        label: 'curl -sv',
        caption: bi('Дежурный повторяет запрос командой `curl -sv` и видит, что соединение и шифрование установлены, а в ответе стоит заголовок `server: nginx`. Значит, имя магазина нашлось, сертификат в порядке и сеть пользователя ни при чём. Три гипотезы вычеркнуты, осталось пять, и все они лежат за nginx.', 'The engineer repeats the request with `curl -sv`: the connection and TLS are set up, and the answer is signed `server: nginx`. So the name resolved, the certificate is fine and the user’s network is not to blame. Three hypotheses are out; five are left, all behind nginx.'),
        focus: ['nginx', 'e-https'],
        reveal: ['nginx', 'e-https', 'dns', 'e-dns'],
        tokens: [{ edge: 'e-https', label: `${s.status} · server: nginx`, reverse: true }],
        say: { nginx: fmtb(bi('В ответе {c} стоит заголовок server: nginx, значит, запрос доходит до nginx.', 'The {c} is signed server: nginx, so the request reaches nginx.'), { c: s.status }) },
        states: { dns: 'ok', 'e-dns': 'ok', 'e-https': 'ok' },
        values: { hyp: '5' },
        fill: { hyp: 5 / 8 },
        metrics: { hyp: 5, down: 4 },
      },
    );
    if (broken.has('restart-first')) {
      steps.push({
        id: 'restart',
        label: bi('перезапуск', 'restart'),
        caption: bi('Дежурный перезапускает nginx и приложение «на всякий случай», так и не прочитав журналы. Записи о прошлых ошибках пропали вместе с процессами, а гипотез по-прежнему пять. Через минуту приходит первая волна запросов, и ошибка возвращается.', 'The engineer restarts nginx and the application “just in case” without reading the logs. The records of the earlier errors are gone with the processes, and five hypotheses are still left. A minute later the first wave of requests brings the error back.'),
        focus: ['nginx'],
        say: { nginx: bi('nginx запущен заново, и журнал ошибок пуст, но через минуту пользователи снова получают ошибку 504.', 'nginx starts afresh with an empty error log, but a minute later users get a 504 again.') },
        states: { nginx: 'wait' },
        values: { hyp: '5' },
        fill: { hyp: 5 / 8 },
        metrics: { hyp: 5, down: 9 },
        broken: { at: 'nginx', message: '$ tail /var/log/nginx/error.log\n(empty)\n…a minute later: HTTP/2 504 again', caption: bi('на перезапуске. Перезапуск стёр улики и не убрал причину, поэтому симптом вернулся с первой же волной запросов. В жизни такую ошибку узнают по пустому журналу и по тому, что 504 возвращается через минуту-другую.', 'at the restart. It wiped the evidence and left the cause, so the symptom came back with the first wave of requests.') },
      });
      return steps;
    }
    const line = s.log === 'connecting' ? 'while connecting to upstream' : s.log === 'reading' ? 'while reading response header' : 'upstream returned 500';
    const hypAfterLog = s.log === 'connecting' ? 2 : 3;
    steps.push({
      id: 'log',
      label: bi('журнал', 'log'),
      caption:
        s.log === 'connecting'
          ? bi('В журнале ошибок nginx строка кончается словами «while connecting to upstream». Это значит, что nginx даже не установил соединение с приложением. Остаются две гипотезы, и обе касаются пути по сети до приложения: межсетевой экран и само приложение, которое не принимает соединения.', 'The nginx error log line ends with “while connecting to upstream”: nginx did not even connect. Two hypotheses are left, both about the network path to the application: the firewall and the application not accepting connections.')
          : s.status === 500
            ? bi('В журнале ошибок nginx нет записи о тайм-ауте, потому что приложение само ответило кодом 500 через 30 секунд. Значит, соединение есть и приложение работает, но в обработчике оплаты что-то ждёт слишком долго. Остаются три гипотезы, и они касаются приложения, пула соединений и базы.', 'The nginx error log has no timeout record, because the application itself answered 500 after 30 s. So the connection works and the application runs, but something in the checkout handler waits too long. Three hypotheses are left, and they concern the application, the pool and the database.')
            : bi('В журнале ошибок nginx строка кончается словами «while reading response header». Это значит, что соединение с приложением установлено, но ответа nginx так и не дождался. Межсетевой экран и сам nginx вычеркнуты, и остаются три гипотезы, которые касаются приложения, пула соединений и базы.', 'The nginx error log line ends with “while reading response header”, which means a connection is set up but no answer came. The firewall and nginx are out, and three hypotheses are left, which concern the application, the pool and the database.'),
      focus: ['errlog', 'e-log'],
      reveal: ['errlog', 'e-log'],
      tokens: [{ edge: 'e-log', label: line }],
      say: { errlog: s.log === 'connecting' ? bi('nginx записал, что соединиться с приложением не удалось.', 'nginx recorded that it could not connect to the application.') : s.status === 500 ? bi('nginx записал, что приложение само вернуло код 500.', 'nginx recorded that the application itself returned 500.') : bi('nginx записал, что соединение с приложением есть, а ответа нет.', 'nginx recorded that the connection to the application exists but no answer has come.') },
      values: { errlog: line, hyp: String(hypAfterLog) },
      fill: { hyp: hypAfterLog / 8 },
      metrics: { hyp: hypAfterLog, down: 6 },
    });
    if (p.cause === 'drop-rule') {
      steps.push(
        {
          id: 'narrow',
          label: 'ss -tn',
          caption: bi('Команда `ss -tn` показывает, что соединения nginx с приложением висят в состоянии SYN-SENT, то есть первый пакет соединения ушёл, а ответа на него нет. Если бы приложение не слушало порт, ядро его сервера сразу ответило бы отказом. Молчание означает, что пакеты кто-то отбрасывает по дороге, поэтому остаётся одна гипотеза, и она касается межсетевого экрана.', '`ss -tn` shows nginx’s connections stuck in SYN-SENT, that is, the first packet went out and nothing came back. If the application were not listening on the port, its server’s kernel would refuse at once. Silence means something drops the packets on the way, so one hypothesis is left, and it concerns the firewall.'),
          focus: ['fw', 'e-proxy'],
          reveal: ['e-proxy', 'fw', 'e-fw', 'app'],
          tokens: [{ edge: 'e-proxy', label: 'SYN → :8000' }],
          say: { fw: bi('Пакеты к порту 8000 доходят сюда, а дальше не идут.', 'Packets to port 8000 get here and go no further.') },
          states: { fw: 'warn', 'e-fw': 'err' },
          values: { hyp: '1' },
          fill: { hyp: 1 / 8 },
          metrics: { hyp: 1, down: 9 },
        },
        {
          id: 'cause',
          label: 'nft',
          caption: bi('Команда `nft list ruleset` находит правило, которое сетевые инженеры ввели в 14:08 и которое отбрасывает все пакеты на порт 8000. Причина подтверждена, и это не новая версия приложения, а изменение в сети.', '`nft list ruleset` finds the rule the network team rolled out at 14:08, which drops everything to port 8000. The cause is confirmed, and it is not the release but a network change.'),
          focus: ['fw'],
          say: { fw: bi('Правило tcp dport 8000 drop отбрасывает запросы к приложению.', 'The rule tcp dport 8000 drop throws the requests away.') },
          states: { fw: 'err' },
          values: { fw: 'tcp dport 8000 drop' },
          metrics: { hyp: 1, down: 11 },
        },
        {
          id: 'mitigate',
          label: bi('откат правила', 'roll back rule'),
          caption: bi('Дежурный откатывает то, что изменилось, то есть правило межсетевого экрана, а не новую версию приложения. Пакеты снова доходят до приложения, и за минуту доля ошибок падает с 31 % до 0,3 %.', 'The engineer rolls back what changed: the firewall rule, not the release. Packets reach the application again, and in a minute the error share falls from 31% to 0.3%.'),
          focus: ['fw', 'e-fw'],
          tokens: [{ edge: 'e-fw', label: 'SYN → :8000' }],
          say: { fw: bi('Правило убрано, и пакеты снова проходят к приложению.', 'The rule is gone; packets pass again.') },
          states: { fw: 'ok', 'e-fw': 'ok', app: 'ok' },
          values: { fw: 'nftables' },
          metrics: { hyp: 1, down: 12 },
        },
      );
    } else {
      const slow = p.cause === 'slow-sql';
      steps.push(
        {
          id: 'narrow',
          label: bi('мимо nginx', 'bypass nginx'),
          caption: slow
            ? fmtb(bi('Дежурный обращается к приложению напрямую, мимо nginx. Страница /health отвечает за 0,01 секунды, а /checkout отвечает только через {a}. Значит, приложение работает, а медленно работает один обработчик оплаты, который чего-то ждёт. Остаются две гипотезы, которые касаются пула соединений и базы.', 'Directly, bypassing nginx: /health answers in 0.01 s, /checkout in {a} s. The application is alive; one handler is slow and waits for something. Two hypotheses are left: the pool and the database.'), { a: sec(p.appSec) })
            : bi('Дежурный обращается к приложению напрямую, мимо nginx. Страница /health отвечает за 0,01 секунды, а /checkout через 30 секунд падает с ошибкой 500. Значит, приложение работает, а обработчик оплаты чего-то ждёт. Остаются две гипотезы, которые касаются пула соединений и базы.', 'Directly: /health answers in 0.01 s, /checkout fails with 500 after 30 s. The handler waits for something. Two hypotheses are left: the pool and the database.'),
          focus: ['app', 'e-fw'],
          reveal: ['e-proxy', 'fw', 'e-fw', 'app'],
          tokens: [{ edge: 'e-fw', label: slow ? `${p.appSec} s` : '500', reverse: true }],
          say: { app: slow ? fmtb(bi('Страница /health отвечает сразу, а /checkout отвечает только через {a}.', '/health answers at once, while /checkout answers only after {a}.'), { a: sec(p.appSec) }) : bi('Страница /health отвечает сразу, а /checkout через 30 секунд падает с ошибкой 500.', '/health answers at once, /checkout fails after 30 s.') },
          states: { fw: 'ok', 'e-fw': 'ok', app: 'warn' },
          values: { app: slow ? `/checkout ${p.appSec}s` : '/checkout 500 @30s', hyp: '2' },
          fill: { hyp: 2 / 8 },
          metrics: { hyp: 2, down: 9 },
        },
        slow
          ? {
              id: 'cause',
              label: 'Seq Scan',
              caption: bi('Журнал медленных запросов базы показывает запрос, который появился в версии от 14:05. Этот запрос читает всю таблицу заказов, потому что для него нет индекса, и выполняется почти 35 секунд. Причина подтверждена.', 'The slow query log shows a new query from the 14:05 release: it reads the whole orders table because there is no index, and takes almost 35 s. The cause is confirmed.'),
              focus: ['db', 'e-sql'],
              reveal: ['e-sql', 'db'],
              tokens: [{ edge: 'e-sql', label: 'SELECT … orders' }],
              say: { db: bi('База читает все 4,1 миллиона строк, потому что индекса для нового запроса нет.', 'The database reads all 4.1 million rows, because there is no index for the new query.') },
              states: { db: 'err', 'e-sql': 'err' },
              values: { db: 'Seq Scan 34.8s', hyp: '1' },
              fill: { hyp: 1 / 8 },
              metrics: { hyp: 1, down: 11 },
            }
          : {
              id: 'cause',
              label: 'QueuePool',
              caption: bi('В журнале приложения сказано, что все пять соединений пула заняты. Новый код из версии, выложенной в 14:05, держит соединение с базой, пока ждёт ответа платёжного сервиса, и остальным запросам соединений не хватает. Причина подтверждена.', 'The application log says all five pool connections are busy: the new code from the 14:05 release holds a connection while it waits for the payments service. The cause is confirmed.'),
              focus: ['app', 'e-sql'],
              reveal: ['e-sql', 'db'],
              tokens: [{ edge: 'e-sql', label: bi('5 из 5 заняты', '5 of 5 busy') }],
              say: { app: bi('Все пять соединений с базой заняты, и новые запросы ждут в очереди.', 'All five connections to the database are busy, and new requests wait in the queue.') },
              states: { app: 'err', 'e-sql': 'err' },
              values: { app: tr('пул: занято 5 из 5', 'pool 5/5 busy'), hyp: '1' },
              fill: { hyp: 1 / 8 },
              metrics: { hyp: 1, down: 11 },
            },
        {
          id: 'mitigate',
          label: bi('откат версии', 'roll back release'),
          caption: bi('Дежурный откатывает то, что изменилось, то есть версию приложения, выложенную в 14:05. Доля ошибок падает до 0,4 %. Исправлять причину будут обычным путём, и индекс или новый код выйдут через конвейер с проверкой на тестовом стенде.', 'The engineer rolls back what changed, that is, the 14:05 release. The error share falls to 0.4%. The cause will be fixed the normal way, and the index or the new code will go out through the pipeline with a check on the staging stand.'),
          focus: ['app'],
          say: { app: bi('Работает прежняя версия приложения, и /checkout снова отвечает быстро.', 'The previous version runs, and /checkout is fast again.') },
          states: { app: 'ok', db: 'ok', 'e-sql': 'ok' },
          values: { app: '10.0.0.12:8000', db: ORDERS() },
          metrics: { hyp: 1, down: 14 },
        },
      );
    }
    const down = steps[steps.length - 1].metrics?.down ?? 12;
    steps.push({
      id: 'status',
      label: '200',
      caption: bi('Пользователи снова получают страницу оплаты с кодом 200. Дежурный пишет команде короткий статус, в котором сказано, кого задел сбой и насколько, что сделано и когда будет следующее сообщение. После этого начинается разбор без поиска виноватых.', 'Users get the checkout page with 200 again. The engineer posts a short status: who was hit and how badly, what was done, when the next message comes. Then a blameless review begins.'),
      focus: ['user', 'e-https'],
      tokens: [{ edge: 'e-https', label: 'HTTP/2 200', reverse: true }],
      say: { user: bi('Оплата снова проходит.', 'Checkout works again.') },
      states: { user: 'ok' },
      values: { user: 'HTTP/2 200' },
      metrics: { hyp: 1, down },
    });
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    if (change.kind === 'break')
      return change.on
        ? bi('Перезапуск сделан до сбора улик. Журналы теперь пусты, гипотез по-прежнему пять, и ошибка вернулась через минуту.', 'A restart before the evidence: the logs are empty, five hypotheses remain, and the error is back a minute later.')
        : bi('Перезапуск отключён, и дежурный снова собирает улики по порядку, начиная с журнала ошибок nginx, который сужает поиск.', 'No restart: the evidence is collected in order again, and the error log narrows the search.');
    if (change.id === 'cause')
      return fmtb(bi('Скрытая причина сбоя сменилась. Раньше это была причина «{a}», а теперь причина «{b}». Первые шаги поиска остались теми же, а изменились строка в журнале nginx и та часть системы, к которой она ведёт.', 'The hidden cause changed. It used to be “{a}”, and now it is “{b}”. The first steps of the search stayed the same, while the line in the nginx log and the part of the system it leads to changed.'), { a: CAUSE[String(a.cause)] ?? '', b: CAUSE[String(b.cause)] ?? '' });
    if (b.cause === 'drop-rule') return bi('Когда пакеты отбрасывает межсетевой экран, время ответа приложения ничего не меняет, потому что nginx не может даже соединиться с приложением.', 'When the firewall drops the packets, the application’s response time changes nothing, because nginx cannot even connect to the application.');
    const slow = (x: Step[]) => x.some((st) => st.id === 'slow');
    if (slow(prev) === slow(next)) return fmtb(bi('Приложение отвечает за {a}, а nginx ждёт ответа не дольше {t}. Пользователь видит то же, что и раньше.', 'The application takes {a} and nginx waits up to {t}: the user sees the same as before.'), { a: sec(b.appSec), t: secGen(b.timeout) });
    return slow(next)
      ? fmtb(bi('Теперь приложение отвечает за {a}, то есть раньше, чем nginx перестаёт ждать, а ждёт он {t}. Поэтому ошибка 504 сменилась медленной страницей с кодом 200.', 'The application now takes {a}, less than the {t} nginx waits: the 504 became a slow 200.'), { a: sec(b.appSec), t: sec(b.timeout) })
      : fmtb(bi('Теперь приложение отвечает за {a}, а nginx ждёт только {t}. nginx перестаёт ждать раньше и отдаёт пользователю 504.', 'The application now takes {a}, but nginx waits only {t}: it gives up and returns 504.'), { a: sec(b.appSec), t: sec(b.timeout) });
  },
});
