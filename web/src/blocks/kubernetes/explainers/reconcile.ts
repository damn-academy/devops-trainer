// Э2 (05 §6.3, R10): the reconcile loop. Desired state on the left (a
// ReplicaSet record in etcd), actual state on the right (pods), the loop in
// the middle: observe → compare → act. Interventions recompute the loop at
// once; "pause the controller" shows the level-triggered nature: three
// changes while it is paused cost one reconcile, not three.

import { defineModel } from '../../../core/define';
import { bi, fmt, t, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { D, edge, metric, node } from './kit';

type P = { replicas: number; event: string; paused: boolean };

/** What the ReplicaSet controller does, as numbers the steps and the tests share. */
export function reconcilePlan(p: P): { actual: number; created: number; deleted: number; adopted: number; released: number; reconciles: number; queued: number; note: string } {
  let actual = 3;
  let adopted = 0;
  let released = 0;
  let note = '';
  switch (p.event) {
    case 'delete':
      actual -= 1;
      note = 'a pod was deleted';
      break;
    case 'foreign':
      actual += 1;
      adopted = 1;
      note = 'a pod with matching labels appeared';
      break;
    case 'unlabel':
      actual -= 1;
      released = 1;
      note = 'a pod lost its label';
      break;
    case 'image':
      note = 'the image in the template changed';
      break;
  }
  const diff = p.replicas - actual;
  const events = p.paused ? 3 : p.event === 'none' ? 0 : 1;
  return {
    actual,
    created: Math.max(0, diff),
    deleted: Math.max(0, -diff),
    adopted,
    released,
    reconciles: p.paused ? 1 : Math.max(1, events),
    queued: p.paused ? 1 : events ? 1 : 0,
    note,
  };
}

export const reconcileModel = defineModel<P>({
  id: 'k8s.reconcile',
  block: 'k8s-1',
  title: bi('Цикл согласования: желаемое, фактическое, петля', 'The reconcile loop: desired, actual, the loop'),
  summary: bi('Контроллер ReplicaSet снова и снова сравнивает число подов в описании с числом подов в кластере и делает один шаг навстречу. Он смотрит на состояние, а не на события.', 'The ReplicaSet controller compares the number of pods in the description with the number of pods in the cluster again and again and takes one step towards it. It looks at the state, not at the events.'),
  concepts: ['k8s.controller', 'k8s.replicaset'],
  diagram: {
    width: 960,
    height: 460,
    nodes: [
      node('want', bi('ReplicaSet web', 'ReplicaSet web'), 'obj', 'doc', 24, 40, 220, 96, bi('Желаемое состояние: запись /registry/replicasets/default/web с полем spec.replicas и шаблоном пода. Каждая правка увеличивает resourceVersion.', 'The desired state: the record /registry/replicasets/default/web with spec.replicas and a pod template. Every edit raises the resourceVersion.'), bi('Вы (kubectl apply) или контроллер Deployment.', 'You (kubectl apply) or the Deployment controller.'), 'kubectl get rs web -o yaml', D.rs, 'replicas: 3'),
      node('etcd', 'etcd', 'store', 'box', 24, 200, 220, 52, bi('Здесь живёт желаемое: контроллер его не хранит, а читает.', 'This is where the desired state lives: the controller does not keep it, it reads it.'), bi('control plane', 'the control plane'), 'cluster etcd /registry/replicasets', D.components),
      node('api', 'kube-apiserver', 'cp', 'hex', 330, 40, 200, 56, bi('Раздаёт события watch и принимает записи. Контроллер видит мир только через него.', 'Sends watch events and accepts writes. The controller sees the world only through it.'), bi('control plane', 'the control plane'), 'kubectl get --raw /readyz', D.apiserver),
      node('cache', bi('информер: кэш', 'informer: cache'), 'cp', 'box', 330, 160, 200, 52, bi('Локальная копия объектов, которую поддерживает watch. Контроллер читает отсюда, а не дёргает API на каждый вопрос.', 'A local copy of the objects kept fresh by watch. The controller reads from here instead of asking the API every time.'), bi('библиотека client-go внутри контроллера', 'the client-go library inside the controller'), undefined, D.controller),
      node('queue', bi('очередь ключей', 'work queue'), 'cp', 'buffer', 330, 260, 200, 60, bi('Ключ default/web попадает сюда при любом изменении. Один и тот же ключ лежит в очереди один раз, сколько бы событий ни пришло.', 'The key default/web lands here on any change. The same key is in the queue once, however many events arrive.'), bi('контроллер', 'the controller'), undefined, D.controller, t(bi('ключей: 0', 'keys: 0'))),
      node('ctrl', bi('контроллер ReplicaSet', 'ReplicaSet controller'), 'cp', 'hex', 330, 370, 200, 60, bi('Петля: взять ключ, прочитать желаемое и фактическое, сравнить, сделать шаг. Ничего не помнит между проходами.', 'The loop: take a key, read desired and actual, compare, take a step. It remembers nothing between passes.'), bi('kube-controller-manager', 'kube-controller-manager'), 'kubectl describe rs web', D.controller),
      node('pods', bi('поды app=web', 'pods app=web'), 'process', 'buffer', 680, 200, 250, 70, bi('Фактическое состояние: поды с метками, которые выбирает селектор ReplicaSet, и ownerReference на него.', 'The actual state: pods with the labels the ReplicaSet selector picks and an ownerReference to it.'), bi('сам контроллер ReplicaSet (create pod)', 'the ReplicaSet controller itself (create pod)'), 'kubectl get pods -l app=web --show-labels', D.rs, '3 / 3'),
    ],
    edges: [
      edge('e-store', 'want', 'etcd', bi('хранится в /registry/…', 'stored as /registry/…'), bi('Желаемое хранится в etcd, а не в памяти контроллера.', 'The desired state is stored in etcd, not in the controller memory.'), bi('kube-apiserver', 'kube-apiserver')),
      edge('e-watch', 'api', 'cache', 'watch', bi('Поток событий ADDED/MODIFIED/DELETED с указанного resourceVersion.', 'A stream of ADDED/MODIFIED/DELETED events from a given resourceVersion.'), bi('client-go', 'client-go')),
      edge('e-key', 'cache', 'queue', bi('в очередь: default/web', 'enqueue default/web'), bi('Событие превращается в ключ объекта — не в «что изменилось».', 'An event becomes the object key — not "what changed".'), bi('обработчик информера', 'the informer handler')),
      edge('e-take', 'queue', 'ctrl', bi('взять ключ', 'take key'), bi('Воркер берёт ключ и вызывает reconcile.', 'A worker takes the key and calls reconcile.'), bi('контроллер', 'the controller')),
      edge('e-act', 'ctrl', 'api', bi('создать / удалить под', 'create / delete pod'), bi('Действие — обычный запрос к API: создать или удалить под.', 'The action is an ordinary API request: create or delete a pod.'), bi('контроллер', 'the controller'), { via: [[600, 400], [600, 68]], labelAt: 0.35 }),
      edge('e-observe', 'pods', 'api', bi('поды (watch)', 'pods (watch)'), bi('Поды тоже приходят через watch: так контроллер видит фактическое.', 'Pods also come through watch: that is how the controller sees the actual state.'), bi('kube-apiserver', 'kube-apiserver'), { via: [[805, 68]], labelAt: 0.5 }),
      edge('e-desired', 'want', 'api', 'spec.replicas', bi('Желаемое контроллер читает из того же API.', 'The controller reads the desired state from the same API.'), bi('kube-apiserver', 'kube-apiserver')),
    ],
  },
  params: [
    {
      id: 'replicas',
      label: bi('spec.replicas', 'spec.replicas'),
      kind: 'range',
      min: 0,
      max: 10,
      step: 1,
      default: 3,
      near: 'want',
      predict: {
        prompt: bi('Желаемое уменьшили. Какие поды контроллер удалит первыми?', 'The desired count went down. Which pods does the controller delete first?'),
        options: [
          { id: 'young', text: bi('Неготовые и самые молодые', 'Not-ready and the youngest') },
          { id: 'old', text: bi('Самые старые', 'The oldest') },
          { id: 'random', text: bi('Случайные', 'Random ones') },
        ],
        resolve: () => 'young',
      },
    },
    {
      id: 'event',
      label: bi('Вмешательство', 'Intervention'),
      kind: 'choice',
      default: 'none',
      options: [
        { id: 'none', label: bi('нет', 'none') },
        { id: 'delete', label: bi('удалить под', 'delete a pod') },
        { id: 'foreign', label: bi('создать «чужой» под с app=web', 'create a "foreign" pod with app=web') },
        { id: 'unlabel', label: bi('снять метку app с пода', 'remove the app label from a pod') },
        { id: 'image', label: bi('сменить образ в ReplicaSet', 'change the image in the ReplicaSet') },
      ],
      near: 'pods',
      predict: {
        prompt: bi('Что сделает контроллер после этого вмешательства?', 'What will the controller do after this intervention?'),
        options: [
          { id: 'create', text: bi('Создаст под', 'Create a pod') },
          { id: 'delete', text: bi('Удалит под', 'Delete a pod') },
          { id: 'nothing', text: bi('Ничего не сделает с подами', 'Do nothing to the pods') },
        ],
        resolve: (_p, n) => (metric(n, 'created') > 0 ? 'create' : metric(n, 'deleted') > 0 ? 'delete' : 'nothing'),
      },
    },
    {
      id: 'paused',
      label: bi('Контроллер на паузе, пока происходят 3 изменения', 'The controller is paused while 3 changes happen'),
      kind: 'toggle',
      default: false,
      near: 'queue',
      levels: ['intermediate', 'experienced'],
      predict: {
        prompt: bi('Пока контроллер стоял, пришли три события. Сколько раз он вызовет reconcile, когда проснётся?', 'Three events arrived while the controller was stopped. How many times will it call reconcile when it wakes up?'),
        options: [
          { id: 'one', text: bi('Один раз', 'Once') },
          { id: 'three', text: bi('Три раза, по разу на событие', 'Three times, once per event') },
        ],
        resolve: (_p, n) => (metric(n, 'reconciles') === 1 ? 'one' : 'three'),
      },
    },
  ],
  breaks: [
    {
      id: 'no-cm',
      label: bi('Остановить kube-controller-manager', 'Stop kube-controller-manager'),
      remove: ['ctrl', 'e-take', 'e-act'],
      boundary: 'process',
      predict: { prompt: bi('Контроллер остановлен, а под удалили. Вернётся ли он?', 'The controller is stopped and a pod was deleted. Will it come back?'), options: [{ id: 'no', text: bi('Нет: разницу никто не исправляет', 'No: nobody fixes the difference') }, { id: 'yes', text: bi('Да, API-сервер помнит, что подов три', 'Yes, the API server remembers there are three') }], resolve: (_p, n) => (n.some((s) => s.broken) ? 'no' : 'yes') },
    },
  ],
  metrics: [
    { id: 'reconciles', label: bi('вызовов reconcile', 'reconcile calls') },
    { id: 'created', label: bi('создано подов', 'pods created') },
    { id: 'deleted', label: bi('удалено подов', 'pods deleted') },
  ],
  run(p, broken): Step[] {
    const plan = reconcilePlan(p);
    const s: Step[] = [];
    const want = p.replicas;
    const show = (n: number) => `${n} / ${want}`;
    const fill = (n: number) => (want ? Math.min(1, n / Math.max(want, 1)) : n ? 1 : 0);
    s.push({ id: 'state', label: bi('состояние', 'state'), caption: fmt(bi('Желаемое: replicas {w} в etcd. Фактическое: {a} подов с меткой app=web и ownerReference на ReplicaSet.', 'Desired: replicas {w} in etcd. Actual: {a} pods with the app=web label and an ownerReference to the ReplicaSet.'), { w: want, a: 3 }), focus: ['want', 'pods'], values: { want: `replicas: ${want}`, pods: show(3), queue: t(bi('ключей: 0', 'keys: 0')) }, fill: { pods: fill(3), queue: 0 }, metrics: { reconciles: 0, created: 0, deleted: 0 } });
    if (p.event !== 'none') {
      const ev: Record<string, Bi> = {
        delete: bi('Кто-то удалил под: подов с меткой стало 2. API-сервер разослал событие DELETED.', 'Someone deleted a pod: there are 2 labelled pods now. The API server sent a DELETED event.'),
        foreign: bi('Создан под с app=web без хозяина: он подходит под селектор — контроллер его усыновит (допишет ownerReference).', 'A pod with app=web and no owner was created: it matches the selector — the controller adopts it (adds an ownerReference).'),
        unlabel: bi('С пода сняли метку app: селектор его больше не выбирает, контроллер его отпускает — под живёт дальше сиротой.', 'The app label was removed from a pod: the selector no longer picks it, the controller releases it — the pod lives on as an orphan.'),
        image: bi('В шаблоне ReplicaSet сменили образ. Число подов не изменилось.', 'The image in the ReplicaSet template changed. The number of pods did not change.'),
      };
      s.push({ id: 'event', label: bi('событие', 'event'), caption: ev[p.event], focus: ['pods', 'e-observe'], tokens: [{ edge: 'e-observe', label: p.event === 'image' ? 'MODIFIED rs' : 'pod event' }], values: { pods: show(plan.actual) }, fill: { pods: fill(plan.actual) } });
    }
    if (p.paused) s.push({ id: 'burst', label: bi('3 события', '3 events'), caption: bi('Пока контроллер на паузе, приходят ещё изменения. Информер обновляет кэш каждый раз, но в очереди по-прежнему один ключ default/web.', 'While the controller is paused, more changes arrive. The informer updates its cache every time, but the queue still holds one key, default/web.'), focus: ['cache', 'queue'], tokens: [{ edge: 'e-watch' }, { edge: 'e-key' }], values: { queue: t(bi('ключей: 1', 'keys: 1')) }, fill: { queue: 0.2 } });
    else s.push({ id: 'watch', label: 'watch', caption: bi('Информер получил событие watch, обновил кэш и положил в очередь ключ default/web.', 'The informer got the watch event, updated its cache and put the key default/web into the queue.'), focus: ['e-watch', 'cache', 'e-key', 'queue'], tokens: [{ edge: 'e-watch' }, { edge: 'e-key', label: 'default/web' }], values: { queue: t(bi('ключей: 1', 'keys: 1')) }, fill: { queue: 0.2 } });
    if (broken.has('no-cm')) {
      s.push({ id: 'stuck', label: bi('стоит', 'stuck'), caption: bi('Ключ лежит в очереди, но брать его некому.', 'The key sits in the queue, but nobody takes it.'), focus: ['queue', 'ctrl'], states: { ctrl: 'off' }, metrics: { reconciles: 0, created: 0, deleted: 0 }, broken: { at: 'ctrl', message: `$ kubectl get rs web\nNAME   DESIRED   CURRENT   READY   AGE\nweb    ${want}         ${plan.actual}         ${plan.actual}       4d`, caption: bi('без controller-manager желаемое и фактическое расходятся навсегда: объект в etcd сам ничего не делает.', 'without the controller-manager desired and actual stay apart forever: an object in etcd does nothing by itself.') } });
      return s;
    }
    s.push({ id: 'take', label: bi('ключ', 'key'), caption: p.paused ? bi('Контроллер проснулся и взял ключ один раз: он не проигрывает события, он смотрит на то, что есть сейчас.', 'The controller woke up and took the key once: it does not replay events, it looks at what is there now.') : bi('Воркер взял ключ default/web и вызвал reconcile.', 'A worker took the key default/web and called reconcile.'), focus: ['e-take', 'ctrl'], tokens: [{ edge: 'e-take', label: 'default/web' }], values: { queue: t(bi('ключей: 0', 'keys: 0')) }, fill: { queue: 0 }, states: { ctrl: 'on' } });
    const diff = want - plan.actual;
    const cmp =
      p.event === 'image'
        ? bi('Сравнение: желаемо {w}, есть {a}. Петля считает только количество — образ живых подов она не трогает.', 'Compare: desired {w}, actual {a}. The loop counts only the number — it does not touch the image of live pods.')
        : diff > 0
          ? bi('Сравнение: желаемо {w}, есть {a}, разница +{d} → создать.', 'Compare: desired {w}, actual {a}, difference +{d} → create.')
          : diff < 0
            ? bi('Сравнение: желаемо {w}, есть {a}, разница {d} → удалить лишние.', 'Compare: desired {w}, actual {a}, difference {d} → delete the extra ones.')
            : bi('Сравнение: желаемо {w}, есть {a}, разницы нет — петля ничего не делает и всё равно продолжает смотреть.', 'Compare: desired {w}, actual {a}, no difference — the loop does nothing and keeps watching anyway.');
    s.push({ id: 'compare', label: bi('сравнить', 'compare'), caption: fmt(cmp, { w: want, a: plan.actual, d: diff }), focus: ['ctrl', 'want', 'pods'], values: { ctrl: `${want} − ${plan.actual} = ${diff}` } });
    if (plan.adopted || plan.released)
      s.push({ id: 'owner', label: 'ownerRef', caption: plan.adopted ? bi('Сначала усыновление: контроллер дописал чужому поду ownerReference — теперь он считается своим.', 'Adoption first: the controller added an ownerReference to the foreign pod — it now counts as its own.') : bi('Сначала освобождение: контроллер убрал ownerReference у пода без метки — теперь у него нет хозяина.', 'Release first: the controller removed the ownerReference from the pod without the label — it has no owner now.'), focus: ['e-act', 'pods'], tokens: [{ edge: 'e-act', label: 'PATCH ownerReferences' }] });
    if (plan.created) s.push({ id: 'act', label: bi('создать', 'create'), caption: fmt(bi('Действие: {n} × create pod по шаблону. Поды появятся с новыми именами и новыми IP.', 'Act: {n} × create pod from the template. The pods appear with new names and new IPs.'), { n: plan.created }), focus: ['e-act', 'pods'], tokens: [{ edge: 'e-act', label: `${plan.created} × create pod` }], values: { pods: show(want) }, fill: { pods: fill(want) } });
    else if (plan.deleted) s.push({ id: 'act', label: bi('удалить', 'delete'), caption: fmt(bi('Действие: удалить {n}. Первыми уходят поды без узла, затем неготовые, затем самые молодые — чтобы не трогать работающие.', 'Act: delete {n}. Pods without a node go first, then not-ready ones, then the youngest — so that working pods stay.'), { n: plan.deleted }), focus: ['e-act', 'pods'], tokens: [{ edge: 'e-act', label: `${plan.deleted} × delete pod` }], values: { pods: show(want) }, fill: { pods: fill(want) } });
    s.push({ id: 'again', label: bi('снова', 'again'), caption: bi('Записи контроллера сами вызывают новые события — и новый проход. Теперь разницы нет: петля продолжает смотреть, всегда.', 'The controller’s own writes cause new events — and a new pass. Now there is no difference: the loop keeps watching, always.'), focus: ['ctrl', 'e-observe'], states: { ctrl: 'ok' }, metrics: { reconciles: plan.reconciles + (plan.created || plan.deleted ? 1 : 0), created: plan.created, deleted: plan.deleted } });
    return s;
  },
  explainDelta(_prev, next, change, a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('Контроллер остановлен: ключ лежит в очереди, разница не исправляется.', 'The controller is stopped: the key sits in the queue, the difference is not fixed.') : bi('Контроллер снова работает: он сразу посмотрит на текущее состояние.', 'The controller runs again: it looks at the current state at once.');
    const pl = reconcilePlan(b as P);
    switch (change.id) {
      case 'replicas': {
        const d = (b.replicas as number) - pl.actual;
        const ru = pl.created ? `создаёт ${pl.created}` : pl.deleted ? `удаляет ${pl.deleted}` : 'ничего не делает';
        const en = pl.created ? `creates ${pl.created}` : pl.deleted ? `deletes ${pl.deleted}` : 'does nothing';
        return bi(`replicas ${a.replicas} → ${b.replicas}: разница ${d} — контроллер ${ru}.`, `replicas ${a.replicas} → ${b.replicas}: difference ${d} — the controller ${en}.`);
      }
      case 'event':
        return b.event === 'image' ? bi('Смена образа не меняет число подов: ReplicaSet её «не замечает». Для замены подов нужен Deployment.', 'An image change does not change the number of pods: the ReplicaSet "does not notice" it. Replacing pods needs a Deployment.') : fmt(bi('Вмешательство изменило фактическое: стало {a}, контроллер выравнивает до {w}.', 'The intervention changed the actual state: now {a}, the controller levels it to {w}.'), { a: pl.actual, w: b.replicas as number });
      case 'paused':
        return b.paused ? fmt(bi('Три события — один вызов reconcile: {n}. Важно состояние, а не история.', 'Three events — one reconcile call: {n}. The state matters, not the history.'), { n: metric(next, 'reconciles') }) : bi('Без паузы каждое изменение обрабатывается сразу.', 'Without the pause every change is handled at once.');
    }
    return bi('Петля пересчитана.', 'The loop is recomputed.');
  },
});

