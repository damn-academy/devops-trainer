// Lessons 11–15: DORA metrics, SRE and the error budget, incidents and the
// blameless postmortem, culture and the full definition of DevOps, and the
// "Black Friday" practicum (07 §4: MT8–MT12).

import { bi } from '../../core/i18n';
import type { Lesson } from '../../core/types';
import { R, S } from './sources';

export const dora: Lesson = {
  id: 'methodology.dora',
  block: 'methodology',
  title: bi('Метрики DORA: скорость и стабильность', 'DORA metrics: speed and stability'),
  summary: bi('Пять метрик доставки в двух группах, вывод исследований о скорости и стабильности, закон Гудхарта.', 'Five delivery metrics in two groups, what research says about speed and stability, Goodhart’s law.'),
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
        'После неудачной выкладки руководитель говорит: «Будем выкладываться реже, раз в месяц, зато надёжнее». Звучит разумно: меньше выкладок — меньше поводов для сбоя. Что об этом говорят данные о тысячах команд?',
        'After a failed deployment the manager says: “We will deploy less often, once a month, but more safely.” It sounds reasonable: fewer deployments, fewer chances for an outage. What do the data about thousands of teams say?',
      ),
    },
    {
      id: 'five',
      kind: 'text',
      step: 'explain',
      title: bi('Пять метрик', 'Five metrics'),
      body: bi(
        'Исследовательская программа DORA (DevOps Research and Assessment) с 2014 года опрашивает команды по всему миру и измеряет доставку изменений пятью [[method.dora|метриками DORA]] в двух группах.\n\n**Пропускная способность доставки:**\n\n- **время внесения изменения** (change lead time) — от момента, когда изменение попало в общий код (`commit`), до момента, когда оно работает в проде;\n- **частота развёртываний** — как часто изменения выкладывают на прод;\n- **время восстановления после неудачного развёртывания** — сколько длится сбой, вызванный выкладкой.\n\n**Нестабильность:**\n\n- **доля неудачных изменений** (change fail rate) — доля выкладок, после которых понадобилось немедленное вмешательство: откат или хотфикс;\n- **доля внеплановых развёртываний** (deployment rework rate) — доля выкладок, которые пришлось сделать из-за инцидента в проде, а не по плану.\n\nВремя внесения изменения отличается от времени выполнения из главы о потоке: оно начинается не с идеи, а с того момента, когда код уже написан, и показывает, насколько быстро конвейер доводит готовое изменение до покупателей.',
        'The DORA research programme (DevOps Research and Assessment) has surveyed teams around the world since 2014 and measures the delivery of changes with five [[method.dora|DORA metrics]] in two groups.\n\n**Software delivery throughput:**\n\n- **change lead time**: from the moment the change entered the shared code (`commit`) to the moment it runs in production;\n- **deployment frequency**: how often changes are deployed to production;\n- **failed deployment recovery time**: how long an outage caused by a deployment lasts.\n\n**Instability:**\n\n- **change fail rate**: the share of deployments that needed immediate intervention, a rollback or a hotfix;\n- **deployment rework rate**: the share of deployments that had to be made because of an incident in production rather than by plan.\n\nChange lead time differs from the lead time of the flow chapter: it starts not with the idea but when the code is already written, and shows how fast the pipeline brings a finished change to the customers.',
      ),
    },
    {
      id: 'finding',
      kind: 'text',
      step: 'explain',
      title: bi('Скорость и стабильность не враги', 'Speed and stability are not enemies'),
      body: bi(
        'Главный вывод исследований DORA, описанный в книге «Accelerate» Николь Форсгрен, Джеза Хамбла и Джина Кима: у большинства команд скорость и стабильность связаны положительно. Команды, которые выкладывают чаще, в среднем и ломают прод реже, и восстанавливаются быстрее. Причина — в механике, которую вы уже знаете: частые выкладки — это маленькие партии, а маленькая партия реже ломается, в ней проще найти причину и её легко откатить.\n\nПоэтому ответ руководителю из зацепки: выкладываться раз в месяц — значит каждый раз везти большую партию, и риск каждой выкладки вырастет. Надёжнее — выкладывать чаще и меньше, с автоматическими проверками и откатом.',
        'The main finding of DORA research, described in the book “Accelerate” by Nicole Forsgren, Jez Humble and Gene Kim: for most teams speed and stability go together. Teams that deploy more often, on average, also break production less often and recover faster. The reason is the mechanics you already know: frequent deployments are small batches, and a small batch breaks less often, its cause is easier to find, and it is easy to roll back.\n\nSo the answer to the manager in the hook: deploying once a month means carrying a big batch every time, and the risk of each deployment grows. Safer is to deploy more often and in smaller pieces, with automated checks and rollback.',
      ),
    },
    {
      id: 'goodhart',
      kind: 'callout',
      tone: 'warn',
      step: 'explain',
      title: bi('Метрика, ставшая целью', 'A metric turned into a target'),
      body: bi(
        '[[method.goodhart|Закон Гудхарта]] в формулировке Мэрилин Стратерн: «когда мера становится целью, она перестаёт быть хорошей мерой». Пообещайте команде премию за 50 развёртываний в неделю — и получите 50 пустых выкладок: прибор зелёный, а покупатели не получили ничего нового. DORA прямо предупреждает: метрики — для того, чтобы команда видела, где улучшаться, а не для рейтинга команд и не для премий.',
        '[[method.goodhart|Goodhart’s law]] in Marilyn Strathern’s wording: “when a measure becomes a target, it ceases to be a good measure.” Promise a team a bonus for 50 deployments a week and you get 50 empty deployments: the gauge is green, and the customers got nothing new. DORA warns explicitly: the metrics are there for a team to see where to improve, not for ranking teams or paying bonuses.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: bi('Выходной билет', 'Exit ticket'), items: ['method.q.dora-groups', 'method.q.dora-less-often', 'method.q.cfr-calc', 'method.q.goodhart'] },
  ],
};

