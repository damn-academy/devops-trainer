// Explainers of the second half of the Monitoring block (06 §7.4, §7.10):
// the path of a log line from stdout to a LogQL answer, the path of a trace
// across services (traceparent, spans, sampling, the Collector), and where
// container metrics come from (cgroup files, cAdvisor, kube-state-metrics).
//
// Reading order, as in the gold explainers: each picture starts with one or
// two participants and grows as the process reaches the next one. The
// participant at work says in a callout what it does now, what it hands on
// travels along the line as a labelled card, and the knobs are grouped by the
// part of the real system they change.

import { defineModel } from '../../core/define';
import { bi, pluralRu, type Bi } from '../../core/i18n';
import type { ElementState, Step } from '../../core/types';
import { card } from '../git-cicd/explainers';
import { fb } from './explainer';

/** "1 ядро", "2 ядра", "0,5 ядра" in Russian and the bare number in English. */
/** "3,8 ГБ" or "420 МБ" in Russian and the number of megabytes in English. */
const volume = (mb: number): Bi => bi(mb >= 1000 ? `${(mb / 1000).toFixed(1).replace('.', ',')} ГБ` : `${mb} МБ`, String(mb));
const cores = (n: number): Bi =>
  bi(Number.isInteger(n) ? `${n} ${pluralRu(n, ['ядро', 'ядра', 'ядер'])}` : `${String(n).replace('.', ',')} ядра`, String(n));

const last = (s: Step[]) => s[s.length - 1]?.metrics ?? {};
const BYTES_PER_LINE = 220;
const hide = (all: string[], ...shown: string[]): Record<string, ElementState> => Object.fromEntries(all.filter((id) => !shown.includes(id)).map((id) => [id, 'hidden' as ElementState]));

// ── The path of a log line ──

type LogP = { format: string; userLabel: boolean; rate: number };

export function logNumbers(p: LogP): { streams: number; mbDay: number; parsed: boolean } {
  return { streams: p.userLabel ? 6 * 20000 : 6, mbDay: Math.round((p.rate * 86400 * BYTES_PER_LINE) / 1e6), parsed: p.format === 'json' };
}

const LOG_ALL = ['app', 'file', 'agent', 'index', 'chunks', 'query', 'grafana', 'e-write', 'e-tail', 'e-push', 'e-store', 'e-select', 'e-scan', 'e-show'];
const JSON_LINE = '{"level":"error","status":500,…}';
const TEXT_LINE = 'ERROR checkout … (500)';

