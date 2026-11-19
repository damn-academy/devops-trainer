// Career lessons 6–9: self-presentation and awkward questions, the CV,
// pet projects, the job search strategy.

import { bi } from '../../core/i18n';
import type { Lesson } from '../../core/types';

const SRC = {
  star: { title: 'Situation, task, action, result — Wikipedia', url: 'https://en.wikipedia.org/wiki/Situation,_task,_action,_result' },
  habrCareer: { title: 'Хабр Карьера — профессия DevOps', url: 'https://career.habr.com/professions/devops' },
  kts: { title: 'KTS: как мы перевели собеседования DevOps на тренажёр (Хабр)', url: 'https://habr.com/ru/companies/kts/articles/795277/' },
  jsonresume: { title: 'JSON Resume — schema', url: 'https://jsonresume.org/schema/' },
  pinEn: { title: 'GitHub Docs — Pinning items to your profile', url: 'https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/pinning-items-to-your-profile' },
  pinRu: { title: 'GitHub Docs — Закрепление элементов в профиле', url: 'https://docs.github.com/ru/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/pinning-items-to-your-profile' },
  readmeEn: { title: 'GitHub Docs — About READMEs', url: 'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes' },
  readmeRu: { title: 'GitHub Docs — Сведения о файлах README', url: 'https://docs.github.com/ru/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes' },
  makeReadme: { title: 'Make a README', url: 'https://www.makeareadme.com/' },
  little: { title: 'Little’s law — Wikipedia', url: 'https://en.wikipedia.org/wiki/Little%27s_law' },
  kanbanRu: { title: 'Канбан (разработка) — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%9A%D0%B0%D0%BD%D0%B1%D0%B0%D0%BD_(%D1%80%D0%B0%D0%B7%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D0%BA%D0%B0)' },
  hh: { title: 'hh.ru', url: 'https://hh.ru/' },
  cka: { title: 'Linux Foundation — Certified Kubernetes Administrator', url: 'https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/' },
};


