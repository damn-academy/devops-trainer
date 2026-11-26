// The Linux learning exams that need a real machine (02 §8.3): "The
// partition is full" (a deleted file still held open, a cron job that keeps
// filling, no log rotation) and "Access for a new developer" (two machines,
// keys, a shared directory, a narrow sudo rule, sshd settings). The simulator
// has neither open deleted files nor sudoers rules and a second machine, so
// these run on the learner's own VMs: a readable script plants the
// situation, the read-only trainer-check-host.sh collects the facts, and the
// goals judge the state.

import { bi } from '../../core/i18n';
import type { Exam, Facts, RealGoal } from '../../core/types';
import { CLEANUP_ACCEPT } from '../../app/real/facts';
import accessLaptop from './real/access-laptop.sh?raw';
import accessServer from './real/access-server.sh?raw';
import diskPlant from './real/disk-plant.sh?raw';

const MiB = 1024 * 1024;
type Mount = { target: string; free: number };
type Perm = { u: string; g: string; o: string; setgid: boolean };
type FileF = { exists?: boolean; type?: string; owner?: string; group?: string; perm?: Perm; text?: string };

const file = (f: Facts, p: string) => f.files[p] as unknown as FileF | undefined;
const text = (f: Facts, p: string) => file(f, p)?.text ?? '';
const mount = (f: Facts, t: string) => ((f.mounts ?? []) as Mount[]).find((m) => m.target === t);
const unitActive = (f: Facts, n: string) => ((f.units ?? {}) as Record<string, { active: string }>)[n]?.active === 'active';
const tree = (f: Facts, d: string) => ((f.trees ?? {}) as Record<string, string>)[d] ?? '';
const sshd = (f: Facts) => (f.sshd ?? {}) as Record<string, string>;
const sudoL = (f: Facts, u: string) => ((f.sudo ?? {}) as Record<string, string>)[u] ?? '';
const probe = (f: Facts, id: string) => ((f.reach ?? {}) as Record<string, { exit?: number; methods?: string }>)[id];
const G = (id: string, label: [string, string], on: string | undefined, when: RealGoal['check']['when'], fail?: RealGoal['check']['fail']): RealGoal => ({ id, label: bi(label[0], label[1]), on, check: { when, fail } });


// ── linux.exam.disk ──

