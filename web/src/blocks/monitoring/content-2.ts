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
  { id: 'obs.structured-log', term: bi('структурированный журнал', 'structured log'), forms: { ru: ['структурированного журнала', 'структурированные журналы', 'структурированных журналов', 'структурированным журналом'], en: ['structured logs', 'structured logging'] }, short: bi('Журнал, в котором каждое событие записано строкой с именованными полями в формате JSON или logfmt, а не свободным текстом.', 'A log in which every event is written as a line with named fields, in JSON or logfmt, rather than as free text.'), introducedIn: 'monitoring.logs' },
  { id: 'obs.log-stream', term: bi('поток журнала', 'log stream'), forms: { ru: ['потока журнала', 'потоки журнала', 'потоков журнала', 'потоком журнала'], en: ['log streams'] }, short: bi('Все строки журнала с одним и тем же набором меток. Loki индексирует только метки потоков, а не содержимое строк.', 'All log lines with one and the same label set. Loki indexes only the labels of streams, not the content of lines.'), introducedIn: 'monitoring.logs' },
  { id: 'obs.logql', term: bi('LogQL', 'LogQL'), short: bi('Язык запросов Loki. Запрос начинается с выбора потоков по меткам, потом строки проходят через фильтры и разбор полей, а чтобы получить числа, применяют функции вроде count_over_time.', 'The query language of Loki. A query starts by selecting streams by labels, then the lines pass through filters and field parsing, and functions such as count_over_time turn them into numbers.'), introducedIn: 'monitoring.logs', docRef: { page: 'web/grafana.com/loki/logql', anchor: 'overview' } },
  { id: 'obs.trace', term: bi('трейс', 'distributed trace'), forms: { ru: ['трейса', 'трейсы', 'трейсов', 'трейсом', 'трейсе', 'трейсам'], en: ['distributed traces'] }, short: bi('Запись пути одного запроса через все сервисы. Она состоит из дерева операций, которые называют спанами, и у всех спанов один общий идентификатор trace_id.', 'A record of the path of one request through all services. It consists of a tree of operations called spans, and all the spans share one trace_id.'), introducedIn: 'monitoring.traces', docRef: { page: 'web/opentelemetry.io/traces', anchor: 'overview' } },
  { id: 'obs.span', term: bi('спан', 'span'), forms: { ru: ['спана', 'спаны', 'спанов', 'спаном', 'спане', 'спанам'], en: ['spans'] }, short: bi('Одна операция внутри трейса. У неё есть имя, время начала, длительность, родительская операция, атрибуты и статус.', 'One operation inside a trace. It has a name, a start time, a duration, a parent operation, attributes and a status.'), introducedIn: 'monitoring.traces', docRef: { page: 'web/opentelemetry.io/traces', anchor: 'spans' } },
  { id: 'obs.context-propagation', term: bi('передача контекста', 'context propagation'), forms: { ru: ['передачи контекста', 'передачу контекста', 'передачей контекста'] }, short: bi('Передача идентификатора трейса trace_id и номера родительского спана span_id от сервиса к сервису, обычно в заголовке traceparent.', 'Passing the trace ID (trace_id) and the parent span number (span_id) from service to service, usually in the traceparent header.'), introducedIn: 'monitoring.traces', docRef: { page: 'web/w3.org/trace-context', anchor: 'traceparent' } },
  { id: 'obs.sampling', term: bi('сэмплирование трейсов', 'trace sampling'), forms: { ru: ['сэмплирования трейсов', 'сэмплированием трейсов'] }, short: bi('Отбор части трейсов для хранения. Решение принимают либо в начале запроса, оставляя заданную долю (head), либо после его конца, оставляя ошибки и медленные запросы (tail).', 'Keeping a share of traces. The decision is made either at the start of a request, keeping a given share (head), or after it ends, keeping errors and slow requests (tail).'), introducedIn: 'monitoring.traces', docRef: { page: 'web/opentelemetry.io/traces', anchor: 'sampling' } },
  { id: 'obs.kube-state-metrics', term: bi('kube-state-metrics', 'kube-state-metrics'), short: bi('Программа, которая превращает поля объектов API Kubernetes в ряды для Prometheus: фазы подов, число перезапусков, число реплик, лимиты.', 'A program that turns the fields of Kubernetes API objects into series for Prometheus: pod phases, restart counts, replica counts, limits.'), introducedIn: 'monitoring.k8s', docRef: { page: 'web/github.com/kube-state-metrics', anchor: 'overview' } },
  { id: 'obs.cadvisor', term: bi('cAdvisor', 'cAdvisor'), short: bi('Часть kubelet, которая читает файлы cgroup каждого контейнера на узле и отдаёт их значения рядами container_*.', 'The part of the kubelet that reads the cgroup files of every container on the node and serves their values as container_* series.'), introducedIn: 'monitoring.k8s', docRef: { page: 'web/github.com/kube-state-metrics', anchor: 'cadvisor' } },
  { id: 'obs.throttling', term: bi('троттлинг CPU', 'CPU throttling'), forms: { ru: ['троттлинга CPU', 'троттлингом CPU'] }, short: bi('Ядро притормаживает контейнер, когда тот израсходовал квоту cpu.max в текущем периоде длиной 100 мс, и не даёт ему работать до начала следующего периода.', 'The kernel holds a container back when it has used up its cpu.max quota in the current 100 ms period, and does not let it run until the next period starts.'), introducedIn: 'monitoring.k8s' },
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
    prompt: bi('Какие из этих полей стоит сделать метками потоков в Loki? Отметьте все подходящие.', 'Which of these fields should become stream labels in Loki? Mark all that fit.'),
    options: [
      { id: 'app', text: 'app', correct: true },
      { id: 'ns', text: 'namespace', correct: true },
      { id: 'user', text: 'user_id', why: bi('У этого поля десятки тысяч значений, и каждое стало бы отдельным потоком с крошечными кусками строк. Пользователя ищут фильтром по содержимому строки.', 'This field has tens of thousands of values, and each would become a separate stream with tiny chunks of lines. A user is found with a filter on the line content.') },
      { id: 'trace', text: 'trace_id', why: bi('У каждого запроса свой trace_id, поэтому каждый запрос стал бы отдельным потоком. trace_id оставляют внутри строки и ищут фильтром |=.', 'Every request has its own trace_id, so every request would become a separate stream. The trace_id stays inside the line and is found with the |= filter.') },
      { id: 'inst', text: 'instance', correct: true },
    ],
    explain: bi('Метками делают то, по чему вы выбираете группу строк. Значений у таких полей немного, и от строки к строке они не меняются.', 'Labels are what you select a group of lines by. Such fields have few values, and they do not change from line to line.'),
  },
  {
    id: 'obs.q.loki-index',
    kind: 'mcq',
    concepts: ['obs.log-stream', 'obs.logql'],
    prompt: bi('Запросы `{app="api"} |= "pool exhausted"` и `{namespace="shop"} |= "pool exhausted"` находят одни и те же строки. Почему первый выполняется быстрее?', 'The queries `{app="api"} |= "pool exhausted"` and `{namespace="shop"} |= "pool exhausted"` find the same lines. Why does the first one run faster?'),
    options: [
      { id: 'scan', text: bi('Loki индексирует только метки, поэтому первый запрос выбирает меньше потоков и перебирает меньше строк', 'Loki indexes only labels: the first query selects fewer streams, so fewer lines need scanning'), correct: true },
      { id: 'index', text: bi('Текст "pool exhausted" есть в индексе только у потоков api', 'The text "pool exhausted" is in the index only for the api streams'), why: bi('Содержимое строк Loki не индексирует, и поэтому хранить журналы в нём дёшево.', 'Loki does not index line content at all, which is why keeping logs in it is cheap.') },
      { id: 'same', text: bi('Оба запроса выполняются одинаково быстро', 'They are equally fast'), why: bi('Фильтр |= проверяет каждую строку выбранных потоков, поэтому чем больше потоков выбрал запрос, тем больше работы.', 'The |= filter checks every line of the selected streams, so the more streams a query selects, the more work there is.') },
    ],
  },
  {
    id: 'obs.q.structured',
    kind: 'mcq',
    concepts: ['obs.structured-log'],
    prompt: bi('Чем строка `{"level":"error","route":"/checkout","status":500,"duration_ms":2004}` лучше строки `ERROR checkout failed after 2004ms (500)`?', 'Why is the line `{"level":"error","route":"/checkout","status":500,"duration_ms":2004}` better than `ERROR checkout failed after 2004ms (500)`?'),
    options: [
      { id: 'fields', text: bi('Поля можно достать по имени, поэтому легко отобрать строки с status >= 500 и посчитать квантили duration_ms, и порядок слов в строке на это не влияет', 'Fields can be taken by name, so it is easy to keep the lines with status >= 500 and compute quantiles of duration_ms, and the word order in the line does not matter'), correct: true },
      { id: 'short', text: bi('Такая строка короче, и её дешевле хранить', 'It is shorter and cheaper to store'), why: bi('Такая строка скорее длиннее. Выигрыш не в размере, а в том, что программа может разобрать её на поля.', 'Such a line is longer, if anything. The gain is not in size but in a program being able to parse it into fields.') },
      { id: 'human', text: bi('Такую строку проще читать человеку', 'It is easier for a human to read'), why: bi('Человек прочитает обе строки, а разница в том, что первую понимает ещё и программа.', 'A human reads both lines; the difference is that a program understands the first one too.') },
    ],
  },
  {
    id: 'obs.q.logql-order',
    kind: 'order',
    concepts: ['obs.logql'],
    prompt: bi('Соберите в правильном порядке запрос, который находит ответы 5xx маршрута /checkout и выводит каждую строку в виде «маршрут сообщение».', 'Put together, in the right order, the query that finds the 5xx answers of /checkout and prints each line as “route message”.'),
    steps: [
      { id: 'sel', text: '{app="api"}' },
      { id: 'line', text: '|= "checkout"', why: bi('Фильтр по тексту ставят до разбора строки, потому что он дешевле и сразу отсекает большинство строк.', 'The text filter goes before the line is parsed, because it is cheaper and drops most lines at once.') },
      { id: 'json', text: '| json' },
      { id: 'label', text: '| status >= 500' },
      { id: 'fmt', text: '| line_format "{{.route}} {{.msg}}"' },
    ],
  },
  {
    id: 'obs.q.count-vs-rate',
    kind: 'match',
    concepts: ['obs.logql'],
    prompt: bi('Что вернёт каждый из этих запросов?', 'What does each of these queries return?'),
    pairs: [
      { id: 'lines', left: '{app="api"} |= "error"', right: bi('сами строки журнала', 'the log lines themselves') },
      { id: 'count', left: 'count_over_time({app="api"} |= "error" [5m])', right: bi('число строк со словом error за пять минут в каждом потоке', 'the number of lines with the word error over five minutes in each stream') },
      { id: 'rate', left: 'sum(rate({app="api"} |= "error" [5m]))', right: bi('сколько строк со словом error в секунду пишет весь сервис api', 'how many lines with the word error per second the whole api service writes') },
      { id: 'q', left: 'quantile_over_time(0.99, {app="api"} | json | unwrap duration_ms [5m]) by (route)', right: bi('p99 длительности по маршрутам, посчитанный по числам из строк', 'the p99 duration by route, computed from the numbers in the lines') },
    ],
  },
  {
    id: 'obs.q.traceparent',
    kind: 'mcq',
    concepts: ['obs.context-propagation'],
    prompt: bi('Сервис frontend вызывает api с заголовком `traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`. Что из этого заголовка api запишет в свой спан?', 'The frontend service calls api with the header `traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`. What of this header does api record in its span?'),
    options: [
      { id: 'ok', text: bi('trace_id 4bf92f… api запишет как свой, 00f067… запишет как номер родителя, а свой span_id создаст новый', 'api records the trace_id 4bf92f… as its own and 00f067… as the parent, and creates a new span_id of its own'), correct: true },
      { id: 'copy', text: bi('Оба идентификатора api запишет как свои', 'api records both IDs as its own'), why: bi('У каждого спана свой span_id. Номер 00f067… принадлежит спану frontend, и этот спан становится родителем.', 'Each span has its own span_id. The number 00f067… belongs to the frontend span, and that span becomes the parent.') },
      { id: 'new', text: bi('Новый trace_id, потому что у каждого сервиса свой трейс', 'A new trace_id, because each service has its own trace'), why: bi('Тогда трейс распался бы на куски. Заголовок для того и передают, чтобы следующий сервис продолжил тот же трейс.', 'Then the trace would fall apart into pieces. The header is passed precisely so that the next service continues the same trace.') },
    ],
  },
  {
    id: 'obs.q.sampling',
    kind: 'mcq',
    concepts: ['obs.sampling'],
    prompt: bi('Ошибка случается в одном заказе из 500. Трейсы отбирают в начале запроса, и сохраняется 10 % из них. Что увидит дежурный?', 'An error happens in one order out of 500. Traces are picked at the start of the request, and 10 % of them are kept. What does the on-call engineer see?'),
    options: [
      { id: 'few', text: bi('Девять из десяти ошибочных заказов останутся без трейса, потому что решение принимали до того, как стало ясно, что будет ошибка', 'Nine out of ten failed orders are left without a trace, because the decision was made before it was clear there would be an error'), correct: true },
      { id: 'all', text: bi('Все ошибочные заказы, потому что ошибки сохраняются всегда', 'All failed orders, because errors are always kept'), why: bi('Так работает отбор после конца трейса (tail) в Collector, а не отбор доли в начале запроса.', 'That is how selection after the end of the trace (tail) works in the Collector, not picking a share at the start.') },
      { id: 'none', text: bi('Дежурный не увидит ни одного трейса', 'No traces at all'), why: bi('Каждый десятый заказ записывается, но ошибки среди них редки.', 'Every tenth order is recorded, but errors among them are rare.') },
    ],
  },
  {
    id: 'obs.q.signals',
    kind: 'match',
    concepts: ['obs.trace', 'obs.structured-log'],
    prompt: bi('Какой источник сведений отвечает на каждый из этих вопросов?', 'Which source of information answers each of these questions?'),
    pairs: [
      { id: 'm', left: bi('Сколько заказов в секунду заканчиваются ошибкой и с каких пор?', 'How many orders per second fail, and since when?'), right: bi('метрики', 'metrics') },
      { id: 'l', left: bi('Что написал сервис об этом отказе?', 'What did the service write about this failure?'), right: bi('журналы', 'logs') },
      { id: 't', left: bi('На каком шаге внутри запроса ушли две секунды?', 'At which step inside the request did the two seconds go?'), right: bi('трейсы', 'traces') },
    ],
  },
  {
    id: 'obs.q.cadvisor-vs-ksm',
    kind: 'multi',
    concepts: ['obs.cadvisor', 'obs.kube-state-metrics'],
    prompt: bi('Какие из этих рядов Prometheus получает от cAdvisor, а не от kube-state-metrics? Отметьте все подходящие.', 'Which of these series does Prometheus get from cAdvisor rather than from kube-state-metrics? Mark all that fit.'),
    options: [
      { id: 'ws', text: 'container_memory_working_set_bytes', correct: true },
      { id: 'thr', text: 'container_cpu_cfs_throttled_periods_total', correct: true },
      { id: 'rs', text: 'kube_pod_container_status_restarts_total', why: bi('Этот ряд отдаёт kube-state-metrics. Значение берётся из поля restartCount в статусе пода, который хранится в API.', 'kube-state-metrics serves this series. The value is the restartCount field of the pod status kept in the API.') },
      { id: 'rep', text: 'kube_deployment_status_replicas_available', why: bi('Этот ряд отдаёт kube-state-metrics. Число доступных реплик записано в статусе объекта Deployment в API, а не в файлах cgroup.', 'kube-state-metrics serves this series. The number of available replicas is written in the status of the Deployment object in the API, not in cgroup files.') },
    ],
    explain: bi('Ряды container_* cAdvisor читает из файлов cgroup на узле, и они описывают потребление. Ряды kube_* kube-state-metrics строит по объектам API, и они описывают состояние.', 'cAdvisor reads the container_* series from the cgroup files on the node, and they describe consumption. kube-state-metrics builds the kube_* series from API objects, and they describe state.'),
  },
  {
    id: 'obs.q.throttle',
    kind: 'mcq',
    concepts: ['obs.throttling'],
    prompt: bi('У контейнера worker стоит `limits.cpu: 200m`. График потребления процессора показывает ровно 0,2 ядра, но задачи обрабатываются вдвое медленнее обычного. Что происходит?', 'The worker container has `limits.cpu: 200m`. The CPU usage graph shows exactly 0.2 cores, but jobs are processed twice as slowly as usual. What is going on?'),
    options: [
      { id: 'thr', text: bi('Процесс упирается в квоту cpu.max и ждёт конца каждого периода. Это троттлинг, и ровная линия графика на уровне лимита как раз его выдаёт', 'The process hits the cpu.max quota and waits for the end of each period. That is throttling, and a graph flat at the limit gives it away'), correct: true },
      { id: 'idle', text: bi('Процессу не нужно больше процессорного времени, а тормозит что-то другое', 'The process needs no more CPU time, and something else is slow'), why: bi('Ровная линия на уровне лимита означает, что процесс упёрся в квоту. Проверьте долю периодов с троттлингом.', 'A flat line at the limit means the process has hit its quota. Check the share of throttled periods.') },
      { id: 'oom', text: bi('Процесс завершает OOM killer', 'The OOM killer ends the process'), why: bi('Лимит процессора процесс не завершает, а только притормаживает. Завершить процесс может ядро, когда процесс выходит за лимит памяти.', 'A CPU limit does not end the process, it only holds it back. The kernel ends a process when it goes over the memory limit.') },
    ],
  },
  {
    id: 'obs.q.absent',
    kind: 'mcq',
    concepts: ['obs.kube-state-metrics'],
    prompt: bi('Алерт `increase(kube_pod_container_status_restarts_total[1h]) > 2` молчит уже неделю, хотя контейнер одного пода всё это время перезапускается каждые 20 минут. Что проверить первым делом?', 'The alert `increase(kube_pod_container_status_restarts_total[1h]) > 2` has been silent for a week, although the container of one pod has been restarting every 20 minutes all that time. What do you check first?'),
    options: [
      { id: 'up', text: bi('Нужно проверить, поступают ли сами ряды. Это видно по ряду `up{job="kube-state-metrics"}`, а на пропажу источника нужен отдельный алерт', 'Check whether the series themselves arrive. The `up{job="kube-state-metrics"}` series shows it, and a missing source needs a separate alert'), correct: true },
      { id: 'thr', text: bi('Нужно снизить порог алерта до > 0', 'Lower the alert threshold to > 0'), why: bi('Если рядов нет, выражение даёт пустой результат при любом пороге.', 'If the series are gone, the expression gives an empty result whatever the threshold.') },
      { id: 'am', text: bi('Нужно проверить маршруты Alertmanager, по которым уходит сообщение', 'Check the Alertmanager routes the message goes by'), why: bi('Такое возможно, но сначала нужно проверить, переходило ли правило в состояние firing, а без рядов оно этого сделать не может.', 'That is possible, but first check whether the rule ever became firing, and without the series it cannot.') },
    ],
  },
  {
    id: 'obs.q.watchdog',
    kind: 'mcq',
    concepts: ['obs.kube-state-metrics'],
    prompt: bi('Под перезапускается уже час, но дежурному ничего не пришло. Запрос к `/api/v1/alerts` у Prometheus возвращает единственный алерт Watchdog в состоянии firing. Какой вывод отсюда следует?', 'A pod has been restarting for an hour, but the on-call engineer got nothing. A request to Prometheus `/api/v1/alerts` returns a single alert, Watchdog, in the firing state. What follows from this?'),
    options: [
      { id: 'source', text: bi('Prometheus исправен, а пропал источник рядов для правила о перезапусках, например kube-state-metrics', 'Prometheus is healthy, and the source of series for the restart rule is gone, such as kube-state-metrics'), correct: true },
      { id: 'prom', text: bi('Prometheus не работает и поэтому не вычисляет правила алертов', 'Prometheus is not working and so does not evaluate alerting rules'), why: bi('Алерт Watchdog горит всегда, и раз Prometheus его вернул, значит, Prometheus отвечает на запросы и вычисляет правила.', 'Watchdog fires all the time, and since Prometheus returned it, Prometheus answers requests and evaluates rules.') },
      { id: 'am', text: bi('Сломан Alertmanager, поэтому сообщение не дошло до дежурного', 'Alertmanager is broken, so the message did not reach the on-call engineer'), why: bi('Список алертов самого Prometheus показывает, что правило о перезапусках даже не перешло в состояние firing. Такому алерту нечего передавать в Alertmanager, поэтому дело не в нём.', 'Prometheus’s own alert list shows that the restart rule never even became firing. Such an alert has nothing to hand to Alertmanager, so Alertmanager is not the cause.') },
      { id: 'fine', text: bi('С подом всё в порядке, раз в списке нет алерта о нём', 'The pod is fine, since the list has no alert about it'), why: bi('Отсутствие алерта не доказывает, что всё хорошо. Правило молчит и тогда, когда рядов, на которых оно построено, нет вовсе, а под тем временем перезапускается.', 'The absence of an alert does not prove that all is well. A rule is silent also when the series it is built on do not exist at all, while the pod keeps restarting.') },
    ],
  },
];

