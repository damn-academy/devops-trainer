// "How an image is packed" (04 §8, X3): tag → index → manifest → config and
// layers, every arrow is "by digest"; then the layers are stacked by
// OverlayFS into the container's root, with a writable layer on top, copy-up
// on change and a whiteout on delete.
//
// Reading order: at the start only the name of the image and the registry are
// on the diagram. Each document appears when the client fetches it, each
// arrow carries the digest that was used to find the next piece, and the
// stack of layers is assembled under OverlayFS at the end.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { startWith } from './util';

type P = { platform: string; haveBase: boolean; run: boolean; action: string };

const D = {
  amd64: { manifest: 'sha256:9b1f…e4a2', config: 'sha256:2c77…81d0', l1: 'sha256:6e77…3c1a', l2: 'sha256:a31d…0b9f', l3: 'sha256:f04c…77e2' },
  arm64: { manifest: 'sha256:4d02…c913', config: 'sha256:8a5e…12f7', l1: 'sha256:01bb…e6d4', l2: 'sha256:c7e9…5a30', l3: 'sha256:f04c…77e2' },
};
const ispec = (f: string) => ({ url: `https://github.com/opencontainers/image-spec/blob/main/${f}`, label: `image-spec › ${f}` });
const ALL = ['tag', 'index', 'manifest', 'config', 'l1', 'l2', 'l3', 'upper', 'merged', 'registry', 'overlay', 'e-tag', 'e-plat', 'e-cfg', 'e-layers', 'e-pull', 'e-lower', 'e-upper', 'e-merged'];
const FETCH = bi('Как скачивают образ', 'How the image is fetched');
const CT = bi('Что делают с контейнером', 'What is done with a container');

