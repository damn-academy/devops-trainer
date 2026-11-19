// Block "Git and YAML" (route id git-yaml, 06 §2 G-local and §2.7).
// Order of ideas: repository and commit → the index → branches and HEAD →
// merge and conflict → .gitignore → YAML and its traps.

import { parse as yamlParse } from 'yaml';
import { bi } from '../../../core/i18n';
import type { Block, Concept, Lesson, PlacementTask, QuizItem, Sources } from '../../../core/types';
import { CONFIG, HOME, PAGES, SITE, gitSetup, head, repo, siteFiles } from './common';

const S = {
  progit: { title: 'Pro Git, 2nd edition — Git Basics', url: 'https://git-scm.com/book/en/v2/Git-Basics-Getting-a-Git-Repository' },
  progitBranch: { title: 'Pro Git — Git Branching: Branches in a Nutshell', url: 'https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell' },
  progitMerge: { title: 'Pro Git — Basic Branching and Merging', url: 'https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging' },
  progitIgnore: { title: 'Pro Git — Recording Changes to the Repository (Ignoring Files)', url: 'https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository' },
  gitignore: { title: 'gitignore — Git documentation', url: 'https://git-scm.com/docs/gitignore' },
  ref: { title: 'Git reference', url: 'https://git-scm.com/docs' },
  lgb: { title: 'Learn Git Branching', url: 'https://learngitbranching.js.org/' },
  yaml: { title: 'YAML Ain’t Markup Language, version 1.2.2', url: 'https://yaml.org/spec/1.2.2/' },
  yamllint: { title: 'yamllint documentation — Rules', url: 'https://yamllint.readthedocs.io/en/stable/rules.html' },
  norway: { title: 'The Norway Problem — why StrictYAML refuses to do implicit typing', url: 'https://hitchdev.com/strictyaml/why/implicit-typing-removed/' },
  ruBook: { title: 'Pro Git на русском — Основы Git', url: 'https://git-scm.com/book/ru/v2/%D0%9E%D1%81%D0%BD%D0%BE%D0%B2%D1%8B-Git-%D0%A1%D0%BE%D0%B7%D0%B4%D0%B0%D0%BD%D0%B8%D0%B5-Git-%D1%80%D0%B5%D0%BF%D0%BE%D0%B7%D0%B8%D1%82%D0%BE%D1%80%D0%B8%D1%8F' },
  ruBranch: { title: 'Pro Git на русском — Ветвление в Git: о ветвлении в двух словах', url: 'https://git-scm.com/book/ru/v2/%D0%92%D0%B5%D1%82%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5-%D0%B2-Git-%D0%9E-%D0%B2%D0%B5%D1%82%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D0%B8-%D0%B2-%D0%B4%D0%B2%D1%83%D1%85-%D1%81%D0%BB%D0%BE%D0%B2%D0%B0%D1%85' },
  ruMerge: { title: 'Pro Git на русском — Основы ветвления и слияния', url: 'https://git-scm.com/book/ru/v2/%D0%92%D0%B5%D1%82%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5-%D0%B2-Git-%D0%9E%D1%81%D0%BD%D0%BE%D0%B2%D1%8B-%D0%B2%D0%B5%D1%82%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D1%8F-%D0%B8-%D1%81%D0%BB%D0%B8%D1%8F%D0%BD%D0%B8%D1%8F' },
  ruRecord: { title: 'Pro Git на русском — Запись изменений в репозиторий', url: 'https://git-scm.com/book/ru/v2/%D0%9E%D1%81%D0%BD%D0%BE%D0%B2%D1%8B-Git-%D0%97%D0%B0%D0%BF%D0%B8%D1%81%D1%8C-%D0%B8%D0%B7%D0%BC%D0%B5%D0%BD%D0%B5%D0%BD%D0%B8%D0%B9-%D0%B2-%D1%80%D0%B5%D0%BF%D0%BE%D0%B7%D0%B8%D1%82%D0%BE%D1%80%D0%B8%D0%B9' },
  ruLgb: { title: 'Learn Git Branching (русская версия)', url: 'https://learngitbranching.js.org/?locale=ru_RU' },
  ruYaml: { title: 'YAML — Википедия', url: 'https://ru.wikipedia.org/wiki/YAML' },
  ruVcs: { title: 'Система управления версиями — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%A1%D0%B8%D1%81%D1%82%D0%B5%D0%BC%D0%B0_%D1%83%D0%BF%D1%80%D0%B0%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D1%8F_%D0%B2%D0%B5%D1%80%D1%81%D0%B8%D1%8F%D0%BC%D0%B8' },
};

const src = (en: { title: string; url: string }[], ru: { title: string; url: string }[]): Sources => ({ en, ru });

// ── concepts ──

export const concepts: Concept[] = [
  { id: 'git.repo', term: bi('репозиторий', 'repository'), forms: { ru: ['репозитория', 'репозиторию', 'репозиторием', 'репозитории', 'репозиториев'], en: ['repositories', 'repo'] }, scan: false, short: bi('Каталог проекта вместе со скрытым .git, где Git хранит все сохранённые состояния и их историю.', 'A project directory together with the hidden .git where Git keeps every saved state and its history.'), introducedIn: 'git-yaml.repo', docRef: { page: 'man/git-init.1', anchor: 'DESCRIPTION' } },
  { id: 'git.commit', term: bi('коммит', 'commit'), forms: { ru: ['коммита', 'коммиту', 'коммитом', 'коммите', 'коммиты', 'коммитов', 'коммитам', 'коммитами'], en: ['commits'] }, scan: false, short: bi('Сохранённый снимок проекта с автором, временем, сообщением и ссылкой на родителя; называется хэшем содержимого.', 'A saved snapshot of the project with an author, a time, a message and a link to its parent; named by a hash of its content.'), introducedIn: 'git-yaml.repo', docRef: { page: 'man/git-commit.1', anchor: 'DESCRIPTION' } },
  { id: 'git.index', term: bi('индекс', 'index'), forms: { ru: ['индекса', 'индексу', 'индексом', 'индексе'] }, scan: false, short: bi('Черновик следующего коммита: git add кладёт туда текущее содержимое файла.', 'The draft of the next commit: git add puts the current content of a file there.'), introducedIn: 'git-yaml.repo', docRef: { page: 'man/git-add.1', anchor: 'DESCRIPTION', line: 'snapshot' } },
  { id: 'git.branch', term: bi('ветка', 'branch'), forms: { ru: ['ветки', 'ветке', 'ветку', 'веткой', 'веток', 'веткам', 'ветками', 'ветках'], en: ['branches'] }, scan: false, short: bi('Подвижное имя на одном коммите: при новом коммите оно переезжает на него.', 'A movable name on one commit: with a new commit it moves to that commit.'), introducedIn: 'git-yaml.branches', docRef: { page: 'man/git-branch.1', anchor: 'DESCRIPTION' } },
  { id: 'git.head', term: bi('HEAD', 'HEAD'), short: bi('Указатель «я здесь»: на какую ветку сейчас смотрит рабочий каталог.', 'The "you are here" pointer: which branch the working directory is on.'), introducedIn: 'git-yaml.branches', docRef: { page: 'man/git-switch.1', anchor: 'DESCRIPTION' } },
  { id: 'git.merge', term: bi('слияние', 'merge'), forms: { ru: ['слияния', 'слиянию', 'слиянием', 'слиянии'], en: ['merges', 'merging'] }, scan: false, short: bi('Объединение двух линий истории: перенос имени ветки (fast-forward) или коммит с двумя родителями.', 'Joining two lines of history: moving the branch name (fast-forward) or a commit with two parents.'), introducedIn: 'git-yaml.branches', docRef: { page: 'man/git-merge.1', anchor: 'DESCRIPTION' } },
  { id: 'git.conflict', term: bi('конфликт слияния', 'merge conflict'), forms: { ru: ['конфликта слияния', 'конфликты слияния', 'конфликтом слияния'], en: ['merge conflicts'] }, short: bi('Место, где обе ветки изменили одни и те же строки: Git ставит маркеры и ждёт решения человека.', 'A place where both branches changed the same lines: Git puts markers and waits for a human decision.'), introducedIn: 'git-yaml.branches', docRef: { page: 'man/git-merge.1', anchor: 'DESCRIPTION', line: 'conflict' } },
  { id: 'git.ignore', term: bi('.gitignore', '.gitignore'), short: bi('Файл со списком шаблонов того, что Git не должен отслеживать: зависимости, сборка, секреты.', 'A file listing patterns Git must not track: dependencies, build output, secrets.'), introducedIn: 'git-yaml.ignore', docRef: { page: 'man/gitignore.5', anchor: 'DESCRIPTION' } },
  { id: 'yaml.syntax', term: bi('YAML', 'YAML'), scan: false, short: bi('Текстовый формат данных: словари «ключ: значение», списки через «- », вложенность пробелами.', 'A text data format: "key: value" mappings, "- " lists, nesting by spaces.'), introducedIn: 'git-yaml.yaml', docRef: { url: 'https://yaml.org/spec/1.2.2/', label: 'YAML 1.2.2 spec' } },
  { id: 'yaml.traps', term: bi('ловушки YAML', 'YAML traps'), forms: { ru: ['ловушка YAML', 'ловушек YAML'], en: ['YAML trap'] }, short: bi('Значения, которые парсер понимает не как строку: yes и no, on, 0755, 1.10 — и разные версии YAML понимают их по-разному.', 'Values a parser does not read as strings: yes and no, on, 0755, 1.10 — and different YAML versions read them differently.'), introducedIn: 'git-yaml.yaml', docRef: { url: 'https://yaml.org/spec/1.2.2/', label: 'YAML 1.2.2 spec' } },
];

