// Block "CI/CD" (route id cicd, 06 §2 G-remote and §3 A1–A6 on GitLab CI).
// Order of ideas: remote repository and merge request → pipeline file, job,
// stage, runner → artifacts, cache, job image → variables and secrets,
// environments, the manual gate → rules and needs.

import { bi } from '../../../core/i18n';
import type { Block, Concept, Facts, Lesson, PlacementTask, QuizItem, Sources } from '../../../core/types';
import { parseCi } from '../ci/config';
import { PAGES, PROJECT, SITE, ci, forge, gitSetup, head, jobOf, lastPipeline, projectSetup, repo } from './common';

const S = {
  remotes: { title: 'Pro Git — Working with Remotes', url: 'https://git-scm.com/book/en/v2/Git-Basics-Working-with-Remotes' },
  ruRemotes: { title: 'Pro Git на русском — Работа с удалёнными репозиториями', url: 'https://git-scm.com/book/ru/v2/%D0%9E%D1%81%D0%BD%D0%BE%D0%B2%D1%8B-Git-%D0%A0%D0%B0%D0%B1%D0%BE%D1%82%D0%B0-%D1%81-%D1%83%D0%B4%D0%B0%D0%BB%D1%91%D0%BD%D0%BD%D1%8B%D0%BC%D0%B8-%D1%80%D0%B5%D0%BF%D0%BE%D0%B7%D0%B8%D1%82%D0%BE%D1%80%D0%B8%D1%8F%D0%BC%D0%B8' },
  mr: { title: 'GitLab Docs — Merge requests', url: 'https://docs.gitlab.com/user/project/merge_requests/' },
  yaml: { title: 'GitLab Docs — CI/CD YAML syntax reference', url: 'https://docs.gitlab.com/ci/yaml/' },
  runner: { title: 'GitLab Docs — GitLab Runner', url: 'https://docs.gitlab.com/runner/' },
  caching: { title: 'GitLab Docs — Caching in GitLab CI/CD', url: 'https://docs.gitlab.com/ci/caching/' },
  artifacts: { title: 'GitLab Docs — Job artifacts', url: 'https://docs.gitlab.com/ci/jobs/job_artifacts/' },
  variables: { title: 'GitLab Docs — GitLab CI/CD variables', url: 'https://docs.gitlab.com/ci/variables/' },
  envs: { title: 'GitLab Docs — Environments', url: 'https://docs.gitlab.com/ci/environments/' },
  needs: { title: 'GitLab Docs — Make jobs start earlier with needs', url: 'https://docs.gitlab.com/ci/yaml/needs/' },
  glab: { title: 'GitLab CLI (glab) documentation', url: 'https://docs.gitlab.com/cli/' },
  fowlerCd: { title: 'Martin Fowler — Continuous Delivery', url: 'https://martinfowler.com/bliki/ContinuousDelivery.html' },
  ruActions: { title: 'GitHub Docs на русском — GitHub Actions', url: 'https://docs.github.com/ru/actions' },
  ruCacheArt: { title: 'Хабр — cache и artifacts в GitLab CI', url: 'https://habr.com/ru/articles/869422/' },
  ruFirst: { title: 'Хабр — стадии и первый пайплайн в GitLab CI', url: 'https://habr.com/ru/articles/841474/' },
  ruCi: { title: 'Непрерывная интеграция — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%9D%D0%B5%D0%BF%D1%80%D0%B5%D1%80%D1%8B%D0%B2%D0%BD%D0%B0%D1%8F_%D0%B8%D0%BD%D1%82%D0%B5%D0%B3%D1%80%D0%B0%D1%86%D0%B8%D1%8F' },
  ruCd: { title: 'Непрерывная доставка — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%9D%D0%B5%D0%BF%D1%80%D0%B5%D1%80%D1%8B%D0%B2%D0%BD%D0%B0%D1%8F_%D0%B4%D0%BE%D1%81%D1%82%D0%B0%D0%B2%D0%BA%D0%B0' },
};
const src = (en: { title: string; url: string }[], ru: { title: string; url: string }[]): Sources => ({ en, ru });

export const concepts: Concept[] = [
  { id: 'git.remote', term: bi('удалённый репозиторий', 'remote repository'), forms: { ru: ['удалённого репозитория', 'удалённом репозитории', 'удалённый репозиторий', 'удалённым репозиторием'], en: ['remote repositories'] }, short: bi('Копия истории на сервере команды. Команда push отправляет в неё коммиты, а команды fetch и pull забирают их оттуда.', 'A copy of the history on the team server; push sends commits to it, fetch and pull bring them back.'), introducedIn: 'cicd.remote', docRef: { page: 'man/git-push.1', anchor: 'DESCRIPTION' } },
  { id: 'git.mr', term: bi('merge request', 'merge request'), forms: { en: ['merge requests'] }, scan: false, short: bi('Предложение влить ветку. В нём видны изменения, их обсуждают и проверяют пайплайном, а затем вливают нажатием кнопки.', 'A proposal to merge a branch: the changes are visible, discussed, checked by a pipeline and merged with a button.'), introducedIn: 'cicd.remote', docRef: { url: 'https://docs.gitlab.com/user/project/merge_requests/', label: 'docs.gitlab.com › Merge requests' } },
  { id: 'cicd.pipeline-file', term: bi('.gitlab-ci.yml', '.gitlab-ci.yml'), short: bi('Файл пайплайна в корне репозитория, в котором перечислены стадии, джобы и их скрипты. Forge читает его при каждом push.', 'The pipeline file in the repository root: stages, jobs and their scripts. The forge reads it on every push.'), introducedIn: 'cicd.first-pipeline', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'overview' } },
  { id: 'cicd.job', term: bi('джоба', 'job'), forms: { ru: ['джобы', 'джобе', 'джобу', 'джобой', 'джоб', 'джобам', 'джобами'], en: ['jobs'] }, scan: false, short: bi('Единица работы пайплайна, у которой есть имя и скрипт. Раннер выполняет этот скрипт на чистой машине.', 'A unit of work in a pipeline: a name and a script a runner executes on a clean machine.'), introducedIn: 'cicd.first-pipeline', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'script' } },
  { id: 'cicd.stage', term: bi('стадия', 'stage'), forms: { ru: ['стадии', 'стадий', 'стадию', 'стадиями'], en: ['stages'] }, scan: false, short: bi('Группа джоб пайплайна. Джобы одной стадии выполняются одновременно, а следующая стадия начинается после того, как предыдущая прошла успешно.', 'A group of pipeline jobs: jobs of a stage run in parallel, the next stage after the previous one succeeds.'), introducedIn: 'cicd.first-pipeline', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'stages' } },
  { id: 'cicd.runner', term: bi('раннер', 'runner'), forms: { ru: ['раннера', 'раннеру', 'раннером', 'раннере', 'раннеры', 'раннеров', 'раннерам'], en: ['runners'] }, short: bi('Программа на отдельной машине, которая сама забирает джобы с forge, выполняет их и отправляет обратно журнал выполнения.', 'A program on a separate machine that picks up jobs from the forge by itself, runs them and sends back the log.'), introducedIn: 'cicd.first-pipeline', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'tags' } },
  { id: 'cicd.artifact', term: bi('артефакт', 'artifact'), forms: { ru: ['артефакта', 'артефакты', 'артефактов', 'артефактом'], en: ['artifacts'] }, scan: false, short: bi('Файлы, которые джоба загружает на forge, чтобы их получили следующие джобы и люди.', 'Files a job uploads to the forge so that later jobs and people get them.'), introducedIn: 'cicd.artifacts-cache', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'artifacts' } },
  { id: 'cicd.cache', term: bi('кэш CI', 'CI cache'), forms: { ru: ['кэша CI', 'кэшем CI'] }, short: bi('Файлы, которые раннер сохраняет между запусками ради скорости. Кэш может пропасть, и сборка всё равно должна пройти.', 'Files a runner keeps between runs for speed; it may vanish and the build must still pass.'), introducedIn: 'cicd.artifacts-cache', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'cache' } },
  { id: 'cicd.image', term: bi('образ джобы', 'job image'), forms: { ru: ['образа джобы', 'образом джобы'] }, short: bi('Образ контейнера, в котором раннер выполняет скрипт джобы. Его задаёт ключ image:.', 'The container image the runner runs the job script in (the image: key).'), introducedIn: 'cicd.artifacts-cache', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'image' } },
  { id: 'cicd.variable', term: bi('переменная CI/CD', 'CI/CD variable'), forms: { ru: ['переменные CI/CD', 'переменной CI/CD', 'переменных CI/CD'], en: ['CI/CD variables'] }, short: bi('Значение из настроек проекта, которое forge передаёт джобе как переменную окружения. Секреты помечают флагами masked и protected.', 'A value from the project settings the forge passes to a job as an environment variable; for secrets, masked and protected.'), introducedIn: 'cicd.variables-envs', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'variables' } },
  { id: 'cicd.environment', term: bi('окружение CI', 'CI environment'), forms: { ru: ['окружения CI', 'окружение CI'] }, short: bi('Место выкладки, например тестовый стенд staging или рабочий сервер production, про которое forge помнит, какая версия и когда туда выложена.', 'A deployment target (staging, production) for which the forge remembers what version went there and when.'), introducedIn: 'cicd.variables-envs', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'environment' } },
  { id: 'cicd.manual', term: bi('ручная джоба', 'manual job'), forms: { ru: ['ручной джобы', 'ручную джобу', 'ручные джобы'], en: ['manual jobs'] }, short: bi('Джоба с when: manual, которая ждёт, пока человек нажмёт кнопку ▶. Ручной шаг перед рабочим сервером и отличает Continuous Delivery от Continuous Deployment.', 'A job with when: manual: it waits until a person presses ▶. A manual step before production is the difference between Continuous Delivery and Continuous Deployment.'), introducedIn: 'cicd.variables-envs', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'when' } },
  { id: 'cicd.rules', term: bi('rules', 'rules'), scan: false, short: bi('Условия, по которым джоба попадает в пайплайн: событие, ветка, тег или изменённые файлы.', 'Conditions that put a job into a pipeline: the event, the branch, the tag, the changed files.'), introducedIn: 'cicd.rules-needs', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'rules' } },
  { id: 'cicd.needs', term: bi('needs', 'needs'), scan: false, short: bi('Явные зависимости джоб. Джоба стартует, как только готовы те джобы, которые ей нужны, и не ждёт конца всей стадии.', 'Explicit job dependencies: a job starts as soon as the jobs it needs are done, without waiting for the whole stage.'), introducedIn: 'cicd.rules-needs', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'needs' } },
];

// ── fact helpers for checks ──

