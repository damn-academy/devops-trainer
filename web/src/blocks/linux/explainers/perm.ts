// X5 «How the system decides whether you may» (02 §6.6 X5, layer 1, M5):
// three triads of bits, who asks, what they want to do, and the check that
// walks the path directory by directory and then picks exactly one triad.
// The words "kernel" and "process" are not used: this explainer comes before
// the lesson that introduces them.
//
// Reading order: the picture is built from zero. At the start there are only
// the person and the file; the directories appear when the check walks through
// them, the three triads appear one question at a time, and the answer appears
// last and travels back to the person as a card. Every acting block says in a
// callout what it is doing. The knobs come in the order the lesson introduces
// them: who and what, then the three triads.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import { fmtb } from './util';
import type { ElementState, Step } from '../../../core/types';

type P = { u: string; g: string; o: string; who: string; action: string };

export const TRIADS = ['rwx', 'rw-', 'r-x', 'r--', '-wx', '-w-', '--x', '---'];
const triadOpts = TRIADS.map((t) => ({ id: t, label: bi(t, t) }));

/** 'rwx' → 7 */
export const triadNum = (t: string) => (t[0] === 'r' ? 4 : 0) + (t[1] === 'w' ? 2 : 0) + (t[2] === 'x' ? 1 : 0);
export const octalOf = (p: { u: string; g: string; o: string }) => `${triadNum(p.u)}${triadNum(p.g)}${triadNum(p.o)}`;
/** 'u=rwx,g=rx,o=' as chmod accepts it. */
export const symbolicOf = (p: { u: string; g: string; o: string }) => (['u', 'g', 'o'] as const).map((k) => `${k}=${p[k].replace(/-/g, '')}`).join(',');

const WHO: Record<string, { name: string; uid: number; groups: string[]; label: Bi }> = {
  anna: { name: 'anna', uid: 1001, groups: ['anna', 'dev'], label: bi('anna, владелец файла', 'anna — the owner') },
  bob: { name: 'bob', uid: 1002, groups: ['bob', 'dev'], label: bi('bob, участник группы dev', 'bob — in group dev') },
  eve: { name: 'eve', uid: 1003, groups: ['eve'], label: bi('eve, не владелец и не в группе dev', 'eve — everyone else') },
  root: { name: 'root', uid: 0, groups: ['root'], label: bi('root, администратор машины', 'root') },
};

const BIT_LABEL: Record<'r' | 'w' | 'x', Bi> = { r: bi('бит чтения r', 'read bit r'), w: bi('бит записи w', 'write bit w'), x: bi('бит запуска x', 'run bit x') };

const ACTIONS: Record<string, { bit: 'r' | 'w' | 'x'; onDir: boolean; label: Bi; verb: Bi; cmd: string; okCard: string }> = {
  read: { bit: 'r', onDir: false, label: bi('прочитать файл index.html (команда cat)', 'read the file (cat)'), verb: bi('прочитать файл index.html', 'read') , cmd: 'cat index.html', okCard: '<html>…' },
  write: { bit: 'w', onDir: false, label: bi('изменить файл index.html', 'change the file'), verb: bi('изменить файл index.html', 'change') , cmd: 'echo >> index.html', okCard: 'OK' },
  run: { bit: 'x', onDir: false, label: bi('запустить файл index.html как программу', 'run the file'), verb: bi('запустить файл index.html как программу', 'run') , cmd: './index.html', okCard: 'OK' },
  list: { bit: 'r', onDir: true, label: bi('посмотреть список файлов в /srv/www (команда ls)', 'list the directory (ls)'), verb: bi('посмотреть список файлов в каталоге /srv/www', 'list') , cmd: 'ls /srv/www', okCard: 'index.html' },
  enter: { bit: 'x', onDir: true, label: bi('войти в каталог /srv/www (команда cd)', 'enter the directory (cd)'), verb: bi('войти в каталог /srv/www', 'enter') , cmd: 'cd /srv/www', okCard: 'OK' },
  delete: { bit: 'w', onDir: true, label: bi('удалить файл из каталога /srv/www (команда rm)', 'delete a file from the directory (rm)'), verb: bi('удалить файл из каталога /srv/www', 'delete') , cmd: 'rm index.html', okCard: 'OK' },
};

export interface PermDecision {
  triad: 'u' | 'g' | 'o' | 'root';
  allowed: boolean;
  stoppedAt: 'srv' | 'www' | 'target' | null;
}

