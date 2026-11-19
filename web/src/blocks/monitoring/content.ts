// Block "Monitoring" (route id monitoring, 06 §7). Order of ideas: time
// series and labels → cardinality → counter and gauge → scrape and up →
// selectors → range vector and rate → aggregation → histogram and quantile →
// alert rule and for → Alertmanager → the RED method in an incident.

import { bi } from '../../core/i18n';
import type { Block, Concept, Facts, Lesson, PlacementTask, QuizItem, Sources } from '../../core/types';
import { dataset, NOW, type Incident } from './prom/data';
import { evalRule, parseAm, parseRules, routeAlert } from './prom/alerts';
import type { Result } from './prom/promql';
import type { WorkbenchProps } from './workbench';

export const S = {
  promOverview: { title: 'Prometheus — Overview', url: 'https://prometheus.io/docs/introduction/overview/' },
  dataModel: { title: 'Prometheus — Data model', url: 'https://prometheus.io/docs/concepts/data_model/' },
  metricTypes: { title: 'Prometheus — Metric types', url: 'https://prometheus.io/docs/concepts/metric_types/' },
  naming: { title: 'Prometheus — Metric and label naming', url: 'https://prometheus.io/docs/practices/naming/' },
  basics: { title: 'Prometheus — Querying basics', url: 'https://prometheus.io/docs/prometheus/latest/querying/basics/' },
  functions: { title: 'Prometheus — Query functions', url: 'https://prometheus.io/docs/prometheus/latest/querying/functions/' },
  histograms: { title: 'Prometheus — Histograms and summaries', url: 'https://prometheus.io/docs/practices/histograms/' },
  alerting: { title: 'Prometheus — Alerting rules', url: 'https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/' },
  am: { title: 'Prometheus — Alertmanager', url: 'https://prometheus.io/docs/alerting/latest/alertmanager/' },
  sreAlert: { title: 'Google SRE Book — Monitoring Distributed Systems', url: 'https://sre.google/sre-book/monitoring-distributed-systems/' },
  red: { title: 'Grafana Labs — The RED Method: How to instrument your services', url: 'https://grafana.com/blog/2018/08/02/the-red-method-how-to-instrument-your-services/' },
  ruPrometheus: { title: 'Prometheus (программное обеспечение) — Википедия', url: 'https://ru.wikipedia.org/wiki/Prometheus_(%D0%BF%D1%80%D0%BE%D0%B3%D1%80%D0%B0%D0%BC%D0%BC%D0%BD%D0%BE%D0%B5_%D0%BE%D0%B1%D0%B5%D1%81%D0%BF%D0%B5%D1%87%D0%B5%D0%BD%D0%B8%D0%B5)' },
  ruTimeSeries: { title: 'Временной ряд — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%92%D1%80%D0%B5%D0%BC%D0%B5%D0%BD%D0%BD%D0%BE%D0%B9_%D1%80%D1%8F%D0%B4' },
  ruQuantile: { title: 'Квантиль — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%9A%D0%B2%D0%B0%D0%BD%D1%82%D0%B8%D0%BB%D1%8C' },
  ruHabrPromql: { title: 'Хабр — PromQL для начинающих', url: 'https://habr.com/ru/companies/otus/articles/769806/' },
  ruSre: { title: 'Хабр — SRE: мониторинг распределённых систем (перевод главы SRE Book)', url: 'https://habr.com/ru/companies/southbridge/articles/655303/' },
};
export const src = (en: { title: string; url: string }[], ru: { title: string; url: string }[]): Sources => ({ en, ru });

export const concepts: Concept[] = [
  { id: 'obs.series', term: bi('временной ряд', 'time series'), forms: { ru: ['временного ряда', 'временные ряды', 'временных рядов', 'временным рядом'] }, short: bi('Последовательность пар «время, значение» для одного имени метрики с одним набором меток.', 'A sequence of "time, value" pairs for one metric name with one set of labels.'), introducedIn: 'monitoring.series' },
  { id: 'obs.label', term: bi('метка', 'label'), forms: { ru: ['метки', 'меток', 'меткам', 'метками', 'метку'], en: ['labels'] }, scan: false, short: bi('Пара «ключ=значение» у метрики (route="/cart", code="500"): по меткам выбирают и группируют ряды.', 'A key=value pair on a metric (route="/cart", code="500"): series are selected and grouped by labels.'), introducedIn: 'monitoring.series' },
  { id: 'obs.cardinality', term: bi('кардинальность', 'cardinality'), forms: { ru: ['кардинальности'] }, short: bi('Число рядов метрики — произведение числа значений всех её меток; главный расход памяти мониторинга.', 'The number of series of a metric, the product of the value counts of all its labels; the main memory cost of monitoring.'), introducedIn: 'monitoring.series' },
  { id: 'obs.counter', term: bi('counter', 'counter'), scan: false, short: bi('Метрика, которая только растёт (и сбрасывается в 0 при перезапуске): число запросов, ошибок, байт.', 'A metric that only grows (and resets to 0 on restart): requests, errors, bytes.'), introducedIn: 'monitoring.series' },
  { id: 'obs.gauge', term: bi('gauge', 'gauge'), scan: false, short: bi('Метрика, которая растёт и падает: занятые соединения, свободная память, длина очереди.', 'A metric that goes up and down: connections in use, free memory, queue length.'), introducedIn: 'monitoring.series' },
  { id: 'obs.scrape', term: bi('scrape', 'scrape'), scan: false, short: bi('Опрос цели Prometheus по расписанию: GET /metrics; ряд up показывает, удался ли он.', 'Prometheus polling a target on a schedule: GET /metrics; the up series shows whether it worked.'), introducedIn: 'monitoring.series' },
  { id: 'obs.selector', term: bi('селектор PromQL', 'PromQL selector'), forms: { ru: ['селектора PromQL', 'селекторы PromQL'], en: ['PromQL selectors'] }, short: bi('Начало запроса PromQL: имя метрики и матчеры меток =, !=, =~, !~.', 'The start of a PromQL query: a metric name and label matchers =, !=, =~, !~.'), introducedIn: 'monitoring.promql' },
  { id: 'obs.rate', term: bi('rate', 'rate'), scan: false, short: bi('Средняя скорость роста счётчика в секунду за окно [5m]; переживает сброс счётчика.', 'The average per-second growth of a counter over a window [5m]; survives counter resets.'), introducedIn: 'monitoring.promql', docRef: { page: 'web/prometheus.io/querying/functions', anchor: 'rate' } },
  { id: 'obs.aggregation', term: bi('агрегация', 'aggregation'), forms: { ru: ['агрегации', 'агрегацию', 'агрегацией'] }, short: bi('Свёртка рядов в меньшее число: sum, avg, max by (метки) — остальные метки отбрасываются.', 'Folding series into fewer: sum, avg, max by (labels) — the other labels are dropped.'), introducedIn: 'monitoring.promql' },
  { id: 'obs.histogram', term: bi('гистограмма', 'histogram'), forms: { ru: ['гистограммы', 'гистограмму', 'гистограммой', 'гистограмм'], en: ['histograms'] }, short: bi('Метрика-распределение: счётчики бакетов le — сколько наблюдений не больше каждой границы.', 'A distribution metric: bucket counters le, how many observations are at most each bound.'), introducedIn: 'monitoring.histogram' },
  { id: 'obs.quantile', term: bi('квантиль', 'quantile'), forms: { ru: ['квантиля', 'квантили', 'квантилей'], en: ['quantiles'] }, short: bi('Значение, ниже которого доля наблюдений φ: p99 — 99% запросов быстрее этого времени.', 'The value below which a share φ of observations falls: p99 means 99% of requests are faster than this.'), introducedIn: 'monitoring.histogram' },
  { id: 'obs.alert-rule', term: bi('правило алерта', 'alerting rule'), forms: { ru: ['правила алерта', 'правило алерта', 'правилом алерта'], en: ['alerting rules'] }, short: bi('Запрос PromQL с условием, который Prometheus вычисляет по расписанию; for задаёт, как долго условие должно держаться.', 'A PromQL query with a condition Prometheus evaluates on a schedule; for sets how long it must hold.'), introducedIn: 'monitoring.alerts', docRef: { page: 'web/prometheus.io/alerting/rules', anchor: 'defining' } },
  { id: 'obs.alertmanager', term: bi('Alertmanager', 'Alertmanager'), short: bi('Сервис, который получает алерты, выбирает получателя по меткам, группирует и гасит следствия.', 'A service that receives alerts, picks receivers by labels, groups them and mutes consequences.'), introducedIn: 'monitoring.alerts' },
  { id: 'obs.use', term: bi('метод USE', 'USE method'), forms: { ru: ['метода USE', 'методу USE', 'методом USE'] }, short: bi('Три вопроса к ресурсу: Utilization (насколько занят), Saturation (сколько ждёт в очереди), Errors (ошибки).', 'Three questions to a resource: Utilization (how busy), Saturation (how much waits in the queue), Errors.'), introducedIn: 'monitoring.incident' },
  { id: 'obs.red', term: bi('метод RED', 'RED method'), forms: { ru: ['метода RED', 'методу RED'] }, short: bi('Три метрики сервиса глазами пользователя: Rate (запросы), Errors (ошибки), Duration (длительность).', 'Three metrics of a service as its user sees it: Rate (requests), Errors (errors), Duration (latency).'), introducedIn: 'monitoring.incident' },
];

