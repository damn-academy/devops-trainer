// m06. How an image is built: layers, digests, manifest, index, registry (04 §4.3, §8).

import { bi } from '../../../core/i18n';
import type { Lesson, QuizItem } from '../../../core/types';
import { dockerHost, help, RU, SRC } from '../shared';

export const imageQuiz: QuizItem[] = [
  {
    id: 'containers.q.latest',
    kind: 'mcq',
    concepts: ['docker.registry'],
    prompt: bi('Тег `latest` означает самую новую версию образа?', 'Does the `latest` tag mean the newest version of an image?'),
    options: [
      { id: 'no', text: bi('Нет: это просто имя тега по умолчанию, оно указывает туда, куда его последний раз повесили', 'No: it is just the default tag name; it points wherever it was last put'), correct: true },
      { id: 'yes', text: bi('Да, реестр сам переносит его на свежую сборку', 'Yes, the registry moves it to the freshest build itself'), why: bi('Реестр ничего не переносит: `latest` двигает тот, кто публикует, — или не двигает вовсе.', 'The registry moves nothing: whoever publishes moves `latest` — or never does.') },
    ],
    explain: bi('В продакшене образы указывают конкретным тегом, а надёжнее всего — digest: `nginx@sha256:…` всегда даст ровно те же байты.', 'In production images are referenced by a specific tag, and most reliably by digest: `nginx@sha256:…` always gives exactly the same bytes.'),
  },
  {
    id: 'containers.q.two-hashes',
    kind: 'mcq',
    key: true,
    concepts: ['docker.digest', 'docker.layer'],
    prompt: bi('У слоя образа два хеша. Какие и где записан каждый?', 'An image layer has two hashes. Which, and where is each written?'),
    options: [
      { id: 'right', text: bi('digest сжатого архива — в манифесте; diff_id несжатого tar — в config (rootfs.diff_ids)', 'The digest of the compressed archive — in the manifest; the diff_id of the uncompressed tar — in the config (rootfs.diff_ids)'), correct: true },
      { id: 'swap', text: bi('diff_id — в манифесте, digest — в config', 'diff_id in the manifest, digest in the config'), why: bi('Наоборот: манифест описывает то, что качается (сжатые blob-ы), config — то, что распаковано.', 'The other way round: the manifest describes what is downloaded (compressed blobs), the config what is unpacked.') },
      { id: 'tag', text: bi('Тег и digest — оба в манифесте', 'The tag and the digest — both in the manifest'), why: bi('Тег — это не хеш слоя, а ярлык в реестре; в манифесте его нет.', 'A tag is not a layer hash but a label in the registry; it is not in the manifest.') },
    ],
  },
  {
    id: 'containers.q.repull',
    kind: 'mcq',
    concepts: ['docker.digest', 'docker.layer'],
    prompt: bi('Вы скачали `nginx:1.30-alpine`, а потом `postgres:17-alpine`. Почему второй pull пишет `Already exists` у одного из слоёв?', 'You pulled `nginx:1.30-alpine` and then `postgres:17-alpine`. Why does the second pull say `Already exists` for one of the layers?'),
    options: [
      { id: 'shared', text: bi('Оба образа построены на одном слое alpine с тем же digest — он уже лежит локально', 'Both images are built on the same alpine layer with the same digest — it is already here'), correct: true },
      { id: 'cache', text: bi('Docker помнит, что недавно что-то качал', 'Docker remembers it downloaded something recently'), why: bi('Совпадение определяется не временем, а адресом по содержимому: тот же sha256 — тот же слой.', 'A match is decided not by time but by the content address: the same sha256 means the same layer.') },
    ],
  },
  {
    id: 'containers.q.deleted-file',
    kind: 'mcq',
    concepts: ['docker.layer'],
    prompt: bi('В Dockerfile один RUN скачал архив на 200 МБ, а следующий RUN его удалил. Насколько вырос образ?', 'In a Dockerfile one RUN downloaded a 200 MB archive and the next RUN deleted it. How much did the image grow?'),
    options: [
      { id: '200', text: bi('На 200 МБ: архив остался в нижнем слое, сверху лишь пометка об удалении', 'By 200 MB: the archive stays in the lower layer; on top there is only a deletion mark'), correct: true },
      { id: '0', text: bi('Ни на сколько: файл ведь удалён', 'Not at all: the file was deleted'), why: bi('Слои только добавляются. Удаление — это whiteout в новом слое; байты нижнего слоя по-прежнему скачиваются.', 'Layers only add. A deletion is a whiteout in a new layer; the bytes of the lower layer are still downloaded.') },
    ],
    explain: bi('Удалять надо в той же инструкции, где файл появился, — или собирать в отдельной стадии (глава о Dockerfile).', 'Delete in the same instruction that created the file — or build in a separate stage (the Dockerfile chapter).'),
  },
  {
    id: 'containers.q.image-label',
    kind: 'label',
    concepts: ['docker.image', 'docker.digest'],
    prompt: bi('Подпишите путь от тега до слоёв.', 'Label the path from the tag to the layers.'),
    diagram: {
      width: 640,
      height: 160,
      slots: [
        { id: 's1', x: 16, y: 52, w: 128, h: 56, answer: 'tag', family: 'obj' },
        { id: 's2', x: 176, y: 52, w: 128, h: 56, answer: 'index', family: 'obj' },
        { id: 's3', x: 336, y: 52, w: 128, h: 56, answer: 'manifest', family: 'obj' },
        { id: 's4', x: 496, y: 52, w: 128, h: 56, answer: 'layers', family: 'store' },
      ],
      edges: [
        { from: 's1', to: 's2' },
        { from: 's2', to: 's3' },
        { from: 's3', to: 's4' },
      ],
    },
    labels: [
      { id: 'tag', text: bi('тег nginx:1.30-alpine', 'the tag nginx:1.30-alpine') },
      { id: 'index', text: bi('index: список платформ', 'index: the list of platforms') },
      { id: 'manifest', text: bi('manifest одной платформы', 'the manifest of one platform') },
      { id: 'layers', text: bi('слои по digest', 'layers by digest') },
      { id: 'dockerfile', text: 'Dockerfile', why: bi('Dockerfile в реестре не хранится: в образе остаётся только история инструкций в config.', 'The Dockerfile is not stored in the registry: only the history of instructions stays in the config.') },
    ],
  },
];

