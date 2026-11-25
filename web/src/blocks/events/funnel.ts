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
const display = (n: number) => String(Number(n.toFixed(4)));

export const funnelCaption = bi("Число сканов в отчёте о событии говорит о первом блоке воронки. В калькуляторе ниже та же воронка считается с разбросом, и видно, в скольких прогонах из ста стенд окупается.", "The scan count in an event report describes the first funnel block. In the calculator below, the same funnel is calculated with variation, showing how many runs out of a hundred make the booth break even.");

const stages = [
  { id: "scans", label: bi("Сканы и регистрации", "Scans and registrations"),
    caption: bi("Стенд отсканировал 300 бейджей; это число сканов, и людей из целевых компаний среди них меньше.", "The booth scanned 300 badges; this is the scan count, and fewer of these people are from target companies."),
    card: {
      what: bi("Это все контакты события. Смотрите выгрузку сканов и регистраций.", "All event contacts. Inspect the scan and registration export."), // TODO(prose-card)
      who: bi("Маркетинг собирает контакты.", "Marketing collects contacts."), // TODO(prose-card)
    },
  },
  { id: "target", label: bi("Люди из портрета покупателя", "People matching the buyer profile"),
    caption: bi("Из трёхсот сканов к портрету покупателя относятся около сорока пяти человек; остальные — студенты, пользователи открытой версии, конкуренты и партнёры.", "About forty-five of the three hundred scans match the buyer profile; the rest are students, open-source users, competitors and partners."),
    card: {
      what: bi("Это контакты, соответствующие портрету покупателя. Проверьте компании и роли в списке.", "Contacts matching the buyer profile. Check companies and roles in the list."), // TODO(prose-card)
      who: bi("Маркетинг проверяет соответствие портрету.", "Marketing checks the profile match."), // TODO(prose-card)
    },
  },
  { id: "next", label: bi("Договорились о следующем шаге", "Agreed on a next step"),
    caption: bi("С частью целевых людей на стенде договорились о следующем шаге: прислать материал, показать демонстрацию у них, познакомить с инженером.", "At the booth, a next step was agreed with some target contacts: send material, give a demo at their company, or introduce an engineer."),
    card: {
      what: bi("Это контакты с согласованным продолжением разговора. Проверьте записанный следующий шаг.", "Contacts with an agreed continuation. Check the recorded next step."), // TODO(prose-card)
      who: bi("Команда стенда записывает договорённости.", "The booth team records agreements."), // TODO(prose-card)
    },
  },
  { id: "followup", label: bi("Написали в течение двух дней", "Contacted within two days"),
    caption: bi("Команда пишет этим людям в течение двух рабочих дней; каждый день задержки снижает долю ответов.", "The team writes to these people within two business days; every day of delay reduces the response rate."),
    card: {
      what: bi("Это контакты, которым команда написала вовремя. Сравните дату письма с датой события.", "Contacts the team wrote to on time. Compare the email date with the event date."), // TODO(prose-card)
      who: bi("Ответственный за контакт отправляет письмо.", "The contact owner sends the email."), // TODO(prose-card)
    },
  },
  { id: "meetings", label: bi("Встречи состоялись", "Meetings held"),
    caption: bi("Часть людей соглашается на встречу, и встреча проходит.", "Some people agree to a meeting, and the meeting takes place."),
    card: {
      what: bi("Это проведённые встречи. Смотрите итоги встреч в CRM.", "Meetings that took place. Inspect meeting outcomes in the CRM."), // TODO(prose-card)
      who: bi("Продажи проводят встречу.", "Sales holds the meeting."), // TODO(prose-card)
    },
  },
  { id: "opps", label: bi("Возможности сделок", "Opportunities"),
    caption: bi("После встречи продажи принимают часть разговоров как возможности сделок; это происходит через один-три месяца после события.", "After the meeting, sales accepts some conversations as opportunities; this happens one to three months after the event."),
    card: {
      what: bi("Это разговоры, принятые продажами в работу. Смотрите возможности в CRM.", "Conversations accepted by sales. Inspect opportunities in the CRM."), // TODO(prose-card)
      who: bi("Продажи квалифицируют возможность.", "Sales qualifies the opportunity."), // TODO(prose-card)
    },
  },
  { id: "wins", label: bi("Сделки", "Deals"),
    caption: bi("Из возможностей закрывается доля, обычная для вашей компании, и только теперь можно сравнить выручку с полной стоимостью события.", "A share of opportunities closes at your company’s usual rate, and only now can revenue be compared with the full cost of the event."),
    card: {
      what: bi("Это выигранные сделки. Смотрите закрытые сделки в CRM.", "Won deals. Inspect closed deals in the CRM."), // TODO(prose-card)
      who: bi("Продажи закрывают сделку.", "Sales closes the deal."), // TODO(prose-card)
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
    nodes: stages.map((s, i) => ({ id: s.id, label: s.label, card: s.card,
      family: 'flow', shape: 'box', x: [24, 432, 432, 24, 24, 432, 432][i],
      y: [16, 16, 144, 144, 272, 272, 400][i], w: 304, h: 64 })),
    edges: stages.slice(1).map((s, i) => ({ id: `to-${s.id}`, from: stages[i].id, to: s.id,
      label: bi('часть контактов', 'a share of contacts'), card: s.card })),
  },
  params: [
    { id: "scans", label: bi("scans", "scans"), kind: 'range', min: 100, max: 600, default: 300, step: 10, unit: "" },
    { id: "target_share", label: bi("target_share", "target_share"), kind: 'range', min: 5, max: 30, default: 15, step: 1, unit: "%" },
    { id: "next_share", label: bi("next_share", "next_share"), kind: 'range', min: 20, max: 80, default: 60, step: 1, unit: "%" },
    { id: "followup_share", label: bi("followup_share", "followup_share"), kind: 'range', min: 20, max: 100, default: 80, step: 1, unit: "%" },
    { id: "meeting_share", label: bi("meeting_share", "meeting_share"), kind: 'range', min: 10, max: 50, default: 30, step: 1, unit: "%" },
    { id: "opp_share", label: bi("opp_share", "opp_share"), kind: 'range', min: 10, max: 50, default: 30, step: 1, unit: "%" },
    { id: "win_rate", label: bi("win_rate", "win_rate"), kind: 'range', min: 10, max: 40, default: 25, step: 1, unit: "%" },
    { id: "cost", label: bi("cost", "cost"), kind: 'range', min: 10000, max: 100000, default: 30000, step: 1000, unit: "USD" },
    { id: "profit_per_win", label: bi("profit_per_win", "profit_per_win"), kind: 'range', min: 10000, max: 200000, default: 50000, step: 1000, unit: "USD" },
  ],
  breaks: [{
    id: 'late_followup', label: bi('Команда пишет через две недели', 'The team writes two weeks later'), remove: [],
    predict: {
      prompt: bi('Как изменится число встреч при тех же параметрах, если команда напишет через две недели?', 'With the same parameters, how will the meeting count change if the team writes two weeks later?'),
      options: [
        { id: 'lower', text: bi('Снизится втрое', 'It will fall to one third') },
        { id: 'same', text: bi('Не изменится', 'It will stay the same') },
      ],
      resolve: (prev, next) => Number(next.at(-1)!.values!.meetings) < Number(prev.at(-1)!.values!.meetings) ? 'lower' : 'same',
    },
  }],
  metrics: [
    { id: 'opps', label: bi('Возможности сделок', 'Opportunities') },
    { id: 'break_even', label: bi('Возможности сделок для окупаемости', 'Break-even opportunities') },
  ],
  run(p, broken): Step[] {
    const late = broken.has('late_followup');
    const numbers = funnelNumbers(p, late);
    const values = Object.fromEntries(stages.map(s => [s.id, display(numbers[s.id])]));
    return stages.map((s, i) => ({
      id: s.id, label: s.label, caption: s.caption,
      focus: [s.id, ...(i ? [`to-${s.id}`] : [])],
      states: i === 0
        ? Object.fromEntries([...stages.map(n => [n.id, n.id === 'scans' ? 'on' : 'off']),
          ...stages.slice(1).map(n => [`to-${n.id}`, 'off'])]) as Record<string, ElementState>
        : { [s.id]: late && i >= 3 ? 'warn' : 'on', [`to-${s.id}`]: 'on' },
      values,
      metrics: { opps: numbers.opps, break_even: numbers.break_even },
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
