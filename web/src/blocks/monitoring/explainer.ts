// E-MON (06 §7.4): from a counter in code to a message to the on-call
// engineer — scrape → store → PromQL → alert rule → Alertmanager → notify.

import { defineModel } from '../../core/define';
import { bi, fmt, type Bi } from '../../core/i18n';
import type { Step } from '../../core/types';
import { card } from '../git-cicd/explainers';

type P = { scrape: string; window: number; forMin: number; groupWait: number };
const last = (s: Step[]) => s[s.length - 1]?.metrics ?? {};

export function monNumbers(p: P): { samples: number; detect: number; ok: boolean } {
  const scrape = Number(p.scrape);
  const samples = Math.floor((p.window * 60) / scrape);
  const evalEvery = 60;
  // Worst case from breakage to message: the next scrape, the rate window filling, evaluation, for, group_wait.
  const detect = scrape + evalEvery + p.forMin * 60 + p.groupWait;
  return { samples, detect, ok: samples >= 2 };
}

export const monModel = defineModel<P>({
  id: 'obs.scrape-to-notify',
  block: 'monitoring',
  title: bi('От счётчика в коде до сообщения дежурному', 'From a counter in code to a message to the on-call engineer'),
  summary: bi('Prometheus сам забирает метрики, хранит ряды, по расписанию вычисляет правила и передаёт сработавшие алерты в Alertmanager, а тот решает, кому и когда написать.', 'Prometheus pulls the metrics itself, stores the series, evaluates rules on a schedule and passes firing alerts to Alertmanager, which decides whom to notify and when.'),
  concepts: ['obs.scrape', 'obs.rate', 'obs.alert-rule', 'obs.alertmanager'],
  diagram: {
    width: 960,
    height: 420,
    nodes: [
      { id: 'app', label: bi('процесс api', 'api process'), sub: 'http_requests_total 18342', family: 'user', shape: 'box', x: 16, y: 40, w: 184, h: 72, card: card(bi('Сервис считает события в памяти: каждый запрос увеличивает счётчик на 1. При перезапуске счётчик начинается с нуля.', 'The service counts events in memory: every request adds 1 to the counter. On restart the counter starts from zero.'), bi('Код приложения и клиентская библиотека Prometheus.', 'The application code and a Prometheus client library.')) },
      { id: 'metrics', label: '/metrics', sub: 'text exposition', family: 'obj', shape: 'doc', x: 16, y: 200, w: 184, h: 72, card: card(bi('HTTP-страница с текущими значениями всех метрик процесса: «# TYPE http_requests_total counter» и строки «имя{метки} значение».', 'An HTTP page with the current values of all the process metrics: "# TYPE http_requests_total counter" and "name{labels} value" lines.'), bi('Клиентская библиотека в процессе.', 'The client library in the process.'), 'curl http://api-1:8080/metrics') },
      { id: 'prom', label: 'Prometheus', sub: 'scrape', family: 'cp', shape: 'hex', x: 296, y: 120, w: 176, h: 80, card: card(bi('Сервер мониторинга. Сам ходит к целям по расписанию (pull), пишет сэмплы и вычисляет правила.', 'The monitoring server. It visits the targets on a schedule by itself (pull), writes the samples and evaluates the rules.'), bi('Команда эксплуатации; настраивается prometheus.yml.', 'The operations team; configured by prometheus.yml.'), 'promtool check config prometheus.yml', { url: 'https://prometheus.io/docs/prometheus/latest/configuration/configuration/', label: 'prometheus.io › Configuration' }) },
      { id: 'tsdb', label: 'TSDB', sub: '0 samples', family: 'store', shape: 'buffer', x: 296, y: 300, w: 176, h: 72, card: card(bi('База временных рядов: для каждого набора меток — лента пар «время, значение».', 'The time-series database: for every label set, a strip of "time, value" pairs.'), bi('Prometheus.', 'Prometheus.')) },
      { id: 'rule', label: bi('правило алерта', 'alert rule'), sub: 'for: 5m', family: 'flow', shape: 'box', x: 560, y: 120, w: 176, h: 80, card: card(bi('Запрос PromQL с условием. Пока условие выполняется меньше for — pending, дольше — firing.', 'A PromQL query with a condition. While it holds for less than `for` the alert is pending, longer — firing.'), bi('Вы, в файле правил.', 'You, in a rule file.'), 'promtool check rules rules.yml', { url: 'https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/', label: 'prometheus.io › Alerting rules' }) },
      { id: 'am', label: 'Alertmanager', sub: 'route', family: 'cp', shape: 'hex', x: 560, y: 300, w: 176, h: 72, card: card(bi('Получает алерты, выбирает получателя по меткам, объединяет похожие в одно сообщение, гасит следствия при причине.', 'Receives alerts, picks the receiver by labels, groups similar ones into one message, mutes consequences when the cause fires.'), bi('Команда эксплуатации; alertmanager.yml.', 'The operations team; alertmanager.yml.'), 'amtool config routes show') },
      { id: 'pager', label: bi('дежурный', 'on-call'), sub: 'pager', family: 'neutral', shape: 'pill', x: 800, y: 304, w: 144, h: 64, card: card(bi('Получатель: пейджер, чат, почта. Сообщение должно приходить о том, что чувствует пользователь.', 'The receiver: a pager, a chat, email. The message must be about what the user feels.'), bi('Расписание дежурств команды.', 'The team’s on-call schedule.')) },
    ],
    edges: [
      { id: 'e-expose', from: 'app', to: 'metrics', label: bi('значения в памяти', 'values in memory'), card: card(bi('Страница /metrics отдаёт значения в момент запроса — истории в процессе нет.', 'The /metrics page returns the values at the moment of the request; the process keeps no history.'), bi('Процесс.', 'The process.')) },
      { id: 'e-scrape', from: 'prom', to: 'metrics', label: 'GET /metrics', card: card(bi('Scrape: Prometheus сам приходит за метриками каждые scrape_interval. Если цель не ответила, ряд up = 0.', 'A scrape: Prometheus comes for the metrics every scrape_interval. If the target does not answer, up = 0.'), bi('Prometheus.', 'Prometheus.'), 'up{job="api"}') },
      { id: 'e-store', from: 'prom', to: 'tsdb', label: 'append (t, v)', card: card(bi('Каждый сэмпл дописывается в свой ряд с меткой времени scrape.', 'Every sample is appended to its series with the scrape timestamp.'), bi('Prometheus.', 'Prometheus.')) },
      { id: 'e-eval', from: 'tsdb', to: 'rule', label: bi('eval каждую 1m', 'eval every 1m'), card: card(bi('Правило вычисляется по расписанию группы; rate(x[w]) берёт сэмплы окна w.', 'The rule is evaluated on the group schedule; rate(x[w]) takes the samples of the window w.'), bi('Prometheus.', 'Prometheus.')) },
      { id: 'e-alert', from: 'rule', to: 'am', label: 'POST /api/v2/alerts', card: card(bi('Prometheus не пишет людям сам: он отправляет firing-алерты в Alertmanager.', 'Prometheus does not message people itself: it sends firing alerts to Alertmanager.'), bi('Prometheus.', 'Prometheus.')) },
      { id: 'e-notify', from: 'am', to: 'pager', label: bi('после group_wait', 'after group_wait'), card: card(bi('Alertmanager ждёт group_wait, чтобы собрать похожие алерты в одно сообщение, и отправляет его получателю.', 'Alertmanager waits group_wait to collect similar alerts into one message and sends it to the receiver.'), bi('Alertmanager.', 'Alertmanager.')) },
    ],
  },
  params: [
    { id: 'scrape', label: bi('scrape_interval', 'scrape_interval'), kind: 'choice', default: '15', options: [{ id: '5', label: bi('5 с', '5 s') }, { id: '15', label: bi('15 с', '15 s') }, { id: '60', label: bi('60 с', '60 s') }], near: 'e-scrape' },
    { id: 'window', label: bi('Окно rate, минут', 'rate window, minutes'), kind: 'range', min: 0.5, max: 15, step: 0.5, default: 5, near: 'e-eval', predict: { prompt: bi('Окно rate стало 1 минутой при scrape_interval 60 с. Что будет с результатом?', 'The rate window is now 1 minute with a 60 s scrape_interval. What happens to the result?'), options: [{ id: 'empty', text: bi('Пропадёт: в окне меньше двух сэмплов', 'It vanishes: fewer than two samples in the window') }, { id: 'same', text: bi('Будет таким же, только шумнее', 'It stays, just noisier') }], resolve: (_p, n) => (n.some((s) => s.broken) ? 'empty' : 'same') } },
    { id: 'forMin', label: bi('for, минут', 'for, minutes'), kind: 'range', min: 0, max: 10, step: 1, default: 5, near: 'rule', predict: { prompt: bi('Убираем for совсем. Что изменится?', 'We remove for entirely. What changes?'), options: [{ id: 'noise', text: bi('Алерт будет срабатывать на каждом коротком всплеске', 'The alert fires on every short spike') }, { id: 'never', text: bi('Алерт перестанет срабатывать', 'The alert stops firing') }], resolve: () => 'noise' } },
    { id: 'groupWait', label: bi('group_wait, секунд', 'group_wait, seconds'), kind: 'range', min: 0, max: 120, step: 10, default: 30, near: 'am' },
  ],
  breaks: [
    { id: 'target-down', label: bi('Цель недоступна', 'The target is down'), remove: ['e-scrape'], predict: { prompt: bi('api-1 не отвечает на /metrics. Что увидит Prometheus?', 'api-1 does not answer /metrics. What does Prometheus see?'), options: [{ id: 'up0', text: bi('up{instance="api-1:8080"} = 0, новых сэмплов нет', 'up{instance="api-1:8080"} = 0, no new samples') }, { id: 'zero', text: bi('Все метрики api-1 станут нулями', 'All api-1 metrics become zero') }], resolve: () => 'up0' } },
    { id: 'am-down', label: bi('Alertmanager остановлен', 'Alertmanager is stopped'), remove: ['am', 'e-notify'], predict: { prompt: bi('Alertmanager остановлен, правило firing. Придёт ли сообщение?', 'Alertmanager is stopped while the rule is firing. Will the message arrive?'), options: [{ id: 'no', text: bi('Нет, и никто об этом не узнает, если не следить за самим мониторингом', 'No, and nobody knows unless the monitoring itself is watched') }, { id: 'yes', text: bi('Да, Prometheus отправит его сам', 'Yes, Prometheus sends it itself') }], resolve: () => 'no' } },
  ],
  metrics: [
    { id: 'samples', label: bi('сэмплов в окне', 'samples in the window') },
    { id: 'detect', label: bi('от поломки до сообщения', 'from breakage to message'), unit: 's' },
  ],
  run(p, broken) {
    const n = monNumbers(p);
    const m = { samples: n.samples, detect: n.detect };
    const steps: Step[] = [
      { id: 'count', label: 'counter', caption: bi('Каждый запрос к api увеличивает счётчик http_requests_total с метками маршрута и кода ответа.', 'Every request to api increments the http_requests_total counter with route and status code labels.'), focus: ['app', 'e-expose', 'metrics'], tokens: [{ edge: 'e-expose', label: '+1' }], states: { app: 'on' } },
    ];
    if (broken.has('target-down')) {
      steps.push({ id: 'down', label: 'scrape ✗', caption: bi('Prometheus приходит за метриками, но цель не отвечает. В TSDB пишется только up = 0.', 'Prometheus comes for the metrics but the target does not answer. Only up = 0 is written to the TSDB.'), focus: ['prom', 'metrics'], states: { metrics: 'err', 'e-scrape': 'err' }, values: { tsdb: 'up = 0' }, metrics: m, broken: { at: 'e-scrape', message: 'Get "http://api-1:8080/metrics": dial tcp 10.0.0.11:8080: connect: connection refused', caption: bi('алерт на up == 0 сообщает о недоступной цели — это причина, а не симптом, и его держат на низком приоритете.', 'an alert on up == 0 reports an unreachable target: a cause, not a symptom, so it is kept at low priority.') } });
      return steps;
    }
    steps.push(
      { id: 'scrape', label: 'scrape', caption: fmt(bi('Каждые {s} с Prometheus делает GET /metrics и получает текст: строку на каждый ряд.', 'Every {s} s Prometheus does GET /metrics and gets text: one line per series.'), { s: p.scrape }), focus: ['e-scrape', 'prom'], tokens: [{ edge: 'e-scrape', reverse: true, label: '200 OK' }], states: { prom: 'on' } },
      { id: 'store', label: 'TSDB', caption: fmt(bi('Сэмплы дописываются в ряды. В окне {w} мин их {n}.', 'The samples are appended to the series. A {w} min window holds {n} of them.'), { w: p.window, n: n.samples }), focus: ['e-store', 'tsdb'], tokens: [{ edge: 'e-store', label: '(t, v)' }], fill: { tsdb: Math.min(1, n.samples / 40) }, values: { tsdb: `${n.samples} samples / window` } },
    );
    if (!n.ok) {
      steps.push({ id: 'window', label: 'rate', caption: bi('В окне меньше двух сэмплов: скорость роста посчитать не из чего, rate возвращает пустой результат.', 'Fewer than two samples in the window: there is nothing to compute a rate from, so rate returns an empty result.'), focus: ['e-eval', 'rule'], states: { rule: 'err' }, metrics: m, broken: { at: 'e-eval', message: 'rate(http_requests_total[1m]) → empty result', caption: bi('окно берут не меньше четырёх интервалов scrape.', 'the window is at least four scrape intervals.') } });
      return steps;
    }
    steps.push(
      { id: 'eval', label: 'rule', caption: bi('Раз в минуту Prometheus вычисляет правило: доля ошибок за окно выше порога?', 'Once a minute Prometheus evaluates the rule: is the error share over the window above the threshold?'), focus: ['e-eval', 'rule'], tokens: [{ edge: 'e-eval' }], states: { rule: 'warn' }, values: { rule: p.forMin ? `pending (for: ${p.forMin}m)` : 'firing' } },
      { id: 'for', label: p.forMin ? 'pending → firing' : 'firing', caption: p.forMin ? fmt(bi('Условие держится {f} мин — алерт переходит из pending в firing. Короткий всплеск не дошёл бы до этого шага.', 'The condition holds for {f} min and the alert goes from pending to firing. A short spike would not get to this step.'), { f: p.forMin }) : bi('Без for алерт сразу firing — даже на всплеске длиной в одну проверку.', 'Without for the alert fires at once, even on a spike lasting one evaluation.'), focus: ['rule', 'e-alert'], tokens: [{ edge: 'e-alert', label: 'firing' }], states: { rule: 'err' }, values: { rule: 'firing' } },
    );
    if (broken.has('am-down')) {
      steps.push({ id: 'amdown', label: 'notify ✗', caption: bi('Prometheus отправляет алерт, но Alertmanager не отвечает. Правило горит, а сообщения нет.', 'Prometheus sends the alert, but Alertmanager does not answer. The rule is firing and no message goes out.'), focus: ['am'], states: { am: 'err', pager: 'off' }, metrics: m, broken: { at: 'am', message: 'level=ERROR component=notifier msg="Error sending alerts" alertmanager=http://alertmanager:9093/api/v2/alerts err="Post \\"http://alertmanager:9093/api/v2/alerts\\": dial tcp: connect: connection refused"', caption: bi('кто следит за следящим: всегда горящий алерт Watchdog и внешняя проверка, что он приходит.', 'who watches the watcher: an always-firing Watchdog alert and an external check that it arrives.') } });
      return steps;
    }
    steps.push(
      { id: 'route', label: 'route', caption: bi('Alertmanager выбирает получателя по меткам алерта (severity=page → пейджер) и ждёт group_wait, собирая похожие алерты.', 'Alertmanager picks the receiver by the alert labels (severity=page → pager) and waits group_wait, collecting similar alerts.'), focus: ['am'], states: { am: 'on' }, values: { am: `group_wait ${p.groupWait}s` } },
      { id: 'notify', label: 'notify', caption: fmt(bi('Сообщение у дежурного. От поломки до него в худшем случае {d} с: scrape + eval + for + group_wait.', 'The message reaches the on-call engineer. In the worst case {d} s from breakage: scrape + eval + for + group_wait.'), { d: n.detect }), focus: ['e-notify', 'pager'], tokens: [{ edge: 'e-notify', label: '1 message' }], states: { pager: 'on' }, metrics: m },
    );
    return steps;
  },
  explainDelta(prev, next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? (change.id === 'target-down' ? bi('Pull-модель: Prometheus сам замечает недоступную цель (up = 0).', 'The pull model: Prometheus notices an unreachable target itself (up = 0).') : bi('Без Alertmanager алерты есть, а сообщений нет.', 'Without Alertmanager there are alerts but no messages.')) : bi('Поломка убрана.', 'The break is removed.');
    const d0 = last(prev).detect ?? 0;
    const d1 = last(next).detect ?? 0;
    if (change.id === 'window') return next.some((s) => s.broken) ? bi('В окне меньше двух сэмплов — rate не вычисляется. Окно должно быть не меньше четырёх scrape_interval.', 'Fewer than two samples in the window: no rate. The window must be at least four scrape_interval.') : fmt(bi('Окно {w} мин: {n} сэмплов, rate сглаженнее, но медленнее реагирует.', 'A {w} min window: {n} samples; rate is smoother but reacts more slowly.'), { w: b.window, n: last(next).samples ?? 0 });
    return fmt(bi('От поломки до сообщения: {a} → {b} с.', 'From breakage to message: {a} → {b} s.'), { a: d0, b: d1 });
  },
});