// ── helpers ──

export const vecOf = (r: Result) => (r.type === 'vector' ? r.data : []);
export const MON = '/home/learner/mon';

export function rulesFire(text: string, incident: Incident): boolean | null {
  const { groups, errors } = parseRules(text, 'rules.yml');
  if (errors.length || !groups.length) return null;
  const db = dataset(incident);
  return groups.some((g) => g.rules.some((r) => r.alert && evalRule(db, r, NOW - 30 * 60_000, NOW).points.at(-1)?.state === 'firing'));
}

export const AM = `route:
  receiver: email
  group_by: [alertname, service]
  routes:
    - matchers: [severity="page"]
      receiver: pager
receivers:
  - name: email
  - name: pager
  - name: team-chat
`;

// ── quiz ──

export const quiz: QuizItem[] = [
  {
    id: 'obs.q.series',
    kind: 'mcq',
    concepts: ['obs.series', 'obs.label'],
    prompt: bi('У `http_requests_total` метки route (4 значения), code (2 значения) и instance (3 экземпляра). Сколько рядов?', '`http_requests_total` has the labels route (4 values), code (2 values) and instance (3 instances). How many series?'),
    options: [
      { id: '24', text: '24', correct: true },
      { id: '1', text: '1', why: bi('Метрика — не один ряд: каждая уникальная комбинация меток хранится отдельно.', 'A metric is not one series: every unique combination of labels is stored separately.') },
      { id: '9', text: '9', why: bi('Значения меток не складываются, а перемножаются: 4 × 2 × 3.', 'Label values do not add up, they multiply: 4 × 2 × 3.') },
    ],
  },
  {
    id: 'obs.q.cardinality',
    kind: 'mcq',
    concepts: ['obs.cardinality'],
    prompt: bi('Разработчик хочет добавить к `http_requests_total` метку `user_id` (у сервиса 200 000 пользователей). Что случится?', 'A developer wants to add a `user_id` label to `http_requests_total` (the service has 200,000 users). What happens?'),
    options: [
      { id: 'boom', text: bi('Число рядов вырастет в сотни тысяч раз, Prometheus упрётся в память', 'The number of series grows a hundred-thousand-fold and Prometheus runs out of memory'), correct: true },
      { id: 'ok', text: bi('Ничего страшного: просто ещё одна метка', 'Nothing bad: just one more label'), why: bi('Каждая метка умножает число рядов на число своих значений. Метка — измерение для группировки, а не идентификатор объекта.', 'Every label multiplies the series count by its number of values. A label is a dimension to group by, not an object identifier.') },
      { id: 'slow', text: bi('Запросы станут чуть медленнее', 'Queries become a little slower'), why: bi('Хуже: растёт память на ряды, и сервер мониторинга может упасть.', 'Worse: memory per series grows and the monitoring server can fall over.') },
    ],
  },
  {
    id: 'obs.q.types',
    kind: 'match',
    concepts: ['obs.counter', 'obs.gauge'],
    prompt: bi('Какой тип у метрики?', 'Which type is the metric?'),
    pairs: [
      { id: 'req', left: bi('число обработанных запросов с запуска', 'requests handled since start'), right: 'counter' },
      { id: 'conn', left: bi('занятые соединения пула сейчас', 'pool connections in use now'), right: 'gauge' },
      { id: 'mem', left: bi('свободная память узла', 'free memory of a node'), right: 'gauge' },
      { id: 'bytes', left: bi('байт отправлено по сети', 'bytes sent over the network'), right: 'counter' },
    ],
  },
  {
    id: 'obs.q.pull',
    kind: 'mcq',
    concepts: ['obs.scrape'],
    prompt: bi('Как метрики сервиса попадают в Prometheus?', 'How do a service’s metrics get into Prometheus?'),
    options: [
      { id: 'pull', text: bi('Prometheus сам приходит по расписанию и делает GET /metrics', 'Prometheus comes on a schedule and does GET /metrics'), correct: true },
      { id: 'push', text: bi('Сервис отправляет каждое событие в Prometheus', 'The service sends every event to Prometheus'), why: bi('Модель Prometheus — pull: сервис только показывает текущие значения. (Push бывает через Pushgateway — для коротких пакетных задач.)', 'Prometheus uses pull: the service only shows the current values. (Push exists through the Pushgateway, for short batch jobs.)') },
      { id: 'logs', text: bi('Prometheus читает журналы сервиса', 'Prometheus reads the service logs'), why: bi('Журналы — другой сигнал и другие инструменты.', 'Logs are another signal with other tools.') },
    ],
  },
  {
    id: 'obs.q.raw-counter',
    kind: 'bugfind',
    concepts: ['obs.rate'],
    prompt: bi('Панель «запросов в секунду» показывает пилу, которая растёт и падает в ноль. Какая строка виновата?', 'The "requests per second" panel shows a saw that grows and drops to zero. Which line is to blame?'),
    code: '# Requests per second, by route\nsum by (route) (http_requests_total{job="api"})',
    bug: [2],
    why: {
      1: bi('Комментарий ни на что не влияет.', 'A comment affects nothing.'),
      2: bi('Сырой счётчик: его значение — сколько всего было с запуска, а перезапуск сбрасывает его в ноль. Скорость даёт rate(…[5m]) внутри sum.', 'A raw counter: its value is the total since start, and a restart resets it. The rate comes from rate(…[5m]) inside sum.'),
    },
  },
  {
    id: 'obs.q.rate-order',
    kind: 'mcq',
    concepts: ['obs.rate', 'obs.aggregation'],
    prompt: bi('Какой запрос правильно считает запросы в секунду по всем экземплярам?', 'Which query correctly computes requests per second across all instances?'),
    options: [
      { id: 'good', text: 'sum(rate(http_requests_total[5m]))', correct: true },
      { id: 'bad', text: 'rate(sum(http_requests_total)[5m])', why: bi('Сначала rate, потом sum: после суммирования сброс одного счётчика уже не отличить от падения трафика. Да и синтаксически это range вокруг не-селектора.', 'rate first, then sum: after summing, one counter’s reset cannot be told from a traffic drop. Syntactically it is also a range around a non-selector.') },
      { id: 'irate', text: 'sum(irate(http_requests_total[5m]))', why: bi('irate смотрит на две последние точки и дёргается; для алертов и устойчивых графиков берут rate.', 'irate looks at the last two points and jitters; alerts and steady graphs use rate.') },
    ],
  },
  {
    id: 'obs.q.window',
    kind: 'mcq',
    concepts: ['obs.rate'],
    prompt: bi('scrape_interval — 60 с. Что вернёт `rate(http_requests_total[1m])`?', 'scrape_interval is 60 s. What does `rate(http_requests_total[1m])` return?'),
    options: [
      { id: 'empty', text: bi('Чаще всего пустой результат: в окне один сэмпл', 'Usually an empty result: there is one sample in the window'), correct: true },
      { id: 'fine', text: bi('Нормальную скорость за минуту', 'A normal rate over the minute'), why: bi('Для скорости нужны минимум два сэмпла; окно берут не меньше четырёх интервалов scrape.', 'A rate needs at least two samples; the window is at least four scrape intervals.') },
    ],
  },
  {
    id: 'obs.q.avg-quantile',
    kind: 'mcq',
    concepts: ['obs.quantile', 'obs.histogram'],
    prompt: bi('Как получить p99 латентности всего сервиса из трёх экземпляров?', 'How do you get the p99 latency of a whole service from three instances?'),
    options: [
      { id: 'sum', text: 'histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))', correct: true },
      { id: 'avg', text: 'avg(histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])))', why: bi('Среднее квантилей — не квантиль: экземпляр с малым трафиком весит столько же, сколько нагруженный. Складывают бакеты, потом считают квантиль.', 'An average of quantiles is not a quantile: a low-traffic instance weighs as much as a busy one. Sum the buckets, then compute the quantile.') },
      { id: 'nole', text: 'histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])))', why: bi('sum без by (le) склеивает все бакеты в один ряд — квантиль считать не из чего.', 'sum without by (le) merges all buckets into one series: there is nothing to compute a quantile from.') },
    ],
  },
  {
    id: 'obs.q.buckets',
    kind: 'order',
    concepts: ['obs.histogram'],
    prompt: bi('Расставьте ряды гистограммы по возрастанию значения (бакеты кумулятивны).', 'Order the histogram series by increasing value (buckets are cumulative).'),
    steps: [
      { id: 'a', text: 'le="0.1"' },
      { id: 'b', text: 'le="0.5"' },
      { id: 'c', text: 'le="2.5"' },
      { id: 'd', text: 'le="+Inf"', why: bi('Бакет +Inf содержит все наблюдения и равен _count.', 'The +Inf bucket holds every observation and equals _count.') },
    ],
  },
  {
    id: 'obs.q.for',
    kind: 'mcq',
    concepts: ['obs.alert-rule'],
    prompt: bi('У правила `for: 10m`. Условие выполнилось 4 минуты и пропало. Что было с алертом?', 'A rule has `for: 10m`. The condition held for 4 minutes and went away. What happened to the alert?'),
    options: [
      { id: 'pending', text: bi('Был pending и вернулся в inactive, никто не получил сообщения', 'It was pending and went back to inactive; nobody got a message'), correct: true },
      { id: 'firing', text: bi('Сработал, и через 10 минут пришло сообщение', 'It fired and a message arrived 10 minutes later'), why: bi('for — сколько условие должно держаться без перерыва. 4 минуты меньше 10.', 'for is how long the condition must hold without a break. 4 minutes is less than 10.') },
    ],
  },
  {
    id: 'obs.q.symptom',
    kind: 'multi',
    concepts: ['obs.alert-rule'],
    prompt: bi('Какие алерты стоит отправлять дежурному ночью? Отметьте все.', 'Which alerts should page the on-call engineer at night? Mark all.'),
    options: [
      { id: 'err', text: bi('Доля 5xx у api выше 2% 10 минут', 'The api 5xx share above 2% for 10 minutes'), correct: true },
      { id: 'lat', text: bi('p99 /checkout выше 1 с 10 минут', '/checkout p99 above 1 s for 10 minutes'), correct: true },
      { id: 'cpu', text: bi('CPU узла выше 80%', 'Node CPU above 80%'), why: bi('Причина, а не симптом: высокая загрузка без влияния на пользователей — повод посмотреть днём, а не будить человека.', 'A cause, not a symptom: high load without user impact is a reason to look in the daytime, not to wake someone.') },
      { id: 'raw', text: bi('http_requests_total{code="500"} > 100', 'http_requests_total{code="500"} > 100'), why: bi('Сырой счётчик растёт всегда: через пару дней алерт будет гореть постоянно.', 'A raw counter always grows: in a couple of days the alert fires permanently.') },
    ],
  },
  {
    id: 'obs.q.route',
    kind: 'predict-output',
    concepts: ['obs.alertmanager'],
    prompt: bi('Куда Alertmanager отправит алерт с меткой severity=page?', 'Where does Alertmanager send an alert with the label severity=page?'),
    command: 'amtool config routes test --config.file=alertmanager.yml severity=page',
    setup: { cwd: '~/mon', files: [{ path: `${MON}/alertmanager.yml`, content: AM }] },
    options: [
      { id: 'pager', text: 'pager', correct: true },
      { id: 'email', text: 'email', why: bi('email — корневой получатель, он ловит только то, что не подошло ни одному маршруту.', 'email is the root receiver; it catches only what no route matched.') },
      { id: 'both', text: 'pager,email', why: bi('Без continue: true поиск останавливается на первом подошедшем маршруте.', 'Without continue: true the search stops at the first matching route.') },
    ],
  },
];

