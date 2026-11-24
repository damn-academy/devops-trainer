// X4, screen 7: how work is run at scale in the same three worlds as
// containers.stack. One event (a server burns, a new version goes out, the
// load triples, a bad update is rolled back) is played in each world in turn:
// bare metal with a person on call, virtual machines under a virtualisation
// manager (HA restart, templates, clones, snapshots), containers with plain
// Docker or with an orchestrator (scheduler, controllers, ReplicaSet,
// rolling update, HPA). Counters under the diagram add up minutes of
// downtime, minutes of manual work, people woken and the risk of a mistake.
//
// Reading order: at the start only the first world is on the diagram. Each
// world appears when its turn comes; every step has one actor that says in a
// callout what it does, and what it hands on travels along the line as a
// card. The model of every number is written on the cards of the acting
// nodes (ORCH below) and checked by tests/containers-orchestration.test.ts.

import { defineModel } from '../../../core/define';
import { bi, fmt, pluralRu, type Bi } from '../../../core/i18n';
import type { ElementState, QText, Step, Token } from '../../../core/types';
import { STACK } from './stack';
import { fmtb, startWith } from './util';

type P = { event: string; servers: number; orchestrator: boolean; staleTemplate: boolean };
export type OrchEvent = 'fire' | 'deploy' | 'load' | 'rollback';
export type World = 'bm' | 'vm' | 'ct';

/**
 * The model of the counters, open to the learner on the cards (and tested).
 * Minutes unless the name says seconds (S) or days.
 */
export const ORCH = {
  /** Monitoring checks every server once a minute and pages after three failed checks in a row. */
  alertMin: 3,
  /** From the phone call to the first command at 3 a.m.; the Google SRE book names 5–30 minutes as usual on-call response. */
  wakeMin: 15,
  /** Bare metal: OS, application, settings and data on the spare server by hand. */
  bmRestoreMin: 45,
  /** vSphere HA declares a host failed after about 15 s without heartbeats (das.failuredetectiontime). */
  haDetectS: 15,
  haPlaceS: 5,
  vmBootS: STACK.vmBootMs / 1000,
  appStartS: 20,
  /** A VM whose disk was on the burnt host comes back from a backup by hand. */
  vmBackupRestoreMin: 30,
  /** Docker without an orchestrator: `docker run` on another server, parameters typed from memory. */
  dockerRestoreMin: 10,
  /** Kubernetes defaults: node-monitor-grace-period 50 s (v1.32+), then tolerationSeconds 300 for unreachable nodes. */
  nodeGraceS: 50,
  tolerationS: 300,
  podStartS: 10,
  /** A person frees memory or adds a server when the orchestrator has no room. */
  addRoomMin: 30,
  bmPrepMin: 10,
  bmUpdateMin: 10,
  bmStopMin: 3,
  templateMin: 30,
  vmSwitchMin: 3,
  vmCutoverMin: 1,
  /** Fixing by hand what a stale template left out on the clones. */
  driftMin: 30,
  dockerUpdateMin: 3,
  dockerSwapS: 10,
  editMin: 2,
  /** One wave of a rolling update: start, readiness check, stop the old copies. */
  waveS: 15,
  leadDays: 14,
  orderMin: 10,
  serverInstallMin: 60,
  cloneJobMin: 10,
  vmCloneMin: 5,
  balancerEditMin: 1,
  dockerRunMin: 1,
  /** metrics-server collects usage every 60 s, the HPA compares every 15 s. */
  hpaReactS: 75,
  hpaPeriodS: 15,
  snapshotRevertMin: 2,
  revertJobMin: 5,
  undoMin: 1,
  /** About 8 % of servers have at least one hardware incident a year (Vishwanath & Nagappan, SoCC 2010). */
  failuresPerServerYear: 0.08,
};

export const WORLDS: World[] = ['bm', 'vm', 'ct'];

/** Rolling update with maxSurge 25 % and maxUnavailable 0: a quarter of the copies (rounded up) per wave. */
export function waves(n: number) {
  const surge = Math.ceil(n / 4);
  return { surge, waves: Math.ceil(n / surge) };
}

/** HPA scale-up from n to 3n: at most max(double, +4) per period (the default scaleUp policies). */
export function hpaPeriods(n: number): number {
  let r = n;
  let k = 0;
  while (r < 3 * n) {
    r = Math.min(3 * n, Math.max(2 * r, r + 4));
    k++;
  }
  return k;
}

type Phase = {
  world: World;
  id: string;
  label: QText;
  caption: Bi;
  actor: string;
  say: Bi;
  focus?: string[];
  tokens?: Token[];
  reveal?: string[];
  states?: Record<string, ElementState>;
  values?: Record<string, string>;
  down?: number;
  manual?: number;
  woken?: number;
  risk?: 1 | 2 | 3;
  broken?: Step['broken'];
};

const r2 = (x: number) => Math.round(x * 100) / 100;
const dec = (x: number): Bi => ({ ru: String(r2(x)).replace('.', ','), en: String(r2(x)) });
const word = (n: number, ru: [string, string, string], en: [string, string]): Bi => ({ ru: `${n} ${pluralRu(n, ru)}`, en: `${n} ${n === 1 ? en[0] : en[1]}` });
const servers = (n: number) => word(n, ['сервер', 'сервера', 'серверов'], ['server', 'servers']);
const serversOn = (n: number): Bi => ({ ru: `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'сервере' : 'серверах'}`, en: `${n} ${n === 1 ? 'server' : 'servers'}` });
const vms = (n: number) => word(n, ['виртуальную машину', 'виртуальные машины', 'виртуальных машин'], ['virtual machine', 'virtual machines']);
const containers = (n: number) => word(n, ['контейнер', 'контейнера', 'контейнеров'], ['container', 'containers']);
const secs = (n: number) => word(n, ['секунду', 'секунды', 'секунд'], ['second', 'seconds']);
/** A duration given in minutes, said in words: under two minutes in seconds («65 секунд»), otherwise in minutes and the remaining seconds. */
const mins = (x: number): Bi => {
  const total = Math.round(x * 60);
  if (total < 120 && total % 60 !== 0) return secs(total);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const mw = word(m, ['минуту', 'минуты', 'минут'], ['minute', 'minutes']);
  return s ? { ru: `${mw.ru} ${secs(s).ru}`, en: `${mw.en} ${secs(s).en}` } : mw;
};
/** True when a counter in minutes reads better in seconds: a fraction of a minute under two minutes. */
const inSeconds = (x: number) => x < 2 && !Number.isInteger(x);
/** Counters of time: under two minutes in seconds, otherwise in whole minutes. */
const putTime = (out: Record<string, number>, id: string, x: number) => {
  if (inSeconds(x)) out[`${id}S`] = Math.round(x * 60);
  else out[id] = Math.round(x);
};

const BM = ['bm-admin', 'bm-a', 'bm-rest', 'e-bm-a', 'e-bm-rest'];
const VM = ['vm-admin', 'vm-mgr', 'vm-a', 'vm-rest', 'e-vm-admin', 'e-vm-hb', 'e-vm-act'];
const CT_PLAIN = ['ct-admin', 'ct-a', 'ct-rest', 'e-ct-a', 'e-ct-rest'];
const CT_ORCH = ['ct-admin', 'ct-cp', 'ct-a', 'ct-rest', 'e-ct-admin', 'e-ct-hb', 'e-ct-act'];
const ALL = [...BM, ...VM, 'ct-admin', 'ct-cp', 'ct-a', 'ct-rest', 'e-ct-a', 'e-ct-rest', 'e-ct-admin', 'e-ct-hb', 'e-ct-act'];

const NO_SIGNAL = bi('нет сигнала', 'no heartbeat');

