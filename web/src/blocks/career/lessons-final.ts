// The final segment (route id `final`): the on-call shift and the final exam
// (10 §6.4, §6.5). Both exams run on the course stands (final-exam.ts); the
// real-VM variant of the final exam is the capstone checklist.

import { bi } from '../../core/i18n';
import type { Lesson, QuizItem } from '../../core/types';

const SRC = {
  sreIncidents: { title: 'Google SRE Book — Managing Incidents', url: 'https://sre.google/sre-book/managing-incidents/' },
  srePostmortem: { title: 'Google SRE Book — Postmortem Culture', url: 'https://sre.google/sre-book/postmortem-culture/' },
  sreOncall: { title: 'Google SRE Workbook — On-Call', url: 'https://sre.google/workbook/on-call/' },
  kanbanRu: { title: 'Канбан (разработка) — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%9A%D0%B0%D0%BD%D0%B1%D0%B0%D0%BD_(%D1%80%D0%B0%D0%B7%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D0%BA%D0%B0)' },
  itilRu: { title: 'ITIL — Википедия', url: 'https://ru.wikipedia.org/wiki/ITIL' },
  kts: { title: 'KTS: как мы перевели собеседования DevOps на тренажёр (Хабр)', url: 'https://habr.com/ru/companies/kts/articles/795277/' },
  kubeadm: { title: 'Kubernetes — Creating a cluster with kubeadm', url: 'https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/' },
  k3s: { title: 'K3s documentation', url: 'https://docs.k3s.io/' },
  tf: { title: 'Terraform — Language documentation', url: 'https://developer.hashicorp.com/terraform/language' },
  argo: { title: 'Argo CD — documentation', url: 'https://argo-cd.readthedocs.io/en/stable/' },
  setupRu: { title: 'Установка Kubernetes — kubernetes.io', url: 'https://kubernetes.io/ru/docs/setup/' },
  componentsRu: { title: 'Компоненты Kubernetes — kubernetes.io', url: 'https://kubernetes.io/ru/docs/concepts/overview/components/' },
};