export const sre: Lesson = {
  id: 'methodology.sre',
  block: 'methodology',
  title: bi('SRE: цель надёжности и бюджет ошибок', 'SRE: the reliability target and the error budget'),
  summary: bi('SLI, SLO и SLA; бюджет ошибок и его политика; оповещения по скорости сжигания бюджета.', 'SLI, SLO and SLA; the error budget and its policy; alerting on the burn rate.'),
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
        'Владелец бизнеса просит: «Пусть сайт работает всегда, на все сто процентов». Почему инженеры, которые отвечают за самые большие сайты мира, считают такую цель ошибкой — и что ставят вместо неё?',
        'The business owner asks: “Let the site work always, one hundred percent.” Why do the engineers responsible for the largest sites in the world consider such a target a mistake, and what do they set instead?',
      ),
    },
    {
      id: 'sre',
      kind: 'text',
      step: 'explain',
      title: bi('SRE', 'SRE'),
      body: bi(
        '[[method.sre|SRE]] (Site Reliability Engineering) — подход к эксплуатации, который сложился в Google. Бен Трейнор Слосс, его основатель, описывает его так: SRE — то, что получается, если поручить программисту спроектировать работу эксплуатации. Отсюда его черты: надёжность измеряют числами и договариваются о ней заранее, с рутиной борются кодом, а сбои разбирают, чтобы они не повторялись.\n\nПочему не 100%? Каждая следующая девятка стоит дороже предыдущей, а покупатель её не заметит: его мобильная связь и домашний Wi-Fi сами работают не на 100%. И цель «никогда не ломаться» запрещает любые изменения — ведь каждое изменение несёт риск.',
        '[[method.sre|SRE]] (Site Reliability Engineering) is an approach to operations that took shape at Google. Ben Treynor Sloss, its founder, describes it like this: SRE is what happens when you ask a software engineer to design an operations function. Hence its traits: reliability is measured in numbers and agreed in advance, toil is fought with code, and outages are reviewed so that they do not repeat.\n\nWhy not 100%? Each next nine costs more than the previous one, and the customer will not notice it: their mobile network and home Wi-Fi do not work 100% of the time either. And a target of “never break” forbids any change, because every change carries a risk.',
      ),
    },
    {
      id: 'slo',
      kind: 'text',
      step: 'explain',
      title: bi('SLI, SLO, SLA', 'SLI, SLO, SLA'),
      body: bi(
        'Три близких слова, которые важно различать:\n\n- **SLI** (service level indicator) — что мерим: доля успешных оформлений заказа, доля запросов, на которые сайт ответил быстрее 800 мс. Хороший индикатор описывает опыт покупателя, а не состояние сервера: процессор может быть в норме, когда оплата не проходит;\n- [[method.slo|SLO]] (service level objective) — какую цель ставим для индикатора за окно: «99,5% оформлений успешны за 30 дней»;\n- **SLA** (service level agreement) — что обещаем клиенту по договору и что будет, если не выполним: скидка, возврат денег. SLO обычно строже SLA, чтобы команда успела заметить проблему раньше, чем нарушит договор.',
        'Three similar words that matter to tell apart:\n\n- an **SLI** (service level indicator) is what we measure: the share of successful checkouts, the share of requests answered faster than 800 ms. A good indicator describes the customer’s experience, not the state of a server: the CPU may be fine while payments fail;\n- an [[method.slo|SLO]] (service level objective) is the target we set for an indicator over a window: “99.5% of checkouts succeed over 30 days”;\n- an **SLA** (service level agreement) is what we promise a client in a contract and what happens if we fail: a discount, a refund. An SLO is usually stricter than the SLA, so the team notices a problem before it breaks the contract.',
      ),
    },
    {
      id: 'budget',
      kind: 'text',
      step: 'explain',
      title: bi('Бюджет ошибок', 'The error budget'),
      body: bi(
        'Если цель — 99,9% за 30 дней, то 0,1% — это допустимая доля плохой работы. Её называют [[method.error-budget|бюджетом ошибок]]:\n\n```text\nбюджет = (1 − SLO) × окно\n(1 − 0,999) × 30 дней × 24 ч × 60 мин = 43,2 минуты\n```\n\nSLO по запросам тратит бюджет пропорционально доле ошибок: минута, когда не проходит 10% запросов, стоит десятую часть минуты полного простоя. 20 минут при 10% ошибок — это 2 плохие минуты.\n\nБюджет снимает спор из первой главы: его можно тратить на выкладки и эксперименты, а когда он кончился — заняться надёжностью. В SRE Workbook есть пример такой политики: если бюджет за предыдущие четыре недели **превышен**, все изменения и выпуски останавливают, пока сервис не вернётся в пределы SLO; исключения — исправления проблем P0 и исправления безопасности. Обратите внимание на условие: бюджет, потраченный на 90%, но не превышенный, выкладку по этой политике не запрещает.',
        'If the target is 99.9% over 30 days, then 0.1% is the allowed share of bad service. It is called the [[method.error-budget|error budget]]:\n\n```text\nbudget = (1 − SLO) × window\n(1 − 0.999) × 30 days × 24 h × 60 min = 43.2 minutes\n```\n\nA request-based SLO spends the budget in proportion to the error rate: a minute in which 10% of requests fail costs a tenth of a minute of full downtime. 20 minutes at 10% errors are 2 bad minutes.\n\nThe budget settles the argument from the first chapter: it can be spent on deployments and experiments, and when it is gone, the team works on reliability. The SRE Workbook has an example of such a policy: if the error budget for the preceding four weeks is **exceeded**, all changes and releases are halted until the service is back within its SLO; the exceptions are P0 issues and security fixes. Note the condition: a budget that is 90% spent but not exceeded does not forbid deployments under this policy.',
      ),
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Откройте заметки к примеру политики бюджета ошибок из SRE Workbook. В каком разделе сказано, что делать, когда бюджет превышен? Нажмите на раздел.', 'Open the notes on the example error budget policy from the SRE Workbook. Which section says what to do when the budget is exceeded? Click the section.'),
      ref: { page: 'web/sre.google/workbook/error-budget-policy' },
      answer: 'POLICY',
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'method.x.budget', caption: bi('Меняйте цель, длительность и долю ошибок. Включите «оповещение по процессору» и посмотрите, что пропадёт.', 'Change the target, the duration and the error share. Turn on “an alert on CPU load” and see what disappears.') },
    {
      id: 'burn',
      kind: 'text',
      step: 'explain',
      title: bi('Скорость сжигания', 'Burn rate'),
      body: bi(
        'Когда будить человека ночью? Не при каждой ошибке, а когда бюджет тратится слишком быстро. [[method.burn-rate|Скорость сжигания]] показывает, во сколько раз быстрее нормы он расходуется:\n\n```text\nскорость сжигания = доля ошибок / (1 − SLO)\n```\n\nПри скорости 1 бюджет кончится ровно к концу 30 дней. SRE Workbook (глава «Alerting on SLOs») предлагает три порога: скорость 14,4 за последний час (это 2% месячного бюджета за час) — срочное оповещение, которое будит дежурного; 6 за последние 6 часов (5% бюджета) — тоже срочное; 1 за последние 3 дня (10% бюджета) — тикет, который разберут в рабочее время. Чтобы оповещение не висело после того, как всё починили, к каждому окну добавляют короткое: 5 минут, 30 минут и 6 часов.\n\nДля SLO 99,9% доля ошибок 20% — это скорость 200: оповещение придёт через минуты. Доля 0,2% — скорость 2: только тикет.',
        'When should a person be woken at night? Not at every error, but when the budget is being spent too fast. The [[method.burn-rate|burn rate]] shows how many times faster than normal it is being spent:\n\n```text\nburn rate = error ratio / (1 − SLO)\n```\n\nAt a burn rate of 1 the budget runs out exactly at the end of 30 days. The SRE Workbook (chapter “Alerting on SLOs”) suggests three thresholds: a burn rate of 14.4 over the last hour (2% of the monthly budget in an hour) is a page that wakes the on-call engineer; 6 over the last 6 hours (5% of the budget) is also a page; 1 over the last 3 days (10% of the budget) is a ticket for working hours. So that an alert does not linger after the fix, each window gets a short companion window: 5 minutes, 30 minutes and 6 hours.\n\nFor an SLO of 99.9%, an error ratio of 20% is a burn rate of 200: the page arrives within minutes. A ratio of 0.2% is a burn rate of 2: only a ticket.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: bi('Выходной билет', 'Exit ticket'), items: ['method.q.nines', 'method.q.bad-minutes', 'method.q.freeze', 'method.q.slo-sla', 'method.q.burn'] },
  ],
};