const SHOP = '/srv/shop';
const ORDERS = '/srv/shop/lib/orders';
const dataIntact = (f: Facts) => !!tree(f, ORDERS) && tree(f, ORDERS) === text(f, '/var/lib/dt-trainer/disk.start').trim();
/** The cron line is gone or every non-empty line of the file is a comment. */
const cronOff = (f: Facts) => !file(f, '/etc/cron.d/legacy-dump') || text(f, '/etc/cron.d/legacy-dump').split('\n').every((l) => !l.trim() || /^\s*#/.test(l));

export const DISK_EXAM: Exam = {
  id: 'linux.exam.disk',
  block: 'linux',
  title: bi('Раздел, в котором не осталось места', 'A partition with no space left'),
  intro: bi(
    'Это учебная контрольная после уроков о дисках и файловых системах, и проходит она на вашей собственной машине, где тренажёр ничего не выполняет. Скрипт подготовки создаёт раздел магазина и наполняет его так, как наполняются настоящие серверы, а скрипт проверки только читает состояние. Засчитывается результат, а путь к нему может быть любым. На экзамене открыта документация машины: `man`, `--help` и страницы systemd. Если своей машины нет, можно сдать [вариант во вкладке](#/lab/linux-disk) с тем же сюжетом на настоящем Alpine Linux прямо в браузере, где службами управляет OpenRC, а не systemd.',
    'This is a learning test after the lessons on disks and file systems, and it runs on your own machine, where the trainer runs nothing. The setup script creates the shop’s partition and fills it the way real servers fill up, and the check script only reads the state. The result counts, and the way to it may be any. The machine’s documentation is open: `man`, `--help` and the systemd pages. If you have no machine of your own, take [the variant in the tab](#/lab/linux-disk) with the same story on real Alpine Linux in the browser, where OpenRC, not systemd, manages the services.',
  ),
  story: bi(
    'Мониторинг сообщает, что на сервере магазина раздел `/srv/shop` заполнен на 100 %, и приложение заказов перестало записывать данные. Освободите место, не потеряв данных магазина в `/srv/shop/lib/orders`, и сделайте так, чтобы через неделю это не повторилось. Кэш сборки и временные файлы старых задач можно удалять, а агент `legacy-agent` ещё нужен для отчётности.',
    'Monitoring reports that on the shop’s server `/srv/shop` is 100 % full, and the orders application has stopped writing data. Free the space without losing the shop’s data in `/srv/shop/lib/orders`, and make sure it does not happen again in a week. The build cache and the temporary files of old jobs may be deleted, and the `legacy-agent` is still needed for reporting.',
  ),
  minutes: 35,
  pass: 0.7,
  allowedDocs: ['man', 'help'],
  real: {
    track: 'linux-disk',
    order: bi(
      'Вам понадобится одна самая маленькая машина (1 vCPU, 1 ГБ памяти, диск от 5 ГБ) с Debian 12 или Ubuntu 24.04, входом по SSH и метками `trainer=devops` и `dt-track=linux-disk`. Экзамен длится около получаса, и в своём облаке он обойдётся в стоимость самой дешёвой машины за час. Адрес машины для этого экзамена не нужен.',
      'You need one smallest machine (1 vCPU, 1 GB of memory, a disk of 5 GB or more) with Debian 12 or Ubuntu 24.04, SSH access and the labels `trainer=devops` and `dt-track=linux-disk`. The exam takes about half an hour, and in your own cloud it costs as much as the cheapest machine for an hour. The machine’s address is not needed for this exam.',
    ),
    machines: [
      {
        id: 'app-01',
        role: bi('сервер магазина', 'the shop’s server'),
        dtlab: 'learner',
        collect: ['--scope mounts', '--scope journald', `--tree ${ORDERS}`, '--file /var/lib/dt-trainer/disk.start', '--file /etc/cron.d/legacy-dump', '--file /etc/logrotate.d/legacy', '--logrotate /etc/logrotate.d/legacy', '--unit orders.service', '--unit legacy-agent.service'],
      },
    ],
    dtlabUp: 'dtlab up --with learner',
    prepare: [{ name: 'disk-plant.sh', on: 'app-01', note: bi('Скрипт создаёт раздел магазина размером 160 МБ в файле-образе и монтирует его в `/srv/shop`, а также заводит две службы, задание cron и снимок данных для проверки. Системные разделы он не трогает.', 'The script creates the shop’s 160 MB partition in an image file and mounts it at `/srv/shop`, and also sets up two services, a cron job and a data snapshot for the check. It does not touch the system partitions.'), text: diskPlant }],
  },
  explain: [
    {
      id: 'e1',
      prompt: bi('Руководитель команды спрашивает: «`du` по всему разделу насчитал меньше половины, а `df` говорит, что раздел полон. Как такое бывает и как вы нашли, где место?»', 'The team lead asks: “`du` over the whole partition counted less than half, and `df` says it is full. How can that be, and how did you find where the space went?”'),
      keyPoints: [
        bi('`du` считает файлы по именам, а `df` считает занятые блоки файловой системы', '`du` counts files by their names, while `df` counts the used blocks of the file system'),
        bi('удалённый файл продолжает существовать, пока его держит открытым процесс', 'a deleted file goes on existing while a process holds it open'),
        bi('такие файлы видны в `lsof +L1` или в `/proc/PID/fd` с пометкой deleted', 'such files show in `lsof +L1` or in `/proc/PID/fd` marked deleted'),
        bi('место возвращает перезапуск процесса или обрезка файла через его дескриптор', 'restarting the process or truncating the file through its descriptor gives the space back'),
      ],
    },
    {
      id: 'e2',
      prompt: bi('«Что вы напишете в разборе инцидента, чтобы через неделю он не повторился?»', '“What do you write in the incident review so that it does not happen again in a week?”'),
      keyPoints: [
        bi('кто писал на раздел и с какой скоростью, то есть задание cron, которое раз в две минуты записывало в `/srv/shop/backups/legacy` новый файл с выгрузкой данных (такой файл называют дампом), и журнал агента', 'who wrote to the partition and how fast, that is, the cron dumps and the agent’s log'),
        bi('ротацию журналов с ограничением по числу и размеру файлов', 'log rotation limited by the number and size of files'),
        bi('предупреждение мониторинга задолго до заполнения на 100 %', 'a monitoring warning long before 100 %'),
        bi('открытые журналы не удаляют, а ротируют с `copytruncate` или с сигналом программе', 'open logs are not deleted but rotated with `copytruncate` or with a signal to the program'),
      ],
    },
  ],
  tasks: [
    {
      id: 'free',
      weight: 35,
      critical: true,
      kind: 'real',
      real: {
        prompt: bi('Освободите на `/srv/shop` не меньше 40 мебибайт. Данные заказов должны остаться в точности такими, как были, а приложение должно продолжать работать.', 'Free at least 40 MiB on `/srv/shop`. The orders data must stay exactly as it was, and the application must keep working.'),
        concepts: ['linux.filesystem', 'linux.inode', 'linux.mount', 'linux.process'],
        goals: [
          G('space', ['на `/srv/shop` свободно не меньше 40 МиБ', '`/srv/shop` has at least 40 MiB free'], 'app-01', (f) => (mount(f, SHOP)?.free ?? 0) >= 40 * MiB, [
            { if: (f) => { const m = mount(f, SHOP); return !!m && m.free >= 20 * MiB && m.free < 40 * MiB; }, say: bi('Кэш и временные файлы удалены, но этого мало. `df` и `du` расходятся, а значит, место держит что-то, чего не видно по именам.', 'The cache and temporary files are deleted, but that is not enough. `df` and `du` disagree, which means something not visible by name holds the space.') },
            { if: (f) => !mount(f, SHOP), say: bi('Раздел `/srv/shop` не смонтирован, а описан он в `/etc/fstab`.', '`/srv/shop` is not mounted, and it is described in `/etc/fstab`.') },
          ]),
          G('data', ['данные заказов целы', 'the orders data is intact'], 'app-01', dataIntact, [{ if: (f) => !!tree(f, ORDERS) && !dataIntact(f), say: bi('Данные в `/srv/shop/lib/orders` изменились, а освобождать место таким способом нельзя.', 'The data in `/srv/shop/lib/orders` changed, and space must not be freed that way.') }]),
          G('app', ['приложение заказов работает', 'the orders application is running'], 'app-01', (f) => unitActive(f, 'orders.service')),
        ],
      },
    },
    {
      id: 'cron',
      weight: 15,
      kind: 'real',
      real: {
        prompt: bi('Найдите, кто продолжает заполнять раздел, и остановите это так, чтобы после перезагрузки оно не возобновилось.', 'Find who keeps filling the partition and stop it so that it does not resume after a reboot.'),
        concepts: ['linux.cron'],
        goals: [G('cron', ['задание cron, которое записывает файлы с выгрузкой данных, выключено', 'the job that writes the dumps is off'], 'app-01', cronOff)],
      },
    },
    {
      id: 'rotate',
      weight: 20,
      kind: 'real',
      real: {
        prompt: bi('У журналов `legacy-agent` в `/srv/shop/log/legacy/*.log` нет ротации. Добавьте правило в `/etc/logrotate.d/legacy`, которое хранит не больше пяти старых журналов, сжимает их и не трогает пустые. Учтите, что агент открывает журнал один раз и не умеет открывать его заново.', 'The `legacy-agent` logs in `/srv/shop/log/legacy/*.log` have no rotation. Add a rule to `/etc/logrotate.d/legacy` that keeps at most five old logs, compresses them and leaves empty ones alone. Note that the agent opens its log once and cannot reopen it.'),
        concepts: ['linux.journal'],
        goals: [
          G('pattern', ['logrotate видит правило для `/srv/shop/log/legacy/*.log`', 'logrotate sees a rule for `/srv/shop/log/legacy/*.log`'], 'app-01', (f) => /rotating pattern: \/srv\/shop\/log\/legacy\/\*\.log/.test(((f.logrotate ?? {}) as Record<string, string>)['/etc/logrotate.d/legacy'] ?? ''), [{ if: (f) => /error/i.test(((f.logrotate ?? {}) as Record<string, string>)['/etc/logrotate.d/legacy'] ?? ''), say: bi('logrotate нашёл в правиле ошибку. Посмотрите вывод `logrotate -d /etc/logrotate.d/legacy`.', 'logrotate found a mistake in the rule. Look at the output of `logrotate -d /etc/logrotate.d/legacy`.') }]),
          G('keep', ['хранится не больше пяти журналов, и они сжимаются', 'at most five logs are kept, and they are compressed'], 'app-01', (f) => { const r = text(f, '/etc/logrotate.d/legacy'); const n = /^\s*rotate\s+(\d+)/m.exec(r); return !!n && Number(n[1]) <= 5 && /^\s*compress\b/m.test(r) && /^\s*notifempty\b/m.test(r); }),
          G('truncate', ['ротация не отнимает у агента его открытый журнал', 'rotation does not take the open log away from the agent'], 'app-01', (f) => /^\s*copytruncate\b/m.test(text(f, '/etc/logrotate.d/legacy')), [{ if: (f) => !!text(f, '/etc/logrotate.d/legacy') && !/copytruncate/.test(text(f, '/etc/logrotate.d/legacy')), say: bi('Без особого режима logrotate переименует журнал, а агент продолжит писать в старый файл, тот самый, который занял раздел. На странице `man logrotate` есть режим для программ, которые не умеют открывать журнал заново.', 'Without a special mode logrotate renames the log, and the agent keeps writing to the old file, the very one that filled the partition. `man logrotate` has a mode for programs that cannot reopen their log.') }]),
        ],
      },
    },
    {
      id: 'why',
      weight: 10,
      kind: 'quiz',
      item: {
        id: 'linux.exam.q.disk-why',
        kind: 'mcq',
        concepts: ['linux.inode', 'linux.filesystem'],
        prompt: bi('Кто-то удалил разросшийся `debug.log` агента командой `rm`, но место на разделе не освободилось. Почему?', 'Someone deleted the agent’s overgrown `debug.log` with `rm`, but the partition got no space back. Why?'),
        options: [
          { id: 'open', text: bi('Команда `rm` убрала имя, а агент держит файл открытым, и inode с данными сохраняются, пока агент его не закроет', '`rm` removed the name, while the agent holds the file open, and the inode and data are kept until the agent closes it'), correct: true },
          { id: 'cache', text: bi('Ядро освобождает место не сразу, а при следующей проверке файловой системы', 'The kernel frees the space later, at the next file system check'), why: bi('Нет, блоки закрытого и удалённого файла освобождаются сразу, и ждать проверки fsck не нужно.', 'No, the blocks of a closed and deleted file are freed at once, and there is no need to wait for fsck.') },
          { id: 'trash', text: bi('Файл попал в корзину, и её нужно очистить', 'The file went to the trash, which must be emptied'), why: bi('Нет, у `rm` нет корзины, потому что корзина есть только в графических программах для работы с файлами.', 'No, `rm` has no trash, because a trash exists only in graphical file managers.') },
        ],
        explain: bi('Имя в каталоге служит только ссылкой на inode. Пока на файл ссылается хотя бы одно имя или открытый дескриптор, его блоки заняты. Команда `du` идёт по именам и такого файла не видит, а `df` считает блоки и видит его.', 'A name in a directory is only a link to an inode. While at least one name or open descriptor refers to the file, its blocks are taken. `du` walks the names and does not see such a file, while `df` counts blocks and sees it.'),
      },
    },
    {
      id: 'journal',
      weight: 15,
      beyond: true,
      kind: 'real',
      real: {
        prompt: bi('Журнал systemd на этом сервере не должен занимать больше 50 мегабайт. В курсе не показано, как это задать, поэтому найдите способ на странице `man journald.conf`.', 'The systemd journal on this server must not take more than 50 megabytes. The course did not show how to set this, so find it on the page `man journald.conf`.'),
        concepts: ['linux.journal'],
        goals: [G('max', ['итоговая настройка journald ограничивает журнал 50 МБ', 'journald’s effective settings limit the journal to 50 MB'], 'app-01', (f) => /^\s*SystemMaxUse\s*=\s*50M\s*$/m.test((f.journald ?? '') as string))],
        solutionTokens: ['SystemMaxUse', 'journald.conf.d'],
      },
    },
    {
      id: 'cleanup',
      weight: 5,
      critical: true,
      kind: 'real',
      real: {
        prompt: bi('Уборка. Удалите машину и вставьте подтверждение. Если вы работали в лаборатории dtlab, выполните на своём компьютере `dtlab destroy`, подтвердите удаление ответом `y` и вставьте всё, что напечатала команда. Если машину заказывали через Terraform, вставьте вывод `terraform destroy`, а если заказывали в облаке вручную, вставьте список машин с меткой `dt-track=linux-disk` в формате JSON, то есть `[]`.', 'Clean-up. Delete the machine and paste a confirmation. If you worked in the dtlab lab, run `dtlab destroy` on your computer, confirm the deletion with `y` and paste everything the command printed. If you ordered the machine with Terraform, paste the output of `terraform destroy`; if you ordered it in your cloud by hand, paste the list of machines labelled `dt-track=linux-disk` as JSON, that is, `[]`.'),
        paste: { label: bi('Подтверждение уборки', 'The cleanup confirmation'), accept: CLEANUP_ACCEPT },
      },
    },
  ],
};

// ── linux.exam.access ──

const MARIA_SSH = '/home/maria/.ssh';
const noWrite = (p?: Perm) => !!p && !p.g.includes('w') && !p.o.includes('w');
const sudoNarrow = (s: string) => /NOPASSWD:\s*\/(usr\/)?bin\/systemctl restart orders(\.service)?\s*$/m.test(s) && !/\)\s*(NOPASSWD:\s*)?ALL\s*$/m.test(s);

