// Э2 (05 §6.3, R10): the reconcile loop. Desired state on the left (a
// ReplicaSet record in etcd), actual state on the right (pods), the loop in
// the middle: observe → compare → act. Interventions recompute the loop at
// once; "pause the controller" shows the level-triggered nature: three
// changes while it is paused cost one reconcile, not three.
//
// Reading order: at first only the ReplicaSet, the controller and the pods
// are on screen. You, the API server, the informer's cache and the queue
// appear when a change travels through them; every acting block says what it
// does, and what is handed on is a card on the line.

import { defineModel } from '../../../core/define';
import { bi, fmt, t, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { box, D, edge, fmtb, idsOf, LEGEND_BASE, mark, metric, num, only, PODS } from './kit';

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

const CP = bi('Работает на управляющем узле кластера, в составе управляющего слоя (control plane).', 'Runs on the control-plane node.');

const diagram = {
  width: 960,
  height: 500,
  nodes: [
    box('want', bi('ReplicaSet web: желаемое', 'ReplicaSet web: desired'), 'obj', 'doc', [24, 40, 240, 88], 'file', bi('Объект ReplicaSet описывает желаемое: сколько подов должно работать (поле `spec.replicas`), какие поды считать своими (`selector`, здесь app=web) и из какого шаблона делать новые (`template`).', 'The ReplicaSet object describes the desired state: how many pods (`spec.replicas`), which pods are its own (`selector`, app=web) and the template for new ones.'), bi('Объект создаёте вы командой `kubectl apply` или контроллер Deployment.', 'You create it with `kubectl apply`, or the Deployment controller does.'), { see: 'kubectl get rs web -o yaml', doc: D.rs, sub: 'replicas: 3' }),
    box('etcd', 'etcd', 'store', 'box', [24, 190, 240, 60], 'database', bi('Хранилище «ключ — значение», в котором кластер хранит все объекты. ReplicaSet web лежит в нём по ключу `/registry/replicasets/default/web`, поэтому контроллер можно перезапустить, и он прочитает желаемое заново.', 'The key–value store holding every object; ReplicaSet web is at `/registry/replicasets/default/web`, so a restarted controller reads it again.'), CP, { see: 'cluster etcd /registry/replicasets', doc: D.components }),
    box('you', bi('Вы, kubectl', 'You, kubectl'), 'user', 'box', [24, 400, 240, 64], 'terminal', bi('Вы меняете кластер командами kubectl: удаляете под, меняете метку или число реплик. Что именно вы делаете, выбирает ручка «Что вы делаете с подами».', 'You change the cluster with kubectl commands; the knob “What you do to the pods” picks which.'), bi('Команды набираете вы в терминале.', 'You type them.'), { see: 'kubectl get pods' }),
    box('api', 'kube-apiserver', 'cp', 'hex', [340, 40, 230, 64], 'server', bi('API-сервер принимает все изменения, записывает их в etcd и рассылает события всем, кто на них подписан. Контроллер видит кластер только через него.', 'Accepts every change, writes it to etcd and sends events to subscribers. The controller sees the cluster only through it.'), CP, { see: 'kubectl get --raw /readyz', doc: D.apiserver }),
    box('cache', bi('Кэш информера', 'Informer cache'), 'cp', 'box', [340, 166, 230, 56], 'disk', bi('Копия объектов в памяти контроллера. Её обновляют события watch, поэтому контроллер читает объекты отсюда и не спрашивает API-сервер на каждый вопрос.', 'An in-memory copy kept fresh by watch events; the controller reads from it instead of asking the API server.'), bi('Кэш ведёт библиотека client-go внутри контроллера.', 'Kept by the client-go library inside the controller.'), { doc: D.controller }),
    box('queue', bi('Очередь ключей', 'Work queue'), 'cp', 'buffer', [340, 278, 230, 64], 'folder', bi('Очередь имён объектов, которые нужно проверить. При любом изменении сюда попадает ключ default/web, и один и тот же ключ лежит в очереди только один раз, сколько бы событий ни пришло.', 'Names of objects to check. Any change puts the key default/web here, and the same key is queued only once.'), bi('Очередь ведёт сам контроллер.', 'Kept by the controller.'), { doc: D.controller, sub: 'keys: 0' }),
    box('ctrl', bi('Контроллер ReplicaSet', 'ReplicaSet controller'), 'cp', 'hex', [340, 404, 230, 64], 'process', bi('Петля, которая берёт ключ из очереди, сравнивает желаемое число подов с фактическим и делает один шаг навстречу: создаёт или удаляет под. Между проходами контроллер ничего не помнит.', 'A loop: take a key, compare desired with actual, take one step. It remembers nothing between passes.'), bi('Контроллер работает внутри процесса kube-controller-manager.', 'Runs inside kube-controller-manager.'), { see: 'kubectl describe rs web', doc: D.controller }),
    box('pods', bi('Поды app=web: фактическое', 'Pods app=web: actual'), 'process', 'buffer', [690, 210, 250, 90], 'container', bi('Фактическое состояние: поды с меткой app=web, у которых в `ownerReferences` записан ReplicaSet web.', 'The actual state: pods labelled app=web with ReplicaSet web in `ownerReferences`.'), bi('Поды создаёт контроллер ReplicaSet, а запускает их kubelet на узлах.', 'The controller creates them; the kubelet on a node runs them.'), { see: 'kubectl get pods -l app=web --show-labels', doc: D.rs, sub: '3 / 3' }),
  ],
  edges: [
    edge('e-store', 'want', 'etcd', bi('хранится в etcd', 'stored in etcd'), bi('Объект ReplicaSet хранится в etcd, а не в памяти контроллера.', 'The ReplicaSet is stored in etcd, not in the controller’s memory.'), bi('Записывает его kube-apiserver.', 'kube-apiserver writes it.')),
    edge('e-you', 'you', 'api', bi('ваша команда', 'your command'), bi('Каждая команда kubectl превращается в запрос к API-серверу.', 'Every kubectl command becomes a request to the API server.'), bi('Запрос отправляет kubectl.', 'kubectl sends it.'), { via: [[300, 432], [300, 88]], labelAt: 0.5 }),
    edge('e-watch', 'api', 'cache', bi('события watch', 'watch events'), bi('Поток событий ADDED, MODIFIED и DELETED, на который подписан контроллер.', 'The stream of ADDED/MODIFIED/DELETED events the controller subscribes to.'), bi('События рассылает kube-apiserver.', 'kube-apiserver sends them.')),
    edge('e-key', 'cache', 'queue', bi('ключ объекта', 'object key'), bi('Событие превращается в имя объекта, который нужно проверить, а не в описание того, что изменилось.', 'An event becomes the name of the object to check, not a description of the change.'), bi('Ключ кладёт обработчик информера.', 'The informer handler.')),
    edge('e-take', 'queue', 'ctrl', bi('взять ключ', 'take a key'), bi('Контроллер берёт ключ и начинает проход петли для этого объекта.', 'The controller takes a key and runs one pass for that object.'), bi('Ключ берёт контроллер.', 'The controller.')),
    edge('e-act', 'ctrl', 'api', bi('создать или удалить под', 'create or delete a pod'), bi('Действие контроллера — обычный запрос к API-серверу, такой же, как ваш.', 'The controller’s action is an ordinary API request, just like yours.'), bi('Запрос отправляет контроллер.', 'The controller.'), { via: [[630, 436], [630, 90]], labelAt: 0.35 }),
    edge('e-pods', 'api', 'pods', bi('новые и удалённые поды', 'pods added and removed'), bi('Поды — тоже объекты API: когда API-сервер принимает запрос на создание или удаление, фактическое состояние меняется.', 'Pods are API objects too; when the API server accepts a create or delete, the actual state changes.'), bi('Изменение принимает kube-apiserver.', 'kube-apiserver.'), { via: [[815, 60]], labelAt: 0.6 }),
  ],
};

const ALL = idsOf(diagram);

const EVENT: Record<string, { cmd: string; api: string; say: Bi; caption: Bi }> = {
  delete: {
    cmd: 'kubectl delete pod web-x7k2p',
    api: 'DELETED pod',
    say: bi('Вы удаляете один из трёх подов ReplicaSet web.', 'You delete one of the three pods.'),
    caption: bi('Вы удаляете один под командой `kubectl delete pod`. Подов с меткой app=web становится два, а в ReplicaSet по-прежнему записано, что их должно быть три.', 'You delete a pod: two are left, while the ReplicaSet still says three.'),
  },
  foreign: {
    cmd: 'kubectl run extra --labels app=web',
    api: 'ADDED pod',
    say: bi('Вы создаёте отдельный под с меткой app=web, у которого нет хозяина.', 'You create a separate pod with app=web and no owner.'),
    caption: bi('Вы создаёте отдельный под с меткой app=web. Хозяина у него нет, но под селектор ReplicaSet он подходит, поэтому подов с меткой становится четыре.', 'You create a pod with app=web and no owner; it matches the selector, so there are four.'),
  },
  unlabel: {
    cmd: 'kubectl label pod web-x7k2p app-',
    api: 'MODIFIED pod',
    say: bi('Вы снимаете с одного пода метку app.', 'You remove the app label from one pod.'),
    caption: bi('Вы снимаете с одного пода метку app. Сам под продолжает работать, но селектор ReplicaSet его больше не выбирает, поэтому подов с меткой app=web становится два.', 'You remove the app label from a pod: it keeps running, but the selector no longer picks it, so two are left.'),
  },
  image: {
    cmd: 'kubectl set image rs/web web=trainer/web:1.1',
    api: 'MODIFIED rs',
    say: bi('Вы меняете образ в шаблоне ReplicaSet на trainer/web:1.1.', 'You change the template image to trainer/web:1.1.'),
    caption: bi('Вы меняете образ в шаблоне ReplicaSet на `trainer/web:1.1`. Число подов от этого не меняется, а три работающих пода остаются на старом образе.', 'You change the template image; the number of pods stays, and the three running pods keep the old image.'),
  },
};

export const reconcileModel = defineModel<P>({
  id: 'k8s.reconcile',
  block: 'k8s-1',
  title: bi('Как контроллер ReplicaSet держит число подов', 'How the ReplicaSet controller keeps the number of pods'),
  summary: bi(
    'Слева записано желаемое: ReplicaSet web хочет три пода. Справа фактическое: поды, которые работают на самом деле. Посередине петля контроллера, которая узнаёт об изменениях, сравнивает одно с другим и делает шаг, чтобы разница исчезла. Контроллеру неважно, что именно произошло: он каждый раз смотрит на то, что есть сейчас.',
    'On the left the desired state: ReplicaSet web wants three pods. On the right the actual state. In the middle the controller’s loop learns of changes, compares and takes a step to close the difference. It does not care what happened: it looks at what is there now.',
  ),
  intro: bi(
    'Сейчас на схеме три блока: ReplicaSet с желаемым числом подов, контроллер и сами поды. Нажмите «Начать: шаг вперёд», а дальше листайте кнопкой «Шаг вперёд». Вы удалите один под, и схема покажет, как это изменение доходит до контроллера и как он возвращает под. Потом выберите в «Параметрах» другое вмешательство или другое число реплик.',
    'For now the diagram shows three blocks: the ReplicaSet, the controller and the pods. Press “Start: step forward”, then go on with “Step forward”. You will delete a pod and see how the change reaches the controller and how it brings the pod back. Then pick another intervention or another replica count in “Parameters”.',
  ),
  legend: [
    ...LEGEND_BASE,
    mark('icon:file', 'объект с желаемым состоянием', 'an object with the desired state'),
    mark('icon:container', 'поды, фактическое состояние', 'pods, the actual state'),
    mark('icon:process', 'контроллер', 'the controller'),
    mark('icon:server', 'API-сервер', 'the API server'),
    mark('icon:database', 'хранилище etcd', 'etcd'),
    mark('ok', 'разницы больше нет', 'no difference left'),
    mark('err', 'компонент не работает', 'a component is down'),
  ],
  stopLabel: bi('Петля остановилась', 'The loop stopped'),
  concepts: ['k8s.controller', 'k8s.replicaset'],
  diagram,
  params: [
    {
      id: 'event',
      label: bi('Что вы делаете с подами', 'What you do to the pods'),
      kind: 'choice',
      default: 'delete',
      group: bi('Вмешательство', 'The intervention'),
      options: [
        { id: 'none', label: bi('ничего', 'nothing') },
        { id: 'delete', label: bi('удаляю один под', 'delete a pod') },
        { id: 'foreign', label: bi('создаю отдельный под с меткой app=web', 'create a separate pod with app=web') },
        { id: 'unlabel', label: bi('снимаю с пода метку app', 'remove the app label from a pod') },
        { id: 'image', label: bi('меняю образ в шаблоне ReplicaSet', 'change the image in the template') },
      ],
      near: 'you',
      predict: {
        prompt: bi('Вы выбрали другое вмешательство, а в ReplicaSet по-прежнему записано то же число реплик. Что сделает контроллер с подами, когда сравнит желаемое с фактическим?', 'Another intervention; the replica count is the same. What will the controller do to the pods after comparing?'),
        options: [
          { id: 'create', text: bi('Создаст недостающий под', 'Create a missing pod') },
          { id: 'delete', text: bi('Удалит лишний под', 'Delete an extra pod') },
          { id: 'nothing', text: bi('Ничего не сделает с подами', 'Do nothing to the pods') },
        ],
        resolve: (_p, n) => (metric(n, 'created') > 0 ? 'create' : metric(n, 'deleted') > 0 ? 'delete' : 'nothing'),
      },
    },
    {
      id: 'replicas',
      label: bi('Сколько подов записано в ReplicaSet (spec.replicas)', 'Pods in the ReplicaSet (spec.replicas)'),
      kind: 'range',
      min: 0,
      max: 10,
      step: 1,
      default: 3,
      group: bi('Вмешательство', 'The intervention'),
      near: 'want',
      predict: {
        prompt: bi('Вы меняете число подов в ReplicaSet, и это тоже изменение, о котором узнает контроллер. Что он сделает с подами, когда сравнит новое число с тем, сколько подов работает?', 'You change spec.replicas. What will the controller do to the pods when it compares the new number with what runs?'),
        options: [
          { id: 'create', text: bi('Создаст недостающие поды', 'Create the missing pods') },
          { id: 'delete', text: bi('Удалит лишние поды', 'Delete the extra pods') },
          { id: 'nothing', text: bi('Ничего не сделает с подами', 'Do nothing to the pods') },
        ],
        resolve: (_p, n) => (metric(n, 'created') > 0 ? 'create' : metric(n, 'deleted') > 0 ? 'delete' : 'nothing'),
      },
    },
    {
      id: 'paused',
      label: bi('Контроллер стоит минуту, и за это время поды меняются трижды', 'The controller is stopped for a minute while the pods change three times'),
      kind: 'toggle',
      default: false,
      group: bi('Контроллер', 'The controller'),
      near: 'queue',
      levels: ['intermediate', 'experienced'],
      predict: {
        prompt: bi('Контроллер стоял минуту, и за это время поды ReplicaSet web менялись трижды. Сколько раз контроллер выполнит проход петли для ReplicaSet web, когда снова заработает?', 'The controller was stopped while the pods changed three times. How many passes for ReplicaSet web will it run when it is back?'),
        options: [
          { id: 'one', text: bi('Один раз: в очереди лежит один ключ default/web', 'Once: there is one key in the queue') },
          { id: 'three', text: bi('Три раза, по разу на каждое изменение', 'Three times, once per change') },
        ],
        resolve: (_p, n) => (metric(n, 'reconciles') === 1 ? 'one' : 'three'),
      },
    },
  ],
  breaks: [
    {
      id: 'no-cm',
      label: bi('kube-controller-manager остановлен, и петли контроллеров не работают', 'kube-controller-manager is stopped; no controller loop runs'),
      remove: ['ctrl', 'e-take', 'e-act'],
      boundary: 'process',
      predict: {
        prompt: bi('Процесс kube-controller-manager остановлен, а API-сервер и etcd работают. Исправит ли кто-нибудь разницу между желаемым и фактическим числом подов?', 'kube-controller-manager is stopped; the API server and etcd run. Will anyone fix the difference between desired and actual?'),
        options: [
          { id: 'no', text: bi('Нет: разница останется, пока контроллер не запустят снова', 'No: it stays until the controller runs again') },
          { id: 'yes', text: bi('Да: API-сервер сам создаст недостающие поды', 'Yes: the API server creates the missing pods itself') },
        ],
        resolve: (_p, n) => (n.some((s) => s.broken) ? 'no' : 'yes'),
      },
    },
  ],
  metrics: [
    { id: 'reconciles', label: bi('проходов петли для ReplicaSet web', 'loop passes for ReplicaSet web') },
    { id: 'created', label: bi('подов создано', 'pods created') },
    { id: 'deleted', label: bi('подов удалено', 'pods deleted') },
  ],
  run(p, broken): Step[] {
    const plan = reconcilePlan(p);
    const s: Step[] = [];
    const want = p.replicas;
    const show = (n: number) => `${n} / ${want}`;
    const fill = (n: number) => (want ? Math.min(1, n / Math.max(want, 1)) : n ? 1 : 0);
    const keys = (n: number) => t(bi(`ключей: ${n}`, `keys: ${n}`));
    const zero = { reconciles: 0, created: 0, deleted: 0 };
    const ev = EVENT[p.event];
    const scaled = want !== 3;
    s.push({
      id: 'want',
      label: bi('желаемое', 'desired'),
      caption: bi('Слева записано желаемое состояние. ReplicaSet web хочет, чтобы работали три пода с меткой app=web, и знает шаблон, по которому их создавать. Сам объект ничего не делает: это только запись.', 'On the left the desired state: ReplicaSet web wants three pods with app=web and knows their template. The object itself does nothing: it is a record.'),
      focus: ['want'],
      say: { want: bi('ReplicaSet web хранит желаемое: три пода по шаблону с меткой app=web.', 'ReplicaSet web holds the desired state: three pods with app=web.') },
      states: only(ALL, 'want', 'ctrl', 'pods'),
      values: { want: 'replicas: 3', pods: '3 / 3', queue: keys(0) },
      fill: { pods: 1, queue: 0 },
      metrics: zero,
    });
    s.push({
      id: 'actual',
      label: bi('фактическое', 'actual'),
      caption: bi('Справа фактическое состояние: три работающих пода. У каждого в поле `ownerReferences` записан хозяин, ReplicaSet web, поэтому контроллер считает эти поды своими. Пока желаемое и фактическое совпадают, контроллеру делать нечего.', 'On the right the actual state: three running pods, each with ReplicaSet web in `ownerReferences`. While desired and actual match, the controller has nothing to do.'),
      focus: ['pods'],
      say: { pods: bi('Работают три пода с меткой app=web, и хозяин у каждого ReplicaSet web.', 'Three pods with app=web run, each owned by ReplicaSet web.') },
      metrics: zero,
    });
    const change = (id: string, label: Bi, cmd: string, say: Bi, caption: Bi, values: Record<string, string>, fills: Record<string, number>, firstChange: boolean) => {
      s.push({
        id,
        label,
        caption,
        focus: ['you', 'e-you'],
        reveal: firstChange ? ['you', 'api', 'e-you', 'e-pods', 'etcd', 'e-store'] : [],
        tokens: [{ edge: 'e-you', label: cmd }],
        say: { you: say },
        values,
        fill: fills,
        metrics: zero,
      });
    };
    if (scaled)
      change(
        'scale',
        bi('replicas', 'replicas'),
        `kubectl scale rs web --replicas=${want}`,
        fmt(bi('Вы меняете желаемое: теперь подов должно быть {w}.', 'You change the desired count to {w}.'), { w: want }),
        fmt(bi('Вы меняете желаемое командой `kubectl scale`: теперь ReplicaSet web хочет {w} подов. API-сервер записывает новое число в etcd, но поды от этого сами не появятся и не исчезнут.', 'You run `kubectl scale`: ReplicaSet web now wants {w}. The API server stores it in etcd, but no pod appears or disappears by itself.'), { w: want }),
        { want: `replicas: ${want}`, pods: show(3) },
        { pods: fill(3) },
        true,
      );
    if (ev) change('event', bi('вмешательство', 'intervention'), ev.cmd, ev.say, ev.caption, { pods: show(plan.actual) }, { pods: fill(plan.actual) }, !scaled);
    const changed = scaled || !!ev;
    if (changed) {
      s.push({
        id: 'notify',
        label: 'watch',
        caption: bi('API-сервер принимает изменение, сохраняет его в etcd и отправляет событие всем, кто подписан на поды и ReplicaSet. Контроллер подписан, и событие приходит в кэш информера, то есть в копию объектов, которую контроллер держит у себя в памяти.', 'The API server accepts the change, stores it in etcd and sends an event to every subscriber; it arrives in the informer cache, the controller’s in-memory copy.'),
        focus: ['api', 'e-watch'],
        reveal: ['cache', 'e-watch'],
        tokens: [{ edge: 'e-watch', label: ev ? ev.api : 'MODIFIED rs' }],
        say: { api: bi('API-сервер записывает изменение в etcd и рассылает событие подписчикам.', 'The API server stores the change in etcd and sends an event to subscribers.') },
        metrics: zero,
      });
      s.push({
        id: 'enqueue',
        label: bi('в очередь', 'enqueue'),
        caption: bi('Информер обновляет свою копию и кладёт в очередь не само событие, а только имя объекта, который нужно проверить: default/web. Что именно изменилось, контроллер узнает сам, когда посмотрит на объекты.', 'The informer updates its copy and queues only the name of the object to check, default/web, not the event.'),
        focus: ['cache', 'e-key'],
        reveal: ['queue', 'e-key'],
        tokens: [{ edge: 'e-key', label: 'default/web' }],
        say: { cache: bi('Информер обновляет копию подов и кладёт в очередь ключ default/web.', 'The informer updates its copy and queues the key default/web.') },
        values: { queue: keys(1) },
        fill: { queue: 0.25 },
        metrics: zero,
      });
    }
    if (p.paused)
      s.push({
        id: 'burst',
        label: bi('ещё два', 'two more'),
        caption: bi('Пока контроллер стоит, поды меняются ещё дважды. Информер каждый раз обновляет копию, но ключ default/web уже лежит в очереди, и второй такой же ключ туда не добавляется. В очереди по-прежнему одна запись.', 'While the controller is stopped, the pods change twice more. The informer updates its copy each time, but default/web is already queued, so the queue still holds one key.'),
        focus: ['queue'],
        reveal: ['queue', 'cache', 'e-key', 'api', 'e-watch'],
        tokens: [{ edge: 'e-key', label: 'default/web' }],
        say: { queue: bi('Ключ default/web уже лежит в очереди, поэтому второй такой же ключ сюда не попадает.', 'default/web is already queued, so no second copy is added.') },
        values: { queue: keys(1) },
        fill: { queue: 0.25 },
        metrics: zero,
      });
    if (broken.has('no-cm')) {
      s.push({
        id: 'stuck',
        label: bi('стоит', 'stuck'),
        caption: changed
          ? bi('Ключ default/web лежит в очереди, но взять его некому: процесс kube-controller-manager остановлен. Желаемое записано в etcd, а поды остаются такими, какими их оставило вмешательство.', 'The key waits in the queue, but nobody takes it: kube-controller-manager is stopped.')
          : bi('Процесс kube-controller-manager остановлен. Сейчас разницы нет, но если под удалят или узел выключится, исправлять это будет некому.', 'kube-controller-manager is stopped; there is no difference now, but nobody would fix one.'),
        focus: ['ctrl'],
        say: { ctrl: bi('Контроллер не работает и не берёт ключи из очереди.', 'The controller is not running and takes no keys.') },
        states: { ctrl: 'err' },
        metrics: zero,
        broken: {
          at: 'ctrl',
          message: `$ kubectl get rs web\nNAME   DESIRED   CURRENT   READY   AGE\nweb    ${want}         ${plan.actual}         ${plan.actual}       4d`,
          caption: bi('на контроллере. Объект в etcd сам ничего не делает, поэтому без kube-controller-manager желаемое и фактическое расходятся надолго. В жизни это видно по тому, что в выводе `kubectl get rs` число DESIRED не совпадает с CURRENT и не меняется.', 'at the controller: an object in etcd does nothing by itself. In real life DESIRED and CURRENT in `kubectl get rs` differ and stay so.'),
        },
      });
      return s;
    }
    if (changed || p.paused)
      s.push({
        id: 'take',
        label: bi('взять ключ', 'take key'),
        caption: p.paused
          ? bi('Контроллер снова работает и берёт ключ default/web один раз. Он не перебирает пропущенные события по порядку, а смотрит на то, что есть сейчас, поэтому три изменения стоят ему одного прохода.', 'The controller is back and takes the key once: it does not replay events, it looks at the present, so three changes cost one pass.')
          : bi('Контроллер берёт из очереди ключ default/web и начинает проход петли для этого ReplicaSet.', 'The controller takes default/web and starts a pass for this ReplicaSet.'),
        focus: ['ctrl', 'e-take'],
        reveal: ['e-take'],
        tokens: [{ edge: 'e-take', label: 'default/web' }],
        say: { ctrl: bi('Контроллер берёт ключ default/web из очереди.', 'The controller takes default/web from the queue.') },
        values: { queue: keys(0) },
        fill: { queue: 0 },
        metrics: zero,
      });
    const diff = want - plan.actual;
    const cmp =
      p.event === 'image'
        ? bi('Контроллер сравнивает числа: желаемых подов {w}, работает {a}. Образ он не сравнивает, потому что ReplicaSet следит только за количеством. Работающие поды останутся на старом образе, а новый образ получат только поды, созданные позже.', 'Desired {w}, actual {a}. The image is not compared: a ReplicaSet watches only the count. Running pods keep the old image.')
        : diff > 0
          ? bi('Контроллер сравнивает числа: желаемых подов {w}, работает {a}. Не хватает {d}, поэтому контроллер будет создавать поды.', 'Desired {w}, actual {a}: {d} missing, so the controller will create pods.')
          : diff < 0
            ? bi('Контроллер сравнивает числа: желаемых подов {w}, работает {a}. Лишних {n}, поэтому контроллер будет удалять поды.', 'Desired {w}, actual {a}: {n} extra, so the controller will delete pods.')
            : bi('Контроллер сравнивает числа: желаемых подов {w}, работает {a}. Разницы нет, и контроллер ничего не делает, но продолжает ждать следующего изменения.', 'Desired {w}, actual {a}: no difference, so the controller does nothing and waits.');
    s.push({
      id: 'compare',
      label: bi('сравнить', 'compare'),
      caption: fmt(cmp, { w: want, a: plan.actual, d: diff, n: -diff }),
      focus: ['ctrl'],
      say: { ctrl: fmt(bi('Контроллер считает: желаемых {w}, работает {a}, разница {d}.', 'Desired {w}, actual {a}, difference {d}.'), { w: want, a: plan.actual, d: diff }) },
      values: { ctrl: `${want} − ${plan.actual} = ${diff}` },
      metrics: zero,
    });
    if (plan.adopted || plan.released)
      s.push({
        id: 'owner',
        label: 'ownerReferences',
        caption: plan.adopted
          ? bi('Сначала контроллер принимает новый под в свои: под подходит под селектор и хозяина не имеет, поэтому контроллер дописывает ему в `ownerReferences` ReplicaSet web. Теперь своих подов четыре.', 'First the controller adopts the new pod: it matches the selector and has no owner, so ReplicaSet web is written into its `ownerReferences`. Now there are four.')
          : bi('Сначала контроллер отпускает под без метки: стирает себя из его `ownerReferences`. Под продолжает работать, но хозяина у него больше нет, и ReplicaSet за него не отвечает.', 'First the controller releases the unlabelled pod: it removes itself from `ownerReferences`. The pod keeps running without an owner.'),
        focus: ['ctrl', 'e-act'],
        reveal: ['e-act'],
        tokens: [{ edge: 'e-act', label: 'PATCH ownerReferences' }],
        say: { ctrl: plan.adopted ? bi('Контроллер записывает себя хозяином нового пода.', 'The controller writes itself as the new pod’s owner.') : bi('Контроллер стирает себя из хозяев пода без метки.', 'The controller removes itself as owner of the unlabelled pod.') },
        metrics: zero,
      });
    const done = { reconciles: plan.reconciles, created: plan.created, deleted: plan.deleted };
    if (plan.created || plan.deleted) {
      const n = plan.created || plan.deleted;
      s.push({
        id: 'act',
        label: plan.created ? bi('создать', 'create') : bi('удалить', 'delete'),
        caption: plan.created
          ? fmtb(bi('Контроллер просит API-сервер создать {n} по шаблону. Это обычный запрос к API, такой же, как ваша команда `kubectl`.', 'The controller asks the API server to create {n} from the template, an ordinary API request.'), { n: num(n, ...PODS) })
          : fmtb(bi('Контроллер просит API-сервер удалить {n}. Первыми он выбирает поды, которые ещё не назначены на узел, потом неготовые и потом самые молодые, чтобы не трогать те, что давно и исправно работают.', 'The controller asks the API server to delete {n}: unscheduled first, then not ready, then the youngest.'), { n: num(n, ...PODS) }),
        focus: ['ctrl', 'e-act'],
        reveal: ['e-act', 'api', 'e-pods'],
        tokens: [{ edge: 'e-act', label: plan.created ? `${n} × create pod` : `${n} × delete pod` }],
        say: { ctrl: plan.created ? fmtb(bi('Контроллер просит создать {n} по шаблону ReplicaSet.', 'The controller asks to create {n} from the template.'), { n: num(n, ...PODS) }) : fmtb(bi('Контроллер просит удалить лишние поды: {n}.', 'The controller asks to delete {n}.'), { n: num(n, ...PODS) }) },
        metrics: zero,
      });
      s.push({
        id: 'pods',
        label: bi('поды', 'pods'),
        caption: plan.created
          ? bi('API-сервер принимает запрос, и появляются новые поды. Имена и IP-адреса у них новые: под нельзя «починить», его можно только заменить другим.', 'The API server accepts it and new pods appear with new names and IPs: a pod is not repaired, it is replaced.')
          : bi('API-сервер принимает запрос, и лишние поды удаляются. Подов снова столько, сколько записано в ReplicaSet.', 'The API server accepts it and the extra pods go away.'),
        focus: ['pods', 'e-pods'],
        tokens: [{ edge: 'e-pods', label: plan.created ? 'ADDED pod' : 'DELETED pod' }],
        say: { pods: fmt(bi('Подов с меткой app=web снова {w}.', 'There are {w} pods with app=web again.'), { w: want }) },
        values: { pods: show(want) },
        fill: { pods: fill(want) },
        metrics: done,
      });
    }
    s.push({
      id: 'again',
      label: bi('снова', 'again'),
      caption: plan.created || plan.deleted
        ? bi('Изменения, которые сделал сам контроллер, тоже приходят ему событиями и запускают ещё один проход. В этом проходе разницы уже нет, поэтому контроллер ничего не делает и ждёт следующего изменения.', 'The controller’s own changes come back as events and start one more pass; there is no difference now, so it waits.')
        : bi('Контроллер закончил проход и ждёт следующего изменения. Петля работает всё время, пока работает кластер.', 'The pass is over; the controller waits for the next change. The loop runs as long as the cluster does.'),
      focus: ['ctrl'],
      say: { ctrl: bi('Разницы нет, и контроллер ждёт следующего события.', 'No difference; the controller waits for the next event.') },
      states: { ctrl: 'ok', pods: 'ok' },
      metrics: done,
    });
    return s;
  },
  explainDelta(_prev, next, change, a, b): Bi {
    if (change.kind === 'break')
      return change.on
        ? bi('Контроллер остановлен: ключ лежит в очереди, и разницу между желаемым и фактическим никто не исправляет.', 'The controller is stopped: the key waits, nobody fixes the difference.')
        : bi('Контроллер снова работает и сразу смотрит на текущее состояние подов.', 'The controller runs again and looks at the current state at once.');
    const pl = reconcilePlan(b as P);
    const act = pl.created ? fmtb(bi('создаёт {n}', 'creates {n}'), { n: num(pl.created, ...PODS) }) : pl.deleted ? fmtb(bi('удаляет {n}', 'deletes {n}'), { n: num(pl.deleted, ...PODS) }) : bi('ничего не делает с подами', 'does nothing');
    switch (change.id) {
      case 'replicas':
        return fmtb(bi('Желаемое число подов изменилось с {a} на {b}, а работает {c}, поэтому контроллер {d}.', 'replicas {a} → {b}, {c} running: the controller {d}.'), { a: a.replicas as number, b: b.replicas as number, c: num(pl.actual, ...PODS), d: act });
      case 'event':
        return b.event === 'image'
          ? bi('Смена образа не меняет число подов, поэтому ReplicaSet её не замечает и работающие поды не трогает. Чтобы заменить поды на новый образ, нужен Deployment, о котором следующий урок.', 'An image change does not change the count, so the ReplicaSet ignores it; replacing pods needs a Deployment.')
          : fmtb(bi('После вмешательства работает {c}, а желаемых подов {w}, поэтому контроллер {d}.', 'After the intervention {c} run, {w} wanted: the controller {d}.'), { c: num(pl.actual, ...PODS), w: b.replicas as number, d: act });
      case 'paused':
        return b.paused
          ? fmt(bi('Три изменения пришли, пока контроллер стоял, а проходов петли для ReplicaSet web он выполнил столько: {n}. Важно то, что есть сейчас, а не история событий.', 'Three changes, {n} pass: the present matters, not the history.'), { n: metric(next, 'reconciles') })
          : bi('Контроллер больше не стоит и обрабатывает каждое изменение сразу.', 'The controller handles every change at once again.');
    }
    return bi('Петля пересчитана.', 'The loop is recomputed.');
  },
});