/** The process of one event in all three worlds, phase by phase, with the counters each phase adds. */
export function orchPlan(p: P, broken: ReadonlySet<string>): Phase[] {
  const o = ORCH;
  const n = p.servers;
  const rest = n - 1;
  const extra = 2 * n;
  const ev = p.event as OrchEvent;
  const orch = p.orchestrator;
  const noRoom = orch && broken.has('no-room');
  const localDisk = broken.has('vm-local-disk');
  const stale = p.staleTemplate;
  const { surge, waves: w } = waves(n);
  const ph: Phase[] = [];
  const add = (x: Phase) => ph.push(x);
  const restVal = `× ${rest}`;
  const times = word(n, ['раз', 'раза', 'раз'], ['time', 'times']);

  // What a person does at 3 a.m. after the call, shared by the worlds that wake someone.
  const wakeStep = (world: World, actor: string, id: string, caption: Bi, say: Bi, extraStates?: Record<string, ElementState>): Phase => ({
    world,
    id,
    label: bi('дежурный', 'on call'),
    caption,
    actor,
    say,
    down: o.wakeMin,
    woken: 1,
    states: extraStates,
  });

  // The first step of the orchestrated world: what an orchestrator is, said in every event, because the learner may start with any of them.
  const orchIntro = (states: Record<string, ElementState>, values: Record<string, string>): Phase => ({
    world: 'ct',
    id: `${ev === 'rollback' ? 'rb' : ev}-k8s-orch`,
    label: bi('оркестратор', 'orchestrator'),
    caption: bi(
      'В третьем мире контейнерами управляет оркестратор, то есть программа, которая сама решает, на каком сервере запустить каждый контейнер, и следит, чтобы работало то, что записано в описании службы. Самый известный оркестратор называется Kubernetes.',
      'In the third world an orchestrator manages the containers, a program that decides by itself which server runs each container and makes sure that what the service description says is running. The best-known orchestrator is Kubernetes.',
    ),
    actor: 'ct-cp',
    say: bi('Оркестратор следит за всеми серверами.', 'The orchestrator watches all the servers.'),
    reveal: CT_ORCH,
    states,
    values,
  });

  // The "no room" break of the orchestrated world: where it stops and what it costs a person.
  const pending = (id: string, caption: Bi, message: string, after: 'page' | 'wait'): Phase => ({
    world: 'ct',
    id,
    label: 'Pending',
    caption,
    actor: 'ct-cp',
    say: bi('Новые копии ждут свободного места со статусом Pending.', 'The new copies wait for room as Pending.'),
    focus: ['ct-cp', 'e-ct-act'],
    states: { 'ct-cp': 'err', 'ct-rest': 'wait' },
    ...(after === 'page' ? { down: o.alertMin + o.wakeMin + o.addRoomMin, manual: o.addRoomMin, woken: 1 } : {}),
    risk: 2,
    broken: {
      at: 'ct-cp',
      message,
      caption:
        after === 'page'
          ? fmt(
              bi(
                'Работа остановилась у оркестратора, которому негде запустить новые копии. Мониторинг через {a} минуты будит дежурного, и тот освобождает память или ставит ещё один сервер, на что уходит около {m} минут.',
                'Work stopped at the orchestrator, which has nowhere to start the new copies. Monitoring wakes the on-call person after {a} minutes, and they free memory or add a server, which takes about {m} minutes.',
              ),
              { a: o.alertMin, m: o.addRoomMin },
            )
          : bi(
              'Обновление остановилось у оркестратора, которому негде запустить новые копии. Старые копии работают, пока новые не готовы, поэтому служба отвечает на прежней версии, а новые копии ждут, пока кто-нибудь освободит память.',
              'The update stopped at the orchestrator, which has nowhere to start the new copies. The old copies keep working until the new ones are ready, so the service answers on the old version while the new copies wait for someone to free memory.',
            ),
    },
  });

  const driftStep = (): Phase => ({
    world: 'vm',
    id: `${ev}-vm-drift`,
    label: bi('расхождение', 'mismatch'),
    caption: bi(
      'Шаблон не обновляли полгода, а исправления всё это время ставили вручную на работающие машины. Новые машины сделаны с шаблона, и этих исправлений в них нет, поэтому часть запросов на них заканчивается ошибкой.',
      'The template has not been updated for six months, while fixes were applied by hand to the running machines. The new machines are made from the template and lack those fixes, so some requests to them fail.',
    ),
    actor: 'vm-rest',
    say: bi('На новых машинах нет исправлений последних полугода.', 'The new machines lack the fixes of the last six months.'),
    focus: ['vm-rest'],
    states: { 'vm-rest': 'warn' },
    values: { 'vm-rest': 'template −6 mo' },
  });
  const driftFix = (): Phase => ({
    world: 'vm',
    id: `${ev}-vm-drift-fix`,
    label: bi('доделка', 'patching'),
    caption: fmt(
      bi(
        'Администратор около {d} минут ищет, чем новые машины отличаются от старых, и доделывает исправления руками. Так ошибиться легче всего, поэтому риск ошибки становится высоким.',
        'The administrator spends about {d} minutes finding how the new machines differ from the old ones and finishes the fixes by hand. This is where a mistake is easiest, so the risk of a mistake becomes high.',
      ),
      { d: o.driftMin },
    ),
    actor: 'vm-admin',
    say: bi('Администратор вручную ставит на новые машины пропущенные исправления.', 'The administrator applies the missing fixes to the new machines by hand.'),
    focus: ['vm-admin', 'vm-rest'],
    down: o.driftMin,
    manual: o.driftMin,
    risk: 3,
  });

  if (ev === 'fire') {
    const perYear = r2(n * o.failuresPerServerYear);
    add({
      world: 'bm',
      id: 'fire-bm-alert',
      label: bi('тревога', 'alert'),
      caption: fmt(
        bi(
          'Три часа ночи, и в стойке сгорел блок питания сервера 1. Мониторинг, то есть программа, которая раз в минуту проверяет каждый сервер, три раза подряд не получил ответа и через {a} минуты позвонил дежурному.',
          'It is 3 a.m., and the power supply of server 1 has burnt out. Monitoring, a program that checks every server once a minute, got no answer three times in a row and called the on-call administrator after {a} minutes.',
        ),
        { a: o.alertMin },
      ),
      actor: 'bm-admin',
      say: bi('Телефон дежурного звонит, потому что сервер 1 не отвечает.', 'The on-call phone rings, because server 1 does not answer.'),
      focus: ['bm-admin', 'e-bm-a'],
      tokens: [{ edge: 'e-bm-a', label: 'srv-01 DOWN', reverse: true }],
      states: { 'bm-a': 'err' },
      down: o.alertMin,
    });
    add({
      world: 'bm',
      id: 'fire-bm-odds',
      label: bi('как часто', 'how often'),
      caption: fmtb(
        bi(
          'Аппаратные поломки серверов случаются чаще, чем кажется. Примерно у 8 % серверов за год бывает хотя бы одна неисправность, поэтому на {n} такое случается в среднем {y} раза в год.',
          'Server hardware fails more often than it seems. About 8 % of servers have at least one hardware incident a year, so with {n} this happens on average {y} times a year.',
        ),
        { n: serversOn(n), y: dec(perYear) },
      ),
      actor: 'bm-a',
      say: bi('Сервер 1 не включается, потому что сгорел его блок питания.', 'Server 1 does not power on, because its power supply burnt out.'),
      focus: ['bm-a'],
    });
    add(
      wakeStep(
        'bm',
        'bm-admin',
        'fire-bm-wake',
        fmt(
          bi(
            'Администратор просыпается, включает ноутбук и подключается к серверам. От звонка до первой команды проходит около {w} минут, и всё это время работа сервера 1 стоит, потому что выполнить её больше некому.',
            'The administrator wakes up, opens the laptop and connects to the servers. About {w} minutes pass from the call to the first command, and all that time server 1’s work stands still, as nobody else can do it.',
          ),
          { w: o.wakeMin },
        ),
        bi('Администратор подключается и видит, что сервер 1 не включается.', 'The administrator connects and finds that server 1 does not power on.'),
      ),
    );
    add({
      world: 'bm',
      id: 'fire-bm-restore',
      label: bi('вручную', 'by hand'),
      caption: bi(
        'Резервный сервер в стойке есть, но на нём ничего не установлено. Администратор ставит систему, приложение и настройки по памяти и по старой инструкции, а данные переносит из последней резервной копии.',
        'There is a spare server in the rack, but nothing is installed on it. The administrator installs the system, the application and the settings from memory and an old guide, and copies the data from the last backup.',
      ),
      actor: 'bm-admin',
      say: bi('Администратор вручную ставит на резервный сервер всё, что было на сервере 1.', 'The administrator installs by hand on the spare server everything server 1 had.'),
      focus: ['bm-admin', 'e-bm-rest'],
      tokens: [{ edge: 'e-bm-rest', label: bi('установка вручную', 'install by hand') }],
    });
    add({
      world: 'bm',
      id: 'fire-bm-risk',
      label: bi('риск', 'risk'),
      caption: fmt(
        bi(
          'Вместе с переключением адреса на это уходит около {r} минут, и риск ошибки высокий. В три часа ночи легко забыть настройку, которую пять лет назад вписали на сервер 1 вручную.',
          'Together with moving the address this takes about {r} minutes, and the risk of a mistake is high. At 3 a.m. it is easy to forget a setting that someone typed into server 1 by hand five years ago.',
        ),
        { r: o.bmRestoreMin },
      ),
      actor: 'bm-admin',
      say: bi('Администратор переключает адрес сервера 1 на резервный сервер.', 'The administrator moves server 1’s address to the spare server.'),
      focus: ['bm-admin', 'bm-rest'],
      states: { 'bm-rest': 'ok' },
      down: o.bmRestoreMin,
      manual: o.bmRestoreMin,
      risk: 3,
    });

    add({
      world: 'vm',
      id: 'fire-vm-mgr',
      label: bi('менеджер', 'manager'),
      caption: bi(
        'Во втором мире на серверах стоят гипервизоры, а над ними работает менеджер виртуализации, например VMware vCenter или OpenStack. Он знает, какая машина на каком хосте работает, и каждую секунду получает от хостов сигнал, что они в порядке.',
        'In the second world the servers run hypervisors, and a virtualisation manager such as VMware vCenter or OpenStack works above them. It knows which machine runs on which host and gets a heartbeat from every host each second.',
      ),
      actor: 'vm-mgr',
      say: bi('Менеджер следит за всеми хостами сразу.', 'The manager watches all the hosts at once.'),
      reveal: VM,
      values: { 'vm-rest': restVal },
    });
    add({
      world: 'vm',
      id: 'fire-vm-hb',
      label: NO_SIGNAL,
      caption: fmt(
        bi('Хост 1 сгорел, сигнал от него пропал, и через {d} секунд менеджер признаёт хост вышедшим из строя.', 'Host 1 burnt out, its heartbeat stopped, and after {d} seconds the manager declares the host failed.'),
        { d: o.haDetectS },
      ),
      actor: 'vm-mgr',
      say: fmt(bi('Менеджер {d} секунд не получает сигнала от хоста 1 и признаёт хост вышедшим из строя.', 'The manager has had no heartbeat from host 1 for {d} seconds and declares the host failed.'), { d: o.haDetectS }),
      focus: ['vm-mgr', 'e-vm-hb'],
      tokens: [{ edge: 'e-vm-hb', label: NO_SIGNAL }],
      states: { 'vm-a': 'err' },
      down: o.haDetectS / 60,
    });
    if (localDisk) {
      add({
        world: 'vm',
        id: 'fire-vm-nodisk',
        label: bi('нет диска', 'no disk'),
        caption: bi(
          'Диски виртуальных машин лежали на собственном диске хоста 1, а не в общем хранилище, поэтому запускать эти машины на других хостах не с чего. Менеджер отправляет тревогу дежурному.',
          'The virtual machines’ disks were on host 1’s own disk, not in shared storage, so there is nothing to start them from on another host. The manager sends an alert to the on-call person.',
        ),
        actor: 'vm-mgr',
        say: bi('Менеджер не находит дисков машин хоста 1 в общем хранилище.', 'The manager does not find host 1’s machine disks in shared storage.'),
        focus: ['vm-mgr'],
        states: { 'vm-mgr': 'err' },
      });
      add({
        world: 'vm',
        id: 'fire-vm-backup',
        label: bi('резервная копия', 'backup'),
        caption: fmt(
          bi(
            'Дежурный просыпается и через {w} минут подключается. Ещё около {b} минут он восстанавливает машины хоста 1 из резервной копии, и всё это время их работа стоит.',
            'The on-call person wakes up and connects after {w} minutes. They spend about {b} more minutes restoring host 1’s machines from a backup, and all that time their work stands still.',
          ),
          { w: o.wakeMin, b: o.vmBackupRestoreMin },
        ),
        actor: 'vm-admin',
        say: bi('Дежурный восстанавливает машины хоста 1 из резервной копии.', 'The on-call person restores host 1’s machines from a backup.'),
        focus: ['vm-admin', 'vm-mgr'],
        down: o.wakeMin + o.vmBackupRestoreMin,
        manual: o.vmBackupRestoreMin,
        woken: 1,
        risk: 2,
        broken: {
          at: 'vm-mgr',
          message: 'vSphere HA virtual machine failover failed',
          caption: bi(
            'Работа остановилась у менеджера виртуализации. Без общего хранилища автоматический перезапуск на другом хосте невозможен, и восстанавливать машины из резервной копии приходится человеку.',
            'Work stopped at the virtualisation manager. Without shared storage there is no automatic restart on another host, and a person has to restore the machines from a backup.',
          ),
        },
      });
      return ph;
    }
    add({
      world: 'vm',
      id: 'fire-vm-restart',
      label: bi('перезапуск', 'restart'),
      caption: bi(
        'Диски виртуальных машин лежат не на самом хосте, а в общем хранилище, к которому подключены все хосты. Поэтому менеджер запускает те же машины на хостах со свободной памятью.',
        'The virtual machines’ disks are not on the host itself but in shared storage that every host is connected to. So the manager starts the same machines on hosts with free memory.',
      ),
      actor: 'vm-mgr',
      say: bi('Менеджер запускает машины хоста 1 на других хостах с тех же дисков.', 'The manager starts host 1’s machines on other hosts from the same disks.'),
      focus: ['vm-mgr', 'e-vm-act'],
      tokens: [{ edge: 'e-vm-act', label: bi('перезапуск ВМ', 'restart VMs') }],
    });
    add({
      world: 'vm',
      id: 'fire-vm-boot',
      label: bi('загрузка', 'boot'),
      caption: fmtb(
        bi(
          'Каждая машина загружается заново, как после выключения питания: гостевая система около {b} секунд, приложение ещё около {app} секунд. Через {t} работа хоста 1 снова выполняется, но всё, что машины держали в памяти, пропало.',
          'Each machine boots again as after a power cut: the guest system takes about {b} seconds, the application about {app} more. After {t} the work of host 1 runs again, but everything the machines held in memory is gone.',
        ),
        { b: o.vmBootS, app: o.appStartS, t: mins(r2((o.haDetectS + o.haPlaceS + o.vmBootS + o.appStartS) / 60)) },
      ),
      actor: 'vm-rest',
      say: bi('Машины хоста 1 загружаются на других хостах заново.', 'Host 1’s machines boot again on other hosts.'),
      focus: ['vm-rest'],
      states: { 'vm-rest': 'ok' },
      down: (o.haPlaceS + o.vmBootS + o.appStartS) / 60,
    });
    add({
      world: 'vm',
      id: 'fire-vm-mail',
      label: bi('письмо', 'e-mail'),
      caption: bi(
        'Менеджер отправляет администратору письмо о сгоревшем хосте, и тот прочитает его утром. Ночью никого не разбудили, ручной работы не было, и риск ошибки низкий, потому что машины запустились с теми же дисками.',
        'The manager e-mails the administrator about the burnt host, to be read in the morning. Nobody was woken, there was no manual work, and the risk of a mistake is low, because the machines started from the same disks.',
      ),
      actor: 'vm-admin',
      say: bi('Администратор узнает о сгоревшем хосте утром из письма.', 'The administrator learns about the burnt host from an e-mail in the morning.'),
      focus: ['vm-admin', 'e-vm-admin'],
      tokens: [{ edge: 'e-vm-admin', label: bi('письмо', 'e-mail'), reverse: true }],
      risk: 1,
    });
    add({
      world: 'vm',
      id: 'fire-vm-cond',
      label: bi('условия', 'conditions'),
      caption: bi(
        'У такого перезапуска два условия. Нужно общее хранилище для дисков и запас свободной памяти на остальных хостах, который менеджер держит заранее.',
        'Such a restart has two conditions. It needs shared storage for the disks and spare memory on the other hosts, which the manager keeps in reserve.',
      ),
      actor: 'vm-mgr',
      say: bi('Менеджер держит на хостах запас памяти для машин сгоревшего хоста.', 'The manager keeps spare memory on the hosts for a burnt host’s machines.'),
      focus: ['vm-mgr', 'vm-rest'],
    });

    if (!orch) {
      add({
        world: 'ct',
        id: 'fire-ct-nobody',
        label: bi('никто', 'nobody'),
        caption: bi(
          'В третьем мире контейнеры запускает Docker, отдельный на каждом сервере. Docker сервера 1 сгорел вместе с сервером, а Docker на остальных серверах знает только свои контейнеры.',
          'In the third world Docker starts the containers, a separate Docker on each server. Server 1’s Docker burnt with the server, and the Docker on the other servers knows only its own containers.',
        ),
        actor: 'ct-rest',
        say: bi('Docker остальных серверов о контейнерах сервера 1 не знает.', 'Docker on the other servers knows nothing about server 1’s containers.'),
        focus: ['ct-rest'],
        reveal: CT_PLAIN,
        states: { 'ct-a': 'err' },
        values: { 'ct-rest': restVal },
      });
      add({
        world: 'ct',
        id: 'fire-ct-alert',
        label: bi('тревога', 'alert'),
        caption: fmt(
          bi(
            'Перезапустить контейнеры сервера 1 на другом сервере некому, поэтому, как и в первом мире, через {a} минуты мониторинг звонит дежурному.',
            'Nobody can restart server 1’s containers on another server, so, as in the first world, monitoring calls the on-call person after {a} minutes.',
          ),
          { a: o.alertMin },
        ),
        actor: 'ct-admin',
        say: bi('Телефон дежурного звонит, потому что сервер 1 не отвечает.', 'The on-call phone rings, because server 1 does not answer.'),
        focus: ['ct-admin', 'e-ct-a'],
        tokens: [{ edge: 'e-ct-a', label: 'srv-01 DOWN', reverse: true }],
        down: o.alertMin,
      });
      add(
        wakeStep(
          'ct',
          'ct-admin',
          'fire-ct-wake',
          fmt(
            bi(
              'Администратор просыпается и через {w} минут подключается к серверам, как в первом мире. Работа сервера 1 всё это время стоит.',
              'The administrator wakes up and connects to the servers after {w} minutes, as in the first world. The work of server 1 stands still all that time.',
            ),
            { w: o.wakeMin },
          ),
          bi('Администратор подключается к серверам и выясняет, что сервер 1 не отвечает.', 'The administrator connects to the servers and finds that server 1 does not answer.'),
        ),
      );
      add({
        world: 'ct',
        id: 'fire-ct-image',
        label: bi('образ', 'image'),
        caption: bi(
          'Дальше дело идёт быстрее, чем в первом мире. Программа со всеми библиотеками уже собрана в образ контейнера, то есть в архив её файлов, и устанавливать ничего не нужно.',
          'From here it goes faster than in the first world. The program and all its libraries are already packed into a container image, an archive of its files, and nothing has to be installed.',
        ),
        actor: 'ct-admin',
        say: bi('Администратору ничего не нужно устанавливать, потому что образ уже готов.', 'The administrator has nothing to install, because the image is ready.'),
        focus: ['ct-admin'],
      });
      add({
        world: 'ct',
        id: 'fire-ct-run',
        label: 'docker run',
        caption: fmt(
          bi(
            'Администратор запускает контейнер на сервере со свободной памятью командой `docker run`, но параметры команды, переменные окружения и подключённые каталоги вспоминает сам. На это уходит около {r} минут.',
            'The administrator starts the container on a server with free memory with `docker run`, but recalls the command’s parameters, environment variables and mounted directories alone. This takes about {r} minutes.',
          ),
          { r: o.dockerRestoreMin },
        ),
        actor: 'ct-admin',
        say: bi('Администратор вписывает параметры docker run по памяти.', 'The administrator types the docker run parameters from memory.'),
        focus: ['ct-admin', 'e-ct-rest'],
        tokens: [{ edge: 'e-ct-rest', label: 'docker run …' }],
        down: o.dockerRestoreMin,
        manual: o.dockerRestoreMin,
      });
      add({
        world: 'ct',
        id: 'fire-ct-data',
        label: bi('данные', 'data'),
        caption: bi(
          'Данные, которые контейнер хранил на диске сервера 1, остались на сгоревшем сервере, а параметры набраны по памяти. Поэтому риск ошибки средний.',
          'The data the container kept on server 1’s disk stayed on the burnt server, and the parameters were typed from memory. So the risk of a mistake is medium.',
        ),
        actor: 'ct-rest',
        say: bi('Новый контейнер работает, но без данных с диска сервера 1.', 'The new container runs, but without the data from server 1’s disk.'),
        focus: ['ct-rest'],
        states: { 'ct-rest': 'ok' },
        risk: 2,
      });
      return ph;
    }

    add(orchIntro({ 'ct-a': 'err' }, { 'ct-rest': restVal }));
    add({
      world: 'ct',
      id: 'fire-k8s-hb',
      label: NO_SIGNAL,
      caption: fmt(
        bi(
          'Каждый сервер раз в несколько секунд сообщает оркестратору, что он в порядке. От сервера 1 сообщения прекратились, и через {g} секунд оркестратор помечает его неготовым.',
          'Every server tells the orchestrator every few seconds that it is fine. Server 1 went silent, and after {g} seconds the orchestrator marks it not ready.',
        ),
        { g: o.nodeGraceS },
      ),
      actor: 'ct-cp',
      say: fmt(bi('Оркестратор {g} секунд не получал сообщений от сервера 1 и помечает его неготовым.', 'The orchestrator has heard nothing from server 1 for {g} seconds and marks it not ready.'), { g: o.nodeGraceS }),
      focus: ['ct-cp', 'e-ct-hb'],
      tokens: [{ edge: 'e-ct-hb', label: NO_SIGNAL }],
      down: o.nodeGraceS / 60,
    });
    add({
      world: 'ct',
      id: 'fire-k8s-wait',
      label: bi('ожидание', 'wait'),
      caption: fmt(
        bi(
          'Оркестратор переносит копии не сразу. По умолчанию он ждёт ещё {tol} секунд, то есть пять минут, потому что сервер мог ненадолго пропасть из сети и сейчас вернуться.',
          'The orchestrator does not move the copies at once. By default it waits another {tol} seconds, five minutes, because the server may have dropped off the network briefly and be about to return.',
        ),
        { tol: o.tolerationS },
      ),
      actor: 'ct-cp',
      say: bi('Оркестратор пять минут ждёт, не вернётся ли сервер 1.', 'The orchestrator waits five minutes for server 1 to come back.'),
      focus: ['ct-cp'],
      down: o.tolerationS / 60,
    });
    add({
      world: 'ct',
      id: 'fire-k8s-why',
      label: bi('зачем ждать', 'why wait'),
      caption: bi(
        'Переносить сотни копий из-за короткого сбоя сети дороже, чем подождать. Время ожидания записано в описании копии, и его можно уменьшить.',
        'Moving hundreds of copies over a short network failure costs more than waiting. The waiting time is written in the copy’s description and can be lowered.',
      ),
      actor: 'ct-cp',
      say: bi('Оркестратор берёт время ожидания из описания копии.', 'The orchestrator takes the waiting time from the copy’s description.'),
      focus: ['ct-cp'],
    });
    if (noRoom)
      return [
        ...ph,
        pending(
          'fire-k8s-pending',
          bi(
            'Оркестратор создаёт замену для копии сервера 1, но не находит сервера со свободной памятью, и копия ждёт в очереди со статусом Pending, то есть «ожидает». Сам оркестратор места не добавит, поэтому разбираться приходится человеку.',
            'The orchestrator creates a replacement for server 1’s copy but finds no server with free memory, and the copy waits in a queue as Pending. The orchestrator cannot add room by itself, so a person has to deal with it.',
          ),
          `0/${n} nodes are available: 1 node(s) had untolerated taint {node.kubernetes.io/unreachable: }, ${rest} Insufficient memory.`,
          'page',
        ),
      ];
    add({
      world: 'ct',
      id: 'fire-k8s-schedule',
      label: bi('новая копия', 'new copy'),
      caption: bi(
        'Контроллер, то есть часть оркестратора, которая сравнивает число копий в описании с числом работающих, видит, что копий на одну меньше, и создаёт новую.',
        'The controller, the part of the orchestrator that compares the number of copies in the description with the number running, sees one copy missing and creates a new one.',
      ),
      actor: 'ct-cp',
      say: bi('Контроллер создаёт недостающую копию.', 'The controller creates the missing copy.'),
      focus: ['ct-cp'],
    });
    add({
      world: 'ct',
      id: 'fire-k8s-start',
      label: bi('запуск', 'start'),
      caption: fmt(
        bi(
          'Планировщик, другая часть оркестратора, выбирает для новой копии сервер со свободной памятью. Контейнер запускается примерно за {s} секунд, потому что гостевой системы у него нет.',
          'The scheduler, another part of the orchestrator, picks a server with free memory for the new copy. The container starts in about {s} seconds, because it has no guest system.',
        ),
        { s: o.podStartS },
      ),
      actor: 'ct-cp',
      say: bi('Планировщик отправляет новую копию на сервер со свободной памятью.', 'The scheduler sends the new copy to a server with free memory.'),
      focus: ['ct-cp', 'e-ct-act'],
      tokens: [{ edge: 'e-ct-act', label: bi('+1 копия', '+1 copy') }],
      states: { 'ct-rest': 'ok' },
      down: o.podStartS / 60,
    });
    add({
      world: 'ct',
      id: 'fire-k8s-total',
      label: bi('итог', 'total'),
      caption: fmtb(
        bi(
          'Всего работа сервера 1 стояла {t}. Это дольше, чем у виртуальных машин, потому что пять минут из них оркестратор ждал.',
          'In all, server 1’s work stood still for {t}. That is longer than with virtual machines, because the orchestrator spent five of those minutes waiting.',
        ),
        { t: mins(r2((o.nodeGraceS + o.tolerationS + o.podStartS) / 60)) },
      ),
      actor: 'ct-cp',
      say: bi('Оркестратор восстановил копию без участия человека.', 'The orchestrator restored the copy without a person.'),
      focus: ['ct-cp'],
    });
    add({
      world: 'ct',
      id: 'fire-k8s-state',
      label: bi('без данных', 'no data'),
      caption: bi(
        'Никого не разбудили, ручной работы не было, и риск ошибки низкий, потому что новую копию оркестратор собрал по тому же описанию. Так переезжают копии, которые не хранят данных на диске своего сервера.',
        'Nobody was woken, there was no manual work, and the risk of a mistake is low, because the orchestrator built the new copy from the same description. This is how copies move that keep no data on their server’s disk.',
      ),
      actor: 'ct-cp',
      say: bi('Копия без данных на диске переезжает без потерь.', 'A copy with no data on disk moves without losses.'),
      focus: ['ct-cp', 'ct-rest'],
      risk: 1,
    });
    add({
      world: 'ct',
      id: 'fire-k8s-data',
      label: bi('данные', 'data'),
      caption: bi(
        'Копию с данными оркестратор переносит, только если данные лежат в сетевом хранилище, как диски машин во втором мире. А службу, которой нельзя стоять и шесть минут, запускают в двух копиях на разных серверах.',
        'A copy with data moves only if its data lies in network storage, like the VM disks in the second world. And a service that must not stand still even for six minutes runs as two copies on different servers.',
      ),
      actor: 'ct-cp',
      say: bi('Данные копии должны лежать в сетевом хранилище.', 'The copy’s data must lie in network storage.'),
      focus: ['ct-cp'],
    });
    return ph;
  }

  if (ev === 'deploy') {
    add({
      world: 'bm',
      id: 'deploy-bm-prep',
      label: bi('ночью', 'at night'),
      caption: fmtb(
        bi(
          'Новую версию службы нужно поставить на все {n}. Пока на сервере меняют программу, его работа стоит, поэтому администратор начинает ночью, когда пользователей меньше.',
          'The new version of the service has to go onto all {n}. While a server’s program is being replaced, its work stands still, so the administrator starts at night, when there are fewer users.',
        ),
        { n: servers(n) },
      ),
      actor: 'bm-admin',
      say: bi('Администратор садится за обновление ночью, когда пользователей меньше.', 'The administrator starts the update at night, when there are fewer users.'),
      focus: ['bm-admin'],
      values: { 'bm-a': 'v1', 'bm-rest': `v1 ${restVal}` },
      woken: 1,
    });
    add({
      world: 'bm',
      id: 'deploy-bm-plan',
      label: bi('подготовка', 'prepare'),
      caption: bi(
        'Сначала администратор готовит архив с новой версией и список команд, которые повторит на каждом сервере.',
        'First the administrator prepares an archive with the new version and a list of commands to repeat on every server.',
      ),
      actor: 'bm-admin',
      say: bi('Администратор готовит архив новой версии и список команд.', 'The administrator prepares the new version’s archive and the list of commands.'),
      focus: ['bm-admin'],
      manual: o.bmPrepMin,
    });
    add({
      world: 'bm',
      id: 'deploy-bm-first',
      label: bi('сервер 1', 'server 1'),
      caption: fmt(
        bi(
          'На сервере 1 администратор останавливает старую версию, копирует новую, запускает её и проверяет. Работа сервера стоит около {s} минут, а у человека вместе с проверкой уходит около {u} минут.',
          'On server 1 the administrator stops the old version, copies the new one, starts it and checks it. The server’s work stands still for about {s} minutes, and the person spends about {u} minutes including the check.',
        ),
        { s: o.bmStopMin, u: o.bmUpdateMin },
      ),
      actor: 'bm-admin',
      say: bi('Администратор останавливает на сервере 1 старую версию, ставит новую и проверяет её.', 'The administrator replaces the version on server 1 and checks it.'),
      focus: ['bm-admin', 'e-bm-a'],
      tokens: [{ edge: 'e-bm-a', label: 'v2' }],
      states: { 'bm-a': 'ok' },
      values: { 'bm-a': 'v2' },
      down: o.bmStopMin,
      manual: o.bmUpdateMin,
    });
    add({
      world: 'bm',
      id: 'deploy-bm-rest',
      label: bi('остальные', 'the rest'),
      caption: fmtb(
        bi(
          'То же самое администратор повторяет ещё на {r}, одном за другим, и всего на {n} уходит {m} ручной работы.',
          'The administrator repeats the same on {r} more, one after another, and {n} take {m} of manual work in all.',
        ),
        { r: serversOn(rest), n: servers(n), m: mins(o.bmPrepMin + o.bmUpdateMin * n) },
      ),
      actor: 'bm-admin',
      say: fmtb(bi('Администратор повторяет те же команды на каждом из оставшихся {r}.', 'The administrator repeats the same commands on each of the remaining {r}.'), { r: servers(rest) }),
      focus: ['bm-admin', 'e-bm-rest'],
      tokens: [{ edge: 'e-bm-rest', label: `v2 × ${rest}` }],
      states: { 'bm-rest': 'ok' },
      values: { 'bm-rest': `v2 ${restVal}` },
      down: o.bmStopMin * rest,
      manual: o.bmUpdateMin * rest,
    });
    add({
      world: 'bm',
      id: 'deploy-bm-risk',
      label: bi('риск', 'risk'),
      caption: bi(
        'Каждый повтор даёт новую возможность ошибиться: пропустить сервер, перепутать порядок команд или оставить старый файл настроек. Поэтому риск ошибки высокий, и со временем серверы начинают отличаться друг от друга.',
        'Every repetition is a new chance to slip: to skip a server, mix up the order of commands or leave an old settings file. So the risk of a mistake is high, and over time the servers start to differ from each other.',
      ),
      actor: 'bm-rest',
      say: bi('Серверы понемногу начинают отличаться друг от друга.', 'The servers slowly start to differ from each other.'),
      focus: ['bm-rest'],
      risk: 3,
    });

    add({
      world: 'vm',
      id: 'deploy-vm-template',
      label: bi('шаблон', 'template'),
      caption: bi(
        'Во втором мире администратор один раз готовит шаблон, то есть образцовую виртуальную машину с новой версией, из которой менеджер виртуализации умеет делать копии.',
        'In the second world the administrator prepares a template once, a model virtual machine with the new version that the virtualisation manager can copy.',
      ),
      actor: 'vm-admin',
      say: bi('Администратор собирает шаблон с новой версией и передаёт его менеджеру.', 'The administrator builds a template with the new version and hands it to the manager.'),
      focus: ['vm-admin', 'e-vm-admin'],
      tokens: [{ edge: 'e-vm-admin', label: bi('шаблон v2', 'template v2') }],
      reveal: VM,
      values: { 'vm-a': 'v1', 'vm-rest': `v1 ${restVal}` },
      woken: 1,
    });
    add({
      world: 'vm',
      id: 'deploy-vm-night',
      label: bi('ночью', 'at night'),
      caption: fmt(
        bi(
          'На сборку и проверку шаблона уходит около {t} минут. Делают это тоже ночью, потому что при переключении каждая машина ненадолго перестанет отвечать.',
          'Building and checking the template takes about {t} minutes. This too is done at night, because every machine will stop answering for a moment when it is switched.',
        ),
        { t: o.templateMin },
      ),
      actor: 'vm-admin',
      say: bi('Администратор работает ночью, как и в первом мире.', 'The administrator works at night, as in the first world.'),
      focus: ['vm-admin'],
      manual: o.templateMin,
    });
    add({
      world: 'vm',
      id: 'deploy-vm-clone',
      label: bi('клоны', 'clones'),
      caption: fmtb(
        bi(
          'Менеджер создаёт из шаблона {v}, по одной на каждую старую машину, и раскладывает их по хостам, где есть место. Человек в этом не участвует, и все новые машины получаются одинаковыми, потому что сделаны с одного шаблона.',
          'The manager creates {v} from the template, one for each old machine, and places them on hosts that have room. No person takes part, and all the new machines come out the same, because they are made from one template.',
        ),
        { v: vms(n) },
      ),
      actor: 'vm-mgr',
      say: fmt(bi('Менеджер делает из шаблона {n} одинаковых клонов.', 'The manager makes {n} identical clones from the template.'), { n }),
      focus: ['vm-mgr', 'e-vm-act'],
      tokens: [{ edge: 'e-vm-act', label: bi(`клоны × ${n}`, `clones × ${n}`) }],
      values: { 'vm-rest': `v2 × ${n}` },
    });
    if (stale) {
      add(driftStep());
      add(driftFix());
    }
    add({
      world: 'vm',
      id: 'deploy-vm-switch',
      label: bi('переключение', 'switch'),
      caption: fmt(
        bi(
          'Потом администратор по очереди переключает работу со старых машин на новые и удаляет старые. На каждую машину уходит около {s} минут его времени, а работа стоит около минуты, пока переключается адрес.',
          'Then the administrator switches the work from the old machines to the new ones in turn and deletes the old ones. Each takes about {s} minutes of their time, and the work stops for about a minute while the address moves.',
        ),
        { s: o.vmSwitchMin },
      ),
      actor: 'vm-admin',
      say: bi('Администратор переключает работу на клоны по одной машине.', 'The administrator switches the work to the clones one by one.'),
      focus: ['vm-admin', 'e-vm-admin'],
      states: { 'vm-a': 'ok', 'vm-rest': 'ok' },
      values: { 'vm-a': 'v2' },
      down: o.vmCutoverMin * n,
      manual: o.vmSwitchMin * n,
    });
    add({
      world: 'vm',
      id: 'deploy-vm-risk',
      label: bi('риск', 'risk'),
      caption: fmtb(
        bi(
          'Машины одинаковые, но переключение {k} подряд делает человек, поэтому риск ошибки средний.',
          'The machines are identical, but a person does the switch {k} in a row, so the risk of a mistake is medium.',
        ),
        { k: times },
      ),
      actor: 'vm-admin',
      say: bi('Каждое переключение администратор делает вручную.', 'The administrator does every switch by hand.'),
      focus: ['vm-admin'],
      risk: stale ? 3 : 2,
    });

    if (!orch) {
      add({
        world: 'ct',
        id: 'deploy-ct-image',
        label: bi('образ', 'image'),
        caption: fmt(
          bi(
            'В третьем мире без оркестратора разработчики заранее собирают образ контейнера с новой версией, то есть архив со всеми файлами программы и её библиотеками. Образ один для всех серверов, и устанавливать на серверах ничего не нужно. Контейнер меняется примерно за {s} секунд, поэтому обновление можно делать днём, и никого будить не приходится.',
            'In the third world without an orchestrator the developers build a container image with the new version in advance: an archive with all the program’s files and its libraries. There is one image for all servers, and nothing has to be installed on them. A container is swapped in about {s} seconds, so the update can be done in the daytime and nobody has to be woken.',
          ),
          { s: o.dockerSwapS },
        ),
        actor: 'ct-admin',
        say: bi('Администратор берёт готовый образ новой версии, один и тот же для всех серверов.', 'The administrator takes the ready image of the new version, the same for every server.'),
        focus: ['ct-admin'],
        reveal: CT_PLAIN,
        values: { 'ct-a': 'v1', 'ct-rest': `v1 ${restVal}` },
      });
      add({
        world: 'ct',
        id: 'deploy-ct-first',
        label: bi('сервер 1', 'server 1'),
        caption: fmt(
          bi(
            'На сервере 1 администратор останавливает старый контейнер и запускает новый из образа новой версии, вписывая в команду `docker run` те же параметры, что были у старого. Работа сервера стоит около {s} секунд, а у человека уходит около {u} минут.',
            'On server 1 the administrator stops the old container and starts a new one from the new image, typing into `docker run` the same parameters the old one had. The server’s work stands still for about {s} seconds, and the person spends about {u} minutes.',
          ),
          { s: o.dockerSwapS, u: o.dockerUpdateMin },
        ),
        actor: 'ct-admin',
        say: bi('Администратор останавливает на сервере 1 старый контейнер и запускает новый из образа новой версии.', 'The administrator stops the old container on server 1 and starts a new one from the new image.'),
        focus: ['ct-admin', 'e-ct-a'],
        tokens: [{ edge: 'e-ct-a', label: 'docker run app:v2' }],
        states: { 'ct-a': 'ok' },
        values: { 'ct-a': 'v2' },
        down: o.dockerSwapS / 60,
        manual: o.dockerUpdateMin,
      });
      add({
        world: 'ct',
        id: 'deploy-ct-rest',
        label: bi('остальные', 'the rest'),
        caption: fmtb(
          bi(
            'Ту же пару команд администратор повторяет на остальных {r}. Содержимое контейнеров одинаковое, но параметры команды каждый раз набирает человек и на одном из {n} может их перепутать, поэтому риск ошибки средний.',
            'The administrator repeats the same pair of commands on the other {r}. The containers’ contents are identical, but a person types the command’s parameters every time and may mix them up on one of the {n}, so the risk of a mistake is medium.',
          ),
          { r: serversOn(rest), n: servers(n) },
        ),
        actor: 'ct-admin',
        say: fmtb(bi('Администратор повторяет docker run с теми же параметрами на каждом из оставшихся {r}.', 'The administrator repeats docker run with the same parameters on each of the remaining {r}.'), { r: servers(rest) }),
        focus: ['ct-admin', 'e-ct-rest'],
        tokens: [{ edge: 'e-ct-rest', label: `docker run × ${rest}` }],
        states: { 'ct-rest': 'ok' },
        values: { 'ct-rest': `v2 ${restVal}` },
        down: (o.dockerSwapS / 60) * rest,
        manual: o.dockerUpdateMin * rest,
        risk: 2,
      });
      return ph;
    }

    add(orchIntro({}, { 'ct-a': 'v1', 'ct-rest': `v1 ${restVal}` }));
    add({
      world: 'ct',
      id: 'deploy-k8s-edit',
      label: bi('описание', 'description'),
      caption: fmtb(
        bi(
          'Администратор меняет в описании службы одну строку, номер версии образа, и отправляет описание оркестратору. Теперь описание требует, чтобы работало {c} службы из образа новой версии.',
          'The administrator changes one line of the service description, the image version, and sends the description to the orchestrator. Now the description requires {c} of the service from the new image.',
        ),
        { c: { ru: `${n} ${pluralRu(n, ['копия', 'копии', 'копий'])}`, en: `${n} copies` } },
      ),
      actor: 'ct-admin',
      say: bi('Администратор меняет версию образа в описании с v1 на v2.', 'The administrator changes the image version in the description from v1 to v2.'),
      focus: ['ct-admin', 'e-ct-admin'],
      tokens: [{ edge: 'e-ct-admin', label: 'image: app:v2' }],
      manual: o.editMin,
    });
    if (noRoom)
      return [
        ...ph,
        pending(
          'deploy-k8s-pending',
          fmt(
            bi(
              'Оркестратор запускает первые {s} новых копий, но не находит для них свободной памяти, и они ждут со статусом Pending, то есть «ожидает». Старые копии он не трогает, пока новые не готовы, поэтому служба работает на старой версии, а обновление стоит.',
              'The orchestrator starts the first {s} new copies but finds no free memory for them, and they wait as Pending. It leaves the old copies alone until the new ones are ready, so the service keeps working on the old version while the update stands still.',
            ),
            { s: surge },
          ),
          `0/${n} nodes are available: ${n} Insufficient memory.`,
          'wait',
        ),
      ];
    add({
      world: 'ct',
      id: 'deploy-k8s-roll',
      label: bi('волны', 'waves'),
      caption: bi(
        'Контроллер, то есть часть оркестратора, которая сравнивает описание с тем, что работает, обновляет копии волнами. Описание разрешает запустить сверх нормы четверть копий и запрещает останавливать старые заранее.',
        'The controller, the part of the orchestrator that compares the description with what runs, updates the copies in waves. The description allows a quarter extra copies and forbids stopping old ones in advance.',
      ),
      actor: 'ct-cp',
      say: fmt(bi('Контроллер обновляет копии волнами по {s}.', 'The controller updates the copies in waves of {s}.'), { s: surge }),
      focus: ['ct-cp'],
    });
    add({
      world: 'ct',
      id: 'deploy-k8s-ready',
      label: bi('проверка готовности', 'readiness check'),
      caption: fmt(
        bi(
          'В каждой волне контроллер запускает {s} новых копий и ждёт, пока пройдёт проверка готовности, то есть запрос, которым оркестратор убеждается, что копия отвечает. Только потом он останавливает столько же старых.',
          'In each wave the controller starts {s} new copies and waits for the readiness check, a request by which the orchestrator makes sure a copy answers, to pass. Only then does it stop as many old ones.',
        ),
        { s: surge },
      ),
      actor: 'ct-cp',
      say: bi('Контроллер ждёт, пока новые копии ответят на проверку готовности.', 'The controller waits for the new copies to pass the readiness check.'),
      focus: ['ct-cp', 'e-ct-act'],
      tokens: [{ edge: 'e-ct-act', label: `v2 +${surge}` }],
    });
    add({
      world: 'ct',
      id: 'deploy-k8s-waves',
      label: bi('все волны', 'all waves'),
      caption: fmtb(
        bi(
          'Волн нужно {w}, каждая занимает около {ws} секунд, и служба всё это время работает в полную силу.',
          'It takes {w}, about {ws} seconds each, and the service works at full strength all along.',
        ),
        { w: word(w, ['волна', 'волны', 'волн'], ['wave', 'waves']), ws: o.waveS },
      ),
      actor: 'ct-rest',
      say: bi('Серверы по очереди переходят на новую версию без простоя.', 'The servers move to the new version in turn, without downtime.'),
      focus: ['ct-rest', 'ct-a'],
      states: { 'ct-a': 'ok', 'ct-rest': 'ok' },
      values: { 'ct-a': 'v2', 'ct-rest': `v2 ${restVal}` },
    });
    add({
      world: 'ct',
      id: 'deploy-k8s-done',
      label: bi('версии', 'versions'),
      caption: bi(
        'Старые копии остановлены, но их описание оркестратор хранит. Каждая версия службы записана у него как отдельный набор одинаковых копий, поэтому к прежней версии можно вернуться одной командой.',
        'The old copies are stopped, but the orchestrator keeps their description. Each version of the service is recorded as a separate set of identical copies, so one command brings back the previous version.',
      ),
      actor: 'ct-cp',
      say: bi('Оркестратор хранит описание старой версии.', 'The orchestrator keeps the old version’s description.'),
      focus: ['ct-cp'],
    });
    add({
      world: 'ct',
      id: 'deploy-k8s-cost',
      label: bi('итог', 'total'),
      caption: fmt(
        bi(
          'Ручной работы ушло {e} минуты на правку одной строки, сколько бы серверов ни было, и риск ошибки низкий.',
          'Manual work took {e} minutes to edit one line, however many servers there are, and the risk of a mistake is low.',
        ),
        { e: o.editMin },
      ),
      actor: 'ct-admin',
      say: bi('Администратор правил одну строку, а не каждый сервер.', 'The administrator edited one line, not every server.'),
      focus: ['ct-admin'],
      risk: 1,
    });
    return ph;
  }

  if (ev === 'load') {
    add({
      world: 'bm',
      id: 'load-bm-alert',
      label: bi('тревога', 'alert'),
      caption: fmt(
        bi(
          'Ночью рекламная рассылка привела втрое больше пользователей, чем обычно. Серверы не успевают отвечать, часть запросов заканчивается ошибкой, и через {a} минуты мониторинг звонит дежурному.',
          'At night an advertising mail-out brought three times the usual number of users. The servers cannot keep up, some requests fail, and after {a} minutes monitoring calls the on-call person.',
        ),
        { a: o.alertMin },
      ),
      actor: 'bm-admin',
      say: bi('Телефон дежурного звонит, потому что серверы перегружены и отвечают с ошибками.', 'The on-call phone rings, because the servers are overloaded and answer with errors.'),
      focus: ['bm-admin', 'e-bm-a'],
      tokens: [{ edge: 'e-bm-a', label: 'load ×3', reverse: true }],
      states: { 'bm-a': 'warn', 'bm-rest': 'warn' },
      values: { 'bm-rest': restVal },
      down: o.alertMin,
    });
    add(
      wakeStep(
        'bm',
        'bm-admin',
        'load-bm-wake',
        fmtb(
          bi(
            'Через {w} минут администратор подключается и видит, что все {n} загружены полностью. Чтобы выдержать нагрузку, нужно ещё {e}, а свободных серверов в стойке нет.',
            'After {w} minutes the administrator connects and sees all {n} fully loaded. Another {e} are needed to carry the load, and there are no spare servers in the rack.',
          ),
          { w: o.wakeMin, n: servers(n), e: servers(extra) },
        ),
        bi('Администратор видит, что все серверы загружены полностью, а запасных в стойке нет.', 'The administrator sees every server fully loaded and no spares in the rack.'),
      ),
    );
    add({
      world: 'bm',
      id: 'load-bm-order',
      label: bi('заказ', 'order'),
      caption: fmt(
        bi(
          'Ночью администратор может только ограничить число пользователей, а утром он заказывает новые серверы. Поставщик привозит их за {d} дней, и всё это время служба работает с перегрузкой.',
          'At night the administrator can only limit the number of users, and in the morning they order new servers. The supplier delivers them in {d} days, and all that time the service is overloaded.',
        ),
        { d: o.leadDays },
      ),
      actor: 'bm-admin',
      say: fmtb(bi('Администратор заказывает ещё {e}.', 'The administrator orders {e} more.'), { e: servers(extra) }),
      focus: ['bm-admin'],
      down: o.leadDays * 24 * 60,
      manual: o.orderMin,
    });
    add({
      world: 'bm',
      id: 'load-bm-reserve',
      label: bi('запас', 'reserve'),
      caption: bi(
        'Поэтому серверы без виртуализации обычно покупали с запасом, и большая часть их мощности почти всё время простаивала.',
        'That is why bare-metal servers were usually bought with a reserve, and most of their power sat idle most of the time.',
      ),
      actor: 'bm-rest',
      say: bi('Запасные серверы большую часть времени простаивают.', 'Spare servers sit idle most of the time.'),
      focus: ['bm-rest'],
    });
    add({
      world: 'bm',
      id: 'load-bm-install',
      label: bi('установка', 'install'),
      caption: fmtb(
        bi(
          'Когда серверы приезжают, администратор ставит на каждый систему, приложение и настройки, около {i} минут на сервер, то есть {h} на все {e}. Риск ошибки высокий по тем же причинам, что и при восстановлении сгоревшего сервера.',
          'When the servers arrive, the administrator installs the system, the application and the settings on each, about {i} minutes per server, {h} for all {e}. The risk is high for the same reasons as when restoring a burnt server.',
        ),
        { i: o.serverInstallMin, h: word(r2((o.serverInstallMin * extra) / 60), ['час', 'часа', 'часов'], ['hour', 'hours']), e: { ru: String(extra), en: String(extra) } },
      ),
      actor: 'bm-admin',
      say: fmt(bi('Администратор вручную ставит систему на {e} новых серверов.', 'The administrator installs the system on {e} new servers by hand.'), { e: extra }),
      focus: ['bm-admin', 'e-bm-rest'],
      tokens: [{ edge: 'e-bm-rest', label: bi(`установка × ${extra}`, `install × ${extra}`) }],
      states: { 'bm-a': 'ok', 'bm-rest': 'ok' },
      values: { 'bm-rest': `× ${rest + extra}` },
      down: o.serverInstallMin * extra,
      manual: o.serverInstallMin * extra,
      risk: 3,
    });

    add({
      world: 'vm',
      id: 'load-vm-mgr',
      label: bi('перегрузка', 'overload'),
      caption: bi(
        'Во втором мире менеджер виртуализации видит, что хосты загружены, и умеет запускать новые машины. Но решение, сколько машин добавить, обычно принимает человек.',
        'In the second world the virtualisation manager sees that the hosts are loaded and can start new machines. But the decision how many machines to add is usually a person’s.',
      ),
      actor: 'vm-mgr',
      say: bi('Менеджер видит перегрузку, но сам машин не добавляет.', 'The manager sees the overload but does not add machines by itself.'),
      focus: ['vm-mgr'],
      reveal: VM,
      states: { 'vm-a': 'warn', 'vm-rest': 'warn' },
      values: { 'vm-rest': restVal },
    });
    add({
      world: 'vm',
      id: 'load-vm-wake',
      label: bi('дежурный', 'on call'),
      caption: fmt(
        bi(
          'Поэтому тот же звонок мониторинга будит администратора виртуализации, и через {t} минут после начала перегрузки он подключается к менеджеру.',
          'So the same monitoring call wakes the virtualisation administrator, who connects to the manager {t} minutes after the overload began.',
        ),
        { t: o.alertMin + o.wakeMin },
      ),
      actor: 'vm-admin',
      say: bi('Звонок о перегрузке будит администратора виртуализации.', 'The call about the overload wakes the virtualisation administrator.'),
      focus: ['vm-admin'],
      down: o.alertMin + o.wakeMin,
      woken: 1,
    });
    add({
      world: 'vm',
      id: 'load-vm-job',
      label: bi('задание', 'job'),
      caption: fmt(
        bi(
          'На хостах есть свободная память, потому что парк виртуализации обычно держат с запасом. Администратор около {j} минут готовит менеджеру задание на клонирование.',
          'The hosts have free memory, because a virtualisation fleet is usually kept with a reserve. The administrator spends about {j} minutes preparing a cloning job for the manager.',
        ),
        { j: o.cloneJobMin },
      ),
      actor: 'vm-admin',
      say: bi('Администратор готовит менеджеру задание на клонирование.', 'The administrator prepares a cloning job for the manager.'),
      focus: ['vm-admin', 'e-vm-admin'],
      tokens: [{ edge: 'e-vm-admin', label: bi(`клоны × ${extra}`, `clones × ${extra}`) }],
      down: o.cloneJobMin,
      manual: o.cloneJobMin,
    });
    add({
      world: 'vm',
      id: 'load-vm-clone',
      label: bi('клоны', 'clones'),
      caption: fmtb(
        bi(
          'Менеджер делает из шаблона {v} и запускает их на хостах. Клонирование и загрузка гостевых систем идут одновременно и занимают около {c}.',
          'The manager makes {v} from the template and starts them on the hosts. Cloning and booting the guest systems run at once and take about {c}.',
        ),
        { v: vms(extra), c: mins(r2(o.vmCloneMin + (o.vmBootS + o.appStartS) / 60)) },
      ),
      actor: 'vm-mgr',
      say: fmt(bi('Менеджер клонирует из шаблона {e} новых машин.', 'The manager clones {e} new machines from the template.'), { e: extra }),
      focus: ['vm-mgr', 'e-vm-act'],
      tokens: [{ edge: 'e-vm-act', label: bi(`клоны × ${extra}`, `clones × ${extra}`) }],
      values: { 'vm-rest': `× ${rest + extra}` },
      down: o.vmCloneMin + (o.vmBootS + o.appStartS) / 60,
    });
    if (stale) {
      add(driftStep());
      add(driftFix());
    }
    add({
      world: 'vm',
      id: 'load-vm-balancer',
      label: bi('балансировщик', 'balancer'),
      caption: bi(
        'Остаётся рассказать о новых машинах балансировщику, то есть программе, которая раздаёт запросы пользователей между копиями службы. Пока он о них не знает, все запросы идут на старые машины.',
        'What remains is to tell the load balancer, the program that spreads users’ requests over the copies of the service, about the new machines. Until it knows them, all requests go to the old machines.',
      ),
      actor: 'vm-admin',
      say: bi('Администратор открывает настройки балансировщика.', 'The administrator opens the load balancer settings.'),
      focus: ['vm-admin'],
    });
    add({
      world: 'vm',
      id: 'load-vm-addrs',
      label: bi('адреса', 'addresses'),
      caption: fmtb(
        bi(
          'Администратор вписывает адреса {e} машин вручную, около минуты на каждую, и только потом нагрузка распределяется на все. Список адресов человек правит руками, поэтому риск ошибки средний.',
          'The administrator types in the addresses of {e} machines by hand, about a minute each, and only then is the load spread over all of them. A person edits the address list by hand, so the risk of a mistake is medium.',
        ),
        { e: { ru: String(extra), en: String(extra) } },
      ),
      actor: 'vm-admin',
      say: fmt(bi('Администратор вписывает адреса {e} новых машин.', 'The administrator types in the addresses of {e} new machines.'), { e: extra }),
      focus: ['vm-admin', 'e-vm-admin'],
      states: { 'vm-a': 'ok', 'vm-rest': 'ok' },
      down: o.balancerEditMin * extra,
      manual: o.balancerEditMin * extra,
      risk: stale ? 3 : 2,
    });

    if (!orch) {
      add({
        world: 'ct',
        id: 'load-ct-wake',
        label: bi('дежурный', 'on call'),
        caption: fmt(
          bi(
            'В третьем мире без оркестратора звонок тоже будит человека, потому что Docker на каждом сервере знает только свои контейнеры и не решает, сколько копий нужно службе. Через {t} минут после начала перегрузки администратор подключается к серверам.',
            'In the third world without an orchestrator the call also wakes a person, because Docker on each server knows only its own containers and does not decide how many copies the service needs. {t} minutes after the overload began the administrator connects to the servers.',
          ),
          { t: o.alertMin + o.wakeMin },
        ),
        actor: 'ct-admin',
        say: bi('Администратора будит звонок мониторинга о перегрузке, и он подключается к серверам.', 'The monitoring call about the overload wakes the administrator, who connects to the servers.'),
        focus: ['ct-admin'],
        reveal: CT_PLAIN,
        states: { 'ct-a': 'warn', 'ct-rest': 'warn' },
        values: { 'ct-rest': restVal },
        down: o.alertMin + o.wakeMin,
        woken: 1,
      });
      add({
        world: 'ct',
        id: 'load-ct-run',
        label: 'docker run',
        caption: fmtb(
          bi(
            'Администратор запускает {c} командой `docker run` на серверах со свободной памятью и вписывает их адреса в балансировщик, около {k} минут на каждый контейнер. Сам контейнер запускается за секунду, так что время уходит на работу человека, а риск ошибки средний, потому что параметры снова набирают руками.',
            'The administrator starts {c} with `docker run` on servers with free memory and types their addresses into the load balancer, about {k} minutes per container. A container itself starts in a second, so the time goes into the person’s work, and the risk of a mistake is medium, because the parameters are typed by hand again.',
          ),
          { c: containers(extra), k: o.dockerRunMin + o.balancerEditMin },
        ),
        actor: 'ct-admin',
        say: fmt(bi('Администратор запускает {e} новых контейнеров и вписывает их адреса в балансировщик.', 'The administrator starts {e} new containers and types their addresses into the load balancer.'), { e: extra }),
        focus: ['ct-admin', 'e-ct-rest'],
        tokens: [{ edge: 'e-ct-rest', label: `docker run × ${extra}` }],
        states: { 'ct-a': 'ok', 'ct-rest': 'ok' },
        values: { 'ct-rest': `× ${rest + extra}` },
        down: (o.dockerRunMin + o.balancerEditMin) * extra,
        manual: (o.dockerRunMin + o.balancerEditMin) * extra,
        risk: 2,
      });
      return ph;
    }

    const k = hpaPeriods(n);
    add(orchIntro({ 'ct-a': 'warn', 'ct-rest': 'warn' }, { 'ct-rest': restVal }));
    add({
      world: 'ct',
      id: 'load-k8s-hpa',
      label: 'HPA',
      caption: bi(
        'За нагрузкой в Kubernetes следит автомасштабирование (HPA), то есть часть оркестратора, которая сравнивает загрузку процессора копий с целью из описания службы.',
        'In Kubernetes the autoscaler (HPA) watches the load, the part of the orchestrator that compares the copies’ CPU usage with the target in the service description.',
      ),
      actor: 'ct-cp',
      say: bi('Автомасштабирование сравнивает загрузку копий с целью.', 'The autoscaler compares the copies’ load with the target.'),
      focus: ['ct-cp', 'e-ct-hb'],
      tokens: [{ edge: 'e-ct-hb', label: 'CPU 300 %' }],
    });
    add({
      world: 'ct',
      id: 'load-k8s-notice',
      label: bi('замечает', 'notices'),
      caption: fmt(
        bi(
          'Данные о загрузке приходят с задержкой до минуты, а автомасштабирование сверяется с ними каждые {p} секунд, поэтому перегрузку оно замечает примерно через {r} секунд.',
          'Usage data arrive up to a minute late, and the autoscaler compares every {p} seconds, so it notices the overload after about {r} seconds.',
        ),
        { p: o.hpaPeriodS, r: o.hpaReactS },
      ),
      actor: 'ct-cp',
      say: fmt(bi('Автомасштабирование видит тройную нагрузку и решает, что копий нужно {need}.', 'The autoscaler sees triple the load and decides {need} copies are needed.'), { need: 3 * n }),
      focus: ['ct-cp'],
      down: o.hpaReactS / 60,
    });
    if (noRoom)
      return [
        ...ph,
        pending(
          'load-k8s-pending',
          bi(
            'Автомасштабирование создаёт новые копии, но свободной памяти на серверах нет, и копии ждут со статусом Pending, то есть «ожидает». Новые серверы ставит человек, если только кластер не работает в облаке, которое добавляет их само.',
            'The autoscaler creates new copies, but there is no free memory on the servers, and the copies wait as Pending. New servers are added by a person, unless the cluster runs in a cloud that adds them by itself.',
          ),
          `0/${n} nodes are available: ${n} Insufficient cpu.`,
          'page',
        ),
      ];
    add({
      world: 'ct',
      id: 'load-k8s-scale',
      label: bi('рост', 'scale up'),
      caption: fmtb(
        bi(
          'Автомасштабирование увеличивает число копий не больше чем вдвое за {p} секунд, чтобы случайный всплеск не наплодил лишнего. До {need} копий оно доходит за {k}.',
          'The autoscaler at most doubles the copies every {p} seconds, so that a random spike does not create too many. It reaches {need} copies in {k}.',
        ),
        { p: o.hpaPeriodS, need: 3 * n, k: word(k, ['шаг', 'шага', 'шагов'], ['step', 'steps']) },
      ),
      actor: 'ct-cp',
      say: bi('Автомасштабирование добавляет копии шаг за шагом.', 'The autoscaler adds copies step by step.'),
      focus: ['ct-cp'],
    });
    add({
      world: 'ct',
      id: 'load-k8s-place',
      label: bi('размещение', 'placement'),
      caption: fmt(
        bi(
          'Планировщик, то есть часть оркестратора, которая выбирает сервер для каждой копии, раскладывает новые копии по серверам со свободной памятью. Каждая запускается примерно за {s} секунд.',
          'The scheduler, the part of the orchestrator that picks a server for each copy, places the new copies on servers with free memory. Each starts in about {s} seconds.',
        ),
        { s: o.podStartS },
      ),
      actor: 'ct-cp',
      say: bi('Планировщик отправляет новые копии на серверы со свободной памятью.', 'The scheduler sends the new copies to servers with free memory.'),
      focus: ['ct-cp', 'e-ct-act'],
      tokens: [{ edge: 'e-ct-act', label: bi(`+${extra} копий`, `+${extra} copies`) }],
      states: { 'ct-a': 'ok', 'ct-rest': 'ok' },
      values: { 'ct-rest': `× ${rest + extra}` },
      down: (k * o.hpaPeriodS + o.podStartS) / 60,
    });
    add({
      world: 'ct',
      id: 'load-k8s-done',
      label: bi('адрес', 'address'),
      caption: bi(
        'Новые копии сами попадают в постоянный адрес службы. Оркестратор держит этот адрес перед всеми копиями и раздаёт по нему запросы готовым копиям, поэтому список адресов никто не правит.',
        'The new copies join the service’s permanent address by themselves. The orchestrator keeps this address in front of all the copies and spreads requests over the ready ones, so nobody edits an address list.',
      ),
      actor: 'ct-cp',
      say: bi('Постоянный адрес службы начинает раздавать запросы и новым копиям.', 'The service’s permanent address starts sending requests to the new copies too.'),
      focus: ['ct-cp'],
    });
    add({
      world: 'ct',
      id: 'load-k8s-cond',
      label: bi('условие', 'condition'),
      caption: bi(
        'Никого не разбудили, ручной работы не было, и риск ошибки низкий. Условие одно: на серверах должен быть запас свободной памяти, иначе новым копиям негде запуститься.',
        'Nobody was woken, there was no manual work, and the risk of a mistake is low. There is one condition: the servers must have spare memory, otherwise the new copies have nowhere to start.',
      ),
      actor: 'ct-rest',
      say: bi('Серверам нужен запас свободной памяти для новых копий.', 'The servers need spare memory for new copies.'),
      focus: ['ct-rest'],
      risk: 1,
    });
    return ph;
  }

  // rollback
  add({
    world: 'bm',
    id: 'rb-bm-alert',
    label: bi('тревога', 'alert'),
    caption: fmtb(
      bi(
        'Накануне на все {n} поставили новую версию, а ночью выяснилось, что в ней ошибка и часть запросов заканчивается отказом. Мониторинг замечает рост ошибок и через {a} минуты звонит дежурному.',
        'The day before, a new version went onto all {n}, and at night it turned out to have a bug: some requests fail. Monitoring notices the rise in errors and calls the on-call person after {a} minutes.',
      ),
      { n: servers(n), a: o.alertMin },
    ),
    actor: 'bm-admin',
    say: bi('Телефон дежурного звонит, потому что после обновления служба отвечает ошибками.', 'The on-call phone rings, because after the update the service answers with errors.'),
    focus: ['bm-admin', 'e-bm-a'],
    tokens: [{ edge: 'e-bm-a', label: 'HTTP 500', reverse: true }],
    states: { 'bm-a': 'err', 'bm-rest': 'err' },
    values: { 'bm-a': 'v2', 'bm-rest': `v2 ${restVal}` },
    down: o.alertMin,
  });
  add(
    wakeStep(
      'bm',
      'bm-admin',
      'rb-bm-wake',
      fmt(
        bi(
          'Через {w} минут администратор подключается и решает вернуть старую версию. На серверах её уже нет, поэтому её нужно найти в архиве и поставить заново.',
          'After {w} minutes the administrator connects and decides to bring back the old version. It is no longer on the servers, so it has to be found in the archive and installed again.',
        ),
        { w: o.wakeMin },
      ),
      bi('Администратор ищет в архиве старую версию, которую придётся поставить заново.', 'The administrator looks for the old version in the archive, to install it again.'),
    ),
  );
  add({
    world: 'bm',
    id: 'rb-bm-reinstall',
    label: bi('вручную', 'by hand'),
    caption: fmtb(
      bi(
        'Администратор по одному ставит старую версию на все {n}, около {u} минут на сервер, и последний сервер исправлен через {t}. Риск ошибки высокий, потому что человек повторяет одну процедуру {k} подряд, ночью и в спешке.',
        'The administrator reinstalls the old version on all {n}, about {u} minutes each, and the last is fixed after {t}. The risk is high, because a person repeats one procedure {k} in a row, at night, in a hurry.',
      ),
      { n: servers(n), u: o.bmUpdateMin, t: mins(o.bmUpdateMin * n), k: times },
    ),
    actor: 'bm-admin',
    say: bi('Администратор возвращает старую версию на каждый сервер.', 'The administrator puts the old version back on each server.'),
    focus: ['bm-admin', 'e-bm-rest'],
    tokens: [{ edge: 'e-bm-rest', label: `v1 × ${n}` }],
    states: { 'bm-a': 'ok', 'bm-rest': 'ok' },
    values: { 'bm-a': 'v1', 'bm-rest': `v1 ${restVal}` },
    down: o.bmUpdateMin * n,
    manual: o.bmUpdateMin * n,
    risk: 3,
  });

  add({
    world: 'vm',
    id: 'rb-vm-wake',
    label: bi('дежурный', 'on call'),
    caption: fmt(
      bi(
        'Во втором мире тот же звонок будит администратора виртуализации, и через {t} минут он подключается к менеджеру. Перед обновлением он сделал снимок каждой машины, то есть сохранил состояние её диска.',
        'In the second world the same call wakes the virtualisation administrator, who connects to the manager after {t} minutes. Before the update they took a snapshot of every machine, saving the state of its disk.',
      ),
      { t: o.alertMin + o.wakeMin },
    ),
    actor: 'vm-admin',
    say: bi('Администратор находит снимки машин, сделанные перед обновлением.', 'The administrator finds the machine snapshots taken before the update.'),
    focus: ['vm-admin'],
    reveal: VM,
    states: { 'vm-a': 'err', 'vm-rest': 'err' },
    values: { 'vm-a': 'v2', 'vm-rest': `v2 ${restVal}` },
    down: o.alertMin + o.wakeMin,
    woken: 1,
  });
  add({
    world: 'vm',
    id: 'rb-vm-revert',
    label: bi('снимки', 'snapshots'),
    caption: fmt(
      bi(
        'Администратор около {j} минут готовит задание, и менеджер возвращает все машины к снимкам одновременно. Каждая машина перезагружается со старым диском примерно за {r} минуты.',
        'The administrator spends about {j} minutes preparing a job, and the manager reverts all machines to their snapshots at once. Each machine reboots with the old disk in about {r} minutes.',
      ),
      { j: o.revertJobMin, r: o.snapshotRevertMin },
    ),
    actor: 'vm-mgr',
    say: bi('Менеджер возвращает все машины к снимкам и перезагружает их.', 'The manager reverts every machine to its snapshot and reboots it.'),
    focus: ['vm-mgr', 'e-vm-act'],
    tokens: [{ edge: 'e-vm-act', label: bi('возврат к снимку', 'revert to snapshot') }],
    states: { 'vm-a': 'ok', 'vm-rest': 'ok' },
    values: { 'vm-a': 'v1', 'vm-rest': `v1 ${restVal}` },
    down: o.revertJobMin + o.snapshotRevertMin,
    manual: o.revertJobMin,
  });
  add({
    world: 'vm',
    id: 'rb-vm-loss',
    label: bi('потеря', 'loss'),
    caption: bi(
      'Вместе с новой версией пропадает всё, что машины записали на диск после снимка. Поэтому данные службы обычно держат не в самих машинах, а на отдельном сервере базы данных, а риск ошибки здесь средний.',
      'Everything the machines wrote to disk after the snapshot is lost along with the new version. So a service’s data is usually kept not in the machines but on a separate database server, and the risk of a mistake here is medium.',
    ),
    actor: 'vm-rest',
    say: bi('Всё, что машины записали после снимка, пропало.', 'Everything the machines wrote after the snapshot is gone.'),
    focus: ['vm-rest'],
    risk: 2,
  });

  if (!orch) {
    add({
      world: 'ct',
      id: 'rb-ct-wake',
      label: bi('дежурный', 'on call'),
      caption: fmt(
        bi(
          'В третьем мире без оркестратора звонок будит администратора, и через {t} минут он подключается к серверам. Старый образ у него под рукой, потому что образы каждой версии хранятся рядом.',
          'In the third world without an orchestrator the call wakes the administrator, who connects to the servers after {t} minutes. The old image is at hand, because the images of every version are kept side by side.',
        ),
        { t: o.alertMin + o.wakeMin },
      ),
      actor: 'ct-admin',
      say: bi('Администратор берёт образ старой версии, который хранится рядом с новым.', 'The administrator takes the old version’s image, kept next to the new one.'),
      focus: ['ct-admin'],
      reveal: CT_PLAIN,
      states: { 'ct-a': 'err', 'ct-rest': 'err' },
      values: { 'ct-a': 'v2', 'ct-rest': `v2 ${restVal}` },
      down: o.alertMin + o.wakeMin,
      woken: 1,
    });
    add({
      world: 'ct',
      id: 'rb-ct-run',
      label: 'docker run',
      caption: fmtb(
        bi(
          'Администратор на каждом сервере останавливает контейнер новой версии и запускает контейнер из старого образа, около {u} минут на сервер. Устанавливать ничего не нужно, но параметры команды он снова набирает руками {k}, поэтому риск ошибки средний.',
          'On each server the administrator stops the new version’s container and starts one from the old image, about {u} minutes per server. Nothing has to be installed, but they type the command’s parameters by hand {k} again, so the risk of a mistake is medium.',
        ),
        { u: o.dockerUpdateMin, k: times },
      ),
      actor: 'ct-admin',
      say: bi('Администратор на каждом сервере запускает контейнер из старого образа вместо нового.', 'On each server the administrator starts a container from the old image instead of the new one.'),
      focus: ['ct-admin', 'e-ct-rest'],
      tokens: [{ edge: 'e-ct-rest', label: `docker run app:v1 × ${n}` }],
      states: { 'ct-a': 'ok', 'ct-rest': 'ok' },
      values: { 'ct-a': 'v1', 'ct-rest': `v1 ${restVal}` },
      down: o.dockerUpdateMin * n,
      manual: o.dockerUpdateMin * n,
      risk: 2,
    });
    return ph;
  }

  add(orchIntro({ 'ct-a': 'err', 'ct-rest': 'err' }, { 'ct-a': 'v2', 'ct-rest': `v2 ${restVal}` }));
  add({
    world: 'ct',
    id: 'rb-k8s-check',
    label: bi('проверка готовности', 'readiness check'),
    caption: bi(
      'Ошибка в логике программы не мешает копиям отвечать на проверку готовности, то есть на запрос, которым оркестратор убеждается, что копия отвечает. Поэтому оркестратор считает новую версию исправной и сам её не откатит.',
      'A bug in the program’s logic does not stop the copies from passing the readiness check, the request by which the orchestrator makes sure a copy answers. So the orchestrator considers the new version healthy and will not roll it back.',
    ),
    actor: 'ct-cp',
    say: bi('Оркестратор считает новую версию исправной.', 'The orchestrator considers the new version healthy.'),
    focus: ['ct-cp'],
  });
  add({
    world: 'ct',
    id: 'rb-k8s-wake',
    label: bi('дежурный', 'on call'),
    caption: fmt(
      bi(
        'Ошибки замечает мониторинг. Его звонок будит человека, и через {t} минут после начала ошибок тот подключается.',
        'Monitoring notices the errors. Its call wakes a person, who connects {t} minutes after the errors began.',
      ),
      { t: o.alertMin + o.wakeMin },
    ),
    actor: 'ct-admin',
    say: bi('Администратора будит звонок мониторинга.', 'The monitoring call wakes the administrator.'),
    focus: ['ct-admin'],
    down: o.alertMin + o.wakeMin,
    woken: 1,
  });
  add({
    world: 'ct',
    id: 'rb-k8s-undo',
    label: bi('откат', 'undo'),
    caption: bi(
      'Администратор выполняет одну команду отката, и оркестратор возвращает в описание службы предыдущую версию. Её описание оркестратор хранил со времени обновления, поэтому искать её не нужно.',
      'The administrator runs one rollback command, and the orchestrator puts the previous version back into the service description. It has kept that description since the update, so there is nothing to look for.',
    ),
    actor: 'ct-admin',
    say: bi('Администратор одной командой просит вернуть предыдущую версию.', 'With one command the administrator asks for the previous version back.'),
    focus: ['ct-admin', 'e-ct-admin'],
    tokens: [{ edge: 'e-ct-admin', label: 'rollout undo' }],
    down: o.undoMin,
    manual: o.undoMin,
  });
  if (noRoom)
    return [
      ...ph,
      pending(
        'rb-k8s-pending',
        fmt(
          bi(
            'Оркестратор запускает первые {s} копий старой версии, но не находит для них свободной памяти, и они ждут со статусом Pending, то есть «ожидает». Копии новой версии он не останавливает, пока старые не готовы, поэтому служба продолжает отвечать с ошибками.',
            'The orchestrator starts the first {s} copies of the old version but finds no free memory for them, and they wait as Pending. It does not stop the new version’s copies until the old ones are ready, so the service keeps answering with errors.',
          ),
          { s: surge },
        ),
        `0/${n} nodes are available: ${n} Insufficient memory.`,
        'page',
      ),
    ];
  add({
    world: 'ct',
    id: 'rb-k8s-roll',
    label: bi('волны', 'waves'),
    caption: fmtb(
      bi(
        'Оркестратор теми же волнами, что и при обновлении, запускает копии старой версии и останавливает копии новой, и {w} по {ws} секунд возвращают службу к прежней версии.',
        'In the same waves as during the update the orchestrator starts copies of the old version and stops copies of the new one, and {w} of {ws} seconds bring the service back to the old version.',
      ),
      { w: word(w, ['волна', 'волны', 'волн'], ['wave', 'waves']), ws: o.waveS },
    ),
    actor: 'ct-cp',
    say: bi('Оркестратор волнами возвращает копии старой версии.', 'In waves the orchestrator brings back copies of the old version.'),
    focus: ['ct-cp', 'e-ct-act'],
    tokens: [{ edge: 'e-ct-act', label: `v1 +${surge}` }],
    states: { 'ct-a': 'ok', 'ct-rest': 'ok' },
    values: { 'ct-a': 'v1', 'ct-rest': `v1 ${restVal}` },
    down: (w * o.waveS) / 60,
  });
  add({
    world: 'ct',
    id: 'rb-k8s-cost',
    label: bi('итог', 'total'),
    caption: bi(
      'Разбудили одного человека, как и в остальных мирах, но его работа заняла одну минуту, сколько бы серверов ни было, и риск ошибки низкий.',
      'One person was woken, as in the other worlds, but their work took one minute however many servers there are, and the risk of a mistake is low.',
    ),
    actor: 'ct-admin',
    say: bi('Администратор потратил на откат одну команду.', 'The administrator spent one command on the rollback.'),
    focus: ['ct-admin'],
    risk: 1,
  });
  return ph;
}