const pushedCi = (f: Facts) => {
  const fg = forge(f);
  const c = fg?.commits.find((x) => x.oid === fg.branches.main);
  const text = c?.files['.gitlab-ci.yml'];
  return text ? parseCi(text) : null;
};
/** The build cache key really depends on the branch (not an empty $CI_COMMIT_REF_SLUG the shell ate). */
const branchKey = (f: Facts) => {
  const text = forge(f)?.commits.find((x) => x.oid === forge(f)?.branches.main)?.files['.gitlab-ci.yml'] ?? '';
  return /key:\s*["']?[^\n]*\$\{?CI_COMMIT_REF_(SLUG|NAME)/.test(text);
};
const mainOk = (f: Facts) => lastPipeline(f, { ref: 'main' })?.status === 'success';
/** The pipeline file in ~/site does not parse: shown first, because nothing else can work until it does. */
const localCiBroken = (f: Facts) => {
  const text = f.files[`${SITE}/.gitlab-ci.yml`]?.text;
  return !!text && parseCi(text).errors.length > 0;
};
const lintFail = {
  if: localCiBroken,
  say: bi('Проверка нашла в файле .gitlab-ci.yml ошибку, и команда glab ci lint назовёт номер строки. Чаще всего дело в отступе: image, script и stage стоят на два пробела правее имени джобы, а строки команд с дефисом ещё на два пробела правее script. Сообщение вида «config should be a hash» значит, что под ключом, который назван в начале сообщения, ожидался вложенный блок со сдвигом вправо.', 'The check found a mistake in .gitlab-ci.yml, and glab ci lint names the line. Most often it is the indentation: image, script and stage stand two spaces right of the job name, and the command lines with a dash two more spaces right of script. A message like “config should be a hash” means a nested, indented block was expected under that word.'),
};

// ── quiz bank ──

export const quiz: QuizItem[] = [
  {
    id: 'cicd.q.reject',
    kind: 'mcq',
    concepts: ['git.remote'],
    prompt: bi('Команда `git push` ответила `! [rejected] main -> main (fetch first)`. Что это значит?', '`git push` answered `! [rejected] main -> main (fetch first)`. What does it mean?'),
    options: [
      { id: 'force', text: bi('Команду нужно повторить с флагом --force', 'Repeat it with --force'), why: bi('Флаг --force перезапишет ветку на сервере, и коммиты коллеги пропадут. А push в защищённую ветку сервер не примет и с этим флагом.', '--force would overwrite the server branch and the colleague’s commits would be lost. A protected branch would not allow it anyway.') },
      { id: 'perm', text: bi('У вас нет прав на запись в репозиторий, поэтому сервер отклонил push, и владелец проекта должен выдать вам роль Developer', 'You have no write access, so the server refused the push, and the project owner has to give you the Developer role'), why: bi('Отказ в правах выглядит иначе, например «You are not allowed to push code» или код 403. Здесь Git сравнил истории.', 'A permission error looks different: "You are not allowed to push code" or 403. Here Git compared histories.') },
      { id: 'ahead', text: bi('На сервере есть коммиты, которых нет у вас, поэтому их нужно забрать командой git pull и отправить работу снова', 'The server has commits you do not have: get them (git pull) and push again'), correct: true },
    ],
  },
  {
    id: 'cicd.q.fetch-pull',
    kind: 'match',
    concepts: ['git.remote'],
    prompt: bi('Сопоставьте команду и её действие.', 'Match the command with what it does.'),
    pairs: [
      { id: 'push', left: 'git push', right: bi('отправляет коммиты и передвигает ветку на сервере', 'sends commits and moves the branch on the server') },
      { id: 'fetch', left: 'git fetch', right: bi('забирает коммиты и обновляет origin/main, но ваши ветки не трогает', 'gets commits, updates origin/main, leaves your branches alone') },
      { id: 'pull', left: 'git pull', right: bi('выполняет fetch, а затем сливает полученное с вашей веткой', 'fetch, then a merge into your branch') },
      { id: 'clone', left: 'git clone', right: bi('создаёт локальную копию всей истории', 'makes a local copy of the whole history') },
    ],
  },
  {
    id: 'cicd.q.rebase',
    kind: 'mcq',
    concepts: ['git.remote'],
    prompt: bi('Вы стоите на ветке `feature/hours` и выполняете `git rebase main`. Что произойдёт?', 'You are on the `feature/hours` branch and run `git rebase main`. What happens?'),
    options: [
      { id: 'onto', text: bi('Ваши коммиты будут записаны заново поверх main и получат новые хэши', 'Your commits are rewritten on top of main and get new hashes'), correct: true },
      { id: 'reverse', text: bi('Коммиты main будут перенесены в ветку feature/hours, а ветка main передвинется', 'The commits of main move into feature/hours, and main itself moves forward'), why: bi('Перебазируется всегда текущая ветка. Ветка main, названная в команде, служит основанием и остаётся на месте.', 'It is always the current branch that is rebased. main, named in the command, is the base and stays in place.') },
      { id: 'merge', text: bi('Git запишет коммит слияния с двумя родителями, а хэши ваших коммитов не изменятся', 'Git records a merge commit with two parents, and your commits keep their hashes'), why: bi('Так поступает git merge main. Перебазирование коммита слияния не создаёт, и история остаётся прямой.', 'That is what git merge main does. A rebase creates no merge commit, and the history stays straight.') },
    ],
  },
  {
    id: 'cicd.q.undo-pushed',
    kind: 'mcq',
    concepts: ['git.remote'],
    prompt: bi('Вы отправили в защищённую ветку `main` коммит с ошибкой, и коллеги уже забрали его к себе. Как отменить этот коммит?', 'You pushed a broken commit to the protected `main` branch, and colleagues have already fetched it. How do you undo the commit?'),
    options: [
      { id: 'revert', text: bi('Записать коммит с обратными изменениями командой git revert и отправить его обычным git push', 'Record a commit with the reverse changes with git revert and send it with an ordinary git push'), correct: true },
      { id: 'force', text: bi('Выполнить git reset --hard HEAD~1, чтобы убрать коммит из истории, и отправить ветку командой git push --force', 'Run git reset --hard HEAD~1 to remove the commit from the history and push the branch with git push --force'), why: bi('Защищённая ветка не примет push с --force. Даже если бы приняла, у коллег коммит остался бы, и при следующем pull он вернулся бы в историю.', 'A protected branch does not accept a push with --force. Even if it did, colleagues would keep the commit, and the next pull would bring it back into the history.') },
      { id: 'delete', text: bi('Удалить коммит на странице проекта в GitLab', 'Delete the commit on the project page in GitLab'), why: bi('Кнопки, которая удаляет коммит, в GitLab нет. Отменить коммит можно только новым коммитом или перезаписью ветки, а перезапись защищённой ветки запрещена.', 'GitLab has no button that deletes a commit. You can undo it only with a new commit or by overwriting the branch, and overwriting a protected branch is forbidden.') },
    ],
  },
  {
    id: 'cicd.q.who-runs',
    kind: 'mcq',
    concepts: ['cicd.runner'],
    prompt: bi('Кто выполняет команды, записанные в `script:` джобы?', 'Who executes the `script:` lines of a job?'),
    options: [
      { id: 'runner', text: bi('Раннер на отдельной машине, который сам забрал джобу', 'A runner on a separate machine that picked up the job by itself'), correct: true },
      { id: 'forge', text: bi('Сам forge, то есть GitLab, на том же сервере, где хранится репозиторий', 'The forge (GitLab) itself, on the same server that stores the repository'), why: bi('Forge только хранит код, создаёт джобы и показывает журналы. Без раннера джоба повиснет в состоянии pending.', 'The forge only stores code, creates jobs and shows logs. Without a runner a job hangs in pending.') },
      { id: 'dev', text: bi('Компьютер разработчика, пока команда git push отправляет коммиты', 'The developer’s computer, while git push is still sending the commits'), why: bi('Команда git push завершается сразу, а пайплайн выполняется на сервере, даже если ноутбук уже закрыт.', 'git push ends at once; the pipeline runs on the server even with the laptop closed.') },
    ],
  },
  {
    id: 'cicd.q.stages-order',
    kind: 'order',
    concepts: ['cicd.stage'],
    prompt: bi('В каком порядке будут выполняться джобы пайплайна со стадиями `[build, test, deploy]`?', 'In what order do the jobs of a pipeline with stages `[build, test, deploy]` run?'),
    steps: [
      { id: 'b', text: 'build' },
      { id: 't', text: bi('unit-test и lint одновременно', 'unit-test and lint (together)'), why: bi('Джобы одной стадии выполняются одновременно, если хватает раннеров.', 'Jobs of one stage run in parallel when there are enough runners.') },
      { id: 'd', text: 'deploy_staging' },
    ],
  },
  {
    id: 'cicd.q.exit',
    kind: 'mcq',
    concepts: ['cicd.job'],
    prompt: bi('Скрипт джобы состоит из трёх строк:\n\n```yaml\n  script:\n    - echo start\n    - ./test.sh\n    - echo done\n```\n\nКоманда `./test.sh` вернула код 1. Какой будет последняя строка журнала джобы?', 'The job script has three lines:\n\n```yaml\n  script:\n    - echo start\n    - ./test.sh\n    - echo done\n```\n\n`./test.sh` returned code 1. What is the last line of the job log?'),
    options: [
      { id: 'fail', text: 'ERROR: Job failed: exit code 1', correct: true },
      { id: 'done', text: 'done', why: bi('После ненулевого кода раннер прекращает выполнять скрипт, поэтому команда echo done не запустится.', 'After a non-zero code the runner stops the script: echo done does not run.') },
      { id: 'ok', text: 'Job succeeded', why: bi('Джоба считается успешной, только если все команды вернули код 0.', 'A job succeeds only if every line returned 0.') },
    ],
    explain: bi('Журнал такой джобы заканчивается строками `$ ./test.sh`, тем, что напечатал тест, и `ERROR: Job failed: exit code 1`. До строки `echo done` раннер не доходит.', 'The log of such a job ends with `$ ./test.sh`, what the test printed, and `ERROR: Job failed: exit code 1`. The runner never reaches `echo done`.'),
  },
  {
    id: 'cicd.q.cache-art',
    kind: 'match',
    concepts: ['cicd.artifact', 'cicd.cache'],
    key: true,
    prompt: bi('Что нужно использовать в каждом случае?', 'What do you use in each case?'),
    pairs: [
      { id: 'nm', left: bi('сохранять каталог .npm/ со скачанными пакетами между пайплайнами, чтобы быстрее ставить зависимости', 'keep the .npm/ directory of downloaded packages between pipelines, to install dependencies faster'), right: 'cache', why: bi('Если кэш пропадёт, npm ci скачает зависимости заново, и сборка пройдёт медленнее, но не сломается.', 'If it is gone, npm ci downloads again: slower, but nothing breaks.') },
      { id: 'dist', left: bi('передать dist/ из сборки в выкладку', 'dist/ from the build to the deploy'), right: 'artifacts', why: bi('Результат сборки обязан дойти до выкладки. Кэш может пропасть, а артефакт хранится на сервере и не пропадёт.', 'The result must arrive: a cache may vanish, an artifact must not.') },
      { id: 'junit', left: bi('сохранить отчёт тестов, который покажет merge request', 'a test report the merge request will show'), right: 'artifacts:reports', why: bi('Отчёт тестов forge показывает на странице merge request, только если он сохранён под ключом artifacts:reports.', 'The forge shows a test report on the merge request page only when it is saved under artifacts:reports.') },
    ],
  },
  {
    id: 'cicd.q.no-artifact',
    kind: 'mcq',
    concepts: ['cicd.artifact'],
    prompt: bi('Джоба build создаёт каталог dist/, а deploy завершается с ошибкой `dist/index.html not found`, хотя обе джобы выполнялись на одном раннере. Почему?', 'build creates dist/, and deploy fails with `dist/index.html not found`. Both jobs ran on the same runner. Why?'),
    options: [
      { id: 'clean', text: bi('Каждая джоба начинается с чистой копии репозитория, поэтому dist/ нужно объявить в artifacts', 'Every job starts from a clean copy of the repository; dist/ must be declared in artifacts'), correct: true },
      { id: 'race', text: bi('deploy запустилась раньше build', 'deploy started before build'), why: bi('Джоба deploy стоит в следующей стадии и стартует только после успешной build.', 'deploy is in the next stage: it starts only after build succeeds.') },
      { id: 'cache', text: bi('Каталог dist/ нужно было объявить в cache: раз раннер один, deploy нашла бы его там с первого раза', 'dist/ should have been declared in cache: with a single runner, deploy would have found it there on the first try'), why: bi('Кэш доставку не гарантирует, и если кэш не найдётся, deploy снова завершится с ошибкой. Результат передают артефактом.', 'A cache does not guarantee delivery: on a miss deploy fails again. Results are passed as artifacts.') },
    ],
  },
  {
    id: 'cicd.q.protected',
    kind: 'mcq',
    concepts: ['cicd.variable'],
    prompt: bi('В пайплайне ветки feature/x переменная `$DEPLOY_TOKEN` пустая, а в пайплайне main она задана. Почему?', 'In the pipeline of the feature/x branch `$DEPLOY_TOKEN` is empty, while on main it is set. Why?'),
    options: [
      { id: 'prot', text: bi('Переменная помечена Protected, и её получают только защищённые ветки и теги', 'The variable is marked Protected: only protected branches and tags get it'), correct: true },
      { id: 'masked', text: bi('Переменная помечена Masked и поэтому скрыта', 'The variable is Masked and so it is hidden'), why: bi('Флаг Masked заменяет значение в журнале на [MASKED], но сама джоба значение получает.', 'Masked hides the value in the log as [MASKED], but the job does get it.') },
      { id: 'yaml', text: bi('Переменную забыли записать в .gitlab-ci.yml этой ветки', 'It was not written into the branch’s .gitlab-ci.yml'), why: bi('Секрет, записанный в файл пайплайна, попадает в историю репозитория, поэтому секреты задают в настройках проекта.', 'A secret in the pipeline file is in the repository history. Secrets are set in the project settings.') },
    ],
  },
  {
    id: 'cicd.q.base64',
    kind: 'mcq',
    concepts: ['cicd.variable'],
    prompt: bi('Переменная TOKEN помечена Masked, но после команды `echo $TOKEN | base64` в журнале появилось её значение в кодировке base64. Почему маскирование не сработало?', 'The TOKEN variable is Masked, yet its base64 form appeared in the log after `echo $TOKEN | base64`. Why did masking fail?'),
    options: [
      { id: 'exact', text: bi('Маскирование ищет в журнале точное значение, а после преобразования в base64 получается уже другая строка', 'Masking looks for the exact value in the log; a transformed value is another string'), correct: true },
      { id: 'enc', text: bi('Masked означает «зашифровано», а base64 расшифровывает значение', 'Masked means "encrypted", and base64 decrypts it'), why: bi('Masked ничего не шифрует. Джоба получает значение открытым текстом, а раннер только заменяет его в журнале.', 'Masked is not encryption: the job gets the value in plain text; the runner only replaces it in the log.') },
    ],
  },
  {
    id: 'cicd.q.delivery',
    kind: 'mcq',
    concepts: ['cicd.manual'],
    key: true,
    prompt: bi('Каждое слияние в main проходит тесты и выкладывается на тестовый стенд, а на рабочий сервер попадает после нажатия кнопки. Как называется такая практика?', 'Every merge into main passes the tests and goes to staging, and to production after a button press. Which practice is this?'),
    options: [
      { id: 'cdel', text: 'Continuous Delivery', correct: true },
      { id: 'cdep', text: 'Continuous Deployment', why: bi('В Continuous Deployment ручного шага нет, и рабочий сервер обновляется сам. Две практики отличаются строкой when: manual.', 'In Continuous Deployment there is no manual step: production updates by itself. The difference is the when: manual line.') },
      { id: 'ci', text: bi('Только непрерывная интеграция', 'Only continuous integration'), why: bi('Непрерывная интеграция означает частое слияние с проверками, а здесь, кроме того, каждая версия готова к выпуску одной кнопкой.', 'CI is frequent merging with checks. Here every version is also ready to release with one button.') },
    ],
  },
  {
    id: 'cicd.q.rules',
    kind: 'bugfind',
    concepts: ['cicd.rules'],
    prompt: bi('Рабочий сервер должен обновляться только из тегов вида v1.2.3 и только вручную. В какой строке ошибка?', 'Production must be deployed only from tags like v1.2.3 and by hand. Which line has the bug?'),
    code: 'deploy_production:\n  stage: deploy\n  script: ./deploy.sh production\n  rules:\n    - if: $CI_COMMIT_BRANCH =~ /^v\\d+\\.\\d+\\.\\d+$/\n      when: manual',
    bug: [5],
    why: {
      3: bi('Скрипт выкладки записан правильно.', 'The deploy script is fine.'),
      5: bi('В пайплайне тега переменная CI_COMMIT_BRANCH не задана, а имя тега лежит в CI_COMMIT_TAG, поэтому правило никогда не сработает.', 'In a tag pipeline CI_COMMIT_BRANCH is not set: the tag name is in CI_COMMIT_TAG. The rule never matches.'),
      6: bi('Ручной запуск записан так, как требовалось.', 'A manual run, as required.'),
    },
  },
  {
    id: 'cicd.q.needs',
    kind: 'multi',
    concepts: ['cicd.needs'],
    prompt: bi('Что изменит `needs: [build]` у джобы `test` из стадии test? Отметьте верные утверждения.', 'What does `needs: [build]` on the `test` job in the test stage change? Mark what is true.'),
    options: [
      { id: 'early', text: bi('test стартует сразу после build и не ждёт других джоб стадии build', 'test starts right after build without waiting for other jobs of the build stage'), correct: true },
      { id: 'art', text: bi('test скачает артефакты только от build', 'test downloads artifacts only from build'), correct: true },
      { id: 'order', text: bi('build станет выполняться после test', 'build will run after test'), why: bi('needs указывает, что нужно выполнить *до* джобы, а не после неё.', 'needs says what is required *before* the job, not after.') },
      { id: 'stage', text: bi('стадии в файле больше не нужны', 'stages are no longer needed in the file'), why: bi('Стадии остаются, а needs лишь разрешает начать раньше, чем закончится стадия.', 'Stages stay: needs only allows starting before the stage ends.') },
    ],
  },
];

// ── lessons ──

const remoteSetup = gitSetup({
  forge: [{ project: 'team/site' }],
  repos: [{ path: '~/site', commits: [{ message: 'Add pages', files: PAGES }, { message: 'Add contacts', files: { 'contacts.html': '<h1>Contacts</h1>\n' } }] }],
});
const rejectSetup = gitSetup({
  forge: [{ project: 'team/site', later: [{ message: 'Add the opening hours', files: { 'hours.html': '<h1>Opening hours</h1>\n<p>8–20 daily</p>\n' }, author: { name: 'Grace Hopper', email: 'grace@example.com' } }] }],
  repos: [{ path: '~/site', remote: 'team/site', commits: [{ message: 'Add pages', files: PAGES }] }],
});

const remoteLesson: Lesson = {
  id: 'cicd.remote',
  block: 'cicd',
  title: bi('Удалённый репозиторий и merge request', 'The remote repository and the merge request'),
  summary: bi('Удалённый репозиторий хранит ещё одну копию истории, и сервер принимает push, только если ваш коммит продолжает эту историю. Merge request служит предложением влить ветку.', 'A remote repository is one more copy of the history; a push is accepted only if it continues it. A merge request is a proposal to merge a branch.'),
  introduces: ['git.remote', 'git.mr'],
  uses: ['git.commit', 'git.branch', 'git.merge'],
  tier: 'core',
  minutes: 35,
  sources: src([S.remotes, S.mr, S.glab], [S.ruRemotes, S.ruCi]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Сайт кафе теперь хранится в репозитории, но репозиторий лежит на вашем ноутбуке. Коллега Grace хочет добавить страницу с часами работы, и ей нужна ваша история, а вам нужна её правка. Пересылать друг другу архивы с каталогом проекта неудобно и опасно, потому что чья-нибудь работа обязательно потеряется. В этом уроке вы отправите репозиторий на сервер команды, откроете merge request и увидите, как сервер защищает чужие коммиты, когда двое отправляют работу одновременно.',
        'The café site is now kept in a repository, but the repository is on your laptop. Your colleague Grace wants to add a page with the opening hours, and she needs your history while you need her edit. Mailing each other archives of the project directory is awkward and risky, because someone’s work is bound to get lost. In this lesson you push the repository to the team server, open a merge request and see how the server protects other people’s commits when two people push at once.',
      ),
    },
    {
      id: 'recap',
      kind: 'text',
      step: 'explain',
      levels: ['experienced'],
      title: bi('Коротко о том, что вы уже знаете', 'In short, what you already know'),
      body: bi(
        'На этом уровне push, pull и merge request вам знакомы, поэтому здесь собрано только то, что понадобится дальше. [[git.remote|Удалённый репозиторий]] на forge, то есть на сервере репозиториев вроде GitLab или GitHub, хранит ту же историю, что и ваша копия, и принимает push, только если ваш коммит продолжает его историю, а иначе отвечает `! [rejected] … (fetch first)`. [[git.mr|Merge request]] служит предложением влить ветку, и в нём работает пайплайн. Ветка `main` на forge защищена, поэтому в неё нельзя ни отправить коммит напрямую, ни переписать её историю командой `push --force`. Новым для вас в этом уроке будет раздел о том, как обновлять свою ветку от main слиянием или перебазированием и как отменить коммит, который уже лежит на сервере. Практические задания ниже проверяют то же самое в терминале, и вы пройдёте их быстро.',
        'At this level you know push, pull and merge requests, so this section holds only what you will need later. A [[git.remote|remote repository]] on the forge, a repository server such as GitLab or GitHub, holds the same history as your copy and accepts a push only if your commit continues its history; otherwise it answers `! [rejected] … (fetch first)`. A [[git.mr|merge request]] is a proposal to merge a branch, and a pipeline runs in it. The `main` branch on the forge is protected: you can neither push to it directly nor rewrite its history with `push --force`. What is new for you in this lesson is the section on bringing your branch up to date with main by a merge or a rebase, and on undoing a commit that is already on the server. The practice tasks below check the same in the terminal, and you will pass them quickly.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      levels: ['beginner', 'intermediate'],
      title: bi('Одна история и много её копий', 'One history, many copies'),
      body: bi(
        'Пока репозиторий лежит на одном ноутбуке, коллеги его не видят, а если ноутбук сломается, пропадёт и репозиторий. Поэтому у команды есть сервер репозиториев, который называют forge: GitLab, GitHub или Gitea. На нём хранится [[git.remote|удалённый репозиторий]], то есть такая же история из тех же коммитов. У каждого разработчика есть своя полная копия истории, а копию на forge команда договорилась считать общей. Сам Git остаётся программой на вашем компьютере и, как во всех уроках блока о Git, работает без всякого сервера. GitLab и GitHub служат сервисами, на которых лежит общая копия репозитория и к которым добавлены merge request, пайплайны и права доступа.\n\nСвязь с сервером задаётся один раз командой `git remote add origin https://forge.edu/team/site.git`, где `origin` служит коротким именем для адреса. Команда `git push origin main` отправляет на сервер недостающие коммиты и просит сервер передвинуть его ветку `main`. Команда `git fetch` забирает чужие коммиты и обновляет ветку-копию `origin/main`, но ваших веток не трогает, а команда `git pull` выполняет fetch и затем слияние. Команда `git clone` делает всё сразу: создаёт репозиторий, записывает адрес `origin` и забирает историю.\n\nСервер принимает push, только если ваш коммит **продолжает** его историю. Если коллега успел отправить свой коммит раньше, ваш push получит отказ `! [rejected] … (fetch first)`, и тогда нужно выполнить `git pull`, слить изменения и отправить работу снова. Так сервер защищает чужую работу, которая без этой проверки исчезла бы.\n\n### Merge request\n\nВ команде в основную ветку напрямую не отправляют. Работу делают в своей ветке, отправляют эту ветку на forge и открывают [[git.mr|merge request]], который в GitHub называется pull request. Это просьба влить, например, ветку contacts в main. В merge request видны изменения, коллеги оставляют в нём замечания, пайплайн проверяет код, и только после этого ветку вливают. Ветку `main` на forge обычно **защищают**, и тогда в неё нельзя ни отправить коммит напрямую, ни переписать её историю.',
        'While a repository lives on one laptop, colleagues cannot see it, and if the laptop breaks the repository is gone. So the team has a repository server, called a forge: GitLab, GitHub or Gitea. It holds a [[git.remote|remote repository]], the same history of the same commits. Every developer has their own full copy, and the copy on the forge is the one the team agreed to share. Git itself stays a program on your computer and, as in every lesson of the Git block, works without any server. GitLab and GitHub are services that hold the shared copy of the repository and add merge requests, pipelines and access rights to it.\n\nThe link to it is set once: `git remote add origin https://forge.edu/team/site.git` (here `origin` is just a short name for the address). `git push origin main` sends the missing commits and asks the server to move its `main` branch. `git fetch` gets other people’s commits and updates the copy branch `origin/main` without touching your branches, and `git pull` is fetch plus a merge. `git clone` does it all at once: it creates the repository, sets `origin` and gets the history.\n\nThe server accepts a push only if your commit **continues** its history. If a colleague pushed first, your push gets `! [rejected] … (fetch first)`: run `git pull`, merge, and push again. This is not an error but a guard: otherwise someone else’s work would simply disappear.\n\n### The merge request\n\nIn a team nobody pushes straight to the main branch. Work is done on its own branch, pushed to the forge, and a [[git.mr|merge request]] is opened (GitHub calls it a pull request): "please merge the contacts branch into main". It shows the changes, colleagues leave comments, the pipeline checks the code, and only then is the branch merged. The `main` branch on the forge is usually **protected**: you can neither push to it directly nor rewrite its history.',
      ),
    },
    {
      id: 'rebase',
      kind: 'text',
      step: 'explain',
      title: bi('Как обновить свою ветку от main и как отменить отправленный коммит', 'How to bring your branch up to date with main and undo a pushed commit'),
      body: bi(
        'Пока вы работали в ветке `feature/hours`, в `main` появились чужие коммиты, и перед слиянием свою ветку нужно обновить. Сделать это можно двумя способами. Команда `git merge main`, выполненная в вашей ветке, записывает коммит слияния, и в истории видно, что ветки шли параллельно. Команда `git rebase main` поступает иначе: она откладывает ваши коммиты, которых нет в `main`, передвигает ветку на последний коммит `main` и записывает отложенные коммиты заново поверх него, по одному и в том же порядке. Перебазируется всегда текущая ветка, а ветка, названная в команде, остаётся на месте, поэтому `git rebase main`, выполненная на `feature/hours`, меняет только `feature/hours`. История получается прямой, как будто вы начали работу только что.\n\nУ перебазированных коммитов другой родитель, а хэш коммита вычисляется и из хэша родителя, поэтому у них новые хэши, а прежние коммиты в истории ветки больше не видны. Если ветку уже скопировал кто-нибудь ещё, его копия и ваша разойдутся. Отсюда правило: перебазируют только свою ветку, которую никто, кроме вас, не брал в работу, а `main` и другие общие ветки не перебазируют никогда. Свою уже отправленную ветку после перебазирования приходится отправлять командой `git push --force-with-lease`, которая перезапишет ветку на сервере, только если с тех пор её не обновил кто-то другой. Команда `git pull --rebase` применяет тот же приём к ветке, которую вы отправляете на сервер: забирает коммиты, которые коллеги успели отправить в эту же ветку, и записывает ваши новые коммиты поверх них, не создавая коммита слияния. Если при записи какого-нибудь коммита возникает конфликт, перебазирование останавливается. Тогда исправляют файлы, добавляют их командой `git add` и продолжают командой `git rebase --continue`, а команда `git rebase --abort` возвращает ветку к состоянию до перебазирования.\n\nОтменить коммит, который уже лежит в общей ветке на сервере, можно только новым коммитом. Команда `git revert хэш` записывает коммит с обратными изменениями, и его отправляют обычным `git push`. Сбросить ветку командой `git reset` и отправить её с `--force` не получится, потому что защищённая ветка такой push не примет, а у коллег, которые уже забрали коммит, он всё равно останется.',
        'While you worked on `feature/hours`, other people’s commits appeared on `main`, and before the merge you need to bring your branch up to date. There are two ways. `git merge main` run on your branch records a merge commit, and the history shows that the branches went in parallel. `git rebase main` does something else: it sets aside your commits that `main` does not have, moves the branch to the last commit of `main` and records the set-aside commits again on top of it, one by one and in the same order. It is always the current branch that is rebased, and the branch named in the command stays in place, so `git rebase main` run on `feature/hours` changes only `feature/hours`. The history comes out straight, as if you had just started the work.\n\nThe rebased commits have a different parent, so they get new hashes, and Git no longer shows the old commits. If somebody else has already copied the branch, their copy and yours diverge. Hence the rule: rebase only your own branch that nobody but you has taken up, and never rebase `main` or other shared branches. Your own branch that you have already pushed has to be pushed after a rebase with `git push --force-with-lease`, which overwrites the branch on the server only if nobody else updated it in the meantime. `git pull --rebase` applies the same trick to the branch you push: it fetches the commits colleagues have pushed to that same branch and records your new commits on top of them without a merge commit. If replaying a commit hits a conflict, the rebase stops: fix the files, add them with `git add` and continue with `git rebase --continue`, while `git rebase --abort` returns the branch to where it was before the rebase.\n\nA commit that is already on a shared branch on the server can be undone only with a new commit. `git revert hash` records a commit with the reverse changes, and it is sent with an ordinary `git push`. Resetting the branch with `git reset` and pushing it with `--force` will not work: a protected branch does not accept such a push, and colleagues who already fetched the commit keep it anyway.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Что происходит при git add, git commit и git push', 'What happens on git add, git commit and git push'),
      body: bi(
        'Прежде чем отправлять работу на сервер, полезно увидеть, что туда уходит. Схема ниже по шагам показывает, что делает Git, когда вы поменяли один файл, добавили его в индекс, записали коммит и отправили его на сервер команды. Сначала на ней только файл index.html и индекс. Потом появятся объекты, которые Git сохраняет в каталоге .git: содержимое файла (blob), снимок каталога (tree) и сам коммит, затем ветка main и указатель HEAD, а в правом нижнем углу сервер forge. Под схемой три счётчика показывают, сколько новых объектов создано, сколько файлов взято из прошлого коммита без изменений и сколько объектов отправлено на сервер.',
        'Before you push work to the server, it helps to see what exactly goes there. The diagram below shows step by step what Git does when you have changed one file, added it to the index, recorded a commit and pushed it to the team server. At first it shows only index.html and the index. Then the objects Git stores in .git appear: the file content (blob), the directory snapshot (tree) and the commit itself, then the main branch and the HEAD pointer, and in the lower right corner the forge. Under the diagram three counters show how many new objects were created, how many files were reused from the previous commit and how many objects were sent to the server.',
      ),
    },
    {
      id: 'look',
      kind: 'explainer',
      step: 'look',
      explainer: 'git.commit-push',
      howto: bi(
        'А дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен один блок, тот, который работает сейчас, а облачко рядом с ним говорит, что он делает. По линиям проходит карточка с тем, что передаётся дальше. Зелёная рамка означает, что шаг прошёл, а красная означает, что Git или сервер отказали. Легенда со всеми знаками собрана рядом со схемой.\n\nКогда пройдёте до сервера, поменяйте в «Параметрах» число файлов в проекте и убедитесь, что новых объектов по-прежнему три. Потом включите переключатель «Файл изменили ещё раз после git add» и посмотрите, какая версия попадёт в коммит. Напоследок включите в блоке «Сломать» поломку «Коллега уже отправил на сервер свой коммит в main» и посмотрите, на каком шаге и с каким сообщением сервер откажет.',
        'Then go on with “Step forward” above the diagram. At every step one block is highlighted, the one working now, and the callout next to it says what it does. A card travels along the lines with what is handed on. A green outline means the step passed, a red one that Git or the server refused. The legend with all the marks is next to the diagram.\n\nOnce you reach the server, change the number of files in “Parameters” and check that there are still three new objects. Then switch on “Edit the file after git add” and see which version goes into the commit. Finally, in “Break it” switch on “The forge already has someone else’s commit” and see at which step and with which message the server refuses.',
      ),
      caption: bi('Сообщение `! [rejected] main -> main (fetch first)`, которое вы видели при поломке, встретится вам во второй практике этого урока. Когда сервер так ответит, вспомните схему: ваш коммит не продолжает историю сервера, поэтому сначала нужно забрать чужой коммит командой `git pull`.', 'The message `! [rejected] main -> main (fetch first)` you saw with the break will meet you in the second practice of this lesson. When the server answers like that, remember the diagram: your commit does not continue the server history, so you first fetch the other commit with `git pull`.'),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: remoteSetup,
      intro: bi('На forge создан пустой проект `team/site`. Работать с ним помогает `glab`, консольный клиент GitLab.', 'An empty project `team/site` exists on the forge. `glab`, the GitLab command-line client, helps you work with it.'),
      tasks: [
        {
          id: 'origin',
          prompt: bi('Свяжите каталог `~/site` с адресом `https://forge.edu/team/site.git` под именем `origin` и отправьте туда ветку `main` так, чтобы Git запомнил связь этой ветки с сервером.', 'Link `~/site` to `https://forge.edu/team/site.git` as `origin` and push `main` there, remembering the link of the branch to the server.'),
          check: { when: (f) => !!forge(f)?.branches.main && forge(f)!.branches.main === repo(f)?.branches.main && repo(f)?.upstream.main === 'origin/main', fail: [{ if: (f) => !!forge(f)?.branches.main && !repo(f)?.upstream.main, say: bi('Ветка main уже на сервере, но Git не запомнил, что ваша main связана с main на сервере. Эту связь он записывает, когда push выполнен с флагом -u (--set-upstream).', 'main is on the server, but the branch link was not remembered: you need -u (--set-upstream).') }] },
          chips: 'git remote add origin https://forge.edu/team/site.git && git push -u origin main',
          concepts: ['git.remote'],
          docRef: { page: 'man/git-push.1', anchor: 'OPTIONS', line: '--set-upstream' },
          hints: { H1: bi('Нужны два шага: сначала git remote add, а затем git push с флагом -u.', 'Two steps: git remote add, then git push with -u.') },
        },
        {
          id: 'mr',
          prompt: bi('Сделайте по порядку четыре шага. Создайте ветку `feature/hours` и перейдите на неё, добавьте в ней коммитом страницу `hours.html`, отправьте ветку на сервер командой `git push -u origin feature/hours` и в конце откройте merge request из этой ветки в `main`.', 'Do four steps in order. Create a branch `feature/hours` and switch to it, add a page `hours.html` on it with a commit, push the branch to the server with `git push -u origin feature/hours`, and finally open a merge request from this branch into `main`.'),
          check: {
            when: (f) => !!forge(f)?.branches['feature/hours'] && (forge(f)?.mrs ?? []).some((m) => m.source === 'feature/hours' && m.target === 'main'),
            fail: [{ if: "term['main'][last].out~'is not on the forge'", say: bi('Сервер ответил, что ветки feature/hours на нём нет. Merge request открывают только из ветки, которая уже лежит на сервере, поэтому сначала создайте ветку, запишите в ней коммит и отправьте её командой git push -u origin feature/hours.', 'The server answered that it has no feature/hours branch. A merge request is opened only from a branch that is already on the server, so first create the branch, commit in it and push it with git push -u origin feature/hours.') }],
          },
          chips: 'glab mr create --source-branch feature/hours --target-branch main --title "Add opening hours"',
          concepts: ['git.mr'],
          hints: { H1: bi('Порядок такой: git switch -c, новый файл, git add, git commit, git push -u и в конце glab mr create.', 'switch -c, a file, add, commit, push -u, then glab mr create.'), H2: bi('Откройте merge request командой `glab mr create -s feature/hours -b main -t "Add opening hours"`.', '`glab mr create -s feature/hours -b main -t "Add opening hours"`.') },
        },
        {
          id: 'merge',
          prompt: bi('Влейте merge request на forge и обновите свою ветку `main`, чтобы в ней появился файл `hours.html`.', 'Merge the merge request on the forge and update your own `main` so that `hours.html` appears in it.'),
          check: { when: (f) => (forge(f)?.mrs ?? []).some((m) => m.state === 'merged') && repo(f)?.branch === 'main' && 'hours.html' in (head(f)?.files ?? {}) },
          chips: 'glab mr merge 1 && git switch main && git pull',
          hints: { H1: bi('Слияние выполнил сервер, а в вашей локальной ветке его ещё нет.', 'The server made the merge; you do not have it yet.') },
        },
      ],
    },
    {
      id: 'reject',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: rejectSetup,
      intro: bi('Пока вы правили `about.html`, ваша коллега Grace отправила в `main` свой коммит.', 'While you were editing `about.html`, Grace pushed her own commit to `main`.'),
      tasks: [
        {
          id: 'both',
          prompt: bi('Внесите любую правку в `about.html`, запишите её коммитом и отправьте в ветку `main` на сервере команды так, чтобы коммит Grace тоже остался.', 'Commit any edit of `about.html` and deliver it to `main` on the forge so that Grace’s commit stays too.'),
          check: {
            when: (f) => {
              const fg = forge(f);
              const tip = fg?.commits.find((c) => c.oid === fg.branches.main);
              return !!tip && 'hours.html' in tip.files && tip.files['about.html'] !== PAGES['about.html'];
            },
            fail: [{ if: (f) => (repo(f)?.commits.length ?? 0) > 1 && !('hours.html' in (head(f)?.files ?? {})), say: bi('Сервер отклонил push, потому что на нём есть коммит Grace. Заберите его командой git pull и отправьте работу снова.', 'The push is rejected: Grace’s commit is on the server. Get it with git pull and push again.') }],
          },
          chips: 'git pull && git push',
          concepts: ['git.remote'],
          docRef: { page: 'man/git-push.1', anchor: 'DESCRIPTION', line: 'fast-forward' },
          hints: { H1: bi('Сначала попробуйте выполнить push и прочитайте, что ответит сервер.', 'Try push first and read the server’s answer.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['cicd.q.reject', 'cicd.q.fetch-pull', 'cicd.q.rebase', 'cicd.q.undo-pushed'] },
  ],
};


const firstLesson: Lesson = {
  id: 'cicd.first-pipeline',
  block: 'cicd',
  title: bi('Первый пайплайн, его джобы, стадии и раннер', 'The first pipeline: jobs, stages, the runner'),
  summary: bi('Пайплайн описан в файле репозитория, который forge читает при каждом push и превращает в джобы, а выполняют эти джобы раннеры.', 'A pipeline is a file in the repository the forge reads on every push and turns into jobs; runners execute them.'),
  introduces: ['cicd.pipeline-file', 'cicd.job', 'cicd.stage', 'cicd.runner'],
  uses: ['git.remote', 'yaml.syntax'],
  tier: 'core',
  minutes: 40,
  sources: src([S.yaml, S.runner, S.fowlerCd], [S.ruFirst, S.ruCi]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'У сайта есть тесты, скрипт `./test.sh`, но его запускают, только когда вспоминают о нём, и раз в неделю в main попадает страница без заголовка. Нужно, чтобы проверка запускалась сама при каждом push, на чистой машине, и чтобы её результат видела вся команда. В этом уроке вы напишете первый файл пайплайна, разделите джобы на стадии и увидите, как раннер выполняет их на сервере.',
        'The site has tests: the `./test.sh` script. But people run it when they remember, and once a week a page without a heading lands on main. The check must run by itself on every push, on a clean machine, and the whole team must see the result. In this lesson you write the first pipeline file, split the jobs into stages and see how a runner executes them on the server.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      title: bi('Файл пайплайна, джобы, стадии и раннер', 'File, job, stage, runner'),
      body: bi(
        'Всё, что делает CI, записано в файле [[cicd.pipeline-file|.gitlab-ci.yml]] в корне репозитория. Это обычный YAML, его меняют коммитом, как код, и forge читает его заново при каждом push из того коммита, который пришёл.\n\nФайл состоит из джоб. Каждая [[cicd.job|джоба]] начинается со строки без отступа, в которой записаны её имя и двоеточие, а всё, что сдвинуто под этой строкой вправо, относится к джобе. Исключение составляют несколько служебных слов, например `stages`, `variables` и `default`: строка без отступа с таким словом задаёт не джобу, а настройки всего пайплайна. Вот целая джоба с именем `test`:\n\n```yaml\ntest:                  # имя джобы, строка без отступа\n  image: alpine:3.22   # образ, в котором раннер выполнит команды\n  script:              # дальше идёт список команд\n    - ./test.sh        # первая и единственная команда\n```\n\nЗдесь работают три правила YAML из блока о Git и YAML. Пара «ключ: значение» записывается через двоеточие с пробелом, отступ в два пробела означает «внутри», а дефис в начале строки отмечает пункт списка. Текст после знака `#` служит комментарием для людей, и программа его не читает. Если ошибиться в отступе, команда `glab ci lint` ответит красным текстом на английском, например `jobs:test config should implement the script:, run:, or trigger: keyword`. Ничего страшного в таком ответе нет: проверка называет джобу или строку, в которой нашла ошибку, и чаще всего причина в том, что строка сдвинута не на столько пробелов, на сколько нужно.\n\nУ джобы есть `script`, то есть список команд, которые вы набрали бы руками. Команды выполняются по очереди, и если какая-нибудь вернула ненулевой код, джоба останавливается со статусом **failed**. Все джобы одного коммита вместе составляют пайплайн.\n\nДжобы группируются в [[cicd.stage|стадии]], и порядок стадий задаёт строка `stages: [build, test, deploy]`. Джобы одной стадии выполняются одновременно, следующая стадия начинается, когда предыдущая прошла успешно, а после упавшей джобы следующие стадии пропускаются со статусом **skipped**. Если у джобы не указан `stage`, она попадает в стадию `test`.\n\nВажнее всего то, что forge сам джобы не выполняет, а только ставит их в очередь. Выполняет их [[cicd.runner|раннер]], программа gitlab-runner на отдельной машине. Раннер сам спрашивает forge, нет ли для него работы, получает джобу, разворачивает чистую копию репозитория, выполняет скрипт и отправляет журнал обратно. Раннер выбирают по тегам: джобу с `tags: [docker]` получит только раннер с таким тегом, а если такого раннера нет, джоба повиснет в состоянии **pending** с пометкой stuck и будет ждать, пока не появится подходящий раннер или пока GitLab не снимет её по тайм-ауту.\n\nСостояние пайплайна видно в merge request и в выводе команды `glab ci status`. Красный пайплайн в main служит сигналом всей команде: основная ветка сломана, и чинить её нужно в первую очередь.',
        'Everything CI does is written in the [[cicd.pipeline-file|.gitlab-ci.yml]] file in the repository root. It is ordinary YAML, it changes by a commit like code, and the forge reads it again on every push, from exactly the commit that arrived.\n\nThe file is made of jobs. Every [[cicd.job|job]] starts with a line without indentation that holds its name and a colon, and everything shifted right under that line belongs to the job. A few service words are the exception, such as `stages`, `variables` and `default`: a line without indentation with such a word sets up the whole pipeline, not a job. Here is a whole job named `test`:\n\n```yaml\ntest:                  # the job name, a line without indentation\n  image: alpine:3.22   # the image the runner runs the commands in\n  script:              # a list of commands follows\n    - ./test.sh        # the first and only command\n```\n\nThree YAML rules from the Git and YAML block work here: a “name: value” pair is written with a colon and a space, an indentation of two spaces means “inside”, and a dash at the start of a line marks a list item. Text after `#` is a comment for people, and the program does not read it. If you get the indentation wrong, `glab ci lint` answers in red English, for example `jobs:test config should implement the script:, run:, or trigger: keyword`. There is nothing alarming in such an answer: the check names the job or the line where it found the error, and most often the line is shifted by the wrong number of spaces.\n\nA job has `script`, a list of commands, the same ones you would type by hand. The commands run in turn; if one returns a non-zero code, the job stops with the status **failed**. A pipeline is all the jobs of one commit.\n\nJobs are grouped into [[cicd.stage|stages]]: `stages: [build, test, deploy]` sets the order. Jobs of one stage run in parallel, the next stage begins when the previous one succeeded, and after a failed job the later stages are skipped (**skipped**). A job without `stage` is in the `test` stage.\n\nAnd the main thing: the forge does not run jobs. It queues them, and a [[cicd.runner|runner]] (the gitlab-runner program on a separate machine) asks the forge "any work?" by itself, takes a job, sets up a clean copy of the repository, runs the script and sends the log back. Runners are chosen by tags: a job with `tags: [docker]` goes only to a runner with that tag, and if there is none, it hangs in **pending**, marked stuck, until a matching runner appears or GitLab drops it on a timeout.\n\nThe pipeline status shows in the merge request and in `glab ci status`. A red pipeline on main is a signal to the whole team: the main branch is broken and fixing it comes first.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Весь путь от git push до работающей версии', 'The whole road from git push to a running version'),
      body: bi(
        'Схема ниже показывает весь путь, который проходит коммит от команды `git push` до работающей версии сайта. В этом уроке вы пройдёте его начало: сервер читает файл пайплайна, ставит джобы в очередь, а раннер забирает их и выполняет. Остальную часть пути — артефакты, окружения и ручной шаг перед рабочим сервером — подробно разберут следующие уроки, но увидеть её целиком полезно уже сейчас. Сначала на схеме только ваш репозиторий и сервер forge. Затем появятся файл `.gitlab-ci.yml`, очередь джоб и раннер, ниже хранилище артефактов и реестр образов, а справа тестовый стенд staging и рабочий сервер production. Под схемой три счётчика показывают время сборки, время ожидания свободного раннера и время всего пайплайна в секундах.',
        'The diagram below shows the whole road a commit travels from `git push` to a running version of the site. In this lesson you cover its beginning: the server reads the pipeline file and queues the jobs, and a runner takes and runs them. The rest of the road, artifacts, environments and the manual step before production, is covered in the next lessons, but it helps to see it whole now. At first the diagram shows only your repository and the forge. Then the `.gitlab-ci.yml` file, the job queue and the runner appear, below them the artifact storage and the image registry, and on the right staging and production. Under the diagram three counters show the build time, the wait for a free runner and the whole pipeline time in seconds.',
      ),
    },
    {
      id: 'look',
      kind: 'explainer',
      step: 'look',
      explainer: 'cicd.push-to-deploy',
      howto: bi(
        'А дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен один блок, тот, который работает сейчас, а облачко рядом с ним говорит, что он делает. По линиям проходит карточка с тем, что передаётся дальше. Зелёная рамка означает, что шаг прошёл, пунктирная означает, что выкладка ждёт решения человека, а красная означает, что пайплайн остановился. Легенда со всеми знаками собрана рядом со схемой.\n\nКогда пройдёте до рабочего сервера, поменяйте в «Параметрах» ветку на рабочую и посмотрите, какие джобы останутся. Затем оставьте один свободный раннер, снимите отметку «На раннере сохранились зависимости прошлой сборки (кэш)» и следите, как меняются счётчики времени. Напоследок включите в блоке «Сломать» поломку «Тест находит ошибку и возвращает код 1», а затем «Ни у одного раннера нет тега docker», и посмотрите, где остановится пайплайн.',
        'Then go on with “Step forward” above the diagram. At every step one block is highlighted, the one working now, and the callout next to it says what it does. A card travels along the lines with what is handed on. A green outline means the step passed, a dashed one that the deployment waits for a human decision, a red one that the pipeline stopped. The legend with all the marks is next to the diagram.\n\nOnce you reach production, switch the branch to a feature branch in “Parameters” and see which jobs remain. Then leave one free runner, untick “Dependency cache” and watch how the time counters change. Finally, in “Break it” switch on “A test fails”, then “No runner with the docker tag”, and see where the pipeline stops.',
      ),
      caption: bi('Две поломки, которые вы включали, встретятся вам на практике. Сообщение `ERROR: Job failed: exit code 1` означает, что одна из команд скрипта завершилась с ошибкой, и причину нужно искать в журнале джобы командой `glab ci trace`. Джоба, которая висит в состоянии pending, обычно ждёт раннер с тегом, которого ни у одного раннера нет.', 'You will meet both breaks you switched on in practice. `ERROR: Job failed: exit code 1` means one of the script commands failed, and you look for the cause in the job log with `glab ci trace`. A job hanging in pending usually waits for a runner with a tag no runner has.'),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: projectSetup(),
      intro: bi('В каталоге `~/site` лежит проект сайта, связанный с forge: страницы в каталоге `src/` и скрипты `test.sh`, `build.sh` и `lint.sh`. Файла пайплайна пока нет, а создавать файлы удобно командой `edit`.', '`~/site` is the site project on the forge: pages in `src/`, scripts `test.sh`, `build.sh`, `lint.sh`. There is no pipeline file yet. Create files with `edit`.'),
      tasks: [
        {
          id: 'first',
          prompt: bi('Создайте файл `.gitlab-ci.yml` с одной джобой `test`, которая запускает `./test.sh` в образе `alpine:3.22`, проверьте файл командой `glab ci lint` и отправьте его в `main`. Пайплайн должен пройти.', 'Create `.gitlab-ci.yml` with one job `test` that runs `./test.sh` in the `alpine:3.22` image, check it with `glab ci lint` and push it to `main`. The pipeline must pass.'),
          check: {
            when: (f) => mainOk(f) && (jobOf(f, 'test', { ref: 'main' })?.log ?? '').includes('$ ./test.sh'),
            fail: [
              lintFail,
              { if: (f) => !!f.files[`${SITE}/.gitlab-ci.yml`] && !forge(f)?.commits.some((c) => '.gitlab-ci.yml' in c.files), say: bi('Файл есть у вас, но forge его ещё не видел, поэтому запишите его коммитом и выполните git push.', 'The file exists locally, but the forge has not seen it: commit and git push.') },
              { if: (f) => lastPipeline(f)?.status === 'failed' && !!lastPipeline(f)?.errors, say: bi('Forge не принял файл пайплайна из-за ошибки, и команда glab ci lint покажет, в какой строке она находится.', 'The forge could not read the pipeline file; glab ci lint shows the line.') },
            ],
          },
          chips: 'edit .gitlab-ci.yml',
          concepts: ['cicd.pipeline-file', 'cicd.job'],
          docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'script', line: 'job2:' },
          hints: { H1: bi('Имя джобы стоит в строке без отступа, а под ним со сдвигом на два пробела стоят строки image и script, как в примере из текста урока.', 'The job name stands on a line without indentation, and under it, two spaces to the right, go image and script, as in the example in the lesson text.'), H2: bi('```yaml\ntest:\n  image: alpine:3.22\n  script:\n    - ./test.sh\n```\nЗатем выполните `glab ci lint`, `git add .gitlab-ci.yml`, `git commit -m "Add CI"` и `git push`.', '```yaml\ntest:\n  image: alpine:3.22\n  script:\n    - ./test.sh\n```\nThen `glab ci lint`, `git add .gitlab-ci.yml`, `git commit -m "Add CI"`, `git push`.') },
        },
        {
          id: 'stages',
          prompt: bi('Добавьте стадии `build` и `test`. Джоба `build` из стадии build должна запускать `./build.sh`, а джоба `lint` из стадии test должна запускать `./lint.sh`. Джоба `build` должна закончиться раньше, чем начнутся `test` и `lint`.', 'Add the stages `build` and `test`: a job `build` (stage build) runs `./build.sh`, a job `lint` in the test stage runs `./lint.sh`. `build` must finish before `test` and `lint` start.'),
          check: {
            when: (f) => {
              const p = lastPipeline(f, { ref: 'main' });
              const b = p?.jobs.find((j) => j.name === 'build');
              const t = p?.jobs.find((j) => j.name === 'test');
              const l = p?.jobs.find((j) => j.name === 'lint');
              return p?.status === 'success' && !!b && !!t && !!l && b.stage === 'build' && t.stage === 'test' && l.stage === 'test' && (b.end ?? 0) <= (t.start ?? 0) && (b.end ?? 0) <= (l.start ?? 0);
            },
            fail: [lintFail, { if: (f) => (lastPipeline(f)?.errors ?? []).some((e) => e.message.includes('chosen stage')), say: bi('Стадию, в которую входит джоба, нужно объявить в списке stages.', 'A job’s stage must be declared in the stages list.') }],
          },
          chips: 'glab ci view',
          concepts: ['cicd.stage'],
          docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'stages', line: 'The order of the items' },
          hints: { H1: bi('Вверху файла нужна строка stages: [build, test], а в каждой джобе нужен ключ stage:.', 'stages: [build, test] at the top of the file and stage: in every job.') },
        },
        {
          id: 'red',
          prompt: bi('Коллега просит добавить страницу `src/menu.html` с текстом `<p>Espresso 2.50</p>`. Добавьте её, отправьте на сервер и добейтесь зелёного пайплайна, причём исправить нужно **страницу**, а не проверку.', 'A colleague asks to add a page `src/menu.html` with the text `<p>Espresso 2.50</p>`. Add it, push it, and get a green pipeline by fixing the **page**, not the check.'),
          check: {
            when: (f) => {
              const fg = forge(f);
              const tip = fg?.commits.find((c) => c.oid === fg.branches.main);
              const page = tip?.files['src/menu.html'] ?? '';
              const cfg = pushedCi(f);
              const t = cfg?.config?.jobs.find((j) => j.name === 'test');
              return mainOk(f) && page.includes('Espresso 2.50') && !!t && t.script.includes('./test.sh') && !t.allowFailure && tip?.files['test.sh'] === PROJECT['test.sh'];
            },
            fail: [
              lintFail,
              { if: (f) => pushedCi(f)?.config?.jobs.find((j) => j.name === 'test')?.allowFailure === true, say: bi('Ключ allow_failure прячет поломку, потому что пайплайн становится зелёным, а у страницы по-прежнему нет заголовка. Почините саму страницу.', 'allow_failure hides the breakage: the pipeline is green and the page still has no heading. Fix the page.') },
              { if: (f) => jobOf(f, 'test', { ref: 'main' })?.status === 'failed', say: bi('Тест завершился с ошибкой, поэтому откройте журнал командой glab ci trace test. В нём сказано, чего не хватает странице.', 'The test failed. Open the log with glab ci trace test: it says what the page is missing.') },
            ],
          },
          chips: 'glab ci trace test',
          hints: { H1: bi('Прочитайте журнал упавшей джобы, потому что последняя строка перед ERROR называет причину.', 'Read the log of the failed job: the last line before ERROR names the cause.'), H2: bi('Скрипт test.sh требует, чтобы в каждой странице были теги <title> и <h1>.', 'test.sh requires a <title> and an <h1> in every page.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Справочник ключевых слов GitLab разбит на разделы, и каждый раздел посвящён одному ключевому слову. В каком разделе сказано, что джобы одной стадии выполняются одновременно? Нажмите на этот раздел.', 'The GitLab keyword reference is organised in sections, one keyword per section. Which of them says that jobs of one stage run in parallel? Click it.'),
      ref: { page: 'web/docs.gitlab.com/ci/yaml' },
      answer: 'stages',
    },
    { id: 'board', kind: 'widget', step: 'practice', widget: 'cicd.board' },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['cicd.q.who-runs', 'cicd.q.stages-order', 'cicd.q.exit'] },
  ],
};

const ARTIFACT_CI = `stages: [build, test]

build:
  stage: build
  image: node:24-alpine
  script:
    - npm ci --cache .npm --prefer-offline
    - npm run build

test:
  stage: test
  image: node:24-alpine
  script:
    - test -f dist/index.html
    - npm test
`;

const CACHE_BOTH_CI = `stages: [build, test]

build:
  stage: build
  image: node:24-alpine
  cache:
    key: npm-$CI_COMMIT_REF_SLUG
    paths: [.npm/]
  script:
    - npm ci --cache .npm --prefer-offline
    - npm run build
  artifacts:
    paths: [dist/]

test:
  stage: test
  image: node:24-alpine
  cache:
    key: npm-$CI_COMMIT_REF_SLUG
    paths: [.npm/]
  script:
    - npm ci --cache .npm --prefer-offline
    - npm test
`;

const artifactsLesson: Lesson = {
  id: 'cicd.artifacts-cache',
  block: 'cicd',
  title: bi('Артефакты, кэш и образ джобы', 'Artifacts, cache and the job image'),
  summary: bi('Каждая джоба начинается на чистой машине. Артефакт сервер хранит и по умолчанию отдаёт джобам следующих стадий, а кэш только ускоряет работу и может пропасть.', 'Every job starts on a clean machine. The server keeps an artifact and by default hands it to the jobs of later stages; a cache only speeds things up and may vanish.'),
  introduces: ['cicd.artifact', 'cicd.cache', 'cicd.image'],
  uses: ['cicd.job', 'cicd.stage', 'cicd.runner'],
  tier: 'core',
  minutes: 35,
  sources: src([S.artifacts, S.caching, S.yaml], [S.ruCacheArt, S.ruFirst]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Вы добавили в пайплайн джобу сборки, которая создаёт каталог `dist/`, и джобу теста, которая этот каталог проверяет. Сборка проходит, а тест завершается с ошибкой и сообщает, что файла `dist/index.html` нет, хотя обе джобы выполнялись на одном раннере. Кроме того, каждая сборка заново скачивает все зависимости и тратит на это почти минуту. В этом уроке вы узнаете, почему джобы не видят файлов друг друга, как передать результат сборки дальше артефактом и как ускорить сборку кэшем.',
        'You added a build job that creates `dist/` and a test job that checks it. The build passes, and the test fails saying `dist/index.html` is missing, although both jobs ran on the same runner. Besides, every build downloads all the dependencies again and spends almost a minute on it. In this lesson you learn why jobs do not see each other’s files, how to pass the build result on as an artifact and how to speed the build up with a cache.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Раннер выполняет каждую джобу в контейнере, запущенном из [[cicd.image|образа джобы]]. Строка `image: node:24-alpine` даёт джобе Node.js, а строка `image: alpine:3.22` даёт чистый Alpine. Если ошибиться в имени образа, джоба завершится с ошибкой ещё до скрипта и напишет `failed to pull image`. После джобы контейнер удаляется, и вместе с ним исчезает всё, что джоба создала. Поэтому, когда `build` собрала каталог `dist/`, джоба `test` всё равно начинает с чистой копии репозитория, и каталога `dist/` в ней нет.\n\nЧтобы результат дошёл до следующих джоб, его объявляют [[cicd.artifact|артефактом]] строкой `artifacts: paths: [dist/]`. После успешной джобы раннер загружает эти файлы на forge, а джобы следующих стадий скачивают их перед своим скриптом, даже если они запустились на другом раннере. Артефакты можно скачать и вручную со страницы джобы, а срок их хранения задаётся отдельным ключом. Особый вид артефактов задаёт ключ `artifacts:reports`. Отчёт тестов, сохранённый под этим ключом, forge разбирает сам и показывает прямо на странице merge request.\n\n[[cicd.cache|Кэш CI]] похож на артефакт, но служит другой цели. В кэше лежат файлы, которые раннер сохраняет у себя после джобы и раскладывает перед следующим запуском, обычно скачанные зависимости. Ключ `key` решает, под каким именем раннер сохранит кэш и какие джобы потом его найдут. Каждое такое имя работает как отдельная полка, поэтому с ключом `npm-$CI_COMMIT_REF_SLUG`, где переменная `$CI_COMMIT_REF_SLUG` содержит имя ветки, у каждой ветки своя полка. С ключом `key: files: [package-lock.json]` новая полка появляется при каждом изменении lock-файла, то есть файла со списком точных версий всех библиотек проекта. Обычно кэш хранится на диске того раннера, который его сохранил. Администратор может настроить общий кэш в объектном хранилище, например в S3, и тогда полки видны всем раннерам, но и такой кэш может быть стёрт или устареть. Поэтому главное свойство кэша в том, что его наличие **не гарантировано**: джоба может попасть на другой раннер, кэш могут стереть, ключ может смениться. Джоба должна пройти и без кэша, только медленнее. Отсюда простая проверка: если без файлов джоба завершается с ошибкой, эти файлы нужно передавать артефактом, а если она только работает медленнее, их можно держать в кэше.',
        'A runner executes every job in a container started from the [[cicd.image|job image]]: `image: node:24-alpine` gives Node.js, `image: alpine:3.22` a bare Alpine. A typo in the image name kills the job before the script: `failed to pull image`. After the job the container is deleted, so everything the job created is gone. `build` built `dist/`, and `test` starts from a clean copy of the repository, without `dist/`.\n\nTo get a result through, you declare it an [[cicd.artifact|artifact]]: `artifacts: paths: [dist/]`. After a successful job the runner uploads these files to the forge, and the jobs of later stages download them before their script, even when they run on another runner. Artifacts can be downloaded by hand from the job page; how long they are kept is set separately. A special kind of artifact is set by `artifacts:reports`: a test report saved under this key is parsed by the forge itself and shown right on the merge request page.\n\nA [[cicd.cache|CI cache]] looks like an artifact but serves another purpose. It is files a runner keeps after a job and lays out before the next run, usually downloaded dependencies. The `key` decides who sees the cache: `npm-$CI_COMMIT_REF_SLUG`, where `$CI_COMMIT_REF_SLUG` holds the branch name, is a shelf per branch, and `key: files: [package-lock.json]` is a new shelf every time the lock file, the list of exact versions of all the project’s libraries, changes. Usually a cache is kept on the disk of the runner that saved it. An administrator may set up a shared cache in object storage such as S3, and then the shelves are visible to all runners, but even such a cache may be wiped or go stale. So the main property of a cache: it is **not guaranteed**. Another runner, a wiped cache, a changed key, and the job must pass without it, only slower. Hence the test: if the job fails without the files, they are an artifact; if it is only slower, a cache.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как файлы переходят от джобы к джобе и от пайплайна к пайплайну', 'How files pass from job to job and from pipeline to pipeline'),
      body: bi(
        'Схема ниже показывает два пайплайна подряд. В верхнем ряду идёт первый пайплайн: сборка build #1, тест test #1 и выкладка deploy #1, которая попала на другой раннер. Посередине лежат два хранилища: артефакты на сервере и кэш на диске раннера runner-1. В нижнем ряду идёт сборка второго пайплайна build #2, а рядом лежит файл package-lock.json, из которого может вычисляться ключ кэша. Сначала на схеме только первая сборка, остальное появляется по ходу работы. Под схемой счётчики показывают, сколько секунд занимает `npm ci` в первой и во второй сборке и сколько джоб получили каталог dist/.',
        'The diagram below shows two pipelines in a row. The top row is the first pipeline: build #1, test #1 and deploy #1, which landed on another runner. In the middle are two stores: the artifacts on the server and the cache on runner-1’s disk. The bottom row is the build of the second pipeline, build #2, next to package-lock.json, from which the cache key may be computed. At first the diagram shows only the first build; the rest appears as the work goes. Under the diagram the counters show how many seconds `npm ci` takes in the first and the second build and how many jobs got dist/.',
      ),
    },
    {
      id: 'look',
      kind: 'explainer',
      step: 'look',
      explainer: 'cicd.artifacts-cache',
      howto: bi(
        'А дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен один блок, тот, который работает сейчас, а облачко рядом с ним говорит, что он делает. По линиям проходит карточка с тем, что передаётся дальше. Жёлтая рамка означает, что кэш не нашёлся и сборка идёт дольше, а красная означает, что джоба завершилась с ошибкой. Легенда со всеми знаками собрана рядом со схемой.\n\nКогда дойдёте до второй сборки, смените в «Параметрах» ключ кэша на ключ из lock-файла и включите переключатель «Второй коммит изменил package-lock.json», а потом отправьте вторую сборку на другой раннер. Сравните время `npm ci` в счётчиках. Напоследок включите в блоке «Сломать» поломку «У сборки не объявлены артефакты», а затем «Каталог dist/ положили в кэш, а не в артефакт», и посмотрите, какая джоба завершится с ошибкой.',
        'Then go on with “Step forward” above the diagram. At every step one block is highlighted, the one working now, and the callout next to it says what it does. A card travels along the lines with what is handed on. A yellow outline means the cache was not found and the build takes longer, a red one that the job failed. The legend with all the marks is next to the diagram.\n\nOnce you reach the second build, switch the cache key to the lock-file key in “Parameters” and switch on “The second commit changes package-lock.json”, then send the second build to another runner. Compare the `npm ci` time in the counters. Finally, in “Break it” switch on “No artifacts: declared”, then “dist/ put into the cache, not an artifact”, and see which job fails.',
      ),
      caption: bi('В первой практике ниже джоба test завершается с ошибкой так же, как при поломке «У сборки не объявлены артефакты». Когда увидите в журнале `test -f dist/index.html` и код 1, вспомните схему и решите, через какое хранилище каталог dist/ должен дойти до теста.', 'In the first practice below the test job fails just as with the break “No artifacts: declared”. When you see `test -f dist/index.html` and code 1 in the log, remember the diagram and decide through which store dist/ must reach the test.'),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: projectSetup({ '.gitlab-ci.yml': ARTIFACT_CI }),
      intro: bi('В проекте уже есть файл пайплайна с двумя джобами, build и test.', 'The project already has a pipeline file with two jobs: build and test.'),
      tasks: [
        {
          id: 'artifact',
          prompt: bi('Отправьте пустой коммит командами `git commit --allow-empty -m "Run CI"` и `git push`, прочитайте, почему `test` завершается с ошибкой, и почините пайплайн, не меняя скриптов джоб.', 'Push an empty commit (`git commit --allow-empty -m "Run CI"`, `git push`), read why `test` fails, and fix the pipeline without changing the job scripts.'),
          check: {
            when: (f) => mainOk(f) && (jobOf(f, 'test', { ref: 'main' })?.log ?? '').includes('Downloading artifacts for build'),
            fail: [lintFail, { if: (f) => (pushedCi(f)?.config?.jobs.find((j) => j.name === 'build')?.cache?.paths ?? []).some((p) => p.startsWith('dist')), say: bi('Кэш не гарантирует, что каталог dist/ дойдёт до теста, и если кэш не найдётся, тест снова завершится с ошибкой. Результат сборки передают через artifacts.', 'dist/ in a cache is not guaranteed: on a miss the test fails again. Results are passed with artifacts.') }],
          },
          chips: 'glab ci trace test',
          concepts: ['cicd.artifact'],
          docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'artifacts', line: 'dist/' },
          hints: { H1: bi('Джоба test ищет каталог dist/, а он остался в контейнере джобы build.', 'test looks for dist/, which stayed on build’s machine.'), H2: bi('Добавьте в джобу build ключ `artifacts:`, а под ним строку `paths: [dist/]`.', 'In the build job: `artifacts:` and under it `paths: [dist/]`.') },
        },
        {
          id: 'cache',
          prompt: bi('Команда `npm ci` в джобе build каждый раз ставит зависимости заново. Добавьте кэш каталога `.npm/` с ключом по имени ветки и отправьте два коммита подряд. Во втором пайплайне джоба build должна найти кэш и пройти быстрее.', '`npm ci` in build installs the dependencies from scratch every time. Add a cache of the `.npm/` directory keyed by branch and push two commits in a row: in the second pipeline build must find the cache and run faster.'),
          check: {
            when: (f) => {
              const ps = (ci(f)?.pipelines ?? []).filter((p) => p.ref === 'main' && p.status === 'success');
              const last2 = ps.slice(-2).map((p) => p.jobs.find((j) => j.name === 'build'));
              return last2.length === 2 && last2[0]?.cacheHit === false && last2[1]?.cacheHit === true && (last2[1]!.end! - last2[1]!.start!) < (last2[0]!.end! - last2[0]!.start!) && branchKey(f);
            },
            fail: [
              lintFail,
              { if: (f) => !!pushedCi(f)?.config?.jobs.find((j) => j.name === 'build')?.cache && !branchKey(f), say: bi('Кэш объявлен, но его ключ не зависит от ветки: в нём нет переменной $CI_COMMIT_REF_SLUG или $CI_COMMIT_REF_NAME. Если файл записан командой printf или echo в двойных кавычках, оболочка подставила вместо переменной пустую строку, и ключ стал одинаковым для всех веток. Откройте файл командой cat и проверьте строку key.', 'The cache is declared, but its key does not depend on the branch: there is no $CI_COMMIT_REF_SLUG or $CI_COMMIT_REF_NAME in it. If you wrote the file with printf or echo in double quotes, the shell put an empty string in place of the variable, and the key became the same for every branch. Open the file with cat and check the key line.') },
              { if: (f) => (lastPipeline(f, { ref: 'main' })?.jobs.find((j) => j.name === 'build')?.cacheHit) === false, say: bi('Первый пайплайн пока только сохранил кэш. Отправьте ещё один коммит, и следующая сборка найдёт кэш и пройдёт быстрее.', 'The first pipeline has only saved the cache so far. Push one more commit, and the next build will find the cache and run faster.') }],
          },
          chips: 'glab ci trace build',
          concepts: ['cicd.cache'],
          docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'cache', line: 'CI_COMMIT_REF_SLUG' },
          hints: { H1: bi('В джобе build нужен ключ cache: с подключами key и paths.', 'cache: key and paths in the build job.'), H2: bi('```yaml\n  cache:\n    key: npm-$CI_COMMIT_REF_SLUG\n    paths: [.npm/]\n```', '```yaml\n  cache:\n    key: npm-$CI_COMMIT_REF_SLUG\n    paths: [.npm/]\n```') },
        },
        {
          id: 'expire',
          prompt: bi('Артефакты сборки занимают место на forge. Найдите в справочнике ключевых слов GitLab, как хранить артефакт `dist/` одну неделю, и отправьте пайплайн с этим сроком.', 'Build artifacts take space on the forge. Find in the GitLab keyword reference how to keep the `dist/` artifact for one week, and push a pipeline with that expiry.'),
          check: { when: (f) => mainOk(f) && /^1\s*(week|wk|weeks)$|^7\s*(days?|d)$/.test(pushedCi(f)?.config?.jobs.find((j) => j.name === 'build')?.artifacts?.expireIn ?? '') },
          docStep: 3,
          chips: 'artifacts:expire_in',
          docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'artifacts', line: 'expire_in' },
          hints: { H1: bi('Нужный параметр вложен в ключ artifacts, а срок в нём записывают английскими словами.', 'It is a sub-key of artifacts; the value is written in words.') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Кэш зависимостей теперь объявлен и у build, и у test. После успешного завершения обе джобы заново загружают его на полку, хотя test ничего в нём не меняет, и каждый пайплайн тратит на это время. Сделайте так, чтобы test только брала кэш, а обновляла его одна build. В уроке об этом не рассказывалось, поэтому найдите ответ в справочнике GitLab.', 'The dependency cache is now declared on both build and test. After success both jobs upload it to the shelf again, although test changes nothing in it, and every pipeline spends time on that. Let test only take the cache, and let build alone update it. The lesson did not cover it: look it up in the GitLab reference.'),
      ref: { page: 'web/docs.gitlab.com/ci/yaml' },
      terminal: {
        setup: projectSetup({ '.gitlab-ci.yml': CACHE_BOTH_CI }),
        task: {
          id: 'pull',
          prompt: bi('Джоба test скачивает кэш, но не сохраняет его, build по-прежнему его сохраняет, а пайплайн main зелёный.', 'test downloads the cache but does not save it; build still saves it; the main pipeline is green.'),
          check: {
            when: (f) => {
              const t = jobOf(f, 'test', { ref: 'main' });
              const b = jobOf(f, 'build', { ref: 'main' });
              return mainOk(f) && pushedCi(f)?.config?.jobs.find((j) => j.name === 'test')?.cache?.policy === 'pull' && !!t && !t.log.includes('Saving cache') && t.log.includes('Checking cache') && !!b && b.log.includes('Saving cache');
            },
          },
          docStep: 4,
          beyond: true,
          solutionTokens: ['policy: pull', 'cache:policy', 'pull'],
        },
      },
    },
    { id: 'board', kind: 'widget', step: 'practice', widget: 'cicd.board' },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['cicd.q.cache-art', 'cicd.q.no-artifact'] },
  ],
};

const DEPLOY_CI = `stages: [build, test, deploy]

build:
  stage: build
  image: node:24-alpine
  script:
    - npm ci --cache .npm --prefer-offline
    - npm run build
  artifacts:
    paths: [dist/]

test:
  stage: test
  image: node:24-alpine
  script:
    - npm test

deploy_staging:
  stage: deploy
  image: alpine:3.22
  script:
    - ./deploy.sh staging
  environment: staging
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

deploy_production:
  stage: deploy
  image: alpine:3.22
  script:
    - ./deploy.sh production
  environment: production
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
`;

const varsLesson: Lesson = {
  id: 'cicd.variables-envs',
  block: 'cicd',
  title: bi('Секреты, окружения и ручной шаг', 'Secrets, environments and the manual step'),
  summary: bi('Секрет хранится в настройках проекта, а не в репозитории. Окружение помнит, какие версии в него выложены. Одна строка when: manual отличает Continuous Delivery от Continuous Deployment.', 'A secret is kept in the project settings, not in the repository. An environment remembers what was deployed to it. One line, when: manual, tells Continuous Delivery from Continuous Deployment.'),
  introduces: ['cicd.variable', 'cicd.environment', 'cicd.manual'],
  uses: ['cicd.artifact', 'cicd.job'],
  tier: 'core',
  minutes: 35,
  sources: src([S.variables, S.envs, S.fowlerCd], [S.ruCd, S.ruCi]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Пайплайн уже собирает и проверяет сайт, и пора выкладывать его на сервер. Скрипту выкладки нужен токен, и первое желание состоит в том, чтобы вписать его прямо в файл пайплайна. Но тогда токен попадёт в историю репозитория и окажется у каждого, кто её скопирует. В этом уроке вы зададите секрет в настройках проекта, выложите сайт на тестовый стенд и поставите перед рабочим сервером ручной шаг, который запускает человек.',
        'The pipeline already builds and checks the site, and it is time to deploy it. The deploy script needs a token, and the first impulse is to write it straight into the pipeline file. But then the token gets into the repository history and ends up with everyone who copies it. In this lesson you set the secret in the project settings, deploy the site to staging and put a manual step that a person runs in front of production.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Для выкладки нужен ключ: пароль, токен или SSH-ключ. Класть его в репозиторий нельзя, потому что всё, что попало в историю, остаётся там навсегда и видно каждому, у кого есть копия. Поэтому секреты задают в настройках проекта на forge, в разделе Settings → CI/CD → Variables или командой `glab variable set`, и forge передаёт их джобе как переменные окружения. Такие значения называются [[cicd.variable|переменными CI/CD]]. Кроме них, джоба всегда получает предопределённые переменные, например `$CI_COMMIT_SHORT_SHA`, `$CI_COMMIT_BRANCH`, `$CI_DEFAULT_BRANCH` и `$CI_PIPELINE_SOURCE`.\n\nКаждая джоба выполняется отдельным процессом в чистом контейнере, поэтому переменная, которую скрипт одной джобы задал командой `export`, в следующую джобу не попадёт, так же как не попадают туда файлы без артефактов. Если значение, вычисленное в одной джобе, нужно другой, его записывают в файл вида `VERSION=1.4.2`, объявляют этот файл артефактом `artifacts: reports: dotenv: build.env`, и следующие джобы получают его строки как переменные окружения.\n\nУ переменной есть два важных флага. Флаг **Masked** заставляет раннер заменять значение в журнале на `[MASKED]`, но только точное значение, поэтому команда `echo $TOKEN | base64` выведет его в другом виде, и маска не поможет. Флаг **Protected** означает, что переменную получают только пайплайны защищённых веток и тегов. Любой, кто может отправить ветку на сервер, может написать в ней `echo $DEPLOY_TOKEN`, но в такой ветке защищённая переменная окажется пустой.\n\n### Окружения и ручной шаг\n\nДжоба с `environment: staging` выкладывает версию в [[cicd.environment|окружение CI]], и forge ведёт его историю: какой коммит, когда и каким пайплайном выложен. Чтобы откатиться, повторяют старую успешную выкладку.\n\nПоследний шаг пайплайна отвечает на вопрос, который вы видели в блоке методологии. Если рабочий сервер обновляется сам после тестового стенда, это Continuous Deployment. Если перед ним стоит [[cicd.manual|ручная джоба]] со строкой `when: manual`, которую запускают кнопкой ▶ на странице пайплайна или командой `glab ci trigger`, это Continuous Delivery. При ней каждая версия готова к выпуску, а выпускать ли её, решает человек. Две практики отличаются одной строкой YAML.\n\nВ файле пайплайна этого урока у джоб выкладки уже есть ключ `rules`. Это список условий, по которым джоба попадает в пайплайн, и подробно его разберёт следующий урок. Сейчас важно одно: строка `if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH` означает «только для коммитов в основную ветку», а когда у джобы есть `rules`, способ запуска задаёт сработавшее правило. Поэтому строку `when: manual` пишут внутри правила, на одном уровне со словом `if`, а строка `when` на уровне самой джобы рядом с `rules` ручного шага не даст. Ручная джоба, заданная в `rules`, держит пайплайн в состоянии **blocked**, пока её не запустят.',
        'A deployment needs a key: a password, a token, an SSH key. It must not go into the repository: whatever gets into the history stays there forever, visible to anyone who has a copy. So secrets are set in the project settings on the forge (Settings → CI/CD → Variables, or `glab variable set`), and the forge passes them to the job as environment variables. These are [[cicd.variable|CI/CD variables]]. Next to them a job always gets the predefined ones: `$CI_COMMIT_SHORT_SHA`, `$CI_COMMIT_BRANCH`, `$CI_DEFAULT_BRANCH`, `$CI_PIPELINE_SOURCE`.\n\nEvery job runs as a separate process in a clean container, so a variable one job’s script set with `export` does not reach the next job, just as files do not without artifacts. If a value computed in one job is needed by another, it is written to a file like `VERSION=1.4.2`, the file is declared as an `artifacts: reports: dotenv: build.env` artifact, and the later jobs get its lines as environment variables.\n\nA variable has two important flags. **Masked**: the runner replaces the value in the log with `[MASKED]`, but only the exact value; `echo $TOKEN | base64` prints it in another form and the mask does not help. **Protected**: only pipelines of protected branches and tags get the variable. Anyone who can push a branch can write `echo $DEPLOY_TOKEN` in it; on such a branch a protected variable is simply empty.\n\n### Environments and the manual step\n\nA job with `environment: staging` deploys to a [[cicd.environment|CI environment]], and the forge keeps its history: which commit, when, by which pipeline. Rolling back means repeating an old successful deployment.\n\nThe last step of the pipeline answers a question from the methodology block. If production updates by itself after staging, it is Continuous Deployment. If a [[cicd.manual|manual job]] stands before it (`when: manual`, the ▶ button on the pipeline page, `glab ci trigger`), it is Continuous Delivery: every version is ready to release, and releasing is a human decision. The difference is one line of YAML.\n\nIn this lesson’s pipeline file the deploy jobs already have the `rules` key. It is a list of conditions that put a job into a pipeline, and the next lesson covers it in detail. For now one thing matters: the line `if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH` means “only for commits to the main branch”, and when a job has `rules`, the matching rule decides how the job starts. So `when: manual` is written inside the rule, at the level of the word `if`, and a `when` line at the level of the job itself next to `rules` gives no manual step. A manual job set in `rules` keeps the pipeline **blocked** until someone runs it.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: projectSetup({ '.gitlab-ci.yml': DEPLOY_CI }),
      intro: bi('Пайплайн выкладывает сайт на тестовый стенд staging и на рабочий сервер production. Скрипту `deploy.sh` нужна переменная `DEPLOY_TOKEN`, а токен выкладки равен `edu-deploy-7Kq2`.', 'The pipeline deploys to staging and production. The `deploy.sh` script needs the `DEPLOY_TOKEN` variable; the deploy token is `edu-deploy-7Kq2`.'),
      tasks: [
        {
          id: 'secret',
          prompt: bi('Задайте `DEPLOY_TOKEN` в настройках проекта с флагами masked и protected и отправьте коммит в main, после чего тестовый стенд должен обновиться. Значения токена в журнале быть не должно.', 'Set `DEPLOY_TOKEN` in the project settings as masked and protected, push a commit to main, and staging must update. The token value must not appear in the log.'),
          check: {
            when: (f) => (ci(f)?.deployments ?? []).some((d) => d.env === 'staging') && (ci(f)?.variables ?? []).some((v) => v.key === 'DEPLOY_TOKEN' && v.masked && v.protected) && !(ci(f)?.pipelines ?? []).some((p) => p.jobs.some((j) => j.log.includes('edu-deploy-7Kq2'))),
            fail: [
              lintFail,
              { if: (f) => forge(f)?.commits.some((c) => Object.values(c.files).some((t) => t.includes('edu-deploy-7Kq2'))) ?? false, say: bi('Токен попал в коммит на forge и теперь хранится в истории. Уберите его из файлов, задайте как переменную в настройках проекта и считайте, что токен утёк.', 'The token got into a commit on the forge: it is in the history now. Remove it from the files, set it as a variable and treat the token as leaked.') },
              { if: (f) => (jobOf(f, 'deploy_staging')?.log ?? '').includes('DEPLOY_TOKEN is not set'), say: bi('Джоба выкладки не получила токен, поэтому задайте переменную командой glab variable set DEPLOY_TOKEN … --masked --protected.', 'The deploy job did not get the token. Set the variable: glab variable set DEPLOY_TOKEN … --masked --protected.') },
            ],
          },
          chips: 'glab variable set DEPLOY_TOKEN edu-deploy-7Kq2 --masked --protected',
          concepts: ['cicd.variable', 'cicd.environment'],
          hints: { H1: bi('Секрет задают в настройках проекта, а не в файле.', 'The secret goes to the project settings, not to a file.') },
        },
        {
          id: 'manual',
          prompt: bi('Сейчас рабочий сервер обновляется сам, и это Continuous Deployment. Сделайте Continuous Delivery, то есть выкладку на рабочий сервер только по кнопке. Отправьте изменение, а затем сами запустите выкладку на рабочий сервер.', 'Right now production deploys by itself: Continuous Deployment. Make it Continuous Delivery: production only on a button press. Push the change, then run the production deployment yourself.'),
          check: {
            when: (f) => {
              const p = lastPipeline(f, { ref: 'main' });
              const job = pushedCi(f)?.config?.jobs.find((j) => j.name === 'deploy_production');
              const manualInFile = !!job && (job.when === 'manual' || (job.rules ?? []).some((r) => r.when === 'manual'));
              return manualInFile && p?.jobs.find((j) => j.name === 'deploy_production')?.status === 'success' && (p?.jobs.find((j) => j.name === 'deploy_production')?.when === 'manual');
            },
            fail: [
              lintFail,
              { if: (f) => lastPipeline(f, { ref: 'main' })?.status === 'blocked', say: bi('Пайплайн остановился перед ручной джобой и ждёт, пока её запустят. Запустите выкладку командой glab ci trigger deploy_production.', 'The pipeline stopped before the manual job and waits for someone to start it. Start the deploy with glab ci trigger deploy_production.') }],
          },
          chips: 'glab ci trigger deploy_production',
          concepts: ['cicd.manual'],
          docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'when', line: 'manual' },
          hints: {
            H1: bi('Допишите строку when: manual в правило джобы deploy_production. Правила rules подробно разберёт следующий урок, а пока достаточно добавить одну строку.', 'Add the line when: manual to the rule of the deploy_production job. The next lesson covers rules in detail; for now one added line is enough.'),
            H2: bi('Конец джобы должен выглядеть так, причём строка `when: manual` стоит ровно под словом `if`:\n```yaml\n  rules:\n    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\n      when: manual\n```', 'The end of the job must look like this, with `when: manual` exactly under the word `if`:\n```yaml\n  rules:\n    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\n      when: manual\n```'),
          },
        },
      ],
    },
    { id: 'board', kind: 'widget', step: 'practice', widget: 'cicd.board' },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['cicd.q.protected', 'cicd.q.base64', 'cicd.q.delivery'] },
  ],
};

