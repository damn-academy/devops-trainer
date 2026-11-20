// The flowlab board widget (07 §7): a real Kanban board the learner drives.
// Cards and people are dragged with pointer events or moved with the keyboard
// (Tab to a card, Space to pick it up, ←/→ to choose a column, Space to drop,
// Esc to cancel); every move is announced. "End the day" (Enter) lets the
// team work; charts and the log update; at the end the debrief compares the
// run with two bots on the same seed. No points, no badges: consequences and
// reasons only.

import { calm, clear, h, icon, put } from '../../core/dom';
import { bi, fmt, lang, onLangChange, t, type Bi } from '../../core/i18n';
import { store } from '../../core/store';
import type { Mounted, WidgetCtx } from '../../core/types';
import { budgetGauge, cfdChart, scatterChart, throughputChart } from './charts';
import { mountDebrief } from './debrief';
import { little, metrics } from './metrics';
import { goalConditions } from './goals';
import { money } from './money';
import { scenario } from './scenarios';
import { act, canMove, colName, createState, endDay, inColumn, limitOf, predict, workColumns } from './sim';
import { THEORY } from './theory';
import type { Action, Card, Scenario, Stage, State, WorkStage } from './types';
import './flowlab.css';

export interface BoardProps {
  scenario: string;
  seed?: number;
}

interface RunLog {
  v: 1;
  scenario: string;
  seed: number;
  days: { a: Action[]; auto?: boolean }[];
}


const TYPE_NAME: Record<Card['type'], Bi> = {
  feature: bi('функция', 'feature'),
  bug: bi('дефект', 'defect'),
  incident: bi('незапланированная', 'unplanned'),
  toil: bi('рутина', 'routine'),
  improvement: bi('улучшение', 'improvement'),
};

/** Rebuild a state from a run log (also used by tests and the debrief). */
export function replayLog(sc: Scenario, run: RunLog): State {
  const s = createState(sc, run.seed);
  run.days.forEach((d, i) => {
    for (const a of d.a) act(s, sc, a);
    if (i < run.days.length - 1) endDay(s, sc, d.auto ? { autopull: {} } : {});
  });
  return s;
}

