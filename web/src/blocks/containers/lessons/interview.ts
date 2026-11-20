// m14. Interview preparation: "container vs VM" answer builder and the twelve questions (04 §19).

import { bi } from '../../../core/i18n';
import type { Lesson, QuizItem } from '../../../core/types';
import { RU, SRC } from '../shared';

export const interviewQuiz: QuizItem[] = [
  {
    id: 'containers.q.answer-plan',
    kind: 'order',
    concepts: ['docker.vm-vs-container'],
    prompt: bi('Соберите ответ на вопрос «чем контейнер отличается от виртуальной машины» по плану: что это такое, как оно работает, что из этого следует и когда что выбирать.', 'Build the answer to “container vs VM” by the scheme: what it is → how it works → consequences → when to use which.'),
    steps: [
      { id: 'what', text: bi('Контейнер остаётся процессом хоста, а виртуальная машина работает как отдельный компьютер на виртуальном железе', 'A container is a host process; a VM is a separate computer on virtual hardware') },
      { id: 'how', text: bi('У контейнера пространства имён ограничивают то, что он видит (pid, net, mnt и другие), cgroup ограничивает ресурсы, а ядро общее. У виртуальной машины есть гипервизор и своё ядро', 'Container: namespaces limit visibility (pid, net, mnt…), cgroups limit resources, the kernel is shared. VM: a hypervisor and its own kernel') },
      { id: 'cons', text: bi('Отсюда следуют различия в размере, скорости запуска, плотности размещения и силе изоляции', 'Consequences: size, start time, density, strength of isolation') },
      { id: 'when', text: bi('Чужой код и программы, которым нужно другое ядро, запускают в виртуальных машинах, свои сервисы плотно размещают в контейнерах, а часто их используют вместе, например в облачных ВМ, в KubeVirt и в Kata Containers', 'When to use which: untrusted code and another kernel — VM; dense packing of your own services — containers; often together (cloud VMs, KubeVirt, Kata)') },
    ],
  },
  {
    id: 'containers.q.image-vs-container',
    kind: 'mcq',
    concepts: ['docker.image', 'docker.container'],
    prompt: bi('Чем образ отличается от контейнера?', 'How does an image differ from a container?'),
    options: [
      { id: 'right', text: bi('Образ служит неизменяемым шаблоном из слоёв и настроек, а контейнер получается, когда из этого образа запускают процесс со своим записываемым слоем', 'An image is an immutable template (layers + config); a container is a process started from it with its own writable layer'), correct: true },
      { id: 'same', text: bi('Образ и контейнер означают одно и то же под разными названиями', 'An image and a container are the same thing under different names'), why: bi('Из одного образа можно запустить сто контейнеров, и сам образ при этом не изменится.', 'A hundred containers can run from one image; the image does not change.') },
      { id: 'vm', text: bi('Образ можно считать виртуальной машиной, а контейнер программой в ней', 'An image can be thought of as a VM and a container as a program in it'), why: bi('Образ содержит только файлы и их описание, и никакой машины в нём нет.', 'An image is files and a description; there is no machine in it.') },
    ],
  },
  {
    id: 'containers.q.copy-add',
    kind: 'mcq',
    concepts: ['docker.dockerfile'],
    prompt: bi('Что выбрать для копирования файлов проекта, COPY или ADD, и почему?', 'COPY or ADD — which to use for copying project files, and why?'),
    options: [
      { id: 'copy', text: bi('COPY, потому что он только копирует. ADD ещё распаковывает локальные архивы tar и умеет скачивать файлы по URL, а такое неочевидное поведение лучше не включать случайно', 'COPY: it only copies. ADD also unpacks local tar files and can download URLs — non-obvious behaviour better not triggered by accident'), correct: true },
      { id: 'add', text: bi('ADD, потому что он новее и быстрее', 'ADD: it is newer and faster'), why: bi('ADD не быстрее. Его дополнительные возможности нужны редко, и когда они нужны, их выбирают сознательно.', 'ADD is not faster; its extra features are rarely needed, and then you choose them on purpose.') },
    ],
  },
  {
    id: 'containers.q.shrink',
    kind: 'multi',
    concepts: ['docker.multistage', 'docker.layer'],
    prompt: bi('Как уменьшить образ? Отметьте всё, что действительно помогает.', 'How do you make an image smaller? Mark everything that really helps.'),
    options: [
      { id: 'ms', text: bi('Многоэтапная сборка, при которой компилятор остаётся в стадии сборки', 'A multi-stage build: the compiler stays in the build stage'), correct: true },
      { id: 'base', text: bi('Минимальный базовый образ, например alpine, slim или distroless', 'A minimal base image such as alpine, slim or distroless'), correct: true },
      { id: 'same', text: bi('Чистить кэш пакетов в той же инструкции RUN, которая устанавливает пакеты', 'Clearing the package cache in the same RUN that installs the packages'), correct: true },
      { id: 'rm', text: bi('Отдельная инструкция `RUN rm -rf` в конце Dockerfile', 'A separate `RUN rm -rf` instruction at the end of the Dockerfile'), why: bi('Удаление в новом слое ничего не уменьшает, потому что файлы остались в нижних слоях.', 'Deleting in a new layer shrinks nothing: the files stay in the lower layers.') },
      { id: 'squash', text: bi('Перечислить в EXPOSE поменьше портов', 'Fewer EXPOSE ports'), why: bi('EXPOSE добавляет только строку в настройки образа и на его размер не влияет.', 'EXPOSE is a config line; it has no size.') },
    ],
  },
  {
    id: 'containers.q.code-137',
    kind: 'multi',
    concepts: ['docker.pid1', 'docker.lifecycle'],
    prompt: bi('Контейнер завершился с кодом 137. Назовите две самые вероятные причины.', 'A container exited with code 137. The two most likely causes?'),
    options: [
      { id: 'oom', text: bi('Его завершил OOM killer, потому что процесс превысил лимит памяти cgroup (в `docker inspect` будет `OOMKilled: true`)', 'The OOM killer killed it: the process went over the cgroup memory limit (`OOMKilled: true` in inspect)'), correct: true },
      { id: 'stop', text: bi('Docker послал SIGKILL после ожидания `docker stop`, потому что PID 1 не отреагировал на SIGTERM', 'SIGKILL after the `docker stop` timeout: PID 1 did not react to SIGTERM'), correct: true },
      { id: 'missing', text: bi('Не нашлось нужного файла', 'A file is missing'), why: bi('Код 137, то есть 128 + 9, означает, что процесс завершён сигналом номер 9. Отсутствующий файл обычно даёт код 1, 2 или 127.', 'Code 137 = 128 + 9: the process was killed by signal 9. A missing file usually gives 1, 2 or 127.') },
      { id: 'port', text: bi('Порт уже занят', 'The port is already taken'), why: bi('Занятый порт вызывает ошибку запуска с кодом 125, и процесс контейнера при этом даже не запускается.', 'A taken port is a start error (code 125); the container does not even start.') },
    ],
  },
  {
    id: 'containers.q.tag-digest',
    kind: 'mcq',
    concepts: ['docker.digest'],
    prompt: bi('Почему на рабочих серверах указывают образ по digest, а не только по тегу?', 'Why do production deployments refer to an image by digest and not only by tag?'),
    options: [
      { id: 'immut', text: bi('Тег можно перевесить на другую сборку, а digest остаётся отпечатком содержимого, и по нему всегда приходят те же самые байты', 'A tag can be moved to another build, while a digest is a fingerprint of the content: it always brings the same bytes'), correct: true },
      { id: 'faster', text: bi('По digest образ скачивается быстрее', 'A pull by digest is faster'), why: bi('Скорость скачивания та же самая, а digest нужен для воспроизводимости и защиты от подмены.', 'The speed is the same; it is about reproducibility and protection from substitution.') },
    ],
  },
  {
    id: 'containers.q.iv-php',
    kind: 'mcq',
    concepts: ['docker.container', 'docker.network'],
    prompt: bi('Сайт на Laravel работает так: nginx отдаёт статику, а запросы к PHP передаёт в PHP-FPM. Как его разумнее всего разложить по контейнерам?', 'A Laravel site works like this: nginx serves the static files and passes PHP requests to PHP-FPM. What is the most sensible way to split it into containers?'),
    options: [
      { id: 'two', text: bi('Два контейнера в одной сети Compose: nginx передаёт PHP-запросы по FastCGI на имя `php` и порт 9000, а код приложения лежит в образе PHP-FPM', 'Two containers on one Compose network: nginx passes PHP requests over FastCGI to the name `php` and port 9000, and the application code lives in the PHP-FPM image'), correct: true },
      { id: 'one', text: bi('Один контейнер, в котором nginx и PHP-FPM запускает менеджер процессов supervisord', 'One container in which the supervisord process manager starts both nginx and PHP-FPM'), why: bi('Так тоже работает, но первым процессом становится supervisord, журналы двух программ смешиваются, а перезапустить или масштабировать одну программу без другой нельзя. На собеседовании ждут ответа «один процесс на контейнер» и умения объяснить, почему.', 'This works too, but supervisord becomes the first process, the logs of the two programs mix, and one program cannot be restarted or scaled without the other. An interviewer expects “one process per container” and an explanation why.') },
      { id: 'host', text: bi('nginx оставить на хосте, а в контейнер поместить только PHP-FPM с опубликованным портом 9000', 'Keep nginx on the host and put only PHP-FPM in a container with port 9000 published'), why: bi('Опубликованный порт FastCGI открыт всей сети, а настройки nginx снова лежат вне репозитория. Внутри сети Compose nginx дотягивается до PHP-FPM по имени без всякой публикации.', 'A published FastCGI port is open to the whole network, and the nginx settings again sit outside the repository. Inside a Compose network nginx reaches PHP-FPM by name without any publishing.') },
    ],
    explain: bi('Статику nginx получает либо из своего образа, куда её копируют при сборке, либо из общего тома. Каталог `storage` с загрузками пользователей подключают томом, иначе он пропадёт вместе с контейнером.', 'nginx gets the static files either from its own image, where they are copied during the build, or from a shared volume. The `storage` directory with user uploads is attached as a volume, otherwise it vanishes with the container.'),
    refs: { lesson: 'containers.compose' },
  },
  {
    id: 'containers.q.iv-ci-cache',
    kind: 'mcq',
    concepts: ['docker.build-cache'],
    prompt: bi('На ноутбуке повторная сборка образа занимает секунды, а в CI каждая сборка идёт с нуля и длится пять минут. Dockerfile тот же. В чём причина?', 'On a laptop a repeated image build takes seconds, while in CI every build starts from scratch and takes five minutes. The Dockerfile is the same. What is the cause?'),
    options: [
      { id: 'runner', text: bi('Машина CI каждый раз новая, и кэша прошлых сборок на ней нет. Кэш хранят в реестре флагами `--cache-from` и `--cache-to` у `docker buildx build`', 'The CI machine is new every time and has no cache of earlier builds. The cache is kept in a registry with the `--cache-from` and `--cache-to` flags of `docker buildx build`'), correct: true },
      { id: 'order', text: bi('В Dockerfile неправильный порядок инструкций', 'The instructions in the Dockerfile are in the wrong order'), why: bi('Тогда и на ноутбуке каждая правка кода пересобирала бы зависимости. Здесь медленно только там, где кэша нет вовсе.', 'Then every code edit would rebuild the dependencies on the laptop too. Here it is slow only where there is no cache at all.') },
      { id: 'nocache', text: bi('CI всегда собирает с флагом `--no-cache`', 'CI always builds with the `--no-cache` flag'), why: bi('Такого правила нет. Флаг `--no-cache` ставят сознательно, например для ночной сборки со свежими пакетами.', 'There is no such rule. The `--no-cache` flag is set on purpose, for example for a nightly build with fresh packages.') },
    ],
    refs: { lesson: 'containers.dockerfile' },
  },
  {
    id: 'containers.q.iv-one-image',
    kind: 'mcq',
    concepts: ['docker.image', 'docker.env'],
    prompt: bi('Для тестового стенда и рабочего сервера нужны разные адреса базы данных. Сколько образов собирать?', 'The test environment and the production server need different database addresses. How many images do you build?'),
    options: [
      { id: 'one', text: bi('Один образ на обе среды, а адрес базы передают при запуске переменной окружения или файлом настроек', 'One image for both environments, with the database address passed at start as an environment variable or a settings file'), correct: true },
      { id: 'two', text: bi('Два образа, в каждый из которых при сборке вписан свой адрес', 'Two images, each with its own address written in during the build'), why: bi('Тогда на рабочий сервер попадает сборка, которую никто не проверял на стенде. Смысл образа в том, что проверенные байты, тот же digest, уходят дальше без изменений.', 'Then production gets a build nobody tested on the test environment. The point of an image is that the tested bytes, the same digest, move on unchanged.') },
    ],
    refs: { lesson: 'containers.first-steps' },
  },
  {
    id: 'containers.q.iv-logs',
    kind: 'mcq',
    concepts: ['docker.lifecycle'],
    prompt: bi('Куда приложению в контейнере писать свой журнал?', 'Where should an application in a container write its log?'),
    options: [
      { id: 'stdout', text: bi('В stdout и stderr: их сохраняет Docker, читает `docker logs`, а дальше их забирает агент сбора журналов. Размер журнала ограничивают параметрами `max-size` и `max-file`', 'To stdout and stderr: Docker keeps them, `docker logs` reads them, and a log collection agent picks them up from there. The log size is limited with `max-size` and `max-file`'), correct: true },
      { id: 'file', text: bi('В файл `/var/log/app.log` внутри контейнера, как на обычном сервере', 'To the file `/var/log/app.log` inside the container, as on an ordinary server'), why: bi('Файл растёт в записываемом слое, пропадает вместе с контейнером, а `docker logs` его не видит. Если программа умеет писать только в файл, этот файл делают ссылкой на `/dev/stdout`, как в образе nginx.', 'The file grows in the writable layer, vanishes with the container, and `docker logs` does not see it. If a program can only write to a file, the file is made a link to `/dev/stdout`, as in the nginx image.') },
    ],
    refs: { lesson: 'containers.boundaries' },
  },
  {
    id: 'containers.q.iv-health',
    kind: 'mcq',
    concepts: ['docker.lifecycle'],
    prompt: bi('У контейнера есть HEALTHCHECK, и проверка три раза подряд не прошла. Что сделает сам Docker без Compose и оркестратора?', 'A container has a HEALTHCHECK, and the check failed three times in a row. What does Docker itself do, without Compose or an orchestrator?'),
    options: [
      { id: 'mark', text: bi('Пометит контейнер как unhealthy, и больше ничего не произойдёт, процесс продолжит работать', 'It marks the container unhealthy and does nothing else: the process keeps running'), correct: true },
      { id: 'restart', text: bi('Перезапустит контейнер по политике `--restart`', 'It restarts the container according to the `--restart` policy'), why: bi('Политика перезапуска срабатывает, только когда процесс завершился. Статус unhealthy читают Compose в условии `service_healthy` и оркестраторы, а сам Docker контейнер не трогает.', 'The restart policy fires only when the process has exited. The unhealthy status is read by Compose in the `service_healthy` condition and by orchestrators, while Docker itself leaves the container alone.') },
      { id: 'stop', text: bi('Остановит контейнер, чтобы на него не шли запросы', 'It stops the container so that requests no longer reach it'), why: bi('Docker не управляет трафиком и не останавливает контейнер из-за проверки. Убрать неготовую копию из балансировки умеет оркестратор.', 'Docker does not manage traffic and does not stop a container because of a check. Taking a not-ready copy out of load balancing is an orchestrator’s job.') },
    ],
    refs: { lesson: 'containers.compose' },
  },
  {
    id: 'containers.q.iv-latest',
    kind: 'mcq',
    concepts: ['docker.digest', 'docker.dockerfile'],
    prompt: bi('Чем плоха строка `FROM node:latest` в Dockerfile рабочего сервиса?', 'What is wrong with the line `FROM node:latest` in the Dockerfile of a production service?'),
    options: [
      { id: 'repro', text: bi('Сборка невоспроизводима: тег перевесят, и завтра тот же Dockerfile соберётся на другой версии Node. Версию фиксируют тегом, а для полной точности digest', 'The build is not reproducible: the tag will be moved, and tomorrow the same Dockerfile builds on another Node version. The version is pinned with a tag, and for full precision with a digest'), correct: true },
      { id: 'fresh', text: bi('Ничем, потому что latest всегда самая свежая и потому самая безопасная версия', 'Nothing, because latest is always the freshest and therefore the safest version'), why: bi('latest означает только тег, который владелец репозитория повесил последним, и он может указывать на версию с другим мажорным номером. Обновления безопасности получают пересборкой с явной версией.', 'latest is only the tag the repository owner hung last, and it may point to a version with another major number. Security updates come from rebuilding with an explicit version.') },
    ],
    refs: { lesson: 'containers.image' },
  },
  {
    id: 'containers.q.iv-sock',
    kind: 'mcq',
    concepts: ['docker.security-profile'],
    prompt: bi('Конвейер CI собирает образы внутри контейнера, и чтобы `docker build` там работал, в контейнер подключили сокет хоста: `-v /var/run/docker.sock:/var/run/docker.sock`. Чем это рискованно?', 'A CI pipeline builds images inside a container, and to make `docker build` work there the host socket was mounted into the container: `-v /var/run/docker.sock:/var/run/docker.sock`. What is the risk?'),
    options: [
      { id: 'root', text: bi('Любой шаг сборки управляет демоном хоста и может запустить контейнер с корнем хоста внутри, то есть получает root на машине CI', 'Any build step controls the host daemon and can start a container with the host root inside, that is, it gets root on the CI machine'), correct: true },
      { id: 'ro', text: bi('Ничем, потому что сокет подключён только для сборки и демон выполняет лишь `docker build`', 'None, because the socket is mounted only for builds and the daemon runs only `docker build`'), why: bi('Демон выполняет любой запрос, пришедший через сокет, и не знает, кто его прислал. Через тот же сокет можно выполнить `docker run --privileged -v /:/host`.', 'The daemon runs any request that comes through the socket and does not know who sent it. The same socket allows `docker run --privileged -v /:/host`.') },
      { id: 'slow', text: bi('Сборки станут медленнее, потому что запросы идут через лишний слой', 'Builds become slower, because requests go through an extra layer'), why: bi('Скорость тут ни при чём, потому что сокет даёт прямой доступ к тому же демону. Опасность в правах, а не в скорости.', 'Speed has nothing to do with it: the socket gives direct access to the same daemon. The danger is in the rights, not the speed.') },
    ],
    explain: bi('Вместо сокета в CI берут сборщики, которым не нужен демон с правами root, например BuildKit в режиме rootless или kaniko, либо отдельную виртуальную машину для каждого запуска.', 'Instead of the socket, CI uses builders that need no root daemon, such as BuildKit in rootless mode or kaniko, or a separate virtual machine for each run.'),
    refs: { lesson: 'containers.security' },
  },
];