export const incident: Lesson = {
  id: 'methodology.incident',
  block: 'methodology',
  title: bi('Инцидент: от оповещения до разбора', 'An incident: from the alert to the postmortem'),
  summary: bi('Реагирование: сначала восстановить, потом искать причину; дежурство и эскалация; разбор без поиска виноватых.', 'Response: restore first, find the cause later; on-call and escalation; the blameless postmortem.'),
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
        '02:14. Телефон дежурного будит его: «Доля успешных оплат — 80%». В чате уже пишет владелец бизнеса: «Что происходит? Кто это сделал?». Что делать первым: искать, чьё изменение сломало оплату, или что-то другое?',
        '02:14. The on-call engineer’s phone wakes them up: “Checkout success: 80%.” The business owner is already writing in the chat: “What is going on? Who did this?” What comes first: finding whose change broke the checkout, or something else?',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'method.x.incident', caption: bi('Девять шагов одного инцидента. Поменяйте мониторинг на «проверку сервера», выключите откат и инструкцию, сломайте график дежурств.', 'Nine steps of one incident. Change the monitoring to “a server check”, turn off the rollback and the runbook, break the on-call rota.') },
    {
      id: 'response',
      kind: 'text',
      step: 'explain',
      title: bi('Реагирование', 'Response'),
      body: bi(
        '[[method.incident-response|Реагирование на инцидент]] держится на одном правиле: сначала восстановить сервис, потом искать причину. Пока ищут виноватое изменение, покупатели не могут оплатить заказ. Поэтому порядок такой:\n\n1. **Обнаружение.** Оповещение по скорости сжигания бюджета или, хуже, жалоба покупателя.\n2. **Подтверждение.** **Дежурный** — человек, который по графику отвечает за срочные оповещения, — подтверждает: «беру». Если он не подтвердил за отведённое время, оповещение уходит запасному — это **эскалация**. Без графика дежурств оповещение «для всех» не берёт никто: каждый думает, что ответит другой.\n3. **Статус.** Первое сообщение — в первые минуты, даже без причины: что видим, что делаем, когда следующее сообщение. Владелец бизнеса читает канал статуса, а не дёргает дежурного.\n4. **Диагностика и смягчение.** Первый вопрос — что менялось последним. Самое быстрое смягчение — откат: вернуть прошлую версию, а чинить потом.\n5. **Восстановление** подтверждают по тем же данным, по которым заметили сбой.\n\nВ крупных инцидентах роли разделяют: координатор управляет, другие чинят, третьи пишут статус. Инструкция для дежурного делает диагностику короче — в тренажёре вдвое.',
        '[[method.incident-response|Incident response]] rests on one rule: restore the service first, look for the cause later. While people search for the faulty change, customers cannot pay. So the order is:\n\n1. **Detection.** A burn-rate alert or, worse, a customer complaint.\n2. **Acknowledgement.** The **on-call engineer**, the person who answers pages according to the rota, acknowledges: “mine”. If they do not acknowledge within the set time, the page goes to the secondary: that is **escalation**. Without an on-call rota a page “for everyone” is taken by nobody: each thinks someone else will answer.\n3. **Status.** The first update goes out in the first minutes, even without a cause: what we see, what we do, when the next update is. The business owner reads the status channel instead of pulling at the on-call engineer.\n4. **Diagnosis and mitigation.** The first question is what changed last. The fastest mitigation is a rollback: put the previous version back and fix later.\n5. **Recovery** is confirmed by the same data that showed the outage.\n\nIn big incidents the roles are split: an incident commander coordinates, others fix, someone else writes the status. A runbook makes diagnosis shorter; in the trainer, by half.',
      ),
    },
    {
      id: 'postmortem',
      kind: 'text',
      step: 'explain',
      title: bi('Разбор без поиска виноватых', 'The blameless postmortem'),
      body: bi(
        'После инцидента пишут [[method.postmortem|разбор без поиска виноватых]] (blameless postmortem). В нём:\n\n- **хронология** — факты со временем из всех источников: журнала выкладок, графиков, канала статуса, тикетов поддержки;\n- **влияние** — сколько длилось, сколько покупателей задело, сколько бюджета ошибок потрачено;\n- **способствующие факторы** — условия, которые сделали сбой возможным и долгим: «скрипт миграции можно запустить на проде без подтверждения», «оповещение пришло через 40 минут», «откат умеет делать только один человек»;\n- **задачи на улучшение** — с владельцем и сроком; они становятся карточками на доске.\n\nГлавный вопрос разбора — «что было видно в этот момент?», а не «почему ты ошибся?». Сидни Деккер и руководство Etsy по проведению разборов объясняют почему: решение, которое задним числом выглядит ошибкой, в тот момент казалось человеку разумным при тех данных, что у него были. Если за ошибки наказывают, люди перестают рассказывать, что видели, и организация теряет именно ту информацию, которая нужна, чтобы сбой не повторился. Фраза «разработчик невнимательно запустил скрипт» ничего не чинит; фраза «скрипт можно запустить на проде без подтверждения, а имена баз на стенде и в проде совпадают» даёт две задачи.',
        'After an incident the team writes a [[method.postmortem|blameless postmortem]]. It has:\n\n- a **timeline**: facts with times from every source — the deployment log, the graphs, the status channel, support tickets;\n- the **impact**: how long it lasted, how many customers it hit, how much error budget it spent;\n- **contributing factors**: the conditions that made the outage possible and long — “the migration script can run on production without confirmation”, “the alert came after 40 minutes”, “only one person can do a rollback”;\n- **action items** with an owner and a due date; they become cards on the board.\n\nThe central question of the review is “what could be seen at that moment?”, not “why did you make a mistake?”. Sidney Dekker and Etsy’s Debriefing Facilitation Guide explain why: a decision that looks like a mistake in hindsight seemed reasonable to the person at the time, given the data they had. When mistakes are punished, people stop telling what they saw, and the organisation loses exactly the information it needs to keep the outage from repeating. “The developer carelessly ran the script” fixes nothing; “the script can run on production without confirmation, and the database names on staging and in production are the same” gives two tasks.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: bi('Выходной билет', 'Exit ticket'), items: ['method.q.response-order', 'method.q.blameless-rewrite', 'method.q.what-visible', 'method.q.factors'] },
  ],
};