export const L_PITCH: Lesson = {
  id: 'career.pitch',
  block: 'career',
  title: bi('Самопрезентация и неудобные вопросы', 'Self-presentation and awkward questions'),
  summary: bi('Как ответить на просьбу «расскажите о себе» за 60–90 секунд и что говорить в ответ на вопросы, которых кандидаты боятся.', '“Tell me about yourself” in 60–90 seconds, and a deck of the questions people dread.'),
  introduces: ['career.pitch', 'career.awkward'],
  uses: ['career.mock-interview', 'career.rubric'],
  tier: 'core',
  minutes: 35,
  sources: { en: [SRC.star], ru: [SRC.habrCareer, SRC.kts] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Почти любое собеседование начинается с просьбы рассказать о себе. Ответ на неё задаёт тон всему разговору, и при этом его можно подготовить лучше, чем ответ на любой другой вопрос. Такой ответ называют [[career.pitch|самопрезентацией]]. Он длится 60–90 секунд, состоит из пяти частей и не содержит ни одного извинения.',
        'The first question of almost any interview is “tell me about yourself”. The answer sets the tone for the whole conversation, and it can be prepared better than any other. This is a [[career.pitch|self-presentation]]: 60–90 seconds, five parts, not one apology.',
      ),
    },
    {
      id: 'parts',
      kind: 'text',
      step: 'explain',
      title: bi('Пять частей самопрезентации', 'Five parts'),
      body: bi(
        '1. **Кто я и откуда.** Об этом достаточно сказать одной фразой, и извиняться за прошлое не нужно.\n2. **Что я умею и чем это подтверждается.** Назовите сданные экзамены курса и пет-проекты со ссылками.\n3. **Что я сделал своими руками.** Расскажите одну конкретную историю: какая была проблема, что вы сделали и что после этого изменилось.\n4. **Почему DevOps.** Эта часть перекидывает мост от прежнего опыта к новой работе.\n5. **Что я ищу.** Назовите роль и формат работы.\n\nГотовый текст за вас не напишет ни курс, ни нейросеть, потому что заученный чужой текст слышно сразу, и на первом же уточнении он рассыпается. Курс даёт структуру, измеряет ваш рассказ и показывает, что в нём улучшить.',
        '1. **Who I am and where I come from** — one sentence, no apologies for the past.\n2. **What I can do — with proof**: the course exams passed, pet projects with links.\n3. **What I built with my own hands** — one concrete story: the problem, what you did, what changed.\n4. **Why DevOps** — the bridge from your earlier experience to the new job.\n5. **What I am looking for** — the role and the format.\n\nNeither the course nor an AI will write the text for you: a memorised text by someone else is audible, and it falls apart at the first follow-up. The course gives the structure, measures, and shows what to improve.',
      ),
    },
    {
      id: 'samples',
      kind: 'text',
      step: 'look',
      title: bi('Три примера моста от прежней работы', 'Three bridges'),
      body: bi(
        'Сильнее всего самопрезентацию делает четвёртая часть, мост от прежней работы к новой. Вот три типичных примера и объяснение, почему каждый из них работает:\n\n- **Бывший продавец**: «Переговоры с клиентами научили меня выяснять, что человеку на самом деле нужно, а в DevOps это половина работы с разработчиками». Мост работает, потому что называет конкретное умение и место, где оно пригодится.\n- **Специалист поддержки**: «Три года я разбирал инциденты на первой линии, а теперь хочу их предотвращать». Мост работает, потому что прежний опыт становится причиной перехода, а не оправданием.\n- **Программист**: «Мне надоело, что мой код по две недели добирается до рабочих серверов». Мост работает, потому что называет проблему, которую решает DevOps и с которой вы жили сами.\n\nЭто примеры, а не тексты для копирования, потому что ваш мост должен вырасти из вашей собственной истории.',
        'The fourth part — the bridge — makes a self-presentation strongest. Three typical examples and why they work:\n\n- **A former salesperson**: “Negotiating with customers taught me to find out what a person really needs — in DevOps that is half of working with developers.” It works because it names a concrete skill and where it will be useful.\n- **A support specialist**: “For three years I handled incidents on the first line; now I want to prevent them.” It works because the earlier experience becomes a reason, not an excuse.\n- **A developer**: “I got tired of my code taking two weeks to reach production.” It works because it is a problem DevOps solves, and you lived it.\n\nThese are illustrations, not texts to copy: your bridge comes from your own story.',
      ),
    },
    { id: 'trainer', kind: 'widget', step: 'try', widget: 'career.pitch' },
    {
      id: 'awkward',
      kind: 'text',
      step: 'explain',
      title: bi('Неудобные вопросы и честные ответы на них', 'Awkward questions'),
      body: bi(
        'На каждый [[career.awkward|неудобный вопрос]] есть честный ответ, и он работает лучше уклончивого:\n\n- **«Почему вы уходите из продаж?»** Говорите о том, к чему вы идёте, а не о том, от чего уходите, то есть о том, что вас привлекает в технической работе и что вы уже для этого сделали.\n- **«У вас нет опыта, почему мы должны вас взять?»** Опыта работы DevOps-инженером у вас нет, и выдумывать его нельзя. Зато у вас есть то, что можно открыть и проверить: репозитории, сданные практические экзамены, история о том, что сломалось в пет-проекте и как вы это чинили.\n- **«Каковы ваши ожидания по зарплате?»** Заранее посмотрите, сколько платят джунам в вашем городе и формате работы, и назовите диапазон, а не одно число.\n- **«Расскажите о своей ошибке».** Отвечайте по схеме STAR: ситуация, задача, что вы сделали и чем это кончилось, а потом добавьте, что вы изменили после этого. Ошибка без вывода звучит как оправдание, а вывод без ошибки звучит неправдоподобно.\n- **«Что вы будете делать, если не справитесь с задачей?»** Сначала ищу решение сам и заранее ограничиваю время на поиск, а потом прихожу к коллеге и рассказываю, что уже попробовал и где застрял.\n- **«Что в вашем пет-проекте делала нейросеть и как вы это проверяли?»** Скажите как есть, что делала нейросеть, и покажите, как вы проверяли её работу: тестами, линтерами, разбором каждой строки конфигурации и сверкой с документацией. Сгенерированным кодом сегодня никого не удивишь, а понимание этого кода ценят.',
        'Every [[career.awkward|awkward question]] has an honest answer that works better than an evasive one:\n\n- **“Why are you leaving sales?”** Talk about what you are moving towards, not what you are running from: what draws you to engineering and what you have already done about it.\n- **“You have no experience — why should we hire you?”** You really have no experience as a DevOps engineer, and you must not make it up. What you do have can be opened: repositories, passed practical exams, the story of what broke in your pet project and how you fixed it.\n- **“What are your salary expectations?”** Look up junior ranges for your city and work format in advance and name a range, not a single number.\n- **“Tell us about a mistake you made.”** With STAR: situation, task, what you did, the result — and what you changed afterwards. A mistake without a conclusion sounds like an excuse; a conclusion without a mistake sounds untrue.\n- **“What will you do if you cannot cope with a task?”** First I search on my own with a time limit, then I bring a colleague what I already tried and where I got stuck.\n- **“What did AI do in your pet project, and how did you check it?”** Say honestly what the AI did and show the checks: tests, linters, going through every line of configuration, comparing with the documentation. Generated code impresses nobody; understanding does.',
      ),
    },
    {
      id: 'exit',
      kind: 'quiz',
      step: 'exit',
      title: bi('Проверьте себя', 'Check yourself'),
      items: ['career.q.pitch-order', 'career.q.apologies', 'career.q.no-experience'],
    },
  ],
};

