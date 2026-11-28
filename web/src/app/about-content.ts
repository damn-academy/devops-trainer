// The texts of the «Справка» section (#/about): what the platform is, how to use
// it, how it is built, how to run it in a company or a school, and how to
// contribute. Facts come from design/00-DESIGN.md, web/README.md,
// web/CONTRACTS.md, web/STATUS.md, lab/README.md, deploy/README.md,
// service/feedback/README.md and the RV64 work logs; nothing here is a plan
// dressed up as a feature. CONTRIBUTING.md and CONTRIBUTING.ru.md at the
// repository root carry the same content as the «contribute» page.

import { bi, type Bi } from '../core/i18n';

export const REPO = 'https://github.com/damn-academy/devops-trainer';
export const KUBEROOT_REPO = 'https://github.com/tym83/kuberoot';

export type AboutPageId = 'what' | 'use' | 'how' | 'deploy' | 'contribute' | 'projects';

export interface AboutSection {
  id: string;
  title: Bi;
  body: Bi;
}

export interface AboutPageDef {
  id: AboutPageId;
  /** The tab label in the section's navigation. */
  nav: Bi;
  title: Bi;
  lede: Bi;
  sections: AboutSection[];
}

const p = (...paragraphs: string[]) => paragraphs.join('\n\n');
const code = (lang: string, ...lines: string[]) => '```' + lang + '\n' + lines.join('\n') + '\n```';
const sec = (id: string, title: Bi, ru: string, en: string): AboutSection => ({ id, title, body: bi(ru, en) });

// ── Что это ──

const WHAT: AboutPageDef = {
  id: 'what',
  nav: bi('Что это', 'What it is'),
  title: bi('Что такое damn.academy', 'What damn.academy is'),
  lede: bi(
    'damn.academy — открытая бесплатная платформа с профессиями и курсами. Профессия ведёт к новой работе с нуля, курс учит отдельному навыку или области работы без смены профессии. Всё написано на русском и английском языке, работает в браузере и не требует ни регистрации, ни оплаты.',
    'damn.academy is an open, free platform with professions and courses. A profession takes you from scratch to a new job; a course teaches a particular skill or area of work without a career change. Everything is written in Russian and English, runs in the browser and requires neither registration nor payment.',
  ),
  sections: [
    sec(
      'catalog',
      bi('Профессии и курсы', 'Professions and courses'),
      p(
        'Сейчас на платформе одна профессия и восемь курсов. Профессия «DevOps-инженер» учит человека, который меняет работу, собирать, выкладывать и поддерживать в рабочем состоянии программы компании и серверы, на которых они работают. Деловые курсы написаны для тех, кто продвигает, продаёт и развивает открытый инфраструктурный продукт: маркетинг инфраструктурного продукта, продажи, продукт, события и выступления, open source, стратегия и экосистема, PR и коммуникации; к ним добавлен курс «Научное мышление», который пригодится любому, кто читает отчёты и чужие истории успеха.',
        'Профессии и курсы устроены по-разному, потому что учат разному. Общее у них одно: каждое понятие нужно не только прочитать, но и попробовать. В профессии DevOps-инженера практика идёт в терминале на настоящих машинах, а в деловых курсах — на схемах, в тренажёрах, в шаблонах таблиц и в симуляторах отделов компании, где ведущим выступает нейросеть.',
      ),
      p(
        'The platform currently has one profession and eight courses. The DevOps engineer profession teaches people changing jobs to build, deploy and keep running a company’s programs and the servers they run on. The business courses are written for people who promote, sell and develop an open infrastructure product: infrastructure product marketing, sales, product, events and speaking, open source, strategy and ecosystem, PR and communications. They are joined by Scientific Thinking, a course useful to anyone who reads reports and other people’s success stories.',
        'Professions and courses are structured differently because they teach different things. They share one principle: every concept must be tried, not just read about. In the DevOps engineer profession, practice takes place in a terminal on real machines; in the business courses, it uses diagrams, trainers, spreadsheet templates and simulators of company departments where an AI acts as the facilitator.',
      ),
    ),
    sec(
      'devops',
      bi('Профессия DevOps-инженер', 'The DevOps engineer profession'),
      p(
        'Профессия рассчитана на взрослых людей, которые меняют работу и учатся по вечерам: на тех, кто пришёл из продаж, технической поддержки, тестирования или разработки. Чтобы начать, достаточно уметь пользоваться компьютером и браузером, а всё остальное, от первой команды в терминале до кластера Kubernetes, объясняется в уроках.',
        'Маршрут ведёт от вопроса, зачем бизнесу DevOps, к первому отклику на вакансию. Блоки идут в таком порядке: ориентир для новичков, методология и Kanban, Linux, Git и YAML, сети, контейнеры, CI/CD, Kubernetes в два этапа с выкладкой в Kubernetes из CI между ними, Ansible и Terraform, кластер из кода, мониторинг, дежурная смена с итоговым экзаменом и, наконец, карьера. У каждого блока три уровня, «Новичок», «Средний» и «Опытный»: чем выше уровень, тем меньше вводных объяснений и тем раньше начинается практика, а основное содержание и экзамен одинаковы для всех. Если тема уже знакома, короткая проверка уровня подтверждает это, и уроки, которые она зачла, можно пропустить.',
        'Уроки профессии собраны из теории, написанной связным текстом, схем, которые показывают процессы по шагам и которые можно ломать переключателями, практики в терминале и вопросов проверки восьми видов. Задания выполняются в симуляторе, на настоящем Linux, который запускается во вкладке браузера, или на настоящих виртуальных машинах, и проверяется не набранный текст, а то, что изменилось в машине. Блоки закрываются практическими экзаменами без подсказок, часть из которых идёт на настоящих машинах.',
        'Через всю профессию проходит лестница документации. В первых уроках рядом с заданием стоит ссылка на нужное место в справке, потом остаётся только ссылка на страницу, затем появляются задания, для которых нужно найти в документации то, чего в уроках не было, а на последних экзаменах открыта одна официальная документация. Поэтому к концу чтение `man`, `--help` и документации Kubernetes становится привычкой, а не подвигом.',
      ),
      p(
        'The profession is intended for adults who are changing jobs and study in the evenings: people coming from sales, technical support, testing or development. To start, you only need to know how to use a computer and a browser; the lessons explain everything else, from the first terminal command to a Kubernetes cluster.',
        'The route leads from the question of why a business needs DevOps to the first job application. The blocks follow this order: orientation for beginners, methodology and Kanban, Linux, Git and YAML, networks, containers, CI/CD, Kubernetes in two stages with deployment to Kubernetes from CI between them, Ansible and Terraform, a cluster from code, monitoring, an on-call shift with a final exam and, finally, career. Every block has three levels, “Beginner”, “Intermediate” and “Experienced”: the higher the level, the fewer introductory explanations and the sooner practice begins, while the core content and exam are the same for everyone. If a topic is already familiar, a short level check confirms it, and the lessons it credits can be skipped.',
        'The profession’s lessons combine theory written in connected prose, diagrams that show processes step by step and can be broken with switches, terminal practice and eight kinds of review questions. Tasks run in a simulator, on real Linux launched in a browser tab or on real virtual machines, and checks assess what changed in the machine rather than the text you typed. Blocks end with practical exams without hints, some of which run on real machines.',
        'The documentation ladder runs through the whole profession. In the first lessons, a task comes with a link to the relevant place in the documentation; later only a link to the page remains, followed by tasks that require finding things in the documentation that the lessons have not taught. In the last exams, only official documentation is available. By the end, reading `man`, `--help` and the Kubernetes documentation becomes a habit rather than a feat.',
      ),
    ),
    sec(
      'business',
      bi('Деловые курсы', 'Business courses'),
      p(
        'Каждый деловой курс разбит на модули, и у каждого урока есть описание в одно предложение, поэтому курс можно проходить целиком или открыть только нужный модуль. Уроки написаны по свежим данным со ссылками на источники: правила площадок, цены, отчёты компаний и исследования на конец 2026 года, и там, где данных нет, урок так и говорит.',
        'Практика в деловых курсах устроена иначе, чем в профессии. Схемы показывают процессы по шагам, например воронку события от приглашения до сделки. Тренажёры дают задачу на устоявшиеся правила, например собрать файл управления открытым проектом или посчитать, окупится ли стенд на конференции. Шаблоны таблиц можно скачать и заполнить своими данными, а задания «в документе» сохраняются на странице урока. В конце большинства курсов ждёт симулятор отдела: квартал в маркетинге, неделя кризиса, год проекта в инкубаторе CNCF. В нём нейросеть играет мир, коллег и клиентов, исход решений зависит и от вас, и от рынка со скрытыми обстоятельствами, а играть можно на странице со своим ключом нейросети или скопировав запрос в любой чат.',
      ),
      p(
        'Each business course is divided into modules, and every lesson has a one-sentence description, so you can take the whole course or open only the module you need. Lessons use recent data with links to sources: platform rules, prices, company reports and research as of late 2026. Where data is unavailable, the lesson says so.',
        'Practice in the business courses works differently from practice in the profession. Diagrams show processes step by step, such as an event funnel from invitation to deal. Trainers set tasks based on established rules, such as assembling a governance file for an open source project or calculating whether a conference booth will pay for itself. Spreadsheet templates can be downloaded and filled with your own data, while “in a document” assignments are saved on the lesson page. Most courses end with a department simulator: a quarter in marketing, a week of crisis or a year of a project in the CNCF incubator. The AI plays the world, colleagues and customers; the outcome of decisions depends both on you and on a market with hidden circumstances. You can play on the page with your own AI key or copy the prompt into any chat.',
      ),
    ),
    sec(
      'not',
      bi('Чем платформа не является', 'What the platform is not'),
      p(
        'Платформа не игра: в ней нет очков, значков, серий дней и таблиц лидеров, а прогресс выглядит как список пройденных уроков и сданных проверок. Это и не видеокурсы, где преподаватель показывает, а ученик смотрит, потому что почти каждое понятие здесь нужно попробовать самому: в терминале, на схеме, в тренажёре или в симуляторе.',
        'Сертификатов платформа пока не выдаёт: для них понадобятся аккаунт и проверка результата на сервере, а сейчас всё работает без аккаунтов. Машины в облаке платформа за вас не арендует и ничего на них сама не запускает. Там, где нужны настоящие серверы, вы берёте их у своего облачного провайдера или бесплатно запускаете на своём компьютере программой dtlab. Опыта работы ни профессия, ни курсы не заменяют, но после них вы понимаете, как устроена работа, в которой этот опыт придётся получать.',
      ),
      p(
        'The platform is not a game: there are no points, badges, daily streaks or leaderboards, and progress is a list of completed lessons and passed checks. These are not video courses where the teacher demonstrates and the learner watches, either: almost every concept must be tried yourself, in a terminal, on a diagram, in a trainer or in a simulator.',
        'The platform does not issue certificates yet: those would require an account and server-side verification of results, while everything currently works without accounts. The platform does not rent cloud machines for you or run anything on them itself. Where real servers are needed, you get them from your own cloud provider or run them on your computer for free with dtlab. Neither the profession nor the courses replace work experience, but afterwards you understand how the work in which you will gain that experience is organised.',
      ),
    ),
    sec(
      'license',
      bi('Лицензия и исходный код', 'Licence and source code'),
      p(
        `Исходный код платформы, профессий и курсов открыт и лежит на GitHub в репозитории [damn-academy/devops-trainer](${REPO}). Он распространяется по лицензии Apache-2.0, поэтому платформу можно бесплатно ставить у себя, менять и использовать в компании или школе, в том числе в коммерческих целях, если сохранить текст лицензии и уведомления об авторстве. Как развернуть платформу, рассказано на странице [«Развернуть у себя»](#/about/deploy), а как предложить исправление, рассказано на странице [«Как поучаствовать»](#/about/contribute).`,
      ),
      p(
        'The source code of the platform, professions and courses is open and available on GitHub in the [damn-academy/devops-trainer](https://github.com/damn-academy/devops-trainer) repository. It is distributed under Apache-2.0, so you can install, modify and use the platform in a company or school for free, including commercially, provided you preserve the licence text and copyright notices. The [“Run it yourself”](#/about/deploy) page explains how to deploy the platform, and [“Contributing”](#/about/contribute) explains how to propose a fix.',
      ),
    ),
  ],
};

// ── Как пользоваться ──

