// Lesson "How to undo what you did" (git-yaml.undo): restore, reset with its
// three modes, the reflog that keeps "lost" commits reachable, revert for
// commits others already have, and the detached HEAD state. It stands after
// branches, because every undo command is explained as "where the branch name
// moves". The labs run on the git simulator, which keeps a real reflog.

import { bi } from '../../../core/i18n';
import type { Concept, Facts, Lesson, PlacementTask, QuizItem, Sources } from '../../../core/types';
import { PAGES, gitSetup, head, repo } from './common';

const S = {
  undo: { title: 'Pro Git — Git Basics: Undoing Things', url: 'https://git-scm.com/book/en/v2/Git-Basics-Undoing-Things' },
  reset: { title: 'Pro Git — Git Tools: Reset Demystified', url: 'https://git-scm.com/book/en/v2/Git-Tools-Reset-Demystified' },
  reflog: { title: 'git-reflog — Git documentation', url: 'https://git-scm.com/docs/git-reflog' },
  ruUndo: { title: 'Pro Git на русском — Операции отмены', url: 'https://git-scm.com/book/ru/v2/%D0%9E%D1%81%D0%BD%D0%BE%D0%B2%D1%8B-Git-%D0%9E%D0%BF%D0%B5%D1%80%D0%B0%D1%86%D0%B8%D0%B8-%D0%BE%D1%82%D0%BC%D0%B5%D0%BD%D1%8B' },
  ruReset: { title: 'Pro Git на русском — Раскрытие тайн reset', url: 'https://git-scm.com/book/ru/v2/%D0%98%D0%BD%D1%81%D1%82%D1%80%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D1%8B-Git-%D0%A0%D0%B0%D1%81%D0%BA%D1%80%D1%8B%D1%82%D0%B8%D0%B5-%D1%82%D0%B0%D0%B9%D0%BD-reset' },
};
const src = (en: { title: string; url: string }[], ru: { title: string; url: string }[]): Sources => ({ en, ru });

const L = 'git-yaml.undo';

export const undoConcepts: Concept[] = [
  { id: 'git.reset', term: bi('git reset', 'git reset'), scan: false, short: bi('Команда, которая передвигает имя текущей ветки на другой коммит. Флаг решает, что станет с индексом и файлами: --soft их не трогает, --mixed приводит к коммиту индекс, а --hard ещё и рабочий каталог.', 'Moves the name of the current branch to another commit; the flag decides what happens to the index and the files: --soft leaves them, --mixed resets the index, --hard the working directory too.'), introducedIn: L, docRef: { page: 'man/git-reset.1', anchor: 'DESCRIPTION' } },
  { id: 'git.reflog', term: bi('reflog', 'reflog'), scan: false, short: bi('Журнал перемещений HEAD и веток в вашем репозитории. По нему находят коммит, на который больше не указывает ни одна ветка, и записью вида HEAD@{2} возвращаются к нему.', 'The log of moves of HEAD and the branches in your repository: it finds a commit no branch points to, and HEAD@{2} gets back to it.'), introducedIn: L, docRef: { page: 'man/git-reflog.1', anchor: 'DESCRIPTION' } },
  { id: 'git.revert', term: bi('git revert', 'git revert'), scan: false, short: bi('Команда, которая записывает новый коммит с обратными изменениями. История не переписывается, поэтому так отменяют коммиты, которые уже есть у других людей.', 'Records a new commit with the reverse changes; the history is not rewritten, so this is how commits others already have are undone.'), introducedIn: L, docRef: { page: 'man/git-revert.1', anchor: 'DESCRIPTION' } },
  { id: 'git.detached', term: bi('detached HEAD', 'detached HEAD'), scan: false, short: bi('Состояние, в котором HEAD указывает прямо на коммит, а не на ветку. Репозиторий не сломан, но новый коммит в этом состоянии не попадает ни в одну ветку, пока вы её не создадите.', 'HEAD points straight at a commit, not at a branch. Nothing is broken, but a new commit made in this state belongs to no branch until you create one.'), introducedIn: L, docRef: { page: 'man/git-switch.1', anchor: 'OPTIONS', line: '--detach' } },
];