// ── lessons ──

const seriesLesson: Lesson = {
  id: 'monitoring.series',
  block: 'monitoring',
  title: bi('Метрика, ряд, метки и scrape', 'Metrics, series, labels and the scrape'),
  summary: bi('Метрика — не одно число, а множество рядов, по одному на каждую комбинацию меток; Prometheus сам забирает их у сервисов.', 'A metric is not one number but a set of series, one per label combination; Prometheus pulls them from the services itself.'),
  introduces: ['obs.series', 'obs.label', 'obs.cardinality', 'obs.counter', 'obs.gauge', 'obs.scrape'],
  uses: [],
  tier: 'core',
  minutes: 35,
  sources: src([S.promOverview, S.dataModel, S.metricTypes], [S.ruPrometheus, S.ruTimeSeries]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Клиент пишет в поддержку: «у вас не оформляется заказ». Команда узнаёт о проблеме последней, а потом час гадает, что сломалось. Мониторинг нужен, чтобы узнавать о беде раньше клиента — и сразу видеть, где искать.',
        'A customer writes to support: "I cannot place an order". The team learns about the problem last and then spends an hour guessing what broke. Monitoring is there to learn about trouble before the customer does, and to see at once where to look.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Сервис считает события у себя в памяти: обработан запрос — счётчик увеличился на единицу. У счётчика есть имя (`http_requests_total`) и [[obs.label|метки]] — пары «ключ=значение», которые говорят, *какой* это запрос: `route="/checkout"`, `code="500"`, `instance="api-1:8080"`.\n\nКаждая уникальная комбинация имени и меток — отдельный [[obs.series|временной ряд]]: своя лента сэмплов «время — значение». Поэтому метрика — это не одно число, а множество рядов. У `http_requests_total` с четырьмя маршрутами, двумя кодами и тремя экземплярами — 24 ряда. Число рядов называют [[obs.cardinality|кардинальностью]], и это главный расход памяти мониторинга: метка `user_id` с двумястами тысячами значений умножила бы число рядов в двести тысяч раз. Правило простое: метка — измерение, по которому вы будете группировать, а не идентификатор каждого объекта.\n\n### Типы метрик\n\nТип решает, какие вопросы к метрике можно задавать. [[obs.counter|counter]] только растёт: число запросов, ошибок, отправленных байт; при перезапуске процесса он начинается с нуля, поэтому само его значение мало что говорит — смотрят на скорость роста. [[obs.gauge|gauge]] растёт и падает: занятые соединения пула, свободная память, длина очереди; его значение — ответ сам по себе. Для распределений (сколько длились запросы) есть отдельный тип — ему посвящён свой урок.\n\n### Как Prometheus собирает\n\nPrometheus работает по модели pull: каждый сервис открывает страницу `/metrics` с текущими значениями в текстовом формате, а Prometheus сам приходит за ними по расписанию — это [[obs.scrape|scrape]], обычно раз в 15 секунд. Список целей лежит в `prometheus.yml`. Для каждой цели Prometheus сам пишет ряд `up`: 1 — цель ответила, 0 — не ответила. Это первый вопрос любого разбора: а мы вообще получаем данные?',
        'A service counts events in its own memory: a request is handled and a counter goes up by one. The counter has a name (`http_requests_total`) and [[obs.label|labels]], key=value pairs that say *which* request it was: `route="/checkout"`, `code="500"`, `instance="api-1:8080"`.\n\nEvery unique combination of name and labels is a separate [[obs.series|time series]]: its own strip of "time, value" samples. So a metric is not one number but a set of series. `http_requests_total` with four routes, two codes and three instances has 24 series. The number of series is called [[obs.cardinality|cardinality]], and it is the main memory cost of monitoring: a `user_id` label with two hundred thousand values would multiply the series count by two hundred thousand. The rule is simple: a label is a dimension you will group by, not an identifier of each object.\n\n### Metric types\n\nThe type decides which questions you can ask of a metric. A [[obs.counter|counter]] only grows: requests, errors, bytes sent; when the process restarts it starts from zero, so its value says little by itself, and you look at how fast it grows. A [[obs.gauge|gauge]] goes up and down: pool connections in use, free memory, queue length; its value is the answer itself. Distributions (how long requests took) have a type of their own, with a lesson of its own.\n\n### How Prometheus collects\n\nPrometheus works by pull: every service opens a `/metrics` page with the current values in a text format, and Prometheus comes for them on a schedule; that is a [[obs.scrape|scrape]], usually every 15 seconds. The target list is in `prometheus.yml`. For every target Prometheus writes the `up` series itself: 1 means the target answered, 0 means it did not. That is the first question of any investigation: are we getting data at all?',
      ),
    },
    {
      id: 'bench',
      kind: 'widget',
      step: 'practice',
      widget: 'obs.workbench',
      props: {
        title: bi('Учебный Prometheus системы Shop', 'The training Prometheus of the Shop system'),
        targets: ['api-1:8080'],
        query: 'up',
        goals: [
          { id: 'up', prompt: bi('Покажите ряд up только для целей job="api".', 'Show the up series only for the job="api" targets.'), test: (r) => vecOf(r).length === 3 && vecOf(r).every((s) => s.labels.job === 'api' && s.labels.__name__ === 'up'), then: bi('Три экземпляра api, у всех up = 1: данные идут.', 'Three api instances, all with up = 1: the data is flowing.') },
          { id: 'one', prompt: bi('Посмотрите вкладку «Цели» и выберите все ряды http_requests_total одного экземпляра api-1:8080. Сколько их?', 'Look at the Targets tab and select all http_requests_total series of the instance api-1:8080. How many are there?'), test: (r) => vecOf(r).length === 8 && vecOf(r).every((s) => s.labels.instance === 'api-1:8080' && s.labels.__name__ === 'http_requests_total'), then: bi('8 рядов: 4 маршрута × 2 кода ответа. На все три экземпляра — 24.', '8 series: 4 routes × 2 status codes. For all three instances, 24.') },
          { id: 'gauge', prompt: bi('Покажите, сколько соединений пула БД занято у каждого экземпляра api прямо сейчас.', 'Show how many DB pool connections are in use at each api instance right now.'), test: (r) => vecOf(r).length === 3 && vecOf(r).every((s) => s.labels.__name__ === 'db_connections_in_use'), then: bi('Это gauge: значение — ответ сам по себе, без rate.', 'It is a gauge: the value is the answer itself, no rate needed.') },
        ],
      } satisfies WorkbenchProps,
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['obs.q.series', 'obs.q.cardinality', 'obs.q.types', 'obs.q.pull'] },
  ],
};

