// m06. How an image is built: layers, digests, manifest, index, registry (04 §4.3, §8).

import { bi } from '../../../core/i18n';
import type { Lesson, QuizItem } from '../../../core/types';
import { dockerHost, help, RU, SRC } from '../shared';

export const imageQuiz: QuizItem[] = [
  {
    id: 'containers.q.latest',
    kind: 'mcq',
    concepts: ['docker.registry'],
    prompt: bi('Означает ли тег `latest` самую новую версию образа?', 'Does the `latest` tag mean the newest version of an image?'),
    options: [
      { id: 'no', text: bi('Нет, это всего лишь имя тега по умолчанию, и указывает он туда, куда его повесили в последний раз', 'No, it is just the default tag name; it points wherever it was last put'), correct: true },
      { id: 'yes', text: bi('Да, реестр сам переносит его на свежую сборку', 'Yes, the registry moves it to the freshest build itself'), why: bi('Реестр сам ничего не переносит. Тег `latest` передвигает тот, кто публикует образ, а может и вовсе не передвигать.', 'The registry moves nothing: whoever publishes moves `latest` — or never does.') },
    ],
    explain: bi('На рабочих серверах образы указывают конкретным тегом, а надёжнее всего указывать digest, потому что по адресу `nginx@sha256:…` всегда приходят те же самые байты.', 'In production images are referenced by a specific tag, and most reliably by digest: `nginx@sha256:…` always gives exactly the same bytes.'),
  },
  {
    id: 'containers.q.two-hashes',
    kind: 'mcq',
    key: true,
    concepts: ['docker.digest', 'docker.layer'],
    prompt: bi('У слоя образа два отпечатка. Какие это отпечатки и где записан каждый из них?', 'An image layer has two hashes. Which, and where is each written?'),
    options: [
      { id: 'right', text: bi('digest сжатого архива записан в манифесте, а diff_id несжатого архива tar — в настройках образа (rootfs.diff_ids)', 'The digest of the compressed archive — in the manifest; the diff_id of the uncompressed tar — in the config (rootfs.diff_ids)'), correct: true },
      { id: 'swap', text: bi('diff_id записан в манифесте, а digest — в настройках образа', 'diff_id in the manifest, digest in the config'), why: bi('Всё наоборот, потому что манифест описывает то, что скачивается, то есть сжатые части образа, а настройки описывают то, что уже распаковано.', 'The other way round: the manifest describes what is downloaded (compressed blobs), the config what is unpacked.') },
      { id: 'tag', text: bi('И тег, и digest записаны в манифесте', 'The tag and the digest — both in the manifest'), why: bi('Тег служит не отпечатком слоя, а ярлыком в реестре, и в манифесте его нет.', 'A tag is not a layer hash but a label in the registry; it is not in the manifest.') },
    ],
  },
  {
    id: 'containers.q.repull',
    kind: 'mcq',
    concepts: ['docker.digest', 'docker.layer'],
    prompt: bi('Вы скачали `nginx:1.30-alpine`, а потом `postgres:17-alpine`. Почему при втором скачивании у одного из слоёв написано `Already exists`?', 'You pulled `nginx:1.30-alpine` and then `postgres:17-alpine`. Why does the second pull say `Already exists` for one of the layers?'),
    options: [
      { id: 'shared', text: bi('Оба образа построены на одном и том же слое alpine с тем же digest, и этот слой уже лежит на машине', 'Both images are built on the same alpine layer with the same digest — it is already here'), correct: true },
      { id: 'cache', text: bi('Docker помнит, что недавно что-то скачивал', 'Docker remembers it downloaded something recently'), why: bi('Совпадение определяет не время, а адрес по содержимому, и одинаковый отпечаток sha256 означает один и тот же слой.', 'A match is decided not by time but by the content address: the same sha256 means the same layer.') },
    ],
  },
  {
    id: 'containers.q.deleted-file',
    kind: 'mcq',
    concepts: ['docker.layer'],
    prompt: bi('В Dockerfile одна инструкция RUN скачала архив на 200 МБ, а следующая RUN его удалила. Насколько вырос образ?', 'In a Dockerfile one RUN downloaded a 200 MB archive and the next RUN deleted it. How much did the image grow?'),
    options: [
      { id: '200', text: bi('На 200 МБ, потому что архив остался в нижнем слое, а сверху легла только пометка об удалении', 'By 200 MB, because the archive stays in the lower layer; on top there is only a deletion mark'), correct: true },
      { id: '0', text: bi('Ни на сколько, ведь файл удалён', 'Not at all: the file was deleted'), why: bi('Слои можно только добавлять. Удаление записывается пометкой (whiteout) в новом слое, а байты нижнего слоя по-прежнему скачиваются.', 'Layers only add. A deletion is a whiteout in a new layer; the bytes of the lower layer are still downloaded.') },
    ],
    explain: bi('Удалять файл нужно в той же инструкции, где он появился, или собирать его в отдельной стадии, как описано в главе о Dockerfile.', 'Delete in the same instruction that created the file — or build in a separate stage (the Dockerfile chapter).'),
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
      { id: 'index', text: bi('индекс со списком платформ', 'the index with the list of platforms') },
      { id: 'manifest', text: bi('манифест одной платформы', 'the manifest of one platform') },
      { id: 'layers', text: bi('слои по digest', 'layers by digest') },
      { id: 'dockerfile', text: 'Dockerfile', why: bi('Dockerfile в реестре не хранится, и в образе остаётся только история инструкций в его настройках.', 'The Dockerfile is not stored in the registry: only the history of instructions stays in the config.') },
    ],
  },
];

