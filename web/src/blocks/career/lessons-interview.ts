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
  title: bi('Как устроено собеседование джуна', 'How a junior interview works'),
  summary: bi('Этапы, что на каждом проверяют и главное правило ответа.', 'The stages, what each of them checks, and the main rule of an answer.'),
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
        'Собеседование — такое же умение, как чтение журнала или сборка образа: у него есть устройство, типичные ошибки и способы тренироваться. Этот блок идёт параллельно техническим с первого месяца курса, а не в самом конце: к моменту первого отклика ты уже будешь уметь объяснять то, что знаешь.\n\nНачнём с того, как собеседование устроено и что на каждом этапе на самом деле проверяют.',
        'An interview is a skill like reading a log or building an image: it has a structure, typical mistakes and ways to practise. This block runs alongside the technical ones from the first month of the course, not at the very end: by the time you send your first application you will already be able to explain what you know.\n\nLet us start with how an interview is built and what each stage really checks.',
      ),
    },
    {
      id: 'stages',
      kind: 'text',
      step: 'look',
      title: bi('Четыре этапа', 'Four stages'),
      body: bi(
        '### Скрининг\n15–30 минут с рекрутером: мотивация, ожидания, формат работы. Здесь проверяют, понимаешь ли ты, куда идёшь, и можешь ли коротко рассказать о себе.\n\n### Техническое интервью\n60–90 минут с инженером: теория по Linux, сетям, контейнерам, Kubernetes, CI/CD, IaC и мониторингу; вопросы «что происходит, когда…»; один ситуационный вопрос вроде «сайт отдаёт 504 — что делаешь?».\n\n### Практика\nНе всегда. Бывает небольшое задание на дом — Dockerfile и compose для приложения, простой конвейер, плейбук. Всё чаще вместо теории дают живую песочницу: чистый кластер, задача выложить сервис, документацию и поиск открывать можно, экран общий. Уровень определяется тем, докуда ты дошёл.\n\n### Финал\nС руководителем: команда, процессы, дежурства, мотивация. Здесь ценят вопросы, которые задаёшь ты сам.',
        '### Screening\n15–30 minutes with a recruiter: motivation, expectations, the way of working. They check whether you understand where you are going and can talk about yourself briefly.\n\n### Technical interview\n60–90 minutes with an engineer: theory on Linux, networks, containers, Kubernetes, CI/CD, IaC and monitoring; “what happens when…” questions; one situational question such as “the site returns 504 — what do you do?”.\n\n### Practice\nNot always. Sometimes a small take-home task: a Dockerfile and compose for an application, a simple pipeline, a playbook. More and more often a live sandbox replaces theory: a clean cluster, a task to deploy a service, documentation and search allowed, a shared screen. Your level is how far you get.\n\n### Final round\nWith the manager: the team, the processes, on-call, motivation. Your own questions are valued here.',
      ),
    },
    {
      id: 'checks',
      kind: 'text',
      step: 'explain',
      title: bi('Что проверяют на самом деле', 'What is really checked'),
      body: bi(
        'Вопросы разные, но нанимающий инженер ищет пять вещей:\n\n1. **Понимаешь ли ты механизм**, а не помнишь ли команды. «Что происходит, когда вводишь адрес в браузере» — это вопрос о цепочке DNS → TCP → TLS → HTTP, а не о названии команды.\n2. **Умеешь ли действовать в незнакомой поломке**: идёшь ли от симптома к причине, собираешь ли улики до изменений.\n3. **Можешь ли объяснить сделанное**: свой пет-проект, своё решение, свою ошибку.\n4. **Найдёшь ли ответ сам**, когда тебя этому не учили, — в man, `--help`, `kubectl explain`, официальной документации.\n5. **Честен ли ты о границах своих знаний**: «не знаю, но выяснял бы так» ценится выше уверенной выдумки.\n\nКурс тренирует каждую из пяти отдельно: понятия — квизы и повторение, поломки — тренажёры и экзамены, объяснение — вопросы «объясни» и мок-интервью, документацию — лестница документации, честность — отметка уверенности перед каждым ответом.',
        'The questions differ, but a hiring engineer looks for five things:\n\n1. **Do you understand the mechanism**, rather than remember commands. “What happens when you type an address into a browser” is a question about the chain DNS → TCP → TLS → HTTP, not about the name of a command.\n2. **Can you act in an unfamiliar failure**: do you go from symptom to cause, do you collect evidence before changing things.\n3. **Can you explain what you did**: your pet project, your decision, your mistake.\n4. **Will you find the answer yourself** when nobody taught you — in man, `--help`, `kubectl explain`, the official documentation.\n5. **Are you honest about the limits of your knowledge**: “I don’t know, but I would find out like this” is worth more than a confident invention.\n\nThe course trains each of the five separately: concepts with quizzes and review, failures with trainers and exams, explaining with “explain” questions and mock interviews, documentation with the documentation ladder, honesty with the confidence mark before every answer.',
      ),
    },
    {
      id: 'rule',
      kind: 'callout',
      tone: 'why',
      step: 'explain',
      title: bi('Главное правило: логика, а не команды', 'The main rule: logic, not commands'),
      body: bi(
        'На вопрос «как проверить DNS?» ответ «`nslookup host`» звучит уверенно и не говорит ничего: интервьюер не узнал, понимаешь ли ты, что такое резолвер, кэш и TTL. Объясни механизм, а команду назови как способ его увидеть: «DNS превращает имя в адрес; клиент спрашивает резолвер, тот идёт от корня к серверу зоны и кэширует ответ на время TTL; проверяю `dig` — сначала через резолвер, потом напрямую у авторитативного сервера». Это и есть [[career.logic]].',
        'To “how do you check DNS?” the answer “`nslookup host`” sounds confident and says nothing: the interviewer did not learn whether you understand what a resolver, a cache and a TTL are. Explain the mechanism and name the command as a way to see it: “DNS turns a name into an address; the client asks the resolver, which walks from the root to the zone server and caches the answer for the TTL; I check with `dig`, first through the resolver, then directly at the authoritative server.” That is [[career.logic]].',
      ),
    },
    {
      id: 'ai',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Нейросети изменили собеседования не так, как кажется. Компании не столько запрещают помощников, сколько меняют вопросы: после любого ответа будут уточнения «почему», «а если…», «откуда ты это знаешь?». Зачитанный ответ на них рассыпается, понятый механизм — нет. Поэтому мок-интервью этого блока задаёт уточнения всегда.',
        'AI changed interviews, but not in the way it seems. Companies do not so much ban assistants as change the questions: every answer is followed by “why?”, “what if…?”, “how do you know?”. A recited answer falls apart under them; an understood mechanism does not. That is why the mock interviews of this block always ask follow-ups.',
      ),
    },
    {
      id: 'lvl-b',
      kind: 'callout',
      tone: 'note',
      levels: ['beginner'],
      title: bi('Если ты ещё не проходил собеседований в IT', 'If you have never had an IT interview'),
      body: bi('Главные риски — страх, сбивчивость в технике и отсутствие историй из практики. Блок усиливает для тебя самопрезентацию, перевод прежнего опыта и тренировку вслух; до реальных собеседований пройди не меньше пяти мок-интервью.', 'The main risks are fear, stumbling over technical words and having no stories from practice. The block puts extra weight for you on self-presentation, translating earlier experience and practising aloud; do at least five mock interviews before real ones.'),
    },
    {
      id: 'lvl-i',
      kind: 'callout',
      tone: 'note',
      levels: ['intermediate'],
      title: bi('Если ты из поддержки, тестирования или аналитики', 'If you come from support, QA or analytics'),
      body: bi('Ты часто описываешь опыт словами процесса («закрывал тикеты»), а не системы («находил по журналам, на каком сервисе обрывается запрос»), и недооцениваешь свой опыт инцидентов. Переводи его — это сильная сторона.', 'You tend to describe experience in process words (“closed tickets”) rather than system words (“found in the logs which service the request died at”) and undervalue your incident experience. Translate it: it is a strength.'),
    },
    {
      id: 'lvl-e',
      kind: 'callout',
      tone: 'warn',
      levels: ['experienced'],
      title: bi('Если ты программист или админ', 'If you are a developer or an admin'),
      body: bi('Риск — снисходительность к «простым» вопросам и ответы командами вместо механизма, а ещё неумение сказать «не знаю». На простой вопрос отвечай так же полно, как на сложный: интервьюер не знает, что ты знаешь, пока ты не сказал.', 'The risk is condescension towards “simple” questions, answering with commands instead of mechanisms, and not being able to say “I don’t know”. Answer a simple question as fully as a hard one: the interviewer does not know what you know until you say it.'),
    },
    {
      id: 'exit',
      kind: 'quiz',
      step: 'exit',
      title: bi('Проверь себя', 'Check yourself'),
      items: ['career.q.stages', 'career.q.logic', 'career.q.five'],
    },
  ],
};

