// Process explainers of the Git and CI/CD blocks (06 §2.3 E-GIT, §3.4 E-CI).
// Small deterministic models: knobs recompute the run, breaks stop it where
// the real tool stops, with the real message.
//
// Reading order (as in the gold explainers linux.perm and net.url): the
// picture starts with two or three blocks and is built step by step; every
// step has one acting block that says in a callout what it does, and the
// thing it hands on travels along a line as a labelled card.

import { defineModel } from '../../core/define';
import { bi, fmt, pluralRu, t, type Bi } from '../../core/i18n';
import type { DocRef, ElementCard, ElementState, Step } from '../../core/types';
import { objectId } from './git/sha1';

/** A number of seconds in the accusative ("21 секунду", "52 секунды", "90 секунд") and in English. */
export const sec = (n: number): Bi => ({ ru: `${n} ${pluralRu(n, ['секунду', 'секунды', 'секунд'])}`, en: `${n} ${n === 1 ? 'second' : 'seconds'}` });
/** fmt whose values may differ by language. */
export function fmtBi(b: Bi, vars: Record<string, string | number | Bi>): Bi {
  const pick = (l: 'ru' | 'en') => Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, typeof v === 'object' ? v[l] : v]));
  return { ru: fmt(b, pick('ru')).ru, en: fmt(b, pick('en')).en };
}

export const card = (what: Bi, who: Bi, see?: string, doc?: DocRef): ElementCard => ({ what, who, see, doc });
const short = (oid: string) => oid.slice(0, 7);
const last = (s: Step[]) => s[s.length - 1]?.metrics ?? {};

/** fmt with values that may themselves be bilingual: {v} takes v.ru in Russian and v.en in English. */
export function fmtb(b: Bi, vars: Record<string, string | number | Bi>): Bi {
  const fill = (s: string, lang: 'ru' | 'en') =>
    s.replace(/\{(\w+)\}/g, (m, k) => {
      const v = vars[k];
      if (v === undefined) return m;
      return typeof v === 'object' ? v[lang] : String(v);
    });
  return { ru: fill(b.ru, 'ru'), en: fill(b.en, 'en') };
}

/** The picture starts empty except for the given elements. */
export const hiddenExcept = (all: string[], ...shown: string[]): Record<string, ElementState> =>
  Object.fromEntries(all.filter((id) => !shown.includes(id)).map((id) => [id, 'hidden' as ElementState]));

// ── E-GIT: what git commit and git push do ──────────────────────────────────

type GitP = { files: number; editAfterAdd: boolean };

const OLD = '<h1>Hello</h1>\n';
const NEW = '<h1>Hello, team</h1>\n';
const blobOld = objectId('blob', OLD);
const blobNew = objectId('blob', NEW);

export function gitCounts(p: GitP): { newObjects: number; reused: number } {
  // One changed file: a new blob, a new root tree and a new commit; the other files reuse their blobs.
  return { newObjects: 3, reused: Math.max(0, p.files - 1) };
}

const GIT_ALL = ['file', 'index', 'blob', 'tree', 'commit', 'parent', 'main', 'head', 'forge', 'e-add', 'e-blob', 'e-tree', 'e-snap', 'e-parent', 'e-ref', 'e-head', 'e-push'];
const objectsRu = (n: number) => (n === 1 ? 'объект' : n < 5 ? 'объекта' : 'объектов');

