// E-MON (06 §7.4): from a counter in code to a message to the on-call
// engineer — scrape → store → PromQL → alert rule → Alertmanager → notify.
//
// Reading order: the picture is built from zero. At the start there is only
// the api process; every other participant appears when the error reaches it,
// so the path of one failed request to the pager is drawn in front of the
// learner. The participant at work says in a callout what it does, and what it
// hands on travels along the line as a card. The knobs come in two groups, by
// the part of the system they change: how Prometheus collects the data and
// when the alert fires and leaves.

import { defineModel } from '../../core/define';
import { bi, pluralRu, type Bi } from '../../core/i18n';
import type { ElementState, Step } from '../../core/types';
import { card } from '../git-cicd/explainers';

type P = { scrape: string; window: number; forMin: number; groupWait: number };
/** "1 значение", "3 значения", "20 значений" / "20 values". */
const valuesOf = (n: number): Bi => bi(`${n} ${pluralRu(n, ['значение', 'значения', 'значений'])}`, `${n} ${n === 1 ? 'value' : 'values'}`);
const last = (s: Step[]) => s[s.length - 1]?.metrics ?? {};

/** Fills {k} with a string, a number (decimal comma in Russian) or a Bi. */
export function fb(b: Bi, vars: Record<string, string | number | Bi>): Bi {
  const fill = (s: string, lang: 'ru' | 'en') =>
    s.replace(/\{(\w+)\}/g, (m, k) => {
      const v = vars[k];
      if (v === undefined) return m;
      if (typeof v === 'object') return v[lang];
      if (typeof v === 'number' && lang === 'ru') return String(v).replace('.', ',');
      return String(v);
    });
  return { ru: fill(b.ru, 'ru'), en: fill(b.en, 'en') };
}

export function monNumbers(p: P): { samples: number; detect: number; ok: boolean } {
  const scrape = Number(p.scrape);
  const samples = Math.floor((p.window * 60) / scrape);
  const evalEvery = 60;
  // Worst case from breakage to message: the next scrape, the rate window filling, evaluation, for, group_wait.
  const detect = scrape + evalEvery + p.forMin * 60 + p.groupWait;
  return { samples, detect, ok: samples >= 2 };
}

const ALL = ['app', 'metrics', 'prom', 'tsdb', 'rule', 'am', 'pager', 'e-expose', 'e-scrape', 'e-store', 'e-eval', 'e-alert', 'e-notify'];
const startWith = (...shown: string[]): Record<string, ElementState> => Object.fromEntries(ALL.filter((id) => !shown.includes(id)).map((id) => [id, 'hidden' as ElementState]));

const GROUP_COLLECT = bi('Как Prometheus собирает данные', 'How Prometheus collects the data');
const GROUP_ALERT = bi('Когда алерт срабатывает и уходит к людям', 'When the alert fires and goes to people');

