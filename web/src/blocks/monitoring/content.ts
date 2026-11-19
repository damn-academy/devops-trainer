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
  { id: 'obs.label', term: bi('метка', 'label'), forms: { ru: ['метки', 'меток', 'меткам', 'метками', 'метку'], en: ['labels'] }, scan: false, short: bi('Пара «ключ=значение» у метрики, например route="/cart" или code="500". По меткам ряды выбирают и группируют.', 'A key=value pair on a metric, such as route="/cart" or code="500". Series are selected and grouped by labels.'), introducedIn: 'monitoring.series' },
  { id: 'obs.cardinality', term: bi('кардинальность', 'cardinality'), forms: { ru: ['кардинальности'] }, short: bi('Число рядов у метрики. Оно равно произведению числа значений всех её меток, и от него больше всего зависит, сколько памяти займёт мониторинг.', 'The number of series of a metric. It equals the product of the value counts of all its labels, and it decides most of how much memory monitoring takes.'), introducedIn: 'monitoring.series' },
  { id: 'obs.counter', term: bi('counter', 'counter'), scan: false, short: bi('Метрика, которая только растёт, а после перезапуска процесса начинается с нуля: число запросов, ошибок, отправленных байт.', 'A metric that only grows and starts from zero after the process restarts: the number of requests, errors, bytes sent.'), introducedIn: 'monitoring.series' },
  { id: 'obs.gauge', term: bi('gauge', 'gauge'), scan: false, short: bi('Метрика, которая может и расти, и уменьшаться: число занятых соединений, свободная память, длина очереди.', 'A metric that can both grow and shrink: connections in use, free memory, queue length.'), introducedIn: 'monitoring.series' },
  { id: 'obs.scrape', term: bi('scrape', 'scrape'), scan: false, short: bi('Опрос, при котором Prometheus по расписанию сам забирает у сервиса страницу /metrics. Удался ли опрос, показывает ряд up.', 'The poll in which Prometheus fetches a service’s /metrics page itself, on a schedule. The up series shows whether it worked.'), introducedIn: 'monitoring.series' },
  { id: 'obs.selector', term: bi('селектор PromQL', 'PromQL selector'), forms: { ru: ['селектора PromQL', 'селекторы PromQL'], en: ['PromQL selectors'] }, short: bi('Начало запроса PromQL, которое выбирает ряды: имя метрики и условия на метки с операторами =, !=, =~ и !~.', 'The start of a PromQL query that selects series: a metric name and label conditions with the operators =, !=, =~ and !~.'), introducedIn: 'monitoring.promql' },
  { id: 'obs.rate', term: bi('rate', 'rate'), scan: false, short: bi('Функция PromQL, которая считает, на сколько в среднем за секунду вырастал счётчик в окне, например в окне [5m]. Сброс счётчика при перезапуске процесса она учитывает сама.', 'A PromQL function that computes how much a counter grew per second on average over a window such as [5m]. It handles a counter reset on a process restart by itself.'), introducedIn: 'monitoring.promql', docRef: { page: 'web/prometheus.io/querying/functions', anchor: 'rate' } },
  { id: 'obs.aggregation', term: bi('агрегация', 'aggregation'), forms: { ru: ['агрегации', 'агрегацию', 'агрегацией'] }, short: bi('Сведение многих рядов в несколько функциями sum, avg или max со словом by (метки). Метки, которые не названы после by, при этом отбрасываются.', 'Folding many series into a few with sum, avg or max and by (labels). Labels not named after by are dropped.'), introducedIn: 'monitoring.promql' },
  { id: 'obs.histogram', term: bi('гистограмма', 'histogram'), forms: { ru: ['гистограммы', 'гистограмму', 'гистограммой', 'гистограмм'], en: ['histograms'] }, short: bi('Метрика, которая описывает распределение значений. Она состоит из счётчиков-бакетов с меткой le, и каждый бакет считает, сколько наблюдений оказались не больше его границы.', 'A metric describing a distribution of values. It consists of bucket counters with the le label, and each bucket counts how many observations were at most its bound.'), introducedIn: 'monitoring.histogram' },
  { id: 'obs.quantile', term: bi('квантиль', 'quantile'), forms: { ru: ['квантиля', 'квантили', 'квантилей'], en: ['quantiles'] }, short: bi('Значение, ниже которого лежит заданная доля наблюдений. Например, p99, равный 0,8 с, означает, что 99 % запросов выполнились быстрее 0,8 секунды.', 'The value below which a given share of observations lies. For example, a p99 of 0.8 s means 99 % of requests finished faster than 0.8 seconds.'), introducedIn: 'monitoring.histogram' },
  { id: 'obs.alert-rule', term: bi('правило алерта', 'alerting rule'), forms: { ru: ['правила алерта', 'правило алерта', 'правилом алерта'], en: ['alerting rules'] }, short: bi('Запрос PromQL с условием, который Prometheus вычисляет по расписанию. Поле for задаёт, сколько времени условие должно продержаться, прежде чем алерт сработает.', 'A PromQL query with a condition that Prometheus evaluates on a schedule. The for field sets how long the condition must hold before the alert fires.'), introducedIn: 'monitoring.alerts', docRef: { page: 'web/prometheus.io/alerting/rules', anchor: 'defining' } },
  { id: 'obs.alertmanager', term: bi('Alertmanager', 'Alertmanager'), short: bi('Сервис, который получает сработавшие алерты, по их меткам выбирает получателя, собирает похожие алерты в одно сообщение и гасит алерты-следствия.', 'A service that receives firing alerts, picks the receiver by their labels, gathers similar alerts into one message and mutes consequence alerts.'), introducedIn: 'monitoring.alerts' },
  { id: 'obs.use', term: bi('метод USE', 'USE method'), forms: { ru: ['метода USE', 'методу USE', 'методом USE'] }, short: bi('Три вопроса к ресурсу: насколько он занят (Utilization), сколько работы ждёт его в очереди (Saturation) и были ли ошибки (Errors).', 'Three questions to a resource: how busy it is (Utilization), how much work waits for it in a queue (Saturation) and whether there were errors (Errors).'), introducedIn: 'monitoring.incident' },
  { id: 'obs.red', term: bi('метод RED', 'RED method'), forms: { ru: ['метода RED', 'методу RED'] }, short: bi('Три метрики, которые описывают сервис так, как его видит пользователь: сколько запросов в секунду он получает (Rate), какая их доля заканчивается ошибкой (Errors) и сколько они длятся (Duration).', 'Three metrics that describe a service as its user sees it: how many requests per second it gets (Rate), what share of them ends in an error (Errors) and how long they take (Duration).'), introducedIn: 'monitoring.incident' },
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
    prompt: bi('У метрики `http_requests_total` три метки: у route четыре значения, у code два, а у instance три, по числу экземпляров сервиса. Сколько рядов у этой метрики?', 'The metric `http_requests_total` has three labels: route has four values, code two and instance three, one per service instance. How many series does this metric have?'),
    options: [
      { id: '24', text: '24', correct: true },
      { id: '1', text: '1', why: bi('Метрика состоит не из одного ряда, потому что каждая комбинация значений меток хранится отдельным рядом.', 'A metric is not a single series, because every combination of label values is stored as a separate series.') },
      { id: '9', text: '9', why: bi('Числа значений меток не складываются, а перемножаются: 4 × 2 × 3 = 24.', 'The value counts of the labels do not add up, they multiply: 4 × 2 × 3 = 24.') },
    ],
  },
  {
    id: 'obs.q.cardinality',
    kind: 'mcq',
    concepts: ['obs.cardinality'],
    prompt: bi('Разработчик хочет добавить к метрике `http_requests_total` метку `user_id`, а пользователей у сервиса 200 000. Что случится?', 'A developer wants to add a `user_id` label to the metric `http_requests_total`, and the service has 200,000 users. What happens?'),
    options: [
      { id: 'boom', text: bi('Число рядов вырастет в сотни тысяч раз, и Prometheus не хватит памяти', 'The number of series grows a hundred-thousand-fold and Prometheus runs out of memory'), correct: true },
      { id: 'ok', text: bi('Ничего страшного, это всего лишь ещё одна метка', 'Nothing bad, it is only one more label'), why: bi('Каждая метка умножает число рядов на число своих значений. Метка нужна для того, по чему ряды группируют, а не для того, чтобы отличать каждый объект.', 'Every label multiplies the series count by the number of its values. A label is for what series are grouped by, not for telling every object apart.') },
      { id: 'slow', text: bi('Запросы станут чуть медленнее', 'Queries become a little slower'), why: bi('Последствия будут хуже, потому что каждый ряд занимает память, и сервер мониторинга может остановиться из-за её нехватки.', 'The consequences are worse, because every series takes memory, and the monitoring server can stop for lack of it.') },
    ],
  },
  {
    id: 'obs.q.types',
    kind: 'match',
    concepts: ['obs.counter', 'obs.gauge'],
    prompt: bi('Какой тип подходит каждой из этих метрик?', 'Which type fits each of these metrics?'),
    pairs: [
      { id: 'req', left: bi('число запросов, обработанных с момента запуска', 'requests handled since start'), right: 'counter' },
      { id: 'conn', left: bi('число соединений пула, занятых в эту секунду', 'pool connections in use this second'), right: 'gauge' },
      { id: 'mem', left: bi('свободная память узла', 'free memory of a node'), right: 'gauge' },
      { id: 'bytes', left: bi('сколько байт отправлено по сети', 'bytes sent over the network'), right: 'counter' },
    ],
  },
  {
    id: 'obs.q.pull',
    kind: 'mcq',
    concepts: ['obs.scrape'],
    prompt: bi('Как метрики сервиса попадают в Prometheus?', 'How do a service’s metrics get into Prometheus?'),
    options: [
      { id: 'pull', text: bi('Prometheus сам по расписанию приходит к сервису и забирает страницу /metrics', 'Prometheus comes to the service on a schedule and fetches the /metrics page'), correct: true },
      { id: 'push', text: bi('Сервис отправляет каждое событие в Prometheus', 'The service sends every event to Prometheus'), why: bi('Prometheus работает по модели pull, то есть сервис только показывает текущие значения, а забирает их сам Prometheus. Отправлять метрики можно лишь через отдельный сервис Pushgateway, и так поступают короткие пакетные задачи, которые завершаются раньше, чем Prometheus успел бы за ними прийти.', 'Prometheus works by pull, that is, the service only shows the current values, and Prometheus fetches them itself. Metrics can be pushed only through a separate service, the Pushgateway, and that is done by short batch jobs that finish before Prometheus would come for them.') },
      { id: 'logs', text: bi('Prometheus читает журналы сервиса', 'Prometheus reads the service logs'), why: bi('Журналы собирают другие инструменты, а Prometheus их не читает.', 'Logs are collected by other tools; Prometheus does not read them.') },
    ],
  },
  {
    id: 'obs.q.raw-counter',
    kind: 'bugfind',
    concepts: ['obs.rate'],
    prompt: bi('Панель «Запросов в секунду» рисует пилу: линия всё время растёт, а потом падает до нуля. Какая строка запроса в этом виновата?', 'The “Requests per second” panel draws a saw: the line keeps growing and then drops to zero. Which line of the query is to blame?'),
    code: '# Requests per second, by route\nsum by (route) (http_requests_total{job="api"})',
    bug: [2],
    why: {
      1: bi('Строка с комментарием на результат запроса не влияет.', 'The comment line does not affect the query result.'),
      2: bi('Здесь складываются сами счётчики. Значение счётчика говорит, сколько запросов было всего с момента запуска, поэтому линия растёт, а при перезапуске процесса падает до нуля. Скорость получится, если обернуть счётчик в rate(…[5m]) внутри sum.', 'Here the counters themselves are added up. A counter’s value says how many requests there were in total since start, so the line grows and drops to zero when the process restarts. You get the rate by wrapping the counter in rate(…[5m]) inside sum.'),
    },
  },
  {
    id: 'obs.q.rate-order',
    kind: 'mcq',
    concepts: ['obs.rate', 'obs.aggregation'],
    prompt: bi('Какой запрос правильно считает, сколько запросов в секунду получают все экземпляры сервиса вместе?', 'Which query correctly computes how many requests per second all instances of the service get together?'),
    options: [
      { id: 'good', text: 'sum(rate(http_requests_total[5m]))', correct: true },
      { id: 'bad', text: 'rate(sum(http_requests_total)[5m])', why: bi('Сначала нужно применить rate, а потом sum, потому что после сложения сброс одного счётчика уже не отличить от падения трафика. Кроме того, такой запрос не выполнится, потому что окно [5m] можно ставить только после селектора, а не после выражения.', 'rate must come first and sum second, because after adding up, one counter’s reset cannot be told from a drop in traffic. Besides, such a query will not run, because the [5m] window may follow only a selector, not an expression.') },
      { id: 'irate', text: 'sum(irate(http_requests_total[5m]))', why: bi('Функция irate считает скорость по двум последним значениям, поэтому её линия скачет. Для алертов и спокойных графиков берут rate.', 'irate computes the rate from the last two values, so its line jumps about. Alerts and calm graphs use rate.') },
    ],
  },
  {
    id: 'obs.q.window',
    kind: 'mcq',
    concepts: ['obs.rate'],
    prompt: bi('Prometheus опрашивает сервис раз в 60 секунд, то есть scrape_interval равен 60 с. Что вернёт запрос `rate(http_requests_total[1m])`?', 'Prometheus scrapes the service every 60 seconds, that is, scrape_interval is 60 s. What does `rate(http_requests_total[1m])` return?'),
    options: [
      { id: 'empty', text: bi('Чаще всего пустой результат, потому что в окно попадает одно значение счётчика', 'Usually an empty result, because the window holds one counter value'), correct: true },
      { id: 'fine', text: bi('Обычную скорость роста за минуту', 'An ordinary rate over the minute'), why: bi('Чтобы посчитать скорость, нужны хотя бы два значения. Поэтому окно берут не короче четырёх интервалов опроса.', 'A rate needs at least two values. That is why the window is taken at least four scrape intervals long.') },
    ],
  },
  {
    id: 'obs.q.avg-quantile',
    kind: 'mcq',
    concepts: ['obs.quantile', 'obs.histogram'],
    prompt: bi('Сервис работает в трёх экземплярах. Каким запросом получить p99 латентности всего сервиса?', 'The service runs as three instances. Which query gives the p99 latency of the whole service?'),
    options: [
      { id: 'sum', text: 'histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))', correct: true },
      { id: 'avg', text: 'avg(histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])))', why: bi('Среднее нескольких квантилей не равно квантилю всего сервиса, потому что экземпляр с малым трафиком повлияет на результат так же, как нагруженный. Сначала складывают бакеты всех экземпляров, а потом считают по ним квантиль.', 'Averaging quantiles does not give the quantile of the whole service, because an instance with little traffic affects the result as much as a busy one. First the buckets of all instances are summed, then the quantile is computed from them.') },
      { id: 'nole', text: 'histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])))', why: bi('Без by (le) функция sum сложит все бакеты в один ряд, и квантиль будет не из чего посчитать.', 'Without by (le), sum adds all the buckets into one series, and there is nothing to compute a quantile from.') },
    ],
  },
  {
    id: 'obs.q.buckets',
    kind: 'order',
    concepts: ['obs.histogram'],
    prompt: bi('Расставьте ряды гистограммы по возрастанию их значений. Помните, что каждый бакет включает в себя все предыдущие.', 'Order the histogram series by increasing value. Remember that each bucket includes all the previous ones.'),
    steps: [
      { id: 'a', text: 'le="0.1"' },
      { id: 'b', text: 'le="0.5"' },
      { id: 'c', text: 'le="2.5"' },
      { id: 'd', text: 'le="+Inf"', why: bi('В бакет +Inf попадают все наблюдения, поэтому его значение равно _count.', 'Every observation lands in the +Inf bucket, so its value equals _count.') },
    ],
  },
  {
    id: 'obs.q.for',
    kind: 'mcq',
    concepts: ['obs.alert-rule'],
    prompt: bi('В правиле указано `for: 10m`. Условие выполнялось 4 минуты, а потом перестало. Что было с алертом?', 'The rule says `for: 10m`. The condition held for 4 minutes and then stopped holding. What happened to the alert?'),
    options: [
      { id: 'pending', text: bi('Алерт перешёл в состояние pending, вернулся в inactive, и сообщения никто не получил', 'The alert was pending for a while and went back to inactive, and nobody got a message'), correct: true },
      { id: 'firing', text: bi('Алерт сработал, и через 10 минут дежурный получил сообщение', 'It fired and a message arrived 10 minutes later'), why: bi('Поле for задаёт, сколько условие должно продержаться без перерыва, а 4 минуты меньше 10.', 'The for field sets how long the condition must hold without a break, and 4 minutes is less than 10.') },
    ],
  },
  {
    id: 'obs.q.symptom',
    kind: 'multi',
    concepts: ['obs.alert-rule'],
    prompt: bi('Какие из этих алертов стоит отправлять дежурному ночью? Отметьте все подходящие.', 'Which of these alerts should page the on-call engineer at night? Mark all that fit.'),
    options: [
      { id: 'err', text: bi('Доля ответов 5xx у api выше 2 % в течение 10 минут', 'The share of 5xx answers of api above 2 % for 10 minutes'), correct: true },
      { id: 'lat', text: bi('p99 маршрута /checkout выше 1 секунды в течение 10 минут', 'The p99 of /checkout above 1 second for 10 minutes'), correct: true },
      { id: 'cpu', text: bi('Загрузка процессора узла выше 80 %', 'Node CPU load above 80 %'), why: bi('Загрузка процессора говорит о возможной причине, а не о симптоме. Если пользователи её не чувствуют, на неё можно посмотреть днём, а будить ради неё человека не стоит.', 'CPU load points to a possible cause, not a symptom. If users do not feel it, it can be looked at in the daytime; it is not worth waking someone for.') },
      { id: 'raw', text: bi('http_requests_total{code="500"} > 100', 'http_requests_total{code="500"} > 100'), why: bi('Счётчик только растёт, поэтому через пару дней он перевалит за 100, и алерт будет гореть не переставая.', 'A counter only grows, so in a couple of days it passes 100 and the alert fires without end.') },
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
      { id: 'email', text: 'email', why: bi('Получатель email указан у корня дерева маршрутов и получает только те алерты, которые не подошли ни одному маршруту.', 'The email receiver is set at the root of the route tree and gets only the alerts that matched no route.') },
      { id: 'both', text: 'pager,email', why: bi('Если у маршрута не указано continue: true, поиск останавливается на первом подошедшем маршруте.', 'Unless the route sets continue: true, the search stops at the first matching route.') },
    ],
  },
];

