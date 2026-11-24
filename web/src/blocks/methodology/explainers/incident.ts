// X10 "From the alert to the postmortem" (07 §5.12): the steps of one
// incident — a deployment with a defect, detection, acknowledgement, status,
// diagnosis, mitigation by rollback, confirmation, the timeline of a blameless
// review and the action items on the board. Times come from the flowlab
// formulas (engine/flowlab/sim.ts), so they match the simulator.
//
// Reading order: at the first step only the deployment and the site are on
// the picture. Monitoring, the on-call engineer, the status channel, the
// deployment log, the postmortem and the board appear when the incident
// reaches them; each says in a callout what it does at that moment, and what
// it hands on travels along the line as a card.

import { defineModel } from '../../../core/define';
import type { Step } from '../../../core/types';
import { detectMinutes, diagnoseMinutes, restoreMinutes } from '../../../engine/flowlab/sim';
import { t as tr } from '../../../core/i18n';
import { b, card, edge, fmtn, hiddenExcept, lastMetrics, node, nWord, pctIn, type Bi } from './kit';

type P = { detection: string; rollback: boolean; runbook: boolean; batch: string; failing: number };

const PM = { url: 'https://sre.google/sre-book/postmortem-culture/', label: 'SRE book › Postmortem Culture' };
const IM = { url: 'https://sre.google/sre-book/managing-incidents/', label: 'SRE book › Managing Incidents' };

export const SLO = 0.999;
export const BUDGET_MIN = (1 - SLO) * 30 * 24 * 60;
export const REVENUE_PER_MIN = 200;
const ESCALATE_MIN = 15;

export interface IncidentNumbers {
  detect: number;
  ack: number;
  /** Minutes to find the last deployment in the log and decide to roll it back. */
  locate: number;
  /** Minutes to find the faulty change among those in the deployment. */
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
  const ack = noRota ? ESCALATE_MIN : detect < 240 ? 2 : 0;
  const locate = p.runbook ? 5 : 10;
  const diagnose = diagnoseMinutes(Number(p.batch), false, true) * (p.runbook ? 1 : 2);
  const restore = restoreMinutes(p.rollback);
  // Restore first, look for the cause later: with a rollback the whole deployment goes back as soon as the log names it,
  // and the faulty change is looked for in the daytime. Without one the site can only be fixed by fixing that change.
  const downtime = detect + ack + (p.rollback ? locate : diagnose) + restore;
  const bad = Math.round(downtime * share * 10) / 10;
  return { detect, ack, locate, diagnose, restore, downtime, bad, budgetPct: Math.round((bad / BUDGET_MIN) * 100), lost: Math.round(downtime * share * REVENUE_PER_MIN), hotfix: !p.rollback };
}

