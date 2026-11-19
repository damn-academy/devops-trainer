// Quiz bank of the career block and the final segment. Every wrong option is
// a recorded misconception with its explanation; the review queue picks
// these items by concept.

import { bi } from '../../core/i18n';
import type { QuizItem } from '../../core/types';

export const QUIZ: QuizItem[] = [
  // ── career.interviews ──
  {
    id: 'career.q.stages',
    kind: 'match',
    concepts: ['career.interview'],
    prompt: bi('Сопоставьте этап собеседования с тем, что на нём проверяют прежде всего.', 'Match each interview stage with what it checks first of all.'),
    pairs: [
      { id: 'screen', left: bi('Скрининг с рекрутером', 'Screening with a recruiter'), right: bi('Мотивация, ожидания, умение коротко рассказать о себе', 'Motivation, expectations, telling about yourself briefly') },
      { id: 'tech', left: bi('Техническое интервью', 'Technical interview'), right: bi('Понимание механизмов и метод в ситуационном вопросе', 'Understanding of mechanisms and the method in a situational question') },
      { id: 'sandbox', left: bi('Живая песочница', 'Live sandbox'), right: bi('Насколько далеко вы дойдёте сами, с документацией', 'How far you get on your own, with the documentation') },
      { id: 'final', left: bi('Финал с руководителем', 'Final round with the manager'), right: bi('Команда, процессы, ваши собственные вопросы', 'The team, the processes, your own questions') },
    ],
    explain: bi('Каждый этап проверяет своё, поэтому и готовиться к ним стоит по-разному.', 'Each stage checks something else, so each needs its own preparation.'),
  },
  {
    id: 'career.q.logic',
    kind: 'mcq',
    concepts: ['career.logic'],
    prompt: bi('На вопрос «Как проверить, что сервис слушает порт?» какой ответ лучше всего показывает понимание?', 'To “How do you check that a service listens on a port?”, which answer best shows understanding?'),
    options: [
      { id: 'cmd', text: '`ss -tlnp`', why: bi('Верная команда, но ответ ничего не говорит о том, что вы понимаете: что такое слушающий сокет и что значат флаги.', 'The right command, but the answer says nothing about what you understand: what a listening socket is and what the flags mean.') },
      { id: 'logic', text: bi('Служба открывает сокет и ждёт соединений на адресе и порту; ядро знает все такие сокеты. Я спрашиваю у ядра список слушающих TCP-сокетов с процессами — `ss -tlnp` — и смотрю, на каком адресе слушает служба: 127.0.0.1 снаружи недоступен.', 'The service opens a socket and waits for connections on an address and port; the kernel knows all such sockets. I ask the kernel for the listening TCP sockets with their processes — `ss -tlnp` — and look at the address: 127.0.0.1 is not reachable from outside.'), correct: true },
      { id: 'curl', text: bi('Сделаю `curl` на порт: если ответил, значит слушает.', 'I would `curl` the port: if it answers, it listens.'), why: bi('`curl` проверяет ещё и протокол, и путь по сети; молчание не скажет, что именно не так.', '`curl` also tests the protocol and the network path; silence will not tell you what exactly is wrong.') },
      { id: 'ps', text: bi('Посмотрю `ps aux`, запущена ли служба.', 'I would check `ps aux` to see whether the service is running.'), why: bi('Запущенный процесс ещё не значит слушающий порт: он мог упереться в занятый порт или слушать не тот адрес.', 'A running process does not mean a listening port: it may have hit a busy port or listen on the wrong address.') },
    ],
    explain: bi('Механизм, затем команда как способ его увидеть, затем то, что из этого следует.', 'The mechanism, then the command as a way to see it, then what follows from it.'),
  },
  {
    id: 'career.q.five',
    kind: 'multi',
    concepts: ['career.interview'],
    prompt: bi('Что нанимающий инженер ищет в джуне? Отметьте всё верное.', 'What does a hiring engineer look for in a junior? Mark everything that is true.'),
    options: [
      { id: 'mech', text: bi('Понимание механизма, а не память на команды', 'Understanding of the mechanism, not a memory for commands'), correct: true },
      { id: 'docs', text: bi('Умение найти ответ в документации самому', 'Finding the answer in the documentation on your own'), correct: true },
      { id: 'honest', text: bi('Честность о границах своих знаний', 'Honesty about the limits of your knowledge'), correct: true },
      { id: 'certs', text: bi('Как можно больше сертификатов', 'As many certificates as possible'), why: bi('Для джуна сертификаты почти не влияют на решение: репозиторий и объяснение весят больше.', 'For a junior certificates barely affect the decision: a repository and an explanation weigh more.') },
      { id: 'all', text: bi('Опыт со всеми инструментами из вакансии', 'Experience with every tool in the vacancy'), why: bi('Требования завышают намеренно; от джуна ждут основы и умения учиться.', 'Requirements are inflated on purpose; a junior is expected to have the basics and the ability to learn.') },
    ],
  },
  // ── career.answer ──
  {
    id: 'career.q.order-parts',
    kind: 'order',
    concepts: ['career.answer-structure'],
    prompt: bi('Расставьте части ответа на «Что такое DNS?» в правильном порядке.', 'Put the parts of the answer to “What is DNS?” in the right order.'),
    steps: [
      { id: 'what', text: bi('DNS превращает имя в адрес и другие записи', 'DNS turns a name into an address and other records') },
      { id: 'why', text: bi('Люди и конфигурации пользуются именами, а адреса меняются', 'People and configs use names while addresses change') },
      { id: 'how', text: bi('Резолвер идёт от корня к серверу зоны и кэширует ответ на время TTL', 'The resolver walks from the root to the zone server and caches the answer for the TTL') },
      { id: 'when', text: bi('Проверяю `dig` через резолвер и напрямую у авторитативного сервера', 'I check with `dig` through the resolver and directly at the authoritative server') },
    ],
    explain: bi('Что → зачем → как → когда: команда стоит последней, как способ увидеть механизм.', 'What → why → how → when: the command comes last, as a way to see the mechanism.'),
  },
  {
    id: 'career.q.dont-know',
    kind: 'mcq',
    concepts: ['career.dont-know'],
    prompt: bi('Интервьюер спрашивает про Consul, с которым вы не работали. Какой ответ лучше?', 'The interviewer asks about Consul, which you have never used. Which answer is best?'),
    options: [
      { id: 'honest', text: bi('«Не работал. Судя по задаче, это обнаружение сервисов — в Kubernetes его решают DNS кластера и Service. Выяснял бы по документации Consul, разделу про обнаружение сервисов, и проверил бы в песочнице».', '“I haven’t used it. From the task it sounds like service discovery — in Kubernetes cluster DNS and Services solve that. I’d find out from the Consul docs, the service discovery section, and test it in a sandbox.”'), correct: true },
      { id: 'invent', text: bi('«Consul — это балансировщик нагрузки, как nginx».', '“Consul is a load balancer, like nginx.”'), why: bi('Уверенная выдумка — ноль по честности; после неё интервьюер сомневается во всём остальном.', 'A confident invention scores zero for honesty; after it the interviewer doubts everything else.') },
      { id: 'skip', text: bi('«Не знаю. Следующий вопрос?»', '“I don’t know. Next question?”'), why: bi('Честно, но без связи с тем, что вы знаете, и без плана, как выяснить; так теряется шанс показать рассуждение.', 'Honest, but with no link to what you know and no plan to find out; it wastes the chance to show your reasoning.') },
      { id: 'google', text: bi('«Не знаю, но погуглю».', '“I don’t know, but I’ll google it.”'), why: bi('Источник не назван: «погуглю» не показывает, что вы умеете искать.', 'No source named: “I’ll google it” does not show that you know how to look.') },
    ],
  },
  {
    id: 'career.q.mechanism',
    kind: 'multi',
    concepts: ['career.logic', 'career.answer-structure'],
    prompt: bi('Какие фразы объясняют механизм, а не называют команду? Отметьте все.', 'Which phrases explain a mechanism rather than name a command? Mark them all.'),
    options: [
      { id: 'pid1', text: bi('У PID 1 ядро не применяет действия сигналов по умолчанию, поэтому без обработчика SIGTERM игнорируется', 'The kernel applies no default signal actions to PID 1, so without a handler SIGTERM is ignored'), correct: true },
      { id: 'inode', text: bi('Данные файла освобождаются, когда счётчик ссылок inode равен нулю и файл никто не держит открытым', 'A file’s data is freed when the inode link count is zero and nobody holds it open'), correct: true },
      { id: 'kill', text: bi('Надо делать `docker kill`', 'You should run `docker kill`'), why: bi('Это совет-команда: из него не видно, почему `stop` ждёт.', 'This is a command-as-advice: it does not show why `stop` waits.') },
      { id: 'df', text: bi('Смотрю `df -h`', 'I look at `df -h`'), why: bi('Команда без объяснения, что она показывает и чем отличается от `du`.', 'A command without saying what it shows and how it differs from `du`.') },
    ],
  },
  // ── career.classics ──
  {
    id: 'career.q.cd-match',
    kind: 'match',
    concepts: ['career.q-ci-cd'],
    prompt: bi('Сопоставьте термин и определение.', 'Match each term with its definition.'),
    pairs: [
      { id: 'ci', left: bi('Непрерывная интеграция', 'Continuous integration'), right: bi('Частое слияние в общую ветку, каждое собирается и проверяется тестами', 'Frequent merges into a shared branch, each built and tested') },
      { id: 'delivery', left: bi('Непрерывная доставка', 'Continuous delivery'), right: bi('Каждое изменение готово к выкладке, выкладку запускает человек', 'Every change is releasable; a person starts the release') },
      { id: 'deploy', left: bi('Непрерывное развёртывание', 'Continuous deployment'), right: bi('Выкладка в прод автоматическая, без ручного шага', 'The release to production is automatic, with no manual step') },
    ],
    explain: bi('Граница между двумя CD — есть ли ручной шаг перед продом.', 'The line between the two CDs is whether there is a manual step before production.'),
  },
  {
    id: 'career.q.vm-multi',
    kind: 'multi',
    concepts: ['career.q-vm-container'],
    prompt: bi('Что верно про контейнер в сравнении с виртуальной машиной? Отметьте всё верное.', 'What is true of a container compared with a virtual machine? Mark everything that is true.'),
    options: [
      { id: 'kernel', text: bi('Использует ядро хоста', 'Uses the host’s kernel'), correct: true },
      { id: 'ns', text: bi('Свой вид системы ему дают пространства имён', 'Namespaces give it its own view of the system'), correct: true },
      { id: 'cg', text: bi('Ресурсы ограничивают cgroups', 'cgroups limit its resources'), correct: true },
      { id: 'hyper', text: bi('Работает поверх гипервизора со своим ядром', 'Runs on a hypervisor with its own kernel'), why: bi('Это описание виртуальной машины.', 'That describes a virtual machine.') },
      { id: 'stronger', text: bi('Изолирован сильнее, чем ВМ', 'Is isolated more strongly than a VM'), why: bi('Наоборот: общее ядро — общая поверхность атаки; уязвимость ядра задевает все контейнеры хоста.', 'The opposite: a shared kernel is a shared attack surface; a kernel vulnerability affects every container on the host.') },
    ],
  },
  {
    id: 'career.q.windows',
    kind: 'mcq',
    concepts: ['career.q-vm-container'],
    prompt: bi('Можно ли в контейнере на Linux-хосте запустить Windows-приложение, которому нужно ядро Windows?', 'Can a container on a Linux host run a Windows application that needs the Windows kernel?'),
    options: [
      { id: 'no', text: bi('Нет: контейнер пользуется ядром хоста, а это ядро Linux', 'No: a container uses the host’s kernel, and that is a Linux kernel'), correct: true },
      { id: 'yes', text: bi('Да, если взять образ Windows', 'Yes, with a Windows image'), why: bi('Образ — это файлы, а не ядро. Ядро у контейнера всегда хостовое.', 'An image is files, not a kernel. A container always gets the host’s kernel.') },
      { id: 'priv', text: bi('Да, в привилегированном режиме', 'Yes, in privileged mode'), why: bi('Привилегии дают больше прав в том же ядре, но не другое ядро.', 'Privileges give more rights within the same kernel, not another kernel.') },
    ],
    explain: bi('Для другой ОС нужна виртуальная машина — и её можно запустить хоть внутри Kubernetes.', 'Another OS needs a virtual machine — which can even run inside Kubernetes.'),
  },
  {
    id: 'career.q.nesting',
    kind: 'mcq',
    concepts: ['career.q-vm-container'],
    prompt: bi('Какая фраза лучше всего завершает ответ «ВМ или контейнер»?', 'Which sentence best ends an answer to “VM or container”?'),
    options: [
      { id: 'nest', text: bi('Они вкладываются друг в друга: контейнеры в облаке работают внутри ВМ, а ВМ можно запускать в Kubernetes', 'They nest: in the cloud containers run inside VMs, and VMs can run inside Kubernetes'), correct: true },
      { id: 'replace', text: bi('Контейнеры полностью заменили виртуальные машины', 'Containers have completely replaced virtual machines'), why: bi('Нет: почти все контейнеры в облаке работают как раз внутри ВМ.', 'No: nearly every container in the cloud runs inside a VM.') },
      { id: 'old', text: bi('ВМ — устаревшая технология', 'VMs are an outdated technology'), why: bi('ВМ нужны для сильной изоляции и другой ОС; их запускают и в современных платформах на Kubernetes.', 'VMs are needed for strong isolation and another OS; modern Kubernetes-based platforms run them too.') },
    ],
  },
  // ── career.situational ──
  {
    id: 'career.q.method-order',
    kind: 'order',
    concepts: ['career.situational', 'career.mitigate-first'],
    prompt: bi('Расставьте шаги ответа на «504 — что будете делать?».', 'Put the steps of an answer to “504 — what do you do?” in order.'),
    steps: [
      { id: 'ask', text: bi('Уточнить масштаб, время и что менялось', 'Ask about scope, time and what changed') },
      { id: 'confirm', text: bi('Подтвердить симптом снаружи и понять, кто отвечает 504', 'Confirm the symptom from outside and find who answers 504') },
      { id: 'log', text: bi('Прочитать журнал ошибок прокси', 'Read the proxy’s error log') },
      { id: 'narrow', text: bi('Проверить приложение мимо прокси', 'Check the application bypassing the proxy') },
      { id: 'mitigate', text: bi('Откатить изменение, которое вызвало сбой', 'Roll back the change that caused the failure') },
      { id: 'fix', text: bi('Устранить причину через конвейер и проверить', 'Remove the cause through the pipeline and verify') },
    ],
  },
  {
    id: 'career.q.log-line',
    kind: 'mcq',
    concepts: ['career.situational'],
    prompt: bi('В журнале nginx: `upstream timed out (110: Connection timed out) while connecting to upstream`. Что это значит?', 'The nginx log says: `upstream timed out (110: Connection timed out) while connecting to upstream`. What does it mean?'),
    options: [
      { id: 'connect', text: bi('nginx не смог установить TCP-соединение с приложением: искать на пути по сети', 'nginx could not establish a TCP connection to the application: look at the network path'), correct: true },
      { id: 'slow', text: bi('Приложение медленно отвечает на запрос', 'The application is slow to answer the request'), why: bi('Это была бы строка «while reading response header»: соединение есть, ответа нет.', 'That would be “while reading response header”: a connection exists, an answer does not.') },
      { id: 'dns', text: bi('Не разрешается имя сайта', 'The site’s name does not resolve'), why: bi('Клиент уже дошёл до nginx по имени, а nginx пишет про upstream.', 'The client already reached nginx by name, and nginx is talking about the upstream.') },
    ],
  },
  {
    id: 'career.q.bad-paths',
    kind: 'multi',
    concepts: ['career.situational', 'career.mitigate-first'],
    prompt: bi('Какие действия — плохие пути при 504? Отметьте все.', 'Which actions are bad paths for a 504? Mark them all.'),
    options: [
      { id: 'timeout', text: bi('Сразу поднять proxy_read_timeout', 'Raise proxy_read_timeout right away'), correct: true, why: bi('Прячет проблему: пользователи ждут дольше.', 'Hides the problem: users wait longer.') },
      { id: 'restart', text: bi('Перезапустить всё до чтения журналов', 'Restart everything before reading the logs'), correct: true, why: bi('Стирает улики и не убирает причину.', 'Destroys the evidence and leaves the cause.') },
      { id: 'dns', text: bi('Проверять DNS, когда ответ подписан `server: nginx`', 'Check DNS when the answer is signed `server: nginx`'), correct: true, why: bi('Гипотеза противоречит наблюдению.', 'The hypothesis contradicts the observation.') },
      { id: 'curl', text: bi('Сделать `curl -sv` к странице', 'Run `curl -sv` against the page'), why: bi('Это хороший первый шаг: он показывает, кто отвечает 504.', 'This is a good first step: it shows who answers 504.') },
      { id: 'errlog', text: bi('Прочитать журнал ошибок nginx', 'Read the nginx error log'), why: bi('Это и есть сбор улик.', 'That is collecting evidence.') },
    ],
  },
  {
    id: 'career.q.previous',
    kind: 'fill-command',
    concepts: ['career.situational'],
    prompt: bi('Под в CrashLoopBackOff. Допишите команду, чтобы увидеть журнал упавшего запуска, а не текущего.', 'A pod is in CrashLoopBackOff. Complete the command to see the log of the crashed run, not the current one.'),
    template: 'kubectl logs api-7c9d8f6b5-2xkqp -n shop ___',
    answers: ['--previous', '-p', '--previous=true'],
    misconceptions: [{ match: '-f|--follow', why: bi('`-f` следит за текущим запуском, а он ещё не начался.', '`-f` follows the current run, which has not started yet.') }],
    explain: bi('Журнал прошлого контейнера хранится до следующего перезапуска; `kubectl delete pod` уничтожает его вместе с подом.', 'The previous container’s log is kept until the next restart; `kubectl delete pod` destroys it with the pod.'),
  },
  {
    id: 'career.q.status',
    kind: 'mcq',
    concepts: ['career.status-update'],
    prompt: bi('Какой статус в чат команды лучше?', 'Which status message to the team is best?'),
    options: [
      { id: 'good', text: bi('«Оплата у всех: около 30% запросов отдают 504 с 14:10. Откатываем релиз 14:05. Следующий статус в 14:40 или раньше, если ошибки не упадут».', '“Checkout for everyone: about 30% of requests return 504 since 14:10. Rolling back the 14:05 release. Next update at 14:40, or earlier if errors do not drop.”'), correct: true },
      { id: 'vague', text: bi('«Сайт что-то тормозит, смотрю».', '“The site is slow-ish, looking.”'), why: bi('Нет ни масштаба влияния, ни конкретного действия, ни времени следующего сообщения.', 'No scale of impact, no concrete action, no time for the next message.') },
      { id: 'blame', text: bi('«Кто-то выкатил кривой релиз, разбираюсь».', '“Someone shipped a broken release, dealing with it.”'), why: bi('Поиск виноватых вместо влияния и плана; во время инцидента это только мешает.', 'Blame instead of impact and a plan; during an incident it only gets in the way.') },
    ],
  },
  // ── career.mock ──
  {
    id: 'career.q.unconfirmed',
    kind: 'mcq',
    concepts: ['career.rubric'],
    prompt: bi('Нейросеть поставила 3 за глубину с цитатой «назвал компромисс между скоростью и изоляцией», но такой фразы в расшифровке нет. Что сделает курс?', 'The AI gave 3 for depth quoting “named the trade-off between speed and isolation”, but there is no such phrase in the transcript. What does the course do?'),
    options: [
      { id: 'lower', text: bi('Снизит балл до 1 и пометит «не подтверждено»', 'Lower the score to 1 and mark it “not confirmed”'), correct: true },
      { id: 'keep', text: bi('Оставит 3: нейросети виднее', 'Keep the 3: the AI knows best'), why: bi('Балл без доказательства — лесть модели; поэтому каждая цитата сверяется с расшифровкой.', 'A score without proof is the model flattering you; that is why every quote is checked against the transcript.') },
      { id: 'zero', text: bi('Поставит 0', 'Set it to 0'), why: bi('Ноль — это «не выдержал уточнение»; здесь неизвестно, было ли хуже 1, поэтому балл опускается только до 1.', 'Zero means “did not survive the follow-up”; here it is unknown whether it was worse than 1, so the score drops only to 1.') },
    ],
  },
  {
    id: 'career.q.honesty-zero',
    kind: 'mcq',
    concepts: ['career.rubric', 'career.mock-interview'],
    prompt: bi('Средний балл мок-интервью 2,5, но по честности один 0. Готов ли кандидат к живым собеседованиям?', 'A mock interview averages 2.5, but honesty has one 0. Is the candidate ready for live interviews?'),
    options: [
      { id: 'no', text: bi('Нет: ноль по честности проваливает интервью целиком', 'No: a zero for honesty fails the whole interview'), correct: true },
      { id: 'yes', text: bi('Да: средний выше 2', 'Yes: the mean is above 2'), why: bi('Выдуманный ответ на настоящем собеседовании обесценивает все остальные; поэтому честность — единственный критерий, ноль по которому валит всё.', 'An invented answer at a real interview devalues all the others; that is why honesty is the one criterion whose zero fails everything.') },
    ],
  },
  {
    id: 'career.q.star',
    kind: 'order',
    concepts: ['career.mock-interview'],
    prompt: bi('Расставьте части ответа на «Расскажите о своей ошибке» по схеме STAR.', 'Put the parts of an answer to “Tell us about a mistake” in STAR order.'),
    steps: [
      { id: 's', text: bi('Ситуация: где и когда это было', 'Situation: where and when it was') },
      { id: 't', text: bi('Задача: что нужно было сделать', 'Task: what had to be done') },
      { id: 'a', text: bi('Действие: что сделали вы сами', 'Action: what you yourself did') },
      { id: 'r', text: bi('Результат и что вы изменили после', 'Result, and what you changed afterwards') },
    ],
  },
  // ── career.pitch ──
  {
    id: 'career.q.pitch-order',
    kind: 'order',
    concepts: ['career.pitch'],
    prompt: bi('Расставьте части самопрезентации.', 'Put the parts of a self-presentation in order.'),
    steps: [
      { id: 'who', text: bi('Кто я и откуда — одной фразой', 'Who I am and where from — one sentence') },
      { id: 'can', text: bi('Что умею — с доказательствами', 'What I can do — with proof') },
      { id: 'story', text: bi('Одна история: проблема, что сделал, что изменилось', 'One story: the problem, what I did, what changed') },
      { id: 'why', text: bi('Почему DevOps — мост от прежнего опыта', 'Why DevOps — the bridge from earlier experience') },
      { id: 'seek', text: bi('Что ищу', 'What I am looking for') },
    ],
  },
  {
    id: 'career.q.apologies',
    kind: 'multi',
    concepts: ['career.pitch'],
    prompt: bi('Какие фразы стоит убрать из самопрезентации? Отметьте все.', 'Which phrases should go from a self-presentation? Mark them all.'),
    options: [
      { id: 'sorry', text: bi('«К сожалению, у меня нет опыта работы в IT»', '“Unfortunately, I have no IT work experience”'), correct: true, why: bi('Извинение задаёт тон «я не подхожу» ещё до вопросов.', 'An apology sets a “I don’t fit” tone before any questions.') },
      { id: 'only', text: bi('«Я пока только учусь»', '“I am only learning so far”'), correct: true, why: bi('Обесценивает то, что вы уже сделали; лучше назвать сделанное.', 'It devalues what you have already done; better to name it.') },
      { id: 'proof', text: bi('«Сдал практические экзамены по Linux и Docker; мой проект — github.com/…»', '“Passed the practical exams on Linux and Docker; my project is github.com/…”'), why: bi('Это доказательство — его как раз стоит оставить.', 'That is proof, exactly what to keep.') },
      { id: 'bridge', text: bi('«Три года разбирал инциденты на первой линии — теперь хочу их предотвращать»', '“For three years I handled incidents on the first line; now I want to prevent them”'), why: bi('Это мост — сильная часть.', 'That is a bridge, a strong part.') },
    ],
  },
  {
    id: 'career.q.no-experience',
    kind: 'mcq',
    concepts: ['career.awkward'],
    prompt: bi('«У вас нет опыта — почему мы должны вас взять?» Какой ответ лучше?', '“You have no experience — why should we hire you?” Which answer is best?'),
    options: [
      { id: 'proof', text: bi('«Опыта работы DevOps-инженером нет. Есть то, что можно открыть: три пет-проекта с конвейером и мониторингом и история о том, как в одном из них кончился диск и как я это нашёл».', '“I have no experience as a DevOps engineer. I have things you can open: three pet projects with pipelines and monitoring, and the story of how one of them ran out of disk and how I found it.”'), correct: true },
      { id: 'fake', text: bi('«Я работал DevOps-инженером на фрилансе».', '“I worked as a freelance DevOps engineer.”'), why: bi('Если этого не было, это выдумка: она раскроется на первом уточнении.', 'If it did not happen, it is an invention: it falls apart at the first follow-up.') },
      { id: 'learn', text: bi('«Я быстро учусь и стрессоустойчив».', '“I learn fast and handle stress well.”'), why: bi('Пустые слова: их говорит каждый, и их нельзя проверить.', 'Empty words: everyone says them, and they cannot be checked.') },
    ],
  },
  // ── career.resume ──
  {
    id: 'career.q.cv-bug',
    kind: 'bugfind',
    concepts: ['career.evidence'],
    prompt: bi('В этом фрагменте резюме одна строка нарушает правило «действие и результат, а не обязанности». Нажмите на неё.', 'One line of this CV fragment breaks the rule “actions and results, not duties”. Click it.'),
    lang: 'text',
    code: 'Junior DevOps Engineer\nПроект: магазин в docker compose — github.com/me/shop\n• Настроил конвейер GitLab CI: линт, тесты, сборка образа, выкладка\n• Отвечал за поддержку серверов\n• Добавил алерт на заполнение диска, который сработал за 3 часа до сбоя',
    bug: [4],
    why: {
      1: bi('Заголовок — целевая роль: так и нужно.', 'The headline is the target role: as it should be.'),
      2: bi('Проект со ссылкой на репозиторий — подтверждение.', 'A project with a repository link is evidence.'),
      3: bi('Действие и что именно сделано — хороший пункт.', 'An action and what exactly was done: a good bullet.'),
      4: bi('«Отвечал за…» — обязанность, а не действие: непонятно, что вы сделали и что изменилось.', '“Was responsible for…” is a duty, not an action: it does not say what you did or what changed.'),
      5: bi('Действие и измеримый результат — лучший вид пункта.', 'An action and a measurable result: the best kind of bullet.'),
    },
  },
  {
    id: 'career.q.cv-irrelevant',
    kind: 'multi',
    concepts: ['career.bridge'],
    prompt: bi('Какие строки резюме бывшего продавца стоит сжать или убрать в DevOps-версии? Отметьте все.', 'Which lines of a former salesperson’s CV should be shortened or removed in the DevOps version? Mark them all.'),
    options: [
      { id: 'plan', text: bi('«Выполнил план продаж на 120% во втором квартале»', '“Hit 120% of the sales plan in Q2”'), correct: true, why: bi('Хорошее достижение, но не для этой роли: одна строка о должности, без подробностей.', 'A fine achievement, but not for this role: one line about the position, no details.') },
      { id: 'pc', text: bi('«Уверенный пользователь ПК»', '“Confident PC user”'), correct: true, why: bi('Пустая формулировка: для DevOps она звучит странно.', 'An empty phrase: for DevOps it sounds odd.') },
      { id: 'req', text: bi('«Собирал требования клиентов и переводил их в задачи для технической команды»', '“Gathered customer requirements and turned them into tasks for the technical team”'), why: bi('Это мост к DevOps — оставить.', 'This is a bridge to DevOps — keep it.') },
      { id: 'auto', text: bi('«Автоматизировал отчёты: с 6 до 1 часа в неделю»', '“Automated reports: from 6 to 1 hour a week”'), why: bi('Автоматизация с результатом — ценный пункт.', 'Automation with a result is a valuable bullet.') },
    ],
  },
  {
    id: 'career.q.evidence',
    kind: 'mcq',
    concepts: ['career.evidence'],
    prompt: bi('Что лучше всего подтверждает навык «Docker» в резюме джуна?', 'What best backs the skill “Docker” on a junior CV?'),
    options: [
      { id: 'repo', text: bi('Ссылка на репозиторий проекта с Dockerfile, compose и README', 'A link to a project repository with a Dockerfile, compose and a README'), correct: true },
      { id: 'course', text: bi('«Прошёл онлайн-курс по Docker»', '“Took an online Docker course”'), why: bi('Пройденный курс не показывает, что вы умеете; репозиторий или практический экзамен — показывает.', 'A course taken does not show what you can do; a repository or a practical exam does.') },
      { id: 'years', text: bi('«Docker — 2 года»', '“Docker — 2 years”'), why: bi('Число без того, что можно открыть, ничего не подтверждает.', 'A number without anything to open confirms nothing.') },
    ],
  },
  // ── career.pets ──
  {
    id: 'career.q.pet-match',
    kind: 'match',
    concepts: ['career.pet-project'],
    prompt: bi('Сопоставьте пет-проект с блоком, после которого он открывается.', 'Match each pet project with the block after which it opens.'),
    pairs: [
      { id: 'vpn', left: bi('VPN-сервер на WireGuard', 'A WireGuard VPN server'), right: bi('Сети', 'Networks') },
      { id: 'ansible', left: bi('Terraform и Ansible приводят машину к нужному состоянию', 'Terraform and Ansible bring a machine to the target state'), right: bi('IaC', 'IaC') },
      { id: 'mon', left: bi('Prometheus и Grafana для своего сервиса', 'Prometheus and Grafana for your service'), right: bi('Мониторинг', 'Monitoring') },
      { id: 'helm', left: bi('Кластер с Helm и Argo CD', 'A cluster with Helm and Argo CD'), right: bi('Kubernetes', 'Kubernetes') },
    ],
  },
  {
    id: 'career.q.measurable',
    kind: 'mcq',
    concepts: ['career.pet-project'],
    prompt: bi('Какой критерий приёмки проверяем?', 'Which acceptance criterion can be checked?'),
    options: [
      { id: 'ok', text: bi('Пуш в main выкладывает новую версию меньше чем за 5 минут, и на странице виден SHA последнего коммита', 'A push to main releases the new version in under 5 minutes, and the page shows the last commit’s SHA'), correct: true },
      { id: 'nice', text: bi('Сайт работает быстро и надёжно', 'The site works fast and reliably'), why: bi('«Быстро» и «надёжно» без чисел не проверить.', '“Fast” and “reliable” without numbers cannot be checked.') },
      { id: 'modern', text: bi('Используются современные технологии', 'Modern technologies are used'), why: bi('Это не критерий: нечего измерить.', 'This is not a criterion: there is nothing to measure.') },
    ],
  },
  {
    id: 'career.q.readme-key',
    kind: 'mcq',
    concepts: ['career.readme'],
    prompt: bi('Какой раздел README пет-проекта важнее всего для собеседования?', 'Which README section of a pet project matters most for an interview?'),
    options: [
      { id: 'broke', text: bi('Что сломалось по дороге и как чинил', 'What broke on the way and how you fixed it'), correct: true },
      { id: 'run', text: bi('Как запустить', 'How to run it'), why: bi('Нужен, но собеседование ценит вашу историю поломки и метод, а не инструкцию.', 'Necessary, but an interview values your failure story and method, not instructions.') },
      { id: 'badges', text: bi('Значки сборки и покрытия', 'Build and coverage badges'), why: bi('Украшение; о том, как вы думаете, оно не говорит.', 'Decoration; it says nothing about how you think.') },
    ],
  },
  // ── career.search ──
  {
    id: 'career.q.apply',
    kind: 'mcq',
    concepts: ['career.rule-60'],
    prompt: bi('Анализатор показал: совпадение 64%, по обязательным требованиям — 75%. Что делать?', 'The analyzer shows a 64% match, 75% on the required items. What do you do?'),
    options: [
      { id: 'apply', text: bi('Откликаться и подтянуть к собеседованию то, чего не хватает', 'Apply, and catch up on what is missing before the interview'), correct: true },
      { id: 'wait', text: bi('Подождать, пока совпадение станет 100%', 'Wait until the match is 100%'), why: bi('Требования завышают намеренно; 100% не бывает и у тех, кого берут.', 'Requirements are inflated on purpose; even hired candidates rarely match 100%.') },
      { id: 'lie', text: bi('Добавить в резюме недостающие навыки, чтобы совпадало', 'Add the missing skills to the CV so it matches'), why: bi('Навык без подтверждения раскроется на первом же вопросе.', 'A skill without evidence comes apart at the very first question.') },
    ],
  },
  {
    id: 'career.q.little',
    kind: 'mcq',
    concepts: ['career.funnel'],
    prompt: bi('Вы отправляете 12 откликов в неделю, средний путь отклика — 3 недели. Сколько откликов у вас в работе одновременно?', 'You send 12 applications a week; the average path of an application is 3 weeks. How many are in progress at once?'),
    options: [
      { id: '36', text: '36', correct: true },
      { id: '12', text: '12', why: bi('Это поток за неделю; каждый отклик живёт три недели, поэтому в работе их втрое больше.', 'That is one week’s flow; each application lives three weeks, so three times as many are in progress.') },
      { id: '4', text: '4', why: bi('12 / 3 — деление вместо умножения: по закону Литтла WIP = поток × время.', '12 / 3 divides instead of multiplying: by Little’s law WIP = flow × time.') },
    ],
  },
  {
    id: 'career.q.conversion',
    kind: 'mcq',
    concepts: ['career.funnel'],
    prompt: bi('Ответы на отклики приходят, но после скрининга почти всегда отказ. Что улучшать первым?', 'Replies to applications come, but after screening it is nearly always a no. What do you improve first?'),
    options: [
      { id: 'pitch', text: bi('Самопрезентацию и рассказ о мотивации', 'The self-presentation and the motivation story'), correct: true },
      { id: 'cv', text: bi('Резюме и ключевые слова', 'The CV and the keywords'), why: bi('Резюме уже работает: ответы приходят. Ломается следующий этап.', 'The CV already works: replies come. The next stage is where it breaks.') },
      { id: 'more', text: bi('Откликаться в три раза больше', 'Apply three times as much'), why: bi('Больше откликов при той же конверсии — больше тех же отказов.', 'More applications at the same conversion means more of the same rejections.') },
    ],
  },
  {
    id: 'career.q.card-age',
    kind: 'mcq',
    concepts: ['career.funnel', 'career.retro'],
    prompt: bi('Отклику 16 дней, ответа нет. Что с ним делать?', 'An application is 16 days old with no reply. What do you do with it?'),
    options: [
      { id: 'close', text: bi('Закрыть карточку и не ждать, поток откликов держать ровным', 'Close the card and stop waiting; keep the flow of applications steady'), correct: true },
      { id: 'wait', text: bi('Ждать ответа, не отправляя новых', 'Wait for a reply without sending new ones'), why: bi('Поиск — поток: остановка откликов растягивает весь путь до оффера.', 'The search is a flow: stopping applications stretches the whole path to an offer.') },
      { id: 'spam', text: bi('Писать рекрутеру каждый день', 'Write to the recruiter every day'), why: bi('Одно напоминание уместно; ежедневные — нет.', 'One reminder is fine; daily ones are not.') },
    ],
  },
  // ── final.oncall ──
  {
    id: 'career.q.priority',
    kind: 'order',
    concepts: ['career.priority'],
    prompt: bi('Три инцидента пришли почти одновременно. Расставьте их в порядке, в котором дежурный берёт их в работу.', 'Three incidents arrived almost at once. Put them in the order the on-call engineer takes them.'),
    steps: [
      { id: 'checkout', text: bi('Оформление заказа отдаёт 504 у 30% пользователей', 'Checkout returns 504 for 30% of users') },
      { id: 'disk', text: bi('Диск на сервере заполнится примерно через 4 часа', 'The server’s disk will fill in about 4 hours') },
      { id: 'ci', text: bi('Конвейер main красный третий час — выкладки стоят', 'The main pipeline has been red for three hours — releases are blocked') },
    ],
    explain: bi('Порядок — по влиянию на пользователей и по запасу времени, а не по времени прихода. Отложенный инцидент объявляют в чате.', 'The order follows the impact on users and the time left, not the arrival time. A deferred incident is announced in the chat.'),
  },
  {
    id: 'career.q.blameless',
    kind: 'mcq',
    concepts: ['career.blameless'],
    prompt: bi('Какая строка «способствующие факторы» в разборе инцидента написана лучше?', 'Which “contributing factors” line of an incident review is written best?'),
    options: [
      { id: 'system', text: bi('Миграция без индекса прошла ревью, потому что на стенде таблица маленькая; алерта на время ответа оформления не было', 'A migration without an index passed review because the staging table is small; there was no alert on checkout response time'), correct: true },
      { id: 'person', text: bi('Разработчик Петров не проверил запрос', 'Developer Petrov did not check the query'), why: bi('Это поиск виноватого: в следующий раз ошибётся другой человек, если не изменить условия.', 'This is blame: next time someone else makes the mistake unless the conditions change.') },
      { id: 'root', text: bi('Корневая причина — человеческий фактор', 'Root cause: human error'), why: bi('«Человеческий фактор» не называет ни одного условия системы, которое можно изменить.', '“Human error” names no condition of the system that can be changed.') },
    ],
  },
  {
    id: 'career.q.wip',
    kind: 'mcq',
    concepts: ['career.oncall'],
    prompt: bi('Вы разбираете 504, и приходит алерт про диск. Что будете делать?', 'You are working on a 504 when a disk alert arrives. What do you do?'),
    options: [
      { id: 'announce', text: bi('Написать в чат «вижу алерт про диск, у нас 4 часа, возьму после 504» и продолжить 504', 'Post “seen the disk alert, we have 4 hours, will take it after the 504” and continue with the 504'), correct: true },
      { id: 'switch', text: bi('Переключиться на диск, раз он пришёл', 'Switch to the disk since it came in'), why: bi('Оплата у пользователей важнее, а у диска есть запас времени; переключение замедлит оба.', 'Users’ checkout matters more, and the disk has time left; switching slows both down.') },
      { id: 'ignore', text: bi('Молча проигнорировать, разобраться потом', 'Silently ignore it and deal with it later'), why: bi('Отложенный инцидент объявляют: иначе команда не знает, что его кто-то видел.', 'A deferred incident is announced: otherwise the team does not know anyone has seen it.') },
    ],
  },
];
