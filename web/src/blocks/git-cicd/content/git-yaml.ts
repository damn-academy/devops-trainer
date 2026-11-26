// Block "Git and YAML" (route id git-yaml, 06 §2 G-local and §2.7).
// Order of ideas: repository and commit → the index → branches and HEAD →
// merge and conflict → .gitignore → YAML and its traps.

import { parse as yamlParse } from 'yaml';
import { bi } from '../../../core/i18n';
import type { Block, Concept, Facts, Lesson, PlacementTask, QuizItem, Sources } from '../../../core/types';
import { lintYaml } from '../yaml';
import { CONFIG, HOME, PAGES, SITE, gitSetup, head, repo, siteFiles } from './common';
import { undoConcepts, undoLesson, undoPlacement, undoQuiz } from './undo';

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
  { id: 'git.repo', term: bi('репозиторий', 'repository'), forms: { ru: ['репозитория', 'репозиторию', 'репозиторием', 'репозитории', 'репозиториев'], en: ['repositories', 'repo'] }, scan: false, short: bi('Каталог проекта вместе со скрытым каталогом .git, в котором Git хранит все сохранённые состояния проекта и их историю.', 'A project directory together with the hidden .git where Git keeps every saved state and its history.'), introducedIn: 'git-yaml.repo', docRef: { page: 'man/git-init.1', anchor: 'DESCRIPTION' } },
  { id: 'git.commit', term: bi('коммит', 'commit'), forms: { ru: ['коммита', 'коммиту', 'коммитом', 'коммите', 'коммиты', 'коммитов', 'коммитам', 'коммитами'], en: ['commits'] }, scan: false, short: bi('Сохранённый снимок проекта, к которому Git записывает автора, время, сообщение и ссылку на предыдущий коммит. Имя коммита вычисляется из его содержимого.', 'A saved snapshot of the project with an author, a time, a message and a link to its parent; named by a hash of its content.'), introducedIn: 'git-yaml.repo', docRef: { page: 'man/git-commit.1', anchor: 'DESCRIPTION' } },
  { id: 'git.index', term: bi('индекс', 'index'), forms: { ru: ['индекса', 'индексу', 'индексом', 'индексе'] }, scan: false, short: bi('Черновик следующего коммита. Команда git add кладёт в него текущее содержимое файла.', 'The draft of the next commit: git add puts the current content of a file there.'), introducedIn: 'git-yaml.repo', docRef: { page: 'man/git-add.1', anchor: 'DESCRIPTION', line: 'snapshot' } },
  { id: 'git.branch', term: bi('ветка', 'branch'), forms: { ru: ['ветки', 'ветке', 'ветку', 'веткой', 'веток', 'веткам', 'ветками', 'ветках'], en: ['branches'] }, scan: false, short: bi('Подвижное имя, которое указывает на один коммит. Когда вы делаете новый коммит, имя передвигается на него.', 'A movable name on one commit: with a new commit it moves to that commit.'), introducedIn: 'git-yaml.branches', docRef: { page: 'man/git-branch.1', anchor: 'DESCRIPTION' } },
  { id: 'git.head', term: bi('HEAD', 'HEAD'), short: bi('Указатель на ту ветку, на которой вы сейчас стоите и с которой связан рабочий каталог.', 'The "you are here" pointer: which branch the working directory is on.'), introducedIn: 'git-yaml.branches', docRef: { page: 'man/git-switch.1', anchor: 'DESCRIPTION' } },
  { id: 'git.merge', term: bi('слияние', 'merge'), forms: { ru: ['слияния', 'слиянию', 'слиянием', 'слиянии'], en: ['merges', 'merging'] }, scan: false, short: bi('Соединение двух линий истории. Git либо передвигает имя ветки вперёд (fast-forward), либо записывает коммит с двумя родителями.', 'Joining two lines of history: moving the branch name (fast-forward) or a commit with two parents.'), introducedIn: 'git-yaml.branches', docRef: { page: 'man/git-merge.1', anchor: 'DESCRIPTION' } },
  { id: 'git.conflict', term: bi('конфликт слияния', 'merge conflict'), forms: { ru: ['конфликта слияния', 'конфликты слияния', 'конфликтом слияния'], en: ['merge conflicts'] }, short: bi('Место, где обе ветки по-разному изменили одни и те же строки. Git ставит в файле маркеры и ждёт, пока решение примет человек.', 'A place where both branches changed the same lines: Git puts markers and waits for a human decision.'), introducedIn: 'git-yaml.branches', docRef: { page: 'man/git-merge.1', anchor: 'DESCRIPTION', line: 'conflict' } },
  { id: 'git.ignore', term: bi('.gitignore', '.gitignore'), short: bi('Файл со списком шаблонов для файлов, которые Git не должен отслеживать: зависимостей, результатов сборки и секретов.', 'A file listing patterns Git must not track: dependencies, build output, secrets.'), introducedIn: 'git-yaml.ignore', docRef: { page: 'man/gitignore.5', anchor: 'DESCRIPTION' } },
  { id: 'yaml.syntax', term: bi('YAML', 'YAML'), scan: false, short: bi('Текстовый формат данных, в котором словари записываются парами «ключ: значение», списки строками с «- », а вложенность задаётся отступом из пробелов.', 'A text data format: "key: value" mappings, "- " lists, nesting by spaces.'), introducedIn: 'git-yaml.yaml', docRef: { url: 'https://yaml.org/spec/1.2.2/', label: 'YAML 1.2.2 spec' } },
  ...undoConcepts,
  { id: 'yaml.traps', term: bi('ловушки YAML', 'YAML traps'), forms: { ru: ['ловушка YAML', 'ловушек YAML'], en: ['YAML trap'] }, short: bi('Значения, которые парсер читает не как строку, например yes, no, on, 0755 и 1.10. Разные версии YAML читают их по-разному.', 'Values a parser does not read as strings: yes and no, on, 0755, 1.10 — and different YAML versions read them differently.'), introducedIn: 'git-yaml.yaml', docRef: { url: 'https://yaml.org/spec/1.2.2/', label: 'YAML 1.2.2 spec' } },
];

// ── quiz bank ──

const repoWithIndex = gitSetup({ repos: [{ path: '~/site', commits: [{ message: 'Add pages', files: PAGES }], worktree: { 'index.html': PAGES['index.html'].replace('Edu Cafe</h1>', 'Edu Cafe!</h1>') }, staged: ['index.html'] }] });

