// The on-call shift (10 §6.4), training version on a board: three incidents
// that overlap, a board "New → Investigating → Mitigated → Closed" with at
// most one card in Investigating. There is no countdown here: the timed
// shift is the `final.exam.oncall` exam on the block page. The shift is
// saved after every action, so a reload offers to continue it. Graded: the
// incident with the biggest user impact is taken first; a later alert is
// announced in the chat, not silently dropped; each drill passes its rubric
// (fixed, no destructive action before evidence); the low-impact incident is
// resolved without hiding it; a blameless four-line review is written. The
// result is logged as a training run of `final.oncall`.

import { clear, h, icon, put } from '../../../core/dom';
import { bi, fmt, t, type Bi } from '../../../core/i18n';
import { store } from '../../../core/store';
import type { Mounted, WidgetReg } from '../../../core/types';
import { meanScore, statusParts } from '../../../engine/quiz/rubric';
import { load, prose, save } from './ui';
import { DRILL_504, DRILL_DISK } from '../data/drills';
import { mountDrill, type DrillAction, type DrillResult } from './drill';

export const ONCALL_EXAM_ID = 'final.oncall';
/** The length of the graded shift on the block page; the training board has no timer. */
export const SHIFT_MINUTES = 60;
const SAVE_KEY = 'oncall.shift';

type Col = 'new' | 'doing' | 'mitigated' | 'closed';
type CardId = 'checkout' | 'ci' | 'disk';

interface Card {
  id: CardId;
  title: Bi;
  impact: Bi;
  at: string;
  col: Col;
  deferNote?: string;
}

interface ShiftResult {
  priority?: boolean;
  announce?: boolean;
  checkout?: DrillResult;
  disk?: DrillResult;
  ci?: boolean;
  review?: boolean;
}

/** Everything needed to continue an interrupted shift. */
interface SavedShift {
  elapsed: number;
  cards: { id: CardId; col: Col; deferNote?: string }[];
  res: ShiftResult;
  alerted: boolean;
  alertOpen: boolean;
  drills: Partial<Record<'checkout' | 'disk', { variant: string; actions: DrillAction[] }>>;
}