export const culture: Lesson = {
  id: 'methodology.culture',
  block: 'methodology',
  title: bi('Культура и полное определение DevOps', 'Culture and the full definition of DevOps'),
  summary: bi('Три пути, CALMS, типология Веструма, полное определение DevOps и роль DevOps-инженера.', 'The Three Ways, CALMS, the Westrum typology, the full definition of DevOps and the role of a DevOps engineer.'),
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
        'Тест оплаты падает уже неделю. Тестировщик знает, разработчики догадываются, руководитель делает вид, что не слышал, а владелец продукта узнаёт об этом от покупателей. Механика у этой команды та же, что у любой другой. Что у неё не так?',
        'The checkout test has been failing for a week. The tester knows, the developers suspect, the manager pretends not to have heard, and the product owner learns about it from the customers. This team has the same mechanics as any other. What is wrong with it?',
      ),
    },
    {
      id: 'ways',
      kind: 'text',
      step: 'explain',
      title: bi('Три пути', 'The Three Ways'),
      body: bi(
        'Авторы «Руководства по DevOps» сводят методологию к [[method.three-ways|трём путям]], и каждый вы уже видели в механике блока:\n\n1. **Поток** слева направо — от разработки к покупателю: видимая работа на доске, лимиты WIP, маленькие партии, конвейер, работа с узким местом.\n2. **Обратная связь** справа налево: автотесты, которые сообщают об ошибке через минуты; оповещения по бюджету ошибок; откат; метрики DORA.\n3. **Непрерывное обучение и эксперименты**: разборы без поиска виноватых, время на улучшения вместо вечной рутины, ретроспективы.',
        'The authors of “The DevOps Handbook” boil the methodology down to [[method.three-ways|the Three Ways]], and you have seen each of them in this block’s mechanics:\n\n1. **Flow** from left to right, from development to the customer: visible work on the board, WIP limits, small batches, the pipeline, working with the bottleneck.\n2. **Feedback** from right to left: automated tests that report a mistake in minutes, alerts on the error budget, rollback, the DORA metrics.\n3. **Continual learning and experimentation**: blameless postmortems, time for improvement instead of endless toil, retrospectives.',
      ),
    },
    {
      id: 'calms',
      kind: 'text',
      step: 'explain',
      title: bi('CALMS', 'CALMS'),
      body: bi(
        'Другая короткая формула — [[method.calms|CALMS]]. Джон Уиллис и Деймон Эдвардс назвали четыре опоры DevOps (CAMS), а Джез Хамбл добавил пятую — бережливость:\n\n- **Culture** — культура: общая ответственность за результат, а не «мы сделали, они сломали»;\n- **Automation** — автоматизация: сборка, проверки, выкладка, рутина;\n- **Lean** — бережливость: поток, лимиты, маленькие партии;\n- **Measurement** — измерение: время цикла, метрики DORA, бюджет ошибок;\n- **Sharing** — обмен знаниями: инструкции, работа в паре, разборы, открытые для всех.',
        'Another short formula is [[method.calms|CALMS]]. John Willis and Damon Edwards named four pillars of DevOps (CAMS), and Jez Humble added a fifth, lean:\n\n- **Culture**: shared responsibility for the result, not “we built it, they broke it”;\n- **Automation**: of the build, the checks, the deployment, the toil;\n- **Lean**: flow, limits, small batches;\n- **Measurement**: cycle time, the DORA metrics, the error budget;\n- **Sharing**: runbooks, pairing, postmortems open to everyone.',
      ),
    },
    {
      id: 'westrum',
      kind: 'text',
      step: 'explain',
      title: bi('Как идёт плохая новость', 'How bad news travels'),
      body: bi(
        'Социолог Рон Веструм различает три типа организационной культуры по тому, как в организации движется информация, — это [[method.westrum|типология Веструма]]:\n\n- **патологическая** (ориентирована на власть): информацию прячут, гонца наказывают, сбои скрывают;\n- **бюрократическая** (ориентирована на правила): информация идёт по форме и регламенту, медленно; новизна создаёт проблемы;\n- **генеративная** (ориентирована на результат): информацию ищут и передают сразу, за неудачи не наказывают, а исследуют их.\n\nКоманда из зацепки — патологическая: плохая новость неделю не доходит до того, кто может её исправить. Исследования DORA показывают, что генеративная культура предсказывает и лучшие показатели доставки, и благополучие людей.',
        'The sociologist Ron Westrum distinguishes three types of organisational culture by how information moves through an organisation: the [[method.westrum|Westrum typology]]:\n\n- **pathological** (power-oriented): information is hidden, messengers are shot, failures are covered up;\n- **bureaucratic** (rule-oriented): information goes through forms and channels, slowly; novelty creates problems;\n- **generative** (performance-oriented): information is sought and passed on at once, failures lead to inquiry, not punishment.\n\nThe team in the hook is pathological: bad news takes a week to reach the person who can fix it. DORA research shows that a generative culture predicts both better delivery performance and people’s well-being.',
      ),
    },
    {
      id: 'definition',
      kind: 'text',
      step: 'explain',
      title: bi('Полное определение', 'The full definition'),
      body: bi(
        'Теперь рабочее определение из первой главы можно дополнить. DevOps — это методология, при которой разработка и эксплуатация отвечают за общий результат и добиваются его тремя путями: быстрым потоком маленьких изменений, быстрой обратной связью с прода и постоянным обучением на собственных сбоях; опирается она на культуру общей ответственности, автоматизацию, бережливость, измерение и обмен знаниями.\n\n[[method.devops-engineer|DevOps-инженер]] — человек, который внедряет эту методологию в команде. Его главный инструмент — автоматизация: он строит конвейер, автоматические проверки и выкладки, мониторинг и оповещения, убирает рутину скриптами. Всё это вы будете делать руками в следующих блоках курса — и каждый раз будете знать, какое ожидание или какой риск в потоке ценности это убирает.',
        'Now the working definition from the first chapter can be completed. DevOps is a methodology in which development and operations own one result together and reach it by three ways: a fast flow of small changes, fast feedback from production and continual learning from their own outages; it rests on a culture of shared responsibility, automation, lean, measurement and sharing.\n\nA [[method.devops-engineer|DevOps engineer]] is a person who puts this methodology into practice in a team. Their main tool is automation: they build the pipeline, automated checks and deployments, monitoring and alerts, and remove toil with scripts. You will do all of this by hand in the next blocks of the course, and each time you will know which wait or which risk in the value stream it removes.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: bi('Выходной билет', 'Exit ticket'), items: ['method.q.ways-match', 'method.q.calms', 'method.q.westrum'] },
  ],
};