// ── lessons ──

const seriesLesson: Lesson = {
  id: 'monitoring.series',
  block: 'monitoring',
  title: bi('Метрики, ряды, метки и опрос сервисов', 'Metrics, series, labels and the scrape'),
  summary: bi('Метрика состоит не из одного числа, а из множества рядов, по одному на каждую комбинацию меток. Prometheus сам забирает эти ряды у сервисов.', 'A metric is not one number but a set of series, one per label combination. Prometheus fetches these series from the services itself.'),
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
        'Клиент пишет в поддержку: «У вас не оформляется заказ». Выходит, что команда узнала о поломке последней, позже своих клиентов, и теперь ещё час будет гадать, что сломалось. Мониторинг нужен для того, чтобы узнавать о беде раньше клиента и сразу видеть, где её искать. В этом уроке вы узнаете, из чего он складывается: какие числа считает сервис, как они попадают в Prometheus и как их потом найти.',
        'A customer writes to support: “I cannot place an order.” So the team learned about the breakage last, after its customers, and will now spend another hour guessing what broke. Monitoring is there to learn about trouble before the customer does and to see at once where to look for it. In this lesson you will learn what it is made of: which numbers a service counts, how they get into Prometheus and how to find them later.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Сервис ведёт счёт событиям у себя в памяти, и каждый обработанный запрос увеличивает счётчик на единицу. У счётчика есть имя, например `http_requests_total`, и [[obs.label|метки]], то есть пары «ключ=значение», которые уточняют, *какой* это был запрос: `route="/checkout"`, `code="500"`, `instance="api-1:8080"`.\n\nКаждое сочетание имени и значений меток хранится отдельно и составляет [[obs.series|временной ряд]], свою ленту значений с отметками времени. Одно такое значение вместе с его временем называют сэмплом. Поэтому метрика состоит не из одного числа, а из множества рядов. Если у `http_requests_total` четыре маршрута, два кода ответа и три экземпляра сервиса, то рядов у неё 4 × 2 × 3, то есть 24. Число рядов называют [[obs.cardinality|кардинальностью]], и от него больше всего зависит, сколько памяти займёт мониторинг. Метка `user_id` с двумястами тысячами значений умножила бы число рядов в двести тысяч раз. Отсюда следует правило, что метка нужна для того, по чему вы будете группировать ряды, а не для того, чтобы отличать каждый объект.\n\n### Какие бывают метрики\n\nОт типа метрики зависит, какие вопросы ей можно задавать. [[obs.counter|Counter]], то есть счётчик, только растёт, и так считают запросы, ошибки и отправленные байты. После перезапуска процесса счётчик начинается с нуля, поэтому его значение само по себе мало что говорит, и смотрят на то, как быстро он растёт. [[obs.gauge|Gauge]] может и расти, и уменьшаться, и так показывают число занятых соединений в пуле, то есть в наборе заранее открытых соединений с базой данных, а также свободную память и длину очереди. Значение gauge отвечает на вопрос само по себе. Для распределений, например для того, сколько длились запросы, есть отдельный тип, и о нём будет отдельный урок.\n\n### Как Prometheus собирает метрики\n\nPrometheus сам приходит к сервисам за данными. Каждый сервис показывает на странице `/metrics` текущие значения своих метрик в текстовом виде, а Prometheus по расписанию, обычно раз в 15 секунд, забирает эту страницу. Такой опрос называется [[obs.scrape|scrape]], а сама модель, в которой мониторинг забирает данные у сервисов, называется pull. Список сервисов, которые нужно опрашивать (их называют целями), записан в файле `prometheus.yml`. Для каждой цели Prometheus сам ведёт ряд `up`, в котором значение 1 означает, что цель ответила, а значение 0 означает, что не ответила. С этого ряда начинается любой разбор неполадки, потому что сначала нужно убедиться, что данные к вам поступают.',
        'A service keeps count of events in its own memory, and every request it handles adds one to a counter. The counter has a name, for example `http_requests_total`, and [[obs.label|labels]], key=value pairs that say *which* request it was: `route="/checkout"`, `code="500"`, `instance="api-1:8080"`.\n\nEvery combination of the name and label values is stored separately and makes up a [[obs.series|time series]], its own strip of values with timestamps. One such value with its time is called a sample. So a metric is not one number but a set of series. If `http_requests_total` has four routes, two status codes and three service instances, it has 4 × 2 × 3, that is 24, series. The number of series is called [[obs.cardinality|cardinality]], and it decides most of how much memory monitoring takes. A `user_id` label with two hundred thousand values would multiply the series count by two hundred thousand. Hence the rule that a label is for what you will group series by, not for telling every object apart.\n\n### Kinds of metrics\n\nThe type of a metric decides which questions you can ask of it. A [[obs.counter|counter]] only grows, and requests, errors and bytes sent are counted this way. After the process restarts the counter starts from zero, so its value says little by itself, and you look at how fast it grows. A [[obs.gauge|gauge]] can both grow and shrink, and pool connections in use, free memory and queue length are shown this way. The value of a gauge answers the question by itself. Distributions, such as how long requests took, have a type of their own, with a lesson of its own.\n\n### How Prometheus collects metrics\n\nPrometheus comes to the services for the data itself. Every service shows the current values of its metrics as text on a `/metrics` page, and Prometheus fetches that page on a schedule, usually every 15 seconds. Such a poll is called a [[obs.scrape|scrape]], and the model in which monitoring fetches data from services is called pull. The list of services to poll (they are called targets) is written in `prometheus.yml`. For every target Prometheus keeps the `up` series itself, in which the value 1 means the target answered, 0 means it did not. Any investigation starts from this series, because first you have to make sure the data is reaching you.',
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
          { id: 'up', prompt: bi('Покажите ряд up только для целей с меткой job="api".', 'Show the up series only for the targets labelled job="api".'), test: (r) => vecOf(r).length === 3 && vecOf(r).every((s) => s.labels.job === 'api' && s.labels.__name__ === 'up'), then: bi('У сервиса api три экземпляра, и у всех up равен 1, значит, данные поступают.', 'The api service has three instances, and up is 1 for all of them, so the data is coming in.') },
          { id: 'one', prompt: bi('Откройте вкладку «Цели (/metrics)», посмотрите, какие ряды отдаёт экземпляр api-1:8080, и выберите запросом все его ряды http_requests_total. Сколько их получилось?', 'Open the “Targets (/metrics)” tab, look at the series the instance api-1:8080 serves, and select all its http_requests_total series with a query. How many are there?'), test: (r) => vecOf(r).length === 8 && vecOf(r).every((s) => s.labels.instance === 'api-1:8080' && s.labels.__name__ === 'http_requests_total'), then: bi('Получилось 8 рядов, потому что четыре маршрута умножаются на два кода ответа. На все три экземпляра приходится 24 ряда.', 'There are 8 series, because four routes are multiplied by two status codes. All three instances together have 24.') },
          { id: 'gauge', prompt: bi('Покажите, сколько соединений с базой данных занято сейчас в пуле каждого экземпляра api.', 'Show how many database connections are in use now in the pool of each api instance.'), test: (r) => vecOf(r).length === 3 && vecOf(r).every((s) => s.labels.__name__ === 'db_connections_in_use'), then: bi('Метрика занятых соединений относится к типу gauge, поэтому её значение само отвечает на вопрос, и считать скорость не нужно.', 'This metric is a gauge, so its value answers the question by itself and there is no need to compute a rate.') },
        ],
      } satisfies WorkbenchProps,
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['obs.q.series', 'obs.q.cardinality', 'obs.q.types', 'obs.q.pull'] },
  ],
};

