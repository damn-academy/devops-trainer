// Process explainers of the Git and CI/CD blocks (06 §2.3 E-GIT, §3.4 E-CI).
// Small deterministic models: knobs recompute the run, breaks stop it where
// the real tool stops, with the real message.

import { defineModel } from '../../core/define';
import { bi, fmt, type Bi } from '../../core/i18n';
import type { DocRef, ElementCard, Step } from '../../core/types';
import { objectId } from './git/sha1';

export const card = (what: Bi, who: Bi, see?: string, doc?: DocRef): ElementCard => ({ what, who, see, doc });
const short = (oid: string) => oid.slice(0, 7);
const last = (s: Step[]) => s[s.length - 1]?.metrics ?? {};

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

export const gitModel = defineModel<GitP>({
  id: 'git.commit-push',
  block: 'git-yaml',
  title: bi('Что делают git add, git commit и git push', 'What git add, git commit and git push do'),
  summary: bi(
    'Файл становится объектом-blob, индекс собирает снимок, коммит запоминает снимок и родителя, ветка переезжает на новый коммит, push отправляет недостающие объекты на forge.',
    'A file becomes a blob object, the index collects a snapshot, a commit records the snapshot and its parent, the branch moves to the new commit, and push sends the missing objects to the forge.',
  ),
  concepts: ['git.commit', 'git.index', 'git.branch'],
  diagram: {
    width: 960,
    height: 440,
    nodes: [
      { id: 'file', label: 'index.html', sub: 'working tree', family: 'ci-source', shape: 'doc', x: 24, y: 40, w: 168, h: 64, card: card(bi('Обычный файл в рабочем каталоге. Его правит редактор; Git о правке узнаёт, только сравнив файл с индексом.', 'An ordinary file in the working directory. An editor changes it; Git learns about the change only by comparing the file with the index.'), bi('Вы, редактором.', 'You, with an editor.'), 'git status', { page: 'man/git-status.1', anchor: 'DESCRIPTION' }) },
      { id: 'index', label: bi('индекс', 'index'), sub: `index.html → ${short(blobOld)}`, family: 'ci-build', shape: 'buffer', x: 272, y: 40, w: 200, h: 64, card: card(bi('Список «путь → blob» для следующего коммита. `git add` кладёт сюда текущее содержимое файла.', 'A list of "path → blob" for the next commit. `git add` puts the current content of a file here.'), bi('git add, git restore --staged, git commit -a.', 'git add, git restore --staged, git commit -a.'), 'git ls-files', { page: 'man/git-add.1', anchor: 'DESCRIPTION', line: 'snapshot' }) },
      { id: 'blob', label: 'blob', sub: short(blobNew), family: 'store', shape: 'box', x: 272, y: 176, w: 200, h: 56, card: card(bi('Содержимое файла как объект. Имя — SHA-1 от содержимого: одинаковые файлы — один blob, новая правка — новый blob, старый остаётся.', 'The file content as an object. Its name is the SHA-1 of the content: equal files share one blob, a new edit makes a new blob and the old one stays.'), bi('git add (git hash-object -w).', 'git add (git hash-object -w).'), `git cat-file -p ${short(blobNew)}`, { page: 'man/git-cat-file.1', anchor: 'OPTIONS' }) },
      { id: 'tree', label: 'tree', sub: '', family: 'store', shape: 'box', x: 544, y: 176, w: 176, h: 56, card: card(bi('Снимок каталога: имена файлов и хэши их blob (и вложенных tree). Неизменённые файлы ссылаются на прежние blob.', 'A snapshot of a directory: file names and the hashes of their blobs (and nested trees). Unchanged files point to the same blobs as before.'), bi('git commit, из индекса.', 'git commit, from the index.'), 'git cat-file -p HEAD^{tree}') },
      { id: 'commit', label: 'commit', sub: '', family: 'ci-source', shape: 'doc', x: 544, y: 40, w: 176, h: 64, card: card(bi('Объект: tree, родитель, автор, время, сообщение. Хэш коммита зависит от всего этого, поэтому история не подделывается тихо.', 'An object: tree, parent, author, time, message. The commit hash depends on all of it, so history cannot be changed quietly.'), bi('git commit.', 'git commit.'), 'git cat-file -p HEAD', { page: 'man/git-commit.1', anchor: 'DESCRIPTION' }) },
      { id: 'parent', label: bi('прошлый коммит', 'previous commit'), sub: '', family: 'neutral', shape: 'doc', x: 544, y: 300, w: 176, h: 56, card: card(bi('Коммит, на который указывала ветка до нового коммита. Цепочка родителей и есть история.', 'The commit the branch pointed to before. The chain of parents is the history.'), bi('Предыдущий git commit.', 'The previous git commit.'), 'git log --oneline') },
      { id: 'main', label: 'main', sub: 'refs/heads/main', family: 'ci-test', shape: 'pill', x: 792, y: 40, w: 144, h: 48, card: card(bi('Ветка — файл .git/refs/heads/main с одним хэшем. Новый коммит переписывает этот файл.', 'A branch is the file .git/refs/heads/main with one hash. A new commit rewrites that file.'), bi('git commit, git merge, git reset двигают её.', 'git commit, git merge, git reset move it.'), 'cat .git/refs/heads/main', { page: 'man/git-branch.1', anchor: 'DESCRIPTION' }) },
      { id: 'head', label: 'HEAD', sub: 'ref: refs/heads/main', family: 'ci-test', shape: 'pill', x: 792, y: 140, w: 144, h: 48, card: card(bi('«Я здесь»: указатель на текущую ветку. git switch переписывает HEAD.', '"You are here": a pointer to the current branch. git switch rewrites HEAD.'), bi('git switch, git checkout.', 'git switch, git checkout.'), 'cat .git/HEAD', { page: 'man/git-switch.1', anchor: 'DESCRIPTION' }) },
      { id: 'forge', label: 'forge.edu', sub: 'team/site.git', family: 'cp', shape: 'rack', x: 792, y: 300, w: 144, h: 96, card: card(bi('Удалённый репозиторий: такой же набор объектов и веток, но на сервере команды.', 'The remote repository: the same set of objects and branches, on the team server.'), bi('Создаёт команда; наполняет git push.', 'The team creates it; git push fills it.'), 'git remote -v', { page: 'man/git-push.1', anchor: 'DESCRIPTION' }) },
    ],
    edges: [
      { id: 'e-add', from: 'file', to: 'index', label: 'git add', card: card(bi('Содержимое файла сжимается в blob, его хэш записывается в индекс под путём файла.', 'The file content becomes a blob and its hash is written into the index under the file path.'), bi('Вы.', 'You.'), 'git add index.html', { page: 'man/git-add.1', anchor: 'DESCRIPTION' }) },
      { id: 'e-blob', from: 'index', to: 'blob', label: bi('хэш содержимого', 'content hash'), card: card(bi('Индекс хранит не текст, а ссылку на blob.', 'The index holds not the text but a reference to the blob.'), bi('git add.', 'git add.'), 'git ls-files -s') },
      { id: 'e-tree', from: 'blob', to: 'tree', label: bi('имя → blob', 'name → blob'), card: card(bi('Tree перечисляет файлы снимка с хэшами их blob.', 'The tree lists the files of the snapshot with their blob hashes.'), bi('git commit.', 'git commit.')) },
      { id: 'e-snap', from: 'tree', to: 'commit', label: 'tree <oid>', card: card(bi('Коммит указывает на один корневой tree — весь снимок проекта.', 'A commit points to one root tree: the whole project snapshot.'), bi('git commit.', 'git commit.'), 'git cat-file -p HEAD') },
      { id: 'e-parent', from: 'commit', to: 'parent', via: [[632, 150], [632, 150]], label: 'parent <oid>', labelAt: 0.75, dashed: true, card: card(bi('Ссылка на родителя: история — цепочка коммитов назад во времени.', 'A link to the parent: history is a chain of commits back in time.'), bi('git commit берёт его из HEAD.', 'git commit takes it from HEAD.'), 'git log --oneline') },
      { id: 'e-ref', from: 'main', to: 'commit', label: bi('41 байт: хэш', '41 bytes: a hash'), card: card(bi('Ветка просто хранит хэш последнего коммита.', 'A branch just stores the hash of its last commit.'), bi('git commit переписывает файл ветки.', 'git commit rewrites the branch file.'), 'cat .git/refs/heads/main') },
      { id: 'e-head', from: 'head', to: 'main', label: 'ref: refs/heads/main', card: card(bi('HEAD указывает на ветку, а не на коммит: поэтому новый коммит двигает ветку.', 'HEAD points to the branch, not to a commit: that is why a new commit moves the branch.'), bi('git switch.', 'git switch.'), 'cat .git/HEAD') },
      { id: 'e-push', from: 'commit', to: 'forge', via: [[760, 72], [760, 348]], label: 'git push (HTTPS)', labelAt: 0.5, card: card(bi('Push отправляет объекты, которых нет на сервере, и просит передвинуть там ветку. Сервер соглашается, только если новый коммит продолжает его историю.', 'Push sends the objects the server lacks and asks it to move its branch. The server agrees only if the new commit continues its history.'), bi('Вы: git push.', 'You: git push.'), 'git push origin main', { page: 'man/git-push.1', anchor: 'DESCRIPTION', line: 'fast-forward' }) },
    ],
  },
  params: [
    {
      id: 'files',
      label: bi('Файлов в проекте', 'Files in the project'),
      kind: 'range',
      min: 1,
      max: 20,
      step: 1,
      default: 6,
      near: 'tree',
      predict: {
        prompt: bi('В проекте стало 20 файлов, изменён по-прежнему один. Сколько новых объектов создаст коммит?', 'The project now has 20 files and still one changed. How many new objects will the commit create?'),
        options: [
          { id: 'three', text: bi('Три: blob, tree и commit', 'Three: a blob, a tree and a commit') },
          { id: 'many', text: bi('Двадцать два: по blob на каждый файл плюс tree и commit', 'Twenty-two: a blob per file plus a tree and a commit') },
        ],
        resolve: (_p, n) => ((last(n).objects ?? 0) === 3 ? 'three' : 'many'),
      },
    },
    {
      id: 'editAfterAdd',
      label: bi('Правка файла после git add', 'Edit the file after git add'),
      kind: 'toggle',
      default: false,
      near: 'index',
      predict: {
        prompt: bi('Файл добавлен в индекс, потом изменён ещё раз. Какая версия попадёт в коммит?', 'The file was added to the index and then edited again. Which version goes into the commit?'),
        options: [
          { id: 'old', text: bi('Та, что была на момент git add', 'The one at the moment of git add') },
          { id: 'new', text: bi('Последняя, из рабочего каталога', 'The latest one, from the working directory') },
        ],
        resolve: (_p, n) => (n.some((s) => s.id === 'edit2') ? 'old' : 'new'),
      },
    },
  ],
  breaks: [
    {
      id: 'empty-message',
      label: bi('Коммит без сообщения', 'A commit without a message'),
      remove: ['commit', 'e-snap'],
      predict: {
        prompt: bi('Сообщение коммита пустое. Что сделает Git?', 'The commit message is empty. What does Git do?'),
        options: [
          { id: 'abort', text: bi('Откажется создавать коммит', 'Refuses to create the commit') },
          { id: 'auto', text: bi('Подставит сообщение сам', 'Fills in a message itself') },
        ],
        resolve: () => 'abort',
      },
    },
    {
      id: 'remote-ahead',
      label: bi('На forge уже есть чужой коммит', 'The forge already has someone else’s commit'),
      remove: ['e-push'],
      predict: {
        prompt: bi('Пока вы работали, коллега отправил свой коммит в main. Что ответит forge на ваш git push?', 'While you worked, a colleague pushed a commit to main. What does the forge answer to your git push?'),
        options: [
          { id: 'reject', text: bi('Отклонит push: сначала заберите его коммит', 'Rejects the push: fetch their commit first') },
          { id: 'overwrite', text: bi('Примет, а коммит коллеги пропадёт', 'Accepts it and the colleague’s commit is lost') },
          { id: 'merge', text: bi('Сам сольёт оба коммита', 'Merges both commits by itself') },
        ],
        resolve: () => 'reject',
      },
    },
  ],
  metrics: [
    { id: 'objects', label: bi('новых объектов', 'new objects') },
    { id: 'reused', label: bi('blob взято без изменений', 'blobs reused as is') },
    { id: 'sent', label: bi('объектов отправлено', 'objects sent') },
  ],
  run(p, broken) {
    const c = gitCounts(p);
    const commitOid = objectId('commit', `tree 0\nparent 0\n\nSay hello to the team\n${p.files}`);
    const steps: Step[] = [
      { id: 'edit', label: bi('правка', 'edit'), caption: bi('Вы правите index.html в редакторе. Для Git это пока просто файл, который отличается от индекса.', 'You edit index.html in an editor. For Git it is just a file that differs from the index.'), focus: ['file'], states: { file: 'warn' }, values: { file: 'modified' } },
      { id: 'add', label: 'git add', caption: fmt(bi('git add считает SHA-1 содержимого и сохраняет blob {b}. Старый blob {o} никуда не делся.', 'git add hashes the content and stores blob {b}. The old blob {o} is still there.'), { b: short(blobNew), o: short(blobOld) }), focus: ['e-add', 'blob', 'e-blob'], tokens: [{ edge: 'e-add', label: short(blobNew) }], states: { blob: 'on' }, values: { index: `index.html → ${short(blobNew)}` }, fill: { index: 0.5 } },
    ];
    if (p.editAfterAdd)
      steps.push({
        id: 'edit2',
        label: bi('ещё правка', 'edit again'),
        caption: bi('Вы правите файл ещё раз. В индексе остался blob с прошлой версией: git status покажет файл и в «Changes to be committed», и в «Changes not staged».', 'You edit the file again. The index still holds the blob of the previous version: git status shows the file both under "Changes to be committed" and "Changes not staged".'),
        focus: ['file', 'index'],
        states: { file: 'warn', index: 'warn' },
        values: { file: 'modified again' },
      });
    if (broken.has('empty-message')) {
      steps.push({ id: 'abort', label: 'git commit', caption: bi('Сообщение пустое: Git отказывается записывать коммит. Индекс и blob остаются как были.', 'The message is empty: Git refuses to write the commit. The index and the blob stay as they were.'), focus: ['index'], states: { commit: 'off' }, metrics: { objects: 1, reused: c.reused, sent: 0 }, broken: { at: 'commit', message: 'Aborting commit due to empty commit message.', caption: bi('коммиту нужно сообщение: это объяснение изменения для тех, кто будет читать историю.', 'a commit needs a message: it explains the change to whoever reads the history.') } });
      return steps;
    }
    steps.push(
      { id: 'tree', label: 'tree', caption: fmt(bi('git commit собирает из индекса tree: {n} файлов, из них {r} ссылаются на прежние blob — копий не делается.', 'git commit builds a tree from the index: {n} files, {r} of them point to their old blobs; nothing is copied.'), { n: p.files, r: c.reused }), focus: ['e-tree', 'tree'], tokens: [{ edge: 'e-tree' }], states: { tree: 'on' }, values: { tree: `${p.files} entries` } },
      { id: 'commit', label: 'commit', caption: bi('Коммит записывает tree, родителя, автора, время и сообщение. Его хэш — имя этого снимка.', 'The commit records the tree, the parent, the author, the time and the message. Its hash is the name of this snapshot.'), focus: ['e-snap', 'commit', 'e-parent', 'parent'], tokens: [{ edge: 'e-snap' }], states: { commit: 'ok' }, values: { commit: short(commitOid), parent: '4e1f0c2' }, metrics: { objects: c.newObjects, reused: c.reused, sent: 0 } },
      { id: 'ref', label: 'main →', caption: bi('Ветка main переезжает на новый коммит: в файл refs/heads/main записан новый хэш. HEAD по-прежнему указывает на main.', 'The main branch moves to the new commit: the new hash is written into refs/heads/main. HEAD still points to main.'), focus: ['main', 'e-ref', 'head', 'e-head'], states: { main: 'ok' }, values: { main: short(commitOid) } },
    );
    if (broken.has('remote-ahead')) {
      steps.push({ id: 'reject', label: 'git push', caption: bi('На forge в main есть коммит, которого у вас нет. Ваш коммит не продолжает историю сервера, поэтому forge отказывается двигать ветку.', 'The forge’s main has a commit you do not have. Your commit does not continue the server history, so the forge refuses to move the branch.'), focus: ['forge'], states: { forge: 'err', 'e-push': 'err' }, metrics: { objects: c.newObjects, reused: c.reused, sent: 0 }, broken: { at: 'e-push', message: ' ! [rejected]        main -> main (fetch first)\nerror: failed to push some refs to \'https://forge.edu/team/site.git\'', caption: bi('сначала git pull: заберите чужой коммит, слейте с вашим и отправьте снова.', 'git pull first: fetch their commit, merge it with yours and push again.') } });
      return steps;
    }
    steps.push(
      { id: 'push', label: 'git push', caption: fmt(bi('git push отправляет только то, чего на сервере нет: {n} объекта. Остальные {r} blob там уже лежат.', 'git push sends only what the server lacks: {n} objects. The other {r} blobs are already there.'), { n: c.newObjects, r: c.reused }), focus: ['e-push', 'forge'], tokens: [{ edge: 'e-push', label: `${c.newObjects} obj` }], states: { forge: 'on' } },
      { id: 'remote', label: 'origin/main', caption: bi('Forge проверяет, что новый коммит — потомок его main, и передвигает свою ветку. Теперь коммит видит вся команда.', 'The forge checks that the new commit descends from its main and moves its branch. Now the whole team sees the commit.'), focus: ['forge'], states: { forge: 'ok' }, values: { forge: `main → ${short(commitOid)}` }, metrics: { objects: c.newObjects, reused: c.reused, sent: c.newObjects } },
    );
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломка убрана: коммит и push снова доходят до конца.', 'The break is removed: commit and push complete again.');
      return change.id === 'empty-message' ? bi('Без сообщения коммит не создаётся: история остаётся прежней.', 'Without a message no commit is created: the history stays as it was.') : bi('Forge принимает push, только если ваш коммит продолжает его историю.', 'The forge accepts a push only if your commit continues its history.');
    }
    if (change.id === 'files') return fmt(bi('{a} → {b} файлов: новых объектов по-прежнему {n}, без изменений переиспользуется {r} blob. Git хранит снимки, но не копирует неизменённое.', '{a} → {b} files: still {n} new objects, {r} blobs reused unchanged. Git stores snapshots but never copies what did not change.'), { a: a.files, b: b.files, n: last(next).objects ?? 3, r: last(next).reused ?? 0 });
    void prev;
    return b.editAfterAdd ? bi('Правка после git add не попадает в индекс: в коммит уйдёт версия на момент add. Нужен ещё один git add.', 'An edit after git add is not in the index: the commit gets the version from the moment of add. Run git add again.') : bi('Без повторной правки в коммит попадает именно то, что вы добавили.', 'Without another edit the commit gets exactly what you added.');
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

export const ciModel = defineModel<CiP>({
  id: 'cicd.push-to-deploy',
  block: 'cicd',
  title: bi('От git push до работающей версии', 'From git push to a running version'),
  summary: bi('Forge читает файл пайплайна, раннеры забирают джобы, артефакт переходит от сборки к выкладке, образ уходит в реестр, staging обновляется сам, production — по решению человека.', 'The forge reads the pipeline file, runners pick up jobs, the artifact goes from build to deploy, the image goes to the registry, staging updates by itself and production on a human decision.'),
  concepts: ['cicd.runner', 'cicd.job', 'cicd.artifact', 'cicd.environment'],
  diagram: {
    width: 960,
    height: 470,
    nodes: [
      { id: 'dev', label: bi('ваш репозиторий', 'your repository'), sub: '1a2b3c4', family: 'ci-source', shape: 'doc', x: 16, y: 40, w: 160, h: 60, card: card(bi('Локальный репозиторий с коммитом и файлом .gitlab-ci.yml.', 'The local repository with the commit and the .gitlab-ci.yml file.'), bi('Вы.', 'You.'), 'git log --oneline -1') },
      { id: 'forge', label: 'forge', sub: 'team/site', family: 'cp', shape: 'hex', x: 240, y: 36, w: 168, h: 68, card: card(bi('Сервер репозиториев (здесь — учебный GitLab). На каждый push он читает файл пайплайна и создаёт джобы.', 'The repository server (a training GitLab here). On every push it reads the pipeline file and creates jobs.'), bi('Команда; работает всегда.', 'The team; always running.'), 'glab ci status') },
      { id: 'cfg', label: '.gitlab-ci.yml', sub: 'stages: build test deploy', family: 'obj', shape: 'doc', x: 240, y: 156, w: 168, h: 60, card: card(bi('Файл пайплайна в репозитории: стадии, джобы, скрипты, правила. Он меняется коммитом, как код.', 'The pipeline file in the repository: stages, jobs, scripts, rules. It changes by a commit, like code.'), bi('Вы пишете его, forge читает.', 'You write it, the forge reads it.'), 'glab ci lint', { url: 'https://docs.gitlab.com/ci/yaml/', label: 'docs.gitlab.com › CI/CD YAML syntax reference' }) },
      { id: 'queue', label: bi('очередь джоб', 'job queue'), sub: 'pending: 0', family: 'flow', shape: 'buffer', x: 472, y: 40, w: 172, h: 60, card: card(bi('Джобы со статусом pending ждут свободный раннер с подходящими тегами.', 'Jobs in the pending state wait for a free runner with matching tags.'), bi('Forge ставит, раннеры забирают.', 'The forge enqueues, runners take.'), 'glab ci view') },
      { id: 'runner', label: bi('раннер', 'runner'), sub: 'docker executor', family: 'node', shape: 'rack', x: 472, y: 160, w: 172, h: 92, card: card(bi('Отдельная машина с gitlab-runner. Сама спрашивает forge «есть работа?», запускает джобу в контейнере из image и отправляет лог.', 'A separate machine with gitlab-runner. It asks the forge "any work?" by itself, runs the job in a container from the image and sends back the log.'), bi('Администратор регистрирует раннер в проекте.', 'An administrator registers the runner with the project.'), 'gitlab-runner list', { url: 'https://docs.gitlab.com/runner/', label: 'docs.gitlab.com › GitLab Runner' }) },
      { id: 'art', label: bi('артефакты', 'artifacts'), sub: 'dist/', family: 'store', shape: 'buffer', x: 240, y: 300, w: 168, h: 60, card: card(bi('Файлы, которые джоба загрузила на forge. Следующие джобы скачивают их: так dist/ из сборки доходит до выкладки.', 'Files a job uploaded to the forge. Later jobs download them: that is how dist/ from the build reaches the deploy.'), bi('artifacts: в джобе сборки.', 'artifacts: in the build job.'), 'glab ci trace build', { url: 'https://docs.gitlab.com/ci/jobs/job_artifacts/', label: 'docs.gitlab.com › Job artifacts' }) },
      { id: 'reg', label: bi('реестр образов', 'image registry'), sub: 'site:1a2b3c4d', family: 'store', shape: 'buffer', x: 472, y: 320, w: 172, h: 60, card: card(bi('Хранилище образов. Тег по коммиту неизменяем: по нему всегда видно, что выкачено.', 'Image storage. A tag by commit never changes: it always tells what was deployed.'), bi('docker push из джобы.', 'docker push from a job.'), 'docker pull registry.forge.edu/team/site:1a2b3c4d') },
      { id: 'staging', label: 'staging', sub: '—', family: 'ci-deploy', shape: 'box', x: 760, y: 80, w: 180, h: 60, card: card(bi('Окружение для проверки: копия продакшена без настоящих пользователей. Обновляется автоматически из main.', 'An environment for checking: a copy of production without real users. Updated automatically from main.'), bi('Джоба deploy_staging с environment: staging.', 'The deploy_staging job with environment: staging.'), 'glab ci status', { url: 'https://docs.gitlab.com/ci/environments/', label: 'docs.gitlab.com › Environments' }) },
      { id: 'prod', label: 'production', sub: '—', family: 'ci-deploy', shape: 'box', x: 760, y: 300, w: 180, h: 60, card: card(bi('Окружение пользователей. С when: manual его обновляет человек кнопкой — это Continuous Delivery; без — Continuous Deployment.', 'The users’ environment. With when: manual a person updates it with a button (Continuous Delivery); without, it is Continuous Deployment.'), bi('Джоба deploy_production.', 'The deploy_production job.'), 'glab ci trigger deploy_production') },
    ],
    edges: [
      { id: 'e-push', from: 'dev', to: 'forge', label: 'git push', card: card(bi('Объекты и новая позиция ветки уходят на forge.', 'Objects and the new branch position go to the forge.'), bi('Вы.', 'You.'), 'git push') },
      { id: 'e-read', from: 'forge', to: 'cfg', label: bi('читает при каждом push', 'read on every push'), card: card(bi('Forge берёт .gitlab-ci.yml именно из того коммита, который пришёл, и по правилам решает, какие джобы создать.', 'The forge takes .gitlab-ci.yml from exactly the commit that arrived and decides by the rules which jobs to create.'), bi('Forge.', 'The forge.'), 'echo $CI_PIPELINE_SOURCE') },
      { id: 'e-enq', from: 'forge', to: 'queue', label: bi('джобы: pending', 'jobs: pending'), card: card(bi('Созданные джобы ставятся в очередь.', 'Created jobs are queued.'), bi('Forge.', 'The forge.')) },
      { id: 'e-poll', from: 'runner', to: 'queue', label: 'POST /api/v4/jobs/request', card: card(bi('Раннер сам опрашивает forge каждые несколько секунд: forge никогда не подключается к раннеру.', 'The runner polls the forge every few seconds by itself: the forge never connects to the runner.'), bi('gitlab-runner.', 'gitlab-runner.')) },
      { id: 'e-up', from: 'runner', to: 'art', via: [[420, 230]], label: bi('загрузка artifacts', 'artifacts upload'), labelAt: 0.4, card: card(bi('После успешной джобы раннер отправляет на forge пути из artifacts:paths.', 'After a successful job the runner uploads the paths from artifacts:paths to the forge.'), bi('gitlab-runner.', 'gitlab-runner.')) },
      { id: 'e-img', from: 'runner', to: 'reg', label: 'docker push :$CI_COMMIT_SHORT_SHA', card: card(bi('Джоба собирает образ и отправляет его в реестр с тегом коммита.', 'A job builds the image and pushes it to the registry tagged with the commit.'), bi('Скрипт джобы build-image.', 'The build-image job script.')) },
      { id: 'e-stg', from: 'reg', to: 'staging', via: [[700, 350], [700, 110]], label: bi('авто из main', 'automatic from main'), labelAt: 0.55, card: card(bi('Джоба deploy_staging запускается сама, когда прошли тесты.', 'The deploy_staging job starts by itself once the tests passed.'), bi('Forge по правилам.', 'The forge, by the rules.')) },
      { id: 'e-prod', from: 'staging', to: 'prod', label: bi('▶ решение человека', '▶ a human decision'), card: card(bi('Ручной шаг: when: manual. Убери строку — и выкладка станет автоматической.', 'The manual gate: when: manual. Remove the line and the deployment becomes automatic.'), bi('Человек с правами на окружение.', 'A person with rights on the environment.'), 'glab ci trigger deploy_production') },
    ],
  },
  params: [
    {
      id: 'branch',
      label: bi('Куда push', 'Push to'),
      kind: 'choice',
      default: 'main',
      options: [
        { id: 'main', label: bi('main', 'main') },
        { id: 'feature', label: bi('ветка feature', 'a feature branch') },
      ],
      near: 'cfg',
      predict: {
        prompt: bi('Push в ветку feature. Выкатится ли версия на staging?', 'A push to a feature branch. Will the version reach staging?'),
        options: [
          { id: 'no', text: bi('Нет: правило выкладки только для main', 'No: the deploy rule is for main only') },
          { id: 'yes', text: bi('Да, любой push выкладывает', 'Yes, every push deploys') },
        ],
        resolve: (_p, n) => (n.some((s) => s.id === 'staging') ? 'yes' : 'no'),
      },
    },
    { id: 'runners', label: bi('Свободных раннеров', 'Free runners'), kind: 'range', min: 1, max: 4, step: 1, default: 2, near: 'runner', predict: { prompt: bi('Остался один раннер. Что станет с временем пайплайна?', 'Only one runner is left. What happens to the pipeline time?'), options: [{ id: 'longer', text: bi('Вырастет: lint и test пойдут по очереди', 'It grows: lint and test run one after another') }, { id: 'same', text: bi('Не изменится', 'It stays the same') }], resolve: (prev, next) => ((last(next).total ?? 0) > (last(prev).total ?? 0) ? 'longer' : 'same') } },
    { id: 'cache', label: bi('Кэш зависимостей', 'Dependency cache'), kind: 'toggle', default: true, near: 'runner', predict: { prompt: bi('Кэш пропал. Что будет со сборкой?', 'The cache is gone. What happens to the build?'), options: [{ id: 'slow', text: bi('Пройдёт, но медленнее', 'It passes, but slower') }, { id: 'fail', text: bi('Упадёт', 'It fails') }], resolve: () => 'slow' } },
    { id: 'manual', label: bi('when: manual у production', 'when: manual on production'), kind: 'toggle', default: true, near: 'prod' },
  ],
  breaks: [
    { id: 'test-fails', label: bi('Тест падает', 'A test fails'), remove: ['e-img'], predict: { prompt: bi('Тест вернул код 1. Что будет с выкладкой?', 'A test returned exit code 1. What happens to the deployment?'), options: [{ id: 'stop', text: bi('Дальше не пойдёт: следующие стадии пропущены', 'It stops: the later stages are skipped') }, { id: 'go', text: bi('Выкатится, тест — только предупреждение', 'It deploys; the test is only a warning') }], resolve: () => 'stop' } },
    { id: 'no-artifact', label: bi('Артефакт не объявлен', 'The artifact is not declared'), remove: ['e-up', 'art'], predict: { prompt: bi('У сборки нет artifacts:paths. Что увидит следующая джоба?', 'The build has no artifacts:paths. What does the next job see?'), options: [{ id: 'missing', text: bi('Пустой каталог: dist/ нет', 'An empty directory: no dist/') }, { id: 'there', text: bi('dist/ на месте: тот же раннер', 'dist/ is there: same runner') }], resolve: () => 'missing' } },
    { id: 'no-runner', label: bi('Нет раннера с тегом docker', 'No runner with the docker tag'), remove: ['e-poll'], predict: { prompt: bi('Ни у одного раннера нет тега docker, а джоба его требует. Что с ней будет?', 'No runner has the docker tag the job needs. What happens to the job?'), options: [{ id: 'stuck', text: bi('Будет ждать в pending', 'It waits in pending') }, { id: 'any', text: bi('Возьмёт любой раннер', 'Any runner takes it') }, { id: 'fail', text: bi('Сразу упадёт с ошибкой', 'It fails at once') }], resolve: () => 'stuck' } },
    { id: 'no-secret', label: bi('Переменная DEPLOY_TOKEN не задана', 'DEPLOY_TOKEN is not set'), remove: ['e-stg'], predict: { prompt: bi('Секрета для выкладки нет в настройках проекта. Где сломается пайплайн?', 'The deploy secret is missing from the project settings. Where does the pipeline break?'), options: [{ id: 'deploy', text: bi('На джобе выкладки', 'At the deploy job') }, { id: 'push', text: bi('Push не примут', 'The push is refused') }], resolve: () => 'deploy' } },
  ],
  metrics: [
    { id: 'build', label: bi('сборка', 'build'), unit: 's' },
    { id: 'wait', label: bi('ожидание раннера', 'waiting for a runner'), unit: 's' },
    { id: 'total', label: bi('весь пайплайн', 'whole pipeline'), unit: 's' },
  ],
  run(p, broken) {
    const n = ciNumbers(p);
    const steps: Step[] = [
      { id: 'push', label: 'push', caption: bi('git push отправляет коммит 1a2b3c4 на forge.', 'git push sends commit 1a2b3c4 to the forge.'), focus: ['e-push', 'forge'], tokens: [{ edge: 'e-push', label: '1a2b3c4' }], states: { forge: 'on' } },
      { id: 'jobs', label: bi('джобы', 'jobs'), caption: p.branch === 'main' ? bi('Forge читает .gitlab-ci.yml из коммита: для main правила дают build, lint, test, build-image и обе выкладки.', 'The forge reads .gitlab-ci.yml from the commit: for main the rules give build, lint, test, build-image and both deploys.') : bi('Forge читает .gitlab-ci.yml: для ветки feature правила дают только build, lint и test — выкладок нет.', 'The forge reads .gitlab-ci.yml: for a feature branch the rules give only build, lint and test; no deploys.'), focus: ['e-read', 'cfg'], states: { cfg: 'ok' }, values: { cfg: p.branch === 'main' ? '6 jobs' : '3 jobs' } },
      { id: 'queue', label: 'pending', caption: bi('Джобы встают в очередь. Forge их не выполняет: он ждёт, пока раннер спросит работу.', 'The jobs are queued. The forge does not run them: it waits for a runner to ask for work.'), focus: ['e-enq', 'queue'], tokens: [{ edge: 'e-enq' }], values: { queue: 'pending: 1' }, fill: { queue: 0.4 } },
    ];
    if (broken.has('no-runner')) {
      steps.push({ id: 'stuck', label: 'stuck', caption: bi('Раннеры спрашивают работу, но джоба требует тег docker, а такого раннера нет. Джоба ждёт вечно.', 'Runners ask for work, but the job needs the docker tag and no runner has it. The job waits forever.'), focus: ['queue', 'runner'], states: { runner: 'off', queue: 'warn' }, fill: { queue: 0.8 }, metrics: { build: 0, wait: 0, total: 0 }, broken: { at: 'e-poll', message: "This job is stuck because you don't have any active runners online or available with any of these tags assigned to them: docker", caption: bi('теги джобы должны совпасть с тегами раннера; почините тег или зарегистрируйте раннер.', 'the job tags must match the runner tags; fix the tag or register a runner.') } });
      return steps;
    }
    steps.push({
      id: 'build',
      label: 'build',
      caption: p.cache
        ? fmt(bi('Раннер забирает build: тянет образ, клонирует репозиторий, достаёт кэш (npm ci — 9 с), выполняет скрипт. Всего {s} с.', 'A runner takes build: pulls the image, clones the repository, restores the cache (npm ci: 9 s), runs the script. {s} s in all.'), { s: n.build })
        : fmt(bi('Раннер забирает build: тянет образ, клонирует репозиторий; кэша нет, и npm ci качает всё заново — 52 с. Всего {s} с, но сборка успешна.', 'A runner takes build: pulls the image, clones the repository; there is no cache, so npm ci downloads everything: 52 s. {s} s in all, and the build still passes.'), { s: n.build }),
      focus: ['e-poll', 'runner'],
      tokens: [{ edge: 'e-poll', reverse: true }],
      states: { runner: 'on' },
      values: { queue: 'pending: 0', runner: 'build' },
      fill: { queue: 0 },
      metrics: { build: n.build, wait: 0, total: n.build },
    });
    if (broken.has('no-artifact')) {
      steps.push({ id: 'noart', label: 'test', caption: bi('Сборка прошла, но dist/ остался на её машине. Джоба test стартует на чистой машине — каталога нет.', 'The build passed, but dist/ stayed on its machine. The test job starts on a clean machine: the directory is not there.'), focus: ['runner'], states: { runner: 'err' }, metrics: { build: n.build, wait: n.queueWait, total: n.build + 3 }, broken: { at: 'art', message: '$ test -f dist/index.html\nERROR: Job failed: exit code 1', caption: bi('каждая джоба начинается на чистой машине; результат передают artifacts.', 'every job starts on a clean machine; artifacts carry results forward.') } });
      return steps;
    }
    steps.push(
      { id: 'artifact', label: 'artifacts', caption: bi('Раннер загружает dist/ на forge как артефакт. Следующие джобы скачают его — где бы они ни запустились.', 'The runner uploads dist/ to the forge as an artifact. Later jobs download it, wherever they run.'), focus: ['e-up', 'art'], tokens: [{ edge: 'e-up', label: 'dist/' }], states: { art: 'ok' }, fill: { art: 0.6 } },
      { id: 'test', label: 'lint + test', caption: n.queueWait ? fmt(bi('lint и test готовы одновременно, но раннер один: test ждёт {w} с.', 'lint and test are ready at the same time, but there is one runner: test waits {w} s.'), { w: n.queueWait }) : bi('lint и test идут параллельно на двух раннерах.', 'lint and test run in parallel on two runners.'), focus: ['runner', 'queue'], states: { runner: broken.has('test-fails') ? 'err' : 'ok' }, values: { runner: 'lint, test' }, metrics: { build: n.build, wait: n.queueWait, total: n.total - (p.branch === 'main' ? 16 : 0) } },
    );
    if (broken.has('test-fails')) {
      steps.push({ id: 'failed', label: 'failed', caption: bi('./test.sh вернул 1: джоба failed, а build-image и выкладки — skipped. Сломанная версия никуда не ушла.', './test.sh returned 1: the job failed, and build-image and the deploys are skipped. The broken version went nowhere.'), focus: ['runner'], states: { runner: 'err', reg: 'off', staging: 'off', prod: 'off' }, metrics: { build: n.build, wait: n.queueWait, total: n.total }, broken: { at: 'runner', message: '$ ./test.sh\nFAIL: index.html has no <h1>\nERROR: Job failed: exit code 1', caption: bi('код возврата не 0 → джоба failed → следующие стадии пропущены.', 'a non-zero exit code → the job failed → the later stages are skipped.') } });
      return steps;
    }
    if (p.branch !== 'main') {
      steps.push({ id: 'done', label: bi('готово', 'done'), caption: bi('Для ветки пайплайн на этом заканчивается: проверки зелёные, merge request можно ревьюить. Выкладка будет после слияния в main.', 'For a branch the pipeline ends here: the checks are green and the merge request can be reviewed. Deployment happens after the merge into main.'), focus: ['forge'], states: { forge: 'ok' }, metrics: { build: n.build, wait: n.queueWait, total: n.total } });
      return steps;
    }
    steps.push({ id: 'image', label: 'image', caption: bi('build-image собирает образ и отправляет в реестр с тегом коммита 1a2b3c4d — неизменяемое имя этой версии.', 'build-image builds the image and pushes it to the registry tagged with the commit, 1a2b3c4d: the unchanging name of this version.'), focus: ['e-img', 'reg'], tokens: [{ edge: 'e-img', label: ':1a2b3c4d' }], states: { reg: 'ok' }, fill: { reg: 0.5 } });
    if (broken.has('no-secret')) {
      steps.push({ id: 'nosecret', label: 'deploy', caption: bi('deploy_staging стартует, но DEPLOY_TOKEN пуст: скрипт выкладки отказывается работать без ключа.', 'deploy_staging starts, but DEPLOY_TOKEN is empty: the deploy script refuses to work without the key.'), focus: ['staging'], states: { staging: 'err' }, metrics: { build: n.build, wait: n.queueWait, total: n.total }, broken: { at: 'e-stg', message: '$ ./deploy.sh staging\ndeploy.sh: DEPLOY_TOKEN is not set\nERROR: Job failed: exit code 1', caption: bi('секрет живёт в настройках проекта (Settings → CI/CD → Variables), а не в репозитории.', 'a secret lives in the project settings (Settings → CI/CD → Variables), not in the repository.') } });
      return steps;
    }
    steps.push({ id: 'staging', label: 'staging', caption: bi('deploy_staging выкатывает образ на staging автоматически: тесты прошли, правило для main выполнено.', 'deploy_staging rolls the image out to staging automatically: the tests passed and the rule for main holds.'), focus: ['e-stg', 'staging'], tokens: [{ edge: 'e-stg', label: ':1a2b3c4d' }], states: { staging: 'ok' }, values: { staging: '1a2b3c4d' } });
    steps.push(
      p.manual
        ? { id: 'gate', label: '▶', caption: bi('Production ждёт кнопку: версия готова к выпуску, выпуск — решение человека. Это Continuous Delivery.', 'Production waits for the button: the version is ready to release, and releasing is a human decision. This is Continuous Delivery.'), focus: ['e-prod', 'prod'], states: { prod: 'wait' }, values: { prod: 'manual ▶' }, metrics: { build: n.build, wait: n.queueWait, total: n.total } }
        : { id: 'prod', label: 'production', caption: bi('Без when: manual production обновляется сам сразу после staging. Это Continuous Deployment.', 'Without when: manual production updates by itself right after staging. This is Continuous Deployment.'), focus: ['e-prod', 'prod'], tokens: [{ edge: 'e-prod', label: ':1a2b3c4d' }], states: { prod: 'ok' }, values: { prod: '1a2b3c4d' }, metrics: { build: n.build, wait: n.queueWait, total: n.total + 16 } },
    );
    return steps;
  },
  explainDelta(prev, next, change, a, b): Bi {
    if (change.kind === 'break') {
      if (!change.on) return bi('Поломка убрана: пайплайн снова доходит до конца.', 'The break is removed: the pipeline completes again.');
      const m: Record<string, Bi> = {
        'test-fails': bi('Код возврата 1 → джоба failed → следующие стадии skipped. Пайплайн и есть ворота.', 'Exit code 1 → the job failed → later stages skipped. The pipeline is the gate.'),
        'no-artifact': bi('Без artifacts файлы сборки остаются на её машине: каждая джоба начинается с чистого листа.', 'Without artifacts the build output stays on its machine: every job starts from a clean slate.'),
        'no-runner': bi('Forge не выполняет джобы сам; без подходящего раннера джоба просто ждёт.', 'The forge never runs jobs itself; without a matching runner the job just waits.'),
        'no-secret': bi('Секрет не в коде, а в настройках проекта; без него падает именно выкладка.', 'The secret is in the project settings, not in the code; without it the deploy is what fails.'),
      };
      return m[change.id] ?? bi('Пайплайн пересчитан.', 'The pipeline was recomputed.');
    }
    const t0 = last(prev).total ?? 0;
    const t1 = last(next).total ?? 0;
    if (change.id === 'runners') return fmt(bi('{a} → {b} раннеров: весь пайплайн {t0} → {t1} с. Параллельные джобы ждут свободный раннер.', '{a} → {b} runners: the whole pipeline {t0} → {t1} s. Parallel jobs wait for a free runner.'), { a: a.runners, b: b.runners, t0, t1 });
    if (change.id === 'cache') return b.cache ? bi('Кэш вернулся: npm ci 52 → 9 с. Кэш только ускоряет.', 'The cache is back: npm ci 52 → 9 s. A cache only speeds things up.') : bi('Без кэша npm ci качает всё заново: 9 → 52 с, но сборка успешна. Кэш может пропасть — сборка не должна от него зависеть.', 'Without the cache npm ci downloads everything again: 9 → 52 s, but the build passes. A cache may vanish; the build must not depend on it.');
    if (change.id === 'manual') return b.manual ? bi('С when: manual последний шаг — кнопка: Continuous Delivery.', 'With when: manual the last step is a button: Continuous Delivery.') : bi('Без when: manual production обновляется сам: Continuous Deployment. Разница — одна строка YAML.', 'Without when: manual production updates by itself: Continuous Deployment. The difference is one line of YAML.');
    return b.branch === 'main' ? bi('Push в main: правила добавляют сборку образа и выкладки.', 'A push to main: the rules add the image build and the deploys.') : bi('Push в ветку: правила оставляют только проверки, выкладок нет.', 'A push to a branch: the rules keep only the checks; no deploys.');
  },
});
