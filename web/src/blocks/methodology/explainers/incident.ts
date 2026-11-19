// X10 "From the alert to the postmortem" (07 §5.12): nine steps of one
// incident — a deployment with a defect, detection, acknowledgement, status,
// diagnosis, mitigation by rollback, confirmation, the timeline of a blameless
// review and the action items on the board. Times come from the flowlab
// formulas (engine/flowlab/sim.ts), so they match the simulator.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { ElementCard, Step } from '../../../core/types';
import { detectMinutes, diagnoseMinutes, restoreMinutes } from '../../../engine/flowlab/sim';

type P = { detection: string; rollback: boolean; runbook: boolean; batch: string; failing: number };

const card = (what: Bi, who: Bi, extra: Partial<ElementCard> = {}): ElementCard => ({ what, who, ...extra });
const PM = { url: 'https://sre.google/sre-book/postmortem-culture/', label: 'SRE book › Postmortem Culture' };
const IM = { url: 'https://sre.google/sre-book/managing-incidents/', label: 'SRE book › Managing Incidents' };

export const SLO = 0.999;
export const BUDGET_MIN = (1 - SLO) * 30 * 24 * 60;
export const REVENUE_PER_MIN = 200;
const ESCALATE_MIN = 15;

export interface IncidentNumbers {
  detect: number;
  ack: number;
  diagnose: number;
  restore: number;
  downtime: number;
  bad: number;
  budgetPct: number;
  lost: number;
  hotfix: boolean;
}

export function incidentNumbers(p: P, noRota: boolean, cpuAlert: boolean): IncidentNumbers {
  const share = p.failing / 100;
  const monitoring = cpuAlert ? 'none' : (p.detection as 'none' | 'host-check' | 'slo-alerts');
  // The deployment broke the checkout: the server is alive, a share of orders fails.
  const detect = detectMinutes(monitoring, 'checkout-broken', share, SLO);
  const ack = noRota && detect < 240 ? ESCALATE_MIN : detect < 240 ? 2 : 0;
  const diagnose = diagnoseMinutes(Number(p.batch), false, true) * (p.runbook ? 1 : 2);
  const restore = restoreMinutes(p.rollback);
  const downtime = detect + ack + diagnose + restore;
  const bad = Math.round(downtime * share * 10) / 10;
  return { detect, ack, diagnose, restore, downtime, bad, budgetPct: Math.round((bad / BUDGET_MIN) * 100), lost: Math.round(downtime * share * REVENUE_PER_MIN), hotfix: !p.rollback };
}

const rub = (x: number) => `${Math.round(x).toLocaleString('ru-RU')} ₽`;
const usd = (x: number) => `$${Math.round(x / 80).toLocaleString('en-US')}`;

