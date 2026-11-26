// Career lessons after the search: the first three months at a new job, and
// how on-call works at a real employer (rotation, escalation, pay, what to
// ask before signing).

import { bi } from '../../core/i18n';
import type { Lesson, QuizItem } from '../../core/types';

const SRC = {
  sreOncall: { title: 'Google SRE Book — Being On-Call', url: 'https://sre.google/sre-book/being-on-call/' },
  sreWorkbook: { title: 'Google SRE Workbook — On-Call', url: 'https://sre.google/workbook/on-call/' },
  pagerduty: { title: 'PagerDuty Incident Response — Being On-Call', url: 'https://response.pagerduty.com/oncall/being_oncall/' },
  impostor: { title: 'Impostor syndrome — Wikipedia', url: 'https://en.wikipedia.org/wiki/Impostor_syndrome' },
  impostorRu: { title: 'Синдром самозванца — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%A1%D0%B8%D0%BD%D0%B4%D1%80%D0%BE%D0%BC_%D1%81%D0%B0%D0%BC%D0%BE%D0%B7%D0%B2%D0%B0%D0%BD%D1%86%D0%B0' },
  smart: { title: 'Eric S. Raymond — How To Ask Questions The Smart Way', url: 'https://www.catb.org/~esr/faqs/smart-questions.html' },
  tkRu: { title: 'Трудовой кодекс РФ — КонсультантПлюс', url: 'https://www.consultant.ru/document/cons_doc_LAW_34683/' },
  habrDuty: { title: 'Первое дежурство DevOps-инженера (Хабр)', url: 'https://habr.com/ru/articles/960968/' },
};

export const FIRST_JOB_QUIZ: QuizItem[] = [
  {
    id: 'career.q.ask-when',
    kind: 'mcq',
    concepts: ['career.ask'],
    prompt: bi('Вторая неделя на новой работе. Вы сорок минут разбираетесь, почему конвейер не может скачать образ из реестра, перечитали журнал и документацию, а ответа нет. Что разумнее всего сделать?', 'Your second week at a new job. For forty minutes you have been working out why the pipeline cannot pull an image from the registry; you reread the log and the documentation, and there is no answer. What is the most sensible thing to do?'),
    options: [
      { id: 'ask', text: bi('Написать в канал команды, что делаете, что проверили, точный текст ошибки и где застряли', 'Write to the team channel what you are doing, what you have checked, the exact error text and where you are stuck'), correct: true },
      { id: 'silent', text: bi('Продолжать самому до конца дня, чтобы никто не заметил, что вы чего-то не знаете, а вечером разобраться по документации', 'Keep going alone until the end of the day so that nobody notices you do not know something, and read the docs in the evening'), why: bi('Так поступают многие новички, потому что боятся, что вопрос выдаст нехватку знаний. Но команда ждёт от новичка вопросов, а молчаливый день над задачей, которую коллега объяснил бы за пять минут, обходится ей дороже вопроса. В систему компании новичок не может разобраться без чужих подсказок: часть ответов есть только в головах коллег.', 'Many newcomers do this because they fear a question will expose a gap. But the team expects questions from a newcomer, and a silent day on a task a colleague would explain in five minutes costs it more than the question. A newcomer cannot learn the company’s system without hints: some answers exist only in colleagues’ heads.') },
      { id: 'dm', text: bi('Написать самому опытному инженеру в личные сообщения одно слово «Помоги» и ждать, пока он сам спросит подробности', 'Send the most experienced engineer a private message with one word, “Help”, and wait until they ask you for the details themselves'), why: bi('Из такого сообщения не видно, что вы уже проверили, поэтому разговор начнётся с расспросов. К тому же в личной переписке ответ увидит только один человек, а в общем канале на него может ответить любой свободный коллега, и ответ останется для следующего новичка.', 'Such a message does not show what you have already checked, so the conversation starts with questions. Besides, in a private chat only one person sees it, while in the team channel any free colleague can answer, and the answer stays for the next newcomer.') },
      { id: 'sudo', text: bi('Попробовать подряд все команды, которые нашлись в поиске, в том числе с sudo на рабочем сервере, пока ошибка не пропадёт', 'Try every command the search turned up, including those with sudo on the production server, until the error goes away'), why: bi('Незнакомая команда с sudo на рабочем сервере опаснее любого вопроса. Первое, чего ждут от новичка, — не нажать лишнего там, где работают пользователи.', 'An unfamiliar command with sudo on a production server is more dangerous than any question. The first thing a newcomer is expected to do is not to press anything extra where users work.') },
    ],
    explain: bi('Сначала ищите сами и заранее ограничьте время поиска, а потом спрашивайте так, чтобы из вопроса было видно, что вы делали, что увидели и чего ожидали.', 'First look on your own with a time limit set in advance, then ask so that the question shows what you did, what you saw and what you expected.'),
  },
  {
    id: 'career.q.impostor',
    kind: 'mcq',
    concepts: ['career.impostor'],
    prompt: bi('Через месяц работы вам кажется, что все в команде знают больше и что вас взяли по ошибке. Какой вывод верен?', 'A month into the job you feel that everyone on the team knows more and that you were hired by mistake. Which conclusion is right?'),
    options: [
      { id: 'evidence', text: bi('Решение о найме принимали инженеры после технического интервью, и проверить, справляетесь ли вы, можно по фактам: по списку сделанного за месяц и по разговору с руководителем', 'Engineers made the hiring decision after a technical interview, and whether you cope can be checked against facts: the list of what you did this month and a talk with your manager'), correct: true },
      { id: 'luck', text: bi('Предложение было везением, и скоро это откроется', 'The offer was luck, and soon it will come out'), why: bi('Везение не проходит несколько этапов собеседования, на которых разные люди проверяли разные вещи. Ощущение самозванца бывает почти у всех новичков, особенно у тех, кто сменил профессию, но ощущение не доказательство.', 'Luck does not pass several interview stages where different people checked different things. Almost every newcomer feels like an impostor, especially those who changed careers, but a feeling is not evidence.') },
      { id: 'hide', text: bi('Нужно меньше спрашивать, чтобы никто не заметил пробелов', 'You should ask less so that nobody notices the gaps'), why: bi('Пробелы у новичка видят все, и их ждут. Коллеги замечают не сами пробелы, а то, становятся ли ваши вопросы от недели к неделе сложнее. Если вы молчите, коллеги не видят ни пробелов, ни того, как вы их закрываете.', 'Everyone sees a newcomer’s gaps and expects them. What is noticed is whether the questions grow from week to week. Silence hides not the gaps but your progress.') },
    ],
  },
  {
    id: 'career.q.burnout',
    kind: 'mcq',
    concepts: ['method.wip'],
    prompt: bi('Третий месяц вы устаёте к обеду. На доске у вас одновременно в работе семь карточек, вас дважды за неделю будили ночью, а план меняют каждые два дня. Где искать причину в первую очередь?', 'For the third month you are tired by lunch. You have seven cards in progress on the board at once, you were woken twice at night this week, and the plan changes every two days. Where should you look for the cause first?'),
    options: [
      { id: 'org', text: bi('В том, как устроена работа: в числе задач, которые идут одновременно, в переключениях и в ночных вызовах без отдыха. Об этом стоит поговорить с руководителем, назвав числа', 'In how the work is organised: the number of tasks in progress at once, the switching and the night calls without rest. It is worth talking to your manager about it, with the numbers'), correct: true },
      { id: 'weak', text: bi('В себе, потому что вы, видимо, не годитесь для этой профессии', 'In yourself: it means you are not cut out for this profession'), why: bi('Семь задач одновременно, частые переключения и ночные вызовы утомят любого инженера, и в блоке о методологии вы видели, как незавершённая работа замедляет весь поток. Это свойства организации работы, а не человека.', 'Seven tasks at once, constant switching and night calls would tire any engineer, and in the methodology block you saw how work in progress slows the whole flow. These are properties of how work is organised, not of the person.') },
      { id: 'more', text: bi('В том, что вы мало работаете по вечерам', 'In not working enough in the evenings'), why: bi('Вечерняя работа добавит часов, но не уберёт переключений и ночных вызовов, поэтому усталость только вырастет.', 'Evening work adds hours but removes neither the switching nor the night calls, so the tiredness only grows.') },
    ],
  },
];

