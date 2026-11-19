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
];

/** The twelve interview questions (04 §19): new items above plus items from the chapters. */
const TWELVE = [
  'containers.q.image-vs-container',
  'containers.q.bug-order',
  'containers.q.entrypoint-cmd',
  'containers.q.copy-add',
  'containers.q.volume-vs-bind',
  'containers.q.dns-default',
  'containers.q.multistage-why',
  'containers.q.shrink',
  'containers.q.root-is-root',
  'containers.q.code-137',
  'containers.q.tag-digest',
  'containers.q.chain-order',
];

export const interviewLesson: Lesson = {
  id: 'containers.interview',
  block: 'containers',
  title: bi('Как подготовиться к вопросам о контейнерах на собеседовании', 'How to prepare for interview questions about containers'),
  summary: bi('В этом уроке вы соберёте ответ на вопрос «чем контейнер отличается от виртуальной машины» и ответите на двенадцать вопросов, которые задают на собеседованиях DevOps-инженеров.', 'In this lesson you will build the answer to “how does a container differ from a virtual machine” and answer twelve questions that DevOps engineer interviews ask.'),
  introduces: [],
  uses: ['docker.vm-vs-container', 'docker.image', 'docker.dockerfile', 'docker.volume', 'docker.network', 'docker.security-profile', 'docker.runtime'],
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
        'Вопрос «чем контейнер отличается от виртуальной машины?» задают почти на каждом собеседовании DevOps-инженера, и ответа «контейнер легче» здесь мало, потому что от вас ждут объяснения через устройство. Хороший ответ строится по плану «что это, как работает, что из этого следует, когда что выбирать». Контейнер остаётся процессом хоста, у которого пространства имён ограничивают то, что он видит, а cgroup ограничивает, сколько ресурсов он потребляет, и ядро у всех контейнеров общее. Виртуальная машина работает на виртуальном железе и несёт за гипервизором собственное ядро. Отсюда следуют различия в размере, скорости запуска, плотности размещения и силе изоляции. Чужой код и программы, которым нужно другое ядро, запускают в виртуальных машинах, плотные однородные сервисы — в контейнерах, а на практике их используют вместе.\n\nСоберите этот ответ из карточек, а потом ответьте на двенадцать вопросов. После каждого ответа вы увидите разбор и ссылку на главу, где об этом рассказано.',
        'The question “how does a container differ from a virtual machine?” comes up at almost every DevOps engineer interview, and the expected answer is not “a container is lighter” but an explanation through how they work. A good answer follows the scheme “what it is → how it works → consequences → when to use which”: a container is a host process; namespaces limit what it sees, cgroups how much it consumes, the kernel is shared; a VM emulates hardware and carries its own kernel behind a hypervisor; hence size, start time, density and strength of isolation; untrusted code and another kernel go to VMs, dense uniform services to containers, and in real life — both together.\n\nBuild this answer from the cards, then go through twelve questions. After each answer — a review and a link to the chapter.',
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