// ── lessons ──

const LOG_GOALS: LogsProps['goals'] = [
  { id: 'errors', prompt: bi('Покажите из журнала api только строки уровня error.', 'Show only the error-level lines of the api log.'), test: (r) => rows(r).length > 0 && rows(r).every((x) => x.labels.app === 'api' && /"level":"error"/.test(x.line)), then: bi('Почти все ошибки повторяют одно и то же сообщение «acquire connection: pool exhausted», значит, сервису не хватает соединений с базой данных.', 'Almost all the errors repeat the same message, “acquire connection: pool exhausted”, so the service runs out of database connections.'), hint: bi('Начните с селектора {app="api"}, потом разберите строку через | json и отфильтруйте её по полю level. Можно обойтись и фильтром по тексту строки "level":"error".', 'Start with the selector {app="api"}, then parse the line with | json and filter it by the level field. A filter on the line text "level":"error" will also do.') },
  { id: 'route', prompt: bi('Оставьте только ответы с кодом 500 на маршруте /checkout.', 'Keep only the answers with status 500 on the /checkout route.'), test: (r) => rows(r).length > 0 && rows(r).every((x) => x.labels.route === '/checkout' && x.labels.status === '500'), then: bi('Все эти ответы длились около двух секунд, и столько же сервис ждёт свободного соединения, прежде чем вернуть ошибку.', 'All these answers took about two seconds, and that is how long the service waits for a free connection before giving up.'), hint: bi('После | json поля строки становятся метками, и по ним можно фильтровать: | route="/checkout" | status = 500.', 'After | json the fields of the line become labels, and you can filter by them: | route="/checkout" | status = 500.') },
  { id: 'count', prompt: bi('Посчитайте, сколько ответов 5xx было на каждом маршруте за последние 15 минут. Нужны числа, а не строки.', 'Count how many 5xx answers there were on each route over the last 15 minutes. You need numbers, not lines.'), test: (r) => r.type === 'vector' && r.data.length >= 2 && r.data.every((s) => !!s.labels.route && Object.keys(s.labels).length === 1) && r.data.reduce((a, b) => (b.value > a.value ? b : a)).labels.route === '/checkout', then: bi('Почти все ошибки приходятся на /checkout. Картина та же, что и в метриках, но теперь видно ещё и сообщение об ошибке.', 'Almost all the errors fall on /checkout. The picture is the same as in the metrics, but now the error message is visible too.'), hint: bi('sum by (route) (count_over_time(… [15m]))', 'sum by (route) (count_over_time(… [15m]))') },
  { id: 'version', prompt: bi('Какая версия api пишет эти ошибки? Посчитайте ошибки за последние 15 минут отдельно для каждого значения поля version.', 'Which api version writes these errors? Count the errors of the last 15 minutes separately for each value of the version field.'), test: (r) => r.type === 'vector' && r.data.length >= 1 && r.data.every((s) => !!s.labels.version) && r.data.reduce((a, b) => (b.value > a.value ? b : a)).labels.version === '2.3.1', then: bi('Ошибки пишет только версия 2.3.1, которую выложили незадолго до начала инцидента.', 'Only version 2.3.1 writes the errors, and it was rolled out right before the incident started.') },
];