const promqlLesson: Lesson = {
  id: 'monitoring.promql',
  block: 'monitoring',
  title: bi('PromQL: выбрать, посчитать скорость, сложить', 'PromQL: select, compute a rate, add up'),
  summary: bi('Запрос начинается с выбора рядов; счётчик читают через скорость его роста за окно; агрегация выбрасывает лишние метки.', 'A query starts by selecting series; a counter is read through its growth rate over a window; aggregation drops the labels you do not need.'),
  introduces: ['obs.selector', 'obs.rate', 'obs.aggregation'],
  uses: ['obs.series', 'obs.counter', 'obs.label'],
  tier: 'core',
  minutes: 40,
  sources: src([S.basics, S.functions], [S.ruHabrPromql, S.ruPrometheus]),
  sections: [
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'PromQL — язык запросов Prometheus. Запрос начинается с [[obs.selector|селектора]]: имя метрики и условия на метки. `http_requests_total{job="api", code="500"}` выбирает ряды с точным совпадением, `!=` — не равно, `=~` и `!~` — совпадение с регулярным выражением: `code=~"5.."` — все пятисотые. Результат — *instant vector*: по одному последнему значению каждого подошедшего ряда в момент запроса (Prometheus ищет сэмпл не дальше 5 минут назад).\n\nСчётчик сам по себе отвечает на вопрос «сколько всего с запуска». Чтобы получить «сколько в секунду сейчас», берут окно: `http_requests_total[5m]` — это *range vector*, все сэмплы каждого ряда за последние 5 минут (левая граница окна открыта). Функция [[obs.rate|rate]] считает по ним среднюю скорость роста в секунду и сама учитывает сброс счётчика при перезапуске: `rate(http_requests_total[5m])`. `increase` даёт прирост за окно (rate × длина окна), а `irate` — скорость по двум последним точкам, нервную, годную только для графиков. В окне должно быть минимум два сэмпла, поэтому его берут не меньше четырёх интервалов scrape.\n\nРядов обычно больше, чем нужно в ответе: 24 ряда `rate(...)` на вопрос «сколько запросов в секунду по маршрутам». [[obs.aggregation|Агрегация]] сворачивает их: `sum by (route) (rate(http_requests_total{job="api"}[5m]))` складывает ряды с одинаковым route и выбрасывает остальные метки; `without (instance)` — наоборот, выбрасывает только перечисленные. Порядок важен: сначала `rate`, потом `sum` — иначе сброс одного счётчика неотличим от падения трафика.\n\nВекторы можно делить друг на друга: Prometheus сопоставляет ряды с одинаковыми метками. Доля ошибок — `sum(rate(...{code=~"5.."}[5m])) / sum(rate(...[5m]))`.',
        'PromQL is the query language of Prometheus. A query starts with a [[obs.selector|selector]]: a metric name and conditions on labels. `http_requests_total{job="api", code="500"}` selects series with an exact match, `!=` is not equal, `=~` and `!~` match a regular expression: `code=~"5.."` is every 5xx. The result is an *instant vector*: one latest value of each matching series at the query moment (Prometheus looks for a sample at most 5 minutes back).\n\nA counter by itself answers "how many in total since start". To get "how many per second now", you take a window: `http_requests_total[5m]` is a *range vector*, every sample of each series over the last 5 minutes (the left end of the window is open). The [[obs.rate|rate]] function computes the average per-second growth from them and handles a counter reset on restart by itself: `rate(http_requests_total[5m])`. `increase` gives the growth over the window (rate × window length), and `irate` the rate over the last two points, jumpy and fit only for graphs. A window needs at least two samples, so it is at least four scrape intervals long.\n\nThere are usually more series than the answer needs: 24 series of `rate(...)` for the question "how many requests per second by route". [[obs.aggregation|Aggregation]] folds them: `sum by (route) (rate(http_requests_total{job="api"}[5m]))` adds up the series with the same route and drops the other labels; `without (instance)` does the opposite and drops only the listed ones. Order matters: `rate` first, then `sum`, or one counter’s reset cannot be told from a traffic drop.\n\nVectors can be divided by each other: Prometheus matches series with the same labels. The error share is `sum(rate(...{code=~"5.."}[5m])) / sum(rate(...[5m]))`.',
      ),
    },
    {
      id: 'bench',
      kind: 'widget',
      step: 'practice',
      widget: 'obs.workbench',
      props: {
        incident: 'restart',
        query: 'http_requests_total{job="api", instance="api-2:8080", route="/cart", code="200"}',
        goals: [
          { id: 'rate', prompt: bi('Откройте «График» для этого запроса: в середине счётчик падает в ноль — api-2 перезапускался. Теперь постройте скорость этого ряда за 5 минут: на графике не должно быть провала.', 'Open the Graph for this query: in the middle the counter drops to zero, api-2 restarted. Now build the rate of this series over 5 minutes: the graph must have no dip.'), reference: 'rate(http_requests_total{job="api", instance="api-2:8080", route="/cart", code="200"}[5m])', then: bi('rate сам находит сброс и не путает его с падением трафика.', 'rate finds the reset by itself and does not mistake it for a traffic drop.') },
          { id: 'by-route', prompt: bi('Сколько запросов в секунду получает api по каждому маршруту (все экземпляры и коды вместе)?', 'How many requests per second does api get on each route (all instances and codes together)?'), reference: 'sum by (route) (rate(http_requests_total{job="api"}[5m]))', then: bi('Четыре ряда — по маршруту; instance, code и method свернулись.', 'Four series, one per route; instance, code and method were folded away.') },
          { id: 'errors', prompt: bi('Какая доля запросов к api заканчивается ошибкой 5xx (за 5 минут, по всему сервису)?', 'What share of requests to api ends in a 5xx error (over 5 minutes, for the whole service)?'), reference: 'sum(rate(http_requests_total{job="api",code=~"5.."}[5m])) / sum(rate(http_requests_total{job="api"}[5m]))', hint: bi('Сумма скоростей ошибок, делённая на сумму скоростей всех запросов.', 'The sum of error rates divided by the sum of all request rates.') },
          { id: 'cpu', prompt: bi('Какая доля процессорного времени каждого узла занята работой (не idle)?', 'What share of each node’s CPU time is busy (not idle)?'), reference: '1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))', hint: bi('node_cpu_seconds_total считает секунды по режимам; доля idle за секунду — rate; занятость — единица минус среднее по ядрам.', 'node_cpu_seconds_total counts seconds per mode; the idle share per second is a rate; busy is one minus the average over cores.') },
        ],
      } satisfies WorkbenchProps,
    },
    {
      id: 'findfn',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Кэш-сервис `cache` должен быть в мониторинге, но его забыли добавить. Найдите в справочнике функций PromQL функцию, которая возвращает 1, когда рядов нет совсем, и выполните её для `up{job="cache"}` через `promtool query instant http://localhost:9090 …`.', 'The `cache` service should be monitored but was never added. Find in the PromQL function reference the function that returns 1 when there are no series at all, and run it for `up{job="cache"}` with `promtool query instant http://localhost:9090 …`.'),
      ref: { page: 'web/prometheus.io/querying/functions', anchor: 'absent', line: 'no elements' },
      terminal: {
        setup: { cwd: '~/mon', ext: { prom: { incident: 'none' } } },
        task: { id: 'absent', prompt: bi('Запрос вернул {job="cache"} => 1.', 'The query returned {job="cache"} => 1.'), check: { stdout: /\{job="cache"\} => 1 @/ }, docStep: 3, chips: 'promtool query instant http://localhost:9090', hints: { H1: bi('Функция названа словом «отсутствует».', 'The function is named with the word "absent".') } },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['obs.q.raw-counter', 'obs.q.rate-order', 'obs.q.window'] },
  ],
};