const USE: AboutPageDef = {
  id: 'use',
  nav: bi('Как пользоваться', 'How to use it'),
  title: bi('Как пользоваться платформой', 'How to use the platform'),
  lede: bi(
    'Эта страница рассказывает, как пройти профессию или курс от первого урока до экзамена, где хранится ваш прогресс и какие возможности платформы пригодятся по дороге. Часть разделов относится только к профессии DevOps-инженера, где практика идёт на настоящих машинах, а раздел о деловых курсах — только к ним.',
    'This page explains how to go through a profession or course from the first lesson to the exam, where your progress is kept and which platform features come in handy along the way. Some sections apply only to the DevOps engineer profession, where practice runs on real machines, while the section on business courses applies only to those courses.',
  ),
  sections: [
    sec(
      'route',
      bi('Маршрут профессии, уровни и проверка уровня', 'The profession’s route, levels and the level check'),
      p(
        'Главная страница показывает профессии и курсы. Страница профессии DevOps-инженера показывает маршрут, то есть все её блоки в том порядке, в котором их стоит проходить. Каждый следующий блок опирается на предыдущие, поэтому перепрыгивать через блоки не стоит. Если тема знакома, её быстрее закрыть проверкой уровня.',
        'На странице блока вы выбираете один из трёх уровней, «Новичок», «Средний» или «Опытный». От уровня зависит, какие разделы уроков вы увидите: новичку уроки объясняют больше и подробнее, а опытному пропускает вводные разделы. Кнопка «Покажите, что уже умеете» открывает короткую проверку без подсказок и без наставника. Если проверка пройдена, платформа подтверждает уровень и засчитывает уроки, которые она покрыла. Если нет, платформа предложит пройти только уроки по найденным пробелам или выбрать уровень ниже, а повторить проверку с другими заданиями можно через 72 часа, то есть через трое суток.',
      ),
      p(
        'The home page shows professions and courses. The DevOps engineer profession page shows the route, that is, all its blocks in the order in which they are best taken. Each block relies on the previous ones, so skipping blocks is a bad idea. If a topic is familiar, it is quicker to close it with the level check.',
        'On a block’s page you choose one of three levels: “Beginner”, “Intermediate” or “Experienced”. The level decides which parts of the lessons you see: a beginner gets more and fuller explanations, an experienced learner skips the introductory parts. The button “Show what you already know” opens a short check without hints and without the mentor. If the check is passed, the platform confirms the level and credits the lessons it covered. If not, the platform offers to take only the lessons on the gaps it found or to choose a lower level, and the check can be retaken with other tasks after 72 hours, that is, three days.',
      ),
    ),
    sec(
      'lesson',
      bi('Как устроен урок', 'How a lesson works'),
      p(
        'Урок начинается с рабочей ситуации, в которой его знание выручает, а дальше чередует части разных видов. Теорию вы читаете, как главу учебника, и щелчок по термину, оформленному ссылкой, открывает его короткое определение.',
        'Схема показывает процесс по шагам. Кнопки «Шаг вперёд» и «Проиграть» ведут процесс дальше, в «Параметрах» меняются условия, при которых он идёт, а переключатели «Сломать» включают настоящие неисправности, и схема останавливается на том шаге, где остановилась бы настоящая система. Перед изменением схема иногда спрашивает «Что будет?» и после него показывает, совпало ли ваше предположение. Инструкция к каждой схеме открывается строкой «Как пользоваться схемой».',
        'В профессии DevOps-инженера практика проходит в терминале. Над ним перечислены цели, и цель отмечается выполненной, как только машина пришла в нужное состояние, причём неважно, какой командой вы этого добились. Если цель не даётся, подсказки открываются по одной, от общего направления к конкретному месту в документации. Вопросы проверки закрепляют понятия урока, а после ответа платформа объясняет, почему верный вариант верен и в чём ошибка неверного. Урок считается пройденным, когда пройдены все его части, которые показаны на вашем уровне.',
      ),
      p(
        'A lesson begins with a work situation in which its knowledge helps, and then alternates parts of different kinds. You read the theory like a chapter of a textbook, and a click on a term shown as a link opens its short definition.',
        'A diagram shows a process step by step. The buttons “Step forward” and “Play” move the process on, “Parameters” change the conditions it runs in, and the “Break it” switches turn on real faults, so the diagram stops at the step where a real system would stop. Before a change the diagram sometimes asks “What will happen?” and afterwards shows whether your guess was right. Each diagram’s instructions open from the line “How to use the diagram”.',
        'In the DevOps engineer profession, practice takes place in a terminal. The goals are listed above it, and a goal is marked done as soon as the machine reaches the required state, no matter which command got it there. If a goal does not give in, hints open one at a time, from the general direction to the exact place in the documentation. Questions reinforce the lesson’s concepts, and after an answer the platform explains why the right option is right and what is wrong with a wrong one. A lesson is finished when every part of it shown at your level is finished.',
      ),
    ),
    sec(
      'business',
      bi('Как проходить деловые курсы', 'How to take the business courses'),
      p(
        'Страница делового курса показывает его модули и уроки с описанием каждого в одно предложение. Курс можно проходить по порядку или открыть только нужный модуль: уровней и проверки уровня у деловых курсов нет, а урок считается пройденным, когда пройдены его части. В конце урока обычно есть задание с указанием, где его выполнять: в тренажёре на этой же странице, в шаблоне таблицы, который скачивается кнопкой, или в документе, который сохраняется на странице урока и скачивается текстовым файлом.',
        'Тренажёры с готовыми правилами, например сборка файла управления открытым проектом или расчёт окупаемости стенда, проверяют ответ сразу и без нейросети. Тренажёры, где нужно написать текст или поговорить с персонажем, и симуляторы отделов работают с нейросетью. Если ключ нейросети подключён в [настройках](#/settings), игра идёт на странице урока; если нет, кнопка копирует полный запрос, и его можно вставить в любой чат с нейросетью. Ход игры симулятор записывает в блок состояния, поэтому партию можно прервать и продолжить позже в той же переписке.',
      ),
      p(
        'A business course page shows its modules and lessons, each with a one-sentence description. You can take the course in order or open only the module you need: business courses have no levels or level checks, and a lesson is complete when its parts are complete. A lesson usually ends with an assignment that says where to do it: in a trainer on the same page, in a spreadsheet template downloaded with a button, or in a document saved on the lesson page and downloadable as a text file.',
        'Trainers with predefined rules, such as assembling a governance file for an open source project or calculating the return on a booth, check answers immediately without AI. Trainers that ask you to write text or talk to a character, and department simulators, use AI. If an AI key is connected in [Settings](#/settings), the game runs on the lesson page; otherwise, a button copies the full prompt for pasting into any AI chat. The simulator records the game’s progress in a state block, so you can pause a session and resume it later in the same conversation.',
      ),
    ),
    sec(
      'review',
      bi('Повторение', 'Review'),
      p(
        'Понятия из пройденных уроков возвращаются на странице [«Повторение»](#/review). Курс планирует повторение по алгоритму FSRS — планировщику интервальных повторений, который сам решает, когда пора вспомнить понятие: то, на котором вы ошиблись, возвращается скоро, а понятие, на которое вы уверенно ответили, возвращается через всё больший промежуток.',
      ),
      p(
        'Concepts from finished lessons come back on the [“Review”](#/review) page. The course schedules review with FSRS, a spaced-repetition planner that decides on its own when a concept is due: one you got wrong comes back soon, and a concept you answered confidently comes back after an ever longer interval.',
      ),
    ),
    sec(
      'exams',
      bi('Экзамены, в том числе на настоящих машинах', 'Exams, including those on real machines'),
      p(
        'Экзамены есть в профессии DevOps-инженера. Экзамен блока открывается со страницы блока. Перед началом вы выбираете режим. В режиме «Экзамен» вы работаете только со встроенной документацией, наставник выключен, и сданный экзамен закрывает блок. В режиме «Тренировка» можно пользоваться любыми помощниками, после него вы получите полный разбор, но блок не закроется. Курс не следит за вами и не проверяет, открыта ли у вас другая вкладка, поэтому выбор режима остаётся делом вашей совести.',
        'Часть экзаменов проходит на настоящих машинах: на сервере, который вы администрируете сами, или на кластере Kubernetes, который вы собрали своими руками. Курс на таких машинах ничего не выполняет. Экзамен даёт вам скрипт проверки, который ничего не меняет, а только читает состояние машины, и одноразовый код попытки. Вы запускаете скрипт на машине, он печатает блок текста с фактами о машине и этим кодом, а вы вставляете блок в поле экзамена. Если машины запущены программой dtlab, оба шага делает одна команда `dtlab facts`.',
      ),
      p(
        'The DevOps engineer profession has exams. A block’s exam opens from the block’s page. Before it starts you choose a mode. In the “Exam” mode you work only with the built-in documentation, the mentor is off, and a passed exam closes the block. In the “Training” mode any helpers are allowed, afterwards you get a full review, but the block stays open. The course does not watch you and does not check whether another tab is open, so the choice of mode is a matter of your conscience.',
        'Some exams take place on real machines: on a server you administer yourself, or on a Kubernetes cluster you assembled by hand. The course executes nothing on such machines. The exam gives you a check script that changes nothing and only reads the state of the machine, and a one-time code of the attempt. You run the script on the machine, it prints a block of text with facts about the machine and that code, and you paste the block into the exam’s box. If the machines are run by dtlab, both steps are done by one command, `dtlab facts`.',
      ),
    ),
    sec(
      'docs',
      bi('Лестница документации', 'The documentation ladder'),
      p(
        'Документация в профессии DevOps-инженера открывается в боковой панели и работает без сети: в платформу встроены страницы `man`, вывод `--help`, страницы `kubectl explain` и короткие копии официальной документации. Сначала рядом с заданием стоит значок, который открывает нужную страницу на нужной строке. Потом платформа показывает фрагмент страницы с выделенной строкой, затем только ссылку, а дальше даёт задания, для которых нужно найти в документации то, чего в уроках не было, и подсказок к ним нет. Последняя ступень — экзамен, на котором открыта только официальная документация. Ступень растёт с вашими успехами и никогда не опускается.',
      ),
      p(
        'The documentation in the DevOps engineer profession opens in a side panel and works without a network: the platform has `man` pages, `--help` output, `kubectl explain` pages and short copies of official documentation built in. At first a task carries a chip that opens the right page at the right line. Later the platform shows a fragment of the page with the line highlighted, then only a link, and after that it sets tasks that need something from the documentation the lessons did not teach, with no hints. The last rung is an exam where only the official documentation is open. The rung rises with your progress and never goes down.',
      ),
    ),
    sec(
      'ai',
      bi('Виртуальный наставник и своя нейросеть', 'A virtual mentor and your own AI'),
      p(
        'Когда подсказки к заданию закончились, попытка не удалась или вы ответили на вопрос, рядом появляется кнопка «Спросить нейросеть». Она составляет запрос о том, что вы сейчас проходите, и показывает его целиком, а вы можете поправить текст, скопировать его или открыть выбранный чат в новой вкладке. Сама платформа ничего нейросетям не отправляет: запрос уходит, только когда вы вставляете его в чат или нажимаете кнопку чата.',
        'В [настройках](#/settings), в разделе «Ваша нейросеть», можно подключить ключ своего провайдера нейросети, и тогда виртуальный наставник отвечает на странице урока. Ключ хранится в этом браузере в зашифрованном виде, а запросы уходят из браузера к выбранному провайдеру, минуя сервер платформы. Наставник видит урок, пройденные понятия и последние строки терминала, но готового решения задания не получает. На экзаменах и на проверке уровня наставника и кнопки нейросети нет.',
      ),
      p(
        'When the hints of a task run out, an attempt fails or you have answered a question, an “Ask the AI” button appears next to it. The button writes a prompt about what you are working on and shows the whole prompt, which you can edit, copy, or open in a chat of your choice in a new tab. The platform itself sends nothing to any AI: the prompt leaves only when you paste it into a chat or press a chat’s button.',
        'In [Settings](#/settings), under “Your AI”, you can connect a key of your own AI provider, and then the virtual mentor answers on the lesson page. The key is kept in this browser encrypted, and the requests go from the browser to the chosen provider, bypassing the platform’s server. The mentor sees the lesson, the concepts you have covered and the last lines of the terminal, but never gets the ready solution of a task. Exams and level checks have neither the mentor nor the AI button.',
      ),
    ),
    sec(
      'feedback',
      bi('Сообщения автору и раздел «Мои сообщения»', 'Messages to the author and “My messages”'),
      p(
        'Если в уроке ошибка, что-то непонятно или не работает, нажмите кнопку «Сообщить о проблеме» в правом нижнем углу экрана или выделите текст и нажмите появившуюся кнопку «Комментировать». Перед отправкой можно раскрыть строку под полем сообщения и увидеть всё, что уйдёт вместе с ним: место на сайте и вывод терминала, в котором пароли и ключи заранее скрыты. Написать автору о чём-то другом можно кнопкой «Написать автору» внизу любой страницы.',
        'Ответы автора появляются на странице [«Мои сообщения»](#/messages) в верхнем меню. Аккаунт для этого не нужен: переписка хранится в этом браузере и переносится на другое устройство вместе с файлом прогресса.',
      ),
      p(
        'If something in a lesson is wrong, unclear or broken, press “Report a problem” in the bottom right corner of the screen, or select some text and press the “Comment” button that appears. Before sending you can open the line under the message box and see everything that goes with it: the place on the site and the terminal output, with passwords and keys hidden beforehand. To write to the author about something else, use the “Contact the author” button at the bottom of any page.',
        'The author’s replies appear on the [“My messages”](#/messages) page in the top menu. No account is needed for that: the conversation is kept in this browser and moves to another device together with the progress file.',
      ),
    ),
    sec(
      'progress',
      bi('Где хранится прогресс и как его перенести', 'Where progress is kept and how to move it'),
      p(
        'Платформа не просит регистрироваться. Пройденные уроки, ответы, выбранные уровни и ваши сообщения автору записываются в хранилище этого браузера на этом компьютере после каждого действия, и кнопки «Сохранить» на сайте нет. На сервер платформы прогресс не уходит, поэтому в другом браузере или на другом устройстве всё начнётся с чистого листа. Прогресс пропадёт, если заниматься в приватном окне или очистить данные сайта, а Safari к тому же сам стирает данные сайта, который вы не открывали семь дней.',
        'Чтобы продолжить на другом устройстве, откройте [настройки](#/settings) и нажмите «Перенести на другое устройство»: платформа покажет ссылку, которую нужно открыть на втором устройстве в течение 15 минут. Кнопка «Выгрузить прогресс» сохраняет прогресс в файл, который служит и запасной копией, а на другом устройстве этот файл загружают кнопкой «Загрузить прогресс». Раз в неделю платформа напоминает о выгрузке одной строкой вверху страницы.',
      ),
      p(
        'The platform does not ask you to sign up. Finished lessons, answers, chosen levels and your messages to the author are written to this browser’s storage on this computer after every action, and the site has no “Save” button. Progress is not sent to the platform’s server, so in another browser or on another device everything starts from a clean slate. Progress is lost if you study in a private window or clear the site’s data, and Safari also erases the data of a site you have not opened for seven days.',
        'To continue on another device, open [Settings](#/settings) and press “Transfer to another device”: the platform shows a link to open on the second device within 15 minutes. The “Export progress” button saves progress to a file that also serves as a backup, and on the other device the file is loaded with “Import progress”. Once a week the platform reminds you about the export with one line at the top of the page.',
      ),
    ),
    sec(
      'lab',
      bi('Лаборатория на своём компьютере', 'A lab on your own computer'),
      p(
        'Для уроков и экзаменов на настоящих машинах не обязательно арендовать серверы в облаке. Программа dtlab бесплатно запускает на вашем компьютере виртуальные машины профессии DevOps-инженера: машину ученика для экзаменов по Linux и сетям, чистые узлы Ubuntu, на которых вы собираете Kubernetes через kubeadm, и готовый кластер kuberoot для блоков о выкладке и мониторинге. Тот же dtlab раздаёт сайт с вашего компьютера, так что всё работает без интернета, а когда машины больше не нужны, одной командой убирает их за собой. Что нужно компьютеру и как поставить лабораторию на Windows, macOS и Linux, рассказано на странице [«Лаборатория на своём компьютере»](#/local-lab).',
      ),
      p(
        'Lessons and exams on real machines do not require renting servers in a cloud. The dtlab program runs the DevOps engineer profession’s virtual machines on your computer for free: a learner machine for the Linux and Networks exams, bare Ubuntu nodes on which you build Kubernetes with kubeadm, and a ready kuberoot cluster for the blocks about deploys and monitoring. The same dtlab serves the site from your computer, so everything works without the internet, and when the machines are no longer needed it removes them with one command. What the computer needs and how to install the lab on Windows, macOS and Linux is told on the page [“A lab on your own computer”](#/local-lab).',
      ),
    ),
    sec(
      'devices',
      bi('Телефон и компьютер', 'Phone and computer'),
      p(
        'Теорию, схемы, вопросы, повторение и задания в симуляторе можно проходить на телефоне: на узком экране страница перестраивается, а широкая схема прокручивается внутри своей рамки. Настоящий Linux во вкладке требует памяти, ведь каждая машина занимает в браузере втрое больше своей оперативной памяти и ещё около 60 МБ на сам эмулятор. Поэтому на устройстве, где браузер сообщает о 4 ГБ памяти и больше, машина запускается сама, а в остальных случаях платформа показывает кнопку запуска с размером загрузки. Сколько машин поместится в одну вкладку, тоже зависит от памяти: одна на слабом телефоне, две на обычном ноутбуке и четыре на компьютере с 8 ГБ и больше. Экзамены на настоящих машинах и лаборатория dtlab рассчитаны на компьютер.',
      ),
      p(
        'Theory, diagrams, questions, review and simulator tasks work on a phone: on a narrow screen the page reflows, and a wide diagram scrolls inside its own frame. Real Linux in the tab needs memory, since each machine takes three times its own RAM in the browser plus about 60 MB for the emulator itself. So on a device whose browser reports 4 GB of memory or more, the machine starts by itself, and otherwise the platform shows a start button with the download size. How many machines fit into one tab also depends on memory: one on a weak phone, two on an ordinary laptop and four on a computer with 8 GB or more. The exams on real machines and the dtlab lab are meant for a computer.',
      ),
    ),
  ],
};