const money = (x: number): Bi => ({ ru: `${Math.round(x).toLocaleString('ru-RU')} ₽`, en: `$${Math.round(x / 80).toLocaleString('en-US')}` });
/** "20 минут" after "за", "через", "длился": the accusative. */
const MIN = (m: number) => nWord(m, ['минуту', 'минуты', 'минут'], ['minute', 'minutes']);
/** "3 изменений" after "из". */
const CH = (n: number) => nWord(n, ['изменения', 'изменений', 'изменений'], ['change', 'changes']);
const pct = (n: number) => ({ ru: `${n} %`, en: `${n}%` });
/** The wall clock of the incident: 02:00 plus the minutes passed. */
const clock = (m: number) => {
  const t = 120 + Math.round(m);
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
const ALL = ['deploy', 'service', 'monitor', 'oncall', 'backup', 'status', 'log', 'postmortem', 'board', 'e-deploy', 'e-signal', 'e-page', 'e-escalate', 'e-status', 'e-diag', 'e-rollback', 'e-timeline', 'e-actions'];
const ONCALL: [string, string] = ['Этот шаг выполняет дежурный.', 'The on-call engineer does this step.'];

export const incidentModel = defineModel<P>({
  id: 'method.x.incident',
  frame: 'visible',
  block: 'methodology',
  title: b('От оповещения до разбора', 'From the alert to the postmortem'),
  summary: b(
    'Один инцидент в магазине по шагам, от ночной выкладки с ошибкой до задач на улучшение. Мониторинг замечает сбой, дежурный подтверждает оповещение и пишет статус, находит в журнале последнюю выкладку и откатывает её целиком, а на следующий день команда разбирает случившееся без поиска виноватых. Под схемой копится время до обнаружения и до восстановления, плохие минуты, доля месячного бюджета ошибок, которую потратил этот сбой, и время, которое уйдёт на поиск виноватого изменения.',
    'One incident in the shop step by step, from a faulty night deployment to the action items. Monitoring notices the outage, the on-call engineer acknowledges the alert and posts a status, finds the last deployment in the log and rolls it back as a whole, and the next day the team reviews what happened without looking for someone to blame. Under the diagram the time to detection and to recovery, the bad minutes, the share of the monthly error budget this outage ate and the time it takes to find the faulty change add up.',
  ),
  intro: b(
    'Схема собирается по шагам, и сейчас на ней видны только выкладка и сайт магазина. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Каждый участник появляется, когда до него доходит инцидент, и говорит в облачке, что он делает в эту минуту, а карточка на линии показывает, что он передаёт дальше. Подпись каждого шага начинается с времени ночи.\n\nПосле первого прохода меняйте «Параметры» и включайте поломки в блоке «Сломать», а схема объяснит, что изменилось и почему.',
    'The diagram builds up step by step, and for now it shows only the deployment and the shop’s site. Press “Start from the first step”, then go on with “Step forward” above the diagram. Each participant appears when the incident reaches it and says in a callout what it does at that minute, and the card on the line shows what it hands on. The time of night is given at the start of the step caption.\n\nAfter the first pass change the “Parameters” and switch on the breaks in “Break it”, and the diagram explains what changed and why.',
  ),
  legend: [
    { mark: 'active', text: b('участник, который действует сейчас', 'the participant acting now') },
    { mark: 'say', text: b('что он делает в эту минуту', 'what it does at that minute') },
    { mark: 'token', text: b('что он передаёт дальше', 'what it hands on') },
    { mark: 'err', text: b('на этом участке поломка или задержка', 'a break or a delay at this point') },
    { mark: 'ok', text: b('сайт восстановлен, и задачи заведены', 'the site is restored, and the tasks are filed') },
    { mark: 'dashed', text: b('эскалация к запасному дежурному', 'escalation to the secondary') },
    { mark: 'icon:server', text: b('сайт магазина', 'the shop’s site') },
    { mark: 'icon:user', text: b('дежурные', 'the on-call engineers') },
    { mark: 'icon:file', text: b('журнал выкладок и разбор', 'the deployment log and the review') },
  ],
  stopLabel: b('Реагирование задержалось', 'The response was delayed'),
  concepts: ['method.incident-response', 'method.postmortem'],
  diagram: {
    width: 960,
    height: 490,
    nodes: [
      node('deploy', b('Выкладка #41', 'Deploy #41'), 'ci-deploy', [24, 40, 168, 60], card(['Выкладка, после которой начался сбой. В журнале о ней записаны время, номер и список изменений, которые в неё вошли.', 'The deployment after which the outage began. The log records its time, its number and the list of changes in it.'], ['Выкладывает конвейер или эксплуатация.', 'The pipeline or operations deploys.']), { icon: 'container' }),
      node('service', b('Сайт магазина', 'Shop site'), 'node', [264, 40, 184, 64], card(['Рабочий сайт магазина. После выкладки часть оформлений заказа перестала проходить, хотя сам сервер продолжает отвечать.', 'The shop’s working site. After the deployment part of the checkouts started to fail, although the server itself keeps answering.'], ['Сайт обслуживает эксплуатация.', 'Operations looks after it.']), { icon: 'server' }),
      node('monitor', b('Мониторинг', 'Monitoring'), 'gauge', [520, 40, 176, 60], card(['Система, которая следит за долей успешных оформлений заказа и скоростью сжигания бюджета ошибок. Если она смотрит только на то, отвечает ли сервер, сбой оплаты ей не виден.', 'The system that watches the share of successful checkouts and the burn rate of the error budget. If it only watches whether the server answers, a checkout failure is invisible to it.'], ['Мониторинг настраивает команда.', 'The team sets it up.'], { url: 'https://sre.google/workbook/alerting-on-slos/', label: 'SRE Workbook › Alerting on SLOs' }), { icon: 'process' }),
      node('oncall', b('Дежурный', 'On-call'), 'user', [776, 40, 160, 60], card(['Человек, который по графику дежурств отвечает за срочные оповещения. Он подтверждает оповещение, оценивает сбой и восстанавливает сервис.', 'The person who, by the on-call rota, answers pages. They acknowledge the alert, assess the outage and restore the service.'], ['Дежурного назначает команда по графику.', 'The team assigns them by the rota.'], IM), { icon: 'user' }),
      node('backup', b('Запасной дежурный', 'Secondary'), 'user', [776, 240, 160, 60], card(['Запасным называют второго дежурного. Оповещение уходит ему, если первый дежурный не подтвердил его за 15 минут, и такую передачу называют эскалацией.', 'The second on-call engineer. The page goes to them if the first did not acknowledge it within 15 minutes; this is called escalation.'], ['Его тоже назначает команда по графику.', 'The team assigns them by the rota too.']), { icon: 'user' }),
      node('status', b('Канал статуса', 'Status channel'), 'neutral', [264, 240, 184, 60], card(['Канал статуса — это чат, куда дежурный пишет, что команда видит, что делает и когда будет следующее сообщение. Владелец бизнеса и поддержка читают этот канал и не отвлекают дежурного вопросами.', 'A chat where the on-call engineer writes what the team sees, what it does and when the next update is. The business owner and support read this channel instead of distracting the on-call engineer.'], ['Сообщения в канал пишет дежурный или координатор инцидента.', 'The on-call engineer or the incident commander writes the updates.']), { icon: 'browser' }),
      node('log', b('Журнал выкладок', 'Deploy log'), 'obj', [520, 240, 176, 60], card(['В журнал выкладок записано, когда была каждая выкладка и какие изменения в неё вошли. Диагностика начинается с вопроса, что менялось последним, и журнал отвечает на него.', 'A list of deployments with times and changes. Diagnosis starts with the question of what changed last, and the log answers it.'], ['Записи в журнал добавляет сам конвейер при каждой выкладке.', 'The pipeline adds an entry to the log at every deployment by itself.']), { icon: 'file' }),
      node('postmortem', b('Разбор', 'Postmortem'), 'obj', [264, 400, 184, 64], card(['Разбором называют письменный отчёт о сбое, в котором собраны хронология из всех источников, влияние на покупателей, способствующие факторы и задачи на улучшение. Виноватого в разборе не ищут.', 'A postmortem is a written report on the outage that holds a timeline from every source, the impact on the customers, the contributing factors and the action items. Nobody looks for someone to blame in it.'], ['Разбор пишут участники инцидента в течение нескольких дней.', 'The people involved write it within a few days.'], PM), { icon: 'file' }),
      node('board', b('Доска', 'Board'), 'neutral', [520, 400, 176, 64], card(['На доске команды задачи на улучшение становятся обычными карточками с владельцем и сроком.', 'The team’s board. The action items become ordinary cards on it, with an owner and a due date.'], ['Карточки заводит команда.', 'The team files the cards.']), { icon: 'folder' }),
    ],
    edges: [
      edge('e-deploy', 'deploy', 'service', b('изменения', 'changes'), card(['Выкладка поставила изменения на рабочий сайт.', 'The deployment brought the changes to the working site.'], ['Выкладывает конвейер.', 'The pipeline deploys.'])),
      edge('e-signal', 'service', 'monitor', b('доля ошибок', 'error share'), card(['Сайт сообщает мониторингу, сколько оформлений заказа прошло и сколько нет.', 'The site tells monitoring how many checkouts passed and how many failed.'], ['Метрики отдаёт сайт, а собирает их мониторинг.', 'The site exports the metrics, and monitoring collects them.'])),
      edge('e-page', 'monitor', 'oncall', b('срочное оповещение', 'page'), card(['Срочное оповещение будит человека звонком, а заявка в рабочей очереди ждёт рабочего дня.', 'A page wakes a person with a call; a ticket waits for the working day.'], ['Оповещение отправляет система оповещений.', 'The alerting system sends it.'])),
      edge('e-escalate', 'oncall', 'backup', b('эскалация', 'escalation'), card(['Если оповещение не подтвердили за 15 минут, оно уходит запасному дежурному.', 'If the page is not acknowledged within 15 minutes, it goes to the secondary.'], ['Оповещение передаёт дальше система оповещений.', 'The alerting system passes the page on.']), { dashed: true }),
      edge('e-status', 'oncall', 'status', b('статус', 'status'), card(['Первое сообщение о статусе уходит в первые минуты, даже если причина ещё неизвестна.', 'The first status update goes out in the first minutes, even when the cause is still unknown.'], ONCALL)),
      edge('e-diag', 'oncall', 'log', b('что менялось?', 'what changed?'), card(['Диагностика начинается с журнала выкладок, потому что первым подозревают последнее изменение.', 'Diagnosis starts with the deployment log, because the last change is suspected first.'], ['Журнал проверяет дежурный, как говорит инструкция.', 'The on-call engineer checks the log, as the runbook says.']), { labelAt: 0.4 }),
      edge('e-rollback', 'oncall', 'service', b('откат', 'rollback'), card(['Откат смягчает сбой, потому что дежурный возвращает на сайт прошлую версию, а причину ищут потом.', 'A rollback mitigates the outage, because the on-call engineer puts the previous version back on the site, and the cause is looked for later.'], ONCALL), { via: [[856, 16], [356, 16]], labelAt: 0.5 }),
      edge('e-timeline', 'status', 'postmortem', b('факты по времени', 'facts by time'), card(['Хронологию разбора собирают из всех источников: журнала выкладок, графиков мониторинга, канала статуса и обращений в поддержку.', 'The review’s timeline is assembled from every source: the deployment log, the monitoring graphs, the status channel and support tickets.'], ['Хронологию собирает автор разбора.', 'The author of the review assembles the timeline.'])),
      edge('e-actions', 'postmortem', 'board', b('фактор → задача', 'factor → task'), card(['Каждый способствующий фактор становится задачей, например «оповещение по доле ошибок» или «откат одной кнопкой».', 'Each contributing factor becomes a task, such as “an alert on the error share” or “one-click rollback”.'], ['Задачи заводит команда.', 'The team files them.'])),
    ],
  },
  params: [
    {
      id: 'detection',
      group: b('Как замечают сбой', 'How the outage is noticed'),
      label: b('Кто или что первым сообщит о поломке оплаты', 'Who or what first reports that the checkout broke'),
      kind: 'choice',
      options: [
        { id: 'none', label: b('никто, и о поломке узнают из жалоб покупателей', 'nobody, and the team learns from customer complaints') },
        { id: 'host-check', label: b('проверка, что сервер отвечает', 'a check that the server answers') },
        { id: 'slo-alerts', label: b('оповещение по доле неуспешных заказов', 'an alert on the share of failing orders') },
      ],
      default: 'slo-alerts',
      near: 'monitor',
      predict: {
        prompt: b('Вы меняете то, что первым сообщает о сбое. Допустим, мониторинг проверяет только, отвечает ли сервер. Сервер отвечает, а 20 % заказов не проходят. Когда команда узнает о сбое?', 'You change what first reports the outage. Suppose monitoring only checks whether the server answers. The server answers, while 20% of orders fail. When does the team learn about the outage?'),
        options: [
          { id: 'late', text: b('Через несколько часов, когда поддержка принесёт жалобы покупателей', 'In a few hours, when support brings in customer complaints') },
          { id: 'fast', text: b('Через несколько минут, как и с оповещением по доле ошибок', 'In a few minutes, as with an alert on the error share') },
        ],
        resolve: (_p, next) => ((lastMetrics(next).detect ?? 0) >= 60 ? 'late' : 'fast'),
      },
    },
    { id: 'rollback', group: b('Чем располагает дежурный', 'What the on-call engineer has'), label: b('Прошлую версию сайта можно вернуть одной командой', 'The previous version can be put back with one command'), kind: 'toggle', default: true, near: 'e-rollback' },
    { id: 'runbook', group: b('Чем располагает дежурный', 'What the on-call engineer has'), label: b('Есть инструкция для дежурного на такой случай', 'There is a runbook for this case'), kind: 'toggle', default: true, near: 'oncall' },
    {
      id: 'batch',
      group: b('Что сломалось', 'What broke'),
      label: b('Сколько изменений было в выкладке', 'How many changes were in the deployment'),
      kind: 'choice',
      options: [
        { id: '1', label: b('1', '1') },
        { id: '3', label: b('3', '3') },
        { id: '10', label: b('10', '10') },
      ],
      default: '3',
      near: 'deploy',
      levels: ['intermediate', 'experienced'],
    },
    { id: 'failing', group: b('Что сломалось', 'What broke'), label: b('Какая доля заказов не проходит, %', 'Share of failing orders, %'), kind: 'range', min: 1, max: 100, step: 1, default: 20, near: 'service', levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    {
      id: 'no-rota',
      label: b('В графике дыра: основного дежурного на эту ночь не назначили, поэтому срочное оповещение приходит всей команде сразу', 'A gap in the rota: nobody was made primary on-call for this night, so the page goes to the whole team at once'),
      remove: ['oncall'],
      boundary: 'identity',
      predict: {
        prompt: b('Основного дежурного на эту ночь не назначили, запасной дежурный в графике есть, и срочное оповещение пришло всей команде сразу. Сколько пройдёт времени, прежде чем кто-нибудь его подтвердит?', 'Nobody was made primary on-call for this night, a secondary is in the rota, and the page went to the whole team at once. How long before somebody acknowledges it?'),
        options: [
          { id: 'escalate', text: b('Никто не подтвердит, и через 15 минут оповещение уйдёт запасному дежурному', 'Nobody acknowledges, and after 15 minutes the page escalates to the secondary') },
          { id: 'faster', text: b('Пройдёт пара минут, ведь людей, которые видят оповещение, стало больше', 'A couple of minutes, since more people see the page') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 's3-escalate') ? 'escalate' : 'faster'),
      },
    },
    {
      id: 'cpu-alert',
      label: b('Оповещение настроено на загрузку процессора, а не на долю неуспешных заказов', 'The alert watches CPU load instead of the share of failing orders'),
      remove: ['e-signal'],
      boundary: 'process',
      predict: {
        prompt: b('Оповещение срабатывает, только когда процессор загружен больше чем на 90 %. Процессор загружен на 35 %, а оплата сломана. Что сделает оповещение?', 'The alert fires only when the CPU is loaded over 90%. The CPU is at 35%, and the checkout is broken. What does the alert do?'),
        options: [
          { id: 'silent', text: b('Оповещение промолчит, и о сбое первыми узнают покупатели', 'The alert stays silent, and the customers learn about the outage first') },
          { id: 'fires', text: b('Оповещение сработает как обычно', 'The alert fires as usual') },
        ],
        resolve: (_p, next) => ((lastMetrics(next).detect ?? 0) >= 240 ? 'silent' : 'fires'),
      },
    },
  ],
  metrics: [
    { id: 'detect', label: b('до обнаружения, минут', 'to detection, minutes') },
    { id: 'restore', label: b('до восстановления, минут', 'to recovery, minutes') },
    { id: 'bad', label: b('плохих минут', 'bad minutes') },
    { id: 'budget', label: b('месячного бюджета ошибок', 'of the monthly error budget'), unit: '%' },
    { id: 'cause', label: b('поиск виноватого изменения, минут', 'finding the faulty change, minutes') },
  ],
  run(p, broken): Step[] {
    const noRota = broken.has('no-rota');
    const cpu = broken.has('cpu-alert');
    const n = incidentNumbers(p, noRota, cpu);
    const batch = Number(p.batch);
    let t = 0;
    const m = (restored = false) => ({ detect: n.detect, restore: restored ? n.downtime : t, bad: restored ? n.bad : Math.round(t * (p.failing / 100) * 10) / 10, budget: restored ? n.budgetPct : Math.round(((t * p.failing) / 100 / BUDGET_MIN) * 100), cause: n.diagnose });
    const at = (text: Bi): Bi => fmtn(b('{c}. {t}', '{c}. {t}'), { c: clock(t), t: text });
    const steps: Step[] = [];
    steps.push({
      id: 's1',
      label: b('выкладка', 'deploy'),
      caption: at(fmtn(b('Ночная выкладка #41 из {b} уходит на сайт. Сразу после неё перестают проходить {f} заказов. Сервер при этом работает, и сломалась только оплата.', 'The night deployment #41 with {b} goes to the site. Right after it {f} of orders start to fail. The server keeps working, and only the checkout is broken.'), { b: CH(batch), f: pct(p.failing) })),
      focus: ['e-deploy', 'service'],
      say: { service: fmtn(b('После выкладки не проходит {f} заказов, хотя сервер отвечает.', 'After the deployment {f} of orders fail, although the server answers.'), { f: pct(p.failing) }) },
      tokens: [{ edge: 'e-deploy', label: fmtn(b('#41, {b}', '#41, {b}'), { b: nWord(batch, ['изменение', 'изменения', 'изменений'], ['change', 'changes']) }) }],
      states: { ...hiddenExcept(ALL, 'deploy', 'service', 'e-deploy'), service: 'err' },
      metrics: m(),
    });
    t = n.detect;
    const late = n.detect >= 240;
    if (late) {
      steps.push({
        id: 's2',
        label: b('тишина', 'silence'),
        caption: at(
          cpu
            ? b('Прошло четыре часа. Оповещение смотрело на процессор, а он загружен на 35 %, поэтому сигнала не было. О сбое команда узнаёт из жалоб покупателей, которые приносит поддержка.', 'Four hours have passed. The alert watched the CPU, which is at 35%, so there was no signal. The team learns about the outage from customer complaints brought by support.')
            : p.detection === 'host-check'
              ? b('Прошло четыре часа. Проверка видела, что сервер отвечает, и молчала, ведь сервер и правда работает. О сбое команда узнаёт из жалоб покупателей, которые приносит поддержка.', 'Four hours have passed. The check saw that the server answers and stayed silent, since the server does work. The team learns about the outage from customer complaints brought by support.')
              : b('Прошло четыре часа. Мониторинга нет, и о сбое команда узнаёт из жалоб покупателей, которые приносит поддержка.', 'Four hours have passed. There is no monitoring, and the team learns about the outage from customer complaints brought by support.'),
        ),
        focus: ['monitor'],
        say: { monitor: cpu ? b('Процессор загружен на 35 %, поэтому тревоги нет.', 'The CPU is at 35%, so there is no alarm.') : p.detection === 'host-check' ? b('Сервер отвечает, и проверка считает, что всё в порядке.', 'The server answers, and the check considers all is well.') : b('За сайтом никто не следит, поэтому сигнала нет.', 'Nobody watches the site, so there is no signal.') },
        reveal: ['monitor'],
        states: { monitor: 'off' },
        values: { monitor: cpu ? `CPU ${pctIn(35)}` : p.detection === 'host-check' ? '200 OK' : '—' },
        metrics: m(),
        ...(cpu ? { broken: { at: 'monitor', message: 'ALERT HighCPU: inactive (cpu=35%)\ncheckout success: 80%', caption: b('показатель для оповещения не описывает то, что видит покупатель, потому что процессор в норме, а заказы при этом не проходят.', 'the indicator for the alert does not describe what the customer sees, because the CPU is fine while orders fail.') } } : {}),
      });
      t += n.ack;
      steps.push(
        noRota
          ? {
              id: 's3-escalate',
              label: b('жалобы', 'complaints'),
              caption: at(b('Поддержка пишет о жалобах в общий чат команды, и каждый решает, что сбоем займётся кто-то другой. Только через 15 минут запасной дежурный берёт сбой на себя.', 'Support posts the complaints to the team’s common chat, and each person decides someone else will handle the outage. Only after 15 minutes does the secondary take it.')),
              focus: ['e-escalate', 'backup'],
              say: { backup: b('Жалобы 15 минут лежали в общем чате без ответа, и запасной дежурный берёт сбой на себя.', 'The complaints have sat unanswered in the common chat for 15 minutes, and the secondary takes the outage.') },
              tokens: [{ edge: 'e-escalate', label: b('+15 мин', '+15 min') }],
              reveal: ['oncall', 'e-escalate', 'backup'],
              states: { oncall: 'off', backup: 'on' },
              metrics: m(),
              broken: { at: 'oncall', message: tr(b('поддержка: 14 жалоб в общем чате, 15 минут без ответственного', 'support: 14 complaints in #team, no owner for 15 min')), caption: b('без назначенного дежурного никто не отвечает за сбой, и жалобы ждут, пока их кто-нибудь возьмёт.', 'without an assigned on-call engineer nobody is responsible for the outage, and the complaints wait until someone takes them.') },
            }
          : {
              id: 's3',
              label: b('жалобы', 'complaints'),
              caption: at(b('Поддержка передаёт жалобы дежурному, и он берёт сбой на себя. К этому моменту покупатели уже четыре часа не могут оплатить заказ.', 'Support passes the complaints to the on-call engineer, who takes the outage. By now the customers have been unable to pay for four hours.')),
              focus: ['oncall'],
              say: { oncall: b('Поддержка принесла жалобы покупателей, и дежурный берёт сбой на себя.', 'Support brought customer complaints, and the on-call engineer takes the outage.') },
              reveal: ['oncall'],
              metrics: m(),
            },
      );
    } else {
      steps.push({
        id: 's2',
        label: b('порог', 'threshold'),
        caption: at(fmtn(b('Мониторинг видит, что бюджет ошибок сгорает в {r} быстрее нормы. Порог срочного оповещения пройден через {d} после выкладки.', 'Monitoring sees the error budget burning {r} faster than normal. The paging threshold is crossed {d} after the deployment.'), { r: nWord(Math.round(p.failing / 100 / (1 - SLO)), ['раз', 'раза', 'раз'], ['time', 'times']), d: MIN(n.detect) })),
        focus: ['e-signal', 'monitor'],
        say: { monitor: b('Скорость сжигания выше порога, и мониторинг отправляет срочное оповещение.', 'The burn rate is above the threshold, and monitoring sends a page.') },
        tokens: [{ edge: 'e-signal', label: fmtn(b('ошибок {f}', 'errors {f}'), { f: pct(p.failing) }) }],
        reveal: ['e-signal', 'monitor'],
        states: { monitor: 'warn' },
        values: { monitor: `${Math.round(p.failing / 100 / (1 - SLO))}×`, service: pctIn(p.failing) },
        metrics: m(),
      });
      t += n.ack;
      steps.push(
        noRota
          ? {
              id: 's3-escalate',
              label: b('эскалация', 'escalate'),
              caption: at(b('Оповещение пришло всей команде, и каждый решил, что ответит кто-то другой. Через 15 минут его получает запасной дежурный и подтверждает.', 'The page went to the whole team, and each thought someone else would answer. After 15 minutes the secondary gets it and acknowledges.')),
              focus: ['e-escalate', 'backup'],
              say: { backup: b('Оповещение 15 минут никто не брал, поэтому оно пришло запасному дежурному, и тот берёт сбой на себя.', 'Nobody took the page for 15 minutes, so it came to the secondary, who takes the outage.') },
              tokens: [{ edge: 'e-escalate', label: b('+15 мин', '+15 min') }],
              reveal: ['e-page', 'oncall', 'e-escalate', 'backup'],
              states: { oncall: 'off', backup: 'on' },
              metrics: m(),
              broken: { at: 'oncall', message: 'PAGE #1932: not acknowledged in 15 min, escalating to secondary', caption: b('без назначенного дежурного никто не отвечает за оповещение, и оно ждёт, пока его кто-нибудь возьмёт.', 'without an assigned on-call engineer nobody is responsible for the page, and it waits until someone takes it.') },
            }
          : {
              id: 's3',
              label: b('подтверждение', 'ack'),
              caption: at(b('Дежурный подтверждает оповещение за пару минут. Теперь сбой за ним, и остальные знают, что им занимаются.', 'The on-call engineer acknowledges the page within a couple of minutes. The outage is now theirs, and everyone knows it is being handled.')),
              focus: ['e-page', 'oncall'],
              say: { oncall: b('Дежурный подтверждает оповещение, и остальные видят, что сбой он берёт на себя.', 'The on-call engineer acknowledges the page, and the others see that the outage is theirs.') },
              tokens: [{ edge: 'e-page', label: b('оплата сломана', 'checkout broken') }],
              reveal: ['e-page', 'oncall'],
              metrics: m(),
            },
      );
    }
    const responder = noRota && !late ? 'backup' : 'oncall';
    steps.push({
      id: 's4',
      label: b('статус', 'status'),
      caption: at(b('Дежурный сразу пишет в канал первое сообщение о статусе, хотя причина ещё неизвестна. Владелец бизнеса читает этот канал и не отвлекает дежурного вопросами.', 'The on-call engineer posts the first status update to the channel at once, although the cause is still unknown. The business owner reads the channel instead of distracting the on-call engineer.')),
      focus: ['e-status', 'status'],
      say: { status: b('«Не проходят оплаты, ищем причину. Следующее сообщение будет через 30 минут».', '“Payments fail, we are looking for the cause. Next update in 30 minutes.”') },
      tokens: [{ edge: 'e-status', label: b('статус 1', 'status 1') }],
      reveal: ['e-status', 'status'],
      states: responder === 'backup' ? { 'e-status': 'on' } : {},
      metrics: m(),
    });
    // Diagnosis in two steps: first the log names the last deployment, then the on-call engineer decides what to do with it.
    t += n.locate;
    steps.push({
      id: 's5',
      label: b('диагностика', 'diagnose'),
      caption: at(fmtn(b('Дежурный начинает с вопроса, что менялось последним, открывает журнал выкладок и за {l} находит, что последней была выкладка #41 из {b}.{r}', 'The on-call engineer first asks what changed last, opens the deployment log and in {l} finds that the last one was deployment #41 with {b}.{r}'), { b: CH(batch), l: MIN(n.locate), r: p.runbook ? b('', '') : b(' Без инструкции для дежурного это заняло вдвое больше времени.', ' Without a runbook this took twice as long.') })),
      focus: ['e-diag', 'log'],
      say: { log: fmtn(b('Последней была выкладка #41 из {b}, и её подозревают первой.', 'The last one was deployment #41 with {b}, and it is suspected first.'), { b: CH(batch) }) },
      tokens: [{ edge: 'e-diag', label: b('что менялось?', 'what changed?') }, { edge: 'e-diag', reverse: true, label: fmtn(b('#41, {b}', '#41, {b}'), { b: nWord(batch, ['изменение', 'изменения', 'изменений'], ['change', 'changes']) }) }],
      reveal: ['e-diag', 'log'],
      states: { log: p.runbook ? 'on' : 'warn' },
      values: { log: `#41 · ${batch}` },
      metrics: m(),
    });
    if (!p.rollback) t += n.diagnose - n.locate;
    const which = batch === 1 ? b('где ошибка в единственном изменении выкладки', 'where the mistake in the only change is') : fmtn(b('какое из {b} виновато', 'which of the {b} is to blame'), { b: CH(batch) });
    steps.push({
      id: 's5-decide',
      label: b('решение', 'decide'),
      caption: at(
        p.rollback
          ? fmtn(b('Выяснять ночью, {w}, дежурный не станет, потому что быстрее вернуть на сайт прошлую версию целиком.', 'The on-call engineer will not work out at night {w}, because putting the whole previous version back is faster.'), { w: which })
          : fmtn(b('Откатить выкладку #41 нельзя, поэтому дежурному приходится ночью выяснять, {w}. Поиск занимает {d}{r}.', 'Deployment #41 cannot be rolled back, so the on-call engineer has to work out at night {w}. The search takes {d}{r}.'), { w: which, d: MIN(n.diagnose), r: p.runbook ? b('', '') : b(', вдвое дольше обычного, потому что инструкции для дежурного нет', ', twice as long as usual, because there is no runbook') }),
      ),
      focus: [noRota ? 'backup' : 'oncall'],
      say: { [noRota ? 'backup' : 'oncall']: p.rollback ? b('Дежурный решает откатить выкладку #41 целиком.', 'The on-call engineer decides to roll back deployment #41 as a whole.') : b('Дежурный перебирает изменения выкладки #41 одно за другим.', 'The on-call engineer goes through the changes of #41 one by one.') },
      states: { log: 'ok' },
      metrics: m(),
    });
    t += n.restore;
    steps.push(
      p.rollback
        ? {
            id: 's6',
            label: b('откат', 'rollback'),
            caption: at(fmtn(b('Дежурный смягчает сбой. Одной командой он возвращает на сайт прошлую версию #40, и за {r} доля ошибок падает до нуля. {w}', 'The on-call engineer mitigates the outage: one command puts version #40 back, and within {r} the error share falls to zero. {w}'), { r: MIN(n.restore), w: batch === 1 ? fmtn(b('Ошибку в единственном изменении выкладки #41 будут спокойно искать днём, и на это уйдёт {d}.', 'The mistake in the only change of #41 is looked for calmly in the daytime, in {d}.'), { d: MIN(n.diagnose) }) : fmtn(b('Какое из {b} сломало оплату, будут спокойно выяснять днём, и на это уйдёт {d}.', 'Which of the {b} broke the checkout is worked out calmly in the daytime, in {d}.'), { b: CH(batch), d: MIN(n.diagnose) }) })),
            focus: ['e-rollback', 'service'],
            say: { service: b('На сайте снова версия #40, и заказы проходят.', 'The site runs version #40 again, and orders go through.') },
            tokens: [{ edge: 'e-rollback', label: b('вернуть #40', 'restore #40') }],
            reveal: ['e-rollback'],
            states: { service: 'ok' },
            values: { service: pctIn(0) },
            metrics: m(true),
          }
        : {
            id: 's6',
            label: b('исправление', 'hotfix'),
            caption: at(fmtn(b('Откатиться нельзя, поэтому дежурный пишет срочное исправление и выкладывает его, на что уходит {r}. Это вторая, внеплановая выкладка, и у неё свой риск.', 'There is no rollback, so the on-call engineer writes an urgent fix and deploys it, which takes {r}. This is a second, unplanned deployment, with a risk of its own.'), { r: MIN(n.restore) })),
            focus: ['e-rollback', 'service'],
            say: { service: b('Срочное исправление #42 выложено, и заказы снова проходят.', 'The urgent fix #42 is deployed, and orders go through again.') },
            tokens: [{ edge: 'e-rollback', label: b('исправление #42', 'fix #42') }],
            reveal: ['e-rollback'],
            states: { service: 'ok', 'e-rollback': 'warn' },
            values: { service: pctIn(0) },
            metrics: m(true),
          },
    );
    steps.push({
      id: 's7',
      label: b('восстановлено', 'restored'),
      caption: at(b('Дежурный проверяет по тем же графикам, по которым заметили сбой, что заказы снова проходят, и пишет в канал итоговый статус.', 'The on-call engineer checks on the same graphs that showed the outage that orders go through again, and posts the final status to the channel.')),
      focus: ['status'],
      say: { status: fmtn(b('«Сервис восстановлен. Сбой длился {m}, разбор проведём завтра».', '“The service is restored. The outage lasted {m}; we will hold the review tomorrow.”'), { m: MIN(n.downtime) }) },
      states: { status: 'ok' },
      metrics: m(true),
    });
    steps.push({
      id: 's7-cost',
      label: b('цена сбоя', 'cost'),
      caption: at(fmtn(b('Сбой длился {m}, но не проходила только часть заказов, поэтому плохой работы набралось {bm}, то есть {pc} месячного бюджета ошибок. Магазин недополучил {x} выручки.', 'The outage lasted {m}, but only part of the orders failed, so the bad service adds up to {bm}, or {pc} of the monthly error budget. The shop lost {x} of revenue.'), { m: MIN(n.downtime), bm: nWord(n.bad, ['минуту', 'минуты', 'минут'], ['minute', 'minutes']), pc: pct(n.budgetPct), x: money(n.lost) })),
      focus: ['service'],
      states: { status: 'ok', service: 'ok' },
      metrics: m(true),
    });
    steps.push({
      id: 's8',
      label: b('хронология', 'timeline'),
      caption: b('На следующий день команда пишет разбор и собирает хронологию из журнала выкладок, графиков, канала статуса и обращений в поддержку. На разборе спрашивают, что было видно в каждый момент, а не кто ошибся.', 'The next day the team writes the review and assembles the timeline from the deployment log, the graphs, the status channel and the support tickets. The review asks what could be seen at each moment, not who made the mistake.'),
      focus: ['e-timeline', 'postmortem'],
      say: { postmortem: b('Команда раскладывает факты по времени.', 'The team lays out the facts by time.') },
      tokens: [{ edge: 'e-timeline', label: b('факты по времени', 'facts by time') }],
      reveal: ['e-timeline', 'postmortem'],
      metrics: m(true),
    });
    const factors = [
      late ? b('оповещение по доле неуспешных заказов', 'an alert on the share of failing orders') : null,
      noRota ? b('график дежурств', 'an on-call rota') : null,
      p.rollback ? null : b('откат одной командой', 'one-command rollback'),
      p.runbook ? null : b('инструкция для дежурного', 'a runbook'),
      batch > 3 ? b('выкладки поменьше', 'smaller deployments') : null,
      b('автотест на оформление заказа', 'an automated test of checkout'),
    ].filter((x): x is Bi => !!x);
    steps.push({
      id: 's9',
      label: b('задачи', 'actions'),
      caption: fmtn(b('Каждый способствующий фактор превращается в задачу с владельцем и сроком, и задачи встают на доску как обычные карточки: {l}.', 'Each contributing factor becomes a task with an owner and a due date, and the tasks go on the board as ordinary cards: {l}.'), { l: { ru: factors.map((f) => f.ru).join(', '), en: factors.map((f) => f.en).join(', ') } }),
      focus: ['e-actions', 'board'],
      say: { board: fmtn(b('Разбор добавил на доску {n}.', 'The review added {n} to the board.'), { n: nWord(factors.length, ['новую карточку', 'новые карточки', 'новых карточек'], ['new card', 'new cards']) }) },
      tokens: [{ edge: 'e-actions', label: nWord(factors.length, ['задача', 'задачи', 'задач'], ['task', 'tasks']) }],
      reveal: ['e-actions', 'board'],
      values: { board: `+${factors.length}` },
      states: { board: 'ok', postmortem: 'ok' },
      metrics: m(true),
    });
    return steps;
  },
  explainDelta(prev, next, change, a, c): Bi {
    const m0 = lastMetrics(prev);
    const m1 = lastMetrics(next);
    const v = { r0: m0.restore ?? 0, r1: MIN(m1.restore ?? 0), b1: pct(m1.budget ?? 0), d0: m0.detect ?? 0, d1: MIN(m1.detect ?? 0) };
    if (change.kind === 'break') {
      if (!change.on) return b('Поломка убрана, и реагирование снова идёт как обычно.', 'The break is removed, and the response runs as usual again.');
      return change.id === 'no-rota'
        ? fmtn(b('Без назначенного дежурного оповещение 15 минут ждёт, пока его кто-нибудь возьмёт, и сбой длится {r1} вместо {r0}.', 'Without an assigned on-call engineer the page waits 15 minutes for someone to take it, and the outage lasts {r1} instead of {r0}.'), v)
        : fmtn(b('Оповещение по процессору не видит сбой оплаты. О сбое узнали через {d1} вместо {d0}, весь сбой длился {r1} вместо {r0} и потратил {b1} месячного бюджета ошибок.', 'A CPU alert cannot see a checkout failure. The outage was noticed after {d1} instead of {d0}, it lasted {r1} instead of {r0} and ate {b1} of the monthly error budget.'), v);
    }
    switch (change.id) {
      case 'detection':
        return fmtn(b('О сбое узнали через {d1} вместо {d0}, весь сбой длился {r1} вместо {r0} и потратил {b1} месячного бюджета ошибок. Проверка, что сервер отвечает, не видит сбоя оплаты, потому что сервер отвечает, а заказы при этом не проходят.', 'The outage was noticed after {d1} instead of {d0}, it lasted {r1} instead of {r0} and ate {b1} of the monthly error budget. A check that the server answers cannot see a checkout failure, because the server answers while orders fail.'), v);
      case 'rollback':
        return c.rollback
          ? fmtn(b('С откатом дежурный не ищет виноватое изменение ночью, а возвращает прошлую версию за 10 минут, и сбой длится {r1} вместо {r0}.', 'With rollback the on-call engineer does not look for the faulty change at night but puts the previous version back in 10 minutes, and the outage lasts {r1} instead of {r0}.'), v)
          : fmtn(b('Без отката дежурному приходится ночью искать виноватое изменение и чинить сайт срочным исправлением, поэтому сбой длится {r1} вместо {r0}, и появляется вторая, внеплановая выкладка.', 'Without rollback the on-call engineer has to look for the faulty change at night and mend the site with an urgent fix, so the outage lasts {r1} instead of {r0}, and a second, unplanned deployment appears.'), v);
      case 'runbook':
        return c.runbook
          ? fmtn(b('С инструкцией дежурный проходит диагностику вдвое быстрее, и сбой длится {r1} вместо {r0}.', 'With a runbook the on-call engineer gets through diagnosis twice as fast, and the outage lasts {r1} instead of {r0}.'), v)
          : fmtn(b('Без инструкции диагностика идёт вдвое дольше, и сбой длится {r1} вместо {r0}.', 'Without a runbook diagnosis takes twice as long, and the outage lasts {r1} instead of {r0}.'), v);
      case 'batch':
        return c.rollback
          ? fmtn(b('Теперь в выкладку вошло {y} вместо {x}. Выкладку откатывают целиком, поэтому сбой длится {r1}, как и раньше, но днём искать виноватое изменение придётся {k1} вместо {k0}. Без отката размер выкладки удлинил бы и сам сбой.', 'The deployment now has {y} instead of {x}. The deployment is rolled back as a whole, so the outage lasts {r1} as before, but in the daytime finding the faulty change takes {k1} instead of {k0}. Without a rollback the size of the deployment would make the outage itself longer.'), { x: a.batch as string, y: nWord(Number(c.batch), ['изменение', 'изменения', 'изменений'], ['change', 'changes']), k0: m0.cause ?? 0, k1: MIN(m1.cause ?? 0), ...v })
          : fmtn(b('Теперь в выкладку вошло {y} вместо {x}. Откатить её нельзя, а чем больше изменений, тем дольше искать виноватое, и сбой длится {r1} вместо {r0}.', 'The deployment now has {y} instead of {x}. It cannot be rolled back, and the more changes, the longer it takes to find the faulty one, so the outage lasts {r1} instead of {r0}.'), { x: a.batch as string, y: nWord(Number(c.batch), ['изменение', 'изменения', 'изменений'], ['change', 'changes']), ...v });
      default:
        return fmtn(b('Теперь не проходит {y} заказов вместо {x}, и сбой тратит {b1} месячного бюджета ошибок.', 'Now {y} of orders fail instead of {x}, and the outage eats {b1} of the monthly error budget.'), { x: pct(a.failing as number), y: pct(c.failing as number), ...v });
    }
  },
});
