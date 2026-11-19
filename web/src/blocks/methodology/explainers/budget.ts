// X9 "Nines and the budget" (07 §5.11): what an SLO allows, how an outage
// spends the error budget in proportion to the share of failing requests,
// when burn-rate alerts fire (SRE Workbook, "Alerting on SLOs") and what the
// error budget policy says.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { ElementCard, Step } from '../../../core/types';

type P = { slo: string; minutes: number; failing: number; earlier: number };

const card = (what: Bi, who: Bi, extra: Partial<ElementCard> = {}): ElementCard => ({ what, who, ...extra });
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

const fmtMin = (m: number) => (m >= 120 ? `${Math.round((m / 60) * 10) / 10} h` : m >= 1 ? `${Math.round(m * 10) / 10} min` : `${Math.round(m * 60)} s`);

export const budgetModel = defineModel<P>({
  id: 'method.x.budget',
  block: 'methodology',
  title: bi('Девятки и бюджет ошибок', 'Nines and the error budget'),
  summary: bi(
    'Цель надёжности задаёт, сколько плохих минут допустимо за 30 дней. Сбой тратит их пропорционально доле неуспешных запросов; оповещение срабатывает по скорости сжигания.',
    'A reliability target sets how many bad minutes are allowed in 30 days. An outage spends them in proportion to the share of failing requests; an alert fires on the burn rate.',
  ),
  concepts: ['method.slo', 'method.error-budget', 'method.burn-rate'],
  diagram: {
    width: 960,
    height: 300,
    nodes: [
      { id: 'slo', label: 'SLO', sub: '99.9%', family: 'obj', shape: 'doc', x: 24, y: 40, w: 136, h: 64, card: card(bi('Цель: какая доля оформлений заказа должна проходить за 30 дней. Каждая девятка — в десять раз меньше допустимого простоя.', 'The target: what share of checkouts must succeed over 30 days. Each nine is ten times less allowed downtime.'), bi('Команда вместе с бизнесом.', 'The team together with the business.'), { doc: { url: 'https://sre.google/sre-book/service-level-objectives/', label: 'SRE book › SLOs' } }) },
      { id: 'budget', label: bi('Бюджет ошибок', 'Error budget'), sub: '43.2 min', family: 'gauge', shape: 'buffer', x: 232, y: 40, w: 200, h: 64, card: card(bi('(1 − SLO) × 30 дней: сколько плохих минут можно потратить на выкладки, эксперименты и сбои.', '(1 − SLO) × 30 days: how many bad minutes may be spent on deployments, experiments and outages.'), bi('Считается из SLO.', 'Derived from the SLO.')) },
      { id: 'outage', label: bi('Сбой', 'Outage'), sub: '', family: 'process', x: 232, y: 200, w: 200, h: 64, card: card(bi('Минуты, когда часть запросов не проходит. Минута с 10% ошибок стоит десятую часть минуты полного простоя.', 'Minutes when part of the requests fail. A minute with 10% errors costs a tenth of a minute of full downtime.'), bi('Выкладка с дефектом, нагрузка, авария.', 'A faulty deployment, load, an accident.')) },
      { id: 'burn', label: bi('Скорость сжигания', 'Burn rate'), sub: '', family: 'gauge', x: 504, y: 200, w: 176, h: 64, card: card(bi('Во сколько раз быстрее нормы тратится бюджет: доля ошибок / (1 − SLO). При 1 бюджет кончится ровно за 30 дней.', 'How many times faster than normal the budget is being spent: error ratio / (1 − SLO). At 1 the budget lasts exactly 30 days.'), bi('Мониторинг.', 'Monitoring.'), { doc: ALERTING }) },
      { id: 'alert', label: bi('Оповещение', 'Alert'), sub: '', family: 'cp', shape: 'hex', x: 752, y: 200, w: 176, h: 64, card: card(bi('Срочное (page) будит человека; тикет ждёт рабочего дня. Пороги: 14,4 за час и 6 за 6 часов — срочно; 1 за 3 дня — тикет.', 'A page wakes a person; a ticket waits for the working day. Thresholds: 14.4 over 1 h and 6 over 6 h page; 1 over 3 days opens a ticket.'), bi('Система оповещений по правилам команды.', 'The alerting system, by the team’s rules.'), { doc: ALERTING }) },
      { id: 'policy', label: bi('Политика бюджета', 'Budget policy'), sub: '', family: 'obj', shape: 'doc', x: 752, y: 40, w: 176, h: 64, card: card(bi('Если за четыре недели бюджет превышен, выпуски останавливают до возвращения в цель; исключения — исправления P0 и безопасности.', 'If the budget over four weeks is exceeded, releases stop until the service is back within target; P0 fixes and security fixes are exceptions.'), bi('Договорённость команды и бизнеса.', 'An agreement of the team and the business.'), { doc: POLICY }) },
    ],
    edges: [
      { id: 'e-size', from: 'slo', to: 'budget', label: bi('(1 − SLO) × 30 дн.', '(1 − SLO) × 30 d'), card: card(bi('Из цели получается бюджет: 99,9% → 43,2 мин за 30 дней.', 'The target gives the budget: 99.9% → 43.2 min over 30 days.'), bi('Арифметика.', 'Arithmetic.')) },
      { id: 'e-spend', from: 'outage', to: 'budget', label: bi('тратит: мин × доля ошибок', 'spends: min × error share'), card: card(bi('Плохие минуты = длительность × доля неуспешных запросов.', 'Bad minutes = duration × share of failing requests.'), bi('Сбой.', 'The outage.')) },
      { id: 'e-burn', from: 'outage', to: 'burn', label: bi('доля ошибок / (1 − SLO)', 'error share / (1 − SLO)'), card: card(bi('Как быстро сбой ест бюджет.', 'How fast the outage eats the budget.'), bi('Мониторинг считает по окнам.', 'Monitoring computes it over windows.')) },
      { id: 'e-alert', from: 'burn', to: 'alert', label: bi('выше порога?', 'above a threshold?'), card: card(bi('Сравнение с порогами Workbook: 14,4 / 6 / 1.', 'Comparison with the Workbook thresholds: 14.4 / 6 / 1.'), bi('Правило оповещения.', 'The alerting rule.'), { doc: ALERTING }) },
      { id: 'e-policy', from: 'budget', to: 'policy', label: bi('превышен за 4 недели?', 'exceeded over 4 weeks?'), card: card(bi('Решение о заморозке принимают по остатку бюджета, а не по ощущению.', 'The freeze decision is made on the budget left, not on a feeling.'), bi('Команда и бизнес по политике.', 'The team and the business, by the policy.'), { doc: POLICY }) },
    ],
  },
  params: [
    {
      id: 'slo',
      label: bi('Цель SLO', 'SLO target'),
      kind: 'choice',
      options: ['99', '99.5', '99.9', '99.95', '99.99'].map((v) => ({ id: v, label: bi(`${v.replace('.', ',')}%`, `${v}%`) })),
      default: '99.9',
      near: 'slo',
      predict: {
        prompt: bi('Добавили одну девятку: 99,9% → 99,99%. Сколько минут бюджета останется на 30 дней?', 'One more nine: 99.9% → 99.99%. How many budget minutes are left for 30 days?'),
        options: [
          { id: 'tenth', text: bi('В десять раз меньше: 4,32 минуты', 'Ten times less: 4.32 minutes') },
          { id: 'almost', text: bi('Почти столько же', 'Almost the same') },
          { id: 'half', text: bi('Вдвое меньше', 'Half as much') },
        ],
        resolve: (_p, next) => ((next[0].metrics?.budget ?? 0) < 5 ? 'tenth' : 'almost'),
      },
    },
    { id: 'minutes', label: bi('Длительность сбоя, мин', 'Outage duration, min'), kind: 'range', min: 5, max: 240, step: 5, unit: 'min', default: 20, near: 'outage' },
    {
      id: 'failing',
      label: bi('Доля неуспешных запросов, %', 'Share of failing requests, %'),
      kind: 'range',
      min: 1,
      max: 100,
      step: 1,
      unit: '%',
      default: 10,
      near: 'outage',
      predict: {
        prompt: bi('20 минут, но не проходит только 1% запросов. Что сделает оповещение?', '20 minutes, but only 1% of requests fail. What does the alerting do?'),
        options: [
          { id: 'none', text: bi('Срочного оповещения не будет', 'There is no page') },
          { id: 'page', text: bi('Разбудит дежурного', 'It wakes the on-call engineer') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'page') ? 'page' : 'none'),
      },
    },
    { id: 'earlier', label: bi('Уже потрачено раньше за 4 недели, мин', 'Already spent earlier in 4 weeks, min'), kind: 'range', min: 0, max: 60, step: 2, unit: 'min', default: 0, near: 'budget' },
  ],
  breaks: [
    {
      id: 'cpu-alert',
      label: bi('Оповещение по загрузке процессора вместо доли ошибок', 'Alert on CPU load instead of the error share'),
      remove: ['e-burn'],
      boundary: 'process',
      predict: {
        prompt: bi('Оповещение смотрит на загрузку процессора. Сервер работает, но оплата не проходит. Что будет?', 'The alert watches CPU load. The server is alive, but payments fail. What happens?'),
        options: [
          { id: 'silent', text: bi('Оповещение промолчит', 'The alert stays silent') },
          { id: 'fires', text: bi('Сработает как обычно', 'It fires as usual') },
        ],
        resolve: () => 'silent',
      },
    },
  ],
  metrics: [
    { id: 'budget', label: bi('бюджет', 'budget'), unit: 'min' },
    { id: 'bad', label: bi('плохих минут', 'bad minutes') },
    { id: 'burn', label: bi('скорость сжигания', 'burn rate') },
    { id: 'left', label: bi('осталось', 'left'), unit: 'min' },
  ],
  run(p, broken): Step[] {
    const n = budgetNumbers(p);
    const cpu = broken.has('cpu-alert');
    const m = { budget: n.budget, bad: n.bad, burn: n.burn, left: n.left };
    const sloTxt = `${p.slo}%`;
    const steps: Step[] = [
      {
        id: 'size',
        label: bi('бюджет', 'budget'),
        caption: fmt(bi('Цель {s} за 30 дней: допустимо {b} плохих минут ({w} в неделю).', 'A target of {s} over 30 days allows {b} bad minutes ({w} a week).'), { s: sloTxt, b: fmtMin(n.budget), w: fmtMin(n.budget / 30 * 7) }),
        focus: ['slo', 'e-size', 'budget'],
        tokens: [{ edge: 'e-size' }],
        values: { slo: sloTxt, budget: fmtMin(n.budget), outage: '', burn: '', alert: '', policy: '' },
        fill: { budget: 1 - p.earlier / Math.max(1e-9, n.budget) },
        metrics: { budget: n.budget, bad: 0, burn: 0, left: Math.round((n.budget - p.earlier) * 10) / 10 },
      },
      {
        id: 'spend',
        label: bi('сбой', 'outage'),
        caption: fmt(bi('Сбой {m} мин, не проходит {f}% запросов: это {b} плохих минут — {pc}% бюджета вместе с тем, что потрачено раньше.', 'An outage of {m} min with {f}% of requests failing: {b} bad minutes, {pc}% of the budget together with what was spent earlier.'), { m: p.minutes, f: p.failing, b: n.bad, pc: n.spentPct }),
        focus: ['outage', 'e-spend', 'budget'],
        tokens: [{ edge: 'e-spend', label: `${n.bad}` }],
        values: { outage: `${p.minutes} min × ${p.failing}%`, budget: `${fmtMin(Math.max(0, n.left))} left` },
        fill: { budget: Math.max(0, n.left / n.budget) },
        states: { budget: n.left < 0 ? 'err' : n.left < n.budget * 0.25 ? 'warn' : 'on' },
        metrics: m,
      },
    ];
    if (cpu) {
      steps.push({
        id: 'cpu',
        label: 'CPU',
        caption: bi('Оповещение смотрит на загрузку процессора: сервер жив и спокоен, а оплата падает. Сигнала нет — сбой заметят покупатели.', 'The alert watches CPU load: the server is alive and calm while payments fail. No signal: the customers will notice the outage first.'),
        focus: ['alert', 'outage'],
        states: { alert: 'off', 'e-burn': 'off', burn: 'off' },
        values: { alert: 'CPU 35%: OK' },
        metrics: m,
        broken: { at: 'alert', message: 'ALERT HighCPU: inactive (cpu=35%)\ncheckout success: 80%', caption: bi('показатель не описывает опыт покупателя: процессор в норме, а заказы не проходят.', 'the indicator does not describe the customer’s experience: the CPU is fine while orders fail.') },
      });
    } else {
      steps.push({
        id: 'burn',
        label: bi('скорость', 'burn'),
        caption: fmt(bi('Скорость сжигания = {f}% / {e}% = {r}: в таком темпе бюджет кончился бы за {t}.', 'Burn rate = {f}% / {e}% = {r}: at this pace the budget would be gone in {t}.'), { f: p.failing, e: Math.round((1 - n.target) * 10000) / 100, r: n.burn, t: fmtMin(WINDOW_MIN / Math.max(n.burn, 1e-9)) }),
        focus: ['e-burn', 'burn'],
        tokens: [{ edge: 'e-burn' }],
        values: { burn: `${n.burn}×` },
        states: { burn: n.burn >= 6 ? 'err' : n.burn >= 1 ? 'warn' : 'on' },
        metrics: m,
      });
      steps.push(
        n.alert === 'page'
          ? { id: 'page', label: 'page', caption: fmt(bi('Порог срочного оповещения пройден: через {a} мин дежурного будят.', 'The paging threshold is crossed: after {a} min the on-call engineer is woken up.'), { a: n.alertAfter ?? 5 }), focus: ['e-alert', 'alert'], tokens: [{ edge: 'e-alert', label: 'page' }], values: { alert: 'PAGE' }, states: { alert: 'err' }, metrics: m }
          : n.alert === 'ticket'
            ? { id: 'ticket', label: bi('тикет', 'ticket'), caption: bi('Скорость выше 1, но ниже срочных порогов: человека не будят, утром будет тикет.', 'The rate is above 1 but below the paging thresholds: nobody is woken up, there will be a ticket in the morning.'), focus: ['e-alert', 'alert'], tokens: [{ edge: 'e-alert', label: 'ticket' }], values: { alert: 'ticket' }, states: { alert: 'warn' }, metrics: m }
            : { id: 'quiet', label: bi('тихо', 'quiet'), caption: bi('Порогов не достигли: сбой слишком короткий или слабый, чтобы будить человека.', 'No threshold is reached: the outage is too short or too mild to wake anyone.'), focus: ['alert'], values: { alert: '—' }, states: { alert: 'on' }, metrics: m },
      );
    }
    steps.push({
      id: 'policy',
      label: bi('политика', 'policy'),
      caption: n.freeze
        ? fmt(bi('Бюджет за четыре недели превышен на {x} мин: по политике выпуски останавливают, пока сервис не вернётся в цель; можно только исправления P0 и безопасности.', 'The four-week budget is exceeded by {x} min: by the policy, releases stop until the service is back within target; only P0 and security fixes are allowed.'), { x: Math.round(-n.left * 10) / 10 })
        : fmt(bi('Осталось {l} из {b}: бюджет не превышен, политика выкладки не запрещает — даже если его почти не осталось.', '{l} of {b} left: the budget is not exceeded, and the policy does not forbid deployments, even when little is left.'), { l: fmtMin(n.left), b: fmtMin(n.budget) }),
      focus: ['e-policy', 'policy'],
      tokens: [{ edge: 'e-policy' }],
      values: { policy: n.freeze ? 'FREEZE' : 'releases OK' },
      states: { policy: n.freeze ? 'err' : 'ok' },
      metrics: m,
    });
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    const m0 = prev[prev.length - 1].metrics ?? {};
    const m1 = next[next.length - 1].metrics ?? {};
    if (change.kind === 'break') return change.on ? bi('Оповещение по процессору молчит: сервер работает, а 10% заказов не проходят. Индикатор должен описывать опыт покупателя — долю успешных оформлений.', 'The CPU alert stays silent: the server is alive while 10% of orders fail. The indicator must describe the customer’s experience: the share of successful checkouts.') : bi('Оповещение снова смотрит на долю ошибок.', 'The alert watches the error share again.');
    switch (change.id) {
      case 'slo':
        return fmt(bi('SLO {x}% → {y}%: бюджет {b0} → {b1} мин за 30 дней. Каждая девятка — вдесятеро меньше права на ошибку.', 'SLO {x}% → {y}%: budget {b0} → {b1} min over 30 days. Each nine is ten times less room for error.'), { x: a.slo as string, y: b.slo as string, b0: m0.budget ?? 0, b1: m1.budget ?? 0 });
      case 'failing':
        return fmt(bi('Доля ошибок {x}% → {y}%: плохих минут {p0} → {p1}, скорость сжигания {r1}.', 'Error share {x}% → {y}%: bad minutes {p0} → {p1}, burn rate {r1}.'), { x: a.failing as number, y: b.failing as number, p0: m0.bad ?? 0, p1: m1.bad ?? 0, r1: m1.burn ?? 0 });
      case 'minutes':
        return fmt(bi('Сбой {x} → {y} мин: плохих минут {p0} → {p1}, осталось {l1} мин.', 'Outage {x} → {y} min: bad minutes {p0} → {p1}, {l1} min left.'), { x: a.minutes as number, y: b.minutes as number, p0: m0.bad ?? 0, p1: m1.bad ?? 0, l1: m1.left ?? 0 });
      default:
        return fmt(bi('Раньше за 4 недели потрачено {y} мин: осталось {l1} мин.', '{y} min were spent earlier in 4 weeks: {l1} min left.'), { y: b.earlier as number, l1: m1.left ?? 0 });
    }
  },
});
