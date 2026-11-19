// Э3 (05 §6.5): how the scheduler picks a node. A pod with requests waits in
// the queue; filters run node by node (NodeUnschedulable → NodeResourcesFit
// → TaintToleration → NodeAffinity); survivors are scored (LeastAllocated,
// ImageLocality); the winner gets a Binding. A failed filter shows the real
// FailedScheduling wording; the knobs recompute everything at once.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { failedMessage, type FilterResult } from '../../../engine/kube-lite/scheduler';
import { D, edge, metric, node } from './kit';

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

export const schedulerModel = defineModel<P>({
  id: 'k8s.scheduler',
  block: 'k8s-1',
  title: bi('Как планировщик выбирает узел', 'How the scheduler picks a node'),
  summary: bi('Фильтры отсеивают узлы, где под не поместится или куда его нельзя; оценка выбирает лучший из оставшихся; Binding записывает выбор. Требования пода — это requests, а не то, сколько он потребляет.', 'Filters drop the nodes where the pod does not fit or may not go; scoring picks the best of the rest; a Binding records the choice. What the pod needs is its requests, not what it actually uses.'),
  concepts: ['k8s.scheduler'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      node('pod', bi('под web', 'pod web'), 'obj', 'doc', 24, 40, 200, 90, bi('Новый под без nodeName. Для планировщика важны его requests (cpu, memory), nodeSelector и tolerations.', 'A new pod without nodeName. What matters to the scheduler: its requests (cpu, memory), nodeSelector and tolerations.'), bi('контроллер ReplicaSet', 'the ReplicaSet controller'), 'kubectl get pod web -o yaml', D.scheduler, 'requests 250m / 512Mi'),
      node('queue', bi('очередь планировщика', 'scheduling queue'), 'cp', 'buffer', 24, 190, 200, 60, bi('Поды, ждущие узла. Неподходящие возвращаются сюда и пробуются снова при изменениях в кластере.', 'Pods waiting for a node. Unschedulable ones come back here and are retried when the cluster changes.'), bi('kube-scheduler', 'kube-scheduler'), 'kubectl get pods --field-selector status.phase=Pending', D.scheduler, '1 pod'),
      node('sched', 'kube-scheduler', 'cp', 'hex', 330, 120, 220, 60, bi('Filter → Score → Bind. Ничего не запускает: только выбирает узел и записывает выбор.', 'Filter → Score → Bind. It starts nothing: it only picks a node and records the choice.'), bi('статический под control plane', 'a static pod of the control plane'), 'kubectl get events --field-selector reason=FailedScheduling', D.scheduler),
      node('api', 'kube-apiserver', 'cp', 'hex', 330, 30, 220, 50, bi('Отдаёт поды без узла (watch, nodeName="") и принимает Binding.', 'Serves pods without a node (watch, nodeName="") and accepts Bindings.'), bi('control plane', 'the control plane'), undefined, D.apiserver),
      node('w1', 'worker-1', 'node', 'rack', 640, 30, 300, 110, bi('2 CPU, 2816Mi allocatable; занято 500m и 1536Mi. Кнопкой можно повесить taint maintenance=true:NoSchedule.', '2 CPU, 2816Mi allocatable; 500m and 1536Mi requested already. A knob puts a taint maintenance=true:NoSchedule on it.'), bi('узел кластера', 'a cluster node'), 'kubectl describe node worker-1', D.scheduler, gauge(NODES[0], 500, 1536)),
      node('w2', 'worker-2', 'node', 'rack', 640, 175, 300, 110, bi('2 CPU, 3840Mi; занято 1000m и 512Mi. Кнопкой «образ уже есть» ImageLocality даёт ему бонус.', '2 CPU, 3840Mi; 1000m and 512Mi requested already. With "the image is already there" ImageLocality gives it a bonus.'), bi('узел кластера', 'a cluster node'), 'kubectl describe node worker-2', D.scheduler, gauge(NODES[1], 1000, 512)),
      node('w3', 'worker-3', 'node', 'rack', 640, 320, 300, 110, bi('4 CPU, 3840Mi; занято 250m и 2048Mi; метка disk=ssd.', '4 CPU, 3840Mi; 250m and 2048Mi requested already; label disk=ssd.'), bi('узел кластера', 'a cluster node'), 'kubectl get nodes --show-labels', D.scheduler, gauge(NODES[2], 250, 2048)),
    ],
    edges: [
      edge('e-watch', 'api', 'sched', 'watch pods nodeName=""', bi('Планировщик получает только поды без узла.', 'The scheduler gets only pods without a node.'), bi('kube-scheduler', 'kube-scheduler')),
      edge('e-queue', 'queue', 'sched', 'pop', bi('Следующий под из очереди (по приоритету, затем по времени).', 'The next pod from the queue (by priority, then by time).'), bi('kube-scheduler', 'kube-scheduler')),
      edge('e-pod', 'pod', 'queue', 'Pending', bi('Новый под попадает в очередь.', 'A new pod enters the queue.'), bi('kube-scheduler', 'kube-scheduler')),
      edge('e-w1', 'sched', 'w1', 'filter · score', bi('Проверка узла: подходит ли он и насколько хорош.', 'Checking the node: does it fit and how good is it.'), bi('плагины планировщика', 'scheduler plugins')),
      edge('e-w2', 'sched', 'w2', 'filter · score', bi('Проверка узла: подходит ли он и насколько хорош.', 'Checking the node: does it fit and how good is it.'), bi('плагины планировщика', 'scheduler plugins')),
      edge('e-w3', 'sched', 'w3', 'filter · score', bi('Проверка узла: подходит ли он и насколько хорош.', 'Checking the node: does it fit and how good is it.'), bi('плагины планировщика', 'scheduler plugins')),
      edge('e-bind', 'sched', 'api', 'POST …/binding', bi('Запись выбора: у пода появляется spec.nodeName.', 'The choice is written: the pod gets spec.nodeName.'), bi('kube-scheduler', 'kube-scheduler'), { via: [[560, 150], [560, 55]], labelAt: 0.5 }),
    ],
  },
  params: [
    {
      id: 'memory',
      label: bi('requests.memory, Mi', 'requests.memory, Mi'),
      kind: 'range',
      min: 64,
      max: 4096,
      step: 64,
      default: 512,
      near: 'pod',
      predict: {
        prompt: bi('Запрос памяти вырос до размера, который не помещается ни на один узел. Что будет?', 'The memory request grew beyond what fits on any node. What happens?'),
        options: [
          { id: 'pending', text: bi('Под останется Pending с событием FailedScheduling', 'The pod stays Pending with a FailedScheduling event') },
          { id: 'oom', text: bi('Под запустится и упадёт по памяти', 'The pod starts and dies of memory') },
        ],
        resolve: (_p, n) => (metric(n, 'unscheduled') > 0 ? 'pending' : 'oom'),
      },
    },
    { id: 'cpu', label: bi('requests.cpu, m', 'requests.cpu, m'), kind: 'range', min: 50, max: 2000, step: 50, default: 250, near: 'pod' },
    { id: 'replicas', label: bi('Сколько подов подряд', 'How many pods in a row'), kind: 'range', min: 1, max: 6, step: 1, default: 1, near: 'queue' },
    { id: 'image', label: bi('Образ уже есть на worker-2', 'The image is already on worker-2'), kind: 'toggle', default: false, near: 'w2' },
    { id: 'selector', label: bi('nodeSelector disk=ssd', 'nodeSelector disk=ssd'), kind: 'toggle', default: false, near: 'pod', levels: ['intermediate', 'experienced'] },
    { id: 'taint', label: bi('taint на worker-1', 'a taint on worker-1'), kind: 'toggle', default: false, near: 'w1', levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    {
      id: 'no-sched',
      label: bi('Убрать kube-scheduler', 'Remove kube-scheduler'),
      remove: ['sched', 'e-watch', 'e-queue', 'e-bind', 'e-w1', 'e-w2', 'e-w3'],
      boundary: 'process',
      predict: { prompt: bi('Планировщика нет. Какие события будут у пода?', 'There is no scheduler. Which events will the pod have?'), options: [{ id: 'none', text: bi('Никаких', 'None at all') }, { id: 'failed', text: bi('FailedScheduling', 'FailedScheduling') }], resolve: () => 'none' },
    },
  ],
  metrics: [
    { id: 'scheduled', label: bi('назначено подов', 'pods scheduled') },
    { id: 'unscheduled', label: bi('остались Pending', 'left Pending') },
  ],
  run(p, broken): Step[] {
    const s: Step[] = [];
    s.push({ id: 'queue', label: bi('очередь', 'queue'), caption: fmt(bi('Под с requests {c}m CPU и {m}Mi памяти ждёт в очереди: nodeName пуст.', 'A pod with requests {c}m CPU and {m}Mi memory waits in the queue: nodeName is empty.'), { c: p.cpu, m: p.memory }), focus: ['pod', 'e-pod', 'queue'], tokens: [{ edge: 'e-pod' }], values: { pod: `requests ${p.cpu}m / ${p.memory}Mi`, queue: `${p.replicas} pod${p.replicas > 1 ? 's' : ''}` }, fill: { queue: Math.min(1, p.replicas / 6) }, metrics: { scheduled: 0, unscheduled: p.replicas } });
    if (broken.has('no-sched')) {
      s.push({ id: 'none', label: bi('тишина', 'silence'), caption: bi('Под никто не берёт из очереди.', 'Nobody takes the pod from the queue.'), focus: ['queue'], states: { sched: 'off' }, metrics: { scheduled: 0, unscheduled: p.replicas }, broken: { at: 'sched', message: 'Node:         <none>\nStatus:       Pending\nEvents:       <none>', caption: bi('Pending без событий: FailedScheduling пишет сам планировщик, а его нет.', 'Pending without events: FailedScheduling is written by the scheduler itself, and there is none.') } });
      return s;
    }
    const r = schedule(p);
    const used = NODES.map((n) => ({ cpu: n.usedCpu, mem: n.usedMem }));
    const ids = ['w1', 'w2', 'w3'];
    let scheduled = 0;
    for (let i = 0; i < p.replicas; i++) {
      const f = r.filters[i];
      const states: Record<string, 'ok' | 'off' | 'err'> = {};
      f.forEach((x, j) => (states[ids[j]] = x.ok ? 'ok' : 'off'));
      const reasons = f.filter((x) => !x.ok).map((x) => `${x.node}: ${x.reason}`);
      s.push({
        id: `filter-${i}`,
        label: p.replicas > 1 ? `filter #${i + 1}` : 'filter',
        caption: reasons.length ? fmt(bi('Фильтры: {r}.', 'Filters: {r}.'), { r: reasons.join('; ') }) : bi('Фильтры: все три узла подходят — ресурсов хватает, ограничений нет.', 'Filters: all three nodes fit — there are enough resources and no restrictions.'),
        focus: ['sched', 'e-w1', 'e-w2', 'e-w3'],
        tokens: [{ edge: 'e-w1' }, { edge: 'e-w2' }, { edge: 'e-w3' }],
        states: { sched: 'on', ...states },
      });
      const best = r.placements[i];
      if (!best) {
        const msg = failedMessage(f.map((x) => ({ ...x, node: x.node })));
        s.push({ id: `fail-${i}`, label: 'FailedScheduling', caption: bi('Ни один узел не прошёл фильтры: под возвращается в очередь, планировщик пишет событие и попробует снова, когда кластер изменится.', 'No node passed the filters: the pod goes back to the queue; the scheduler writes an event and retries when the cluster changes.'), focus: ['sched', 'queue'], states: { sched: 'warn' }, metrics: { scheduled, unscheduled: p.replicas - scheduled }, broken: { at: 'sched', message: `Warning  FailedScheduling  default-scheduler  ${msg}`, caption: bi('событие собирается из причин каждого фильтра; «preemption» — может ли помочь вытеснение менее важных подов.', 'the event is built from the reason of every filter; "preemption" says whether evicting less important pods could help.') } });
        return s;
      }
      const sc = r.scores[i];
      s.push({ id: `score-${i}`, label: p.replicas > 1 ? `score #${i + 1}` : 'score', caption: fmt(bi('Оценка оставшихся: {s}. LeastAllocated выше там, где после пода останется больше свободного; ImageLocality добавляет за образ в кеше.', 'Scoring the rest: {s}. LeastAllocated is higher where more stays free after the pod; ImageLocality adds for an image in the cache.'), { s: Object.entries(sc).map(([k, v]) => `${k} ${v}`).join(', ') }), focus: ids.filter((_, j) => f[j].ok) });
      const j = NODES.findIndex((n) => n.name === best);
      used[j].cpu += p.cpu;
      used[j].mem += p.memory;
      scheduled++;
      s.push({ id: `bind-${i}`, label: `bind → ${best}`, caption: fmt(bi('Победил {n}: планировщик записывает Binding, у пода появляется nodeName: {n}. Событие Scheduled: «Successfully assigned default/web to {n}».', '{n} wins: the scheduler writes a Binding and the pod gets nodeName: {n}. The Scheduled event: "Successfully assigned default/web to {n}".'), { n: best }), focus: ['e-bind', ids[j]], tokens: [{ edge: 'e-bind', label: best }], values: { [ids[j]]: gauge(NODES[j], used[j].cpu, used[j].mem) }, states: { [ids[j]]: 'ok' }, metrics: { scheduled, unscheduled: p.replicas - scheduled } });
    }
    return s;
  },
  explainDelta(_prev, next, change, a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('Без планировщика под не получит узел никогда, и событий не будет.', 'Without a scheduler the pod never gets a node, and there are no events.') : bi('Планировщик вернулся и сразу берёт под из очереди.', 'The scheduler is back and takes the pod from the queue at once.');
    const r = schedule(b as P);
    const where = r.placements.map((x) => x ?? 'Pending').join(', ');
    switch (change.id) {
      case 'memory':
        return fmt(bi('requests.memory {a} → {b}Mi: {w}. Планировщик сравнивает запрос с allocatable минус уже запрошенное, а не с реальным потреблением.', 'requests.memory {a} → {b}Mi: {w}. The scheduler compares the request with allocatable minus what is already requested, not with real usage.'), { a: a.memory as number, b: b.memory as number, w: where });
      case 'cpu':
        return fmt(bi('requests.cpu {a} → {b}m: {w}.', 'requests.cpu {a} → {b}m: {w}.'), { a: a.cpu as number, b: b.cpu as number, w: where });
      case 'replicas':
        return fmt(bi('{n} подов подряд: {w}. Каждый Binding меняет занятость узла, поэтому LeastAllocated разносит поды по разным узлам.', '{n} pods in a row: {w}. Every Binding changes how full a node is, so LeastAllocated spreads the pods over the nodes.'), { n: b.replicas as number, w: where });
      case 'image':
        return b.image ? bi('Образ на worker-2: ImageLocality даёт ему +10, и при близких баллах он выигрывает.', 'The image on worker-2: ImageLocality gives it +10, and with close scores it wins.') : bi('Образа нигде нет: решают только свободные ресурсы.', 'The image is nowhere: only free resources decide.');
      case 'selector':
        return b.selector ? fmt(bi('nodeSelector disk=ssd: подходит только worker-3 (NodeAffinity отсеял остальные) → {w}.', 'nodeSelector disk=ssd: only worker-3 fits (NodeAffinity dropped the others) → {w}.'), { w: where }) : bi('Без nodeSelector подходят все узлы.', 'Without nodeSelector every node fits.');
      case 'taint':
        return b.taint ? fmt(bi('taint на worker-1: у пода нет подходящей toleration, TaintToleration его отсеял → {w}.', 'A taint on worker-1: the pod has no matching toleration, TaintToleration dropped it → {w}.'), { w: where }) : bi('Taint снят: worker-1 снова кандидат.', 'The taint is gone: worker-1 is a candidate again.');
    }
    return metric(next, 'unscheduled') ? bi('Часть подов осталась Pending.', 'Some pods stayed Pending.') : bi('Все поды получили узлы.', 'Every pod got a node.');
  },
});