export const quiz: QuizItem[] = [
  ...undoQuiz,
  {
    id: 'git.q.index-where',
    kind: 'mcq',
    concepts: ['git.index'],
    prompt: bi('Вы изменили index.html и выполнили `git add index.html`, а потом изменили файл ещё раз. Что попадёт в коммит после `git commit -m "…"`?', 'You changed index.html, ran `git add index.html`, then changed the file again. What goes into the commit after `git commit -m "…"`?'),
    options: [
      { id: 'added', text: bi('В коммит попадёт версия, которая была в файле в момент git add', 'The version at the moment of git add'), correct: true },
      { id: 'latest', text: bi('В коммит попадёт последняя версия из рабочего каталога', 'The latest version from the working directory'), why: bi('Коммит собирается из индекса, а в индексе лежит содержимое файла на момент git add. Вторую правку нужно добавить в индекс ещё раз.', 'A commit is built from the index, and the index holds the content from the moment of add. The second edit must be added again.') },
      { id: 'both', text: bi('В коммит попадут обе версии', 'Both versions'), why: bi('У файла в коммите одно содержимое, и историю того, как вы набирали текст, Git внутри коммита не хранит.', 'A file has one content in a commit; Git does not keep a typing history inside a commit.') },
      { id: 'none', text: bi('Git откажется записывать коммит', 'Nothing: Git refuses'), why: bi('В индексе есть изменение, поэтому коммит создаётся.', 'The index is not empty, so the commit is created.') },
    ],
    explain: bi('Индекс служит черновиком следующего коммита. В такой ситуации команда git status покажет файл дважды: в разделе «Changes to be committed» и в разделе «Changes not staged for commit».', 'The index is the draft of the next commit. git status shows such a file twice: under "Changes to be committed" and "Changes not staged for commit".'),
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
      { id: '-m', text: ' M index.html', why: bi('Буква во второй колонке означает изменение, которого нет в индексе. Здесь изменение уже в индексе, поэтому буква стоит в первой колонке.', 'A letter in the second column is a change that is not in the index. Here the change is already in the index, so the letter is in the first column.') },
      { id: 'qq', text: '?? index.html', why: bi('Знаки ?? отмечают неотслеживаемый файл, о котором Git ещё ничего не знает, а index.html уже записан в коммите.', '?? is an untracked file Git knows nothing about. index.html is already in a commit.') },
      { id: 'a', text: 'A  index.html', why: bi('Буква A отмечает новый файл, а этот файл был и в прошлом коммите, поэтому Git пишет M.', 'A is a new file. This file was in the previous commit, so it is M.') },
    ],
    explain: bi('Короткий формат состоит из двух колонок. Первая сравнивает индекс с последним коммитом, а вторая сравнивает рабочий каталог с индексом.', 'The short format has two columns: the first compares the index with the last commit, the second the working directory with the index.'),
  },
  {
    id: 'git.q.commit-has',
    kind: 'multi',
    concepts: ['git.commit'],
    prompt: bi('Что записано в объекте коммита? Отметьте все верные варианты.', 'What is recorded in a commit object? Mark everything that is true.'),
    options: [
      { id: 'tree', text: bi('Ссылка на снимок файлов (tree)', 'A link to the file snapshot (tree)'), correct: true },
      { id: 'parent', text: bi('Ссылка на родительский коммит', 'A link to the parent commit'), correct: true },
      { id: 'author', text: bi('Автор, время и сообщение', 'The author, the time and the message'), correct: true },
      { id: 'diff', text: bi('Только изменённые строки, то есть патч', 'Only the changed lines (a patch)'), why: bi('Git хранит снимки, а не патчи. Разницу между версиями он вычисляет, когда сравнивает два снимка.', 'Git stores snapshots, not patches: it computes a diff by comparing two snapshots.') },
      { id: 'branch', text: bi('Имя ветки', 'The branch name'), why: bi('Коммит не знает, в какой ветке он находится. Наоборот, ветка знает, на какой коммит она указывает.', 'A commit does not know its branch: the branch knows which commit it points to.') },
    ],
  },
  {
    id: 'git.q.cmds',
    kind: 'match',
    concepts: ['git.index', 'git.commit'],
    prompt: bi('Сопоставьте команду и то, что она делает.', 'Match the command with what it does.'),
    pairs: [
      { id: 'add', left: 'git add f', right: bi('кладёт текущее содержимое файла f в индекс', 'puts the current content of f into the index') },
      { id: 'restore-s', left: 'git restore --staged f', right: bi('убирает f из индекса, но правка в файле остаётся', 'takes f out of the index, the edit stays') },
      { id: 'restore', left: 'git restore f', right: bi('отменяет правку файла f в рабочем каталоге', 'discards the edit of f in the working directory'), why: bi('Будьте осторожны, потому что правка, которой нет ни в индексе, ни в коммите, пропадёт безвозвратно.', 'Careful: an edit that is not in the index is lost for good.') },
      { id: 'diff-s', left: 'git diff --staged', right: bi('показывает, что войдёт в следующий коммит', 'shows what goes into the next commit') },
    ],
  },
  {
    id: 'git.q.three-places',
    kind: 'label',
    concepts: ['git.index'],
    prompt: bi('Подпишите три места, где хранится версия файла.', 'Label the three places a version of a file lives in.'),
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
      { id: 'disk', text: bi('резервная копия на диске', 'a backup on disk'), why: bi('Git сам резервных копий не делает. Всё, что он знает, лежит в каталоге .git рядом с файлами.', 'Git does not make backups by itself: everything it knows sits in .git next to the files.') },
    ],
  },
  {
    id: 'git.q.branch-cost',
    kind: 'mcq',
    concepts: ['git.branch'],
    prompt: bi('Что происходит на диске, когда вы создаёте ветку `git branch feature` в проекте на 2 ГБ?', 'What happens on disk when you create a branch with `git branch feature` in a 2 GB project?'),
    options: [
      { id: 'ref', text: bi('Появляется файл .git/refs/heads/feature, в котором записан один хэш', 'A file .git/refs/heads/feature with one hash appears'), correct: true },
      { id: 'copy', text: bi('Git копирует все файлы проекта в отдельный каталог внутри .git, и на диске становится на 2 ГБ больше', 'Git copies all project files into a separate folder inside .git, and the disk holds 2 GB more'), why: bi('При создании ветки Git ничего не копирует, а только записывает файл размером 41 байт, в котором лежит хэш коммита.', 'A branch copies nothing: it is a name on a commit, 41 bytes.') },
      { id: 'diff', text: bi('Git сохраняет разницу с веткой main, чтобы потом собрать из неё файлы новой ветки', 'Git saves the difference from main so that it can rebuild the new branch’s files from it later'), why: bi('Разницы ещё нет, потому что новая ветка указывает на тот же коммит, что и текущая.', 'There is no difference yet: the new branch points to the same commit as the current one.') },
    ],
    explain: bi('Поэтому ветки ничего не стоят: их заводят для каждой задачи и удаляют после слияния.', 'That is why branches are cheap: you make one per task and delete it after the merge.'),
  },
  {
    id: 'git.q.ff',
    kind: 'mcq',
    concepts: ['git.merge'],
    prompt: bi('В main после ответвления feature не было новых коммитов. Что сделает `git merge feature` на main?', 'main had no new commits after feature branched off. What does `git merge feature` on main do?'),
    options: [
      { id: 'ff', text: bi('Git передвинет main на последний коммит feature (fast-forward)', 'Move main to the last commit of feature (fast-forward)'), correct: true },
      { id: 'mc', text: bi('Git запишет в main новый коммит слияния с двумя родителями, последним коммитом main и последним коммитом feature', 'Create a new merge commit on main with two parents, the last commit of main and the last commit of feature'), why: bi('Коммит слияния нужен, когда истории разошлись. Здесь ветка feature прямо продолжает main, поэтому достаточно передвинуть имя, если только вы не попросили обратного флагом --no-ff.', 'A merge commit is needed when histories diverged. Here feature directly continues main, so moving the name is enough (unless you ask for --no-ff).') },
      { id: 'conflict', text: bi('Git остановится с конфликтом, потому что обе ветки содержат одни и те же файлы', 'Stop with a conflict, because both branches contain the same files'), why: bi('Конфликт возможен, только когда обе стороны изменили одни и те же строки, а в main ничего не менялось.', 'A conflict is possible only when both sides changed the same lines; main changed nothing.') },
    ],
  },
  {
    id: 'git.q.markers',
    kind: 'bugfind',
    concepts: ['git.conflict'],
    prompt: bi('Вы решили, что разрешили конфликт, и записали файл коммитом. Какая строка показывает, что работа не закончена?', 'You "resolved" a conflict and committed the file. Which line shows the resolution is not finished?'),
    code: '<h1>Edu Cafe</h1>\n<p>Open daily 8–20</p>\n=======\n<p>We are a small team.</p>',
    bug: [3],
    why: {
      1: bi('Эта строка относится к обычному тексту страницы, а не к разметке конфликта.', 'This line belongs to the ordinary text of the page, not to the conflict markup.'),
      2: bi('В этой строке записана одна из двух версий текста, и оставить её в файле допустимо.', 'This line holds one of the two versions of the text, and keeping it in the file is fine.'),
      3: bi('В файле остался маркер =======, который разделяет вашу и чужую версию. Его нужно удалить вместе с маркерами <<<<<<< и >>>>>>>.', 'The ======= marker stayed in the file: it separates "our" and "their" version and must be deleted together with <<<<<<< and >>>>>>>.'),
      4: bi('В этой строке записана вторая версия текста, и она тоже может остаться в файле.', 'This line holds the second version of the text, and it may stay in the file too.'),
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
      { id: 'add', text: 'git add about.html', why: bi('Команда git add помечает конфликт решённым, и так Git узнаёт, что вы закончили с файлом.', 'git add marks the conflict as resolved: that is how Git learns you are done with the file.') },
      { id: 'commit', text: 'git commit' },
    ],
  },
  {
    id: 'git.q.ignore',
    kind: 'bugfind',
    concepts: ['git.ignore'],
    prompt: bi('С таким .gitignore файл `.env` с паролями всё равно попал в коммит. Почему? Нажмите на строку, в которой причина.', 'With this .gitignore the `.env` file with passwords still got into a commit. Why? Click the cause.'),
    code: 'node_modules/\ndist/\n*.log\n!.env',
    bug: [4],
    why: {
      1: bi('Эта строка правильно исключает каталог зависимостей.', 'The dependencies directory is ignored — correct.'),
      2: bi('Эта строка правильно исключает каталог сборки.', 'The build directory is ignored — correct.'),
      3: bi('Эта строка правильно исключает журналы.', 'Logs are ignored — correct.'),
      4: bi('Восклицательный знак возвращает файл в отслеживаемые, то есть правило «!.env» говорит Git не игнорировать .env. Нужна строка `.env` без восклицательного знака.', '`!` re-includes a file: the rule "!.env" means "do not ignore .env". You need `.env` without the exclamation mark.'),
    },
  },
  {
    id: 'git.q.secret',
    kind: 'mcq',
    concepts: ['git.ignore'],
    prompt: bi('Пароль уже попал в коммит, и этот коммит получили коллеги. Вы выполнили `git rm --cached config.env` и добавили файл в .gitignore. Что ещё нужно сделать обязательно?', 'A password already got into a commit, and the commit was shared with colleagues. You ran `git rm --cached config.env` and added the file to .gitignore. What else is required?'),
    options: [
      { id: 'rotate', text: bi('Сменить пароль, потому что старый навсегда останется в истории', 'Change the password: the old one stays in the history forever'), correct: true },
      { id: 'nothing', text: bi('Больше ничего, потому что файл удалён', 'Nothing: the file is removed'), why: bi('Файл удалён только из следующих коммитов, а прошлый коммит с паролем остался в истории у каждого, кто её скопировал.', 'It is removed only from the next commits. The old commit with the password is still in the history of everyone who copied it.') },
      { id: 'ignore', text: bi('Хватит .gitignore, потому что при следующей отправке Git сам вычистит из истории файлы, перечисленные в нём', '.gitignore is enough, because on the next push Git itself cleans the files it lists out of the history'), why: bi('.gitignore действует только на неотслеживаемые файлы и историю никогда не трогает.', '.gitignore affects only untracked files and never touches the history.') },
    ],
  },
  {
    id: 'yaml.q.list',
    kind: 'mcq',
    concepts: ['yaml.syntax'],
    prompt: bi('Что получит парсер из этого фрагмента?\n\n```yaml\nservices:\n  - web\n  - db\n```', 'What does a parser get from this snippet?\n\n```yaml\nservices:\n  - web\n  - db\n```'),
    options: [
      { id: 'list', text: bi('Словарь с ключом services, значением которого служит список из двух строк', 'A mapping with the key services whose value is a list of two strings'), correct: true },
      { id: 'str', text: bi('Строку "- web - db"', 'The string "- web - db"'), why: bi('Строки под ключом, которые начинаются с «- », считаются элементами списка, а не текстом.', 'Lines starting with "- " under a key are list items, not text.') },
      { id: 'two', text: bi('Два словаря, web и db', 'Two mappings, web and db'), why: bi('Элемент был бы словарём, если бы после имени стояло двоеточие, например «- web: …».', 'An item would be a mapping with a colon: "- web: …".') },
    ],
  },
  {
    id: 'yaml.q.block',
    kind: 'mcq',
    concepts: ['yaml.syntax'],
    prompt: bi('Что получит парсер из ключа `run` в этом фрагменте?\n\n```yaml\nrun: >\n  npm ci\n  npm test\n```', 'What does a parser get from the `run` key in this snippet?\n\n```yaml\nrun: >\n  npm ci\n  npm test\n```'),
    options: [
      { id: 'folded', text: bi('Одну строку "npm ci npm test" с переводом строки в конце', 'One string "npm ci npm test" with a line break at the end'), correct: true },
      { id: 'literal', text: bi('Две строки текста, "npm ci" и "npm test", разделённые переводом строки', 'Two lines of text, "npm ci" and "npm test", separated by a line break'), why: bi('Так прочитался бы блок со знаком |, который сохраняет переводы строк. Знак > склеивает строки блока в одну через пробел, и скрипт из двух команд превратился бы в одну команду npm ci с лишними словами.', 'That is how a block with | would read: it keeps the line breaks. > folds the lines of the block into one with spaces, and a two-command script would turn into one npm ci command with extra words.') },
      { id: 'list', text: bi('Список из двух команд', 'A list of two commands'), why: bi('Списком строки стали бы, только если бы каждая начиналась с «- ». Блок после > или | всегда даёт одно текстовое значение, а не список.', 'The lines would be a list only if each started with "- ". A block after > or | always gives one string.') },
    ],
    explain: bi('Перевод строки внутри блока меняет значение: знак | сохраняет переводы строк, поэтому им записывают многострочные скрипты, а знак > склеивает строки и годится для длинного текста. В обоих случаях в конце значения остаётся один перевод строки.', 'A line break inside a block changes the value: | keeps the line breaks, which is why multi-line scripts are written with it, and > folds the lines and suits long text. In both cases one line break stays at the end of the value.'),
  },
  {
    id: 'yaml.q.indent',
    kind: 'bugfind',
    concepts: ['yaml.syntax'],
    prompt: bi('Парсер сообщает об ошибке. На какой строке она находится?', 'The parser reports an error. On which line?'),
    code: 'app:\n  name: site\n  port: 8080\n   debug: true',
    bug: [4],
    why: {
      1: bi('Это правильный ключ верхнего уровня.', 'A top-level key — fine.'),
      2: bi('Два пробела отступа делают ключ вложенным, и это правильно.', 'Two spaces: a nested key, fine.'),
      3: bi('Ключ стоит на том же уровне, что и name, и это правильно.', 'The same level as name — fine.'),
      4: bi('Здесь три пробела вместо двух. Ключ debug не стоит на уровне соседних ключей, и парсер не понимает, к чему он относится.', 'Three spaces instead of two: debug is not at the level of its siblings, and the parser cannot tell whose value it is.'),
    },
  },
  {
    id: 'yaml.q.norway',
    kind: 'multi',
    concepts: ['yaml.traps'],
    prompt: bi('В каких строках парсер YAML 1.1 прочитает ключ или значение не как строку? Отметьте все такие строки.', 'In which lines does a YAML 1.1 parser read the key or the value NOT as a string? Mark them all.'),
    options: [
      { id: 'no', text: 'country: NO', correct: true },
      { id: 'mode', text: 'mode: 0755', correct: true },
      { id: 'ver', text: 'version: 1.10', correct: true },
      { id: 'on', text: 'on: push', correct: true },
      { id: 'q', text: 'country: "NO"', why: bi('Кавычки делают значение строкой в любой версии YAML.', 'Quotes make a value a string in any YAML version.') },
      { id: 'name', text: 'name: site', why: bi('Обычное слово парсер читает как строку.', 'An ordinary word is a string.') },
    ],
    explain: bi('В YAML 1.1 значение NO считается логическим, 0755 читается как восьмеричное число 493, а 1.10 становится дробным числом 1.1, причём и в YAML 1.2 тоже. В строке `on: push` значение push остаётся строкой, а логическим true становится ключ on, и на этом спотыкаются программы, которые читают файлы настройки библиотекой PyYAML. Поэтому строки, похожие на числа или на «да» и «нет», берут в кавычки.', 'In YAML 1.1, NO is a boolean, 0755 is the octal number 493, and 1.10 is the float 1.1 (in YAML 1.2 as well). In `on: push` the value push stays a string, but the key on becomes the boolean true: build configuration files read with PyYAML fall into this. Strings that look like numbers or yes/no are quoted.'),
  },
  {
    id: 'yaml.q.fill-lint',
    kind: 'fill-command',
    concepts: ['yaml.syntax'],
    prompt: bi('Проверьте файл `config.yaml` линтером YAML.', 'Check `config.yaml` with the YAML linter.'),
    template: '___ config.yaml',
    answers: ['yamllint', 'yamllint -s', 'yamllint --strict', 'yamllint -f parsable', 'yamllint --format parsable', 'yamllint --format=parsable', 'yamllint -s -f parsable', 'yamllint --strict -f parsable', 'yamllint -f parsable -s', 'yamllint -f parsable --strict'],
    explain: bi('Линтер YAML вызывается командой yamllint с именем файла. Флаги не обязательны, и засчитывается любой флаг, который есть у yamllint: с --strict линтер завершается ненулевым кодом даже из-за одних предупреждений, а с -f parsable печатает каждую находку одной строкой.', 'The YAML linter is the yamllint command with the file name. Flags are optional, and any real ones fit: --strict turns warnings into a non-zero exit code, and -f parsable prints every finding on one line.'),
  },
];