export const L_ANSWER: Lesson = {
  id: 'career.answer',
  block: 'career',
  title: bi('Ответ по схеме: что → зачем → как → когда', 'An answer in four parts: what → why → how → when'),
  summary: bi('Переводчик «команда → логика» и честное «не знаю».', 'The command → logic translator and an honest “I don’t know”.'),
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
        'Возьмём ответ из прошлого урока — «`nslookup host`» — и посмотрим, чего в нём не хватает. Не хватает четырёх вещей, и у каждой есть своё место: **что это**, **зачем оно нужно**, **как работает** и **когда ты этим пользуешься**. Это и есть [[career.answer-structure]].',
        'Take the answer from the last lesson, “`nslookup host`”, and see what is missing. Four things are missing, and each has its place: **what it is**, **why it exists**, **how it works** and **when you use it**. That is the [[career.answer-structure]].',
      ),
    },
    {
      id: 'parts',
      kind: 'text',
      step: 'explain',
      title: bi('Четыре части на примере DNS', 'The four parts, with DNS as the example'),
      body: bi(
        '**Что.** DNS превращает имя вроде shop.example в адрес и другие записи.\n\n**Зачем.** Люди и конфигурации пользуются именами, а адреса меняются: имя остаётся, а запись обновляют в одном месте.\n\n**Как.** Клиент спрашивает резолвер из `/etc/resolv.conf`. Если ответа нет в кэше, резолвер идёт от корневых серверов к серверу зоны первого уровня, затем к авторитативному серверу зоны и кэширует ответ на время TTL.\n\n**Когда.** Сначала спрашиваю резолвер — `dig shop.example`; если ответ странный, спрашиваю авторитативный сервер напрямую и так отделяю проблему кэша от проблемы самой записи.\n\nКоманда никуда не делась — она стоит в последней части, как способ увидеть механизм. Хорошее правило проверки: команды занимают меньше трети ответа.',
        '**What.** DNS turns a name such as shop.example into an address and other records.\n\n**Why.** People and configs use names while addresses change: the name stays and the record is updated in one place.\n\n**How.** The client asks the resolver from `/etc/resolv.conf`. If the answer is not cached, the resolver walks from the root servers to the top-level zone server, then to the zone’s authoritative server, and caches the answer for its TTL.\n\n**When.** First I ask the resolver, `dig shop.example`; if the answer looks wrong I ask the authoritative server directly, which separates a caching problem from a problem with the record itself.\n\nThe command has not gone anywhere: it sits in the last part, as a way to see the mechanism. A good self-check: commands take less than a third of the answer.',
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
      title: bi('Когда не знаешь', 'When you don’t know'),
      body: bi(
        'На любом собеседовании будет вопрос, на который у тебя нет ответа. Выдуманный ответ — худший исход: опытный интервьюер услышит его сразу, и под сомнением окажется всё сказанное до него. Хороший ответ состоит из трёх шагов:\n\n1. **Честно признать**: «С Consul я не работал».\n2. **Связать с тем, что знаешь**: «Судя по задаче, это обнаружение сервисов — в Kubernetes её решает DNS кластера и объекты Service».\n3. **Сказать, как выяснил бы, и назвать конкретный источник**: «Открыл бы документацию Consul, раздел про обнаружение сервисов, и проверил бы в песочнице, что вернёт DNS-запрос к нему».\n\nЭто [[career.dont-know]]. Конкретность источника важна: «погуглю» ничего не говорит, а «`man ss`, раздел FILTER» показывает, что ты умеешь искать.',
        'Every interview has a question you cannot answer. An invented answer is the worst outcome: an experienced interviewer hears it at once, and everything said before is now in doubt. A good answer has three steps:\n\n1. **Admit it honestly**: “I haven’t worked with Consul.”\n2. **Link it to what you know**: “From the task it sounds like service discovery: in Kubernetes cluster DNS and Service objects solve that.”\n3. **Say how you would find out and name a concrete source**: “I would open the Consul documentation, the service discovery section, and check in a sandbox what a DNS query to it returns.”\n\nThat is [[career.dont-know]]. A concrete source matters: “I’ll google it” says nothing, while “`man ss`, the FILTER section” shows you know how to look.',
      ),
    },
    {
      id: 'calibration',
      kind: 'callout',
      tone: 'note',
      body: bi(
        'Отметка уверенности, которую курс просит перед каждым ответом, тренирует именно это. Раз в неделю на экране повторения видно, как часто ты был прав, когда говорил «знаю». Кто знает свою точность, тот спокойно говорит «не знаю» там, где это правда.',
        'The confidence mark the course asks for before every answer trains exactly this. Once a week the review screen shows how often you were right when you said “I know”. If you know your own accuracy, you can calmly say “I don’t know” where it is true.',
      ),
    },
    {
      id: 'exit',
      kind: 'quiz',
      step: 'exit',
      title: bi('Проверь себя', 'Check yourself'),
      items: ['career.q.order-parts', 'career.q.dont-know', 'career.q.mechanism'],
    },
  ],
};