export const gitModel = defineModel<GitP>({
  id: 'git.commit-push',
  frame: 'visible',
  block: 'git-yaml',
  title: bi('Что делают git add, git commit и git push', 'What git add, git commit and git push do'),
  summary: bi(
    'Вы поменяли один файл и хотите, чтобы правку увидела команда. Команда `git add` сохраняет содержимое файла как объект и записывает его в индекс, команда `git commit` собирает из индекса снимок проекта и передвигает ветку на новый коммит, а команда `git push` отправляет на сервер команды только те объекты, которых там ещё нет.',
    'You changed one file and want the team to see the edit. `git add` stores the file content as an object and records it in the index, `git commit` builds a snapshot of the project from the index and moves the branch to the new commit, and `git push` sends the team server only the objects it does not have yet.',
  ),
  intro: bi(
    'Сейчас на схеме только файл, который вы поправили, и индекс. А дальше листайте кнопкой «Шаг вперёд». На каждом шаге подсвечен тот блок, который работает, облачко рядом с ним говорит, что он делает, а карточка на линии показывает, что передаётся дальше.\n\nКогда дойдёте до сервера, увеличьте в «Параметрах» число файлов в проекте и посмотрите на счётчики под схемой.',
    'For now the diagram shows only the file you edited and the index. Then go on with “Step forward”. At every step the working block is highlighted, the callout next to it says what it does, and the card on the line shows what is handed on.\n\nOnce you reach the server, raise the number of files in “Parameters” and watch the counters under the diagram.',
  ),
  legend: [
    { mark: 'active', text: bi('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: bi('что этот блок делает', 'what that block does') },
    { mark: 'token', text: bi('что передаётся дальше, например хэш объекта, снимок или коммиты', 'what is handed on, such as an object hash, a snapshot or commits') },
    { mark: 'icon:file', text: bi('файл или содержимое файла (blob)', 'a file or a file’s content (blob)') },
    { mark: 'icon:database', text: bi('индекс, черновик следующего коммита', 'the index, the draft of the next commit') },
    { mark: 'icon:folder', text: bi('снимок каталога (tree)', 'a snapshot of a directory (tree)') },
    { mark: 'icon:disk', text: bi('коммит, сохранённый снимок проекта', 'a commit, a saved snapshot of the project') },
    { mark: 'icon:server', text: bi('сервер команды (forge)', 'the team server (forge)') },
    { mark: 'dashed', text: bi('ссылка на родительский коммит', 'a link to the parent commit') },
    { mark: 'err', text: bi('здесь Git или сервер отказали', 'Git or the server refused here') },
  ],
  stopLabel: bi('Git остановился', 'Git stopped'),
  concepts: ['git.commit', 'git.index', 'git.branch'],
  diagram: {
    width: 960,
    height: 480,
    nodes: [
      { id: 'file', label: 'index.html', icon: 'file', work: 'dots', sub: { ru: 'рабочая копия', en: 'working tree' }, family: 'ci-source', shape: 'doc', x: 24, y: 40, w: 184, h: 64, card: card(bi('Обычный файл в рабочем каталоге. Его меняет редактор, а Git узнаёт о правке только тогда, когда сравнивает файл с версией в индексе.', 'An ordinary file in the working directory. An editor changes it; Git learns about the change only by comparing the file with the index.'), bi('Файл правите вы в редакторе.', 'You, with an editor.'), 'git status', { page: 'man/git-status.1', anchor: 'DESCRIPTION' }) },
      { id: 'index', label: bi('индекс', 'index'), icon: 'database', sub: `index.html → ${short(blobOld)}`, family: 'ci-build', shape: 'buffer', x: 272, y: 40, w: 208, h: 64, card: card(bi('Список пар «путь файла и хэш его содержимого», из которого будет собран следующий коммит. Команда `git add` записывает сюда текущее содержимое файла.', 'A list of "path → blob" for the next commit. `git add` puts the current content of a file here.'), bi('Индекс меняют команды `git add`, `git restore --staged` и `git commit -a`.', 'git add, git restore --staged, git commit -a.'), 'git ls-files -s', { page: 'man/git-add.1', anchor: 'DESCRIPTION', line: 'snapshot' }) },
      { id: 'blob', label: 'blob', icon: 'file', sub: short(blobNew), family: 'store', shape: 'box', x: 272, y: 176, w: 208, h: 56, card: card(bi('Содержимое файла, сохранённое как объект. Имя объекта вычисляется из содержимого (это хэш SHA-1), поэтому одинаковые файлы хранятся одним объектом, а новая правка даёт новый объект, и старый при этом остаётся на месте.', 'The file content as an object. Its name is the SHA-1 of the content: equal files share one blob, a new edit makes a new blob and the old one stays.'), bi('Объект создаёт команда `git add`.', 'git add (git hash-object -w).'), `git cat-file -p ${short(blobNew)}`, { page: 'man/git-cat-file.1', anchor: 'OPTIONS' }) },
      { id: 'tree', label: 'tree', icon: 'folder', sub: '', family: 'store', shape: 'box', x: 544, y: 176, w: 184, h: 56, card: card(bi('Снимок каталога, то есть список имён файлов вместе с хэшами их содержимого. Файлы, которые вы не меняли, ссылаются на те же объекты, что и в прошлом коммите, и заново не копируются.', 'A snapshot of a directory: file names and the hashes of their blobs (and nested trees). Unchanged files point to the same blobs as before.'), bi('Снимок собирает команда `git commit` из индекса.', 'git commit, from the index.'), 'git cat-file -p HEAD^{tree}') },
      { id: 'commit', label: 'commit', icon: 'disk', sub: '', family: 'ci-source', shape: 'doc', x: 544, y: 40, w: 184, h: 64, card: card(bi('Объект коммита хранит ссылку на снимок, ссылку на родителя, автора, время и сообщение. Хэш коммита вычисляется из всего этого, поэтому подменить историю незаметно нельзя.', 'An object: tree, parent, author, time, message. The commit hash depends on all of it, so history cannot be changed quietly.'), bi('Коммит записывает команда `git commit`.', 'git commit.'), 'git cat-file -p HEAD', { page: 'man/git-commit.1', anchor: 'DESCRIPTION' }) },
      { id: 'parent', label: bi('прошлый коммит', 'previous commit'), icon: 'disk', sub: '', family: 'neutral', shape: 'doc', x: 544, y: 300, w: 184, h: 56, card: card(bi('Коммит, на который указывала ветка до нового коммита. Цепочка таких ссылок от коммита к родителю и составляет историю проекта.', 'The commit the branch pointed to before. The chain of parents is the history.'), bi('Этот коммит записала предыдущая команда `git commit`.', 'The previous git commit.'), 'git log --oneline') },
      { id: 'main', label: 'main', icon: 'file', sub: 'refs/heads/main', family: 'ci-test', shape: 'pill', x: 792, y: 40, w: 152, h: 48, card: card(bi('Ветка main хранится как файл `.git/refs/heads/main`, в котором записан хэш одного коммита. Новый коммит переписывает этот файл, и ветка передвигается вперёд.', 'A branch is the file .git/refs/heads/main with one hash. A new commit rewrites that file.'), bi('Ветку передвигают команды `git commit`, `git merge` и `git reset`.', 'git commit, git merge, git reset move it.'), 'cat .git/refs/heads/main', { page: 'man/git-branch.1', anchor: 'DESCRIPTION' }) },
      { id: 'head', label: 'HEAD', icon: 'file', sub: 'refs/heads/main', family: 'ci-test', shape: 'pill', x: 792, y: 236, w: 152, h: 48, card: card(bi('Указатель HEAD показывает, на какой ветке вы сейчас стоите. Поэтому Git знает, какую ветку передвинуть после коммита.', '"You are here": a pointer to the current branch. git switch rewrites HEAD.'), bi('HEAD переписывают команды `git switch` и `git checkout`.', 'git switch, git checkout.'), 'cat .git/HEAD', { page: 'man/git-switch.1', anchor: 'DESCRIPTION' }) },
      { id: 'forge', label: 'forge.edu', icon: 'server', work: 'spin', sub: 'team/site.git', family: 'cp', shape: 'rack', x: 792, y: 368, w: 152, h: 96, card: card(bi('Удалённый репозиторий на сервере команды. В нём такой же набор объектов и веток, как у вас, и туда отправляют работу все участники команды.', 'The remote repository: the same set of objects and branches, on the team server.'), bi('Репозиторий на сервере создаёт команда, а наполняет его команда `git push`.', 'The team creates it; git push fills it.'), 'git remote -v', { page: 'man/git-push.1', anchor: 'DESCRIPTION' }) },
    ],
    edges: [
      { id: 'e-add', from: 'file', to: 'index', label: 'git add', card: card(bi('Git сохраняет содержимое файла как объект и записывает его хэш в индекс под путём файла.', 'The file content becomes a blob and its hash is written into the index under the file path.'), bi('Команду запускаете вы.', 'You.'), 'git add index.html', { page: 'man/git-add.1', anchor: 'DESCRIPTION' }) },
      { id: 'e-blob', from: 'index', to: 'blob', label: bi('хэш содержимого', 'content hash'), card: card(bi('Индекс хранит не сам текст файла, а ссылку на объект с этим текстом.', 'The index holds not the text but a reference to the blob.'), bi('Ссылку записывает команда `git add`.', 'git add.'), 'git ls-files -s') },
      { id: 'e-tree', from: 'blob', to: 'tree', label: bi('имя файла и хэш', 'name → blob'), card: card(bi('Снимок перечисляет все файлы проекта вместе с хэшами их содержимого.', 'The tree lists the files of the snapshot with their blob hashes.'), bi('Снимок собирает команда `git commit`.', 'git commit.')) },
      { id: 'e-snap', from: 'tree', to: 'commit', label: bi('ссылка на снимок', 'tree <oid>'), card: card(bi('Коммит указывает на один снимок корневого каталога, то есть на весь проект целиком.', 'A commit points to one root tree: the whole project snapshot.'), bi('Ссылку записывает команда `git commit`.', 'git commit.'), 'git cat-file -p HEAD') },
      { id: 'e-parent', from: 'commit', to: 'parent', via: [[512, 72], [512, 328]], label: bi('ссылка на родителя', 'parent <oid>'), labelAt: 0.3, dashed: true, card: card(bi('Каждый коммит ссылается на родителя, поэтому от последнего коммита можно пройти назад по всей истории.', 'A link to the parent: history is a chain of commits back in time.'), bi('Команда `git commit` берёт родителя из ветки, на которую указывает HEAD.', 'git commit takes it from HEAD.'), 'git log --oneline') },
      { id: 'e-ref', from: 'main', to: 'commit', label: bi('хэш последнего коммита', '41 bytes: a hash'), card: card(bi('Файл ветки хранит только хэш последнего коммита, всего 41 байт.', 'A branch just stores the hash of its last commit.'), bi('Файл ветки переписывает команда `git commit`.', 'git commit rewrites the branch file.'), 'cat .git/refs/heads/main') },
      { id: 'e-head', from: 'head', to: 'main', labelAt: 0.25, label: bi('текущая ветка', 'ref: refs/heads/main'), card: card(bi('HEAD указывает на ветку, а не на коммит, и поэтому новый коммит передвигает эту ветку.', 'HEAD points to the branch, not to a commit: that is why a new commit moves the branch.'), bi('Ссылку переписывает команда `git switch`.', 'git switch.'), 'cat .git/HEAD') },
      { id: 'e-push', from: 'commit', to: 'forge', via: [[760, 72], [760, 416]], label: bi('отправка по HTTPS', 'git push (HTTPS)'), labelAt: 0.5, card: card(bi('Команда `git push` отправляет объекты, которых нет на сервере, и просит передвинуть там ветку. Сервер соглашается, только если новый коммит продолжает его историю.', 'Push sends the objects the server lacks and asks it to move its branch. The server agrees only if the new commit continues its history.'), bi('Команду запускаете вы.', 'You: git push.'), 'git push origin main', { page: 'man/git-push.1', anchor: 'DESCRIPTION', line: 'fast-forward' }) },
    ],
  },
  params: [
    {
      id: 'files',
      label: bi('Сколько файлов в проекте', 'Files in the project'),
      group: bi('Проект', 'The project'),
      kind: 'range',
      min: 1,
      max: 20,
      step: 1,
      default: 6,
      near: 'tree',
      predict: {
        prompt: bi('В проекте теперь 20 файлов, а изменён по-прежнему один. Сколько новых объектов создаст коммит?', 'The project now has 20 files and still one changed. How many new objects will the commit create?'),
        options: [
          { id: 'three', text: bi('Три объекта, то есть новое содержимое файла, новый снимок и сам коммит', 'Three: a blob, a tree and a commit') },
          { id: 'many', text: bi('Двадцать два объекта, потому что Git сохраняет каждый файл заново и добавляет снимок и коммит', 'Twenty-two: a blob per file plus a tree and a commit') },
        ],
        resolve: (_p, n) => ((last(n).objects ?? 0) === 3 ? 'three' : 'many'),
      },
    },
    {
      id: 'editAfterAdd',
      label: bi('Файл изменили ещё раз после git add', 'Edit the file after git add'),
      group: bi('Как вы работаете', 'How you work'),
      kind: 'toggle',
      default: false,
      near: 'index',
      predict: {
        prompt: bi('Файл добавили в индекс командой git add, а потом изменили ещё раз и сразу выполнили git commit. Какая версия файла попадёт в коммит?', 'The file was added to the index and then edited again. Which version goes into the commit?'),
        options: [
          { id: 'old', text: bi('В коммит попадёт версия, которая была в файле в момент git add', 'The one at the moment of git add') },
          { id: 'new', text: bi('В коммит попадёт последняя версия из рабочего каталога', 'The latest one, from the working directory') },
        ],
        resolve: (_p, n) => (n.some((s) => s.id === 'edit2') ? 'old' : 'new'),
      },
    },
  ],
  breaks: [
    {
      id: 'empty-message',
      label: bi('Коммит запускают с пустым сообщением', 'A commit without a message'),
      remove: ['e-snap'],
      predict: {
        prompt: bi('Вы запускаете git commit, но оставляете сообщение пустым. Что сделает Git?', 'The commit message is empty. What does Git do?'),
        options: [
          { id: 'abort', text: bi('Git откажется создавать коммит', 'Refuses to create the commit') },
          { id: 'auto', text: bi('Git сам придумает сообщение и запишет коммит', 'Fills in a message itself') },
        ],
        resolve: () => 'abort',
      },
    },
    {
      id: 'remote-ahead',
      label: bi('Коллега уже отправил на сервер свой коммит в main', 'The forge already has someone else’s commit'),
      remove: ['e-push'],
      predict: {
        prompt: bi('Пока вы работали, коллега отправил свой коммит в ветку main на сервере, а вы его ещё не забрали. Что ответит сервер на ваш git push?', 'While you worked, a colleague pushed a commit to main. What does the forge answer to your git push?'),
        options: [
          { id: 'reject', text: bi('Сервер откажет и попросит сначала забрать коммит коллеги', 'Rejects the push: fetch their commit first') },
          { id: 'overwrite', text: bi('Сервер примет ваш коммит, а коммит коллеги пропадёт', 'Accepts it and the colleague’s commit is lost') },
          { id: 'merge', text: bi('Сервер сам сольёт оба коммита в один', 'Merges both commits by itself') },
        ],
        resolve: () => 'reject',
      },
    },
  ],
  metrics: [
    { id: 'objects', label: bi('число новых объектов', 'new objects') },
    { id: 'reused', label: bi('число файлов, взятых из прошлого коммита', 'blobs reused as is') },
    { id: 'sent', label: bi('число отправленных объектов', 'objects sent') },
  ],
  run(p, broken) {
    const c = gitCounts(p);
    const commitOid = objectId('commit', `tree 0\nparent 0\n\nSay hello to the team\n${p.files}`);
    const m0 = { objects: 0, reused: 0, sent: 0 };
    const steps: Step[] = [
      {
        id: 'edit',
        label: bi('правка', 'edit'),
        caption: bi('Вы меняете заголовок в файле index.html. Для Git это пока обычный файл, который отличается от версии в индексе, и ничего в истории не изменилось.', 'You edit index.html in an editor. For Git it is just a file that differs from the index.'),
        focus: ['file'],
        say: { file: bi('Вы поменяли заголовок, и теперь файл отличается от версии, записанной в индексе.', 'You changed the heading, and the file now differs from the version in the index.') },
        states: { ...hiddenExcept(GIT_ALL, 'file', 'index'), file: 'warn' },
        values: { file: t(bi('изменён', 'modified')) },
        metrics: m0,
      },
      {
        id: 'add',
        label: 'git add',
        caption: fmt(bi('Команда `git add` вычисляет хэш содержимого файла и сохраняет его как объект {b}. Старый объект {o} никуда не делся, потому что он по-прежнему нужен прошлому коммиту.', 'git add hashes the content and stores blob {b}. The old blob {o} is still there.'), { b: short(blobNew), o: short(blobOld) }),
        focus: ['e-add', 'index', 'e-blob', 'blob'],
        reveal: ['e-add', 'blob', 'e-blob'],
        tokens: [{ edge: 'e-add', label: short(blobNew) }],
        say: { index: fmt(bi('Git записывает в индекс, что файлу index.html теперь соответствует новый объект {b}.', 'Git records in the index that index.html now maps to the new blob {b}.'), { b: short(blobNew) }) },
        states: { blob: 'on' },
        values: { index: `index.html → ${short(blobNew)}` },
        fill: { index: 0.5 },
        metrics: { ...m0, objects: 1 },
      },
    ];
    if (p.editAfterAdd)
      steps.push({
        id: 'edit2',
        label: bi('ещё правка', 'edit again'),
        caption: bi('Вы меняете файл ещё раз, но в индексе остался объект с прошлой версией. Команда `git status` теперь покажет файл дважды: в разделе «Changes to be committed» и в разделе «Changes not staged for commit».', 'You edit the file again. The index still holds the blob of the previous version: git status shows the file both under "Changes to be committed" and "Changes not staged".'),
        focus: ['file', 'index'],
        say: { file: bi('Вы снова изменили файл, но `git add` больше не запускали, и эта правка в индекс не попала.', 'You edited the file again, but this edit is not in the index because you did not run git add again.') },
        states: { file: 'warn', index: 'warn' },
        values: { file: t(bi('снова изменён', 'modified again')) },
        metrics: { ...m0, objects: 1 },
      });
    if (broken.has('empty-message')) {
      steps.push({
        id: 'abort',
        label: 'git commit',
        caption: bi('Сообщение коммита пустое, поэтому Git отказывается записывать коммит. Индекс и сохранённый объект остаются такими, какими были, и вы можете повторить команду с сообщением.', 'The message is empty: Git refuses to write the commit. The index and the blob stay as they were.'),
        focus: ['commit'],
        reveal: ['commit'],
        say: { commit: bi('Git видит, что сообщение пустое, и прерывает коммит, потому что без объяснения изменение потом никто не поймёт.', 'Git sees the empty message and aborts the commit, because nobody would understand the change later without an explanation.') },
        states: { commit: 'err' },
        metrics: { objects: 1, reused: c.reused, sent: 0 },
        broken: { at: 'commit', message: 'Aborting commit due to empty commit message.', caption: bi('Коммиту нужно сообщение, потому что оно объясняет изменение тем, кто будет читать историю. Повторите команду с флагом -m "…".', 'a commit needs a message: it explains the change to whoever reads the history.') },
      });
      return steps;
    }
    steps.push(
      {
        id: 'tree',
        label: 'tree',
        caption: fmt(bi('Команда `git commit` собирает из индекса снимок проекта. В нём {n} файлов, и {r} из них ссылаются на прежние объекты, поэтому их содержимое заново не копируется.', 'git commit builds a tree from the index: {n} files, {r} of them point to their old blobs; nothing is copied.'), { n: p.files, r: c.reused }),
        focus: ['e-tree', 'tree'],
        reveal: ['tree', 'e-tree'],
        tokens: [{ edge: 'e-tree', label: short(blobNew) }],
        say: { tree: fmt(bi('Git записывает снимок каталога: {n} имён файлов и хэши их содержимого, из которых новый только у index.html.', 'Git writes the directory snapshot: {n} file names with their content hashes, and only index.html has a new one.'), { n: p.files }) },
        states: { tree: 'on' },
        values: { tree: t(bi(`файлов: ${p.files}`, `${p.files} entries`)) },
        metrics: { objects: 2, reused: c.reused, sent: 0 },
      },
      {
        id: 'commit',
        label: 'commit',
        caption: bi('Коммит записывает ссылку на снимок, ссылку на прошлый коммит, автора, время и сообщение. Хэш коммита становится именем этого состояния проекта.', 'The commit records the tree, the parent, the author, the time and the message. Its hash is the name of this snapshot.'),
        focus: ['e-snap', 'commit', 'e-parent', 'parent'],
        reveal: ['commit', 'e-snap', 'parent', 'e-parent'],
        tokens: [{ edge: 'e-snap', label: bi('снимок', 'tree') }],
        say: { commit: fmt(bi('Git записывает коммит {c}: в нём ссылка на новый снимок, ссылка на прошлый коммит и ваше сообщение.', 'Git writes commit {c}: a link to the new snapshot, a link to the previous commit and your message.'), { c: short(commitOid) }) },
        states: { commit: 'ok' },
        values: { commit: short(commitOid), parent: '4e1f0c2' },
        metrics: { objects: c.newObjects, reused: c.reused, sent: 0 },
      },
      {
        id: 'ref',
        label: 'main →',
        caption: bi('Ветка main передвигается на новый коммит: Git записывает его хэш в файл `refs/heads/main`. HEAD по-прежнему указывает на main, поэтому следующий коммит снова передвинет эту ветку.', 'The main branch moves to the new commit: the new hash is written into refs/heads/main. HEAD still points to main.'),
        focus: ['main', 'e-ref', 'head', 'e-head'],
        reveal: ['main', 'e-ref', 'head', 'e-head'],
        tokens: [{ edge: 'e-ref', label: short(commitOid) }],
        say: { main: fmt(bi('Git записывает в файл ветки main хэш нового коммита {c}, и ветка передвигается вперёд.', 'Git writes the new commit hash {c} into the main branch file, and the branch moves forward.'), { c: short(commitOid) }) },
        states: { main: 'ok' },
        values: { main: short(commitOid) },
        metrics: { objects: c.newObjects, reused: c.reused, sent: 0 },
      },
    );
    if (broken.has('remote-ahead')) {
      steps.push({
        id: 'reject',
        label: 'git push',
        caption: bi('В ветке main на сервере есть коммит коллеги, которого у вас нет. Ваш коммит не продолжает историю сервера, поэтому сервер отказывается передвигать ветку: иначе коммит коллеги пропал бы.', 'The forge’s main has a commit you do not have. Your commit does not continue the server history, so the forge refuses to move the branch.'),
        focus: ['e-push', 'forge'],
        reveal: ['forge', 'e-push'],
        tokens: [{ edge: 'e-push', label: bi('ваш коммит', 'your commit') }],
        say: { forge: bi('Сервер сравнивает истории и видит, что ваш коммит не продолжает его ветку main, поэтому отклоняет отправку.', 'The server compares the histories, sees that your commit does not continue its main, and rejects the push.') },
        states: { forge: 'err', 'e-push': 'err' },
        metrics: { objects: c.newObjects, reused: c.reused, sent: 0 },
        broken: { at: 'e-push', message: ' ! [rejected]        main -> main (fetch first)\nerror: failed to push some refs to \'https://forge.edu/team/site.git\'', caption: bi('Сначала заберите коммит коллеги командой git pull, слейте его со своим и отправьте работу снова.', 'git pull first: fetch their commit, merge it with yours and push again.') },
      });
      return steps;
    }
    steps.push(
      {
        id: 'push',
        label: 'git push',
        caption: fmt(bi('Команда `git push` отправляет только то, чего на сервере нет, то есть {n} объекта. Остальные {r} файлов не изменились, и их содержимое уже лежит на сервере.', 'git push sends only what the server lacks: {n} objects. The other {r} blobs are already there.'), { n: c.newObjects, r: c.reused }),
        focus: ['e-push', 'forge'],
        reveal: ['forge', 'e-push'],
        tokens: [{ edge: 'e-push', label: bi(`${c.newObjects} ${objectsRu(c.newObjects)}`, `${c.newObjects} objects`) }],
        say: { forge: fmt(bi('Сервер принимает {n} новых объекта, а всё остальное у него уже есть.', 'The server receives {n} new objects; it already has everything else.'), { n: c.newObjects }) },
        states: { forge: 'on' },
        metrics: { objects: c.newObjects, reused: c.reused, sent: c.newObjects },
      },
      {
        id: 'remote',
        label: 'origin/main',
        caption: bi('Сервер проверяет, что новый коммит продолжает его ветку main, и передвигает её. Теперь коммит видит вся команда.', 'The forge checks that the new commit descends from its main and moves its branch. Now the whole team sees the commit.'),
        focus: ['forge'],
        say: { forge: fmt(bi('Новый коммит продолжает историю сервера, поэтому сервер передвигает свою ветку main на коммит {c}.', 'The new commit continues the server history, so the server moves its main to {c}.'), { c: short(commitOid) }) },
        states: { forge: 'ok' },
        values: { forge: `main → ${short(commitOid)}` },
        metrics: { objects: c.newObjects, reused: c.reused, sent: c.newObjects },
      },
    );
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломку убрали, и коммит вместе с отправкой на сервер снова доходит до конца.', 'The break is removed: commit and push complete again.');
      return change.id === 'empty-message' ? bi('Без сообщения Git не создаёт коммит, и история остаётся прежней.', 'Without a message no commit is created: the history stays as it was.') : bi('Сервер принимает отправку, только если ваш коммит продолжает его историю, а сейчас в ней есть чужой коммит.', 'The forge accepts a push only if your commit continues its history.');
    }
    if (change.id === 'files') return fmt(bi('Файлов в проекте стало {b} вместо {a}, но новых объектов по-прежнему {n}, а {r} файлов взяты из прошлого коммита без изменений. Git хранит снимки целиком, но то, что не изменилось, заново не копирует.', '{a} → {b} files: still {n} new objects, {r} blobs reused unchanged. Git stores snapshots but never copies what did not change.'), { a: a.files, b: b.files, n: last(next).objects ?? 3, r: last(next).reused ?? 0 });
    void prev;
    return b.editAfterAdd ? bi('Правка после git add не попала в индекс, поэтому в коммит уйдёт версия на момент git add. Чтобы в коммит попала новая правка, нужно запустить git add ещё раз.', 'An edit after git add is not in the index: the commit gets the version from the moment of add. Run git add again.') : bi('Повторной правки нет, поэтому в коммит попадает та версия, которую вы добавили.', 'Without another edit the commit gets exactly what you added.');
  },
});

// ── E-CI: from git push to a running version ────────────────────────────────

type CiP = { runners: number; cache: boolean; manual: boolean; branch: string };

export interface CiNumbers {
  queueWait: number;
  build: number;
  total: number;
}

/** Model times of the pipeline (seconds): build, test and image jobs share the runners. */
export function ciNumbers(p: CiP): CiNumbers {
  const npm = p.cache ? 9 : 52;
  const build = 8 + npm + 4;
  const test = 8 + 12;
  const lint = 8 + 5;
  // lint and test wait for build; with one runner the two run one after another.
  const queueWait = p.runners >= 2 ? 0 : Math.min(test, lint);
  const deploy = p.branch === 'main' ? 6 + 10 : 0;
  return { queueWait, build, total: build + Math.max(test, lint) + queueWait + deploy };
}

const CI_ALL = ['dev', 'forge', 'cfg', 'queue', 'runner', 'art', 'reg', 'staging', 'prod', 'e-push', 'e-read', 'e-enq', 'e-poll', 'e-up', 'e-img', 'e-stg', 'e-prod'];

export const ciModel = defineModel<CiP>({
  id: 'cicd.push-to-deploy',
  frame: 'visible',
  block: 'cicd',
  title: bi('Путь от git push до работающей версии', 'From git push to a running version'),
  summary: bi(
    'Вы отправили коммит на сервер, и через несколько минут новая версия сайта работает на тестовом стенде. Сервер читает файл пайплайна и создаёт джобы, раннер забирает их и выполняет, результат сборки сохраняется на сервере, образ попадает в реестр, тестовый стенд обновляется сам, а рабочий сервер обновляется по решению человека.',
    'The forge reads the pipeline file, runners pick up jobs, the artifact goes from build to deploy, the image goes to the registry, staging updates by itself and production on a human decision.',
  ),
  intro: bi(
    'Сейчас на схеме только ваш репозиторий и сервер команды. А дальше листайте кнопкой «Шаг вперёд». Подсвечен тот блок, который работает, облачко говорит, что он делает, а карточка на линии показывает, что передаётся дальше.\n\nКогда дойдёте до рабочего сервера, поменяйте в «Параметрах» ветку или число раннеров и следите за счётчиками времени под схемой.',
    'For now the diagram shows only your repository and the team server. Then go on with “Step forward”. The working block is highlighted, the callout says what it does, and the card on the line shows what is handed on.\n\nOnce you reach production, change the branch or the number of runners in “Parameters” and watch the time counters under the diagram.',
  ),
  legend: [
    { mark: 'active', text: bi('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: bi('что этот блок делает', 'what that block does') },
    { mark: 'token', text: bi('что передаётся дальше, например коммит, джобы, файлы или образ', 'what is handed on, such as a commit, jobs, files or an image') },
    { mark: 'icon:server', text: bi('сервер команды (forge)', 'the team server (forge)') },
    { mark: 'icon:container', text: bi('раннер, который выполняет джобу в контейнере', 'a runner running a job in a container') },
    { mark: 'icon:disk', text: bi('хранилище файлов на сервере', 'file storage on the server') },
    { mark: 'icon:cloud', text: bi('окружение, куда выкладывают версию', 'an environment the version is deployed to') },
    { mark: 'wait', text: bi('ждёт решения человека', 'waits for a human decision') },
    { mark: 'err', text: bi('здесь пайплайн остановился', 'the pipeline stopped here') },
  ],
  stopLabel: bi('Пайплайн остановился', 'The pipeline stopped'),
  concepts: ['cicd.runner', 'cicd.job', 'cicd.artifact', 'cicd.environment'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      { id: 'dev', label: bi('ваш репозиторий', 'your repository'), icon: 'folder', sub: '1a2b3c4', family: 'ci-source', shape: 'doc', x: 16, y: 40, w: 168, h: 60, card: card(bi('Ваш локальный репозиторий, в котором лежат новый коммит и файл пайплайна `.gitlab-ci.yml`.', 'The local repository with the commit and the .gitlab-ci.yml file.'), bi('Коммит сделали вы.', 'You.'), 'git log --oneline -1') },
      { id: 'forge', label: 'forge', icon: 'server', work: 'spin', sub: 'team/site', family: 'cp', shape: 'hex', x: 240, y: 36, w: 176, h: 68, card: card(bi('Сервер репозиториев команды, здесь это учебный GitLab. На каждый push он читает файл пайплайна из пришедшего коммита и создаёт джобы.', 'The repository server (a training GitLab here). On every push it reads the pipeline file and creates jobs.'), bi('Сервер поддерживает команда, и работает он постоянно.', 'The team; always running.'), 'glab ci status') },
      { id: 'cfg', label: '.gitlab-ci.yml', icon: 'file', sub: 'stages: build test deploy', family: 'obj', shape: 'doc', x: 240, y: 156, w: 176, h: 60, card: card(bi('Файл пайплайна в репозитории. В нём перечислены стадии, джобы, их скрипты и правила, и меняют его коммитом, как обычный код.', 'The pipeline file in the repository: stages, jobs, scripts, rules. It changes by a commit, like code.'), bi('Файл пишете вы, а читает его сервер.', 'You write it, the forge reads it.'), 'glab ci lint', { url: 'https://docs.gitlab.com/ci/yaml/', label: 'docs.gitlab.com › CI/CD YAML syntax reference' }) },
      { id: 'queue', label: bi('очередь джоб', 'job queue'), icon: 'database', sub: 'pending: 0', family: 'flow', shape: 'buffer', x: 472, y: 40, w: 180, h: 60, card: card(bi('Джобы в состоянии pending ждут здесь, пока их заберёт свободный раннер с подходящими тегами.', 'Jobs in the pending state wait for a free runner with matching tags.'), bi('Джобы ставит в очередь сервер, а забирают раннеры.', 'The forge enqueues, runners take.'), 'glab ci view') },
      { id: 'runner', label: bi('раннер', 'runner'), icon: 'container', work: 'dots', sub: 'docker executor', family: 'node', shape: 'rack', x: 472, y: 160, w: 180, h: 92, card: card(bi('Отдельная машина, на которой работает программа gitlab-runner. Она сама спрашивает сервер, нет ли для неё работы, запускает джобу в контейнере из указанного образа и отправляет на сервер журнал выполнения.', 'A separate machine with gitlab-runner. It asks the forge "any work?" by itself, runs the job in a container from the image and sends back the log.'), bi('Раннер регистрирует в проекте администратор.', 'An administrator registers the runner with the project.'), 'gitlab-runner list', { url: 'https://docs.gitlab.com/runner/', label: 'docs.gitlab.com › GitLab Runner' }) },
      { id: 'art', label: bi('артефакты', 'artifacts'), icon: 'disk', sub: 'dist/', family: 'store', shape: 'buffer', x: 240, y: 300, w: 176, h: 60, card: card(bi('Файлы, которые джоба загрузила на сервер. Следующие джобы скачивают их перед своим скриптом, и так каталог dist/ из сборки доходит до выкладки.', 'Files a job uploaded to the forge. Later jobs download them: that is how dist/ from the build reaches the deploy.'), bi('Файлы объявляют в ключе `artifacts:` джобы сборки.', 'artifacts: in the build job.'), 'glab ci trace build', { url: 'https://docs.gitlab.com/ci/jobs/job_artifacts/', label: 'docs.gitlab.com › Job artifacts' }) },
      { id: 'reg', label: bi('реестр образов', 'image registry'), icon: 'database', sub: 'site:1a2b3c4d', family: 'store', shape: 'buffer', x: 472, y: 320, w: 180, h: 60, card: card(bi('Хранилище образов контейнеров. Тег, совпадающий с коммитом, никогда не меняется, поэтому по нему всегда видно, какая версия выложена.', 'Image storage. A tag by commit never changes: it always tells what was deployed.'), bi('Образ отправляет сюда джоба командой `docker push`.', 'docker push from a job.'), 'docker pull registry.forge.edu/team/site:1a2b3c4d') },
      { id: 'staging', label: 'staging', icon: 'cloud', sub: '—', family: 'ci-deploy', shape: 'box', x: 760, y: 80, w: 184, h: 60, card: card(bi('Тестовый стенд, то есть копия рабочего сервера без настоящих пользователей. Он обновляется автоматически из ветки main.', 'An environment for checking: a copy of production without real users. Updated automatically from main.'), bi('Стенд обновляет джоба deploy_staging с ключом `environment: staging`.', 'The deploy_staging job with environment: staging.'), 'glab ci status', { url: 'https://docs.gitlab.com/ci/environments/', label: 'docs.gitlab.com › Environments' }) },
      { id: 'prod', label: 'production', icon: 'cloud', sub: '—', family: 'ci-deploy', shape: 'box', x: 760, y: 300, w: 184, h: 60, card: card(bi('Рабочий сервер, которым пользуются настоящие пользователи. Если у джобы выкладки стоит `when: manual`, его обновляет человек нажатием кнопки, и такая практика называется Continuous Delivery. Без этой строки сервер обновляется сам, и это называется Continuous Deployment.', 'The users’ environment. With when: manual a person updates it with a button (Continuous Delivery); without, it is Continuous Deployment.'), bi('Сервер обновляет джоба deploy_production.', 'The deploy_production job.'), 'glab ci trigger deploy_production') },
    ],
    edges: [
      { id: 'e-push', from: 'dev', to: 'forge', label: 'git push', card: card(bi('Новые объекты и новая позиция ветки уходят на сервер.', 'Objects and the new branch position go to the forge.'), bi('Команду запускаете вы.', 'You.'), 'git push') },
      { id: 'e-read', from: 'forge', to: 'cfg', label: bi('чтение при каждом push', 'read on every push'), card: card(bi('Сервер берёт файл `.gitlab-ci.yml` из того коммита, который пришёл, и по правилам в нём решает, какие джобы создать.', 'The forge takes .gitlab-ci.yml from exactly the commit that arrived and decides by the rules which jobs to create.'), bi('Файл читает сервер.', 'The forge.'), 'echo $CI_PIPELINE_SOURCE') },
      { id: 'e-enq', from: 'forge', to: 'queue', label: bi('новые джобы', 'jobs: pending'), card: card(bi('Созданные джобы встают в очередь и ждут раннер.', 'Created jobs are queued.'), bi('Джобы ставит в очередь сервер.', 'The forge.')) },
      { id: 'e-poll', from: 'runner', to: 'queue', label: bi('запрос работы', 'POST /api/v4/jobs/request'), card: card(bi('Раннер сам опрашивает сервер каждые несколько секунд запросом `POST /api/v4/jobs/request`. Сервер к раннеру никогда не подключается.', 'The runner polls the forge every few seconds by itself: the forge never connects to the runner.'), bi('Запросы отправляет gitlab-runner.', 'gitlab-runner.')) },
      { id: 'e-up', from: 'runner', to: 'art', via: [[420, 230]], label: bi('загрузка артефактов', 'artifacts upload'), labelAt: 0.4, card: card(bi('После успешной джобы раннер отправляет на сервер пути, перечисленные в `artifacts:paths`.', 'After a successful job the runner uploads the paths from artifacts:paths to the forge.'), bi('Файлы отправляет gitlab-runner.', 'gitlab-runner.')) },
      { id: 'e-img', from: 'runner', to: 'reg', label: bi('отправка образа', 'image push'), card: card(bi('Джоба собирает образ и отправляет его в реестр с тегом коммита `$CI_COMMIT_SHORT_SHA`.', 'A job builds the image and pushes it to the registry tagged with the commit.'), bi('Образ отправляет скрипт джобы build-image.', 'The build-image job script.')) },
      { id: 'e-stg', from: 'reg', to: 'staging', via: [[700, 350], [700, 110]], label: bi('выкладка из main', 'automatic from main'), labelAt: 0.55, card: card(bi('Джоба deploy_staging запускается сама, как только прошли тесты.', 'The deploy_staging job starts by itself once the tests passed.'), bi('Джобу запускает сервер по правилам из файла пайплайна.', 'The forge, by the rules.')) },
      { id: 'e-prod', from: 'staging', to: 'prod', label: bi('решение человека', '▶ a human decision'), card: card(bi('Ручной шаг задаёт строка `when: manual`. Если её убрать, выкладка на рабочий сервер станет автоматической.', 'The manual gate: when: manual. Remove the line and the deployment becomes automatic.'), bi('Кнопку нажимает человек, у которого есть права на это окружение.', 'A person with rights on the environment.'), 'glab ci trigger deploy_production') },
    ],
  },
  params: [
    {
      id: 'branch',
      label: bi('В какую ветку отправлен коммит', 'Push to'),
      group: bi('Что отправили', 'What was pushed'),
      kind: 'choice',
      default: 'main',
      options: [
        { id: 'main', label: bi('в основную ветку main', 'main') },
        { id: 'feature', label: bi('в рабочую ветку feature', 'a feature branch') },
      ],
      near: 'cfg',
      predict: {
        prompt: bi('Коммит отправлен в рабочую ветку feature, а правило выкладки в файле пайплайна написано только для main. Попадёт ли версия на тестовый стенд?', 'A push to a feature branch. Will the version reach staging?'),
        options: [
          { id: 'no', text: bi('Нет, потому что для ветки feature правила не создают джобы выкладки', 'No: the deploy rule is for main only') },
          { id: 'yes', text: bi('Да, потому что выкладку запускает любой push', 'Yes, every push deploys') },
        ],
        resolve: (_p, n) => (n.some((s) => s.id === 'staging') ? 'yes' : 'no'),
      },
    },
    { id: 'runners', label: bi('Сколько раннеров свободно', 'Free runners'), group: bi('Раннеры', 'The runners'), kind: 'range', min: 1, max: 4, step: 1, default: 2, near: 'runner', predict: { prompt: bi('Свободным остался один раннер, а джобы lint и test готовы стартовать одновременно. Что станет со временем всего пайплайна?', 'Only one runner is left. What happens to the pipeline time?'), options: [{ id: 'longer', text: bi('Время вырастет, потому что lint и test пойдут друг за другом', 'It grows: lint and test run one after another') }, { id: 'same', text: bi('Время не изменится, потому что джобы всё равно короткие', 'It stays the same') }], resolve: (prev, next) => ((last(next).total ?? 0) > (last(prev).total ?? 0) ? 'longer' : 'same') } },
    { id: 'cache', label: bi('На раннере сохранились зависимости прошлой сборки (кэш)', 'Dependency cache'), group: bi('Раннеры', 'The runners'), kind: 'toggle', default: true, near: 'runner', predict: { prompt: bi('Кэш зависимостей на раннере пропал. Что будет со сборкой?', 'The cache is gone. What happens to the build?'), options: [{ id: 'slow', text: bi('Сборка пройдёт, но займёт больше времени', 'It passes, but slower') }, { id: 'fail', text: bi('Сборка завершится с ошибкой, потому что зависимостей нет', 'It fails') }], resolve: () => 'slow' } },
    { id: 'manual', label: bi('Выкладку на рабочий сервер запускает человек (when: manual)', 'when: manual on production'), group: bi('Выкладка', 'Deployment'), kind: 'toggle', default: true, near: 'prod' },
  ],
  breaks: [
    { id: 'test-fails', label: bi('Тест находит ошибку и возвращает код 1', 'A test fails'), remove: ['e-img'], predict: { prompt: bi('Скрипт теста вернул код 1. Что будет с выкладкой?', 'A test returned exit code 1. What happens to the deployment?'), options: [{ id: 'stop', text: bi('Выкладки не будет, потому что следующие стадии пропускаются', 'It stops: the later stages are skipped') }, { id: 'go', text: bi('Версия всё равно выложится, а тест только предупредит', 'It deploys; the test is only a warning') }], resolve: () => 'stop' } },
    { id: 'no-artifact', label: bi('У сборки не объявлены артефакты', 'The artifact is not declared'), remove: ['e-up', 'art'], predict: { prompt: bi('У джобы сборки нет ключа artifacts:paths. Что увидит следующая джоба в каталоге проекта?', 'The build has no artifacts:paths. What does the next job see?'), options: [{ id: 'missing', text: bi('Каталога dist/ там не будет', 'An empty directory: no dist/') }, { id: 'there', text: bi('Каталог dist/ будет на месте, потому что раннер тот же', 'dist/ is there: same runner') }], resolve: () => 'missing' } },
    { id: 'no-runner', label: bi('Ни у одного раннера нет тега docker', 'No runner with the docker tag'), remove: ['e-poll'], predict: { prompt: bi('Джоба требует раннер с тегом docker, а ни у одного раннера такого тега нет. Что с ней будет?', 'No runner has the docker tag the job needs. What happens to the job?'), options: [{ id: 'stuck', text: bi('Джоба будет ждать в очереди в состоянии pending', 'It waits in pending') }, { id: 'any', text: bi('Джобу заберёт любой свободный раннер', 'Any runner takes it') }, { id: 'fail', text: bi('Джоба сразу завершится с ошибкой', 'It fails at once') }], resolve: () => 'stuck' } },
    { id: 'no-secret', label: bi('В настройках проекта не задана переменная DEPLOY_TOKEN', 'DEPLOY_TOKEN is not set'), remove: ['e-stg'], predict: { prompt: bi('Ключа для выкладки нет в настройках проекта. На каком шаге остановится пайплайн?', 'The deploy secret is missing from the project settings. Where does the pipeline break?'), options: [{ id: 'deploy', text: bi('Пайплайн остановится на джобе выкладки', 'At the deploy job') }, { id: 'push', text: bi('Сервер не примет push', 'The push is refused') }], resolve: () => 'deploy' } },
  ],
  metrics: [
    { id: 'build', label: bi('сборка, с', 'build, s') },
    { id: 'wait', label: bi('ожидание раннера, с', 'waiting for a runner, s') },
    { id: 'total', label: bi('весь пайплайн, с', 'whole pipeline, s') },
  ],
  run(p, broken) {
    const n = ciNumbers(p);
    const main = p.branch === 'main';
    const m0 = { build: 0, wait: 0, total: 0 };
    const steps: Step[] = [
      {
        id: 'push',
        label: 'push',
        caption: bi('Вы отправляете коммит 1a2b3c4 на сервер командой `git push`. Больше от вас ничего не требуется, потому что всё дальнейшее делают сервер и раннеры.', 'git push sends commit 1a2b3c4 to the forge.'),
        focus: ['dev', 'e-push', 'forge'],
        tokens: [{ edge: 'e-push', label: '1a2b3c4' }],
        say: { dev: bi('Вы отправляете на сервер коммит 1a2b3c4 командой git push.', 'You push commit 1a2b3c4 to the server with git push.') },
        states: { ...hiddenExcept(CI_ALL, 'dev', 'forge', 'e-push'), forge: 'on' },
        metrics: m0,
      },
      {
        id: 'jobs',
        label: bi('джобы', 'jobs'),
        caption: main
          ? bi('Сервер читает `.gitlab-ci.yml` из пришедшего коммита. Для ветки main правила создают шесть джоб: build, lint, test, build-image и две выкладки.', 'The forge reads .gitlab-ci.yml from the commit: for main the rules give build, lint, test, build-image and both deploys.')
          : bi('Сервер читает `.gitlab-ci.yml` из пришедшего коммита. Для ветки feature правила создают только три джобы, build, lint и test, а джоб выкладки нет.', 'The forge reads .gitlab-ci.yml: for a feature branch the rules give only build, lint and test; no deploys.'),
        focus: ['forge', 'e-read', 'cfg'],
        reveal: ['cfg', 'e-read'],
        tokens: [{ edge: 'e-read', label: main ? bi('6 джоб', '6 jobs') : bi('3 джобы', '3 jobs') }],
        say: { forge: main ? bi('Сервер читает файл пайплайна и по его правилам создаёт для ветки main шесть джоб.', 'The server reads the pipeline file and creates six jobs for main by its rules.') : bi('Сервер читает файл пайплайна и по его правилам создаёт для ветки feature только три проверки.', 'The server reads the pipeline file and creates only three checks for feature by its rules.') },
        states: { cfg: 'ok' },
        values: { cfg: t(main ? bi('6 джоб', '6 jobs') : bi('3 джобы', '3 jobs')) },
        metrics: m0,
      },
      {
        id: 'queue',
        label: 'pending',
        caption: bi('Джобы встают в очередь. Сам сервер их не выполняет: он ждёт, пока какой-нибудь раннер спросит, нет ли для него работы.', 'The jobs are queued. The forge does not run them: it waits for a runner to ask for work.'),
        focus: ['e-enq', 'queue'],
        reveal: ['queue', 'e-enq'],
        tokens: [{ edge: 'e-enq', label: 'build' }],
        say: { queue: bi('Джобы ждут в очереди в состоянии pending, пока их не заберёт раннер.', 'The jobs wait in the queue in the pending state until a runner takes them.') },
        values: { queue: 'pending: 1' },
        fill: { queue: 0.4 },
        metrics: m0,
      },
    ];
    if (broken.has('no-runner')) {
      steps.push(
        {
          id: 'stuck',
          label: 'stuck',
          caption: bi('Раннеры спрашивают у сервера работу, но джоба требует тег docker, а такого тега нет ни у одного раннера. Поэтому джобу никто не забирает, и GitLab помечает её как stuck.', 'Runners ask the server for work, but the job needs the docker tag and no runner has it. Nobody takes the job, and GitLab marks it stuck.'),
          focus: ['queue', 'runner'],
          reveal: ['runner'],
          say: { queue: bi('Джоба требует раннер с тегом docker, такого раннера нет, и джоба остаётся в очереди.', 'The job needs a runner with the docker tag; there is none, so the job stays in the queue.') },
          states: { runner: 'off', queue: 'warn' },
          fill: { queue: 0.6 },
          metrics: { build: 0, wait: 60, total: 0 },
        },
        {
          id: 'waiting',
          label: bi('ожидание', 'waiting'),
          caption: bi('Джоба ждёт, пока не появится подходящий раннер или пока GitLab не снимет её по тайм-ауту. Схема показывает первые десять минут: время ожидания растёт, а время пайплайна остаётся нулевым, потому что пайплайн не закончился.', 'The job waits until a matching runner appears or GitLab drops it on a timeout. The diagram shows the first ten minutes: the wait grows, and the pipeline time stays at zero because the pipeline has not finished.'),
          focus: ['queue'],
          say: { queue: bi('Джоба по-прежнему стоит в очереди, и время её ожидания растёт.', 'The job is still in the queue, and its waiting time grows.') },
          states: { runner: 'off', queue: 'warn' },
          fill: { queue: 0.8 },
          metrics: { build: 0, wait: 600, total: 0 },
          broken: { at: 'queue', message: "This job is stuck because you don't have any active runners online or available with any of these tags assigned to them: docker", caption: bi('Теги джобы должны совпадать с тегами раннера. Исправьте тег в файле пайплайна или попросите администратора зарегистрировать раннер с нужным тегом.', 'the job tags must match the runner tags; fix the tag or register a runner.') },
        },
      );
      return steps;
    }
    steps.push({
      id: 'build',
      label: 'build',
      caption: p.cache
        ? fmtBi(bi('Раннер забирает джобу build, скачивает образ, копирует репозиторий, достаёт зависимости из кэша и выполняет скрипт. Благодаря кэшу `npm ci` занимает 9 секунд, а вся сборка длится {s}.', 'A runner takes build: pulls the image, clones the repository, restores the cache (npm ci: 9 s), runs the script. The whole build takes {s}.'), { s: sec(n.build) })
        : fmtBi(bi('Раннер забирает джобу build и копирует репозиторий. Кэша нет, поэтому `npm ci` скачивает все зависимости заново за 52 секунды. Вся сборка длится {s}, но заканчивается успешно.', 'A runner takes build: pulls the image, clones the repository; there is no cache, so npm ci downloads everything: 52 s. The whole build takes {s}, and it still passes.'), { s: sec(n.build) }),
      focus: ['e-poll', 'runner'],
      reveal: ['runner', 'e-poll'],
      tokens: [{ edge: 'e-poll', label: 'build', reverse: true }],
      say: { runner: p.cache ? bi('Раннер выполняет сборку в контейнере и берёт зависимости из кэша, поэтому установка занимает 9 секунд.', 'The runner builds in a container and takes the dependencies from the cache, so installing them takes 9 seconds.') : bi('Раннер выполняет сборку в контейнере, но кэша нет, и зависимости скачиваются заново 52 секунды.', 'The runner builds in a container, but there is no cache, so the dependencies download again for 52 seconds.') },
      states: { runner: 'on' },
      values: { queue: 'pending: 0', runner: 'build' },
      fill: { queue: 0 },
      metrics: { build: n.build, wait: 0, total: n.build },
    });
    if (broken.has('no-artifact')) {
      steps.push({
        id: 'noart',
        label: 'test',
        caption: bi('Сборка прошла, но каталог dist/ остался в её контейнере, который уже удалён. Джоба test начинается с чистой копии репозитория, каталога dist/ в ней нет, и проверка завершается ошибкой.', 'The build passed, but dist/ stayed on its machine. The test job starts on a clean machine: the directory is not there.'),
        focus: ['runner'],
        say: { runner: bi('Джоба test ищет файл dist/index.html, не находит его и завершается с кодом 1.', 'The test job looks for dist/index.html, does not find it and exits with code 1.') },
        states: { runner: 'err' },
        metrics: { build: n.build, wait: n.queueWait, total: n.build + 3 },
        broken: { at: 'runner', message: '$ test -f dist/index.html\nERROR: Job failed: exit code 1', caption: bi('Каждая джоба начинается на чистой машине, и результат сборки до следующих джоб доносят только артефакты.', 'every job starts on a clean machine; artifacts carry results forward.') },
      });
      return steps;
    }
    steps.push(
      {
        id: 'artifact',
        label: 'artifacts',
        caption: bi('Раннер загружает каталог dist/ на сервер как артефакт. Следующие джобы скачают его перед своим скриптом, на каком бы раннере они ни запустились.', 'The runner uploads dist/ to the forge as an artifact. Later jobs download it, wherever they run.'),
        focus: ['e-up', 'art'],
        reveal: ['art', 'e-up'],
        tokens: [{ edge: 'e-up', label: 'dist/' }],
        say: { art: bi('Сервер сохраняет каталог dist/, который прислал раннер, чтобы его могли скачать следующие джобы.', 'The server stores the dist/ directory the runner sent, so that later jobs can download it.') },
        states: { art: 'ok' },
        fill: { art: 0.6 },
        metrics: { build: n.build, wait: 0, total: n.build },
      },
      {
        id: 'test',
        label: 'lint + test',
        caption: n.queueWait
          ? fmtBi(bi('Джобы lint и test готовы стартовать одновременно, но раннер один, поэтому test ждёт своей очереди {w}.', 'lint and test are ready at the same time, but there is one runner: test waits {w}.'), { w: sec(n.queueWait) })
          : bi('Джобы lint и test выполняются одновременно на двух раннерах.', 'lint and test run in parallel on two runners.'),
        focus: ['runner', 'queue'],
        say: { runner: n.queueWait ? fmtBi(bi('Раннер один, поэтому он выполняет lint и test друг за другом, и test ждёт {w}.', 'There is one runner, so it runs lint and test one after another, and test waits {w}.'), { w: sec(n.queueWait) }) : bi('Два раннера выполняют lint и test одновременно, и ни одна джоба не ждёт.', 'Two runners run lint and test at the same time, and no job waits.') },
        states: { runner: broken.has('test-fails') ? 'err' : 'ok' },
        values: { runner: 'lint, test' },
        metrics: { build: n.build, wait: n.queueWait, total: n.total - (main ? 16 : 0) },
      },
    );
    if (broken.has('test-fails')) {
      steps.push({
        id: 'failed',
        label: 'failed',
        caption: bi('Скрипт `./test.sh` вернул код 1, поэтому джоба test помечена как failed, а build-image и выкладки пропущены. Версия с ошибкой не попала ни на один сервер, и время пайплайна не включает выкладку.', './test.sh returned 1: the job failed, and build-image and the deploys are skipped. The broken version went nowhere.'),
        focus: ['runner'],
        say: { runner: bi('Тест нашёл ошибку и вернул код 1, поэтому раннер помечает джобу как failed.', 'The test found an error and returned code 1, so the runner marks the job as failed.') },
        states: { runner: 'err' },
        metrics: { build: n.build, wait: n.queueWait, total: n.total - (main ? 16 : 0) },
        broken: { at: 'runner', message: '$ ./test.sh\nFAIL: index.html has no <h1>\nERROR: Job failed: exit code 1', caption: bi('Если команда в скрипте вернула ненулевой код, джоба считается упавшей, и следующие стадии пропускаются.', 'a non-zero exit code → the job failed → the later stages are skipped.') },
      });
      return steps;
    }
    if (!main) {
      steps.push({
        id: 'done',
        label: bi('готово', 'done'),
        caption: bi('Для рабочей ветки пайплайн на этом заканчивается. Проверки прошли, и merge request можно отдавать коллегам на проверку, а выкладка случится после слияния в main.', 'For a branch the pipeline ends here: the checks are green and the merge request can be reviewed. Deployment happens after the merge into main.'),
        focus: ['forge'],
        say: { forge: bi('Сервер отмечает, что все проверки ветки прошли, и показывает это в merge request.', 'The server marks that all the branch checks passed and shows it in the merge request.') },
        states: { forge: 'ok' },
        metrics: { build: n.build, wait: n.queueWait, total: n.total },
      });
      return steps;
    }
    steps.push({
      id: 'image',
      label: 'image',
      caption: bi('Джоба build-image собирает образ и отправляет его в реестр с тегом 1a2b3c4d, то есть с коротким хэшем коммита. Этот тег становится неизменным именем этой версии.', 'build-image builds the image and pushes it to the registry tagged 1a2b3c4d, the short commit hash. The tag becomes the unchanging name of this version.'),
      focus: ['e-img', 'reg'],
      reveal: ['reg', 'e-img'],
      tokens: [{ edge: 'e-img', label: ':1a2b3c4d' }],
      say: { reg: bi('Реестр сохраняет образ сайта с тегом 1a2b3c4d, который совпадает с коммитом.', 'The registry stores the site image with the tag 1a2b3c4d, which matches the commit.') },
      states: { reg: 'ok' },
      fill: { reg: 0.5 },
      metrics: { build: n.build, wait: n.queueWait, total: n.total - 16 },
    });
    steps.push({
      id: 'tag',
      label: bi('тег', 'tag'),
      caption: bi('Тег берётся из переменной $CI_COMMIT_SHORT_SHA. GitLab записывает в неё восемь первых знаков хэша, а `git log --oneline` показывает семь, поэтому коммит 1a2b3c4 и тег 1a2b3c4d обозначают одно и то же.', 'The tag comes from the $CI_COMMIT_SHORT_SHA variable. GitLab puts the first eight characters of the hash into it, while git log --oneline shows seven, so commit 1a2b3c4 and tag 1a2b3c4d name the same thing.'),
      focus: ['reg'],
      say: { reg: bi('В реестре теперь лежит образ, по тегу которого можно найти его коммит.', 'The registry now holds an image whose tag leads back to its commit.') },
      states: { reg: 'ok' },
      fill: { reg: 0.5 },
      metrics: { build: n.build, wait: n.queueWait, total: n.total - 16 },
    });
    if (broken.has('no-secret')) {
      steps.push({
        id: 'nosecret',
        label: 'deploy',
        caption: bi('Джоба deploy_staging стартует, но переменная DEPLOY_TOKEN пуста, и скрипт выкладки отказывается работать без ключа.', 'deploy_staging starts, but DEPLOY_TOKEN is empty: the deploy script refuses to work without the key.'),
        focus: ['staging'],
        reveal: ['staging'],
        say: { staging: bi('Скрипт выкладки не находит ключ DEPLOY_TOKEN и завершается с ошибкой, так что тестовый стенд остаётся на прежней версии.', 'The deploy script finds no DEPLOY_TOKEN and exits with an error, so staging keeps the previous version.') },
        states: { staging: 'err' },
        metrics: { build: n.build, wait: n.queueWait, total: n.total },
        broken: { at: 'staging', message: '$ ./deploy.sh staging\ndeploy.sh: DEPLOY_TOKEN is not set\nERROR: Job failed: exit code 1', caption: bi('Секрет хранится в настройках проекта (Settings → CI/CD → Variables), а не в репозитории, и задать его нужно там.', 'a secret lives in the project settings (Settings → CI/CD → Variables), not in the repository.') },
      });
      return steps;
    }
    steps.push({
      id: 'staging',
      label: 'staging',
      caption: bi('Джоба deploy_staging выкладывает образ на тестовый стенд автоматически, потому что тесты прошли и коммит пришёл в ветку main.', 'deploy_staging rolls the image out to staging automatically: the tests passed and the rule for main holds.'),
      focus: ['e-stg', 'staging'],
      reveal: ['staging', 'e-stg'],
      tokens: [{ edge: 'e-stg', label: ':1a2b3c4d' }],
      say: { staging: bi('Тестовый стенд запускает версию 1a2b3c4d, и на ней можно проверять сайт.', 'Staging starts version 1a2b3c4d, and the site can be checked on it.') },
      states: { staging: 'ok' },
      values: { staging: '1a2b3c4d' },
      metrics: { build: n.build, wait: n.queueWait, total: n.total },
    });
    steps.push(
      p.manual
        ? {
            id: 'gate',
            label: bi('ручной запуск', 'manual run'),
            caption: bi('Рабочий сервер ждёт нажатия кнопки. Версия готова к выпуску, но выпускать ли её, решает человек, и такая практика называется Continuous Delivery.', 'Production waits for the button: the version is ready to release, and releasing is a human decision. This is Continuous Delivery.'),
            focus: ['e-prod', 'prod'],
            reveal: ['prod', 'e-prod'],
            say: { prod: bi('Джоба выкладки на рабочий сервер ждёт, пока человек нажмёт кнопку ▶.', 'The production deploy job waits for a person to press ▶.') },
            states: { prod: 'wait' },
            values: { prod: 'manual ▶' },
            metrics: { build: n.build, wait: n.queueWait, total: n.total },
          }
        : {
            id: 'prod',
            label: 'production',
            caption: bi('Строки `when: manual` нет, поэтому рабочий сервер обновляется сам сразу после тестового стенда. Такая практика называется Continuous Deployment.', 'Without when: manual production updates by itself right after staging. This is Continuous Deployment.'),
            focus: ['e-prod', 'prod'],
            reveal: ['prod', 'e-prod'],
            tokens: [{ edge: 'e-prod', label: ':1a2b3c4d' }],
            say: { prod: bi('Рабочий сервер сам переходит на версию 1a2b3c4d, и её сразу получают пользователи.', 'Production switches to version 1a2b3c4d by itself, and users get it at once.') },
            states: { prod: 'ok' },
            values: { prod: '1a2b3c4d' },
            metrics: { build: n.build, wait: n.queueWait, total: n.total + 16 },
          },
    );
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломку убрали, и пайплайн снова доходит до конца.', 'The break is removed: the pipeline completes again.');
      const m: Record<string, Bi> = {
        'test-fails': bi('Тест вернул код 1, джоба помечена как failed, и следующие стадии пропущены. Так пайплайн не пускает версию с ошибкой дальше.', 'Exit code 1 → the job failed → later stages skipped. The pipeline is the gate.'),
        'no-artifact': bi('Без артефактов результат сборки остаётся в её контейнере, а каждая следующая джоба начинает с чистой копии.', 'Without artifacts the build output stays on its machine: every job starts from a clean slate.'),
        'no-runner': bi('Сервер сам джобы не выполняет, поэтому без подходящего раннера джоба ждёт в очереди.', 'The forge never runs jobs itself; without a matching runner the job just waits.'),
        'no-secret': bi('Секрет хранится в настройках проекта, а не в коде, и без него выкладка завершается с ошибкой, хотя сборка и тесты прошли.', 'The secret is in the project settings, not in the code; without it the deploy is what fails.'),
      };
      return m[change.id] ?? bi('Схема заново просчитала пайплайн с новыми условиями.', 'The diagram recomputed the pipeline with the new conditions.');
    }
    const t0 = last(prev).total ?? 0;
    const t1 = last(next).total ?? 0;
    if (change.id === 'runners') return fmtBi(bi('Раннеров стало {b} вместо {a}, и весь пайплайн теперь занимает {t1}, а раньше занимал {t0}, потому что от числа свободных раннеров зависит, сколько джоб одной стадии выполняются одновременно.', 'There are now {b} runners instead of {a}, and the whole pipeline takes {t1}, where it took {t0}, because the number of free runners decides how many jobs of one stage run at the same time.'), { a: a.runners, b: b.runners, t0: sec(t0), t1: sec(t1) });
    if (change.id === 'cache') return b.cache ? bi('Кэш вернулся, и установка зависимостей снова занимает 9 секунд вместо 52. Кэш только ускоряет сборку.', 'The cache is back: npm ci 52 → 9 s. A cache only speeds things up.') : bi('Без кэша зависимости скачиваются заново за 52 секунды вместо 9, но сборка проходит. Кэш может пропасть в любой момент, поэтому сборка не должна от него зависеть.', 'Without the cache npm ci downloads everything again: 9 → 52 s, but the build passes. A cache may vanish; the build must not depend on it.');
    if (change.id === 'manual') return b.manual ? bi('С when: manual последний шаг ждёт кнопки, и это Continuous Delivery.', 'With when: manual the last step is a button: Continuous Delivery.') : bi('Без when: manual рабочий сервер обновляется сам, и это Continuous Deployment. Две практики отличаются одной строкой YAML.', 'Without when: manual production updates by itself: Continuous Deployment. The difference is one line of YAML.');
    return b.branch === 'main' ? bi('Коммит пришёл в main, и правила добавили к проверкам сборку образа и обе выкладки.', 'A push to main: the rules add the image build and the deploys.') : bi('Коммит пришёл в рабочую ветку, и правила оставили только проверки без выкладок.', 'A push to a branch: the rules keep only the checks; no deploys.');
  },
});
