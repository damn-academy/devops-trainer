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
  summary: bi('«Расскажите о себе» за 60–90 секунд и колода вопросов, которых боятся.', '“Tell me about yourself” in 60–90 seconds, and a deck of the questions people dread.'),
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
        'Первый вопрос почти любого собеседования — «расскажите о себе». Ответ на него задаёт тон всему разговору, и его можно подготовить лучше любого другого. Это [[career.pitch]]: 60–90 секунд, пять частей, ни одного извинения.',
        'The first question of almost any interview is “tell me about yourself”. The answer sets the tone for the whole conversation, and it can be prepared better than any other. This is a [[career.pitch]]: 60–90 seconds, five parts, not one apology.',
      ),
    },
    {
      id: 'parts',
      kind: 'text',
      step: 'explain',
      title: bi('Пять частей', 'Five parts'),
      body: bi(
        '1. **Кто я и откуда** — одна фраза, без извинений за прошлое.\n2. **Что я умею — с доказательствами**: сданные экзамены курса, пет-проекты со ссылкой.\n3. **Что я сделал руками** — одна конкретная история: проблема, что сделал, что изменилось.\n4. **Почему DevOps** — мост от прежнего опыта к новой работе.\n5. **Что я ищу** — роль и формат.\n\nГотовый текст тебе не напишет ни курс, ни нейросеть: заученный чужой текст слышно, и на первом уточнении он рассыпается. Курс даёт структуру, меряет и показывает, что улучшить.',
        '1. **Who I am and where I come from** — one sentence, no apologies for the past.\n2. **What I can do — with proof**: the course exams passed, pet projects with links.\n3. **What I built with my own hands** — one concrete story: the problem, what you did, what changed.\n4. **Why DevOps** — the bridge from your earlier experience to the new job.\n5. **What I am looking for** — the role and the format.\n\nNeither the course nor an AI will write the text for you: a memorised text by someone else is audible, and it falls apart at the first follow-up. The course gives the structure, measures, and shows what to improve.',
      ),
    },
    {
      id: 'samples',
      kind: 'text',
      step: 'look',
      title: bi('Три моста', 'Three bridges'),
      body: bi(
        'Сильнее всего самопрезентацию делает четвёртая часть — мост. Три типичных примера и почему они работают:\n\n- **Бывший продавец**: «Переговоры с клиентами научили меня выяснять, что человеку на самом деле нужно, — в DevOps это половина работы с разработчиками». Работает, потому что называет конкретное умение и место, где оно пригодится.\n- **Специалист поддержки**: «Три года разбирал инциденты на первой линии — теперь хочу их предотвращать». Работает, потому что прежний опыт становится причиной, а не оправданием.\n- **Программист**: «Устал от того, что мой код доезжает до прода две недели». Работает, потому что это проблема, которую DevOps решает, и ты её прожил.\n\nЭто иллюстрации, а не тексты для копирования: твой мост — из твоей истории.',
        'The fourth part — the bridge — makes a self-presentation strongest. Three typical examples and why they work:\n\n- **A former salesperson**: “Negotiating with customers taught me to find out what a person really needs — in DevOps that is half of working with developers.” It works because it names a concrete skill and where it will be useful.\n- **A support specialist**: “For three years I handled incidents on the first line; now I want to prevent them.” It works because the earlier experience becomes a reason, not an excuse.\n- **A developer**: “I got tired of my code taking two weeks to reach production.” It works because it is a problem DevOps solves, and you lived it.\n\nThese are illustrations, not texts to copy: your bridge comes from your own story.',
      ),
    },
    { id: 'trainer', kind: 'widget', step: 'try', widget: 'career.pitch' },
    {
      id: 'awkward',
      kind: 'text',
      step: 'explain',
      title: bi('Неудобные вопросы', 'Awkward questions'),
      body: bi(
        'У каждого [[career.awkward|неудобного вопроса]] есть честный ответ, который работает лучше уклончивого:\n\n- **«Почему вы уходите из продаж?»** Говори о том, к чему идёшь, а не от чего бежишь: что тебя тянет в технику и что ты уже для этого сделал.\n- **«У вас нет опыта — почему мы должны вас взять?»** Опыт работы DevOps-инженером у тебя действительно нет, и выдумывать его нельзя. Зато есть то, что можно открыть: репозитории, сданные практические экзамены, история о том, что сломалось в пет-проекте и как ты чинил.\n- **«Ваши зарплатные ожидания?»** Заранее посмотри вилки для джунов в своём городе и формате работы и назови диапазон, а не одно число.\n- **«Расскажите о своей ошибке».** По схеме STAR: ситуация, задача, что ты сделал, результат — и что изменил после. Ошибка без вывода звучит как оправдание, вывод без ошибки — как неправда.\n- **«Что вы сделаете, если не справитесь с задачей?»** Сначала ищу сам с ограничением по времени, затем приношу коллеге то, что уже попробовал и где застрял.\n- **«Что делала нейросеть в вашем пет-проекте и как вы это проверяли?»** Скажи честно, что делал ИИ, и покажи проверку: тесты, линтеры, разбор каждой строки конфигурации, сверка с документацией. Сгенерированным кодом никого не удивить; удивляет понимание.',
        'Every [[career.awkward|awkward question]] has an honest answer that works better than an evasive one:\n\n- **“Why are you leaving sales?”** Talk about what you are moving towards, not what you are running from: what draws you to engineering and what you have already done about it.\n- **“You have no experience — why should we hire you?”** You really have no experience as a DevOps engineer, and you must not make it up. What you do have can be opened: repositories, passed practical exams, the story of what broke in your pet project and how you fixed it.\n- **“What are your salary expectations?”** Look up junior ranges for your city and work format in advance and name a range, not a single number.\n- **“Tell us about a mistake you made.”** With STAR: situation, task, what you did, the result — and what you changed afterwards. A mistake without a conclusion sounds like an excuse; a conclusion without a mistake sounds untrue.\n- **“What will you do if you cannot cope with a task?”** First I search on my own with a time limit, then I bring a colleague what I already tried and where I got stuck.\n- **“What did AI do in your pet project, and how did you check it?”** Say honestly what the AI did and show the checks: tests, linters, going through every line of configuration, comparing with the documentation. Generated code impresses nobody; understanding does.',
      ),
    },
    {
      id: 'exit',
      kind: 'quiz',
      step: 'exit',
      title: bi('Проверь себя', 'Check yourself'),
      items: ['career.q.pitch-order', 'career.q.apologies', 'career.q.no-experience'],
    },
  ],
};

