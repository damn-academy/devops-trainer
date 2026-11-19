// The Linux block (route id `linux`, design 02): nineteen lessons from the
// terminal to how the kernel isolates and limits processes, six process
// explainers, the quiz bank, the placement check, the block exam and the lab
// programs of the simulated machine.

import { defineModule } from '../../core/define';
import { bi } from '../../core/i18n';
import type { Block, Exam, Facts, PlacementTask, ShellCommand } from '../../core/types';
import { fromModel } from '../../engine/explainer/render';
import { PACKAGED } from '../../engine/terminal/shell';
import { concepts } from './concepts';
import { LINUX_DOCS } from './docs';
import { batchExport, ISOLATION_EXAM } from './exam-isolation';
import { ACCESS_EXAM, DISK_EXAM } from './exam-real';
import { bootModel } from './explainers/boot';
import { execModel } from './explainers/exec';
import { isolationModel } from './explainers/isolation';
import { permModel } from './explainers/perm';
import { pipeModel } from './explainers/pipe';
import { restartModel } from './explainers/restart';
import { LESSONS_1 } from './lessons-1';
import { LESSONS_2 } from './lessons-2';
import { LESSONS_3 } from './lessons-3';
import { QUIZ } from './quiz';
import { BASH_MANUAL, DEBIAN_HANDBOOK, DEBIAN_HANDBOOK_RU, TLCL, man7, sources, wiki } from './shared';

const LESSONS = [...LESSONS_1, ...LESSONS_2, ...LESSONS_3];

/** `hello` — the program of the PATH lesson; it exists only in ~/bin of that lab. */
const hello: ShellCommand = {
  name: 'hello',
  summary: bi('учебная программа урока про PATH', 'the lab program of the PATH lesson'),
  help: 'Usage: hello\nPrint a greeting. A lab program of DevOps Trainer: it lives in ~/bin of the PATH lesson.',
  run(ctx) {
    ctx.out(`hello from ${ctx.argv[0].includes('/') ? ctx.argv[0] : '~/bin/hello'}\n`);
    return 0;
  },
};
PACKAGED.set('hello', 'lab');

const REPORT_BROKEN = {
  files: [
    { path: '/usr/local/bin/report', content: '#!/bin/bash\necho "report: started"\nexec sleep infinity\n', owner: 'root', mode: '0644' },
    { path: '/etc/systemd/system/report.service', content: '[Unit]\nDescription=Nightly sales report\n\n[Service]\nExecStart=/usr/local/bin/report\n\n[Install]\nWantedBy=multi-user.target\n', owner: 'root' },
  ],
  script: ['systemctl start report'],
};

const units = (f: Facts) => (f.units ?? {}) as Record<string, { active: string; enabled: string; props: Record<string, string> }>;