export const L_FIRST_JOB: Lesson = {
  id: 'career.first-job',
  block: 'career',
  title: bi('Первые три месяца на новой работе', 'The first three months at a new job'),
  summary: bi('Чего ждут от начинающего инженера, как задавать вопросы коллегам, что делать с ощущением, что вас взяли по ошибке, и как отличить усталость от плохо устроенной работы.', 'What is expected of a junior engineer, how to ask colleagues questions, what to do with the feeling that you were hired by mistake, and how to tell tiredness from badly organised work.'),
  introduces: ['career.impostor', 'career.ask'],
  uses: ['method.toil', 'method.automation', 'method.wip', 'career.retro'],
  tier: 'core',
  minutes: 25,
  sources: { en: [SRC.smart, SRC.impostor], ru: [SRC.impostorRu, SRC.habrDuty] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Вы получили предложение о работе, и через две недели выходите в команду. Многие в этот момент ловят себя на мысли, что их взяли по ошибке и что скоро это откроется. Этот урок о том, чего на самом деле ждут от начинающего инженера в первые три месяца, как задавать вопросы, чтобы их было удобно получать, и что делать с ощущением, будто все вокруг знают больше вас.',
        'You have a job offer, and in two weeks you join the team. Many people catch themselves thinking at this moment that they were hired by mistake and that it will soon come out. This lesson is about what is really expected of a junior engineer in the first three months, how to ask questions that are easy to receive, and what to do with the feeling that everyone around knows more than you.',
      ),
    },
    {
      id: 'expect',
      kind: 'text',
      step: 'explain',
      title: bi('Чего ждут от начинающего инженера', 'What is expected of a junior engineer'),
      body: bi(
        'Никто не ждёт, что вы знаете систему компании, потому что её не знает ни один новый сотрудник, даже очень опытный. От начинающего инженера ждут трёх вещей. Во-первых, от вас ждут базы, на которой можно строить: Linux, сети, контейнеры и всё то, что проверяли на собеседовании. Во-вторых, от вас ждут осторожности. Нельзя выполнять на рабочем сервере команду, смысла которой вы не понимаете, особенно с sudo, и лучше спросить, чем нажать лишнее. Поэтому в первые недели новичка обычно не ставят дежурить одного, а дают ему побыть вторым рядом с опытным дежурным. В-третьих, от вас ждут движения: через месяц вы задаёте другие вопросы, чем в первый день, и делаете без подсказки то, что раньше делали с ней.\n\nПервые задачи почти всегда узкие и рутинные: выдать доступ, продлить сертификат, поправить шаг конвейера, обновить пакет на нескольких серверах. Не обижайтесь на них. Через рутинные задачи вы быстрее всего узнаёте, как устроена система, а ещё в них новичок раньше всего приносит заметную пользу. Напомним понятие из блока о методологии: [[method.toil|рутиной]] называют ручную повторяющуюся работу, которая растёт вместе с сервисом. Если вы сделали одну и ту же рутинную задачу в третий раз, запишите шаги в инструкцию, а потом превратите их в скрипт или в шаг конвейера. Такая [[method.automation|автоматизация]] и есть первая работа, которую замечает команда.',
        'Nobody expects you to know the company’s system, because no new employee knows it, however experienced. A junior engineer is expected to bring three things. The first is a base to build on: Linux, networks, containers and everything checked at the interview. The second is caution. You must not run a command you do not understand on a production server, especially with sudo, and it is better to ask than to press something extra. That is why in the first weeks a newcomer is usually not put on call alone but spends shifts as the second person next to an experienced on-call engineer. The third is movement: a month later you ask different questions than on the first day and do without a hint what you used to do with one.\n\nThe first tasks are almost always narrow and routine: grant access, renew a certificate, fix a pipeline step, update a package on several servers. Do not take offence at them. Routine tasks are the fastest way to learn how the system is built, and they are where a newcomer first brings visible value. A reminder from the methodology block: [[method.toil|toil]] is manual repetitive work that grows with the service. If you have done the same routine task a third time, write the steps down as an instruction, then turn them into a script or a pipeline step. Such [[method.automation|automation]] is the first work the team notices.',
      ),
    },
    {
      id: 'plan',
      kind: 'text',
      step: 'look',
      title: bi('Что делать в каждый из трёх месяцев', 'What to do in each of the three months'),
      body: bi(
        '### Первый месяц\nПолучите доступы и выясните, кто ваш наставник и к кому идти с каким вопросом. Нарисуйте своими руками схему системы: как запрос пользователя проходит от браузера до базы данных и как изменение попадает от коммита на рабочие серверы. Схема получится неполной и с ошибками, и это нормально. Покажите её наставнику, и его исправления расскажут о системе больше, чем любая документация. Делайте первые маленькие изменения через ревью, чтобы коллеги видели, как вы работаете.\n\n### Второй месяц\nБерите задачи, которые вы доводите до конца сами, и выходите на дежурства вторым. После каждой смены исправляйте или дописывайте инструкцию для дежурного там, где она вас подвела: свежий взгляд новичка видит пробелы, которых старожилы уже не замечают.\n\n### Третий месяц\nВ России испытательный срок обычно длится не больше трёх месяцев, и к его концу руководитель решает, оставить ли вас. Не ждите этого дня молча. Ещё в первый месяц спросите, по каким признакам вас будут оценивать, а в третий месяц сами попросите разговор об итогах и придите на него со списком сделанного.',
        '### The first month\nGet your access and find out who your mentor is and whom to go to with which question. Draw the system’s diagram with your own hands: how a user’s request travels from the browser to the database and how a change gets from a commit to the production servers. The diagram will be incomplete and wrong in places, and that is normal. Show it to your mentor: the corrections will tell you more about the system than any documentation. Make your first small changes through review, so that colleagues see how you work.\n\n### The second month\nTake tasks you finish on your own, and go on call as the second person. After each shift fix or extend the runbook where it let you down: a newcomer’s fresh eye sees gaps the old-timers no longer notice.\n\n### The third month\nIn Russia the probation period usually lasts no more than three months, and by its end your manager decides whether to keep you. Do not wait for that day in silence. In the first month already, ask by which signs you will be judged, and in the third month ask for the review talk yourself and come to it with the list of what you have done.',
      ),
    },
    {
      id: 'ask',
      kind: 'text',
      step: 'explain',
      title: bi('Как задавать вопросы коллегам', 'How to ask colleagues questions'),
      body: bi(
        'Многие новички молчат над задачей по полдня, потому что боятся, что вопрос выдаст нехватку знаний. Но команда знает, что новичок многого не знает, и ждёт от него вопросов, а часть ответов вообще нельзя найти в документации, потому что она хранится только в головах коллег. Молчаливый день над задачей, которую коллега объяснил бы за пять минут, обходится команде дороже любого вопроса.\n\nПоэтому сначала ищите сами, но заранее ограничьте время поиска. На мелкий вопрос хватит 15–30 минут, на большую задачу полдня. Пока ищете, записывайте, что пробовали. Если время вышло, задайте [[career.ask|вопрос, на который легко ответить]]. В нём три части: что вы делаете и зачем, что вы уже проверили и что увидели, приложив точный текст ошибки, и чего вы ожидали. Например: «Добавляю шаг сборки образа в конвейер сервиса billing. Шаг падает с ошибкой `denied: requested access to the resource is denied`. Я проверил, что переменная с токеном реестра задана в настройках проекта и что образ с таким именем в реестре есть. Ожидал, что токена хватит для записи. Может быть, у токена нет права писать в этот репозиторий?»\n\nЗадавайте такие вопросы в общем канале команды, а не в личных сообщениях. Там ответит любой свободный коллега, и ответ останется для следующего новичка. Получив ответ, поблагодарите и допишите его в документацию команды, если его там не было.',
        'Many newcomers sit silently over a task for half a day, because they fear a question will expose a gap. That belief is wrong. The team knows a newcomer does not know a lot and expects questions, and some answers cannot be found in the documentation at all, because they exist only in colleagues’ heads. A silent day over a task a colleague would explain in five minutes costs the team more than any question.\n\nSo the rule is: first look on your own, but limit the search time in advance. A small question deserves 15–30 minutes, a big task half a day. While searching, write down what you tried. When the time is up, ask [[career.ask|a question that is easy to answer]]. It has three parts: what you are doing and why, what you have already checked and what you saw, with the exact error text, and what you expected. For example: “I am adding an image build step to the billing service pipeline. The step fails with `denied: requested access to the resource is denied`. I checked that the registry token variable is set in the project settings and that an image with this name exists in the registry. I expected the token to be enough for pushing. Could it be that the token has no write permission for this repository?”\n\nAsk such questions in the team channel, not in private messages. There any free colleague can answer, and the answer stays for the next newcomer. When you get the answer, say thanks and add it to the team’s documentation if it was not there.',
      ),
    },
    { id: 'ask-try', kind: 'quiz', step: 'practice', title: bi('Попробуйте на рабочей ситуации', 'Try it on a work situation'), items: ['career.q.ask-when'] },
    {
      id: 'impostor',
      kind: 'text',
      step: 'explain',
      title: bi('Что делать с ощущением, что вас взяли по ошибке', 'What to do with the feeling that you were hired by mistake'),
      body: bi(
        'Ощущение, что вы оказались на своём месте случайно и вот-вот это откроется, называют [[career.impostor|синдромом самозванца]]. Оно бывает почти у всех в начале новой работы, и особенно часто у тех, кто сменил профессию. Само по себе ощущение ничего не доказывает. Вас взяли после нескольких этапов собеседования, на которых разные инженеры проверяли разные вещи, и везение такую проверку не проходит.\n\nСпорить с ощущением бесполезно, а сверять его с фактами полезно. Ведите короткий список того, что вы сделали за неделю, так же, как вы записывали ретро после каждого собеседования. Через месяц перечитайте первую неделю, и вы увидите, сколько из того, что тогда было непонятно, стало обычной работой. Второй источник фактов дают разговоры с руководителем. На регулярной встрече один на один задавайте конкретный вопрос: «Что мне делать иначе в следующем месяце?» Если ответ укажет на настоящий пробел, это план, а не приговор: вы уже знаете по курсу, как закрыть пробел упражнениями.',
        'The feeling that you got your place by accident and that this is about to come out is called [[career.impostor|impostor syndrome]]. Almost everyone has it at the start of a new job, and especially often those who changed careers. The feeling proves nothing by itself. You were hired after several interview stages where different engineers checked different things, and luck does not pass such a check.\n\nArguing with the feeling is useless, while checking it against facts helps. Keep a short list of what you did each week, the same way you wrote a retro after every interview. A month later reread the first week, and you will see how much of what was unclear then has become ordinary work. The second source of facts is your manager. At a regular one-to-one ask a concrete question: “What should I do differently next month?” If the answer points to a real gap, that is a plan, not a verdict: you already know from the course how to close a gap with practice.',
      ),
    },
    {
      id: 'burnout',
      kind: 'text',
      step: 'explain',
      title: bi('Когда усталость говорит о работе, а не о вас', 'When tiredness speaks about the work, not about you'),
      body: bi(
        'Усталость в первые месяцы обычна, потому что всё вокруг новое и голова работает на пределе. Но если она не проходит неделями, причину часто стоит искать не в себе, а в том, как устроена работа. В блоке о методологии вы измеряли эти причины. Первая из них называется [[method.wip|незавершённой работой]], то есть карточками, которые начаты, но не закончены: когда их у одного человека семь, каждая движется медленно, а голова всё время переключается между ними. К ней добавляются постоянная смена планов, рутина, которую никто не автоматизирует, и ночные вызовы без отдыха на следующий день.\n\nВсё это видно на доске команды и считается числами, поэтому с руководителем лучше говорить числами, а не жалобой: «у меня в работе семь задач, за неделю меня дважды будили ночью, давайте решим, что отложить». На собеседовании о том же можно спросить заранее: сколько задач обычно в работе у одного человека и как часто меняется план. Если же усталость держится неделями и не проходит после отпуска, это повод поговорить не только с руководителем, но и с врачом.',
        'Tiredness in the first months is normal: everything is new, and the head works at its limit. But if it does not pass for weeks, the cause is often not in you but in how the work is organised. In the methodology block you measured these causes. One is [[method.wip|work in progress]], that is, cards started but not finished: when one person has seven, each moves slowly and the head keeps switching between them. Others are constant plan changes, toil nobody automates, and night calls without rest the next day.\n\nAll of this is visible on the team board and is counted in numbers, so talk to your manager in numbers rather than with a complaint: “I have seven tasks in progress, I was woken twice at night this week, let us decide what to put off.” At an interview you can ask about it in advance: how many tasks one person usually has in progress and how often the plan changes. And if the tiredness lasts for weeks and does not pass after a holiday, it is a reason to talk not only to your manager but also to a doctor.',
      ),
    },
    {
      id: 'lvl-e',
      kind: 'callout',
      tone: 'note',
      levels: ['experienced'],
      title: bi('Если вы переходите в DevOps из разработки', 'If you move to DevOps from development'),
      body: bi(
        'Ваше преимущество в том, что вы знаете, как работают разработчики, и говорите с ними на одном языке. Риск в обратном: привычка чинить кодом то, что чинится договорённостью, и желание доказать, что вы уже всё знаете. Задавайте те же вопросы, что и новичок без опыта, потому что система компании для вас так же нова. Если вы переходите внутри своей компании, заранее договоритесь с руководителем о сроке перехода и о том, кто забирает ваши прежние задачи, иначе первые месяцы вы будете работать на двух должностях сразу.',
        'Your advantage is that you know how developers work and speak their language. The risk is the opposite: the habit of fixing with code what is fixed with an agreement, and the wish to prove you already know everything. Ask the same questions a newcomer without experience would, because the company’s system is just as new to you. If you move within your own company, agree with your manager in advance on the date of the move and on who takes over your old tasks, otherwise the first months you will be working two jobs at once.',
      ),
    },
    {
      id: 'course',
      kind: 'text',
      step: 'review',
      title: bi('Как продолжать курс на работе', 'How to keep using the course at work'),
      body: bi(
        'После предложения о работе курс не заканчивается, а меняет роль: теперь он помогает с задачами, которые вы встречаете на работе. Если упал конвейер, вернитесь к блоку о CI/CD и прочитайте журнал так, как учили там. Если истекает сертификат, откройте урок «TLS, HTTPS и SSH» в блоке о сетях. Если заполняется диск, пригодится урок «Диски, файловые системы и монтирование» в блоке Linux, а если алерт будит команду зря, нужен урок «Алерты и Alertmanager» в блоке о мониторинге. Если не работает стенд в Kubernetes, пройдите урок «Вся карта кластера» и ищите поломку по слоям. Десять минут в день на повторение карточек сохранят то, что вы уже знаете, пока работа учит новому.',
        'After the offer the course does not end but changes its role: it now helps with the tasks you meet at work. If a pipeline fails, go back to the CI/CD block and read the log as you were taught there. If a certificate is about to expire, open the lesson on TLS, HTTPS and SSH in the networks block. If a disk is filling up, the lesson on disks, file systems and mounting in the Linux block helps, and if an alert wakes the team for nothing, you need the lesson on alerts and Alertmanager in the monitoring block. If a stand in Kubernetes does not work, go through the lesson “The whole cluster map” and look for the fault layer by layer. Ten minutes a day of card review keeps what you already know while the job teaches you new things.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['career.q.impostor', 'career.q.burnout'] },
  ],
};

