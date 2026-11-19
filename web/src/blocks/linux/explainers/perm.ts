// X5 «How the system decides whether you may» (02 §6.6 X5, layer 1, M5):
// three triads of bits, who asks, what they want to do, and the check that
// walks the path directory by directory and then picks exactly one triad.
// The words "kernel" and "process" are not used: this explainer comes before
// the lesson that introduces them.

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import { fmtb } from './util';
import type { Step } from '../../../core/types';

type P = { u: string; g: string; o: string; who: string; action: string };

export const TRIADS = ['rwx', 'rw-', 'r-x', 'r--', '-wx', '-w-', '--x', '---'];
const triadOpts = TRIADS.map((t) => ({ id: t, label: bi(t, t) }));

/** 'rwx' → 7 */
export const triadNum = (t: string) => (t[0] === 'r' ? 4 : 0) + (t[1] === 'w' ? 2 : 0) + (t[2] === 'x' ? 1 : 0);
export const octalOf = (p: { u: string; g: string; o: string }) => `${triadNum(p.u)}${triadNum(p.g)}${triadNum(p.o)}`;
/** 'u=rwx,g=rx,o=' as chmod accepts it. */
export const symbolicOf = (p: { u: string; g: string; o: string }) => (['u', 'g', 'o'] as const).map((k) => `${k}=${p[k].replace(/-/g, '')}`).join(',');

const WHO: Record<string, { name: string; uid: number; groups: string[]; label: Bi }> = {
  anna: { name: 'anna', uid: 1001, groups: ['anna', 'dev'], label: bi('anna — владелец', 'anna — the owner') },
  bob: { name: 'bob', uid: 1002, groups: ['bob', 'dev'], label: bi('bob — в группе dev', 'bob — in group dev') },
  eve: { name: 'eve', uid: 1003, groups: ['eve'], label: bi('eve — остальные', 'eve — everyone else') },
  root: { name: 'root', uid: 0, groups: ['root'], label: bi('root', 'root') },
};