// ── Как это устроено ──

const HOW: AboutPageDef = {
  id: 'how',
  nav: bi('Как это устроено', 'How it is built'),
  title: bi('Как устроена платформа', 'How the platform is built'),
  lede: bi(
    'Эта страница написана для любопытных учеников и для инженеров, которые хотят понять, что на самом деле работает у них в браузере, когда они набирают команду в терминале профессии или играют в симулятор отдела. Платформа устроена как статический сайт без собственного сервера приложений. В профессии DevOps-инженера практика идёт на машинах трёх видов, а деловые курсы обходятся без машин: их уроки написаны в Markdown, а симуляторы работают через нейросеть, которую выбираете вы.',
    'This page is written for curious learners and engineers who want to understand what actually runs in their browser when they type a command in the profession’s terminal or play a department simulator. The platform is a static site without an application server of its own. Practice in the DevOps engineer profession uses three kinds of machines, while business courses need no machines: their lessons are written in Markdown and their simulators use an AI of your choice.',
  ),
  sections: [
    sec(
      'tiers',
      bi('Три вида машин', 'Three kinds of machines'),
      p(
        'Первый вид составляют симуляторы, написанные на TypeScript. Они запускаются мгновенно, работают на любом устройстве, включая телефон, и позволяют показать на схеме каждое внутреннее событие. Второй вид — настоящий Linux, который эмулятор v86 запускает внутри вкладки браузера: это настоящее ядро и настоящие программы, но для них нужен компьютер с запасом памяти. Третий вид — настоящие виртуальные машины в вашем облаке или на вашем компьютере, без которых не обойтись там, где нужен 64-битный Linux и настоящий Kubernetes. В интерфейсе эти три вида называются «в симуляторе», «на настоящем Linux в браузере» и «на настоящих машинах».',
        'Все три вида машин подчиняются одному интерфейсу. Урок не знает, что у него за машиной: он даёт команды, получает вывод и спрашивает у машины факты о её состоянии. Схема ниже показывает, как эти части связаны. Нажмите на любой элемент схемы, и под ней откроется карточка с его объяснением.',
      ),
      p(
        'The first kind are simulators written in TypeScript. They start instantly, run on any device, a phone included, and let a diagram show every internal event. The second kind is real Linux that the v86 emulator boots inside the browser tab: a real kernel and real programs, but they need a computer with spare memory. The third kind are real virtual machines in your cloud or on your computer, which cannot be avoided where 64-bit Linux and real Kubernetes are needed. The interface calls these three kinds “in the simulator”, “on real Linux in the browser” and “on real machines”.',
        'All three kinds of machines obey one interface. A lesson does not know what machine is behind it: it gives commands, gets output and asks the machine for facts about its state. The diagram below shows how these parts are connected. Press any element of the diagram, and a card with its explanation opens under it.',
      ),
    ),
    sec(
      'sims',
      bi('Симуляторы на TypeScript', 'Simulators in TypeScript'),
      p(
        'Симуляторы профессии воспроизводят поведение настоящих инструментов, а не их вывод. Каждый из них моделирует состояние системы и меняет его по тем же правилам, что и оригинал.',
        '- **«Стенд»** моделирует Linux: файловую систему с инодами, правами и владельцами, пользователей и группы, таблицу процессов, подмножество bash с кавычками, перенаправлениями, переменными и скриптами, systemd, а также модель ядра с пространствами имён, cgroups v2 и capabilities.\n- **sim-net** моделирует сеть по событиям: интерфейсы и маршруты iproute2, netfilter с iptables и nft, NAT, ARP, TCP, иерархию DNS, HTTP с nginx и TLS. Задержка пакета в нём складывается из пути и пропускной способности линии, и результат всегда воспроизводим.\n- **dsim** моделирует Docker: образы из слоёв в хранилище с адресацией по содержимому, кэш сборки, сети контейнеров поверх sim-net, Compose и реестр образов платформы.\n- **kube-lite** моделирует Kubernetes: хранилище объектов с подпиской на изменения, API-сервер с проверкой и допуском объектов, контроллеры с настоящими циклами согласования, планировщик, kubelet на узлах, сеть подов, kube-proxy, CoreDNS и kubectl. В нём работают RBAC с проверкой `kubectl auth can-i`, StatefulSet с порядковыми именами подов и томами, а релизы Helm хранятся в секретах, как в настоящем Helm.\n- **flowlab** моделирует поток работы команды на доске Kanban для блока методологии: задачи, очереди, выкладки и инциденты.\n- Симуляторы **Ansible** и **Terraform** выполняют инвентарь, модули, роли и обработчики Ansible, а для Terraform читают настоящий HCL, строят план, ведут состояние и показывают дрейф.',
        'У симуляторов есть пределы, и описания движков в репозитории перечисляют их без прикрас. Например, kube-lite не исполняет шаблоны Go в чартах Helm и не реализует агрегацию ролей RBAC. Там, где поведения модели не хватает, урок переходит на настоящий Linux или на настоящие машины.',
      ),
      p(
        'The profession’s simulators reproduce the behaviour of the real tools, not their output. Each of them models the state of a system and changes it by the same rules as the original.',
        '- **“Stand”** models Linux: a filesystem with inodes, permissions and owners, users and groups, a process table, a subset of bash with quoting, redirections, variables and scripts, systemd, and a kernel model with namespaces, cgroups v2 and capabilities.\n- **sim-net** is an event-driven network model: iproute2 interfaces and routes, netfilter with iptables and nft, NAT, ARP, TCP, the DNS hierarchy, HTTP with nginx, and TLS. A packet’s delay in it adds up from the path and the link bandwidth, and the result is always reproducible.\n- **dsim** models Docker: images made of layers in content-addressed storage, the build cache, container networks on top of sim-net, Compose and the platform’s image registry.\n- **kube-lite** models Kubernetes: an object store with watches, an API server with validation and admission, controllers with real reconcile loops, a scheduler, kubelets on the nodes, pod networking, kube-proxy, CoreDNS and kubectl. RBAC works in it with `kubectl auth can-i`, StatefulSets get ordinal pod names and volumes, and Helm releases are stored in Secrets, as in real Helm.\n- **flowlab** models a team’s flow of work on a Kanban board for the methodology block: tasks, queues, deploys and incidents.\n- The **Ansible** and **Terraform** simulators run Ansible inventories, modules, roles and handlers, and for Terraform read real HCL, build a plan, keep state and show drift.',
        'The simulators have limits, and the engine descriptions in the repository name them plainly: kube-lite, for example, does not execute Go templates in Helm charts and does not implement RBAC role aggregation. Where the model’s behaviour is not enough, the lesson moves to real Linux or to real machines.',
      ),
    ),
    sec(
      'v86',
      bi('Настоящий Linux во вкладке', 'Real Linux in the tab'),
      p(
        'Эмулятор v86 — это компьютер с 32-битным процессором x86, написанный на JavaScript и WebAssembly. Он исполняет настоящие машинные инструкции, поэтому внутри работает настоящее ядро Linux 6.18 и настоящие программы: OpenSSH, nginx, iproute2, nftables и iptables, dnsmasq, tcpdump, LVM, parted, git, curl и OpenTofu. Каждая машина работает в своём Web Worker, то есть в отдельном потоке браузера, и не тормозит страницу.',
        'Образ системы платформа собирает сама из Alpine Linux, без Docker и без Linux-машины для сборки. Скрипт сборки скачивает индексы пакетов с официального зеркала Alpine, проверяет их подпись ключом Alpine, проверяет каждый пакет по контрольной сумме из подписанного индекса и записывает всё скачанное в манифест с адресом, хешем SHA-256 и лицензией. Корневая файловая система подключается к машине по протоколу 9p, и эмулятор скачивает файлы только тогда, когда система к ним обращается. Отдельный образ установщика позволяет пройти установку системы на пустой диск: разметку, файловые системы, загрузчик и перезагрузку в собственную систему.',
        'Загрузка с нуля занимает в браузере около полуминуты, поэтому при сборке сайта машины один раз загружаются в браузере без окна и сохраняются в снимки. Снимок загрузки весит около 19 МБ в сжатом виде, и благодаря снимкам две машины сетевого урока после перезагрузки страницы готовы к работе за 12 секунд, тогда как загрузка с нуля занимает у них больше минуты. После восстановления машина получает своё имя, MAC-адрес и ключи SSH, поэтому несколько машин из одного снимка не путаются друг с другом. Состояние вашей машины платформа сохраняет в хранилище браузера после каждой выполненной цели, и в следующий раз вы продолжаете с того места, где остановились.',
      ),
      p(
        'The v86 emulator is a computer with a 32-bit x86 processor written in JavaScript and WebAssembly. It executes real machine instructions, so inside it runs the real Linux kernel 6.18 and real programs: OpenSSH, nginx, iproute2, nftables and iptables, dnsmasq, tcpdump, LVM, parted, git, curl and OpenTofu. Each machine runs in its own Web Worker, that is, a separate browser thread, and does not slow the page down.',
        'We build the system image ourselves from Alpine Linux, with no Docker and no Linux build machine. The build script downloads the package indexes from Alpine’s official mirror, verifies their signature with Alpine’s key, checks every package against the checksum in the signed index, and records everything downloaded in a manifest with its URL, SHA-256 hash and licence. The root filesystem is attached to the machine over the 9p protocol, and the emulator downloads files only when the system reads them. A separate installer image lets the learner install a system onto an empty disk: partitioning, filesystems, a bootloader and a reboot into their own system.',
        'A boot from scratch takes about half a minute in a browser, so when the site is built, the machines are booted once in a headless browser and saved as snapshots. A boot snapshot weighs about 19 MB compressed, and thanks to snapshots the two machines of the networking lesson are ready 12 seconds after a page reload, while booting them from scratch takes more than a minute. After the restore a machine gets its own name, MAC address and SSH keys, so several machines made from one snapshot do not get mixed up. The platform saves the state of your machine in the browser’s storage after every goal you complete, and next time you continue where you stopped.',
      ),
    ),
    sec(
      'net',
      bi('Сеть, облако и Git внутри вкладки', 'The network, the cloud and Git inside the tab'),
      p(
        'Машины во вкладке соединены коммутатором платформы. Это настоящий коммутатор второго уровня, а не концентратор: он запоминает, за каким портом находится какой MAC-адрес, забывает старые записи, рассылает широковещательные кадры и разделяет виртуальные сети 802.1Q. Для урока о том, зачем коммутатору таблица адресов, его можно одним переключателем превратить в концентратор. Каждое решение коммутатора попадает на схему, поэтому схема рисует трафик настоящих ядер.',
        'К тому же коммутатору подключён узел лаборатории. Это сетевой узел, написанный на TypeScript и работающий в странице, с адресом 10.0.0.1. Он отвечает на ARP и ping, маршрутизирует пакеты между подсетями и держит собственный стек TCP/IP, на котором работают DHCP, DNS для зоны `.lab`, HTTP и зеркало пакетов `mirror.lab`.',
        'На этом узле работает учебное облако по адресу `api.cloud.lab`. У него REST API по описанию OpenAPI, как у настоящих облаков: проекты, ключи доступа, сети, подсети, группы безопасности, виртуальные машины, диски, балансировщик нагрузки, DNS и хранилище объектов, совместимое с S3. Запрос на создание машины запускает новую настоящую машину v86 и подключает её к коммутатору, а квоты, асинхронные операции и состояния машины ведут себя так же, как в настоящем облаке. Для этого облака мы написали на Go провайдер Terraform под названием `lab`. Провайдер лежит в образе машины вместе с OpenTofu, поэтому `tofu init`, `plan`, `apply` и `destroy` работают без интернета, а состояние Terraform можно хранить в хранилище объектов облака с блокировкой.',
        'Рядом работает сервер Git `git.lab` с протоколом smart HTTP, который понимает любой клиент Git. Он принимает `clone`, `fetch` и `push`, отказывает в push, который переписал бы историю, и хранит репозитории в браузере. После каждого push срабатывают вебхуки и запускается конвейер из `.gitlab-ci.yml` на рабочей машине ученика, так что связка «коммит, конвейер, `terraform apply`» проходит целиком внутри вкладки.',
      ),
      p(
        'The machines in the tab are connected by the platform’s switch. It is a real layer-2 switch, not a hub: it learns which MAC address sits behind which port, forgets old entries, floods broadcast frames and keeps 802.1Q virtual networks apart. For the lesson on why a switch needs an address table, one toggle turns it into a hub. Every decision of the switch reaches the diagram, so the diagram draws the traffic of real kernels.',
        'The lab host is plugged into the same switch. It is a network host written in TypeScript that runs in the page, with the address 10.0.0.1. It answers ARP and ping, routes packets between subnets and has its own TCP/IP stack, on which DHCP, DNS for the `.lab` zone, HTTP and the package mirror `mirror.lab` run.',
        'This host serves the training cloud at `api.cloud.lab`. It has a REST API described in OpenAPI, like real clouds: projects, access keys, networks, subnets, security groups, virtual machines, disks, a load balancer, DNS and S3-compatible object storage. A request to create a machine boots a new real v86 machine and connects it to the switch, and quotas, asynchronous operations and machine states behave as in a real cloud. For this cloud we wrote a Terraform provider in Go named `lab`. The provider sits in the machine image next to OpenTofu, so `tofu init`, `plan`, `apply` and `destroy` work without the internet, and Terraform state can be kept in the cloud’s object storage with locking.',
        'Next to it runs the Git server `git.lab` with the smart HTTP protocol that every Git client speaks. It accepts `clone`, `fetch` and `push`, refuses a push that would rewrite history, and keeps repositories in the browser. After every push, webhooks fire and the pipeline from `.gitlab-ci.yml` starts on the learner’s workstation, so the chain “commit, pipeline, `terraform apply`” runs entirely inside the tab.',
      ),
    ),
    sec(
      'real',
      bi('Настоящие машины: dtlab и kuberoot', 'Real machines: dtlab and kuberoot'),
      p(
        'Эмулятор v86 исполняет только 32-битные программы, а Kubernetes, containerd и Cilium собираются только для 64-битных процессоров. Поэтому второй этап Kubernetes, выкладка в кластер, GitOps и мониторинг идут на настоящих виртуальных машинах. Их можно взять у любого облачного провайдера или запустить на своём компьютере программой dtlab.',
        'dtlab написан на Go и запускает машины через QEMU с аппаратной виртуализацией: KVM на Linux, Hypervisor.framework на Mac, платформу низкоуровневой оболочки Windows или Hyper-V на Windows. Он запускает машину ученика, чистые узлы Ubuntu 24.04 для сборки кластера через kubeadm и узел [kuberoot](' + KUBEROOT_REPO + '). kuberoot — это дистрибутив Kubernetes со своим ядром, установщиком и API узла, собранный для amd64 и arm64. dtlab ставит его на диск машины через этот API и выдаёт готовый kubeconfig. Все машины находятся в одной сети 10.10.1.0/24, все данные лаборатории лежат в одном каталоге, и команда `dtlab uninstall` убирает с компьютера всё, что лаборатория когда-либо добавила, и проверяет, что ничего не осталось.',
      ),
      p(
        'The v86 emulator runs only 32-bit programs, while Kubernetes, containerd and Cilium are built only for 64-bit processors. So the second Kubernetes stage, deploying to a cluster, GitOps and monitoring run on real virtual machines. They can be taken from any cloud provider or run on your own computer with the dtlab program.',
        'dtlab is written in Go and runs machines through QEMU with hardware virtualisation: KVM on Linux, Hypervisor.framework on a Mac, the Windows Hypervisor Platform or Hyper-V on Windows. It brings up the learner machine, bare Ubuntu 24.04 nodes for building a cluster with kubeadm, and a [kuberoot](' + KUBEROOT_REPO + ') node. kuberoot is a Kubernetes distribution with its own kernel, installer and node API, built for amd64 and arm64. dtlab installs it onto the machine’s disk through that API and hands out a ready kubeconfig. All machines sit in one network, 10.10.1.0/24, all the lab’s data is in one directory, and `dtlab uninstall` removes everything the lab ever added to the computer and checks that nothing is left.',
      ),
    ),
    sec(
      'rv64',
      bi('Собственный 64-битный движок RV64', 'Our own 64-bit engine, RV64'),
      p(
        'Чтобы настоящий Kubernetes заработал прямо во вкладке, нужен 64-битный эмулятор. Мы пишем его сами: это эмулятор процессора RISC-V 64 (RV64GC с виртуальной памятью Sv39) на Rust, скомпилированный в WebAssembly, с JIT-компилятором, который переводит часто исполняемые участки гостевого кода в модули WebAssembly. RISC-V выбран потому, что его набор инструкций мал и регулярен, а Debian и Alpine уже собираются под эту архитектуру.',
        'Движок экспериментальный и на платформе пока не используется. На сегодня он загружает ядро Linux 6.18 до оболочки Alpine в Chromium, проходит 173 теста из набора riscv-tests и совпадает со всеми 266 эталонными сигнатурами набора riscv-arch-test. JIT ускорил тест CoreMark в 4,4 раза по сравнению с интерпретатором того же движка. Узел kuberoot на нём загружается, но за 15 минут не доходит до состояния Ready, и поиск узкого места продолжается. Когда движок уложится в бюджет скорости, то есть восстановит узел из снимка за 5 секунд и запустит под за 3 секунды, первый этап Kubernetes перейдёт с модели на настоящий кластер во вкладке, а модель останется для слабых устройств.',
      ),
      p(
        'For real Kubernetes to run in the tab itself, a 64-bit emulator is needed. We are writing one: an emulator of the RISC-V 64 processor (RV64GC with Sv39 virtual memory) in Rust, compiled to WebAssembly, with a JIT compiler that translates frequently executed parts of the guest code into WebAssembly modules. RISC-V was chosen because its instruction set is small and regular, and Debian and Alpine already build for this architecture.',
        'The engine is experimental and not used on the platform yet. Today it boots the Linux 6.18 kernel to an Alpine shell in Chromium, passes 173 tests of the riscv-tests suite and matches all 266 reference signatures of the riscv-arch-test suite. The JIT made CoreMark 4.4 times faster than the same engine’s interpreter. A kuberoot node boots on it but does not reach the Ready state within 15 minutes, and the search for the bottleneck goes on. Once the engine meets the speed budget, that is, restores a node from a snapshot in 5 seconds and starts a pod in 3 seconds, the first Kubernetes stage will move from the model to a real cluster in the tab, and the model will stay for weak devices.',
      ),
    ),
    sec(
      'business',
      bi('Деловые курсы: уроки в Markdown и симуляторы отделов', 'Business courses: Markdown lessons and department simulators'),
      p(
        'Уроки деловых курсов лежат в репозитории обычными файлами Markdown на русском и английском. В тексте файла пометки в HTML-комментариях отмечают начало урока, его разделы, вопросы проверки и места, куда встают тренажёры и схемы, а загрузчик платформы при сборке превращает такие файлы в уроки. Поэтому урок можно поправить в любом текстовом редакторе, ничего не зная о TypeScript.',
        'Тренажёры с готовыми правилами считают ответ в браузере. Симулятор отдела устроен как один большой запрос к нейросети: платформа собирает его из общих правил игры, описания мира со скрытыми обстоятельствами, описания вашей компании из конструктора и сценария отдела, а броски кубиков заранее вычисляет генератором случайных чисел с записанным зерном. Нейросеть ведёт партию и после каждого хода записывает состояние в отдельный блок, чтобы игру можно было продолжить. Если ключ нейросети подключён в настройках, запросы уходят из браузера к выбранному провайдеру, а без ключа тот же запрос копируется для любого чата.',
      ),
      p(
        'Business course lessons are stored in the repository as ordinary Markdown files in Russian and English. Markers in HTML comments identify the start of a lesson, its sections, review questions and the places where trainers and diagrams belong. The platform’s loader turns these files into lessons at build time. This means you can edit a lesson in any text editor without knowing TypeScript.',
        'Trainers with predefined rules calculate answers in the browser. A department simulator is built as one large AI prompt: the platform assembles it from shared game rules, a world description with hidden circumstances, your company’s description from the builder and a department scenario. Dice rolls are calculated in advance with a random number generator using a recorded seed. The AI runs the session and writes the state into a separate block after each turn so the game can be resumed. If an AI key is connected in Settings, requests go from the browser to the chosen provider; without a key, the same prompt is copied for use in any chat.',
      ),
    ),
    sec(
      'checks',
      bi('Как платформа проверяет задания', 'How the platform checks tasks'),
      p(
        'Платформа никогда не сравнивает набранную вами команду с образцом. Каждая машина, будь то симулятор, v86 или настоящая виртуальная машина, по запросу отдаёт факты о своём состоянии в одном формате `dt.facts/v1`: файлы с правами и владельцами, процессы, вывод последней команды, пользователей, объекты Kubernetes. Цель урока записана как условие над этими фактами, например «у файла `/srv/index.html` режим 0644» или «в пространстве имён `prod` три готовых пода». Линтер платформы не пропускает цель, которая читает набранный текст, а не результат.',
        'Поэтому одну и ту же цель можно проверить в симуляторе, на настоящем Linux и на настоящей машине без переписывания, а любой верный способ решения засчитывается. Для машин вне браузера факты собирает скрипт `trainer-check.sh`, который ничего не меняет и который можно прочитать перед запуском. Он встраивает в свой вывод одноразовый код попытки, чтобы вывод нельзя было взять из чужой попытки.',
      ),
      p(
        'The platform never compares the command you typed with a sample. Every machine, be it a simulator, v86 or a real virtual machine, gives facts about its state on request in one format, `dt.facts/v1`: files with permissions and owners, processes, the output of the last command, users, Kubernetes objects. A lesson’s goal is written as a condition over these facts, for example “the file `/srv/index.html` has mode 0644” or “the namespace `prod` has three ready pods”. The platform’s linter rejects a goal that reads the typed text instead of the result.',
        'So one goal can be checked in the simulator, on real Linux and on a real machine without rewriting, and any correct way of solving it counts. For machines outside the browser the facts are collected by the script `trainer-check.sh`, which changes nothing and can be read before it is run. It embeds the attempt’s one-time code into its output, so the output cannot be taken from someone else’s attempt.',
      ),
    ),
    sec(
      'offline',
      bi('Работа без сети', 'Working offline'),
      p(
        'Платформа устроена как приложение, которое браузер хранит у себя (PWA). После первого визита рабочий процесс браузера, Service Worker, сохраняет оболочку сайта, все уроки, симуляторы и встроенную документацию, и сайт открывается без сети. Образы настоящего Linux весят сотни мегабайт, поэтому они сохраняются при первом использовании или кнопкой в разделе «Офлайн» [настроек](#/settings). Новая версия платформы не подменяет страницу посреди урока, а ждёт, пока вы нажмёте «Обновить» или перейдёте к другому уроку.',
      ),
      p(
        'The platform is built as an application the browser keeps (a PWA). After the first visit the browser’s background worker, the Service Worker, saves the site shell, every lesson, the simulators and the built-in documentation, and the site opens without a network. The real Linux images weigh hundreds of megabytes, so they are saved on first use or by a button in the “Offline” section of [Settings](#/settings). A new version of the platform does not swap the page in the middle of a lesson but waits until you press “Update” or move to another lesson.',
      ),
    ),
    sec(
      'privacy',
      bi('Что платформа знает о вас', 'What the platform knows about you'),
      p(
        'Прогресс хранится только в вашем браузере, в журнале событий IndexedDB, и на сервер платформы не уходит. Аккаунтов, cookie для слежки и сторонних счётчиков на платформе нет. На сервер уходят только сообщения, которые вы сами отправили кнопками «Сообщить о проблеме» и «Написать автору», и перед отправкой вы видите всё, что уйдёт. Платформа заранее скрывает в выводе терминала то, что похоже на пароли и ключи, но проверить предпросмотр всё равно стоит. Чтобы вы могли прочитать ответ без аккаунта, каждое сообщение получает случайный ключ, который хранится в вашем браузере, а сервис обратной связи хранит только его хеш.',
        'Ключ вашей нейросети, если вы его подключили, шифруется в браузере ключом, который нельзя извлечь, и никогда не попадает ни в выгрузку прогресса, ни в сообщения автору. Запросы к нейросети идут из браузера к выбранному провайдеру, и сервер платформы их не видит.',
      ),
      p(
        'Progress is kept only in your browser, in an IndexedDB event log, and is not sent to the platform’s server. The platform has no accounts, no tracking cookies and no third-party counters. Only the messages you send yourself with “Report a problem” and “Contact the author” reach the server, and before sending you see everything that goes. The platform hides what looks like passwords and keys in the terminal output beforehand, but the preview is still worth checking. So that you can read a reply without an account, every message gets a random key kept in your browser, and the feedback service stores only its hash.',
        'Your AI key, if you connected one, is encrypted in the browser with a key that cannot be extracted, and never goes into a progress export or into messages to the author. Requests to the AI go from the browser to the chosen provider, and the platform’s server does not see them.',
      ),
    ),
  ],
};

