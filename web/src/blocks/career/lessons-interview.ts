// Career lessons 1–5: how a junior interview works, the structure of an
// answer, the two questions everybody mixes up, the situational question,
// the mock interview.

import { bi } from '../../core/i18n';
import type { Lesson } from '../../core/types';

const SRC = {
  roadmap: { title: 'roadmap.sh — DevOps interview questions', url: 'https://roadmap.sh/questions/devops' },
  exercises: { title: 'devops-exercises (bregman-arie)', url: 'https://github.com/bregman-arie/devops-exercises' },
  interviewingio: { title: 'interviewing.io — How is AI changing interview processes?', url: 'https://interviewing.io/blog/how-is-ai-changing-interview-processes-not-much-and-a-whole-lot' },
  kts: { title: 'KTS: как мы перевели собеседования DevOps на тренажёр (Хабр)', url: 'https://habr.com/ru/companies/kts/articles/795277/' },
  tproger: { title: 'Tproger: подборка тестовых заданий для junior DevOps', url: 'https://tproger.ru/articles/nebolshaja-podborka-testovyh-zadanij-dlja-junior-devops-inzhenera' },
  dig: { title: 'dig(1) — Linux manual page', url: 'https://man7.org/linux/man-pages/man1/dig.1.html' },
  dnsRu: { title: 'DNS — Википедия', url: 'https://ru.wikipedia.org/wiki/DNS' },
  ns7: { title: 'namespaces(7) — Linux manual page', url: 'https://man7.org/linux/man-pages/man7/namespaces.7.html' },
  cg7: { title: 'cgroups(7) — Linux manual page', url: 'https://man7.org/linux/man-pages/man7/cgroups.7.html' },
  fowler: { title: 'Martin Fowler — Continuous Delivery', url: 'https://martinfowler.com/bliki/ContinuousDelivery.html' },
  kubevirt: { title: 'KubeVirt — user guide', url: 'https://kubevirt.io/user-guide/' },
  vmRu: { title: 'Виртуальная машина — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%92%D0%B8%D1%80%D1%82%D1%83%D0%B0%D0%BB%D1%8C%D0%BD%D0%B0%D1%8F_%D0%BC%D0%B0%D1%88%D0%B8%D0%BD%D0%B0' },
  ctrRu: { title: 'Контейнеризация — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%9A%D0%BE%D0%BD%D1%82%D0%B5%D0%B9%D0%BD%D0%B5%D1%80%D0%B8%D0%B7%D0%B0%D1%86%D0%B8%D1%8F' },
  ciRu: { title: 'Непрерывная интеграция — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%9D%D0%B5%D0%BF%D1%80%D0%B5%D1%80%D1%8B%D0%B2%D0%BD%D0%B0%D1%8F_%D0%B8%D0%BD%D1%82%D0%B5%D0%B3%D1%80%D0%B0%D1%86%D0%B8%D1%8F' },
  nginxProxy: { title: 'nginx — ngx_http_proxy_module', url: 'https://nginx.org/en/docs/http/ngx_http_proxy_module.html' },
  mdn504: { title: 'MDN — 504 Gateway Timeout', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/504' },
  mdn504ru: { title: 'MDN — 504 Gateway Timeout (рус.)', url: 'https://developer.mozilla.org/ru/docs/Web/HTTP/Status/504' },
  k8sDebug: { title: 'Kubernetes — Debug Pods', url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/' },
  k8sRu: { title: 'Компоненты Kubernetes — kubernetes.io', url: 'https://kubernetes.io/ru/docs/concepts/overview/components/' },
  sreIncidents: { title: 'Google SRE Book — Managing Incidents', url: 'https://sre.google/sre-book/managing-incidents/' },
  httpCodesRu: { title: 'Список кодов состояния HTTP — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%A1%D0%BF%D0%B8%D1%81%D0%BE%D0%BA_%D0%BA%D0%BE%D0%B4%D0%BE%D0%B2_%D1%81%D0%BE%D1%81%D1%82%D0%BE%D1%8F%D0%BD%D0%B8%D1%8F_HTTP' },
  star: { title: 'Situation, task, action, result — Wikipedia', url: 'https://en.wikipedia.org/wiki/Situation,_task,_action,_result' },
  lev: { title: 'Levenshtein distance — Wikipedia', url: 'https://en.wikipedia.org/wiki/Levenshtein_distance' },
  levRu: { title: 'Расстояние Левенштейна — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%A0%D0%B0%D1%81%D1%81%D1%82%D0%BE%D1%8F%D0%BD%D0%B8%D0%B5_%D0%9B%D0%B5%D0%B2%D0%B5%D0%BD%D1%88%D1%82%D0%B5%D0%B9%D0%BD%D0%B0' },
};


export const L_INTERVIEWS: Lesson = {
  id: 'career.interviews',
  block: 'career',
  title: bi('Как устроено собеседование на должность начинающего инженера', 'How a junior interview works'),
  summary: bi('Из каких этапов состоит собеседование, что проверяют на каждом из них и какое правило помогает отвечать на технические вопросы.', 'The stages, what each of them checks, and the main rule of an answer.'),
  introduces: ['career.interview', 'career.logic'],
  uses: [],
  tier: 'core',
  minutes: 20,
  sources: { en: [SRC.roadmap, SRC.interviewingio, SRC.exercises], ru: [SRC.kts, SRC.tproger] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Проходить собеседования — такое же умение, как читать журнал или собирать образ контейнера. У собеседования есть своё устройство, в нём есть типичные ошибки, и к нему можно готовиться упражнениями. В маршруте блок о карьере стоит последним, но открыть его можно в любой момент. Если начать его рано, параллельно с техническими блоками, то к тому дню, когда вы отправите первый отклик, вы уже научитесь объяснять вслух то, что знаете.\n\nНачнём с того, из каких этапов состоит собеседование и что на каждом из них проверяют на самом деле.',
        'An interview is a skill like reading a log or building an image: it has a structure, typical mistakes and ways to practise. On the route the career block comes last, but it can be opened at any time. If you start it early, alongside the technical blocks, then by the time you send your first application you will already be able to explain what you know aloud.\n\nLet us start with how an interview is built and what each stage really checks.',
      ),
    },
    {
      id: 'stages',
      kind: 'text',
      step: 'look',
      title: bi('Четыре этапа собеседования', 'Four stages'),
      body: bi(
        '### Скрининг\nПервый разговор длится 15–30 минут, и ведёт его рекрутер. Он спрашивает о мотивации, об ожиданиях и о том, в каком формате вы хотите работать. На этом этапе проверяют, понимаете ли вы, куда идёте, и умеете ли коротко рассказать о себе.\n\n### Техническое интервью\nЭто разговор с инженером команды на 60–90 минут. Вас спросят о Linux, сетях, контейнерах, Kubernetes, CI/CD, инфраструктуре как коде и мониторинге, зададут вопросы вида «что происходит, когда…» и почти наверняка один ситуационный вопрос, например «сайт отвечает ошибкой 504, что вы будете делать?». Иногда вдобавок дают задачу на алгоритмы или просят спроектировать простую систему, например сервис с базой данных, который переживёт отказ одной машины. Если готового ответа вы не знаете, рассуждайте вслух: назовите, что может отказать, как вы это заметите и как система это переживёт, потому что здесь оценивают ход рассуждения.\n\n### Практика\nПрактический этап бывает не всегда. Иногда дают небольшое задание на дом: написать Dockerfile и файл compose для приложения, собрать простой конвейер или плейбук. Всё чаще вместо вопросов по теории дают живую песочницу: чистый кластер и задачу выложить в него сервис. Документацией и поиском пользоваться можно, экран вы показываете интервьюеру, а ваш уровень определяется тем, докуда вы успели дойти.\n\n### Финал\nПоследний разговор проходит с руководителем. Говорят о команде, процессах, дежурствах и вашей мотивации, и здесь особенно ценят вопросы, которые задаёте вы сами.',
        '### Screening\n15–30 minutes with a recruiter: motivation, expectations, the way of working. They check whether you understand where you are going and can talk about yourself briefly.\n\n### Technical interview\n60–90 minutes with an engineer: theory on Linux, networks, containers, Kubernetes, CI/CD, IaC and monitoring; “what happens when…” questions; one situational question such as “the site returns 504 — what do you do?”. Sometimes there is also an algorithms task or a request to design a simple system, such as a service with a database that survives the loss of one machine. If you do not know a ready answer, reason aloud: name what can fail, how you would notice it and how the system would survive it, because the reasoning is what is graded here.\n\n### Practice\nNot always. Sometimes a small take-home task: a Dockerfile and compose for an application, a simple pipeline, a playbook. More and more often a live sandbox replaces theory: a clean cluster, a task to deploy a service, documentation and search allowed, a shared screen. Your level is how far you get.\n\n### Final round\nWith the manager: the team, the processes, on-call, motivation. Your own questions are valued here.',
      ),
    },
    {
      id: 'checks',
      kind: 'text',
      step: 'explain',
      title: bi('Что проверяют на самом деле', 'What is really checked'),
      body: bi(
        'Вопросы на собеседованиях бывают очень разными, но за ними инженер, который нанимает начинающего коллегу (в вакансиях такую должность называют junior, а в разговоре джуном), ищет пять вещей:\n\n1. **Понимаете ли вы, как устроен механизм**, или только помните команды. Вопрос «что происходит, когда вы вводите адрес в браузере» спрашивает о цепочке DNS, TCP, TLS и HTTP, а не о названии команды.\n2. **Умеете ли вы действовать, когда сломалось что-то незнакомое**, то есть идёте ли вы от симптома к причине и собираете ли улики прежде, чем что-то менять.\n3. **Можете ли вы объяснить, что сделали сами**: свой пет-проект, своё решение, свою ошибку.\n4. **Найдёте ли вы ответ сами**, если этому вас не учили: в man, в выводе `--help`, в `kubectl explain`, в официальной документации.\n5. **Признаёте ли вы вслух, где кончаются ваши знания.** Ответ «не знаю, но выяснял бы так» ценится выше уверенной выдумки.\n\nКурс тренирует каждое из пяти умений отдельно. Понимание механизмов закрепляют вопросы после уроков и повторение, работу с поломками — тренажёры и экзамены, умение объяснять — вопросы «объясните» и учебные интервью, поиск по документации — лестница документации, а честность — критерий честности в рубрике учебного интервью, где ноль за выдуманный ответ проваливает всё интервью.',
        'The questions differ, but a hiring engineer looks for five things:\n\n1. **Do you understand the mechanism**, rather than remember commands. “What happens when you type an address into a browser” is a question about the chain DNS → TCP → TLS → HTTP, not about the name of a command.\n2. **Can you act in an unfamiliar failure**: do you go from symptom to cause, do you collect evidence before changing things.\n3. **Can you explain what you did**: your pet project, your decision, your mistake.\n4. **Will you find the answer yourself** when nobody taught you — in man, `--help`, `kubectl explain`, the official documentation.\n5. **Are you honest about the limits of your knowledge**: “I don’t know, but I would find out like this” is worth more than a confident invention.\n\nThe course trains each of the five separately: concepts with quizzes and review, failures with trainers and exams, explaining with “explain” questions and mock interviews, documentation with the documentation ladder, honesty with the honesty criterion of the mock interview rubric, where a zero for an invented answer fails the whole interview.',
      ),
    },
    {
      id: 'rule',
      kind: 'callout',
      tone: 'why',
      step: 'explain',
      title: bi('Почему на собеседовании объясняют механизм, а не называют команды', 'Why at an interview you explain the mechanism instead of naming commands'),
      body: bi(
        'На вопрос «как проверить DNS?» ответ «`nslookup host`» звучит уверенно, но ничего не сообщает, потому что интервьюер так и не узнал, понимаете ли вы, что такое резолвер, кэш и время жизни записи (TTL). Объясните механизм, а команду назовите как способ его увидеть. Например: «DNS превращает имя в адрес. Клиент спрашивает резолвер, резолвер проходит от корневых серверов к серверу зоны и запоминает ответ на время TTL. Проверяю я это командой `dig`: сначала спрашиваю резолвер, а потом напрямую сервер, который хранит записи зоны». Такой подход мы называем правилом [[career.logic|«логика, а не команды»]].',
        'To “how do you check DNS?” the answer “`nslookup host`” sounds confident and says nothing: the interviewer did not learn whether you understand what a resolver, a cache and a TTL are. Explain the mechanism and name the command as a way to see it: “DNS turns a name into an address; the client asks the resolver, which walks from the root to the zone server and caches the answer for the TTL; I check with `dig`, first through the resolver, then directly at the authoritative server.” That is [[career.logic|logic, not commands]].',
      ),
    },
    {
      id: 'ai',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Нейросети изменили собеседования не так, как многие думают. Компании не столько запрещают кандидатам пользоваться помощниками, сколько меняют вопросы: после любого ответа интервьюер спросит «почему?», «а если…?», «откуда вы это знаете?». Заученный или зачитанный ответ на таких уточнениях рассыпается, а понятый механизм выдерживает их. Поэтому учебный интервьюер в этом блоке всегда задаёт уточняющие вопросы.',
        'AI changed interviews, but not in the way it seems. Companies do not so much ban assistants as change the questions: every answer is followed by “why?”, “what if…?”, “how do you know?”. A recited answer falls apart under them; an understood mechanism does not. That is why the mock interviews of this block always ask follow-ups.',
      ),
    },
    {
      id: 'lvl-b',
      kind: 'callout',
      tone: 'note',
      levels: ['beginner'],
      title: bi('Если вы ещё не проходили собеседований в IT', 'If you have never had an IT interview'),
      body: bi('Чаще всего новичку мешают три вещи: волнение, сбивчивая речь, когда разговор заходит о технике, и отсутствие историй из практики. Поэтому для вас блок делает упор на самопрезентацию, на перевод прежнего опыта на язык новой профессии и на тренировку вслух. Прежде чем идти на настоящие собеседования, пройдите не меньше пяти учебных.', 'The main risks are fear, stumbling over technical words and having no stories from practice. The block puts extra weight for you on self-presentation, translating earlier experience and practising aloud; do at least five mock interviews before real ones.'),
    },
    {
      id: 'lvl-i',
      kind: 'callout',
      tone: 'note',
      levels: ['intermediate'],
      title: bi('Если вы пришли из поддержки, тестирования или аналитики', 'If you come from support, QA or analytics'),
      body: bi('Люди с таким опытом часто описывают его словами процесса («закрывал тикеты»), а не словами системы («находил по журналам, на каком сервисе прерывается запрос»), и недооценивают свой опыт разбора инцидентов. Переводите этот опыт на язык системы, потому что опыт разбора инцидентов отличает вас от других новичков.', 'You tend to describe experience in process words (“closed tickets”) rather than system words (“found in the logs which service the request stopped at”) and undervalue your incident experience. Translate it into system words, because incident work is what sets you apart from other newcomers.'),
    },
    {
      id: 'lvl-e',
      kind: 'callout',
      tone: 'warn',
      levels: ['experienced'],
      title: bi('Если вы программист или администратор', 'If you are a developer or an admin'),
      body: bi('Опытным людям мешает снисходительность к «простым» вопросам: они отвечают командой вместо механизма и не решаются сказать «не знаю». На простой вопрос отвечайте так же полно, как на сложный, ведь интервьюер не знает, что вы знаете, пока вы этого не сказали.', 'The risk is condescension towards “simple” questions, answering with commands instead of mechanisms, and not being able to say “I don’t know”. Answer a simple question as fully as a hard one: the interviewer does not know what you know until you say it.'),
    },
    {
      id: 'age',
      kind: 'text',
      step: 'explain',
      levels: ['beginner', 'intermediate'],
      title: bi('Не поздно ли менять профессию в 35 или 40 лет', 'Is it too late to change careers at 35 or 40'),
      body: bi(
        'Этот вопрос задают себе многие, кто приходит в DevOps из другой профессии, и ответ на него состоит из двух частей. Первая часть обнадёживает, потому что возраст сам по себе не мешает выучиться. В этом курсе ничего не рассчитано на двадцатилетних, а опыт работы с людьми, сроками, отчётами и сбоями пригодится на первой же неделе, потому что немалая часть работы DevOps-инженера состоит из договорённостей между командами. Вторая часть трезвее, потому что рынок устроен не так ровно. Некоторые компании охотнее берут на начальные должности молодых, а вакансий без опыта мало для любого возраста. Поэтому рассчитывать стоит не на прямой путь от курса к вакансии DevOps-инженера, а на один из путей, которыми входят в профессию на деле.\n\nПервый путь ведёт через соседнюю должность: поддержку второй линии, системное администрирование, внедрение или дежурства. На такие должности берут без опыта DevOps, а после года работы с серверами и инцидентами переход становится обычным делом. Второй путь ведёт через вашу нынешнюю работу. Если в компании есть ИТ-отдел, предложите автоматизировать то, что ваш отдел делает руками, и вы получите и опыт, и рекомендацию. Третий путь ведёт через отрасль, которую вы знаете. Учитель может искать компании, которые делают образовательные платформы, бывший продавец автомобилей — компании с продуктами для дилеров, и там ваше знание предмета весит больше возраста. Сроки при этом те же, что у всех: путь с нуля до первой работы занимает около года, и подробнее о сроках и соседних должностях рассказывает урок о поиске работы.',
        'Many people coming to DevOps from another profession ask themselves this, and the answer has two parts. The first is encouraging: age by itself does not stop you from learning. Nothing in this course is designed for twenty-year-olds, and experience with people, deadlines, reports and failures is useful in the very first week, because a good part of a DevOps engineer’s work consists of agreements between teams. The second part is more sober: the market is not so even. Some companies prefer younger people for entry positions, and there are few vacancies without experience at any age. So count not on a direct path from the course to a DevOps vacancy but on one of the paths people actually take into the profession.\n\nThe first path goes through a neighbouring position: second-line support, system administration, implementation or on-call duty. Such positions take people without DevOps experience, and after a year of work with servers and incidents a move becomes ordinary. The second path goes through your current job. If the company has an IT department, offer to automate what your department does by hand, and you get both experience and a recommendation. The third path goes through an industry you know. A teacher can look at companies that build education platforms, a former car salesman at companies with products for dealers, and there your knowledge of the subject weighs more than your age. The timeline is the same as for everyone: the path from zero to a first job takes about a year, and the lesson on the job search says more about the timeline and the neighbouring positions.',
      ),
    },
    {
      id: 'exit',
      kind: 'quiz',
      step: 'exit',
      title: bi('Проверьте себя', 'Check yourself'),
      items: ['career.q.stages', 'career.q.logic', 'career.q.five'],
    },
  ],
};