// ── setups ──

const MENU = '<!doctype html>\n<title>Menu</title>\n<h1>Menu</h1>\n<p>Espresso 2.50</p>\n';
const BROKEN_HOME = PAGES['index.html'].replace('<h1>Edu Cafe</h1>\n', '');

/** Three commits, then `git reset --hard HEAD~2` typed instead of HEAD~1: the menu commit "is gone". */
export const lostSetup = gitSetup(
  {
    repos: [
      {
        path: '~/site',
        commits: [
          { message: 'Add pages', files: PAGES },
          { message: 'Add the menu', files: { 'menu.html': MENU } },
          { message: 'Break the home page', files: { 'index.html': BROKEN_HOME } },
        ],
      },
    ],
  },
  { script: ['cd /home/learner/site && git reset --hard HEAD~2'] },
);

const pricesSetup = gitSetup({
  repos: [
    {
      path: '~/site',
      commits: [
        { message: 'Add pages', files: { ...PAGES, 'menu.html': MENU } },
        { message: 'Raise the prices', files: { 'menu.html': MENU.replace('2.50', '3.90') } },
        { message: 'Add contacts', files: { 'contacts.html': '<h1>Contacts</h1>\n' } },
      ],
    },
  ],
});

const detachedSetup = gitSetup(
  { repos: [{ path: '~/site', commits: [{ message: 'Add pages', files: PAGES }, { message: 'Say who we are', files: { 'about.html': PAGES['about.html'].replace('small team', 'small team of baristas') } }] }] },
  { script: ['cd /home/learner/site && git checkout HEAD~1 2>/dev/null && echo "<p>Since 2026.</p>" >> index.html && HOME=/home/learner git commit -a -m "Add the year"'] },
);

// ── fact helpers ──

const tipOf = (f: Facts, branch: string) => {
  const r = repo(f);
  const oid = r?.branches[branch];
  return r?.commits.find((c) => c.oid === oid);
};
const inHistory = (f: Facts, branch: string, message: string) => {
  const r = repo(f);
  if (!r) return false;
  const byOid = new Map(r.commits.map((c) => [c.oid, c]));
  for (let c = byOid.get(r.branches[branch] ?? ''); c; c = byOid.get(c.parents[0] ?? '')) if (c.message.trim() === message) return true;
  return false;
};

// ── quiz ──

