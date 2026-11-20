// m08 (first half). Storage and networks of a container: volumes, bind mounts, tmpfs; bridge, user networks, DNS (04 §12.1).

import { bi } from '../../../core/i18n';
import type { Facts, Lesson, QuizItem } from '../../../core/types';
import { dockerHost, SRC, web } from '../shared';

type C = { name: string; state: string; networkNames: string[]; mounts: { type: string; source: string; target: string }[] };
const cs = (f: Facts) => (f.containers as C[] | undefined) ?? [];
const userNet = (n: string) => !['bridge', 'host', 'none'].includes(n);

export const storageQuiz: QuizItem[] = [
  {
    id: 'containers.q.volume-vs-bind',
    kind: 'multi',
    key: true,
    concepts: ['docker.volume'],
    prompt: bi('Чем именованный том отличается от bind mount? Отметьте два верных утверждения.', 'How does a named volume differ from a bind mount? Mark the two true statements.'),
    options: [
      { id: 'managed', text: bi('Томом управляет Docker (его видно в `docker volume ls`), а bind mount подключает любой каталог хоста, указанный по пути', 'Docker manages a volume (`docker volume ls`); a bind mount is any host directory by path'), correct: true },
      { id: 'populate', text: bi('Новый пустой том при первом подключении заполняется файлами образа из точки монтирования, а bind mount эти файлы закрывает', 'A new empty volume is filled with the image’s files at the mount point on first use, while a bind mount hides them'), correct: true },
      { id: 'faster', text: bi('Том всегда работает быстрее bind mount', 'A volume is always faster than a bind mount'), why: bi('И том, и bind mount остаются обычными каталогами на диске хоста, поэтому скорость у них одинаковая.', 'Both are ordinary directories on the host disk; the speed is the same.') },
      { id: 'lost', text: bi('Данные bind mount пропадают при `docker rm`', 'Bind-mount data vanishes on `docker rm`'), why: bi('Данные не пропадают, потому что bind mount подключает каталог хоста, а контейнер его только показывает.', 'The data does not vanish, because a bind mount attaches a host directory and the container only shows it.') },
      { id: 'image', text: bi('Том хранится внутри образа', 'A volume is stored inside the image'), why: bi('Том существует отдельно и от образа, и от контейнера, ради этого его и придумали.', 'A volume lives apart from both the image and the container — that is its point.') },
    ],
  },
  {
    id: 'containers.q.after-rm',
    kind: 'mcq',
    concepts: ['docker.volume', 'docker.layer'],
    prompt: bi('Контейнер записал файл `/tmp/report.txt`, а томов к нему не подключено. Что останется от файла после `docker rm`?', 'A container wrote a file to `/tmp/report.txt`, no volumes attached. What remains of the file after `docker rm`?'),
    options: [
      { id: 'nothing', text: bi('Ничего не останется, потому что файл лежал в записываемом слое, а слой удалён вместе с контейнером', 'Nothing, because the file was in the writable layer, which went with the container'), correct: true },
      { id: 'image', text: bi('Файл окажется в образе', 'It ends up in the image'), why: bi('Образ доступен только для чтения, и контейнер его не меняет.', 'The image is read-only; a container does not change it.') },
      { id: 'host', text: bi('Файл останется в каталоге /tmp хоста', 'It stays in the host’s /tmp'), why: bi('У контейнера свой корень, поэтому его каталог /tmp не совпадает с /tmp хоста.', 'The container has its own root: its /tmp is not the host’s /tmp.') },
    ],
  },
  {
    id: 'containers.q.dns-default',
    kind: 'mcq',
    key: true,
    concepts: ['docker.network'],
    prompt: bi('Два контейнера работают в сети по умолчанию `bridge`. Почему `ping db` из одного контейнера не находит другой?', 'Two containers on the default `bridge` network. Why can’t `ping db` from one find the other?'),
    options: [
      { id: 'dns', text: bi('В сети по умолчанию нет встроенного DNS по именам контейнеров, он есть только в пользовательских сетях', 'The default network has no embedded DNS for container names; only user-defined networks have it'), correct: true },
      { id: 'icmp', text: bi('Docker запрещает ping между контейнерами', 'Docker forbids ping between containers'), why: bi('По IP-адресу ping пройдёт, а не работает только поиск по имени.', 'By IP address the ping works. It is the name lookup that fails.') },
      { id: 'iso', text: bi('Контейнеры одной сети изолированы друг от друга', 'Containers on one network are isolated from each other'), why: bi('Оба контейнера подключены к одному мосту docker0 и видят друг друга по адресам.', 'They share the docker0 bridge and see each other by address.') },
    ],
    explain: bi('В пользовательской сети, созданной командой `docker network create app`, контейнер спрашивает имена у адреса 127.0.0.11, потому что там работает встроенный DNS Docker.', 'On a user-defined network (`docker network create app`) a container asks 127.0.0.11 for names — Docker’s embedded DNS.'),
  },
  {
    id: 'containers.q.net-modes',
    kind: 'match',
    concepts: ['docker.network'],
    prompt: bi('Сопоставьте режим сети с тем, что видит процесс.', 'Match the network mode and what the process sees.'),
    pairs: [
      { id: 'bridge', left: '--network bridge', right: bi('процесс получает своё пространство имён, адрес вида 172.17.0.x и выход наружу через NAT', 'the process gets its own namespace, an address like 172.17.0.x and a way out through NAT') },
      { id: 'user', left: '--network app', right: bi('процесс получает своё пространство имён и DNS по именам контейнеров этой сети', 'the process gets its own namespace and DNS for the container names of this network') },
      { id: 'host', left: '--network host', right: bi('процесс работает в сети хоста, и его порты становятся портами хоста', 'the process works in the host’s network, and its ports become the host’s ports') },
      { id: 'none', left: '--network none', right: bi('процессу доступен только интерфейс lo', 'only the lo interface is available to the process') },
    ],
  },
];

