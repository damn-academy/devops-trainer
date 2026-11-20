// О-3 "The job search funnel as a flow" (10 §5.2): the same board and flow
// metrics as in the methodology block. Little's law: work in progress =
// throughput × time in the system. The conversions are a model, not market
// statistics; the screen says so.
//
// Reading order: at the start only the first column (applications sent) and
// the goal (an offer) are on the picture. Each step moves the week's cards one
// column further: the column that receives them appears, says how many cards
// it gets a week, and the number travels along the line as a card. The
// applications that get no reply go to their own column. The last step adds
// everything up with Little's law.

import { defineModel } from '../../../core/define';
import { bi, t, type Bi } from '../../../core/i18n';
import type { NodeIcon, Step } from '../../../core/types';
import { fmtb, nouned, num1, startWith } from './util';

type P = { rate: number; reply: number; letter: boolean; tech: number };

/** Days each stage takes on average (apply → reply waits a week). */
export const STAGE_DAYS = { reply: 7, screen: 3, tech: 5, final: 4, offer: 2 };
/** An application with no reply stays on the board until it is closed after 14 days (the card-age rule). */
export const SILENT_DAYS = 14;
const SCREEN = 0.5;
const FINAL = 0.5;

export interface FunnelNumbers {
  perWeek: { reply: number; screen: number; tech: number; final: number; offer: number };
  wip: number;
  /** Average weeks a card spends on the board, so that wip = rate × avgWeeks (Little's law). */
  avgWeeks: number;
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
  const silent = rate - reply;
  const wip = reply * (STAGE_DAYS.reply / 7) + silent * (SILENT_DAYS / 7) + reply * (STAGE_DAYS.screen / 7) + screen * (STAGE_DAYS.tech / 7) + tech * (STAGE_DAYS.final / 7) + final * (STAGE_DAYS.offer / 7);
  const weeksToOffer = offer > 0 ? pathDays / 7 + 1 / offer : Infinity;
  return { perWeek: { reply, screen, tech, final, offer }, wip, avgWeeks: rate ? wip / rate : 0, pathWeeks: pathDays / 7, weeksToOffer };
}

const card = (whatRu: string, whatEn: string, whoRu: string, whoEn: string) => ({ what: bi(whatRu, whatEn), who: bi(whoRu, whoEn) });
const perWeek = (x: number): Bi => fmtb(bi('{n} в неделю', '{n} a week'), { n: num1(x) });
const OTKL: [string, string, string] = ['отклик', 'отклика', 'откликов'];
const OTV: [string, string, string] = ['ответ', 'ответа', 'ответов'];
const KARD: [string, string, string] = ['карточка', 'карточки', 'карточек'];
const NED: [string, string, string] = ['неделю', 'недели', 'недель'];
const apps = (x: number) => nouned(x, OTKL, ['application', 'applications']);
const weeks = (x: number) => nouned(x, NED, ['week', 'weeks']);