export const undoQuiz: QuizItem[] = [
  {
    id: 'git.q.reset-modes',
    kind: 'match',
    concepts: ['git.reset'],
    prompt: bi('Вы выполнили `git reset HEAD~1` с разными флагами. Что станет с изменениями отменённого коммита?', 'You ran `git reset HEAD~1` with different flags. What happens to the changes of the undone commit?'),
    pairs: [
      { id: 'soft', left: 'git reset --soft HEAD~1', right: bi('остаются в индексе, готовые к новому коммиту', 'stay in the index, ready for a new commit') },
      { id: 'mixed', left: 'git reset HEAD~1', right: bi('остаются только в файлах рабочего каталога', 'stay only in the files of the working directory') },
      { id: 'hard', left: 'git reset --hard HEAD~1', right: bi('исчезают из файлов, но коммит можно найти через reflog', 'disappear from the files, but the commit can be found through the reflog'), why: bi('С флагом --hard Git приводит к выбранному коммиту и индекс, и файлы. Сам отменённый коммит при этом остаётся в каталоге .git, и git reflog его покажет.', 'With --hard Git brings both the index and the files to the chosen commit. The undone commit itself stays in .git, and git reflog shows it.') },
    ],
  },
  {
    id: 'git.q.hard-lost',
    kind: 'mcq',
    concepts: ['git.reset', 'git.reflog'],
    prompt: bi('После `git reset --hard HEAD~1` последний коммит пропал из вывода `git log`. Что с ним произошло?', 'After `git reset --hard HEAD~1` the last commit is gone from `git log`. What happened to it?'),
    options: [
      { id: 'kept', text: bi('Коммит лежит в каталоге .git, на него только перестала указывать ветка, и его видно в git reflog', 'The commit is in .git; the branch just stopped pointing at it, and git reflog shows it'), correct: true },
      { id: 'gone', text: bi('Git удалил коммит из каталога .git безвозвратно, и вернуть его можно только из копии репозитория у коллег или на сервере', 'Git deleted the commit from .git for good, and only a copy of the repository on a colleague’s machine or a server can bring it back'), why: bi('Команда reset передвигает имя ветки, а коммитов не удаляет. Коммит, на который никто не ссылается, Git уберёт только при сборке мусора, а записи reflog о таких коммитах по умолчанию хранятся 30 дней.', 'reset moves a branch name and deletes no commits. Git removes a commit nobody refers to only on garbage collection, and reflog entries for such commits are kept for 30 days by default.') },
      { id: 'index', text: bi('Изменения коммита перешли в индекс', 'The commit’s changes moved into the index'), why: bi('Так поступает флаг --soft. С флагом --hard Git приводит к выбранному коммиту и индекс, и файлы.', 'That is what --soft does. With --hard Git brings both the index and the files to the chosen commit.') },
    ],
  },
  {
    id: 'git.q.hard-really',
    kind: 'mcq',
    concepts: ['git.reset'],
    prompt: bi('Что после `git reset --hard` пропадает так, что вернуть его не поможет никакая команда Git?', 'What is lost after `git reset --hard` so that no Git command can bring it back?'),
    options: [
      { id: 'uncommitted', text: bi('Правки в файлах, которые не были записаны ни в один коммит', 'Edits in files that were never recorded in any commit'), correct: true },
      { id: 'commits', text: bi('Коммиты, которые шли после выбранного', 'The commits after the chosen one'), why: bi('Коммиты остаются в каталоге .git и находятся через git reflog.', 'The commits stay in .git and are found through git reflog.') },
      { id: 'branches', text: bi('Остальные ветки репозитория', 'The other branches of the repository'), why: bi('Команда reset двигает только текущую ветку, а остальные ветки не трогает.', 'reset moves only the current branch and leaves the others alone.') },
    ],
  },
  {
    id: 'git.q.detached',
    kind: 'mcq',
    concepts: ['git.detached'],
    prompt: bi('После `git checkout 5b2e09c` Git написал *You are in \'detached HEAD\' state*. Что это значит?', 'After `git checkout 5b2e09c` Git said *You are in \'detached HEAD\' state*. What does it mean?'),
    options: [
      { id: 'commit', text: bi('HEAD указывает прямо на коммит, а не на ветку, и новый коммит не попадёт ни в одну ветку, пока вы её не создадите', 'HEAD points straight at a commit, not at a branch, and a new commit belongs to no branch until you create one'), correct: true },
      { id: 'broken', text: bi('Репозиторий повреждён, потому что из каталога .git пропал файл с именем текущей ветки, и проект нужно склонировать заново, чтобы снова работать в ветке', 'The repository is damaged because the file naming the current branch vanished from .git, so the project must be cloned again before you can work on a branch'), why: bi('Ничего не повреждено. Ветки на месте, и командой git switch main можно вернуться на любую из них.', 'Nothing is damaged. The branches are in place, and git switch main returns to any of them.') },
      { id: 'deleted', text: bi('Ветка main удалена', 'The main branch was deleted'), why: bi('Команда checkout с хэшем только переносит HEAD на коммит и ни одну ветку не удаляет.', 'checkout with a hash only moves HEAD to the commit and deletes no branch.') },
    ],
  },
];

// ── lesson ──