export const L_RESUME: Lesson = {
  id: 'career.resume',
  block: 'career',
  title: bi('Резюме под DevOps', 'A CV for DevOps'),
  summary: bi('Каждый навык с подтверждением, честный перевод прежнего опыта, линтер из десяти правил.', 'Every skill with evidence, an honest translation of earlier experience, a linter of ten rules.'),
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
        'Нанимающий менеджер тратит на резюме джуна меньше минуты и ищет одно: можно ли проверить то, что написано. Поэтому главное правило резюме джуна простое — **каждый заявленный навык подтверждается тем, что можно открыть**: репозиторием, сданным экзаменом, протоколом. Это [[career.evidence]].',
        'A hiring manager spends less than a minute on a junior CV and looks for one thing: can what is written be checked. So the main rule of a junior CV is simple: **every skill you claim is backed by something one can open** — a repository, a passed exam, a protocol. That is [[career.evidence]].',
      ),
    },
    {
      id: 'rules',
      kind: 'text',
      step: 'explain',
      title: bi('Десять правил', 'Ten rules'),
      body: bi(
        '1. Заголовок — целевая роль («Junior DevOps Engineer»), а не прежняя профессия.\n2. У каждого навыка есть подтверждение; навык без него переносится в «Знаком» или удаляется.\n3. Ссылка на GitHub или GitLab с закреплёнными пет-проектами, у каждого — README.\n4. Нерелевантный опыт — одной строкой (должность, компания, годы) или переведён в мост.\n5. Пункты — действие и результат («настроил…, что сократило…»), а не обязанности («отвечал за…»).\n6. Без пустых формулировок: «уверенный пользователь ПК», «стрессоустойчивость», «быстро обучаюсь».\n7. Одна страница.\n8. В английской версии нет фото, возраста и семейного положения.\n9. Ключевые слова вакансии — там, где у тебя есть подтверждение, и только там.\n10. Ничего выдуманного: опыт работы DevOps-инженером не заявлен, если его не было; пет-проект называется пет-проектом.\n\nПравила 1–3, 8 и 10 — ошибки: с ними резюме не готово. Остальные — предупреждения, их можно осознанно отклонить.',
        '1. The headline is the target role (“Junior DevOps Engineer”), not the previous profession.\n2. Every skill has evidence; a skill without it moves to “Familiar with” or is removed.\n3. A GitHub or GitLab link with pinned pet projects, each with a README.\n4. Unrelated experience takes one line (position, company, years) or is translated into a bridge.\n5. Bullets are actions and results (“set up…, which cut…”), not duties (“was responsible for…”).\n6. No empty phrases: “confident PC user”, “stress-resistant”, “fast learner”.\n7. One page.\n8. The English version has no photo, age or marital status.\n9. The vacancy’s keywords appear where you have evidence, and only there.\n10. Nothing made up: no DevOps engineering job unless you held one; a pet project is called a pet project.\n\nRules 1–3, 8 and 10 are errors: with them the CV is not ready. The others are warnings that can be knowingly dismissed.',
      ),
    },
    {
      id: 'bridge',
      kind: 'text',
      step: 'explain',
      title: bi('Перевод прежнего опыта', 'Translating earlier experience'),
      body: bi(
        'Для того, кто приходит из другой профессии, самое ценное в резюме — честный [[career.bridge|опыт-мост]]. Не «переименовать» прошлое, а найти в нём то, что действительно было и что ценят в DevOps. Работа с возражениями превращается в «собирал требования клиентов и переводил их в задачи для технической команды»; отчёты в Excel — в «автоматизировал отчётность и сократил ручную работу с N до M часов»; первая линия поддержки — в «локализовал проблемы по журналам и шагам воспроизведения, эскалировал с описанием». Числа N и M — твои настоящие; если их нет, лучше без чисел, чем с придуманными.',
        'For someone coming from another profession the most valuable part of a CV is an honest [[career.bridge|bridge experience]]. Not “renaming” the past, but finding in it what really happened and what DevOps values. Handling objections becomes “gathered customer requirements and turned them into tasks for the technical team”; Excel reports become “automated reporting and cut manual work from N to M hours”; first-line support becomes “located problems from logs and reproduction steps, escalated with a write-up”. N and M are your real numbers; if you have none, better no numbers than invented ones.',
      ),
    },
    { id: 'builder', kind: 'widget', step: 'practice', widget: 'career.resume' },
    {
      id: 'letter',
      kind: 'text',
      step: 'explain',
      title: bi('Сопроводительное письмо', 'The cover letter'),
      body: bi(
        'Три абзаца. **Почему эта компания** — со ссылкой на конкретное в вакансии или в их продукте. **Что я умею из нужного** — с доказательствами, теми же, что в резюме. **Чего я хочу и чем буду полезен.** Проверка простая: первый абзац не должен подходить к любой другой вакансии. Если подходит — он ни о чём.',
        'Three paragraphs. **Why this company** — pointing to something concrete in the vacancy or their product. **What I can do of what you need** — with evidence, the same as in the CV. **What I want and how I will be useful.** The test is simple: the first paragraph must not fit any other vacancy. If it does, it says nothing.',
      ),
    },
    {
      id: 'exit',
      kind: 'quiz',
      step: 'exit',
      title: bi('Проверь себя', 'Check yourself'),
      items: ['career.q.cv-bug', 'career.q.cv-irrelevant', 'career.q.evidence'],
    },
  ],
};