export const L_ONCALL: Lesson = {
  id: 'final.oncall',
  block: 'final',
  title: bi('Смена дежурного', 'The on-call shift'),
  summary: bi('Три инцидента, которые за 60 минут наслаиваются друг на друга. Вы выбираете, за что браться первым, сначала возвращаете сервис, пишете статус для команды и разбираете случившееся без поиска виноватых.', 'Three overlapping incidents in 60 minutes: priority by impact, restore first, status to the team, a blameless review.'),
  introduces: ['career.oncall', 'career.priority', 'career.blameless'],
  uses: [],
  tier: 'core',
  minutes: 75,
  sources: { en: [SRC.sreIncidents, SRC.srePostmortem, SRC.sreOncall], ru: [SRC.kanbanRu, SRC.itilRu, SRC.kts] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Перед итоговым экзаменом вас ждёт одна [[career.oncall|смена дежурного]]. Это генеральная репетиция и собеседования, и первой работы: за 60 минут придут три инцидента, причём второй придёт, пока вы ещё разбираете первый. Проверяется не только то, починили ли вы систему, но и то, как вы ведёте себя на дежурстве.',
        'Before the final exam comes one [[career.oncall|on-call shift]]. It is a dress rehearsal for both the interview and the first job: three incidents arrive in 60 minutes, the second while you are still on the first. Not only the fix is checked, but how you behave on call.',
      ),
    },
    {
      id: 'rules',
      kind: 'text',
      step: 'explain',
      title: bi('Правила смены', 'The rules of the shift'),
      body: bi(
        '**Выбирайте инцидент по влиянию на пользователей.** Первым берут тот инцидент, от которого пользователи страдают сильнее всего, а не тот, что пришёл раньше. Сломанная оплата важнее диска, который заполнится через четыре часа, а диск важнее красного конвейера, который мешает только выкладкам. Это правило называется [[career.priority|приоритетом по влиянию]]. Отложенный инцидент не забывают, а сообщают о нём в чате: «вижу, возьму после текущего».\n\n**Держите в работе один инцидент.** На доске дежурного четыре колонки: «Новое», «Разбираю», «Смягчено» и «Закрыто», и в колонке «Разбираю» стоит не больше одной карточки. Если метаться между двумя пожарами, оба потушите медленнее.\n\n**Действуйте тем же методом, что на собеседовании.** Уточните, что происходит, подтвердите симптом, назовите уровень по улике и не уничтожайте улики. Сначала верните сервис, откатив то изменение, которое вызвало сбой, а потом чините причину и проверяйте результат.\n\n**Пишите статус для команды**: кого задел сбой и насколько, что вы делаете и когда будет следующий статус.\n\n**После каждого инцидента пишите разбор** из четырёх частей: хронология, влияние на пользователей, способствующие факторы и действия. Разбор ищет не виноватого и не одну «корневую причину», а условия в системе, которые сделали сбой возможным и помешали заметить его раньше. Такой разбор называют [[career.blameless|разбором без поиска виноватых]].',
        '**Priority by impact.** The incident that hurts users most is taken first, not the one that came first: broken checkout beats a disk that fills in four hours, and the disk beats a red pipeline that only blocks releases. That is [[career.priority|priority by impact]]. A deferred incident is not forgotten but announced in the chat: “seen it, will take it after the current one”.\n\n**One incident in progress.** On the on-call board “New → Investigating → Mitigated → Closed” the Investigating column holds at most one card. Switching between two fires puts both out more slowly.\n\n**The method is the same as at an interview.** Ask, confirm the symptom, name the layer from evidence, do not destroy evidence, restore the service first — by rolling back the change that caused the failure — then fix and verify.\n\n**Status to the team**: impact, what we do, when the next update is.\n\n**A review after each incident** in four parts: timeline, impact, contributing factors, actions. Not “who is to blame” and not a single “root cause”, but the conditions of the system that made the failure possible and kept it from being caught earlier. That is a [[career.blameless|blameless review]].',
      ),
    },
    {
      id: 'env',
      kind: 'callout',
      tone: 'note',
      title: bi('Где проходит смена', 'Where the shift runs'),
      body: bi('Тренировочная смена ниже проходит на доске: в ответ на ваши команды и выбор следующего шага она показывает то, что показал бы настоящий сервер при скрытой причине. Зачётная смена — это экзамен «Смена дежурного» на странице блока. Он длится 60 минут по жёсткому таймеру, и в нём вас ждут два настоящих инцидента на стендах курса: выкладку, после которой сломалась оплата, и вышедший из строя узел кластера, собранного из кода. Кроме того, в экзамене есть вопросы о выборе приоритета, о статусе и о разборе. Правила и рубрика у обеих смен одинаковые.', 'The training shift below runs on a board: commands and next-step choices show what a real server would show for the hidden cause. The graded shift is the “On-call shift” exam on the block page: 60 minutes of a hard timer, two real incidents on the course stands — a release that broke checkout and a failed node of the cluster from code — and questions about priority, status and the review. The rules and the rubric are the same.'),
    },
    { id: 'shift', kind: 'widget', step: 'practice', widget: 'career.oncall' },
    {
      id: 'rubric',
      kind: 'text',
      step: 'explain',
      title: bi('Как оценивают дежурного', 'How the on-call engineer is graded'),
      body: bi(
        'По каждому критерию ставится балл от 0 до 3. Смена сдана, если пройдены все критические проверки состояния, средний балл не ниже 2 и по безопасности нет нуля.\n\n- **Уровень и улики.** 0 баллов, если вы действовали, ничего не наблюдая; 2, если назвали уровень по улике («ping по IP проходит, значит, сетевой уровень в порядке»); 3, если сужали поиск по мере того, как появлялись новые улики.\n- **Безопасность.** 0 баллов, если до сбора улик вы сделали что-то разрушительное, например перезапустили службу или удалили под; 2, если разрушительных действий не было; 3, если вы сначала вернули сервис, а потом искали причину.\n- **Выбор приоритета.** 0 баллов, если вы брали инциденты в порядке поступления; 2, если первым взяли самый важный для пользователей; 3, если вдобавок сообщили в чате об отложенном инциденте.\n- **Статус.** 2 балла, если в статусе сказано, кого задел сбой и насколько, что вы делаете и когда будет следующий статус; 3, если сказано ещё, с какого момента идёт сбой, как вы будете откатываться и при каком условии напишете раньше срока.\n- **Разбор.** 0 баллов, если в разборе назван виноватый; 1, если названа одна «корневая причина»; 2, если названы два условия в системе или больше; 3, если сказано ещё, почему не сработала защита, и у каждого действия есть ответственный и срок.',
        'Each criterion is scored 0 to 3; to pass — every critical state check and a mean of at least 2 with no zero for safety.\n\n- **Layer and evidence.** 0 — acted without observations; 2 — named the layer from evidence (“ping by IP works — L3 is fine”); 3 — narrowed it down as new evidence came.\n- **Safety.** 0 — a destructive action before gathering evidence (a restart, deleting a pod); 2 — no destructive actions; 3 — restored the service first, then looked for the cause.\n- **Prioritisation.** 0 — in order of arrival; 2 — by impact first; 3 — and the deferred one announced in the chat.\n- **Status.** 2 — who suffers and how much, what we do, when the next update is; 3 — since when, how we roll back, the condition for an earlier update.\n- **Review.** 0 — a culprit is named; 1 — a single “root cause”; 2 — two or more conditions of the system; 3 — and why the safeguard did not work, actions with an owner and a date.',
      ),
    },
    {
      id: 'exit',
      kind: 'quiz',
      step: 'exit',
      title: bi('Проверьте себя', 'Check yourself'),
      items: ['career.q.priority', 'career.q.blameless', 'career.q.wip'],
    },
  ],
};