const STAGES: { id: string; ru: string; en: string; x: number; y: number; icon: NodeIcon; what: [string, string]; who: [string, string] }[] = [
  { id: 'apply', ru: 'Отклики', en: 'Applied', x: 24, y: 56, icon: 'file', what: ['Отклики, которые вы отправили и на которые ещё не ответили. Ответа обычно ждут около недели.', 'Applications sent and not answered yet. They usually wait about a week.'], who: ['Отклики отправляете вы, по одной карточке на вакансию.', 'You, one card per vacancy.'] },
  { id: 'reply', ru: 'Ответ компании', en: 'Replied', x: 304, y: 56, icon: 'user', what: ['Компания ответила на отклик и зовёт на первый разговор.', 'The company replied and invites you to talk.'], who: ['Отвечает рекрутер компании.', 'The company’s recruiter.'] },
  { id: 'screen', ru: 'Скрининг', en: 'Screening', x: 584, y: 56, icon: 'user', what: ['Разговор с рекрутером о мотивации, ожиданиях и формате работы. Скрининг проходит примерно половина кандидатов.', 'A talk with a recruiter: motivation, expectations, format. About half pass.'], who: ['Разговор ведёт рекрутер.', 'The recruiter.'] },
  { id: 'tech', ru: 'Техническое интервью', en: 'Technical', x: 584, y: 248, icon: 'terminal', what: ['Техническое интервью с инженером команды. Инженер спрашивает о механизмах, задаёт ситуационный вопрос и обсуждает ваши пет-проекты.', 'A technical interview with an engineer: mechanisms, a situational question, your pet projects.'], who: ['Интервью проводит инженер.', 'An engineer.'] },
  { id: 'final', ru: 'Финал', en: 'Final', x: 304, y: 248, icon: 'user', what: ['Разговор с руководителем о команде, процессах и ожиданиях с обеих сторон. В модели финал проходит половина дошедших до него.', 'A talk with the manager about the team and expectations. In the model half pass.'], who: ['Разговор ведёт руководитель.', 'The manager.'] },
  { id: 'offer', ru: 'Предложение работы', en: 'Offer', x: 24, y: 248, icon: 'file', what: ['Компания предлагает вам работу, и ради этого предложения работает вся воронка.', 'The company offers you a job, and the whole funnel works for the sake of this offer.'], who: ['Предложение делает компания.', 'The company.'] },
];

const ALL = ['apply', 'reply', 'screen', 'tech', 'final', 'offer', 'no', 'e1', 'e2', 'e3', 'e4', 'e5', 'e-no'];

