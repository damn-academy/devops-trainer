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
  summary: bi('Три инцидента с перекрытием за 60 минут: приоритет по влиянию, сначала вернуть сервис, статус команде, разбор без виноватых.', 'Three overlapping incidents in 60 minutes: priority by impact, restore first, status to the team, a blameless review.'),
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
        'Перед итоговым экзаменом — одна [[career.oncall|смена дежурного]]. Это генеральная репетиция и собеседования, и первой работы: за 60 минут придут три инцидента, второй — пока вы разбираете первый. Проверяется не только починка, но и то, как вы ведёте себя на дежурстве.',
        'Before the final exam comes one [[career.oncall|on-call shift]]. It is a dress rehearsal for both the interview and the first job: three incidents arrive in 60 minutes, the second while you are still on the first. Not only the fix is checked, but how you behave on call.',
      ),
    },
    {
      id: 'rules',
      kind: 'text',
      step: 'explain',
      title: bi('Правила смены', 'The rules of the shift'),
      body: bi(
        '**Приоритет по влиянию.** Первым берут инцидент, от которого сильнее всего страдают пользователи, а не тот, что пришёл раньше: сломанная оплата важнее диска, который заполнится через четыре часа, а диск важнее красного конвейера, который мешает только выкладкам. Это [[career.priority]]. Отложенный инцидент не забывают, а объявляют в чате: «вижу, возьму после текущего».\n\n**Один инцидент в работе.** На доске дежурного «Новое → Разбираю → Смягчено → Закрыто» в колонке «Разбираю» не больше одной карточки. Переключение между двумя пожарами тушит оба медленнее.\n\n**Метод тот же, что на собеседовании.** Уточнить, подтвердить симптом, назвать уровень по улике, не уничтожать улики, сначала вернуть сервис — откатив то изменение, которое вызвало сбой, — потом чинить и проверить.\n\n**Статус команде** — влияние, что делаем, когда следующий статус.\n\n**Разбор после каждого инцидента** — в четыре строки: хронология, влияние, способствующие факторы, действия. Не «кто виноват» и не одна «корневая причина», а условия системы, которые сделали сбой возможным и не дали его поймать раньше. Это [[career.blameless]].',
        '**Priority by impact.** The incident that hurts users most is taken first, not the one that came first: broken checkout beats a disk that fills in four hours, and the disk beats a red pipeline that only blocks releases. That is [[career.priority]]. A deferred incident is not forgotten but announced in the chat: “seen it, will take it after the current one”.\n\n**One incident in progress.** On the on-call board “New → Investigating → Mitigated → Closed” the Investigating column holds at most one card. Switching between two fires puts both out more slowly.\n\n**The method is the same as at an interview.** Ask, confirm the symptom, name the layer from evidence, do not destroy evidence, restore the service first — by rolling back the change that caused the failure — then fix and verify.\n\n**Status to the team**: impact, what we do, when the next update is.\n\n**A review after each incident** in four lines: timeline, impact, contributing factors, actions. Not “who is to blame” and not a single “root cause”, but the conditions of the system that made the failure possible and kept it from being caught earlier. That is a [[career.blameless]].',
      ),
    },
    {
      id: 'env',
      kind: 'callout',
      tone: 'note',
      title: bi('Где идёт смена', 'Where the shift runs'),
      body: bi('Тренировочная смена ниже идёт на доске: команды и выбор следующего шага показывают то, что показал бы настоящий сервер для скрытой причины. Зачётная смена — экзамен «Смена дежурного» на странице блока: 60 минут жёсткого таймера, два настоящих инцидента на стендах курса — выкладка, сломавшая оплату, и упавший узел кластера из кода — и вопросы о приоритете, статусе и разборе. Правила и рубрика те же.', 'The training shift below runs on a board: commands and next-step choices show what a real server would show for the hidden cause. The graded shift is the “On-call shift” exam on the block page: 60 minutes of a hard timer, two real incidents on the course stands — a release that broke checkout and a failed node of the cluster from code — and questions about priority, status and the review. The rules and the rubric are the same.'),
    },
    { id: 'shift', kind: 'widget', step: 'practice', widget: 'career.oncall' },
    {
      id: 'rubric',
      kind: 'text',
      step: 'explain',
      title: bi('Как оценивают дежурного', 'How the on-call engineer is graded'),
      body: bi(
        'Каждый критерий — от 0 до 3; сдача — все критические проверки состояния и средний балл не ниже 2 без нуля по безопасности.\n\n- **Уровень и улики.** 0 — действовали без наблюдений; 2 — назвали уровень по улике («ping по IP идёт — L3 цел»); 3 — сужали по мере новых улик.\n- **Безопасность.** 0 — разрушающее действие до сбора улик (рестарт, удаление пода); 2 — без разрушающих действий; 3 — сначала восстановили сервис, потом искали причину.\n- **Приоритизация.** 0 — по порядку прихода; 2 — первым по влиянию; 3 — и отложенный объявлен в чате.\n- **Статус.** 2 — кто страдает и насколько, что делаем, время следующего статуса; 3 — с какого момента, чем откатимся, условие раннего статуса.\n- **Разбор.** 0 — назван виноватый; 1 — одна «корневая причина»; 2 — два и больше условий системы; 3 — и почему защита не сработала, действия с владельцем и сроком.',
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
  prompt: bi('Итоговый экзамен на стендах: вы набрали 82%, но не сделали уборку. Сдан ли экзамен?', 'The final exam on the stands: you scored 82% but did not do the cleanup. Is the exam passed?'),
  options: [
    { id: 'no', text: bi('Нет: уборка — критическая проверка, её провал означает несданный экзамен при любом балле', 'No: the cleanup is a critical check, and failing it means the exam is not passed at any score'), correct: true },
    { id: 'yes', text: bi('Да: порог 75% пройден', 'Yes: the 75% threshold is passed'), why: bi('Порог нужен, но не достаточен: критические проверки обязательны все.', 'The threshold is needed but not enough: every critical check is required.') },
    { id: 'half', text: bi('Да, но с отметкой «без уборки»', 'Yes, but marked “without cleanup”'), why: bi('Такой отметки нет. Неубранный стенд стоит денег, и навык уборки проверяется наравне с остальными.', 'There is no such mark. A lab left behind costs money, and the cleanup skill is checked on a par with the rest.') },
  ],
  explain: bi('Объяснения в конце экзамена в балл не входят: они дают отдельную отметку «готовность к собеседованию».', 'The explain questions at the end do not count towards the score: they give a separate “ready for an interview” mark.'),
};

const DL5_Q: QuizItem = {
  id: 'final.q.dl5',
  kind: 'mcq',
  prompt: bi('Что доступно вам во время зачётного экзамена?', 'What is available to you during a graded exam?'),
  options: [
    { id: 'docs', text: bi('Только встроенный просмотрщик документации с белым списком источников экзамена', 'Only the built-in documentation viewer with the exam’s allowlist of sources'), correct: true },
    { id: 'mentor', text: bi('Наставник, но без готовых ответов', 'The mentor, but without ready answers'), why: bi('На экзамене наставник выключен всегда. Помощники разрешены только в режиме «тренировка», который блок не закрывает.', 'On an exam the mentor is always off. Helpers are allowed only in the “training” mode, which does not close the block.') },
    { id: 'web', text: bi('Любые сайты, если открыть их в другой вкладке', 'Any website, if opened in another tab'), why: bi('Тренажёр не следит за вкладками, а режим «экзамен» — честное слово. Журнал открытых страниц встроенной документации попадает в протокол.', 'The trainer does not watch your tabs, and the “exam” mode is a word of honour. The log of opened pages of the built-in documentation goes into the protocol.') },
  ],
};

export const L_CAPSTONE: Lesson = {
  id: 'final.capstone',
  block: 'final',
  title: bi('Итоговый экзамен: построить, починить, защитить', 'The final exam: build, fix, defend'),
  summary: bi('Один сценарий в четыре этапа — на стендах курса и на трёх настоящих машинах: кластер из кода, выкладка через Git, мониторинг, безопасность; поломка; защита; обязательная уборка.', 'One scenario in four stages — on the course stands and on three real machines: a cluster from code, a release through Git, monitoring, security; a failure; a defence; a mandatory cleanup.'),
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
        '[[career.capstone|Итоговый экзамен]] подтверждает, что вы можете сделать и защитить небольшую, но настоящую систему: [[k8s.rebuildable|пересоздаваемый кластер]], магазин в нём, выкладку через [[cicd.gitops-pull|GitOps]], мониторинг и порядок на узлах. У экзамена два варианта с одними и теми же частями и рубрикой.\n\n**На стендах курса** — зачётный экзамен на странице блока. Он идёт в браузере и ничего не стоит: те же Terraform и Edu Cloud, Ansible, kubeadm, Argo CD и forge, что в блоках IaC и «Кластер из кода». Задачи приходят карточками по этапам, проверяется состояние стенда.\n\n**На трёх настоящих машинах** — полный вариант для портфолио: свой репозиторий, своё облако, живой сервис, который можно показать работодателю. Тренажёр на этих машинах ничего не исполняет сам: он показывает шаги, считает стоимость и проверяет результат по тому, что вы вставите из терминала. План этого варианта — в чек-листе ниже; отметки сохраняются.',
        'The [[career.capstone|final exam]] confirms that you can build and defend a small but real system: a [[k8s.rebuildable|rebuildable cluster]], the shop in it, releases through [[cicd.gitops-pull|GitOps]], monitoring and order on the nodes. The exam has two variants with the same parts and the same rubric.\n\n**On the course stands** — the graded exam on the block page. It runs in the browser and costs nothing: the same Terraform and Edu Cloud, Ansible, kubeadm, Argo CD and forge as in the IaC and “A cluster from code” blocks. Tasks come as cards by stage, and the state of the stand is checked.\n\n**On three real machines** — the full variant for a portfolio: your own repository, your own cloud, a live service you can show an employer. The trainer runs nothing on those machines by itself: it shows the steps, counts the cost and checks the result by what you paste from the terminal. The plan of this variant is in the checklist below; the ticks are saved.',
      ),
    },
    {
      id: 'stages',
      kind: 'text',
      step: 'explain',
      title: bi('Экзамен на стендах: этапы', 'The exam on the stands: the stages'),
      body: bi(
        '**А. Построить.**\n\n- **А1.** Облако пустое: три узла и кластер из кода, повторный прогон `site.yml` — `changed=0`. Критическая.\n- **А2.** Выкладка версии 1.1 на три реплики коммитом в репозиторий манифестов; ревизия Application совпадает с веткой на forge. Критическая.\n- **А3.** На всех узлах снова вход только по ключам — кодом Ansible.\n- **А4.** Правило алерта на долю ошибок, которое будит дежурного на каждом всплеске: найти, чего ему не хватает.\n- **А5.** Задача вне курса — по документации и без подсказок: закрепить выкладку за тегом релиза.\n\n**Б. Починить.** Одна поломка из пула, её выбирает зерно варианта: упавший узел кластера или выкладка, после которой магазин отвечает ошибками. Найти по уликам, вернуть сервис, не пересоздавая того, что можно починить, и выбрать правильный статус для команды. Критическая.\n\n**В. Защитить.** Три вопроса техлида: единая точка отказа, откат выкладки, что сделал kubeadm и что осталось на вас. Вы отвечаете своими словами и сверяете ответ с ключевыми пунктами.\n\n**Уборка.** `terraform destroy` и пустое облако. Критическая: без неё экзамен не сдан.',
        '**A. Build.**\n\n- **A1.** The cloud is empty: three nodes and a cluster from code, a repeated run of `site.yml` gives `changed=0`. Critical.\n- **A2.** Release version 1.1 on three replicas with a commit to the manifests repository; the Application revision matches the branch on the forge. Critical.\n- **A3.** Key-only logins again on every node — with Ansible code.\n- **A4.** An error-ratio alert rule that wakes the on-call engineer on every spike: find what it is missing.\n- **A5.** A task beyond the course — from the documentation, with no hints: pin the release to a release tag.\n\n**B. Fix.** One failure from a pool, chosen by the variant seed: a failed cluster node or a release after which the shop answers with errors. Find it from evidence, restore the service without recreating what can be fixed, and choose the right status for the team. Critical.\n\n**C. Defend.** Three questions from the tech lead: the single point of failure, rolling back a release, what kubeadm did and what was left to you. You answer in your own words and check the answer against the key points.\n\n**Cleanup.** `terraform destroy` and an empty cloud. Critical: without it the exam is not passed.',
      ),
    },
    {
      id: 'rubric',
      kind: 'text',
      step: 'explain',
      title: bi('Рубрика', 'The rubric'),
      body: bi(
        '**Проверки состояния.** У каждой задачи вес; проверка смотрит на результат — машины, узлы, файлы, объекты кластера, ревизию в Git, — а не на набранные команды, поэтому подходит любой путь. Сдача — не меньше 75% и все критические задачи. Задача вне курса весит 15%: на работе половина задач — те, которых не было в учебнике.\n\n**Защита.** Ответы на вопросы этапа В в балл не входят. Они дают отдельную отметку «готовность к собеседованию»: сколько ключевых пунктов вы назвали сами. Честное «не знаю, но выяснял бы так» лучше уверенной выдумки — на живой защите по той же рубрике ноль за честность означает провал.\n\n**Смена и поломка.** Этап Б оценивается так же, как смена дежурного: улики до действий, никаких разрушающих действий до сбора улик, статус с влиянием, действием и временем.\n\n**Пересдача** — через 24 часа, новым вариантом: другая поломка, другие задачи из пулов.',
        '**State checks.** Each task has a weight; the check looks at the result — machines, nodes, files, cluster objects, the revision in Git — not at the commands typed, so any path works. To pass — at least 75% and every critical task. The task beyond the course weighs 15%: at work half the tasks are ones the textbook did not have.\n\n**The defence.** The answers to stage C do not count towards the score. They give a separate “ready for an interview” mark: how many key points you named yourself. An honest “I do not know, but I would find out like this” beats a confident invention — at a live defence by the same rubric a zero for honesty means failing.\n\n**The shift and the failure.** Stage B is graded like the on-call shift: evidence before actions, no destructive actions before gathering evidence, a status with impact, action and time.\n\n**A retake** — after 24 hours, with a new variant: another failure, other tasks from the pools.',
      ),
    },
    {
      id: 'dl5',
      kind: 'callout',
      tone: 'why',
      title: bi('Документация на экзамене', 'Documentation during the exam'),
      body: bi('Это последняя ступень лестницы документации: подсказок нет, наставник выключен, открыт только встроенный просмотрщик со справкой `--help` и `man`, `ansible-doc`, Terraform, kubernetes.io, Argo CD и Prometheus. Журнал открытых страниц попадает в протокол, но не в балл: работодателю полезно видеть, где вы искали ответ. Режим «тренировка» разрешает любых помощников, показывает полный разбор и блок не закрывает.', 'This is the last step of the documentation ladder: no hints, the mentor is off, only the built-in viewer is open with `--help` and `man`, `ansible-doc`, Terraform, kubernetes.io, Argo CD and Prometheus. The log of opened pages goes into the protocol, not into the score: an employer benefits from seeing where you looked for the answer. The “training” mode allows any helpers, shows the full review and does not close the block.'),
    },
    {
      id: 'real',
      kind: 'text',
      step: 'explain',
      title: bi('На настоящих машинах', 'On real machines'),
      body: bi(
        'Часть А — до 14 дней своим темпом: код и конвейер вы отлаживаете у себя на одной машине, а финальная сборка — заказ трёх машин и подъём всего из кода с нуля — укладывается в одну сессию. За основу удобно взять сервис пет-проекта 3. К тому, что проверяет экзамен на стендах, добавляются публичный репозиторий с README, конвейер от линта до выкладки, дашборд с четырьмя золотыми сигналами и доставка алерта в мессенджер, а опытному — kubeadm со снимком etcd по расписанию, обновлением на следующую минорную версию и проверкой сертификатов.\n\n**Часть Б — 60 минут, жёсткий таймер.** В систему вносится одна обратимая поломка, которая не трогает ваши данные; полный список возможных поломок и команды отката показываются заранее. После «починил» все проверки части А снова зелёные, данные целы, статус и разбор написаны.\n\n**Часть В — 40 минут.** Мок-интервьюер получает README, схему, файл конвейера и протокол частей А и Б и спрашивает по вашему проекту. Порог — средний балл не ниже 2 из 3 и ни одного нуля по честности. Ту же защиту стоит пройти и с живым человеком.',
        'Part A — up to 14 days at your own pace: you debug the code and pipeline on one machine of your own, and the final build — ordering three machines and bringing everything up from code from scratch — fits in one session. Project 3’s service is a convenient base. On top of what the stand exam checks come a public repository with a README, a pipeline from lint to release, a dashboard with the four golden signals and alert delivery to a messenger, and for the experienced — kubeadm with a scheduled etcd snapshot, an upgrade to the next minor version and a certificate check.\n\n**Part B — 60 minutes, hard timer.** One reversible failure that does not touch your data is planted in the system; the full list of possible failures and their rollback commands is shown in advance. After “fixed”, every check of part A is green again, the data is intact, the status and the review are written.\n\n**Part C — 40 minutes.** The mock interviewer gets the README, the diagram, the pipeline file and the protocol of parts A and B and asks about your project. To pass: a mean score of at least 2 of 3 and no zero for honesty. It is worth doing the same defence with a live person too.',
      ),
    },
    {
      id: 'cost',
      kind: 'callout',
      tone: 'cost',
      title: bi('Стоимость', 'Cost'),
      body: bi('До заказа посчитайте «3 машины × размер × часы» у выбранного провайдера и отдельно — цену суток, если забыть удалить. Требования к узлам kubeadm — не меньше 2 vCPU и 2 ГБ памяти на управляющий узел. Всё, что можно, отлаживайте на одной машине или на стенде курса: финальная сборка из кода — одна сессия, а не две недели аренды.', 'Before ordering, work out “3 machines × size × hours” at your chosen provider, and separately the price of a day if you forget to delete them. kubeadm needs at least 2 vCPUs and 2 GB of memory on the control-plane node. Debug whatever you can on one machine or on the course stand: the final build from code is one session, not two weeks of rent.'),
    },
    {
      id: 'cleanup',
      kind: 'callout',
      tone: 'cleanup',
      title: bi('Уборка — обязательна', 'Cleanup is mandatory'),
      body: bi('Протокол не выдаётся, пока не сделана [[career.cleanup|уборка]]: последняя строка `terraform destroy` — `Destroy complete! Resources: N destroyed.`, где N совпадает с числом ресурсов в state, затем пустой `terraform state list` и пустой список машин провайдера по метке экзамена. Если хотите оставить сервис живым для работодателя, оставьте одну машину и знайте её месячную цену.', 'The protocol is not issued until the [[career.cleanup|cleanup]] is done: the last line of `terraform destroy` reads `Destroy complete! Resources: N destroyed.` where N equals the number of resources in the state, then an empty `terraform state list` and an empty list of provider machines with the exam label. If you want to keep the service alive for employers, keep one machine and know its monthly price.'),
    },
    { id: 'checklist', kind: 'widget', step: 'practice', widget: 'career.checklist', props: { kind: 'capstone' } },
    {
      id: 'protocol',
      kind: 'text',
      step: 'exit',
      body: bi(
        'Итог — протокол: что проверено, какие проверки прошли, режим работы («экзамен» или «тренировка»), ссылки на репозиторий и живой сервис, итог защиты с цитатами, отметка уборки. Протокол — не сертификат, и мы так его и называем: работодателю нужен не значок, а репозиторий, который он может открыть, и человек, который его объяснит.',
        'The result is a protocol: what was checked, which checks passed, the mode (“exam” or “training”), links to the repository and the live service, the defence result with quotes, the cleanup mark. The protocol is not a certificate, and we call it what it is: an employer needs not a badge but a repository they can open and a person who can explain it.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'review', title: bi('Перед экзаменом', 'Before the exam'), items: [RUBRIC_Q, DL5_Q] },
  ],
};
