// The cloud lab widget (design 00 §6.13): a real workstation (Alpine on v86)
// with curl, OpenTofu and the provider `lab`, the in-tab cloud on the same
// switch (api.cloud.lab, s3.cloud.lab, git.lab, ci.lab), and goals judged by
// state: the cloud's records, the objects in storage, the repositories and
// pipelines, the workstation's files and, when a lesson asks, the facts of
// the cloud VMs themselves. Every VM the API creates is a real v86 machine.
//
//   { kind: 'widget', id: 'lab', widget: 'iac.cloudlab', props: {
//       intro, tasks: [{ id, prompt, check: { when: "cloud.vms[name=web-1].status=RUNNING" } }],
//       setup: ['mkdir -p /root/infra'], ci: true, vmScopes: ['listen'],
//   } }
//
// In an exam (Exam.inTab) the widget reports its facts through
// ctx.reportFacts as machines: ws, cloud and one entry per VM.

import { evaluateCheck } from '../../../core/check';
import { clear, copyText, h, icon, toast } from '../../../core/dom';
import { bi, fmt, t, type Bi } from '../../../core/i18n';
import { renderInline } from '../../../core/markdown';
import { prose } from '../../../app/common';
import { store } from '../../../core/store';
import type { Facts, Mounted, Task, WidgetCtx } from '../../../core/types';
import type { CloudLab } from '../../../engine/cloud/lab';
import type { ConsoleHandle } from '../../../engine/v86/console';
import type { V86Lab } from '../../../engine/v86/lab';
import type { BootPhase, V86Machine } from '../../../engine/v86/machine';
import type { CiBridge } from './ci';
import type { ApiRequestRec } from './facts';
import { apiCall, cloudLabFacts, vmBudgetMB, withPubKey, type ApiCall } from './runtime';
import '../../../engine/v86/v86.css';
import './cloudlab.css';

export interface CloudLabProps {
  intro?: Bi;
  tasks?: Task[];
  /** Root commands on the workstation after it is up (before `seed`). */
  setup?: string[];
  /**
   * API calls after `setup`, before the learner gets the prompt (things
   * "already in the cloud"). The string '{ws_pubkey}' in a body becomes the
   * workstation's /root/.ssh/id_ed25519.pub (create it in `setup`).
   */
  seed?: ApiCall[];
  /** Write the access key to /etc/dt/cloud.env (LAB_TOKEN, AWS_ACCESS_KEY_ID). Default true. */
  token?: boolean;
  /** Run pipelines on push to git.lab (the runner is the workstation, shell executor). */
  ci?: boolean;
  /** Lab fact scopes collected from every running VM (vms['web-1'].listen[port=80]). */
  vmScopes?: string[];
  /** Files collected from every running VM. */
  vmWatch?: string[];
  /** Extra files collected from the workstation. */
  watch?: string[];
  /** Buttons that change the cloud behind the code's back ("a colleague in the console"). */
  actions?: { id: string; label: Bi; calls: ApiCall[] }[];
  /** Guest memory of the workstation (OpenTofu needs about 384 MiB). Default 512. */
  memoryMB?: number;
  autostart?: boolean;
  rows?: number;
}

export const WS_IP = '10.0.0.10';
export type { ApiCall };

