// The second half of the Monitoring block (06 §7.3 C14, C14b, C16): logs and
// LogQL, traces and context propagation, Kubernetes as a source of metrics
// (kube-state-metrics, cAdvisor, USE for containers), and the block exam.

import { bi } from '../../core/i18n';
import type { Concept, Exam, Facts, Lesson, PlacementTask, QuizItem, TerminalSetup } from '../../core/types';
import { MON, src, vecOf } from './content';
import { dataset, NOW, type Incident } from './prom/data';
import { evalRule, parseRules } from './prom/alerts';
import { logDataset } from './logs/data';
import { flatEntries, runLogQL, type LogResult } from './logs/logql';
import type { LogsProps, TracesProps } from './logs/widgets';
import type { WorkbenchProps } from './workbench';

const S = {
  logql: { title: 'Grafana Loki — LogQL: Log query language', url: 'https://grafana.com/docs/loki/latest/query/' },
  lokiLabels: { title: 'Grafana Loki — Understand labels', url: 'https://grafana.com/docs/loki/latest/get-started/labels/' },
  lokiArch: { title: 'Grafana Loki — Architecture', url: 'https://grafana.com/docs/loki/latest/get-started/architecture/' },
  k8sLogging: { title: 'Kubernetes — Logging Architecture', url: 'https://kubernetes.io/docs/concepts/cluster-administration/logging/' },
  otelTraces: { title: 'OpenTelemetry — Traces', url: 'https://opentelemetry.io/docs/concepts/signals/traces/' },
  otelContext: { title: 'OpenTelemetry — Context propagation', url: 'https://opentelemetry.io/docs/concepts/context-propagation/' },
  otelSampling: { title: 'OpenTelemetry — Sampling', url: 'https://opentelemetry.io/docs/concepts/sampling/' },
  w3c: { title: 'W3C — Trace Context', url: 'https://www.w3.org/TR/trace-context/' },
  ksm: { title: 'kube-state-metrics — documentation', url: 'https://github.com/kubernetes/kube-state-metrics/tree/main/docs' },
  k8sMetrics: { title: 'Kubernetes — Resource metrics pipeline', url: 'https://kubernetes.io/docs/tasks/debug/debug-cluster/resource-metrics-pipeline/' },
  cgroupv2: { title: 'Linux kernel — Control Group v2', url: 'https://docs.kernel.org/admin-guide/cgroup-v2.html' },
  use: { title: 'Brendan Gregg — The USE Method', url: 'https://www.brendangregg.com/usemethod.html' },
  ruLogs: { title: 'Kubernetes — Архитектура логирования (документация на русском)', url: 'https://kubernetes.io/ru/docs/concepts/cluster-administration/logging/' },
  ruLoki: { title: 'Хабр — Grafana Loki: как устроено хранение логов', url: 'https://habr.com/ru/companies/otus/articles/487118/' },
  ruTracing: { title: 'Хабр — Распределённая трассировка: от теории к практике с OpenTelemetry', url: 'https://habr.com/ru/companies/otus/articles/710358/' },
  ruOtel: { title: 'Yandex Cloud — Трассировка с помощью OpenTelemetry', url: 'https://yandex.cloud/ru/docs/tutorials/serverless/opentelemetry' },
  ruK8sMon: { title: 'Kubernetes — Конвейер метрик ресурсов (документация на русском)', url: 'https://kubernetes.io/ru/docs/tasks/debug/debug-cluster/resource-metrics-pipeline/' },
  ruCgroups: { title: 'Хабр — cgroups v2: ограничение ресурсов в Linux', url: 'https://habr.com/ru/companies/selectel/articles/303190/' },
};

export const concepts2: Concept[] = [
  { id: 'obs.structured-log', term: bi('структурированный журнал', 'structured log'), forms: { ru: ['структурированного журнала', 'структурированные журналы', 'структурированных журналов', 'структурированным журналом'], en: ['structured logs', 'structured logging'] }, short: bi('Журнал, в котором каждое событие — строка с именованными полями (JSON, logfmt), а не свободный текст.', 'A log in which every event is a line with named fields (JSON, logfmt), not free text.'), introducedIn: 'monitoring.logs' },
  { id: 'obs.log-stream', term: bi('поток журнала', 'log stream'), forms: { ru: ['потока журнала', 'потоки журнала', 'потоков журнала', 'потоком журнала'], en: ['log streams'] }, short: bi('Строки журнала с одним и тем же набором меток; Loki индексирует только метки потоков.', 'Log lines with one and the same label set; Loki indexes only the labels of streams.'), introducedIn: 'monitoring.logs' },
  { id: 'obs.logql', term: bi('LogQL', 'LogQL'), short: bi('Язык запросов Loki: селектор потоков, затем фильтры и парсеры строк, а для чисел — функции вроде count_over_time.', 'The query language of Loki: a stream selector, then line filters and parsers, and functions such as count_over_time for numbers.'), introducedIn: 'monitoring.logs', docRef: { page: 'web/grafana.com/loki/logql', anchor: 'overview' } },
  { id: 'obs.trace', term: bi('трейс', 'distributed trace'), forms: { ru: ['трейса', 'трейсы', 'трейсов', 'трейсом', 'трейсе', 'трейсам'], en: ['distributed traces'] }, short: bi('Путь одного запроса через все сервисы: дерево спанов с общим trace_id.', 'The path of one request through all services: a tree of spans with a common trace_id.'), introducedIn: 'monitoring.traces', docRef: { page: 'web/opentelemetry.io/traces', anchor: 'overview' } },
  { id: 'obs.span', term: bi('спан', 'span'), forms: { ru: ['спана', 'спаны', 'спанов', 'спаном', 'спане', 'спанам'], en: ['spans'] }, short: bi('Одна операция внутри трейса: имя, начало, длительность, родитель, атрибуты и статус.', 'One operation inside a trace: a name, a start, a duration, a parent, attributes and a status.'), introducedIn: 'monitoring.traces', docRef: { page: 'web/opentelemetry.io/traces', anchor: 'spans' } },
  { id: 'obs.context-propagation', term: bi('передача контекста', 'context propagation'), forms: { ru: ['передачи контекста', 'передачу контекста', 'передачей контекста'] }, short: bi('Передача trace_id и родительского span_id от сервиса к сервису, обычно в заголовке traceparent.', 'Passing the trace_id and the parent span_id from service to service, usually in the traceparent header.'), introducedIn: 'monitoring.traces', docRef: { page: 'web/w3.org/trace-context', anchor: 'traceparent' } },
  { id: 'obs.sampling', term: bi('сэмплирование трейсов', 'trace sampling'), forms: { ru: ['сэмплирования трейсов', 'сэмплированием трейсов'] }, short: bi('Отбор части трейсов для хранения: в начале запроса по доле (head) или после его конца по признакам — ошибкам, длительности (tail).', 'Keeping a share of traces: at the start of a request by ratio (head), or after it ends by features such as errors and duration (tail).'), introducedIn: 'monitoring.traces', docRef: { page: 'web/opentelemetry.io/traces', anchor: 'sampling' } },
  { id: 'obs.kube-state-metrics', term: bi('kube-state-metrics', 'kube-state-metrics'), short: bi('Экспортёр, который превращает поля объектов API Kubernetes в ряды: фазы подов, перезапуски, реплики, лимиты.', 'An exporter that turns the fields of Kubernetes API objects into series: pod phases, restarts, replicas, limits.'), introducedIn: 'monitoring.k8s', docRef: { page: 'web/github.com/kube-state-metrics', anchor: 'overview' } },
  { id: 'obs.cadvisor', term: bi('cAdvisor', 'cAdvisor'), short: bi('Часть kubelet, которая читает файлы cgroup каждого контейнера и отдаёт ряды container_*.', 'The part of the kubelet that reads the cgroup files of every container and serves the container_* series.'), introducedIn: 'monitoring.k8s', docRef: { page: 'web/github.com/kube-state-metrics', anchor: 'cadvisor' } },
  { id: 'obs.throttling', term: bi('троттлинг CPU', 'CPU throttling'), forms: { ru: ['троттлинга CPU', 'троттлингом CPU'] }, short: bi('Притормаживание контейнера ядром, когда он исчерпал квоту cpu.max в текущем 100-миллисекундном периоде.', 'The kernel holding a container back when it has used up its cpu.max quota in the current 100 ms period.'), introducedIn: 'monitoring.k8s' },
];

// ── helpers ──

const outOf = (f: Facts) => (f.term.main ?? []).at(-1)?.out ?? '';
const rows = (r: LogResult) => flatEntries(r);
const MB512 = 512 * 1024 * 1024;