export const L_PETS: Lesson = {
  id: 'career.pets',
  block: 'career',
  title: bi('Пет-проекты', 'Pet projects'),
  summary: bi('Восемь проектов, привязанных к блокам курса, с критериями приёмки и README.', 'Eight projects tied to the course blocks, with acceptance criteria and a README.'),
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
        '[[career.pet-project|Пет-проект]] — твоё главное подтверждение в резюме и твоя главная история на собеседовании. Он делается на настоящей машине: на недорогом VPS, на машине в облаке или в учебном облаке. Это первое место в курсе, где ты встретишь настоящие сбои, которых не бывает в песочнице, — и именно о них тебя будут спрашивать.',
        'A [[career.pet-project|pet project]] is your main evidence on a CV and your main story at an interview. It runs on a real machine: a cheap VPS, a cloud machine or a training cloud. It is the first place in the course where you meet real failures that never happen in a sandbox — and those are exactly what you will be asked about.',
      ),
    },
    {
      id: 'readme',
      kind: 'text',
      step: 'explain',
      title: bi('README по шаблону', 'A README from a template'),
      body: bi(
        'У каждого проекта — [[career.readme]] из шести разделов: что это и зачем; схема; как запустить с чистой машины; решения и почему; **что сломалось по дороге и как чинил**; что сделал бы дальше. Раздел «что сломалось» — главный для собеседования: в нём твоя ситуационная история, рассказанная уже не на учебном примере, а на своём.',
        'Every project has a [[career.readme]] with six sections: what it is and why; a diagram; how to run it from a clean machine; decisions and why; **what broke on the way and how you fixed it**; what you would do next. “What broke” matters most for an interview: it is your situational story told about your own system instead of a training example.',
      ),
    },
    {
      id: 'map',
      kind: 'text',
      step: 'look',
      title: bi('Какой проект после какого блока', 'Which project after which block'),
      body: bi(
        'Проект открывается, когда пройдены блоки, на материале которых он стоит, и каждый добавляет один-два новых навыка поверх уже проверенных. Ниже — все проекты с критериями приёмки; отмечай выполненное, отметки сохраняются. Пути по уровням: новичок — 1 → 3 → 4 → 6 → 7 и итоговый экзамен; средний — 1 → 3 → 4 → 5 → 6 → 7; опытный — 3 → 5 → 6 → 7 → 7б и по желанию 8. Проект 3 обязателен всем: на нём стоит итоговый экзамен.',
        'A project opens when the blocks it builds on are done, and each one adds one or two new skills on top of those already checked. Below are all the projects with their acceptance criteria; tick what is done, the ticks are saved. Paths by level: beginner — 1 → 3 → 4 → 6 → 7 and the final exam; intermediate — 1 → 3 → 4 → 5 → 6 → 7; experienced — 3 → 5 → 6 → 7 → 7b and optionally 8. Project 3 is required for everyone: the final exam is built on it.',
      ),
    },
    { id: 'tracker', kind: 'widget', step: 'practice', widget: 'career.checklist', props: { kind: 'pets' } },
    {
      id: 'cost',
      kind: 'callout',
      tone: 'cost',
      title: bi('Стоимость', 'Cost'),
      body: bi('Недорогого VPS хватает для проектов 1–4 и 6; для 7б нужны три машины на несколько часов. До заказа посчитай «машины × размер × часы» у своего провайдера и отдельно — сколько стоят сутки, если забыть удалить.', 'A cheap VPS is enough for projects 1–4 and 6; 7b needs three machines for a few hours. Before ordering, work out “machines × size × hours” at your provider, and separately what a day costs if you forget to delete them.'),
    },
    {
      id: 'cleanup',
      kind: 'callout',
      tone: 'cleanup',
      title: bi('Уборка', 'Cleanup'),
      body: bi('После работы удали временные машины и проверь это списком машин у провайдера. Если оставляешь одну машину живой для работодателя, знай её месячную цену.', 'After the work, delete the temporary machines and check it with the provider’s machine list. If you leave one machine running for employers, know its monthly price.'),
    },
    {
      id: 'exit',
      kind: 'quiz',
      step: 'exit',
      title: bi('Проверь себя', 'Check yourself'),
      items: ['career.q.pet-match', 'career.q.measurable', 'career.q.readme-key'],
    },
  ],
};

