// Standalone event pilot: deliberately not registered in a course module.
import { defineModel } from '../../core/define';
import { bi } from '../../core/i18n';
import type { ElementState, Step } from '../../core/types';

export type FunnelParams = {
  scans: number; target_share: number; next_share: number; followup_share: number;
  meeting_share: number; opp_share: number; win_rate: number; cost: number; profit_per_win: number;
};

// Shares are percentage knobs; never round intermediate expected counts.
export function funnelNumbers(p: FunnelParams, late = false) {
  const target = p.scans * p.target_share / 100;
  const next = target * p.next_share / 100;
  const followup = next * p.followup_share / 100;
  const meetings = followup * p.meeting_share / 100 / (late ? 3 : 1);
  const opps = meetings * p.opp_share / 100;
  const wins = opps * p.win_rate / 100;
  return { scans: p.scans, target, next, followup, meetings, opps, wins,
    break_even: p.cost / (p.profit_per_win * p.win_rate / 100) };
}
const display = (n: number) => `≈${n.toFixed(1)}`;
const people = (n: number) => `${Number.isInteger(n) ? '' : '≈'}${Math.round(n)}`;

export const funnelCaption = bi("Число сканов в отчёте о событии говорит о первом блоке воронки. В калькуляторе ниже та же воронка считается с разбросом, и видно, в скольких прогонах из ста стенд окупается.", "The scan count in an event report describes the first funnel block. In the calculator below, the same funnel is calculated with variation, showing how many runs out of a hundred make the booth break even.");

const stages = [
  { id: "scans", label: bi("Сканы и регистрации", "Scans and registrations"),
    caption: bi("Стенд отсканировал 300 бейджей; это число сканов, и людей из целевых компаний среди них меньше.", "The booth scanned 300 badges; this is the scan count, and fewer of these people are from target companies."),
    card: {
      what: bi("Это все бейджи, которые отсканировали на стенде, и регистрации на ваше событие.", "These are all badges scanned at the booth and registrations for your event."),
      who: bi("Сканы делают сотрудники на стенде, регистрации собирает организатор или ваша форма.", "Booth staff scan badges; the organizer or your form collects registrations."),
      look: bi("Отчёт о сканах присылает организатор после события; KubeCon передаёт контакты только тех, кого отсканировали на вашем стенде.", "The organizer sends the scan report after the event; KubeCon shares contact details only for people scanned at your booth."),
    },
  },
  { id: "target", label: bi("Люди из портрета покупателя", "People matching the buyer profile"),
    caption: bi("Из трёхсот сканов к портрету покупателя относятся около сорока пяти человек; остальные — студенты, пользователи открытой версии, конкуренты и партнёры.", "About forty-five of the three hundred scans match the buyer profile; the rest are students, open-source users, competitors and partners."),
    card: {
      what: bi("Это люди из компаний и ролей вашего портрета покупателя среди всех отсканированных.", "These are people from companies and roles matching your buyer profile among everyone scanned."),
      who: bi("Отбирает их маркетолог по названию компании и должности.", "A marketer selects them by company name and job title."),
      look: bi("Посмотреть их можно, отфильтровав отчёт о сканах по списку целевых компаний.", "You can find them by filtering the scan report against your list of target companies."),
    },
  },
  { id: "next", label: bi("Договорились о следующем шаге", "Agreed on a next step"),
    caption: bi("С частью целевых людей на стенде договорились о следующем шаге: прислать материал, показать демонстрацию у них, познакомить с инженером.", "At the booth, a next step was agreed with some target contacts: send material, give a demo at their company, or introduce an engineer."),
    card: {
      what: bi("Это люди, с которыми у стенда договорились о конкретном следующем шаге: прислать материал, показать демонстрацию у них, познакомить с инженером.", "These are people with whom you agreed on a specific next step at the booth: send material, give a demo at their company, or introduce an engineer."),
      who: bi("Договаривается человек на стенде и сразу записывает договорённость.", "The person at the booth agrees on the next step and records it immediately."),
      look: bi("Посмотреть можно в заметках к сканам.", "You can find this in the scan notes."),
    },
  },
  { id: "followup", label: bi("Написали в течение двух дней", "Contacted within two days"),
    caption: bi("Команда пишет этим людям в течение двух рабочих дней; каждый день задержки снижает долю ответов.", "The team writes to these people within two business days; every day of delay reduces the response rate."),
    card: {
      what: bi("Это люди, которым написали в первые два рабочих дня после события, как обещали.", "These are people you wrote to within the first two business days after the event, as promised."),
      who: bi("Пишет ответственный за каждый контакт.", "The owner of each contact writes to them."),
      look: bi("Посмотреть можно в CRM по дате первого письма.", "You can check this in the CRM by the date of the first email."),
    },
  },
  { id: "meetings", label: bi("Встречи состоялись", "Meetings held"),
    caption: bi("Часть людей соглашается на встречу, и встреча проходит.", "Some people agree to a meeting, and the meeting takes place."),
    card: {
      what: bi("Это встречи, которые состоялись после события.", "These are meetings that took place after the event."),
      who: bi("Назначает и проводит их продавец или основатель.", "A salesperson or founder schedules and holds them."),
      look: bi("Посмотреть можно в календаре и в CRM.", "You can find them in the calendar and the CRM."),
    },
  },
  { id: "opps", label: bi("Возможности сделок", "Opportunities"),
    caption: bi("После встречи продажи принимают часть разговоров как возможности сделок; это происходит через один-три месяца после события.", "After the meeting, sales accepts some conversations as opportunities; this happens one to three months after the event."),
    card: {
      what: bi("Это разговоры, которые продажи приняли как возможность сделки; обычно это происходит через один-три месяца после события.", "These are conversations that sales accepted as opportunities; this usually happens one to three months after the event."),
      who: bi("Решение принимает отдел продаж по своим критериям.", "The sales department makes the decision using its own criteria."),
      look: bi("Посмотреть можно в CRM по источнику «событие».", "You can find them in the CRM under the “event” source."),
    },
  },
  { id: "wins", label: bi("Сделки", "Deals"),
    caption: bi("Из возможностей закрывается доля, обычная для вашей компании, и только теперь можно сравнить выручку с полной стоимостью события.", "A share of opportunities closes at your company’s usual rate, and only now can revenue be compared with the full cost of the event."),
    card: {
      what: bi("Это закрытые сделки, которые начались на событии.", "These are closed deals that originated at the event."),
      who: bi("Закрывают их продажи.", "Sales closes them."),
      look: bi("Посмотреть можно в CRM, и только после этого стоит сравнивать выручку с полной стоимостью события.", "You can find them in the CRM, and only then should you compare revenue with the full cost of the event."),
    },
  },
] as const;

