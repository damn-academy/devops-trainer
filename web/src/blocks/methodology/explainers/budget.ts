// X9 "Nines and the budget" (07 §5.11): what an SLO allows, how an outage
// spends the error budget in proportion to the share of failing requests,
// when burn-rate alerts fire (SRE Workbook, "Alerting on SLOs") and what the
// error budget policy says.
//
// Reading order: at the first step only the target is on the picture. The
// budget appears from it, then the outage, which takes its bad minutes out of
// the budget (a card with the number travels along the line), then the burn
// rate, the alert and the policy, each saying in a callout what it computes
// or decides.

import { defineModel } from '../../../core/define';
import type { Step } from '../../../core/types';
import { b, card, edge, fmtn, hiddenExcept, lastMetrics, node, numIn, nWord, pctIn, type Bi } from './kit';

type P = { slo: string; minutes: number; failing: number; earlier: number };

const ALERTING = { url: 'https://sre.google/workbook/alerting-on-slos/', label: 'SRE Workbook › Alerting on SLOs' };
const POLICY = { url: 'https://sre.google/workbook/error-budget-policy/', label: 'SRE Workbook › Error Budget Policy' };

export const WINDOW_MIN = 30 * 24 * 60;

export interface BudgetNumbers {
  target: number;
  budget: number;
  bad: number;
  spentPct: number;
  burn: number;
  alert: 'page' | 'ticket' | 'none';
  alertAfter: number | null;
  left: number;
  freeze: boolean;
}

/** Budget arithmetic: budget = (1 − SLO) × 30 days; bad minutes = minutes × failing share; burn = failing share / (1 − SLO). */
export function budgetNumbers(p: P): BudgetNumbers {
  const target = Number(p.slo) / 100;
  const budget = (1 - target) * WINDOW_MIN;
  const share = p.failing / 100;
  const bad = p.minutes * share;
  const burn = share / (1 - target);
  // Multiwindow thresholds of the Workbook: 14.4 over 1 h (2% of the budget) and 6 over 6 h page; 1 over 3 days opens a ticket.
  // Time until a window has consumed its share of the budget: 2% over 1 h (burn 14.4, short window 5 min),
  // 5% over 6 h (burn 6) page; 10% over 3 days (burn 1) opens a ticket.
  let alert: BudgetNumbers['alert'] = 'none';
  let after: number | null = null;
  if (burn >= 14.4) [alert, after] = ['page', Math.max(5, Math.ceil((0.02 * budget) / share))];
  else if (burn >= 6) [alert, after] = ['page', Math.ceil((0.05 * budget) / share)];
  else if (burn >= 1) [alert, after] = ['ticket', Math.ceil((0.1 * budget) / share)];
  // The outage ended before the window filled up: nothing fires.
  if (after !== null && after > p.minutes) [alert, after] = ['none', null];
  const left = budget - bad - p.earlier;
  const r = (x: number) => Math.round(x * 10) / 10;
  return { target, budget: r(budget), bad: r(bad), spentPct: r(((bad + p.earlier) / budget) * 100), burn: r(burn), alert, alertAfter: after, left: r(left), freeze: left < 0 };
}

const r1 = (x: number) => Math.round(x * 10) / 10;
/** A duration in words: minutes, or hours when it is long, or seconds when it is short. */
const dur = (m: number): Bi =>
  m >= 120 ? nWord(r1(m / 60), ['час', 'часа', 'часов'], ['hour', 'hours']) : m >= 1 ? nWord(r1(m), ['минута', 'минуты', 'минут'], ['minute', 'minutes']) : nWord(Math.round(m * 60), ['секунда', 'секунды', 'секунд'], ['second', 'seconds']);
/** The same after "за" / "через": "за 1 минуту". */
const durAcc = (m: number): Bi =>
  m >= 120 ? nWord(r1(m / 60), ['час', 'часа', 'часов'], ['hour', 'hours']) : m >= 1 ? nWord(r1(m), ['минуту', 'минуты', 'минут'], ['minute', 'minutes']) : nWord(Math.round(m * 60), ['секунду', 'секунды', 'секунд'], ['second', 'seconds']);
