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
    prompt: bi('Root в контейнере без user namespace — это root хоста?', 'Is root in a container without a user namespace the root of the host?'),
    options: [
      { id: 'same-uid', text: bi('Для ядра это тот же UID 0, но урезанный: меньше capabilities, фильтр seccomp, профиль AppArmor', 'To the kernel it is the same UID 0, only reduced: fewer capabilities, a seccomp filter, an AppArmor profile'), correct: true },
      { id: 'no', text: bi('Нет, это совершенно отдельный пользователь', 'No, it is an entirely separate user'), why: bi('Отдельным он становится только с user namespace (rootless или userns-remap). По умолчанию у Docker его нет.', 'It becomes separate only with a user namespace (rootless or userns-remap). Docker has none by default.') },
      { id: 'yes', text: bi('Да, с теми же правами', 'Yes, with the same rights'), why: bi('UID тот же, но набор capabilities урезан до 14 и действует фильтр системных вызовов.', 'The UID is the same, but the capability set is cut to 14 and a system-call filter applies.') },
    ],
    explain: bi('Поэтому файлы, которые root контейнера создал в bind mount, на хосте принадлежат root, а побег из контейнера с root внутри — это root на хосте.', 'That is why files container root creates in a bind mount belong to root on the host, and an escape from a container with root inside is root on the host.'),
  },
  {
    id: 'containers.q.nginx-caps',
    kind: 'multi',
    concepts: ['docker.security-profile'],
    prompt: bi('nginx запускают с `--cap-drop ALL`. Какие capabilities вернуть, чтобы образ nginx стартовал от root и слушал порт 80?', 'nginx runs with `--cap-drop ALL`. Which capabilities must be added back for the nginx image to start as root and listen on port 80?'),
    options: [
      { id: 'bind', text: 'NET_BIND_SERVICE', correct: true },
      { id: 'setuid', text: 'SETUID', correct: true },
      { id: 'setgid', text: 'SETGID', correct: true },
      { id: 'chown', text: 'CHOWN', correct: true },
      { id: 'admin', text: 'SYS_ADMIN', why: bi('SYS_ADMIN — почти полный root (mount и многое другое). nginx он не нужен.', 'SYS_ADMIN is almost full root (mount and much more). nginx does not need it.') },
      { id: 'netadmin', text: 'NET_ADMIN', why: bi('NET_ADMIN — менять сеть: интерфейсы, маршруты, правила. Чтобы слушать порт, он не нужен.', 'NET_ADMIN is changing the network: interfaces, routes, rules. Listening on a port does not need it.') },
    ],
    explain: bi('Порт ниже 1024 требует NET_BIND_SERVICE; мастер-процесс nginx меняет владельца каталогов кэша (CHOWN) и переходит в пользователя nginx для рабочих процессов (SETUID, SETGID).', 'A port below 1024 needs NET_BIND_SERVICE; the nginx master changes the owner of its cache directories (CHOWN) and switches to the nginx user for workers (SETUID, SETGID).'),
  },
  {
    id: 'containers.q.privileged',
    kind: 'mcq',
    concepts: ['docker.security-profile'],
    prompt: bi('Почему `--privileged` опасен, даже если процесс внутри не root?', 'Why is `--privileged` dangerous even if the process inside is not root?'),
    options: [
      { id: 'all', text: bi('Контейнер получает все capabilities и устройства хоста, seccomp и AppArmor выключены: любой, кто станет в нём root, смонтирует диск хоста', 'The container gets all capabilities and the host’s devices, seccomp and AppArmor are off: anyone who becomes root in it can mount the host disk'), correct: true },
      { id: 'net', text: bi('Он только открывает контейнеру сеть хоста', 'It only opens the host network to the container'), why: bi('Сеть хоста — это `--network host`. `--privileged` снимает почти все ограничения сразу.', 'The host network is `--network host`. `--privileged` lifts almost every restriction at once.') },
      { id: 'slow', text: bi('Он замедляет контейнер', 'It slows the container down'), why: bi('Скорость тут ни при чём — это вопрос изоляции.', 'Speed has nothing to do with it — it is a matter of isolation.') },
    ],
  },
  {
    id: 'containers.q.secret-layer',
    kind: 'mcq',
    concepts: ['docker.image-security'],
    prompt: bi('Dockerfile: `COPY .env /app/.env`, затем `RUN rm /app/.env`. Утёк ли пароль из .env?', 'A Dockerfile: `COPY .env /app/.env`, then `RUN rm /app/.env`. Did the password from .env leak?'),
    options: [
      { id: 'yes', text: bi('Да: файл лежит в слое COPY; следующий слой лишь прячет его пометкой. Любой, кто скачал образ, достанет его из слоя', 'Yes: the file sits in the COPY layer; the next layer only hides it with a mark. Anyone who pulled the image can get it from the layer'), correct: true },
      { id: 'no', text: bi('Нет: файл удалён', 'No: the file was deleted'), why: bi('Слои только добавляются: удаление — whiteout сверху, нижний слой не меняется.', 'Layers only add: a deletion is a whiteout on top; the lower layer does not change.') },
    ],
    explain: bi('Секреты не кладут в контекст сборки (`.dockerignore`), передают при сборке через `RUN --mount=type=secret`, а при запуске — переменными или секретами оркестратора.', 'Secrets are kept out of the build context (`.dockerignore`), passed during the build through `RUN --mount=type=secret` and at run time through variables or orchestrator secrets.'),
  },
  {
    id: 'containers.q.rootless',
    kind: 'mcq',
    concepts: ['docker.userns'],
    prompt: bi('Rootless Docker: файл, созданный root в контейнере в bind mount, на хосте принадлежит UID 100000. Почему?', 'Rootless Docker: a file root creates in a bind mount inside a container belongs to UID 100000 on the host. Why?'),
    options: [
      { id: 'map', text: bi('User namespace отображает UID 0 внутри на непривилегированный диапазон снаружи (uid_map `0 100000 65536`)', 'The user namespace maps UID 0 inside onto an unprivileged range outside (uid_map `0 100000 65536`)'), correct: true },
      { id: 'bug', text: bi('Это ошибка bind mount', 'It is a bind-mount bug'), why: bi('Так и задумано: root внутри становится никем снаружи — в этом защита.', 'That is the design: root inside becomes nobody outside — that is the protection.') },
    ],
  },
];

