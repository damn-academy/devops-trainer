// From source code to a numbered release: a person edits the text of the
// program, the build turns it into what the machine runs, the release gets a
// version number by the rules of semantic versioning (F08, F09).

import { defineModel } from '../../../core/define';
import { bi, fmt, type Bi } from '../../../core/i18n';
import type { ElementCard, Step } from '../../../core/types';

type P = { change: string; lang: string };

const card = (what: Bi, who: Bi, extra: Partial<ElementCard> = {}): ElementCard => ({ what, who, ...extra });
const SEMVER = { url: 'https://semver.org/', label: 'semver.org' };
export const BASE = [1, 4, 2] as const;

/** The next version after 1.4.2 for a kind of change (semver 2.0.0 §6–8). */
export function nextVersion(change: string): string {
  const [x, y, z] = BASE;
  if (change === 'breaking') return `${x + 1}.0.0`;
  if (change === 'feature') return `${x}.${y + 1}.0`;
  return `${x}.${y}.${z + 1}`;
}

/** fmt whose values may be bilingual. */
function fmtb(b: Bi, vars: Record<string, string | number | Bi>): Bi {
  const fill = (str: string, l: 'ru' | 'en') => str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : typeof vars[k] === 'object' ? (vars[k] as Bi)[l] : String(vars[k])));
  return { ru: fill(b.ru, 'ru'), en: fill(b.en, 'en') };
}

const KIND: Record<string, Bi> = {
  fix: bi('исправление ошибки', 'a bug fix'),
  feature: bi('новая функция, старое работает как прежде', 'a new feature, the old behaves as before'),
  breaking: bi('несовместимое изменение', 'an incompatible change'),
};