/** Names of the alerting rules in `text` that are firing at the end of the dataset. */
export function firingRules(text: string, incident: Incident): { name: string; expr: string }[] | null {
  const { groups, errors } = parseRules(text, 'rules.yml');
  if (errors.length) return null;
  const db = dataset(incident);
  return groups.flatMap((g) => g.rules.filter((r) => r.alert && evalRule(db, r, NOW - 30 * 60_000, NOW).points.at(-1)?.state === 'firing').map((r) => ({ name: r.alert!, expr: r.expr })));
}
const fires = (f: Facts, metric: RegExp) => (firingRules(f.files[`${MON}/rules.yml`]?.text ?? '', 'k8s') ?? []).some((r) => metric.test(r.expr));

function lastValue(out: string): number | null {
  const m = /"value":\s*\[\s*[\d.]+,\s*"([\d.eE+-]+)"/.exec(out);
  return m ? Number(m[1]) : null;
}
function jsonVector(out: string): { metric: Record<string, string>; value: [number, string] }[] {
  const i = out.indexOf('[');
  if (i < 0) return [];
  try {
    const v = JSON.parse(out.slice(i, out.lastIndexOf(']') + 1));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
const expectedCount = (incident: Incident, q: string) => {
  const r = runLogQL(logDataset(incident), q);
  return r.type === 'vector' ? r.data[0]?.value ?? 0 : r.type === 'scalar' ? r.value : 0;
};
const traceIds = (out: string) => [...out.matchAll(/"trace_id":"([0-9a-f]{32})"/g)].map((m) => m[1]);

const monSetup = (incident: Incident, files: { path: string; content: string }[] = []): TerminalSetup => ({ cwd: '~/mon', files, ext: { prom: { incident } } });

// ── quiz ──

export const quiz2: QuizItem[] = [
  {
    id: 'obs.q.log-labels',
    kind: 'multi',
    concepts: ['obs.log-stream'],
    prompt: bi('Какие поля стоит сделать метками потоков в Loki? Отметьте все.', 'Which fields should become stream labels in Loki? Mark all.'),
    options: [
      { id: 'app', text: 'app', correct: true },
      { id: 'ns', text: 'namespace', correct: true },
      { id: 'user', text: 'user_id', why: bi('Десятки тысяч значений — десятки тысяч потоков с крошечными кусками. Пользователя ищут фильтром по содержимому строки.', 'Tens of thousands of values mean tens of thousands of streams with tiny chunks. A user is found with a filter on the line content.') },
      { id: 'trace', text: 'trace_id', why: bi('Уникален для каждого запроса: каждый запрос стал бы своим потоком. trace_id остаётся в строке и ищется через |=.', 'Unique for every request: every request would become its own stream. trace_id stays in the line and is searched with |=.') },
      { id: 'inst', text: 'instance', correct: true },
    ],
    explain: bi('Метки — то, по чему вы выбираете группу строк; их значений немного, и они не меняются от строки к строке.', 'Labels are what you select a group of lines by; they have few values and do not change from line to line.'),
  },
  {
    id: 'obs.q.loki-index',
    kind: 'mcq',
    concepts: ['obs.log-stream', 'obs.logql'],
    prompt: bi('Почему запрос `{app="api"} |= "pool exhausted"` быстрее, чем `{namespace="shop"} |= "pool exhausted"`, хотя находит то же самое?', 'Why is `{app="api"} |= "pool exhausted"` faster than `{namespace="shop"} |= "pool exhausted"` although it finds the same thing?'),
    options: [
      { id: 'scan', text: bi('Loki индексирует только метки: первый селектор выбирает меньше потоков, и перебирать приходится меньше строк', 'Loki indexes only labels: the first selector picks fewer streams, so fewer lines need scanning'), correct: true },
      { id: 'index', text: bi('Строка "pool exhausted" есть в индексе только у потоков api', 'The string "pool exhausted" is in the index only for the api streams'), why: bi('Содержимое строк Loki не индексирует вовсе — в этом его дешевизна.', 'Loki does not index line content at all; that is where its cheapness comes from.') },
      { id: 'same', text: bi('Они одинаково быстры', 'They are equally fast'), why: bi('Фильтр |= перебирает каждую строку выбранных потоков; чем шире селектор, тем больше работы.', 'The |= filter scans every line of the selected streams; the broader the selector, the more work.') },
    ],
  },
  {
    id: 'obs.q.structured',
    kind: 'mcq',
    concepts: ['obs.structured-log'],
    prompt: bi('Чем строка `{"level":"error","route":"/checkout","status":500,"duration_ms":2004}` лучше строки `ERROR checkout failed after 2004ms (500)`?', 'Why is the line `{"level":"error","route":"/checkout","status":500,"duration_ms":2004}` better than `ERROR checkout failed after 2004ms (500)`?'),
    options: [
      { id: 'fields', text: bi('Поля достаются по имени: можно фильтровать status >= 500 и считать квантили duration_ms, не завися от порядка слов', 'Fields are taken by name: you can filter status >= 500 and compute quantiles of duration_ms regardless of word order'), correct: true },
      { id: 'short', text: bi('Она короче и дешевле хранится', 'It is shorter and cheaper to store'), why: bi('Скорее длиннее. Выигрыш не в размере, а в том, что машина может её разобрать.', 'If anything it is longer. The gain is not size but that a machine can parse it.') },
      { id: 'human', text: bi('Её проще читать человеку', 'It is easier for a human to read'), why: bi('Человеку обе читаются; разница в том, что первую понимает и программа.', 'A human reads both; the difference is that a program understands the first one too.') },
    ],
  },
  {
    id: 'obs.q.logql-order',
    kind: 'order',
    concepts: ['obs.logql'],
    prompt: bi('Соберите запрос «ответы 5xx маршрута /checkout в виде "маршрут сообщение"» в правильном порядке.', 'Assemble the query "5xx responses of /checkout as \'route message\'" in the right order.'),
    steps: [
      { id: 'sel', text: '{app="api"}' },
      { id: 'line', text: '|= "checkout"', why: bi('Фильтр по тексту — до парсера: он дешевле и отсекает большинство строк сразу.', 'The text filter goes before the parser: it is cheaper and drops most lines at once.') },
      { id: 'json', text: '| json' },
      { id: 'label', text: '| status >= 500' },
      { id: 'fmt', text: '| line_format "{{.route}} {{.msg}}"' },
    ],
  },
  {
    id: 'obs.q.count-vs-rate',
    kind: 'match',
    concepts: ['obs.logql'],
    prompt: bi('Что вернёт запрос?', 'What does the query return?'),
    pairs: [
      { id: 'lines', left: '{app="api"} |= "error"', right: bi('строки журнала', 'log lines') },
      { id: 'count', left: 'count_over_time({app="api"} |= "error" [5m])', right: bi('число строк за 5 минут по каждому потоку', 'the number of lines over 5 minutes for each stream') },
      { id: 'rate', left: 'sum(rate({app="api"} |= "error" [5m]))', right: bi('строк в секунду по всему api', 'lines per second for all of api') },
      { id: 'q', left: 'quantile_over_time(0.99, {app="api"} | json | unwrap duration_ms [5m]) by (route)', right: bi('p99 длительности по маршрутам — из чисел в строках', 'p99 duration by route, from the numbers in the lines') },
    ],
  },
  {
    id: 'obs.q.traceparent',
    kind: 'mcq',
    concepts: ['obs.context-propagation'],
    prompt: bi('frontend вызывает api с заголовком `traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`. Что из этого api запишет в свой спан?', 'frontend calls api with the header `traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`. What of it does api record in its span?'),
    options: [
      { id: 'ok', text: bi('trace_id 4bf92f… — как свой, 00f067… — как родителя; а свой span_id создаст новый', 'trace_id 4bf92f… as its own, 00f067… as the parent; and it creates a new span_id of its own'), correct: true },
      { id: 'copy', text: bi('Оба идентификатора как свои', 'Both IDs as its own'), why: bi('span_id у каждого спана свой. 00f067… — спан frontend, он становится родителем.', 'Each span has its own span_id. 00f067… is the frontend span; it becomes the parent.') },
      { id: 'new', text: bi('Новый trace_id: у каждого сервиса свой трейс', 'A new trace_id: each service has its own trace'), why: bi('Тогда трейс распался бы на куски. Смысл заголовка — продолжить тот же трейс.', 'Then the trace would fall apart into pieces. The point of the header is to continue the same trace.') },
    ],
  },
  {
    id: 'obs.q.sampling',
    kind: 'mcq',
    concepts: ['obs.sampling'],
    prompt: bi('Ошибка случается в 1 заказе из 500. Трейсы сэмплируются в начале запроса, 10%. Что увидит дежурный?', 'An error happens in 1 order out of 500. Traces are sampled at the start of the request, 10%. What does the on-call engineer see?'),
    options: [
      { id: 'few', text: bi('Девять из десяти ошибочных заказов без трейса: решение принималось до того, как стало ясно, что будет ошибка', 'Nine out of ten failed orders without a trace: the decision was made before it was clear there would be an error'), correct: true },
      { id: 'all', text: bi('Все ошибочные заказы: ошибки сохраняются всегда', 'All failed orders: errors are always kept'), why: bi('Так работает отбор в конце трейса (tail) в Collector, а не доля в начале.', 'That is how tail sampling in the Collector works, not a ratio at the start.') },
      { id: 'none', text: bi('Ни одного трейса', 'No traces at all'), why: bi('Каждый десятый заказ записывается, просто ошибки среди них редки.', 'Every tenth order is recorded; errors among them are just rare.') },
    ],
  },
  {
    id: 'obs.q.signals',
    kind: 'match',
    concepts: ['obs.trace', 'obs.structured-log'],
    prompt: bi('Какой сигнал отвечает на вопрос?', 'Which signal answers the question?'),
    pairs: [
      { id: 'm', left: bi('Сколько заказов в секунду падает и с каких пор?', 'How many orders per second fail, and since when?'), right: bi('метрики', 'metrics') },
      { id: 'l', left: bi('Что именно написал сервис про этот отказ?', 'What exactly did the service write about this failure?'), right: bi('журналы', 'logs') },
      { id: 't', left: bi('На каком шаге внутри запроса ушли две секунды?', 'At which step inside the request did the two seconds go?'), right: bi('трейсы', 'traces') },
    ],
  },
  {
    id: 'obs.q.cadvisor-vs-ksm',
    kind: 'match',
    concepts: ['obs.cadvisor', 'obs.kube-state-metrics'],
    prompt: bi('Откуда берётся ряд?', 'Where does the series come from?'),
    pairs: [
      { id: 'ws', left: 'container_memory_working_set_bytes', right: 'cAdvisor', why: bi('Читается из memory.current cgroup контейнера на узле.', 'Read from the container’s cgroup memory.current on the node.') },
      { id: 'thr', left: 'container_cpu_cfs_throttled_periods_total', right: 'cAdvisor' },
      { id: 'rs', left: 'kube_pod_container_status_restarts_total', right: 'kube-state-metrics', why: bi('Поле restartCount из статуса пода в API.', 'The restartCount field of the pod status in the API.') },
      { id: 'rep', left: 'kube_deployment_status_replicas_available', right: 'kube-state-metrics' },
    ],
  },
  {
    id: 'obs.q.throttle',
    kind: 'mcq',
    concepts: ['obs.throttling'],
    prompt: bi('У worker `limits.cpu: 200m`. График CPU показывает ровно 0,2 ядра, но задачи обрабатываются вдвое медленнее обычного. Что происходит?', 'The worker has `limits.cpu: 200m`. The CPU graph shows exactly 0.2 cores, but jobs are processed twice as slowly as usual. What is going on?'),
    options: [
      { id: 'thr', text: bi('Процесс упирается в квоту cpu.max и ждёт до конца каждого периода — это троттлинг; график «ровно лимит» — его признак', 'The process hits the cpu.max quota and waits till the end of each period: that is throttling, and a graph flat at the limit is its sign'), correct: true },
      { id: 'idle', text: bi('Процессу не нужно больше CPU, тормозит что-то другое', 'The process needs no more CPU; something else is slow'), why: bi('Ровная линия на лимите — не спокойствие, а потолок. Проверьте долю периодов с троттлингом.', 'A flat line at the limit is not calm but a ceiling. Check the share of throttled periods.') },
      { id: 'oom', text: bi('Его убивает OOM killer', 'The OOM killer kills it'), why: bi('Лимит CPU не убивает — он только тормозит. Убивает лимит памяти.', 'A CPU limit does not kill, it only holds back. The memory limit kills.') },
    ],
  },
  {
    id: 'obs.q.absent',
    kind: 'mcq',
    concepts: ['obs.kube-state-metrics'],
    prompt: bi('Алерт `increase(kube_pod_container_status_restarts_total[1h]) > 2` молчит неделю. Под при этом падает каждые 20 минут. Что проверить первым?', 'The alert `increase(kube_pod_container_status_restarts_total[1h]) > 2` has been silent for a week. Meanwhile a pod crashes every 20 minutes. What do you check first?'),
    options: [
      { id: 'up', text: bi('Есть ли сами ряды: up{job="kube-state-metrics"} и отдельный алерт на пропажу источника', 'Whether the series exist at all: up{job="kube-state-metrics"} and a separate alert for a missing source'), correct: true },
      { id: 'thr', text: bi('Порог: поставить > 0', 'The threshold: make it > 0'), why: bi('При пропавших рядах любой порог даёт пустой результат.', 'With the series gone, any threshold gives an empty result.') },
      { id: 'am', text: bi('Маршруты Alertmanager', 'The Alertmanager routes'), why: bi('Возможно, но сначала — дошло ли правило до firing; без рядов оно и не может.', 'Possibly, but first check whether the rule reached firing at all; without the series it cannot.') },
    ],
  },
];

// ── lessons ──

const LOG_GOALS: LogsProps['goals'] = [
  { id: 'errors', prompt: bi('Покажите только строки уровня error из журнала api.', 'Show only the error-level lines of the api log.'), test: (r) => rows(r).length > 0 && rows(r).every((x) => x.labels.app === 'api' && /"level":"error"/.test(x.line)), then: bi('Почти все ошибки — одинаковые: «acquire connection: pool exhausted». Сервису не хватает соединений с базой.', 'Almost all errors are the same: "acquire connection: pool exhausted". The service runs out of database connections.'), hint: bi('Селектор {app="api"}, затем | json и фильтр по полю level — или фильтр строки по "level":"error".', 'The selector {app="api"}, then | json and a filter on the level field, or a line filter on "level":"error".') },
  { id: 'route', prompt: bi('Оставьте только ответы 500 маршрута /checkout.', 'Keep only the 500 responses of the /checkout route.'), test: (r) => rows(r).length > 0 && rows(r).every((x) => x.labels.route === '/checkout' && x.labels.status === '500'), then: bi('Все эти ответы длились около двух секунд — ровно таймаут ожидания соединения.', 'All these responses took about two seconds, exactly the connection wait timeout.'), hint: bi('После | json поля строки становятся метками: | route="/checkout" | status = 500.', 'After | json the fields of the line become labels: | route="/checkout" | status = 500.') },
  { id: 'count', prompt: bi('Посчитайте ответы 5xx по маршрутам за последние 15 минут — числом, а не строками.', 'Count the 5xx responses per route over the last 15 minutes, as numbers, not lines.'), test: (r) => r.type === 'vector' && r.data.length >= 2 && r.data.every((s) => !!s.labels.route && Object.keys(s.labels).length === 1) && r.data.reduce((a, b) => (b.value > a.value ? b : a)).labels.route === '/checkout', then: bi('Ошибки почти целиком на /checkout. Это та же картина, что и в метриках, но теперь видно и сообщение.', 'The errors are almost all on /checkout. The same picture as in the metrics, but now the message is visible too.'), hint: bi('sum by (route) (count_over_time(… [15m]))', 'sum by (route) (count_over_time(… [15m]))') },
  { id: 'version', prompt: bi('Какая версия api пишет эти ошибки? Разложите число ошибок за 15 минут по полю version.', 'Which api version writes these errors? Break the error count over 15 minutes down by the version field.'), test: (r) => r.type === 'vector' && r.data.length >= 1 && r.data.every((s) => !!s.labels.version) && r.data.reduce((a, b) => (b.value > a.value ? b : a)).labels.version === '2.3.1', then: bi('Ошибки пишет только 2.3.1 — версия, выкаченная перед началом инцидента.', 'Only 2.3.1 writes the errors: the version rolled out right before the incident started.') },
];

export const logsLesson: Lesson = {
  id: 'monitoring.logs',
  block: 'monitoring',
  title: bi('Журналы: что именно случилось', 'Logs: what exactly happened'),
  summary: bi('Метрика говорит, сколько и когда; журнал — что именно произошло с конкретным запросом. Структурированный журнал можно не только читать, но и считать.', 'A metric says how much and when; a log says what exactly happened to a particular request. A structured log can be not only read but counted.'),
  introduces: ['obs.structured-log', 'obs.log-stream', 'obs.logql'],
  uses: ['obs.label', 'obs.cardinality', 'obs.rate', 'obs.aggregation', 'obs.quantile'],
  tier: 'core',
  minutes: 40,
  sources: src([S.k8sLogging, S.lokiLabels, S.logql], [S.ruLogs, S.ruLoki]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Метрики уже сказали главное: с 11:15 четверть оформлений заказа заканчивается ошибкой 500, а остальные идут по полторы секунды. Но число не объясняет, что именно сломалось. Это написал сам сервис — в журнал, строкой на каждый неудачный запрос. Осталось её найти среди сотен тысяч других.',
        'The metrics have already said the main thing: since 11:15 a quarter of checkouts end in a 500 error and the rest take a second and a half. But a number does not explain what exactly broke. The service itself wrote that, into its log, one line per failed request. All that remains is to find it among hundreds of thousands of others.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Журнал — это записи о событиях, которые программа делает по ходу работы: принят запрос, не удалось подключиться к базе, задача обработана. В контейнере программа пишет их в стандартный вывод, среда контейнеров складывает строки в файлы на узле, а агент — Grafana Alloy, Fluent Bit или Vector — читает эти файлы и отправляет строки в хранилище журналов. Сам сервис не знает, где окажутся его строки, и это правильно: куда их везти, решает инфраструктура.\n\nСтрока бывает свободным текстом, удобным человеку, — `ERROR checkout failed after 2004ms (500)`, — и тогда программе, чтобы достать из неё код ответа, придётся угадывать формат регулярным выражением. А бывает [[obs.structured-log|структурированный журнал]]: каждое событие — строка с именованными полями, обычно JSON или logfmt:\n\n```text\n{"level":"error","msg":"acquire connection: pool exhausted (timeout 2s)","route":"/checkout","status":500,"duration_ms":2004,"trace_id":"4bf92f…"}\n```\n\nТакую строку можно фильтровать по полю, считать и даже строить по ней квантили, не завися от порядка слов.\n\n### Как хранит Loki\n\nLoki устроен по образцу Prometheus. Каждая строка приходит с набором меток — `{namespace="shop", app="api", instance="api-1:8080"}`, — и все строки с одинаковым набором меток составляют [[obs.log-stream|поток журнала]]. Индексируются только метки потоков; сами строки лежат сжатыми кусками без индекса по содержимому. Поэтому хранение дешёвое, а поиск по тексту идёт перебором строк выбранных потоков.\n\nОтсюда то же правило, что и для [[obs.cardinality|кардинальности]] метрик. Метка — это то, по чему вы выбираете группу строк: сервис, окружение, экземпляр. `user_id` или `trace_id` меткой делать нельзя: каждый пользователь стал бы своим потоком, индекс распух бы, а куски измельчились. Такие поля остаются внутри строки, и их находят фильтром.\n\n### LogQL\n\n[[obs.logql|LogQL]] начинается с селектора потоков, как PromQL, а дальше строки проходят конвейер:\n\n```text\n{app="api"} |= "checkout" | json | status >= 500 | line_format "{{.route}} {{.msg}}"\n```\n\n`|=`, `!=`, `|~` и `!~` — фильтры по тексту строки; они самые дешёвые, поэтому их ставят первыми. `| json` и `| logfmt` разбирают строку и превращают её поля в метки, после чего по ним можно фильтровать: `| status >= 500`, `| duration_ms > 1500`, `| route = "/checkout"`. Если строка не разобралась, у неё появится метка `__error__`.\n\nСтроки можно превратить в числа — и тогда LogQL отвечает как PromQL. `count_over_time({app="api"} |= "error" [5m])` — сколько строк за пять минут в каждом потоке, `rate(…[5m])` — сколько в секунду, а обычные `sum by (route)` и `topk` сворачивают результат. Числовое поле строки становится значением через `unwrap`: `quantile_over_time(0.99, {app="api"} | json | unwrap duration_ms [5m]) by (route)` даёт p99 длительности прямо из журнала. Помните, что после парсера каждое поле — метка: без `sum by (…)` результат разложится на столько рядов, сколько разных значений у полей.',
        'A log is the records of events a program makes as it works: a request was accepted, the database could not be reached, a job was processed. In a container the program writes them to standard output, the container runtime puts the lines into files on the node, and an agent (Grafana Alloy, Fluent Bit or Vector) reads those files and sends the lines to a log store. The service itself does not know where its lines end up, and that is right: where to carry them is the infrastructure’s decision.\n\nA line may be free text that suits a human, `ERROR checkout failed after 2004ms (500)`, and then a program that wants the status code out of it has to guess the format with a regular expression. Or it may be a [[obs.structured-log|structured log]]: every event is a line with named fields, usually JSON or logfmt:\n\n```text\n{"level":"error","msg":"acquire connection: pool exhausted (timeout 2s)","route":"/checkout","status":500,"duration_ms":2004,"trace_id":"4bf92f…"}\n```\n\nSuch a line can be filtered by field, counted and even used for quantiles, regardless of word order.\n\n### How Loki stores logs\n\nLoki is built after the model of Prometheus. Every line arrives with a label set, `{namespace="shop", app="api", instance="api-1:8080"}`, and all lines with the same label set make up a [[obs.log-stream|log stream]]. Only stream labels are indexed; the lines themselves lie in compressed chunks with no index on their content. So storage is cheap, and text search scans the lines of the selected streams.\n\nHence the same rule as for the [[obs.cardinality|cardinality]] of metrics. A label is what you select a group of lines by: the service, the environment, the instance. `user_id` or `trace_id` must not become labels: every user would turn into a stream of their own, the index would swell and the chunks would crumble. Such fields stay inside the line and are found with a filter.\n\n### LogQL\n\n[[obs.logql|LogQL]] starts with a stream selector, like PromQL, and then the lines go through a pipeline:\n\n```text\n{app="api"} |= "checkout" | json | status >= 500 | line_format "{{.route}} {{.msg}}"\n```\n\n`|=`, `!=`, `|~` and `!~` filter by the text of the line; they are the cheapest, so they go first. `| json` and `| logfmt` parse the line and turn its fields into labels, after which you can filter by them: `| status >= 500`, `| duration_ms > 1500`, `| route = "/checkout"`. If a line could not be parsed, it gets the label `__error__`.\n\nLines can be turned into numbers, and then LogQL answers like PromQL. `count_over_time({app="api"} |= "error" [5m])` is how many lines there were in five minutes in each stream, `rate(…[5m])` how many per second, and the usual `sum by (route)` and `topk` fold the result. A numeric field of a line becomes the value through `unwrap`: `quantile_over_time(0.99, {app="api"} | json | unwrap duration_ms [5m]) by (route)` gives the p99 duration straight from the log. Remember that after a parser every field is a label: without `sum by (…)` the result splits into as many series as the fields have distinct values.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'obs.log-path', caption: bi('Переключите формат на свободный текст и посмотрите на шаг фильтра. Затем сделайте user_id меткой.', 'Switch the format to free text and look at the filter step. Then make user_id a label.') },
    { id: 'explore', kind: 'widget', step: 'practice', widget: 'obs.logs', props: { incident: 'checkout', query: '{app="api"}', goals: LOG_GOALS, title: bi('Журналы магазина во время инцидента', 'The Shop logs during the incident') } satisfies LogsProps },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: monSetup('checkout'),
      intro: bi('Тот же Loki из терминала: `logcli query` для строк, `logcli instant-query` для чисел, `logcli labels` — какие метки есть.', 'The same Loki from the terminal: `logcli query` for lines, `logcli instant-query` for numbers, `logcli labels` for the labels there are.'),
      tasks: [
        {
          id: 'tail',
          prompt: bi('Выведите пять последних строк журнала worker.', 'Print the last five lines of the worker log.'),
          check: { when: (f) => outOf(f).split('\n').filter((l) => /processed order \d+/.test(l)).length === 5 },
          chips: `logcli query --limit=5 '{app="worker"}'`,
          concepts: ['obs.log-stream'],
          docRef: { page: 'help/logcli' },
          hints: { H1: bi('Метка app, ключ --limit.', 'The app label, the --limit key.') },
        },
        {
          id: 'count',
          prompt: bi('Сколько ответов с кодом 502 отдал frontend за последние 30 минут? Получите одно число одним запросом (frontend пишет logfmt).', 'How many responses with status 502 did frontend give over the last 30 minutes? Get one number with one query (frontend writes logfmt).'),
          check: {
            when: (f) => {
              const v = lastValue(outOf(f));
              return v !== null && jsonVector(outOf(f)).length === 1 && Math.abs(v - expectedCount('checkout', 'sum(count_over_time({app="frontend"} | logfmt | status="502" [30m]))')) < 0.5;
            },
            fail: [{ if: (f) => jsonVector(outOf(f)).length > 1, say: bi('Получилось много рядов: после logfmt каждое поле — метка. Сверните результат через sum(…).', 'You got many series: after logfmt every field is a label. Fold the result with sum(…).') }],
          },
          chips: `logcli instant-query 'sum(count_over_time({app="frontend"} | logfmt | status="502" [30m]))'`,
          concepts: ['obs.logql'],
          docRef: { page: 'web/grafana.com/loki/logql', anchor: 'metric-queries' },
          hints: { H1: bi('count_over_time по окну 30m, вокруг — sum.', 'count_over_time over a 30m window, with sum around it.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('На странице LogQL найдите раздел, который объясняет, как превратить строки журнала в числа.', 'On the LogQL page find the section that explains how to turn log lines into numbers.'),
      ref: { page: 'web/grafana.com/loki/logql' },
      answer: 'metric-queries',
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Для разбора нужно начало истории: выведите три самые ранние за последний час строки уровня error из потока stdout api — в хронологическом порядке, старая первой. По умолчанию logcli показывает новые первыми; нужный ключ найдите в `logcli --help`.', 'The review needs the beginning of the story: print the three earliest error-level lines of the last hour from the api stdout stream, in chronological order, oldest first. By default logcli shows the newest first; find the key you need in `logcli --help`.'),
      ref: { page: 'help/logcli' },
      terminal: {
        setup: monSetup('checkout'),
        task: {
          id: 'forward',
          prompt: bi('Выведены три самые ранние строки error за час, по порядку.', 'The three earliest error lines of the hour are printed, in order.'),
          check: {
            when: (f) => {
              const want = flatEntries(runLogQL(logDataset('checkout'), '{app="api", stream="stdout"} | json | level="error"', { since: 3_600_000, limit: 3, direction: 'forward' }), true).map((x) => /"trace_id":"(\w+)"/.exec(x.line)?.[1]);
              const got = traceIds(outOf(f));
              return got.length === 3 && got.every((id, i) => id === want[i]);
            },
          },
          docStep: 4,
          beyond: true,
          solutionTokens: ['--forward'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['obs.q.structured', 'obs.q.log-labels', 'obs.q.loki-index', 'obs.q.logql-order', 'obs.q.count-vs-rate'] },
  ],
};

const slowCheckout = (s: { trace?: { route: string; spans: { duration: number }[] } }) => !!s.trace && s.trace.route === '/checkout' && s.trace.spans[0].duration > 1500;
const TRACE_GOALS: TracesProps['goals'] = [
  { id: 'slow', prompt: bi('Найдите и откройте трейс оформления заказа (/checkout), который шёл дольше 1,5 секунды.', 'Find and open a checkout (/checkout) trace that took longer than 1.5 seconds.'), test: (s) => slowCheckout(s), then: bi('Весь заказ — это корневой спан frontend; под ним спан api и его дочерние операции.', 'The whole order is the root frontend span; under it are the api span and its child operations.'), hint: bi('Маршрут /checkout, длительность от 1500 мс.', 'Route /checkout, duration from 1500 ms.') },
  { id: 'span', prompt: bi('Какая операция внутри этого заказа заняла больше всего времени? Выберите её спан.', 'Which operation inside this order took the most time? Pick its span.'), test: (s) => slowCheckout(s) && s.span?.name === 'db.pool.acquire', then: bi('Почти всё время заказ ждёт свободного соединения из пула: в атрибутах used = max = 20.', 'Nearly all the time the order waits for a free connection from the pool: the attributes say used = max = 20.') },
  { id: 'nplus1', prompt: bi('Найдите медленный заказ, который дождался соединения, и выберите один из повторяющихся запросов к базе.', 'Find a slow order that did get a connection, and pick one of the repeated database queries.'), test: (s) => slowCheckout(s) && s.span?.name === 'SELECT products' && (s.trace?.spans.filter((x) => (x as { name: string }).name === 'SELECT products').length ?? 0) >= 3, then: bi('Один SELECT на каждый товар корзины — в версии 2.3.1 пропал JOIN. Каждый заказ держит соединение дольше, и пул кончается.', 'One SELECT per cart item: version 2.3.1 lost the JOIN. Every order holds a connection longer, and the pool runs out.') },
  { id: 'from-log', prompt: bi('Возьмите trace_id из любой строки error журнала api (виджет журналов выше или logcli) и откройте этот трейс по идентификатору.', 'Take the trace_id from any error line of the api log (the log widget above or logcli) and open that trace by its ID.'), test: (s) => !!s.search.traceId && s.trace?.traceId === s.search.traceId && s.trace.spans.some((x) => x.status === 'error'), then: bi('Строка журнала и трейс — об одном и том же запросе: журнал говорит «что», трейс — «где».', 'The log line and the trace are about the same request: the log says "what", the trace says "where".') },
];

export const tracesLesson: Lesson = {
  id: 'monitoring.traces',
  block: 'monitoring',
  title: bi('Трейсы: где ушло время', 'Traces: where the time went'),
  summary: bi('Трейс показывает путь одного запроса через все сервисы как дерево операций со временем каждой. Связывает сервисы один заголовок, который каждый передаёт дальше.', 'A trace shows the path of one request through all services as a tree of operations with the time of each. What ties the services together is one header that each passes on.'),
  introduces: ['obs.trace', 'obs.span', 'obs.context-propagation', 'obs.sampling'],
  uses: ['obs.structured-log', 'obs.logql', 'obs.red', 'obs.quantile'],
  tier: 'core',
  minutes: 35,
  sources: src([S.otelTraces, S.otelContext, S.otelSampling, S.w3c], [S.ruTracing, S.ruOtel]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Журнал сказал: «pool exhausted». Но заказы, которые соединение получили, всё равно идут полторы секунды, а заказ проходит через frontend, api и базу. Какая из операций выросла? Метрика даёт среднее по всем, журнал — отдельные строки. Нужен рисунок одного запроса целиком.',
        'The log said "pool exhausted". But orders that did get a connection still take a second and a half, and an order passes through frontend, api and the database. Which of the operations grew? A metric gives an average over everything, a log gives separate lines. You need a picture of one request as a whole.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        '[[obs.trace|Трейс]] — это путь одного запроса через все сервисы. Он состоит из [[obs.span|спанов]]: спан — одна операция, у которой есть имя (`POST /checkout`, `SELECT products`), время начала, длительность, статус и атрибуты — маршрут, код ответа, текст запроса к базе. Каждый спан, кроме первого, знает своего родителя, поэтому спаны складываются в дерево, а на экране — в «водопад»: полоски по времени, вложенные друг в друга. Длинная полоска на дне водопада и есть ответ на вопрос, где ушло время.\n\nСпаны одного трейса пишут разные программы на разных машинах. Объединяет их общий идентификатор trace_id, и попадает он в следующий сервис через [[obs.context-propagation|передачу контекста]]. Вызывая api, frontend добавляет к запросу заголовок W3C:\n\n```text\ntraceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01\n```\n\nЗдесь версия, trace_id, span_id вызывающего спана и флаг «записывается». api читает заголовок, оставляет trace_id тем же, а спан frontend записывает своим родителем. Если хотя бы один сервис на пути заголовок не прочитал или не передал дальше, трейс распадается на два несвязанных куска.\n\nЗаписывают спаны не руками. Библиотеки OpenTelemetry сами создают спаны входящих HTTP-запросов, вызовов других сервисов и обращений к базе; вручную добавляют только важные внутренние шаги. Спаны уходят по протоколу OTLP в OpenTelemetry Collector, а он отправляет их в хранилище трейсов — Grafana Tempo или Jaeger — и, если нужно, в несколько хранилищ сразу.\n\n### Не всё хранить\n\nТрейс на каждый запрос стоит дорого, поэтому применяют [[obs.sampling|сэмплирование трейсов]]. Отбор в начале запроса (head) — «записываем каждый десятый» — дёшев, но решение принимается, когда ещё неизвестно, будет ли запрос медленным или ошибочным, и редкие беды теряются. Отбор в конце (tail) делает Collector: дожидается завершения трейса и оставляет все ошибки и все медленные, а из обычных — малую долю.\n\nТри сигнала дополняют друг друга. Метрики отвечают, сколько и с каких пор; журналы — что именно случилось; трейсы — где именно. Если сервис пишет trace_id в каждую строку журнала, от строки можно перейти к её трейсу и обратно — на этом стоит переход «метрика → трейс → журнал» в Grafana.',
        'A [[obs.trace|trace]] is the path of one request through all services. It consists of [[obs.span|spans]]: a span is one operation with a name (`POST /checkout`, `SELECT products`), a start time, a duration, a status and attributes such as the route, the status code, the database query text. Every span except the first knows its parent, so spans form a tree, and on screen a "waterfall": bars over time nested in one another. The long bar at the bottom of the waterfall is the answer to the question of where the time went.\n\nThe spans of one trace are written by different programs on different machines. What unites them is a common trace_id, and it gets into the next service through [[obs.context-propagation|context propagation]]. Calling api, frontend adds the W3C header to the request:\n\n```text\ntraceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01\n```\n\nHere are the version, the trace_id, the span_id of the calling span and the "sampled" flag. api reads the header, keeps the trace_id the same, and records the frontend span as its parent. If even one service on the path did not read the header or did not pass it on, the trace falls apart into two unrelated pieces.\n\nSpans are not written by hand. The OpenTelemetry libraries themselves create spans for incoming HTTP requests, calls to other services and database access; only important internal steps are added manually. The spans go over the OTLP protocol to the OpenTelemetry Collector, which sends them to a trace store, Grafana Tempo or Jaeger, and to several stores at once if needed.\n\n### Not keeping everything\n\nA trace for every request is expensive, so [[obs.sampling|trace sampling]] is used. Deciding at the start of a request (head), "record every tenth", is cheap, but the decision is made when nobody yet knows whether the request will be slow or fail, and rare trouble gets lost. Deciding at the end (tail) is done by the Collector: it waits for the trace to complete and keeps every error and every slow one, and a small share of the ordinary ones.\n\nThe three signals complement each other. Metrics answer how much and since when; logs, what exactly happened; traces, where exactly. If a service writes the trace_id into every log line, you can jump from a line to its trace and back: Grafana’s "metric → trace → log" navigation rests on that.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'obs.trace-path', caption: bi('Поднимите число запросов к базе до 12 и посмотрите на водопад справа. Потом сломайте передачу заголовка.', 'Raise the number of database queries to 12 and look at the waterfall on the right. Then break the header propagation.') },
    { id: 'logs', kind: 'widget', step: 'try', widget: 'obs.logs', props: { incident: 'checkout', query: '{app="api"} | json | level="error"', title: bi('Строки с trace_id', 'Lines with a trace_id') } satisfies LogsProps },
    { id: 'viewer', kind: 'widget', step: 'practice', widget: 'obs.traces', props: { incident: 'checkout', goals: TRACE_GOALS, title: bi('Трейсы магазина за последний час', 'The Shop traces of the last hour') } satisfies TracesProps },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Какая часть заголовка traceparent говорит следующему сервису, что трейс записывается? Найдите её раздел в спецификации.', 'Which part of the traceparent header tells the next service that the trace is being recorded? Find its section in the specification.'),
      ref: { page: 'web/w3.org/trace-context' },
      answer: 'trace-flags',
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['obs.q.traceparent', 'obs.q.sampling', 'obs.q.signals'] },
  ],
};

const K8S_GOALS: WorkbenchProps['goals'] = [
  { id: 'restarts', prompt: bi('Какие контейнеры перезапускались за последний час? Покажите только их.', 'Which containers restarted over the last hour? Show only them.'), test: (r) => vecOf(r).length === 1 && vecOf(r)[0].labels.pod === 'api-6f9c7d-q7rvn' && vecOf(r)[0].value >= 2, then: bi('Один под api перезапускается раз в двадцать минут, остальные стоят.', 'One api pod restarts every twenty minutes; the others stand still.'), hint: bi('increase(… [1h]) и сравнение > 0.', 'increase(… [1h]) and a comparison > 0.') },
  { id: 'reason', prompt: bi('Почему он завершается? Покажите причину последнего завершения его контейнера.', 'Why does it terminate? Show the reason for its container’s last termination.'), test: (r) => vecOf(r).some((s) => s.labels.reason === 'OOMKilled'), then: bi('OOMKilled: контейнер выходит за limits.memory, и ядро его убивает.', 'OOMKilled: the container goes over limits.memory, and the kernel kills it.') },
  { id: 'memory', prompt: bi('Для каждого пода shop: максимум памяти за последний час, делённый на лимит памяти.', 'For every shop pod: the maximum memory over the last hour divided by the memory limit.'), test: (r) => vecOf(r).length >= 6 && vecOf(r).every((s) => !!s.labels.pod && s.value > 0 && s.value <= 1.01) && (vecOf(r).find((s) => s.labels.pod === 'api-6f9c7d-q7rvn')?.value ?? 0) > 0.95, then: bi('Под q7rvn доходит до 99% лимита, остальные — до 40–55%. Это утечка памяти в одном экземпляре, а не нехватка лимита у всех.', 'The q7rvn pod reaches 99% of its limit, the others 40–55%. That is a memory leak in one instance, not a limit too small for all.'), hint: bi('max_over_time(container_memory_working_set_bytes{namespace="shop"}[1h]) / container_spec_memory_limit_bytes{namespace="shop"}, свернуть by (pod).', 'max_over_time(container_memory_working_set_bytes{namespace="shop"}[1h]) / container_spec_memory_limit_bytes{namespace="shop"}, folded by (pod).') },
  { id: 'throttle', prompt: bi('Какая доля 100-миллисекундных периодов у каждого пода прошла с троттлингом (за 5 минут)?', 'What share of the 100 ms periods of each pod was throttled (over 5 minutes)?'), test: (r) => vecOf(r).length >= 6 && vecOf(r).every((s) => !!s.labels.pod) && (vecOf(r).find((s) => s.labels.pod?.startsWith('worker'))?.value ?? 0) > 0.4, then: bi('worker притормаживается больше чем в половине периодов: ему нужно больше, чем 200m. Отсюда медленная очередь.', 'The worker is held back in more than half the periods: it needs more than 200m. Hence the slow queue.'), hint: bi('rate от throttled_periods, делённый на rate от periods, оба sum by (pod).', 'The rate of throttled_periods divided by the rate of periods, both sum by (pod).') },
  { id: 'replicas', prompt: bi('У какого Deployment доступных реплик меньше, чем заказано?', 'Which Deployment has fewer available replicas than ordered?'), test: (r) => vecOf(r).length === 1 && vecOf(r)[0].labels.deployment === 'worker', then: bi('Второй под worker висит в Pending: на узлах не хватает запрошенного CPU.', 'The second worker pod hangs in Pending: the nodes lack the requested CPU.') },
];

const RULES0 = 'groups:\n  - name: shop-k8s\n    rules: []\n';

export const k8sLesson: Lesson = {
  id: 'monitoring.k8s',
  block: 'monitoring',
  title: bi('Kubernetes как источник метрик', 'Kubernetes as a source of metrics'),
  summary: bi('Что контейнер потребляет, знает ядро через cgroup — это cAdvisor; что ему положено и что с ним стало, знает API — это kube-state-metrics. Вместе они отвечают на вопросы метода USE для каждого пода.', 'What a container consumes, the kernel knows through cgroups: that is cAdvisor; what it is entitled to and what became of it, the API knows: that is kube-state-metrics. Together they answer the USE questions for every pod.'),
  introduces: ['obs.kube-state-metrics', 'obs.cadvisor', 'obs.throttling'],
  uses: ['obs.use', 'obs.red', 'obs.rate', 'obs.aggregation', 'obs.alert-rule', 'k8s.pod', 'k8s.resources', 'k8s.deployment', 'linux.cgroup', 'linux.oom'],
  tier: 'core',
  minutes: 40,
  sources: src([S.ksm, S.k8sMetrics, S.cgroupv2, S.use], [S.ruK8sMon, S.ruCgroups]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Магазин переехал в Kubernetes, и дашборд RED в целом зелёный. Но раз в двадцать минут у части пользователей обрывается корзина, а очередь заказов разбирается всё медленнее. Метрики приложения тут молчат: приложение не знает, что его убивают и тормозят. Это знают ядро узла и API кластера.',
        'The Shop moved into Kubernetes, and the RED dashboard is green on the whole. But every twenty minutes some users lose their cart, and the order queue is processed slower and slower. The application metrics are silent here: the application does not know it is being killed and held back. The node kernel and the cluster API know it.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'В блоке Linux вы ограничивали процесс через [[linux.cgroup|cgroup]] и видели, как OOM killer убивает того, кто вышел за memory.max. Под в Kubernetes устроен так же: kubelet создаёт для каждого контейнера cgroup и пишет в её файлы то, что задано в [[k8s.resources|requests и limits]]. `limits.memory: 512Mi` становится `memory.max`, `limits.cpu: 200m` — строкой `20000 100000` в `cpu.max`: двадцать миллисекунд процессора на каждые сто.\n\nОтсюда первый источник метрик. [[obs.cadvisor|cAdvisor]], встроенный в kubelet, читает файлы cgroup всех контейнеров узла и отдаёт их по адресу `/metrics/cadvisor`: `container_memory_working_set_bytes` — память, с которой сравнивает лимит ядро; `container_spec_memory_limit_bytes` — сам лимит; `container_cpu_usage_seconds_total` — счётчик процессорного времени; `container_cpu_cfs_periods_total` и `container_cpu_cfs_throttled_periods_total` — сколько прошло периодов по 100 мс и в скольких из них контейнер упёрся в квоту.\n\nПоследнее и есть [[obs.throttling|троттлинг CPU]]. Лимит процессора, в отличие от лимита памяти, не убивает: когда контейнер израсходовал квоту периода, ядро просто не даёт ему работать до начала следующего. График потребления при этом выглядит спокойным — ровная линия на уровне лимита, — а задержки растут. Поэтому смотрят не только на использование, но и на долю периодов с троттлингом:\n\n```promql\nsum by (pod) (rate(container_cpu_cfs_throttled_periods_total[5m]))\n  / sum by (pod) (rate(container_cpu_cfs_periods_total[5m]))\n```\n\nВторой источник — [[obs.kube-state-metrics|kube-state-metrics]]. Он следит за объектами API и превращает их поля в ряды: `kube_pod_status_phase` — фаза пода, `kube_pod_container_status_restarts_total` — число перезапусков, `kube_pod_container_status_last_terminated_reason` — почему контейнер завершился в последний раз, `kube_deployment_spec_replicas` и `kube_deployment_status_replicas_available` — сколько реплик заказано и сколько готово. Это не потребление, а состояние: что вы попросили у кластера и что получилось.\n\n### USE для контейнера\n\nС двумя источниками на каждый под можно задать три вопроса [[obs.use|метода USE]]. Использование — память к лимиту и процессор к лимиту. Насыщение — доля периодов с троттлингом и поды, которые висят в Pending, потому что им не хватило места. Ошибки — OOMKilled и перезапуски. Метод RED по-прежнему смотрит на сервис глазами пользователя; USE объясняет, какой ресурс под ним кончился.\n\nОдно предостережение. Если kube-state-metrics упал, его ряды не станут нулями — их просто не будет, и правило `increase(kube_pod_container_status_restarts_total[1h]) > 2` будет молчать, как молчало бы при здоровом кластере. На каждый важный источник рядов нужен свой алерт «источник пропал»: `up{job="kube-state-metrics"} == 0` или `absent(…)`.',
        'In the Linux block you limited a process through a [[linux.cgroup|cgroup]] and saw the OOM killer kill whoever went over memory.max. A Kubernetes pod is built the same way: the kubelet creates a cgroup for every container and writes into its files what is set in [[k8s.resources|requests and limits]]. `limits.memory: 512Mi` becomes `memory.max`, `limits.cpu: 200m` becomes the line `20000 100000` in `cpu.max`: twenty milliseconds of CPU for every hundred.\n\nHence the first source of metrics. [[obs.cadvisor|cAdvisor]], built into the kubelet, reads the cgroup files of every container on the node and serves them at `/metrics/cadvisor`: `container_memory_working_set_bytes`, the memory the kernel compares with the limit; `container_spec_memory_limit_bytes`, the limit itself; `container_cpu_usage_seconds_total`, a counter of CPU time; `container_cpu_cfs_periods_total` and `container_cpu_cfs_throttled_periods_total`, how many 100 ms periods passed and in how many of them the container hit its quota.\n\nThe last one is [[obs.throttling|CPU throttling]]. A CPU limit, unlike a memory limit, does not kill: when a container has used up its quota for the period, the kernel simply does not let it run until the next one begins. The usage graph looks calm meanwhile, a flat line at the limit, while latency grows. So you look not only at usage but at the share of throttled periods:\n\n```promql\nsum by (pod) (rate(container_cpu_cfs_throttled_periods_total[5m]))\n  / sum by (pod) (rate(container_cpu_cfs_periods_total[5m]))\n```\n\nThe second source is [[obs.kube-state-metrics|kube-state-metrics]]. It watches API objects and turns their fields into series: `kube_pod_status_phase`, the pod phase; `kube_pod_container_status_restarts_total`, the number of restarts; `kube_pod_container_status_last_terminated_reason`, why the container ended last time; `kube_deployment_spec_replicas` and `kube_deployment_status_replicas_available`, how many replicas were ordered and how many are ready. This is not consumption but state: what you asked of the cluster and what came out.\n\n### USE for a container\n\nWith the two sources you can ask the three questions of the [[obs.use|USE method]] for every pod. Utilisation: memory to limit and CPU to limit. Saturation: the share of throttled periods, and pods hanging in Pending because there was no room for them. Errors: OOMKilled and restarts. The RED method still looks at the service through the user’s eyes; USE explains which resource under it ran out.\n\nOne warning. If kube-state-metrics goes down, its series do not become zeros: they simply are not there, and the rule `increase(kube_pod_container_status_restarts_total[1h]) > 2` stays silent, just as it would with a healthy cluster. Every important source of series needs its own "the source is gone" alert: `up{job="kube-state-metrics"} == 0` or `absent(…)`.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'obs.container-metrics', caption: bi('Поднимите память процесса выше лимита, потом поставьте limits.cpu 200m и потребность 0,5 ядра. В конце уроните kube-state-metrics.', 'Raise the process memory above the limit, then set limits.cpu to 200m and the need to 0.5 cores. Finally take kube-state-metrics down.') },
    { id: 'bench', kind: 'widget', step: 'practice', widget: 'obs.workbench', props: { incident: 'k8s', query: 'kube_pod_status_phase{namespace="shop"} == 1', goals: K8S_GOALS, targets: ['node-3:10250'], title: bi('Магазин в Kubernetes', 'The Shop in Kubernetes') } satisfies WorkbenchProps },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: monSetup('k8s', [{ path: `${MON}/rules.yml`, content: RULES0 }]),
      intro: bi('В `~/mon/rules.yml` пустая группа правил. Prometheus видит ряды кластера; `promtool check rules rules.yml` проверяет файл.', '`~/mon/rules.yml` holds an empty rule group. Prometheus sees the cluster series; `promtool check rules rules.yml` checks the file.'),
      tasks: [
        {
          id: 'restarts',
          prompt: bi('Добавьте алерт `PodRestarting`: контейнер перезапускался больше двух раз за последний час. Он должен срабатывать на нынешних данных.', 'Add the `PodRestarting` alert: a container restarted more than twice over the last hour. It must fire on the current data.'),
          check: { when: (f) => fires(f, /kube_pod_container_status_restarts_total/), fail: [{ if: (f) => firingRules(f.files[`${MON}/rules.yml`]?.text ?? '', 'k8s') === null, say: bi('Файл правил не разбирается: проверьте его promtool check rules.', 'The rule file does not parse: check it with promtool check rules.') }] },
          chips: 'promtool check rules rules.yml',
          concepts: ['obs.kube-state-metrics', 'obs.alert-rule'],
          hints: { H1: bi('expr: increase(kube_pod_container_status_restarts_total[1h]) > 2', 'expr: increase(kube_pod_container_status_restarts_total[1h]) > 2') },
        },
        {
          id: 'replicas',
          prompt: bi('Добавьте алерт `DeploymentReplicasMismatch`: доступных реплик меньше, чем заказано, дольше 10 минут.', 'Add the `DeploymentReplicasMismatch` alert: fewer available replicas than ordered for longer than 10 minutes.'),
          check: { when: (f) => fires(f, /kube_deployment_spec_replicas[\s\S]*kube_deployment_status_replicas_available|kube_deployment_status_replicas_available[\s\S]*kube_deployment_spec_replicas/) && /for:\s*10m/.test(f.files[`${MON}/rules.yml`]?.text ?? '') },
          chips: 'promtool check rules rules.yml',
          concepts: ['obs.kube-state-metrics'],
          docRef: { page: 'web/github.com/kube-state-metrics', anchor: 'deployment' },
          hints: { H1: bi('Сравнение двух рядов с одинаковыми метками: spec != available.', 'A comparison of two series with the same labels: spec != available.') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Не дожидаясь следующего OOM: выведите через `promtool query instant`, сколько памяти будет у каждого контейнера shop через 20 минут, если рост последних 10 минут продолжится. В уроке такой функции не было — найдите её на странице функций Prometheus.', 'Without waiting for the next OOM: print with `promtool query instant` how much memory every shop container will have in 20 minutes if the growth of the last 10 minutes continues. The lesson did not show such a function: find it on the Prometheus functions page.'),
      ref: { page: 'web/prometheus.io/querying/functions' },
      terminal: {
        setup: monSetup('k8s'),
        task: {
          id: 'predict',
          prompt: bi('В выводе прогноз для всех контейнеров shop, и у одного из них он выше 512 Mi.', 'The output has a forecast for every shop container, and for one of them it is above 512 Mi.'),
          check: {
            when: (f) => {
              const lines = outOf(f).split('\n').filter((l) => /pod="[^"]+"/.test(l));
              const val = (l: string) => Number(/=> ([\d.e+-]+)/.exec(l)?.[1] ?? NaN);
              const leak = lines.find((l) => l.includes('pod="api-6f9c7d-q7rvn"'));
              return lines.length >= 6 && !!leak && val(leak) > MB512 && lines.filter((l) => !l.includes('q7rvn')).every((l) => val(l) < MB512);
            },
          },
          docStep: 4,
          beyond: true,
          solutionTokens: ['predict_linear'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['obs.q.cadvisor-vs-ksm', 'obs.q.throttle', 'obs.q.absent'] },
  ],
};

export const placement2: PlacementTask[] = [
  { id: 'monitoring.place.loki', level: 'experienced', key: false, concepts: ['obs.log-stream'], kind: 'quiz', item: { ...(quiz2.find((q) => q.id === 'obs.q.log-labels') as QuizItem), id: 'monitoring.place.q.loki' } },
  { id: 'monitoring.place.throttle', level: 'experienced', key: false, concepts: ['obs.throttling'], kind: 'quiz', item: { ...(quiz2.find((q) => q.id === 'obs.q.throttle') as QuizItem), id: 'monitoring.place.q.throttle' } },
];

// ── the block exam ──

export const monitoringExam: Exam = {
  id: 'monitoring.exam',
  block: 'monitoring',
  title: bi('Дежурство по магазину', 'On duty for the Shop'),
  story: bi('Ночь вашего первого дежурства. В канале три сообщения: «корзина иногда пустеет», «оформление заказа падает», «нужен список, что именно падает, к утреннему разбору». Плюс вопросы тимлида.', 'The night of your first on-call shift. The channel has three messages: "the cart sometimes empties", "checkout fails", "we need a list of what exactly fails for the morning review". Plus the team lead’s questions.'),
  intro: bi('Четыре задачи на машинах с Prometheus и Loki магазина и два вопроса. Открыты `--help` и справочник prometheus.io, grafana.com и opentelemetry.io; подсказок и наставника нет.', 'Four tasks on machines with the Shop’s Prometheus and Loki, and two questions. `--help` and the prometheus.io, grafana.com and opentelemetry.io references are open; no hints and no mentor.'),
  minutes: 60,
  pass: 0.7,
  allowedDocs: ['help', 'prometheus.io', 'grafana.com', 'opentelemetry.io', 'kube-state-metrics'],
  tasks: [
    {
      id: 'restart-alert',
      weight: 3,
      critical: true,
      kind: 'task',
      setup: monSetup('k8s', [{ path: `${MON}/rules.yml`, content: RULES0 }]),
      task: {
        id: 'x-restart',
        prompt: bi('«Корзина иногда пустеет». Найдите под, который перезапускается, и поставьте в `rules.yml` алерт, который сработает на нём сейчас и не зависит от его имени.', '“The cart sometimes empties.” Find the pod that keeps restarting and put an alert into `rules.yml` that fires on it now and does not depend on its name.'),
        check: { when: (f) => fires(f, /kube_pod_container_status_restarts_total/) && !/q7rvn/.test(f.files[`${MON}/rules.yml`]?.text ?? '') },
      },
    },
    {
      id: 'errors-by-route',
      weight: 3,
      critical: true,
      kind: 'task',
      setup: monSetup('checkout'),
      task: {
        id: 'x-routes',
        prompt: bi('«Оформление заказа падает». Выведите через logcli число ответов 5xx api за последние 15 минут по каждому маршруту — одним запросом, по ряду на маршрут.', '“Checkout fails.” Print with logcli the number of 5xx responses of api over the last 15 minutes for each route, in one query, one series per route.'),
        check: {
          when: (f) => {
            const v = jsonVector(outOf(f));
            const want = runLogQL(logDataset('checkout'), 'sum by (route) (count_over_time({app="api"} | json | status >= 500 [15m]))');
            const exp = want.type === 'vector' ? want.data : [];
            return v.length === exp.length && v.length >= 2 && v.every((s) => Object.keys(s.metric).length === 1 && exp.some((e) => e.labels.route === s.metric.route && Math.abs(e.value - Number(s.value[1])) < 0.5));
          },
        },
      },
    },
    {
      id: 'memory',
      weight: 2,
      kind: 'task',
      setup: monSetup('k8s'),
      task: {
        id: 'x-memory',
        prompt: bi('Выведите через `promtool query instant` для каждого пода shop отношение памяти сейчас к его лимиту памяти — по строке на под.', 'Print with `promtool query instant` the ratio of current memory to the memory limit for every shop pod, one line per pod.'),
        check: {
          when: (f) => {
            const lines = outOf(f).split('\n').filter((l) => /^\{[^}]*pod="[^"]+"[^}]*\} => 0\.\d+/.test(l));
            return new Set(lines.map((l) => /pod="([^"]+)"/.exec(l)![1])).size === 6 && lines.length === 6;
          },
        },
      },
    },
    {
      id: 'raw-lines',
      weight: 2,
      beyond: true,
      kind: 'task',
      setup: monSetup('checkout'),
      task: {
        id: 'x-raw',
        prompt: bi('«Список к утреннему разбору»: выведите последние пять строк уровня error из потока stdout api так, чтобы в выводе были только сами строки JSON — без времени и меток, чтобы их можно было сразу передать в jq. В уроках этого не было.', '“A list for the morning review”: print the last five error-level lines of the api stdout stream so that the output holds only the JSON lines themselves, without time and labels, ready to pipe into jq. The lessons did not cover this.'),
        check: {
          when: (f) => {
            // logcli writes the request URL and the limit note to stderr; jq would see only stdout.
            const lines = outOf(f).split('\n').filter((l) => l.trim() && !/^https?:\/\//.test(l) && !/^\(the limit of/.test(l));
            return lines.length === 5 && lines.every((l) => l.startsWith('{"ts":') && l.includes('"level":"error"'));
          },
        },
        docStep: 5,
        solutionTokens: ['-o raw', '--output=raw', '--output raw', '-q'],
      },
    },
    { id: 'signals', weight: 1, kind: 'quiz', item: { ...(quiz2.find((q) => q.id === 'obs.q.traceparent') as QuizItem), id: 'monitoring.exam.q.traceparent' } },
    { id: 'throttle', weight: 1, kind: 'quiz', item: { ...(quiz2.find((q) => q.id === 'obs.q.throttle') as QuizItem), id: 'monitoring.exam.q.throttle' } },
  ],
  explain: [
    { id: 'cpu-alert', prompt: bi('«Зачем нам алерт на долю ошибок, если есть алерт на CPU выше 80%?»', '“Why do we need an alert on the error share if there is an alert on CPU above 80%?”'), keyPoints: [bi('алерт ставят на симптом, который чувствует пользователь', 'an alert is put on a symptom the user feels'), bi('причин много, высокая загрузка не всегда вредит', 'there are many causes, and high load does not always hurt'), bi('ресурсы — для разбора (USE), а не для ночных вызовов', 'resources are for investigation (USE), not for night pages')] },
    { id: 'signals', prompt: bi('«Как вы нашли, что причина в новой версии, а не в базе?»', '“How did you find that the cause was the new version and not the database?”'), keyPoints: [bi('метрики: что и с каких пор, по маршруту и версии', 'metrics: what and since when, by route and version'), bi('журналы: сообщение об исчерпании пула и версия в строке', 'logs: the pool exhaustion message and the version in the line'), bi('трейсы: ожидание пула и по запросу на товар', 'traces: the pool wait and one query per item')] },
  ],
};