const placement: PlacementTask[] = [
  {
    id: 'linux.place.cd',
    level: 'intermediate',
    key: true,
    concepts: ['linux.abs-path'],
    kind: 'task',
    setup: { files: [{ path: '/home/anna/projects/site/index.html', content: 'x\n', owner: 'root' }], cwd: '/home/anna/projects/site' },
    task: { id: 'up2', prompt: bi('Вы в `/home/anna/projects/site`. Поднимитесь на два уровня выше и выведите путь, где оказались.', 'You are in `/home/anna/projects/site`. Go two levels up and print the path where you ended up.'), check: { when: "cwd='/home/anna'", stdout: /^\/home\/anna\n$/ } },
  },
  {
    id: 'linux.place.rm',
    level: 'intermediate',
    key: false,
    concepts: ['linux.argument'],
    kind: 'quiz',
    item: {
      id: 'linux.place.q.rm',
      kind: 'mcq',
      prompt: bi('Чем опасна строка `rm -rf ~ /old-project`?', 'What is dangerous about the line `rm -rf ~ /old-project`?'),
      options: [
        { id: 'space', text: bi('Из-за пробела аргументов два: удаляется весь домашний каталог', 'Because of the space there are two arguments: the whole home directory is deleted'), correct: true },
        { id: 'root', text: bi('Удалится корень системы', 'The root of the system is deleted'), why: bi('`/old-project` — отдельный каталог в корне, а не корень; и GNU rm отказывается удалять `/`.', '`/old-project` is a separate directory in the root, not the root; and GNU rm refuses to delete `/`.') },
        { id: 'safe', text: bi('Ничем: -f просто не задаёт вопросов', 'Nothing: -f just skips the questions'), why: bi('Главное здесь — лишний пробел после `~`.', 'The point here is the extra space after `~`.') },
      ],
    },
  },
  {
    id: 'linux.place.perm',
    level: 'intermediate',
    key: true,
    concepts: ['linux.mode', 'linux.group'],
    kind: 'quiz',
    item: {
      id: 'linux.place.q.perm',
      kind: 'mcq',
      prompt: bi('`-rw-r----- 1 anna dev 120 report.txt`. bob состоит в группе dev. Что он может?', '`-rw-r----- 1 anna dev 120 report.txt`. bob is in group dev. What can he do?'),
      options: [
        { id: 'read', text: bi('Прочитать, но не изменить', 'Read it but not change it'), correct: true },
        { id: 'write', text: bi('Прочитать и изменить', 'Read and change it'), why: bi('w есть только у владельца, anna; bob получает тройку группы r--.', 'Only the owner, anna, has w; bob gets the group triad r--.') },
        { id: 'nothing', text: bi('Ничего', 'Nothing'), why: bi('Ничего было бы у «остальных»; bob — в группе файла.', 'Nothing is what “others” get; bob is in the file’s group.') },
      ],
    },
  },
  {
    id: 'linux.place.wc',
    level: 'intermediate',
    key: false,
    concepts: ['linux.redirect'],
    kind: 'quiz',
    item: { id: 'linux.place.q.wc', kind: 'predict-output', prompt: bi('Что напечатает последняя команда?', 'What does the last command print?'), command: 'echo hello > f.txt; echo world >> f.txt; wc -l < f.txt' },
  },
  {
    id: 'linux.place.path',
    level: 'intermediate',
    key: true,
    concepts: ['linux.path-var'],
    kind: 'quiz',
    item: {
      id: 'linux.place.q.path',
      kind: 'mcq',
      prompt: bi('После `export PATH=/opt/bin` перестал находиться `ls`. Почему?', 'After `export PATH=/opt/bin`, `ls` is no longer found. Why?'),
      options: [
        { id: 'replace', text: bi('Список каталогов заменён целиком, /usr/bin выпал', 'The list of directories was replaced as a whole; /usr/bin dropped out'), correct: true },
        { id: 'perm', text: bi('У ls сняли права', 'ls lost its permissions'), why: bi('Права не менялись: `/usr/bin/ls` по полному пути работает.', 'Nothing changed in the permissions: `/usr/bin/ls` by its full path works.') },
      ],
    },
  },
  {
    id: 'linux.place.service',
    level: 'experienced',
    key: true,
    concepts: ['linux.systemd', 'linux.mode'],
    kind: 'task',
    setup: REPORT_BROKEN,
    task: {
      id: 'report',
      prompt: bi('`report.service` не стартует. Почините её так, чтобы она работала и запускалась при загрузке. Строку ExecStart не меняйте.', '`report.service` does not start. Fix it so that it runs and starts at boot. Do not change the ExecStart line.'),
      check: {
        when: (f) => {
          const u = units(f)['report.service'];
          return !!u && u.active === 'active' && u.enabled === 'enabled' && u.props.ExecStart === '/usr/local/bin/report';
        },
      },
    },
  },
  {
    id: 'linux.place.proc',
    level: 'experienced',
    key: false,
    concepts: ['linux.procfs'],
    kind: 'quiz',
    item: {
      id: 'linux.place.q.proc',
      kind: 'mcq',
      prompt: bi('Откуда `ps` берёт список процессов?', 'Where does `ps` get the list of processes?'),
      options: [
        { id: 'proc', text: bi('Из /proc', 'From /proc'), correct: true },
        { id: 'sys', text: bi('Из /sys', 'From /sys'), why: bi('/sys — устройства и настройки ядра; процессы — в /proc.', '/sys holds devices and kernel settings; processes are in /proc.') },
        { id: 'journal', text: bi('Из журнала', 'From the journal'), why: bi('Журнал хранит сообщения, а не состояние.', 'The journal keeps messages, not state.') },
      ],
    },
  },
  {
    id: 'linux.place.signals',
    level: 'experienced',
    key: false,
    concepts: ['linux.signal'],
    kind: 'quiz',
    item: {
      id: 'linux.place.q.signals',
      kind: 'multi',
      prompt: bi('Какие сигналы процесс не может перехватить?', 'Which signals can a process not catch?'),
      options: [
        { id: 'kill', text: 'SIGKILL', correct: true },
        { id: 'stop', text: 'SIGSTOP', correct: true },
        { id: 'tstp', text: 'SIGTSTP', why: bi('TSTP (Ctrl+Z) перехватывается; неперехватываемый вариант — STOP.', 'TSTP (Ctrl+Z) can be caught; the uncatchable one is STOP.') },
        { id: 'term', text: 'SIGTERM', why: bi('TERM — вежливая просьба: процесс может её обработать.', 'TERM is a polite request: the process may handle it.') },
      ],
    },
  },
  {
    id: 'linux.place.pipefail',
    level: 'experienced',
    key: false,
    concepts: ['linux.script'],
    kind: 'quiz',
    item: {
      id: 'linux.place.q.pipefail',
      kind: 'mcq',
      prompt: bi('`set -euo pipefail`, затем `grep foo missing.txt | wc -l`. Что будет?', '`set -euo pipefail`, then `grep foo missing.txt | wc -l`. What happens?'),
      options: [
        { id: 'stop', text: bi('Код конвейера 2, скрипт завершится', 'The pipeline’s code is 2 and the script ends'), correct: true },
        { id: 'go', text: bi('wc напечатает 0, скрипт продолжит', 'wc prints 0 and the script goes on'), why: bi('Так было бы без pipefail.', 'That would be without pipefail.') },
      ],
    },
  },
  {
    id: 'linux.place.dfdu',
    level: 'experienced',
    key: true,
    concepts: ['linux.inode'],
    kind: 'quiz',
    item: {
      id: 'linux.place.q.dfdu',
      kind: 'mcq',
      prompt: bi('`df -h` показывает `/` на 100%, а `du -sh /*` в сумме меньше. Что искать?', '`df -h` shows `/` at 100% while `du -sh /*` adds up to less. What do you look for?'),
      options: [
        { id: 'open', text: bi('Удалённый, но открытый процессом файл: lsof +L1', 'A deleted file still open by a process: lsof +L1'), correct: true },
        { id: 'fsck', text: bi('Испорченную файловую систему: fsck', 'A corrupted file system: fsck'), why: bi('Расхождение df и du почти всегда объясняется открытыми удалёнными файлами.', 'A mismatch between df and du is almost always explained by deleted open files.') },
      ],
    },
  },
];

