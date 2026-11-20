// m10. Security basics: root in a container, capabilities, --privileged, read-only, userns, image hygiene (04 §4.3).

import { bi } from '../../../core/i18n';
import type { Facts, Lesson, QuizItem } from '../../../core/types';
import { dockerHost, RU, SRC, web } from '../shared';

type C = { name: string; state: string; config: { User: string }; hostConfig: { user: string; readonly: boolean; capDrop: string[]; capAdd: string[]; privileged: boolean; securityOpt: string[] } };
const cs = (f: Facts) => (f.containers as C[] | undefined) ?? [];
const nonRoot = (c: C) => {
  const u = (c.hostConfig.user || c.config.User || '').split(':')[0];
  return u !== '' && u !== '0' && u !== 'root';
};

export const securityQuiz: QuizItem[] = [
  {
    id: 'containers.q.root-is-root',
    kind: 'mcq',
    key: true,
    concepts: ['docker.security-profile'],
    prompt: bi('Если пространства имён пользователей нет, совпадает ли root в контейнере с root хоста?', 'Is root in a container without a user namespace the root of the host?'),
    options: [
      { id: 'same-uid', text: bi('Для ядра это тот же UID 0, но права у него урезаны, потому что у него меньше capabilities, его вызовы фильтрует seccomp и на него действует профиль AppArmor', 'To the kernel it is the same UID 0, only reduced: fewer capabilities, a seccomp filter, an AppArmor profile'), correct: true },
      { id: 'no', text: bi('Нет, это совершенно отдельный пользователь', 'No, it is an entirely separate user'), why: bi('Отдельным пользователем root становится только в пространстве имён пользователей, в режиме rootless или userns-remap. По умолчанию в Docker его нет.', 'It becomes separate only with a user namespace (rootless or userns-remap). Docker has none by default.') },
      { id: 'yes', text: bi('Да, и права у него те же самые', 'Yes, with the same rights'), why: bi('UID у него тот же, но набор capabilities урезан до 14, и на процесс действует фильтр системных вызовов.', 'The UID is the same, but the capability set is cut to 14 and a system-call filter applies.') },
    ],
    explain: bi('Поэтому файлы, которые root контейнера создал в bind mount, на хосте принадлежат root, а тот, кто выбрался из контейнера, где работал от root, оказывается root на хосте.', 'That is why files container root creates in a bind mount belong to root on the host, and an escape from a container with root inside is root on the host.'),
  },
  {
    id: 'containers.q.nginx-caps',
    kind: 'multi',
    concepts: ['docker.security-profile'],
    prompt: bi('nginx запускают с флагом `--cap-drop ALL`. Какие capabilities нужно вернуть, чтобы образ nginx запустился от root и слушал порт 80?', 'nginx runs with `--cap-drop ALL`. Which capabilities must be added back for the nginx image to start as root and listen on port 80?'),
    options: [
      { id: 'bind', text: 'NET_BIND_SERVICE', correct: true },
      { id: 'setuid', text: 'SETUID', correct: true },
      { id: 'setgid', text: 'SETGID', correct: true },
      { id: 'chown', text: 'CHOWN', correct: true },
      { id: 'admin', text: 'SYS_ADMIN', why: bi('SYS_ADMIN разрешает почти всё, что может root, от монтирования файловых систем до настройки ядра, а nginx эта привилегия не нужна.', 'SYS_ADMIN is almost full root (mount and much more). nginx does not need it.') },
      { id: 'netadmin', text: 'NET_ADMIN', why: bi('NET_ADMIN разрешает менять настройки сети, то есть интерфейсы, маршруты и правила фильтрации, а чтобы слушать порт, эта привилегия не нужна.', 'NET_ADMIN is changing the network: interfaces, routes, rules. Listening on a port does not need it.') },
    ],
    explain: bi('Чтобы слушать порт ниже 1024, нужна NET_BIND_SERVICE. Главный процесс nginx меняет владельца каталогов кэша (для этого нужна CHOWN) и переключается на пользователя nginx для рабочих процессов (для этого нужны SETUID и SETGID).', 'A port below 1024 needs NET_BIND_SERVICE; the nginx master changes the owner of its cache directories (CHOWN) and switches to the nginx user for workers (SETUID, SETGID).'),
  },
  {
    id: 'containers.q.privileged',
    kind: 'mcq',
    concepts: ['docker.security-profile'],
    prompt: bi('Почему флаг `--privileged` опасен, даже если процесс внутри работает не от root?', 'Why is `--privileged` dangerous even if the process inside is not root?'),
    options: [
      { id: 'all', text: bi('Контейнер получает все capabilities и все устройства хоста, а seccomp и AppArmor выключаются, поэтому любой, кто станет в нём root, сможет смонтировать диск хоста', 'The container gets all capabilities and the host’s devices, seccomp and AppArmor are off: anyone who becomes root in it can mount the host disk'), correct: true },
      { id: 'net', text: bi('Он только открывает контейнеру сеть хоста', 'It only opens the host network to the container'), why: bi('Сеть хоста открывает флаг `--network host`, а `--privileged` снимает почти все ограничения сразу.', 'The host network is `--network host`. `--privileged` lifts almost every restriction at once.') },
      { id: 'slow', text: bi('Он замедляет контейнер', 'It slows the container down'), why: bi('Скорость тут ни при чём, потому что флаг `--privileged` меняет изоляцию контейнера, а не скорость его работы.', 'Speed has nothing to do with it, because `--privileged` changes the container’s isolation, not how fast it runs.') },
    ],
  },
  {
    id: 'containers.q.secret-layer',
    kind: 'mcq',
    concepts: ['docker.image-security'],
    prompt: bi('В Dockerfile написано `COPY .env /app/.env`, а затем `RUN rm /app/.env`. Попал ли пароль из .env в образ?', 'A Dockerfile: `COPY .env /app/.env`, then `RUN rm /app/.env`. Did the password from .env leak?'),
    options: [
      { id: 'yes', text: bi('Да, потому что файл лежит в слое, созданном COPY, а следующий слой только прячет его пометкой об удалении. Любой, кто скачал образ, достанет файл из этого слоя', 'Yes, because the file sits in the COPY layer; the next layer only hides it with a mark. Anyone who pulled the image can get it from the layer'), correct: true },
      { id: 'no', text: bi('Нет, ведь файл удалён', 'No: the file was deleted'), why: bi('Слои можно только добавлять, поэтому удаление записывается пометкой (whiteout) сверху, а нижний слой не меняется.', 'Layers only add: a deletion is a whiteout on top; the lower layer does not change.') },
    ],
    explain: bi('Секреты не кладут в контекст сборки и вычёркивают через `.dockerignore`. При сборке их передают через `RUN --mount=type=secret`, а при запуске — переменными окружения или секретами системы оркестрации.', 'Secrets are kept out of the build context (`.dockerignore`), passed during the build through `RUN --mount=type=secret` and at run time through variables or orchestrator secrets.'),
  },
  {
    id: 'containers.q.rootless',
    kind: 'mcq',
    concepts: ['docker.userns'],
    prompt: bi('В режиме rootless файл, который root в контейнере создал в bind mount, на хосте принадлежит UID 100000. Почему?', 'Rootless Docker: a file root creates in a bind mount inside a container belongs to UID 100000 on the host. Why?'),
    options: [
      { id: 'map', text: bi('Пространство имён пользователей отображает UID 0 внутри на непривилегированный диапазон снаружи (uid_map `0 100000 65536`)', 'The user namespace maps UID 0 inside onto an unprivileged range outside (uid_map `0 100000 65536`)'), correct: true },
      { id: 'bug', text: bi('Bind mount работает с ошибкой', 'Bind mount has a bug'), why: bi('Так и задумано, потому что root внутри становится непривилегированным пользователем снаружи, и в этом состоит защита.', 'That is the design: root inside becomes nobody outside — that is the protection.') },
    ],
  },
];

