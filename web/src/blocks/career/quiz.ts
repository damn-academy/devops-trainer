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
      { id: 'screen', left: bi('Скрининг с рекрутером', 'Screening with a recruiter'), right: bi('Мотивация, ожидания и умение коротко рассказать о себе', 'Motivation, expectations, telling about yourself briefly') },
      { id: 'tech', left: bi('Техническое интервью', 'Technical interview'), right: bi('Понимание механизмов и метод ответа на ситуационный вопрос', 'Understanding of mechanisms and the method in a situational question') },
      { id: 'sandbox', left: bi('Живая песочница', 'Live sandbox'), right: bi('Как далеко вы продвинетесь сами, пользуясь документацией', 'How far you get on your own, with the documentation') },
      { id: 'final', left: bi('Финал с руководителем', 'Final round with the manager'), right: bi('Команда, процессы и ваши собственные вопросы', 'The team, the processes, your own questions') },
    ],
    explain: bi('Каждый этап проверяет своё, поэтому и готовиться к каждому стоит по-своему.', 'Each stage checks something else, so each needs its own preparation.'),
  },
  {
    id: 'career.q.logic',
    kind: 'mcq',
    concepts: ['career.logic'],
    prompt: bi('Вас спрашивают: «Как проверить, что служба слушает порт?» Какой ответ лучше всего показывает понимание?', 'To “How do you check that a service listens on a port?”, which answer best shows understanding?'),
    options: [
      { id: 'cmd', text: '`ss -tlnp`', why: bi('Команда верная, но из ответа не видно, понимаете ли вы, что такое сокет, который ждёт соединений, и что означают флаги.', 'The command is right, but the answer does not show whether you understand what a listening socket is and what the flags mean.') },
      { id: 'logic', text: bi('Служба открывает сокет и ждёт соединений на определённом адресе и порту, а ядро знает все такие сокеты. Командой `ss -tlnp` я прошу у ядра список TCP-сокетов, которые ждут соединений, вместе с процессами и смотрю, на каком адресе слушает служба, потому что к службе на адресе 127.0.0.1 снаружи не подключиться.', 'The service opens a socket and waits for connections on an address and port; the kernel knows all such sockets. I ask the kernel for the listening TCP sockets with their processes — `ss -tlnp` — and look at the address: 127.0.0.1 is not reachable from outside.'), correct: true },
      { id: 'curl', text: bi('Обращусь к порту командой `curl`, и если ответ пришёл, значит, служба слушает.', 'I would call the port with `curl`, and if an answer comes, the service listens.'), why: bi('Команда `curl` заодно проверяет протокол и путь по сети, поэтому, если ответа нет, вы не узнаете, что не так.', '`curl` also tests the protocol and the network path; silence will not tell you what exactly is wrong.') },
      { id: 'ps', text: bi('Посмотрю в выводе `ps aux`, запущена ли служба.', 'I would check `ps aux` to see whether the service is running.'), why: bi('Если процесс запущен, это ещё не значит, что он слушает порт, ведь порт мог оказаться занят или служба могла начать слушать не тот адрес.', 'A running process does not yet mean a listening port, because the port may have been busy or the service may be listening on the wrong address.') },
    ],
    explain: bi('Сначала объясните механизм, затем назовите команду, которая позволяет его увидеть, и скажите, что из увиденного следует.', 'The mechanism, then the command as a way to see it, then what follows from it.'),
  },
  {
    id: 'career.q.five',
    kind: 'multi',
    concepts: ['career.interview'],
    prompt: bi('Что нанимающий инженер ищет в начинающем кандидате? Отметьте всё верное.', 'What does a hiring engineer look for in a junior? Mark everything that is true.'),
    options: [
      { id: 'mech', text: bi('Понимание механизма, а не память на команды', 'Understanding of the mechanism, not a memory for commands'), correct: true },
      { id: 'docs', text: bi('Умение найти ответ в документации самому', 'Finding the answer in the documentation on your own'), correct: true },
      { id: 'honest', text: bi('Готовность признать, где кончаются ваши знания', 'Willingness to admit where your knowledge ends'), correct: true },
      { id: 'certs', text: bi('Как можно больше сертификатов', 'As many certificates as possible'), why: bi('При найме начинающего инженера сертификаты почти не влияют на решение, потому что репозиторий и умение его объяснить весят больше.', 'When a junior is hired, certificates barely affect the decision, because a repository and the ability to explain it weigh more.') },
      { id: 'all', text: bi('Опыт со всеми инструментами из вакансии', 'Experience with every tool in the vacancy'), why: bi('Требования в вакансиях завышают намеренно, а от начинающего инженера ждут знания основ и умения учиться.', 'Requirements are inflated on purpose; a junior is expected to have the basics and the ability to learn.') },
    ],
  },
  // ── career.answer ──
  {
    id: 'career.q.order-parts',
    kind: 'order',
    concepts: ['career.answer-structure'],
    prompt: bi('Расставьте части ответа на вопрос «Что такое DNS?» в правильном порядке.', 'Put the parts of the answer to “What is DNS?” in the right order.'),
    steps: [
      { id: 'what', text: bi('DNS превращает имя в адрес и другие записи', 'DNS turns a name into an address and other records') },
      { id: 'why', text: bi('Люди и конфигурации пользуются именами, а адреса меняются', 'People and configs use names while addresses change') },
      { id: 'how', text: bi('Резолвер идёт от корня к серверу зоны и кэширует ответ на время TTL', 'The resolver walks from the root to the zone server and caches the answer for the TTL') },
      { id: 'when', text: bi('Проверяю это командой `dig` через резолвер и напрямую у сервера, который хранит записи зоны', 'I check it with `dig` through the resolver and directly at the server that holds the zone’s records') },
    ],
    explain: bi('Части идут в порядке «что, зачем, как, когда», и команда стоит последней, потому что служит способом увидеть механизм.', 'What → why → how → when: the command comes last, as a way to see the mechanism.'),
  },
  {
    id: 'career.q.dont-know',
    kind: 'mcq',
    concepts: ['career.dont-know'],
    prompt: bi('Интервьюер спрашивает о Consul, с которым вы не работали. Какой ответ лучше?', 'The interviewer asks about Consul, which you have never used. Which answer is best?'),
    options: [
      { id: 'honest', text: bi('«Не работал. Судя по задаче, речь об обнаружении сервисов, а в Kubernetes эту задачу решают DNS кластера и объекты Service. Выяснял бы по документации Consul, по разделу об обнаружении сервисов, и проверил бы в песочнице».', '“I haven’t used it. From the task it sounds like service discovery — in Kubernetes cluster DNS and Services solve that. I’d find out from the Consul docs, the service discovery section, and test it in a sandbox.”'), correct: true },
      { id: 'invent', text: bi('«Consul — это балансировщик нагрузки, как nginx».', '“Consul is a load balancer, like nginx.”'), why: bi('За уверенную выдумку ставят ноль по честности, и после неё интервьюер сомневается во всём, что вы сказали.', 'A confident invention scores zero for honesty; after it the interviewer doubts everything else.') },
      { id: 'skip', text: bi('«Не знаю. Следующий вопрос?»', '“I don’t know. Next question?”'), why: bi('Ответ честный, но вы не связали вопрос с тем, что знаете, и не сказали, как выяснили бы ответ, а значит, упустили случай показать ход своих рассуждений.', 'Honest, but with no link to what you know and no plan to find out; it wastes the chance to show your reasoning.') },
      { id: 'google', text: bi('«Не знаю, но погуглю».', '“I don’t know, but I’ll google it.”'), why: bi('Вы не назвали источник, а слово «погуглю» не показывает, что вы умеете искать.', 'No source named: “I’ll google it” does not show that you know how to look.') },
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
      { id: 'kill', text: bi('Надо делать `docker kill`', 'You should run `docker kill`'), why: bi('Это совет выполнить команду, и из него не видно, почему `docker stop` ждёт.', 'This is a command-as-advice: it does not show why `stop` waits.') },
      { id: 'df', text: bi('Смотрю `df -h`', 'I look at `df -h`'), why: bi('Здесь названа команда, но не сказано, что она показывает и чем отличается от `du`.', 'A command without saying what it shows and how it differs from `du`.') },
    ],
  },
  // ── career.classics ──
  {
    id: 'career.q.cd-match',
    kind: 'match',
    concepts: ['career.q-ci-cd'],
    prompt: bi('Сопоставьте каждый термин с его определением.', 'Match each term with its definition.'),
    pairs: [
      { id: 'ci', left: bi('Непрерывная интеграция', 'Continuous integration'), right: bi('Изменения часто сливают в общую ветку, и каждое слияние собирается и проверяется тестами', 'Frequent merges into a shared branch, each built and tested') },
      { id: 'delivery', left: bi('Непрерывная доставка', 'Continuous delivery'), right: bi('Каждое изменение готово к выкладке, но выкладку запускает человек', 'Every change is releasable; a person starts the release') },
      { id: 'deploy', left: bi('Непрерывное развёртывание', 'Continuous deployment'), right: bi('Выкладка на рабочие серверы идёт автоматически, без ручного шага', 'The release to production is automatic, with no manual step') },
    ],
    explain: bi('Две CD различаются тем, есть ли ручной шаг перед выкладкой на рабочие серверы.', 'The line between the two CDs is whether there is a manual step before production.'),
  },
  {
    id: 'career.q.vm-multi',
    kind: 'multi',
    concepts: ['career.q-vm-container'],
    prompt: bi('Что верно о контейнере в сравнении с виртуальной машиной? Отметьте всё верное.', 'What is true of a container compared with a virtual machine? Mark everything that is true.'),
    options: [
      { id: 'kernel', text: bi('Контейнер пользуется ядром хоста', 'A container uses the host’s kernel'), correct: true },
      { id: 'ns', text: bi('Собственный вид системы контейнеру показывают пространства имён', 'Namespaces give a container its own view of the system'), correct: true },
      { id: 'cg', text: bi('Ресурсы контейнера ограничивают cgroups', 'cgroups limit a container’s resources'), correct: true },
      { id: 'hyper', text: bi('Контейнер работает поверх гипервизора со своим ядром', 'A container runs on a hypervisor with its own kernel'), why: bi('Так устроена виртуальная машина, а не контейнер.', 'That describes a virtual machine.') },
      { id: 'stronger', text: bi('Контейнер изолирован сильнее, чем виртуальная машина', 'A container is isolated more strongly than a VM'), why: bi('Всё наоборот, потому что ядро у контейнеров общее, и уязвимость в ядре затрагивает все контейнеры хоста.', 'It is the other way round, because containers share the kernel, and a kernel vulnerability affects every container on the host.') },
    ],
  },
  {
    id: 'career.q.windows',
    kind: 'mcq',
    concepts: ['career.q-vm-container'],
    prompt: bi('Можно ли в контейнере на Linux-хосте запустить Windows-приложение, которому нужно ядро Windows?', 'Can a container on a Linux host run a Windows application that needs the Windows kernel?'),
    options: [
      { id: 'no', text: bi('Нет, потому что контейнер пользуется ядром хоста, а здесь ядро Linux', 'No: a container uses the host’s kernel, and here it is Linux'), correct: true },
      { id: 'yes', text: bi('Да, если взять образ Windows, ведь в образе есть всё, что нужно для запуска системы', 'Yes, with a Windows image, since the image holds everything needed to boot the system'), why: bi('Образ содержит только файлы, а ядро контейнер всегда берёт у хоста.', 'An image is files, not a kernel. A container always gets the host’s kernel.') },
      { id: 'priv', text: bi('Да, если запустить контейнер в привилегированном режиме с доступом ко всем устройствам хоста', 'Yes, if the container runs in privileged mode with access to all the host’s devices'), why: bi('Привилегированный режим даёт контейнеру больше прав в том же ядре, но другого ядра не даёт.', 'Privileges give more rights within the same kernel, not another kernel.') },
    ],
    explain: bi('Для другой операционной системы нужна виртуальная машина, а её можно запустить даже внутри Kubernetes.', 'Another OS needs a virtual machine — which can even run inside Kubernetes.'),
  },
  {
    id: 'career.q.nesting',
    kind: 'mcq',
    concepts: ['career.q-vm-container'],
    prompt: bi('Какая фраза лучше всего завершает ответ на вопрос «виртуальная машина или контейнер»?', 'Which sentence best ends an answer to “VM or container”?'),
    options: [
      { id: 'nest', text: bi('Они вкладываются друг в друга, ведь в облаке контейнеры работают внутри виртуальных машин, а виртуальные машины можно запускать в Kubernetes', 'They nest inside each other: in the cloud containers run inside VMs, and VMs can run inside Kubernetes'), correct: true },
      { id: 'replace', text: bi('Контейнеры полностью заменили виртуальные машины: новые системы строят только на контейнерах, а виртуальные машины остались лишь в старых проектах', 'Containers have completely replaced virtual machines: new systems are built on containers only, and VMs survive just in old projects'), why: bi('Это не так, ведь почти все контейнеры в облаке работают внутри виртуальных машин.', 'That is not so, because nearly every container in the cloud runs inside a VM.') },
      { id: 'old', text: bi('Виртуальные машины устарели', 'VMs are an outdated technology'), why: bi('Виртуальные машины нужны для сильной изоляции и для другой операционной системы, и их запускают даже современные платформы на Kubernetes.', 'VMs are needed for strong isolation and another OS; modern Kubernetes-based platforms run them too.') },
    ],
  },
  // ── career.situational ──
  {
    id: 'career.q.method-order',
    kind: 'order',
    concepts: ['career.situational', 'career.mitigate-first'],
    prompt: bi('Расставьте по порядку шаги ответа на вопрос «сайт отвечает ошибкой 504, что вы будете делать?».', 'Put the steps of an answer to “504 — what do you do?” in order.'),
    steps: [
      { id: 'ask', text: bi('Уточнить, насколько широк сбой, когда он начался и что перед ним менялось', 'Ask how wide the failure is, when it started and what changed before it') },
      { id: 'confirm', text: bi('Подтвердить симптом снаружи и понять, кто отвечает ошибкой 504', 'Confirm the symptom from outside and find who answers 504') },
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
    prompt: bi('В журнале ошибок nginx записано: `upstream timed out (110: Connection timed out) while connecting to upstream`. Что это значит?', 'The nginx log says: `upstream timed out (110: Connection timed out) while connecting to upstream`. What does it mean?'),
    options: [
      { id: 'connect', text: bi('nginx не соединился с приложением по TCP, поэтому ищите причину в сети', 'nginx could not open a TCP connection to the app: check the network'), correct: true },
      { id: 'slow', text: bi('Приложение получило запрос, но отвечает так медленно, что nginx не дождался ответа', 'The application got the request but answers so slowly that nginx gave up waiting'), why: bi('Тогда строка кончалась бы словами «while reading response header», которые означают, что соединение установлено, а ответа нет.', 'Then the line would end with “while reading response header”, which means that a connection exists but no answer has come.') },
      { id: 'dns', text: bi('Имя сайта не превращается в адрес, потому что DNS-сервер не отвечает на запросы', 'The site’s name does not resolve to an address because the DNS server does not answer'), why: bi('Клиент уже нашёл nginx по имени, а nginx пишет о соединении с приложением, которое стоит за ним (upstream).', 'The client already reached nginx by name, and nginx is talking about the upstream.') },
    ],
  },
  {
    id: 'career.q.bad-paths',
    kind: 'multi',
    concepts: ['career.situational', 'career.mitigate-first'],
    prompt: bi('Какие действия при ошибке 504 ведут по плохому пути? Отметьте все.', 'Which actions are bad paths for a 504? Mark them all.'),
    options: [
      { id: 'timeout', text: bi('Сразу увеличить proxy_read_timeout', 'Raise proxy_read_timeout right away'), correct: true, why: bi('Так проблема только прячется, потому что пользователи ждут дольше, а причина остаётся на месте.', 'This only hides the problem, because users wait longer while the cause stays in place.') },
      { id: 'restart', text: bi('Перезапустить всё до чтения журналов', 'Restart everything before reading the logs'), correct: true, why: bi('Перезапуск стирает улики и не убирает причину.', 'Destroys the evidence and leaves the cause.') },
      { id: 'dns', text: bi('Проверять DNS, когда в ответе стоит заголовок `server: nginx`', 'Check DNS when the answer is signed `server: nginx`'), correct: true, why: bi('Эта гипотеза противоречит наблюдению, ведь запрос уже дошёл до nginx, а значит, имя превратилось в адрес.', 'The hypothesis contradicts the observation, because the request has already reached nginx, which means the name has turned into an address.') },
      { id: 'curl', text: bi('Сделать `curl -sv` к странице', 'Run `curl -sv` against the page'), why: bi('Это хороший первый шаг, потому что команда показывает, кто отвечает ошибкой 504.', 'This is a good first step, because the command shows who answers 504.') },
      { id: 'errlog', text: bi('Прочитать журнал ошибок nginx', 'Read the nginx error log'), why: bi('Чтение журнала и есть сбор улик.', 'That is collecting evidence.') },
    ],
  },
  {
    id: 'career.q.previous',
    kind: 'fill-command',
    concepts: ['career.situational'],
    prompt: bi('Под находится в состоянии CrashLoopBackOff. Допишите команду так, чтобы увидеть журнал упавшего запуска, а не текущего.', 'A pod is in CrashLoopBackOff. Complete the command to see the log of the crashed run, not the current one.'),
    template: 'kubectl logs api-7c9d8f6b5-2xkqp -n shop ___',
    answers: ['--previous', '-p', '--previous=true'],
    misconceptions: [{ match: '-f|--follow', why: bi('`-f` следит за текущим запуском, а он ещё не начался.', '`-f` follows the current run, which has not started yet.') }],
    explain: bi('Журнал предыдущего контейнера хранится до следующего перезапуска, а команда `kubectl delete pod` удаляет его вместе с подом.', 'The previous container’s log is kept until the next restart; `kubectl delete pod` destroys it with the pod.'),
  },
  {
    id: 'career.q.status',
    kind: 'mcq',
    concepts: ['career.status-update'],
    prompt: bi('Какой статус для чата команды написан лучше?', 'Which status message to the team is best?'),
    options: [
      { id: 'good', text: bi('«С 14:10 оплата не проходит у всех пользователей: около 30 % запросов заканчиваются ошибкой 504. Откатываем версию, выложенную в 14:05. Следующий статус в 14:40 или раньше, если ошибок не станет меньше».', '“Checkout for everyone: about 30% of requests return 504 since 14:10. Rolling back the 14:05 release. Next update at 14:40, or earlier if errors do not drop.”'), correct: true },
      { id: 'vague', text: bi('«Сайт что-то тормозит, смотрю».', '“The site is slow-ish, looking.”'), why: bi('В статусе не сказано, насколько велико влияние, нет конкретного действия и времени следующего сообщения.', 'No scale of impact, no concrete action, no time for the next message.') },
      { id: 'blame', text: bi('«Кто-то выложил кривую версию, разбираюсь».', '“Someone shipped a broken release, dealing with it.”'), why: bi('Вместо влияния и плана статус ищет виноватого, а во время инцидента это только мешает.', 'Blame instead of impact and a plan; during an incident it only gets in the way.') },
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
      { id: 'keep', text: bi('Оставит 3, потому что нейросеть видела ответ целиком и ей виднее', 'Keep the 3, because the AI saw the whole answer and knows best'), why: bi('Балл без доказательства может оказаться лестью нейросети, поэтому каждую цитату сверяют с расшифровкой.', 'A score without proof is the model flattering you; that is why every quote is checked against the transcript.') },
      { id: 'zero', text: bi('Поставит 0, потому что неподтверждённый ответ ничего не стоит', 'Set it to 0, because an unconfirmed answer is worth nothing'), why: bi('Ноль означает, что ответ не выдержал уточнения. Здесь неизвестно, заслуживал ли ответ меньше 1, поэтому балл опускают только до 1.', 'Zero means “did not survive the follow-up”; here it is unknown whether it was worse than 1, so the score drops only to 1.') },
    ],
  },
  {
    id: 'career.q.honesty-zero',
    kind: 'mcq',
    concepts: ['career.rubric', 'career.mock-interview'],
    prompt: bi('Средний балл учебного интервью 2,5, но по честности стоит один ноль. Готов ли кандидат к живым собеседованиям?', 'A mock interview averages 2.5, but honesty has one 0. Is the candidate ready for live interviews?'),
    options: [
      { id: 'no', text: bi('Нет, потому что ноль по честности проваливает интервью целиком', 'No: a zero for honesty fails the whole interview'), correct: true },
      { id: 'yes', text: bi('Да, ведь средний балл выше 2, а решение принимают по среднему баллу', 'Yes, because the mean is above 2, and the decision is made on the mean'), why: bi('Выдуманный ответ на настоящем собеседовании обесценивает все остальные ответы, поэтому честность остаётся единственным критерием, ноль по которому проваливает всё интервью.', 'An invented answer at a real interview devalues all the others; that is why honesty is the one criterion whose zero fails everything.') },
    ],
  },
  {
    id: 'career.q.star',
    kind: 'order',
    concepts: ['career.mock-interview'],
    prompt: bi('Расставьте части ответа на просьбу «Расскажите о своей ошибке» по схеме STAR.', 'Put the parts of an answer to “Tell us about a mistake” in STAR order.'),
    steps: [
      { id: 's', text: bi('Ситуация, то есть где и когда это было', 'The situation, that is, where and when it was') },
      { id: 't', text: bi('Задача, то есть что нужно было сделать', 'The task, that is, what had to be done') },
      { id: 'a', text: bi('Действие, то есть что сделали вы сами', 'The action, that is, what you yourself did') },
      { id: 'r', text: bi('Результат и то, что вы изменили после', 'The result, and what you changed afterwards') },
    ],
  },
  // ── career.pitch ──
  {
    id: 'career.q.pitch-order',
    kind: 'order',
    concepts: ['career.pitch'],
    prompt: bi('Расставьте части самопрезентации по порядку.', 'Put the parts of a self-presentation in order.'),
    steps: [
      { id: 'who', text: bi('Кто я и откуда, одной фразой', 'Who I am and where from — one sentence') },
      { id: 'can', text: bi('Что я умею, с подтверждениями', 'What I can do — with proof') },
      { id: 'story', text: bi('Одна история о том, какая была проблема, что я сделал и что изменилось', 'One story about what the problem was, what I did and what changed') },
      { id: 'why', text: bi('Почему DevOps, то есть мост от прежнего опыта к новой работе', 'Why DevOps, that is, the bridge from earlier experience to the new job') },
      { id: 'seek', text: bi('Что я ищу', 'What I am looking for') },
    ],
  },
  {
    id: 'career.q.apologies',
    kind: 'multi',
    concepts: ['career.pitch'],
    prompt: bi('Какие фразы стоит убрать из самопрезентации? Отметьте все.', 'Which phrases should go from a self-presentation? Mark them all.'),
    options: [
      { id: 'sorry', text: bi('«К сожалению, у меня нет опыта работы в IT»', '“Unfortunately, I have no IT work experience”'), correct: true, why: bi('Извинение ещё до вопросов внушает слушателю, что вы не подходите.', 'An apology sets a “I don’t fit” tone before any questions.') },
      { id: 'only', text: bi('«Я пока только учусь»', '“I am only learning so far”'), correct: true, why: bi('Эта фраза обесценивает то, что вы уже сделали, а лучше назвать сделанное.', 'It devalues what you have already done; better to name it.') },
      { id: 'proof', text: bi('«Сдал практические экзамены по Linux и Docker; мой проект — github.com/…»', '“Passed the practical exams on Linux and Docker; my project is github.com/…”'), why: bi('Это подтверждение навыков, и его стоит оставить.', 'That is proof, exactly what to keep.') },
      { id: 'bridge', text: bi('«Три года разбирал инциденты на первой линии — теперь хочу их предотвращать»', '“For three years I handled incidents on the first line; now I want to prevent them”'), why: bi('Это мост от прежнего опыта, и он делает самопрезентацию сильнее.', 'That is a bridge from earlier experience, and it makes the self-presentation stronger.') },
    ],
  },
  {
    id: 'career.q.no-experience',
    kind: 'mcq',
    concepts: ['career.awkward'],
    prompt: bi('Вас спрашивают: «У вас нет опыта, почему мы должны вас взять?» Какой ответ лучше?', '“You have no experience — why should we hire you?” Which answer is best?'),
    options: [
      { id: 'proof', text: bi('«Опыта работы DevOps-инженером у меня нет. Зато есть то, что можно открыть: три пет-проекта с конвейером и мониторингом и история о том, как в одном из них кончилось место на диске и как я нашёл причину».', '“I have no experience as a DevOps engineer. I have things you can open: three pet projects with pipelines and monitoring, and the story of how one of them ran out of disk and how I found it.”'), correct: true },
      { id: 'fake', text: bi('«Я два года работал DevOps-инженером на фрилансе: настраивал серверы, конвейеры и мониторинг для нескольких заказчиков. Названия компаний и сами проекты показать не могу, потому что подписывал договор о неразглашении».', '“I worked as a freelance DevOps engineer for two years: I set up servers, pipelines and monitoring for several clients. I can’t name the companies or show the projects because I signed a non-disclosure agreement.”'), why: bi('Если такой работы не было, это выдумка, и она раскроется на первом же уточнении.', 'If it did not happen, it is an invention: it falls apart at the first follow-up.') },
      { id: 'learn', text: bi('«Я быстро учусь и стрессоустойчив».', '“I learn fast and handle stress well.”'), why: bi('Это пустые слова, потому что их говорит каждый, а проверить их нельзя.', 'These are empty words, because everyone says them and nobody can check them.') },
    ],
  },
  // ── career.resume ──
  {
    id: 'career.q.cv-bug',
    kind: 'bugfind',
    concepts: ['career.evidence'],
    prompt: bi('В этом фрагменте резюме одна строка нарушает правило «описывать действие и результат, а не обязанности». Нажмите на эту строку.', 'One line of this CV fragment breaks the rule “actions and results, not duties”. Click it.'),
    lang: 'text',
    code: 'Junior DevOps Engineer\nПроект: магазин в docker compose — github.com/me/shop\n• Настроил конвейер GitLab CI: линт, тесты, сборка образа, выкладка\n• Отвечал за поддержку серверов\n• Добавил алерт на заполнение диска, который сработал за 3 часа до сбоя',
    bug: [4],
    why: {
      1: bi('В заголовке стоит роль, на которую вы претендуете, и так и должно быть.', 'The headline is the target role: as it should be.'),
      2: bi('Проект со ссылкой на репозиторий подтверждает навык.', 'A project with a repository link is evidence.'),
      3: bi('Пункт называет действие и то, что сделано, и это хороший пункт.', 'An action and what exactly was done: a good bullet.'),
      4: bi('Слова «отвечал за…» описывают обязанность, а не действие, и из них непонятно, что вы сделали и что после этого изменилось.', 'The words “was responsible for…” describe a duty rather than an action, and they do not say what you did or what changed afterwards.'),
      5: bi('Пункт называет действие и измеримый результат, и написать его лучше трудно.', 'An action and a measurable result: the best kind of bullet.'),
    },
  },
  {
    id: 'career.q.cv-irrelevant',
    kind: 'multi',
    concepts: ['career.bridge'],
    prompt: bi('Какие строки резюме бывшего продавца стоит сжать или убрать в DevOps-версии? Отметьте все.', 'Which lines of a former salesperson’s CV should be shortened or removed in the DevOps version? Mark them all.'),
    options: [
      { id: 'plan', text: bi('«Выполнил план продаж на 120% во втором квартале»', '“Hit 120% of the sales plan in Q2”'), correct: true, why: bi('Достижение хорошее, но к новой роли отношения не имеет, поэтому оставьте одну строку о должности, без подробностей.', 'A fine achievement, but it has nothing to do with the new role, so leave one line about the position without details.') },
      { id: 'pc', text: bi('«Уверенный пользователь ПК»', '“Confident PC user”'), correct: true, why: bi('Это пустая формулировка, и в резюме DevOps-инженера она звучит странно.', 'An empty phrase: for DevOps it sounds odd.') },
      { id: 'req', text: bi('«Собирал требования клиентов и переводил их в задачи для технической команды»', '“Gathered customer requirements and turned them into tasks for the technical team”'), why: bi('Это мост к DevOps, и его стоит оставить.', 'This is a bridge to DevOps — keep it.') },
      { id: 'auto', text: bi('«Автоматизировал отчёты и сократил работу над ними с 6 часов до 1 часа в неделю»', '“Automated reports and cut the work on them from 6 hours to 1 hour a week”'), why: bi('Пункт об автоматизации с измеримым результатом ценен для DevOps.', 'Automation with a result is a valuable bullet.') },
    ],
  },
  {
    id: 'career.q.evidence',
    kind: 'mcq',
    concepts: ['career.evidence'],
    prompt: bi('Что лучше всего подтверждает навык «Docker» в резюме начинающего инженера?', 'What best backs the skill “Docker” on a junior CV?'),
    options: [
      { id: 'repo', text: bi('Ссылка на репозиторий проекта с Dockerfile, compose и README', 'A link to a project repository with a Dockerfile, compose and a README'), correct: true },
      { id: 'course', text: bi('«Прошёл онлайн-курс по Docker и получил сертификат с отличием, номер сертификата указан»', '“Took an online Docker course and got a certificate with distinction, number included”'), why: bi('Пройденный курс не показывает, что вы умеете, а репозиторий или сданный практический экзамен показывают.', 'A course taken does not show what you can do; a repository or a practical exam does.') },
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
    prompt: bi('Какой критерий приёмки можно проверить?', 'Which acceptance criterion can be checked?'),
    options: [
      { id: 'ok', text: bi('После `git push` в ветку main новая версия выкладывается меньше чем за 5 минут, и на странице виден SHA последнего коммита', 'After a `git push` to the main branch the new version is released in under 5 minutes, and the page shows the last commit’s SHA'), correct: true },
      { id: 'nice', text: bi('Сайт работает быстро и надёжно', 'The site works fast and reliably'), why: bi('«Быстро» и «надёжно» без чисел не проверить.', '“Fast” and “reliable” without numbers cannot be checked.') },
      { id: 'modern', text: bi('Используются современные технологии', 'Modern technologies are used'), why: bi('Это не критерий, потому что в нём нечего измерить.', 'This is not a criterion, because there is nothing in it to measure.') },
    ],
  },
  {
    id: 'career.q.readme-key',
    kind: 'mcq',
    concepts: ['career.readme'],
    prompt: bi('Какой раздел README пет-проекта важнее всего для собеседования?', 'Which README section of a pet project matters most for an interview?'),
    options: [
      { id: 'broke', text: bi('Что сломалось по дороге и как вы это чинили', 'What broke on the way and how you fixed it'), correct: true },
      { id: 'run', text: bi('Как запустить', 'How to run it'), why: bi('Этот раздел нужен, но на собеседовании ценят вашу историю поломки и метод, а не инструкцию.', 'Necessary, but an interview values your failure story and method, not instructions.') },
      { id: 'badges', text: bi('Значки сборки и покрытия тестами в самом верху, под названием проекта', 'Build and test coverage badges at the very top, under the project name'), why: bi('Значки украшают README, но ничего не говорят о том, как вы думаете.', 'Decoration; it says nothing about how you think.') },
    ],
  },
  // ── career.search ──
  {
    id: 'career.q.apply',
    kind: 'mcq',
    concepts: ['career.rule-60'],
    prompt: bi('Анализатор вакансии показал, что вы подходите под все требования на 64 %, а под обязательные — на 75 %. Что делать?', 'The analyzer shows a 64% match, 75% on the required items. What do you do?'),
    options: [
      { id: 'apply', text: bi('Откликнуться и до собеседования подтянуть то, чего не хватает', 'Apply, and catch up on what is missing before the interview'), correct: true },
      { id: 'wait', text: bi('Подождать, пока совпадение станет 100%', 'Wait until the match is 100%'), why: bi('Требования завышают намеренно, и даже у тех, кого берут на работу, совпадение редко бывает полным.', 'Requirements are inflated on purpose; even hired candidates rarely match 100%.') },
      { id: 'lie', text: bi('Дописать в резюме недостающие навыки, чтобы совпадение с вакансией выросло', 'Add the missing skills to the CV so that the match with the vacancy goes up'), why: bi('Навык без подтверждения раскроется на первом же вопросе.', 'A skill without evidence comes apart at the very first question.') },
    ],
  },
  {
    id: 'career.q.little',
    kind: 'mcq',
    concepts: ['career.funnel'],
    prompt: bi('Вы отправляете 12 откликов в неделю, а путь одного отклика в среднем занимает 3 недели. Сколько откликов у вас в работе одновременно?', 'You send 12 applications a week; the average path of an application is 3 weeks. How many are in progress at once?'),
    options: [
      { id: '36', text: '36', correct: true },
      { id: '12', text: '12', why: bi('Число 12 показывает, сколько откликов уходит за одну неделю, а каждый отклик остаётся в работе три недели, поэтому одновременно их втрое больше.', 'The number 12 shows how many applications go out in one week, but each application stays in progress for three weeks, so three times as many are in progress at once.') },
      { id: '4', text: '4', why: bi('Здесь 12 разделили на 3, а нужно умножить, потому что по закону Литтла число откликов в работе равно потоку, умноженному на время в пути.', 'Here 12 was divided by 3, but it must be multiplied, because by Little’s law the number of applications in progress equals the flow times the time in the system.') },
    ],
  },
  {
    id: 'career.q.conversion',
    kind: 'mcq',
    concepts: ['career.funnel'],
    prompt: bi('Ответы на отклики приходят, но после скрининга вам почти всегда отказывают. Что улучшать первым?', 'Replies to applications come, but after screening it is nearly always a no. What do you improve first?'),
    options: [
      { id: 'pitch', text: bi('Самопрезентацию и рассказ о мотивации', 'The self-presentation and the motivation story'), correct: true },
      { id: 'cv', text: bi('Резюме и ключевые слова, по которым его находят рекрутеры', 'The CV and the keywords recruiters use to find it'), why: bi('Резюме уже работает, раз ответы приходят, а проблема возникает на следующем этапе.', 'The CV already works: replies come. The next stage is where it breaks.') },
      { id: 'more', text: bi('Откликаться в три раза чаще, чтобы приглашений стало больше', 'Apply three times as often to get more invitations'), why: bi('Если откликов станет больше, а доля прошедших скрининг останется прежней, вы получите только больше тех же отказов.', 'More applications at the same conversion means more of the same rejections.') },
    ],
  },
  {
    id: 'career.q.card-age',
    kind: 'mcq',
    concepts: ['career.funnel', 'career.retro'],
    prompt: bi('Отклик отправлен 16 дней назад, и ответа на него нет. Что с ним делать?', 'An application is 16 days old with no reply. What do you do with it?'),
    options: [
      { id: 'close', text: bi('Закрыть карточку, больше не ждать и держать поток откликов ровным', 'Close the card and stop waiting; keep the flow of applications steady'), correct: true },
      { id: 'wait', text: bi('Ждать ответа от этой компании и не отправлять новых откликов, пока он не придёт', 'Wait for this company’s reply and send no new applications until it arrives'), why: bi('Поиск работы устроен как поток, и если перестать откликаться, весь путь до предложения растянется.', 'The job search works as a flow, and if you stop applying, the whole path to an offer stretches out.') },
      { id: 'spam', text: bi('Писать рекрутеру каждый день', 'Write to the recruiter every day'), why: bi('Одно напоминание уместно, а ежедневные письма раздражают.', 'One reminder is fine; daily ones are not.') },
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
      { id: 'ci', text: bi('Конвейер ветки main третий час красный, и выкладки стоят', 'The main pipeline has been red for three hours — releases are blocked') },
    ],
    explain: bi('Инциденты берут в порядке влияния на пользователей и с учётом того, сколько времени осталось в запасе, а не в порядке прихода. Об отложенном инциденте сообщают в чате.', 'The order follows the impact on users and the time left, not the arrival time. A deferred incident is announced in the chat.'),
  },
  {
    id: 'career.q.blameless',
    kind: 'mcq',
    concepts: ['career.blameless'],
    prompt: bi('Какая строка раздела «способствующие факторы» в разборе инцидента написана лучше?', 'Which “contributing factors” line of an incident review is written best?'),
    options: [
      { id: 'system', text: bi('Миграция без индекса прошла ревью, потому что на стенде таблица маленькая; алерта на время ответа оформления не было', 'A migration without an index passed review because the staging table is small; there was no alert on checkout response time'), correct: true },
      { id: 'person', text: bi('Разработчик Петров не проверил запрос', 'Developer Petrov did not check the query'), why: bi('Это поиск виноватого, а если не изменить условия, в следующий раз ошибётся другой человек.', 'This is a search for someone to blame, and unless the conditions change, next time someone else makes the mistake.') },
      { id: 'root', text: bi('Корневая причина в человеческом факторе', 'Root cause: human error'), why: bi('Слова «человеческий фактор» не называют ни одного условия в системе, которое можно изменить.', '“Human error” names no condition of the system that can be changed.') },
    ],
  },
  {
    id: 'career.q.wip',
    kind: 'mcq',
    concepts: ['career.oncall'],
    prompt: bi('Вы разбираете ошибку 504, и тут приходит алерт о заполнении диска. Что вы будете делать?', 'You are working on a 504 when a disk alert arrives. What do you do?'),
    options: [
      { id: 'announce', text: bi('Написать в чат «вижу алерт о диске, у нас есть 4 часа, возьму его после 504» и продолжить работу над 504', 'Post “seen the disk alert, we have 4 hours, will take it after the 504” and continue with the 504'), correct: true },
      { id: 'switch', text: bi('Переключиться на диск, раз алерт уже пришёл, а 504 подождёт, пока вы освобождаете место и проверяете, что диск больше не растёт', 'Switch to the disk: the alert has come in, and the 504 can wait while you free up space and check that the disk stops growing'), why: bi('Оплата важнее для пользователей, а у диска есть запас времени, и, переключившись, вы замедлите работу над обоими инцидентами.', 'Users’ checkout matters more, and the disk has time left; switching slows both down.') },
      { id: 'ignore', text: bi('Молча отложить алерт и разобраться с ним потом', 'Silently ignore it and deal with it later'), why: bi('Об отложенном инциденте сообщают в чате, иначе команда не знает, что его кто-то заметил.', 'A deferred incident is announced: otherwise the team does not know anyone has seen it.') },
    ],
  },
];