export const L_RESUME: Lesson = {
  id: 'career.resume',
  block: 'career',
  title: bi('Резюме на должность DevOps-инженера', 'A CV for DevOps'),
  summary: bi('Как подтвердить каждый навык в резюме, как перевести прежний опыт на язык новой профессии, ничего не выдумав, и как проверить резюме по десяти правилам.', 'How to back every skill on a CV with evidence, how to translate earlier experience into the language of the new profession without inventing anything, and how to check a CV against ten rules.'),
  introduces: ['career.evidence', 'career.bridge'],
  uses: ['career.pitch'],
  tier: 'core',
  minutes: 40,
  sources: { en: [SRC.jsonresume, SRC.pinEn], ru: [SRC.pinRu, SRC.habrCareer, SRC.hh] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Нанимающий менеджер тратит на резюме джуна меньше минуты и за это время выясняет, можно ли проверить то, что написано. Поэтому главное правило резюме джуна требует, чтобы **каждый навык, который вы заявляете, был подтверждён чем-то, что можно открыть**, будь то репозиторий, сданный экзамен или протокол экзамена. Такое подтверждение мы называем [[career.evidence|подтверждением навыка]].',
        'A hiring manager spends less than a minute on a junior CV and looks for one thing: can what is written be checked. So the main rule of a junior CV is simple: **every skill you claim is backed by something one can open** — a repository, a passed exam, a protocol. That is [[career.evidence|skill evidence]].',
      ),
    },
    {
      id: 'rules',
      kind: 'text',
      step: 'explain',
      title: bi('Десять правил резюме', 'Ten rules'),
      body: bi(
        '1. В заголовке стоит роль, на которую вы претендуете («Junior DevOps Engineer»), а не прежняя профессия.\n2. У каждого навыка есть подтверждение. Навык без подтверждения переносится в раздел «Знаком» или удаляется.\n3. В резюме есть ссылка на GitHub или GitLab, где закреплены пет-проекты, и у каждого проекта есть README.\n4. Опыт, не связанный с новой работой, занимает одну строку (должность, компания, годы) или переведён в мост к новой профессии.\n5. Каждый пункт описывает действие и результат («настроил…, и это сократило…»), а не обязанности («отвечал за…»).\n6. В резюме нет пустых формулировок вроде «уверенный пользователь ПК», «стрессоустойчивость» или «быстро обучаюсь».\n7. Резюме помещается на одну страницу.\n8. В английской версии нет фотографии, возраста и семейного положения.\n9. Ключевые слова из вакансии стоят там, где у вас есть подтверждение, и только там.\n10. В резюме нет ничего выдуманного, поэтому опыт работы DevOps-инженером не указан, если его не было, а пет-проект так и называется пет-проектом.\n\nНарушение правил 1–3, 8 и 10 считается ошибкой, и пока такая ошибка есть, резюме не готово. Остальные правила дают предупреждения, и от них можно сознательно отказаться.',
        '1. The headline is the target role (“Junior DevOps Engineer”), not the previous profession.\n2. Every skill has evidence; a skill without it moves to “Familiar with” or is removed.\n3. A GitHub or GitLab link with pinned pet projects, each with a README.\n4. Unrelated experience takes one line (position, company, years) or is translated into a bridge.\n5. Bullets are actions and results (“set up…, which cut…”), not duties (“was responsible for…”).\n6. No empty phrases: “confident PC user”, “stress-resistant”, “fast learner”.\n7. One page.\n8. The English version has no photo, age or marital status.\n9. The vacancy’s keywords appear where you have evidence, and only there.\n10. Nothing made up: no DevOps engineering job unless you held one; a pet project is called a pet project.\n\nBreaking rules 1–3, 8 and 10 is an error: while it is there the CV is not ready. The others are warnings that can be knowingly dismissed.',
      ),
    },
    {
      id: 'bridge',
      kind: 'text',
      step: 'explain',
      title: bi('Как перевести прежний опыт на язык новой профессии', 'Translating earlier experience'),
      body: bi(
        'Для того, кто приходит из другой профессии, самой ценной частью резюме становится [[career.bridge|опыт-мост]], описанный без прикрас. Задача не в том, чтобы переименовать прошлое, а в том, чтобы найти в нём то, что было на самом деле и что ценят в DevOps. Работа с возражениями клиентов превращается в пункт «собирал требования клиентов и переводил их в задачи для технической команды». Отчёты в Excel превращаются в пункт «автоматизировал отчётность и сократил ручную работу с N до M часов в неделю». Первая линия поддержки превращается в пункт «находил причину проблемы по журналам и шагам воспроизведения и передавал её дальше с подробным описанием». Числа N и M должны быть вашими настоящими. Если чисел у вас нет, лучше написать пункт без них, чем с придуманными.',
        'For someone coming from another profession the most valuable part of a CV is an honest [[career.bridge|bridge experience]]. Not “renaming” the past, but finding in it what really happened and what DevOps values. Handling objections becomes “gathered customer requirements and turned them into tasks for the technical team”; Excel reports become “automated reporting and cut manual work from N to M hours a week”; first-line support becomes “located problems from logs and reproduction steps, escalated with a write-up”. N and M are your real numbers; if you have none, better no numbers than invented ones.',
      ),
    },
    { id: 'builder', kind: 'widget', step: 'practice', widget: 'career.resume' },
    {
      id: 'letter',
      kind: 'text',
      step: 'explain',
      title: bi('Сопроводительное письмо', 'The cover letter'),
      body: bi(
        'Сопроводительное письмо состоит из трёх абзацев. В первом вы объясняете, **почему выбрали эту компанию**, и ссылаетесь на что-то конкретное в вакансии или в продукте компании. Во втором рассказываете, **что из нужного им вы уже умеете**, и приводите те же подтверждения, что в резюме. В третьем говорите, **чего вы хотите и чем будете полезны**. Проверить письмо легко. Первый абзац не должен подходить ни к какой другой вакансии, а если он подходит к любой, значит, он ни о чём.',
        'Three paragraphs. **Why this company** — pointing to something concrete in the vacancy or their product. **What I can do of what you need** — with evidence, the same as in the CV. **What I want and how I will be useful.** The test is simple: the first paragraph must not fit any other vacancy. If it does, it says nothing.',
      ),
    },
    {
      id: 'exit',
      kind: 'quiz',
      step: 'exit',
      title: bi('Проверьте себя', 'Check yourself'),
      items: ['career.q.cv-bug', 'career.q.cv-irrelevant', 'career.q.evidence'],
    },
  ],
};