export const funnelModel = defineModel<P>({
  id: 'career.funnel',
  frame: 'visible',
  block: 'career',
  title: bi('Как воронка поиска работы работает в виде потока', 'How the job search funnel works as a flow'),
  summary: bi(
    'Каждый отклик изображён карточкой, которая неделями движется по колонкам: отклик, ответ компании, скрининг, техническое интервью, финал и предложение работы. На каждом этапе часть карточек отсеивается. Схема показывает, сколько карточек за неделю доходит до каждой колонки, сколько их у вас в работе одновременно и через сколько недель придёт первое предложение. Доли ответов здесь взяты для примера, а не из статистики рынка.',
    'Every application is a card moving through columns for weeks: applied, replied, screening, technical, final and offer. At each stage some cards drop out. The diagram shows how many cards reach each column a week, how many are in progress at once and how many weeks the first offer takes. The rates are an example, not market statistics.',
  ),
  intro: bi(
    'Схема собирается по шагам, и сейчас на ней только колонка откликов и цель, то есть предложение работы. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге карточки переходят в следующую колонку. Облачко у этой колонки говорит, сколько карточек она получает за неделю, а по линии к ней передаётся это число. Заполненность колонки показывает, сколько карточек в ней сейчас.\n\nКогда дойдёте до итога, поменяйте в «Параметрах» число откликов в неделю или включите письмо под каждую вакансию и посмотрите, как изменится срок до первого предложения.',
    'The diagram builds itself step by step, and now it shows only the applications column and the goal, that is, an offer. Press “Start from the first step”, then go on with “Step forward” above the diagram. At each step the cards move to the next column. The callout at that column says how many cards it gets a week, and that number travels along the line to it. How full a column is shows how many cards are in it.\n\nAt the end, change the number of applications a week or switch on a letter for each vacancy in “Parameters” and see how the time to the first offer changes.',
  ),
  legend: [
    { mark: 'active', text: bi('колонка, в которую сейчас приходят карточки', 'the column receiving cards now') },
    { mark: 'say', text: bi('сколько карточек колонка получает за неделю', 'how many it gets a week') },
    { mark: 'token', text: bi('сколько карточек в неделю переходит дальше', 'how many cards a week move on') },
    { mark: 'icon:file', text: bi('ваш отклик или предложение работы', 'your application or an offer') },
    { mark: 'icon:user', text: bi('разговор с рекрутером или руководителем', 'a talk with a recruiter or the manager') },
    { mark: 'icon:terminal', text: bi('техническое интервью', 'the technical interview') },
    { mark: 'icon:folder', text: bi('закрытые карточки без ответа', 'closed cards with no reply') },
    { mark: 'warn', text: bi('колонка опустела', 'the column is empty') },
  ],
  stopLabel: bi('Поток откликов остановился', 'The flow stopped'),
  concepts: ['career.funnel', 'career.rule-60'],
  diagram: {
    width: 960,
    height: 368,
    nodes: [
      ...STAGES.map((s) => ({
        id: s.id,
        label: bi(s.ru, s.en),
        icon: s.icon,
        sub: '—',
        family: s.id === 'offer' ? ('flow' as const) : ('neutral' as const),
        shape: 'buffer' as const,
        x: s.x,
        y: s.y,
        w: 152,
        h: 88,
        card: card(s.what[0], s.what[1], s.who[0], s.who[1]),
      })),
      { id: 'no', label: bi('Отказ или тишина', 'Rejected or silent'), icon: 'folder', sub: '—', family: 'neutral', x: 800, y: 248, w: 144, h: 88, card: card('Сюда уходит большая часть откликов, и это обычная работа воронки, а не оценка вас. Карточку, на которую 14 дней нет ответа, закрывают и больше не ждут.', 'Most applications end here; that is how a funnel works, not a verdict on you. A card with no reply for 14 days is closed.', 'Ответа не дают компании, которые выбрали других кандидатов или не разобрали отклики.', 'Companies that chose others or never read the application.') },
    ],
    edges: [
      { id: 'e1', from: 'apply', to: 'reply', label: bi('есть ответ', 'replied'), card: card('Первый переход воронки. Его делают шире резюме с подтверждениями навыков и письмо, написанное под вакансию.', 'The first transition: a CV with evidence and a letter for the vacancy widen it.', 'Решает рекрутер.', 'The recruiter.') },
      { id: 'e2', from: 'reply', to: 'screen', label: bi('звонок рекрутера', 'recruiter call'), card: card('Почти каждый ответ компании ведёт к разговору с рекрутером.', 'Nearly every reply leads to a screening call.', 'Звонок назначает рекрутер.', 'The recruiter.') },
      { id: 'e3', from: 'screen', to: 'tech', label: bi('скрининг пройден', 'screening passed'), card: card('На этом переходе решают самопрезентация и мотивация.', 'Self-presentation and motivation decide here.', 'Решает рекрутер.', 'The recruiter.') },
      { id: 'e4', from: 'tech', to: 'final', label: bi('интервью пройдено', 'interview passed'), card: card('Здесь решают понимание механизмов, ответ на ситуационный вопрос и пет-проекты.', 'Mechanisms, the situational question and pet projects decide here.', 'Решает инженер.', 'The engineer.') },
      { id: 'e5', from: 'final', to: 'offer', label: bi('предложение', 'offer'), card: card('После финала компания делает предложение тем, с кем совпали ожидания.', 'After the final the company makes an offer.', 'Решает руководитель.', 'The manager.') },
      { id: 'e-no', from: 'apply', to: 'no', label: bi('нет ответа', 'no reply'), via: [[100, 24], [872, 24]], card: card('Сюда попадают отклики, на которые не ответили, и таких откликов большинство.', 'Applications without a reply end up here, and they are the majority.', 'Молчат компании, которые выбрали других кандидатов или не разобрали отклики.', 'Companies.') },
    ],
  },
  params: [
    {
      id: 'rate',
      label: bi('Сколько откликов вы отправляете в неделю', 'Applications you send a week'),
      kind: 'range',
      min: 3,
      max: 30,
      step: 1,
      default: 12,
      near: 'apply',
      group: bi('Ваши отклики', 'Your applications'),
      predict: {
        prompt: bi('Вы меняете число откликов в неделю, а доли ответов на всех этапах остаются прежними. Как время до первого предложения работы связано с числом откликов?', 'You change the number of applications a week; the rates at every stage stay. How does the time to the first offer follow the number of applications?'),
        options: [
          { id: 'inverse', text: bi('Чем больше откликов в неделю, тем раньше придёт первое предложение', 'The more applications a week, the sooner the first offer') },
          { id: 'same', text: bi('Никак не связано, потому что путь карточки всё равно занимает три недели', 'It does not depend on it at all, because a card’s path still takes three weeks') },
          { id: 'direct', text: bi('Чем больше откликов в неделю, тем позже придёт первое предложение', 'The more applications a week, the later the first offer') },
        ],
        resolve: (prev, next) => {
          const m = (s: Step[]) => s[s.length - 1]?.metrics ?? {};
          const dw = (m(next).weeks ?? 0) - (m(prev).weeks ?? 0);
          const dr = (m(next).wip ?? 0) - (m(prev).wip ?? 0);
          if (dw === 0 || dr === 0) return 'same';
          return Math.sign(dw) !== Math.sign(dr) ? 'inverse' : 'direct';
        },
      },
    },
    {
      id: 'letter',
      label: bi('К каждому отклику приложено письмо под вакансию', 'Each application has a letter for the vacancy'),
      kind: 'toggle',
      default: false,
      near: 'apply',
      group: bi('Ваши отклики', 'Your applications'),
      predict: {
        prompt: bi('Вы начинаете писать письмо под каждую вакансию. Какой переход воронки от этого станет шире?', 'You start writing a letter for each vacancy. Which transition widens?'),
        options: [
          { id: 'reply', text: bi('Переход от отклика к ответу компании, потому что на отклик с письмом чаще отвечают', 'The transition from application to reply, because applications with a letter get more replies') },
          { id: 'tech', text: bi('Переход от технического интервью к финалу, потому что письмо помогает на интервью', 'The transition from the technical interview to the final, because the letter helps at the interview') },
        ],
        resolve: () => 'reply',
      },
    },
    { id: 'reply', label: bi('Сколько компаний из 100 отвечают на отклик', 'Companies out of 100 that reply'), kind: 'range', min: 5, max: 50, step: 1, unit: '%', default: 15, near: 'reply', group: bi('Как отвечают компании', 'How companies answer') },
    { id: 'tech', label: bi('Сколько технических интервью из 100 вы проходите', 'Technical interviews you pass, of 100'), kind: 'range', min: 10, max: 80, step: 5, unit: '%', default: 30, near: 'tech', levels: ['intermediate', 'experienced'], group: bi('Как отвечают компании', 'How companies answer') },
  ],
  breaks: [
    {
      id: 'pause',
      label: bi('Перестать откликаться на время учёбы', 'Stop applying while studying'),
      remove: ['e1'],
      predict: {
        prompt: bi('Вы перестали откликаться на время учёбы, а путь карточки от отклика до предложения занимает около трёх недель. Через сколько недель доска опустеет?', 'You stopped applying while studying; a card’s path takes about three weeks. In how many weeks does the board empty?'),
        options: [
          { id: '1', text: bi('Через неделю', 'In a week') },
          { id: '3', text: bi('Примерно через три недели', 'In about three weeks') },
          { id: 'never', text: bi('Никогда, потому что старые отклики так и останутся на доске', 'Never, because old applications will stay on the board') },
        ],
        resolve: () => '3',
      },
    },
  ],
  metrics: [
    { id: 'wip', label: bi('карточек в работе', 'cards in progress') },
    { id: 'offers', label: bi('предложений в неделю', 'offers a week') },
    { id: 'weeks', label: bi('недель до первого предложения', 'weeks to the first offer') },
  ],
  run(p, broken): Step[] {
    const paused = broken.has('pause');
    const n = funnelNumbers(p, paused);
    const pw = n.perWeek;
    const fill = (x: number) => Math.min(1, x / 12);
    const m = { wip: Math.round(n.wip), offers: Math.round(pw.offer * 100) / 100, weeks: Math.round(n.weeksToOffer) };
    const start = startWith(ALL, 'apply', 'offer');
    if (paused) {
      const live = funnelNumbers(p, false);
      return [
        {
          id: 'stop',
          label: bi('пауза', 'pause'),
          caption: bi('Вы перестали отправлять отклики. Карточки, которые уже идут по воронке, ещё движутся, но новых в первую колонку не приходит. Срок до первого предложения схема больше не считает. Карточки, которые уже в пути, ещё могут дойти до предложения, но других карточек не будет, и если ни одна из этих не дойдёт до конца, предложения не будет вовсе.', 'You stopped sending applications. Cards already in the funnel still move, but no new ones arrive. The diagram no longer counts the time to the first offer. The cards already on the way may still reach an offer, but no others will follow, and if none of them gets through, there will be no offer at all.'),
          focus: ['apply'],
          say: { apply: bi('Новых откликов нет, поэтому в первую колонку ничего не приходит.', 'No new applications arrive.') },
          states: { ...start, e1: 'off' },
          values: { apply: t(perWeek(0)) },
          fill: { apply: 0 },
          metrics: { wip: Math.round(live.wip), offers: 0 },
        },
        {
          id: 'empty',
          label: bi('пусто', 'empty'),
          caption: bi('Через три недели, то есть за время пути одной карточки, последние отклики проходят воронку, и все колонки пустеют. Когда вы снова начнёте откликаться, первое предложение придёт не раньше, чем новая карточка пройдёт всю воронку, то есть не раньше чем через три недели.', 'After three weeks, the length of one card’s path, the last applications are through and every column is empty. When you start again, the first offer is the whole funnel away.'),
          focus: ['reply', 'screen', 'tech', 'final'],
          reveal: ['reply', 'screen', 'tech', 'final', 'e2', 'e3', 'e4', 'e5'],
          say: { reply: bi('Прошло три недели, и в колонках не осталось ни одной карточки.', 'After three weeks the columns are empty.') },
          states: { reply: 'warn', screen: 'warn', tech: 'warn', final: 'warn' },
          fill: { reply: 0, screen: 0, tech: 0, final: 0 },
          metrics: { wip: 0, offers: 0 },
          broken: { at: 'apply', message: 'applications this week: 0\nin progress after 3 weeks: 0', caption: bi('на первой колонке. Поиск работы устроен как поток, и стоит остановить отклики, как через три недели в воронке не останется ни одной карточки, а значит, и ни одного будущего предложения.', 'at the first column. The search works as a flow, and once you stop applying, in three weeks not a single card is left in the funnel, and so not a single future offer.') },
        },
      ];
    }
    const replyPct = Math.round(Math.min(90, p.reply * (p.letter ? 1.6 : 1)));
    return [
      {
        id: 'apply',
        label: bi('отклики', 'apply'),
        caption: fmtb(bi('Вы отправляете {r} в неделю, и каждый отклик ждёт ответа около недели. Пока карточка ждёт, она лежит в первой колонке.', 'You send {r} a week; each waits about a week for a reply.'), { r: apps(p.rate) }),
        focus: ['apply'],
        say: { apply: fmtb(bi('За неделю вы отправляете {r}.', 'You send {r} a week.'), { r: apps(p.rate) }) },
        states: start,
        values: { apply: t(perWeek(p.rate)) },
        fill: { apply: fill(p.rate) },
        metrics: { wip: 0, offers: 0, weeks: 0 },
      },
      {
        id: 'reply',
        label: bi('ответы', 'replies'),
        caption: fmtb(p.letter ? bi('Благодаря письму под вакансию компании отвечают на {c} из 100, то есть вы получаете {n} в неделю.', 'Thanks to the letters {c} of 100 get a reply: {n} a week.') : bi('Компании отвечают на {c} из 100, то есть вы получаете {n} в неделю.', '{c} of 100 get a reply: {n} a week.'), { c: apps(replyPct), n: nouned(pw.reply, OTV, ['reply', 'replies']) }),
        focus: ['reply', 'e1'],
        reveal: ['reply', 'e1'],
        tokens: [{ edge: 'e1', label: perWeek(pw.reply) }],
        say: { reply: fmtb(bi('Компании отвечают на {n} в неделю.', 'Companies reply to {n} a week.'), { n: apps(pw.reply) }) },
        values: { reply: t(perWeek(pw.reply)) },
        fill: { reply: fill(pw.reply) },
        metrics: { wip: 0, offers: 0, weeks: 0 },
      },
      {
        id: 'no',
        label: bi('тишина', 'silence'),
        caption: fmtb(bi('Остальные {n} в неделю остаются без ответа, и так работает любая воронка. Карточку, на которую 14 дней нет ответа, закрывают и больше не ждут.', 'The other {n} a week get no reply: that is how a funnel works. After 14 days such a card is closed.'), { n: apps(p.rate - pw.reply) }),
        focus: ['no', 'e-no'],
        reveal: ['no', 'e-no'],
        tokens: [{ edge: 'e-no', label: perWeek(p.rate - pw.reply) }],
        say: { no: fmtb(bi('Сюда уходят {n} в неделю.', '{n} a week end up here.'), { n: apps(p.rate - pw.reply) }) },
        values: { no: t(perWeek(p.rate - pw.reply)) },
        metrics: { wip: 0, offers: 0, weeks: 0 },
      },
      {
        id: 'screen',
        label: bi('скрининг', 'screening'),
        caption: fmtb(bi('Почти каждый ответ ведёт к разговору с рекрутером, и скрининг проходит примерно половина кандидатов. На техническое интервью попадает {n} в неделю.', 'Nearly every reply leads to a screening call; about half pass. {n} a week go on to the technical interview.'), { n: nouned(pw.screen, KARD, ['card', 'cards']) }),
        focus: ['screen', 'e2'],
        reveal: ['screen', 'e2'],
        tokens: [{ edge: 'e2', label: perWeek(pw.reply) }],
        say: { screen: fmtb(bi('За неделю скрининг проходит {n}.', '{n} a week pass screening.'), { n: nouned(pw.screen, KARD, ['card', 'cards']) }) },
        values: { screen: t(perWeek(pw.screen)) },
        fill: { screen: fill(pw.reply) },
        metrics: { wip: 0, offers: 0, weeks: 0 },
      },
      {
        id: 'tech',
        label: bi('техническое', 'technical'),
        caption: fmtb(bi('Техническое интервью вы проходите в {t} случаях из 100, и дальше, на финал, идёт {n} в неделю.', 'You pass {t} of 100 technical interviews: {n} a week go to the final.'), { t: p.tech, n: nouned(pw.tech, KARD, ['card', 'cards']) }),
        focus: ['tech', 'e3'],
        reveal: ['tech', 'e3'],
        tokens: [{ edge: 'e3', label: perWeek(pw.screen) }],
        say: { tech: fmtb(bi('Из {s} интервью в неделю вы проходите {n}.', 'Of {s} interviews a week you pass {n}.'), { s: num1(pw.screen), n: num1(pw.tech) }) },
        values: { tech: t(perWeek(pw.tech)) },
        fill: { tech: fill(pw.screen) },
        metrics: { wip: 0, offers: 0, weeks: 0 },
      },
      {
        id: 'final',
        label: bi('финал', 'final'),
        caption: fmtb(bi('На финале ожидания руководителя и ваши совпадают примерно в половине случаев, поэтому до предложения работы доходит {n} в неделю.', 'At the final about half match expectations: {n} offers a week.'), { n: nouned(pw.offer, KARD, ['card', 'cards']) }),
        focus: ['final', 'e4'],
        reveal: ['final', 'e4'],
        tokens: [{ edge: 'e4', label: perWeek(pw.tech) }],
        say: { final: fmtb(bi('За неделю финал проходит {n}.', '{n} a week pass the final.'), { n: nouned(pw.final, KARD, ['card', 'cards']) }) },
        values: { final: t(perWeek(pw.final)) },
        fill: { final: fill(pw.tech) },
        metrics: { wip: 0, offers: 0, weeks: 0 },
      },
      {
        id: 'offer',
        label: bi('предложение', 'offer'),
        caption: fmtb(bi('До предложения работы доходит {n} в неделю, то есть одно предложение приходит примерно раз в {w}.', '{n} offers a week, roughly one every {w}.'), { n: nouned(pw.offer, KARD, ['card', 'cards']), w: pw.offer > 0 ? weeks(1 / pw.offer) : '∞' }),
        focus: ['offer', 'e5'],
        reveal: ['e5'],
        tokens: [{ edge: 'e5', label: perWeek(pw.offer) }],
        say: { offer: fmtb(bi('Одно предложение приходит примерно раз в {w}.', 'About one offer every {w}.'), { w: pw.offer > 0 ? weeks(1 / pw.offer) : '∞' }) },
        values: { offer: t(perWeek(pw.offer)) },
        fill: { offer: fill(pw.offer * 4) },
        metrics: { wip: 0, offers: m.offers, weeks: 0 },
      },
      {
        id: 'little',
        label: bi('итог', 'total'),
        caption: fmtb(bi('Теперь можно сложить всё вместе. По закону Литтла число карточек в работе равно числу откликов в неделю, умноженному на среднее время, которое карточка проводит на доске. Большинство карточек остаются без ответа и закрываются через две недели, а путь тех, что прошли дальше, занимает до трёх недель, поэтому в среднем карточка лежит на доске {aw}. Получается {r} × {a} ≈ {w} в работе. Первое предложение придёт примерно через {k}. Три недели из этого срока занимает путь одной карточки, а остальное время уходит на ожидание, потому что до конца доходит лишь малая часть карточек.', 'Now add it up. By Little’s law the cards in progress equal the applications a week times the average time a card spends on the board. Most cards get no reply and are closed after two weeks, while those that move on take up to three weeks, so on average a card stays on the board {aw}. That gives {r} × {a} ≈ {w} in progress. The first offer comes in about {k}: three weeks of path plus the wait for one card to get through.'), { r: p.rate, a: num1(n.avgWeeks), aw: weeks(n.avgWeeks), w: nouned(m.wip, ['карточка', 'карточки', 'карточек'], ['card', 'cards']), k: weeks(m.weeks) }),
        focus: ['offer'],
        say: { offer: fmtb(bi('Первое предложение придёт примерно через {k}.', 'The first offer: in about {k}.'), { k: weeks(m.weeks) }) },
        states: { offer: 'ok' },
        metrics: m,
      },
    ];
  },
  explainDelta(prev, next, change, a, b): Bi {
    const w = (s: Step[]) => s[s.length - 1]?.metrics ?? {};
    if (change.kind === 'break')
      return change.on
        ? bi('Поток откликов остановлен. За три недели доска пустеет, и, когда вы вернётесь к поиску, воронку придётся проходить с самого начала.', 'The flow is stopped: in three weeks the board is empty, and the funnel starts over.')
        : bi('Отклики снова идут каждую неделю, и воронка опять наполняется.', 'Applications flow again.');
    const k0 = w(prev).weeks;
    const k1 = w(next).weeks;
    if (change.id === 'letter')
      return b.letter
        ? fmtb(bi('С письмом под вакансию компании отвечают чаще, поэтому первое предложение придёт примерно через {k}, а не через {k0}.', 'With a letter more companies reply: the first offer in {k} instead of {k0}.'), { k: weeks(k1 ?? 0), k0: weeks(k0 ?? 0) })
        : bi('Без письма под вакансию компании отвечают реже, и воронка сужается уже на первом переходе.', 'Without letters fewer reply: the funnel narrows from the first transition.');
    if (change.id === 'rate') return fmtb(bi('Число откликов в неделю изменилось с {a} на {b}. Теперь в работе около {w}, и первое предложение придёт примерно через {k}.', 'The number of applications a week changed from {a} to {b}. Now about {w} are in progress, and the first offer will come in about {k}.'), { a: a.rate, b: b.rate, w: nouned(w(next).wip ?? 0, ['карточки', 'карточек', 'карточек'], ['card', 'cards']), k: weeks(k1 ?? 0) });
    return fmtb(bi('Изменилась доля тех, кто проходит этап, и первое предложение теперь придёт примерно через {k}, а не через {k0}. Сильнее всего срок зависит от самого узкого перехода воронки.', 'A stage rate changed: the first offer in {k} instead of {k0}. The narrowest transition matters most.'), { k: weeks(k1 ?? 0), k0: weeks(k0 ?? 0) });
  },
});