const RU_THEORY = 'Чтобы выбрать команду отмены, вспомните три места, где хранится версия файла: рабочий каталог, [[git.index|индекс]] и историю коммитов. Вспомните и то, что [[git.branch|ветка]] служит подвижным именем, которое указывает на один коммит, а [[git.head|HEAD]] показывает, на какой ветке вы стоите. Команды отмены отличаются тем, какое из этих мест они меняют.\n\nКоманда `git restore` работает с файлами и историю не трогает. Без флага она возвращает файл в рабочем каталоге к версии из индекса, а с флагом `--staged` убирает файл из индекса. Об этом шла речь в уроке о репозитории.\n\nКоманда [[git.reset|git reset]] передвигает имя текущей ветки на другой коммит. Запись `git reset HEAD~1` означает «пусть ветка указывает на родителя текущего коммита», а `HEAD~2` означает родителя родителя. Флаг решает, что станет с двумя другими местами. С флагом `--soft` меняется только имя ветки, а индекс и файлы остаются прежними, поэтому изменения отменённого коммита оказываются в индексе и готовы к новому коммиту. Поэтому командой `git reset --soft HEAD~2` и следующим за ней `git commit` склеивают два последних коммита в один. Без флага, то есть с флагом `--mixed`, Git приводит к выбранному коммиту ещё и индекс, а правки остаются только в файлах. С флагом `--hard` Git приводит к выбранному коммиту и индекс, и рабочий каталог. Только этот вариант способен уничтожить работу, потому что правки, которые не были записаны ни в один коммит, пропадают насовсем.\n\n### Куда деваются коммиты после git reset --hard\n\nЧасто думают, что `git reset --hard` удаляет коммиты. Он их не удаляет. Коммит по-прежнему лежит в каталоге `.git`, но на него больше не указывает ни одна ветка, поэтому `git log` его не показывает. Каждое перемещение HEAD Git записывает в журнал, который называется [[git.reflog|reflog]], и команда `git reflog` печатает этот журнал, начиная с последнего шага:\n\n```\n3c9d1e2 (HEAD -> main) HEAD@{0}: reset: moving to HEAD~2\n8f41a7b HEAD@{1}: commit: Break the home page\n5b2e09c HEAD@{2}: commit: Add the menu\n3c9d1e2 HEAD@{3}: commit (initial): Add pages\n```\n\nЗапись `HEAD@{2}` означает «где был HEAD два шага назад», и её можно подставить в любую команду вместо хэша. Поэтому и `git reset --hard 5b2e09c`, и `git reset --hard HEAD@{2}` вернут ветку на коммит с меню. Журнал хранится только в вашем репозитории, и записи о коммитах, на которые не указывает ни одна ветка, Git по умолчанию держит 30 дней, а потом может убрать и сами коммиты. Значит, «потерянный» коммит можно вернуть ещё долго, а незакоммиченную правку, стёртую флагом `--hard`, не вернёт ничто.\n\n### Почему чужие коммиты отменяют командой revert\n\nКоманда `git reset` переписывает историю ветки, и с коммитами, которые есть только у вас, это безопасно. Но если коммит уже скопировали коллеги, у них он останется, и при следующем обмене работой вернётся в историю или приведёт к конфликту. Для таких коммитов есть команда [[git.revert|git revert]]. Она ничего не стирает, а записывает новый коммит с обратными изменениями: история только растёт, старый коммит остаётся на месте, а его действие отменено. Отменить можно и коммит из середины истории. Команда `git revert 5b2e09c` уберёт изменения только этого коммита, а более поздние оставит. Отсюда правило, о котором часто спрашивают на собеседованиях: коммит, который видел кто-то кроме вас, отменяют через revert, а reset оставляют для своей работы, которой ещё никто не видел.\n\n### Что значит detached HEAD\n\nОбычно HEAD указывает на ветку, а ветка на коммит. Но HEAD может указывать и прямо на коммит, например после `git checkout 5b2e09c` или `git switch --detach 5b2e09c`, когда вы хотите посмотреть, как проект выглядел раньше. Такое состояние называется [[git.detached|detached HEAD]], и Git сообщает о нём длинным английским текстом *You are in \'detached HEAD\' state*, то есть «HEAD отсоединён от ветки». Репозиторий при этом не сломан, и ветки не тронуты. Особенность у этого состояния одна: если в нём записать коммит, вперёд передвинется только HEAD, а ни одна ветка на новый коммит указывать не будет. Когда вы вернётесь на ветку командой `git switch main`, Git предупредит, что оставляет коммит без ветки (*you are leaving 1 commit behind*), и коммит останется только в reflog. Чтобы его сохранить, коммиту дают ветку: прямо в отсоединённом состоянии командой `git switch -c имя-ветки` или уже потом командой `git branch имя-ветки хэш`.';