export const L_PETS: Lesson = {
  id: 'career.pets',
  block: 'career',
  title: bi('Пет-проекты', 'Pet projects'),
  summary: bi('Восемь собственных проектов, каждый из которых привязан к блоку курса и имеет критерии приёмки и README.', 'Eight projects tied to the course blocks, with acceptance criteria and a README.'),
  introduces: ['career.pet-project', 'career.readme'],
  uses: ['career.evidence'],
  tier: 'core',
  minutes: 30,
  sources: { en: [SRC.readmeEn, SRC.makeReadme, SRC.pinEn], ru: [SRC.readmeRu, SRC.pinRu] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        '[[career.pet-project|Пет-проект]], то есть ваш собственный учебный проект, служит главным подтверждением навыков в резюме и главной историей на собеседовании. Его делают на настоящей машине: на недорогом виртуальном сервере (VPS), на машине в облаке или в учебном облаке. В пет-проекте вы впервые за курс встретите настоящие сбои, которых не бывает в песочнице, и о них вас будут спрашивать на собеседовании.',
        'A [[career.pet-project|pet project]] is your main evidence on a CV and your main story at an interview. It runs on a real machine: a cheap VPS, a cloud machine or a training cloud. It is the first place in the course where you meet real failures that never happen in a sandbox — and those are what you will be asked about.',
      ),
    },
    {
      id: 'readme',
      kind: 'text',
      step: 'explain',
      title: bi('README по шаблону', 'A README from a template'),
      body: bi(
        'У каждого проекта есть [[career.readme|README]] из шести разделов. Первый объясняет, что это за проект и зачем он нужен, второй показывает схему, третий рассказывает, как запустить проект на чистой машине, четвёртый перечисляет принятые решения и их причины, пятый описывает, **что сломалось по дороге и как вы это чинили**, а шестой говорит, что вы сделали бы дальше. Для собеседования важнее всего раздел о поломках, потому что в нём лежит ваша ситуационная история, и рассказываете вы её уже не на учебном примере, а на своей системе.',
        'Every project has a [[career.readme|README]] with six sections: what it is and why; a diagram; how to run it from a clean machine; decisions and why; **what broke on the way and how you fixed it**; what you would do next. “What broke” matters most for an interview: it is your situational story told about your own system instead of a training example.',
      ),
    },
    {
      id: 'map',
      kind: 'text',
      step: 'look',
      title: bi('Какой проект делать после какого блока', 'Which project after which block'),
      body: bi(
        'Проект открывается, когда пройдены блоки, на материале которых он построен, и каждый следующий проект добавляет один-два новых навыка к тем, что уже проверены. Ниже перечислены все проекты с критериями приёмки. Отмечайте выполненное, и отметки сохранятся. Для разных уровней предлагаются разные пути. Новичку подойдут проекты 1, 3, 4, 6, 7 и итоговый экзамен, ученику среднего уровня — проекты 1, 3, 4, 5, 6 и 7, а опытному — проекты 3, 5, 6, 7, 7б и, по желанию, 8. Проект 3 обязателен для всех, потому что на нём построен итоговый экзамен.',
        'A project opens when the blocks it builds on are done, and each one adds one or two new skills on top of those already checked. Below are all the projects with their acceptance criteria; tick what is done, the ticks are saved. Paths by level: beginner — 1 → 3 → 4 → 6 → 7 and the final exam; intermediate — 1 → 3 → 4 → 5 → 6 → 7; experienced — 3 → 5 → 6 → 7 → 7b and optionally 8. Project 3 is required for everyone: the final exam is built on it.',
      ),
    },
    { id: 'tracker', kind: 'widget', step: 'practice', widget: 'career.checklist', props: { kind: 'pets' } },
    {
      id: 'cost',
      kind: 'callout',
      tone: 'cost',
      title: bi('Сколько это стоит', 'Cost'),
      body: bi('Для проектов 1–4 и 6 хватает одного недорогого виртуального сервера, а для проекта 7б нужны три машины на несколько часов. Прежде чем заказывать машины, посчитайте у своего провайдера, сколько стоят «машины × размер × часы», и отдельно посчитайте, во что обойдутся сутки, если вы забудете машины удалить.', 'A cheap VPS is enough for projects 1–4 and 6; 7b needs three machines for a few hours. Before ordering, work out “machines × size × hours” at your provider, and separately what a day costs if you forget to delete them.'),
    },
    {
      id: 'cleanup',
      kind: 'callout',
      tone: 'cleanup',
      title: bi('Уборка после работы', 'Cleanup'),
      body: bi('Закончив работу, удалите временные машины и проверьте по списку машин у провайдера, что их не осталось. Если вы оставляете одну машину работать, чтобы показать проект работодателю, знайте, сколько она стоит в месяц.', 'After the work, delete the temporary machines and check it with the provider’s machine list. If you leave one machine running for employers, know its monthly price.'),
    },
    {
      id: 'exit',
      kind: 'quiz',
      step: 'exit',
      title: bi('Проверьте себя', 'Check yourself'),
      items: ['career.q.pet-match', 'career.q.measurable', 'career.q.readme-key'],
    },
  ],
};