export const securityLesson: Lesson = {
  id: 'containers.security',
  block: 'containers',
  title: bi('Основы безопасности контейнеров', 'Container security basics'),
  summary: bi('В этом уроке вы узнаете, чем root в контейнере отличается от root на хосте, и научитесь сужать права контейнера и образа.', 'In this lesson you will learn how root in a container differs from root on the host, and you will learn to narrow the rights of a container and an image.'),
  introduces: ['docker.security-profile', 'docker.userns', 'docker.image-security'],
  uses: ['docker.container', 'docker.image', 'docker.layer', 'docker.volume', 'docker.dockerfile'],
  tier: 'core',
  minutes: 35,
  sources: {
    en: [SRC.security, SRC.seccomp, SRC.rootless, SRC.capabilities, { title: 'Docker default seccomp profile (moby/profiles)', url: 'https://github.com/moby/profiles/blob/main/seccomp/default.json' }],
    ru: [SRC.k8sRuContainers, SRC.habrUnshare, RU.docker],
  },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Команда `docker exec web id` печатает `uid=0(root)`. Значит ли это, что процесс в контейнере может всё, что может root на хосте? Этот урок отвечает на вопрос: **чем root в контейнере отличается от root на хосте?**', '`docker exec web id` prints `uid=0(root)`. Does that mean the process in the container can do everything root on the host can? This lesson answers the question: **how does root in a container differ from root on the host?**'),
    },
    {
      id: 'profile',
      kind: 'text',
      step: 'explain',
      title: bi('Что ограничивает root в контейнере', 'What restricts root in a container'),
      body: bi(
        'Если пространства имён пользователей нет, root в контейнере для ядра остаётся тем же UID 0. Ограничивает его [[docker.security-profile|профиль безопасности контейнера]], и в нём три слоя защиты.\n\n- **Capabilities.** Права root в Linux разбиты на несколько десятков отдельных привилегий. Например, CHOWN разрешает менять владельца файла, NET_BIND_SERVICE разрешает слушать порт с номером ниже 1024, а SYS_ADMIN разрешает монтировать файловые системы и многое другое. По умолчанию Docker оставляет контейнеру 14 привилегий и отбирает опасные, в том числе SYS_ADMIN, NET_ADMIN (настройку сети хоста), SYS_MODULE (загрузку модулей ядра) и SYS_PTRACE (вмешательство в чужие процессы). Набор меняют флаги `--cap-drop` и `--cap-add`.\n- **seccomp.** Этот механизм фильтрует системные вызовы, и профиль Docker по умолчанию запрещает около полусотни редких и опасных вызовов. Фильтр согласован с capabilities, поэтому добавленная привилегия открывает и связанные с ней вызовы.\n- **AppArmor или SELinux**, в зависимости от дистрибутива хоста, добавляют ещё один слой правил поверх первых двух.\n\nФлаг `--privileged` выключает почти всё сразу: возвращает все capabilities, открывает устройства хоста, отключает seccomp и AppArmor. Такой контейнер почти ничем не отделён от хоста, потому что root в нём может смонтировать диск хоста. А флаг `--security-opt no-new-privileges` не даёт процессу получать новые права через программы с битом setuid.',
        'Without a user namespace, root in a container is the same UID 0 to the kernel. It is restricted by the [[docker.security-profile|container security profile]], three layers of protection:\n\n- **Capabilities.** Root’s rights in Linux are split into dozens of separate capabilities. For example, CHOWN allows changing a file’s owner, NET_BIND_SERVICE allows listening on a port below 1024, and SYS_ADMIN allows mounting file systems and much more. By default Docker leaves a container 14 capabilities and takes away the dangerous ones, among them SYS_ADMIN, NET_ADMIN (configuring the host network), SYS_MODULE (loading kernel modules) and SYS_PTRACE (interfering with other processes). `--cap-drop` and `--cap-add` change the set.\n- **seccomp.** A system-call filter: Docker’s default profile forbids about fifty rare and dangerous calls. It is aligned with capabilities: an added capability opens the related calls.\n- **AppArmor or SELinux** (depending on the host distribution) — one more layer of rules on top.\n\n`--privileged` switches almost everything off at once: all capabilities, the host’s devices, seccomp and AppArmor. It is almost an escape: root in such a container can mount the host disk. `--security-opt no-new-privileges` forbids a process to gain rights through setuid programs.',
      ),
    },
    {
      id: 'narrow',
      kind: 'text',
      step: 'explain',
      title: bi('Как сузить права контейнера', 'How to narrow it'),
      body: bi(
        'Самая действенная мера состоит в том, чтобы запускать процесс не от root, и для этого задают `USER app` в Dockerfile или `--user 1000` при запуске. Затем стоит убрать все привилегии и вернуть только нужные, например флагами `--cap-drop ALL --cap-add NET_BIND_SERVICE`. Корень контейнера можно сделать доступным только для чтения флагом `--read-only`, а каталоги, куда программа обязана писать, подключить как tmpfs (`--tmpfs /run`). И наконец, задать лимиты `--memory`, `--pids-limit` и `--cpus`, чтобы один контейнер не забрал себе все ресурсы машины.\n\nСледующим шагом служит [[docker.userns|пространство имён пользователей в Docker]]. В режиме rootless весь Docker работает от обычного пользователя, а root в контейнере отображается на непривилегированный UID снаружи, например 0 на 100000. Режим userns-remap делает то же самое для обычного демона. Платить за это приходится сложностями с правами в bind mount и некоторыми ограничениями, например с userns-remap нельзя пользоваться хранилищем образов containerd.\n\nПо той же причине стоит помнить, кому вы даёте доступ к самому Docker. Обычный демон работает от root, а сокет `/var/run/docker.sock` открыт группе docker. Поэтому пользователь из этой группы, даже без sudo, может запустить `docker run -v /:/host alpine:3.22` и править любой файл хоста, то есть членство в группе docker на этом сервере равно правам root. Так же опасно подключать сокет внутрь контейнера флагом `-v /var/run/docker.sock:/var/run/docker.sock`: процесс в таком контейнере управляет демоном хоста. Режим rootless убирает эту опасность, потому что демон и сокет принадлежат обычному пользователю.\n\nОстаётся сам образ. [[docker.image-security|Безопасность образа]] складывается из минимальной базы (чем меньше в образе программ, тем меньше в нём уязвимостей), отсутствия секретов в слоях (удалённый файл всё равно лежит в нижнем слое) и проверки образа на известные уязвимости сканерами вроде Trivy или Docker Scout в конвейере CI.',
        'The most effective step is not being root: `USER app` in the Dockerfile or `--user 1000` at run time. Next — drop everything and add back what is needed: `--cap-drop ALL --cap-add NET_BIND_SERVICE`. A read-only root: `--read-only`, with the directories the program must write to in tmpfs (`--tmpfs /run`). And limits: `--memory`, `--pids-limit`, `--cpus`, so that one container cannot eat the machine.\n\nThe next step is [[docker.userns|user namespaces in Docker]]. In rootless mode all of Docker runs as an ordinary user, and root in a container maps onto an unprivileged UID outside (for example 0 → 100000). userns-remap does the same for an ordinary daemon. The price is trouble with bind-mount permissions and limitations (the containerd image store, for instance, is unavailable with userns-remap).\n\nFor the same reason, remember whom you give access to Docker itself. An ordinary daemon runs as root, and the socket `/var/run/docker.sock` is open to the docker group. So a user of this group, even without sudo, can run `docker run -v /:/host alpine:3.22` and edit any host file: membership in the docker group equals root on that server. Mounting the socket into a container with `-v /var/run/docker.sock:/var/run/docker.sock` is just as dangerous: the process in that container controls the host’s daemon. Rootless mode removes this danger, because the daemon and the socket belong to an ordinary user.\n\nAnd the image itself: [[docker.image-security|image security]] is a minimal base (fewer programs, fewer vulnerabilities), no secrets in layers (a deleted file still lies in the lower layer) and scanning for known vulnerabilities (Trivy, Docker Scout) in CI.',
      ),
    },
    {
      id: 'caps-list',
      kind: 'callout',
      tone: 'note',
      levels: ['intermediate', 'experienced'],
      title: bi('Какие 14 привилегий Docker оставляет по умолчанию', 'Which 14 capabilities Docker keeps by default'),
      body: bi('Полный набор по умолчанию выглядит так: CHOWN, DAC_OVERRIDE, FSETID, FOWNER, MKNOD, NET_RAW, SETGID, SETUID, SETFCAP, SETPCAP, NET_BIND_SERVICE, SYS_CHROOT, KILL и AUDIT_WRITE.', 'The full default set is CHOWN, DAC_OVERRIDE, FSETID, FOWNER, MKNOD, NET_RAW, SETGID, SETUID, SETFCAP, SETPCAP, NET_BIND_SERVICE, SYS_CHROOT, KILL and AUDIT_WRITE.'),
    },
    {
      id: 'caps-nginx',
      kind: 'callout',
      tone: 'note',
      levels: ['beginner'],
      title: bi('Какие привилегии понадобятся nginx во втором задании', 'Which capabilities nginx needs in the second task'),
      body: bi('Во втором задании ниже вы отберёте у nginx все привилегии и вернёте только нужные. Нужных четыре: NET_BIND_SERVICE, чтобы слушать порт 80, SETUID и SETGID, чтобы рабочие процессы nginx перешли на пользователя nginx, и CHOWN, чтобы сменить владельца каталогов кэша. Если набор окажется неполным, контейнер завершится, а команда `docker logs web` покажет, чего nginx не хватило.', 'In the second task below you take every capability away from nginx and give back only the needed ones. Four are needed: NET_BIND_SERVICE to listen on port 80, SETUID and SETGID so that the nginx worker processes can switch to the nginx user, and CHOWN to change the owner of the cache directories. If the set is incomplete, the container exits, and `docker logs web` shows what nginx lacked.'),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: dockerHost({}, { pull: ['alpine:3.22', 'nginx:1.30-alpine'] }),
      intro: bi('На этой машине установлен Docker. Проверяйте себя командами `docker exec … id` и `curl`.', 'A machine with Docker. Check yourself with `docker exec … id` and `curl`.'),
      tasks: [
        {
          id: 'nonroot',
          prompt: bi('Запустите контейнер `app` из образа alpine с командой `sleep 3600` не от root и убедитесь, что `docker exec app id -u` выводит не 0.', 'Run an `app` container from alpine (`sleep 3600`) not as root and check: `docker exec app id -u` is not 0.'),
          check: { when: (f) => cs(f).some((c) => c.name === 'app' && c.state === 'running' && nonRoot(c)) },
          chips: 'docker run -d --name app --user 1000:1000 alpine:3.22 sleep 3600; docker exec app id -u',
          concepts: ['docker.security-profile'],
          docRef: { page: 'help/docker-run', anchor: 'OPTIONS', line: '--user' },
          hints: { H1: bi('Пользователя задаёт флаг при запуске или инструкция USER в Dockerfile.', 'A run flag sets the user (or USER in the Dockerfile).') },
        },
        {
          id: 'minimal',
          prompt: bi('Запустите nginx с именем `web` на порту 8080 с минимальными правами: корень только для чтения (с tmpfs для `/var/cache/nginx` и `/run`), `--cap-drop ALL` и возврат только нужных capabilities, а также `no-new-privileges`. Команда `curl localhost:8080` должна получать ответ.', 'Run an nginx `web` on port 8080 with minimal rights: a read-only root (with tmpfs for `/var/cache/nginx` and `/run`), `--cap-drop ALL` and only the needed capabilities back, `no-new-privileges`. `curl localhost:8080` must answer.'),
          check: {
            when: (f) => cs(f).some((c) => c.name === 'web' && c.state === 'running' && c.hostConfig.readonly && c.hostConfig.capDrop.includes('ALL') && !c.hostConfig.privileged && c.hostConfig.securityOpt.some((o) => o.startsWith('no-new-privileges'))) && (f.http as Record<string, { status: number }>)['localhost:8080']?.status === 200,
            fail: [{ if: (f) => cs(f).some((c) => c.name === 'web' && c.state === 'exited'), say: bi('Контейнер завершился с ошибкой, а причину покажет `docker logs web`, где nginx сам назовёт, чего ему не хватило, каталога для записи или привилегии.', 'The container fell over — its reason is in `docker logs web`: nginx names what it lacked (a writable directory or a capability).'), concept: 'docker.security-profile' }],
          },
          chips: 'docker run -d --name web -p 8080:80 --read-only --tmpfs /var/cache/nginx --tmpfs /run --cap-drop ALL --cap-add CHOWN --cap-add SETUID --cap-add SETGID --cap-add NET_BIND_SERVICE --security-opt no-new-privileges nginx:1.30-alpine',
          concepts: ['docker.security-profile'],
          docRef: web('engine/security', 'capabilities'),
          hints: { H1: bi('После каждой попытки читайте `docker logs web`, потому что nginx сам скажет, чего ему не хватает.', 'Run it and read `docker logs web` after each attempt: nginx says what is wrong itself.'), H2: bi('Для порта 80 нужна привилегия NET_BIND_SERVICE, для перехода на пользователя nginx нужны SETUID и SETGID, а для каталогов кэша нужна CHOWN.', 'Port 80 — NET_BIND_SERVICE; switching to the nginx user — SETUID and SETGID; cache directories — CHOWN.') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      levels: ['intermediate', 'experienced'],
      mode: 'find',
      prompt: bi('nginx должен слушать порт 80, работая не от root и без привилегии NET_BIND_SERVICE. Урок об этом не рассказывал, поэтому найдите сами параметр ядра, который определяет, какие порты считаются привилегированными, и флаг Docker, которым его задают для контейнера.', 'nginx must listen on port 80 running as non-root — and without the NET_BIND_SERVICE capability. This was not in the lesson: look for the kernel parameter behind “privileged” ports and the Docker flag that sets it for a container.'),
      ref: { page: 'help/docker-run' },
      terminal: {
        setup: dockerHost({}, { pull: ['nginx:1.30-alpine'] }),
        task: {
          id: 'unprivileged-port',
          prompt: bi('Должен работать контейнер `web` от непривилегированного пользователя, без NET_BIND_SERVICE, и слушать порт 80.', 'A `web` container as an unprivileged user, without NET_BIND_SERVICE, listening on port 80.'),
          check: { when: "containers[name=web].state=running && containers[name=web].hostConfig.capAdd#=0 && containers[name=web].config.User!='' && containers[name=web].config.User!='0'" },
          docStep: 4,
          beyond: true,
          solutionTokens: ['--sysctl', 'net.ipv4.ip_unprivileged_port_start', 'ip_unprivileged_port_start=0'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: securityQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог урока', 'Summary'),
      body: bi('Root в контейнере остаётся тем же UID 0, но его права урезаны набором capabilities, фильтром seccomp и AppArmor, а `--privileged` снимает почти все эти ограничения. Сузить права помогают работа не от root, `--cap-drop ALL` с точечными `--cap-add`, `--read-only` вместе с tmpfs, `no-new-privileges` и лимиты. Пространство имён пользователей делает root внутри непривилегированным пользователем снаружи. Секреты в слои образа не кладут, потому что удалённый файл всё равно остаётся в нижнем слое.', 'Root in a container is the same UID 0, reduced by capabilities, seccomp and AppArmor; `--privileged` lifts almost all of it. Narrowing: not root, `--cap-drop ALL` and targeted `--cap-add`, `--read-only` with tmpfs, `no-new-privileges`, limits. A user namespace makes root inside nobody outside. Secrets have no place in image layers.'),
    },
  ],
};