// ── Развернуть у себя ──

const DEPLOY: AboutPageDef = {
  id: 'deploy',
  nav: bi('Развернуть у себя', 'Run it yourself'),
  title: bi('Как развернуть платформу у себя', 'How to run the platform yourself'),
  lede: bi(
    'Компания или школа может поставить учебную платформу на свой сервер: например, чтобы учить новых сотрудников во внутренней сети, вести группы со своими ответами на вопросы учеников или проводить занятия в классе без интернета. Сегодня в составе платформы идут профессия DevOps-инженера и восемь деловых курсов, а устройство каталога позволяет добавлять другие курсы и профессии. Лицензия Apache-2.0 это разрешает, а для работы платформы достаточно обычного веб-сервера. Установочные пакеты под разные операционные системы и сборки с выбранным набором курсов пока готовятся: сейчас развёртывание ставит платформу целиком, а учебные стенды на своих компьютерах ученики поднимают через лабораторию dtlab по странице «Лаборатория на своём компьютере».',
    'A company or a school can put the learning platform on its own server: for example, to teach new employees inside the internal network, to run groups with its own answers to learners’ questions, or to hold classes without the internet. Today the platform ships with the DevOps engineer profession and eight business courses, and the catalog is built so that other courses and professions can be added. The Apache-2.0 licence allows it, and an ordinary web server is enough for the platform to work. Installers for different operating systems and builds with a chosen set of courses are being prepared: for now the deployment installs the whole platform, and learners raise training stands on their own computers with the dtlab lab described on the “A lab on your own computer” page.',
  ),
  sections: [
    sec(
      'parts',
      bi('Из чего состоит установка', 'What an installation consists of'),
      p(
        'Обязательная часть у установки одна, и это статический сайт, то есть каталог файлов, который отдаёт любой веб-сервер. Прогресс учеников хранится в их браузерах, поэтому базы данных и сервера приложений сайт не требует. Вторая часть необязательна: это сервис обратной связи из каталога `service/feedback`, который принимает сообщения учеников и показывает их администратору. Без него кнопка «Сообщить о проблеме» держит сообщения в очереди браузера и никуда их не отправляет.',
      ),
      p(
        'Only one part is required: the static site, that is, a directory of files that any web server can serve. Learners’ progress is kept in their browsers, so the site needs neither a database nor an application server. The second part is optional: the feedback service from the `service/feedback` directory, which receives learners’ messages and shows them to an administrator. Without it, the “Report a problem” button keeps messages in the browser’s queue and sends them nowhere.',
      ),
    ),
    sec(
      'build',
      bi('Как собрать сайт', 'How to build the site'),
      p(
        'Для сборки нужны Node.js с npm, Go (на нём собирается провайдер Terraform, который кладётся в образ машины) и доступ в интернет: сборка скачивает пакеты npm, эмулятор v86, пакеты Alpine и OpenTofu и проверяет каждый скачанный файл по хешу. Сборка идёт из каталога `web`:',
        code('bash', 'cd web', 'npm ci', 'npx playwright install chromium   # один раз: снимки делаются в браузере без окна', 'node scripts/fetch-v86.mjs         # BIOS и ядро v86, проверка SHA-256', 'npm run build:lab-image            # образ Alpine из подписанных пакетов, нужен Go', 'npm run build:lab-snapshots        # снимки загрузки машин', 'VITE_FEEDBACK_URL=https://trainer.example.ru/api/feedback npm run build'),
        'Готовый сайт оказывается в каталоге `web/dist`. Образы машин занимают в нём около 265 МБ. Если пропустить сборку образа и снимков, уроки в симуляторе будут работать, а уроки на настоящем Linux не запустятся. Переменная `VITE_FEEDBACK_URL` задаёт адрес сервиса обратной связи; если её не задать, сообщения учеников останутся в их браузерах. Необязательная переменная `VITE_AUTHOR_EMAIL` добавляет в форму «Написать автору» ссылку на почту. Секреты в переменные `VITE_*` класть нельзя, потому что они попадают в код страницы.',
      ),
      p(
        'The build needs Node.js with npm, Go (it builds the Terraform provider that goes into the machine image) and internet access: the build downloads npm packages, the v86 emulator, Alpine packages and OpenTofu, and checks every downloaded file against its hash. The build runs from the `web` directory:',
        code('bash', 'cd web', 'npm ci', 'npx playwright install chromium   # once: snapshots are made in a headless browser', 'node scripts/fetch-v86.mjs         # v86 BIOS and kernel, SHA-256 checked', 'npm run build:lab-image            # the Alpine image from signed packages, needs Go', 'npm run build:lab-snapshots        # boot snapshots of the machines', 'VITE_FEEDBACK_URL=https://trainer.example.com/api/feedback npm run build'),
        'The finished site ends up in `web/dist`. The machine images take about 265 MB of it. If you skip building the image and the snapshots, simulator lessons work, but lessons on real Linux do not start. The variable `VITE_FEEDBACK_URL` sets the address of the feedback service; without it, learners’ messages stay in their browsers. The optional variable `VITE_AUTHOR_EMAIL` adds an e-mail link to the “Contact the author” form. Secrets must never go into `VITE_*` variables, because they end up in the page’s code.',
      ),
    ),
    sec(
      'nginx',
      bi('Веб-сервер и заголовки изоляции', 'The web server and the isolation headers'),
      p(
        'Эмулятору v86 нужна общая память между потоками браузера (`SharedArrayBuffer`), а браузер даёт её только странице, изолированной от чужих сайтов. Поэтому веб-сервер должен отправлять с каждым ответом два заголовка, а третий полезно добавить для надёжности:',
        code('nginx', 'add_header Cross-Origin-Opener-Policy "same-origin" always;', 'add_header Cross-Origin-Embedder-Policy "require-corp" always;', 'add_header Cross-Origin-Resource-Policy "same-origin" always;'),
        'Готовая конфигурация nginx лежит в репозитории в файлах `deploy/nginx.conf` и `deploy/headers.conf`. В nginx директива `add_header` внутри `location` отменяет заголовки уровня `server`, поэтому файл с заголовками подключается в каждый `location`. Там же настроено кэширование: файлы сборки с хешем в имени, файлы образа с адресацией по содержимому и снимки загрузки хранятся у браузера год, а `index.html`, `sw.js` и манифесты браузер перепроверяет при каждом визите, чтобы ученики вовремя получали новую версию платформы. Платформа работает по HTTPS; без него браузер не включит ни Service Worker, ни изоляцию страницы, кроме адреса `localhost`.',
      ),
      p(
        'The v86 emulator needs memory shared between browser threads (`SharedArrayBuffer`), and the browser gives it only to a page isolated from other sites. So the web server must send two headers with every response, and a third one is worth adding for safety:',
        code('nginx', 'add_header Cross-Origin-Opener-Policy "same-origin" always;', 'add_header Cross-Origin-Embedder-Policy "require-corp" always;', 'add_header Cross-Origin-Resource-Policy "same-origin" always;'),
        'A ready nginx configuration is in the repository: `deploy/nginx.conf` and `deploy/headers.conf`. In nginx, an `add_header` inside a `location` cancels the headers of the `server` level, so the headers file is included in every `location`. The same files set up caching: build files with a hash in the name, content-addressed image files and boot snapshots are kept by the browser for a year, while `index.html`, `sw.js` and the manifests are revalidated on every visit, so learners get a new version of the platform in time. The platform is served over HTTPS; without it, the browser turns on neither the Service Worker nor page isolation, except on `localhost`.',
      ),
    ),
    sec(
      'feedback',
      bi('Сервис обратной связи', 'The feedback service'),
      p(
        'Сервис обратной связи — это одна программа на Go, которая хранит сообщения в SQLite или, если нужно, в Postgres. Он принимает сообщения учеников по адресу `/api/feedback`, а по адресу `/admin` показывает администратору страницу для разбора сообщений: фильтры по блоку, уроку и статусу, ответы ученикам, заметки и выгрузку в JSON. Собрать и запустить его можно так:',
        code('bash', 'cd service/feedback', 'go test ./...', 'go build -o dt-feedback .', "ADMIN_TOKEN='длинное-случайное-значение' ALLOWED_ORIGINS=https://trainer.example.ru ./dt-feedback"),
        'Основные переменные окружения перечислены ниже, а полный список с описанием уведомлений по почте и в Telegram есть в `service/feedback/README.md`.',
        '- `ADDR` задаёт адрес и порт, по умолчанию `127.0.0.1:6101`.\n- `DATABASE_URL` указывает файл SQLite (по умолчанию `feedback.sqlite`) или строку подключения `postgres://…`.\n- `ALLOWED_ORIGINS` перечисляет через запятую точные адреса сайтов платформы, с которых сервис принимает сообщения.\n- `ADMIN_TOKEN` задаёт пароль администратора. На странице `/admin` вводят имя `token` и этот пароль, а скрипты передают его в заголовке `Authorization: Bearer`. Вместо него можно задать пару `ADMIN_USER` и `ADMIN_PASSWORD`.\n- `REPORT_LIMIT_PER_HOUR` и `FOLLOW_LIMIT_PER_HOUR` ограничивают число сообщений и чтений переписки с одного адреса в час. Если перед сервисом стоит прокси, который скрывает адреса учеников, эти ограничения становятся общими для всех.\n- `BUILD_ID` подставляет номер выпуска в поле «исправлено в версии».',
        'SQLite требует одной копии сервиса и постоянного каталога для записи. Если нужно несколько копий, используйте Postgres. Резервную копию сообщений проще всего снять через выгрузку: `curl -H "Authorization: Bearer $ADMIN_TOKEN" https://trainer.example.ru/admin/export?format=jsonl`. Сервис сам сообщения не удаляет, поэтому срок их хранения задаёт ваша политика. Журнал запросов к `/api/feedback` на прокси лучше выключить, потому что в адресах переписки передаётся ключ доступа к ней, а страницу `/admin` стоит открыть только для сети администраторов.',
      ),
      p(
        'The feedback service is one Go program that keeps messages in SQLite or, if needed, in Postgres. It receives learners’ messages at `/api/feedback`, and at `/admin` it shows an administrator a page for working through them: filters by block, lesson and status, replies to learners, notes and a JSON export. To build and start it:',
        code('bash', 'cd service/feedback', 'go test ./...', 'go build -o dt-feedback .', "ADMIN_TOKEN='a-long-random-value' ALLOWED_ORIGINS=https://trainer.example.com ./dt-feedback"),
        'The main environment variables are listed below; the full list, including e-mail and Telegram notifications, is in `service/feedback/README.md`.',
        '- `ADDR` sets the address and port, `127.0.0.1:6101` by default.\n- `DATABASE_URL` names an SQLite file (`feedback.sqlite` by default) or a `postgres://…` connection string.\n- `ALLOWED_ORIGINS` lists, comma-separated, the exact addresses of the platform sites the service accepts messages from.\n- `ADMIN_TOKEN` sets the administrator’s password. On the `/admin` page you enter the user name `token` and this password, and scripts send it in an `Authorization: Bearer` header. Instead, the pair `ADMIN_USER` and `ADMIN_PASSWORD` can be set.\n- `REPORT_LIMIT_PER_HOUR` and `FOLLOW_LIMIT_PER_HOUR` limit the number of messages and thread reads per address per hour. If the service sits behind a proxy that hides learners’ addresses, these limits become shared by everyone.\n- `BUILD_ID` fills the release number into the “fixed in version” field.',
        'SQLite needs a single copy of the service and a persistent writable directory. For several copies, use Postgres. The easiest backup of the messages is the export: `curl -H "Authorization: Bearer $ADMIN_TOKEN" https://trainer.example.com/admin/export?format=jsonl`. The service never deletes messages by itself, so your policy sets how long they are kept. The proxy’s request log for `/api/feedback` is best turned off, because thread addresses carry the key to the thread, and the `/admin` page should be open only to the administrators’ network.',
      ),
    ),
    sec(
      'k8s',
      bi('Пример для Kubernetes', 'A Kubernetes example'),
      p(
        'В репозитории лежат два готовых примера. Файл `deploy/devops-trainer.yaml` описывает установку, на которой работает публичная версия платформы: две копии nginx с сайтом, сервис обратной связи, Ingress и сертификат от cert-manager. Скрипт `deploy/build/build.sh` собирает образы внутри кластера, а `deploy/README.md` описывает выкладку, откат и резервные копии. Файл `service/feedback/kubernetes.yaml` показывает сервис обратной связи с постоянным томом. Сокращённо установка выглядит так:',
        code(
          'yaml',
          'apiVersion: apps/v1',
          'kind: Deployment',
          'metadata: {name: web, namespace: devops-trainer}',
          'spec:',
          '  replicas: 2',
          '  selector: {matchLabels: {app: web}}',
          '  template:',
          '    metadata: {labels: {app: web}}',
          '    spec:',
          '      securityContext: {runAsNonRoot: true, runAsUser: 101}',
          '      containers:',
          '        - name: web',
          '          image: registry.example.ru/devops-trainer-web:1.0  # nginx-unprivileged с web/dist и deploy/*.conf',
          '          ports: [{name: http, containerPort: 8080}]',
          '          readinessProbe: {httpGet: {path: /healthz, port: http}}',
          '          resources: {requests: {cpu: 20m, memory: 32Mi}, limits: {memory: 128Mi}}',
          '---',
          'apiVersion: apps/v1',
          'kind: Deployment',
          'metadata: {name: feedback, namespace: devops-trainer}',
          'spec:',
          '  replicas: 1            # SQLite: одна копия, для нескольких нужен Postgres',
          '  strategy: {type: Recreate}',
          '  selector: {matchLabels: {app: feedback}}',
          '  template:',
          '    metadata: {labels: {app: feedback}}',
          '    spec:',
          '      securityContext: {runAsNonRoot: true, runAsUser: 65532, fsGroup: 65532}',
          '      containers:',
          '        - name: feedback',
          '          image: registry.example.ru/devops-trainer-feedback:1.0  # service/feedback/Dockerfile',
          '          env:',
          "            - {name: ADDR, value: ':6101'}",
          '            - {name: DATABASE_URL, value: /data/feedback.sqlite}',
          "            - {name: ALLOWED_ORIGINS, value: 'https://trainer.example.ru'}",
          '          envFrom: [{secretRef: {name: feedback-secrets}}]   # ADMIN_TOKEN',
          '          volumeMounts: [{name: data, mountPath: /data}]',
          '          readinessProbe: {httpGet: {path: /healthz, port: 6101}}',
          '          resources: {requests: {cpu: 20m, memory: 32Mi}, limits: {memory: 256Mi}}',
          '      volumes:',
          '        - {name: data, persistentVolumeClaim: {claimName: feedback-data}}',
        ),
        'К этому добавляются два объекта Service, том `feedback-data` и Ingress, который отправляет `/` в `web`, а `/api/feedback` и `/admin` в `feedback`. Секрет с паролем администратора создают отдельной командой и в репозиторий не кладут: `kubectl create secret generic feedback-secrets --from-literal=ADMIN_TOKEN=…`.',
      ),
      p(
        'The repository has two ready examples. The file `deploy/devops-trainer.yaml` describes the installation the public version of the platform runs on: two nginx replicas with the site, the feedback service, Ingress and a certificate from cert-manager. The script `deploy/build/build.sh` builds the images inside the cluster, and `deploy/README.md` describes rollout, rollback and backups. The file `service/feedback/kubernetes.yaml` shows the feedback service with a persistent volume. In short, the installation looks like this:',
        code(
          'yaml',
          'apiVersion: apps/v1',
          'kind: Deployment',
          'metadata: {name: web, namespace: devops-trainer}',
          'spec:',
          '  replicas: 2',
          '  selector: {matchLabels: {app: web}}',
          '  template:',
          '    metadata: {labels: {app: web}}',
          '    spec:',
          '      securityContext: {runAsNonRoot: true, runAsUser: 101}',
          '      containers:',
          '        - name: web',
          '          image: registry.example.com/devops-trainer-web:1.0  # nginx-unprivileged with web/dist and deploy/*.conf',
          '          ports: [{name: http, containerPort: 8080}]',
          '          readinessProbe: {httpGet: {path: /healthz, port: http}}',
          '          resources: {requests: {cpu: 20m, memory: 32Mi}, limits: {memory: 128Mi}}',
          '---',
          'apiVersion: apps/v1',
          'kind: Deployment',
          'metadata: {name: feedback, namespace: devops-trainer}',
          'spec:',
          '  replicas: 1            # SQLite: one copy; several need Postgres',
          '  strategy: {type: Recreate}',
          '  selector: {matchLabels: {app: feedback}}',
          '  template:',
          '    metadata: {labels: {app: feedback}}',
          '    spec:',
          '      securityContext: {runAsNonRoot: true, runAsUser: 65532, fsGroup: 65532}',
          '      containers:',
          '        - name: feedback',
          '          image: registry.example.com/devops-trainer-feedback:1.0  # service/feedback/Dockerfile',
          '          env:',
          "            - {name: ADDR, value: ':6101'}",
          '            - {name: DATABASE_URL, value: /data/feedback.sqlite}',
          "            - {name: ALLOWED_ORIGINS, value: 'https://trainer.example.com'}",
          '          envFrom: [{secretRef: {name: feedback-secrets}}]   # ADMIN_TOKEN',
          '          volumeMounts: [{name: data, mountPath: /data}]',
          '          readinessProbe: {httpGet: {path: /healthz, port: 6101}}',
          '          resources: {requests: {cpu: 20m, memory: 32Mi}, limits: {memory: 256Mi}}',
          '      volumes:',
          '        - {name: data, persistentVolumeClaim: {claimName: feedback-data}}',
        ),
        'Add two Service objects, the `feedback-data` volume and an Ingress that sends `/` to `web` and `/api/feedback` and `/admin` to `feedback`. The Secret with the administrator’s password is created by a separate command and never goes into the repository: `kubectl create secret generic feedback-secrets --from-literal=ADMIN_TOKEN=…`.',
      ),
    ),
    sec(
      'offline',
      bi('Закрытая сеть без интернета', 'A closed network without the internet'),
      p(
        'Собрать платформу в сети без интернета нельзя, потому что сборка скачивает пакеты и проверяет их подписи. Зато собранный каталог `web/dist` от интернета не зависит: его можно собрать один раз на машине с доступом в сеть, перенести в закрытую сеть и раздавать оттуда. Для повторных сборок скрипт образа принимает ключ `--mirror` с адресом внутреннего зеркала Alpine и ключ `--offline`, который берёт пакеты из кэша прошлой сборки. Ученики в такой сети лишаются только того, что требует внешних сайтов: кнопки, которые открывают чаты нейросетей, подключение нейросети внешнего провайдера и ссылки на источники уроков.',
        'Лаборатория dtlab тоже работает в классе без интернета. Образ Ubuntu, kuberoot и kubectl скачиваются один раз, а адрес каждого источника можно заменить на внутреннее зеркало или локальный каталог ключом `--kuberoot` и переменными `DTLAB_KUBEROOT_URL` и `DTLAB_UBUNTU_URL`. Так одну загрузку копируют на все компьютеры класса. Пакеты, которые ученик ставит внутри машин на этапе kubeadm, по-прежнему берутся из интернета, поэтому для этого этапа в закрытой сети нужно зеркало apt и реестр образов.',
      ),
      p(
        'The platform cannot be built in a network without the internet, because the build downloads packages and checks their signatures. The built `web/dist` directory, however, does not depend on the internet: it can be built once on a machine with network access, moved into the closed network and served from there. For later builds the image script takes `--mirror` with the address of an internal Alpine mirror and `--offline`, which takes packages from the previous build’s cache. Learners in such a network lose only what needs external sites: the buttons that open AI chats, connecting an external AI provider and the links to the lessons’ sources.',
        'The dtlab lab also works in a classroom without the internet. The Ubuntu image, kuberoot and kubectl are downloaded once, and every source can be pointed at an internal mirror or a local directory with `--kuberoot` and the variables `DTLAB_KUBEROOT_URL` and `DTLAB_UBUNTU_URL`. This is how one download is copied to every computer of a classroom. The packages a learner installs inside the machines at the kubeadm stage still come from the internet, so in a closed network this stage needs an apt mirror and an image registry.',
      ),
    ),
    sec(
      'branding',
      bi('Своё название, тексты и оформление', 'Your own name, texts and look'),
      p(
        'Название платформы в верхней строке задаётся строкой `course` в файле `web/src/core/i18n.ts`, а остальные надписи интерфейса находятся там же и в файлах `web/src/app/*.ts`. Тексты уроков, схем и заданий лежат в `web/src/blocks/<блок>/`, каждый на двух языках. Цвета светлой и тёмной темы заданы переменными в `web/src/styles/tokens.css`, а шрифты подключены в `web/src/main.ts`. Если вы меняете уроки, запустите `npm test`: линтер проверит, что новые термины не появились раньше урока, который их вводит.',
        'Лицензия Apache-2.0 требует сохранить файл `LICENSE` и указания авторства, а в изменённых файлах отметить, что они изменены. Если вы исправили ошибку или написали урок, который пригодится другим, пришлите изменение в основной репозиторий: так ваша копия не отстанет от основной, а исправление получат все.',
      ),
      p(
        'The platform name in the top bar is set by the `course` string in `web/src/core/i18n.ts`, and the other interface labels are there and in `web/src/app/*.ts`. The texts of lessons, diagrams and tasks are in `web/src/blocks/<block>/`, each in two languages. The colours of the light and dark themes are set by variables in `web/src/styles/tokens.css`, and the fonts are loaded in `web/src/main.ts`. If you change lessons, run `npm test`: the linter checks that new terms do not appear before the lesson that introduces them.',
        'The Apache-2.0 licence requires keeping the `LICENSE` file and the attribution notices, and marking changed files as changed. If you fixed a mistake or wrote a lesson that others could use, send the change to the main repository: that way your copy does not fall behind the main version, and everyone gets the fix.',
      ),
    ),
    sec(
      'resources',
      bi('Сколько нужно ресурсов', 'What resources are needed'),
      p(
        'Серверу платформы нужно немного. Контейнер nginx с сайтом запрашивает 20 милликоров процессора и 32 МиБ памяти при пределе 128 МиБ, а сервис обратной связи запрашивает столько же при пределе 256 МиБ. Место на диске нужно под сайт, около 300 МБ вместе с образами машин, и под базу сообщений, которой хватает тома в 2 ГиБ. Основной трафик создают образы настоящего Linux: машина скачивает файлы по мере обращения к ним, а снимок загрузки весит около 19 МБ, но браузер ученика хранит всё это у себя и при следующих визитах не скачивает заново.',
        'Основная нагрузка ложится на компьютеры учеников. Платформа без настоящих машин работает на компьютере с 4 ГБ памяти. Каждой машине v86 во вкладке нужно втрое больше её собственной памяти и ещё около 60 МБ, то есть машине со 128 МБ нужно около 450 МБ. Для лаборатории dtlab нужно от 8 ГБ памяти в лёгком профиле до 24 ГБ в полном; точные цифры и замеры приведены на странице [«Лаборатория на своём компьютере»](#/local-lab).',
      ),
      p(
        'The platform’s server needs little. The nginx container with the site requests 20 millicores of CPU and 32 MiB of memory with a 128 MiB limit, and the feedback service requests the same with a 256 MiB limit. Disk space is needed for the site, about 300 MB with the machine images, and for the message database, for which a 2 GiB volume is enough. Most of the traffic comes from the real Linux images: a machine downloads files as it reads them, and a boot snapshot weighs about 19 MB, but the learner’s browser keeps all of it and does not download it again on later visits.',
        'The main load falls on the learners’ computers. The platform without real machines runs on a computer with 4 GB of memory. Each v86 machine in the tab needs three times its own memory plus about 60 MB, so a 128 MB machine needs about 450 MB. The dtlab lab needs from 8 GB of memory in the light profile to 24 GB in the full one; the exact numbers and measurements are on the page [“A lab on your own computer”](#/local-lab).',
      ),
    ),
  ],
};

