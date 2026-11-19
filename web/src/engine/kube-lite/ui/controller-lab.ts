// "Your first loop" and "an operator is the same loop" (05 §6.3, screens 5a
// and 5b): the learner writes reconcile(obj, k) in the browser; the trainer
// calls it again and again on a live kube-lite cluster, applies the actions
// it returns, and shows desired (left), actual (right) and the loop between.
// The code runs in the sandbox of ../sandbox.ts.

import './kube.css';
import { clear, h } from '../../../core/dom';
import { bi, t, type Bi } from '../../../core/i18n';
import type { Mounted, WidgetCtx, WidgetReg } from '../../../core/types';
import { ApiError, Cluster } from '../cluster';
import { SandboxRunner, authorize, reconcileInProcess, type Action, type Grant, type ReconcileResult } from '../sandbox';
import type { Obj } from '../util';

export interface Exercise {
  id: 'team-info' | 'website';
  title: Bi;
  intro: Bi;
  /** Code given to the learner (Beginner: three lines to fill in). */
  starter: Record<'beginner' | 'other', string>;
  /** The object kind reconcile is called for. */
  primary: { kind: string; namespace?: string };
  grant: Grant;
  sa: string;
  /** Buttons that change the world. */
  actions: { id: string; label: Bi; run: (c: Cluster) => void }[];
  /** The goal the loop must reach and keep. */
  goal: (c: Cluster) => boolean;
  goalText: Bi;
  /** Objects shown as desired / actual. */
  desired: (c: Cluster) => { label: string; missing?: boolean }[];
  actual: (c: Cluster) => { label: string; missing?: boolean }[];
}

const TEAM_STARTER_BEGINNER = `// Called for every Namespace, again and again.
// Goal: every namespace with the label "team" has a ConfigMap "team-info"
// whose data.team is the value of that label.
function reconcile(ns, k) {
  const team = ns.metadata.labels && ns.metadata.labels.team;
  if (!team) return;                       // not our namespace

  // 1. Read what exists:   const have = k.get('ConfigMap', ns.metadata.name, 'team-info');
  // 2. Compare:            if (!have) { ... }
  // 3. Act:                k.create({ apiVersion: 'v1', kind: 'ConfigMap',
  //                          metadata: { name: 'team-info', namespace: ns.metadata.name },
  //                          data: { team: team } });

}
`;

const TEAM_STARTER_OTHER = `// Called for every Namespace, again and again (level-triggered: you get
// the current object, never the event that changed it).
// Goal: a namespace labelled team=<x> has a ConfigMap team-info with
// data.team = <x>; when the label changes, the ConfigMap follows; when the
// label is removed, the ConfigMap goes away.
// k.get(kind, ns, name) · k.list(kind, ns) · k.create(obj) · k.update(obj) · k.delete(kind, ns, name)
function reconcile(ns, k) {

}
`;

const SITE_STARTER = `// An operator is the same loop for your own kind of object.
// A Website says: run spec.replicas copies of spec.image and give them a Service.
// Called for every Website. Make the Deployment follow the Website.
// ownerRef(site) builds an ownerReference, so deleting the Website deletes the rest.
function reconcile(site, k) {
  const ns = site.metadata.namespace;
  const name = site.metadata.name;
  const want = {
    apiVersion: 'apps/v1', kind: 'Deployment',
    metadata: { name, namespace: ns, ownerReferences: [ownerRef(site)] },
    spec: {
      replicas: site.spec.replicas,
      selector: { matchLabels: { site: name } },
      template: { metadata: { labels: { site: name } },
                  spec: { containers: [{ name: 'web', image: site.spec.image }] } },
    },
  };
  const have = k.get('Deployment', ns, name);
  // Your part: create it when it is missing; when it exists but
  // have.spec.replicas !== site.spec.replicas, update it.

}
`;