export const logsLesson: Lesson = {
  id: 'monitoring.logs',
  block: 'monitoring',
  title: bi('Как по журналам узнать, что случилось с конкретным запросом', 'How logs tell what happened to a particular request'),
  summary: bi('Метрика говорит, сколько и когда, а журнал рассказывает, что произошло с конкретным запросом. Структурированный журнал можно не только читать, но и считать по нему числа.', 'A metric says how much and when, and a log tells what happened to a particular request. A structured log can be not only read but also counted.'),
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
        'Метрики уже сказали главное: с 11:15 каждое четвёртое оформление заказа заканчивается ошибкой 500, а остальные идут по полторы секунды. Но числа не объясняют, что сломалось. Об этом рассказал сам сервис, который на каждый неудачный запрос записал в журнал строку с объяснением. Осталось найти эти строки среди сотен тысяч других, и в этом уроке вы научитесь это делать.',
        'The metrics have already said the main thing: since 11:15 every fourth checkout ends in a 500 error, and the rest take a second and a half. But numbers do not explain what broke. The service itself told that, because for every failed request it wrote a line with an explanation into its log. It remains to find these lines among hundreds of thousands of others, and in this lesson you will learn to do it.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Журнал состоит из записей о событиях, которые программа делает по ходу работы: принят запрос, не удалось подключиться к базе, задача обработана. В контейнере программа пишет эти записи в стандартный вывод, среда контейнеров складывает строки в файлы на узле, а агент читает эти файлы и отправляет строки в хранилище журналов. Агентом служит Grafana Alloy, Fluent Bit или Vector. Сам сервис не знает, где окажутся его строки, и так и должно быть, потому что куда их доставить, решает инфраструктура.\n\nСтроку можно записать свободным текстом, удобным человеку, например `ERROR checkout failed after 2004ms (500)`. Но тогда программе, чтобы достать из строки код ответа, придётся угадывать формат регулярным выражением. Поэтому журнал лучше вести как [[obs.structured-log|структурированный журнал]], в котором каждое событие записано строкой с именованными полями, обычно в формате JSON или logfmt:\n\n```text\n{"level":"error","msg":"acquire connection: pool exhausted (timeout 2s)","route":"/checkout","status":500,"duration_ms":2004,"trace_id":"4bf92f…"}\n```\n\nТакие строки можно отбирать по значению поля, считать и даже вычислять по ним квантили, и порядок слов в строке на это не влияет.\n\n### Как Loki хранит журналы\n\nХранилище журналов Loki устроено по образцу Prometheus. Каждая строка приходит в него с набором меток, например `{namespace="shop", app="api", instance="api-1:8080"}`, и все строки с одинаковым набором меток составляют [[obs.log-stream|поток журнала]]. Loki индексирует только метки потоков, а сами строки хранит сжатыми кусками, без индекса по содержимому. Поэтому хранить журналы дёшево, а искать слово в тексте приходится перебором строк выбранных потоков.\n\nОтсюда то же правило, что и для [[obs.cardinality|кардинальности]] метрик. Метками делают то, по чему вы выбираете группу строк, например сервис, окружение или экземпляр. Поля `user_id` или `trace_id` метками делать нельзя, потому что каждый пользователь стал бы отдельным потоком, индекс разросся бы, а куски строк стали бы крошечными. Такие поля оставляют внутри строки и находят фильтром.\n\n### Запросы LogQL\n\nЗапрос на языке [[obs.logql|LogQL]] начинается с выбора потоков по меткам, как запрос PromQL, а потом строки проходят по цепочке шагов:\n\n```text\n{app="api"} |= "checkout" | json | status >= 500 | line_format "{{.route}} {{.msg}}"\n```\n\nОператоры `|=`, `!=`, `|~` и `!~` фильтруют строки по тексту. Это самые дешёвые шаги, поэтому их ставят первыми. Шаги `| json` и `| logfmt` разбирают строку и превращают её поля в метки, после чего по ним можно фильтровать: `| status >= 500`, `| duration_ms > 1500`, `| route = "/checkout"`. Если строку разобрать не удалось, у неё появится метка `__error__`.\n\nСтроки можно превратить в числа, и тогда LogQL отвечает так же, как PromQL. Запрос `count_over_time({app="api"} |= "error" [5m])` считает, сколько строк было за пять минут в каждом потоке, `rate(…[5m])` считает, сколько их приходится на секунду, а знакомые `sum by (route)` и `topk` сводят результат. Числовое поле строки становится значением ряда через `unwrap`. Например, запрос `quantile_over_time(0.99, {app="api"} | json | unwrap duration_ms [5m]) by (route)` даёт p99 длительности, посчитанный по журналу. Помните, что после разбора строки каждое поле становится меткой, поэтому без `sum by (…)` результат разложится на столько рядов, сколько разных значений у полей.',
        'A log consists of records of events a program makes as it works: a request was accepted, the database could not be reached, a job was processed. In a container the program writes these records to standard output, the container runtime puts the lines into files on the node, and an agent reads those files and sends the lines to a log store. The agent is Grafana Alloy, Fluent Bit or Vector. The service itself does not know where its lines end up, and that is how it should be, because where to deliver them is the infrastructure’s decision.\n\nA line can be written as free text that suits a human, for example `ERROR checkout failed after 2004ms (500)`. But then a program that wants the status code out of the line has to guess the format with a regular expression. So a log is better kept as a [[obs.structured-log|structured log]], in which every event is written as a line with named fields, usually in JSON or logfmt:\n\n```text\n{"level":"error","msg":"acquire connection: pool exhausted (timeout 2s)","route":"/checkout","status":500,"duration_ms":2004,"trace_id":"4bf92f…"}\n```\n\nSuch lines can be selected by a field value, counted and even used to compute quantiles, and the word order in the line does not matter.\n\n### How Loki stores logs\n\nThe Loki log store is built after the model of Prometheus. Every line arrives with a label set, for example `{namespace="shop", app="api", instance="api-1:8080"}`, and all lines with the same label set make up a [[obs.log-stream|log stream]]. Loki indexes only the stream labels and keeps the lines themselves in compressed chunks, with no index on their content. So storing logs is cheap, and finding a word in the text means scanning the lines of the selected streams.\n\nHence the same rule as for the [[obs.cardinality|cardinality]] of metrics. Labels are what you select a group of lines by, such as the service, the environment or the instance. `user_id` or `trace_id` must not become labels, because every user would turn into a separate stream, the index would grow and the chunks of lines would become tiny. Such fields stay inside the line and are found with a filter.\n\n### LogQL queries\n\nA [[obs.logql|LogQL]] query starts by selecting streams by labels, like a PromQL query, and then the lines go through a chain of steps:\n\n```text\n{app="api"} |= "checkout" | json | status >= 500 | line_format "{{.route}} {{.msg}}"\n```\n\nThe operators `|=`, `!=`, `|~` and `!~` filter lines by text. These are the cheapest steps, so they go first. The steps `| json` and `| logfmt` parse the line and turn its fields into labels, after which you can filter by them: `| status >= 500`, `| duration_ms > 1500`, `| route = "/checkout"`. If a line could not be parsed, it gets the label `__error__`.\n\nLines can be turned into numbers, and then LogQL answers just like PromQL. `count_over_time({app="api"} |= "error" [5m])` counts how many lines there were in five minutes in each stream, `rate(…[5m])` how many fall on a second, and the familiar `sum by (route)` and `topk` fold the result. A numeric field of a line becomes the series value through `unwrap`. For example, `quantile_over_time(0.99, {app="api"} | json | unwrap duration_ms [5m]) by (route)` gives the p99 duration straight from the log. Remember that after a line is parsed every field becomes a label, so without `sum by (…)` the result splits into as many series as the fields have distinct values.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как строка журнала попадает в Loki и как её потом находят', 'How a log line gets into Loki and how it is found later'),
      body: bi(
        'Схема ниже повторяет путь одной строки журнала, той самой, которую сервис api записал о неудачном заказе. Сначала на схеме только процесс api, а остальные участники появляются, когда до них доходит строка. В верхнем ряду стоят процесс, файл журнала пода на узле и агент, который этот файл читает. Во втором ряду индекс меток и куски строк, то есть две части хранилища Loki. В нижнем ряду запрос LogQL, которым вы ищете строку, и экран Grafana.',
        'The diagram below follows the path of one log line, the very one the api service wrote about a failed order. At first the diagram shows only the api process; the other participants appear when the line reaches them. The top row holds the process, the pod’s log file on the node and the agent that reads this file. The second row holds the label index and the chunks of lines, the two parts of the Loki store. The bottom row holds the LogQL query you search with and the Grafana screen.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'obs.log-path', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Подсвечен тот участник, который работает сейчас, облачко рядом с ним говорит, что он делает, а по линии движется карточка с тем, что передаётся дальше, то есть со строкой, пачкой строк с метками или запросом. Шкала внутри индекса показывает, насколько он заполнен. Жёлтая рамка означает, что шаг пройден с трудом, потому что индекс разросся или поиск стал ненадёжным. Под схемой есть два счётчика, которые показывают, сколько потоков хранится в индексе и сколько мегабайт строк набирается за сутки.\n\nКогда пройдёте путь до экрана Grafana, откройте «Параметры» и переключите вид строки на свободный текст. Посмотрите, что станет с шагом, на котором запрос ищет ответы с ошибкой. Потом включите переключатель, который добавляет номер пользователя в метки, и следите за числом потоков под схемой. Напоследок включите в блоке «Сломать» поломку, при которой Loki перестаёт принимать строки.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. The participant working now is highlighted, the callout next to it says what it does, and a card moves along the line with what is handed on: a line, a batch of lines with labels, a query. The gauge inside the index shows how full it is. A yellow outline means the step was passed with trouble, because the index grew or the search became unreliable. Under the diagram there are two counters, which show how many streams the index holds and how many megabytes of lines pile up per day.\n\nOnce you reach the Grafana screen, open “Parameters” and switch the line format to free text. See what happens to the step where the query looks for error answers. Then switch on the toggle that adds the user number to the labels and watch the stream count under the diagram. Finally, switch on the break in “Break it” in which Loki stops accepting lines.'), caption: bi('Тот же путь проходят строки, которые вы будете искать ниже. В виджете журналов начните с селектора `{app="api"}`, как запрос на схеме, и сразу добавьте `| json`. Строки магазина записаны в JSON, поэтому код ответа и маршрут можно брать по имени поля.', 'The lines you will search for below take the same path. In the log widget, start with the selector `{app="api"}`, as the query in the diagram does, and add `| json` at once. The shop’s lines are JSON, so the status code and the route can be taken by field name.') },
    { id: 'explore', kind: 'widget', step: 'practice', widget: 'obs.logs', props: { incident: 'checkout', query: '{app="api"}', goals: LOG_GOALS, title: bi('Журналы магазина во время инцидента', 'The Shop logs during the incident') } satisfies LogsProps },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: monSetup('checkout'),
      intro: bi('С тем же хранилищем Loki можно работать из терминала. Команда `logcli query` выводит строки, команда `logcli instant-query` выводит числа, а команда `logcli labels` показывает, какие метки есть в журналах.', 'You can work with the same Loki store from the terminal. `logcli query` prints lines, `logcli instant-query` prints numbers, and `logcli labels` shows which labels the logs have.'),
      tasks: [
        {
          id: 'tail',
          prompt: bi('Выведите пять последних строк журнала сервиса worker.', 'Print the last five lines of the worker service log.'),
          check: { when: (f) => outOf(f).split('\n').filter((l) => /processed order \d+/.test(l)).length === 5 },
          chips: `logcli query --limit=5 '{app="worker"}'`,
          concepts: ['obs.log-stream'],
          docRef: { page: 'help/logcli' },
          hints: { H1: bi('Выберите поток по метке app и ограничьте число строк ключом --limit.', 'Select the stream by the app label and limit the number of lines with the --limit key.') },
        },
        {
          id: 'count',
          prompt: bi('Сколько ответов с кодом 502 отдал сервис frontend за последние 30 минут? Получите одно число одним запросом. Учтите, что frontend пишет журнал в формате logfmt.', 'How many answers with status 502 did the frontend service give over the last 30 minutes? Get one number with one query. Note that frontend writes its log in logfmt.'),
          check: {
            when: (f) => {
              const v = lastValue(outOf(f));
              return v !== null && jsonVector(outOf(f)).length === 1 && Math.abs(v - expectedCount('checkout', 'sum(count_over_time({app="frontend"} | logfmt | status="502" [30m]))')) < 0.5;
            },
            fail: [{ if: (f) => jsonVector(outOf(f)).length > 1, say: bi('Получилось много рядов, потому что после logfmt каждое поле стало меткой. Сложите их в один ряд через sum(…).', 'You got many series, because after logfmt every field became a label. Add them into one series with sum(…).') }],
          },
          chips: `logcli instant-query 'sum(count_over_time({app="frontend"} | logfmt | status="502" [30m]))'`,
          concepts: ['obs.logql'],
          docRef: { page: 'web/grafana.com/loki/logql', anchor: 'metric-queries' },
          hints: { H1: bi('Посчитайте строки функцией count_over_time по окну 30m и оберните её в sum.', 'Count the lines with count_over_time over a 30m window and wrap it in sum.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('На странице о языке LogQL найдите раздел, который объясняет, как превратить строки журнала в числа.', 'On the LogQL page find the section that explains how to turn log lines into numbers.'),
      ref: { page: 'web/grafana.com/loki/logql' },
      answer: 'metric-queries',
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Для разбора нужно знать, с чего всё началось. Выведите три самые ранние за последний час строки уровня error из потока stdout сервиса api в том порядке, в каком они были записаны, начиная с самой старой. По умолчанию logcli показывает новые строки первыми, а нужный ключ найдите в выводе `logcli --help`.', 'The review needs to know how it all began. Print the three earliest error-level lines of the last hour from the stdout stream of the api service in the order they were written, starting with the oldest. By default logcli shows the newest lines first; find the key you need in the output of `logcli --help`.'),
      ref: { page: 'help/logcli' },
      terminal: {
        setup: monSetup('checkout'),
        task: {
          id: 'forward',
          prompt: bi('Выведены три самые ранние строки уровня error за последний час, по порядку.', 'The three earliest error-level lines of the last hour are printed, in order.'),
          check: {
            when: (f) => {
              const want = flatEntries(runLogQL(logDataset('checkout'), '{app="api", stream="stdout"} | json | level="error"', { since: 3_600_000, limit: 3, direction: 'forward' }), true).map((x) => /"trace_id":"(\w+)"/.exec(x.line)?.[1]);
              const got = traceIds(outOf(f));
              return got.length === 3 && got.every((id, i) => id === want[i]);
            },
            fail: [{ if: (f) => /\|/.test((f.term.main ?? []).at(-1)?.line.replace(/'[^']*'|"[^"]*"/g, '') ?? ''), say: bi('Запустите logcli без конвейера. Проверка узнаёт строки по их trace_id, а команда после вертикальной черты обрезала или изменила вывод.', 'Run logcli without a pipeline. The check recognises the lines by their trace_id, and the command after the vertical bar cut or changed the output.') }],
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
  { id: 'slow', prompt: bi('Найдите и откройте трейс оформления заказа на маршруте /checkout, который шёл дольше 1,5 секунды.', 'Find and open a checkout trace on the /checkout route that took longer than 1.5 seconds.'), test: (s) => slowCheckout(s), then: bi('Корневой спан frontend охватывает весь заказ, а под ним лежат спан api и его дочерние операции.', 'The whole order is covered by the root frontend span, and under it lie the api span and its child operations.'), hint: bi('Выберите маршрут /checkout и длительность от 1500 мс.', 'Choose the route /checkout and a duration from 1500 ms.') },
  { id: 'span', prompt: bi('Какая операция внутри этого заказа заняла больше всего времени? Выберите на водопаде её спан.', 'Which operation inside this order took the most time? Pick its span on the waterfall.'), test: (s) => slowCheckout(s) && s.span?.name === 'db.pool.acquire', then: bi('Почти всё время заказ ждёт свободного соединения из пула. В атрибутах спана видно, что заняты все 20 соединений из 20 (used = max = 20).', 'Nearly all the time the order waits for a free connection from the pool. The span attributes show that all 20 connections out of 20 are busy (used = max = 20).') },
  { id: 'nplus1', prompt: bi('Найдите медленный заказ, который всё-таки дождался соединения, и выберите один из повторяющихся запросов к базе.', 'Find a slow order that did get a connection in the end, and pick one of the repeated database queries.'), test: (s) => slowCheckout(s) && s.span?.name === 'SELECT products' && (s.trace?.spans.filter((x) => (x as { name: string }).name === 'SELECT products').length ?? 0) >= 3, then: bi('Сервис делает отдельный SELECT на каждый товар корзины, потому что в версии 2.3.1 пропал JOIN, который доставал все товары одним запросом. Каждый заказ держит соединение дольше, и соединения в пуле кончаются.', 'The service makes a separate SELECT for every cart item, because version 2.3.1 lost the JOIN that fetched all items in one query. Every order holds its connection longer, and the pool runs out of connections.') },
  { id: 'from-log', prompt: bi('Возьмите trace_id из любой строки уровня error в журнале api (в виджете журналов выше или через logcli) и откройте трейс с этим идентификатором.', 'Take the trace_id from any error-level line of the api log (in the log widget above or with logcli) and open the trace with that ID.'), test: (s) => !!s.search.traceId && s.trace?.traceId === s.search.traceId && s.trace.spans.some((x) => x.status === 'error'), then: bi('Строка журнала и трейс рассказывают об одном и том же запросе: журнал говорит, что случилось, а трейс показывает, где ушло время.', 'The log line and the trace tell about the same request: the log says what happened, and the trace shows where the time went.') },
];

export const tracesLesson: Lesson = {
  id: 'monitoring.traces',
  block: 'monitoring',
  title: bi('Как по трейсу найти, на что ушло время', 'How a trace shows where the time went'),
  summary: bi('Трейс показывает путь одного запроса через все сервисы в виде дерева операций, у каждой из которых видно её время. Связывает сервисы один заголовок, который каждый сервис передаёт следующему.', 'A trace shows the path of one request through all services as a tree of operations, each with its time. What ties the services together is one header that each service passes to the next.'),
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
        'Журнал сообщил, что в пуле кончились соединения («pool exhausted»). Но и те заказы, которые соединение получили, всё равно идут полторы секунды, а каждый заказ проходит через frontend, api и базу данных. Какая из операций стала дольше? Метрики дают картину по всем запросам сразу, вплоть до квантилей латентности, журнал даёт отдельные строки, а здесь нужен путь одного запроса целиком, от начала до конца. Такой путь записывает трейс, и в этом уроке вы научитесь его читать.',
        'The log reported that the pool ran out of connections (“pool exhausted”). But even the orders that did get a connection still take a second and a half, and every order passes through frontend, api and the database. Which of the operations got longer? Metrics give a picture of all requests at once, down to the latency quantiles, a log gives separate lines, and here you need the path of one request as a whole, from start to end. A trace records that path, and in this lesson you will learn to read it.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        '[[obs.trace|Трейс]] записывает путь одного запроса через все сервисы. Он состоит из [[obs.span|спанов]], и каждый спан описывает одну операцию. У спана есть имя (`POST /checkout`, `SELECT products`), время начала, длительность, статус и атрибуты, например маршрут, код ответа или текст запроса к базе. Каждый спан, кроме первого, знает свой родительский спан, поэтому спаны складываются в дерево. На экране это дерево рисуют «водопадом»: каждая операция показана полоской на шкале времени, а дочерние полоски лежат под родительской. Самая длинная полоска в глубине водопада и отвечает на вопрос, где ушло время.\n\nСпаны одного трейса пишут разные программы на разных машинах. Объединяет их общий идентификатор trace_id, а в следующий сервис он попадает благодаря [[obs.context-propagation|передаче контекста]]. Вызывая api, frontend добавляет к запросу заголовок по стандарту W3C:\n\n```text\ntraceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01\n```\n\nВ заголовке записаны версия формата, trace_id, номер вызывающего спана span_id и флаг, который говорит, что трейс записывается. api читает заголовок, оставляет trace_id прежним, а спан frontend записывает родителем своего спана. Если хотя бы один сервис на пути не прочитал заголовок или не передал его дальше, трейс распадается на два несвязанных куска.\n\nВручную спаны почти не пишут. Библиотеки OpenTelemetry сами создают спаны для входящих HTTP-запросов, для вызовов других сервисов и для обращений к базе, а вручную добавляют только важные внутренние шаги. Готовые спаны уходят по протоколу OTLP в OpenTelemetry Collector, и Collector отправляет их в хранилище трейсов, например в Grafana Tempo или Jaeger, а при необходимости сразу в несколько хранилищ.\n\n### Какие трейсы хранить\n\nХранить трейс каждого запроса дорого, поэтому применяют [[obs.sampling|сэмплирование трейсов]], то есть сохраняют только часть. Отбор в начале запроса (head), например «записываем каждый десятый», обходится дёшево. Но решение принимают, когда ещё неизвестно, будет ли запрос медленным или закончится ли он ошибкой, и редкие сбои пропадают вместе с ненужными трейсами. Отбор в конце запроса (tail) выполняет Collector, который дожидается завершения трейса и оставляет все ошибки и все медленные запросы, а из обычных только малую долю.\n\nТри источника сведений дополняют друг друга. Метрики отвечают, сколько и с каких пор, журналы рассказывают, что случилось, а трейсы показывают, где это случилось. Если сервис пишет trace_id в каждую строку журнала, от строки можно перейти к её трейсу и обратно, и на этом в Grafana построен переход от метрики к трейсу и от трейса к журналу.',
        'A [[obs.trace|trace]] records the path of one request through all services. It consists of [[obs.span|spans]], and each span describes one operation. A span has a name (`POST /checkout`, `SELECT products`), a start time, a duration, a status and attributes such as the route, the status code or the text of a database query. Every span except the first knows its parent span, so spans form a tree. On screen this tree is drawn as a “waterfall”: each operation is a bar on a time scale, and child bars lie under their parent. The longest bar deep in the waterfall answers the question of where the time went.\n\nThe spans of one trace are written by different programs on different machines. What unites them is a common trace_id, and it gets into the next service through [[obs.context-propagation|context propagation]]. Calling api, frontend adds a W3C standard header to the request:\n\n```text\ntraceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01\n```\n\nThe header holds the format version, the trace_id, the span_id of the calling span and a flag saying the trace is being recorded. api reads the header, keeps the trace_id and records the frontend span as the parent of its own span. If even one service on the path did not read the header or did not pass it on, the trace falls apart into two unrelated pieces.\n\nSpans are hardly ever written by hand. The OpenTelemetry libraries create spans themselves for incoming HTTP requests, for calls to other services and for database access, and only important internal steps are added by hand. Finished spans go over the OTLP protocol to the OpenTelemetry Collector, which sends them to a trace store such as Grafana Tempo or Jaeger, and to several stores at once if needed.\n\n### Which traces to keep\n\nKeeping a trace of every request is expensive, so [[obs.sampling|trace sampling]] is used: only a share is kept. Deciding at the start of a request (head), say “record every tenth”, is cheap. But the decision is made when nobody yet knows whether the request will be slow or end in an error, and rare failures vanish together with the unneeded traces. Deciding at the end of a request (tail) is done by the Collector, which waits for the trace to complete and keeps every error and every slow request, and only a small share of the ordinary ones.\n\nThe three sources of information complement each other. Metrics answer how much and since when, logs tell what happened, and traces show where it happened. If a service writes the trace_id into every log line, you can jump from a line to its trace and back, and Grafana’s jump from a metric to a trace and from a trace to a log rests on that.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как три сервиса записывают один трейс', 'How three services record one trace'),
      body: bi(
        'Схема ниже показывает, как записывается трейс одного заказа. Сначала на ней только frontend, а остальные участники появляются, когда до них доходит заказ. В верхнем ряду стоят три участника заказа: frontend, api и база данных postgres. Ниже слева OpenTelemetry Collector и хранилище трейсов, а справа журнал api, в строки которого попадает тот же trace_id. Пунктир от api к журналу означает не вызов, а общую метку.',
        'The diagram below shows how the trace of one order is recorded. At first it shows only frontend; the other participants appear when the order reaches them. The top row holds the three participants of the order: frontend, api and the postgres database. Below on the left are the OpenTelemetry Collector and the trace store, and on the right the api log, whose lines get the same trace_id. The dashed line from api to the log means not a call but a shared mark.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'obs.trace-path', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко у подсвеченного участника говорит, что он делает, а по линии движется карточка с тем, что передаётся, то есть с заголовком traceparent, запросами к базе или пачками спанов. Под схемой растёт водопад, как в Grafana Tempo, и каждая полоска в нём показывает, сколько миллисекунд заняла одна операция, и самую длинную полоску видно сразу.\n\nКогда заказ дойдёт до хранилища, откройте «Параметры» и увеличьте число запросов к базе на один заказ до 12, как в версии 2.3.1. Посмотрите, какая полоска водопада выросла сильнее всех. Потом поменяйте правило, по которому Collector отбирает трейсы, и следите за счётчиком сохранённых трейсов. Напоследок включите в блоке «Сломать» поломку, при которой api не читает заголовок traceparent, и посчитайте, сколько трейсов получится у одного заказа.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout at the highlighted participant says what it does, and a card moves along the line with what is handed on, that is, with the traceparent header, database queries or batches of spans. Under the diagram a waterfall grows, as in Grafana Tempo, and each bar in it shows how many milliseconds one operation took, and the longest bar is visible at once.\n\nOnce the order reaches the store, open “Parameters” and raise the number of database queries per order to 12, as in version 2.3.1. See which bar of the waterfall grew most. Then change the rule by which the Collector picks traces and watch the counter of kept traces. Finally, switch on the break in “Break it” in which api does not read the traceparent header, and count how many traces one order gets.'), caption: bi('Лесенку из одинаковых запросов SELECT и долгое ожидание соединения вы сейчас найдёте в настоящих трейсах магазина. Сначала посмотрите в журнале ниже, какие строки об ошибках записал api, а потом откройте трейсы и найдите тот же рисунок, что был на схеме при двенадцати запросах к базе.', 'The staircase of identical SELECT queries and the long wait for a connection are what you will now find in the shop’s real traces. First look at which error lines api wrote in the log below, then open the traces and find the same picture the diagram showed with twelve database queries.') },
    { id: 'logs', kind: 'widget', step: 'try', widget: 'obs.logs', props: { incident: 'checkout', query: '{app="api"} | json | level="error"', title: bi('Строки журнала с trace_id', 'Log lines with a trace_id') } satisfies LogsProps },
    { id: 'viewer', kind: 'widget', step: 'practice', widget: 'obs.traces', props: { incident: 'checkout', goals: TRACE_GOALS, title: bi('Трейсы магазина за последний час', 'The Shop traces of the last hour') } satisfies TracesProps },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Какая часть заголовка traceparent говорит следующему сервису, что трейс записывается? Найдите в спецификации раздел, который её описывает.', 'Which part of the traceparent header tells the next service that the trace is being recorded? Find the section of the specification that describes it.'),
      ref: { page: 'web/w3.org/trace-context' },
      answer: 'trace-flags',
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['obs.q.traceparent', 'obs.q.sampling', 'obs.q.signals'] },
  ],
};

const K8S_GOALS: WorkbenchProps['goals'] = [
  { id: 'restarts', prompt: bi('Какие контейнеры перезапускались за последний час? Покажите только их.', 'Which containers restarted over the last hour? Show only them.'), test: (r) => vecOf(r).length === 1 && vecOf(r)[0].labels.pod === 'api-6f9c7d-q7rvn' && vecOf(r)[0].value >= 2, then: bi('Один под api перезапускается раз в двадцать минут, а остальные работают без перезапусков.', 'One api pod restarts every twenty minutes, and the others run without restarts.'), hint: bi('Посчитайте прирост через increase(… [1h]) и оставьте ряды со значением > 0.', 'Compute the growth with increase(… [1h]) and keep the series with a value > 0.') },
  { id: 'reason', prompt: bi('Почему этот контейнер завершается? Покажите причину, по которой он завершился в последний раз.', 'Why does this container end? Show the reason it ended last time.'), test: (r) => vecOf(r).some((s) => s.labels.reason === 'OOMKilled'), then: bi('Причина OOMKilled означает, что контейнер вышел за limits.memory и ядро завершило его процесс.', 'The reason OOMKilled means the container went over limits.memory and the kernel ended its process.') },
  { id: 'memory', prompt: bi('Для каждого пода в пространстве имён shop посчитайте наибольшее потребление памяти за последний час и разделите его на лимит памяти.', 'For every pod in the shop namespace, take the highest memory use over the last hour and divide it by the memory limit.'), test: (r) => vecOf(r).length >= 6 && vecOf(r).every((s) => !!s.labels.pod && s.value > 0 && s.value <= 1.01) && (vecOf(r).find((s) => s.labels.pod === 'api-6f9c7d-q7rvn')?.value ?? 0) > 0.95, then: bi('Под q7rvn доходит до 99 % лимита, а остальные поды только до 40–55 %. Значит, память утекает в одном экземпляре, а лимит в целом достаточен.', 'The q7rvn pod reaches 99 % of its limit, and the other pods only 40–55 %. So memory leaks in one instance, while the limit is enough on the whole.'), hint: bi('Разделите max_over_time(container_memory_working_set_bytes{namespace="shop"}[1h]) на container_spec_memory_limit_bytes{namespace="shop"} и сведите результат по поду через by (pod).', 'Divide max_over_time(container_memory_working_set_bytes{namespace="shop"}[1h]) by container_spec_memory_limit_bytes{namespace="shop"} and fold the result by pod with by (pod).') },
  { id: 'throttle', prompt: bi('Какая доля периодов длиной 100 мс за последние пять минут прошла у каждого пода с троттлингом?', 'What share of the 100 ms periods over the last five minutes was throttled for each pod?'), test: (r) => vecOf(r).length >= 6 && vecOf(r).every((s) => !!s.labels.pod) && (vecOf(r).find((s) => s.labels.pod?.startsWith('worker'))?.value ?? 0) > 0.4, then: bi('Ядро притормаживает worker больше чем в половине периодов, потому что ему нужно больше процессорного времени, чем 200m. Из-за этого очередь заказов и разбирается медленно.', 'The kernel holds worker back in more than half the periods, because it needs more CPU time than 200m. That is why the order queue is processed slowly.'), hint: bi('Разделите rate от throttled_periods на rate от periods, сложив оба по подам через sum by (pod).', 'Divide the rate of throttled_periods by the rate of periods, adding both up per pod with sum by (pod).') },
  { id: 'replicas', prompt: bi('У какого Deployment доступных реплик меньше, чем указано в его описании?', 'Which Deployment has fewer available replicas than its spec orders?'), test: (r) => vecOf(r).length === 1 && vecOf(r)[0].labels.deployment === 'worker', then: bi('Второй под worker остаётся в состоянии Pending, потому что ни на одном узле не хватает свободного процессорного времени, которое он запросил.', 'The second worker pod stays Pending, because no node has the free CPU time it requested.') },
];

const RULES0 = 'groups:\n  - name: shop-k8s\n    rules: []\n';

export const k8sLesson: Lesson = {
  id: 'monitoring.k8s',
  block: 'monitoring',
  title: bi('Kubernetes как источник метрик', 'Kubernetes as a source of metrics'),
  summary: bi('Сколько контейнер потребляет, знает ядро через cgroup, а эти сведения отдаёт cAdvisor. Сколько контейнеру положено и что с ним случилось, знает API, а эти сведения отдаёт kube-state-metrics. Вместе два источника отвечают на вопросы метода USE для каждого пода.', 'What a container consumes, the kernel knows through cgroups, and cAdvisor serves that. What the container is entitled to and what happened to it, the API knows, and kube-state-metrics serves that. Together the two sources answer the USE questions for every pod.'),
  introduces: ['obs.kube-state-metrics', 'obs.cadvisor', 'obs.throttling'],
  uses: ['obs.use', 'obs.red', 'obs.rate', 'obs.aggregation', 'obs.alert-rule', 'k8s.pod', 'k8s.resources', 'k8s.deployment', 'linux.cgroup', 'linux.oom', 'k8s.helm'],
  tier: 'core',
  minutes: 40,
  sources: src([S.ksm, S.k8sMetrics, S.cgroupv2, S.use], [S.ruK8sMon, S.ruCgroups]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Магазин переехал в Kubernetes, и дашборд RED в целом зелёный. Но раз в двадцать минут у части пользователей пропадает корзина, а очередь заказов разбирается всё медленнее. Метрики приложения об этом молчат, потому что приложение не знает, что ядро его завершает и притормаживает. Это знают ядро узла и API кластера, и в этом уроке вы научитесь спрашивать у них.',
        'The shop moved into Kubernetes, and the RED dashboard is green on the whole. But every twenty minutes some users lose their cart, and the order queue is processed slower and slower. The application metrics are silent about it, because the application does not know the kernel ends it and holds it back. The node kernel and the cluster API know it, and in this lesson you will learn to ask them.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'В блоке Linux вы ограничивали процесс через [[linux.cgroup|cgroup]] и видели, как OOM killer завершает процесс, который вышел за memory.max. Под в Kubernetes устроен так же, и для каждого его контейнера kubelet создаёт cgroup и записывает в её файлы то, что задано в [[k8s.resources|requests и limits]]. Значение `limits.memory: 512Mi` попадает в файл `memory.max`, а значение `limits.cpu: 200m` превращается в строку `20000 100000` в файле `cpu.max`, то есть в двадцать миллисекунд процессора на каждые сто.\n\nОтсюда берётся первый источник метрик. [[obs.cadvisor|cAdvisor]], встроенный в kubelet, читает файлы cgroup всех контейнеров узла и отдаёт их значения по адресу `/metrics/cadvisor`. Ряд `container_memory_working_set_bytes` показывает ту память, которую ядро сравнивает с лимитом, а `container_spec_memory_limit_bytes` показывает сам лимит. Счётчик `container_cpu_usage_seconds_total` считает потраченное процессорное время. Счётчики `container_cpu_cfs_periods_total` и `container_cpu_cfs_throttled_periods_total` считают, сколько прошло периодов по 100 мс и в скольких из них контейнер упёрся в квоту.\n\nПоследний счётчик и измеряет [[obs.throttling|троттлинг CPU]]. Лимит процессора, в отличие от лимита памяти, процесс не завершает. Когда контейнер израсходовал квоту текущего периода, ядро не даёт ему работать до начала следующего. График потребления при этом выглядит спокойным, ровной линией на уровне лимита, а задержки тем временем растут. Поэтому смотрят не только на потребление, но и на долю периодов с троттлингом:\n\n```promql\nsum by (pod) (rate(container_cpu_cfs_throttled_periods_total[5m]))\n  / sum by (pod) (rate(container_cpu_cfs_periods_total[5m]))\n```\n\nВторым источником служит [[obs.kube-state-metrics|kube-state-metrics]]. Он следит за объектами API и превращает их поля в ряды. Ряд `kube_pod_status_phase` показывает фазу пода, `kube_pod_container_status_restarts_total` показывает число перезапусков, а `kube_pod_container_status_last_terminated_reason` показывает, почему контейнер завершился в последний раз. Ряды `kube_deployment_spec_replicas` и `kube_deployment_status_replicas_available` говорят, сколько реплик указано в описании и сколько из них готово. Эти ряды описывают не потребление, а состояние, то есть то, что вы попросили у кластера, и то, что получилось.\n\n### Метод USE для контейнера\n\nС двумя источниками можно задать каждому поду три вопроса [[obs.use|метода USE]]. Использование показывают память и процессорное время по отношению к лимитам. Насыщение показывают доля периодов с троттлингом и поды, которые остаются в состоянии Pending, потому что на узлах для них не нашлось места. Ошибки показывают завершения с причиной OOMKilled и перезапуски. Метод RED по-прежнему смотрит на сервис глазами пользователя, а метод USE объясняет, какой ресурс под сервисом кончился.\n\n### Как Prometheus находит цели в кластере\n\nВ первом уроке блока список целей был записан в файле `prometheus.yml` вручную. В кластере поды появляются и исчезают при каждой выкладке и каждом перезапуске, и такой список вручную не поддержать. Поэтому Prometheus сам спрашивает API-сервер, какие узлы, поды и сервисы сейчас есть, и строит список целей по ответу. В настройках Prometheus за это отвечает раздел `kubernetes_sd_configs`. Чаще всего Prometheus ставят в кластер [[k8s.helm|Helm]]-чартом kube-prometheus-stack, и тогда цели описывают объектами ServiceMonitor и PodMonitor. ServiceMonitor выбирает по меткам сервисы Kubernetes и называет порт сервиса, с которого нужно забирать страницу `/metrics`, а PodMonitor так же выбирает поды напрямую, без сервиса. Эти объекты читает Prometheus Operator, который ставится тем же чартом, и превращает их в настройки Prometheus. В kube-prometheus-stack Prometheus по умолчанию берёт только те ServiceMonitor, у которых есть метка `release` с именем установки чарта, поэтому объект без такой метки он не замечает, и цель не появляется в списке целей. Кроме Prometheus и оператора чарт ставит Alertmanager, Grafana, kube-state-metrics, node-exporter, который на каждом узле отдаёт метрики самой машины (загрузку процессора, память и место на дисках), и правила алертов для кластера. Целью становится и kubelet каждого узла со встроенным cAdvisor. Опрос в этом чарте по умолчанию идёт раз в 30 секунд, то есть вдвое реже, чем в примере из первого урока.\n\nОстаётся одно предостережение. Если kube-state-metrics перестал работать, его ряды не превратятся в нули, а исчезнут. Тогда правило `increase(kube_pod_container_status_restarts_total[1h]) > 2` будет молчать так же, как молчало бы в здоровом кластере. Поэтому на каждый важный источник рядов ставят отдельный алерт о том, что источник пропал, например `up{job="kube-state-metrics"} == 0` или `absent(…)`.',
        'In the Linux block you limited a process through a [[linux.cgroup|cgroup]] and saw the OOM killer end the process that went over memory.max. A Kubernetes pod is built the same way, and for each of its containers the kubelet creates a cgroup and writes into its files what is set in [[k8s.resources|requests and limits]]. `limits.memory: 512Mi` goes into the `memory.max` file, and `limits.cpu: 200m` turns into the line `20000 100000` in `cpu.max`, that is, twenty milliseconds of CPU for every hundred.\n\nThis gives the first source of metrics. [[obs.cadvisor|cAdvisor]], built into the kubelet, reads the cgroup files of every container on the node and serves their values at `/metrics/cadvisor`. The series `container_memory_working_set_bytes` shows the memory the kernel compares with the limit, and `container_spec_memory_limit_bytes` shows the limit itself. The counter `container_cpu_usage_seconds_total` counts the CPU time spent. The counters `container_cpu_cfs_periods_total` and `container_cpu_cfs_throttled_periods_total` count how many 100 ms periods passed and in how many of them the container hit its quota.\n\nThe last counter is what measures [[obs.throttling|CPU throttling]]. A CPU limit, unlike a memory limit, does not end the process. When a container has used up the quota of the current period, the kernel does not let it run until the next one begins. The usage graph looks calm meanwhile, a flat line at the limit, while latency grows. So you look not only at usage but at the share of throttled periods:\n\n```promql\nsum by (pod) (rate(container_cpu_cfs_throttled_periods_total[5m]))\n  / sum by (pod) (rate(container_cpu_cfs_periods_total[5m]))\n```\n\nThe second source is [[obs.kube-state-metrics|kube-state-metrics]]. It watches API objects and turns their fields into series. `kube_pod_status_phase` shows the pod phase, `kube_pod_container_status_restarts_total` the number of restarts, and `kube_pod_container_status_last_terminated_reason` why the container ended last time. `kube_deployment_spec_replicas` and `kube_deployment_status_replicas_available` say how many replicas were ordered and how many of them are ready. These series describe not consumption but state, that is, what you asked of the cluster and what came out.\n\n### The USE method for a container\n\nWith the two sources you can ask every pod the three questions of the [[obs.use|USE method]]. Utilisation is shown by memory and CPU time relative to the limits. Saturation is shown by the share of throttled periods and by pods that stay Pending because the nodes had no room for them. Errors are shown by terminations with the reason OOMKilled and by restarts. The RED method still looks at the service through the user’s eyes, and the USE method explains which resource under the service ran out.\n\n### How Prometheus finds targets in a cluster\n\nIn the first lesson of the block the target list was written into `prometheus.yml` by hand. In a cluster pods appear and vanish with every rollout and every restart, and such a list cannot be kept by hand. So Prometheus asks the API server itself which nodes, pods and services exist now and builds the target list from the answer. In the Prometheus settings the `kubernetes_sd_configs` section is in charge of this. Most often Prometheus is installed into the cluster with the kube-prometheus-stack [[k8s.helm|Helm]] chart, and then targets are described with ServiceMonitor and PodMonitor objects. A ServiceMonitor selects Kubernetes services by labels and names the service port to fetch the `/metrics` page from, and a PodMonitor selects pods directly, without a service, in the same way. These objects are read by the Prometheus Operator, which the same chart installs, and turned into Prometheus settings. In kube-prometheus-stack Prometheus by default picks up only the ServiceMonitors that carry a `release` label with the name of the chart installation, so it does not notice an object without that label, and the target never appears in the target list. Besides Prometheus and the operator the chart installs Alertmanager, Grafana, kube-state-metrics, node-exporter, which serves the metrics of the machine itself on every node (CPU load, memory and disk space), and alerting rules for the cluster. The kubelet of every node with its built-in cAdvisor becomes a target too. The chart scrapes every 30 seconds by default, that is, half as often as in the example of the first lesson.\n\nOne warning remains. If kube-state-metrics stops working, its series do not turn into zeros; they vanish altogether. Then the rule `increase(kube_pod_container_status_restarts_total[1h]) > 2` stays silent just as it would in a healthy cluster. That is why every important source of series gets a separate alert that the source is gone, such as `up{job="kube-state-metrics"} == 0` or `absent(…)`.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Откуда берутся ряды о памяти и процессоре контейнера', 'Where the series about a container’s memory and CPU come from'),
      body: bi(
        'Схема ниже показывает, откуда Prometheus узнаёт и о перезапусках пода api, и о медленной очереди worker. Сначала на ней только процесс api в своём поде, обведённом пунктиром. Широкая полоса внизу изображает ядро узла с файлами cgroup пода, а над ней стоит kubelet со встроенным cAdvisor. В верхнем ряду стоят объект пода в API Kubernetes и kube-state-metrics. Справа от kubelet стоит Prometheus, а ещё правее находится запрос PromQL, который сводит оба источника вместе.',
        'The diagram below shows where Prometheus learns both about the restarts of the api pod and about the slow worker queue. At first it shows only the api process in its pod, outlined with a dashed line. The wide strip at the bottom stands for the node kernel with the pod’s cgroup files, and above it is the kubelet with built-in cAdvisor. The top row holds the pod object in the Kubernetes API and kube-state-metrics. To the right of the kubelet is Prometheus, and further right the PromQL query that brings both sources together.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'obs.container-metrics', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко у подсвеченного участника говорит, что он делает, а по линии движется карточка с тем, что передаётся дальше, то есть со значениями из файлов cgroup, полями объекта пода или рядами. Жёлтая рамка означает, что ресурс на пределе, а красная рамка означает, что ядро завершило процесс или пропал источник рядов. Под схемой есть три счётчика, которые показывают память по отношению к лимиту, долю периодов с троттлингом и число перезапусков.\n\nКогда дойдёте до ответа запроса, откройте «Параметры» и в группе «Память контейнера» увеличьте память, которая нужна процессу, так, чтобы она превысила лимит. Ядро завершит процесс, и это увидят оба источника. Потом в группе «Процессор контейнера» поставьте лимит 200m и потребность 0,5 ядра и посмотрите на долю периодов с троттлингом. Напоследок включите в блоке «Сломать» остановку kube-state-metrics и обратите внимание, что ряды kube_* не обнулились, а исчезли.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout at the highlighted participant says what it does, and a card moves along the line with what is handed on, that is, with values from cgroup files, fields of the pod object or series. A yellow outline means a resource is at its limit, and a red outline means the kernel ended the process or a source of series is gone. Under the diagram there are three counters, which show memory relative to the limit, the share of throttled periods and the number of restarts.\n\nOnce you reach the query answer, open “Parameters” and in the group “Container memory” raise the memory the process needs above the limit. The kernel will end the process, and both sources will see it. Then in the group “Container CPU” set the limit to 200m and the need to 0.5 cores and look at the share of throttled periods. Finally, switch on stopping kube-state-metrics in “Break it” and note that the kube_* series did not turn to zero but vanished.'), caption: bi('Те же ряды, что вы видели на схеме, есть и у учебного кластера магазина. В заданиях ниже вы найдёте под, который ядро завершает за нехватку памяти, и контейнер, который упирается в квоту процессора, а ряды kube_* подскажут, какой Deployment недосчитался реплик.', 'The training cluster of the shop has the same series you saw in the diagram. In the tasks below you will find the pod the kernel ends for lack of memory and the container that hits its CPU quota, and the kube_* series will tell which Deployment is short of replicas.') },
    { id: 'bench', kind: 'widget', step: 'practice', widget: 'obs.workbench', props: { incident: 'k8s', query: 'kube_pod_status_phase{namespace="shop"} == 1', goals: K8S_GOALS, targets: ['node-3:10250'], title: bi('Магазин в Kubernetes', 'The Shop in Kubernetes') } satisfies WorkbenchProps },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: monSetup('k8s', [{ path: `${MON}/rules.yml`, content: RULES0 }]),
      intro: bi('В файле `~/mon/rules.yml` лежит пустая группа правил. Prometheus уже собирает ряды кластера, а проверить файл правил можно командой `promtool check rules rules.yml`.', 'The file `~/mon/rules.yml` holds an empty rule group. Prometheus already collects the cluster series, and you can check the rule file with `promtool check rules rules.yml`.'),
      tasks: [
        {
          id: 'restarts',
          prompt: bi('Добавьте алерт `PodRestarting`, который срабатывает, если контейнер перезапускался больше двух раз за последний час. На нынешних данных он должен сработать.', 'Add the `PodRestarting` alert, which fires if a container restarted more than twice over the last hour. It must fire on the current data.'),
          check: { when: (f) => fires(f, /kube_pod_container_status_restarts_total/), fail: [{ if: (f) => firingRules(f.files[`${MON}/rules.yml`]?.text ?? '', 'k8s') === null, say: bi('Файл правил не удаётся разобрать. Проверьте его командой promtool check rules.', 'The rule file cannot be parsed. Check it with promtool check rules.') }] },
          chips: 'promtool check rules rules.yml',
          concepts: ['obs.kube-state-metrics', 'obs.alert-rule'],
          hints: { H1: bi('expr: increase(kube_pod_container_status_restarts_total[1h]) > 2', 'expr: increase(kube_pod_container_status_restarts_total[1h]) > 2') },
        },
        {
          id: 'replicas',
          prompt: bi('Добавьте алерт `DeploymentReplicasMismatch`, который срабатывает, если доступных реплик меньше, чем указано в описании, дольше 10 минут.', 'Add the `DeploymentReplicasMismatch` alert, which fires if there are fewer available replicas than ordered for longer than 10 minutes.'),
          check: { when: (f) => fires(f, /kube_deployment_spec_replicas[\s\S]*kube_deployment_status_replicas_available|kube_deployment_status_replicas_available[\s\S]*kube_deployment_spec_replicas/) && /for:\s*10m/.test(f.files[`${MON}/rules.yml`]?.text ?? '') },
          chips: 'promtool check rules rules.yml',
          concepts: ['obs.kube-state-metrics'],
          docRef: { page: 'web/github.com/kube-state-metrics', anchor: 'deployment' },
          hints: { H1: bi('Сравните оператором != два ряда с одинаковыми метками: число реплик из описания (spec) и число доступных реплик (available).', 'Compare two series with the same labels, the ordered replicas (spec) and the available ones (available), with the != operator.') },
        },
      ],
    },
    {
      id: 'silent-intro',
      kind: 'text',
      step: 'look',
      title: bi('Почему алерт о перезапусках может не прийти', 'Why the restart alert may not arrive'),
      body: bi(
        'Алерт `PodRestarting`, который вы только что написали, работает, пока до Prometheus доходят ряды kube-state-metrics. Молчание алерта само по себе ничего не доказывает. Правило молчит, когда под здоров, но точно так же оно молчит, когда рядов, на которых оно построено, нет вовсе, и когда правило некому вычислять. Чтобы отличить одно от другого, нужно видеть всю цепочку: кто отдаёт ряды, кто их собирает и вычисляет правила и кто доставляет сообщение людям.\n\nЭту цепочку показывает конструктор кластера, который вы собирали в блоке Kubernetes. Здесь в нём оставлены управляющий слой, узлы, сеть кластера и слой «Наблюдаемость» с тремя блоками. Блок node-exporter отдаёт метрики самих узлов. Блок kube-state-metrics превращает состояние объектов API в ряды kube_*. Блок Prometheus находит обе цели через API-сервер, забирает их страницы `/metrics` и вычисляет правила алертов.\n\nСценарий «Почему не пришёл алерт» создаёт Deployment pay, контейнер которого раз за разом завершается с ошибкой, так что под уходит в состояние CrashLoopBackOff. Потом сценарий переводит часы кластера на двадцать минут вперёд и запрашивает у Prometheus список алертов. В этом списке всегда есть служебный алерт Watchdog, который горит постоянно. Вы уже встречали его на схеме в уроке об алертах: если сообщение от Watchdog перестаёт приходить, сломан сам мониторинг.',
        'The `PodRestarting` alert you have just written works as long as the kube-state-metrics series reach Prometheus. The silence of an alert proves nothing by itself. A rule is silent when the pod is healthy, but it is just as silent when the series it is built on do not exist at all, and when there is nobody to evaluate the rule. To tell one from the other, you need to see the whole chain: who serves the series, who collects them and evaluates the rules, and who delivers the message to people.\n\nThe cluster constructor you assembled in the Kubernetes block shows this chain. Here it keeps the control plane, the nodes, the cluster network and the “Observability” layer with three blocks. The node-exporter block serves the metrics of the nodes themselves. The kube-state-metrics block turns the state of API objects into kube_* series. The Prometheus block finds both targets through the API server, fetches their `/metrics` pages and evaluates the alerting rules.\n\nThe scenario “Why no alert came” creates Deployment pay, whose container ends with an error again and again, so the pod goes into CrashLoopBackOff. Then the scenario moves the cluster clock twenty minutes forward and asks Prometheus for the list of alerts. That list always holds the service alert Watchdog, which fires all the time. You met it in the diagram of the lesson on alerts: if the Watchdog message stops arriving, monitoring itself is broken.',
      ),
    },
    {
      id: 'silent-howto',
      kind: 'text',
      role: 'howto',
      step: 'try',
      body: bi(
        'Нажмите внизу кнопку сценария «Почему не пришёл алерт». В выводе последней команды найдите алерт KubePodCrashLooping в состоянии firing, а рядом с ним Watchdog. Так выглядит исправный кластер.\n\nЗатем нажмите на холсте блок kube-state-metrics, в его карточке нажмите «Убрать с холста» и запустите сценарий ещё раз. Команда `kubectl get pods` по-прежнему показывает, что под pay перезапускается, но в списке алертов остался один Watchdog. Prometheus работает и вычисляет правила, а правилу о перезапусках не на чем сработать.\n\nПотом нажмите «Собрать всё правильно», уберите с холста блок Prometheus и запустите сценарий в третий раз. Теперь запрос к prometheus.monitoring не находит даже имени сервиса, и вместе с остальными алертами пропал Watchdog. Напоследок уберите только node-exporter. Сценарий с подом pay этого не заметит, а в карточке блока сказано, какой алерт в таком кластере замолчит.',
        'Press the scenario button “Why no alert came” at the bottom. In the output of the last command find the KubePodCrashLooping alert in the firing state, and Watchdog next to it. This is what a healthy cluster looks like.\n\nThen press the kube-state-metrics block on the canvas, press “Remove from the canvas” in its card and run the scenario again. `kubectl get pods` still shows that pod pay keeps restarting, but only Watchdog is left in the alert list. Prometheus works and evaluates the rules, but the restart rule has nothing to fire on.\n\nNext press “Assemble everything correctly”, remove the Prometheus block from the canvas and run the scenario a third time. Now the request to prometheus.monitoring does not even find the service name, and Watchdog is gone together with the other alerts. Finally remove only node-exporter. The scenario with pod pay will not notice, and the block card says which alert falls silent in such a cluster.',
      ),
    },
    { id: 'silent', kind: 'widget', step: 'try', widget: 'k8s.constructor', props: { preset: 'full', layers: ['cp', 'node', 'net', 'obs'] } },
    {
      id: 'silent-after',
      kind: 'text',
      step: 'review',
      title: bi('Как найти причину молчания в настоящем кластере', 'How to find the cause of the silence in a real cluster'),
      body: bi(
        'Три прогона показали три разных молчания, и в настоящем кластере их различают в том же порядке. Сначала убедитесь, что Prometheus работает и вычисляет правила. Для этого Watchdog должен быть в списке алертов, а внешняя проверка должна получать его сообщения. Потом проверьте, что источник рядов на месте. Запрос `up{job="kube-state-metrics"}` должен вернуть 1, а на странице Status → Targets цель должна быть в состоянии UP. Если цели нет в списке вовсе, Prometheus её не нашёл, и смотреть нужно на объект ServiceMonitor, то есть проверить, совпадает ли его селектор с метками сервиса kube-state-metrics и есть ли у самого объекта метка `release`, по которой его находит Prometheus. Маршруты Alertmanager проверяют командой `amtool config routes test` только после этого, потому что правило, которое не перешло в состояние firing, ничего в Alertmanager не передаёт.\n\nЧтобы в следующий раз не разбираться вручную, на каждый важный источник рядов ставят алерт вида `absent(up{job="kube-state-metrics"} == 1)`. Такой алерт сработает и тогда, когда цель перестала отвечать, и тогда, когда она исчезла из списка целей. На собеседовании этот разбор часто спрашивают вопросом «сервис лежал час, а алерт так и не пришёл, что вы проверите», и ответ по цепочке от Watchdog к источнику и затем к маршрутам показывает, что вы понимаете, как устроен мониторинг.',
        'The three runs showed three different silences, and in a real cluster they are told apart in the same order. First make sure Prometheus works and evaluates the rules. For that, Watchdog must be in the alert list, and an external check must receive its messages. Then check that the source of series is in place. The query `up{job="kube-state-metrics"}` must return 1, and on the Status → Targets page the target must be UP. If the target is not in the list at all, Prometheus did not find it, and you look at the ServiceMonitor object, that is, check whether its selector matches the labels of the kube-state-metrics service and whether the object itself has the `release` label Prometheus finds it by. The Alertmanager routes are checked with `amtool config routes test` only after that, because a rule that never became firing hands nothing to Alertmanager.\n\nSo that you need not investigate by hand next time, every important source of series gets an alert like `absent(up{job="kube-state-metrics"} == 1)`. Such an alert fires both when the target stopped answering and when it vanished from the target list altogether. Interviews often ask about this investigation as “the service was down for an hour and the alert never came; what do you check?”, and an answer that goes along the chain from Watchdog to the source and then to the routes shows that you understand how monitoring is built.',
      ),
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Нехватку памяти лучше заметить заранее, не дожидаясь, пока ядро снова завершит процесс. Выведите командой `promtool query instant`, сколько памяти будет занимать каждый контейнер в пространстве имён shop через 20 минут, если память продолжит расти так же, как за последние 10 минут. В уроке такой функции не было, поэтому найдите её на странице функций Prometheus.', 'A memory shortage is better noticed in advance, without waiting for the kernel to end the process again. Print with `promtool query instant` how much memory each container in the shop namespace will take in 20 minutes if memory keeps growing as it did over the last 10 minutes. The lesson did not show such a function, so find it on the Prometheus functions page.'),
      ref: { page: 'web/prometheus.io/querying/functions' },
      terminal: {
        setup: monSetup('k8s'),
        task: {
          id: 'predict',
          prompt: bi('В выводе есть прогноз для всех контейнеров shop, и у одного из них прогноз выше 512 Mi.', 'The output has a forecast for every shop container, and for one of them the forecast is above 512 Mi.'),
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
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['obs.q.cadvisor-vs-ksm', 'obs.q.throttle', 'obs.q.absent', 'obs.q.watchdog'] },
  ],
};

export const placement2: PlacementTask[] = [
  { id: 'monitoring.place.loki', level: 'experienced', key: false, concepts: ['obs.log-stream'], kind: 'quiz', item: { ...(quiz2.find((q) => q.id === 'obs.q.log-labels') as QuizItem), id: 'monitoring.place.q.loki' } },
  { id: 'monitoring.place.throttle', level: 'experienced', key: false, concepts: ['obs.throttling'], kind: 'quiz', item: { ...(quiz2.find((q) => q.id === 'obs.q.throttle') as QuizItem), id: 'monitoring.place.q.throttle' } },
  { id: 'monitoring.place.absent', level: 'experienced', key: false, concepts: ['obs.kube-state-metrics'], kind: 'quiz', item: { ...(quiz2.find((q) => q.id === 'obs.q.absent') as QuizItem), id: 'monitoring.place.q.absent' } },
];

// ── the block exam ──

export const monitoringExam: Exam = {
  id: 'monitoring.exam',
  block: 'monitoring',
  title: bi('Ночное дежурство по магазину', 'Night duty for the shop'),
  story: bi('Идёт ночь вашего первого дежурства. В рабочем канале команды вас ждут три сообщения: «корзина иногда пустеет», «заказ не оформляется, сайт показывает ошибку» и «к утреннему разбору нужен список того, что ломается». Кроме того, у руководителя команды есть к вам вопросы.', 'It is the night of your first on-call shift. The work channel has three messages: “the cart sometimes empties”, “checkout fails” and “we need a list of what fails for the morning review”. Besides, the team lead has questions for you.'),
  intro: bi('Вас ждут четыре задачи на машинах с Prometheus и Loki магазина и два вопроса. Пользоваться можно выводом `--help` и справочниками prometheus.io, grafana.com и opentelemetry.io, а подсказок и наставника на экзамене нет.', 'Four tasks on machines with the shop’s Prometheus and Loki and two questions await you. You may use `--help` and the prometheus.io, grafana.com and opentelemetry.io references; there are no hints and no mentor in the exam.'),
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
        prompt: bi('«Корзина иногда пустеет». Найдите под, который перезапускается, и напишите в `rules.yml` алерт, который сработает на этом поде сейчас, но не будет зависеть от его имени.', '“The cart sometimes empties.” Find the pod that keeps restarting and write an alert into `rules.yml` that fires on this pod now but does not depend on its name.'),
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
        prompt: bi('«Заказ не оформляется, сайт показывает ошибку». Выведите через logcli, сколько ответов 5xx отдал api за последние 15 минут на каждом маршруте. Нужен один запрос, который возвращает по ряду на маршрут.', '“Checkout fails.” Print with logcli how many 5xx answers api gave over the last 15 minutes on each route. You need one query that returns one series per route.'),
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
        prompt: bi('Выведите через `promtool query instant` для каждого пода в пространстве имён shop отношение занятой сейчас памяти к лимиту памяти этого пода, по строке на под.', 'Print with `promtool query instant`, for every pod in the shop namespace, the ratio of the memory used now to that pod’s memory limit, one line per pod.'),
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
        prompt: bi('«К утреннему разбору нужен список». Выведите последние пять строк уровня error из потока stdout сервиса api так, чтобы в выводе остались только сами строки JSON, без времени и меток, и их можно было сразу передать команде jq. В уроках этого не было.', '“We need a list for the morning review.” Print the last five error-level lines of the api stdout stream so that only the JSON lines themselves remain in the output, without time and labels, and can be piped into jq at once. The lessons did not cover this.'),
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
    { id: 'cpu-alert', prompt: bi('«Зачем нам алерт на долю ошибок, если уже есть алерт на загрузку процессора выше 80 %?»', '“Why do we need an alert on the error share if there is already an alert on CPU load above 80 %?”'), keyPoints: [bi('алерт ставят на симптом, который чувствует пользователь', 'an alert is put on a symptom the user feels'), bi('причин бывает много, и высокая загрузка не всегда вредит пользователям', 'there are many causes, and high load does not always hurt users'), bi('загрузку ресурсов смотрят при разборе по методу USE, а не будят из-за неё ночью', 'resource load is for investigation by the USE method, not for night pages')] },
    { id: 'signals', prompt: bi('«Как вы поняли, что причина в новой версии, а не в базе данных?»', '“How did you work out that the cause was the new version and not the database?”'), keyPoints: [bi('метрики показали, что сломалось и с каких пор, с разбивкой по маршруту и версии', 'the metrics showed what broke and since when, by route and version'), bi('журналы показали сообщение о том, что пул исчерпан, и версию сервиса в каждой строке', 'the logs showed the message that the pool was exhausted, and the service version in every line'), bi('трейсы показали ожидание соединения из пула и отдельный запрос к базе на каждый товар', 'the traces showed the wait for a pool connection and a separate database query for every item')] },
  ],
};
