// Э4 (05 §6.6): a rolling update. Two ReplicaSets — old (1.0) and new
// (1.1) — and the Deployment controller between them, one action per step,
// in the wording of the ScalingReplicaSet events. maxSurge and
// maxUnavailable bound every step; the counters show how many pods are
// available at the worst moment and how long the rollout takes.
//
// Reading order: at first only the Deployment, the old ReplicaSet and the
// Service are on screen. You change the image, the controller appears and
// creates the new ReplicaSet, and from then on every step is one action of
// one participant: the controller scales a ReplicaSet, or new pods become
// ready and the Service starts sending them requests.

import { defineModel } from '../../../core/define';
import { bi, fmt, t, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { box, D, edge, fmtb, idsOf, LEGEND_BASE, mark, metric, num, only, PODS } from './kit';

/** The READY column of `kubectl get rs` in words. */
const ready = (r: number, of: number) => t(fmt(bi('готово {r} из {n}', '{r} / {n} ready'), { r, n: of }));

type P = { replicas: number; surge: number; unavailable: number; ready: number; strategy: string; probe: boolean };

export interface RollAction {
  t: number;
  what: 'up' | 'down' | 'ready' | 'stuck' | 'done' | 'invalid';
  rs?: 'old' | 'new';
  from?: number;
  to?: number;
  oldR: number;
  newR: number;
  newReady: number;
  available: number;
}

/** The Deployment controller's rolling update as discrete actions (the same arithmetic as kube-lite). */
export function rollout(p: P, badImage: boolean): RollAction[] {
  const R = p.replicas;
  const acts: RollAction[] = [];
  if (p.strategy === 'RollingUpdate' && p.surge === 0 && p.unavailable === 0) return [{ t: 0, what: 'invalid', oldR: R, newR: 0, newReady: 0, available: R }];
  let oldR = R;
  let oldReady = R;
  let newR = 0;
  let newReady = 0;
  let t = 0;
  const pending: { at: number }[] = [];
  const avail = () => oldReady + newReady;
  const push = (a: Omit<RollAction, 'oldR' | 'newR' | 'newReady' | 'available' | 't'>) => acts.push({ ...a, t, oldR, newR, newReady, available: avail() });
  const readyDelay = p.probe ? p.ready : 0;
  for (let guard = 0; guard < 200; guard++) {
    if (newReady === R && oldR === 0) {
      push({ what: 'done' });
      return acts;
    }
    let acted = false;
    if (p.strategy === 'Recreate') {
      if (oldR > 0) {
        push({ what: 'down', rs: 'old', from: oldR, to: 0 });
        oldR = 0;
        oldReady = 0;
        acts[acts.length - 1].oldR = 0;
        acts[acts.length - 1].available = avail();
        acted = true;
      } else if (newR < R) {
        const from = newR;
        newR = R;
        for (let i = from; i < R; i++) pending.push({ at: t + readyDelay });
        push({ what: 'up', rs: 'new', from, to: R });
        acted = true;
      }
    } else {
      const maxTotal = R + p.surge;
      if (oldR + newR < maxTotal && newR < R) {
        const from = newR;
        newR = Math.min(R, newR + (maxTotal - oldR - newR));
        for (let i = from; i < newR; i++) pending.push({ at: t + readyDelay });
        push({ what: 'up', rs: 'new', from, to: newR });
        acted = true;
      }
      const minAvailable = R - p.unavailable;
      const newUnavailable = newR - newReady;
      let down = Math.min(oldR, oldR + newR - minAvailable - newUnavailable, avail() - minAvailable);
      // Unhealthy old replicas go first; here old pods are healthy, so the floor decides.
      if (down > 0) {
        const from = oldR;
        oldR -= down;
        oldReady = Math.min(oldReady, oldR);
        push({ what: 'down', rs: 'old', from, to: oldR });
        acted = true;
        down = 0;
      }
    }
    if (acted) continue;
    // Nothing to do until new pods become Ready.
    if (badImage) {
      t += 600;
      push({ what: 'stuck' });
      return acts;
    }
    pending.sort((a, b) => a.at - b.at);
    const next = pending.shift();
    if (!next) {
      push({ what: 'done' });
      return acts;
    }
    t = Math.max(t, next.at);
    let n = 1;
    while (pending.length && pending[0].at <= t) {
      pending.shift();
      n++;
    }
    newReady += n;
    push({ what: 'ready', rs: 'new', from: newReady - n, to: newReady });
  }
  return acts;
}

const CM = bi('Контроллер работает внутри процесса kube-controller-manager.', 'Runs inside kube-controller-manager.');

const diagram = {
  width: 960,
  height: 470,
  nodes: [
    box('you', bi('Вы, kubectl', 'You, kubectl'), 'user', 'box', [24, 24, 230, 64], 'terminal', bi('Вы меняете образ в шаблоне пода, и с этого начинается выкатка новой версии.', 'You change the image in the pod template; this starts the rollout.'), bi('Команду набираете вы.', 'You type it.'), { see: 'kubectl rollout history deploy/web' }),
    box('deploy', bi('Deployment web', 'Deployment web'), 'obj', 'doc', [360, 24, 240, 80], 'file', bi('Объект Deployment хранит желаемое: сколько подов должно работать (replicas), шаблон пода и правила выкатки. Каждая смена шаблона, например нового образа, создаёт новую ревизию и новый ReplicaSet.', 'Holds replicas, the pod template and the rollout rules; a template change makes a new revision and a new ReplicaSet.'), bi('Объект создаёте вы командой `kubectl apply`.', 'You create it with `kubectl apply`.'), { see: 'kubectl get deploy web -o yaml', doc: D.deployment, sub: 'image 1.0' }),
    box('ctrl', bi('Контроллер Deployment', 'Deployment controller'), 'cp', 'hex', [380, 150, 200, 60], 'process', bi('На каждом шаге контроллер решает одно: добавить подов новому ReplicaSet, убрать подов у старого или подождать, пока новые поды станут готовы. Границы ему задают maxSurge и maxUnavailable.', 'At each step it decides: scale up the new ReplicaSet, scale down the old one, or wait for readiness, within maxSurge and maxUnavailable.'), CM, { see: 'kubectl rollout status deploy/web', doc: D.deployment }),
    box('old', bi('Старый ReplicaSet, версия 1.0', 'Old ReplicaSet, 1.0'), 'obj', 'buffer', [40, 262, 320, 78], 'container', bi('ReplicaSet со старым шаблоном. Во время выкатки контроллер уменьшает число его подов до нуля, но сам объект оставляет: по нему работает откат командой `kubectl rollout undo`.', 'The ReplicaSet with the old template; scaled to zero but kept for `kubectl rollout undo`.'), bi('ReplicaSet создал контроллер Deployment при прошлой выкатке.', 'Created by the Deployment controller at the last rollout.'), { see: 'kubectl get rs', doc: D.rs, sub: '' }),
    box('new', bi('Новый ReplicaSet, версия 1.1', 'New ReplicaSet, 1.1'), 'obj', 'buffer', [600, 262, 320, 78], 'container', bi('ReplicaSet с новым шаблоном. Число его подов растёт, но в расчёт границ под входит только тогда, когда стал готов (Ready).', 'The ReplicaSet with the new template; a pod counts only once it is Ready.'), bi('ReplicaSet создаёт контроллер Deployment в начале выкатки.', 'Created by the Deployment controller when the rollout starts.'), { see: 'kubectl get rs -w', doc: D.rs, sub: '' }),
    box('svc', bi('Service web', 'Service web'), 'l4', 'pill', [360, 396, 240, 56], 'switch', bi('Service отправляет запросы только на готовые поды, причём обоих ReplicaSet сразу. Поэтому во время выкатки пользователям отвечают и версия 1.0, и версия 1.1.', 'Sends requests only to Ready pods of both ReplicaSets, so during the rollout both versions answer.'), bi('Service создаёте вы.', 'You create it.'), { see: 'kubectl get endpointslices -l kubernetes.io/service-name=web', doc: D.service }),
  ],
  edges: [
    edge('e-you', 'you', 'deploy', bi('новый образ', 'new image'), bi('Команда меняет образ в шаблоне Deployment.', 'The command changes the image in the template.'), bi('Запрос отправляет kubectl.', 'kubectl.')),
    edge('e-watch', 'deploy', 'ctrl', bi('новая ревизия', 'new revision'), bi('Контроллер узнаёт о новой ревизии шаблона из события watch.', 'The controller learns of the new revision from a watch event.'), CM),
    edge('e-old', 'ctrl', 'old', bi('убрать поды', 'scale down'), bi('Контроллер уменьшает replicas старого ReplicaSet. В событиях это видно как «Scaled down replica set».', 'The controller lowers the old ReplicaSet’s replicas: “Scaled down replica set”.'), CM, { via: [[200, 180]] }),
    edge('e-new', 'ctrl', 'new', bi('добавить поды', 'scale up'), bi('Контроллер увеличивает replicas нового ReplicaSet. В событиях это видно как «Scaled up replica set».', 'The controller raises the new ReplicaSet’s replicas: “Scaled up replica set”.'), CM, { via: [[760, 180]] }),
    edge('e-svc-old', 'svc', 'old', bi('запросы к 1.0', 'requests to 1.0'), bi('Запросы пользователей к готовым подам старой версии.', 'User requests to Ready old pods.'), bi('Список готовых подов ведёт контроллер EndpointSlice.', 'The EndpointSlice controller keeps the list.'), { via: [[200, 424]] }),
    edge('e-svc-new', 'svc', 'new', bi('запросы к 1.1', 'requests to 1.1'), bi('Запросы пользователей к готовым подам новой версии.', 'User requests to Ready new pods.'), bi('Список готовых подов ведёт контроллер EndpointSlice.', 'The EndpointSlice controller keeps the list.'), { via: [[760, 424]] }),
  ],
};

const ALL = idsOf(diagram);
const firstMove = (steps: Step[]) => steps.find((x) => /^a\d+-(up|down)$/.test(x.id))?.id.split('-')[1];

export const rollingModel = defineModel<P>({
  id: 'k8s.rolling',
  block: 'k8s-1',
  title: bi('Как Deployment заменяет поды на новую версию', 'How a Deployment replaces pods with a new version'),
  summary: bi(
    'Вы меняете образ в Deployment, и контроллер заменяет поды старой версии подами новой. Он делает это по шагам: добавляет подов новому ReplicaSet, ждёт, пока они станут готовы, и убирает поды у старого. Выкатку ограничивают две границы: maxSurge говорит, сколько подов можно добавить сверх replicas, а maxUnavailable — сколько подов может временно не отвечать.',
    'You change the image and the controller replaces old pods with new ones step by step, within two bounds: maxSurge (extra pods above replicas) and maxUnavailable (pods that may be unavailable).',
  ),
  intro: bi(
    'Сейчас на схеме Deployment, старый ReplicaSet с четырьмя готовыми подами версии 1.0 и Service, который отправляет на них запросы. Нажмите «Начать: шаг вперёд», а дальше листайте кнопкой «Шаг вперёд». Следите за счётчиком «готово в худший момент» под схемой: он показывает, сколько подов отвечало пользователям в самый неудачный момент выкатки. Потом меняйте в «Параметрах» границы выкатки и способ замены.',
    'For now the diagram shows the Deployment, the old ReplicaSet with four Ready 1.0 pods and the Service sending them requests. Press “Start: step forward”, then go on with “Step forward”. Watch the counter “ready at the worst moment” under the diagram. Then change the rollout bounds and the strategy in “Parameters”.',
  ),
  legend: [
    ...LEGEND_BASE,
    mark('icon:file', 'объект Deployment', 'the Deployment object'),
    mark('icon:process', 'контроллер Deployment', 'the Deployment controller'),
    mark('icon:container', 'ReplicaSet и его поды; полоса внизу — доля готовых', 'a ReplicaSet and its pods; the bar shows the share ready'),
    mark('icon:switch', 'Service, который раздаёт запросы', 'the Service spreading requests'),
    mark('wait', 'поды созданы, но ещё не готовы', 'pods created, not ready yet'),
    mark('ok', 'поды готовы и получают запросы', 'pods ready and serving'),
    mark('err', 'поды не становятся готовыми', 'pods never become ready'),
  ],
  stopLabel: bi('Выкатка остановилась', 'The rollout stopped'),
  concepts: ['k8s.deployment', 'k8s.rolling-update'],
  diagram,
  params: [
    { id: 'replicas', label: bi('Сколько подов должно работать (replicas)', 'Pods that must run (replicas)'), kind: 'range', min: 1, max: 10, step: 1, default: 4, near: 'deploy', group: bi('Deployment', 'The Deployment') },
    {
      id: 'strategy',
      label: bi('Как заменять поды (strategy.type)', 'How to replace pods (strategy.type)'),
      kind: 'choice',
      default: 'RollingUpdate',
      group: bi('Deployment', 'The Deployment'),
      options: [
        { id: 'RollingUpdate', label: bi('RollingUpdate: по нескольку подов за шаг', 'RollingUpdate: a few pods per step') },
        { id: 'Recreate', label: bi('Recreate: сначала удалить все старые', 'Recreate: delete all old pods first') },
      ],
      near: 'ctrl',
      predict: {
        prompt: bi('Вы переключаете способ замены подов. Сколько подов будет отвечать пользователям в самый неудачный момент выкатки?', 'You switch the strategy. How many pods answer users at the worst moment?'),
        options: [
          { id: 'zero', text: bi('Ни одного: какое-то время сайт не будет отвечать', 'None: for a while the site does not answer') },
          { id: 'some', text: bi('Хотя бы один под будет отвечать всё время', 'At least one pod answers all the time') },
        ],
        resolve: (_p, n) => (metric(n, 'minAvailable') === 0 ? 'zero' : 'some'),
      },
    },
    {
      id: 'surge',
      label: bi('Сколько подов можно добавить сверх replicas (maxSurge)', 'Pods allowed above replicas (maxSurge)'),
      kind: 'range',
      min: 0,
      max: 5,
      step: 1,
      default: 1,
      near: 'new',
      group: bi('Границы выкатки', 'Rollout bounds'),
      predict: {
        prompt: bi('Вы меняете maxSurge, то есть сколько подов можно запустить сверх replicas. С чего контроллер начнёт выкатку при новом значении?', 'You change maxSurge. How will the controller start the rollout now?'),
        options: [
          { id: 'up', text: bi('Сначала создаст поды новой версии', 'First it creates new pods') },
          { id: 'down', text: bi('Сначала уберёт старый под, потому что добавлять сверх replicas нельзя', 'First it removes an old pod, since nothing may be added on top') },
          { id: 'invalid', text: bi('Никак: API-сервер не примет такой Deployment', 'It will not: the API server rejects the Deployment') },
        ],
        resolve: (_p, n) => (n.some((s) => s.broken && s.id.endsWith('invalid')) ? 'invalid' : firstMove(n) ?? 'up'),
      },
    },
    {
      id: 'unavailable',
      label: bi('Сколько подов может временно не отвечать (maxUnavailable)', 'Pods that may be unavailable (maxUnavailable)'),
      kind: 'range',
      min: 0,
      max: 5,
      step: 1,
      default: 1,
      near: 'old',
      group: bi('Границы выкатки', 'Rollout bounds'),
      predict: {
        prompt: bi('Вы меняете maxUnavailable. Сколько подов будет отвечать пользователям в самый неудачный момент выкатки?', 'You change maxUnavailable. How many pods answer at the worst moment?'),
        options: [
          { id: 'all', text: bi('Столько же, сколько записано в replicas', 'As many as replicas') },
          { id: 'less', text: bi('Меньше, чем записано в replicas', 'Fewer than replicas') },
        ],
        resolve: (_p, n) => (metric(n, 'minAvailable') >= metric(n, 'replicas') ? 'all' : 'less'),
      },
    },
    { id: 'ready', label: bi('Через сколько секунд новый под готов отвечать', 'Seconds until a new pod is ready'), kind: 'range', min: 0, max: 60, step: 5, default: 15, near: 'new', group: bi('Новые поды', 'The new pods') },
    { id: 'probe', label: bi('У пода есть проверка готовности (readinessProbe)', 'The pod has a readinessProbe'), kind: 'toggle', default: true, near: 'svc', levels: ['intermediate', 'experienced'], group: bi('Новые поды', 'The new pods') },
  ],
  breaks: [
    {
      id: 'bad-image',
      label: bi('Новый образ trainer/web:2.0 падает сразу при запуске', 'The new image trainer/web:2.0 crashes on start'),
      remove: ['e-svc-new'],
      boundary: 'process',
      predict: {
        prompt: bi('Новый образ падает сразу при запуске, и новые поды никогда не становятся готовыми. Что будет со старыми подами версии 1.0?', 'The new image crashes on start; new pods never become ready. What happens to the old 1.0 pods?'),
        options: [
          { id: 'keep', text: bi('Часть старых подов продолжит работать, сколько позволяет maxUnavailable', 'Some keep running, as maxUnavailable allows') },
          { id: 'gone', text: bi('Старые поды удалят, и сайт перестанет отвечать', 'They are deleted and the site stops answering') },
          { id: 'rollback', text: bi('Kubernetes сам вернёт старую версию', 'Kubernetes rolls back by itself') },
        ],
        resolve: (_p, n) => (metric(n, 'minAvailable') > 0 ? 'keep' : 'gone'),
      },
    },
  ],
  metrics: [
    { id: 'available', label: bi('подов готово сейчас', 'ready now') },
    { id: 'minAvailable', label: bi('готово в худший момент', 'ready at the worst moment') },
    { id: 'total', label: bi('подов всего', 'pods in total') },
    { id: 'replicas', label: bi('должно быть (replicas)', 'replicas') },
    { id: 'seconds', label: bi('секунд с начала выкатки', 'seconds since the start') },
  ],
  run(p, broken): Step[] {
    const bad = broken.has('bad-image');
    const acts = rollout(p, bad);
    const R = p.replicas;
    const img = bad ? '2.0' : '1.1';
    const s: Step[] = [];
    const vals = (a: RollAction) => ({ old: ready(a.oldR, a.oldR), new: ready(a.newReady, a.newR) });
    const m0 = { available: R, minAvailable: R, total: R, replicas: R, seconds: 0 };
    s.push({
      id: 'before',
      label: bi('до выкатки', 'before'),
      caption: fmtb(bi('До выкатки всё спокойно: старый ReplicaSet держит {r} версии 1.0, все они готовы, и Service отправляет запросы пользователей на них.', 'Before the rollout the old ReplicaSet holds {r} of 1.0, all ready, and the Service sends requests to them.'), { r: num(R, ...PODS) }),
      focus: ['old', 'e-svc-old'],
      say: { old: fmtb(bi('Старый ReplicaSet держит {r} версии 1.0, и все они отвечают.', 'The old ReplicaSet holds {r} of 1.0, all answering.'), { r: num(R, ...PODS) }) },
      states: only(ALL, 'deploy', 'old', 'svc', 'e-svc-old'),
      values: { old: ready(R, R), deploy: 'image 1.0' },
      fill: { old: 1, new: 0 },
      metrics: m0,
    });
    s.push({
      id: 'change',
      label: bi('новый образ', 'new image'),
      caption: fmt(bi('Вы меняете образ в шаблоне Deployment на `trainer/web:{i}`. Deployment получает новую ревизию шаблона, но поды от этого пока не меняются.', 'You change the template image to `trainer/web:{i}`: a new revision, but no pod changes yet.'), { i: img }),
      focus: ['you', 'e-you'],
      reveal: ['you', 'e-you'],
      tokens: [{ edge: 'e-you', label: `kubectl set image deploy/web web=trainer/web:${img}` }],
      say: { you: fmt(bi('Вы меняете образ в шаблоне на trainer/web:{i}.', 'You change the template image to trainer/web:{i}.'), { i: img }) },
      values: { deploy: `image 1.0 → ${img}` },
      metrics: m0,
    });
    if (acts[0]?.what === 'invalid') {
      s.push({
        id: 'a0-invalid',
        label: bi('отказ', 'rejected'),
        caption: bi('Оба параметра, maxSurge и maxUnavailable, равны нулю: контроллеру нельзя ни добавить под сверх replicas, ни убрать хотя бы один старый, и выкатка не смогла бы сделать ни шага. Поэтому API-сервер такой Deployment не принимает.', 'Both maxSurge and maxUnavailable are zero: no step is possible, so the API server rejects the Deployment.'),
        focus: ['deploy'],
        say: { deploy: bi('API-сервер отклоняет Deployment, в котором обе границы выкатки равны нулю.', 'The API server rejects a Deployment with both bounds at zero.') },
        states: { deploy: 'err' },
        metrics: m0,
        broken: { at: 'deploy', message: 'The Deployment "web" is invalid: spec.strategy.rollingUpdate.maxUnavailable: Invalid value: intstr.IntOrString{Type:0, IntVal:0, StrVal:""}: may not be 0 when `maxSurge` is 0', caption: bi('ещё до начала выкатки, на проверке объекта. Хотя бы одна из двух границ должна оставлять место для шага.', 'before the rollout, at validation: at least one bound must leave room for a step.') },
      });
      return s;
    }
    s.push({
      id: 'revision',
      label: bi('ревизия', 'revision'),
      caption: bi('Контроллер Deployment видит новую ревизию шаблона и создаёт для неё новый ReplicaSet, пока с нулём подов. Старый ReplicaSet по-прежнему держит все поды версии 1.0.', 'The controller sees the new revision and creates a new ReplicaSet with zero pods; the old one still holds all 1.0 pods.'),
      focus: ['ctrl', 'e-watch'],
      reveal: ['ctrl', 'e-watch', 'new'],
      tokens: [{ edge: 'e-watch', label: bi('ревизия 2', 'revision 2') }],
      say: { ctrl: bi('Контроллер создаёт ReplicaSet для нового шаблона с нулём подов.', 'The controller creates a ReplicaSet for the new template with zero pods.') },
      values: { new: ready(0, 0) },
      metrics: m0,
    });
    let minA = R;
    acts.forEach((a, i) => {
      minA = Math.min(minA, a.available);
      const metrics = { available: a.available, minAvailable: minA, total: a.oldR + a.newR, replicas: R, seconds: a.t };
      const fill = { old: R ? a.oldR / R : 0, new: R ? a.newReady / R : 0 };
      if (a.what === 'up')
        s.push({
          id: `a${i}-up`,
          label: fmt(bi('+{n} новых', '+{n} new'), { n: (a.to ?? 0) - (a.from ?? 0) }),
          caption:
            p.strategy === 'Recreate'
              ? fmt(bi('Старых подов не осталось, и только теперь контроллер создаёт {t} новых. Пока они не готовы, сайт не отвечает.', 'No old pods are left; only now the controller creates {t} new ones. Until they are ready, the site does not answer.'), { t: a.to! })
              : fmt(bi('Контроллер добавляет поды новому ReplicaSet: было {f}, стало {t}. Всего подов теперь {n}, и больше быть не может, потому что граница равна replicas плюс maxSurge.', 'The controller scales the new ReplicaSet {f} → {t}; {n} pods in all, the most replicas + maxSurge allows.'), { f: a.from!, t: a.to!, n: a.oldR + a.newR }),
          focus: ['ctrl', 'e-new', 'new'],
          reveal: ['e-new'],
          tokens: [{ edge: 'e-new', label: `replicas ${a.from} → ${a.to}` }],
          say: { ctrl: fmt(bi('Контроллер добавляет новому ReplicaSet подов: было {f}, стало {t}.', 'The controller scales the new ReplicaSet {f} → {t}.'), { f: a.from!, t: a.to! }) },
          values: vals(a),
          fill,
          states: { new: 'wait' },
          metrics,
        });
      else if (a.what === 'down')
        s.push({
          id: `a${i}-down`,
          label: fmt(bi('−{n} старых', '−{n} old'), { n: (a.from ?? 0) - (a.to ?? 0) }),
          caption:
            p.strategy === 'Recreate'
              ? bi('При способе Recreate контроллер сначала убирает все старые поды разом. С этого момента ни один под не отвечает пользователям.', 'With Recreate all old pods go at once; from now on no pod answers.')
              : fmt(bi('Контроллер убирает поды у старого ReplicaSet: было {f}, стало {t}. Готово отвечать {a}, и меньше быть не может, потому что граница равна replicas минус maxUnavailable.', 'The controller scales the old ReplicaSet {f} → {t}; {a} ready, the fewest replicas − maxUnavailable allows.'), { f: a.from!, t: a.to!, a: a.available }),
          focus: ['ctrl', 'e-old', 'old'],
          reveal: ['e-old'],
          tokens: [{ edge: 'e-old', label: `replicas ${a.from} → ${a.to}` }],
          say: { ctrl: fmt(bi('Контроллер убирает поды у старого ReplicaSet: было {f}, стало {t}.', 'The controller scales the old ReplicaSet {f} → {t}.'), { f: a.from!, t: a.to! }) },
          values: vals(a),
          fill,
          states: a.oldR === 0 ? { old: 'off', 'e-svc-old': 'off' } : {},
          metrics,
        });
      else if (a.what === 'ready')
        s.push({
          id: `a${i}-ready`,
          label: fmt(bi('готово {n}', '{n} ready'), { n: a.to ?? 0 }),
          caption: p.probe
            ? fmt(bi('Прошло {t} с с начала выкатки. Новые поды прошли проверку готовности, и готово уже {r} из {n}. Service начинает отправлять на них запросы, и только теперь контроллер может убрать следующие старые поды.', '{t} s in: new pods passed the readiness check, {r} of {n} ready. The Service sends them requests, and only now may the controller remove more old pods.'), { t: a.t, r: a.newReady, n: a.newR })
            : bi('Проверки готовности у пода нет, поэтому под считается готовым, как только запущен процесс, даже если приложение ещё прогревается и отвечает ошибками. Service сразу отправляет на него запросы.', 'Without a readiness check a pod counts as ready once its process starts, even while the application still warms up and answers with errors.'),
          focus: ['new', 'e-svc-new'],
          reveal: ['e-svc-new'],
          tokens: [{ edge: 'e-svc-new', label: bi('запросы', 'requests') }],
          say: { new: fmt(bi('Новые поды готовы: {r} из {n}, и на них идут запросы.', 'New pods ready: {r} of {n}, serving requests.'), { r: a.newReady, n: a.newR }) },
          values: vals(a),
          fill,
          states: { new: 'ok' },
          metrics,
        });
      else if (a.what === 'stuck')
        s.push({
          id: `a${i}-stuck`,
          label: bi('застряла', 'stuck'),
          caption: bi('Новые поды падают при запуске, переходят в состояние CrashLoopBackOff и не становятся готовыми. Контроллер ждёт: убирать старые поды дальше ему нельзя, потому что тогда готовых подов стало бы меньше, чем разрешает maxUnavailable.', 'New pods crash, go into CrashLoopBackOff and never become ready. The controller waits: removing more old pods would break maxUnavailable.'),
          focus: ['new'],
          say: { new: bi('Новые поды падают при запуске и не становятся готовыми.', 'New pods crash on start and never become ready.') },
          values: vals(a),
          fill,
          states: { new: 'err' },
          metrics,
          broken: {
            at: 'new',
            message: '$ kubectl rollout status deploy/web\nWaiting for deployment "web" rollout to finish: 1 out of 4 new replicas have been updated...\nerror: deployment "web" exceeded its progress deadline',
            caption: bi('на новых подах, которые не становятся готовыми. Через progressDeadlineSeconds у Deployment появится условие Progressing=False с причиной ProgressDeadlineExceeded. Это сигнал вам или системе сборки, а не откат: вернуть старую версию нужно самим командой `kubectl rollout undo`.', 'at the new pods. After progressDeadlineSeconds the Deployment gets Progressing=False, ProgressDeadlineExceeded: a signal, not a rollback; roll back with `kubectl rollout undo`.'),
          },
        });
      else if (a.what === 'done')
        s.push({
          id: `a${i}-done`,
          label: bi('готово', 'done'),
          caption: fmtb(bi('Выкатка закончена: работают {r} новой версии, а у старого ReplicaSet ноль подов. Сам старый ReplicaSet контроллер не удаляет, потому что по нему работает откат. Команда `kubectl rollout status` печатает: deployment "web" successfully rolled out.', 'Done: {r} of the new version run, the old ReplicaSet is at zero and kept for a rollback.'), { r: num(R, ...PODS) }),
          focus: ['ctrl'],
          say: { ctrl: bi('Контроллер видит, что все поды новой версии готовы, и заканчивает выкатку.', 'The controller sees all new pods ready and finishes.') },
          values: vals(a),
          fill,
          states: { new: 'ok', old: 'off' },
          metrics,
        });
    });
    return s;
  },
  explainDelta(_prev, next, change, a, b): Bi {
    if (change.kind === 'break')
      return change.on
        ? fmt(bi('Новый образ падает, и выкатка застряла. Старые поды продолжают отвечать, и в худший момент готово {m}.', 'The new image crashes and the rollout is stuck; at the worst moment {m} are ready.'), { m: metric(next, 'minAvailable') })
        : bi('Образ исправлен, и выкатка доходит до конца.', 'The image is fixed; the rollout finishes.');
    const m = metric(next, 'minAvailable');
    const sec = metric(next, 'seconds');
    switch (change.id) {
      case 'surge':
      case 'unavailable':
        return fmt(bi('Теперь maxSurge равен {s}, а maxUnavailable равен {u}. В худший момент готово {m}, а вся выкатка займёт около {t} с.', 'maxSurge {s}, maxUnavailable {u}: {m} ready at worst, about {t} s in all.'), { s: b.surge as number, u: b.unavailable as number, m, t: sec });
      case 'strategy':
        return b.strategy === 'Recreate'
          ? bi('При способе Recreate сначала уходят все старые поды и только потом приходят новые, поэтому в худший момент не готово ни одного пода.', 'Recreate: all old pods go first, so at worst none is ready.')
          : bi('При способе RollingUpdate старые и новые поды сменяют друг друга по шагам, и сайт всё время отвечает.', 'RollingUpdate: old and new pods replace each other step by step.');
      case 'ready':
        return fmt(bi('Новый под теперь готов не через {a}, а через {b} с. Шагов столько же, но каждый ждёт дольше, и вся выкатка занимает {t} с.', 'Ready after {b} s instead of {a}: as many steps, each longer, {t} s in all.'), { a: a.ready as number, b: b.ready as number, t: sec });
      case 'probe':
        return b.probe
          ? bi('С проверкой готовности под получает запросы только тогда, когда приложение уже отвечает.', 'With a readiness check a pod gets requests only when the application answers.')
          : bi('Без проверки готовности выкатка заканчивается быстрее, но запросы попадают на поды, которые ещё прогреваются, и получают ошибки.', 'Without it the rollout is faster, but requests reach warming pods and get errors.');
      case 'replicas':
        return fmt(bi('Подов теперь должно быть {b} вместо {a}. Границы выкатки считаются от нового числа, и в худший момент готово {m}.', 'replicas {a} → {b}: the bounds apply to the new number; {m} ready at worst.'), { a: a.replicas as number, b: b.replicas as number, m });
    }
    return bi('Выкатка пересчитана.', 'The rollout is recomputed.');
  },
});