/** The decision itself (path_resolution(7)): x on every directory of the path, then one triad. */
export function decide(p: P, broken: ReadonlySet<string>): PermDecision {
  const who = WHO[p.who] ?? WHO.eve;
  const act = ACTIONS[p.action] ?? ACTIONS.read;
  if (who.uid === 0) {
    // root passes the rwx checks; only running a file needs at least one x somewhere
    const anyX = [p.u, p.g, p.o].some((t) => t[2] === 'x');
    return { triad: 'root', allowed: act.bit !== 'x' || act.onDir || anyX, stoppedAt: null };
  }
  if (broken.has('no-x-srv')) return { triad: 'o', allowed: false, stoppedAt: 'srv' };
  const triad = who.name === 'anna' ? 'u' : who.groups.includes('dev') ? 'g' : 'o';
  const bits = p[triad];
  const bitPos = { r: 0, w: 1, x: 2 }[act.bit];
  // the target is /srv/www/index.html (a file) or /srv/www (a directory); for a file we also pass /srv/www, which is 0755
  return { triad, allowed: bits[bitPos] !== '-', stoppedAt: bits[bitPos] === '-' ? 'target' : null };
}


const ALL = ['who', 'srv', 'www', 'target', 'tu', 'tg', 'to', 'result', 'e-srv', 'e-www', 'e-target', 'e-u', 'e-u-dir', 'e-g', 'e-o', 'r-u', 'r-g', 'r-o', 'e-answer'];
/** The picture starts empty except for the given elements. */
const startWith = (...shown: string[]): Record<string, ElementState> => Object.fromEntries(ALL.filter((id) => !shown.includes(id)).map((id) => [id, 'hidden' as ElementState]));

/** The answer of the system at the end of a run: 'ok' or 'err'. */
export const finalAnswer = (steps: Step[]) => [...steps].reverse().find((x) => x.states?.result)?.states?.result;

const TRIAD_NAME = { u: bi('владельца', 'the owner’s'), g: bi('группы', 'the group’s'), o: bi('«остальных»', '“others”') };

const sys = (what: [string, string], see?: string) => ({ what: bi(what[0], what[1]), who: bi('Эту проверку выполняет ядро системы.', 'The system kernel performs this check.'), see });