export const ONCALL_LIFE_QUIZ: QuizItem[] = [
  {
    id: 'career.q.rotation',
    kind: 'mcq',
    concepts: ['career.rotation'],
    prompt: bi('На финальном собеседовании вам говорят: «Дежурим вдвоём, неделя через неделю, доплаты нет, зато у нас дружная команда». Как это оценить?', 'At the final interview you are told: “Two of us share on-call, every other week, no extra pay, but the team is friendly.” How do you judge this?'),
    options: [
      { id: 'over', text: bi('Это перегрузка, потому что каждый дежурит каждую вторую неделю, запасного нет, а условия не оплачиваются. Стоит спросить, сколько раз будят за неделю и что компания собирается менять', 'This is an overload: each person is on call every other week, there is no backup, and the terms are unpaid. It is worth asking how often people are woken a week and what the company plans to change'), correct: true },
      { id: 'normal', text: bi('Так устроено везде, и терпеть это входит в профессию', 'It is like that everywhere, and putting up with it is part of the job'), why: bi('Не везде. При ротации из двух человек каждый дежурит каждую вторую неделю, и при частых вызовах это быстро выматывает. Google, например, считает минимумом восемь инженеров в одной ротации. Дежурства в профессии есть, но устроены они по правилам, о которых можно договариваться.', 'Not everywhere. With a rotation of two, each person is on call every other week, and with frequent calls that wears people out fast. Google, for example, considers eight engineers the minimum for one rotation. On-call is part of the profession, but it follows rules that can be negotiated.') },
      { id: 'avoid', text: bi('Это неважно, потому что в DevOps можно найти работу совсем без дежурств и ночных вызовов', 'It does not matter: in DevOps you can find a job with no on-call and no night calls at all'), why: bi('Где сервис работает круглые сутки, кто-то за него отвечает и ночью, и чаще всего это инженеры, которые его обслуживают. Бывают команды без ночных дежурств, например при дежурствах по часовым поясам, но строить на этом выбор профессии не стоит.', 'Where a service runs around the clock, someone is responsible for it at night too, and most often it is the engineers who run it. Some teams have no night shifts, for example with follow-the-sun rotations across time zones, but it is not something to base a career choice on.') },
    ],
  },
  {
    id: 'career.q.escalate',
    kind: 'mcq',
    concepts: ['career.escalation'],
    prompt: bi('Ваше третье дежурство. Ночью пришёл алерт о доле ошибок оплаты, вы двадцать минут разбираетесь, а доля ошибок растёт. В инструкции для дежурного такого случая нет. Что правильно?', 'Your third on-call shift. At night an alert about the checkout error ratio arrives; you have spent twenty minutes on it, and the error ratio keeps growing. The runbook has no such case. What is right?'),
    options: [
      { id: 'escalate', text: bi('Эскалировать, то есть позвать запасного дежурного или старшего инженера и написать, что уже проверили', 'Escalate, that is, call the backup on-call or a senior engineer and write what you have already checked'), correct: true },
      { id: 'alone', text: bi('Разбираться одному до утра, чтобы не будить коллег и не показать слабость, а утром рассказать, что получилось', 'Keep working alone until morning so as not to wake colleagues or look weak, and report the outcome in the morning'), why: bi('Эскалация на дежурстве входит в правила, и здесь сошлись оба её повода: влияние на пользователей растёт, а инструкции у вас нет. Запасной дежурный для того и стоит в графике, а от новичка на первых сменах эскалации прямо ждут.', 'Escalating on call is not an admission of weakness but the rule: the impact on users grows, and you have no runbook. The backup engineer is on the schedule for exactly this, and on the first shifts a newcomer is expected to escalate.') },
      { id: 'restart', text: bi('Перезапустить сервис оплаты наугад, в надежде, что после перезапуска ошибки пропадут сами собой', 'Restart the checkout service at random, hoping the errors will go away by themselves after the restart'), why: bi('Перезапуск наугад уничтожает улики, а если причина в выкладке или в сети, после перезапуска ошибки вернутся с первой же волной запросов.', 'A random restart destroys the evidence, and if the cause is a release or the network, the errors come back with the first wave of requests.') },
    ],
  },
];

