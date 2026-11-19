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
  summary: bi('учебная программа экзамена: ночная выгрузка, которая растёт в памяти', 'the exam’s lab program: a nightly export that grows in memory'),
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
  title: bi('Учебный экзамен: соседи мешают друг другу', 'Learning exam: the neighbours get in each other’s way'),
  intro: bi(
    'Учебная контрольная после модуля об изоляции и лимитах: в протокол блока она не идёт, но показывает, уверенно ли вы обращаетесь с cgroups и systemd. Каждое задание начинается на своей копии сервера. Засчитывается состояние машины — файлы cgroup и свойства служб, а не набранные команды. Открыта только документация машины: `man`, `--help`, `help` и страницы systemd.',
    'A learning check after the module on isolation and limits: it does not go into the block’s protocol, but it shows whether you have cgroups and systemd in hand. Each task starts on its own copy of the server. What counts is the state of the machine — the cgroup files and the services’ properties, not the commands you type. Only the machine’s documentation is open: `man`, `--help`, `help` and the systemd pages.',
  ),
  story: bi(
    'На сервере живут две службы. Ночная выгрузка `batch` читает все заказы в память и съедает её вместе с процессором, а `api`, которым пользуются кассы, в это время отвечает медленно; прошлой ночью ядро спасало машину и убило именно `api`. Код выгрузки трогать нельзя — его пишет другая команда. Нужно, чтобы выгрузка жила в своих рамках, а `api` при нехватке памяти погибал последним.',
    'Two services live on the server. The nightly export `batch` reads all the orders into memory and eats it along with the CPU, and `api`, which the tills use, answers slowly meanwhile; last night the kernel saved the machine and killed `api` of all things. The export’s code must not be touched — another team writes it. The export must live within its bounds, and `api` must be the last to die when memory runs short.',
  ),
  minutes: 35,
  pass: 0.7,
  allowedDocs: ['man', 'help'],
  explain: [
    {
      id: 'e1',
      prompt: bi('Тимлид спрашивает: «Зачем лимит памяти, если на сервере её ещё много? И что случится с выгрузкой, когда она в лимит упрётся?»', 'The team lead asks: “Why a memory limit if the server still has plenty? And what happens to the export when it hits the limit?”'),
      keyPoints: [
        bi('без лимита при нехватке памяти OOM killer выбирает жертву по всей машине', 'without a limit, when memory runs short the OOM killer picks a victim across the whole machine'),
        bi('с лимитом OOM срабатывает внутри группы выгрузки, соседи не страдают', 'with a limit the OOM fires inside the export’s group, the neighbours do not suffer'),
        bi('`MemoryMax=` в unit пишет `memory.max` cgroup службы', '`MemoryMax=` in the unit writes the service cgroup’s `memory.max`'),
        bi('убитую службу перезапустит `Restart=`, а `oom_kill` в `memory.events` это покажет', '`Restart=` restarts the killed service, and `oom_kill` in `memory.events` shows it'),
      ],
    },
    {
      id: 'e2',
      prompt: bi('«Чем `cpu.max` отличается от `CPUWeight=`, и что из них вы бы поставили выгрузке?»', '“How does `cpu.max` differ from `CPUWeight=`, and which of them would you give the export?”'),
      keyPoints: [
        bi('`cpu.max` — жёсткий потолок: даже на пустой машине больше не дадут', '`cpu.max` is a hard ceiling: you get no more even on an idle machine'),
        bi('вес делит процессор только при конкуренции', 'a weight divides the CPU only under contention'),
        bi('ночью, когда `api` простаивает, выгрузка с весом работает быстрее', 'at night, when `api` is idle, an export with a weight runs faster'),
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
        prompt: bi('Ограничьте службу `batch` 64 мебибайтами памяти так, чтобы лимит пережил перезагрузку. Программу выгрузки и её строку запуска не меняйте; служба должна работать.', 'Limit the `batch` service to 64 MiB of memory so that the limit survives a reboot. Do not change the export program or its start line; the service must be running.'),
        concepts: ['linux.cgroup', 'linux.unit', 'linux.oom'],
        check: {
          when: (f, s) => {
            const g = cg(f, 'batch.service');
            return !!g && g.memory.max !== 'max' && g.memory.max <= 64 * MiB && active(f, 'batch.service') && !!sameProgram(f, s);
          },
          fail: [
            { if: (f) => { const g = cg(f, 'batch.service'); return !!g && g.memory.max === 'max' && !!unit(f, 'batch.service')?.props.MemoryMax; }, say: bi('Настройка записана, но cgroup её ещё не видит: systemd перечитывает unit-файлы после `daemon-reload`, а лимит применится при перезапуске службы.', 'The setting is written, but the cgroup does not see it yet: systemd rereads unit files after `daemon-reload`, and the limit applies when the service restarts.') },
            { if: (f) => { const g = cg(f, 'batch.service'); return !!g && g.memory.max === 'max'; }, say: bi('В cgroup службы `memory.max` всё ещё max. Лимит, записанный руками в `/sys`, systemd сбросит при перезапуске — лимит службы живёт в unit-файле.', '`memory.max` of the service’s cgroup is still max. A limit written into `/sys` by hand is reset by systemd at the restart — a service’s limit lives in its unit file.') },
            { if: (f) => !active(f, 'batch.service'), say: bi('Лимит есть, но служба не работает. Посмотрите `systemctl status batch` и журнал.', 'The limit is there, but the service is not running. Look at `systemctl status batch` and the journal.') },
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
        prompt: bi('Выгрузка иногда порождает сотни потомков. Пусть у службы `batch` будет не больше 50 процессов и потоков, и пусть это тоже переживает перезагрузку.', 'The export sometimes spawns hundreds of children. Let the `batch` service have no more than 50 processes and threads, and let this survive a reboot too.'),
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
        prompt: bi('Выгрузке не нужен root. Пусть служба `batch` работает от отдельного системного пользователя без входа в систему.', 'The export does not need root. Let the `batch` service run as a separate system user who cannot log in.'),
        concepts: ['linux.user', 'linux.unit', 'linux.root'],
        check: {
          when: (f) => {
            const u = unit(f, 'batch.service')?.props.User ?? '';
            const acct = ((f.users ?? []) as { name: string; uid: number; shell: string }[]).find((x) => x.name === u);
            const procs = f.procs.filter((p) => p.cmd === 'batch-export');
            return !!acct && acct.uid > 0 && acct.uid < 1000 && /nologin|false/.test(acct.shell) && active(f, 'batch.service') && procs.length > 0 && procs.every((p) => p.uid === acct.uid);
          },
          fail: [
            { if: (f) => !active(f, 'batch.service') && !!unit(f, 'batch.service')?.props.User && unit(f, 'batch.service')?.props.User !== 'root', say: bi('Служба не стартует: такого пользователя на машине, похоже, нет. systemd не создаёт его сам, если не попросить.', 'The service does not start: such a user does not seem to exist on the machine. systemd does not create one unless asked.') },
            { if: (f) => { const u = unit(f, 'batch.service')?.props.User ?? ''; const acct = ((f.users ?? []) as { name: string; uid: number }[]).find((x) => x.name === u); return !!acct && acct.uid >= 1000; }, say: bi('Это обычная учётная запись с номером от 1000. Службам заводят системных пользователей: `useradd --system`.', 'This is an ordinary account with a number from 1000 up. Services get system users: `useradd --system`.') },
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
        prompt: bi('Жёсткий потолок процессора выгрузке не подходит: ночью машина свободна, и пусть выгрузка работает быстро. Нужно другое: когда `api` и `batch` спорят за процессор, `api` получает большую долю. В курсе этого не было — найдите директиву в `systemd.resource-control(5)`.', 'A hard CPU ceiling does not suit the export: at night the machine is free, and the export should run fast. Something else is needed: when `api` and `batch` compete for the CPU, `api` gets the larger share. The course did not show it — find the directive in `systemd.resource-control(5)`.'),
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
        prompt: bi('Если память всё-таки кончится на всей машине, `api` должен погибнуть последним. Скажите об этом ядру через unit службы `api`. Директиву ищите в `systemd.exec(5)`.', 'If memory does run out on the whole machine, `api` must be the last to die. Tell the kernel so through the `api` service’s unit. Look for the directive in `systemd.exec(5)`.'),
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
        prompt: bi('Прошлой ночью в `dmesg` была строка `Out of memory: Killed process 812 (web-demo)`, без слов «Memory cgroup». Что это значит?', 'Last night `dmesg` had the line `Out of memory: Killed process 812 (web-demo)`, without the words “Memory cgroup”. What does it mean?'),
        options: [
          { id: 'global', text: bi('Память кончилась на всей машине, и глобальный OOM killer выбрал `api`, хотя росла выгрузка', 'Memory ran out on the whole machine, and the global OOM killer picked `api` although the export was growing'), correct: true },
          { id: 'limit', text: bi('`api` упёрся в свой лимит `memory.max`', '`api` hit its own `memory.max` limit'), why: bi('Тогда строка начиналась бы с `Memory cgroup out of memory`, и лимита у `api` не было.', 'Then the line would start with `Memory cgroup out of memory`, and `api` had no limit.') },
          { id: 'bug', text: bi('В `api` утечка памяти: его и надо было убить', '`api` has a memory leak: it was the right one to kill'), why: bi('Глобальный OOM killer выбирает по размеру и `oom_score_adj`, а не по вине: жертвой мог стать любой крупный процесс.', 'The global OOM killer chooses by size and `oom_score_adj`, not by guilt: any large process could have been the victim.') },
        ],
        explain: bi('Без лимитов вся машина — одна общая группа, и при нехватке памяти ядро спасает её, убивая самый «дорогой» процесс по оценке `oom_score`. Лимит выгрузки переносит этот выбор внутрь её собственной группы.', 'Without limits the whole machine is one shared group, and when memory runs short the kernel saves it by killing the “costliest” process by its `oom_score`. A limit on the export moves that choice inside its own group.'),
      },
    },
  ],
};