export const releaseModel = defineModel<P>({
  id: 'orient.release',
  block: 'orient',
  title: bi('От исходного кода до выпуска с номером', 'From source code to a numbered release'),
  summary: bi(
    'Человек правит текст программы, сборка делает из него то, что запускается, выпуск получает номер. Выберите вид изменения и язык, сделайте опечатку, выпустите без номера.',
    'A person edits the text of the program, the build makes something runnable of it, the release gets a number. Choose the kind of change and the language, make a typo, release without a number.',
  ),
  concepts: ['orient.source-build', 'orient.version'],
  diagram: {
    width: 960,
    height: 336,
    nodes: [
      { id: 'dev', label: bi('Программист', 'Programmer'), family: 'user', x: 24, y: 40, w: 160, h: 56, card: card(bi('Пишет и правит исходный код — текст, понятный людям.', 'Writes and edits the source code, a text people understand.'), bi('Человек в команде разработки.', 'A person in the development team.')) },
      { id: 'src', label: bi('Исходный код', 'Source code'), sub: 'shop/ · 12 000 lines', family: 'obj', shape: 'doc', x: 264, y: 32, w: 184, h: 72, card: card(bi('Текст программы на языке программирования: Go, Python, Java. Его читают и правят люди; процессор напрямую выполнить его не может.', 'The text of the program in a programming language: Go, Python, Java. People read and edit it; the processor cannot carry it out directly.'), bi('Программисты, строчка за строчкой.', 'Programmers, line by line.'), { see: 'cat src/greet.sh' }) },
      { id: 'build', label: bi('Сборка', 'Build'), sub: '', family: 'ci-build', x: 528, y: 40, w: 160, h: 56, card: card(bi('Превращает исходный код в то, что запускает машина: для Go — в файл с инструкциями процессора, для Python — в архив с кодом и всем, что ему нужно.', 'Turns the source code into what the machine runs: for Go, a file of processor instructions; for Python, an archive with the code and everything it needs.'), bi('Программа-сборщик, которую запускает человек или сервер.', 'A build program, started by a person or a server.'), { see: 'bash build.sh' }) },
      { id: 'artifact', label: bi('Программа', 'Program'), sub: 'shop', family: 'store', x: 776, y: 40, w: 160, h: 56, card: card(bi('Результат сборки: файл, который можно скопировать на другую машину и запустить.', 'The result of the build: a file that can be copied to another machine and run.'), bi('Сборка.', 'The build.')) },
      { id: 'shelf', label: bi('Выпуски', 'Releases'), sub: '1.4.1 · 1.4.2', family: 'store', x: 776, y: 216, w: 160, h: 56, card: card(bi('Полка, где лежат все выпущенные версии с номерами. По номеру можно найти любую и вернуть её, если новая подвела.', 'The shelf where every released version lies with its number. By the number you can find any of them and bring it back if a new one fails.'), bi('Команда, которая выпускает программу.', 'The team that releases the program.'), { doc: SEMVER }) },
      { id: 'users', label: bi('Пользователи', 'Users'), sub: 'on 1.4.2', family: 'user', x: 432, y: 216, w: 184, h: 56, card: card(bi('Те, у кого программа работает. Номер версии подсказывает им, можно ли обновляться без опаски.', 'Those who run the program. The version number tells them whether it is safe to upgrade.'), bi('Покупатели, коллеги, другие программы.', 'Customers, colleagues, other programs.')) },
    ],
    edges: [
      { id: 'e-edit', from: 'dev', to: 'src', label: bi('правка', 'edit'), card: card(bi('Программист меняет несколько строк исходного кода.', 'The programmer changes a few lines of the source code.'), bi('Программист.', 'The programmer.')) },
      { id: 'e-build', from: 'src', to: 'build', label: bi('текст', 'text'), card: card(bi('Сборка читает весь исходный код и проверяет, что он написан по правилам языка.', 'The build reads all of the source code and checks that it follows the rules of the language.'), bi('Сборщик.', 'The builder.')) },
      { id: 'e-out', from: 'build', to: 'artifact', label: bi('файл программы', 'program file'), card: card(bi('Если ошибок нет, получается файл программы.', 'If there are no errors, a program file comes out.'), bi('Сборщик.', 'The builder.')) },
      { id: 'e-tag', from: 'artifact', to: 'shelf', label: bi('номер версии', 'version number'), card: card(bi('Готовой программе дают номер вида 1.4.3 и кладут на полку выпусков. Сам файл после этого не меняют никогда.', 'The finished program gets a number like 1.4.3 and goes onto the release shelf. The file itself is never changed after that.'), bi('Команда.', 'The team.'), { doc: SEMVER }) },
      { id: 'e-upgrade', from: 'shelf', to: 'users', label: bi('обновление', 'upgrade'), card: card(bi('Пользователи ставят новый выпуск. Если что-то не так, можно вернуть предыдущий номер.', 'The users install the new release. If something is wrong, the previous number can be brought back.'), bi('Пользователи или эксплуатация.', 'The users or operations.')) },
    ],
  },
  params: [
    {
      id: 'change',
      label: bi('Что изменили', 'What changed'),
      kind: 'choice',
      default: 'fix',
      near: 'shelf',
      options: [
        { id: 'fix', label: bi('исправили ошибку', 'fixed a bug') },
        { id: 'feature', label: bi('добавили функцию', 'added a feature') },
        { id: 'breaking', label: bi('сломали совместимость', 'broke compatibility') },
      ],
      predict: {
        prompt: bi('Как изменится номер 1.4.2 после такого изменения?', 'How does the number 1.4.2 change after such a change?'),
        options: [
          { id: 'patch', text: bi('Вырастет последняя цифра', 'The last digit grows') },
          { id: 'minor', text: bi('Вырастет средняя, последняя станет 0', 'The middle one grows, the last becomes 0') },
          { id: 'major', text: bi('Вырастет первая, остальные станут 0', 'The first one grows, the others become 0') },
        ],
        resolve: (_prev, next) => {
          const v = String(next.find((s) => s.id === 'tag')?.values?.artifact ?? '');
          return v.endsWith('.0.0') ? 'major' : v.endsWith('.0') ? 'minor' : 'patch';
        },
      },
    },
    {
      id: 'lang',
      label: bi('Язык программы', 'Language of the program'),
      kind: 'choice',
      default: 'compiled',
      near: 'build',
      options: [
        { id: 'compiled', label: bi('компилируемый (Go)', 'compiled (Go)') },
        { id: 'script', label: bi('скриптовый (Python)', 'scripting (Python)') },
      ],
    },
  ],
  breaks: [
    {
      id: 'typo',
      label: bi('Опечатка в коде: pirnt вместо print', 'A typo in the code: pirnt instead of print'),
      remove: ['e-out'],
      predict: {
        prompt: bi('Программист написал pirnt вместо print. Где это обнаружится?', 'The programmer wrote pirnt instead of print. Where will it be noticed?'),
        options: [
          { id: 'build', text: bi('На сборке: она остановится с ошибкой', 'At the build: it stops with an error') },
          { id: 'users', text: bi('У пользователей, когда программа дойдёт до этой строчки', 'At the users’, when the program reaches that line') },
        ],
        resolve: (_prev, next) => (next.find((s) => s.broken)?.broken?.at === 'build' ? 'build' : 'users'),
      },
    },
    {
      id: 'no-number',
      label: bi('Выпускать без номеров, «последняя версия»', 'Release without numbers, as “the latest”'),
      remove: ['e-tag'],
      predict: {
        prompt: bi('Выпуски лежат без номеров, под именем «последняя». Пользователь пишет: «в последней версии ошибка». Что дальше?', 'Releases lie without numbers, named “latest”. A user writes: “the latest version has a bug”. What next?'),
        options: [
          { id: 'lost', text: bi('Непонятно, о какой сборке речь и к какой возвращаться', 'Nobody knows which build is meant or which to go back to') },
          { id: 'fine', text: bi('Ничего страшного: последняя всегда одна', 'Nothing bad: there is always one latest') },
        ],
        resolve: () => 'lost',
      },
    },
  ],
  metrics: [
    { id: 'buildSec', label: bi('время сборки', 'build time'), unit: 's' },
    { id: 'released', label: bi('выпусков на полке', 'releases on the shelf') },
  ],
  run(p, broken): Step[] {
    const v = nextVersion(p.change);
    const compiled = p.lang !== 'script';
    const buildSec = compiled ? 48 : 12;
    const file = compiled ? `shop-${v}` : `shop-${v}.tar.gz`;
    const steps: Step[] = [
      {
        id: 'edit',
        label: bi('правка', 'edit'),
        caption: fmtb(bi('Программист правит исходный код: {k}.', 'The programmer edits the source code: {k}.'), { k: KIND[p.change] ?? KIND.fix }),
        focus: ['dev', 'e-edit', 'src'],
        tokens: [{ edge: 'e-edit', label: broken.has('typo') ? 'pirnt(…)' : '+12 −3' }],
        states: { dev: 'on', src: 'on' },
        values: { src: compiled ? 'shop/*.go · 12 000 lines' : 'shop/*.py · 12 000 lines', shelf: '1.4.1 · 1.4.2', users: 'on 1.4.2', artifact: 'shop' },
        metrics: { buildSec: 0, released: 2 },
      },
      {
        id: 'build',
        label: bi('сборка', 'build'),
        caption: compiled
          ? bi('Сборка читает весь код и переводит его в инструкции процессора. По дороге она проверяет каждое имя: если чего-то не существует, дальше она не пойдёт.', 'The build reads all the code and translates it into processor instructions. On the way it checks every name: if something does not exist, it goes no further.')
          : bi('Скриптовый язык процессору переводят прямо во время работы, поэтому сборка здесь короче: она укладывает код и всё, что ему нужно, в один архив. Каждое имя она не проверяет.', 'A scripting language is translated for the processor while it runs, so the build is shorter here: it packs the code and everything it needs into one archive. It does not check every name.'),
        focus: ['src', 'e-build', 'build'],
        tokens: [{ edge: 'e-build' }],
        states: { build: 'on' },
        values: { build: compiled ? 'go build' : 'pack' },
        metrics: { buildSec, released: 2 },
      },
    ];
    if (broken.has('typo') && compiled) {
      steps.push({
        id: 'fail',
        label: bi('ошибка', 'error'),
        caption: bi('Сборка нашла имя pirnt, которого нет, и остановилась. Файла программы нет, выпуска нет, пользователи спокойно работают на 1.4.2.', 'The build found the name pirnt, which does not exist, and stopped. There is no program file, no release, and the users go on working on 1.4.2.'),
        focus: ['build'],
        states: { build: 'err', artifact: 'off' },
        metrics: { buildSec, released: 2 },
        broken: { at: 'build', message: './greet.go:12:2: undefined: pirnt', caption: bi('ошибку поймали до пользователей: в этом польза строгой сборки.', 'the error was caught before the users: this is what a strict build is good for.') },
      });
      return steps;
    }
    steps.push({
      id: 'artifact',
      label: bi('файл', 'file'),
      caption: fmt(bi('Получился файл программы {f}: его можно скопировать на любой сервер и запустить.', 'Out comes the program file {f}: it can be copied to any server and run.'), { f: file }),
      focus: ['e-out', 'artifact'],
      tokens: [{ edge: 'e-out', label: file }],
      states: { artifact: 'on', build: 'ok' },
      values: { artifact: file },
      metrics: { buildSec, released: 2 },
    });
    if (broken.has('no-number')) {
      steps.push({
        id: 'latest',
        label: bi('«последняя»', '“latest”'),
        caption: bi('Файл кладут на полку под именем «последняя», поверх прежней. Через неделю никто не скажет, что именно стоит у пользователей.', 'The file goes onto the shelf as “latest”, on top of the previous one. A week later nobody can say what exactly the users have.'),
        focus: ['shelf', 'users'],
        states: { shelf: 'err', users: 'warn' },
        values: { shelf: 'latest', users: 'on latest (?)' },
        metrics: { buildSec, released: 1 },
        broken: { at: 'shelf', message: 'Which build is “latest”? 3 different files were called that this month.', caption: bi('без номера нельзя ни понять, что изменилось, ни вернуть прежнее.', 'without a number you can neither tell what changed nor bring back the previous one.') },
      });
      return steps;
    }
    steps.push(
      {
        id: 'tag',
        label: v,
        caption: fmtb(bi('Это {k}, поэтому 1.4.2 становится {v}. Выпуск ложится на полку рядом с прежними и больше не меняется.', 'This is {k}, so 1.4.2 becomes {v}. The release goes onto the shelf next to the previous ones and never changes again.'), { k: KIND[p.change] ?? KIND.fix, v }),
        focus: ['e-tag', 'shelf'],
        tokens: [{ edge: 'e-tag', label: v }],
        states: { shelf: 'on' },
        values: { shelf: `1.4.1 · 1.4.2 · ${v}`, artifact: v },
        metrics: { buildSec, released: 3 },
      },
    );
    if (broken.has('typo')) {
      steps.push({
        id: 'crash',
        label: bi('ошибка у людей', 'error for users'),
        caption: bi('Скриптовая сборка опечатку не заметила. Её нашли пользователи, когда программа дошла до этой строчки.', 'The scripting build did not notice the typo. The users found it when the program reached that line.'),
        focus: ['e-upgrade', 'users'],
        tokens: [{ edge: 'e-upgrade', label: v }],
        states: { users: 'err' },
        values: { users: `on ${v}` },
        metrics: { buildSec, released: 3 },
        broken: { at: 'users', message: "NameError: name 'pirnt' is not defined", caption: bi('то, что не проверила сборка, должны проверить тесты, иначе проверят пользователи.', 'what the build did not check, tests must check; otherwise the users will.') },
      });
      return steps;
    }
    steps.push({
      id: 'upgrade',
      label: bi('обновление', 'upgrade'),
      caption:
        p.change === 'breaking'
          ? fmt(bi('Пользователи видят 2.0.0 и понимают: прежде чем обновляться, надо читать, что сломано. Кто не готов, остаётся на 1.4.2.', 'The users see 2.0.0 and understand: before upgrading, read what broke. Whoever is not ready stays on 1.4.2.'), { v })
          : fmt(bi('Пользователи видят {v} и обновляются без опаски: по номеру ясно, что старое работает как прежде.', 'The users see {v} and upgrade without fear: the number makes it clear that the old behaves as before.'), { v }),
      focus: ['e-upgrade', 'users'],
      tokens: [{ edge: 'e-upgrade', label: v }],
      states: { users: p.change === 'breaking' ? 'warn' : 'ok' },
      values: { users: p.change === 'breaking' ? 'on 1.4.2 → 2.0.0?' : `on ${v}` },
      metrics: { buildSec, released: 3 },
    });
    return steps;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломка убрана: сборка и выпуск снова идут до конца.', 'The break is removed: the build and the release go to the end again.');
      if (change.id === 'no-number') return bi('Без номера выпуски сливаются в одну «последнюю»: не понять, что у пользователей и куда возвращаться.', 'Without numbers releases merge into one “latest”: you cannot tell what the users have or where to go back.');
      return next.find((s) => s.broken)?.broken?.at === 'build'
        ? bi('Компилируемый язык проверяет имена на сборке: опечатка остановила её, и до пользователей ничего не дошло.', 'A compiled language checks names at the build: the typo stopped it, and nothing reached the users.')
        : bi('Скриптовая сборка опечатку пропустила: её нашли пользователи. Здесь выручают тесты.', 'The scripting build let the typo through: the users found it. This is where tests help.');
    }
    if (change.id === 'change') return fmtb(bi('Это {k}: номер 1.4.2 → {v}.', 'This is {k}: the number goes 1.4.2 → {v}.'), { k: KIND[b.change as string] ?? KIND.fix, v: nextVersion(b.change as string) });
    return b.lang === 'script'
      ? bi('Для скриптового языка сборка короче: она упаковывает код, но не проверяет каждое имя.', 'For a scripting language the build is shorter: it packs the code but does not check every name.')
      : bi('Компилируемый язык собирается дольше, зато сборка проверяет каждое имя.', 'A compiled language takes longer to build, but the build checks every name.');
  },
});
