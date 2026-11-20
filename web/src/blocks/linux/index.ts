// The Linux block (route id `linux`, design 02): nineteen lessons from the
// terminal to how the kernel isolates and limits processes, four more on real
// Alpine machines in the tab (design 00 §6.13: SSH between machines, nginx
// and OpenRC, installing onto a blank disk, a full partition), eight process
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
import { LESSONS_4 } from './lessons-4';
import { QUIZ } from './quiz';
import { QUIZ_REAL } from './quiz-real';
import { installModel } from './explainers/install';
import { sshModel } from './explainers/ssh';
import { LAB_PAGES } from './reallab/labs';
import { lazyWidget } from '../../engine/v86/lazy';
import { BASH_MANUAL, DEBIAN_HANDBOOK, DEBIAN_HANDBOOK_RU, TLCL, man7, sources, wiki } from './shared';

const LESSONS = [...LESSONS_1, ...LESSONS_2, ...LESSONS_3, ...LESSONS_4];

/** The emulator, xterm and the lab UI load only when a real-machine lab mounts. */
const loadLab = async () => (await import('./reallab/widget')).mountRealLab;
const labWidgets = [
  lazyWidget('linux.lab', loadLab),
  // #/lab/<id>: the in-browser variants of the learning exams (the props come from LAB_PAGES).
  ...Object.entries(LAB_PAGES).map(([id, props]) => lazyWidget(`lab:${id}`, async () => {
    const mount = await loadLab();
    return (el, _p, ctx) => mount(el, props, ctx);
  })),
];

