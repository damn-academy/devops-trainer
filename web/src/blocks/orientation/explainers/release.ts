// From source code to a numbered release: a person edits the text of the
// program, the build turns it into what the machine runs, the release gets a
// version number by the rules of semantic versioning (F08, F09).
//
// Reading order: at the start there are only the programmer and the source
// code. The build appears when the text reaches it, then the program file,
// the shelf of releases and finally the users who install the new number.

import { defineModel } from '../../../core/define';
import { bi, type Bi } from '../../../core/i18n';
import type { Step } from '../../../core/types';
import { card, fmtb, startWith } from './kit';

type P = { change: string; lang: string };

const SEMVER = { url: 'https://semver.org/', label: 'semver.org' };
export const BASE = [1, 4, 2] as const;

/** The next version after 1.4.2 for a kind of change (semver 2.0.0 §6–8). */
export function nextVersion(change: string): string {
  const [x, y, z] = BASE;
  if (change === 'breaking') return `${x + 1}.0.0`;
  if (change === 'feature') return `${x}.${y + 1}.0`;
  return `${x}.${y}.${z + 1}`;
}

const KIND: Record<string, Bi> = {
  fix: bi('исправление ошибки', 'a bug fix'),
  feature: bi('новая возможность, при которой всё старое работает как прежде', 'a new feature, the old behaves as before'),
  breaking: bi('несовместимое изменение: старые настройки больше не подходят', 'an incompatible change'),
};
const WHAT: Record<string, Bi> = {
  fix: bi('исправляет ошибку в корзине', 'fixes a bug in the cart'),
  feature: bi('добавляет оплату картой', 'adds card payments'),
  breaking: bi('переименовывает параметр в файле настроек', 'renames a settings parameter'),
};
const ALL = ['dev', 'src', 'build', 'artifact', 'shelf', 'users', 'e-edit', 'e-build', 'e-out', 'e-tag', 'e-upgrade'];

/** The version the last run would release; the prediction reads it even when the release is broken. */
let lastVersion = nextVersion('fix');