const RULES_CI = `stages: [build, test, deploy]

build:
  stage: build
  image: node:24-alpine
  script:
    - npm ci --cache .npm --prefer-offline
    - npm run build
  artifacts:
    paths: [dist/]

lint:
  stage: build
  image: node:24-alpine
  script:
    - sleep 90
    - ./lint.sh

test:
  stage: test
  image: node:24-alpine
  script:
    - npm test

deploy_staging:
  stage: deploy
  image: alpine:3.22
  script:
    - ./deploy.sh staging
  environment: staging
`;

const rulesLesson: Lesson = {
  id: 'cicd.rules-needs',
  block: 'cicd',
  title: bi('Правила и зависимости между джобами', 'Rules and the job graph'),
  summary: bi('Один файл пайплайна ведёт себя по-разному в merge request, в ветке main и на теге, а needs позволяет джобам не ждать конца всей стадии.', 'One pipeline file behaves differently in a merge request, on main and on a tag; needs lets jobs skip waiting for the whole stage.'),
  introduces: ['cicd.rules', 'cicd.needs'],
  uses: ['cicd.manual', 'cicd.stage', 'git.mr'],
  tier: 'core',
  minutes: 35,
  sources: src([S.yaml, S.needs, S.mr], [S.ruFirst, S.ruActions]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Пайплайн проекта вырос: в нём сборка, медленный линтер, тесты и выкладка на тестовый стенд. Каждый merge request теперь ждёт результатов проверок по нескольку минут, потому что тесты стоят в очереди за линтером, который им не нужен. А выкладка на тестовый стенд запускается из любой ветки, хотя должна запускаться только из main. В этом уроке вы научите пайплайн по-разному вести себя в merge request и в main и укажете джобам, от каких джоб они на самом деле зависят.',
        'The project pipeline has grown: a build, a slow linter, tests and a staging deploy. Every merge request now waits several minutes for the checks, because the tests queue behind a linter they do not need. And the staging deploy runs from any branch, though it should run only from main. In this lesson you teach the pipeline to behave differently in a merge request and on main, and tell jobs which jobs they actually depend on.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Пайплайн запускается по разным событиям: при отправке ветки, при открытии merge request и при создании тега версии. Какие джобы попадут в пайплайн, решают [[cicd.rules|rules]], то есть список условий у джобы. Правила проверяются по порядку в момент создания пайплайна. Первое подошедшее правило решает, как джоба войдёт в пайплайн (`when: on_success`, `manual` или `never`), а если не подошло ни одно, джобы в пайплайне не будет. Если в подошедшем правиле своего `when` нет, действует `when`, записанный у самой джобы, а если нет и его, джоба запускается обычным порядком, как при `on_success`. Условие `if` записывается выражением над переменными. Выражение `$CI_PIPELINE_SOURCE == "merge_request_event"` означает пайплайн merge request, выражение `$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH` означает отправку в main, а выражение `$CI_COMMIT_TAG =~ /^v\\d+\\.\\d+\\.\\d+$/` означает тег версии. Ключ `changes` добавляет джобу, только если в отправленных коммитах менялись указанные файлы.\n\nСтадии задают порядок грубо: джоба ждёт **всю** предыдущую стадию, даже если ей нужна только одна джоба из неё. Ключ [[cicd.needs|needs]] задаёт зависимости точно. Строка `needs: [build]` означает, что джоба стартует, как только готова `build`, и скачивает артефакты только от неё, а строка `needs: []` означает, что джоба стартует сразу. Пайплайн превращается из лесенки стадий в граф и часто становится заметно короче. Платить за это приходится вниманием к графу: если `needs` ссылается на джобу, которую `rules` исключили из пайплайна, сервер не создаёт пайплайн вовсе.',
        'A pipeline starts on different events: a push to a branch, a merge request, a version tag. Which jobs get into the pipeline is decided by [[cicd.rules|rules]], a list of conditions on a job. Rules are checked in order when the pipeline is created; the first match decides how the job enters (`when: on_success`, `manual`, `never`), and if none matches, the job is not in the pipeline. If the matching rule has no `when` of its own, the `when` written on the job applies, and if there is none either, the job runs in the usual order, as with `on_success`. An `if` condition is an expression over variables: `$CI_PIPELINE_SOURCE == "merge_request_event"` (a merge request pipeline), `$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH` (a push to main), `$CI_COMMIT_TAG =~ /^v\\d+\\.\\d+\\.\\d+$/` (a version tag). `changes` adds a job only if the push changed the given files.\n\nStages set the order coarsely: a job waits for the **whole** previous stage even if it needs one job of it. [[cicd.needs|needs]] sets the dependencies exactly: `needs: [build]` means start as soon as `build` is done and download artifacts only from it; `needs: []` means start at once. The pipeline turns from a "staircase of stages" into a graph and is often noticeably shorter. The price is watching the graph: `needs` on a job that `rules` removed from the pipeline makes the pipeline invalid.',
      ),
    },
    {
      id: 'trap',
      kind: 'callout',
      tone: 'warn',
      title: bi('Почему пайплайна merge request может не быть вовсе', 'Why a merge request may have no pipeline at all'),
      body: bi(
        'Джоба, у которой нет ключа `rules`, попадает в пайплайн ветки, но в пайплайн merge request не попадает. Сам пайплайн merge request создаётся, только если хотя бы у одной джобы есть подходящее правило для события `merge_request_event`. Поэтому если правила есть только у выкладки и в них записано условие про main, ни одна джоба под это событие не подходит, и пайплайна merge request не будет совсем. Страница merge request при этом показывает пайплайн ветки, и в выводе `glab mr view` в скобках после статуса будет написано `source: push`, а не `source: merge_request_event`. Чтобы проверки шли в merge request, каждой из них нужно правило для этого события.\n\nЕсли же дать джобам правила и для merge request, и для любой ветки, на один push появятся два пайплайна сразу, пайплайн ветки и пайплайн merge request. Поэтому в настоящих проектах вверху файла пишут общий ключ `workflow: rules:`, который решает, какой пайплайн создавать вообще, например только для merge request и для main, а правила отдельных джоб уже не дублируют его.',
        'A job with no `rules` gets into a branch pipeline but not into a merge request pipeline. A merge request pipeline itself is created only if at least one job has a matching rule for the `merge_request_event` event. So if only the deploy has rules and they say main, no job matches that event, and there is no merge request pipeline at all. The merge request page then shows the branch pipeline, and `glab mr view` prints `source: push` in parentheses after the status, not `source: merge_request_event`. For the checks to run in a merge request, each of them needs a rule for that event.\n\nIf, on the other hand, you give jobs rules both for merge requests and for any branch, one push creates two pipelines at once, a branch pipeline and a merge request pipeline. So real projects write a common `workflow: rules:` key at the top of the file, which decides which pipeline to create at all, for example only for merge requests and for main, and the rules of single jobs no longer duplicate it.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как стадии и needs решают, когда стартует джоба', 'When a job starts: stages and needs'),
      body: bi(
        'Схема ниже показывает пайплайн из четырёх джоб. В первой стадии стоят сборка build, которая идёт 20 секунд, и медленный линтер lint, который идёт 90 секунд. Тестам test нужна только сборка, а выкладке deploy_staging нужны только тесты. Внизу справа сервер считает время всего пайплайна. Сначала на схеме только две джобы первой стадии, а подпись каждого шага на шкале показывает секунду пайплайна, на которой этот шаг происходит. Пунктирная линия от линтера к тестам означает неявную зависимость: без needs тесты ждут конца всей стадии.',
        'The diagram below shows a pipeline of four jobs. The first stage has build, which takes 20 seconds, and a slow linter, lint, which takes 90. The tests need only the build, and deploy_staging needs only the tests. In the lower right the server counts the whole pipeline time. At first the diagram shows only the two jobs of the first stage, and the label of each step on the scale shows the pipeline second at which it happens. The dashed line from the linter to the tests is the implicit dependency: without needs the tests wait for the whole stage to end.',
      ),
    },
    {
      id: 'look',
      kind: 'explainer',
      step: 'look',
      explainer: 'cicd.stages-needs',
      howto: bi(
        'А дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен один блок, тот, который работает сейчас, а облачко рядом с ним говорит, что он делает. По линиям проходит карточка с тем, что передаётся дальше. Пунктирная рамка означает, что джоба ждёт, а красная означает, что сервер отказался создавать пайплайн. Легенда со всеми знаками собрана рядом со схемой.\n\nПервый проход идёт без needs, и тесты ждут линтер. Потом включите в «Параметрах» переключатель «У test и deploy записаны needs» и сравните время пайплайна в счётчиках. Подвигайте длительность линтера и оставьте один свободный раннер. Напоследок включите в блоке «Сломать» поломку «Правило rules убрало build из пайплайна merge request» и прочитайте сообщение сервера.',
        'Then go on with “Step forward” above the diagram. At every step one block is highlighted, the one working now, and the callout next to it says what it does. A card travels along the lines with what is handed on. A dashed outline means the job waits, a red one that the server refused to create the pipeline. The legend with all the marks is next to the diagram.\n\nThe first run is without needs, and the tests wait for the linter. Then switch on “needs on test and deploy” in “Parameters” and compare the pipeline time in the counters. Move the linter duration and leave one free runner. Finally, in “Break it” switch on “rules removed build from the pipeline” and read the server’s message.',
      ),
      caption: bi('В практике ниже вы сделаете то же, что делали на схеме: допишете джобе test строку `needs: [build]`, а потом добавите правила. Если после правок сервер ответит, что джоба нужна, но в пайплайне её нет, проверьте, не исключили ли rules ту джобу, на которую ссылается needs.', 'In the practice below you do what you did in the diagram: add `needs: [build]` to the test job, then add rules. If after your edits the server answers that a job is needed but missing from the pipeline, check whether rules excluded the job needs refers to.'),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: projectSetup({ '.gitlab-ci.yml': RULES_CI }, { forge: [{ project: 'team/site', variables: [{ key: 'DEPLOY_TOKEN', value: 'edu-deploy-7Kq2', masked: true, protected: true }] }] }),
      intro: bi('Линтер работает полторы минуты и задерживает тесты, а выкладка на тестовый стенд запускается из любой ветки.', 'The linter takes a minute and a half of model time and holds the tests back. The staging deploy runs on any branch.'),
      tasks: [
        {
          id: 'needs',
          prompt: bi('Сделайте так, чтобы джоба `test` стартовала сразу после `build` и не ждала `lint`, и отправьте изменение в main. Пайплайн должен пройти.', 'Make `test` start right after `build` without waiting for `lint`, and push to main. The pipeline must pass.'),
          check: {
            when: (f) => {
              const p = lastPipeline(f, { ref: 'main' });
              const b = p?.jobs.find((j) => j.name === 'build');
              const l = p?.jobs.find((j) => j.name === 'lint');
              const t = p?.jobs.find((j) => j.name === 'test');
              return p?.status === 'success' && !!b && !!l && !!t && (t.start ?? 0) >= (b.end ?? 0) && (t.start ?? 0) < (l.end ?? 0);
            },
            fail: [lintFail],
          },
          chips: 'glab ci view',
          concepts: ['cicd.needs'],
          docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'needs', line: 'needs: ["linux:build"]' },
          hints: { H1: bi('Запишите у джобы test, какая джоба ей на самом деле нужна.', 'Tell test what it actually needs.'), H2: bi('Добавьте в джобу test строку `needs: [build]`.', '`needs: [build]` in the test job.') },
        },
        {
          id: 'rules',
          prompt: bi('Выкладка на тестовый стенд должна запускаться только при отправке в main, а в ветках и merge request её быть не должно. Чтобы проверить это, отправьте ветку `feature/menu` и откройте из неё merge request. В пайплайне этого merge request должны быть `build`, `lint` и `test`, а выкладки быть не должно. Нужные условия записаны в тексте урока выше.', 'Staging deploys only on a push to main; never on branches and merge requests. Check it: push a branch `feature/menu` and open a merge request from it; its pipeline must have `build`, `lint` and `test`, without the deploy. The conditions you need are written in the lesson text above.'),
          check: {
            when: (f) => {
              const mrp = lastPipeline(f, { source: 'merge_request_event' });
              const names = (mrp?.jobs ?? []).map((j) => j.name).sort().join(',');
              const cfg = pushedCi(f)?.config;
              const dep = cfg?.jobs.find((j) => j.name === 'deploy_staging');
              return names === 'build,lint,test' && !!dep?.rules?.length;
            },
            fail: [
              lintFail,
              { if: (f) => (forge(f)?.mrs ?? []).some((m) => m.source === 'feature/menu') && !lastPipeline(f, { source: 'merge_request_event' }), say: bi('Merge request открыт, но пайплайна merge request у него нет, потому что ни у одной джобы нет правила для события merge_request_event. Пайплайн, который показывает glab mr view, запущен для ветки, поэтому в скобках у него написано source: push. Дайте build, lint и test правило для merge_request_event, как сказано в предупреждении выше.', 'The merge request is open, but it has no merge request pipeline, because no job has a rule for the merge_request_event event. The pipeline glab mr view shows runs for the branch, so it is marked source: push in parentheses. Give build, lint and test a rule for merge_request_event, as the warning above says.') },
              { if: (f) => !!lastPipeline(f, { source: 'merge_request_event' }) && !(lastPipeline(f, { source: 'merge_request_event' })?.jobs.some((j) => j.name === 'test')), say: bi('Джобы без rules в пайплайн merge request не попадают, поэтому дайте build, lint и test правило для merge_request_event и правило для main.', 'Jobs without rules do not get into merge request pipelines. Give build, lint and test a rule for merge_request_event and for main.') },
              { if: (f) => (lastPipeline(f, { source: 'merge_request_event' })?.jobs ?? []).some((j) => j.name === 'deploy_staging'), say: bi('Выкладка всё ещё попадает в пайплайн merge request, а её правило должно проверять, что коммит пришёл в ветку main.', 'The deploy is still in the merge request pipeline: its rule must check for the main branch.') },
            ],
          },
          chips: 'glab mr create --fill --target-branch main',
          concepts: ['cicd.rules'],
          docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'rules', line: 'merge_request_event' },
          hints: { H1: bi('Нужны правила двух видов: для проверок, которые идут в merge request и в main, и для выкладки, которая идёт только в main.', 'You need two kinds of rules: for the checks (MR or main) and for the deploy (main only).'), H2: bi('Проверкам дайте `rules: [{if: \'$CI_PIPELINE_SOURCE == "merge_request_event"\'}, {if: \'$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\'}]`, а выкладке оставьте только второе правило.', 'For the checks: `rules: [{if: \'$CI_PIPELINE_SOURCE == "merge_request_event"\'}, {if: \'$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\'}]`; for the deploy, only the second.') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Линтер стиля иногда завершается с ошибкой на старых страницах, и команда решила, что его падение не должно останавливать пайплайн, но должно оставаться видимым предупреждением. Тесты при этом должны по-прежнему останавливать пайплайн. В уроке такого ключа не было, поэтому найдите его в справочнике GitLab.', 'The style linter sometimes fails on old pages, and the team decided its failure must not block the pipeline but stay visible as a warning. The tests must still block. The lesson did not show this key: find it in the GitLab reference.'),
      ref: { page: 'web/docs.gitlab.com/ci/yaml' },
      terminal: {
        setup: projectSetup({ '.gitlab-ci.yml': RULES_CI, 'src/old.html': '<title>Old</title>\n<h1>Old page</h1>\n<p style="color:red">Closed for renovation</p>\n' }, { forge: [{ project: 'team/site', variables: [{ key: 'DEPLOY_TOKEN', value: 'edu-deploy-7Kq2', masked: true, protected: true }] }] }),
        task: {
          id: 'allow',
          prompt: bi('Джоба lint завершается с ошибкой, пайплайн main проходит, а джобу test вы не меняли.', 'lint fails, the main pipeline passes, test is untouched.'),
          check: {
            when: (f) => {
              const p = lastPipeline(f, { ref: 'main' });
              const t = pushedCi(f)?.config?.jobs.find((j) => j.name === 'test');
              return p?.status === 'success' && p.jobs.find((j) => j.name === 'lint')?.status === 'failed' && !!t && !t.allowFailure && 'src/old.html' in (forge(f)?.commits.find((c) => c.oid === forge(f)?.branches.main)?.files ?? {});
            },
          },
          docStep: 4,
          beyond: true,
          solutionTokens: ['allow_failure', 'allow_failure: true'],
        },
      },
    },
    { id: 'board', kind: 'widget', step: 'practice', widget: 'cicd.board' },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['cicd.q.rules', 'cicd.q.needs'] },
  ],
};

