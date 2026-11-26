// The widget `net.reallab`: a network lab on several real Linux machines in
// the tab (design 00 §6.13). It starts the machines of a NetLabSpec on the
// page's switch (engine/v86 V86Lab), gives each a terminal tab, judges the
// goals by the machines' state and by probes between them after every
// command, and shows the switch tap: a live frame list, the .pcap download
// and the cable knobs (loss, delay).
//
// In an exam (Exam.inTab, `ctx.exam`) it judges nothing itself: the
// "Check" button gathers every machine's facts and reports them to the exam's goals.
//
// This file is loaded only when the widget mounts (see index.ts), so the
// emulator and xterm stay out of the block's chunk.

import { evaluateCheck } from '../../../core/check';
import { clear, h, icon, toast } from '../../../core/dom';
import { bi, fmt, t } from '../../../core/i18n';
import { renderInline } from '../../../core/markdown';
import { store } from '../../../core/store';
import type { Mounted, WidgetCtx } from '../../../core/types';
import { prose } from '../../../app/common';
import type { ConsoleHandle } from '../../../engine/v86/console';
import type { V86Lab } from '../../../engine/v86/lab';
import type { V86Machine } from '../../../engine/v86/machine';
import '../../../engine/v86/v86.css';
import { labSpec } from './registry';
import { factsFor, gather, type LabFactsAll, type LabRunner, type NetLabSpec, type NetLabTask, type Scope } from './spec';
import { frameLine, SwitchTap, toPcap } from './tap';
import { v86Runner } from './v86-runner';

export interface NetLabProps {
  lab: string;
  /** Rows of each terminal. */
  rows?: number;
}

const L = {
  env: bi('Настоящий Linux · сеть из {n} машин', 'Real Linux · a network of {n} machines'),
  start: bi('Запустить машины', 'Start the machines'),
  cost: bi('Вкладке понадобится около {ram} МБ памяти. Первая машина загружает ядро, а остальные копируются с её снимка за несколько секунд.', '≈ {ram} MB of tab memory. The first machine boots the kernel, the others are copied from its snapshot in seconds.'),
  tooMany: bi('Это устройство сообщает, что памяти у него немного, и {n} машин могут не поместиться во вкладку. Прежде чем запускать лабораторию, закройте другие вкладки.', 'This device reports little memory: {n} machines may not fit into the tab. Close other tabs before starting.'),
  booting: bi('Загружаю машины… {s} с', 'Starting the machines… {s} s'),
  setup: bi('Готовлю лабораторию…', 'Preparing the lab…'),
  ready: bi('Машины работают уже {s} с', 'The machines are running: {s} s'),
  resumed: bi('Продолжаем с того места, где вы остановились', 'Continuing where you left off'),
  failed: bi('Машины не запустились из-за ошибки: {e}', 'The machines did not start: {e}'),
  missing: bi('Файл с системой для машин недоступен, поэтому лаборатория не запустилась. Перезагрузите страницу, чтобы повторить загрузку. Если вы открыли курс без интернета через `dtlab serve`, машинам во вкладке нужен отдельный пакет: выполните `dtlab course install v86` (около 325 МБ) и перезагрузите страницу. В остальных случаях, если сообщение осталось, нажмите «Сообщить о проблеме». Подготовить машины на своём компьютере можно по [инструкции по установке dtlab](#/local-lab).', 'The machine system image is unavailable, so the lab has not started. Reload this page to retry. If you opened the course offline with `dtlab serve`, the in-tab machines need a separate package: run `dtlab course install v86` (about 325 MB) and reload the page. Otherwise, if the message remains, press “Report a problem”. To prepare machines on your computer, follow [the dtlab setup guide](#/local-lab).'),
  reset: bi('Сбросить лабораторию', 'Reset the lab'),
  resetDone: bi('Все машины возвращены к началу упражнения.', 'Every machine is back at the start of the exercise'),
  goals: bi('Цели', 'Goals'),
  on: bi('на', 'on'),
  all: bi('между машинами', 'between machines'),
  allDone: bi('Все цели выполнены, и проверяли их настоящие ядра Linux.', 'All goals are done — on real kernels.'),
  hint: bi('Подсказка', 'Hint'),
  noHints: bi('Подсказок здесь нет. Ищите ответ в документации, то есть в `man` и в выводе `--help`.', 'No hints here: look it up in the documentation — `man`, `--help`.'),
  doc: bi('Документация', 'Documentation'),
  checking: bi('Проверяю машины…', 'Checking the machines…'),
  check: bi('Проверить состояние машин', 'Check the machines'),
  checked: bi('Сведения о машинах собраны за {s} с', 'Facts gathered in {s} s'),
  slow: bi('Проверки ждут настоящего ответа, поэтому если служба молчит, проверка длится до конца её срока ожидания.', 'The probes really wait for an answer: if a service is silent, the check lasts until its timeout.'),
  topo: bi('Схема лаборатории', 'The lab'),
  port: bi('порт', 'port'),
  access: bi('VLAN {v}', 'VLAN {v}'),
  trunk: bi('транк: VLAN {v} передаётся без метки, а {t} с метками', 'trunk: VLAN {v} untagged, {t} tagged'),
  dhcp: bi('по DHCP', 'by DHCP'),
  tap: bi('Запись трафика на коммутаторе', 'The switch: traffic recording'),
  record: bi('Записывать', 'Record'),
  stop: bi('Остановить', 'Stop'),
  clearCap: bi('Очистить', 'Clear'),
  pcap: bi('Скачать .pcap', 'Download .pcap'),
  frames: bi('кадров: {n}', '{n} frames'),
  tapNote: bi('Коммутатор сохраняет копию каждого кадра, который входит в него через любой порт. Файл с записью открывается в Wireshark и командой `tcpdump -n -r файл`.', 'The switch keeps a copy of every frame that enters it from any port. The file opens in Wireshark and `tcpdump -n -r file`.'),
  line: bi('Линия', 'Line'),
  loss: bi('потери', 'loss'),
  delay: bi('задержка', 'delay'),
  lineNote: bi('Здесь можно портить кадры, которые приходят в коммутатор через выбранный порт, как это делает плохой кабель или перегруженный канал.', 'Spoils the frames that enter the switch from the chosen port: like a bad cable or a congested link.'),
  noNet: bi('У машин нет выхода в интернет. Они видят только сеть лаборатории, поэтому упражнения у всех работают одинаково.', 'The machines have no way out to the internet: they see only the lab network, which is why the exercises behave the same for everyone.'),
};

