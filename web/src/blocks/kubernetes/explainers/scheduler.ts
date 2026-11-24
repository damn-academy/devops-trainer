// Э3 (05 §6.5): how the scheduler picks a node. A pod with requests waits in
// the queue; filters run node by node (NodeUnschedulable → NodeResourcesFit
// → TaintToleration → NodeAffinity); survivors are scored (LeastAllocated,
// ImageLocality); the winner gets a Binding. A failed filter shows the real
// FailedScheduling wording; the knobs recompute everything at once.
//
// Reading order: at first only the pod, the queue and the scheduler are on
// screen. The nodes appear when the scheduler checks them, the API server when
// the choice is written. Every step is one action of the scheduler, and what a
// filter said about a node is written under that node.

import { defineModel } from '../../../core/define';
import { bi, fmt, t, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { failedMessage, type FilterResult } from '../../../engine/kube-lite/scheduler';
import { box, D, edge, fmtb, idsOf, LEGEND_BASE, mark, metric, only } from './kit';

type P = { memory: number; cpu: number; replicas: number; selector: boolean; taint: boolean; image: boolean };

export interface SimNode {
  name: string;
  cpu: number;
  mem: number;
  usedCpu: number;
  usedMem: number;
  ssd: boolean;
  tainted?: boolean;
}

export const NODES: SimNode[] = [
  { name: 'worker-1', cpu: 2000, mem: 2816, usedCpu: 500, usedMem: 1536, ssd: false },
  { name: 'worker-2', cpu: 2000, mem: 3840, usedCpu: 1000, usedMem: 512, ssd: false },
  { name: 'worker-3', cpu: 4000, mem: 3840, usedCpu: 250, usedMem: 2048, ssd: true },
];

/** Place `replicas` pods one by one, as the scheduler does (each binding changes the next score). */
export function schedule(p: P): { placements: (string | null)[]; filters: FilterResult[][]; scores: Record<string, number>[] } {
  const nodes = NODES.map((n) => ({ ...n, tainted: p.taint && n.name === 'worker-1' }));
  const placements: (string | null)[] = [];
  const filters: FilterResult[][] = [];
  const scores: Record<string, number>[] = [];
  for (let i = 0; i < p.replicas; i++) {
    const f: FilterResult[] = nodes.map((n) => {
      if (n.tainted) return { node: n.name, ok: false, plugin: 'TaintToleration', reason: 'node(s) had untolerated taint {maintenance: true}' };
      if (p.selector && !n.ssd) return { node: n.name, ok: false, plugin: 'NodeAffinity', reason: "node(s) didn't match Pod's node affinity/selector" };
      const short: string[] = [];
      if (n.usedCpu + p.cpu > n.cpu) short.push('Insufficient cpu');
      if (n.usedMem + p.memory > n.mem) short.push('Insufficient memory');
      if (short.length) return { node: n.name, ok: false, plugin: 'NodeResourcesFit', reason: short.join(', '), resources: true };
      return { node: n.name, ok: true };
    });
    filters.push(f);
    const sc: Record<string, number> = {};
    for (const r of f.filter((x) => x.ok)) {
      const n = nodes.find((x) => x.name === r.node)!;
      const least = ((1 - (n.usedCpu + p.cpu) / n.cpu + (1 - (n.usedMem + p.memory) / n.mem)) / 2) * 100;
      sc[n.name] = Math.round(least) + (p.image && n.name === 'worker-2' ? 10 : 0);
    }
    scores.push(sc);
    const best = Object.entries(sc).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
    placements.push(best);
    if (best) {
      const n = nodes.find((x) => x.name === best)!;
      n.usedCpu += p.cpu;
      n.usedMem += p.memory;
    }
  }
  return { placements, filters, scores };
}

const gauge = (n: SimNode, cpu: number, mem: number) => `cpu ${cpu}/${n.cpu}m · mem ${mem}/${n.mem}Mi`;

const nodeCard = (n: SimNode, extra: Bi) =>
  fmtb(bi('Узел кластера: {c} миллиядер процессора и {m} МиБ памяти, которые можно отдать подам. Поды, уже назначенные сюда, запросили {uc} миллиядер и {um} МиБ. {x}', 'A cluster node: {c}m CPU and {m}Mi allocatable; {uc}m and {um}Mi already requested. {x}'), { c: n.cpu, m: n.mem, uc: n.usedCpu, um: n.usedMem, x: extra });
const NODE_WHO = bi('Узел подключил к кластеру администратор; занятость считает сам планировщик по запросам подов.', 'An administrator joined the node; the scheduler counts its load from pod requests.');

const diagram = {
  width: 960,
  height: 470,
  nodes: [
    box('pod', bi('Под web', 'Pod web'), 'obj', 'doc', [24, 30, 230, 84], 'file', bi('Новый под, у которого ещё нет узла, поэтому поле `spec.nodeName` у него пустое. Планировщику важно, сколько ресурсов под просит (requests), какие узлы он требует (nodeSelector) и какие запреты узлов готов терпеть (tolerations).', 'A new pod with empty `spec.nodeName`. The scheduler cares about its requests, nodeSelector and tolerations.'), bi('Под создал контроллер ReplicaSet.', 'The ReplicaSet controller created it.'), { see: 'kubectl get pod web -o yaml', doc: D.scheduler, sub: 'requests 250m / 512Mi' }),
    box('queue', bi('Очередь планировщика', 'Scheduling queue'), 'cp', 'buffer', [24, 190, 230, 64], 'folder', bi('Поды, которые ждут узла. Под, для которого узла не нашлось, возвращается сюда, и планировщик пробует снова, когда в кластере что-то меняется.', 'Pods waiting for a node; an unschedulable pod comes back and is retried when the cluster changes.'), bi('Очередь ведёт kube-scheduler.', 'Kept by kube-scheduler.'), { see: 'kubectl get pods --field-selector status.phase=Pending', doc: D.scheduler, sub: '1' }),
    box('sched', 'kube-scheduler', 'cp', 'hex', [320, 190, 230, 64], 'process', bi('Планировщик выбирает узел для пода в три приёма: фильтры отбрасывают узлы, куда под не поместится или куда его нельзя ставить, оценка выбирает лучший из оставшихся, а привязка (Binding) записывает выбор. Сам планировщик ничего не запускает.', 'Filter, score, bind: it only picks a node and records the choice, it starts nothing.'), bi('Этот процесс работает на управляющем узле, и kubelet этого узла запускает его прямо из файла на диске.', 'This process runs on the control-plane node, and the kubelet there starts it straight from a file on disk.'), { see: 'kubectl get events --field-selector reason=FailedScheduling', doc: D.scheduler }),
    box('api', 'kube-apiserver', 'cp', 'hex', [320, 30, 230, 60], 'server', bi('API-сервер принимает от планировщика привязку пода к узлу и записывает в под поле `nodeName`. После этого под забирает kubelet выбранного узла.', 'Accepts the Binding and writes `nodeName`; then the chosen node’s kubelet takes the pod.'), bi('Работает на управляющем узле.', 'Runs on the control-plane node.'), { doc: D.apiserver }),
    box('w1', 'worker-1', 'node', 'rack', [620, 24, 316, 110], 'server', nodeCard(NODES[0], bi('Ручка «worker-1 закрыт на обслуживание» вешает на него запрет (taint) maintenance=true:NoSchedule.', 'A knob puts the taint maintenance=true:NoSchedule on it.')), NODE_WHO, { see: 'kubectl describe node worker-1', doc: D.scheduler, sub: gauge(NODES[0], 500, 1536) }),
    box('w2', 'worker-2', 'node', 'rack', [620, 178, 316, 110], 'server', nodeCard(NODES[1], bi('Если образ пода уже скачан сюда, оценка ImageLocality добавляет узлу баллы.', 'If the image is already here, ImageLocality adds points.')), NODE_WHO, { see: 'kubectl describe node worker-2', doc: D.scheduler, sub: gauge(NODES[1], 1000, 512) }),
    box('w3', 'worker-3', 'node', 'rack', [620, 332, 316, 110], 'server', nodeCard(NODES[2], bi('У узла есть метка disk=ssd.', 'It has the label disk=ssd.')), NODE_WHO, { see: 'kubectl get nodes --show-labels', doc: D.scheduler, sub: gauge(NODES[2], 250, 2048) }),
  ],
  edges: [
    edge('e-pod', 'pod', 'queue', bi('ждёт узла', 'waits for a node'), bi('Под без узла попадает в очередь планировщика.', 'A pod without a node enters the queue.'), bi('Под в очередь ставит kube-scheduler.', 'kube-scheduler.')),
    edge('e-queue', 'queue', 'sched', bi('следующий под', 'next pod'), bi('Планировщик берёт из очереди следующий под, выбирая сначала по приоритету, а потом по времени.', 'The next pod, by priority, then by time.'), bi('kube-scheduler', 'kube-scheduler')),
    edge('e-w1', 'sched', 'w1', bi('проверка узла', 'check the node'), bi('Фильтры проверяют, подходит ли узел, а оценка — насколько он хорош.', 'Filters check whether the node fits; scoring, how good it is.'), bi('Проверяют плагины планировщика.', 'Scheduler plugins.'), { via: [[585, 222], [585, 79]], labelAt: 0.85 }),
    edge('e-w2', 'sched', 'w2', bi('проверка узла', 'check the node'), bi('Фильтры проверяют, подходит ли узел, а оценка — насколько он хорош.', 'Filters check whether the node fits; scoring, how good it is.'), bi('Проверяют плагины планировщика.', 'Scheduler plugins.'), { labelAt: 0.85 }),
    edge('e-w3', 'sched', 'w3', bi('проверка узла', 'check the node'), bi('Фильтры проверяют, подходит ли узел, а оценка — насколько он хорош.', 'Filters check whether the node fits; scoring, how good it is.'), bi('Проверяют плагины планировщика.', 'Scheduler plugins.'), { via: [[585, 222], [585, 387]], labelAt: 0.85 }),
    edge('e-bind', 'sched', 'api', bi('привязка к узлу', 'binding'), bi('Планировщик записывает выбор запросом Binding, и у пода появляется `spec.nodeName`.', 'The scheduler writes a Binding; the pod gets `spec.nodeName`.'), bi('kube-scheduler', 'kube-scheduler')),
  ],
};

const ALL = idsOf(diagram);
const W = ['w1', 'w2', 'w3'];

export const schedulerModel = defineModel<P>({
  id: 'k8s.scheduler',
  frame: 'visible',
  block: 'k8s-1',
  title: bi('Как планировщик выбирает узел для пода', 'How the scheduler picks a node'),
  summary: bi(
    'У нового пода ещё нет узла, и его выбирает kube-scheduler. Сначала фильтры отбрасывают узлы, куда под не поместится или куда его нельзя ставить, потом оценка выбирает лучший из оставшихся, и наконец планировщик записывает выбор. Важно, что планировщик сравнивает с узлами запрос пода (requests), а не то, сколько под потребляет на самом деле.',
    'A new pod has no node; kube-scheduler picks one: filters drop the nodes where it does not fit or may not go, scoring picks the best of the rest, and the choice is written. The scheduler compares requests, not real usage.',
  ),
  intro: bi(
    'Сейчас на схеме под, очередь и планировщик. А дальше листайте кнопкой «Шаг вперёд». Узлы появятся, когда планировщик начнёт их проверять. Под каждым узлом написано, сколько ресурсов на нём уже занято, а после проверки — почему узел не подошёл или сколько баллов он получил. Потом увеличьте в «Параметрах» запрос памяти так, чтобы под не поместился никуда, и прочитайте сообщение, которое напишет планировщик.',
    'For now the diagram shows the pod, the queue and the scheduler. Then go on with “Step forward”. The nodes appear when the scheduler checks them; under each node you see its load, and after the check why it failed or its score. Then raise the memory request in “Parameters” until the pod fits nowhere and read the scheduler’s message.',
  ),
  legend: [
    ...LEGEND_BASE,
    mark('icon:file', 'под, которому нужен узел', 'the pod that needs a node'),
    mark('icon:process', 'планировщик kube-scheduler', 'kube-scheduler'),
    mark('icon:server', 'узел кластера; под ним занятые ресурсы', 'a node; its load underneath'),
    mark('ok', 'узел подошёл или выбран', 'the node fits or is chosen'),
    mark('pale', 'узел отброшен фильтром', 'the node is dropped by a filter'),
    mark('warn', 'узла не нашлось', 'no node found'),
  ],
  stopLabel: bi('Планирование остановилось', 'Scheduling stopped'),
  concepts: ['k8s.scheduler'],
  diagram,
  params: [
    {
      id: 'memory',
      label: bi('Сколько памяти просит под (requests.memory, МиБ)', 'Memory the pod requests (requests.memory, Mi)'),
      kind: 'range',
      min: 64,
      max: 4096,
      step: 64,
      default: 512,
      near: 'pod',
      group: bi('Что просит под', 'What the pod asks for'),
      predict: {
        prompt: bi('Вы меняете запрос памяти пода. Что будет с подом при новом значении?', 'You change the pod’s memory request. What happens to the pod?'),
        options: [
          { id: 'run', text: bi('Получит узел и запустится', 'It gets a node and starts') },
          { id: 'pending', text: bi('Останется в состоянии Pending с событием FailedScheduling', 'It stays Pending with a FailedScheduling event') },
          { id: 'oom', text: bi('Запустится, а потом будет завершён из-за нехватки памяти', 'It starts and is then killed for lack of memory') },
        ],
        resolve: (_p, n) => (metric(n, 'unscheduled') > 0 ? 'pending' : 'run'),
      },
    },
    { id: 'cpu', label: bi('Сколько процессора просит под (requests.cpu, миллиядер)', 'CPU the pod requests (requests.cpu, m)'), kind: 'range', min: 50, max: 2000, step: 50, default: 250, near: 'pod', group: bi('Что просит под', 'What the pod asks for') },
    { id: 'selector', label: bi('Под требует узел с SSD (nodeSelector disk=ssd)', 'The pod needs an SSD node (nodeSelector disk=ssd)'), kind: 'toggle', default: false, near: 'pod', levels: ['intermediate', 'experienced'], group: bi('Что просит под', 'What the pod asks for') },
    { id: 'replicas', label: bi('Сколько подов ждут узла один за другим', 'Pods waiting one after another'), kind: 'range', min: 1, max: 6, step: 1, default: 1, near: 'queue', group: bi('Что происходит в кластере', 'What happens in the cluster') },
    { id: 'image', label: bi('Образ пода уже скачан на worker-2', 'The image is already on worker-2'), kind: 'toggle', default: false, near: 'w2', group: bi('Что происходит в кластере', 'What happens in the cluster') },
    { id: 'taint', label: bi('worker-1 закрыт на обслуживание (taint maintenance=true:NoSchedule)', 'worker-1 is under maintenance (taint)'), kind: 'toggle', default: false, near: 'w1', levels: ['intermediate', 'experienced'], group: bi('Что происходит в кластере', 'What happens in the cluster') },
  ],
  breaks: [
    {
      id: 'no-sched',
      label: bi('kube-scheduler остановлен', 'kube-scheduler is stopped'),
      remove: ['sched', 'e-queue', 'e-bind', 'e-w1', 'e-w2', 'e-w3'],
      boundary: 'process',
      predict: {
        prompt: bi('kube-scheduler остановлен, а под ждёт узла. Что покажет команда `kubectl describe pod web` в разделе Events?', 'kube-scheduler is stopped. What does `kubectl describe pod web` show under Events?'),
        options: [
          { id: 'none', text: bi('Ничего, потому что событие FailedScheduling пишет сам планировщик, а он не работает', 'Nothing: FailedScheduling is written by the scheduler, which is down') },
          { id: 'failed', text: bi('Событие FailedScheduling с причиной, по которой узла не нашлось', 'A FailedScheduling event with the reason') },
        ],
        resolve: () => 'none',
      },
    },
  ],
  metrics: [
    { id: 'scheduled', label: bi('подов получили узел', 'pods scheduled') },
    { id: 'unscheduled', label: bi('подов ждут узла', 'pods waiting') },
  ],
  run(p, broken): Step[] {
    const s: Step[] = [];
    const m = (scheduled: number) => ({ scheduled, unscheduled: p.replicas - scheduled });
    s.push({
      id: 'pod',
      label: bi('под', 'pod'),
      caption: fmt(bi('Появился новый под web. Он просит {c} миллиядер процессора и {m} МиБ памяти, а узла у него пока нет. Выбирать узел для пода будет планировщик.', 'A new pod web requests {c}m CPU and {m}Mi memory and has no node yet; picking one is the scheduler’s job.'), { c: p.cpu, m: p.memory }),
      focus: ['pod'],
      say: { pod: fmt(bi('Под web просит {c}m процессора и {m} МиБ памяти, а поле nodeName у него пустое.', 'Pod web requests {c}m CPU and {m}Mi; nodeName is empty.'), { c: p.cpu, m: p.memory }) },
      states: only(ALL, 'pod', 'queue', 'sched'),
      values: { pod: `requests ${p.cpu}m / ${p.memory}Mi${p.selector ? ' · disk=ssd' : ''}`, queue: '0' },
      fill: { queue: 0 },
      metrics: m(0),
    });
    s.push({
      id: 'queue',
      label: bi('очередь', 'queue'),
      caption: p.replicas > 1 ? fmt(bi('Вместе с web в очередь планировщика встают ещё поды, всего их {n}. Планировщик будет устраивать их по одному, и каждый следующий увидит узлы уже занятыми предыдущими.', '{n} pods are queued; the scheduler places them one by one, each seeing the nodes filled by the previous ones.'), { n: p.replicas }) : bi('Под встаёт в очередь планировщика и ждёт, когда его возьмут в работу.', 'The pod is queued and waits to be taken.'),
      focus: ['queue', 'e-pod'],
      reveal: ['e-pod'],
      tokens: [{ edge: 'e-pod', label: 'web' }],
      say: { queue: fmt(bi('В очереди подов, которым нужен узел: {n}.', 'Pods waiting for a node: {n}.'), { n: p.replicas }) },
      values: { queue: String(p.replicas) },
      fill: { queue: Math.min(1, p.replicas / 6) },
      metrics: m(0),
    });
    if (broken.has('no-sched')) {
      s.push({
        id: 'none',
        label: bi('никто не берёт', 'nobody takes'),
        caption: bi('Под лежит в очереди, но брать его некому, потому что kube-scheduler не работает. Поле nodeName так и остаётся пустым, ни один kubelet под не запускает, и никто не пишет о нём ни одного события.', 'The pod waits, but kube-scheduler is down: nodeName stays empty, no kubelet starts it and nobody writes an event.'),
        focus: ['queue'],
        say: { queue: bi('Под ждёт в очереди, но планировщик не работает, и брать под некому.', 'The pod waits; the scheduler is down.') },
        states: { sched: 'err' },
        metrics: m(0),
        broken: { at: 'sched', message: 'Node:         <none>\nStatus:       Pending\nEvents:       <none>', caption: bi('ещё до выбора узла. В жизни такую поломку узнают по поду в состоянии Pending, у которого в Events пусто, потому что событие FailedScheduling пишет сам планировщик, а его нет.', 'before any node is chosen: a Pending pod with no events, since FailedScheduling is written by the scheduler itself.') },
      });
      return s;
    }
    const r = schedule(p);
    const used = NODES.map((n) => ({ cpu: n.usedCpu, mem: n.usedMem }));
    let scheduled = 0;
    for (let i = 0; i < p.replicas; i++) {
      const name = p.replicas > 1 ? `web-${i + 1}` : 'web';
      const f = r.filters[i];
      const states: Record<string, 'ok' | 'off'> = {};
      const values: Record<string, string> = {};
      f.forEach((x, j) => {
        states[W[j]] = x.ok ? 'ok' : 'off';
        values[W[j]] = x.ok ? gauge(NODES[j], used[j].cpu, used[j].mem) : `✗ ${x.reason}`;
      });
      const okNames = f.filter((x) => x.ok).map((x) => x.node);
      s.push({
        id: `filter-${i}`,
        label: p.replicas > 1 ? fmt(bi('фильтры {n}', 'filter {n}'), { n: i + 1 }) : bi('фильтры', 'filters'),
        caption: okNames.length === 3
          ? fmt(bi('Планировщик берёт под {p} и проверяет фильтрами все три узла. Ресурсов хватает везде, и запретов нет, поэтому все три узла проходят дальше.', 'The scheduler takes {p} and filters all three nodes: all fit.'), { p: name })
          : okNames.length
            ? fmt(bi('Планировщик берёт под {p} и проверяет фильтрами все три узла. Дальше проходят только {ok}, а почему отброшены остальные, написано под ними.', 'The scheduler takes {p}: only {ok} pass; the reasons are under the others.'), { p: name, ok: okNames.join(', ') })
            : fmt(bi('Планировщик берёт под {p} и проверяет фильтрами все три узла. Не проходит ни один, и причина для каждого узла написана под ним.', 'The scheduler takes {p}: no node passes; the reasons are under each.'), { p: name }),
        focus: ['sched', 'e-w1', 'e-w2', 'e-w3'],
        reveal: ['w1', 'w2', 'w3', 'e-w1', 'e-w2', 'e-w3', 'e-queue'],
        tokens: [{ edge: 'e-w1', label: name }, { edge: 'e-w2', label: name }, { edge: 'e-w3', label: name }],
        say: { sched: fmt(bi('Планировщик проверяет, на каком узле хватит ресурсов для {p} и где ему не запрещено работать.', 'The scheduler checks where {p} fits and is allowed.'), { p: name }) },
        states: { sched: 'on', ...states },
        values: { ...values, queue: String(p.replicas - i - 1) },
        fill: { queue: Math.min(1, (p.replicas - i - 1) / 6) },
        metrics: m(scheduled),
      });
      const best = r.placements[i];
      if (!best) {
        const msg = failedMessage(f.map((x) => ({ ...x, node: x.node })));
        s.push({
          id: `fail-${i}`,
          label: 'FailedScheduling',
          caption: bi('Ни один узел не прошёл фильтры. Планировщик возвращает под в очередь, записывает событие FailedScheduling и попробует снова, когда в кластере что-нибудь изменится: освободится память, добавят узел или снимут запрет.', 'No node passed. The pod goes back to the queue with a FailedScheduling event and is retried when the cluster changes.'),
          focus: ['sched'],
          say: { sched: bi('Подходящего узла не нашлось, и под возвращается в очередь.', 'No node fits, and the pod goes back to the queue.') },
          states: { sched: 'warn' },
          values: { queue: String(p.replicas - i) },
          fill: { queue: Math.min(1, (p.replicas - i) / 6) },
          metrics: m(scheduled),
          broken: { at: 'sched', message: `Warning  FailedScheduling  default-scheduler  ${msg}`, caption: bi('на фильтрах. Сообщение собирается из причин, по которым отброшен каждый узел, а последняя фраза, про вытеснение (preemption), говорит, помогло бы ли вытеснить с узлов менее важные поды.', 'at the filters: the message lists every node’s reason, and the preemption part says whether evicting less important pods would help.') },
        });
        return s;
      }
      const sc = r.scores[i];
      const scoreVals = Object.fromEntries(Object.entries(sc).map(([k, v]) => [W[NODES.findIndex((n) => n.name === k)], t(fmt(bi('{v} баллов', '{v} points'), { v }))]));
      s.push({
        id: `score-${i}`,
        label: p.replicas > 1 ? fmt(bi('оценка {n}', 'score {n}'), { n: i + 1 }) : bi('оценка', 'score'),
        caption: fmt(bi('Планировщик оценивает узлы, которые прошли фильтры: {s}. Больше баллов получает узел, на котором после пода останется больше свободных ресурсов{img}.', 'Scoring the rest: {s}. More free resources after the pod means more points{img}.'), { s: Object.entries(sc).map(([k, v]) => `${k} ${v}`).join(', '), img: p.image ? t(bi(', а за уже скачанный образ узел получает ещё 10 баллов', '; an image already in place adds 10')) : '' }),
        focus: ['sched', ...W.filter((_, j) => f[j].ok)],
        say: { sched: bi('Планировщик ставит баллы узлам, которые прошли фильтры.', 'The scheduler scores the nodes that passed.') },
        values: scoreVals,
        metrics: m(scheduled),
      });
      const j = NODES.findIndex((n) => n.name === best);
      used[j].cpu += p.cpu;
      used[j].mem += p.memory;
      scheduled++;
      s.push({
        id: `bind-${i}`,
        label: fmt(bi('на {n}', 'to {n}'), { n: best }),
        caption: fmt(bi('Больше всего баллов у {n}. Планировщик записывает выбор, и у пода появляется поле nodeName: {n}. В событиях пода это видно как «Successfully assigned default/web to {n}». Дальше под запустит kubelet узла {n}.', '{n} wins: the scheduler writes a Binding and the pod gets nodeName: {n}; the kubelet of {n} starts it.'), { n: best }),
        focus: ['sched', 'e-bind', W[j]],
        reveal: ['api', 'e-bind'],
        tokens: [{ edge: 'e-bind', label: `nodeName: ${best}` }],
        say: { sched: fmt(bi('Планировщик привязывает под к узлу {n}.', 'The scheduler binds the pod to {n}.'), { n: best }) },
        values: Object.fromEntries(W.map((id, k) => [id, gauge(NODES[k], used[k].cpu, used[k].mem)])),
        states: { ...Object.fromEntries(W.map((id) => [id, 'on'])), [W[j]]: 'ok' },
        metrics: m(scheduled),
      });
    }
    return s;
  },
  explainDelta(_prev, next, change, a, b): Bi {
    if (change.kind === 'break')
      return change.on
        ? bi('Без планировщика под никогда не получит узел, и событий о нём тоже не будет.', 'Without a scheduler the pod never gets a node, and there are no events.')
        : bi('Планировщик снова работает и сразу берёт под из очереди.', 'The scheduler is back and takes the pod at once.');
    const r = schedule(b as P);
    const where = r.placements.map((x) => x ?? 'Pending').join(', ');
    switch (change.id) {
      case 'memory':
        return fmt(bi('Под теперь просит {b} МиБ памяти вместо {a}, и результат такой: {w}. Планировщик сравнивает запрос со свободным местом, то есть с памятью узла за вычетом того, что уже запросили другие поды, а не с реальным потреблением.', 'requests.memory {a} → {b}Mi: {w}. Requests are compared with allocatable minus what is requested, not with real usage.'), { a: a.memory as number, b: b.memory as number, w: where });
      case 'cpu':
        return fmt(bi('Под теперь просит {b} миллиядер процессора вместо {a}, и результат такой: {w}.', 'requests.cpu {a} → {b}m: {w}.'), { a: a.cpu as number, b: b.cpu as number, w: where });
      case 'replicas':
        return fmt(bi('Подов в очереди теперь {n}, и они попадают сюда: {w}. Каждая привязка увеличивает занятость узла, поэтому следующий под чаще уходит на другой узел.', '{n} pods: {w}. Each binding fills a node, so the next pod tends to go elsewhere.'), { n: b.replicas as number, w: where });
      case 'image':
        return b.image ? fmt(bi('Образ уже лежит на worker-2, и оценка добавляет этому узлу 10 баллов. Результат такой: {w}.', 'The image is on worker-2: +10 points. Result: {w}.'), { w: where }) : bi('Образа нет ни на одном узле, поэтому решают только свободные ресурсы.', 'No image anywhere: only free resources decide.');
      case 'selector':
        return b.selector ? fmt(bi('Под требует узел с меткой disk=ssd, и такой узел один, worker-3: фильтр отбросил остальные. Результат такой: {w}.', 'Only worker-3 has disk=ssd; the filter dropped the others: {w}.'), { w: where }) : bi('Под больше не требует SSD, и подходят все узлы.', 'No SSD needed: every node fits.');
      case 'taint':
        return b.taint ? fmt(bi('На worker-1 висит запрет maintenance=true:NoSchedule, а разрешения (toleration) у пода нет, поэтому фильтр отбросил этот узел. Результат такой: {w}.', 'worker-1 has a taint the pod does not tolerate, so it is dropped: {w}.'), { w: where }) : bi('Запрет с worker-1 снят, и узел снова участвует в выборе.', 'The taint is gone; worker-1 is a candidate again.');
    }
    return metric(next, 'unscheduled') ? bi('Часть подов осталась без узла.', 'Some pods are left without a node.') : bi('Все поды получили узлы.', 'Every pod got a node.');
  },
});