export type Totals = Record<World, { down: number; manual: number; woken: number; risk: number }>;

/** What each world's counters show after the last phase. */
export function orchTotals(phases: Phase[]): Totals {
  const t = Object.fromEntries(WORLDS.map((w) => [w, { down: 0, manual: 0, woken: 0, risk: 0 }])) as Totals;
  for (const x of phases) {
    const m = t[x.world];
    m.down = r2(m.down + (x.down ?? 0));
    m.manual = r2(m.manual + (x.manual ?? 0));
    m.woken += x.woken ?? 0;
    if (x.risk) m.risk = x.risk;
  }
  return t;
}

export function orchNumbers(p: P, broken: ReadonlySet<string> = new Set()): Totals {
  return orchTotals(orchPlan(p, broken));
}

const COL = { bm: 24, vm: 344, ct: 664 };
const ROW = { person: 96, mgr: 320, srv: 456 };
const PW = 208;
const SW = 136;
const H = 56;
const person = (c: number) => ({ x: c + 32, y: ROW.person, w: PW, h: H });
const mgr = (c: number) => ({ x: c + 32, y: ROW.mgr, w: PW, h: H });
const SH = 64;
const srvA = (c: number) => ({ x: c - 4, y: ROW.srv, w: SW, h: SH });
const srvRest = (c: number) => ({ x: c + 148, y: ROW.srv, w: SW, h: SH });