const EN_THEORY = 'To choose an undo command, recall the three places a version of a file is kept: the working directory, the [[git.index|index]] and the commit history. Recall too that a [[git.branch|branch]] is a movable name pointing to one commit, and [[git.head|HEAD]] shows which branch you are on. Undo commands differ in which of these places they change.\n\n`git restore` works with files and does not touch the history. Without a flag it returns a file in the working directory to the version in the index; with `--staged` it takes the file out of the index. The lesson on the repository covered it.\n\n[[git.reset|git reset]] moves the name of the current branch to another commit. `git reset HEAD~1` means “let the branch point to the parent of the current commit”, and `HEAD~2` means the parent’s parent. The flag decides what happens to the other two places. With `--soft` only the branch name changes and the index and the files stay, so the changes of the undone commit end up in the index, ready for a new commit: that is why `git reset --soft HEAD~2` followed by `git commit` squashes the last two commits into one. Without a flag, that is with `--mixed`, Git also brings the index to the chosen commit, and the edits stay only in the files. With `--hard` Git brings both the index and the working directory to the chosen commit. Only this variant can destroy work, because edits never recorded in a commit are lost for good.\n\n### Where commits go after git reset --hard\n\nPeople often think `git reset --hard` deletes commits. It does not. The commit is still in `.git`; no branch points to it any more, so `git log` does not show it. Git writes every move of HEAD into a log called the [[git.reflog|reflog]], and `git reflog` prints it, starting from the last step:\n\n```\n3c9d1e2 (HEAD -> main) HEAD@{0}: reset: moving to HEAD~2\n8f41a7b HEAD@{1}: commit: Break the home page\n5b2e09c HEAD@{2}: commit: Add the menu\n3c9d1e2 HEAD@{3}: commit (initial): Add pages\n```\n\n`HEAD@{2}` means “where HEAD was two steps ago”, and you can put it into any command instead of a hash. So both `git reset --hard 5b2e09c` and `git reset --hard HEAD@{2}` return the branch to the menu commit. The log lives only in your repository, and Git keeps entries for commits no branch points to for 30 days by default, after which it may remove the commits themselves. So a “lost” commit can be brought back for a long time, while an uncommitted edit wiped by `--hard` can never be.\n\n### Why other people’s commits are undone with revert\n\n`git reset` rewrites the history of a branch, which is safe with commits only you have. But if colleagues already copied a commit, it stays with them, and the next exchange of work brings it back into the history or causes a conflict. For such commits there is [[git.revert|git revert]]. It erases nothing; it records a new commit with the reverse changes: the history only grows, the old commit stays in place, and its effect is undone. A commit from the middle of the history can be reverted too: `git revert 5b2e09c` removes the changes of exactly that commit and keeps the later ones. Hence the rule interviewers often ask about: a commit anyone but you has seen is undone with revert, and reset is kept for your own work nobody has seen yet.\n\n### What detached HEAD means\n\nUsually HEAD points to a branch, and the branch to a commit. But HEAD can also point straight to a commit, for example after `git checkout 5b2e09c` or `git switch --detach 5b2e09c`, when you want to see how the project looked before. This state is called [[git.detached|detached HEAD]], and Git reports it with a long English text, *You are in \'detached HEAD\' state*. The repository is not broken, and the branches are untouched. The state has one peculiarity: a commit made in it moves only HEAD forward, and no branch points to the new commit. When you go back to a branch with `git switch main`, Git warns that it leaves the commit without a branch (*you are leaving 1 commit behind*), and the commit stays only in the reflog. To keep it, give the commit a branch: right in the detached state with `git switch -c branch-name`, or later with `git branch branch-name hash`.';