export const L_ANSWER: Lesson = {
  id: 'career.answer',
  block: 'career',
  title: bi('Ответ, в котором сказано, что это, зачем оно нужно, как работает и когда им пользуются', 'An answer that says what it is, why it exists, how it works and when you use it'),
  summary: bi('Как превратить ответ-команду в объяснение механизма и как признаться, что вы не знаете ответа, так, чтобы это признание работало на вас.', 'How to turn a one-command answer into an explanation of the mechanism, and how to admit that you do not know an answer so that the admission works for you.'),
  introduces: ['career.answer-structure', 'career.dont-know'],
  uses: ['career.logic', 'career.interview'],
  tier: 'core',
  minutes: 30,
  sources: { en: [SRC.dig, SRC.exercises, SRC.roadmap], ru: [SRC.dnsRu, SRC.kts] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Вернёмся к ответу из прошлого урока, «`nslookup host`», и посмотрим, чего в нём не хватает. Не хватает четырёх вещей, и у каждой в хорошем ответе своё место: **что это такое**, **зачем оно нужно**, **как оно работает** и **когда вы этим пользуетесь**. Эти четыре части и составляют [[career.answer-structure|структуру ответа]].',
        'Take the answer from the last lesson, “`nslookup host`”, and see what is missing. Four things are missing, and each has its place: **what it is**, **why it exists**, **how it works** and **when you use it**. That is the [[career.answer-structure|answer structure]].',
      ),
    },
    {
      id: 'parts',
      kind: 'text',
      step: 'explain',
      title: bi('Четыре части ответа на примере DNS', 'The four parts, with DNS as the example'),
      body: bi(
        '**Что это.** DNS превращает имя вроде shop.example в адрес сервера и хранит другие записи об этом имени.\n\n**Зачем это нужно.** Люди и файлы конфигурации пользуются именами, а адреса серверов меняются. Имя остаётся прежним, а запись с адресом обновляют в одном месте.\n\n**Как это работает.** Программа спрашивает резолвер, адрес которого записан в файле `/etc/resolv.conf`. На многих системах там стоит местный резолвер, например 127.0.0.53 у systemd-resolved, и он сам ничего не ищет, а передаёт вопрос рекурсивному резолверу провайдера или компании. Если ответа нет в кэше, рекурсивный резолвер обращается сначала к корневым серверам, затем к серверу зоны первого уровня, затем к серверу, который хранит записи нужной зоны, и запоминает ответ на время TTL.\n\n**Когда я этим пользуюсь.** Сначала спрашиваю резолвер командой `dig shop.example`. Если ответ выглядит странно, спрашиваю напрямую сервер, который хранит записи зоны, и так отделяю проблему кэша от проблемы самой записи.\n\nКоманда при этом никуда не исчезла. Она стоит в последней части ответа и служит способом увидеть механизм. Чтобы проверить себя, посмотрите, сколько места в ответе занимают команды: если меньше трети, ответ построен правильно.',
        '**What.** DNS turns a name such as shop.example into an address and other records.\n\n**Why.** People and configs use names while addresses change: the name stays and the record is updated in one place.\n\n**How.** The client asks the resolver from `/etc/resolv.conf`. On many systems that is a local resolver, such as 127.0.0.53 of systemd-resolved, which searches nothing itself and passes the question to the recursive resolver of the provider or the company. If the answer is not cached, the recursive resolver walks from the root servers to the top-level zone server, then to the zone’s authoritative server, and caches the answer for its TTL.\n\n**When.** First I ask the resolver, `dig shop.example`; if the answer looks wrong I ask the authoritative server directly, which separates a caching problem from a problem with the record itself.\n\nThe command has not gone anywhere: it sits in the last part, as a way to see the mechanism. A good self-check: commands take less than a third of the answer.',
      ),
    },
    {
      id: 'translator',
      kind: 'widget',
      step: 'try',
      widget: 'career.translator',
      props: { cards: ['q.dns', 'q.links', 'q.stop10', 'q.disk', 'q.rate', 'q.devops'], need: 2 },
    },
    {
      id: 'dont-know',
      kind: 'text',
      step: 'explain',
      title: bi('Что отвечать, если вы не знаете ответа', 'When you don’t know'),
      body: bi(
        'На любом собеседовании прозвучит вопрос, на который вы не знаете ответа. Хуже всего в этот момент выдумать ответ, потому что опытный интервьюер сразу это услышит, и после этого под сомнением окажется всё, что вы сказали раньше. Хороший ответ складывается из трёх шагов:\n\n1. **Признать, что вы этого не знаете**, например так: «С Consul я не работал».\n2. **Связать вопрос с тем, что вы знаете**, например: «Судя по задаче, речь об обнаружении сервисов. В Kubernetes эту задачу решают DNS кластера и объекты Service».\n3. **Сказать, как бы вы это выяснили, и назвать конкретный источник**, например: «Я открыл бы документацию Consul, раздел об обнаружении сервисов, и проверил бы в песочнице, что вернёт запрос DNS к нему».\n\nТакой ответ мы называем [[career.dont-know|честным «не знаю»]]. Конкретный источник здесь важен, потому что слово «погуглю» ничего о вас не говорит, а ответ «посмотрю в `man ss`, раздел FILTER» показывает, что вы умеете искать.',
        'Every interview has a question you cannot answer. An invented answer is the worst outcome: an experienced interviewer hears it at once, and everything said before is now in doubt. A good answer has three steps:\n\n1. **Admit it honestly**: “I haven’t worked with Consul.”\n2. **Link it to what you know**: “From the task it sounds like service discovery: in Kubernetes cluster DNS and Service objects solve that.”\n3. **Say how you would find out and name a concrete source**: “I would open the Consul documentation, the service discovery section, and check in a sandbox what a DNS query to it returns.”\n\nThat is [[career.dont-know|an honest “I don’t know”]]. A concrete source matters: “I’ll google it” says nothing, while “`man ss`, the FILTER section” shows you know how to look.',
      ),
    },
    {
      id: 'calibration',
      kind: 'callout',
      tone: 'note',
      body: bi(
        'Тренировать честное «не знаю» удобнее всего на учебном интервью. В его рубрике есть критерий честности, и за выдуманный ответ по нему ставят ноль, который проваливает всё интервью, а за признание с планом, где вы выяснили бы ответ, ставят высший балл. Кто несколько раз услышал такой разбор своих ответов, спокойно говорит «не знаю» там, где это правда.',
        'The mock interview is the easiest place to practise an honest “I don’t know”. Its rubric has an honesty criterion: an invented answer gets a zero there, which fails the whole interview, and an admission with a plan of where you would find out gets the top score. Once you have heard such a review of your answers a few times, you can calmly say “I don’t know” where it is true.',
      ),
    },
    {
      id: 'exit',
      kind: 'quiz',
      step: 'exit',
      title: bi('Проверьте себя', 'Check yourself'),
      items: ['career.q.order-parts', 'career.q.dont-know', 'career.q.mechanism'],
    },
  ],
};

