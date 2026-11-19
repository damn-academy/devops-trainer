// О-3 "The job search funnel as a flow" (10 §5.2): the same board and flow
// metrics as in the methodology block. Little's law: work in progress =
// throughput × time in the system. The conversions are a model, not market
// statistics; the screen says so.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';

type P = { rate: number; reply: number; letter: boolean; tech: number };

/** Days each stage takes on average (apply → reply waits a week). */
export const STAGE_DAYS = { reply: 7, screen: 3, tech: 5, final: 4, offer: 2 };
const SCREEN = 0.5;
const FINAL = 0.5;

export interface FunnelNumbers {
  perWeek: { reply: number; screen: number; tech: number; final: number; offer: number };
  wip: number;
  pathWeeks: number;
  /** Expected weeks until the first offer: the path plus the wait for one offer to come through. */
  weeksToOffer: number;
}

export function funnelNumbers(p: P, paused = false): FunnelNumbers {
  const rate = paused ? 0 : p.rate;
  const replyConv = Math.min(0.9, (p.reply / 100) * (p.letter ? 1.6 : 1));
  const reply = rate * replyConv;
  const screen = reply * SCREEN;
  const tech = screen * (p.tech / 100);
  const final = tech * FINAL;
  const offer = final;
  const pathDays = STAGE_DAYS.reply + STAGE_DAYS.screen + STAGE_DAYS.tech + STAGE_DAYS.final + STAGE_DAYS.offer;
  const wip = rate * (STAGE_DAYS.reply / 7) + reply * (STAGE_DAYS.screen / 7) + screen * (STAGE_DAYS.tech / 7) + tech * (STAGE_DAYS.final / 7) + final * (STAGE_DAYS.offer / 7);
  const weeksToOffer = offer > 0 ? pathDays / 7 + 1 / offer : Infinity;
  return { perWeek: { reply, screen, tech, final, offer }, wip, pathWeeks: pathDays / 7, weeksToOffer };
}

const r1 = (x: number) => (Math.round(x * 10) / 10).toString();
const card = (whatRu: string, whatEn: string, whoRu: string, whoEn: string) => ({ what: bi(whatRu, whatEn), who: bi(whoRu, whoEn) });

const STAGES = [
  { id: 'apply', ru: 'Отклик', en: 'Applied', x: 24, y: 56 },
  { id: 'reply', ru: 'Ответ', en: 'Replied', x: 304, y: 56 },
  { id: 'screen', ru: 'Скрининг', en: 'Screening', x: 584, y: 56 },
  { id: 'tech', ru: 'Техническое', en: 'Technical', x: 584, y: 248 },
  { id: 'final', ru: 'Финал', en: 'Final', x: 304, y: 248 },
  { id: 'offer', ru: 'Оффер', en: 'Offer', x: 24, y: 248 },
];