const exam: Exam = {
  id: 'linux.exam.service',
  block: 'linux',
  title: bi('Экзамен: служба не стартует', 'Exam: the service does not start'),
  intro: bi(
    'Ночная служба отчётов не работает, а журнал разросся. Почините службу, сделайте так, чтобы она переживала перезагрузку, и ограничьте журнал. Открыта только документация машины: `man`, `--help`, `help`.',
    'The nightly report service is down, and the journal has grown. Fix the service, make it survive a reboot and limit the journal. Only the machine’s documentation is open: `man`, `--help`, `help`.',
  ),
  minutes: 30,
  pass: 0.7,
  allowedDocs: ['man', 'help'],
  tasks: [
    {
      id: 'fix',
      weight: 2,
      critical: true,
      kind: 'task',
      setup: REPORT_BROKEN,
      task: {
        id: 'fix',
        prompt: bi('`report.service` должна быть active, не меняя строку ExecStart.', '`report.service` must be active without changing the ExecStart line.'),
        check: { when: (f) => units(f)['report.service']?.active === 'active' && units(f)['report.service']?.props.ExecStart === '/usr/local/bin/report' },
      },
    },
    {
      id: 'boot',
      weight: 1,
      kind: 'task',
      setup: REPORT_BROKEN,
      task: {
        id: 'boot',
        prompt: bi('Служба должна запускаться при загрузке и перезапускаться при падении.', 'The service must start at boot and be restarted when it dies.'),
        check: { when: (f) => units(f)['report.service']?.enabled === 'enabled' && /on-failure|always/.test(units(f)['report.service']?.props.Restart ?? '') },
      },
    },
    {
      id: 'journal',
      weight: 1,
      beyond: true,
      kind: 'task',
      setup: { files: [{ path: '/etc/systemd/journald.conf', content: '[Journal]\n#Storage=auto\n#SystemMaxUse=\n', owner: 'root' }] },
      task: {
        id: 'journal',
        prompt: bi('Журнал systemd не должен занимать больше 50 мегабайт.', 'The systemd journal must not take more than 50 megabytes.'),
        check: { when: (f) => /^\s*SystemMaxUse=50M\s*$/m.test((f.files['/etc/systemd/journald.conf']?.text ?? '') as string) },
        docStep: 5,
        solutionTokens: ['SystemMaxUse', 'journald.conf'],
      },
    },
    {
      id: 'why',
      weight: 1,
      kind: 'quiz',
      item: {
        id: 'linux.exam.q.203',
        kind: 'mcq',
        prompt: bi('В статусе службы было `status=203/EXEC`. Что это значит?', 'The service status showed `status=203/EXEC`. What does it mean?'),
        options: [
          { id: 'exec', text: bi('systemd не смог запустить файл из ExecStart: нет файла, нет бита x или неверный интерпретатор', 'systemd could not run the file from ExecStart: no file, no x bit or a wrong interpreter'), correct: true },
          { id: 'code', text: bi('Программа вышла с кодом 203', 'The program exited with code 203'), why: bi('203 — код systemd, а не программы: до программы дело не дошло.', '203 is a systemd code, not the program’s: the program never started.') },
        ],
      },
    },
  ],
};

