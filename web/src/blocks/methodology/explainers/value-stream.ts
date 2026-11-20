// X1 "From an idea to the customer" (07 §5.3, screens 1–4): one card walks
// the path; work is short, waiting is long. Knobs change the waits and the
// number of cards in progress at once; "break it" removes the test stage.
//
// Reading order: at the first step only the idea and the customers are on the
// picture. Each stage appears when the card reaches it: first the queue in
// front of the stage (the card waits there, and the stage says in a callout
// why it has not taken the card yet), then the stage itself at work. The card
// travels along the lines with the number of hours it waits.

import { defineModel } from '../../../core/define';
import type { ElementState, Step } from '../../../core/types';
import { t } from '../../../core/i18n';
import { b, card, edge, fmtn, hiddenExcept, lastMetrics, node, nWord, type Bi } from './kit';

const H = (h: number) => nWord(h, ['час', 'часа', 'часов'], ['hour', 'hours']);
const D = (d: number) => nWord(d, ['рабочий день', 'рабочих дня', 'рабочих дней'], ['working day', 'working days']);

type P = { waitReview: number; waitDeploy: number; inProgress: number };

const DEVOPS_HANDBOOK = { url: 'https://itrevolution.com/product/the-devops-handbook-second-edition/', label: 'The DevOps Handbook, ch. 7' };

/** Work hours at each stage (an 8-hour working day). */
export const WORK = { select: 2, dev: 6, review: 1, test: 2, deploy: 1 };
/** Base waits on the arrows, hours. */
export const WAIT = { idea: 24, dev: 16, review: 8, test: 12, deploy: 24 };
const DEFECT_SHARE = 0.2;

export interface PathNumbers {
  work: number;
  wait: number;
  days: number;
  efficiency: number;
  waits: Record<keyof typeof WAIT, number>;
}

/** The arithmetic of the path, separate from the steps so tests can check it. */
export function pathNumbers(p: P, noTest: boolean): PathNumbers {
  const waits = {
    idea: WAIT.idea,
    dev: WAIT.dev,
    // Every extra card in progress at once adds half a working day of queue before review.
    review: p.waitReview + (p.inProgress - 1) * 4,
    test: noTest ? 0 : WAIT.test + (p.inProgress - 1) * 2,
    deploy: p.waitDeploy,
  };
  const work = WORK.select + WORK.dev + WORK.review + (noTest ? 0 : WORK.test) + WORK.deploy;
  const wait = Object.values(waits).reduce((a, x) => a + x, 0);
  const days = Math.round(((work + wait) / 8) * 10) / 10;
  return { work, wait, days, efficiency: Math.round((work / (work + wait)) * 1000) / 10, waits };
}

const ALL = ['idea', 'select', 'dev', 'review', 'test', 'deploy', 'customers', 'w-idea', 'w-dev', 'w-review', 'w-test', 'w-skip', 'w-deploy', 'w-live', 'defect'];
const QUEUE = ['Очередь никто не заводит нарочно. Карточка лежит в ней, пока следующий этап занят другой работой.', 'Nobody sets up a queue on purpose. The card lies in it while the next stage is busy with other work.'] as [string, string];

/** "ждёт 24 ч" — the label of the card while it waits on an arrow. */
const waitLabel = (h: number) => b(`ждёт ${h} ч`, `waits ${h} h`);