// ── quiz bank ──

const repoWithIndex = gitSetup({ repos: [{ path: '~/site', commits: [{ message: 'Add pages', files: PAGES }], worktree: { 'index.html': PAGES['index.html'].replace('Edu Cafe</h1>', 'Edu Cafe!</h1>') }, staged: ['index.html'] }] });

export const quiz: QuizItem[] = [
  {
    id: 'git.q.index-where',
    kind: 'mcq',
    concepts: ['git.index'],
    prompt: bi('Вы изменили index.html и выполнили `git add index.html`, а потом изменили файл ещё раз. Что попадёт в коммит после `git commit -m "…"`?', 'You changed index.html, ran `git add index.html`, then changed the file again. What goes into the commit after `git commit -m "…"`?'),
    options: [
      { id: 'added', text: bi('Версия на момент git add', 'The version at the moment of git add'), correct: true },
      { id: 'latest', text: bi('Последняя версия из рабочего каталога', 'The latest version from the working directory'), why: bi('Коммит собирается из индекса, а в индексе лежит содержимое на момент add. Вторую правку нужно добавить ещё раз.', 'A commit is built from the index, and the index holds the content from the moment of add. The second edit must be added again.') },
      { id: 'both', text: bi('Обе версии', 'Both versions'), why: bi('У файла в коммите одно содержимое; Git не хранит «историю набора» внутри коммита.', 'A file has one content in a commit; Git does not keep a typing history inside a commit.') },
      { id: 'none', text: bi('Ничего: Git откажется', 'Nothing: Git refuses'), why: bi('Индекс не пуст, поэтому коммит создаётся.', 'The index is not empty, so the commit is created.') },
    ],
    explain: bi('Индекс — черновик следующего коммита. git status в такой ситуации покажет файл дважды: в «Changes to be committed» и в «Changes not staged for commit».', 'The index is the draft of the next commit. git status shows such a file twice: under "Changes to be committed" and "Changes not staged for commit".'),
    refs: { lesson: 'git-yaml.repo' },
  },
  {
    id: 'git.q.status-short',
    kind: 'predict-output',
    concepts: ['git.index'],
    prompt: bi('В репозитории файл index.html изменён и добавлен в индекс. Что напечатает `git status --short`?', 'In the repository, index.html was changed and added to the index. What does `git status --short` print?'),
    command: 'git status --short',
    setup: repoWithIndex,
    options: [
      { id: 'm-', text: 'M  index.html', correct: true },
      { id: '-m', text: ' M index.html', why: bi('Буква во второй колонке — изменение, которого нет в индексе. Здесь изменение уже в индексе, поэтому буква в первой колонке.', 'A letter in the second column is a change that is not in the index. Here the change is already in the index, so the letter is in the first column.') },
      { id: 'qq', text: '?? index.html', why: bi('?? — неотслеживаемый файл, о котором Git ещё ничего не знает. index.html уже есть в коммите.', '?? is an untracked file Git knows nothing about. index.html is already in a commit.') },
      { id: 'a', text: 'A  index.html', why: bi('A — новый файл. Этот файл уже был в прошлом коммите, поэтому M.', 'A is a new file. This file was in the previous commit, so it is M.') },
    ],
    explain: bi('Короткий формат — две колонки: первая сравнивает индекс с последним коммитом, вторая — рабочий каталог с индексом.', 'The short format has two columns: the first compares the index with the last commit, the second the working directory with the index.'),
  },
  {
    id: 'git.q.commit-has',
    kind: 'multi',
    concepts: ['git.commit'],
    prompt: bi('Что записано в объекте коммита? Отметьте всё верное.', 'What is recorded in a commit object? Mark everything that is true.'),
    options: [
      { id: 'tree', text: bi('Ссылка на снимок файлов (tree)', 'A link to the file snapshot (tree)'), correct: true },
      { id: 'parent', text: bi('Ссылка на родительский коммит', 'A link to the parent commit'), correct: true },
      { id: 'author', text: bi('Автор, время и сообщение', 'The author, the time and the message'), correct: true },
      { id: 'diff', text: bi('Только изменённые строки (патч)', 'Only the changed lines (a patch)'), why: bi('Git хранит снимки, а не патчи: diff он вычисляет, сравнивая два снимка.', 'Git stores snapshots, not patches: it computes a diff by comparing two snapshots.') },
      { id: 'branch', text: bi('Имя ветки', 'The branch name'), why: bi('Коммит не знает, в какой он ветке: это ветка знает, на какой коммит указывает.', 'A commit does not know its branch: the branch knows which commit it points to.') },
    ],
  },
  {
    id: 'git.q.cmds',
    kind: 'match',
    concepts: ['git.index', 'git.commit'],
    prompt: bi('Сопоставьте команду и то, что она делает.', 'Match the command with what it does.'),
    pairs: [
      { id: 'add', left: 'git add f', right: bi('кладёт текущее содержимое f в индекс', 'puts the current content of f into the index') },
      { id: 'restore-s', left: 'git restore --staged f', right: bi('убирает f из индекса, правка остаётся', 'takes f out of the index, the edit stays') },
      { id: 'restore', left: 'git restore f', right: bi('отменяет правку f в рабочем каталоге', 'discards the edit of f in the working directory'), why: bi('Осторожно: несохранённая в индексе правка пропадает безвозвратно.', 'Careful: an edit that is not in the index is lost for good.') },
      { id: 'diff-s', left: 'git diff --staged', right: bi('показывает, что войдёт в следующий коммит', 'shows what goes into the next commit') },
    ],
  },
  {
    id: 'git.q.three-places',
    kind: 'label',
    concepts: ['git.index'],
    prompt: bi('Подпишите три места, где живёт версия файла.', 'Label the three places a version of a file lives in.'),
    diagram: {
      width: 600,
      height: 130,
      slots: [
        { id: 's1', x: 16, y: 40, w: 160, h: 56, answer: 'wt', family: 'ci-source' },
        { id: 's2', x: 220, y: 40, w: 160, h: 56, answer: 'idx', family: 'ci-build' },
        { id: 's3', x: 424, y: 40, w: 160, h: 56, answer: 'repo', family: 'store' },
      ],
      edges: [
        { from: 's1', to: 's2' },
        { from: 's2', to: 's3' },
      ],
    },
    labels: [
      { id: 'wt', text: bi('рабочий каталог', 'working directory') },
      { id: 'idx', text: bi('индекс (git add)', 'index (git add)') },
      { id: 'repo', text: bi('история коммитов (git commit)', 'commit history (git commit)') },
      { id: 'disk', text: bi('резервная копия на диске', 'a backup on disk'), why: bi('Git не делает резервных копий сам: всё, что он знает, лежит в .git рядом с файлами.', 'Git does not make backups by itself: everything it knows sits in .git next to the files.') },
    ],
  },
  {
    id: 'git.q.branch-cost',
    kind: 'mcq',
    concepts: ['git.branch'],
    prompt: bi('Что происходит на диске, когда вы создаёте ветку `git branch feature` в проекте на 2 ГБ?', 'What happens on disk when you create a branch with `git branch feature` in a 2 GB project?'),
    options: [
      { id: 'ref', text: bi('Появляется файл .git/refs/heads/feature с одним хэшем', 'A file .git/refs/heads/feature with one hash appears'), correct: true },
      { id: 'copy', text: bi('Git копирует все файлы проекта', 'Git copies all project files'), why: bi('Ветка ничего не копирует: это имя на коммите, 41 байт.', 'A branch copies nothing: it is a name on a commit, 41 bytes.') },
      { id: 'diff', text: bi('Git сохраняет разницу с main', 'Git saves the difference from main'), why: bi('Разницы ещё нет: новая ветка указывает на тот же коммит, что и текущая.', 'There is no difference yet: the new branch points to the same commit as the current one.') },
    ],
    explain: bi('Поэтому ветки дешёвы: их заводят на каждую задачу и удаляют после слияния.', 'That is why branches are cheap: you make one per task and delete it after the merge.'),
  },
  {
    id: 'git.q.ff',
    kind: 'mcq',
    concepts: ['git.merge'],
    prompt: bi('В main после ответвления feature не было новых коммитов. Что сделает `git merge feature` на main?', 'main had no new commits after feature branched off. What does `git merge feature` on main do?'),
    options: [
      { id: 'ff', text: bi('Передвинет main на последний коммит feature (fast-forward)', 'Move main to the last commit of feature (fast-forward)'), correct: true },
      { id: 'mc', text: bi('Создаст коммит слияния с двумя родителями', 'Create a merge commit with two parents'), why: bi('Коммит слияния нужен, когда истории разошлись. Здесь feature — прямое продолжение main, достаточно передвинуть имя (или попросить --no-ff).', 'A merge commit is needed when histories diverged. Here feature directly continues main, so moving the name is enough (unless you ask for --no-ff).') },
      { id: 'conflict', text: bi('Остановится с конфликтом', 'Stop with a conflict'), why: bi('Конфликт возможен, только когда обе стороны меняли одни строки; main ничего не менял.', 'A conflict is possible only when both sides changed the same lines; main changed nothing.') },
    ],
  },
  {
    id: 'git.q.markers',
    kind: 'bugfind',
    concepts: ['git.conflict'],
    prompt: bi('Вы «разрешили» конфликт и закоммитили файл. Какая строка выдаёт, что разрешение не закончено?', 'You "resolved" a conflict and committed the file. Which line shows the resolution is not finished?'),
    code: '<h1>Edu Cafe</h1>\n<p>Open daily 8–20</p>\n=======\n<p>We are a small team.</p>',
    bug: [3],
    why: {
      1: bi('Обычная строка страницы.', 'An ordinary line of the page.'),
      2: bi('Это одна из двух версий; оставить её — нормальное решение.', 'This is one of the two versions; keeping it is a fine decision.'),
      3: bi('Маркер ======= остался в файле: это разделитель «нашей» и «их» версии, его нужно удалить вместе с <<<<<<< и >>>>>>>.', 'The ======= marker stayed in the file: it separates "our" and "their" version and must be deleted together with <<<<<<< and >>>>>>>.'),
      4: bi('Вторая версия — тоже допустимое содержимое.', 'The second version is valid content too.'),
    },
  },
  {
    id: 'git.q.merge-order',
    kind: 'order',
    concepts: ['git.conflict'],
    prompt: bi('Расставьте шаги разрешения конфликта по порядку.', 'Put the steps of resolving a conflict in order.'),
    steps: [
      { id: 'merge', text: 'git merge feature' },
      { id: 'see', text: bi('git status показывает «both modified»', 'git status shows "both modified"') },
      { id: 'edit', text: bi('отредактировать файл и убрать маркеры', 'edit the file and remove the markers') },
      { id: 'add', text: 'git add about.html', why: bi('git add помечает конфликт решённым: именно так Git узнаёт, что вы закончили с файлом.', 'git add marks the conflict as resolved: that is how Git learns you are done with the file.') },
      { id: 'commit', text: 'git commit' },
    ],
  },
  {
    id: 'git.q.ignore',
    kind: 'bugfind',
    concepts: ['git.ignore'],
    prompt: bi('После этого .gitignore файл `.env` с паролями всё равно попал в коммит. Почему? Нажмите на причину.', 'With this .gitignore the `.env` file with passwords still got into a commit. Why? Click the cause.'),
    code: 'node_modules/\ndist/\n*.log\n!.env',
    bug: [4],
    why: {
      1: bi('Каталог зависимостей игнорируется — верно.', 'The dependencies directory is ignored — correct.'),
      2: bi('Каталог сборки игнорируется — верно.', 'The build directory is ignored — correct.'),
      3: bi('Журналы игнорируются — верно.', 'Logs are ignored — correct.'),
      4: bi('`!` возвращает файл в отслеживаемые: правило «!.env» говорит «не игнорировать .env». Нужна строка `.env` без восклицательного знака.', '`!` re-includes a file: the rule "!.env" means "do not ignore .env". You need `.env` without the exclamation mark.'),
    },
  },
  {
    id: 'git.q.secret',
    kind: 'mcq',
    concepts: ['git.ignore'],
    prompt: bi('Пароль уже попал в коммит, и коммит отправлен коллегам. Вы сделали `git rm --cached config.env` и добавили файл в .gitignore. Что ещё обязательно?', 'A password already got into a commit, and the commit was shared with colleagues. You ran `git rm --cached config.env` and added the file to .gitignore. What else is required?'),
    options: [
      { id: 'rotate', text: bi('Сменить пароль: старый остаётся в истории навсегда', 'Change the password: the old one stays in the history forever'), correct: true },
      { id: 'nothing', text: bi('Ничего: файл удалён', 'Nothing: the file is removed'), why: bi('Удалён только из следующих коммитов. Прошлый коммит с паролем по-прежнему в истории у каждого, кто её скопировал.', 'It is removed only from the next commits. The old commit with the password is still in the history of everyone who copied it.') },
      { id: 'ignore', text: bi('Достаточно .gitignore, он вычистит историю', '.gitignore is enough, it cleans the history'), why: bi('.gitignore действует только на неотслеживаемые файлы и никогда не трогает историю.', '.gitignore affects only untracked files and never touches the history.') },
    ],
  },
  {
    id: 'yaml.q.list',
    kind: 'mcq',
    concepts: ['yaml.syntax'],
    prompt: bi('Что получит парсер из этого фрагмента?\n\n```yaml\nservices:\n  - web\n  - db\n```', 'What does a parser get from this snippet?\n\n```yaml\nservices:\n  - web\n  - db\n```'),
    options: [
      { id: 'list', text: bi('Словарь с ключом services, значение — список из двух строк', 'A mapping with the key services whose value is a list of two strings'), correct: true },
      { id: 'str', text: bi('Строку "- web - db"', 'The string "- web - db"'), why: bi('Строки, начинающиеся с «- » под ключом, — элементы списка, а не текст.', 'Lines starting with "- " under a key are list items, not text.') },
      { id: 'two', text: bi('Два словаря web и db', 'Two mappings, web and db'), why: bi('Словарём элемент был бы с двоеточием: «- web: …».', 'An item would be a mapping with a colon: "- web: …".') },
    ],
  },
  {
    id: 'yaml.q.indent',
    kind: 'bugfind',
    concepts: ['yaml.syntax'],
    prompt: bi('Парсер выдаёт ошибку. На какой строке?', 'The parser reports an error. On which line?'),
    code: 'app:\n  name: site\n  port: 8080\n   debug: true',
    bug: [4],
    why: {
      1: bi('Ключ верхнего уровня — верно.', 'A top-level key — fine.'),
      2: bi('Два пробела — вложенный ключ, верно.', 'Two spaces: a nested key, fine.'),
      3: bi('Тот же уровень, что и name, — верно.', 'The same level as name — fine.'),
      4: bi('Три пробела вместо двух: debug не на уровне соседей, и парсер не понимает, чьё это значение.', 'Three spaces instead of two: debug is not at the level of its siblings, and the parser cannot tell whose value it is.'),
    },
  },
  {
    id: 'yaml.q.norway',
    kind: 'multi',
    concepts: ['yaml.traps'],
    prompt: bi('Какие значения парсер YAML 1.1 прочитает НЕ как строку? Отметьте всё.', 'Which values does a YAML 1.1 parser read NOT as a string? Mark them all.'),
    options: [
      { id: 'no', text: 'country: NO', correct: true },
      { id: 'mode', text: 'mode: 0755', correct: true },
      { id: 'ver', text: 'version: 1.10', correct: true },
      { id: 'on', text: 'on: push', correct: true },
      { id: 'q', text: 'country: "NO"', why: bi('Кавычки делают значение строкой в любой версии YAML.', 'Quotes make a value a string in any YAML version.') },
      { id: 'name', text: 'name: site', why: bi('Обычное слово — строка.', 'An ordinary word is a string.') },
    ],
    explain: bi('NO и on в YAML 1.1 — логические значения, 0755 — восьмеричное число 493, 1.10 — дробное 1.1 (и в YAML 1.2 тоже). Строковые значения, похожие на числа и «да/нет», берут в кавычки.', 'In YAML 1.1, NO and on are booleans, 0755 is the octal number 493, 1.10 is the float 1.1 (in YAML 1.2 as well). String values that look like numbers or yes/no are quoted.'),
  },
  {
    id: 'yaml.q.fill-lint',
    kind: 'fill-command',
    concepts: ['yaml.syntax'],
    prompt: bi('Проверьте файл `config.yaml` линтером YAML.', 'Check `config.yaml` with the YAML linter.'),
    template: '___ config.yaml',
    answers: ['yamllint config.yaml'],
  },
];

