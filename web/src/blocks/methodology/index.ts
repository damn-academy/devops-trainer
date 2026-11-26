// The methodology block (route id `methodology`, checklist step 01; design
// 07-methodology-kanban.md). Fifteen lessons from "why a business needs
// DevOps" to the Black Friday practicum, five process explainers, the flowlab
// board (engine/flowlab) in three scenarios, a quiz bank, placement checks
// with short flowlab runs in the terminal, and a block exam.
//
// The Orientation segment (`orient`) also belongs to this folder; it is not
// delivered yet and stays a placeholder on the route map.

import { defineModule } from '../../core/define';
import { bi } from '../../core/i18n';
import { ROUTE } from '../../core/route';
import type { Block, Exam, PlacementTask, QuizItem, TerminalSetup } from '../../core/types';
import { fromModel } from '../../engine/explainer/render';
import { concepts } from './concepts';
import { docs } from './docs';
import { bottleneckModel } from './explainers/bottleneck';
import { budgetModel } from './explainers/budget';
import { incidentModel } from './explainers/incident';
import { pipelineModel } from './explainers/pipeline';
import { valueStreamModel } from './explainers/value-stream';
import { business, valueStream, board, flow, little } from './lessons-1';
import { bottleneck, batch, agile, workTypes, pipeline } from './lessons-2';
import { dora, sre, incident, culture, blackFriday } from './lessons-3';
import { examItems, quiz } from './quiz';
import { R, S } from './sources';

const lessons = [business, valueStream, board, flow, little, bottleneck, batch, agile, workTypes, pipeline, dora, sre, incident, culture, blackFriday];
const entry = ROUTE.find((e) => e.id === 'methodology')!;
const bank = new Map(quiz.map((q) => [q.id, q]));

/** A bank item reused in a placement check or the exam under its own id. */
const copy = (id: string, suffix: string): QuizItem => ({ ...(bank.get(id) as QuizItem), id: `${id}.${suffix}` });

const P5: TerminalSetup = { ext: { flow: { scenario: 'p5' } } };
const P10: TerminalSetup = { ext: { flow: { scenario: 'p10' } } };
const S2: TerminalSetup = { ext: { flow: { scenario: 's2' } } };

const flowIntro = bi('Доска работает в терминале, и управляют ею командой `flow`. Команда `flow help` перечислит все команды доски, а страница `man flow` подробно их объяснит. Отвечает команда по-английски, как большинство настоящих программ для терминала.', 'The board runs in the terminal as the `flow` command: `flow help` lists the commands, `man flow` explains them in detail.');
/** How to find the slow stage on a fresh board: without limits the autopilot pulls everything into the first column, which hides the real bottleneck. */
const findSlow = bi(
  'В первый день очередей ещё нет, а автопилот, который каждое утро сам вытягивает карточки, без лимитов затягивает их все в первую колонку, и кажется, что узкое место находится в ней. Поэтому сначала поставьте колонкам лимиты, прогоните два-три дня и посмотрите командой `flow status`, в какой колонке копятся карточки с галочкой ✓. Галочкой помечены карточки, которые этап уже закончил. Если такие карточки копятся, значит, следующий за колонкой этап не успевает их забирать. Этот этап и есть узкое место. Команда `flow reset` в любой момент вернёт доску к первому дню.',
  'On day 1 there are no queues yet, and without limits the autopilot, which pulls cards every morning by itself, pulls them all into the first column, so the bottleneck seems to be there. So set column limits first, run two or three days and see with `flow status` in which column the cards marked ✓ pile up. A tick marks a card its stage has finished; if such cards pile up, the next stage cannot take them fast enough, and that stage is the bottleneck. `flow reset` takes the board back to day 1 at any moment.',
);