export const logModel = defineModel<LogP>({
  id: 'obs.log-path',
  block: 'monitoring',
  title: bi('Как строка журнала попадает из программы на экран Grafana', 'How a log line gets from a program to the Grafana screen'),
  summary: bi(
    'Сервису api не удалось оформить заказ, и он записал об этом строку в журнал. Схема показывает путь этой строки: программа пишет её в стандартный вывод, среда контейнеров кладёт её в файл, агент читает файл и отправляет строку в Loki вместе с метками. Loki индексирует только метки, а сами строки перебирает, когда вы задаёте запрос.',
    'The api service failed to place an order and wrote a line about it into its log. The diagram shows the path of that line: the program writes it to standard output, the container runtime puts it into a file, an agent reads the file and sends the line to Loki together with labels. Loki indexes only the labels and scans the lines themselves when you run a query.',
  ),
  intro: bi(
    'Схема соберётся по шагам, и сейчас на ней есть только процесс api. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Новый участник появляется, когда до него доходит строка. Облачко у подсвеченного участника говорит, что он делает, а карточка на линии показывает, что он передаёт дальше.\n\nКогда дойдёте до экрана Grafana, переключите в «Параметрах» формат строки на свободный текст и посмотрите, что станет с шагом поиска. Потом сделайте номер пользователя меткой и следите за числом потоков под схемой.',
    'The diagram builds itself step by step, and now it shows only the api process. Press “Start from the first step”, then go on with “Step forward” above the diagram. A participant appears when the line reaches it. The callout at the highlighted participant says what it does, and the card on the line shows what it hands on.\n\nOnce you reach the Grafana screen, switch the line format to free text in “Parameters” and see what happens to the search step. Then make the user number a label and watch the stream count under the diagram.',
  ),
  legend: [
    { mark: 'active', text: bi('участник, который работает сейчас', 'the participant working now') },
    { mark: 'say', text: bi('что он делает', 'what it does') },
    { mark: 'token', text: bi('то, что участник передаёт дальше, например строку, пачку строк или запрос', 'what the participant hands on, such as a line, a batch of lines or a query') },
    { mark: 'icon:process', text: bi('процесс сервиса', 'the service process') },
    { mark: 'icon:file', text: bi('файл журнала на узле', 'the log file on the node') },
    { mark: 'icon:container', text: bi('агент, который собирает журналы узла', 'the agent that collects the node’s logs') },
    { mark: 'icon:database', text: bi('индекс меток в Loki', 'the label index in Loki') },
    { mark: 'icon:disk', text: bi('сжатые куски строк в хранилище', 'compressed chunks of lines in storage') },
    { mark: 'icon:terminal', text: bi('запрос LogQL', 'a LogQL query') },
    { mark: 'icon:browser', text: bi('экран Grafana', 'the Grafana screen') },
    { mark: 'ok', text: bi('этап пройден', 'stage passed') },
    { mark: 'warn', text: bi('этап пройден с трудом, потому что индекс разросся или поиск стал ненадёжным', 'the stage was passed with trouble, because the index grew or the search became unreliable') },
    { mark: 'err', text: bi('на этом участнике строки перестали доходить', 'lines stopped arriving at this participant') },
  ],
  stopLabel: bi('Строки перестали доходить', 'Lines stopped arriving'),
  concepts: ['obs.structured-log', 'obs.log-stream', 'obs.logql'],
  diagram: {
    width: 960,
    height: 448,
    nodes: [
      { id: 'app', label: bi('Процесс api', 'The api process'), icon: 'process', sub: 'stdout', family: 'user', x: 24, y: 40, w: 220, h: 64, card: card(bi('Сервис пишет журнал в стандартный вывод, по строке на событие. Куда эти строки попадут дальше, он не знает и знать не должен, потому что доставкой занимается инфраструктура.', 'The service writes its log to standard output, one line per event. Where the lines go next it does not know and should not know, because delivery is the infrastructure’s job.'), bi('Строки пишет код сервиса через свою библиотеку журналирования.', 'The service code writes the lines through its logging library.'), 'kubectl logs deploy/api') },
      { id: 'file', label: bi('Файл журнала пода', 'The pod’s log file'), icon: 'file', sub: '/var/log/pods/…/0.log', family: 'kernel', x: 370, y: 40, w: 220, h: 64, card: card(bi('Среда контейнеров перехватывает стандартный вывод и дописывает каждую строку в файл на узле, добавив к ней время и имя потока. Когда файл вырастает до предела, его заменяют новым, а старый со временем удаляют; это называется ротацией.', 'The container runtime catches standard output and appends every line to a file on the node, adding the time and the stream name. When the file reaches its size limit it is replaced with a new one and the old one is later deleted; this is called rotation.'), bi('Файл ведёт среда контейнеров на узле: containerd или CRI-O.', 'The container runtime on the node keeps the file: containerd or CRI-O.'), 'ls /var/log/pods/') },
      { id: 'agent', label: bi('Агент', 'Agent'), icon: 'container', sub: 'Grafana Alloy', family: 'process', x: 716, y: 40, w: 220, h: 64, card: card(bi('Агент работает на каждом узле, дочитывает новые строки из файлов журналов, добавляет к ним метки из Kubernetes (namespace, app, instance) и пачками отправляет их в Loki. Агент помнит, до какого места дочитал каждый файл, и после перезапуска продолжает с этого места.', 'The agent runs on every node, reads the new lines of the log files, adds labels from Kubernetes (namespace, app, instance) and sends them to Loki in batches. The agent remembers how far it has read each file and continues from there after a restart.'), bi('Агент запускают на каждом узле кластера как DaemonSet, и обычно это Grafana Alloy (раньше Promtail), Fluent Bit или Vector.', 'The agent runs on every node of the cluster as a DaemonSet, and it is usually Grafana Alloy (formerly Promtail), Fluent Bit or Vector.'), undefined, { url: 'https://grafana.com/docs/loki/latest/send-data/', label: 'grafana.com › Send log data to Loki' }) },
      { id: 'index', label: bi('Индекс меток', 'Label index'), icon: 'database', sub: '6 streams', family: 'store', shape: 'buffer', x: 716, y: 200, w: 220, h: 64, card: card(bi('Loki индексирует только наборы меток. Все строки с одинаковым набором меток составляют один поток, и индекс знает, в каких кусках хранилища лежат строки каждого потока. Шкала внутри блока показывает, насколько индекс заполнен.', 'Loki indexes only label sets. All lines with the same label set make up one stream, and the index knows in which storage chunks the lines of each stream lie. The gauge inside the block shows how full the index is.'), bi('Индекс ведёт Loki.', 'Loki keeps the index.')) },
      { id: 'chunks', label: bi('Куски строк', 'Chunks of lines'), icon: 'disk', sub: 'gzip', family: 'store', shape: 'buffer', x: 370, y: 200, w: 220, h: 64, card: card(bi('Сами строки Loki сжимает и хранит кусками в объектном хранилище, без всякого индекса по содержимому. Поэтому хранить журналы дёшево, а искать слово в тексте приходится перебором строк.', 'Loki compresses the lines themselves and keeps them in chunks in object storage, with no index on their content at all. So storing logs is cheap, and finding a word in the text means scanning the lines.'), bi('Куски хранит Loki в объектном хранилище, например в S3, GCS или MinIO.', 'Loki keeps the chunks in object storage, such as S3, GCS or MinIO.')) },
      { id: 'query', label: bi('Запрос LogQL', 'LogQL query'), icon: 'terminal', work: 'spin', sub: '{app="api"} | json', family: 'flow', x: 370, y: 360, w: 220, h: 64, card: card(bi('Запрос на языке LogQL. Сначала он выбирает потоки по меткам, и это быстро, потому что метки проиндексированы. Потом он прогоняет строки выбранных потоков через фильтры и разбор полей, и эта часть работы идёт перебором.', 'A query in LogQL. First it selects streams by labels, which is fast because the labels are indexed. Then it runs the lines of the selected streams through filters and field parsing, and that part of the work is a scan.'), bi('Запрос пишете вы в Grafana Explore или в терминале командой logcli.', 'You write the query in Grafana Explore or in the terminal with logcli.'), 'logcli query \'{app="api"} |= "error"\'') },
      { id: 'grafana', label: 'Grafana', icon: 'browser', sub: 'Explore', family: 'neutral', x: 24, y: 360, w: 220, h: 64, card: card(bi('На экране Grafana видны найденные строки и график их числа во времени.', 'The Grafana screen shows the lines found and a graph of their count over time.'), bi('Grafana настраивает команда эксплуатации.', 'The operations team sets up Grafana.')) },
    ],
    edges: [
      { id: 'e-write', from: 'app', to: 'file', label: 'stdout', card: card(bi('Строка уходит в стандартный вывод процесса, а среда контейнеров перехватывает её и дописывает в файл.', 'The line goes to the process’s standard output, and the container runtime catches it and appends it to the file.'), bi('Строку пишет процесс, а в файл её кладёт среда контейнеров.', 'The process writes; the container runtime files it.')) },
      { id: 'e-tail', from: 'file', to: 'agent', label: bi('новые строки', 'new lines'), card: card(bi('Агент читает файл с того места, где остановился в прошлый раз, так же как команда tail -F.', 'The agent reads the file from where it stopped last time, the way tail -F does.'), bi('Файл читает агент.', 'The agent reads.')) },
      { id: 'e-push', from: 'agent', to: 'index', label: bi('пачка с метками', 'batch with labels'), card: card(bi('Пачка строк с метками потока уходит в Loki запросом POST /loki/api/v1/push. Метки попадают в индекс, строки в куски.', 'A batch of lines with the stream labels goes to Loki with POST /loki/api/v1/push. The labels go into the index, the lines into chunks.'), bi('Пачку отправляет агент.', 'The agent sends it.')) },
      { id: 'e-store', from: 'index', to: 'chunks', label: bi('где лежат строки', 'where the lines lie'), card: card(bi('Индекс помнит, в каких кусках лежат строки каждого потока.', 'The index remembers in which chunks the lines of each stream lie.'), bi('Эти связи хранит Loki.', 'Loki keeps the link.')) },
      { id: 'e-select', from: 'query', to: 'index', label: bi('выбор потоков', 'stream selection'), labelAt: 0.35, card: card(bi('Потоки, которые выбирает селектор, например `{app="api"}`, Loki находит по индексу без перебора строк.', 'Loki finds a stream selector such as {app="api"} through the index, without scanning lines.'), bi('Потоки по индексу выбирает Loki.', 'Loki selects the streams through the index.')) },
      { id: 'e-scan', from: 'query', to: 'chunks', label: bi('перебор строк', 'line scan'), card: card(bi('Фильтры `|= "error"`, `| json` и `| status >= 500` Loki применяет к каждой строке выбранных потоков по очереди.', 'Loki applies the filters |= "error", | json and | status >= 500 to every line of the selected streams in turn.'), bi('Строки перебирает Loki.', 'Loki scans the lines.')) },
      { id: 'e-show', from: 'query', to: 'grafana', label: bi('найденные строки', 'lines found'), card: card(bi('Запрос по строкам возвращает сами строки, а запрос с count_over_time возвращает ряды чисел, как запрос PromQL.', 'A log query returns the lines themselves, and a query with count_over_time returns series of numbers, like a PromQL query.'), bi('Ответ отдаёт Loki.', 'Loki returns the answer.')) },
    ],
  },
  params: [
    { id: 'format', group: bi('Как сервис пишет журнал', 'How the service writes its log'), label: bi('В каком виде сервис пишет строку', 'How the service writes a line'), kind: 'choice', default: 'json', options: [{ id: 'json', label: bi('с именованными полями (JSON)', 'with named fields (JSON)') }, { id: 'plain', label: bi('свободным текстом', 'as free text') }], near: 'app', predict: {
      prompt: bi('Вы меняете вид строки, которую пишет сервис. Найдёт ли запрос на шаге поиска все ответы с кодом 5xx, и только их, при любой правке текста сообщения?', 'You change how the service writes a line. Will the query at the search step find every 5xx answer, and only those, whatever edits are made to the message text?'),
      options: [
        { id: 'yes', text: bi('Да, потому что код ответа лежит в поле status, и запрос берёт его по имени', 'Yes: the status code is in the status field and the query takes it by name') },
        { id: 'no', text: bi('Не наверняка, потому что код приходится выискивать в тексте регулярным выражением', 'Not for sure: the code has to be fished out of the text with a regular expression') },
      ],
      resolve: (_p, n) => (n.find((s) => s.id === 'scan')?.states?.chunks === 'ok' ? 'yes' : 'no'),
    } },
    {
      id: 'userLabel',
      group: bi('Какие метки ставит агент', 'Which labels the agent sets'),
      label: bi('Агент добавляет к меткам номер пользователя (user_id)', 'The agent adds the user number (user_id) to the labels'),
      kind: 'toggle',
      default: false,
      near: 'agent',
      predict: {
        prompt: bi('Агент начинает ставить номер пользователя в метки, а пользователей у магазина 20 000. Что станет с числом потоков в индексе?', 'The agent starts putting the user number into the labels, and the shop has 20,000 users. What happens to the number of streams in the index?'),
        options: [
          { id: 'boom', text: bi('Число потоков вырастет в 20 000 раз, потому что каждый пользователь станет отдельным потоком с крошечными кусками', 'The number of streams grows 20,000-fold, because every user becomes a separate stream with tiny chunks') },
          { id: 'fine', text: bi('Число потоков останется прежним, а поиск по пользователю станет быстрее', 'The number of streams stays the same, and searching by user gets faster') },
        ],
        resolve: (_p, n) => ((last(n).streams ?? 0) > 1000 ? 'boom' : 'fine'),
      },
    },
    { id: 'rate', group: bi('Сколько пишет сервис', 'How much the service writes'), label: bi('Сколько строк в секунду пишет сервис', 'How many lines per second the service writes'), kind: 'range', min: 10, max: 2000, step: 10, default: 200, near: 'chunks' },
  ],
  breaks: [
    {
      id: 'loki-down',
      label: bi('Loki отвечает ошибкой 503 и не принимает строки', 'Loki answers 503 and accepts no lines'),
      remove: ['e-push'],
      boundary: 'network',
      predict: {
        prompt: bi('Loki целый час отвечает агенту ошибкой 503. Что станет со строками, которые сервис пишет в этот час?', 'For a whole hour Loki answers the agent with error 503. What happens to the lines the service writes during that hour?'),
        options: [
          { id: 'buffer', text: bi('Агент придержит строки и будет повторять отправку, а пропадут они, только если среда контейнеров успеет заменить файл новым', 'The agent holds the lines back and keeps retrying, and they are lost only if the container runtime replaces the file with a new one first') },
          { id: 'kept', text: bi('Loki сам заберёт их позже из файлов на узле', 'Loki fetches them itself later from the files on the node') },
        ],
        resolve: (_p, n) => (n.some((s) => s.broken?.at === 'e-push') ? 'buffer' : 'kept'),
      },
    },
  ],
  metrics: [
    { id: 'streams', label: bi('потоков в индексе', 'streams in the index') },
    { id: 'mbDay', label: bi('объём строк за сутки', 'volume of lines per day'), unit: 'MB' },
  ],
  run(p, broken) {
    const n = logNumbers(p);
    const m = { streams: n.streams, mbDay: n.mbDay };
    const json = p.format === 'json';
    const line = json ? JSON_LINE : TEXT_LINE;
    const steps: Step[] = [
      {
        id: 'write',
        label: 'stdout',
        caption: json
          ? bi('Сервису api не удалось оформить заказ, и он пишет об этом строку в стандартный вывод. Строка записана в формате JSON, и у каждого сведения в ней есть своё имя: уровень error, маршрут /checkout, код ответа 500, длительность и trace_id. Поэтому потом любое поле можно будет взять по имени.', 'The api service failed to place an order and writes a line about it to standard output. The line is JSON: every piece of information has a name, the level error, the route /checkout, the status 500, the duration and the trace_id. So later any field can be taken out by name.')
          : bi('Сервису api не удалось оформить заказ, и он пишет об этом строку в стандартный вывод. Строка записана свободным текстом, который удобно читать человеку, а программе, чтобы достать из неё код ответа, придётся угадывать, где в тексте стоит число.', 'The api service failed to place an order and writes a line about it to standard output. The line is free text, which is easy for a human to read, but a program that wants the status code out of it will have to guess where in the text the number stands.'),
        focus: ['app'],
        say: { app: json ? bi('Процесс api пишет в стандартный вывод строку JSON с уровнем error и кодом 500.', 'The api process writes a JSON line with level error and status 500 to standard output.') : bi('Процесс api пишет в стандартный вывод строку текста: ERROR checkout failed (500).', 'The api process writes a text line to standard output: ERROR checkout failed (500).') },
        states: hide(LOG_ALL, 'app'),
        metrics: m,
      },
      {
        id: 'file',
        label: bi('файл', 'file'),
        caption: bi('Среда контейнеров перехватывает стандартный вывод процесса и дописывает строку в файл пода на узле, добавив в начало время и имя потока stdout. Сам процесс про этот файл ничего не знает.', 'The container runtime catches the process’s standard output and appends the line to the pod’s file on the node, adding the time and the stream name stdout at the front. The process itself knows nothing about this file.'),
        focus: ['e-write', 'file'],
        reveal: ['file', 'e-write'],
        tokens: [{ edge: 'e-write', label: line }],
        say: { file: bi('Среда контейнеров дописывает строку в файл пода вместе со временем.', 'The container runtime appends the line to the pod’s file with the time.') },
        values: { file: json ? 'stdout F {"level":…}' : 'stdout F ERROR …' },
        metrics: m,
      },
      {
        id: 'tail',
        label: bi('агент', 'agent'),
        caption: p.userLabel
          ? bi('Агент на узле дочитывает новые строки файла и добавляет к каждой метки из Kubernetes: namespace, app и instance. Но теперь он ставит в метку ещё и user_id, номер пользователя, у которого сломался заказ.', 'The agent on the node reads the new lines of the file and adds labels from Kubernetes to each: namespace, app and instance. But now it also puts user_id, the number of the user whose order broke, into a label.')
          : bi('Агент на узле дочитывает новые строки файла и добавляет к каждой метки из Kubernetes: namespace, app и instance. По этим меткам строки потом и будут выбирать.', 'The agent on the node reads the new lines of the file and adds labels from Kubernetes to each: namespace, app and instance. Lines will later be selected by these labels.'),
        focus: ['e-tail', 'agent'],
        reveal: ['agent', 'e-tail'],
        tokens: [{ edge: 'e-tail', label: line }],
        say: { agent: p.userLabel ? bi('Агент дочитывает файл и ставит строке метки app="api" и user_id="18342".', 'The agent reads the file and labels the line app="api" and user_id="18342".') : bi('Агент дочитывает файл и ставит строке метки namespace, app="api" и instance.', 'The agent reads the file and labels the line namespace, app="api" and instance.') },
        values: { agent: p.userLabel ? '{app="api", user_id=…}' : '{app="api", …}' },
        metrics: m,
      },
    ];
    if (broken.has('loki-down')) {
      steps.push({
        id: 'down',
        label: bi('отправка не удалась', 'push failed'),
        caption: bi('Агент отправляет пачку строк, но Loki отвечает ошибкой 503 и пачку не принимает. Агент не выбрасывает строки, а запоминает, до какого места дочитал файл, и повторяет отправку со всё более длинными паузами. Строки пропадут, только если среда контейнеров успеет заменить файл новым раньше, чем Loki заработает.', 'The agent sends a batch of lines, but Loki answers 503 and does not accept it. The agent does not throw the lines away but remembers how far it has read the file and retries with longer and longer pauses. The lines are lost only if the container runtime replaces the file with a new one before Loki works again.'),
        focus: ['agent', 'e-push'],
        reveal: ['index', 'e-push'],
        tokens: [{ edge: 'e-push', label: bi('пачка строк', 'batch of lines') }],
        say: { agent: bi('Агент получает ответ 503, держит позицию в файле и повторяет отправку.', 'The agent gets 503, holds its place in the file and retries.') },
        states: { agent: 'warn', index: 'err', 'e-push': 'err' },
        metrics: m,
        broken: {
          at: 'e-push',
          message: 'level=warn component=loki.write msg="error sending batch, will retry" status=503 error="server returned HTTP status 503 Service Unavailable (503)"',
          caption: bi('на отправке строк в Loki. Узнают такую поломку по предупреждениям в журнале самого агента и по провалу на графике числа строк. О провале должен сообщать отдельный алерт на конвейер журналов, иначе дыру обнаружат в день инцидента, когда журнал понадобится.', 'at sending lines to Loki. You recognise this break by the warnings in the agent’s own log and by a gap in the line-count graph. A separate alert on the log pipeline should report the gap; otherwise it is found on the day of an incident, when the log is needed.'),
        },
      });
      return steps;
    }
    steps.push(
      {
        id: 'push',
        label: bi('индекс', 'index'),
        caption: p.userLabel
          ? fb(bi('Loki записывает в индекс набор меток строки. Каждый пользователь дал свой набор меток, а значит, и свой поток, и потоков уже {s}. Индекс разбух в двадцать тысяч раз, хотя строк не прибавилось ни одной.', 'Loki writes the line’s label set into the index. Every user gave a label set of their own, and so a stream of their own: there are {s} streams already. The index has swelled twenty thousand times, though not a single line was added.'), { s: n.streams })
          : fb(bi('Агент отправляет пачку строк в Loki. Loki записывает в индекс только наборы меток, и таких наборов, то есть потоков, у сервиса api всего {s}. Индекс маленький, поэтому выбрать нужные потоки можно быстро.', 'The agent sends a batch of lines to Loki. Loki writes only the label sets into the index, and the api service has just {s} such sets, that is, streams. The index is small, so the right streams can be selected quickly.'), { s: n.streams }),
        focus: ['e-push', 'index'],
        reveal: ['index', 'e-push'],
        tokens: [{ edge: 'e-push', label: bi('пачка строк', 'batch of lines') }],
        say: { index: fb(bi('Loki записывает в индекс только метки, и потоков в нём сейчас {s}.', 'Loki writes only the labels into the index, and it now holds {s} streams.'), { s: n.streams }) },
        states: { index: p.userLabel ? 'warn' : 'ok', agent: 'ok' },
        values: { index: `${n.streams} streams` },
        fill: { index: p.userLabel ? 1 : 0.15 },
        metrics: m,
      },
      {
        id: 'store',
        label: bi('куски', 'chunks'),
        caption: p.userLabel
          ? bi('Сами строки Loki сжимает и складывает кусками в хранилище, отдельно для каждого потока. Но теперь в каждом потоке по нескольку строк, и куски получаются крошечными. Хранить такие куски дорого, а запросу придётся открывать тысячи кусков вместо нескольких.', 'Loki compresses the lines themselves and stores them in chunks, separately for each stream. But now each stream holds a few lines, and the chunks come out tiny. Such chunks are expensive to keep, and a query has to open thousands of chunks instead of a few.')
          : fb(bi('Сами строки Loki сжимает и складывает кусками в хранилище, без индекса по содержимому. При {r} строках в секунду за сутки набирается около {mb} строк. Хранить их дёшево, но найти слово в тексте можно только перебором.', 'Loki compresses the lines themselves and stores them in chunks, with no index on their content. At {r} lines per second about {mb} MB of lines pile up per day. They are cheap to keep, but a word in the text can only be found by scanning.'), { r: p.rate, mb: volume(n.mbDay) }),
        focus: ['e-store', 'chunks'],
        reveal: ['chunks', 'e-store'],
        tokens: [{ edge: 'e-store', label: 'gzip' }],
        say: { chunks: p.userLabel ? bi('Строки раскладываются по тысячам крошечных кусков, по одному на пользователя.', 'The lines are spread over thousands of tiny chunks, one per user.') : fb(bi('Loki сжимает строки и складывает их кусками в хранилище, где за сутки набирается около {mb}.', 'Loki compresses the lines and stores them in chunks, where about {mb} MB pile up a day.'), { mb: volume(n.mbDay) }) },
        states: { chunks: p.userLabel ? 'warn' : 'on' },
        fill: { chunks: Math.min(1, p.rate / 2000) },
        metrics: m,
      },
      {
        id: 'select',
        label: bi('селектор', 'selector'),
        caption: bi('Теперь вы ищете эту строку. Запрос LogQL начинается с селектора `{app="api"}`, и Loki находит нужные потоки по индексу меток, не открывая ни одного куска. Выбор потоков по индексу и есть быстрая часть запроса.', 'Now you look for this line. The LogQL query starts with the selector {app="api"}, and Loki finds the right streams through the label index without opening a single chunk. This is the fast part of the query.'),
        focus: ['query', 'e-select'],
        reveal: ['query', 'e-select'],
        tokens: [{ edge: 'e-select', label: '{app="api"}' }],
        say: { query: bi('Запрос выбирает по индексу потоки с меткой app="api".', 'The query selects the streams labelled app="api" through the index.') },
        states: { index: p.userLabel ? 'warn' : 'ok' },
        metrics: m,
      },
      {
        id: 'scan',
        label: bi('фильтр', 'filter'),
        caption: json
          ? bi('Дальше Loki перебирает строки выбранных потоков. Шаг `| json` разбирает каждую строку на поля, а шаг `| status >= 500` сравнивает код ответа как число. Запрос находит все ответы с ошибкой, и только их, как бы ни менялся текст сообщения.', 'Next Loki scans the lines of the selected streams. The | json step parses every line into fields, and the | status >= 500 compares the status as a number. Every error answer is found, and only those, however the message text changes.')
          : bi('Дальше Loki перебирает строки выбранных потоков. Поля status в свободном тексте нет, поэтому код приходится выискивать регулярным выражением |~ "ERROR .* \\(5\\d\\d\\)". Стоит разработчику поменять текст сообщения, и запрос перестанет находить ошибки, а никто об этом не узнает.', 'Next Loki scans the lines of the selected streams. Free text has no status field, so the code has to be fished out with the regular expression |~ "ERROR .* \\(5\\d\\d\\)". If a developer changes the message text, the query stops finding errors without a word.'),
        focus: ['query', 'e-scan'],
        reveal: ['e-scan'],
        tokens: [{ edge: 'e-scan', label: json ? '| json | status >= 500' : '|~ "ERROR …(5\\d\\d)"' }],
        say: { query: json ? bi('Запрос разбирает строки на поля и оставляет те, где status не меньше 500.', 'The query parses lines into fields and keeps those where status is at least 500.') : bi('Запрос ищет код ответа в тексте регулярным выражением и надеется, что формат не менялся.', 'The query looks for the status in the text with a regular expression and hopes the format has not changed.') },
        states: { chunks: json ? 'ok' : 'warn' },
        metrics: m,
      },
      {
        id: 'show',
        label: 'Grafana',
        caption: bi('Grafana показывает найденные строки и над ними график их числа во времени. По графику видно, когда ошибки начались, а по строкам видно, что написал сервис.', 'Grafana shows the lines found and above them a graph of their count over time. The graph shows when the errors started, and the lines show what exactly the service wrote.'),
        focus: ['e-show', 'grafana'],
        reveal: ['grafana', 'e-show'],
        tokens: [{ edge: 'e-show', label: bi('200 строк', '200 lines') }],
        say: { grafana: bi('Grafana показывает найденные строки и график их числа во времени.', 'Grafana draws the lines found and a graph of their count over time.') },
        states: { grafana: 'ok', query: 'ok' },
        metrics: m,
      },
    );
    return steps;
  },
  explainDelta(prev, next, change): Bi {
    if (change.kind === 'break')
      return change.on
        ? bi('Loki не принимает строки. Агент придерживает их и повторяет отправку, и пока он помнит своё место в файле, ничего не пропадает.', 'Loki accepts no lines. The agent holds them back and retries, and as long as it remembers its place in the file, nothing is lost.')
        : bi('Loki снова принимает строки, и агент отправляет всё, что накопил.', 'Loki accepts lines again, and the agent sends everything it has saved up.');
    if (change.id === 'userLabel')
      return fb(bi('Потоков в индексе стало {b} вместо {a}. Метка нужна для того, по чему выбирают группу строк, а номер пользователя ищут фильтром по содержимому строки.', 'The index now has {b} streams instead of {a}. A label is for what you select a group of lines by, and a user number is found with a filter on the line content.'), { a: last(prev).streams ?? 0, b: last(next).streams ?? 0 });
    if (change.id === 'format')
      return next.find((s) => s.id === 'scan')?.states?.chunks === 'ok'
        ? bi('Строка снова записана с именованными полями, поэтому запрос берёт код ответа по имени и не зависит от порядка слов.', 'The line has named fields again: the query takes the status by name and does not depend on word order.')
        : bi('Строка стала свободным текстом, поэтому запрос ищет код регулярным выражением и сломается от любой правки текста сообщения.', 'The line became free text: the query looks for the code with a regular expression and breaks at any edit of the message text.');
    return fb(bi('За сутки теперь набирается {b} МБ строк вместо {a}. Хранить их дёшево, но каждый запрос с фильтром по тексту перебирает их все.', 'Now {b} MB of lines pile up per day instead of {a}. They are cheap to keep, but every query with a text filter scans them all.'), { a: last(prev).mbDay ?? 0, b: last(next).mbDay ?? 0 });
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

const TRACE_ALL = ['front', 'api', 'db', 'logs', 'coll', 'tempo', 'e-call', 'e-sql', 'e-log', 'e-otlp-f', 'e-otlp-a', 'e-export'];

export const traceModel = defineModel<TraceP>({
  id: 'obs.trace-path',
  block: 'monitoring',
  title: bi('Как из операций трёх сервисов складывается один трейс', 'How the operations of three services add up to one trace'),
  summary: bi(
    'Заказ в магазине проходит через три участника: frontend, api и базу данных. Схема показывает, как каждый сервис записывает свои операции в виде спанов, как заголовок traceparent связывает их в один трейс и как Collector отбирает трейсы для хранения. Под схемой растёт водопад: полоска на каждую операцию, как в Grafana Tempo или Jaeger.',
    'An order in the shop passes through three participants: frontend, api and the database. The diagram shows how each service records its operations, the spans, how the traceparent header ties them into one trace and how the Collector picks traces to keep. Under the diagram a waterfall grows: a bar for every operation, as in Grafana Tempo or Jaeger.',
  ),
  intro: bi(
    'Схема соберётся по шагам, и сейчас на ней есть только frontend. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко у подсвеченного участника говорит, что он делает, карточка на линии показывает, что он передаёт дальше, а водопад под схемой показывает, сколько миллисекунд заняла каждая операция.\n\nКогда пройдёте заказ до хранилища трейсов, увеличьте в «Параметрах» число запросов к базе до 12 и посмотрите, как изменится водопад. Потом включите поломку, при которой api не читает заголовок traceparent.',
    'The diagram builds itself step by step, and now it shows only frontend. Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout at the highlighted participant says what it does, the card on the line shows what it hands on, and the waterfall under the diagram shows how many milliseconds each operation took.\n\nOnce the order has reached the trace store, raise the number of database queries to 12 in “Parameters” and see how the waterfall changes. Then switch on the break in which api does not read the traceparent header.',
  ),
  legend: [
    { mark: 'active', text: bi('участник, который работает сейчас', 'the participant working now') },
    { mark: 'say', text: bi('что он делает', 'what it does') },
    { mark: 'token', text: bi('то, что участник передаёт дальше, например заголовок, запрос или спаны', 'what the participant hands on, such as a header, a query or spans') },
    { mark: 'icon:server', text: bi('сервис магазина', 'a shop service') },
    { mark: 'icon:database', text: bi('база данных', 'the database') },
    { mark: 'icon:file', text: bi('журнал сервиса api', 'the api service log') },
    { mark: 'icon:process', text: bi('OpenTelemetry Collector', 'the OpenTelemetry Collector') },
    { mark: 'icon:disk', text: bi('хранилище трейсов', 'the trace store') },
    { mark: 'dashed', text: bi('связь через trace_id, а не вызов', 'a link through the trace_id, not a call') },
    { mark: 'warn', text: bi('операция заметно затянулась или трейс распался', 'an operation dragged on, or the trace fell apart') },
    { mark: 'err', text: bi('на этом участнике трейс оборвался', 'the trace broke at this participant') },
    { mark: 'ok', text: bi('этап пройден', 'stage passed') },
  ],
  stopLabel: bi('Трейс оборвался', 'The trace broke'),
  concepts: ['obs.trace', 'obs.span', 'obs.context-propagation', 'obs.sampling'],
  waterfall: 'ms',
  diagram: {
    width: 960,
    height: 448,
    nodes: [
      { id: 'front', label: 'frontend', icon: 'server', sub: 'POST /checkout', family: 'l7', x: 24, y: 40, w: 184, h: 64, card: card(bi('Сервис frontend стоит первым на пути заказа и начинает трейс. Он создаёт случайный trace_id и открывает первый, корневой спан, который длится, пока заказ не закончится.', 'The frontend service is the first on the order’s path and starts the trace. It creates a random trace_id and opens the first, root span, which lasts until the order is finished.'), bi('Спаны frontend записывает библиотека OpenTelemetry, подключённая к его коду.', 'The OpenTelemetry library plugged into the frontend code records its spans.'), undefined, { url: 'https://opentelemetry.io/docs/concepts/signals/traces/', label: 'opentelemetry.io › Traces' }) },
      { id: 'api', label: 'api', icon: 'server', sub: 'POST /checkout', family: 'cp', x: 370, y: 40, w: 220, h: 64, card: card(bi('Сервис api оформляет заказ. Он читает заголовок traceparent из входящего запроса и открывает свой спан, дочерний к спану frontend. Внутри него появляются спаны ожидания соединения с базой (db.pool.acquire) и запросов к базе.', 'The api service places the order. It reads the traceparent header of the incoming request and opens its own span, a child of the frontend span. Inside it appear the spans of waiting for a database connection (db.pool.acquire) and of the database queries.'), bi('Спаны api записывает библиотека OpenTelemetry, подключённая к его HTTP-серверу и драйверу базы.', 'The OpenTelemetry library plugged into its HTTP server and database driver records the api spans.')) },
      { id: 'db', label: 'postgres', icon: 'database', sub: 'SELECT products ×1', family: 'store', x: 736, y: 40, w: 200, h: 64, card: card(bi('postgres служит базой данных магазина. Спаны запросов к ней пишет драйвер базы внутри api, а сама база о трейсах обычно ничего не знает. У api есть пул из 20 соединений с базой на все заказы сразу.', 'postgres is the shop database. The spans of queries to it are written by the database driver inside api; the database itself usually knows nothing about traces. api has a pool of 20 database connections shared by all orders at once.'), bi('Базу обслуживает администратор баз данных.', 'The database administrator looks after it.')) },
      { id: 'logs', label: bi('Журнал api', 'The api log'), icon: 'file', sub: 'trace_id=4bf92f…', family: 'neutral', x: 736, y: 200, w: 200, h: 64, card: card(bi('Если сервис пишет trace_id в каждую строку журнала, от строки можно перейти к трейсу её запроса и обратно.', 'If a service writes the trace_id into every log line, you can jump from a line to the trace of its request and back.'), bi('trace_id в строку добавляет библиотека журналирования, которая берёт его из текущего контекста запроса.', 'The logging library adds the trace_id to the line, taking it from the current request context.')) },
      { id: 'coll', label: 'OTel Collector', icon: 'process', sub: 'OTLP', family: 'process', x: 24, y: 200, w: 184, h: 64, card: card(bi('OpenTelemetry Collector работает посредником между сервисами и хранилищем. Он принимает спаны всех сервисов по протоколу OTLP, собирает из них трейсы по trace_id, отбирает часть трейсов для хранения и отправляет их дальше.', 'The OpenTelemetry Collector works as a go-between for the services and the store. It receives the spans of all services over OTLP, assembles traces from them by trace_id, picks a share of the traces to keep and sends them on.'), bi('Collector настраивает команда эксплуатации в файле collector.yaml.', 'The operations team configures the Collector in collector.yaml.'), undefined, { url: 'https://opentelemetry.io/docs/collector/', label: 'opentelemetry.io › Collector' }) },
      { id: 'tempo', label: bi('Хранилище трейсов', 'Trace store'), icon: 'disk', sub: 'Tempo', family: 'store', shape: 'buffer', x: 24, y: 360, w: 184, h: 64, card: card(bi('Хранилище держит трейсы по trace_id. В нём ищут трейсы по сервису, маршруту и длительности и смотрят их водопадом.', 'The store keeps traces by trace_id. You search it by service, route and duration and look at traces as a waterfall.'), bi('Хранилищем служит Grafana Tempo, Jaeger или облачный сервис.', 'It is Grafana Tempo, Jaeger or a cloud service.')) },
    ],
    edges: [
      { id: 'e-call', from: 'front', to: 'api', label: 'traceparent', card: card(bi('Заголовок W3C Trace Context, например `traceparent: 00-4bf92f…-00f067…-01`. В нём записаны версия, trace_id, span_id вызывающего спана и флаг, что трейс записывается. По нему api понимает, что его работа входит в тот же трейс.', 'The W3C Trace Context header, for example `traceparent: 00-4bf92f…-00f067…-01`. It holds the version, the trace_id, the span_id of the calling span and a flag saying the trace is being recorded. From it api understands that its work is part of the same trace.'), bi('Заголовок добавляет к вызову HTTP-клиент frontend, к которому подключена библиотека OpenTelemetry.', 'The frontend HTTP client with the OpenTelemetry library plugged in adds the header to the call.'), 'curl -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" http://api/checkout', { url: 'https://www.w3.org/TR/trace-context/', label: 'w3.org › Trace Context' }) },
      { id: 'e-sql', from: 'api', to: 'db', label: 'SQL', card: card(bi('Каждый запрос к базе становится отдельным дочерним спаном api со временем выполнения и текстом запроса.', 'Every database query becomes a separate child span of api with its time and query text.'), bi('Спан записывает драйвер базы внутри api.', 'The database driver in api writes the span.')) },
      { id: 'e-log', from: 'api', to: 'logs', dashed: true, label: 'trace_id', labelAt: 0.55, card: card(bi('Строка журнала помнит, к какому трейсу она относится. Пунктир здесь означает не вызов, а общую метку.', 'A log line remembers which trace it belongs to. This is not a call but a shared mark.'), bi('Метку ставит библиотека журналирования api.', 'The api logging library sets the mark.')) },
      { id: 'e-otlp-f', from: 'front', to: 'coll', label: 'OTLP', labelAt: 0.45, card: card(bi('Спаны уходят в Collector пачками по протоколу OTLP, отдельно от самого заказа и уже после ответа пользователю.', 'Spans go to the Collector in batches over OTLP, separately from the order itself and after the user has been answered.'), bi('Спаны отправляет библиотека OpenTelemetry внутри frontend.', 'The OpenTelemetry library in frontend sends them.')) },
      { id: 'e-otlp-a', from: 'api', to: 'coll', label: 'OTLP', labelAt: 0.45, card: card(bi('Спаны api уходят в Collector тем же путём.', 'The api spans go to the Collector the same way.'), bi('Спаны отправляет библиотека OpenTelemetry внутри api.', 'The OpenTelemetry library in api sends them.')) },
      { id: 'e-export', from: 'coll', to: 'tempo', label: bi('отобранные трейсы', 'kept traces'), card: card(bi('В хранилище доходят только трейсы, которые прошли отбор.', 'Only the traces that passed the selection reach the store.'), bi('Трейсы отправляет Collector.', 'The Collector sends them.')) },
    ],
  },
  params: [
    {
      id: 'queries',
      group: bi('Что делает новая версия api', 'What the new api version does'),
      label: bi('Сколько запросов к базе api делает на один заказ', 'How many database queries api makes per order'),
      kind: 'range',
      min: 1,
      max: 15,
      step: 1,
      default: 1,
      near: 'e-sql',
      predict: {
        prompt: bi('Вы меняете число запросов к базе на один заказ. В пуле 20 соединений на все заказы, которые идут одновременно. Появится ли на водопаде долгое ожидание соединения (спан db.pool.acquire)?', 'You change the number of database queries per order. The pool has 20 connections for all orders running at once. Will the waterfall show a long wait for a connection (the db.pool.acquire span)?'),
        options: [
          { id: 'db', text: bi('Да, потому что каждый заказ держит соединение дольше, соединений не хватает, и заказы ждут в очереди', 'Yes: every order holds a connection longer, connections run short and orders queue up') },
          { id: 'front', text: bi('Нет, соединение выдаётся сразу, и вырастет только лесенка запросов SELECT', 'No: a connection is handed out at once, only the staircase of SELECT queries grows') },
        ],
        resolve: (_p, n) => (n.some((s) => s.id === 'pool' && s.states?.api === 'warn') ? 'db' : 'front'),
      },
    },
    { id: 'dbMs', group: bi('Что делает новая версия api', 'What the new api version does'), label: bi('Сколько миллисекунд длится один запрос к базе', 'How many milliseconds one database query takes'), kind: 'range', min: 1, max: 100, step: 1, default: 8, near: 'db' },
    {
      id: 'sampling',
      group: bi('Какие трейсы сохраняет Collector', 'Which traces the Collector keeps'),
      label: bi('Какие трейсы Collector оставляет для хранения', 'Which traces the Collector keeps for storage'),
      kind: 'choice',
      default: '100',
      options: [
        { id: '100', label: bi('все трейсы', 'every trace') },
        { id: '10', label: bi('каждый десятый, решение принимается в начале запроса', 'one in ten, decided at the start') },
        { id: 'errors', label: bi('ошибки и медленные, решение принимается после конца запроса', 'errors and slow ones, decided after the end') },
      ],
      near: 'coll',
    },
  ],
  breaks: [
    {
      id: 'no-propagation',
      label: bi('api не читает заголовок traceparent, потому что библиотеку забыли подключить к HTTP-серверу', 'api does not read traceparent: the library was not plugged into its HTTP server'),
      remove: ['e-call'],
      boundary: 'network',
      predict: {
        prompt: bi('В api забыли подключить библиотеку OpenTelemetry к HTTP-серверу, и он не читает заголовок traceparent. Всё остальное работает. Сколько трейсов окажется в хранилище на один заказ?', 'In api the OpenTelemetry library was not plugged into the HTTP server, so it does not read the traceparent header. Everything else works. How many traces end up in the store per order?'),
        options: [
          { id: 'two', text: bi('Получится два несвязанных трейса, отдельно у frontend и у api', 'There will be two unrelated traces, one for frontend and a separate one for api') },
          { id: 'one', text: bi('Получится один трейс, только без спанов api', 'There will be one trace, just without the api spans') },
        ],
        resolve: (_p, n) => ((last(n).traces ?? 1) === 2 ? 'two' : 'one'),
      },
    },
    {
      id: 'collector-down',
      label: bi('Collector недоступен', 'The Collector is down'),
      remove: ['e-export'],
      boundary: 'process',
      predict: {
        prompt: bi('Collector недоступен, а сервисы продолжают принимать заказы. Что станет с заказами и со спанами?', 'The Collector is down while the services keep taking orders. What happens to the orders and to the spans?'),
        options: [
          { id: 'fine', text: bi('Заказы проходят как раньше, а спаны пропадают', 'Orders go through as before, and the spans are lost') },
          { id: 'slow', text: bi('Заказы начнут ждать, пока спаны удастся отправить', 'Orders start waiting until the spans can be sent') },
        ],
        resolve: (_p, n) => (n.some((s) => s.broken?.at === 'coll') ? 'fine' : 'slow'),
      },
    },
  ],
  metrics: [
    { id: 'ms', label: bi('сколько длился заказ', 'how long the order took'), unit: 'ms' },
    { id: 'kept', label: bi('трейсов из 1000 сохранено', 'traces kept out of 1000') },
    { id: 'traces', label: bi('трейсов на один заказ', 'traces per order') },
  ],
  run(p, broken) {
    const n = traceNumbers(p, broken);
    const split = broken.has('no-propagation');
    let ms = 0;
    const m = () => ({ ms, kept: n.kept, traces: n.traces });
    const steps: Step[] = [];
    ms = 2;
    steps.push({
      id: 'root',
      label: 'frontend',
      caption: bi('Пользователь нажимает «Оформить заказ», и запрос POST /checkout приходит во frontend. Библиотека OpenTelemetry во frontend создаёт случайный идентификатор трейса `4bf92f…` и открывает первый спан, корневой. Он будет длиться, пока заказ не закончится.', 'The user presses “Place order”, and the POST /checkout request reaches frontend. The OpenTelemetry library in frontend creates a random trace ID 4bf92f… and opens the first, root span. It will last until the order is finished.'),
      focus: ['front'],
      say: { front: bi('frontend получает заказ, создаёт trace_id `4bf92f…` и открывает корневой спан.', 'frontend gets the order, creates the trace_id 4bf92f… and opens the root span.') },
      states: hide(TRACE_ALL, 'front'),
      values: { front: 'trace 4bf92f…' },
      metrics: m(),
    });
    ms += 3;
    steps.push({
      id: 'call',
      label: 'traceparent',
      caption: split
        ? bi('frontend вызывает api и передаёт заголовок traceparent, но api его не читает, потому что библиотеку забыли подключить к его HTTP-серверу. Поэтому api считает, что запрос пришёл ниоткуда, и начинает собственный трейс с новым идентификатором `9d1e07…`.', 'frontend calls api and passes the traceparent header, but api does not read it, because the library was not plugged into its HTTP server. So api thinks the request came from nowhere and starts its own trace with a new ID 9d1e07….')
        : bi('frontend вызывает api и добавляет к запросу заголовок traceparent, в котором записаны тот же trace_id и номер своего спана. api читает заголовок, оставляет trace_id прежним и записывает спан frontend родителем своего спана. Так операции двух сервисов попадают в один трейс.', 'frontend calls api and adds the traceparent header to the request, which holds the same trace_id and the number of its own span. api reads the header, keeps the trace_id and records the frontend span as the parent of its own. That is how the operations of two services end up in one trace.'),
      focus: ['e-call', 'api'],
      reveal: ['api', 'e-call'],
      tokens: [{ edge: 'e-call', label: '00-4bf92f…-01' }],
      say: { api: split ? bi('api не читает заголовок и начинает свой трейс `9d1e07…`.', 'api does not read the header and starts its own trace 9d1e07….') : bi('api читает traceparent и продолжает трейс `4bf92f…` своим спаном.', 'api reads traceparent and continues trace 4bf92f… with its own span.') },
      states: { api: split ? 'warn' : 'on', 'e-call': split ? 'err' : 'on' },
      values: { api: split ? 'trace 9d1e07… (new)' : 'trace 4bf92f…' },
      metrics: m(),
    });
    const wait = p.queries > 8 ? (p.queries - 8) * 60 : 1;
    ms += wait;
    steps.push({
      id: 'pool',
      label: 'db.pool.acquire',
      caption: wait > 1
        ? fb(bi('Чтобы обратиться к базе, api берёт соединение из пула. Но каждый заказ теперь делает {q} запросов и держит соединение дольше, и все 20 соединений пула заняты другими заказами. Спан db.pool.acquire ждёт свободного соединения {w} мс, и на водопаде это самая длинная полоска.', 'To go to the database, api takes a connection from the pool. But every order now makes {q} queries and holds its connection longer, and all 20 pool connections are busy with other orders. The db.pool.acquire span waits {w} ms for a free connection, and on the waterfall it is the longest bar.'), { q: p.queries, w: wait })
        : bi('Чтобы обратиться к базе, api берёт соединение из пула. Свободные соединения есть, и спан db.pool.acquire длится меньше миллисекунды.', 'To go to the database, api takes a connection from the pool. There are free connections, and the db.pool.acquire span takes less than a millisecond.'),
      focus: ['api'],
      say: { api: wait > 1 ? fb(bi('api ждёт свободное соединение с базой уже {w} мс.', 'api has been waiting {w} ms for a free database connection.'), { w: wait }) : bi('api сразу получает свободное соединение из пула.', 'api gets a free connection from the pool at once.') },
      states: { api: wait > 1 ? 'warn' : 'on' },
      values: { api: wait > 1 ? `pool wait ${wait} ms` : 'pool: free' },
      metrics: m(),
    });
    ms += p.queries * p.dbMs;
    steps.push({
      id: 'sql',
      label: `SELECT ×${p.queries}`,
      caption: p.queries > 1
        ? fb(bi('api отправляет в базу {q} одинаковых запросов SELECT products, по одному на каждый товар корзины, и каждый длится {d} мс. На водопаде они выстраиваются лесенкой из коротких полосок, а вместе занимают {t} мс. Так выглядит ошибка, когда программа забыла объединить запросы в один.', 'api sends {q} identical SELECT products queries to the database, one per cart item, each taking {d} ms. On the waterfall they line up as a staircase of short bars and together take {t} ms. That is what it looks like when a program forgot to merge the queries into one.'), { q: p.queries, d: p.dbMs, t: p.queries * p.dbMs })
        : fb(bi('api отправляет в базу один запрос, который сразу достаёт все товары корзины. Он длится {d} мс.', 'api sends the database one query that fetches every cart item at once. It takes {d} ms.'), { d: p.dbMs }),
      focus: ['e-sql', 'db'],
      reveal: ['db', 'e-sql'],
      tokens: [{ edge: 'e-sql', label: `SELECT products ×${p.queries}` }],
      say: { db: p.queries > 1 ? fb(bi('База выполняет {q} одинаковых запросов, по {d} мс каждый.', 'The database runs {q} identical queries, {d} ms each.'), { q: p.queries, d: p.dbMs }) : fb(bi('База выполняет один запрос за {d} мс.', 'The database runs one query in {d} ms.'), { d: p.dbMs }) },
      states: { db: p.queries > 8 ? 'warn' : 'ok' },
      values: { db: `SELECT products ×${p.queries}` },
      metrics: m(),
    });
    steps.push({
      id: 'log',
      label: bi('журнал', 'log'),
      caption: split
        ? bi('api пишет строку о заказе в журнал и ставит в неё свой trace_id, `9d1e07…`. От этой строки можно перейти только к трейсу api, а к трейсу frontend она уже не приведёт.', 'api writes a line about the order into its log with its own trace_id, 9d1e07…. From this line you can reach only the api trace; it no longer leads to the frontend trace.')
        : bi('api пишет строку о заказе в журнал и ставит в неё тот же trace_id `4bf92f…`. Поэтому, найдя в журнале строку с ошибкой, можно открыть трейс этого самого запроса, и наоборот.', 'api writes a line about the order into its log with the same trace_id 4bf92f…. So once you find an error line in the log, you can open the trace of that very request, and the other way round.'),
      focus: ['e-log', 'logs'],
      reveal: ['logs', 'e-log'],
      tokens: [{ edge: 'e-log', label: split ? 'trace_id=9d1e07…' : 'trace_id=4bf92f…' }],
      say: { logs: split ? bi('Строка журнала получает trace_id `9d1e07…`, новый трейс api.', 'The log line gets trace_id 9d1e07…, the new api trace.') : bi('Строка журнала api получает тот же trace_id `4bf92f…`.', 'The api log line gets the same trace_id 4bf92f….') },
      values: { logs: split ? 'trace_id=9d1e07…' : 'trace_id=4bf92f…' },
      metrics: m(),
    });
    ms += 6;
    steps.push({
      id: 'reply',
      label: bi('ответ', 'reply'),
      caption: fb(bi('api отвечает frontend, а frontend отвечает пользователю и закрывает корневой спан. Весь заказ занял {t} мс, и столько же дают вместе все полоски водопада под схемой.', 'api answers frontend, and frontend answers the user and closes the root span. The whole order took {t} ms: the sum of all the bars of the waterfall under the diagram.'), { t: ms }),
      focus: ['front', 'e-call'],
      tokens: [{ edge: 'e-call', reverse: true, label: '200 OK' }],
      say: { front: fb(bi('frontend получает ответ и закрывает корневой спан, а весь заказ занял {t} мс.', 'frontend gets the answer and closes the root span: the order took {t} ms.'), { t: ms }) },
      states: { front: 'ok', api: split ? 'warn' : 'ok' },
      metrics: m(),
    });
    if (broken.has('collector-down')) {
      steps.push({
        id: 'lost',
        label: bi('спаны пропали', 'spans lost'),
        caption: bi('Библиотека OpenTelemetry в api пытается отправить пачку спанов в Collector и получает отказ в соединении. Повторив попытку несколько раз, она выбрасывает пачку. Пользователи этого не замечают, потому что спаны отправляются отдельно от заказа и уже после ответа.', 'The OpenTelemetry library in api tries to send a batch of spans to the Collector and gets connection refused. After a few retries it drops the batch. Users notice nothing, because spans are sent separately from the order and after the answer.'),
        focus: ['api', 'e-otlp-a'],
        reveal: ['coll', 'e-otlp-f', 'e-otlp-a'],
        tokens: [{ edge: 'e-otlp-a', label: fb(bi('{s} спанов', '{s} spans'), { s: p.queries + 2 }) }],
        say: { api: bi('api не может отправить спаны в Collector и после нескольких попыток выбрасывает их.', 'api cannot send its spans to the Collector and drops them after a few attempts.') },
        states: { coll: 'err', 'e-otlp-a': 'err', 'e-otlp-f': 'err' },
        metrics: m(),
        broken: {
          at: 'coll',
          message: 'traces export: context deadline exceeded: rpc error: code = Unavailable desc = connection refused',
          caption: bi('на отправке спанов в Collector. Трейсы нужны для разбора и не участвуют в обработке заказа, поэтому сервис продолжает работать, а вы остаётесь без водопада. Узнают такую поломку по растущему счётчику выброшенных спанов в метриках самой библиотеки OpenTelemetry и Collector.', 'at sending spans to the Collector. Traces serve investigation and take no part in handling the order, so the service keeps working and you are left without a waterfall. You recognise this break by the growing counter of dropped spans in the metrics of the OpenTelemetry library and of the Collector.'),
        },
      });
      return steps;
    }
    steps.push({
      id: 'ship',
      label: 'OTLP',
      caption: split
        ? bi('Оба сервиса отправляют свои спаны в Collector по протоколу OTLP. Collector собирает спаны в трейсы по trace_id, но идентификаторы у frontend и api теперь разные, поэтому из одного заказа получаются два трейса.', 'Both services send their spans to the Collector over OTLP. The Collector assembles spans into traces by trace_id, but frontend and api now have different IDs, so one order turns into two traces.')
        : bi('Оба сервиса уже после ответа пользователю отправляют свои спаны в Collector по протоколу OTLP. Collector собирает спаны с одинаковым trace_id в один трейс.', 'After the user has been answered, both services send their spans to the Collector over OTLP. The Collector assembles the spans with the same trace_id into one trace.'),
      focus: ['coll', 'e-otlp-f', 'e-otlp-a'],
      reveal: ['coll', 'e-otlp-f', 'e-otlp-a'],
      tokens: [
        { edge: 'e-otlp-f', label: bi('1 спан', '1 span') },
        { edge: 'e-otlp-a', label: fb(bi('{s} спанов', '{s} spans'), { s: p.queries + 2 }) },
      ],
      say: { coll: split ? bi('Collector собирает спаны по trace_id и получает два разных трейса.', 'The Collector assembles spans by trace_id and gets two different traces.') : bi('Collector собирает спаны с trace_id `4bf92f…` в один трейс.', 'The Collector assembles the spans with trace_id 4bf92f… into one trace.') },
      metrics: m(),
    });
    steps.push({
      id: 'sample',
      label: bi('отбор', 'sampling'),
      caption:
        p.sampling === '100'
          ? bi('Collector сохраняет каждый трейс. В хранилище видно всё, но хранить трейс на каждый заказ дорого, и на нагруженном сервисе так почти не делают.', 'The Collector keeps every trace. Everything is visible, but keeping a trace of every order is expensive, and on a busy service this is rarely done.')
          : p.sampling === '10'
            ? bi('Ещё в начале запроса библиотека решила записывать каждый десятый трейс. В тот момент никто не знал, будет ли заказ медленным, поэтому девять из десяти медленных заказов останутся без трейса.', 'At the very start of the request the library decided to record every tenth trace. At that moment nobody knew whether the order would be slow, so nine out of ten slow orders are left without a trace.')
            : fb(bi('Collector дожидается конца трейса и только потом решает, что сохранить. Он оставляет все ошибки и все медленные заказы, а из обычных почти ничего. Из 1000 трейсов в хранилище попадает {k}, и это как раз те, что нужны для разбора.', 'The Collector waits for the trace to end and only then decides what to keep. It keeps every error and every slow order, and almost none of the ordinary ones. Out of 1000 traces {k} reach the store, and they are just the ones an investigation needs.'), { k: n.kept }),
      focus: ['coll', 'e-export'],
      reveal: ['tempo', 'e-export'],
      tokens: [{ edge: 'e-export', label: fb(bi('{k} из 1000', '{k} of 1000'), { k: n.kept }) }],
      say: { coll: p.sampling === '100' ? bi('Collector сохраняет все трейсы подряд.', 'The Collector keeps every trace.') : p.sampling === '10' ? bi('Collector сохраняет каждый десятый трейс, как решила библиотека в начале запроса.', 'The Collector keeps every tenth trace, as the library decided at the start of the request.') : bi('Collector ждёт конца трейса и оставляет только ошибки и медленные заказы.', 'The Collector waits for the trace to end and keeps only errors and slow orders.') },
      states: { coll: 'ok', tempo: split ? 'warn' : 'ok' },
      values: { tempo: split ? '2 traces / order' : '1 trace / order' },
      metrics: m(),
    });
    if (split)
      steps.push({
        id: 'split',
        label: bi('два трейса', 'two traces'),
        caption: bi('В хранилище лежат два трейса одного заказа: короткий трейс frontend без единой операции внутри и отдельный трейс api. Водопада, который показывал бы заказ целиком, больше нет, и понять, где ушло время, по трейсу frontend нельзя.', 'The store holds two traces of one order: a short frontend trace with no operations inside and a separate api trace. There is no waterfall showing the whole order any more, and the frontend trace cannot tell you where the time went.'),
        focus: ['tempo'],
        say: { tempo: bi('В хранилище лежат два трейса одного заказа: `4bf92f…` от frontend и `9d1e07…` от api.', 'The store holds two traces of one order: 4bf92f… from frontend and 9d1e07… from api.') },
        states: { tempo: 'err' },
        metrics: m(),
        broken: {
          at: 'e-call',
          message: `trace 4bf92f…: 1 span (frontend) · trace 9d1e07…: ${p.queries + 2} spans (api)`,
          caption: bi('на передаче заголовка traceparent от frontend к api. Узнают такую поломку по трейсам, в которых корневой спан есть, а дочерних нет. Связь сервисов держится на одном заголовке, и каждый сервис на пути должен его читать и передавать дальше.', 'at passing the traceparent header from frontend to api. You recognise this break by traces that have a root span and no children. The link between services hangs on one header, and every service on the path must read it and pass it on.'),
        },
      });
    return steps;
  },
  explainDelta(prev, next, change): Bi {
    if (change.kind === 'break') {
      if (change.id === 'no-propagation')
        return change.on
          ? bi('api перестал читать traceparent, и каждый сервис теперь начинает свой трейс, так что на один заказ приходится два трейса.', 'api stopped reading traceparent, and each service now starts its own trace, so there are two traces per order.')
          : bi('api снова читает traceparent, и заказ снова укладывается в один трейс.', 'api reads traceparent again, and the order fits into one trace again.');
      return change.on
        ? bi('Collector недоступен, поэтому спаны пропадают, а заказы проходят как раньше.', 'The Collector is down, so spans are lost, while orders go through as before.')
        : bi('Collector снова принимает спаны.', 'The Collector accepts spans again.');
    }
    if (change.id === 'sampling') return fb(bi('Из 1000 трейсов теперь сохраняется {b} вместо {a}.', 'Out of 1000 traces, {b} are kept now instead of {a}.'), { a: last(prev).kept ?? 0, b: last(next).kept ?? 0 });
    return fb(bi('Заказ теперь длится {b} мс вместо {a} мс. Посмотрите на водопад, чтобы увидеть, какая полоска выросла.', 'The order now takes {b} ms instead of {a} ms. Look at the waterfall to see which bar grew.'), { a: last(prev).ms ?? 0, b: last(next).ms ?? 0 });
  },
});

// ── Where container metrics come from ──

type CgP = { memLimit: number; memUse: number; cpuLimit: string; cpuNeed: number };

export function cgNumbers(p: CgP): { ratio: number; throttle: number; oom: boolean; usage: number } {
  const lim = Number(p.cpuLimit) / 1000;
  const throttle = p.cpuNeed > lim ? Math.min(0.95, (p.cpuNeed - lim) / p.cpuNeed + 0.05) : p.cpuNeed > lim * 0.9 ? 0.05 : 0;
  return { ratio: Math.min(1, p.memUse / p.memLimit), throttle: Math.round(throttle * 100) / 100, oom: p.memUse > p.memLimit, usage: Math.min(p.cpuNeed, lim) };
}

const CG_ALL = ['proc', 'cg', 'cad', 'spec', 'ksm', 'prom', 'answer', 'e-acct', 'e-read', 'e-watch', 'e-s1', 'e-s2', 'e-q'];

export const cgModel = defineModel<CgP>({
  id: 'obs.container-metrics',
  block: 'monitoring',
  title: bi('Откуда Prometheus знает о памяти и процессоре контейнера', 'How Prometheus knows about a container’s memory and CPU'),
  summary: bi(
    'Под api перезапускается раз в двадцать минут, а worker разбирает очередь всё медленнее. Схема показывает два источника, из которых Prometheus узнаёт об этом. Сколько контейнер потребляет, считает ядро в файлах cgroup, а читает их cAdvisor внутри kubelet. Сколько контейнеру положено и что с ним случилось, записано в объектах API Kubernetes, а превращает эти сведения в ряды kube-state-metrics.',
    'The api pod restarts every twenty minutes, and worker processes its queue slower and slower. The diagram shows the two sources Prometheus learns this from. What a container consumes is counted by the kernel in cgroup files, which cAdvisor inside the kubelet reads. What the container is entitled to and what happened to it is written in Kubernetes API objects, which kube-state-metrics turns into series.',
  ),
  intro: bi(
    'Схема соберётся по шагам, и сейчас на ней есть только процесс api в своём поде. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко у подсвеченного участника говорит, что он делает, а карточка на линии показывает, что он передаёт дальше. Широкая полоса внизу схемы изображает ядро узла и файлы cgroup пода.\n\nКогда пройдёте до ответа запроса, увеличьте в «Параметрах» память, которая нужна процессу, так, чтобы она превысила лимит. Потом поставьте лимит процессора 200m и потребность 0,5 ядра. Напоследок включите в блоке «Сломать» остановку kube-state-metrics.',
    'The diagram builds itself step by step, and now it shows only the api process in its pod. Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout at the highlighted participant says what it does, and the card on the line shows what it hands on. The wide strip at the bottom stands for the node’s kernel and the pod’s cgroup files.\n\nOnce you reach the query answer, raise the memory the process needs above the limit in “Parameters”. Then set the CPU limit to 200m and the need to 0.5 cores. Finally, switch on stopping kube-state-metrics in “Break it”.',
  ),
  legend: [
    { mark: 'active', text: bi('участник, который работает сейчас', 'the participant working now') },
    { mark: 'say', text: bi('что он делает', 'what it does') },
    { mark: 'token', text: bi('то, что участник передаёт дальше, например значения из файлов cgroup, поля объектов или ряды', 'what the participant hands on, such as values from cgroup files, object fields or series') },
    { mark: 'icon:process', text: bi('процесс в контейнере', 'the process in the container') },
    { mark: 'icon:file', text: bi('файлы cgroup и объекты API', 'cgroup files and API objects') },
    { mark: 'icon:container', text: bi('kubelet со встроенным cAdvisor', 'the kubelet with built-in cAdvisor') },
    { mark: 'icon:database', text: bi('kube-state-metrics', 'kube-state-metrics') },
    { mark: 'icon:server', text: bi('Prometheus', 'Prometheus') },
    { mark: 'icon:terminal', text: bi('запрос PromQL', 'a PromQL query') },
    { mark: 'warn', text: bi('ресурс на пределе, то есть ядро притормаживает процесс или память подошла к лимиту', 'a resource is at its limit, that is, the kernel throttles the process or memory is near the limit') },
    { mark: 'err', text: bi('процесс завершён ядром или источник рядов пропал', 'the kernel ended the process, or a source of series is gone') },
    { mark: 'ok', text: bi('этап пройден', 'stage passed') },
  ],
  stopLabel: bi('Ряды перестали поступать', 'Series stopped arriving'),
  concepts: ['obs.cadvisor', 'obs.kube-state-metrics', 'obs.throttling'],
  diagram: {
    width: 1024,
    height: 460,
    nodes: [
      { id: 'proc', label: bi('Процесс api', 'The api process'), icon: 'process', sub: 'RSS 300 Mi', family: 'process', x: 24, y: 216, w: 184, h: 64, card: card(bi('Процесс работает в контейнере пода api. Ядро узла учитывает всю его память и всё процессорное время в cgroup этого контейнера.', 'The process runs in the api pod’s container. The node kernel accounts all its memory and all its CPU time in the cgroup of this container.'), bi('Процесс запустила среда контейнеров по спецификации пода.', 'The container runtime started it from the pod spec.'), 'kubectl top pod') },
      { id: 'cg', label: bi('Файлы cgroup пода в ядре узла', 'The pod’s cgroup files in the node kernel'), icon: 'file', sub: 'memory.max 512Mi · cpu.max 100000 100000', family: 'kernel', shape: 'bar', x: 24, y: 384, w: 976, h: 56, card: card(bi('Файлы cgroup v2 пода на узле. В memory.current ядро пишет, сколько памяти занято, в memory.max записан лимит, а в memory.events ядро отмечает, сколько раз срабатывал OOM killer. В cpu.max записана квота процессора, а в cpu.stat ядро считает, сколько прошло периодов по 100 мс и в скольких из них процесс упёрся в квоту. Это те же файлы, которые вы читали в блоке Linux.', 'The pod’s cgroup v2 files on the node. In memory.current the kernel writes how much memory is used, in memory.max the limit, in memory.events how many times the OOM killer fired. cpu.max holds the CPU quota, and cpu.stat how many 100 ms periods passed and in how many of them the process hit the quota. These are the same files you read in the Linux block.'), bi('Значения считает ядро, а лимиты в файлы записывает kubelet по спецификации пода.', 'The kernel counts the values, and the kubelet writes the limits into the files from the pod spec.'), 'cat /sys/fs/cgroup/kubepods.slice/…/memory.current', { url: 'https://docs.kernel.org/admin-guide/cgroup-v2.html', label: 'kernel.org › cgroup v2' }) },
      { id: 'cad', label: 'kubelet / cAdvisor', icon: 'container', sub: '/metrics/cadvisor', family: 'node', x: 240, y: 216, w: 184, h: 64, card: card(bi('cAdvisor встроен в kubelet. Он читает файлы cgroup всех контейнеров узла и отдаёт их значения рядами: container_memory_working_set_bytes, container_cpu_usage_seconds_total, container_cpu_cfs_throttled_periods_total.', 'cAdvisor is built into the kubelet. It reads the cgroup files of every container on the node and serves their values as series: container_memory_working_set_bytes, container_cpu_usage_seconds_total, container_cpu_cfs_throttled_periods_total.'), bi('kubelet работает на каждом узле кластера.', 'The kubelet runs on every node of the cluster.'), 'kubectl get --raw /api/v1/nodes/node-3/proxy/metrics/cadvisor') },
      { id: 'spec', label: bi('Объект пода в API', 'The pod object in the API'), icon: 'file', sub: 'limits.memory: 512Mi', family: 'obj', shape: 'doc', x: 240, y: 48, w: 184, h: 64, card: card(bi('Объекты API Kubernetes хранят и то, что вы запросили в манифесте (число реплик, requests и limits), и то, что получилось: фазу пода, число перезапусков, причину последнего завершения контейнера.', 'Kubernetes API objects keep both what you ordered (the replica count, requests and limits) and what came out: the pod phase, the restart count, the reason the container last ended.'), bi('Желаемое состояние вы описываете в манифестах, а статус заполняют контроллеры и kubelet.', 'You write the order in manifests; controllers and the kubelet fill in the status.'), 'kubectl get pod api-6f9c7d-q7rvn -o yaml') },
      { id: 'ksm', label: 'kube-state-metrics', icon: 'database', sub: 'kube_*', family: 'cp', x: 552, y: 48, w: 184, h: 64, card: card(bi('kube-state-metrics следит за объектами API и превращает их поля в ряды, например kube_pod_status_phase, kube_pod_container_status_restarts_total, kube_deployment_status_replicas_available. Сам он в кластере ничего не меняет.', 'kube-state-metrics watches API objects and turns their fields into series, such as kube_pod_status_phase, kube_pod_container_status_restarts_total, kube_deployment_status_replicas_available. It changes nothing in the cluster itself.'), bi('kube-state-metrics запускают в кластере как обычный Deployment.', 'kube-state-metrics runs in the cluster as an ordinary Deployment.'), undefined, { url: 'https://github.com/kubernetes/kube-state-metrics/tree/main/docs', label: 'kube-state-metrics › docs' }) },
      { id: 'prom', label: 'Prometheus', icon: 'server', sub: 'scrape', family: 'cp', x: 560, y: 216, w: 168, h: 64, card: card(bi('Prometheus забирает оба набора рядов: container_* у kubelet каждого узла и kube_* у kube-state-metrics. Ряды из двух источников можно соединить в одном запросе по меткам namespace, pod и container.', 'Prometheus fetches both sets of series: container_* from every node’s kubelet and kube_* from kube-state-metrics. Series from the two sources can be joined in one query by the namespace, pod and container labels.'), bi('Цели в кластере Prometheus находит сам через kubernetes_sd_configs.', 'Prometheus finds its targets in the cluster itself through kubernetes_sd_configs.')) },
      { id: 'answer', label: 'PromQL', icon: 'terminal', sub: 'memory · throttling', family: 'flow', x: 856, y: 216, w: 144, h: 64, card: card(bi('Запрос отвечает на вопрос, насколько контейнер близок к своим лимитам. Это метод USE для контейнера: использование (память и процессор к лимиту), насыщение (троттлинг) и ошибки (OOMKilled и перезапуски).', 'The answer to how close the container is to its limits. This is the USE method for a container: utilisation (memory and CPU to the limit), saturation (throttling) and errors (OOMKilled and restarts).'), bi('Запрос пишете вы в дашборде или в правиле алерта.', 'You write the query in a dashboard or an alerting rule.')) },
    ],
    edges: [
      { id: 'e-acct', from: 'proc', to: 'cg', label: bi('учёт ядра', 'kernel accounting'), via: [[116, 384]], labelAt: 0.5, card: card(bi('Каждая занятая страница памяти и каждый отрезок процессорного времени попадают в счётчики cgroup.', 'Every page of memory taken and every slice of CPU time lands in the cgroup counters.'), bi('Учёт ведёт ядро.', 'The kernel keeps the account.')) },
      { id: 'e-read', from: 'cg', to: 'cad', label: bi('чтение файлов', 'reading files'), via: [[332, 384]], labelAt: 0.5, card: card(bi('cAdvisor читает memory.current, cpu.stat и другие файлы при каждом опросе.', 'cAdvisor reads memory.current, cpu.stat and the other files at every scrape.'), bi('Файлы читает cAdvisor.', 'cAdvisor reads them.')) },
      { id: 'e-watch', from: 'spec', to: 'ksm', label: bi('изменения объектов', 'object changes'), card: card(bi('kube-state-metrics подписан на изменения объектов, как контроллер, но сам ничего не меняет.', 'kube-state-metrics subscribes to object changes like a controller, but changes nothing itself.'), bi('Подписку держит kube-state-metrics.', 'kube-state-metrics holds the subscription.')) },
      { id: 'e-s1', from: 'prom', to: 'cad', label: 'container_*', card: card(bi('Prometheus опрашивает kubelet каждого узла по адресу /metrics/cadvisor.', 'Prometheus scrapes every node’s kubelet at /metrics/cadvisor.'), bi('Опрос выполняет Prometheus.', 'Prometheus performs the scrape.')) },
      { id: 'e-s2', from: 'prom', to: 'ksm', label: 'kube_*', card: card(bi('Prometheus опрашивает kube-state-metrics, одного на весь кластер.', 'Prometheus scrapes kube-state-metrics, one for the whole cluster.'), bi('Опрос выполняет Prometheus.', 'Prometheus performs the scrape.')) },
      { id: 'e-q', from: 'prom', to: 'answer', label: bi('запрос', 'query'), card: card(bi('Ряды из двух источников соединяются по меткам namespace, pod и container.', 'Series from the two sources join by the namespace, pod and container labels.'), bi('Запрос задаёте вы.', 'You run the query.')) },
    ],
    groups: [{ id: 'pod', label: bi('под api-6f9c7d-q7rvn', 'pod api-6f9c7d-q7rvn'), around: ['proc'], family: 'ns', dash: 'dash', card: card(bi('Пунктирная рамка обозначает под. У контейнеров пода общие пространства имён и одна cgroup, внутри которой у каждого контейнера своя вложенная группа.', 'The dashed frame stands for the pod. The pod’s containers share namespaces and one cgroup, inside which each container has a nested group of its own.'), bi('Под создают kubelet и среда контейнеров.', 'The kubelet and the container runtime create the pod.')) }],
  },
  params: [
    { id: 'memLimit', group: bi('Память контейнера', 'Container memory'), label: bi('Лимит памяти контейнера (limits.memory)', 'Container memory limit (limits.memory)'), kind: 'range', min: 128, max: 1024, step: 64, unit: 'Mi', default: 512, near: 'spec' },
    {
      id: 'memUse',
      group: bi('Память контейнера', 'Container memory'),
      label: bi('Сколько памяти нужно процессу', 'How much memory the process needs'),
      kind: 'range',
      min: 64,
      max: 1200,
      step: 16,
      unit: 'Mi',
      default: 300,
      near: 'proc',
      predict: {
        prompt: bi('Вы меняете, сколько памяти нужно процессу, а лимит памяти не трогаете. Что произойдёт с новым значением?', 'You change how much memory the process needs and leave the memory limit alone. What happens with the new value?'),
        options: [
          { id: 'oom', text: bi('Ядро завершит процесс (OOMKilled), и kubelet перезапустит контейнер', 'The kernel ends the process (OOMKilled), and the kubelet restarts the container') },
          { id: 'slow', text: bi('Процесс продолжит работать, только медленнее, как при нехватке процессора', 'The process keeps running, only slower, as with too little CPU') },
          { id: 'fits', text: bi('Ничего не изменится, потому что процессу хватает лимита', 'Nothing changes, because the limit is enough for the process') },
        ],
        resolve: (_p, n) => (n.some((s) => s.id === 'oom') ? 'oom' : 'fits'),
      },
    },
    { id: 'cpuLimit', group: bi('Процессор контейнера', 'Container CPU'), label: bi('Лимит процессора контейнера (limits.cpu)', 'Container CPU limit (limits.cpu)'), kind: 'choice', default: '1000', options: [{ id: '200', label: bi('200m, пятая часть ядра', '200m, a fifth of a core') }, { id: '500', label: bi('500m, половина ядра', '500m, half a core') }, { id: '1000', label: bi('1 ядро', '1 core') }], near: 'cg' },
    {
      id: 'cpuNeed',
      group: bi('Процессор контейнера', 'Container CPU'),
      label: bi('Сколько процессорного времени нужно процессу (в ядрах)', 'How much CPU time the process needs, cores'),
      kind: 'range',
      min: 0.05,
      max: 1.5,
      step: 0.05,
      default: 0.2,
      near: 'cad',
      predict: {
        prompt: bi('Вы меняете, сколько процессорного времени нужно процессу, а лимит процессора не трогаете. Что произойдёт с новым значением?', 'You change how much CPU time the process needs and leave the CPU limit alone. What happens with the new value?'),
        options: [
          { id: 'throttle', text: bi('Ядро станет притормаживать процесс до конца каждого периода, и из-за троттлинга ответы замедлятся', 'The kernel holds the process back till the end of each period: throttling, slower answers') },
          { id: 'kill', text: bi('Ядро завершит процесс, как при нехватке памяти', 'The kernel ends the process, as with too little memory') },
          { id: 'fits', text: bi('Ничего не изменится, потому что процессу хватает лимита', 'Nothing changes, because the limit is enough for the process') },
        ],
        resolve: (_p, n) => ((last(n).throttle ?? 0) > 0.1 ? 'throttle' : 'fits'),
      },
    },
  ],
  breaks: [
    {
      id: 'ksm-down',
      label: bi('kube-state-metrics остановлен', 'kube-state-metrics is stopped'),
      remove: ['e-watch', 'e-s2'],
      boundary: 'process',
      predict: {
        prompt: bi('kube-state-metrics остановлен, а под api по-прежнему перезапускается. Что вернёт выражение increase(kube_pod_container_status_restarts_total[15m]) > 3?', 'kube-state-metrics is stopped while the api pod keeps restarting. What does increase(kube_pod_container_status_restarts_total[15m]) > 3 return?'),
        options: [
          { id: 'empty', text: bi('Выражение вернёт пустой результат, и алерт на перезапуски молча перестанет срабатывать', 'The expression returns an empty result, and the restart alert silently stops firing') },
          { id: 'zero', text: bi('Выражение вернёт нули по всем подам', 'The expression returns zeros for every pod') },
        ],
        resolve: (_p, n) => (n.some((s) => s.broken?.at === 'ksm') ? 'empty' : 'zero'),
      },
    },
  ],
  metrics: [
    { id: 'ratio', label: bi('память к лимиту', 'memory to limit') },
    { id: 'throttle', label: bi('доля периодов с троттлингом', 'share of throttled periods') },
    { id: 'restarts', label: bi('перезапусков', 'restarts') },
  ],
  run(p, broken) {
    const n = cgNumbers(p);
    const m = { ratio: Math.round(n.ratio * 100) / 100, throttle: n.throttle, restarts: n.oom ? 1 : 0 };
    const used = Math.min(p.memUse, p.memLimit);
    const lim = Number(p.cpuLimit) / 1000;
    const quota = Number(p.cpuLimit) * 100;
    const steps: Step[] = [
      {
        id: 'run',
        label: bi('процесс', 'process'),
        caption: fb(bi('Процесс api работает в контейнере своего пода. Ему нужно {u} Mi памяти и {c} процессора. Сам процесс не знает ни о лимитах, ни о том, что кто-то считает его потребление.', 'The api process runs in its pod’s container. It needs {u} Mi of memory and {c} cores of CPU. The process itself knows neither about the limits nor that anyone counts its consumption.'), { u: p.memUse, c: cores(Number(p.cpuNeed)) }),
        focus: ['proc'],
        say: { proc: fb(bi('Процесс api работает и занимает {u} Mi памяти.', 'The api process runs and takes {u} Mi of memory.'), { u: used }) },
        states: hide(CG_ALL, 'proc'),
        values: { proc: `RSS ${used} Mi` },
        metrics: m,
      },
      {
        id: 'acct',
        label: 'cgroup',
        caption: fb(bi('Ядро узла учитывает каждую страницу памяти и каждый отрезок процессорного времени процесса в cgroup его контейнера. В файле memory.current сейчас {u} Mi при лимите memory.max {l} Mi, а в cpu.max записано «{q} 100000», что означает {q} микросекунд процессора на каждые 100 000 микросекунд времени, то есть {c}.', 'The node kernel accounts every page of memory and every slice of CPU time of the process in its container’s cgroup. memory.current now says {u} Mi against the memory.max limit of {l} Mi, and cpu.max says “{q} 100000”, which means {q} microseconds of CPU for every 100,000, that is {c} cores.'), { u: used, l: p.memLimit, q: quota, c: cores(lim) }),
        focus: ['e-acct', 'cg'],
        reveal: ['cg', 'e-acct'],
        tokens: [{ edge: 'e-acct', label: bi('память и время CPU', 'memory and CPU time') }],
        say: { cg: fb(bi('Ядро записывает в memory.current {u} Mi при лимите {l} Mi.', 'The kernel writes {u} Mi into memory.current against a {l} Mi limit.'), { u: used, l: p.memLimit }) },
        states: { cg: n.ratio > 0.9 ? 'warn' : 'on' },
        values: { cg: `memory.max ${p.memLimit}Mi · cpu.max ${quota} 100000` },
        metrics: m,
      },
    ];
    if (n.oom)
      steps.push({
        id: 'oom',
        label: 'OOMKilled',
        caption: fb(bi('Процесс просит {u} Mi памяти, а лимит контейнера {l} Mi. Освободить ядру нечего, поэтому оно завершает процесс сигналом KILL и записывает в memory.events строку oom_kill 1. Kubelet видит, что контейнер завершился, и запускает его заново, а корзины пользователей, которые хранились в памяти процесса, пропадают.', 'The process asks for {u} Mi of memory, and the container limit is {l} Mi. The kernel has nothing to free, so it ends the process with the KILL signal and writes oom_kill 1 into memory.events. The kubelet sees the container has ended and starts it again, and the users’ carts kept in the process memory are gone.'), { u: p.memUse, l: p.memLimit }),
        focus: ['cg', 'proc'],
        say: { cg: fb(bi('Процесс вышел за лимит {l} Mi, и ядро завершает его (OOM kill).', 'The process went over the {l} Mi limit: the kernel ends it (OOM kill).'), { l: p.memLimit }) },
        states: { proc: 'err', cg: 'err' },
        values: { proc: 'OOMKilled · restarts 1' },
        metrics: m,
      });
    if (n.throttle > 0.1)
      steps.push({
        id: 'throttle',
        label: bi('троттлинг', 'throttling'),
        caption: fb(bi('Процессу нужно {need}, а квота контейнера равна {lim}. В каждом периоде длиной 100 мс процесс быстро расходует свою квоту и до конца периода ждёт. Так проходит {pct} % периодов. Счётчик nr_throttled в cpu.stat растёт, ответы становятся медленнее, а график потребления процессора спокойно показывает ровно {lim}.', 'The process needs {need} cores, and the container quota is {lim}. In every 100 ms period the process quickly uses up its quota and waits until the period ends. {pct} % of periods go like this. The nr_throttled counter in cpu.stat grows, answers get slower, and the CPU usage graph calmly shows exactly {lim} cores.'), { need: cores(Number(p.cpuNeed)), lim: cores(lim), pct: Math.round(n.throttle * 100) }),
        focus: ['cg'],
        say: { cg: fb(bi('Ядро притормаживает процесс, потому что в {pct} % периодов по 100 мс квота кончается раньше времени.', 'The kernel holds the process back, because in {pct} % of the 100 ms periods the quota runs out early.'), { pct: Math.round(n.throttle * 100) }) },
        states: { cg: 'warn' },
        metrics: m,
      });
    steps.push({
      id: 'cad',
      label: 'cAdvisor',
      caption: bi('cAdvisor внутри kubelet читает файлы cgroup каждого контейнера узла и отдаёт их значения рядами container_*: занятую память, потраченное процессорное время, число периодов и периодов с троттлингом.', 'cAdvisor inside the kubelet reads the cgroup files of every container on the node and serves their values as container_* series: memory used, CPU time spent, the number of periods and of throttled periods.'),
      focus: ['e-read', 'cad'],
      reveal: ['cad', 'e-read'],
      tokens: [{ edge: 'e-read', label: 'memory.current' }],
      say: { cad: bi('cAdvisor читает файлы cgroup и превращает их в ряды container_*.', 'cAdvisor reads the cgroup files and turns them into container_* series.') },
      states: { cad: 'ok' },
      values: { cad: `working_set ${used}Mi` },
      metrics: m,
    });
    steps.push({
      id: 'spec',
      label: bi('объект пода', 'pod object'),
      caption: n.oom
        ? fb(bi('Вторым источником сведений служит объект пода в API Kubernetes. В нём записано, сколько контейнеру положено (limits.memory: {l}Mi), а в статусе kubelet уже отметил, что контейнер перезапускался один раз и в последний раз завершился с причиной OOMKilled.', 'The second source is the pod object in the Kubernetes API. It says what the container is entitled to (limits.memory: {l}Mi), and in the status the kubelet has already noted that the container restarted once and last ended with the reason OOMKilled.'), { l: p.memLimit })
        : fb(bi('Вторым источником сведений служит объект пода в API Kubernetes. В нём записано, сколько контейнеру положено (limits.memory: {l}Mi), а в статусе записаны фаза пода и число перезапусков контейнера. Ни лимитов из манифеста, ни числа перезапусков ядро не знает, потому что эти сведения есть только в API.', 'The second source is the pod object in the Kubernetes API. It says what the container is entitled to (limits.memory: {l}Mi), and the status holds the pod phase and the container’s restart count. The kernel knows neither the limits from the manifest nor the restart count, because this information exists only in the API.'), { l: p.memLimit }),
      focus: ['spec'],
      reveal: ['spec'],
      say: { spec: n.oom ? bi('В статусе пода записаны restartCount 1 и причина OOMKilled.', 'The pod status holds restartCount 1 and the reason OOMKilled.') : fb(bi('В объекте пода записан лимит {l}Mi и restartCount 0.', 'The pod object holds the {l}Mi limit and restartCount 0.'), { l: p.memLimit }) },
      states: { spec: n.oom ? 'warn' : 'on' },
      values: { spec: n.oom ? 'restartCount: 1 · OOMKilled' : `limits.memory: ${p.memLimit}Mi` },
      metrics: m,
    });
    if (broken.has('ksm-down')) {
      steps.push({
        id: 'ksmdown',
        label: bi('источник пропал', 'source gone'),
        caption: bi('kube-state-metrics остановлен, и в Prometheus нет ни одного ряда kube_*. Вместо нулей в хранилище пусто, поэтому правило на число перезапусков получает пустой результат и молчит точно так же, как молчало бы в здоровом кластере.', 'kube-state-metrics is stopped, and Prometheus has no kube_* series at all. Instead of zeros the store holds nothing, so the restart rule gets an empty result and stays silent exactly as it would in a healthy cluster.'),
        focus: ['ksm', 'e-watch'],
        reveal: ['ksm', 'e-watch'],
        say: { ksm: bi('kube-state-metrics не работает, и ряды kube_* не появляются вовсе.', 'kube-state-metrics is not running, and the kube_* series do not appear at all.') },
        states: { ksm: 'err', 'e-watch': 'err' },
        metrics: m,
        broken: {
          at: 'ksm',
          message: 'up{job="kube-state-metrics"} == 0 · increase(kube_pod_container_status_restarts_total[15m]) > 3 → empty result',
          caption: bi('на kube-state-metrics. Узнают такую поломку по ряду up этой цели, равному нулю, и по пустым панелям на дашборде. Поэтому на каждый важный источник рядов ставят свой алерт о том, что источник пропал: up == 0 или absent().', 'at kube-state-metrics. You recognise this break by the target’s up series being zero and by empty dashboard panels. That is why every important source of series gets its own alert that the source is gone: up == 0 or absent().'),
        },
      });
      return steps;
    }
    steps.push(
      {
        id: 'ksm',
        label: 'kube-state-metrics',
        caption: n.oom
          ? bi('kube-state-metrics следит за объектами API и замечает изменение статуса. Ряд kube_pod_container_status_restarts_total вырос до 1, а ряд с причиной последнего завершения показывает OOMKilled.', 'kube-state-metrics watches the API objects and notices the status change. kube_pod_container_status_restarts_total has grown to 1, and the last-termination-reason series shows OOMKilled.')
          : bi('kube-state-metrics следит за объектами API и превращает их поля в ряды kube_*: лимиты контейнеров, фазу пода, число перезапусков и число доступных реплик.', 'kube-state-metrics watches the API objects and turns their fields into kube_* series: container limits, the pod phase, the restart count and the number of available replicas.'),
        focus: ['e-watch', 'ksm'],
        reveal: ['ksm', 'e-watch'],
        tokens: [{ edge: 'e-watch', label: n.oom ? 'restarts 1' : 'status' }],
        say: { ksm: n.oom ? bi('kube-state-metrics видит перезапуск и увеличивает restarts_total до 1.', 'kube-state-metrics sees the restart and raises restarts_total to 1.') : bi('kube-state-metrics превращает поля объекта пода в ряды kube_*.', 'kube-state-metrics turns the pod object fields into kube_* series.') },
        states: { ksm: 'ok' },
        values: { ksm: n.oom ? 'restarts_total 1' : 'restarts_total 0' },
        metrics: m,
      },
      {
        id: 'scrape',
        label: 'scrape',
        caption: bi('Prometheus по расписанию забирает оба набора рядов: container_* у kubelet каждого узла и kube_* у kube-state-metrics. У рядов из двух источников общие метки namespace, pod и container, поэтому их можно соединить в одном запросе.', 'Prometheus fetches both sets of series on schedule: container_* from every node’s kubelet and kube_* from kube-state-metrics. The series from the two sources share the namespace, pod and container labels, so they can be joined in one query.'),
        focus: ['prom', 'e-s1', 'e-s2'],
        reveal: ['prom', 'e-s1', 'e-s2'],
        tokens: [
          { edge: 'e-s1', reverse: true, label: 'container_*' },
          { edge: 'e-s2', reverse: true, label: 'kube_*' },
        ],
        say: { prom: bi('Prometheus забирает ряды container_* у kubelet и kube_* у kube-state-metrics.', 'Prometheus fetches container_* from the kubelet and kube_* from kube-state-metrics.') },
        states: { prom: 'ok' },
        metrics: m,
      },
      {
        id: 'answer',
        label: 'PromQL',
        caption: fb(bi('Запрос делит занятую память на лимит и получает {r}, а доля периодов с троттлингом равна {t}. Вместе с числом перезапусков это и есть три вопроса метода USE к контейнеру: насколько занят ресурс, ждёт ли процесс и были ли ошибки.', 'The query divides the memory used by the limit and gets {r}, and the share of throttled periods is {t}. Together with the restart count these are the three USE questions for a container: how busy the resource is, whether the process waits and whether there were errors.'), { r: m.ratio, t: n.throttle }),
        focus: ['answer', 'e-q'],
        reveal: ['answer', 'e-q'],
        tokens: [{ edge: 'e-q', label: `ratio ${m.ratio}` }],
        say: { answer: fb(bi('Запрос показывает, что память занята на {r} от лимита, доля периодов с троттлингом равна {t}, а перезапусков было {k}.', 'The query shows that memory is at {r} of the limit, the share of throttled periods is {t}, and there were {k} restarts.'), { r: m.ratio, t: n.throttle, k: m.restarts }) },
        states: { answer: n.oom || n.throttle > 0.1 ? 'warn' : 'ok' },
        values: { answer: `${m.ratio} · ${n.throttle}` },
        metrics: m,
      },
    );
    return steps;
  },
  explainDelta(prev, next, change): Bi {
    if (change.kind === 'break')
      return change.on
        ? bi('kube-state-metrics остановлен, поэтому его ряды исчезли, а не обнулились, и правила с ними молчат.', 'kube-state-metrics is stopped, so its series vanished rather than turned to zero, and the rules using them stay silent.')
        : bi('kube-state-metrics снова работает, и ряды kube_* вернулись.', 'kube-state-metrics works again, and the kube_* series are back.');
    const a = last(prev);
    const b = last(next);
    if (change.id === 'cpuNeed' || change.id === 'cpuLimit')
      return fb(bi('Доля периодов с троттлингом изменилась с {a} до {b}. Лимит процессора процесс не завершает, а только притормаживает.', 'The share of throttled periods changed from {a} to {b}. A CPU limit does not end the process; it only holds it back.'), { a: a.throttle ?? 0, b: b.throttle ?? 0 });
    return (b.restarts ?? 0) > 0
      ? fb(bi('Отношение памяти к лимиту теперь {b}. Процессу не хватило лимита, поэтому ядро завершило его, и контейнер перезапустился.', 'Memory to limit is now {b}. The limit was not enough for the process, so the kernel ended it, and the container restarted.'), { b: b.ratio ?? 0 })
      : fb(bi('Отношение памяти к лимиту изменилось с {a} до {b}, и процессу лимита хватает.', 'Memory to limit changed from {a} to {b}, and the limit is enough for the process.'), { a: a.ratio ?? 0, b: b.ratio ?? 0 });
  },
});
