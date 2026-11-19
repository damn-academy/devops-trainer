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

const CLEANUP_ACCEPT = [/Destroy complete! Resources: [1-9]\d* destroyed/, /No resources found/, /^\s*\[\s*\]\s*$/];

// ── linux.exam.disk ──

const SHOP = '/srv/shop';
const ORDERS = '/srv/shop/lib/orders';
const dataIntact = (f: Facts) => !!tree(f, ORDERS) && tree(f, ORDERS) === text(f, '/var/lib/dt-trainer/disk.start').trim();
/** The cron line is gone or every non-empty line of the file is a comment. */
const cronOff = (f: Facts) => !file(f, '/etc/cron.d/legacy-dump') || text(f, '/etc/cron.d/legacy-dump').split('\n').every((l) => !l.trim() || /^\s*#/.test(l));

export const DISK_EXAM: Exam = {
  id: 'linux.exam.disk',
  block: 'linux',
  title: bi('Учебный экзамен: раздел заполнен', 'Learning exam: the partition is full'),
  intro: bi(
    'Учебная контрольная после модуля о дисках и файловых системах, на вашей собственной машине: тренажёр там ничего не выполняет. Скрипт подготовки создаёт раздел магазина и наполняет его так, как наполняются настоящие серверы, а скрипт проверки только читает состояние. Засчитывается результат, путь к нему может быть любым. Открыта документация машины: `man`, `--help` и страницы systemd.',
    'A learning check after the module on disks and file systems, on your own machine: the trainer runs nothing there. The preparation script creates the shop’s partition and fills it the way real servers fill up, and the check script only reads the state. The result counts; any path to it is fine. The machine’s documentation is open: `man`, `--help` and the systemd pages.',
  ),
  story: bi(
    'Мониторинг сообщает: на сервере магазина раздел `/srv/shop` заполнен на 100 %, приложение заказов перестало писать. Освободите место, не потеряв данных магазина в `/srv/shop/lib/orders`, и сделайте так, чтобы через неделю всё не повторилось. Кэш сборки и временные файлы старых задач можно удалять. Агент `legacy-agent` ещё нужен отчётности.',
    'Monitoring reports: on the shop’s server the partition `/srv/shop` is 100% full, and the orders application stopped writing. Free space without losing the shop’s data in `/srv/shop/lib/orders`, and make sure it does not happen again in a week. The build cache and the temporary files of old jobs may be deleted. The `legacy-agent` is still needed by reporting.',
  ),
  minutes: 35,
  pass: 0.7,
  allowedDocs: ['man', 'help'],
  real: {
    track: 'linux-disk',
    order: bi(
      'Одна самая маленькая машина (1 vCPU, 1 ГБ памяти, диск от 5 ГБ) с Debian 12 или Ubuntu 24.04 и входом по SSH, с метками `trainer=devops` и `dt-track=linux-disk`. Экзамен идёт около получаса: в своём облаке это стоимость самой дешёвой машины за час. Адрес машины для этого экзамена не нужен.',
      'One of the smallest machines (1 vCPU, 1 GB of memory, a disk from 5 GB) with Debian 12 or Ubuntu 24.04 and SSH access, with the labels `trainer=devops` and `dt-track=linux-disk`. The exam takes about half an hour: in your own cloud that is the price of the cheapest machine for an hour. The machine’s address is not needed for this exam.',
    ),
    machines: [
      {
        id: 'app-01',
        role: bi('сервер магазина', 'the shop’s server'),
        collect: ['--scope mounts', '--scope journald', `--tree ${ORDERS}`, '--file /var/lib/dt-trainer/disk.start', '--file /etc/cron.d/legacy-dump', '--file /etc/logrotate.d/legacy', '--logrotate /etc/logrotate.d/legacy', '--unit orders.service', '--unit legacy-agent.service'],
      },
    ],
    prepare: [{ name: 'disk-plant.sh', on: 'app-01', note: bi('Раздел магазина на 160 МБ в файле-образе, смонтированный в `/srv/shop`, две службы, задание cron и снимок данных для проверки. Системные разделы он не трогает.', 'The shop’s 160 MB partition in an image file, mounted at `/srv/shop`, two services, a cron job and a fingerprint of the data for the check. It does not touch the system partitions.'), text: diskPlant }],
  },
  explain: [
    {
      id: 'e1',
      prompt: bi('Тимлид спрашивает: «`du` по всему разделу насчитал меньше половины, а `df` говорит, что он полон. Как такое бывает и как вы нашли, где место?»', 'The team lead asks: “`du` over the whole partition counted less than half, and `df` says it is full. How does that happen, and how did you find where the space is?”'),
      keyPoints: [
        bi('`du` считает файлы по именам, `df` — занятые блоки файловой системы', '`du` counts files by name, `df` the used blocks of the file system'),
        bi('удалённый файл живёт, пока его держит открытым процесс', 'a deleted file lives while a process holds it open'),
        bi('такие файлы видны в `lsof +L1` или в `/proc/PID/fd` с пометкой deleted', 'such files show in `lsof +L1` or in `/proc/PID/fd` marked deleted'),
        bi('место возвращает перезапуск процесса или обрезка файла через его дескриптор', 'restarting the process or truncating the file through its descriptor gives the space back'),
      ],
    },
    {
      id: 'e2',
      prompt: bi('«Что вы напишете в разборе, чтобы через неделю это не повторилось?»', '“What will you write in the post-mortem so that this does not happen again in a week?”'),
      keyPoints: [
        bi('кто писал на раздел и с какой скоростью: дампы cron и журнал агента', 'who wrote to the partition and how fast: the cron dumps and the agent’s log'),
        bi('ротация журналов с ограничением по числу и размеру', 'log rotation with a limit on count and size'),
        bi('предупреждение мониторинга задолго до 100 %', 'a monitoring warning well before 100%'),
        bi('не удалять открытые журналы, а ротировать с `copytruncate` или сигналом', 'do not delete open logs; rotate them with `copytruncate` or a signal'),
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
        prompt: bi('Карточка 1. Освободите на `/srv/shop` не меньше 40 мебибайт. Данные заказов должны остаться в точности такими, как были, а приложение — работать.', 'Card 1. Free at least 40 MiB on `/srv/shop`. The orders data must stay exactly as it was, and the application must keep running.'),
        concepts: ['linux.filesystem', 'linux.inode', 'linux.mount', 'linux.process'],
        goals: [
          G('space', ['на `/srv/shop` свободно не меньше 40 МиБ', '`/srv/shop` has at least 40 MiB free'], 'app-01', (f) => (mount(f, SHOP)?.free ?? 0) >= 40 * MiB, [
            { if: (f) => { const m = mount(f, SHOP); return !!m && m.free >= 20 * MiB && m.free < 40 * MiB; }, say: bi('Кэш и временные файлы удалены, но этого мало. `df` и `du` расходятся: место держит что-то, чего не видно по именам.', 'The cache and temporary files are gone, but that is not enough. `df` and `du` disagree: something holds space that names do not show.') },
            { if: (f) => !mount(f, SHOP), say: bi('Раздел `/srv/shop` не смонтирован. Он описан в `/etc/fstab`.', 'The partition `/srv/shop` is not mounted. It is described in `/etc/fstab`.') },
          ]),
          G('data', ['данные заказов целы', 'the orders data is intact'], 'app-01', dataIntact, [{ if: (f) => !!tree(f, ORDERS) && !dataIntact(f), say: bi('Данные в `/srv/shop/lib/orders` изменились: так место освобождать нельзя.', 'The data in `/srv/shop/lib/orders` has changed: that is not a way to free space.') }]),
          G('app', ['приложение заказов работает', 'the orders application is running'], 'app-01', (f) => unitActive(f, 'orders.service')),
        ],
      },
    },
    {
      id: 'cron',
      weight: 15,
      kind: 'real',
      real: {
        prompt: bi('Карточка 2. Найдите, кто продолжает заполнять раздел, и остановите это так, чтобы оно не вернулось после перезагрузки.', 'Card 2. Find who keeps filling the partition and stop it so that it does not come back after a reboot.'),
        concepts: ['linux.cron'],
        goals: [G('cron', ['задание, которое пишет дампы, выключено', 'the job that writes the dumps is off'], 'app-01', cronOff)],
      },
    },
    {
      id: 'rotate',
      weight: 20,
      kind: 'real',
      real: {
        prompt: bi('Карточка 3. У журналов `legacy-agent` в `/srv/shop/log/legacy/*.log` нет ротации. Добавьте правило в `/etc/logrotate.d/legacy`: хранить не больше пяти старых журналов, сжимать их, не трогать пустые; агент открывает журнал один раз и не умеет открывать его заново.', 'Card 3. The `legacy-agent` logs in `/srv/shop/log/legacy/*.log` have no rotation. Add a rule in `/etc/logrotate.d/legacy`: keep no more than five old logs, compress them, leave empty ones alone; the agent opens its log once and cannot reopen it.'),
        concepts: ['linux.journal'],
        goals: [
          G('pattern', ['logrotate видит правило для `/srv/shop/log/legacy/*.log`', 'logrotate sees a rule for `/srv/shop/log/legacy/*.log`'], 'app-01', (f) => /rotating pattern: \/srv\/shop\/log\/legacy\/\*\.log/.test(((f.logrotate ?? {}) as Record<string, string>)['/etc/logrotate.d/legacy'] ?? ''), [{ if: (f) => /error/i.test(((f.logrotate ?? {}) as Record<string, string>)['/etc/logrotate.d/legacy'] ?? ''), say: bi('logrotate нашёл в правиле ошибку: посмотрите вывод `logrotate -d /etc/logrotate.d/legacy`.', 'logrotate found an error in the rule: look at the output of `logrotate -d /etc/logrotate.d/legacy`.') }]),
          G('keep', ['хранится не больше пяти журналов, они сжимаются', 'no more than five logs are kept, and they are compressed'], 'app-01', (f) => { const r = text(f, '/etc/logrotate.d/legacy'); const n = /^\s*rotate\s+(\d+)/m.exec(r); return !!n && Number(n[1]) <= 5 && /^\s*compress\b/m.test(r) && /^\s*notifempty\b/m.test(r); }),
          G('truncate', ['ротация не отнимает у агента его открытый журнал', 'rotation does not take the open log away from the agent'], 'app-01', (f) => /^\s*copytruncate\b/m.test(text(f, '/etc/logrotate.d/legacy')), [{ if: (f) => !!text(f, '/etc/logrotate.d/legacy') && !/copytruncate/.test(text(f, '/etc/logrotate.d/legacy')), say: bi('Без особого режима logrotate переименует журнал, а агент продолжит писать в старый файл — тот самый, что съел раздел. В `man logrotate` есть режим для программ, которые не умеют открывать журнал заново.', 'Without a special mode logrotate renames the log, and the agent keeps writing into the old file — the very one that ate the partition. `man logrotate` has a mode for programs that cannot reopen their log.') }]),
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
          { id: 'open', text: bi('`rm` убрал имя, а агент держит файл открытым: inode и данные живут, пока он его не закроет', '`rm` removed the name, but the agent holds the file open: the inode and the data live until it closes it'), correct: true },
          { id: 'cache', text: bi('Ядро освобождает место не сразу, а при следующей проверке файловой системы', 'The kernel frees the space later, at the next file system check'), why: bi('Блоки закрытого и удалённого файла возвращаются сразу; ждать fsck не нужно.', 'The blocks of a closed, deleted file come back at once; there is no waiting for fsck.') },
          { id: 'trash', text: bi('Файл попал в корзину, её нужно очистить', 'The file went to the trash, which must be emptied'), why: bi('У `rm` нет корзины: это понятие графических файловых менеджеров.', '`rm` has no trash: that is a concept of graphical file managers.') },
        ],
        explain: bi('Имя в каталоге — только ссылка на inode. Пока на файл ссылается хоть одно имя или открытый дескриптор, его блоки заняты. `du` идёт по именам и такого файла не видит, `df` считает блоки и видит.', 'A name in a directory is only a link to an inode. While at least one name or open descriptor refers to a file, its blocks stay used. `du` walks the names and does not see such a file; `df` counts blocks and does.'),
      },
    },
    {
      id: 'journal',
      weight: 15,
      beyond: true,
      kind: 'real',
      real: {
        prompt: bi('Карточка 4. Журнал systemd на этом сервере не должен занимать больше 50 мегабайт. Как это задать, в курсе не показано: ищите в `man journald.conf`.', 'Card 4. The systemd journal on this server must not take more than 50 megabytes. How to set it was not shown in the course: look in `man journald.conf`.'),
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
        prompt: bi('Уборка. Удалите машину и вставьте подтверждение: вывод `terraform destroy`; в тенанте курса — `kubectl get vm -l dt-track=linux-disk`; в своём облаке — список машин по метке `dt-track=linux-disk` в JSON, то есть `[]`.', 'Cleanup. Delete the machine and paste the confirmation: the output of `terraform destroy`; in the course tenant, `kubectl get vm -l dt-track=linux-disk`; in your own cloud, the list of machines with the label `dt-track=linux-disk` as JSON, that is, `[]`.'),
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
  title: bi('Учебный экзамен: доступ для новой разработчицы', 'Learning exam: access for a new developer'),
  intro: bi(
    'Учебная контрольная после модуля о сети машины и SSH, на двух ваших машинах: `laptop` — рабочий ноутбук Марии, `server` — сервер команды. Тренажёр там ничего не выполняет; скрипты подготовки заводят то, что на таком сервере обычно уже есть, а скрипт проверки только читает. Консоль провайдера остаётся у вас на случай, если вход по SSH закроется. Открыта документация машины: `man` и `--help`.',
    'A learning check after the module on the machine’s network and SSH, on two of your machines: `laptop` is Maria’s work laptop, `server` the team’s server. The trainer runs nothing there; the preparation scripts set up what such a server usually already has, and the check script only reads. The provider’s console stays with you in case the SSH way in closes. The machine’s documentation is open: `man` and `--help`.',
  ),
  story: bi(
    'В команду пришла разработчица Мария. Ей нужен вход на `server` по ключу, общий с командой каталог для выкладки `/srv/releases`, где новые файлы сразу принадлежат группе `devs`, и право перезапускать службу `orders` — и только её, без полного sudo. Вход по паролю пора запретить для всех, а по SSH пускать только группу `devs`.',
    'A developer, Maria, has joined the team. She needs a key login to `server`, a directory for releases shared with the team, `/srv/releases`, where new files belong to the group `devs` right away, and the right to restart the `orders` service — that one only, without full sudo. Password logins must be switched off for everyone, and SSH must let in only the group `devs`.',
  ),
  minutes: 40,
  pass: 0.7,
  allowedDocs: ['man', 'help'],
  real: {
    track: 'linux-access',
    order: bi(
      'Две самые маленькие машины (1 vCPU, 1 ГБ памяти) с Debian 12 или Ubuntu 24.04 в одной частной сети, с метками `trainer=devops` и `dt-track=linux-access`; назовите их `laptop` и `server`. Экзамен идёт меньше часа: в своём облаке это стоимость двух самых дешёвых машин за час. Введите частный адрес `server`: он нужен скрипту подготовки на `laptop`.',
      'Two of the smallest machines (1 vCPU, 1 GB of memory) with Debian 12 or Ubuntu 24.04 in one private network, with the labels `trainer=devops` and `dt-track=linux-access`; name them `laptop` and `server`. The exam takes less than an hour: in your own cloud that is the price of the two cheapest machines for an hour. Type the private address of `server`: the preparation script on `laptop` needs it.',
    ),
    machines: [
      { id: 'server', role: bi('сервер команды', 'the team’s server'), collect: ['--scope sshd', '--scope sudoers', '--sudo-l maria', `--file ${MARIA_SSH}`, `--file ${MARIA_SSH}/authorized_keys`, '--file /srv/releases'] },
      { id: 'laptop', role: bi('ноутбук Марии', 'Maria’s laptop'), collect: [`--file ${MARIA_SSH}/known_hosts`, '--ssh keyin,maria,server'] },
    ],
    prepare: [
      { name: 'access-server.sh', on: 'server', note: bi('Группа `devs` с разработчиком `alex`, служба `orders` и вход по паролю через SSH, как на многих старых серверах.', 'The group `devs` with the developer `alex`, the `orders` service and password logins over SSH, as on many old servers.'), text: accessServer },
      { name: 'access-laptop.sh', on: 'laptop', note: bi('Учётная запись `maria` без ключей и имя `server` в `/etc/hosts`. Запустите с адресом сервера: `sudo bash access-laptop.sh АДРЕС`.', 'The account `maria` without keys and the name `server` in `/etc/hosts`. Run it with the server’s address: `sudo bash access-laptop.sh ADDRESS`.'), text: accessLaptop },
    ],
  },
  explain: [
    {
      id: 'e1',
      prompt: bi('Коллега спрашивает: «В каком порядке вы выключали вход по паролю и почему именно в таком?»', 'A colleague asks: “In what order did you switch password logins off, and why in that order?”'),
      keyPoints: [
        bi('сначала проверить вход по ключу в отдельном сеансе', 'first check the key login in a separate session'),
        bi('`sshd -t` до перезагрузки настроек: ошибка не уронит службу', '`sshd -t` before reloading the settings: a mistake does not bring the service down'),
        bi('`reload`, а не `restart`, и открытый сеанс до проверки', '`reload`, not `restart`, and an open session until the check'),
        bi('итог смотрят в `sshd -T`: первое значение из `sshd_config.d` выигрывает', 'the result is read from `sshd -T`: the first value from `sshd_config.d` wins'),
      ],
    },
    {
      id: 'e2',
      prompt: bi('«Почему Марии не дали просто группу `sudo`?»', '“Why did Maria not simply get the group `sudo`?”'),
      keyPoints: [
        bi('принцип наименьших прав: только то, что нужно для работы', 'least privilege: only what the work needs'),
        bi('`systemctl restart orders` в sudoers не даёт ни оболочки root, ни чтения `/etc/shadow`', '`systemctl restart orders` in sudoers gives neither a root shell nor reading `/etc/shadow`'),
        bi('правило в отдельном файле `/etc/sudoers.d` и проверка `visudo -c`', 'the rule in its own file in `/etc/sudoers.d`, checked with `visudo -c`'),
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
        prompt: bi('Карточка 1. Заведите Марии на `server` учётную запись `maria` с оболочкой `/bin/bash` в группе `devs` и настройте ей вход с `laptop` по ключу: `ssh server` от имени `maria` должен пускать без вопросов.', 'Card 1. Create Maria’s account `maria` on `server` with the shell `/bin/bash` in the group `devs`, and set up her key login from `laptop`: `ssh server` as `maria` must let her in without questions.'),
        concepts: ['linux.ssh-key', 'linux.user', 'linux.group', 'linux.mode'],
        goals: [
          G('user', ['на `server` есть `maria` с `/bin/bash` в группе `devs`', '`server` has `maria` with `/bin/bash` in the group `devs`'], 'server', "users[name=maria].shell='/bin/bash' && users[name=maria].groupNames has devs"),
          G('sshdir', ['`~/.ssh` Марии закрыт от группы и остальных', 'Maria’s `~/.ssh` is closed to the group and others'], 'server', `files['${MARIA_SSH}'].owner=maria && files['${MARIA_SSH}'].perm.g='---' && files['${MARIA_SSH}'].perm.o='---'`),
          G('keys', ['`authorized_keys` Марии не может менять никто, кроме неё', 'nobody but Maria can change her `authorized_keys`'], 'server', (f) => { const k = file(f, `${MARIA_SSH}/authorized_keys`); return !!k && k.owner === 'maria' && noWrite(k.perm) && /^(ssh-|ecdsa-)/m.test(k.text ?? ''); }, [{ if: (f) => !!file(f, `${MARIA_SSH}/authorized_keys`) && !noWrite(file(f, `${MARIA_SSH}/authorized_keys`)?.perm), say: bi('Файл ключей доступен на запись группе или остальным: sshd в режиме StrictModes такой файл не читает.', 'The keys file is writable by the group or others: sshd in StrictModes does not read such a file.') }]),
          G('known', ['`laptop` знает ключ `server`', '`laptop` knows `server`’s key'], 'laptop', `files['${MARIA_SSH}/known_hosts'].exists=true`),
          G('keyin', ['`maria` входит с `laptop` на `server` по ключу', '`maria` logs in from `laptop` to `server` with her key'], 'laptop', "reach['keyin'].exit=0", [{ if: "reach['keyin'].exit=255", say: bi('SSH отказал: сервер не принял ключ или неизвестен ключ хоста. Подключитесь один раз вручную как `maria` и посмотрите `ssh -v server`.', 'SSH refused: the server did not accept the key, or the host key is unknown. Connect once by hand as `maria` and look at `ssh -v server`.') }]),
        ],
      },
    },
    {
      id: 'releases',
      weight: 25,
      kind: 'real',
      real: {
        prompt: bi('Карточка 2. Сделайте на `server` каталог `/srv/releases`: команда `devs` читает и пишет в него, остальные — нет, а каждый новый файл в нём сразу принадлежит группе `devs`, кто бы его ни создал.', 'Card 2. Make the directory `/srv/releases` on `server`: the team `devs` reads and writes in it, others do not, and every new file in it belongs to the group `devs` right away, whoever creates it.'),
        concepts: ['linux.group', 'linux.mode'],
        goals: [
          G('group', ['`/srv/releases` принадлежит группе `devs`, у группы `rwx`', '`/srv/releases` belongs to the group `devs`, the group has `rwx`'], 'server', "files['/srv/releases'].type=d && files['/srv/releases'].group=devs && files['/srv/releases'].perm.g=rwx"),
          G('others', ['остальным каталог закрыт', 'the directory is closed to others'], 'server', "files['/srv/releases'].perm.o='---'"),
          G('setgid', ['новые файлы наследуют группу каталога', 'new files inherit the directory’s group'], 'server', "files['/srv/releases'].perm.setgid=true", [{ if: "files['/srv/releases'].perm.setgid=false", say: bi('Без особого бита новый файл получит основную группу того, кто его создал. Посмотрите в `man chmod`, какой бит у каталога меняет это правило.', 'Without a special bit a new file gets its creator’s primary group. See in `man chmod` which bit of a directory changes that rule.') }]),
        ],
      },
    },
    {
      id: 'sudo',
      weight: 20,
      critical: true,
      kind: 'real',
      real: {
        prompt: bi('Карточка 3. Разрешите `maria` перезапускать службу `orders` через sudo без пароля — и больше ничего от имени root. Пароля у неё нет: она входит по ключу.', 'Card 3. Let `maria` restart the `orders` service through sudo without a password — and nothing else as root. She has no password: she logs in with a key.'),
        concepts: ['linux.sudo', 'linux.root'],
        goals: [
          G('rule', ['`sudo -l` для `maria` показывает только перезапуск `orders`', '`sudo -l` for `maria` shows only restarting `orders`'], 'server', (f) => sudoNarrow(sudoL(f, 'maria')), [
            { if: (f) => /\)\s*(NOPASSWD:\s*)?ALL\s*$/m.test(sudoL(f, 'maria')), say: bi('У `maria` полный sudo — скорее всего, через группу `sudo` или `wheel`. Ей нужен один разрешённый вызов.', '`maria` has full sudo — most likely through the group `sudo` or `wheel`. She needs one allowed command.') },
            { if: (f) => /systemctl restart orders/.test(sudoL(f, 'maria')) && !/NOPASSWD/.test(sudoL(f, 'maria')), say: bi('Правило есть, но sudo спросит пароль, которого у `maria` нет.', 'The rule is there, but sudo will ask for a password `maria` does not have.') },
          ]),
          G('parse', ['файлы sudoers без ошибок', 'the sudoers files have no errors'], 'server', 'sudoers.ok=true'),
        ],
      },
    },
    {
      id: 'nopass',
      weight: 20,
      kind: 'real',
      real: {
        prompt: bi('Карточка 4. Запретите на `server` вход по паролю для всех, не потеряв входа по ключу. Сервер не должен предлагать пароль ни в каком виде.', 'Card 4. Switch password logins off on `server` for everyone without losing the key login. The server must not offer a password in any form.'),
        concepts: ['linux.ssh-key'],
        goals: [
          G('pw', ['итоговые настройки sshd: `passwordauthentication no`', 'sshd’s effective settings: `passwordauthentication no`'], 'server', "sshd.passwordauthentication=no", [{ if: "sshd.passwordauthentication=yes", say: bi('`sshd -T` всё ещё показывает yes. Настройки читаются и из `/etc/ssh/sshd_config.d/*.conf`, и первое найденное значение выигрывает.', '`sshd -T` still shows yes. Settings are read from `/etc/ssh/sshd_config.d/*.conf` too, and the first value found wins.') }]),
          G('kbd', ['и `kbdinteractiveauthentication no`', 'and `kbdinteractiveauthentication no`'], 'server', "sshd.kbdinteractiveauthentication=no", [{ if: "sshd.passwordauthentication=no && sshd.kbdinteractiveauthentication=yes", say: bi('Пароль выключен, но вход «с клавиатуры» через PAM по-прежнему спросит тот же пароль.', 'Passwords are off, but keyboard-interactive login through PAM still asks for the same password.') }]),
          G('offer', ['`laptop` не видит у `server` способов входа по паролю', '`laptop` sees no password methods on `server`'], 'laptop', (f) => { const m = probe(f, 'keyin')?.methods ?? ''; return /Authentications that can continue/.test(m) && !/password|keyboard-interactive/.test(m); }),
          G('still', ['вход Марии по ключу по-прежнему работает', 'Maria’s key login still works'], 'laptop', "reach['keyin'].exit=0"),
        ],
      },
    },
    {
      id: 'allowgroups',
      weight: 10,
      beyond: true,
      kind: 'real',
      real: {
        prompt: bi('Карточка 5. По SSH на `server` должны пускаться только члены группы `devs`. Директиву ищите в `man sshd_config`; в курсе её не было. Позаботьтесь, чтобы не закрыть дверь перед собой.', 'Card 5. SSH on `server` must let in only members of the group `devs`. Look for the directive in `man sshd_config`; the course did not show it. Take care not to shut the door on yourself.'),
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
        prompt: bi('Уборка. Удалите обе машины и вставьте подтверждение: вывод `terraform destroy`; в тенанте курса — `kubectl get vm -l dt-track=linux-access`; в своём облаке — список машин по метке `dt-track=linux-access` в JSON, то есть `[]`.', 'Cleanup. Delete both machines and paste the confirmation: the output of `terraform destroy`; in the course tenant, `kubectl get vm -l dt-track=linux-access`; in your own cloud, the list of machines with the label `dt-track=linux-access` as JSON, that is, `[]`.'),
        paste: { label: bi('Подтверждение уборки', 'The cleanup confirmation'), accept: CLEANUP_ACCEPT },
      },
    },
  ],
};
