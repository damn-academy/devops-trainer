// m04. A container by hand in bash (04 §9): chroot → UTS → PID+mount →
// cgroup → overlay → capabilities → crun. It runs on the simulated machine's
// kernel model (namespaces, cgroup v2, OverlayFS, capabilities) that the Linux
// block's commands drive; checks read that model's facts (shell.ns, cgroups,
// mounts), not the typed text.

import { bi } from '../../../core/i18n';
import type { Facts, Lesson, QuizItem, TerminalSetup } from '../../../core/types';
import { SRC } from '../shared';

const stub = '#!/usr/bin/sim\n# busybox: BusyBox v1.37.0 multi-call binary\n';
const APPLETS = ['sh', 'ls', 'cat', 'echo', 'hostname', 'ps', 'mount', 'umount', 'id', 'pwd', 'mkdir', 'sleep'];

const rootfs = (dir: string) => [
  { path: `${dir}/bin/busybox`, content: stub, mode: '0755', owner: 'root' },
  ...APPLETS.map((n) => ({ path: `${dir}/bin/${n}`, type: 'l' as const, target: 'busybox' })),
  { path: `${dir}/etc/os-release`, content: 'NAME="Alpine Linux"\nID=alpine\nVERSION_ID=3.22.2\n', owner: 'root' },
  { path: `${dir}/etc/hostname`, content: 'box\n', owner: 'root' },
  { path: `${dir}/proc`, type: 'd' as const, owner: 'root' },
  { path: `${dir}/www/index.html`, content: '<h1>hello from mybox</h1>\n', owner: 'root' },
];

type FileFacts = Record<string, { type?: string } | undefined>;
const bundleReady = (f: Facts) => {
  const files = (f.files ?? {}) as FileFacts;
  return files['/c/bundle/config.json']?.type === 'f' && files['/c/bundle/rootfs/bin/busybox']?.type === 'f';
};
/** `hostname` ran after the last `crun run` and printed a name other than the host's. */
const hostnameInsideCrun = (f: Facts) => {
  const term = f.term?.main ?? [];
  let start = -1;
  term.forEach((r, i) => {
    if (/\bcrun\s+run\b/.test(r.line) && r.exit === 0) start = i;
  });
  return start >= 0 && term.slice(start + 1).some((r) => /^\s*hostname\s*$/.test(r.line) && r.exit === 0 && r.out.trim() !== '' && r.out.trim() !== 'trainer');
};

export const byHandSetup: TerminalSetup = {
  hostname: 'trainer',
  user: 'root',
  cwd: '/c',
  files: [
    ...rootfs('/c/rootfs'),
    // two prepared lower directories for overlay (the image chapter will call them layers)
    { path: '/c/l1/www/index.html', content: '<h1>from the first directory</h1>\n', owner: 'root' },
    { path: '/c/l1/www/old.txt', content: 'this file is removed in l2\n', owner: 'root' },
    { path: '/c/l2/www/index.html', content: '<h1>from the second directory</h1>\n', owner: 'root' },
    { path: '/c/upper', type: 'd', owner: 'root' },
    { path: '/c/work', type: 'd', owner: 'root' },
    { path: '/c/merged', type: 'd', owner: 'root' },
    { path: '/c/bundle', type: 'd', owner: 'root' },
  ],
};