export const L_CLASSICS: Lesson = {
  id: 'career.classics',
  block: 'career',
  title: bi('Два вопроса, которые путают все', 'Two questions everybody mixes up'),
  summary: bi('Контейнер и виртуальная машина; интеграция, доставка и развёртывание.', 'Container vs virtual machine; integration, delivery and deployment.'),
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
        'Есть два вопроса, которые задают почти на каждом собеседовании джуна и на которые почти все отвечают одинаково плохо: «чем контейнер отличается от виртуальной машины» и «чем CI отличается от CD». Плохо — потому что отвечают сравнением («контейнер легче») вместо механизма. Разберём оба по схеме из прошлого урока.',
        'Two questions come up at nearly every junior interview, and nearly everyone answers them equally badly: “how is a container different from a virtual machine?” and “how is CI different from CD?”. Badly, because people answer with a comparison (“a container is lighter”) instead of a mechanism. Let us go through both with the four parts from the last lesson.',
      ),
    },
    {
      id: 'vm',
      kind: 'text',
      step: 'explain',
      title: bi('Контейнер и виртуальная машина', 'Container and virtual machine'),
      body: bi(
        'Виртуальная машина эмулирует компьютер: у неё своё ядро операционной системы поверх гипервизора. Поэтому она тяжелее и стартует дольше, зато изоляция сильнее и внутри можно запустить другую ОС.\n\nКонтейнер — обычный процесс хоста, которому ядро показывает собственный вид системы через **пространства имён** (свои процессы, сеть, файловая система, имя хоста) и ограничивает ресурсы через **cgroups**. Ядро общее, поэтому контейнер лёгкий и стартует за доли секунды, но запустить в нём ядро другой ОС нельзя, а уязвимость ядра задевает все контейнеры хоста.\n\nГлавное, что отличает сильный ответ, — последняя часть: **они не исключают друг друга**. В облаке контейнеры почти всегда работают внутри виртуальных машин; Kubernetes ставят и на голое железо; а через KubeVirt виртуальные машины запускают внутри Kubernetes — так устроены, например, открытые облачные платформы на его основе. ВМ выбирают, когда нужна сильная изоляция или другая ОС, контейнер — чтобы упаковать и запускать приложения.\n\nПять ключевых пунктов, которые интервьюер ждёт: своё ядро против общего; пространства имён; cgroups; следствия для скорости, плотности и изоляции; вложенность. Это [[career.q-vm-container]].',
        'A virtual machine emulates a computer: it has its own operating system kernel on top of a hypervisor. So it is heavier and slower to start, but it isolates more strongly and can run another OS inside.\n\nA container is an ordinary process of the host to which the kernel shows its own view of the system through **namespaces** (its own processes, network, file system, host name) and whose resources it limits through **cgroups**. The kernel is shared, so a container is light and starts in a fraction of a second, but it cannot run the kernel of another OS, and a kernel vulnerability affects every container on the host.\n\nWhat sets a strong answer apart is the last part: **they are not either-or**. In the cloud, containers nearly always run inside virtual machines; Kubernetes is also installed on bare metal; and with KubeVirt virtual machines run inside Kubernetes — open cloud platforms built on it work like that. A VM is chosen for strong isolation or another OS, a container to package and run applications.\n\nThe five key points the interviewer waits for: own kernel versus shared; namespaces; cgroups; the consequences for speed, density and isolation; nesting. This is [[career.q-vm-container]].',
      ),
    },
    {
      id: 'ci',
      kind: 'text',
      step: 'explain',
      title: bi('Интеграция, доставка, развёртывание', 'Integration, delivery, deployment'),
      body: bi(
        '**Непрерывная интеграция** — разработчики часто сливают изменения в общую ветку, и каждое слияние автоматически собирается и проверяется тестами, чтобы ошибки интеграции находились за минуты, а не за недели.\n\n**Непрерывная доставка** — следующий шаг: каждое изменение, прошедшее конвейер, готово к выкладке в прод в любой момент, но выкладку запускает человек.\n\n**Непрерывное развёртывание** — выкладка в прод тоже автоматическая, без ручного шага. Это требует хорошего покрытия тестами, мониторинга и быстрого отката.\n\nДве буквы CD означают разное, и интервьюер проверяет, знаешь ли ты, где проходит граница: **есть ли ручной шаг перед продом**. Это [[career.q-ci-cd]].',
        '**Continuous integration**: developers merge changes into a shared branch often, and every merge is automatically built and tested, so integration bugs are found in minutes, not weeks.\n\n**Continuous delivery** is the next step: every change that passed the pipeline can go to production at any moment, but a person starts the release.\n\n**Continuous deployment**: the release to production is automatic too, with no manual step. It needs good test coverage, monitoring and a fast rollback.\n\nThe two letters CD mean different things, and the interviewer checks whether you know where the line is: **whether there is a manual step before production**. This is [[career.q-ci-cd]].',
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
      title: bi('Проверь себя', 'Check yourself'),
      items: ['career.q.cd-match', 'career.q.vm-multi', 'career.q.windows', 'career.q.nesting'],
    },
  ],
};