export const lessons: Lesson[] = [remoteLesson, firstLesson, artifactsLesson, varsLesson, rulesLesson];

const placement: PlacementTask[] = [
  { id: 'cicd.place.cache', level: 'intermediate', key: true, concepts: ['cicd.cache', 'cicd.artifact'], kind: 'quiz', item: { ...(quiz.find((q) => q.id === 'cicd.q.cache-art') as QuizItem), id: 'cicd.place.q.cache' } },
  {
    id: 'cicd.place.stages',
    level: 'intermediate',
    key: true,
    concepts: ['cicd.stage'],
    kind: 'task',
    setup: projectSetup({ '.gitlab-ci.yml': 'build:\n  image: alpine:3.22\n  script: [./build.sh]\n\ntest:\n  image: alpine:3.22\n  script: [./test.sh]\n\ndeploy:\n  image: alpine:3.22\n  script: [echo deploy]\n' }),
    task: {
      id: 'p1',
      prompt: bi('Три джобы стоят в одной стадии test. Сделайте так, чтобы build шла раньше test, а deploy шла последней, и отправьте изменение в main.', 'Three jobs are in one stage, test. Make build run before test and deploy last, and push to main.'),
      check: {
        when: (f) => {
          const p = lastPipeline(f, { ref: 'main' });
          const j = (n: string) => p?.jobs.find((x) => x.name === n);
          return p?.status === 'success' && (j('build')?.end ?? 1e9) <= (j('test')?.start ?? -1) && (j('test')?.end ?? 1e9) <= (j('deploy')?.start ?? -1);
        },
      },
    },
  },
  {
    id: 'cicd.place.stuck',
    level: 'intermediate',
    key: false,
    concepts: ['cicd.runner'],
    kind: 'task',
    setup: projectSetup({ '.gitlab-ci.yml': 'test:\n  image: alpine:3.22\n  tags: [dokcer]\n  script: [./test.sh]\n' }),
    task: {
      id: 'p2',
      prompt: bi('Джоба test в ветке main висит в состоянии pending. Найдите причину и добейтесь зелёного пайплайна.', 'The test job on main hangs in pending. Find the cause and get a green pipeline.'),
      check: { when: (f) => mainOk(f) },
    },
  },
  {
    id: 'cicd.place.delivery',
    level: 'experienced',
    key: false,
    concepts: ['cicd.manual'],
    kind: 'quiz',
    item: {
      id: 'cicd.place.q.delivery',
      kind: 'mcq',
      concepts: ['cicd.manual'],
      prompt: bi('После каждого слияния в main пайплайн сам, без участия человека, выкладывает версию сначала на тестовый стенд, а потом на рабочий сервер. Как называется такая практика?', 'After every merge into main the pipeline deploys the version first to staging and then to production by itself, with no person involved. Which practice is this?'),
      options: [
        { id: 'cdep', text: 'Continuous Deployment', correct: true },
        { id: 'cdel', text: 'Continuous Delivery', why: bi('При Continuous Delivery перед рабочим сервером стоит ручной шаг, а здесь его нет.', 'Continuous Delivery has a manual step before production, and there is none here.') },
        { id: 'ci', text: bi('Только непрерывная интеграция', 'Only continuous integration'), why: bi('Непрерывная интеграция заканчивается проверками, а здесь версия ещё и выкладывается.', 'Continuous integration ends with the checks; here the version is also deployed.') },
      ],
    },
  },
  {
    id: 'cicd.place.mr',
    level: 'experienced',
    key: true,
    concepts: ['cicd.rules', 'cicd.needs'],
    kind: 'task',
    setup: projectSetup({ '.gitlab-ci.yml': RULES_CI }, { forge: [{ project: 'team/site', variables: [{ key: 'DEPLOY_TOKEN', value: 'edu-deploy-7Kq2', masked: true, protected: true }] }] }),
    task: {
      id: 'p3',
      prompt: bi('Доработайте существующий пайплайн проекта. Джоба `test` должна стартовать сразу после `build`, не дожидаясь медленного `lint`, а выкладка на тестовый стенд должна идти только из main. Проверьте это так: отправьте ветку `feature/menu` и откройте из неё merge request, в пайплайне которого будут `build`, `lint` и `test` без выкладки.', 'Improve the project’s existing pipeline. The `test` job must start right after `build` without waiting for the slow `lint`, and the staging deploy must run only from main. Check it: push a branch `feature/menu` and open a merge request from it whose pipeline has `build`, `lint` and `test` without the deploy.'),
      check: {
        when: (f) => {
          const mrp = lastPipeline(f, { source: 'merge_request_event' });
          const names = (mrp?.jobs ?? []).map((j) => j.name).sort().join(',');
          const b = mrp?.jobs.find((j) => j.name === 'build');
          const l = mrp?.jobs.find((j) => j.name === 'lint');
          const t = mrp?.jobs.find((j) => j.name === 'test');
          return names === 'build,lint,test' && !!b && !!l && !!t && (t.start ?? 0) >= (b.end ?? 0) && (t.start ?? 0) < (l.end ?? 0);
        },
      },
    },
  },
];