export const L_SEARCH: Lesson = {
  id: 'career.search',
  block: 'career',
  title: bi('Стратегия поиска', 'The search strategy'),
  summary: bi('Правило 60% на анализаторе вакансии, воронка откликов как поток, стажировки и ретро после каждого собеседования.', 'The 60% rule on a vacancy analyzer, the application funnel as a flow, internships and a retro after every interview.'),
  introduces: ['career.rule-60', 'career.funnel', 'career.retro'],
  uses: ['career.evidence', 'career.pet-project'],
  tier: 'core',
  minutes: 35,
  sources: { en: [SRC.little, SRC.cka], ru: [SRC.habrCareer, SRC.hh, SRC.kanbanRu] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Требования в вакансиях завышают намеренно: в них пишут портрет идеального кандидата, которого может и не быть. Поэтому правило простое — **совпадаешь на 60% — откликайся**. Это [[career.rule-60]]. Начинай рано и не жди идеальной готовности: поиск сам по себе учит.',
        'Vacancy requirements are inflated on purpose: they describe an ideal candidate who may not exist. So the rule is simple: **if you match 60%, apply**. That is [[career.rule-60]]. Start early and do not wait to be perfectly ready: the search itself teaches.',
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
      title: bi('Поиск — это поток', 'The search is a flow'),
      body: bi(
        'Отклики идут по колонкам: отклик → ответ → скрининг → техническое → финал → оффер. Это та же доска, что в блоке методологии, с теми же метриками — [[career.funnel]]. Работает и закон Литтла: число откликов в работе равно потоку откликов в неделю, умноженному на время в системе. При 12 откликах в неделю и среднем пути в три недели у тебя в работе около 36 откликов.\n\nОтсюда три практических правила. **Ровный поток**: 10–15 осмысленных откликов в неделю с письмом под вакансию — реально при работе и учёбе одновременно. **Возраст карточки**: отклик без ответа старше 14 дней — закрыть и не ждать. **Конверсия по этапам** каждые две недели: мало ответов — дело в резюме и ключевых словах; отказы после скрининга — в самопрезентации и мотивации; отказы после технического — в дриллах и мок-интервью по проваленным темам.',
        'Applications move through columns: apply → reply → screening → technical → final → offer. It is the same board as in the methodology block, with the same metrics — the [[career.funnel]]. Little’s law works here too: the number of applications in progress equals the weekly flow of applications times the time in the system. At 12 applications a week and an average path of three weeks you have about 36 in progress.\n\nThree practical rules follow. **A steady flow**: 10–15 thoughtful applications a week, each with a letter for that vacancy, is realistic alongside work and study. **Card age**: an application with no reply older than 14 days is closed, not waited on. **Conversion per stage** every two weeks: few replies means the CV and keywords; rejections after screening mean self-presentation and motivation; rejections after the technical round mean drills and mock interviews on the topics that failed.',
      ),
    },
    { id: 'funnel', kind: 'explainer', step: 'look', explainer: 'career.funnel', caption: bi('Конверсии — модель, а не статистика рынка: подставь свои после двух недель поиска.', 'The conversions are a model, not market statistics: put in your own after two weeks of searching.') },
    {
      id: 'where',
      kind: 'text',
      step: 'explain',
      title: bi('Где искать и сколько это длится', 'Where to look and how long it takes'),
      body: bi(
        'Для новичка главный вход — **стажировки** и вакансии «на вырост»: крупные компании набирают стажёров по программам, сроки которых меняются, поэтому подпишись на их объявления заранее. Дальше — сайты вакансий, карьерные разделы профильных сообществ и профиль на английском для международного рынка.\n\nЧестные ожидания важнее мотивации: по данным Хабр Карьеры, путь с нуля до первой работы в DevOps занимает 9–15 месяцев, из них 2–4 месяца активного поиска. Долгий поиск — норма рынка, а не личная неудача.\n\nСертификаты джуну в России почти не помогают при найме. Опытному, который целится в роли с Kubernetes или на международный рынок, имеет смысл CKA: это практический экзамен в терминале, где открыта только официальная документация, — к нему и готовит последняя ступень лестницы документации курса.',
        'For a beginner the main way in is **internships** and “grow-into” vacancies: large companies hire interns through programmes whose dates change, so subscribe to their announcements in advance. Then job sites, the career sections of professional communities, and an English profile for the international market.\n\nHonest expectations matter more than motivation: according to Habr Career, the path from zero to a first DevOps job takes 9–15 months, 2–4 of them of active searching. A long search is the norm of the market, not a personal failure.\n\nCertificates barely help a junior get hired in Russia. For an experienced learner aiming at Kubernetes roles or the international market the CKA makes sense: it is a practical exam in a terminal with only the official documentation open — exactly what the last step of the course’s documentation ladder prepares for.',
      ),
    },
    {
      id: 'retro',
      kind: 'callout',
      tone: 'note',
      title: bi('Ретро после каждого собеседования', 'A retro after every interview'),
      body: bi('Сразу после собеседования запиши в три строки: какие вопросы задавали, где было трудно, что ответил. Это [[career.retro]]: каждое собеседование становится уроком, а темы, где было трудно, — карточками повторения.', 'Right after an interview write three lines: which questions were asked, where it was hard, what you answered. That is the [[career.retro]]: every interview becomes a lesson, and the hard topics become review cards.'),
    },
    {
      id: 'exit',
      kind: 'quiz',
      step: 'exit',
      title: bi('Проверь себя', 'Check yourself'),
      items: ['career.q.apply', 'career.q.little', 'career.q.conversion', 'career.q.card-age'],
    },
  ],
};
