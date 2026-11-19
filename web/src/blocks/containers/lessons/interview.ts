// m14. Interview preparation: "container vs VM" answer builder and the twelve questions (04 §19).

import { bi } from '../../../core/i18n';
import type { Lesson, QuizItem } from '../../../core/types';
import { RU, SRC } from '../shared';

export const interviewQuiz: QuizItem[] = [
  {
    id: 'containers.q.answer-plan',
    kind: 'order',
    concepts: ['docker.vm-vs-container'],
    prompt: bi('Соберите ответ на «контейнер против ВМ» по схеме: что это → как работает → следствия → когда что.', 'Build the answer to “container vs VM” by the scheme: what it is → how it works → consequences → when to use which.'),
    steps: [
      { id: 'what', text: bi('Контейнер — процесс хоста; ВМ — отдельный компьютер на виртуальном железе', 'A container is a host process; a VM is a separate computer on virtual hardware') },
      { id: 'how', text: bi('Контейнер: namespaces ограничивают видимость (pid, net, mnt…), cgroups — ресурсы, ядро общее. ВМ: гипервизор и своё ядро', 'Container: namespaces limit visibility (pid, net, mnt…), cgroups limit resources, the kernel is shared. VM: a hypervisor and its own kernel') },
      { id: 'cons', text: bi('Следствия: размер, скорость старта, плотность, сила изоляции', 'Consequences: size, start time, density, strength of isolation') },
      { id: 'when', text: bi('Когда что: чужой код и другое ядро — ВМ; плотная упаковка своих сервисов — контейнеры; часто вместе (облачные ВМ, KubeVirt, Kata)', 'When to use which: untrusted code and another kernel — VM; dense packing of your own services — containers; often together (cloud VMs, KubeVirt, Kata)') },
    ],
  },
  {
    id: 'containers.q.image-vs-container',
    kind: 'mcq',
    concepts: ['docker.image', 'docker.container'],
    prompt: bi('Чем образ отличается от контейнера?', 'How does an image differ from a container?'),
    options: [
      { id: 'right', text: bi('Образ — неизменяемый шаблон (слои + config); контейнер — запущенный из него процесс со своим записываемым слоем', 'An image is an immutable template (layers + config); a container is a process started from it with its own writable layer'), correct: true },
      { id: 'same', text: bi('Это одно и то же, просто разные названия', 'They are the same thing under different names'), why: bi('Из одного образа можно запустить сто контейнеров; образ при этом не меняется.', 'A hundred containers can run from one image; the image does not change.') },
      { id: 'vm', text: bi('Образ — это ВМ, контейнер — программа в ней', 'An image is a VM and a container is a program in it'), why: bi('Образ — файлы и описание, никакой машины в нём нет.', 'An image is files and a description; there is no machine in it.') },
    ],
  },
  {
    id: 'containers.q.copy-add',
    kind: 'mcq',
    concepts: ['docker.dockerfile'],
    prompt: bi('COPY или ADD — что выбрать для копирования файлов проекта и почему?', 'COPY or ADD — which to use for copying project files, and why?'),
    options: [
      { id: 'copy', text: bi('COPY: он только копирует. ADD ещё распаковывает локальные tar и умеет качать по URL — неочевидное поведение, которое лучше не включать случайно', 'COPY: it only copies. ADD also unpacks local tar files and can download URLs — non-obvious behaviour better not triggered by accident'), correct: true },
      { id: 'add', text: bi('ADD: он новее и быстрее', 'ADD: it is newer and faster'), why: bi('ADD не быстрее; его дополнительные возможности нужны редко, и тогда их выбирают явно.', 'ADD is not faster; its extra features are rarely needed, and then you choose them on purpose.') },
    ],
  },
  {
    id: 'containers.q.shrink',
    kind: 'multi',
    concepts: ['docker.multistage', 'docker.layer'],
    prompt: bi('Как уменьшить образ? Отметьте всё, что действительно помогает.', 'How do you make an image smaller? Mark everything that really helps.'),
    options: [
      { id: 'ms', text: bi('Многоэтапная сборка: компилятор остаётся в стадии сборки', 'A multi-stage build: the compiler stays in the build stage'), correct: true },
      { id: 'base', text: bi('Минимальная база (alpine, slim, distroless)', 'A minimal base (alpine, slim, distroless)'), correct: true },
      { id: 'same', text: bi('Чистить кэш пакетов в той же инструкции RUN, где ставите пакеты', 'Clearing the package cache in the same RUN that installs the packages'), correct: true },
      { id: 'rm', text: bi('Отдельная инструкция `RUN rm -rf` в конце Dockerfile', 'A separate `RUN rm -rf` instruction at the end of the Dockerfile'), why: bi('Удаление в новом слое ничего не уменьшает: файлы остались в нижних слоях.', 'Deleting in a new layer shrinks nothing: the files stay in the lower layers.') },
      { id: 'squash', text: bi('Поставить EXPOSE поменьше портов', 'Fewer EXPOSE ports'), why: bi('EXPOSE — строка config, размера у неё нет.', 'EXPOSE is a config line; it has no size.') },
    ],
  },
  {
    id: 'containers.q.code-137',
    kind: 'multi',
    concepts: ['docker.pid1', 'docker.lifecycle'],
    prompt: bi('Контейнер завершился с кодом 137. Две самые вероятные причины?', 'A container exited with code 137. The two most likely causes?'),
    options: [
      { id: 'oom', text: bi('Его убил OOM killer: процесс превысил лимит памяти cgroup (`OOMKilled: true` в inspect)', 'The OOM killer killed it: the process went over the cgroup memory limit (`OOMKilled: true` in inspect)'), correct: true },
      { id: 'stop', text: bi('SIGKILL после таймаута `docker stop`: PID 1 не отреагировал на SIGTERM', 'SIGKILL after the `docker stop` timeout: PID 1 did not react to SIGTERM'), correct: true },
      { id: 'missing', text: bi('Нет нужного файла', 'A file is missing'), why: bi('Код 137 = 128 + 9: процесс убит сигналом 9. Отсутствующий файл обычно даёт 1, 2 или 127.', 'Code 137 = 128 + 9: the process was killed by signal 9. A missing file usually gives 1, 2 or 127.') },
      { id: 'port', text: bi('Порт уже занят', 'The port is already taken'), why: bi('Занятый порт — ошибка запуска (код 125), контейнер даже не стартует.', 'A taken port is a start error (code 125); the container does not even start.') },
    ],
  },
  {
    id: 'containers.q.tag-digest',
    kind: 'mcq',
    concepts: ['docker.digest'],
    prompt: bi('Почему в продакшене ссылаются на образ по digest, а не только по тегу?', 'Why do production deployments refer to an image by digest and not only by tag?'),
    options: [
      { id: 'immut', text: bi('Тег можно перевесить на другую сборку, а digest — отпечаток содержимого: по нему всегда придут те же байты', 'A tag can be moved to another build, while a digest is a fingerprint of the content: it always brings the same bytes'), correct: true },
      { id: 'faster', text: bi('По digest pull быстрее', 'A pull by digest is faster'), why: bi('Скорость та же; дело в воспроизводимости и защите от подмены.', 'The speed is the same; it is about reproducibility and protection from substitution.') },
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
  title: bi('Собеседование: контейнеры', 'Interview: containers'),
  summary: bi('Ответ «контейнер против ВМ» по схеме и двенадцать вопросов, которые задают на собеседованиях DevOps.', 'The “container vs VM” answer by the scheme and twelve questions DevOps interviews ask.'),
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
        'Вопрос «чем контейнер отличается от виртуальной машины?» задают почти на каждом собеседовании на DevOps-инженера, и ждут не «контейнер легче», а объяснения через устройство. Хороший ответ строится по схеме «что это → как работает → следствия → когда что»: контейнер — процесс хоста; пространства имён ограничивают, что он видит, cgroups — сколько потребляет, ядро общее; ВМ эмулирует железо и несёт своё ядро за гипервизором; отсюда размер, скорость старта, плотность и сила изоляции; чужой код и другое ядро — в ВМ, плотные однородные сервисы — в контейнерах, а в жизни — вместе.\n\nСоберите этот ответ из карточек, потом пройдите двенадцать вопросов. После каждого ответа — разбор и ссылка на главу.',
        'The question “how does a container differ from a virtual machine?” comes up at almost every DevOps engineer interview, and the expected answer is not “a container is lighter” but an explanation through how they work. A good answer follows the scheme “what it is → how it works → consequences → when to use which”: a container is a host process; namespaces limit what it sees, cgroups how much it consumes, the kernel is shared; a VM emulates hardware and carries its own kernel behind a hypervisor; hence size, start time, density and strength of isolation; untrusted code and another kernel go to VMs, dense uniform services to containers, and in real life — both together.\n\nBuild this answer from the cards, then go through twelve questions. After each answer — a review and a link to the chapter.',
      ),
    },
    { id: 'builder', kind: 'quiz', step: 'practice', title: bi('Конструктор ответа', 'Answer builder'), items: ['containers.q.answer-plan', 'containers.q.vm-vs-ct'] },
    { id: 'twelve', kind: 'quiz', step: 'exit', title: bi('Двенадцать вопросов', 'Twelve questions'), items: TWELVE },
    {
      id: 'aloud',
      kind: 'callout',
      tone: 'note',
      step: 'review',
      title: bi('Скажите вслух', 'Say it aloud'),
      body: bi('Ответ, который вы смогли выбрать, ещё не ответ, который вы сможете сказать. Произнесите «контейнер против ВМ» вслух за полторы минуты и проверьте по схеме: общее ядро; namespaces (назовите pid, net, mnt); cgroups; гипервизор и своё ядро у ВМ; размер, старт, плотность, изоляция; когда что и как их совмещают.', 'An answer you could pick is not yet an answer you can say. Say “container versus VM” aloud in a minute and a half and check it against the scheme: a shared kernel; namespaces (name pid, net, mnt); cgroups; a hypervisor and its own kernel for a VM; size, start, density, isolation; when to use which and how they combine.'),
    },
  ],
};