const ACTIONS: Record<string, { bit: 'r' | 'w' | 'x'; onDir: boolean; label: Bi; verb: Bi }> = {
  read: { bit: 'r', onDir: false, label: bi('прочитать файл (cat)', 'read the file (cat)'), verb: bi('прочитать', 'read') },
  write: { bit: 'w', onDir: false, label: bi('изменить файл', 'change the file'), verb: bi('изменить', 'change') },
  run: { bit: 'x', onDir: false, label: bi('запустить файл', 'run the file'), verb: bi('запустить', 'run') },
  list: { bit: 'r', onDir: true, label: bi('список имён каталога (ls)', 'list the directory (ls)'), verb: bi('посмотреть список', 'list') },
  enter: { bit: 'x', onDir: true, label: bi('войти в каталог (cd)', 'enter the directory (cd)'), verb: bi('войти', 'enter') },
  delete: { bit: 'w', onDir: true, label: bi('удалить файл из каталога (rm)', 'delete a file from the directory (rm)'), verb: bi('удалить', 'delete') },
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

export const permModel = defineModel<P>({
  id: 'linux.perm',
  block: 'linux',
  title: bi('Как система решает, можно ли', 'How the system decides whether you may'),
  summary: bi(
    'Три тройки битов rwx: владелец, группа, остальные. Выберите режим, кто спрашивает и что он хочет сделать — проверка пройдёт по пути каталог за каталогом и выберет ровно одну тройку.',
    'Three triads of rwx bits: the owner, the group, everyone else. Choose the mode, who asks and what they want to do — the check walks the path directory by directory and picks exactly one triad.',
  ),
  concepts: ['linux.mode', 'linux.user', 'linux.group'],
  diagram: {
    width: 960,
    height: 460,
    nodes: [
      {
        id: 'who',
        label: bi('кто спрашивает', 'who asks'),
        sub: 'eve · uid 1003',
        family: 'user',
        x: 24,
        y: 40,
        w: 220,
        h: 64,
        card: {
          what: bi('Пользователь, от имени которого выполняется команда. Система смотрит на номер (uid) и на список групп — имена нужны только людям.', 'The user a command runs as. The system looks at the number (uid) and the list of groups — names are only for people.'),
          who: bi('Определяется при входе в систему; `sudo` и `su` меняют его на время команды.', 'Set when you log in; `sudo` and `su` change it for a command.'),
          see: 'id',
          doc: { page: 'man/id.1', anchor: 'DESCRIPTION' },
        },
      },
      {
        id: 'srv',
        label: '/srv',
        sub: 'drwxr-xr-x root root',
        family: 'store',
        shape: 'doc',
        x: 300,
        y: 40,
        w: 190,
        h: 64,
        card: {
          what: bi('Первый каталог пути. Чтобы пройти сквозь каталог к файлу внутри, нужен бит x у той тройки, что подходит вам. Бит r для этого не нужен — он только для списка имён.', 'The first directory of the path. To go through a directory to a file inside, you need the x bit of the triad that applies to you. The r bit is not needed for that — it is only for the list of names.'),
          who: bi('Создан при установке системы.', 'Created when the system was installed.'),
          see: 'ls -ld /srv',
        },
      },
      {
        id: 'www',
        label: '/srv/www',
        sub: 'drwxr-x--x anna dev',
        family: 'store',
        shape: 'doc',
        x: 530,
        y: 40,
        w: 190,
        h: 64,
        card: {
          what: bi('Каталог, в котором лежит файл. Удалить или создать файл — это изменить список имён каталога, поэтому удаление зависит от w у каталога, а не у файла.', 'The directory the file is in. Deleting or creating a file means changing the directory’s list of names, so deletion depends on w of the directory, not of the file.'),
          who: bi('Создала anna; группа — dev.', 'Created by anna; the group is dev.'),
          see: 'ls -ld /srv/www',
        },
      },
      {
        id: 'target',
        label: 'index.html',
        sub: '-rwxr-x--- anna dev',
        family: 'store',
        shape: 'doc',
        x: 760,
        y: 40,
        w: 180,
        h: 64,
        card: {
          what: bi('Цель. У файла есть владелец (anna), группа (dev) и режим — девять битов в трёх тройках, которые вы задаёте ручками слева внизу.', 'The target. The file has an owner (anna), a group (dev) and a mode — nine bits in three triads, which you set with the knobs below.'),
          who: bi('Владелец меняет режим командой `chmod`, владельца — root командой `chown`.', 'The owner changes the mode with `chmod`; root changes the owner with `chown`.'),
          see: 'stat -c "%A %a %U:%G" /srv/www/index.html',
          doc: { page: 'man/chmod.1', anchor: 'DESCRIPTION', line: 'The letters rwxXst' },
        },
      },
      {
        id: 'q-owner',
        label: bi('uid = владелец?', 'uid = owner?'),
        family: 'neutral',
        shape: 'pill',
        x: 140,
        y: 190,
        w: 190,
        h: 52,
        card: { what: bi('Первый вопрос: вы — владелец файла? Если да, решает первая тройка, и дальше система не смотрит, даже если у группы прав больше.', 'The first question: are you the owner of the file? If yes, the first triad decides, and the system looks no further — even if the group has more rights.'), who: bi('Проверка прав системы.', 'The system’s permission check.'), doc: { url: 'https://man7.org/linux/man-pages/man7/path_resolution.7.html', label: 'path_resolution(7)' } },
      },
      {
        id: 'q-group',
        label: bi('группа файла — ваша?', 'the file’s group is yours?'),
        family: 'neutral',
        shape: 'pill',
        x: 385,
        y: 190,
        w: 190,
        h: 52,
        card: { what: bi('Второй вопрос: группа файла — ваша основная или одна из дополнительных? Тогда решает вторая тройка.', 'The second question: is the file’s group your primary group or one of your supplementary ones? Then the second triad decides.'), who: bi('Проверка прав системы.', 'The system’s permission check.'), see: 'groups' } },
      {
        id: 'q-other',
        label: bi('иначе — остальные', 'otherwise — others'),
        family: 'neutral',
        shape: 'pill',
        x: 630,
        y: 190,
        w: 190,
        h: 52,
        card: { what: bi('Если ни то ни другое — третья тройка. Ровно одна тройка: права не складываются.', 'If neither — the third triad. Exactly one triad: rights do not add up.'), who: bi('Проверка прав системы.', 'The system’s permission check.') },
      },
      {
        id: 'result',
        label: bi('решение', 'the decision'),
        sub: 'Permission denied',
        family: 'neutral',
        x: 385,
        y: 300,
        w: 190,
        h: 56,
        card: { what: bi('Нужный бит в выбранной тройке есть — можно. Нет — `Permission denied` (код ошибки EACCES). Root пропускает эту проверку целиком.', 'The bit you need is in the chosen triad — allowed. Not there — `Permission denied` (error code EACCES). Root skips this check entirely.'), who: bi('Проверка прав системы.', 'The system’s permission check.') },
      },
      {
        id: 'system',
        label: bi('система проверяет права', 'the system checks the rights'),
        family: 'kernel',
        shape: 'bar',
        x: 16,
        y: 390,
        w: 928,
        h: 56,
        card: { what: bi('Проверку делает не программа, а система — одинаково для `cat`, `ls`, веб-сервера и вашего скрипта. Программа только узнаёт ответ.', 'The check is done not by the program but by the system — the same for `cat`, `ls`, a web server and your script. The program only learns the answer.'), who: bi('Операционная система, при каждом открытии файла.', 'The operating system, every time a file is opened.') },
      },
    ],
    edges: [
      { id: 'e-srv', from: 'who', to: 'srv', label: bi('x у /srv?', 'x on /srv?'), card: { what: bi('Проход через каталог требует бита x.', 'Passing through a directory requires the x bit.'), who: bi('Система', 'The system') } },
      { id: 'e-www', from: 'srv', to: 'www', label: bi('x у /srv/www?', 'x on /srv/www?'), card: { what: bi('И у следующего каталога — тоже x.', 'And on the next directory — x as well.'), who: bi('Система', 'The system') } },
      { id: 'e-target', from: 'www', to: 'target', label: bi('дошли', 'reached'), card: { what: bi('Все каталоги пути пройдены — теперь сам файл.', 'Every directory of the path is passed — now the file itself.'), who: bi('Система', 'The system') } },
      { id: 'e-owner', from: 'target', to: 'q-owner', via: [[850, 150], [235, 150]], label: bi('вопрос 1', 'question 1'), labelAt: 0.15, card: { what: bi('Сначала — владелец.', 'First — the owner.'), who: bi('Система', 'The system') } },
      { id: 'e-group', from: 'q-owner', to: 'q-group', label: bi('нет', 'no'), card: { what: bi('Не владелец — проверяем группу.', 'Not the owner — check the group.'), who: bi('Система', 'The system') } },
      { id: 'e-other', from: 'q-group', to: 'q-other', label: bi('нет', 'no'), card: { what: bi('Не в группе — остаются «остальные».', 'Not in the group — “everyone else” remains.'), who: bi('Система', 'The system') } },
      { id: 'e-u', from: 'q-owner', to: 'result', via: [[235, 328]], label: bi('да → тройка u', 'yes → triad u'), labelAt: 0.45, card: { what: bi('Решает первая тройка.', 'The first triad decides.'), who: bi('Система', 'The system') } },
      { id: 'e-g', from: 'q-group', to: 'result', label: bi('да → тройка g', 'yes → triad g'), card: { what: bi('Решает вторая тройка.', 'The second triad decides.'), who: bi('Система', 'The system') } },
      { id: 'e-o', from: 'q-other', to: 'result', via: [[725, 328]], label: bi('тройка o', 'triad o'), labelAt: 0.45, card: { what: bi('Решает третья тройка.', 'The third triad decides.'), who: bi('Система', 'The system') } },
    ],
  },
  params: [
    { id: 'u', label: bi('владелец (u)', 'owner (u)'), kind: 'choice', default: 'rwx', options: triadOpts, near: 'target' },
    {
      id: 'g',
      label: bi('группа (g)', 'group (g)'),
      kind: 'choice',
      default: 'r-x',
      options: triadOpts,
      near: 'target',
      predict: {
        prompt: bi('Вы меняете права группы. Изменится ли ответ для того, кто спрашивает сейчас?', 'You change the group’s rights. Will the answer change for the person asking now?'),
        options: [
          { id: 'changes', text: bi('Да, ответ станет другим', 'Yes, the answer will be different') },
          { id: 'same', text: bi('Нет: решает не эта тройка или бит тот же', 'No: another triad decides, or the bit is the same') },
        ],
        resolve: (prev, next) => (prev[prev.length - 1]?.states?.result === next[next.length - 1]?.states?.result ? 'same' : 'changes'),
      },
    },
    { id: 'o', label: bi('остальные (o)', 'others (o)'), kind: 'choice', default: '---', options: triadOpts, near: 'target' },
    {
      id: 'who',
      label: bi('Кто', 'Who'),
      kind: 'choice',
      default: 'eve',
      options: Object.entries(WHO).map(([id, w]) => ({ id, label: w.label })),
      near: 'who',
    },
    {
      id: 'action',
      label: bi('Что хочет', 'Wants to'),
      kind: 'choice',
      default: 'read',
      options: Object.entries(ACTIONS).map(([id, a]) => ({ id, label: a.label })),
      near: 'result',
    },
  ],
  breaks: [
    {
      id: 'no-x-srv',
      label: bi('Снять x у /srv для остальных', 'Remove x on /srv for others'),
      remove: ['e-srv'],
      boundary: 'identity',
      predict: {
        prompt: bi('У /srv сняли x для остальных, а у самого файла права в порядке. Прочитает ли eve файл?', 'x was removed from /srv for others, while the file’s own mode is fine. Can eve read the file?'),
        options: [
          { id: 'no', text: bi('Нет: проверка остановится на /srv', 'No: the check stops at /srv') },
          { id: 'yes', text: bi('Да: важны права файла', 'Yes: the file’s mode is what matters') },
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
    const targetName = act.onDir ? '/srv/www' : 'index.html';
    steps.push({
      id: 'ask',
      label: bi('запрос', 'request'),
      caption: fmtb(bi('{w} хочет {a}: `{t}` с режимом {m} ({o}, или `chmod {s}`).', '{w} wants to {a}: `{t}` with mode {m} ({o}, or `chmod {s}`).'), { w: who.name, a: act.verb, t: targetName, m: mode, o: octal, s: symbolicOf(p) }),
      focus: ['who', act.onDir ? 'www' : 'target'],
      values: { who: `${who.name} · uid ${who.uid}`, target: `${mode.replace(/^d/, '-')} anna dev · ${octal}`, www: act.onDir ? `${mode} anna dev · ${octal}` : 'drwxr-x--x anna dev', result: '?' },
      states: { result: 'wait' },
    });
    if (d.triad === 'root') {
      steps.push({
        id: 'root',
        label: 'root',
        caption: d.allowed
          ? bi('root — пользователь с uid 0: для него проверка rwx пропускается целиком, каталоги и тройки не важны.', 'root is the user with uid 0: for root the rwx check is skipped entirely; directories and triads do not matter.')
          : bi('Даже root не запустит файл, у которого нет ни одного бита x: запускать нечего.', 'Even root cannot run a file without a single x bit: there is nothing marked as runnable.'),
        focus: ['who', 'result', 'system'],
        states: { result: d.allowed ? 'ok' : 'err', 'q-owner': 'off', 'q-group': 'off', 'q-other': 'off' },
        values: { result: d.allowed ? 'OK' : 'Permission denied' },
      });
      return steps;
    }
    if (d.stoppedAt === 'srv') {
      steps.push({
        id: 'srv',
        label: '/srv',
        caption: bi('Первый же каталог: у /srv нет x для «остальных» — пройти сквозь него нельзя. До файла проверка не дошла.', 'The very first directory: /srv has no x for “others” — you cannot pass through it. The check never reached the file.'),
        focus: ['e-srv', 'srv'],
        states: { srv: 'err', 'e-srv': 'err', result: 'err' },
        values: { srv: 'drwxr-xr-- root root', result: 'Permission denied' },
        broken: { at: 'srv', message: `cat: /srv/www/index.html: Permission denied`, caption: bi('проверка остановилась на каталоге, а не на файле — это самая частая причина ответа 403 у веб-сервера.', 'the check stopped at a directory, not at the file — the most common reason for a web server’s 403.') },
      });
      return steps;
    }
    steps.push({ id: 'path', label: bi('путь', 'path'), caption: bi('Сначала путь: у /srv и /srv/www есть x для вас — каталоги проходимы.', 'First the path: /srv and /srv/www have x for you — the directories can be passed.'), focus: ['e-srv', 'e-www', 'srv', 'www'], tokens: [{ edge: 'e-srv' }, { edge: 'e-www' }], states: { srv: 'ok', www: 'ok' } });
    steps.push({ id: 'q1', label: 'u?', caption: who.name === 'anna' ? bi('Вы — владелец. Решает первая тройка; на группу и остальных система уже не смотрит.', 'You are the owner. The first triad decides; the system no longer looks at the group or others.') : bi('Вы не владелец — первая тройка не про вас.', 'You are not the owner — the first triad is not about you.'), focus: ['e-owner', 'q-owner'], tokens: [{ edge: 'e-owner' }], states: { 'q-owner': who.name === 'anna' ? 'ok' : 'off' } });
    if (d.triad !== 'u') steps.push({ id: 'q2', label: 'g?', caption: d.triad === 'g' ? bi('Группа файла dev — одна из ваших. Решает вторая тройка.', 'The file’s group dev is one of yours. The second triad decides.') : bi('Группа файла dev — не ваша. Остаётся третья тройка.', 'The file’s group dev is not yours. The third triad remains.'), focus: ['e-group', 'q-group'], tokens: [{ edge: 'e-group' }], states: { 'q-group': d.triad === 'g' ? 'ok' : 'off' } });
    if (d.triad === 'o') steps.push({ id: 'q3', label: 'o', caption: bi('Решает тройка «остальные».', 'The “others” triad decides.'), focus: ['e-other', 'q-other'], tokens: [{ edge: 'e-other' }], states: { 'q-other': 'ok' } });
    const triad = p[d.triad];
    const edge = { u: 'e-u', g: 'e-g', o: 'e-o' }[d.triad];
    steps.push({
      id: 'bit',
      label: act.bit,
      caption: d.allowed
        ? fmt(bi('В тройке `{t}` бит {b} есть — можно.', 'The triad `{t}` has the {b} bit — allowed.'), { t: triad, b: act.bit })
        : fmt(bi('В тройке `{t}` бита {b} нет — отказ, даже если в другой тройке он есть.', 'The triad `{t}` lacks the {b} bit — refused, even if another triad has it.'), { t: triad, b: act.bit }),
      focus: [edge, 'result'],
      tokens: [{ edge, label: triad }],
      states: { result: d.allowed ? 'ok' : 'err', [edge]: d.allowed ? 'ok' : 'err' },
      values: { result: d.allowed ? 'OK' : 'Permission denied' },
    });
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    void prev;
    if (change.kind === 'break') return change.on ? bi('Без x у /srv проверка останавливается на первом каталоге: права самого файла уже не важны.', 'Without x on /srv the check stops at the first directory: the file’s own mode no longer matters.') : bi('x у /srv вернули: путь снова проходим.', 'x is back on /srv: the path can be passed again.');
    const last = next[next.length - 1];
    const ok = last?.states?.result === 'ok';
    const verdict = ok ? bi('можно', 'allowed') : bi('нельзя', 'refused');
    if (change.id === 'u' || change.id === 'g' || change.id === 'o') {
      return fmtb(bi('Режим {a} → {b}: для этого пользователя и действия — {v}.', 'Mode {a} → {b}: for this user and action — {v}.'), { a: octalOf(a as P), b: octalOf(b as P), v: verdict });
    }
    if (change.id === 'who') return fmtb(bi('Теперь спрашивает {w}: проверка выбирает другую тройку — {v}.', 'Now {w} asks: the check picks a different triad — {v}.'), { w: (b as P).who, v: verdict });
    return fmtb(bi('Другое действие — другой бит: {v}.', 'A different action needs a different bit: {v}.'), { v: verdict });
  },
});
