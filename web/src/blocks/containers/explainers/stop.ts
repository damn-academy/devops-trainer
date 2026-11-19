// X7 (04 §6.8): `docker stop` — the stop signal, PID 1 and the grace
// period. The kernel rule of pid_namespaces(7): the init process of a pid
// namespace gets only the signals it has a handler for (SIGKILL from the
// parent namespace always works). The knob says what PID 1 is.
//
// Reading order: at the start only the command is on the diagram. The signal
// travels as a card from the command through dockerd and the shim to PID 1;
// the kernel then says whether the signal is delivered, and the timer fills
// up when nobody reacts.

import { defineModel } from '../../../core/define';
import { bi, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { fmtb, man, startWith } from './util';

type P = { pid1: string; timeout: number; signal: string };

export interface StopResult {
  code: number;
  ms: number;
  rule: 'handler' | 'ignored' | 'shell' | 'tini';
}

/** The same rule the simulator's engine applies, written out for the explainer and its tests. */
export function stopResult(pid1: string, timeout: number, signal: string): StopResult {
  const sigNum = signal === 'SIGINT' ? 2 : 15;
  if (pid1 === 'shell') return { code: 137, ms: timeout * 1000, rule: 'shell' };
  if (pid1 === 'init') return { code: 128 + sigNum, ms: 40, rule: 'tini' };
  // Python always has a SIGINT handler (KeyboardInterrupt); a SIGTERM handler only if the code sets one
  if (pid1 === 'handler' || signal === 'SIGINT') return { code: signal === 'SIGINT' && pid1 !== 'handler' ? 130 : 0, ms: 160, rule: 'handler' };
  return { code: 137, ms: timeout * 1000, rule: 'ignored' };
}

const ALL = ['cli', 'dockerd', 'shim', 'timer', 'pid1', 'child', 'kernel', 'e-api', 'e-kill', 'e-sig', 'e-fwd', 'e-deliver', 'e-sigkill'];
const IMG = bi('Что записано в образе', 'What the image says');

export const stopModel = defineModel<P>({
  id: 'containers.stop',
  block: 'containers',
  title: bi('Как docker stop останавливает контейнер', 'docker stop: signals and PID 1'),
  summary: bi(
    'Почему один контейнер останавливается мгновенно, а другой ровно через 10 секунд с кодом выхода 137. Команда `docker stop` посылает сигнал только первому процессу контейнера, PID 1, и ждёт; что будет дальше, зависит от того, какая программа работает под этим номером.',
    'Why some containers stop at once and others after exactly 10 seconds with code 137. `docker stop` sends a signal only to the container’s first process, PID 1, and waits; what happens next depends on which program runs as PID 1.',
  ),
  intro: bi(
    'Сейчас на схеме только команда `docker stop app`. Нажмите «Начать: шаг вперёд», а дальше листайте кнопкой «Шаг вперёд». Карточка с именем сигнала пройдёт от команды через dockerd и shim к первому процессу контейнера, а внизу ядро решит, доставить ли ему этот сигнал. Справа вверху стоит таймер: он заполняется, пока Docker ждёт, что процесс завершится сам.\n\nПосле первого прохода выберите в «Параметрах» другой PID 1 и посмотрите на код выхода и время остановки под схемой.',
    'Now the diagram shows only the command `docker stop app`. Press “Start: step forward”, then go on with “Step forward”. A card with the signal’s name travels from the command through dockerd and the shim to the container’s first process, and the kernel at the bottom decides whether to deliver it. The timer at the top right fills while Docker waits for the process to exit by itself.\n\nAfter the first pass choose another PID 1 in “Parameters” and watch the exit code and the stop time under the diagram.',
  ),
  legend: [
    { mark: 'active', text: bi('участник, который работает сейчас', 'the participant working now') },
    { mark: 'say', text: bi('что он делает', 'what it does') },
    { mark: 'token', text: bi('сигнал, который передаётся дальше', 'the signal passed on') },
    { mark: 'icon:terminal', text: bi('ваша команда', 'your command') },
    { mark: 'icon:process', text: bi('программа Docker или процесс контейнера', 'a Docker program or a container process') },
    { mark: 'ok', text: bi('процесс завершился сам', 'the process exited by itself') },
    { mark: 'warn', text: bi('сигнал пропал без последствий', 'the signal was dropped') },
    { mark: 'err', text: bi('процесс завершён принудительно', 'the process was killed') },
    { mark: 'wait', text: bi('Docker ждёт', 'Docker is waiting') },
  ],
  stopLabel: bi('Проблема', 'Problem'),
  concepts: ['docker.pid1'],
  diagram: {
    width: 960,
    height: 500,
    nodes: [
      { id: 'cli', label: 'docker stop app', icon: 'terminal', family: 'user', x: 24, y: 72, w: 208, h: 56, card: { what: bi('Команда остановки. Она просит Docker послать контейнеру сигнал остановки, подождать и, если контейнер не завершился, завершить его принудительно.', 'The stop command: “send the stop signal, wait, then kill”.'), who: bi('Её запускаете вы или система оркестрации.', 'You or an orchestrator.'), doc: { page: 'help/docker-stop' } } },
      { id: 'dockerd', label: 'dockerd', icon: 'process', family: 'cp', x: 272, y: 72, w: 168, h: 56, card: { what: bi('Демон выбирает сигнал (STOPSIGNAL из образа или флаг --stop-signal, по умолчанию SIGTERM) и время ожидания (10 секунд, если не задано --stop-timeout или `docker stop -t`).', 'The daemon picks the signal (the image StopSignal or --stop-signal, SIGTERM by default) and the wait (10 s or --stop-timeout / -t).'), who: bi('Его запускает systemd.', 'systemd.') } },
      { id: 'shim', label: 'shim', icon: 'process', family: 'process', x: 480, y: 72, w: 168, h: 56, card: { what: bi('Родитель процесса контейнера. Он посылает процессу сигнал и ждёт его кода выхода.', 'Sends the signal to the container process and waits for its exit code.'), who: bi('Его запустил containerd, когда создавал контейнер.', 'containerd.') } },
      { id: 'timer', label: bi('Ожидание', 'Grace period'), sub: '0 / 10 s', family: 'gauge', shape: 'buffer', x: 688, y: 64, w: 248, h: 64, card: { what: bi('Сколько Docker ждёт после сигнала остановки. Если процесс за это время не завершился, Docker посылает SIGKILL, и код выхода будет 137, то есть 128 + 9, номер сигнала KILL.', 'How long the daemon waits after the stop signal. If the process has not exited — SIGKILL, code 137 = 128 + 9.'), who: bi('Время задают флаг --stop-timeout при запуске или `docker stop -t`.', 'dockerd; changed by --stop-timeout or `docker stop -t`.'), doc: { page: 'web/docs.docker.com/reference/cli/docker/container/run', anchor: 'stop-timeout' } } },
      { id: 'pid1', label: 'PID 1', icon: 'process', sub: 'python app.py', family: 'process', x: 272, y: 232, w: 280, h: 64, card: { what: bi('Первый процесс в пространстве имён PID контейнера. Ядро его бережёт: сигнал, для которого у процесса нет обработчика, ему не доставляется, и действие по умолчанию «завершиться» для PID 1 не срабатывает.', 'The first process of the container’s pid namespace. The kernel protects it: a signal without a handler is not delivered (the default “die” action does not apply to PID 1).'), who: bi('Это та программа, что записана в ENTRYPOINT и CMD образа.', 'Whatever the image’s ENTRYPOINT/CMD says.'), see: 'grep SigCgt /proc/1/status', doc: man('pid_namespaces', 7) } },
      { id: 'child', label: bi('Дочерний процесс', 'Child'), icon: 'process', sub: 'python app.py', family: 'process', x: 640, y: 232, w: 280, h: 64, card: { what: bi('Процесс, который запустил PID 1. Он уже не первый, поэтому сигнал без обработчика его просто завершает.', 'A child of PID 1. It is not PID 1: a signal without a handler simply ends it.'), who: bi('Его запустил PID 1.', 'PID 1 started it.') } },
      { id: 'kernel', label: bi('Ядро: доставка сигнала', 'Kernel: signal delivery'), sub: 'SigCgt · pid_namespaces(7)', family: 'kernel', shape: 'bar', x: 24, y: 384, w: 912, h: 88, card: { what: bi('Ядро проверяет, есть ли у процесса обработчик сигнала (маска SigCgt в `/proc/<pid>/status`). Первому процессу пространства имён сигнал без обработчика не доставляется, а SIGKILL доставляется всегда.', 'The kernel checks whether the process has a handler for the signal (the SigCgt mask in /proc/<pid>/status). For the init of a namespace without a handler the signal is dropped; SIGKILL always goes through.'), who: bi('Это правило ядра Linux.', 'The Linux kernel.'), doc: man('signal', 7) } },
    ],
    edges: [
      { id: 'e-api', from: 'cli', to: 'dockerd', label: 'POST /stop', card: { what: bi('Клиент docker отправляет демону запрос к его API: остановить контейнер app.', 'A request to the daemon API.'), who: bi('Запрос отправляет клиент docker.', 'The docker CLI.') } },
      { id: 'e-kill', from: 'dockerd', to: 'shim', label: bi('послать сигнал', 'send signal'), card: { what: bi('Демон просит containerd и shim послать сигнал остановки.', 'The daemon asks containerd/the shim to send the stop signal.'), who: bi('Послать сигнал просит демон dockerd.', 'dockerd.') } },
      { id: 'e-sig', from: 'shim', to: 'pid1', label: 'kill(1)', card: { what: bi('Сигнал получает только PID 1 контейнера, а не все его процессы.', 'Only PID 1 of the container receives the signal — not every process.'), who: bi('Сигнал первому процессу посылает shim.', 'The shim.') } },
      { id: 'e-fwd', from: 'pid1', to: 'child', label: bi('передать сигнал?', 'pass the signal on?'), card: { what: bi('tini передаёт сигнал дочернему процессу, а оболочка sh, которая запустила программу, этого не делает: она ждёт дочерний процесс и сигналы не пересылает.', 'tini passes the signal to the child. A sh shell that started the program does not: it waits for the child and does not forward signals.'), who: bi('Передать ли сигнал дальше, решает сам PID 1.', 'PID 1.') } },
      { id: 'e-deliver', from: 'pid1', to: 'kernel', label: bi('обработчик есть?', 'is there a handler?'), card: { what: bi('В ядре здесь развилка: если обработчик есть, программа сама решает, что делать с сигналом, а если нет, первому процессу сигнал не доставляется.', 'The kernel’s fork: with a handler the program decides; without one the signal is ignored for PID 1.'), who: bi('Есть ли обработчик, проверяет ядро.', 'The kernel.') } },
      { id: 'e-sigkill', from: 'timer', to: 'shim', via: [[812, 160], [564, 160]], label: 'SIGKILL', labelAt: 0.5, card: { what: bi('Время ожидания вышло, и Docker посылает SIGKILL. Этот сигнал нельзя ни перехватить, ни проигнорировать; код выхода будет 137.', 'Time is up: SIGKILL, which can be neither caught nor ignored. Exit code 137.'), who: bi('SIGKILL посылает dockerd через shim.', 'dockerd.') } },
    ],
  },
  params: [
    {
      id: 'pid1',
      label: bi('Какая программа работает в контейнере как PID 1', 'What runs as PID 1'),
      kind: 'choice',
      default: 'shell',
      options: [
        { id: 'shell', label: bi('оболочка: sh -c "python app.py; echo exited" (shell-форма CMD)', 'sh -c "python app.py; echo exited" (shell form)') },
        { id: 'nohandler', label: bi('python app.py без обработчика SIGTERM (exec-форма CMD)', 'python app.py (exec form, no handler)') },
        { id: 'handler', label: bi('python app.py с обработчиком SIGTERM', 'python app.py with a SIGTERM handler') },
        { id: 'init', label: bi('tini, который запускает python app.py (флаг --init)', '--init: tini → python app.py') },
      ],
      near: 'pid1',
      group: IMG,
      predict: {
        prompt: bi('Вы меняете PID 1. Допустим, теперь CMD записан в exec-форме, python сам стал PID 1, а обработчика SIGTERM в коде нет. Как остановится контейнер?', 'You change PID 1. Say CMD is now in exec form, python itself is PID 1, and the code has no SIGTERM handler. How does the container stop?'),
        options: [
          { id: 'kill', text: bi('Через 10 секунд, сигналом SIGKILL, с кодом 137', 'After 10 seconds, SIGKILL, code 137') },
          { id: 'fast', text: bi('Сразу, с кодом 143', 'At once, code 143') },
        ],
        resolve: () => 'kill',
      },
    },
    { id: 'signal', label: bi('Сигнал остановки (STOPSIGNAL)', 'STOPSIGNAL'), kind: 'choice', default: 'SIGTERM', options: [{ id: 'SIGTERM', label: bi('SIGTERM, по умолчанию', 'SIGTERM (default)') }, { id: 'SIGINT', label: bi('SIGINT', 'SIGINT') }], near: 'dockerd', group: IMG },
    { id: 'timeout', label: bi('Сколько ждать перед SIGKILL (--stop-timeout)', '--stop-timeout'), kind: 'range', min: 1, max: 60, step: 1, unit: 's', default: 10, near: 'timer', group: bi('Как останавливают', 'How it is stopped') },
  ],
  breaks: [
    {
      id: 'zombies',
      label: bi('PID 1 не забирает коды выхода своих завершившихся детей', 'PID 1 does not reap its exited children'),
      remove: ['e-fwd'],
      boundary: 'process',
      predict: {
        prompt: bi('Приложение постоянно запускает рабочие процессы, а PID 1 никогда не вызывает wait(), чтобы забрать их коды выхода. Что накопится в контейнере?', 'The application spawns worker processes and PID 1 never calls wait(). What piles up?'),
        options: [
          { id: 'zombie', text: bi('Процессы-зомби: строки [sh] <defunct> в списке процессов', 'Zombies: [sh] <defunct> lines in the process table') },
          { id: 'mem', text: bi('Утечка памяти в самом приложении', 'An application memory leak') },
        ],
        resolve: () => 'zombie',
      },
    },
  ],
  metrics: [
    { id: 'ms', label: bi('остановка заняла', 'the stop took'), unit: 'ms' },
    { id: 'code', label: bi('код выхода', 'exit code') },
    { id: 'zombies', label: bi('процессов-зомби', 'zombies') },
  ],
  run(p, broken): Step[] {
    const r = stopResult(p.pid1, p.timeout, p.signal);
    const sig = p.signal;
    const pid1Label = p.pid1 === 'shell' ? 'sh -c "python app.py; …"' : p.pid1 === 'init' ? 'tini (docker-init)' : 'python app.py';
    const hasChild = p.pid1 === 'shell' || p.pid1 === 'init';
    const zombies = broken.has('zombies') && p.pid1 !== 'init' ? 12 : 0;
    const what = { shell: bi('оболочка sh, которая запустила python', 'the sh shell that started python'), nohandler: bi('сам python, без обработчика SIGTERM', 'python itself, without a SIGTERM handler'), handler: bi('сам python, с обработчиком SIGTERM', 'python itself, with a SIGTERM handler'), init: bi('маленький init tini, а python его дочерний процесс', 'the tiny init tini, with python as its child') }[p.pid1] ?? bi('python', 'python');
    const steps: Step[] = [
      {
        id: 'cmd',
        label: bi('команда', 'command'),
        caption: bi('Вы набрали `docker stop app`. Команда сама ничего не останавливает: она передаёт просьбу демону Docker.', 'You typed `docker stop app`. The command stops nothing itself: it passes the request to the Docker daemon.'),
        focus: ['cli'],
        say: { cli: bi('Вы просите Docker остановить контейнер app.', 'You ask Docker to stop the app container.') },
        states: startWith(ALL, 'cli'),
        values: { pid1: pid1Label, child: 'python app.py', timer: `0 / ${p.timeout} s` },
        fill: { timer: 0 },
        metrics: { ms: 0, zombies },
      },
      {
        id: 'daemon',
        label: 'dockerd',
        caption: fmtb(bi('Демон выбирает сигнал остановки, сейчас это {s}, и время ожидания, {t} с. Если за это время процесс не завершится, демон завершит его принудительно.', 'The daemon picks the stop signal, {s} now, and the wait, {t} s. If the process does not exit in that time, the daemon kills it.'), { s: sig, t: p.timeout }),
        focus: ['dockerd', 'e-api'],
        reveal: ['dockerd', 'e-api', 'timer'],
        tokens: [{ edge: 'e-api', label: 'POST /containers/app/stop' }],
        say: { dockerd: fmtb(bi('dockerd выбирает сигнал {s} и заводит таймер на {t} с.', 'dockerd picks {s} and sets a {t} s timer.'), { s: sig, t: p.timeout }) },
        metrics: { ms: 0, zombies },
      },
      {
        id: 'shim',
        label: 'shim',
        caption: fmtb(bi('dockerd через containerd просит shim послать сигнал. Shim посылает {s} только процессу номер 1 в контейнере, остальные процессы этот сигнал не получат.', '`docker stop` → dockerd → shim → kill(1, {s}). Only PID 1 gets the signal.'), { s: sig }),
        focus: ['shim', 'e-kill'],
        reveal: ['shim', 'e-kill'],
        tokens: [{ edge: 'e-kill', label: sig }],
        say: { shim: fmtb(bi('shim посылает {s} первому процессу контейнера.', 'The shim sends {s} to the container’s first process.'), { s: sig }) },
        metrics: { ms: 0, zombies },
      },
      {
        id: 'pid1',
        label: 'PID 1',
        caption: fmtb(bi('Сигнал приходит к PID 1. Сейчас под этим номером работает {w}.', 'The signal reaches PID 1. Right now PID 1 is {w}.'), { w: what }),
        focus: ['pid1', 'e-sig'],
        reveal: ['pid1', 'e-sig', ...(hasChild ? ['child'] : [])],
        tokens: [{ edge: 'e-sig', label: sig }],
        say: { pid1: fmtb(bi('PID 1 — {w}.', 'PID 1 is {w}.'), { w: what }) },
        metrics: { ms: 0, zombies },
      },
    ];
    if (r.rule === 'tini') {
      steps.push({
        id: 'forward',
        label: bi('передал', 'forwarded'),
        caption: fmtb(bi('tini — PID 1 с обработчиками сигналов: он пересылает {s} дочернему процессу. Python уже не первый процесс, поэтому сигнал без обработчика просто завершает его с кодом {c}, то есть 128 плюс номер сигнала. Заодно tini забирает коды выхода завершившихся процессов, и зомби не копятся.', 'tini is PID 1 with handlers: it forwards {s} to the child. Python is no longer PID 1, so a signal without a handler ends it: code {c} = 128 + the signal number. tini also reaps zombies.'), { s: sig, c: r.code }),
        focus: ['child', 'e-fwd'],
        reveal: ['e-fwd'],
        tokens: [{ edge: 'e-fwd', label: sig }],
        say: { child: fmtb(bi('python получает {s} и завершается с кодом {c}.', 'python gets {s} and exits with code {c}.'), { s: sig, c: r.code }) },
        states: { child: 'ok', pid1: 'ok' },
        metrics: { ms: r.ms, code: r.code, zombies: 0 },
      });
    } else if (r.rule === 'handler') {
      steps.push({
        id: 'handle',
        label: bi('обработал', 'handled'),
        caption:
          p.pid1 === 'handler' && sig === 'SIGTERM'
            ? bi('Ядро видит, что у python есть обработчик SIGTERM, и доставляет сигнал. Обработчик закрывает соединения, и программа завершается сама с кодом 0, так что ждать не пришлось.', 'Python has a SIGTERM handler: it closes connections and exits by itself with code 0. No waiting.')
            : bi('SIGINT у Python обработан всегда: интерпретатор превращает его в исключение KeyboardInterrupt, и программа завершается с кодом 130. Поэтому сменить сигнал остановки — способ остановить программу, в которой нет своего обработчика SIGTERM.', 'Python always handles SIGINT: it becomes KeyboardInterrupt and the program exits with code 130. Changing the stop signal is a way to stop a program without its own handler.'),
        focus: ['kernel', 'e-deliver'],
        reveal: ['kernel', 'e-deliver'],
        say: { kernel: fmtb(bi('У PID 1 есть обработчик {s}, и ядро доставляет сигнал.', 'PID 1 has a {s} handler, so the kernel delivers the signal.'), { s: sig }) },
        states: { pid1: 'ok' },
        metrics: { ms: r.ms, code: r.code, zombies },
      });
    } else {
      steps.push({
        id: 'ignored',
        label: bi('отброшен', 'dropped'),
        caption:
          r.rule === 'shell'
            ? fmtb(bi('PID 1 здесь — оболочка sh. Обработчика {s} у неё нет, а для первого процесса ядро такие сигналы отбрасывает. Пересылать сигнал дочернему процессу sh не умеет, поэтому python о нём так и не узнал.', 'PID 1 is the sh shell. It has no {s} handler and it is PID 1 — the kernel drops the signal. sh does not forward it to the child: python never hears of it.'), { s: sig })
            : fmtb(bi('PID 1 здесь — сам python, но обработчика {s} в коде нет. Первому процессу пространства имён ядро сигнал без обработчика не доставляет, и ничего не происходит.', 'PID 1 is python itself, but it has no {s} handler. For the init of a namespace a signal without a handler is not delivered — nothing happens.'), { s: sig }),
        focus: ['kernel', 'e-deliver'],
        reveal: ['kernel', 'e-deliver'],
        say: { kernel: fmtb(bi('У PID 1 нет обработчика {s}, и ядро отбрасывает сигнал.', 'PID 1 has no {s} handler, so the kernel drops the signal.'), { s: sig }) },
        states: { kernel: 'warn', pid1: 'warn' },
        metrics: { ms: 0, zombies },
      });
      steps.push({
        id: 'wait',
        label: bi('ожидание', 'waiting'),
        caption: fmtb(bi('Контейнер продолжает работать, а демон ждёт все {t} с, пока таймер не заполнится.', 'The container keeps running while the daemon waits the full {t} s until the timer fills.'), { t: p.timeout }),
        focus: ['timer'],
        say: { timer: fmtb(bi('Процесс не завершается, и Docker ждёт все {t} с.', 'The process does not exit, and Docker waits the full {t} s.'), { t: p.timeout }) },
        fill: { timer: 1 },
        values: { timer: `${p.timeout} / ${p.timeout} s` },
        states: { timer: 'wait' },
        metrics: { ms: r.ms, zombies },
      });
      steps.push({
        id: 'kill',
        label: 'SIGKILL',
        caption: bi('Время вышло, и Docker посылает SIGKILL. Этот сигнал нельзя перехватить, поэтому ядро завершает PID 1, а вместе с ним и все процессы его пространства имён. Код выхода 137, то есть 128 + 9: номер сигнала KILL равен 9.', 'Time is up: SIGKILL. It cannot be caught — the kernel kills PID 1 and the whole pid namespace with it. Code 137 = 128 + 9.'),
        focus: ['pid1', 'e-sigkill'],
        reveal: ['e-sigkill'],
        tokens: [{ edge: 'e-sigkill', label: 'SIGKILL' }],
        say: { pid1: bi('SIGKILL завершает PID 1 принудительно, код выхода 137.', 'SIGKILL ends PID 1 by force, exit code 137.') },
        states: { pid1: 'err', child: 'off', timer: 'on' },
        metrics: { ms: r.ms, code: 137, zombies },
      });
    }
    if (zombies)
      steps.push({
        id: 'zombie',
        label: bi('зомби', 'zombies'),
        caption: bi('PID 1 никогда не вызывает wait(), поэтому завершившиеся дочерние процессы остаются в списке процессов как зомби, `[sh] <defunct>`. Исправляется это так же: в контейнере нужен настоящий init, флаг `--init` или tini в ENTRYPOINT.', 'PID 1 never calls wait(): exited children stay in the process table as zombies `[sh] <defunct>`. The fix is the same — an init: `--init` or tini in ENTRYPOINT.'),
        focus: ['child'],
        reveal: ['child'],
        say: { child: bi('Завершившиеся дочерние процессы ждут, пока PID 1 заберёт их коды выхода.', 'Exited children wait for PID 1 to collect their exit codes.') },
        states: { child: 'warn' },
        values: { child: '[sh] <defunct> × 12' },
        metrics: { ms: r.ms, code: r.code, zombies },
        broken: { at: 'pid1', message: '  PID USER     TIME  COMMAND\n    1 root      0:00 python app.py\n   23 root      0:00 [sh] <defunct>\n   24 root      0:00 [sh] <defunct>', caption: bi('в PID 1. Настоящий init забирает коды выхода детей, а приложение в роли PID 1 обычно этого не делает.', 'a real init reaps children; an application acting as PID 1 usually does not.') },
      });
    return steps;
  },
  explainDelta(_prev, next, change, a, b): Bi {
    const m = next[next.length - 1]?.metrics ?? {};
    if (change.kind === 'break')
      return change.on
        ? b.pid1 === 'init'
          ? bi('С tini зомби не копятся: он сам забирает коды выхода дочерних процессов.', 'With tini zombies do not pile up: it reaps them.')
          : bi('PID 1 не вызывает wait(), и зомби копятся.', 'A PID 1 without wait() — zombies pile up.')
        : bi('Поломку убрали.', 'The failure is removed.');
    const r = stopResult(b.pid1, b.timeout, b.signal);
    const why = {
      handler: bi('сработал обработчик сигнала', 'a signal handler ran'),
      ignored: bi('у PID 1 нет обработчика, сигнал отброшен, и Docker ждал до конца', 'PID 1 without a handler — the signal was ignored and the timeout ran out'),
      shell: bi('PID 1 — оболочка sh, которая сигнал не пересылает', 'PID 1 is sh, which does not forward the signal'),
      tini: bi('tini передал сигнал дочернему процессу, который уже не PID 1', 'tini passed the signal to a child that is not PID 1'),
    }[r.rule];
    if (change.id === 'timeout') return fmtb(bi('Время ожидания изменилось с {a} на {b} с, и остановка заняла {ms} мс, потому что {w}.', '--stop-timeout {a} → {b} s: the stop takes {ms} ms — {w}.'), { a: a.timeout, b: b.timeout, ms: m.ms ?? 0, w: why });
    return fmtb(bi('Код выхода {c}, остановка заняла {ms} мс, потому что {w}.', 'Code {c}, the stop took {ms} ms: {w}.'), { c: m.code ?? 0, ms: m.ms ?? 0, w: why });
  },
});
