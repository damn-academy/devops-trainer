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
      { id: 'change', text: bi('Изменение', 'A change'), why: bi('Изменением называют правку продукта. Возможно, сбой вызвало как раз изменение, но покупатели видят другое: рабочий сайт работает плохо.', 'A change is an edit to the product. The outage may well be caused by a change, but what customers see is production working badly.') },
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
      { id: 'people', text: bi('В этих отделах работают люди с разными характерами', 'The people in these departments have different characters'), why: bi('Конфликт создают цели, а не характеры. Если поменять людей местами, спор останется.', 'The conflict comes from the goals, not from characters: swap the people and the argument stays.') },
      { id: 'money', text: bi('Им платят из разных бюджетов', 'They are paid from different budgets'), why: bi('Бюджет у отделов может быть общим, а цели при этом противоположными. Всё дело в том, по чему их оценивают.', 'Budgets can be shared while the goals are opposite. The point is what they are judged by.') },
    ],
    explain: bi('DevOps снимает этот конфликт общей целью: изменения доходят до покупателей быстро и при этом не ломают сайт.', 'DevOps removes the conflict with a shared goal: changes reach the customers fast and do not break the site.'),
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
      { id: '16', text: bi('16 %', '16%'), why: bi('Число 16 означает часы работы, а не проценты. Работу нужно разделить на весь путь: 16 / 80.', '16 is the hours of work, not a percentage. Divide the work by the whole path: 16 / 80.') },
      { id: '80', text: bi('80 %', '80%'), why: bi('80 % — это доля ожидания: из 80 часов пути задача ждала 64.', 'That is the share of waiting: the task waited 64 of the 80 hours.') },
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
      { id: 'select', text: bi('Отбор: решили взяться за задачу и записали, что значит «готово»', 'Selection: decided to take it and what “done” means') },
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
      { id: 'lazy', text: bi('Так люди меньше устают', 'People get less tired that way'), why: bi('Усталость, возможно, и уменьшится, но главное в другом: каждая задача проходит путь быстрее, а очереди становятся видны.', 'Tiredness may drop, but the point is the time of each task and the visibility of queues.') },
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
      { id: '1.2', text: bi('1,2', '1.2'), why: bi('1,2 очка — это полезная работа на все четыре задачи вместе, а каждой достаётся четверть.', '1.2 is the useful capacity for all four tasks together. Each gets a quarter.') },
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
      { id: 'yes', text: bi('Да, ведь в работе только две карточки', 'Yes: only two are in progress'), why: bi('Карточка в части «готово» тоже не завершена, потому что до покупателя она ещё не дошла. Если её не считать, работа начнёт копиться в «готово».', 'A card in the “done” part is also unfinished: it has not reached the customer yet. Not counting it lets work pile up in “done”.') },
    ],
    explain: bi('Чтобы освободить место, следующая колонка должна вытянуть карточку из части «готово».', 'To free a place, the next column has to pull the card out of “done”.'),
  },
  {
    id: 'method.q.age',
    kind: 'mcq',
    concepts: ['method.throughput'],
    prompt: bi('Обычно карточки команды проходят путь за 5 дней, а одна начатая карточка находится в работе уже 9 дней. Какая метрика это показывает и что делать?', 'The team’s cards usually take 5 days. One started card has been in progress for 9 days. Which metric shows this and what should be done?'),
    options: [
      { id: 'age', text: bi('Возраст карточки, и вмешаться нужно сейчас: помочь, разбить задачу или убрать препятствие', 'Work item age: step in now — help, split it, remove the blocker'), correct: true },
      { id: 'cycle', text: bi('Время цикла, и нужно дождаться, пока карточка закончится, а потом учесть её в статистике', 'Cycle time: wait until it finishes and count it in the statistics'), why: bi('Время цикла станет известно только в конце. Возраст виден каждый день, и этим он полезен: по нему можно действовать заранее.', 'Cycle time is known only at the end. Age is visible every day, which is why it is useful: you can act on it in advance.') },
      { id: 'th', text: bi('Пропускная способность, и это значит, что команда стала работать медленнее', 'Throughput: the team got slower'), why: bi('Одна застрявшая карточка почти не меняет пропускную способность, а вопрос касается именно этой карточки.', 'One stuck card barely changes throughput. This is about a particular card.') },
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
      { id: '0.25', text: bi('0,25 дня', '0.25 days'), why: bi('Здесь разделили в обратную сторону, 3 / 12. Проверьте единицы измерения: карточки, делённые на карточки в день, дают дни.', 'The division the wrong way round: 3 / 12. Check the units: cards / (cards per day) = days.') },
    ],
    explain: bi('12 / 3 = 4 дня. Если начатой работы вдвое больше при той же пропускной способности, каждая карточка идёт вдвое дольше.', '12 / 3 = 4 days. Twice as much started work at the same throughput means twice as long.'),
  },
  {
    id: 'method.q.little-unstable',
    kind: 'mcq',
    concepts: ['method.little'],
    prompt: bi('По закону Литтла время цикла должно быть 6 дней, а по законченным карточкам выходит 11. При этом WIP всё время растёт. Почему цифры не сходятся?', 'By Little’s law cycle time should be 6 days, but the finished cards show 11. WIP keeps growing. Why does it not match?'),
    options: [
      { id: 'unstable', text: bi('Система нестабильна: начинают больше, чем заканчивают, и условия закона не выполнены', 'The system is unstable: more is started than finished, and the law’s conditions do not hold'), correct: true },
      { id: 'wrong', text: bi('Закон Литтла не работает для разработки', 'Little’s law does not work for development'), why: bi('Закон работает, если выполнены его условия. Когда WIP растёт, нарушено условие, что в начале и в конце периода незавершённой работы примерно поровну.', 'It works, under its conditions. When WIP grows, the condition “about the same WIP at the start and the end of the period” is broken.') },
      { id: 'calc', text: bi('Кто-то ошибся в подсчёте', 'A counting mistake'), why: bi('Расхождение не случайно. Растущий WIP означает, что карточки стареют, и время цикла у завтрашних карточек будет ещё больше.', 'The gap is not random: a growing WIP means cards age, and the cycle time of tomorrow’s cards will be even longer.') },
    ],
  },
  {
    id: 'method.q.cfd-band',
    kind: 'mcq',
    concepts: ['method.cfd'],
    prompt: bi('На накопительной диаграмме полоса «Проверка» с 8-го дня становится всё шире, а граница «готово» почти горизонтальна. Что это значит?', 'On the cumulative flow diagram the Testing band keeps widening from day 8, and the “done” edge is almost flat. What does it mean?'),
    options: [
      { id: 'test', text: bi('Проверка не успевает: работа копится в ней и почти не доходит до покупателей', 'Testing cannot keep up: work piles up in it and barely reaches the customers'), correct: true },
      { id: 'dev', text: bi('Разработка работает плохо', 'Development performs badly'), why: bi('Разработка как раз исправно поставляет работу, иначе полосе проверки нечем было бы расширяться.', 'Development is delivering work: otherwise the Testing band would have nothing to widen with.') },
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
      { id: '5', text: bi('5 дней, то есть медиану', '5 days — the median'), why: bi('Медиана — середина ряда, и половина карточек идёт дольше неё. Обещание по медиане будет нарушено в каждом втором случае.', 'That is the middle of the series: half the cards take longer. A promise by the median is broken every second time.') },
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
      { id: 'bn', text: bi('Узкое место не в разработке: число задач, которые доходят до покупателей, задаёт самый медленный этап, а лишняя работа копится перед ним', 'Development is not the bottleneck: the slowest stage sets the output, and extra work piles up in front of it'), correct: true },
      { id: 'lazy', text: bi('Разработчики стали работать хуже', 'The developers started to work worse'), why: bi('Разработчики делают вдвое больше, только эта работа ждёт в очереди перед медленным этапом.', 'They produce twice as much; that work simply waits in the queue before the slow stage.') },
      { id: 'time', text: bi('Нужно подождать, эффект появится позже', 'Wait: the effect will come later'), why: bi('Пока узкое место остаётся прежним, эффекта не будет, а очередь перед ним будет только расти.', 'While the bottleneck stays the same, there will be no effect: the queue in front of it will only grow.') },
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
      { id: 'new', text: bi('Разработчики берут новые функции, чтобы не простаивать', 'The developers take new features so as not to sit idle'), why: bi('Новые функции лягут в очередь перед проверкой: время цикла вырастет, а до покупателей будет доходить столько же задач, сколько раньше.', 'New features go into the queue before testing: cycle time grows, output does not.') },
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
      { id: 'b', text: bi('Функцию B: её CD3 равен 6 000, а у A он 5 000', 'B: CD3 = 6,000 against 5,000 for A'), correct: true },
      { id: 'a', text: bi('Функцию A, потому что у неё выше стоимость задержки', 'A: its cost of delay is higher'), why: bi('Стоимость задержки нужно делить на длительность. Пока две недели делают A, функция B теряет 12 000 рублей, а пока неделю делают B, функция A теряет 10 000.', 'The cost of delay must be divided by the duration. While A is built (2 weeks), B loses 12,000; while B is built (1 week), A loses 10,000.') },
      { id: 'same', text: bi('Без разницы', 'It does not matter'), why: bi('На одной паре функций разница составляет 2 000 рублей, а в потоке из десятков карточек от порядка зависит многое.', 'The difference is 2,000 ₽ for one pair; over a flow of dozens of cards the order decides a lot.') },
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
      { id: 'inc', left: bi('Инкремент', 'Increment'), right: bi('Критерии готовности', 'Definition of Done'), why: bi('Инкремент считается сделанным только тогда, когда он отвечает критериям готовности.', 'An Increment counts as done only when it meets the Definition of Done.') },
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
      { id: 'po', text: bi('Он решает, что важнее для продукта', 'They decide what matters most for the product'), why: bi('Решать, что важнее для продукта, — ответственность владельца продукта: он отвечает за то, чтобы продукт приносил как можно больше ценности, и за порядок бэклога.', 'That is the Product Owner’s accountability: maximising the value of the product and ordering the backlog.') },
    ],
  },
  {
    id: 'method.q.scrum-wip',
    kind: 'mcq',
    concepts: ['method.scrum', 'method.kanban'],
    prompt: bi('Может ли Scrum-команда ограничивать незавершённую работу внутри спринта?', 'May a Scrum Team limit work in progress inside a Sprint?'),
    options: [
      { id: 'yes', text: bi('Да: Scrum и Kanban совместимы, и это описано в Kanban Guide for Scrum Teams', 'Yes: Scrum and Kanban are compatible, as described in the Kanban Guide for Scrum Teams'), correct: true },
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
      { id: 'sla', text: bi('Договор с клиентом, в котором прописаны штрафы', 'A contract with a client, with penalties'), why: bi('Такой договор ближе к соглашению об уровне услуг. SLE — внутренний прогноз команды, который строят по истории времени цикла.', 'That is closer to a service level agreement. An SLE is the team’s internal forecast based on cycle time history.') },
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
      { id: 'ch', left: bi('Продление договора хостинга по графику', 'Renew the hosting contract on schedule'), right: bi('изменение', 'change'), why: bi('Продление договора по графику — плановая текущая работа. Если бы договор уже истёк и сайт перестал работать, продление стало бы незапланированной работой.', 'Planned routine work. Had the contract already expired and the site gone down, it would have become unplanned work.') },
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
      { id: 'meetings', text: bi('Совещания и планирование', 'Meetings and planning'), why: bi('Совещания и планирование — накладные расходы, а не рутина: с ростом числа покупателей их не становится больше.', 'That is overhead, not toil: it does not grow linearly with the number of customers.') },
    ],
  },
  {
    id: 'method.q.hire-vs-automate',
    kind: 'mcq',
    concepts: ['method.toil', 'method.automation'],
    prompt: bi('Эксплуатация тратит 70 % времени на то, чтобы вручную выдавать доступы. Почему нанять второго инженера — слабое решение?', 'Operations spends 70% of its time granting access by hand. Why is hiring a second engineer a weak decision?'),
    options: [
      { id: 'grows', text: bi('Рутина растёт вместе с сервисом и со временем займёт обоих, а скрипт снял бы её навсегда', 'Toil grows with the service: in time there will be enough for two, while a script would remove it for good'), correct: true },
      { id: 'money', text: bi('Потому что это дорого', 'Because it is expensive'), why: bi('Деньги важны, но главное в другом: новый человек тоже будет выдавать доступы вручную, а просьб станет больше.', 'Money matters, but the point is that the new person will also grant access by hand, and requests will grow.') },
      { id: 'never', text: bi('В эксплуатацию никогда не нужно нанимать людей', 'Operations should never hire'), why: bi('Нанимать людей иногда нужно. Но на рутину отвечают автоматизацией, иначе новый человек утонет в ней точно так же.', 'Hiring is sometimes needed. But toil is answered with automation; otherwise the new person drowns in it the same way.') },
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
      { id: 'ci', left: bi('Все каждый день сливают изменения в общую ветку, каждое слияние собирается и проверяется, а на рабочий сайт изменения выкладывают вручную раз в квартал', 'Everyone merges into the shared branch daily, each merge is built and tested; production is deployed by hand once a quarter'), right: bi('только непрерывная интеграция', 'continuous integration only'), why: bi('Интеграция есть, но изменение не готово к выкладке в любой момент: выкладка превращается в ручной проект раз в квартал.', 'Integration is there, but a change is not ready to release at any moment: deployment is a quarterly manual project.') },
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
      { id: 'yes', text: bi('Да, ведь тесты запускаются автоматически', 'Yes: tests run automatically'), why: bi('Автотесты составляют только половину дела. Интеграция означает частое слияние в общую ветку, а слияние через три недели будет болезненным.', 'Automated tests are only half. Integration means merging into the shared branch often; after three weeks the merge will hurt.') },
    ],
  },
  {
    id: 'method.q.red-build',
    kind: 'bugfind',
    concepts: ['method.ci'],
    prompt: bi('Перед вами договорённость команды о непрерывной интеграции. Какая строка лишает её смысла?', 'This is a team’s working agreement on continuous integration. Which line breaks its point?'),
    lang: 'yaml',
    code: 'integration:\n  merge_to_main: at_least_daily\n  on_every_merge: [build, unit_tests]\n  when_build_is_red: keep_merging   # we fix it on Friday\n  when_build_is_green: deploy_to_staging',
    bug: [4],
    why: {
      1: bi('Первая строка — заголовок договорённости, и в ней ничего не нарушено.', 'The heading of the agreement; nothing is broken here.'),
      2: bi('Сливать изменения хотя бы раз в день — суть определения.', 'Merging at least daily is the core of the definition.'),
      3: bi('Каждое слияние собирается и проверяется, так и должно быть.', 'Every merge is built and tested, as it should be.'),
      4: bi('Непрошедшую проверку чинят первым делом. Если продолжать сливать изменения поверх сломанной проверки, ошибки накапливаются, и уже непонятно, какое изменение что сломало.', 'A red build is fixed first. Merging on top of red piles up mistakes until nobody can tell which change broke what.'),
      5: bi('Выкладка на стенд после успешной проверки — уже шаг конвейера к непрерывной доставке.', 'Deploying to staging after a green build is already a pipeline step towards delivery.'),
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
      { id: 'prod', text: bi('Выкладка на рабочий сайт', 'Deployment to production'), why: bi('Если выкладывает человек кнопкой, это непрерывная доставка, а если конвейер сам, это непрерывное развёртывание.', 'By a button: continuous delivery; by itself: continuous deployment.') },
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
      { id: 'df', text: bi('Частота развёртываний', 'Deployment frequency'), why: bi('Эта метрика относится к пропускной способности доставки: она показывает, как часто изменения доходят до рабочего сайта.', 'That is delivery throughput: how often changes reach production.') },
      { id: 'lt', text: bi('Время внесения изменения', 'Change lead time'), why: bi('Эта метрика относится к пропускной способности: она показывает, как быстро готовое изменение доходит до рабочего сайта.', 'That is throughput: how fast a finished change reaches production.') },
      { id: 'rec', text: bi('Время восстановления после неудачного развёртывания', 'Failed deployment recovery time'), why: bi('С 2024 года DORA относит эту метрику к пропускной способности: она показывает, как быстро команда возвращает рабочий сайт в строй.', 'Since 2024 DORA places it under throughput: it is the speed at which the team brings production back.') },
    ],
  },
  {
    id: 'method.q.dora-less-often',
    kind: 'mcq',
    concepts: ['method.dora', 'method.batch'],
    key: true,
    prompt: bi('Руководитель говорит: «Будем выкладываться реже, зато надёжнее». Что об этом говорят исследования DORA?', 'A manager: “We will deploy less often but more safely.” What does DORA research say about it?'),
    options: [
      { id: 'together', text: bi('У большинства команд скорость и стабильность растут вместе: маленькие частые изменения проще выкладывать и откатывать', 'For most teams speed and stability go together: small frequent changes are easier to deploy and to roll back'), correct: true },
      { id: 'balance', text: bi('Нужно найти баланс между скоростью и стабильностью', 'One has to find a balance between speed and stability'), why: bi('Мысль о балансе — распространённое заблуждение: она предполагает, что скорость можно получить только ценой стабильности, и наоборот. Данные DORA показывают обратное: если уменьшить партию, улучшаются обе группы метрик.', 'A common misconception: it assumes one is traded for the other. DORA data show the opposite: smaller batches improve both groups of metrics.') },
      { id: 'right', text: bi('Руководитель прав: меньше выкладок, меньше сбоев', 'The manager is right: fewer deployments, fewer outages'), why: bi('Чем реже выкладки, тем больше партия, а большая партия рискованнее. Сбоев может стать даже больше.', 'Fewer deployments mean bigger batches, and the risk of a big batch is higher. The number of outages may even grow.') },
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
      { id: 'game', text: bi('Частоту накрутят пустыми или раздробленными выкладками: показатель зелёный, а ценности не прибавилось', 'The frequency gets inflated with empty or chopped-up deployments: the gauge is green, no value was added'), correct: true },
      { id: 'better', text: bi('Команда начнёт доставлять ценность быстрее', 'The team will deliver value faster'), why: bi('Целью стало число выкладок, а не ценность, и самый дешёвый путь к такой цели — выкладывать что угодно. Это и есть закон Гудхарта.', 'The target is the number of deployments, not value; the cheapest way to it is to deploy anything. That is Goodhart’s law.') },
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
      { id: '432', text: bi('432 минуты', '432 minutes'), why: bi('Столько допускает цель 99 %: это 1 % от 43 200 минут.', 'That is for 99%: 1% of 43,200 minutes.') },
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
      { id: '20', text: '20', why: bi('Так считают полный простой. Если SLO считают по запросам, бюджет тратится пропорционально доле ошибок: 20 × 0,1.', 'That is how full downtime counts. A request-based SLO spends the budget in proportion to the error share: 20 × 0.1.') },
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
      { id: 'ok', text: bi('Политика выкладку не запрещает: выпуски останавливают, только когда бюджет превышен', 'The policy does not forbid it: releases stop only when the budget is exceeded'), correct: true },
      { id: 'stop', text: bi('Нужно остановить все выпуски, ведь бюджет почти кончился', 'Stop all releases: the budget is almost gone'), why: bi('Выпуски замораживают, когда бюджет за четыре недели превышен, а не когда он почти кончился. Быть осторожнее разумно, но политика этого не требует.', 'The freeze condition is the budget being exceeded over the window, not “almost”. Caution is reasonable, but the policy does not require it.') },
      { id: 'p0', text: bi('Разрешены только исправления проблем P0 и исправления безопасности', 'Only P0 and security fixes are allowed'), why: bi('Исправления P0 и исправления безопасности — исключения из заморозки, а заморозка начинается только тогда, когда бюджет превышен.', 'These are the exceptions to a freeze, and a freeze starts when the budget is exceeded.') },
    ],
  },
  {
    id: 'method.q.slo-sla',
    kind: 'mcq',
    concepts: ['method.slo'],
    prompt: bi('Чем SLO отличается от SLA?', 'How does an SLO differ from an SLA?'),
    options: [
      { id: 'contract', text: bi('SLO — внутренняя цель команды, а SLA — обещание клиенту по договору, за нарушение которого есть последствия. SLO обычно строже', 'An SLO is the team’s internal target; an SLA is a contractual promise to a client with consequences. The SLO is usually stricter'), correct: true },
      { id: 'same', text: bi('Это одно и то же', 'They are the same'), why: bi('Цель и договор — разные вещи. Если SLO нарушен, команда занимается надёжностью, а если нарушен SLA, клиенту платят штраф или возвращают деньги.', 'A target and a contract are different things: missing an SLO is a reason to work on reliability, breaking an SLA means a penalty or a refund.') },
      { id: 'sli', text: bi('SLO называет то, что мы измеряем', 'An SLO is what we measure'), why: bi('То, что мы измеряем, называется SLI, а SLO — это цель для SLI на определённый срок.', 'What we measure is the SLI. The SLO is a target for the SLI over a window.') },
    ],
  },
  {
    id: 'method.q.burn',
    kind: 'mcq',
    concepts: ['method.burn-rate'],
    prompt: bi('SLO требует, чтобы за 30 дней успешно прошли 99,9 % запросов. За последний час израсходовано 2 % месячного бюджета ошибок. Какова скорость сжигания и что делать?', 'The SLO is 99.9% successful requests over 30 days. In the last hour 2% of the monthly error budget was spent. What is the burn rate and what to do?'),
    options: [
      { id: 'page', text: bi('14,4, и нужно срочное оповещение, которое разбудит дежурного', '14.4: page, wake the on-call engineer'), correct: true },
      { id: 'ticket', text: bi('2, и достаточно завести тикет', '2: open a ticket'), why: bi('2 % — это доля бюджета, а не скорость. Скорость равна доле бюджета, делённой на долю тридцатидневного окна, которая за это время прошла. Час составляет 1/720 от 30 дней, поэтому скорость равна 0,02 / (1/720) = 14,4.', '2% is a share of the budget, not the rate. The rate is the share of the budget divided by the share of the 30-day window that has passed. An hour is 1/720 of 30 days, so the rate is 0.02 / (1/720) = 14.4.') },
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
      { id: 'detect', text: bi('Оповещение: сбой обнаружен', 'An alert: the outage is detected') },
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
      { id: 'train', text: bi('Разработчика отправят на обучение работе с базами данных', 'The developer will be sent to a database course'), why: bi('Обучение — мера против человека, а не против условий, и следующий человек сделает ту же ошибку.', 'That is a measure against a person, not against the conditions: the next person will make the same mistake.') },
    ],
  },
  {
    id: 'method.q.what-visible',
    kind: 'mcq',
    concepts: ['method.postmortem'],
    prompt: bi('Почему на разборе спрашивают «что было видно в этот момент?», а не «почему вы ошиблись?»', 'Why does a review ask “what could be seen at that moment” rather than “why did you make a mistake”?'),
    options: [
      { id: 'data', text: bi('При тех данных, что были, решение казалось разумным: так находят условия, которые нужно менять, а люди продолжают рассказывать правду', 'The decision seemed reasonable given the data at hand; this finds the conditions to change, and people keep telling the truth'), correct: true },
      { id: 'polite', text: bi('Чтобы никого не обидеть', 'So as not to offend anyone'), why: bi('Вежливость здесь побочный эффект, а цель — информация: если людей обвиняют, они замолкают.', 'Politeness is a side effect. The goal is information: blame makes people silent.') },
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
      { id: 'lazy', text: bi('Команда плохо тестирует', 'The team tests badly'), why: bi('«Плохо тестирует» — оценка, из которой не следует никакой задачи. Способствующий фактор звучал бы так: «нет автотеста на оформление заказа».', 'A judgement with no task in it. A factor: “there is no automated test of checkout”.') },
    ],
  },
  // ── methodology.culture ──
  {
    id: 'method.q.ways-match',
    kind: 'match',
    concepts: ['method.three-ways'],
    prompt: bi('Сопоставьте практику и путь из «Руководства по DevOps».', 'Match the practice with the Way from “The DevOps Handbook”.'),
    pairs: [
      { id: 'flow', left: bi('Лимиты WIP и маленькие партии', 'WIP limits and small batches'), right: bi('первый путь: поток', 'the First Way: flow') },
      { id: 'fb', left: bi('Автотесты и оповещения по бюджету ошибок', 'Automated tests and error-budget alerts'), right: bi('второй путь: обратная связь', 'the Second Way: feedback') },
      { id: 'learn', left: bi('Разборы без поиска виноватых и время на улучшения', 'Blameless postmortems and time for improvement'), right: bi('третий путь: обучение', 'the Third Way: learning') },
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
    id: 'method.q.westrum',
    kind: 'mcq',
    concepts: ['method.westrum'],
    prompt: bi('Тестировщик сообщил, что тест оплаты падает. Руководитель ответил: «Оформи заявку по шаблону, рассмотрим на комитете в четверг». Какой это тип культуры по Веструму?', 'A tester reported that the checkout test fails. The manager replied: “File a request using the template; the committee will look at it on Thursday.” Which type of culture is this by Westrum?'),
    options: [
      { id: 'bureau', text: bi('Бюрократическая', 'Bureaucratic'), correct: true },
      { id: 'patho', text: bi('Патологическая', 'Pathological'), why: bi('Новость не спрятали, и того, кто её принёс, не наказали: её пустили по регламенту. Такой путь медленный, но не враждебный.', 'The news was not hidden and the messenger not punished; it was routed through procedure. Slow, but not hostile.') },
      { id: 'gen', text: bi('Генеративная', 'Generative'), why: bi('В генеративной культуре новость сразу ушла бы к тем, кто может её исправить.', 'In a generative culture the news would have gone at once to those who can fix it.') },
    ],
  },
];
