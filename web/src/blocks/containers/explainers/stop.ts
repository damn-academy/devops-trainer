// X7 (04 §6.8): `docker stop` — the stop signal, PID 1 and the grace
// period. The kernel rule of pid_namespaces(7): the init process of a pid
// namespace gets only the signals it has a handler for (SIGKILL from the
// parent namespace always works). The knob says what PID 1 is.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';

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

const man = (n: string, s: number) => ({ url: `https://man7.org/linux/man-pages/man${s}/${n}.${s}.html`, label: `${n}(${s})` });

export const stopModel = defineModel<P>({
  id: 'containers.stop',
  block: 'containers',
  title: bi('docker stop: сигналы и PID 1', 'docker stop: signals and PID 1'),
  summary: bi('Почему одни контейнеры останавливаются мгновенно, а другие ровно через 10 секунд с кодом 137. Меняйте то, чем является PID 1, — и смотрите, какое из трёх условий сработало.', 'Why some containers stop at once and others after exactly 10 seconds with code 137. Change what PID 1 is and see which of the three conditions fired.'),
  concepts: ['docker.pid1'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      { id: 'cli', label: 'docker stop app', family: 'user', x: 24, y: 40, w: 200, h: 56, card: { what: bi('Команда остановки: «пошли сигнал остановки, подожди, потом убей».', 'The stop command: “send the stop signal, wait, then kill”.'), who: bi('Вы или оркестратор.', 'You or an orchestrator.'), doc: { page: 'help/docker-stop' } } },
      { id: 'dockerd', label: 'dockerd', family: 'cp', x: 264, y: 40, w: 168, h: 56, card: { what: bi('Демон выбирает сигнал (StopSignal образа или --stop-signal, по умолчанию SIGTERM) и время ожидания (10 с или --stop-timeout / -t).', 'The daemon picks the signal (the image StopSignal or --stop-signal, SIGTERM by default) and the wait (10 s or --stop-timeout / -t).'), who: bi('systemd.', 'systemd.') } },
      { id: 'shim', label: 'shim', family: 'process', x: 472, y: 40, w: 168, h: 56, card: { what: bi('Посылает сигнал процессу контейнера и ждёт его кода выхода.', 'Sends the signal to the container process and waits for its exit code.'), who: bi('containerd.', 'containerd.') } },
      { id: 'timer', label: bi('ожидание', 'grace period'), sub: '0 / 10 s', family: 'gauge', shape: 'buffer', x: 680, y: 40, w: 256, h: 64, card: { what: bi('Сколько демон ждёт после сигнала остановки. Не вышел процесс — SIGKILL, код 137 = 128 + 9.', 'How long the daemon waits after the stop signal. If the process has not exited — SIGKILL, code 137 = 128 + 9.'), who: bi('dockerd; меняется --stop-timeout или `docker stop -t`.', 'dockerd; changed by --stop-timeout or `docker stop -t`.'), doc: { page: 'web/docs.docker.com/reference/cli/docker/container/run', anchor: 'stop-timeout' } } },
      { id: 'pid1', label: 'PID 1', sub: 'python app.py', family: 'process', x: 264, y: 192, w: 280, h: 64, card: { what: bi('Первый процесс pid namespace контейнера. Ядро защищает его: сигнал без обработчика ему не доставляется (действие по умолчанию «умереть» для PID 1 не работает).', 'The first process of the container’s pid namespace. The kernel protects it: a signal without a handler is not delivered (the default “die” action does not apply to PID 1).'), who: bi('То, что записано в ENTRYPOINT/CMD образа.', 'Whatever the image’s ENTRYPOINT/CMD says.'), see: 'grep SigCgt /proc/1/status', doc: man('pid_namespaces', 7) } },
      { id: 'child', label: bi('ребёнок', 'child'), sub: 'python app.py', family: 'process', x: 624, y: 192, w: 280, h: 64, card: { what: bi('Процесс-ребёнок PID 1. Он уже не PID 1: сигнал без обработчика его просто завершает.', 'A child of PID 1. It is not PID 1: a signal without a handler simply ends it.'), who: bi('PID 1 запустил его.', 'PID 1 started it.') } },
      { id: 'kernel', label: bi('ядро: доставка сигнала', 'kernel: signal delivery'), sub: 'SigCgt · pid_namespaces(7)', family: 'kernel', shape: 'bar', x: 24, y: 344, w: 912, h: 96, card: { what: bi('Ядро смотрит, есть ли у процесса обработчик сигнала (маска SigCgt в /proc/<pid>/status). Для init пространства имён без обработчика сигнал отбрасывается; SIGKILL — всегда.', 'The kernel checks whether the process has a handler for the signal (the SigCgt mask in /proc/<pid>/status). For the init of a namespace without a handler the signal is dropped; SIGKILL always goes through.'), who: bi('Ядро Linux.', 'The Linux kernel.'), doc: man('signal', 7) } },
    ],
    edges: [
      { id: 'e-api', from: 'cli', to: 'dockerd', label: 'POST /containers/app/stop', card: { what: bi('Запрос к API демона.', 'A request to the daemon API.'), who: bi('docker CLI.', 'The docker CLI.') } },
      { id: 'e-kill', from: 'dockerd', to: 'shim', label: 'Kill(SIGTERM)', card: { what: bi('Демон просит containerd/shim послать сигнал остановки.', 'The daemon asks containerd/the shim to send the stop signal.'), who: bi('dockerd.', 'dockerd.') } },
      { id: 'e-sig', from: 'shim', to: 'pid1', label: 'kill(1, SIGTERM)', card: { what: bi('Сигнал получает только PID 1 контейнера — не все процессы.', 'Only PID 1 of the container receives the signal — not every process.'), who: bi('shim.', 'The shim.') } },
      { id: 'e-fwd', from: 'pid1', to: 'child', label: bi('передать сигнал?', 'pass the signal on?'), card: { what: bi('tini передаёт сигнал ребёнку. Оболочка sh, запустившая программу, — нет: она ждёт ребёнка и сигнал не пересылает.', 'tini passes the signal to the child. A sh shell that started the program does not: it waits for the child and does not forward signals.'), who: bi('PID 1.', 'PID 1.') } },
      { id: 'e-deliver', from: 'pid1', to: 'kernel', label: bi('обработчик есть?', 'is there a handler?'), card: { what: bi('Развилка ядра: обработчик есть — программа решает сама; нет — для PID 1 сигнал игнорируется.', 'The kernel’s fork: with a handler the program decides; without one the signal is ignored for PID 1.'), who: bi('Ядро.', 'The kernel.') } },
      { id: 'e-sigkill', from: 'timer', to: 'shim', via: [[808, 136], [556, 136]], label: 'SIGKILL', labelAt: 0.5, card: { what: bi('Время вышло: SIGKILL, его нельзя ни перехватить, ни проигнорировать. Код выхода 137.', 'Time is up: SIGKILL, which can be neither caught nor ignored. Exit code 137.'), who: bi('dockerd.', 'dockerd.') } },
    ],
  },
  params: [
    { id: 'pid1', label: bi('Что работает как PID 1', 'What runs as PID 1'), kind: 'choice', default: 'shell', options: [{ id: 'shell', label: bi('sh -c "python app.py; echo exited" (shell-форма)', 'sh -c "python app.py; echo exited" (shell form)') }, { id: 'nohandler', label: bi('python app.py (exec-форма, без обработчика)', 'python app.py (exec form, no handler)') }, { id: 'handler', label: bi('python app.py с обработчиком SIGTERM', 'python app.py with a SIGTERM handler') }, { id: 'init', label: bi('--init: tini → python app.py', '--init: tini → python app.py') }], near: 'pid1', predict: { prompt: bi('Перешли на exec-форму: python — сам PID 1, обработчика SIGTERM нет. Как остановится контейнер?', 'Switched to the exec form: python itself is PID 1, without a SIGTERM handler. How does the container stop?'), options: [{ id: 'kill', text: bi('Через 10 секунд, SIGKILL, код 137', 'After 10 seconds, SIGKILL, code 137') }, { id: 'fast', text: bi('Сразу, код 143', 'At once, code 143') }], resolve: (_p, n) => ((n[n.length - 1]?.metrics?.code ?? 0) === 137 ? 'kill' : 'fast') } },
    { id: 'timeout', label: bi('--stop-timeout', '--stop-timeout'), kind: 'range', min: 1, max: 60, step: 1, unit: 's', default: 10, near: 'timer' },
    { id: 'signal', label: bi('STOPSIGNAL', 'STOPSIGNAL'), kind: 'choice', default: 'SIGTERM', options: [{ id: 'SIGTERM', label: bi('SIGTERM (по умолчанию)', 'SIGTERM (default)') }, { id: 'SIGINT', label: bi('SIGINT', 'SIGINT') }], near: 'dockerd' },
  ],
  breaks: [
    { id: 'zombies', label: bi('PID 1 не забирает завершившихся детей', 'PID 1 does not reap its exited children'), remove: ['e-fwd'], boundary: 'process', predict: { prompt: bi('Приложение порождает рабочие процессы, а PID 1 не вызывает wait(). Что накопится?', 'The application spawns worker processes and PID 1 never calls wait(). What piles up?'), options: [{ id: 'zombie', text: bi('Зомби: строки [sh] <defunct> в таблице процессов', 'Zombies: [sh] <defunct> lines in the process table') }, { id: 'mem', text: bi('Утечка памяти приложения', 'An application memory leak') }], resolve: () => 'zombie' } },
  ],
  metrics: [
    { id: 'ms', label: bi('остановка заняла', 'the stop took'), unit: 'ms' },
    { id: 'code', label: bi('код выхода', 'exit code') },
    { id: 'zombies', label: bi('зомби', 'zombies') },
  ],
  run(p, broken): Step[] {
    const r = stopResult(p.pid1, p.timeout, p.signal);
    const sig = p.signal;
    const pid1Label = p.pid1 === 'shell' ? 'sh -c "python app.py; …"' : p.pid1 === 'init' ? 'tini (docker-init)' : 'python app.py';
    const hasChild = p.pid1 === 'shell' || p.pid1 === 'init';
    const zombies = broken.has('zombies') && p.pid1 !== 'init' ? 12 : 0;
    const steps: Step[] = [
      { id: 'send', label: bi('сигнал', 'signal'), caption: fmt(bi('`docker stop` → dockerd → shim → kill(1, {s}). Сигнал получает только PID 1.', '`docker stop` → dockerd → shim → kill(1, {s}). Only PID 1 gets the signal.'), { s: sig }), focus: ['cli', 'e-api', 'dockerd', 'e-kill', 'shim', 'e-sig', 'pid1'], tokens: [{ edge: 'e-sig', label: sig }], values: { pid1: pid1Label, child: hasChild ? 'python app.py' : '—', timer: `0 / ${p.timeout} s` }, states: { child: hasChild ? 'on' : 'off' }, fill: { timer: 0 }, metrics: { ms: 0, code: 0, zombies } },
    ];
    if (r.rule === 'tini') {
      steps.push({ id: 'forward', label: bi('передал', 'forwarded'), caption: fmt(bi('tini — PID 1 с обработчиками: он пересылает {s} ребёнку. Python уже не PID 1, и сигнал без обработчика его завершает: код {c} = 128 + номер сигнала. Заодно tini забирает зомби.', 'tini is PID 1 with handlers: it forwards {s} to the child. Python is no longer PID 1, so a signal without a handler ends it: code {c} = 128 + the signal number. tini also reaps zombies.'), { s: sig, c: r.code }), focus: ['e-fwd', 'child'], tokens: [{ edge: 'e-fwd', label: sig }], states: { child: 'off', pid1: 'off' }, metrics: { ms: r.ms, code: r.code, zombies: 0 } });
    } else if (r.rule === 'handler') {
      steps.push({ id: 'handle', label: bi('обработал', 'handled'), caption: p.pid1 === 'handler' && sig === 'SIGTERM' ? bi('У python есть обработчик SIGTERM: он закрывает соединения и выходит сам с кодом 0. Ждать не пришлось.', 'Python has a SIGTERM handler: it closes connections and exits by itself with code 0. No waiting.') : fmt(bi('SIGINT у Python обработан всегда: он превращается в KeyboardInterrupt, и программа выходит с кодом {c}. Сменить сигнал остановки — способ остановить программу без своего обработчика.', 'Python always handles SIGINT: it becomes KeyboardInterrupt and the program exits with code {c}. Changing the stop signal is a way to stop a program without its own handler.'), { c: r.code }), focus: ['e-deliver', 'kernel', 'pid1'], tokens: [{ edge: 'e-deliver' }], states: { pid1: 'off' }, metrics: { ms: r.ms, code: r.code, zombies } });
    } else {
      steps.push({ id: 'ignored', label: bi('игнор', 'ignored'), caption: r.rule === 'shell' ? fmt(bi('PID 1 — оболочка sh. У неё нет обработчика {s}, и она PID 1 — ядро сигнал отбрасывает. Пересылать его ребёнку sh не умеет: python ничего не узнал.', 'PID 1 is the sh shell. It has no {s} handler and it is PID 1 — the kernel drops the signal. sh does not forward it to the child: python never hears of it.'), { s: sig }) : fmt(bi('PID 1 — сам python, но обработчика {s} у него нет. Для init пространства имён сигнал без обработчика не доставляется — ничего не происходит.', 'PID 1 is python itself, but it has no {s} handler. For the init of a namespace a signal without a handler is not delivered — nothing happens.'), { s: sig }), focus: ['e-deliver', 'kernel'], tokens: [{ edge: 'e-deliver' }], states: { kernel: 'warn' }, metrics: { ms: 0, code: 0, zombies } });
      steps.push({ id: 'wait', label: bi('ждём', 'waiting'), caption: fmt(bi('Демон ждёт {t} с…', 'The daemon waits {t} s…'), { t: p.timeout }), focus: ['timer'], fill: { timer: 1 }, values: { timer: `${p.timeout} / ${p.timeout} s` }, states: { timer: 'wait' }, metrics: { ms: r.ms, code: 0, zombies } });
      steps.push({ id: 'kill', label: 'SIGKILL', caption: bi('Время вышло: SIGKILL. Его нельзя перехватить — ядро убивает PID 1, а с ним и весь pid namespace. Код 137 = 128 + 9.', 'Time is up: SIGKILL. It cannot be caught — the kernel kills PID 1 and the whole pid namespace with it. Code 137 = 128 + 9.'), focus: ['e-sigkill', 'shim', 'pid1'], tokens: [{ edge: 'e-sigkill', label: 'SIGKILL' }], states: { pid1: 'err', child: 'off' }, metrics: { ms: r.ms, code: 137, zombies } });
    }
    if (zombies) steps.push({ id: 'zombie', label: bi('зомби', 'zombies'), caption: bi('PID 1 не вызывает wait(): завершившиеся дети остаются в таблице процессов как зомби `[sh] <defunct>`. Решение то же — init: `--init` или tini в ENTRYPOINT.', 'PID 1 never calls wait(): exited children stay in the process table as zombies `[sh] <defunct>`. The fix is the same — an init: `--init` or tini in ENTRYPOINT.'), focus: ['pid1', 'child'], states: { child: 'warn' }, values: { child: '[sh] <defunct> × 12' }, metrics: { ms: r.ms, code: r.code, zombies }, broken: { at: 'pid1', message: '  PID USER     TIME  COMMAND\n    1 root      0:00 python app.py\n   23 root      0:00 [sh] <defunct>\n   24 root      0:00 [sh] <defunct>', caption: bi('настоящий init забирает детей; приложение в роли PID 1 обычно нет.', 'a real init reaps children; an application acting as PID 1 usually does not.') } });
    return steps;
  },
  explainDelta(_prev, next, change, a, b): Bi {
    const m = next[next.length - 1]?.metrics ?? {};
    if (change.kind === 'break') return change.on ? (b.pid1 === 'init' ? bi('С tini зомби не копятся: он их забирает.', 'With tini zombies do not pile up: it reaps them.') : bi('PID 1 без wait() — зомби копятся.', 'A PID 1 without wait() — zombies pile up.')) : bi('Поломка убрана.', 'The failure is removed.');
    const r = stopResult(b.pid1, b.timeout, b.signal);
    const why = { handler: bi('сработал обработчик сигнала', 'a signal handler ran'), ignored: bi('PID 1 без обработчика — сигнал проигнорирован, ждали таймаут', 'PID 1 without a handler — the signal was ignored and the timeout ran out'), shell: bi('PID 1 — sh, который не пересылает сигнал', 'PID 1 is sh, which does not forward the signal'), tini: bi('tini передал сигнал ребёнку, который уже не PID 1', 'tini passed the signal to a child that is not PID 1') }[r.rule];
    if (change.id === 'timeout') return { ru: `--stop-timeout ${a.timeout} → ${b.timeout} с: остановка ${m.ms ?? 0} мс — ${why.ru}.`, en: `--stop-timeout ${a.timeout} → ${b.timeout} s: the stop takes ${m.ms ?? 0} ms — ${why.en}.` };
    return { ru: `Код ${m.code ?? 0}, остановка ${m.ms ?? 0} мс: ${why.ru}.`, en: `Code ${m.code ?? 0}, the stop took ${m.ms ?? 0} ms: ${why.en}.` };
  },
});