export const storageNetLesson: Lesson = {
  id: 'containers.storage-net',
  block: 'containers',
  title: bi('Данные и сети контейнеров', 'Container data and networks'),
  summary: bi('В этом уроке вы узнаете, где хранить данные, которые должны пережить контейнер, и как контейнеры находят друг друга по сети.', 'In this lesson you will learn where to keep data that must outlive a container and how containers find each other on the network.'),
  introduces: ['docker.volume', 'docker.network'],
  uses: ['docker.container', 'docker.layer', 'docker.lifecycle', 'docker.publish'],
  tier: 'core',
  minutes: 35,
  sources: {
    en: [SRC.volumes, SRC.bind, SRC.bridge, { title: 'Networking overview — Docker Docs', url: 'https://docs.docker.com/engine/network/' }],
    ru: [SRC.k8sRuContainers, SRC.habrOverlay],
  },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Вы пересоздали контейнер с базой данных, и все таблицы исчезли. А соседний контейнер с API никак не может найти базу по имени `db`, хотя оба запущены. Так звучат две самые частые жалобы новичка в Docker, и первая из них касается данных, а вторая сети.', 'You re-created the database container — and every table vanished. And the API container next to it cannot find the database by the name `db`, although both are running. The two most frequent complaints of a Docker newcomer are about data and about the network.'),
    },
    {
      id: 'storage',
      kind: 'text',
      step: 'explain',
      title: bi('Где хранятся данные контейнера', 'Where data lives'),
      body: bi(
        'Всё, что контейнер записывает в свой корень, попадает в записываемый слой. Этот слой существует ровно столько, сколько существует контейнер, поэтому после `docker rm` его нет, и новый `docker run` начнёт с чистого образа. Для данных, которые должны пережить контейнер, есть три вида [[docker.volume|томов]]:\n\n- **Именованный том** (`-v pgdata:/var/lib/postgresql/data`) хранится в каталоге, которым управляет Docker, а список томов показывает `docker volume ls`. Том существует отдельно от контейнеров, а новый пустой том при первом подключении получает файлы образа из точки монтирования.\n- **Bind mount** (`-v /home/learner/site:/usr/share/nginx/html`) подключает каталог хоста как есть. Правки сразу видны с обеих сторон, и это удобно при разработке. Файлы образа, лежавшие по этому пути, bind mount закрывает.\n- **tmpfs** (`--tmpfs /run`) хранит файлы в памяти. Такой том работает быстро, и на диск ничего не попадает, но файлы пропадают при остановке контейнера.\n\nЗдесь есть важная подробность. Образ postgres объявляет `VOLUME /var/lib/postgresql/data`, поэтому, если ничего не подключить, Docker создаст безымянный том, и данные окажутся в нём, а не в слое. Но новый контейнер получит уже другой безымянный том, так что для вас это выглядит так же, как потеря данных.',
        'Everything a container writes into its root goes to the writable layer. That layer lives exactly as long as the container: `docker rm` and it is gone; a new `docker run` starts from the clean image. For data that must outlive the container there are three kinds of [[docker.volume|volumes]]:\n\n- **A named volume** (`-v pgdata:/var/lib/postgresql/data`) — a directory Docker manages (`docker volume ls`). It lives apart from containers; a new empty volume gets the image’s files at the mount point on first use.\n- **A bind mount** (`-v /home/learner/site:/usr/share/nginx/html`) — a host directory as it is. Edits show on both sides at once — handy in development. It hides the image’s files at that path.\n- **tmpfs** (`--tmpfs /run`) — in memory. Fast, never on disk, and gone on stop.\n\nAn important detail: the postgres image declares `VOLUME /var/lib/postgresql/data`. If you attach nothing, Docker creates an anonymous volume — the data lands there, not in the layer, but a new container gets a new anonymous volume, which looks to you exactly like a loss.',
      ),
    },
    {
      id: 'networks',
      kind: 'text',
      step: 'explain',
      title: bi('Как контейнеры находят друг друга', 'How containers find each other'),
      body: bi(
        'По умолчанию контейнер попадает в сеть `bridge`, где у него есть своё пространство имён net, пара veth к мосту `docker0` на хосте, адрес из 172.17.0.0/16 и выход наружу через NAT. Всё это вы собирали руками в блоке сетей. Контейнеры одной сети видят друг друга по адресам, но адреса выдаются заново при каждом запуске, а **встроенного DNS по именам в сети по умолчанию нет**.\n\nПоэтому для приложения из нескольких контейнеров создают свою [[docker.network|сеть Docker]] командой `docker network create app` и запускают контейнеры с флагом `--network app` или подключают уже работающие командой `docker network connect app db`. В пользовательской сети Docker запускает внутри каждого контейнера DNS-сервер на адресе 127.0.0.11, и имя `db` превращается в текущий адрес контейнера db.\n\nЕсть ещё два режима. С флагом `--network host` своего пространства имён у контейнера нет, поэтому процесс работает в сети хоста и слушает его порты напрямую. С флагом `--network none` у контейнера есть только интерфейс lo.',
        'By default a container joins the `bridge` network: its own net namespace, a veth pair into the `docker0` bridge on the host, an address from 172.17.0.0/16 and NAT outwards — all things you built by hand in the networks block. Containers on one network see each other by address. But addresses are handed out anew on every start, and **the default network has no embedded DNS for names**.\n\nSo for an application made of several containers you create a [[docker.network|Docker network]] of your own: `docker network create app`, and start the containers with `--network app` (or connect them: `docker network connect app db`). On a user-defined network Docker runs a DNS server at 127.0.0.11 inside every container: the name `db` turns into the current address of the db container.\n\nThere are two more modes: `--network host` — no namespace of its own, the process works in the host’s network and listens on its ports directly; `--network none` — only the lo interface.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: dockerHost({ files: [{ path: '~/site/index.html', content: '<h1>v1</h1>\n' }] }, { pull: ['alpine:3.22', 'nginx:1.30-alpine', 'postgres:17-alpine'], run: ['docker run -d --name api alpine:3.22 sleep 3600', 'docker run -d --name db -e POSTGRES_PASSWORD=pw postgres:17-alpine'] }),
      intro: bi('На машине уже работают контейнеры `api` (alpine) и `db` (postgres) в сети по умолчанию.', '`api` (alpine) and `db` (postgres) are already running on the default network.'),
      tasks: [
        {
          id: 'dns',
          prompt: bi('Команда `docker exec api nslookup db` не находит базу. Сделайте так, чтобы `api` находил `db` по имени, не удаляя контейнеры.', '`docker exec api nslookup db` cannot find the database. Make `api` find `db` by name, without removing the containers.'),
          check: {
            when: (f) => {
              const a = cs(f).find((c) => c.name === 'api');
              const d = cs(f).find((c) => c.name === 'db');
              return !!a && !!d && a.networkNames.some((n) => userNet(n) && d.networkNames.includes(n));
            },
          },
          chips: 'docker network create app && docker network connect app db && docker network connect app api',
          concepts: ['docker.network'],
          docRef: web('engine/network/drivers/bridge', 'differences', 'automatic DNS resolution'),
          hints: { H1: bi('DNS по именам контейнеров есть только в пользовательских сетях.', 'Name DNS exists only on user-defined networks.'), H2: bi('Создайте сеть и подключите к ней оба контейнера командой `docker network connect`.', 'Create a network and connect both containers to it: `docker network connect`.') },
        },
        {
          id: 'volume',
          prompt: bi('Пересоздайте контейнер `db` так, чтобы данные базы лежали в именованном томе `pgdata` и пережили `docker rm -f db` и новый `docker run`.', 'Re-create `db` so that its data lives in a named volume `pgdata` and survives `docker rm -f db` and a new `docker run`.'),
          check: {
            when: (f) => cs(f).some((c) => c.name === 'db' && c.state === 'running' && c.mounts.some((m) => m.type === 'volume' && m.source === 'pgdata' && m.target === '/var/lib/postgresql/data')),
            fail: [{ if: (f) => cs(f).some((c) => c.name === 'db' && c.mounts.some((m) => m.type === 'volume' && m.target !== '/var/lib/postgresql/data' && m.source === 'pgdata')), say: bi('Том подключён не туда, потому что postgres хранит данные в каталоге `/var/lib/postgresql/data`.', 'The volume is mounted in the wrong place: postgres keeps its data in `/var/lib/postgresql/data`.') }],
          },
          chips: 'docker rm -f db && docker run -d --name db -e POSTGRES_PASSWORD=pw -v pgdata:/var/lib/postgresql/data postgres:17-alpine',
          concepts: ['docker.volume'],
          docRef: web('engine/storage/volumes'),
          hints: { H1: bi('Именованный том подключает флаг `-v ИМЯ:ПУТЬ`.', 'The `-v NAME:PATH` flag attaches a named volume.') },
        },
        {
          id: 'bind',
          prompt: bi('Запустите nginx с именем `dev` на порту 8080 так, чтобы он показывал страницы прямо из `~/site`. Замените содержимое `~/site/index.html` на «v2» и убедитесь с помощью curl, что изменение видно без пересборки.', 'Run an nginx `dev` on port 8080 that serves pages straight from `~/site`. Change `~/site/index.html` to “v2” — and see in curl that the change shows without a rebuild.'),
          check: { when: "containers[name=dev].mounts[type=bind].target='/usr/share/nginx/html' && http['localhost:8080'].body~'v2'" },
          chips: "docker run -d --name dev -p 8080:80 -v ~/site:/usr/share/nginx/html nginx:1.30-alpine; echo '<h1>v2</h1>' > ~/site/index.html; curl localhost:8080",
          concepts: ['docker.volume'],
          docRef: web('engine/storage/bind-mounts'),
          hints: { H1: bi('Bind mount подключают флагом `-v АБСОЛЮТНЫЙ_ПУТЬ_НА_ХОСТЕ:ПУТЬ_В_КОНТЕЙНЕРЕ`.', 'A bind mount is `-v ABSOLUTE_HOST_PATH:CONTAINER_PATH`.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: storageQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог урока', 'Summary'),
      body: bi('Записываемый слой удаляется вместе с контейнером, а данные переживают его, если лежат в томе или в bind mount, а в tmpfs не сохраняется ничего. Сеть по умолчанию даёт контейнерам адреса, но не имена, а пользовательская сеть добавляет DNS на адресе 127.0.0.11.', 'The writable layer dies with the container; a volume or a bind mount outlives it, tmpfs does not. The default network gives addresses without names; a user-defined network adds DNS at 127.0.0.11.'),
    },
  ],
};