export const L_SEARCH: Lesson = {
  id: 'career.search',
  block: 'career',
  title: bi('Как искать работу', 'The search strategy'),
  summary: bi('Правило 60 % и анализатор вакансий, воронка откликов как поток, стажировки и короткий разбор после каждого собеседования.', 'The 60% rule on a vacancy analyzer, the application funnel as a flow, internships and a retro after every interview.'),
  introduces: ['career.rule-60', 'career.funnel', 'career.retro'],
  uses: ['career.evidence', 'career.pet-project', 'method.little'],
  tier: 'core',
  minutes: 35,
  sources: { en: [SRC.little, SRC.cka], ru: [SRC.habrCareer, SRC.hh, SRC.kanbanRu] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Требования в вакансиях завышают намеренно, потому что в них описывают идеального кандидата, которого может и не существовать. Поэтому **откликайтесь, если подходите под требования на 60 %**. Мы называем это [[career.rule-60|правилом 60 %]]. Начинайте искать рано и не ждите, пока будете готовы полностью, потому что поиск работы сам по себе многому учит.',
        'Vacancy requirements are inflated on purpose, because they describe an ideal candidate who may not exist. So **apply if you match 60% of the requirements**. We call this [[career.rule-60|the 60% rule]]. Start early and do not wait until you are fully ready, because the search itself teaches a lot.',
      ),
    },
    {
      id: 'analyzer',
      kind: 'widget',
      step: 'try',
      widget: 'career.vacancy',
    },
    {
      id: 'flow',
      kind: 'text',
      step: 'explain',
      title: bi('Почему поиск работы устроен как поток', 'Why the job search works as a flow'),
      body: bi(
        'Каждый отклик проходит по колонкам: отклик, ответ компании, скрининг, техническое интервью, финал и предложение работы. Это та же доска, что в блоке о методологии, и к ней применимы те же метрики потока. Такую доску мы называем [[career.funnel|воронкой откликов]]. Здесь работает и [[method.little|закон Литтла]] из блока о методологии. Он говорит, что число откликов, которые одновременно находятся в работе, равно числу откликов в неделю, умноженному на то, сколько недель отклик проводит в пути. Если вы отправляете 12 откликов в неделю, а путь отклика в среднем занимает три недели, то в работе у вас одновременно около 36 откликов.\n\nИз этого следуют три практических правила. **Держите поток ровным.** Отправлять 10–15 продуманных откликов в неделю, каждый с письмом под вакансию, вполне по силам, даже если вы одновременно работаете и учитесь. **Следите за возрастом карточки.** Отклик, на который 14 дней нет ответа, закрывайте и больше не ждите. **Раз в две недели смотрите, сколько откликов проходит каждый этап.** Если ответов мало, дело в резюме и ключевых словах. Если отказывают после скрининга, дело в самопрезентации и рассказе о мотивации. Если отказывают после технического интервью, повторите тренировки и учебные интервью по темам, на которых вы споткнулись.',
        'Applications move through columns: apply → reply → screening → technical → final → offer. It is the same board as in the methodology block, with the same metrics — the [[career.funnel|application funnel]]. Little’s law works here too: the number of applications in progress equals the weekly flow of applications times the time in the system. At 12 applications a week and an average path of three weeks you have about 36 in progress.\n\nThree practical rules follow. **A steady flow**: 10–15 thoughtful applications a week, each with a letter for that vacancy, is realistic alongside work and study. **Card age**: an application with no reply for 14 days is closed, not waited on. **Conversion per stage** every two weeks: few replies means the CV and keywords; rejections after screening mean self-presentation and motivation; rejections after the technical round mean drills and mock interviews on the topics that failed.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как отклики проходят воронку', 'How applications move through the funnel'),
      body: bi(
        'Схема ниже показывает воронку в движении. Каждый отклик изображён на ней карточкой, которая неделями переходит из колонки в колонку, а на каждом этапе часть карточек отсеивается. Сначала на схеме только две колонки: ваши отклики слева вверху и цель, предложение работы, слева внизу. Остальные колонки появятся по ходу: в верхнем ряду ответ компании и скрининг, в нижнем техническое интервью и финал, а справа колонка «Отказ или тишина», куда уходят отклики без ответа.',
        'The diagram below shows the funnel in motion. Each application is a card that moves from column to column for weeks, and at every stage some cards drop out. At first only two columns are shown: your applications at the top left and the goal, an offer, at the bottom left. The other columns appear as you go: the company’s reply and the screening in the top row, the technical interview and the final in the bottom row, and “Rejected or silent” on the right, where applications without a reply go.',
      ),
    },
    { id: 'funnel', kind: 'explainer', step: 'look', explainer: 'career.funnel', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечена колонка, которая сейчас получает карточки, облачко у неё говорит, сколько карточек приходит за неделю, а по линии передаётся это число. Полоска внизу колонки показывает, насколько колонка заполнена. На последнем шаге под схемой появятся три числа: сколько карточек у вас в работе, сколько предложений приходит в неделю и через сколько недель придёт первое предложение.\n\nПосле первого прохода поменяйте в группе «Ваши отклики» число откликов в неделю, а потом включите письмо под каждую вакансию и сравните, как меняется срок до первого предложения. Напоследок включите в блоке «Сломать» паузу в откликах на время учёбы и посмотрите, когда опустеет доска.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. At every step the column receiving cards is highlighted, its callout says how many cards it gets a week, and that number travels along the line. The bar at the bottom of a column shows how full it is. At the last step three numbers appear under the diagram: how many cards you have in progress, how many offers come a week and in how many weeks the first offer comes.\n\nAfter the first pass change the number of applications a week in “Your applications”, then switch on a letter for each vacancy and compare how the time to the first offer changes. Finally, switch on the pause in applications while studying in “Break it” and see when the board empties.'), caption: bi('Доли ответов на схеме взяты для примера, а не из статистики рынка. Через две недели настоящего поиска подставьте свои числа: сколько откликов вы отправили, сколько получили ответов и сколько прошли скринингов. Самый узкий переход и покажет, что улучшать в первую очередь.', 'The rates in the diagram are an example, not market statistics. After two weeks of a real search put in your own numbers: applications sent, replies, screenings passed. The narrowest transition shows what to improve first.') },
    {
      id: 'where',
      kind: 'text',
      step: 'explain',
      title: bi('Где искать и сколько длится поиск', 'Where to look and how long it takes'),
      body: bi(
        'Новичку проще всего войти в профессию через **стажировки** и вакансии «на вырост». Крупные компании набирают стажёров по программам, сроки которых каждый год меняются, поэтому подпишитесь на их объявления заранее. Кроме того, ищите на сайтах вакансий, в карьерных разделах профессиональных сообществ и заведите профиль на английском, если хотите выйти на международный рынок.\n\nТрезвые ожидания помогают больше, чем мотивация. По данным Хабр Карьеры, путь с нуля до первой работы в DevOps занимает 9–15 месяцев, и из них 2–4 месяца уходит на активный поиск. Долгий поиск на этом рынке считается обычным делом, а не личной неудачей.\n\nСертификаты джуну в России почти не помогают получить работу. Опытному специалисту, который претендует на роли, связанные с Kubernetes, или на работу в зарубежной компании, имеет смысл сдать CKA. Это практический экзамен в терминале, на котором открыта только официальная документация, и к нему готовит последняя ступень лестницы документации в этом курсе.',
        'For a beginner the main way in is **internships** and “grow-into” vacancies: large companies hire interns through programmes whose dates change, so subscribe to their announcements in advance. Then job sites, the career sections of professional communities, and an English profile for the international market.\n\nHonest expectations matter more than motivation: according to Habr Career, the path from zero to a first DevOps job takes 9–15 months, 2–4 of them of active searching. A long search is the norm of the market, not a personal failure.\n\nCertificates barely help a junior get hired in Russia. For an experienced learner aiming at Kubernetes roles or the international market the CKA makes sense: it is a practical exam in a terminal with only the official documentation open — what the last step of the course’s documentation ladder prepares for.',
      ),
    },
    {
      id: 'retro',
      kind: 'callout',
      tone: 'note',
      title: bi('Разбор после каждого собеседования', 'A retro after every interview'),
      body: bi('Сразу после собеседования запишите три строки: какие вопросы вам задавали, где было трудно и что вы ответили. Такой короткий разбор называют [[career.retro|ретро собеседования]]. Благодаря ему каждое собеседование превращается в урок, а темы, на которых было трудно, становятся вопросами для повторения.', 'Right after an interview write three lines: which questions were asked, where it was hard, what you answered. That is the [[career.retro|interview retro]]: every interview becomes a lesson, and the hard topics become review cards.'),
    },
    {
      id: 'exit',
      kind: 'quiz',
      step: 'exit',
      title: bi('Проверьте себя', 'Check yourself'),
      items: ['career.q.apply', 'career.q.little', 'career.q.conversion', 'career.q.card-age'],
    },
  ],
};
