// "How an image is packed" (04 §8, X3): tag → index → manifest → config and
// layers, every arrow is "by digest"; then the layers are stacked by
// OverlayFS into the container's root, with a writable layer on top, copy-up
// on change and a whiteout on delete.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';

type P = { platform: string; haveBase: boolean; run: boolean; action: string };

const D = {
  amd64: { manifest: 'sha256:9b1f…e4a2', config: 'sha256:2c77…81d0', l1: 'sha256:6e77…3c1a', l2: 'sha256:a31d…0b9f', l3: 'sha256:f04c…77e2' },
  arm64: { manifest: 'sha256:4d02…c913', config: 'sha256:8a5e…12f7', l1: 'sha256:01bb…e6d4', l2: 'sha256:c7e9…5a30', l3: 'sha256:f04c…77e2' },
};
const ispec = (f: string) => ({ url: `https://github.com/opencontainers/image-spec/blob/main/${f}`, label: `image-spec › ${f}` });

export const imageModel = defineModel<P>({
  id: 'containers.image-pack',
  block: 'containers',
  title: bi('Как упакован образ', 'How an image is packed'),
  summary: bi('От имени `nginx:1.30-alpine` до файлов в корне контейнера: каждый шаг — поиск по адресу содержимого, а корень — стопка слоёв под OverlayFS.', 'From the name `nginx:1.30-alpine` to the files in the container’s root: every step is a lookup by content address, and the root is a stack of layers under OverlayFS.'),
  concepts: ['docker.image', 'docker.layer', 'docker.digest', 'docker.registry'],
  diagram: {
    width: 960,
    height: 520,
    nodes: [
      { id: 'tag', label: 'nginx:1.30-alpine', sub: 'docker.io/library', family: 'obj', shape: 'pill', x: 24, y: 40, w: 208, h: 56, card: { what: bi('Имя образа: реестр (по умолчанию docker.io), репозиторий `library/nginx`, тег `1.30-alpine`. Тег — изменяемый ярлык: его можно перевесить на другую сборку.', 'An image name: the registry (docker.io by default), the repository `library/nginx`, the tag `1.30-alpine`. A tag is a movable label: it can be moved to another build.'), who: bi('Тот, кто публикует образ, выбирает тег при push.', 'Whoever publishes the image chooses the tag at push time.'), see: 'docker images --digests' } },
      { id: 'index', label: 'index', sub: 'amd64 · arm64', family: 'obj', shape: 'doc', x: 24, y: 152, w: 208, h: 64, card: { what: bi('Документ JSON со списком манифестов — по одному на платформу (linux/amd64, linux/arm64…). Тег указывает на него.', 'A JSON document listing manifests — one per platform (linux/amd64, linux/arm64…). The tag points to it.'), who: bi('Сборка под несколько платформ (`docker buildx build --platform …`).', 'A multi-platform build (`docker buildx build --platform …`).'), see: 'docker manifest inspect nginx:1.30-alpine', doc: ispec('image-index.md') } },
      { id: 'manifest', label: 'manifest', family: 'obj', shape: 'doc', x: 24, y: 264, w: 208, h: 64, card: { what: bi('Манифест одной платформы: ссылка на config и список слоёв — всё по digest с размером и mediaType.', 'The manifest of one platform: a link to the config and the list of layers — all by digest, with size and mediaType.'), who: bi('Сборщик образа.', 'The image builder.'), doc: ispec('manifest.md') } },
      { id: 'config', label: 'config', sub: 'Cmd · Env · diff_ids', family: 'obj', shape: 'doc', x: 24, y: 384, w: 208, h: 64, card: { what: bi('Конфигурация образа: что запускать (Entrypoint, Cmd), переменные, рабочий каталог, пользователь, порты, история инструкций и `rootfs.diff_ids` — хеши несжатых слоёв. Её sha256 и есть ID образа.', 'The image configuration: what to run (Entrypoint, Cmd), variables, working directory, user, ports, the history of instructions and `rootfs.diff_ids` — hashes of uncompressed layers. Its sha256 is the image ID.'), who: bi('Сборщик: инструкции ENV, CMD и подобные пишут сюда, а не в слои.', 'The builder: ENV, CMD and similar instructions write here, not into layers.'), see: "docker image inspect nginx:1.30-alpine --format '{{json .Config}}'", doc: ispec('config.md') } },
      { id: 'l1', label: bi('слой 1: alpine', 'layer 1: alpine'), sub: '8.3 MB', family: 'store', x: 312, y: 384, w: 232, h: 56, card: { what: bi('Слой — tar-архив файлов. Этот — базовая система Alpine. Его же используют другие образы на alpine: скачивается один раз.', 'A layer is a tar archive of files. This one is the Alpine base system. Other alpine-based images share it: it downloads once.'), who: bi('Инструкция `FROM alpine` в чужом Dockerfile.', 'The `FROM alpine` instruction of someone else’s Dockerfile.'), doc: ispec('layer.md') } },
      { id: 'l2', label: bi('слой 2: nginx', 'layer 2: nginx'), sub: '9.6 MB', family: 'store', x: 312, y: 304, w: 232, h: 56, card: { what: bi('Слой с пакетом nginx, его конфигами и стартовой страницей.', 'A layer with the nginx package, its configs and the start page.'), who: bi('Инструкция RUN apk add nginx.', 'The RUN apk add nginx instruction.') } },
      { id: 'l3', label: bi('слой 3: entrypoint', 'layer 3: entrypoint'), sub: '1.6 kB', family: 'store', x: 312, y: 224, w: 232, h: 56, card: { what: bi('Маленький слой: скрипт /docker-entrypoint.sh.', 'A small layer: the /docker-entrypoint.sh script.'), who: bi('Инструкция COPY.', 'The COPY instruction.') } },
      { id: 'upper', label: bi('записываемый слой', 'writable layer'), sub: 'upperdir', family: 'ns', x: 312, y: 120, w: 232, h: 56, card: { what: bi('Пустой слой сверху, свой у каждого контейнера. Всё, что контейнер пишет в корень, попадает сюда — и исчезает вместе с контейнером при `docker rm`.', 'An empty layer on top, one per container. Everything the container writes into its root lands here — and goes away with the container on `docker rm`.'), who: bi('containerd при создании контейнера.', 'containerd when the container is created.'), see: 'docker diff web' } },
      { id: 'merged', label: bi('корень контейнера', 'container root'), sub: '/  (merged)', family: 'process', x: 640, y: 120, w: 296, h: 64, card: { what: bi('То, что процесс видит как `/`: слои, наложенные друг на друга. Верхний слой закрывает нижние; удалённый файл закрыт «пометкой об удалении».', 'What the process sees as `/`: the layers laid on top of each other. An upper layer covers the lower ones; a deleted file is covered by a deletion mark.'), who: bi('Ядро, файловая система OverlayFS.', 'The kernel, the OverlayFS file system.'), see: 'docker exec web ls /' } },
      { id: 'registry', label: bi('реестр', 'registry'), sub: '/v2/library/nginx/', family: 'store', shape: 'rack', x: 640, y: 384, w: 296, h: 64, card: { what: bi('Сервер, хранящий blob-ы по их sha256: манифесты, config, слои. Протокол — OCI Distribution: `GET /v2/<repo>/manifests/<tag>`, `GET /v2/<repo>/blobs/<digest>`.', 'A server that keeps blobs by their sha256: manifests, configs, layers. The protocol is OCI Distribution: `GET /v2/<repo>/manifests/<tag>`, `GET /v2/<repo>/blobs/<digest>`.'), who: bi('Docker Hub, GitLab, Harbor, реестр курса registry.lab.', 'Docker Hub, GitLab, Harbor, the course registry registry.lab.'), doc: { url: 'https://github.com/opencontainers/distribution-spec/blob/main/spec.md', label: 'distribution-spec' } } },
      { id: 'overlay', label: 'OverlayFS', sub: 'lowerdir=L3:L2:L1 · upperdir=U', family: 'kernel', shape: 'bar', x: 600, y: 248, w: 336, h: 72, card: { what: bi('Файловая система ядра, которая показывает несколько каталогов как один: нижние только для чтения, верхний — для записи. Механизм вы видели в блоке Linux; здесь он собирает корень из слоёв образа.', 'A kernel file system that shows several directories as one: the lower ones read-only, the upper one writable. You met the mechanism in the Linux block; here it assembles the root from the image layers.'), who: bi('Ядро, по команде mount от containerd.', 'The kernel, on a mount from containerd.'), see: 'mount | grep overlay', doc: { url: 'https://docs.kernel.org/filesystems/overlayfs.html', label: 'docs.kernel.org › overlayfs' } } },
    ],
    edges: [
      { id: 'e-tag', from: 'tag', to: 'index', label: bi('по тегу', 'by tag'), card: { what: bi('Единственный шаг не по digest: тег разрешается в digest индекса (заголовок Docker-Content-Digest).', 'The only step not by digest: the tag resolves to the index digest (the Docker-Content-Digest header).'), who: bi('Реестр.', 'The registry.') } },
      { id: 'e-plat', from: 'index', to: 'manifest', label: bi('по платформе → digest', 'by platform → digest'), card: { what: bi('Клиент выбирает строку своей платформы и берёт манифест по его digest.', 'The client picks the entry for its platform and fetches that manifest by digest.'), who: bi('dockerd / containerd.', 'dockerd / containerd.') } },
      { id: 'e-cfg', from: 'manifest', to: 'config', label: bi('по digest', 'by digest'), card: { what: bi('config — тоже blob по адресу содержимого.', 'The config is also a blob at a content address.'), who: bi('Клиент.', 'The client.') } },
      { id: 'e-layers', from: 'manifest', to: 'l3', label: bi('слои по digest', 'layers by digest'), card: { what: bi('Каждый слой скачивается по digest сжатого архива и проверяется: sha256 полученных байтов должен совпасть.', 'Each layer is downloaded by the digest of its compressed archive and checked: the sha256 of the received bytes must match.'), who: bi('Клиент.', 'The client.') } },
      { id: 'e-pull', from: 'registry', to: 'l1', label: 'GET /v2/…/blobs/sha256:…', card: { what: bi('Запрос blob-а у реестра. Если слой с таким digest уже есть локально — «Already exists», не качается.', 'A blob request to the registry. If a layer with this digest is already here — “Already exists”, no download.'), who: bi('docker pull.', 'docker pull.') } },
      { id: 'e-lower', from: 'l2', to: 'overlay', label: 'lowerdir', card: { what: bi('Слои образа становятся нижними каталогами overlay — только для чтения.', 'The image layers become overlay lower directories — read-only.'), who: bi('containerd (снапшоттер).', 'containerd (the snapshotter).') } },
      { id: 'e-upper', from: 'upper', to: 'overlay', label: 'upperdir', card: { what: bi('Записываемый слой контейнера — верхний каталог overlay.', 'The container’s writable layer is the overlay upper directory.'), who: bi('containerd.', 'containerd.') } },
      { id: 'e-merged', from: 'overlay', to: 'merged', label: 'merged', card: { what: bi('Результат наложения — корень, который видит процесс.', 'The result of the stacking — the root the process sees.'), who: bi('Ядро.', 'The kernel.') } },
    ],
  },
  params: [
    { id: 'platform', label: bi('Платформа', 'Platform'), kind: 'choice', default: 'amd64', options: [{ id: 'amd64', label: bi('linux/amd64', 'linux/amd64') }, { id: 'arm64', label: bi('linux/arm64', 'linux/arm64') }], near: 'index', predict: { prompt: bi('Вы на arm64. Тот же тег — тот же манифест?', 'You are on arm64. Same tag — same manifest?'), options: [{ id: 'other', text: bi('Нет: индекс укажет на манифест arm64 с другими слоями', 'No: the index points to the arm64 manifest with other layers') }, { id: 'same', text: bi('Да: тег определяет всё', 'Yes: the tag decides everything') }], resolve: () => 'other' } },
    { id: 'haveBase', label: bi('Слой alpine уже скачан другим образом', 'The alpine layer is already here from another image'), kind: 'toggle', default: false, near: 'l1' },
    { id: 'run', label: bi('Запустить контейнер', 'Run a container'), kind: 'toggle', default: true, near: 'upper' },
    { id: 'action', label: bi('Что сделать в контейнере', 'What to do in the container'), kind: 'choice', default: 'edit', options: [{ id: 'none', label: bi('ничего', 'nothing') }, { id: 'edit', label: bi('дописать строку в /etc/nginx/nginx.conf', 'append a line to /etc/nginx/nginx.conf') }, { id: 'delete', label: bi('удалить /usr/share/nginx/html/index.html', 'delete /usr/share/nginx/html/index.html') }], near: 'merged', predict: { prompt: bi('Контейнер удаляет файл из образа. Станет ли образ меньше?', 'The container deletes a file of the image. Does the image get smaller?'), options: [{ id: 'no', text: bi('Нет: файл остаётся в нижнем слое, сверху ложится пометка об удалении', 'No: the file stays in the lower layer; a deletion mark lies on top') }, { id: 'yes', text: bi('Да: файл стёрт из слоя', 'Yes: the file is erased from the layer') }], resolve: () => 'no' } },
  ],
  breaks: [
    { id: 'tamper', label: bi('Подменить байт в слое по дороге', 'Change one byte of a layer on the way'), remove: ['e-pull'], boundary: 'storage', predict: { prompt: bi('Один байт слоя изменился по дороге. Что сделает docker pull?', 'One byte of a layer changed on the way. What does docker pull do?'), options: [{ id: 'fail', text: bi('Прервётся: sha256 байтов не совпал с digest', 'It stops: the sha256 of the bytes does not match the digest') }, { id: 'ok', text: bi('Ничего не заметит', 'It notices nothing') }], resolve: () => 'fail' } },
    { id: 'retag', label: bi('Перевесить тег на новую сборку', 'Move the tag to a new build'), remove: ['e-tag'], boundary: 'storage', predict: { prompt: bi('Автор перевесил тег 1.30-alpine на новую сборку. Что получит pull по старому digest?', 'The author moved the 1.30-alpine tag to a new build. What does a pull by the old digest get?'), options: [{ id: 'old', text: bi('Прежний образ: digest — отпечаток содержимого', 'The old image: a digest is a fingerprint of the content') }, { id: 'new', text: bi('Новую сборку, как и по тегу', 'The new build, as by tag') }], resolve: () => 'old' } },
  ],
  metrics: [
    { id: 'download', label: bi('скачать', 'to download'), unit: 'MB' },
    { id: 'layers', label: bi('слоёв в стопке', 'layers in the stack') },
    { id: 'upperBytes', label: bi('в записываемом слое', 'in the writable layer'), unit: 'B' },
  ],
  run(p, broken): Step[] {
    const d = D[p.platform as 'amd64' | 'arm64'] ?? D.amd64;
    const download = Math.round(((p.haveBase ? 0 : 3.6) + 4.1 + 0.001) * 10) / 10;
    const base = { download, layers: p.run ? 4 : 3, upperBytes: 0 };
    const steps: Step[] = [];
    if (broken.has('retag')) {
      steps.push({ id: 'retag', label: bi('тег', 'tag'), caption: bi('Тег перевешен: `nginx:1.30-alpine` теперь ведёт к новому индексу. Тот, кто тянет по тегу, получит новую сборку; тот, кто тянет по digest, — ровно прежнюю.', 'The tag was moved: `nginx:1.30-alpine` now leads to a new index. Whoever pulls by tag gets the new build; whoever pulls by digest gets exactly the old one.'), focus: ['tag', 'index'], states: { tag: 'warn' }, values: { index: 'sha256:77d0… (new)' }, metrics: base, broken: { at: 'e-tag', message: 'docker pull nginx:1.30-alpine            → Digest: sha256:77d0…\ndocker pull nginx@sha256:5c1e…          → Digest: sha256:5c1e…', caption: bi('по тегу — что повесили сейчас; по digest — то, что вы проверили.', 'by tag — whatever hangs there now; by digest — what you checked.') } });
      return steps;
    }
    steps.push({ id: 'tag', label: bi('тег', 'tag'), caption: bi('Клиент спрашивает реестр: что сейчас висит на `library/nginx:1.30-alpine`? Ответ — digest индекса в заголовке Docker-Content-Digest.', 'The client asks the registry: what hangs on `library/nginx:1.30-alpine` right now? The answer is the index digest in the Docker-Content-Digest header.'), focus: ['tag', 'e-tag', 'index'], tokens: [{ edge: 'e-tag' }], values: { index: 'sha256:5c1e…a07b' }, metrics: base });
    steps.push({ id: 'platform', label: bi('платформа', 'platform'), caption: fmt(bi('В индексе по манифесту на платформу. Клиент на {p} берёт строку linux/{p} и манифест {m}.', 'The index has a manifest per platform. A client on {p} takes the linux/{p} entry and the manifest {m}.'), { p: p.platform, m: d.manifest }), focus: ['index', 'e-plat', 'manifest'], tokens: [{ edge: 'e-plat' }], values: { manifest: d.manifest }, metrics: base });
    steps.push({ id: 'config', label: 'config', caption: fmt(bi('Манифест ссылается на config {c}: в нём что запускать и `rootfs.diff_ids`. ENV, CMD, EXPOSE живут здесь — у них нет слоя.', 'The manifest refers to the config {c}: what to run and `rootfs.diff_ids`. ENV, CMD, EXPOSE live here — they have no layer.'), { c: d.config }), focus: ['e-cfg', 'config'], tokens: [{ edge: 'e-cfg' }], values: { config: d.config }, metrics: base });
    if (broken.has('tamper')) {
      steps.push({ id: 'verify', label: 'sha256', caption: bi('Клиент скачал слой и посчитал sha256 полученных байтов: не совпало с digest из манифеста.', 'The client downloaded a layer and computed the sha256 of the bytes: it does not match the digest in the manifest.'), focus: ['registry', 'e-pull', 'l1'], states: { l1: 'err' }, metrics: base, broken: { at: 'e-pull', message: `failed to register layer: unexpected EOF\nfailed commit on ref "layer-${d.l1}": "layer-${d.l1}" failed size validation: digest mismatch`, caption: bi('адрес по содержимому сам проверяет целостность: подменённый слой не примут.', 'a content address checks integrity by itself: a tampered layer is refused.') } });
      return steps;
    }
    steps.push({
      id: 'layers',
      label: bi('слои', 'layers'),
      caption: p.haveBase
        ? fmt(bi('Слои по digest. Слой alpine {l} уже есть — `Already exists`, качаются только два: {mb} МБ.', 'Layers by digest. The alpine layer {l} is already here — `Already exists`, only two download: {mb} MB.'), { l: d.l1, mb: download })
        : fmt(bi('Слои по digest: три blob-а, {mb} МБ в сжатом виде. У каждого слоя два хеша: digest сжатого архива в манифесте и diff_id несжатого tar в config.', 'Layers by digest: three blobs, {mb} MB compressed. Each layer has two hashes: the digest of the compressed archive in the manifest and the diff_id of the uncompressed tar in the config.'), { mb: download }),
      focus: ['e-layers', 'registry', 'e-pull', 'l1', 'l2', 'l3'],
      tokens: [{ edge: 'e-pull' }, { edge: 'e-layers' }],
      states: { l1: p.haveBase ? 'ok' : 'on', l2: 'on', l3: 'on' },
      values: { l1: p.haveBase ? 'Already exists' : d.l1, l2: d.l2, l3: d.l3 },
      metrics: base,
    });
    steps.push({ id: 'stack', label: 'overlay', caption: bi('Слои ложатся в стопку: каждый следующий закрывает файлы предыдущего. Ядро показывает их одним деревом через OverlayFS — нижние только для чтения.', 'The layers stack up: each next one covers the files of the previous. The kernel shows them as one tree through OverlayFS — the lower ones are read-only.'), focus: ['e-lower', 'overlay', 'e-merged', 'merged'], tokens: [{ edge: 'e-lower' }, { edge: 'e-merged' }], states: { overlay: 'on', merged: 'on' }, metrics: base });
    if (p.run) {
      steps.push({ id: 'upper', label: 'upper', caption: bi('Запуск контейнера добавляет сверху пустой записываемый слой — свой у каждого контейнера. Образ при этом не меняется: из одного образа можно запустить сколько угодно контейнеров.', 'Running a container adds an empty writable layer on top — one per container. The image itself does not change: any number of containers can run from one image.'), focus: ['upper', 'e-upper'], tokens: [{ edge: 'e-upper' }], states: { upper: 'on' }, values: { upper: 'upperdir: empty' }, metrics: base });
      if (p.action === 'edit') steps.push({ id: 'copyup', label: 'copy-up', caption: bi('`echo … >> /etc/nginx/nginx.conf`: файл лежит в нижнем слое, писать туда нельзя. Ядро сначала копирует его целиком наверх (copy-up), потом меняет копию. `docker diff` покажет `C /etc/nginx/nginx.conf`.', '`echo … >> /etc/nginx/nginx.conf`: the file is in a lower layer, which cannot be written. The kernel first copies it whole to the top (copy-up) and then changes the copy. `docker diff` shows `C /etc/nginx/nginx.conf`.'), focus: ['l2', 'upper', 'merged'], tokens: [{ edge: 'e-upper', label: 'nginx.conf' }], values: { upper: 'C /etc/nginx/nginx.conf' }, metrics: { ...base, upperBytes: 662 } });
      if (p.action === 'delete') steps.push({ id: 'whiteout', label: 'whiteout', caption: bi('`rm /usr/share/nginx/html/index.html`: нижний слой не изменить, поэтому наверху появляется пометка об удалении (whiteout: в ядре — символьное устройство 0:0, в tar слоя — `.wh.index.html`). Файл скрыт, но всё ещё лежит в образе и занимает место.', '`rm /usr/share/nginx/html/index.html`: the lower layer cannot change, so a deletion mark appears on top (a whiteout: a 0:0 character device in the kernel, `.wh.index.html` in a layer tar). The file is hidden, yet it is still in the image and takes space.'), focus: ['upper', 'merged', 'l2'], states: { l2: 'warn' }, values: { upper: 'D /usr/share/nginx/html/index.html' }, metrics: base });
    }
    return steps;
  },
  explainDelta(_prev, next, change, a, b): Bi {
    const m = next[next.length - 1]?.metrics ?? {};
    if (change.kind === 'break') return change.on ? (change.id === 'tamper' ? bi('Изменился байт — изменился бы и sha256: проверка останавливает pull.', 'A changed byte means a changed sha256: the check stops the pull.') : bi('Тег перевешен; digest по-прежнему указывает на прежнее содержимое.', 'The tag moved; the digest still points to the old content.')) : bi('Поломка убрана.', 'The failure is removed.');
    switch (change.id) {
      case 'platform':
        return fmt(bi('{a} → {b}: тот же тег, но другой манифест и другие слои — индекс выбирает по платформе.', '{a} → {b}: the same tag but another manifest and other layers — the index picks by platform.'), { a: a.platform as string, b: b.platform as string });
      case 'haveBase':
        return fmt(bi('Скачать нужно {mb} МБ: слой с тем же digest не качается второй раз.', '{mb} MB to download: a layer with the same digest is not downloaded twice.'), { mb: m.download ?? 0 });
      case 'run':
        return b.run ? bi('Контейнер — это стопка образа плюс свой записываемый слой.', 'A container is the image stack plus its own writable layer.') : bi('Без контейнера образ — только стопка слоёв для чтения.', 'Without a container the image is only a stack of read-only layers.');
      case 'action':
        return b.action === 'edit' ? bi('Изменение файла из образа — copy-up в записываемый слой.', 'Changing a file of the image is a copy-up into the writable layer.') : b.action === 'delete' ? bi('Удаление файла из образа — whiteout сверху; нижний слой не уменьшается.', 'Deleting a file of the image is a whiteout on top; the lower layer does not shrink.') : bi('Записываемый слой пуст.', 'The writable layer is empty.');
    }
    return bi('Модель пересчитана.', 'The model is recomputed.');
  },
});
