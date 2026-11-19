// linux.exam.isolation "Neighbours get in each other's way" (02 §8.3): a
// learning exam after the module on isolation and limits. Two services on
// one server: `batch` grows without limits and runs as root, `api` suffers.
// The learner limits batch through systemd without touching its program,
// moves it off root, and at DL5 gives api the larger CPU share and the OOM
// killer's mercy. Checked on the simulator by the cgroup files and unit
// properties, as on a real machine.

import { bi } from '../../core/i18n';
import type { Exam, Facts, ShellCommand, TerminalSetup } from '../../core/types';
import { registerProgram } from '../../engine/terminal/shell';

/** The batch job of the exam: it grows by 6 MiB a second and keeps a CPU half busy. */
export const batchExport: ShellCommand = {
  name: 'batch-export',
  summary: bi('Учебная программа экзамена, ночная выгрузка, которая занимает всё больше памяти', 'the exam’s lab program: a nightly export that grows in memory'),
  help: 'Usage: batch-export [--rows N]\nExport N rows of orders (default 5000000). A lab program of DevOps Trainer: it reads everything into memory first, so its resident memory grows by about 6 MiB a second until the export ends or something stops it. Run it as a service.',
  run(ctx) {
    ctx.err('batch-export: this is a long job; run it as the batch service (systemctl start batch)\n');
    return 1;
  },
};
registerProgram('batch-export', { background: () => ({ rss: 2400, grow: 6 * 1024, cpuWant: 60 }) });

const BIN = '/usr/local/bin/batch-export';
const STUB = '#!/usr/bin/sim\n# batch-export: the nightly orders export\n';

export const ISOLATION_SETUP: TerminalSetup = {
  users: [{ name: 'api', uid: 990, home: '/nonexistent' }],
  files: [
    { path: BIN, content: STUB, owner: 'root', mode: '0755' },
    { path: '/usr/local/bin/web-demo', content: '#!/usr/bin/sim\n# web-demo: the api server\n', owner: 'root', mode: '0755' },
    {
      path: '/etc/systemd/system/batch.service',
      content: '[Unit]\nDescription=Nightly orders export\n\n[Service]\nExecStart=/usr/local/bin/batch-export --rows 5000000\nUser=root\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n',
      owner: 'root',
    },
    {
      path: '/etc/systemd/system/api.service',
      content: '[Unit]\nDescription=Orders API\n\n[Service]\nExecStart=/usr/local/bin/web-demo --port 8080\nUser=api\nRestart=always\n\n[Install]\nWantedBy=multi-user.target\n',
      owner: 'root',
    },
  ],
  script: ['systemctl enable api', 'systemctl enable batch', 'systemctl start api', 'systemctl start batch'],
};

type Unit = { active: string; enabled: string; props: Record<string, string> };
type Cg = { path: string; memory: { max: number | 'max' }; pids: { max: number | 'max' } };
const unit = (f: Facts, n: string) => ((f.units ?? {}) as Record<string, Unit>)[n];
const cg = (f: Facts, n: string) => ((f.cgroups ?? []) as Cg[]).find((c) => c.path === `/system.slice/${n}`);
const active = (f: Facts, n: string) => unit(f, n)?.active === 'active';
const sameProgram = (f: Facts, s?: Facts) => !!s && f.files[BIN]?.text === s.files[BIN]?.text && unit(f, 'batch.service')?.props.ExecStart?.startsWith(BIN);
/** systemd's default CPUWeight is 100 when the unit does not set one. */
const weight = (f: Facts, n: string) => Number(unit(f, n)?.props.CPUWeight ?? 100);
const MiB = 1024 * 1024;