const ns = (name: string, labels?: Obj): Obj => ({ apiVersion: 'v1', kind: 'Namespace', metadata: { name, ...(labels ? { labels } : {}) } });

export const EXERCISES: Record<Exercise['id'], Exercise> = {
  'team-info': {
    id: 'team-info',
    title: bi('Петля для ConfigMap team-info', 'A loop for the team-info ConfigMap'),
    intro: bi(
      'У каждого namespace с меткой `team` должен быть ConfigMap `team-info`. Допишите функцию: прочитать, сравнить, действовать. Затем удалите ConfigMap руками и посмотрите, как петля его вернёт.',
      'Every namespace with the label `team` must have a ConfigMap `team-info`. Finish the function: read, compare, act. Then delete the ConfigMap by hand and watch the loop bring it back.',
    ),
    starter: { beginner: TEAM_STARTER_BEGINNER, other: TEAM_STARTER_OTHER },
    primary: { kind: 'Namespace' },
    grant: { kinds: ['ConfigMap'], verbs: ['create', 'update', 'delete'] },
    sa: 'kube-system:team-info-controller',
    actions: [
      { id: 'ns-a', label: bi('Создать namespace team-a (team=alpha)', 'Create namespace team-a (team=alpha)'), run: (c) => void tryApi(() => c.create(ns('team-a', { team: 'alpha' }))) },
      { id: 'ns-b', label: bi('Создать namespace team-b (team=beta)', 'Create namespace team-b (team=beta)'), run: (c) => void tryApi(() => c.create(ns('team-b', { team: 'beta' }))) },
      { id: 'del-cm', label: bi('Удалить ConfigMap team-info в team-a', 'Delete ConfigMap team-info in team-a'), run: (c) => void tryApi(() => c.delete('ConfigMap', 'team-a', 'team-info')) },
      { id: 'relabel', label: bi('Сменить метку team-a: team=gamma', 'Change the team-a label: team=gamma'), run: (c) => void tryApi(() => c.patch('Namespace', undefined, 'team-a', { metadata: { labels: { team: 'gamma' } } })) },
    ],
    goal: (c) => {
      const want = c.list('Namespace').filter((n) => n.metadata.labels?.team);
      return want.length > 0 && want.every((n) => c.get('ConfigMap', n.metadata.name, 'team-info')?.data?.team === n.metadata.labels.team);
    },
    goalText: bi('У каждого namespace с меткой team есть ConfigMap team-info с правильным значением.', 'Every namespace with a team label has a team-info ConfigMap with the right value.'),
    desired: (c) => c.list('Namespace').filter((n) => n.metadata.labels?.team).map((n) => ({ label: `${n.metadata.name}: team=${n.metadata.labels.team}` })),
    actual: (c) =>
      c
        .list('Namespace')
        .filter((n) => n.metadata.labels?.team || c.get('ConfigMap', n.metadata.name, 'team-info'))
        .map((n) => {
          const cm = c.get('ConfigMap', n.metadata.name, 'team-info');
          return cm ? { label: `${n.metadata.name}/team-info: ${cm.data?.team ?? '?'}` } : { label: `${n.metadata.name}/team-info`, missing: true };
        }),
  },
  website: {
    id: 'website',
    title: bi('Оператор Website', 'The Website operator'),
    intro: bi(
      'CRD `Website` добавляет в API новый вид объекта. Оператор — та же петля: желаемое теперь описано вашим объектом, а действует он через обычные Deployment. Допишите создание и обновление, затем меняйте реплики, удаляйте Deployment руками и удалите сам Website.',
      'The `Website` CRD adds a new kind of object to the API. An operator is the same loop: the desired state is now described by your own object, and it acts through ordinary Deployments. Finish the create and update parts, then change the replicas, delete the Deployment by hand and delete the Website itself.',
    ),
    starter: { beginner: SITE_STARTER, other: SITE_STARTER },
    primary: { kind: 'Website', namespace: 'default' },
    grant: { kinds: ['Deployment'], verbs: ['create', 'update', 'delete'] },
    sa: 'default:website-operator',
    actions: [
      { id: 'site', label: bi('Создать Website blog (2 реплики)', 'Create Website blog (2 replicas)'), run: (c) => void tryApi(() => c.create({ apiVersion: 'trainer.dev/v1', kind: 'Website', metadata: { name: 'blog', namespace: 'default' }, spec: { image: 'trainer/web:1.0', replicas: 2 } })) },
      { id: 'scale', label: bi('Website blog: replicas 2 → 4', 'Website blog: replicas 2 → 4'), run: (c) => void tryApi(() => c.patch('Website', 'default', 'blog', { spec: { replicas: 4 } })) },
      { id: 'del-dep', label: bi('Удалить Deployment blog руками', 'Delete the blog Deployment by hand'), run: (c) => void tryApi(() => c.delete('Deployment', 'default', 'blog')) },
      { id: 'del-site', label: bi('Удалить Website blog', 'Delete Website blog'), run: (c) => void tryApi(() => c.delete('Website', 'default', 'blog')) },
    ],
    goal: (c) => {
      const s = c.get('Website', 'default', 'blog');
      const d = c.get('Deployment', 'default', 'blog');
      return !!s && !!d && d.spec.replicas === s.spec.replicas && (s.spec.replicas ?? 0) >= 4;
    },
    goalText: bi('Deployment blog существует и следует за spec.replicas Website (после изменения до 4).', 'The blog Deployment exists and follows the Website spec.replicas (after the change to 4).'),
    desired: (c) => c.list('Website', 'default').map((s) => ({ label: `Website/${s.metadata.name}: ${s.spec.replicas} × ${s.spec.image}` })),
    actual: (c) => [
      ...c.list('Deployment', 'default').map((d) => ({ label: `Deployment/${d.metadata.name}: ${d.status?.readyReplicas ?? 0}/${d.spec.replicas}` })),
      ...c.list('Website', 'default').filter((s) => !c.get('Deployment', 'default', s.metadata.name)).map((s) => ({ label: `Deployment/${s.metadata.name}`, missing: true })),
    ],
  },
};