/** The same after "вместо": "вместо 20 минут", "вместо 1 минуты". */
const durGen = (m: number): Bi =>
  m >= 120 ? nWord(r1(m / 60), ['часа', 'часов', 'часов'], ['hour', 'hours'], 'часа') : m >= 1 ? nWord(r1(m), ['минуты', 'минут', 'минут'], ['minute', 'minutes'], 'минуты') : nWord(Math.round(m * 60), ['секунды', 'секунд', 'секунд'], ['second', 'seconds']);
/** "в 10 раз" / "10 times". */
const times = (n: number) => nWord(n, ['раз', 'раза', 'раз'], ['time', 'times'], 'раза');
/** What is left of the budget, or by how much it is exceeded. */
const leftText = (l: number): Bi => (l < 0 ? fmtn(b('бюджет превышен на {x}', 'the budget is exceeded by {x}'), { x: durAcc(-l) }) : fmtn(b('в бюджете осталось {x}', '{x} left in the budget'), { x: dur(l) }));
const pct = (s: string) => ({ ru: `${s.replace('.', ',')} %`, en: `${s}%` });
const ALL = ['slo', 'budget', 'outage', 'burn', 'alert', 'policy', 'e-size', 'e-spend', 'e-burn', 'e-alert', 'e-policy'];