const shown = (task: NetLabTask, level: WidgetCtx['level']) => !task.levels || task.levels.includes(level);

function portText(m: NetLabSpec['machines'][number]): string {
  const p = m.port ?? { mode: 'access', vlan: 1 };
  return p.mode === 'trunk' ? t(fmt(L.trunk, { v: p.vlan ?? 1, t: (p.vlans ?? []).join(', ') })) : t(fmt(L.access, { v: p.vlan ?? 1 }));
}

export function mountNetLab(root: HTMLElement, props: NetLabProps, ctx?: WidgetCtx): Mounted {
  const spec = labSpec(props.lab);
  if (!spec) {
    root.append(h('p.err', {}, `Unknown lab: ${props.lab}`));
    return { dispose() {} };
  }
  const report = ctx?.reportFacts?.bind(ctx);
  const exam = ctx?.exam === true;
  const level = ctx?.level ?? 'intermediate';
  const tasks = exam ? [] : spec.tasks.filter((x) => shown(x, level));
  const key = ctx?.lessonId ? `${ctx.lessonId}/${ctx.sectionId ?? 'net'}` : `net-${spec.id}`;
  const passed = new Set(tasks.filter((x) => store.state.tasks[`${key}/${x.id}`]).map((x) => x.id));
  const hintsShown = new Map<string, number>();
  let lab: V86Lab | null = null;
  let tap: SwitchTap | null = null;
  const consoles = new Map<string, ConsoleHandle>();
  let current = spec.machines[0].name;
  let disposed = false;
  let checking = false;
  let again = false;
  let checkTimer = 0;
  let clock = 0;
  const snaps = new Map<string, Awaited<ReturnType<V86Machine['snapshot']>>>();

  // ── layout ──
  const status = h('p.small.muted.nl-status', { 'aria-live': 'polite' });
  const checkLine = h('div.lab-status', { 'aria-live': 'polite' });
  const goals = h('ol.lab-goals');
  const tabs = h('div.nl-tabs', { role: 'tablist' });
  const terms = h('div.nl-terms');
  const resetBtn = h('button.btn.ghost.small', { type: 'button', disabled: true }, icon('repeat'), t(L.reset));
  const checkBtn = h('button.btn.primary.small', { type: 'button', disabled: true }, icon('check'), t(L.check));
  const tapBox = h('div.nl-tap');
  const topo = h(
    'table.nl-topo',
    {},
    h('caption.small.muted', {}, t(L.topo)),
    h('tbody', {}, ...spec.machines.map((m) => h('tr', {}, h('th', {}, h('code', {}, m.name)), h('td', {}, h('code', {}, m.dhcp ? t(L.dhcp) : (m.ip ?? ''))), h('td.small', {}, `${t(L.port)} ${portText(m)}`), h('td.small.muted', {}, t(m.role))))),
  );
  const left = h(
    'div.lab-left',
    {},
    prose(spec.intro),
    prose(bi('Запустите машины кнопкой под терминалом и дождитесь подготовки. Выбирайте машину по вкладке с её именем и выполняйте цели в терминале на этой странице. После команд проверка обновляет цели автоматически; зелёная галочка означает выполненную цель. Проверка сетевого ответа может занять несколько секунд.', 'Start the machines with the button below the terminal and wait for setup. Select a machine by its named tab and complete the goals in its terminal on this page. Checks update goals automatically after commands; a green check mark means a completed goal. Network response checks can take a few seconds.'), 'task-guide'),
    topo,
    tasks.length ? h('h4.lab-h', {}, t(L.goals)) : null,
    tasks.length ? goals : null,
    checkLine,
    h('p.v86-honest.small.muted', {}, icon('warn'), h('span', {}, t(L.noNet))),
  );
  const bar = h('div.lab-bar', {}, h('span.lab-env.v86-env', {}, icon('bolt'), t(fmt(L.env, { n: spec.machines.length }))), exam ? checkBtn : null, resetBtn);
  const right = h('div.lab-right.nl-right', {}, bar, tabs, terms, status, tapBox);
  const el = h('div.lab.v86-lab.nl-lab', { 'data-tasks': tasks.length ? 'yes' : 'no' }, left, right);
  clear(root);
  root.append(el);

  const machineOf = (name: string): V86Machine | undefined => lab?.nodes.get(name)?.machine;

  // ── terminals ──
  const showTab = async (name: string) => {
    current = name;
    for (const b of tabs.querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.m === name));
    for (const box of terms.children) (box as HTMLElement).hidden = (box as HTMLElement).dataset.m !== name;
    const m = machineOf(name);
    if (m && !consoles.has(name)) {
      const box = terms.querySelector<HTMLElement>(`[data-m="${name}"]`)!;
      const { mountConsole } = await import('../../../engine/v86/console');
      if (disposed) return;
      consoles.set(name, await mountConsole(box, m, { rows: props.rows ?? 14 }));
    }
    consoles.get(name)?.focus();
  };
  const typeInto = (name: string, text: string) => {
    void showTab(name).then(() => consoles.get(name)?.type(text));
  };

  // ── goals ──
  const renderGoals = () => {
    clear(goals);
    const cur = tasks.find((x) => !passed.has(x.id));
    for (const task of tasks) {
      const done = passed.has(task.id);
      const li = h('li.goal', { class: [done ? 'done' : '', task === cur ? 'current' : ''].filter(Boolean).join(' ') });
      const where = h('span.nl-on.small.muted', {}, task.on ? `${t(L.on)} ${task.on}` : t(L.all));
      const body = h('div.goal-body', {}, where, prose(task.prompt, 'goal-text'));
      li.append(h('span.goal-mark', { 'aria-hidden': 'true' }, done ? '✓' : ''), body);
      if (!done && task.chips && !task.beyond) {
        const target = task.on ?? current;
        body.append(h('div.chips', {}, h('button.chip.cmd', { type: 'button', title: target, onclick: () => typeInto(target, task.chips!) }, task.chips)));
      }
      if (!done && task.docRef && ctx) body.append(h('div.goal-meta', {}, h('button.btn.ghost.small', { type: 'button', onclick: () => ctx.openDoc(task.docRef!) }, icon('doc'), task.docRef.label ?? `${t(L.doc)}: ${(task.docRef.page ?? '').replace(/^man\//, '')}${task.docRef.anchor ? ' · ' + task.docRef.anchor : ''}`)));
      if (!done && task === cur) {
        const levels = (['H1', 'H2', 'H3', 'H4', 'H5'] as const).filter((hl) => task.hints?.[hl] && !(task.beyond && hl !== 'H1'));
        const n = hintsShown.get(task.id) ?? 0;
        const box = h('div.hints');
        levels.slice(0, n).forEach((hl) => box.append(h('div.hint', {}, h('span.hint-tag', {}, hl), prose(task.hints![hl]!))));
        if (n < levels.length)
          box.append(
            h(
              'button.btn.ghost.small',
              {
                type: 'button',
                onclick: () => {
                  hintsShown.set(task.id, n + 1);
                  ctx?.record({ kind: 'hint.open', task: `${key}/${task.id}`, hint: levels[n] });
                  renderGoals();
                },
              },
              icon('eye'),
              `${t(L.hint)} ${n + 1}/${levels.length}`,
            ),
          );
        else if (!levels.length) box.append(prose(L.noHints, 'muted small'));
        body.append(box);
      }
      goals.append(li);
    }
  };

  const runner = (): LabRunner => v86Runner(lab!, tap ?? undefined);

  const check = async () => {
    if (!lab || exam) return;
    if (checking) {
      again = true;
      return;
    }
    const open = tasks.filter((x) => !passed.has(x.id));
    if (!open.length) return;
    checking = true;
    try {
      const all = await gather(spec, runner(), open);
      if (disposed) return;
      let changed = false;
      let say: string | null = null;
      for (const task of open) {
        const f = factsFor(task, all);
        if (!f) continue;
        const r = evaluateCheck(task.check, f);
        if (r.pass) {
          passed.add(task.id);
          changed = true;
          ctx?.record({ kind: 'task.pass', task: `${key}/${task.id}`, lesson: ctx.lessonId, hintLevel: hintsShown.get(task.id) ?? 0, docStep: task.docStep ?? 2, docOpened: false, concepts: task.concepts ?? [] });
        } else if (!say && r.say && task === open.find((x) => !passed.has(x.id))) say = t(r.say);
      }
      clear(checkLine);
      if (say) checkLine.append(h('p.lab-fail', {}, h('span.st-icon.warn', { 'aria-hidden': 'true' }, '!'), h('span', {}, ...renderInline(say))));
      if (changed) {
        renderGoals();
        void lab.persist();
        if (passed.size === tasks.length) {
          checkLine.append(h('p.lab-ok', {}, h('span.st-icon.ok', { 'aria-hidden': 'true' }, '✓'), t(L.allDone)));
          ctx?.complete();
        }
      }
    } catch {
      /* a machine went away (reset, dispose); the next command checks again */
    } finally {
      checking = false;
      if (again) {
        again = false;
        schedule();
      }
    }
  };
  const schedule = () => {
    clearTimeout(checkTimer);
    checkTimer = window.setTimeout(() => void check(), 400);
  };

  checkBtn.addEventListener('click', async () => {
    if (!lab || !report) return;
    checkBtn.setAttribute('disabled', '');
    const t0 = performance.now();
    status.textContent = t(L.checking);
    try {
      const all: LabFactsAll = await gather(spec, runner(), spec.tasks.length ? spec.tasks : [{ id: 'all', prompt: bi('', ''), check: {}, probes: spec.probes.map((p) => p.id), scopes: Object.fromEntries(spec.machines.map((m) => [m.name, ['net', 'listen', 'fw', 'svc'] as Scope[]])) }]);
      if (disposed) return;
      report(all.machines);
      status.textContent = t(fmt(L.checked, { s: ((performance.now() - t0) / 1000).toFixed(1) }));
    } catch (e) {
      status.textContent = (e as Error).message;
    } finally {
      checkBtn.removeAttribute('disabled');
    }
  });

  // ── the switch tap ──
  const renderTap = () => {
    if (!tap || (!spec.capture && !spec.line)) return;
    clear(tapBox);
    const tp = tap;
    if (spec.capture) {
      const count = h('span.small.muted', {}, t(fmt(L.frames, { n: tp.count })));
      const list = h('pre.nl-frames', { 'aria-live': 'off' });
      const draw = () => {
        count.textContent = t(fmt(L.frames, { n: tp.count }));
        list.textContent = tp.frames().slice(-12).map((f) => `${new Date(f.at).toISOString().slice(11, 23)} ${frameLine(f)}`).join('\n');
      };
      let raf = 0;
      tp.on(() => {
        if (!raf) raf = requestAnimationFrame(() => ((raf = 0), draw()));
      });
      const rec = h('button.btn.small', { type: 'button' }, icon(tp.capturing ? 'pause' : 'play'), t(tp.capturing ? L.stop : L.record));
      rec.addEventListener('click', () => {
        if (tp.capturing) tp.stop();
        else tp.start();
        renderTap();
        schedule();
      });
      const dl = h('button.btn.ghost.small', { type: 'button' }, icon('download'), t(L.pcap));
      dl.addEventListener('click', () => {
        const url = URL.createObjectURL(new Blob([toPcap(tp.frames()) as BlobPart], { type: 'application/vnd.tcpdump.pcap' }));
        const a = h('a', { href: url, download: `${spec.id}.pcap` });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      const clr = h('button.btn.ghost.small', { type: 'button' }, t(L.clearCap));
      clr.addEventListener('click', () => {
        tp.clear();
        draw();
      });
      tapBox.append(h('h4.lab-h', {}, t(L.tap)), h('div.row', {}, rec, clr, dl, count), prose(L.tapNote, 'small muted'), list);
      draw();
    }
    if (spec.line) {
      const sel = h('select.nl-port', { 'aria-label': t(L.port) }, ...spec.machines.map((m) => h('option', { value: m.name }, m.name))) as HTMLSelectElement;
      sel.value = spec.machines[spec.machines.length - 1].name;
      const loss = h('input', { type: 'range', min: 0, max: 60, step: 5, 'aria-label': t(L.loss) }) as HTMLInputElement;
      const delay = h('input', { type: 'range', min: 0, max: 500, step: 25, 'aria-label': t(L.delay) }) as HTMLInputElement;
      const lossV = h('output.small');
      const delayV = h('output.small');
      const sync = () => {
        const p = tp.line(sel.value);
        loss.value = String(p.lossPct);
        delay.value = String(p.delayMs);
        lossV.textContent = `${p.lossPct}%`;
        delayV.textContent = `${p.delayMs} ms`;
      };
      sel.addEventListener('change', sync);
      const set = () => {
        tp.setLine(sel.value, { lossPct: Number(loss.value), delayMs: Number(delay.value) });
        sync();
        schedule();
      };
      loss.addEventListener('input', set);
      delay.addEventListener('input', set);
      tapBox.append(
        h('h4.lab-h', {}, t(L.line)),
        h('div.nl-line', {}, h('label.small', {}, `${t(L.port)} `, sel), h('label.small', {}, `${t(L.loss)} `, loss, lossV), h('label.small', {}, `${t(L.delay)} `, delay, delayV)),
        prose(L.lineNote, 'small muted'),
      );
      sync();
    }
  };

  // ── start ──
  const start = async () => {
    clear(terms);
    const t0 = performance.now();
    clock = window.setInterval(() => (status.textContent = t(fmt(L.booting, { s: Math.round((performance.now() - t0) / 1000) }))), 1000);
    status.textContent = t(fmt(L.booting, { s: 0 }));
    try {
      const { V86Lab } = await import('../../../engine/v86/lab');
      if (disposed) return;
      const l = new V86Lab({
        nodes: spec.machines.map((m) => ({ name: m.name, ip: m.dhcp ? undefined : m.ip, dhcp: m.dhcp, mac: m.mac, gateway: m.gateway, port: m.port, stateKey: exam ? undefined : `net-${key}-${m.name}` })),
      });
      lab = l;
      tap = new SwitchTap(l.switch);
      await l.start();
      if (disposed) return l.dispose();
      clearInterval(clock);
      status.textContent = t(L.setup);
      for (const m of spec.machines) {
        const vm = l.machine(m.name);
        vm.on((ev) => {
          if (ev.t === 'cmd.done') schedule();
        });
        if (!vm.resumed) for (const line of m.setup ?? []) await vm.exec(line);
      }
      for (const m of spec.machines) snaps.set(m.name, await l.machine(m.name).snapshot());
      const resumed = spec.machines.every((m) => l.machine(m.name).resumed);
      status.textContent = resumed ? t(L.resumed) : t(fmt(L.ready, { s: ((performance.now() - t0) / 1000).toFixed(1) }));
      if (exam) status.append(' ', t(L.slow));
      for (const m of spec.machines) {
        const b = h('button.nl-tab', { type: 'button', role: 'tab', 'data-m': m.name }, m.name);
        b.addEventListener('click', () => void showTab(m.name));
        tabs.append(b);
        terms.append(h('div.lab-term-box.v86-term.nl-term', { 'data-m': m.name, role: 'tabpanel', hidden: true }));
      }
      resetBtn.removeAttribute('disabled');
      checkBtn.removeAttribute('disabled');
      renderTap();
      ctx?.record({ kind: 'x.netlab.start', lab: spec.id, machines: spec.machines.length, ms: Math.round(performance.now() - t0), resumed });
      await showTab(tasks.find((x) => !passed.has(x.id))?.on ?? spec.machines[0].name);
      void check();
    } catch (e) {
      clearInterval(clock);
      status.textContent = t(fmt(L.failed, { e: (e as Error).message }));
    }
  };

  resetBtn.addEventListener('click', async () => {
    if (!lab) return;
    resetBtn.setAttribute('disabled', '');
    for (const [name, s] of snaps) await lab.machine(name).restore(s);
    for (const m of spec.machines) tap?.setLine(m.name, { lossPct: 0, delayMs: 0 });
    tap?.clear();
    renderTap();
    void lab.persist();
    resetBtn.removeAttribute('disabled');
    toast(t(L.resetDone));
  });

  const offer = async () => {
    const { loadLabManifest } = await import('../../../engine/v86/assets');
    const { labMachineMB, labCapacity } = await import('../../../engine/v86/lab');
    if (disposed) return;
    const manifest = await loadLabManifest().catch(() => null);
    const card = h('div.v86-offer');
    if (!manifest) card.append(prose(L.missing, 'muted small'));
    else {
      const btn = h('button.btn.primary', { type: 'button' }, icon('play'), t(L.start));
      btn.addEventListener('click', () => void start());
      const ram = spec.machines.length * labMachineMB();
      card.append(h('div.v86-offer-row', {}, btn, h('span.small.muted', {}, t(fmt(L.cost, { ram })))));
      const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      if (labCapacity(dm) < spec.machines.length && typeof dm === 'number') card.append(prose(fmt(L.tooMany, { n: spec.machines.length }), 'small muted'));
    }
    terms.append(card);
  };

  renderGoals();
  void offer();

  return {
    dispose() {
      disposed = true;
      clearTimeout(checkTimer);
      clearInterval(clock);
      for (const c of consoles.values()) c.dispose();
      tap?.dispose();
      const l = lab;
      if (l) void l.persist().finally(() => l.dispose());
    },
    describe: () => {
      const cur = tasks.find((x) => !passed.has(x.id));
      return `${t(fmt(L.env, { n: spec.machines.length }))}: ${lab ? 'running' : 'idle'}${tasks.length ? `, ${passed.size}/${tasks.length}` : ''}${cur ? ` — ${t(cur.prompt)}${cur.on ? ` (${cur.on})` : ''}` : ''}`;
    },
  };
}