export const funnelModel = defineModel<P>({
  id: 'career.funnel',
  block: 'career',
  title: bi('Воронка поиска работы как поток', 'The job search funnel as a flow'),
  summary: bi('Отклики идут по колонкам, как задачи по канбан-доске. Сколько их в работе и когда придёт первый оффер — считает закон Литтла.', 'Applications move through columns like tasks on a kanban board. How many are in progress and when the first offer arrives follow from Little’s law.'),
  concepts: ['career.funnel', 'career.rule-60'],
  diagram: {
    width: 960,
    height: 368,
    nodes: [
      ...STAGES.map((s) => ({
        id: s.id,
        label: bi(s.ru, s.en),
        sub: '—',
        family: s.id === 'offer' ? ('flow' as const) : ('neutral' as const),
        shape: 'buffer' as const,
        x: s.x,
        y: s.y,
        w: 160,
        h: 88,
        card: card(
          {
            apply: 'Отправленные отклики, на которые ещё не ответили. Обычно ждут около недели.',
            reply: 'Компания ответила и зовёт на разговор.',
            screen: 'Разговор с рекрутером: мотивация, ожидания, формат.',
            tech: 'Техническое интервью с инженером.',
            final: 'Разговор с руководителем.',
            offer: 'Предложение работы.',
          }[s.id]!,
          {
            apply: 'Applications sent and not answered yet. They usually wait about a week.',
            reply: 'The company replied and invites you to talk.',
            screen: 'A talk with a recruiter: motivation, expectations, format.',
            tech: 'A technical interview with an engineer.',
            final: 'A talk with the manager.',
            offer: 'A job offer.',
          }[s.id]!,
          'Ты и компания, по одной карточке на вакансию.',
          'You and the company, one card per vacancy.',
        ),
      })),
      { id: 'no', label: bi('Отказ или тишина', 'Rejected or silent'), sub: '—', family: 'neutral', x: 784, y: 248, w: 160, h: 88, card: card('Большая часть откликов заканчивается здесь — это норма воронки, а не оценка тебя. Карточку без ответа старше 14 дней закрывают.', 'Most applications end here — that is how a funnel works, not a verdict on you. A card with no reply older than 14 days is closed.', 'Рынок.', 'The market.') },
    ],
    edges: [
      { id: 'e1', from: 'apply', to: 'reply', label: bi('ответили', 'replied'), card: card('Конверсия первого этапа: её поднимает резюме с подтверждениями и письмо под вакансию.', 'The first-stage conversion: a CV with evidence and a letter for the vacancy raise it.', 'Рекрутер.', 'The recruiter.') },
      { id: 'e2', from: 'reply', to: 'screen', label: bi('созвон', 'call'), card: card('Почти все ответы ведут к скринингу.', 'Nearly every reply leads to a screening.', 'Рекрутер.', 'The recruiter.') },
      { id: 'e3', from: 'screen', to: 'tech', label: bi('прошёл', 'passed'), card: card('Здесь решают самопрезентация и мотивация.', 'Self-presentation and motivation decide here.', 'Рекрутер.', 'The recruiter.') },
      { id: 'e4', from: 'tech', to: 'final', label: bi('прошёл', 'passed'), card: card('Здесь решают механизмы, ситуационный вопрос и пет-проекты.', 'Mechanisms, the situational question and pet projects decide here.', 'Инженер.', 'The engineer.') },
      { id: 'e5', from: 'final', to: 'offer', label: bi('оффер', 'offer'), card: card('Финал: команда и ожидания с обеих сторон.', 'The final: the team and expectations on both sides.', 'Руководитель.', 'The manager.') },
      { id: 'e-no', from: 'apply', to: 'no', label: bi('нет ответа', 'no reply'), via: [[104, 24], [864, 24]], card: card('Отклики без ответа — большая часть воронки.', 'Applications without a reply are most of the funnel.', 'Рынок.', 'The market.') },
    ],
  },
  params: [
    {
      id: 'rate',
      label: bi('Откликов в неделю', 'Applications a week'),
      kind: 'range',
      min: 3,
      max: 30,
      step: 1,
      default: 12,
      near: 'apply',
      predict: {
        prompt: bi('Откликов в неделю станет больше. Что будет со временем до первого оффера?', 'There will be more applications a week. What happens to the time to a first offer?'),
        options: [
          { id: 'shorter', text: bi('Сократится', 'It gets shorter') },
          { id: 'same', text: bi('Не изменится: путь всё равно три недели', 'No change: the path is still three weeks') },
          { id: 'longer', text: bi('Вырастет', 'It gets longer') },
        ],
        resolve: (prev, next) => {
          const w = (s: Step[]) => s[s.length - 1]?.metrics?.weeks ?? 0;
          return w(next) < w(prev) ? 'shorter' : w(next) > w(prev) ? 'longer' : 'same';
        },
      },
    },
    { id: 'reply', label: bi('Ответов на 100 откликов', 'Replies per 100 applications'), kind: 'range', min: 5, max: 50, step: 1, unit: '%', default: 15, near: 'reply' },
    {
      id: 'letter',
      label: bi('Письмо под каждую вакансию', 'A letter written for each vacancy'),
      kind: 'toggle',
      default: false,
      near: 'apply',
      predict: {
        prompt: bi('Ты начал писать письмо под каждую вакансию. Какая конверсия вырастет?', 'You started writing a letter for each vacancy. Which conversion grows?'),
        options: [
          { id: 'reply', text: bi('Отклик → ответ', 'Applied → replied') },
          { id: 'tech', text: bi('Техническое → финал', 'Technical → final') },
        ],
        resolve: () => 'reply',
      },
    },
    { id: 'tech', label: bi('Проходишь техническое, из 100', 'Technical interviews passed, of 100'), kind: 'range', min: 10, max: 80, step: 5, unit: '%', default: 30, near: 'tech', levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    {
      id: 'pause',
      label: bi('Перестать откликаться на время учёбы', 'Stop applying while studying'),
      remove: ['e1'],
      predict: {
        prompt: bi('Ты перестал откликаться. Через сколько недель доска опустеет при пути в три недели?', 'You stopped applying. With a three-week path, in how many weeks does the board empty?'),
        options: [
          { id: '1', text: bi('Через неделю', 'In a week') },
          { id: '3', text: bi('Примерно через три недели', 'In about three weeks') },
          { id: 'never', text: bi('Никогда: старые отклики останутся', 'Never: old applications stay') },
        ],
        resolve: () => '3',
      },
    },
  ],
  metrics: [
    { id: 'wip', label: bi('в работе', 'in progress') },
    { id: 'offers', label: bi('офферов в неделю', 'offers a week') },
    { id: 'weeks', label: bi('недель до первого оффера', 'weeks to the first offer') },
  ],
  run(p, broken): Step[] {
    const paused = broken.has('pause');
    const n = funnelNumbers(p, paused);
    const pw = n.perWeek;
    const fill = (x: number) => Math.min(1, x / 12);
    const m = { wip: Math.round(n.wip), offers: Math.round(pw.offer * 100) / 100, weeks: Number.isFinite(n.weeksToOffer) ? Math.round(n.weeksToOffer) : 999 };
    if (paused) {
      const live = funnelNumbers(p, false);
      return [
        { id: 'stop', label: bi('пауза', 'pause'), caption: bi('Новых откликов нет. Карточки, что уже в воронке, ещё движутся.', 'No new applications. The cards already in the funnel still move.'), focus: ['apply', 'e1'], states: { e1: 'off' }, values: { apply: '0 / wk' }, fill: { apply: 0 }, metrics: { wip: Math.round(live.wip), offers: 0, weeks: 999 } },
        {
          id: 'empty',
          label: bi('пусто', 'empty'),
          caption: bi('Через три недели — длину пути — доска пустеет. Время до оффера растёт на паузу плюс всю длину воронки.', 'After three weeks — the length of the path — the board is empty. The time to an offer grows by the pause plus the whole length of the funnel.'),
          focus: ['reply', 'screen', 'tech', 'final'],
          fill: { reply: 0, screen: 0, tech: 0, final: 0 },
          metrics: { wip: 0, offers: 0, weeks: 999 },
          broken: { at: 'apply', message: 'applications this week: 0\nin progress after 3 weeks: 0', caption: bi('поиск — поток: его нельзя поставить на паузу без потерь.', 'the search is a flow: it cannot be paused without a loss.') },
        },
      ];
    }
    return [
      { id: 'apply', label: bi('отклики', 'apply'), caption: fmt(bi('Ты отправляешь {r} откликов в неделю; каждый ждёт ответа около недели.', 'You send {r} applications a week; each waits for a reply about a week.'), { r: p.rate }), focus: ['apply'], values: { apply: `${p.rate} / wk` }, fill: { apply: fill(p.rate) } },
      { id: 'reply', label: bi('ответы', 'replies'), caption: fmt(p.letter ? bi('Отвечают на {c}% — это {n} в неделю благодаря письмам под вакансию.', '{c}% get a reply — {n} a week, thanks to letters for each vacancy.') : bi('Отвечают на {c}% — это {n} в неделю.', '{c}% get a reply — {n} a week.'), { c: Math.round(Math.min(90, p.reply * (p.letter ? 1.6 : 1))), n: r1(pw.reply) }), focus: ['e1', 'reply', 'e-no', 'no'], tokens: [{ edge: 'e1' }, { edge: 'e-no' }], values: { reply: `${r1(pw.reply)} / wk`, no: `${r1(p.rate - pw.reply)} / wk` }, fill: { reply: fill(pw.reply) } },
      { id: 'screen', label: bi('скрининг', 'screening'), caption: fmt(bi('Скрининг проходит половина: {n} в неделю идут на техническое.', 'Half pass the screening: {n} a week go to the technical round.'), { n: r1(pw.screen) }), focus: ['e2', 'screen', 'e3'], tokens: [{ edge: 'e2' }], values: { screen: `${r1(pw.screen)} / wk` }, fill: { screen: fill(pw.screen) } },
      { id: 'tech', label: bi('техническое', 'technical'), caption: fmt(bi('Техническое проходит {t}%: {n} в неделю.', '{t}% pass the technical round: {n} a week.'), { t: p.tech, n: r1(pw.tech) }), focus: ['e3', 'tech', 'e4'], tokens: [{ edge: 'e3' }], values: { tech: `${r1(pw.tech)} / wk` }, fill: { tech: fill(pw.tech) } },
      { id: 'offer', label: bi('оффер', 'offer'), caption: fmt(bi('После финала — {n} оффера в неделю, то есть один примерно раз в {w} нед.', 'After the final round: {n} offers a week, roughly one every {w} weeks.'), { n: r1(pw.offer), w: pw.offer > 0 ? r1(1 / pw.offer) : '∞' }), focus: ['e4', 'final', 'e5', 'offer'], tokens: [{ edge: 'e5' }], values: { final: `${r1(pw.final)} / wk`, offer: `${r1(pw.offer)} / wk` }, fill: { final: fill(pw.final), offer: fill(pw.offer * 4) } },
      { id: 'little', label: bi('закон Литтла', 'Little’s law'), caption: fmt(bi('В работе около {w} карточек: поток × время в системе. Первый оффер — примерно через {k} нед.: путь в три недели плюс ожидание одного успешного прохода.', 'About {w} cards are in progress: flow × time in the system. The first offer comes in about {k} weeks: the three-week path plus the wait for one successful run.'), { w: m.wip, k: m.weeks }), focus: STAGES.map((s) => s.id), metrics: m },
    ];
  },
  explainDelta(prev, next, change, a, b): Bi {
    const w = (s: Step[]) => s[s.length - 1]?.metrics ?? {};
    if (change.kind === 'break') return change.on ? bi('Поток остановлен: через длину пути доска пустеет, и вся воронка начнётся заново.', 'The flow is stopped: after the length of the path the board is empty and the whole funnel starts over.') : bi('Поток идёт снова.', 'The flow runs again.');
    const k0 = w(prev).weeks;
    const k1 = w(next).weeks;
    if (change.id === 'letter') return b.letter ? fmt(bi('Письмо под вакансию поднимает долю ответов; первый оффер — через {k} нед. вместо {k0}.', 'A letter for the vacancy raises the reply rate; the first offer comes in {k} weeks instead of {k0}.'), { k: k1, k0 }) : bi('Без писем под вакансию отвечают реже: воронка сужается с первого этапа.', 'Without a letter for each vacancy fewer reply: the funnel narrows from the first stage.');
    if (change.id === 'rate') return fmt(bi('{a} → {b} откликов в неделю: в работе {w} карточек, первый оффер — через {k} нед.', '{a} → {b} applications a week: {w} cards in progress, the first offer in {k} weeks.'), { a: a.rate, b: b.rate, w: w(next).wip, k: k1 });
    return fmt(bi('Конверсия этапа изменилась: первый оффер — через {k} нед. вместо {k0}. Сильнее всего время ограничивает самый узкий этап.', 'A stage conversion changed: the first offer comes in {k} weeks instead of {k0}. The narrowest stage limits the time most.'), { k: k1, k0 });
  },
});