// ── lessons ──

const repoLesson: Lesson = {
  id: 'git-yaml.repo',
  block: 'git-yaml',
  title: bi('Репозиторий и коммит: три места файла', 'Repository and commit: the three places of a file'),
  summary: bi('Git помнит только те состояния проекта, которые вы явно сохранили; между правкой и историей стоит индекс.', 'Git remembers only the project states you saved explicitly; between an edit and the history stands the index.'),
  introduces: ['git.repo', 'git.commit', 'git.index'],
  uses: [],
  tier: 'core',
  minutes: 35,
  sources: src([S.progit, S.progitIgnore, S.ref], [S.ruBook, S.ruRecord, S.ruVcs]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В пятницу сайт кафе работал. В понедельник на нём пустая страница, а в каталоге лежат `index.html`, `index-old.html`, `index-final.html` и `index-final2.html`. Какая из них работала в пятницу — не помнит никто. Это задача, которую решает система контроля версий: помнить каждое сохранённое состояние проекта и уметь к нему вернуться.',
        'On Friday the café website worked. On Monday it shows a blank page, and the directory holds `index.html`, `index-old.html`, `index-final.html` and `index-final2.html`. Nobody remembers which one worked on Friday. This is the problem a version control system solves: remember every saved state of a project and be able to go back to it.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      title: bi('Что такое репозиторий и коммит', 'What a repository and a commit are'),
      body: bi(
        'Git превращает обычный каталог проекта в [[git.repo|репозиторий]]: команда `git init` создаёт внутри скрытый каталог `.git`, и там Git хранит всё, что запомнил. Файлы, которые вы видите и правите, называются **рабочим каталогом** — это по-прежнему просто файлы.\n\nGit не следит за каждым нажатием клавиши. Состояние проекта сохраняется только тогда, когда вы об этом просите, и такое сохранённое состояние называется [[git.commit|коммитом]]. Коммит — это снимок всех файлов проекта плюс автор, время, сообщение «что и зачем изменено» и ссылка на предыдущий коммит. Цепочка таких ссылок и есть история проекта: от последнего коммита можно пройти назад до самого первого.\n\nУ коммита нет порядкового номера. Его имя — хэш: 40 шестнадцатеричных цифр, вычисленных из содержимого (`git log` показывает первые семь, например `1a2b3c4`). Если изменить в коммите хоть букву, получится другой хэш, поэтому историю нельзя незаметно подменить.\n\n### Индекс: черновик следующего коммита\n\nМежду рабочим каталогом и историей стоит третье место — [[git.index|индекс]]. Команда `git add index.html` кладёт в индекс *текущее* содержимое файла, а `git commit` превращает индекс в новый коммит. Зачем лишний шаг? Он позволяет собрать в один коммит только то, что относится к одному изменению: исправили заголовок и заодно начали писать новую страницу — в коммит «Fix title» пойдёт только заголовок.\n\nЕсли изменить файл после `git add`, в индексе останется старая версия. Поэтому главная команда Git — `git status`: она всегда отвечает, какие файлы отличаются от последнего коммита, какие уже в индексе и о каких Git ещё не знает. А `git diff` показывает сами строки: без аргументов — чем рабочий каталог отличается от индекса, с ключом `--staged` — что войдёт в следующий коммит.',
        'Git turns an ordinary project directory into a [[git.repo|repository]]: `git init` creates a hidden `.git` directory inside, and Git keeps everything it remembers there. The files you see and edit are the **working directory**; they are still just files.\n\nGit does not watch every keystroke. The state of the project is saved only when you ask, and such a saved state is called a [[git.commit|commit]]. A commit is a snapshot of all project files plus the author, the time, a message saying what changed and why, and a link to the previous commit. The chain of these links is the project history: from the last commit you can walk back to the very first one.\n\nA commit has no sequence number. Its name is a hash: 40 hexadecimal digits computed from its content (`git log` shows the first seven, like `1a2b3c4`). Change one letter in a commit and you get another hash, so the history cannot be quietly replaced.\n\n### The index: the draft of the next commit\n\nBetween the working directory and the history there is a third place: the [[git.index|index]]. `git add index.html` puts the *current* content of the file into the index, and `git commit` turns the index into a new commit. Why the extra step? It lets you put into one commit only what belongs to one change: you fixed the title and also started a new page, and the commit "Fix title" gets only the title.\n\nIf you edit a file after `git add`, the index keeps the old version. That is why the main Git command is `git status`: it always tells you which files differ from the last commit, which are already in the index, and which Git does not know yet. `git diff` shows the lines themselves: without arguments, how the working directory differs from the index; with `--staged`, what goes into the next commit.',
      ),
    },
    {
      id: 'identity',
      kind: 'callout',
      tone: 'note',
      title: bi('Перед первым коммитом', 'Before the first commit'),
      body: bi(
        'Git записывает в каждый коммит автора, поэтому один раз на машине нужно представиться: `git config --global user.name "Имя Фамилия"` и `git config --global user.email "you@example.com"`. Без этого первый `git commit` остановится с сообщением *Author identity unknown*. Файлы удобно править командой `edit index.html`: откроется редактор, Ctrl+S сохраняет.',
        'Git writes the author into every commit, so once per machine you introduce yourself: `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`. Without it the first `git commit` stops with *Author identity unknown*. To edit files, use `edit index.html`: an editor opens, Ctrl+S saves.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: { cwd: '~/site', files: siteFiles(), ext: { git: { config: CONFIG } } },
      intro: bi('В `~/site` лежат две страницы сайта кафе. Репозитория ещё нет.', '`~/site` holds two pages of the café site. There is no repository yet.'),
      tasks: [
        {
          id: 'whoami',
          prompt: bi('Представьтесь Git: задайте глобально имя и почту автора.', 'Introduce yourself to Git: set the author name and email globally.'),
          check: { when: (f) => !!(f.files[`${HOME}/.gitconfig`]?.text ?? '').match(/email\s*=\s*\S+@\S+/) && /name\s*=\s*\S/.test(f.files[`${HOME}/.gitconfig`]?.text ?? '') },
          chips: 'git config --global user.name "Ada Lovelace"',
          docRef: { page: 'man/git-config.1', anchor: 'OPTIONS', line: '--global' },
          hints: { H1: bi('Нужны две настройки: user.name и user.email.', 'You need two settings: user.name and user.email.'), H2: bi('`git config --global user.name "…"`, затем так же user.email.', '`git config --global user.name "…"`, then the same for user.email.') },
        },
        {
          id: 'init',
          prompt: bi('Сделайте из `~/site` репозиторий.', 'Turn `~/site` into a repository.'),
          check: { when: (f) => !!repo(f), fail: [{ if: (f) => !!f.git && (f.git as { repos: { path: string }[] }).repos.some((r) => r.path !== SITE), say: bi('Репозиторий создан не в том каталоге: нужен именно ~/site.', 'The repository is in the wrong directory: it must be ~/site.') }] },
          chips: 'git init',
          concepts: ['git.repo'],
          docRef: { page: 'man/git-init.1', anchor: 'DESCRIPTION' },
          hints: { H1: bi('Команда, которая создаёт .git, называется так же, как «начать».', 'The command that creates .git is named like "initialise".') },
        },
        {
          id: 'first',
          prompt: bi('Сохраните в первом коммите **только** `index.html`; `about.html` пока не трогайте.', 'Save **only** `index.html` in the first commit; leave `about.html` alone for now.'),
          check: {
            when: (f) => {
              const r = repo(f);
              const c = r?.commits[r.commits.length - 1];
              return !!c && Object.keys(c.files).join() === 'index.html' && c.message.trim().length > 0;
            },
            fail: [
              { if: (f) => (repo(f)?.commits.at(-1) && Object.keys(repo(f)!.commits.at(-1)!.files).includes('about.html')) || false, say: bi('В первый коммит попал и about.html: в индекс нужно было добавить один файл, а не весь каталог.', 'about.html got into the first commit too: you had to add one file to the index, not the whole directory.') },
              { if: (f) => !!repo(f) && repo(f)!.status.staged.includes('index.html'), say: bi('index.html в индексе — осталось записать коммит.', 'index.html is in the index; now record the commit.') },
            ],
          },
          chips: 'git add index.html && git commit -m "Add the home page"',
          concepts: ['git.index', 'git.commit'],
          docRef: { page: 'man/git-commit.1', anchor: 'OPTIONS', line: '-m <msg>' },
          hints: { H1: bi('Сначала в индекс, потом в историю.', 'First into the index, then into the history.'), H2: bi('`git add index.html`, затем `git commit -m "…"` с осмысленным сообщением.', '`git add index.html`, then `git commit -m "…"` with a meaningful message.') },
        },
        {
          id: 'second',
          prompt: bi('Поменяйте заголовок `<h1>` в `index.html` на «Edu Cafe — open daily», посмотрите `git diff`, а затем одним коммитом сохраните эту правку и `about.html`. В конце `git status` должен сказать, что всё чисто.', 'Change the `<h1>` heading in `index.html` to "Edu Cafe — open daily", look at `git diff`, then save the edit and `about.html` in one commit. At the end `git status` must say everything is clean.'),
          check: {
            when: (f) => {
              const r = repo(f);
              const c = head(f);
              return !!r && r.commits.length >= 2 && !!c && /<h1>Edu Cafe — open daily<\/h1>/.test(c.files['index.html'] ?? '') && 'about.html' in c.files && !r.status.staged.length && !r.status.unstaged.length && !r.status.untracked.length;
            },
            fail: [
              { if: (f) => (repo(f)?.status.unstaged ?? []).includes('index.html'), say: bi('Правка index.html есть в рабочем каталоге, но не в индексе. Сделайте git add ещё раз.', 'The edit of index.html is in the working directory but not in the index. Run git add again.') },
              { if: (f) => (repo(f)?.status.untracked ?? []).includes('about.html'), say: bi('about.html всё ещё неотслеживаемый: Git о нём не знает, пока вы его не добавите.', 'about.html is still untracked: Git does not know it until you add it.') },
            ],
          },
          chips: 'edit index.html',
          concepts: ['git.index'],
          docRef: { page: 'man/git-diff.1', anchor: 'DESCRIPTION', line: 'relative to the index' },
          hints: { H1: bi('Правка → git diff → git add обоих файлов → git commit.', 'Edit → git diff → git add both files → git commit.'), H2: bi('`edit index.html`, `git diff`, `git add index.html about.html`, `git commit -m "Open daily, add About"`.', '`edit index.html`, `git diff`, `git add index.html about.html`, `git commit -m "Open daily, add About"`.') },
        },
        {
          id: 'log',
          prompt: bi('Покажите историю — по одной строке на коммит.', 'Show the history, one line per commit.'),
          check: { when: "term['main'][last].exit=0", stdout: /^[0-9a-f]{7} .*\n[0-9a-f]{7} /m },
          chips: 'git log --oneline',
          docRef: { page: 'man/git-log.1', anchor: 'OPTIONS', line: '--oneline' },
          hints: { H1: bi('История — git log; у него есть ключ для короткого вида.', 'The history is git log; it has a key for a short form.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('У каждой команды Git есть страница руководства: `git help commit` или `git commit --help`. В каком разделе описано, что делает ключ `-m`? Нажмите на него.', 'Every Git command has a manual page: `git help commit` or `git commit --help`. Which section describes what the `-m` key does? Click it.'),
      ref: { page: 'man/git-commit.1' },
      answer: 'OPTIONS',
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['git.q.index-where', 'git.q.status-short', 'git.q.commit-has', 'git.q.cmds', 'git.q.three-places'] },
  ],
};

const branchSetup = gitSetup({ repos: [{ path: '~/site', commits: [{ message: 'Add the home page', files: { 'index.html': PAGES['index.html'] } }, { message: 'Add About', files: { 'about.html': PAGES['about.html'] } }] }] });
const conflictSetup = gitSetup({
  repos: [
    {
      path: '~/site',
      commits: [
        { message: 'Add pages', files: PAGES },
        { message: 'Say who we are', branch: 'team-text', files: { 'about.html': PAGES['about.html'].replace('We are a small team.', 'We are a small team of baristas.') } },
        { message: 'Update the About text', branch: 'main', files: { 'about.html': PAGES['about.html'].replace('We are a small team.', 'Open daily 8–20.') } },
      ],
      checkout: 'main',
    },
  ],
});

const branchesLesson: Lesson = {
  id: 'git-yaml.branches',
  block: 'git-yaml',
  title: bi('Ветки, HEAD и слияние', 'Branches, HEAD and merging'),
  summary: bi('Ветка ничего не копирует — она указывает на коммит. Слияние соединяет две линии истории, а конфликт решает человек.', 'A branch copies nothing: it points to a commit. A merge joins two lines of history, and a person resolves a conflict.'),
  introduces: ['git.branch', 'git.head', 'git.merge', 'git.conflict'],
  uses: ['git.commit', 'git.index'],
  tier: 'core',
  minutes: 40,
  sources: src([S.progitBranch, S.progitMerge, S.lgb], [S.ruBranch, S.ruMerge, S.ruLgb]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Вы начали страницу контактов, и тут просят срочно поправить опечатку на главной. Если работать в одном потоке, опечатка уедет на сайт вместе с недописанными контактами. Нужно отложить одну работу в сторону, сделать другую и потом соединить их — не копируя проект в соседний каталог.',
        'You started a contacts page, and then you are asked to fix a typo on the home page right away. In a single line of work the typo fix would go out together with the half-done contacts. You need to set one piece of work aside, do the other, and join them later, without copying the project into another directory.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      title: bi('Ветка — это имя на коммите', 'A branch is a name on a commit'),
      body: bi(
        'Каждый коммит знает своего родителя, поэтому история — цепочка. [[git.branch|Ветка]] — просто подвижное имя, приклеенное к одному коммиту этой цепочки: файл `.git/refs/heads/main`, в котором записан один хэш. Когда вы делаете коммит, Git записывает в этот файл хэш нового коммита — имя переезжает вперёд. Создать ветку — значит записать ещё один такой файл; ничего не копируется, поэтому ветки заводят на каждую задачу.\n\nОткуда Git знает, какую ветку двигать? Для этого есть [[git.head|HEAD]] — указатель «я здесь». Обычно он указывает не на коммит, а на ветку: в файле `.git/HEAD` написано `ref: refs/heads/main`. `git switch contacts` переклеивает HEAD на другую ветку и приводит рабочий каталог к её коммиту. `git switch -c contacts` создаёт ветку и сразу на неё переходит.\n\n### Слияние\n\nКогда работа в ветке готова, её соединяют с основной — это [[git.merge|слияние]], команда `git merge`. Бывает два случая. Если в `main` с момента ответвления ничего не появилось, ветка — прямое продолжение `main`, и Git просто передвигает имя `main` вперёд (*fast-forward*). Если же обе ветки ушли вперёд, Git создаёт коммит слияния с двумя родителями: в нём соединены изменения обеих сторон.\n\nОбычно Git соединяет изменения сам: одна сторона правила заголовок, другая — подвал, и обе правки попадают в результат. Но если обе ветки изменили одни и те же строки, Git не знает, какая версия правильная. Это [[git.conflict|конфликт слияния]]: слияние останавливается, в файле появляются маркеры\n\n```\n<<<<<<< HEAD\nнаша версия\n=======\nих версия\n>>>>>>> team-text\n```\n\nи Git ждёт решения человека. Вы правите файл так, как должно быть, удаляете маркеры, делаете `git add` — это знак «конфликт решён» — и завершаете слияние командой `git commit`. Передумали — `git merge --abort` вернёт всё как было до слияния.',
        'Every commit knows its parent, so the history is a chain. A [[git.branch|branch]] is just a movable name stuck on one commit of that chain: the file `.git/refs/heads/main` with one hash in it. When you commit, Git writes the hash of the new commit into that file, and the name moves forward. Creating a branch means writing one more such file; nothing is copied, so you make a branch for every task.\n\nHow does Git know which branch to move? That is what [[git.head|HEAD]] is for: the "you are here" pointer. Usually it points not to a commit but to a branch: the file `.git/HEAD` says `ref: refs/heads/main`. `git switch contacts` moves HEAD to another branch and brings the working directory to its commit. `git switch -c contacts` creates a branch and switches to it at once.\n\n### Merging\n\nWhen the work on a branch is ready, you join it with the main line: a [[git.merge|merge]], the command `git merge`. There are two cases. If nothing new appeared on `main` since the branch was made, the branch directly continues `main`, and Git simply moves the name `main` forward (*fast-forward*). If both branches moved on, Git creates a merge commit with two parents that joins the changes of both sides.\n\nUsually Git joins the changes by itself: one side edited the heading, the other the footer, and both edits end up in the result. But if both branches changed the same lines, Git cannot know which version is right. That is a [[git.conflict|merge conflict]]: the merge stops, markers appear in the file\n\n```\n<<<<<<< HEAD\nour version\n=======\ntheir version\n>>>>>>> team-text\n```\n\nand Git waits for a human decision. You edit the file to what it should be, delete the markers, run `git add` (the sign "conflict resolved") and finish the merge with `git commit`. Changed your mind? `git merge --abort` brings everything back to how it was before the merge.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: branchSetup,
      intro: bi('В `~/site` репозиторий с двумя коммитами в main.', '`~/site` is a repository with two commits on main.'),
      tasks: [
        {
          id: 'branch',
          prompt: bi('Создайте ветку `contacts`, перейдите на неё и закоммитьте новый файл `contacts.html`.', 'Create a branch `contacts`, switch to it and commit a new file `contacts.html`.'),
          check: {
            when: (f) => {
              const r = repo(f);
              const tip = r?.branches.contacts;
              const c = r?.commits.find((x) => x.oid === tip);
              return !!c && 'contacts.html' in c.files && tip !== r?.branches.main;
            },
            fail: [{ if: (f) => !!repo(f)?.branches.main && 'contacts.html' in (repo(f)!.commits.find((c) => c.oid === repo(f)!.branches.main)?.files ?? {}), say: bi('Коммит попал в main: перед коммитом нужно было перейти на ветку contacts.', 'The commit went to main: you had to switch to the contacts branch before committing.') }],
          },
          chips: 'git switch -c contacts',
          concepts: ['git.branch', 'git.head'],
          docRef: { page: 'man/git-switch.1', anchor: 'OPTIONS', line: '--create' },
          hints: { H1: bi('Ветка, переход на неё, файл, add, commit.', 'A branch, a switch to it, a file, add, commit.'), H2: bi('`git switch -c contacts`, потом `echo "<h1>Contacts</h1>" > contacts.html`, `git add`, `git commit -m "…"`.', '`git switch -c contacts`, then `echo "<h1>Contacts</h1>" > contacts.html`, `git add`, `git commit -m "…"`.') },
        },
        {
          id: 'merge',
          prompt: bi('Вернитесь в `main` и влейте в неё `contacts`.', 'Go back to `main` and merge `contacts` into it.'),
          check: {
            when: (f) => {
              const r = repo(f);
              return !!r && r.branch === 'main' && !!r.branches.contacts && r.branches.main === r.branches.contacts;
            },
            fail: [{ if: (f) => repo(f)?.branch === 'contacts', say: bi('Вы всё ещё на contacts. Слияние делают из той ветки, которая должна получить изменения.', 'You are still on contacts. You merge from the branch that should receive the changes.') }],
          },
          chips: 'git switch main && git merge contacts',
          concepts: ['git.merge'],
          docRef: { page: 'man/git-merge.1', anchor: 'DESCRIPTION', line: 'fast-forward' },
          hints: { H1: bi('В main не было новых коммитов: Git просто передвинет имя.', 'main had no new commits: Git will just move the name.') },
        },
        {
          id: 'graph',
          prompt: bi('Найдите в `git help log` ключ, который рисует ветки графом слева от истории, и покажите историю всех веток одной строкой на коммит с этим графом.', 'Find in `git help log` the key that draws branches as a graph to the left of the history, and show the history of all branches one line per commit with that graph.'),
          check: { when: "term['main'][last].exit=0", stdout: /^\* [0-9a-f]{7} /m },
          docStep: 3,
          chips: 'git log --oneline --graph --all',
          docRef: { page: 'man/git-log.1', anchor: 'OPTIONS', line: '--graph' },
          hints: { H1: bi('Ключ описан в разделе OPTIONS; его название — «граф» по-английски.', 'The key is in the OPTIONS section; its name is "graph".') },
        },
      ],
    },
    {
      id: 'conflict',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: conflictSetup,
      intro: bi('Два человека поменяли одну строку `about.html`: в `main` написали часы работы, в ветке `team-text` — кто мы. Нужны обе строки.', 'Two people changed one line of `about.html`: on `main` someone wrote the opening hours, on `team-text` who we are. Both lines are needed.'),
      tasks: [
        {
          id: 'resolve',
          prompt: bi('Влейте `team-text` в `main`, оставьте в `about.html` **обе** строки (сначала про команду, потом часы) и завершите слияние.', 'Merge `team-text` into `main`, keep **both** lines in `about.html` (first about the team, then the hours) and finish the merge.'),
          check: {
            when: (f) => {
              const c = head(f);
              const t = c?.files['about.html'] ?? '';
              return !!c && c.parents.length === 2 && !/^(<{7}|={7}|>{7})/m.test(t) && t.includes('small team of baristas') && t.includes('Open daily 8–20') && t.indexOf('baristas') < t.indexOf('Open daily');
            },
            fail: [
              { if: (f) => /^(<{7}|={7}|>{7})/m.test(f.files[`${SITE}/about.html`]?.text ?? ''), say: bi('В файле остались маркеры конфликта. Удалите строки <<<<<<<, ======= и >>>>>>>.', 'Conflict markers are still in the file. Delete the <<<<<<<, ======= and >>>>>>> lines.') },
              { if: (f) => (repo(f)?.status.conflicted ?? []).length > 0, say: bi('Git всё ещё считает about.html конфликтным: после правки сделайте git add about.html.', 'Git still sees about.html as conflicted: after editing, run git add about.html.') },
              { if: (f) => !!repo(f)?.merging, say: bi('Конфликт решён, осталось записать коммит слияния: git commit.', 'The conflict is resolved; now record the merge commit: git commit.') },
            ],
          },
          chips: 'git merge team-text',
          concepts: ['git.conflict'],
          docRef: { page: 'man/git-merge.1', anchor: 'DESCRIPTION', line: '<<<<<<<' },
          hints: { H1: bi('После git merge откройте about.html: между маркерами две версии одной строки.', 'After git merge open about.html: between the markers there are two versions of one line.'), H2: bi('`edit about.html`: оставьте обе строки, удалите маркеры, затем `git add about.html` и `git commit`.', '`edit about.html`: keep both lines, delete the markers, then `git add about.html` and `git commit`.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['git.q.branch-cost', 'git.q.ff', 'git.q.markers', 'git.q.merge-order'] },
  ],
};

const ignoreSetup = gitSetup({
  repos: [{ path: '~/site', commits: [{ message: 'Add pages', files: PAGES }, { message: 'Add contacts', files: { 'contacts.html': '<h1>Contacts</h1>\n' } }, { message: 'Fix About', files: { 'about.html': PAGES['about.html'].replace('small team', 'small friendly team') } }] }],
}, {
  files: [
    { path: `${SITE}/node_modules/minify/index.js`, content: 'module.exports = (s) => s.trim();\n' },
    { path: `${SITE}/dist/index.html`, content: PAGES['index.html'] },
    { path: `${SITE}/server.log`, content: 'GET / 200\n' },
    { path: `${SITE}/.env`, content: 'DB_PASSWORD=Kofe-2026-very-secret\n' },
    { path: `${SITE}/.env.example`, content: 'DB_PASSWORD=change-me\n' },
  ],
});

const ignoreLesson: Lesson = {
  id: 'git-yaml.ignore',
  block: 'git-yaml',
  title: bi('.gitignore: что не должно попасть в репозиторий', '.gitignore: what must not get into a repository'),
  summary: bi('Что не попало в репозиторий, то не утечёт; что попало — остаётся в истории навсегда.', 'What never got into a repository cannot leak; what got in stays in the history forever.'),
  introduces: ['git.ignore'],
  uses: ['git.commit', 'git.index'],
  tier: 'core',
  minutes: 25,
  sources: src([S.gitignore, S.progitIgnore], [S.ruRecord, S.ruBook]),
  sections: [
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'В каталоге проекта всегда есть файлы, которым не место в истории: зависимости (`node_modules/` весит сотни мегабайт и восстанавливается одной командой), результаты сборки (`dist/`), журналы, а главное — файлы с паролями и ключами вроде `.env`. Если их не исключить, `git add .` захватит всё.\n\nСписок исключений лежит в файле [[git.ignore|.gitignore]] в корне репозитория — по шаблону на строку: `node_modules/` (косая черта в конце — только каталог), `*.log` (любой файл с таким окончанием в любом каталоге), `/build` (только в корне), `!.env.example` (восклицательный знак возвращает файл, исключённый правилом выше). `git status` перестаёт показывать такие файлы, а `git add` отказывается их добавлять без ключа `-f`. Сам `.gitignore` коммитят: правила нужны всей команде.\n\n### Секреты и история\n\n`.gitignore` действует только на неотслеживаемые файлы. Если `.env` уже попал в коммит, строка в `.gitignore` ничего не изменит: Git продолжит следить за файлом. Убрать его из отслеживаемых, не удаляя с диска, можно командой `git rm --cached .env`. Но прошлые коммиты останутся такими, какими были, — со старым паролем внутри, и у каждого, кто скопировал историю. Поэтому правило работы простое: секрет, попавший в коммит, считается утёкшим и **меняется**. А чтобы коллеги знали, какие настройки нужны, коммитят пример без значений — `.env.example`.',
        'A project directory always has files that do not belong in the history: dependencies (`node_modules/` weighs hundreds of megabytes and is restored by one command), build output (`dist/`), logs, and above all files with passwords and keys such as `.env`. If you do not exclude them, `git add .` picks up everything.\n\nThe list of exclusions is the [[git.ignore|.gitignore]] file in the repository root, one pattern per line: `node_modules/` (a trailing slash means a directory only), `*.log` (any file with that ending in any directory), `/build` (in the root only), `!.env.example` (an exclamation mark brings back a file excluded by a rule above). `git status` stops showing such files, and `git add` refuses to add them without `-f`. The `.gitignore` itself is committed: the whole team needs the rules.\n\n### Secrets and the history\n\n`.gitignore` affects only untracked files. If `.env` already got into a commit, a line in `.gitignore` changes nothing: Git keeps tracking the file. `git rm --cached .env` stops tracking it without deleting it from disk. But the old commits stay as they were, with the old password inside, for everyone who copied the history. So the working rule is simple: a secret that got into a commit is considered leaked and is **changed**. To let colleagues know which settings are needed, you commit an example without values: `.env.example`.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: ignoreSetup,
      intro: bi('В `~/site` появились зависимости, сборка, журнал и `.env` с паролем. `git status` показывает их все.', '`~/site` now has dependencies, a build, a log and `.env` with a password. `git status` shows them all.'),
      tasks: [
        {
          id: 'ignore',
          prompt: bi('Напишите `.gitignore`, после которого `git status` покажет из новых файлов только `.gitignore` и `.env.example`, и закоммитьте оба.', 'Write a `.gitignore` after which `git status` shows only `.gitignore` and `.env.example` among the new files, and commit both.'),
          check: {
            when: (f) => {
              const r = repo(f);
              const c = head(f);
              return !!r && !!c && '.gitignore' in c.files && '.env.example' in c.files && !('.env' in c.files) && !Object.keys(c.files).some((p) => p.startsWith('node_modules/') || p.startsWith('dist/') || p.endsWith('.log')) && r.status.untracked.length === 0;
            },
            fail: [
              { if: (f) => '.env' in (head(f)?.files ?? {}), say: bi('.env с паролем попал в коммит. Теперь пароль в истории: уберите файл (git rm --cached .env) и считайте пароль утёкшим.', '.env with the password got into a commit. The password is now in the history: untrack it (git rm --cached .env) and treat the password as leaked.') },
              { if: (f) => (repo(f)?.status.untracked ?? []).some((p) => p.startsWith('node_modules/')), say: bi('node_modules всё ещё виден: шаблон каталога пишут с косой чертой в конце — node_modules/.', 'node_modules is still visible: a directory pattern has a trailing slash, node_modules/.') },
              { if: (f) => (repo(f)?.status.untracked ?? []).includes('.env.example') && !(repo(f)?.status.untracked ?? []).includes('.env'), say: bi('Правила верные. Осталось добавить .gitignore и .env.example и закоммитить.', 'The rules are right. Now add .gitignore and .env.example and commit.') },
            ],
          },
          chips: 'edit .gitignore',
          concepts: ['git.ignore'],
          docRef: { page: 'man/gitignore.5', anchor: 'DESCRIPTION', line: 'trailing' },
          hints: { H1: bi('Четыре правила: зависимости, сборка, журналы, .env.', 'Four rules: dependencies, build, logs, .env.'), H2: bi('В `.gitignore`: `node_modules/`, `dist/`, `*.log`, `.env`. Потом `git add .gitignore .env.example` и коммит.', 'In `.gitignore`: `node_modules/`, `dist/`, `*.log`, `.env`. Then `git add .gitignore .env.example` and commit.') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Покажите историю только тех коммитов, которые меняли `about.html`, — по строке на коммит. В уроке этого не было: найдите в `git help log`.', 'Show the history of only those commits that changed `about.html`, one line per commit. The lesson did not cover it: look it up in `git help log`.'),
      ref: { page: 'man/git-log.1' },
      terminal: {
        setup: ignoreSetup,
        task: {
          id: 'pathlog',
          prompt: bi('История одного файла: только коммиты, менявшие about.html.', 'The history of one file: only the commits that changed about.html.'),
          check: { stdout: /^(?![\s\S]*Add contacts)[0-9a-f]{7}[^\n]*Fix About\n[0-9a-f]{7}[^\n]*Add pages\n?$/ },
          docStep: 4,
          beyond: true,
          solutionTokens: ['-- about.html', 'git log --oneline about.html', '<path>'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['git.q.ignore', 'git.q.secret'] },
  ],
};

const yamlLesson: Lesson = {
  id: 'git-yaml.yaml',
  block: 'git-yaml',
  title: bi('YAML и его ловушки', 'YAML and its traps'),
  summary: bi('Конфигурации инфраструктуры пишут на YAML; читать его нужно так, как читает парсер.', 'Infrastructure configuration is written in YAML; you have to read it the way a parser does.'),
  introduces: ['yaml.syntax', 'yaml.traps'],
  uses: ['git.commit'],
  tier: 'core',
  minutes: 30,
  sources: src([S.yaml, S.yamllint, S.norway], [S.ruYaml, S.ruRecord]),
  sections: [
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      title: bi('Словари, списки, отступы', 'Mappings, lists, indentation'),
      body: bi(
        'Почти все файлы настройки, с которыми вы встретитесь дальше, — описание сборки, развёртывания, мониторинга — написаны на [[yaml.syntax|YAML]]. Это способ записать данные текстом так, чтобы его было удобно читать человеку и однозначно понимать программе.\n\nВ YAML три кирпича. **Словарь** — пары «ключ: значение», после двоеточия обязателен пробел: `name: site`. **Список** — строки, начинающиеся с «- »: каждая — элемент. **Вложенность** задаётся отступом, и только пробелами: табуляция в отступе — синтаксическая ошибка. Всё, что сдвинуто правее ключа, принадлежит ему:\n\n```yaml\nsite:\n  name: edu-cafe\n  pages:\n    - index.html\n    - about.html\n```\n\nЗдесь у `site` словарь из двух ключей, а `pages` — список из двух строк. Ошибиться на один пробел — значит изменить смысл: лишний пробел перед ключом делает его чужим, и парсер либо падает, либо собирает не то дерево, которое вы имели в виду. Длинный текст пишут блоками: `|` сохраняет переводы строк (так записывают скрипты), `>` склеивает строки в одну.\n\n### Что парсер понимает не как строку\n\nПарсер сам решает, какого типа значение: `8080` — число, `true` — логическое, `~` или пусто — «ничего». На этом построены [[yaml.traps|ловушки YAML]]. Старая версия языка, YAML 1.1 (её до сих пор читают PyYAML и многие инструменты), считает логическими ещё и `yes`, `no`, `on`, `off`: строка `country: NO` превращается в `false` — это знаменитая «норвежская проблема». Права доступа `mode: 0755` в YAML 1.1 — восьмеричное число 493. А `version: 1.10` в любой версии — дробное число 1.1, и версия «1.10» молча становится «1.1». Правило одно: значения, которые должны остаться строками, берите в кавычки — `"NO"`, `"0755"`, `"1.10"`.\n\nПроверять YAML до того, как он попадёт в коммит, помогает линтер: `yamllint файл` печатает ошибки синтаксиса, повторяющиеся ключи и подозрительные «правдивые» значения с номерами строк и названием правила.',
        'Almost every configuration file you meet from here on (how to build, deploy and monitor things) is written in [[yaml.syntax|YAML]]. It is a way to write data as text that is easy for a person to read and unambiguous for a program.\n\nYAML has three bricks. A **mapping** is "key: value" pairs, with a required space after the colon: `name: site`. A **list** is lines starting with "- ", each one an item. **Nesting** is set by indentation, spaces only: a tab in the indentation is a syntax error. Everything shifted to the right of a key belongs to it:\n\n```yaml\nsite:\n  name: edu-cafe\n  pages:\n    - index.html\n    - about.html\n```\n\nHere `site` holds a mapping of two keys, and `pages` is a list of two strings. One space off changes the meaning: an extra space before a key makes it belong elsewhere, and the parser either fails or builds a tree you did not mean. Long text is written in blocks: `|` keeps the line breaks (that is how scripts are written), `>` folds the lines into one.\n\n### What the parser reads as something other than a string\n\nThe parser decides the type of a value by itself: `8080` is a number, `true` a boolean, `~` or nothing means null. This is what [[yaml.traps|YAML traps]] are made of. The old version of the language, YAML 1.1 (still read by PyYAML and many tools), also treats `yes`, `no`, `on`, `off` as booleans: `country: NO` becomes `false`, the famous "Norway problem". File permissions `mode: 0755` in YAML 1.1 are the octal number 493. And `version: 1.10` is the float 1.1 in every version, so version "1.10" silently becomes "1.1". The rule is one: quote values that must stay strings — `"NO"`, `"0755"`, `"1.10"`.\n\nA linter helps you check YAML before it gets into a commit: `yamllint file` prints syntax errors, duplicate keys and suspicious truthy values with line numbers and the rule name.',
      ),
    },
    {
      id: 'parser',
      kind: 'widget',
      step: 'try',
      widget: 'yaml.parser',
      props: {
        text: 'cafe:\n  name: Edu Cafe\n  country: NO\n  version: 1.10\n  opens: 08:00\n  files:\n    mode: 0755\n  menu:\n    - espresso\n    - flat white\n',
        version: '1.1',
        bothVersions: true,
        expect: { cafe: { name: 'Edu Cafe', country: 'NO', version: '1.10', opens: '08:00', files: { mode: '0755' }, menu: ['espresso', 'flat white'] } },
        goal: bi('Расставьте кавычки так, чтобы в обеих версиях YAML все значения кафе остались строками: country — "NO", version — "1.10", opens — "08:00", mode — "0755". Переключайте версию и смотрите, какие значения подсвечены.', 'Add quotes so that in both YAML versions every value of the café stays a string: country "NO", version "1.10", opens "08:00", mode "0755". Switch the version and see which values are highlighted.'),
      },
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: {
        cwd: '~/cfg',
        files: [
          { path: `${HOME}/cfg/menu.yaml`, content: '---\nmenu:\n  - name: espresso\n    price: 2.5\n  - name: latte\n     price: 3.5\n' },
          { path: `${HOME}/cfg/site.yaml`, content: '---\nsite:\n\tname: edu-cafe\n  port: 8080\n' },
          { path: `${HOME}/cfg/team.yaml`, content: '---\nteam:\n  lead: Ada\n  lead: Grace\n' },
        ],
      },
      intro: bi('В `~/cfg` три сломанных файла. Линтер подскажет строки; править удобно командой `edit`.', '`~/cfg` holds three broken files. The linter points at the lines; use `edit` to fix them.'),
      tasks: [
        {
          id: 'lint-all',
          prompt: bi('Почините все три файла так, чтобы `yamllint menu.yaml site.yaml team.yaml` завершался без ошибок, а смысл остался: два блюда с ценами, сайт с именем и портом, один руководитель команды — Ada.', 'Fix all three files so that `yamllint menu.yaml site.yaml team.yaml` exits without errors and the meaning stays: two dishes with prices, a site with a name and a port, one team lead, Ada.'),
          check: {
            when: (f) => {
              const ok = (p: string) => {
                const t = f.files[`${HOME}/cfg/${p}`]?.text ?? '';
                return t && !t.includes('\t');
              };
              if (!['menu.yaml', 'site.yaml', 'team.yaml'].every(ok)) return false;
              return yamlCheck(f.files[`${HOME}/cfg/menu.yaml`].text!, { menu: [{ name: 'espresso', price: 2.5 }, { name: 'latte', price: 3.5 }] }) && yamlCheck(f.files[`${HOME}/cfg/site.yaml`].text!, { site: { name: 'edu-cafe', port: 8080 } }) && yamlCheck(f.files[`${HOME}/cfg/team.yaml`].text!, { team: { lead: 'Ada' } });
            },
          },
          chips: 'yamllint menu.yaml site.yaml team.yaml',
          concepts: ['yaml.syntax'],
          docRef: { page: 'help/yamllint', anchor: 'USAGE' },
          hints: { H1: bi('Три разные ошибки: лишний пробел, табуляция, повтор ключа.', 'Three different errors: an extra space, a tab, a repeated key.'), H2: bi('В menu.yaml price у latte на 4 пробелах, как у espresso; в site.yaml табуляцию замените двумя пробелами; в team.yaml оставьте одну строку lead: Ada.', 'In menu.yaml the latte price goes at 4 spaces like espresso; in site.yaml replace the tab with two spaces; in team.yaml keep one line lead: Ada.') },
        },
      ],
    },
    {
      id: 'note',
      kind: 'callout',
      tone: 'why',
      body: bi('Ошибка в YAML обычно не роняет систему с понятным сообщением: файл разбирается, но получается другое дерево. Поэтому YAML проверяют линтером до коммита, а значения, похожие на числа и «да/нет», пишут в кавычках по привычке.', 'A YAML mistake rarely crashes a system with a clear message: the file parses, but into a different tree. That is why YAML is linted before a commit, and values that look like numbers or yes/no are quoted out of habit.'),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['yaml.q.list', 'yaml.q.indent', 'yaml.q.norway', 'yaml.q.fill-lint'] },
  ],
};

function yamlCheck(text: string, want: unknown): boolean {
  try {
    return JSON.stringify(yamlParse(text, { uniqueKeys: true })) === JSON.stringify(want);
  } catch {
    return false;
  }
}

export const lessons: Lesson[] = [repoLesson, branchesLesson, ignoreLesson, yamlLesson];

// ── placement ──

const placement: PlacementTask[] = [
  {
    id: 'git-yaml.place.commit-one',
    level: 'intermediate',
    key: true,
    concepts: ['git.index', 'git.commit'],
    kind: 'task',
    setup: gitSetup({ repos: [{ path: '~/site', commits: [{ message: 'Add pages', files: PAGES }], worktree: { 'index.html': PAGES['index.html'].replace('Edu Cafe</h1>', 'Edu Cafe Bar</h1>'), 'notes.txt': 'call the supplier\n' } }] }),
    task: {
      id: 'p1',
      prompt: bi('В `~/site` изменён `index.html` и есть новый `notes.txt`. Закоммитьте только `index.html` с сообщением `Fix title`.', 'In `~/site`, `index.html` is changed and there is a new `notes.txt`. Commit only `index.html` with the message `Fix title`.'),
      check: { when: (f) => head(f)?.message === 'Fix title' && !('notes.txt' in (head(f)?.files ?? {})) && (head(f)?.files['index.html'] ?? '').includes('Edu Cafe Bar') && (repo(f)?.status.untracked ?? []).includes('notes.txt') },
    },
  },
  {
    id: 'git-yaml.place.branch-merge',
    level: 'intermediate',
    key: true,
    concepts: ['git.branch', 'git.merge'],
    kind: 'task',
    setup: branchSetup,
    task: {
      id: 'p2',
      prompt: bi('Создайте ветку `feature/contacts`, добавьте в ней `contacts.html` коммитом, вернитесь в `main` и влейте ветку.', 'Create a branch `feature/contacts`, add `contacts.html` in it with a commit, go back to `main` and merge the branch.'),
      check: { when: (f) => repo(f)?.branch === 'main' && !!repo(f)?.branches['feature/contacts'] && 'contacts.html' in (head(f)?.files ?? {}) },
    },
  },
  { id: 'git-yaml.place.markers', level: 'intermediate', key: false, concepts: ['git.conflict'], kind: 'quiz', item: { ...(quiz.find((q) => q.id === 'git.q.markers') as QuizItem), id: 'git-yaml.place.q.markers' } },
  {
    id: 'git-yaml.place.conflict',
    level: 'experienced',
    key: true,
    concepts: ['git.conflict'],
    kind: 'task',
    setup: conflictSetup,
    task: {
      id: 'p3',
      prompt: bi('Влейте `team-text` в `main` так, чтобы в `about.html` остались обе версии спорной строки, и завершите слияние.', 'Merge `team-text` into `main` keeping both versions of the disputed line in `about.html`, and finish the merge.'),
      check: { when: (f) => (head(f)?.parents.length ?? 0) === 2 && !/^(<{7}|={7}|>{7})/m.test(head(f)?.files['about.html'] ?? '') && (head(f)?.files['about.html'] ?? '').includes('baristas') && (head(f)?.files['about.html'] ?? '').includes('Open daily') },
    },
  },
  { id: 'git-yaml.place.norway', level: 'experienced', key: true, concepts: ['yaml.traps'], kind: 'quiz', item: { ...(quiz.find((q) => q.id === 'yaml.q.norway') as QuizItem), id: 'git-yaml.place.q.norway' } },
];

export const block: Block = {
  id: 'git-yaml',
  order: 25,
  title: bi('Git и YAML', 'Git and YAML'),
  summary: bi('Репозиторий, коммит, индекс, ветки, слияние, .gitignore; YAML и его ловушки — до контейнеров, потому что Dockerfile и манифесты живут в репозитории.', 'Repository, commit, index, branches, merge, .gitignore; YAML and its traps — before containers, because Dockerfiles and manifests live in a repository.'),
  checklistStep: null,
  levels: {
    beginner: bi('Не пользовался Git', 'Has not used Git'),
    intermediate: bi('Коммитил через IDE', 'Has committed from an IDE'),
    experienced: bi('Ветки и merge request, правил CI-файл', 'Branches and merge requests, has edited a CI file'),
  },
  hours: { beginner: 15, intermediate: 10, experienced: 5 },
  lessons: lessons.map((l) => l.id),
  sources: src([S.progit, S.ref, S.yaml], [S.ruBook, S.ruLgb, S.ruYaml]),
  docSources: ['git-help'],
  placement,
};

