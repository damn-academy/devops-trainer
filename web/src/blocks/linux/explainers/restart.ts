// X4 «systemd restarts a failed service» (02 §6.6 X4). The unit's state
// machine is simulated from the knobs with the rules of systemd.service(5):
// on-failure restarts on a non-zero code and on an unclean signal, on-abnormal
// only on a signal, always on anything but `systemctl stop`; restarts are
// counted in a sliding window of StartLimitIntervalSec and the start after
// StartLimitBurst ends in `start-limit-hit`. Defaults are those of systemd 257:
// Restart=no, RestartSec=100ms, StartLimitIntervalSec=10s, StartLimitBurst=5.

import { defineModel } from '../../../core/define';
import { bi, pluralRu, type Bi } from '../../../core/i18n';
import type { DiagramNode, ElementState, Step } from '../../../core/types';
import { fmtb } from './util';

type P = { restart: string; restartSec: number; burst: number; crash: string; after: number };

const CAUSE: Record<string, { sig?: string; code: number; text: Bi; how: Bi; log: string }> = {
  exit1: { code: 1, text: bi('программа сама завершается с кодом 1', 'the program exits by itself with code 1'), how: bi('программа завершилась с кодом 1', 'the program exited with code 1'), log: 'code=exited, status=1/FAILURE' },
  kill: { sig: 'KILL', code: 137, text: bi('кто-то посылает ей сигнал KILL (kill -9)', 'someone sends it KILL (kill -9)'), how: bi('процесс был завершён сигналом KILL', 'the process was ended by KILL'), log: 'code=killed, status=9/KILL' },
  term: { sig: 'TERM', code: 143, text: bi('кто-то посылает ей сигнал TERM (kill)', 'someone sends it TERM (kill)'), how: bi('процесс был завершён сигналом TERM', 'the process was ended by TERM'), log: 'code=killed, status=15/TERM' },
  oom: { sig: 'KILL', code: 137, text: bi('ядро завершает её из-за нехватки памяти', 'the kernel ends it because memory ran out'), how: bi('ядро завершило процесс сигналом KILL, потому что на машине кончилась память', 'the kernel ended the process with KILL because the machine had no free memory left'), log: 'code=killed, status=9/KILL' },
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
  // the restarts never hit the limit: the service keeps cycling, and the diagram ends on that steady state
  events.push({ t, kind: 'stable', n: restartsN });
  return { events, restarts: restartsN, final: 'active' };
}

/** Russian number words: «2 запуска», «5 запусков»; decimal comma for fractions. */
const ruNum = (n: number) => String(n).replace('.', ',');
const startsRu = (n: number) => `${n} ${pluralRu(n, ['запуск', 'запуска', 'запусков'])}`;
const startsGenRu = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'запуска' : 'запусков'}`;
const startsEn = (n: number) => `${n} ${n === 1 ? 'start' : 'starts'}`;
const sb = (ru: string, en: string): Bi => bi(ru, en);


const sd = (name: string, sec: number) => ({ url: `https://man7.org/linux/man-pages/man${sec}/${name}.${sec}.html`, label: `${name}(${sec})` });
const st = (id: string, label: string, x: number, y: number, what: Bi): DiagramNode => ({ id, label, family: 'neutral', shape: 'pill', x, y, w: 150, h: 48, card: { what, who: bi('Это состояние systemd ведёт для каждой службы отдельно.', 'systemd keeps this state for every service separately.'), see: 'systemctl show -p ActiveState,SubState app', doc: sd('systemctl', 1) } });

const ALL = ['inactive', 'activating', 'active', 'autorestart', 'failed', 'main', 'limit', 'journal', 'pid1', 'e-start', 'e-up', 'e-run', 'e-crash', 'e-retry', 'e-fail', 'e-count', 'e-log'];
const startWith = (...shown: string[]): Record<string, ElementState> => Object.fromEntries(ALL.filter((id) => !shown.includes(id)).map((id) => [id, 'hidden' as ElementState]));

/** Why the restarts never reach the limit, from the actual knobs. */
function stableWhy(p: P): Bi {
  if (p.after >= 10) return fmtb(bi('Программа работает {s} с, то есть дольше окна в 10 секунд, поэтому к каждому новому запуску прежние запуски уже выпали из счёта. Лимит так и не наступает, и служба перезапускается после каждого сбоя.', 'The program runs {s} s, longer than the 10-second window, so by every new start the earlier starts have dropped out of the count. The limit never comes, and the service restarts after every failure.'), { s: sb(ruNum(p.after), String(p.after)) });
  const gap = Math.round((p.after + p.restartSec) * 10) / 10;
  const fit = Math.ceil(10 / Math.max(0.1, gap));
  return fmtb(bi('Между двумя запусками проходит {g} с, потому что к работе программы добавляется пауза RestartSec=. Поэтому в окно 10 секунд помещается не больше {f}, а systemd разрешает {b}, и служба перезапускается после каждого сбоя.', 'Between two starts {g} s pass, because the RestartSec= pause is added to the program’s run. So no more than {f} fit into the 10-second window, while systemd allows {b}, and the service restarts after every failure.'), { g: sb(ruNum(gap), String(gap)), f: sb(startsGenRu(fit), startsEn(fit)), b: sb(startsRu(p.burst), startsEn(p.burst)) });
}

