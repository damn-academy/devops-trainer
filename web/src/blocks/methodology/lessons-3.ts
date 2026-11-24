// Lessons 11–15: DORA metrics, SRE and the error budget, incidents and the
// blameless postmortem, culture and the full definition of DevOps, and the
// "Black Friday" practicum (07 §4: MT8–MT12).

import { bi } from '../../core/i18n';
import type { Lesson } from '../../core/types';
import { R, S } from './sources';

const CHECK = bi('Проверьте себя', 'Check yourself');
/** The Black Friday board on another seed than the practicum's, with the autopilot and the limits "people plus one" switched on before the prompt. */
const S2_AUTO = { ext: { flow: { scenario: 's2', seed: 21 } }, script: ['flow auto on', 'flow wip analysis 2', 'flow wip dev 3', 'flow wip test 2'] };

export const dora: Lesson = {
  id: 'methodology.dora',
  block: 'methodology',
  title: bi('Метрики DORA: скорость и стабильность', 'DORA metrics: speed and stability'),
  summary: bi('Пять метрик доставки изменений в двух группах, что исследования говорят о связи скорости и стабильности и почему метрику нельзя превращать в цель.', 'Five delivery metrics in two groups, what research says about speed and stability, Goodhart’s law.'),
  introduces: ['method.dora', 'method.goodhart'],
  uses: ['method.cycle-time', 'method.batch', 'method.rollback', 'method.cdelivery', 'method.outage', 'method.pipeline'],
  tier: 'core',
  minutes: 30,
  sources: { en: [S.doraMetrics, S.doraCapabilities, S.goodhartWiki], ru: [R.devops, R.goodhart] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'После неудачной выкладки руководитель говорит: «Будем выкладываться реже, раз в месяц, зато надёжнее». Это звучит разумно, ведь чем меньше выкладок, тем меньше поводов для сбоя. Что говорят об этом данные о тысячах команд?',
        'After a failed deployment the manager says: “We will deploy less often, once a month, but more safely.” It sounds reasonable: fewer deployments, fewer chances for an outage. What do the data about thousands of teams say?',
      ),
    },
    {
      id: 'five',
      kind: 'text',
      step: 'explain',
      title: bi('Пять метрик в двух группах', 'Five metrics'),
      body: bi(
        'Исследовательская программа DORA (DevOps Research and Assessment) с 2014 года опрашивает команды по всему миру и измеряет, как они доставляют изменения, пятью [[method.dora|метриками DORA]]. Метрики делятся на две группы.\n\nК **пропускной способности доставки** относятся три метрики:\n\n- **время внесения изменения** (change lead time) отсчитывают с момента, когда изменение попало в общий код (`commit`), и до момента, когда оно заработало на рабочем сайте;\n- **частота развёртываний** показывает, как часто изменения выкладывают на рабочий сайт;\n- **время восстановления после неудачного развёртывания** показывает, сколько длится сбой, вызванный выкладкой.\n\nК **нестабильности** относятся две метрики:\n\n- **доля неудачных изменений** (change fail rate) показывает, после какой доли выкладок понадобилось немедленное вмешательство, то есть откат или срочное исправление (хотфикс);\n- **доля внеплановых развёртываний** (deployment rework rate) показывает, какую долю выкладок пришлось сделать из-за инцидента на рабочем сайте, а не по плану.\n\nВремя внесения изменения отличается от времени выполнения, которое в уроке о незавершённой работе отсчитывали от появления карточки в очереди до её готовности. Время внесения изменения начинается не с идеи, а с того момента, когда код уже написан, и показывает, как быстро конвейер доводит готовое изменение до покупателей.',
        'The DORA research programme (DevOps Research and Assessment) has surveyed teams around the world since 2014 and measures the delivery of changes with five [[method.dora|DORA metrics]] in two groups.\n\n**Software delivery throughput:**\n\n- **change lead time**: from the moment the change entered the shared code (`commit`) to the moment it runs in production;\n- **deployment frequency**: how often changes are deployed to production;\n- **failed deployment recovery time**: how long an outage caused by a deployment lasts.\n\n**Instability:**\n\n- **change fail rate**: the share of deployments that needed immediate intervention, a rollback or a hotfix;\n- **deployment rework rate**: the share of deployments that had to be made because of an incident in production rather than by plan.\n\nChange lead time differs from the lead time of the lesson on work in progress, which ran from the card entering the queue to done: it starts not with the idea but when the code is already written, and shows how fast the pipeline brings a finished change to the customers.',
      ),
    },
    {
      id: 'finding',
      kind: 'text',
      step: 'explain',
      title: bi('Скорость и стабильность не враги', 'Speed and stability are not enemies'),
      body: bi(
        'Главный вывод исследований DORA описан в книге «Accelerate» Николь Форсгрен, Джеза Хамбла и Джина Кима: у большинства команд скорость и стабильность растут вместе. Команды, которые выкладывают изменения чаще, в среднем и ломают рабочий сайт реже, и восстанавливают его быстрее. Причина в механике, которая вам уже знакома: частые выкладки состоят из маленьких партий, а маленькая партия реже ломает сайт, причину сбоя в ней найти проще, и откатить её легко.\n\nПоэтому руководителю из начала урока можно ответить так. Если выкладываться раз в месяц, в каждую выкладку попадёт большая партия изменений, и риск каждой выкладки вырастет. Надёжнее выкладывать изменения чаще и понемногу, с автоматическими проверками и откатом.',
        'The main finding of DORA research, described in the book “Accelerate” by Nicole Forsgren, Jez Humble and Gene Kim: for most teams speed and stability go together. Teams that deploy more often, on average, also break production less often and recover faster. The reason is the mechanics you already know: frequent deployments are small batches, and a small batch breaks less often, its cause is easier to find, and it is easy to roll back.\n\nSo the answer to the manager in the hook: deploying once a month means carrying a big batch every time, and the risk of each deployment grows. Safer is to deploy more often and in smaller pieces, with automated checks and rollback.',
      ),
    },
    {
      id: 'goodhart',
      kind: 'callout',
      tone: 'warn',
      step: 'explain',
      title: bi('Когда метрика становится целью', 'A metric turned into a target'),
      body: bi(
        '[[method.goodhart|Закон Гудхарта]] в формулировке Мэрилин Стратерн звучит так: «когда мера становится целью, она перестаёт быть хорошей мерой». Пообещайте команде премию за 50 развёртываний в неделю, и вы получите 50 пустых выкладок. Показатель будет выглядеть отличным, хотя покупатели не получат ничего нового. DORA отдельно предупреждает, что метрики нужны самой команде, чтобы видеть, где улучшаться, а не для того, чтобы составлять рейтинги команд или назначать премии.',
        '[[method.goodhart|Goodhart’s law]] in Marilyn Strathern’s wording: “when a measure becomes a target, it ceases to be a good measure.” Promise a team a bonus for 50 deployments a week and you get 50 empty deployments: the gauge is green, and the customers got nothing new. DORA warns explicitly: the metrics are there for a team to see where to improve, not for ranking teams or paying bonuses.',
      ),
    },
    {
      id: 'practice',
      kind: 'terminal',
      step: 'practice',
      levels: ['beginner', 'intermediate'],
      machine: 'sim',
      setup: S2_AUTO,
      intro: bi(
        'Ниже доска магазина на 20 дней, на которой изменения выкладывают на рабочий сайт. После проверки готовые изменения ждут в колонке `deploy`, пока эксплуатация не выложит их, а пока что эксплуатация выкладывает их раз в пять дней. Автопилот уже включён, и лимиты по правилу «люди плюс один» тоже стоят. Вы прогоните доску дважды, сначала как есть, а потом с выкладкой раз в два дня, и сравните метрики DORA. Руководителю из начала урока как раз нужно такое сравнение.\n\nНа 3-й, 6-й и 12-й день доска остановится на записках. Ответьте на них так, как считаете правильным, или продолжайте командой `flow next 20`: тогда доска сама выберет первый вариант из списка. Команда `flow metrics` покажет метрики DORA по-английски: строка `deployments` показывает, сколько было выкладок, `change failure rate` показывает долю неудачных изменений (0,25 означает, что после каждой четвёртой выкладки понадобилось срочное вмешательство), а `lead time for changes (d)` показывает время внесения изменения в днях. Команда `flow reset` вернёт доску к первому дню вместе с автопилотом и лимитами.',
        'Below is a 20-day board of the shop on which changes are deployed to production. After testing, finished changes wait in the `deploy` column until operations deploys them, and for now operations deploys once every five days. The autopilot is on, and the limits by the rule “people plus one” are set too. You will run the board twice, first as it is and then with a deployment every two days, and compare the DORA metrics. The manager from the start of the lesson needs exactly this comparison.\n\nOn days 3, 6 and 12 the board stops on notes. Answer them as you think right, or carry on with `flow next 20`: then the board picks the first answer in the list itself. `flow metrics` shows the DORA metrics in English: `deployments` is how many deployments there were, `change failure rate` is the share of failed changes (0.25 means that every fourth deployment needed urgent intervention), and `lead time for changes (d)` is change lead time in days. `flow reset` takes the board back to day 1 together with the autopilot and the limits.',
      ),
      tasks: [
        {
          id: 'as-is',
          prompt: bi('Прогоните все 20 дней с выкладкой раз в пять дней: повторяйте `flow next 20`, пока доска не напишет, что прогон закончен. Потом посмотрите `flow metrics` и запомните три числа: `deployments`, `change failure rate` и `lead time for changes`.', 'Run all 20 days with a deployment every five days: repeat `flow next 20` until the board says the run is finished. Then look at `flow metrics` and remember three numbers: `deployments`, `change failure rate` and `lead time for changes`.'),
          check: {
            when: 'flow.finished=1 && flow.metrics.deploys<=5',
            stdout: 'lead time for changes',
            fail: [
              { if: 'flow.finished=1 && flow.metrics.deploys>5', say: bi('Прогон закончен, но выкладок было больше пяти: похоже, вы уже поменяли порядок выкладки. Для сравнения нужен прогон «как есть». Наберите `flow reset` и прогоните 20 дней, ничего не меняя в выкладке.', 'The run is over, but there were more than five deployments: it seems you changed the way of deploying already. The comparison needs a run “as it is”. Type `flow reset` and run the 20 days without changing the deployments.') },
              { if: 'flow.finished=1', say: bi('Прогон закончен, и осталось посмотреть метрики командой `flow metrics`.', 'The run is over. Look at the metrics with `flow metrics`.') },
            ],
          },
          chips: 'flow next 20',
          concepts: ['method.dora'],
          hints: {
            H1: bi('Команда `flow next 20` останавливается на каждой записке. Наберите её ещё раз, и доска продолжит.', '`flow next 20` stops at every note. Type it again, and the board goes on.'),
            H2: bi('Когда прогон закончится, доска напишет `the run is finished`. После этого наберите `flow metrics`.', 'When the run is over, the board writes `the run is finished`. Then type `flow metrics`.'),
            H3: bi('Наберите `flow next 20` четыре раза подряд, а потом `flow metrics`.', 'Type `flow next 20` four times in a row, then `flow metrics`.'),
          },
        },
        {
          id: 'often',
          prompt: bi('Наберите `flow reset`, чтобы вернуть доску к первому дню, и попросите эксплуатацию выкладывать изменения раз в два дня командой `flow policy deploy train:2`. Слово train означает «поезд»: выкладка уходит по расписанию, как поезд, и забирает всё, что успело её дождаться.', 'Type `flow reset` to take the board back to day 1, and tell operations to deploy every two days with `flow policy deploy train:2`. A train here is a deployment on a schedule: it leaves on time and takes everything that has made it to the platform.'),
          check: {
            when: 'flow.policies.deploy=train && flow.policies.deployEvery>=1 && flow.policies.deployEvery<=2',
            fail: [{ if: 'flow.policies.deploy=manual', say: bi('При порядке `manual` выкладка случается, только когда вы наберёте `flow deploy`. Для сравнения нужна выкладка по расписанию: наберите `flow policy deploy train:2`.', 'With `manual` a deployment happens only when you type `flow deploy`. The comparison needs deployments on a schedule: type `flow policy deploy train:2`.') }],
          },
          chips: 'flow policy deploy train:2',
          concepts: ['method.dora', 'method.batch'],
          hints: {
            H1: bi('Как часто выкладывать, решает команда `flow policy deploy`.', 'How often to deploy is set with `flow policy deploy`.'),
            H2: bi('Число после `train:` говорит, раз в сколько дней уходит выкладка. Сейчас стоит `train:5`.', 'The number after `train:` says how many days pass between deployments. Now it is `train:5`.'),
            H3: bi('Наберите `flow reset`, потом наберите `flow policy deploy train:2`.', 'Type `flow reset`, then type `flow policy deploy train:2`.'),
          },
        },
        {
          id: 'compare',
          prompt: bi('Снова прогоните 20 дней и посмотрите `flow metrics`. Цель выполнена, если выкладок не меньше восьми, а время внесения изменения не больше четырёх дней. Сравните все три числа с первым прогоном.', 'Run the 20 days again and look at `flow metrics`. The goal is met if there are at least eight deployments and change lead time is no more than four days. Compare all three numbers with the first run.'),
          check: {
            when: 'flow.finished=1 && flow.metrics.deploys>=8 && flow.metrics.changeLeadMedianDays<=4',
            stdout: 'lead time for changes',
            fail: [
              { if: 'flow.finished=1 && !flow.policies.wip.dev', say: bi('Лимитов на доске нет. Наберите `flow reset` и снова наберите `flow policy deploy train:2`.', 'The board has no limits. Type `flow reset` and type `flow policy deploy train:2` again.') },
              { if: 'flow.finished=1 && flow.decided.s2-release=freeze', say: bi('На записку 12-го дня вы ответили заморозкой выкладок, и шесть дней изменения никуда не уходили, поэтому выкладок мало, а изменения долго ждали. Выкладки замораживают, когда цель надёжности уже нарушена, и об этом пойдёт речь в следующем уроке. Наберите `flow reset` и пройдите прогон без заморозки.', 'You answered the day 12 note with a deployment freeze, and for six days no change went anywhere, so there are few deployments and changes waited long. Deployments are frozen when the reliability target is already broken, and the next lesson is about that. Type `flow reset` and do the run without the freeze.') },
              { if: 'flow.finished=1 && flow.metrics.deploys<=5', say: bi('Выкладок не больше пяти, как и бывает при выкладке раз в пять дней. Для сравнения наберите `flow reset` и до первого `flow next` наберите `flow policy deploy train:2`, иначе второй прогон повторит первый.', 'There are no more than five deployments, as there are with a deployment every five days. For the comparison type `flow reset` and type `flow policy deploy train:2` before the first `flow next`, or the second run repeats the first.') },
              { if: 'flow.finished=1 && flow.metrics.deploys>=8 && flow.metrics.changeLeadMedianDays<=4', say: bi('Прогон закончен, и осталось посмотреть метрики командой `flow metrics`.', 'The run is over. Look at the metrics with `flow metrics`.') },
            ],
          },
          chips: 'flow next 20',
          concepts: ['method.dora', 'method.batch'],
          hints: {
            H1: bi('Записки на 3-й, 6-й и 12-й день снова остановят доску. Ответьте на них или продолжайте командой `flow next 20`.', 'The notes on days 3, 6 and 12 stop the board again. Answer them or carry on with `flow next 20`.'),
            H2: bi('Выкладок должно стать примерно вдвое больше. Если их столько же, порядок выкладки не поменялся.', 'There should be about twice as many deployments. If there are as many as before, the way of deploying did not change.'),
            H3: bi('Наберите `flow next 20` четыре раза подряд, а потом `flow metrics`.', 'Type `flow next 20` four times in a row, then `flow metrics`.'),
          },
        },
      ],
    },
    { id: 'exit-practice', kind: 'quiz', step: 'exit', levels: ['beginner', 'intermediate'], title: bi('Что показала доска', 'What the board showed'), items: ['method.q.practice-dora'] },
    { id: 'exit', kind: 'quiz', step: 'exit', title: CHECK, items: ['method.q.dora-groups', 'method.q.dora-less-often', 'method.q.cfr-calc', 'method.q.goodhart'] },
  ],
};