const placement: PlacementTask[] = [
  // Intermediate (07 §2.3): count, read, decide, sort, order, and two runs on the board.
  { id: 'method.place.little', level: 'intermediate', key: true, concepts: ['method.little'], kind: 'quiz', item: copy('method.q.little-calc', 'place') },
  { id: 'method.place.cfd', level: 'intermediate', key: false, concepts: ['method.cfd'], kind: 'quiz', item: copy('method.q.cfd-band', 'place') },
  { id: 'method.place.tester', level: 'intermediate', key: true, concepts: ['method.five-steps', 'method.swarming'], kind: 'quiz', item: copy('method.q.tester-dilemma', 'place') },
  { id: 'method.place.types', level: 'intermediate', key: false, concepts: ['method.work-types'], kind: 'quiz', item: copy('method.q.work-sort', 'place') },
  { id: 'method.place.pipeline', level: 'intermediate', key: false, concepts: ['method.pipeline', 'method.ci'], kind: 'quiz', item: copy('method.q.pipeline-order', 'place') },
  { id: 'method.place.nines', level: 'intermediate', key: true, concepts: ['method.error-budget'], kind: 'quiz', item: copy('method.q.nines', 'place') },
  {
    id: 'method.place.wip5',
    level: 'intermediate',
    key: true,
    concepts: ['method.wip', 'method.switching'],
    kind: 'task',
    setup: P5,
    task: {
      id: 'wip5',
      prompt: bi(
        'Перед вами пять дней работы доски, на которой мощность не меняется: четыре человека, четырнадцать одинаковых задач, а карточки вытягивает автопилот. Поставьте лимиты WIP так, чтобы к концу пятого дня готовыми были не меньше 6 карточек, и прогоните все пять дней. ' + flowIntro.ru,
        'Five days of a board with fixed capacity: four people, fourteen equal tasks, the autopilot pulls the cards. Set the WIP limits so that at least 6 cards are done by the end of day 5, and run the five days. ' + flowIntro.en,
      ),
      check: { when: 'flow.daysDone>=5 && flow.done.count>=6' },
      concepts: ['method.wip'],
    },
  },
  {
    id: 'method.place.bottleneck10',
    level: 'intermediate',
    key: true,
    concepts: ['method.bottleneck', 'method.swarming'],
    kind: 'task',
    setup: P10,
    task: {
      id: 'bottleneck10',
      prompt: bi(
        'Перед вами доска на 10 дней, и один этап на ней медленнее остальных. Найдите этот этап и распределите людей и лимиты так, чтобы за 10 дней закончить не меньше задач, чем требует проходная линия для этого прогона (её показывает команда `flow goal`). ' + findSlow.ru + ' ' + flowIntro.ru,
        'A 10-day board with one stage slower than the others. Find it and arrange people and limits so that in 10 days you finish at least as many tasks as the pass line on this run (`flow goal`). ' + findSlow.en + ' ' + flowIntro.en,
      ),
      check: { when: 'flow.daysDone>=10 && flow.pass.done=1' },
      concepts: ['method.bottleneck'],
    },
  },
  // Experienced (07 §2.4): precise distinctions, numbers, blameless wording, a run.
  { id: 'method.place.cicd', level: 'experienced', key: true, concepts: ['method.ci', 'method.cdelivery', 'method.cdeployment'], kind: 'quiz', item: copy('method.q.ci-cd-match', 'place') },
  { id: 'method.place.dora', level: 'experienced', key: false, concepts: ['method.dora'], kind: 'quiz', item: copy('method.q.dora-less-often', 'place') },
  { id: 'method.place.cfr', level: 'experienced', key: false, concepts: ['method.dora'], kind: 'quiz', item: copy('method.q.cfr-calc', 'place') },
  { id: 'method.place.burn', level: 'experienced', key: false, concepts: ['method.burn-rate'], kind: 'quiz', item: copy('method.q.burn', 'place') },
  { id: 'method.place.freeze', level: 'experienced', key: true, concepts: ['method.error-budget'], kind: 'quiz', item: copy('method.q.freeze', 'place') },
  { id: 'method.place.blameless', level: 'experienced', key: true, concepts: ['method.postmortem'], kind: 'quiz', item: copy('method.q.blameless-rewrite', 'place') },
  {
    id: 'method.place.exp10',
    level: 'experienced',
    key: true,
    concepts: ['method.bottleneck', 'method.wip'],
    kind: 'task',
    setup: P10,
    task: {
      id: 'exp10',
      prompt: bi(
        'Перед вами доска на 10 дней, и один этап на ней медленнее остальных. Добейтесь, чтобы за 10 дней было закончено не меньше задач, чем требует проходная линия (её показывает команда `flow goal`). ' + findSlow.ru + ' ' + flowIntro.ru,
        'A 10-day board with one stage slower than the others. Make sure that in 10 days at least as many tasks are finished as the pass line (`flow goal`). ' + findSlow.en + ' ' + flowIntro.en,
      ),
      check: { when: 'flow.daysDone>=10 && flow.pass.done=1' },
      concepts: ['method.bottleneck'],
    },
  },
];