export const L_CLASSICS: Lesson = {
  id: 'career.classics',
  block: 'career',
  title: bi('Два вопроса, в которых путаются все', 'Two questions everybody mixes up'),
  summary: bi('Чем контейнер отличается от виртуальной машины и чем непрерывная интеграция отличается от непрерывной доставки и непрерывного развёртывания.', 'Container vs virtual machine; integration, delivery and deployment.'),
  introduces: ['career.q-vm-container', 'career.q-ci-cd'],
  uses: ['career.answer-structure'],
  tier: 'core',
  minutes: 25,
  sources: { en: [SRC.ns7, SRC.cg7, SRC.kubevirt, SRC.fowler], ru: [SRC.vmRu, SRC.ctrRu, SRC.ciRu] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Два вопроса задают почти на каждом собеседовании начинающего инженера, и почти все отвечают на них одинаково плохо: «чем контейнер отличается от виртуальной машины?» и «чем CI отличается от CD?». Плохо потому, что вместо механизма кандидаты дают сравнение вроде «контейнер легче». Разберём оба вопроса по четырём частям из прошлого урока.',
        'Two questions come up at nearly every junior interview, and nearly everyone answers them equally badly: “how is a container different from a virtual machine?” and “how is CI different from CD?”. Badly, because people answer with a comparison (“a container is lighter”) instead of a mechanism. Let us go through both with the four parts from the last lesson.',
      ),
    },
    {
      id: 'vm',
      kind: 'text',
      step: 'explain',
      title: bi('Контейнер и виртуальная машина', 'Container and virtual machine'),
      body: bi(
        'Виртуальная машина имитирует целый компьютер, и поверх гипервизора у неё работает собственное ядро операционной системы. Поэтому виртуальная машина тяжелее и дольше запускается, зато изолирована сильнее, и внутри неё можно запустить другую операционную систему.\n\nКонтейнер же остаётся обычным процессом основной машины, которую называют хостом. Ядро хоста показывает этому процессу собственный вид системы через **пространства имён** (свои процессы, своя сеть, своя файловая система, своё имя машины) и ограничивает его ресурсы через **cgroups**. Ядро у всех контейнеров хоста общее, поэтому контейнер лёгкий и запускается за доли секунды. Но запустить в нём ядро другой операционной системы нельзя, а уязвимость в ядре затрагивает сразу все контейнеры хоста.\n\nСильный ответ отличается от среднего последней частью, в которой сказано, что **контейнеры и виртуальные машины не исключают друг друга**. В облаке контейнеры почти всегда работают внутри виртуальных машин. Kubernetes ставят и на физические серверы без виртуализации. А с помощью KubeVirt виртуальные машины запускают внутри Kubernetes, и так устроены, например, открытые облачные платформы, построенные на Kubernetes. Виртуальную машину выбирают, когда нужна сильная изоляция или другая операционная система, а контейнер выбирают, чтобы упаковать приложение и запускать его одинаково везде.\n\nИнтервьюер ждёт от вас пяти пунктов: собственное ядро против общего, пространства имён, cgroups, то, что из этого следует для скорости, плотности размещения и изоляции, и вложенность одного в другое. Это и есть хороший ответ на вопрос [[career.q-vm-container|«виртуальная машина или контейнер»]].',
        'A virtual machine emulates a computer: it has its own operating system kernel on top of a hypervisor. So it is heavier and slower to start, but it isolates more strongly and can run another OS inside.\n\nA container is an ordinary process of the host to which the kernel shows its own view of the system through **namespaces** (its own processes, network, file system, host name) and whose resources it limits through **cgroups**. The kernel is shared, so a container is light and starts in a fraction of a second, but it cannot run the kernel of another OS, and a kernel vulnerability affects every container on the host.\n\nWhat sets a strong answer apart is the last part: **they are not either-or**. In the cloud, containers nearly always run inside virtual machines; Kubernetes is also installed on bare metal; and with KubeVirt virtual machines run inside Kubernetes — open cloud platforms built on it work like that. A VM is chosen for strong isolation or another OS, a container to package and run applications.\n\nThe five key points the interviewer waits for: own kernel versus shared; namespaces; cgroups; the consequences for speed, density and isolation; nesting. This is a good answer to [[career.q-vm-container|VM vs container]].',
      ),
    },
    {
      id: 'ci',
      kind: 'text',
      step: 'explain',
      title: bi('Интеграция, доставка и развёртывание', 'Integration, delivery, deployment'),
      body: bi(
        '**Непрерывная интеграция** (continuous integration, CI) означает, что разработчики часто сливают свои изменения в общую ветку, и каждое слияние автоматически собирается и проверяется тестами. Благодаря этому ошибки, которые возникают, когда изменения разных людей встречаются, находятся за минуты, а не за недели.\n\nСледующий шаг называется **непрерывной доставкой** (continuous delivery). При ней каждое изменение, прошедшее конвейер, в любой момент готово к выкладке на рабочие серверы, но саму выкладку запускает человек.\n\n**Непрерывное развёртывание** (continuous deployment) делает автоматической и выкладку на рабочие серверы, без ручного шага. Для этого нужны хорошее покрытие тестами, мониторинг и быстрый откат.\n\nДве буквы CD обозначают разные вещи, и интервьюер проверяет, знаете ли вы, что граница между ними определяется тем, **есть ли ручной шаг перед выкладкой на рабочие серверы**. Это и есть ответ на вопрос [[career.q-ci-cd|о CI, доставке и развёртывании]].',
        '**Continuous integration**: developers merge changes into a shared branch often, and every merge is automatically built and tested, so integration bugs are found in minutes, not weeks.\n\n**Continuous delivery** is the next step: every change that passed the pipeline can go to production at any moment, but a person starts the release.\n\n**Continuous deployment**: the release to production is automatic too, with no manual step. It needs good test coverage, monitoring and a fast rollback.\n\nThe two letters CD mean different things, and the interviewer checks whether you know where the line is: **whether there is a manual step before production**. This is the answer to [[career.q-ci-cd|CI, delivery and deployment]].',
      ),
    },
    {
      id: 'translator',
      kind: 'widget',
      step: 'try',
      widget: 'career.translator',
      props: { cards: ['q.vm-container', 'q.ci-cd'], need: 2 },
    },
    {
      id: 'exit',
      kind: 'quiz',
      step: 'exit',
      title: bi('Проверьте себя', 'Check yourself'),
      items: ['career.q.cd-match', 'career.q.vm-multi', 'career.q.windows', 'career.q.nesting'],
    },
  ],
};