function tryApi(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof ApiError ? e.print() : String(e);
  }
}

export const WEBSITE_CRD: Obj = {
  apiVersion: 'apiextensions.k8s.io/v1',
  kind: 'CustomResourceDefinition',
  metadata: { name: 'websites.trainer.dev' },
  spec: {
    group: 'trainer.dev',
    names: { kind: 'Website', plural: 'websites', singular: 'website', shortNames: ['site'] },
    scope: 'Namespaced',
    versions: [
      {
        name: 'v1',
        served: true,
        storage: true,
        schema: { openAPIV3Schema: { type: 'object', properties: { spec: { type: 'object', required: ['image', 'replicas'], properties: { image: { type: 'string' }, replicas: { type: 'integer', minimum: 0, maximum: 10 } } } } } },
      },
    ],
  },
};

/** Apply what a reconcile returned, with the controller's permissions. */
export function applyActions(c: Cluster, ex: Exercise, actions: Action[]): string[] {
  const log: string[] = [];
  for (const a of actions.slice(0, 20)) {
    const denied = authorize(a, ex.grant, ex.sa);
    if (denied) {
      log.push(denied);
      continue;
    }
    const err = tryApi(() => {
      if (a.op === 'create') {
        const o = c.create(a.obj);
        log.push(`create ${o.kind}/${o.metadata.namespace ? o.metadata.namespace + '/' : ''}${o.metadata.name}`);
      } else if (a.op === 'update') {
        const cur = c.get(a.obj.kind, a.obj.metadata?.namespace, a.obj.metadata?.name);
        if (!cur) throw new ApiError(404, 'NotFound', `${a.obj.kind?.toLowerCase()}s "${a.obj.metadata?.name}" not found`);
        const next = { ...cur, ...a.obj, metadata: { ...cur.metadata, ...a.obj.metadata, resourceVersion: a.obj.metadata?.resourceVersion ?? cur.metadata.resourceVersion }, status: cur.status };
        const o = c.replace(next);
        log.push(`update ${o.kind}/${o.metadata.namespace ? o.metadata.namespace + '/' : ''}${o.metadata.name}`);
      } else {
        c.delete(a.kind, a.namespace, a.name);
        log.push(`delete ${a.kind}/${a.namespace ? a.namespace + '/' : ''}${a.name}`);
      }
    });
    if (err) log.push(err);
  }
  return log;
}

