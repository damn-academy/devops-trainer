// Process explainers for what the Git and CI/CD lessons used to describe only
// in prose: how branches merge (fast-forward, merge commit, conflict), how
// artifacts and the cache travel between jobs and pipelines, how stages and
// `needs` schedule a pipeline, and how a pipeline deploys to Kubernetes in
// the push and the pull model (06 §2.3, §3.4, §3.7).
//
// Every model starts with two to four blocks and reveals the rest when the
// process reaches it; one block acts at every step and says in a callout what
// it does, and what it hands on travels along a line as a labelled card.

import { defineModel } from '../../core/define';
import { bi, fmt, t as tx, type Bi } from '../../core/i18n';
import type { Step } from '../../core/types';
import { card, fmtBi, hiddenExcept, sec } from './explainers';

const last = (s: Step[]) => s[s.length - 1]?.metrics ?? {};
const metric = (s: Step[], id: string) => last(s)[id] ?? 0;
const join = (x: Bi, y: Bi): Bi => ({ ru: `${x.ru} ${y.ru}`, en: `${x.en} ${y.en}` });

// ── E-MERGE: what git merge does with two branches ──────────────────────────

type MergeP = { mainMoved: boolean; noFf: boolean };

export function mergeKind(p: MergeP, broken: ReadonlySet<string>): 'ff' | 'commit' | 'conflict' | 'refused' {
  if (broken.has('dirty')) return 'refused';
  if (broken.has('same-lines')) return 'conflict';
  return p.mainMoved || p.noFf ? 'commit' : 'ff';
}

const MERGE_ALL = ['a', 'b', 'c', 'd', 'm', 'main', 'feature', 'head', 'file', 'e-ba', 'e-ca', 'e-dc', 'e-mb', 'e-md', 'e-file', 'e-feat', 'e-head'];