export const L_SITUATIONAL: Lesson = {
  id: 'career.situational',
  block: 'career',
  title: bi('Как отвечать на ситуационный вопрос, идя от симптома к причине', 'How to answer a situational question, going from symptom to cause'),
  summary: bi('Как отвечать на вопрос «сайт отвечает ошибкой 504, что будете делать?»: метод поиска, плохие пути и статус для команды. В уроке три тренировки в песочнице.', '“504 — what do you do?”: the method, the bad paths and the status to the team. Three sandbox drills.'),
  introduces: ['career.situational', 'career.mitigate-first', 'career.status-update'],
  uses: ['career.answer-structure', 'career.dont-know'],
  tier: 'core',
  minutes: 40,
  sources: { en: [SRC.nginxProxy, SRC.mdn504, SRC.k8sDebug, SRC.sreIncidents], ru: [SRC.mdn504ru, SRC.httpCodesRu, SRC.k8sRu] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        '«Сайт отвечает ошибкой 504, что вы будете делать?» Правильной команды на этот вопрос нет, и интервьюер её не ждёт. Он проверяет **метод**: идёте ли вы от симптома к причине, переходя с уровня на уровень, выдвигаете ли гипотезы и проверяете ли их уликами, не уничтожаете ли улики раньше времени и думаете ли о пользователях. Такой вопрос называют [[career.situational|ситуационным]].',
        '“The site returns 504 — what will you do?” There is no right command here, and the interviewer does not expect one. They check the **method**: do you go from symptom to cause layer by layer, do you form hypotheses and test them with evidence, do you avoid destroying evidence too early, do you think about the users. That is a [[career.situational|situational question]].',
      ),
    },
    {
      id: 'method',
      kind: 'text',
      step: 'explain',
      title: bi('Метод в семь шагов', 'The method in seven steps'),
      body: bi(
        '1. **Уточните, что происходит.** Ошибка у всех или у одного пользователя, на каких страницах, с какого момента и что перед этим менялось. Пара таких вопросов экономит полчаса поиска.\n2. **Подтвердите симптом снаружи.** Команда `curl -sv` показывает, кто отвечает ошибкой 504. Если в ответе стоит заголовок `server: nginx`, значит, имя нашлось, соединение и шифрование до nginx работают, а проблема лежит за ним.\n3. **Назовите уровень по улике.** Например: «Ответ пришёл от nginx, значит, до nginx всё работает, а сбой лежит где-то между nginx и приложением. На каком уровне, покажет журнал ошибок nginx».\n4. **Проверяйте гипотезы уликами, начиная с дешёвых.** Журнал ошибок nginx отличает случай «соединение есть, но ответа нет» от случая «соединиться не удалось», а это разные уровни и разные причины.\n5. **Не уничтожайте улики.** Перезапуск «на всякий случай» стирает журналы прошлых запусков и при этом не убирает причину.\n6. **Сначала верните сервис, потом чините.** Откатите *то изменение, которое вызвало* сбой, будь то выкладка или правило межсетевого экрана, и только потом устраняйте причину обычным путём, через конвейер. Это правило называется [[career.mitigate-first|«сначала вернуть сервис»]].\n7. **Сообщите команде и разберите случившееся.** Короткий статус говорит, кого задел сбой и насколько, что вы делаете и когда будет следующее сообщение. Такое сообщение называют [[career.status-update|статусом для команды]].',
        '1. **Ask.** Everyone or one user, which pages, since when, what changed. Two questions save half an hour.\n2. **Confirm the symptom from outside.** `curl -sv` shows who exactly answers 504. If the answer is signed `server: nginx`, DNS, TCP and TLS up to nginx work and the problem is behind it.\n3. **Name the layer from evidence.** “The answer came from nginx, so everything up to nginx works and the failure is somewhere between nginx and the application. The nginx error log will show which layer.”\n4. **Hypotheses and evidence, cheap ones first.** The nginx error log tells “connected but waited for an answer” from “could not connect” — different layers, different causes.\n5. **Do not destroy evidence.** A restart “just in case” wipes the logs of previous runs and does not remove the cause.\n6. **Restore the service first, then fix.** Roll back *the change that caused* the failure — a release or a firewall rule — and only then remove the cause the normal way, through the pipeline. That is [[career.mitigate-first|mitigate first]].\n7. **Tell the team and review.** A short status: who is affected and how badly, what we are doing, when the next message comes. That is a [[career.status-update|status update]].',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как дежурный ищет причину ошибки 504', 'How the on-call engineer finds the cause of a 504'),
      body: bi(
        'Схема ниже проводит вас через этот метод на одном сбое. Пользователи нажимают в магазине «Оплатить» и получают ошибку 504, а дежурный инженер ищет причину. Сначала на схеме только браузер пользователя и список гипотез дежурного: восемь вещей, которые могли сломаться. Остальные части системы появляются тогда, когда дежурный на них смотрит: в верхнем ряду nginx, межсетевой экран и приложение, под ними DNS, журнал ошибок nginx и база данных.',
        'The diagram below walks you through this method on one failure. Users press “Pay” in the shop and get a 504, and the on-call engineer looks for the cause. At first the diagram shows only the user’s browser and the engineer’s list of hypotheses: eight things that could be broken. The other parts appear when the engineer looks at them: in the top row nginx, the firewall and the application, below them DNS, the nginx error log and the database.',
      ),
    },
    { id: 'symptom', kind: 'explainer', step: 'look', explainer: 'career.symptom', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечена та часть системы, на которую дежурный смотрит сейчас, и облачко рядом с ней говорит, что она показывает. По линии передаётся карточка с самой уликой, то есть с ответом команды `curl -sv` или со строкой журнала. Зелёная рамка означает, что гипотеза об этой части исключена, жёлтая рамка говорит, что здесь что-то подозрительно, а красная показывает, что причина найдена. Счётчик «гипотез осталось» под схемой показывает, как улики сужают поиск.\n\nКогда дойдёте до отката, выберите в группе «Скрытая причина сбоя» другую причину и пройдите поиск ещё раз. Вы увидите, что первые шаги остаются теми же, а меняется строка журнала и то, куда она ведёт. Потом включите в блоке «Сломать» перезапуск до чтения журналов и посмотрите, сколько гипотез после него останется.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. At every step the part the engineer looks at is highlighted, and the callout next to it says what it shows. A card travels along the line with the evidence itself, that is, with the answer of `curl -sv` or a log line. A green outline means the hypothesis about this part is ruled out, a yellow one says something is suspicious here, and a red one shows that the cause is found. The “hypotheses left” counter under the diagram shows how the evidence narrows the search.\n\nOnce you reach the rollback, choose another cause in “The hidden cause” and walk the search again. You will see that the first steps stay the same, while the log line and where it leads change. Then switch on the restart before reading the logs in “Break it” and see how many hypotheses are left after it.'), caption: bi('На собеседовании вы проходите тот же путь словами: «подтверждаю симптом командой `curl -sv`, читаю журнал ошибок nginx, проверяю приложение напрямую, откатываю то, что изменилось». В тренировке ниже вы сделаете эти шаги сами, а песочница покажет, что ответил бы настоящий сервер.', 'At an interview you walk the same path in words: “I confirm the symptom with `curl -sv`, read the nginx error log, check the application directly, roll back what changed.” In the drill below you take these steps yourself, and the sandbox shows what a real server would answer.') },
    {
      id: 'drill-504',
      kind: 'widget',
      step: 'try',
      widget: 'career.drill',
      props: { drill: 'drill.504' },
    },
    {
      id: 'bad-paths',
      kind: 'text',
      step: 'explain',
      title: bi('Плохие пути и чему они учат', 'Bad paths'),
      body: bi(
        'В разборе тренировки плохие пути отмечены отдельно, и каждый из них учит своему:\n\n- **Сразу увеличить `proxy_read_timeout`.** Так проблема только прячется, потому что пользователи ждут минуту вместо того, чтобы быстро получить ошибку, а причина остаётся на месте.\n- **Перезапустить всё, не прочитав журналы.** Многие считают, что перезапуск лечит любую проблему, и на дежурстве первым делом перезапускают службу. Улики при этом пропадают, а если причина в выкладке, в сети или в нехватке ресурсов, проблема возвращается с первой же волной запросов. Перезапуск уместен только тогда, когда вы уже знаете, что и зачем перезапускаете.\n- **Пойти проверять DNS.** Сайт отвечает от имени nginx, а значит, имя уже превратилось в адрес, и гипотеза о DNS противоречит тому, что вы видите.\n- **Откатить выкладку, когда причина в правиле `drop` межсетевого экрана.** В этом случае откатили не то, что изменилось. Поэтому на первом шаге и спрашивают, *что* менялось, ведь изменений бывает несколько.',
        'In the drill review bad paths are marked explicitly, and each teaches something:\n\n- **Raising `proxy_read_timeout` right away.** Hides the problem: users wait a minute instead of getting a quick error, and the cause stays.\n- **Restarting everything before reading the logs.** Many believe a restart cures any problem, and on call they restart the service first. The evidence is gone, and if the cause is a release, the network or a lack of resources, the problem returns with the first wave of requests. A restart is appropriate only when you already know what you are restarting and why.\n- **Going to check DNS.** The site answers from nginx, so the name has already resolved: the hypothesis contradicts the observation.\n- **Rolling back the release when the cause is a firewall `drop` rule.** You rolled back the wrong change. That is why the first step asks *what* changed: there may be more than one change.',
      ),
    },
    { id: 'drill-disk', kind: 'widget', step: 'practice', widget: 'career.drill', props: { drill: 'drill.disk' } },
    { id: 'drill-crash', kind: 'widget', step: 'practice', widget: 'career.drill', props: { drill: 'drill.crashloop' } },
    {
      id: 'status',
      kind: 'callout',
      tone: 'note',
      title: bi('Как написать статус для команды', 'How to write a status'),
      body: bi(
        'Статус состоит из трёх частей, и каждую из них можно проверить. **Влияние**: «у всех пользователей не проходит оплата, около 30 % запросов заканчиваются ошибкой 504, началось в 14:10». **Что мы делаем**: «откатываем версию, выложенную в 14:05, и ждём, когда доля ошибок упадёт». **Когда будет следующий статус**: «в 14:40 или раньше, если доля ошибок не упадёт». Если третьей части нет, команда начнёт засыпать вас вопросами в самый неудобный момент.',
        'Three parts, and each can be checked: **impact** (“checkout for everyone, about 30% of requests return 504, since 14:10”), **what we do** (“rolling back the 14:05 release, waiting for the error share to drop”), **when the next update is** (“at 14:40, or earlier if the error share does not drop”). Without the third part the team will interrupt you with questions at the worst moment.',
      ),
    },
    {
      id: 'exit',
      kind: 'quiz',
      step: 'exit',
      title: bi('Проверьте себя', 'Check yourself'),
      items: ['career.q.method-order', 'career.q.log-line', 'career.q.bad-paths', 'career.q.previous', 'career.q.status'],
    },
  ],
};