export const L_SITUATIONAL: Lesson = {
  id: 'career.situational',
  block: 'career',
  title: bi('Ситуационный вопрос: от симптома к причине', 'The situational question: from symptom to cause'),
  summary: bi('«504 — что делаешь?»: метод, плохие пути и статус команде. Три дрилла в песочнице.', '“504 — what do you do?”: the method, the bad paths and the status to the team. Three sandbox drills.'),
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
        '«Сайт отдаёт 504 — что будешь делать?» Правильного ответа-команды тут нет, и интервьюер его не ждёт. Он проверяет **метод**: идёшь ли ты от симптома к причине по уровням, выдвигаешь ли гипотезы и проверяешь ли их уликами, не ломаешь ли улики раньше времени, думаешь ли о пользователях. Это [[career.situational]].',
        '“The site returns 504 — what will you do?” There is no right command here, and the interviewer does not expect one. They check the **method**: do you go from symptom to cause layer by layer, do you form hypotheses and test them with evidence, do you avoid destroying evidence too early, do you think about the users. That is a [[career.situational]].',
      ),
    },
    {
      id: 'method',
      kind: 'text',
      step: 'explain',
      title: bi('Метод в семь шагов', 'The method in seven steps'),
      body: bi(
        '1. **Уточнить.** У всех или у одного, на каких страницах, с какого момента, что менялось. Два вопроса экономят полчаса.\n2. **Подтвердить симптом снаружи.** `curl -sv` показывает, кто именно отвечает 504. Если ответ подписан `server: nginx`, значит DNS, TCP и TLS до nginx работают, а проблема — за ним.\n3. **Назвать уровень по улике.** «Ответ пришёл от прокси — L7; nginx не дождался приложения».\n4. **Гипотезы и улики, от дешёвых к дорогим.** Журнал ошибок nginx различает «соединились, но ждали ответа» и «не смогли соединиться» — это разные уровни и разные причины.\n5. **Не уничтожать улики.** Перезапуск «на всякий случай» стирает журналы прошлых запусков и не убирает причину.\n6. **Сначала вернуть сервис, потом чинить.** Откатить *то изменение, которое вызвало* сбой — выкладку или правило межсетевого экрана, — и только потом устранять причину обычным путём, через конвейер. Это [[career.mitigate-first]].\n7. **Сообщить команде и разобрать.** Короткий статус: кто страдает и насколько, что делаем, когда следующее сообщение. Это [[career.status-update]].',
        '1. **Ask.** Everyone or one user, which pages, since when, what changed. Two questions save half an hour.\n2. **Confirm the symptom from outside.** `curl -sv` shows who exactly answers 504. If the answer is signed `server: nginx`, DNS, TCP and TLS up to nginx work and the problem is behind it.\n3. **Name the layer from evidence.** “The answer came from the proxy — L7; nginx did not hear back from the application.”\n4. **Hypotheses and evidence, cheap ones first.** The nginx error log tells “connected but waited for an answer” from “could not connect” — different layers, different causes.\n5. **Do not destroy evidence.** A restart “just in case” wipes the logs of previous runs and does not remove the cause.\n6. **Restore the service first, then fix.** Roll back *the change that caused* the failure — a release or a firewall rule — and only then remove the cause the normal way, through the pipeline. That is [[career.mitigate-first]].\n7. **Tell the team and review.** A short status: who is affected and how badly, what we are doing, when the next message comes. That is a [[career.status-update]].',
      ),
    },
    { id: 'symptom', kind: 'explainer', step: 'look', explainer: 'career.symptom', caption: bi('Метод одинаков для всех вариантов причины: меняется только скрытая причина.', 'The method is the same for every hidden cause: only the cause changes.') },
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
      title: bi('Плохие пути', 'Bad paths'),
      body: bi(
        'В разборе дрилла плохие пути отмечаются явно, и каждый учит своему:\n\n- **Сразу поднять `proxy_read_timeout`.** Прячет проблему: пользователи ждут минуту вместо быстрой ошибки, а причина остаётся.\n- **Перезапустить всё до чтения журналов.** Улики потеряны, проблема вернётся с первой волной запросов.\n- **Пойти проверять DNS.** Сайт отвечает от nginx, значит, имя уже разрешилось: гипотеза противоречит наблюдению.\n- **Откатить выкладку, когда причина — правило `drop`.** Откатили не то, что изменилось. Поэтому на первом шаге спрашивают, *что* менялось: изменений бывает несколько.',
        'In the drill review bad paths are marked explicitly, and each teaches something:\n\n- **Raising `proxy_read_timeout` right away.** Hides the problem: users wait a minute instead of getting a quick error, and the cause stays.\n- **Restarting everything before reading the logs.** The evidence is gone, and the problem returns with the first wave of requests.\n- **Going to check DNS.** The site answers from nginx, so the name has already resolved: the hypothesis contradicts the observation.\n- **Rolling back the release when the cause is a `drop` rule.** You rolled back the wrong change. That is why the first step asks *what* changed: there may be more than one change.',
      ),
    },
    { id: 'drill-disk', kind: 'widget', step: 'practice', widget: 'career.drill', props: { drill: 'drill.disk' } },
    { id: 'drill-crash', kind: 'widget', step: 'practice', widget: 'career.drill', props: { drill: 'drill.crashloop' } },
    {
      id: 'status',
      kind: 'callout',
      tone: 'note',
      title: bi('Как написать статус', 'How to write a status'),
      body: bi(
        'Три части, и каждую можно проверить: **влияние** («оплата у всех, около 30% запросов отдают 504, с 14:10»), **что делаем** («откатываем релиз 14:05, ждём падения доли ошибок»), **когда следующий статус** («в 14:40 или раньше, если доля ошибок не упадёт»). Без третьей части команда будет дёргать тебя вопросами в самый неудобный момент.',
        'Three parts, and each can be checked: **impact** (“checkout for everyone, about 30% of requests return 504, since 14:10”), **what we do** (“rolling back the 14:05 release, waiting for the error share to drop”), **when the next update is** (“at 14:40, or earlier if the error share does not drop”). Without the third part the team will interrupt you with questions at the worst moment.',
      ),
    },
    {
      id: 'exit',
      kind: 'quiz',
      step: 'exit',
      title: bi('Проверь себя', 'Check yourself'),
      items: ['career.q.method-order', 'career.q.log-line', 'career.q.bad-paths', 'career.q.previous', 'career.q.status'],
    },
  ],
};