const T = {
  env: bi('Облако во вкладке', 'Cloud in the tab'),
  what: bi(
    'Здесь работают настоящие машины: рабочая станция с curl и OpenTofu и облако по адресу `api.cloud.lab`. Каждая ВМ, которую вы создадите через API облака, будет ещё одной настоящей машиной Linux, и загружается она в этой же вкладке.',
    'Real machines run here: a workstation with curl and OpenTofu, and a cloud at `api.cloud.lab`. Every VM you create through the cloud API is one more real Linux machine, booting in this same tab.',
  ),
  cost: bi('Лаборатория один раз скачает около {mb} МБ. Вкладке понадобится около 1,5 ГБ памяти и ещё около 250 МБ на каждую ВМ.', 'The lab downloads about {mb} MB once. The tab needs about 1.5 GB of memory plus about 250 MB per VM.'),
  start: bi('Запустить лабораторию', 'Start the lab'),
  missing: bi('В этой сборке нет образа лаборатории. Его собирает `npm run build:lab-image`.', 'This build has no lab image. `npm run build:lab-image` builds it.'),
  booting: bi('Рабочая станция загружается… ({s} с)', 'The workstation is booting… ({s} s)'),
  setup: bi('Лаборатория готовит облако и рабочую станцию. Терминал начнёт принимать команды, как только всё будет готово, обычно через полминуты или минуту.', 'The lab is preparing the cloud and the workstation. The terminal starts taking commands as soon as everything is ready, usually in half a minute to a minute.'),
  small: bi('Эта лаборатория запускает настоящие машины и рассчитана на компьютер с браузером и хотя бы 4 ГБ памяти. На телефоне она, скорее всего, не запустится, поэтому прочитайте теорию и ответьте на вопросы ниже, а задания выполните за компьютером.', 'This lab runs real machines and is meant for a computer with a browser and at least 4 GB of memory. On a phone it will most likely not start, so read the theory and answer the questions below, and do the tasks at a computer.'),
  failed: bi('Лаборатория не запустилась', 'The lab did not start'),
  cold: bi('рабочая станция загрузилась за {s} с', 'the workstation booted in {s} s'),
  restored: bi('рабочая станция восстановлена из снимка за {s} с', 'the workstation was restored from a snapshot in {s} s'),
  goals: bi('Цели', 'Goals'),
  allDone: bi('Все цели выполнены на настоящих машинах.', 'All goals are done on real machines.'),
  hint: bi('Подсказка', 'Hint'),
  noHints: bi('Подсказок здесь нет, поэтому ищите ответы в документации.', 'No hints here: look it up in the documentation.'),
  live: bi('Лаборатория работает, пока открыта страница. После перезагрузки страницы облако и машины запускаются заново в исходном состоянии, а выполненные цели остаются выполненными.', 'The lab runs while the page is open. After a page reload the cloud and the machines start over from their initial state, and the goals you passed stay passed.'),
  cloud: bi('Облако', 'Cloud'),
  key: bi('Ключ доступа проекта default', 'The access key of project default'),
  keyNote: bi('Секрет записан в файл /etc/dt/cloud.env рабочей станции, и лаборатория уже загрузила его в оболочку открытого терминала. Каждая новая оболочка загружает этот файл сама.', 'The secret is in /etc/dt/cloud.env on the workstation, and the lab has already loaded it into the shell of the open terminal. Every new shell loads this file by itself.'),
  keyNoteManual: bi('Секрет показан только здесь, поэтому передайте его программам сами.', 'The secret is shown only here: hand it to programs yourself.'),
  vms: bi('Виртуальные машины', 'Virtual machines'),
  noVms: bi('ВМ пока нет.', 'No VMs yet.'),
  console: bi('Консоль', 'Console'),
  pipelines: bi('Пайплайны ci.lab', 'Pipelines on ci.lab'),
  noPipelines: bi('Пайплайнов пока нет. Они появятся, когда вы отправите в git.lab репозиторий с файлом `.gitlab-ci.yml`.', 'No pipelines yet: they appear after a push of a repository with `.gitlab-ci.yml` to git.lab.'),
  play: bi('Запустить', 'Play'),
  log: bi('Журнал облака', 'Cloud log'),
  actions: bi('Пока вы не смотрите', 'While you are not looking'),
  actionDone: bi('Изменение сделано через API в обход вашего кода.', 'The change was made through the API, bypassing your code.'),
  copied: bi('Скопировано', 'Copied'),
};

/** A job log as plain text: tofu and git colour their output, and the panel shows no colours. */
export const stripAnsi = (text: string) => text.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '');

/** A VM that is busy booting may not answer the service channel; a check must not wait for it forever. */
const within = <T,>(p: Promise<T>, ms: number): Promise<T | undefined> => Promise.race([p, new Promise<undefined>((r) => setTimeout(() => r(undefined), ms))]);

const tabDeviceMemory = () => (typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined);

const statusClass = (s: string) => (/^(RUNNING|ACTIVE|AVAILABLE|DONE|success)$/.test(s) ? 'ok' : /ERROR|failed/.test(s) ? 'err' : /manual|skipped|STOPPED|canceled/.test(s) ? 'off' : 'wait');