export const incidentModel = defineModel<P>({
  id: 'method.x.incident',
  block: 'methodology',
  title: bi('От оповещения до разбора', 'From the alert to the postmortem'),
  summary: bi(
    'Один инцидент по шагам: выкладка с дефектом, обнаружение, подтверждение, статус, диагностика, откат, подтверждение восстановления, хронология и задачи на улучшение. Меняйте мониторинг, откат, инструкцию и размер выкладки.',
    'One incident step by step: a faulty deployment, detection, acknowledgement, status, diagnosis, rollback, confirmation, the timeline and the action items. Change the monitoring, the rollback, the runbook and the deployment size.',
  ),
  concepts: ['method.incident-response', 'method.postmortem'],
  diagram: {
    width: 1040,
    height: 400,
    nodes: [
      { id: 'deploy', label: bi('Выкладка #41', 'Deploy #41'), sub: '3 changes', family: 'ci-deploy', x: 16, y: 32, w: 144, h: 56, card: card(bi('Запись журнала выкладок: время, номер, какие изменения ушли.', 'An entry in the deployment log: the time, the number, which changes went out.'), bi('Конвейер или эксплуатация.', 'The pipeline or operations.')) },
      { id: 'service', label: bi('Сервис', 'Service'), sub: '', family: 'node', shape: 'rack', x: 240, y: 24, w: 136, h: 72, card: card(bi('Магазин в проде. После выкладки часть оформлений заказа перестала проходить.', 'The shop in production. After the deployment part of the checkouts started to fail.'), bi('Сайт.', 'The site.')) },
      { id: 'monitor', label: bi('Мониторинг', 'Monitoring'), sub: '', family: 'gauge', x: 472, y: 32, w: 128, h: 56, card: card(bi('Смотрит на долю успешных оформлений и скорость сжигания бюджета; если смотреть только на сервер — сбой оплаты не виден.', 'Watches the share of successful checkouts and the burn rate; watching only the server, a checkout failure is invisible.'), bi('Система мониторинга.', 'The monitoring system.'), { doc: { url: 'https://sre.google/workbook/alerting-on-slos/', label: 'SRE Workbook › Alerting on SLOs' } }) },
      { id: 'oncall', label: bi('Дежурный', 'On-call'), sub: '', family: 'user', x: 696, y: 32, w: 120, h: 56, card: card(bi('Человек, который по графику отвечает за срочные оповещения: подтверждает, оценивает, восстанавливает.', 'The person who, by the rota, answers pages: acknowledges, assesses, restores.'), bi('Команда, по графику дежурств.', 'The team, by the on-call rota.'), { doc: IM }) },
      { id: 'backup', label: bi('Запасной', 'Secondary'), sub: '', family: 'user', x: 912, y: 32, w: 112, h: 56, card: card(bi('Второй дежурный: оповещение уходит ему, если первый не подтвердил за 15 минут (эскалация).', 'The secondary on-call: the page goes to them if the first did not acknowledge in 15 minutes (escalation).'), bi('Команда, по графику дежурств.', 'The team, by the on-call rota.')) },
      { id: 'status', label: bi('Канал статуса', 'Status channel'), sub: '', family: 'neutral', x: 688, y: 168, w: 136, h: 56, card: card(bi('Куда пишут: что видим, что делаем, когда следующее сообщение. Владелец бизнеса и поддержка не спрашивают дежурного — они читают канал.', 'Where the updates go: what we see, what we do, when the next update is. The owner and support do not ask the on-call engineer; they read the channel.'), bi('Дежурный или координатор инцидента.', 'The on-call engineer or the incident commander.')) },
      { id: 'log', label: bi('Журнал выкладок', 'Deploy log'), sub: '', family: 'obj', shape: 'doc', x: 16, y: 168, w: 144, h: 56, card: card(bi('Первый вопрос диагностики: что менялось последним.', 'The first question of diagnosis: what changed last.'), bi('Конвейер пишет автоматически.', 'The pipeline writes it automatically.')) },
      { id: 'postmortem', label: bi('Разбор', 'Postmortem'), sub: '', family: 'obj', shape: 'doc', x: 296, y: 304, w: 176, h: 64, card: card(bi('Хронология из всех источников, влияние, способствующие факторы и задачи на улучшение. Без поиска виноватого.', 'A timeline from every source, impact, contributing factors and action items. No search for someone to blame.'), bi('Участники инцидента, в течение нескольких дней.', 'The people involved, within a few days.'), { doc: PM }) },
      { id: 'board', label: bi('Доска', 'Board'), sub: '', family: 'neutral', x: 688, y: 304, w: 136, h: 64, card: card(bi('Задачи на улучшение становятся обычными карточками с владельцем и сроком.', 'Action items become ordinary cards with an owner and a due date.'), bi('Команда.', 'The team.')) },
    ],
    edges: [
      { id: 'e-deploy', from: 'deploy', to: 'service', label: bi('изменения', 'changes'), card: card(bi('Выкладка привезла изменения на прод.', 'The deployment brought the changes to production.'), bi('Конвейер.', 'The pipeline.')) },
      { id: 'e-signal', from: 'service', to: 'monitor', label: bi('доля ошибок', 'error share'), card: card(bi('Сервис отдаёт метрики: сколько оформлений прошло, сколько нет.', 'The service exports metrics: how many checkouts passed, how many failed.'), bi('Сервис и мониторинг.', 'The service and monitoring.')) },
      { id: 'e-page', from: 'monitor', to: 'oncall', label: 'page', card: card(bi('Срочное оповещение будит человека; тикет — нет.', 'A page wakes a person; a ticket does not.'), bi('Правило оповещения.', 'The alerting rule.')) },
      { id: 'e-escalate', from: 'oncall', to: 'backup', label: bi('эскалация', 'escalation'), dashed: true, card: card(bi('Не подтвердили за 15 минут — оповещение уходит запасному.', 'Not acknowledged in 15 minutes: the page goes to the secondary.'), bi('Система оповещений.', 'The paging system.')) },
      { id: 'e-status', from: 'oncall', to: 'status', label: bi('статус', 'status'), card: card(bi('Первый статус — в первые минуты, даже если причина неизвестна.', 'The first status goes out in the first minutes, even when the cause is unknown.'), bi('Дежурный.', 'The on-call engineer.')) },
      { id: 'e-diag', from: 'oncall', to: 'log', via: [[756, 132], [88, 132]], label: bi('что менялось?', 'what changed?'), labelAt: 0.5, card: card(bi('Диагностика начинается с журнала выкладок: последнее изменение — первый подозреваемый.', 'Diagnosis starts with the deployment log: the last change is the first suspect.'), bi('Дежурный, по инструкции.', 'The on-call engineer, by the runbook.')) },
      { id: 'e-rollback', from: 'log', to: 'service', via: [[296, 196]], label: bi('откат', 'rollback'), card: card(bi('Смягчение: вернуть прошлую версию, а причину искать потом.', 'Mitigation: put the previous version back and look for the cause later.'), bi('Дежурный.', 'The on-call engineer.')) },
      { id: 'e-timeline', from: 'status', to: 'postmortem', via: [[756, 268], [384, 268]], label: bi('факт ↔ время', 'fact ↔ time'), labelAt: 0.4, card: card(bi('Хронологию собирают из всех источников: журнала выкладок, графиков, канала статуса, тикетов поддержки.', 'The timeline is assembled from every source: the deployment log, the graphs, the status channel, support tickets.'), bi('Автор разбора.', 'The author of the review.')) },
      { id: 'e-actions', from: 'postmortem', to: 'board', label: bi('фактор → задача', 'factor → task'), card: card(bi('Каждый способствующий фактор становится задачей: «оповещение по доле ошибок», «откат одной кнопкой».', 'Each contributing factor becomes a task: “alert on the error share”, “one-click rollback”.'), bi('Команда.', 'The team.')) },
    ],
  },
  params: [
    {
      id: 'detection',
      label: bi('Что замечает сбой', 'What notices the outage'),
      kind: 'choice',
      options: [
        { id: 'none', label: bi('никто, только жалобы', 'nobody, only complaints') },
        { id: 'host-check', label: bi('проверка сервера', 'a server check') },
        { id: 'slo-alerts', label: bi('оповещение по доле ошибок', 'an alert on the error share') },
      ],
      default: 'slo-alerts',
      near: 'monitor',
      predict: {
        prompt: bi('Мониторинг проверяет только, жив ли сервер. Сервер жив, а 20% заказов не проходят. Когда заметят сбой?', 'Monitoring only checks whether the server is alive. The server is alive and 20% of orders fail. When will the outage be noticed?'),
        options: [
          { id: 'late', text: bi('Через несколько часов, по жалобам покупателей', 'In a few hours, from customer complaints') },
          { id: 'fast', text: bi('Через несколько минут', 'In a few minutes') },
        ],
        resolve: (_p, next) => ((next[next.length - 1].metrics?.detect ?? 0) >= 60 ? 'late' : 'fast'),
      },
    },
    { id: 'rollback', label: bi('Откат одной командой', 'One-command rollback'), kind: 'toggle', default: true, near: 'e-rollback' },
    { id: 'runbook', label: bi('Инструкция для дежурного', 'Runbook for the on-call engineer'), kind: 'toggle', default: true, near: 'oncall' },
    {
      id: 'batch',
      label: bi('Изменений в выкладке', 'Changes in the deployment'),
      kind: 'choice',
      options: [
        { id: '1', label: bi('1', '1') },
        { id: '3', label: bi('3', '3') },
        { id: '10', label: bi('10', '10') },
      ],
      default: '3',
      near: 'deploy',
    },
    { id: 'failing', label: bi('Доля неуспешных заказов, %', 'Share of failing orders, %'), kind: 'range', min: 1, max: 100, step: 1, unit: '%', default: 20, near: 'service' },
  ],
  breaks: [
    {
      id: 'no-rota',
      label: bi('Убрать график дежурств', 'Remove the on-call rota'),
      remove: ['oncall'],
      boundary: 'identity',
      predict: {
        prompt: bi('Дежурного по графику нет: оповещение пришло «всем». Что будет?', 'There is no on-call rota: the page went to “everyone”. What happens?'),
        options: [
          { id: 'escalate', text: bi('Никто не подтвердит, через 15 минут оповещение уйдёт запасному', 'Nobody acknowledges; after 15 minutes the page escalates to the secondary') },
          { id: 'faster', text: bi('Кто-нибудь возьмёт сразу — людей же больше', 'Someone will take it at once: there are more people') },
        ],
        resolve: () => 'escalate',
      },
    },
    {
      id: 'cpu-alert',
      label: bi('Оповещение по загрузке процессора', 'An alert on CPU load'),
      remove: ['e-signal'],
      boundary: 'process',
      predict: {
        prompt: bi('Оповещение смотрит на процессор, а сломана оплата. Что будет?', 'The alert watches the CPU, and the checkout is broken. What happens?'),
        options: [
          { id: 'silent', text: bi('Оповещение промолчит, сбой заметят покупатели', 'The alert stays silent; the customers notice the outage') },
          { id: 'fires', text: bi('Сработает как обычно', 'It fires as usual') },
        ],
        resolve: () => 'silent',
      },
    },
  ],
  metrics: [
    { id: 'detect', label: bi('до обнаружения', 'to detection'), unit: 'min' },
    { id: 'restore', label: bi('до восстановления', 'to recovery'), unit: 'min' },
    { id: 'bad', label: bi('плохих минут', 'bad minutes') },
    { id: 'budget', label: bi('бюджета месяца', 'of the month’s budget'), unit: '%' },
  ],
  run(p, broken): Step[] {
    const noRota = broken.has('no-rota');
    const cpu = broken.has('cpu-alert');
    const n = incidentNumbers(p, noRota, cpu);
    let t = 0;
    const m = (restored = false) => ({ detect: n.detect, restore: restored ? n.downtime : t, bad: restored ? n.bad : Math.round(t * (p.failing / 100) * 10) / 10, budget: restored ? n.budgetPct : Math.round(((t * p.failing) / 100 / BUDGET_MIN) * 100) });
    const steps: Step[] = [];
    steps.push({
      id: 's1',
      label: bi('выкладка', 'deploy'),
      caption: fmt(bi('02:00. Выкладка #41 из {b} изм. Сразу после неё перестают проходить {f}% заказов: сервер жив, оплата нет.', '02:00. Deployment #41 with {b} changes. Right after it {f}% of orders start to fail: the server is alive, the checkout is not.'), { b: p.batch, f: p.failing }),
      focus: ['deploy', 'e-deploy', 'service'],
      tokens: [{ edge: 'e-deploy', label: `×${p.batch}` }],
      values: { deploy: `${p.batch} changes`, service: `errors ${p.failing}%`, monitor: '', oncall: '', status: '', log: '', postmortem: '', board: '' },
      states: { service: 'err', ...(noRota ? { oncall: 'off', 'e-status': 'off' } : {}), ...(cpu ? { 'e-signal': 'off' } : {}) },
      metrics: m(),
    });
    t = n.detect;
    const late = n.detect >= 240;
    steps.push(
      late
        ? {
            id: 's2',
            label: bi('тишина', 'silence'),
            caption: cpu ? bi('Оповещение смотрит на процессор: он в норме. Сигнала нет — через 4 часа поддержка приносит жалобы покупателей.', 'The alert watches the CPU: it is fine. No signal: after 4 hours support brings in customer complaints.') : bi('Проверка видит только падение сервера, а сервер жив. Через 4 часа поддержка приносит жалобы покупателей.', 'The check only sees the server going down, and the server is alive. After 4 hours support brings in customer complaints.'),
            focus: ['monitor'],
            states: { monitor: 'off' },
            values: { monitor: cpu ? 'CPU OK' : 'host UP' },
            metrics: m(),
            ...(cpu ? { broken: { at: 'monitor', message: 'ALERT HighCPU: inactive (cpu=35%)', caption: bi('индикатор не описывает опыт покупателя: процессор в норме, заказы не проходят.', 'the indicator does not describe the customer’s experience: the CPU is fine, orders fail.') } } : {}),
          }
        : { id: 's2', label: bi('порог', 'threshold'), caption: fmt(bi('Скорость сжигания бюджета пересекла порог срочного оповещения: сбой обнаружен через {d} мин.', 'The burn rate crossed the paging threshold: the outage is detected after {d} min.'), { d: n.detect }), focus: ['e-signal', 'monitor'], tokens: [{ edge: 'e-signal' }], states: { monitor: 'warn' }, values: { monitor: `burn ${Math.round(p.failing / 100 / (1 - SLO))}×` }, metrics: m() },
    );
    if (!late) {
      t += n.ack;
      steps.push(
        noRota
          ? {
              id: 's3',
              label: bi('эскалация', 'escalate'),
              caption: bi('Оповещение ушло «всем», и каждый решил, что ответит кто-то другой. Через 15 минут его получает запасной дежурный.', 'The page went to “everyone”, and each thought someone else would answer. After 15 minutes the secondary gets it.'),
              focus: ['e-escalate', 'backup'],
              tokens: [{ edge: 'e-escalate' }],
              states: { backup: 'on' },
              values: { backup: 'ACK +15 min' },
              metrics: m(),
              broken: { at: 'oncall', message: 'PAGE #1932: not acknowledged in 15 min, escalating to secondary', caption: bi('без графика дежурств ответственный не назначен: оповещение ждёт, пока его кто-то возьмёт.', 'without a rota nobody is responsible: the page waits until someone takes it.') },
            }
          : { id: 's3', label: 'ack', caption: bi('Дежурный подтверждает оповещение за пару минут: сбой теперь его, остальные знают, что им занимаются.', 'The on-call engineer acknowledges the page within a couple of minutes: the outage is now theirs, and everyone knows it is being handled.'), focus: ['e-page', 'oncall'], tokens: [{ edge: 'e-page', label: 'page' }], states: { oncall: 'on' }, values: { oncall: 'ACK' }, metrics: m() },
      );
    }
    steps.push({ id: 's4', label: bi('статус 1', 'status 1'), caption: bi('Первый статус: «Видим: не проходят оплаты. Делаем: ищем причину. Следующее сообщение — через 30 минут».', 'First status: “We see: payments fail. We are doing: looking for the cause. Next update in 30 minutes.”'), focus: ['e-status', 'status'], tokens: [{ edge: 'e-status' }], values: { status: 'status 1' }, metrics: m() });
    t += n.diagnose;
    steps.push({
      id: 's5',
      label: bi('диагностика', 'diagnose'),
      caption: fmt(bi('Что менялось последним? Журнал выкладок: #41, {b} изм. Поиск занял {d} мин{r}.', 'What changed last? The deployment log: #41, {b} changes. The search took {d} min{re}.'), { b: p.batch, d: n.diagnose, r: p.runbook ? '' : ' — без инструкции вдвое дольше', re: p.runbook ? '' : ', twice as long without a runbook' }),
      focus: ['e-diag', 'log'],
      tokens: [{ edge: 'e-diag' }],
      values: { log: `#41 · ${p.batch}` },
      states: { log: 'on' },
      metrics: m(),
    });
    t += n.restore;
    steps.push(
      p.rollback
        ? { id: 's6', label: bi('откат', 'rollback'), caption: fmt(bi('Смягчение: откат к #40 за {r} мин. Доля ошибок падает до нуля. Причину будут искать потом, спокойно.', 'Mitigation: rollback to #40 in {r} min. The error share falls to zero. The cause will be found later, calmly.'), { r: n.restore }), focus: ['e-rollback', 'service'], tokens: [{ edge: 'e-rollback', label: '#40' }], states: { service: 'ok' }, values: { service: 'errors 0%' }, metrics: m(true) }
        : { id: 's6', label: bi('хотфикс', 'hotfix'), caption: fmt(bi('Отката нет: пишут исправление и выкладывают его — {r} мин. Это вторая, внеплановая выкладка.', 'No rollback: a fix is written and deployed, {r} min. That is a second, unplanned deployment.'), { r: n.restore }), focus: ['e-rollback', 'service'], tokens: [{ edge: 'e-rollback', label: '#42' }], states: { service: 'ok', 'e-rollback': 'warn' }, values: { service: 'errors 0%' }, metrics: m(true) },
    );
    steps.push({
      id: 's7',
      label: bi('восстановлено', 'restored'),
      caption: fmt(bi('Итоговый статус: «Восстановлено». Сбой длился {m} мин: {b} плохих минут — {pc}% бюджета ошибок месяца; потеряно {x} выручки.', 'Final status: “Restored.” The outage lasted {m} min: {b} bad minutes, {pc}% of the month’s error budget; {xe} of revenue lost.'), { m: n.downtime, b: n.bad, pc: n.budgetPct, x: rub(n.lost), xe: usd(n.lost) }),
      focus: ['status'],
      values: { status: 'restored' },
      states: { status: 'ok' },
      metrics: m(true),
    });
    steps.push({
      id: 's8',
      label: bi('хронология', 'timeline'),
      caption: bi('На следующий день — разбор. Хронологию собирают из журнала выкладок, графиков, канала статуса и тикетов. Вопрос — «что было видно в этот момент», а не «кто ошибся».', 'The next day, the review. The timeline is built from the deployment log, the graphs, the status channel and the tickets. The question is “what could be seen at that moment”, not “who made the mistake”.'),
      focus: ['e-timeline', 'postmortem'],
      tokens: [{ edge: 'e-timeline' }],
      values: { postmortem: 'draft' },
      metrics: m(true),
    });
    const factors = [late ? bi('оповещение по доле ошибок', 'an alert on the error share') : null, noRota ? bi('график дежурств', 'an on-call rota') : null, p.rollback ? null : bi('откат одной командой', 'one-command rollback'), p.runbook ? null : bi('инструкция для дежурного', 'a runbook'), Number(p.batch) > 3 ? bi('выкладки поменьше', 'smaller deployments') : null, bi('автотест на оформление заказа', 'an automated test of checkout')].filter((x): x is Bi => !!x);
    steps.push({
      id: 's9',
      label: bi('задачи', 'actions'),
      caption: fmt(bi('Способствующие факторы превращаются в задачи на доске: {l}.', 'The contributing factors become tasks on the board: {le}.'), { l: factors.map((f) => f.ru).join(', '), le: factors.map((f) => f.en).join(', ') }),
      focus: ['e-actions', 'board'],
      tokens: [{ edge: 'e-actions', label: `${factors.length}` }],
      values: { board: `+${factors.length} tasks`, postmortem: 'done' },
      states: { board: 'ok' },
      metrics: m(true),
    });
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    const m0 = prev[prev.length - 1].metrics ?? {};
    const m1 = next[next.length - 1].metrics ?? {};
    const v = { r0: m0.restore ?? 0, r1: m1.restore ?? 0, b1: m1.budget ?? 0, d0: m0.detect ?? 0, d1: m1.detect ?? 0 };
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломка убрана.', 'The break is removed.');
      return change.id === 'no-rota' ? fmt(bi('Без графика дежурств оповещение ждёт 15 минут до эскалации: сбой {r0} → {r1} мин.', 'Without a rota the page waits 15 minutes until it escalates: the outage goes {r0} → {r1} min.'), v) : fmt(bi('Оповещение по процессору не видит сбой оплаты: обнаружение {d0} → {d1} мин, сбой {r0} → {r1} мин, {b1}% бюджета месяца.', 'A CPU alert cannot see a checkout failure: detection {d0} → {d1} min, the outage {r0} → {r1} min, {b1}% of the month’s budget.'), v);
    }
    switch (change.id) {
      case 'detection':
        return fmt(bi('Обнаружение {d0} → {d1} мин, весь сбой {r0} → {r1} мин, {b1}% бюджета месяца. Проверка сервера не видит сбой оплаты: сервер отвечает, а заказы не проходят.', 'Detection {d0} → {d1} min, the whole outage {r0} → {r1} min, {b1}% of the month’s budget. A server check cannot see a checkout failure: the server answers while orders fail.'), v);
      case 'rollback':
        return b.rollback ? fmt(bi('С откатом восстановление за 10 минут вместо 120: сбой {r0} → {r1} мин.', 'With rollback recovery takes 10 minutes instead of 120: the outage goes {r0} → {r1} min.'), v) : fmt(bi('Без отката путь идёт через хотфикс: сбой {r0} → {r1} мин, и появляется вторая, внеплановая выкладка.', 'Without rollback the path goes through a hotfix: the outage goes {r0} → {r1} min, and a second, unplanned deployment appears.'), v);
      case 'runbook':
        return fmt(bi('Без инструкции диагностика вдвое дольше: сбой {r0} → {r1} мин.', 'Without a runbook diagnosis takes twice as long: the outage goes {r0} → {r1} min.'), v);
      case 'batch':
        return fmt(bi('{x} → {y} изменений в выкладке: искать виноватое дольше, сбой {r0} → {r1} мин.', '{x} → {y} changes in the deployment: finding the faulty one takes longer, the outage goes {r0} → {r1} min.'), { x: a.batch as string, y: b.batch as string, ...v });
      default:
        return fmt(bi('Доля ошибок {x}% → {y}%: {b1}% бюджета месяца.', 'Error share {x}% → {y}%: {b1}% of the month’s budget.'), { x: a.failing as number, y: b.failing as number, ...v });
    }
  },
});