export const ACCESS_EXAM: Exam = {
  id: 'linux.exam.access',
  block: 'linux',
  title: bi('Доступ для новой разработчицы', 'Access for a new developer'),
  intro: bi(
    'Это учебная контрольная после уроков о сети машины и SSH, и проходит она на двух ваших машинах: `laptop` играет роль рабочего ноутбука Марии, а `server` служит сервером команды. Тренажёр на них ничего не выполняет. Скрипты подготовки заводят то, что на таком сервере обычно уже есть, а скрипт проверки только читает состояние. Консоль провайдера остаётся у вас на случай, если вход по SSH закроется. На экзамене открыта документация машины: `man` и `--help`. Без своих машин этот экзамен можно сдать в [варианте во вкладке](#/lab/linux-access), где работают две настоящие машины с Alpine Linux прямо в браузере.',
    'This is a learning test after the lessons on the machine’s network and SSH, and it runs on two machines of yours: `laptop` plays Maria’s work laptop, and `server` is the team’s server. The trainer runs nothing on them. The setup scripts create what such a server usually already has, and the check script only reads the state. The provider’s console stays with you in case SSH access closes. The machine’s documentation is open: `man` and `--help`. Without machines of your own you can take this exam in [the variant in the tab](#/lab/linux-access), where two real Alpine Linux machines run in the browser.',
  ),
  story: bi(
    'В команду пришла разработчица Мария. Ей нужен вход на `server` по ключу, общий с командой каталог для выкладки `/srv/releases`, в котором новые файлы сразу принадлежат группе `devs`, и право перезапускать службу `orders`, причём только её и без полного sudo. Вход по паролю пора запретить для всех, а по SSH пускать только группу `devs`.',
    'Maria, a developer, has joined the team. She needs key login to `server`, a release directory `/srv/releases` shared with the team, where new files belong to the group `devs` at once, and the right to restart the `orders` service, and only it, without full sudo. Password logins must be switched off for everyone, and SSH must let in only the group `devs`.',
  ),
  minutes: 40,
  pass: 0.7,
  allowedDocs: ['man', 'help'],
  real: {
    track: 'linux-access',
    order: bi(
      'Вам понадобятся две самые маленькие машины (1 vCPU, 1 ГБ памяти) с Debian 12 или Ubuntu 24.04 в одной частной сети и с метками `trainer=devops` и `dt-track=linux-access`. Назовите их `laptop` и `server`. Экзамен длится меньше часа, и в своём облаке он обойдётся в стоимость двух самых дешёвых машин за час. Введите частный адрес `server`, потому что он нужен скрипту подготовки на `laptop`.',
      'You need two smallest machines (1 vCPU, 1 GB of memory) with Debian 12 or Ubuntu 24.04 in one private network and with the labels `trainer=devops` and `dt-track=linux-access`. Name them `laptop` and `server`. The exam takes less than an hour, and in your own cloud it costs as much as the two cheapest machines for an hour. Enter `server`’s private address, because the setup script on `laptop` needs it.',
    ),
    machines: [
      { id: 'server', role: bi('сервер команды', 'the team’s server'), dtlab: 'cp-1', collect: ['--scope sshd', '--scope sudoers', '--sudo-l maria', `--file ${MARIA_SSH}`, `--file ${MARIA_SSH}/authorized_keys`, '--file /srv/releases'] },
      { id: 'laptop', role: bi('ноутбук Марии', 'Maria’s laptop'), dtlab: 'learner', collect: [`--file ${MARIA_SSH}/known_hosts`, '--ssh keyin,maria,server'] },
    ],
    dtlabUp: 'dtlab up --with learner,kubeadm-nodes',
    dtlabNote: bi('Вместе с ними запустится и машина `worker-1`, потому что узлы kubeadm лаборатория запускает вместе. Экзамену она не нужна, её можно не трогать.', 'The VM `worker-1` starts with them, because the lab starts the kubeadm nodes together. The exam does not use it, so leave it alone.'),
    prepare: [
      { name: 'access-server.sh', on: 'server', note: bi('Скрипт заводит группу `devs` с разработчиком `alex`, службу `orders` и вход по паролю через SSH, как на многих старых серверах.', 'The script sets up the group `devs` with the developer `alex`, the `orders` service and SSH password login, as on many old servers.'), text: accessServer },
      { name: 'access-laptop.sh', on: 'laptop', note: bi('Скрипт заводит учётную запись `maria` без ключей и записывает имя `server` в `/etc/hosts`. Запустите его с адресом сервера: `sudo bash access-laptop.sh АДРЕС`.', 'The script creates the account `maria` without keys and writes the name `server` into `/etc/hosts`. Run it with the server’s address: `sudo bash access-laptop.sh ADDRESS`.'), text: accessLaptop },
    ],
  },
  explain: [
    {
      id: 'e1',
      prompt: bi('Коллега спрашивает: «В каком порядке вы выключали вход по паролю и почему именно в таком?»', 'A colleague asks: “In what order did you switch password logins off, and why in that order?”'),
      keyPoints: [
        bi('сначала проверить вход по ключу в отдельном сеансе', 'first check the key login in a separate session'),
        bi('выполнить `sshd -t` до того, как перечитать настройки, чтобы ошибка не остановила службу', 'run `sshd -t` before rereading the settings, so that a mistake does not stop the service'),
        bi('выполнить `reload`, а не `restart`, и держать сеанс открытым до проверки', 'run `reload`, not `restart`, and keep a session open until the check'),
        bi('итог проверить в `sshd -T`, потому что выигрывает первое значение из `sshd_config.d`', 'check the result in `sshd -T`, because the first value from `sshd_config.d` wins'),
      ],
    },
    {
      id: 'e2',
      prompt: bi('«Почему Марии не выдали права всей группы `sudo`?»', '“Why was Maria not simply given the `sudo` group?”'),
      keyPoints: [
        bi('по принципу наименьших прав сотруднику дают только то, что нужно для работы', 'by the principle of least privilege a person gets only what the work needs'),
        bi('правило `systemctl restart orders` в sudoers не даёт ни оболочки root, ни чтения `/etc/shadow`', 'the rule `systemctl restart orders` in sudoers gives neither a root shell nor reading `/etc/shadow`'),
        bi('правило лежит в отдельном файле в `/etc/sudoers.d` и проверено командой `visudo -c`', 'the rule sits in a separate file in `/etc/sudoers.d` and is checked with `visudo -c`'),
      ],
    },
  ],
  tasks: [
    {
      id: 'login',
      weight: 20,
      critical: true,
      kind: 'real',
      real: {
        prompt: bi('Заведите на `server` учётную запись `maria` с оболочкой `/bin/bash` в группе `devs` и настройте ей вход с `laptop` по ключу, чтобы `ssh server` от имени `maria` пускал без вопросов.', 'Create the account `maria` on `server` with the shell `/bin/bash` in the group `devs` and set up key login for her from `laptop`, so that `ssh server` as `maria` lets her in without questions.'),
        concepts: ['linux.ssh-key', 'linux.user', 'linux.group', 'linux.mode'],
        goals: [
          G('user', ['на `server` есть пользователь `maria` с `/bin/bash` в группе `devs`', '`server` has the user `maria` with `/bin/bash` in the group `devs`'], 'server', "users[name=maria].shell='/bin/bash' && users[name=maria].groupNames has devs"),
          G('sshdir', ['каталог `~/.ssh` Марии закрыт от группы и остальных', 'Maria’s `~/.ssh` is closed to the group and others'], 'server', `files['${MARIA_SSH}'].owner=maria && files['${MARIA_SSH}'].perm.g='---' && files['${MARIA_SSH}'].perm.o='---'`),
          G('keys', ['файл `authorized_keys` Марии не может менять никто, кроме неё', 'nobody but Maria can change her `authorized_keys`'], 'server', (f) => { const k = file(f, `${MARIA_SSH}/authorized_keys`); return !!k && k.owner === 'maria' && noWrite(k.perm) && /^(ssh-|ecdsa-)/m.test(k.text ?? ''); }, [{ if: (f) => !!file(f, `${MARIA_SSH}/authorized_keys`) && !noWrite(file(f, `${MARIA_SSH}/authorized_keys`)?.perm), say: bi('Файл ключей доступен на запись группе или остальным, а sshd в режиме StrictModes такой файл не читает.', 'The key file is writable by the group or others, and sshd in StrictModes does not read such a file.') }]),
          G('known', ['`laptop` знает ключ хоста `server`', '`laptop` knows `server`’s host key'], 'laptop', `files['${MARIA_SSH}/known_hosts'].exists=true`),
          G('keyin', ['`maria` входит с `laptop` на `server` по ключу', '`maria` logs in from `laptop` to `server` with her key'], 'laptop', "reach['keyin'].exit=0", [{ if: "reach['keyin'].exit=255", say: bi('SSH отказал во входе, потому что сервер не принял ключ или ключ хоста неизвестен. Подключитесь один раз вручную от имени `maria` и посмотрите вывод `ssh -v server`.', 'SSH refused the login, because the server did not accept the key or the host key is unknown. Connect once by hand as `maria` and look at the output of `ssh -v server`.') }]),
        ],
      },
    },
    {
      id: 'releases',
      weight: 25,
      kind: 'real',
      real: {
        prompt: bi('Создайте на `server` каталог `/srv/releases`, в который команда `devs` может писать и из которого может читать, а остальные не могут. Каждый новый файл в нём должен сразу принадлежать группе `devs`, кто бы его ни создал.', 'Create `/srv/releases` on `server`, which the `devs` team can write to and read from and others cannot. Every new file in it must belong to the group `devs` at once, whoever creates it.'),
        concepts: ['linux.group', 'linux.mode'],
        goals: [
          G('group', ['каталог `/srv/releases` принадлежит группе `devs`, и у группы есть права `rwx`', '`/srv/releases` belongs to the group `devs`, and the group has `rwx`'], 'server', "files['/srv/releases'].type=d && files['/srv/releases'].group=devs && files['/srv/releases'].perm.g=rwx"),
          G('others', ['остальным каталог закрыт', 'the directory is closed to others'], 'server', "files['/srv/releases'].perm.o='---'"),
          G('setgid', ['новые файлы получают группу каталога', 'new files get the directory’s group'], 'server', "files['/srv/releases'].perm.setgid=true", [{ if: "files['/srv/releases'].perm.setgid=false", say: bi('Без особого бита новый файл получит основную группу того, кто его создал. Посмотрите на странице `man chmod`, какой бит у каталога меняет это правило.', 'Without a special bit a new file gets the primary group of whoever created it. Look in `man chmod` for the directory bit that changes this rule.') }]),
        ],
      },
    },
    {
      id: 'sudo',
      weight: 20,
      critical: true,
      kind: 'real',
      real: {
        prompt: bi('Разрешите `maria` перезапускать службу `orders` через sudo без пароля и не разрешайте ей больше ничего от имени root. Пароля у неё нет, потому что она входит по ключу.', 'Allow `maria` to restart the `orders` service through sudo without a password, and allow her nothing else as root. She has no password, because she logs in with a key.'),
        concepts: ['linux.sudo', 'linux.root'],
        goals: [
          G('rule', ['`sudo -l` для `maria` показывает только перезапуск `orders`', '`sudo -l` for `maria` shows only restarting `orders`'], 'server', (f) => sudoNarrow(sudoL(f, 'maria')), [
            { if: (f) => /\)\s*(NOPASSWD:\s*)?ALL\s*$/m.test(sudoL(f, 'maria')), say: bi('У `maria` полный sudo, скорее всего через группу `sudo` или `wheel`, а ей нужна одна разрешённая команда.', '`maria` has full sudo, most likely through the `sudo` or `wheel` group, while she needs one allowed command.') },
            { if: (f) => /systemctl restart orders/.test(sudoL(f, 'maria')) && !/NOPASSWD/.test(sudoL(f, 'maria')), say: bi('Правило есть, но sudo спросит пароль, которого у `maria` нет.', 'The rule is there, but sudo will ask for a password `maria` does not have.') },
          ]),
          G('parse', ['файлы sudoers не содержат ошибок', 'the sudoers files have no mistakes'], 'server', 'sudoers.ok=true'),
        ],
      },
    },
    {
      id: 'nopass',
      weight: 20,
      kind: 'real',
      real: {
        prompt: bi('Запретите на `server` вход по паролю для всех, не потеряв при этом входа по ключу. Сервер не должен предлагать пароль ни в каком виде.', 'Switch off password login on `server` for everyone without losing key login. The server must not offer a password in any form.'),
        concepts: ['linux.ssh-key'],
        goals: [
          G('pw', ['итоговые настройки sshd содержат `passwordauthentication no`', 'sshd’s final settings contain `passwordauthentication no`'], 'server', "sshd.passwordauthentication=no", [{ if: "sshd.passwordauthentication=yes", say: bi('`sshd -T` всё ещё показывает yes. Настройки читаются и из файлов `/etc/ssh/sshd_config.d/*.conf`, и выигрывает первое найденное значение.', '`sshd -T` still shows yes. Settings are also read from `/etc/ssh/sshd_config.d/*.conf`, and the first value found wins.') }]),
          G('kbd', ['и содержат `kbdinteractiveauthentication no`', 'and contain `kbdinteractiveauthentication no`'], 'server', "sshd.kbdinteractiveauthentication=no", [{ if: "sshd.passwordauthentication=no && sshd.kbdinteractiveauthentication=yes", say: bi('Вход по паролю выключен, но вход «с клавиатуры» через PAM по-прежнему спросит тот же пароль.', 'Password login is off, but “keyboard-interactive” login through PAM still asks for the same password.') }]),
          G('offer', ['`laptop` не видит у `server` способов войти по паролю', '`laptop` sees no password login methods on `server`'], 'laptop', (f) => { const m = probe(f, 'keyin')?.methods ?? ''; return /Authentications that can continue/.test(m) && !/password|keyboard-interactive/.test(m); }),
          G('still', ['Мария по-прежнему входит по ключу', 'Maria still logs in with her key'], 'laptop', "reach['keyin'].exit=0"),
        ],
      },
    },
    {
      id: 'allowgroups',
      weight: 10,
      beyond: true,
      kind: 'real',
      real: {
        prompt: bi('По SSH на `server` должны пускать только участников группы `devs`. В курсе такой директивы не было, поэтому найдите её на странице `man sshd_config` и позаботьтесь о том, чтобы не закрыть дверь перед собой.', 'SSH on `server` must let in only members of the group `devs`. The course had no such directive, so find it in `man sshd_config`, and take care not to shut the door on yourself.'),
        concepts: ['linux.group'],
        goals: [
          G('groups', ['итоговые настройки sshd пускают группу `devs`', 'sshd’s effective settings let the group `devs` in'], 'server', (f) => /(^|\s)devs(\s|$)/.test(sshd(f).allowgroups ?? '')),
          G('still', ['Мария по-прежнему входит', 'Maria still gets in'], 'laptop', "reach['keyin'].exit=0"),
        ],
        solutionTokens: ['AllowGroups'],
      },
    },
    {
      id: 'cleanup',
      weight: 5,
      critical: true,
      kind: 'real',
      real: {
        prompt: bi('Уборка. Удалите обе машины и вставьте подтверждение. Если вы работали в лаборатории dtlab, выполните на своём компьютере `dtlab destroy`, подтвердите удаление ответом `y` и вставьте всё, что напечатала команда. Если машины заказывали через Terraform, вставьте вывод `terraform destroy`, а если заказывали в облаке вручную, вставьте список машин с меткой `dt-track=linux-access` в формате JSON, то есть `[]`.', 'Clean-up. Delete both machines and paste a confirmation. If you worked in the dtlab lab, run `dtlab destroy` on your computer, confirm the deletion with `y` and paste everything the command printed. If you ordered the machines with Terraform, paste the output of `terraform destroy`; if you ordered them in your cloud by hand, paste the list of machines labelled `dt-track=linux-access` as JSON, that is, `[]`.'),
        paste: { label: bi('Подтверждение уборки', 'The cleanup confirmation'), accept: CLEANUP_ACCEPT },
      },
    },
  ],
};