export const sre: Lesson = {
  id: 'methodology.sre',
  block: 'methodology',
  title: bi('SRE: цель надёжности и бюджет ошибок', 'SRE: the reliability target and the error budget'),
  summary: bi('Чем различаются SLI, SLO и SLA, что такое бюджет ошибок и его политика и почему оповещения строят по скорости, с которой этот бюджет сгорает.', 'SLI, SLO and SLA; the error budget and its policy; alerting on the burn rate.'),
  introduces: ['method.sre', 'method.slo', 'method.error-budget', 'method.burn-rate'],
  uses: ['method.outage', 'method.dev-ops', 'method.percentile', 'method.toil', 'method.dora'],
  tier: 'core',
  minutes: 40,
  docStep: 2,
  sources: { en: [S.sreSlo, S.wbPolicy, S.wbAlerting, S.sreBook], ru: [R.sla, R.devops] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Владелец бизнеса просит: «Пусть сайт работает всегда, на все сто процентов». Почему инженеры, которые отвечают за самые большие сайты мира, считают такую цель ошибкой и что они ставят вместо неё?',
        'The business owner asks: “Let the site work always, one hundred percent.” Why do the engineers responsible for the largest sites in the world consider such a target a mistake, and what do they set instead?',
      ),
    },
    {
      id: 'sre',
      kind: 'text',
      step: 'explain',
      title: bi('Что такое SRE', 'SRE'),
      body: bi(
        '[[method.sre|SRE]] (Site Reliability Engineering) — подход к эксплуатации, который сложился в Google. Бен Трейнор Слосс, который создал этот подход, описывает его так: SRE получается, если поручить программисту спроектировать работу эксплуатации. Отсюда и черты SRE: надёжность измеряют числами и договариваются о ней заранее, с рутиной борются кодом, а сбои разбирают, чтобы они не повторялись.\n\nПочему цель не может быть равна 100 %? Каждая следующая девятка в цели обходится дороже предыдущей, а покупатель её не заметит, потому что его мобильная связь и домашний Wi-Fi сами работают не на 100 %. К тому же цель «никогда не ломаться» запрещает любые изменения, ведь каждое изменение несёт риск.',
        '[[method.sre|SRE]] (Site Reliability Engineering) is an approach to operations that took shape at Google. Ben Treynor Sloss, its founder, describes it like this: SRE is what happens when you ask a software engineer to design an operations function. Hence its traits: reliability is measured in numbers and agreed in advance, toil is fought with code, and outages are reviewed so that they do not repeat.\n\nWhy not 100%? Each next nine costs more than the previous one, and the customer will not notice it: their mobile network and home Wi-Fi do not work 100% of the time either. And a target of “never break” forbids any change, because every change carries a risk.',
      ),
    },
    {
      id: 'slo',
      kind: 'text',
      step: 'explain',
      title: bi('SLI, SLO и SLA', 'SLI, SLO, SLA'),
      body: bi(
        'Три похожих сокращения важно различать:\n\n- **SLI** (service level indicator) называет то, что мы измеряем, например долю успешных оформлений заказа или долю запросов, на которые сайт ответил быстрее 800 мс. Хороший индикатор описывает то, что видит покупатель, а не состояние сервера: процессор может быть в полном порядке, когда оплата не проходит;\n- [[method.slo|SLO]] (service level objective) называет цель, которую мы ставим для индикатора на определённый срок, например «99,5 % оформлений заказа успешны за 30 дней»;\n- **SLA** (service level agreement) называет то, что мы обещаем клиенту по договору, и то, что будет, если обещание не выполнено: скидку или возврат денег. SLO обычно ставят строже SLA, чтобы команда заметила проблему раньше, чем нарушит договор.',
        'Three similar words that matter to tell apart:\n\n- an **SLI** (service level indicator) is what we measure: the share of successful checkouts, the share of requests answered faster than 800 ms. A good indicator describes the customer’s experience, not the state of a server: the CPU may be fine while payments fail;\n- an [[method.slo|SLO]] (service level objective) is the target we set for an indicator over a window: “99.5% of checkouts succeed over 30 days”;\n- an **SLA** (service level agreement) is what we promise a client in a contract and what happens if we fail: a discount, a refund. An SLO is usually stricter than the SLA, so the team notices a problem before it breaks the contract.',
      ),
    },
    {
      id: 'budget',
      kind: 'text',
      step: 'explain',
      title: bi('Бюджет ошибок', 'The error budget'),
      body: bi(
        'Если цель равна 99,9 % за 30 дней, то оставшиеся 0,1 % составляют допустимую долю плохой работы. Её называют [[method.error-budget|бюджетом ошибок]], а период, за который считают цель, здесь 30 дней, называют **окном**:\n\n```text\nбюджет = (1 − SLO) × окно\n(1 − 0,999) × 30 дней × 24 ч × 60 мин = 43,2 минуты\n```\n\nЕсли SLO считают по запросам, бюджет тратится пропорционально доле ошибок. Минута, когда не проходит 10 % запросов, стоит десятую часть минуты полного простоя, поэтому 20 минут с 10 % ошибок забирают из бюджета 2 минуты.\n\nБюджет снимает спор, с которого начался блок: разработке нужны частые изменения, эксплуатации нужна стабильность, а каждое изменение несёт риск. Пока бюджет есть, его можно тратить на выкладки и эксперименты, а когда он кончился, команда занимается надёжностью. В SRE Workbook приведён пример такой политики: если за предыдущие четыре недели бюджет **превышен**, все изменения и выпуски останавливают, пока сервис не вернётся к своему SLO, и исключение делают только для исправлений самых срочных проблем, которые называют P0, и для исправлений безопасности. Обратите внимание на условие: если бюджет потрачен на 90 %, но не превышен, эта политика выкладку не запрещает.',
        'If the target is 99.9% over 30 days, then 0.1% is the allowed share of bad service. It is called the [[method.error-budget|error budget]], and the period the target is counted over, here 30 days, is called the **window**:\n\n```text\nbudget = (1 − SLO) × window\n(1 − 0.999) × 30 days × 24 h × 60 min = 43.2 minutes\n```\n\nA request-based SLO spends the budget in proportion to the error rate: a minute in which 10% of requests fail costs a tenth of a minute of full downtime. 20 minutes at 10% errors are 2 bad minutes.\n\nThe budget settles the argument the block started with — development wants frequent changes, operations wants stability, and every change carries a risk: while there is budget, it can be spent on deployments and experiments, and when it is gone, the team works on reliability. The SRE Workbook has an example of such a policy: if the error budget for the preceding four weeks is **exceeded**, all changes and releases are halted until the service is back within its SLO; the exceptions are fixes for the most urgent issues, called P0, and security fixes. Note the condition: a budget that is 90% spent but not exceeded does not forbid deployments under this policy.',
      ),
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Откройте заметки к примеру политики бюджета ошибок из SRE Workbook и найдите раздел, где сказано, что делать, когда бюджет превышен. Нажмите на этот раздел.', 'Open the notes on the example error budget policy from the SRE Workbook and find the section that says what to do when the budget is exceeded. Click that section.'),
      ref: { page: 'web/sre.google/workbook/error-budget-policy' },
      answer: 'POLICY',
    },
    {
      id: 'burn',
      kind: 'text',
      step: 'explain',
      title: bi('Скорость сжигания бюджета', 'Burn rate'),
      body: bi(
        'Когда будить человека ночью? Не при каждой ошибке, а тогда, когда бюджет тратится слишком быстро. [[method.burn-rate|Скорость сжигания]] показывает, во сколько раз быстрее нормы расходуется бюджет:\n\n```text\nскорость сжигания = доля ошибок / (1 − SLO)\n```\n\nПри скорости 1 бюджет закончится ровно к концу 30 дней. SRE Workbook в главе «Alerting on SLOs» предлагает три порога. Скорость 14,4 за последний час, то есть 2 % месячного бюджета за час, вызывает срочное оповещение, которое будит дежурного. Скорость 6 за последние 6 часов, то есть 5 % бюджета, тоже вызывает срочное оповещение. Скорость 1 за последние 3 дня, то есть 10 % бюджета, заводит заявку в рабочей очереди, и её разберут в рабочее время. Чтобы оповещение не продолжало звонить после того, как всё починили, к каждому окну добавляют короткое окно, 5 минут, 30 минут и 6 часов соответственно, и оповещение срабатывает, только если порог превышен в обоих окнах. Когда сбой исправлен, короткое окно быстро наполняется хорошими минутами, и оповещение замолкает.\n\nПри SLO 99,9 % доля ошибок 20 % даёт скорость 200, и оповещение придёт через несколько минут. Доля ошибок 0,2 % даёт скорость 2, и дело ограничится заявкой в рабочей очереди.',
        'When should a person be woken at night? Not at every error, but when the budget is being spent too fast. The [[method.burn-rate|burn rate]] shows how many times faster than normal it is being spent:\n\n```text\nburn rate = error ratio / (1 − SLO)\n```\n\nAt a burn rate of 1 the budget runs out exactly at the end of 30 days. The SRE Workbook (chapter “Alerting on SLOs”) suggests three thresholds: a burn rate of 14.4 over the last hour (2% of the monthly budget in an hour) is a page that wakes the on-call engineer; 6 over the last 6 hours (5% of the budget) is also a page; 1 over the last 3 days (10% of the budget) is a ticket for working hours. So that an alert does not linger after the fix, each window gets a short companion window, 5 minutes, 30 minutes and 6 hours respectively, and the alert fires only when the threshold is crossed in both. Once the outage is fixed, the short window quickly fills with good minutes, and the alert goes quiet.\n\nFor an SLO of 99.9%, an error ratio of 20% is a burn rate of 200: the page arrives within minutes. A ratio of 0.2% is a burn rate of 2: only a ticket.',
      ),
    },
    {
      id: 'burn-cheatsheet',
      kind: 'text',
      step: 'explain',
      levels: ['intermediate', 'experienced'],
      title: bi('Шпаргалка по оповещениям на скорость сжигания', 'A cheat sheet for burn-rate alerts'),
      body: bi(
        'Пороги из SRE Workbook удобно держать перед глазами списком. Каждая строка срабатывает, только если порог превышен и в длинном, и в коротком окне:\n\n- скорость 14,4 за 1 час и за 5 минут вызывает срочное оповещение, потому что за этот час сгорает 2 % месячного бюджета;\n- скорость 6 за 6 часов и за 30 минут тоже вызывает срочное оповещение, потому что за эти часы сгорает 5 % бюджета;\n- скорость 1 за 3 дня и за 6 часов заводит заявку в рабочей очереди, потому что за эти дни сгорает 10 % бюджета.\n\nПороги скорости не зависят от цели, а долю ошибок, при которой они срабатывают, получают умножением порога на (1 − SLO). При цели 99,9 % первый порог срабатывает при доле ошибок 14,4 × 0,1 % = 1,44 %, а при цели 99,5 % при доле ошибок 14,4 × 0,5 % = 7,2 %.',
        'The SRE Workbook thresholds are handy as a list. Each line fires only when the threshold is crossed in both the long and the short window:\n\n- a rate of 14.4 over 1 hour and over 5 minutes pages, because 2% of the monthly budget burns in that hour;\n- a rate of 6 over 6 hours and over 30 minutes also pages, because 5% of the budget burns in those hours;\n- a rate of 1 over 3 days and over 6 hours opens a ticket, because 10% of the budget burns in those days.\n\nThe rate thresholds do not depend on the target; the error share at which they fire is the threshold times (1 − SLO). For a 99.9% target the first threshold fires at an error share of 14.4 × 0.1% = 1.44%, for 99.5% at 14.4 × 0.5% = 7.2%.',
      ),
    },
    {
      id: 'burn-rule',
      kind: 'text',
      step: 'explain',
      levels: ['experienced'],
      title: bi('Как первая строка шпаргалки записывается для системы мониторинга', 'How the first line of the cheat sheet is written for a monitoring system'),
      body: bi(
        'Так первая строка шпаргалки записывается в настройках Prometheus, системы мониторинга, которую вы будете настраивать в блоке мониторинга. Выражение делит число неуспешных оформлений заказа на число всех оформлений за последний час и за последние пять минут и сравнивает обе доли с порогом 14,4 × 0,001 для цели 99,9 %:\n\n```yaml\ngroups:\n  - name: checkout-slo\n    rules:\n      - alert: CheckoutErrorBudgetBurnFast\n        expr: |\n          (\n            sum(rate(checkout_requests_total{result="error"}[1h]))\n              / sum(rate(checkout_requests_total[1h])) > 14.4 * 0.001\n          )\n          and\n          (\n            sum(rate(checkout_requests_total{result="error"}[5m]))\n              / sum(rate(checkout_requests_total[5m])) > 14.4 * 0.001\n          )\n        labels:\n          severity: page\n```\n\nВторая строка шпаргалки записывается так же, только с окнами `6h` и `30m` и порогом `6 * 0.001`. Третья строка получает окна `3d` и `6h`, порог `0.001` и метку `severity: ticket`, по которой система оповещений отправляет оповещение в очередь заявок, а не на телефон дежурного. На собеседовании об оповещениях по SLO часто спрашивают, зачем нужно короткое окно. Ответ такой: без него оповещение продолжало бы звонить ещё час после того, как сбой исправили, а с ним оно замолкает через несколько минут.',
        'This is how the first line of the cheat sheet is written in the settings of Prometheus, the monitoring system you will set up in the monitoring block. The expression divides failed checkouts by all checkouts over the last hour and over the last five minutes and compares both shares with the threshold 14.4 × 0.001 for a 99.9% target:\n\n```yaml\ngroups:\n  - name: checkout-slo\n    rules:\n      - alert: CheckoutErrorBudgetBurnFast\n        expr: |\n          (\n            sum(rate(checkout_requests_total{result="error"}[1h]))\n              / sum(rate(checkout_requests_total[1h])) > 14.4 * 0.001\n          )\n          and\n          (\n            sum(rate(checkout_requests_total{result="error"}[5m]))\n              / sum(rate(checkout_requests_total[5m])) > 14.4 * 0.001\n          )\n        labels:\n          severity: page\n```\n\nThe second line is the same with the windows `6h` and `30m` and the threshold `6 * 0.001`. The third gets the windows `3d` and `6h`, the threshold `0.001` and the label `severity: ticket`, by which the alerting system sends the alert to the ticket queue instead of the on-call engineer’s phone. Interviews on SLO alerting often ask why the short window is needed. The answer: without it the alert would keep ringing for an hour after the fix; with it, it goes quiet within minutes.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как сбой тратит бюджет ошибок', 'How an outage spends the error budget'),
      body: bi(
        'Схема ниже собирает всё, о чём говорилось выше, в одну цепочку для магазина. Сначала на ней только цель SLO в левом верхнем углу. Из цели получается бюджет ошибок в верхнем ряду, потом внизу случается сбой, его плохие минуты уходят по стрелке в бюджет, по доле ошибок считается скорость сжигания, и по этой скорости решается, будить ли дежурного. Последней справа вверху появляется политика бюджета, которая говорит, можно ли дальше выкладывать изменения.',
        'The diagram below puts everything above into one chain for the shop. At first it shows only the SLO target in the top left corner. The target gives the error budget in the top row, then an outage happens below, its bad minutes go along the arrow into the budget, the burn rate is computed from the error share, and the rate decides whether to wake the on-call engineer. The budget policy appears last, at the top right, and says whether changes may still be deployed.',
      ),
    },
    {
      id: 'look',
      kind: 'explainer',
      step: 'look',
      explainer: 'method.x.budget', howto: bi('Сначала пройдите расчёт до политики бюджета кнопкой «Шаг вперёд». Потом проделайте три опыта:\n\n1. Выберите в «Параметрах» цель 99,99 % и посмотрите, во сколько раз уменьшится бюджет.\n2. Верните 99,9 % и поставьте долю неуспешных запросов в 1 %. Схема спросит, разбудит ли теперь оповещение дежурного, и ответить стоит до того, как вы увидите результат.\n3. Включите в блоке «Сломать» оповещение по загрузке процессора и сравните, что изменится.', 'First go through the calculation up to the budget policy with “Step forward”. Then try three experiments:\n\n1. Choose a target of 99.99% in “Parameters” and see how many times the budget shrinks.\n2. Set 99.9% back and make the share of failing requests 1%. The diagram will ask whether the alert wakes the on-call engineer now, and it is worth answering before you see the result.\n3. Switch on the CPU-load alert in “Break it” and compare what changes.'),
      caption: bi(
        'Та же арифметика понадобится вам в вопросах ниже: сколько минут допускает цель, сколько плохих минут потратил сбой, какова скорость сжигания и что говорит политика, если бюджет почти кончился. Поломка с процессором тоже запомнится: в уроке об инцидентах сбой оплаты будет таким же тихим, если оповещение смотрит не на то, что видит покупатель.',
        'You will need the same arithmetic in the questions below: how many minutes a target allows, how many bad minutes an outage spent, what the burn rate is and what the policy says when the budget is almost gone. Remember the CPU break too: in the lesson on incidents a checkout failure will be just as silent if the alert does not watch what the customer sees.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: CHECK, items: ['method.q.nines', 'method.q.bad-minutes', 'method.q.freeze', 'method.q.slo-sla', 'method.q.burn'] },
  ],
};