/** The twelve interview questions (04 §19): situations that the lessons did not ask about, plus five general items above. */
const TWELVE = [
  'containers.q.image-vs-container',
  'containers.q.iv-php',
  'containers.q.iv-one-image',
  'containers.q.copy-add',
  'containers.q.iv-ci-cache',
  'containers.q.shrink',
  'containers.q.iv-latest',
  'containers.q.tag-digest',
  'containers.q.iv-logs',
  'containers.q.iv-health',
  'containers.q.code-137',
  'containers.q.iv-sock',
];

export const interviewLesson: Lesson = {
  id: 'containers.interview',
  block: 'containers',
  title: bi('Как подготовиться к вопросам о контейнерах на собеседовании', 'How to prepare for interview questions about containers'),
  summary: bi('В этом уроке вы соберёте ответ на вопрос «чем контейнер отличается от виртуальной машины» и ответите на двенадцать вопросов, которые задают на собеседованиях DevOps-инженеров.', 'In this lesson you will build the answer to “how does a container differ from a virtual machine” and answer twelve questions that DevOps engineer interviews ask.'),
  introduces: [],
  uses: ['docker.vm-vs-container', 'docker.image', 'docker.dockerfile', 'docker.volume', 'docker.network', 'docker.security-profile', 'docker.runtime', 'docker.build-cache', 'docker.env', 'docker.lifecycle', 'docker.digest', 'docker.container', 'docker.multistage', 'docker.layer', 'docker.pid1'],
  tier: 'core',
  minutes: 25,
  sources: {
    en: [SRC.whatIsContainer, SRC.dockerfile, { title: 'Dockerfile best practices — Docker Docs', url: 'https://docs.docker.com/build/building/best-practices/' }],
    ru: [RU.containerisation, RU.vm, SRC.k8sRuContainers],
  },
  sections: [
    {
      id: 'intro',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Вопрос «чем контейнер отличается от виртуальной машины?» задают почти на каждом собеседовании DevOps-инженера, и ответа «контейнер легче» здесь мало, потому что от вас ждут объяснения через устройство. Хороший ответ строится по плану «что это, как работает, что из этого следует, когда что выбирать». Контейнер остаётся процессом хоста, у которого пространства имён ограничивают то, что он видит, а cgroup ограничивает, сколько ресурсов он потребляет, и ядро у всех контейнеров общее. Виртуальная машина работает на виртуальном железе и несёт за гипервизором собственное ядро. Отсюда следуют различия в размере, скорости запуска, плотности размещения и силе изоляции. Чужой код и программы, которым нужно другое ядро, запускают в виртуальных машинах, плотные однородные сервисы — в контейнерах, а на практике их используют вместе.\n\nСоберите этот ответ из карточек, а потом ответьте на двенадцать вопросов. Большая часть из них построена на рабочих ситуациях, которых в уроках не было, поэтому повторить ответ из урока не получится, придётся применить модель. После каждого ответа вы увидите разбор и ссылку на урок, где об этом рассказано.',
        'The question “how does a container differ from a virtual machine?” comes up at almost every DevOps engineer interview, and the expected answer is not “a container is lighter” but an explanation through how they work. A good answer follows the scheme “what it is → how it works → consequences → when to use which”: a container is a host process; namespaces limit what it sees, cgroups how much it consumes, the kernel is shared; a VM emulates hardware and carries its own kernel behind a hypervisor; hence size, start time, density and strength of isolation; untrusted code and another kernel go to VMs, dense uniform services to containers, and in real life — both together.\n\nBuild this answer from the cards, then go through twelve questions. Most of them are built on work situations the lessons did not show, so you cannot repeat an answer from a lesson and have to apply the model. After each answer you will see a review and a link to the lesson.',
      ),
    },
    { id: 'builder', kind: 'quiz', step: 'practice', title: bi('Соберите ответ из карточек', 'Answer builder'), items: ['containers.q.answer-plan', 'containers.q.vm-vs-ct'] },
    { id: 'twelve', kind: 'quiz', step: 'exit', title: bi('Двенадцать вопросов', 'Twelve questions'), items: TWELVE },
    {
      id: 'aloud',
      kind: 'callout',
      tone: 'note',
      step: 'review',
      title: bi('Произнесите ответ вслух', 'Say it aloud'),
      body: bi('Выбрать правильный ответ из вариантов ещё не значит суметь его произнести. Расскажите вслух за полторы минуты, чем контейнер отличается от виртуальной машины, и проверьте себя по плану: общее ядро; пространства имён (назовите pid, net и mnt); cgroup; гипервизор и собственное ядро у виртуальной машины; размер, запуск, плотность и изоляция; когда что выбирать и как их совмещают.', 'An answer you could pick is not yet an answer you can say. Say “container versus VM” aloud in a minute and a half and check it against the scheme: a shared kernel; namespaces (name pid, net, mnt); cgroups; a hypervisor and its own kernel for a VM; size, start, density, isolation; when to use which and how they combine.'),
    },
  ],
};