const exam: Exam = {
  id: 'methodology.exam',
  block: 'methodology',
  title: bi('Чёрная пятница', 'Black Friday'),
  intro: bi(
    'Экзамен состоит из двадцати дней «Чёрной пятницы» в терминале, одной настройки доски, которой в курсе нет, и восьми вопросов с новыми числами и ситуациями. Пользоваться можно только документацией: страницей `man flow`, Scrum Guide, Kanban Guide и заметками к политике бюджета ошибок. Чтобы сдать экзамен, нужно набрать 70 % и обязательно выполнить часть с доской. В конце вас ждут пять вопросов, какие задают на собеседовании на должность DevOps-инженера: ответьте на них своими словами и сверьте ответ с главными мыслями, которые покажет экзамен.',
    'Twenty days of “Black Friday” in the terminal, one board setting the course does not show, and eight questions with new numbers and situations. Only the documentation is open: `man flow`, the Scrum Guide, the Kanban Guide and the notes on the error budget policy. Pass: 70% and the mandatory board part. At the end there are five questions of the kind asked at a DevOps engineer interview: answer them in your own words and compare your answer with the key points the exam shows.',
  ),
  minutes: 60,
  pass: 0.7,
  allowedDocs: ['man', 'help', 'scrum-guide', 'kanban-guide', 'sre-book'],
  tasks: [
    {
      id: 'bf',
      weight: 40,
      critical: true,
      kind: 'task',
      setup: S2,
      task: {
        id: 'bf-run',
        prompt: bi(
          'Проведите магазин через все 20 дней. К концу прогона готовых задач должно быть не меньше, чем требует проходная линия, а 85-й процентиль времени цикла не должен быть выше её порога. Оба числа проходной линии показывает команда `flow goal`, а ваши текущие числа показывает `flow metrics`. ' + flowIntro.ru,
          'Run all 20 days. By the end of the run you need at least as many finished tasks as the pass line, and an 85th percentile of cycle time no higher than its threshold. `flow goal` shows both numbers of the pass line, and `flow metrics` shows yours so far. ' + flowIntro.en,
        ),
        check: {
          when: 'flow.finished=1 && flow.pass.done=1 && flow.pass.cycle=1',
          fail: [
            { if: 'flow.finished=1 && flow.pass.done=0', say: bi('Двадцать дней прошли, но готовых задач меньше, чем требует проходная линия. Сравните строку `done (delivered)` в выводе `flow metrics` с числом в `flow goal`.', 'The twenty days are over, but there are fewer finished tasks than the pass line. Compare the `done (delivered)` line of `flow metrics` with the number in `flow goal`.') },
            { if: 'flow.finished=1 && flow.pass.cycle=0', say: bi('Двадцать дней прошли, задач готово достаточно, но 85-й процентиль времени цикла выше порога проходной линии. Скорее всего, в работе одновременно было слишком много карточек.', 'The twenty days are over and enough tasks are done, but the 85th percentile of cycle time is above the pass line. Most likely too many cards were in progress at once.') },
          ],
        },
        docStep: 5,
        solutionTokens: ['flow wip', 'flow station', 'flow policy deploy'],
      },
    },
    {
      id: 'cd3-order',
      weight: 12,
      beyond: true,
      kind: 'task',
      setup: P5,
      task: {
        id: 'cd3-order',
        prompt: bi(
          'Сделайте так, чтобы доска первыми вытягивала карточки с наибольшей стоимостью задержки на единицу оставшейся работы. Как это настроить, в курсе не показано, поэтому найдите нужную настройку в документации команды.',
          'Make the board pull first the cards with the highest cost of delay per unit of remaining work. How to set this up is not shown in the course; find it in the command’s documentation.',
        ),
        check: { when: 'flow.policies.pullOrder=cd3' },
        docStep: 5,
        beyond: true,
        solutionTokens: ['flow policy pull cd3', 'policy pull'],
      },
    },
    ...examItems.map((item) => ({ id: `exam.${item.id}`, weight: 6, kind: 'quiz' as const, item })),
  ],
  explain: [
    {
      id: 'cd-vs-cd',
      prompt: bi('Чем непрерывная доставка отличается от непрерывного развёртывания и где в конвейере заканчивается непрерывная интеграция?', 'How does continuous delivery differ from continuous deployment, and where in the pipeline does continuous integration end?'),
      keyPoints: [
        bi('Непрерывная интеграция означает, что все хотя бы раз в день сливают изменения в общую ветку, а каждое слияние само собирается и проверяется автотестами. Заканчивается она на проверенной сборке и до рабочего сайта не доходит.', 'Continuous integration means everyone merges into the shared branch at least daily, and every merge is built and checked by automated tests by itself. It ends at a checked build and does not reach production.'),
        bi('При непрерывной доставке каждое проверенное изменение в любой момент можно выпустить одним действием человека, а решение о выпуске остаётся за человеком.', 'With continuous delivery every checked change can be released at any moment with one human action, and the release decision stays with a person.'),
        bi('При непрерывном развёртывании проверенное изменение уходит на рабочий сайт само, без решения человека. Такая практика опирается и на непрерывную интеграцию, и на непрерывную доставку.', 'With continuous deployment a checked change goes to production by itself, without a human decision. It rests on both continuous integration and continuous delivery.'),
      ],
    },
    {
      id: 'deploy-often',
      prompt: bi('Руководитель хочет выкладываться раз в месяц, чтобы было надёжнее. Что вы ему ответите?', 'A manager wants to deploy once a month to be safer. What do you answer?'),
      keyPoints: [
        bi('Чем реже выкладка, тем больше в ней изменений, а большая партия чаще ломает сайт, и виноватое изменение в ней труднее найти.', 'The rarer the deployment, the more changes it holds; a big batch breaks the site more often, and the faulty change is harder to find in it.'),
        bi('По данным DORA у большинства команд скорость и стабильность растут вместе.', 'By DORA data, for most teams speed and stability grow together.'),
        bi('Надёжнее выкладывать чаще маленькими партиями, с автотестами и откатом, а метрики DORA покажут, стало ли лучше.', 'Safer is to deploy more often in small batches, with automated tests and rollback, and the DORA metrics will show whether it got better.'),
      ],
    },
    {
      id: 'slo-alert',
      prompt: bi('Как настроить оповещение для SLO 99,9 % за 30 дней, чтобы оно будило дежурного только по делу?', 'How do you set up an alert for an SLO of 99.9% over 30 days so that it wakes the on-call engineer only when needed?'),
      keyPoints: [
        bi('Индикатор описывает то, что видит покупатель, например долю успешных оформлений заказа, а не загрузку процессора.', 'The indicator describes what the customer sees, such as the share of successful checkouts, not the CPU load.'),
        bi('Бюджет ошибок равен (1 − SLO) × окно, то есть 43,2 минуты, а скорость сжигания равна доле ошибок, делённой на (1 − SLO).', 'The error budget is (1 − SLO) × window, that is 43.2 minutes, and the burn rate is the error share divided by (1 − SLO).'),
        bi('Срочное оповещение срабатывает при скорости 14,4 за час или 6 за шесть часов, а скорость 1 за три дня заводит заявку.', 'A page fires at a rate of 14.4 over an hour or 6 over six hours, and a rate of 1 over three days opens a ticket.'),
        bi('Короткое окно рядом с каждым длинным нужно, чтобы оповещение замолкало вскоре после исправления.', 'A short window next to each long one makes the alert go quiet soon after the fix.'),
      ],
    },
    {
      id: 'night-outage',
      prompt: bi('Ночью после выкладки перестала проходить оплата. Опишите свои действия по порядку и то, что попадёт в разбор.', 'At night after a deployment the checkout stopped working. Describe your actions in order and what goes into the postmortem.'),
      keyPoints: [
        bi('Подтвердить оповещение и сразу написать первый статус: что видим, что делаем, когда следующее сообщение.', 'Acknowledge the page and post the first status at once: what we see, what we do, when the next update is.'),
        bi('Выяснить, что менялось последним, и откатить выкладку целиком, а виноватое изменение искать днём.', 'Find out what changed last and roll the deployment back as a whole; look for the faulty change in the daytime.'),
        bi('Подтвердить восстановление по тем же данным, по которым заметили сбой.', 'Confirm recovery by the same data that showed the outage.'),
        bi('В разборе без поиска виноватых записать хронологию, влияние, способствующие факторы и задачи с владельцем и сроком.', 'In the blameless postmortem record the timeline, the impact, the contributing factors and action items with an owner and a due date.'),
      ],
    },
    {
      id: 'when-ready',
      prompt: bi('У команды в работе 30 задач, а заканчивает она 3 задачи в день. Когда будет готова задача, которую возьмут завтра, и что вы предложите изменить?', 'The team has 30 tasks in progress and finishes 3 a day. When will a task taken tomorrow be ready, and what would you change?'),
      keyPoints: [
        bi('По закону Литтла среднее время цикла равно 30 / 3, то есть 10 дней, если незавершённой работы не становится больше.', 'By Little’s law the average cycle time is 30 / 3, that is 10 days, provided the work in progress is not growing.'),
        bi('Обещать срок нужно по 85-му процентилю времени цикла законченных задач, а не по среднему.', 'A date should be promised by the 85th percentile of the cycle time of finished tasks, not by the average.'),
        bi('Чтобы задачи шли быстрее, ограничивают незавершённую работу и ищут узкое место, а не начинают больше задач.', 'To make tasks go faster, limit the work in progress and find the bottleneck rather than start more tasks.'),
      ],
    },
  ],
};