export function mountBoard(root: HTMLElement, props: unknown, ctx: WidgetCtx): Mounted {
  const p = (props ?? {}) as BoardProps;
  const sc = scenario(p.scenario ?? 's1');
  const key = `flowlab:${ctx.lessonId ?? 'free'}/${ctx.sectionId ?? sc.id}`;
  let run: RunLog = { v: 1, scenario: sc.id, seed: p.seed ?? sc.defaultSeed, days: [{ a: [] }] };
  let s = createState(sc, run.seed);
  let tab: 'flow' | 'dora' | 'budget' | 'log' | 'why' = 'flow';
  let picked: { kind: 'card' | 'person'; id: string; target: number } | null = null;
  let whyOpen: string | null = null;
  let view: 'board' | 'debrief' = 'board';
  let debrief: Mounted | null = null;
  let completed = false;
  let lastDone = new Map<string, number>();
  let predictAsk = false;

  const el = h('div.flowlab', { 'data-scenario': sc.id });
  const live = h('p.fl-live.sr-only', { 'aria-live': 'polite' });
  root.append(el, live);

  const say = (msg: string) => {
    live.textContent = msg;
  };
  const save = () => store.saveSnapshot(key, run);

  // ── actions ──
  const doAct = (a: Action, announce?: (ok: boolean) => string): boolean => {
    const r = act(s, sc, a);
    if (!r.ok) {
      say(t(r.reason));
      flash(t(r.reason));
      return false;
    }
    run.days[run.days.length - 1].a.push(a);
    if (a.k === 'decide') ctx.record({ kind: 'x.flowlab.decision', scenario: sc.id, seed: s.seed, day: s.day, dilemma: a.dilemma, option: a.option });
    if (a.k === 'wip' && sc.features.wipLimits && !s.predictions.length && s.history.length >= 2) predictAsk = true;
    if (announce) say(announce(true));
    if (r.overLimit) flash(t(bi('Колонка выше лимита — она подсвечена.', 'The column is over its limit — it is highlighted.')));
    save();
    render();
    return true;
  };

  const nextDay = (auto = false) => {
    if (s.finished) return;
    if (s.pending) {
      flash(t(bi('Сначала ответьте на записку.', 'Answer the note first.')));
      return;
    }
    lastDone = new Map(s.cards.map((c) => [c.id, Object.values(c.done).reduce((a, b) => a + (b ?? 0), 0)]));
    if (auto) run.days[run.days.length - 1].auto = true;
    endDay(s, sc, auto ? { autopull: {} } : {});
    run.days.push({ a: [] });
    const hh = s.history[s.history.length - 1];
    ctx.record({ kind: 'x.flowlab.day', scenario: sc.id, seed: s.seed, day: hh.day, delivered: hh.delivered, wip: hh.wip });
    say(t(fmt(bi('День {d} закончен: готово сегодня {x}, всего {y}, в работе {w}.', 'Day {d} is over: {x} delivered today, {y} in total, {w} in progress.'), { d: hh.day, x: hh.delivered, y: hh.doneTotal, w: hh.wip })));
    if (s.finished) finish();
    save();
    render();
  };

  const skipToEvent = () => {
    const logLen = s.log.length;
    let guard = 0;
    do {
      nextDay(true);
      guard++;
    } while (!s.finished && !s.pending && !s.log.slice(logLen).some((e) => e.kind === 'incident' || e.kind === 'event' && e.tone === 'warn') && guard < sc.days);
  };

  const finish = () => {
    const m = metrics(s, sc);
    ctx.record({ kind: 'x.flowlab.result', scenario: sc.id, seed: s.seed, doneCount: m.doneCount, cycleP85: m.cycleP85, moneyNet: m.moneyNet, cfr: m.cfr });
  };

  const restart = (seed: number) => {
    run = { v: 1, scenario: sc.id, seed, days: [{ a: [] }] };
    s = createState(sc, seed);
    view = 'board';
    debrief?.dispose();
    debrief = null;
    save();
    render();
  };

  // ── rendering ──
  let flashTimer = 0;
  const flashEl = h('p.fl-flash', { role: 'status' });
  const flash = (msg: string) => {
    flashEl.textContent = msg;
    flashEl.classList.add('on');
    clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => flashEl.classList.remove('on'), 3200);
  };

  const whyBtn = (id: string | undefined) =>
    id && THEORY[id] && sc.theory.includes(id)
      ? h(
          'button.fl-why-btn',
          {
            type: 'button',
            onclick: (e: Event) => {
              e.stopPropagation();
              whyOpen = id;
              render();
            },
          },
          t(bi('почему?', 'why?')),
        )
      : null;

  const cardEl = (c: Card, col: Stage) => {
    const stages = (['analysis', 'dev', 'test', 'ops'] as WorkStage[]).filter((x) => (c.work[x] ?? 0) > 0);
    const age = c.startedDay !== undefined && c.stage !== 'done' ? s.history.length + 1 - c.startedDay + 1 : 0;
    const before = lastDone.get(c.id);
    const now = Object.values(c.done).reduce((a, b) => a + (b ?? 0), 0);
    const moved = before !== undefined && now > before + 1e-9 && !calm();
    const next = sc.columns[sc.columns.indexOf(col) + 1];
    const movable = c.lane !== 'ops' && col !== 'done' && next && next !== 'done' && (col === 'backlog' || c.sub === 'done');
    const pick = picked?.kind === 'card' && picked.id === c.id;
    const node = h(
      'div.fl-card',
      {
        class: `type-${c.type}${c.lane === 'expedite' ? ' expedite' : ''}${moved ? ' moved' : ''}${pick ? ' picked' : ''}${c.sub === 'done' && col !== 'backlog' && col !== 'done' ? ' sub-done' : ''}`,
        tabindex: c.lane === 'ops' || col === 'done' ? -1 : 0,
        role: movable ? 'button' : undefined,
        'aria-label': `${t(c.title)}, ${t(TYPE_NAME[c.type])}${c.sub === 'done' && col !== 'backlog' ? `, ${t(bi('готово на этапе', 'done at this stage'))}` : ''}`,
        'data-card': c.id,
      },
      h('span.fl-card-type', {}, t(TYPE_NAME[c.type])),
      h('span.fl-card-title', {}, t(c.title)),
      h(
        'span.fl-dots',
        { 'aria-hidden': 'true' },
        ...stages.map((st) => {
          const w = c.work[st] ?? 0;
          const d = Math.min(w, c.done[st] ?? 0);
          return h('span.fl-dot-row', { title: `${t(colName(sc, st))}: ${Math.round(d * 10) / 10} / ${w}` }, h('span.fl-dot-fill', { style: `width:${(d / w) * 100}%` }));
        }),
      ),
      h(
        'span.fl-card-meta',
        {},
        c.codDaily && col !== 'done' ? h('span.fl-cod', {}, `−${money(c.codDaily)}/${t(bi('день', 'day'))}`) : null,
        age > 0 && col !== 'backlog' ? h('span.fl-age', { title: t(bi('дней в работе', 'days in progress')) }, `${age} ${t(bi('дн.', 'd'))}`) : null,
        c.dueDay && col !== 'done' ? h('span.fl-due', {}, `${t(bi('срок', 'due'))} ${c.dueDay}`) : null,
        c.opsOnly && !s.caps.runbooks ? h('span.fl-lock', { title: t(bi('может сделать только эксплуатация', 'only operations can do it')) }, 'OPS') : null,
      ),
      movable
        ? h(
            'button.fl-next',
            {
              type: 'button',
              'aria-label': fmt(bi('Вытянуть в «{c}»', 'Pull into “{e}”'), { c: colName(sc, next).ru, e: colName(sc, next).en })[lang()],
              onclick: (e: Event) => {
                e.stopPropagation();
                doAct({ k: 'move', card: c.id, to: next }, () => moveSay(c, next));
              },
            },
            icon('next'),
          )
        : null,
    );
    if (movable) attachDrag(node, 'card', c.id);
    return node;
  };

  const moveSay = (c: Card, to: Stage) => {
    const lim = limitOf(s, to);
    const n = inColumn(s, to).length;
    return fmt(bi('«{t}» перемещена в «{c}», в колонке {n}{l}.', '“{te}” moved to “{ce}”, the column holds {n}{l}.'), { t: c.title.ru, te: c.title.en, c: colName(sc, to).ru, ce: colName(sc, to).en, n, l: lim !== null ? ` / ${lim}` : '' })[lang()];
  };

  const personEl = (role: string) => {
    const pr = s.people.find((x) => x.role === role)!;
    const away = (pr.away ?? []).some(([a, b]) => s.day >= a && s.day <= b) || (pr.from !== undefined && s.day < pr.from);
    const pick = picked?.kind === 'person' && picked.id === role;
    const node = h(
      'span.fl-person',
      { class: `${away ? 'away' : ''}${pick ? ' picked' : ''}${pr.station !== pr.home ? ' off-home' : ''}`, tabindex: sc.features.stations ? 0 : -1, 'data-person': role, title: t(pr.label), 'aria-label': `${t(pr.label)} (${role})${away ? ', ' + t(bi('нет на месте', 'away')) : ''}` },
      role,
      away ? h('span.fl-away', {}, t(bi(' нет', ' away'))) : null,
    );
    if (sc.features.stations) attachDrag(node, 'person', role);
    return node;
  };

  const colEl = (col: Stage, idx: number) => {
    const cards = s.cards.filter((c) => c.stage === col && c.lane !== 'ops' && (c.visibleFrom ?? 0) <= s.day);
    const lim = limitOf(s, col);
    const over = lim !== null && cards.length > lim;
    const isWork = col !== 'backlog' && col !== 'done';
    const target = picked && picked.target === idx;
    const people = s.people.filter((x) => x.station === col);
    let valid = true;
    if (picked && target) {
      if (picked.kind === 'card') valid = canMove(s, sc, picked.id, col).ok;
      else valid = isWork && col !== 'deploy';
    }
    const list = (sub: 'doing' | 'done' | null) =>
      h(
        'div.fl-cards',
        { class: sub ?? '' },
        ...(col === 'done'
          ? [h('p.fl-done-count', {}, `${cards.length}`, h('span', {}, ` ${t(bi('у покупателей', 'with customers'))}`)), ...cards.slice(-3).reverse().map((c) => cardEl(c, col))]
          : cards
              .filter((c) => !sub || c.sub === sub || (col === 'deploy' && sub === 'doing'))
              .sort((a, b) => (a.lane === 'expedite' ? -1 : 0) - (b.lane === 'expedite' ? -1 : 0))
              .map((c) => cardEl(c, col))),
      );
    return h(
      'section.fl-col',
      { class: `${over ? 'over' : ''}${target ? (valid ? ' target' : ' target bad') : ''}`, 'data-col': col, 'data-idx': idx, 'aria-label': t(colName(sc, col)) },
      h(
        'header.fl-col-head',
        {},
        h('span.fl-col-name', {}, t(colName(sc, col))),
        h('span.fl-col-count', { class: over ? 'over' : '' }, over ? h('span.st-icon.warn', { 'aria-hidden': 'true' }, '!') : null, `${cards.length}${lim !== null ? ` / ${lim}` : ''}`),
        sc.features.wipLimits && isWork
          ? h(
              'span.fl-limit',
              {},
              h('button.fl-lim-btn', { type: 'button', 'aria-label': t(bi('уменьшить лимит', 'lower the limit')), onclick: () => doAct({ k: 'wip', stage: col, limit: lim === null ? Math.max(1, cards.length) : lim <= 1 ? 1 : lim - 1 }) }, '−'),
              h('button.fl-lim-btn', { type: 'button', 'aria-label': t(bi('увеличить лимит', 'raise the limit')), onclick: () => doAct({ k: 'wip', stage: col, limit: lim === null ? Math.max(1, cards.length + 1) : lim + 1 }) }, '+'),
              lim !== null ? h('button.fl-lim-btn', { type: 'button', 'aria-label': t(bi('снять лимит', 'remove the limit')), title: t(bi('снять лимит', 'remove the limit')), onclick: () => doAct({ k: 'wip', stage: col, limit: null }) }, '∞') : null,
            )
          : null,
      ),
      isWork && col !== 'deploy' ? h('div.fl-people', {}, ...people.map((x) => personEl(x.role))) : null,
      col === 'deploy' ? deployHead() : null,
      isWork && col !== 'deploy' ? [h('p.fl-sub', {}, t(bi('в работе', 'doing'))), list('doing'), h('p.fl-sub', {}, t(bi('готово', 'done'))), list('done')] : list(null),
    );
  };

  const deployHead = () => {
    const mode = s.policies.deploy;
    const label =
      mode.mode === 'train'
        ? fmt(bi('поезд раз в {n} дн.', 'a train every {n} days'), { n: mode.every })
        : mode.mode === 'manual'
          ? bi('кнопкой', 'by button')
          : bi('сама, после проверки', 'by itself after test');
    return h(
      'div.fl-deploy',
      {},
      h('p.fl-sub', {}, t(label), s.freezeUntil >= s.day ? h('span.fl-freeze', {}, ` · ${t(bi('заморозка', 'frozen'))}`) : null),
      mode.mode !== 'on-merge' ? h('button.btn.small', { type: 'button', disabled: !inColumn(s, 'deploy').length || s.deployToday, onclick: () => doAct({ k: 'deploy' }, () => t(bi('Выкладка запланирована на сегодня.', 'A deployment is planned for today.'))) }, s.deployToday ? t(bi('выкладка сегодня', 'deploying today')) : t(bi('Выложить сегодня', 'Deploy today'))) : null,
    );
  };

  const opsLane = () => {
    const cards = s.cards.filter((c) => c.stage === 'ops' && (c.visibleFrom ?? 0) <= s.day);
    const people = s.people.filter((x) => x.station === 'ops');
    const target = picked?.kind === 'person' && picked.target === -1;
    return h(
      'section.fl-ops',
      { class: target ? 'target' : '', 'data-col': 'ops', 'data-idx': -1, 'aria-label': t(bi('Дорожка эксплуатации', 'Operations lane')) },
      h('header.fl-col-head', {}, h('span.fl-col-name', {}, t(bi('Дорожка эксплуатации', 'Operations lane'))), h('span.fl-col-count', {}, String(cards.length)), whyBtn('toil')),
      h('div.fl-people', {}, ...people.map((x) => personEl(x.role))),
      h('div.fl-cards.ops', {}, ...(cards.length ? cards.slice(0, 14).map((c) => cardEl(c, 'ops')) : [h('p.fl-empty', {}, t(bi('пусто', 'empty')))]), cards.length > 14 ? h('span.fl-more', {}, `+${cards.length - 14}`) : null),
    );
  };

  const noteEl = () => {
    const dl = sc.dilemmas.find((x) => x.id === s.pending);
    if (!dl) return null;
    return h(
      'div.fl-note',
      { role: 'group', 'aria-label': t(bi('Служебная записка', 'Memo')) },
      h('p.fl-note-tag', {}, icon('doc'), t(bi('Служебная записка', 'Memo'))),
      h('p.fl-note-text', {}, t(dl.text)),
      h('div.fl-note-opts', {}, ...dl.options.map((o) => h('button.btn.option', { type: 'button', onclick: () => doAct({ k: 'decide', dilemma: dl.id, option: o.id }, () => t(o.label)) }, t(o.label)))),
      h('p.small.muted', {}, t(bi('Последствия решения вы увидите в журнале вечером и полностью — в разборе.', 'You will see the consequences in the evening log, and in full in the debrief.'))),
    );
  };

  const predictEl = () => {
    if (!predictAsk) return null;
    const opts: [string, Bi][] = [
      ['up', bi('вырастет', 'go up')],
      ['same', bi('не изменится', 'stay the same')],
      ['down', bi('уменьшится', 'go down')],
    ];
    return h(
      'div.fl-predict',
      {},
      h('p', {}, t(bi('Что будет? Как изменится время цикла за следующие 5 дней после нового лимита?', 'What will happen? How will cycle time change over the next 5 days with the new limit?'))),
      h(
        'div.fl-note-opts',
        {},
        ...opts.map(([id, label]) =>
          h(
            'button.btn.small',
            {
              type: 'button',
              onclick: () => {
                predict(s, 'first-limit', id);
                predictAsk = false;
                ctx.record({ kind: 'x.flowlab.predict', scenario: sc.id, choice: id });
                render();
              },
            },
            t(label),
          ),
        ),
      ),
    );
  };

  const topEl = () => {
    const m = s.money;
    const daysDone = s.history.length;
    return h(
      'header.fl-top',
      {},
      h('div.fl-day', {}, s.finished ? t(bi('Сценарий закончен', 'Scenario finished')) : t(fmt(bi('День {d} из {n}', 'Day {d} of {n}'), { d: daysDone + 1, n: sc.days }))),
      h(
        'dl.fl-money',
        {},
        h('div', {}, h('dt', {}, t(bi('потери от задержки', 'cost of delay'))), h('dd', {}, money(m.codLost))),
        sc.hasOps ? h('div', {}, h('dt', {}, t(bi('потери от сбоев', 'outage losses'))), h('dd', {}, money(m.downtimeLost))) : null,
        h('div', {}, h('dt', {}, t(bi('у покупателей', 'delivered'))), h('dd', {}, String(s.history[s.history.length - 1]?.doneTotal ?? 0))),
      ),
      h(
        'div.fl-actions',
        {},
        s.finished
          ? h('button.btn.primary', { type: 'button', onclick: () => ((view = 'debrief'), render()) }, t(bi('Разбор прогона', 'Debrief')), icon('next'))
          : [
              h('button.btn.primary.fl-end', { type: 'button', onclick: () => nextDay(), title: 'Enter' }, t(bi('Закончить день', 'End the day')), h('kbd', {}, '⏎')),
              h('button.btn', { type: 'button', onclick: skipToEvent, title: t(bi('Дни идут сами по вашим лимитам и порядку вытягивания, пока не придёт событие.', 'Days run by your limits and pull order until an event arrives.')) }, t(bi('До события', 'Skip to event'))),
            ],
        sc.features.wipLimits
          ? h(
              'label.fl-switch',
              {},
              h('input', { type: 'checkbox', checked: s.policies.strictWip, onchange: (e: Event) => doAct({ k: 'policy', strictWip: (e.target as HTMLInputElement).checked }) }),
              h('span.switch-track', { 'aria-hidden': 'true' }),
              t(bi('строгие лимиты', 'strict limits')),
            )
          : null,
        h('button.btn.ghost.small', { type: 'button', onclick: () => restart(s.seed), title: t(bi('Начать сначала с тем же вариантом случайных событий', 'Start again with the same seed')) }, icon('repeat'), t(bi('сначала', 'restart'))),
      ),
    );
  };

  const policyEl = () => {
    if (!sc.features.pullOrder && !sc.features.deployPolicy) return null;
    const seg = (name: string, opts: [string, Bi][], cur: string, on: (v: string) => void, disabled?: (v: string) => boolean) =>
      h(
        'div.segmented',
        { role: 'radiogroup', 'aria-label': name },
        ...opts.map(([v, label]) => h('label', {}, h('input', { type: 'radio', name: `${key}-${name}`, value: v, checked: cur === v, disabled: disabled?.(v), onchange: () => on(v) }), h('span', {}, t(label)))),
      );
    return h(
      'div.fl-policies',
      {},
      sc.features.pullOrder
        ? h('div.fl-pol', {}, h('span.k', {}, t(bi('Порядок вытягивания', 'Pull order'))), seg('pull', [['fifo', bi('старые первыми', 'oldest first')], ['cod', bi('по стоимости задержки', 'by cost of delay')], ['cd3', bi('CD3', 'CD3')]], s.policies.pullOrder, (v) => doAct({ k: 'policy', pullOrder: v as 'fifo' })), whyBtn('cod'))
        : null,
      sc.features.deployPolicy
        ? h(
            'div.fl-pol',
            {},
            h('span.k', {}, t(bi('Выкладка', 'Deployment'))),
            seg(
              'deploy',
              [
                ['train', bi('поезд раз в 5 дней', 'train every 5 days')],
                ['manual', bi('кнопкой', 'by button')],
                ['on-merge', bi('сама', 'by itself')],
              ],
              s.policies.deploy.mode,
              (v) => doAct({ k: 'policy', deploy: v === 'train' ? { mode: 'train', every: 5 } : v === 'manual' ? { mode: 'manual' } : { mode: 'on-merge' } }),
              (v) => v === 'on-merge' && !s.caps.autoDeploy,
            ),
            whyBtn('batch'),
          )
        : null,
      sc.hasOps ? capsEl() : null,
    );
  };

  const capsEl = () => {
    const c = s.caps;
    const items: [boolean, Bi][] = [
      [c.toilAutomation > 0, bi('скрипт заявок', 'request script')],
      [c.autoDeploy, bi('выкладка кнопкой', 'one-click deploy')],
      [c.rollback, bi('откат', 'rollback')],
      [c.testAutomation > 0, bi(`автотесты ${Math.round(c.testAutomation * 100)}%`, `automated checks ${Math.round(c.testAutomation * 100)}%`)],
      [c.monitoring === 'slo-alerts', bi('оповещения по бюджету', 'burn-rate alerts')],
      [c.runbooks, bi('инструкция дежурного', 'runbook')],
    ];
    return h('div.fl-pol', {}, h('span.k', {}, t(bi('Что уже есть', 'In place'))), h('span.fl-caps', {}, ...items.map(([on, label]) => h('span.fl-cap', { class: on ? 'on' : '' }, h('span.st-icon', { class: on ? 'ok' : '', 'aria-hidden': 'true' }, on ? '✓' : '·'), t(label)))));
  };

  const panelEl = () => {
    const tabs: [typeof tab, Bi, boolean][] = [
      ['flow', bi('Поток', 'Flow'), sc.features.cfd || sc.features.cycle || sc.features.throughput],
      ['dora', bi('DORA', 'DORA'), sc.features.dora],
      ['budget', bi('Надёжность', 'Reliability'), sc.features.budget],
      ['log', bi('Журнал', 'Log'), true],
      ['why', bi('Почему так', 'Why'), true],
    ];
    const open = tabs.filter((x) => x[2]);
    if (!open.some((x) => x[0] === tab)) tab = open[0][0];
    const body = h('div.fl-tabbody', { role: 'tabpanel' });
    const m = metrics(s, sc);
    if (tab === 'flow') {
      if (sc.features.cfd) body.append(h('figure.fl-fig', {}, cfdChart(s, sc), h('figcaption', {}, t(bi('Высота полосы — сколько карточек в колонке в конце дня. Расширяется полоса — там копится работа.', 'The height of a band is the number of cards in the column at the end of the day. A widening band is where work piles up.')), ' ', whyBtn('bottleneck'))));
      if (sc.features.cycle) body.append(h('figure.fl-fig', {}, scatterChart(s, sc), h('figcaption', {}, t(bi('Точка — законченная карточка: когда закончена и сколько дней была в работе.', 'A dot is a finished card: when it was finished and how many days it was in progress.')), ' ', whyBtn('cycle'))));
      if (sc.features.throughput) body.append(h('figure.fl-fig', {}, throughputChart(s, sc)));
      if (s.history.length >= 3) {
        const l = little(s);
        body.append(
          h(
            'p.fl-little',
            {},
            h('span.k', {}, t(bi('Закон Литтла', 'Little’s law'))),
            ' ',
            h('code', {}, `WIP ${l.wip} ≈ ${l.th} × ${l.ct} = ${l.product}`),
            ' ',
            l.stable ? null : h('span.fl-unstable', {}, h('span.st-icon.warn', { 'aria-hidden': 'true' }, '!'), t(bi('незавершённой работы всё больше — система нестабильна, равенство не выполняется', 'work in progress keeps growing — the system is unstable and the equality does not hold'))),
            whyBtn('little'),
          ),
        );
      }
    }
    if (tab === 'dora') {
      const tiles: [Bi, string, Bi][] = [
        [bi('Частота развёртываний', 'Deployment frequency'), `${m.deployFreq7}`, bi('выкладок за 7 дней', 'deployments in 7 days')],
        [bi('Время внесения изменения', 'Lead time for changes'), `${m.changeLeadMedianDays}`, bi('дней, медиана: от конца разработки до прода', 'days, median: from the end of development to production')],
        [bi('Доля неудачных изменений', 'Change failure rate'), `${Math.round(m.cfr * 100)}%`, bi('выкладок, после которых пришлось чинить', 'deployments that needed a fix')],
        [bi('Время восстановления', 'Failed deployment recovery time'), `${m.recoveryMedianMin}`, bi('минут, медиана', 'minutes, median')],
        [bi('Доля внеплановых выкладок', 'Deployment rework rate'), `${Math.round(m.reworkRate * 100)}%`, bi('хотфиксов после сбоев', 'hotfixes after outages')],
      ];
      body.append(h('div.fl-tiles', {}, ...tiles.map(([n, v, u]) => h('div.fl-tile', {}, h('p.fl-tile-name', {}, t(n)), h('p.fl-tile-val', {}, v), h('p.fl-tile-unit', {}, t(u))))), h('p.small', {}, whyBtn('dora')));
    }
    if (tab === 'budget' && sc.slo) {
      body.append(
        h('p', {}, t(fmt(bi('Цель: {p}% успешных запросов за 30 дней — {b} плохих минут бюджета.', 'Target: {p}% successful requests over 30 days — a budget of {b} bad minutes.'), { p: sc.slo.target * 100, b: m.budgetMin }))),
        budgetGauge(m.budgetLeftMin, m.budgetMin),
        h(
          'ul.fl-incidents',
          {},
          ...s.incidents.map((i) =>
            h(
              'li',
              {},
              h('span.st-icon.err', { 'aria-hidden': 'true' }, '⨯'),
              t(fmt(bi('День {d}: {k}, {m} мин, {r}% запросов — {b} плохих мин.', 'Day {d}: {ke}, {m} min, {r}% of requests — {b} bad min.'), { d: i.day, k: incidentName(i.kind).ru, ke: incidentName(i.kind).en, m: Math.round(i.downtime), r: Math.round(i.badRatio * 100), b: Math.round(i.badMinutes) })),
            ),
          ),
        ),
        h('p.small', {}, whyBtn('error-budget')),
      );
    }
    if (tab === 'log') {
      const days = [...new Set(s.log.map((e) => e.day))].reverse();
      body.append(
        h(
          'ol.fl-log',
          { reversed: true },
          ...days.slice(0, 8).map((d) =>
            h(
              'li',
              {},
              h('p.fl-log-day', {}, t(fmt(bi('День {d}', 'Day {d}'), { d }))),
              h('ul', {}, ...s.log.filter((e) => e.day === d).map((e) => h('li', { class: `kind-${e.kind}` }, e.tone ? h('span.st-icon', { class: e.tone, 'aria-hidden': 'true' }, e.tone === 'ok' ? '✓' : e.tone === 'err' ? '⨯' : '!') : null, t(e.text), ' ', whyBtn(e.why)))),
            ),
          ),
        ),
      );
    }
    if (tab === 'why') {
      body.append(
        h('p.small.muted', {}, t(bi('Модель открыта: всё, что происходит на доске, следует из этих правил. Ничего не подкручено.', 'The model is open: everything on the board follows from these rules. Nothing is rigged.'))),
        ...sc.theory.map((id) => theoryEl(id, false)).filter((x): x is HTMLElement => !!x),
      );
    }
    return h(
      'div.fl-panel',
      {},
      h('div.fl-tabs', { role: 'tablist' }, ...open.map(([id, label]) => h('button.fl-tab', { type: 'button', role: 'tab', 'aria-selected': tab === id ? 'true' : 'false', onclick: () => ((tab = id), render()) }, t(label)))),
      body,
    );
  };

  const theoryEl = (id: string, popup: boolean) => {
    const c = THEORY[id];
    if (!c) return null;
    return h(
      popup ? 'div.fl-theory.pop' : 'div.fl-theory',
      popup ? { role: 'dialog', 'aria-label': t(c.title) } : {},
      h('header', {}, h('h4', {}, t(c.title)), popup ? h('button.icon-btn', { type: 'button', 'aria-label': t(bi('Закрыть', 'Close')), onclick: () => ((whyOpen = null), render()) }, icon('close')) : null),
      h('p', {}, t(c.body)),
      c.formula ? h('pre.fl-formula', {}, c.formula) : null,
      h('p.small', {}, h('a', { href: `#/lesson/${c.lesson}` }, t(bi('Глава учебника', 'The textbook chapter'))), c.source ? [' · ', h('a', { href: c.source.url, target: '_blank', rel: 'noopener' }, c.source.title)] : null),
    );
  };

  function render(): void {
    const focusId = (document.activeElement as HTMLElement | null)?.dataset?.card ?? (document.activeElement as HTMLElement | null)?.dataset?.person;
    clear(el);
    if (view === 'debrief') {
      const host = h('div.fl-debrief-host');
      el.append(host);
      debrief?.dispose();
      debrief = mountDebrief(host, sc, s, {
        back: () => ((view = 'board'), render()),
        again: (seed) => restart(seed),
        record: ctx.record,
      });
      if (!completed) {
        completed = true;
        ctx.complete();
      }
      return;
    }
    put(
      el,
      topEl(),
      h('div.fl-brief', {}, h('p', {}, t(sc.brief)), h('p.fl-goal', {}, t(sc.goal)), h('ul.fl-goal-conditions', {}, ...goalConditions(sc, s).map(goal => h('li', {}, t(goal.text))))),
      noteEl(),
      predictEl(),
      policyEl(),
      sc.hasOps ? opsLane() : null,
      h('div.fl-board', { style: `--cols:${sc.columns.length}` }, ...sc.columns.map((c, i) => colEl(c, i))),
      flashEl,
      h('p.fl-hint.small.muted', {}, t(bi('Перетащите карточку в следующую колонку или нажмите на неё и стрелку. С клавиатуры: Tab к карточке, пробел — взять, ←/→ — выбрать колонку, пробел — положить, Esc — отмена. Enter — закончить день.', 'Drag a card into the next column or press its arrow. Keyboard: Tab to a card, Space to pick it up, ←/→ to choose a column, Space to drop, Esc to cancel. Enter ends the day.')), sc.features.stations ? t(bi(' Людей (бейджи) можно так же переставить в другую колонку.', ' People (badges) can be moved to another column the same way.')) : ''),
      panelEl(),
      whyOpen ? theoryEl(whyOpen, true) : null,
    );
    if (focusId) {
      const f = el.querySelector<HTMLElement>(`[data-card="${focusId}"], [data-person="${focusId}"]`);
      f?.focus({ preventScroll: true });
    }
  }

  // ── drag and drop (pointer events) and keyboard moves ──
  function columnsForPick(): HTMLElement[] {
    return [...el.querySelectorAll<HTMLElement>('.fl-col, .fl-ops')];
  }

  function dropOn(kind: 'card' | 'person', id: string, colEl_: HTMLElement | null): void {
    if (!colEl_) return;
    const stage = colEl_.dataset.col as Stage;
    if (kind === 'card') {
      const c = s.cards.find((x) => x.id === id);
      if (c) doAct({ k: 'move', card: id, to: stage }, () => moveSay(c, stage));
    } else if (stage !== 'backlog' && stage !== 'done' && stage !== 'deploy') {
      doAct({ k: 'station', role: id, stage: stage as WorkStage }, () => fmt(bi('{r} теперь работает в «{c}».', '{r} now works in “{e}”.'), { r: id, c: stage === 'ops' ? 'Эксплуатация' : colName(sc, stage).ru, e: stage === 'ops' ? 'Operations' : colName(sc, stage).en })[lang()]);
    }
  }

  function attachDrag(node: HTMLElement, kind: 'card' | 'person', id: string): void {
    node.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.fl-next, .fl-why-btn')) return;
      if (e.button !== 0) return;
      const x0 = e.clientX;
      const y0 = e.clientY;
      let ghost: HTMLElement | null = null;
      let over: HTMLElement | null = null;
      const move = (ev: PointerEvent) => {
        if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
        if (!ghost) {
          ghost = node.cloneNode(true) as HTMLElement;
          ghost.classList.add('fl-ghost');
          ghost.style.width = `${node.offsetWidth}px`;
          document.body.append(ghost);
          node.classList.add('dragging');
        }
        ghost.style.transform = `translate(${ev.clientX - 20}px, ${ev.clientY - 16}px)`;
        ghost.style.display = 'none';
        const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('.fl-col, .fl-ops') ?? null;
        ghost.style.display = '';
        if (under !== over) {
          over?.classList.remove('target', 'bad');
          over = under;
          if (over) {
            const stage = over.dataset.col as Stage;
            const ok = kind === 'card' ? canMove(s, sc, id, stage).ok : stage !== 'backlog' && stage !== 'done' && stage !== 'deploy';
            over.classList.add('target');
            if (!ok) over.classList.add('bad');
          }
        }
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        node.classList.remove('dragging');
        if (ghost) {
          ghost.remove();
          over?.classList.remove('target', 'bad');
          dropOn(kind, id, over);
        }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
  }

  const onKey = (e: KeyboardEvent) => {
    const tgt = e.target as HTMLElement;
    if (tgt.closest('input, textarea, select') || view !== 'board') return;
    const cardId = tgt.dataset?.card;
    const personId = tgt.dataset?.person;
    const cols = columnsForPick();
    if (picked) {
      const idxs = cols.map((c) => Number(c.dataset.idx));
      let pos = idxs.indexOf(picked.target);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') pos = Math.min(idxs.length - 1, pos + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') pos = Math.max(0, pos - 1);
      else if (e.key === 'Escape') {
        picked = null;
        say(t(bi('Отменено.', 'Cancelled.')));
        render();
        e.preventDefault();
        return;
      } else if (e.key === ' ' || e.key === 'Enter') {
        const p0 = picked;
        picked = null;
        dropOn(p0.kind, p0.id, cols.find((c) => Number(c.dataset.idx) === p0.target) ?? null);
        render();
        e.preventDefault();
        return;
      } else return;
      picked.target = idxs[pos];
      const name = cols[pos]?.getAttribute('aria-label') ?? '';
      say(fmt(bi('Колонка «{c}». Пробел — положить.', 'Column “{c}”. Space to drop.'), { c: name })[lang()]);
      render();
      e.preventDefault();
      return;
    }
    if ((e.key === ' ' || e.key === 'Enter') && (cardId || personId)) {
      if (cardId) {
        const c = s.cards.find((x) => x.id === cardId);
        const i = c ? sc.columns.indexOf(c.stage) : -1;
        if (!c || c.lane === 'ops' || i < 0) return;
        picked = { kind: 'card', id: cardId, target: Math.min(sc.columns.length - 1, i + 1) };
        say(fmt(bi('Взята «{t}». Стрелками выберите колонку.', 'Picked up “{te}”. Choose a column with the arrow keys.'), { t: c.title.ru, te: c.title.en })[lang()]);
      } else if (personId && sc.features.stations) {
        const pr = s.people.find((x) => x.role === personId)!;
        picked = { kind: 'person', id: personId, target: pr.station === 'ops' ? -1 : sc.columns.indexOf(pr.station) };
        say(fmt(bi('{r}: стрелками выберите колонку.', '{r}: choose a column with the arrow keys.'), { r: personId })[lang()]);
      }
      render();
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' && !tgt.closest('button, a')) {
      nextDay();
      e.preventDefault();
    }
  };
  el.addEventListener('keydown', onKey);
  const offLang = onLangChange(() => render());

  // Restore a saved run.
  void store.loadSnapshot<RunLog>(key).then((saved) => {
    if (!saved || saved.v !== 1 || saved.scenario !== sc.id) return;
    try {
      run = saved;
      s = replayLog(sc, run);
      if (s.finished) view = 'debrief';
      render();
    } catch {
      /* a run from an older version of the scenario: start fresh */
    }
  });
  render();

  return {
    dispose() {
      el.removeEventListener('keydown', onKey);
      offLang();
      debrief?.dispose();
      clearTimeout(flashTimer);
    },
    describe() {
      const m = metrics(s, sc);
      const cols = workColumns(sc)
        .map((c) => `${colName(sc, c).en} ${inColumn(s, c).length}${limitOf(s, c) !== null ? '/' + limitOf(s, c) : ''}`)
        .join(', ');
      return `flowlab ${sc.id}, day ${s.history.length + 1} of ${sc.days}. Columns: ${cols}. Delivered ${m.doneCount}, cycle time p85 ${m.cycleP85} d, cost of delay ${Math.round(m.codLost)} RUB.`;
    },
  };
}

export function incidentName(kind: string): Bi {
  switch (kind) {
    case 'checkout-broken':
      return bi('не проходит оформление заказа', 'checkout fails');
    case 'slow':
      return bi('сайт медленный', 'the site is slow');
    case 'down':
      return bi('сайт недоступен', 'the site is down');
    default:
      return bi('нагрузка', 'load');
  }
}