export const byHandQuiz: QuizItem[] = [
  {
    id: 'containers.q.chroot-ps',
    kind: 'mcq',
    concepts: ['docker.container'],
    prompt: bi('Вы выполнили `chroot /c/rootfs` и `mount -t proc proc /proc`, а команда `ps` всё равно показала все процессы хоста. Почему?', 'After `chroot /c/rootfs` and `mount -t proc proc /proc`, `ps` showed every process of the host. Why?'),
    options: [
      { id: 'root-only', text: bi('chroot меняет только корень файловой системы, а процессы, сеть и имя машины остаются общими с хостом', 'chroot changes only the file root; processes, network and hostname stay shared'), correct: true },
      { id: 'bug', text: bi('Это ошибка команды ps из busybox', 'It is a busybox ps bug'), why: bi('ps правильно читает /proc, а /proc показывает процессы того пространства имён PID, в котором работает процесс, то есть пространства хоста.', 'ps honestly reads /proc, and /proc shows the pid namespace the process lives in — the host’s.') },
      { id: 'proc', text: bi('Нужно было смонтировать /proc с другими параметрами', 'You had to mount /proc with other options'), why: bi('Параметры монтирования здесь не помогут, потому что для этого нужно собственное пространство имён PID, которое создаёт, например, `unshare --pid --fork`.', 'Mount options will not help here, because this needs a pid namespace of its own, which `unshare --pid --fork`, for example, creates.') },
    ],
  },
  {
    id: 'containers.q.fork-why',
    kind: 'mcq',
    concepts: ['docker.container'],
    prompt: bi('Зачем команде `unshare --pid` нужен флаг `--fork`?', 'Why does `unshare --pid` need the `--fork` flag?'),
    options: [
      { id: 'speed', text: bi('Чтобы процесс запустился в фоне', 'To run in the background'), why: bi('Флаг `--fork` не имеет отношения к фоновым процессам, а определяет, кто станет первым процессом нового пространства.', '`--fork` is not about the background: it is about who becomes the first process of the new namespace.') },
      { id: 'child', text: bi('Сам unshare в новое пространство имён PID не попадает, туда попадают только его дочерние процессы; с --fork первым дочерним процессом и PID 1 станет sh', 'unshare itself does not enter the new pid namespace — its children do; with --fork the first child, sh, becomes PID 1'), correct: true },
      { id: 'mount', text: bi('Чтобы смонтировать /proc', 'To mount /proc'), why: bi('/proc монтирует флаг `--mount-proc` или ваша собственная команда mount внутри пространства.', 'That is what `--mount-proc` does (or your own mount command inside).') },
    ],
    explain: bi('Без --fork первым процессом нового пространства станет первый дочерний процесс sh, а сама оболочка sh получит ошибку, когда попытается запустить второй процесс.', 'Without --fork the first process of the new namespace becomes sh’s first child, and sh gets an error when it tries to start a second one.'),
  },
  {
    id: 'containers.q.cgroup-procs',
    kind: 'mcq',
    concepts: ['docker.container'],
    prompt: bi('Вы создали группу `/sys/fs/cgroup/box` и записали `16M` в файл `memory.max`, но не записали ни одного PID в `cgroup.procs`. Что произойдёт?', 'You created `/sys/fs/cgroup/box` and wrote `16M` into `memory.max`, but never wrote the PID into `cgroup.procs`. What happens?'),
    options: [
      { id: 'none', text: bi('Лимит ни на кого не подействует, потому что в группе нет процессов', 'The limit applies to nobody: the group has no processes'), correct: true },
      { id: 'all', text: bi('Лимит распространится на все процессы машины, потому что группа создана в корне иерархии cgroup', 'The limit applies to every process of the machine, because the group sits at the root of the cgroup tree'), why: bi('Лимит группы действует только на процессы, которые в неё входят, и на процессы её подгрупп.', 'A group limit applies only to the processes in it (and in its sub-groups).') },
      { id: 'error', text: bi('Запись в memory.max закончится ошибкой, потому что сначала в группу нужно добавить процесс', 'Writing memory.max returns an error, because a process must be added to the group first'), why: bi('Записать лимит в пустую группу можно, ошибки не будет.', 'You can write a limit into an empty group.') },
    ],
  },
  {
    id: 'containers.q.pivot-order',
    kind: 'order',
    concepts: ['docker.container'],
    prompt: bi('Расставьте по порядку шаги смены корня через pivot_root в новом пространстве имён mount.', 'Order the steps of changing the root through pivot_root in a new mount namespace.'),
    steps: [
      { id: 'private', text: 'mount --make-rprivate /' },
      { id: 'bind', text: 'mount --bind /c/merged /c/merged', why: bi('pivot_root требует, чтобы новый корень был точкой монтирования.', 'pivot_root requires the new root to be a mount point.') },
      { id: 'mkdir', text: 'mkdir -p /c/merged/.oldroot' },
      { id: 'pivot', text: 'pivot_root /c/merged /c/merged/.oldroot' },
      { id: 'umount', text: 'umount -l /.oldroot', why: bi('Старый корень размонтируют, чтобы из контейнера до него нельзя было добраться.', 'The old root is unmounted so that it cannot be reached from the container.') },
    ],
  },
];