/**
 * A long run repeats the same three steps (start, failure, pause) many times.
 * The first two cycles and the last one stay as they are; the cycles between
 * them fold into one step, so the learner reaches the outcome without clicking
 * through identical attempts. The folded step carries every state and reveal
 * of the steps it replaces.
 */
function collapseRepeats(steps: Step[]): Step[] {
  const head = 6;
  const tail = 4;
  if (steps.length <= head + tail + 3) return steps;
  const middle = steps.slice(head, steps.length - tail);
  const attempts = middle.filter((x) => x.id.startsWith('start')).length;
  if (attempts < 2) return steps;
  const last = middle[middle.length - 1];
  const folded: Step = {
    id: 'repeat',
    label: bi('ещё попытки', 'more attempts'),
    caption: fmtb(bi('Следующие {n} проходят так же: systemd запускает процесс, тот завершается, и после паузы RestartSec= следует новая попытка. Счётчик запусков за последние 10 секунд показывает, сколько попыток уже засчитано.', 'The next {n} go the same way: systemd starts the process, it ends, and after the RestartSec= pause a new attempt follows. The counter of starts in the last 10 seconds shows how many attempts are already counted.'), { n: bi(`${attempts} ${pluralRu(attempts, ['попытка', 'попытки', 'попыток'])}`, `${attempts} attempts`) }),
    focus: ['autorestart', 'limit'],
    reveal: [...new Set(middle.flatMap((x) => x.reveal ?? []))],
    say: { limit: bi('Попытки повторяются одна за другой, и счётчик растёт.', 'The attempts repeat one after another, and the counter grows.') },
    states: Object.assign({}, ...middle.map((x) => x.states ?? {})),
    values: last.values,
    fill: last.fill,
    metrics: last.metrics,
  };
  return [...steps.slice(0, head), folded, ...steps.slice(steps.length - tail)];
}

