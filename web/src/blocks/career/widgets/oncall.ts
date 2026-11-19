// The on-call shift (10 §6.4), simulator version: 60 minutes on a hard
// timer, three incidents that overlap, a board "New → Investigating →
// Mitigated → Closed" with WIP 1 in Investigating. Graded: the incident with
// the biggest user impact is taken first; a later alert is announced in the
// chat, not silently dropped; each drill passes its rubric (fixed, no
// destructive action before evidence); the low-impact incident is resolved
// without hiding it; a blameless four-line review is written. The result is
// logged as the `final.oncall` exam. The mentor is off throughout.

import { clear, h, icon, put } from '../../../core/dom';
import { bi, fmt, t, type Bi } from '../../../core/i18n';
import { store } from '../../../core/store';
import type { Mounted, WidgetReg } from '../../../core/types';
import { meanScore, statusParts } from '../../../engine/quiz/rubric';
import { prose } from './ui';
import { DRILL_504, DRILL_DISK } from '../data/drills';
import { mountDrill, type DrillResult } from './drill';

export const ONCALL_EXAM_ID = 'final.oncall';
export const SHIFT_MINUTES = 60;

type Col = 'new' | 'doing' | 'mitigated' | 'closed';

interface Card {
  id: 'checkout' | 'ci' | 'disk';
  title: Bi;
  impact: Bi;
  at: string;
  col: Col;
  deferNote?: string;
}

const O = {
  intro: bi(
    'Смена длится 60 минут на жёстком таймере. Инциденты приходят по одному, но не ждут друг друга. Встроенный наставник выключен; команды и выбор шага показывают то, что показал бы настоящий сервер. В конце — разбор без виноватых по главному инциденту.',
    'The shift lasts 60 minutes on a hard timer. Incidents arrive one by one but do not wait for each other. The built-in mentor is off; commands and step choices show what a real server would show. At the end, a blameless review of the main incident.',
  ),
  start: bi('Начать смену', 'Start the shift'),
  cols: { new: bi('Новое', 'New'), doing: bi('Разбираю', 'Investigating'), mitigated: bi('Смягчено', 'Mitigated'), closed: bi('Закрыто', 'Closed') } as Record<Col, Bi>,
  take: bi('Взять в работу', 'Take it'),
  wip: bi('В «Разбираю» уже есть инцидент: лимит 1.', 'Investigating already holds an incident: the limit is 1.'),
  pickFirst: bi('На доске два инцидента. Какой берёшь первым?', 'Two incidents are on the board. Which do you take first?'),
  newAlert: bi('Пока ты работаешь, пришёл новый алерт. Что делаешь?', 'While you work, a new alert arrives. What do you do?'),
  announce: bi('Объявить в чате и продолжить текущий', 'Announce it in the chat and carry on with the current one'),
  switchNow: bi('Бросить текущий и переключиться', 'Drop the current one and switch'),
  ignore: bi('Не отвлекаться, ничего не писать', 'Stay focused, write nothing'),
  note: bi('Сообщение в чат: что видишь, когда возьмёшь и почему не сейчас', 'A chat message: what you see, when you will take it and why not now'),
  noteSend: bi('Отправить', 'Send'),
  ciTitle: bi('Конвейер main красный третий час', 'The main pipeline has been red for three hours'),
  ciPrompt: bi('Красный тест падает через раз: `test_checkout_timeout`. Что делаешь?', 'A test fails every other run: `test_checkout_timeout`. What do you do?'),
  ciOptions: [
    { id: 'retry', text: bi('Поставить `retry: 5` на джобу тестов', 'Put `retry: 5` on the test job'), ok: false, why: bi('Прячет нестабильность: тест будет «зелёным» случайно, а настоящая регрессия проскочит.', 'Hides the flakiness: the test turns “green” by chance and a real regression slips through.') },
    { id: 'allow', text: bi('Сделать джобу тестов `allow_failure: true`', 'Make the test job `allow_failure: true`'), ok: false, why: bi('Выключает проверку целиком — обходной путь, который на экзаменах не засчитывается.', 'Turns the check off entirely — a workaround that never counts on an exam.') },
    { id: 'quarantine', text: bi('Найти нестабильный тест, вынести его в карантин с задачей и владельцем, перезапустить конвейер', 'Find the flaky test, quarantine it with a ticket and an owner, re-run the pipeline'), ok: true, why: bi('Выкладки снова идут, а тест не потерян: у него есть владелец и срок.', 'Releases flow again and the test is not lost: it has an owner and a deadline.') },
  ],
  review: bi('Разбор главного инцидента в четыре строки — без поиска виноватых', 'A four-line review of the main incident — without blame'),
  rTimeline: bi('Хронология: ключевые моменты со временем', 'Timeline: the key moments with times'),
  rImpact: bi('Влияние: кто пострадал и насколько', 'Impact: who was affected and how much'),
  rFactors: bi('Способствующие факторы: условия системы, по одному на строку', 'Contributing factors: conditions of the system, one per line'),
  rActions: bi('Действия: проверяемые изменения, у каждого владелец и срок', 'Actions: checkable changes, each with an owner and a date'),
  finish: bi('Сдать смену', 'Hand over the shift'),
  timeUp: bi('Время смены вышло.', 'The shift time is up.'),
  passed: bi('Смена сдана', 'Shift passed'),
  failed: bi('Смена пока не сдана', 'Shift not passed yet'),
  lines: {
    priority: bi('Первым взят инцидент с наибольшим влиянием', 'The highest-impact incident was taken first'),
    announce: bi('Новый алерт объявлен в чате, а не брошен', 'The new alert was announced in the chat, not dropped'),
    checkout: bi('504: сервис возвращён, причина устранена, без разрушающих шагов до улик', '504: service restored, cause removed, no destructive steps before evidence'),
    disk: bi('Диск: место освобождено безопасно, повтор предотвращён', 'Disk: space freed safely, recurrence prevented'),
    ci: bi('Конвейер: починен без обходных путей', 'Pipeline: fixed without workarounds'),
    review: bi('Разбор: хронология, влияние, два и больше условия системы, действия с владельцем, без виноватых', 'Review: timeline, impact, two or more system conditions, actions with owners, no blame'),
    rubric: bi('Средний балл дриллов ≥ 2 и ни одного нуля по безопасности', 'Mean drill score ≥ 2 and no zero for safety'),
  },
  again: bi('Новая смена', 'A new shift'),
};