// ── Как поучаствовать ──

const CONTRIBUTE: AboutPageDef = {
  id: 'contribute',
  nav: bi('Как поучаствовать', 'Contributing'),
  title: bi('Как поучаствовать', 'How to contribute'),
  lede: bi(
    'Платформа открыта, и её можно улучшать: исправлять ошибки и неточности, переписывать непонятные места, добавлять задания, схемы, уроки и целые курсы, чинить симуляторы. Эта страница рассказывает, как устроен репозиторий и как оформить изменение, чтобы его можно было быстро принять. То же самое написано в файле `CONTRIBUTING.ru.md` в корне репозитория.',
    'The platform is open and can be improved: by fixing mistakes and inaccuracies, rewriting unclear passages, adding tasks, diagrams, lessons and entire courses, and repairing the simulators. This page tells how the repository is organised and how to shape a change so that it can be accepted quickly. The same is written in `CONTRIBUTING.md` at the root of the repository.',
  ),
  sections: [
    sec(
      'own-course',
      bi('Свой курс, идея курса или заявка на курс', 'Your own course, a course idea or a course request'),
      p(
        'Если у вас есть свой курс, учебные материалы или только идея курса и вы хотите выпустить его на этой платформе, мы поможем бесплатно. Вместе продумаем, чему курс учит и для кого он, соберём исследование и проверим факты, напишем уроки или отредактируем ваши, придумаем практику — задания, схемы, тренажёры и симуляторы, — прогоним курс через вымышленных учеников, которые находят непонятные места до живых людей, и опубликуем его. Авторство остаётся за вами, а курс выходит под той же открытой лицензией, что и вся платформа.',
        'Если готового курса нет, но вам нужен курс на какую-то тему, пришлите заявку: кому он нужен, чему должен научить и почему существующие курсы не подходят. Написать можно кнопкой «Написать автору» внизу любой страницы или в [задаче на GitHub](' + REPO + '/issues/new). Как устроены курсы изнутри, рассказано ниже на этой странице.',
      ),
      p(
        'If you have your own course, teaching material or just an idea for a course and want to publish it on this platform, we will help for free. Together we will work out what the course teaches and for whom, gather the research and check the facts, write the lessons or edit yours, design the practice — tasks, diagrams, trainers and simulators — run the course past fictional learners who find unclear places before real people do, and publish it. You remain the author, and the course is released under the same open licence as the whole platform.',
        'If there is no course yet but you need one on some topic, send a request: who needs it, what it should teach and why existing courses do not fit. You can write with the “Contact the author” button at the bottom of any page or in a [GitHub issue](' + REPO + '/issues/new). How courses are built inside is described further down this page.',
      ),
    ),
    sec(
      'layout',
      bi('Как устроен репозиторий', 'How the repository is organised'),
      p(
        `Вся платформа со всеми профессиями и курсами лежит в одном репозитории [damn-academy/devops-trainer](${REPO}).`,
        '- `web/` содержит само приложение на TypeScript и Vite без UI-фреймворка. В `web/src/core` лежат типы, реестр, маршрутизатор, хранилище и линтер, в `web/src/app` страницы, в `web/src/engine` движки (терминал, схемы, вопросы, документация, симуляторы, v86, нейросеть, офлайн), в `web/src/blocks` содержание блоков, по каталогу на блок, а в `web/tests` и `web/e2e` тесты.\n- `design/` содержит проектную документацию, главный документ в ней `00-DESIGN.ru.md`.\n- `lab/` содержит лабораторию dtlab на Go.\n- `service/feedback/` содержит сервис обратной связи на Go.\n- `tools/terraform-provider-lab/` содержит провайдер Terraform для облака во вкладке.\n- `deploy/` содержит конфигурацию nginx, манифесты Kubernetes и скрипты выкладки.',
        'Блоки и движки подключаются сами: реестр находит их через `import.meta.glob`, поэтому общий список, который нужно править при добавлении блока, отсутствует.',
      ),
      p(
        `The whole platform with all its professions and courses is in one repository, [damn-academy/devops-trainer](${REPO}).`,
        '- `web/` holds the application itself, in TypeScript and Vite without a UI framework. `web/src/core` has the types, registry, router, store and linter, `web/src/app` the pages, `web/src/engine` the engines (terminal, diagrams, questions, documentation, simulators, v86, AI, offline), `web/src/blocks` the content of the blocks, one directory per block, and `web/tests` and `web/e2e` the tests.\n- `design/` holds the design documents; the main one is `00-DESIGN.md`.\n- `lab/` holds the dtlab lab, in Go.\n- `service/feedback/` holds the feedback service, in Go.\n- `tools/terraform-provider-lab/` holds the Terraform provider for the cloud in the tab.\n- `deploy/` holds the nginx configuration, Kubernetes manifests and deployment scripts.',
        'Blocks and engines plug in by themselves: the registry finds them through `import.meta.glob`, so there is no shared list to edit when a block is added.',
      ),
    ),
    sec(
      'run',
      bi('Как запустить курс и тесты', 'How to run the course and the tests'),
      p(
        'Для работы над платформой нужны Node.js и npm, а для лаборатории, сервиса и провайдера ещё Go.',
        code('bash', 'cd web', 'npm ci', 'npm run dev                       # http://localhost:5173 с заголовками изоляции', 'npm run typecheck                 # проверка типов TypeScript', 'npm test                          # модульные тесты и линтер порядка понятий', 'npm run lint:explainers           # проверка текстов схем', 'npx playwright install chromium   # один раз перед первым запуском e2e', 'npm run test:e2e                  # сквозные тесты в браузере'),
        'Тесты на настоящем v86 по умолчанию пропускаются и включаются переменными, например `V86_LAB=1 npx vitest run tests/v86-lab-integration.test.ts`; для них сначала нужно собрать образ командой `npm run build:lab-image`. Программы на Go проверяются командой `go test ./...` в каталогах `lab`, `service/feedback` и `tools/terraform-provider-lab`. Перед отправкой изменения проверка типов, `npm test` и линтеры должны проходить без ошибок.',
      ),
      p(
        'Working on the platform needs Node.js and npm, and the lab, the service and the provider also need Go.',
        code('bash', 'cd web', 'npm ci', 'npm run dev                       # http://localhost:5173 with the isolation headers', 'npm run typecheck                 # TypeScript type check', 'npm test                          # unit tests and the concept-order linter', 'npm run lint:explainers           # checks the texts of the diagrams', 'npx playwright install chromium   # once, before the first e2e run', 'npm run test:e2e                  # end-to-end tests in a browser'),
        'Tests on real v86 are skipped by default and switched on by variables, for example `V86_LAB=1 npx vitest run tests/v86-lab-integration.test.ts`; they need the image built first with `npm run build:lab-image`. The Go programs are checked with `go test ./...` in `lab`, `service/feedback` and `tools/terraform-provider-lab`. Before a change is sent, the type check, `npm test` and the linters must pass without errors.',
      ),
    ),
    sec(
      'content',
      bi('Как устроены урок, схема и лаборатория', 'How a lesson, a diagram and a lab are built'),
      p(
        'Все формы данных описаны в `web/src/core/types.ts`, а правила подключения собраны в `web/CONTRACTS.ru.md`. Блок экспортирует модуль через `defineModule` из файла `web/src/blocks/<каталог>/index.ts`: блоки, уроки, понятия, вопросы, схемы, команды, страницы документации и экзамены.',
        '- **Урок** имеет идентификатор вида `<блок>.<название>` и состоит из разделов: `text`, `explainer`, `terminal`, `quiz`, `docs`, `callout` и `widget`. Каждый раздел может быть виден только на некоторых уровнях. Урок перечисляет понятия, которые он вводит (`introduces`) и на которые опирается (`uses`), и каждая строка для ученика задаётся на двух языках через `bi(ru, en)`. Команды, вывод терминала и страницы `man` остаются английскими.\n- **Схема** — это модель процесса, которую создают через `defineModel` и подключают через `fromModel`. У модели не больше двенадцати узлов, у каждой линии есть подпись и карточка, у каждого узла есть карточка, а функция `run` по параметрам возвращает шаги процесса. Рабочий пример лежит в `web/src/blocks/demo/pipe.ts`.\n- **Лаборатория** — это раздел `terminal` с начальным состоянием машины (`setup`) и заданиями. Цель задания записывается как условие над фактами `dt.facts/v1`, например `files[\'/srv/index.html\'].mode=0644`, а поле `fail` даёт объяснения для типичных ошибок. Линтер не пропускает цель, которая читает набранный текст. Задания на настоящем Linux подключаются виджетом `v86.linux` с тем же форматом целей.',
        'К каждому заданию пишется эталонное решение, а тесты прогоняют его на симуляторе и доказывают, что задание решаемо. У каждого урока есть источники на английском и русском языке с настоящими ссылками.',
      ),
      p(
        'Every data shape is described in `web/src/core/types.ts`, and the plug-in rules are collected in `web/CONTRACTS.md`. A block exports a module with `defineModule` from `web/src/blocks/<folder>/index.ts`: blocks, lessons, concepts, questions, diagrams, commands, documentation pages and exams.',
        '- **A lesson** has an id of the form `<block>.<name>` and consists of sections: `text`, `explainer`, `terminal`, `quiz`, `docs`, `callout` and `widget`. Each section can be shown only at some levels. A lesson lists the concepts it introduces (`introduces`) and relies on (`uses`), and every learner-facing string is given in two languages with `bi(ru, en)`. Commands, terminal output and `man` pages stay in English.\n- **A diagram** is a process model created with `defineModel` and plugged in with `fromModel`. A model has at most twelve nodes, every line has a label and a card, every node has a card, and the `run` function returns the steps of the process for the given parameters. The working example is `web/src/blocks/demo/pipe.ts`.\n- **A lab** is a `terminal` section with the machine’s initial state (`setup`) and tasks. A task’s goal is written as a condition over `dt.facts/v1` facts, for example `files[\'/srv/index.html\'].mode=0644`, and the `fail` field gives explanations for typical mistakes. The linter rejects a goal that reads the typed text. Tasks on real Linux plug in with the `v86.linux` widget and the same goal format.',
        'Every task comes with a reference solution, and the tests run it on the simulator to prove that the task can be solved. Every lesson has sources in English and Russian with real links.',
      ),
    ),
    sec(
      'style',
      bi('Как писать текст', 'How to write the text'),
      p(
        'Русский текст профессий и курсов подчиняется руководству `web/STYLE-RU.md`, и его правила служат условиями приёмки. Мы пишем полными связными предложениями, без рубленых фраз, без пустых слов-усилителей, без калек с английского и без канцелярита, а примеры всех запретов собраны в самом руководстве. Каждый термин вводится до того, как им пользуются, и называется одинаково в тексте, на схеме и в вопросах. Пример в уроке может опираться только на то, что ученик уже прошёл на маршруте.',
        'Три линтера помогают держать эти правила. Линтер порядка понятий запускается вместе с `npm test` и не пропускает термин, который встретился раньше вводящего его урока. Команда `npm run lint:explainers` проверяет все тексты, которые может показать схема. Скрипт `node scripts/lint-ru-style.mjs <блок>` ищет в русских строках обрывки, предложения на двоеточии вместо глагола и кальки. Последние два линтера эвристические, поэтому каждую находку стоит прочитать глазами, а перед сдачей страницу нужно открыть в браузере и просмотреть.',
      ),
      p(
        'The Russian text of the professions and courses follows the guide `web/STYLE-RU.md`, and its rules are acceptance conditions. We write in full, connected sentences, without chopped phrases, empty intensifiers, calques from English or officialese, and the guide itself collects examples of every ban. Every term is introduced before it is used and is called the same in the text, on the diagram and in the questions. An example in a lesson may rely only on what the learner has already covered on the route.',
        'Three linters help keep these rules. The concept-order linter runs with `npm test` and rejects a term that appears before the lesson that introduces it. `npm run lint:explainers` checks every text a diagram can show. The script `node scripts/lint-ru-style.mjs <block>` looks for fragments, sentences built on a colon instead of a verb, and calques in Russian strings. The last two linters are heuristic, so every finding is worth reading by eye, and before handing in, the page must be opened in a browser and looked through.',
      ),
    ),
    sec(
      'issues',
      bi('Как сообщить об ошибке', 'How to report a problem'),
      p(
        `Ошибку в тексте, схеме или задании удобнее всего отправить с сайта кнопкой «Сообщить о проблеме» или выделив текст и нажав «Комментировать»: сообщение само укажет место на сайте и приложит вывод терминала. Ответ появится на странице [«Мои сообщения»](#/messages). Ошибки в коде, предложения по устройству платформы и всё, что касается лаборатории dtlab и сервиса обратной связи, лучше описать в [задаче на GitHub](${REPO}/issues): что вы делали, что ожидали увидеть и что увидели на самом деле, а также браузер и систему.`,
        'Поучаствовать можно и другими способами. Пришлите идею курса или профессии — поможем сделать её на этом движке. Если у вас есть готовый учебный материал, который хотелось бы куда-то выложить, напишите автору через форму обратной связи внизу любой страницы. Платформа некоммерческая и ничего не продаёт: это попытка делиться знаниями с людьми, которым они нужны, а не изобретение очередного стандарта. Со временем появится механика, которая позволит поддержать проект донатом.',
      ),
      p(
        `A mistake in a text, a diagram or a task is easiest to send from the site with “Report a problem”, or by selecting the text and pressing “Comment”: the message names the place on the site by itself and attaches the terminal output. The reply appears on the [“My messages”](#/messages) page. Bugs in the code, proposals about how the platform works, and everything about the dtlab lab and the feedback service are better described in a [GitHub issue](${REPO}/issues): what you did, what you expected to see and what you actually saw, plus the browser and the system.`,
        'There are other ways to take part. Send an idea for a course or a profession — we will help build it on this engine. If you have teaching material of your own that you would like to publish, write to the author through the feedback form at the bottom of any page. The platform is non-commercial and sells nothing: it is an attempt to share knowledge with people who need it, not another standard. Over time a way to support the project with a donation will appear.',
      ),
    ),
    sec(
      'pr',
      bi('Как оформить изменение', 'How to shape a change'),
      p(
        'Изменение присылают запросом на слияние (pull request) из отдельной ветки, а не в `main`. Сообщение коммита пишется по-английски в формате semantic commits: `type(scope): описание`, где тип — один из `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `perf` и `build`, например `fix(linux): explain why chmod needs the x bit on directories`. Каждый коммит подписывается ключом `--signoff`, который добавляет строку `Signed-off-by` и подтверждает, что вы вправе передать этот код под лицензией проекта.',
        'В описании запроса на слияние расскажите, что изменилось и зачем, а для изменений в интерфейсе или в схемах приложите снимки экрана на ширине 1440 и 390 пикселей. Одно изменение должно решать одну задачу: исправление опечатки и новый урок лучше прислать отдельно. Весь публичный текст в репозитории, то есть код, комментарии, коммиты и описания запросов, пишется по-английски, а русский остаётся в текстах уроков и в файлах с окончанием `.ru.md`.',
      ),
      p(
        'Changes are sent as a pull request from a separate branch, not to `main`. The commit message is written in English in the semantic commits format: `type(scope): description`, where the type is one of `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `perf` and `build`, for example `fix(linux): explain why chmod needs the x bit on directories`. Every commit is signed off with `--signoff`, which adds a `Signed-off-by` line and certifies that you have the right to contribute the code under the project’s licence.',
        'In the pull request description, tell what changed and why, and for changes to the interface or the diagrams attach screenshots at 1440 and 390 pixels wide. One change should solve one problem: a typo fix and a new lesson are better sent separately. All public text in the repository, that is, code, comments, commits and pull request descriptions, is written in English, while Russian stays in lesson texts and in files ending in `.ru.md`.',
      ),
    ),
    sec(
      'license',
      bi('Лицензия', 'Licence'),
      p(
        'Платформа распространяется по лицензии Apache-2.0, и всё, что вы присылаете, принимается под той же лицензией. Сторонние компоненты сохраняют свои лицензии: эмулятор v86 распространяется по лицензии BSD-2-Clause, пакеты Alpine и ядро Linux по своим лицензиям, которые скрипт сборки образа записывает в манифест рядом с каждым скачанным файлом.',
      ),
      p(
        'The platform is distributed under the Apache-2.0 licence, and everything you send is accepted under the same licence. Third-party components keep their licences: the v86 emulator is under BSD-2-Clause, and Alpine packages and the Linux kernel are under their own licences, which the image build script records in the manifest next to each downloaded file.',
      ),
    ),
  ],
};