/** `hello` — the program of the PATH lesson; it exists only in ~/bin of that lab. */
const hello: ShellCommand = {
  name: 'hello',
  summary: bi('Учебная программа из урока о переменной PATH', 'the lab program of the PATH lesson'),
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
    task: { id: 'up2', prompt: bi('Вы находитесь в каталоге `/home/anna/projects/site`. Перейдите на два уровня выше и выведите путь каталога, в котором оказались.', 'You are in `/home/anna/projects/site`. Go two levels up and print the path of the directory where you ended up.'), check: { when: "cwd='/home/anna'", stdout: /^\/home\/anna\n$/ } },
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
        { id: 'space', text: bi('Из-за лишнего пробела команда получает два аргумента и удаляет весь домашний каталог', 'Because of the extra space the command gets two arguments and deletes the whole home directory'), correct: true },
        { id: 'root', text: bi('Команда удалит корень системы', 'The command deletes the root of the system'), why: bi('Нет, `/old-project` здесь отдельный каталог внутри корня, а не сам корень, и к тому же GNU rm отказывается удалять `/`.', 'No, `/old-project` here is a separate directory inside the root, not the root itself, and GNU rm refuses to delete `/` anyway.') },
        { id: 'safe', text: bi('Ничем не опасна, потому что флаг -f всего лишь отключает вопросы', 'It is not dangerous, because the -f flag only turns off the questions'), why: bi('Флаг -f отключает вопросы, но опасность в другом: лишний пробел после `~` превращает строку в две цели для удаления.', 'The -f flag does turn off the questions, but the danger is elsewhere: the extra space after `~` turns the line into two targets for deletion.') },
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
      prompt: bi('Команда `ls -l` показывает строку `-rw-r----- 1 anna dev 120 report.txt`, а пользователь bob состоит в группе dev. Что bob может сделать с этим файлом?', '`ls -l` shows the line `-rw-r----- 1 anna dev 120 report.txt`, and the user bob is in group dev. What can bob do with this file?'),
      options: [
        { id: 'read', text: bi('Прочитать файл, но не изменить его', 'Read the file but not change it'), correct: true },
        { id: 'write', text: bi('Прочитать файл и изменить его', 'Read the file and change it'), why: bi('Нет, бит w есть только у владельца anna, а bob получает тройку группы r--, в которой можно только читать.', 'No, only the owner anna has the w bit, and bob gets the group triad r--, which only allows reading.') },
        { id: 'nothing', text: bi('Ничего не может сделать', 'He can do nothing with it'), why: bi('Нет, без всяких прав остались бы «остальные», а bob входит в группу файла и получает её тройку.', 'No, “others” would be left with no rights, but bob is in the file’s group and gets its triad.') },
      ],
    },
  },
  {
    id: 'linux.place.wc',
    level: 'intermediate',
    key: false,
    concepts: ['linux.redirect'],
    kind: 'quiz',
    item: { id: 'linux.place.q.wc', kind: 'predict-output', prompt: bi('Что напечатает последняя команда в этой строке?', 'What does the last command in this line print?'), command: 'echo hello > f.txt; echo world >> f.txt; wc -l < f.txt' },
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
      prompt: bi('После команды `export PATH=/opt/bin` оболочка перестала находить `ls`. Почему?', 'After `export PATH=/opt/bin` the shell no longer finds `ls`. Why?'),
      options: [
        { id: 'replace', text: bi('Список каталогов заменили целиком, и каталог /usr/bin из него выпал', 'The list of directories was replaced as a whole, and /usr/bin dropped out of it'), correct: true },
        { id: 'perm', text: bi('У программы ls сняли права на запуск', 'The program ls lost its permission to run'), why: bi('Нет, права не менялись, и если набрать полный путь `/usr/bin/ls`, программа запустится.', 'No, the permissions did not change, and if you type the full path `/usr/bin/ls`, the program runs.') },
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
      prompt: bi('Служба `report.service` не запускается. Почините её так, чтобы она работала и запускалась при загрузке, но строку ExecStart не меняйте.', '`report.service` does not start. Fix it so that it runs and starts at boot, but do not change the ExecStart line.'),
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
      prompt: bi('Откуда команда `ps` берёт список процессов?', 'Where does `ps` get the list of processes?'),
      options: [
        { id: 'proc', text: bi('Из каталога /proc', 'From the /proc directory'), correct: true },
        { id: 'sys', text: bi('Из каталога /sys', 'From the /sys directory'), why: bi('Нет, в /sys собраны устройства и настройки ядра, а сведения о процессах ядро показывает в /proc.', 'No, /sys gathers devices and kernel settings, and the kernel shows the facts about processes in /proc.') },
        { id: 'journal', text: bi('Из системного журнала', 'From the system journal'), why: bi('Нет, журнал хранит сообщения о том, что происходило, а не текущее состояние процессов.', 'No, the journal keeps messages about what happened, not the current state of processes.') },
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
        { id: 'tstp', text: 'SIGTSTP', why: bi('Нет, сигнал TSTP, который посылает Ctrl+Z, процесс перехватить может, а перехватить нельзя похожий на него сигнал STOP.', 'No, TSTP, which Ctrl+Z sends, can be caught, and the similar signal that cannot be caught is STOP.') },
        { id: 'term', text: 'SIGTERM', why: bi('Нет, TERM означает вежливую просьбу завершиться, и процесс может её обработать или проигнорировать.', 'No, TERM is a polite request to finish, and the process may handle it or ignore it.') },
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
      prompt: bi('В скрипте стоит строка `set -euo pipefail`, а за ней `grep foo missing.txt | wc -l`, причём файла missing.txt нет. Что произойдёт?', 'A script has `set -euo pipefail` and then `grep foo missing.txt | wc -l`, and the file missing.txt does not exist. What happens?'),
      options: [
        { id: 'stop', text: bi('Конвейер вернёт код 2, и скрипт завершится', 'The pipeline returns code 2, and the script ends'), correct: true },
        { id: 'go', text: bi('Команда wc напечатает 0, и скрипт продолжит работу', 'wc prints 0, and the script goes on'), why: bi('Так было бы без pipefail, а с ним ошибка grep становится ошибкой всего конвейера, и флаг -e останавливает скрипт.', 'That would be so without pipefail, but with it grep’s error becomes the error of the whole pipeline, and -e stops the script.') },
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
      prompt: bi('Команда `df -h` показывает, что `/` заполнен на 100%, а `du -sh /*` в сумме насчитывает меньше. Что нужно искать?', '`df -h` shows `/` at 100%, while `du -sh /*` adds up to less. What do you look for?'),
      options: [
        { id: 'open', text: bi('Удалённый файл, который всё ещё держит открытым процесс, и найти его можно командой lsof +L1', 'A deleted file a process still holds open, found with lsof +L1'), correct: true },
        { id: 'fsck', text: bi('Испорченную файловую систему, которую проверяет fsck', 'A corrupted file system, which fsck checks'), why: bi('Нет, расхождение между df и du почти всегда объясняется удалёнными файлами, которые ещё открыты.', 'No, a mismatch between df and du is almost always explained by deleted files that are still open.') },
      ],
    },
  },
];

const exam: Exam = {
  id: 'linux.exam.service',
  block: 'linux',
  title: bi('Экзамен о службе, которая не запускается', 'An exam about a service that does not start'),
  intro: bi(
    'Ночная служба отчётов не работает, а журнал разросся. Почините службу, сделайте так, чтобы она запускалась и после перезагрузки, и ограничьте размер журнала. На экзамене открыта только документация самой машины, то есть `man`, `--help` и `help`.',
    'The nightly report service is down, and the journal has grown. Fix the service, make it start after a reboot too, and limit the journal’s size. During the exam only the machine’s own documentation is open, that is, `man`, `--help` and `help`.',
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
        prompt: bi('Служба `report.service` должна перейти в состояние active, а строка ExecStart должна остаться прежней.', '`report.service` must become active, and the ExecStart line must stay the same.'),
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
        prompt: bi('Служба должна запускаться при загрузке и перезапускаться после сбоя.', 'The service must start at boot and restart after a failure.'),
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
        prompt: bi('В выводе статуса службы было написано `status=203/EXEC`. Что это значит?', 'The service status said `status=203/EXEC`. What does it mean?'),
        options: [
          { id: 'exec', text: bi('systemd не запустил файл из ExecStart, потому что файла нет, у него нет бита x или указан неверный интерпретатор', 'systemd did not run the file from ExecStart, because there is no file, it has no x bit or the interpreter is wrong'), correct: true },
          { id: 'code', text: bi('Программа завершилась с кодом 203', 'The program exited with code 203'), why: bi('Нет, 203 означает код самого systemd, а не программы, и до запуска программы дело не дошло.', 'No, 203 is a code of systemd itself, not of the program, and the program never started.') },
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
    'В этом блоке вы научитесь работать в оболочке, с файлами и правами, с потоками и конвейерами, с процессами и сигналами. Вы напишете скрипты, поставите пакеты, разберётесь со службами и журналами, с дисками, с изоляцией и лимитами ядра, с сетью глазами машины и со входом по SSH.',
    'In this block you learn to work with the shell, files and permissions, streams and pipelines, processes and signals. You write scripts, install packages, and learn services and logs, disks, the kernel’s isolation and limits, the network through the machine’s eyes and SSH logins.',
  ),
  checklistStep: '02',
  levels: {
    beginner: bi('Вы работали с компьютером только через окна, значки и мышь', 'You have worked with a computer only through windows, icons and a mouse'),
    intermediate: bi('Вы открывали терминал и ставили программы, вставляя команды из инструкции', 'You have opened a terminal and installed programs by pasting commands from instructions'),
    experienced: bi('Вы пишете код и скрипты, а теперь хотите понять systemd, журналы, /proc и то, как ядро изолирует процессы', 'You write code and scripts and now want to understand systemd, logs, /proc and how the kernel isolates processes'),
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
  quiz: [...QUIZ, ...QUIZ_REAL],
  exams: [exam, DISK_EXAM, ISOLATION_EXAM, ACCESS_EXAM],
  docs: LINUX_DOCS,
  commands: [hello, batchExport],
  explainers: [fromModel(execModel), fromModel(pipeModel), fromModel(permModel), fromModel(restartModel), fromModel(bootModel), fromModel(isolationModel), fromModel(sshModel), fromModel(installModel)],
  widgets: labWidgets,
});