export const L_ONCALL_LIFE: Lesson = {
  id: 'career.oncall-life',
  block: 'career',
  title: bi('Как устроены дежурства на настоящей работе', 'How on-call works at a real job'),
  summary: bi('Ротация дежурных, эскалация, оплата и отдых после ночи, что считается нормальным и что нет, и какие вопросы о дежурствах задать работодателю до того, как подписать предложение.', 'The on-call rotation, escalation, pay and rest after a night, what is normal and what is not, and which questions about on-call to ask an employer before signing an offer.'),
  introduces: ['career.rotation', 'career.escalation'],
  uses: ['career.oncall', 'method.error-budget', 'method.runbook'],
  tier: 'core',
  minutes: 20,
  sources: { en: [SRC.sreOncall, SRC.sreWorkbook, SRC.pagerduty], ru: [SRC.habrDuty, SRC.tkRu] },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Слово «дежурство» пугает многих, кто идёт в DevOps: кажется, что придётся каждую ночь просыпаться от звонков. Одни думают, что от ночных вызовов в этой профессии можно уйти, другие считают, что их положено терпеть. Оба представления неверны. Дежурства есть почти везде, где сервис работает круглые сутки, но устроены они по правилам, и о правилах можно спросить до того, как вы подпишете предложение о работе.\n\nНапомним, что такое [[career.oncall|смена дежурного]]: в свою смену дежурный инженер принимает алерты, оценивает влияние на пользователей, возвращает сервис и рассказывает команде, что случилось. Технику смены разбирает урок «Смена дежурного», а этот урок о том, как дежурства устроены в компании.',
        'The word “on-call” scares many people going into DevOps: it seems you will be woken by calls every night. Some think night calls can be avoided in this profession, others believe they must be endured. Both beliefs are wrong. On-call exists almost everywhere a service runs around the clock, but it follows rules, and you can ask about the rules before you sign a job offer.\n\nA reminder of what an [[career.oncall|on-call shift]] is: during the shift the on-call engineer takes the alerts, judges the impact on users, restores the service and tells the team what happened. The lesson “The on-call shift” covers the technique of a shift; this lesson is about how on-call is organised in a company.',
      ),
    },
    {
      id: 'rotation',
      kind: 'text',
      step: 'explain',
      title: bi('Ротация и эскалация', 'Rotation and escalation'),
      body: bi(
        'Дежурят по графику, который называют [[career.rotation|ротацией]]: инженеры команды по очереди берут смену, чаще всего на неделю. На смене обычно двое, основной дежурный и запасной. Алерт сначала приходит основному, и если тот не подтвердил его за оговорённое время, например за 15 минут, система оповещения сама звонит запасному, а потом руководителю. Чем больше людей в ротации, тем реже дежурит каждый: в команде из шести человек вы дежурите одну неделю из шести, а в команде из двух каждую вторую. В книге Google о надёжности сервисов минимумом для одной ротации называют восемь инженеров, а нагрузку на смену стараются держать на уровне не больше двух инцидентов за двенадцать часов, чтобы каждый можно было разобрать как следует.\n\nПередачу инцидента тому, кто может больше, называют [[career.escalation|эскалацией]]. Система оповещения эскалирует сама, когда дежурный не ответил, но и сам дежурный эскалирует, когда застрял дольше оговорённого времени, когда влияние на пользователей растёт или когда в [[method.runbook|инструкции для дежурного]] нет нужного случая. Эскалация не признание слабости, а часть правил. От новичка на первых сменах её прямо ждут, а ошибкой считают обратное: час молчаливой борьбы в одиночку, пока пользователи не могут заплатить.',
        'On-call follows a schedule called a [[career.rotation|rotation]]: the team’s engineers take turns on shift, most often for a week. A shift usually has two people, the primary on-call engineer and the backup. An alert first goes to the primary, and if the primary does not acknowledge it within an agreed time, say 15 minutes, the paging system calls the backup itself, then the manager. The more people in the rotation, the less often each is on call: in a team of six you are on call one week in six, and in a team of two every other week. The Google book on site reliability names eight engineers as the minimum for one rotation and tries to keep the load at no more than two incidents per twelve-hour shift, so that each can be reviewed properly.\n\nHanding an incident to someone who can do more is called [[career.escalation|escalation]]. The paging system escalates by itself when the on-call engineer does not answer, but the engineer also escalates when stuck for longer than agreed, when the impact on users grows or when the [[method.runbook|runbook]] has no such case. Escalation is not an admission of weakness but part of the rules. On the first shifts it is expected of a newcomer, and the opposite is considered the mistake: an hour of silent struggle alone while users cannot pay.',
      ),
    },
    {
      id: 'pay',
      kind: 'text',
      step: 'explain',
      title: bi('Оплата и отдых после ночного вызова', 'Pay and rest after a night call'),
      body: bi(
        'Как оплачивать дежурства, решает компания, и способы бывают разные: фиксированная доплата за неделю дежурства, оплата часов, которые вы работали по вызову, отгул после ночи или несколько этих способов сразу. По Трудовому кодексу работа с 22 до 6 часов считается работой в ночное время и оплачивается в повышенном размере, поэтому ночной вызов, на котором вы чинили сервис, тоже работа, а не услуга команде.\n\nНормально, когда условия записаны в трудовом договоре, в положении о дежурствах или хотя бы на странице команды, и когда после ночи, в которую вас будили, можно начать день позже. Ненормально, когда дежурство считается «частью работы» без доплаты и отдыха и когда о нём впервые говорят после выхода на работу.',
        'The company decides how on-call is paid, and the ways differ: a fixed bonus for a week on call, pay for the hours you worked on a call, a day off after a night, or several of these at once. Under the Russian Labour Code, work between 22:00 and 6:00 is night work and is paid at a higher rate, so a night call on which you fixed the service is work too, not a favour to the team.\n\nIt is normal when the terms are written down in the employment contract, in an on-call policy or at least on the team page, and when after a night in which you were woken you can start the day later. It is not normal when on-call is considered “part of the job” with no extra pay and no rest, and when it is first mentioned after you have started.',
      ),
    },
    {
      id: 'normal',
      kind: 'text',
      step: 'look',
      title: bi('Что нормально и что нет', 'What is normal and what is not'),
      body: bi(
        'По этому списку удобно сверять то, что вам рассказали о дежурствах:\n\n- **Нормально**, когда график известен заранее, в ротации не меньше четырёх-пяти человек и у каждой смены есть запасной дежурный.\n- **Нормально**, когда у каждого алерта есть инструкция для дежурного, а каждый ночной вызов разбирают на следующий день.\n- **Нормально**, когда новичок сначала дежурит вторым рядом с опытным инженером.\n- **Ненормально**, когда в ротации двое и каждая вторая неделя проходит на дежурстве.\n- **Ненормально**, когда будят несколько раз за ночь неделями подряд и никто не разбирает почему.\n- **Ненормально**, когда алерт приходит, но сделать по нему нечего: такой алерт считается дефектом мониторинга, и его чинят или убирают.',
        'This list is handy for checking what you were told about on-call:\n\n- **Normal**: the schedule is known in advance, the rotation has at least four or five people, and every shift has a backup.\n- **Normal**: every alert has a runbook, and every night call is reviewed the next day.\n- **Normal**: a newcomer is first on call as the second person next to an experienced engineer.\n- **Not normal**: two people in the rotation, every other week on call.\n- **Not normal**: being woken several times a night for weeks with nobody reviewing why.\n- **Not normal**: an alert arrives, but there is nothing to do about it; such an alert is a monitoring defect and is fixed or removed.',
      ),
    },
    { id: 'normal-try', kind: 'quiz', step: 'practice', title: bi('Оцените условия из настоящего собеседования', 'Judge the terms from a real interview'), items: ['career.q.rotation'] },
    {
      id: 'ask',
      kind: 'text',
      step: 'practice',
      title: bi('Что спросить работодателя о дежурствах', 'What to ask an employer about on-call'),
      body: bi(
        'О дежурствах удобнее всего спросить на финальном разговоре с руководителем, где ваши вопросы особенно ценят. Вот вопросы, ответы на которые стоит получить до того, как вы подпишете предложение:\n\n1. Сколько человек в ротации и как часто дежурит каждый?\n2. Сколько раз в среднем будят за неделю дежурства, и считает ли это команда?\n3. Как оплачивается дежурство и есть ли отдых после ночного вызова?\n4. Есть ли у смены запасной дежурный и кому эскалировать, если вы застряли?\n5. Есть ли инструкции для дежурного и разбирают ли каждый инцидент?\n6. Когда новичка ставят в ротацию и дежурит ли он сначала вторым?\n\nУклончивый ответ на второй вопрос сам по себе ответ: команда, которая не считает ночные вызовы, обычно и не уменьшает их число.',
        'The best place to ask about on-call is the final talk with the manager, where your own questions are especially valued. Here are the questions worth getting answered before you sign an offer:\n\n1. How many people are in the rotation, and how often is each on call?\n2. How often on average are people woken during an on-call week, and does the team count it?\n3. How is on-call paid, and is there rest after a night call?\n4. Does a shift have a backup, and whom do you escalate to when stuck?\n5. Are there runbooks, and is every incident reviewed?\n6. When does a newcomer join the rotation, and are they first on call as the second person?\n\nAn evasive answer to the second question is an answer in itself: a team that does not count night calls usually does not reduce them either.',
      ),
    },
    {
      id: 'budget',
      kind: 'text',
      step: 'explain',
      title: bi('Почему хороший инженер делает так, чтобы будили реже', 'Why a good engineer makes the calls rarer'),
      body: bi(
        'Число ночных вызовов зависит от того, как устроена система, и одна из задач DevOps-инженера состоит в том, чтобы вызовов становилось меньше. Каждый ночной вызов разбирают и задают два вопроса: нужно ли было будить человека и можно ли было обойтись без него. Шумный алерт чинят или убирают, а восстановление, которое дежурный каждый раз делает руками, автоматизируют. За всем этим стоит [[method.error-budget|бюджет ошибок]] из блока о методологии, то есть допустимая доля плохой работы сервиса за срок. Если бюджет исчерпан, команда останавливает выпуски и чинит надёжность, и этот механизм защищает не только пользователей, но и дежурных.',
        'Night calls are not the weather but a property of the system, and part of a DevOps engineer’s work is to make them rarer. Every night call is reviewed with two questions: did a person need to be woken, and could it have been handled without them. A noisy alert is fixed or removed, and a recovery the on-call engineer does by hand every time is automated. Behind all this is the [[method.error-budget|error budget]] from the methodology block, that is, the allowed share of bad service over a period. When the budget is spent, the team stops releases and fixes reliability, and this mechanism protects not only users but also the on-call engineers.',
      ),
    },
    {
      id: 'lvl-e',
      kind: 'callout',
      tone: 'note',
      levels: ['experienced'],
      title: bi('Если вы уже дежурили разработчиком', 'If you have been on call as a developer'),
      body: bi(
        'Разработчик на дежурстве обычно отвечает за свой сервис, а DevOps-инженер чаще стоит первой линией для всей платформы: кластера, сети, конвейеров и баз данных. Поэтому на собеседовании уточните, кто отвечает за алерты самого приложения, а кто за алерты платформы, и кому вы будете эскалировать ошибки в коде сервисов.',
        'A developer on call usually answers for their own service, while a DevOps engineer is more often the first line for the whole platform: the cluster, the network, the pipelines and the databases. So at the interview ask who answers for the application’s own alerts and who for the platform’s, and to whom you will escalate bugs in the services’ code.',
      ),
    },
    { id: 'exit', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['career.q.escalate'] },
  ],
};