export const blackFriday: Lesson = {
  id: 'methodology.black-friday',
  block: 'methodology',
  title: bi('Практикум «Чёрная пятница»', 'Practicum: Black Friday'),
  summary: bi('Всё вместе на одной доске: поток, рутина, выкладки, инциденты и распродажа. Разбор сравнит ваш прогон с двумя эталонами.', 'Everything on one board: flow, toil, deployments, incidents and a sale. The debrief compares your run with two references.'),
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
        'Двадцать дней из жизни магазина. Команда работает по-старому: без лимитов, выкладка раз в пять дней руками эксплуатации, рутина растёт, мониторинг видит только падение сервера. С 9-го по 11-й день эксплуатация в отпуске, с 15-го по 17-й — распродажа. В бэклоге лежат пять улучшений. Ваши решения — лимиты, люди, улучшения, способ выкладки, ответы на записки.\n\nЭто не игра на очки. В конце разбор покажет ваш прогон рядом с командой без методологии и эталонной командой на тех же кубиках и событиях, три решения, которые изменили больше всего, и попросит объяснить результат своими словами.',
        'Twenty days in the life of the shop. The team works the old way: no limits, a deployment every five days by hand by operations, growing toil, monitoring that only sees the server go down. Operations is on leave on days 9–11, and days 15–17 are a sale. Five improvements lie in the backlog. Your decisions: limits, people, improvements, the way of deploying, answers to the memos.\n\nThis is not a game for points. At the end the debrief shows your run next to a team without the method and a reference team on the same dice and events, the three decisions that changed the most, and asks you to explain the result in your own words.',
      ),
    },
    { id: 'practice', kind: 'widget', step: 'practice', widget: 'flowlab.board', props: { scenario: 's2' } },
    { id: 'review', kind: 'quiz', step: 'review', title: bi('Повторение блока', 'Block review'), items: ['method.q.little-calc', 'method.q.ci-cd-match', 'method.q.freeze', 'method.q.five-steps', 'method.q.dora-less-often', 'method.q.blameless-rewrite'] },
  ],
};