const O = {
  intro: bi(
    'У тренировочной смены нет таймера, и работать можно в своём темпе. Инциденты приходят по одному, но не ждут, пока вы закончите с предыдущим. В ответ на ваши команды и выбор шага доска показывает то, что показал бы настоящий сервер, а сломать здесь что-нибудь настоящее нельзя. Доска сохраняет смену после каждого шага, поэтому её можно прервать и продолжить позже. В конце вы пишете разбор главного инцидента без поиска виноватых.',
    'The training shift has no time limit, so you can work at your own pace. Incidents arrive one by one but do not wait for each other. In answer to your commands and step choices the board shows what a real server would show, and nothing real can be broken here. The board saves the shift after every step, so you can stop and continue later. At the end you write a blameless review of the main incident.',
  ),
  start: bi('Начать смену', 'Start the shift'),
  resume: bi('Продолжить смену', 'Continue the shift'),
  restart: bi('Начать заново', 'Start over'),
  saved: bi('У вас есть незаконченная смена. Её можно продолжить с того места, где вы остановились.', 'You have an unfinished shift. You can continue it from where you stopped.'),
  elapsed: bi('прошло {m} мин', '{m} min so far'),
  wipNote: bi('не больше одной карточки', 'one card at most'),
  cols: { new: bi('Новое', 'New'), doing: bi('Разбираю', 'Investigating'), mitigated: bi('Сервис возвращён', 'Mitigated'), closed: bi('Закрыто', 'Closed') } as Record<Col, Bi>,
  take: bi('Взять в работу', 'Take it'),
  wip: bi('В колонке «Разбираю» уже есть инцидент, а больше одного там держать нельзя.', 'Investigating already holds an incident: the limit is 1.'),
  pickFirst: bi('На доске два инцидента. Какой возьмёте первым?', 'Two incidents are on the board. Which do you take first?'),
  newAlert: bi('Пока вы работаете, пришёл новый алерт. Что будете делать?', 'While you work, a new alert arrives. What do you do?'),
  announce: bi('Объявить в чате и продолжить текущий', 'Announce it in the chat and carry on with the current one'),
  switchNow: bi('Бросить текущий и переключиться', 'Drop the current one and switch'),
  ignore: bi('Не отвлекаться, ничего не писать', 'Stay focused, write nothing'),
  note: bi('Напишите в чат, что вы видите, когда возьмёте инцидент в работу и почему не сейчас', 'Write to the chat what you see, when you will take the incident and why not now'),
  noteSend: bi('Отправить', 'Send'),
  ciTitle: bi('Конвейер ветки main третий час красный', 'The main pipeline has been red for three hours'),
  ciPrompt: bi('Тест `test_checkout_timeout` не проходит через раз. Что вы будете делать?', 'A test fails every other run: `test_checkout_timeout`. What do you do?'),
  ciOptions: [
    { id: 'retry', text: bi('Поставить `retry: 5` на задание с тестами', 'Put `retry: 5` on the test job'), ok: false, why: bi('Так нестабильность только прячется, потому что тест будет проходить случайно, а настоящая ошибка проскочит незамеченной.', 'This only hides the flakiness, because the test will pass by chance and a real regression will slip through unnoticed.') },
    { id: 'allow', text: bi('Поставить заданию с тестами `allow_failure: true`', 'Make the test job `allow_failure: true`'), ok: false, why: bi('Это выключает проверку целиком, а такой обходной путь на экзаменах не засчитывается.', 'Turns the check off entirely — a workaround that never counts on an exam.') },
    { id: 'quarantine', text: bi('Найти нестабильный тест, отправить его в карантин, завести на него задачу с ответственным и перезапустить конвейер', 'Find the flaky test, quarantine it with a ticket and an owner, re-run the pipeline'), ok: true, why: bi('Выкладки снова идут, а тест не забыт, потому что у задачи о нём есть ответственный и срок.', 'Releases flow again and the test is not forgotten, because the ticket about it has an owner and a deadline.') },
  ],
  review: bi('Разбор главного инцидента из четырёх частей, без поиска виноватых', 'A four-line review of the main incident — without blame'),
  rTimeline: bi('Хронология, то есть ключевые моменты и время каждого', 'The timeline, that is, the key moments and the time of each'),
  rImpact: bi('Влияние, то есть кто пострадал и насколько', 'The impact, that is, who was affected and how much'),
  rFactors: bi('Способствующие факторы, то есть условия в системе, по одному на строку', 'Contributing factors, that is, conditions of the system, one per line'),
  rActions: bi('Действия, то есть изменения, которые можно проверить, и у каждого из них есть ответственный и срок', 'Actions, that is, changes that can be checked, each with an owner and a date'),
  finish: bi('Сдать смену', 'Hand over the shift'),
  passed: bi('Смена сдана', 'Shift passed'),
  failed: bi('Смена пока не сдана', 'Shift not passed yet'),
  lines: {
    priority: bi('Первым взят инцидент с наибольшим влиянием', 'The highest-impact incident was taken first'),
    announce: bi('О новом алерте сообщили в чате, а не бросили его', 'The new alert was announced in the chat, not dropped'),
    checkout: bi('После ошибки 504 сервис возвращён, причина устранена, и до сбора улик не было разрушительных действий', 'After the 504 the service is restored, the cause is removed, and there were no destructive steps before the evidence was gathered'),
    disk: bi('Место на диске освобождено безопасно, и повторение предотвращено', 'Disk space is freed safely, and a recurrence is prevented'),
    ci: bi('Конвейер починен без обходных путей', 'The pipeline is fixed without workarounds'),
    review: bi('В разборе есть хронология, влияние, два или больше условий в системе и действия с ответственными, а виноватых не ищут', 'Review: timeline, impact, two or more system conditions, actions with owners, no blame'),
    rubric: bi('Средний балл тренировок не ниже 2 и ни одного нуля по безопасности', 'Mean drill score ≥ 2 and no zero for safety'),
  },
  again: bi('Новая смена', 'A new shift'),
};