export const permModel = defineModel<P>({
  id: 'linux.perm',
  frame: 'visible',
  block: 'linux',
  title: bi('Как система проверяет права доступа', 'How the system decides whether you may'),
  summary: bi(
    'Пользователь набирает команду, например `cat /srv/www/index.html`. Система сначала проходит каталоги на пути к файлу, потом выбирает одну из трёх троек прав файла и по ней отвечает: разрешить действие или отказать с сообщением `Permission denied`.',
    'A user types a command such as `cat /srv/www/index.html`. The system first walks the directories on the path, then picks one of the file’s three triads and answers by it: allow the action or refuse with `Permission denied`.',
  ),
  intro: bi(
    'Схема соберётся у вас на глазах, а сейчас на ней только пользователь и файл. А дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен тот блок, который работает, облачко рядом с ним говорит, что он делает, а карточка на линии показывает, что передаётся дальше.\n\nКогда пройдёте до ответа, выберите в «Параметрах» другого пользователя или другие права и пройдите проверку ещё раз.',
    'The diagram builds itself as you go: now it shows only the user and the file. Then go on with “Step forward” above the diagram. At every step the block that is working is highlighted, the callout next to it says what it does, and the card on the line shows what is handed on.\n\nOnce you reach the answer, choose another user or other rights in “Parameters” and walk the check again.',
  ),
  legend: [
    { mark: 'active', text: bi('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: bi('что этот блок делает', 'what that block does') },
    { mark: 'token', text: bi('метка на линии, которая несёт команду, тройку битов или ответ', 'a tag on a line carrying the command, a triad or the answer') },
    { mark: 'icon:folder', text: bi('каталог на пути', 'a directory on the path') },
    { mark: 'icon:file', text: bi('файл', 'the file') },
    { mark: 'icon:lock', text: bi('тройка прав с подписью, для кого она и какие в ней биты', 'a triad labelled with whom it is for and its bits') },
    { mark: 'ok', text: bi('этап пройден', 'stage passed') },
    { mark: 'err', text: bi('здесь система отказала', 'the system refused here') },
    { mark: 'pale', text: bi('тройка не про этого пользователя', 'a triad not about this user') },
  ],
  stopLabel: bi('Проверка остановилась', 'The check stopped'),
  concepts: ['linux.mode', 'linux.user', 'linux.group'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      {
        id: 'who',
        label: bi('Кто обращается', 'Who asks'),
        icon: 'user',
        work: 'dots',
        sub: 'eve · uid 1003',
        family: 'user',
        x: 24,
        y: 40,
        w: 200,
        h: 64,
        card: {
          what: bi('Пользователь, от имени которого выполняется команда. Система различает пользователей по номеру uid и по списку групп, в которые пользователь входит, а имена нужны только людям.', 'The user a command runs as. The system looks at the number (uid) and the list of groups; names are only for people.'),
          who: bi('Пользователя определяет вход в систему. Команды `sudo` и `su` на время одной команды подменяют его другим пользователем.', 'Set when you log in; `sudo` and `su` change it for one command.'),
          see: 'id',
          doc: { page: 'man/id.1', anchor: 'DESCRIPTION' },
        },
      },
      {
        id: 'srv',
        label: '/srv',
        icon: 'folder',
        sub: 'drwxr-xr-x root root',
        family: 'store',
        x: 270,
        y: 40,
        w: 200,
        h: 64,
        card: {
          what: bi('Первый каталог на пути к файлу. Пройти сквозь каталог к тому, что лежит внутри, можно только при бите x в той тройке, которая к вам относится. Бит r для прохода не нужен: он разрешает лишь посмотреть список имён в каталоге. Каталог принадлежит root, поэтому для anna, bob и eve здесь решает третья тройка, тройка «остальных».', 'The first directory of the path. To go through a directory you need the x bit of the triad that applies to you. The r bit is not needed for that: it only shows the list of names.'),
          who: bi('Каталог создан при установке системы.', 'Created when the system was installed.'),
          see: 'ls -ld /srv',
        },
      },
      {
        id: 'www',
        label: '/srv/www',
        icon: 'folder',
        sub: 'drwxr-x--x anna dev',
        family: 'store',
        x: 510,
        y: 40,
        w: 200,
        h: 64,
        card: {
          what: bi('Каталог, в котором лежит файл. Создать или удалить файл означает изменить список имён в каталоге, поэтому удаление разрешает бит w у каталога, а права самого файла на него не влияют.', 'The directory the file is in. Deleting or creating a file changes the directory’s list of names, so deletion depends on w of the directory, not of the file.'),
          who: bi('Каталог создала anna и отдала его группе dev.', 'Created by anna; the group is dev.'),
          see: 'ls -ld /srv/www',
        },
      },
      {
        id: 'target',
        label: 'index.html',
        icon: 'file',
        sub: '-rwxr-x--- anna dev',
        family: 'store',
        x: 750,
        y: 40,
        w: 200,
        h: 64,
        card: {
          what: bi('Файл, к которому обращаются. У него есть владелец (anna), группа (dev) и режим, то есть девять битов прав в трёх тройках. Эти тройки вы задаёте в группе полей «Права файла index.html» над схемой.', 'The target. The file has an owner (anna), a group (dev) and a mode: nine bits in three triads, which you set in “The rights of index.html” above.'),
          who: bi('Режим файла меняет его владелец командой `chmod`, а владельца файла меняет root командой `chown`.', 'The owner changes the mode with `chmod`; root changes the owner with `chown`.'),
          see: 'stat -c "%A %a %U:%G" /srv/www/index.html',
          doc: { page: 'man/chmod.1', anchor: 'DESCRIPTION', line: 'The letters rwxXst' },
        },
      },
      {
        id: 'tu',
        label: bi('Тройка владельца', 'Owner triad'),
        icon: 'lock',
        sub: 'anna · rwx',
        family: 'neutral',
        x: 270,
        y: 250,
        w: 200,
        h: 64,
        card: { what: bi('Первые три бита режима. Они относятся только к владельцу файла. Если uid того, кто обращается, совпадает с владельцем, решает эта тройка, и дальше система не смотрит, даже если у группы прав больше.', 'The first three bits. They apply only to the owner; if your uid is the owner, this triad decides and the system looks no further, even if the group has more rights.'), who: bi('Тройку задаёт владелец файла командой `chmod u=…`.', 'The owner sets it with `chmod u=…`.'), doc: { url: 'https://man7.org/linux/man-pages/man7/path_resolution.7.html', label: 'path_resolution(7)' } },
      },
      {
        id: 'tg',
        label: bi('Тройка группы', 'Group triad'),
        icon: 'lock',
        sub: 'dev · r-x',
        family: 'neutral',
        x: 510,
        y: 250,
        w: 200,
        h: 64,
        card: { what: bi('Вторые три бита. Они относятся к участникам группы файла, если те не владельцы. Группа подходит, если она основная или одна из дополнительных групп пользователя.', 'The second three bits: for members of the file’s group who are not the owner, whether it is their primary or a supplementary group.'), who: bi('Тройку задаёт владелец файла командой `chmod g=…`.', 'The owner sets it with `chmod g=…`.'), see: 'groups' },
      },
      {
        id: 'to',
        label: bi('Тройка «остальных»', 'Others triad'),
        icon: 'lock',
        sub: '---',
        family: 'neutral',
        x: 750,
        y: 250,
        w: 200,
        h: 64,
        card: { what: bi('Последние три бита. Они относятся ко всем, кто не владелец и не в группе файла. Система всегда выбирает ровно одну тройку, и права из разных троек не складываются.', 'The last three bits, for everyone who is neither the owner nor in the group. Exactly one triad decides; rights do not add up.'), who: bi('Тройку задаёт владелец файла командой `chmod o=…`.', 'The owner sets it with `chmod o=…`.') },
      },
      {
        id: 'result',
        label: bi('Ответ системы', 'The answer'),
        icon: 'terminal',
        sub: '?',
        family: 'neutral',
        x: 510,
        y: 392,
        w: 200,
        h: 64,
        card: { what: bi('Если в выбранной тройке стоит нужный бит, действие разрешено. Если бита нет, команда получает ответ `Permission denied` (код ошибки EACCES) и печатает его. Для root биты rwx не проверяются вовсе.', 'The bit you need is in the chosen triad: allowed. Not there: `Permission denied` (EACCES), which the command prints. Root skips the rwx check.'), who: bi('Ответ даёт система, а команда только печатает его.', 'The system answers; the command only prints it.') },
      },
    ],
    edges: [
      { id: 'e-srv', from: 'who', to: 'srv', label: bi('проход через /srv', 'through /srv'), card: sys(['Чтобы пройти через каталог, нужен бит x в тройке, которая к вам относится.', 'Passing through a directory requires the x bit.']) },
      { id: 'e-www', from: 'srv', to: 'www', label: bi('проход через /srv/www', 'through /srv/www'), card: sys(['Следующий каталог тоже нужно пройти, и для этого снова нужен бит x.', 'The next directory needs x as well.']) },
      { id: 'e-target', from: 'www', to: 'target', label: bi('переход к файлу', 'on to the file'), card: sys(['Все каталоги на пути пройдены, и теперь система смотрит на права самого файла.', 'Every directory is passed; now the file itself.']) },
      { id: 'e-u', from: 'target', to: 'tu', via: [[850, 176], [370, 176]], labelAt: 0.5, label: bi('проверка владельца', 'owner check'), card: sys(['Сначала система сравнивает uid того, кто обращается, с владельцем файла.', 'First the uid is compared with the owner.']) },
      { id: 'e-u-dir', from: 'www', to: 'tu', via: [[610, 176], [370, 176]], labelAt: 0.5, label: bi('проверка владельца каталога', 'directory owner check'), card: sys(['Действие над самим каталогом /srv/www: система сравнивает uid с владельцем каталога.', 'An action on /srv/www itself: the uid is compared with the directory’s owner.']) },
      { id: 'e-g', from: 'tu', to: 'tg', label: bi('проверка группы', 'group check'), card: sys(['Вы не владелец, поэтому система проверяет группу.', 'Not the owner: check the group.']) },
      { id: 'e-o', from: 'tg', to: 'to', label: bi('права остальных', 'others'), card: sys(['Вы и в группу не входите, поэтому остаются права «остальных».', 'Not in the group: “others” remains.']) },
      { id: 'r-u', from: 'tu', to: 'result', via: [[370, 424]], labelAt: 0.4, label: bi('решение по правам владельца', 'decided by owner bits'), card: sys(['Решает первая тройка, тройка владельца.', 'The first triad decides.']) },
      { id: 'r-g', from: 'tg', to: 'result', label: bi('решение по правам группы', 'decided by group bits'), card: sys(['Решает вторая тройка, тройка группы.', 'The second triad decides.']) },
      { id: 'r-o', from: 'to', to: 'result', via: [[850, 424]], labelAt: 0.4, label: bi('решение по правам остальных', 'decided by others bits'), card: sys(['Решает третья тройка, тройка остальных.', 'The third triad decides.']) },
      { id: 'e-answer', from: 'result', to: 'who', via: [[124, 424]], labelAt: 0.3, label: bi('ответ команде', 'answer to the command'), card: { what: bi('Ответ возвращается команде, и она печатает либо результат, либо сообщение об ошибке.', 'The answer goes back to the command, which prints the result or the error.'), who: bi('Ответ даёт система.', 'The system.') } },
    ],
  },
  params: [
    {
      id: 'who',
      label: bi('Кто обращается к файлу', 'Who'),
      kind: 'choice',
      default: 'eve',
      options: Object.entries(WHO).map(([id, w]) => ({ id, label: w.label })),
      near: 'who',
      group: bi('Кто и что делает', 'Who does what'),
    },
    {
      id: 'action',
      label: bi('Что он хочет сделать', 'Wants to'),
      kind: 'choice',
      default: 'read',
      options: Object.entries(ACTIONS).map(([id, a]) => ({ id, label: a.label })),
      near: 'result',
      group: bi('Кто и что делает', 'Who does what'),
    },
    { id: 'u', label: bi('Права владельца (u)', 'owner (u)'), kind: 'choice', default: 'rwx', options: triadOpts, near: 'tu', group: bi('Права файла index.html', 'The rights of index.html') },
    {
      id: 'g',
      label: bi('Права группы (g)', 'group (g)'),
      kind: 'choice',
      default: 'r-x',
      options: triadOpts,
      near: 'tg',
      group: bi('Права файла index.html', 'The rights of index.html'),
      predict: {
        prompt: bi('Вы меняете права группы, то есть вторую тройку. Изменится ли ответ системы для пользователя, который выбран сейчас?', 'You change the group’s rights. Will the answer change for the person asking now?'),
        options: [
          { id: 'changes', text: bi('Да, система ответит иначе', 'Yes, the system will answer differently') },
          { id: 'same', text: bi('Нет, потому что для этого пользователя решает другая тройка или нужный бит остался прежним', 'No, because another triad decides for this user or the needed bit stayed the same') },
        ],
        resolve: (prev, next) => (finalAnswer(prev) === finalAnswer(next) ? 'same' : 'changes'),
      },
    },
    { id: 'o', label: bi('Права остальных (o)', 'others (o)'), kind: 'choice', default: '---', options: triadOpts, near: 'to', group: bi('Права файла index.html', 'The rights of index.html') },
  ],
  breaks: [
    {
      id: 'no-x-srv',
      label: bi('Снять бит x с каталога /srv у «остальных»', 'Remove x on /srv for others'),
      remove: ['e-srv'],
      boundary: 'identity',
      predict: {
        prompt: bi('Каталог /srv принадлежит root, и у него сняли бит x для «остальных». Права самого файла index.html никто не трогал. Дойдёт ли проверка до файла?', 'x was removed from /srv for others, while the file’s own mode is untouched. Does the check reach the file?'),
        options: [
          { id: 'no', text: bi('Нет, проверка остановится на каталоге /srv, и права самого файла уже ничего не решат', 'No, the check stops at /srv and the file’s own mode no longer matters') },
          { id: 'yes', text: bi('Да, потому что права каталогов не важны и решают только права самого файла', 'Yes, because only the file’s own mode matters') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken) ? 'no' : 'yes'),
      },
    },
  ],
  metrics: [],
  run(p, broken): Step[] {
    const who = WHO[p.who] ?? WHO.eve;
    const act = ACTIONS[p.action] ?? ACTIONS.read;
    const d = decide(p, broken);
    const mode = `${act.onDir ? 'd' : '-'}${p.u}${p.g}${p.o}`;
    const octal = octalOf(p);
    const steps: Step[] = [];
    const goal = act.onDir ? 'www' : 'target';
    const answer = (allowed: boolean) => {
      steps.push({
        id: 'answer',
        label: bi('ответ', 'answer'),
        caption: allowed
          ? fmtb(bi('Система разрешила действие, и команда `{c}` выполняется. Для пользователя {w} это выглядит так, будто ничего особенного не произошло: команда сработала как обычно.', 'The system allowed the action and `{c}` runs. For {w} nothing special seems to happen: the command just works.'), { c: act.cmd, w: who.name })
          : fmtb(bi('Отказ возвращается команде, и она печатает сообщение `Permission denied`. Сама команда ни в чём не виновата, потому что решение приняла система.', 'The refusal goes back to the command, which prints `Permission denied`. The command did nothing wrong: the system decided.'), {}),
        focus: ['e-answer', 'who'],
        reveal: ['e-answer'],
        tokens: [{ edge: 'e-answer', label: allowed ? act.okCard : 'Permission denied' }],
        say: { who: allowed ? fmtb(bi('Система пропустила пользователя {w}, и команда `{c}` выполнилась так, как он и ожидал.', 'The system let {w} through, and the command `{c}` did what was expected.'), { w: who.name, c: act.cmd }) : fmtb(bi('Пользователь {w} видит в терминале сообщение `{c}: Permission denied`, то есть «доступ запрещён».', '{w} sees the message `{c}: Permission denied` in the terminal.'), { w: who.name, c: act.cmd.split(' ')[0] }) },
        states: { who: allowed ? 'ok' : 'err' },
      });
    };
    steps.push({
      id: 'ask',
      label: bi('запрос', 'request'),
      caption: fmtb(
        bi(
          'Пользователь {w} хочет {a} и набирает команду `{c}`. Прежде чем выполнить её, система проверит, разрешено ли это действие пользователю {w}.',
          '{w} wants to {a} and types `{c}`. Before running it, the system checks whether {w} is allowed this action.',
        ),
        { w: who.name, a: act.verb, c: act.cmd },
      ),
      focus: ['who'],
      say: { who: fmtb(bi('Пользователь {w} набирает команду `{c}`.', '{w} types `{c}`.'), { w: who.name, c: act.cmd }) },
      values: {
        who: `${who.name} · uid ${who.uid}`,
        target: `${mode.replace(/^d/, '-')} anna dev`,
        www: act.onDir ? `${mode} anna dev` : 'drwxr-x--x anna dev',
        tu: `anna · ${p.u}`,
        tg: `dev · ${p.g}`,
        to: p.o,
        result: '?',
      },
      states: startWith('who', goal),
    });
    steps.push({
      id: 'mode',
      label: bi('режим', 'mode'),
      caption: fmtb(
        bi(
          'Режим {tg} сейчас {m}. Числом этот режим записывается как {o}, а буквами его задаёт команда `chmod {s}`. Сначала система проверит каталоги на пути, а потом выберет одну из трёх троек режима.',
          'The mode of {tg} is now {m}. As a number this mode is written {o}, and in letters `chmod {s}` sets it. First the system checks the directories on the path, then it picks one of the mode’s three triads.',
        ),
        { tg: bi(act.onDir ? 'каталога /srv/www' : 'файла index.html', act.onDir ? 'the directory /srv/www' : 'the file index.html'), m: mode, o: octal, s: symbolicOf(p) },
      ),
      focus: [goal],
      say: { [goal]: fmtb(bi('У {tg} режим {m}, то есть {o}.', '{tg} has mode {m}, that is {o}.'), { tg: bi(act.onDir ? 'каталога /srv/www' : 'файла index.html', act.onDir ? 'The directory /srv/www' : 'The file index.html'), m: mode, o: octal }) },
    });
    if (d.triad === 'root') {
      steps.push({
        id: 'root',
        label: 'root',
        caption: d.allowed
          ? bi('Обращается root, пользователь с uid 0. Для него система вообще не проверяет биты rwx, поэтому ни каталоги, ни тройки здесь не важны, и действие разрешено.', 'root is the user with uid 0: for root the rwx check is skipped entirely; directories and triads do not matter.')
          : bi('Даже root не может запустить файл, если ни в одной тройке нет бита x: такой файл никто не пометил как программу.', 'Even root cannot run a file without a single x bit: nothing marks it as runnable.'),
        focus: ['result'],
        reveal: ['result'],
        say: { result: d.allowed ? bi('Система видит, что команду выполняет root с номером 0, и разрешает действие, даже не глядя на права.', 'The system sees that root, uid 0, runs the command and allows it without looking at the bits.') : bi('Система ищет у файла хотя бы один бит x, не находит его и отказывает даже root, потому что файл никто не пометил как программу.', 'The system looks for any x bit, finds none and refuses even root.') },
        states: { result: d.allowed ? 'ok' : 'err' },
        values: { result: d.allowed ? 'OK' : 'Permission denied' },
      });
      answer(d.allowed);
      return steps;
    }
    if (d.stoppedAt === 'srv') {
      steps.push({
        id: 'srv',
        label: '/srv',
        caption: fmt(
          bi(
            'Проверка остановилась на первом же каталоге. Каталог /srv принадлежит root, а в тройке «остальных» теперь нет бита x, поэтому пройти сквозь каталог нельзя, и до файла проверка не дошла.',
            'The check stopped at the very first directory. /srv belongs to root, and the “others” triad now has no x, so the directory cannot be passed and the check never reached the file.',
          ),
          { w: who.name },
        ),
        focus: ['e-srv', 'srv'],
        reveal: ['srv', 'e-srv', 'result'],
        tokens: [{ edge: 'e-srv', label: act.cmd }],
        say: { srv: fmtb(bi('Для пользователя {w} действуют права остальных r--, а бита x в них нет.', 'For {w} the “others” triad r-- applies, and it has no x.'), { w: who.name }) },
        states: { srv: 'err', 'e-srv': 'err', result: 'err' },
        values: { srv: 'drwxr-xr-- root root', result: 'Permission denied' },
        broken: { at: 'srv', message: `${act.cmd.split(' ')[0]}: /srv/www/${act.onDir ? '' : 'index.html'}: Permission denied`.replace('/: ', ': '), caption: bi('Проверка остановилась на каталоге /srv, ещё до того, как система посмотрела на сам файл. Файл в порядке, но пройти к нему через каталог нельзя, и это самая частая причина отказа.', 'at the directory /srv, before the file. The file itself is fine, but you cannot pass through the directory to it, and that is the most common cause of a refusal.') },
      });
      answer(false);
      return steps;
    }
    steps.push({
      id: 'srv',
      label: '/srv',
      caption: bi('Чтобы добраться до файла, система сначала проходит каталог /srv. Он принадлежит root, поэтому для anna, bob и eve здесь действует тройка «остальных» r-x. Бит x в ней есть, и каталог можно пройти.', 'To reach the file the system first passes /srv. It belongs to root, so for anna, bob and eve the “others” triad r-x applies. It has x, so the directory can be passed.'),
      focus: ['e-srv', 'srv'],
      reveal: ['srv', 'e-srv'],
      tokens: [{ edge: 'e-srv', label: act.cmd }],
      say: { srv: fmtb(bi('Для пользователя {w} действуют права остальных r-x, и бит x в них есть.', 'For {w} the “others” triad r-x applies, and it has x.'), { w: who.name }) },
      states: { srv: 'ok' },
    });
    const wwwTriad = who.name === 'anna' ? 'rwx' : who.groups.includes('dev') ? 'r-x' : '--x';
    const wwwWhose = who.name === 'anna' ? TRIAD_NAME.u : who.groups.includes('dev') ? TRIAD_NAME.g : TRIAD_NAME.o;
    if (!act.onDir) {
      steps.push({
        id: 'www',
        label: '/srv/www',
        caption: fmtb(bi('Следующий каталог, /srv/www, принадлежит anna и группе dev. Для {w} здесь действует тройка {n}, {t}. Бит x в ней есть, и этот каталог тоже можно пройти.', 'The next directory, /srv/www, belongs to anna and group dev. For {w} the {n} triad {t} applies here. It has x, so this directory can be passed as well.'), { w: who.name, n: wwwWhose, t: wwwTriad }),
        focus: ['e-www', 'www'],
        reveal: ['www', 'e-www'],
        tokens: [{ edge: 'e-www', label: act.cmd }],
        say: { www: fmtb(bi('Для пользователя {w} здесь действуют права {n} {t} с битом x, поэтому система пропускает его к файлу.', 'For {w} the {n} triad {t} with x applies here, so the system lets the user through to the file.'), { w: who.name, n: wwwWhose, t: wwwTriad }) },
        states: { www: 'ok' },
      });
      steps.push({
        id: 'target',
        label: bi('файл', 'file'),
        caption: fmtb(bi('Путь пройден, и теперь система смотрит на режим самого файла {m}. В нём три тройки, {u} для владельца anna, {g} для группы dev и {o} для всех остальных, и решать будет ровно одна из них.', 'The path is passed, and now the system looks at the file’s own mode {m}. It has three triads, {u} for the owner anna, {g} for group dev and {o} for everyone else, and exactly one of them will decide.'), { m: mode, u: p.u, g: p.g, o: p.o }),
        focus: ['e-target', 'target'],
        reveal: ['e-target'],
        tokens: [{ edge: 'e-target', label: act.cmd }],
        say: { target: fmtb(bi('Система читает права файла {m} и выбирает одну тройку.', 'The system reads the file’s mode {m} and picks one triad.'), { m: mode }) },
      });
    }
    const asker = `uid ${who.uid}`;
    const firstEdge = act.onDir ? 'e-u-dir' : 'e-u';
    const objName = act.onDir ? bi('каталога', 'the directory') : bi('файла', 'the file');
    steps.push({
      id: 'q1',
      label: bi('проверка владельца', 'owner check'),
      caption:
        who.name === 'anna'
          ? fmtb(bi('Первый вопрос система задаёт о владельце {f}. Владелец здесь anna, и обращается тоже anna, поэтому решает первая тройка, а на группу и остальных система уже не смотрит.', 'The first question is about the owner of {f}. The owner is anna, and anna is the one asking, so the first triad decides, and the system does not look at the group and the others.'), { f: objName })
          : fmtb(bi('Первый вопрос система задаёт о владельце {f}. Владелец здесь anna, а обращается {w}, поэтому первая тройка к {w} не относится, и система переходит ко второму вопросу.', 'The first question is about the owner of {f}. The owner is anna, but {w} is asking, so the first triad does not apply to {w}, and the system moves on to the second question.'), { w: who.name, f: objName }),
      focus: [firstEdge, 'tu'],
      reveal: [firstEdge, 'tu'],
      tokens: [{ edge: firstEdge, label: asker }],
      say: { tu: who.name === 'anna' ? bi('Файл принадлежит anna, и обращается к нему тоже anna, поэтому решать будут права владельца.', 'The file belongs to anna, and anna is the one asking, so the owner’s triad decides.') : fmtb(bi('Файл принадлежит anna, а обращается к файлу {w}, поэтому права владельца для {w} не действуют.', 'The file belongs to anna, but {w} is asking, so the owner’s triad does not apply to {w}.'), { w: who.name }) },
      states: { tu: who.name === 'anna' ? 'ok' : 'off' },
    });
    if (d.triad !== 'u')
      steps.push({
        id: 'q2',
        label: bi('проверка группы', 'group check'),
        caption:
          d.triad === 'g'
            ? fmtb(bi('Второй вопрос система задаёт о группе файла. Группа dev есть в списке групп пользователя {w}, поэтому решает вторая тройка.', 'The second question is about the file’s group. dev is on the list of {w}’s groups, so the second triad decides.'), { w: who.name })
            : fmtb(bi('Второй вопрос система задаёт о группе файла. Группы dev в списке групп пользователя {w} нет, поэтому остаётся третья тройка.', 'The second question is about the file’s group. dev is not on the list of {w}’s groups, so the third triad remains.'), { w: who.name }),
        focus: ['e-g', 'tg'],
        reveal: ['e-g', 'tg'],
        tokens: [{ edge: 'e-g', label: asker }],
        say: { tg: d.triad === 'g' ? fmtb(bi('Пользователь {w} входит в группу dev, которой принадлежит файл, поэтому решать будут права группы.', '{w} is in group dev, the file’s group, so the group triad decides.'), { w: who.name }) : fmtb(bi('Пользователь {w} не входит в группу dev, поэтому права группы для {w} тоже не действуют.', '{w} is not in group dev, so the group triad does not apply to {w} either.'), { w: who.name }) },
        states: { tg: d.triad === 'g' ? 'ok' : 'off' },
      });
    if (d.triad === 'o')
      steps.push({
        id: 'q3',
        label: bi('права остальных', 'others’ rights'),
        caption: fmtb(bi('Пользователь {w} не владелец файла и не участник группы dev, поэтому система применяет к {w} третью тройку, права «остальных».', '{w} is neither the owner nor in dev, so the system applies the third triad, the rights of “others”, to {w}.'), { w: who.name }),
        focus: ['e-o', 'to'],
        reveal: ['e-o', 'to'],
        tokens: [{ edge: 'e-o', label: asker }],
        say: { to: fmtb(bi('Остаются права для всех остальных пользователей, {t}, и решение теперь зависит только от них.', 'The “others” triad {t} remains, and it alone decides.'), { t: p.o }) },
        states: { to: 'ok' },
      });
    const triad = p[d.triad];
    const edge = { u: 'r-u', g: 'r-g', o: 'r-o' }[d.triad];
    steps.push({
      id: 'bit',
      label: BIT_LABEL[act.bit],
      caption: d.allowed
        ? fmt(bi('В тройке `{t}` есть бит {b}, который нужен для этого действия, поэтому система его разрешает.', 'The triad `{t}` has the {b} bit: allowed.'), { t: triad, b: act.bit })
        : fmt(bi('В тройке `{t}` нет бита {b}, который нужен для этого действия, поэтому система отказывает. Бит в другой тройке не поможет, потому что решает только выбранная тройка.', 'The triad `{t}` lacks the {b} bit: refused, even if another triad has it.'), { t: triad, b: act.bit }),
      focus: [edge, 'result'],
      reveal: [edge, 'result'],
      tokens: [{ edge, label: triad }],
      say: { result: d.allowed ? fmt(bi('В правах {t} есть бит {b}, который нужен для этого действия, поэтому система его разрешает.', 'The triad {t} has the {b} bit this action needs, so the system allows it.'), { t: triad, b: act.bit }) : fmt(bi('В правах {t} нет бита {b}, который нужен для этого действия, поэтому система отказывает.', 'The triad {t} lacks the {b} bit this action needs, so the system refuses.'), { t: triad, b: act.bit }) },
      states: { result: d.allowed ? 'ok' : 'err', [edge]: d.allowed ? 'ok' : 'err' },
      values: { result: d.allowed ? 'OK' : 'Permission denied' },
    });
    answer(d.allowed);
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    void prev;
    if (change.kind === 'break')
      return change.on
        ? bi('Бит x у каталога /srv снят, и проверка останавливается на первом же каталоге. Права самого файла теперь ничего не решают.', 'Without x on /srv the check stops at the first directory: the file’s own mode no longer matters.')
        : bi('Бит x у каталога /srv вернули, и путь к файлу снова открыт.', 'x is back on /srv: the path can be passed again.');
    const ok = finalAnswer(next) === 'ok';
    const verdict = ok ? bi('действие разрешено', 'the action is allowed') : bi('система отказывает', 'the system refuses');
    const modeVerdict = ok ? bi('выбранный пользователь может выполнить это действие', 'the chosen user may perform this action') : bi('выбранному пользователю система в этом действии отказывает', 'the system refuses the chosen user this action');
    if (change.id === 'u' || change.id === 'g' || change.id === 'o') {
      return fmtb(bi('Режим изменился с {a} на {b}, и теперь {v}.', 'The mode changed from {a} to {b}, and now {v}.'), { a: octalOf(a as P), b: octalOf(b as P), v: modeVerdict });
    }
    if (change.id === 'who') return fmtb(bi('Теперь к файлу обращается {w}. Система выбирает тройку, которая относится к {w}, и {v}.', 'Now {w} is asking. The system picks the triad that applies to {w}, and {v}.'), { w: (b as P).who, v: verdict });
    return fmtb(bi('Новому действию нужен другой бит, и теперь {v}.', 'The new action needs a different bit, and now {v}.'), { v: verdict });
  },
});
