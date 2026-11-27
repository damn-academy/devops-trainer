// The methodology quiz bank (07 §11.4). Every wrong option carries its own
// explanation: each distractor is a recorded misconception. Items check
// calculation, ordering and decisions in a situation, not memorised wording.

import { bi } from '../../core/i18n';
import type { QuizItem } from '../../core/types';

export const quiz: QuizItem[] = [
  // ── methodology.business ──
  {
    id: 'method.q.outage-kind',
    kind: 'mcq',
    concepts: ['method.outage'],
    prompt: bi('Покупатель нажимает «Оплатить», а деньги не списываются, и так уже целый час у всех покупателей. Как это называется?', 'A customer pressed “pay”, no money was charged, and it has been like that for every customer for an hour. What is it?'),
    options: [
      { id: 'outage', text: bi('Сбой', 'An outage'), correct: true },
      { id: 'change', text: bi('Изменение', 'A change'), why: bi('Изменением называют правку продукта. Возможно, сбой вызвало как раз изменение, но покупатели видят не изменение, а то, что рабочий сайт работает плохо.', 'A change is an edit to the product. The outage may well be caused by a change, but what customers see is production working badly.') },
      { id: 'feature', text: bi('Функция', 'A feature'), why: bi('Функция даёт покупателю новую возможность, а здесь возможность, наоборот, пропала.', 'A feature is a new possibility for the customer. Here a possibility has disappeared instead.') },
    ],
    explain: bi('Сбоем называют ситуацию, когда рабочий сайт работает плохо или не работает совсем и покупатели не могут сделать то, ради чего пришли.', 'An outage is production working badly or not at all: customers cannot do what they came for.'),
    refs: { lesson: 'methodology.business' },
  },
  {
    id: 'method.q.conflict',
    kind: 'mcq',
    concepts: ['method.dev-ops', 'method.devops'],
    prompt: bi('Разработку оценивают по числу выпущенных функций, а эксплуатацию по числу дней без сбоев. Почему из-за этого возникает конфликт?', 'Development is judged by the number of features shipped, operations by days without outages. Why is that a conflict?'),
    options: [
      { id: 'risk', text: bi('Каждое изменение рискует сломать сайт, поэтому одной стороне выгодно выкладывать чаще, а другой реже', 'Every change is a risk to stability: one side gains from deploying more often, the other from deploying less'), correct: true },
      { id: 'people', text: bi('В разработке и в эксплуатации работают люди с разными характерами, и они просто не умеют договориться между собой', 'Development and operations are staffed by people with different characters, who simply cannot agree with each other'), why: bi('Конфликт создают цели, а не характеры. Если поменять людей местами, спор останется.', 'The conflict comes from the goals, not from characters: swap the people and the argument stays.') },
      { id: 'money', text: bi('Им платят из разных бюджетов', 'They are paid from different budgets'), why: bi('Бюджет у отделов может быть общим, а цели при этом противоположными. Всё дело в том, по чему их оценивают.', 'Budgets can be shared while the goals are opposite. The point is what they are judged by.') },
    ],
    explain: bi('DevOps снимает этот конфликт общей целью, по которой изменения должны доходить до покупателей быстро и при этом не ломать сайт.', 'DevOps removes the conflict with a shared goal: changes reach the customers fast and do not break the site.'),
  },
  {
    id: 'method.q.value-delivered',
    kind: 'mcq',
    concepts: ['method.value'],
    prompt: bi('Функция «оплата картой» полностью написана и проверена, но две недели ждёт выкладки. Сколько ценности она принесла магазину за эти две недели?', 'The “card payments” feature is fully written and tested but waits two weeks for deployment. How much value did it bring the shop in those two weeks?'),
    options: [
      { id: 'zero', text: bi('Нисколько', 'None'), correct: true },
      { id: 'full', text: bi('Всю, ведь работа уже сделана', 'All of it: the work is done'), why: bi('Деньги приносит то, чем пользуются покупатели. Готовая, но не выложенная функция означает затраты без отдачи.', 'Money comes from what the customers use. A finished but undeployed feature is cost without return.') },
      { id: 'half', text: bi('Половину', 'Half'), why: bi('Ценность не накапливается по ходу работы. Она появляется только тогда, когда изменение дошло до покупателя.', 'Value does not accumulate as the work goes on: it appears only when the change reaches the customer.') },
    ],
  },
  // ── methodology.value-stream ──
  {
    id: 'method.q.flow-efficiency',
    kind: 'mcq',
    concepts: ['method.flow-efficiency'],
    prompt: bi('Путь задачи занял 10 рабочих дней по 8 часов, а работали над ней 16 часов. Какова эффективность потока?', 'A task’s path took 10 working days of 8 hours. It was worked on for 16 hours. What is the flow efficiency?'),
    options: [
      { id: '20', text: bi('20 %', '20%'), correct: true },
      { id: '16', text: bi('16 %', '16%'), why: bi('Число 16 означает часы работы, а не проценты. Часы работы нужно разделить на длину всего пути, то есть 16 на 80.', '16 is the hours of work, not a percentage. Divide the work by the whole path: 16 / 80.') },
      { id: '80', text: bi('80 %', '80%'), why: bi('80 % составляет доля ожидания, потому что из 80 часов пути задача ждала 64.', 'That is the share of waiting: the task waited 64 of the 80 hours.') },
    ],
    explain: bi('16 / (10 × 8) = 0,2. Остальные 80 % пути задача ждала.', '16 / (10 × 8) = 0.2. For the other 80% of the path the task waited.'),
  },
  {
    id: 'method.q.longest-wait',
    kind: 'mcq',
    concepts: ['method.value-stream'],
    prompt: bi('Задача ждёт разработчика 8 часов, ревьюера 4 часа, тестировщика 6 часов и дня выкладки 40 часов, а работают над ней 12 часов. Что сократит её путь сильнее всего?', 'On a task’s path: it waits 8 h for a developer, 4 h for a reviewer, 6 h for the tester, 40 h for the deployment window. Work: 12 h. What shortens the path most?'),
    options: [
      { id: 'window', text: bi('Выкладывать чаще, чем раз в неделю', 'Deploy more often than once a week'), correct: true },
      { id: 'faster', text: bi('Попросить разработчиков писать код быстрее', 'Ask the developers to code faster'), why: bi('Работы на всём пути 12 часов, и даже вдвое более быстрая работа сэкономит лишь несколько часов, а день выкладки задача ждёт 40 часов.', 'There are 12 hours of work on the whole path; even twice as fast saves a few hours. The wait for the window is 40.') },
      { id: 'review', text: bi('Нанять второго ревьюера', 'Hire a second reviewer'), why: bi('Ожидание ревью на этом пути самое короткое, а улучшать начинают с самого долгого ожидания.', 'The wait for review is the shortest on the path. Improvement starts with the longest wait.') },
    ],
  },
  {
    id: 'method.q.path-order',
    kind: 'order',
    concepts: ['method.value-stream'],
    prompt: bi('Расставьте этапы пути изменения в магазине по порядку.', 'Put the stages of a change’s path in the shop in order.'),
    steps: [
      { id: 'select', text: bi('Отбор, на котором решили взяться за задачу и записали, что значит «готово»', 'Selection: decided to take it and what “done” means') },
      { id: 'dev', text: bi('Разработка', 'Development') },
      { id: 'review', text: bi('Ревью, то есть проверка кода коллегой', 'Review: a colleague checks the code'), why: bi('Ревью идёт сразу после разработки, потому что на нём проверяют код, а не работающий сайт.', 'Review comes right after development: it checks the code, not the working site.') },
      { id: 'test', text: bi('Проверка работы изменения', 'Testing') },
      { id: 'deploy', text: bi('Выкладка на рабочий сайт', 'Deployment to production') },
      { id: 'customers', text: bi('Изменение у покупателей', 'The change is with the customers'), why: bi('Только на этом этапе изменение начинает приносить ценность.', 'Only here does the change start to bring value.') },
    ],
  },
  // ── methodology.board ──
  {
    id: 'method.q.pull-why',
    kind: 'mcq',
    concepts: ['method.pull'],
    prompt: bi('Почему новую задачу лучше брать, когда для неё освободилось место, а не тогда, когда её выдали?', 'Why is it better to take a new task when there is room for it, rather than when it is handed out?'),
    options: [
      { id: 'pile', text: bi('Работа не копится там, где её не успевают делать, а ждёт в очереди, где ничего не стоит', 'Work does not pile up where nobody has time for it, and waits in a queue where it costs nothing'), correct: true },
      { id: 'lazy', text: bi('Человек, который сам выбирает момент для новой задачи, меньше устаёт, а отдохнувший человек реже ошибается', 'A person who picks the moment for a new task gets less tired, and a rested person makes fewer mistakes'), why: bi('Усталость, возможно, и уменьшится, но главное в том, что каждая задача проходит путь быстрее, а очереди становятся видны.', 'Tiredness may drop, but the point is the time of each task and the visibility of queues.') },
      { id: 'less', text: bi('Так команда делает меньше работы', 'The team does less work that way'), why: bi('Работы столько же. Меньше становится только переключений и одновременно начатых задач.', 'There is as much work; there is only less switching and less started at once.') },
    ],
  },
  {
    id: 'method.q.weinberg',
    kind: 'mcq',
    concepts: ['method.switching'],
    prompt: bi('Разработчик может сделать за день работу на 3 очка, а в работе у него 4 задачи. Сколько очков в день достаётся каждой задаче по таблице Вайнберга, если при четырёх задачах на полезную работу остаётся 40 % времени?', 'A developer’s capacity is 3 points a day. They have 4 tasks in progress. How many points a day does each get by Weinberg’s table (with four tasks 40% of the time is useful)?'),
    options: [
      { id: '0.3', text: bi('0,3', '0.3'), correct: true },
      { id: '0.75', text: bi('0,75', '0.75'), why: bi('Деление 3 / 4 = 0,75 не учитывает потерь на переключение. Сначала нужно найти полезную долю, 3 × 0,4 = 1,2, а потом разделить её на 4.', '3 / 4 = 0.75 ignores the switching loss. First the useful share: 3 × 0.4 = 1.2; then divide by 4.') },
      { id: '1.2', text: bi('1,2', '1.2'), why: bi('1,2 очка составляют полезную работу на все четыре задачи вместе, а каждой задаче достаётся четверть.', '1.2 is the useful capacity for all four tasks together. Each gets a quarter.') },
    ],
    explain: bi('3 × 0,4 / 4 = 0,3. Если бы разработчик вёл одну задачу, она получала бы все 3 очка.', '3 × 0.4 / 4 = 0.3. One task at a time would get all 3 points.'),
  },
  {
    id: 'method.q.board-visible',
    kind: 'multi',
    concepts: ['method.board'],
    prompt: bi('Что видно на доске с колонками по этапам и частями «в работе» и «готово», но не видно в общем чате задач? Отметьте всё верное.', 'What does a board with columns by stage and “doing / done” parts show that a group chat of tasks does not? Mark everything that is true.'),
    options: [
      { id: 'where', text: bi('На каком этапе находится каждая задача', 'At which stage each task is'), correct: true },
      { id: 'pile', text: bi('Где задачи скапливаются и ждут', 'Where tasks pile up and wait'), correct: true },
      { id: 'waiting', text: bi('Какие задачи закончены на этапе и ждут следующего', 'Which tasks are finished at a stage and wait for the next'), correct: true },
      { id: 'faster', text: bi('Доска сама ускоряет работу', 'The board itself speeds up the work'), why: bi('Доска ничего не ускоряет, она только показывает. Ускоряют работу решения, которые принимают, глядя на доску.', 'A board speeds nothing up; it shows. The decisions made by looking at it do the speeding up.') },
    ],
  },
  // ── methodology.flow ──
  {
    id: 'method.q.cycle-vs-lead',
    kind: 'mcq',
    concepts: ['method.cycle-time'],
    prompt: bi('Карточка появилась в колонке «готово к работе» 1-го числа, её начали 4-го и закончили 9-го. Каковы её время цикла и время выполнения, если дни считать включительно?', 'A card appeared in “ready” on the 1st, was started on the 4th and finished on the 9th. What are its cycle time and lead time (counting days inclusively)?'),
    options: [
      { id: 'ok', text: bi('Время цикла 6 дней, время выполнения 9 дней', 'Cycle 6 days, lead 9 days'), correct: true },
      { id: 'swap', text: bi('Время цикла 9 дней, время выполнения 6 дней', 'Cycle 9 days, lead 6 days'), why: bi('Здесь величины перепутаны. Время цикла отсчитывают от начала работы, то есть от 4-го числа, а время выполнения от появления карточки в очереди, то есть от 1-го.', 'Swapped: cycle time starts at the start of work (the 4th), lead time at entering the queue (the 1st).') },
      { id: 'excl', text: bi('Время цикла 5 дней, время выполнения 8 дней', 'Cycle 5 days, lead 8 days'), why: bi('Так получается, если не считать дни включительно. На доске дни считают включительно, поэтому у карточки, которую начали и закончили в один день, время цикла равно одному дню.', 'That excludes a day: on the board days are counted inclusively, and a card started and finished on the same day has a cycle time of 1.') },
    ],
  },
  {
    id: 'method.q.wip-limit-count',
    kind: 'mcq',
    concepts: ['method.wip'],
    prompt: bi('У колонки «Проверка» лимит WIP равен 3. В её части «в работе» две карточки, в части «готово» одна. Можно ли вытянуть в проверку ещё одну карточку?', 'The Testing column has a WIP limit of 3. Its “doing” part holds two cards, its “done” part one. May one more card be pulled into testing?'),
    options: [
      { id: 'no', text: bi('Нет, потому что лимит считает обе части колонки, а в ней уже три карточки', 'No: the limit counts both parts of the column, and it already holds 3'), correct: true },
      { id: 'yes', text: bi('Да, ведь в работе только две карточки, а третья в части «готово» уже закончена и лимит больше не занимает', 'Yes: only two are in progress, and the third card in “done” is already finished and no longer counts'), why: bi('Карточка в части «готово» тоже не завершена, потому что до покупателя она ещё не дошла. Если её не считать, работа начнёт копиться в «готово».', 'A card in the “done” part is also unfinished: it has not reached the customer yet. Not counting it lets work pile up in “done”.') },
    ],
    explain: bi('Чтобы освободить место, следующая колонка должна вытянуть карточку из части «готово».', 'To free a place, the next column has to pull the card out of “done”.'),
  },
  {
    id: 'method.q.age',
    kind: 'mcq',
    concepts: ['method.throughput'],
    prompt: bi('Обычно карточки команды проходят путь за 5 дней, а одна начатая карточка находится в работе уже 9 дней. Какая метрика это показывает и что делать?', 'The team’s cards usually take 5 days. One started card has been in progress for 9 days. Which metric shows this and what should be done?'),
    options: [
      { id: 'age', text: bi('Возраст карточки, и вмешаться нужно сейчас, то есть помочь, разбить задачу или убрать препятствие', 'Work item age: step in now — help, split it, remove the blocker'), correct: true },
      { id: 'cycle', text: bi('Время цикла, и нужно дождаться, пока карточка закончится, а потом учесть её в статистике', 'Cycle time: wait until it finishes and count it in the statistics'), why: bi('Время цикла станет известно только в конце. Возраст виден каждый день, и этим он полезен, потому что по нему можно действовать заранее.', 'Cycle time is known only at the end. Age is visible every day, which is why it is useful: you can act on it in advance.') },
      { id: 'th', text: bi('Пропускная способность, и это значит, что команда стала работать медленнее', 'Throughput: the team got slower'), why: bi('Одна застрявшая карточка почти не меняет пропускную способность, а вопрос касается одной этой карточки.', 'One stuck card barely changes throughput. This is about a particular card.') },
    ],
  },
  // ── methodology.little ──
  {
    id: 'method.q.little-calc',
    kind: 'mcq',
    concepts: ['method.little'],
    key: true,
    prompt: bi('У команды в работе в среднем 12 карточек, а заканчивает она в среднем 3 карточки в день. Каково среднее время цикла?', 'The team has 12 cards in progress on average and finishes 3 a day on average. What is the average cycle time?'),
    options: [
      { id: '4', text: bi('4 дня', '4 days'), correct: true },
      { id: '36', text: bi('36 дней', '36 days'), why: bi('Здесь WIP умножили на пропускную способность. По закону Литтла WIP равно пропускной способности, умноженной на время, значит, время равно WIP, делённому на пропускную способность.', 'WIP and throughput were multiplied. By Little’s law WIP = throughput × time, so time = WIP / throughput.') },
      { id: '0.25', text: bi('0,25 дня', '0.25 days'), why: bi('Здесь разделили в обратную сторону, 3 / 12. Проверьте единицы измерения, и вы увидите, что карточки, делённые на карточки в день, дают дни.', 'The division the wrong way round: 3 / 12. Check the units: cards / (cards per day) = days.') },
    ],
    explain: bi('12 / 3 = 4 дня. Если начатой работы вдвое больше при той же пропускной способности, каждая карточка идёт вдвое дольше.', '12 / 3 = 4 days. Twice as much started work at the same throughput means twice as long.'),
  },
  {
    id: 'method.q.little-unstable',
    kind: 'mcq',
    concepts: ['method.little'],
    prompt: bi('По закону Литтла время цикла должно быть 6 дней, а по законченным карточкам выходит 11. При этом WIP всё время растёт. Почему цифры не сходятся?', 'By Little’s law cycle time should be 6 days, but the finished cards show 11. WIP keeps growing. Why does it not match?'),
    options: [
      { id: 'unstable', text: bi('Система нестабильна, потому что начинают больше, чем заканчивают, и условия закона не выполнены', 'The system is unstable: more is started than finished, and the law’s conditions do not hold'), correct: true },
      { id: 'wrong', text: bi('Закон Литтла выведен для очередей в магазинах и на заводах, а для разработки, где задачи разного размера, он не работает', 'Little’s law was derived for queues in shops and factories and does not work for development, where tasks differ in size'), why: bi('Закон работает, если выполнены его условия. Когда WIP растёт, нарушено условие, что в начале и в конце периода незавершённой работы примерно поровну.', 'It works, under its conditions. When WIP grows, the condition “about the same WIP at the start and the end of the period” is broken.') },
      { id: 'calc', text: bi('Кто-то ошибся в подсчёте', 'A counting mistake'), why: bi('Расхождение не случайно. Растущий WIP означает, что карточки стареют, и время цикла у завтрашних карточек будет ещё больше.', 'The gap is not random: a growing WIP means cards age, and the cycle time of tomorrow’s cards will be even longer.') },
    ],
  },
  {
    id: 'method.q.cfd-band',
    kind: 'mcq',
    concepts: ['method.cfd'],
    prompt: bi('На накопительной диаграмме полоса «Проверка» с 8-го дня становится всё шире, а граница «готово» почти горизонтальна. Что это значит?', 'On the cumulative flow diagram the Testing band keeps widening from day 8, and the “done” edge is almost flat. What does it mean?'),
    options: [
      { id: 'test', text: bi('Проверка не успевает, поэтому работа копится в ней и почти не доходит до покупателей', 'Testing cannot keep up: work piles up in it and barely reaches the customers'), correct: true },
      { id: 'dev', text: bi('Разработка отдаёт в проверку сырой код, поэтому тестировщики раз за разом возвращают карточки и полоса растёт', 'Development hands raw code to testing, so the testers keep sending cards back and the band grows'), why: bi('Разработка как раз исправно поставляет работу, иначе полосе проверки нечем было бы расширяться. А карточки, которые вернули на доработку, ушли бы из полосы проверки обратно в разработку.', 'Development is delivering work: otherwise the Testing band would have nothing to widen with. Cards sent back for rework would leave the Testing band for Development.') },
      { id: 'good', text: bi('Проверка делает много, и это хорошо', 'Testing does a lot — that is good'), why: bi('Ширина полосы показывает, сколько работы в ней лежит, а не сколько сделано. Сделанная работа ушла бы в «готово».', 'The width of a band is how much lies in it, not how much it did. What is done would move to “done”.') },
    ],
  },
  {
    id: 'method.q.percentile',
    kind: 'mcq',
    concepts: ['method.percentile'],
    prompt: bi('Вот времена цикла 20 последних карточек по возрастанию: 2 2 3 3 3 4 4 4 5 5 5 6 6 7 7 8 9 11 12 15. Какой срок можно обещать с уверенностью 85 %?', 'Cycle times of the last 20 cards, ascending: 2 2 3 3 3 4 4 4 5 5 5 6 6 7 7 8 9 11 12 15. Which time can be promised with 85% confidence?'),
    options: [
      { id: '9', text: bi('9 дней', '9 days'), correct: true },
      { id: '5', text: bi('5 дней, то есть медиану', '5 days — the median'), why: bi('Медиана стоит в середине ряда, и половина карточек идёт дольше неё. Обещание по медиане будет нарушено в каждом втором случае.', 'That is the middle of the series: half the cards take longer. A promise by the median is broken every second time.') },
      { id: '15', text: bi('15 дней, то есть максимум', '15 days — the maximum'), why: bi('Максимум слишком осторожен и зависит от одного случая. 85-й процентиль равен семнадцатому значению из двадцати.', 'The maximum is too cautious and depends on one case. The 85th percentile is the seventeenth value of twenty.') },
    ],
  },
  // ── methodology.bottleneck ──
  {
    id: 'method.q.five-steps',
    kind: 'order',
    concepts: ['method.five-steps'],
    prompt: bi('Расставьте пять шагов фокусирования Голдратта по порядку.', 'Put Goldratt’s five focusing steps in order.'),
    steps: [
      { id: 'find', text: bi('Найти узкое место', 'Identify the constraint') },
      { id: 'exploit', text: bi('Использовать его полностью', 'Exploit it') },
      { id: 'sub', text: bi('Подчинить ему всё остальное', 'Subordinate everything else to it'), why: bi('Подчинение идёт раньше расширения, потому что почти ничего не стоит и часто само снимает проблему.', 'Subordination comes before elevation: it is almost free and often removes the problem.') },
      { id: 'elevate', text: bi('Расширить узкое место', 'Elevate it'), why: bi('Расширение, то есть найм людей, покупка оборудования или автоматические проверки, обходится дорого, поэтому оно стоит четвёртым.', 'Elevation — hiring people, buying equipment, building automatic checks — is expensive, which is why it is fourth.') },
      { id: 'repeat', text: bi('Повторить, потому что узкое место сместилось', 'Repeat: the constraint has moved') },
    ],
  },
  {
    id: 'method.q.faster-dev',
    kind: 'mcq',
    concepts: ['method.bottleneck'],
    prompt: bi('Разработку ускорили вдвое, а до покупателей доходит столько же задач, сколько раньше. Почему?', 'Development was made twice as fast, yet as many tasks reach the customers as before. Why?'),
    options: [
      { id: 'bn', text: bi('Узкое место не в разработке. Сколько задач доходит до покупателей, задаёт самый медленный этап, а лишняя работа копится перед ним', 'Development is not the bottleneck: the slowest stage sets the output, and extra work piles up in front of it'), correct: true },
      { id: 'lazy', text: bi('Разработчики стали работать хуже', 'The developers started to work worse'), why: bi('Разработчики делают вдвое больше, только эта работа ждёт в очереди перед медленным этапом.', 'They produce twice as much; that work simply waits in the queue before the slow stage.') },
      { id: 'time', text: bi('Нужно подождать, потому что ускоренная разработка сначала наполняет очереди на следующих этапах, а до покупателей эффект дойдёт позже', 'Wait: a faster development stage first fills the queues of the later stages, and the effect will reach the customers later'), why: bi('Пока узкое место остаётся прежним, эффекта не будет, а очередь перед ним будет только расти.', 'While the bottleneck stays the same, there will be no effect: the queue in front of it will only grow.') },
    ],
  },
  {
    id: 'method.q.tester-dilemma',
    kind: 'mcq',
    concepts: ['method.swarming', 'method.five-steps'],
    key: true,
    prompt: bi('Тестировщик в команде один и не успевает, а разработчики свободны. Что сделать в первую очередь?', 'There is one tester who cannot keep up, and the developers are free. What should be done first?'),
    options: [
      { id: 'help', text: bi('Разработчики помогают проверять и не начинают новых функций', 'The developers help with testing and do not start new features'), correct: true },
      { id: 'new', text: bi('Разработчики берут новые функции, чтобы не простаивать', 'The developers take new features so as not to sit idle'), why: bi('Новые функции лягут в очередь перед проверкой, поэтому время цикла вырастет, а до покупателей будет доходить столько же задач, сколько раньше.', 'New features go into the queue before testing: cycle time grows, output does not.') },
      { id: 'hire', text: bi('Нанять второго тестировщика', 'Hire a second tester'), why: bi('Так тоже можно, но это шаг «расширить», дорогой и медленный. Сначала нужно «использовать» и «подчинить».', 'Acceptable, but it is the “elevate” step — expensive and slow. First “exploit” and “subordinate”.') },
      { id: 'limit', text: bi('Увеличить лимит колонки «Проверка»', 'Raise the limit of the Testing column'), why: bi('Если увеличить лимит, очередь станет длиннее, а тестировщик быстрее не станет. Такое решение только прячет проблему.', 'A higher limit means a longer queue; the tester does not get faster. It hides the problem.') },
    ],
  },
  // ── methodology.batch ──
  {
    id: 'method.q.cd3',
    kind: 'mcq',
    concepts: ['method.cod'],
    prompt: bi('У функции A стоимость задержки 10 000 рублей в неделю, а работы на 2 недели. У функции B стоимость задержки 6 000 рублей в неделю, а работы на 1 неделю. Что делать первым, если выбирать по CD3?', 'Feature A: cost of delay 10,000 ₽ a week, 2 weeks of work. Feature B: 6,000 ₽ a week, 1 week of work. What goes first by CD3?'),
    options: [
      { id: 'b', text: bi('Функцию B, потому что её CD3 равен 6 000, а у A он равен 5 000', 'Feature B, because its CD3 is 6,000, while A’s is 5,000'), correct: true },
      { id: 'a', text: bi('Функцию A, потому что у неё выше стоимость задержки', 'Feature A, because its cost of delay is higher'), why: bi('Стоимость задержки нужно делить на длительность. Пока две недели делают A, магазин недополучает от функции B 12 000 рублей, а пока неделю делают B, он недополучает от функции A 10 000.', 'The cost of delay must be divided by the duration. While A is built (2 weeks), B loses 12,000; while B is built (1 week), A loses 10,000.') },
      { id: 'same', text: bi('Порядок не имеет значения', 'It does not matter'), why: bi('На одной паре функций разница составляет 2 000 рублей, а в потоке из десятков карточек от порядка зависит многое.', 'The difference is 2,000 ₽ for one pair; over a flow of dozens of cards the order decides a lot.') },
    ],
  },
  {
    id: 'method.q.batch-why',
    kind: 'multi',
    concepts: ['method.batch'],
    prompt: bi('Почему одна выкладка из 20 изменений хуже, чем 20 выкладок по одному изменению? Отметьте всё верное.', 'Why is one deployment of 20 changes worse than 20 deployments of one? Mark everything that is true.'),
    options: [
      { id: 'risk', text: bi('Выше риск, что выкладка сломает сайт', 'The risk that the deployment breaks the site is higher'), correct: true },
      { id: 'find', text: bi('Если сайт сломался, дольше искать, какое изменение виновато', 'If it breaks, finding the faulty change takes longer'), correct: true },
      { id: 'wait', text: bi('Первые изменения дольше ждут, пока наберётся партия', 'The first changes wait longer for the batch to fill'), correct: true },
      { id: 'cost', text: bi('Одна выкладка всегда дешевле двадцати, значит, большая партия лучше', 'One deployment is always cheaper than twenty, so the big batch is better'), why: bi('Так бывает, только пока выкладка ручная и дорогая. Когда выкладку делает машина, она почти ничего не стоит, и этот довод пропадает.', 'That holds only while a deployment is manual and expensive. When a machine does the deployment it is almost free, and the argument disappears.') },
    ],
  },
  {
    id: 'method.q.batch-first',
    kind: 'mcq',
    concepts: ['method.batch'],
    prompt: bi('Двадцать монет проходят через четыре человека, и каждый переворачивает монету за время t. Если монеты передают по двадцать, покупатель получает первую через 80t. Когда он получит первую монету, если монеты передают по одной?', 'Twenty coins, four stations, each flips a coin in t. When does the customer get the first coin with a batch of 1, if with a batch of 20 it takes 80t?'),
    options: [
      { id: '4t', text: '4t', correct: true },
      { id: '20t', text: '20t', why: bi('За 20t первая монета доходит при партии из пяти монет, ведь каждый из четырёх человек должен перевернуть все пять.', '20t is the first coin with a batch of 5: a batch of five has to be flipped at each of the four stations.') },
      { id: '80t', text: '80t', why: bi('Люди работают с той же скоростью, но первой монете больше не нужно ждать у каждого человека остальные девятнадцать.', 'People work at the same speed, but the first coin does not wait for the other nineteen at each station.') },
    ],
  },
  // ── methodology.agile ──
  {
    id: 'method.q.scrum-commitments',
    kind: 'match',
    concepts: ['method.scrum'],
    prompt: bi('Сопоставьте артефакт Scrum и его обязательство.', 'Match each Scrum artifact with its commitment.'),
    pairs: [
      { id: 'pb', left: bi('Бэклог продукта', 'Product Backlog'), right: bi('Цель продукта', 'Product Goal') },
      { id: 'sb', left: bi('Бэклог спринта', 'Sprint Backlog'), right: bi('Цель спринта', 'Sprint Goal') },
      { id: 'inc', left: bi('Инкремент', 'Increment'), right: bi('Определение готовности', 'Definition of Done'), why: bi('Инкремент считается сделанным только тогда, когда он отвечает определению готовности.', 'An Increment counts as done only when it meets the Definition of Done.') },
    ],
  },
  {
    id: 'method.q.scrum-master',
    kind: 'mcq',
    concepts: ['method.scrum'],
    prompt: bi('Чем Scrum-мастер отличается от руководителя, который раздаёт задачи?', 'How does a Scrum Master differ from a manager who hands out tasks?'),
    options: [
      { id: 'scrum', text: bi('Он отвечает за то, чтобы Scrum работал, а не за распределение задач, а как делать работу, решают сами разработчики', 'They are accountable for Scrum working, not for assigning tasks: the Developers decide how to do the work'), correct: true },
      { id: 'same', text: bi('Ничем, это лишь новое название руководителя', 'No difference, it is a new name for a manager'), why: bi('По Scrum Guide иерархии в команде нет, и разработчики сами решают, как превратить бэклог в инкремент.', 'By the Scrum Guide the team has no hierarchy, and the Developers themselves decide how to turn the backlog into an Increment.') },
      { id: 'po', text: bi('Он решает, какие функции важнее для продукта, выстраивает по ним бэклог и говорит команде, что брать в работу первым', 'They decide which features matter most for the product, order the backlog by them and tell the team what to take first'), why: bi('Решать, что важнее для продукта, должен владелец продукта, потому что он отвечает за то, чтобы продукт приносил как можно больше ценности, и за порядок бэклога.', 'That is the Product Owner’s accountability: maximising the value of the product and ordering the backlog.') },
    ],
  },
  {
    id: 'method.q.scrum-wip',
    kind: 'mcq',
    concepts: ['method.scrum', 'method.kanban'],
    prompt: bi('Может ли Scrum-команда ограничивать незавершённую работу внутри спринта?', 'May a Scrum Team limit work in progress inside a Sprint?'),
    options: [
      { id: 'yes', text: bi('Да, может, потому что Scrum и Kanban совместимы, и это описано в Kanban Guide for Scrum Teams', 'Yes, it can, because Scrum and Kanban are compatible, as described in the Kanban Guide for Scrum Teams'), correct: true },
      { id: 'no', text: bi('Нет, в Scrum лимитом служит сам спринт', 'No: in Scrum the limit is the Sprint itself'), why: bi('Спринт ограничивает работу по времени, но не мешает ограничить её ещё и по числу карточек.', 'A Sprint limits work by time but does not prevent limiting it by the number of cards as well.') },
    ],
  },
  {
    id: 'method.q.sle',
    kind: 'mcq',
    concepts: ['method.kanban', 'method.percentile'],
    prompt: bi('Что Kanban Guide называет ожиданием уровня обслуживания (SLE)?', 'What is a service level expectation (SLE) in the Kanban Guide?'),
    options: [
      { id: 'sle', text: bi('Прогноз того, за сколько единица работы должна пройти путь, например «85 % карточек за 8 дней или быстрее»', 'A forecast of how long a work item should take to get through, for example “85% in 8 days or less”'), correct: true },
      { id: 'sla', text: bi('Договор с клиентом, в котором записаны сроки выполнения заявок и штрафы, которые команда платит, если не уложилась в эти сроки', 'A contract with a client that sets deadlines for requests and the penalties the team pays when it misses them'), why: bi('Такой договор ближе к соглашению об уровне услуг. А SLE служит внутренним прогнозом команды, который строят по истории времени цикла.', 'That is closer to a service level agreement. An SLE is the team’s internal forecast based on cycle time history.') },
      { id: 'avg', text: bi('Среднее время цикла', 'The average cycle time'), why: bi('Среднее не годится для обещаний, потому что примерно половина карточек идёт дольше. SLE строят по процентилю.', 'An average is no good for promises: about half the cards take longer. An SLE is built on a percentile.') },
    ],
  },
  // ── methodology.work-types ──
  {
    id: 'method.q.work-sort',
    kind: 'match',
    concepts: ['method.work-types'],
    prompt: bi('Сопоставьте работу и её тип.', 'Match the work with its type.'),
    pairs: [
      { id: 'bp', left: bi('Новая страница скидок', 'A new discount page'), right: bi('бизнес-проект', 'business project') },
      { id: 'ip', left: bi('Переезд сайта на новый сервер', 'Moving the site to a new server'), right: bi('внутренний проект', 'internal project') },
      { id: 'ch', left: bi('Продление договора хостинга по графику', 'Renew the hosting contract on schedule'), right: bi('изменение', 'change'), why: bi('Продление договора по графику относится к плановой текущей работе. Если бы договор уже истёк и сайт перестал работать, продление стало бы незапланированной работой.', 'Planned routine work. Had the contract already expired and the site gone down, it would have become unplanned work.') },
      { id: 'up', left: bi('Сайт не открывается у покупателей', 'The site does not open for customers'), right: bi('незапланированная работа', 'unplanned work') },
    ],
  },
  {
    id: 'method.q.toil-signs',
    kind: 'multi',
    concepts: ['method.toil'],
    prompt: bi('Какие признаки делают работу рутиной (toil) по книге Google «Site Reliability Engineering»? Отметьте всё верное.', 'Which signs make work toil according to Google’s “Site Reliability Engineering” book? Mark everything that is true.'),
    options: [
      { id: 'manual', text: bi('Работа ручная и повторяется', 'Manual and repetitive'), correct: true },
      { id: 'grows', text: bi('Работа растёт вместе с сервисом', 'Grows with the service'), correct: true },
      { id: 'novalue', text: bi('Работа не оставляет долговременной пользы', 'Leaves no enduring value'), correct: true },
      { id: 'boring', text: bi('Работа скучная', 'Boring'), why: bi('Скука признаком рутины не считается. Если один и тот же интересный сбой каждый раз разбирают вручную, а этот разбор можно автоматизировать, такая работа тоже рутина.', 'Boredom is not a sign. Handling an interesting outage by hand every time is toil too, if it can be automated.') },
      { id: 'meetings', text: bi('Совещания и планирование', 'Meetings and planning'), why: bi('Совещания и планирование относятся к накладным расходам, а не к рутине, потому что с ростом числа покупателей их не становится больше.', 'That is overhead, not toil: it does not grow linearly with the number of customers.') },
    ],
  },
  {
    id: 'method.q.hire-vs-automate',
    kind: 'mcq',
    concepts: ['method.toil', 'method.automation'],
    prompt: bi('Эксплуатация тратит 70 % времени на то, чтобы вручную выдавать доступы. Почему нанять второго инженера было бы слабым решением?', 'Operations spends 70% of its time granting access by hand. Why is hiring a second engineer a weak decision?'),
    options: [
      { id: 'grows', text: bi('Рутина растёт вместе с сервисом и со временем займёт обоих, а скрипт снял бы её навсегда', 'Toil grows with the service: in time there will be enough for two, while a script would remove it for good'), correct: true },
      { id: 'money', text: bi('Потому что это дорого', 'Because it is expensive'), why: bi('Деньги важны, но главное в том, что новый человек тоже будет выдавать доступы вручную, а просьб станет больше.', 'Money matters, but the point is that the new person will also grant access by hand, and requests will grow.') },
      { id: 'never', text: bi('В эксплуатацию никогда не нужно нанимать людей, потому что любую её работу со временем заберут программы', 'Operations should never hire people at all, because sooner or later programs will take over every part of its work'), why: bi('Нанимать людей иногда нужно. Но на рутину отвечают автоматизацией, иначе новый человек утонет в ней точно так же.', 'Hiring is sometimes needed. But toil is answered with automation; otherwise the new person drowns in it the same way.') },
    ],
  },
  // ── methodology.pipeline ──
  {
    id: 'method.q.ci-cd-match',
    kind: 'match',
    concepts: ['method.ci', 'method.cdelivery', 'method.cdeployment'],
    key: true,
    prompt: bi('Сопоставьте описание процесса команды и практику.', 'Match the description of a team’s process with the practice.'),
    pairs: [
      { id: 'ci', left: bi('Все каждый день сливают изменения в общую ветку, каждое слияние собирается и проверяется, а на рабочий сайт изменения выкладывают вручную раз в квартал', 'Everyone merges into the shared branch daily, each merge is built and tested; production is deployed by hand once a quarter'), right: bi('только непрерывная интеграция', 'continuous integration only'), why: bi('Интеграция есть, но изменение не готово к выкладке в любой момент, потому что выкладка превращается в ручной проект раз в квартал.', 'Integration is there, but a change is not ready to release at any moment: deployment is a quarterly manual project.') },
      { id: 'cdel', left: bi('Каждое проверенное изменение можно в любой момент выложить на рабочий сайт одной кнопкой', 'Every checked change can be deployed to production at any moment with one button'), right: bi('непрерывная доставка', 'continuous delivery') },
      { id: 'cdep', left: bi('Каждое изменение, прошедшее проверки, уходит на рабочий сайт само', 'Every change that passed the checks goes to production by itself'), right: bi('непрерывное развёртывание', 'continuous deployment'), why: bi('От доставки эта практика отличается тем, что на последнем шаге нет решения человека.', 'The difference from delivery: no manual decision at the last step.') },
    ],
  },
  {
    id: 'method.q.release-branch',
    kind: 'mcq',
    concepts: ['method.ci'],
    prompt: bi('Каждый в команде работает в своей ветке по три недели, а на каждое обновление ветки автоматически запускаются тесты. Это непрерывная интеграция?', 'The team works in their own branches for three weeks, and tests run automatically on every update of a branch. Is this continuous integration?'),
    options: [
      { id: 'no', text: bi('Нет, потому что изменения не сливают в общую ветку хотя бы раз в день', 'No: changes are not merged into the shared branch at least daily'), correct: true },
      { id: 'yes', text: bi('Да, ведь тесты запускаются автоматически на каждое обновление ветки, и сломанный код сразу виден ещё до слияния', 'Yes: tests run automatically on every update of a branch, so broken code shows up before any merge'), why: bi('Автотесты составляют только половину дела. Интеграция означает частое слияние в общую ветку, а слияние через три недели будет болезненным.', 'Automated tests are only half. Integration means merging into the shared branch often; after three weeks the merge will hurt.') },
    ],
  },
  {
    id: 'method.q.red-build',
    kind: 'bugfind',
    concepts: ['method.ci'],
    prompt: bi('Перед вами договорённость команды о непрерывной интеграции. Она записана коротким списком правил на английском, по одному правилу в строке, как её могли бы записать в файле настроек. Какая строка лишает договорённость смысла?', 'This is a team’s working agreement on continuous integration. Which line breaks its point?'),
    lang: 'yaml',
    code: 'integration:\n  merge_to_main: at_least_daily\n  on_every_merge: [build, unit_tests]\n  when_build_is_red: keep_merging   # we fix it on Friday\n  when_build_is_green: deploy_to_staging',
    bug: [4],
    why: {
      1: bi('Первая строка — заголовок договорённости, и в ней ничего не нарушено.', 'The heading of the agreement; nothing is broken here.'),
      2: bi('Сливать изменения хотя бы раз в день требует само определение непрерывной интеграции.', 'Merging at least daily is the core of the definition.'),
      3: bi('Каждое слияние собирается и проверяется, так и должно быть.', 'Every merge is built and tested, as it should be.'),
      4: bi('Непрошедшую проверку чинят первым делом. Если продолжать сливать изменения поверх сломанной проверки, ошибки накапливаются, и уже непонятно, какое изменение что сломало.', 'A red build is fixed first. Merging on top of red piles up mistakes until nobody can tell which change broke what.'),
      5: bi('Выкладка на стенд после успешной проверки уже относится к шагам конвейера на пути к непрерывной доставке.', 'Deploying to staging after a green build is already a pipeline step towards delivery.'),
    },
  },
  {
    id: 'method.q.pipeline-order',
    kind: 'order',
    concepts: ['method.pipeline'],
    prompt: bi('Расставьте шаги конвейера развёртывания по порядку.', 'Put the steps of a deployment pipeline in order.'),
    steps: [
      { id: 'merge', text: bi('Изменение слито в общую ветку', 'The change is merged into the shared branch') },
      { id: 'build', text: bi('Автоматическая сборка', 'Automated build') },
      { id: 'tests', text: bi('Автотесты', 'Automated tests'), why: bi('На этом шаге заканчивается непрерывная интеграция.', 'Continuous integration ends here.') },
      { id: 'staging', text: bi('Выкладка на стенд', 'Deployment to staging') },
      { id: 'check', text: bi('Проверки на стенде', 'Checks on staging') },
      { id: 'prod', text: bi('Выкладка на рабочий сайт', 'Deployment to production'), why: bi('Выкладка на рабочий сайт идёт последней, потому что до покупателей должно дойти только то, что уже собрано, прошло автотесты и проверено на стенде. На стенд изменение выкладывают тем же способом, каким потом выложат на рабочий сайт, поэтому к последнему шагу проверена и сама выкладка.', 'Deployment to production comes last, because only what is already built, passed the automated tests and was checked on staging may reach the customers. Staging is deployed the same way production will be, so by the last step the deployment itself has been checked too.') },
    ],
  },
  // ── methodology.dora ──
  {
    id: 'method.q.dora-groups',
    kind: 'multi',
    concepts: ['method.dora'],
    prompt: bi('Какие метрики DORA относятся к группе нестабильности? Отметьте всё верное.', 'Which DORA metrics belong to the instability group? Mark everything that is true.'),
    options: [
      { id: 'cfr', text: bi('Доля неудачных изменений', 'Change fail rate'), correct: true },
      { id: 'rw', text: bi('Доля внеплановых развёртываний', 'Deployment rework rate'), correct: true },
      { id: 'df', text: bi('Частота развёртываний', 'Deployment frequency'), why: bi('Эта метрика относится к пропускной способности доставки, потому что она показывает, как часто изменения доходят до рабочего сайта.', 'That is delivery throughput: how often changes reach production.') },
      { id: 'lt', text: bi('Время внесения изменения', 'Change lead time'), why: bi('Эта метрика относится к пропускной способности, потому что она показывает, как быстро готовое изменение доходит до рабочего сайта.', 'That is throughput: how fast a finished change reaches production.') },
      { id: 'rec', text: bi('Время восстановления после неудачного развёртывания', 'Failed deployment recovery time'), why: bi('С 2024 года DORA относит эту метрику к пропускной способности, потому что она показывает, как быстро команда возвращает рабочий сайт в строй.', 'Since 2024 DORA places it under throughput: it is the speed at which the team brings production back.') },
    ],
  },
  {
    id: 'method.q.dora-less-often',
    kind: 'mcq',
    concepts: ['method.dora', 'method.batch'],
    key: true,
    prompt: bi('Руководитель говорит: «Будем выкладываться реже, зато надёжнее». Что об этом говорят исследования DORA?', 'A manager: “We will deploy less often but more safely.” What does DORA research say about it?'),
    options: [
      { id: 'together', text: bi('У большинства команд скорость и стабильность растут вместе, потому что маленькие частые изменения проще выкладывать и откатывать', 'For most teams speed and stability go together: small frequent changes are easier to deploy and to roll back'), correct: true },
      { id: 'balance', text: bi('Нужно найти баланс между скоростью и стабильностью, потому что каждая лишняя выкладка добавляет риск, а каждая пропущенная задерживает ценность', 'One has to find a balance between speed and stability, because each extra deployment adds risk and each skipped one delays value'), why: bi('Мысль о балансе распространена, но ошибочна, потому что она предполагает, что скорость можно получить только ценой стабильности, и наоборот. Данные DORA показывают обратное, и если уменьшить партию, улучшаются обе группы метрик.', 'A common misconception: it assumes one is traded for the other. DORA data show the opposite: smaller batches improve both groups of metrics.') },
      { id: 'right', text: bi('Руководитель прав, потому что каждая выкладка несёт риск сбоя, и чем реже команда выкладывается, тем меньше сбоев увидят покупатели', 'The manager is right: every deployment carries a risk of an outage, so the fewer of them, the fewer outages the customers see'), why: bi('Чем реже выкладки, тем больше партия, а большая партия рискованнее. Сбоев может стать даже больше.', 'Fewer deployments mean bigger batches, and the risk of a big batch is higher. The number of outages may even grow.') },
    ],
  },
  {
    id: 'method.q.cfr-calc',
    kind: 'mcq',
    concepts: ['method.dora'],
    prompt: bi('За две недели прошло 10 плановых выкладок. После двух из них понадобился откат, после одной хотфикс. Какова доля неудачных изменений?', 'In two weeks there were 10 planned deployments. Two needed a rollback, one a hotfix. What is the change fail rate?'),
    options: [
      { id: '30', text: bi('30 %', '30%'), correct: true },
      { id: '20', text: bi('20 %', '20%'), why: bi('Хотфикс тоже считается немедленным вмешательством, поэтому неудачных выкладок три из десяти.', 'A hotfix is also immediate intervention. Three out of ten failed.') },
      { id: '27', text: bi('27 %', '27%'), why: bi('Так выходит, если поделить на 11 и посчитать хотфикс отдельной выкладкой. Но долю неудачных изменений считают от плановых выкладок, 3 / 10, а сам хотфикс попадёт в долю внеплановых развёртываний.', 'Dividing by 11 counts the hotfix as a deployment, but change fail rate is taken over the planned deployments: 3 / 10. The hotfix itself goes into the deployment rework rate.') },
    ],
  },
  {
    id: 'method.q.goodhart',
    kind: 'mcq',
    concepts: ['method.goodhart'],
    prompt: bi('Команде пообещали премию за 50 развёртываний в неделю. Что, скорее всего, произойдёт?', 'A team was promised a bonus for 50 deployments a week. What is most likely to happen?'),
    options: [
      { id: 'game', text: bi('Частоту накрутят пустыми или раздробленными выкладками, и показатель будет выглядеть отличным, хотя ценности не прибавится', 'The frequency gets inflated with empty or chopped-up deployments: the gauge is green, no value was added'), correct: true },
      { id: 'better', text: bi('Команда начнёт доставлять ценность быстрее, потому что премия подтолкнёт её разбивать работу на маленькие партии и чаще выкладывать готовое', 'The team will deliver value faster, because the bonus pushes it to split work into small batches and to ship finished work more often'), why: bi('Целью стало число выкладок, а не ценность, а самый дешёвый путь к такой цели состоит в том, чтобы выкладывать что угодно. Так и действует закон Гудхарта.', 'The target is the number of deployments, not value; the cheapest way to it is to deploy anything. That is Goodhart’s law.') },
    ],
  },
  // ── methodology.sre ──
  {
    id: 'method.q.nines',
    kind: 'mcq',
    concepts: ['method.error-budget'],
    key: true,
    prompt: bi('Цель доступности равна 99,9 % за 30 дней. Сколько минут полной недоступности она допускает?', 'The availability target is 99.9% over 30 days. How many minutes of full downtime does it allow?'),
    options: [
      { id: '43', text: bi('43,2 минуты', '43.2 minutes'), correct: true },
      { id: '4', text: bi('4,32 минуты', '4.32 minutes'), why: bi('Столько допускает цель 99,99 %, где на одну девятку больше. Каждая девятка уменьшает бюджет в десять раз.', 'That is for 99.99%, one more nine. Each nine cuts the budget tenfold.') },
      { id: '432', text: bi('432 минуты', '432 minutes'), why: bi('Столько допускает цель 99 %, потому что 1 % от 43 200 минут равен 432 минутам.', 'That is for 99%: 1% of 43,200 minutes.') },
    ],
    explain: bi('(1 − 0,999) × 30 × 24 × 60 = 43,2. Это около 10 минут в неделю.', '(1 − 0.999) × 30 × 24 × 60 = 43.2. That is about 10 minutes a week.'),
  },
  {
    id: 'method.q.bad-minutes',
    kind: 'mcq',
    concepts: ['method.error-budget'],
    prompt: bi('Сбой длился 20 минут, и всё это время не проходило 10 % запросов. Сколько плохих минут он забрал из бюджета, если SLO считают по запросам?', 'An outage lasted 20 minutes, and 10% of requests failed during all that time. How many bad minutes did it spend from a request-based SLO budget?'),
    options: [
      { id: '2', text: '2', correct: true },
      { id: '20', text: '20', why: bi('Так считают полный простой. Если SLO считают по запросам, бюджет тратится пропорционально доле ошибок, то есть 20 × 0,1.', 'That is how full downtime counts. A request-based SLO spends the budget in proportion to the error share: 20 × 0.1.') },
      { id: '0', text: '0', why: bi('Сайт работал, но 10 % запросов не прошли. Для этих покупателей случился сбой, и бюджет тратится.', 'The site was up, but 10% of requests failed: for those customers it was an outage, and the budget is spent.') },
    ],
  },
  {
    id: 'method.q.freeze',
    kind: 'mcq',
    concepts: ['method.error-budget'],
    key: true,
    prompt: bi('Бюджет ошибок за последние четыре недели израсходован на 90 %, но не превышен. Отдел маркетинга хочет завтра выложить большое изменение. Что говорит на этот счёт пример политики из SRE Workbook?', 'The error budget for the last four weeks is 90% spent but not exceeded. Marketing wants a big change deployed tomorrow. What does the example policy in the SRE Workbook say?'),
    options: [
      { id: 'ok', text: bi('Политика выкладку не запрещает, потому что выпуски останавливают, только когда бюджет превышен', 'The policy does not forbid it: releases stop only when the budget is exceeded'), correct: true },
      { id: 'stop', text: bi('Нужно остановить все выпуски, ведь бюджет почти кончился', 'Stop all releases: the budget is almost gone'), why: bi('Выпуски замораживают, когда бюджет за четыре недели превышен, а не когда он почти кончился. Быть осторожнее разумно, но политика этого не требует.', 'The freeze condition is the budget being exceeded over the window, not “almost”. Caution is reasonable, but the policy does not require it.') },
      { id: 'p0', text: bi('Разрешены только исправления проблем P0 и исправления безопасности', 'Only P0 and security fixes are allowed'), why: bi('Исправления P0 и исправления безопасности служат исключениями из заморозки, а заморозка начинается только тогда, когда бюджет превышен.', 'These are the exceptions to a freeze, and a freeze starts when the budget is exceeded.') },
    ],
  },
  {
    id: 'method.q.slo-sla',
    kind: 'mcq',
    concepts: ['method.slo'],
    prompt: bi('Чем SLO отличается от SLA?', 'How does an SLO differ from an SLA?'),
    options: [
      { id: 'contract', text: bi('SLO задаёт внутреннюю цель команды, а SLA содержит обещание клиенту по договору с последствиями за нарушение. SLO обычно строже', 'An SLO is the team’s internal target; an SLA is a contractual promise to a client with consequences. The SLO is usually stricter'), correct: true },
      { id: 'same', text: bi('Это одно и то же', 'They are the same'), why: bi('Цель команды и договор с клиентом означают разные вещи. Если SLO нарушен, команда занимается надёжностью, а если нарушен SLA, клиенту платят штраф или возвращают деньги.', 'A target and a contract are different things: missing an SLO is a reason to work on reliability, breaking an SLA means a penalty or a refund.') },
      { id: 'sli', text: bi('SLO называет то, что мы измеряем, например долю успешных запросов, а SLA задаёт для этой величины цель, которую команда ставит себе сама', 'An SLO is what we measure, such as the share of successful requests, and an SLA is the target the team sets itself for that value'), why: bi('То, что мы измеряем, называется SLI, а SLO задаёт цель для SLI на определённый срок. SLA же означает обещание клиенту по договору.', 'What we measure is the SLI. The SLO is a target for the SLI over a window, and the SLA is a contractual promise to a client.') },
    ],
  },
  {
    id: 'method.q.burn',
    kind: 'mcq',
    concepts: ['method.burn-rate'],
    prompt: bi('SLO требует, чтобы за 30 дней успешно прошли 99,9 % запросов. За последний час израсходовано 2 % месячного бюджета ошибок. Какова скорость сжигания и что делать?', 'The SLO is 99.9% successful requests over 30 days. In the last hour 2% of the monthly error budget was spent. What is the burn rate and what to do?'),
    options: [
      { id: 'page', text: bi('14,4, и нужно срочное оповещение, которое разбудит дежурного', '14.4: page, wake the on-call engineer'), correct: true },
      { id: 'ticket', text: bi('2, и достаточно завести заявку в рабочей очереди', '2: open a ticket'), why: bi('Число 2 % показывает долю бюджета, а не скорость. Скорость равна доле бюджета, делённой на долю тридцатидневного окна, которая за это время прошла. Час составляет 1/720 от 30 дней, поэтому скорость равна 0,02 / (1/720) = 14,4.', '2% is a share of the budget, not the rate. The rate is the share of the budget divided by the share of the 30-day window that has passed. An hour is 1/720 of 30 days, so the rate is 0.02 / (1/720) = 14.4.') },
      { id: 'none', text: bi('0,02, и делать ничего не нужно', '0.02: do nothing'), why: bi('В таком темпе весь бюджет закончится за 50 часов вместо 30 дней.', 'At this pace the whole budget is gone in 50 hours instead of 30 days.') },
    ],
  },
  // ── methodology.incident ──
  {
    id: 'method.q.response-order',
    kind: 'order',
    concepts: ['method.incident-response'],
    prompt: bi('Расставьте шаги реагирования на инцидент по порядку.', 'Put the steps of incident response in order.'),
    steps: [
      { id: 'detect', text: bi('Оповещение сообщает, что сбой обнаружен', 'An alert reports that the outage is detected') },
      { id: 'ack', text: bi('Дежурный подтверждает оповещение', 'The on-call engineer acknowledges the page') },
      { id: 'status', text: bi('Первое сообщение о статусе в канале', 'The first status update in the channel'), why: bi('Статус пишут до диагностики, потому что люди должны знать, что сбоем занимаются, даже если причина ещё неизвестна.', 'The status goes before the diagnosis: people need to know the outage is being handled, even when the cause is unknown.') },
      { id: 'mitigate', text: bi('Смягчение с помощью отката', 'Mitigation: rollback') },
      { id: 'confirm', text: bi('Восстановление подтверждено по данным', 'Recovery confirmed by the data') },
      { id: 'pm', text: bi('Разбор без поиска виноватых', 'A blameless postmortem'), why: bi('Причину ищут после восстановления, потому что сначала покупатели должны снова получить возможность платить.', 'The cause is looked for after recovery: first the customers can pay again.') },
    ],
  },
  {
    id: 'method.q.blameless-rewrite',
    kind: 'mcq',
    concepts: ['method.postmortem'],
    key: true,
    prompt: bi('В черновике разбора написано: «Сбой произошёл, потому что разработчик невнимательно запустил скрипт миграции на рабочем сайте». Какая формулировка подходит для разбора без поиска виноватых?', 'The postmortem draft says: “The outage happened because a developer carelessly ran the migration script on production.” Which wording fits a blameless postmortem?'),
    options: [
      { id: 'cond', text: bi('Скрипт миграции можно запустить на рабочем сайте без подтверждения, а базы на стенде и на рабочем сайте называются одинаково', 'The migration script can run on production without confirmation, and the database names on staging and in production are the same'), correct: true },
      { id: 'soft', text: bi('Разработчик по ошибке запустил скрипт на рабочем сайте', 'A developer ran the script on production by mistake'), why: bi('Так звучит мягче, но причиной по-прежнему назван человек. Из этой фразы не следует ни одной задачи, кроме «быть внимательнее».', 'Softer, but a person is still the cause. No task follows from it except “be more careful”.') },
      { id: 'train', text: bi('Разработчика отправят на обучение работе с базами данных', 'The developer will be sent to a database course'), why: bi('Обучение направлено против человека, а не против условий, и следующий человек сделает ту же ошибку.', 'That is a measure against a person, not against the conditions: the next person will make the same mistake.') },
    ],
  },
  {
    id: 'method.q.what-visible',
    kind: 'mcq',
    concepts: ['method.postmortem'],
    prompt: bi('Почему на разборе спрашивают «что было видно в этот момент?», а не «почему вы ошиблись?»', 'Why does a review ask “what could be seen at that moment” rather than “why did you make a mistake”?'),
    options: [
      { id: 'data', text: bi('При тех данных, что были, решение казалось разумным, и такой вопрос помогает найти условия, которые нужно менять, а люди при этом продолжают рассказывать правду', 'The decision seemed reasonable given the data at hand; this finds the conditions to change, and people keep telling the truth'), correct: true },
      { id: 'polite', text: bi('Чтобы никого не обидеть', 'So as not to offend anyone'), why: bi('Вежливость здесь только побочный эффект, а цель состоит в том, чтобы получить информацию, потому что люди, которых обвиняют, замолкают.', 'Politeness is a side effect. The goal is information: blame makes people silent.') },
      { id: 'nobody', text: bi('Потому что во время сбоев никто не ошибается', 'Because nobody makes mistakes in outages'), why: bi('Ошибки случаются. Но если ошибку было легко сделать, её сделает и следующий человек, поэтому менять нужно условия.', 'Mistakes happen. But if a mistake was easy to make, the next person will make it too: the conditions must change.') },
    ],
  },
  {
    id: 'method.q.factors',
    kind: 'multi',
    concepts: ['method.postmortem'],
    prompt: bi('Какие пункты описывают способствующие факторы, а не оценивают людей? Отметьте всё верное.', 'Which items are contributing factors rather than judgements of people? Mark everything that is true.'),
    options: [
      { id: 'alert', text: bi('Оповещение пришло через 40 минут после начала сбоя', 'The alert arrived 40 minutes after the outage began'), correct: true },
      { id: 'rollback', text: bi('Откатывать изменения умеет только один человек', 'Only one person knows how to roll back'), correct: true },
      { id: 'confirm', text: bi('Скрипт на рабочем сайте запускается без подтверждения', 'The script runs on production without confirmation'), correct: true },
      { id: 'careless', text: bi('Дежурный был невнимателен', 'The on-call engineer was careless'), why: bi('Слово «невнимателен» оценивает человека. Способствующий фактор звучал бы так: «оповещение не отличало срочное от несрочного».', 'A judgement of a person. A factor would be: “the alert did not separate urgent from non-urgent”.') },
      { id: 'lazy', text: bi('Команда плохо тестирует', 'The team tests badly'), why: bi('Слова «плохо тестирует» оценивают команду, и из такой оценки не следует никакой задачи. Способствующий фактор звучал бы так: «нет автотеста на оформление заказа».', 'A judgement with no task in it. A factor: “there is no automated test of checkout”.') },
    ],
  },
  // ── methodology.culture ──
  {
    id: 'method.q.ways-match',
    kind: 'match',
    concepts: ['method.three-ways'],
    prompt: bi('Сопоставьте практику и путь из «Руководства по DevOps».', 'Match the practice with the Way from “The DevOps Handbook”.'),
    pairs: [
      { id: 'flow', left: bi('Лимиты WIP и маленькие партии', 'WIP limits and small batches'), right: bi('первый путь (поток)', 'the First Way (flow)') },
      { id: 'fb', left: bi('Автотесты и оповещения по бюджету ошибок', 'Automated tests and error-budget alerts'), right: bi('второй путь (обратная связь)', 'the Second Way (feedback)') },
      { id: 'learn', left: bi('Разборы без поиска виноватых и время на улучшения', 'Blameless postmortems and time for improvement'), right: bi('третий путь (обучение)', 'the Third Way (learning)') },
    ],
  },
  {
    id: 'method.q.calms',
    kind: 'match',
    concepts: ['method.calms'],
    prompt: bi('Сопоставьте букву CALMS и пример из этого блока.', 'Match each letter of CALMS with an example from this block.'),
    pairs: [
      { id: 'c', left: 'Culture', right: bi('общая цель разработки и эксплуатации', 'a shared goal of development and operations') },
      { id: 'a', left: 'Automation', right: bi('скрипт, который выдаёт доступы', 'an access-request script') },
      { id: 'l', left: 'Lean', right: bi('лимиты и маленькие партии', 'limits and small batches') },
      { id: 'm', left: 'Measurement', right: bi('время цикла и метрики DORA', 'cycle time and the DORA metrics') },
      { id: 's', left: 'Sharing', right: bi('инструкция для дежурного и работа в паре', 'a runbook and pairing') },
    ],
  },
  {
    id: 'method.q.devops-what',
    kind: 'mcq',
    concepts: ['method.devops', 'method.devops-engineer'],
    prompt: bi('В вакансии DevOps-инженера перечислены полтора десятка программ: для запуска приложений, для описания серверов кодом, для автоматической сборки и выкладки и для мониторинга. Какое утверждение о DevOps верно?', 'A DevOps engineer job ad lists about fifteen programs: for running applications, for describing servers as code, for automated builds and deployments and for monitoring. Which statement about DevOps is true?'),
    options: [
      { id: 'way', text: bi('DevOps — способ работы, при котором разработка и эксплуатация вместе отвечают за быстрые и надёжные изменения, а программы из вакансии помогают этого добиться', 'DevOps is a way of working in which development and operations together own fast and reliable changes, and the programs in the ad help to get there'), correct: true },
      { id: 'tools', text: bi('DevOps — набор инструментов, и чем больше программ из списка человек знает, тем лучше он владеет DevOps', 'DevOps is a set of tools, and the more programs from the list a person knows, the better they know DevOps'), why: bi('Программы в таких списках меняются каждые несколько лет, а задача остаётся прежней. Команда может пользоваться всеми программами из вакансии и при этом выкладывать изменения раз в квартал и искать виноватых после каждого сбоя, и DevOps у неё не будет. На собеседовании поэтому спрашивают не только, как работает программа, но и какое ожидание или какой риск в потоке ценности она убирает.', 'The programs in such lists change every few years, while the job stays the same. A team can use every program in the ad and still deploy once a quarter and look for someone to blame after every outage, and it will not have DevOps. That is why interviews ask not only how a program works but also which wait or which risk in the value stream it removes.') },
      { id: 'admin', text: bi('DevOps — новое название должности системного администратора, который умеет работать с Kubernetes', 'DevOps is a new name for the job of a system administrator who can work with Kubernetes'), why: bi('Должность DevOps-инженера существует, но сам DevOps — договорённость всей команды, а не обязанность одного человека. Kubernetes служит лишь одной из программ для запуска приложений, и многие команды работают по DevOps без него. В курсе Kubernetes идёт после блоков о Linux, о сетях и об упаковке приложений, потому что без них его устройство не понять, и начинать с него не нужно.', 'The DevOps engineer job exists, but DevOps itself is an agreement of the whole team, not one person’s duty. Kubernetes is just one of the programs for running applications, and many teams practise DevOps without it. In the course Kubernetes comes after the blocks on Linux, on networks and on packaging applications, because without them its design cannot be understood, and there is no need to start with it.') },
      { id: 'no-ops', text: bi('DevOps — это когда разработчики сами выкладывают изменения и дежурят, а эксплуатации больше нет', 'DevOps is when the developers deploy and go on call themselves, and operations is gone'), why: bi('Общая ответственность не отменяет работы эксплуатации: кто-то по-прежнему следит за серверами, бюджетом ошибок и оповещениями. Меняется другое: у разработки и эксплуатации появляется общая цель, а рутину и выкладки берёт на себя автоматизация.', 'Shared responsibility does not abolish operations work: someone still looks after the servers, the error budget and the alerts. What changes is that development and operations get a common goal, and automation takes over the toil and the deployments.') },
    ],
    explain: bi('Полное определение из этого урока говорит о методологии, общей ответственности и трёх путях. Программы появляются в нём только как средство: автоматизация служит одной из пяти опор CALMS.', 'The full definition in this lesson speaks of a methodology, shared responsibility and the Three Ways. Programs appear in it only as a means: automation is one of the five pillars of CALMS.'),
    refs: { lesson: 'methodology.culture' },
  },
  {
    id: 'method.q.westrum',
    kind: 'mcq',
    concepts: ['method.westrum'],
    prompt: bi('Тестировщик сообщил, что автотест оплаты завершается с ошибкой. Руководитель ответил: «Оформи заявку по шаблону, рассмотрим на комитете в четверг». Какой это тип культуры по Веструму?', 'A tester reported that the checkout test fails. The manager replied: “File a request using the template; the committee will look at it on Thursday.” Which type of culture is this by Westrum?'),
    options: [
      { id: 'bureau', text: bi('Бюрократическая', 'Bureaucratic'), correct: true },
      { id: 'patho', text: bi('Патологическая', 'Pathological'), why: bi('Новость не спрятали, и того, кто её принёс, не наказали, а пустили её по регламенту. Такой путь медленный, но не враждебный.', 'The news was not hidden and the messenger not punished; it was routed through procedure. Slow, but not hostile.') },
      { id: 'gen', text: bi('Генеративная', 'Generative'), why: bi('В генеративной культуре новость сразу ушла бы к тем, кто может её исправить.', 'In a generative culture the news would have gone at once to those who can fix it.') },
    ],
  },
  // ── questions about the learner's own runs on the board in the terminal ──
  {
    id: 'method.q.practice-wip',
    kind: 'mcq',
    concepts: ['method.wip', 'method.switching'],
    prompt: bi(
      'На доске в практике без лимитов за пять дней не закончилась ни одна задача, а в работе одновременно было в среднем 14 карточек. С лимитами «люди плюс один» те же четыре человека закончили шесть задач, и каждая прошла путь за три дня. Почему лимит ускорил работу, хотя мощность людей не изменилась?',
      'On the practice board without limits not one task was finished in five days, and on average 14 cards were in progress at once. With the limits “people plus one” the same four people finished six tasks, and each went through in three days. Why did the limit speed the work up, although people’s capacity did not change?',
    ),
    options: [
      { id: 'switch', text: bi('У каждого человека стало меньше карточек сразу, меньше времени уходило на переключение, и карточки доходили до конца', 'Each person had fewer cards at once, less time went on switching, and the cards got finished'), correct: true },
      { id: 'cap', text: bi('Лимит прибавил людям мощности', 'The limit gave people more capacity'), why: bi('Мощность в этом прогоне каждый день одна и та же, 3 очка у каждого человека. Изменилось только то, на сколько карточек эта мощность делилась.', 'Capacity in this run is the same every day, 3 points for each person. Only the number of cards it was split between changed.') },
      { id: 'drop', text: bi('Лимит убрал с доски лишние задачи', 'The limit removed the extra tasks from the board'), why: bi('Задачи никуда не делись: они ждали в очереди слева, пока для них освободится место. Ожидание в очереди ничего не стоит, а лишняя карточка в работе отнимает у человека время.', 'The tasks did not go anywhere: they waited in the queue on the left until there was room for them. Waiting in a queue costs nothing, while an extra card in progress takes a person’s time.') },
    ],
    explain: bi(
      'Без лимитов автопилот затянул все 14 карточек к владельцу продукта. При пяти задачах и больше у человека остаётся полезной четверть времени, и эта четверть делилась ещё на 14 частей. С лимитом у него было две карточки, и каждая заканчивалась за день.',
      'Without limits the autopilot pulled all 14 cards to the product owner. With five or more tasks a person keeps a quarter of the time for useful work, and that quarter was split into 14 parts more. With the limit there were two cards, and each was finished in a day.',
    ),
    refs: { lesson: 'methodology.flow' },
  },
  {
    id: 'method.q.practice-swarm',
    kind: 'mcq',
    concepts: ['method.bottleneck', 'method.swarming'],
    prompt: bi(
      'На доске в практике к пятому дню в колонке `dev` стояли три карточки с галочкой, а тестировщик проверял одну. Когда к проверке перешёл DEV-2, за десять дней было готово семь задач вместо пяти. Почему перестановка помогла, хотя DEV-2 проверяет вдвое медленнее тестировщика?',
      'On the practice board by day 5 the `dev` column had three ticked cards, and the tester was checking one. When DEV-2 moved to testing, seven tasks were done in ten days instead of five. Why did the move help, although DEV-2 tests half as fast as the tester?',
    ),
    options: [
      { id: 'flow', text: bi('Система выдаёт столько, сколько успевает её самый медленный этап, а каждая карточка, которую проверил DEV-2, уходила к покупателям', 'The system delivers as much as its slowest stage manages, and every card DEV-2 checked went to the customers'), correct: true },
      { id: 'dev', text: bi('Разработка стала работать быстрее', 'Development started working faster'), why: bi('Разработчиков на этапе стало меньше, а не больше. Готовых карточек в колонке `dev` и так было больше, чем успевала забрать проверка.', 'There were fewer developers on the stage, not more. The `dev` column already had more finished cards than testing could take.') },
      { id: 'both', text: bi('Если бы к проверке перешли оба разработчика, вышло бы ещё больше, ведь узким местом была проверка, и чем больше людей ей помогает, тем лучше', 'Had both developers moved to testing, even more would have been done, since testing was the bottleneck and the more help it gets the better'), why: bi('Тогда новый код никто не пишет, и через пару дней проверять становится нечего. В тренажёре так выходит четыре задачи вместо семи.', 'Then nobody writes new code, and after a couple of days there is nothing to test. In the trainer that gives four tasks instead of seven.') },
    ],
    explain: bi(
      'Час простоя проверки потерян для всей системы, и восполнить его может только помощь узкому месту. Время второго разработчика, наоборот, было лишним, потому что его карточки всё равно ждали проверки.',
      'An hour of testing standing idle is lost for the whole system, and only help for the bottleneck can make it up. The second developer’s time, on the contrary, was spare, because their cards waited for testing anyway.',
    ),
    refs: { lesson: 'methodology.bottleneck' },
  },
  {
    id: 'method.q.practice-batch',
    kind: 'mcq',
    concepts: ['method.batch', 'method.cod'],
    prompt: bi(
      'На доске в практике на тех же бросках кубика ответ «начать все пять промо-задач сразу» даёт 85-й процентиль времени цикла в 12–13 дней, а очередь по стоимости задержки вместе с порядком CD3 даёт 5 дней. Откуда такая разница?',
      'On the practice board, with the same dice, the answer “start all five promo tasks at once” gives an 85th percentile of cycle time of 12–13 days, and a queue by cost of delay together with the CD3 order gives 5 days. Where does the difference come from?',
    ),
    options: [
      { id: 'wip', text: bi('Пять карточек разом увеличили незавершённую работу, и по закону Литтла каждая карточка пошла дольше, а очередь пускала их в работу по одной', 'Five cards at once raised the work in progress, and by Little’s law every card took longer, while the queue let them into work one at a time'), correct: true },
      { id: 'order', text: bi('Порядок CD3 ставит промо-задачи в самый конец', 'The CD3 order puts the promo tasks at the very end'), why: bi('CD3 ставит вперёд задачи, дорогие в пересчёте на день работы, а промо-задачи как раз дорогие. Разницу дал не порядок, а то, сколько карточек вошло в работу одновременно.', 'CD3 puts first the tasks that are expensive per day of work, and the promo tasks are expensive. The difference came not from the order but from how many cards entered work at once.') },
      { id: 'luck', text: bi('Во втором прогоне броски кубика оказались удачнее, тестировщику реже выпадали малые числа, и поэтому карточки гораздо быстрее проходили проверку', 'The dice were luckier in the second run: the tester rolled low numbers less often, so the cards went through testing much faster than in the first run'), why: bi('Броски кубика в обоих прогонах одни и те же: тренажёр проигрывает одинаковые броски, поэтому разницу дали только ваши решения.', 'The dice are the same in both runs: the trainer replays the same rolls, so only your decisions made the difference.') },
    ],
    explain: bi(
      'Это игра с монетами из начала урока, только на доске. Большая партия разом входит в работу и делит между собой внимание людей, а маленькая проходит путь быстро и освобождает место следующей.',
      'This is the coin game from the start of the lesson, only on a board. A big batch enters work at once and splits people’s attention between its cards, while a small one goes through fast and makes room for the next.',
    ),
    refs: { lesson: 'methodology.batch' },
  },
  {
    id: 'method.q.practice-sprint',
    kind: 'mcq',
    concepts: ['method.scrum'],
    prompt: bi(
      'На обзоре спринта в практике команда показала шесть готовых задач, а в колонках остались начатые карточки. Что из этого Scrum Guide называет инкрементом?',
      'At the Sprint Review in the practice the team showed six finished tasks, and started cards were left in the columns. Which of these does the Scrum Guide call the Increment?',
    ),
    options: [
      { id: 'done', text: bi('Шесть готовых задач, которые отвечают определению готовности', 'The six finished tasks that meet the Definition of Done'), correct: true },
      { id: 'all', text: bi('Все карточки, которые побывали в работе за спринт', 'All the cards that were in progress during the Sprint'), why: bi('Начатая, но не законченная карточка покупателю ничего не даёт. Инкремент составляет только то, что отвечает определению готовности.', 'A started but unfinished card gives the customer nothing. The Increment is only what meets the Definition of Done.') },
      { id: 'limits', text: bi('Лимиты, которые команда поставила на планировании', 'The limits the team set at the planning'), why: bi('Лимиты помогают решить, сколько работы взять, но они остаются частью плана, а результатом спринта служит готовая часть продукта.', 'The limits help to decide how much work to take, but they stay part of the plan, while the result of a Sprint is a finished piece of the product.') },
    ],
    explain: bi(
      'Инкрементом называют работающую часть продукта, готовую к концу спринта. Поэтому на обзоре показывают законченное, а начатые карточки по Scrum Guide возвращаются в бэклог продукта, и владелец продукта решает, когда их продолжить.',
      'The Increment is the working piece of the product that is ready by the end of the Sprint. So the review shows what is finished, and by the Scrum Guide started items go back to the Product Backlog, where the Product Owner decides when to continue them.',
    ),
    refs: { lesson: 'methodology.agile' },
  },
  {
    id: 'method.q.practice-dora',
    kind: 'mcq',
    concepts: ['method.dora', 'method.batch'],
    prompt: bi(
      'В практике вы перевели выкладку с «раз в пять дней» на «раз в два дня», и выкладок стало примерно вдвое больше. Что при этом случилось со временем внесения изменения и почему?',
      'In the practice you moved the deployments from “every five days” to “every two days”, and there were about twice as many of them. What happened to change lead time, and why?',
    ),
    options: [
      { id: 'shorter', text: bi('Оно сократилось, потому что готовое изменение меньше ждёт ближайшей выкладки и уходит в меньшей партии', 'It got shorter, because a finished change waits less for the next deployment and leaves in a smaller batch'), correct: true },
      { id: 'longer', text: bi('Оно выросло, потому что эксплуатация тратит на выкладки больше времени', 'It grew, because operations spends more time on deployments'), why: bi('Каждая ручная выкладка забирает у эксплуатации два очка работы, но изменения стали гораздо меньше ждать ближайшей выкладки, и это перевешивает.', 'Each manual deployment takes two points of work from operations, but changes now wait much less for the next deployment, and that outweighs it.') },
      { id: 'same', text: bi('Не изменилось, потому что разработчики пишут код с прежней скоростью, а время внесения изменения зависит прежде всего от неё', 'It did not change, because the developers write code at the same speed, and change lead time depends mainly on that speed'), why: bi('Время внесения изменения отсчитывают с момента, когда код уже написан, поэтому скорость разработчиков на него почти не влияет. Почти всё это время изменение ждёт выкладки.', 'Change lead time is counted from the moment the code is already written, so the developers’ speed barely affects it. Almost all of that time the change waits for a deployment.') },
    ],
    explain: bi(
      'Это механика маленьких партий из урока о партиях. Чем чаще уходит выкладка, тем меньше в ней изменений и тем меньше каждое из них ждёт, а данные DORA показывают, что у большинства команд стабильность от этого не страдает.',
      'This is the mechanics of small batches from the lesson on batches. The more often a deployment leaves, the fewer changes it holds and the less each of them waits, and the DORA data show that for most teams stability does not suffer from it.',
    ),
    refs: { lesson: 'methodology.dora' },
  },
];