export const incident: Lesson = {
  id: 'methodology.incident',
  block: 'methodology',
  title: bi('Как команда проходит инцидент от оповещения до разбора', 'How a team goes through an incident from the alert to the postmortem'),
  summary: bi('Как реагируют на инцидент: сначала восстановить сервис, потом искать причину; что делают дежурный и эскалация; как пишут разбор без поиска виноватых.', 'Response: restore first, find the cause later; on-call and escalation; the blameless postmortem.'),
  introduces: ['method.incident-response', 'method.postmortem'],
  uses: ['method.outage', 'method.rollback', 'method.burn-rate', 'method.slo', 'method.runbook', 'method.batch', 'method.error-budget'],
  tier: 'core',
  minutes: 40,
  sources: { en: [S.sreIncidents, S.srePostmortem, S.wbPostmortem, S.etsy], ru: [R.itil, R.devops] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В два часа ночи на рабочий сайт уходит выкладка, и через несколько минут телефон будит дежурного сообщением: «Доля успешных оплат упала до 80 %». В чате уже пишет владелец бизнеса: «Что происходит? Кто это сделал?». Нужно ли первым делом искать, чьё изменение сломало оплату, или начинать надо с чего-то другого?',
        'At two in the morning a deployment goes to production, and a few minutes later the on-call engineer’s phone wakes them up: “Checkout success: 80%.” The business owner is already writing in the chat: “What is going on? Who did this?” What comes first: finding whose change broke the checkout, or something else?',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Что происходит от ночной выкладки до задач на доске', 'What happens from the night deployment to the cards on the board'),
      body: bi(
        'Схема ниже проводит вас через один такой инцидент. Сначала на ней только ночная выкладка #41 и сайт магазина. Остальные участники появляются, когда до них доходит инцидент: мониторинг, который следит за долей успешных заказов, **дежурный**, то есть человек, который по графику отвечает за срочные оповещения, канал статуса, где дежурный пишет, что происходит, журнал выкладок, а на следующий день разбор и доска с новыми задачами. Если дежурный не подтвердил оповещение вовремя, оно уходит запасному дежурному, и такую передачу называют [[method.incident-response|эскалацией]]. Отчёт, который команда пишет на следующий день, называют [[method.postmortem|разбором без поиска виноватых]], потому что в нём ищут условия, из-за которых случился сбой, а не человека, который в нём виноват.',
        'The diagram below takes you through one such incident. At first it shows only the night deployment #41 and the shop’s site. The other participants appear when the incident reaches them: monitoring, which watches the share of successful orders; the **on-call engineer**, the person who answers pages according to the rota; the status channel, where the on-call engineer writes what is going on; the deployment log; and the next day the review and the board with new tasks. If the on-call engineer does not acknowledge a page in time, it goes to the secondary on-call engineer, and that handover is called [[method.incident-response|escalation]]. The report the team writes the next day is called a [[method.postmortem|blameless postmortem]], because it looks for the conditions that made the outage possible, not for a person to blame.',
      ),
    },
    {
      id: 'look',
      kind: 'explainer',
      step: 'look',
      explainer: 'method.x.incident', howto: bi('Сначала пройдите инцидент кнопкой «Шаг вперёд» до задач на доске. Потом меняйте условия по одному и для каждого замечайте, на каком шаге и на сколько минут сбой стал длиннее:\n\n1. Выберите в «Параметрах» другой способ замечать сбой, например проверку, что сервер отвечает.\n2. Выключите откат, а потом инструкцию для дежурного.\n3. Включите в блоке «Сломать» поломку, при которой на эту ночь не назначили основного дежурного.', 'First go through the incident with “Step forward” up to the tasks on the board. Then change the conditions one at a time and for each note at which step and by how many minutes the outage got longer:\n\n1. Choose another way of noticing the outage in “Parameters”, such as a check that the server answers.\n2. Switch off the rollback, then the runbook.\n3. Switch on the break in “Break it” that leaves this night without a primary on-call engineer.'),
      caption: bi(
        'Порядок, который вы видели на схеме, и есть ответ на вопрос из начала урока: сначала заметить, подтвердить и сообщить статус, потом откатить и вернуть покупателям оплату, и только на следующий день разбираться, почему это случилось. Ниже этот порядок записан по шагам, а в вопросах в конце урока вы расставите шаги сами и перепишете фразу из черновика разбора.',
        'The order you saw on the diagram is the answer to the question from the start of the lesson: first notice, acknowledge and post a status, then roll back and give the customers their checkout back, and only the next day work out why it happened. Below this order is written out step by step, and in the questions at the end of the lesson you will put the steps in order yourself and rewrite a sentence from a postmortem draft.',
      ),
    },
    {
      id: 'response',
      kind: 'text',
      step: 'explain',
      title: bi('Как реагируют на инцидент', 'Response'),
      body: bi(
        '[[method.incident-response|Реагирование на инцидент]] держится на одном правиле, по которому сначала восстанавливают сервис и только потом ищут причину. Пока ищут виноватое изменение, покупатели не могут оплатить заказ. Поэтому порядок такой:\n\n1. **Обнаружение.** О сбое сообщает оповещение по скорости сжигания бюджета, а в худшем случае жалоба покупателя.\n2. **Подтверждение.** Дежурный подтверждает оповещение, то есть говорит «беру». Если он не подтвердил его за отведённое время, оповещение уходит запасному дежурному, и это называется **эскалацией**. Если дежурного не назначили и оповещение пришло всем сразу, его не берёт никто, потому что каждый думает, что ответит другой.\n3. **Статус.** Первое сообщение о статусе пишут в первые минуты, даже если причина неизвестна: что видим, что делаем и когда будет следующее сообщение. Владелец бизнеса читает канал статуса и не отвлекает дежурного вопросами.\n4. **Диагностика и смягчение.** Первым делом выясняют, что менялось последним. Быстрее всего сбой смягчает откат, при котором на сайт возвращают прошлую версию, а саму ошибку исправляют потом.\n5. **Восстановление** подтверждают по тем же данным, по которым заметили сбой.\n\nВ крупных инцидентах роли разделяют: координатор управляет работой, одни люди чинят, другие пишут статус. Инструкция для дежурного сокращает диагностику, и в тренажёре дежурный с инструкцией справляется с ней вдвое быстрее.',
        '[[method.incident-response|Incident response]] rests on one rule: restore the service first, look for the cause later. While people search for the faulty change, customers cannot pay. So the order is:\n\n1. **Detection.** A burn-rate alert or, worse, a customer complaint.\n2. **Acknowledgement.** The on-call engineer acknowledges: “mine”. If they do not acknowledge within the set time, the page goes to the secondary: that is **escalation**. When nobody is on call and a page goes “to everyone”, nobody takes it: each thinks someone else will answer.\n3. **Status.** The first update goes out in the first minutes, even without a cause: what we see, what we do, when the next update is. The business owner reads the status channel instead of pulling at the on-call engineer.\n4. **Diagnosis and mitigation.** The first question is what changed last. The fastest mitigation is a rollback: put the previous version back and fix later.\n5. **Recovery** is confirmed by the same data that showed the outage.\n\nIn big incidents the roles are split: an incident commander coordinates, others fix, someone else writes the status. A runbook makes diagnosis shorter; in the trainer, by half.',
      ),
    },
    {
      id: 'postmortem',
      kind: 'text',
      step: 'explain',
      title: bi('Разбор без поиска виноватых', 'The blameless postmortem'),
      body: bi(
        'После инцидента команда пишет [[method.postmortem|разбор без поиска виноватых]] (по-английски blameless postmortem). В разборе есть четыре части:\n\n- **хронология**, то есть факты со временем из всех источников: журнала выкладок, графиков, канала статуса и обращений в поддержку;\n- **влияние**, то есть сколько длился сбой, скольких покупателей он задел и сколько бюджета ошибок потратил;\n- **способствующие факторы**, то есть условия, из-за которых сбой стал возможен и затянулся: «скрипт миграции можно запустить на рабочем сайте без подтверждения», «оповещение пришло через 40 минут», «откат умеет делать только один человек»;\n- **задачи на улучшение** с владельцем и сроком, которые становятся карточками на доске.\n\nГлавный вопрос разбора звучит так: «что было видно в этот момент?», а не «почему вы ошиблись?». Сидни Деккер и руководство Etsy по проведению разборов объясняют, почему. Решение, которое задним числом выглядит ошибкой, в тот момент казалось человеку разумным при тех данных, которые у него были. Если за ошибки наказывают, люди перестают рассказывать, что видели, и организация лишается той самой информации, без которой сбой не предотвратить. Фраза «разработчик невнимательно запустил скрипт» ничего не чинит, а фраза «скрипт можно запустить на рабочем сайте без подтверждения, а базы на стенде и на рабочем сайте называются одинаково» даёт две задачи.',
        'After an incident the team writes a [[method.postmortem|blameless postmortem]]. It has:\n\n- a **timeline**: facts with times from every source — the deployment log, the graphs, the status channel, support tickets;\n- the **impact**: how long it lasted, how many customers it hit, how much error budget it spent;\n- **contributing factors**: the conditions that made the outage possible and long — “the migration script can run on production without confirmation”, “the alert came after 40 minutes”, “only one person can do a rollback”;\n- **action items** with an owner and a due date; they become cards on the board.\n\nThe central question of the review is “what could be seen at that moment?”, not “why did you make a mistake?”. Sidney Dekker and Etsy’s Debriefing Facilitation Guide explain why: a decision that looks like a mistake in hindsight seemed reasonable to the person at the time, given the data they had. When mistakes are punished, people stop telling what they saw, and the organisation loses exactly the information it needs to keep the outage from repeating. “The developer carelessly ran the script” fixes nothing; “the script can run on production without confirmation, and the database names on staging and in production are the same” gives two tasks.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: CHECK, items: ['method.q.response-order', 'method.q.blameless-rewrite', 'method.q.what-visible', 'method.q.factors'] },
  ],
};

export const culture: Lesson = {
  id: 'methodology.culture',
  block: 'methodology',
  title: bi('Культура и полное определение DevOps', 'Culture and the full definition of DevOps'),
  summary: bi('Три пути из «Руководства по DevOps», формула CALMS, типы организационной культуры по Веструму, полное определение DevOps и работа DevOps-инженера.', 'The Three Ways, CALMS, the Westrum typology, the full definition of DevOps and the role of a DevOps engineer.'),
  introduces: ['method.three-ways', 'method.calms', 'method.westrum', 'method.devops-engineer'],
  uses: ['method.devops', 'method.wip', 'method.batch', 'method.automation', 'method.postmortem', 'method.dora', 'method.error-budget', 'method.pipeline'],
  tier: 'core',
  minutes: 30,
  sources: { en: [S.devopsHandbook, S.doraCulture, S.westrum], ru: [R.devops, R.lean] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Автотест оплаты уже неделю завершается с ошибкой. Тестировщик знает об этом, разработчики догадываются, руководитель делает вид, что не слышал, а владелец продукта узнаёт обо всём от покупателей. Доска, лимиты и конвейер у этой команды такие же, как у любой другой. Что же у неё не так?',
        'The checkout test has been failing for a week. The tester knows, the developers suspect, the manager pretends not to have heard, and the product owner learns about it from the customers. This team has the same board, limits and pipeline as any other. What is wrong with it?',
      ),
    },
    {
      id: 'ways',
      kind: 'text',
      step: 'explain',
      title: bi('Три пути', 'The Three Ways'),
      body: bi(
        'Авторы «Руководства по DevOps» сводят методологию к [[method.three-ways|трём путям]], и каждый из них вы уже видели в механике этого блока:\n\n1. **Поток** идёт слева направо, от разработки к покупателю. Его поддерживают видимая работа на доске, лимиты WIP, маленькие партии, конвейер и работа с узким местом.\n2. **Обратная связь** идёт справа налево. Её дают автотесты, которые сообщают об ошибке через несколько минут, оповещения по бюджету ошибок, откат и метрики DORA.\n3. **Непрерывное обучение и эксперименты** держатся на разборах без поиска виноватых, на времени для улучшений вместо бесконечной рутины и на ретроспективах.',
        'The authors of “The DevOps Handbook” boil the methodology down to [[method.three-ways|the Three Ways]], and you have seen each of them in this block’s mechanics:\n\n1. **Flow** from left to right, from development to the customer: visible work on the board, WIP limits, small batches, the pipeline, working with the bottleneck.\n2. **Feedback** from right to left: automated tests that report a mistake in minutes, alerts on the error budget, rollback, the DORA metrics.\n3. **Continual learning and experimentation**: blameless postmortems, time for improvement instead of endless toil, retrospectives.',
      ),
    },
    {
      id: 'calms',
      kind: 'text',
      step: 'explain',
      title: bi('Формула CALMS', 'CALMS'),
      body: bi(
        'Другую короткую формулу называют [[method.calms|CALMS]]. Джон Уиллис и Деймон Эдвардс назвали четыре опоры DevOps (CAMS), а Джез Хамбл добавил к ним пятую, бережливость:\n\n- **Culture**, культура: общая ответственность за результат вместо «мы сделали, а они сломали»;\n- **Automation**, автоматизация сборки, проверок, выкладки и рутины;\n- **Lean**, бережливость: поток, лимиты и маленькие партии;\n- **Measurement**, измерение: время цикла, метрики DORA и бюджет ошибок;\n- **Sharing**, обмен знаниями: инструкции, работа в паре и разборы, открытые для всех.',
        'Another short formula is [[method.calms|CALMS]]. John Willis and Damon Edwards named four pillars of DevOps (CAMS), and Jez Humble added a fifth, lean:\n\n- **Culture**: shared responsibility for the result, not “we built it, they broke it”;\n- **Automation**: of the build, the checks, the deployment, the toil;\n- **Lean**: flow, limits, small batches;\n- **Measurement**: cycle time, the DORA metrics, the error budget;\n- **Sharing**: runbooks, pairing, postmortems open to everyone.',
      ),
    },
    {
      id: 'westrum',
      kind: 'text',
      step: 'explain',
      title: bi('Как в организации расходится плохая новость', 'How bad news travels'),
      body: bi(
        'Социолог Рон Веструм различает три типа организационной культуры по тому, как в организации движется информация. Это деление называют [[method.westrum|типологией Веструма]]:\n\n- **патологическая** культура ориентирована на власть: информацию прячут, того, кто принёс плохую новость, наказывают, а сбои скрывают;\n- **бюрократическая** культура ориентирована на правила: информация идёт медленно, по форме и по регламенту, а всё новое создаёт проблемы;\n- **генеративная** культура ориентирована на результат: информацию ищут и сразу передают тем, кому она нужна, а за неудачи не наказывают, их исследуют.\n\nКоманда из начала урока устроена патологически: плохая новость неделю не доходит до того, кто может её исправить. Исследования DORA показывают, что генеративная культура предсказывает и лучшие показатели доставки, и благополучие людей.',
        'The sociologist Ron Westrum distinguishes three types of organisational culture by how information moves through an organisation: the [[method.westrum|Westrum typology]]:\n\n- **pathological** (power-oriented): information is hidden, messengers are shot, failures are covered up;\n- **bureaucratic** (rule-oriented): information goes through forms and channels, slowly; novelty creates problems;\n- **generative** (performance-oriented): information is sought and passed on at once, failures lead to inquiry, not punishment.\n\nThe team in the hook is pathological: bad news takes a week to reach the person who can fix it. DORA research shows that a generative culture predicts both better delivery performance and people’s well-being.',
      ),
    },
    {
      id: 'loop',
      kind: 'text',
      step: 'explain',
      title: bi('Как механизмы блока складываются в одну систему', 'How the mechanisms of the block add up to one system'),
      body: bi(
        'Все механизмы этого блока связаны в одну петлю, и держать её в голове целиком полезно потому, что на работе вы почти всегда попадаете в неё с середины: с упавшей сборки, со сбоя или с вопроса «когда будет готово». Петля устроена так.\n\n1. Работа становится видимой на доске, а лимит незавершённой работы не даёт начинать больше, чем команда успевает закончить. По закону Литтла это и делает время цикла коротким и предсказуемым.\n2. Узкое место задаёт скорость всей системы, поэтому улучшения начинают с него, а не с того этапа, который проще ускорить.\n3. Готовое изменение уходит маленькой партией через конвейер. Непрерывная интеграция ловит ошибку через минуты после слияния, а выпуск одним действием человека или вовсе без него убирает ожидание дня выкладки.\n4. Метрики DORA показывают, как быстро и насколько надёжно изменения доходят до покупателей, а SLO и бюджет ошибок говорят, сколько риска команда может себе позволить прямо сейчас.\n5. Когда бюджет сгорает слишком быстро, оповещение будит дежурного. Дежурный сначала восстанавливает сервис откатом и только потом ищет причину.\n6. Разбор без поиска виноватых превращает способствующие факторы в задачи на улучшение, и эти задачи встают на ту же доску, с которой петля начиналась.\n\nПо этой петле удобно искать причину любой неполадки в процессе. Если задачи идут долго, смотрите на незавершённую работу и узкое место. Если выкладки ломают сайт, смотрите на размер партии, автотесты и откат. Если о сбоях узнают от покупателей, смотрите, по какому индикатору настроено оповещение. Если одни и те же сбои повторяются, проверьте, превратились ли факторы из разборов в карточки на доске и дошли ли эти карточки до конца.',
        'All the mechanisms of this block are linked into one loop, and it pays to keep the whole loop in mind, because at work you almost always enter it in the middle: with a red build, an outage or the question “when will it be ready”. The loop goes like this.\n\n1. Work becomes visible on the board, and a WIP limit stops the team from starting more than it can finish. By Little’s law this is what makes cycle time short and predictable.\n2. The bottleneck sets the speed of the whole system, so improvements start there, not at the stage that is easiest to speed up.\n3. A finished change goes through the pipeline in a small batch. Continuous integration catches a mistake minutes after the merge, and a release with one human action, or with none, removes the wait for the deployment day.\n4. The DORA metrics show how fast and how reliably changes reach the customers, while the SLO and the error budget say how much risk the team can afford right now.\n5. When the budget burns too fast, an alert wakes the on-call engineer, who restores the service with a rollback first and looks for the cause later.\n6. A blameless postmortem turns the contributing factors into action items, and these go onto the same board the loop started from.\n\nThe loop is a handy way to find the cause of any trouble in the process. If tasks take long, look at the work in progress and the bottleneck. If deployments break the site, look at batch size, automated tests and rollback. If outages are reported by customers, look at what indicator the alert watches. If the same outages repeat, check whether the factors from the postmortems became cards on the board and whether those cards got finished.',
      ),
    },
    {
      id: 'definition',
      kind: 'text',
      step: 'explain',
      title: bi('Полное определение DevOps', 'The full definition'),
      body: bi(
        'Теперь рабочее определение из первого урока блока можно дополнить. DevOps — это методология, при которой разработка и эксплуатация вместе отвечают за общий результат и добиваются его тремя путями: быстрым потоком маленьких изменений, быстрой обратной связью с рабочего сайта и постоянным обучением на собственных сбоях. Опирается эта методология на культуру общей ответственности, автоматизацию, бережливость, измерение и обмен знаниями.\n\n[[method.devops-engineer|DevOps-инженером]] называют человека, который внедряет эту методологию в команде. Его главный инструмент — автоматизация: он строит конвейер, автоматические проверки и выкладки, мониторинг и оповещения и избавляет команду от рутины скриптами. Всё это вы будете делать своими руками в следующих блоках курса и каждый раз будете знать, какое ожидание или какой риск в потоке ценности это убирает.',
        'Now the working definition from the first lesson of the block can be completed. DevOps is a methodology in which development and operations own one result together and reach it by three ways: a fast flow of small changes, fast feedback from production and continual learning from their own outages; it rests on a culture of shared responsibility, automation, lean, measurement and sharing.\n\nA [[method.devops-engineer|DevOps engineer]] is a person who puts this methodology into practice in a team. Their main tool is automation: they build the pipeline, automated checks and deployments, monitoring and alerts, and remove toil with scripts. You will do all of this by hand in the next blocks of the course, and each time you will know which wait or which risk in the value stream it removes.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: CHECK, items: ['method.q.ways-match', 'method.q.calms', 'method.q.westrum', 'method.q.devops-what'] },
  ],
};

export const blackFriday: Lesson = {
  id: 'methodology.black-friday',
  block: 'methodology',
  title: bi('Практикум «Чёрная пятница»', 'Practicum: Black Friday'),
  summary: bi('Всё, что было в блоке, на одной доске: поток, рутина, выкладки, инциденты и распродажа. В конце разбор сравнит ваш прогон с двумя эталонными командами.', 'Everything on one board: flow, toil, deployments, incidents and a sale. The debrief compares your run with two references.'),
  introduces: [],
  uses: ['method.wip', 'method.bottleneck', 'method.batch', 'method.toil', 'method.automation', 'method.rollback', 'method.error-budget', 'method.postmortem', 'method.dora', 'method.three-ways'],
  tier: 'core',
  minutes: 60,
  sources: { en: [S.devopsHandbook, S.doraMetrics, S.wbPolicy], ru: [R.devops, R.kanban] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Перед вами двадцать дней из жизни магазина. Команда работает по-старому: лимитов нет, эксплуатация выкладывает изменения руками раз в пять дней, рутины становится всё больше, а мониторинг замечает только полный отказ сервера. С 9-го по 11-й день эксплуатация в отпуске, а с 15-го по 17-й в магазине идёт распродажа. В бэклоге лежат пять улучшений. Решения принимаете вы: какие поставить лимиты, где поставить людей, какие улучшения сделать, как выкладывать изменения и что отвечать на записки.\n\nОчков здесь не начисляют. В конце разбор покажет ваш прогон рядом с двумя другими командами, которые прожили те же двадцать дней с теми же бросками кубиков и событиями: одна работала без методологии, другая служит эталоном. Разбор назовёт три ваших решения, которые изменили больше всего, и попросит объяснить результат своими словами.',
        'Twenty days in the life of the shop. The team works the old way: no limits, a deployment every five days by hand by operations, growing toil, monitoring that only sees the server go down. Operations is on leave on days 9–11, and days 15–17 are a sale. Five improvements lie in the backlog. Your decisions: limits, people, improvements, the way of deploying, answers to the memos.\n\nThis is not a game for points. At the end the debrief shows your run next to two other teams that lived the same twenty days with the same dice and events: a team without the method and a reference team. It names your three decisions that changed the most, and asks you to explain the result in your own words.',
      ),
    },
    { id: 'practice', kind: 'widget', step: 'practice', widget: 'flowlab.board', props: { scenario: 's2' } },
    {
      id: 'goal-check',
      kind: 'callout',
      tone: 'note',
      step: 'practice',
      title: bi('Как по разбору понять, выполнена ли цель', 'How to tell from the debrief whether the goal is met'),
      body: bi(
        'Цель прогона состоит из трёх условий, и каждое из них проверяется по таблице во втором разделе разбора, в столбце «вы».\n\n1. Три промо-функции должны дойти до покупателей к 14-му дню. Это условие выполнено, если в строке «Промо-задач к сроку» стоит число 3.\n2. Сайт должен работать во время распродажи, с 15-го по 17-й день. Если в строке «Потери от сбоев» стоит ноль, сайт не падал ни в эти дни, ни в другие. Если там стоит больше нуля, передвиньте ползунок в первом разделе разбора на 15-й, 16-й и 17-й день и посмотрите, есть ли в журнале этих дней оповещения о сбое, отмеченные крестиком.\n3. Итог по деньгам должен быть лучше, чем у команды без методологии. Об этом говорит первая половина фразы под таблицей: «На столько-то рублей лучше команды без методологии». Итог по деньгам складывается из выручки за готовые задачи за вычетом потерь от задержки, потерь от сбоев и дополнительных расходов, поэтому он может разойтись со сравнением одной строки с потерями.\n\nСравнение с эталонной командой, вторая половина той же фразы, к цели не относится: эталон показывает, сколько ещё можно выиграть.',
        'The goal of the run has three conditions, and each is checked against the table in the second section of the debrief, in the column “you”.\n\n1. Three promo features must reach the customers by day 14. This is met if the row “Promo tasks by the due day” shows 3.\n2. The site must work during the sale, days 15 to 17. If the row “Outage losses” shows zero, the site did not go down on those days or any others. If it shows more than zero, move the slider in the first section of the debrief to days 15, 16 and 17 and see whether the log of those days has outage alerts marked with a cross.\n3. The money result must beat the team without the method. The first half of the sentence under the table says so: “$… better than the team without the method”. The money result is the revenue from finished tasks minus the cost of delay, the outage losses and any extra spending, so it can differ from a comparison of a single loss row.\n\nThe comparison with the reference team, the second half of the same sentence, is not part of the goal: the reference shows how much more could be won.',
      ),
    },
    { id: 'review', kind: 'quiz', step: 'review', title: bi('Повторение блока', 'Block review'), items: ['method.q.little-calc', 'method.q.ci-cd-match', 'method.q.freeze', 'method.q.five-steps', 'method.q.dora-less-often', 'method.q.blameless-rewrite'] },
  ],
};
