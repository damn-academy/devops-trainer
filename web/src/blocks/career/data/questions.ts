// Interview cards (10 §9.2): the question, a "bad" answer made of commands,
// the model answer in four parts (what → why → how → when), key points with
// the words that usually show them, and follow-ups an interviewer asks.
// The same cards feed the command → logic translator and the mock interviewer.

import { bi, type Bi } from '../../../core/i18n';
import type { AnswerPart, KeyPoint } from '../../../engine/quiz/rubric';

export interface InterviewCard {
  id: string;
  /** Route block the question belongs to; the mock interviewer asks only about blocks the learner has worked on. */
  block: string;
  question: Bi;
  /** An answer that quotes a command instead of explaining. */
  bad: Bi;
  model: Record<AnswerPart, Bi>;
  points: KeyPoint[];
  followups: Bi[];
  /** Where the model answer comes from (DL1 "this is from"). */
  source: { title: string; url: string };
}

const kp = (id: string, text: Bi, any: string[]): KeyPoint => ({ id, text, any });

export const CARDS: InterviewCard[] = [
  {
    id: 'q.dns',
    block: 'networks',
    question: bi('Как проверить, работает ли DNS?', 'How do you check that DNS works?'),
    bad: bi('`nslookup host`', '`nslookup host`'),
    model: {
      what: bi('DNS превращает имя вроде shop.example в адрес и другие записи.', 'DNS turns a name such as shop.example into an address and other records.'),
      why: bi('Люди и конфигурации пользуются именами, а адреса меняются, поэтому имя остаётся прежним, а запись обновляют в одном месте.', 'People and configs use names while addresses change, so the name stays the same and the record is updated in one place.'),
      how: bi('Программа спрашивает резолвер, адрес которого записан в /etc/resolv.conf. Если ответа нет в кэше, резолвер обращается к корневым серверам, затем к серверу зоны первого уровня, затем к серверу, который хранит записи нужной зоны, и запоминает ответ на время TTL.', 'The client asks the resolver from /etc/resolv.conf. If the answer is not cached, the resolver walks from the root servers to the top-level zone server, then to the authoritative server of the zone, and caches the answer for its TTL.'),
      when: bi('Сначала спрашиваю резолвер командой `dig shop.example`. Если ответ выглядит странно, спрашиваю напрямую сервер зоны командой `dig @ns1.example shop.example` и так отделяю проблему кэша от проблемы самой записи.', 'First I ask the resolver: `dig shop.example`. If the answer looks wrong I ask the authoritative server directly — `dig @ns1.example shop.example` — which separates a caching problem from a problem with the record itself.'),
    },
    points: [
      kp('name', bi('превращение имени в адрес', 'turning a name into an address'), ['адрес', 'address', '\\bip\\b']),
      kp('resolver', bi('резолвер', 'the resolver'), ['резолвер', 'resolver', 'resolv\\.conf']),
      kp('chain', bi('путь от корневых серверов к серверу зоны', 'the path from the root servers to the zone server'), ['корнев', 'root', 'авторитатив', 'authoritative']),
      kp('ttl', bi('кэш на время TTL', 'cache for the TTL'), ['ttl', 'кэш', 'cache']),
      kp('split', bi('сравнение ответов резолвера и сервера зоны отделяет кэш от записи', 'comparing the resolver with the zone server separates the cache from the record'), ['@', 'напрямую', 'directly']),
    ],
    followups: [bi('Что будет, если поменять запись, а TTL у неё сутки?', 'What happens if you change a record whose TTL is a day?'), bi('Откуда вы это знаете?', 'How do you know that?')],
    source: { title: 'dig(1)', url: 'https://man7.org/linux/man-pages/man1/dig.1.html' },
  },
  {
    id: 'q.vm-container',
    block: 'containers',
    question: bi('Чем контейнер отличается от виртуальной машины?', 'How is a container different from a virtual machine?'),
    bad: bi('Ну это как виртуалка, только легче: `docker run`.', 'It is like a VM, only lighter: `docker run`.'),
    model: {
      what: bi('Виртуальная машина имитирует целый компьютер: поверх гипервизора у неё работает собственное ядро операционной системы. Контейнер — обычный процесс хоста, которому ядро показывает собственный вид системы.', 'A virtual machine emulates a computer: it has its own OS kernel on top of a hypervisor. A container is an ordinary process of the host to which the kernel shows its own view of the system.'),
      why: bi('И то и другое изолирует приложения друг от друга, но цена разная. Виртуальная машина тяжелее и дольше запускается, зато изолирована сильнее, и в ней можно запустить другую операционную систему. Контейнер лёгкий и запускается за доли секунды.', 'Both isolate applications from each other at a different price: a VM is heavier and slower to start but isolates more strongly and can run another OS; a container is light and starts in a fraction of a second.'),
      how: bi('Собственный вид системы контейнеру дают пространства имён: у него свои процессы, своя сеть, своя файловая система и своё имя машины. Ресурсы контейнера ограничивают cgroups. Ядро у всех контейнеров общее, поэтому уязвимость в ядре затрагивает все контейнеры хоста.', 'The own view is namespaces: its own processes, network, file system, host name. Resources are limited by cgroups. The kernel is shared, so a kernel vulnerability affects every container on the host.'),
      when: bi('Одно не исключает другого: в облаке контейнеры почти всегда работают внутри виртуальных машин, а с помощью KubeVirt виртуальные машины запускают в Kubernetes. Виртуальную машину я выбираю, когда нужна сильная изоляция или другая операционная система, а контейнер — чтобы упаковать приложение и запускать его.', 'They are not either-or: in the cloud containers nearly always run inside VMs, and with KubeVirt VMs run inside Kubernetes. I choose a VM for strong isolation or another OS, a container to package and run applications.'),
    },
    points: [
      kp('kernel', bi('своё ядро против общего ядра', 'own kernel vs shared kernel'), ['ядр', 'kernel']),
      kp('ns', bi('пространства имён', 'namespaces'), ['namespace', 'пространств']),
      kp('cg', bi('cgroups ограничивают ресурсы', 'cgroups limit resources'), ['cgroup', 'си групп']),
      kp('trade', bi('следствия для скорости, плотности и изоляции', 'consequences for speed, density and isolation'), ['быстр', 'легч', 'плотн', 'faster', 'lighter', 'densit', 'изоляц', 'isolat']),
      kp('nest', bi('контейнеры работают в ВМ, а ВМ в Kubernetes', 'containers run in VMs, and VMs in Kubernetes'), ['внутри', 'inside', 'kubevirt', 'влож', 'nest']),
    ],
    followups: [bi('Можно ли в контейнере запустить Windows на Linux-хосте?', 'Can a container run Windows on a Linux host?'), bi('Что увидит `ps` внутри контейнера и почему?', 'What does `ps` show inside a container, and why?')],
    source: { title: 'namespaces(7)', url: 'https://man7.org/linux/man-pages/man7/namespaces.7.html' },
  },
  {
    id: 'q.ci-cd',
    block: 'cicd',
    question: bi('Чем непрерывная интеграция отличается от непрерывной доставки и непрерывного развёртывания?', 'How do continuous integration, continuous delivery and continuous deployment differ?'),
    bad: bi('Это когда `git push` и пайплайн зелёный.', 'It is when you `git push` and the pipeline is green.'),
    model: {
      what: bi('Это три ступени одного конвейера. При интеграции изменения часто сливают в общую ветку, и каждое слияние автоматически собирается и проверяется тестами. При доставке каждое изменение, прошедшее конвейер, в любой момент готово к выкладке. При развёртывании автоматической становится и выкладка на рабочие серверы.', 'Three stages of one pipeline. Integration: frequent merging into a shared branch with automatic build and tests. Delivery: every change that passed the pipeline can be released at any moment. Deployment: the release to production is automatic too.'),
      why: bi('Чем меньше изменение и чем раньше его проверили, тем дешевле найти ошибку и тем проще откатить.', 'The smaller the change and the sooner it is checked, the cheaper the bug and the easier the rollback.'),
      how: bi('При доставке последний шаг делает человек, который нажимает кнопку. При развёртывании ручного шага нет, поэтому нужны хорошие тесты, мониторинг и быстрый откат.', 'In delivery the last step is a button a person presses; in deployment there is no manual step, so it needs good tests, monitoring and a fast rollback.'),
      when: bi('Интеграция нужна всегда. Непрерывное развёртывание я включаю, когда команда доверяет тестам и умеет откатываться за минуты, а до тех пор пользуюсь доставкой с ручным решением.', 'Integration is always worth it. I switch on deployment when the team trusts its tests and can roll back in minutes; until then, delivery with a manual decision.'),
    },
    points: [
      kp('ci', bi('частое слияние + автоматическая проверка', 'frequent merge + automatic checks'), ['слия', 'merge', 'тест', 'test']),
      kp('delivery', bi('при доставке всё готово к выкладке, а решает человек', 'in delivery everything is releasable, and a person decides'), ['готов', 'ready', 'releasable', 'кнопк', 'button', 'вручн', 'manual']),
      kp('deploy', bi('при развёртывании нет ручного шага', 'in deployment there is no manual step'), ['автоматическ', 'automatic', 'без ручн', 'no manual']),
      kp('pre', bi('развёртыванию нужны тесты, мониторинг и откат', 'deployment needs tests, monitoring and a rollback'), ['откат', 'rollback', 'мониторинг', 'monitoring']),
    ],
    followups: [bi('Что вы сделаете, если тесты в конвейере нестабильны?', 'What do you do when the pipeline tests are flaky?')],
    source: { title: 'Continuous Delivery — Martin Fowler', url: 'https://martinfowler.com/bliki/ContinuousDelivery.html' },
  },
  {
    id: 'q.url',
    block: 'networks',
    question: bi('Что происходит, когда вы вводите адрес в браузере?', 'What happens when you type an address into a browser?'),
    bad: bi('Браузер делает GET и получает страницу.', 'The browser does a GET and gets the page.'),
    model: {
      what: bi('Это цепочка шагов от имени до готовой страницы: имя превращается в адрес, затем открывается соединение, согласуется шифрование, уходит запрос, приходит ответ, и браузер рисует страницу.', 'A chain of steps from a name to a rendered page: name → address → connection → encryption → request → response → rendering.'),
      why: bi('Каждый шаг ломается по-своему, и в том же порядке, в каком идут шаги, я ищу поломку.', 'Each step breaks in its own way, and the order of the steps is the order in which I look for a failure.'),
      how: bi('Браузер узнаёт адрес через DNS, открывает TCP-соединение (SYN, SYN-ACK, ACK) на порт 443, договаривается о TLS и проверяет сертификат, отправляет HTTP-запрос с заголовком Host, получает ответ с кодом и телом, затем догружает стили, скрипты и картинки.', 'The browser learns the address through DNS, opens a TCP connection (SYN, SYN-ACK, ACK) to port 443, negotiates TLS and checks the certificate, sends an HTTP request with a Host header, gets a response with a status and a body, then fetches styles, scripts and images.'),
      when: bi('Этой картой я пользуюсь при поиске неисправности: `dig` проверяет имя, а `curl -v` по шагам показывает соединение, TLS и ответ.', 'I use this map when debugging: `dig` for the name, `curl -v` shows the connection, TLS and the response step by step.'),
    },
    points: [
      kp('dns', bi('DNS превращает имя в адрес', 'DNS turns the name into an address'), ['dns']),
      kp('tcp', bi('TCP-рукопожатие', 'TCP handshake'), ['tcp', 'syn']),
      kp('tls', bi('TLS и сертификат', 'TLS and the certificate'), ['tls', 'сертификат', 'certificate', 'https']),
      kp('http', bi('HTTP-запрос и код ответа', 'HTTP request and status code'), ['http', 'запрос', 'request', 'код', 'status']),
      kp('render', bi('отрисовка и догрузка ресурсов', 'rendering and sub-resources'), ['отрис', 'render', 'стил', 'скрипт', 'script', 'style']),
    ],
    followups: [bi('А где здесь балансировщик и что он видит?', 'Where is the load balancer here, and what does it see?')],
    source: { title: 'MDN — How browsers work', url: 'https://developer.mozilla.org/en-US/docs/Web/Performance/How_browsers_work' },
  },
  {
    id: 'q.stop10',
    block: 'containers',
    question: bi('Почему `docker stop` иногда ждёт 10 секунд?', 'Why does `docker stop` sometimes take 10 seconds?'),
    bad: bi('Надо делать `docker kill`, он быстрее.', 'Use `docker kill`, it is faster.'),
    model: {
      what: bi('`docker stop` сначала вежливо просит процесс завершиться сигналом SIGTERM и только по истечении срока, по умолчанию 10 секунд, завершает его сигналом SIGKILL.', '`docker stop` first asks the process to exit politely with SIGTERM and only after a grace period — 10 seconds by default — kills it with SIGKILL.'),
      why: bi('Срок нужен, чтобы приложение закрыло соединения и дописало данные. Если ожидание длится все 10 секунд, значит, сигнал SIGTERM никто не обработал.', 'The grace period lets the application close connections and flush data. If the wait takes the full 10 seconds, nobody handled SIGTERM.'),
      how: bi('Главный процесс контейнера получает номер PID 1, а к процессу с этим номером ядро не применяет действия сигналов по умолчанию, поэтому без собственного обработчика SIGTERM игнорируется. Часто виновата shell-форма CMD: процессом PID 1 становится `sh -c`, и сигнал до приложения не доходит.', 'The main process of a container is PID 1, and the kernel does not apply default signal actions to PID 1: without its own handler SIGTERM is simply ignored. A common cause is the shell form of CMD: PID 1 becomes `sh -c` and the signal never reaches the application.'),
      when: bi('Исправляю это exec-формой CMD, командой `exec` в скрипте запуска или маленьким процессом init (`docker run --init`), а `docker kill` оставляю для зависших процессов.', 'I fix it with the exec form of CMD, `exec` in the start script or a tiny init (`docker run --init`), and keep `kill` for hung processes.'),
    },
    points: [
      kp('term', bi('SIGTERM, затем SIGKILL', 'SIGTERM, then SIGKILL'), ['sigterm', 'sigkill']),
      kp('grace', bi('срок 10 секунд', 'a 10-second grace period'), ['10', 'срок', 'grace']),
      kp('pid1', bi('PID 1 без действий по умолчанию', 'PID 1 has no default signal actions'), ['pid 1', 'pid1']),
      kp('shell', bi('shell-форма CMD прячет приложение за sh', 'shell-form CMD hides the app behind sh'), ['shell', 'sh -c', 'exec']),
    ],
    followups: [bi('Что изменится в Kubernetes и где там этот срок?', 'What changes in Kubernetes, and where is that grace period there?')],
    source: { title: 'docker container stop — Docker Docs', url: 'https://docs.docker.com/reference/cli/docker/container/stop/' },
  },
  {
    id: 'q.links',
    block: 'linux',
    question: bi('Чем жёсткая ссылка отличается от символической?', 'How does a hard link differ from a symbolic link?'),
    bad: bi('`ln` и `ln -s`.', '`ln` and `ln -s`.'),
    model: {
      what: bi('Жёсткая ссылка — ещё одно имя того же inode, а символическая ссылка — отдельный маленький файл, внутри которого записан путь.', 'A hard link is another name for the same inode. A symbolic link is a separate small file that holds a path.'),
      why: bi('Имя и данные файла в Linux разделены: данные и права файла хранятся в inode, а каталог — это таблица «имя → номер inode».', 'In Linux a file’s name and data are separate: data and permissions live in the inode, and a directory is a table of “name → inode number”.'),
      how: bi('У inode есть счётчик ссылок, и данные освобождаются, когда счётчик падает до нуля и файл никто не держит открытым. Жёсткая ссылка не может вести в другую файловую систему или на каталог. Символическая может, но остаётся «висячей», если файл, на который она указывает, удалили.', 'An inode has a link count; the data is freed when it drops to zero and no process holds the file open. A hard link cannot cross file systems or point to a directory; a symbolic link can, but dangles when the target is removed.'),
      when: bi('Символические ссылки я использую для версий и путей конфигурации (`current -> release-42`), а жёсткие редко, например чтобы не хранить одинаковые файлы в резервных копиях дважды.', 'Symbolic links for versions and config paths (`current -> release-42`), hard links rarely, for example to deduplicate backups.'),
    },
    points: [
      kp('inode', bi('inode', 'the inode'), ['inode', 'инод']),
      kp('count', bi('счётчик ссылок', 'the link count'), ['счётчик', 'count', 'nlink']),
      kp('fs', bi('жёсткая ссылка работает только в пределах одной файловой системы', 'a hard link works only within one file system'), ['файлов[а-я]* систем', 'file system', 'filesystem', 'раздел']),
      kp('dangle', bi('символическая ссылка повисает, если цель удалили', 'a symlink dangles without its target'), ['виси', 'dangl', 'broken', 'удал']),
    ],
    followups: [bi('Почему после `rm` большого журнала место на диске не освободилось?', 'Why was disk space not freed after `rm` of a big log?')],
    source: { title: 'link(2)', url: 'https://man7.org/linux/man-pages/man2/link.2.html' },
  },
  {
    id: 'q.disk',
    block: 'linux',
    question: bi('На сервере кончилось место. Что будете делать?', 'The server ran out of disk space. What do you do?'),
    bad: bi('`rm -rf /var/log/*`', '`rm -rf /var/log/*`'),
    model: {
      what: bi('Сначала нахожу, какой раздел заполнен и чем, и только потом освобождаю место, не трогая данные приложения.', 'First I find which partition is full and with what, and only then free space without touching the application’s data.'),
      why: bi('Слепое удаление стирает улики и журналы других служб, а место может не вернуться, если файл держит открытым процесс.', 'Blind deletion destroys evidence and other services’ logs, and the space may not come back if a process holds the file open.'),
      how: bi('`df -h` показывает, какой раздел заполнен, а `du -xh --max-depth=2` показывает, что занимает место. Если `df` и `du` расходятся, место держит удалённый, но открытый файл, и его видно в `/proc/<pid>/fd` или в выводе `lsof +L1`. Ещё бывает, что кончились inode, и это показывает `df -i`.', '`df -h` shows the partition, `du -xh --max-depth=2` where the space is. If `df` and `du` disagree, it is a deleted file still held open: it shows in `/proc/<pid>/fd` or via `lsof +L1`. Sometimes the inodes run out: `df -i`.'),
      when: bi('Освобождаю место безопасно: заставляю службу заново открыть журнал или опустошаю большой журнал командой `truncate -s 0`, а затем настраиваю ротацию и алерт, чтобы это не повторилось.', 'I free it safely: the service reopens its log, a huge log is truncated (`truncate -s 0`), then I set up rotation and an alert so it does not happen again.'),
    },
    points: [
      kp('df', bi('df показывает, какой раздел заполнен', 'df shows which partition is full'), ['\\bdf\\b', 'раздел', 'partition']),
      kp('du', bi('du показывает, где занято место', 'du shows where the space goes'), ['\\bdu\\b']),
      kp('open', bi('удалённый, но открытый файл', 'a deleted file still open'), ['открыт', 'open', 'lsof', '/proc']),
      kp('safe', bi('без удаления данных и улик', 'without deleting data or evidence'), ['улик', 'evidence', 'данн', 'data', 'truncate']),
      kp('prevent', bi('ротация и алерт', 'rotation and an alert'), ['ротац', 'rotat', 'алерт', 'alert']),
    ],
    followups: [bi('`df` показывает 100%, а `du` всего 40%. Почему?', '`df` says 100% and `du` 40%. Why?')],
    source: { title: 'lsof(8)', url: 'https://man7.org/linux/man-pages/man8/lsof.8.html' },
  },
  {
    id: 'q.apply',
    block: 'k8s-1',
    question: bi('Что происходит, когда вы выполняете `kubectl apply -f deployment.yaml`?', 'What happens when you run `kubectl apply -f deployment.yaml`?'),
    bad: bi('Kubernetes создаёт поды.', 'Kubernetes creates the pods.'),
    model: {
      what: bi('kubectl отправляет желаемое состояние в API-сервер, а дальше независимые контроллеры один за другим приводят реальное состояние кластера к желаемому.', 'kubectl sends the desired state to the API server, and independent controllers then bring reality to it, one after another.'),
      why: bi('Так система переживает сбои: никто не выполняет команду по шагам, а каждый контроллер постоянно сравнивает желаемое состояние с текущим и исправляет разницу.', 'That is how the system survives failures: nobody executes the command “step by step”; each controller keeps comparing desired and current state and fixes the difference.'),
      how: bi('API-сервер проверяет подлинность, права и admission и сохраняет объект в etcd. Контроллер Deployment создаёт ReplicaSet, контроллер ReplicaSet — объекты Pod, планировщик назначает поды на узлы, kubelet узла запускает контейнеры через среду выполнения и пишет статус обратно.', 'The API server checks authentication, authorisation and admission and stores the object in etcd. The Deployment controller creates a ReplicaSet, the ReplicaSet controller creates Pod objects, the scheduler assigns the pods to nodes, and the node’s kubelet starts containers through the runtime and writes the status back.'),
      when: bi('Эта цепочка — мой порядок отладки: `kubectl get` и `describe` показывают, на каком звене всё остановилось, а события — почему.', 'This chain is my debugging order: `kubectl get` and `describe` show at which link things stopped, and the events say why.'),
    },
    points: [
      kp('api', bi('API-сервер и etcd', 'the API server and etcd'), ['api', 'etcd']),
      kp('ctrl', bi('цепочка контроллеров от Deployment к ReplicaSet и к Pod', 'the controller chain from Deployment to ReplicaSet to Pod'), ['replicaset', 'контроллер', 'controller']),
      kp('sched', bi('планировщик назначает узел', 'the scheduler picks a node'), ['планировщ', 'scheduler']),
      kp('kubelet', bi('kubelet запускает контейнеры', 'the kubelet starts containers'), ['kubelet']),
      kp('reconcile', bi('желаемое против текущего', 'desired vs current state'), ['желаем', 'desired', 'текущ', 'current']),
    ],
    followups: [bi('Кто первым узнаёт о новом ReplicaSet и как?', 'Who is the first to learn about the new ReplicaSet, and how?')],
    source: { title: 'Kubernetes Components — kubernetes.io', url: 'https://kubernetes.io/docs/concepts/overview/components/' },
  },
  {
    id: 'q.probes',
    block: 'k8s-1',
    question: bi('Чем проверка готовности (readiness probe) отличается от проверки жизнеспособности (liveness probe)?', 'How does a readiness probe differ from a liveness probe?'),
    bad: bi('Это две проверки `/health`.', 'Both are checks of `/health`.'),
    model: {
      what: bi('Обе — регулярные проверки контейнера, которые делает kubelet, но последствия у них разные.', 'Both are regular checks of a container done by the kubelet, but they lead to different actions.'),
      why: bi('Если процесс работает, это ещё не значит, что он готов: приложение может заполнять кэш или лишиться соединения с базой и на время перестать отвечать.', 'Alive is not the same as ready: the application may be warming its cache or may have lost its database and temporarily cannot serve.'),
      how: bi('Если не проходит проверка жизнеспособности, kubelet перезапускает контейнер. Если не проходит проверка готовности, под убирают из конечных точек Service: запросы на него не идут, но перезапуска нет. Для приложений, которые долго запускаются, есть проверка запуска (startup probe), и, пока она не пройдена, проверку жизнеспособности не выполняют.', 'A failing liveness probe makes the kubelet restart the container. A failing readiness probe takes the pod out of the Service endpoints, so no traffic goes to it, but nothing restarts. For a slow start there is a startup probe: liveness is not checked until it passes.'),
      when: bi('Проверку готовности я ставлю почти всегда, а проверку жизнеспособности — только для настоящих зависаний. Внешнюю базу в ней я никогда не проверяю, иначе сбой базы перезапустит все поды разом.', 'I nearly always set readiness; liveness only for a real hang, and never check an external database in it, or a database outage restarts every pod at once.'),
    },
    points: [
      kp('restart', bi('проверка жизнеспособности ведёт к перезапуску', 'the liveness check leads to a restart'), ['перезапуск', 'restart']),
      kp('endpoints', bi('неготовый под исключается из конечных точек Service', 'a pod that is not ready is removed from the Service endpoints'), ['endpoint', 'конечн', 'трафик', 'traffic']),
      kp('startup', bi('проверка старта для долгого запуска', 'a startup probe for slow starts'), ['startup']),
      kp('trap', bi('не проверять зависимости в жизнеспособности', 'do not check dependencies in liveness'), ['баз', 'database', 'зависимост', 'dependenc']),
    ],
    followups: [bi('Что будет, если проверка готовности смотрит не на тот порт?', 'What happens if the readiness probe points at the wrong port?')],
    source: { title: 'Liveness, Readiness, and Startup Probes — kubernetes.io', url: 'https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/' },
  },
  {
    id: 'q.tfstate',
    block: 'iac',
    question: bi('Зачем Terraform нужен state?', 'Why does Terraform need state?'),
    bad: bi('Чтобы работал `terraform apply`.', 'So that `terraform apply` works.'),
    model: {
      what: bi('State — файл, где Terraform записывает, какому ресурсу из кода соответствует какой реальный объект у провайдера, с его атрибутами.', 'State is a file where Terraform records which real object at the provider corresponds to each resource in the code, with its attributes.'),
      why: bi('Без state Terraform не знает, что он уже создал: план не отличил бы «создать» от «изменить», и повторный apply создал бы копии ресурсов.', 'Without it Terraform cannot tell what it already created: the plan could not tell “create” from “change”, and a second apply would make duplicates.'),
      how: bi('`plan` читает код, state и обновлённое состояние провайдера и показывает разницу; `apply` вносит её и обновляет state. В команде state хранят удалённо, с блокировкой, чтобы двое не применили изменения одновременно.', '`plan` reads the code, the state and the refreshed provider state and shows the difference; `apply` makes it and updates the state. In a team the state lives remotely, with locking, so two people do not apply at once.'),
      when: bi('Удалённое хранилище state с блокировкой я настраиваю с первого дня работы в команде, а сам state в Git не кладу, потому что в нём бывают секреты.', 'A remote backend with locking from the first day of team work; I never put state in Git: it can contain secrets.'),
    },
    points: [
      kp('map', bi('соответствие кода и реальных объектов', 'the mapping of code to real objects'), ['соответств', 'map', 'реальн', 'real']),
      kp('plan', bi('plan сравнивает код, state и реальность', 'plan compares code, state and reality'), ['plan', 'разниц', 'diff']),
      kp('lock', bi('удалённый state с блокировкой', 'remote state with locking'), ['блокиров', 'lock', 'remote', 'удалённ']),
      kp('secret', bi('state не хранят в Git, потому что в нём секреты', 'state is not kept in Git, because it holds secrets'), ['секрет', 'secret', 'git']),
    ],
    followups: [bi('Что покажет plan, если удалить ресурс из state, но не из облака?', 'What will plan show if you remove a resource from the state but not from the cloud?')],
    source: { title: 'State — Terraform docs', url: 'https://developer.hashicorp.com/terraform/language/state' },
  },
  {
    id: 'q.rate',
    block: 'monitoring',
    question: bi('Что делает `rate()` в PromQL и зачем он нужен?', 'What does `rate()` do in PromQL, and why is it needed?'),
    bad: bi('`rate(http_requests_total[5m])`', '`rate(http_requests_total[5m])`'),
    model: {
      what: bi('`rate` считает среднюю скорость роста счётчика в секунду за окно.', '`rate` computes the average per-second increase of a counter over a window.'),
      why: bi('Счётчик только растёт и обнуляется при перезапуске процесса, поэтому само его значение ничего не говорит — важна скорость.', 'A counter only goes up and resets when the process restarts, so its raw value says little; what matters is how fast it grows.'),
      how: bi('Функция берёт значения счётчика внутри окна, учитывает сбросы и достраивает результат до границ окна. В окне должно быть хотя бы два значения, поэтому окно делают длиной в несколько интервалов опроса, обычно не меньше четырёх.', 'The counter’s samples inside the window are taken, resets are accounted for, and the result is extrapolated to the window edges. The window needs at least two samples, so it spans several scrape intervals, usually at least four.'),
      when: bi('Я пользуюсь `rate` для графиков запросов и ошибок в секунду и для алертов по доле ошибок, а к датчикам вроде занятой памяти `rate` не применяю.', 'For graphs of requests and errors per second and for error-ratio alerts; it is not used for gauges such as memory.'),
    },
    points: [
      kp('counter', bi('счётчик растёт и сбрасывается', 'a counter grows and resets'), ['счётчик', 'counter', 'сброс', 'reset']),
      kp('persec', bi('скорость в секунду за окно', 'per second over a window'), ['секунд', 'second', 'окн', 'window']),
      kp('samples', bi('нужно хотя бы две точки, то есть окно в несколько интервалов', 'at least two samples are needed, that is, a window of several intervals'), ['интервал', 'interval', 'точ', 'sample', 'scrape']),
      kp('gauge', bi('не для датчиков', 'not for gauges'), ['gauge', 'датчик']),
    ],
    followups: [bi('Почему график стал пустым, когда вы поставили окно [15s] при опросе раз в 15 секунд?', 'Why did the graph go empty with a [15s] window and a 15-second scrape interval?')],
    source: { title: 'Query functions — Prometheus', url: 'https://prometheus.io/docs/prometheus/latest/querying/functions/' },
  },
  {
    id: 'q.devops',
    block: 'methodology',
    question: bi('Что такое DevOps и чем занимается DevOps-инженер?', 'What is DevOps and what does a DevOps engineer do?'),
    bad: bi('Это Docker, Kubernetes и CI/CD.', 'It is Docker, Kubernetes and CI/CD.'),
    model: {
      what: bi('DevOps — это культура и набор практик, при которых разработка и эксплуатация вместе отвечают за изменение, от коммита до работы на рабочих серверах.', 'DevOps is a culture and a set of practices in which development and operations own a change together, from the commit to production.'),
      why: bi('Цель в том, чтобы выпускать изменения и часто, и надёжно, хотя раньше эти две цели тянули команды в разные стороны.', 'The goal is to ship changes both often and reliably; these goals used to pull teams in opposite directions.'),
      how: bi('Этого добиваются автоматизацией пути изменения (конвейер, инфраструктура как код), наблюдаемостью и короткой обратной связью. Результат измеряют метриками DORA: частотой выкладок, временем от коммита до выкладки на рабочие серверы, долей неудачных изменений и временем восстановления.', 'Through automating the path of a change (the pipeline, infrastructure as code), observability and short feedback loops. Results are measured with the DORA metrics: deployment frequency, lead time for changes, change failure rate and time to restore.'),
      when: bi('DevOps-инженер строит и поддерживает этот путь: конвейеры, окружения, мониторинг, разбор инцидентов, — и помогает командам им пользоваться.', 'The engineer builds and maintains that road — pipelines, environments, monitoring, incident reviews — and helps teams use it.'),
    },
    points: [
      kp('culture', bi('культура и практики, а не инструменты', 'culture and practices, not tools'), ['культур', 'culture', 'практик', 'practice']),
      kp('together', bi('разработка и эксплуатация вместе', 'development and operations together'), ['вместе', 'together', 'эксплуатац', 'operations']),
      kp('dora', bi('метрики DORA', 'the DORA metrics'), ['dora', 'частот', 'frequency', 'восстановл', 'restore']),
      kp('auto', bi('автоматизация пути изменения', 'automating the path of a change'), ['автоматиз', 'automat', 'конвейер', 'pipeline']),
    ],
    followups: [bi('Какая из метрик DORA, по-вашему, важнее всего для маленькой команды?', 'Which DORA metric matters most for a small team, in your view?')],
    source: { title: 'DORA — Get better at getting better', url: 'https://dora.dev/' },
  },
];

export function cardById(id: string): InterviewCard | undefined {
  return CARDS.find((c) => c.id === id);
}
