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
    prompt: bi('Покупатель нажал «оплатить», деньги не списались, и так уже час у всех покупателей. Что это?', 'A customer pressed “pay”, no money was charged, and it has been like that for every customer for an hour. What is it?'),
    options: [
      { id: 'outage', text: bi('Сбой', 'An outage'), correct: true },
      { id: 'change', text: bi('Изменение', 'A change'), why: bi('Изменение — правка продукта. Возможно, сбой вызван изменением, но то, что видят покупатели, — прод работает плохо.', 'A change is an edit to the product. The outage may well be caused by a change, but what customers see is production working badly.') },
      { id: 'feature', text: bi('Функция', 'A feature'), why: bi('Функция — новая возможность для покупателя. Здесь возможность, наоборот, пропала.', 'A feature is a new possibility for the customer. Here a possibility has disappeared instead.') },
    ],
    explain: bi('Сбой — прод работает плохо или не работает: покупатели не могут сделать то, ради чего пришли.', 'An outage is production working badly or not at all: customers cannot do what they came for.'),
    refs: { lesson: 'methodology.business' },
  },
  {
    id: 'method.q.conflict',
    kind: 'mcq',
    concepts: ['method.dev-ops', 'method.devops'],
    prompt: bi('Разработку оценивают по числу выпущенных функций, эксплуатацию — по дням без сбоев. Почему это конфликт?', 'Development is judged by the number of features shipped, operations by days without outages. Why is that a conflict?'),
    options: [
      { id: 'risk', text: bi('Каждое изменение — риск для стабильности: одной стороне выгодно выкладывать чаще, другой — реже', 'Every change is a risk to stability: one side gains from deploying more often, the other from deploying less'), correct: true },
      { id: 'people', text: bi('В этих отделах работают люди с разными характерами', 'The people in these departments have different characters'), why: bi('Конфликт создают цели, а не характеры: поменяйте людей местами — спор останется.', 'The conflict comes from the goals, not from characters: swap the people and the argument stays.') },
      { id: 'money', text: bi('Им платят из разных бюджетов', 'They are paid from different budgets'), why: bi('Бюджеты могут быть общими, а цели — противоположными. Дело в том, по чему их оценивают.', 'Budgets can be shared while the goals are opposite. The point is what they are judged by.') },
    ],
    explain: bi('DevOps снимает конфликт общей целью: изменения доходят до покупателей быстро и не ломают сайт.', 'DevOps removes the conflict with a shared goal: changes reach the customers fast and do not break the site.'),
  },
  {
    id: 'method.q.value-delivered',
    kind: 'mcq',
    concepts: ['method.value'],
    prompt: bi('Функция «оплата картой» полностью написана и проверена, но ждёт выкладки две недели. Сколько ценности она принесла магазину за эти две недели?', 'The “card payments” feature is fully written and tested but waits two weeks for deployment. How much value did it bring the shop in those two weeks?'),
    options: [
      { id: 'zero', text: bi('Нисколько', 'None'), correct: true },
      { id: 'full', text: bi('Всю: работа уже сделана', 'All of it: the work is done'), why: bi('Деньги приносит то, чем пользуются покупатели. Готовая, но не выложенная функция — затраты без отдачи.', 'Money comes from what the customers use. A finished but undeployed feature is cost without return.') },
      { id: 'half', text: bi('Половину', 'Half'), why: bi('Ценность не накапливается по ходу работы: она появляется, только когда изменение дошло до покупателя.', 'Value does not accumulate as the work goes on: it appears only when the change reaches the customer.') },
    ],
  },
  // ── methodology.value-stream ──
  {
    id: 'method.q.flow-efficiency',
    kind: 'mcq',
    concepts: ['method.flow-efficiency'],
    prompt: bi('Путь задачи занял 10 рабочих дней по 8 часов. Над ней работали 16 часов. Какова эффективность потока?', 'A task’s path took 10 working days of 8 hours. It was worked on for 16 hours. What is the flow efficiency?'),
    options: [
      { id: '20', text: '20%', correct: true },
      { id: '16', text: '16%', why: bi('16 — это часы работы, а не проценты. Нужно разделить работу на весь путь: 16 / 80.', '16 is the hours of work, not a percentage. Divide the work by the whole path: 16 / 80.') },
      { id: '80', text: '80%', why: bi('Это доля ожидания: 64 из 80 часов задача ждала.', 'That is the share of waiting: the task waited 64 of the 80 hours.') },
    ],
    explain: bi('16 / (10 × 8) = 0,2. Остальные 80% пути задача ждала.', '16 / (10 × 8) = 0.2. For the other 80% of the path the task waited.'),
  },
  {
    id: 'method.q.longest-wait',
    kind: 'mcq',
    concepts: ['method.value-stream'],
    prompt: bi('На пути задачи: ждёт разработчика 8 ч, ревьюера 4 ч, тестировщика 6 ч, окна выкладки 40 ч. Работы — 12 ч. Что сократит путь сильнее всего?', 'On a task’s path: it waits 8 h for a developer, 4 h for a reviewer, 6 h for the tester, 40 h for the deployment window. Work: 12 h. What shortens the path most?'),
    options: [
      { id: 'window', text: bi('Выкладывать чаще, чем раз в неделю', 'Deploy more often than once a week'), correct: true },
      { id: 'faster', text: bi('Попросить разработчиков писать код быстрее', 'Ask the developers to code faster'), why: bi('Работы на всём пути 12 часов; даже вдвое быстрее — минус несколько часов. Ожидание окна выкладки — 40.', 'There are 12 hours of work on the whole path; even twice as fast saves a few hours. The wait for the window is 40.') },
      { id: 'review', text: bi('Нанять второго ревьюера', 'Hire a second reviewer'), why: bi('Ожидание ревью — самое короткое на пути. Улучшать начинают с самого долгого ожидания.', 'The wait for review is the shortest on the path. Improvement starts with the longest wait.') },
    ],
  },
  {
    id: 'method.q.path-order',
    kind: 'order',
    concepts: ['method.value-stream'],
    prompt: bi('Расставьте этапы пути изменения в магазине по порядку.', 'Put the stages of a change’s path in the shop in order.'),
    steps: [
      { id: 'select', text: bi('Отбор: решили браться за задачу и что значит «готово»', 'Selection: decided to take it and what “done” means') },
      { id: 'dev', text: bi('Разработка', 'Development') },
      { id: 'review', text: bi('Ревью — проверка кода коллегой', 'Review: a colleague checks the code'), why: bi('Ревью идёт сразу после разработки: проверяют код, а не работающий сайт.', 'Review comes right after development: it checks the code, not the working site.') },
      { id: 'test', text: bi('Проверка — тестирование', 'Testing') },
      { id: 'deploy', text: bi('Выкладка на прод', 'Deployment to production') },
      { id: 'customers', text: bi('Изменение у покупателей', 'The change is with the customers'), why: bi('Только здесь изменение начинает приносить ценность.', 'Only here does the change start to bring value.') },
    ],
  },
  // ── methodology.board ──
  {
    id: 'method.q.pull-why',
    kind: 'mcq',
    concepts: ['method.pull'],
    prompt: bi('Почему новую задачу лучше брать, когда освободилось место, а не когда её выдали?', 'Why is it better to take a new task when there is room for it, rather than when it is handed out?'),
    options: [
      { id: 'pile', text: bi('Работа не копится там, где её не успевают делать, и ждёт в очереди, где ничего не стоит', 'Work does not pile up where nobody has time for it, and waits in a queue where it costs nothing'), correct: true },
      { id: 'lazy', text: bi('Так люди меньше устают', 'People get less tired that way'), why: bi('Усталость может уменьшиться, но главное — время каждой задачи и видимость очередей.', 'Tiredness may drop, but the point is the time of each task and the visibility of queues.') },
      { id: 'less', text: bi('Так команда делает меньше работы', 'The team does less work that way'), why: bi('Работы столько же; меньше только переключений и одновременно начатого.', 'There is as much work; there is only less switching and less started at once.') },
    ],
  },
  {
    id: 'method.q.weinberg',
    kind: 'mcq',
    concepts: ['method.switching'],
    prompt: bi('Мощность разработчика — 3 очка в день. У него в работе 4 задачи. Сколько очков в день получает каждая по таблице Вайнберга (при четырёх задачах полезно 40% времени)?', 'A developer’s capacity is 3 points a day. They have 4 tasks in progress. How many points a day does each get by Weinberg’s table (with four tasks 40% of the time is useful)?'),
    options: [
      { id: '0.3', text: '0.3', correct: true },
      { id: '0.75', text: '0.75', why: bi('3 / 4 = 0,75 — это без потерь на переключение. Сначала полезная доля: 3 × 0,4 = 1,2; потом делим на 4.', '3 / 4 = 0.75 ignores the switching loss. First the useful share: 3 × 0.4 = 1.2; then divide by 4.') },
      { id: '1.2', text: '1.2', why: bi('1,2 — полезная мощность на все четыре задачи вместе. На каждую — четверть.', '1.2 is the useful capacity for all four tasks together. Each gets a quarter.') },
    ],
    explain: bi('3 × 0,4 / 4 = 0,3. Одна задача за раз получила бы все 3 очка.', '3 × 0.4 / 4 = 0.3. One task at a time would get all 3 points.'),
  },
  {
    id: 'method.q.board-visible',
    kind: 'multi',
    concepts: ['method.board'],
    prompt: bi('Что видно на доске с колонками по этапам и частями «в работе / готово» и не видно в общем чате задач? Отметьте всё верное.', 'What does a board with columns by stage and “doing / done” parts show that a group chat of tasks does not? Mark everything that is true.'),
    options: [
      { id: 'where', text: bi('На каком этапе каждая задача', 'At which stage each task is'), correct: true },
      { id: 'pile', text: bi('Где задачи скапливаются и ждут', 'Where tasks pile up and wait'), correct: true },
      { id: 'waiting', text: bi('Какие задачи закончены на этапе и ждут следующего', 'Which tasks are finished at a stage and wait for the next'), correct: true },
      { id: 'faster', text: bi('Доска сама ускоряет работу', 'The board itself speeds up the work'), why: bi('Доска ничего не ускоряет — она показывает. Ускоряют решения, которые принимают, глядя на неё.', 'A board speeds nothing up; it shows. The decisions made by looking at it do the speeding up.') },
    ],
  },
  // ── methodology.flow ──
  {
    id: 'method.q.cycle-vs-lead',
    kind: 'mcq',
    concepts: ['method.cycle-time'],
    prompt: bi('Карточка появилась в «готово к работе» 1-го числа, её начали 4-го и закончили 9-го. Каково её время цикла и время выполнения (дни считаем включительно)?', 'A card appeared in “ready” on the 1st, was started on the 4th and finished on the 9th. What are its cycle time and lead time (counting days inclusively)?'),
    options: [
      { id: 'ok', text: bi('Цикл 6 дней, выполнение 9 дней', 'Cycle 6 days, lead 9 days'), correct: true },
      { id: 'swap', text: bi('Цикл 9 дней, выполнение 6 дней', 'Cycle 9 days, lead 6 days'), why: bi('Перепутаны местами: время цикла начинается с начала работы (4-е), время выполнения — с появления в очереди (1-е).', 'Swapped: cycle time starts at the start of work (the 4th), lead time at entering the queue (the 1st).') },
      { id: 'excl', text: bi('Цикл 5 дней, выполнение 8 дней', 'Cycle 5 days, lead 8 days'), why: bi('Это без включения дней: на доске считают дни включительно, и карточка, начатая и законченная в один день, имеет время цикла 1.', 'That excludes a day: on the board days are counted inclusively, and a card started and finished on the same day has a cycle time of 1.') },
    ],
  },
  {
    id: 'method.q.wip-limit-count',
    kind: 'mcq',
    concepts: ['method.wip'],
    prompt: bi('У колонки «Проверка» лимит WIP 3. В её части «в работе» две карточки, в части «готово» — одна. Можно ли вытянуть в проверку ещё одну карточку?', 'The Testing column has a WIP limit of 3. Its “doing” part holds two cards, its “done” part one. May one more card be pulled into testing?'),
    options: [
      { id: 'no', text: bi('Нет: лимит считает обе части колонки, в ней уже 3', 'No: the limit counts both parts of the column, and it already holds 3'), correct: true },
      { id: 'yes', text: bi('Да: в работе только две', 'Yes: only two are in progress'), why: bi('Карточка в части «готово» тоже незавершённая — она ещё не дошла до покупателя. Если её не считать, работа будет копиться в «готово».', 'A card in the “done” part is also unfinished: it has not reached the customer yet. Not counting it lets work pile up in “done”.') },
    ],
    explain: bi('Чтобы освободить место, нужно, чтобы следующая колонка вытянула карточку из «готово».', 'To free a place, the next column has to pull the card out of “done”.'),
  },
  {
    id: 'method.q.age',
    kind: 'mcq',
    concepts: ['method.throughput'],
    prompt: bi('Обычно карточки команды проходят путь за 5 дней. Одна начатая карточка в работе уже 9 дней. Какая метрика это показывает и что делать?', 'The team’s cards usually take 5 days. One started card has been in progress for 9 days. Which metric shows this and what should be done?'),
    options: [
      { id: 'age', text: bi('Возраст карточки: вмешаться сейчас — помочь, разбить, убрать препятствие', 'Work item age: step in now — help, split it, remove the blocker'), correct: true },
      { id: 'cycle', text: bi('Время цикла: подождать, пока закончится, и учесть в статистике', 'Cycle time: wait until it finishes and count it in the statistics'), why: bi('Время цикла станет известно только в конце. Возраст виден каждый день, поэтому и полезен: по нему можно действовать заранее.', 'Cycle time is known only at the end. Age is visible every day, which is why it is useful: you can act on it in advance.') },
      { id: 'th', text: bi('Пропускная способность: команда стала медленнее', 'Throughput: the team got slower'), why: bi('Одна застрявшая карточка мало меняет пропускную способность. Речь о конкретной карточке.', 'One stuck card barely changes throughput. This is about a particular card.') },
    ],
  },
  // ── methodology.little ──
  {
    id: 'method.q.little-calc',
    kind: 'mcq',
    concepts: ['method.little'],
    key: true,
    prompt: bi('В работе у команды в среднем 12 карточек, заканчивает она в среднем 3 в день. Сколько в среднем длится время цикла?', 'The team has 12 cards in progress on average and finishes 3 a day on average. What is the average cycle time?'),
    options: [
      { id: '4', text: bi('4 дня', '4 days'), correct: true },
      { id: '36', text: bi('36 дней', '36 days'), why: bi('Перемножили WIP и пропускную способность. По закону Литтла WIP = пропускная способность × время, значит время = WIP / пропускная способность.', 'WIP and throughput were multiplied. By Little’s law WIP = throughput × time, so time = WIP / throughput.') },
      { id: '0.25', text: bi('0,25 дня', '0.25 days'), why: bi('Деление в обратную сторону: 3 / 12. Проверьте размерность: карточки / (карточки в день) = дни.', 'The division the wrong way round: 3 / 12. Check the units: cards / (cards per day) = days.') },
    ],
    explain: bi('12 / 3 = 4 дня. Вдвое больше начатого при той же пропускной способности — вдвое дольше.', '12 / 3 = 4 days. Twice as much started work at the same throughput means twice as long.'),
  },
  {
    id: 'method.q.little-unstable',
    kind: 'mcq',
    concepts: ['method.little'],
    prompt: bi('По закону Литтла время цикла должно быть 6 дней, а по законченным карточкам выходит 11. WIP всё время растёт. Почему не сходится?', 'By Little’s law cycle time should be 6 days, but the finished cards show 11. WIP keeps growing. Why does it not match?'),
    options: [
      { id: 'unstable', text: bi('Система нестабильна: начинают больше, чем заканчивают, и условия закона не выполнены', 'The system is unstable: more is started than finished, and the law’s conditions do not hold'), correct: true },
      { id: 'wrong', text: bi('Закон Литтла не работает для разработки', 'Little’s law does not work for development'), why: bi('Работает — при своих условиях. Когда WIP растёт, нарушено условие «в начале и в конце периода WIP примерно одинаков».', 'It works, under its conditions. When WIP grows, the condition “about the same WIP at the start and the end of the period” is broken.') },
      { id: 'calc', text: bi('Ошиблись в подсчёте', 'A counting mistake'), why: bi('Расхождение не случайно: растущий WIP означает, что карточки стареют, а время цикла завтрашних будет ещё больше.', 'The gap is not random: a growing WIP means cards age, and the cycle time of tomorrow’s cards will be even longer.') },
    ],
  },
  {
    id: 'method.q.cfd-band',
    kind: 'mcq',
    concepts: ['method.cfd'],
    prompt: bi('На накопительной диаграмме полоса «Проверка» с 8-го дня всё шире, а граница «готово» почти горизонтальна. Что это значит?', 'On the cumulative flow diagram the Testing band keeps widening from day 8, and the “done” edge is almost flat. What does it mean?'),
    options: [
      { id: 'test', text: bi('Проверка не успевает: работа копится в ней и почти не доходит до покупателей', 'Testing cannot keep up: work piles up in it and barely reaches the customers'), correct: true },
      { id: 'dev', text: bi('Разработка работает плохо', 'Development performs badly'), why: bi('Разработка как раз поставляет работу: иначе полосе проверки нечем было бы расширяться.', 'Development is delivering work: otherwise the Testing band would have nothing to widen with.') },
      { id: 'good', text: bi('Проверка много делает — это хорошо', 'Testing does a lot — that is good'), why: bi('Ширина полосы — это сколько в ней лежит, а не сколько она сделала. Сделанное ушло бы в «готово».', 'The width of a band is how much lies in it, not how much it did. What is done would move to “done”.') },
    ],
  },
  {
    id: 'method.q.percentile',
    kind: 'mcq',
    concepts: ['method.percentile'],
    prompt: bi('Времена цикла 20 последних карточек, по возрастанию: 2 2 3 3 3 4 4 4 5 5 5 6 6 7 7 8 9 11 12 15. Какой срок можно обещать с уверенностью 85%?', 'Cycle times of the last 20 cards, ascending: 2 2 3 3 3 4 4 4 5 5 5 6 6 7 7 8 9 11 12 15. Which time can be promised with 85% confidence?'),
    options: [
      { id: '9', text: bi('9 дней', '9 days'), correct: true },
      { id: '5', text: bi('5 дней — медиана', '5 days — the median'), why: bi('Это середина ряда: половина карточек дольше. Обещание по медиане нарушится в каждом втором случае.', 'That is the middle of the series: half the cards take longer. A promise by the median is broken every second time.') },
      { id: '15', text: bi('15 дней — максимум', '15 days — the maximum'), why: bi('Максимум слишком осторожен и зависит от одного случая. 85-й процентиль — семнадцатое значение из двадцати.', 'The maximum is too cautious and depends on one case. The 85th percentile is the seventeenth value of twenty.') },
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
      { id: 'sub', text: bi('Подчинить ему всё остальное', 'Subordinate everything else to it'), why: bi('Подчинение идёт до расширения: оно почти бесплатно и часто снимает проблему.', 'Subordination comes before elevation: it is almost free and often removes the problem.') },
      { id: 'elevate', text: bi('Расширить', 'Elevate it'), why: bi('Расширение — нанять людей, купить оборудование, построить автопроверки — дорого, поэтому оно четвёртое.', 'Elevation — hiring people, buying equipment, building automatic checks — is expensive, which is why it is fourth.') },
      { id: 'repeat', text: bi('Повторить: узкое место сместилось', 'Repeat: the constraint has moved') },
    ],
  },
  {
    id: 'method.q.faster-dev',
    kind: 'mcq',
    concepts: ['method.bottleneck'],
    prompt: bi('Разработку ускорили вдвое, а до покупателей доходит столько же задач. Почему?', 'Development was made twice as fast, yet as many tasks reach the customers as before. Why?'),
    options: [
      { id: 'bn', text: bi('Узкое место — не разработка: выход задаёт самый медленный этап, а лишняя работа копится перед ним', 'Development is not the bottleneck: the slowest stage sets the output, and extra work piles up in front of it'), correct: true },
      { id: 'lazy', text: bi('Разработчики стали работать хуже', 'The developers started to work worse'), why: bi('Они делают вдвое больше — только эта работа ждёт в очереди перед медленным этапом.', 'They produce twice as much; that work simply waits in the queue before the slow stage.') },
      { id: 'time', text: bi('Нужно подождать: эффект будет позже', 'Wait: the effect will come later'), why: bi('Пока узкое место то же, эффекта не будет: очередь перед ним будет только расти.', 'While the bottleneck stays the same, there will be no effect: the queue in front of it will only grow.') },
    ],
  },
  {
    id: 'method.q.tester-dilemma',
    kind: 'mcq',
    concepts: ['method.swarming', 'method.five-steps'],
    key: true,
    prompt: bi('Тестировщик один и не успевает, разработчики свободны. Что сделать в первую очередь?', 'There is one tester who cannot keep up, and the developers are free. What should be done first?'),
    options: [
      { id: 'help', text: bi('Разработчики помогают проверять, новые функции не начинают', 'The developers help with testing and do not start new features'), correct: true },
      { id: 'new', text: bi('Разработчики берут новые функции, чтобы не простаивать', 'The developers take new features so as not to sit idle'), why: bi('Новые функции лягут в очередь перед проверкой: время цикла вырастет, выход — нет.', 'New features go into the queue before testing: cycle time grows, output does not.') },
      { id: 'hire', text: bi('Нанять второго тестировщика', 'Hire a second tester'), why: bi('Допустимо, но это шаг «расширить» — дорогой и медленный. Сначала «использовать» и «подчинить».', 'Acceptable, but it is the “elevate” step — expensive and slow. First “exploit” and “subordinate”.') },
      { id: 'limit', text: bi('Поднять лимит колонки «Проверка»', 'Raise the limit of the Testing column'), why: bi('Лимит выше — очередь длиннее; тестировщик от этого быстрее не станет. Это прячет проблему.', 'A higher limit means a longer queue; the tester does not get faster. It hides the problem.') },
    ],
  },
  // ── methodology.batch ──
  {
    id: 'method.q.cd3',
    kind: 'mcq',
    concepts: ['method.cod'],
    prompt: bi('Функция A: стоимость задержки 10 000 ₽ в неделю, работы на 2 недели. Функция B: 6 000 ₽ в неделю, работы на 1 неделю. Что делать первым по CD3?', 'Feature A: cost of delay 10,000 ₽ a week, 2 weeks of work. Feature B: 6,000 ₽ a week, 1 week of work. What goes first by CD3?'),
    options: [
      { id: 'b', text: bi('B: CD3 = 6 000 против 5 000 у A', 'B: CD3 = 6,000 against 5,000 for A'), correct: true },
      { id: 'a', text: bi('A: у неё больше стоимость задержки', 'A: its cost of delay is higher'), why: bi('Стоимость задержки нужно делить на длительность. Пока делают A (2 недели), B теряет 12 000; пока делают B (1 неделя), A теряет 10 000.', 'The cost of delay must be divided by the duration. While A is built (2 weeks), B loses 12,000; while B is built (1 week), A loses 10,000.') },
      { id: 'same', text: bi('Без разницы', 'It does not matter'), why: bi('Разница — 2 000 ₽ на одной паре функций; на потоке из десятков карточек порядок решает много.', 'The difference is 2,000 ₽ for one pair; over a flow of dozens of cards the order decides a lot.') },
    ],
  },
  {
    id: 'method.q.batch-why',
    kind: 'multi',
    concepts: ['method.batch'],
    prompt: bi('Почему одна выкладка из 20 изменений хуже 20 выкладок по одному? Отметьте всё верное.', 'Why is one deployment of 20 changes worse than 20 deployments of one? Mark everything that is true.'),
    options: [
      { id: 'risk', text: bi('Риск, что выкладка сломает сайт, выше', 'The risk that the deployment breaks the site is higher'), correct: true },
      { id: 'find', text: bi('Если сломалось, дольше искать, какое изменение виновато', 'If it breaks, finding the faulty change takes longer'), correct: true },
      { id: 'wait', text: bi('Первые изменения дольше ждут, пока наберётся партия', 'The first changes wait longer for the batch to fill'), correct: true },
      { id: 'cost', text: bi('Одна выкладка всегда дешевле двадцати — значит, большая партия лучше', 'One deployment is always cheaper than twenty, so the big batch is better'), why: bi('Так бывает, только пока выкладка ручная и дорогая. Когда выкладку делает машина, она почти бесплатна, и этот довод пропадает.', 'That holds only while a deployment is manual and expensive. When a machine does the deployment it is almost free, and the argument disappears.') },
    ],
  },
  {
    id: 'method.q.batch-first',
    kind: 'mcq',
    concepts: ['method.batch'],
    prompt: bi('Двадцать монет, четыре станции, каждая переворачивает монету за t. Когда покупатель получит первую монету при партии 1, если при партии 20 — через 80t?', 'Twenty coins, four stations, each flips a coin in t. When does the customer get the first coin with a batch of 1, if with a batch of 20 it takes 80t?'),
    options: [
      { id: '4t', text: '4t', correct: true },
      { id: '20t', text: '20t', why: bi('20t — первая монета при партии 5: партию из пяти нужно перевернуть на каждой из четырёх станций.', '20t is the first coin with a batch of 5: a batch of five has to be flipped at each of the four stations.') },
      { id: '80t', text: '80t', why: bi('Люди работают с той же скоростью, но первая монета не ждёт остальных девятнадцать на каждой станции.', 'People work at the same speed, but the first coin does not wait for the other nineteen at each station.') },
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
      { id: 'inc', left: bi('Инкремент', 'Increment'), right: bi('Критерии готовности', 'Definition of Done'), why: bi('Инкремент считается сделанным только когда отвечает критериям готовности.', 'An Increment counts as done only when it meets the Definition of Done.') },
    ],
  },
  {
    id: 'method.q.scrum-master',
    kind: 'mcq',
    concepts: ['method.scrum'],
    prompt: bi('Чем Scrum-мастер отличается от руководителя, который раздаёт задачи?', 'How does a Scrum Master differ from a manager who hands out tasks?'),
    options: [
      { id: 'scrum', text: bi('Он отвечает за то, чтобы Scrum работал, а не за распределение задач: что делать, решают разработчики', 'They are accountable for Scrum working, not for assigning tasks: the Developers decide how to do the work'), correct: true },
      { id: 'same', text: bi('Ничем, это новое название руководителя', 'No difference, it is a new name for a manager'), why: bi('По Scrum Guide в команде нет иерархии, а разработчики сами решают, как превратить бэклог в инкремент.', 'By the Scrum Guide the team has no hierarchy, and the Developers themselves decide how to turn the backlog into an Increment.') },
      { id: 'po', text: bi('Он решает, что важнее для продукта', 'They decide what matters most for the product'), why: bi('Это ответственность владельца продукта: максимальная ценность продукта и порядок бэклога.', 'That is the Product Owner’s accountability: maximising the value of the product and ordering the backlog.') },
    ],
  },
  {
    id: 'method.q.scrum-wip',
    kind: 'mcq',
    concepts: ['method.scrum', 'method.kanban'],
    prompt: bi('Может ли Scrum-команда ограничивать незавершённую работу внутри спринта?', 'May a Scrum Team limit work in progress inside a Sprint?'),
    options: [
      { id: 'yes', text: bi('Да: Scrum и Kanban совместимы, это описано в Kanban Guide for Scrum Teams', 'Yes: Scrum and Kanban are compatible, as described in the Kanban Guide for Scrum Teams'), correct: true },
      { id: 'no', text: bi('Нет: в Scrum лимит — сам спринт', 'No: in Scrum the limit is the Sprint itself'), why: bi('Спринт ограничивает работу по времени, но не мешает ограничить её и по числу карточек.', 'A Sprint limits work by time but does not prevent limiting it by the number of cards as well.') },
    ],
  },
  {
    id: 'method.q.sle',
    kind: 'mcq',
    concepts: ['method.kanban', 'method.percentile'],
    prompt: bi('Что такое ожидание уровня обслуживания (SLE) в Kanban Guide?', 'What is a service level expectation (SLE) in the Kanban Guide?'),
    options: [
      { id: 'sle', text: bi('Прогноз, за сколько должна пройти путь единица работы: например, «85% — за 8 дней или быстрее»', 'A forecast of how long a work item should take to get through, for example “85% in 8 days or less”'), correct: true },
      { id: 'sla', text: bi('Договор с клиентом со штрафами', 'A contract with a client, with penalties'), why: bi('Это скорее соглашение об уровне услуг. SLE — внутренний прогноз команды по истории времени цикла.', 'That is closer to a service level agreement. An SLE is the team’s internal forecast based on cycle time history.') },
      { id: 'avg', text: bi('Среднее время цикла', 'The average cycle time'), why: bi('Среднее не годится для обещаний: половина карточек дольше. SLE строят по процентилю.', 'An average is no good for promises: half the cards take longer. An SLE is built on a percentile.') },
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
      { id: 'ch', left: bi('Продлить договор хостинга по графику', 'Renew the hosting contract on schedule'), right: bi('изменение', 'change'), why: bi('Плановая текущая работа. Если договор уже истёк и сайт лёг — это стало бы незапланированной работой.', 'Planned routine work. Had the contract already expired and the site gone down, it would have become unplanned work.') },
      { id: 'up', left: bi('Сайт не открывается у покупателей', 'The site does not open for customers'), right: bi('незапланированная работа', 'unplanned work') },
    ],
  },
  {
    id: 'method.q.toil-signs',
    kind: 'multi',
    concepts: ['method.toil'],
    prompt: bi('Какие признаки делают работу рутиной (toil) по книге Google «Site Reliability Engineering»? Отметьте всё верное.', 'Which signs make work toil according to Google’s “Site Reliability Engineering” book? Mark everything that is true.'),
    options: [
      { id: 'manual', text: bi('Ручная и повторяющаяся', 'Manual and repetitive'), correct: true },
      { id: 'grows', text: bi('Растёт вместе с сервисом', 'Grows with the service'), correct: true },
      { id: 'novalue', text: bi('Не оставляет долговременной пользы', 'Leaves no enduring value'), correct: true },
      { id: 'boring', text: bi('Скучная', 'Boring'), why: bi('Скука — не признак. Разбор интересного сбоя руками каждый раз — тоже рутина, если его можно автоматизировать.', 'Boredom is not a sign. Handling an interesting outage by hand every time is toil too, if it can be automated.') },
      { id: 'meetings', text: bi('Совещания и планирование', 'Meetings and planning'), why: bi('Это накладные расходы, а не рутина: они не растут линейно с числом покупателей.', 'That is overhead, not toil: it does not grow linearly with the number of customers.') },
    ],
  },
  {
    id: 'method.q.hire-vs-automate',
    kind: 'mcq',
    concepts: ['method.toil', 'method.automation'],
    prompt: bi('Эксплуатация тратит 70% времени на ручную выдачу доступов. Почему нанять второго инженера — слабое решение?', 'Operations spends 70% of its time granting access by hand. Why is hiring a second engineer a weak decision?'),
    options: [
      { id: 'grows', text: bi('Рутина растёт вместе с сервисом: через какое-то время её хватит на двоих, а скрипт снял бы её навсегда', 'Toil grows with the service: in time there will be enough for two, while a script would remove it for good'), correct: true },
      { id: 'money', text: bi('Потому что дорого', 'Because it is expensive'), why: bi('Деньги важны, но главное — нанятый человек тоже будет выдавать доступы руками, а заявок станет больше.', 'Money matters, but the point is that the new person will also grant access by hand, and requests will grow.') },
      { id: 'never', text: bi('Нанимать людей в эксплуатацию никогда не нужно', 'Operations should never hire'), why: bi('Нанимать бывает нужно. Но на рутину отвечают автоматизацией, иначе новый человек утонет в ней так же.', 'Hiring is sometimes needed. But toil is answered with automation; otherwise the new person drowns in it the same way.') },
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
      { id: 'ci', left: bi('Все сливают изменения в общую ветку каждый день, каждое слияние собирается и проверяется; на прод выкладывают раз в квартал вручную', 'Everyone merges into the shared branch daily, each merge is built and tested; production is deployed by hand once a quarter'), right: bi('только непрерывная интеграция', 'continuous integration only'), why: bi('Интеграция есть, но изменение не готово к выкладке в любой момент: выкладка — квартальный ручной проект.', 'Integration is there, but a change is not ready to release at any moment: deployment is a quarterly manual project.') },
      { id: 'cdel', left: bi('Каждое проверенное изменение можно выложить на прод в любой момент одной кнопкой', 'Every checked change can be deployed to production at any moment with one button'), right: bi('непрерывная доставка', 'continuous delivery') },
      { id: 'cdep', left: bi('Каждое изменение, прошедшее проверки, уходит на прод само', 'Every change that passed the checks goes to production by itself'), right: bi('непрерывное развёртывание', 'continuous deployment'), why: bi('Разница с доставкой — нет ручного решения на последнем шаге.', 'The difference from delivery: no manual decision at the last step.') },
    ],
  },
  {
    id: 'method.q.release-branch',
    kind: 'mcq',
    concepts: ['method.ci'],
    prompt: bi('Команда работает в своих ветках по три недели, а на каждое обновление ветки автоматически запускаются тесты. Это непрерывная интеграция?', 'The team works in their own branches for three weeks, and tests run automatically on every update of a branch. Is this continuous integration?'),
    options: [
      { id: 'no', text: bi('Нет: изменения не сливают в общую ветку хотя бы раз в день', 'No: changes are not merged into the shared branch at least daily'), correct: true },
      { id: 'yes', text: bi('Да: тесты запускаются автоматически', 'Yes: tests run automatically'), why: bi('Автотесты — только половина. Интеграция значит частое слияние в общую ветку; через три недели слияние будет болезненным.', 'Automated tests are only half. Integration means merging into the shared branch often; after three weeks the merge will hurt.') },
    ],
  },
  {
    id: 'method.q.red-build',
    kind: 'bugfind',
    concepts: ['method.ci'],
    prompt: bi('Это договорённость команды о непрерывной интеграции. Какая строка ломает её смысл?', 'This is a team’s working agreement on continuous integration. Which line breaks its point?'),
    lang: 'yaml',
    code: 'integration:\n  merge_to_main: at_least_daily\n  on_every_merge: [build, unit_tests]\n  when_build_is_red: keep_merging   # we fix it on Friday\n  when_build_is_green: deploy_to_staging',
    bug: [4],
    why: {
      1: bi('Заголовок договорённости — здесь ничего не нарушено.', 'The heading of the agreement; nothing is broken here.'),
      2: bi('Сливать хотя бы раз в день — ядро определения.', 'Merging at least daily is the core of the definition.'),
      3: bi('Каждое слияние собирается и проверяется — так и должно быть.', 'Every merge is built and tested, as it should be.'),
      4: bi('Красную проверку чинят первым делом. Если продолжать сливать поверх красного, ошибки накапливаются и уже непонятно, какое изменение что сломало.', 'A red build is fixed first. Merging on top of red piles up mistakes until nobody can tell which change broke what.'),
      5: bi('Выкладка на стенд после зелёной проверки — уже шаг конвейера к доставке.', 'Deploying to staging after a green build is already a pipeline step towards delivery.'),
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
      { id: 'tests', text: bi('Автотесты', 'Automated tests'), why: bi('На этом заканчивается непрерывная интеграция.', 'Continuous integration ends here.') },
      { id: 'staging', text: bi('Выкладка на стенд', 'Deployment to staging') },
      { id: 'check', text: bi('Проверка на стенде', 'Checks on staging') },
      { id: 'prod', text: bi('Выкладка на прод', 'Deployment to production'), why: bi('Кнопкой — непрерывная доставка; сама — непрерывное развёртывание.', 'By a button: continuous delivery; by itself: continuous deployment.') },
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
      { id: 'df', text: bi('Частота развёртываний', 'Deployment frequency'), why: bi('Это пропускная способность доставки: как часто изменения доходят до прода.', 'That is delivery throughput: how often changes reach production.') },
      { id: 'lt', text: bi('Время внесения изменения', 'Change lead time'), why: bi('Это пропускная способность: как быстро готовое изменение доходит до прода.', 'That is throughput: how fast a finished change reaches production.') },
      { id: 'rec', text: bi('Время восстановления после неудачного развёртывания', 'Failed deployment recovery time'), why: bi('С 2024 года DORA относит его к пропускной способности: это скорость, с которой команда возвращает прод в строй.', 'Since 2024 DORA places it under throughput: it is the speed at which the team brings production back.') },
    ],
  },
  {
    id: 'method.q.dora-less-often',
    kind: 'mcq',
    concepts: ['method.dora', 'method.batch'],
    key: true,
    prompt: bi('Руководитель: «Будем выкладываться реже, зато надёжнее». Что об этом говорят исследования DORA?', 'A manager: “We will deploy less often but more safely.” What does DORA research say about it?'),
    options: [
      { id: 'together', text: bi('У большинства команд скорость и стабильность связаны положительно: частые маленькие изменения проще выкладывать и откатывать', 'For most teams speed and stability go together: small frequent changes are easier to deploy and to roll back'), correct: true },
      { id: 'balance', text: bi('Нужно найти баланс между скоростью и стабильностью', 'One has to find a balance between speed and stability'), why: bi('Распространённое заблуждение: оно предполагает, что одно выменивается на другое. Данные DORA показывают обратное — уменьшение партии улучшает обе группы метрик.', 'A common misconception: it assumes one is traded for the other. DORA data show the opposite: smaller batches improve both groups of metrics.') },
      { id: 'right', text: bi('Руководитель прав: меньше выкладок — меньше сбоев', 'The manager is right: fewer deployments, fewer outages'), why: bi('Реже выкладки — больше партия, а риск большой партии выше. Число сбоев может и вырасти.', 'Fewer deployments mean bigger batches, and the risk of a big batch is higher. The number of outages may even grow.') },
    ],
  },
  {
    id: 'method.q.cfr-calc',
    kind: 'mcq',
    concepts: ['method.dora'],
    prompt: bi('За две недели — 10 плановых выкладок. После двух понадобился откат, после одной — хотфикс. Какова доля неудачных изменений?', 'In two weeks there were 10 planned deployments. Two needed a rollback, one a hotfix. What is the change fail rate?'),
    options: [
      { id: '30', text: '30%', correct: true },
      { id: '20', text: '20%', why: bi('Хотфикс — тоже немедленное вмешательство. Неудачных — три из десяти.', 'A hotfix is also immediate intervention. Three out of ten failed.') },
      { id: '27', text: '27%', why: bi('Хотфикс делит выкладки на 11, но доля неудачных изменений считается от плановых выкладок: 3 / 10. Сам хотфикс пойдёт в долю внеплановых развёртываний.', 'Dividing by 11 counts the hotfix as a deployment, but change fail rate is taken over the planned deployments: 3 / 10. The hotfix itself goes into the deployment rework rate.') },
    ],
  },
  {
    id: 'method.q.goodhart',
    kind: 'mcq',
    concepts: ['method.goodhart'],
    prompt: bi('Команде пообещали премию за 50 развёртываний в неделю. Что, скорее всего, произойдёт?', 'A team was promised a bonus for 50 deployments a week. What is most likely to happen?'),
    options: [
      { id: 'game', text: bi('Частоту накрутят пустыми или дроблёными выкладками: прибор зелёный, ценности не прибавилось', 'The frequency gets inflated with empty or chopped-up deployments: the gauge is green, no value was added'), correct: true },
      { id: 'better', text: bi('Команда станет доставлять ценность быстрее', 'The team will deliver value faster'), why: bi('Цель — число выкладок, а не ценность; самый дешёвый путь к цели — выкладывать что угодно. Это закон Гудхарта.', 'The target is the number of deployments, not value; the cheapest way to it is to deploy anything. That is Goodhart’s law.') },
    ],
  },
  // ── methodology.sre ──
  {
    id: 'method.q.nines',
    kind: 'mcq',
    concepts: ['method.error-budget'],
    key: true,
    prompt: bi('Цель доступности — 99,9% за 30 дней. Сколько минут полной недоступности она допускает?', 'The availability target is 99.9% over 30 days. How many minutes of full downtime does it allow?'),
    options: [
      { id: '43', text: bi('43,2 минуты', '43.2 minutes'), correct: true },
      { id: '4', text: bi('4,32 минуты', '4.32 minutes'), why: bi('Это для 99,99% — на одну девятку больше. Каждая девятка вдесятеро уменьшает бюджет.', 'That is for 99.99%, one more nine. Each nine cuts the budget tenfold.') },
      { id: '432', text: bi('432 минуты', '432 minutes'), why: bi('Это для 99%: 1% от 43 200 минут.', 'That is for 99%: 1% of 43,200 minutes.') },
    ],
    explain: bi('(1 − 0,999) × 30 × 24 × 60 = 43,2. Это около 10 минут в неделю.', '(1 − 0.999) × 30 × 24 × 60 = 43.2. That is about 10 minutes a week.'),
  },
  {
    id: 'method.q.bad-minutes',
    kind: 'mcq',
    concepts: ['method.error-budget'],
    prompt: bi('Сбой длился 20 минут, и всё это время не проходило 10% запросов. Сколько плохих минут он потратил из бюджета SLO по запросам?', 'An outage lasted 20 minutes, and 10% of requests failed during all that time. How many bad minutes did it spend from a request-based SLO budget?'),
    options: [
      { id: '2', text: '2', correct: true },
      { id: '20', text: '20', why: bi('Так считают для полного простоя. SLO по запросам тратит бюджет пропорционально доле ошибок: 20 × 0,1.', 'That is how full downtime counts. A request-based SLO spends the budget in proportion to the error share: 20 × 0.1.') },
      { id: '0', text: '0', why: bi('Сайт работал, но 10% запросов не прошли — для этих покупателей это сбой, и бюджет тратится.', 'The site was up, but 10% of requests failed: for those customers it was an outage, and the budget is spent.') },
    ],
  },
  {
    id: 'method.q.freeze',
    kind: 'mcq',
    concepts: ['method.error-budget'],
    key: true,
    prompt: bi('Бюджет ошибок за последние четыре недели израсходован на 90%, но не превышен. Маркетинг хочет завтра выложить большое изменение. Что говорит пример политики из SRE Workbook?', 'The error budget for the last four weeks is 90% spent but not exceeded. Marketing wants a big change deployed tomorrow. What does the example policy in the SRE Workbook say?'),
    options: [
      { id: 'ok', text: bi('Политика выкладку не запрещает: выпуски останавливают, только когда бюджет превышен', 'The policy does not forbid it: releases stop only when the budget is exceeded'), correct: true },
      { id: 'stop', text: bi('Остановить все выпуски: бюджет почти кончился', 'Stop all releases: the budget is almost gone'), why: bi('Условие заморозки — превышение бюджета за окно, а не «почти». Разумно быть осторожнее, но политика этого не требует.', 'The freeze condition is the budget being exceeded over the window, not “almost”. Caution is reasonable, but the policy does not require it.') },
      { id: 'p0', text: bi('Разрешены только исправления P0 и безопасности', 'Only P0 and security fixes are allowed'), why: bi('Это исключения из заморозки, а заморозка начинается при превышении бюджета.', 'These are the exceptions to a freeze, and a freeze starts when the budget is exceeded.') },
    ],
  },
  {
    id: 'method.q.slo-sla',
    kind: 'mcq',
    concepts: ['method.slo'],
    prompt: bi('Чем SLO отличается от SLA?', 'How does an SLO differ from an SLA?'),
    options: [
      { id: 'contract', text: bi('SLO — внутренняя цель команды; SLA — обещание клиенту по договору с последствиями. SLO обычно строже', 'An SLO is the team’s internal target; an SLA is a contractual promise to a client with consequences. The SLO is usually stricter'), correct: true },
      { id: 'same', text: bi('Это одно и то же', 'They are the same'), why: bi('Цель и договор — разные вещи: нарушение SLO — повод заняться надёжностью, нарушение SLA — штраф или возврат денег.', 'A target and a contract are different things: missing an SLO is a reason to work on reliability, breaking an SLA means a penalty or a refund.') },
      { id: 'sli', text: bi('SLO — это то, что мерим', 'An SLO is what we measure'), why: bi('Что мерим — это SLI. SLO — цель для SLI за окно.', 'What we measure is the SLI. The SLO is a target for the SLI over a window.') },
    ],
  },
  {
    id: 'method.q.burn',
    kind: 'mcq',
    concepts: ['method.burn-rate'],
    prompt: bi('SLO — 99,9% успешных запросов за 30 дней. За последний час израсходовано 2% месячного бюджета ошибок. Какова скорость сжигания и что делать?', 'The SLO is 99.9% successful requests over 30 days. In the last hour 2% of the monthly error budget was spent. What is the burn rate and what to do?'),
    options: [
      { id: 'page', text: bi('14,4 — срочное оповещение, будить дежурного', '14.4: page, wake the on-call engineer'), correct: true },
      { id: 'ticket', text: bi('2 — завести тикет', '2: open a ticket'), why: bi('2% — доля бюджета, а не скорость. Скорость — доля бюджета, делённая на долю окна: 0,02 / (1 / 720) = 14,4.', '2% is a share of the budget, not the rate. The rate is the share of the budget divided by the share of the window: 0.02 / (1 / 720) = 14.4.') },
      { id: 'none', text: bi('0,02 — ничего не делать', '0.02: do nothing'), why: bi('В таком темпе весь бюджет кончится за 50 часов вместо 30 дней.', 'At this pace the whole budget is gone in 50 hours instead of 30 days.') },
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
      { id: 'status', text: bi('Первый статус в канал', 'The first status update in the channel'), why: bi('Статус идёт до диагностики: люди должны знать, что сбоем занимаются, даже если причина неизвестна.', 'The status goes before the diagnosis: people need to know the outage is being handled, even when the cause is unknown.') },
      { id: 'mitigate', text: bi('Смягчение: откат', 'Mitigation: rollback') },
      { id: 'confirm', text: bi('Восстановление подтверждено по данным', 'Recovery confirmed by the data') },
      { id: 'pm', text: bi('Разбор без поиска виноватых', 'A blameless postmortem'), why: bi('Причину ищут после восстановления: сначала покупатели снова могут платить.', 'The cause is looked for after recovery: first the customers can pay again.') },
    ],
  },
  {
    id: 'method.q.blameless-rewrite',
    kind: 'mcq',
    concepts: ['method.postmortem'],
    key: true,
    prompt: bi('В черновике разбора: «Сбой произошёл, потому что разработчик невнимательно запустил скрипт миграции на проде». Какая формулировка подходит для разбора без поиска виноватых?', 'The postmortem draft says: “The outage happened because a developer carelessly ran the migration script on production.” Which wording fits a blameless postmortem?'),
    options: [
      { id: 'cond', text: bi('Скрипт миграции можно запустить на проде без подтверждения, а имена баз на стенде и в проде совпадают', 'The migration script can run on production without confirmation, and the database names on staging and in production are the same'), correct: true },
      { id: 'soft', text: bi('Разработчик по ошибке запустил скрипт на проде', 'A developer ran the script on production by mistake'), why: bi('Мягче, но человек по-прежнему причина. Из этой фразы не следует ни одной задачи, кроме «быть внимательнее».', 'Softer, but a person is still the cause. No task follows from it except “be more careful”.') },
      { id: 'train', text: bi('Разработчика отправят на обучение работе с базами', 'The developer will be sent to a database course'), why: bi('Это мера против человека, а не против условий: следующий человек сделает ту же ошибку.', 'That is a measure against a person, not against the conditions: the next person will make the same mistake.') },
    ],
  },
  {
    id: 'method.q.what-visible',
    kind: 'mcq',
    concepts: ['method.postmortem'],
    prompt: bi('Почему на разборе спрашивают «что было видно в этот момент», а не «почему вы ошиблись»?', 'Why does a review ask “what could be seen at that moment” rather than “why did you make a mistake”?'),
    options: [
      { id: 'data', text: bi('Решение казалось разумным при тех данных, что были; так находят условия, которые надо менять, и люди продолжают рассказывать правду', 'The decision seemed reasonable given the data at hand; this finds the conditions to change, and people keep telling the truth'), correct: true },
      { id: 'polite', text: bi('Чтобы никого не обидеть', 'So as not to offend anyone'), why: bi('Вежливость — побочный эффект. Цель — информация: обвинение заставляет людей молчать.', 'Politeness is a side effect. The goal is information: blame makes people silent.') },
      { id: 'nobody', text: bi('Потому что в сбоях никто не ошибается', 'Because nobody makes mistakes in outages'), why: bi('Ошибки бывают. Но если ошибку было легко сделать, её сделает и следующий — менять надо условия.', 'Mistakes happen. But if a mistake was easy to make, the next person will make it too: the conditions must change.') },
    ],
  },
  {
    id: 'method.q.factors',
    kind: 'multi',
    concepts: ['method.postmortem'],
    prompt: bi('Какие пункты — способствующие факторы, а не оценки людей? Отметьте всё верное.', 'Which items are contributing factors rather than judgements of people? Mark everything that is true.'),
    options: [
      { id: 'alert', text: bi('Оповещение пришло через 40 минут после начала сбоя', 'The alert arrived 40 minutes after the outage began'), correct: true },
      { id: 'rollback', text: bi('Откат умеет делать только один человек', 'Only one person knows how to roll back'), correct: true },
      { id: 'confirm', text: bi('Скрипт на проде запускается без подтверждения', 'The script runs on production without confirmation'), correct: true },
      { id: 'careless', text: bi('Дежурный был невнимателен', 'The on-call engineer was careless'), why: bi('Оценка человека. Фактор был бы таким: «оповещение не отличало срочное от несрочного».', 'A judgement of a person. A factor would be: “the alert did not separate urgent from non-urgent”.') },
      { id: 'lazy', text: bi('Команда плохо тестирует', 'The team tests badly'), why: bi('Оценка, из которой не следует задача. Фактор: «нет автотеста на оформление заказа».', 'A judgement with no task in it. A factor: “there is no automated test of checkout”.') },
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
    prompt: bi('Сопоставьте букву CALMS и пример из блока.', 'Match each letter of CALMS with an example from this block.'),
    pairs: [
      { id: 'c', left: 'Culture', right: bi('общая цель разработки и эксплуатации', 'a shared goal of development and operations') },
      { id: 'a', left: 'Automation', right: bi('скрипт выдачи доступов', 'an access-request script') },
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
      { id: 'patho', text: bi('Патологическая', 'Pathological'), why: bi('Новость не спрятали и гонца не наказали — её пустили по регламенту. Это медленно, но не враждебно.', 'The news was not hidden and the messenger not punished; it was routed through procedure. Slow, but not hostile.') },
      { id: 'gen', text: bi('Генеративная', 'Generative'), why: bi('В генеративной культуре новость сразу ушла бы тем, кто может исправить.', 'In a generative culture the news would have gone at once to those who can fix it.') },
    ],
  },
];