/** One pass of the learner's controller over every primary object. */
export async function reconcileAll(c: Cluster, ex: Exercise, code: string, run: (code: string, obj: Obj, world: Obj[]) => Promise<ReconcileResult>): Promise<{ calls: number; log: string[]; error?: string }> {
  const world = c.all().filter((o) => o.kind !== 'Event' && o.kind !== 'Lease' && o.kind !== 'Node');
  const primaries = c.list(ex.primary.kind, ex.primary.namespace);
  const log: string[] = [];
  let calls = 0;
  for (const p of primaries) {
    calls++;
    const r = await run(code, p, world);
    for (const l of r.logs) log.push(`[${p.metadata.name}] console: ${l}`);
    if (!r.ok) return { calls, log, error: r.error };
    for (const line of applyActions(c, ex, r.actions)) log.push(`[${p.metadata.name}] ${line}`);
  }
  return { calls, log };
}

const L = {
  run: bi('Запустить петлю', 'Start the loop'),
  stop: bi('Остановить', 'Stop'),
  step: bi('Один проход', 'One pass'),
  desired: bi('Желаемое', 'Desired'),
  actual: bi('Фактическое', 'Actual'),
  loop: bi('наблюдать → сравнить → действовать', 'observe → compare → act'),
  passes: bi('Проходов петли', 'Loop passes'),
  nothing: bi('пусто', 'empty'),
  noWorker: bi('Этот браузер не умеет запускать Web Worker: код ученика без песочницы мы не выполняем.', 'This browser cannot start a Web Worker: we do not run learner code without the sandbox.'),
  goal: bi('Цель', 'Goal'),
  reached: bi('Петля привела фактическое к желаемому и держит его.', 'The loop brought the actual state to the desired one and keeps it there.'),
  sandbox: bi('Код выполняется в изолированном воркере: без сети и без доступа к хранилищу тренажёра, не дольше 200 мс за вызов.', 'The code runs in an isolated worker: no network, no access to the trainer’s storage, at most 200 ms per call.'),
};