export const undoLesson: Lesson = {
  id: L,
  block: 'git-yaml',
  title: bi('Как отменить сделанное в Git', 'How to undo things in Git'),
  summary: bi('Одни команды отмены меняют файлы, другие индекс, третьи имя ветки. Коммит после git reset --hard не пропадает, а коммит, который видели другие, отменяют новым коммитом через revert.', 'Undo commands differ in what they touch: the files, the index or the branch name. A commit does not vanish after git reset --hard, and a commit others have seen is undone with a new commit, git revert.'),
  introduces: ['git.reset', 'git.reflog', 'git.revert', 'git.detached'],
  uses: ['git.commit', 'git.index', 'git.branch', 'git.head'],
  tier: 'core',
  minutes: 35,
  sources: src([S.undo, S.reset, S.reflog], [S.ruUndo, S.ruReset]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Вечером вы хотели убрать из истории последний неудачный коммит и набрали `git reset --hard HEAD~2` вместо `HEAD~1`. Вместе с неудачным коммитом из вывода `git log` исчез и вчерашний коммит с меню кафе, и кажется, что работа потеряна. На самом деле Git почти ничего не забывает сразу, а отменить сделанное можно несколькими способами, которые отличаются тем, что они меняют. В этом уроке вы разберётесь, чем отличаются `git restore`, `git reset` и `git revert`, вернёте «потерянный» коммит по журналу перемещений и выясните, что значит пугающее сообщение про detached HEAD.',
        'In the evening you wanted to remove the last failed commit from the history and typed `git reset --hard HEAD~2` instead of `HEAD~1`. Together with the failed commit, yesterday’s commit with the café menu vanished from `git log`, and the work seems lost. In fact Git forgets almost nothing at once, and there are several ways to undo things that differ in what they change. In this lesson you sort out how `git restore`, `git reset` and `git revert` differ, bring a “lost” commit back from the log of moves and find out what the scary message about a detached HEAD means.',
      ),
    },
    { id: 'theory', kind: 'text', step: 'explain', title: bi('Что отменяет каждая команда', 'What each command undoes'), body: bi(RU_THEORY, EN_THEORY) },
    {
      id: 'choose',
      kind: 'callout',
      tone: 'note',
      title: bi('Какую команду выбрать', 'Which command to choose'),
      body: bi(
        '- Правку файла, которую ещё не добавили в индекс, отменяет `git restore файл`.\n- Лишний файл из индекса убирает `git restore --staged файл`, и правка в самом файле остаётся.\n- Последний коммит, который есть только у вас, отменяет `git reset --soft HEAD~1`, и его правки остаются в индексе.\n- Тот же коммит вместе с правками убирает `git reset --hard HEAD~1`.\n- Коммит, который уже есть у коллег, отменяет `git revert хэш`.\n- Неудачный `git reset` исправляют так: `git reflog` показывает, где была ветка, а `git reset --hard HEAD@{n}` возвращает её туда.',
        '- An edit not yet added to the index is undone by `git restore file`.\n- A file added to the index by mistake is taken out by `git restore --staged file`, and the edit in the file stays.\n- The last commit only you have is undone by `git reset --soft HEAD~1`, and its edits stay in the index.\n- The same commit together with its edits is removed by `git reset --hard HEAD~1`.\n- A commit colleagues already have is undone by `git revert hash`.\n- A failed `git reset` is fixed like this: `git reflog` shows where the branch was, and `git reset --hard HEAD@{n}` returns it there.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: lostSetup,
      intro: bi('В каталоге `~/site` только что выполнили `git reset --hard HEAD~2`, и коммит «Add the menu» исчез из `git log`. В истории до сброса было три коммита: «Add pages», «Add the menu» и «Break the home page», который сломал главную страницу.', 'In `~/site` someone has just run `git reset --hard HEAD~2`, and the commit “Add the menu” vanished from `git log`. Before the reset the history had three commits: “Add pages”, “Add the menu”, and “Break the home page”, which broke the home page.'),
      tasks: [
        {
          id: 'restore',
          prompt: bi('Верните ветку `main` на коммит «Add the menu», так чтобы страница меню вернулась, а сломанной главной страницы в ветке не было.', 'Return the `main` branch to the commit “Add the menu”, so that the menu page is back and the broken home page is not on the branch.'),
          check: {
            when: (f) => repo(f)?.branch === 'main' && tipOf(f, 'main')?.message.trim() === 'Add the menu' && !repo(f)!.status.unstaged.length,
            fail: [
              { if: (f) => tipOf(f, 'main')?.message.trim() === 'Break the home page', say: bi('Ветка вернулась на самый последний коммит, а в нём сломана главная страница. В выводе git reflog найдите строку с сообщением Add the menu и верните ветку на её хэш или на запись HEAD@{n} из этой строки.', 'The branch went back to the very last commit, and the home page is broken in it. In the output of git reflog find the line with the message Add the menu and return the branch to its hash or to the HEAD@{n} of that line.') },
              { if: (f) => (repo(f)?.status.unstaged.length ?? 0) > 0, say: bi('Ветка стоит на нужном коммите, но файлы рабочего каталога отличаются от него. Так бывает после git reset без флага --hard. Выполните git reset --hard с тем же хэшем или той же записью HEAD@{n}, и файлы тоже станут такими, как в коммите.', 'The branch is on the right commit, but the files of the working directory differ from it. This happens after git reset without --hard. Run git reset --hard with the same hash or the same HEAD@{n}, and the files will match the commit too.') },
            ],
          },
          chips: 'git reflog',
          concepts: ['git.reflog', 'git.reset'],
          docRef: { page: 'man/git-reflog.1', anchor: 'EXAMPLES' },
          hints: { H1: bi('Коммит никуда не делся, но на него больше не указывает ветка. Журнал перемещений HEAD показывает команда git reflog.', 'The commit has not gone anywhere; no branch points to it. git reflog shows the log of HEAD’s moves.'), H2: bi('Выполните `git reflog`, найдите строку `commit: Add the menu` и выполните `git reset --hard` с хэшем из этой строки, например `git reset --hard HEAD@{2}`.', 'Run `git reflog`, find the line `commit: Add the menu` and run `git reset --hard` with the hash from that line, for example `git reset --hard HEAD@{2}`.') },
        },
      ],
    },
    {
      id: 'lab-revert',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: pricesSetup,
      intro: bi('Коллеги уже скопировали себе этот репозиторий, в истории которого три коммита: «Add pages», «Raise the prices» и «Add contacts». Повышение цен решили отменить, а страницу контактов оставить.', 'Colleagues have already copied this repository, whose history has three commits: “Add pages”, “Raise the prices” and “Add contacts”. The price rise is to be undone, and the contacts page kept.'),
      tasks: [
        {
          id: 'revert',
          prompt: bi('Отмените коммит «Raise the prices» так, чтобы история, которая уже есть у коллег, не изменилась: оба прежних коммита должны остаться в ветке `main`, а цена эспрессо снова должна стать 2.50.', 'Undo the commit “Raise the prices” so that the history colleagues already have does not change: both earlier commits must stay on `main`, and the espresso price must be 2.50 again.'),
          check: {
            when: (f) => repo(f)?.branch === 'main' && inHistory(f, 'main', 'Raise the prices') && inHistory(f, 'main', 'Add contacts') && (head(f)?.files['menu.html'] ?? '').includes('2.50') && 'contacts.html' in (head(f)?.files ?? {}),
            fail: [
              { if: (f) => !!repo(f) && !inHistory(f, 'main', 'Raise the prices'), say: bi('Коммит Raise the prices пропал из истории ветки, то есть история переписана. У коллег он остался и при следующем обмене работой вернётся. Найдите в выводе git reflog строку, где ветка ещё стояла на коммите Add contacts, верните её туда командой git reset --hard с хэшем из этой строки, а затем отмените коммит командой git revert.', 'The commit Raise the prices is gone from the branch history, that is, the history was rewritten. Colleagues still have it, and the next exchange of work brings it back. Find the line in git reflog where the branch was still on Add contacts, return it there with git reset --hard and the hash from that line, then undo the commit with git revert.') },
              { if: (f) => !!repo(f) && !inHistory(f, 'main', 'Add contacts'), say: bi('Из истории пропал коммит Add contacts, а его нужно было оставить. Команда revert отменяет один выбранный коммит и не трогает более поздние.', 'The commit Add contacts is gone from the history, and it had to stay. revert undoes one chosen commit and leaves the later ones alone.') },
            ],
          },
          chips: 'git log --oneline',
          concepts: ['git.revert'],
          docRef: { page: 'man/git-revert.1', anchor: 'DESCRIPTION' },
          hints: { H1: bi('Нужен новый коммит с обратными изменениями, а не перемещение ветки.', 'You need a new commit with the reverse changes, not a move of the branch.'), H2: bi('Узнайте хэш коммита командой `git log --oneline` и выполните `git revert` с этим хэшем. Сообщение коммита Git предложит сам.', 'Find the commit hash with `git log --oneline` and run `git revert` with that hash. Git proposes the commit message itself.') },
        },
      ],
    },
    {
      id: 'lab-detached',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: detachedSetup,
      intro: bi('Чтобы посмотреть, как выглядел сайт до последней правки, выполнили `git checkout HEAD~1`, а потом прямо там дописали в `index.html` год открытия и записали коммит «Add the year». Команда `git status` теперь начинается со слов `HEAD detached at`.', 'To see how the site looked before the last edit, someone ran `git checkout HEAD~1`, then added the opening year to `index.html` right there and recorded the commit “Add the year”. `git status` now starts with `HEAD detached at`.'),
      tasks: [
        {
          id: 'keep',
          prompt: bi('Сохраните коммит «Add the year» в новой ветке `add-year` и вернитесь на ветку `main`.', 'Keep the commit “Add the year” in a new branch `add-year` and go back to the `main` branch.'),
          check: {
            when: (f) => repo(f)?.branch === 'main' && tipOf(f, 'add-year')?.message.trim() === 'Add the year',
            fail: [
              { if: (f) => repo(f)?.branch === 'main' && !repo(f)?.branches['add-year'], say: bi('Вы вернулись на main, и коммит Add the year остался без ветки. Он виден в git reflog: создайте для него ветку командой git branch add-year с его хэшем.', 'You are back on main, and the commit Add the year is left without a branch. git reflog shows it: create a branch for it with git branch add-year and its hash.') },
              { if: (f) => repo(f)?.branch === 'add-year', say: bi('Ветка add-year создана и указывает на нужный коммит. Осталось вернуться на main.', 'The add-year branch exists and points to the right commit. Now go back to main.') },
            ],
          },
          chips: 'git switch -c add-year',
          concepts: ['git.detached'],
          docRef: { page: 'man/git-switch.1', anchor: 'OPTIONS', line: '--create' },
          hints: { H1: bi('Сейчас на коммит указывает только HEAD. Дайте коммиту ветку, а потом переходите.', 'Only HEAD points to the commit now. Give the commit a branch, then switch.'), H2: bi('Выполните `git switch -c add-year`, а затем `git switch main`.', 'Run `git switch -c add-year`, then `git switch main`.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['git.q.reset-modes', 'git.q.hard-lost', 'git.q.hard-really', 'git.q.detached'] },
  ],
};

export const undoPlacement: PlacementTask = {
  id: 'git-yaml.place.reflog',
  level: 'experienced',
  key: false,
  concepts: ['git.reflog', 'git.reset'],
  kind: 'task',
  setup: lostSetup,
  task: {
    id: 'p6',
    prompt: bi('В каталоге `~/site` по ошибке выполнили `git reset --hard HEAD~2`. Верните ветку `main` на коммит «Add the menu», не создавая новых коммитов.', 'In `~/site` someone ran `git reset --hard HEAD~2` by mistake. Return the `main` branch to the commit “Add the menu” without creating new commits.'),
    check: { when: (f) => tipOf(f, 'main')?.message.trim() === 'Add the menu' },
  },
};