/**
 * Exam-only variants: the same mechanisms as the bank items, with other
 * numbers and situations, so the exam checks the method rather than the
 * memory of a question already answered in a lesson.
 */
export const examItems: QuizItem[] = [
  {
    id: 'method.q.exam.little',
    kind: 'mcq',
    concepts: ['method.little'],
    prompt: bi('У команды в работе в среднем 18 карточек, а заканчивает она в среднем полторы карточки в день. Незавершённой работы при этом не становится больше. Сколько дней в среднем идёт одна карточка?', 'The team has 18 cards in progress on average and finishes one and a half cards a day on average. The work in progress is not growing. How many days does one card take on average?'),
    options: [
      { id: '12', text: bi('12 дней', '12 days'), correct: true },
      { id: '27', text: bi('27 дней', '27 days'), why: bi('Здесь незавершённую работу умножили на пропускную способность. По закону Литтла время цикла равно незавершённой работе, делённой на пропускную способность, то есть 18 / 1,5.', 'Here the work in progress was multiplied by the throughput. By Little’s law cycle time is the work in progress divided by the throughput, that is, 18 / 1.5.') },
      { id: '0.08', text: bi('Около 0,08 дня', 'About 0.08 days'), why: bi('Здесь разделили в обратную сторону, 1,5 / 18. Карточки, делённые на карточки в день, дают дни, поэтому делить нужно незавершённую работу на пропускную способность.', 'The division went the wrong way round, 1.5 / 18. Cards divided by cards a day give days, so the work in progress is divided by the throughput.') },
    ],
    explain: bi('18 / 1,5 = 12 дней. Условие закона выполнено, потому что незавершённой работы не становится больше.', '18 / 1.5 = 12 days. The law’s condition holds, because the work in progress is not growing.'),
  },
  {
    id: 'method.q.exam.freeze',
    kind: 'mcq',
    concepts: ['method.error-budget'],
    prompt: bi('Бюджет ошибок за последние четыре недели превышен на 10 минут. Команда хочет выложить исправление уязвимости, о которой сообщили вчера, и новую функцию поиска. Что разрешает пример политики из SRE Workbook?', 'The error budget for the last four weeks is exceeded by 10 minutes. The team wants to deploy a fix for a vulnerability reported yesterday and a new search feature. What does the example policy in the SRE Workbook allow?'),
    options: [
      { id: 'fix', text: bi('Исправление уязвимости выложить можно, а функция поиска ждёт, пока сервис не вернётся к своему SLO', 'The vulnerability fix may go out, and the search feature waits until the service is back within its SLO'), correct: true },
      { id: 'both', text: bi('Можно выложить и то и другое, потому что превышение совсем небольшое', 'Both may go out, because the excess is very small'), why: bi('Политика смотрит на то, превышен ли бюджет, а не на то, насколько. Бюджет превышен, поэтому обычные выпуски останавливают.', 'The policy looks at whether the budget is exceeded, not by how much. It is exceeded, so ordinary releases stop.') },
      { id: 'none', text: bi('Нельзя выкладывать ничего, пока бюджет снова не появится', 'Nothing may go out until there is budget again'), why: bi('Исправления безопасности и исправления проблем P0 политика оставляет исключениями из заморозки, иначе заморозка мешала бы самой надёжности.', 'The policy keeps security fixes and P0 fixes as exceptions to the freeze; otherwise the freeze would stand in the way of reliability itself.') },
    ],
  },
  {
    id: 'method.q.exam.burn',
    kind: 'mcq',
    concepts: ['method.burn-rate'],
    prompt: bi('SLO требует, чтобы за 30 дней успешно прошли 99,9 % запросов. Последние шесть часов не проходит 0,6 % запросов. Какова скорость сжигания бюджета и что делать по порогам из SRE Workbook?', 'The SLO is 99.9% successful requests over 30 days. For the last six hours 0.6% of requests have been failing. What is the burn rate and what should happen by the thresholds of the SRE Workbook?'),
    options: [
      { id: 'page', text: bi('Скорость равна 6, и за шесть часов сгорело 5 % бюджета, поэтому нужно срочное оповещение', 'The rate is 6, and 5% of the budget burned in six hours, so a page is due'), correct: true },
      { id: 'ticket', text: bi('Скорость равна 6, а это меньше 14,4, поэтому достаточно заявки в рабочей очереди', 'The rate is 6, which is below 14.4, so a ticket is enough'), why: bi('Порог 14,4 относится к окну в один час. Для окна в шесть часов порог срочного оповещения равен 6, и он достигнут.', 'The 14.4 threshold is for the one-hour window. For the six-hour window the paging threshold is 6, and it is reached.') },
      { id: 'none', text: bi('Скорость равна 0,6, и делать ничего не нужно', 'The rate is 0.6, and nothing needs to be done'), why: bi('Скорость сжигания равна доле ошибок, делённой на допустимую долю: 0,6 % / 0,1 % = 6. Бюджет сгорает вшестеро быстрее нормы.', 'The burn rate is the error share divided by the allowed share: 0.6% / 0.1% = 6. The budget burns six times faster than normal.') },
    ],
  },
  {
    id: 'method.q.exam.cd3',
    kind: 'mcq',
    concepts: ['method.cod'],
    prompt: bi('У функции A стоимость задержки 15 000 рублей в неделю и работы на 5 недель. У функции B стоимость задержки 4 000 рублей в неделю и работы на 1 неделю. У функции C стоимость задержки 10 000 рублей в неделю и работы на 2 недели. Что делать первым, если выбирать по CD3?', 'Feature A: cost of delay 15,000 ₽ a week, 5 weeks of work. Feature B: 4,000 ₽ a week, 1 week of work. Feature C: 10,000 ₽ a week, 2 weeks of work. What goes first by CD3?'),
    options: [
      { id: 'c', text: bi('Функцию C, потому что её CD3 равен 5 000, у B он равен 4 000, а у A 3 000', 'Feature C, because its CD3 is 5,000, B’s is 4,000 and A’s is 3,000'), correct: true },
      { id: 'a', text: bi('Функцию A, потому что у неё самая высокая стоимость задержки', 'Feature A, because its cost of delay is the highest'), why: bi('Стоимость задержки нужно делить на длительность работы. Функция A дорогая, но занимает команду пять недель, и всё это время остальные функции тоже ждут.', 'The cost of delay must be divided by the duration. Feature A is expensive, but it keeps the team busy for five weeks, and all that time the other features wait too.') },
      { id: 'b', text: bi('Функцию B, потому что её делать быстрее всех', 'Feature B, because it is the quickest to build'), why: bi('Короткая работа сама по себе ещё не повод начинать с неё. У B стоимость задержки на неделю работы меньше, чем у C.', 'Short work alone is no reason to start with it. B’s cost of delay per week of work is lower than C’s.') },
    ],
  },
  {
    id: 'method.q.exam.ci-cd',
    kind: 'match',
    concepts: ['method.ci', 'method.cdelivery', 'method.cdeployment'],
    prompt: bi('Сопоставьте процесс команды и практику, которая у неё есть.', 'Match the team’s process with the practice it has.'),
    pairs: [
      { id: 'ci', left: bi('Все сливают изменения в общую ветку по нескольку раз в день, каждое слияние собирается и проходит автотесты, а выпуск на рабочий сайт неделю готовят вручную: собирают отдельную сборку и пишут инструкцию для эксплуатации', 'Everyone merges into the shared branch several times a day, every merge is built and passes the automated tests, and a release to production takes a week of manual preparation: a separate build and written instructions for operations'), right: bi('только непрерывная интеграция', 'continuous integration only'), why: bi('Непрерывная интеграция у команды есть, а непрерывной доставки нет. Проверенное изменение нельзя выпустить в любой момент, потому что каждый выпуск превращается в отдельный ручной проект.', 'Integration is there, delivery is not: a checked change cannot be released at any moment, because every release becomes a manual project.') },
      { id: 'cdel', left: bi('Любую проверенную сборку из общей ветки дежурный может выпустить одной командой хоть в пятницу вечером, но выпускать ли её сейчас, решает владелец продукта', 'The on-call engineer can release any checked build from the shared branch with one command, even on a Friday evening, but whether to release it now is the product owner’s decision'), right: bi('непрерывная доставка', 'continuous delivery'), why: bi('Изменение всегда готово к выпуску, а решение о выпуске принимает человек. Этим доставка и отличается от развёртывания.', 'The change is always ready to release, and a person makes the release decision. That is what tells delivery from deployment.') },
      { id: 'cdep', left: bi('Через двадцать минут после слияния изменение работает у покупателей, если все проверки прошли, и ни одного решения человека на этом пути нет', 'Twenty minutes after the merge the change runs for the customers if every check passed, with no human decision on the way'), right: bi('непрерывное развёртывание', 'continuous deployment') },
    ],
  },
  {
    id: 'method.q.exam.blameless',
    kind: 'mcq',
    concepts: ['method.postmortem'],
    prompt: bi('В черновике разбора написано: «Дежурный проспал срочное оповещение, и сбой длился лишний час». Какая запись подходит для разбора без поиска виноватых?', 'The postmortem draft says: “The on-call engineer slept through the page, and the outage lasted an extra hour.” Which entry fits a blameless postmortem?'),
    options: [
      { id: 'cond', text: bi('Оповещение звонило только на один телефон, а эскалация к запасному дежурному через 15 минут не была настроена', 'The page rang only one phone, and escalation to the secondary after 15 minutes was not set up'), correct: true },
      { id: 'human', text: bi('Сбой затянулся из-за человеческого фактора', 'The outage dragged on because of the human factor'), why: bi('Слова «человеческий фактор» снова называют причиной человека, только безлично. Из такой записи не следует ни одной задачи, которую можно поставить на доску.', 'The words “human factor” again name a person as the cause, only impersonally. No task that could go on the board follows from such an entry.') },
      { id: 'warn', text: bi('Дежурному сделано замечание, и в следующий раз он будет внимательнее', 'The on-call engineer was reprimanded and will be more careful next time'), why: bi('Замечание направлено против человека, а условия остались прежними: следующий дежурный, который крепко спит, проспит то же самое оповещение.', 'A reprimand is aimed at a person, while the conditions stay the same: the next on-call engineer who sleeps soundly will sleep through the same page.') },
    ],
    explain: bi('Способствующий фактор описывает условие, которое можно изменить. Здесь таким условием стала ненастроенная эскалация к запасному дежурному, и из записи сразу следует задача: настроить её.', 'A contributing factor describes a condition that can be changed. Here it is the missing escalation to the secondary, and a task follows from the entry at once: set it up.'),
  },
  {
    id: 'method.q.exam.five-steps',
    kind: 'mcq',
    concepts: ['method.five-steps', 'method.swarming'],
    prompt: bi('Проверка стала узким местом. Руководитель предлагает нанять второго тестировщика. При этом единственный тестировщик полдня проводит на совещаниях, а разработчики, пока их задачи ждут проверки, начинают новые функции. Что по пяти шагам Голдратта нужно сделать до найма?', 'Testing has become the bottleneck. The manager suggests hiring a second tester. Meanwhile the only tester spends half the day in meetings, and the developers, while their tasks wait for testing, start new features. What should be done before hiring, by Goldratt’s five steps?'),
    options: [
      { id: 'exploit', text: bi('Освободить тестировщика от совещаний и поставить лимит, чтобы свободные разработчики помогали проверке, а не начинали новое', 'Free the tester from meetings and set a limit so that free developers help with testing instead of starting new work'), correct: true },
      { id: 'hire', text: bi('Сразу нанять второго тестировщика, потому что так проблема решится быстрее всего', 'Hire a second tester at once, because that solves the problem fastest'), why: bi('Найм относится к четвёртому шагу, «расширить». Он дорогой и медленный: человека ещё нужно найти и ввести в работу, а половина времени нынешнего тестировщика тем временем так и уходит на совещания.', 'Hiring is the fourth step, “elevate”. It is expensive and slow: the person still has to be found and brought up to speed, while half of the current tester’s time keeps going to meetings.') },
      { id: 'dev', text: bi('Ускорить разработку, чтобы задачи приходили к проверке раньше', 'Speed up development so that tasks reach testing sooner'), why: bi('Разработка стоит перед узким местом. Если её ускорить, очередь перед проверкой вырастет, а до покупателей будет доходить столько же задач, сколько раньше.', 'Development is in front of the bottleneck. Speeding it up grows the queue before testing, while as many tasks as before reach the customers.') },
      { id: 'limit', text: bi('Увеличить лимит колонки «Проверка», чтобы в неё помещалось больше задач', 'Raise the limit of the Testing column so that more tasks fit into it'), why: bi('Больший лимит удлиняет очередь, но тестировщик от этого быстрее не станет, и проблема только спрячется.', 'A higher limit lengthens the queue, but the tester gets no faster, and the problem only hides.') },
    ],
  },
  {
    id: 'method.q.exam.approval',
    kind: 'mcq',
    concepts: ['method.dora', 'method.batch'],
    prompt: bi('Команда выкладывает изменения раз в месяц партией из 40 изменений. Доля неудачных изменений равна 35 %, а восстановление после неудачной выкладки занимает полдня. Руководитель хочет, чтобы перед каждой выкладкой изменения согласовывал ещё и отдел вне команды. Что по данным исследований DORA скорее улучшит обе группы метрик?', 'The team deploys once a month in a batch of 40 changes. The change fail rate is 35%, and recovery after a failed deployment takes half a day. The manager wants every deployment to be approved by a department outside the team as well. By DORA research, what is more likely to improve both groups of metrics?'),
    options: [
      { id: 'small', text: bi('Выкладывать чаще и меньшими партиями, с автотестами и откатом', 'Deploy more often in smaller batches, with automated tests and rollback'), correct: true },
      { id: 'approve', text: bi('Добавить согласование вне команды, потому что лишняя пара глаз поймает больше ошибок', 'Add the outside approval, because an extra pair of eyes catches more mistakes'), why: bi('В книге «Accelerate» описан этот результат: согласование изменений людьми вне команды замедляет доставку и при этом не снижает долю неудачных изменений. Партия от согласования не уменьшается, а ожидание становится длиннее.', '“Accelerate” describes this finding: approval of changes by people outside the team slows delivery and does not lower the change fail rate. The batch does not get smaller from an approval, while the wait gets longer.') },
      { id: 'rarer', text: bi('Выкладывать раз в квартал, чтобы поводов для сбоя стало меньше', 'Deploy once a quarter, so that there are fewer chances for an outage'), why: bi('Если выкладывать реже, в каждую выкладку попадёт ещё больше изменений: риск каждой выкладки вырастет, а виноватое изменение будет ещё труднее найти.', 'Deploying less often puts even more changes into each deployment: the risk of each one grows, and the faulty change is even harder to find.') },
    ],
  },
];