// ── Наши проекты ──

const PROJECTS: AboutPageDef = {
  id: 'projects',
  nav: bi('Наши проекты', 'Our projects'),
  title: bi('Другие наши проекты', 'Our other projects'),
  lede: bi(
    'damn.academy делают люди, у которых есть и другие проекты: серьёзные, несерьёзные и чаще всего что-то посередине. Если вам интересно, как ещё можно рассказывать о технике, музыке и истории, загляните к соседям.',
    'damn.academy is made by people who also make other things: serious ones, silly ones, and mostly something in between. If you wonder how else one can tell stories about technology, music and history, visit the neighbours.',
  ),
  sections: [
    sec(
      "sankofa",
      bi("Sankofa", "Sankofa"),
      "Музей семи веков чёрной культуры и большие мультимедийные спецпроекты о ней: музыка, кино, фотография. А ещё Sankofa — дистрибутив Kubernetes, на котором этот музей и работает. [sankofa.black](https://sankofa.black)",
      "A museum of seven centuries of Black culture and long multimedia special projects about it: music, film, photography. Sankofa is also a Kubernetes distribution, and the museum runs on it. [sankofa.black](https://sankofa.black)",
    ),
    sec(
      "dormer",
      bi("Dormer", "Dormer"),
      "Большие мультимедийные истории о музыке, живописи и ароматах: Sonic Youth и серый скаковой конь, Франсуаза Арди и Боб Дилан, «Девочка на шаре» Пикассо, двадцать один шаг от Terre d'Hermès до парфюмерного терроризма. [dormer.sankofa.black](https://dormer.sankofa.black)",
      "Long multimedia stories about music, painting and smell: Sonic Youth and a grey racehorse, Françoise Hardy and Bob Dylan, Picasso's Young Acrobat on a Ball, twenty-one steps from Terre d'Hermès to perfume terrorism. [dormer.sankofa.black](https://dormer.sankofa.black)",
    ),
    sec(
      "sncf",
      bi("Sheet-Native Computing Foundation", "Sheet-Native Computing Foundation"),
      "Независимый дом Sheet-Native Computing: Kubernetes, Prometheus, реестр контейнеров и Doom, которые работают внутри электронных таблиц. С сертификацией. [sncfoundation.github.io](https://sncfoundation.github.io)",
      "The vendor-neutral home for Sheet-Native Computing: Kubernetes, Prometheus, a container registry and Doom, all running inside spreadsheets. With certification. [sncfoundation.github.io](https://sncfoundation.github.io)",
    ),
    sec(
      "paleo",
      bi("Paleocomputing", "Paleocomputing"),
      "Экспериментальная археология вычислительных систем, в которой компьютеры, которых больше нет, запускают по-настоящему. Оберон на настоящем Verilog Вирта, самораскрутка компилятора, измерения и лабораторные в браузере. [tym83.github.io/paleocomputing](https://tym83.github.io/paleocomputing/)",
      "Experimental archaeology of computing: machines that no longer exist, run for real. Oberon on Wirth's own Verilog, a self-hosting compiler, measurements and labs in the browser. [tym83.github.io/paleocomputing](https://tym83.github.io/paleocomputing/)",
    ),
  ],
};

export const ABOUT_PAGES: AboutPageDef[] = [WHAT, USE, HOW, DEPLOY, CONTRIBUTE, PROJECTS];

export const ABOUT_TITLE = bi('Справка', 'Help');