export const imageLesson: Lesson = {
  id: 'containers.image',
  block: 'containers',
  title: bi('Как устроен образ', 'How an image is built'),
  summary: bi('Что именно скачивает `docker pull`: слои, config, манифест, индекс платформ и адреса по содержимому.', 'What exactly `docker pull` downloads: layers, the config, the manifest, the platform index and content addresses.'),
  introduces: ['docker.image', 'docker.layer', 'docker.digest', 'docker.registry'],
  uses: ['docker.container', 'docker.lifecycle'],
  tier: 'core',
  minutes: 35,
  sources: {
    en: [SRC.imageSpec, { title: 'OCI image-spec — manifest.md', url: 'https://github.com/opencontainers/image-spec/blob/main/manifest.md' }, { title: 'OCI image-spec — config.md', url: 'https://github.com/opencontainers/image-spec/blob/main/config.md' }, SRC.distSpec, SRC.whatIsImage],
    ru: [SRC.habrManifest, SRC.habrOverlay, SRC.k8sRuImages, RU.sha],
  },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('`docker pull nginx:1.30-alpine` печатает несколько строк вида `f18232174bc9: Pull complete` и одну строку `Digest: sha256:…`. Что это за куски и что за длинное число? Ведущий вопрос: **что именно скачивает `docker pull`?**', '`docker pull nginx:1.30-alpine` prints a few lines like `f18232174bc9: Pull complete` and one line `Digest: sha256:…`. What are these pieces and what is the long number? The leading question: **what exactly does `docker pull` download?**'),
    },
    {
      id: 'layers',
      kind: 'text',
      step: 'explain',
      title: bi('Файлы и описание', 'Files and a description'),
      body: bi(
        '[[docker.image|Образ]] — это шаблон контейнера из двух частей. Первая — файлы будущего корня, разложенные стопкой [[docker.layer|слоёв]]. Каждый слой — архив tar с изменениями файловой системы относительно слоя под ним: базовая система Alpine, потом пакет nginx, потом скрипт запуска. Вторая часть — config: что запускать (Entrypoint и Cmd), какие переменные, рабочий каталог, пользователь, порты и история инструкций, из которых образ собран.\n\nВ лаборатории «Контейнер своими руками» вы смонтировали overlay из двух заготовленных нижних каталогов. Теперь можно назвать их правильно: так и устроен образ. Слои — нижние каталоги OverlayFS, только для чтения; запуск контейнера добавляет сверху пустой записываемый слой. Поэтому из одного образа можно запустить сколько угодно контейнеров, и ни один не меняет образ.',
        'An [[docker.image|image]] is a container template in two parts. The first is the files of the future root, laid out as a stack of [[docker.layer|layers]]. Each layer is a tar archive of file-system changes relative to the layer below: the Alpine base system, then the nginx package, then the start script. The second part is the config: what to run (Entrypoint and Cmd), which variables, the working directory, the user, ports and the history of the instructions the image was built from.\n\nIn the “container by hand” lab you mounted an overlay from two prepared lower directories. Now we can name them properly: this is how an image is built. Layers are OverlayFS lower directories, read-only; running a container adds an empty writable layer on top. That is why any number of containers can run from one image, and none of them changes the image.',
      ),
    },
    {
      id: 'digests',
      kind: 'text',
      step: 'explain',
      title: bi('Адрес — это отпечаток', 'An address is a fingerprint'),
      body: bi(
        'Каждый кусок образа хранится и запрашивается по адресу, вычисленному из его содержимого: `sha256:` от байтов. Такой адрес называют [[docker.digest|digest]]. Поменяйте в слое один байт — получится совсем другое число. Отсюда два свойства: digest сам проверяет целостность (скачанные байты пересчитывают и сравнивают), и одинаковые слои разных образов хранятся и качаются один раз.\n\nКуски связаны документами JSON, и каждая ссылка — тоже по digest. **Манифест** перечисляет config и слои одной платформы. **Индекс** перечисляет манифесты разных платформ: linux/amd64, linux/arm64 и других. Тег `1.30-alpine` указывает на индекс. Разница между тегом и digest принципиальная: тег — изменяемый ярлык, его можно перевесить на новую сборку; digest — отпечаток, по нему всегда придут ровно те же байты.\n\nУ слоя, кстати, два хеша: digest сжатого архива — в манифесте (это то, что качается), и `diff_id` несжатого tar — в config (это то, что распаковано).',
        'Every piece of an image is stored and requested by an address computed from its content: the `sha256:` of its bytes. Such an address is called a [[docker.digest|digest]]. Change one byte in a layer and you get an entirely different number. Two properties follow: a digest checks integrity by itself (the downloaded bytes are hashed again and compared), and identical layers of different images are stored and downloaded once.\n\nThe pieces are linked by JSON documents, and every link is by digest too. A **manifest** lists the config and the layers of one platform. An **index** lists manifests for different platforms: linux/amd64, linux/arm64 and others. The `1.30-alpine` tag points to the index. The difference between a tag and a digest matters: a tag is a movable label that can be moved to a new build; a digest is a fingerprint, and it always brings exactly the same bytes.\n\nA layer, by the way, has two hashes: the digest of the compressed archive in the manifest (what is downloaded) and the `diff_id` of the uncompressed tar in the config (what is unpacked).',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'containers.image-pack', caption: bi('Пройдите путь от тега до корня; смените платформу; сломайте байт или перевесьте тег.', 'Walk the path from the tag to the root; change the platform; break a byte or move the tag.') },
    {
      id: 'registry',
      kind: 'text',
      step: 'explain',
      title: bi('Реестр: push и pull', 'The registry: push and pull'),
      body: bi(
        '[[docker.registry|Реестр]] — сервер, где образы лежат по репозиториям и тегам. Docker Hub — реестр по умолчанию: имя `nginx` значит `docker.io/library/nginx`. У компаний свои реестры: GitLab Container Registry, Harbor; в курсе — `registry.lab`. Протокол простой и открытый (OCI Distribution): клиент получает токен, спрашивает манифест по тегу, затем качает blob-ы по digest. Отправка (`docker push`) идёт в обратную сторону: сначала слои, которых в реестре нет, потом манифест под тегом. Слои, которые уже есть, не загружаются — `Layer already exists`.\n\nЧтобы отправить образ в свой реестр, его имя должно начинаться с адреса реестра: `docker tag nginx:1.30-alpine registry.lab/learner/web:1.0`, затем `docker push registry.lab/learner/web:1.0`.',
        'A [[docker.registry|registry]] is a server that keeps images by repositories and tags. Docker Hub is the default: the name `nginx` means `docker.io/library/nginx`. Companies have their own registries: GitLab Container Registry, Harbor; the course has `registry.lab`. The protocol is simple and open (OCI Distribution): the client gets a token, asks for a manifest by tag, then downloads blobs by digest. Sending (`docker push`) goes the other way: first the layers the registry does not have, then the manifest under the tag. Layers that are already there are not uploaded — `Layer already exists`.\n\nTo send an image to your own registry, its name must start with the registry address: `docker tag nginx:1.30-alpine registry.lab/learner/web:1.0`, then `docker push registry.lab/learner/web:1.0`.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: dockerHost({}, { pull: ['alpine:3.22'] }),
      intro: bi('Машина с Docker и реестром курса `registry.lab`. Образ alpine уже скачан.', 'A machine with Docker and the course registry `registry.lab`. The alpine image is already pulled.'),
      tasks: [
        {
          id: 'pull',
          prompt: bi('Скачайте `nginx:1.30-alpine`. Какой из его слоёв уже был на машине?', 'Pull `nginx:1.30-alpine`. Which of its layers was already on the machine?'),
          check: { when: "images[ref='nginx:1.30-alpine']", stdout: 'Already exists' },
          chips: 'docker pull nginx:1.30-alpine',
          concepts: ['docker.layer'],
          hints: { H1: bi('nginx построен на alpine — слой alpine с тем же digest скачивать не нужно.', 'nginx is built on alpine — the alpine layer with the same digest need not be downloaded.') },
        },
        {
          id: 'count',
          prompt: bi('Выведите одним числом, сколько слоёв в `nginx:1.30-alpine`.', 'Print as one number how many layers `nginx:1.30-alpine` has.'),
          check: { stdout: /^4\n?$/ },
          chips: "docker image inspect nginx:1.30-alpine --format '{{len .RootFS.Layers}}'",
          concepts: ['docker.layer'],
          docRef: help('inspect', 'OPTIONS', '--format'),
          hints: { H1: bi('Слои перечислены в config образа: `docker image inspect`.', 'The layers are listed in the image config: `docker image inspect`.'), H2: bi('Шаблон `--format` умеет `len`: `{{len .RootFS.Layers}}`.', 'The `--format` template knows `len`: `{{len .RootFS.Layers}}`.') },
        },
        {
          id: 'history',
          prompt: bi('Посмотрите историю образа nginx. Какие инструкции не создали слоя (размер 0B)?', 'Look at the history of the nginx image. Which instructions created no layer (size 0B)?'),
          check: { stdout: 'STOPSIGNAL' },
          chips: 'docker history nginx:1.30-alpine',
          concepts: ['docker.image'],
          hints: { H1: bi('ENV, ENTRYPOINT, CMD, EXPOSE, STOPSIGNAL меняют только config.', 'ENV, ENTRYPOINT, CMD, EXPOSE, STOPSIGNAL change only the config.') },
        },
        {
          id: 'push',
          prompt: bi('Отправьте образ nginx в реестр курса под именем `registry.lab/learner/web:1.0`.', 'Push the nginx image to the course registry as `registry.lab/learner/web:1.0`.'),
          check: { when: "registry.repoNames has 'registry.lab/learner/web'" },
          chips: 'docker tag nginx:1.30-alpine registry.lab/learner/web:1.0 && docker push registry.lab/learner/web:1.0',
          concepts: ['docker.registry'],
          docRef: help('push', 'USAGE'),
          hints: { H1: bi('Сначала дайте образу второе имя с адресом реестра, потом отправьте.', 'First give the image a second name with the registry address, then push.'), H2: bi('`docker tag ИСТОЧНИК ЦЕЛЬ`, затем `docker push ЦЕЛЬ`.', '`docker tag SOURCE TARGET`, then `docker push TARGET`.') },
        },
        {
          id: 'digest',
          prompt: bi('Скачайте alpine не по тегу, а по digest: так вы получите ровно те же байты, даже если тег перевесят.', 'Pull alpine not by tag but by digest: that gets exactly the same bytes even if the tag is moved.'),
          check: { when: "registry.log[path~'manifests/sha256:']" },
          chips: 'docker images --digests',
          concepts: ['docker.digest'],
          docRef: help('images', 'OPTIONS', '--digests'),
          hints: { H1: bi('Digest образа покажет `docker images --digests`.', '`docker images --digests` shows the image digest.'), H2: bi('Формат: `docker pull alpine@sha256:…`.', 'The format: `docker pull alpine@sha256:…`.') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      levels: ['intermediate', 'experienced'],
      mode: 'find',
      prompt: bi('Покажите, для каких платформ в реестре есть образ `nginx:1.30-alpine`, — не скачивая его. Такой команды в главе не было.', 'Show which platforms the registry has for `nginx:1.30-alpine` — without pulling it. This command was not in the chapter.'),
      ref: { page: 'help/docker-pull' },
      terminal: {
        setup: dockerHost({}, { pull: [] }),
        task: {
          id: 'manifest-inspect',
          prompt: bi('На экране — индекс со списком платформ, а образ не скачан.', 'The index with the list of platforms is on screen, and the image is not pulled.'),
          check: { when: "!images[ref='nginx:1.30-alpine']", stdout: '"architecture": "arm64"' },
          docStep: 4,
          beyond: true,
          solutionTokens: ['manifest', 'imagetools', 'inspect'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: imageQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог', 'Summary'),
      body: bi('Образ — стопка слоёв и config. Всё адресуется по digest: тег → индекс → манифест платформы → config и слои. Тег можно перевесить, digest — нет. Реестр хранит blob-ы по digest; одинаковые слои качаются один раз.', 'An image is a stack of layers and a config. Everything is addressed by digest: tag → index → platform manifest → config and layers. A tag can be moved, a digest cannot. A registry keeps blobs by digest; identical layers download once.'),
    },
  ],
};