export const valueStreamModel = defineModel<P>({
  id: 'method.x.value-stream',
  frame: 'visible',
  block: 'methodology',
  title: b('Путь задачи от идеи до покупателя', 'A task from an idea to the customer'),
  summary: b(
    'Как карточка «Оплата картой» проходит путь от просьбы покупателей до работающей функции на сайте. На каждом этапе над карточкой работают несколько часов, а между этапами она ждёт, и схема считает отдельно часы работы и часы ожидания. Под схемой копятся эти часы, длина всего пути в рабочих днях и эффективность потока.',
    'How the card “Card payments” walks the path from the customers’ request to a working feature on the site. At each stage the card is worked on for a few hours, and between the stages it waits; the diagram counts the hours of work and the hours of waiting separately. Under the diagram these hours add up, together with the length of the whole path in working days and the flow efficiency.',
  ),
  intro: b(
    'Схема собирается по шагам, и сейчас на ней видны только идея и покупатели, к которым эта идея должна прийти. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Каждый этап появляется, когда до него доходит карточка. Облачко у подсвеченного блока говорит, что этот блок делает или почему карточка у него ждёт, а карточка на линии показывает, сколько часов она ждёт.\n\nПосле первого прохода меняйте «Параметры» и включайте поломки в блоке «Сломать», а схема объяснит, что изменилось и почему.',
    'The diagram builds up step by step, and for now it shows only the idea and the customers it should reach. Press “Start from the first step”, then go on with “Step forward” above the diagram. Each stage appears when the card reaches it. The callout at the highlighted block says what the block does or why the card waits there, and the card on the line shows how many hours it waits.\n\nAfter the first pass change the “Parameters” and switch on the breaks in “Break it”, and the diagram explains what changed and why.',
  ),
  legend: [
    { mark: 'active', text: b('этап, на котором карточка сейчас', 'the stage where the card is now') },
    { mark: 'say', text: b('что делает этап или почему карточка ждёт', 'what the stage does or why the card waits') },
    { mark: 'token', text: b('карточка и сколько часов она ждёт', 'the card and how many hours it waits') },
    { mark: 'wait', text: b('очередь, в которой карточка лежит и ждёт', 'a queue where the card lies and waits') },
    { mark: 'warn', text: b('карточка ждёт сутки и дольше', 'the card waits a day or longer') },
    { mark: 'ok', text: b('этап закончил свою работу', 'the stage has done its work') },
    { mark: 'err', text: b('дефект нашёл покупатель', 'a customer found the defect') },
    { mark: 'icon:user', text: b('люди, которые работают с карточкой', 'the people working on the card') },
    { mark: 'icon:server', text: b('выкладка на рабочий сайт', 'deployment to the working site') },
    { mark: 'icon:browser', text: b('покупатели на сайте', 'the customers on the site') },
  ],
  stopLabel: b('Карточка вернулась', 'The card came back'),
  concepts: ['method.value-stream', 'method.flow-efficiency'],
  diagram: {
    width: 960,
    height: 440,
    nodes: [
      node('idea', b('Идея', 'Idea'), 'neutral', [24, 40, 176, 60], card(['Просьба покупателей или мысль владельца бизнеса, записанная на карточку: «хотим оплату картой». Пока карточка лежит в списке идей, над ней никто не работает.', 'A customer request or the owner’s idea written on a card: “we want card payments”. While the card lies in the idea list, nobody works on it.'], ['Идеи приносят покупатели, служба поддержки и владелец бизнеса.', 'Ideas come from the customers, support and the business owner.']), { icon: 'file' }),
      node('select', b('Отбор', 'Selection'), 'ci-source', [392, 40, 176, 60], card(['На этом этапе решают, браться ли за идею, и записывают, что значит «готово», то есть проверяемое условие, по которому все поймут, что задача закончена. Работа на этом этапе занимает пару часов.', 'Here the team decides whether to take the idea and writes down what “done” means, that is, a checkable condition by which everyone will know the task is finished. The work at this stage takes a couple of hours.'], ['Отбирает идеи владелец продукта.', 'The product owner selects the ideas.']), { icon: 'user' }),
      node('dev', b('Разработка', 'Development'), 'ci-build', [760, 40, 176, 60], card(['Разработчик пишет код изменения. Это самый заметный этап, но по календарю он далеко не самый долгий.', 'A developer writes the code of the change. It is the most visible stage, but far from the longest on the calendar.'], ['Код пишут разработчики.', 'Developers write the code.']), { icon: 'terminal' }),
      node('review', b('Ревью', 'Review'), 'ci-build', [760, 200, 176, 60], card(['Коллега читает код изменения и ищет ошибки до того, как их найдут покупатели.', 'A colleague reads the code of the change and looks for mistakes before the customers find them.'], ['Ревью делает другой разработчик.', 'Another developer does the review.']), { icon: 'user' }),
      node('test', b('Проверка', 'Testing'), 'ci-test', [760, 360, 176, 60], card(['Тестировщик проверяет, что изменение работает так, как задумано, и не сломало ничего рядом.', 'The tester checks that the change works as intended and broke nothing next to it.'], ['Проверяет тестировщик, один на двух разработчиков.', 'The tester does it, one for two developers.']), { icon: 'process' }),
      node('deploy', b('Выкладка', 'Deployment'), 'ci-deploy', [392, 360, 176, 60], card(['Эксплуатация ставит изменение на рабочий сайт, то есть на ту версию сайта, которой пользуются покупатели.', 'Operations puts the change on the working site, the version of the site the customers use.'], ['Выкладывает эксплуатация, вручную и по расписанию.', 'Operations deploys, by hand and on a schedule.']), { icon: 'server' }),
      node('customers', b('Покупатели', 'Customers'), 'user', [24, 360, 176, 60], card(['Конец пути. Только когда изменение дошло до покупателей, оно начинает приносить магазину деньги.', 'The end of the path. Only once the change reaches the customers does it start to earn the shop money.'], ['Покупатели приходят на сайт магазина сами, и пользуются они только тем, что уже выложено.', 'The customers come to the shop’s site themselves, and they use only what is already deployed.']), { icon: 'browser' }),
    ],
    edges: [
      edge('w-idea', 'idea', 'select', b('ждёт отбора', 'waits for selection'), card(['Идей больше, чем людей, которые их разбирают, поэтому новая карточка ждёт, пока до неё дойдёт очередь.', 'There are more ideas than people to sort them, so a new card waits for its turn.'], QUEUE, DEVOPS_HANDBOOK), { labelAt: 0.3 }),
      edge('w-dev', 'select', 'dev', b('ждёт разработчика', 'waits for a developer'), card(['Разработчики заняты задачами, которые уже начали, и отобранная карточка ждёт, пока кто-нибудь из них освободится.', 'The developers are busy with what they already started, and the selected card waits until one of them is free.'], QUEUE), { labelAt: 0.3 }),
      edge('w-review', 'dev', 'review', b('ждёт ревью', 'waits for review'), card(['Ревьюер занят своими задачами. Чем больше карточек команда ведёт одновременно, тем длиннее очередь к нему.', 'The reviewer is busy with their own tasks. The more cards the team runs at once, the longer the queue to them.'], QUEUE)),
      edge('w-test', 'review', 'test', b('ждёт проверки', 'waits for testing'), card(['Тестировщик один, а изменения приходят к нему от двух разработчиков.', 'There is one tester, and changes come to them from two developers.'], QUEUE)),
      edge('w-skip', 'review', 'deploy', b('без проверки', 'untested'), card(['Если этап проверки убрать, изменение после ревью сразу ждёт выкладки, и никто не проверяет, работает ли оно.', 'With the test stage removed, the change goes straight from review to wait for deployment, and nobody checks whether it works.'], QUEUE), { labelAt: 0.55 }),
      edge('w-deploy', 'test', 'deploy', b('ждёт дня выкладки', 'waits for the deployment day'), card(['Изменения выкладывают раз в неделю, по четвергам, поэтому изменение, проверенное во вторник, лежит до четверга.', 'Changes are deployed once a week, on Thursday, so a change tested on Tuesday lies there until Thursday.'], ['Это ожидание задаёт правило команды: выкладывать изменения раз в неделю.', 'This wait comes from the team’s rule: deploy changes once a week.'])),
      edge('w-live', 'deploy', 'customers', b('у покупателей', 'with the customers'), card(['После выкладки изменение сразу доступно всем покупателям.', 'After the deployment the change is available to every customer at once.'], ['Изменение доставляет сам сайт.', 'The site itself delivers it.'])),
      edge('defect', 'customers', 'idea', b('дефект возвращается', 'a defect comes back'), card(['Ошибку, которую не поймали до выкладки, находит покупатель. Исправление становится новой карточкой и проходит весь путь заново.', 'A mistake not caught before the deployment is found by a customer. The fix becomes a new card and walks the whole path again.'], ['Дефект приносят покупатели через службу поддержки.', 'The customers bring the defect through support.']), { dashed: true }),
    ],
  },
  params: [
    {
      id: 'waitDeploy',
      group: b('Очереди на пути', 'The queues on the path'),
      label: b('Сколько часов проверенное изменение ждёт дня выкладки', 'Hours a tested change waits for the deployment day'),
      kind: 'range',
      min: 0,
      max: 72,
      step: 4,
      default: WAIT.deploy,
      near: 'w-deploy',
      predict: {
        prompt: b('Вы меняете, сколько часов изменение ждёт дня выкладки. Часы работы на этапах никто не трогает. Что произойдёт с путём карточки?', 'You change how many hours a change waits for the deployment day. Nobody touches the hours of work at the stages. What happens to the card’s path?'),
        options: [
          { id: 'path', text: b('Путь изменится на те же часы, а работы останется столько же', 'The path changes by the same hours, and the work stays the same') },
          { id: 'work', text: b('Вместе с путём изменятся и часы работы', 'The hours of work change along with the path') },
          { id: 'none', text: b('Путь не изменится, ведь в него входят только часы работы', 'The path stays the same, since only work hours count in it') },
        ],
        resolve: (prev, next) => (lastMetrics(next).work !== lastMetrics(prev).work ? 'work' : lastMetrics(next).days !== lastMetrics(prev).days ? 'path' : 'none'),
      },
    },
    { id: 'waitReview', group: b('Очереди на пути', 'The queues on the path'), label: b('Сколько часов готовый код ждёт ревьюера', 'Hours finished code waits for a reviewer'), kind: 'range', min: 0, max: 40, step: 4, default: WAIT.review, near: 'w-review', levels: ['intermediate', 'experienced'] },
    {
      id: 'inProgress',
      group: b('Сколько работы начато', 'How much work is started'),
      label: b('Сколько карточек команда ведёт одновременно', 'How many cards the team runs at once'),
      kind: 'range',
      min: 1,
      max: 10,
      step: 1,
      default: 1,
      near: 'review',
      predict: {
        prompt: b('Вы меняете, сколько карточек команда ведёт одновременно. Люди и часы работы на каждой карточке остаются прежними. Что произойдёт с путём одной карточки?', 'You change how many cards the team runs at once. The people and the hours of work on each card stay the same. What happens to the path of one card?'),
        options: [
          { id: 'longer', text: b('Чем больше карточек начато, тем длиннее путь', 'The more cards are started, the longer the path') },
          { id: 'same', text: b('Путь останется прежним', 'The path stays the same') },
          { id: 'shorter', text: b('Чем больше карточек начато, тем короче путь', 'The more cards are started, the shorter the path') },
        ],
        resolve: (prev, next) => {
          const a = lastMetrics(prev).days ?? 0;
          const c = lastMetrics(next).days ?? 0;
          const more = (next.find((s) => s.id === 'wait-w-review')?.metrics?.wait ?? 0) >= (prev.find((s) => s.id === 'wait-w-review')?.metrics?.wait ?? 0);
          if (a === c) return 'same';
          return (c > a) === more ? 'longer' : 'shorter';
        },
      },
    },
  ],
  breaks: [
    {
      id: 'no-test',
      label: b('Этап проверки убран, и изменения уходят к покупателям непроверенными', 'The test stage is removed, and changes reach the customers untested'),
      remove: ['test', 'w-test'],
      predict: {
        prompt: b('Этап проверки убрали, чтобы изменения доходили до покупателей быстрее. Остальные этапы и очереди прежние. Что произойдёт?', 'The test stage is removed so that changes reach the customers sooner. The other stages and queues are the same. What happens?'),
        options: [
          { id: 'return', text: b('Путь станет короче, но часть карточек вернётся от покупателей с дефектом и пройдёт его заново', 'The path gets shorter, but some cards come back from the customers with a defect and walk it again') },
          { id: 'faster', text: b('Путь станет короче, и больше ничего не изменится', 'The path gets shorter, and nothing else changes') },
          { id: 'stop', text: b('Карточка застрянет после ревью и до покупателей не дойдёт', 'The card gets stuck after review and never reaches the customers') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'defect') ? 'return' : 'faster'),
      },
    },
  ],
  metrics: [
    { id: 'work', label: b('работа, часов', 'work, hours') },
    { id: 'wait', label: b('ожидание, часов', 'waiting, hours') },
    { id: 'days', label: b('весь путь, рабочих дней', 'the whole path, working days') },
    { id: 'eff', label: b('эффективность потока', 'flow efficiency'), unit: '%' },
  ],
  run(p, broken): Step[] {
    const noTest = broken.has('no-test');
    const n = pathNumbers(p, noTest);
    const steps: Step[] = [];
    let work = 0;
    let wait = 0;
    const m = () => ({ work, wait, days: Math.round(((work + wait) / 8) * 10) / 10, eff: work + wait ? Math.round((work / (work + wait)) * 1000) / 10 : 0 });
    let prevStage = '';
    /** The card waits on an arrow; the stage it waits for appears and says why it has not taken the card yet. */
    const queue = (edgeId: string, stage: string, hours: number, caption: Bi, why: Bi) => {
      wait += hours;
      const states: Record<string, ElementState> = { [edgeId]: hours >= 24 ? 'warn' : 'wait', [stage]: 'on' };
      if (prevStage) states[prevStage] = 'ok';
      steps.push({ id: `wait-${edgeId}`, label: `${hours} ч`, caption, focus: [edgeId, stage], tokens: [{ edge: edgeId, label: waitLabel(hours) }], say: { [stage]: why }, states, metrics: m() });
    };
    /** The stage works on the card. */
    const stage = (id: string, hours: number, label: Bi, caption: Bi, does: Bi) => {
      work += hours;
      prevStage = id;
      steps.push({ id: `work-${id}`, label, caption, focus: [id], say: { [id]: does }, states: { [id]: 'on' }, metrics: m() });
    };
    steps.push({
      id: 'start',
      label: b('идея', 'idea'),
      caption: b('Покупатели попросили магазин принимать оплату картой, и в списке идей появилась карточка «Оплата картой». Слева внизу стоят покупатели, до которых эта карточка должна дойти. Дальше схема отдельно считает часы, когда над карточкой работают, и часы, когда она ждёт.', 'The customers asked the shop to accept card payments, and a card “Card payments” appeared in the idea list. Bottom left are the customers it should reach. From here the diagram counts separately the hours the card is worked on and the hours it waits.'),
      focus: ['idea'],
      say: { idea: b('В списке идей появилась карточка «Оплата картой».', 'The card “Card payments” appears in the idea list.') },
      states: hiddenExcept(ALL, 'idea', 'customers'),
      metrics: m(),
    });
    queue('w-idea', 'select', n.waits.idea, fmtn(b('Карточка {hh} лежит в списке идей, потому что владелец продукта разбирает другие идеи и до этой ещё не дошёл. Над карточкой никто не работает, но часы пути уже идут.', 'For {hh} the card lies in the idea list, because the product owner is sorting other ideas and has not got to this one. Nobody works on the card, but the hours of the path are already running.'), { h: n.waits.idea, hh: H(n.waits.idea) }), fmtn(b('Владелец продукта занят другими идеями и возьмёт эту карточку через {hh}.', 'The product owner is busy with other ideas and will take this card in {hh}.'), { h: n.waits.idea, hh: H(n.waits.idea) }));
    stage('select', WORK.select, b('отбор', 'select'), b('Владелец продукта берёт карточку в работу и записывает, что задача будет считаться готовой, когда покупатель сможет оплатить заказ картой. На это уходит два часа.', 'The product owner takes the card and writes down that the task will count as done when a customer can pay for an order by card. This takes two hours.'), b('Владелец продукта записывает, что задачу сочтут готовой, когда покупатель сможет заплатить картой.', 'The product owner writes down that the task will count as done when a customer can pay by card.'));
    queue('w-dev', 'dev', n.waits.dev, fmtn(b('Отобранная карточка ждёт {hh}, потому что оба разработчика заканчивают задачи, которые начали раньше.', 'The selected card waits {hh}, because both developers are finishing tasks they started earlier.'), { h: n.waits.dev, hh: H(n.waits.dev) }), fmtn(b('Разработчики заканчивают начатые задачи, и карточка ждёт свободного человека {hh}.', 'The developers finish what they started; the card waits {hh} for a free person.'), { h: n.waits.dev, hh: H(n.waits.dev) }));
    stage('dev', WORK.dev, b('код', 'code'), b('Разработчик пишет код оплаты картой. На это уходит шесть часов работы, то есть меньше одного рабочего дня.', 'A developer writes the card payment code. This takes six hours of work, less than one working day.'), b('Разработчик пишет код оплаты картой, и на это уходит шесть часов.', 'A developer writes the card payment code, and it takes six hours.'));
    queue(
      'w-review',
      'review',
      n.waits.review,
      p.inProgress > 1
        ? fmtn(b('Код готов, но ревьюер получит его только через {hh}. Кроме этой карточки, у него в очереди ещё {kk}, потому что команда ведёт несколько карточек сразу.', 'The code is ready, but the reviewer will get it only after {hh}. Besides this card there are {kk} more in their queue, because the team runs several cards at once.'), { h: n.waits.review, hh: H(n.waits.review), kk: nWord(p.inProgress - 1, ['карточка', 'карточки', 'карточек'], ['card', 'cards']) })
        : fmtn(b('Код готов, но ревьюер занят своей задачей, и карточка ждёт его {hh}.', 'The code is ready, but the reviewer is busy with their own task, and the card waits {hh} for them.'), { h: n.waits.review, hh: H(n.waits.review) }),
      p.inProgress > 1
        ? fmtn(b('У ревьюера в очереди ещё {kk} от коллег, поэтому эта карточка подождёт {hh}.', 'The reviewer has {kk} more from colleagues in the queue; this one waits {hh}.'), { h: n.waits.review, hh: H(n.waits.review), kk: nWord(p.inProgress - 1, ['карточка', 'карточки', 'карточек'], ['card', 'cards']) })
        : fmtn(b('Ревьюер доделывает свою задачу и возьмёт карточку через {hh}.', 'The reviewer finishes their own task and will take the card in {hh}.'), { h: n.waits.review, hh: H(n.waits.review) }),
    );
    stage('review', WORK.review, b('ревью', 'review'), b('Коллега читает код и ищет в нём ошибки. Ревью занимает час.', 'A colleague reads the code and looks for mistakes. Review takes an hour.'), b('Коллега читает код и ищет в нём ошибки, и на это уходит час.', 'A colleague reads the code and looks for mistakes, and it takes an hour.'));
    if (!noTest) {
      queue('w-test', 'test', n.waits.test, fmtn(b('Карточка {hh} стоит в очереди к тестировщику, потому что тестировщик один, а изменения приходят к нему от двух разработчиков.', 'For {hh} the card stands in the queue to the tester, because there is one tester, and changes come from two developers.'), { h: n.waits.test, hh: H(n.waits.test) }), fmtn(b('Тестировщик проверяет изменения другого разработчика, а эта карточка ждёт своей очереди {hh}.', 'The tester is checking the other developer’s changes; this card waits {hh}.'), { h: n.waits.test, hh: H(n.waits.test) }));
      stage('test', WORK.test, b('проверка', 'test'), b('Тестировщик проверяет, что покупатель может оплатить заказ картой и что корзина и скидки работают как раньше. Проверка занимает два часа.', 'The tester checks that a customer can pay by card and that the cart and the discounts work as before. Two hours of work.'), b('Тестировщик проверяет оплату картой и всё, что с ней связано, и на это уходит два часа.', 'The tester checks card payments and everything connected to them, and it takes two hours.'));
    }
    queue(
      noTest ? 'w-skip' : 'w-deploy',
      'deploy',
      n.waits.deploy,
      fmtn(b('Изменение готово, но выкладывают раз в неделю, по четвергам, и карточка ждёт дня выкладки {hh}.', 'The change is ready, but deployments happen once a week, on Thursday, and the card waits {hh} for the deployment day.'), { h: n.waits.deploy, hh: H(n.waits.deploy) }),
      fmtn(b('Эксплуатация выкладывает изменения только по четвергам, и до выкладки остаётся {hh}.', 'Operations deploys changes only on Thursdays; {hh} until the deployment.'), { h: n.waits.deploy, hh: H(n.waits.deploy) }),
    );
    stage('deploy', WORK.deploy, b('выкладка', 'deploy'), b('Эксплуатация выкладывает изменение на рабочий сайт, и на это уходит ещё час работы.', 'Operations deploys the change to the working site. One more hour of work.'), b('Эксплуатация выкладывает изменение на рабочий сайт, и на это уходит час.', 'Operations deploys the change to the working site, and it takes an hour.'));
    steps.push({
      id: 'done',
      label: b('итог', 'total'),
      caption: fmtn(b('Покупатели могут платить картой. Весь путь занял {dd}, из них над карточкой работали {ww}. Эффективность потока равна {e} %, а всё остальное время карточка ждала в очередях.', 'The customers can pay by card. The whole path took {dd}, and the card was worked on for {ww} of them. Flow efficiency is {e}%, and the rest of the time the card waited in queues.'), { dd: D(n.days), ww: H(n.work), e: n.efficiency }),
      focus: ['customers', 'w-live'],
      tokens: [{ edge: 'w-live', label: b('оплата картой', 'card payments') }],
      say: { customers: b('Покупатели платят картой, и только теперь изменение приносит деньги.', 'The customers pay by card, and only now does the change earn money.') },
      states: { customers: 'ok', deploy: 'ok', 'w-live': 'on' },
      metrics: { work: n.work, wait: n.wait, days: n.days, eff: n.efficiency },
    });
    if (noTest) {
      steps.push({
        id: 'defect',
        label: b('дефект', 'defect'),
        caption: fmtn(b('Без проверки путь короче, но ошибки теперь находят покупатели. В модели так возвращается каждая пятая карточка ({p} %), и исправление каждой из них становится новой карточкой, которая проходит весь путь ещё раз.', 'Without testing the path is shorter, but now the customers find the mistakes. In the model one card in five ({p}%) comes back this way, and the fix of each becomes a new card that walks the whole path again.'), { p: DEFECT_SHARE * 100 }),
        focus: ['defect', 'customers'],
        tokens: [{ edge: 'defect', label: b('дефект', 'defect') }],
        say: { customers: b('Покупатель оплатил заказ картой, а заказ не подтвердился, и покупатель пишет в поддержку.', 'A customer paid by card, but the order was not confirmed; they write to support.') },
        states: { defect: 'err', customers: 'err' },
        metrics: { work: n.work, wait: n.wait, days: n.days, eff: n.efficiency },
        broken: { at: 'customers', message: t(b('Обращение в поддержку #4821: «Оплатил картой, а заказ не подтверждён».', 'Support ticket #4821: "Paid by card, the order is not confirmed."')), caption: b('ошибку нашёл покупатель, а не проверка, поэтому исправление снова проходит весь путь от идеи до выкладки.', 'a customer found the mistake, not the test stage, so the fix walks the whole path again, from the idea to the deployment.') },
      });
    }
    return steps;
  },
  explainDelta(prev, next, change, a, c): Bi {
    const d0 = lastMetrics(prev).days ?? 0;
    const d1 = lastMetrics(next).days ?? 0;
    const e1 = lastMetrics(next).eff ?? 0;
    if (change.kind === 'break') {
      return change.on
        ? fmtn(b('Без проверки путь сократился с {a} до {bb}, но каждая пятая карточка проходит его дважды. В среднем выигрыша почти нет, а дефект первым увидел покупатель.', 'Without testing the path shrank from {a} to {bb}, but one card in five walks it twice. On average there is almost no gain, and a customer saw the defect first.'), { a: d0, bb: D(d1) })
        : b('Этап проверки вернулся, и дефекты снова находят до того, как их увидят покупатели.', 'The test stage is back, and defects are again found before the customers see them.');
    }
    if (change.id === 'inProgress')
      return fmtn(b('Команда ведёт одновременно уже не {x}, а {yc}. Очереди перед ревью и проверкой изменились, и путь одной карточки занимает {bb} вместо {a}. Часов работы столько же, а эффективность потока теперь {e} %.', 'The team now runs {yc} at once instead of {x}. The queues before review and testing changed, and the path of one card is now {bb} instead of {a}. The hours of work are the same, and flow efficiency is now {e}%.'), { x: a.inProgress as number, yc: nWord(c.inProgress as number, ['карточку', 'карточки', 'карточек'], ['card', 'cards']), a: d0, bb: D(d1), e: e1 });
    if (change.id === 'waitDeploy')
      return fmtn(b('Изменение ждёт дня выкладки уже не {x}, а {yy}, и путь занимает {bb} вместо {a}. Часов работы не прибавилось и не убавилось, изменилось только ожидание, а эффективность потока теперь {e} %.', 'A change now waits {yy} for the deployment day instead of {x}, and the path is {bb} instead of {a}. Not one hour of work was added or removed, only the waiting changed, and flow efficiency is now {e}%.'), { x: a.waitDeploy as number, yy: H(c.waitDeploy as number), a: d0, bb: D(d1), e: e1 });
    return fmtn(b('Готовый код ждёт ревьюера уже не {x}, а {yy}, и путь занимает {bb} вместо {a}. Эффективность потока теперь {e} %.', 'Finished code now waits {yy} for a reviewer instead of {x}, and the path is {bb} instead of {a}. Flow efficiency is now {e}%.'), { x: a.waitReview as number, yy: H(c.waitReview as number), a: d0, bb: D(d1), e: e1 });
  },
});
