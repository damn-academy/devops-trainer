// Process explainers for what the Git and CI/CD lessons used to describe only
// in prose: how branches merge (fast-forward, merge commit, conflict), how
// artifacts and the cache travel between jobs and pipelines, how stages and
// `needs` schedule a pipeline, and how a pipeline deploys to Kubernetes in
// the push and the pull model (06 §2.3, §3.4, §3.7).

import { defineModel } from '../../core/define';
import { bi, fmt, type Bi } from '../../core/i18n';
import type { Step } from '../../core/types';
import { card } from './explainers';

const last = (s: Step[]) => s[s.length - 1]?.metrics ?? {};
const metric = (s: Step[], id: string) => last(s)[id] ?? 0;

// ── E-MERGE: what git merge does with two branches ──────────────────────────

type MergeP = { mainMoved: boolean; noFf: boolean };

export function mergeKind(p: MergeP, broken: ReadonlySet<string>): 'ff' | 'commit' | 'conflict' | 'refused' {
  if (broken.has('dirty')) return 'refused';
  if (broken.has('same-lines')) return 'conflict';
  return p.mainMoved || p.noFf ? 'commit' : 'ff';
}

export const mergeModel = defineModel<MergeP>({
  id: 'git.merge-kinds',
  block: 'git-yaml',
  title: bi('Как git merge сводит две ветки', 'How git merge joins two branches'),
  summary: bi(
    'Ветка — имя на коммите. Если main не уходила вперёд, слияние просто передвигает её на последний коммит другой ветки; если обе ветки ушли вперёд, Git сравнивает их с общим предком и создаёт коммит с двумя родителями; если обе правили одни строки, он останавливается и просит решить.',
    'A branch is a name on a commit. If main did not move on, a merge just moves it to the last commit of the other branch; if both branches moved on, Git compares them with their common ancestor and creates a commit with two parents; if both changed the same lines, it stops and asks you to decide.',
  ),
  concepts: ['git.branch', 'git.merge', 'git.conflict'],
  diagram: {
    width: 960,
    height: 420,
    nodes: [
      { id: 'a', label: 'A', sub: 'merge-base', family: 'ci-source', shape: 'doc', x: 40, y: 190, w: 120, h: 56, card: card(bi('Коммит, от которого отошла ветка feature. Для слияния он — база: Git сравнивает с ним обе ветки, чтобы понять, кто что поменял.', 'The commit the feature branch started from. For a merge it is the base: Git compares both branches with it to see who changed what.'), bi('Был в main до ответвления.', 'Was on main before the branch started.'), 'git merge-base main feature', { page: 'man/git-merge.1', anchor: 'DESCRIPTION' }) },
      { id: 'b', label: 'B', sub: 'main', family: 'ci-source', shape: 'doc', x: 260, y: 190, w: 120, h: 56, card: card(bi('Коммит коллеги в main, сделанный после того, как вы ответвились. Из-за него истории разошлись.', 'A colleague’s commit on main made after you branched off. Because of it the histories diverged.'), bi('Коллега: git commit в main.', 'A colleague: git commit on main.'), 'git log --oneline main') },
      { id: 'c', label: 'C', sub: 'feature', family: 'ci-build', shape: 'doc', x: 260, y: 50, w: 120, h: 56, card: card(bi('Ваш первый коммит в ветке feature. Его родитель — A.', 'Your first commit on the feature branch. Its parent is A.'), bi('Вы: git commit в feature.', 'You: git commit on feature.'), 'git log --oneline feature') },
      { id: 'd', label: 'D', sub: 'feature', family: 'ci-build', shape: 'doc', x: 470, y: 50, w: 120, h: 56, card: card(bi('Последний коммит ветки feature — на него указывает её имя.', 'The last commit of the feature branch: its name points here.'), bi('Вы: git commit в feature.', 'You: git commit on feature.'), 'git rev-parse feature') },
      { id: 'm', label: 'M', sub: '2 parents', family: 'ci-test', shape: 'doc', x: 600, y: 190, w: 140, h: 56, card: card(bi('Коммит с двумя родителями: B и D. Его снимок — объединение изменений обеих веток относительно A. Появляется, только если быстрая перемотка невозможна или запрещена ключом --no-ff.', 'A commit with two parents, B and D. Its snapshot joins the changes of both branches relative to A. It appears only when a fast-forward is impossible or forbidden with --no-ff.'), bi('git merge.', 'git merge.'), 'git log --graph --oneline', { page: 'man/git-merge.1', anchor: 'OPTIONS', line: '--no-ff' }) },
      { id: 'main', label: 'main', sub: '→ A', family: 'neutral', shape: 'pill', x: 800, y: 196, w: 136, h: 44, card: card(bi('Ветка main: файл с хэшем одного коммита. Слияние в main меняет только этот хэш (и, может быть, добавляет коммит M).', 'The main branch: a file with the hash of one commit. A merge into main changes only that hash (and maybe adds the commit M).'), bi('git merge двигает её.', 'git merge moves it.'), 'cat .git/refs/heads/main') },
      { id: 'feature', label: 'feature', sub: '→ D', family: 'neutral', shape: 'pill', x: 800, y: 56, w: 136, h: 44, card: card(bi('Ветка feature. Слияние в main её не трогает: после merge её можно удалить, коммиты останутся в истории main.', 'The feature branch. Merging into main does not touch it: after the merge it can be deleted and its commits stay in main’s history.'), bi('git switch -c feature.', 'git switch -c feature.'), 'git branch -v') },
      { id: 'head', label: 'HEAD', sub: '→ main', family: 'neutral', shape: 'pill', x: 800, y: 320, w: 136, h: 44, card: card(bi('Слияние всегда вливает названную ветку в ту, где вы стоите. Поэтому сначала git switch main.', 'A merge always brings the named branch into the one you are on. That is why you run git switch main first.'), bi('git switch.', 'git switch.'), 'cat .git/HEAD') },
      { id: 'file', label: 'about.html', sub: 'base · ours · theirs', family: 'obj', shape: 'buffer', x: 360, y: 320, w: 200, h: 56, card: card(bi('Для каждого файла Git берёт три версии: из общего предка, из вашей ветки и из чужой. Строку, которую поменяла одна сторона, он берёт оттуда; строку, которую поменяли обе по-разному, отдаёт вам с маркерами <<<<<<< ======= >>>>>>>.', 'For each file Git takes three versions: from the common ancestor, from your branch and from theirs. A line one side changed is taken from that side; a line both changed differently is handed to you with the markers <<<<<<< ======= >>>>>>>.'), bi('git merge, при конфликте — вы.', 'git merge; on a conflict, you.'), 'git diff', { page: 'man/git-merge.1', anchor: 'DESCRIPTION' }) },
    ],
    edges: [
      { id: 'e-ba', from: 'b', to: 'a', label: 'parent', card: card(bi('B продолжает историю main от A.', 'B continues main’s history from A.'), bi('git commit.', 'git commit.')) },
      { id: 'e-ca', from: 'c', to: 'a', label: 'parent', card: card(bi('C начинается от A: в момент git switch -c feature ветка указывала на A.', 'C starts from A: at git switch -c feature the branch pointed to A.'), bi('git commit.', 'git commit.')) },
      { id: 'e-dc', from: 'd', to: 'c', label: 'parent', card: card(bi('D продолжает ветку feature.', 'D continues the feature branch.'), bi('git commit.', 'git commit.')) },
      { id: 'e-mb', from: 'm', to: 'b', label: bi('родитель 1', 'parent 1'), card: card(bi('Первый родитель коммита слияния — коммит ветки, в которую вливали (main).', 'The first parent of a merge commit is the commit of the branch merged into (main).'), bi('git merge.', 'git merge.'), 'git log --first-parent --oneline') },
      { id: 'e-md', from: 'm', to: 'd', label: bi('родитель 2', 'parent 2'), card: card(bi('Второй родитель — последний коммит вливаемой ветки. Так история помнит, откуда пришли изменения.', 'The second parent is the last commit of the merged branch. That is how history remembers where the changes came from.'), bi('git merge.', 'git merge.'), 'git show --format=%P -s HEAD') },
      { id: 'e-file', from: 'file', to: 'm', label: bi('трёхстороннее сравнение', 'three-way comparison'), card: card(bi('Снимок M собирается пофайлово из трёх версий. Конфликт — это только те строки, где обе стороны разошлись с базой по-разному.', 'M’s snapshot is assembled file by file from three versions. A conflict is only the lines where both sides departed from the base differently.'), bi('git merge.', 'git merge.')) },
      { id: 'e-feat', from: 'feature', to: 'd', label: 'refs/heads/feature', card: card(bi('Имя ветки указывает на её последний коммит.', 'The branch name points to its last commit.'), bi('git commit двигает его.', 'git commit moves it.')) },
      { id: 'e-head', from: 'head', to: 'main', label: 'ref: refs/heads/main', card: card(bi('Вы стоите в main: слияние будет двигать её.', 'You are on main: the merge will move it.'), bi('git switch main.', 'git switch main.')) },
    ],
  },
  params: [
    {
      id: 'mainMoved',
      label: bi('В main появился коммит B', 'Commit B appeared on main'),
      kind: 'toggle',
      default: false,
      near: 'b',
      predict: {
        prompt: bi('Пока вы работали в feature, коллега сделал коммит B в main. Что сделает git merge feature?', 'While you worked on feature, a colleague made commit B on main. What does git merge feature do?'),
        options: [
          { id: 'commit', text: bi('Создаст коммит слияния с двумя родителями', 'Create a merge commit with two parents') },
          { id: 'ff', text: bi('Просто передвинет main на D', 'Just move main to D') },
        ],
        resolve: (_p, n) => (metric(n, 'created') > 0 ? 'commit' : 'ff'),
      },
    },
    {
      id: 'noFf',
      label: bi('Ключ --no-ff', 'The --no-ff key'),
      kind: 'toggle',
      default: false,
      near: 'm',
      predict: {
        prompt: bi('main не уходила вперёд, но вы запускаете git merge --no-ff feature. Появится ли коммит слияния?', 'main did not move on, but you run git merge --no-ff feature. Will a merge commit appear?'),
        options: [
          { id: 'yes', text: bi('Да: --no-ff запрещает быструю перемотку', 'Yes: --no-ff forbids the fast-forward') },
          { id: 'no', text: bi('Нет: сливать нечего, main просто переедет', 'No: there is nothing to join, main just moves') },
        ],
        resolve: (_p, n) => (metric(n, 'created') > 0 ? 'yes' : 'no'),
      },
    },
  ],
  breaks: [
    {
      id: 'same-lines',
      label: bi('Обе ветки правили одну строку', 'Both branches changed the same line'),
      remove: ['e-file'],
      predict: {
        prompt: bi('В B и в D по-разному переписан один и тот же абзац about.html. Что сделает git merge?', 'B and D rewrote the same paragraph of about.html differently. What does git merge do?'),
        options: [
          { id: 'stop', text: bi('Остановится и попросит выбрать', 'Stop and ask you to choose') },
          { id: 'newer', text: bi('Возьмёт более позднюю правку', 'Take the later edit') },
          { id: 'ours', text: bi('Оставит версию main', 'Keep main’s version') },
        ],
        resolve: () => 'stop',
      },
    },
    {
      id: 'dirty',
      label: bi('В main есть незакоммиченная правка about.html', 'An uncommitted edit of about.html on main'),
      remove: ['e-head'],
      predict: {
        prompt: bi('В рабочем каталоге незакоммиченная правка about.html, а feature тоже меняла этот файл. Что ответит git merge?', 'The working directory has an uncommitted edit of about.html, and feature changed that file too. What does git merge answer?'),
        options: [
          { id: 'refuse', text: bi('Откажется: правка была бы затёрта', 'Refuse: the edit would be overwritten') },
          { id: 'mix', text: bi('Смешает правку со слиянием', 'Mix the edit into the merge') },
        ],
        resolve: () => 'refuse',
      },
    },
  ],
  metrics: [
    { id: 'created', label: bi('новых коммитов при слиянии', 'commits created by the merge') },
    { id: 'parents', label: bi('родителей у вершины main', 'parents of main’s tip') },
    { id: 'conflicts', label: bi('файлов в конфликте', 'files in conflict') },
  ],
  run(p, broken) {
    const kind = mergeKind(p, broken);
    const diverged = p.mainMoved || kind === 'conflict';
    const steps: Step[] = [
      { id: 'fork', label: 'switch -c', caption: bi('git switch -c feature: новая ветка указывает на тот же коммит A, что и main. Ничего не копируется.', 'git switch -c feature: the new branch points to the same commit A as main. Nothing is copied.'), focus: ['a', 'feature'], states: { a: 'ok', b: 'off', c: 'off', d: 'off', m: 'off' }, values: { main: '→ A', feature: '→ A' } },
      { id: 'work', label: 'C, D', caption: bi('Вы делаете в feature два коммита. Ветка feature переезжает на D; main стоит на A.', 'You make two commits on feature. The feature branch moves to D; main stays on A.'), focus: ['c', 'd', 'e-ca', 'e-dc', 'e-feat'], tokens: [{ edge: 'e-dc' }], states: { c: 'ok', d: 'ok' }, values: { feature: '→ D' } },
    ];
    if (diverged)
      steps.push({ id: 'theirs', label: 'B', caption: bi('Тем временем коллега делает коммит B в main. Теперь у A два потомка: истории разошлись, и простой перемоткой их уже не соединить.', 'Meanwhile a colleague makes commit B on main. Now A has two descendants: the histories diverged and a plain fast-forward can no longer join them.'), focus: ['b', 'e-ba', 'main'], states: { b: 'ok' }, values: { main: '→ B' } });
    steps.push({ id: 'switch', label: 'switch main', caption: bi('git switch main: HEAD указывает на main. Слияние будет двигать именно её.', 'git switch main: HEAD points to main. The merge will move this branch.'), focus: ['head', 'e-head', 'main'], states: { head: 'on' } });
    if (kind === 'refused') {
      steps.push({ id: 'refused', label: 'git merge', caption: bi('В рабочем каталоге незакоммиченная правка того же файла. Слияние затёрло бы её, поэтому Git ничего не делает.', 'The working directory has an uncommitted edit of the same file. The merge would overwrite it, so Git does nothing.'), focus: ['head', 'file'], states: { file: 'err', head: 'warn' }, metrics: { created: 0, parents: diverged ? 1 : 1, conflicts: 0 }, broken: { at: 'e-head', message: 'error: Your local changes to the following files would be overwritten by merge:\n\tabout.html\nPlease commit your changes or stash them before you merge.\nAborting', caption: bi('сначала закоммитьте правку (или уберите её), затем сливайте.', 'commit the edit first (or drop it), then merge.') } });
      return steps;
    }
    if (kind === 'ff') {
      steps.push({ id: 'ff', label: 'fast-forward', caption: bi('main не уходила вперёд: D уже продолжает её историю. Git просто записывает в main хэш D. Нового коммита нет, история осталась прямой.', 'main did not move on: D already continues its history. Git just writes D’s hash into main. No new commit; the history stays straight.'), focus: ['main', 'd'], states: { main: 'ok', d: 'ok' }, values: { main: '→ D' }, metrics: { created: 0, parents: 1, conflicts: 0 } });
      return steps;
    }
    steps.push({ id: 'base', label: bi('база', 'base'), caption: diverged ? bi('Git находит общего предка A и для каждого файла сравнивает три версии: из A, из B и из D.', 'Git finds the common ancestor A and for every file compares three versions: from A, from B and from D.') : bi('--no-ff: перемотка была бы возможна, но вы её запретили. Git всё равно сравнивает версии с базой A.', '--no-ff: a fast-forward would be possible, but you forbade it. Git still compares the versions with the base A.'), focus: ['a', 'file', 'e-file'], tokens: [{ edge: 'e-file' }], states: { file: 'on', a: 'on' } });
    if (kind === 'conflict') {
      steps.push({ id: 'conflict', label: 'CONFLICT', caption: bi('Один и тот же абзац about.html обе стороны изменили по-разному. Git не выбирает за вас: он вписывает обе версии с маркерами и останавливается посреди слияния.', 'Both sides changed the same paragraph of about.html differently. Git does not choose for you: it writes both versions with markers and stops in the middle of the merge.'), focus: ['file', 'm'], states: { file: 'err', m: 'wait' }, values: { file: '<<<<<<< HEAD … >>>>>>> feature' }, metrics: { created: 0, parents: 1, conflicts: 1 }, broken: { at: 'file', message: 'Auto-merging about.html\nCONFLICT (content): Merge conflict in about.html\nAutomatic merge failed; fix conflicts and then commit the result.', caption: bi('отредактируйте файл, уберите маркеры, git add about.html и git commit — или git merge --abort, чтобы вернуться.', 'edit the file, remove the markers, git add about.html and git commit, or git merge --abort to go back.') } });
      return steps;
    }
    steps.push(
      { id: 'commit', label: 'M', caption: bi('Изменения сходятся без пересечений. Git записывает коммит M с двумя родителями: B (или A) и D.', 'The changes do not overlap. Git records the commit M with two parents: B (or A) and D.'), focus: ['m', 'e-mb', 'e-md'], tokens: [{ edge: 'e-md' }], states: { m: 'ok', file: 'ok' } },
      { id: 'moved', label: 'main → M', caption: bi('main переезжает на M. git log --graph покажет развилку и место, где ветки сошлись.', 'main moves to M. git log --graph shows the fork and the place where the branches met.'), focus: ['main'], states: { main: 'ok' }, values: { main: '→ M' }, metrics: { created: 1, parents: 2, conflicts: 0 } },
    );
    return steps;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломка убрана: слияние снова доходит до конца.', 'The break is removed: the merge completes again.');
      return change.id === 'same-lines' ? bi('Обе стороны поменяли одни строки: Git останавливается и ждёт вашего решения.', 'Both sides changed the same lines: Git stops and waits for your decision.') : bi('Незакоммиченная правка защищена: Git отказывается сливать, пока вы её не закоммитите.', 'An uncommitted edit is protected: Git refuses to merge until you commit it.');
    }
    const c = metric(next, 'created');
    if (change.id === 'mainMoved') return b.mainMoved ? bi('Истории разошлись: перемотка невозможна, появляется коммит M с двумя родителями.', 'The histories diverged: a fast-forward is impossible, and the commit M with two parents appears.') : c ? bi('main не уходила вперёд, но --no-ff всё равно требует коммит слияния.', 'main did not move on, but --no-ff still demands a merge commit.') : bi('main не уходила вперёд: слияние — просто перемотка указателя.', 'main did not move on: the merge is just a pointer moving forward.');
    return b.noFf ? bi('--no-ff: коммит слияния создаётся всегда, и в истории видно, что работа шла в отдельной ветке.', '--no-ff: a merge commit is always created, and the history shows that the work happened on a branch.') : c ? bi('Без --no-ff коммит слияния нужен всё равно: истории разошлись.', 'Without --no-ff a merge commit is still needed: the histories diverged.') : bi('Без --no-ff Git перематывает main, коммита слияния нет.', 'Without --no-ff Git fast-forwards main; there is no merge commit.');
  },
});