const promqlLesson: Lesson = {
  id: 'monitoring.promql',
  block: 'monitoring',
  title: bi('Запросы PromQL: выбрать ряды, посчитать скорость и сложить', 'PromQL queries: select series, compute a rate, add up'),
  summary: bi('Запрос PromQL начинается с выбора рядов. Счётчик читают через скорость его роста за окно, а лишние метки убирает агрегация.', 'A PromQL query starts by selecting series. A counter is read through its growth rate over a window, and aggregation removes the labels you do not need.'),
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
        'Дашборд магазина, то есть страница с графиками его главных показателей, должен показывать, сколько запросов в секунду получает каждый маршрут и какая их доля заканчивается ошибкой. Все нужные числа уже лежат в Prometheus, а достают их запросами на языке PromQL.\n\nЗапрос начинается с [[obs.selector|селектора]], то есть с имени метрики и условий на метки. Селектор `http_requests_total{job="api", code="500"}` выбирает ряды, у которых значения меток в точности совпадают с указанными. Оператор `!=` означает «не равно», а операторы `=~` и `!~` сравнивают значение метки с регулярным выражением, и, например, условие `code=~"5.."` выбирает все коды ответа от 500 до 599. Такой запрос возвращает мгновенный вектор (*instant vector*), то есть по одному последнему значению каждого подошедшего ряда на момент запроса. Если последнее значение ряда старше пяти минут, ряд в ответ не попадёт.\n\nСчётчик сам по себе отвечает на вопрос, сколько событий было всего с момента запуска. Чтобы узнать, сколько их происходит в секунду сейчас, берут окно. Запрос `http_requests_total[5m]` возвращает вектор диапазона (*range vector*), то есть все сэмплы каждого ряда за последние пять минут; сэмпл, снятый ровно пять минут назад, в окно уже не входит. Функция [[obs.rate|rate]] считает по этим сэмплам среднюю скорость роста в секунду и сама учитывает, что после перезапуска процесса счётчик начался с нуля: `rate(http_requests_total[5m])`. Функция `increase` возвращает прирост за всё окно, то есть скорость, умноженную на длину окна. Функция `irate` считает скорость только по двум последним сэмплам, поэтому её линия сильно скачет и годится разве что для графиков. Скорость можно посчитать, только если в окне есть хотя бы два сэмпла, поэтому окно берут не короче четырёх интервалов опроса.\n\nРядов в ответе обычно больше, чем нужно. На вопрос, сколько запросов в секунду получает каждый маршрут, запрос `rate(...)` вернёт 24 ряда, по одному на каждое сочетание маршрута, кода и экземпляра. [[obs.aggregation|Агрегация]] сводит их в меньшее число: запрос `sum by (route) (rate(http_requests_total{job="api"}[5m]))` складывает ряды с одинаковым маршрутом, а все остальные метки отбрасывает. Слово `without (instance)` действует наоборот и отбрасывает только перечисленные метки. Порядок здесь важен, и сначала считают `rate`, а потом `sum`, потому что после сложения сброс одного счётчика уже не отличить от падения трафика.\n\nВекторы можно делить друг на друга, и Prometheus при этом сопоставляет ряды с одинаковыми метками. Так считают долю ошибок: `sum(rate(...{code=~"5.."}[5m])) / sum(rate(...[5m]))`.',
        'The shop dashboard has to show how many requests per second each route gets and what share of them ends in an error. All the numbers needed are already in Prometheus, and you get them out with queries in PromQL.\n\nA query starts with a [[obs.selector|selector]]: a metric name and conditions on labels. The selector `http_requests_total{job="api", code="500"}` selects the series whose label values match the given ones exactly. The operator `!=` means “not equal”, and the operators `=~` and `!~` compare a label value with a regular expression, and, for example, the condition `code=~"5.."` selects every status code from 500 to 599. Such a query returns an *instant vector*: one latest value of each matching series at the moment of the query. If a series’ latest value is older than five minutes, the series does not get into the answer.\n\nA counter by itself answers how many events there were in total since start. To learn how many happen per second now, you take a window. The query `http_requests_total[5m]` returns a *range vector*: every sample of each series over the last five minutes; a sample taken exactly five minutes ago is already outside the window. The [[obs.rate|rate]] function computes the average per-second growth from these samples and handles by itself the fact that the counter started from zero after a process restart: `rate(http_requests_total[5m])`. The `increase` function returns the growth over the whole window, that is, the rate times the window length. The `irate` function computes the rate from the last two samples only, so its line jumps about a lot and is fit for graphs at most. A rate can be computed only if the window holds at least two samples, so the window is taken at least four scrape intervals long.\n\nAn answer usually has more series than you need. Asked how many requests per second each route gets, `rate(...)` returns 24 series, one per combination of route, code and instance. [[obs.aggregation|Aggregation]] folds them into fewer: `sum by (route) (rate(http_requests_total{job="api"}[5m]))` adds up the series with the same route and drops all the other labels. `without (instance)` works the other way round and drops only the listed labels. The order matters here, and `rate` comes first and `sum` second, because after adding up, one counter’s reset cannot be told from a drop in traffic.\n\nVectors can be divided by each other, and Prometheus then matches series with the same labels. That is how the error share is computed: `sum(rate(...{code=~"5.."}[5m])) / sum(rate(...[5m]))`.',
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
          { id: 'rate', prompt: bi('Выполните этот запрос и откройте вкладку «График». В середине линия падает до нуля, потому что экземпляр api-2 перезапускался и его счётчик начался заново. Теперь постройте скорость роста этого ряда за пять минут; на графике скорости провала быть не должно.', 'Run this query and open the Graph tab. In the middle the line drops to zero, because the instance api-2 restarted and its counter started over. Now build the growth rate of this series over five minutes; the rate graph must have no dip.'), reference: 'rate(http_requests_total{job="api", instance="api-2:8080", route="/cart", code="200"}[5m])', then: bi('Функция rate сама находит сброс счётчика и не принимает его за падение трафика.', 'rate finds the counter reset by itself and does not take it for a drop in traffic.') },
          { id: 'by-route', prompt: bi('Сколько запросов в секунду получает api на каждом маршруте, если сложить все экземпляры и все коды ответа?', 'How many requests per second does api get on each route, adding up all instances and all status codes?'), reference: 'sum by (route) (rate(http_requests_total{job="api"}[5m]))', then: bi('Получилось четыре ряда, по одному на маршрут, а метки instance, code и method исчезли при сложении.', 'You got four series, one per route, and the instance, code and method labels vanished in the sum.') },
          { id: 'errors', prompt: bi('Какая доля запросов ко всему сервису api за последние пять минут закончилась ошибкой 5xx?', 'What share of requests to the whole api service over the last five minutes ended in a 5xx error?'), reference: 'sum(rate(http_requests_total{job="api",code=~"5.."}[5m])) / sum(rate(http_requests_total{job="api"}[5m]))', hint: bi('Разделите сумму скоростей ошибочных ответов на сумму скоростей всех ответов.', 'Divide the sum of the rates of error answers by the sum of the rates of all answers.') },
          { id: 'cpu', prompt: bi('Какую долю времени процессоры каждого узла заняты работой, а не простаивают в режиме idle?', 'What share of the time are the CPUs of each node busy with work rather than idle?'), reference: '1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))', hint: bi('Счётчик node_cpu_seconds_total считает секунды, проведённые ядром в каждом режиме. Скорость его роста в режиме idle показывает, какую долю каждой секунды ядро простаивало. Занятость равна единице минус среднее значение этой доли по всем ядрам узла.', 'The node_cpu_seconds_total counter counts the seconds a core spent in each mode. Its growth rate in idle mode shows what share of each second the core stood idle. Busy time is one minus the average of that share over all cores of the node.') },
        ],
      } satisfies WorkbenchProps,
    },
    {
      id: 'findfn',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Сервис кэша `cache` должны были поставить на мониторинг, но забыли. Чтобы такое замечали сразу, нужна функция PromQL, которая возвращает 1, когда нет ни одного подходящего ряда. Найдите её в справочнике функций и выполните для `up{job="cache"}` командой `promtool query instant http://localhost:9090 …`.', 'The `cache` service should have been put under monitoring but was forgotten. To notice such things at once you need a PromQL function that returns 1 when there are no matching series at all. Find it in the function reference and run it for `up{job="cache"}` with `promtool query instant http://localhost:9090 …`.'),
      ref: { page: 'web/prometheus.io/querying/functions', anchor: 'absent', line: 'no elements' },
      terminal: {
        setup: { cwd: '~/mon', ext: { prom: { incident: 'none' } } },
        task: { id: 'absent', prompt: bi('Запрос вернул строку {job="cache"} => 1.', 'The query returned the line {job="cache"} => 1.'), check: { stdout: /\{job="cache"\} => 1 @/ }, docStep: 3, chips: 'promtool query instant http://localhost:9090', hints: { H1: bi('Функция называется английским словом, которое значит «отсутствующий».', 'The function is named with the English word for “absent”.') } },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['obs.q.raw-counter', 'obs.q.rate-order', 'obs.q.window'] },
  ],
};