const block: Block = {
  id: 'methodology',
  order: entry.order,
  title: entry.title,
  // The route entry's summary speaks jargon (прод, CI, CD) to a beginner who has just left Orientation; the block says it in words.
  summary: bi(
    'Зачем бизнесу DevOps, как работа идёт от идеи до работающего сервиса, как доска задач помогает ей не застревать, зачем сборку, проверку и выкладку изменений поручают машине и как команда разбирает сбои, не ища виноватых.',
    'Why a business needs DevOps, how work goes from an idea to a working service, how a task board keeps it from getting stuck, why the build, the checks and the deployment of changes are handed to a machine, and how a team reviews outages without looking for someone to blame.',
  ),
  checklistStep: entry.checklistStep,
  // The route entry describes the levels in fragments; the block page shows them as sentences.
  levels: {
    beginner: bi('Вы ещё не работали в команде, которая делает сайты или программы, и слова «выкладка», «доска задач» и «инцидент» для вас новые.', 'You have not worked in a team that builds sites or programs yet, and the words “deployment”, “task board” and “incident” are new to you.'),
    intermediate: bi('Вы видели заявки, выпуски и доски задач, но пока не различаете непрерывную интеграцию и непрерывную доставку.', 'You have seen tickets, releases and task boards, but do not yet tell continuous integration from continuous delivery.'),
    experienced: bi('Вы работали с конвейером сборки и выкладки и участвовали в разборе инцидента.', 'You have worked with a build and deployment pipeline and taken part in an incident review.'),
  },
  hours: entry.hours,
  placement,
  lessons: lessons.map((l) => l.id),
  sources: { en: [S.devopsHandbook, S.kanbanGuide, S.scrumGuide, S.sreBook, S.doraMetrics], ru: [R.devops, R.kanban, R.scrumGuide, R.manifesto] },
  docSources: ['kanban-guide', 'scrum-guide', 'sre-book', 'man'],
  exam: exam.id,
};

export default defineModule({
  blocks: [block],
  lessons,
  concepts,
  quiz,
  docs,
  exams: [exam],
  explainers: [fromModel(valueStreamModel), fromModel(bottleneckModel), fromModel(pipelineModel), fromModel(budgetModel), fromModel(incidentModel)],
});