export const releaseModel = defineModel<P>({
  id: 'orient.release',
  block: 'orient',
  title: bi('От исходного кода до выпуска с номером', 'From source code to a numbered release'),
  summary: bi(
    'Программист правит текст программы, сборка превращает этот текст в файл, который можно запустить, файл получает номер версии и ложится на полку выпусков, а пользователи по номеру решают, обновляться ли им. Сейчас у пользователей версия 1.4.2.',
    'A programmer edits the program’s text, the build turns it into a runnable file, the file gets a version number and goes onto the shelf of releases, and the users decide by the number whether to upgrade. They now run 1.4.2.',
  ),
  intro: bi(
    'Сейчас на схеме только программист и исходный код. Нажмите «Начать: шаг вперёд», а дальше листайте кнопкой «Шаг вперёд» под схемой. Подсвечен тот, кто работает, облачко говорит, что он делает, а карточка на линии показывает, что передаётся: правка, файл программы или номер выпуска.\n\nКогда пройдёте выпуск до конца, выберите в «Параметрах» другой вид изменения и попробуйте угадать новый номер. Потом включите в блоке «Сломать» опечатку и сравните, где её поймают для компилируемого и для скриптового языка.',
    'Now the diagram shows only the programmer and the source code. Press “Start: step forward”, then “Step forward”. The one working is highlighted, the callout says what it does, the card on the line shows the edit, the program file or the release number.\n\nThen choose another kind of change in “Parameters” and guess the number. Switch on the typo in “Break it” and compare where it is caught for a compiled and a scripting language.',
  ),
  legend: [
    { mark: 'active', text: bi('тот, кто работает сейчас', 'the one working now') },
    { mark: 'say', text: bi('что он делает', 'what it does') },
    { mark: 'token', text: bi('правка, файл программы или номер выпуска', 'the edit, the program file or the number') },
    { mark: 'icon:user', text: bi('люди: программист и пользователи', 'people: the programmer and the users') },
    { mark: 'icon:file', text: bi('исходный код', 'source code') },
    { mark: 'icon:process', text: bi('сборка', 'the build') },
    { mark: 'icon:container', text: bi('готовый файл программы', 'the program file') },
    { mark: 'icon:folder', text: bi('полка выпусков с номерами', 'the shelf of numbered releases') },
    { mark: 'warn', text: bi('обновляться без подготовки опасно', 'upgrading blindly is risky') },
    { mark: 'err', text: bi('здесь нашли ошибку или затёрли выпуск', 'the error was found here, or the release lost') },
  ],
  stopLabel: bi('Выпуск остановился', 'The release stopped'),
  concepts: ['orient.source-build', 'orient.version'],
  diagram: {
    width: 960,
    height: 360,
    nodes: [
      { id: 'dev', label: bi('Программист', 'Programmer'), icon: 'user', work: 'dots', family: 'user', x: 24, y: 56, w: 168, h: 64, card: card(bi('Программист пишет и правит исходный код, то есть текст программы, понятный людям.', 'Writes and edits the source code, a text people understand.'), bi('Это человек из команды разработки.', 'A person in the development team.')) },
      { id: 'src', label: bi('Исходный код', 'Source code'), icon: 'file', sub: 'shop/ · 12 000 lines', family: 'obj', shape: 'doc', x: 232, y: 52, w: 208, h: 72, card: card(bi('Текст программы на языке программирования: Go, Python или Java. Его читают и правят люди, а процессор выполнить его напрямую не может.', 'The program’s text in a programming language; people read it, the processor cannot run it directly.'), bi('Исходный код пишут программисты, строчку за строчкой.', 'Programmers, line by line.'), { see: 'cat src/greet.sh' }) },
      { id: 'build', label: bi('Сборка', 'Build'), icon: 'process', sub: 'go build', family: 'ci-build', x: 480, y: 56, w: 184, h: 64, card: card(bi('Сборка превращает исходный код в то, что запускает машина. Для языка Go это файл с инструкциями процессора, а для Python — архив с кодом и всем, что ему нужно для работы.', 'Turns source code into what the machine runs: for Go processor instructions, for Python an archive.'), bi('Сборку запускает программа-сборщик: по команде человека или сама, на отдельном сервере.', 'A build program, started by a person or a server.'), { see: 'bash build.sh' }) },
      { id: 'artifact', label: bi('Файл программы', 'Program file'), icon: 'container', sub: 'shop', family: 'store', x: 712, y: 56, w: 224, h: 64, card: card(bi('Результат сборки: файл, который можно скопировать на другую машину и запустить там.', 'The build’s result: a file that can be copied elsewhere and run.'), bi('Файл создаёт сборка.', 'The build.')) },
      { id: 'shelf', label: bi('Выпуски', 'Releases'), icon: 'folder', sub: '1.4.1 · 1.4.2', family: 'store', x: 712, y: 232, w: 224, h: 64, card: card(bi('Полка, на которой лежат все выпущенные версии со своими номерами. По номеру можно найти любую из них и вернуть, если новая подвела. Выпуск с номером после выхода никогда не меняют.', 'Every released version with its number; any can be brought back. A numbered release never changes.'), bi('Полку ведёт команда, которая выпускает программу.', 'The team that releases the program.'), { doc: SEMVER }) },
      { id: 'users', label: bi('Пользователи', 'Users'), icon: 'user', sub: 'on 1.4.2', family: 'user', x: 432, y: 232, w: 208, h: 64, card: card(bi('Пользователями называют тех, у кого программа работает. Номер версии подсказывает им, можно ли обновиться без опаски.', 'Those who run the program; the number tells them whether upgrading is safe.'), bi('Это покупатели, коллеги или другие программы.', 'Customers, colleagues, other programs.')) },
    ],
    edges: [
      { id: 'e-edit', from: 'dev', to: 'src', label: bi('правка', 'edit'), card: card(bi('Программист меняет несколько строк исходного кода.', 'The programmer changes a few lines.'), bi('Правку вносит программист.', 'The programmer.')) },
      { id: 'e-build', from: 'src', to: 'build', label: bi('весь текст', 'all the text'), card: card(bi('Сборка читает весь исходный код целиком, а не только изменённые строки.', 'The build reads all of the source code.'), bi('Текст читает сборщик.', 'The builder.')) },
      { id: 'e-out', from: 'build', to: 'artifact', label: bi('файл программы', 'program file'), card: card(bi('Если сборка не нашла ошибок, получается файл программы.', 'If there are no errors, a program file comes out.'), bi('Файл выдаёт сборщик.', 'The builder.')) },
      { id: 'e-tag', from: 'artifact', to: 'shelf', label: bi('номер версии', 'version number'), card: card(bi('Готовой программе дают номер вида 1.4.3 и кладут её на полку выпусков. Сам файл после этого не меняют никогда.', 'The program gets a number like 1.4.3 and goes onto the shelf; the file never changes after that.'), bi('Номер ставит команда.', 'The team.'), { doc: SEMVER }) },
      { id: 'e-upgrade', from: 'shelf', to: 'users', label: bi('обновление', 'upgrade'), card: card(bi('Пользователи ставят новый выпуск. Если с ним что-то не так, можно вернуть выпуск с предыдущим номером.', 'The users install the release; the previous number can be brought back.'), bi('Обновляют сами пользователи или инженеры эксплуатации.', 'The users or operations.')) },
    ],
  },
  params: [
    {
      id: 'change',
      label: bi('Что изменил программист', 'What the programmer changed'),
      group: bi('Изменение', 'The change'),
      kind: 'choice',
      default: 'fix',
      near: 'shelf',
      options: [
        { id: 'fix', label: bi('исправил ошибку в корзине', 'fixed a bug in the cart') },
        { id: 'feature', label: bi('добавил оплату картой, всё старое работает как прежде', 'added card payments, the old works as before') },
        { id: 'breaking', label: bi('переименовал параметр в файле настроек', 'renamed a settings parameter') },
      ],
      predict: {
        prompt: bi('Сейчас у пользователей версия 1.4.2. Вы выбрали другой вид изменения. Какой номер получит новый выпуск?', 'Users run 1.4.2. You chose another kind of change. What number will the new release get?'),
        options: [
          { id: 'patch', text: bi('1.4.3', '1.4.3') },
          { id: 'minor', text: bi('1.5.0', '1.5.0') },
          { id: 'major', text: bi('2.0.0', '2.0.0') },
        ],
        resolve: () => (lastVersion.endsWith('.0.0') ? 'major' : lastVersion.endsWith('.0') ? 'minor' : 'patch'),
      },
    },
    {
      id: 'lang',
      label: bi('На каком языке написана программа', 'Language of the program'),
      group: bi('Язык и сборка', 'Language and build'),
      kind: 'choice',
      default: 'compiled',
      near: 'build',
      options: [
        { id: 'compiled', label: bi('Go: сборка переводит весь код в инструкции процессора', 'Go: compiled to processor instructions') },
        { id: 'script', label: bi('Python: сборка только упаковывает код', 'Python: the build only packs the code') },
      ],
    },
  ],
  breaks: [
    {
      id: 'typo',
      label: bi('Опечатка в коде: pirnt вместо print', 'A typo in the code: pirnt instead of print'),
      remove: ['e-out'],
      predict: {
        prompt: bi('Программист написал pirnt вместо print в редко используемой части программы. Язык программы выбран в «Параметрах». Где обнаружится опечатка?', 'The programmer wrote pirnt instead of print in a rarely used part. The language is set in “Parameters”. Where will the typo show?'),
        options: [
          { id: 'build', text: bi('На сборке: сборка остановится с ошибкой', 'At the build: it stops with an error') },
          { id: 'users', text: bi('У пользователей, когда программа дойдёт до этой строки', 'At the users’, when the program reaches that line') },
        ],
        resolve: (_prev, next) => (next.find((s) => s.broken)?.broken?.at === 'build' ? 'build' : 'users'),
      },
    },
    {
      id: 'no-number',
      label: bi('Выпускать без номеров, под именем «последняя»', 'Release without numbers, as “latest”'),
      remove: ['e-tag'],
      predict: {
        prompt: bi('Выпуски кладут на полку без номеров, под именем «последняя». Пользователь пишет: «в последней версии ошибка». Что дальше?', 'Releases go onto the shelf as “latest”. A user writes: “the latest version has a bug”. What next?'),
        options: [
          { id: 'lost', text: bi('Непонятно, о какой сборке речь и к какой возвращаться', 'Nobody knows which build is meant or which to go back to') },
          { id: 'fine', text: bi('Всё ясно: последняя версия всегда одна', 'All clear: there is always one latest') },
        ],
        resolve: (_p, next) => (next.some((s) => s.broken) ? 'lost' : 'fine'),
      },
    },
  ],
  metrics: [
    { id: 'buildSec', label: bi('время сборки', 'build time'), unit: 's' },
    { id: 'released', label: bi('выпусков на полке', 'releases on the shelf') },
  ],
  run(p, broken): Step[] {
    const v = nextVersion(p.change);
    lastVersion = v;
    const compiled = p.lang !== 'script';
    const buildSec = compiled ? 48 : 12;
    const file = compiled ? `shop-${v}` : `shop-${v}.tar.gz`;
    const typo = broken.has('typo');
    const steps: Step[] = [
      {
        id: 'edit',
        label: bi('правка', 'edit'),
        caption: fmtb(
          bi('Программист {w}. Для этого он меняет несколько строк в исходном коде, то есть в обычном тексте, который пишут и читают люди{t}.', 'The programmer {w}. A few lines of the source code change{t}.'),
          { w: WHAT[p.change] ?? WHAT.fix, t: typo ? bi(', и в одной из них по ошибке пишет pirnt вместо print', '; one line says pirnt instead of print') : bi('', '') },
        ),
        focus: ['dev', 'e-edit'],
        tokens: [{ edge: 'e-edit', label: typo ? 'pirnt(…)' : '+12 −3' }],
        say: { dev: fmtb(bi('Программист {w}.', 'The programmer {w}.'), { w: WHAT[p.change] ?? WHAT.fix }) },
        states: { ...startWith(ALL, 'dev', 'src', 'e-edit'), dev: 'on', src: 'on' },
        values: { src: compiled ? 'shop/*.go · 12 000 lines' : 'shop/*.py · 12 000 lines', shelf: '1.4.1 · 1.4.2', users: 'on 1.4.2', artifact: 'shop', build: compiled ? 'go build' : 'pack' },
        metrics: { buildSec: 0, released: 2 },
      },
      {
        id: 'build',
        label: bi('сборка', 'build'),
        caption: compiled
          ? bi('Сборка читает весь код и переводит его в инструкции процессора. По дороге она проверяет каждое имя в программе: если какого-то имени не существует, сборка дальше не пойдёт.', 'The build reads all the code and translates it into processor instructions, checking every name on the way.')
          : bi('Программу на Python переводят для процессора уже во время работы, поэтому сборка здесь короче: она только укладывает код и всё, что ему нужно, в один архив. Каждое имя при этом не проверяется.', 'A Python program is translated while it runs, so the build only packs the code into an archive; names are not checked.'),
        focus: ['e-build', 'build'],
        reveal: ['build', 'e-build'],
        tokens: [{ edge: 'e-build', label: compiled ? 'shop/*.go' : 'shop/*.py' }],
        say: {
          build: compiled
            ? bi('Сборщик переводит код в инструкции процессора и проверяет каждое имя.', 'The builder translates the code and checks every name.')
            : bi('Сборщик укладывает код в архив, не проверяя имён.', 'The builder packs the code without checking names.'),
        },
        states: { build: 'on' },
        metrics: { buildSec, released: 2 },
      },
    ];
    if (typo && compiled) {
      steps.push({
        id: 'fail',
        label: bi('ошибка', 'error'),
        caption: bi('Сборка нашла имя pirnt, которого в языке нет, и остановилась. Файла программы не появилось, выпуска нет, и пользователи спокойно продолжают работать на версии 1.4.2. Программист увидит сообщение сборки и исправит опечатку.', 'The build found the name pirnt, which does not exist, and stopped. No file, no release; the users stay on 1.4.2.'),
        focus: ['build'],
        say: { build: bi('Сборщик не нашёл имени pirnt и остановил сборку.', 'The builder found no pirnt and stopped.') },
        states: { build: 'err' },
        metrics: { buildSec, released: 2 },
        broken: { at: 'build', message: './greet.go:12:2: undefined: pirnt', caption: bi('на сборке. Ошибку поймали раньше, чем она дошла до пользователей: в этом и польза строгой сборки.', 'at the build: the error was caught before the users; this is what a strict build is good for.') },
      });
      return steps;
    }
    steps.push({
      id: 'artifact',
      label: bi('файл', 'file'),
      caption: fmtb(bi('Получился файл программы {f}. Его можно скопировать на любой сервер и запустить там.', 'Out comes the program file {f}.'), { f: file }),
      focus: ['e-out', 'artifact'],
      reveal: ['artifact', 'e-out'],
      tokens: [{ edge: 'e-out', label: file }],
      say: { artifact: fmtb(bi('Готов файл программы {f}.', 'The program file {f} is ready.'), { f: file }) },
      states: { artifact: 'on', build: 'ok' },
      values: { artifact: file },
      metrics: { buildSec, released: 2 },
    });
    if (broken.has('no-number')) {
      steps.push({
        id: 'latest',
        label: bi('«последняя»', '“latest”'),
        caption: bi('Файл кладут на полку под именем «последняя», поверх прежнего. Через неделю никто не скажет, какая сборка стоит у пользователей, что в ней изменилось и к какой сборке возвращаться, если она подведёт.', 'The file goes onto the shelf as “latest”, over the previous one. A week later nobody can say what the users have.'),
        focus: ['e-tag', 'shelf'],
        reveal: ['shelf', 'e-tag', 'users'],
        tokens: [{ edge: 'e-tag', label: 'latest' }],
        say: { shelf: bi('На полке один файл «последняя», прежние выпуски затёрты.', 'One “latest” file; the old releases are overwritten.') },
        states: { shelf: 'err', users: 'warn' },
        values: { shelf: 'latest', users: 'on latest (?)' },
        metrics: { buildSec, released: 1 },
        broken: { at: 'shelf', message: 'Which build is “latest”? 3 different files were called that this month.', caption: bi('на полке выпусков. Без номера нельзя ни понять, что изменилось, ни вернуть прежнюю сборку.', 'on the shelf: without a number you can neither tell what changed nor bring back the previous one.') },
      });
      return steps;
    }
    steps.push({
      id: 'tag',
      label: v,
      caption: fmtb(bi('Это {k}, поэтому номер 1.4.2 превращается в {v}. Выпуск ложится на полку рядом с прежними и больше никогда не меняется.', 'This is {k}, so 1.4.2 becomes {v}. The release goes onto the shelf and never changes again.'), { k: KIND[p.change] ?? KIND.fix, v }),
      focus: ['e-tag', 'shelf'],
      reveal: ['shelf', 'e-tag'],
      tokens: [{ edge: 'e-tag', label: v }],
      say: { shelf: fmtb(bi('На полке появился выпуск {v} рядом с 1.4.1 и 1.4.2.', 'Release {v} joins 1.4.1 and 1.4.2.'), { v }) },
      states: { shelf: 'on' },
      values: { shelf: `1.4.1 · 1.4.2 · ${v}`, artifact: v },
      metrics: { buildSec, released: 3 },
    });
    if (typo) {
      steps.push({
        id: 'crash',
        label: bi('ошибка у людей', 'error for users'),
        caption: bi('Сборка на Python опечатку не заметила, и выпуск ушёл к пользователям. Ошибку нашли они сами, когда программа дошла до строки с pirnt. Если бы код проверили тестами, ошибку поймали бы до выпуска.', 'The Python build missed the typo; the users found it when the program reached that line. Tests would have caught it.'),
        focus: ['e-upgrade', 'users'],
        reveal: ['users', 'e-upgrade'],
        tokens: [{ edge: 'e-upgrade', label: v }],
        say: { users: bi('У пользователей программа завершается с ошибкой на строке с pirnt.', 'The program fails at the pirnt line.') },
        states: { users: 'err' },
        values: { users: `on ${v}` },
        metrics: { buildSec, released: 3 },
        broken: { at: 'users', message: "NameError: name 'pirnt' is not defined", caption: bi('у пользователей. То, чего не проверила сборка, должны проверить тесты, иначе это сделают пользователи.', 'at the users’: what the build did not check, tests must check; otherwise the users will.') },
      });
      return steps;
    }
    steps.push({
      id: 'upgrade',
      label: bi('обновление', 'upgrade'),
      caption:
        p.change === 'breaking'
          ? bi('Пользователи видят номер 2.0.0 и понимают: прежде чем обновляться, нужно прочитать, что изменилось несовместимо, и поправить свои настройки. Кто не готов, пока остаётся на 1.4.2.', 'The users see 2.0.0: read what broke before upgrading. Whoever is not ready stays on 1.4.2.')
          : fmtb(bi('Пользователи видят номер {v} и обновляются без опаски: по номеру ясно, что всё старое работает как прежде.', 'The users see {v} and upgrade without fear.'), { v }),
      focus: ['e-upgrade', 'users'],
      reveal: ['users', 'e-upgrade'],
      tokens: [{ edge: 'e-upgrade', label: v }],
      say: {
        users:
          p.change === 'breaking'
            ? bi('Пользователи сначала читают, что сломалось, и только потом обновляются.', 'The users read what broke before upgrading.')
            : fmtb(bi('Пользователи ставят {v} без опаски.', 'The users install {v} without fear.'), { v }),
      },
      states: { users: p.change === 'breaking' ? 'warn' : 'ok' },
      values: { users: p.change === 'breaking' ? 'on 1.4.2 → 2.0.0?' : `on ${v}` },
      metrics: { buildSec, released: 3 },
    });
    return steps;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломку убрали: сборка и выпуск снова проходят до конца.', 'The break is removed.');
      if (change.id === 'no-number') return bi('Без номеров выпуски сливаются в одну «последнюю», и уже не понять, что стоит у пользователей и куда возвращаться.', 'Without numbers releases merge into one “latest”.');
      return next.find((s) => s.broken)?.broken?.at === 'build'
        ? bi('Сборка программы на Go проверяет имена, поэтому опечатка остановила её, и до пользователей ничего не дошло.', 'A compiled build checks names: the typo stopped it.')
        : bi('Сборка программы на Python опечатку пропустила, и её нашли пользователи. В таких случаях выручают тесты.', 'The scripting build let the typo through; tests help here.');
    }
    if (change.id === 'change') return fmtb(bi('Теперь это {k}, поэтому номер 1.4.2 сменится на {v}.', 'This is {k}: 1.4.2 → {v}.'), { k: KIND[b.change as string] ?? KIND.fix, v: nextVersion(b.change as string) });
    return b.lang === 'script'
      ? bi('Программа на Python собирается быстрее, потому что сборка только упаковывает код и не проверяет каждое имя.', 'Python builds faster: the build only packs the code.')
      : bi('Программа на Go собирается дольше, зато сборка проверяет каждое имя.', 'Go takes longer to build, but the build checks every name.');
  },
});