export const mergeModel = defineModel<MergeP>({
  id: 'git.merge-kinds',
  frame: 'visible',
  block: 'git-yaml',
  title: bi('Как git merge соединяет две ветки', 'How git merge joins two branches'),
  summary: bi(
    'Вы закончили работу в ветке feature и вливаете её в main. Если в main за это время не появилось новых коммитов, Git передвигает main на последний коммит ветки feature. Если обе ветки ушли вперёд, Git сравнивает их с общим предком и записывает коммит с двумя родителями. Если обе ветки изменили одни и те же строки, Git останавливается и просит вас решить, какой текст оставить.',
    'A branch is a name on a commit. If main did not move on, a merge just moves it to the last commit of the other branch; if both branches moved on, Git compares them with their common ancestor and creates a commit with two parents; if both changed the same lines, it stops and asks you to decide.',
  ),
  intro: bi(
    'Сейчас на схеме только коммит A и две ветки, которые на него указывают. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». Новый коммит появляется на схеме в тот момент, когда Git его записывает. Подсвечен тот блок, который работает сейчас, а облачко рядом с ним говорит, что он делает.\n\nКогда дойдёте до конца, включите в «Параметрах» коммит B в main или флаг `--no-ff` и посмотрите, появится ли коммит слияния.',
    'For now the diagram shows only commit A and the two branches pointing to it. Press “Start from the first step”, then go on with “Step forward”. New commits appear when they are made; the working block is highlighted and the callout says what it does.\n\nAt the end, switch on commit B on main or the `--no-ff` key in “Parameters” and see whether a merge commit appears.',
  ),
  legend: [
    { mark: 'active', text: bi('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: bi('что этот блок делает', 'what that block does') },
    { mark: 'token', text: bi('что передаётся дальше: ссылка, версии файла', 'what is handed on: a link, file versions') },
    { mark: 'icon:disk', text: bi('коммит', 'a commit') },
    { mark: 'icon:file', text: bi('имя ветки, HEAD или файл проекта', 'a branch name, HEAD or a project file') },
    { mark: 'line', text: bi('ссылка коммита на родителя', 'a commit’s link to its parent') },
    { mark: 'wait', text: bi('слияние ждёт вашего решения', 'the merge waits for your decision') },
    { mark: 'err', text: bi('здесь Git остановился', 'Git stopped here') },
  ],
  stopLabel: bi('Слияние остановилось', 'The merge stopped'),
  concepts: ['git.branch', 'git.merge', 'git.conflict'],
  diagram: {
    width: 960,
    height: 420,
    nodes: [
      { id: 'a', label: 'A', icon: 'disk', sub: 'merge-base', family: 'ci-source', shape: 'doc', x: 40, y: 190, w: 128, h: 56, card: card(bi('Коммит, от которого отошла ветка feature. Для слияния он служит базой: Git сравнивает с ним обе ветки и так узнаёт, кто что изменил.', 'The commit the feature branch started from. For a merge it is the base: Git compares both branches with it to see who changed what.'), bi('Коммит был в main до того, как появилась ветка feature.', 'Was on main before the branch started.'), 'git merge-base main feature', { page: 'man/git-merge.1', anchor: 'DESCRIPTION' }) },
      { id: 'b', label: 'B', icon: 'disk', sub: 'main', family: 'ci-source', shape: 'doc', x: 260, y: 190, w: 128, h: 56, card: card(bi('Коммит коллеги в main, сделанный после того, как вы создали ветку feature. Из-за него истории двух веток разошлись.', 'A colleague’s commit on main made after you branched off. Because of it the histories diverged.'), bi('Коммит сделал коллега в ветке main.', 'A colleague: git commit on main.'), 'git log --oneline main') },
      { id: 'c', label: 'C', icon: 'disk', sub: 'feature', family: 'ci-build', shape: 'doc', x: 260, y: 50, w: 128, h: 56, card: card(bi('Ваш первый коммит в ветке feature. Его родителем служит коммит A.', 'Your first commit on the feature branch. Its parent is A.'), bi('Коммит сделали вы в ветке feature.', 'You: git commit on feature.'), 'git log --oneline feature') },
      { id: 'd', label: 'D', icon: 'disk', sub: 'feature', family: 'ci-build', shape: 'doc', x: 470, y: 50, w: 128, h: 56, card: card(bi('Последний коммит ветки feature, на который указывает её имя.', 'The last commit of the feature branch: its name points here.'), bi('Коммит сделали вы в ветке feature.', 'You: git commit on feature.'), 'git rev-parse feature') },
      { id: 'm', label: 'M', icon: 'disk', sub: { ru: '2 родителя', en: '2 parents' }, family: 'ci-test', shape: 'doc', x: 600, y: 190, w: 144, h: 56, card: card(bi('Коммит слияния с двумя родителями. Его снимок объединяет изменения обеих веток относительно коммита A. Такой коммит появляется, только если передвинуть ветку нельзя или если вы запретили это флагом `--no-ff`.', 'A commit with two parents, B and D. Its snapshot joins the changes of both branches relative to A. It appears only when a fast-forward is impossible or forbidden with --no-ff.'), bi('Коммит записывает команда `git merge`.', 'git merge.'), 'git log --graph --oneline', { page: 'man/git-merge.1', anchor: 'OPTIONS', line: '--no-ff' }) },
      { id: 'main', label: 'main', icon: 'file', sub: '→ A', family: 'neutral', shape: 'pill', x: 800, y: 196, w: 144, h: 44, card: card(bi('Ветка main, то есть файл с хэшем одного коммита. Слияние в main меняет этот хэш и, если нужно, добавляет коммит слияния.', 'The main branch: a file with the hash of one commit. A merge into main changes only that hash (and maybe adds the commit M).'), bi('Ветку передвигает команда `git merge`.', 'git merge moves it.'), 'cat .git/refs/heads/main') },
      { id: 'feature', label: 'feature', icon: 'file', sub: '→ D', family: 'neutral', shape: 'pill', x: 800, y: 56, w: 144, h: 44, card: card(bi('Ветка feature. Слияние в main её не трогает, и после слияния её можно удалить, а коммиты останутся в истории main.', 'The feature branch. Merging into main does not touch it: after the merge it can be deleted and its commits stay in main’s history.'), bi('Ветку создаёт команда `git switch -c feature`.', 'git switch -c feature.'), 'git branch -v') },
      { id: 'head', label: 'HEAD', icon: 'file', sub: '→ main', family: 'neutral', shape: 'pill', x: 800, y: 320, w: 144, h: 44, card: card(bi('Слияние всегда вливает названную ветку в ту, на которой вы стоите. Поэтому перед слиянием нужно перейти на main командой `git switch main`.', 'A merge always brings the named branch into the one you are on. That is why you run git switch main first.'), bi('HEAD переписывает команда `git switch`.', 'git switch.'), 'cat .git/HEAD') },
      { id: 'file', label: 'about.html', icon: 'file', work: 'spin', sub: 'base · ours · theirs', family: 'obj', shape: 'buffer', x: 360, y: 320, w: 208, h: 56, card: card(bi('Для каждого файла Git берёт три версии: из общего предка, из вашей ветки и из чужой. Строку, которую изменила только одна сторона, Git берёт у этой стороны. Строку, которую обе стороны изменили по-разному, он отдаёт вам с маркерами `<<<<<<<`, `=======` и `>>>>>>>`.', 'For each file Git takes three versions: from the common ancestor, from your branch and from theirs. A line one side changed is taken from that side; a line both changed differently is handed to you with the markers <<<<<<< ======= >>>>>>>.'), bi('Версии сводит команда `git merge`, а при конфликте решение принимаете вы.', 'git merge; on a conflict, you.'), 'git diff', { page: 'man/git-merge.1', anchor: 'DESCRIPTION' }) },
    ],
    edges: [
      { id: 'e-ba', from: 'b', to: 'a', label: bi('родитель', 'parent'), card: card(bi('Коммит B продолжает историю main от коммита A.', 'B continues main’s history from A.'), bi('Ссылку записала команда `git commit`.', 'git commit.')) },
      { id: 'e-ca', from: 'c', to: 'a', label: bi('родитель', 'parent'), card: card(bi('Коммит C начинается от A, потому что в момент `git switch -c feature` ветка указывала на A.', 'C starts from A: at git switch -c feature the branch pointed to A.'), bi('Ссылку записала команда `git commit`.', 'git commit.')) },
      { id: 'e-dc', from: 'd', to: 'c', label: bi('родитель', 'parent'), card: card(bi('Коммит D продолжает ветку feature после C.', 'D continues the feature branch.'), bi('Ссылку записала команда `git commit`.', 'git commit.')) },
      { id: 'e-mb', from: 'm', to: 'b', label: bi('первый родитель', 'parent 1'), card: card(bi('Первым родителем коммита слияния становится коммит той ветки, в которую вливали, то есть main.', 'The first parent of a merge commit is the commit of the branch merged into (main).'), bi('Ссылку записывает команда `git merge`.', 'git merge.'), 'git log --first-parent --oneline') },
      { id: 'e-md', from: 'm', to: 'd', label: bi('второй родитель', 'parent 2'), card: card(bi('Вторым родителем становится последний коммит вливаемой ветки, и по нему история помнит, откуда пришли изменения.', 'The second parent is the last commit of the merged branch. That is how history remembers where the changes came from.'), bi('Ссылку записывает команда `git merge`.', 'git merge.'), 'git show --format=%P -s HEAD') },
      { id: 'e-file', from: 'file', to: 'm', label: bi('трёхстороннее сравнение', 'three-way comparison'), card: card(bi('Снимок коммита слияния собирается файл за файлом из трёх версий. Конфликтом считаются только те строки, которые обе стороны изменили по-разному.', 'M’s snapshot is assembled file by file from three versions. A conflict is only the lines where both sides departed from the base differently.'), bi('Версии сравнивает команда `git merge`.', 'git merge.')) },
      { id: 'e-feat', from: 'feature', to: 'd', label: bi('последний коммит ветки', 'refs/heads/feature'), card: card(bi('Имя ветки указывает на её последний коммит.', 'The branch name points to its last commit.'), bi('Имя передвигает команда `git commit`.', 'git commit moves it.')) },
      { id: 'e-head', from: 'head', to: 'main', label: bi('текущая ветка', 'ref: refs/heads/main'), card: card(bi('Вы стоите на ветке main, поэтому слияние будет передвигать её.', 'You are on main: the merge will move it.'), bi('Ссылку переписывает команда `git switch main`.', 'git switch main.')) },
    ],
  },
  params: [
    {
      id: 'mainMoved',
      label: bi('Пока вы работали, в main появился коммит B', 'Commit B appeared on main'),
      group: bi('Что произошло в ветках', 'What happened on the branches'),
      kind: 'toggle',
      default: false,
      near: 'b',
      predict: {
        prompt: bi('Пока вы работали в ветке feature, коллега сделал в main коммит B. Что сделает git merge feature?', 'While you worked on feature, a colleague made commit B on main. What does git merge feature do?'),
        options: [
          { id: 'commit', text: bi('Git запишет коммит слияния с двумя родителями', 'Create a merge commit with two parents') },
          { id: 'ff', text: bi('Git передвинет main на коммит D без нового коммита', 'Just move main to D') },
        ],
        resolve: (_p, n) => (metric(n, 'created') > 0 ? 'commit' : 'ff'),
      },
    },
    {
      id: 'noFf',
      label: bi('Слияние запускают с флагом --no-ff', 'The --no-ff key'),
      group: bi('Как вы сливаете', 'How you merge'),
      kind: 'toggle',
      default: false,
      near: 'm',
      predict: {
        prompt: bi('В main новых коммитов не было, но вы запускаете git merge --no-ff feature. Появится ли коммит слияния?', 'main did not move on, but you run git merge --no-ff feature. Will a merge commit appear?'),
        options: [
          { id: 'yes', text: bi('Да, потому что флаг --no-ff запрещает передвигать ветку без коммита слияния', 'Yes: --no-ff forbids the fast-forward') },
          { id: 'no', text: bi('Нет, потому что соединять нечего и main передвинется вперёд', 'No: there is nothing to join, main just moves') },
        ],
        resolve: (_p, n) => (metric(n, 'created') > 0 ? 'yes' : 'no'),
      },
    },
  ],
  breaks: [
    {
      id: 'same-lines',
      label: bi('Обе ветки по-разному изменили одну строку about.html', 'Both branches changed the same line'),
      remove: ['e-file'],
      predict: {
        prompt: bi('В коммите B и в коммите D один и тот же абзац about.html переписан по-разному. Что сделает git merge?', 'B and D rewrote the same paragraph of about.html differently. What does git merge do?'),
        options: [
          { id: 'stop', text: bi('Git остановится и попросит вас выбрать текст', 'Stop and ask you to choose') },
          { id: 'newer', text: bi('Git возьмёт ту правку, которую сделали позже', 'Take the later edit') },
          { id: 'ours', text: bi('Git оставит версию из main', 'Keep main’s version') },
        ],
        resolve: () => 'stop',
      },
    },
    {
      id: 'dirty',
      label: bi('В main осталась незакоммиченная правка about.html', 'An uncommitted edit of about.html on main'),
      remove: ['e-head'],
      predict: {
        prompt: bi('В рабочем каталоге лежит незакоммиченная правка about.html, а ветка feature тоже меняла этот файл. Что ответит git merge?', 'The working directory has an uncommitted edit of about.html, and feature changed that file too. What does git merge answer?'),
        options: [
          { id: 'refuse', text: bi('Git откажется сливать, потому что слияние затёрло бы вашу правку', 'Refuse: the edit would be overwritten') },
          { id: 'mix', text: bi('Git смешает вашу правку с результатом слияния', 'Mix the edit into the merge') },
        ],
        resolve: () => 'refuse',
      },
    },
  ],
  metrics: [
    { id: 'created', label: bi('число новых коммитов при слиянии', 'commits created by the merge') },
    { id: 'parents', label: bi('число родителей у последнего коммита main', 'parents of main’s tip') },
    { id: 'conflicts', label: bi('число файлов в конфликте', 'files in conflict') },
  ],
  run(p, broken) {
    const kind = mergeKind(p, broken);
    const diverged = p.mainMoved || kind === 'conflict';
    const m0 = { created: 0, parents: 1, conflicts: 0 };
    const steps: Step[] = [
      {
        id: 'fork',
        label: 'switch -c',
        caption: bi('Команда `git switch -c feature` создаёт ветку feature. Новая ветка указывает на тот же коммит A, что и main, и никакие файлы при этом не копируются.', 'git switch -c feature: the new branch points to the same commit A as main. Nothing is copied.'),
        focus: ['feature', 'a'],
        say: { feature: bi('Git создаёт имя feature и записывает в него тот же хэш коммита A, что и у main.', 'Git creates the name feature and writes into it the same hash of commit A as main has.') },
        states: { ...hiddenExcept(MERGE_ALL, 'a', 'main', 'feature'), a: 'ok' },
        values: { main: '→ A', feature: '→ A' },
        metrics: m0,
      },
      {
        id: 'work',
        label: 'C, D',
        caption: bi('Вы делаете в ветке feature два коммита, C и D. Имя feature передвигается на D, а main по-прежнему указывает на A.', 'You make two commits on feature. The feature branch moves to D; main stays on A.'),
        focus: ['c', 'd', 'e-ca', 'e-dc', 'e-feat'],
        reveal: ['c', 'd', 'e-ca', 'e-dc', 'e-feat'],
        tokens: [{ edge: 'e-feat', label: 'feature → D' }],
        say: { d: bi('Вы записали в ветке feature коммиты C и D, и имя ветки теперь указывает на D.', 'You recorded commits C and D on feature, and the branch name now points to D.') },
        states: { c: 'ok', d: 'ok' },
        values: { feature: '→ D' },
        metrics: m0,
      },
    ];
    if (diverged)
      steps.push({
        id: 'theirs',
        label: 'B',
        caption: bi('Тем временем коллега делает в main коммит B. Теперь у коммита A два потомка, истории разошлись, и простым передвижением ветки их уже не соединить.', 'Meanwhile a colleague makes commit B on main. Now A has two descendants: the histories diverged and a plain fast-forward can no longer join them.'),
        focus: ['b', 'e-ba', 'main'],
        reveal: ['b', 'e-ba'],
        tokens: [{ edge: 'e-ba', label: bi('родитель A', 'parent A') }],
        say: { b: bi('Коллега записал в ветке main коммит B, и main теперь указывает на него.', 'A colleague recorded commit B on main, and main now points to it.') },
        states: { b: 'ok' },
        values: { main: '→ B' },
        metrics: m0,
      });
    steps.push({
      id: 'switch',
      label: 'switch main',
      caption: bi('Вы переходите на main командой `git switch main`, и HEAD теперь указывает на main. Поэтому слияние будет передвигать эту ветку.', 'git switch main: HEAD points to main. The merge will move this branch.'),
      focus: ['head', 'e-head', 'main'],
      reveal: ['head', 'e-head'],
      tokens: [{ edge: 'e-head', label: 'ref: refs/heads/main' }],
      say: { head: bi('Git записывает в HEAD ссылку на ветку main, потому что вы перешли на неё.', 'Git writes a link to main into HEAD, because you switched to it.') },
      states: { head: 'on' },
      metrics: m0,
    });
    if (kind === 'refused') {
      steps.push({
        id: 'refused',
        label: 'git merge',
        caption: bi('В рабочем каталоге лежит незакоммиченная правка того же файла about.html. Слияние затёрло бы её, поэтому Git ничего не меняет и прерывает команду.', 'The working directory has an uncommitted edit of the same file. The merge would overwrite it, so Git does nothing.'),
        focus: ['file', 'head'],
        reveal: ['file'],
        say: { file: bi('Git видит в about.html правку, которой нет ни в одном коммите, и отказывается её затирать.', 'Git sees an edit in about.html that is in no commit and refuses to overwrite it.') },
        states: { file: 'err', head: 'warn' },
        metrics: m0,
        broken: { at: 'file', message: 'error: Your local changes to the following files would be overwritten by merge:\n\tabout.html\nPlease commit your changes or stash them before you merge.\nAborting', caption: bi('Сначала запишите свою правку коммитом или отмените её, а затем запускайте слияние снова.', 'Commit the edit first (or drop it), then merge.') },
      });
      return steps;
    }
    if (kind === 'ff') {
      steps.push({
        id: 'ff',
        label: 'fast-forward',
        caption: bi('В main новых коммитов не было, поэтому коммит D уже продолжает её историю. Git записывает в main хэш коммита D, и такое слияние называется перемоткой (fast-forward): нового коммита нет, история осталась прямой.', 'main did not move on: D already continues its history. Git just writes D’s hash into main. No new commit; the history stays straight.'),
        focus: ['main', 'd'],
        say: { main: bi('Git записывает в ветку main хэш коммита D, и main передвигается вперёд без нового коммита.', 'Git writes the hash of D into main, and main moves forward without a new commit.') },
        states: { main: 'ok', d: 'ok' },
        values: { main: '→ D' },
        metrics: { created: 0, parents: 1, conflicts: 0 },
      });
      return steps;
    }
    steps.push({
      id: 'base',
      label: bi('общий предок', 'common ancestor'),
      caption: diverged
        ? bi('Git находит общего предка двух веток, коммит A, и для каждого файла сравнивает три версии: из A, из B и из D.', 'Git finds the common ancestor A and for every file compares three versions: from A, from B and from D.')
        : bi('Передвинуть ветку было бы можно, но флаг `--no-ff` это запретил. Поэтому Git всё равно сравнивает версии файлов с общим предком A.', '--no-ff: a fast-forward would be possible, but you forbade it. Git still compares the versions with the base A.'),
      focus: ['file', 'a', 'e-file'],
      reveal: ['file', 'e-file', 'm'],
      tokens: [{ edge: 'e-file', label: 'base · ours · theirs' }],
      say: { file: bi('Git берёт файл about.html в трёх версиях и смотрит, какая сторона что изменила.', 'Git takes about.html in three versions and looks at which side changed what.') },
      states: { file: 'on', a: 'on', m: 'off' },
      metrics: m0,
    });
    if (kind === 'conflict') {
      steps.push({
        id: 'conflict',
        label: 'CONFLICT',
        caption: bi('Один и тот же абзац about.html обе стороны изменили по-разному. Git не выбирает за вас: он вписывает в файл обе версии с маркерами и останавливается посреди слияния.', 'Both sides changed the same paragraph of about.html differently. Git does not choose for you: it writes both versions with markers and stops in the middle of the merge.'),
        focus: ['file', 'm'],
        say: { file: bi('Обе ветки по-разному изменили один абзац, и Git вписывает в файл обе версии между маркерами, чтобы выбрали вы.', 'Both branches changed one paragraph differently, and Git writes both versions between markers for you to choose.') },
        states: { file: 'err', m: 'wait' },
        values: { file: '<<<<<<< HEAD … >>>>>>> feature' },
        metrics: { created: 0, parents: 1, conflicts: 1 },
        broken: { at: 'file', message: 'Auto-merging about.html\nCONFLICT (content): Merge conflict in about.html\nAutomatic merge failed; fix conflicts and then commit the result.', caption: bi('Отредактируйте файл, удалите маркеры, выполните git add about.html и git commit.', 'Edit the file, remove the markers, then git add about.html and git commit.') },
      });
      return steps;
    }
    steps.push(
      {
        id: 'commit',
        label: 'M',
        caption: diverged
          ? bi('Изменения двух веток не пересекаются, поэтому Git соединяет их сам и записывает коммит слияния M с двумя родителями, B и D.', 'The changes do not overlap. Git records the commit M with two parents: B (or A) and D.')
          : bi('Git записывает коммит слияния M с двумя родителями, A и D, хотя изменений в main не было: этого потребовал флаг `--no-ff`.', 'Git records the merge commit M with two parents, A and D, although main had no changes: --no-ff demanded it.'),
        focus: ['m', 'e-mb', 'e-md'],
        reveal: ['e-mb', 'e-md'],
        tokens: [{ edge: 'e-md', label: bi('второй родитель D', 'parent 2: D') }],
        say: { m: bi('Git записывает коммит слияния M, у которого два родителя: последний коммит main и последний коммит feature.', 'Git writes the merge commit M with two parents: the last commit of main and the last commit of feature.') },
        states: { m: 'ok', file: 'ok' },
        metrics: m0,
      },
      {
        id: 'moved',
        label: 'main → M',
        caption: bi('Ветка main передвигается на коммит M. Команда `git log --graph` покажет развилку и то место, где ветки снова сошлись.', 'main moves to M. git log --graph shows the fork and the place where the branches met.'),
        focus: ['main'],
        say: { main: bi('Git записывает в ветку main хэш коммита слияния M.', 'Git writes the hash of the merge commit M into main.') },
        states: { main: 'ok' },
        values: { main: '→ M' },
        metrics: { created: 1, parents: 2, conflicts: 0 },
      },
    );
    return steps;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломку убрали, и слияние снова доходит до конца.', 'The break is removed: the merge completes again.');
      return change.id === 'same-lines' ? bi('Обе стороны изменили одни и те же строки, поэтому Git останавливается и ждёт вашего решения.', 'Both sides changed the same lines: Git stops and waits for your decision.') : bi('Git защищает незакоммиченную правку и отказывается сливать ветки, пока вы не запишете её коммитом.', 'An uncommitted edit is protected: Git refuses to merge until you commit it.');
    }
    const c = metric(next, 'created');
    if (change.id === 'mainMoved') return b.mainMoved ? bi('Истории разошлись, передвинуть ветку уже нельзя, и появляется коммит M с двумя родителями.', 'The histories diverged: a fast-forward is impossible, and the commit M with two parents appears.') : c ? bi('В main новых коммитов нет, но флаг --no-ff всё равно требует коммит слияния.', 'main did not move on, but --no-ff still demands a merge commit.') : bi('В main новых коммитов нет, поэтому слияние сводится к тому, что Git передвигает ветку вперёд.', 'main did not move on: the merge is just a pointer moving forward.');
    return b.noFf ? bi('С флагом --no-ff коммит слияния создаётся всегда, и по истории видно, что работа шла в отдельной ветке.', '--no-ff: a merge commit is always created, and the history shows that the work happened on a branch.') : c ? bi('Без флага --no-ff коммит слияния всё равно нужен, потому что истории разошлись.', 'Without --no-ff a merge commit is still needed: the histories diverged.') : bi('Без флага --no-ff Git передвигает main вперёд, и коммита слияния нет.', 'Without --no-ff Git fast-forwards main; there is no merge commit.');
  },
});

// ── E-ARTCACHE: artifacts within a pipeline, the cache between pipelines ────

type ArtP = { key: string; lockChanged: boolean; otherRunner: boolean };

export function artNumbers(p: ArtP): { hit: boolean; npm2: number } {
  // The local cache is kept on one runner; the key decides which shelf it is.
  const sameShelf = p.key === 'branch' || (p.key === 'lock' && !p.lockChanged);
  const hit = !p.otherRunner && sameShelf;
  return { hit, npm2: hit ? 9 : 52 };
}

const ART_ALL = ['b1', 't1', 'deploy', 'art', 'cache', 'lock', 'b2', 'e-up', 'e-down', 'e-down2', 'e-save', 'e-key', 'e-restore'];

export const artifactsModel = defineModel<ArtP>({
  id: 'cicd.artifacts-cache',
  frame: 'visible',
  block: 'cicd',
  title: bi('Артефакт внутри пайплайна и кэш между пайплайнами', 'Artifacts within a pipeline, the cache between pipelines'),
  summary: bi(
    'Каждая джоба начинается на чистой машине, поэтому каталог dist/ доходит от сборки до теста и выкладки только как артефакт, который хранит сервер. Кэш раннер хранит у себя под именем ключа. Он ускоряет следующий пайплайн, если ключ совпал и джоба попала на тот же раннер, а если нет, сборка идёт дольше, но всё равно проходит.',
    'Every job starts on a clean machine. dist/ gets from the build to the test only as an artifact through the forge. The cache lies on the runner under a key and speeds up the next pipeline if the key matches and the job lands on the same runner; if not, the build takes longer but passes.',
  ),
  intro: bi(
    'Сейчас на схеме только джоба сборки первого пайплайна. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». В верхнем ряду идёт первый пайплайн, внизу второй, а между ними лежат артефакты на сервере и кэш на раннере.\n\nКогда дойдёте до второй сборки, смените в «Параметрах» ключ кэша, измените файл package-lock.json или отправьте сборку на другой раннер и сравните время `npm ci` в счётчиках под схемой.',
    'For now the diagram shows only the build job of the first pipeline. Press “Start from the first step”, then go on with “Step forward”. The top row is the first pipeline, the bottom one the second; between them are the artifacts on the server and the cache on the runner.\n\nOnce you reach the second build, change the cache key, change package-lock.json or send the build to another runner in “Parameters”, and compare the `npm ci` time in the counters under the diagram.',
  ),
  legend: [
    { mark: 'active', text: bi('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: bi('что этот блок делает', 'what that block does') },
    { mark: 'token', text: bi('какие файлы передаются дальше', 'which files are handed on') },
    { mark: 'icon:container', text: bi('джоба в контейнере на раннере', 'a job in a container on a runner') },
    { mark: 'icon:disk', text: bi('хранилище, в котором лежат артефакты на сервере или кэш на раннере', 'storage: artifacts on the server or the cache on a runner') },
    { mark: 'icon:file', text: bi('файл с точными версиями зависимостей', 'the file with exact dependency versions') },
    { mark: 'warn', text: bi('кэш не нашёлся, и сборка идёт дольше', 'the cache was not found and the build takes longer') },
    { mark: 'err', text: bi('здесь джоба завершилась с ошибкой', 'the job failed here') },
  ],
  stopLabel: bi('Пайплайн остановился', 'The pipeline stopped'),
  concepts: ['cicd.artifact', 'cicd.cache'],
  diagram: {
    width: 960,
    height: 440,
    nodes: [
      { id: 'b1', label: 'build #1', icon: 'container', work: 'dots', sub: 'runner-1', family: 'node', shape: 'rack', x: 30, y: 40, w: 176, h: 84, card: card(bi('Джоба сборки первого пайплайна. Раннер запускает контейнер из образа джобы с чистой копией репозитория, выполняет `npm ci`, а затем собирает сайт в каталог dist/. Когда джоба кончается, контейнер удаляется вместе со всем, что не было загружено.', 'The build job of the first pipeline. A container from the job image, a clean copy of the repository; npm ci, then the build into dist/. After the job the container is deleted with everything that was not uploaded.'), bi('Джобу выполняет раннер по описанию из `.gitlab-ci.yml`.', 'A runner, for a job from .gitlab-ci.yml.'), 'glab ci trace build') },
      { id: 't1', label: 'test #1', icon: 'container', work: 'dots', sub: 'runner-1', family: 'node', shape: 'rack', x: 400, y: 40, w: 176, h: 84, card: card(bi('Джоба следующей стадии. Она начинает с чистой копии репозитория, и каталога dist/ в ней нет, пока его не скачают как артефакт.', 'A job of the next stage. It starts from a clean copy of the repository: there is no dist/ until it is downloaded as an artifact.'), bi('Джобу выполняет раннер.', 'A runner.'), 'glab ci trace test') },
      { id: 'deploy', label: 'deploy #1', icon: 'container', work: 'dots', sub: 'runner-2', family: 'ci-deploy', shape: 'box', x: 760, y: 52, w: 176, h: 60, card: card(bi('Ещё одна джоба, которая может попасть на другой раннер. Ей тоже нужен каталог dist/, и получить его она тоже может только из артефактов.', 'One more job, maybe on another runner. It needs dist/ too, and again only through artifacts.'), bi('Джобу выполняет раннер.', 'A runner.')) },
      { id: 'art', label: bi('артефакты', 'artifacts'), icon: 'disk', sub: 'dist/', family: 'store', shape: 'buffer', x: 400, y: 190, w: 176, h: 60, card: card(bi('Хранилище на сервере. Раннер загружает сюда пути из `artifacts:paths` после успешной джобы, а джобы следующих стадий скачивают их перед своим скриптом, на каком бы раннере они ни оказались. Поэтому доставка гарантирована.', 'The forge storage. The runner uploads artifacts:paths here after a successful job; later-stage jobs download them before their script, whichever runner they land on. Delivery is guaranteed.'), bi('Хранилище ведёт сервер.', 'The forge.'), 'glab ci trace test', { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'artifacts' }) },
      { id: 'cache', label: bi('кэш на runner-1', 'cache on runner-1'), icon: 'disk', sub: 'npm-main', family: 'store', shape: 'buffer', x: 30, y: 190, w: 176, h: 60, card: card(bi('Локальная полка раннера, то есть архив каталога .npm/ под именем ключа. Её видит только этот раннер, если не настроен общий кэш, и стереть её могут в любой момент.', 'The runner’s local shelf: an archive of .npm/ under the key’s name. Only this runner sees it (unless a shared cache is set up), and it may be wiped at any moment.'), bi('Архив кладёт сюда gitlab-runner после успешной джобы.', 'gitlab-runner after a successful job.'), 'glab ci trace build', { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'cache' }) },
      { id: 'lock', label: 'package-lock.json', icon: 'file', sub: '', family: 'obj', shape: 'doc', x: 30, y: 330, w: 176, h: 56, card: card(bi('Список точных версий зависимостей. Ключ `cache:key:files` вычисляется из хэша этого файла, поэтому, когда файл меняется, кэш кладётся на новую полку.', 'The exact versions of the dependencies. The cache:key:files key is built from this file’s hash: a changed file means a new shelf.'), bi('Файл обновляет команда `npm install`, а в репозиторий он попадает коммитом.', 'npm install, in a commit.'), 'git log --oneline package-lock.json') },
      { id: 'b2', label: 'build #2', icon: 'container', work: 'spin', sub: 'runner-1', family: 'node', shape: 'rack', x: 400, y: 316, w: 176, h: 84, card: card(bi('Сборка следующего пайплайна. Перед скриптом раннер ищет кэш по ключу. Если кэш нашёлся, `npm ci` берёт пакеты с диска, а если нет, скачивает их из интернета.', 'The build of the next pipeline. Before the script the runner looks for the cache by key: found, and npm ci takes packages from disk; not found, and it downloads them.'), bi('Джобу выполняет раннер после следующего push.', 'A runner, on the next push.'), 'glab ci trace build') },
    ],
    edges: [
      { id: 'e-up', from: 'b1', to: 'art', via: [[118, 160], [488, 160]], label: bi('загрузка артефактов', 'upload artifacts:paths'), labelAt: 0.5, card: card(bi('После успешной джобы раннер упаковывает пути из `artifacts:paths` в архив и отправляет его на сервер.', 'After a successful job the runner archives the artifacts:paths and sends them to the forge.'), bi('Архив отправляет gitlab-runner.', 'gitlab-runner.')) },
      { id: 'e-down', from: 'art', to: 't1', label: bi('скачивание перед скриптом', 'download before the script'), card: card(bi('В журнале джобы test это видно как строка «Downloading artifacts for build»: файлы из прошлой стадии раскладываются в каталог проекта.', '"Downloading artifacts for build" in the test log: files from the earlier stage are laid out in the project directory.'), bi('Файлы скачивает gitlab-runner.', 'gitlab-runner.')) },
      { id: 'e-down2', from: 'art', to: 'deploy', via: [[848, 220]], label: bi('скачивание на другой раннер', 'and to another runner'), labelAt: 0.6, card: card(bi('Артефакт не привязан к раннеру, и сервер отдаёт его любому раннеру.', 'An artifact does not depend on the runner: the forge hands it to any.'), bi('Файлы скачивает gitlab-runner.', 'gitlab-runner.')) },
      { id: 'e-save', from: 'b1', to: 'cache', label: bi('сохранение .npm/', 'save .npm/'), card: card(bi('После успешной джобы раннер кладёт пути из `cache:paths` на свою полку с именем ключа.', 'After a successful job the runner puts cache:paths on its shelf named by the key.'), bi('Архив сохраняет gitlab-runner.', 'gitlab-runner.')) },
      { id: 'e-key', from: 'lock', to: 'cache', label: bi('ключ кэша', 'cache:key'), card: card(bi('Ключ решает, на какую полку класть кэш и с какой его брать. Если в ключе стоит имя ветки, у каждой ветки своя полка. Если ключ вычисляется из lock-файла, при каждом изменении зависимостей появляется новая полка.', 'The key decides which shelf to save to and read from. A branch in the key gives each branch its own shelf; the lock file in the key gives a new shelf whenever the dependencies change.'), bi('Ключ задаёте вы в `.gitlab-ci.yml`.', 'You, in .gitlab-ci.yml.'), undefined, { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'cache', line: 'cache:key:files' }) },
      { id: 'e-restore', from: 'cache', to: 'b2', via: [[280, 240], [280, 358]], label: bi('восстановление кэша', 'restore if found'), labelAt: 0.8, card: card(bi('В журнале это строка «Checking cache for npm-main…». Если кэш нашёлся, `npm ci` выполняется за 9 секунд вместо 52. Если нет, в журнале появляется WARNING, и зависимости скачиваются полностью. Это занимает больше времени, но к ошибке не приводит.', '"Checking cache for npm-main…": on a hit npm ci takes 9 s instead of 52. On a miss, a WARNING and a full download: slower, but no error.'), bi('Кэш восстанавливает gitlab-runner.', 'gitlab-runner.')) },
    ],
  },
  params: [
    {
      id: 'key',
      label: bi('Из чего составлен ключ кэша', 'Cache key'),
      group: bi('Настройка кэша', 'The cache setting'),
      kind: 'choice',
      default: 'branch',
      options: [
        { id: 'branch', label: bi('из имени ветки: npm-$CI_COMMIT_REF_SLUG', 'npm-$CI_COMMIT_REF_SLUG') },
        { id: 'lock', label: bi('из lock-файла: files: [package-lock.json]', 'files: [package-lock.json]') },
      ],
      near: 'cache',
    },
    {
      id: 'lockChanged',
      label: bi('Второй коммит изменил package-lock.json', 'The second commit changes package-lock.json'),
      group: bi('Что произошло во втором пайплайне', 'What happened in the second pipeline'),
      kind: 'toggle',
      default: false,
      near: 'lock',
      predict: {
        prompt: bi('Ключ кэша вычисляется из файла package-lock.json, и во втором коммите этот файл изменился. Найдёт ли build #2 кэш?', 'The key is package-lock.json, and the second commit changed it. Will build #2 find the cache?'),
        options: [
          { id: 'miss', text: bi('Нет, потому что для нового lock-файла ключ другой и полка ещё пустая', 'No: a new lock file has a new shelf') },
          { id: 'hit', text: bi('Да, потому что ветка осталась той же', 'Yes: the branch is the same') },
        ],
        resolve: (_p, n) => (n.some((s) => s.id === 'hit') ? 'hit' : 'miss'),
      },
    },
    {
      id: 'otherRunner',
      label: bi('build #2 попала на другой раннер', 'build #2 landed on another runner'),
      group: bi('Что произошло во втором пайплайне', 'What happened in the second pipeline'),
      kind: 'toggle',
      default: false,
      near: 'b2',
      predict: {
        prompt: bi('Следующую сборку забрал runner-2, у которого нет полки с этим ключом. Что будет со сборкой?', 'The next build was taken by runner-2, which has no shelf with this key. What happens?'),
        options: [
          { id: 'slow', text: bi('Сборка пройдёт, но займёт больше времени', 'It passes, but slower') },
          { id: 'fail', text: bi('Сборка завершится с ошибкой, потому что зависимостей нет', 'It fails: no dependencies') },
        ],
        resolve: () => 'slow',
      },
    },
  ],
  breaks: [
    {
      id: 'no-artifact',
      label: bi('У сборки не объявлены артефакты', 'No artifacts: declared'),
      remove: ['e-up', 'e-down', 'e-down2'],
      predict: {
        prompt: bi('У джобы build нет ключа artifacts:paths, а обе джобы выполняются на одном раннере. Увидит ли test каталог dist/?', 'build has no artifacts:paths. Both jobs are on one runner. Will test see the dist/ directory?'),
        options: [
          { id: 'no', text: bi('Нет, потому что каждая джоба начинается с чистой копии репозитория', 'No: every job starts from a clean copy') },
          { id: 'yes', text: bi('Да, потому что раннер тот же', 'Yes: the runner is the same') },
        ],
        resolve: () => 'no',
      },
    },
    {
      id: 'dist-in-cache',
      label: bi('Каталог dist/ положили в кэш, а не в артефакт', 'dist/ put into the cache, not an artifact'),
      remove: ['e-up', 'e-down', 'e-down2'],
      predict: {
        prompt: bi('Каталог dist/ объявлен в cache, а джобу deploy забрал runner-2. Дойдёт ли собранный сайт до выкладки?', 'dist/ is declared in cache, and deploy went to runner-2. Will the build reach the deploy?'),
        options: [
          { id: 'no', text: bi('Нет, потому что у runner-2 своя полка и этого кэша на ней нет', 'No: runner-2 has a different shelf') },
          { id: 'yes', text: bi('Да, потому что кэш общий для всего пайплайна', 'Yes: the cache is shared by the pipeline') },
        ],
        resolve: () => 'no',
      },
    },
  ],
  metrics: [
    { id: 'npm1', label: bi('npm ci в build #1, с', 'npm ci in build #1, s') },
    { id: 'npm2', label: bi('npm ci в build #2, с', 'npm ci in build #2, s') },
    { id: 'delivered', label: bi('число джоб, получивших dist/', 'jobs that got dist/') },
  ],
  run(p, broken) {
    const n = artNumbers(p);
    const runner2 = p.otherRunner ? 'runner-2' : 'runner-1';
    const steps: Step[] = [
      {
        id: 'build',
        label: 'build #1',
        caption: bi('Идёт первый пайплайн, и кэша ещё нет, поэтому `npm ci` скачивает все зависимости за 52 секунды. Сборка кладёт результат в каталог dist/ внутри контейнера джобы.', 'The first pipeline: there is no cache yet, npm ci downloads everything, 52 s. The build puts its result into dist/ inside the job container.'),
        focus: ['b1'],
        say: { b1: bi('Джоба build скачивает зависимости за 52 секунды и собирает сайт в каталог dist/ внутри своего контейнера.', 'The build job downloads the dependencies in 52 seconds and builds the site into dist/ inside its container.') },
        states: { ...hiddenExcept(ART_ALL, 'b1'), b1: 'ok' },
        values: { b1: tx(bi('dist/ на раннере', 'dist/ (local)')) },
        metrics: { npm1: 52, npm2: 0, delivered: 0 },
      },
    ];
    if (broken.has('no-artifact') || broken.has('dist-in-cache')) {
      const inCache = broken.has('dist-in-cache');
      if (inCache)
        steps.push({
          id: 'shelf',
          label: 'cache',
          caption: bi('Каталог dist/ ложится на полку runner-1 вместе с .npm/. Джоба test выполняется на том же раннере и находит его там, но джобу deploy забрал runner-2, у которого такой полки нет.', 'dist/ went onto runner-1’s shelf along with .npm/. test on the same runner even found it, but deploy was taken by runner-2, which has no such shelf.'),
          focus: ['e-save', 'cache'],
          reveal: ['cache', 'e-save', 't1'],
          tokens: [{ edge: 'e-save', label: 'dist/ + .npm/' }],
          say: { cache: bi('Раннер runner-1 кладёт dist/ и .npm/ на свою полку, и видеть её будет только он сам.', 'runner-1 puts dist/ and .npm/ on its own shelf, which only it will see.') },
          states: { cache: 'warn', t1: 'ok' },
          metrics: { npm1: 52, npm2: 0, delivered: 1 },
        });
      steps.push({
        id: 'lost',
        label: inCache ? 'deploy #1' : 'test #1',
        caption: inCache
          ? bi('Джоба deploy начинается на runner-2 с чистой копии репозитория. Полки runner-1 ей не видно, каталога dist/ нет, и выкладка завершается с ошибкой.', 'deploy starts on runner-2 from a clean copy of the repository. It cannot see runner-1’s shelf, there is no dist/, and the deploy fails.')
          : bi('Контейнер сборки удалён вместе с dist/. Джоба test начинается с чистой копии репозитория, и каталога в ней нет, хотя раннер тот же.', 'The build container is deleted along with dist/. test starts from a clean copy of the repository: the directory is gone, although the runner is the same.'),
        focus: inCache ? ['deploy'] : ['t1'],
        reveal: inCache ? ['deploy'] : ['t1'],
        say: inCache ? { deploy: bi('Джоба deploy ищет dist/index.html, не находит его и завершается с кодом 1.', 'The deploy job looks for dist/index.html, does not find it and exits with code 1.') } : { t1: bi('Джоба test ищет dist/index.html, не находит его и завершается с кодом 1.', 'The test job looks for dist/index.html, does not find it and exits with code 1.') },
        states: inCache ? { deploy: 'err' } : { t1: 'err' },
        metrics: { npm1: 52, npm2: 0, delivered: inCache ? 1 : 0 },
        broken: { at: inCache ? 'deploy' : 't1', message: inCache ? '$ ./deploy.sh staging\ndeploy.sh: dist/index.html not found (no artifact?)\nERROR: Job failed: exit code 1' : '$ test -f dist/index.html\nERROR: Job failed: exit code 1', caption: bi('Результат, который обязан дойти до следующих джоб, передают через артефакты, потому что кэш доставку не гарантирует.', 'a result that must arrive is passed through artifacts; a cache guarantees no delivery.') },
      });
      return steps;
    }
    steps.push(
      {
        id: 'upload',
        label: 'artifacts',
        caption: bi('Джоба прошла успешно, и перед удалением контейнера раннер загружает dist/ на сервер, а .npm/ сохраняет на свою полку под именем ключа.', 'After the successful job the runner uploads dist/ to the forge and saves .npm/ on its shelf under the key.'),
        focus: ['e-up', 'art', 'e-save', 'cache'],
        reveal: ['art', 'e-up', 'cache', 'e-save'],
        tokens: [{ edge: 'e-up', label: 'dist/' }, { edge: 'e-save', label: '.npm/' }],
        say: { b1: bi('Раннер отправляет dist/ на сервер как артефакт и кладёт .npm/ в свой кэш, а потом удаляет контейнер.', 'The runner sends dist/ to the server as an artifact, puts .npm/ into its cache and then deletes the container.') },
        states: { art: 'ok', cache: 'ok' },
        values: { cache: p.key === 'branch' ? 'npm-main' : 'a3f1c0…' },
        fill: { art: 0.5, cache: 0.6 },
        metrics: { npm1: 52, npm2: 0, delivered: 0 },
      },
      {
        id: 'download',
        label: 'test',
        caption: bi('Джоба test скачивает dist/ с сервера перед своим скриптом и проверяет собранный сайт.', 'test downloads dist/ from the forge before its script and checks the built site.'),
        focus: ['e-down', 't1'],
        reveal: ['t1', 'e-down'],
        tokens: [{ edge: 'e-down', label: 'dist/' }],
        say: { t1: bi('Джоба test скачивает dist/ из артефактов и проверяет собранный сайт.', 'The test job downloads dist/ from the artifacts and checks the built site.') },
        states: { t1: 'ok' },
        metrics: { npm1: 52, npm2: 0, delivered: 1 },
      },
      {
        id: 'download2',
        label: 'deploy',
        caption: bi('Джоба deploy попала на другой раннер, runner-2, и всё равно получает dist/, потому что артефакт хранится на сервере, а не на раннере.', 'deploy landed on another runner, runner-2, and still gets dist/, because the artifact is kept on the server, not on a runner.'),
        focus: ['e-down2', 'deploy'],
        reveal: ['deploy', 'e-down2'],
        tokens: [{ edge: 'e-down2', label: 'dist/' }],
        say: { deploy: bi('Джоба deploy на runner-2 скачивает тот же dist/ с сервера и выкладывает сайт.', 'The deploy job on runner-2 downloads the same dist/ from the server and deploys the site.') },
        states: { deploy: 'ok' },
        metrics: { npm1: 52, npm2: 0, delivered: 2 },
      },
      {
        id: 'push2',
        label: bi('новый push', 'a new push'),
        caption: p.lockChanged ? bi('Следующий коммит меняет package-lock.json, то есть набор зависимостей стал другим.', 'The next commit changes package-lock.json: the dependencies are different now.') : bi('Следующий коммит меняет только страницы сайта, а package-lock.json остаётся прежним.', 'The next commit changes only the site pages.'),
        // With a key by branch the lock file does not feed the key: no line from it to the cache.
        focus: p.key === 'branch' ? ['lock'] : ['lock', 'e-key'],
        reveal: p.key === 'branch' ? ['lock'] : ['lock', 'e-key'],
        tokens: p.key === 'branch' ? [] : [{ edge: 'e-key', label: p.lockChanged ? 'b7d2e9…' : 'a3f1c0…' }],
        say: { lock: p.key === 'branch' ? bi('Ключ составлен из имени ветки, поэтому файл зависимостей на него не влияет, линии от файла к кэшу на этом шаге нет, и ключ остаётся npm-main.', 'The key is made of the branch name, so the dependency file does not affect it and the key stays npm-main.') : p.lockChanged ? bi('Файл зависимостей изменился, поэтому ключ кэша, вычисленный из его хэша, тоже стал другим.', 'The dependency file changed, so the cache key computed from its hash changed too.') : bi('Файл зависимостей не изменился, поэтому ключ кэша остаётся прежним.', 'The dependency file did not change, so the cache key stays the same.') },
        states: { lock: p.lockChanged ? 'warn' : 'on' },
        values: { lock: tx(p.lockChanged ? bi('изменился', 'changed') : bi('не менялся', 'unchanged')) },
        metrics: { npm1: 52, npm2: 0, delivered: 2 },
      },
    );
    if (n.hit)
      steps.push({
        id: 'hit',
        label: bi('кэш найден', 'hit'),
        caption: bi('Джоба build #2 попала на runner-1, и ключ совпал. Полка нашлась, поэтому `npm ci` берёт пакеты с диска за 9 секунд вместо 52.', 'build #2 is on runner-1 and the key matches: the shelf is found, npm ci takes packages from disk, 9 s instead of 52.'),
        focus: ['e-restore', 'b2'],
        reveal: ['b2', 'e-restore'],
        tokens: [{ edge: 'e-restore', label: '.npm/' }],
        say: { b2: bi('Раннер нашёл полку с этим ключом и восстановил .npm/, поэтому зависимости ставятся за 9 секунд.', 'The runner found the shelf with this key and restored .npm/, so the dependencies install in 9 seconds.') },
        states: { b2: 'ok' },
        values: { b2: runner2 },
        metrics: { npm1: 52, npm2: n.npm2, delivered: 2 },
      });
    else
      steps.push({
        id: 'miss',
        label: bi('кэш не найден', 'miss'),
        caption: p.otherRunner
          ? bi('Джобу build #2 забрал runner-2, а на его диске нет полки с этим ключом. В журнале появляется WARNING, `npm ci` скачивает всё заново за 52 секунды, и сборка проходит.', 'build #2 was taken by runner-2: its disk has no shelf with this key. A WARNING in the log, npm ci downloads everything again, 52 s, and the build passes.')
          : bi('Ключ вычислен из нового lock-файла, и это другая полка, которой ещё нет. `npm ci` скачивает всё заново за 52 секунды, сборка проходит и заполняет новую полку.', 'The key is built from the new lock file: another shelf that does not exist yet. npm ci downloads everything, 52 s; the build passes and fills the new shelf.'),
        focus: ['b2', 'cache'],
        reveal: ['b2', 'e-restore'],
        say: { b2: bi('Раннер не нашёл полку с этим ключом, поэтому зависимости скачиваются заново 52 секунды, но сборка проходит.', 'The runner found no shelf with this key, so the dependencies download again for 52 seconds, but the build passes.') },
        states: { b2: 'warn', cache: 'warn', 'e-restore': 'off' },
        values: { b2: runner2 },
        metrics: { npm1: 52, npm2: n.npm2, delivered: 2 },
      });
    return steps;
  },
  explainDelta(prev, next, change, _a, b): Bi {
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломку убрали, и каталог dist/ снова доходит до всех джоб через сервер.', 'The break is removed: dist/ reaches every job through the forge again.');
      return change.id === 'no-artifact' ? bi('Без артефактов результат сборки исчезает вместе с её контейнером.', 'Without artifacts the build result disappears with its container.') : bi('Кэш хранится на полке одного раннера, и джоба на другом раннере его не видит.', 'A cache is a particular runner’s shelf: a job on another runner does not see it.');
    }
    const a1 = metric(prev, 'npm2');
    const b1 = metric(next, 'npm2');
    const time = a1 !== b1
      ? fmtBi(bi('npm ci во второй сборке раньше занимал {a}, а теперь занимает {b}.', 'npm ci in the second build took {a} and now takes {b}.'), { a: sec(a1), b: sec(b1) })
      : fmtBi(bi('Время npm ci во второй сборке не изменилось и по-прежнему составляет {b}, потому что эта правка не повлияла на то, найдёт ли сборка свою полку в кэше.', 'The npm ci time in the second build did not change and is still {b}: whether the shelf is found stayed as it was after this change.'), { b: sec(b1) });
    const lead = change.id === 'key' ? (b.key === 'lock' ? bi('Теперь ключ вычисляется из lock-файла, и полка меняется вместе с зависимостями.', 'The key is now computed from the lock file, and the shelf changes along with the dependencies.') : bi('Теперь ключ составлен из имени ветки, и у каждой ветки своя полка.', 'The key is now made of the branch name, and every branch has its own shelf.')) : bi('Если кэш не нашёлся, сборка идёт дольше, но не ломается.', 'A cache miss slows the build down but breaks nothing.');
    return join(lead, time);
  },
});

// ── E-DAG: stages against needs ─────────────────────────────────────────────

type DagP = { needs: boolean; lint: number; runners: number };

export interface DagTimes {
  build: [number, number];
  lint: [number, number];
  test: [number, number];
  deploy: [number, number];
}

/** Model schedule: build 20 s, lint p.lint s (same stage), test 30 s, deploy 15 s. */
export function dagTimes(p: DagP): DagTimes {
  const build: [number, number] = [0, 20];
  // With one runner lint waits until build is done.
  const lintStart = p.runners >= 2 ? 0 : 20;
  const lint: [number, number] = [lintStart, lintStart + p.lint];
  const testStart = p.needs ? build[1] : Math.max(build[1], lint[1]);
  // With one runner and needs, test still waits for the runner that lint holds.
  const testAt = p.runners >= 2 ? testStart : Math.max(testStart, lint[1]);
  const test: [number, number] = [testAt, testAt + 30];
  const deployStart = p.needs ? test[1] : Math.max(test[1], lint[1]);
  const deploy: [number, number] = [deployStart, deployStart + 15];
  return { build, lint, test, deploy };
}

const DAG_ALL = ['build', 'lint', 'test', 'deploy', 'clock', 'e-bt', 'e-lt', 'e-td', 'e-clock'];

export const dagModel = defineModel<DagP>({
  id: 'cicd.stages-needs',
  frame: 'visible',
  block: 'cicd',
  title: bi('Как стадии и needs решают, когда стартует джоба', 'The staircase of stages and the needs graph'),
  summary: bi(
    'Без needs каждая стадия ждёт, пока целиком закончится предыдущая, и медленный линтер задерживает тесты, которым он не нужен. С needs джоба стартует, как только готовы те джобы, от которых она зависит. Граф при этом нужно держать в порядке: если rules убрали из пайплайна джобу, на которую ссылается needs, пайплайн не создаётся.',
    'A stage waits for the whole previous stage; needs lets a job start as soon as exactly the jobs it needs are done. A slow linter stops holding back the tests, but the graph must be kept in order: needs on a job that rules removed makes the pipeline invalid.',
  ),
  intro: bi(
    'Сейчас на схеме только две джобы первой стадии, build и lint. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». Подпись каждого шага на шкале показывает, на какой секунде пайплайна этот шаг происходит, а облачко рядом с джобой говорит, что она делает или чего ждёт.\n\nКогда дойдёте до конца, включите в «Параметрах» needs и сравните время всего пайплайна в счётчиках под схемой.',
    'For now the diagram shows only the two jobs of the first stage, build and lint. Press “Start from the first step”, then go on with “Step forward”. The label of each step on the scale shows the pipeline second at which the step happens, and the callout next to a job says what it does or waits for.\n\nAt the end, switch needs on in “Parameters” and compare the whole pipeline time in the counters under the diagram.',
  ),
  legend: [
    { mark: 'active', text: bi('джоба, которая работает сейчас', 'the job working now') },
    { mark: 'say', text: bi('что эта джоба делает или чего ждёт', 'what the job does or waits for') },
    { mark: 'token', text: bi('что передаётся дальше', 'what is handed on') },
    { mark: 'icon:container', text: bi('джоба пайплайна', 'a pipeline job') },
    { mark: 'icon:server', text: bi('сервер, который считает время пайплайна', 'the server counting the pipeline time') },
    { mark: 'dashed', text: bi('неявная зависимость, при которой джоба ждёт конца всей стадии', 'an implicit dependency: the end of the whole stage') },
    { mark: 'wait', text: bi('джоба ждёт', 'the job waits') },
    { mark: 'err', text: bi('здесь сервер отказался создавать пайплайн', 'the server refused to create the pipeline here') },
  ],
  stopLabel: bi('Пайплайн не создан', 'The pipeline was not created'),
  concepts: ['cicd.stage', 'cicd.needs'],
  diagram: {
    width: 960,
    height: 400,
    nodes: [
      { id: 'build', label: 'build', icon: 'container', work: 'dots', sub: { ru: '20 с', en: '20 s' }, family: 'ci-build', shape: 'box', x: 40, y: 60, w: 168, h: 60, card: card(bi('Сборка, которая в модели длится 20 секунд. Её результат, каталог dist/, сохраняется как артефакт.', 'The build: 20 model seconds. Its result is the dist/ artifact.'), bi('Джобу выполняет раннер.', 'A runner.'), 'glab ci view') },
      { id: 'lint', label: 'lint', icon: 'container', work: 'dots', sub: { ru: '90 с', en: '90 s' }, family: 'ci-build', shape: 'box', x: 40, y: 250, w: 168, h: 60, card: card(bi('Медленный линтер в той же стадии build. Тестам он не нужен, потому что им нужен только каталог dist/ из сборки.', 'A slow linter in the same build stage. The tests do not need it: they need only dist/ from build.'), bi('Джобу выполняет раннер.', 'A runner.')) },
      { id: 'test', label: 'test', icon: 'container', work: 'dots', sub: { ru: '30 с', en: '30 s' }, family: 'ci-test', shape: 'box', x: 400, y: 60, w: 168, h: 60, card: card(bi('Тесты стадии test. Без needs они ждут всю стадию build вместе с линтером, а с `needs: [build]` ждут только сборку.', 'The tests of the test stage. Without needs they wait for the whole build stage, lint included; with needs: [build], only for build.'), bi('Джобу выполняет раннер.', 'A runner.'), 'glab ci view', { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'needs' }) },
      { id: 'deploy', label: 'deploy_staging', icon: 'container', work: 'dots', sub: { ru: '15 с', en: '15 s' }, family: 'ci-deploy', shape: 'box', x: 740, y: 60, w: 192, h: 60, card: card(bi('Выкладка на тестовый стенд. С `needs: [test]` она стартует сразу после тестов.', 'The deploy. With needs: [test] it starts right after the tests.'), bi('Джобу выполняет раннер.', 'A runner.')) },
      { id: 'clock', label: bi('весь пайплайн', 'whole pipeline'), icon: 'server', sub: '—', family: 'gauge', shape: 'buffer', x: 400, y: 250, w: 192, h: 60, card: card(bi('Время от создания пайплайна до конца последней джобы. Столько времени коллега, который проверяет merge request, ждёт, прежде чем увидит результат проверок.', 'The time from the pipeline’s creation to the end of its last job. In a merge request it is how long the reviewer waits.'), bi('Время считает сервер.', 'The forge counts it.'), 'glab ci status') },
    ],
    edges: [
      { id: 'e-bt', from: 'build', to: 'test', label: 'needs: [build]', card: card(bi('Явная зависимость: test стартует, как только build закончилась успешно, и скачивает артефакты только от неё.', 'An explicit dependency: test starts as soon as build succeeds and downloads artifacts only from it.'), bi('Зависимость записываете вы в `.gitlab-ci.yml`.', 'You, in .gitlab-ci.yml.'), undefined, { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'needs' }) },
      { id: 'e-lt', from: 'lint', to: 'test', via: [[300, 280], [300, 110]], label: bi('конец стадии build', 'end of the build stage'), labelAt: 0.35, dashed: true, card: card(bi('Неявная зависимость по стадиям: без needs джоба test ждёт каждую джобу предыдущей стадии, даже ту, которая ей не нужна.', 'The implicit dependency of stages: without needs, test waits for every job of the earlier stage, even one it does not need.'), bi('Зависимость задаёт порядок в ключе `stages`.', 'The stages order.'), undefined, { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'stages' }) },
      { id: 'e-td', from: 'test', to: 'deploy', label: bi('выкладка после тестов', 'deploy after the tests'), card: card(bi('Выкладка начинается после тестов. Без needs она ждёт конца всей стадии test, а с `needs: [test]` ждёт только джобу test.', 'The deploy starts after the tests. Without needs it waits for the whole test stage; with `needs: [test]` only for the test job.'), bi('Зависимость записываете вы.', 'You.')) },
      { id: 'e-clock', from: 'deploy', to: 'clock', via: [[836, 280]], label: bi('конец последней джобы', 'end of the last job'), labelAt: 0.4, card: card(bi('Пайплайн закончен тогда, когда закончилась его последняя джоба. Обычно это выкладка, но если медленный линтер идёт дольше всей остальной цепочки, пайплайн заканчивается вместе с ним.', 'The pipeline is over when its last job is.'), bi('Время считает сервер.', 'The forge.')) },
    ],
  },
  params: [
    {
      id: 'needs',
      label: bi('У test и deploy записаны needs', 'needs on test and deploy'),
      group: bi('Файл пайплайна', 'The pipeline file'),
      kind: 'toggle',
      default: false,
      near: 'test',
      predict: {
        prompt: bi('Джобе test добавили needs: [build], а линтер по-прежнему идёт 90 секунд. Когда стартуют тесты?', 'Give test needs: [build]. When do the tests start?'),
        options: [
          { id: 'early', text: bi('Тесты стартуют сразу после build и не ждут линтер', 'Right after build, without waiting for lint') },
          { id: 'same', text: bi('Тесты, как и раньше, стартуют после всей стадии build', 'As before, after the whole stage') },
        ],
        resolve: (_p, n) => (metric(n, 'testStart') <= 20 ? 'early' : 'same'),
      },
    },
    { id: 'lint', label: bi('Сколько секунд идёт линтер', 'lint duration'), group: bi('Файл пайплайна', 'The pipeline file'), kind: 'range', min: 10, max: 180, step: 10, default: 90, near: 'lint' },
    {
      id: 'runners',
      label: bi('Сколько раннеров свободно', 'Runners'),
      group: bi('Раннеры', 'The runners'),
      kind: 'range',
      min: 1,
      max: 3,
      step: 1,
      default: 2,
      near: 'clock',
      predict: {
        prompt: bi('needs включены, но свободным остался один раннер. Сократят ли needs время пайплайна так же, как с двумя раннерами?', 'needs are on, but only one runner is left. Will needs help?'),
        options: [
          { id: 'no', text: bi('Нет, потому что test всё равно ждёт, пока освободится единственный раннер', 'No: test still waits for a free runner') },
          { id: 'yes', text: bi('Да, потому что needs не зависят от числа раннеров', 'Yes, as with two') },
        ],
        resolve: (prev, next) => (metric(next, 'total') > metric(prev, 'total') ? 'no' : 'yes'),
      },
    },
  ],
  breaks: [
    {
      id: 'needs-excluded',
      label: bi('Правило rules убрало build из пайплайна merge request', 'rules removed build from the pipeline'),
      remove: ['e-bt'],
      predict: {
        prompt: bi('У джобы build правило «только для main», а пайплайн создаётся для merge request. У test по-прежнему записано needs: [build]. Что будет?', 'build has a "main only" rule, and the pipeline is a merge request one. test still has needs: [build]. What happens?'),
        options: [
          { id: 'invalid', text: bi('Сервер не создаст пайплайн, потому что зависимость указывает на джобу, которой нет', 'The pipeline is not created: the dependency points to nothing') },
          { id: 'start', text: bi('Джоба test стартует сразу, не дожидаясь сборки', 'test just starts at once') },
        ],
        resolve: () => 'invalid',
      },
    },
  ],
  metrics: [
    { id: 'testStart', label: bi('test стартует на секунде, с', 'test starts at, s') },
    { id: 'total', label: bi('весь пайплайн, с', 'whole pipeline, s') },
  ],
  run(p, broken) {
    if (broken.has('needs-excluded')) {
      const invalid: Step[] = [
        {
          id: 'rules',
          label: 'rules',
          caption: bi('Сервер проверяет правила: джоба build нужна только для main, а это пайплайн merge request, поэтому build в него не входит.', 'The forge checks the rules: build is for main only, and this is a merge request pipeline. build does not enter the pipeline.'),
          focus: ['build'],
          say: { build: bi('Правило rules говорит, что build запускается только для main, поэтому в пайплайн merge request эта джоба не попадает.', 'The rules say build runs only for main, so this job does not enter the merge request pipeline.') },
          states: { ...hiddenExcept(DAG_ALL, 'build', 'lint', 'test'), build: 'off' },
          metrics: { testStart: 0, total: 0 },
        },
        {
          id: 'invalid',
          label: bi('ошибка в графе', 'invalid graph'),
          caption: bi('Джоба test требует джобу build, которой в пайплайне нет. GitLab отказывается создавать такой пайплайн целиком, и не запускается ни одна джоба.', 'test requires a job that is not in the pipeline. GitLab refuses to create such a pipeline at all.'),
          focus: ['test', 'e-bt'],
          reveal: ['e-bt'],
          say: { test: bi('Джоба test ссылается на build, которой в пайплайне нет, и сервер не может построить граф зависимостей.', 'The test job refers to build, which is not in the pipeline, and the server cannot build the dependency graph.') },
          states: { test: 'err', lint: 'off' },
          metrics: { testStart: 0, total: 0 },
          broken: { at: 'test', message: "'test' job needs 'build' job, but 'build' does not exist in the pipeline. This might be because of the only, except, or rules keywords. To need a job that sometimes does not exist in the pipeline, use needs:optional.", caption: bi('Держите rules и needs согласованными или пишите needs: [{job: build, optional: true}], чтобы зависимость не мешала, когда джобы нет.', 'keep rules and needs consistent, or write needs: [{job: build, optional: true}].') },
        },
      ];
      return invalid;
    }
    const t = dagTimes(p);
    // The pipeline ends with its last job: with needs the slow linter may outlast the deploy.
    const total = Math.max(t.deploy[1], t.lint[1]);
    const lintLast = t.lint[1] > t.deploy[1];
    const two = p.runners >= 2;
    const steps: Step[] = [
      {
        id: 'start',
        label: bi('0 с', '0 s'),
        caption: two ? bi('Пайплайн создан. Джобы build и lint входят в одну стадию и стартуют одновременно на двух раннерах.', 'The pipeline is created. build and lint are one stage and start together on two runners.') : bi('Пайплайн создан. Раннер один, поэтому сначала выполняется build, а lint ждёт своей очереди.', 'The pipeline is created. There is one runner: build first, lint waits its turn.'),
        focus: ['build', 'lint'],
        say: { build: two ? bi('Сборка стартует на первом раннере, а линтер одновременно стартует на втором.', 'The build starts on the first runner while the linter starts on the second.') : bi('Сборка занимает единственный раннер, поэтому линтеру придётся подождать.', 'The build takes the only runner, so the linter has to wait.') },
        states: { ...hiddenExcept(DAG_ALL, 'build', 'lint'), build: 'on', lint: two ? 'on' : 'wait' },
        values: { build: tx(bi('20 с', '20 s')), lint: tx(bi(`${p.lint} с`, `${p.lint} s`)), test: tx(bi('30 с', '30 s')), deploy: tx(bi('15 с', '15 s')), clock: tx(bi('0 с', '0 s')) },
        metrics: { testStart: 0, total: 0 },
      },
      {
        id: 'built',
        label: bi(`${t.build[1]} с`, `${t.build[1]} s`),
        caption: p.needs ? bi('Сборка закончилась. У test записано `needs: [build]`, поэтому тесты стартуют сразу, хотя линтер ещё идёт.', 'build is done. test has needs: [build], so the tests start at once while lint still runs.') : fmt(bi('Сборка закончилась, но линтер ещё идёт. Без needs test ждёт конца всей стадии build, то есть до {l}-й секунды.', 'build is done, but lint still runs. Without needs, test waits for the whole stage to end, until {l} s.'), { l: t.lint[1] }),
        focus: p.needs ? ['e-bt', 'test'] : ['e-lt', 'test'],
        reveal: p.needs ? ['test', 'e-bt'] : ['test', 'e-lt'],
        tokens: p.needs ? [{ edge: 'e-bt', label: 'dist/' }] : [{ edge: 'e-lt', label: bi('ожидание lint', 'waiting for lint') }],
        say: { test: p.needs && t.test[0] <= 20 ? bi('Сборка готова, и test сразу стартует, потому что ей нужна только сборка.', 'The build is ready, and test starts at once because it needs only the build.') : p.needs ? bi('Сборка готова, но единственный раннер занят линтером, поэтому test ждёт раннер.', 'The build is ready, but the only runner is busy with the linter, so test waits for the runner.') : fmt(bi('Джоба test ждёт, пока закончится вся стадия build, включая линтер, то есть до {l}-й секунды.', 'test waits for the whole build stage to end, linter included, until second {l}.'), { l: t.lint[1] }) },
        states: { build: 'ok', lint: 'on', test: p.needs && t.test[0] <= 20 ? 'on' : 'wait' },
        metrics: { testStart: 0, total: 0 },
      },
      {
        id: 'tests',
        label: bi(`${t.test[0]}–${t.test[1]} с`, `${t.test[0]}–${t.test[1]} s`),
        caption: fmt(bi('Джоба test стартует на {s}-й секунде, идёт 30 секунд и заканчивается на {e}-й.', 'test starts at second {s}, runs 30 seconds and ends at second {e}.'), { s: t.test[0], e: t.test[1] }),
        focus: ['test'],
        say: { test: fmt(bi('Тесты стартуют на {s}-й секунде пайплайна.', 'The tests start at second {s} of the pipeline.'), { s: t.test[0] }) },
        states: { test: 'ok', lint: t.lint[1] <= t.test[0] ? 'ok' : 'on' },
        metrics: { testStart: t.test[0], total: 0 },
      },
      {
        id: 'deploy',
        label: bi(`${t.deploy[0]}–${t.deploy[1]} с`, `${t.deploy[0]}–${t.deploy[1]} s`),
        caption: p.needs ? bi('У выкладки записано `needs: [test]`, поэтому она стартует сразу после тестов.', 'With needs: [test] the deploy starts right after the tests.') : bi('Выкладка ждёт, пока закончится вся стадия test.', 'The deploy waits for the test stage to end.'),
        focus: ['e-td', 'deploy'],
        reveal: ['deploy', 'e-td'],
        tokens: [{ edge: 'e-td', label: bi('тесты прошли', 'tests passed') }],
        say: { deploy: fmt(bi('Выкладка стартует на {s}-й секунде, как только закончились тесты.', 'The deploy starts at second {s}, as soon as the tests are done.'), { s: t.deploy[0] }) },
        states: { deploy: 'ok', lint: t.lint[1] <= t.deploy[0] ? 'ok' : 'on' },
        metrics: { testStart: t.test[0], total: 0 },
      },
      {
        id: 'done',
        label: bi(`${total} с`, `${total} s`),
        caption: lintLast
          ? fmtBi(bi('Выкладка закончилась на {d}-й секунде, но линтер ещё шёл. Пайплайн считается законченным, когда закончилась его последняя джоба, поэтому он занял {t}. Тесты и выкладка от линтера больше не зависят, но общее время ограничено самой долгой джобой.', 'The deploy ended at second {d}, but the linter was still running. A pipeline is over when its last job is, so it took {t}. The tests and the deploy no longer depend on the linter, but the total is bounded by the longest job.'), { d: t.deploy[1], t: sec(total) })
          : fmtBi(bi('Последней закончилась выкладка, и весь пайплайн занял {t}.', 'The deploy finished last, and the whole pipeline took {t}.'), { t: sec(total) }),
        focus: lintLast ? ['clock', 'lint'] : ['clock', 'e-clock'],
        reveal: ['clock', 'e-clock'],
        say: { clock: fmt(bi('Сервер отмечает, что пайплайн закончился на {t}-й секунде вместе с последней джобой {j}.', 'The server marks that the pipeline ended at second {t}, together with its last job, {j}.'), { t: total, j: lintLast ? 'lint' : 'deploy_staging' }) },
        states: { clock: 'ok', lint: 'ok' },
        values: { clock: tx(bi(`${total} с`, `${total} s`)) },
        metrics: { testStart: t.test[0], total },
      },
    ];
    return steps;
  },
  explainDelta(prev, next, change, _a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('needs ссылается на исключённую джобу, поэтому пайплайн не создаётся вовсе.', 'needs on an excluded job: the pipeline is not created at all.') : bi('Поломку убрали, и джоба build снова входит в пайплайн.', 'The break is removed: build is in the pipeline again.');
    const t0 = metric(prev, 'total');
    const t1 = metric(next, 'total');
    const total = t0 === t1 ? bi('Время всего пайплайна не изменилось.', 'The whole pipeline time did not change.') : fmtBi(bi('Раньше пайплайн занимал {a}, а теперь занимает {b}.', 'The pipeline took {a} before and takes {b} now.'), { a: sec(t0), b: sec(t1) });
    if (change.id === 'needs') return join(b.needs ? bi('Ключ needs включён, и тесты больше не ждут линтер.', 'needs are on, and the tests no longer wait for the linter.') : bi('Ключ needs выключен, и тесты снова ждут конца всей стадии build.', 'needs are off, and the tests wait for the whole build stage again.'), total);
    if (change.id === 'lint') return join(fmtBi(b.needs ? bi('Линтер теперь идёт {y}. С needs тесты от него не зависят, но пайплайн не может закончиться раньше линтера.', 'lint now takes {y}. With needs the tests do not depend on it, but the pipeline cannot end before the linter.') : bi('Линтер теперь идёт {y}. Без needs медленный линтер задерживает все следующие стадии.', 'lint now takes {y}. Without needs the slow linter holds back every later stage.'), { y: sec(b.lint) }), total);
    return join(fmt(bi('Свободных раннеров теперь {y}. Ключ needs сокращает ожидание зависимостей, но свободных раннеров не заменяет.', 'There are now {y} free runners. needs cut the wait for dependencies, but do not replace free runners.'), { y: b.runners }), total);
  },
});

// ── E-KDEPLOY: a pipeline deploys to Kubernetes, push and pull ─────────────

type KdP = { mode: string; tag: string; wait: boolean };

const KD_ALL = ['job', 'reg', 'kcfg', 'api', 'dep', 'rsOld', 'rsNew', 'cfg', 'agent', 'e-img', 'e-key', 'e-set', 'e-store', 'e-roll', 'e-old', 'e-wait', 'e-commit', 'e-pull', 'e-apply'];

export const kubeDeployModel = defineModel<KdP>({
  id: 'cicd.k8s-deploy',
  frame: 'visible',
  block: 'cicd-k8s',
  title: bi('Как пайплайн выкладывает версию в Kubernetes', 'How a pipeline rolls a version out to Kubernetes'),
  summary: bi(
    'В push-модели джоба сама обращается к API-серверу кластера со своим ключом и меняет образ в Deployment, а новый тег образа даёт новый ReplicaSet. Команда `kubectl rollout status` заставляет джобу дождаться результата, поэтому неудачная выкладка делает пайплайн красным. В pull-модели у CI нет ключа от кластера: джоба записывает тег в репозиторий конфигурации, а агент внутри кластера сам приводит кластер к записанному состоянию.',
    'In the push model the job itself goes to the API server with its own key and changes the image in the Deployment; a new tag gives a new ReplicaSet. rollout status makes the job wait for the result, and a failed rollout turns the pipeline red. In the pull model CI has no key to the cluster: the job commits the tag to a configuration repository, and an agent inside the cluster brings the cluster to what is written there.',
  ),
  intro: bi(
    'Сейчас на схеме только реестр с новым образом, джоба выкладки и то, что сейчас работает на тестовом стенде: Deployment и его ReplicaSet с подами прежней версии. Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд».\n\nКогда пройдёте push-модель до конца, переключите в «Параметрах» модель выкладки на pull, а потом выберите тег latest и сравните, появятся ли новые поды.',
    'For now the diagram shows only the registry with the new image, the deploy job and what runs on staging now: the Deployment and its ReplicaSet with the pods of the previous version. Press “Start from the first step”, then go on with “Step forward”.\n\nOnce you finish the push model, switch the deployment model to pull in “Parameters”, then choose the latest tag and compare whether new pods appear.',
  ),
  legend: [
    { mark: 'active', text: bi('блок, который работает сейчас', 'the block working now') },
    { mark: 'say', text: bi('что этот блок делает', 'what that block does') },
    { mark: 'token', text: bi('что передаётся дальше: тег, изменение, коммит', 'what is handed on: a tag, a change, a commit') },
    { mark: 'icon:container', text: bi('джоба пайплайна или поды одной версии', 'a pipeline job or the pods of one version') },
    { mark: 'icon:server', text: bi('API-сервер кластера', 'the cluster API server') },
    { mark: 'icon:lock', text: bi('ключ доступа к кластеру', 'the cluster access key') },
    { mark: 'icon:process', text: bi('агент GitOps внутри кластера', 'the GitOps agent inside the cluster') },
    { mark: 'dashed', text: bi('джоба ждёт окончания выкладки', 'the job waits for the rollout to finish') },
    { mark: 'warn', text: bi('Deployment не изменился, или новые поды аварийно завершаются, пока старые ещё работают', 'the Deployment did not change, or the new pods crash while the old ones still run') },
    { mark: 'err', text: bi('здесь выкладка остановилась', 'the rollout stopped here') },
  ],
  stopLabel: bi('Выкладка остановилась', 'The rollout stopped'),
  concepts: ['cicd.k8s-push', 'cicd.immutable-tag', 'cicd.rollout-wait', 'cicd.gitops-pull'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      { id: 'job', label: bi('джоба deploy', 'deploy job'), icon: 'container', work: 'dots', sub: 'alpine/k8s', family: 'node', shape: 'rack', x: 24, y: 40, w: 184, h: 84, card: card(bi('Джоба выкладки, которая выполняется в образе с kubectl. В push-модели она сама выступает клиентом кластера, и её команды идут прямо в API-сервер.', 'The deploy job in an image with kubectl. In the push model it is the cluster’s client: its commands go straight to the API server.'), bi('Джобу выполняет раннер, и по правилам её запускают только из main.', 'A runner; by the rules, only from main.'), 'glab ci trace deploy') },
      { id: 'reg', label: bi('реестр образов', 'image registry'), icon: 'database', sub: 'site:1a2b3c4d', family: 'store', shape: 'buffer', x: 24, y: 210, w: 184, h: 60, card: card(bi('Сюда стадия build положила образ с тегом коммита. Тег 1a2b3c4d никогда не будет указывать на другой образ, а тег latest переходит на новый образ при каждой сборке.', 'The build stage put the image here, tagged with the commit. The tag 1a2b3c4d will never point to another image, while latest moves with every build.'), bi('Образ отправила сюда джоба сборки командой `docker push`.', 'docker push from the build job.'), 'glab ci trace build-image') },
      { id: 'kcfg', label: 'KUBECONFIG', icon: 'lock', sub: 'File · Protected', family: 'obj', shape: 'doc', x: 24, y: 340, w: 184, h: 60, card: card(bi('Ключ сервисного аккаунта deployer: адрес кластера, токен и пространство имён staging. Переменная имеет тип File, поэтому раннер записывает её в файл, а kubectl находит этот файл по пути в `$KUBECONFIG`. Пометка Protected означает, что ключ получают только пайплайны защищённых веток.', 'The key of the deployer service account: the cluster address, a token, the staging namespace. A File-type variable: the runner writes it to a file and kubectl finds it by the path in $KUBECONFIG. Protected: only pipelines of protected branches get the key.'), bi('Ключ выдаёт администратор кластера, а вы кладёте его в настройки проекта.', 'The cluster administrator issues it; you put it into the project settings.'), 'glab variable list') },
      { id: 'api', label: 'API server', icon: 'server', work: 'spin', sub: 'staging', family: 'cp', shape: 'hex', x: 330, y: 150, w: 176, h: 76, card: card(bi('Единственный вход в кластер. API-сервер проверяет, кто пришёл и что ему разрешено: аккаунт deployer может менять Deployment в пространстве имён staging, но не узлы и не другие пространства имён.', 'The only door of the cluster. It checks who came and what they may do: deployer may change Deployments in staging, but not nodes and not other namespaces.'), bi('API-сервер входит в состав кластера.', 'The cluster.'), 'kubectl auth can-i patch deployments -n staging') },
      { id: 'dep', label: 'Deployment web', icon: 'file', sub: 'image: site:…', family: 'obj', shape: 'doc', x: 590, y: 40, w: 192, h: 64, card: card(bi('Deployment описывает желаемое состояние приложения, то есть образ и число реплик. Новый образ в шаблоне пода создаёт новую ревизию, а если текст объекта не изменился, выкладки не будет.', 'The desired state: the image and the number of replicas. A new image in the pod template is a new revision; the same text means no rollout.'), bi('Объект меняет джоба в push-модели или агент в pull-модели.', 'The job (push) or the agent (pull).'), 'kubectl get deploy web -o wide') },
      { id: 'rsOld', label: bi('ReplicaSet старый', 'old ReplicaSet'), icon: 'container', sub: '3/3', family: 'obj', shape: 'doc', x: 590, y: 190, w: 168, h: 56, card: card(bi('Поды прежней версии. При постепенном обновлении они уходят только тогда, когда новые поды готовы, а при откате контроллер снова увеличивает этот же ReplicaSet.', 'The pods of the previous version. In a rolling update they leave only when new ones are ready; on a rollback the controller scales this very ReplicaSet back up.'), bi('ReplicaSet ведёт контроллер Deployment.', 'The Deployment controller.'), 'kubectl get rs') },
      { id: 'rsNew', label: bi('ReplicaSet новый', 'new ReplicaSet'), icon: 'container', work: 'pulse', sub: '0/3', family: 'obj', shape: 'doc', x: 790, y: 190, w: 152, h: 56, card: card(bi('Поды нового образа с новым значением pod-template-hash. Этот ReplicaSet появляется, только если шаблон пода изменился.', 'The pods of the new image with a new pod-template-hash. It appears only if the pod template changed.'), bi('ReplicaSet создаёт контроллер Deployment.', 'The Deployment controller.'), 'kubectl rollout status deploy/web') },
      { id: 'cfg', label: bi('репозиторий конфигурации', 'config repository'), icon: 'folder', sub: 'deploy/values.yaml', family: 'ci-source', shape: 'doc', x: 330, y: 340, w: 208, h: 60, card: card(bi('Отдельный репозиторий с манифестами или значениями для Helm. В pull-модели CI записывает сюда новый тег коммитом, и на этом его работа заканчивается, а история выкладок становится историей коммитов.', 'A separate repository with manifests or Helm values. In the pull model CI commits the new tag here, and that is all it does: the history of deployments becomes the history of commits.'), bi('Изменения вносит джоба CI коммитом, а люди вносят их через merge request.', 'The CI job with a commit; people with a merge request.'), 'git log --oneline deploy/values.yaml') },
      { id: 'agent', label: bi('агент GitOps', 'GitOps agent'), icon: 'process', work: 'spin', sub: 'Argo CD / Flux', family: 'cp', shape: 'hex', x: 620, y: 330, w: 184, h: 76, card: card(bi('Контроллер внутри кластера. Он сам читает репозиторий конфигурации и приводит кластер к записанному там состоянию, так же как контроллер Deployment приводит поды к спецификации. Ключ от кластера при этом не покидает кластер.', 'A controller inside the cluster. It reads the configuration repository by itself and brings the cluster to what is written there, as the Deployment controller brings pods to the spec. The cluster key never leaves the cluster.'), bi('Агента устанавливает администратор кластера.', 'The cluster administrator installs it.'), 'argocd app get web') },
    ],
    edges: [
      { id: 'e-img', from: 'reg', to: 'job', label: bi('тег образа', ':$CI_COMMIT_SHORT_SHA'), card: card(bi('Джоба выкладки узнаёт тег образа из предопределённой переменной `$CI_COMMIT_SHORT_SHA`. Это тот же коммит, который собрала стадия build.', 'The deploy job knows the image tag from a predefined variable: the same commit the build stage built.'), bi('Переменные передаёт сервер.', 'The forge passes the variables.')) },
      { id: 'e-key', from: 'kcfg', to: 'job', via: [[232, 370], [232, 110]], label: bi('файл ключа', 'key file'), labelAt: 0.5, card: card(bi('Раннер записывает переменную типа File во временный файл, а путь к нему кладёт в `$KUBECONFIG`.', 'The runner writes the File variable into a temporary file and puts its path into $KUBECONFIG.'), bi('Файл записывает gitlab-runner.', 'gitlab-runner.')) },
      { id: 'e-set', from: 'job', to: 'api', label: 'kubectl set image', card: card(bi('Запрос PATCH к Deployment, который записывает новый образ в шаблон пода. Дальше работают обычные контроллеры кластера.', 'A PATCH to the Deployment: a new image in the pod template. From there the usual cluster controllers work.'), bi('Запрос отправляет скрипт джобы.', 'The job script.'), 'kubectl set image deployment/web web=…', { page: 'help/kubectl-set-image', anchor: 'DESCRIPTION' }) },
      { id: 'e-store', from: 'api', to: 'dep', label: bi('новая ревизия', 'new revision'), card: card(bi('API-сервер сохраняет изменённый объект, и контроллер Deployment узнаёт об изменении через подписку на изменения (watch).', 'The API server stores the changed object; the Deployment controller sees it through a watch.'), bi('Объект сохраняет API-сервер.', 'The API server.')) },
      { id: 'e-roll', from: 'dep', to: 'rsNew', via: [[866, 72]], label: bi('новый ReplicaSet', 'pod-template-hash'), labelAt: 0.4, card: card(bi('Новый шаблон пода получает новый хэш pod-template-hash, и для него создаётся новый ReplicaSet. Поды переходят на новую версию по одному, по правилам постепенного обновления.', 'A new pod template, a new hash, a new ReplicaSet. Pods move over one by one under the rolling update rules.'), bi('ReplicaSet создаёт контроллер Deployment.', 'The Deployment controller.'), 'kubectl get rs -l app=web') },
      { id: 'e-old', from: 'dep', to: 'rsOld', label: bi('уменьшение', 'scale down'), card: card(bi('Старый ReplicaSet уменьшается по мере того, как новые поды становятся готовыми.', 'The old ReplicaSet shrinks as the new pods become ready.'), bi('Число подов меняет контроллер Deployment.', 'The Deployment controller.')) },
      { id: 'e-wait', from: 'rsNew', to: 'job', via: [[866, 140], [116, 140]], label: 'kubectl rollout status --timeout', labelAt: 0.25, dashed: true, card: card(bi('Джоба ждёт, пока выкладка закончится, и завершается с ошибкой, если выкладка не закончилась за отведённое время. Без этой строки джоба становится зелёной сразу после `kubectl set image`, что бы потом ни случилось с подами.', 'The job waits for the rollout to finish and fails if it did not finish in time. Without this line the job is green right after set image, whatever happens to the pods.'), bi('Ожидание запускает скрипт джобы.', 'The job script.'), 'kubectl rollout status deployment/web --timeout=120s') },
      { id: 'e-commit', from: 'job', to: 'cfg', via: [[272, 100], [272, 310], [434, 310]], label: bi('коммит с тегом', 'git commit of the tag'), labelAt: 0.7, card: card(bi('В pull-модели джоба меняет одну строку в репозитории конфигурации и отправляет коммит. Ключа от кластера у CI нет вовсе.', 'In the pull model the job changes one line in the configuration repository and pushes a commit. CI has no cluster key at all.'), bi('Коммит отправляет скрипт джобы.', 'The job script.')) },
      { id: 'e-pull', from: 'agent', to: 'cfg', label: bi('чтение конфигурации', 'reads'), card: card(bi('Агент сам опрашивает репозиторий или получает уведомление о новом коммите и сравнивает записанное с тем, что работает в кластере.', 'The agent polls the repository by itself (or gets a webhook) and compares what is written with the cluster.'), bi('Репозиторий читает агент GitOps.', 'The GitOps agent.')) },
      { id: 'e-apply', from: 'agent', to: 'api', via: [[712, 290], [418, 290]], label: bi('применение разницы', 'applies'), labelAt: 0.4, card: card(bi('Найденную разницу агент применяет изнутри кластера под своим сервисным аккаунтом.', 'The agent applies the difference from inside the cluster with its own service account.'), bi('Изменения применяет агент GitOps.', 'The GitOps agent.')) },
    ],
  },
  params: [
    {
      id: 'mode',
      label: bi('Кто меняет кластер', 'Deployment model'),
      group: bi('Модель выкладки', 'The deployment model'),
      kind: 'choice',
      default: 'push',
      options: [
        { id: 'push', label: bi('джоба сама вызывает kubectl (push)', 'push: kubectl in the job') },
        { id: 'pull', label: bi('джоба коммитит тег, агент применяет (pull)', 'pull: a commit to the config') },
      ],
      near: 'agent',
      predict: {
        prompt: bi('В pull-модели нужна ли джобе выкладки переменная KUBECONFIG с ключом от кластера?', 'In the pull model, does the job need the KUBECONFIG variable?'),
        options: [
          { id: 'no', text: bi('Нет, потому что в кластер обращается агент изнутри', 'No: the agent goes to the cluster from inside') },
          { id: 'yes', text: bi('Да, так же как в push-модели', 'Yes, as in push') },
        ],
        resolve: (_p, n) => (n.some((s) => s.focus.includes('e-key')) ? 'yes' : 'no'),
      },
    },
    {
      id: 'tag',
      label: bi('Каким тегом помечен образ', 'Image tag'),
      group: bi('Что выкладывают', 'What is deployed'),
      kind: 'choice',
      default: 'sha',
      options: [
        { id: 'sha', label: bi('тегом коммита :$CI_COMMIT_SHORT_SHA', ':$CI_COMMIT_SHORT_SHA') },
        { id: 'latest', label: bi('тегом :latest, а джоба запускает kubectl apply', ':latest and kubectl apply') },
      ],
      near: 'reg',
      predict: {
        prompt: bi('Образ всегда собирается с тегом :latest, а джоба запускает kubectl apply того же манифеста. Появятся ли новые поды?', 'The image is always built as :latest, and the job runs kubectl apply of the same manifest. Will new pods appear?'),
        options: [
          { id: 'no', text: bi('Нет, потому что текст Deployment не изменился и выкладки нет', 'No: the Deployment did not change, so there is no rollout') },
          { id: 'yes', text: bi('Да, потому что образ под этим тегом уже новый', 'Yes: the image is new, after all') },
        ],
        resolve: (_p, n) => (metric(n, 'newPods') > 0 ? 'yes' : 'no'),
      },
    },
    {
      id: 'wait',
      label: bi('Джоба ждёт окончания выкладки (rollout status)', 'rollout status in the job'),
      group: bi('Что выкладывают', 'What is deployed'),
      kind: 'toggle',
      default: true,
      near: 'job',
    },
  ],
  breaks: [
    {
      id: 'crash',
      label: bi('Новая версия аварийно завершается через три секунды после старта', 'The new image crashes on start'),
      remove: ['e-old'],
      predict: {
        prompt: bi('Новая версия аварийно завершается через три секунды после старта. Какого цвета будет пайплайн?', 'The new version crashes three seconds after it starts. What colour will the pipeline be?'),
        options: [
          { id: 'red', text: bi('Пайплайн будет красным, если джоба ждёт окончания выкладки', 'Red, if the job waits for the rollout') },
          { id: 'green', text: bi('Пайплайн будет зелёным в любом случае', 'Green in any case') },
          { id: 'redAlways', text: bi('Пайплайн будет красным в любом случае', 'Red in any case') },
        ],
        resolve: () => 'red',
      },
    },
    {
      id: 'forbidden',
      label: bi('У аккаунта deployer нет права patch', 'The deployer account has no patch right'),
      remove: ['e-store'],
      predict: {
        prompt: bi('Роль deployer разрешает get и list, но не разрешает patch. Что ответит API-сервер на kubectl set image?', 'The deployer role allows get and list, but not patch. What does the API server answer to kubectl set image?'),
        options: [
          { id: 'forbidden', text: bi('API-сервер ответит Forbidden, потому что пользователю это действие не разрешено', 'Forbidden: the user is not allowed to') },
          { id: 'ok', text: bi('API-сервер выполнит команду, потому что ключ от кластера у джобы есть', 'It does it: there is a kubeconfig after all') },
        ],
        resolve: () => 'forbidden',
      },
    },
  ],
  metrics: [
    { id: 'newPods', label: bi('число готовых подов новой версии', 'ready pods of the new version') },
    { id: 'oldPods', label: bi('число подов прежней версии', 'pods of the previous version') },
    { id: 'jobOk', label: bi('успешно завершённых джоб выкладки', 'deploy jobs finished successfully') },
  ],
  run(p, broken) {
    const pull = p.mode === 'pull';
    const latest = p.tag === 'latest';
    const crash = broken.has('crash');
    const tag = latest ? 'latest' : '1a2b3c4d';
    const steps: Step[] = [
      {
        id: 'image',
        label: 'image',
        caption: latest
          ? bi('Стадия build собрала образ и отправила его в реестр как site:latest, то есть с тем же тегом, что и в прошлый раз.', 'The build stage built the image and pushed it as site:latest, the same tag as last time.')
          : bi('Стадия build собрала образ и отправила его в реестр как site:1a2b3c4d. Тег совпадает с коммитом и становится неизменным именем этой версии.', 'The build stage built the image and pushed it as site:1a2b3c4d, the commit tag: the unchanging name of this version.'),
        focus: ['reg', 'e-img', 'job'],
        tokens: [{ edge: 'e-img', label: `:${tag}` }],
        say: { job: fmt(bi('Джоба выкладки получает из переменной тег образа {t}, который нужно выложить на тестовый стенд.', 'The deploy job gets the image tag {t} to deploy to staging from a variable.'), { t: `:${tag}` }) },
        states: { ...hiddenExcept(KD_ALL, 'reg', 'job', 'e-img', 'dep', 'rsOld'), reg: 'ok', rsOld: 'ok' },
        values: { reg: `site:${tag}`, dep: 'image: site:0f9e8d7c', rsOld: '3/3', rsNew: '0/3' },
        metrics: { newPods: 0, oldPods: 3, jobOk: 0 },
      },
    ];
    if (pull) {
      steps.push({
        id: 'commit',
        label: 'git push',
        caption: latest
          ? bi('Джоба записывает в values.yaml тег latest, но этот тег там уже записан. Изменять нечего, поэтому коммита нет.', 'The job writes the tag latest into values.yaml, the same one already there. No commit: nothing to change.')
          : bi('Джоба меняет в файле deploy/values.yaml строку `tag: 1a2b3c4d` и отправляет коммит. Джоба становится зелёной, потому что её работа в том и состоит, чтобы записать желаемое состояние.', 'The job changes the line tag: 1a2b3c4d in deploy/values.yaml and pushes a commit. The job is green: its work is to record the desired state.'),
        focus: ['e-commit', 'cfg'],
        reveal: ['cfg', 'e-commit'],
        tokens: latest ? [] : [{ edge: 'e-commit', label: 'tag: 1a2b3c4d' }],
        say: { cfg: latest ? bi('В репозитории конфигурации уже записан тег latest, и новая запись ничего в нём не меняет.', 'The configuration repository already has the tag latest, and the new write changes nothing in it.') : bi('В репозиторий конфигурации приходит коммит, который меняет тег образа на 1a2b3c4d.', 'A commit arrives in the configuration repository and changes the image tag to 1a2b3c4d.') },
        states: { job: 'ok', cfg: latest ? 'on' : 'ok' },
        values: { cfg: `tag: ${tag}` },
        metrics: { newPods: 0, oldPods: 3, jobOk: 1 },
      });
      steps.push({
        id: 'sync',
        label: 'sync',
        caption: latest
          ? bi('Агент сравнивает репозиторий с кластером и разницы не находит, поэтому синхронизировать нечего, и новых подов не будет.', 'The agent compares the repository with the cluster: there is no difference, nothing to sync. No new pods.')
          : bi('Агент видит новый коммит, сравнивает записанное с кластером и применяет разницу изнутри кластера под своим аккаунтом.', 'The agent sees the new commit, compares it with the cluster and applies the difference from inside, with its own account.'),
        focus: ['e-pull', 'agent', 'e-apply', 'api'],
        reveal: ['agent', 'e-pull', 'e-apply', 'api'],
        tokens: latest ? [] : [{ edge: 'e-apply', label: 'image: site:1a2b3c4d' }],
        say: { agent: latest ? bi('Агент сравнивает репозиторий с кластером и не находит разницы.', 'The agent compares the repository with the cluster and finds no difference.') : bi('Агент находит в репозитории новый тег и передаёт изменение API-серверу изнутри кластера.', 'The agent finds the new tag in the repository and hands the change to the API server from inside the cluster.') },
        states: { agent: 'ok', api: latest ? 'on' : 'ok' },
        metrics: { newPods: 0, oldPods: 3, jobOk: 1 },
      });
      if (latest) {
        steps.push({
          id: 'same',
          label: bi('без изменений', 'unchanged'),
          caption: bi('Deployment не изменился, и ReplicaSet остался прежним. Выкладка формально прошла, а на тестовом стенде работает старая версия, потому что тег, который переходит с образа на образ, не видят ни Git, ни Kubernetes.', 'The Deployment did not change, the ReplicaSet is the old one: the "deployment" passed and staging runs the old version. A tag that moves is invisible to both Git and Kubernetes.'),
          focus: ['dep', 'rsOld'],
          say: { dep: bi('Текст Deployment остался прежним, поэтому контроллер не создаёт новых подов.', 'The Deployment text stayed the same, so the controller creates no new pods.') },
          states: { dep: 'warn' },
          metrics: { newPods: 0, oldPods: 3, jobOk: 1 },
        });
        return steps;
      }
      steps.push({
        id: 'roll',
        label: 'rollout',
        caption: bi('Дальше всё идёт как при любой выкладке: новый шаблон пода, новый ReplicaSet и замена подов по одному.', 'From here on it is as always: a new pod template, a new ReplicaSet, pods one by one.'),
        focus: ['e-store', 'dep', 'e-roll', 'rsNew'],
        reveal: ['e-store', 'e-roll', 'rsNew', 'e-old'],
        tokens: [{ edge: 'e-roll', label: 'site:1a2b3c4d' }],
        say: { rsNew: crash ? bi('Новые поды стартуют и через три секунды аварийно завершаются, поэтому старые поды продолжают работать.', 'The new pods start and crash three seconds later, so the old pods keep running.') : bi('Новый ReplicaSet запускает три пода новой версии, а старые поды уходят по одному.', 'The new ReplicaSet starts three pods of the new version while the old pods leave one by one.') },
        states: { dep: 'ok', rsNew: crash ? 'err' : 'ok', rsOld: crash ? 'ok' : 'off' },
        values: { dep: 'image: site:1a2b3c4d', rsNew: crash ? '0/1 CrashLoopBackOff' : '3/3', rsOld: crash ? '3/3' : '0/3' },
        metrics: { newPods: crash ? 0 : 3, oldPods: crash ? 3 : 0, jobOk: 1 },
      });
      if (crash)
        steps.push({
          id: 'degraded',
          label: 'Degraded',
          caption: bi('Пайплайн давно зелёный, потому что CI не знает, что произошло дальше. О поломке сообщает агент, который помечает приложение как Degraded, а откатывают её коммитом revert в репозиторий конфигурации.', 'The pipeline has long been green: CI does not know what happened next. The agent reports the breakage (the application is Degraded), and it is rolled back with a revert commit to the configuration repository.'),
          focus: ['agent', 'rsNew'],
          say: { agent: bi('Агент видит, что новые поды аварийно завершаются, и помечает приложение как Degraded.', 'The agent sees the new pods crashing and marks the application as Degraded.') },
          states: { agent: 'err' },
          metrics: { newPods: 0, oldPods: 3, jobOk: 1 },
          broken: { at: 'agent', message: 'web  Synced  Degraded  Back-off restarting failed container web in pod web-6mzdx…', caption: bi('В pull-модели состояние выкладки показывает агент, а откат выполняют коммитом в репозиторий конфигурации.', 'in the pull model the agent shows the rollout’s health, and a rollback is a commit.') },
        });
      return steps;
    }
    steps.push({
      id: 'key',
      label: 'KUBECONFIG',
      caption: bi('Раннер записывает переменную типа File во временный файл, и kubectl находит ключ аккаунта deployer по пути в `$KUBECONFIG`.', 'The runner writes the File variable to a temporary file; kubectl finds the deployer key through $KUBECONFIG.'),
      focus: ['kcfg', 'e-key', 'job'],
      reveal: ['kcfg', 'e-key'],
      tokens: [{ edge: 'e-key', label: 'deployer.kubeconfig' }],
      say: { kcfg: bi('Раннер записывает ключ аккаунта deployer в файл, и путь к нему попадает в переменную KUBECONFIG.', 'The runner writes the deployer key to a file, and its path goes into the KUBECONFIG variable.') },
      states: { kcfg: 'ok', job: 'on' },
      metrics: { newPods: 0, oldPods: 3, jobOk: 0 },
    });
    if (broken.has('forbidden')) {
      steps.push({
        id: 'denied',
        label: '403',
        caption: bi('API-сервер узнаёт аккаунт deployer и проверяет его роль: права get и list у него есть, а права patch нет. Поэтому сервер отказывает, и Deployment остаётся нетронутым.', 'The API server recognises the deployer account and checks its role: get and list are there, patch is not. Refused; the Deployment is untouched.'),
        focus: ['e-set', 'api'],
        reveal: ['api', 'e-set'],
        tokens: [{ edge: 'e-set', label: 'PATCH' }],
        say: { api: bi('API-сервер проверяет роль аккаунта deployer, не находит в ней права patch и отвечает Forbidden.', 'The API server checks the deployer role, finds no patch right in it and answers Forbidden.') },
        states: { api: 'err', job: 'err' },
        metrics: { newPods: 0, oldPods: 3, jobOk: 0 },
        broken: { at: 'api', message: 'Error from server (Forbidden): deployments.apps "web" is forbidden: User "system:serviceaccount:staging:deployer" cannot patch resource "deployments" in API group "apps" in the namespace "staging"', caption: bi('Добавьте в роль глагол patch для deployments, причём только его, а не права cluster-admin.', 'add the patch verb for deployments to the role: that verb, not cluster-admin.') },
      });
      return steps;
    }
    if (latest) {
      steps.push(
        {
          id: 'apply',
          label: 'kubectl apply',
          caption: bi('Джоба запускает `kubectl apply` того же манифеста, в котором по-прежнему написано site:latest. API-сервер сравнивает его с сохранённым объектом и отвечает, что ничего не изменилось.', 'kubectl apply of the same manifest: it still says site:latest. The API server compares and answers "unchanged".'),
          focus: ['e-set', 'api', 'dep'],
          reveal: ['api', 'e-set', 'e-store'],
          tokens: [{ edge: 'e-set', label: 'apply' }],
          say: { api: bi('API-сервер сравнивает манифест с сохранённым Deployment и не находит различий.', 'The API server compares the manifest with the stored Deployment and finds no differences.') },
          states: { api: 'ok', dep: 'warn', job: 'ok' },
          values: { dep: 'image: site:latest' },
          metrics: { newPods: 0, oldPods: 3, jobOk: 0 },
        },
        {
          id: 'same',
          label: bi('без изменений', 'unchanged'),
          caption: bi('Шаблон пода не изменился, поэтому нового ReplicaSet нет. Джоба зелёная, а на тестовом стенде работает старая версия, и kubectl печатает `deployment.apps/web unchanged`.', 'The pod template did not change, so there is no new ReplicaSet. The job is green, and staging runs the old version: deployment.apps/web unchanged.'),
          focus: ['dep', 'rsOld'],
          say: { dep: bi('Текст Deployment остался прежним, поэтому контроллер не создаёт новых подов.', 'The Deployment text stayed the same, so the controller creates no new pods.') },
          metrics: { newPods: 0, oldPods: 3, jobOk: 1 },
        },
      );
      return steps;
    }
    steps.push({
      id: 'set',
      label: 'set image',
      caption: bi('Команда `kubectl set image` записывает новый образ в шаблон пода, и у Deployment появляется новая ревизия.', 'kubectl set image changes the image in the pod template. This is a new revision of the Deployment.'),
      focus: ['e-set', 'api', 'e-store', 'dep'],
      reveal: ['api', 'e-set', 'e-store'],
      tokens: [{ edge: 'e-set', label: 'site:1a2b3c4d' }],
      say: { api: bi('API-сервер проверяет, что аккаунту deployer разрешено менять Deployment, и сохраняет новый образ.', 'The API server checks that deployer may change the Deployment and stores the new image.') },
      states: { api: 'ok', dep: 'ok' },
      values: { dep: 'image: site:1a2b3c4d' },
      metrics: { newPods: 0, oldPods: 3, jobOk: 0 },
    });
    steps.push({
      id: 'roll',
      label: 'rollout',
      caption: crash
        ? bi('Новый ReplicaSet запускает один под сверх трёх старых. По умолчанию постепенное обновление разрешает 25 процентов лишних подов с округлением вверх и 25 процентов недоступных с округлением вниз, то есть для трёх реплик один лишний под и ни одного недоступного. Новый под стартует и через три секунды аварийно завершается, поэтому контроллер не убирает ни одного старого пода, и все три продолжают отвечать на запросы.', 'The new ReplicaSet starts one pod on top of the three old ones. By default a rolling update allows 25 percent extra pods rounded up and 25 percent unavailable rounded down, which for three replicas is one extra pod and none unavailable. The new pod starts and crashes three seconds later, so the controller removes none of the old pods, and all three keep serving requests.')
        : bi('Новый шаблон пода получает новый хэш и новый ReplicaSet. Новые поды становятся готовыми, а старые уходят по одному.', 'A new template, a new pod-template-hash, a new ReplicaSet. New pods become ready, old ones leave one by one.'),
      focus: ['e-roll', 'rsNew', 'e-old', 'rsOld'],
      reveal: ['e-roll', 'rsNew', 'e-old'],
      tokens: [{ edge: 'e-roll', label: 'site:1a2b3c4d' }],
      say: { rsNew: crash ? bi('Новый под стартует и через три секунды аварийно завершается, и kubelet раз за разом его перезапускает.', 'The new pods start and crash three seconds later, and the controller restarts them again and again.') : bi('Новый ReplicaSet запускает три пода новой версии, а старые поды уходят по одному.', 'The new ReplicaSet starts three pods of the new version while the old pods leave one by one.') },
      states: { rsNew: crash ? 'err' : 'ok', rsOld: crash ? 'warn' : 'off' },
      values: { rsNew: crash ? '0/1 CrashLoopBackOff' : '3/3', rsOld: crash ? '3/3' : '0/3' },
      metrics: { newPods: crash ? 0 : 3, oldPods: crash ? 3 : 0, jobOk: p.wait ? 0 : 1 },
    });
    if (!p.wait) {
      steps.push(
        crash
          ? {
              id: 'green',
              label: bi('зелёная', 'green'),
              caption: bi('Джоба закончилась сразу после `kubectl set image` и стала зелёной. На тестовом стенде работает сломанная версия, а пайплайн сообщает, что всё в порядке.', 'The job ended right after set image and is green. A broken version is on staging, and the pipeline says all is well.'),
              focus: ['job', 'rsNew'],
              say: { job: bi('Джоба не ждала окончания выкладки и завершилась успешно, хотя новые поды аварийно завершаются.', 'The job did not wait for the rollout and finished successfully, although the new pods are crashing.') },
              states: { job: 'ok', rsNew: 'err' },
              metrics: { newPods: 0, oldPods: 3, jobOk: 1 },
              broken: { at: 'rsNew', message: 'pod/web-6mzdx-dr9ck   0/1   CrashLoopBackOff   3   2m', caption: bi('Без kubectl rollout status пайплайн не знает, чем закончилась выкладка.', 'without rollout status the pipeline does not know how the rollout ended.') },
            }
          : {
              id: 'green',
              label: bi('зелёная', 'green'),
              caption: bi('Джоба закончилась сразу после `kubectl set image`. На этот раз выкладка удалась, но пайплайн об этом не знал, и ему повезло.', 'The job ended right after set image. This time the rollout succeeded, but the pipeline did not know it: it was lucky.'),
              focus: ['job'],
              say: { job: bi('Джоба завершилась, не дожидаясь подов, и о результате выкладки ничего не знает.', 'The job finished without waiting for the pods and knows nothing about the rollout result.') },
              states: { job: 'ok' },
              metrics: { newPods: 3, oldPods: 0, jobOk: 1 },
            },
      );
      return steps;
    }
    if (crash) {
      steps.push({
        id: 'timeout',
        label: 'timeout',
        caption: bi('Команда `kubectl rollout status` ждёт 120 секунд, но выкладка так и не заканчивается, поэтому джоба завершается с ошибкой, и пайплайн становится красным.', 'kubectl rollout status waits 120 seconds, the rollout does not finish, the job fails. The pipeline is red.'),
        focus: ['e-wait', 'job'],
        reveal: ['e-wait'],
        tokens: [{ edge: 'e-wait', label: bi('поды не готовы', 'pods not ready') }],
        say: { job: bi('Джоба 120 секунд ждёт готовности новых подов, не дожидается её и завершается с кодом 1.', 'The job waits 120 seconds for the new pods to become ready, gives up and exits with code 1.') },
        states: { job: 'err' },
        metrics: { newPods: 0, oldPods: 3, jobOk: 0 },
        broken: { at: 'job', message: 'Waiting for deployment "web" rollout to finish: 1 out of 3 new replicas have been updated...\nerror: timed out waiting for the condition\nERROR: Job failed: exit code 1', caption: bi('Джоба с when: on_failure выполняет kubectl rollout undo, и тестовый стенд возвращается к прежней ревизии.', 'a job with when: on_failure runs kubectl rollout undo, and staging returns to the previous revision.') },
      });
      return steps;
    }
    steps.push({
      id: 'done',
      label: 'rolled out',
      caption: bi('Команда `kubectl rollout status` дождалась сообщения `deployment "web" successfully rolled out`. Джоба зелёная, и на этот раз зелёный цвет говорит правду.', 'rollout status waited it out: deployment "web" successfully rolled out. The job is green, and that is true.'),
      focus: ['e-wait', 'job'],
      reveal: ['e-wait'],
      tokens: [{ edge: 'e-wait', label: '3/3 ready' }],
      say: { job: bi('Джоба дождалась готовности трёх новых подов и завершилась успешно.', 'The job waited until all three new pods were ready and finished successfully.') },
      states: { job: 'ok' },
      metrics: { newPods: 3, oldPods: 0, jobOk: 1 },
    });
    return steps;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломку убрали, и выкладка снова доходит до конца.', 'The break is removed: the rollout completes again.');
      if (change.id === 'forbidden') return b.mode === 'pull' ? bi('В pull-модели CI в кластер не обращается, поэтому права аккаунта deployer ему не нужны.', 'In the pull model CI does not go to the cluster: it does not need deployer’s rights.') : bi('API-сервер проверяет права аккаунта на каждое действие, и без права patch команда kubectl set image не выполняется.', 'The API server checks the account’s rights for every verb: no patch, no set image.');
      return metric(next, 'jobOk') ? bi('Новая версия аварийно завершается, а пайплайн всё равно зелёный, потому что CI не дождался результата выкладки.', 'The pipeline is green while the version crashes: CI did not wait for the result.') : bi('Команда kubectl rollout status превратила неудачную выкладку в красный пайплайн.', 'rollout status turned a failed rollout into a red pipeline.');
    }
    if (change.id === 'mode') return b.mode === 'pull' ? bi('В pull-модели CI только записывает тег коммитом, а кластер изнутри меняет агент, и ключа от кластера у CI нет.', 'Pull: CI only commits the tag, and the agent changes the cluster from inside. CI holds no cluster key.') : bi('В push-модели джоба сама обращается к API-серверу со своим ключом.', 'Push: the job goes to the API server itself with its own key.');
    if (change.id === 'tag') return b.tag === 'latest' ? bi('С тегом :latest текст Deployment не меняется, поэтому Kubernetes не видит новой версии.', 'With :latest the Deployment text does not change, so Kubernetes sees no new version.') : bi('Тег коммита меняет шаблон пода, и поэтому начинается выкладка.', 'A commit tag changes the pod template and so starts a rollout.');
    return b.wait ? bi('Джоба ждёт окончания выкладки, и её цвет снова говорит правду о тестовом стенде.', 'The job waits for the rollout: its colour tells the truth about staging again.') : bi('Без ожидания джоба становится зелёной сразу после kubectl set image, что бы ни случилось дальше.', 'Without waiting the job is green right after set image, whatever happens next.');
  },
});