// ── E-ARTCACHE: artifacts within a pipeline, the cache between pipelines ────

type ArtP = { key: string; lockChanged: boolean; otherRunner: boolean };

export function artNumbers(p: ArtP): { hit: boolean; npm2: number } {
  // The local cache lives on one runner; the key decides which shelf it is.
  const sameShelf = p.key === 'branch' || (p.key === 'lock' && !p.lockChanged);
  const hit = !p.otherRunner && sameShelf;
  return { hit, npm2: hit ? 9 : 52 };
}

export const artifactsModel = defineModel<ArtP>({
  id: 'cicd.artifacts-cache',
  block: 'cicd',
  title: bi('Артефакт внутри пайплайна, кэш между пайплайнами', 'Artifacts within a pipeline, the cache between pipelines'),
  summary: bi(
    'Каждая джоба начинается на чистой машине. dist/ доходит от сборки до теста только артефактом через forge. Кэш лежит у раннера под ключом и ускоряет следующий пайплайн, если ключ совпал и джоба попала на тот же раннер; если нет — сборка идёт дольше, но проходит.',
    'Every job starts on a clean machine. dist/ gets from the build to the test only as an artifact through the forge. The cache lies on the runner under a key and speeds up the next pipeline if the key matches and the job lands on the same runner; if not, the build takes longer but passes.',
  ),
  concepts: ['cicd.artifact', 'cicd.cache'],
  diagram: {
    width: 960,
    height: 440,
    nodes: [
      { id: 'b1', label: 'build #1', sub: 'runner-1', family: 'node', shape: 'rack', x: 30, y: 40, w: 170, h: 84, card: card(bi('Джоба сборки первого пайплайна. Контейнер из образа джобы, чистая копия репозитория; npm ci, затем сборка в dist/. После джобы контейнер удаляется вместе со всем, что не загружено.', 'The build job of the first pipeline. A container from the job image, a clean copy of the repository; npm ci, then the build into dist/. After the job the container is deleted with everything that was not uploaded.'), bi('Раннер, по джобе из .gitlab-ci.yml.', 'A runner, for a job from .gitlab-ci.yml.'), 'glab ci trace build') },
      { id: 't1', label: 'test #1', sub: 'runner-1', family: 'node', shape: 'rack', x: 400, y: 40, w: 170, h: 84, card: card(bi('Джоба следующей стадии. Начинает с чистой копии репозитория: dist/ в ней нет, пока его не скачают как артефакт.', 'A job of the next stage. It starts from a clean copy of the repository: there is no dist/ until it is downloaded as an artifact.'), bi('Раннер.', 'A runner.'), 'glab ci trace test') },
      { id: 'deploy', label: 'deploy #1', sub: 'runner-2', family: 'ci-deploy', shape: 'box', x: 760, y: 52, w: 170, h: 60, card: card(bi('Ещё одна джоба, может быть на другом раннере. Ей тоже нужен dist/, и тоже только через артефакты.', 'One more job, maybe on another runner. It needs dist/ too, and again only through artifacts.'), bi('Раннер.', 'A runner.')) },
      { id: 'art', label: bi('артефакты', 'artifacts'), sub: 'dist/', family: 'store', shape: 'buffer', x: 400, y: 190, w: 170, h: 60, card: card(bi('Хранилище forge. Раннер загружает сюда artifacts:paths после успешной джобы; джобы следующих стадий скачивают их перед скриптом, на каком бы раннере ни оказались. Доставка гарантирована.', 'The forge storage. The runner uploads artifacts:paths here after a successful job; later-stage jobs download them before their script, whichever runner they land on. Delivery is guaranteed.'), bi('Forge.', 'The forge.'), 'glab ci trace test', { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'artifacts' }) },
      { id: 'cache', label: bi('кэш на runner-1', 'cache on runner-1'), sub: 'npm-main', family: 'store', shape: 'buffer', x: 30, y: 190, w: 170, h: 60, card: card(bi('Локальная полка раннера: архив .npm/ под именем ключа. Её видит только этот раннер (если не настроен общий кэш), и её могут стереть в любой момент.', 'The runner’s local shelf: an archive of .npm/ under the key’s name. Only this runner sees it (unless a shared cache is set up), and it may be wiped at any moment.'), bi('gitlab-runner после успешной джобы.', 'gitlab-runner after a successful job.'), 'glab ci trace build', { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'cache' }) },
      { id: 'lock', label: 'package-lock.json', sub: 'unchanged', family: 'obj', shape: 'doc', x: 30, y: 330, w: 170, h: 56, card: card(bi('Список точных версий зависимостей. Ключ cache:key:files строится из хэша этого файла: изменился файл — новая полка.', 'The exact versions of the dependencies. The cache:key:files key is built from this file’s hash: a changed file means a new shelf.'), bi('npm install, коммитом.', 'npm install, in a commit.'), 'git log --oneline package-lock.json') },
      { id: 'b2', label: 'build #2', sub: 'runner-1', family: 'node', shape: 'rack', x: 400, y: 316, w: 170, h: 84, card: card(bi('Сборка следующего пайплайна. Перед скриптом раннер ищет кэш по ключу: нашёл — npm ci берёт пакеты с диска, не нашёл — качает из интернета.', 'The build of the next pipeline. Before the script the runner looks for the cache by key: found, and npm ci takes packages from disk; not found, and it downloads them.'), bi('Раннер, по следующему push.', 'A runner, on the next push.'), 'glab ci trace build') },
    ],
    edges: [
      { id: 'e-up', from: 'b1', to: 'art', via: [[115, 160], [485, 160]], label: bi('загрузка artifacts:paths', 'upload artifacts:paths'), labelAt: 0.5, card: card(bi('После успешной джобы раннер архивирует пути из artifacts:paths и отправляет на forge.', 'After a successful job the runner archives the artifacts:paths and sends them to the forge.'), bi('gitlab-runner.', 'gitlab-runner.')) },
      { id: 'e-down', from: 'art', to: 't1', label: bi('скачивание перед скриптом', 'download before the script'), card: card(bi('«Downloading artifacts for build» в логе test: файлы из прошлой стадии раскладываются в каталог проекта.', '"Downloading artifacts for build" in the test log: files from the earlier stage are laid out in the project directory.'), bi('gitlab-runner.', 'gitlab-runner.')) },
      { id: 'e-down2', from: 'art', to: 'deploy', via: [[845, 220]], label: bi('и на другой раннер', 'and to another runner'), labelAt: 0.6, card: card(bi('Артефакт не зависит от раннера: forge отдаёт его любому.', 'An artifact does not depend on the runner: the forge hands it to any.'), bi('gitlab-runner.', 'gitlab-runner.')) },
      { id: 'e-save', from: 'b1', to: 'cache', label: bi('сохранить .npm/', 'save .npm/'), card: card(bi('После успешной джобы раннер кладёт cache:paths на свою полку с именем ключа.', 'After a successful job the runner puts cache:paths on its shelf named by the key.'), bi('gitlab-runner.', 'gitlab-runner.')) },
      { id: 'e-key', from: 'lock', to: 'cache', label: 'cache:key', card: card(bi('Ключ решает, на какую полку класть и с какой брать. Ветка в ключе — своя полка у каждой ветки; lock-файл в ключе — новая полка при каждом изменении зависимостей.', 'The key decides which shelf to save to and read from. A branch in the key gives each branch its own shelf; the lock file in the key gives a new shelf whenever the dependencies change.'), bi('Вы, в .gitlab-ci.yml.', 'You, in .gitlab-ci.yml.'), undefined, { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'cache', line: 'cache:key:files' }) },
      { id: 'e-restore', from: 'cache', to: 'b2', via: [[280, 240], [280, 358]], label: bi('восстановить, если нашёлся', 'restore if found'), labelAt: 0.8, card: card(bi('«Checking cache for npm-main…»: при попадании npm ci идёт за 9 с вместо 52. При промахе — WARNING и полная загрузка: медленнее, но без ошибки.', '"Checking cache for npm-main…": on a hit npm ci takes 9 s instead of 52. On a miss, a WARNING and a full download: slower, but no error.'), bi('gitlab-runner.', 'gitlab-runner.')) },
    ],
  },
  params: [
    {
      id: 'key',
      label: bi('Ключ кэша', 'Cache key'),
      kind: 'choice',
      default: 'branch',
      options: [
        { id: 'branch', label: bi('npm-$CI_COMMIT_REF_SLUG', 'npm-$CI_COMMIT_REF_SLUG') },
        { id: 'lock', label: bi('files: [package-lock.json]', 'files: [package-lock.json]') },
      ],
      near: 'cache',
    },
    {
      id: 'lockChanged',
      label: bi('Во втором коммите изменён package-lock.json', 'The second commit changes package-lock.json'),
      kind: 'toggle',
      default: false,
      near: 'lock',
      predict: {
        prompt: bi('Ключ — файл package-lock.json, и во втором коммите он изменился. Найдёт ли build #2 кэш?', 'The key is package-lock.json, and the second commit changed it. Will build #2 find the cache?'),
        options: [
          { id: 'miss', text: bi('Нет: у нового lock-файла новая полка', 'No: a new lock file has a new shelf') },
          { id: 'hit', text: bi('Да: ветка та же', 'Yes: the branch is the same') },
        ],
        resolve: (_p, n) => (n.some((s) => s.id === 'hit') ? 'hit' : 'miss'),
      },
    },
    {
      id: 'otherRunner',
      label: bi('build #2 попала на другой раннер', 'build #2 landed on another runner'),
      kind: 'toggle',
      default: false,
      near: 'b2',
      predict: {
        prompt: bi('Следующую сборку забрал runner-2, у которого своей полки с этим ключом нет. Что будет?', 'The next build was taken by runner-2, which has no shelf with this key. What happens?'),
        options: [
          { id: 'slow', text: bi('Пройдёт, но медленнее', 'It passes, but slower') },
          { id: 'fail', text: bi('Упадёт: зависимостей нет', 'It fails: no dependencies') },
        ],
        resolve: () => 'slow',
      },
    },
  ],
  breaks: [
    {
      id: 'no-artifact',
      label: bi('artifacts: не объявлены', 'No artifacts: declared'),
      remove: ['e-up', 'e-down', 'e-down2'],
      predict: {
        prompt: bi('У build нет artifacts:paths. Обе джобы на одном раннере. Увидит ли test каталог dist/?', 'build has no artifacts:paths. Both jobs are on one runner. Will test see the dist/ directory?'),
        options: [
          { id: 'no', text: bi('Нет: каждая джоба начинается с чистой копии', 'No: every job starts from a clean copy') },
          { id: 'yes', text: bi('Да: раннер тот же', 'Yes: the runner is the same') },
        ],
        resolve: () => 'no',
      },
    },
    {
      id: 'dist-in-cache',
      label: bi('dist/ положили в кэш, а не в артефакт', 'dist/ put into the cache, not an artifact'),
      remove: ['e-up', 'e-down', 'e-down2'],
      predict: {
        prompt: bi('dist/ объявлен в cache, а deploy достался runner-2. Дойдёт ли сборка до выкладки?', 'dist/ is declared in cache, and deploy went to runner-2. Will the build reach the deploy?'),
        options: [
          { id: 'no', text: bi('Нет: у runner-2 другая полка', 'No: runner-2 has a different shelf') },
          { id: 'yes', text: bi('Да: кэш общий для пайплайна', 'Yes: the cache is shared by the pipeline') },
        ],
        resolve: () => 'no',
      },
    },
  ],
  metrics: [
    { id: 'npm1', label: bi('npm ci в build #1', 'npm ci in build #1'), unit: 's' },
    { id: 'npm2', label: bi('npm ci в build #2', 'npm ci in build #2'), unit: 's' },
    { id: 'delivered', label: bi('джоб получили dist/', 'jobs that got dist/') },
  ],
  run(p, broken) {
    const n = artNumbers(p);
    const steps: Step[] = [
      { id: 'build', label: 'build #1', caption: bi('Первый пайплайн: кэша ещё нет, npm ci качает всё — 52 с. Сборка кладёт результат в dist/ внутри контейнера джобы.', 'The first pipeline: there is no cache yet, npm ci downloads everything, 52 s. The build puts its result into dist/ inside the job container.'), focus: ['b1'], states: { b1: 'ok', cache: 'off', art: 'off' }, values: { b1: 'dist/ (local)' }, metrics: { npm1: 52, npm2: 0, delivered: 0 } },
    ];
    if (broken.has('no-artifact') || broken.has('dist-in-cache')) {
      const inCache = broken.has('dist-in-cache');
      steps.push({
        id: 'lost',
        label: inCache ? 'deploy #1' : 'test #1',
        caption: inCache ? bi('dist/ лёг на полку runner-1 вместе с .npm/. test на том же раннере его даже нашёл, но deploy забрал runner-2 — у него этой полки нет.', 'dist/ went onto runner-1’s shelf along with .npm/. test on the same runner even found it, but deploy was taken by runner-2, which has no such shelf.') : bi('Контейнер build удалён вместе с dist/. test стартует с чистой копии репозитория: каталога нет, хотя раннер тот же.', 'The build container is deleted along with dist/. test starts from a clean copy of the repository: the directory is gone, although the runner is the same.'),
        focus: inCache ? ['deploy', 'cache'] : ['t1'],
        states: inCache ? { cache: 'warn', t1: 'ok', deploy: 'err' } : { t1: 'err' },
        metrics: { npm1: 52, npm2: 0, delivered: inCache ? 1 : 0 },
        broken: { at: inCache ? 'deploy' : 't1', message: inCache ? '$ ./deploy.sh staging\ndeploy.sh: dist/index.html not found (no artifact?)\nERROR: Job failed: exit code 1' : '$ test -f dist/index.html\nERROR: Job failed: exit code 1', caption: bi('результат, который обязан дойти, передают через artifacts; кэш доставку не гарантирует.', 'a result that must arrive is passed through artifacts; a cache guarantees no delivery.') },
      });
      return steps;
    }
    steps.push(
      { id: 'upload', label: 'artifacts', caption: bi('После успешной джобы раннер загружает dist/ на forge и сохраняет .npm/ на свою полку под ключом.', 'After the successful job the runner uploads dist/ to the forge and saves .npm/ on its shelf under the key.'), focus: ['e-up', 'art', 'e-save', 'cache'], tokens: [{ edge: 'e-up', label: 'dist/' }, { edge: 'e-save', label: '.npm/' }], states: { art: 'ok', cache: 'ok' }, values: { cache: p.key === 'branch' ? 'npm-main' : 'a3f1c0…' }, fill: { art: 0.5, cache: 0.6 } },
      { id: 'download', label: 'test, deploy', caption: bi('test и deploy скачивают dist/ с forge перед своим скриптом — deploy даже на другом раннере.', 'test and deploy download dist/ from the forge before their script; deploy even on another runner.'), focus: ['e-down', 'e-down2', 't1', 'deploy'], tokens: [{ edge: 'e-down', label: 'dist/' }, { edge: 'e-down2', label: 'dist/' }], states: { t1: 'ok', deploy: 'ok' }, metrics: { npm1: 52, npm2: 0, delivered: 2 } },
      { id: 'push2', label: bi('новый push', 'a new push'), caption: p.lockChanged ? bi('Следующий коммит меняет package-lock.json: зависимости стали другими.', 'The next commit changes package-lock.json: the dependencies are different now.') : bi('Следующий коммит меняет только страницы сайта.', 'The next commit changes only the site pages.'), focus: ['lock', 'e-key'], states: { lock: p.lockChanged ? 'warn' : 'on' }, values: { lock: p.lockChanged ? 'changed' : 'unchanged' } },
    );
    if (n.hit)
      steps.push({ id: 'hit', label: bi('попадание', 'hit'), caption: bi('build #2 на runner-1, ключ совпал: полка найдена, npm ci берёт пакеты с диска — 9 с вместо 52.', 'build #2 is on runner-1 and the key matches: the shelf is found, npm ci takes packages from disk, 9 s instead of 52.'), focus: ['e-restore', 'b2'], tokens: [{ edge: 'e-restore', label: '.npm/' }], states: { b2: 'ok' }, values: { b2: p.otherRunner ? 'runner-2' : 'runner-1' }, metrics: { npm1: 52, npm2: n.npm2, delivered: 2 } });
    else
      steps.push({
        id: 'miss',
        label: bi('промах', 'miss'),
        caption: p.otherRunner ? bi('build #2 забрал runner-2: на его диске полки с этим ключом нет. WARNING в логе, npm ci качает всё заново — 52 с, и сборка проходит.', 'build #2 was taken by runner-2: its disk has no shelf with this key. A WARNING in the log, npm ci downloads everything again, 52 s, and the build passes.') : bi('Ключ построен из нового lock-файла — это другая полка, её ещё нет. npm ci качает всё заново, 52 с, сборка проходит и заполняет новую полку.', 'The key is built from the new lock file: another shelf that does not exist yet. npm ci downloads everything, 52 s; the build passes and fills the new shelf.'),
        focus: ['b2', 'cache'],
        states: { b2: 'warn', cache: 'warn' },
        values: { b2: p.otherRunner ? 'runner-2' : 'runner-1' },
        metrics: { npm1: 52, npm2: n.npm2, delivered: 2 },
      });
    return steps;
  },
  explainDelta(prev, next, change, _a, b): Bi {
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломка убрана: dist/ снова доходит до всех джоб через forge.', 'The break is removed: dist/ reaches every job through the forge again.');
      return change.id === 'no-artifact' ? bi('Без artifacts результат сборки исчезает вместе с её контейнером.', 'Without artifacts the build result disappears with its container.') : bi('Кэш — полка конкретного раннера: джоба на другом раннере её не видит.', 'A cache is a particular runner’s shelf: a job on another runner does not see it.');
    }
    const a1 = metric(prev, 'npm2');
    const b1 = metric(next, 'npm2');
    if (change.id === 'key') return b.key === 'lock' ? fmt(bi('Ключ по lock-файлу: полка меняется вместе с зависимостями. npm ci во второй сборке: {a} → {b} с.', 'A key by the lock file: the shelf changes along with the dependencies. npm ci in the second build: {a} → {b} s.'), { a: a1, b: b1 }) : fmt(bi('Ключ по ветке: у каждой ветки своя полка. npm ci во второй сборке: {a} → {b} с.', 'A key by branch: each branch has its own shelf. npm ci in the second build: {a} → {b} s.'), { a: a1, b: b1 });
    return fmt(bi('npm ci во второй сборке: {a} → {b} с. Промах кэша замедляет, но не ломает.', 'npm ci in the second build: {a} → {b} s. A cache miss slows down but breaks nothing.'), { a: a1, b: b1 });
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

export const dagModel = defineModel<DagP>({
  id: 'cicd.stages-needs',
  block: 'cicd',
  title: bi('Лесенка стадий и граф needs', 'The staircase of stages and the needs graph'),
  summary: bi(
    'Стадия ждёт всю предыдущую стадию целиком; needs позволяет джобе стартовать, как только готовы именно те джобы, которые ей нужны. Медленный линтер перестаёт держать тесты, но граф нужно держать в порядке: needs на джобу, которую убрали rules, делает пайплайн невалидным.',
    'A stage waits for the whole previous stage; needs lets a job start as soon as exactly the jobs it needs are done. A slow linter stops holding back the tests, but the graph must be kept in order: needs on a job that rules removed makes the pipeline invalid.',
  ),
  concepts: ['cicd.stage', 'cicd.needs'],
  diagram: {
    width: 960,
    height: 400,
    nodes: [
      { id: 'build', label: 'build', sub: '20 s', family: 'ci-build', shape: 'box', x: 40, y: 60, w: 160, h: 60, card: card(bi('Сборка: 20 секунд модели. Результат — артефакт dist/.', 'The build: 20 model seconds. Its result is the dist/ artifact.'), bi('Раннер.', 'A runner.'), 'glab ci view') },
      { id: 'lint', label: 'lint', sub: '90 s', family: 'ci-build', shape: 'box', x: 40, y: 250, w: 160, h: 60, card: card(bi('Медленный линтер в той же стадии build. Тестам он не нужен: им нужен только dist/ из build.', 'A slow linter in the same build stage. The tests do not need it: they need only dist/ from build.'), bi('Раннер.', 'A runner.')) },
      { id: 'test', label: 'test', sub: '30 s', family: 'ci-test', shape: 'box', x: 400, y: 60, w: 160, h: 60, card: card(bi('Тесты стадии test. Без needs ждут всю стадию build, включая lint; с needs: [build] — только build.', 'The tests of the test stage. Without needs they wait for the whole build stage, lint included; with needs: [build], only for build.'), bi('Раннер.', 'A runner.'), 'glab ci view', { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'needs' }) },
      { id: 'deploy', label: 'deploy_staging', sub: '15 s', family: 'ci-deploy', shape: 'box', x: 740, y: 60, w: 180, h: 60, card: card(bi('Выкладка. С needs: [test] стартует сразу после тестов.', 'The deploy. With needs: [test] it starts right after the tests.'), bi('Раннер.', 'A runner.')) },
      { id: 'clock', label: bi('весь пайплайн', 'whole pipeline'), sub: '—', family: 'gauge', shape: 'buffer', x: 400, y: 250, w: 180, h: 60, card: card(bi('Время от создания пайплайна до конца последней джобы. В merge request это время ожидания ревьюера.', 'The time from the pipeline’s creation to the end of its last job. In a merge request it is how long the reviewer waits.'), bi('Forge считает.', 'The forge counts it.'), 'glab ci status') },
    ],
    edges: [
      { id: 'e-bt', from: 'build', to: 'test', label: 'needs: [build]', card: card(bi('Явная зависимость: test стартует, как только build успешна, и скачивает артефакты только от неё.', 'An explicit dependency: test starts as soon as build succeeds and downloads artifacts only from it.'), bi('Вы, в .gitlab-ci.yml.', 'You, in .gitlab-ci.yml.'), undefined, { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'needs' }) },
      { id: 'e-lt', from: 'lint', to: 'test', via: [[300, 280], [300, 110]], label: bi('конец стадии build', 'end of the build stage'), labelAt: 0.35, dashed: true, card: card(bi('Неявная зависимость по стадиям: без needs test ждёт каждую джобу предыдущей стадии, даже ненужную ей.', 'The implicit dependency of stages: without needs, test waits for every job of the earlier stage, even one it does not need.'), bi('Порядок stages.', 'The stages order.'), undefined, { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'stages' }) },
      { id: 'e-td', from: 'test', to: 'deploy', label: 'needs: [test]', card: card(bi('Выкладка ждёт только тесты.', 'The deploy waits only for the tests.'), bi('Вы.', 'You.')) },
      { id: 'e-clock', from: 'deploy', to: 'clock', via: [[830, 280]], label: bi('последняя джоба', 'the last job'), labelAt: 0.4, card: card(bi('Пайплайн закончен, когда закончилась последняя джоба.', 'The pipeline is over when its last job is.'), bi('Forge.', 'The forge.')) },
    ],
  },
  params: [
    {
      id: 'needs',
      label: bi('needs у test и deploy', 'needs on test and deploy'),
      kind: 'toggle',
      default: false,
      near: 'test',
      predict: {
        prompt: bi('Добавим test needs: [build]. Когда стартуют тесты?', 'Give test needs: [build]. When do the tests start?'),
        options: [
          { id: 'early', text: bi('Сразу после build, не дожидаясь lint', 'Right after build, without waiting for lint') },
          { id: 'same', text: bi('Как и раньше, после всей стадии', 'As before, after the whole stage') },
        ],
        resolve: (_p, n) => (metric(n, 'testStart') <= 20 ? 'early' : 'same'),
      },
    },
    { id: 'lint', label: bi('Длительность lint', 'lint duration'), kind: 'range', min: 10, max: 180, step: 10, unit: 's', default: 90, near: 'lint' },
    {
      id: 'runners',
      label: bi('Раннеров', 'Runners'),
      kind: 'range',
      min: 1,
      max: 3,
      step: 1,
      default: 2,
      near: 'clock',
      predict: {
        prompt: bi('needs включены, но раннер остался один. Помогут ли needs?', 'needs are on, but only one runner is left. Will needs help?'),
        options: [
          { id: 'no', text: bi('Нет: test всё равно ждёт свободный раннер', 'No: test still waits for a free runner') },
          { id: 'yes', text: bi('Да, как и с двумя', 'Yes, as with two') },
        ],
        resolve: (prev, next) => (metric(next, 'total') > metric(prev, 'total') ? 'no' : 'yes'),
      },
    },
  ],
  breaks: [
    {
      id: 'needs-excluded',
      label: bi('rules убрали build из пайплайна', 'rules removed build from the pipeline'),
      remove: ['e-bt'],
      predict: {
        prompt: bi('У build правило «только для main», а пайплайн — merge request. test по-прежнему needs: [build]. Что будет?', 'build has a "main only" rule, and the pipeline is a merge request one. test still has needs: [build]. What happens?'),
        options: [
          { id: 'invalid', text: bi('Пайплайн не создастся: зависимость указывает в пустоту', 'The pipeline is not created: the dependency points to nothing') },
          { id: 'start', text: bi('test просто стартует сразу', 'test just starts at once') },
        ],
        resolve: () => 'invalid',
      },
    },
  ],
  metrics: [
    { id: 'testStart', label: bi('test стартует на', 'test starts at'), unit: 's' },
    { id: 'total', label: bi('весь пайплайн', 'whole pipeline'), unit: 's' },
  ],
  run(p, broken) {
    if (broken.has('needs-excluded')) {
      const invalid: Step[] = [
        { id: 'rules', label: 'rules', caption: bi('Forge проверяет правила: build — только для main, а это пайплайн merge request. build в пайплайн не входит.', 'The forge checks the rules: build is for main only, and this is a merge request pipeline. build does not enter the pipeline.'), focus: ['build'], states: { build: 'off' } },
        { id: 'invalid', label: bi('невалиден', 'invalid'), caption: bi('test требует джобу, которой в пайплайне нет. GitLab отказывается создавать такой пайплайн целиком.', 'test requires a job that is not in the pipeline. GitLab refuses to create such a pipeline at all.'), focus: ['test', 'e-bt'], states: { test: 'err', build: 'off', lint: 'off', deploy: 'off' }, metrics: { testStart: 0, total: 0 }, broken: { at: 'e-bt', message: "'test' job needs 'build' job, but 'build' does not exist in the pipeline. This might be because of the only, except, or rules keywords. To need a job that sometimes does not exist in the pipeline, use needs:optional.", caption: bi('держите rules и needs согласованными или пишите needs: [{job: build, optional: true}].', 'keep rules and needs consistent, or write needs: [{job: build, optional: true}].') } },
      ];
      return invalid;
    }
    const t = dagTimes(p);
    const total = t.deploy[1];
    const lintSub = `${p.lint} s`;
    const steps: Step[] = [
      { id: 'start', label: '0 s', caption: p.runners >= 2 ? bi('Пайплайн создан. build и lint — одна стадия и стартуют вместе на двух раннерах.', 'The pipeline is created. build and lint are one stage and start together on two runners.') : bi('Пайплайн создан. Раннер один: сначала build, lint ждёт своей очереди.', 'The pipeline is created. There is one runner: build first, lint waits its turn.'), focus: ['build', 'lint'], states: { build: 'on', lint: p.runners >= 2 ? 'on' : 'wait' }, values: { lint: lintSub, clock: '0 s' } },
      { id: 'built', label: `${t.build[1]} s`, caption: p.needs ? bi('build готова. У test needs: [build] — тесты стартуют сразу, lint ещё идёт.', 'build is done. test has needs: [build], so the tests start at once while lint still runs.') : fmt(bi('build готова, но lint ещё идёт. Без needs test ждёт конца всей стадии — до {l} с.', 'build is done, but lint still runs. Without needs, test waits for the whole stage to end, until {l} s.'), { l: t.lint[1] }), focus: p.needs ? ['e-bt', 'test'] : ['e-lt', 'lint'], tokens: p.needs ? [{ edge: 'e-bt', label: 'dist/' }] : [], states: { build: 'ok', lint: 'on', test: p.needs && t.test[0] <= 20 ? 'on' : 'wait' } },
      { id: 'tests', label: `${t.test[0]} s`, caption: fmt(bi('test стартует на {s}-й секунде.', 'test starts at second {s}.'), { s: t.test[0] }), focus: ['test'], states: { test: 'ok', lint: t.lint[1] <= t.test[0] ? 'ok' : 'on' }, metrics: { testStart: t.test[0], total: 0 } },
      { id: 'deploy', label: `${t.deploy[0]} s`, caption: p.needs ? bi('С needs: [test] выкладка стартует сразу после тестов.', 'With needs: [test] the deploy starts right after the tests.') : bi('Выкладка ждёт конца стадии test.', 'The deploy waits for the test stage to end.'), focus: ['e-td', 'deploy'], tokens: [{ edge: 'e-td' }], states: { deploy: 'ok', lint: 'ok' } },
      { id: 'done', label: `${total} s`, caption: fmt(bi('Пайплайн закончен за {t} с.', 'The pipeline is done in {t} s.'), { t: total }), focus: ['clock', 'e-clock'], states: { clock: 'ok' }, values: { clock: `${total} s` }, metrics: { testStart: t.test[0], total } },
    ];
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    if (change.kind === 'break') return change.on ? bi('needs на исключённую джобу: пайплайн не создаётся вовсе.', 'needs on an excluded job: the pipeline is not created at all.') : bi('Поломка убрана: build снова в пайплайне.', 'The break is removed: build is in the pipeline again.');
    const t0 = metric(prev, 'total');
    const t1 = metric(next, 'total');
    if (change.id === 'needs') return b.needs ? fmt(bi('needs включены: весь пайплайн {a} → {b} с.', 'needs on: the whole pipeline {a} → {b} s.'), { a: t0, b: t1 }) : fmt(bi('needs выключены: весь пайплайн {a} → {b} с.', 'needs off: the whole pipeline {a} → {b} s.'), { a: t0, b: t1 });
    if (change.id === 'lint') return b.needs ? fmt(bi('lint {x} → {y} с: весь пайплайн {a} → {b} с. С needs тесты от него не зависят.', 'lint {x} → {y} s: the whole pipeline {a} → {b} s. With needs the tests do not depend on it.'), { x: a.lint, y: b.lint, a: t0, b: t1 }) : fmt(bi('lint {x} → {y} с: весь пайплайн {a} → {b} с. Без needs медленный линтер держит всех.', 'lint {x} → {y} s: the whole pipeline {a} → {b} s. Without needs the slow linter holds everyone back.'), { x: a.lint, y: b.lint, a: t0, b: t1 });
    return fmt(bi('{x} → {y} раннеров: весь пайплайн {a} → {b} с. needs сокращают ожидание зависимостей, но не заменяют свободные раннеры.', '{x} → {y} runners: the whole pipeline {a} → {b} s. needs cut the wait for dependencies, but do not replace free runners.'), { x: a.runners, y: b.runners, a: t0, b: t1 });
  },
});

// ── E-KDEPLOY: a pipeline deploys to Kubernetes, push and pull ─────────────

type KdP = { mode: string; tag: string; wait: boolean };

export const kubeDeployModel = defineModel<KdP>({
  id: 'cicd.k8s-deploy',
  block: 'cicd-k8s',
  title: bi('Как пайплайн выкатывает версию в Kubernetes', 'How a pipeline rolls a version out to Kubernetes'),
  summary: bi(
    'В push-модели джоба сама идёт в API-сервер со своим ключом и меняет образ в Deployment; новый тег даёт новый ReplicaSet. rollout status заставляет джобу дождаться результата, и упавшая выкладка красит пайплайн красным. В pull-модели у CI нет ключа от кластера: джоба коммитит тег в репозиторий конфигурации, а агент в кластере сам приводит кластер к записанному.',
    'In the push model the job itself goes to the API server with its own key and changes the image in the Deployment; a new tag gives a new ReplicaSet. rollout status makes the job wait for the result, and a failed rollout turns the pipeline red. In the pull model CI has no key to the cluster: the job commits the tag to a configuration repository, and an agent inside the cluster brings the cluster to what is written there.',
  ),
  concepts: ['cicd.k8s-push', 'cicd.immutable-tag', 'cicd.rollout-wait', 'cicd.gitops-pull'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      { id: 'job', label: bi('джоба deploy', 'deploy job'), sub: 'bitnami/kubectl', family: 'node', shape: 'rack', x: 24, y: 40, w: 180, h: 84, card: card(bi('Джоба выкладки в образе с kubectl. В push-модели она и есть клиент кластера: её команды идут прямо в API-сервер.', 'The deploy job in an image with kubectl. In the push model it is the cluster’s client: its commands go straight to the API server.'), bi('Раннер, по правилам — только из main.', 'A runner; by the rules, only from main.'), 'glab ci trace deploy') },
      { id: 'reg', label: bi('реестр образов', 'image registry'), sub: 'site:1a2b3c4d', family: 'store', shape: 'buffer', x: 24, y: 210, w: 180, h: 60, card: card(bi('Сюда стадия build положила образ с тегом коммита. Тег 1a2b3c4d больше никогда не будет указывать на другой образ, а latest переезжает при каждой сборке.', 'The build stage put the image here, tagged with the commit. The tag 1a2b3c4d will never point to another image, while latest moves with every build.'), bi('docker push из джобы сборки.', 'docker push from the build job.'), 'glab ci trace build-image') },
      { id: 'kcfg', label: 'KUBECONFIG', sub: 'File · Protected', family: 'obj', shape: 'doc', x: 24, y: 340, w: 180, h: 60, card: card(bi('Ключ сервисного аккаунта deployer: адрес кластера, токен, namespace staging. Переменная типа File: раннер пишет её в файл, kubectl находит его по пути в $KUBECONFIG. Protected — ключ получают только пайплайны защищённых веток.', 'The key of the deployer service account: the cluster address, a token, the staging namespace. A File-type variable: the runner writes it to a file and kubectl finds it by the path in $KUBECONFIG. Protected: only pipelines of protected branches get the key.'), bi('Администратор кластера выдаёт, вы кладёте в настройки проекта.', 'The cluster administrator issues it; you put it into the project settings.'), 'glab variable list') },
      { id: 'api', label: 'API server', sub: 'staging', family: 'cp', shape: 'hex', x: 330, y: 150, w: 170, h: 76, card: card(bi('Единственная дверь кластера. Проверяет, кто пришёл и что ему можно: deployer может менять Deployment в staging, но не узлы и не чужие namespace.', 'The only door of the cluster. It checks who came and what they may do: deployer may change Deployments in staging, but not nodes and not other namespaces.'), bi('Кластер.', 'The cluster.'), 'kubectl auth can-i patch deployments -n staging') },
      { id: 'dep', label: 'Deployment web', sub: 'image: site:…', family: 'obj', shape: 'doc', x: 590, y: 40, w: 190, h: 64, card: card(bi('Желаемое состояние: образ и число реплик. Новый образ в шаблоне пода — новая ревизия; тот же текст — никакой выкладки.', 'The desired state: the image and the number of replicas. A new image in the pod template is a new revision; the same text means no rollout.'), bi('Джоба (push) или агент (pull).', 'The job (push) or the agent (pull).'), 'kubectl get deploy web -o wide') },
      { id: 'rsOld', label: bi('ReplicaSet старый', 'old ReplicaSet'), sub: '3/3', family: 'obj', shape: 'doc', x: 590, y: 190, w: 160, h: 56, card: card(bi('Поды прежней версии. При rolling update они уходят, только когда новые готовы; при откате контроллер снова раздувает именно этот ReplicaSet.', 'The pods of the previous version. In a rolling update they leave only when new ones are ready; on a rollback the controller scales this very ReplicaSet back up.'), bi('Контроллер Deployment.', 'The Deployment controller.'), 'kubectl get rs') },
      { id: 'rsNew', label: bi('ReplicaSet новый', 'new ReplicaSet'), sub: '0/3', family: 'obj', shape: 'doc', x: 790, y: 190, w: 150, h: 56, card: card(bi('Поды нового образа с новым pod-template-hash. Появляется, только если шаблон пода изменился.', 'The pods of the new image with a new pod-template-hash. It appears only if the pod template changed.'), bi('Контроллер Deployment.', 'The Deployment controller.'), 'kubectl rollout status deploy/web') },
      { id: 'cfg', label: bi('репозиторий конфигурации', 'config repository'), sub: 'deploy/values.yaml', family: 'ci-source', shape: 'doc', x: 330, y: 340, w: 200, h: 60, card: card(bi('Отдельный репозиторий с манифестами или values для Helm. В pull-модели CI коммитит сюда новый тег — и это вся его работа: история выкладок становится историей коммитов.', 'A separate repository with manifests or Helm values. In the pull model CI commits the new tag here, and that is all it does: the history of deployments becomes the history of commits.'), bi('Джоба CI коммитом; люди — merge request.', 'The CI job with a commit; people with a merge request.'), 'git log --oneline deploy/values.yaml') },
      { id: 'agent', label: bi('агент GitOps', 'GitOps agent'), sub: 'Argo CD / Flux', family: 'cp', shape: 'hex', x: 620, y: 330, w: 180, h: 76, card: card(bi('Контроллер внутри кластера. Сам читает репозиторий конфигурации и приводит кластер к записанному, как контроллер Deployment приводит поды к спецификации. Ключ от кластера не покидает кластер.', 'A controller inside the cluster. It reads the configuration repository by itself and brings the cluster to what is written there, as the Deployment controller brings pods to the spec. The cluster key never leaves the cluster.'), bi('Ставит администратор кластера.', 'The cluster administrator installs it.'), 'argocd app get web') },
    ],
    edges: [
      { id: 'e-img', from: 'reg', to: 'job', label: ':$CI_COMMIT_SHORT_SHA', card: card(bi('Джоба выкладки знает тег образа из предопределённой переменной: это тот же коммит, что собрала стадия build.', 'The deploy job knows the image tag from a predefined variable: the same commit the build stage built.'), bi('Forge передаёт переменные.', 'The forge passes the variables.')) },
      { id: 'e-key', from: 'kcfg', to: 'job', via: [[230, 370], [230, 110]], label: bi('файл ключа', 'key file'), labelAt: 0.5, card: card(bi('Раннер записывает File-переменную во временный файл, а в $KUBECONFIG кладёт путь к нему.', 'The runner writes the File variable into a temporary file and puts its path into $KUBECONFIG.'), bi('gitlab-runner.', 'gitlab-runner.')) },
      { id: 'e-set', from: 'job', to: 'api', label: 'kubectl set image', card: card(bi('PATCH к Deployment: новый образ в шаблоне пода. Дальше работают обычные контроллеры кластера.', 'A PATCH to the Deployment: a new image in the pod template. From there the usual cluster controllers work.'), bi('Скрипт джобы.', 'The job script.'), 'kubectl set image deployment/web web=…', { page: 'help/kubectl-set-image', anchor: 'DESCRIPTION' }) },
      { id: 'e-store', from: 'api', to: 'dep', label: bi('новая ревизия', 'new revision'), card: card(bi('API-сервер сохраняет изменённый объект; контроллер Deployment видит его через watch.', 'The API server stores the changed object; the Deployment controller sees it through a watch.'), bi('API-сервер.', 'The API server.')) },
      { id: 'e-roll', from: 'dep', to: 'rsNew', via: [[865, 72]], label: 'pod-template-hash', labelAt: 0.4, card: card(bi('Новый шаблон пода — новый хэш — новый ReplicaSet. Поды переезжают по одному, по правилам rolling update.', 'A new pod template, a new hash, a new ReplicaSet. Pods move over one by one under the rolling update rules.'), bi('Контроллер Deployment.', 'The Deployment controller.'), 'kubectl get rs -l app=web') },
      { id: 'e-old', from: 'dep', to: 'rsOld', label: bi('уменьшить', 'scale down'), card: card(bi('Старый ReplicaSet уменьшается, когда новые поды готовы.', 'The old ReplicaSet shrinks as the new pods become ready.'), bi('Контроллер Deployment.', 'The Deployment controller.')) },
      { id: 'e-wait', from: 'rsNew', to: 'job', via: [[865, 140], [114, 140]], label: 'kubectl rollout status --timeout', labelAt: 0.5, dashed: true, card: card(bi('Джоба ждёт, пока выкладка закончится, и падает, если не закончилась за отведённое время. Без этой строки джоба зелёная сразу после set image — что бы ни случилось с подами.', 'The job waits for the rollout to finish and fails if it did not finish in time. Without this line the job is green right after set image, whatever happens to the pods.'), bi('Скрипт джобы.', 'The job script.'), 'kubectl rollout status deployment/web --timeout=120s') },
      { id: 'e-commit', from: 'job', to: 'cfg', via: [[270, 100], [270, 310], [430, 310]], label: bi('git commit тега', 'git commit of the tag'), labelAt: 0.7, card: card(bi('В pull-модели джоба меняет одну строку в репозитории конфигурации и отправляет коммит. Ключа от кластера у CI нет вовсе.', 'In the pull model the job changes one line in the configuration repository and pushes a commit. CI has no cluster key at all.'), bi('Скрипт джобы.', 'The job script.')) },
      { id: 'e-pull', from: 'agent', to: 'cfg', label: bi('читает', 'reads'), card: card(bi('Агент сам опрашивает репозиторий (или получает вебхук) и сравнивает записанное с кластером.', 'The agent polls the repository by itself (or gets a webhook) and compares what is written with the cluster.'), bi('Агент GitOps.', 'The GitOps agent.')) },
      { id: 'e-apply', from: 'agent', to: 'api', via: [[710, 290], [415, 290]], label: bi('применяет', 'applies'), labelAt: 0.4, card: card(bi('Разницу агент применяет изнутри кластера, своим сервисным аккаунтом.', 'The agent applies the difference from inside the cluster with its own service account.'), bi('Агент GitOps.', 'The GitOps agent.')) },
    ],
  },
  params: [
    {
      id: 'mode',
      label: bi('Модель выкладки', 'Deployment model'),
      kind: 'choice',
      default: 'push',
      options: [
        { id: 'push', label: bi('push: kubectl в джобе', 'push: kubectl in the job') },
        { id: 'pull', label: bi('pull: коммит в конфигурацию', 'pull: a commit to the config') },
      ],
      near: 'agent',
      predict: {
        prompt: bi('В pull-модели нужна ли джобе переменная KUBECONFIG?', 'In the pull model, does the job need the KUBECONFIG variable?'),
        options: [
          { id: 'no', text: bi('Нет: в кластер ходит агент изнутри', 'No: the agent goes to the cluster from inside') },
          { id: 'yes', text: bi('Да, как и в push', 'Yes, as in push') },
        ],
        resolve: (_p, n) => (n.some((s) => s.focus.includes('e-key')) ? 'yes' : 'no'),
      },
    },
    {
      id: 'tag',
      label: bi('Тег образа', 'Image tag'),
      kind: 'choice',
      default: 'sha',
      options: [
        { id: 'sha', label: bi(':$CI_COMMIT_SHORT_SHA', ':$CI_COMMIT_SHORT_SHA') },
        { id: 'latest', label: bi(':latest и kubectl apply', ':latest and kubectl apply') },
      ],
      near: 'reg',
      predict: {
        prompt: bi('Образ всегда собирается как :latest, а джоба делает kubectl apply того же манифеста. Появятся ли новые поды?', 'The image is always built as :latest, and the job runs kubectl apply of the same manifest. Will new pods appear?'),
        options: [
          { id: 'no', text: bi('Нет: Deployment не изменился — выкладки нет', 'No: the Deployment did not change, so there is no rollout') },
          { id: 'yes', text: bi('Да: образ ведь новый', 'Yes: the image is new, after all') },
        ],
        resolve: (_p, n) => (metric(n, 'newPods') > 0 ? 'yes' : 'no'),
      },
    },
    {
      id: 'wait',
      label: bi('rollout status в джобе', 'rollout status in the job'),
      kind: 'toggle',
      default: true,
      near: 'job',
    },
  ],
  breaks: [
    {
      id: 'crash',
      label: bi('Новый образ падает при старте', 'The new image crashes on start'),
      remove: ['e-old'],
      predict: {
        prompt: bi('Новая версия падает через три секунды после старта. Какого цвета будет пайплайн?', 'The new version crashes three seconds after it starts. What colour will the pipeline be?'),
        options: [
          { id: 'red', text: bi('Красный, если джоба ждёт выкладку', 'Red, if the job waits for the rollout') },
          { id: 'green', text: bi('Зелёный в любом случае', 'Green in any case') },
          { id: 'redAlways', text: bi('Красный в любом случае', 'Red in any case') },
        ],
        resolve: () => 'red',
      },
    },
    {
      id: 'forbidden',
      label: bi('У аккаунта deployer нет права patch', 'The deployer account has no patch right'),
      remove: ['e-store'],
      predict: {
        prompt: bi('Роль deployer разрешает get и list, но не patch. Что ответит API-сервер на kubectl set image?', 'The deployer role allows get and list, but not patch. What does the API server answer to kubectl set image?'),
        options: [
          { id: 'forbidden', text: bi('Forbidden: пользователю это не разрешено', 'Forbidden: the user is not allowed to') },
          { id: 'ok', text: bi('Выполнит: kubeconfig ведь есть', 'It does it: there is a kubeconfig after all') },
        ],
        resolve: () => 'forbidden',
      },
    },
  ],
  metrics: [
    { id: 'newPods', label: bi('готовых подов новой версии', 'ready pods of the new version') },
    { id: 'oldPods', label: bi('подов прежней версии', 'pods of the previous version') },
    { id: 'jobOk', label: bi('джоба выкладки зелёная (1/0)', 'deploy job green (1/0)') },
  ],
  run(p, broken) {
    const pull = p.mode === 'pull';
    const latest = p.tag === 'latest';
    const tag = latest ? 'latest' : '1a2b3c4d';
    const steps: Step[] = [
      { id: 'image', label: 'image', caption: latest ? bi('Стадия build собрала образ и отправила его как site:latest — тот же тег, что и в прошлый раз.', 'The build stage built the image and pushed it as site:latest, the same tag as last time.') : bi('Стадия build собрала образ и отправила его как site:1a2b3c4d — тег коммита, неизменяемое имя этой версии.', 'The build stage built the image and pushed it as site:1a2b3c4d, the commit tag: the unchanging name of this version.'), focus: ['reg', 'e-img', 'job'], tokens: [{ edge: 'e-img', label: `:${tag}` }], states: { reg: 'ok', rsOld: 'ok', cfg: pull ? 'on' : 'off', agent: pull ? 'on' : 'off', kcfg: pull ? 'off' : 'on' }, values: { reg: `site:${tag}`, dep: 'image: site:0f9e8d7c', rsOld: '3/3', rsNew: '0/3' }, metrics: { newPods: 0, oldPods: 3, jobOk: 0 } },
    ];
    if (pull) {
      steps.push(
        { id: 'commit', label: 'git push', caption: latest ? bi('Джоба пишет в values.yaml тег latest — тот же, что уже записан. Коммита нет: изменять нечего.', 'The job writes the tag latest into values.yaml, the same one already there. No commit: nothing to change.') : bi('Джоба меняет в deploy/values.yaml строку tag: 1a2b3c4d и отправляет коммит. Джоба зелёная: её работа — записать желаемое.', 'The job changes the line tag: 1a2b3c4d in deploy/values.yaml and pushes a commit. The job is green: its work is to record the desired state.'), focus: ['e-commit', 'cfg'], tokens: latest ? [] : [{ edge: 'e-commit', label: 'tag: 1a2b3c4d' }], states: { job: 'ok', cfg: latest ? 'on' : 'ok' }, values: { cfg: `tag: ${latest ? 'latest' : '1a2b3c4d'}` }, metrics: { newPods: 0, oldPods: 3, jobOk: 1 } },
        { id: 'sync', label: 'sync', caption: latest ? bi('Агент сравнивает репозиторий с кластером: разницы нет, синхронизировать нечего. Новых подов не будет.', 'The agent compares the repository with the cluster: there is no difference, nothing to sync. No new pods.') : bi('Агент видит новый коммит, сравнивает с кластером и применяет разницу изнутри — своим аккаунтом.', 'The agent sees the new commit, compares it with the cluster and applies the difference from inside, with its own account.'), focus: ['e-pull', 'agent', 'e-apply', 'api'], tokens: latest ? [] : [{ edge: 'e-apply', label: 'image: site:1a2b3c4d' }], states: { agent: 'ok', api: latest ? 'on' : 'ok' } },
      );
      if (latest) {
        steps.push({ id: 'same', label: bi('без изменений', 'unchanged'), caption: bi('Deployment не изменился, ReplicaSet прежний: «выкладка» прошла, а версия на staging старая. Тег, который переезжает, не виден ни Git, ни Kubernetes.', 'The Deployment did not change, the ReplicaSet is the old one: the "deployment" passed and staging runs the old version. A tag that moves is invisible to both Git and Kubernetes.'), focus: ['dep', 'rsOld'], states: { dep: 'warn' }, metrics: { newPods: 0, oldPods: 3, jobOk: 1 } });
        return steps;
      }
      steps.push({ id: 'roll', label: 'rollout', caption: bi('Дальше всё как всегда: новый шаблон пода, новый ReplicaSet, поды по одному.', 'From here on it is as always: a new pod template, a new ReplicaSet, pods one by one.'), focus: ['e-store', 'dep', 'e-roll', 'rsNew'], tokens: [{ edge: 'e-roll' }], states: { dep: 'ok', rsNew: broken.has('crash') ? 'err' : 'ok', rsOld: broken.has('crash') ? 'ok' : 'off' }, values: { dep: 'image: site:1a2b3c4d', rsNew: broken.has('crash') ? '0/3 CrashLoopBackOff' : '3/3', rsOld: broken.has('crash') ? '2/3' : '0/3' }, metrics: { newPods: broken.has('crash') ? 0 : 3, oldPods: broken.has('crash') ? 2 : 0, jobOk: 1 } });
      if (broken.has('crash'))
        steps.push({ id: 'degraded', label: 'Degraded', caption: bi('Пайплайн давно зелёный: CI не знает, что было дальше. О поломке говорит агент — приложение Degraded, — и откатывают её коммитом revert в репозиторий конфигурации.', 'The pipeline has long been green: CI does not know what happened next. The agent reports the breakage (the application is Degraded), and it is rolled back with a revert commit to the configuration repository.'), focus: ['agent', 'rsNew'], states: { agent: 'err' }, metrics: { newPods: 0, oldPods: 2, jobOk: 1 }, broken: { at: 'rsNew', message: 'web  Synced  Degraded  Back-off restarting failed container web in pod web-6mzdx…', caption: bi('в pull-модели здоровье выкладки показывает агент, а откат — это коммит.', 'in the pull model the agent shows the rollout’s health, and a rollback is a commit.') } });
      return steps;
    }
    steps.push({ id: 'key', label: 'KUBECONFIG', caption: bi('Раннер пишет File-переменную во временный файл; kubectl находит ключ deployer по $KUBECONFIG.', 'The runner writes the File variable to a temporary file; kubectl finds the deployer key through $KUBECONFIG.'), focus: ['kcfg', 'e-key', 'job'], tokens: [{ edge: 'e-key' }], states: { kcfg: 'ok', job: 'on' } });
    if (broken.has('forbidden')) {
      steps.push({ id: 'denied', label: '403', caption: bi('API-сервер узнаёт аккаунт deployer и проверяет его роль: get и list есть, patch нет. Отказ; Deployment не тронут.', 'The API server recognises the deployer account and checks its role: get and list are there, patch is not. Refused; the Deployment is untouched.'), focus: ['e-set', 'api'], tokens: [{ edge: 'e-set', label: 'PATCH' }], states: { api: 'err', job: 'err' }, metrics: { newPods: 0, oldPods: 3, jobOk: 0 }, broken: { at: 'e-store', message: 'Error from server (Forbidden): deployments.apps "web" is forbidden: User "system:serviceaccount:staging:deployer" cannot patch resource "deployments" in API group "apps" in the namespace "staging"', caption: bi('добавьте роли глагол patch для deployments — именно его, а не cluster-admin.', 'add the patch verb for deployments to the role: that verb, not cluster-admin.') } });
      return steps;
    }
    if (latest) {
      steps.push(
        { id: 'apply', label: 'kubectl apply', caption: bi('kubectl apply того же манифеста: в нём по-прежнему site:latest. API-сервер сравнивает и отвечает «unchanged».', 'kubectl apply of the same manifest: it still says site:latest. The API server compares and answers "unchanged".'), focus: ['e-set', 'api', 'dep'], tokens: [{ edge: 'e-set', label: 'apply' }], states: { api: 'ok', dep: 'warn', job: 'ok' }, values: { dep: 'image: site:latest' } },
        { id: 'same', label: bi('без изменений', 'unchanged'), caption: bi('Шаблон пода не изменился — нового ReplicaSet нет. Джоба зелёная, а на staging старая версия: deployment.apps/web unchanged.', 'The pod template did not change, so there is no new ReplicaSet. The job is green, and staging runs the old version: deployment.apps/web unchanged.'), focus: ['rsOld', 'rsNew'], states: { rsNew: 'off' }, metrics: { newPods: 0, oldPods: 3, jobOk: 1 } },
      );
      return steps;
    }
    steps.push({ id: 'set', label: 'set image', caption: bi('kubectl set image меняет образ в шаблоне пода. Это новая ревизия Deployment.', 'kubectl set image changes the image in the pod template. This is a new revision of the Deployment.'), focus: ['e-set', 'api', 'e-store', 'dep'], tokens: [{ edge: 'e-set', label: 'site:1a2b3c4d' }], states: { api: 'ok', dep: 'ok' }, values: { dep: 'image: site:1a2b3c4d' } });
    const crash = broken.has('crash');
    steps.push({ id: 'roll', label: 'rollout', caption: crash ? bi('Новый ReplicaSet поднимает поды, они стартуют и через три секунды падают. Старые поды ещё обслуживают запросы, но контроллер уже начал их убирать.', 'The new ReplicaSet brings up pods; they start and crash three seconds later. The old pods still serve requests, but the controller has already begun removing them.') : bi('Новый шаблон — новый pod-template-hash — новый ReplicaSet. Новые поды готовы, старые уходят по одному.', 'A new template, a new pod-template-hash, a new ReplicaSet. New pods become ready, old ones leave one by one.'), focus: ['e-roll', 'rsNew', 'e-old', 'rsOld'], tokens: [{ edge: 'e-roll' }], states: { rsNew: crash ? 'err' : 'ok', rsOld: crash ? 'warn' : 'off' }, values: { rsNew: crash ? '0/3 CrashLoopBackOff' : '3/3', rsOld: crash ? '2/3' : '0/3' }, metrics: { newPods: crash ? 0 : 3, oldPods: crash ? 2 : 0, jobOk: p.wait ? 0 : 1 } });
    if (!p.wait) {
      steps.push(crash ? { id: 'green', label: bi('зелёная', 'green'), caption: bi('Джоба закончилась сразу после set image и зелёная. Сломанная версия на staging, а пайплайн говорит, что всё хорошо.', 'The job ended right after set image and is green. A broken version is on staging, and the pipeline says all is well.'), focus: ['job', 'rsNew'], states: { job: 'ok', rsNew: 'err' }, metrics: { newPods: 0, oldPods: 2, jobOk: 1 }, broken: { at: 'rsNew', message: 'pod/web-6mzdx-dr9ck   0/1   CrashLoopBackOff   3   2m', caption: bi('без rollout status пайплайн не знает, чем кончилась выкладка.', 'without rollout status the pipeline does not know how the rollout ended.') } } : { id: 'green', label: bi('зелёная', 'green'), caption: bi('Джоба закончилась сразу после set image. В этот раз выкладка удалась, но пайплайн об этом не знал — ему повезло.', 'The job ended right after set image. This time the rollout succeeded, but the pipeline did not know it: it was lucky.'), focus: ['job'], states: { job: 'ok' }, metrics: { newPods: 3, oldPods: 0, jobOk: 1 } });
      return steps;
    }
    if (crash) {
      steps.push(
        { id: 'timeout', label: 'timeout', caption: bi('kubectl rollout status ждёт 120 секунд, выкладка не заканчивается, джоба падает. Пайплайн красный.', 'kubectl rollout status waits 120 seconds, the rollout does not finish, the job fails. The pipeline is red.'), focus: ['e-wait', 'job'], tokens: [{ edge: 'e-wait', reverse: true }], states: { job: 'err' }, metrics: { newPods: 0, oldPods: 2, jobOk: 0 }, broken: { at: 'e-wait', message: 'Waiting for deployment "web" rollout to finish: 1 out of 3 new replicas have been updated...\nerror: timed out waiting for the condition\nERROR: Job failed: exit code 1', caption: bi('джоба с when: on_failure делает kubectl rollout undo — и staging возвращается к прежней ревизии.', 'a job with when: on_failure runs kubectl rollout undo, and staging returns to the previous revision.') } },
      );
      return steps;
    }
    steps.push({ id: 'done', label: 'rolled out', caption: bi('rollout status дождался: deployment "web" successfully rolled out. Джоба зелёная, и это правда.', 'rollout status waited it out: deployment "web" successfully rolled out. The job is green, and that is true.'), focus: ['e-wait', 'job'], tokens: [{ edge: 'e-wait', reverse: true }], states: { job: 'ok' }, metrics: { newPods: 3, oldPods: 0, jobOk: 1 } });
    return steps;
  },
  explainDelta(_prev, next, change, _a, b): Bi {
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломка убрана: выкладка снова доходит до конца.', 'The break is removed: the rollout completes again.');
      if (change.id === 'forbidden') return b.mode === 'pull' ? bi('В pull-модели CI в кластер не ходит: права deployer ему не нужны.', 'In the pull model CI does not go to the cluster: it does not need deployer’s rights.') : bi('API-сервер проверяет права аккаунта на каждый глагол: без patch нет и set image.', 'The API server checks the account’s rights for every verb: no patch, no set image.');
      return metric(next, 'jobOk') ? bi('Пайплайн зелёный, а версия падает: CI не дождался результата.', 'The pipeline is green while the version crashes: CI did not wait for the result.') : bi('rollout status превратил упавшую выкладку в красный пайплайн.', 'rollout status turned a failed rollout into a red pipeline.');
    }
    if (change.id === 'mode') return b.mode === 'pull' ? bi('Pull: CI только коммитит тег, а кластер меняет агент изнутри. Ключа от кластера в CI нет.', 'Pull: CI only commits the tag, and the agent changes the cluster from inside. CI holds no cluster key.') : bi('Push: джоба сама идёт в API-сервер со своим ключом.', 'Push: the job goes to the API server itself with its own key.');
    if (change.id === 'tag') return b.tag === 'latest' ? bi('С :latest текст Deployment не меняется — Kubernetes не видит новой версии.', 'With :latest the Deployment text does not change, so Kubernetes sees no new version.') : bi('Тег коммита меняет шаблон пода — и запускает выкладку.', 'A commit tag changes the pod template and so starts a rollout.');
    return b.wait ? bi('Джоба ждёт выкладку: её цвет снова говорит правду о staging.', 'The job waits for the rollout: its colour tells the truth about staging again.') : bi('Без ожидания джоба зелёная сразу после set image, что бы ни случилось дальше.', 'Without waiting the job is green right after set image, whatever happens next.');
  },
});