export function mountCloudLab(root: HTMLElement, props: CloudLabProps = {}, ctx?: WidgetCtx): Mounted {
  const tasks = props.tasks ?? [];
  const key = ctx?.lessonId ? `${ctx.lessonId}/${ctx.sectionId ?? 'cloudlab'}` : 'cloudlab';
  const passed = new Set(tasks.filter((x) => store.state.tasks[`${key}/${x.id}`]).map((x) => x.id));
  const hintsShown = new Map<string, number>();
  const requests: ApiRequestRec[] = [];
  let lab: V86Lab | null = null;
  let cl: CloudLab | null = null;
  let ci: CiBridge | null = null;
  let ws: V86Machine | null = null;
  let con: ConsoleHandle | null = null;
  const vmConsoles = new Map<string, ConsoleHandle>();
  let startFacts: Facts | undefined;
  let disposed = false;
  let checkTimer = 0;
  let pollTimer = 0;
  let drawTimer = 0;
  let checking = false;
  let again = false;
  let ranCommand = false;
  // The learner may type only after the lab has set up the cloud and loaded the key into the shell.
  let ready = false;
  // Commands the lab itself typed into the learner's shell, not to be counted as the learner's.
  let primed = 0;

  const status = h('div.v86-status', { 'aria-live': 'polite' });
  const bootLine = h('span.v86-boot.muted.small');
  const termBox = h('div.lab-term-box.v86-term');
  const goals = h('ol.lab-goals');
  const checkLine = h('div.lab-status', { 'aria-live': 'polite' });
  const panel = h('div.cl-panel');
  const left = h(
    'div.lab-left',
    {},
    props.intro ? prose(props.intro) : null,
    tasks.length ? h('h4.lab-h', {}, t(T.goals)) : null,
    tasks.length ? goals : null,
    checkLine,
    h('p.v86-honest.small.muted', {}, icon('warn'), h('span', {}, t(T.live))),
  );
  const right = h('div.lab-right', {}, h('div.lab-bar', {}, h('span.lab-env.v86-env', {}, icon('bolt'), t(T.env), bootLine)), termBox, status, panel);
  const el = h('div.lab.v86-lab.cl', { 'data-tasks': tasks.length ? 'yes' : 'no' }, left, right);
  clear(root);
  root.append(el);

  const renderGoals = () => {
    clear(goals);
    const current = tasks.find((x) => !passed.has(x.id));
    for (const task of tasks) {
      const done = passed.has(task.id);
      const li = h('li.goal', { class: [done ? 'done' : '', task === current ? 'current' : ''].filter(Boolean).join(' '), 'data-task': task.id });
      const body = h('div.goal-body', {}, prose(task.prompt, 'goal-text'));
      li.append(h('span.goal-mark', { 'aria-hidden': 'true' }, done ? '✓' : ''), body);
      if (!done && task.chips && !task.beyond) body.append(h('div.chips', {}, h('button.chip.cmd', { type: 'button', onclick: () => ready && con?.type(task.chips!) }, task.chips)));
      if (!done && task === current) {
        const levels = (['H1', 'H2', 'H3', 'H4', 'H5'] as const).filter((hl) => task.hints?.[hl] && !(task.beyond && hl !== 'H1'));
        const shown = hintsShown.get(task.id) ?? 0;
        const box = h('div.hints');
        levels.slice(0, shown).forEach((hl) => box.append(h('div.hint', {}, h('span.hint-tag', {}, hl), prose(task.hints![hl]!))));
        if (shown < levels.length)
          box.append(
            h(
              'button.btn.ghost.small',
              {
                type: 'button',
                onclick: () => {
                  hintsShown.set(task.id, shown + 1);
                  ctx?.record({ kind: 'hint.open', task: `${key}/${task.id}`, hint: levels[shown] });
                  renderGoals();
                },
              },
              icon('eye'),
              `${t(T.hint)} ${shown + 1}/${levels.length}`,
            ),
          );
        else if (!levels.length) box.append(prose(T.noHints, 'muted small'));
        body.append(box);
      }
      goals.append(li);
    }
  };

  /** Facts of every running VM, by name. */
  const vmFacts = async (): Promise<Record<string, Facts>> => {
    const out: Record<string, Facts> = {};
    if (!lab || (!props.vmScopes?.length && !props.vmWatch?.length && !ctx?.reportFacts)) return out;
    await Promise.all(
      [...lab.nodes].map(async ([name, n]) => {
        if (n.machine.phase !== 'ready') return;
        if (props.vmWatch?.length) n.machine.watchPaths(props.vmWatch);
        out[name] = (await within(n.machine.facts(props.vmScopes ?? []).catch(() => undefined), 6000)) as Facts;
      }),
    );
    for (const k of Object.keys(out)) if (!out[k]) delete out[k];
    return out;
  };

  let lastOwn: Facts | undefined;
  let ownPending: Promise<void> | undefined;
  const collect = async (): Promise<Facts | null> => {
    if (!ws || !cl || ws.phase !== 'ready') return null;
    ownPending ??= within(ws.facts(), 8000).then(facts => { if (facts) { lastOwn = facts; } }).catch(() => {}).finally(() => { ownPending = undefined; });
    const own = lastOwn;
    const vms = await vmFacts();
    const c = cloudLabFacts(cl, requests, ci);
    const facts = { ...(own ?? {}), ...c, vms } as unknown as Facts;
    ctx?.reportFacts?.({ ...(own ? { ws: own } : {}), cloud: { ...c } as unknown as Facts, ...vms });
    return facts;
  };

  const check = async () => {
    if (checking) {
      again = true;
      return;
    }
    checking = true;
    try {
      const facts = await collect();
      if (!facts) {
        // The workstation or a VM was too busy to answer in time (a VM booting in the same tab): look again soon.
        if (ready && passed.size < tasks.length) scheduleCheck(4000);
        return;
      }
      if (!tasks.length) {
        if (ranCommand) ctx?.complete();
        return;
      }
      if (passed.size === tasks.length) return;
      let changed = false;
      let say: string | null = null;
      for (const task of tasks) {
        if (passed.has(task.id)) continue;
        const r = evaluateCheck(task.check, facts, startFacts);
        if (r.pass) {
          passed.add(task.id);
          changed = true;
          ctx?.record({ kind: 'task.pass', task: `${key}/${task.id}`, lesson: ctx.lessonId, hintLevel: hintsShown.get(task.id) ?? 0, docStep: task.docStep ?? 2, docOpened: false, concepts: task.concepts ?? [] });
        } else if (!say && r.say && task === tasks.find((x) => !passed.has(x.id))) say = t(r.say);
      }
      clear(checkLine);
      if (say) checkLine.append(h('p.lab-fail', {}, h('span.st-icon.warn', { 'aria-hidden': 'true' }, '!'), h('span', {}, ...renderInline(say))));
      if (changed) {
        renderGoals();
        if (passed.size === tasks.length) {
          checkLine.append(h('p.lab-ok', {}, h('span.st-icon.ok', { 'aria-hidden': 'true' }, '✓'), t(T.allDone)));
          ctx?.complete();
        }
      }
    } finally {
      checking = false;
      if (again) {
        again = false;
        scheduleCheck();
      }
    }
  };

  const scheduleCheck = (ms = 300) => {
    clearTimeout(checkTimer);
    checkTimer = window.setTimeout(() => void check(), ms);
  };

  // ── the cloud panel ──

  const keyBox = h('div.cl-key');
  const vmList = h('ul.cl-vms');
  const ciBox = h('div.cl-ci');
  const logBox = h('ol.cl-log');
  const actionsBox = h('div.cl-actions');

  const drawKey = () => {
    if (!cl) return;
    const secret = cl.cloud.state.bootstrapSecret;
    const id = cl.cloud.state.keys[0]?.access_key_id ?? '';
    const line = `LAB_TOKEN=${secret}`;
    clear(keyBox);
    keyBox.append(
      h('h4.lab-h', {}, t(T.key)),
      h('div.cl-secret', {}, h('code', {}, line), h('button.btn.ghost.small', { type: 'button', onclick: () => void copyText(line).then(() => toast(t(T.copied))) }, icon('copy'))),
      h('p.small.muted', {}, h('code', {}, `AWS_ACCESS_KEY_ID=${id}`), ' · ', t(props.token === false ? T.keyNoteManual : T.keyNote)),
    );
  };

  const drawVms = () => {
    if (!cl) return;
    clear(vmList);
    const vms = cl.cloud.state.vms;
    if (!vms.length) vmList.append(h('li.muted.small', {}, t(T.noVms)));
    for (const v of vms) {
      const conBox = h('div.cl-vm-con');
      const btn = h('button.btn.ghost.small', { type: 'button', disabled: !lab?.nodes.get(v.hostname) }, icon('term'), t(T.console));
      btn.addEventListener('click', async () => {
        const m = lab?.nodes.get(v.hostname)?.machine;
        if (!m) return;
        const open = vmConsoles.get(v.hostname);
        if (open) {
          open.dispose();
          vmConsoles.delete(v.hostname);
          clear(conBox);
          return;
        }
        const { mountConsole } = await import('../../../engine/v86/console');
        const box = h('div.lab-term-box.cl-vm-term');
        conBox.append(box);
        vmConsoles.set(v.hostname, await mountConsole(box, m, { rows: 10 }));
      });
      vmList.append(
        h(
          'li.cl-vm',
          {},
          h('div.cl-vm-row', {}, h(`span.cl-pill.${statusClass(v.status)}`, {}, v.status), h('code', {}, v.name), h('span.small.muted', {}, `${v.ip} · ${v.flavor}${v.status_message && v.status !== 'RUNNING' ? ` · ${v.status_message}` : ''}`), btn),
          conBox,
        ),
      );
    }
  };

  // Job logs the learner opened stay open across redraws (the log is polled while the job runs).
  const openJobs = new Set<string>();
  const drawCi = () => {
    if (!props.ci) return;
    clear(ciBox);
    ciBox.append(h('h4.lab-h', {}, t(T.pipelines)));
    if (!ci?.pipelines.length) {
      ciBox.append(prose(T.noPipelines, 'small muted'));
      return;
    }
    const follow: HTMLElement[] = [];
    for (const p of [...(ci?.pipelines ?? [])].reverse().slice(0, 5)) {
      const jobs = h('ul.cl-jobs');
      for (const j of p.jobs) {
        const play = j.status === 'manual' ? h('button.btn.ghost.small', { type: 'button', onclick: () => ci?.play(p.id, j.name) }, icon('play'), t(T.play)) : null;
        const id = `${p.id}/${j.name}`;
        const log = h('pre.cl-joblog', {}, stripAnsi(j.log) || '…');
        const box = h('details', {}, h('summary', {}, h(`span.cl-pill.${statusClass(j.status)}`, {}, j.status), ' ', h('code', {}, `${j.stage} / ${j.name}`), ' ', play), log) as HTMLDetailsElement;
        box.open = openJobs.has(id);
        box.addEventListener('toggle', () => {
          if (box.open) openJobs.add(id);
          else openJobs.delete(id);
        });
        jobs.append(h('li', {}, box));
        if (box.open) follow.push(log);
      }
      ciBox.append(h('div.cl-pipe', {}, h('p.small', {}, h(`span.cl-pill.${statusClass(p.status)}`, {}, p.status), ' ', h('code', {}, `#${p.id} ${p.repo} ${p.ref} ${p.sha.slice(0, 8)}`), p.error ? h('span.err', {}, ` ${p.error}`) : null), jobs));
    }
    // An open log follows its tail, the way a CI page shows a running job.
    if (follow.length) requestAnimationFrame(() => follow.forEach((l) => (l.scrollTop = l.scrollHeight)));
  };

  const drawLog = () => {
    if (!cl) return;
    clear(logBox);
    for (const e of cl.log.slice(-14)) logBox.append(h('li', { class: e.ok ? '' : 'err' }, h('span.cl-kind', {}, e.kind), ' ', e.text));
  };

  const drawActions = () => {
    if (!props.actions?.length) return;
    clear(actionsBox);
    actionsBox.append(
      h('h4.lab-h', {}, t(T.actions)),
      ...props.actions.map((a) =>
        h(
          'button.btn.ghost.small',
          {
            type: 'button',
            onclick: async (ev: Event) => {
              if (!cl) return;
              const b = ev.currentTarget as HTMLButtonElement;
              b.disabled = true;
              for (const c of a.calls) await apiCall(cl, c);
              ctx?.record({ kind: 'x.cloudlab.action', action: a.id } as never);
              toast(t(T.actionDone));
              b.disabled = false;
              scheduleCheck();
            },
          },
          icon('bolt'),
          t(a.label),
        ),
      ),
    );
  };

  const draw = () => {
    clearTimeout(drawTimer);
    drawTimer = window.setTimeout(() => {
      drawVms();
      drawCi();
      drawLog();
    }, 120);
  };

  const showError = (e: unknown) => {
    clear(status);
    status.append(h('p.v86-phase', { 'data-phase': 'error' }, h('span.st-icon.err', { 'aria-hidden': 'true' }, '⨯'), h('span', {}, t(T.failed))), h('p.small.err', {}, (e as Error)?.message ?? String(e)));
  };

  const start = async () => {
    clear(termBox);
    const t0 = performance.now();
    const tick = () => {
      if (ws?.phase === 'ready' || disposed) return;
      clear(status);
      status.append(h('p.v86-phase', {}, h('span.v86-spinner', { 'aria-hidden': 'true' }), h('span', {}, t(fmt(T.booting, { s: Math.round((performance.now() - t0) / 1000) })))));
    };
    const iv = window.setInterval(tick, 1000);
    tick();
    try {
      const [{ V86Lab }, { CloudLab }, { V86Machine }, { connectMachine }, { mountConsole }, { v86Backend }, ciMod] = await Promise.all([
        import('../../../engine/v86/lab'),
        import('../../../engine/cloud/lab'),
        import('../../../engine/v86/machine'),
        import('../../../engine/v86/fabric'),
        import('../../../engine/v86/console'),
        import('./backend'),
        props.ci ? import('./ci') : Promise.resolve(null),
      ]);
      if (disposed) return;
      lab = new V86Lab({ hosts: false });
      const backend = v86Backend(lab, { totalMB: vmBudgetMB(tabDeviceMemory()), onChange: draw });
      cl = await CloudLab.create({ backend, hosts: { ws: WS_IP, 'ws.lab': WS_IP } });
      if (disposed) return;
      cl.attach(lab.switch);
      cl.cloud.on((e) => {
        if (e.t === 'request') requests.push({ method: e.method, path: e.path, status: e.status, from: e.from });
        if (requests.length > 400) requests.splice(0, requests.length - 400);
        if (e.t !== 'request' || e.from !== '10.0.0.1') scheduleCheck(500);
      });
      cl.on(() => draw());
      if (ciMod) {
        ci = new ciMod.CiBridge(cl.git, () => (ws?.phase === 'ready' ? ws : null));
        cl.mux.add({ hosts: ['ci.lab'], handler: ci.handle });
        ci.on(() => {
          draw();
          scheduleCheck(500);
        });
        cl.note('ci', 'runner registered: shell executor on ws', true);
      }
      const m = new V86Machine({
        id: 'ws',
        profile: 'lab-node',
        identity: { hostname: 'ws', ip: `${WS_IP}/24`, gateway: '10.0.0.1', dns: '10.0.0.1', hosts: {} },
        memoryMB: props.memoryMB ?? 512,
        watch: props.watch,
        bootBanner: `\r\n\x1b[2m── ${t(bi('выше напечатаны сообщения ядра при загрузке, а дальше терминал в вашем распоряжении', 'above are the kernel boot messages; from here on the terminal is yours'))} ──\x1b[0m`,
      });
      ws = m;
      m.watchPredicates(tasks.flatMap((x) => [typeof x.check.when === 'string' ? x.check.when : undefined, ...(x.check.fail ?? []).map((f) => (typeof f.if === 'string' ? f.if : undefined))]));
      const unplug = connectMachine(lab.switch, m, { mode: 'access', vlan: 1 }, 'ws');
      mounts.push({ dispose: unplug });
      m.onPhase((p: BootPhase, detail?: string) => {
        if (p === 'error') showError(new Error(detail ?? 'error'));
      });
      termBox.inert = true;
      termBox.classList.add('cl-wait');
      con = await mountConsole(termBox, m, { rows: props.rows ?? 16 });
      m.on((ev) => {
        if (ev.t !== 'cmd.done') return;
        if (primed > 0) {
          primed--;
          return;
        }
        ranCommand = true;
        scheduleCheck(150);
      });
      const boot = await m.start();
      if (disposed) return;
      clearInterval(iv);
      clear(status);
      status.append(h('p.v86-phase', {}, h('span.v86-spinner', { 'aria-hidden': 'true' }), h('span', {}, t(T.setup))));
      if (props.token !== false) {
        const id = cl.cloud.state.keys[0]?.access_key_id ?? '';
        await m.exec(`mkdir -p /etc/dt && printf '%s\\n' 'export LAB_TOKEN=${cl.cloud.state.bootstrapSecret}' 'export AWS_ACCESS_KEY_ID=${id}' 'export AWS_SECRET_ACCESS_KEY=lab' > /etc/dt/cloud.env && chmod 600 /etc/dt/cloud.env`);
      }
      for (const cmd of props.setup ?? []) await m.exec(cmd);
      if (props.seed?.length) {
        const pub = JSON.stringify(props.seed).includes('{ws_pubkey}') ? (await m.exec('cat /root/.ssh/id_ed25519.pub 2>/dev/null')).out.trim() : '';
        for (const c of props.seed) await apiCall(cl, withPubKey(c, pub));
      }
      if (props.token !== false) {
        // The learner's shell logged in before the key file existed; load it there too.
        primed++;
        m.write('\x15. /etc/dt/cloud.env\r');
      }
      startFacts = (await collect()) ?? undefined;
      clear(status);
      ready = true;
      termBox.inert = false;
      termBox.classList.remove('cl-wait');
      const s = (boot.ms / 1000).toFixed(1).replace('.', t(bi(',', '.')));
      bootLine.textContent = ` · ${t(fmt(boot.kind === 'cold' ? T.cold : T.restored, { s }))}`;
      ctx?.record({ kind: 'x.v86.boot', boot: boot.kind, ms: boot.ms, resumed: false } as never);
      clear(panel);
      panel.append(h('details.cl-box', { open: true }, h('summary', {}, icon('bolt'), ' ', t(T.cloud)), keyBox, h('h4.lab-h', {}, t(T.vms)), vmList, ciBox, actionsBox, h('details.cl-logbox', {}, h('summary.small', {}, t(T.log)), logBox)));
      drawKey();
      drawActions();
      draw();
      con.focus();
      void check();
      // Some goals become true without a new command in this terminal: an operation finishes, a file appears
      // on a VM during an SSH session, a pipeline ends. Look at the state now and then as well.
      pollTimer = window.setInterval(() => {
        if (!checking && passed.size < tasks.length && document.visibilityState === 'visible') void check();
      }, 10_000);
    } catch (e) {
      clearInterval(iv);
      showError(e);
    }
  };

  const mounts: Mounted[] = [];

  const offer = async () => {
    const { loadLabManifest, labDownloadBytes, formatMB } = await import('../../../engine/v86/assets');
    const manifest = await loadLabManifest();
    if (disposed) return;
    clear(termBox);
    const card = h('div.v86-offer', {}, prose(T.what));
    if (!manifest) card.append(prose(T.missing, 'muted small'));
    else {
      const btn = h('button.btn.primary', { type: 'button' }, icon('play'), t(T.start));
      btn.addEventListener('click', () => void start());
      card.append(h('div.v86-offer-row', {}, btn, h('span.small.muted', {}, t(fmt(T.cost, { mb: formatMB(labDownloadBytes(manifest, 'lab-node')) })))));
      if (props.autostart) return void start();
      const mem = tabDeviceMemory();
      if ((typeof window !== 'undefined' && window.matchMedia?.('(max-width: 600px)').matches) || (mem !== undefined && mem < 4)) card.append(prose(T.small, 'small'));
    }
    termBox.append(card);
  };

  renderGoals();
  void offer();

  return {
    dispose() {
      disposed = true;
      clearTimeout(checkTimer);
      clearInterval(pollTimer);
      clearTimeout(drawTimer);
      con?.dispose();
      for (const c of vmConsoles.values()) c.dispose();
      ci?.dispose();
      cl?.dispose();
      ws?.dispose();
      lab?.dispose();
      mounts.forEach((x) => x.dispose());
    },
    describe: () => {
      const current = tasks.find((x) => !passed.has(x.id));
      const vms = cl?.cloud.state.vms.map((v) => `${v.name} ${v.status}`).join(', ') || 'none';
      return `${t(T.env)}: workstation ${ws?.phase ?? 'idle'}, VMs: ${vms}${tasks.length ? `, ${passed.size}/${tasks.length}` : ''}${current ? ` — ${t(current.prompt)}` : ''}`;
    },
  };
}