export const ISOLATION_EXAM: Exam = {
  id: 'linux.exam.isolation',
  block: 'linux',
  title: bi('Учебный экзамен о соседних службах, которые мешают друг другу', 'A learning exam about neighbouring services that get in each other’s way'),
  intro: bi(
    'Это учебная контрольная после уроков об изоляции и лимитах. В итоговый протокол блока она не идёт, но показывает, уверенно ли вы обращаетесь с cgroups и systemd. Каждое задание начинается на своей копии сервера, и засчитывается состояние машины, то есть файлы cgroup и свойства служб, а не набранные команды. На экзамене открыта только документация машины: `man`, `--help`, `help` и страницы systemd.',
    'This is a learning test after the lessons on isolation and limits. It does not go into the block’s final record, but it shows whether you handle cgroups and systemd with confidence. Each task starts on its own copy of the server, and what counts is the state of the machine, the cgroup files and the service properties, not the commands you typed. Only the machine’s documentation is open: `man`, `--help`, `help` and the systemd pages.',
  ),
  story: bi(
    'На сервере работают две службы. Ночная выгрузка `batch` читает все заказы в память и занимает всю память вместе с процессором, а служба `api`, которой пользуются кассы, в это время отвечает медленно. Прошлой ночью ядро, спасая машину, завершило как раз `api`. Код выгрузки трогать нельзя, потому что его пишет другая команда. Нужно сделать так, чтобы выгрузка работала в своих рамках, а `api` при нехватке памяти завершался последним.',
    'The server runs two services. The nightly export `batch` reads all orders into memory and takes all the memory and the CPU, while `api`, which the tills use, answers slowly at that time. Last night the kernel, saving the machine, ended exactly `api`. The export’s code must not be touched, because another team writes it. You need the export to work within its own bounds, and `api` to be the last to be ended when memory runs out.',
  ),
  minutes: 35,
  pass: 0.7,
  allowedDocs: ['man', 'help'],
  explain: [
    {
      id: 'e1',
      prompt: bi('Руководитель команды спрашивает: «Зачем лимит памяти, если на сервере её ещё много? И что случится с выгрузкой, когда она упрётся в лимит?»', 'The team lead asks: “Why a memory limit if the server still has plenty of memory? And what happens to the export when it hits the limit?”'),
      keyPoints: [
        bi('без лимита при нехватке памяти OOM killer выбирает, какой процесс завершить, среди всех процессов машины', 'without a limit, when memory runs out, the OOM killer picks which process to end among all processes of the machine'),
        bi('с лимитом OOM killer срабатывает внутри группы выгрузки, и соседние службы не страдают', 'with a limit the OOM killer acts inside the export’s group, and the neighbouring services do not suffer'),
        bi('строка `MemoryMax=` в unit-файле записывает значение в файл `memory.max` группы службы', '`MemoryMax=` in the unit file writes the value into the service group’s `memory.max`'),
        bi('завершённую службу перезапустит настройка `Restart=`, а счётчик `oom_kill` в `memory.events` покажет, что это случилось', '`Restart=` restarts the ended service, and the `oom_kill` counter in `memory.events` shows that it happened'),
      ],
    },
    {
      id: 'e2',
      prompt: bi('«Чем `cpu.max` отличается от `CPUWeight=`, и что из этого вы бы поставили выгрузке?»', '“How does `cpu.max` differ from `CPUWeight=`, and which of them would you give the export?”'),
      keyPoints: [
        bi('`cpu.max` задаёт жёсткий потолок, и больше процессора не дадут даже на пустой машине', '`cpu.max` sets a hard ceiling, and no more CPU is given even on an idle machine'),
        bi('вес делит процессор только тогда, когда службы за него соперничают', 'a weight divides the CPU only when services compete for it'),
        bi('ночью, когда `api` простаивает, выгрузка с весом работает быстрее, чем с потолком', 'at night, when `api` is idle, the export with a weight runs faster than with a ceiling'),
      ],
    },
  ],
  tasks: [
    {
      id: 'mem',
      weight: 25,
      critical: true,
      kind: 'task',
      setup: ISOLATION_SETUP,
      task: {
        id: 'mem',
        prompt: bi('Ограничьте службу `batch` 64 мебибайтами памяти так, чтобы лимит сохранялся после перезагрузки. Программу выгрузки и её строку запуска не меняйте, а служба должна продолжать работать.', 'Limit the `batch` service to 64 MiB of memory so that the limit survives a reboot. Do not change the export program or its start line, and the service must keep running.'),
        concepts: ['linux.cgroup', 'linux.unit', 'linux.oom'],
        check: {
          when: (f, s) => {
            const g = cg(f, 'batch.service');
            return !!g && g.memory.max !== 'max' && g.memory.max <= 64 * MiB && active(f, 'batch.service') && !!sameProgram(f, s);
          },
          fail: [
            { if: (f) => { const g = cg(f, 'batch.service'); return !!g && g.memory.max === 'max' && !!unit(f, 'batch.service')?.props.MemoryMax; }, say: bi('Настройка записана, но группа cgroup её ещё не видит. systemd перечитывает unit-файлы после `daemon-reload`, а лимит вступит в силу, когда служба перезапустится.', 'The setting is written, but the cgroup does not see it yet. systemd rereads unit files after `daemon-reload`, and the limit takes effect when the service restarts.') },
            { if: (f) => { const g = cg(f, 'batch.service'); return !!g && g.memory.max === 'max'; }, say: bi('В группе службы `memory.max` всё ещё равен max. Лимит, который записали вручную в `/sys`, systemd сбросит при перезапуске, потому что лимит службы должен храниться в unit-файле.', 'The service group’s `memory.max` is still max. A limit written into `/sys` by hand is reset by systemd at a restart, because a service’s limit must be kept in its unit file.') },
            { if: (f) => !active(f, 'batch.service'), say: bi('Лимит задан, но служба не работает. Посмотрите `systemctl status batch` и журнал службы.', 'The limit is set, but the service is not running. Look at `systemctl status batch` and the service’s journal.') },
          ],
        },
      },
    },
    {
      id: 'pids',
      weight: 20,
      kind: 'task',
      setup: ISOLATION_SETUP,
      task: {
        id: 'pids',
        prompt: bi('Выгрузка иногда создаёт сотни дочерних процессов. Сделайте так, чтобы у службы `batch` было не больше 50 процессов и потоков и чтобы этот лимит тоже сохранялся после перезагрузки.', 'The export sometimes creates hundreds of child processes. Make `batch` have at most 50 processes and threads, and make this limit survive a reboot too.'),
        concepts: ['linux.cgroup', 'linux.unit'],
        check: { when: (f) => { const g = cg(f, 'batch.service'); return !!g && g.pids.max !== 'max' && g.pids.max <= 50 && active(f, 'batch.service'); } },
      },
    },
    {
      id: 'user',
      weight: 20,
      kind: 'task',
      setup: ISOLATION_SETUP,
      task: {
        id: 'user',
        prompt: bi('Выгрузке не нужны права root. Сделайте так, чтобы служба `batch` работала от отдельного системного пользователя, которому вход в систему запрещён.', 'The export does not need root. Make `batch` run as a separate system user who may not log in.'),
        concepts: ['linux.user', 'linux.unit', 'linux.root'],
        check: {
          when: (f) => {
            const u = unit(f, 'batch.service')?.props.User ?? '';
            const acct = ((f.users ?? []) as { name: string; uid: number; shell: string }[]).find((x) => x.name === u);
            const procs = f.procs.filter((p) => p.cmd === 'batch-export');
            return !!acct && acct.uid > 0 && acct.uid < 1000 && /nologin|false/.test(acct.shell) && active(f, 'batch.service') && procs.length > 0 && procs.every((p) => p.uid === acct.uid);
          },
          fail: [
            { if: (f) => !active(f, 'batch.service') && !!unit(f, 'batch.service')?.props.User && unit(f, 'batch.service')?.props.User !== 'root', say: bi('Служба не запускается, и похоже, что такого пользователя на машине нет. systemd сам его не создаёт, если об этом не попросить.', 'The service does not start, and it looks as if there is no such user on the machine. systemd does not create one unless asked.') },
            { if: (f) => { const u = unit(f, 'batch.service')?.props.User ?? ''; const acct = ((f.users ?? []) as { name: string; uid: number }[]).find((x) => x.name === u); return !!acct && acct.uid >= 1000; }, say: bi('Это обычная учётная запись с номером от 1000, а для служб заводят системных пользователей командой `useradd --system`.', 'This is an ordinary account numbered from 1000, while services get system users created with `useradd --system`.') },
          ],
        },
      },
    },
    {
      id: 'weight',
      weight: 15,
      beyond: true,
      kind: 'task',
      setup: ISOLATION_SETUP,
      task: {
        id: 'weight',
        prompt: bi('Жёсткий потолок процессора выгрузке не подходит, потому что ночью машина свободна и выгрузка должна работать быстро. Нужно другое: когда `api` и `batch` соперничают за процессор, `api` должен получать большую долю. В курсе такой директивы не было, поэтому найдите её на странице `systemd.resource-control(5)`.', 'A hard CPU ceiling does not suit the export, because at night the machine is free and the export should run fast. Something else is needed: when `api` and `batch` compete for the CPU, `api` must get the bigger share. The course had no such directive, so find it on the page `systemd.resource-control(5)`.'),
        concepts: ['linux.cgroup'],
        check: { when: (f) => weight(f, 'batch.service') < weight(f, 'api.service') && active(f, 'batch.service') && active(f, 'api.service') && !/CPUQuota/.test(JSON.stringify(unit(f, 'batch.service')?.props ?? {})) },
        docStep: 5,
        solutionTokens: ['CPUWeight', 'cpu.weight'],
      },
    },
    {
      id: 'oom',
      weight: 10,
      beyond: true,
      kind: 'task',
      setup: ISOLATION_SETUP,
      task: {
        id: 'oom',
        prompt: bi('Если память всё-таки кончится на всей машине, `api` должен завершиться последним. Сообщите об этом ядру через unit-файл службы `api`, а нужную директиву найдите на странице `systemd.exec(5)`.', 'If memory does run out on the whole machine, `api` must be the last to be ended. Tell the kernel so through `api`’s unit file, and find the directive on the page `systemd.exec(5)`.'),
        concepts: ['linux.oom'],
        check: { when: (f) => Number(unit(f, 'api.service')?.props.OOMScoreAdjust ?? 0) < 0 && active(f, 'api.service') },
        docStep: 5,
        solutionTokens: ['OOMScoreAdjust', 'oom_score_adj'],
      },
    },
    {
      id: 'why',
      weight: 10,
      kind: 'quiz',
      item: {
        id: 'linux.exam.q.global-oom',
        kind: 'mcq',
        concepts: ['linux.oom', 'linux.cgroup'],
        prompt: bi('Прошлой ночью в выводе `dmesg` появилась строка `Out of memory: Killed process 812 (web-demo)`, и слов «Memory cgroup» в ней не было. Что это значит?', 'Last night `dmesg` got the line `Out of memory: Killed process 812 (web-demo)`, without the words “Memory cgroup”. What does it mean?'),
        options: [
          { id: 'global', text: bi('Память кончилась на всей машине, и общий OOM killer выбрал `api`, хотя росла выгрузка', 'The whole machine ran out of memory, and the machine-wide OOM killer picked `api`, although it was the export that grew'), correct: true },
          { id: 'limit', text: bi('Служба `api` упёрлась в свой лимит `memory.max`', '`api` hit its own `memory.max` limit'), why: bi('Нет, тогда строка начиналась бы со слов `Memory cgroup out of memory`, а лимита у `api` не было.', 'No, then the line would start with `Memory cgroup out of memory`, and `api` had no limit.') },
          { id: 'bug', text: bi('В `api` утечка памяти, поэтому завершить нужно было его', '`api` has a memory leak, and it was the one that had to be ended'), why: bi('Нет, общий OOM killer выбирает процесс по размеру и по `oom_score_adj`, а не по вине, и жертвой мог стать любой крупный процесс.', 'No, the machine-wide OOM killer picks a process by size and `oom_score_adj`, not by guilt, and any large process could have been the victim.') },
        ],
        explain: bi('Без лимитов вся машина работает как одна общая группа, и при нехватке памяти ядро спасает её, завершая процесс, который оценка `oom_score` считает самым выгодным для завершения. Лимит выгрузки переносит этот выбор внутрь её собственной группы.', 'Without limits the whole machine works as one shared group, and when memory runs out, the kernel saves it by ending the process that `oom_score` rates as the best to end. A limit on the export moves this choice inside its own group.'),
      },
    },
  ],
};