const block: Block = {
  id: 'linux',
  order: 20,
  title: bi('Linux', 'Linux'),
  summary: bi(
    'Оболочка, файлы и права, потоки и конвейеры, процессы и сигналы, скрипты, пакеты, службы и журналы, диски, изоляция и лимиты ядра, сеть глазами машины и SSH.',
    'The shell, files and permissions, streams and pipelines, processes and signals, scripts, packages, services and logs, disks, the kernel’s isolation and limits, the network through the machine’s eyes and SSH.',
  ),
  checklistStep: '02',
  levels: {
    beginner: bi('Только графический интерфейс', 'Graphical interface only'),
    intermediate: bi('Открывал терминал, ставил пакеты по инструкции', 'Has opened a terminal and installed packages by instructions'),
    experienced: bi('Пишет скрипты, не знает systemd, журналов, /proc, ядра', 'Writes scripts; does not know systemd, logs, /proc, the kernel'),
  },
  hours: { beginner: 73, intermediate: 47, experienced: 27 },
  placement,
  lessons: LESSONS.map((l) => l.id),
  sources: sources([TLCL, BASH_MANUAL, DEBIAN_HANDBOOK, man7('man-pages', 7)], [DEBIAN_HANDBOOK_RU, wiki('Linux', 'Linux')]),
  docSources: ['man', 'help'],
  exam: exam.id,
};

export default defineModule({
  blocks: [block],
  lessons: LESSONS,
  concepts,
  quiz: QUIZ,
  exams: [exam, DISK_EXAM, ISOLATION_EXAM, ACCESS_EXAM],
  docs: LINUX_DOCS,
  commands: [hello, batchExport],
  explainers: [fromModel(execModel), fromModel(pipeModel), fromModel(permModel), fromModel(restartModel), fromModel(bootModel), fromModel(isolationModel)],
});