// ── lessons ──

const repoLesson: Lesson = {
  id: 'git-yaml.repo',
  block: 'git-yaml',
  title: bi('Репозиторий, коммит и индекс', 'Repository and commit: the three places of a file'),
  summary: bi('Git помнит только те состояния проекта, которые вы сохранили явно, а между правкой файла и историей стоит индекс.', 'Git remembers only the project states you saved explicitly; between an edit and the history stands the index.'),
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
        'В пятницу сайт кафе работал, а в понедельник на нём пустая страница. В каталоге лежат файлы `index.html`, `index-old.html`, `index-final.html` и `index-final2.html`, и никто уже не помнит, какой из них работал в пятницу. Такую задачу решает система контроля версий: она помнит каждое сохранённое состояние проекта и умеет к нему вернуться. В этом уроке вы превратите каталог сайта в репозиторий Git, сохраните в нём первые версии страниц и посмотрите историю.',
        'On Friday the café website worked. On Monday it shows a blank page, and the directory holds `index.html`, `index-old.html`, `index-final.html` and `index-final2.html`. Nobody remembers which one worked on Friday. This is the problem a version control system solves: remember every saved state of a project and be able to go back to it. In this lesson you turn the site directory into a Git repository, save the first versions of the pages in it and look at the history.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      title: bi('Что такое репозиторий и коммит', 'What a repository and a commit are'),
      body: bi(
        'Git превращает обычный каталог проекта в [[git.repo|репозиторий]]. Команда `git init` создаёт внутри каталога скрытый каталог `.git`, и в нём Git хранит всё, что запомнил. Файлы, которые вы видите и правите, называются **рабочим каталогом**, и они по-прежнему остаются обычными файлами.\n\nGit не следит за каждым нажатием клавиши. Состояние проекта сохраняется только тогда, когда вы об этом просите, и такое сохранённое состояние называется [[git.commit|коммитом]]. В коммите записан снимок всех файлов проекта, а вместе с ним автор, время, сообщение о том, что и зачем изменено, и ссылка на предыдущий коммит. Цепочка таких ссылок и составляет историю проекта: от последнего коммита можно пройти назад до самого первого.\n\nПорядкового номера у коммита нет. Его имя называют хэшем: это 40 знаков, цифр от 0 до 9 и латинских букв от a до f, которые Git вычисляет из содержимого коммита. Команда `git log` показывает первые семь знаков, например `1a2b3c4`. Если изменить в коммите хотя бы одну букву, получится другой хэш, поэтому незаметно подменить историю нельзя.\n\n### Индекс, черновик следующего коммита\n\nМежду рабочим каталогом и историей есть третье место, которое называется [[git.index|индексом]]. Команда `git add index.html` кладёт в индекс *текущее* содержимое файла, а команда `git commit` превращает содержимое индекса в новый коммит. Лишний шаг нужен для того, чтобы собрать в один коммит только то, что относится к одному изменению. Допустим, вы исправили заголовок и заодно начали писать новую страницу. Тогда в коммит с сообщением «Fix title» вы добавите только заголовок, а новую страницу сохраните позже отдельным коммитом.\n\nЕсли изменить файл после `git add`, в индексе останется прежняя версия. Поэтому чаще всего вы будете запускать команду `git status`: она сообщает, какие файлы отличаются от последнего коммита, какие из них уже лежат в индексе и о каких файлах Git ещё не знает. Сами изменённые строки показывает команда `git diff`. Без аргументов она показывает, чем рабочий каталог отличается от индекса, а с флагом `--staged` показывает, что войдёт в следующий коммит.\n\nЕсли вы добавили в индекс лишний файл, команда `git restore --staged index.html` уберёт его из индекса, а правка в самом файле останется. Команда `git restore index.html` без флага отменяет саму правку и возвращает файл к версии из индекса. Запускайте её осторожно, потому что правка, которой нет ни в индексе, ни в коммите, пропадёт насовсем. Состояние репозитория можно посмотреть и короче, командой `git status --short`. Она печатает по строке на файл, а две колонки перед именем показывают его состояние: первая сравнивает индекс с последним коммитом, вторая сравнивает рабочий каталог с индексом, а знаки `??` отмечают файл, о котором Git ещё не знает.',
        'Git turns an ordinary project directory into a [[git.repo|repository]]: `git init` creates a hidden `.git` directory inside, and Git keeps everything it remembers there. The files you see and edit are the **working directory**; they are still just files.\n\nGit does not watch every keystroke. The state of the project is saved only when you ask, and such a saved state is called a [[git.commit|commit]]. A commit is a snapshot of all project files plus the author, the time, a message saying what changed and why, and a link to the previous commit. The chain of these links is the project history: from the last commit you can walk back to the very first one.\n\nA commit has no sequence number. Its name is a hash: 40 hexadecimal digits computed from its content (`git log` shows the first seven, like `1a2b3c4`). Change one letter in a commit and you get another hash, so the history cannot be quietly replaced.\n\n### The index: the draft of the next commit\n\nBetween the working directory and the history there is a third place: the [[git.index|index]]. `git add index.html` puts the *current* content of the file into the index, and `git commit` turns the index into a new commit. Why the extra step? It lets you put into one commit only what belongs to one change: you fixed the title and also started a new page, and the commit "Fix title" gets only the title.\n\nIf you edit a file after `git add`, the index keeps the old version. That is why the main Git command is `git status`: it always tells you which files differ from the last commit, which are already in the index, and which Git does not know yet. `git diff` shows the lines themselves: without arguments, how the working directory differs from the index; with `--staged`, what goes into the next commit.\n\nIf you added a file to the index by mistake, `git restore --staged index.html` takes it out of the index, and the edit in the file itself stays. `git restore index.html` without the flag discards the edit itself and returns the file to the version in the index. Run it with care: an edit that is neither in the index nor in a commit is lost for good. You can also look at the state of the repository in a shorter form, `git status --short`. It prints one line per file, and two columns before the name show its state: the first compares the index with the last commit, the second compares the working directory with the index, and `??` marks a file Git does not know yet.',
      ),
    },
    {
      id: 'read-output',
      kind: 'text',
      step: 'explain',
      levels: ['beginner'],
      title: bi('Как читать ответы git status и git diff', 'How to read what git status and git diff print'),
      body: bi(
        'Первые ответы Git на английском, и в них много красного. Красный цвет здесь не означает ошибку. Так Git отмечает файлы, изменения которых ещё не попали в индекс, а зелёным цветом отмечает то, что уже лежит в индексе и войдёт в следующий коммит. Сразу после `git init` все файлы каталога красные, потому что Git о них пока ничего не знает.\n\n```\nOn branch main\nChanges to be committed:\n  (use "git restore --staged <file>..." to unstage)\n        modified:   index.html\n\nChanges not staged for commit:\n  (use "git add <file>..." to update what will be committed)\n        modified:   about.html\n\nUntracked files:\n  (use "git add <file>..." to include in what will be committed)\n        notes.txt\n```\n\nОтвет `git status` делится на разделы. Заголовок *Changes to be committed* означает «изменения, которые войдут в коммит», и под ним перечислено содержимое индекса. Заголовок *Changes not staged for commit* означает «изменения, которые в коммит не войдут»: под ним стоят файлы, которые вы изменили, но для которых ещё не выполнили `git add`. Заголовок *Untracked files* означает «неотслеживаемые файлы», то есть файлы, о которых Git ещё ничего не знает. Строки в скобках служат подсказками, и в них Git сам предлагает команду, которая переведёт файл в другой раздел. Когда сохранять нечего, Git пишет *nothing to commit, working tree clean*, то есть «сохранять нечего, рабочий каталог чист».\n\nКоманда `git diff` показывает сами изменённые строки:\n\n```\ndiff --git a/index.html b/index.html\nindex f23b63e..17fd4ea 100644\n--- a/index.html\n+++ b/index.html\n@@ -1,4 +1,4 @@\n <!doctype html>\n <title>Edu Cafe</title>\n-<h1>Edu Cafe</h1>\n+<h1>Edu Cafe - open daily</h1>\n <p>Coffee and code since 2026.</p>\n```\n\nПервые пять строк служебные, и их можно не читать: в них Git называет файл и номера строк, с которых начинается изменение. Строка со знаком минус в начале, красная на экране, показывает, как было, а строка со знаком плюс, зелёная, показывает, как стало. Строки без знака стоят рядом для того, чтобы было видно, в каком месте файла сделана правка.',
        'Git’s first answers are in English and full of red. Red does not mean an error here. It is how Git marks files whose changes are not in the index yet, while green marks what is already in the index and goes into the next commit. Right after `git init` every file of the directory is red, because Git knows nothing about them yet.\n\n```\nOn branch main\nChanges to be committed:\n  (use "git restore --staged <file>..." to unstage)\n        modified:   index.html\n\nChanges not staged for commit:\n  (use "git add <file>..." to update what will be committed)\n        modified:   about.html\n\nUntracked files:\n  (use "git add <file>..." to include in what will be committed)\n        notes.txt\n```\n\nThe answer of `git status` is split into sections. *Changes to be committed* lists the content of the index. *Changes not staged for commit* lists files you changed but have not run `git add` for yet. *Untracked files* are files Git knows nothing about yet. The lines in parentheses are hints: in them Git itself suggests the command that moves a file into another section. When there is nothing to save, Git writes *nothing to commit, working tree clean*.\n\n`git diff` shows the changed lines themselves:\n\n```\ndiff --git a/index.html b/index.html\nindex f23b63e..17fd4ea 100644\n--- a/index.html\n+++ b/index.html\n@@ -1,4 +1,4 @@\n <!doctype html>\n <title>Edu Cafe</title>\n-<h1>Edu Cafe</h1>\n+<h1>Edu Cafe - open daily</h1>\n <p>Coffee and code since 2026.</p>\n```\n\nThe first five lines are bookkeeping and can be skipped: in them Git names the file and the line numbers where the change starts. A line starting with a minus, red on screen, shows how it was, and a line starting with a plus, green, shows how it is now. Lines without a sign stand around them so you can see where in the file the edit is.',
      ),
    },
    {
      id: 'identity',
      kind: 'callout',
      tone: 'note',
      title: bi('Что сделать перед первым коммитом', 'Before the first commit'),
      body: bi(
        'Git записывает в каждый коммит его автора, поэтому на каждой машине нужно один раз представиться командами `git config --global user.name "Имя Фамилия"` и `git config --global user.email "you@example.com"`. Если этого не сделать, первый `git commit` остановится с сообщением *Author identity unknown*. Файлы на учебной машине удобно править командой `edit index.html`: она открывает редактор, а сочетание клавиш Ctrl+S сохраняет файл.',
        'Git writes the author into every commit, so once per machine you introduce yourself: `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`. Without it the first `git commit` stops with *Author identity unknown*. To edit files, use `edit index.html`: an editor opens, Ctrl+S saves.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: { cwd: '~/site', files: siteFiles(), ext: { git: { config: CONFIG } } },
      intro: bi('В каталоге `~/site` лежат две страницы сайта кафе, а репозитория там ещё нет. Сломать учебную машину нельзя, потому что кнопка «Сбросить машину» над терминалом возвращает её в исходное состояние.', '`~/site` holds two pages of the café site. There is no repository yet. You cannot break the training machine: the “Reset this screen” button above the terminal returns it to the starting state.'),
      tasks: [
        {
          id: 'whoami',
          prompt: bi('Представьтесь Git, то есть задайте для всех репозиториев имя и почту автора.', 'Introduce yourself to Git: set the author name and email globally.'),
          check: { when: (f) => !!(f.files[`${HOME}/.gitconfig`]?.text ?? '').match(/email\s*=\s*\S+@\S+/) && /name\s*=\s*\S/.test(f.files[`${HOME}/.gitconfig`]?.text ?? '') },
          chips: 'git config --global user.name "Ada Lovelace"',
          docRef: { page: 'man/git-config.1', anchor: 'OPTIONS', line: '--global' },
          hints: { H1: bi('Задать нужно две настройки, user.name и user.email.', 'You need two settings: user.name and user.email.'), H2: bi('Сначала выполните `git config --global user.name "…"`, а затем так же задайте user.email.', '`git config --global user.name "…"`, then the same for user.email.') },
        },
        {
          id: 'init',
          prompt: bi('Превратите каталог `~/site` в репозиторий.', 'Turn `~/site` into a repository.'),
          check: { when: (f) => !!repo(f), fail: [{ if: (f) => !!f.git && (f.git as { repos: { path: string }[] }).repos.some((r) => r.path !== SITE), say: bi('Репозиторий создан не в том каталоге, а нужен он в каталоге ~/site.', 'The repository is in the wrong directory: it must be ~/site.') }] },
          chips: 'git init',
          concepts: ['git.repo'],
          docRef: { page: 'man/git-init.1', anchor: 'DESCRIPTION' },
          hints: { H1: bi('Команда, которая создаёт каталог .git, названа по английскому слову initialize, то есть «начать».', 'The command that creates .git is named like "initialise".') },
        },
        {
          id: 'first',
          prompt: bi('Сохраните в первом коммите **только** файл `index.html`, а `about.html` пока не трогайте.', 'Save **only** `index.html` in the first commit; leave `about.html` alone for now.'),
          check: {
            when: (f) => {
              const r = repo(f);
              const c = r?.commits[r.commits.length - 1];
              return !!c && Object.keys(c.files).join() === 'index.html' && c.message.trim().length > 0;
            },
            fail: [
              { if: (f) => (repo(f)?.commits.at(-1) && Object.keys(repo(f)!.commits.at(-1)!.files).includes('about.html')) || false, say: bi('В первый коммит попал и about.html, а в индекс нужно было добавить один файл, а не весь каталог.', 'about.html got into the first commit too: you had to add one file to the index, not the whole directory.') },
              { if: (f) => !!repo(f) && repo(f)!.status.staged.includes('index.html'), say: bi('Файл index.html уже лежит в индексе, и осталось записать коммит.', 'index.html is in the index; now record the commit.') },
            ],
          },
          chips: 'git add index.html && git commit -m "Add the home page"',
          concepts: ['git.index', 'git.commit'],
          docRef: { page: 'man/git-commit.1', anchor: 'OPTIONS', line: '-m <msg>' },
          hints: { H1: bi('Сначала добавьте файл в индекс, а потом запишите его в историю.', 'First into the index, then into the history.'), H2: bi('Выполните `git add index.html`, а затем `git commit -m "…"` с понятным сообщением о том, что вы сделали.', '`git add index.html`, then `git commit -m "…"` with a meaningful message.') },
        },
        {
          id: 'second',
          prompt: bi('Поменяйте заголовок `<h1>` в файле `index.html` на «Edu Cafe — open daily» (вместо длинного тире подойдёт и обычный дефис) и посмотрите, что покажет `git diff`. Затем сохраните эту правку и файл `about.html` одним коммитом. В конце команда `git status` должна сообщить, что изменений нет.', 'Change the `<h1>` heading in `index.html` to "Edu Cafe — open daily" (a plain hyphen instead of the dash is fine too), look at `git diff`, then save the edit and `about.html` in one commit. At the end `git status` must say everything is clean.'),
          check: {
            when: (f) => {
              const r = repo(f);
              const c = head(f);
              return !!r && r.commits.length >= 2 && !!c && /<h1>Edu Cafe\s*[-–—]\s*open daily<\/h1>/i.test(c.files['index.html'] ?? '') && 'about.html' in c.files && !r.status.staged.length && !r.status.unstaged.length && !r.status.untracked.length;
            },
            fail: [
              { if: (f) => (repo(f)?.status.unstaged ?? []).includes('index.html'), say: bi('Правка index.html есть в рабочем каталоге, но в индекс она не попала, поэтому выполните git add ещё раз.', 'The edit of index.html is in the working directory but not in the index. Run git add again.') },
              { if: (f) => (repo(f)?.status.untracked ?? []).includes('about.html'), say: bi('Файл about.html всё ещё не отслеживается, и Git о нём не узнает, пока вы не добавите его в индекс.', 'about.html is still untracked: Git does not know it until you add it.') },
            ],
          },
          chips: 'edit index.html',
          concepts: ['git.index'],
          docRef: { page: 'man/git-diff.1', anchor: 'DESCRIPTION', line: 'relative to the index' },
          hints: { H1: bi('Порядок такой: правка, затем git diff, затем git add для обоих файлов и в конце git commit.', 'Edit → git diff → git add both files → git commit.'), H2: bi('Выполните по очереди `edit index.html`, `git diff`, `git add index.html about.html` и `git commit -m "Open daily, add About"`.', '`edit index.html`, `git diff`, `git add index.html about.html`, `git commit -m "Open daily, add About"`.') },
        },
        {
          id: 'log',
          prompt: bi('Покажите историю так, чтобы каждый коммит занимал одну строку.', 'Show the history, one line per commit.'),
          check: { when: "term['main'][last].exit=0", stdout: /^[0-9a-f]{7} .*\n[0-9a-f]{7} /m },
          chips: 'git log --oneline',
          docRef: { page: 'man/git-log.1', anchor: 'OPTIONS', line: '--oneline' },
          hints: { H1: bi('Историю показывает команда git log, и у неё есть флаг для короткого вида.', 'The history is git log; it has a key for a short form.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('У каждой команды Git есть страница руководства, которую открывает `git help commit` или `git commit --help`. В каком разделе этой страницы описан флаг `-m`? Нажмите на этот раздел.', 'Every Git command has a manual page: `git help commit` or `git commit --help`. Which section describes what the `-m` key does? Click it.'),
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
  summary: bi('Ветка ничего не копирует, а только указывает на коммит. Слияние соединяет две линии истории, а конфликт решает человек.', 'A branch copies nothing: it points to a commit. A merge joins two lines of history, and a person resolves a conflict.'),
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
        'Вы начали страницу контактов, и тут вас просят срочно исправить опечатку на главной странице. Если работать в одном потоке, исправление опечатки попадёт на сайт вместе с недописанными контактами. Нужно отложить одну работу, сделать другую и потом соединить их, причём не копировать проект в соседний каталог. В этом уроке вы научитесь делать это ветками Git и соединять их слиянием.',
        'You started a contacts page, and then you are asked to fix a typo on the home page right away. In a single line of work the typo fix would go out together with the half-done contacts. You need to set one piece of work aside, do the other, and join them later, without copying the project into another directory. In this lesson you learn to do it with Git branches and join them with a merge.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      title: bi('Почему ветка указывает на коммит и ничего не копирует', 'A branch is a name on a commit'),
      body: bi(
        'Каждый коммит знает своего родителя, поэтому история выглядит как цепочка коммитов. [[git.branch|Ветка]] служит подвижным именем, которое указывает на один коммит этой цепочки. Хранится она в файле `.git/refs/heads/main`, в котором записан один хэш. Когда вы делаете коммит, Git записывает в этот файл хэш нового коммита, и имя передвигается вперёд. Чтобы создать ветку, Git записывает ещё один такой файл и больше ничего не копирует, поэтому ветку заводят для каждой задачи.\n\nКакую ветку двигать, Git узнаёт по [[git.head|HEAD]], указателю на то место, где вы сейчас находитесь. Обычно HEAD указывает не на коммит, а на ветку: в файле `.git/HEAD` написано `ref: refs/heads/main`. Команда `git switch contacts` переводит HEAD на другую ветку и приводит рабочий каталог к её последнему коммиту, а команда `git switch -c contacts` создаёт ветку и сразу на неё переходит.\n\n### Слияние\n\nКогда работа в ветке готова, её соединяют с основной веткой командой `git merge`, и это называется [[git.merge|слиянием]]. Здесь возможны два случая. Если в `main` с момента создания ветки ничего не появилось, ветка прямо продолжает `main`, и Git передвигает имя `main` вперёд. Такое слияние называется перемоткой (*fast-forward*). Если же обе ветки ушли вперёд, Git записывает коммит слияния с двумя родителями, в котором соединены изменения обеих сторон.\n\nОбычно Git соединяет изменения сам. Если одна сторона правила заголовок, а другая подвал, обе правки попадут в результат. Но если обе ветки изменили одни и те же строки, Git не знает, какая версия правильная. Такая ситуация называется [[git.conflict|конфликтом слияния]]: слияние останавливается, и в файле появляются маркеры:\n\n```\n<<<<<<< HEAD\nнаша версия\n=======\nих версия\n>>>>>>> team-text\n```\n\nПосле этого Git ждёт решения человека. Вы приводите файл к нужному виду, удаляете маркеры и выполняете `git add`, которым сообщаете Git, что конфликт решён, а затем завершаете слияние командой `git commit`.',
        'Every commit knows its parent, so the history is a chain. A [[git.branch|branch]] is just a movable name stuck on one commit of that chain: the file `.git/refs/heads/main` with one hash in it. When you commit, Git writes the hash of the new commit into that file, and the name moves forward. Creating a branch means writing one more such file; nothing is copied, so you make a branch for every task.\n\nHow does Git know which branch to move? That is what [[git.head|HEAD]] is for: the "you are here" pointer. Usually it points not to a commit but to a branch: the file `.git/HEAD` says `ref: refs/heads/main`. `git switch contacts` moves HEAD to another branch and brings the working directory to its commit. `git switch -c contacts` creates a branch and switches to it at once.\n\n### Merging\n\nWhen the work on a branch is ready, you join it with the main line: a [[git.merge|merge]], the command `git merge`. There are two cases. If nothing new appeared on `main` since the branch was made, the branch directly continues `main`, and Git simply moves the name `main` forward (*fast-forward*). If both branches moved on, Git creates a merge commit with two parents that joins the changes of both sides.\n\nUsually Git joins the changes by itself: one side edited the heading, the other the footer, and both edits end up in the result. But if both branches changed the same lines, Git cannot know which version is right. That is a [[git.conflict|merge conflict]]: the merge stops, markers appear in the file\n\n```\n<<<<<<< HEAD\nour version\n=======\ntheir version\n>>>>>>> team-text\n```\n\nand Git waits for a human decision. You edit the file to what it should be, delete the markers, run `git add` (the sign "conflict resolved") and finish the merge with `git commit`.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Что происходит при слиянии двух веток', 'What happens when two branches merge'),
      body: bi(
        'Схема ниже по шагам показывает, что делает Git, когда вы набираете `git merge feature`, стоя на ветке main. Сначала на ней только коммит A и две ветки, которые на него указывают. Справа стоят имена веток main и feature и указатель HEAD, а слева коммиты: в верхнем ряду ваши коммиты C и D из ветки feature, ниже коммит B, который коллега сделал в main. Под ними лежит файл about.html, который Git сравнивает в трёх версиях. Каждый коммит появляется на схеме тогда, когда его записывают, и в конце вы увидите, получится ли простая перемотка, коммит слияния или конфликт.',
        'The diagram below shows step by step what Git does when you type `git merge feature` while on main. At first it shows only commit A and the two branches pointing to it. On the right are the branch names main and feature and the HEAD pointer, on the left the commits: in the top row your commits C and D on feature, below them commit B a colleague made on main. Under them is about.html, which Git compares in three versions. Every commit appears when it is recorded, and at the end you see whether you get a fast-forward, a merge commit or a conflict.',
      ),
    },
    {
      id: 'merge-kinds',
      kind: 'explainer',
      step: 'look',
      explainer: 'git.merge-kinds',
      howto: bi(
        'А дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен один блок, тот, который работает сейчас, а облачко рядом с ним говорит, что он делает. По линиям проходит карточка с тем, что Git записывает или передаёт: имя ветки, ссылку на родителя, три версии файла. Зелёная рамка означает, что шаг прошёл, пунктирная означает, что слияние ждёт вашего решения, а красная означает, что Git остановился. Легенда со всеми знаками собрана рядом со схемой.\n\nПервый проход без настроек закончится перемоткой. Потом включите в «Параметрах» переключатель «Пока вы работали, в main появился коммит B» и пройдите схему снова: появится коммит слияния M. Выключите его и включите флаг `--no-ff`, чтобы увидеть, что коммит слияния можно потребовать и без расхождения веток. Напоследок включите в блоке «Сломать» переключатель «Обе ветки по-разному изменили одну строку about.html», а затем переключатель «В main осталась незакоммиченная правка about.html» и посмотрите, на каком шаге и с каким сообщением Git останавливается.',
        'Then go on with “Step forward” above the diagram. At every step one block is highlighted, the one working now, and the callout next to it says what it does. A card travels along the lines with what Git records or hands on: a branch name, a link to a parent, three versions of a file. A green outline means the step passed, a dashed one that the merge waits for your decision, a red one that Git stopped. The legend with all the marks is next to the diagram.\n\nThe first run with the default settings ends in a fast-forward. Then switch on “Commit B appeared on main” in “Parameters” and run it again: a merge commit M appears. Switch it off and switch on `--no-ff` to see that a merge commit can be demanded without diverged branches. Finally, in “Break it” switch on “Both branches changed the same line”, then “An uncommitted edit of about.html on main”, and see at which step and with which message Git stops.',
      ),
      caption: bi('Сообщение `CONFLICT (content): Merge conflict in about.html`, которое вы видели при поломке, вам встретится в практике ниже. Когда оно появится, вспомните, что Git уже взял из обеих веток всё, что соединил без вашего участия, и оставил вам только строки между маркерами.', 'The message `CONFLICT (content): Merge conflict in about.html` you saw with the break will meet you in the practice below. When it appears, remember that Git has already taken everything it could join by itself and left you only the lines between the markers.'),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: branchSetup,
      intro: bi('В каталоге `~/site` лежит репозиторий, в ветке main которого два коммита.', '`~/site` is a repository with two commits on main.'),
      tasks: [
        {
          id: 'branch',
          prompt: bi('Создайте ветку `contacts`, перейдите на неё и запишите в ней коммитом новый файл `contacts.html`.', 'Create a branch `contacts`, switch to it and commit a new file `contacts.html`.'),
          check: {
            when: (f) => {
              const r = repo(f);
              const tip = r?.branches.contacts;
              const c = r?.commits.find((x) => x.oid === tip);
              return !!c && 'contacts.html' in c.files && tip !== r?.branches.main;
            },
            fail: [{ if: (f) => !!repo(f)?.branches.main && 'contacts.html' in (repo(f)!.commits.find((c) => c.oid === repo(f)!.branches.main)?.files ?? {}), say: bi('Коммит попал в main, а перед коммитом нужно было перейти на ветку contacts.', 'The commit went to main: you had to switch to the contacts branch before committing.') }],
          },
          chips: 'git switch -c contacts',
          concepts: ['git.branch', 'git.head'],
          docRef: { page: 'man/git-switch.1', anchor: 'OPTIONS', line: '--create' },
          hints: { H1: bi('Порядок такой: создать ветку, перейти на неё, создать файл, добавить его в индекс и записать коммит.', 'A branch, a switch to it, a file, add, commit.'), H2: bi('Выполните `git switch -c contacts`, потом `echo "<h1>Contacts</h1>" > contacts.html`, затем `git add` и `git commit -m "…"`.', '`git switch -c contacts`, then `echo "<h1>Contacts</h1>" > contacts.html`, `git add`, `git commit -m "…"`.') },
        },
        {
          id: 'merge',
          prompt: bi('Вернитесь на ветку `main` и влейте в неё ветку `contacts`.', 'Go back to `main` and merge `contacts` into it.'),
          check: {
            when: (f) => {
              const r = repo(f);
              return !!r && r.branch === 'main' && !!r.branches.contacts && r.branches.main === r.branches.contacts;
            },
            fail: [{ if: (f) => repo(f)?.branch === 'contacts', say: bi('Вы всё ещё стоите на ветке contacts, а сливать нужно из той ветки, которая должна получить изменения.', 'You are still on contacts. You merge from the branch that should receive the changes.') }],
          },
          chips: 'git switch main && git merge contacts',
          concepts: ['git.merge'],
          docRef: { page: 'man/git-merge.1', anchor: 'DESCRIPTION', line: 'fast-forward' },
          hints: { H1: bi('В main не было новых коммитов, поэтому Git передвинет имя ветки вперёд.', 'main had no new commits: Git will just move the name.') },
        },
        {
          id: 'graph',
          prompt: bi('Найдите в `git help log` флаг, который рисует слева от истории граф веток. Затем покажите историю всех веток с этим графом так, чтобы каждый коммит занимал одну строку.', 'Find in `git help log` the key that draws branches as a graph to the left of the history, and show the history of all branches one line per commit with that graph.'),
          check: { when: "term['main'][last].exit=0", stdout: /^\* [0-9a-f]{7} /m },
          docStep: 3,
          chips: 'git log --oneline --graph --all',
          docRef: { page: 'man/git-log.1', anchor: 'OPTIONS', line: '--graph' },
          hints: { H1: bi('Флаг описан в разделе OPTIONS, а называется он английским словом graph, то есть «граф».', 'The key is in the OPTIONS section; its name is "graph".') },
        },
      ],
    },
    {
      id: 'conflict',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: conflictSetup,
      intro: bi('Два человека поменяли одну и ту же строку в файле `about.html`. В ветке `main` в неё записали часы работы, а в ветке `team-text` написали, кто работает в кафе. В итоге нужны обе строки.', 'Two people changed one line of `about.html`: on `main` someone wrote the opening hours, on `team-text` who we are. Both lines are needed.'),
      tasks: [
        {
          id: 'resolve',
          prompt: bi('Влейте ветку `team-text` в `main`, оставьте в файле `about.html` **обе** строки, про команду и про часы работы, в любом порядке и завершите слияние.', 'Merge `team-text` into `main`, keep **both** lines in `about.html`, about the team and about the hours, in any order, and finish the merge.'),
          check: {
            when: (f) => {
              const c = head(f);
              const t = c?.files['about.html'] ?? '';
              return !!c && c.parents.length === 2 && !/^(<{7}|={7}|>{7})/m.test(t) && t.includes('small team of baristas') && t.includes('Open daily 8–20');
            },
            fail: [
              { if: (f) => /^(<{7}|={7}|>{7})/m.test(f.files[`${SITE}/about.html`]?.text ?? ''), say: bi('В файле остались маркеры конфликта, поэтому удалите строки <<<<<<<, ======= и >>>>>>>.', 'Conflict markers are still in the file. Delete the <<<<<<<, ======= and >>>>>>> lines.') },
              { if: (f) => (repo(f)?.status.conflicted ?? []).length > 0, say: bi('Git всё ещё считает файл about.html конфликтным, поэтому после правки выполните git add about.html.', 'Git still sees about.html as conflicted: after editing, run git add about.html.') },
              { if: (f) => !!repo(f)?.merging, say: bi('Конфликт решён, и осталось записать коммит слияния командой git commit.', 'The conflict is resolved; now record the merge commit: git commit.') },
            ],
          },
          chips: 'git merge team-text',
          concepts: ['git.conflict'],
          docRef: { page: 'man/git-merge.1', anchor: 'DESCRIPTION', line: '<<<<<<<' },
          hints: { H1: bi('После git merge откройте about.html, и вы увидите, что между маркерами записаны две версии одной строки.', 'After git merge open about.html: between the markers there are two versions of one line.'), H2: bi('Откройте файл командой `edit about.html`, оставьте обе строки, удалите маркеры, а затем выполните `git add about.html` и `git commit`.', '`edit about.html`: keep both lines, delete the markers, then `git add about.html` and `git commit`.') },
        },
      ],
    },
    {
      id: 'merge-anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Откройте `git help merge`. В каком разделе описан флаг `--no-ff`? Нажмите на этот раздел.', 'Open `git help merge`. Which section describes what the `--no-ff` key does? Click it.'),
      ref: { page: 'man/git-merge.1' },
      answer: 'OPTIONS',
    },
    {
      id: 'abort',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Вы начали слияние, получили конфликт и поняли, что решать его сейчас некогда, потому что коллега, который знает правильный текст, вернётся только завтра. Верните репозиторий в состояние до слияния и ничего при этом не потеряйте. В уроке об этом не рассказывалось, поэтому найдите ответ в `git help merge`.', 'You started a merge, got a conflict and realised there is no time to resolve it now: the colleague who knows the right text is back tomorrow. Return the repository to the state before the merge without losing anything. The lesson did not cover it: look it up in `git help merge`.'),
      ref: { page: 'man/git-merge.1' },
      terminal: {
        setup: { ...conflictSetup, script: ['cd /home/learner/site && git merge team-text'] },
        task: {
          id: 'abort',
          prompt: bi('Слияние начато и остановлено конфликтом, и нужно вернуть всё так, как было до него.', 'A merge was started and stopped by a conflict; put everything back as it was before it.'),
          check: {
            when: (f, start) => {
              const r = repo(f);
              const before = start ? repo(start) : undefined;
              return !!r && !!before?.merging && r.branch === 'main' && !r.merging && r.head === before.head && r.status.conflicted.length === 0 && (f.files[`${SITE}/about.html`]?.text ?? '') === head(f)?.files['about.html'];
            },
            fail: [{ if: (f) => !!repo(f)?.merging, say: bi('Слияние всё ещё продолжается, и Git помнит его в файле MERGE_HEAD. Чтобы отменить слияние, у git merge есть отдельный флаг.', 'The merge is still in progress: Git remembers it in MERGE_HEAD. git merge has a separate key to cancel it.') }],
          },
          docStep: 4,
          beyond: true,
          solutionTokens: ['--abort', 'git merge --abort'],
        },
      },
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

/** The .gitignore goal: only .gitignore and .env.example are new in the last commit, nothing is left untracked. */
const ignoreDone = (f: Facts) => {
  const r = repo(f);
  const c = head(f);
  return !!r && !!c && '.gitignore' in c.files && '.env.example' in c.files && !('.env' in c.files) && !Object.keys(c.files).some((p) => p.startsWith('node_modules/') || p.startsWith('dist/') || p.endsWith('.log')) && r.status.untracked.length === 0;
};

const ignoreLesson: Lesson = {
  id: 'git-yaml.ignore',
  block: 'git-yaml',
  title: bi('Какие файлы не должны попадать в репозиторий', '.gitignore: what must not get into a repository'),
  summary: bi('Файл, который не попал в репозиторий, не может утечь вместе с ним, а файл, который попал, остаётся в истории навсегда.', 'What never got into a repository cannot leak; what got in stays in the history forever.'),
  introduces: ['git.ignore'],
  uses: ['git.commit', 'git.index'],
  tier: 'core',
  minutes: 25,
  sources: src([S.gitignore, S.progitIgnore], [S.ruRecord, S.ruBook]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Вы выполнили `git add .`, записали коммит и отправили его коллегам, а через час выяснилось, что вместе со страницами сайта в коммит попал файл `.env` с паролем от базы данных. Удалить файл из следующих коммитов несложно, но в прошлом коммите пароль останется навсегда. В этом уроке вы составите список файлов, которые Git не должен замечать, и узнаете, что делать, если секрет всё-таки попал в историю.',
        'You ran `git add .`, recorded a commit and shared it with colleagues, and an hour later it turned out that along with the site pages the commit picked up `.env` with the database password. Removing the file from the next commits is easy, but the password stays in the old commit forever. In this lesson you write the list of files Git must not notice and learn what to do if a secret did get into the history.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'В каталоге проекта всегда есть файлы, которым не место в истории. Во-первых, это зависимости. Каталог `node_modules/` весит сотни мегабайт, и его можно восстановить одной командой. Во-вторых, это результаты сборки в каталоге `dist/` и журналы. Но важнее всего файлы с паролями и ключами вроде `.env`. Если их не исключить, команда `git add .` добавит в индекс всё подряд.\n\nСписок исключений хранится в файле [[git.ignore|.gitignore]] в корне репозитория, по одному шаблону в строке. Шаблон `node_modules/` с косой чертой в конце относится только к каталогу, а шаблон `node_modules` без черты подходит и к файлу, и к каталогу с таким именем. Шаблон `*.log` относится к любому файлу с таким окончанием в любом каталоге. Шаблон `/build` относится только к файлу или каталогу build в корне репозитория, а `/build/` только к каталогу. Восклицательный знак в шаблоне `!.env.example` возвращает файл, который исключило правило выше. Такие файлы команда `git status` перестаёт показывать, а команда `git add` отказывается их добавлять, если не указать флаг `-f`. Сам файл `.gitignore` коммитят, потому что его правила нужны всей команде.\n\n### Секреты и история\n\n`.gitignore` действует только на неотслеживаемые файлы. Если `.env` уже попал в коммит, строка в `.gitignore` ничего не изменит, и Git продолжит следить за файлом. Убрать файл из отслеживаемых, не удаляя его с диска, можно командой `git rm --cached .env`. Но прошлые коммиты останутся такими, какими были, со старым паролем внутри, и останутся у каждого, кто скопировал историю. Поэтому секрет, который попал в коммит, считают утёкшим и **меняют**. А чтобы коллеги знали, какие настройки нужны, в репозиторий кладут пример без значений, файл `.env.example`.',
        'A project directory always has files that do not belong in the history: dependencies (`node_modules/` weighs hundreds of megabytes and is restored by one command), build output (`dist/`), logs, and above all files with passwords and keys such as `.env`. If you do not exclude them, `git add .` picks up everything.\n\nThe list of exclusions is the [[git.ignore|.gitignore]] file in the repository root, one pattern per line: `node_modules/` (a trailing slash means a directory only; without it the pattern matches a file or a directory of that name), `*.log` (any file with that ending in any directory), `/build` (build in the root only; `/build/` only a directory there), `!.env.example` (an exclamation mark brings back a file excluded by a rule above). `git status` stops showing such files, and `git add` refuses to add them without `-f`. The `.gitignore` itself is committed: the whole team needs the rules.\n\n### Secrets and the history\n\n`.gitignore` affects only untracked files. If `.env` already got into a commit, a line in `.gitignore` changes nothing: Git keeps tracking the file. `git rm --cached .env` stops tracking it without deleting it from disk. But the old commits stay as they were, with the old password inside, for everyone who copied the history. So the working rule is simple: a secret that got into a commit is considered leaked and is **changed**. To let colleagues know which settings are needed, you commit an example without values: `.env.example`.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: ignoreSetup,
      intro: bi('В каталоге `~/site` появились зависимости, результат сборки, журнал и файл `.env` с паролем, и команда `git status` показывает их все.', '`~/site` now has dependencies, a build, a log and `.env` with a password. `git status` shows them all.'),
      tasks: [
        {
          id: 'ignore',
          prompt: bi('Напишите `.gitignore`, после которого команда `git status` покажет из новых файлов только `.gitignore` и `.env.example`, и запишите оба этих файла коммитом.', 'Write a `.gitignore` after which `git status` shows only `.gitignore` and `.env.example` among the new files, and commit both.'),
          check: {
            when: ignoreDone,
            fail: [
              { if: (f) => '.env' in (head(f)?.files ?? {}), say: bi('Файл .env с паролем попал в коммит, и теперь пароль хранится в истории. Уберите файл из отслеживаемых командой git rm --cached .env и считайте, что пароль утёк.', '.env with the password got into a commit. The password is now in the history: untrack it (git rm --cached .env) and treat the password as leaked.') },
              { if: (f) => !!f.files[`${SITE}/.gitignore`] && (repo(f)?.status.untracked ?? []).some((p) => p.startsWith('node_modules/')), say: bi('Каталог node_modules всё ещё виден, потому что в .gitignore нет правила, которое к нему подходит. Добавьте строку node_modules/.', 'node_modules is still visible: no rule in .gitignore matches it. Add the line node_modules/.') },
              { if: (f) => (repo(f)?.status.untracked ?? []).includes('.env.example') && !(repo(f)?.status.untracked ?? []).includes('.env'), say: bi('Правила записаны верно, и осталось добавить в индекс .gitignore и .env.example и записать коммит.', 'The rules are right. Now add .gitignore and .env.example and commit.') },
            ],
          },
          chips: 'edit .gitignore',
          concepts: ['git.ignore'],
          docRef: { page: 'man/gitignore.5', anchor: 'DESCRIPTION', line: 'trailing' },
          hints: { H1: bi('Вам нужны четыре правила: для зависимостей, для результата сборки, для журналов и для файла .env.', 'Four rules: dependencies, build, logs, .env.'), H2: bi('Запишите в `.gitignore` строки `node_modules/`, `dist/`, `*.log` и `.env`, а потом выполните `git add .gitignore .env.example` и запишите коммит.', 'In `.gitignore`: `node_modules/`, `dist/`, `*.log`, `.env`. Then `git add .gitignore .env.example` and commit.') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Покажите историю только тех коммитов, которые меняли файл `about.html`, так, чтобы каждый коммит занимал одну строку. В уроке об этом не рассказывалось, поэтому найдите ответ в `git help log`.', 'Show the history of only those commits that changed `about.html`, one line per commit. The lesson did not cover it: look it up in `git help log`.'),
      ref: { page: 'man/git-log.1' },
      terminal: {
        setup: ignoreSetup,
        task: {
          id: 'pathlog',
          prompt: bi('Нужна история одного файла, то есть только те коммиты, которые меняли about.html.', 'The history of one file: only the commits that changed about.html.'),
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
  summary: bi('Настройки инфраструктуры пишут на YAML, и читать такой файл нужно так же, как его читает парсер.', 'Infrastructure configuration is written in YAML; you have to read it the way a parser does.'),
  introduces: ['yaml.syntax', 'yaml.traps'],
  uses: ['git.commit'],
  tier: 'core',
  minutes: 30,
  sources: src([S.yaml, S.yamllint, S.norway], [S.ruYaml, S.ruRecord]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В файле настроек кафе записано `country: NO`, то есть Норвегия, а программа, которая этот файл читает, сообщает, что страна равна `false`. Никто не ошибся в букве: так прочитал строку парсер YAML, потому что для него слово NO означает «нет». В этом уроке вы разберётесь, как YAML записывает словари, списки и вложенность, научитесь замечать значения, которые парсер читает не так, как задумал человек, и почините три сломанных файла с помощью линтера, то есть программы, которая проверяет файл и указывает, в какой строке ошибка.',
        'The café settings file says `country: NO`, meaning Norway, and the program that reads it reports the country as `false`. Nobody mistyped a letter: that is how the YAML parser read the line, because for it the word NO means “no”. In this lesson you learn how YAML writes mappings, lists and nesting, learn to spot values the parser reads differently from what a person meant, and fix three broken files with a linter, a program that checks a file and points at the line with the mistake.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      title: bi('Как записывают словари, списки и вложенность', 'Mappings, lists, indentation'),
      body: bi(
        'Почти все файлы настройки, которые встретятся вам дальше в курсе, будь то описание сборки, выкладки или мониторинга, написаны на [[yaml.syntax|YAML]]. Этот формат позволяет записать данные текстом так, чтобы человеку было удобно его читать, а программа понимала его однозначно.\n\nYAML строится из трёх частей. **Словарь** состоит из пар «ключ: значение», и после двоеточия обязательно ставится пробел: `name: site`. **Список** состоит из строк, которые начинаются с «- », и каждая такая строка становится элементом. **Вложенность** задаётся отступом, причём только пробелами, а табуляция в отступе считается синтаксической ошибкой. Всё, что сдвинуто правее ключа, принадлежит этому ключу:\n\n```yaml\nsite:\n  name: edu-cafe\n  pages:\n    - index.html\n    - about.html\n```\n\nЗдесь значением ключа `site` служит словарь из двух ключей, а значением ключа `pages` служит список из двух строк. Если ошибиться на один пробел, изменится смысл: лишний пробел перед ключом относит его к другому словарю, и парсер либо сообщает об ошибке, либо собирает не то дерево, которое вы имели в виду. Длинный текст записывают блоками. Знак `|` сохраняет переводы строк, и так записывают скрипты, а знак `>` склеивает строки в одну.\n\n### Какие значения парсер читает не как строку\n\nПарсер сам решает, какого типа значение: `8080` он читает как число, `true` как логическое значение, а `~` или пустое место как отсутствие значения. На этом и построены [[yaml.traps|ловушки YAML]]. Старая версия языка, YAML 1.1, которую до сих пор читают библиотека PyYAML и многие инструменты, считает логическими ещё и `yes`, `no`, `on` и `off`. Поэтому строка `country: NO` превращается в `false`, и эта история известна как «норвежская проблема». Ловушка срабатывает и на ключах: ключ `on`, который встречается во многих файлах настройки, в YAML 1.1 тоже становится логическим значением true, и программа ищет ключ on, а находит только true. Права доступа `mode: 0755` в YAML 1.1 читаются как восьмеричное число 493. Время `opens: 08:00` YAML 1.1 принимает за число, записанное так же, как часы и минуты: каждая следующая часть после двоеточия в шестьдесят раз мельче предыдущей. Поэтому 08:00 превращается в 8 × 60 + 0 = 480. А `version: 1.10` в любой версии языка становится дробным числом 1.1, и версия «1.10» молча превращается в «1.1». Отсюда одно правило: значения, которые должны остаться строками, берите в кавычки, например `"NO"`, `"0755"`, `"08:00"` и `"1.10"`.\n\nПроверить YAML до того, как он попадёт в коммит, помогает линтер. Команда `yamllint файл` печатает синтаксические ошибки, повторяющиеся ключи и подозрительные логические значения вместе с номерами строк и названием правила.',
        'Almost every configuration file you meet from here on (how to build, deploy and monitor things) is written in [[yaml.syntax|YAML]]. It is a way to write data as text that is easy for a person to read and unambiguous for a program.\n\nYAML has three bricks. A **mapping** is "key: value" pairs, with a required space after the colon: `name: site`. A **list** is lines starting with "- ", each one an item. **Nesting** is set by indentation, spaces only: a tab in the indentation is a syntax error. Everything shifted to the right of a key belongs to it:\n\n```yaml\nsite:\n  name: edu-cafe\n  pages:\n    - index.html\n    - about.html\n```\n\nHere `site` holds a mapping of two keys, and `pages` is a list of two strings. One space off changes the meaning: an extra space before a key makes it belong elsewhere, and the parser either fails or builds a tree you did not mean. Long text is written in blocks: `|` keeps the line breaks (that is how scripts are written), `>` folds the lines into one.\n\n### What the parser reads as something other than a string\n\nThe parser decides the type of a value by itself: `8080` is a number, `true` a boolean, `~` or nothing means null. This is what [[yaml.traps|YAML traps]] are made of. The old version of the language, YAML 1.1 (still read by PyYAML and many tools), also treats `yes`, `no`, `on`, `off` as booleans: `country: NO` becomes `false`, the famous "Norway problem". The trap works on keys too: the `on` key that starts the list of events in many build configuration files becomes the boolean true in YAML 1.1. File permissions `mode: 0755` in YAML 1.1 are the octal number 493. The time `opens: 08:00` is read by YAML 1.1 as a base-60 number, hours and minutes, and becomes 8 × 60 = 480. And `version: 1.10` is the float 1.1 in every version, so version "1.10" silently becomes "1.1". The rule is one: quote values that must stay strings — `"NO"`, `"0755"`, `"08:00"`, `"1.10"`.\n\nA linter helps you check YAML before it gets into a commit: `yamllint file` prints syntax errors, duplicate keys and suspicious truthy values with line numbers and the rule name.',
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
        goal: bi('Расставьте кавычки так, чтобы в обеих версиях YAML все значения кафе остались строками: country должно стать "NO", version должно стать "1.10", opens должно стать "08:00", а mode должно стать "0755". Переключайте версию языка и смотрите, какие значения подсвечены.', 'Add quotes so that in both YAML versions every value of the café stays a string: country "NO", version "1.10", opens "08:00", mode "0755". Switch the version and see which values are highlighted.'),
      },
    },
    {
      id: 'read-lint',
      kind: 'callout',
      tone: 'note',
      levels: ['beginner'],
      title: bi('Как читать ответ yamllint', 'How to read what yamllint prints'),
      body: bi(
        'Линтер отвечает по-английски, но каждая его строка устроена одинаково. Сначала стоят номер строки файла и номер символа в ней, потом слово error или warning, потом само сообщение, а в скобках название правила. Слово error означает ошибку, из-за которой файл не годится, а warning отмечает подозрительное место, которое лучше поправить.\n\nСообщение `6:11 error syntax error: mapping values are not allowed here (syntax)` значит, что в строке 6 на 11-м символе стоит двоеточие там, где его быть не может. Чаще всего так выглядит лишний пробел в начале строки: ключ сдвинулся и перестал стоять на одном уровне с соседними ключами. Сообщение `found character \'\\t\' that cannot start any token` значит, что в отступе стоит табуляция, а YAML принимает только пробелы. На экране табуляция выглядит как несколько пробелов, поэтому удалите отступ целиком и наберите его пробелами заново. Сообщение `duplication of key "lead" in mapping` значит, что ключ lead записан в одном словаре дважды.',
        'The linter answers in English, but every line it prints is built the same way: the line number in the file and the character number in it, then the word error or warning, then the message itself, and the rule name in parentheses. error means a mistake that makes the file unusable; warning marks a suspicious place better fixed.\n\n`6:11 error syntax error: mapping values are not allowed here (syntax)` means that on line 6, at the 11th character, there is a colon where none may be. Most often this is an extra space at the start of the line: the key moved and no longer stands at the level of its neighbours. `found character \'\\t\' that cannot start any token` means there is a tab in the indentation, and YAML accepts spaces only. On screen a tab looks like several spaces, so delete the whole indentation and type it again with spaces. `duplication of key "lead" in mapping` means the key lead is written twice in one mapping.',
      ),
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
      intro: bi('В каталоге `~/cfg` лежат три сломанных файла. Линтер подскажет, в каких строках ошибки, а править файлы удобно командой `edit`.', '`~/cfg` holds three broken files. The linter points at the lines; use `edit` to fix them.'),
      tasks: [
        {
          id: 'lint-all',
          prompt: bi('Почините все три файла так, чтобы команда `yamllint menu.yaml site.yaml team.yaml` завершалась без ошибок, а смысл остался прежним: в меню два блюда с ценами, у сайта есть имя и порт, а руководитель команды один, и это Ada.', 'Fix all three files so that `yamllint menu.yaml site.yaml team.yaml` exits without errors and the meaning stays: two dishes with prices, a site with a name and a port, one team lead, Ada.'),
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
          hints: { H1: bi('В каждом из трёх файлов своя ошибка: в одном лишний пробел, в другом табуляция, а в третьем повторённый ключ.', 'Three different errors: an extra space, a tab, a repeated key.'), H2: bi('В menu.yaml поставьте цену latte на отступ в 4 пробела, как у espresso. В site.yaml замените табуляцию двумя пробелами. В team.yaml оставьте одну строку lead: Ada.', 'In menu.yaml the latte price goes at 4 spaces like espresso; in site.yaml replace the tab with two spaces; in team.yaml keep one line lead: Ada.') },
        },
      ],
    },
    {
      id: 'strict',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Дальше в курсе вы будете проверять файлы автоматически, и такая проверка остановится, только если команда вернула ненулевой код. Но на одни предупреждения `yamllint` отвечает кодом 0, и строка `delivery: yes` пройдёт незамеченной. Найдите в `yamllint --help`, как сделать так, чтобы предупреждения тоже давали ненулевой код, и проверьте файл `~/cfg/flags.yaml`.', 'Later in the course you will check files automatically, and such a check stops only when a command returns a non-zero code. But `yamllint` answers mere warnings with code 0, and `delivery: yes` slips through. Find in `yamllint --help` how to make warnings give a non-zero code too, and check `~/cfg/flags.yaml`.'),
      ref: { page: 'help/yamllint' },
      terminal: {
        setup: { cwd: '~/cfg', files: [{ path: `${HOME}/cfg/flags.yaml`, content: '---\nflags:\n  delivery: yes\n  takeaway: true\n' }] },
        task: {
          id: 'strict',
          prompt: bi('Команда yamllint должна завершиться ненулевым кодом из-за предупреждения в flags.yaml.', 'yamllint ended with a non-zero code because of a warning in flags.yaml.'),
          check: {
            // The run of yamllint counts even when `; echo $?` follows it on the same line: its code is then printed as the last number.
            when: (f) => (f.term.main ?? []).some((r) => /truthy/.test(r.out) && (r.exit === 2 || /(^|[=\s:])2\s*$/.test(r.out.trimEnd()))),
            fail: [{ if: "term['main'][last].line~'yamllint' && term['main'][last].out~'truthy' && term['main'][last].exit=0", say: bi('Линтер нашёл предупреждение truthy, но без нужного флага предупреждения не меняют код ответа, и yamllint вернул 0.', 'The linter found the truthy warning, but without the right flag warnings do not change the exit code, and yamllint returned 0.') }],
          },
          docStep: 3,
          chips: 'yamllint -s flags.yaml',
          docRef: { page: 'help/yamllint', anchor: 'USAGE', line: '--strict' },
          hints: { H1: bi('Ищите в списке флагов слово warnings, то есть «предупреждения».', 'Look for the word "warnings" in the list of keys.') },
        },
      },
    },
    {
      id: 'note',
      kind: 'callout',
      tone: 'why',
      body: bi('Ошибка в YAML редко приводит к понятному сообщению об отказе. Чаще файл разбирается без ошибок, но получается другое дерево данных, и программа работает не так, как вы ожидали. Поэтому YAML проверяют линтером до коммита, а значения, похожие на числа и на «да» и «нет», по привычке пишут в кавычках.', 'A YAML mistake rarely crashes a system with a clear message: the file parses, but into a different tree. That is why YAML is linted before a commit, and values that look like numbers or yes/no are quoted out of habit.'),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['yaml.q.list', 'yaml.q.block', 'yaml.q.indent', 'yaml.q.norway', 'yaml.q.fill-lint'] },
  ],
};

function yamlCheck(text: string, want: unknown): boolean {
  try {
    return JSON.stringify(yamlParse(text, { uniqueKeys: true })) === JSON.stringify(want);
  } catch {
    return false;
  }
}

export const lessons: Lesson[] = [repoLesson, branchesLesson, undoLesson, ignoreLesson, yamlLesson];

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
      prompt: bi('В каталоге `~/site` изменён файл `index.html` и появился новый файл `notes.txt`. Запишите коммитом только `index.html` с сообщением `Fix title`.', 'In `~/site`, `index.html` is changed and there is a new `notes.txt`. Commit only `index.html` with the message `Fix title`.'),
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
      prompt: bi('Создайте ветку `feature/contacts`, добавьте в ней коммитом файл `contacts.html`, вернитесь на ветку `main` и влейте в неё новую ветку.', 'Create a branch `feature/contacts`, add `contacts.html` in it with a commit, go back to `main` and merge the branch.'),
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
      prompt: bi('Влейте ветку `team-text` в `main` так, чтобы в файле `about.html` остались обе версии спорной строки, и завершите слияние.', 'Merge `team-text` into `main` keeping both versions of the disputed line in `about.html`, and finish the merge.'),
      check: { when: (f) => (head(f)?.parents.length ?? 0) === 2 && !/^(<{7}|={7}|>{7})/m.test(head(f)?.files['about.html'] ?? '') && (head(f)?.files['about.html'] ?? '').includes('baristas') && (head(f)?.files['about.html'] ?? '').includes('Open daily') },
    },
  },
  {
    id: 'git-yaml.place.ignore',
    level: 'experienced',
    key: false,
    concepts: ['git.ignore'],
    kind: 'task',
    setup: ignoreSetup,
    task: {
      id: 'p4',
      prompt: bi('В каталоге `~/site` появились зависимости, результат сборки, журнал и файл `.env` с паролем. Сделайте так, чтобы из новых файлов команда `git status` показывала только `.gitignore` и `.env.example`, и запишите эти два файла коммитом.', 'In `~/site` there are now dependencies, a build, a log and `.env` with a password. Make `git status` show only `.gitignore` and `.env.example` among the new files, and commit those two files.'),
      check: { when: ignoreDone },
    },
  },
  {
    id: 'git-yaml.place.yaml',
    level: 'experienced',
    key: false,
    concepts: ['yaml.syntax'],
    kind: 'task',
    setup: { cwd: '~/cfg', files: [{ path: `${HOME}/cfg/site.yaml`, content: '---\nsite:\n\tname: edu-cafe\n  port: 8080\n  country: NO\n' }] },
    task: {
      id: 'p5',
      prompt: bi('Почините файл `~/cfg/site.yaml` так, чтобы команда `yamllint --strict site.yaml` завершалась кодом 0, а парсер получал имя сайта, порт 8080 и страну, записанную строкой NO.', 'Fix `~/cfg/site.yaml` so that `yamllint --strict site.yaml` exits with code 0 and the parser gets the site name, the port 8080 and the country as the string NO.'),
      check: { when: (f) => yamlCheck(f.files[`${HOME}/cfg/site.yaml`]?.text ?? '', { site: { name: 'edu-cafe', port: 8080, country: 'NO' } }) && !lintYaml(f.files[`${HOME}/cfg/site.yaml`]?.text ?? '').length },
    },
  },
  undoPlacement,
  {
    id: 'git-yaml.place.norway',
    level: 'experienced',
    key: true,
    concepts: ['yaml.traps'],
    kind: 'quiz',
    item: {
      id: 'git-yaml.place.q.norway',
      kind: 'multi',
      concepts: ['yaml.traps'],
      prompt: bi('В каких строках парсер YAML 1.1 прочитает ключ или значение не как строку? Отметьте все такие строки.', 'In which lines does a YAML 1.1 parser read the key or the value NOT as a string? Mark them all.'),
      options: [
        { id: 'off', text: 'delivery: off', correct: true },
        { id: 'zip', text: 'zip: 0123', correct: true },
        { id: 'time', text: 'closes: 22:30', correct: true },
        { id: 'yes', text: 'open: "yes"', why: bi('Кавычки делают значение строкой в любой версии YAML.', 'Quotes make a value a string in any YAML version.') },
        { id: 'word', text: 'city: Oslo', why: bi('Обычное слово парсер читает как строку.', 'An ordinary word is a string.') },
      ],
      explain: bi('В YAML 1.1 значение off логическое, 0123 читается как восьмеричное число 83, а 22:30 как шестидесятеричное число 22 × 60 + 30 = 1350.', 'In YAML 1.1 off is a boolean, 0123 is the octal number 83, and 22:30 is the base-60 number 22 × 60 + 30 = 1350.'),
    },
  },
];

export const block: Block = {
  id: 'git-yaml',
  order: 25,
  title: bi('Git и YAML', 'Git and YAML'),
  summary: bi('В этом блоке вы научитесь сохранять версии проекта в репозитории Git, работать с ветками и слиянием, отменять сделанное, исключать лишние файлы через .gitignore и читать файлы настроек в формате YAML так, как их читает программа. Блок идёт до контейнеров, потому что описания сборки и выкладки, которые встретятся дальше, тоже хранятся в репозитории и написаны на YAML.', 'In this block you learn to save project versions in a Git repository, work with branches and merges, undo things, exclude files with .gitignore and read settings files in the YAML format the way a program reads them. It comes before containers because the build and deployment descriptions you meet later are kept in a repository and written in YAML.'),
  checklistStep: null,
  levels: {
    beginner: bi('Ещё не пользовался Git', 'Has not used Git'),
    intermediate: bi('Делал коммиты из среды разработки', 'Has committed from an IDE'),
    experienced: bi('Работал с ветками и merge request и правил файл пайплайна', 'Branches and merge requests, has edited a CI file'),
  },
  hours: { beginner: 17, intermediate: 12, experienced: 6 },
  lessons: lessons.map((l) => l.id),
  sources: src([S.progit, S.ref, S.yaml], [S.ruBook, S.ruLgb, S.ruYaml]),
  docSources: ['git-help', 'help'],
  placement,
  exam: 'git-yaml.exam.config',
};