const histLesson: Lesson = {
  id: 'monitoring.histogram',
  block: 'monitoring',
  title: bi('Гистограммы и квантили', 'Histograms and quantiles'),
  summary: bi('Квантиль считают из суммы бакетов, а не усредняют готовые квантили.', 'A quantile is computed from summed buckets, not by averaging ready quantiles.'),
  introduces: ['obs.histogram', 'obs.quantile'],
  uses: ['obs.rate', 'obs.aggregation'],
  tier: 'core',
  minutes: 30,
  sources: src([S.histograms, S.functions], [S.ruQuantile, S.ruHabrPromql]),
  sections: [
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Среднее время ответа обманывает: если 99 запросов идут 50 мс, а один — 10 секунд, среднее около 150 мс, и проблема незаметна. Пользователь чувствует не среднее, а «хвост». Его описывает [[obs.quantile|квантиль]]: p99 = 0,8 с означает, что 99% запросов быстрее 0,8 секунды.\n\nЧтобы его посчитать, сервис хранит [[obs.histogram|гистограмму]] — набор счётчиков-бакетов с меткой `le` («меньше или равно»): `http_request_duration_seconds_bucket{le="0.1"}` — сколько запросов уложилось в 0,1 с, `le="0.5"` — в 0,5 с, и так до `le="+Inf"` — все запросы. Бакеты кумулятивны: каждый следующий включает предыдущие. Рядом лежат `_count` (всего наблюдений) и `_sum` (их сумма).\n\nКвантиль считает `histogram_quantile(0.99, …)`: находит бакет, где накопленная доля переходит 99%, и линейно интерполирует внутри него. Поэтому точность квантиля задают границы бакетов. Бакеты — счётчики, значит, сначала `rate`, а чтобы получить квантиль всего сервиса, бакеты разных экземпляров складывают, обязательно сохраняя `le`:\n\n```\nhistogram_quantile(0.99,\n  sum by (le) (rate(http_request_duration_seconds_bucket{job="api"}[5m])))\n```\n\nУсреднять квантили экземпляров нельзя: экземпляр с десятью запросами весит столько же, сколько экземпляр с десятью тысячами.',
        'The average response time deceives: if 99 requests take 50 ms and one takes 10 seconds, the average is about 150 ms and the problem is invisible. The user feels not the average but the "tail". A [[obs.quantile|quantile]] describes it: p99 = 0.8 s means 99% of requests are faster than 0.8 seconds.\n\nTo compute it, the service keeps a [[obs.histogram|histogram]]: a set of bucket counters with the label `le` ("less than or equal"): `http_request_duration_seconds_bucket{le="0.1"}` is how many requests fit into 0.1 s, `le="0.5"` into 0.5 s, and so on up to `le="+Inf"`, every request. Buckets are cumulative: each includes the previous ones. Next to them are `_count` (all observations) and `_sum` (their total).\n\n`histogram_quantile(0.99, …)` computes the quantile: it finds the bucket where the cumulative share crosses 99% and interpolates linearly inside it. So the bucket bounds set the precision of the quantile. Buckets are counters, so `rate` comes first, and to get the quantile of the whole service the buckets of different instances are summed, always keeping `le`:\n\n```\nhistogram_quantile(0.99,\n  sum by (le) (rate(http_request_duration_seconds_bucket{job="api"}[5m])))\n```\n\nAveraging the quantiles of instances is wrong: an instance with ten requests weighs as much as one with ten thousand.',
      ),
    },
    {
      id: 'bench',
      kind: 'widget',
      step: 'practice',
      widget: 'obs.workbench',
      props: {
        query: 'http_request_duration_seconds_bucket{instance="api-1:8080", route="/cart"}',
        goals: [
          { id: 'p99-route', prompt: bi('Посчитайте p99 латентности api по каждому маршруту (все экземпляры вместе, окно 5 минут).', 'Compute the p99 latency of api for each route (all instances together, a 5 minute window).'), reference: 'histogram_quantile(0.99, sum by (route, le) (rate(http_request_duration_seconds_bucket{job="api"}[5m])))', hint: bi('В by нужны и route, и le.', 'by needs both route and le.') },
          { id: 'p50', prompt: bi('А медиану (p50) всего сервиса api?', 'And the median (p50) of the whole api service?'), reference: 'histogram_quantile(0.5, sum by (le) (rate(http_request_duration_seconds_bucket{job="api"}[5m])))' },
        ],
      } satisfies WorkbenchProps,
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['obs.q.avg-quantile', 'obs.q.buckets'] },
  ],
};