export const funnelModel = defineModel<FunnelParams>({
  id: 'events.funnel', block: 'events',
  title: bi("Воронка события: от скана бейджа до сделки", "The event funnel: from badge scan to deal"),
  summary: bi("Схема показывает, как люди проходят путь от скана бейджа или регистрации на событие до сделки и где теряется большая часть. Числа под блоками пересчитываются, когда вы двигаете ручки. Подсвеченный блок — текущий шаг воронки.", "The diagram shows how people move from a badge scan or event registration to a deal and where most drop out. Numbers under the blocks recalculate when you move the knobs. The highlighted block is the current funnel step."),
  intro: bi("Нажимайте «Шаг вперёд», затем в «Параметрах» меняйте долю целевых людей среди сканов, скорость последующей работы и долю встреч. Следите за числом возможностей сделок внизу и сравнивайте его с числом, нужным для окупаемости.", "Press “Step forward”, then use “Parameters” to change the share of target contacts among scans, the speed of follow-up and the meeting share. Watch the opportunity count at the bottom and compare it with the number needed to break even."),
  frame: 'fixed',
  diagram: {
    width: 760, height: 512,
    narrow: { width: 304, height: 856, nodes: stages.map((s, i) => ({
      id: s.id, label: s.label, card: s.card, family: 'flow', shape: 'box',
      x: 8, y: 8 + i * 128, w: 288, h: 64,
    })), edgeVia: Object.fromEntries(stages.slice(1).map((s, i) => [
      `to-${s.id}`, [[32, 72 + i * 128], [32, 136 + i * 128]],
    ])) },
    nodes: stages.map((s, i) => ({ id: s.id, label: s.label, card: s.card,
      family: 'flow', shape: 'box', x: [24, 432, 432, 24, 24, 432, 432][i],
      y: [16, 16, 144, 144, 272, 272, 400][i], w: 304, h: 64 })),
    edges: stages.slice(1).map((s, i) => ({ id: `to-${s.id}`, from: stages[i].id, to: s.id,
      label: [bi("отбор по портрету", "buyer profile screening"), bi("разговор у стенда", "conversation at the booth"), bi("письмо после события", "email after the event"), bi("согласие на встречу", "agreement to meet"), bi("решение продаж", "sales decision"), bi("закрытие сделки", "closing the deal")][i], card: s.card })),
  },
  params: [
    { id: "scans", label: bi("Сколько бейджей отсканировали и сколько людей зарегистрировалось", "How many badges were scanned and how many people registered"), group: bi("Воронка", "Funnel"), kind: 'range', min: 100, max: 600, default: 300, step: 10, unit: "" },
    { id: "target_share", label: bi("Доля людей из портрета покупателя", "Share of people matching the buyer profile"), group: bi("Воронка", "Funnel"), kind: 'range', min: 5, max: 30, default: 15, step: 1, unit: "%" },
    { id: "next_share", label: bi("Доля целевых людей, с кем договорились о следующем шаге", "Share of target people with whom a next step was agreed"), group: bi("Воронка", "Funnel"), kind: 'range', min: 20, max: 80, default: 60, step: 1, unit: "%" },
    { id: "followup_share", label: bi("Доля тех, кому написали в первые два рабочих дня", "Share of people contacted within the first two business days"), group: bi("Воронка", "Funnel"), kind: 'range', min: 20, max: 100, default: 80, step: 1, unit: "%" },
    { id: "meeting_share", label: bi("Доля тех, с кем встреча состоялась", "Share of people with whom a meeting took place"), group: bi("Воронка", "Funnel"), kind: 'range', min: 10, max: 50, default: 30, step: 1, unit: "%" },
    { id: "opp_share", label: bi("Доля встреч, которые продажи приняли как возможность сделки", "Share of meetings that sales accepted as opportunities"), group: bi("Воронка", "Funnel"), kind: 'range', min: 10, max: 50, default: 30, step: 1, unit: "%" },
    { id: "win_rate", label: bi("Доля возможностей, которые ваша компания обычно закрывает", "Share of opportunities your company usually closes"), group: bi("Воронка", "Funnel"), kind: 'range', min: 10, max: 40, default: 25, step: 1, unit: "%" },
    { id: "cost", label: bi("Полная стоимость участия в событии", "Full cost of participating in the event"), group: bi("Деньги", "Money"), kind: 'range', min: 10000, max: 100000, default: 30000, step: 1000, unit: "USD" },
    { id: "profit_per_win", label: bi("Валовая прибыль с одной сделки", "Gross profit per deal"), group: bi("Деньги", "Money"), kind: 'range', min: 10000, max: 200000, default: 50000, step: 1000, unit: "USD" },
  ],
  breaks: [{
    id: 'late_followup', label: bi('Команда пишет через две недели', 'The team writes two weeks later'), remove: [],
    predict: {
      prompt: bi('Как изменится число встреч при тех же параметрах, если команда напишет через две недели?', 'With the same parameters, how will the meeting count change if the team writes two weeks later?'),
      options: [
        { id: 'lower', text: bi('Снизится втрое', 'It will fall to one third') },
        { id: 'same', text: bi('Не изменится', 'It will stay the same') },
      ],
      // Opportunities fall in the same proportion as meetings; compare raw counts, not display strings.
      resolve: (prev, next) => next.at(-1)!.metrics!.opps < prev.at(-1)!.metrics!.opps ? 'lower' : 'same',
    },
  }],
  metrics: [
    { id: 'opps', label: bi('Возможности сделок (в среднем)', 'Opportunities (on average)') },
    { id: 'break_even', label: bi('Возможности сделок для окупаемости', 'Break-even opportunities') },
  ],
  run(p, broken): Step[] {
    const late = broken.has('late_followup');
    const numbers = funnelNumbers(p, late);
    const values = Object.fromEntries(stages.map(s => [s.id, ['opps', 'wins'].includes(s.id) ? display(numbers[s.id]) : people(numbers[s.id])]));
    return stages.map((s, i) => ({
      id: s.id, label: s.label, caption: s.caption,
      focus: [s.id, ...(i ? [`to-${s.id}`] : [])],
      states: i === 0
        ? Object.fromEntries([...stages.map(n => [n.id, n.id === 'scans' ? 'on' : 'off']),
          ...stages.slice(1).map(n => [`to-${n.id}`, 'off'])]) as Record<string, ElementState>
        : { [s.id]: late && i >= 3 ? 'warn' : 'on', [`to-${s.id}`]: 'on' },
      values,
      metrics: { opps: numbers.opps, break_even: numbers.break_even },
      metricText: { opps: bi(display(numbers.opps).replace('.', ','), display(numbers.opps)),
        break_even: bi(display(numbers.break_even).replace('.', ','), display(numbers.break_even)) },
      // A delay reduces conversion; it does not halt the remaining funnel.
      ...(late && i >= 3 ? { broken: {
        at: 'followup', message: '× 1/3',
        caption: bi('Доля ответов падает втрое, и число встреч проседает.', 'The response rate falls to one third, and the meeting count drops.'),
      } } : {}),
    }));
  },
  explainDelta(prev, next) {
    return bi(
      `После изменения параметров или срока письма число возможностей сделок изменилось с ${display(prev.at(-1)!.metrics!.opps)} до ${display(next.at(-1)!.metrics!.opps)}, а порог окупаемости — с ${display(prev.at(-1)!.metrics!.break_even)} до ${display(next.at(-1)!.metrics!.break_even)}.`,
      `Changing the parameters or follow-up timing changed opportunities from ${display(prev.at(-1)!.metrics!.opps)} to ${display(next.at(-1)!.metrics!.opps)} and the break-even threshold from ${display(prev.at(-1)!.metrics!.break_even)} to ${display(next.at(-1)!.metrics!.break_even)}.`,
    );
  },
});