export const restartModel = defineModel<P>({
  id: 'linux.restart',
  frame: 'visible',
  block: 'linux',
  title: bi('Как systemd перезапускает службу после сбоя', 'How systemd restarts a service after a failure'),
  summary: bi(
    'Служба app запускается и через заданное время завершается с ошибкой. Дальше systemd по настройке Restart= решает, перезапускать ли её, ждёт RestartSec и пробует снова, а каждую попытку засчитывает в счётчик. Когда за 10 секунд попыток становится больше, чем разрешает StartLimitBurst, systemd прекращает попытки и помечает службу как сбойную.',
    'The app service starts and after the given time fails. Then systemd decides by Restart= whether to restart it, waits RestartSec and tries again, counting every attempt. When there are more attempts within 10 seconds than StartLimitBurst allows, systemd stops trying and marks the service as failed.',
  ),
  intro: bi(
    'Сейчас на схеме видны состояния запуска службы и её главный процесс, а состояния перезапуска и сбоя появятся, когда служба до них дойдёт. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Подсвеченное состояние показывает, в каком состоянии служба сейчас, а облачко рядом объясняет, что делает systemd.\n\nКогда служба окажется в состоянии failed, поменяйте в «Параметрах» значение Restart= или паузу RestartSec= и пройдите путь ещё раз.',
    'Now the diagram shows the start states of the service and its main process; the restart and failure states appear when the service reaches them. Press “Start from the first step”, then go on with “Step forward” above the diagram. The highlighted state shows where the service is now, and the callout next to it explains what systemd does.\n\nOnce the service is failed, change Restart= or the RestartSec= pause in “Parameters” and walk the path again.',
  ),
  legend: [
    { mark: 'active', text: bi('состояние службы сейчас', 'the service’s state now') },
    { mark: 'say', text: bi('что делает systemd', 'what systemd does') },
    { mark: 'token', text: bi('событие, которое переводит службу в новое состояние', 'the event that moves the service to a new state') },
    { mark: 'icon:process', text: bi('главный процесс службы', 'the main process of the service') },
    { mark: 'wait', text: bi('systemd ждёт паузу RestartSec', 'systemd waits out RestartSec') },
    { mark: 'err', text: bi('процесс завершился с ошибкой или systemd прекратил попытки', 'the process failed or systemd stopped trying') },
  ],
  stopLabel: bi('systemd прекратил попытки', 'systemd stopped trying'),
  concepts: ['linux.systemd', 'linux.unit'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      st('inactive', 'inactive', 24, 40, bi('Служба не запущена, и процесса у неё нет. В этом же состоянии служба оказывается после команды `systemctl stop`.', 'The service is not running and has no process. A service is in this state after `systemctl stop` as well.')),
      st('activating', 'activating', 232, 40, bi('systemd запускает программу из строки ExecStart= от имени пользователя, указанного в строке User=.', 'systemd starts the program from ExecStart= as the user given in User=.')),
      st('active', 'active (running)', 440, 40, bi('Главный процесс службы работает. systemd знает его номер, который называется Main PID, и следит за тем, когда процесс завершится.', 'The main process of the service runs. systemd knows its number, called the Main PID, and watches for it to end.')),
      st('autorestart', 'auto-restart', 476, 200, bi('Процесс завершился с ошибкой, и настройка Restart= говорит перезапустить службу. systemd выжидает паузу RestartSec= и пробует запустить службу снова.', 'The process failed, and Restart= says to restart the service. systemd waits out RestartSec= and tries to start the service again.')),
      st('failed', 'failed', 250, 200, bi('Перезапуска не будет, и служба помечена как сбойная. Причину systemd записывает в поле Result: например, exit-code, signal, oom-kill или start-limit-hit.', 'There will be no restart, and the service is marked as failed. systemd records the reason in Result: for example exit-code, signal, oom-kill or start-limit-hit.')),
      {
        id: 'main',
        label: bi('Главный процесс', 'The main process'),
        icon: 'process',
        work: 'pulse',
        sub: 'web-demo',
        family: 'process',
        x: 740,
        y: 40,
        w: 196,
        h: 64,
        card: { what: bi('Главный процесс выполняет программу из строки ExecStart=. Код, с которым она завершилась, или сигнал, которым её завершили, решает, что systemd сделает дальше.', 'The main process runs the program from ExecStart=. The code it exited with, or the signal that ended it, decides what systemd does next.'), who: bi('Главный процесс запускает systemd, у которого номер PID 1, и systemd становится родителем этого процесса.', 'systemd, PID 1, starts the process and becomes its parent.'), see: 'systemctl status app', doc: sd('systemd.service', 5) },
      },
      {
        id: 'limit',
        label: bi('Попыток за 10 секунд', 'Attempts in 10 seconds'),
        sub: '0 / 5',
        family: 'gauge',
        shape: 'buffer',
        x: 740,
        y: 300,
        w: 196,
        h: 64,
        card: { what: bi('Счётчик показывает, сколько раз службу запускали за последние StartLimitIntervalSec=, то есть по умолчанию за 10 секунд. Когда запусков становится больше StartLimitBurst=, который по умолчанию равен 5, systemd перестаёт пробовать, и служба получает причину start-limit-hit.', 'The counter shows how many times the service was started within the last StartLimitIntervalSec=, 10 seconds by default. When the starts exceed StartLimitBurst=, 5 by default, systemd stops trying, and the service gets the reason start-limit-hit.'), who: bi('Счётчик systemd ведёт для каждой службы отдельно.', 'systemd keeps the counter for every service separately.'), see: 'systemctl show -p StartLimitBurst,StartLimitIntervalUSec app', doc: sd('systemd.unit', 5) },
      },
      {
        id: 'journal',
        label: bi('Журнал службы', 'The service journal'),
        icon: 'file',
        sub: 'journalctl -u app',
        family: 'store',
        x: 24,
        y: 300,
        w: 260,
        h: 64,
        card: { what: bi('Каждое событие оставляет строку в журнале: «Main process exited», «Scheduled restart job, restart counter is at N» или «Start request repeated too quickly».', 'Every event leaves a journal line: “Main process exited”, “Scheduled restart job, restart counter is at N” or “Start request repeated too quickly”.'), who: bi('Сообщения systemd и вывод самой службы собирает служба systemd-journald.', 'systemd-journald collects systemd’s messages and the service’s own output.'), see: 'journalctl -u app -n 20' },
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
        card: { what: bi('Программа systemd работает первым процессом системы. Она запускает службы по unit-файлам, и ядро сообщает ему о завершении каждого его дочернего процесса, поэтому systemd сразу узнаёт о сбое службы.', 'systemd runs as the first process of the system. It starts services from unit files, and the kernel tells it whenever one of its child processes ends, so systemd learns about a failure at once.'), who: bi('Ядро запускает systemd первым при загрузке машины.', 'The kernel starts systemd first when the machine boots.'), see: 'ps -p 1 -o pid,comm', doc: sd('systemd', 1) },
      },
    ],
    edges: [
      { id: 'e-start', from: 'inactive', to: 'activating', label: bi('команда запуска', 'start command'), card: { what: bi('По команде запуска systemd читает unit-файл и запускает программу из ExecStart=.', 'On the start command systemd reads the unit file and runs the program from ExecStart=.'), who: bi('Команду даёте вы или загрузка машины, если запуск службы включён командой enable.', 'You give it, or the boot does if the service was enabled with enable.') } },
      { id: 'e-up', from: 'activating', to: 'active', label: bi('процесс создан', 'process created'), card: { what: bi('Для службы с Type=simple systemd считает её запущенной, как только создан её процесс.', 'For a service with Type=simple systemd counts it as started as soon as its process exists.'), who: bi('Решение о том, что служба запущена, принимает systemd.', 'systemd decides that the service has started.') } },
      { id: 'e-run', from: 'active', to: 'main', label: bi('надзор за процессом', 'watching the process'), card: { what: bi('systemd следит за главным процессом службы и ждёт, когда тот завершится.', 'systemd watches the service’s main process and waits for it to end.'), who: bi('За главным процессом наблюдает systemd.', 'systemd watches the main process.') } },
      { id: 'e-crash', from: 'main', to: 'autorestart', via: [[838, 232]], labelAt: 0.75, label: bi('процесс завершился', 'process ended'), card: { what: bi('Процесс завершился с кодом или по сигналу, и что будет дальше, решает настройка Restart=.', 'The process ended with a code or by a signal, and Restart= decides what follows.'), who: bi('О завершении процесса systemd сообщает ядро сигналом SIGCHLD.', 'The kernel tells systemd about it with SIGCHLD.') } },
      { id: 'e-retry', from: 'autorestart', to: 'activating', via: [[558, 180], [314, 180]], label: bi('новая попытка после RestartSec', 'new attempt after RestartSec'), labelAt: 0.6, card: { what: bi('Пауза RestartSec= прошла, и systemd снова запускает службу, а счётчик попыток растёт.', 'The RestartSec= pause is over, and systemd starts the service again while the attempt counter grows.'), who: bi('Новую попытку запуска делает systemd.', 'systemd makes the new attempt to start.'), doc: sd('systemd.service', 5) } },
      { id: 'e-fail', from: 'autorestart', to: 'failed', label: bi('прекращение попыток', 'giving up'), card: { what: bi('Служба становится сбойной, если Restart= не говорит перезапускать её после такого завершения или если лимит попыток исчерпан.', 'The service becomes failed if Restart= does not ask for a restart after such an end or if the limit of attempts is used up.'), who: bi('Решение прекратить попытки принимает systemd.', 'systemd decides to give up.') } },
      { id: 'e-count', from: 'autorestart', to: 'limit', label: bi('ещё одна попытка', 'one more attempt'), card: { what: bi('Каждый запуск засчитывается в счётчик за последние StartLimitIntervalSec= секунд.', 'Every start is counted within the last StartLimitIntervalSec= seconds.'), who: bi('Счёт запусков ведёт systemd.', 'systemd keeps the count of starts.') } },
      { id: 'e-log', from: 'failed', to: 'journal', label: bi('запись причины', 'recording the reason'), card: { what: bi('Причина сбоя остаётся в журнале и в выводе `systemctl status`.', 'The reason for the failure stays in the journal and in `systemctl status`.'), who: bi('Причину в журнал записывает systemd.', 'systemd writes the reason to the journal.') } },
    ],
  },
  params: [
    {
      id: 'crash',
      label: bi('Почему программа службы завершается', 'Why the service’s program ends'),
      kind: 'choice',
      default: 'exit1',
      options: Object.entries(CAUSE).map(([id, c]) => ({ id, label: c.text })),
      near: 'main',
      group: bi('Как ведёт себя программа', 'How the program behaves'),
    },
    {
      id: 'after',
      label: bi('Через сколько секунд после запуска программа завершается', 'How many seconds after the start the program ends'),
      kind: 'range',
      min: 0,
      max: 30,
      step: 1,
      default: 0,
      unit: { ru: 'с', en: 's' },
      near: 'main',
      group: bi('Как ведёт себя программа', 'How the program behaves'),
      predict: {
        prompt: bi('Вы меняете время, которое программа работает до сбоя, а пауза RestartSec= и лимит запусков за 10 секунд остаются такими, как сейчас стоят на ручках. Упрётся ли служба в лимит при новом времени работы?', 'You change how long the program runs before it fails, while the RestartSec= pause and the limit of starts in 10 seconds stay as the knobs now show. Will the service hit the limit with the new running time?'),
        options: [
          { id: 'limit', text: bi('Да, рано или поздно попыток станет слишком много', 'Yes, sooner or later there will be too many attempts') },
          { id: 'forever', text: bi('Нет, служба будет перезапускаться бесконечно', 'No, the service will restart forever') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'limit') ? 'limit' : 'forever'),
      },
    },
    {
      id: 'restart',
      label: bi('Когда перезапускать службу (Restart=)', 'When to restart the service (Restart=)'),
      kind: 'choice',
      default: 'on-failure',
      options: [
        { id: 'no', label: bi('no, то есть никогда (так стоит по умолчанию)', 'no, that is, never (the default)') },
        { id: 'on-failure', label: bi('on-failure, то есть после любого сбоя', 'on-failure, that is, after any failure') },
        { id: 'on-abnormal', label: bi('on-abnormal, то есть только после сигнала или таймаута', 'on-abnormal, that is, only after a signal or a timeout') },
        { id: 'always', label: bi('always, то есть после любого завершения', 'always, that is, after any end') },
      ],
      near: 'autorestart',
      group: bi('Настройки unit-файла', 'Unit file settings'),
      predict: {
        prompt: bi('Вы выбираете новое значение Restart=, а программа завершается по той причине, которая выбрана в группе «Как ведёт себя программа». Перезапустит ли systemd службу после первого завершения при выбранном вами значении?', 'You choose a new Restart= value, while the program ends for the reason chosen in “How the program behaves”. Will systemd restart the service after the first end with the value you chose?'),
        options: [
          { id: 'yes', text: bi('Да, это значение говорит перезапустить службу после такого завершения', 'Yes, this value asks for a restart after such an end') },
          { id: 'no', text: bi('Нет, при этом значении служба останется в состоянии failed', 'No, with this value the service stays failed') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id.startsWith('wait')) ? 'yes' : 'no'),
      },
    },
    { id: 'restartSec', label: bi('Пауза перед новой попыткой (RestartSec=)', 'Pause before a new attempt (RestartSec=)'), kind: 'range', min: 0.1, max: 30, step: 0.1, default: 0.1, unit: { ru: 'с', en: 's' }, near: 'e-retry', group: bi('Настройки unit-файла', 'Unit file settings') },
    { id: 'burst', label: bi('Сколько запусков разрешено за 10 секунд (StartLimitBurst=)', 'How many starts are allowed in 10 seconds (StartLimitBurst=)'), kind: 'range', min: 1, max: 10, step: 1, default: 5, near: 'limit', group: bi('Настройки unit-файла', 'Unit file settings'), levels: ['intermediate', 'experienced'] },
  ],
  breaks: [
    {
      id: 'no-binary',
      label: bi('В строке ExecStart= указан файл, которого нет на диске', 'ExecStart= names a file that is not on the disk'),
      remove: ['main', 'e-run'],
      boundary: 'process',
      predict: {
        prompt: bi('Файла программы, указанного в ExecStart=, на диске нет, а настройки unit-файла остаются такими, как сейчас стоят на ручках. Что станет со службой?', 'The program file named in ExecStart= is not on the disk, and the unit file settings stay as the knobs now show. What happens to the service?'),
        options: [
          { id: 'limit', text: bi('systemd быстро исчерпает лимит попыток и прекратит перезапуски', 'systemd quickly uses up the limit of attempts and stops restarting') },
          { id: 'once', text: bi('Служба завершится один раз и сразу останется failed', 'The service fails once and stays failed at once') },
        ],
        resolve: (_p, next) => (next.some((s) => s.id === 'limit') ? 'limit' : 'once'),
      },
    },
    {
      id: 'manual-stop',
      label: bi('Вы останавливаете службу командой systemctl stop', 'You stop the service with systemctl stop'),
      remove: ['e-crash'],
      boundary: 'process',
      predict: {
        prompt: bi('Вы останавливаете службу командой systemctl stop. Перезапустит ли её systemd, если в unit-файле стоит даже Restart=always?', 'You stop the service with systemctl stop. Will systemd restart it, even if the unit file has Restart=always?'),
        options: [
          { id: 'no', text: bi('Нет, потому что остановка по команде не считается сбоем', 'No, because a stop on command does not count as a failure') },
          { id: 'yes', text: bi('Да, потому что always означает перезапуск в любом случае', 'Yes, because always means a restart in every case') },
        ],
        resolve: () => 'no',
      },
    },
  ],
  metrics: [
    { id: 'restarts', label: bi('перезапусков', 'restarts') },
    { id: 'window', label: bi('запусков за последние 10 секунд', 'starts in the last 10 seconds') },
    { id: 't', label: bi('прошло времени', 'time passed'), unit: { ru: 'с', en: 's' } },
  ],
  run(p, broken): Step[] {
    const sim = simulate(p, broken);
    const c = CAUSE[p.crash] ?? CAUSE.exit1;
    const steps: Step[] = [];
    const winAt = (t: number) => sim.events.filter((e) => e.kind === 'start' && t - e.t < 10_000 && e.t <= t).length;
    const shown = sim.events;
    let pid = 4100;
    for (const [i, e] of shown.entries()) {
      const metrics = { restarts: e.n, window: winAt(e.t), t: Math.round(e.t / 100) / 10 };
      const fill = { limit: Math.min(1, winAt(e.t) / p.burst) };
      const values = { limit: `${winAt(e.t)} / ${p.burst}` };
      if (e.kind === 'start') {
        pid += 2;
        const first = i === 0;
        steps.push({
          id: `start${i}`,
          label: e.n ? `#${e.n}` : bi('запуск', 'start'),
          caption: broken.has('no-binary')
            ? bi('systemd пытается запустить программу из ExecStart=, но такого файла нет, поэтому процесс не создаётся вовсе. В журнал попадает код status=203/EXEC.', 'systemd tries to run the program from ExecStart=, but there is no such file, so no process is created at all. The journal gets status=203/EXEC.')
            : e.n
              ? fmtb(bi('systemd делает попытку номер {n}. Он создаёт новый процесс с новым номером {pid}. За последние 10 секунд это уже {w}, а лимит разрешает {b}.', 'systemd makes attempt {n}. It creates a new process with a new number, {pid}. Within the last 10 seconds that makes {w}, and the limit allows {b}.'), { n: e.n, pid, w: sb(startsRu(winAt(e.t)), startsEn(winAt(e.t))), b: sb(startsRu(p.burst), startsEn(p.burst)) })
              : fmtb(bi('Вы набрали `systemctl start app`. systemd создаёт процесс {pid}, и служба переходит в состояние active (running).', 'You typed `systemctl start app`. systemd creates process {pid}, and the service moves to active (running).'), { pid }),
          focus: e.n ? ['e-retry', 'active'] : ['e-start', 'active'],
          reveal: e.n ? ['e-retry'] : [],
          tokens: [{ edge: e.n ? 'e-retry' : 'e-start', label: e.n ? fmtb(bi('попытка {n}', 'attempt {n}'), { n: e.n }) : 'systemctl start' }],
          say: broken.has('no-binary') ? { activating: bi('systemd ищет файл программы из ExecStart= и не находит его.', 'systemd looks for the program file from ExecStart= and does not find it.') } : { active: fmtb(bi('systemd запустил процесс {pid} и следит за ним.', 'systemd started process {pid} and watches it.'), { pid }) },
          states: { ...(first ? startWith('inactive', 'activating', 'active', 'main', 'e-start', 'e-up', 'e-run', 'pid1') : {}), inactive: 'off', activating: 'off', active: broken.has('no-binary') ? 'err' : 'on', autorestart: first ? 'hidden' : 'off', main: broken.has('no-binary') ? 'off' : 'on' },
          values: { ...values, main: `PID ${pid}` },
          fill,
          metrics,
        });
      } else if (e.kind === 'crash') {
        steps.push({
          id: `crash${i}`,
          label: bi('сбой', 'failure'),
          caption: broken.has('no-binary')
            ? bi('В журнале появляется строка «Failed at step EXEC spawning /usr/local/bin/app: No such file or directory», то есть systemd не запустил файл, потому что его нет на диске. Для systemd это такой же сбой, как ненулевой код завершения.', 'The journal gets “Failed at step EXEC spawning /usr/local/bin/app: No such file or directory”, meaning systemd did not run the file, because it is not on the disk. For systemd this is a failure just like a non-zero exit code.')
            : p.after > 0
              ? fmtb(bi('Через {s} с после запуска {c}. В журнале появляется строка «Main process exited, {l}».', '{s} s after the start {c}. The journal gets “Main process exited, {l}”.'), { s: sb(ruNum(p.after), String(p.after)), c: c.how, l: c.log })
              : fmtb(bi('Сразу после запуска {c}. В журнале появляется строка «Main process exited, {l}».', 'Right after the start {c}. The journal gets “Main process exited, {l}”.'), { c: c.how, l: c.log }),
          focus: ['e-crash', 'main'],
          reveal: ['autorestart', 'e-crash'],
          tokens: [{ edge: 'e-crash', label: c.sig ? `SIG${c.sig}` : `exit ${c.code}` }],
          say: { main: broken.has('no-binary') ? bi('Процесса нет, потому что файла программы не существует.', 'There is no process, because the program file does not exist.') : bi('Главный процесс завершился, и systemd записывает причину в журнал.', 'The main process ended, and systemd writes the reason to the journal.') },
          states: { main: 'err', active: 'off' },
          values,
          fill,
          metrics,
        });
      } else if (e.kind === 'wait') {
        steps.push({
          id: `wait${i}`,
          label: 'RestartSec',
          caption: fmtb(bi('Настройка Restart={r} говорит перезапустить службу после такого завершения. Служба переходит в состояние auto-restart, systemd выжидает {s} с и пишет в журнал «Scheduled restart job, restart counter is at {n}».', 'Restart={r} asks for a restart after such an end. The service moves to auto-restart, systemd waits {s} s and writes “Scheduled restart job, restart counter is at {n}” to the journal.'), { r: p.restart, s: sb(ruNum(p.restartSec), String(p.restartSec)), n: e.n + 1 }),
          focus: ['autorestart', 'e-count', 'limit'],
          reveal: ['limit', 'e-count'],
          tokens: [{ edge: 'e-count', label: '+1' }],
          say: { autorestart: fmtb(bi('systemd ждёт {s} с перед новой попыткой и прибавляет её к счётчику.', 'systemd waits {s} s before a new attempt and adds it to the counter.'), { s: sb(ruNum(p.restartSec), String(p.restartSec)) }) },
          states: { autorestart: 'wait', main: 'off' },
          values,
          fill,
          metrics,
        });
      } else if (e.kind === 'failed') {
        steps.push({
          id: 'failed',
          label: 'failed',
          caption:
            p.restart === 'on-abnormal' && !c.sig
              ? bi('Настройка on-abnormal не перезапускает службу после ненулевого кода, потому что для systemd выход с кодом считается обычным завершением, а не аварией. Поэтому служба остаётся в состоянии failed.', 'on-abnormal does not restart the service after a non-zero code, because for systemd an exit with a code is an ordinary end, not a crash. So the service stays failed.')
              : fmtb(bi('Настройка Restart={r} не говорит перезапускать службу, поэтому служба переходит в состояние failed. Причину можно прочитать в выводе `systemctl status` и в журнале.', 'Restart={r} does not ask for a restart, so the service moves to failed. The reason is in `systemctl status` and in the journal.'), { r: p.restart }),
          focus: ['e-fail', 'failed'],
          reveal: ['failed', 'e-fail', 'journal', 'e-log'],
          tokens: [{ edge: 'e-fail', label: 'failed' }, { edge: 'e-log', label: 'Result' }],
          say: { failed: bi('systemd прекращает попытки, помечает службу как сбойную и записывает причину в журнал.', 'systemd stops trying, marks the service as failed and writes the reason to the journal.') },
          states: { failed: 'err', autorestart: 'off', main: 'off' },
          values,
          fill,
          metrics,
          broken: broken.has('no-binary') ? { at: 'failed', message: 'app.service: Main process exited, code=exited, status=203/EXEC', caption: bi('Код 203/EXEC означает, что запустить файл из ExecStart= у systemd не получилось. Причину ищут в пути к файлу, в его правах и в первой строке скрипта.', 'Code 203/EXEC means systemd failed to run the file from ExecStart=. Look for the cause in the path, the file’s mode and the first line of the script.') } : undefined,
        });
      } else if (e.kind === 'limit') {
        steps.push({
          id: 'limit',
          label: bi('лимит', 'limit'),
          caption: fmtb(bi('За 10 секунд службу запускали уже {b} раз, и следующий запуск лимит не разрешает. Поэтому systemd больше не делает ни одной попытки, пока вы не выполните `systemctl reset-failed`.', 'The service was started {b} times within 10 seconds, and the limit does not allow the next start. So systemd makes no more attempts until you run `systemctl reset-failed`.'), { b: p.burst }),
          focus: ['limit', 'e-fail', 'failed'],
          reveal: ['failed', 'e-fail', 'journal', 'e-log'],
          tokens: [{ edge: 'e-fail', label: 'start-limit-hit' }],
          say: { limit: fmtb(bi('Счётчик дошёл до {b} за 10 секунд, и systemd прекращает попытки.', 'The counter reached {b} in 10 seconds, and systemd stops trying.'), { b: sb(startsGenRu(p.burst), startsEn(p.burst)) }) },
          states: { failed: 'err', autorestart: 'off', main: 'off', limit: 'err' },
          values: { limit: `${p.burst} / ${p.burst}` },
          fill: { limit: 1 },
          metrics: { ...metrics, window: p.burst },
          broken: { at: 'limit', message: "app.service: Start request repeated too quickly.\napp.service: Failed with result 'start-limit-hit'.", caption: bi('Причиной стал не код завершения, а частота запусков, потому что служба запускалась слишком часто за короткое время. Узнают это по строке «Start request repeated too quickly» в журнале.', 'The cause is not an exit code but the rate of starts, because the service started too often in a short time. You recognise it by “Start request repeated too quickly” in the journal.') },
        });
      } else if (e.kind === 'stable') {
        steps.push({
          id: 'stable',
          label: broken.has('manual-stop') ? 'stop' : bi('работает', 'running'),
          caption: broken.has('manual-stop')
            ? bi('Вы набрали `systemctl stop app`. systemd сам посылает процессу сигнал TERM и переводит службу в состояние inactive. Это остановка по команде, а не сбой, поэтому настройка Restart= здесь не действует при любом значении.', 'You typed `systemctl stop app`. systemd itself sends the process TERM and moves the service to inactive. This is a stop on command, not a failure, so Restart= does not apply, whatever its value.')
            : stableWhy(p),
          focus: broken.has('manual-stop') ? ['inactive'] : ['active', 'limit'],
          say: broken.has('manual-stop') ? { inactive: bi('systemd остановил службу по вашей команде и не перезапустит её.', 'systemd stopped the service on your command and will not restart it.') } : { active: bi('Служба снова работает, а лимит запусков так и не наступил.', 'The service runs again, and the start limit never came.') },
          states: broken.has('manual-stop') ? { inactive: 'on', active: 'off', main: 'off' } : { active: 'ok' },
          values,
          fill,
          metrics,
          broken: broken.has('manual-stop') ? { at: 'inactive', message: 'systemd[1]: Stopping app.service...\nsystemd[1]: app.service: Deactivated successfully.\nsystemd[1]: Stopped app.service.', caption: bi('Остановка по команде не считается сбоем: процесс завершился по просьбе самого systemd, поэтому Restart= не срабатывает. В журнале это видно по строке «Deactivated successfully».', 'A stop on command is not a failure: the process ended at systemd’s own request, so Restart= does not fire. The journal shows it as “Deactivated successfully”.') } : undefined,
        });
      }
    }
    return collapseRepeats(steps);
  },
  explainDelta(prev, next, change, a, b): Bi {
    void prev;
    const fin = next.some((s) => s.id === 'limit') ? 'limit' : next.some((s) => s.id === 'failed') ? 'failed' : 'running';
    const verdict = fin === 'limit' ? bi('systemd прекращает попытки, потому что исчерпан лимит запусков (start-limit-hit)', 'systemd stops trying because the start limit is used up (start-limit-hit)') : fin === 'failed' ? bi('служба остаётся в состоянии failed без перезапуска', 'the service stays failed with no restart') : bi('служба продолжает работать, потому что перезапуски не упираются в лимит', 'the service keeps running, because the restarts never hit the limit');
    if (change.kind === 'break') return change.on ? fmtb(bi('Поломка включена, и теперь {v}.', 'The break is on, and now {v}.'), { v: verdict }) : bi('Поломку убрали, и служба снова ведёт себя так, как задают настройки.', 'The break is removed, and the service again behaves as the settings say.');
    switch (change.id) {
      case 'restart':
        return fmtb(bi('Настройка Restart= изменилась с {a} на {b}, и теперь {v}.', 'Restart= changed from {a} to {b}, and now {v}.'), { a: String(a.restart), b: String(b.restart), v: verdict });
      case 'restartSec':
      {
        const fit = Math.min(Number(b.burst) + 1, Math.ceil(10 / Math.max(0.1, Number(b.restartSec) + Number(b.after))));
        return fmtb(bi('Пауза RestartSec= теперь равна {s} с, и в окно 10 секунд помещается не больше {n}, поэтому {v}.', 'RestartSec= is now {s} s, and no more than {n} fit into the 10-second window, so {v}.'), { s: sb(ruNum(Number(b.restartSec)), String(b.restartSec)), n: sb(startsGenRu(fit), startsEn(fit)), v: verdict });
      }
      case 'burst':
        return fmtb(bi('Лимит StartLimitBurst= теперь равен {n}, и {v}.', 'StartLimitBurst= is now {n}, and {v}.'), { n: Number(b.burst), v: verdict });
      case 'crash':
        return fmtb(bi('Программа теперь завершается по другой причине, и при настройке Restart={r} {v}.', 'The program now ends for a different reason, and with Restart={r} {v}.'), { r: String(b.restart), v: verdict });
      case 'after':
        return fmtb(bi('Программа теперь работает {s} с до сбоя, и {v}.', 'The program now runs {s} s before it fails, and {v}.'), { s: Number(b.after), v: verdict });
    }
    return verdict;
  },
});