const RUBRIC_Q: QuizItem = {
  id: 'final.q.exam-pass',
  kind: 'mcq',
  prompt: bi('Вы сдаёте итоговый экзамен на стендах, набрали 82 %, но не сделали уборку. Сдан ли экзамен?', 'The final exam on the stands: you scored 82% but did not do the cleanup. Is the exam passed?'),
  options: [
    { id: 'no', text: bi('Нет: уборка — критическая проверка, и если она не пройдена, экзамен не сдан при любом балле', 'No: the cleanup is a critical check, and failing it means the exam is not passed at any score'), correct: true },
    { id: 'yes', text: bi('Да: порог в 75 % пройден', 'Yes: the 75% threshold is passed'), why: bi('Порог нужен, но его мало: пройдены должны быть и все критические проверки.', 'The threshold is needed but not enough: every critical check is required.') },
    { id: 'half', text: bi('Да, но с отметкой «без уборки»', 'Yes, but marked “without cleanup”'), why: bi('Такой отметки нет. Неубранный стенд стоит денег, и умение убрать за собой проверяется наравне с остальными.', 'There is no such mark. A lab left behind costs money, and the cleanup skill is checked on a par with the rest.') },
  ],
  explain: bi('Вопросы «объясните» в конце экзамена в балл не входят: по ним ставится отдельная отметка «готовность к собеседованию».', 'The explain questions at the end do not count towards the score: they give a separate “ready for an interview” mark.'),
};