export const imageLesson: Lesson = {
  id: 'containers.image',
  block: 'containers',
  title: bi('Как устроен образ', 'How an image is built'),
  summary: bi('В этом уроке вы узнаете, что скачивает команда `docker pull`, то есть слои, настройки, манифест и индекс платформ, и почему все эти части ищут по адресу, вычисленному из содержимого.', 'In this lesson you will learn what `docker pull` downloads, that is the layers, the config, the manifest and the platform index, and why all these parts are found by an address computed from their content.'),
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
      body: bi('Команда `docker pull nginx:1.30-alpine` печатает несколько строк вида `f18232174bc9: Pull complete` и одну строку `Digest: sha256:…`. Что это за куски и что означает длинное число? Глава отвечает на вопрос: **что скачивает `docker pull`?**', '`docker pull nginx:1.30-alpine` prints a few lines like `f18232174bc9: Pull complete` and one line `Digest: sha256:…`. What are these pieces and what is the long number? The leading question: **what exactly does `docker pull` download?**'),
    },
    {
      id: 'layers',
      kind: 'text',
      step: 'explain',
      title: bi('Из каких двух частей состоит образ', 'The two parts of an image: files and a description'),
      body: bi(
        '[[docker.image|Образ]] служит шаблоном контейнера и состоит из двух частей. Первая часть содержит файлы будущего корня, разложенные стопкой [[docker.layer|слоёв]]. Каждый слой хранится как архив tar с изменениями файловой системы относительно слоя под ним: сначала базовая система Alpine, потом пакет nginx, потом скрипт запуска. Вторая часть содержит документ настроек (в спецификации он называется config), где записано, что запускать (Entrypoint и Cmd), с какими переменными, в каком рабочем каталоге, от имени какого пользователя, какие порты открыты и из каких инструкций образ собран.\n\nВ лаборатории «Как собрать контейнер своими руками» вы смонтировали overlay из двух заготовленных нижних каталогов. Образ устроен так же. Его слои служат нижними каталогами OverlayFS, доступными только для чтения, а запуск контейнера добавляет сверху пустой записываемый слой. Поэтому из одного образа можно запустить сколько угодно контейнеров, и ни один из них образ не меняет.',
        'An [[docker.image|image]] is a container template in two parts. The first is the files of the future root, laid out as a stack of [[docker.layer|layers]]. Each layer is a tar archive of file-system changes relative to the layer below: the Alpine base system, then the nginx package, then the start script. The second part is the config: what to run (Entrypoint and Cmd), which variables, the working directory, the user, ports and the history of the instructions the image was built from.\n\nIn the “container by hand” lab you mounted an overlay from two prepared lower directories. Now we can name them properly: this is how an image is built. Layers are OverlayFS lower directories, read-only; running a container adds an empty writable layer on top. That is why any number of containers can run from one image, and none of them changes the image.',
      ),
    },
    {
      id: 'digests',
      kind: 'text',
      step: 'explain',
      title: bi('Почему адрес части образа вычисляют из её содержимого', 'Why an address is a fingerprint of the content'),
      body: bi(
        'Каждый кусок образа хранится и запрашивается по адресу, вычисленному из его содержимого, то есть по отпечатку `sha256:` от его байтов. Такой адрес называют [[docker.digest|digest]]. Стоит поменять в слое один байт, и получится совсем другое число. Из этого следуют два свойства. Во-первых, digest сам проверяет целостность, потому что скачанные байты пересчитывают и сравнивают с адресом. Во-вторых, одинаковые слои разных образов хранятся и скачиваются один раз.\n\nКуски образа связаны документами JSON, и каждая ссылка в них тоже записана через digest. **Манифест** перечисляет настройки и слои для одной платформы. **Индекс** перечисляет манифесты для разных платформ: linux/amd64, linux/arm64 и других. Тег `1.30-alpine` указывает на индекс. Тег и digest различаются принципиально. Тег служит изменяемым ярлыком, и его можно перевесить на новую сборку, а digest остаётся отпечатком содержимого, и по нему всегда приходят те же самые байты.\n\nУ каждого слоя при этом два отпечатка. Digest сжатого архива записан в манифесте, и по нему слой скачивают, а `diff_id` несжатого архива записан в настройках, и он описывает то, что получится после распаковки.',
        'Every piece of an image is stored and requested by an address computed from its content: the `sha256:` of its bytes. Such an address is called a [[docker.digest|digest]]. Change one byte in a layer and you get an entirely different number. Two properties follow: a digest checks integrity by itself (the downloaded bytes are hashed again and compared), and identical layers of different images are stored and downloaded once.\n\nThe pieces are linked by JSON documents, and every link is by digest too. A **manifest** lists the config and the layers of one platform. An **index** lists manifests for different platforms: linux/amd64, linux/arm64 and others. The `1.30-alpine` tag points to the index. The difference between a tag and a digest matters: a tag is a movable label that can be moved to a new build; a digest is a fingerprint, and it always brings exactly the same bytes.\n\nA layer, by the way, has two hashes: the digest of the compressed archive in the manifest (what is downloaded) and the `diff_id` of the uncompressed tar in the config (what is unpacked).',
      ),
    },
    { id: 'look-intro', kind: 'text', step: 'look', title: bi('Как docker pull находит части образа', 'How docker pull finds the parts of an image'), body: bi('Схема ниже показывает, как клиент Docker по имени `nginx:1.30-alpine` находит в реестре все части образа и что потом делает с ними ядро. В левой колонке сверху вниз идут документы: имя с тегом, индекс платформ, манифест и настройки образа. В средней колонке снизу вверх растёт стопка слоёв. Справа стоят реестр, в котором всё это хранится, файловая система OverlayFS и корень контейнера, который OverlayFS собирает из слоёв.', 'The diagram below shows how the Docker client finds every part of an image in the registry from the name `nginx:1.30-alpine`, and what the kernel then does with them. The left column runs top-down through the documents: the name with its tag, the platform index, the manifest and the config. In the middle column the stack of layers grows upwards, and on the right lie the registry that stores it all, OverlayFS and the container root it assembles.') },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'containers.image-pack', howto: bi('Сначала на схеме только имя образа и реестр. Нажмите «Начать с первого шага» и переходите дальше кнопкой «Шаг вперёд». Каждая часть образа появляется, когда клиент её скачивает. Карточка на стрелке показывает, по чему нашли следующую часть: по тегу, по платформе или по digest. Облачко у подсвеченной части говорит, что с ней происходит. Зелёная рамка означает, что слой уже был на машине, жёлтая показывает, что файл нижнего слоя скрыт или заменён копией, а красная говорит, что проверка не прошла.\n\nПосле первого прохода смените в «Параметрах» процессор машины и посмотрите, как меняются digest манифеста и слоёв, а потом выберите, что процесс делает в контейнере: дописывает строку в файл или удаляет файл. В блоке «Сломать» подмените байт слоя или перевесьте тег и сравните, что получит тот, кто скачивает по тегу, и тот, кто скачивает по digest.', 'At first only the image name and the registry are shown. Press “Start from the first step” and go on with “Step forward”. Each part appears when the client fetches it. The card on the arrow shows how the next part was found: by tag, by platform or by digest. The callout at the highlighted part says what happens to it. A green outline means the layer was already here, yellow that a file of a lower layer is hidden or replaced by a copy, red that a check failed.\n\nAfter the first pass change the machine’s CPU in “Parameters” and watch the digests of the manifest and layers change, then choose what the process does in the container: append a line to a file or delete a file. In “Break it” tamper with a byte of a layer or move the tag, and compare what someone pulling by tag and someone pulling by digest gets.'), caption: bi('Тот же путь можно пройти командами. `docker images --digests` покажет digest образа, `docker manifest inspect` выведет индекс со списком платформ, а `docker image inspect` и `docker history` покажут настройки и слои. В практике ниже вы скачаете nginx и увидите, что слой alpine уже был на машине, точно так же, как на схеме с включённым флажком.', 'You can walk the same path with commands. `docker images --digests` shows the image digest, `docker manifest inspect` prints the index with its platforms, and `docker image inspect` and `docker history` show the config and the layers. In the lab below you will pull nginx and see that the alpine layer was already here, just as in the diagram with the box ticked.') },
    {
      id: 'registry',
      kind: 'text',
      step: 'explain',
      title: bi('Как образы хранятся в реестре и как их туда отправляют', 'How images are kept in a registry and how they are sent there'),
      body: bi(
        '[[docker.registry|Реестром]] называют сервер, на котором образы лежат по репозиториям и тегам. По умолчанию Docker обращается к Docker Hub, поэтому имя `nginx` означает `docker.io/library/nginx`. У компаний бывают свои реестры, например GitLab Container Registry или Harbor, а в курсе есть реестр `registry.lab`. Протокол обмена простой и открытый, он называется OCI Distribution. По этому протоколу клиент получает токен, спрашивает манифест по тегу, а затем скачивает части образа по их digest. Отправка образа командой `docker push` идёт в обратную сторону: сначала загружаются слои, которых в реестре ещё нет, а потом манифест под нужным тегом. Слои, которые в реестре уже есть, повторно не загружаются, и Docker пишет `Layer already exists`.\n\nЧтобы отправить образ в свой реестр, его имя должно начинаться с адреса этого реестра. Поэтому сначала выполняют `docker tag nginx:1.30-alpine registry.lab/learner/web:1.0`, а затем `docker push registry.lab/learner/web:1.0`.',
        'A [[docker.registry|registry]] is a server that keeps images by repositories and tags. Docker Hub is the default: the name `nginx` means `docker.io/library/nginx`. Companies have their own registries: GitLab Container Registry, Harbor; the course has `registry.lab`. The protocol is simple and open (OCI Distribution): the client gets a token, asks for a manifest by tag, then downloads blobs by digest. Sending (`docker push`) goes the other way: first the layers the registry does not have, then the manifest under the tag. Layers that are already there are not uploaded — `Layer already exists`.\n\nTo send an image to your own registry, its name must start with the registry address: `docker tag nginx:1.30-alpine registry.lab/learner/web:1.0`, then `docker push registry.lab/learner/web:1.0`.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: dockerHost({}, { pull: ['alpine:3.22'] }),
      intro: bi('На этой машине установлен Docker и доступен реестр курса `registry.lab`. Образ alpine уже скачан.', 'A machine with Docker and the course registry `registry.lab`. The alpine image is already pulled.'),
      tasks: [
        {
          id: 'pull',
          prompt: bi('Скачайте `nginx:1.30-alpine`. Какой из его слоёв уже был на машине?', 'Pull `nginx:1.30-alpine`. Which of its layers was already on the machine?'),
          check: { when: "images[ref='nginx:1.30-alpine']", stdout: 'Already exists' },
          chips: 'docker pull nginx:1.30-alpine',
          concepts: ['docker.layer'],
          hints: { H1: bi('nginx построен на alpine, поэтому слой alpine с тем же digest скачивать не нужно.', 'nginx is built on alpine — the alpine layer with the same digest need not be downloaded.') },
        },
        {
          id: 'count',
          prompt: bi('Выведите одним числом, сколько слоёв в образе `nginx:1.30-alpine`.', 'Print as one number how many layers `nginx:1.30-alpine` has.'),
          check: { stdout: /^4\n?$/ },
          chips: "docker image inspect nginx:1.30-alpine --format '{{len .RootFS.Layers}}'",
          concepts: ['docker.layer'],
          docRef: help('inspect', 'OPTIONS', '--format'),
          hints: { H1: bi('Слои перечислены в настройках образа, которые показывает `docker image inspect`.', 'The layers are listed in the image config: `docker image inspect`.'), H2: bi('Шаблон `--format` умеет считать длину списка, и для этого в нём пишут `{{len .RootFS.Layers}}`.', 'The `--format` template knows `len`: `{{len .RootFS.Layers}}`.') },
        },
        {
          id: 'history',
          prompt: bi('Посмотрите историю образа nginx. Какие инструкции не создали слоя, то есть показаны с размером 0B?', 'Look at the history of the nginx image. Which instructions created no layer (size 0B)?'),
          check: { stdout: 'STOPSIGNAL' },
          chips: 'docker history nginx:1.30-alpine',
          concepts: ['docker.image'],
          hints: { H1: bi('Инструкции ENV, ENTRYPOINT, CMD, EXPOSE и STOPSIGNAL меняют только настройки образа.', 'ENV, ENTRYPOINT, CMD, EXPOSE, STOPSIGNAL change only the config.') },
        },
        {
          id: 'push',
          prompt: bi('Отправьте образ nginx в реестр курса под именем `registry.lab/learner/web:1.0`.', 'Push the nginx image to the course registry as `registry.lab/learner/web:1.0`.'),
          check: { when: "registry.repoNames has 'registry.lab/learner/web'" },
          chips: 'docker tag nginx:1.30-alpine registry.lab/learner/web:1.0 && docker push registry.lab/learner/web:1.0',
          concepts: ['docker.registry'],
          docRef: help('push', 'USAGE'),
          hints: { H1: bi('Сначала дайте образу второе имя с адресом реестра, а потом отправьте его.', 'First give the image a second name with the registry address, then push.'), H2: bi('Выполните `docker tag ИСТОЧНИК ЦЕЛЬ`, а затем `docker push ЦЕЛЬ`.', '`docker tag SOURCE TARGET`, then `docker push TARGET`.') },
        },
        {
          id: 'digest',
          prompt: bi('Скачайте alpine не по тегу, а по digest. Так вы получите те же самые байты, даже если тег перевесят.', 'Pull alpine not by tag but by digest: that gets exactly the same bytes even if the tag is moved.'),
          check: { when: "registry.log[path~'manifests/sha256:']" },
          chips: 'docker images --digests',
          concepts: ['docker.digest'],
          docRef: help('images', 'OPTIONS', '--digests'),
          hints: { H1: bi('Digest образа показывает команда `docker images --digests`.', '`docker images --digests` shows the image digest.'), H2: bi('Скачивание по digest записывают как `docker pull alpine@sha256:…`.', 'The format: `docker pull alpine@sha256:…`.') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      levels: ['intermediate', 'experienced'],
      mode: 'find',
      prompt: bi('Покажите, для каких платформ в реестре есть образ `nginx:1.30-alpine`, не скачивая сам образ. Глава такой команды не показывала, поэтому найдите её в справке.', 'Show which platforms the registry has for `nginx:1.30-alpine` — without pulling it. The chapter did not show this command, so find it in the help.'),
      ref: { page: 'help/docker-pull' },
      terminal: {
        setup: dockerHost({}, { pull: [] }),
        task: {
          id: 'manifest-inspect',
          prompt: bi('На экране должен быть индекс со списком платформ, а сам образ скачиваться не должен.', 'The index with the list of platforms is on screen, and the image is not pulled.'),
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
      title: bi('Итог главы', 'Summary'),
      body: bi('Образ состоит из стопки слоёв и документа настроек. Каждая его часть адресуется по digest, и путь идёт от тега к индексу, от индекса к манифесту платформы, а от манифеста к настройкам и слоям. Тег можно перевесить, а digest нет. Реестр хранит части образов по их digest, поэтому одинаковые слои скачиваются один раз.', 'An image is a stack of layers and a config. Everything is addressed by digest: tag → index → platform manifest → config and layers. A tag can be moved, a digest cannot. A registry keeps blobs by digest; identical layers download once.'),
    },
  ],
};