export const L_MOCK: Lesson = {
  id: 'career.mock',
  block: 'career',
  title: bi('Учебное интервью', 'The mock interview'),
  summary: bi('Сценарий учебного интервью на 45 минут, рубрика из шести критериев, учебный интервьюер, который работает и без нейросети, и учебные интервью с живыми людьми.', 'A 45-minute script, a six-criteria rubric, a practice interviewer that works with or without an AI, and live mock interviews.'),
  introduces: ['career.mock-interview', 'career.rubric'],
  uses: ['career.answer-structure', 'career.dont-know', 'career.situational'],
  tier: 'core',
  minutes: 45,
  sources: { en: [SRC.star, SRC.lev, SRC.interviewingio], ru: [SRC.levRu, SRC.kts] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Прежде чем идти на настоящие собеседования, стоит пройти три-пять учебных, так называемых [[career.mock-interview|мок-интервью]]. Они избавляют от косноязычия, потому что после них вы начинаете проговаривать вслух то, что понимаете. В этом уроке есть сценарий учебного интервью, рубрика, по которой его разбирают, и учебный интервьюер. Подключать для него нейросеть не обязательно. Без неё интервьюер задаёт заготовленные в курсе вопросы и уточнения, а разбор по рубрике вы делаете сами, сверяясь с эталонным ответом. Если вы подключите в настройках свою нейросеть, она будет задавать уточнения сама и разберёт ответы за вас.',
        'Before real interviews it is worth doing three to five practice ones — [[career.mock-interview|mock interviews]]. They cure tongue-tiedness: what you understand, you also start to say. This lesson gives the script of a practice interview, the rubric it is reviewed with, and a practice interviewer. You do not have to connect an AI for it. Without one, the interview asks the course’s questions and follow-ups, and you do the review on the rubric yourself against the model answer. If you connect your own AI in the settings, it asks the follow-ups itself and reviews the answers for you.',
      ),
    },
    {
      id: 'script',
      kind: 'text',
      step: 'look',
      title: bi('Сценарий учебного интервью на 45 минут', 'A 45-minute script'),
      body: bi(
        '- **Знакомство, 3 минуты.** Интервьюер, в роли которого выступает руководитель платформенной команды, объясняет, как пройдёт разговор.\n- **Самопрезентация, 3 минуты.** Вас просят рассказать о себе.\n- **Технические вопросы, 18 минут.** Пять-семь вопросов только по тем блокам курса, которые вы уже прошли, и к каждому одно-два уточнения: «почему?», «а если…?», «откуда вы это знаете?».\n- **Ситуационный вопрос, 8 минут.** Это одна тренировка в текстовом виде, в которой интервьюер сам сообщает, что показала команда, которую вы назвали.\n- **Поведенческий вопрос, 4 минуты.** Например: «Расскажите о случае, когда вы ошиблись». Отвечать удобно по схеме STAR: ситуация, задача, действие, результат.\n- **Ваши вопросы, 3 минуты.** О процессах в команде, дежурствах, наставничестве. Если вопросов нет, это звучит как отсутствие интереса.\n\nВопросы выбирает курс, а не нейросеть, и поэтому интервью не уходит в темы, которых вы ещё не проходили.',
        '- **Introductions, 3 minutes.** The interviewer — a platform team lead — explains the format.\n- **Self-presentation, 3 minutes.** “Tell me about yourself.”\n- **Technical questions, 18 minutes.** Five to seven questions, only on blocks you have already done; each gets one or two follow-ups: “why?”, “what if…?”, “how do you know?”.\n- **Situational question, 8 minutes.** One drill as text: the interviewer says what the command you named showed.\n- **Behavioural question, 4 minutes.** “Tell me about a time you made a mistake” — answered with STAR: situation, task, action, result.\n- **Your questions, 3 minutes.** About processes, on-call, mentoring. Having no questions sounds like having no interest.\n\nThe course picks the questions, not the AI: that keeps the interview away from topics you have not studied.',
      ),
    },
    {
      id: 'rubric',
      kind: 'text',
      step: 'explain',
      title: bi('Рубрика, по которой оценивают ответы', 'The rubric'),
      body: bi(
        'Каждый ответ оценивается по шести критериям, по каждому ставится балл от 0 до 3, и у каждого балла есть описание. Такой набор критериев называется [[career.rubric|рубрикой]]:\n\n- **Корректность.** 3 балла, если ответ верен и в нём есть все ключевые пункты; 0, если ответ неверен по существу.\n- **Структура.** 3 балла, если в ответе есть все четыре части и они идут в логичном порядке.\n- **Механизм, а не команды.** 3 балла, если механизм объяснён и связан с тем, что из него следует.\n- **Глубина.** 3 балла, если ответ выдержал уточнение и вы сами назвали компромисс или ограничение.\n- **Честность.** 3 балла, если вы признали, что не знаете, и назвали источник, где выяснили бы ответ; 0, если вы ответ выдумали. Ноль по этому критерию проваливает всё интервью.\n- **Коммуникация.** 3 балла, если ответ понятен, краток и содержит пример из практики.\n\nОтметку «готов к живым собеседованиям» курс ставит, когда средний балл не ниже 2 на трёх учебных интервью подряд и ни разу не было нуля по честности. Эта отметка не служит сертификатом, она только показывает, что пора разговаривать с людьми.',
        'Each answer is scored on six criteria from 0 to 3, and every score has a description — that is a [[career.rubric|rubric]]:\n\n- **Correctness**: 3 — right, every key point; 0 — wrong in substance.\n- **Structure**: 3 — all four parts in a logical order.\n- **Mechanism, not commands**: 3 — the mechanism is explained and tied to its consequences.\n- **Depth**: 3 — survived the follow-up and named a trade-off or a limit unprompted.\n- **Honesty**: 3 — admitted not knowing and named the source and the place to find out; 0 — made it up. A zero here fails the whole interview.\n- **Communication**: 3 — clear, brief, with an example from practice.\n\n“Ready for live interviews” means a mean score of at least 2 on three mock interviews in a row and no zero for honesty. It is not a certificate but a signal: time to meet people.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как курс проверяет оценки нейросети, если вы её подключили', 'How the course checks the AI’s grades if you connected one'),
      body: bi(
        'Этот раздел нужен тем, кто подключил свою нейросеть, и тем, кому интересно, как устроена проверка. Если вы проходите интервью без нейросети, баллы ставите вы сами, и схему можно пропустить.\n\nОценки по рубрике ставит ваша нейросеть, а нейросеть может ошибиться или польстить. Поэтому у курса есть правило: балл выше 1 засчитывается только тогда, когда нейросеть подкрепила его цитатой из вашего ответа и эта цитата нашлась в расшифровке. Схема ниже показывает, как работает эта проверка, на одном ответе о контейнерах. Нейросеть возвращает балл и цитату, затем курс приводит цитату и ответ к простым спискам слов, находит в ответе кусок, больше всего похожий на цитату, и решает, засчитать ли балл. Слишком строгий допуск при таком сравнении наказывает за ошибки распознавания речи, а слишком мягкий пропускает выдумку.',
        'This section is for those who connected their own AI and for the curious. If you take the interview without an AI, you set the scores yourself and can skip the diagram.\n\nThe rubric scores come from your AI, and an AI can err or flatter. So the course has a rule: a score above 1 counts only if the AI backed it with a quote from your answer and that quote is found in the transcript. The diagram below shows the check on one answer about containers. The AI returns a score and a quote, then the course turns the quote and the answer into plain word lists, finds the stretch of the answer closest to the quote and decides whether to count the score. Too strict a tolerance in this comparison punishes recognition slips, and too loose a tolerance lets inventions through.',
      ),
    },
    { id: 'quote', kind: 'explainer', step: 'look', explainer: 'career.quote', howto: bi('Сначала на схеме видны только ваш ответ, рубрика и нейросеть-оценщик. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Облачко у подсвеченного блока говорит, что этот блок делает, а под схемой видны три числа: насколько цитата отличается от ответа, какой допуск разрешён и какой балл засчитан.\n\nПосле первого прохода выберите в группе «Что вернула нейросеть» пересказ или похвалу, которой в ответе не было, а потом подвигайте допуск в группе «Как строго проверяет курс» и посмотрите, когда балл перестаёт засчитываться.', 'At first the diagram shows three blocks: your answer, the rubric and the AI grader. Press “Start from the first step”, then go on with “Step forward” above the diagram. The callout at the highlighted block says what that block does, and under the diagram you see three numbers: how far the quote is from the answer, what tolerance is allowed and what score is counted.\n\nAfter the first pass choose, in “What the AI returned”, a paraphrase or praise that was never in the answer, then move the tolerance in “How strict the course is” and see when the score stops being counted.'), caption: bi('Когда учебное интервью закончится, вы увидите у каждого балла цитату, на которую он опирается. Если рядом стоит пометка «не подтверждено», найдите в своём ответе место, где вы должны были это сказать, и подумайте, сказали ли вы это на самом деле.', 'When a mock interview ends, every score shows the quote it rests on. If one is marked “not confirmed”, find the place in your answer where you should have said it and check whether you really did.') },
    { id: 'mock', kind: 'widget', step: 'practice', widget: 'career.mock' },
    {
      id: 'people',
      kind: 'text',
      step: 'explain',
      title: bi('Учебные интервью с живыми людьми', 'Live mock interviews'),
      body: bi(
        'Нейросеть хороша для повторения, но волнение перед живым человеком снимает только разговор с живым человеком. После второго учебного интервью с нейросетью найдите того, кто проведёт с вами настоящее: знакомого инженера, бывшего коллегу из IT, наставника с платформы наставничества или участника местного профессионального сообщества. Попросите коротко и конкретно: «Проведи со мной 40 минут технического интервью на позицию junior DevOps. Вот список тем и вот рубрика, поставь мне баллы». Рубрика из этого урока помещается на одной странице, и её удобно распечатать.\n\nТаких людей ищут в нескольких местах: на встречах DevOps- и Kubernetes-сообществ в вашем городе, в профессиональных чатах и форумах вокруг инструментов, которыми вы пользуетесь в курсе, среди бывших однокурсников и коллег, которые уже работают в IT, и на платформах наставничества, где опытные инженеры соглашаются на разовую встречу. Там же можно попросить разбор пет-проекта: «Посмотри, пожалуйста, README моего проекта и скажи, о чём ты спросил бы меня на собеседовании». Учиться одному тяжелее, чем вместе с кем-то, поэтому даже один знакомый, который проходит тот же путь, заметно помогает дойти до конца.\n\nПолезно посмотреть на интервью и со стороны. Для этого найдите запись чужого учебного интервью и сами поставьте баллы по рубрике. Оценивая чужие ответы, вы быстро начинаете слышать, как звучат хорошие.',
        'An AI is good for repetition, but only a live person cures the fear of a live person. After your second practice interview with the AI, find someone to run a real one: an engineer you know, a former colleague from IT, a mentor on a mentoring platform, a member of a local community. Ask briefly and concretely: “Could you give me a 40-minute technical interview for a junior DevOps role? Here is the list of topics, here is the rubric, please score me.” The rubric from this lesson prints on one page.\n\nSuch people are found in several places: at DevOps and Kubernetes community meetups in your city, in professional chats and forums around the tools you use in the course, among former classmates and colleagues already working in IT, and on mentoring platforms where experienced engineers agree to a one-off meeting. There you can also ask for a review of a pet project: “Could you look at the README of my project and tell me what you would ask me about it at an interview?” Learning alone is harder than learning with someone, so even one acquaintance walking the same path helps noticeably to get to the end.\n\nA useful exercise from the other side: watch a recording of someone else’s practice interview and score it yourself with the rubric. Scoring other people’s answers is a fast way to hear what good ones sound like.',
      ),
    },
    {
      id: 'exit',
      kind: 'quiz',
      step: 'exit',
      title: bi('Проверьте себя', 'Check yourself'),
      items: ['career.q.unconfirmed', 'career.q.honesty-zero', 'career.q.star'],
    },
  ],
};