export const block: Block = {
  id: 'cicd',
  order: 50,
  title: bi('CI/CD', 'CI/CD'),
  summary: bi('В этом блоке вы отправите работу на сервер команды и откроете merge request, а потом построите на GitLab CI пайплайн, который проверяет и выкладывает сайт. По дороге вы разберётесь с джобами, стадиями и раннерами, артефактами и кэшем, секретами, окружениями, ручным шагом, правилами и зависимостями needs.', 'The remote repository and merge requests; a pipeline from checks to deployment on GitLab CI: jobs, stages, runners, artifacts and cache, secrets, environments, the manual step, rules and needs.'),
  checklistStep: '01',
  levels: {
    beginner: bi('Знает Git по нашему блоку', 'Knows Git from our block'),
    intermediate: bi('Видел зелёные отметки CI в merge request', 'Has seen green CI ticks'),
    experienced: bi('Правил файл пайплайна, но не строил пайплайн до выкладки', 'Has edited a CI file, never built a pipeline up to deployment'),
  },
  hours: { beginner: 19, intermediate: 13, experienced: 8 },
  lessons: lessons.map((l) => l.id),
  sources: src([S.yaml, S.runner, S.envs], [S.ruCi, S.ruCd, S.ruCacheArt]),
  docSources: ['git-help', 'docs.gitlab.com'],
  placement,
  exam: 'cicd.exam.release',
};