export const securityLesson: Lesson = {
  id: 'containers.security',
  block: 'containers',
  title: bi('Безопасность контейнеров: основы', 'Container security basics'),
  summary: bi('Чем root в контейнере отличается от root на хосте и как сузить права контейнера и образа.', 'How root in a container differs from root on the host and how to narrow the rights of a container and an image.'),
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
      body: bi('`docker exec web id` печатает `uid=0(root)`. Значит ли это, что процесс в контейнере может всё, что может root на хосте? Ведущий вопрос главы: **чем root в контейнере отличается от root на хосте?**', '`docker exec web id` prints `uid=0(root)`. Does that mean the process in the container can do everything root on the host can? The leading question of the chapter: **how does root in a container differ from root on the host?**'),
    },
    {
      id: 'profile',
      kind: 'text',
      step: 'explain',
      title: bi('Что ограничивает root в контейнере', 'What restricts root in a container'),
      body: bi(
        'Без user namespace root в контейнере — для ядра тот же UID 0. Ограничивает его [[docker.security-profile|профиль безопасности контейнера]], три слоя защиты:\n\n- **Capabilities.** Права root в Linux разбиты на десятки отдельных. Docker оставляет по умолчанию 14: CHOWN, DAC_OVERRIDE, FSETID, FOWNER, MKNOD, NET_RAW, SETGID, SETUID, SETFCAP, SETPCAP, NET_BIND_SERVICE, SYS_CHROOT, KILL, AUDIT_WRITE. Нет SYS_ADMIN (монтирование и многое другое), NET_ADMIN, SYS_MODULE, SYS_PTRACE. Набор меняют `--cap-drop` и `--cap-add`.\n- **seccomp.** Фильтр системных вызовов: профиль Docker по умолчанию запрещает около полусотни редких и опасных вызовов. Он согласован с capabilities: добавленная capability открывает связанные вызовы.\n- **AppArmor или SELinux** (зависит от дистрибутива хоста) — ещё один слой правил поверх.\n\n`--privileged` выключает почти всё сразу: все capabilities, устройства хоста, seccomp и AppArmor. Это почти побег: root в таком контейнере смонтирует диск хоста. `--security-opt no-new-privileges` запрещает процессу набирать права через setuid-программы.',
        'Without a user namespace, root in a container is the same UID 0 to the kernel. It is restricted by the [[docker.security-profile|container security profile]], three layers of protection:\n\n- **Capabilities.** Root’s rights in Linux are split into dozens of separate ones. Docker keeps 14 by default: CHOWN, DAC_OVERRIDE, FSETID, FOWNER, MKNOD, NET_RAW, SETGID, SETUID, SETFCAP, SETPCAP, NET_BIND_SERVICE, SYS_CHROOT, KILL, AUDIT_WRITE. No SYS_ADMIN (mounting and much more), NET_ADMIN, SYS_MODULE, SYS_PTRACE. `--cap-drop` and `--cap-add` change the set.\n- **seccomp.** A system-call filter: Docker’s default profile forbids about fifty rare and dangerous calls. It is aligned with capabilities: an added capability opens the related calls.\n- **AppArmor or SELinux** (depending on the host distribution) — one more layer of rules on top.\n\n`--privileged` switches almost everything off at once: all capabilities, the host’s devices, seccomp and AppArmor. It is almost an escape: root in such a container can mount the host disk. `--security-opt no-new-privileges` forbids a process to gain rights through setuid programs.',
      ),
    },
    {
      id: 'narrow',
      kind: 'text',
      step: 'explain',
      title: bi('Как сузить', 'How to narrow it'),
      body: bi(
        'Самое действенное — не быть root: `USER app` в Dockerfile или `--user 1000` при запуске. Дальше — убрать всё и вернуть нужное: `--cap-drop ALL --cap-add NET_BIND_SERVICE`. Корень только для чтения: `--read-only`, а каталоги, куда программа обязана писать, — в tmpfs (`--tmpfs /run`). И лимиты: `--memory`, `--pids-limit`, `--cpus`, чтобы один контейнер не съел машину.\n\nСледующий шаг — [[docker.userns|user namespace в Docker]]. В режиме rootless весь Docker работает от обычного пользователя, а root в контейнере отображается на непривилегированный UID снаружи (например, 0 → 100000). Режим userns-remap делает то же для обычного демона. Цена — сложности с правами на bind mount и ограничения (например, хранилище образов containerd с userns-remap недоступно).\n\nИ сам образ: [[docker.image-security|безопасность образа]] — это минимальная база (меньше программ — меньше уязвимостей), никаких секретов в слоях (удалённый файл всё равно лежит в нижнем слое) и сканирование известных уязвимостей (Trivy, Docker Scout) в CI.',
        'The most effective step is not being root: `USER app` in the Dockerfile or `--user 1000` at run time. Next — drop everything and add back what is needed: `--cap-drop ALL --cap-add NET_BIND_SERVICE`. A read-only root: `--read-only`, with the directories the program must write to in tmpfs (`--tmpfs /run`). And limits: `--memory`, `--pids-limit`, `--cpus`, so that one container cannot eat the machine.\n\nThe next step is [[docker.userns|user namespaces in Docker]]. In rootless mode all of Docker runs as an ordinary user, and root in a container maps onto an unprivileged UID outside (for example 0 → 100000). userns-remap does the same for an ordinary daemon. The price is trouble with bind-mount permissions and limitations (the containerd image store, for instance, is unavailable with userns-remap).\n\nAnd the image itself: [[docker.image-security|image security]] is a minimal base (fewer programs, fewer vulnerabilities), no secrets in layers (a deleted file still lies in the lower layer) and scanning for known vulnerabilities (Trivy, Docker Scout) in CI.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: dockerHost({}, { pull: ['alpine:3.22', 'nginx:1.30-alpine'] }),
      intro: bi('Машина с Docker. Проверяйте себя командами `docker exec … id` и `curl`.', 'A machine with Docker. Check yourself with `docker exec … id` and `curl`.'),
      tasks: [
        {
          id: 'nonroot',
          prompt: bi('Запустите контейнер `app` из alpine (`sleep 3600`) не от root и убедитесь: `docker exec app id -u` не 0.', 'Run an `app` container from alpine (`sleep 3600`) not as root and check: `docker exec app id -u` is not 0.'),
          check: { when: (f) => cs(f).some((c) => c.name === 'app' && c.state === 'running' && nonRoot(c)) },
          chips: 'docker run -d --name app --user 1000:1000 alpine:3.22 sleep 3600; docker exec app id -u',
          concepts: ['docker.security-profile'],
          docRef: { page: 'help/docker-run', anchor: 'OPTIONS', line: '--user' },
          hints: { H1: bi('Пользователя задаёт флаг запуска (или USER в Dockerfile).', 'A run flag sets the user (or USER in the Dockerfile).') },
        },
        {
          id: 'minimal',
          prompt: bi('Запустите nginx `web` на порту 8080 с минимальными правами: корень только для чтения (с tmpfs для `/var/cache/nginx` и `/run`), `--cap-drop ALL` и только нужные capabilities обратно, `no-new-privileges`. `curl localhost:8080` должен отвечать.', 'Run an nginx `web` on port 8080 with minimal rights: a read-only root (with tmpfs for `/var/cache/nginx` and `/run`), `--cap-drop ALL` and only the needed capabilities back, `no-new-privileges`. `curl localhost:8080` must answer.'),
          check: {
            when: (f) => cs(f).some((c) => c.name === 'web' && c.state === 'running' && c.hostConfig.readonly && c.hostConfig.capDrop.includes('ALL') && !c.hostConfig.privileged && c.hostConfig.securityOpt.some((o) => o.startsWith('no-new-privileges'))) && (f.http as Record<string, { status: number }>)['localhost:8080']?.status === 200,
            fail: [{ if: (f) => cs(f).some((c) => c.name === 'web' && c.state === 'exited'), say: bi('Контейнер упал — его причина в `docker logs web`: nginx назовёт, чего ему не хватило (каталога для записи или capability).', 'The container fell over — its reason is in `docker logs web`: nginx names what it lacked (a writable directory or a capability).'), concept: 'docker.security-profile' }],
          },
          chips: 'docker run -d --name web -p 8080:80 --read-only --tmpfs /var/cache/nginx --tmpfs /run --cap-drop ALL --cap-add CHOWN --cap-add SETUID --cap-add SETGID --cap-add NET_BIND_SERVICE --security-opt no-new-privileges nginx:1.30-alpine',
          concepts: ['docker.security-profile'],
          docRef: web('engine/security', 'capabilities'),
          hints: { H1: bi('Запускайте и читайте `docker logs web` после каждой попытки: nginx сам скажет, что не так.', 'Run it and read `docker logs web` after each attempt: nginx says what is wrong itself.'), H2: bi('Порт 80 — NET_BIND_SERVICE; переход в пользователя nginx — SETUID и SETGID; каталоги кэша — CHOWN.', 'Port 80 — NET_BIND_SERVICE; switching to the nginx user — SETUID and SETGID; cache directories — CHOWN.') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      levels: ['intermediate', 'experienced'],
      mode: 'find',
      prompt: bi('nginx должен слушать порт 80, работая не от root, — и без capability NET_BIND_SERVICE. В главе этого не было: ищите параметр ядра, который отвечает за «привилегированные» порты, и флаг Docker, которым его задают контейнеру.', 'nginx must listen on port 80 running as non-root — and without the NET_BIND_SERVICE capability. This was not in the chapter: look for the kernel parameter behind “privileged” ports and the Docker flag that sets it for a container.'),
      ref: { page: 'help/docker-run' },
      terminal: {
        setup: dockerHost({}, { pull: ['nginx:1.30-alpine'] }),
        task: {
          id: 'unprivileged-port',
          prompt: bi('Контейнер `web` от непривилегированного пользователя, без NET_BIND_SERVICE, слушает порт 80.', 'A `web` container as an unprivileged user, without NET_BIND_SERVICE, listening on port 80.'),
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
      title: bi('Итог', 'Summary'),
      body: bi('Root в контейнере — тот же UID 0, урезанный capabilities, seccomp и AppArmor; `--privileged` снимает почти всё. Сужают права: не root, `--cap-drop ALL` и точечные `--cap-add`, `--read-only` с tmpfs, `no-new-privileges`, лимиты. User namespace делает root внутри никем снаружи. В слоях образа не место секретам.', 'Root in a container is the same UID 0, reduced by capabilities, seccomp and AppArmor; `--privileged` lifts almost all of it. Narrowing: not root, `--cap-drop ALL` and targeted `--cap-add`, `--read-only` with tmpfs, `no-new-privileges`, limits. A user namespace makes root inside nobody outside. Secrets have no place in image layers.'),
    },
  ],
};
