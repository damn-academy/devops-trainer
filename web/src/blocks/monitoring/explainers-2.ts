// Explainers of the second half of the Monitoring block (06 §7.4, §7.10):
// the path of a log line from stdout to a LogQL answer, the path of a trace
// across services (traceparent, spans, sampling, the Collector), and where
// container metrics come from (cgroup files, cAdvisor, kube-state-metrics).

import { defineModel } from '../../core/define';
import { bi, fmt, type Bi } from '../../core/i18n';
import type { Step } from '../../core/types';
import { card } from '../git-cicd/explainers';

const last = (s: Step[]) => s[s.length - 1]?.metrics ?? {};
const BYTES_PER_LINE = 220;

// ── The path of a log line ──

type LogP = { format: string; userLabel: boolean; rate: number };

export function logNumbers(p: LogP): { streams: number; mbDay: number; parsed: boolean } {
  return { streams: p.userLabel ? 6 * 20000 : 6, mbDay: Math.round((p.rate * 86400 * BYTES_PER_LINE) / 1e6), parsed: p.format === 'json' };
}

export const logModel = defineModel<LogP>({
  id: 'obs.log-path',
  block: 'monitoring',
  title: bi('Путь строки журнала', 'The path of a log line'),
  summary: bi('Приложение пишет строку в stdout, среда контейнеров кладёт её в файл, агент читает файл и отправляет строку в Loki вместе с метками. Loki индексирует только метки, а содержимое строк перебирает при запросе.', 'The application writes a line to stdout, the container runtime puts it into a file, an agent reads the file and sends the line to Loki together with labels. Loki indexes only the labels and scans the content of lines at query time.'),
  concepts: ['obs.structured-log', 'obs.log-stream', 'obs.logql'],
  diagram: {
    width: 960,
    height: 420,
    nodes: [
      { id: 'app', label: bi('процесс api', 'api process'), sub: 'stdout', family: 'user', shape: 'box', x: 16, y: 40, w: 184, h: 72, card: card(bi('Приложение пишет журнал в стандартный вывод, по строке на событие. Куда эти строки попадут дальше, оно не знает и знать не должно.', 'The application writes its log to standard output, one line per event. Where the lines go next it does not know and should not know.'), bi('Код приложения и его библиотека журналирования.', 'The application code and its logging library.'), 'kubectl logs deploy/api') },
      { id: 'file', label: '/var/log/pods/…/0.log', sub: '2026-11-18T11:59:58Z stdout F {…}', family: 'kernel', shape: 'doc', x: 16, y: 200, w: 184, h: 72, card: card(bi('Среда контейнеров дописывает каждую строку stdout в файл на узле: время, поток, сама строка. Файлы ротируются по размеру.', 'The container runtime appends every stdout line to a file on the node: the time, the stream, the line itself. The files are rotated by size.'), bi('containerd / CRI-O на узле.', 'containerd / CRI-O on the node.'), 'ls /var/log/pods/') },
      { id: 'agent', label: bi('агент (Alloy)', 'agent (Alloy)'), sub: 'tail + labels', family: 'process', shape: 'box', x: 280, y: 120, w: 184, h: 80, card: card(bi('Агент на каждом узле читает новые строки файлов, добавляет метки из Kubernetes (namespace, app, pod) и пачками отправляет в Loki.', 'An agent on every node reads the new lines of the files, adds labels from Kubernetes (namespace, app, pod) and sends them to Loki in batches.'), bi('DaemonSet Grafana Alloy (раньше — Promtail), или Fluent Bit, Vector.', 'A Grafana Alloy DaemonSet (formerly Promtail), or Fluent Bit, Vector.'), undefined, { url: 'https://grafana.com/docs/loki/latest/send-data/', label: 'grafana.com › Send log data to Loki' }) },
      { id: 'index', label: bi('индекс меток', 'label index'), sub: '6 streams', family: 'store', shape: 'buffer', x: 560, y: 40, w: 184, h: 72, card: card(bi('Loki индексирует только набор меток — поток. Каждый уникальный набор меток — отдельный поток со своим куском данных.', 'Loki indexes only the label set, the stream. Every unique label set is a separate stream with its own chunk of data.'), bi('Loki (ingester, index gateway).', 'Loki (ingester, index gateway).')) },
      { id: 'chunks', label: bi('куски строк', 'chunks'), sub: 'gzip', family: 'store', shape: 'buffer', x: 560, y: 200, w: 184, h: 72, card: card(bi('Сами строки лежат сжатыми кусками в объектном хранилище, без индекса по содержимому. Поэтому Loki дешёвый, а поиск по тексту идёт перебором.', 'The lines themselves lie in compressed chunks in object storage, with no index on their content. That is why Loki is cheap and text search is a scan.'), bi('Loki и объектное хранилище (S3, GCS, MinIO).', 'Loki and object storage (S3, GCS, MinIO).')) },
      { id: 'query', label: 'LogQL', sub: '{app="api"} | json', family: 'flow', shape: 'box', x: 776, y: 120, w: 168, h: 80, card: card(bi('Запрос сначала выбирает потоки по меткам (дёшево, по индексу), потом прогоняет их строки через фильтры и парсеры (дорого, перебором).', 'A query first selects streams by labels (cheap, through the index), then runs their lines through filters and parsers (expensive, by scanning).'), bi('Вы, в Grafana Explore или logcli.', 'You, in Grafana Explore or logcli.'), 'logcli query \'{app="api"} |= "error"\'') },
      { id: 'grafana', label: 'Grafana', sub: 'Explore', family: 'neutral', shape: 'pill', x: 776, y: 300, w: 168, h: 64, card: card(bi('Интерфейс: строки, гистограмма числа строк во времени, переход от строки к трейсу по trace_id.', 'The interface: the lines, a histogram of line counts over time, a jump from a line to a trace by trace_id.'), bi('Команда эксплуатации.', 'The operations team.')) },
    ],
    edges: [
      { id: 'e-write', from: 'app', to: 'file', label: 'write(1, …)', card: card(bi('Строка уходит в stdout; среда контейнеров перехватывает её и пишет в файл.', 'The line goes to stdout; the container runtime catches it and writes it to a file.'), bi('Процесс и среда контейнеров.', 'The process and the container runtime.')) },
      { id: 'e-tail', from: 'file', to: 'agent', label: 'tail -F', card: card(bi('Агент помнит позицию в каждом файле и после перезапуска продолжает с неё.', 'The agent remembers its position in each file and continues from it after a restart.'), bi('Агент.', 'The agent.')) },
      { id: 'e-push', from: 'agent', to: 'index', label: 'POST /loki/api/v1/push', card: card(bi('Пачка строк с метками потока. Метки — в индекс, строки — в куски.', 'A batch of lines with the stream labels. The labels go into the index, the lines into chunks.'), bi('Агент.', 'The agent.')) },
      { id: 'e-store', from: 'index', to: 'chunks', label: bi('поток → куски', 'stream → chunks'), card: card(bi('Индекс говорит, в каких кусках лежат строки потока.', 'The index tells in which chunks the lines of a stream lie.'), bi('Loki.', 'Loki.')) },
      { id: 'e-select', from: 'query', to: 'index', label: bi('выбор потоков', 'stream selection'), labelAt: 0.3, card: card(bi('Селектор {app="api"} — поиск по индексу.', 'The selector {app="api"} is a lookup in the index.'), bi('Loki querier.', 'Loki querier.')) },
      { id: 'e-scan', from: 'query', to: 'chunks', label: bi('перебор строк', 'line scan'), labelAt: 0.3, card: card(bi('|= "error", | json, | status >= 500 — работа над каждой строкой выбранных потоков.', '|= "error", | json, | status >= 500: work over every line of the selected streams.'), bi('Loki querier.', 'Loki querier.')) },
      { id: 'e-show', from: 'query', to: 'grafana', label: bi('строки и числа', 'lines and numbers'), card: card(bi('Запрос по строкам возвращает строки, запрос с count_over_time — ряды чисел, как PromQL.', 'A log query returns lines; a query with count_over_time returns series of numbers, like PromQL.'), bi('Loki.', 'Loki.')) },
    ],
  },
  params: [
    { id: 'format', label: bi('Формат строк', 'Line format'), kind: 'choice', default: 'json', options: [{ id: 'json', label: bi('структурированный (JSON)', 'structured (JSON)') }, { id: 'plain', label: bi('свободный текст', 'free text') }], near: 'app' },
    {
      id: 'userLabel',
      label: bi('Сделать user_id меткой', 'Make user_id a label'),
      kind: 'toggle',
      default: false,
      near: 'agent',
      predict: {
        prompt: bi('Агент начинает ставить user_id в метки (пользователей 20 000). Что станет с индексом?', 'The agent starts putting user_id into labels (20,000 users). What happens to the index?'),
        options: [
          { id: 'boom', text: bi('Потоков станет в двадцать тысяч раз больше, каждый — с крошечными кусками', 'There become twenty thousand times more streams, each with tiny chunks') },
          { id: 'fine', text: bi('Поиск по пользователю станет быстрее, остальное не изменится', 'Search by user becomes faster, nothing else changes') },
        ],
        resolve: (_p, n) => ((last(n).streams ?? 0) > 1000 ? 'boom' : 'fine'),
      },
    },
    { id: 'rate', label: bi('Строк в секунду', 'Lines per second'), kind: 'range', min: 10, max: 2000, step: 10, default: 200, near: 'chunks' },
  ],
  breaks: [
    {
      id: 'loki-down',
      label: bi('Loki не принимает строки', 'Loki does not accept lines'),
      remove: ['e-push'],
      predict: {
        prompt: bi('Loki отвечает 503 на час. Что будет со строками этого часа?', 'Loki answers 503 for an hour. What happens to the lines of that hour?'),
        options: [
          { id: 'buffer', text: bi('Агент копит их и повторяет отправку; если файл успеет ротироваться — часть потеряется', 'The agent keeps them and retries; if the file rotates first, some are lost') },
          { id: 'kept', text: bi('Loki сам заберёт их позже', 'Loki fetches them itself later') },
        ],
        resolve: () => 'buffer',
      },
    },
  ],
  metrics: [
    { id: 'streams', label: bi('потоков в индексе', 'streams in the index') },
    { id: 'mbDay', label: bi('объём за сутки', 'volume per day'), unit: 'MB' },
  ],
  run(p, broken) {
    const n = logNumbers(p);
    const m = { streams: n.streams, mbDay: n.mbDay };
    const steps: Step[] = [
      { id: 'write', label: 'stdout', caption: p.format === 'json' ? bi('api пишет событие одной строкой JSON: уровень, маршрут, код ответа, длительность, trace_id. Поля можно будет достать по имени.', 'api writes the event as one JSON line: level, route, status code, duration, trace_id. The fields can later be taken out by name.') : bi('api пишет событие свободным текстом. Человеку читать удобно, а поле «код ответа» придётся вылавливать регулярным выражением.', 'api writes the event as free text. It reads well for a human, but the "status code" field will have to be fished out with a regular expression.'), focus: ['app', 'e-write', 'file'], tokens: [{ edge: 'e-write', label: p.format === 'json' ? '{…}' : 'text' }], states: { app: 'on', file: 'on' }, values: { file: p.format === 'json' ? 'stdout F {"level":…}' : 'stdout F ERROR 500 …' } },
      { id: 'tail', label: 'tail', caption: bi('Агент на узле дочитывает файл и добавляет метки из Kubernetes: namespace, app, instance.', 'The agent on the node reads on in the file and adds labels from Kubernetes: namespace, app, instance.'), focus: ['e-tail', 'agent'], tokens: [{ edge: 'e-tail', label: 'line' }], states: { agent: 'on' }, values: { agent: p.userLabel ? '+ user_id' : '{app="api", …}' } },
    ];
    if (broken.has('loki-down')) {
      steps.push({ id: 'down', label: 'push ✗', caption: bi('Loki не принимает пачку. Агент повторяет отправку с паузами и держит позицию в файле.', 'Loki does not accept the batch. The agent retries with back-off and holds its position in the file.'), focus: ['agent', 'e-push'], states: { agent: 'warn', index: 'err' }, metrics: m, broken: { at: 'e-push', message: 'level=warn component=loki.write msg="error sending batch, will retry" status=503 error="server returned HTTP status 503 Service Unavailable (503)"', caption: bi('о том, что журналы перестали доходить, должен сообщить алерт на сам конвейер, иначе дыру заметят в день инцидента.', 'an alert on the pipeline itself must report that logs stopped arriving, otherwise the gap is found on the day of an incident.') } });
      return steps;
    }
    steps.push(
      { id: 'push', label: 'push', caption: p.userLabel ? fmt(bi('Каждый пользователь — свой набор меток, а значит, свой поток: их уже {s}. Куски крошечные, индекс пухнет.', 'Every user is a label set of their own, so a stream of their own: there are {s} of them already. The chunks are tiny, the index swells.'), { s: n.streams }) : fmt(bi('Метки — в индекс ({s} потоков), строки — сжатыми кусками в хранилище, около {mb} МБ в сутки.', 'The labels go into the index ({s} streams), the lines into storage as compressed chunks, about {mb} MB per day.'), { s: n.streams, mb: n.mbDay }), focus: ['e-push', 'index', 'e-store', 'chunks'], tokens: [{ edge: 'e-push', label: 'batch' }], states: { index: p.userLabel ? 'warn' : 'ok', chunks: 'on' }, values: { index: `${n.streams} streams` }, fill: { index: p.userLabel ? 1 : 0.15, chunks: Math.min(1, p.rate / 2000) } },
      { id: 'select', label: bi('селектор', 'selector'), caption: bi('Запрос {app="api"} выбирает потоки по индексу — это быстро.', 'The query {app="api"} selects streams through the index; that is fast.'), focus: ['query', 'e-select', 'index'], tokens: [{ edge: 'e-select', label: '{app="api"}' }], states: { query: 'on' } },
      { id: 'scan', label: bi('фильтр', 'filter'), caption: n.parsed ? bi('`| json | status >= 500` достаёт поля из строк выбранных потоков и сравнивает числа: найдены все ответы с ошибкой, и только они.', '`| json | status >= 500` takes the fields out of the lines of the selected streams and compares numbers: every error response is found, and only those.') : bi('Поля в тексте нет: приходится писать `|~ "ERROR 5\\d\\d"` и надеяться, что формат строки нигде не отличается.', 'There is no field in the text: you have to write `|~ "ERROR 5\\d\\d"` and hope the line format differs nowhere.'), focus: ['e-scan', 'chunks'], tokens: [{ edge: 'e-scan', label: n.parsed ? '| json' : '|~' }], states: { chunks: n.parsed ? 'ok' : 'warn' } },
      { id: 'show', label: 'Explore', caption: bi('Grafana показывает строки и график их числа; из строки с trace_id можно перейти к трейсу.', 'Grafana shows the lines and a graph of their count; from a line with a trace_id you can jump to the trace.'), focus: ['e-show', 'grafana'], tokens: [{ edge: 'e-show', label: '200 lines' }], states: { grafana: 'on' }, metrics: m },
    );
    return steps;
  },
  explainDelta(prev, next, change): Bi {
    if (change.kind === 'break') return change.on ? bi('Агент копит строки и повторяет отправку; пока он держит позицию в файле, ничего не потеряно.', 'The agent keeps the lines and retries; while it holds its position in the file, nothing is lost.') : bi('Loki снова принимает строки.', 'Loki accepts lines again.');
    if (change.id === 'userLabel') return fmt(bi('Потоков: {a} → {b}. Метка — для того, по чему вы выбираете группы, а не для каждого объекта; user_id ищут фильтром по содержимому.', 'Streams: {a} → {b}. A label is for what you select groups by, not for every object; user_id is found with a content filter.'), { a: last(prev).streams ?? 0, b: last(next).streams ?? 0 });
    if (change.id === 'format') return (next.find((s) => s.id === 'scan')?.states?.chunks === 'ok') ? bi('Структурированная строка: поля достаются по имени, запрос не зависит от порядка слов.', 'A structured line: fields are taken by name, and the query does not depend on word order.') : bi('Свободный текст: поиск по регулярному выражению, хрупкий к любой правке формата.', 'Free text: a regular-expression search, fragile against any change of format.');
    return fmt(bi('Объём за сутки: {a} → {b} МБ. Loki хранит строки дёшево, но каждый запрос перебирает их.', 'Volume per day: {a} → {b} MB. Loki stores lines cheaply, but every query scans them.'), { a: last(prev).mbDay ?? 0, b: last(next).mbDay ?? 0 });
  },
});