const BLAME = /(винов|по вине|не проверил|недосмотр|невнимательн|человеческий фактор|blame|fault of|didn'?t check|careless|human error)/i;

/** Local checks of a blameless review (10 §6.4). */
export function reviewOk(r: { timeline: string; impact: string; factors: string; actions: string }): boolean {
  const factors = r.factors.split(/\n|;/).map((x) => x.trim()).filter((x) => x.length > 5);
  return /\d{1,2}[:.]\d{2}/.test(r.timeline) && statusParts(r.impact).impact && factors.length >= 2 && !BLAME.test(`${r.factors} ${r.actions}`) && /\d|до |by |owner|владел|ответствен|@/i.test(r.actions);
}

export const oncallWidget: WidgetReg = {
  id: 'career.oncall',
  mount(el, _props, ctx): Mounted {
    const root = h('div.cw-oncall');
    const mounts: Mounted[] = [];
    let iv: number | undefined;
    const stopAll = () => {
      mounts.splice(0).forEach((m) => m.dispose());
      clearInterval(iv);
    };

    const intro = () => {
      stopAll();
      clear(root);
      put(root, prose(O.intro), h('button.btn.primary', { type: 'button', onclick: () => run() }, icon('play'), t(O.start)));
    };

    const run = () => {
      const started = Date.now();
      const cards: Card[] = [
        { id: 'ci', title: O.ciTitle, impact: bi('выкладки стоят, пользователи не затронуты', 'releases blocked, users unaffected'), at: '14:02', col: 'new' },
        { id: 'checkout', title: bi('HighErrorRate: оформление заказа отдаёт 504', 'HighErrorRate: checkout returns 504'), impact: bi('около 30% запросов оплаты падают', 'about 30% of checkout requests fail'), at: '14:10', col: 'new' },
      ];
      const res: { priority?: boolean; announce?: boolean; checkout?: DrillResult; disk?: DrillResult; ci?: boolean; review?: boolean } = {};
      let alerted = false;
      let ended = false;
      const timer = h('span.exam-timer');
      const board = h('div.cw-board');
      const work = h('div.cw-work');
      const tick = () => {
        const left = Math.max(0, SHIFT_MINUTES * 60 - (Date.now() - started) / 1000);
        timer.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
        timer.classList.toggle('over', left <= 600);
        if (left <= 0 && !ended) finish(true);
      };
      iv = window.setInterval(tick, 1000);
      tick();

      const drawBoard = () => {
        clear(board);
        const doing = cards.some((c) => c.col === 'doing');
        for (const col of ['new', 'doing', 'mitigated', 'closed'] as Col[]) {
          board.append(
            h(
              'section.cw-col',
              { 'data-col': col },
              h('h4', {}, t(O.cols[col]), col === 'doing' ? h('span.muted.small', {}, ' · WIP 1') : null),
              ...cards.filter((c) => c.col === col).map((c) =>
                h(
                  'article.cw-card',
                  {},
                  h('p.small.muted', {}, c.at),
                  h('p', {}, t(c.title)),
                  h('p.small', {}, t(c.impact)),
                  c.deferNote ? h('p.small.muted', {}, `${t(bi("Чат", "Chat"))}: ${c.deferNote}`) : null,
                  col === 'new' ? h('button.btn.small', { type: 'button', disabled: doing, title: doing ? t(O.wip) : undefined, onclick: () => take(c) }, t(O.take)) : null,
                ),
              ),
            ),
          );
        }
      };

      const take = (c: Card) => {
        if (cards.some((x) => x.col === 'doing')) return;
        if (res.priority === undefined) res.priority = c.id === 'checkout';
        c.col = 'doing';
        drawBoard();
        clear(work);
        if (c.id === 'checkout') runDrill(c, DRILL_504, 'checkout');
        else if (c.id === 'disk') runDrill(c, DRILL_DISK, 'disk');
        else runCi(c);
      };

      const runDrill = (c: Card, drill: typeof DRILL_504, key: 'checkout' | 'disk') => {
        const host = h('div');
        work.append(host);
        mounts.push(
          mountDrill(host, drill, {
            onMove: (s) => {
              if (key === 'checkout' && !alerted && s.path.length >= 3) {
                alerted = true;
                alertArrives();
              }
              if (s.path.some((p) => p.right && p.tags.includes('mitigate')) && c.col === 'doing') {
                c.col = 'mitigated';
                drawBoard();
              }
            },
            onDone: (r) => {
              res[key] = r;
              c.col = 'closed';
              drawBoard();
              clear(work);
              if (allClosed()) reviewStep();
            },
          }),
        );
      };

      const alertArrives = () => {
        const disk: Card = { id: 'disk', title: bi('DiskWillFillIn4Hours на сервере shop', 'DiskWillFillIn4Hours on the shop server'), impact: bi('пока никого: запас около 4 часов', 'nobody yet: about 4 hours of headroom'), at: '14:19', col: 'new' };
        cards.push(disk);
        drawBoard();
        const box = h('div.cw-alert', { role: 'alert' });
        const choose = (id: 'announce' | 'switch' | 'ignore') => {
          clear(box);
          if (id === 'announce') {
            const ta = h('textarea', { rows: 2, 'aria-label': t(O.note), placeholder: t(O.note) }) as HTMLTextAreaElement;
            const send = h('button.btn.small', { type: 'button' }, t(O.noteSend));
            send.addEventListener('click', () => {
              disk.deferNote = ta.value.trim();
              res.announce = disk.deferNote.length >= 10;
              box.remove();
              drawBoard();
            });
            put(box, h('p.small', {}, t(O.note)), ta, send);
          } else {
            res.announce = false;
            box.remove();
            if (id === 'switch') {
              const cur = cards.find((x) => x.col === 'doing');
              if (cur) cur.col = 'new';
              stopAll();
              iv = window.setInterval(tick, 1000);
              clear(work);
              drawBoard();
            }
          }
        };
        put(
          box,
          h('p', {}, h('strong', {}, t(O.newAlert)), ' ', t(disk.title)),
          h('div.cw-options', {}, h('button.cw-option', { type: 'button', onclick: () => choose('announce') }, t(O.announce)), h('button.cw-option', { type: 'button', onclick: () => choose('switch') }, t(O.switchNow)), h('button.cw-option', { type: 'button', onclick: () => choose('ignore') }, t(O.ignore))),
        );
        work.prepend(box);
      };

      const runCi = (c: Card) => {
        const out = h('div');
        const opts = h('div.cw-options', {}, ...O.ciOptions.map((o) => h('button.cw-option', {
          type: 'button',
          onclick: () => {
            clear(out);
            out.append(prose(o.why, `prose cw-why ${o.ok ? 'ok' : 'warn'}`));
            if (res.ci === undefined) res.ci = o.ok;
            if (o.ok) {
              c.col = 'closed';
              drawBoard();
              setTimeout(() => {
                clear(work);
                if (allClosed()) reviewStep();
              }, 1200);
            }
          },
        }, prose(o.text, 'prose cw-opt-text'))));
        put(work, h('h3', {}, t(O.ciTitle)), prose(O.ciPrompt), opts, out);
      };

      const allClosed = () => cards.length === 3 && cards.every((c) => c.col === 'closed');

      const reviewStep = () => {
        clear(work);
        const f = (b: Bi) => {
          const ta = h('textarea', { rows: 2, 'aria-label': t(b) }) as HTMLTextAreaElement;
          return { ta, row: h('label.cw-field', {}, h('span', {}, t(b)), ta) };
        };
        const tl = f(O.rTimeline);
        const im = f(O.rImpact);
        const fa = f(O.rFactors);
        const ac = f(O.rActions);
        const btn = h('button.btn.primary', { type: 'button' }, t(O.finish));
        btn.addEventListener('click', () => {
          res.review = reviewOk({ timeline: tl.ta.value, impact: im.ta.value, factors: fa.ta.value, actions: ac.ta.value });
          finish(false);
        });
        put(work, h('h3', {}, t(O.review)), tl.row, im.row, fa.row, ac.row, h('div.row', {}, btn));
      };

      const finish = (timeUp: boolean) => {
        ended = true;
        stopAll();
        const drills = [res.checkout, res.disk].filter(Boolean) as DrillResult[];
        const rubricOk = drills.length === 2 && meanScore(drills.flatMap((d) => d.scores)) >= 2 && drills.every((d) => !d.safetyZero);
        const lines: [Bi, boolean][] = [
          [O.lines.priority, !!res.priority],
          [O.lines.announce, !!res.announce],
          [O.lines.checkout, !!res.checkout?.fixed && !res.checkout.safetyZero],
          [O.lines.disk, !!res.disk?.fixed && !res.disk.safetyZero],
          [O.lines.ci, !!res.ci],
          [O.lines.rubric, rubricOk],
          [O.lines.review, !!res.review],
        ];
        const critical = !!res.checkout?.fixed && !!res.disk?.fixed && rubricOk;
        const score = lines.filter(([, ok]) => ok).length / lines.length;
        const passed = critical && score >= 0.7;
        store.record({ kind: 'exam.result', exam: ONCALL_EXAM_ID, mode: 'exam', score, passed });
        clear(root);
        put(
          root,
          timeUp ? h('p.cw-mark.warn', {}, t(O.timeUp)) : null,
          h('h3', {}, t(passed ? O.passed : O.failed), ' · ', `${Math.round(score * 100)}%`),
          h('ul.placement-results', {}, ...lines.map(([b, ok]) => h('li', { class: ok ? 'ok' : 'err' }, h('span.st-icon', { 'aria-hidden': 'true' }, ok ? '✓' : '⨯'), t(b)))),
          h('p.small.muted', {}, t(fmt(bi('Время смены: {m} мин из {n}.', 'Shift time: {m} of {n} min.'), { m: Math.max(1, Math.round((Date.now() - started) / 60000)), n: SHIFT_MINUTES }))),
          h('button.btn.ghost', { type: 'button', onclick: intro }, icon('repeat'), t(O.again)),
        );
        ctx.complete();
      };

      clear(root);
      put(root, h('header.exam-head', {}, h('h3', {}, t(bi('Смена дежурного', 'On-call shift'))), timer), board, h('p.small', {}, t(O.pickFirst)), work);
      drawBoard();
    };

    clear(el);
    el.append(root);
    intro();
    return { dispose: () => (stopAll(), clear(el)), describe: () => t(bi('Смена дежурного', 'On-call shift')) };
  },
};