export const budgetModel = defineModel<P>({
  id: 'method.x.budget',
  frame: 'visible',
  block: 'methodology',
  title: b('Девятки и бюджет ошибок', 'Nines and the error budget'),
  summary: b(
    'Что происходит с бюджетом ошибок магазина за 30 дней. Цель надёжности задаёт, сколько плохих минут допустимо, а сбой тратит их тем быстрее, чем больше запросов не проходит. По скорости этой траты оповещение срабатывает или молчит, а политика бюджета решает, можно ли дальше выкладывать изменения. Под схемой копятся бюджет, потраченные плохие минуты, скорость сжигания и остаток.',
    'What happens to the shop’s error budget over 30 days. The reliability target sets how many bad minutes are allowed; an outage spends them the faster, the more requests fail; by the speed of that spending an alert fires or stays silent, and the budget policy decides whether changes may still be deployed. Under the diagram the budget, the bad minutes spent, the burn rate and what is left add up.',
  ),
  intro: b(
    'Схема собирается по шагам, и сейчас на ней видна только цель надёжности. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Каждый следующий блок появляется, когда до него доходит расчёт, и говорит в облачке, что он считает или решает. Полоска в бюджете показывает, сколько плохих минут ещё осталось, а карточка на линии несёт число, которое передаётся дальше.\n\nПосле первого прохода добавьте в «Параметрах» девятку к цели и посмотрите, как уменьшится бюджет. Потом сделайте сбой слабым, с одним процентом ошибок, и проверьте, разбудит ли оповещение дежурного. Напоследок включите поломку в блоке «Сломать».',
    'The diagram builds up step by step, and for now it shows only the reliability target. Press “Start from the first step”, then go on with “Step forward” above the diagram. Each next block appears when the calculation reaches it and says in a callout what it computes or decides. The bar in the budget shows how many bad minutes are still left, and the card on the line carries the number handed on.\n\nAfter the first pass add a nine to the target in “Parameters” and see how the budget shrinks. Then make the outage mild, with one percent of errors, and check whether the alert wakes the on-call engineer. Finally switch on the break in “Break it”.',
  ),
  legend: [
    { mark: 'active', text: b('блок, который считает или решает сейчас', 'the block computing or deciding now') },
    { mark: 'say', text: b('что он считает или решает', 'what it computes or decides') },
    { mark: 'token', text: b('число, которое передаётся дальше', 'the number handed on') },
    { mark: 'warn', text: b('бюджета осталось меньше четверти или скорость выше обычной', 'less than a quarter of the budget left, or a rate above normal') },
    { mark: 'err', text: b('бюджет превышен или дежурного будят', 'the budget is exceeded, or the on-call engineer is woken') },
    { mark: 'ok', text: b('выкладки разрешены', 'deployments are allowed') },
    { mark: 'icon:file', text: b('договорённости команды, то есть цель и политика', 'the team’s agreements, the target and the policy') },
    { mark: 'icon:server', text: b('сбой на рабочем сайте', 'the outage on the working site') },
    { mark: 'icon:user', text: b('оповещение дежурному', 'the alert to the on-call engineer') },
  ],
  stopLabel: b('Оповещение промолчало', 'The alert stayed silent'),
  concepts: ['method.slo', 'method.error-budget', 'method.burn-rate'],
  diagram: {
    width: 960,
    height: 440,
    nodes: [
      node('slo', b('Цель SLO', 'SLO target'), 'obj', [24, 48, 184, 64], card(['Цель надёжности говорит, какая доля оформлений заказа должна проходить успешно за 30 дней. Каждая следующая девятка в цели вдесятеро уменьшает допустимое время плохой работы.', 'The reliability target: what share of checkouts must succeed over 30 days. Each further nine in the target cuts the allowed time of bad service tenfold.'], ['Цель выбирает команда вместе с бизнесом.', 'The team chooses it together with the business.'], { url: 'https://sre.google/sre-book/service-level-objectives/', label: 'SRE book › SLOs' }), { icon: 'file', sub: '99.9%' }),
      node('budget', b('Бюджет ошибок, минут', 'Error budget, minutes'), 'gauge', [328, 48, 232, 64], card(['Бюджет говорит, сколько минут плохой работы можно себе позволить за 30 дней, и считается по формуле (1 − SLO) × 30 дней. Эти минуты команда тратит на выкладки, эксперименты и сбои.', 'How many minutes of bad service are affordable in 30 days: (1 − SLO) × 30 days. The team spends these minutes on deployments, experiments and outages.'], ['Бюджет считается из цели, его никто не назначает отдельно.', 'It is derived from the target; nobody sets it separately.']), { icon: 'database', shape: 'buffer' }),
      node('policy', b('Политика бюджета', 'Budget policy'), 'obj', [768, 48, 168, 64], card(['Договорённость о том, что делать, когда бюджет кончился. В примере из SRE Workbook она звучит так: если за четыре недели бюджет превышен, выпуски останавливают, пока сервис не вернётся к цели, и разрешают только исправления самых срочных проблем (их называют P0) и исправления безопасности. В Workbook окно бюджета составляет четыре недели, а наш магазин считает бюджет за 30 дней.', 'An agreement on what to do when the budget is gone. In the SRE Workbook example: if the budget over four weeks is exceeded, releases stop until the service is back within the target; only P0 fixes and security fixes are allowed. The Workbook’s budget window is four weeks, while our shop counts its budget over 30 days.'], ['Политику подписывают команда и бизнес.', 'The team and the business sign it.'], POLICY), { icon: 'file' }),
      node('outage', b('Сбой', 'Outage'), 'process', [24, 320, 200, 64], card(['Сбоем здесь называют минуты, когда часть запросов к сайту не проходит. Минута, в которую не проходит 10 % запросов, стоит десятую часть минуты полного простоя.', 'Minutes when part of the requests to the site fail. A minute in which 10% of requests fail costs a tenth of a minute of full downtime.'], ['Сбой вызывают выкладка с ошибкой, нагрузка или авария.', 'A faulty deployment, load or an accident causes it.']), { icon: 'server' }),
      node('burn', b('Скорость сжигания', 'Burn rate'), 'gauge', [324, 320, 192, 64], card(['Скорость сжигания показывает, во сколько раз быстрее нормы тратится бюджет, и равна доле ошибок, делённой на (1 − SLO). При скорости 1 бюджет закончится ровно к концу 30 дней.', 'How many times faster than normal the budget is being spent: the error ratio divided by (1 − SLO). At a rate of 1 the budget runs out exactly at the end of 30 days.'], ['Скорость считает система мониторинга.', 'The monitoring system computes it.'], ALERTING), { icon: 'process' }),
      node('alert', b('Оповещение дежурному', 'Alert to on-call'), 'cp', [736, 320, 200, 64], card(['Правило оповещения решает, будить ли человека. По SRE Workbook срочное оповещение срабатывает при скорости 14,4 за последний час или 6 за последние 6 часов, а при скорости 1 за последние 3 дня заводится заявка, которую разберут в рабочее время.', 'The rule that decides whether to wake a person. By the SRE Workbook a page fires at a rate of 14.4 over the last hour or 6 over the last 6 hours, and a rate of 1 over the last 3 days opens a ticket for working hours.'], ['Правило настраивает команда в системе оповещений.', 'The team sets it up in the alerting system.'], ALERTING), { icon: 'user' }),
    ],
    edges: [
      edge('e-size', 'slo', 'budget', b('(1 − SLO) × 30 дней', '(1 − SLO) × 30 days'), card(['Из цели получается бюджет, и при цели 99,9 % он равен 43,2 минуты за 30 дней.', 'The target gives the budget, and at 99.9% it equals 43.2 minutes over 30 days.'], ['Бюджет получается из цели простой арифметикой, и вручную его никто не пересчитывает.', 'The budget follows from the target by plain arithmetic; nobody recomputes it by hand.'])),
      edge('e-spend', 'outage', 'budget', b('минуты × доля ошибок', 'minutes × error share'), card(['По этой линии сбой забирает из бюджета плохие минуты, и их столько, сколько получится, если умножить длительность сбоя на долю неуспешных запросов.', 'Along this line the outage takes bad minutes from the budget, as many as its duration multiplied by the share of failing requests.'], ['Минуты списывает мониторинг.', 'Monitoring deducts the minutes.'])),
      edge('e-burn', 'outage', 'burn', b('доля ошибок', 'error share'), card(['Мониторинг смотрит, какая доля запросов не проходит прямо сейчас, и делит её на допустимую долю.', 'Monitoring looks at what share of requests fails right now and divides it by the allowed share.'], ['Долю считает мониторинг по окнам времени.', 'Monitoring computes it over time windows.'])),
      edge('e-alert', 'burn', 'alert', b('выше порога?', 'above a threshold?'), card(['Скорость сравнивают с тремя порогами из SRE Workbook, которые равны 14,4, 6 и 1.', 'The rate is compared with three thresholds from the SRE Workbook, which are 14.4, 6 and 1.'], ['Скорость с порогами сравнивает правило оповещения.', 'The alerting rule compares the rate with the thresholds.'], ALERTING)),
      edge('e-policy', 'budget', 'policy', b('бюджет превышен?', 'budget exceeded?'), card(['Решение о заморозке выпусков принимают по остатку бюджета за окно, у нашего магазина это последние 30 дней, а не по ощущению.', 'The release freeze is decided on what is left of the budget over the window, the last 30 days for our shop, not on a feeling.'], ['Решение принимают команда и бизнес, следуя политике бюджета.', 'The team and the business decide, following the budget policy.'], POLICY), { labelAt: 0.3 }),
    ],
  },
  params: [
    {
      id: 'slo',
      group: b('Цель надёжности', 'The reliability target'),
      label: b('Какая доля запросов за 30 дней должна пройти успешно (SLO)', 'Share of requests that must succeed over 30 days (SLO)'),
      kind: 'choice',
      options: ['99', '99.5', '99.9', '99.95', '99.99'].map((v) => ({ id: v, label: b(`${v.replace('.', ',')} %`, `${v}%`) })),
      default: '99.9',
      near: 'slo',
      predict: {
        prompt: b('Сейчас цель 99,9 %, и бюджет за 30 дней равен 43,2 минуты. Вы меняете цель. Сколько минут бюджета даст цель 99,99 %, то есть на одну девятку больше?', 'Now the target is 99.9%, and the budget over 30 days is 43.2 minutes. You change the target. How many budget minutes does a target of 99.99%, one more nine, give?'),
        options: [
          { id: 'tenth', text: b('В десять раз меньше, 4,32 минуты', 'Ten times less, 4.32 minutes') },
          { id: 'almost', text: b('Почти столько же, около 43 минут', 'Almost the same, about 43 minutes') },
          { id: 'half', text: b('Вдвое меньше, около 21,6 минуты', 'Half as much, about 21.6 minutes') },
        ],
        resolve: () => 'tenth',
      },
    },
    { id: 'minutes', group: b('Сбой', 'The outage'), label: b('Сколько минут длится сбой', 'How many minutes the outage lasts'), kind: 'range', min: 5, max: 240, step: 5, default: 20, near: 'outage' },
    {
      id: 'failing',
      group: b('Сбой', 'The outage'),
      label: b('Какая доля запросов не проходит во время сбоя, %', 'Share of requests failing during the outage, %'),
      kind: 'range',
      min: 1,
      max: 100,
      step: 1,
      default: 10,
      near: 'outage',
      predict: {
        prompt: b('Цель равна 99,9 %, а сбой длится 20 минут. Вы меняете долю неуспешных запросов. Разбудит ли оповещение дежурного, если не проходит только 1 % запросов?', 'The target is 99.9%, the outage lasts 20 minutes. You change the share of failing requests. Will the alert wake the on-call engineer if only 1% of requests fail?'),
        options: [
          { id: 'none', text: b('Нет, не разбудит. Скорость сжигания равна 10, но за 20 минут сбой не успеет потратить ту долю бюджета, при которой срабатывает оповещение', 'No, it will not. The burn rate is 10, but in 20 minutes the outage does not spend the share of the budget at which an alert fires') },
          { id: 'page', text: b('Да, разбудит, потому что любая ошибка будит дежурного', 'Yes, it will, because any error wakes the on-call engineer') },
        ],
        resolve: () => 'none',
      },
    },
    { id: 'earlier', group: b('Что было раньше', 'What happened before'), label: b('Сколько плохих минут уже потрачено за последние 4 недели', 'Bad minutes already spent in the last 4 weeks'), kind: 'range', min: 0, max: 60, step: 2, default: 0, near: 'budget', levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    {
      id: 'cpu-alert',
      label: b('Оповещение настроено на загрузку процессора, а не на долю неуспешных запросов', 'The alert watches CPU load instead of the share of failing requests'),
      remove: ['e-burn'],
      boundary: 'process',
      predict: {
        prompt: b('Оповещение срабатывает, только когда процессор сервера загружен больше чем на 90 %. Сервер работает спокойно, а 10 % оплат не проходят. Что сделает оповещение?', 'The alert fires only when the server’s CPU is loaded over 90%. The server runs calmly while 10% of payments fail. What does the alert do?'),
        options: [
          { id: 'silent', text: b('Оповещение промолчит, и о сбое первыми узнают покупатели', 'The alert stays silent, and the customers learn about the outage first') },
          { id: 'fires', text: b('Оповещение сработает как обычно', 'The alert fires as usual') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'cpu') ? 'silent' : 'fires'),
      },
    },
  ],
  metrics: [
    { id: 'budget', label: b('бюджет, минут', 'budget, minutes') },
    { id: 'bad', label: b('потрачено плохих минут', 'bad minutes spent') },
    { id: 'burn', label: b('скорость сжигания', 'burn rate') },
    { id: 'left', label: b('осталось, минут', 'left, minutes') },
  ],
  run(p, broken): Step[] {
    const n = budgetNumbers(p);
    const cpu = broken.has('cpu-alert');
    const m = { budget: n.budget, bad: n.bad, burn: n.burn, left: n.left };
    const allowed = Math.round((1 - n.target) * 10000) / 100;
    const sub = (x: number) => `${numIn(Math.max(0, r1(x)))} / ${numIn(n.budget)}`;
    const steps: Step[] = [
      {
        id: 'slo',
        label: b('цель', 'target'),
        caption: fmtn(b('Команда магазина договорилась с бизнесом, что за 30 дней успешно должны пройти {s} оформлений заказа. Посмотрим, сколько плохой работы такая цель разрешает.', 'The shop’s team agreed with the business that {s} of checkouts must succeed over 30 days. Let us see how much bad service such a target allows.'), { s: pct(p.slo) }),
        focus: ['slo'],
        say: { slo: fmtn(b('Цель требует, чтобы за 30 дней успешно проходили {s} оформлений заказа.', 'The target requires {s} of checkouts to succeed over 30 days.'), { s: pct(p.slo) }) },
        states: hiddenExcept(ALL, 'slo'),
        values: { slo: pctIn(Number(p.slo)), budget: sub(n.budget - p.earlier) },
        fill: { budget: 1 - p.earlier / Math.max(1e-9, n.budget) },
        metrics: { budget: n.budget, bad: 0, burn: 0, left: r1(n.budget - p.earlier) },
      },
      {
        id: 'size',
        label: b('бюджет', 'budget'),
        caption: fmtn(b('Из цели получается бюджет ошибок. Допустимая доля плохой работы равна {e}, а в 30 днях 43 200 минут, поэтому на плохую работу можно потратить {b}, примерно {w} в неделю.{x}', 'The target gives the error budget. The allowed share of bad service is {e}, and 30 days have 43,200 minutes, so {b} of bad service may be spent, about {w} a week.{x}'), {
          e: pct(String(allowed)),
          b: dur(n.budget),
          w: dur((n.budget / 30) * 7),
          x: p.earlier ? fmtn(b(' Из них {y} команда уже израсходовала раньше, за последние 30 дней.', ' Of these, the team already used {y} earlier, in the last 30 days.'), { y: durAcc(p.earlier) }) : b('', ''),
        }),
        focus: ['e-size', 'budget'],
        say: { budget: fmtn(b('В бюджете {b} плохой работы на 30 дней.', 'The budget holds {b} of bad service for 30 days.'), { b: dur(n.budget) }) },
        tokens: [{ edge: 'e-size', label: pct(String(allowed)) }],
        reveal: ['e-size', 'budget'],
        metrics: { budget: n.budget, bad: 0, burn: 0, left: r1(n.budget - p.earlier) },
      },
      {
        id: 'outage',
        label: b('сбой', 'outage'),
        caption: fmtn(b('Случился сбой, и он длится {m}. Всё это время у части покупателей не проходит оплата, а всего не проходит {f} запросов к сайту.', 'An outage happens, and it lasts {m}. All that time some customers cannot pay, and {f} of the requests to the site fail in all.'), { m: durAcc(p.minutes), f: pct(String(p.failing)) }),
        focus: ['outage'],
        say: { outage: fmtn(b('Сбой длится {m}, и всё это время не проходит {f} запросов.', 'The outage lasts {m}, and all that time {f} of requests fail.'), { m: durAcc(p.minutes), f: pct(String(p.failing)) }) },
        reveal: ['outage'],
        states: { outage: 'err' },
        metrics: { budget: n.budget, bad: 0, burn: 0, left: r1(n.budget - p.earlier) },
      },
      {
        id: 'spend',
        label: b('трата', 'spend'),
        caption: p.earlier
          ? fmtn(b('Сбой забирает из бюджета {b}, то есть свою длительность, умноженную на долю ошибок. Вместе с тем, что потратили раньше, израсходовано {pc} бюджета.', 'The outage takes {b} out of the budget, its duration multiplied by the error share. Together with what was spent earlier, {pc} of the budget is used.'), { b: durAcc(n.bad), pc: pct(String(n.spentPct)) })
          : fmtn(b('Сбой забирает из бюджета {b}, то есть свою длительность, умноженную на долю ошибок. Раньше в этом окне бюджет не тратили, поэтому израсходовано {pc} месячного бюджета.', 'The outage takes {b} out of the budget, its duration multiplied by the error share. Nothing was spent earlier in this window, so {pc} of the monthly budget is used.'), { b: durAcc(n.bad), pc: pct(String(n.spentPct)) }),
        focus: ['e-spend', 'budget'],
        say: { budget: fmtn(b('Сбой забрал {b}, и {l}.', 'The outage took {b}, and {l}.'), { b: durAcc(n.bad), l: leftText(n.left) }) },
        tokens: [{ edge: 'e-spend', label: fmtn(b('−{b} мин', '−{b} min'), { b: n.bad }) }],
        reveal: ['e-spend'],
        values: { budget: sub(n.left) },
        fill: { budget: Math.max(0, n.left / n.budget) },
        states: { budget: n.left < 0 ? 'err' : n.left < n.budget * 0.25 ? 'warn' : 'on' },
        metrics: m,
      },
    ];
    if (cpu) {
      steps.push({
        id: 'cpu',
        label: b('процессор', 'CPU'),
        caption: b('Оповещение смотрит на загрузку процессора, а не на долю ошибок. Процессор загружен на 35 %, сервер работает спокойно, а оплата при этом не проходит. Оповещение молчит, и о сбое первыми узнают покупатели.', 'The alert watches CPU load, not the error share. The CPU is at 35%, the server runs calmly, and yet payments fail. The alert stays silent, and the customers learn about the outage first.'),
        focus: ['alert'],
        say: { alert: b('Процессор загружен на 35 %, правило считает, что всё спокойно, и дежурного никто не будит.', 'The CPU is at 35%, the rule considers everything calm, and nobody wakes the on-call engineer.') },
        reveal: ['alert'],
        states: { burn: 'hidden', 'e-burn': 'hidden', 'e-alert': 'hidden', alert: 'off' },
        values: { alert: `CPU ${pctIn(35)}` },
        metrics: m,
        broken: { at: 'alert', message: 'ALERT HighCPU: inactive (cpu=35%)\ncheckout success: 90%', caption: b('показатель не описывает то, что видит покупатель, потому что процессор в норме, а заказы при этом не проходят.', 'the indicator does not describe what the customer sees, because the CPU is fine while orders fail.') },
      });
    } else {
      steps.push({
        id: 'burn',
        label: b('скорость', 'burn'),
        caption: fmtn(b('Скорость сжигания показывает, во сколько раз быстрее нормы тратится бюджет. Здесь доля ошибок {f} делится на допустимую долю {e}, и получается {r}. В таком темпе весь бюджет на 30 дней закончился бы за {t}.', 'The burn rate shows how many times faster than normal the budget is being spent. Here the error share {f} is divided by the allowed share {e}, which gives {r}. At this pace the whole 30-day budget would be gone in {t}.'), { f: pct(String(p.failing)), e: pct(String(allowed)), r: n.burn, t: durAcc(WINDOW_MIN / Math.max(n.burn, 1e-9)) }),
        focus: ['e-burn', 'burn'],
        say: { burn: fmtn(b('Бюджет тратится в {r} быстрее нормы.', 'The budget is spent {r} faster than normal.'), { r: times(n.burn) }) },
        tokens: [{ edge: 'e-burn', label: pct(String(p.failing)) }],
        reveal: ['e-burn', 'burn'],
        values: { burn: `${numIn(n.burn)}×` },
        states: { burn: n.burn >= 6 ? 'err' : n.burn >= 1 ? 'warn' : 'on' },
        metrics: m,
      });
      steps.push(
        n.alert === 'page'
          ? {
              id: 'page',
              label: b('будят', 'page'),
              caption: fmtn(b('Скорость выше порога срочного оповещения, поэтому через {a} после начала сбоя телефон дежурного звонит, и дежурный начинает разбираться.', 'The rate is above the paging threshold, so {a} after the outage began the on-call engineer’s phone rings, and they start to investigate.'), { a: durAcc(n.alertAfter ?? 5) }),
              focus: ['e-alert', 'alert'],
              say: { alert: fmtn(b('Порог пройден, поэтому через {a} оповещение будит дежурного.', 'The threshold is crossed, so after {a} the alert wakes the on-call engineer.'), { a: durAcc(n.alertAfter ?? 5) }) },
              tokens: [{ edge: 'e-alert', label: `${n.burn}×` }],
              reveal: ['e-alert', 'alert'],
              states: { alert: 'err' },
              metrics: m,
            }
          : n.alert === 'ticket'
            ? {
                id: 'ticket',
                label: b('заявка', 'ticket'),
                caption: b('Скорость выше единицы, но ниже порогов срочного оповещения. Человека ночью не будят, а утром в рабочей очереди появится заявка.', 'The rate is above one but below the paging thresholds. Nobody is woken at night; in the morning a ticket appears in the work queue.'),
                focus: ['e-alert', 'alert'],
                say: { alert: b('До порога срочного оповещения далеко, поэтому правило заводит заявку на утро.', 'The paging threshold is far away, so the rule opens a ticket for the morning.') },
                tokens: [{ edge: 'e-alert', label: `${n.burn}×` }],
                reveal: ['e-alert', 'alert'],
                states: { alert: 'warn' },
                metrics: m,
              }
            : {
                id: 'quiet',
                label: b('тихо', 'quiet'),
                caption: b('Ни один порог не пройден, потому что сбой был слишком коротким или слишком слабым, чтобы будить человека. Тем не менее его минуты списаны из бюджета.', 'No threshold is crossed, because the outage was too short or too mild to wake anyone. Its minutes are still deducted from the budget.'),
                focus: ['e-alert', 'alert'],
                say: { alert: b('Ни один порог не пройден, поэтому будить никого не нужно.', 'No threshold is crossed, so nobody needs waking.') },
                tokens: [{ edge: 'e-alert', label: `${n.burn}×` }],
                reveal: ['e-alert', 'alert'],
                states: { alert: 'on' },
                metrics: m,
              },
      );
    }
    steps.push({
      id: 'policy',
      label: b('политика', 'policy'),
      caption: n.freeze
        ? fmtn(b('Бюджет за 30 дней превышен на {x}. По политике выпуски останавливают, пока сервис не вернётся к цели, и разрешают только исправления проблем P0 и исправления безопасности.', 'The 30-day budget is exceeded by {x}. By the policy releases stop until the service is back within the target, and only P0 fixes and security fixes are allowed.'), { x: durAcc(-n.left) })
        : fmtn(b('В бюджете осталось {l} из {b}. Бюджет не превышен, поэтому политика бюджета не запрещает выкладывать изменения, даже если минут в нём осталось мало.', '{l} of {b} are left in the budget. The budget is not exceeded, so the policy does not forbid deployments, even when very few minutes are left.'), { l: dur(n.left), b: dur(n.budget) }),
      focus: ['e-policy', 'policy'],
      say: { policy: n.freeze ? b('Бюджет превышен, поэтому выпуски останавливают, кроме исправлений P0 и исправлений безопасности.', 'The budget is exceeded, so releases stop, except P0 fixes and security fixes.') : b('Бюджет не превышен, поэтому выкладывать изменения можно.', 'The budget is not exceeded, so changes may be deployed.') },
      tokens: [{ edge: 'e-policy', label: n.left < 0 ? fmtn(b('−{x} мин', '−{x} min'), { x: r1(-n.left) }) : fmtn(b('{x} мин', '{x} min'), { x: n.left }) }],
      reveal: ['e-policy', 'policy'],
      states: { policy: n.freeze ? 'err' : 'ok' },
      metrics: m,
    });
    return steps;
  },
  explainDelta(prev, next, change, a, c): Bi {
    const m0 = lastMetrics(prev);
    const m1 = lastMetrics(next);
    if (change.kind === 'break')
      return change.on
        ? b('Оповещение по процессору промолчало, потому что сервер работает спокойно, хотя 10 % заказов не проходят. Показатель для оповещения должен описывать то, что видит покупатель, то есть долю успешных оформлений заказа.', 'The CPU alert stayed silent, because the server runs calmly although 10% of orders fail. The indicator for an alert must describe what the customer sees, that is, the share of successful checkouts.')
        : b('Оповещение снова смотрит на долю неуспешных запросов.', 'The alert watches the share of failing requests again.');
    switch (change.id) {
      case 'slo':
        return fmtn(b('Цель теперь {y} вместо {x}, и бюджет на 30 дней равен {b1} вместо {b0}. Каждая девятка вдесятеро уменьшает право на ошибку.', 'The target is now {y} instead of {x}, and the 30-day budget is {b1} instead of {b0}. Each nine cuts the room for error tenfold.'), { x: pct(a.slo as string), y: pct(c.slo as string), b0: durGen(m0.budget ?? 0), b1: dur(m1.budget ?? 0) });
      case 'failing':
        return fmtn(b('Во время сбоя не проходит {y} запросов вместо {x}. Сбой забрал из бюджета {p1} вместо {p0}, а скорость сжигания теперь {r1}.', '{y} of requests fail during the outage instead of {x}. The outage took {p1} out of the budget instead of {p0}, and the burn rate is now {r1}.'), { x: pct(String(a.failing)), y: pct(String(c.failing)), p0: durGen(m0.bad ?? 0), p1: durAcc(m1.bad ?? 0), r1: m1.burn ?? 0 });
      case 'minutes':
        return fmtn(b('Сбой длится {y} вместо {x}. Он забрал из бюджета {p1} вместо {p0}, и {l1}.', 'The outage lasts {y} instead of {x}. It took {p1} out of the budget instead of {p0}, and {l1}.'), { x: durGen(a.minutes as number), y: durAcc(c.minutes as number), p0: durGen(m0.bad ?? 0), p1: durAcc(m1.bad ?? 0), l1: leftText(m1.left ?? 0) });
      default:
        return fmtn(b('Раньше, за последние 30 дней, команда уже израсходовала {y}, и {l1}.', 'Earlier in the last 30 days the team already used {y}, and {l1}.'), { y: durAcc(c.earlier as number), l1: leftText(m1.left ?? 0) });
    }
  },
});