export const monModel = defineModel<P>({
  id: 'obs.scrape-to-notify',
  frame: 'visible',
  block: 'monitoring',
  title: bi('Как ошибка в сервисе становится сообщением дежурному', 'How an error in a service becomes a message to the on-call engineer'),
  summary: bi(
    'Сервис api начал отвечать ошибкой 500. Схема показывает, как счётчик ошибок в памяти процесса попадает в Prometheus, как правило алерта замечает, что ошибок слишком много, и как Alertmanager отправляет сообщение дежурному. Под схемой считается, сколько секунд пройдёт от первой ошибки до сообщения в худшем случае.',
    'The api service has started answering with error 500. The diagram shows how the error counter in the process memory reaches Prometheus, how an alerting rule notices that there are too many errors, and how Alertmanager sends a message to the on-call engineer. Under the diagram you see how many seconds pass from the first error to the message in the worst case.',
  ),
  intro: bi(
    'Схема соберётся у вас на глазах, и сейчас на ней есть только процесс api. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Новый участник появляется, когда до него доходит ошибка. Облачко у подсвеченного участника говорит, что он делает, а карточка на линии показывает, что он передаёт следующему.\n\nКогда дойдёте до сообщения дежурному, поменяйте в «Параметрах» интервал опроса, окно, for или group_wait и посмотрите, как меняется время до сообщения. Потом включите по одной поломке в блоке «Сломать».',
    'The diagram builds itself as you go, and now it shows only the api process. Press “Start from the first step”, then go on with “Step forward” above the diagram. A participant appears when the error reaches it. The callout at the highlighted participant says what it does, and the card on the line shows what it hands on.\n\nOnce you reach the message to the on-call engineer, change the scrape interval, the window, for or group_wait in “Parameters” and watch the time to the message change. Then switch on the breaks in “Break it” one at a time.',
  ),
  legend: [
    { mark: 'active', text: bi('участник, который работает сейчас', 'the participant working now') },
    { mark: 'say', text: bi('что он делает', 'what it does') },
    { mark: 'token', text: bi('то, что участник передаёт следующему, например значение счётчика, алерт или сообщение', 'what the participant hands on, such as a counter value, an alert or a message') },
    { mark: 'icon:process', text: bi('процесс сервиса api', 'the api service process') },
    { mark: 'icon:file', text: bi('страница /metrics', 'the /metrics page') },
    { mark: 'icon:server', text: bi('сервер Prometheus', 'the Prometheus server') },
    { mark: 'icon:database', text: bi('хранилище временных рядов', 'the time-series store') },
    { mark: 'icon:terminal', text: bi('правило алерта', 'the alerting rule') },
    { mark: 'icon:router', text: bi('Alertmanager, который выбирает получателя', 'Alertmanager, which picks the receiver') },
    { mark: 'icon:user', text: bi('дежурный инженер', 'the on-call engineer') },
    { mark: 'warn', text: bi('алерт ждёт, пока истечёт for (pending)', 'the alert waits for `for` to pass (pending)') },
    { mark: 'err', text: bi('алерт сработал (firing) или на этом участнике процесс остановился', 'the alert fires, or the process stopped at this participant') },
    { mark: 'ok', text: bi('этап пройден', 'stage passed') },
  ],
  stopLabel: bi('Путь к дежурному оборвался', 'The path to the on-call engineer broke'),
  concepts: ['obs.scrape', 'obs.rate', 'obs.alert-rule', 'obs.alertmanager'],
  diagram: {
    width: 960,
    height: 448,
    nodes: [
      {
        id: 'app',
        label: bi('Процесс api', 'The api process'),
        icon: 'process',
        sub: 'code="500" 0',
        family: 'user',
        x: 24,
        y: 40,
        w: 190,
        h: 64,
        card: card(
          bi('Этот блок изображает процесс сервиса api. Каждый раз, когда он отвечает на запрос, клиентская библиотека Prometheus внутри процесса увеличивает на единицу счётчик http_requests_total с метками маршрута и кода ответа. Счётчик хранится в памяти процесса и после перезапуска начинается с нуля.', 'This block stands for the api service process. Every time it answers a request, the Prometheus client library inside the process adds one to the http_requests_total counter with the route and status code labels. The counter lives in the process memory and starts from zero after a restart.'),
          bi('Счётчики описывают разработчики сервиса в его коде.', 'The service developers declare the counters in its code.'),
        ),
      },
      {
        id: 'metrics',
        label: bi('Страница /metrics', 'The /metrics page'),
        icon: 'file',
        sub: 'text',
        family: 'obj',
        x: 385,
        y: 40,
        w: 190,
        h: 64,
        card: card(
          bi('Страницу /metrics процесс отдаёт по HTTP. На ней записаны текущие значения всех метрик процесса, по строке на ряд: `http_requests_total{route="/checkout",code="500"} 37`. Истории на странице нет, и каждый, кто её открывает, видит только числа на текущую секунду.', 'The process serves the /metrics page over HTTP. It holds the current values of all its metrics, one line per series: `http_requests_total{route="/checkout",code="500"} 37`. There is no history on the page, and whoever opens it sees only the numbers of this second.'),
          bi('Страницу отдаёт клиентская библиотека Prometheus внутри процесса.', 'The Prometheus client library inside the process serves the page.'),
          'curl http://api-1:8080/metrics',
        ),
      },
      {
        id: 'prom',
        label: 'Prometheus',
        icon: 'server',
        sub: 'scrape_interval 15s',
        family: 'cp',
        x: 746,
        y: 40,
        w: 190,
        h: 64,
        card: card(
          bi('Prometheus служит сервером мониторинга. Он сам по расписанию приходит к каждой цели за страницей /metrics, записывает значения в своё хранилище и раз в минуту вычисляет правила алертов. Если цель не ответила, Prometheus записывает для неё ряд up со значением 0.', 'Prometheus is the monitoring server. It visits every target on a schedule to fetch its /metrics page, writes the values into its store and evaluates the alerting rules once a minute. If a target does not answer, Prometheus writes the up series with the value 0 for it.'),
          bi('Prometheus настраивает команда эксплуатации в файле prometheus.yml: там перечислены цели и интервал опроса.', 'The operations team configures Prometheus in prometheus.yml, which lists the targets and the scrape interval.'),
          'promtool check config prometheus.yml',
          { url: 'https://prometheus.io/docs/prometheus/latest/configuration/configuration/', label: 'prometheus.io › Configuration' },
        ),
      },
      {
        id: 'tsdb',
        label: bi('Хранилище рядов', 'Series store'),
        icon: 'database',
        sub: 'TSDB',
        family: 'store',
        shape: 'buffer',
        x: 746,
        y: 200,
        w: 190,
        h: 64,
        card: card(
          bi('Внутри Prometheus работает база временных рядов (TSDB). Для каждого набора меток она хранит ленту пар «время, значение» и дописывает в её конец каждое новое значение. Шкала внутри блока показывает, сколько значений помещается в окно, за которое правило считает скорость.', 'Inside Prometheus runs a time-series database (TSDB). For every label set it keeps a strip of “time, value” pairs and appends every new value to its end. The gauge inside the block shows how many values fit into the window over which the rule computes the rate.'),
          bi('Хранилище ведёт сам Prometheus.', 'Prometheus keeps the store itself.'),
        ),
      },
      {
        id: 'rule',
        label: bi('Правило алерта', 'Alerting rule'),
        icon: 'terminal',
        work: 'spin',
        sub: 'ApiHighErrorRate',
        family: 'flow',
        x: 385,
        y: 200,
        w: 190,
        h: 64,
        card: card(
          bi('Правило состоит из запроса PromQL с условием, что доля ответов 5xx за окно выше 2 %. Prometheus вычисляет его раз в минуту. Пока условие выполняется меньше, чем указано в поле for, алерт находится в состоянии pending и никуда не уходит. Когда условие продержалось дольше, алерт переходит в состояние firing.', 'The rule consists of a PromQL query with the condition that the share of 5xx answers over the window is above 2 %. Prometheus evaluates it once a minute. While the condition has held for less than the `for` field says, the alert is pending and goes nowhere. Once the condition has held longer, the alert is firing.'),
          bi('Правило пишете вы, в файле правил rules.yml.', 'You write the rule, in the rule file rules.yml.'),
          'promtool check rules rules.yml',
          { url: 'https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/', label: 'prometheus.io › Alerting rules' },
        ),
      },
      {
        id: 'am',
        label: 'Alertmanager',
        icon: 'router',
        sub: 'route',
        family: 'cp',
        x: 385,
        y: 360,
        w: 190,
        h: 64,
        card: card(
          bi('Alertmanager работает отдельным сервисом и получает сработавшие алерты от Prometheus. По меткам алерта он выбирает получателя, ждёт group_wait, чтобы собрать похожие алерты в одно сообщение, и отправляет это сообщение. Он же гасит алерты-следствия, когда уже сработал алерт о причине.', 'Alertmanager runs as a separate service and receives firing alerts from Prometheus. By the alert labels it picks the receiver, waits group_wait to gather similar alerts into one message and sends that message. It also mutes the consequence alerts once the alert about the cause has fired.'),
          bi('Alertmanager настраивает команда эксплуатации в файле alertmanager.yml.', 'The operations team configures Alertmanager in alertmanager.yml.'),
          'amtool config routes show',
        ),
      },
      {
        id: 'pager',
        label: bi('Дежурный', 'On-call engineer'),
        icon: 'user',
        sub: 'receiver: pager',
        family: 'neutral',
        x: 24,
        y: 360,
        w: 190,
        h: 64,
        card: card(
          bi('Дежурный получает сообщение на телефон, в чат или на почту. Будить его стоит только из-за того, что чувствуют пользователи, поэтому правило стоит на доле ошибок, а не на загрузке процессора.', 'The on-call engineer gets the message on a phone, in a chat or by email. They should be woken only by what users feel, which is why the rule watches the error share rather than CPU load.'),
          bi('Кто дежурит сегодня, решает расписание дежурств команды.', 'The team’s on-call schedule decides who is on duty today.'),
        ),
      },
    ],
    edges: [
      { id: 'e-expose', from: 'app', to: 'metrics', label: bi('текущие значения', 'current values'), card: card(bi('Процесс показывает на странице /metrics значения своих счётчиков в момент запроса. Прошлых значений процесс не хранит.', 'The process shows the values of its counters on /metrics at the moment of the request. It keeps no past values.'), bi('Значения показывает процесс api.', 'The api process.')) },
      { id: 'e-scrape', from: 'prom', to: 'metrics', label: 'GET /metrics', card: card(bi('Prometheus сам приходит за страницей каждые scrape_interval секунд, и такой опрос цели называют scrape. Если цель не ответила, ряд up для неё становится равным 0.', 'Polling a target, called a scrape: Prometheus comes for the page itself every scrape_interval seconds. If the target does not answer, its up series becomes 0.'), bi('Опрос выполняет Prometheus.', 'Prometheus performs the scrape.'), 'up{job="api"}') },
      { id: 'e-store', from: 'prom', to: 'tsdb', label: bi('время и значение', 'time and value'), card: card(bi('Каждое полученное значение дописывается в конец своего ряда вместе со временем опроса.', 'Every value received is appended to the end of its series together with the scrape time.'), bi('Значения записывает Prometheus.', 'Prometheus writes it.')) },
      { id: 'e-eval', from: 'tsdb', to: 'rule', label: bi('раз в минуту', 'once a minute'), card: card(bi('Раз в минуту Prometheus вычисляет правило. Функция rate берёт из хранилища значения счётчика за окно и считает по ним, сколько ошибок в секунду было в среднем.', 'Once a minute Prometheus evaluates the rule. The rate function takes the counter values for the window from the store and computes the average errors per second from them.'), bi('Правило вычисляет Prometheus.', 'Prometheus evaluates it.')) },
      { id: 'e-alert', from: 'rule', to: 'am', label: bi('алерт firing', 'firing alert'), card: card(bi('Сам Prometheus людям не пишет, а сработавший алерт отправляет в Alertmanager запросом POST /api/v2/alerts.', 'Prometheus does not message people itself, and it sends the firing alert to Alertmanager with POST /api/v2/alerts.'), bi('Алерт отправляет Prometheus.', 'Prometheus sends it.')) },
      { id: 'e-notify', from: 'am', to: 'pager', label: bi('сообщение', 'message'), card: card(bi('Alertmanager отправляет одно сообщение на группу похожих алертов и повторяет его не раньше, чем через repeat_interval.', 'Alertmanager sends one message per group of similar alerts and repeats it no sooner than repeat_interval.'), bi('Сообщение отправляет Alertmanager.', 'Alertmanager sends it.')) },
    ],
  },
  params: [
    {
      id: 'scrape',
      group: GROUP_COLLECT,
      label: bi('Как часто Prometheus забирает /metrics (scrape_interval)', 'How often Prometheus fetches /metrics (scrape_interval)'),
      kind: 'choice',
      default: '15',
      options: [
        { id: '5', label: bi('5\u00a0с', '5 s') },
        { id: '15', label: bi('15\u00a0с', '15 s') },
        { id: '60', label: bi('60\u00a0с', '60 s') },
      ],
      near: 'e-scrape',
    },
    {
      id: 'window',
      group: GROUP_COLLECT,
      label: bi('Окно, за которое правило считает долю ошибок (в минутах)', 'The window over which the rule computes the error share, minutes'),
      kind: 'range',
      min: 0.5,
      max: 15,
      step: 0.5,
      default: 5,
      near: 'e-eval',
      predict: {
        prompt: bi('Вы меняете длину окна, а интервал опроса остаётся прежним. Хватит ли правилу значений счётчика в новом окне, чтобы посчитать скорость роста?', 'You change the window length while the scrape interval stays the same. Will the rule have enough counter values in the new window to compute the rate?'),
        options: [
          { id: 'same', text: bi('Да, в окне окажется не меньше двух значений, и правило вычислится', 'Yes: the window has at least two values and the rule is evaluated') },
          { id: 'empty', text: bi('Нет, в окне окажется меньше двух значений, и rate вернёт пустой результат', 'No: the window has fewer than two values and rate returns an empty result') },
        ],
        resolve: (_p, n) => (n.some((s) => s.broken) ? 'empty' : 'same'),
      },
    },
    {
      id: 'forMin',
      group: GROUP_ALERT,
      label: bi('Сколько минут условие должно держаться, прежде чем алерт сработает (for)', 'How many minutes the condition must hold before the alert fires (for)'),
      kind: 'range',
      min: 0,
      max: 15,
      step: 1,
      default: 10,
      near: 'rule',
      predict: {
        prompt: bi('Вы меняете for, а всё остальное оставляете как есть. Как изменится время от первой ошибки до сообщения дежурному?', 'You change `for` and leave everything else as it is. How does the time from the first error to the message change?'),
        options: [
          { id: 'longer', text: bi('Вырастет на столько минут, на сколько вы увеличили for', 'It grows by as many minutes as you added to for') },
          { id: 'shorter', text: bi('Сократится на столько минут, на сколько вы уменьшили for', 'It shrinks by as many minutes as you took from for') },
          { id: 'same', text: bi('Не изменится, потому что for влияет только на текст сообщения', 'It does not change: for only affects the message text') },
        ],
        resolve: (prev, next) => {
          const a = last(prev).detect ?? 0;
          const b = last(next).detect ?? 0;
          return b > a ? 'longer' : b < a ? 'shorter' : 'same';
        },
      },
    },
    {
      id: 'groupWait',
      group: GROUP_ALERT,
      label: bi('Сколько секунд Alertmanager собирает похожие алерты в одно сообщение (group_wait)', 'How many seconds Alertmanager gathers similar alerts into one message (group_wait)'),
      kind: 'range',
      min: 0,
      max: 120,
      step: 10,
      default: 30,
      near: 'am',
    },
  ],
  breaks: [
    {
      id: 'target-down',
      label: bi('Процесс api перестал отвечать на запрос /metrics', 'The api process stopped answering /metrics'),
      remove: ['e-scrape'],
      boundary: 'network',
      predict: {
        prompt: bi('Процесс api перестал отвечать на запрос /metrics, а всё остальное работает. Что Prometheus запишет в хранилище для этой цели?', 'The api process stopped answering /metrics, and everything else works. What does Prometheus write into the store for this target?'),
        options: [
          { id: 'up0', text: bi('Prometheus запишет только ряд up со значением 0, а новых значений счётчиков не будет', 'Only the up series with the value 0; there will be no new counter values') },
          { id: 'zero', text: bi('Prometheus запишет нули во все ряды этого процесса', 'Zeros in every series of this process') },
        ],
        resolve: (_p, n) => (n.some((s) => s.broken?.at === 'e-scrape') ? 'up0' : 'zero'),
      },
    },
    {
      id: 'am-down',
      label: bi('Alertmanager остановлен', 'Alertmanager is stopped'),
      remove: ['e-notify'],
      boundary: 'process',
      predict: {
        prompt: bi('Alertmanager остановлен, а правило алерта уже перешло в состояние firing. Дойдёт ли сообщение до дежурного?', 'Alertmanager is stopped while the alerting rule is already firing. Will the message reach the on-call engineer?'),
        options: [
          { id: 'no', text: bi('Нет, потому что Prometheus сам людям не пишет, и сообщение не уйдёт', 'No: Prometheus does not message people itself, so no message leaves') },
          { id: 'yes', text: bi('Да, Prometheus отправит сообщение дежурному сам', 'Yes: Prometheus sends the message itself') },
        ],
        resolve: (_p, n) => (n.some((s) => s.broken?.at === 'am') ? 'no' : 'yes'),
      },
    },
  ],
  metrics: [
    { id: 'samples', label: bi('значений счётчика в окне', 'counter values in the window') },
    { id: 'detect', label: bi('от первой ошибки до сообщения, в худшем случае', 'from the first error to the message, worst case'), unit: { ru: 'с', en: 's' } },
  ],
  run(p, broken) {
    const n = monNumbers(p);
    // The time to the message is shown only when a message does arrive.
    const delivered = n.ok && !broken.has('target-down') && !broken.has('am-down');
    const m: Record<string, number> = delivered ? { samples: n.samples, detect: n.detect } : { samples: n.samples };
    const s = Number(p.scrape);
    const steps: Step[] = [
      {
        id: 'count',
        label: bi('ошибка', 'error'),
        caption: bi('Пользователь оформляет заказ, и процесс api отвечает ему ошибкой 500. Клиентская библиотека Prometheus внутри процесса тут же увеличивает на единицу счётчик http_requests_total с метками `route="/checkout"` и `code="500"`. Больше процесс ничего не делает, потому что он не знает, кто и когда посмотрит на этот счётчик.', 'A user places an order and the api process answers with error 500. The Prometheus client library inside the process at once adds one to the http_requests_total counter with the labels route="/checkout" and code="500". The process does nothing else, because it does not know who will look at the counter or when.'),
        focus: ['app'],
        say: { app: bi('Процесс api отвечает ошибкой 500 и прибавляет единицу к счётчику ошибок.', 'The api process answers with error 500 and adds one to the error counter.') },
        states: startWith('app'),
        values: { app: 'code="500" 37' },
        metrics: m,
      },
      {
        id: 'expose',
        label: '/metrics',
        caption: bi('Значение счётчика появляется на странице /metrics процесса. На странице хранится только текущее число, поэтому, если за ним никто не придёт, история ошибок не сохранится нигде.', 'The counter value appears on the process’s /metrics page. The page holds only the current number, so if nobody comes for it, the history of errors is kept nowhere.'),
        focus: ['e-expose', 'metrics'],
        reveal: ['metrics', 'e-expose'],
        tokens: [{ edge: 'e-expose', label: 'code="500" 37' }],
        say: { metrics: bi('Страница /metrics показывает счётчик ошибок таким, какой он сейчас: 37.', 'The /metrics page shows the error counter as it is now: 37.') },
        values: { metrics: 'code="500" 37' },
        metrics: m,
      },
    ];
    if (broken.has('target-down')) {
      steps.push({
        id: 'down',
        label: bi('опрос не удался', 'scrape failed'),
        caption: bi('Prometheus приходит за страницей /metrics, но процесс api не отвечает. Новых значений счётчиков нет, и Prometheus записывает только ряд up со значением 0. Правило о доле ошибок теперь молчит, потому что ему не из чего считать.', 'Prometheus comes for the /metrics page, but the api process does not answer. There are no new counter values, and Prometheus writes only the up series with the value 0. The error-share rule now stays silent: it has nothing to compute from.'),
        focus: ['e-scrape', 'prom'],
        reveal: ['prom', 'e-scrape', 'tsdb', 'e-store'],
        say: { prom: bi('Prometheus не дождался ответа от api-1:8080 и записывает up = 0.', 'Prometheus got no answer from api-1:8080 and writes up = 0.') },
        tokens: [{ edge: 'e-store', label: 'up 0' }],
        states: { metrics: 'err', 'e-scrape': 'err', prom: 'warn' },
        values: { tsdb: 'up = 0' },
        metrics: m,
        broken: {
          at: 'e-scrape',
          message: 'Get "http://api-1:8080/metrics": dial tcp 10.0.0.11:8080: connect: connection refused',
          caption: bi('на опросе цели. Такую поломку узнают по ряду up, равному нулю, а в Prometheus на странице Targets цель горит красным. Правило на долю ошибок её не заметит, поэтому на up == 0 ставят отдельный алерт.', 'at the scrape. You recognise this break by the up series being zero, and the target is red on the Targets page of Prometheus. The error-share rule will not notice it, so a separate alert is set on up == 0.'),
        },
      });
      return steps;
    }
    steps.push(
      {
        id: 'scrape',
        label: 'scrape',
        caption: fb(bi('Каждые {s} секунд Prometheus сам приходит к процессу за страницей /metrics. Такой опрос называют scrape, и при нём не сервис отправляет данные в мониторинг, а мониторинг забирает их у сервиса. Поэтому Prometheus сразу замечает, если сервис перестал отвечать.', 'Every {s} seconds Prometheus comes to the process for the /metrics page itself. Such polling is called a scrape, and in it the service does not send data to monitoring, monitoring fetches it from the service. That is why Prometheus notices at once when a service stops answering.'), { s }),
        focus: ['e-scrape', 'prom'],
        reveal: ['prom', 'e-scrape'],
        tokens: [{ edge: 'e-scrape', reverse: true, label: 'code="500" 37' }],
        say: { prom: fb(bi('Prometheus забирает страницу /metrics и приходит за ней каждые {s} секунд.', 'Prometheus fetches the /metrics page and comes for it every {s} seconds.'), { s }) },
        values: { prom: `scrape_interval ${s}s` },
        states: { metrics: 'ok' },
        metrics: m,
      },
      {
        id: 'store',
        label: 'TSDB',
        caption: fb(bi('Prometheus дописывает полученное значение в конец ряда вместе со временем опроса. Правило будет считать скорость за окно {w} мин, а при опросе раз в {s} секунд в такое окно помещается {n}.', 'Prometheus appends the value to the end of the series together with the scrape time. The rule will compute the rate over a {w} min window, and with a scrape every {s} seconds such a window holds {n}.'), { s, w: p.window, n: valuesOf(n.samples) }),
        focus: ['e-store', 'tsdb'],
        reveal: ['tsdb', 'e-store'],
        tokens: [{ edge: 'e-store', label: bi('(время, 37)', '(time, 37)') }],
        say: { tsdb: fb(bi('Хранилище дописывает значение в ряд, и в окне {w} мин таких значений уже {n}.', 'The store appends the value to the series, and the {w} min window now holds {n} such values.'), { w: p.window, n: n.samples }) },
        fill: { tsdb: Math.min(1, n.samples / 40) },
        values: { tsdb: `[${p.window}m] → ${n.samples}` },
        metrics: m,
      },
    );
    if (!n.ok) {
      steps.push({
        id: 'window',
        label: 'rate',
        caption: fb(bi('Prometheus вычисляет правило, но в окне {w} мин при опросе раз в {s} секунд оказывается меньше двух значений счётчика. Скорость роста по одной точке посчитать нельзя, поэтому rate возвращает пустой результат, и правило не срабатывает, сколько бы ошибок ни было.', 'Prometheus evaluates the rule, but a {w} min window with a scrape every {s} seconds holds fewer than two counter values. A rate cannot be computed from one point, so rate returns an empty result and the rule does not fire, however many errors there are.'), { w: p.window, s }),
        focus: ['e-eval', 'rule'],
        reveal: ['rule', 'e-eval'],
        say: { rule: bi('Правило ищет в окне два значения счётчика, находит только одно, и скорость считать не из чего.', 'The rule looks for two counter values in the window and finds only one: nothing to compute from.') },
        states: { rule: 'err', 'e-eval': 'err' },
        metrics: m,
        broken: { at: 'e-eval', message: `rate(http_requests_total{code="500"}[${p.window * 60}s]) → empty result`, caption: bi('на вычислении правила. Окно для rate берут не короче четырёх интервалов опроса, иначе в нём бывает меньше двух значений, и правило молча перестаёт работать.', 'at the rule evaluation. The rate window is taken at least four scrape intervals long; otherwise it sometimes holds fewer than two values and the rule silently stops working.') },
      });
      return steps;
    }
    if (p.forMin > 0) {
      steps.push(
        {
          id: 'eval',
          label: 'pending',
          caption: fb(bi('Раз в минуту Prometheus вычисляет правило и считает, какая доля ответов за последние {w} мин закончилась ошибкой 5xx. Доля оказывается выше 2 %, и условие выполнено. Но в правиле указано for: {f}m, поэтому алерт пока переходит только в состояние pending и никуда не уходит. Если ошибки прекратятся раньше, никто ничего не получит.', 'Once a minute Prometheus evaluates the rule and computes what share of answers over the last {w} min ended in a 5xx error. The share turns out above 2 %, and the condition holds. But the rule says for: {f}m, so for now the alert only becomes pending and goes nowhere. If the errors stop earlier, nobody gets anything.'), { w: p.window, f: p.forMin }),
          focus: ['e-eval', 'rule'],
          reveal: ['rule', 'e-eval'],
          tokens: [{ edge: 'e-eval', label: bi('5xx: 25 %', '5xx: 25 %') }],
          say: { rule: bi('Правило насчитало 25 % ошибок, это выше порога в 2 %, и алерт ждёт в состоянии pending.', 'The rule computed 25 % errors, which is above the 2 % threshold, and the alert waits in the pending state.') },
          states: { rule: 'warn', tsdb: 'ok' },
          values: { rule: `pending · for ${p.forMin}m` },
          metrics: m,
        },
        {
          id: 'firing',
          label: 'firing',
          caption: fb(bi('Условие продержалось {f} мин подряд, и алерт переходит из состояния pending в firing. Короткий всплеск ошибок до этого шага не дошёл бы, потому что for отсеивает его и бережёт сон дежурного.', 'The condition has held for {f} min in a row, and the alert goes from pending to firing. A short burst of errors would not get this far, because for filters it out and spares the on-call engineer’s sleep.'), { f: p.forMin }),
          focus: ['rule'],
          say: { rule: fb(bi('Условие держится уже {f} мин подряд, и алерт срабатывает (firing).', 'The condition has held for {f} min in a row: the alert fires.'), { f: p.forMin }) },
          states: { rule: 'err' },
          values: { rule: 'firing' },
          metrics: m,
        },
      );
    } else {
      steps.push({
        id: 'eval',
        label: 'firing',
        caption: fb(bi('Раз в минуту Prometheus вычисляет правило и считает, какая доля ответов за последние {w} мин закончилась ошибкой 5xx. Доля оказывается выше 2 %. Поле for равно нулю, поэтому алерт срабатывает сразу, при первом же вычислении. Так он сработал бы и на всплеске ошибок длиной в одну минуту.', 'Once a minute Prometheus evaluates the rule and computes what share of answers over the last {w} min ended in a 5xx error. The share turns out above 2 %. The for field is zero, so the alert fires at once, on the first evaluation. It would fire the same way on a burst of errors lasting one minute.'), { w: p.window }),
        focus: ['e-eval', 'rule'],
        reveal: ['rule', 'e-eval'],
        tokens: [{ edge: 'e-eval', label: bi('5xx: 25 %', '5xx: 25 %') }],
        say: { rule: bi('Доля ошибок составляет 25 %, это выше порога в 2 %, а поле for не задано, поэтому алерт срабатывает сразу.', 'The error share is 25 %, which is above the 2 % threshold, and the for field is not set, so the alert fires at once.') },
        states: { rule: 'err', tsdb: 'ok' },
        values: { rule: 'firing' },
        metrics: m,
      });
    }
    if (broken.has('am-down')) {
      steps.push({
        id: 'amdown',
        label: bi('отправка не удалась', 'send failed'),
        caption: bi('Prometheus отправляет сработавший алерт в Alertmanager, но тот остановлен и не отвечает. Правило горит, а сообщения нет, и дежурный ничего не узнает. Сам Prometheus людям не пишет, а только записывает в свой журнал ошибку отправки.', 'Prometheus sends the firing alert to Alertmanager, but it is stopped and does not answer. The rule is firing, there is no message, and the on-call engineer learns nothing. Prometheus does not message people itself; it only writes the sending error into its own log.'),
        focus: ['rule', 'e-alert'],
        reveal: ['am', 'e-alert'],
        tokens: [{ edge: 'e-alert', label: 'firing' }],
        say: { rule: bi('Prometheus отправляет алерт в Alertmanager и получает отказ в соединении.', 'Prometheus sends the alert to Alertmanager and gets connection refused.') },
        states: { am: 'err', 'e-alert': 'err' },
        metrics: m,
        broken: {
          at: 'am',
          message: 'level=ERROR component=notifier msg="Error sending alerts" alertmanager=http://alertmanager:9093/api/v2/alerts err="Post \\"http://alertmanager:9093/api/v2/alerts\\": dial tcp: connect: connection refused"',
          caption: bi('на Alertmanager. Чтобы такая поломка не прошла незамеченной, держат алерт Watchdog, который горит всегда, и внешнюю проверку, что сообщение от него приходит. Если сообщение от Watchdog перестало приходить, сломан сам мониторинг.', 'at Alertmanager. So that such a break does not go unnoticed, teams keep a Watchdog alert that always fires, and an external check that its message arrives. If the Watchdog message stops arriving, monitoring itself is broken.'),
        },
      });
      return steps;
    }
    steps.push(
      {
        id: 'route',
        label: 'route',
        caption: bi('Prometheus отправляет сработавший алерт в Alertmanager. У алерта есть метка `severity="page"`, и по дереву маршрутов Alertmanager выбирает для него получателя pager, то есть телефон дежурного.', 'Prometheus sends the firing alert to Alertmanager. The alert has the label severity="page", and by its route tree Alertmanager picks the pager receiver for it, that is, the on-call engineer’s phone.'),
        focus: ['e-alert', 'am'],
        reveal: ['am', 'e-alert'],
        tokens: [{ edge: 'e-alert', label: 'severity="page"' }],
        say: { am: bi('Alertmanager видит метку severity="page" и выбирает получателя pager.', 'Alertmanager sees severity="page" and picks the pager receiver.') },
        values: { am: 'receiver: pager' },
        metrics: m,
      },
      {
        id: 'wait',
        label: 'group_wait',
        caption: p.groupWait
          ? fb(bi('Прежде чем отправить сообщение, Alertmanager ждёт {g} секунд. Если за это время придут похожие алерты, например от двух других экземпляров api, дежурный получит одно сообщение, а не три.', 'Before writing, Alertmanager waits {g} seconds. If similar alerts arrive meanwhile, say from the two other api instances, the on-call engineer gets one message instead of three.'), { g: p.groupWait })
          : bi('Поле group_wait равно нулю, поэтому Alertmanager отправляет сообщение сразу. Если через секунду придут похожие алерты от других экземпляров api, каждый из них придёт отдельным сообщением.', 'group_wait is zero, so Alertmanager writes at once. If similar alerts from other api instances arrive a second later, each of them comes as a separate message.'),
        focus: ['am'],
        say: { am: p.groupWait ? fb(bi('Alertmanager ждёт {g} секунд и собирает похожие алерты в одно сообщение.', 'Alertmanager waits {g} seconds and gathers similar alerts into one message.'), { g: p.groupWait }) : bi('Alertmanager не ждёт и сразу готовит сообщение.', 'Alertmanager does not wait and prepares the message at once.') },
        states: { am: 'ok' },
        values: { am: `group_wait ${p.groupWait}s` },
        metrics: m,
      },
      {
        id: 'notify',
        label: bi('сообщение', 'message'),
        caption: fb(bi('Дежурный получает сообщение. В худшем случае от первой ошибки до сообщения проходит {d} секунд. Из них до {s} секунд уходит на ожидание следующего опроса, до минуты на ожидание следующего вычисления правила, {f} мин на for и {g} секунд на group_wait. Меняйте эти параметры и следите за счётчиком под схемой.', 'The on-call engineer gets the message. In the worst case {d} seconds pass from the first error to the message. Of them, up to {s} seconds go to waiting for the next scrape, up to a minute to waiting for the next rule evaluation, {f} min to `for` and {g} seconds to group_wait. Change these parameters and watch the counter under the diagram.'), { d: n.detect, s, f: p.forMin, g: p.groupWait }),
        focus: ['e-notify', 'pager'],
        reveal: ['pager', 'e-notify'],
        tokens: [{ edge: 'e-notify', label: bi('сообщение', 'message') }],
        say: { pager: bi('Дежурный получает сообщение о том, что доля ошибок api выше 2 %.', 'The on-call engineer gets the message that the api error share is above 2 %.') },
        states: { pager: 'ok' },
        metrics: m,
      },
    );
    return steps;
  },
  explainDelta(prev, next, change, _a, b): Bi {
    if (change.kind === 'break') {
      if (change.id === 'target-down')
        return change.on
          ? bi('Процесс api перестал отвечать, и Prometheus сам замечает это при опросе и записывает up = 0. Правило о доле ошибок при этом молчит, потому что новых значений нет.', 'The api process stopped answering, and Prometheus notices it itself at the scrape and writes up = 0. The error-share rule stays silent, because there are no new values.')
          : bi('Процесс api снова отвечает на /metrics, и значения счётчиков опять попадают в хранилище.', 'The api process answers /metrics again, and the counter values reach the store again.');
      return change.on
        ? bi('Alertmanager остановлен, поэтому алерт срабатывает, но сообщение до дежурного не доходит.', 'Alertmanager is stopped, so the alert fires, but the message does not reach the on-call engineer.')
        : bi('Alertmanager снова работает, и сообщение доходит до дежурного.', 'Alertmanager works again, and the message reaches the on-call engineer.');
    }
    const d0 = last(prev).detect ?? 0;
    const d1 = last(next).detect ?? 0;
    if (change.id === 'window' || change.id === 'scrape') {
      if (next.some((s) => s.broken)) return fb(bi('Теперь в окне всего {n} счётчика, а для скорости нужно хотя бы два. Правило возвращает пустой результат и не сработает. Окно должно быть не короче четырёх интервалов опроса.', 'Now the window holds only {n} of the counter, and a rate needs at least two. The rule returns an empty result and will not fire. The window must be at least four scrape intervals long.'), { n: valuesOf(last(next).samples ?? 0) });
      return fb(bi('Теперь в окне {n} счётчика. Чем окно длиннее, тем ровнее кривая, но тем медленнее она реагирует на начало аварии.', 'Now the window holds {n} of the counter. The longer the window, the smoother the curve, but the slower it reacts to the start of an outage.'), { n: valuesOf(last(next).samples ?? 0), w: b.window });
    }
    if (last(next).detect === undefined) return bi('Сейчас сообщение до дежурного не доходит, поэтому время до него схема не показывает. Выключите поломку или сделайте окно правила длиннее, и тогда изменение этого параметра станет видно по счётчику под схемой.', 'The message does not reach the on-call engineer now, so the diagram shows no time to it. Switch off the break or make the rule window longer, and then the change of this parameter shows in the counter under the diagram.');
    return fb(bi('Время от первой ошибки до сообщения изменилось с {a} до {b} секунд.', 'The time from the first error to the message changed from {a} to {b} seconds.'), { a: d0, b: d1 });
  },
});