const BLAME = /(винов|по вине|не проверил|недосмотр|невнимательн|человеческий фактор|blame|fault of|didn'?t check|careless|human error)/i;

/** Local checks of a blameless review (10 §6.4). */
export function reviewOk(r: { timeline: string; impact: string; factors: string; actions: string }): boolean {
  const factors = r.factors.split(/\n|;/).map((x) => x.trim()).filter((x) => x.length > 5);
  return /\d{1,2}[:.]\d{2}/.test(r.timeline) && statusParts(r.impact).impact && factors.length >= 2 && !BLAME.test(`${r.factors} ${r.actions}`) && /\d|до |by |owner|владел|ответствен|@/i.test(r.actions);
}

const CARD_INFO: Record<CardId, { title: Bi; impact: Bi; at: string }> = {
  ci: { title: O.ciTitle, impact: bi('выкладки стоят, а пользователей это не задевает', 'releases blocked, users unaffected'), at: '14:02' },
  checkout: { title: bi('HighErrorRate: оформление заказа отвечает ошибкой 504', 'HighErrorRate: checkout returns 504'), impact: bi('около 30 % запросов оплаты заканчиваются ошибкой', 'about 30% of checkout requests fail'), at: '14:10' },
  disk: { title: bi('DiskWillFillIn4Hours: диск сервера shop заполнится примерно через 4 часа', 'DiskWillFillIn4Hours: the shop server disk fills up in about 4 hours'), impact: bi('пользователей это пока не задевает', 'users are not affected yet'), at: '14:19' },
};

const makeCard = (id: CardId, col: Col = 'new', deferNote?: string): Card => ({ id, ...CARD_INFO[id], col, deferNote });

export const oncallWidget: WidgetReg = {
  id: 'career.oncall',
  mount(el, _props, ctx): Mounted {
    const root = h('div.cw-oncall');
    const mounts: Mounted[] = [];
    let iv: number | undefined;
    let onIntro = false;
    const stopAll = () => {
      mounts.splice(0).forEach((m) => m.dispose());
      clearInterval(iv);
    };

    const intro = (saved?: SavedShift) => {
      stopAll();
      onIntro = true;
      clear(root);
      if (saved)
        put(
          root,
          prose(O.intro),
          h('p.small', {}, t(O.saved)),
          h('div.row', {}, h('button.btn.primary', { type: 'button', onclick: () => run(saved) }, icon('play'), t(O.resume)), h('button.btn.ghost', { type: 'button', onclick: () => run() }, icon('repeat'), t(O.restart))),
        );
      else put(root, prose(O.intro), h('button.btn.primary', { type: 'button', onclick: () => run() }, icon('play'), t(O.start)));
    };

    const run = (saved?: SavedShift) => {
      onIntro = false;
      stopAll();
      const sessionStart = Date.now();
      const elapsedBefore = saved?.elapsed ?? 0;
      const elapsed = () => elapsedBefore + (Date.now() - sessionStart);
      const cards: Card[] = saved ? saved.cards.map((c) => makeCard(c.id, c.col, c.deferNote)) : [makeCard('ci'), makeCard('checkout')];
      const res: ShiftResult = saved ? { ...saved.res } : {};
      const drills: SavedShift['drills'] = saved ? { ...saved.drills } : {};
      let alerted = saved?.alerted ?? false;
      let alertOpen = saved?.alertOpen ?? false;
      let ended = false;
      const persist = () => {
        if (ended) return;
        const snap: SavedShift = { elapsed: elapsed(), cards: cards.map((c) => ({ id: c.id, col: c.col, deferNote: c.deferNote })), res, alerted, alertOpen, drills };
        save(SAVE_KEY, snap);
      };
      const clock = h('span.small.muted');
      const tick = () => {
        clock.textContent = t(fmt(O.elapsed, { m: Math.floor(elapsed() / 60000) }));
      };
      iv = window.setInterval(tick, 15000);
      tick();
      const board = h('div.cw-board');
      const work = h('div.cw-work');

      const drawBoard = () => {
        clear(board);
        const doing = cards.some((c) => c.col === 'doing');
        for (const col of ['new', 'doing', 'mitigated', 'closed'] as Col[]) {
          board.append(
            h(
              'section.cw-col',
              { 'data-col': col },
              h('h4', {}, t(O.cols[col]), col === 'doing' ? h('span.muted.small', {}, ` · ${t(O.wipNote)}`) : null),
              ...cards.filter((c) => c.col === col).map((c) =>
                h(
                  'article.cw-card',
                  {},
                  h('p.small.muted', {}, c.at),
                  h('p', {}, t(c.title)),
                  h('p.small', {}, t(c.impact)),
                  c.deferNote ? h('p.small.muted', {}, `${t(bi('Чат', 'Chat'))}: ${c.deferNote}`) : null,
                  col === 'new' ? h('button.btn.small', { type: 'button', disabled: doing, title: doing ? t(O.wip) : undefined, onclick: () => take(c) }, t(O.take)) : null,
                ),
              ),
            ),
          );
        }
      };

      const open = (c: Card) => {
        clear(work);
        if (alertOpen) alertArrives(false);
        if (c.id === 'checkout') runDrill(c, DRILL_504, 'checkout');
        else if (c.id === 'disk') runDrill(c, DRILL_DISK, 'disk');
        else runCi(c);
      };

      const take = (c: Card) => {
        if (cards.some((x) => x.col === 'doing')) return;
        if (res.priority === undefined) res.priority = c.id === 'checkout';
        c.col = 'doing';
        drawBoard();
        persist();
        open(c);
      };

      const runDrill = (c: Card, drill: typeof DRILL_504, key: 'checkout' | 'disk') => {
        const host = h('div');
        work.append(host);
        mounts.push(
          mountDrill(host, drill, {
            resume: drills[key],
            onProgress: (variant, actions) => {
              drills[key] = { variant, actions: [...actions] };
              persist();
            },
            onMove: (s) => {
              if (key === 'checkout' && !alerted && s.path.length >= 3) {
                alerted = true;
                alertArrives(true);
              }
              if (s.path.some((p) => p.right && p.tags.includes('mitigate')) && c.col === 'doing') {
                c.col = 'mitigated';
                drawBoard();
              }
              persist();
            },
            onDone: (r) => {
              res[key] = r;
              delete drills[key];
              c.col = 'closed';
              drawBoard();
              mounts.splice(0).forEach((m) => m.dispose());
              clear(work);
              if (alertOpen) alertArrives(false);
              persist();
              if (allClosed()) reviewStep();
            },
          }),
        );
      };

      const alertArrives = (fresh: boolean) => {
        let disk = cards.find((x) => x.id === 'disk');
        if (!disk) {
          disk = makeCard('disk');
          cards.push(disk);
          drawBoard();
        }
        alertOpen = true;
        if (fresh) persist();
        const card = disk;
        const box = h('div.cw-alert', { role: 'alert' });
        const choose = (id: 'announce' | 'switch' | 'ignore') => {
          clear(box);
          if (id === 'announce') {
            const ta = h('textarea', { rows: 2, 'aria-label': t(O.note), placeholder: t(O.note) }) as HTMLTextAreaElement;
            const send = h('button.btn.small', { type: 'button' }, t(O.noteSend));
            send.addEventListener('click', () => {
              card.deferNote = ta.value.trim();
              res.announce = card.deferNote.length >= 10;
              alertOpen = false;
              box.remove();
              drawBoard();
              persist();
            });
            put(box, h('p.small', {}, t(O.note)), ta, send);
          } else {
            res.announce = false;
            alertOpen = false;
            box.remove();
            if (id === 'switch') {
              const cur = cards.find((x) => x.col === 'doing');
              if (cur) cur.col = 'new';
              if (cur?.id === 'checkout' || cur?.id === 'disk') delete drills[cur.id];
              mounts.splice(0).forEach((m) => m.dispose());
              clear(work);
              drawBoard();
            }
            persist();
          }
        };
        put(
          box,
          h('p', {}, h('strong', {}, t(O.newAlert)), ' ', t(card.title)),
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
              persist();
              setTimeout(() => {
                clear(work);
                if (alertOpen) alertArrives(false);
                if (allClosed()) reviewStep();
              }, 1200);
            } else persist();
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
          finish();
        });
        put(work, h('h3', {}, t(O.review)), tl.row, im.row, fa.row, ac.row, h('div.row', {}, btn));
      };

      const finish = () => {
        const minutes = Math.max(1, Math.round(elapsed() / 60000));
        ended = true;
        stopAll();
        save(SAVE_KEY, null);
        const done = [res.checkout, res.disk].filter(Boolean) as DrillResult[];
        const rubricOk = done.length === 2 && meanScore(done.flatMap((d) => d.scores)) >= 2 && done.every((d) => !d.safetyZero);
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
        store.record({ kind: 'exam.result', exam: ONCALL_EXAM_ID, mode: 'training', score, passed });
        clear(root);
        put(
          root,
          h('h3', {}, t(passed ? O.passed : O.failed), ' · ', `${Math.round(score * 100)}%`),
          h('ul.placement-results', {}, ...lines.map(([b, ok]) => h('li', { class: ok ? 'ok' : 'err' }, h('span.st-icon', { 'aria-hidden': 'true' }, ok ? '✓' : '⨯'), t(b)))),
          h('p.small.muted', {}, t(fmt(bi('Смена заняла {m} мин. На зачётной смене в экзамене блока на всё даётся {n} мин.', 'The shift took {m} min. The graded shift in the block exam gives {n} min for everything.'), { m: minutes, n: SHIFT_MINUTES }))),
          h('button.btn.ghost', { type: 'button', onclick: () => intro() }, icon('repeat'), t(O.again)),
        );
        ctx.complete();
      };

      clear(root);
      put(root, h('header.exam-head', {}, h('h3', {}, t(bi('Смена дежурного', 'On-call shift'))), clock), board, h('p.small', {}, t(O.pickFirst)), work);
      drawBoard();
      const active = cards.find((c) => c.col === 'doing');
      if (active) open(active);
      else if (alertOpen) alertArrives(false);
      else if (allClosed()) reviewStep();
      persist();
    };

    clear(el);
    el.append(root);
    intro();
    void load<SavedShift | null>(SAVE_KEY).then((saved) => {
      if (saved && onIntro && Array.isArray(saved.cards)) intro(saved);
    });
    return { dispose: () => (stopAll(), clear(el)), describe: () => t(bi('Смена дежурного', 'On-call shift')) };
  },
};