const METRIC = (w: World, wn: Bi) => [
  { id: `${w}Down`, label: fmtb(bi('простой ({w})', 'downtime ({w})'), { w: wn }), unit: { ru: 'мин', en: 'min' } },
  { id: `${w}DownS`, label: fmtb(bi('простой ({w})', 'downtime ({w})'), { w: wn }), unit: { ru: 'с', en: 's' } },
  { id: `${w}Manual`, label: fmtb(bi('ручная работа ({w})', 'manual work ({w})'), { w: wn }), unit: { ru: 'мин', en: 'min' } },
  { id: `${w}ManualS`, label: fmtb(bi('ручная работа ({w})', 'manual work ({w})'), { w: wn }), unit: { ru: 'с', en: 's' } },
  { id: `${w}Woken`, label: fmtb(bi('разбудили людей ({w})', 'people woken ({w})'), { w: wn }), unit: { ru: 'чел.', en: 'people' } },
  { id: `${w}Risk`, label: fmtb(bi('риск ошибки ({w})', 'risk of a mistake ({w})'), { w: wn }), unit: { ru: 'из 3', en: 'of 3' } },
];

const EVENT_NAME: Record<OrchEvent, Bi> = {
  fire: bi('сгоревший сервер', 'a burnt server'),
  deploy: bi('выкладка новой версии', 'rolling out a new version'),
  load: bi('втрое выросшая нагрузка', 'tripled load'),
  rollback: bi('откат неудачного обновления', 'rolling back a bad update'),
};