export const byHandLesson: Lesson = {
  id: 'containers.by-hand',
  block: 'containers',
  title: bi('Как собрать контейнер своими руками', 'A container by hand'),
  summary: bi('В этом уроке вы соберёте контейнер без Docker из механизмов ядра, знакомых по блоку Linux, по одному механизму за шаг, а потом запустите тот же контейнер рантаймом crun, той программой, которая запускает контейнеры по команде Docker. Машина урока работает в симуляторе в браузере.', 'We build a container without Docker: chroot, namespaces, a cgroup, overlay and pivot_root, capabilities — and the same container with the crun runtime, the program that starts containers when Docker asks. The lesson’s machine runs in a simulator in the browser.'),
  introduces: [],
  uses: ['docker.container', 'docker.bundle', 'docker.runtime'],
  tier: 'core',
  minutes: 40,
  sources: {
    en: [SRC.lizrice, SRC.iximiuz, SRC.namespaces, SRC.cgroups, SRC.overlayfs, SRC.capabilities],
    ru: [SRC.habrUnshare, SRC.habrPivot, SRC.habrCgroups, SRC.habrOverlay],
  },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Можно ли собрать контейнер без Docker? Можно, и все нужные детали вам уже знакомы: каждую из них вы трогали в блоке Linux. В этом уроке мы соберём их вместе, по одной команде за шаг. В конце окажется, что `crun` с файлом `config.json` делает то же самое, только за вас.', 'Can you build a container without Docker? You can — and you already know every part: you touched each of them in the Linux block. In this lesson we put them together, one command per step. At the end it turns out that `crun` with `config.json` does exactly the same, only for you.'),
    },
    {
      id: 'plan',
      kind: 'text',
      step: 'explain',
      title: bi('Из каких шагов складывается сборка контейнера', 'Which steps building a container takes'),
      body: bi(
        '### Шаг за шагом\n\n1. **chroot** даёт процессу другой корень файловой системы, но только корень. Процессы, сеть и имя машины остаются общими, а root внутри может выбраться наружу через каталог `/proc/<PID>/root` любого процесса хоста, например через `/proc/1/root`.\n2. **UTS** даёт контейнеру своё имя машины. Для этого выполняют `unshare --uts sh`, а затем `hostname box`. Имя хоста при этом не меняется.\n3. **PID и mount** дают контейнеру свой PID 1. Для этого выполняют `unshare --pid --fork --mount sh`, а затем `mount -t proc proc /proc`. Теперь `ps` видит только процессы этого пространства. Сам unshare в новое пространство не попадает, поэтому нужен флаг `--fork`.\n4. **cgroup** задаёт лимиты. Для этого выполняют `mkdir /sys/fs/cgroup/box`, `echo 16M > memory.max`, `echo 20 > pids.max` и, наконец, записывают PID процесса в файл `cgroup.procs`. Без этой последней записи лимит ни на кого не действует.\n5. **overlay и pivot_root** собирают корень из двух заготовленных нижних каталогов и пустого верхнего. Затем `pivot_root` делает его корнем, старый корень размонтируется, и выйти наружу больше некуда.\n6. **Привилегии ядра (capabilities)** урезают права root, так что без привилегии `cap_sys_admin` монтировать уже нельзя.\n7. **crun** запускает тот же контейнер по файлу `config.json`.\n\nСеть, то есть пару veth между хостом и новым пространством имён net, вы уже собирали в блоке сетей. Здесь она устроена так же, поэтому этот шаг оставлен для желающих.',
        '### Step by step\n\n1. **chroot** — a different file root. Only the root: processes, network and hostname stay shared, and root inside can climb out through the `/proc/<PID>/root` directory of any host process, for example `/proc/1/root`.\n2. **UTS** — a hostname of its own: `unshare --uts sh`, then `hostname box`. The host’s name does not change.\n3. **PID and mount** — a PID 1 of its own: `unshare --pid --fork --mount sh` and `mount -t proc proc /proc`. Now `ps` sees only its own. unshare itself does not enter the new namespace, hence `--fork`.\n4. **cgroup** — limits: `mkdir /sys/fs/cgroup/box`, `echo 16M > memory.max`, `echo 20 > pids.max` and the process’s PID into `cgroup.procs`. Without that last write the limit applies to nobody.\n5. **overlay and pivot_root** — a root from two prepared lower directories and an empty upper one; then `pivot_root`, and the old root is unmounted: there is nowhere to climb out to.\n6. **capabilities** — a reduced root: without `cap_sys_admin` you cannot mount.\n7. **crun** — the same container from `config.json`.\n\nThe network — a veth pair between the host and a new net namespace — you built in the networks block; it is the same here, so that step is optional.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: byHandSetup,
      intro: bi('Вы работаете как root на машине, ядро которой умеет пространства имён, cgroup v2 и OverlayFS. В каталоге `/c/rootfs` лежит маленький корень на основе busybox, а в `/c/l1` и `/c/l2` — два нижних каталога для overlay. Машина учебная, поэтому сломать её нельзя. Если что-то пошло не так, кнопка «Сбросить машину» вернёт её в исходное состояние. Каждое задание, где сказано «оставайтесь внутри», вы заканчиваете внутри новой оболочки, а следующее начинаете с команды `exit`, которая возвращает вас на хост.', 'You are root on a machine whose kernel does namespaces, cgroup v2 and OverlayFS. `/c/rootfs` holds a small busybox root, `/c/l1` and `/c/l2` two lower directories for overlay. The machine is a training one, so it cannot be broken. If something goes wrong, the “Reset machine” button brings it back to where it started. Every task that says “stay inside” ends inside a new shell, and the next one starts with `exit`, which takes you back to the host.'),
      tasks: [
        {
          id: 'chroot',
          prompt: bi('Войдите в каталог `/c/rootfs` через chroot и посмотрите, что покажет `ls /`. Оставайтесь внутри.', 'Enter `/c/rootfs` with chroot and look at `ls /`. Stay inside.'),
          check: { when: "shell.root='/c/rootfs'" },
          chips: 'chroot /c/rootfs /bin/sh',
          docRef: { page: 'man/chroot.8', anchor: 'SYNOPSIS' },
          hints: { H1: bi('Нужная команда меняет корень и запускает в нём оболочку.', 'The command changes the root and starts a shell in it.'), H2: bi('Первым аргументом команда принимает новый корень, а вторым программу, которую нужно запустить внутри него.', 'The first argument is the new root, the second the program inside it.') },
        },
        {
          id: 'uts',
          prompt: bi('Выйдите из chroot командой `exit`. Запустите оболочку в новом пространстве имён UTS и задайте в нём имя машины `box`. Оставайтесь внутри.', 'Leave the chroot (`exit`). Start a shell in a new UTS namespace and set the name `box` in it. Stay inside.'),
          check: { when: "shell.ns.uts!=4026531838 && shell.hostname=box" },
          chips: 'unshare --uts sh',
          docRef: { page: 'man/unshare.1', anchor: 'OPTIONS', line: '--uts' },
          hints: { H1: bi('Сначала создайте новое пространство имён, а потом уже внутри него выполните `hostname box`.', 'First the new namespace, then `hostname box` already inside it.'), H2: bi('Выполните `unshare --uts sh`, а затем `hostname box`.', '`unshare --uts sh`, then `hostname box`.') },
        },
        {
          id: 'pid',
          prompt: bi('Выйдите и запустите `sh` в новых пространствах имён pid и mount так, чтобы внутри `echo $$` выводил 1, а `ps` показывал только ваши процессы. Оставайтесь внутри.', 'Leave and start `sh` in new pid and mount namespaces so that `echo $$` inside prints 1 and `ps` shows only your processes. Stay inside.'),
          check: { when: "shell.ns.pid!=4026531836 && shell.ns.mnt!=4026531841" },
          chips: 'unshare --pid --fork --mount sh',
          docRef: { page: 'man/unshare.1', anchor: 'OPTIONS', line: '--fork' },
          hints: { H1: bi('Нужны три флага: для pid, для mount и тот, без которого sh не станет PID 1.', 'You need three flags: pid, mount and the one without which sh will not become PID 1.'), H2: bi('Выполните `unshare --pid --fork --mount sh`, а внутри `mount -t proc proc /proc`.', '`unshare --pid --fork --mount sh`, inside `mount -t proc proc /proc`.') },
        },
        {
          id: 'cgroup',
          prompt: bi('Выйдите на хост. Создайте группу `box` в `/sys/fs/cgroup`, ограничьте её 16 МиБ памяти и 20 процессами и перенесите в неё текущую оболочку.', 'Go back to the host. Create a `box` group in `/sys/fs/cgroup`, limit it to 16 MiB of memory and 20 processes, and move the current shell into it.'),
          check: {
            when: (f) => {
              const cgs = (f.cgroups as { path: string; procs: number[]; memory: { max: number | string }; pids: { max: number | string } }[] | undefined) ?? [];
              const box = cgs.find((c) => c.path === '/box' || c.path === '/sys/fs/cgroup/box');
              return !!box && Number(box.memory.max) <= 16 * 1024 * 1024 && Number(box.pids.max) <= 20 && box.procs.length > 0;
            },
            fail: [{ if: "files['/sys/fs/cgroup/box'].type=d && files['/sys/fs/cgroup/box/cgroup.procs'].text=''", say: bi('Лимиты записаны, но в группе нет ни одного процесса. Запишите PID оболочки, который выводит `echo $$`, в файл `cgroup.procs`.', 'The limits are written but the group has no processes: write the shell’s PID (`echo $$`) into `cgroup.procs`.') }],
          },
          chips: 'mkdir /sys/fs/cgroup/box && echo 16M > /sys/fs/cgroup/box/memory.max && echo 20 > /sys/fs/cgroup/box/pids.max && echo $$ > /sys/fs/cgroup/box/cgroup.procs',
          hints: { H1: bi('Группа cgroup устроена как каталог, каждый лимит записывается в отдельный файл этого каталога, а процесс входит в группу, когда его PID записан в `cgroup.procs`.', 'A group is a directory, a limit is a file in it, a member is a PID in `cgroup.procs`.') },
        },
        {
          id: 'overlay',
          prompt: bi('Смонтируйте в `/c/merged` файловую систему overlay: нижние каталоги `/c/l2` (верхний из нижних) и `/c/l1`, верхний каталог `/c/upper`, рабочий `/c/work`. Посмотрите, из какого каталога виден `index.html`.', 'Mount an overlay at `/c/merged`: lower directories `/c/l2` (the upper of the lower) and `/c/l1`, upper `/c/upper`, work `/c/work`. See whose `index.html` shows.'),
          check: { when: "mounts[target='/c/merged'].type=overlay" },
          chips: 'mount -t overlay overlay -o lowerdir=/c/l2:/c/l1,upperdir=/c/upper,workdir=/c/work /c/merged',
          docRef: { url: 'https://docs.kernel.org/filesystems/overlayfs.html', label: 'docs.kernel.org › overlayfs' },
          hints: { H1: bi('В параметре lowerdir каталоги перечисляют через двоеточие, причём верхний из нижних идёт первым.', 'In lowerdir the directories are listed with colons, the uppermost first.') },
        },
        {
          id: 'caps',
          prompt: bi('Убедитесь, что root без привилегии `cap_sys_admin` не может монтировать: запустите через capsh оболочку без этой привилегии и попробуйте выполнить `mount -t tmpfs t /mnt`.', 'Check that root without `cap_sys_admin` cannot mount: start a shell through capsh without that capability and try `mount -t tmpfs t /mnt`.'),
          check: { stdout: /Operation not permitted|permission denied|only root can do that/i },
          chips: "capsh --drop=cap_sys_admin -- -c 'mount -t tmpfs t /mnt'",
          docRef: { page: 'man/capsh.1', anchor: 'OPTIONS', line: '--drop' },
          hints: { H1: bi('Программа capsh отнимает привилегию у оболочки, которую запускает, и вернуть эту привилегию оболочка уже не сможет, даже если работает от root. Привилегию называет флаг `--drop`, а команду для оболочки пишут после `--`.', 'capsh removes a capability from the bounding set, and after exec even root lacks it.'), H2: bi("Выполните `capsh --drop=cap_sys_admin -- -c 'mount -t tmpfs t /mnt'`. Сообщение об ошибке в ответ и есть нужный результат.", "Run `capsh --drop=cap_sys_admin -- -c 'mount -t tmpfs t /mnt'`. The error message it prints is the result you need.") },
        },
        {
          id: 'crun',
          prompt: bi('Запустите тот же контейнер рантаймом. В каталог `/c/bundle` скопируйте `/c/rootfs` под именем `rootfs`, создайте `config.json` командой `crun spec` и выполните `crun run mybox`. Внутри проверьте `hostname`, потом выйдите командой `exit`.', 'The same container with a runtime: in `/c/bundle` copy `/c/rootfs` as `rootfs`, create `config.json` (`crun spec`) and run `crun run mybox`. Inside check `hostname`, then `exit`.'),
          check: {
            when: (f) => bundleReady(f) && hostnameInsideCrun(f),
            fail: [
              { if: (f) => bundleReady(f), say: bi('Бандл собран: рядом лежат каталог `rootfs` и файл `config.json`. Осталось запустить контейнер командой `crun run mybox` и уже внутри него выполнить `hostname`. Если crun ответит, что контейнер `mybox` уже существует, удалите старую запись командой `crun delete mybox` и запустите контейнер снова.', 'The bundle is ready: the `rootfs` directory and the `config.json` file lie side by side. What is left is to start the container with `crun run mybox` and run `hostname` inside it. If crun replies that the container `mybox` already exists, remove the old record with `crun delete mybox` and start the container again.'), concept: 'docker.runtime' },
            ],
          },
          chips: 'cd /c/bundle && cp -r /c/rootfs rootfs && crun spec && crun run mybox',
          concepts: ['docker.bundle', 'docker.runtime'],
          hints: { H1: bi('Бандл состоит из каталога rootfs и файла config.json, которые лежат рядом.', 'A bundle is rootfs and config.json side by side.'), H2: bi('Перейдите в каталог командой `cd /c/bundle`, затем выполните `cp -r /c/rootfs rootfs`, `crun spec` и `crun run mybox`.', 'Go to the directory with `cd /c/bundle`, then run `cp -r /c/rootfs rootfs`, `crun spec` and `crun run mybox`.') },
        },
      ],
    },
    {
      id: 'map',
      kind: 'text',
      step: 'explain',
      title: bi('Что сделал crun', 'What crun did'),
      body: bi('Сравните поля `config.json` с тем, что вы делали руками. Поле `linux.namespaces` соответствует шагам 2 и 3 и сети, `linux.resources` — шагу 4, `root.path` и `mounts` — шагу 5, `process.capabilities` и `process.user` — шагу 6. Рантайм создаёт новые пространства имён pid, network, ipc, uts, mount и cgroup, а пространства user и time оставляет общими с хостом. Ваши команды делали в упрощённом виде то, что рантайм делает полностью, а рантайм — то, что для Docker делают containerd и runc.', 'Compare the `config.json` fields with what you did by hand: `linux.namespaces` — steps 2, 3 and the network; `linux.resources` — step 4; `root.path` and `mounts` — step 5; `process.capabilities` and `process.user` — step 6. The namespaces: pid, network, ipc, uts, mount, cgroup — new; user and time — shared with the host. Your commands did in a simplified way what a runtime does properly, and the runtime is what containerd and runc do for Docker.'),
    },
    {
      id: 'seccomp',
      kind: 'docs',
      step: 'practice',
      levels: ['experienced'],
      mode: 'find',
      prompt: bi('Запретите контейнеру системный вызов `mkdir` средствами runtime-spec. Подсказок в этом задании не будет, поэтому место в спецификации, где это описано, найдите сами.', 'Forbid the `mkdir` system call to the container with runtime-spec means — no hints. Find where it is described in the specification yourself.'),
      ref: { url: 'https://github.com/opencontainers/runtime-spec/blob/main/config-linux.md', label: 'runtime-spec › config-linux.md' },
      terminal: {
        setup: { ...byHandSetup, cwd: '/c/bundle' },
        task: {
          id: 'seccomp',
          prompt: bi('В файле `/c/bundle/config.json` должно быть правило, по которому вызов `mkdir` получает ошибку.', '`/c/bundle/config.json` must hold a rule that answers `mkdir` with an error.'),
          check: { when: (f) => /"seccomp"[\s\S]*"mkdir"[\s\S]*SCMP_ACT_ERRNO/.test(f.files['/c/bundle/config.json']?.text ?? '') },
          docStep: 4,
          beyond: true,
          solutionTokens: ['seccomp', 'SCMP_ACT_ERRNO', 'syscalls', 'defaultAction'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: byHandQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог урока', 'Summary'),
      body: bi('Команда chroot меняет только корень файловой системы. Пространства имён дают контейнеру своё имя машины, свой PID 1 и своё дерево монтирований, cgroup ограничивает ресурсы, overlay вместе с pivot_root дают корень, из которого не выбраться, а привилегии ядра урезают права root. Docker делает всё то же самое, только за вас.', 'chroot changes only the root; namespaces give a name, a PID 1 and a mount tree of their own; a cgroup limits; overlay and pivot_root give a root you cannot climb out of; capabilities cut down root. Docker does the same — only for you.'),
    },
  ],
};