function mountLab(root: HTMLElement, props: unknown, ctx: WidgetCtx): Mounted {
  const ex = EXERCISES[((props ?? {}) as { exercise?: Exercise['id'] }).exercise ?? 'team-info'];
  const c = new Cluster({ nodes: ['cp-1', 'worker-1'], seed: 7 });
  if (ex.id === 'website') c.create(WEBSITE_CRD);
  const runner = SandboxRunner.available() ? new SandboxRunner(200) : null;
  const code = h('textarea.kl-code', { spellcheck: 'false', 'aria-label': 'reconcile' }) as HTMLTextAreaElement;
  code.value = ctx.level === 'beginner' ? ex.starter.beginner : ex.starter.other;
  const status = h('p.kl-status', { 'aria-live': 'polite' });
  const log = h('pre.kx-pre.kl-log', { 'aria-live': 'polite' });
  const desired = h('div.kl-col');
  const actual = h('div.kl-col');
  const counter = h('span.kx-mono');
  let passes = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let busy = false;
  let done = false;
  let disposed = false;
  let lines: string[] = [];

  const draw = () => {
    clear(desired);
    clear(actual);
    desired.append(h('h6', {}, t(L.desired)));
    actual.append(h('h6', {}, t(L.actual)));
    const d = ex.desired(c);
    const a = ex.actual(c);
    if (!d.length) desired.append(h('span.kx-note', {}, t(L.nothing)));
    if (!a.length) actual.append(h('span.kx-note', {}, t(L.nothing)));
    for (const x of d) desired.append(h('span.kl-chip', {}, x.label));
    for (const x of a) actual.append(h(`span.kl-chip${x.missing ? '.missing' : ''}`, {}, x.missing ? `${x.label} ⨯` : x.label));
    counter.textContent = `${t(L.passes)}: ${passes}`;
    log.textContent = lines.slice(-40).join('\n');
  };

  const pass = async () => {
    if (busy || disposed) return;
    busy = true;
    const exec = runner ? (cd: string, o: Obj, w: Obj[]) => runner.run(cd, o, w) : null;
    if (!exec) {
      status.className = 'kl-status err';
      status.textContent = t(L.noWorker);
      busy = false;
      stop();
      return;
    }
    const r = await reconcileAll(c, ex, code.value, exec);
    c.advance(1000);
    passes++;
    lines.push(`pass ${passes}: reconcile × ${r.calls}${r.log.length ? '' : ' — no difference, nothing to do'}`);
    lines.push(...r.log.map((l) => `  ${l}`));
    if (r.error) {
      lines.push(`  error: ${r.error}`);
      status.className = 'kl-status err';
      status.textContent = r.error;
      stop();
    } else if (ex.goal(c)) {
      status.className = 'kl-status ok';
      status.textContent = t(L.reached);
      if (!done) {
        done = true;
        ctx.record({ kind: 'x.k8s.controller.goal', exercise: ex.id, passes });
        ctx.complete();
      }
    } else {
      status.className = 'kl-status';
      status.textContent = `${t(L.goal)}: ${t(ex.goalText)}`;
    }
    draw();
    busy = false;
  };

  const stop = () => {
    if (timer) clearInterval(timer);
    timer = null;
    startBtn.textContent = t(L.run);
  };
  const startBtn = h('button.btn.primary.small', {
    type: 'button',
    onclick: () => {
      if (timer) return stop();
      timer = setInterval(() => void pass(), 900);
      startBtn.textContent = t(L.stop);
      void pass();
    },
  }, t(L.run));
  const stepBtn = h('button.btn.small', { type: 'button', onclick: () => void pass() }, t(L.step));
  const worldBtns = h(
    'div.kx-row',
    {},
    ...ex.actions.map((a) =>
      h('button.btn.ghost.small', {
        type: 'button',
        onclick: () => {
          a.run(c);
          lines.push(`you: ${t(a.label)}`);
          draw();
        },
      }, t(a.label)),
    ),
  );

  status.textContent = `${t(L.goal)}: ${t(ex.goalText)}`;
  clear(root);
  root.append(
    h(
      'div.kx',
      {},
      h('h4.kx-h', {}, t(ex.title)),
      h('p.kx-note', {}, t(ex.intro).replace(/`/g, '')),
      h(
        'div.kl',
        {},
        h('div.kx', {}, code, h('div.kx-row', {}, startBtn, stepBtn, counter), h('p.kx-note', {}, t(L.sandbox))),
        h('div.kx', {}, worldBtns, h('div.kl-loop', {}, desired, h('div.kl-arc', {}, '⟳', h('br'), t(L.loop)), actual), status, log),
      ),
    ),
  );
  draw();

  return {
    dispose() {
      disposed = true;
      stop();
      runner?.dispose();
    },
    describe: () => `Controller lab (${ex.id}): ${passes} passes; ${status.textContent ?? ''}`,
  };
}

export const controllerLabWidget: WidgetReg = { id: 'k8s.controller-lab', mount: mountLab };

export { reconcileInProcess };