export const L_MOCK: Lesson = {
  id: 'career.mock',
  block: 'career',
  title: bi('Мок-интервью', 'The mock interview'),
  summary: bi('Сценарий на 45 минут, рубрика из шести критериев, интервьюер на твоей нейросети и живые мок-интервью.', 'A 45-minute script, a six-criteria rubric, an interviewer on your own AI, and live mock interviews.'),
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
        'До реальных собеседований стоит пройти три-пять учебных — [[career.mock-interview|мок-интервью]]. Они снимают косноязычие: то, что ты понимаешь, ты начинаешь ещё и говорить. В этом уроке — сценарий учебного интервью, рубрика, по которой его разбирают, и интервьюер, который работает на твоей нейросети.',
        'Before real interviews it is worth doing three to five practice ones — [[career.mock-interview|mock interviews]]. They cure tongue-tiedness: what you understand, you also start to say. This lesson gives the script of a practice interview, the rubric it is reviewed with, and an interviewer that runs on your own AI.',
      ),
    },
    {
      id: 'script',
      kind: 'text',
      step: 'look',
      title: bi('Сценарий на 45 минут', 'A 45-minute script'),
      body: bi(
        '- **Знакомство, 3 минуты.** Интервьюер — тимлид команды платформы — объясняет формат.\n- **Самопрезентация, 3 минуты.** «Расскажите о себе».\n- **Технические вопросы, 18 минут.** Пять-семь вопросов только по тем блокам, которые ты уже прошёл; на каждый — одно-два уточнения: «почему», «а если…», «откуда ты это знаешь?».\n- **Ситуационный вопрос, 8 минут.** Один дрилл текстом: интервьюер сам говорит, что «показала команда».\n- **Поведенческий вопрос, 4 минуты.** «Расскажите о случае, когда вы ошиблись» — ответ по схеме STAR: ситуация, задача, действие, результат.\n- **Твои вопросы, 3 минуты.** О процессах, дежурствах, наставничестве. Отсутствие вопросов звучит как отсутствие интереса.\n\nВопросы выбирает курс, а не нейросеть: так интервью не уходит в темы, которых ты не проходил.',
        '- **Introductions, 3 minutes.** The interviewer — a platform team lead — explains the format.\n- **Self-presentation, 3 minutes.** “Tell me about yourself.”\n- **Technical questions, 18 minutes.** Five to seven questions, only on blocks you have already done; each gets one or two follow-ups: “why?”, “what if…?”, “how do you know?”.\n- **Situational question, 8 minutes.** One drill as text: the interviewer says what “the command showed”.\n- **Behavioural question, 4 minutes.** “Tell me about a time you made a mistake” — answered with STAR: situation, task, action, result.\n- **Your questions, 3 minutes.** About processes, on-call, mentoring. Having no questions sounds like having no interest.\n\nThe course picks the questions, not the AI: that keeps the interview away from topics you have not studied.',
      ),
    },
    {
      id: 'rubric',
      kind: 'text',
      step: 'explain',
      title: bi('Рубрика', 'The rubric'),
      body: bi(
        'Каждый ответ оценивается по шести критериям от 0 до 3, и у каждого балла есть описание — это [[career.rubric]]:\n\n- **Корректность**: 3 — верно, все ключевые пункты; 0 — неверно по сути.\n- **Структура**: 3 — все четыре части в логичном порядке.\n- **Механизм, а не команды**: 3 — механизм объяснён и связан с последствиями.\n- **Глубина**: 3 — выдержал уточнение и сам назвал компромисс или ограничение.\n- **Честность**: 3 — признал незнание и назвал источник и место, где выяснил бы; 0 — выдумал. Ноль здесь проваливает интервью целиком.\n- **Коммуникация**: 3 — понятно, кратко, с примером из практики.\n\n«Готов к живым собеседованиям» — средний балл не ниже 2 на трёх мок-интервью подряд и ни одного нуля по честности. Это не сертификат, а сигнал: пора к людям.',
        'Each answer is scored on six criteria from 0 to 3, and every score has a description — that is a [[career.rubric]]:\n\n- **Correctness**: 3 — right, every key point; 0 — wrong in substance.\n- **Structure**: 3 — all four parts in a logical order.\n- **Mechanism, not commands**: 3 — the mechanism is explained and tied to its consequences.\n- **Depth**: 3 — survived the follow-up and named a trade-off or a limit unprompted.\n- **Honesty**: 3 — admitted not knowing and named the source and the place to find out; 0 — made it up. A zero here fails the whole interview.\n- **Communication**: 3 — clear, brief, with an example from practice.\n\n“Ready for live interviews” means a mean score of at least 2 on three mock interviews in a row and no zero for honesty. It is not a certificate but a signal: time to meet people.',
      ),
    },
    { id: 'quote', kind: 'explainer', step: 'look', explainer: 'career.quote', caption: bi('Балл выше 1 засчитывается, только если цитата из твоего ответа нашлась в расшифровке.', 'A score above 1 counts only if its quote from your answer is found in the transcript.') },
    { id: 'mock', kind: 'widget', step: 'practice', widget: 'career.mock' },
    {
      id: 'people',
      kind: 'text',
      step: 'explain',
      title: bi('Живые мок-интервью', 'Live mock interviews'),
      body: bi(
        'Нейросеть хороша для повторения, но страх перед живым человеком снимает только живой человек. После второго учебного интервью с нейросетью найди того, кто проведёт с тобой настоящее: знакомого инженера, бывшего коллегу из IT, наставника с платформы менторства, участника местного сообщества. Попроси коротко и конкретно: «Проведи со мной 40 минут технического интервью на junior DevOps; вот список тем, вот рубрика — поставь баллы». Рубрика из этого урока печатается на одну страницу.\n\nПолезное упражнение со стороны: посмотри запись чужого учебного интервью и поставь баллы по рубрике сам. Оценивать чужие ответы — быстрый способ услышать, как звучат хорошие.',
        'An AI is good for repetition, but only a live person cures the fear of a live person. After your second practice interview with the AI, find someone to run a real one: an engineer you know, a former colleague from IT, a mentor on a mentoring platform, a member of a local community. Ask briefly and concretely: “Could you give me a 40-minute technical interview for a junior DevOps role? Here is the list of topics, here is the rubric, please score me.” The rubric from this lesson prints on one page.\n\nA useful exercise from the other side: watch a recording of someone else’s practice interview and score it yourself with the rubric. Scoring other people’s answers is a fast way to hear what good ones sound like.',
      ),
    },
    {
      id: 'exit',
      kind: 'quiz',
      step: 'exit',
      title: bi('Проверь себя', 'Check yourself'),
      items: ['career.q.unconfirmed', 'career.q.honesty-zero', 'career.q.star'],
    },
  ],
};