export const imageModel = defineModel<P>({
  id: 'containers.image-pack',
  block: 'containers',
  title: bi('Как устроен образ и откуда берётся корень контейнера', 'How an image is packed'),
  summary: bi(
    'Схема показывает, что делает `docker pull nginx:1.30-alpine` и что происходит потом при `docker run`. Клиент по имени образа находит в реестре индекс, по индексу манифест своей платформы, по манифесту настройки и слои, причём каждый следующий кусок он ищет по отпечатку содержимого, digest. Затем ядро складывает слои в стопку, и получается корень контейнера.',
    'The diagram shows what `docker pull nginx:1.30-alpine` does and what happens next at `docker run`. From the name the client finds the index in the registry, from the index the manifest of its platform, from the manifest the config and the layers — each next piece by a content fingerprint, the digest. Then the kernel stacks the layers into the container’s root.',
  ),
  intro: bi(
    'Сейчас на схеме только имя образа и реестр, где образ хранится. Нажмите «Начать с первого шага», а дальше переходите от шага к шагу кнопкой «Шаг вперёд». Каждый документ образа появляется, когда клиент его скачивает, а карточка на стрелке показывает digest, по которому нашли следующий кусок. Слева сверху вниз идёт путь от имени к настройкам, в середине снизу вверх растёт стопка слоёв, справа ядро собирает из неё корень контейнера.\n\nПосле первого прохода смените в «Параметрах» платформу и выберите, что сделать в контейнере, а потом включите поломки.',
    'Now the diagram shows only the image name and the registry that stores it. Press “Start from the first step”, then go on with “Step forward”. Each document appears when the client fetches it, and the card on the arrow shows the digest used to find the next piece. On the left the path runs from the name down to the config, in the middle the stack of layers grows upwards, on the right the kernel assembles the container root from it.\n\nAfter the first pass change the platform in “Parameters” and choose what to do in the container, then switch on the breaks.',
  ),
  legend: [
    { mark: 'active', text: bi('часть образа, с которой работают сейчас', 'the part being worked on now') },
    { mark: 'say', text: bi('что происходит с этой частью', 'what happens to this part') },
    { mark: 'token', text: bi('digest или файл, который передаётся дальше', 'a digest or a file passed on') },
    { mark: 'icon:file', text: bi('документ JSON, то есть индекс, манифест или настройки', 'a JSON document, that is an index, a manifest or a config') },
    { mark: 'icon:disk', text: bi('слой, то есть архив с файлами', 'a layer, that is an archive of files') },
    { mark: 'icon:database', text: bi('реестр', 'the registry') },
    { mark: 'icon:folder', text: bi('корень контейнера', 'the container root') },
    { mark: 'ok', text: bi('эта часть уже есть на машине', 'this part is already on the machine') },
    { mark: 'warn', text: bi('файл скрыт или подменён', 'a file hidden or replaced') },
    { mark: 'err', text: bi('проверка не прошла', 'the check failed') },
  ],
  stopLabel: bi('Скачивание остановилось', 'The pull stopped'),
  concepts: ['docker.image', 'docker.layer', 'docker.digest', 'docker.registry'],
  diagram: {
    width: 960,
    height: 540,
    nodes: [
      { id: 'tag', label: 'nginx:1.30-alpine', icon: 'file', sub: 'docker.io/library', family: 'obj', shape: 'pill', x: 24, y: 56, w: 224, h: 56, card: { what: bi('Имя образа состоит из реестра (по умолчанию docker.io), репозитория `library/nginx` и тега `1.30-alpine`. Тег служит изменяемым ярлыком, и автор образа может перевесить его на другую сборку.', 'An image name: the registry (docker.io by default), the repository `library/nginx`, the tag `1.30-alpine`. A tag is a movable label: it can be moved to another build.'), who: bi('Тег выбирает тот, кто публикует образ командой push.', 'Whoever publishes the image chooses the tag at push time.'), see: 'docker images --digests' } },
      { id: 'index', label: bi('Индекс', 'Index'), icon: 'file', sub: 'amd64 · arm64', family: 'obj', shape: 'doc', x: 24, y: 168, w: 224, h: 64, card: { what: bi('В этом документе JSON перечислены манифесты, по одному на каждую платформу (linux/amd64, linux/arm64 и другие). Тег указывает на индекс, а не на отдельный манифест.', 'This JSON document lists manifests, one per platform (linux/amd64, linux/arm64 and others). The tag points to the index, not to a single manifest.'), who: bi('Его создаёт сборка под несколько платформ (`docker buildx build --platform …`).', 'A multi-platform build (`docker buildx build --platform …`).'), see: 'docker manifest inspect nginx:1.30-alpine', doc: ispec('image-index.md') } },
      { id: 'manifest', label: bi('Манифест', 'Manifest'), icon: 'file', family: 'obj', shape: 'doc', x: 24, y: 288, w: 224, h: 64, card: { what: bi('Манифест описывает одну платформу. В нём есть ссылка на документ настроек и список слоёв, и всё это записано через digest, размер и тип содержимого.', 'The manifest of one platform: a link to the config and the list of layers — all by digest, with size and mediaType.'), who: bi('Его записывает сборщик образа.', 'The image builder.'), doc: ispec('manifest.md') } },
      { id: 'config', label: bi('Настройки образа', 'Config'), icon: 'file', sub: 'Cmd · Env · diff_ids', family: 'obj', shape: 'doc', x: 24, y: 408, w: 224, h: 64, card: { what: bi('В документе настроек записано, что запускать (Entrypoint, Cmd), а также переменные, рабочий каталог, пользователь, порты, история инструкций и `rootfs.diff_ids` с отпечатками несжатых слоёв. Отпечаток sha256 этого документа и есть ID образа.', 'The image configuration: what to run (Entrypoint, Cmd), variables, working directory, user, ports, the history of instructions and `rootfs.diff_ids` — hashes of uncompressed layers. Its sha256 is the image ID.'), who: bi('Его пишет сборщик, и инструкции ENV, CMD и подобные попадают сюда, а не в слои.', 'The builder: ENV, CMD and similar instructions write here, not into layers.'), see: "docker image inspect nginx:1.30-alpine --format '{{json .Config}}'", doc: ispec('config.md') } },
      { id: 'l1', label: bi('Слой 1: alpine', 'Layer 1: alpine'), icon: 'disk', sub: '8.3 MB', family: 'store', x: 360, y: 408, w: 216, h: 56, card: { what: bi('Каждый слой хранится как архив tar с файлами, и в этом слое лежит базовая система Alpine. Тот же слой есть у других образов на основе alpine, поэтому на машину он скачивается один раз.', 'A layer is a tar archive of files. This one is the Alpine base system. Other alpine-based images share it: it downloads once.'), who: bi('Его создала инструкция `FROM alpine` в чужом Dockerfile.', 'The `FROM alpine` instruction of someone else’s Dockerfile.'), doc: ispec('layer.md') } },
      { id: 'l2', label: bi('Слой 2: nginx', 'Layer 2: nginx'), icon: 'disk', sub: '9.6 MB', family: 'store', x: 360, y: 328, w: 216, h: 56, card: { what: bi('В этом слое лежат пакет nginx, его файлы настроек и стартовая страница.', 'A layer with the nginx package, its configs and the start page.'), who: bi('Его создала инструкция RUN apk add nginx.', 'The RUN apk add nginx instruction.') } },
      { id: 'l3', label: bi('Слой 3: скрипт запуска', 'Layer 3: entrypoint'), icon: 'disk', sub: '1.6 kB', family: 'store', x: 360, y: 248, w: 216, h: 56, card: { what: bi('В этом маленьком слое лежит один скрипт `/docker-entrypoint.sh`.', 'A small layer: the /docker-entrypoint.sh script.'), who: bi('Его создала инструкция COPY.', 'The COPY instruction.') } },
      { id: 'upper', label: bi('Записываемый слой', 'Writable layer'), icon: 'disk', sub: 'upperdir', family: 'ns', x: 360, y: 136, w: 216, h: 56, card: { what: bi('Этот пустой слой лежит сверху, и у каждого контейнера он свой. Всё, что контейнер записывает в свой корень, попадает сюда и пропадает вместе с контейнером после `docker rm`.', 'An empty layer on top, one per container. Everything the container writes into its root lands here — and goes away with the container on `docker rm`.'), who: bi('Его создаёт containerd, когда создаётся контейнер.', 'containerd when the container is created.'), see: 'docker diff web' } },
      { id: 'merged', label: bi('Корень контейнера', 'Container root'), icon: 'folder', sub: '/  (merged)', family: 'process', x: 656, y: 136, w: 296, h: 64, card: { what: bi('Процесс видит как `/` слои, наложенные друг на друга. Верхний слой закрывает файлы нижних, а удалённый файл закрыт пометкой об удалении.', 'What the process sees as `/`: the layers laid on top of each other. An upper layer covers the lower ones; a deleted file is covered by a deletion mark.'), who: bi('Его показывает ядро через файловую систему OverlayFS.', 'The kernel, the OverlayFS file system.'), see: 'docker exec web ls /' } },
      { id: 'registry', label: bi('Реестр', 'Registry'), icon: 'database', sub: '/v2/library/nginx/', family: 'store', x: 720, y: 408, w: 232, h: 64, card: { what: bi('Реестр хранит части образов (blob) по их отпечаткам sha256: манифесты, настройки и слои. Разговаривают с ним по протоколу OCI Distribution запросами `GET /v2/<repo>/manifests/<tag>` и `GET /v2/<repo>/blobs/<digest>`.', 'A server that keeps blobs by their sha256: manifests, configs, layers. The protocol is OCI Distribution: `GET /v2/<repo>/manifests/<tag>`, `GET /v2/<repo>/blobs/<digest>`.'), who: bi('Реестры держат Docker Hub, GitLab и Harbor, а в курсе есть свой реестр registry.lab.', 'Docker Hub, GitLab, Harbor, the course registry registry.lab.'), doc: { url: 'https://github.com/opencontainers/distribution-spec/blob/main/spec.md', label: 'distribution-spec' } } },
      { id: 'overlay', label: 'OverlayFS', sub: 'lowerdir=L3:L2:L1 · upperdir=U', family: 'kernel', shape: 'bar', x: 616, y: 264, w: 336, h: 72, card: { what: bi('Эта файловая система ядра показывает несколько каталогов как один, причём нижние доступны только для чтения, а верхний для записи. Сам механизм вы видели в блоке Linux, а здесь он собирает корень контейнера из слоёв образа.', 'A kernel file system that shows several directories as one: the lower ones read-only, the upper one writable. You met the mechanism in the Linux block; here it assembles the root from the image layers.'), who: bi('Её монтирует ядро по команде от containerd.', 'The kernel, on a mount from containerd.'), see: 'mount | grep overlay', doc: { url: 'https://docs.kernel.org/filesystems/overlayfs.html', label: 'docs.kernel.org › overlayfs' } } },
    ],
    edges: [
      { id: 'e-tag', from: 'tag', to: 'index', label: bi('по тегу', 'by tag'), card: { what: bi('Этот шаг единственный идёт не по digest. Реестр сообщает, какой digest индекса висит на теге сейчас (заголовок Docker-Content-Digest).', 'The only step not by digest: the tag resolves to the index digest (the Docker-Content-Digest header).'), who: bi('Digest индекса по тегу сообщает реестр.', 'The registry.') } },
      { id: 'e-plat', from: 'index', to: 'manifest', label: bi('по платформе', 'by platform'), card: { what: bi('Клиент выбирает в индексе строку своей платформы и скачивает этот манифест по его digest.', 'The client picks the entry for its platform and fetches that manifest by digest.'), who: bi('Строку выбирают демоны dockerd и containerd, которые знают, на каком процессоре работает машина.', 'dockerd / containerd.') } },
      { id: 'e-cfg', from: 'manifest', to: 'config', label: bi('по digest', 'by digest'), card: { what: bi('Документ настроек тоже хранится в реестре по отпечатку своего содержимого.', 'The config is also a blob at a content address.'), who: bi('Документ настроек скачивает клиент Docker.', 'The client.') } },
      { id: 'e-layers', from: 'manifest', to: 'l3', label: bi('слои по digest', 'layers by digest'), card: { what: bi('Каждый слой скачивается по digest сжатого архива, а потом клиент проверяет, что отпечаток sha256 полученных байтов совпадает с записанным.', 'Each layer is downloaded by the digest of its compressed archive and checked: the sha256 of the received bytes must match.'), who: bi('Отпечаток каждого слоя проверяет клиент Docker.', 'The client.') } },
      { id: 'e-pull', from: 'registry', to: 'l1', label: 'GET /v2/…/blobs', card: { what: bi('Клиент запрашивает у реестра часть образа. Если слой с таким digest уже есть на машине, Docker пишет «Already exists» и не скачивает его.', 'A blob request to the registry. If a layer with this digest is already here — “Already exists”, no download.'), who: bi('Части образа у реестра запрашивает команда docker pull.', 'docker pull.') } },
      { id: 'e-lower', from: 'l2', to: 'overlay', label: 'lowerdir', card: { what: bi('Слои образа становятся нижними каталогами overlay и доступны только для чтения.', 'The image layers become overlay lower directories — read-only.'), who: bi('Их подключает containerd.', 'containerd (the snapshotter).') } },
      { id: 'e-upper', from: 'upper', to: 'overlay', label: 'upperdir', card: { what: bi('Записываемый слой контейнера становится верхним каталогом overlay.', 'The container’s writable layer is the overlay upper directory.'), who: bi('Его подключает containerd.', 'containerd.') } },
      { id: 'e-merged', from: 'overlay', to: 'merged', label: 'merged', card: { what: bi('Наложенные друг на друга слои дают корень, который видит процесс контейнера.', 'The result of the stacking — the root the process sees.'), who: bi('Его показывает ядро.', 'The kernel.') } },
    ],
  },
  params: [
    {
      id: 'platform',
      label: bi('Процессор машины, на которую скачивают образ', 'Platform'),
      kind: 'choice',
      default: 'amd64',
      options: [
        { id: 'amd64', label: bi('linux/amd64', 'linux/amd64') },
        { id: 'arm64', label: bi('linux/arm64', 'linux/arm64') },
      ],
      near: 'index',
      group: FETCH,
      predict: {
        prompt: bi('Вы меняете процессор машины, а тег остаётся прежним, nginx:1.30-alpine. Получит ли машина тот же манифест и те же слои?', 'You change the machine’s CPU while the tag stays nginx:1.30-alpine. Will the machine get the same manifest and layers?'),
        options: [
          { id: 'other', text: bi('Нет, индекс укажет на манифест другой платформы с другими слоями', 'No, the index points to the other platform’s manifest with other layers') },
          { id: 'same', text: bi('Да, потому что тег однозначно определяет весь образ', 'Yes, because the tag fully determines the image') },
        ],
        resolve: () => 'other',
      },
    },
    { id: 'haveBase', label: bi('Слой alpine уже скачан вместе с другим образом', 'The alpine layer is already here from another image'), kind: 'toggle', default: false, near: 'l1', group: FETCH },
    { id: 'run', label: bi('Запустить из образа контейнер', 'Run a container'), kind: 'toggle', default: true, near: 'upper', group: CT },
    {
      id: 'action',
      label: bi('Что процесс делает в контейнере', 'What to do in the container'),
      kind: 'choice',
      default: 'edit',
      options: [
        { id: 'none', label: bi('ничего не меняет', 'nothing') },
        { id: 'edit', label: bi('дописывает строку в /etc/nginx/nginx.conf', 'append a line to /etc/nginx/nginx.conf') },
        { id: 'delete', label: bi('удаляет /usr/share/nginx/html/index.html', 'delete /usr/share/nginx/html/index.html') },
      ],
      near: 'merged',
      group: CT,
      predict: {
        prompt: bi('Процесс в контейнере удаляет файл index.html, который пришёл из слоя образа. Станет ли образ меньше?', 'The container deletes a file of the image. Does the image get smaller?'),
        options: [
          { id: 'no', text: bi('Нет, файл останется в нижнем слое, а сверху ляжет пометка об удалении', 'No, the file stays in the lower layer; a deletion mark lies on top') },
          { id: 'yes', text: bi('Да, файл сотрётся из слоя образа', 'Yes, the file is erased from the layer') },
        ],
        resolve: () => 'no',
      },
    },
  ],
  breaks: [
    {
      id: 'tamper',
      label: bi('Один байт слоя подменили по дороге из реестра', 'Change one byte of a layer on the way'),
      remove: ['e-pull'],
      boundary: 'storage',
      predict: {
        prompt: bi('Кто-то по дороге из реестра изменил один байт в слое alpine. Что сделает docker pull?', 'One byte of a layer changed on the way. What does docker pull do?'),
        options: [
          { id: 'fail', text: bi('Скачивание остановится, потому что отпечаток sha256 полученных байтов не совпадёт с digest', 'The pull stops, because the sha256 of the bytes does not match the digest') },
          { id: 'ok', text: bi('Ничего не заметит и сохранит слой', 'It notices nothing') },
        ],
        resolve: () => 'fail',
      },
    },
    {
      id: 'retag',
      label: bi('Автор перевесил тег 1.30-alpine на новую сборку', 'Move the tag to a new build'),
      remove: ['e-tag'],
      boundary: 'storage',
      predict: {
        prompt: bi('Автор образа перевесил тег 1.30-alpine на новую сборку. Что получит тот, кто скачивает образ по старому digest?', 'The author moved the 1.30-alpine tag to a new build. What does a pull by the old digest get?'),
        options: [
          { id: 'old', text: bi('Прежний образ, потому что digest остаётся отпечатком содержимого', 'The old image, because a digest is a fingerprint of the content') },
          { id: 'new', text: bi('Новую сборку, так же как тот, кто качает по тегу', 'The new build, as by tag') },
        ],
        resolve: () => 'old',
      },
    },
  ],
  metrics: [
    { id: 'download', label: bi('сколько нужно скачать', 'how much to download'), unit: 'MB' },
    { id: 'layers', label: bi('сколько слоёв в стопке', 'how many layers are in the stack') },
    { id: 'upperBytes', label: bi('сколько байт лежит в записываемом слое', 'how many bytes are in the writable layer'), unit: 'B' },
  ],
  run(p, broken): Step[] {
    const d = D[p.platform as 'amd64' | 'arm64'] ?? D.amd64;
    const download = Math.round(((p.haveBase ? 0 : 3.6) + 4.1 + 0.001) * 10) / 10;
    const base = { download, layers: p.run ? 4 : 3, upperBytes: 0 };
    const steps: Step[] = [];
    steps.push({
      id: 'name',
      label: bi('имя', 'name'),
      caption: bi('Вы набрали `docker pull nginx:1.30-alpine`. По этому имени клиент знает, в каком реестре искать образ, в каком репозитории и с каким тегом.', 'You typed `docker pull nginx:1.30-alpine`. From this name the client knows which registry to ask, which repository and which tag.'),
      focus: ['tag'],
      say: { tag: bi('Клиент спрашивает реестр, что сейчас висит на теге 1.30-alpine.', 'The client asks the registry what the 1.30-alpine tag points to now.') },
      states: startWith(ALL, 'tag', 'registry'),
    });
    if (broken.has('retag')) {
      steps.push({
        id: 'retag',
        label: bi('тег', 'tag'),
        caption: bi('Тег перевешен, и `nginx:1.30-alpine` теперь ведёт к новому индексу. Тот, кто скачивает образ по тегу, получит новую сборку, а тот, кто скачивает по digest, получит в точности прежнюю.', 'The tag was moved: `nginx:1.30-alpine` now leads to a new index. Whoever pulls by tag gets the new build; whoever pulls by digest gets exactly the old one.'),
        focus: ['index', 'e-tag'],
        reveal: ['index', 'e-tag'],
        tokens: [{ edge: 'e-tag', label: 'sha256:77d0… (new)' }],
        say: { index: bi('На тег теперь повешен другой индекс, с другой сборкой внутри.', 'The tag now points to another index with another build.') },
        states: { tag: 'warn', index: 'warn' },
        values: { index: 'sha256:77d0… (new)' },
        metrics: base,
        broken: { at: 'e-tag', message: 'docker pull nginx:1.30-alpine            → Digest: sha256:77d0…\ndocker pull nginx@sha256:5c1e…          → Digest: sha256:5c1e…', caption: bi('Расхождение возникло на теге. По тегу приходит то, что на него повесили сейчас, а по digest приходит то, что вы когда-то проверили.', 'The difference arises at the tag. By tag you get whatever hangs on it now, and by digest you get what you once checked.') },
      });
      return steps;
    }
    steps.push({
      id: 'index',
      label: bi('индекс', 'index'),
      caption: bi('Реестр отвечает digest индекса в заголовке Docker-Content-Digest, и клиент скачивает сам индекс. В индексе перечислены манифесты для каждой платформы.', 'The registry answers with the index digest in the Docker-Content-Digest header, and the client fetches the index. It lists a manifest per platform.'),
      focus: ['index', 'e-tag'],
      reveal: ['index', 'e-tag'],
      tokens: [{ edge: 'e-tag', label: 'sha256:5c1e…a07b' }],
      say: { index: bi('Индекс перечисляет манифесты для amd64 и arm64.', 'The index lists manifests for amd64 and arm64.') },
      values: { index: 'sha256:5c1e…a07b' },
      metrics: base,
    });
    steps.push({
      id: 'platform',
      label: bi('манифест', 'manifest'),
      caption: fmt(bi('Машина работает на процессоре {p}, поэтому клиент берёт из индекса строку linux/{p} и скачивает манифест {m}.', 'The index has a manifest per platform. A client on {p} takes the linux/{p} entry and the manifest {m}.'), { p: p.platform, m: d.manifest }),
      focus: ['manifest', 'e-plat'],
      reveal: ['manifest', 'e-plat'],
      tokens: [{ edge: 'e-plat', label: `linux/${p.platform}` }],
      say: { manifest: fmt(bi('Манифест linux/{p} перечисляет настройки и три слоя по их digest.', 'The linux/{p} manifest lists the config and three layers by digest.'), { p: p.platform }) },
      values: { manifest: d.manifest },
      metrics: base,
    });
    steps.push({
      id: 'config',
      label: bi('настройки', 'config'),
      caption: fmt(bi('По ссылке из манифеста клиент скачивает документ настроек {c}. В нём записано, что запускать, и перечислены отпечатки слоёв. Инструкции ENV, CMD и EXPOSE из Dockerfile попадают сюда, своего слоя у них нет.', 'The manifest refers to the config {c}: what to run and `rootfs.diff_ids`. ENV, CMD, EXPOSE live here — they have no layer.'), { c: d.config }),
      focus: ['config', 'e-cfg'],
      reveal: ['config', 'e-cfg'],
      tokens: [{ edge: 'e-cfg', label: d.config }],
      say: { config: bi('Настройки говорят, что запускать: CMD ["nginx", "-g", "daemon off;"].', 'The config says what to run: CMD ["nginx", "-g", "daemon off;"].') },
      values: { config: d.config },
      metrics: base,
    });
    if (broken.has('tamper')) {
      steps.push({
        id: 'verify',
        label: 'sha256',
        caption: bi('Клиент скачал слой alpine и посчитал отпечаток sha256 полученных байтов. Отпечаток не совпал с digest из манифеста, и слой отвергнут, потому что адрес по содержимому сам проверяет, что содержимое цело.', 'The client downloaded a layer and computed the sha256 of the bytes: it does not match the digest in the manifest.'),
        focus: ['l1', 'e-pull'],
        reveal: ['l1', 'e-pull'],
        tokens: [{ edge: 'e-pull', label: d.l1 }],
        say: { l1: bi('Отпечаток полученных байтов не совпал с digest, и слой отвергнут.', 'The fingerprint of the bytes does not match the digest; the layer is refused.') },
        states: { l1: 'err' },
        metrics: base,
        broken: { at: 'e-pull', message: `failed to register layer: unexpected EOF\nfailed commit on ref "layer-${d.l1}": "layer-${d.l1}" failed size validation: digest mismatch`, caption: bi('Скачивание остановилось на проверке слоя. Подменённый слой не примут, даже если подмена случилась в сети или в зеркале реестра.', 'The pull stopped at the layer check. A tampered layer is refused even if the tampering happened on the network or in a registry mirror.') },
      });
      return steps;
    }
    steps.push({
      id: 'layers',
      label: bi('слои', 'layers'),
      caption: p.haveBase
        ? fmt(bi('Затем клиент скачивает слои по их digest. Слой alpine {l} уже есть на машине, Docker пишет `Already exists`, и скачиваются только два слоя, {mb} МБ.', 'Layers by digest. The alpine layer {l} is already here — `Already exists`, only two download: {mb} MB.'), { l: d.l1, mb: download })
        : fmt(bi('Затем клиент скачивает три слоя по их digest, всего {mb} МБ в сжатом виде. У каждого слоя есть два отпечатка. Digest сжатого архива записан в манифесте, а diff_id несжатого архива записан в настройках.', 'Layers by digest: three blobs, {mb} MB compressed. Each layer has two hashes: the digest of the compressed archive in the manifest and the diff_id of the uncompressed tar in the config.'), { mb: download }),
      focus: ['registry', 'e-pull'],
      reveal: ['l1', 'l2', 'l3', 'e-pull', 'e-layers'],
      tokens: [{ edge: 'e-pull', label: d.l1 }],
      say: { registry: p.haveBase ? bi('Слой alpine с этим digest уже лежит на машине, поэтому реестр отдаёт только два других слоя.', 'An alpine layer with this digest is already here, so the registry serves only the other two layers.') : bi('Реестр отдаёт слои по их digest, а клиент проверяет отпечаток sha256 каждого слоя.', 'The registry serves the layers by digest, and the client checks the sha256 of each one.') },
      states: { l1: p.haveBase ? 'ok' : 'on' },
      values: { l1: p.haveBase ? 'Already exists' : d.l1, l2: d.l2, l3: d.l3 },
      metrics: base,
    });
    steps.push({
      id: 'stack',
      label: 'overlay',
      caption: bi('Когда контейнер создаётся, ядро складывает слои в стопку файловой системой OverlayFS. Каждый следующий слой закрывает одноимённые файлы предыдущего, а все слои образа доступны только для чтения.', 'The layers stack up: each next one covers the files of the previous. The kernel shows them as one tree through OverlayFS — the lower ones are read-only.'),
      focus: ['overlay', 'e-lower'],
      reveal: ['overlay', 'e-lower'],
      tokens: [{ edge: 'e-lower', label: 'L3:L2:L1' }],
      say: { overlay: bi('OverlayFS накладывает слои друг на друга, верхние поверх нижних.', 'OverlayFS lays the layers on top of each other.') },
      metrics: base,
    });
    steps.push({
      id: 'merged',
      label: bi('корень', 'root'),
      caption: bi('Наложенные слои и образуют корень контейнера. Процесс видит одно дерево файлов и не знает, из какого слоя пришёл каждый файл.', 'The result of the stacking is the container root: the process sees one file tree and does not know which layer each file came from.'),
      focus: ['merged', 'e-merged'],
      reveal: ['merged', 'e-merged'],
      say: { merged: bi('Процесс видит одно дерево файлов, собранное из всех слоёв.', 'The process sees one file tree assembled from all the layers.') },
      metrics: base,
    });
    if (p.run) {
      steps.push({
        id: 'upper',
        label: 'upper',
        caption: bi('Запуск контейнера добавляет сверху пустой записываемый слой, у каждого контейнера свой. Сам образ при этом не меняется, поэтому из одного образа можно запустить сколько угодно контейнеров.', 'Running a container adds an empty writable layer on top — one per container. The image itself does not change: any number of containers can run from one image.'),
        focus: ['upper', 'e-upper'],
        reveal: ['upper', 'e-upper'],
        say: { upper: bi('Записываемый слой пока пуст, потому что контейнер ещё ничего не менял.', 'The writable layer is still empty: the container has changed nothing.') },
        values: { upper: 'upperdir: empty' },
        metrics: base,
      });
      if (p.action === 'edit')
        steps.push({
          id: 'copyup',
          label: 'copy-up',
          caption: bi('Процесс дописывает строку в `/etc/nginx/nginx.conf`. Этот файл лежит в нижнем слое, а писать туда нельзя, поэтому ядро сначала целиком копирует файл наверх (это называется copy-up) и меняет уже копию. Команда `docker diff` покажет `C /etc/nginx/nginx.conf`.', '`echo … >> /etc/nginx/nginx.conf`: the file is in a lower layer, which cannot be written. The kernel first copies it whole to the top (copy-up) and then changes the copy. `docker diff` shows `C /etc/nginx/nginx.conf`.'),
          focus: ['upper', 'e-upper'],
          tokens: [{ edge: 'e-upper', label: 'nginx.conf', reverse: true }],
          say: { upper: bi('Ядро копирует nginx.conf из слоя 2 наверх и меняет копию.', 'The kernel copies nginx.conf up from layer 2 and changes the copy.') },
          states: { l2: 'warn' },
          values: { upper: 'C /etc/nginx/nginx.conf' },
          metrics: { ...base, upperBytes: 662 },
        });
      if (p.action === 'delete')
        steps.push({
          id: 'whiteout',
          label: 'whiteout',
          caption: bi('Процесс удаляет `/usr/share/nginx/html/index.html`. Изменить нижний слой нельзя, поэтому наверху появляется пометка об удалении (whiteout). В ядре такая пометка выглядит как символьное устройство 0:0, а в архиве слоя как файл `.wh.index.html`. Процесс файла больше не видит, но в образе файл остался и по-прежнему занимает место.', '`rm /usr/share/nginx/html/index.html`: the lower layer cannot change, so a deletion mark appears on top (a whiteout: a 0:0 character device in the kernel, `.wh.index.html` in a layer tar). The file is hidden, yet it is still in the image and takes space.'),
          focus: ['upper'],
          say: { upper: bi('Наверху появляется пометка об удалении, а сам файл остаётся в слое 2.', 'A deletion mark appears on top; the file itself stays in layer 2.') },
          states: { l2: 'warn' },
          values: { upper: 'D /usr/share/nginx/html/index.html' },
          metrics: base,
        });
    }
    return steps;
  },
  explainDelta(_prev, next, change, a, b): Bi {
    const m = next[next.length - 1]?.metrics ?? {};
    if (change.kind === 'break')
      return change.on
        ? change.id === 'tamper'
          ? bi('Изменённый байт меняет и отпечаток sha256, поэтому проверка останавливает скачивание.', 'A changed byte means a changed sha256: the check stops the pull.')
          : bi('Тег перевесили, а digest по-прежнему указывает на прежнее содержимое.', 'The tag moved; the digest still points to the old content.')
        : bi('Поломку убрали, и образ снова скачивается целиком.', 'The failure is removed.');
    switch (change.id) {
      case 'platform':
        return fmt(bi('Платформа сменилась с {a} на {b}. Тег тот же, но индекс выбрал другой манифест с другими слоями.', '{a} → {b}: the same tag but another manifest and other layers — the index picks by platform.'), { a: a.platform as string, b: b.platform as string });
      case 'haveBase':
        return fmt(bi('Скачать нужно {mb} МБ, потому что слой с тем же digest второй раз не скачивается.', '{mb} MB to download: a layer with the same digest is not downloaded twice.'), { mb: m.download ?? 0 });
      case 'run':
        return b.run ? bi('Контейнер складывается из стопки слоёв образа и собственного записываемого слоя.', 'A container is the image stack plus its own writable layer.') : bi('Пока контейнера нет, образ остаётся лишь стопкой слоёв только для чтения.', 'Without a container the image is only a stack of read-only layers.');
      case 'action':
        return b.action === 'edit'
          ? bi('Изменить файл из образа значит скопировать его в записываемый слой и поменять копию.', 'Changing a file of the image is a copy-up into the writable layer.')
          : b.action === 'delete'
            ? bi('Удалить файл из образа значит положить сверху пометку об удалении, а нижний слой при этом не уменьшается.', 'Deleting a file of the image is a whiteout on top; the lower layer does not shrink.')
            : bi('Процесс ничего не меняет, и записываемый слой остаётся пустым.', 'The writable layer is empty.');
    }
    return bi('Схема пересчитана для новых параметров.', 'The model is recomputed.');
  },
});
