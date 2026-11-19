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
import { quiz } from './quiz';
import { R, S } from './sources';

const lessons = [business, valueStream, board, flow, little, bottleneck, batch, agile, workTypes, pipeline, dora, sre, incident, culture, blackFriday];
const entry = ROUTE.find((e) => e.id === 'methodology')!;
const bank = new Map(quiz.map((q) => [q.id, q]));

/** A bank item reused in a placement check or the exam under its own id. */
const copy = (id: string, suffix: string): QuizItem => ({ ...(bank.get(id) as QuizItem), id: `${id}.${suffix}` });

const P5: TerminalSetup = { ext: { flow: { scenario: 'p5' } } };
const P10: TerminalSetup = { ext: { flow: { scenario: 'p10' } } };
const S2: TerminalSetup = { ext: { flow: { scenario: 's2' } } };

const flowIntro = bi('Доска запущена в терминале командой `flow`: `flow help` перечислит команды, `man flow` объяснит их подробно.', 'The board runs in the terminal as the `flow` command: `flow help` lists the commands, `man flow` explains them in detail.');

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
        'Пять дней доски с постоянной мощностью: четыре человека, четырнадцать одинаковых задач, автопилот тянет карточки сам. Поставьте лимиты WIP так, чтобы к концу 5-го дня готовыми были не меньше 6 карточек, и прогоните пять дней. ' + flowIntro.ru,
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
        'Доска на 10 дней, один этап медленнее остальных. Найдите его и распределите людей и лимиты так, чтобы за 10 дней закончить не меньше задач, чем проходная линия на этом зерне (`flow goal`). ' + flowIntro.ru,
        'A 10-day board with one stage slower than the others. Find it and arrange people and limits so that in 10 days you finish at least as many tasks as the pass line on this seed (`flow goal`). ' + flowIntro.en,
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
        'Доска на 10 дней, один этап медленнее остальных. Добейтесь, чтобы за 10 дней было закончено не меньше задач, чем проходная линия (`flow goal`). ' + flowIntro.ru,
        'A 10-day board with one stage slower than the others. Make sure that in 10 days at least as many tasks are finished as the pass line (`flow goal`). ' + flowIntro.en,
      ),
      check: { when: 'flow.daysDone>=10 && flow.pass.done=1' },
      concepts: ['method.bottleneck'],
    },
  },
];

const exam: Exam = {
  id: 'methodology.exam',
  block: 'methodology',
  title: bi('Экзамен блока «Методология»', 'Methodology block exam'),
  intro: bi(
    'Двадцать дней «Чёрной пятницы» в терминале, одна настройка доски, которой нет в курсе, и восемь вопросов. Открыта только документация: страница `man flow`, Scrum Guide, Kanban Guide и заметки к политике бюджета ошибок. Сдача — 70% и обязательная часть с доской.',
    'Twenty days of “Black Friday” in the terminal, one board setting the course does not show, and eight questions. Only the documentation is open: `man flow`, the Scrum Guide, the Kanban Guide and the notes on the error budget policy. Pass: 70% and the mandatory board part.',
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
          'Проведите все 20 дней. Итог по деньгам должен быть не хуже проходной линии на этом зерне (`flow goal`, `flow metrics`). ' + flowIntro.ru,
          'Run all 20 days. The money result must be no worse than the pass line on this seed (`flow goal`, `flow metrics`). ' + flowIntro.en,
        ),
        check: { when: 'flow.finished=1 && flow.pass.money=1', fail: [{ if: 'flow.finished=1', say: bi('Двадцать дней прошли, но итог по деньгам ниже проходной линии.', 'The twenty days are over, but the money result is below the pass line.') }] },
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
          'Сделайте так, чтобы доска первыми вытягивала карточки с наибольшей стоимостью задержки на единицу оставшейся работы. Как это настроить, в курсе не показано — найдите в документации команды.',
          'Make the board pull first the cards with the highest cost of delay per unit of remaining work. How to set this up is not shown in the course; find it in the command’s documentation.',
        ),
        check: { when: 'flow.policies.pullOrder=cd3' },
        docStep: 5,
        beyond: true,
        solutionTokens: ['flow policy pull cd3', 'policy pull'],
      },
    },
    ...['method.q.little-calc', 'method.q.ci-cd-match', 'method.q.freeze', 'method.q.burn', 'method.q.blameless-rewrite', 'method.q.five-steps', 'method.q.cd3', 'method.q.dora-less-often'].map((id) => ({ id: `exam.${id}`, weight: 6, kind: 'quiz' as const, item: copy(id, 'exam') })),
  ],
};

const block: Block = {
  id: 'methodology',
  order: entry.order,
  title: entry.title,
  summary: entry.summary,
  checklistStep: entry.checklistStep,
  levels: entry.levels,
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