const RULE_HINT = 'groups:\n  - name: api\n    rules:\n      - alert: ApiHighErrorRate\n        expr: |\n          sum(rate(http_requests_total{job="api",code=~"5.."}[5m]))\n            / sum(rate(http_requests_total{job="api"}[5m])) > 0.02\n        for: 10m\n        labels:\n          severity: page\n        annotations:\n          summary: More than 2% of api requests fail\n';

const alertsLesson: Lesson = {
  id: 'monitoring.alerts',
  block: 'monitoring',
  title: bi('Алерты и Alertmanager', 'Alerts and Alertmanager'),
  summary: bi('Алерт будит человека, поэтому стоит на симптоме и терпит короткий всплеск; Alertmanager решает, кому и сколько писать.', 'An alert wakes a person up, so it sits on a symptom and tolerates a short spike; Alertmanager decides whom to message and how often.'),
  introduces: ['obs.alert-rule', 'obs.alertmanager'],
  uses: ['obs.rate', 'obs.aggregation', 'obs.quantile'],
  tier: 'core',
  minutes: 40,
  sources: src([S.alerting, S.am, S.sreAlert], [S.ruSre, S.ruPrometheus]),
  sections: [
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        '[[obs.alert-rule|Правило алерта]] — запрос PromQL с условием в файле правил, который Prometheus вычисляет по расписанию (обычно раз в минуту). Пока результат не пуст меньше, чем указано в `for`, алерт в состоянии **pending**; если условие держится дольше — **firing**. `for: 10m` отсеивает одиночные всплески: короткий пик ошибок никого не разбудит.\n\n```yaml\ngroups:\n  - name: api\n    rules:\n      - alert: ApiHighErrorRate\n        expr: <доля 5xx> > 0.02\n        for: 10m\n        labels:\n          severity: page\n```\n\nАлерт будит человека, поэтому его ставят на **симптом** — то, что чувствует пользователь: доля ошибок, латентность. Причин бывает много (CPU, диск, сеть), а симптом один; алерт на CPU 80% чаще всего будит зря. Правила проверяет `promtool check rules rules.yml`.\n\nPrometheus не пишет людям сам. Сработавшие алерты он отправляет в [[obs.alertmanager|Alertmanager]], а тот решает остальное. Дерево маршрутов `route` выбирает получателя по меткам алерта: `severity="page"` — на пейджер, остальное — в почту; поиск идёт сверху вниз и останавливается на первом подошедшем маршруте (если не указано `continue: true`). `group_by` собирает похожие алерты в одно сообщение, `repeat_interval` не даёт повторять его слишком часто, `inhibit_rules` гасят следствия при причине: при `NodeDown` не нужны алерты всех сервисов того же узла. Проверить, куда попадёт алерт, можно без настоящего алерта: `amtool config routes test --config.file=alertmanager.yml severity=page`.',
        'An [[obs.alert-rule|alerting rule]] is a PromQL query with a condition in a rule file, which Prometheus evaluates on a schedule (usually once a minute). While the result has been non-empty for less than `for`, the alert is **pending**; if the condition holds longer, it is **firing**. `for: 10m` filters out single spikes: a short burst of errors wakes nobody.\n\n```yaml\ngroups:\n  - name: api\n    rules:\n      - alert: ApiHighErrorRate\n        expr: <5xx share> > 0.02\n        for: 10m\n        labels:\n          severity: page\n```\n\nAn alert wakes a person up, so it sits on a **symptom**, what the user feels: the error share, the latency. There are many causes (CPU, disk, network) but one symptom; an alert on CPU at 80% usually wakes people for nothing. `promtool check rules rules.yml` checks the rules.\n\nPrometheus does not message people itself. It sends firing alerts to [[obs.alertmanager|Alertmanager]], and that decides the rest. The `route` tree picks the receiver by the alert labels: `severity="page"` to the pager, the rest to email; the search goes top-down and stops at the first matching route (unless `continue: true` is set). `group_by` gathers similar alerts into one message, `repeat_interval` keeps it from repeating too often, and `inhibit_rules` mute consequences when the cause fires: with `NodeDown` you do not need alerts for every service on that node. You can check where an alert goes without a real alert: `amtool config routes test --config.file=alertmanager.yml severity=page`.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'obs.scrape-to-notify', caption: bi('Уберите for и сделайте окно rate меньше двух интервалов scrape; остановите Alertmanager.', 'Remove for and make the rate window shorter than two scrape intervals; stop Alertmanager.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: { cwd: '~/mon', files: [{ path: `${MON}/alertmanager.yml`, content: AM }, { path: `${MON}/rules.yml`, content: 'groups:\n  - name: api\n    rules: []\n' }], ext: { prom: { incident: 'checkout' } } },
      intro: bi('В `~/mon` пустой файл правил и конфигурация Alertmanager. Данные учебного Prometheus — за последние три часа, и в последние 45 минут у api что-то происходит.', '`~/mon` holds an empty rule file and the Alertmanager config. The training Prometheus has the last three hours of data, and for the last 45 minutes something is going on with api.'),
      tasks: [
        {
          id: 'rule',
          prompt: bi('Напишите в `rules.yml` алерт `ApiHighErrorRate`: доля ответов 5xx у api за 5 минут выше 2% держится 10 минут; метка `severity: page`. Проверьте файл promtool. Алерт должен гореть на сегодняшних данных и молчать в спокойный день.', 'Write an alert `ApiHighErrorRate` into `rules.yml`: the api 5xx share over 5 minutes is above 2% for 10 minutes; label `severity: page`. Check the file with promtool. The alert must fire on today’s data and stay silent on a quiet day.'),
          check: {
            when: (f: Facts) => {
              const text = f.files[`${MON}/rules.yml`]?.text ?? '';
              const { groups } = parseRules(text, 'rules.yml');
              const rule = groups.flatMap((g) => g.rules).find((r) => r.alert === 'ApiHighErrorRate');
              return !!rule && rule.for === 10 * 60_000 && rule.labels.severity === 'page' && rulesFire(text, 'checkout') === true && rulesFire(text, 'none') === false;
            },
            fail: [
              { if: (f: Facts) => parseRules(f.files[`${MON}/rules.yml`]?.text ?? '', 'rules.yml').errors.length > 0, say: bi('promtool check rules находит ошибку в файле — запустите его и прочитайте строку.', 'promtool check rules finds an error in the file: run it and read the line.') },
              { if: (f: Facts) => rulesFire(f.files[`${MON}/rules.yml`]?.text ?? '', 'none') === true, say: bi('Правило горит и в спокойный день: порог слишком низкий или выражение считает не долю.', 'The rule fires on a quiet day too: the threshold is too low, or the expression is not a share.') },
            ],
          },
          chips: 'promtool check rules rules.yml',
          concepts: ['obs.alert-rule'],
          docRef: { page: 'web/prometheus.io/alerting/rules', anchor: 'defining', line: 'for: 10m' },
          hints: { H1: bi('Выражение — доля ошибок из прошлого урока, сравнение > 0.02.', 'The expression is the error share from the previous lesson, compared with > 0.02.'), H2: bi(`\`\`\`yaml\n${RULE_HINT}\`\`\``, `\`\`\`yaml\n${RULE_HINT}\`\`\``) },
        },
        {
          id: 'route',
          prompt: bi('Отправляйте алерты с меткой `team="cafe"` уровня `severity="warning"` в получателя `team-chat`, остальное оставьте как было. Проверьте маршруты amtool.', 'Send alerts with `team="cafe"` and `severity="warning"` to the `team-chat` receiver, leave the rest as it was. Check the routes with amtool.'),
          check: {
            when: (f: Facts) => {
              const { config } = parseAm(f.files[`${MON}/alertmanager.yml`]?.text ?? '');
              if (!config) return false;
              return routeAlert(config, { team: 'cafe', severity: 'warning' }).receivers.join() === 'team-chat' && routeAlert(config, { severity: 'page' }).receivers.join() === 'pager' && routeAlert(config, { team: 'web', severity: 'warning' }).receivers.join() === 'email';
            },
            fail: [{ if: (f: Facts) => !parseAm(f.files[`${MON}/alertmanager.yml`]?.text ?? '').config, say: bi('amtool check-config не принимает файл — проверьте отступы и имена получателей.', 'amtool check-config rejects the file: check the indentation and receiver names.') }],
          },
          chips: 'amtool config routes test --config.file=alertmanager.yml team=cafe severity=warning',
          concepts: ['obs.alertmanager'],
          hints: { H1: bi('Ещё один маршрут в routes с двумя matchers.', 'One more route under routes with two matchers.'), H2: bi('```yaml\n    - matchers: [team="cafe", severity="warning"]\n      receiver: team-chat\n```', '```yaml\n    - matchers: [team="cafe", severity="warning"]\n      receiver: team-chat\n```') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Дашборд другой команды ждёт метку `host` вместо `instance`. Покажите `up{job="api"}` так, чтобы у каждого ряда появилась метка `host` со значением instance. В уроке такой функции не было — найдите её в справочнике функций и выполните через `promtool query instant http://localhost:9090 …`.', 'Another team’s dashboard expects a `host` label instead of `instance`. Show `up{job="api"}` so that every series gets a `host` label with the instance value. The lesson did not show this function: find it in the function reference and run it with `promtool query instant http://localhost:9090 …`.'),
      ref: { page: 'web/prometheus.io/querying/functions' },
      terminal: {
        setup: { cwd: '~/mon', ext: { prom: { incident: 'none' } } },
        task: { id: 'relabel', prompt: bi('У каждого ряда up{job="api"} есть host="api-N:8080".', 'Every up{job="api"} series has host="api-N:8080".'), check: { stdout: /host="api-1:8080"[\s\S]*host="api-2:8080"[\s\S]*host="api-3:8080"/ }, docStep: 4, beyond: true, solutionTokens: ['label_replace'] },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['obs.q.for', 'obs.q.symptom', 'obs.q.route'] },
  ],
};

const incidentLesson: Lesson = {
  id: 'monitoring.incident',
  block: 'monitoring',
  title: bi('Инцидент: почему выросла латентность', 'An incident: why latency went up'),
  summary: bi('Каждое утверждение о причине подтверждается запросом. Сначала восстановить сервис, потом разбирать.', 'Every statement about the cause is backed by a query. Restore the service first, investigate after.'),
  introduces: ['obs.red', 'obs.use'],
  uses: ['obs.quantile', 'obs.rate', 'obs.aggregation', 'obs.alert-rule'],
  tier: 'core',
  minutes: 40,
  sources: src([S.red, S.sreAlert], [S.ruSre, S.ruHabrPromql]),
  sections: [
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Когда приходит алерт, первое желание — угадать причину. Правило разбора другое: каждую гипотезу проверяют запросом, а результат запроса — это доказательство или опровержение.\n\nНачинают с того, что чувствует пользователь, — с метрик [[obs.red|RED]] сервиса: **Rate** (сколько запросов в секунду), **Errors** (какая доля из них с ошибкой), **Duration** (сколько они длятся, квантили). Затем сужают: по какой метке отклонение — по маршруту, по экземпляру, по версии? Если болен один экземпляр — смотрят его узел; если все экземпляры, но один маршрут — смотрят, что этот маршрут делает иначе и что менялось. Для ресурсов (пул соединений, CPU, диск) похожий вопрос «насколько занято» задаёт [[obs.use|метод USE]]: Utilization, Saturation, Errors.\n\nИ главное правило дежурного: сначала восстановить сервис (откатить релиз, переключить трафик), а уже потом разбираться до конца. Время восстановления после неудачного развёртывания — одна из метрик DORA, и откат почти всегда быстрее исправления.',
        'When an alert arrives, the first urge is to guess the cause. The rule of an investigation is different: every hypothesis is checked by a query, and the query result is proof or disproof.\n\nYou start from what the user feels, the [[obs.red|RED]] metrics of the service: **Rate** (requests per second), **Errors** (what share fails), **Duration** (how long they take, the quantiles). Then you narrow down: along which label is the deviation — route, instance, version? If one instance is sick, you look at its node; if all instances but one route, you look at what that route does differently and what changed. For resources (a connection pool, CPU, disk) a similar question, "how busy", is asked by the [[obs.use|USE method]]: Utilization, Saturation, Errors.\n\nAnd the main rule of the on-call engineer: restore the service first (roll back the release, shift traffic), and only then investigate to the end. Time to restore service after a failed deployment is one of the DORA metrics, and a rollback is almost always faster than a fix.',
      ),
    },
    {
      id: 'drill',
      kind: 'widget',
      step: 'practice',
      widget: 'obs.workbench',
      props: {
        incident: 'checkout',
        alert: { name: 'HighLatencyP99', summary: bi('p99 латентности api выше 1 с уже 10 минут.', 'The api p99 latency has been above 1 s for 10 minutes.'), labels: { service: 'api', severity: 'page' } },
        query: 'histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{job="api"}[5m])))',
        goals: [
          { id: 'route', prompt: bi('Гипотеза «медленно всё» или «медленно что-то одно»: покажите p99 api по маршрутам.', 'Hypothesis "everything is slow" or "one thing is slow": show the api p99 by route.'), test: (r) => { const v = vecOf(r); const c = v.find((s) => s.labels.route === '/checkout')?.value ?? 0; const others = v.filter((s) => s.labels.route !== '/checkout').map((s) => s.value); return v.length >= 4 && others.length > 0 && v.every((s) => !s.labels.instance) && c > 3 * Math.max(...others); }, then: bi('Медленный только /checkout — у остальных маршрутов норма.', 'Only /checkout is slow; the other routes are normal.') },
          { id: 'instance', prompt: bi('Гипотеза «болен один экземпляр»: покажите p99 маршрута /checkout по экземплярам.', 'Hypothesis "one instance is sick": show the /checkout p99 by instance.'), test: (r) => { const v = vecOf(r); return v.length === 3 && v.every((s) => !!s.labels.instance && s.value > 1); }, then: bi('Все три экземпляра одинаково медленные — дело не в одном узле.', 'All three instances are equally slow: it is not one node.') },
          { id: 'traffic', prompt: bi('Гипотеза «выросла нагрузка»: сравните запросы в секунду к api сейчас и час назад одним запросом (отношение, подсказка — offset).', 'Hypothesis "the load went up": compare api requests per second now and an hour ago in one query (a ratio; hint: offset).'), test: (r, q) => /offset/.test(q) && vecOf(r).length === 1 && vecOf(r)[0].value > 0.6 && vecOf(r)[0].value < 1.4, then: bi('Трафик примерно такой же — нагрузка не виновата.', 'Traffic is about the same: the load is not to blame.') },
          { id: 'pool', prompt: bi('Ресурс: какая доля пула соединений к БД занята у каждого экземпляра api?', 'A resource: what share of the DB connection pool is in use at each api instance?'), test: (r) => vecOf(r).length === 3 && vecOf(r).every((s) => s.value >= 0.95 && s.value <= 1), then: bi('Пул занят полностью: запросы ждут свободного соединения.', 'The pool is fully used: requests wait for a free connection.') },
          { id: 'version', prompt: bi('Что менялось: какие версии api сейчас работают (app_build_info)?', 'What changed: which api versions are running now (app_build_info)?'), test: (r) => vecOf(r).some((s) => s.labels.version === '2.3.1'), then: bi('Версия 2.3.1 — релиз за три минуты до роста латентности. Механизм: новая версия делает запрос к БД на каждый товар корзины, пул кончается, /checkout ждёт. Действие — откатить на 2.3.0, разбирать потом.', 'Version 2.3.1: a release three minutes before latency grew. The mechanism: the new version makes a DB query per cart item, the pool runs out, /checkout waits. The action: roll back to 2.3.0, investigate later.') },
        ],
      } satisfies WorkbenchProps,
    },
    {
      id: 'post',
      kind: 'callout',
      tone: 'note',
      title: bi('После отката', 'After the rollback'),
      body: bi('В разборе без поиска виноватых записывают хронологию (из ваших запросов), влияние (доля неудачных запросов за время инцидента — `increase` по 5xx), причину и действия: тест на число запросов к БД в CI, алерт на насыщение пула, выкладку canary. Вопрос не «кто», а «почему система позволила этому случиться».', 'A blameless review records the timeline (from your queries), the impact (the share of failed requests during the incident, `increase` of 5xx), the cause and the actions: a test for the number of DB queries in CI, an alert on pool saturation, canary deployments. The question is not "who" but "why did the system allow it".'),
    },
  ],
};

export const lessons: Lesson[] = [seriesLesson, promqlLesson, histLesson, alertsLesson, incidentLesson];

const placement: PlacementTask[] = [
  { id: 'monitoring.place.series', level: 'intermediate', key: true, concepts: ['obs.series'], kind: 'quiz', item: { ...(quiz.find((q) => q.id === 'obs.q.series') as QuizItem), id: 'monitoring.place.q.series' } },
  { id: 'monitoring.place.rate', level: 'intermediate', key: true, concepts: ['obs.rate'], kind: 'quiz', item: { ...(quiz.find((q) => q.id === 'obs.q.rate-order') as QuizItem), id: 'monitoring.place.q.rate' } },
  {
    id: 'monitoring.place.query',
    level: 'intermediate',
    key: false,
    concepts: ['obs.aggregation'],
    kind: 'task',
    setup: { cwd: '~/mon', ext: { prom: { incident: 'none' } } },
    task: { id: 'p1', prompt: bi('Через `promtool query instant http://localhost:9090` выведите число запросов в секунду к api по каждому маршруту.', 'With `promtool query instant http://localhost:9090` print the requests per second to api for each route.'), check: { stdout: /^\{route="\/[^"]*"\} => [\d.]+ @[\s\S]*\{route=[\s\S]*\{route=[\s\S]*\{route=/ } },
  },
  { id: 'monitoring.place.quantile', level: 'experienced', key: true, concepts: ['obs.quantile'], kind: 'quiz', item: { ...(quiz.find((q) => q.id === 'obs.q.avg-quantile') as QuizItem), id: 'monitoring.place.q.quantile' } },
  { id: 'monitoring.place.symptom', level: 'experienced', key: true, concepts: ['obs.alert-rule'], kind: 'quiz', item: { ...(quiz.find((q) => q.id === 'obs.q.symptom') as QuizItem), id: 'monitoring.place.q.symptom' } },
];

export const block: Block = {
  id: 'monitoring',
  order: 100,
  title: bi('Мониторинг', 'Monitoring'),
  summary: bi('Временные ряды и метки, типы метрик, Prometheus и scrape, PromQL: селекторы, rate, агрегация, гистограммы и квантили; алерты и Alertmanager; разбор инцидента по метрикам; журналы и LogQL, трейсы и передача контекста, метрики Kubernetes и метод USE.', 'Time series and labels, metric types, Prometheus and the scrape, PromQL: selectors, rate, aggregation, histograms and quantiles; alerts and Alertmanager; investigating an incident with metrics; logs and LogQL, traces and context propagation, Kubernetes metrics and the USE method.'),
  checklistStep: '07',
  levels: {
    beginner: bi('Не видел дашбордов', 'Has never seen a dashboard'),
    intermediate: bi('Смотрел готовые дашборды', 'Has looked at ready-made dashboards'),
    experienced: bi('Писал алерты или PromQL, работал с Zabbix', 'Has written alerts or PromQL, worked with Zabbix'),
  },
  hours: { beginner: 24, intermediate: 16, experienced: 9 },
  lessons: lessons.map((l) => l.id),
  sources: src([S.promOverview, S.functions, S.am], [S.ruPrometheus, S.ruSre]),
  docSources: ['prometheus.io', 'help'],
  placement,
};