// ── The path of a trace ──

type TraceP = { queries: number; dbMs: number; sampling: string };

export function traceNumbers(p: TraceP, broken: ReadonlySet<string>): { total: number; db: number; kept: number; traces: number } {
  const wait = p.queries > 8 ? (p.queries - 8) * 60 : 1;
  const db = wait + p.queries * p.dbMs;
  const total = 2 + 3 + db + 4 + 2;
  const errShare = p.queries > 8 ? 0.25 : 0.003;
  const kept = broken.has('collector-down') ? 0 : p.sampling === '100' ? 1000 : p.sampling === '10' ? 100 : Math.max(1, Math.round(errShare * 1000));
  return { total, db, kept, traces: broken.has('no-propagation') ? 2 : 1 };
}

export const traceModel = defineModel<TraceP>({
  id: 'obs.trace-path',
  block: 'monitoring',
  title: bi('Путь трейса через сервисы', 'The path of a trace across services'),
  summary: bi('Каждый сервис записывает свои спаны, а связывает их в один трейс заголовок traceparent, который сервис передаёт дальше. Collector собирает спаны, отбирает часть и отправляет в хранилище трейсов.', 'Every service records its own spans, and what ties them into one trace is the traceparent header each service passes on. The Collector gathers the spans, keeps a share and sends them to the trace store.'),
  concepts: ['obs.trace', 'obs.span', 'obs.context-propagation', 'obs.sampling'],
  waterfall: 'ms',
  diagram: {
    width: 960,
    height: 440,
    nodes: [
      { id: 'front', label: 'frontend', sub: 'span: POST /checkout', family: 'l7', shape: 'box', x: 16, y: 40, w: 184, h: 72, card: card(bi('Первый сервис на пути запроса. Он начинает трейс: создаёт trace_id и корневой спан.', 'The first service on the request’s path. It starts the trace: it creates the trace_id and the root span.'), bi('SDK OpenTelemetry в коде frontend.', 'The OpenTelemetry SDK in the frontend code.'), undefined, { url: 'https://opentelemetry.io/docs/concepts/signals/traces/', label: 'opentelemetry.io › Traces' }) },
      { id: 'api', label: 'api', sub: 'span: POST /checkout', family: 'cp', shape: 'box', x: 300, y: 40, w: 184, h: 72, card: card(bi('Читает traceparent из запроса и создаёт свой спан — дочерний к спану frontend. Внутри — спаны ожидания пула и запросов к базе.', 'Reads traceparent from the request and creates its own span, a child of the frontend span. Inside are spans for the pool wait and the database queries.'), bi('SDK и автоинструментирование HTTP-сервера.', 'The SDK and the HTTP server auto-instrumentation.')) },
      { id: 'db', label: 'postgres', sub: 'SELECT products ×1', family: 'store', shape: 'buffer', x: 600, y: 40, w: 184, h: 72, card: card(bi('База данных. Спаны запросов к ней пишет клиентская библиотека в api: сама база про трейсы обычно не знает.', 'The database. The spans of queries to it are written by the client library in api: the database itself usually knows nothing about traces.'), bi('Инструментирование драйвера БД в api.', 'The DB driver instrumentation in api.')) },
      { id: 'coll', label: 'OTel Collector', sub: 'receivers → processors → exporters', family: 'process', shape: 'hex', x: 280, y: 250, w: 200, h: 80, card: card(bi('Принимает спаны всех сервисов по OTLP, собирает трейсы целиком, отбирает часть (сэмплирование) и отправляет дальше.', 'Receives the spans of all services over OTLP, assembles whole traces, keeps a share (sampling) and sends them on.'), bi('Команда эксплуатации; конфигурация collector.yaml.', 'The operations team; the collector.yaml configuration.'), undefined, { url: 'https://opentelemetry.io/docs/collector/', label: 'opentelemetry.io › Collector' }) },
      { id: 'tempo', label: bi('хранилище трейсов', 'trace store'), sub: 'Tempo / Jaeger', family: 'store', shape: 'buffer', x: 560, y: 250, w: 184, h: 80, card: card(bi('Хранит трейсы по trace_id. В нём ищут по сервису, маршруту, длительности и показывают водопад.', 'Stores traces by trace_id. You search it by service, route, duration, and it shows the waterfall.'), bi('Grafana Tempo, Jaeger или облачный сервис.', 'Grafana Tempo, Jaeger or a cloud service.')) },
      { id: 'logs', label: bi('журналы', 'logs'), sub: 'trace_id=4bf92f…', family: 'neutral', shape: 'doc', x: 776, y: 250, w: 168, h: 80, card: card(bi('Если сервис пишет trace_id в каждую строку журнала, от трейса можно перейти к строкам этого запроса и обратно.', 'If a service writes the trace_id into every log line, you can jump from a trace to the lines of that request and back.'), bi('Библиотека журналирования, которая берёт trace_id из текущего контекста.', 'A logging library that takes the trace_id from the current context.')) },
    ],
    edges: [
      { id: 'e-call', from: 'front', to: 'api', label: 'traceparent: 00-4bf92f…-00f067…-01', card: card(bi('Заголовок W3C Trace Context: версия, trace_id, span_id вызывающего спана, флаг «записано». По нему api понимает, что его работа — часть того же трейса.', 'The W3C Trace Context header: version, trace_id, span_id of the calling span, the "sampled" flag. From it api understands that its work is part of the same trace.'), bi('HTTP-клиент frontend, инструментированный SDK.', 'The frontend HTTP client, instrumented by the SDK.'), 'curl -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" http://api/checkout', { url: 'https://www.w3.org/TR/trace-context/', label: 'w3.org › Trace Context' }) },
      { id: 'e-sql', from: 'api', to: 'db', label: 'SQL', card: card(bi('Каждый запрос к базе — отдельный дочерний спан api со временем и текстом запроса.', 'Every query to the database is a separate child span of api with its time and query text.'), bi('Драйвер БД.', 'The DB driver.')) },
      { id: 'e-otlp-f', from: 'front', to: 'coll', label: 'OTLP', labelAt: 0.4, card: card(bi('Спаны отправляются пачками по протоколу OTLP отдельно от самого запроса.', 'Spans are sent in batches over the OTLP protocol, separately from the request itself.'), bi('SDK frontend.', 'The frontend SDK.')) },
      { id: 'e-otlp-a', from: 'api', to: 'coll', label: 'OTLP', card: card(bi('То же для спанов api.', 'The same for the api spans.'), bi('SDK api.', 'The api SDK.')) },
      { id: 'e-export', from: 'coll', to: 'tempo', label: bi('отобранные трейсы', 'sampled traces'), card: card(bi('Сюда доходит только то, что прошло сэмплирование.', 'Only what passed sampling gets here.'), bi('Collector, экспортёр otlp.', 'The Collector, the otlp exporter.')) },
      { id: 'e-log', from: 'api', to: 'logs', dashed: true, label: 'trace_id', labelAt: 0.6, card: card(bi('Та же связка в журналах: строка помнит, к какому трейсу она относится.', 'The same link in the logs: a line remembers which trace it belongs to.'), bi('Библиотека журналирования api.', 'The api logging library.')) },
    ],
  },
  params: [
    {
      id: 'queries',
      label: bi('Запросов к базе на один заказ', 'Database queries per order'),
      kind: 'range',
      min: 1,
      max: 15,
      step: 1,
      default: 1,
      near: 'e-sql',
      predict: {
        prompt: bi('Новая версия делает запрос к базе на каждый товар корзины — 12 вместо одного. Где это будет видно на водопаде?', 'The new version makes a database query per cart item, 12 instead of one. Where will that show on the waterfall?'),
        options: [
          { id: 'db', text: bi('Лесенка коротких спанов SELECT и долгое ожидание соединения', 'A staircase of short SELECT spans and a long wait for a connection') },
          { id: 'front', text: bi('Вырастет только спан frontend', 'Only the frontend span grows') },
        ],
        resolve: (_p, n) => (n.some((s) => s.id === 'pool' && String(s.values?.api ?? '').includes('wait')) ? 'db' : 'front'),
      },
    },
    { id: 'dbMs', label: bi('Время одного запроса к базе, мс', 'Time of one database query, ms'), kind: 'range', min: 1, max: 100, step: 1, default: 8, near: 'db' },
    { id: 'sampling', label: bi('Сэмплирование в Collector', 'Sampling in the Collector'), kind: 'choice', default: '100', options: [{ id: '100', label: bi('всё (100%)', 'everything (100%)') }, { id: '10', label: bi('каждый десятый', 'one in ten') }, { id: 'errors', label: bi('только ошибки и медленные (tail)', 'only errors and slow ones (tail)') }], near: 'coll' },
  ],
  breaks: [
    {
      id: 'no-propagation',
      label: bi('api не читает traceparent', 'api does not read traceparent'),
      remove: ['e-call'],
      boundary: 'network',
      predict: {
        prompt: bi('В api забыли подключить инструментирование HTTP-сервера, и он не читает traceparent. Сколько трейсов окажется в хранилище на один заказ?', 'In api someone forgot to plug in the HTTP server instrumentation, and it does not read traceparent. How many traces end up in the store per order?'),
        options: [
          { id: 'two', text: bi('Два несвязанных: frontend отдельно, api отдельно', 'Two unrelated ones: frontend alone, api alone') },
          { id: 'one', text: bi('Один, просто без части спанов', 'One, just missing some spans') },
        ],
        resolve: (_p, n) => ((last(n).traces ?? 1) === 2 ? 'two' : 'one'),
      },
    },
    {
      id: 'collector-down',
      label: bi('Collector недоступен', 'The Collector is down'),
      remove: ['coll', 'e-export'],
      predict: {
        prompt: bi('Collector лёг. Что станет с сервисами?', 'The Collector is down. What happens to the services?'),
        options: [
          { id: 'fine', text: bi('Работают как прежде, а спаны теряются', 'They work as before, and the spans are lost') },
          { id: 'slow', text: bi('Запросы начнут ждать, пока спаны отправятся', 'Requests start waiting until the spans are sent') },
        ],
        resolve: () => 'fine',
      },
    },
  ],
  metrics: [
    { id: 'ms', label: bi('время заказа', 'order time'), unit: 'ms' },
    { id: 'kept', label: bi('трейсов сохранено из 1000', 'traces kept out of 1000') },
    { id: 'traces', label: bi('трейсов на один заказ', 'traces per order') },
  ],
  run(p, broken) {
    const n = traceNumbers(p, broken);
    const split = broken.has('no-propagation');
    let ms = 0;
    const m = () => ({ ms, kept: n.kept, traces: n.traces });
    const steps: Step[] = [];
    ms = 2;
    steps.push({ id: 'root', label: 'frontend', caption: bi('frontend получает POST /checkout, создаёт trace_id 4bf92f… и корневой спан.', 'frontend receives POST /checkout, creates the trace_id 4bf92f… and the root span.'), focus: ['front'], states: { front: 'on' }, values: { front: 'trace 4bf92f…' }, metrics: m() });
    ms += 3;
    steps.push({ id: 'call', label: 'traceparent', caption: split ? bi('frontend отправляет заголовок, но api его не читает и начинает свой трейс с новым trace_id 9d1e07….', 'frontend sends the header, but api does not read it and starts its own trace with a new trace_id 9d1e07….') : bi('frontend вызывает api и передаёт traceparent: тот же trace_id и свой span_id как родителя.', 'frontend calls api and passes traceparent: the same trace_id and its own span_id as the parent.'), focus: ['e-call', 'api'], tokens: [{ edge: 'e-call', label: split ? '?' : '00-4bf92f…-01' }], states: { api: split ? 'warn' : 'on', 'e-call': split ? 'err' : 'on' }, values: { api: split ? 'trace 9d1e07… (new)' : 'trace 4bf92f…' }, metrics: m() });
    const wait = p.queries > 8 ? (p.queries - 8) * 60 : 1;
    ms += wait;
    steps.push({ id: 'pool', label: 'db.pool.acquire', caption: wait > 1 ? fmt(bi('Соединений в пуле не хватает: спан db.pool.acquire ждёт {w} мс, прежде чем api сможет пойти в базу.', 'The pool runs short of connections: the db.pool.acquire span waits {w} ms before api can go to the database.'), { w: wait }) : bi('Соединение из пула выдаётся сразу.', 'A connection from the pool is handed out at once.'), focus: ['api'], states: { api: wait > 1 ? 'warn' : 'on' }, values: { api: wait > 1 ? `pool wait ${wait} ms` : 'pool: free' }, metrics: m() });
    ms += p.queries * p.dbMs;
    steps.push({ id: 'sql', label: `SELECT ×${p.queries}`, caption: p.queries > 1 ? fmt(bi('{q} одинаковых запросов SELECT products по {d} мс подряд: на водопаде — лесенка коротких спанов, вместе {t} мс.', '{q} identical SELECT products queries of {d} ms in a row: a staircase of short spans on the waterfall, {t} ms together.'), { q: p.queries, d: p.dbMs, t: p.queries * p.dbMs }) : fmt(bi('Один запрос с JOIN: {d} мс.', 'One query with a JOIN: {d} ms.'), { d: p.dbMs }), focus: ['e-sql', 'db'], tokens: [{ edge: 'e-sql', label: `×${p.queries}` }], states: { db: 'on' }, values: { db: `SELECT products ×${p.queries}` }, metrics: m() });
    ms += 6;
    steps.push({ id: 'reply', label: bi('ответ', 'reply'), caption: fmt(bi('api отвечает, frontend закрывает корневой спан: заказ занял {t} мс.', 'api replies and frontend closes the root span: the order took {t} ms.'), { t: ms }), focus: ['front', 'api'], states: { front: 'ok' }, metrics: m(), tokens: [{ edge: 'e-call', reverse: true, label: '200' }] });
    if (broken.has('collector-down')) {
      steps.push({ id: 'lost', label: 'OTLP ✗', caption: bi('SDK пытается отправить пачку спанов, получает отказ и через несколько попыток выбрасывает её. Запросы пользователей при этом не ждут.', 'The SDK tries to send a batch of spans, gets refused and drops it after a few attempts. User requests do not wait meanwhile.'), focus: ['e-otlp-a', 'e-otlp-f', 'coll'], states: { coll: 'err', tempo: 'off' }, metrics: m(), broken: { at: 'coll', message: 'traces export: context deadline exceeded: rpc error: code = Unavailable desc = connection refused', caption: bi('трейсы — диагностика, а не часть запроса: потеря Collector не ломает сервис, но оставляет вас без водопада. Следите за счётчиком отброшенных спанов.', 'traces are diagnostics, not part of the request: losing the Collector does not break the service but leaves you without a waterfall. Watch the dropped-spans counter.') } });
      return steps;
    }
    steps.push({ id: 'ship', label: 'OTLP', caption: bi('Оба сервиса отправляют свои спаны в Collector; он собирает их в трейс по trace_id.', 'Both services send their spans to the Collector; it assembles them into a trace by trace_id.'), focus: ['e-otlp-f', 'e-otlp-a', 'coll'], tokens: [{ edge: 'e-otlp-f', label: '1 span' }, { edge: 'e-otlp-a', label: `${p.queries + 2} spans` }], states: { coll: 'on' }, metrics: m() });
    steps.push({ id: 'sample', label: bi('отбор', 'sampling'), caption: p.sampling === '100' ? bi('Сохраняется каждый трейс: видно всё, но хранить дорого.', 'Every trace is kept: everything is visible, but storage is expensive.') : p.sampling === '10' ? bi('Сохраняется каждый десятый: редкий медленный заказ легко потерять.', 'One in ten is kept: a rare slow order is easily lost.') : bi('Collector ждёт конца трейса и сохраняет только ошибки и медленные — самое нужное для разбора.', 'The Collector waits for the trace to end and keeps only errors and slow ones, what an investigation needs most.'), focus: ['coll', 'e-export', 'tempo'], tokens: [{ edge: 'e-export', label: `${n.kept}/1000` }], states: { tempo: 'on' }, values: { tempo: split ? '2 traces / order' : '1 trace / order' }, metrics: m() });
    if (split) steps.push({ id: 'split', label: bi('два трейса', 'two traces'), caption: bi('В хранилище два трейса одного заказа: короткий frontend и отдельный api. Водопада «запрос целиком» больше нет.', 'The store holds two traces of one order: a short frontend one and a separate api one. There is no "whole request" waterfall any more.'), focus: ['tempo', 'e-call'], states: { tempo: 'warn' }, metrics: m(), broken: { at: 'e-call', message: 'trace 4bf92f…: 1 span (frontend) · trace 9d1e07…: ' + (p.queries + 2) + ' spans (api)', caption: bi('связь сервисов держится на одном заголовке: каждый сервис должен читать его и передавать дальше.', 'the link between services hangs on one header: every service must read it and pass it on.') } });
    return steps;
  },
  explainDelta(prev, next, change): Bi {
    if (change.kind === 'break') return change.on ? (change.id === 'no-propagation' ? bi('Без traceparent каждый сервис начинает свой трейс.', 'Without traceparent each service starts its own trace.') : bi('Спаны теряются, сервис работает.', 'Spans are lost, the service works.')) : bi('Поломка убрана.', 'The break is removed.');
    if (change.id === 'sampling') return fmt(bi('Сохраняется трейсов из 1000: {a} → {b}.', 'Traces kept out of 1000: {a} → {b}.'), { a: last(prev).kept ?? 0, b: last(next).kept ?? 0 });
    return fmt(bi('Время заказа: {a} → {b} мс.', 'Order time: {a} → {b} ms.'), { a: last(prev).ms ?? 0, b: last(next).ms ?? 0 });
  },
});