const histLesson: Lesson = {
  id: 'monitoring.histogram',
  block: 'monitoring',
  title: bi('Гистограммы и квантили', 'Histograms and quantiles'),
  summary: bi('Сколько длятся самые медленные запросы, показывает квантиль. Его считают по сложенным бакетам гистограммы, а готовые квантили отдельных экземпляров не усредняют.', 'A quantile shows how long the slowest requests take. It is computed from summed histogram buckets, and the ready quantiles of separate instances are not averaged.'),
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
        'Среднее время ответа обманывает. Если 99 запросов выполнились за 50 мс, а один шёл 10 секунд, среднее получится около 150 мс, и проблему никто не заметит. Зато её заметит пользователь, который ждал 10 секунд, потому что люди чувствуют не среднее, а самые медленные запросы, «хвост» распределения. Время ответа называют латентностью, а хвост описывает [[obs.quantile|квантиль]]. Если p99 равен 0,8 с, значит, 99 % запросов выполнились быстрее 0,8 секунды, а самый медленный процент запросов шёл дольше.\n\nЧтобы квантиль можно было посчитать, сервис ведёт [[obs.histogram|гистограмму]]. Гистограмма состоит из набора счётчиков, которые называют бакетами, с меткой `le`, сокращением от less or equal, «меньше или равно». Бакет `http_request_duration_seconds_bucket{le="0.1"}` считает, сколько запросов уложились в 0,1 с, бакет с `le="0.5"` считает, сколько уложились в 0,5 с, и так до бакета `le="+Inf"`, в который попадают все запросы. Каждый следующий бакет включает в себя все предыдущие. Рядом с бакетами сервис ведёт ещё два счётчика: `_count` с числом всех наблюдений и `_sum` с суммой их значений.\n\nКвантиль считает функция `histogram_quantile(0.99, …)`. Она находит бакет, в котором накопленная доля запросов переходит через 99 %, и оценивает значение внутри этого бакета, считая, что запросы распределены в нём равномерно. Поэтому точность квантиля зависит от того, какие границы выбраны для бакетов. Бакеты устроены как счётчики, так что сначала к ним применяют `rate`. Чтобы получить квантиль всего сервиса, бакеты разных экземпляров складывают, обязательно сохраняя метку `le`:\n\n```\nhistogram_quantile(0.99,\n  sum by (le) (rate(http_request_duration_seconds_bucket{job="api"}[5m])))\n```\n\nУсреднять квантили отдельных экземпляров нельзя, потому что экземпляр, который обработал десять запросов, повлиял бы на результат так же, как экземпляр, обработавший десять тысяч.',
        'The average response time deceives. If 99 requests finished in 50 ms and one took 10 seconds, the average comes out at about 150 ms and nobody notices the problem. The user who waited 10 seconds notices it, though, because people feel not the average but the slowest requests, the “tail” of the distribution. Response time is called latency, and a [[obs.quantile|quantile]] describes the tail. If p99 is 0.8 s, 99 % of requests finished faster than 0.8 seconds, and the slowest one percent took longer.\n\nTo make a quantile computable, the service keeps a [[obs.histogram|histogram]]. A histogram consists of a set of counters called buckets, with the label `le`, short for “less or equal”. The bucket `http_request_duration_seconds_bucket{le="0.1"}` counts how many requests fit into 0.1 s, the bucket with `le="0.5"` counts how many fit into 0.5 s, and so on up to the bucket `le="+Inf"`, which every request lands in. Each bucket includes all the previous ones. Next to the buckets the service keeps two more counters: `_count` with the number of all observations and `_sum` with the sum of their values.\n\nThe `histogram_quantile(0.99, …)` function computes the quantile. It finds the bucket in which the cumulative share of requests crosses 99 % and estimates the value inside that bucket, assuming requests are spread evenly in it. So the precision of a quantile depends on the bounds chosen for the buckets. Buckets are counters, so `rate` is applied to them first. To get the quantile of the whole service, the buckets of different instances are summed, always keeping the `le` label:\n\n```\nhistogram_quantile(0.99,\n  sum by (le) (rate(http_request_duration_seconds_bucket{job="api"}[5m])))\n```\n\nAveraging the quantiles of single instances is wrong, because an instance that handled ten requests would affect the result as much as one that handled ten thousand.',
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
          { id: 'p99-route', prompt: bi('Посчитайте p99 латентности api отдельно для каждого маршрута, сложив все экземпляры, по окну в пять минут.', 'Compute the p99 latency of api separately for each route, adding up all instances, over a five-minute window.'), reference: 'histogram_quantile(0.99, sum by (route, le) (rate(http_request_duration_seconds_bucket{job="api"}[5m])))', hint: bi('В скобках после by нужно перечислить и route, и le.', 'List both route and le in the brackets after by.') },
          { id: 'p50', prompt: bi('Теперь посчитайте медиану, то есть p50, для всего сервиса api.', 'Now compute the median, that is p50, for the whole api service.'), reference: 'histogram_quantile(0.5, sum by (le) (rate(http_request_duration_seconds_bucket{job="api"}[5m])))' },
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
  summary: bi('Алерт будит человека, поэтому его ставят на то, что чувствуют пользователи, и не дают ему срабатывать на коротких всплесках. Кому и как часто писать, решает Alertmanager.', 'An alert wakes a person up, so it is set on what users feel and kept from firing on short spikes. Alertmanager decides whom to message and how often.'),
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
        'Мониторинг полезен только тогда, когда о беде узнаёт человек, который может её исправить. Для этого в Prometheus пишут [[obs.alert-rule|правила алертов]]. Алертом называют автоматическое оповещение о неполадке, которое приходит дежурному. Правило алерта состоит из запроса PromQL с условием и записывается в файл правил, а Prometheus вычисляет его по расписанию, обычно раз в минуту. Пока запрос возвращает непустой результат меньше времени, указанного в поле `for`, алерт находится в состоянии **pending** и никуда не уходит. Если условие продержалось дольше, алерт переходит в состояние **firing**. Поле `for: 10m` отсеивает одиночные всплески, так что короткий пик ошибок никого не разбудит.\n\n```yaml\ngroups:\n  - name: api\n    rules:\n      - alert: ApiHighErrorRate\n        expr: <доля 5xx> > 0.02\n        for: 10m\n        labels:\n          severity: page\n```\n\nАлерт будит человека, поэтому его ставят на **симптом**, то есть на то, что чувствует пользователь, например на долю ошибок или на латентность. Причин у одного симптома бывает много (процессор, диск, сеть), и алерт на загрузку процессора в 80 % чаще всего будит людей зря. Проверить файл правил на ошибки можно командой `promtool check rules rules.yml`.\n\nСам Prometheus людям не пишет. Сработавшие алерты он передаёт в [[obs.alertmanager|Alertmanager]], а тот решает всё остальное. Дерево маршрутов `route` выбирает получателя по меткам алерта, и в нашем примере алерты с меткой `severity="page"` уходят на пейджер дежурного, а остальные на почту. Поиск идёт по маршрутам сверху вниз и останавливается на первом подошедшем, если у маршрута не указано `continue: true`. Параметр `group_by` собирает похожие алерты в одно сообщение, `repeat_interval` не даёт повторять это сообщение слишком часто, а правила `inhibit_rules` гасят алерты-следствия, когда сработал алерт о причине. Например, если сработал алерт `NodeDown`, отдельные алерты о каждом сервисе этого узла уже не нужны. Куда попадёт алерт, можно проверить и без настоящего алерта: `amtool config routes test --config.file=alertmanager.yml severity=page`.',
        'Monitoring is useful only when trouble reaches a person who can fix it. For that, [[obs.alert-rule|alerting rules]] are written for Prometheus. An alerting rule consists of a PromQL query with a condition and is written into a rule file, and Prometheus evaluates it on a schedule, usually once a minute. While the query has returned a non-empty result for less than the `for` field says, the alert is **pending** and goes nowhere. If the condition holds longer, the alert becomes **firing**. `for: 10m` filters out single spikes, so a short burst of errors wakes nobody.\n\n```yaml\ngroups:\n  - name: api\n    rules:\n      - alert: ApiHighErrorRate\n        expr: <5xx share> > 0.02\n        for: 10m\n        labels:\n          severity: page\n```\n\nAn alert wakes a person up, so it is set on a **symptom**, on what the user feels, such as the error share or the latency. One symptom can have many causes (CPU, disk, network), and an alert on CPU load at 80 % usually wakes people for nothing. `promtool check rules rules.yml` checks the rule file for errors.\n\nPrometheus does not message people itself. It passes firing alerts to [[obs.alertmanager|Alertmanager]], which decides everything else. The `route` tree picks the receiver by the alert labels, and in our example alerts labelled `severity="page"` go to the on-call pager, the rest to email. The search goes through the routes top-down and stops at the first match, unless the route sets `continue: true`. `group_by` gathers similar alerts into one message, `repeat_interval` keeps that message from repeating too often, and `inhibit_rules` mute consequence alerts once the cause alert fires. For example, if `NodeDown` fires, separate alerts about every service on that node are not needed. You can check where an alert goes without a real alert: `amtool config routes test --config.file=alertmanager.yml severity=page`.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как ошибка в сервисе доходит до дежурного', 'How an error in a service reaches the on-call engineer'),
      body: bi(
        'Схема ниже на одном случае показывает всё, о чём шла речь в этом уроке и в первом уроке блока. Сервис api начал отвечать ошибкой 500, и нужно, чтобы об этом узнал дежурный. Сначала на схеме только процесс api, а остальные участники появляются, когда до них доходит ошибка. В верхнем ряду стоят процесс, его страница /metrics и Prometheus, который эту страницу забирает. Во втором ряду справа хранилище рядов, а рядом с ним правило алерта. В нижнем ряду Alertmanager и, наконец, дежурный.',
        'The diagram below shows on one case everything this lesson and the first lesson of the block talked about. The api service has started answering with error 500, and the on-call engineer has to learn about it. At first the diagram shows only the api process; the other participants appear when the error reaches them. The top row holds the process, its /metrics page and Prometheus, which fetches that page. In the second row on the right is the series store, and next to it the alerting rule. The bottom row holds Alertmanager and, finally, the on-call engineer.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'obs.scrape-to-notify', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен тот участник, который работает сейчас, облачко рядом с ним полным предложением говорит, что он делает, а по линии движется карточка с тем, что он передаёт дальше, то есть со значением счётчика, алертом или сообщением. Жёлтая рамка у правила означает, что условие уже выполнено, но время for ещё не истекло (состояние pending), а красная рамка означает, что алерт сработал или что на этом шаге путь оборвался. Под схемой есть два счётчика. Первый показывает, сколько значений попадает в окно правила, а второй показывает, сколько секунд в худшем случае пройдёт от первой ошибки до сообщения.\n\nКогда пройдёте путь до конца, откройте «Параметры». В группе «Как Prometheus собирает данные» поставьте опрос раз в 60 секунд и окно в одну минуту, и схема покажет, почему правило перестало работать. В группе «Когда алерт срабатывает и уходит к людям» поставьте for на ноль и посмотрите, насколько раньше придёт сообщение и чем за это придётся заплатить. Напоследок включите в блоке «Сломать» по одной поломке. Сначала выберите ту, при которой процесс api перестаёт отвечать на запрос /metrics, а потом ту, при которой останавливается Alertmanager.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. At every step the participant working now is highlighted, the callout next to it says in a full sentence what it does, and a card moves along the line with what it hands on: a counter value, an alert, a message. A yellow outline on the rule means the condition already holds but `for` has not passed yet (the pending state), and a red outline means the alert fired or the path broke at this step. Under the diagram there are two counters. The first shows how many values fall into the rule’s window, and the second shows how many seconds pass in the worst case from the first error to the message.\n\nOnce you reach the end, open “Parameters”. In the group “How Prometheus collects the data” set the scrape to every 60 seconds and the window to one minute, and the diagram will show why the rule stopped working. In the group “When the alert fires and goes to people” set for to zero and see how much earlier the message arrives and what you pay for it. Finally, switch on the breaks in “Break it” one at a time. First choose the one in which the api process stops answering /metrics, then the one in which Alertmanager stops.'), caption: bi('Задержки, которые вы видели на схеме, есть у каждого настоящего алерта. Когда будете писать правило в задании ниже, прикиньте, через сколько минут после начала аварии оно разбудит дежурного, и проверьте, что окно rate не короче четырёх интервалов опроса.', 'The delays you saw in the diagram are there in every real alert. When you write the rule in the task below, estimate how many minutes after an outage starts it will wake the on-call engineer, and check that the rate window is at least four scrape intervals long.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: { cwd: '~/mon', files: [{ path: `${MON}/alertmanager.yml`, content: AM }, { path: `${MON}/rules.yml`, content: 'groups:\n  - name: api\n    rules: []\n' }], ext: { prom: { incident: 'checkout' } } },
      intro: bi('В каталоге `~/mon` лежат пустой файл правил `rules.yml` и настройки Alertmanager в файле `alertmanager.yml`. Учебный Prometheus хранит данные за последние три часа, и последние 45 минут с сервисом api что-то не так.', 'The `~/mon` directory holds an empty rule file `rules.yml` and the Alertmanager settings in `alertmanager.yml`. The training Prometheus keeps the data of the last three hours, and for the last 45 minutes something has been wrong with the api service.'),
      tasks: [
        {
          id: 'rule',
          prompt: bi('Напишите в файле `rules.yml` правило алерта `ApiHighErrorRate`. Алерт должен срабатывать, когда доля ответов 5xx у api, посчитанная за пять минут, держится выше 2 % в течение 10 минут, и нести метку `severity: page`. Проверьте файл командой `promtool check rules`. На сегодняшних данных алерт должен сработать, а в спокойный день молчать.', 'Write the alerting rule `ApiHighErrorRate` into `rules.yml`. The alert must fire when the api 5xx share, computed over five minutes, stays above 2 % for 10 minutes, and carry the label `severity: page`. Check the file with `promtool check rules`. The alert must fire on today’s data and stay silent on a quiet day.'),
          check: {
            when: (f: Facts) => {
              const text = f.files[`${MON}/rules.yml`]?.text ?? '';
              const { groups } = parseRules(text, 'rules.yml');
              const rule = groups.flatMap((g) => g.rules).find((r) => r.alert === 'ApiHighErrorRate');
              return !!rule && rule.for === 10 * 60_000 && rule.labels.severity === 'page' && rulesFire(text, 'checkout') === true && rulesFire(text, 'none') === false;
            },
            fail: [
              { if: (f: Facts) => parseRules(f.files[`${MON}/rules.yml`]?.text ?? '', 'rules.yml').errors.length > 0, say: bi('В файле есть ошибка. Запустите `promtool check rules rules.yml` и прочитайте строку, на которую он указывает.', 'The file has an error. Run `promtool check rules rules.yml` and read the line it points to.') },
              { if: (f: Facts) => rulesFire(f.files[`${MON}/rules.yml`]?.text ?? '', 'none') === true, say: bi('Правило срабатывает и в спокойный день. Значит, либо порог слишком низкий, либо выражение считает не долю ошибок.', 'The rule fires on a quiet day too. So either the threshold is too low or the expression does not compute the error share.') },
            ],
          },
          chips: 'promtool check rules rules.yml',
          concepts: ['obs.alert-rule'],
          docRef: { page: 'web/prometheus.io/alerting/rules', anchor: 'defining', line: 'for: 10m' },
          hints: { H1: bi('В выражении нужна доля ошибок, которую вы считали в уроке о запросах PromQL, и сравнение с порогом `> 0.02`.', 'The expression needs the error share you computed in the lesson on PromQL queries and a comparison with the threshold `> 0.02`.'), H2: bi(`\`\`\`yaml\n${RULE_HINT}\`\`\``, `\`\`\`yaml\n${RULE_HINT}\`\`\``) },
        },
        {
          id: 'route',
          prompt: bi('Сделайте так, чтобы алерты с метками `team="cafe"` и `severity="warning"` уходили получателю `team-chat`, а все остальные шли туда же, куда и раньше. Проверьте маршруты командой `amtool`.', 'Make alerts with the labels `team="cafe"` and `severity="warning"` go to the `team-chat` receiver, while all the others go where they went before. Check the routes with `amtool`.'),
          check: {
            when: (f: Facts) => {
              const { config } = parseAm(f.files[`${MON}/alertmanager.yml`]?.text ?? '');
              if (!config) return false;
              return routeAlert(config, { team: 'cafe', severity: 'warning' }).receivers.join() === 'team-chat' && routeAlert(config, { severity: 'page' }).receivers.join() === 'pager' && routeAlert(config, { team: 'web', severity: 'warning' }).receivers.join() === 'email';
            },
            fail: [{ if: (f: Facts) => !parseAm(f.files[`${MON}/alertmanager.yml`]?.text ?? '').config, say: bi('Команда `amtool check-config` не принимает файл. Проверьте отступы и имена получателей.', '`amtool check-config` rejects the file. Check the indentation and the receiver names.') }],
          },
          chips: 'amtool config routes test --config.file=alertmanager.yml team=cafe severity=warning',
          concepts: ['obs.alertmanager'],
          hints: { H1: bi('Добавьте в список `routes` ещё один маршрут с двумя условиями в `matchers`.', 'Add one more route with two conditions in `matchers` to the `routes` list.'), H2: bi('```yaml\n    - matchers: [team="cafe", severity="warning"]\n      receiver: team-chat\n```', '```yaml\n    - matchers: [team="cafe", severity="warning"]\n      receiver: team-chat\n```') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Дашборд соседней команды ищет экземпляр сервиса не в метке `instance`, а в метке `host`. Выведите ряды `up{job="api"}` так, чтобы у каждого появилась метка `host` с тем же значением, что и у `instance`. В уроке такой функции не было, поэтому найдите её в справочнике функций и выполните запрос командой `promtool query instant http://localhost:9090 …`.', 'Another team’s dashboard looks for the service instance not in the `instance` label but in `host`. Print the `up{job="api"}` series so that each gets a `host` label with the same value as `instance`. The lesson did not show this function, so find it in the function reference and run the query with `promtool query instant http://localhost:9090 …`.'),
      ref: { page: 'web/prometheus.io/querying/functions' },
      terminal: {
        setup: { cwd: '~/mon', ext: { prom: { incident: 'none' } } },
        task: { id: 'relabel', prompt: bi('У каждого ряда up{job="api"} появилась метка host="api-N:8080".', 'Every up{job="api"} series got the label host="api-N:8080".'), check: { stdout: /host="api-1:8080"[\s\S]*host="api-2:8080"[\s\S]*host="api-3:8080"/ }, docStep: 4, beyond: true, solutionTokens: ['label_replace'] },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['obs.q.for', 'obs.q.symptom', 'obs.q.route'] },
  ],
};

const incidentLesson: Lesson = {
  id: 'monitoring.incident',
  block: 'monitoring',
  title: bi('Как найти причину, по которой выросла латентность', 'How to find why latency went up'),
  summary: bi('Каждое утверждение о причине аварии подтверждают запросом. Сначала сервис восстанавливают, а разбираются потом.', 'Every statement about the cause of an outage is backed by a query. The service is restored first, and the investigation comes after.'),
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
        'Когда приходит алерт, первым делом хочется угадать причину. Но разбор идёт по другому правилу, и каждую догадку проверяют запросом, и результат запроса либо подтверждает её, либо опровергает.\n\nНачинают с того, что чувствует пользователь, то есть с трёх метрик сервиса по [[obs.red|методу RED]]: сколько запросов в секунду он получает (**Rate**), какая их доля заканчивается ошибкой (**Errors**) и сколько они длятся (**Duration**, квантили латентности). Потом поиск сужают и выясняют, по какой метке видно отклонение: по маршруту, по экземпляру или по версии. Если болен один экземпляр, смотрят на его узел. Если больны все экземпляры, но только на одном маршруте, выясняют, чем этот маршрут отличается от остальных и что в нём недавно менялось. Для ресурсов, таких как пул соединений, процессор или диск, похожие вопросы задаёт [[obs.use|метод USE]]: насколько ресурс занят (Utilization), сколько работы ждёт его в очереди (Saturation) и были ли ошибки (Errors).\n\nГлавное правило дежурного требует сначала восстановить сервис, например откатить выпуск или переключить трафик, и только потом разбираться до конца. Время восстановления после неудачной выкладки входит в число метрик DORA, а откат почти всегда быстрее, чем исправление.',
        'When an alert arrives, the first urge is to guess the cause. But an investigation follows another rule, and every guess is checked with a query, and the query result either confirms it or disproves it.\n\nYou start from what the user feels, that is, from the three metrics of the service by the [[obs.red|RED method]]: how many requests per second it gets (**Rate**), what share of them ends in an error (**Errors**) and how long they take (**Duration**, the latency quantiles). Then you narrow the search and find out along which label the deviation shows: route, instance or version. If one instance is sick, you look at its node. If all instances are sick but only on one route, you find out how that route differs from the others and what changed in it lately. For resources such as a connection pool, a CPU or a disk, similar questions are asked by the [[obs.use|USE method]]: how busy the resource is (Utilization), how much work waits for it in a queue (Saturation) and whether there were errors (Errors).\n\nThe main rule of the on-call engineer is to restore the service first, for example roll back the release or shift traffic, and only then investigate to the end. Time to restore after a failed deployment is one of the DORA metrics, and a rollback is almost always faster than a fix.',
      ),
    },
    {
      id: 'drill',
      kind: 'widget',
      step: 'practice',
      widget: 'obs.workbench',
      props: {
        incident: 'checkout',
        alert: { name: 'HighLatencyP99', summary: bi('p99 латентности api выше 1 с уже 10 минут.', 'The api p99 latency has been above 1 s for 10 minutes.'), labels: { service: 'api', severity: 'page' } },
        query: 'histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{job="api"}[5m])))',
        goals: [
          { id: 'route', prompt: bi('Сначала проверьте, медленно работает весь сервис или что-то одно. Покажите p99 латентности api по маршрутам.', 'First check whether the whole service is slow or one thing in it. Show the api p99 latency by route.'), test: (r) => { const v = vecOf(r); const c = v.find((s) => s.labels.route === '/checkout')?.value ?? 0; const others = v.filter((s) => s.labels.route !== '/checkout').map((s) => s.value); return v.length >= 4 && others.length > 0 && v.every((s) => !s.labels.instance) && c > 3 * Math.max(...others); }, then: bi('Медленно работает только маршрут /checkout, у остальных маршрутов время ответа обычное.', 'Only the /checkout route is slow; the other routes answer in their usual time.') },
          { id: 'instance', prompt: bi('Теперь проверьте догадку, что болен один экземпляр. Покажите p99 маршрута /checkout отдельно для каждого экземпляра.', 'Now check the guess that one instance is sick. Show the /checkout p99 separately for each instance.'), test: (r) => { const v = vecOf(r); return v.length === 3 && v.every((s) => !!s.labels.instance && s.value > 1); }, then: bi('Все три экземпляра одинаково медленные, значит, дело не в одном узле.', 'All three instances are equally slow, so it is not one node.') },
          { id: 'traffic', prompt: bi('Проверьте догадку, что выросла нагрузка. Одним запросом разделите число запросов в секунду к api сейчас на то же число час назад. Сдвинуть выражение на час в прошлое помогает модификатор offset.', 'Check the guess that the load went up. In one query, divide the requests per second to api now by the same number an hour ago. The offset modifier shifts an expression an hour into the past.'), test: (r, q) => /offset/.test(q) && vecOf(r).length === 1 && vecOf(r)[0].value > 0.6 && vecOf(r)[0].value < 1.4, then: bi('Отношение близко к единице, значит, трафик почти не изменился и нагрузка не виновата.', 'The ratio is close to one, so traffic has hardly changed and the load is not to blame.') },
          { id: 'pool', prompt: bi('Проверьте ресурс. Какая доля соединений с базой данных в пуле каждого экземпляра api сейчас занята?', 'Check a resource. What share of the database connections in the pool of each api instance is in use now?'), test: (r) => vecOf(r).length === 3 && vecOf(r).every((s) => s.value >= 0.95 && s.value <= 1), then: bi('Пул занят полностью, поэтому запросы стоят в очереди и ждут свободного соединения.', 'The pool is fully used, so requests queue up and wait for a free connection.') },
          { id: 'version', prompt: bi('Осталось выяснить, что менялось. Какие версии api сейчас работают? Их показывает метрика app_build_info.', 'It remains to find out what changed. Which api versions are running now? The app_build_info metric shows them.'), test: (r) => vecOf(r).some((s) => s.labels.version === '2.3.1'), then: bi('Работает версия 2.3.1, которую выложили за три минуты до того, как выросла латентность. Новая версия делает отдельный запрос к базе на каждый товар корзины, поэтому соединения в пуле кончаются и маршрут /checkout ждёт. Сначала нужно откатить сервис на версию 2.3.0, а разбираться уже потом.', 'Version 2.3.1 is running; it was rolled out three minutes before latency grew. The new version makes a separate database query for every cart item, so the pool runs out of connections and /checkout waits. First roll the service back to 2.3.0, and investigate afterwards.') },
        ],
      } satisfies WorkbenchProps,
    },
    {
      id: 'post',
      kind: 'callout',
      tone: 'note',
      title: bi('После отката', 'After the rollback'),
      body: bi('После отката команда разбирает инцидент, не выискивая виноватых. В разборе записывают хронологию событий, которую можно восстановить по вашим запросам, и влияние на пользователей, то есть долю неудачных запросов за время инцидента (её считают через `increase` по ответам 5xx). Ещё записывают причину и действия, которые не дадут аварии повториться: тест в CI, который считает запросы к базе, алерт на заполнение пула и постепенную выкладку новой версии сначала на часть пользователей (canary). Главный вопрос разбора звучит не «кто виноват», а «почему система позволила этому случиться».', 'After the rollback the team reviews the incident without looking for someone to blame. The review records the timeline of events, which your queries let you rebuild, and the impact on users, that is, the share of failed requests during the incident (it is computed with `increase` over the 5xx answers). It also records the cause and the actions that will keep the outage from happening again: a CI test that counts database queries, an alert on the pool filling up and a gradual rollout of a new version to a part of the users first (canary). The main question of the review is not “who is to blame” but “why did the system let this happen”.'),
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
    task: { id: 'p1', prompt: bi('Командой `promtool query instant http://localhost:9090` выведите, сколько запросов в секунду получает api на каждом маршруте.', 'With `promtool query instant http://localhost:9090` print how many requests per second api gets on each route.'), check: { stdout: /^\{route="\/[^"]*"\} => [\d.]+ @[\s\S]*\{route=[\s\S]*\{route=[\s\S]*\{route=/ } },
  },
  { id: 'monitoring.place.quantile', level: 'experienced', key: true, concepts: ['obs.quantile'], kind: 'quiz', item: { ...(quiz.find((q) => q.id === 'obs.q.avg-quantile') as QuizItem), id: 'monitoring.place.q.quantile' } },
  { id: 'monitoring.place.symptom', level: 'experienced', key: true, concepts: ['obs.alert-rule'], kind: 'quiz', item: { ...(quiz.find((q) => q.id === 'obs.q.symptom') as QuizItem), id: 'monitoring.place.q.symptom' } },
];

export const block: Block = {
  id: 'monitoring',
  order: 100,
  title: bi('Мониторинг', 'Monitoring'),
  summary: bi('Как узнавать об авариях раньше пользователей и быстро находить их причину. Вы научитесь читать временные ряды и метки, писать запросы PromQL со скоростями, агрегацией и квантилями, ставить алерты и настраивать Alertmanager, разбирать инцидент по метрикам, искать по журналам на языке LogQL, читать трейсы и следить за подами в Kubernetes по методу USE.', 'How to learn about outages before users do and find their cause quickly. You will learn to read time series and labels, write PromQL queries with rates, aggregation and quantiles, set alerts and configure Alertmanager, investigate an incident with metrics, search logs with LogQL, read traces and watch pods in Kubernetes by the USE method.'),
  checklistStep: '07',
  levels: {
    beginner: bi('Ни разу не видел дашбордов мониторинга', 'Has never seen a monitoring dashboard'),
    intermediate: bi('Смотрел на готовые дашборды', 'Has looked at ready-made dashboards'),
    experienced: bi('Писал алерты или запросы PromQL, работал с Zabbix', 'Has written alerts or PromQL queries, worked with Zabbix'),
  },
  hours: { beginner: 24, intermediate: 16, experienced: 9 },
  lessons: lessons.map((l) => l.id),
  sources: src([S.promOverview, S.functions, S.am], [S.ruPrometheus, S.ruSre]),
  docSources: ['prometheus.io', 'help'],
  placement,
};