const DL5_Q: QuizItem = {
  id: 'final.q.dl5',
  kind: 'mcq',
  prompt: bi('Чем вы можете пользоваться во время зачётного экзамена?', 'What is available to you during a graded exam?'),
  options: [
    { id: 'docs', text: bi('Только встроенным просмотрщиком документации, в котором открыты источники из списка экзамена', 'Only the built-in documentation viewer with the exam’s allowlist of sources'), correct: true },
    { id: 'mentor', text: bi('Наставником, если он не даёт готовых ответов', 'The mentor, but without ready answers'), why: bi('На экзамене наставник выключен всегда. Помощники разрешены только в режиме «тренировка», а этот режим блок не закрывает.', 'On an exam the mentor is always off. Helpers are allowed only in the “training” mode, which does not close the block.') },
    { id: 'web', text: bi('Любыми сайтами, если открыть их в другой вкладке', 'Any website, if opened in another tab'), why: bi('Тренажёр не следит за вкладками: режим «экзамен» держится на вашем честном слове. Но список страниц, которые вы открыли во встроенной документации, попадает в протокол.', 'The trainer does not watch your tabs, and the “exam” mode is a word of honour. The log of opened pages of the built-in documentation goes into the protocol.') },
  ],
};

export const L_CAPSTONE: Lesson = {
  id: 'final.capstone',
  block: 'final',
  title: bi('Итоговый экзамен: построить, починить, защитить', 'The final exam: build, fix, defend'),
  summary: bi('Один сценарий в четыре этапа на стендах курса или на трёх настоящих машинах. Вы строите кластер из кода, выкладываете магазин через Git, настраиваете мониторинг и безопасность, чините поломку, защищаете решение перед техлидом и обязательно убираете за собой.', 'One scenario in four stages — on the course stands and on three real machines: a cluster from code, a release through Git, monitoring, security; a failure; a defence; a mandatory cleanup.'),
  introduces: ['career.capstone', 'career.cleanup'],
  uses: ['career.oncall', 'k8s.rebuildable', 'cicd.gitops-pull'],
  tier: 'core',
  minutes: 60,
  sources: { en: [SRC.kubeadm, SRC.k3s, SRC.tf, SRC.argo], ru: [SRC.setupRu, SRC.componentsRu] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        '[[career.capstone|Итоговый экзамен]] подтверждает, что вы умеете построить и защитить небольшую, но настоящую систему: [[k8s.rebuildable|кластер, который можно заново собрать из кода]], магазин в этом кластере, выкладку через [[cicd.gitops-pull|GitOps]], мониторинг и порядок на узлах. У экзамена два варианта, и в обоих одни и те же части и одна и та же рубрика.\n\n**Вариант на стендах курса** — это зачётный экзамен на странице блока. Он проходит в браузере и ничего не стоит. Вы работаете с теми же инструментами, что в блоках об инфраструктуре как коде и о кластере из кода: Terraform и учебное облако Edu Cloud, Ansible, kubeadm, Argo CD и сервер репозиториев forge. Задания приходят карточками по этапам, а проверяется состояние стенда.\n\n**Вариант на трёх настоящих машинах** — полный вариант для портфолио: свой репозиторий, своё облако и живой сервис, который можно показать работодателю. Тренажёр на этих машинах сам ничего не выполняет: он показывает шаги, считает стоимость и проверяет результат по тому, что вы вставите из терминала. План этого варианта собран в чек-листе ниже, и отметки в нём сохраняются.',
        'The [[career.capstone|final exam]] confirms that you can build and defend a small but real system: a [[k8s.rebuildable|rebuildable cluster]], the shop in it, releases through [[cicd.gitops-pull|GitOps]], monitoring and order on the nodes. The exam has two variants with the same parts and the same rubric.\n\n**On the course stands** — the graded exam on the block page. It runs in the browser and costs nothing: the same Terraform and Edu Cloud, Ansible, kubeadm, Argo CD and forge as in the IaC and “A cluster from code” blocks. Tasks come as cards by stage, and the state of the stand is checked.\n\n**On three real machines** — the full variant for a portfolio: your own repository, your own cloud, a live service you can show an employer. The trainer runs nothing on those machines by itself: it shows the steps, counts the cost and checks the result by what you paste from the terminal. The plan of this variant is in the checklist below; the ticks are saved.',
      ),
    },
    {
      id: 'stages',
      kind: 'text',
      step: 'explain',
      title: bi('Этапы экзамена на стендах', 'The exam on the stands: the stages'),
      body: bi(
        '**Этап А: построить.**\n\n- **А1.** Облако пустое. Вы создаёте три узла и кластер из кода, а повторный запуск `site.yml` показывает `changed=0`, то есть код ничего больше не меняет. Это критическая задача.\n- **А2.** Вы выкладываете версию 1.1 магазина на три реплики коммитом в репозиторий манифестов, и ревизия в Application совпадает с веткой на сервере forge. Это критическая задача.\n- **А3.** Вы кодом Ansible снова разрешаете на всех узлах вход только по ключам.\n- **А4.** Правило алерта на долю ошибок будит дежурного при каждом коротком всплеске, и вам нужно найти, чего этому правилу не хватает.\n- **А5.** Задача, которой не было в курсе: по документации и без подсказок вы закрепляете выкладку за тегом релиза.\n\n**Этап Б: починить.** Вам достаётся одна поломка из набора, и какую из них вы получите, решает номер варианта: либо вышел из строя узел кластера, либо после выкладки магазин отвечает ошибками. Нужно найти поломку по уликам, вернуть сервис, не пересоздавая того, что можно починить, и выбрать правильный статус для команды. Это критическая задача.\n\n**Этап В: защитить.** Техлид задаёт три вопроса: где в системе единая точка отказа, как откатить выкладку и что за вас сделал kubeadm, а что осталось на вас. Вы отвечаете своими словами и сверяете ответ с ключевыми пунктами.\n\n**Уборка.** Вы выполняете `terraform destroy`, и облако остаётся пустым. Это критическая задача: без уборки экзамен не сдан.',
        '**A. Build.**\n\n- **A1.** The cloud is empty: three nodes and a cluster from code, a repeated run of `site.yml` gives `changed=0`. Critical.\n- **A2.** Release version 1.1 on three replicas with a commit to the manifests repository; the Application revision matches the branch on the forge. Critical.\n- **A3.** Key-only logins again on every node — with Ansible code.\n- **A4.** An error-ratio alert rule that wakes the on-call engineer on every spike: find what it is missing.\n- **A5.** A task beyond the course — from the documentation, with no hints: pin the release to a release tag.\n\n**B. Fix.** One failure from a pool, chosen by the variant seed: a failed cluster node or a release after which the shop answers with errors. Find it from evidence, restore the service without recreating what can be fixed, and choose the right status for the team. Critical.\n\n**C. Defend.** Three questions from the tech lead: the single point of failure, rolling back a release, what kubeadm did and what was left to you. You answer in your own words and check the answer against the key points.\n\n**Cleanup.** `terraform destroy` and an empty cloud. Critical: without it the exam is not passed.',
      ),
    },
    {
      id: 'rubric',
      kind: 'text',
      step: 'explain',
      title: bi('Как оценивают экзамен', 'The rubric'),
      body: bi(
        '**Проверки состояния.** У каждой задачи есть вес. Проверка смотрит на результат, то есть на машины, узлы, файлы, объекты кластера и ревизию в Git, а не на набранные команды, поэтому подходит любой путь к результату. Экзамен сдан, если вы набрали не меньше 75 % и выполнили все критические задачи. Задача, которой не было в курсе, весит 15 %: на работе половина задач окажутся такими, каких не было в учебнике.\n\n**Защита.** Ответы на вопросы этапа В в балл не входят. По ним ставится отдельная отметка «готовность к собеседованию», которая показывает, сколько ключевых пунктов вы назвали сами. Честное «не знаю, но выяснял бы так» лучше уверенной выдумки, а на защите перед живым человеком по той же рубрике ноль по честности означает провал.\n\n**Смена и поломка.** Этап Б оценивается так же, как смена дежурного: сначала улики, потом действия, никаких разрушительных действий до сбора улик и статус, в котором названы влияние, действие и время следующего сообщения.\n\n**Пересдача** возможна через 24 часа, и вы получите новый вариант: другую поломку и другие задачи из набора.',
        '**State checks.** Each task has a weight; the check looks at the result — machines, nodes, files, cluster objects, the revision in Git — not at the commands typed, so any path works. To pass — at least 75% and every critical task. The task beyond the course weighs 15%: at work half the tasks are ones the textbook did not have.\n\n**The defence.** The answers to stage C do not count towards the score. They give a separate “ready for an interview” mark: how many key points you named yourself. An honest “I do not know, but I would find out like this” beats a confident invention — at a live defence by the same rubric a zero for honesty means failing.\n\n**The shift and the failure.** Stage B is graded like the on-call shift: evidence before actions, no destructive actions before gathering evidence, a status with impact, action and time.\n\n**A retake** — after 24 hours, with a new variant: another failure, other tasks from the pools.',
      ),
    },
    {
      id: 'dl5',
      kind: 'callout',
      tone: 'why',
      title: bi('Документация на экзамене', 'Documentation during the exam'),
      body: bi('Экзамен — последняя ступень лестницы документации. Подсказок нет, наставник выключен, и открыт только встроенный просмотрщик: справка `--help` и `man`, `ansible-doc`, документация Terraform, kubernetes.io, Argo CD и Prometheus. Список страниц, которые вы открывали, попадает в протокол, но на балл не влияет: работодателю полезно видеть, где вы искали ответ. Режим «тренировка» разрешает любых помощников и показывает полный разбор, но блок не закрывает.', 'This is the last step of the documentation ladder: no hints, the mentor is off, only the built-in viewer is open with `--help` and `man`, `ansible-doc`, Terraform, kubernetes.io, Argo CD and Prometheus. The log of opened pages goes into the protocol, not into the score: an employer benefits from seeing where you looked for the answer. The “training” mode allows any helpers, shows the full review and does not close the block.'),
    },
    {
      id: 'real',
      kind: 'text',
      step: 'explain',
      title: bi('Экзамен на настоящих машинах', 'On real machines'),
      body: bi(
        '**Часть А занимает до 14 дней, и работаете вы в своём темпе.** Код и конвейер вы отлаживаете у себя на одной машине, а финальная сборка, то есть заказ трёх машин и создание всей системы из кода с нуля, укладывается в одну сессию. За основу удобно взять сервис из пет-проекта 3. К тому, что проверяет экзамен на стендах, здесь добавляются публичный репозиторий с README, конвейер от проверки кода линтером до выкладки, дашборд с четырьмя золотыми сигналами и доставка алертов в мессенджер. Опытные ученики вдобавок ставят кластер через kubeadm, настраивают снимки etcd по расписанию, обновляют кластер до следующей минорной версии и проверяют сертификаты.\n\n**Часть Б длится 60 минут по жёсткому таймеру.** В систему вносят одну обратимую поломку, которая не трогает ваши данные, а полный список возможных поломок и команды для их отката показывают заранее. Когда вы скажете «починил», все проверки части А снова должны пройти, данные должны остаться целыми, а статус и разбор должны быть написаны.\n\n**Часть В длится 40 минут.** Учебный интервьюер получает README, схему, файл конвейера и протокол частей А и Б и задаёт вопросы о вашем проекте. Чтобы сдать эту часть, нужен средний балл не ниже 2 из 3 и ни одного нуля по честности. Ту же защиту стоит пройти и перед живым человеком.',
        'Part A — up to 14 days at your own pace: you debug the code and pipeline on one machine of your own, and the final build — ordering three machines and bringing everything up from code from scratch — fits in one session. Project 3’s service is a convenient base. On top of what the stand exam checks come a public repository with a README, a pipeline from lint to release, a dashboard with the four golden signals and alert delivery to a messenger, and for the experienced — kubeadm with a scheduled etcd snapshot, an upgrade to the next minor version and a certificate check.\n\n**Part B — 60 minutes, hard timer.** One reversible failure that does not touch your data is planted in the system; the full list of possible failures and their rollback commands is shown in advance. After “fixed”, every check of part A passes again, the data is intact, the status and the review are written.\n\n**Part C — 40 minutes.** The mock interviewer gets the README, the diagram, the pipeline file and the protocol of parts A and B and asks about your project. To pass: a mean score of at least 2 of 3 and no zero for honesty. It is worth doing the same defence with a live person too.',
      ),
    },
    {
      id: 'cost',
      kind: 'callout',
      tone: 'cost',
      title: bi('Сколько это стоит', 'Cost'),
      body: bi('Прежде чем заказывать машины, посчитайте у выбранного провайдера стоимость «3 машины × размер × часы» и отдельно стоимость суток на случай, если вы забудете машины удалить. Управляющему узлу kubeadm нужно не меньше 2 виртуальных процессоров и 2 ГБ памяти. Всё, что можно, отлаживайте на одной машине или на стенде курса: финальная сборка из кода занимает одну сессию, и арендовать три машины на две недели не нужно.', 'Before ordering, work out “3 machines × size × hours” at your chosen provider, and separately the price of a day if you forget to delete them. kubeadm needs at least 2 vCPUs and 2 GB of memory on the control-plane node. Debug whatever you can on one machine or on the course stand: the final build from code is one session, not two weeks of rent.'),
    },
    {
      id: 'cleanup',
      kind: 'callout',
      tone: 'cleanup',
      title: bi('Уборка обязательна', 'Cleanup is mandatory'),
      body: bi('Протокол экзамена не выдаётся, пока не сделана [[career.cleanup|уборка]]. Последняя строка вывода `terraform destroy` должна выглядеть так: `Destroy complete! Resources: N destroyed.`, где N равно числу ресурсов в состоянии Terraform. После этого команда `terraform state list` должна ничего не выводить, а в списке машин у провайдера не должно остаться ни одной машины с меткой экзамена. Если вы хотите оставить сервис работать, чтобы показать его работодателю, оставьте одну машину и знайте, сколько она стоит в месяц.', 'The protocol is not issued until the [[career.cleanup|cleanup]] is done: the last line of `terraform destroy` reads `Destroy complete! Resources: N destroyed.` where N equals the number of resources in the state, then an empty `terraform state list` and an empty list of provider machines with the exam label. If you want to keep the service alive for employers, keep one machine and know its monthly price.'),
    },
    { id: 'checklist', kind: 'widget', step: 'practice', widget: 'career.checklist', props: { kind: 'capstone' } },
    {
      id: 'protocol',
      kind: 'text',
      step: 'exit',
      body: bi(
        'Итог экзамена — протокол. В нём записано, что проверялось, какие проверки пройдены и в каком режиме вы работали («экзамен» или «тренировка»). Там же стоят ссылки на репозиторий и на работающий сервис, итог защиты с цитатами из ваших ответов и отметка об уборке. Протокол не сертификат, поэтому мы и называем его протоколом: работодателю нужен не значок, а репозиторий, который можно открыть, и человек, который может его объяснить.',
        'The result is a protocol: what was checked, which checks passed, the mode (“exam” or “training”), links to the repository and the live service, the defence result with quotes, the cleanup mark. The protocol is not a certificate, and we call it what it is: an employer needs not a badge but a repository they can open and a person who can explain it.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'review', title: bi('Перед экзаменом', 'Before the exam'), items: [RUBRIC_Q, DL5_Q] },
  ],
};