// ── Where container metrics come from ──

type CgP = { memLimit: number; memUse: number; cpuLimit: string; cpuNeed: number };

export function cgNumbers(p: CgP): { ratio: number; throttle: number; oom: boolean; usage: number } {
  const lim = Number(p.cpuLimit) / 1000;
  const throttle = p.cpuNeed > lim ? Math.min(0.95, (p.cpuNeed - lim) / p.cpuNeed + 0.05) : p.cpuNeed > lim * 0.9 ? 0.05 : 0;
  return { ratio: Math.min(1, p.memUse / p.memLimit), throttle: Math.round(throttle * 100) / 100, oom: p.memUse > p.memLimit, usage: Math.min(p.cpuNeed, lim) };
}

export const cgModel = defineModel<CgP>({
  id: 'obs.container-metrics',
  block: 'monitoring',
  title: bi('Откуда берутся метрики контейнера', 'Where container metrics come from'),
  summary: bi('Память и процессор контейнера — это файлы его cgroup на узле; их читает cAdvisor в kubelet. Что контейнеру положено — limits, число реплик, фаза пода — берётся из объектов API, и это ряды kube-state-metrics.', 'A container’s memory and CPU are the files of its cgroup on the node, read by cAdvisor in the kubelet. What the container is entitled to (limits, the replica count, the pod phase) comes from API objects, and those are kube-state-metrics series.'),
  concepts: ['obs.cadvisor', 'obs.kube-state-metrics', 'obs.throttling'],
  diagram: {
    width: 960,
    height: 460,
    nodes: [
      { id: 'proc', label: bi('процесс api', 'api process'), sub: 'RSS 300 Mi', family: 'process', shape: 'box', x: 40, y: 56, w: 184, h: 64, card: card(bi('Процесс контейнера. Ядро учитывает его память и время процессора в cgroup пода.', 'The container’s process. The kernel accounts its memory and CPU time in the pod’s cgroup.'), bi('Среда контейнеров запустила его по спецификации пода.', 'The container runtime started it from the pod spec.'), 'kubectl top pod') },
      { id: 'cg', label: 'cgroup: memory.current · cpu.stat', sub: 'memory.max 512Mi · cpu.max 20000 100000', family: 'kernel', shape: 'bar', x: 24, y: 384, w: 912, h: 56, card: card(bi('Файлы cgroup v2 пода на узле: memory.current, memory.max, memory.events (oom_kill), cpu.max и cpu.stat (nr_periods, nr_throttled). Те же, что вы читали в блоке Linux.', 'The pod’s cgroup v2 files on the node: memory.current, memory.max, memory.events (oom_kill), cpu.max and cpu.stat (nr_periods, nr_throttled). The same ones you read in the Linux block.'), bi('Ядро; лимиты записывает kubelet из спецификации пода.', 'The kernel; the kubelet writes the limits from the pod spec.'), 'cat /sys/fs/cgroup/kubepods.slice/…/memory.current', { url: 'https://docs.kernel.org/admin-guide/cgroup-v2.html', label: 'kernel.org › cgroup v2' }) },
      { id: 'cad', label: 'kubelet / cAdvisor', sub: '/metrics/cadvisor', family: 'node', shape: 'rack', x: 300, y: 200, w: 200, h: 80, card: card(bi('Встроенный в kubelet cAdvisor читает файлы cgroup всех контейнеров узла и отдаёт container_memory_working_set_bytes, container_cpu_usage_seconds_total, container_cpu_cfs_throttled_periods_total.', 'cAdvisor, built into the kubelet, reads the cgroup files of every container on the node and serves container_memory_working_set_bytes, container_cpu_usage_seconds_total, container_cpu_cfs_throttled_periods_total.'), bi('kubelet на каждом узле.', 'The kubelet on every node.'), 'kubectl get --raw /api/v1/nodes/node-3/proxy/metrics/cadvisor') },
      { id: 'spec', label: 'Pod / Deployment', sub: 'limits.memory: 512Mi', family: 'obj', shape: 'doc', x: 300, y: 40, w: 200, h: 72, card: card(bi('Объекты API: что заказано (replicas, limits, requests) и что получилось (phase, restarts, причина последнего завершения).', 'API objects: what was ordered (replicas, limits, requests) and what came out (phase, restarts, the reason of the last termination).'), bi('Вы, через манифесты; статус пишут контроллеры и kubelet.', 'You, through manifests; controllers and the kubelet write the status.'), 'kubectl get pod api-6f9c7d-q7rvn -o yaml') },
      { id: 'ksm', label: 'kube-state-metrics', sub: 'watch API', family: 'cp', shape: 'hex', x: 580, y: 40, w: 184, h: 72, card: card(bi('Следит за объектами API и превращает их поля в ряды: kube_pod_status_phase, kube_pod_container_status_restarts_total, kube_deployment_status_replicas_available.', 'Watches API objects and turns their fields into series: kube_pod_status_phase, kube_pod_container_status_restarts_total, kube_deployment_status_replicas_available.'), bi('Deployment kube-state-metrics в кластере.', 'The kube-state-metrics Deployment in the cluster.'), undefined, { url: 'https://github.com/kubernetes/kube-state-metrics/tree/main/docs', label: 'kube-state-metrics › docs' }) },
      { id: 'prom', label: 'Prometheus', sub: 'scrape', family: 'cp', shape: 'hex', x: 580, y: 200, w: 184, h: 80, card: card(bi('Забирает оба набора рядов. Запрос может соединить их: использование из cAdvisor делят на лимит из kube-state-metrics или из самого cAdvisor.', 'Pulls both sets of series. A query can join them: usage from cAdvisor divided by the limit from kube-state-metrics or from cAdvisor itself.'), bi('Prometheus; цели находит через kubernetes_sd_configs.', 'Prometheus; it finds targets through kubernetes_sd_configs.')) },
      { id: 'answer', label: 'PromQL', sub: 'working set / limit', family: 'flow', shape: 'box', x: 800, y: 120, w: 144, h: 80, card: card(bi('Ответ на вопрос «насколько контейнер близок к своему лимиту». Это метод USE для контейнера: использование, насыщение (троттлинг), ошибки (OOM, перезапуски).', 'The answer to "how close is the container to its limit". That is the USE method for a container: utilisation, saturation (throttling), errors (OOM, restarts).'), bi('Вы, в дашборде или алерте.', 'You, in a dashboard or an alert.')) },
    ],
    edges: [
      { id: 'e-acct', from: 'proc', to: 'cg', label: bi('учёт ядра', 'kernel accounting'), card: card(bi('Каждая выделенная страница и каждый квант процессора попадают в счётчики cgroup.', 'Every allocated page and every CPU slice lands in the cgroup counters.'), bi('Ядро.', 'The kernel.')) },
      { id: 'e-read', from: 'cg', to: 'cad', label: bi('чтение файлов', 'reading files'), labelAt: 0.4, card: card(bi('cAdvisor читает memory.current, cpu.stat и другие файлы при каждом scrape.', 'cAdvisor reads memory.current, cpu.stat and other files on every scrape.'), bi('cAdvisor.', 'cAdvisor.')) },
      { id: 'e-watch', from: 'spec', to: 'ksm', label: 'watch', card: card(bi('kube-state-metrics подписан на изменения объектов, как контроллер, но ничего не меняет.', 'kube-state-metrics subscribes to object changes like a controller, but changes nothing.'), bi('kube-state-metrics.', 'kube-state-metrics.')) },
      { id: 'e-s1', from: 'prom', to: 'cad', label: 'GET /metrics/cadvisor', card: card(bi('Цель — каждый kubelet.', 'The target is every kubelet.'), bi('Prometheus.', 'Prometheus.')) },
      { id: 'e-s2', from: 'prom', to: 'ksm', label: 'GET /metrics', card: card(bi('Цель — один kube-state-metrics на кластер.', 'The target is one kube-state-metrics per cluster.'), bi('Prometheus.', 'Prometheus.')) },
      { id: 'e-q', from: 'prom', to: 'answer', label: bi('запрос', 'query'), card: card(bi('Ряды из двух источников соединяются по меткам namespace, pod, container.', 'Series from the two sources join by the namespace, pod, container labels.'), bi('Вы.', 'You.')) },
    ],
    groups: [{ id: 'pod', label: bi('под api-6f9c7d-q7rvn', 'pod api-6f9c7d-q7rvn'), around: ['proc'], family: 'ns', dash: 'dash', card: card(bi('Граница пода: пространства имён и одна cgroup на все контейнеры пода, с подгруппой на каждый контейнер.', 'The pod boundary: namespaces and one cgroup for all the pod’s containers, with a sub-group per container.'), bi('kubelet и среда контейнеров.', 'The kubelet and the container runtime.')) }],
  },
  params: [
    { id: 'memLimit', label: bi('limits.memory, Mi', 'limits.memory, Mi'), kind: 'range', min: 128, max: 1024, step: 64, default: 512, near: 'spec' },
    {
      id: 'memUse',
      label: bi('Память, которую хочет процесс, Mi', 'Memory the process wants, Mi'),
      kind: 'range',
      min: 64,
      max: 1200,
      step: 16,
      default: 300,
      near: 'proc',
      predict: {
        prompt: bi('Процессу понадобилось больше памяти, чем limits.memory. Что произойдёт?', 'The process needs more memory than limits.memory. What happens?'),
        options: [
          { id: 'oom', text: bi('Ядро убьёт процесс (OOMKilled), kubelet перезапустит контейнер, restarts +1', 'The kernel kills the process (OOMKilled), the kubelet restarts the container, restarts +1') },
          { id: 'slow', text: bi('Процесс замедлится, как при нехватке CPU', 'The process slows down, as with too little CPU') },
        ],
        resolve: (_p, n) => (n.some((s) => s.id === 'oom') ? 'oom' : 'slow'),
      },
    },
    { id: 'cpuLimit', label: bi('limits.cpu', 'limits.cpu'), kind: 'choice', default: '1000', options: [{ id: '200', label: bi('200m', '200m') }, { id: '500', label: bi('500m', '500m') }, { id: '1000', label: bi('1 ядро', '1 core') }], near: 'cg' },
    {
      id: 'cpuNeed',
      label: bi('Сколько CPU нужно процессу, ядер', 'CPU the process needs, cores'),
      kind: 'range',
      min: 0.05,
      max: 1.5,
      step: 0.05,
      default: 0.2,
      near: 'cad',
      predict: {
        prompt: bi('Процессу нужно больше CPU, чем limits.cpu. Что произойдёт?', 'The process needs more CPU than limits.cpu. What happens?'),
        options: [
          { id: 'throttle', text: bi('Ядро будет притормаживать его каждые 100 мс: троттлинг, задержки растут', 'The kernel holds it back every 100 ms: throttling, latency grows') },
          { id: 'kill', text: bi('Ядро убьёт процесс, как при нехватке памяти', 'The kernel kills it, as with too little memory') },
        ],
        resolve: (_p, n) => ((last(n).throttle ?? 0) > 0.1 ? 'throttle' : 'kill'),
      },
    },
  ],
  breaks: [
    {
      id: 'ksm-down',
      label: bi('kube-state-metrics не работает', 'kube-state-metrics is down'),
      remove: ['ksm', 'e-watch', 'e-s2'],
      predict: {
        prompt: bi('kube-state-metrics упал. Что вернёт запрос increase(kube_pod_container_status_restarts_total[15m]) > 3?', 'kube-state-metrics is down. What does increase(kube_pod_container_status_restarts_total[15m]) > 3 return?'),
        options: [
          { id: 'empty', text: bi('Пустой результат — и алерт на перезапуски молча перестанет срабатывать', 'An empty result, and the restarts alert silently stops firing') },
          { id: 'zero', text: bi('Нули по всем подам', 'Zeros for every pod') },
        ],
        resolve: () => 'empty',
      },
    },
  ],
  metrics: [
    { id: 'ratio', label: bi('память / лимит', 'memory / limit') },
    { id: 'throttle', label: bi('доля периодов с троттлингом', 'share of throttled periods') },
    { id: 'restarts', label: bi('перезапусков', 'restarts') },
  ],
  run(p, broken) {
    const n = cgNumbers(p);
    const m = { ratio: Math.round(n.ratio * 100) / 100, throttle: n.throttle, restarts: n.oom ? 1 : 0 };
    const steps: Step[] = [
      { id: 'acct', label: 'cgroup', caption: fmt(bi('Ядро учитывает процесс в cgroup пода: memory.current ≈ {u} Mi при memory.max = {l} Mi; cpu.max = {c}000 100000.', 'The kernel accounts the process in the pod’s cgroup: memory.current ≈ {u} Mi with memory.max = {l} Mi; cpu.max = {c}000 100000.'), { u: Math.min(p.memUse, p.memLimit), l: p.memLimit, c: Number(p.cpuLimit) / 10 }), focus: ['proc', 'e-acct', 'cg'], tokens: [{ edge: 'e-acct', label: 'pages' }], states: { proc: 'on', cg: 'on' }, values: { proc: `RSS ${Math.min(p.memUse, p.memLimit)} Mi`, cg: `memory.max ${p.memLimit}Mi · cpu.max ${Number(p.cpuLimit) * 100} 100000` } },
    ];
    if (n.oom) steps.push({ id: 'oom', label: 'OOMKilled', caption: fmt(bi('Процесс просит {u} Mi при лимите {l} Mi. Освободить нечего — ядро убивает его, memory.events: oom_kill 1; kubelet перезапускает контейнер.', 'The process asks for {u} Mi with a limit of {l} Mi. Nothing can be freed, so the kernel kills it, memory.events: oom_kill 1; the kubelet restarts the container.'), { u: p.memUse, l: p.memLimit }), focus: ['proc', 'cg'], states: { proc: 'err' }, values: { proc: 'OOMKilled · restarts 1' } });
    if (n.throttle > 0.1) steps.push({ id: 'throttle', label: bi('троттлинг', 'throttling'), caption: fmt(bi('Процессу нужно {need} ядра, а квота — {lim}. В {pct}% периодов по 100 мс он упирается в квоту и ждёт: nr_throttled растёт, ответы медленнее, а график CPU показывает «всего» {lim}.', 'The process needs {need} cores and the quota is {lim}. In {pct}% of the 100 ms periods it hits the quota and waits: nr_throttled grows, replies get slower, and the CPU graph shows "only" {lim}.'), { need: p.cpuNeed, lim: Number(p.cpuLimit) / 1000, pct: Math.round(n.throttle * 100) }), focus: ['cg'], states: { cg: 'warn' } });
    steps.push({ id: 'cad', label: 'cAdvisor', caption: bi('cAdvisor в kubelet читает файлы cgroup и отдаёт их как ряды container_*.', 'cAdvisor in the kubelet reads the cgroup files and serves them as container_* series.'), focus: ['e-read', 'cad'], tokens: [{ edge: 'e-read', label: 'memory.current' }], states: { cad: 'on' }, values: { cad: `working_set ${Math.min(p.memUse, p.memLimit)}Mi` } });
    if (broken.has('ksm-down')) {
      steps.push({ id: 'ksmdown', label: 'ksm ✗', caption: bi('kube-state-metrics не отвечает: рядов kube_* просто нет. Не нули — пустота, и правила с ними молчат.', 'kube-state-metrics does not answer: the kube_* series simply do not exist. Not zeros but nothing, and the rules using them stay silent.'), focus: ['ksm', 'e-s2', 'prom'], states: { ksm: 'err' }, metrics: m, broken: { at: 'ksm', message: 'up{job="kube-state-metrics"} == 0 · increase(kube_pod_container_status_restarts_total[15m]) > 3 → empty result', caption: bi('на каждый важный источник рядов нужен свой алерт «источник пропал»: up == 0 или absent().', 'every important source of series needs its own "the source is gone" alert: up == 0 or absent().') } });
      return steps;
    }
    steps.push(
      { id: 'ksm', label: 'kube-state-metrics', caption: n.oom ? bi('kube-state-metrics видит в статусе пода restartCount 1 и lastState.terminated.reason: OOMKilled.', 'kube-state-metrics sees restartCount 1 and lastState.terminated.reason: OOMKilled in the pod status.') : bi('kube-state-metrics превращает поля объектов в ряды: лимиты, фазу, число перезапусков, доступные реплики.', 'kube-state-metrics turns object fields into series: limits, phase, restart count, available replicas.'), focus: ['spec', 'e-watch', 'ksm'], tokens: [{ edge: 'e-watch', label: 'status' }], states: { ksm: 'on', spec: n.oom ? 'warn' : 'on' }, values: { spec: `limits.memory: ${p.memLimit}Mi`, ksm: n.oom ? 'restarts_total 1' : 'restarts_total 0' } },
      { id: 'scrape', label: 'scrape', caption: bi('Prometheus забирает оба источника по расписанию.', 'Prometheus pulls both sources on schedule.'), focus: ['e-s1', 'e-s2', 'prom'], tokens: [{ edge: 'e-s1', reverse: true, label: 'container_*' }, { edge: 'e-s2', reverse: true, label: 'kube_*' }], states: { prom: 'on' } },
      { id: 'answer', label: 'PromQL', caption: fmt(bi('Память к лимиту — {r}; доля периодов с троттлингом — {t}. Это USE для контейнера: использование, насыщение, ошибки.', 'Memory to limit: {r}; share of throttled periods: {t}. That is USE for a container: utilisation, saturation, errors.'), { r: m.ratio, t: n.throttle }), focus: ['e-q', 'answer'], tokens: [{ edge: 'e-q', label: String(m.ratio) }], states: { answer: n.oom || n.throttle > 0.1 ? 'warn' : 'ok' }, values: { answer: `ratio ${m.ratio} · throttled ${n.throttle}` }, metrics: m },
    );
    return steps;
  },
  explainDelta(prev, next, change): Bi {
    if (change.kind === 'break') return change.on ? bi('Источник пропал — ряды исчезли, а не обнулились.', 'The source is gone: the series vanished rather than became zero.') : bi('kube-state-metrics снова работает.', 'kube-state-metrics works again.');
    const a = last(prev);
    const b = last(next);
    if (change.id === 'cpuNeed' || change.id === 'cpuLimit') return fmt(bi('Троттлинг: {a} → {b}. Лимит CPU не убивает, а притормаживает.', 'Throttling: {a} → {b}. A CPU limit does not kill, it holds back.'), { a: a.throttle ?? 0, b: b.throttle ?? 0 });
    return fmt(bi('Память к лимиту: {a} → {b}; перезапусков {c}.', 'Memory to limit: {a} → {b}; restarts {c}.'), { a: a.ratio ?? 0, b: b.ratio ?? 0, c: b.restarts ?? 0 });
  },
});
