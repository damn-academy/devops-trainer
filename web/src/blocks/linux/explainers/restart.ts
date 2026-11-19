// X4 «systemd restarts a failed service» (02 §6.6 X4). The unit's state
// machine is simulated from the knobs with the rules of systemd.service(5):
// on-failure restarts on a non-zero code and on an unclean signal, on-abnormal
// only on a signal, always on anything but `systemctl stop`; restarts are
// counted in a sliding window of StartLimitIntervalSec and the start after
// StartLimitBurst ends in `start-limit-hit`. Defaults are those of systemd 257:
// Restart=no, RestartSec=100ms, StartLimitIntervalSec=10s, StartLimitBurst=5.

import { defineModel } from '../../../core/define';
import { bi, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { fmtb } from './util';

type P = { restart: string; restartSec: number; burst: number; crash: string; after: number };

const CAUSE: Record<string, { sig?: string; code: number; text: Bi; log: string }> = {
  exit1: { code: 1, text: bi('выход с кодом 1', 'exit with code 1'), log: 'code=exited, status=1/FAILURE' },
  kill: { sig: 'KILL', code: 137, text: bi('kill -9 (SIGKILL)', 'kill -9 (SIGKILL)'), log: 'code=killed, status=9/KILL' },
  term: { sig: 'TERM', code: 143, text: bi('SIGTERM', 'SIGTERM'), log: 'code=killed, status=15/TERM' },
  oom: { sig: 'KILL', code: 137, text: bi('OOM killer', 'the OOM killer'), log: 'code=killed, status=9/KILL' },
};

/** Does Restart= restart after this kind of exit? (systemd.service(5), table "Exit causes and the effect of the Restart= settings") */
export function restarts(restart: string, crash: string): boolean {
  const c = CAUSE[crash] ?? CAUSE.exit1;
  const clean = c.sig ? ['HUP', 'INT', 'TERM', 'PIPE'].includes(c.sig) : c.code === 0;
  if (restart === 'always') return true;
  if (restart === 'on-failure') return !clean;
  if (restart === 'on-abnormal') return !!c.sig && !clean;
  return false;
}

export interface RestartSim {
  events: { t: number; kind: 'start' | 'crash' | 'wait' | 'limit' | 'failed' | 'stable'; n: number }[];
  restarts: number;
  final: 'active' | 'failed' | 'start-limit-hit';
}

/** Simulate 120 seconds of the unit's life (or until it settles). */
export function simulate(p: P, broken: ReadonlySet<string>): RestartSim {
  const window = 10_000;
  const sec = p.restartSec * 1000;
  const life = broken.has('no-binary') ? 0 : p.after * 1000;
  const events: RestartSim['events'] = [];
  const starts: number[] = [];
  let t = 0;
  let restartsN = 0;
  for (let guard = 0; guard < 40; guard++) {
    const recent = starts.filter((s) => t - s < window);
    if (recent.length >= p.burst) {
      events.push({ t, kind: 'limit', n: restartsN });
      return { events, restarts: restartsN, final: 'start-limit-hit' };
    }
    starts.push(t);
    events.push({ t, kind: 'start', n: restartsN });
    if (broken.has('manual-stop')) {
      events.push({ t: t + 2000, kind: 'stable', n: restartsN });
      return { events, restarts: restartsN, final: 'active' };
    }
    t += life;
    if (t > 120_000) {
      events.push({ t: 120_000, kind: 'stable', n: restartsN });
      return { events, restarts: restartsN, final: 'active' };
    }
    events.push({ t, kind: 'crash', n: restartsN });
    if (broken.has('no-binary') ? p.restart === 'no' : !restarts(p.restart, p.crash)) {
      events.push({ t, kind: 'failed', n: restartsN });
      return { events, restarts: restartsN, final: 'failed' };
    }
    events.push({ t, kind: 'wait', n: restartsN });
    t += sec;
    restartsN++;
  }
  return { events, restarts: restartsN, final: 'active' };
}

const sd = (name: string, sec: number) => ({ url: `https://man7.org/linux/man-pages/man${sec}/${name}.${sec}.html`, label: `${name}(${sec})` });
const st = (id: string, label: string, x: number, y: number, what: Bi) => ({ id, label, family: 'neutral' as const, shape: 'pill' as const, x, y, w: 150, h: 48, card: { what, who: bi('systemd ведёт это состояние для каждого unit.', 'systemd keeps this state for every unit.'), see: 'systemctl show -p ActiveState,SubState app', doc: sd('systemctl', 1) } });

export const restartModel = defineModel<P>({
  id: 'linux.restart',
  block: 'linux',
  title: bi('systemd перезапускает упавшую службу', 'systemd restarts a failed service'),
  summary: bi(
    'Автомат состояний службы: запуск, падение, ожидание RestartSec, новая попытка — и лимит StartLimitBurst в окне StartLimitIntervalSec. Двигайте настройки unit-файла и смотрите, когда systemd сдаётся.',
    'The state machine of a service: start, crash, the RestartSec wait, another attempt — and the StartLimitBurst limit within StartLimitIntervalSec. Move the unit-file settings and watch when systemd gives up.',
  ),
  concepts: ['linux.systemd', 'linux.unit'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      st('inactive', 'inactive', 24, 40, bi('Служба не запущена: процесса нет. Так выглядит и служба после `systemctl stop`.', 'The service is not running: there is no process. A service also looks like this after `systemctl stop`.')),
      st('activating', 'activating', 250, 40, bi('systemd запускает ExecStart: создаёт процесс в cgroup службы, от пользователя из User=.', 'systemd starts ExecStart: it creates the process in the service’s cgroup as the user from User=.')),
      st('active', 'active (running)', 476, 40, bi('Главный процесс работает. systemd знает его номер (Main PID) и следит, когда он завершится.', 'The main process runs. systemd knows its number (Main PID) and watches for it to end.')),
      st('autorestart', 'auto-restart', 476, 200, bi('Процесс упал, Restart= велит перезапустить: systemd ждёт RestartSec и пробует снова.', 'The process died and Restart= says restart: systemd waits RestartSec and tries again.')),
      st('failed', 'failed', 250, 200, bi('Перезапуска не будет: служба помечена как failed с причиной (Result: exit-code, signal, oom-kill, start-limit-hit).', 'There will be no restart: the service is marked failed with a reason (Result: exit-code, signal, oom-kill, start-limit-hit).')),
      {
        id: 'main',
        label: bi('главный процесс', 'main process'),
        sub: 'web-demo',
        family: 'process',
        x: 740,
        y: 40,
        w: 196,
        h: 64,
        card: { what: bi('Программа из ExecStart=. Её код завершения или сигнал, которым её убили, решают, что будет дальше.', 'The program from ExecStart=. Its exit code, or the signal that killed it, decides what happens next.'), who: bi('systemd (PID 1) запускает его как свой дочерний процесс.', 'systemd (PID 1) starts it as its own child.'), see: 'systemctl status app', doc: sd('systemd.service', 5) },
      },
      {
        id: 'limit',
        label: bi('попыток в окне', 'starts in the window'),
        sub: '0 / 5',
        family: 'gauge',
        shape: 'buffer',
        x: 740,
        y: 200,
        w: 196,
        h: 64,
        card: { what: bi('Сколько раз службу запускали за последние StartLimitIntervalSec (по умолчанию 10 с). Если запусков стало больше StartLimitBurst (по умолчанию 5), systemd перестаёт пробовать: start-limit-hit.', 'How many times the service was started within the last StartLimitIntervalSec (10 s by default). Once that exceeds StartLimitBurst (5 by default), systemd stops trying: start-limit-hit.'), who: bi('systemd, отдельно для каждого unit.', 'systemd, separately for every unit.'), see: 'systemctl show -p StartLimitBurst,StartLimitIntervalUSec app', doc: sd('systemd.unit', 5) },
      },
      {
        id: 'journal',
        label: bi('журнал', 'journal'),
        sub: 'journalctl -u app',
        family: 'store',
        shape: 'doc',
        x: 24,
        y: 300,
        w: 260,
        h: 64,
        card: { what: bi('Каждое событие — строка журнала: «Main process exited», «Scheduled restart job, restart counter is at N», «Start request repeated too quickly».', 'Every event is a journal line: “Main process exited”, “Scheduled restart job, restart counter is at N”, “Start request repeated too quickly”.'), who: bi('systemd-journald собирает сообщения systemd и вывод службы.', 'systemd-journald collects systemd’s messages and the service’s output.'), see: 'journalctl -u app -n 20' },
      },
      {
        id: 'pid1',
        label: 'systemd · PID 1',
        family: 'process',
        shape: 'bar',
        x: 16,
        y: 400,
        w: 928,
        h: 56,
        card: { what: bi('Первый процесс системы: запускает службы по unit-файлам и получает сигнал о смерти каждого своего дочернего процесса — так он и узнаёт о падении.', 'The first process of the system: it starts services from unit files and is notified when any of its children dies — that is how it learns about a crash.'), who: bi('Ядро запускает его при загрузке первым.', 'The kernel starts it first at boot.'), see: 'ps -p 1 -o pid,comm', doc: sd('systemd', 1) },
      },
    ],
    edges: [
      { id: 'e-start', from: 'inactive', to: 'activating', label: 'systemctl start', card: { what: bi('Команда запуска: systemd читает unit и запускает ExecStart.', 'The start command: systemd reads the unit and runs ExecStart.'), who: bi('Вы или загрузка (если unit включён: enable).', 'You, or the boot (if the unit is enabled).') } },
      { id: 'e-up', from: 'activating', to: 'active', label: bi('процесс создан', 'process created'), card: { what: bi('Для Type=simple служба считается запущенной, как только создан процесс.', 'For Type=simple the service counts as started as soon as the process exists.'), who: bi('systemd', 'systemd') } },
      { id: 'e-run', from: 'active', to: 'main', label: 'Main PID', card: { what: bi('systemd следит за главным процессом.', 'systemd watches the main process.'), who: bi('systemd', 'systemd') } },
      { id: 'e-crash', from: 'main', to: 'autorestart', label: bi('упал', 'died'), card: { what: bi('Процесс завершился: кодом или сигналом. Что дальше — решает Restart=.', 'The process ended: with a code or a signal. What follows is decided by Restart=.'), who: bi('Ядро сообщает systemd (SIGCHLD).', 'The kernel tells systemd (SIGCHLD).') } },
      { id: 'e-retry', from: 'autorestart', to: 'activating', via: [[325, 224]], label: bi('через RestartSec', 'after RestartSec'), labelAt: 0.3, card: { what: bi('Новая попытка запуска — счётчик в окне растёт.', 'Another start attempt — the counter in the window grows.'), who: bi('systemd', 'systemd'), doc: sd('systemd.service', 5) } },
      { id: 'e-fail', from: 'autorestart', to: 'failed', label: bi('сдаётся', 'gives up'), card: { what: bi('Restart= не велит перезапускать — или лимит попыток исчерпан.', 'Restart= does not say restart — or the limit of attempts is used up.'), who: bi('systemd', 'systemd') } },
      { id: 'e-count', from: 'autorestart', to: 'limit', label: bi('+1', '+1'), card: { what: bi('Каждый запуск засчитывается в окно StartLimitIntervalSec.', 'Every start is counted within the StartLimitIntervalSec window.'), who: bi('systemd', 'systemd') } },
      { id: 'e-log', from: 'failed', to: 'journal', label: bi('пишет', 'logs'), card: { what: bi('Причина остаётся в журнале и в `systemctl status`.', 'The reason stays in the journal and in `systemctl status`.'), who: bi('systemd', 'systemd') } },
    ],
  },
  params: [
    {
      id: 'restart',
      label: bi('Restart=', 'Restart='),
      kind: 'choice',
      default: 'on-failure',
      options: [
        { id: 'no', label: bi('no (по умолчанию)', 'no (the default)') },
        { id: 'on-failure', label: bi('on-failure', 'on-failure') },
        { id: 'on-abnormal', label: bi('on-abnormal', 'on-abnormal') },
        { id: 'always', label: bi('always', 'always') },
      ],
      near: 'autorestart',
      predict: {
        prompt: bi('Программа выходит с кодом 1. Перезапустит ли её Restart=on-abnormal?', 'The program exits with code 1. Will Restart=on-abnormal restart it?'),
        options: [
          { id: 'yes', text: bi('Да, это же сбой', 'Yes, it is a failure') },
          { id: 'no', text: bi('Нет: on-abnormal — только сигналы и таймауты', 'No: on-abnormal means only signals and timeouts') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id.startsWith('wait')) ? 'yes' : 'no'),
      },
    },
    { id: 'restartSec', label: bi('RestartSec=', 'RestartSec='), kind: 'range', min: 0.1, max: 30, step: 0.1, default: 0.1, unit: 's', near: 'e-retry' },
    { id: 'burst', label: bi('StartLimitBurst=', 'StartLimitBurst='), kind: 'range', min: 1, max: 10, step: 1, default: 5, near: 'limit', levels: ['intermediate', 'experienced'] },
    {
      id: 'crash',
      label: bi('Почему падает', 'Why it dies'),
      kind: 'choice',
      default: 'exit1',
      options: Object.entries(CAUSE).map(([id, c]) => ({ id, label: c.text })),
      near: 'main',
    },
    {
      id: 'after',
      label: bi('Падает через', 'Dies after'),
      kind: 'range',
      min: 0,
      max: 30,
      step: 1,
      default: 0,
      unit: 's',
      near: 'main',
      predict: {
        prompt: bi('Служба теперь живёт 5 секунд до падения, RestartSec=0.1. Упрётся ли она в лимит 5 запусков за 10 секунд?', 'The service now lives 5 seconds before it dies, RestartSec=0.1. Will it hit the limit of 5 starts in 10 seconds?'),
        options: [
          { id: 'limit', text: bi('Да, рано или поздно', 'Yes, sooner or later') },
          { id: 'forever', text: bi('Нет, будет перезапускаться бесконечно', 'No, it will restart forever') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'limit') ? 'limit' : 'forever'),
      },
    },
  ],
  breaks: [
    {
      id: 'no-binary',
      label: bi('ExecStart указывает на несуществующий файл', 'ExecStart points to a missing file'),
      remove: ['main', 'e-run'],
      boundary: 'process',
      predict: {
        prompt: bi('Файла программы нет. Сколько продержится служба с Restart=on-failure?', 'The program file is missing. How long does the service last with Restart=on-failure?'),
        options: [
          { id: 'limit', text: bi('Мгновенно упрётся в лимит запусков', 'It hits the start limit instantly') },
          { id: 'once', text: bi('Упадёт один раз и останется failed', 'It fails once and stays failed') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'limit') ? 'limit' : 'once'),
      },
    },
    {
      id: 'manual-stop',
      label: bi('Вы останавливаете службу: systemctl stop', 'You stop the service: systemctl stop'),
      remove: ['e-crash'],
      boundary: 'process',
      predict: {
        prompt: bi('При Restart=always — перезапустит ли systemd службу после `systemctl stop`?', 'With Restart=always — will systemd restart the service after `systemctl stop`?'),
        options: [
          { id: 'no', text: bi('Нет: остановка вручную — не падение', 'No: a manual stop is not a crash') },
          { id: 'yes', text: bi('Да: always значит всегда', 'Yes: always means always') },
        ],
        resolve: () => 'no',
      },
    },
  ],
  metrics: [
    { id: 'restarts', label: bi('перезапусков', 'restarts') },
    { id: 'window', label: bi('запусков в окне 10 с', 'starts in the 10 s window') },
    { id: 't', label: bi('время', 'time'), unit: 's' },
  ],
  run(p, broken): Step[] {
    const sim = simulate(p, broken);
    const c = CAUSE[p.crash] ?? CAUSE.exit1;
    const steps: Step[] = [];
    const winAt = (t: number) => sim.events.filter((e) => e.kind === 'start' && t - e.t < 10_000 && e.t <= t).length;
    const shown = sim.events.slice(0, 22);
    let pid = 4100;
    for (const [i, e] of shown.entries()) {
      const metrics = { restarts: e.n, window: winAt(e.t), t: Math.round(e.t / 100) / 10 };
      const fill = { limit: Math.min(1, winAt(e.t) / p.burst) };
      const values = { limit: `${winAt(e.t)} / ${p.burst}` };
      if (e.kind === 'start') {
        pid += 2;
        steps.push({
          id: `start${i}`,
          label: e.n ? `#${e.n}` : 'start',
          caption: broken.has('no-binary')
            ? bi('systemd пытается запустить ExecStart, но файла нет: процесс не создаётся вовсе — status=203/EXEC.', 'systemd tries to run ExecStart, but the file is missing: no process is created at all — status=203/EXEC.')
            : e.n
              ? fmtb(bi('Попытка {n}: новый процесс, новый номер {pid}. В окне 10 с — {w} запусков из {b}.', 'Attempt {n}: a new process with a new number, {pid}. {w} starts of {b} in the 10 s window.'), { n: e.n, pid, w: winAt(e.t), b: p.burst })
              : fmtb(bi('`systemctl start app`: процесс {pid} создан, служба active (running).', '`systemctl start app`: process {pid} is created, the service is active (running).'), { pid }),
          focus: e.n ? ['e-retry', 'activating', 'active'] : ['e-start', 'activating', 'e-up', 'active'],
          tokens: [{ edge: e.n ? 'e-retry' : 'e-start' }],
          states: { inactive: 'off', activating: 'off', active: broken.has('no-binary') ? 'err' : 'on', autorestart: 'off', failed: 'off', main: broken.has('no-binary') ? 'off' : 'on' },
          values: { ...values, main: `PID ${pid}` },
          fill,
          metrics,
        });
      } else if (e.kind === 'crash') {
        steps.push({
          id: `crash${i}`,
          label: bi('падение', 'crash'),
          caption: broken.has('no-binary')
            ? bi('«Failed at step EXEC spawning /usr/local/bin/app: No such file or directory». Для systemd это сбой — как ненулевой код.', '“Failed at step EXEC spawning /usr/local/bin/app: No such file or directory”. For systemd this is a failure — like a non-zero code.')
            : fmtb(bi('Через {s} с: {c}. В журнале — «Main process exited, {l}».', 'After {s} s: {c}. The journal says “Main process exited, {l}”.'), { s: p.after, c: c.text, l: c.log }),
          focus: ['e-crash', 'main'],
          tokens: [{ edge: 'e-crash' }],
          states: { main: 'err', active: 'off' },
          values,
          fill,
          metrics,
        });
      } else if (e.kind === 'wait') {
        steps.push({
          id: `wait${i}`,
          label: 'RestartSec',
          caption: fmtb(bi('Restart={r} велит перезапустить: auto-restart, ожидание {s} с. «Scheduled restart job, restart counter is at {n}».', 'Restart={r} says restart: auto-restart, a {s} s wait. “Scheduled restart job, restart counter is at {n}”.'), { r: p.restart, s: p.restartSec, n: e.n + 1 }),
          focus: ['autorestart', 'e-count', 'limit'],
          tokens: [{ edge: 'e-count' }],
          states: { autorestart: 'wait', main: 'off' },
          values,
          fill,
          metrics,
        });
      } else if (e.kind === 'failed') {
        steps.push({
          id: 'failed',
          label: 'failed',
          caption: p.restart === 'on-abnormal' && !c.sig
            ? bi('on-abnormal не перезапускает при ненулевом коде: для systemd выход с кодом — обычное завершение. Служба остаётся failed.', 'on-abnormal does not restart on a non-zero code: for systemd an exit with a code is an ordinary end. The service stays failed.')
            : fmtb(bi('Restart={r}: перезапуска не будет. Служба — failed, причина в `systemctl status` и журнале.', 'Restart={r}: no restart. The service is failed; the reason is in `systemctl status` and the journal.'), { r: p.restart }),
          focus: ['e-fail', 'failed', 'e-log', 'journal'],
          tokens: [{ edge: 'e-fail' }, { edge: 'e-log' }],
          states: { failed: 'err', autorestart: 'off', main: 'off' },
          values,
          fill,
          metrics,
          broken: broken.has('no-binary') ? { at: 'failed', message: 'app.service: Main process exited, code=exited, status=203/EXEC', caption: bi('203/EXEC значит: systemd не смог запустить файл из ExecStart — путь, права, интерпретатор.', '203/EXEC means systemd could not run the file from ExecStart — the path, the mode, the interpreter.') } : undefined,
        });
      } else if (e.kind === 'limit') {
        steps.push({
          id: 'limit',
          label: 'limit',
          caption: fmtb(bi('{b} запусков за 10 с — и следующий не разрешён: «Start request repeated too quickly», Result: start-limit-hit. Ни одна попытка больше не делается, пока вы не скажете `systemctl reset-failed`.', '{b} starts within 10 s — the next one is not allowed: “Start request repeated too quickly”, Result: start-limit-hit. No more attempts until you run `systemctl reset-failed`.'), { b: p.burst }),
          focus: ['limit', 'e-fail', 'failed', 'journal'],
          tokens: [{ edge: 'e-fail' }],
          states: { failed: 'err', autorestart: 'off', main: 'off', limit: 'err' },
          values: { limit: `${p.burst} / ${p.burst}` },
          fill: { limit: 1 },
          metrics: { ...metrics, window: p.burst },
          broken: { at: 'limit', message: 'app.service: Start request repeated too quickly.\napp.service: Failed with result \'start-limit-hit\'.', caption: bi('systemd сдался не из-за кода, а из-за частоты: слишком много запусков за короткое время.', 'systemd gave up not because of a code but because of the rate: too many starts in a short time.') },
        });
      } else if (e.kind === 'stable') {
        steps.push({
          id: 'stable',
          label: broken.has('manual-stop') ? 'stop' : 'ok',
          caption: broken.has('manual-stop')
            ? bi('`systemctl stop app`: systemd сам посылает SIGTERM и ставит inactive. Это не падение, Restart= здесь не действует ни при каком значении.', '`systemctl stop app`: systemd itself sends SIGTERM and sets inactive. That is not a crash; Restart= does not apply, whatever its value.')
            : bi('Служба живёт дольше окна: старые запуски выпадают из счёта, и лимит не наступает.', 'The service lives longer than the window: old starts drop out of the count and the limit never arrives.'),
          focus: broken.has('manual-stop') ? ['inactive'] : ['active', 'limit'],
          states: broken.has('manual-stop') ? { inactive: 'on', active: 'off', main: 'off' } : { active: 'ok' },
          values,
          fill,
          metrics,
          broken: broken.has('manual-stop') ? { at: 'inactive', message: 'systemd[1]: Stopping app.service...\nsystemd[1]: app.service: Deactivated successfully.\nsystemd[1]: Stopped app.service.', caption: bi('остановка руками — не падение: процесс завершён по просьбе systemd, Restart= не срабатывает.', 'a manual stop is not a crash: the process ended at systemd’s request, so Restart= does not fire.') } : undefined,
        });
      }
    }
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    void prev;
    const fin = next.some((s) => s.id === 'limit') ? 'limit' : next.some((s) => s.id === 'failed') ? 'failed' : 'running';
    const verdict = fin === 'limit' ? bi('systemd сдаётся по лимиту запусков (start-limit-hit)', 'systemd gives up on the start limit (start-limit-hit)') : fin === 'failed' ? bi('служба остаётся failed без перезапуска', 'the service stays failed with no restart') : bi('служба живёт: перезапуски не упираются в лимит', 'the service lives on: restarts never hit the limit');
    if (change.kind === 'break') return change.on ? fmtb(bi('Поломка включена: {v}.', 'The break is on: {v}.'), { v: verdict }) : bi('Поломка убрана.', 'The break is removed.');
    switch (change.id) {
      case 'restart':
        return fmtb(bi('Restart={a} → {b}: {v}.', 'Restart={a} → {b}: {v}.'), { a: String(a.restart), b: String(b.restart), v: verdict });
      case 'restartSec':
        return fmtb(bi('RestartSec={s}: {n} запусков помещаются в окно 10 с — {v}.', 'RestartSec={s}: {n} starts fit into the 10 s window — {v}.'), { s: Number(b.restartSec), n: Math.min(Number(b.burst) + 1, Math.floor(10 / Math.max(0.1, Number(b.restartSec) + Number(b.after))) + 1), v: verdict });
      case 'burst':
        return fmtb(bi('StartLimitBurst={n}: {v}.', 'StartLimitBurst={n}: {v}.'), { n: Number(b.burst), v: verdict });
      case 'crash':
        return fmtb(bi('Причина падения другая — Restart={r} решает по-своему: {v}.', 'A different cause of death — Restart={r} decides its own way: {v}.'), { r: String(b.restart), v: verdict });
      case 'after':
        return fmtb(bi('Служба живёт {s} с до падения: {v}.', 'The service lives {s} s before dying: {v}.'), { s: Number(b.after), v: verdict });
    }
    return verdict;
  },
});