export const orchestrationModel = defineModel<P>({
  id: 'containers.orchestration',
  frame: 'visible',
  block: 'containers',
  title: bi('Как работу запускают на многих серверах', 'Running work on many servers'),
  summary: bi(
    'Схема разыгрывает одно и то же событие в трёх мирах: на серверах без виртуализации, на виртуальных машинах под управлением менеджера виртуализации и на контейнерах, которыми управляет либо Docker на каждом сервере, либо оркестратор. На каждом шаге подсвечен тот, кто действует, а облачко рядом с ним говорит, что он делает. Счётчики под схемой складывают минуты простоя службы, минуты ручной работы, число разбуженных людей и риск ошибки по шкале от 1 (низкий) до 3 (высокий). Простоем здесь считаются минуты, когда служба работала не в полную силу: хотя бы одна её копия стояла, отвечала ошибками или копий не хватало.',
    'The diagram plays one event in three worlds: servers without virtualisation, virtual machines under a virtualisation manager, and containers run either by Docker on each server or by an orchestrator. At each step the one who acts is highlighted, and the callout next to it says what it does. The counters under the diagram add up minutes of downtime, minutes of manual work, people woken and the risk of a mistake on a scale of 1 (low) to 3 (high). Downtime here means minutes when the service did not work at full strength: at least one copy stood still, answered with errors, or there were too few copies.',
  ),
  intro: bi(
    'Сейчас на схеме только первый мир, серверы без виртуализации и их дежурный администратор. Выберите в «Параметрах» событие, а дальше переходите от шага к шагу кнопкой «Шаг вперёд». Рядом по очереди появятся мир виртуальных машин и мир контейнеров, и в каждом то же событие пройдёт своим путём.\n\nКогда дойдёте до конца, передвиньте число серверов и сравните, у кого растёт ручная работа, а потом выключите оркестратор и посмотрите, что изменится в третьем мире.',
    'Now the diagram shows only the first world: servers without virtualisation and their on-call administrator. Pick an event in “Parameters” and then go from step to step with “Step forward”. The world of virtual machines and the world of containers appear next to it in turn, and in each the same event takes its own path.\n\nWhen you reach the end, move the number of servers and compare whose manual work grows, then switch the orchestrator off and see what changes in the third world.',
  ),
  legend: [
    { mark: 'active', text: bi('тот, кто действует на этом шаге', 'the one acting at this step') },
    { mark: 'say', text: bi('что он делает и почему', 'what it does and why') },
    { mark: 'token', text: bi('что он передаёт дальше, например тревогу, команду, описание или новые копии', 'what it hands on, such as an alert, a command, a description or new copies') },
    { mark: 'icon:user', text: bi('человек, администратор', 'a person, an administrator') },
    { mark: 'icon:cloud', text: bi('менеджер виртуализации, который управляет гипервизорами всех хостов', 'the virtualisation manager that controls the hypervisors of all hosts') },
    { mark: 'icon:process', text: bi('оркестратор, программа, которая сама запускает и переносит контейнеры', 'the orchestrator, a program that starts and moves containers by itself') },
    { mark: 'icon:server', text: bi('физический сервер или группа серверов', 'a physical server or a group of servers') },
    { mark: 'ok', text: bi('работа выполняется', 'the work is running') },
    { mark: 'warn', text: bi('работа идёт с перегрузкой или машины расходятся с образцом', 'the work runs overloaded or the machines differ from their model') },
    { mark: 'err', text: bi('работа стоит или отвечает ошибками', 'the work stands still or answers with errors') },
    { mark: 'wait', text: bi('копии ждут свободного места', 'copies wait for room') },
  ],
  stopLabel: bi('Работа остановилась', 'Work stopped'),
  concepts: ['docker.vm', 'docker.container'],
  diagram: {
    width: 960,
    height: 536,
    topPadding: 88,
    nodes: [
      {
        id: 'bm-admin',
        label: bi('Дежурный администратор', 'On-call administrator'),
        icon: 'user',
        work: 'dots',
        sub: bi('серверы без виртуализации', 'bare metal'),
        family: 'user',
        ...person(COL.bm),
        card: {
          what: fmt(
            bi(
              'Администратор, который ночью отвечает за серверы и делает всю работу руками. Счётчики первого мира считаются так: мониторинг звонит через {a} минуты после сбоя (проверка раз в минуту, тревога после трёх неудач подряд); от звонка до первой команды проходит {w} минут; восстановление сервера вручную занимает {r} минут; обновление одного сервера занимает {u} минут, из которых работа стоит {s}; новые серверы поставщик привозит за {d} дней, а установка каждого занимает {i} минут. Риск ошибки высокий, когда человек повторяет ручную процедуру ночью.',
              'An administrator who looks after the servers at night and does all the work by hand. The first world’s counters are computed so: monitoring calls {a} minutes after a failure (a check every minute, an alert after three failures in a row); {w} minutes pass from the call to the first command; restoring a server by hand takes {r} minutes; updating one server takes {u} minutes, {s} of them with the work stopped; new servers arrive in {d} days, and installing each takes {i} minutes. The risk is high when a person repeats a manual procedure at night.',
            ),
            { a: ORCH.alertMin, w: ORCH.wakeMin, r: ORCH.bmRestoreMin, u: ORCH.bmUpdateMin, s: ORCH.bmStopMin, d: ORCH.leadDays, i: ORCH.serverInstallMin },
          ),
          who: bi('Дежурства распределяют между администраторами по графику. Время реакции дежурного от 5 до 30 минут руководство Google по эксплуатации называет обычным.', 'On-call shifts are scheduled among the administrators. The Google SRE book names 5 to 30 minutes as a usual on-call response time.'),
          doc: { url: 'https://sre.google/sre-book/being-on-call/', label: 'Google SRE book: Being On-Call' },
        },
      },
      {
        id: 'bm-a',
        label: bi('Сервер 1', 'Server 1'),
        icon: 'server',
        family: 'node',
        shape: 'rack',
        ...srvA(COL.bm),
        card: {
          what: bi('Физический сервер, на котором работает одна из копий службы. Серверы иногда выходят из строя: по исследованию Microsoft (Vishwanath и Nagappan, 2010) примерно у 8 % серверов за год случается хотя бы одна аппаратная неисправность.', 'A physical server running one of the service’s copies. Servers do fail: in a Microsoft study (Vishwanath and Nagappan, 2010) about 8 % of servers had at least one hardware incident a year.'),
          who: bi('Сервер стоит в стойке дата-центра, а систему и приложение на него ставит администратор.', 'It sits in a data-centre rack; the administrator installs the system and the application.'),
          see: 'uptime; journalctl -b -1',
          doc: { url: 'https://dl.acm.org/doi/10.1145/1807128.1807161', label: 'Characterizing cloud computing hardware reliability' },
        },
      },
      {
        id: 'bm-rest',
        label: bi('Серверы 2–N', 'Servers 2–N'),
        icon: 'server',
        family: 'node',
        shape: 'rack',
        ...srvRest(COL.bm),
        card: {
          what: bi('Остальные серверы, на каждом по одной копии службы, и резервный сервер, на котором пока ничего не установлено. Число серверов задаёт ручка в «Параметрах».', 'The other servers, one copy of the service on each, and a spare server with nothing installed yet. The number of servers is set in “Parameters”.'),
          who: bi('Систему и приложение на каждый сервер ставит администратор.', 'The administrator installs the system and the application on each.'),
        },
      },
      {
        id: 'vm-admin',
        label: bi('Администратор ВМ', 'VM administrator'),
        icon: 'user',
        work: 'dots',
        sub: bi('виртуальные машины', 'virtual machines'),
        family: 'user',
        ...person(COL.vm),
        card: {
          what: fmt(
            bi(
              'Администратор виртуализации работает не с серверами, а с менеджером, который управляет всеми хостами. Модель второго мира такая: шаблон машины собирают за {t} минут; переключение работы на новую машину занимает {s} минуты работы человека и минуту простоя; клонирование с загрузкой гостевой системы занимает около {c} минут; адрес в балансировщик вписывают за {b} минуту; возврат к снимку с перезагрузкой занимает {r} минуты.',
              'The virtualisation administrator works not with the servers but with the manager that controls all hosts. The second world’s model: a machine template is built in {t} minutes; switching the work to a new machine takes {s} minutes of a person’s time and a minute of downtime; cloning with a guest boot takes about {c} minutes; an address goes into the load balancer in {b} minute; reverting to a snapshot with a reboot takes {r} minutes.',
            ),
            { t: ORCH.templateMin, s: ORCH.vmSwitchMin, c: ORCH.vmCloneMin, b: ORCH.balancerEditMin, r: ORCH.snapshotRevertMin },
          ),
          who: bi('Обычно это отдельная команда, которая отвечает за парк виртуализации.', 'Usually a separate team responsible for the virtualisation fleet.'),
        },
      },
      {
        id: 'vm-mgr',
        label: bi('Менеджер виртуализации', 'Virtualisation manager'),
        icon: 'cloud',
        sub: 'vCenter · OpenStack',
        family: 'cp',
        shape: 'hex',
        ...mgr(COL.vm),
        card: {
          what: fmt(
            bi(
              'Программа, которая управляет гипервизорами всех хостов. Она знает, какая машина на каком хосте работает, делает машины из шаблонов, переносит работающую машину на другой хост без остановки (это называется живой миграцией, и так освобождают хост для планового ремонта) и перезапускает машины сгоревшего хоста на других (высокая доступность, HA). VMware vSphere HA признаёт хост вышедшим из строя примерно через {d} секунд без сигнала, после чего машины запускаются заново: {p} секунд на размещение, {b} секунд на загрузку гостевой системы и {a} секунд на запуск приложения.',
              'A program that controls the hypervisors of all hosts. It knows which machine runs on which host, makes machines from templates, moves a running machine to another host without stopping it (live migration, which frees a host for planned repair) and restarts a burnt host’s machines elsewhere (high availability, HA). VMware vSphere HA declares a host failed after about {d} seconds without heartbeats, then the machines boot again: {p} seconds to place, {b} seconds to boot the guest system and {a} seconds to start the application.',
            ),
            { d: ORCH.haDetectS, p: ORCH.haPlaceS, b: ORCH.vmBootS, a: ORCH.appStartS },
          ),
          who: bi('Менеджер ставят на отдельную машину, а хосты подключают к нему вместе с общим хранилищем дисков.', 'The manager runs on a machine of its own; the hosts are attached to it together with the shared disk storage.'),
          doc: { url: 'https://docs.openstack.org/masakari/latest/', label: 'OpenStack Masakari' },
        },
      },
      {
        id: 'vm-a',
        label: bi('Хост 1', 'Host 1'),
        icon: 'server',
        family: 'node',
        shape: 'rack',
        ...srvA(COL.vm),
        card: {
          what: bi('Сервер с гипервизором, на котором работают виртуальные машины с копиями службы. Диски машин лежат в общем хранилище, поэтому машину можно запустить на любом хосте.', 'A server with a hypervisor running virtual machines with copies of the service. The machines’ disks are in shared storage, so a machine can start on any host.'),
          who: bi('Хост подключают к менеджеру виртуализации.', 'The host is attached to the virtualisation manager.'),
        },
      },
      {
        id: 'vm-rest',
        label: bi('Хосты 2–N', 'Hosts 2–N'),
        icon: 'server',
        family: 'node',
        shape: 'rack',
        ...srvRest(COL.vm),
        card: {
          what: bi('Остальные хосты с виртуальными машинами. На них менеджер держит запас свободной памяти, чтобы было куда перезапустить машины сгоревшего хоста.', 'The other hosts with virtual machines. The manager keeps spare memory on them so there is room to restart a burnt host’s machines.'),
          who: bi('Хосты подключают к менеджеру виртуализации.', 'The hosts are attached to the virtualisation manager.'),
        },
      },
      {
        id: 'ct-admin',
        label: bi('Администратор', 'Administrator'),
        icon: 'user',
        work: 'dots',
        sub: bi('контейнеры', 'containers'),
        family: 'user',
        ...person(COL.ct),
        card: {
          what: fmt(
            bi(
              'Администратор серверов с контейнерами. Без оркестратора он запускает контейнеры командой `docker run` на каждом сервере сам: восстановление контейнера сгоревшего сервера занимает около {r} минут, обновление контейнера на одном сервере {u} минуты, а сам контейнер при этом стоит {s} секунд. С оркестратором его работа сводится к правке описания, около {e} минут, и к команде отката, около {k} минуты.',
              'The administrator of the container servers. Without an orchestrator they start containers with `docker run` on each server themselves: restoring a burnt server’s container takes about {r} minutes, updating a container on one server {u} minutes, with the container itself stopped for {s} seconds. With an orchestrator their work comes down to editing the description, about {e} minutes, and a rollback command, about {k} minute.',
            ),
            { r: ORCH.dockerRestoreMin, u: ORCH.dockerUpdateMin, s: ORCH.dockerSwapS, e: ORCH.editMin, k: ORCH.undoMin },
          ),
          who: bi('Дежурства распределяют так же, как в первом мире.', 'On-call shifts are scheduled as in the first world.'),
          see: 'docker ps',
        },
      },
      {
        id: 'ct-cp',
        label: bi('Оркестратор', 'Orchestrator'),
        icon: 'process',
        work: 'spin',
        sub: 'Kubernetes',
        family: 'cp',
        shape: 'hex',
        ...mgr(COL.ct),
        card: {
          what: fmt(
            bi(
              'Оркестратором называют программу, которая получает описание того, что должно работать, и сама добивается, чтобы так и было. В Kubernetes это делают несколько частей: планировщик выбирает сервер для каждой новой копии, контроллеры сравнивают описание с тем, что работает, и исправляют разницу, а каждую версию службы оркестратор хранит как отдельный набор одинаковых копий. Счётчики третьего мира взяты из настроек Kubernetes по умолчанию: сервер помечается неготовым через {g} секунд без сообщений, копии убираются с него ещё через {t} секунд, копия запускается около {p} секунд, обновление идёт волнами по четверти копий примерно по {w} секунд, а автомасштабирование замечает перегрузку примерно за {h} секунд и не больше чем удваивает число копий за {q} секунд.',
              'An orchestrator is a program that receives a description of what must run and makes it so by itself. In Kubernetes several parts do this: the scheduler picks a server for each new copy, controllers compare the description with what runs and fix the difference, and the orchestrator keeps each version of the service as a separate set of identical copies. The third world’s counters come from Kubernetes defaults: a server is marked not ready after {g} seconds of silence, copies are taken off it {t} seconds later, a copy starts in about {p} seconds, an update goes in waves of a quarter of the copies of about {w} seconds each, and the autoscaler notices overload in about {h} seconds and at most doubles the copies every {q} seconds.',
            ),
            { g: ORCH.nodeGraceS, t: ORCH.tolerationS, p: ORCH.podStartS, w: ORCH.waveS, h: ORCH.hpaReactS, q: ORCH.hpaPeriodS },
          ),
          who: bi('Оркестратор ставят на отдельные серверы, и к нему подключают все серверы с контейнерами. Подробно его устройство разбирает блок Kubernetes.', 'The orchestrator runs on servers of its own, and all container servers are attached to it. The Kubernetes block takes it apart in detail.'),
          doc: { url: 'https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/#taint-based-evictions', label: 'kubernetes.io: taint-based evictions' },
        },
      },
      {
        id: 'ct-a',
        label: bi('Сервер 1', 'Server 1'),
        icon: 'server',
        family: 'node',
        shape: 'rack',
        sub: 'Docker',
        ...srvA(COL.ct),
        card: {
          what: bi('Сервер с Docker, на котором работает контейнер с одной из копий службы. Docker перезапускает упавший контейнер на этом же сервере, но о других серверах ничего не знает.', 'A server with Docker running a container with one of the service’s copies. Docker restarts a crashed container on this same server but knows nothing about other servers.'),
          who: bi('Docker ставит администратор, а контейнеры запускает либо он сам, либо оркестратор.', 'The administrator installs Docker; containers are started either by them or by the orchestrator.'),
          see: 'docker ps',
        },
      },
      {
        id: 'ct-rest',
        label: bi('Серверы 2–N', 'Servers 2–N'),
        icon: 'server',
        family: 'node',
        shape: 'rack',
        sub: 'Docker',
        ...srvRest(COL.ct),
        card: {
          what: bi('Остальные серверы с контейнерами, на каждом по копии службы. Чтобы оркестратору было куда перенести копии, на них должна оставаться свободная память.', 'The other container servers, a copy of the service on each. They need spare memory so the orchestrator has somewhere to move copies.'),
          who: bi('Серверы подключают к оркестратору или управляют ими вручную.', 'They are attached to the orchestrator or managed by hand.'),
        },
      },
    ],
    edges: [
      { id: 'e-bm-a', from: 'bm-admin', to: 'bm-a', undirected: true, label: bi('тревога и ssh', 'alerts and ssh'), card: { what: bi('По этой линии мониторинг звонит дежурному, когда сервер не отвечает, а администратор подключается к серверу по ssh и выполняет команды.', 'Along this line monitoring calls the on-call person when the server does not answer, and the administrator connects over ssh and runs commands.'), who: bi('Тревогу отправляет мониторинг, команды набирает администратор.', 'Monitoring sends the alert; the administrator types the commands.') } },
      { id: 'e-bm-rest', from: 'bm-admin', to: 'bm-rest', label: bi('ssh и команды', 'ssh and commands'), card: { what: bi('Администратор подключается к каждому серверу по очереди и повторяет на нём те же команды.', 'The administrator connects to each server in turn and repeats the same commands there.'), who: bi('Команды набирает администратор.', 'The administrator types them.') } },
      { id: 'e-vm-admin', from: 'vm-admin', to: 'vm-mgr', undirected: true, via: [[COL.vm + 12, ROW.person + H / 2], [COL.vm + 12, ROW.mgr + H / 2]], labelAt: 0.3, label: bi('задания и письма', 'jobs and e-mails'), card: { what: bi('Администратор даёт менеджеру задания, например собрать шаблон, сделать клоны или вернуть машины к снимкам. Менеджер в ответ присылает уведомления.', 'The administrator gives the manager jobs, such as building a template, making clones or reverting machines to snapshots. The manager sends notifications back.'), who: bi('Задания даёт администратор через консоль или программный интерфейс менеджера.', 'The administrator, through the manager’s console or API.') } },
      { id: 'e-vm-hb', from: 'vm-a', to: 'vm-mgr', label: bi('сигнал жизни', 'heartbeat'), card: { what: bi('Каждый хост раз в секунду сообщает менеджеру, что он в порядке. Если сообщения пропадают, менеджер признаёт хост вышедшим из строя.', 'Every host tells the manager each second that it is fine. If the messages stop, the manager declares the host failed.'), who: bi('Сообщения отправляет агент менеджера на каждом хосте.', 'The manager’s agent on each host.') } },
      { id: 'e-vm-act', from: 'vm-mgr', to: 'vm-rest', label: bi('запуск и клоны', 'starts and clones'), card: { what: bi('Менеджер запускает, клонирует, переносит и возвращает к снимкам машины на остальных хостах.', 'The manager starts, clones, moves and reverts machines on the other hosts.'), who: bi('Команды отдаёт менеджер гипервизорам хостов.', 'The manager, to the hosts’ hypervisors.') } },
      { id: 'e-ct-a', from: 'ct-admin', to: 'ct-a', undirected: true, label: bi('тревога и ssh', 'alerts and ssh'), card: { what: bi('Без оркестратора тревога о сбое приходит человеку, а он подключается к серверу и запускает контейнеры сам.', 'Without an orchestrator the failure alert goes to a person, who connects to the server and starts the containers.'), who: bi('Тревогу отправляет мониторинг, команды набирает администратор.', 'Monitoring sends the alert; the administrator types the commands.') } },
      { id: 'e-ct-rest', from: 'ct-admin', to: 'ct-rest', label: 'ssh · docker run', card: { what: bi('Администратор подключается к каждому серверу и запускает контейнеры командой `docker run` с нужными параметрами.', 'The administrator connects to each server and starts containers with `docker run` and the right parameters.'), who: bi('Команды набирает администратор.', 'The administrator types them.'), see: 'docker run --help' } },
      { id: 'e-ct-admin', from: 'ct-admin', to: 'ct-cp', via: [[COL.ct + 12, ROW.person + H / 2], [COL.ct + 12, ROW.mgr + H / 2]], labelAt: 0.3, label: bi('описание службы', 'service description'), card: { what: bi('Администратор отправляет оркестратору описание: какой образ запускать, сколько копий держать и как их обновлять. Команды для каждого сервера он не пишет.', 'The administrator sends the orchestrator a description: which image to run, how many copies to keep and how to update them. They write no commands for individual servers.'), who: bi('Описание пишет администратор или разработчик.', 'An administrator or a developer writes it.') } },
      { id: 'e-ct-hb', from: 'ct-a', to: 'ct-cp', label: bi('сигнал жизни', 'heartbeat'), card: { what: bi('Каждый сервер раз в несколько секунд сообщает оркестратору, что он в порядке и сколько у него свободной памяти и процессора.', 'Every few seconds each server tells the orchestrator that it is fine and how much free memory and CPU it has.'), who: bi('Сообщения отправляет агент оркестратора на каждом сервере.', 'The orchestrator’s agent on each server.') } },
      { id: 'e-ct-act', from: 'ct-cp', to: 'ct-rest', label: bi('запуск копий', 'starting copies'), card: { what: bi('Оркестратор поручает серверам запустить или остановить копии службы, а серверы выполняют это через Docker или другой рантайм контейнеров.', 'The orchestrator tells the servers to start or stop copies of the service, and the servers do it through Docker or another container runtime.'), who: bi('Поручения отдаёт оркестратор.', 'The orchestrator.') } },
    ],
  },
  params: [
    {
      id: 'event',
      label: bi('Что случилось или что нужно сделать', 'What happened or what has to be done'),
      kind: 'choice',
      default: 'fire',
      options: [
        { id: 'fire', label: bi('Сервер сгорел', 'A server burnt out') },
        { id: 'deploy', label: bi('Выкатить новую версию на все серверы', 'Roll out a new version to all servers') },
        { id: 'load', label: bi('Нагрузка выросла втрое', 'The load tripled') },
        { id: 'rollback', label: bi('Откатить неудачное обновление', 'Roll back a bad update') },
      ],
      near: 'bm-admin',
      group: bi('Событие', 'The event'),
    },
    {
      id: 'servers',
      label: bi('Сколько серверов у компании (в каждом мире одинаково)', 'Number of servers (the same in every world)'),
      kind: 'range',
      min: 3,
      max: 40,
      step: 1,
      default: 10,
      near: 'bm-rest',
      group: bi('Событие', 'The event'),
      predict: {
        prompt: bi('Число серверов меняется, а событие в «Параметрах» остаётся прежним. Как изменятся минуты ручной работы в первом мире, на серверах без виртуализации?', 'The number of servers changes while the event in “Parameters” stays the same. How will the minutes of manual work change in the first world, on bare metal?'),
        options: [
          { id: 'scale', text: bi('Изменятся вместе с числом серверов', 'They change with the number of servers') },
          { id: 'same', text: bi('Останутся прежними', 'They stay the same') },
        ],
        resolve: (prev, next) => ((prev[prev.length - 1]?.metrics?.bmManual ?? 0) === (next[next.length - 1]?.metrics?.bmManual ?? 0) ? 'same' : 'scale'),
      },
    },
    {
      id: 'staleTemplate',
      label: bi('Шаблон ВМ не обновляли полгода, а исправления ставили на работающие машины вручную', 'The VM template has not been updated for six months; fixes went onto running machines by hand'),
      kind: 'toggle',
      default: false,
      near: 'vm-mgr',
      group: bi('Второй мир, виртуальные машины', 'Second world, virtual machines'),
      predict: {
        prompt: bi('Шаблон не обновляли полгода, а все исправления за это время ставили вручную на работающие машины. Менеджер делает из шаблона новую машину. Чем она будет отличаться от работающих?', 'The template has not been updated for six months, and all fixes in that time went onto the running machines by hand. The manager makes a new machine from the template. How will it differ from the running ones?'),
        options: [
          { id: 'missing', text: bi('В ней не будет исправлений, сделанных за полгода', 'It will lack the fixes of the last six months') },
          { id: 'same', text: bi('Ничем, потому что клон повторяет работающую машину', 'In nothing, because a clone repeats a running machine') },
        ],
        resolve: () => 'missing',
      },
    },
    {
      id: 'orchestrator',
      label: bi('Контейнерами управляет оркестратор (Kubernetes)', 'An orchestrator (Kubernetes) manages the containers'),
      kind: 'toggle',
      default: true,
      near: 'ct-cp',
      group: bi('Третий мир, контейнеры', 'Third world, containers'),
      predict: {
        prompt: bi('Оркестратор выключен, и контейнеры на каждом сервере запускает только Docker этого сервера. Сервер 1 сгорел. Запустит ли кто-нибудь его контейнеры на другом сервере без участия человека?', 'The orchestrator is off, and on each server only that server’s Docker starts containers. Server 1 burns out. Will anyone start its containers on another server without a person?'),
        options: [
          { id: 'no', text: bi('Нет, Docker знает только контейнеры своего сервера', 'No, Docker knows only its own server’s containers') },
          { id: 'yes', text: bi('Да, Docker перезапустит их по правилу перезапуска', 'Yes, Docker restarts them by its restart policy') },
        ],
        resolve: () => 'no',
      },
    },
  ],
  breaks: [
    {
      id: 'no-room',
      label: bi('На серверах с контейнерами не осталось свободной памяти для новых копий', 'The container servers have no free memory left for new copies'),
      remove: ['e-ct-act'],
      boundary: 'process',
      predict: {
        prompt: bi('Оркестратору нужно запустить новые копии службы, а свободной памяти ни на одном сервере не осталось. Что будет с этими копиями?', 'The orchestrator has to start new copies of the service, but no server has free memory left. What happens to those copies?'),
        options: [
          { id: 'pending', text: bi('Они будут ждать в очереди, пока где-нибудь не освободится место', 'They wait in a queue until room frees up somewhere') },
          { id: 'squeeze', text: bi('Оркестратор остановит часть работающих копий и запустит новые на их месте', 'The orchestrator stops some running copies and starts the new ones in their place') },
        ],
        resolve: () => 'pending',
      },
    },
    {
      id: 'vm-local-disk',
      label: bi('Диски ВМ лежат на собственном диске хоста, а не в общем хранилище', 'The VM disks are on the host’s own disk, not in shared storage'),
      remove: ['e-vm-act'],
      boundary: 'storage',
      predict: {
        prompt: bi('Диски виртуальных машин хоста 1 лежат на его собственном диске, и хост сгорел. Запустит ли менеджер эти машины на другом хосте?', 'The disks of host 1’s virtual machines are on its own disk, and the host burns out. Will the manager start these machines on another host?'),
        options: [
          { id: 'no', text: bi('Нет, запускать их не с чего, и восстанавливать машины будет человек', 'No, there is nothing to start them from, and a person will restore them') },
          { id: 'yes', text: bi('Да, менеджер перезапустит их, как обычно', 'Yes, the manager restarts them as usual') },
        ],
        resolve: () => 'no',
      },
    },
  ],
  metrics: [...METRIC('bm', bi('без ВМ', 'bare metal')), ...METRIC('vm', bi('ВМ', 'VMs')), ...METRIC('ct', bi('контейнеры', 'containers'))],
  run(p, broken): Step[] {
    const phases = orchPlan(p, broken);
    // The risk belongs to the way of working, so it is shown from the first step of a world.
    const totals = orchTotals(phases);
    const acc = Object.fromEntries(WORLDS.map((w) => [w, { down: 0, manual: 0, woken: 0, risk: 0 }])) as Totals;
    const started = new Set<World>();
    return phases.map((x, i) => {
      started.add(x.world);
      const m = acc[x.world];
      m.down = r2(m.down + (x.down ?? 0));
      m.manual = r2(m.manual + (x.manual ?? 0));
      m.woken += x.woken ?? 0;
      m.risk = totals[x.world].risk;
      const metrics: Record<string, number> = {};
      for (const w of started) {
        putTime(metrics, `${w}Down`, acc[w].down);
        putTime(metrics, `${w}Manual`, acc[w].manual);
        metrics[`${w}Woken`] = acc[w].woken;
        metrics[`${w}Risk`] = acc[w].risk;
      }
      const reveal = x.reveal;
      const step: Step = {
        id: x.id,
        label: x.label,
        caption: x.caption,
        focus: x.focus ?? [x.actor],
        say: { [x.actor]: x.say },
        metrics,
      };
      if (i === 0) step.states = { ...startWith(ALL, ...BM), ...(x.states ?? {}) };
      else if (x.states) step.states = x.states;
      if (i === 0) step.values = { 'bm-rest': `× ${p.servers - 1}`, ...(x.values ?? {}) };
      else if (x.values) step.values = x.values;
      if (reveal) step.reveal = reveal;
      if (x.tokens) step.tokens = x.tokens;
      if (x.broken) step.broken = x.broken;
      return step;
    });
  },
  explainDelta(_prev, _next, change, a, b): Bi {
    const ta = orchNumbers(a);
    const tb = orchNumbers(b);
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломку убрали, и событие снова проходит обычным путём.', 'The failure is removed, and the event takes its usual path again.');
      if (change.id === 'no-room')
        return b.orchestrator
          ? bi('Оркестратор раскладывает копии только по серверам со свободной памятью, а когда её нет, новые копии ждут со статусом Pending, пока человек не освободит место.', 'The orchestrator places copies only on servers with free memory; when there is none, new copies wait as Pending until a person makes room.')
          : bi('Без оркестратора новые копии запускает человек, поэтому эта поломка касается только мира с оркестратором. Включите его в «Параметрах», чтобы увидеть её.', 'Without an orchestrator a person starts new copies, so this failure concerns only the orchestrated world. Switch the orchestrator on in “Parameters” to see it.');
      return b.event === 'fire'
        ? bi('Без общего хранилища менеджеру не с чего запустить машины сгоревшего хоста на другом, и восстанавливать их из резервной копии приходится человеку.', 'Without shared storage the manager has nothing to start the burnt host’s machines from elsewhere, and a person has to restore them from a backup.')
        : bi('Где лежат диски машин, важно, только когда хост сгорел. Выберите событие «Сервер сгорел», чтобы увидеть эту поломку.', 'Where the machines’ disks lie matters only when a host burns out. Pick “A server burnt out” to see this failure.');
    }
    switch (change.id) {
      case 'event':
        return fmtb(bi('Теперь на схеме {e}. Ручная работа в этом событии занимает {bm} мин без виртуализации, {vm} мин с виртуальными машинами и {ct} мин в мире контейнеров.', 'Now the diagram shows {e}. Manual work in this event takes {bm} min on bare metal, {vm} min with VMs and {ct} min in the container world.'), {
          e: EVENT_NAME[b.event as OrchEvent],
          bm: tb.bm.manual,
          vm: tb.vm.manual,
          ct: tb.ct.manual,
        });
      case 'servers':
        return fmtb(
          bi(
            'Серверов стало {b} вместо {a}. Ручная работа без виртуализации изменилась с {bm0} до {bm1} мин, с виртуальными машинами с {vm0} до {vm1} мин, а в мире контейнеров с {ct0} до {ct1} мин.',
            '{a} → {b} servers. Manual work on bare metal went from {bm0} to {bm1} min, with VMs from {vm0} to {vm1} min, and in the container world from {ct0} to {ct1} min.',
          ),
          { a: a.servers, b: b.servers, bm0: ta.bm.manual, bm1: tb.bm.manual, vm0: ta.vm.manual, vm1: tb.vm.manual, ct0: ta.ct.manual, ct1: tb.ct.manual },
        );
      case 'orchestrator':
        return b.orchestrator
          ? fmt(bi('Оркестратор включён, и в третьем мире работу делает он: ручной работы {m} мин, разбудили {w} чел.', 'The orchestrator is on and does the work in the third world: {m} min of manual work, {w} people woken.'), { m: tb.ct.manual, w: tb.ct.woken })
          : fmt(bi('Оркестратор выключен, и в третьем мире всё делает человек: ручной работы {m} мин, разбудили {w} чел.', 'The orchestrator is off and a person does everything in the third world: {m} min of manual work, {w} people woken.'), { m: tb.ct.manual, w: tb.ct.woken });
      case 'staleTemplate':
        if (b.event === 'fire' || b.event === 'rollback')
          return bi('Перезапуск после сбоя и возврат к снимку берут диск самой машины, а не шаблон, поэтому старый шаблон в этом событии ничего не меняет. Выберите выкладку или рост нагрузки.', 'A restart after a failure and a snapshot revert use the machine’s own disk, not the template, so an old template changes nothing here. Pick the rollout or the load event.');
        return b.staleTemplate
          ? fmt(bi('Новые машины сделаны со старого шаблона, и в них нет исправлений последних полугода. Ручная работа во втором мире выросла с {a} до {b} мин.', 'The new machines come from the old template and lack six months of fixes. Manual work in the second world grew from {a} to {b} min.'), { a: ta.vm.manual, b: tb.vm.manual })
          : bi('Шаблон обновлён, и новые машины снова совпадают с работающими.', 'The template is up to date, and new machines match the running ones again.');
    }
    return bi('Схема пересчитана для новых параметров.', 'The model is recomputed.');
  },
});
