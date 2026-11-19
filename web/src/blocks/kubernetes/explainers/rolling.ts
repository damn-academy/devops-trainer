// Э4 (05 §6.6): a rolling update. Two ReplicaSets — old (1.0) and new
// (1.1) — and the Deployment controller between them, one action per step,
// in the wording of the ScalingReplicaSet events. maxSurge and
// maxUnavailable bound every step; the counters show how many pods are
// available at the worst moment and how long the rollout takes.

import { defineModel } from '../../../core/define';
import { bi, fmt, t, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { D, edge, metric, node } from './kit';

/** The READY column of `kubectl get rs` in words. */
const ready = (r: number, of: number) => t(fmt(bi('готово {r} / {n}', '{r} / {n} ready'), { r, n: of }));

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

export const rollingModel = defineModel<P>({
  id: 'k8s.rolling',
  block: 'k8s-1',
  title: bi('Rolling update: два ReplicaSet и границы maxSurge / maxUnavailable', 'A rolling update: two ReplicaSets and the maxSurge / maxUnavailable bounds'),
  summary: bi('Контроллер Deployment поднимает новый ReplicaSet и опускает старый шаг за шагом, не выходя за две границы: сколько подов можно добавить сверху и сколько может не работать.', 'The Deployment controller scales the new ReplicaSet up and the old one down step by step, staying within two bounds: how many pods it may add on top and how many may be unavailable.'),
  concepts: ['k8s.deployment', 'k8s.rolling-update'],
  diagram: {
    width: 960,
    height: 440,
    nodes: [
      node('deploy', bi('Deployment web', 'Deployment web'), 'obj', 'doc', 360, 24, 240, 84, bi('Желаемое: replicas и шаблон пода. Смена шаблона (образа) — новая ревизия и новый ReplicaSet.', 'The desired state: replicas and a pod template. A template change (the image) means a new revision and a new ReplicaSet.'), bi('вы: kubectl set image или apply', 'you: kubectl set image or apply'), 'kubectl rollout history deploy/web', D.deployment, 'image 1.0 → 1.1'),
      node('ctrl', bi('контроллер Deployment', 'Deployment controller'), 'cp', 'hex', 380, 140, 200, 56, bi('На каждом шаге решает: поднять новый RS, опустить старый или ждать готовности.', 'On every step it decides: scale the new RS up, the old one down, or wait for readiness.'), bi('kube-controller-manager', 'kube-controller-manager'), 'kubectl rollout status deploy/web', D.deployment),
      node('old', bi('RS web-7d9c… (1.0)', 'RS web-7d9c… (1.0)'), 'obj', 'buffer', 60, 250, 300, 72, bi('Старый ReplicaSet: его реплики уменьшаются. Он остаётся с replicas 0 — для отката.', 'The old ReplicaSet: its replicas go down. It stays at replicas 0 — for a rollback.'), bi('контроллер Deployment', 'the Deployment controller'), 'kubectl get rs', D.rs, ready(4, 4)),
      node('new', bi('RS web-5f4b… (1.1)', 'RS web-5f4b… (1.1)'), 'obj', 'buffer', 600, 250, 300, 72, bi('Новый ReplicaSet: его реплики растут, но под учитывается только когда Ready.', 'The new ReplicaSet: its replicas grow, but a pod counts only once it is Ready.'), bi('контроллер Deployment', 'the Deployment controller'), 'kubectl get rs -w', D.rs, ready(0, 0)),
      node('svc', bi('Service web', 'Service web'), 'l4', 'pill', 360, 370, 240, 48, bi('Шлёт запросы только на готовые поды обоих ReplicaSet: во время выкатки отвечают и 1.0, и 1.1.', 'Sends requests only to Ready pods of both ReplicaSets: during the rollout both 1.0 and 1.1 answer.'), bi('вы', 'you'), 'kubectl get endpointslices -l kubernetes.io/service-name=web', D.service),
    ],
    edges: [
      edge('e-watch', 'deploy', 'ctrl', 'watch', bi('Контроллер видит новую ревизию шаблона.', 'The controller sees the new template revision.'), bi('kube-controller-manager', 'kube-controller-manager')),
      edge('e-old', 'ctrl', 'old', 'scale down', bi('ScalingReplicaSet: «Scaled down replica set web-7d9c… from 4 to 3».', 'ScalingReplicaSet: "Scaled down replica set web-7d9c… from 4 to 3".'), bi('контроллер Deployment', 'the Deployment controller'), { via: [[210, 168]] }),
      edge('e-new', 'ctrl', 'new', 'scale up', bi('ScalingReplicaSet: «Scaled up replica set web-5f4b… from 0 to 1».', 'ScalingReplicaSet: "Scaled up replica set web-5f4b… from 0 to 1".'), bi('контроллер Deployment', 'the Deployment controller'), { via: [[750, 168]] }),
      edge('e-svc-old', 'svc', 'old', bi('готовые 1.0', 'ready 1.0'), bi('Готовые старые поды в EndpointSlice.', 'Ready old pods in the EndpointSlice.'), bi('контроллер EndpointSlice', 'the EndpointSlice controller'), { via: [[210, 394]] }),
      edge('e-svc-new', 'svc', 'new', bi('готовые 1.1', 'ready 1.1'), bi('Готовые новые поды в EndpointSlice.', 'Ready new pods in the EndpointSlice.'), bi('контроллер EndpointSlice', 'the EndpointSlice controller'), { via: [[750, 394]] }),
    ],
  },
  params: [
    { id: 'replicas', label: bi('replicas', 'replicas'), kind: 'range', min: 1, max: 10, step: 1, default: 4, near: 'deploy' },
    {
      id: 'surge',
      label: bi('maxSurge', 'maxSurge'),
      kind: 'range',
      min: 0,
      max: 5,
      step: 1,
      default: 1,
      near: 'new',
      predict: {
        prompt: bi('maxSurge стал 0. Как теперь пойдёт выкатка?', 'maxSurge is 0 now. How does the rollout go?'),
        options: [
          { id: 'down-first', text: bi('Сначала уберут старый под, потом поднимут новый', 'An old pod goes first, then a new one comes up') },
          { id: 'same', text: bi('Так же, как раньше', 'The same as before') },
          { id: 'invalid', text: bi('Deployment отклонят', 'The Deployment is rejected') },
        ],
        resolve: (_p, n) => (n.some((s) => s.broken) ? 'invalid' : n.find((s) => s.id.startsWith('a'))?.id === 'a0-down' ? 'down-first' : 'same'),
      },
    },
    {
      id: 'unavailable',
      label: bi('maxUnavailable', 'maxUnavailable'),
      kind: 'range',
      min: 0,
      max: 5,
      step: 1,
      default: 1,
      near: 'old',
      predict: {
        prompt: bi('maxUnavailable стал 0. Сколько подов будет готово в худший момент?', 'maxUnavailable is 0 now. How many pods are available at the worst moment?'),
        options: [
          { id: 'all', text: bi('Все replicas — ни одного меньше', 'All replicas — not one fewer') },
          { id: 'less', text: bi('На один меньше', 'One fewer') },
        ],
        resolve: (_p, n) => (metric(n, 'minAvailable') >= metric(n, 'replicas') ? 'all' : 'less'),
      },
    },
    { id: 'ready', label: bi('Новый под готов через, с', 'A new pod is Ready after, s'), kind: 'range', min: 0, max: 60, step: 5, default: 15, near: 'new' },
    {
      id: 'strategy',
      label: bi('strategy.type', 'strategy.type'),
      kind: 'choice',
      default: 'RollingUpdate',
      options: [
        { id: 'RollingUpdate', label: bi('RollingUpdate', 'RollingUpdate') },
        { id: 'Recreate', label: bi('Recreate', 'Recreate') },
      ],
      near: 'ctrl',
      predict: {
        prompt: bi('Recreate. Сколько подов будет готово в худший момент?', 'Recreate. How many pods are available at the worst moment?'),
        options: [
          { id: 'zero', text: bi('Ноль: сервис ляжет на время выкатки', 'Zero: the service is down during the rollout') },
          { id: 'some', text: bi('Хотя бы один', 'At least one') },
        ],
        resolve: (_p, n) => (metric(n, 'minAvailable') === 0 ? 'zero' : 'some'),
      },
    },
    { id: 'probe', label: bi('readinessProbe у пода', 'The pod has a readinessProbe'), kind: 'toggle', default: true, near: 'svc', levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    {
      id: 'bad-image',
      label: bi('Новый образ trainer/web:2.0 падает', 'The new image trainer/web:2.0 crashes'),
      remove: ['e-svc-new'],
      boundary: 'process',
      predict: {
        prompt: bi('Новые поды падают при старте. Что станет со старыми?', 'The new pods crash on start. What happens to the old ones?'),
        options: [
          { id: 'keep', text: bi('Старые продолжают работать в пределах maxUnavailable', 'The old ones keep running within maxUnavailable') },
          { id: 'gone', text: bi('Старые удалят, сервис ляжет', 'The old ones are deleted, the service goes down') },
          { id: 'rollback', text: bi('Kubernetes сам откатит выкатку', 'Kubernetes rolls the rollout back by itself') },
        ],
        resolve: (_p, n) => (metric(n, 'minAvailable') > 0 ? 'keep' : 'gone'),
      },
    },
  ],
  metrics: [
    { id: 'available', label: bi('готово сейчас', 'available now') },
    { id: 'minAvailable', label: bi('минимум за выкатку', 'minimum during the rollout') },
    { id: 'total', label: bi('подов всего', 'pods in total') },
    { id: 'replicas', label: bi('replicas', 'replicas') },
    { id: 'seconds', label: bi('время', 'time'), unit: 's' },
  ],
  run(p, broken): Step[] {
    const bad = broken.has('bad-image');
    const acts = rollout(p, bad);
    const R = p.replicas;
    const s: Step[] = [];
    const vals = (a: RollAction) => ({ old: ready(a.oldR, a.oldR), new: ready(a.newReady, a.newR), deploy: `image 1.0 → ${bad ? '2.0' : '1.1'}` });
    s.push({ id: 'start', label: bi('ревизия 2', 'revision 2'), caption: fmt(bi('Шаблон изменён: новая ревизия. Контроллер создаёт ReplicaSet для нового шаблона с 0 реплик. Старый держит {r} готовых подов.', 'The template changed: a new revision. The controller creates a ReplicaSet for the new template with 0 replicas. The old one holds {r} Ready pods.'), { r: R }), focus: ['deploy', 'e-watch', 'ctrl'], tokens: [{ edge: 'e-watch' }], values: { old: ready(R, R), new: ready(0, 0), deploy: `image 1.0 → ${bad ? '2.0' : '1.1'}` }, fill: { old: 1, new: 0 }, metrics: { available: R, minAvailable: R, total: R, replicas: R, seconds: 0 } });
    let minA = R;
    acts.forEach((a, i) => {
      minA = Math.min(minA, a.available);
      const metrics = { available: a.available, minAvailable: minA, total: a.oldR + a.newR, replicas: R, seconds: a.t };
      const fill = { old: R ? a.oldR / R : 0, new: R ? a.newReady / R : 0 };
      if (a.what === 'invalid') {
        s.push({ id: `a${i}-invalid`, label: 'invalid', caption: bi('Оба параметра равны нулю: выкатка не сможет сделать ни шага. API-сервер отклоняет такой Deployment.', 'Both are zero: the rollout could not take a single step. The API server rejects such a Deployment.'), focus: ['deploy'], states: { deploy: 'err' }, metrics, broken: { at: 'deploy', message: 'The Deployment "web" is invalid: spec.strategy.rollingUpdate.maxUnavailable: Invalid value: intstr.IntOrString{Type:0, IntVal:0, StrVal:""}: may not be 0 when `maxSurge` is 0', caption: bi('хотя бы один из двух должен давать место для шага.', 'at least one of the two must leave room for a step.') } });
        return;
      }
      if (a.what === 'up') s.push({ id: `a${i}-up`, label: fmt(bi('+новых {n}', '+new {n}'), { n: a.to ?? 0 }), caption: fmt(bi('Scaled up replica set web-5f4b… from {f} to {t}: подов стало {n} — не больше replicas + maxSurge.', 'Scaled up replica set web-5f4b… from {f} to {t}: {n} pods now — no more than replicas + maxSurge.'), { f: a.from!, t: a.to!, n: a.oldR + a.newR }), focus: ['e-new', 'new'], tokens: [{ edge: 'e-new', label: `${a.from} → ${a.to}` }], values: vals(a), fill, states: { new: 'wait' }, metrics });
      else if (a.what === 'down') s.push({ id: `a${i}-down`, label: fmt(bi('−старых {n}', '−old {n}'), { n: a.to ?? 0 }), caption: fmt(bi('Scaled down replica set web-7d9c… from {f} to {t}: готово {a} — не меньше replicas − maxUnavailable.', 'Scaled down replica set web-7d9c… from {f} to {t}: {a} available — no fewer than replicas − maxUnavailable.'), { f: a.from!, t: a.to!, a: a.available }), focus: ['e-old', 'old'], tokens: [{ edge: 'e-old', label: `${a.from} → ${a.to}` }], values: vals(a), fill, metrics });
      else if (a.what === 'ready') s.push({ id: `a${i}-ready`, label: `ready ${a.to}`, caption: p.probe ? fmt(bi('t = {t} с: новые поды прошли readinessProbe — Ready {r} из {n}. Только теперь контроллер может опустить старый ReplicaSet дальше.', 't = {t} s: new pods passed the readinessProbe — Ready {r} of {n}. Only now may the controller scale the old ReplicaSet further down.'), { t: a.t, r: a.newReady, n: a.newR }) : bi('Без readinessProbe под считается готовым, едва процесс запущен — даже если приложение ещё прогревается и отвечает ошибкой.', 'Without a readinessProbe a pod counts as Ready the moment its process starts — even if the application is still warming up and answers with errors.'), focus: ['new', 'e-svc-new', 'svc'], tokens: [{ edge: 'e-svc-new', label: 'ready', reverse: true }], values: vals(a), fill, states: { new: 'ok' }, metrics });
      else if (a.what === 'stuck') s.push({ id: `a${i}-stuck`, label: 'stuck', caption: bi('Новые поды в CrashLoopBackOff и не становятся Ready. Контроллер ждёт: опускать старые дальше нельзя.', 'The new pods are in CrashLoopBackOff and never become Ready. The controller waits: it may not scale the old ones further down.'), focus: ['new', 'ctrl'], values: vals(a), fill, states: { new: 'err' }, metrics, broken: { at: 'new', message: '$ kubectl rollout status deploy/web\nWaiting for deployment "web" rollout to finish: 1 out of 4 new replicas have been updated...\nerror: deployment "web" exceeded its progress deadline', caption: bi('через progressDeadlineSeconds появится Progressing=False, ProgressDeadlineExceeded: это сигнал вам или CI, а не откат — откатывает kubectl rollout undo.', 'after progressDeadlineSeconds the condition Progressing=False, ProgressDeadlineExceeded appears: a signal for you or for CI, not a rollback — kubectl rollout undo rolls back.') } });
      else s.push({ id: `a${i}-done`, label: bi('готово', 'done'), caption: fmt(bi('deployment "web" successfully rolled out: {r} новых подов, старый ReplicaSet на 0 — он хранится для rollout undo.', 'deployment "web" successfully rolled out: {r} new pods, the old ReplicaSet at 0 — it is kept for rollout undo.'), { r: R }), focus: ['deploy', 'new', 'old'], values: vals(a), fill, states: { new: 'ok', old: 'off' }, metrics });
    });
    return s;
  },
  explainDelta(_prev, next, change, a, b): Bi {
    if (change.kind === 'break') return change.on ? fmt(bi('Сломанный образ: выкатка встала, старые поды держат минимум {m} готовых.', 'A broken image: the rollout is stuck, the old pods keep at least {m} available.'), { m: metric(next, 'minAvailable') }) : bi('Образ исправлен: выкатка доходит до конца.', 'The image is fixed: the rollout reaches the end.');
    const m = metric(next, 'minAvailable');
    const sec = metric(next, 'seconds');
    switch (change.id) {
      case 'surge':
      case 'unavailable':
        return fmt(bi('maxSurge={s}, maxUnavailable={u} → в каждый момент готово не меньше {m}, выкатка займёт около {t} с.', 'maxSurge={s}, maxUnavailable={u} → at least {m} available at every moment, the rollout takes about {t} s.'), { s: b.surge as number, u: b.unavailable as number, m, t: sec });
      case 'strategy':
        return b.strategy === 'Recreate' ? bi('Recreate: сначала все старые поды уходят, потом приходят новые — минимум готовых 0.', 'Recreate: all old pods go first, then the new ones come — the minimum available is 0.') : bi('RollingUpdate: старые и новые поды сменяют друг друга по шагам.', 'RollingUpdate: old and new pods replace each other step by step.');
      case 'ready':
        return fmt(bi('Под готов через {a} → {b} с: шагов столько же, но каждый ждёт дольше — выкатка {t} с.', 'A pod is ready after {a} → {b} s: as many steps, but each waits longer — the rollout takes {t} s.'), { a: a.ready as number, b: b.ready as number, t: sec });
      case 'probe':
        return b.probe ? bi('С readinessProbe под получает трафик, только когда приложение отвечает.', 'With a readinessProbe a pod gets traffic only when the application answers.') : bi('Без readinessProbe выкатка «быстрее», но запросы идут на прогревающиеся поды и получают ошибку.', 'Without a readinessProbe the rollout is "faster", but requests reach warming-up pods and get errors.');
      case 'replicas':
        return fmt(bi('replicas {a} → {b}: 25% и единицы пересчитываются от нового числа; минимум готовых {m}.', 'replicas {a} → {b}: the bounds apply to the new number; at least {m} available.'), { a: a.replicas as number, b: b.replicas as number, m });
    }
    return bi('Выкатка пересчитана.', 'The rollout is recomputed.');
  },
});

