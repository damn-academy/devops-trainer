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
  { id: 'git.remote', term: bi('удалённый репозиторий', 'remote repository'), forms: { ru: ['удалённого репозитория', 'удалённом репозитории', 'удалённый репозиторий', 'удалённым репозиторием'], en: ['remote repositories'] }, short: bi('Копия истории на сервере команды; push отправляет в неё коммиты, fetch и pull забирают.', 'A copy of the history on the team server; push sends commits to it, fetch and pull bring them back.'), introducedIn: 'cicd.remote', docRef: { page: 'man/git-push.1', anchor: 'DESCRIPTION' } },
  { id: 'git.mr', term: bi('merge request', 'merge request'), forms: { en: ['merge requests'] }, scan: false, short: bi('Предложение влить ветку: изменения видны, их обсуждают, проверяют пайплайном и вливают кнопкой.', 'A proposal to merge a branch: the changes are visible, discussed, checked by a pipeline and merged with a button.'), introducedIn: 'cicd.remote', docRef: { url: 'https://docs.gitlab.com/user/project/merge_requests/', label: 'docs.gitlab.com › Merge requests' } },
  { id: 'cicd.pipeline-file', term: bi('.gitlab-ci.yml', '.gitlab-ci.yml'), short: bi('Файл пайплайна в корне репозитория: стадии, джобы и их скрипты. Forge читает его при каждом push.', 'The pipeline file in the repository root: stages, jobs and their scripts. The forge reads it on every push.'), introducedIn: 'cicd.first-pipeline', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'overview' } },
  { id: 'cicd.job', term: bi('джоба', 'job'), forms: { ru: ['джобы', 'джобе', 'джобу', 'джобой', 'джоб', 'джобам', 'джобами'], en: ['jobs'] }, scan: false, short: bi('Единица работы пайплайна: имя и скрипт, который раннер выполняет на чистой машине.', 'A unit of work in a pipeline: a name and a script a runner executes on a clean machine.'), introducedIn: 'cicd.first-pipeline', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'script' } },
  { id: 'cicd.stage', term: bi('стадия', 'stage'), forms: { ru: ['стадии', 'стадий', 'стадию', 'стадиями'], en: ['stages'] }, scan: false, short: bi('Группа джоб пайплайна: джобы стадии идут параллельно, следующая стадия — после успеха предыдущей.', 'A group of pipeline jobs: jobs of a stage run in parallel, the next stage after the previous one succeeds.'), introducedIn: 'cicd.first-pipeline', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'stages' } },
  { id: 'cicd.runner', term: bi('раннер', 'runner'), forms: { ru: ['раннера', 'раннеру', 'раннером', 'раннере', 'раннеры', 'раннеров', 'раннерам'], en: ['runners'] }, short: bi('Программа на отдельной машине, которая сама забирает джобы с forge, выполняет их и отправляет лог.', 'A program on a separate machine that picks up jobs from the forge by itself, runs them and sends back the log.'), introducedIn: 'cicd.first-pipeline', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'tags' } },
  { id: 'cicd.artifact', term: bi('артефакт', 'artifact'), forms: { ru: ['артефакта', 'артефакты', 'артефактов', 'артефактом'], en: ['artifacts'] }, scan: false, short: bi('Файлы, которые джоба загружает на forge, чтобы их получили следующие джобы и люди.', 'Files a job uploads to the forge so that later jobs and people get them.'), introducedIn: 'cicd.artifacts-cache', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'artifacts' } },
  { id: 'cicd.cache', term: bi('кэш CI', 'CI cache'), forms: { ru: ['кэша CI', 'кэшем CI'] }, short: bi('Файлы, которые раннер сохраняет между запусками ради скорости; может пропасть, и сборка всё равно должна пройти.', 'Files a runner keeps between runs for speed; it may vanish and the build must still pass.'), introducedIn: 'cicd.artifacts-cache', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'cache' } },
  { id: 'cicd.image', term: bi('образ джобы', 'job image'), forms: { ru: ['образа джобы', 'образом джобы'] }, short: bi('Образ контейнера, в котором раннер выполняет скрипт джобы (ключ image:).', 'The container image the runner runs the job script in (the image: key).'), introducedIn: 'cicd.artifacts-cache', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'image' } },
  { id: 'cicd.variable', term: bi('переменная CI/CD', 'CI/CD variable'), forms: { ru: ['переменные CI/CD', 'переменной CI/CD', 'переменных CI/CD'], en: ['CI/CD variables'] }, short: bi('Значение из настроек проекта, которое forge передаёт джобе как переменную окружения; для секретов — masked и protected.', 'A value from the project settings the forge passes to a job as an environment variable; for secrets, masked and protected.'), introducedIn: 'cicd.variables-envs', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'variables' } },
  { id: 'cicd.environment', term: bi('окружение CI', 'CI environment'), forms: { ru: ['окружения CI', 'окружение CI'] }, short: bi('Место выкладки (staging, production), про которое forge помнит, какая версия и когда туда выкачена.', 'A deployment target (staging, production) for which the forge remembers what version went there and when.'), introducedIn: 'cicd.variables-envs', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'environment' } },
  { id: 'cicd.manual', term: bi('ручная джоба', 'manual job'), forms: { ru: ['ручной джобы', 'ручную джобу', 'ручные джобы'], en: ['manual jobs'] }, short: bi('Джоба с when: manual: ждёт, пока человек нажмёт ▶. Ручной шаг перед production и есть разница между Continuous Delivery и Continuous Deployment.', 'A job with when: manual: it waits until a person presses ▶. A manual step before production is the difference between Continuous Delivery and Continuous Deployment.'), introducedIn: 'cicd.variables-envs', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'when' } },
  { id: 'cicd.rules', term: bi('rules', 'rules'), scan: false, short: bi('Условия, по которым джоба попадает в пайплайн: событие, ветка, тег, изменённые файлы.', 'Conditions that put a job into a pipeline: the event, the branch, the tag, the changed files.'), introducedIn: 'cicd.rules-needs', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'rules' } },
  { id: 'cicd.needs', term: bi('needs', 'needs'), scan: false, short: bi('Явные зависимости джоб: джоба стартует, как только готовы те, что ей нужны, не дожидаясь всей стадии.', 'Explicit job dependencies: a job starts as soon as the jobs it needs are done, without waiting for the whole stage.'), introducedIn: 'cicd.rules-needs', docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'needs' } },
];

// ── fact helpers for checks ──

const pushedCi = (f: Facts) => {
  const fg = forge(f);
  const c = fg?.commits.find((x) => x.oid === fg.branches.main);
  const text = c?.files['.gitlab-ci.yml'];
  return text ? parseCi(text) : null;
};
const mainOk = (f: Facts) => lastPipeline(f, { ref: 'main' })?.status === 'success';

// ── quiz bank ──

export const quiz: QuizItem[] = [
  {
    id: 'cicd.q.reject',
    kind: 'mcq',
    concepts: ['git.remote'],
    prompt: bi('`git push` ответил `! [rejected] main -> main (fetch first)`. Что это значит?', '`git push` answered `! [rejected] main -> main (fetch first)`. What does it mean?'),
    options: [
      { id: 'ahead', text: bi('На сервере есть коммиты, которых нет у вас: заберите их (git pull) и отправьте снова', 'The server has commits you do not have: get them (git pull) and push again'), correct: true },
      { id: 'perm', text: bi('У вас нет прав на запись', 'You have no write access'), why: bi('Отказ в правах выглядит иначе: «You are not allowed to push code» или 403. Здесь Git сравнил истории.', 'A permission error looks different: "You are not allowed to push code" or 403. Here Git compared histories.') },
      { id: 'force', text: bi('Нужно повторить с --force', 'Repeat it with --force'), why: bi('--force перезапишет ветку сервера, и коммиты коллеги пропадут. В защищённую ветку forge так и не пустит.', '--force would overwrite the server branch and the colleague’s commits would be lost. A protected branch would not allow it anyway.') },
    ],
  },
  {
    id: 'cicd.q.fetch-pull',
    kind: 'match',
    concepts: ['git.remote'],
    prompt: bi('Сопоставьте команду и её действие.', 'Match the command with what it does.'),
    pairs: [
      { id: 'push', left: 'git push', right: bi('отправляет коммиты и двигает ветку на сервере', 'sends commits and moves the branch on the server') },
      { id: 'fetch', left: 'git fetch', right: bi('забирает коммиты, обновляет origin/main, ваши ветки не трогает', 'gets commits, updates origin/main, leaves your branches alone') },
      { id: 'pull', left: 'git pull', right: bi('fetch, а затем слияние с вашей веткой', 'fetch, then a merge into your branch') },
      { id: 'clone', left: 'git clone', right: bi('создаёт локальную копию всей истории', 'makes a local copy of the whole history') },
    ],
  },
  {
    id: 'cicd.q.who-runs',
    kind: 'mcq',
    concepts: ['cicd.runner'],
    prompt: bi('Кто выполняет строки `script:` джобы?', 'Who executes the `script:` lines of a job?'),
    options: [
      { id: 'runner', text: bi('Раннер на отдельной машине, который сам забрал джобу', 'A runner on a separate machine that picked up the job by itself'), correct: true },
      { id: 'forge', text: bi('Сам forge (GitLab)', 'The forge (GitLab) itself'), why: bi('Forge только хранит код, создаёт джобы и показывает логи. Без раннера джоба вечно ждёт в pending.', 'The forge only stores code, creates jobs and shows logs. Without a runner a job waits in pending forever.') },
      { id: 'dev', text: bi('Компьютер разработчика при git push', 'The developer’s computer during git push'), why: bi('git push завершается сразу; пайплайн идёт на сервере, даже если ноутбук закрыт.', 'git push ends at once; the pipeline runs on the server even with the laptop closed.') },
    ],
  },
  {
    id: 'cicd.q.stages-order',
    kind: 'order',
    concepts: ['cicd.stage'],
    prompt: bi('В каком порядке пойдут джобы пайплайна со стадиями `[build, test, deploy]`?', 'In what order do the jobs of a pipeline with stages `[build, test, deploy]` run?'),
    steps: [
      { id: 'b', text: 'build' },
      { id: 't', text: bi('unit-test и lint (вместе)', 'unit-test and lint (together)'), why: bi('Джобы одной стадии идут параллельно, если хватает раннеров.', 'Jobs of one stage run in parallel when there are enough runners.') },
      { id: 'd', text: 'deploy_staging' },
    ],
  },
  {
    id: 'cicd.q.exit',
    kind: 'predict-output',
    concepts: ['cicd.job'],
    prompt: bi('Скрипт джобы: `- echo start`, `- ./test.sh`, `- echo done`. `./test.sh` вернул 1. Что будет последней строкой лога?', 'A job script: `- echo start`, `- ./test.sh`, `- echo done`. `./test.sh` returned 1. What is the last line of the log?'),
    command: 'echo "ERROR: Job failed: exit code 1"',
    options: [
      { id: 'fail', text: 'ERROR: Job failed: exit code 1', correct: true },
      { id: 'done', text: 'done', why: bi('После ненулевого кода раннер прекращает выполнять скрипт: echo done не запустится.', 'After a non-zero code the runner stops the script: echo done does not run.') },
      { id: 'ok', text: 'Job succeeded', why: bi('Джоба успешна, только если все строки вернули 0.', 'A job succeeds only if every line returned 0.') },
    ],
  },
  {
    id: 'cicd.q.cache-art',
    kind: 'match',
    concepts: ['cicd.artifact', 'cicd.cache'],
    key: true,
    prompt: bi('Что использовать в каждом случае?', 'What do you use in each case?'),
    pairs: [
      { id: 'nm', left: bi('node_modules между пайплайнами — быстрее ставить зависимости', 'node_modules between pipelines, to install dependencies faster'), right: 'cache', why: bi('Пропадёт — npm ci скачает заново: медленнее, но не сломается.', 'If it is gone, npm ci downloads again: slower, but nothing breaks.') },
      { id: 'dist', left: bi('dist/ из сборки в выкладку', 'dist/ from the build to the deploy'), right: 'artifacts', why: bi('Результат обязан дойти: кэш может пропасть, артефакт — нет.', 'The result must arrive: a cache may vanish, an artifact must not.') },
      { id: 'junit', left: bi('отчёт тестов, который покажет merge request', 'a test report the merge request will show'), right: 'artifacts:reports' },
    ],
  },
  {
    id: 'cicd.q.no-artifact',
    kind: 'mcq',
    concepts: ['cicd.artifact'],
    prompt: bi('build создаёт dist/, а deploy падает с `dist/index.html not found`. Обе джобы на одном раннере. Почему?', 'build creates dist/, and deploy fails with `dist/index.html not found`. Both jobs ran on the same runner. Why?'),
    options: [
      { id: 'clean', text: bi('Каждая джоба начинается с чистой копии репозитория; dist/ нужно объявить в artifacts', 'Every job starts from a clean copy of the repository; dist/ must be declared in artifacts'), correct: true },
      { id: 'race', text: bi('deploy запустился раньше build', 'deploy started before build'), why: bi('deploy в следующей стадии: он стартует только после успешного build.', 'deploy is in the next stage: it starts only after build succeeds.') },
      { id: 'cache', text: bi('Нужно было положить dist/ в кэш', 'dist/ should have been put into the cache'), why: bi('Кэш не гарантирует доставку: при промахе deploy снова упадёт. Результат передают артефактом.', 'A cache does not guarantee delivery: on a miss deploy fails again. Results are passed as artifacts.') },
    ],
  },
  {
    id: 'cicd.q.protected',
    kind: 'mcq',
    concepts: ['cicd.variable'],
    prompt: bi('В пайплайне ветки feature/x переменная `$DEPLOY_TOKEN` пустая, а в main — есть. Почему?', 'In the pipeline of the feature/x branch `$DEPLOY_TOKEN` is empty, while on main it is set. Why?'),
    options: [
      { id: 'prot', text: bi('Переменная помечена Protected: её получают только защищённые ветки и теги', 'The variable is marked Protected: only protected branches and tags get it'), correct: true },
      { id: 'masked', text: bi('Переменная Masked и поэтому скрыта', 'The variable is Masked and so it is hidden'), why: bi('Masked прячет значение в логе как [MASKED], но джоба его получает.', 'Masked hides the value in the log as [MASKED], but the job does get it.') },
      { id: 'yaml', text: bi('Её забыли записать в .gitlab-ci.yml ветки', 'It was not written into the branch’s .gitlab-ci.yml'), why: bi('Секрет в файле пайплайна — в истории репозитория. Секреты задают в настройках проекта.', 'A secret in the pipeline file is in the repository history. Secrets are set in the project settings.') },
    ],
  },
  {
    id: 'cicd.q.base64',
    kind: 'mcq',
    concepts: ['cicd.variable'],
    prompt: bi('Переменная TOKEN помечена Masked, но в логе появилось её значение в base64 после `echo $TOKEN | base64`. Почему маскирование не сработало?', 'The TOKEN variable is Masked, yet its base64 form appeared in the log after `echo $TOKEN | base64`. Why did masking fail?'),
    options: [
      { id: 'exact', text: bi('Маскирование ищет в логе точное значение; преобразованное значение — другая строка', 'Masking looks for the exact value in the log; a transformed value is another string'), correct: true },
      { id: 'enc', text: bi('Masked значит «зашифровано», а base64 — расшифровка', 'Masked means "encrypted", and base64 decrypts it'), why: bi('Masked не шифрование: джоба получает значение открытым текстом, раннер лишь заменяет его в логе.', 'Masked is not encryption: the job gets the value in plain text; the runner only replaces it in the log.') },
    ],
  },
  {
    id: 'cicd.q.delivery',
    kind: 'mcq',
    concepts: ['cicd.manual'],
    key: true,
    prompt: bi('Каждый merge в main проходит тесты и выкатывается на staging, а в production — после нажатия кнопки. Какая это практика?', 'Every merge into main passes the tests and goes to staging, and to production after a button press. Which practice is this?'),
    options: [
      { id: 'cdel', text: 'Continuous Delivery', correct: true },
      { id: 'cdep', text: 'Continuous Deployment', why: bi('В Continuous Deployment ручного шага нет: production обновляется сам. Разница — строка when: manual.', 'In Continuous Deployment there is no manual step: production updates by itself. The difference is the when: manual line.') },
      { id: 'ci', text: bi('Только непрерывная интеграция', 'Only continuous integration'), why: bi('CI — частое слияние с проверками. Здесь ещё и каждая версия готова к выпуску одной кнопкой.', 'CI is frequent merging with checks. Here every version is also ready to release with one button.') },
    ],
  },
  {
    id: 'cicd.q.rules',
    kind: 'bugfind',
    concepts: ['cicd.rules'],
    prompt: bi('Production должен выкатываться только из тегов вида v1.2.3 и вручную. В какой строке ошибка?', 'Production must be deployed only from tags like v1.2.3 and by hand. Which line has the bug?'),
    code: 'deploy_production:\n  stage: deploy\n  script: ./deploy.sh production\n  rules:\n    - if: $CI_COMMIT_BRANCH =~ /^v\\d+\\.\\d+\\.\\d+$/\n      when: manual',
    bug: [5],
    why: {
      3: bi('Скрипт выкладки — верно.', 'The deploy script is fine.'),
      5: bi('В пайплайне тега CI_COMMIT_BRANCH не задан — имя тега лежит в CI_COMMIT_TAG. Правило никогда не сработает.', 'In a tag pipeline CI_COMMIT_BRANCH is not set: the tag name is in CI_COMMIT_TAG. The rule never matches.'),
      6: bi('Ручной запуск — как и требовалось.', 'A manual run, as required.'),
    },
  },
  {
    id: 'cicd.q.needs',
    kind: 'multi',
    concepts: ['cicd.needs'],
    prompt: bi('Что изменит `needs: [build]` у джобы `test` в стадии test? Отметьте верное.', 'What does `needs: [build]` on the `test` job in the test stage change? Mark what is true.'),
    options: [
      { id: 'early', text: bi('test стартует сразу после build, не дожидаясь других джоб стадии build', 'test starts right after build without waiting for other jobs of the build stage'), correct: true },
      { id: 'art', text: bi('test скачает артефакты только от build', 'test downloads artifacts only from build'), correct: true },
      { id: 'order', text: bi('build станет выполняться после test', 'build will run after test'), why: bi('needs указывает, что нужно *до* джобы, а не после.', 'needs says what is required *before* the job, not after.') },
      { id: 'stage', text: bi('стадии больше не нужны в файле', 'stages are no longer needed in the file'), why: bi('Стадии остаются: needs лишь разрешает начинать раньше конца стадии.', 'Stages stay: needs only allows starting before the stage ends.') },
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
  summary: bi('Удалённый репозиторий — ещё одна копия истории; push принимается, только если продолжает её. Merge request — предложение влить ветку.', 'A remote repository is one more copy of the history; a push is accepted only if it continues it. A merge request is a proposal to merge a branch.'),
  introduces: ['git.remote', 'git.mr'],
  uses: ['git.commit', 'git.branch', 'git.merge'],
  tier: 'core',
  minutes: 35,
  sources: src([S.remotes, S.mr, S.glab], [S.ruRemotes, S.ruCi]),
  sections: [
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      title: bi('Одна история — много копий', 'One history, many copies'),
      body: bi(
        'Пока репозиторий живёт на одном ноутбуке, он умирает вместе с ноутбуком, и коллеги его не видят. Поэтому у команды есть сервер репозиториев — forge (GitLab, GitHub, Gitea). На нём лежит [[git.remote|удалённый репозиторий]]: такая же история из тех же коммитов. У каждого разработчика своя полная копия, а forge — копия, о которой договорились, что она общая.\n\nСвязь с ним задаётся один раз: `git remote add origin https://forge.edu/team/site.git` — `origin` здесь просто короткое имя для адреса. `git push origin main` отправляет недостающие коммиты и просит сервер передвинуть его ветку `main`. `git fetch` забирает чужие коммиты и обновляет ветку-копию `origin/main`, не трогая ваших веток, а `git pull` — это fetch плюс слияние. `git clone` делает всё сразу: создаёт репозиторий, прописывает `origin` и забирает историю.\n\nСервер принимает push, только если ваш коммит **продолжает** его историю. Если коллега успел отправить свой коммит, ваш push получит отказ `! [rejected] … (fetch first)`: сначала `git pull`, слияние, и снова push. Это не ошибка, а защита: иначе чужая работа просто исчезла бы.\n\n### Merge request\n\nВ команде в основную ветку напрямую не пушат. Работу делают в своей ветке, отправляют её на forge и открывают [[git.mr|merge request]] (в GitHub это называется pull request): «влейте, пожалуйста, ветку contacts в main». В нём видны изменения, коллеги оставляют замечания, пайплайн проверяет код — и только потом ветку вливают. Ветка `main` на forge обычно **защищена**: в неё нельзя ни пушать напрямую, ни переписывать её историю.',
        'While a repository lives on one laptop, it dies with the laptop and colleagues cannot see it. So the team has a repository server, a forge (GitLab, GitHub, Gitea). It holds a [[git.remote|remote repository]]: the same history of the same commits. Every developer has their own full copy, and the forge is the copy everyone agreed to share.\n\nThe link to it is set once: `git remote add origin https://forge.edu/team/site.git` (here `origin` is just a short name for the address). `git push origin main` sends the missing commits and asks the server to move its `main` branch. `git fetch` gets other people’s commits and updates the copy branch `origin/main` without touching your branches, and `git pull` is fetch plus a merge. `git clone` does it all at once: it creates the repository, sets `origin` and gets the history.\n\nThe server accepts a push only if your commit **continues** its history. If a colleague pushed first, your push gets `! [rejected] … (fetch first)`: run `git pull`, merge, and push again. This is not an error but a guard: otherwise someone else’s work would simply disappear.\n\n### The merge request\n\nIn a team nobody pushes straight to the main branch. Work is done on its own branch, pushed to the forge, and a [[git.mr|merge request]] is opened (GitHub calls it a pull request): "please merge the contacts branch into main". It shows the changes, colleagues leave comments, the pipeline checks the code, and only then is the branch merged. The `main` branch on the forge is usually **protected**: you can neither push to it directly nor rewrite its history.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'git.commit-push', caption: bi('Пройдите шаги; включите «чужой коммит на forge» и посмотрите, где остановится push.', 'Step through; switch on "someone else’s commit on the forge" and see where the push stops.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: remoteSetup,
      intro: bi('На forge создан пустой проект `team/site`. Работать с ним помогает `glab` — консольный клиент GitLab.', 'An empty project `team/site` exists on the forge. `glab`, the GitLab command-line client, helps you work with it.'),
      tasks: [
        {
          id: 'origin',
          prompt: bi('Свяжите `~/site` с `https://forge.edu/team/site.git` под именем `origin` и отправьте туда `main`, запомнив связь ветки с сервером.', 'Link `~/site` to `https://forge.edu/team/site.git` as `origin` and push `main` there, remembering the link of the branch to the server.'),
          check: { when: (f) => !!forge(f)?.branches.main && forge(f)!.branches.main === repo(f)?.branches.main && repo(f)?.upstream.main === 'origin/main', fail: [{ if: (f) => !!forge(f)?.branches.main && !repo(f)?.upstream.main, say: bi('main на сервере, но связь ветки не запомнена: нужен ключ -u (--set-upstream).', 'main is on the server, but the branch link was not remembered: you need -u (--set-upstream).') }] },
          chips: 'git remote add origin https://forge.edu/team/site.git && git push -u origin main',
          concepts: ['git.remote'],
          docRef: { page: 'man/git-push.1', anchor: 'OPTIONS', line: '--set-upstream' },
          hints: { H1: bi('Два шага: git remote add, затем git push с -u.', 'Two steps: git remote add, then git push with -u.') },
        },
        {
          id: 'mr',
          prompt: bi('В ветке `feature/hours` добавьте коммитом страницу `hours.html`, отправьте ветку и откройте merge request в `main`.', 'On a branch `feature/hours`, add a page `hours.html` with a commit, push the branch and open a merge request into `main`.'),
          check: { when: (f) => !!forge(f)?.branches['feature/hours'] && (forge(f)?.mrs ?? []).some((m) => m.source === 'feature/hours' && m.target === 'main') },
          chips: 'glab mr create --source-branch feature/hours --target-branch main --title "Add opening hours"',
          concepts: ['git.mr'],
          hints: { H1: bi('switch -c, файл, add, commit, push -u, затем glab mr create.', 'switch -c, a file, add, commit, push -u, then glab mr create.'), H2: bi('`glab mr create -s feature/hours -b main -t "Add opening hours"`.', '`glab mr create -s feature/hours -b main -t "Add opening hours"`.') },
        },
        {
          id: 'merge',
          prompt: bi('Влейте merge request на forge и обновите свою `main`, чтобы в ней появилась `hours.html`.', 'Merge the merge request on the forge and update your own `main` so that `hours.html` appears in it.'),
          check: { when: (f) => (forge(f)?.mrs ?? []).some((m) => m.state === 'merged') && repo(f)?.branch === 'main' && 'hours.html' in (head(f)?.files ?? {}) },
          chips: 'glab mr merge 1 && git switch main && git pull',
          hints: { H1: bi('Слияние сделал сервер; у вас его ещё нет.', 'The server made the merge; you do not have it yet.') },
        },
      ],
    },
    {
      id: 'reject',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: rejectSetup,
      intro: bi('Пока вы правили `about.html`, Grace отправила в `main` свой коммит.', 'While you were editing `about.html`, Grace pushed her own commit to `main`.'),
      tasks: [
        {
          id: 'both',
          prompt: bi('Закоммитьте любую правку `about.html` и доставьте её в `main` на forge так, чтобы коммит Grace тоже остался.', 'Commit any edit of `about.html` and deliver it to `main` on the forge so that Grace’s commit stays too.'),
          check: {
            when: (f) => {
              const fg = forge(f);
              const tip = fg?.commits.find((c) => c.oid === fg.branches.main);
              return !!tip && 'hours.html' in tip.files && tip.files['about.html'] !== PAGES['about.html'];
            },
            fail: [{ if: (f) => (repo(f)?.commits.length ?? 0) > 1 && !('hours.html' in (head(f)?.files ?? {})), say: bi('Push отклонён: на сервере коммит Grace. Заберите его — git pull — и отправьте снова.', 'The push is rejected: Grace’s commit is on the server. Get it with git pull and push again.') }],
          },
          chips: 'git pull && git push',
          concepts: ['git.remote'],
          docRef: { page: 'man/git-push.1', anchor: 'DESCRIPTION', line: 'fast-forward' },
          hints: { H1: bi('Сначала попробуйте push и прочитайте ответ сервера.', 'Try push first and read the server’s answer.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['cicd.q.reject', 'cicd.q.fetch-pull'] },
  ],
};


const firstLesson: Lesson = {
  id: 'cicd.first-pipeline',
  block: 'cicd',
  title: bi('Первый пайплайн: джобы, стадии, раннер', 'The first pipeline: jobs, stages, the runner'),
  summary: bi('Пайплайн — файл в репозитории, который forge читает при каждом push и превращает в джобы; выполняют их раннеры.', 'A pipeline is a file in the repository the forge reads on every push and turns into jobs; runners execute them.'),
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
        'Тесты сайта есть — скрипт `./test.sh`. Но его запускают, когда вспоминают, и в main раз в неделю попадает страница без заголовка. Нужно, чтобы проверка шла сама на каждый push, на чистой машине, и чтобы её результат видела вся команда.',
        'The site has tests: the `./test.sh` script. But people run it when they remember, and once a week a page without a heading lands on main. The check must run by itself on every push, on a clean machine, and the whole team must see the result.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'cicd.push-to-deploy', caption: bi('Общая картина блока. Сломайте тест или раннер и посмотрите, где остановится процесс.', 'The big picture of the block. Break a test or the runner and see where the process stops.') },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      title: bi('Файл, джоба, стадия, раннер', 'File, job, stage, runner'),
      body: bi(
        'Всё, что делает CI, записано в файле [[cicd.pipeline-file|.gitlab-ci.yml]] в корне репозитория. Это обычный YAML, он меняется коммитом, как код, и forge читает его заново при каждом push — из того самого коммита, который пришёл.\n\nКаждый ключ верхнего уровня, кроме служебных (`stages`, `variables`, `default`…), — это [[cicd.job|джоба]]: имя и `script` — список команд, тех же, что вы набрали бы руками. Команды идут по очереди; если какая-то вернула ненулевой код, джоба останавливается со статусом **failed**. Пайплайн — все джобы одного коммита.\n\nДжобы группируются в [[cicd.stage|стадии]]: `stages: [build, test, deploy]` задаёт порядок. Джобы одной стадии идут параллельно, следующая стадия начинается, когда предыдущая прошла успешно, а после упавшей джобы следующие стадии пропускаются (**skipped**). Если у джобы не указан `stage`, она в стадии `test`.\n\nИ главное: forge джобы не выполняет. Он ставит их в очередь, а [[cicd.runner|раннер]] — программа gitlab-runner на отдельной машине — сам спрашивает forge «есть работа?», получает джобу, разворачивает чистую копию репозитория, выполняет скрипт и отправляет лог обратно. Раннер выбирают по тегам: джоба с `tags: [docker]` достанется только раннеру с таким тегом, а если его нет, она будет вечно ждать в **pending**.\n\nСтатус пайплайна виден в merge request и в `glab ci status`. Красный пайплайн в main — сигнал всей команде: основная ветка сломана, и чинить её нужно первой.',
        'Everything CI does is written in the [[cicd.pipeline-file|.gitlab-ci.yml]] file in the repository root. It is ordinary YAML, it changes by a commit like code, and the forge reads it again on every push, from exactly the commit that arrived.\n\nEvery top-level key except the service ones (`stages`, `variables`, `default`…) is a [[cicd.job|job]]: a name and `script`, a list of commands, the same ones you would type by hand. The commands run in turn; if one returns a non-zero code, the job stops with the status **failed**. A pipeline is all the jobs of one commit.\n\nJobs are grouped into [[cicd.stage|stages]]: `stages: [build, test, deploy]` sets the order. Jobs of one stage run in parallel, the next stage begins when the previous one succeeded, and after a failed job the later stages are skipped (**skipped**). A job without `stage` is in the `test` stage.\n\nAnd the main thing: the forge does not run jobs. It queues them, and a [[cicd.runner|runner]] (the gitlab-runner program on a separate machine) asks the forge "any work?" by itself, takes a job, sets up a clean copy of the repository, runs the script and sends the log back. Runners are chosen by tags: a job with `tags: [docker]` goes only to a runner with that tag, and if there is none, it waits in **pending** forever.\n\nThe pipeline status shows in the merge request and in `glab ci status`. A red pipeline on main is a signal to the whole team: the main branch is broken and fixing it comes first.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: projectSetup(),
      intro: bi('`~/site` — проект сайта на forge: страницы в `src/`, скрипты `test.sh`, `build.sh`, `lint.sh`. Файла пайплайна пока нет. Создавайте файлы командой `edit`.', '`~/site` is the site project on the forge: pages in `src/`, scripts `test.sh`, `build.sh`, `lint.sh`. There is no pipeline file yet. Create files with `edit`.'),
      tasks: [
        {
          id: 'first',
          prompt: bi('Создайте `.gitlab-ci.yml` с одной джобой `test`, которая запускает `./test.sh` в образе `alpine:3.22`, проверьте его `glab ci lint` и отправьте в `main`. Пайплайн должен пройти.', 'Create `.gitlab-ci.yml` with one job `test` that runs `./test.sh` in the `alpine:3.22` image, check it with `glab ci lint` and push it to `main`. The pipeline must pass.'),
          check: {
            when: (f) => mainOk(f) && (jobOf(f, 'test', { ref: 'main' })?.log ?? '').includes('$ ./test.sh'),
            fail: [
              { if: (f) => !!f.files[`${SITE}/.gitlab-ci.yml`] && !forge(f)?.commits.some((c) => '.gitlab-ci.yml' in c.files), say: bi('Файл есть локально, но forge его не видел: закоммитьте и сделайте git push.', 'The file exists locally, but the forge has not seen it: commit and git push.') },
              { if: (f) => lastPipeline(f)?.status === 'failed' && !!lastPipeline(f)?.errors, say: bi('Forge не смог прочитать файл пайплайна — glab ci lint покажет строку.', 'The forge could not read the pipeline file; glab ci lint shows the line.') },
            ],
          },
          chips: 'edit .gitlab-ci.yml',
          concepts: ['cicd.pipeline-file', 'cicd.job'],
          docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'script', line: 'job2:' },
          hints: { H1: bi('Имя джобы — ключ верхнего уровня; внутри image и script.', 'The job name is a top-level key; inside it go image and script.'), H2: bi('```yaml\ntest:\n  image: alpine:3.22\n  script:\n    - ./test.sh\n```\nЗатем `glab ci lint`, `git add .gitlab-ci.yml`, `git commit -m "Add CI"`, `git push`.', '```yaml\ntest:\n  image: alpine:3.22\n  script:\n    - ./test.sh\n```\nThen `glab ci lint`, `git add .gitlab-ci.yml`, `git commit -m "Add CI"`, `git push`.') },
        },
        {
          id: 'stages',
          prompt: bi('Добавьте стадии `build` и `test`: джоба `build` (стадия build) запускает `./build.sh`, джоба `lint` в стадии test запускает `./lint.sh`. `build` должна закончиться раньше, чем начнутся `test` и `lint`.', 'Add the stages `build` and `test`: a job `build` (stage build) runs `./build.sh`, a job `lint` in the test stage runs `./lint.sh`. `build` must finish before `test` and `lint` start.'),
          check: {
            when: (f) => {
              const p = lastPipeline(f, { ref: 'main' });
              const b = p?.jobs.find((j) => j.name === 'build');
              const t = p?.jobs.find((j) => j.name === 'test');
              const l = p?.jobs.find((j) => j.name === 'lint');
              return p?.status === 'success' && !!b && !!t && !!l && b.stage === 'build' && t.stage === 'test' && l.stage === 'test' && (b.end ?? 0) <= (t.start ?? 0) && (b.end ?? 0) <= (l.start ?? 0);
            },
            fail: [{ if: (f) => (lastPipeline(f)?.errors ?? []).some((e) => e.message.includes('chosen stage')), say: bi('Стадию джобы нужно объявить в списке stages.', 'A job’s stage must be declared in the stages list.') }],
          },
          chips: 'glab ci view',
          concepts: ['cicd.stage'],
          docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'stages', line: 'The order of the items' },
          hints: { H1: bi('stages: [build, test] вверху файла и stage: у каждой джобы.', 'stages: [build, test] at the top of the file and stage: in every job.') },
        },
        {
          id: 'red',
          prompt: bi('Коллега просит добавить страницу `src/menu.html` с текстом `<p>Espresso 2.50</p>`. Добавьте, отправьте — и добейтесь зелёного пайплайна, исправив **страницу**, а не проверку.', 'A colleague asks to add a page `src/menu.html` with the text `<p>Espresso 2.50</p>`. Add it, push it, and get a green pipeline by fixing the **page**, not the check.'),
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
              { if: (f) => pushedCi(f)?.config?.jobs.find((j) => j.name === 'test')?.allowFailure === true, say: bi('allow_failure прячет поломку: пайплайн зелёный, а страница по-прежнему без заголовка. Почините страницу.', 'allow_failure hides the breakage: the pipeline is green and the page still has no heading. Fix the page.') },
              { if: (f) => jobOf(f, 'test', { ref: 'main' })?.status === 'failed', say: bi('Тест упал — откройте лог: glab ci trace test. Там сказано, чего не хватает странице.', 'The test failed. Open the log with glab ci trace test: it says what the page is missing.') },
            ],
          },
          chips: 'glab ci trace test',
          hints: { H1: bi('Прочитайте лог упавшей джобы: последняя строка до ERROR называет причину.', 'Read the log of the failed job: the last line before ERROR names the cause.'), H2: bi('test.sh требует в каждой странице <title> и <h1>.', 'test.sh requires a <title> and an <h1> in every page.') },
        },
      ],
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

const artifactsLesson: Lesson = {
  id: 'cicd.artifacts-cache',
  block: 'cicd',
  title: bi('Артефакты, кэш и образ джобы', 'Artifacts, cache and the job image'),
  summary: bi('Каждая джоба начинается на чистой машине. Артефакт передаёт результат дальше и обязан дойти; кэш только ускоряет и может пропасть.', 'Every job starts on a clean machine. An artifact passes a result on and must arrive; a cache only speeds things up and may vanish.'),
  introduces: ['cicd.artifact', 'cicd.cache', 'cicd.image'],
  uses: ['cicd.job', 'cicd.stage', 'cicd.runner'],
  tier: 'core',
  minutes: 35,
  sources: src([S.artifacts, S.caching, S.yaml], [S.ruCacheArt, S.ruFirst]),
  sections: [
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Раннер выполняет каждую джобу в контейнере, запущенном из [[cicd.image|образа джобы]]: `image: node:24-alpine` даёт Node.js, `image: alpine:3.22` — голый Alpine. Опечатка в имени образа роняет джобу ещё до скрипта: `failed to pull image`. Контейнер после джобы удаляется, поэтому всё, что джоба создала, исчезает. `build` собрал `dist/`, а `test` начинается с чистой копии репозитория — и `dist/` в ней нет.\n\nЧтобы результат дошёл, его объявляют [[cicd.artifact|артефактом]]: `artifacts: paths: [dist/]`. После успешной джобы раннер загружает эти файлы на forge, а джобы следующих стадий скачивают их перед своим скриптом — даже если они запустились на другом раннере. Артефакты можно скачать и руками со страницы джобы; срок их хранения задаётся отдельно.\n\n[[cicd.cache|Кэш CI]] похож на артефакт, но служит другому. Это файлы, которые раннер сохраняет у себя после джобы и раскладывает перед следующим запуском, — обычно скачанные зависимости. Ключ `key` решает, кто увидит кэш: `npm-$CI_COMMIT_REF_SLUG` — своя полка у каждой ветки, `key: files: [package-lock.json]` — новая полка при каждом изменении lock-файла. Главное свойство кэша: он **не гарантирован**. Раннер другой, кэш стёрли, ключ сменился — джоба должна пройти и без него, просто медленнее. Отсюда проверка: если без файлов джоба падает, это артефакт; если только медленнее — кэш.',
        'A runner executes every job in a container started from the [[cicd.image|job image]]: `image: node:24-alpine` gives Node.js, `image: alpine:3.22` a bare Alpine. A typo in the image name kills the job before the script: `failed to pull image`. After the job the container is deleted, so everything the job created is gone. `build` built `dist/`, and `test` starts from a clean copy of the repository, without `dist/`.\n\nTo get a result through, you declare it an [[cicd.artifact|artifact]]: `artifacts: paths: [dist/]`. After a successful job the runner uploads these files to the forge, and the jobs of later stages download them before their script, even when they run on another runner. Artifacts can be downloaded by hand from the job page; how long they are kept is set separately.\n\nA [[cicd.cache|CI cache]] looks like an artifact but serves another purpose. It is files a runner keeps after a job and lays out before the next run, usually downloaded dependencies. The `key` decides who sees the cache: `npm-$CI_COMMIT_REF_SLUG` is a shelf per branch, `key: files: [package-lock.json]` a new shelf every time the lock file changes. The main property of a cache: it is **not guaranteed**. Another runner, a wiped cache, a changed key, and the job must pass without it, only slower. Hence the test: if the job fails without the files, they are an artifact; if it is only slower, a cache.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: projectSetup({ '.gitlab-ci.yml': ARTIFACT_CI }),
      intro: bi('В проекте уже есть файл пайплайна из двух джоб: build и test.', 'The project already has a pipeline file with two jobs: build and test.'),
      tasks: [
        {
          id: 'artifact',
          prompt: bi('Отправьте пустой коммит (`git commit --allow-empty -m "Run CI"`, `git push`), прочитайте, почему падает `test`, и почините пайплайн, не меняя скриптов джоб.', 'Push an empty commit (`git commit --allow-empty -m "Run CI"`, `git push`), read why `test` fails, and fix the pipeline without changing the job scripts.'),
          check: {
            when: (f) => mainOk(f) && (jobOf(f, 'test', { ref: 'main' })?.log ?? '').includes('Downloading artifacts for build'),
            fail: [{ if: (f) => (pushedCi(f)?.config?.jobs.find((j) => j.name === 'build')?.cache?.paths ?? []).some((p) => p.startsWith('dist')), say: bi('dist/ в кэше не гарантирован: при промахе тест снова упадёт. Результат передают через artifacts.', 'dist/ in a cache is not guaranteed: on a miss the test fails again. Results are passed with artifacts.') }],
          },
          chips: 'glab ci trace test',
          concepts: ['cicd.artifact'],
          docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'artifacts', line: 'dist/' },
          hints: { H1: bi('test ищет dist/, а у build он остался на его машине.', 'test looks for dist/, which stayed on build’s machine.'), H2: bi('В джобу build: `artifacts:` и под ним `paths: [dist/]`.', 'In the build job: `artifacts:` and under it `paths: [dist/]`.') },
        },
        {
          id: 'cache',
          prompt: bi('`npm ci` в build ставит зависимости каждый раз заново. Добавьте кэш каталога `.npm/` с ключом по ветке и отправьте два коммита подряд: во втором пайплайне build должна найти кэш и пройти быстрее.', '`npm ci` in build installs the dependencies from scratch every time. Add a cache of the `.npm/` directory keyed by branch and push two commits in a row: in the second pipeline build must find the cache and run faster.'),
          check: {
            when: (f) => {
              const ps = (ci(f)?.pipelines ?? []).filter((p) => p.ref === 'main' && p.status === 'success');
              const last2 = ps.slice(-2).map((p) => p.jobs.find((j) => j.name === 'build'));
              return last2.length === 2 && last2[0]?.cacheHit === false && last2[1]?.cacheHit === true && (last2[1]!.end! - last2[1]!.start!) < (last2[0]!.end! - last2[0]!.start!);
            },
            fail: [{ if: (f) => (lastPipeline(f, { ref: 'main' })?.jobs.find((j) => j.name === 'build')?.cacheHit) === false, say: bi('Кэш сохранён этим пайплайном. Отправьте ещё один коммит — следующий build его найдёт.', 'This pipeline saved the cache. Push one more commit and the next build will find it.') }],
          },
          chips: 'glab ci trace build',
          concepts: ['cicd.cache'],
          docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'cache', line: 'CI_COMMIT_REF_SLUG' },
          hints: { H1: bi('cache: key и paths в джобе build.', 'cache: key and paths in the build job.'), H2: bi('```yaml\n  cache:\n    key: npm-$CI_COMMIT_REF_SLUG\n    paths: [.npm/]\n```', '```yaml\n  cache:\n    key: npm-$CI_COMMIT_REF_SLUG\n    paths: [.npm/]\n```') },
        },
        {
          id: 'expire',
          prompt: bi('Артефакты сборки занимают место на forge. Найдите в справочнике ключевых слов GitLab, как хранить артефакт `dist/` одну неделю, и отправьте пайплайн с этим сроком.', 'Build artifacts take space on the forge. Find in the GitLab keyword reference how to keep the `dist/` artifact for one week, and push a pipeline with that expiry.'),
          check: { when: (f) => mainOk(f) && /^1\s*(week|wk|weeks)$|^7\s*(days?|d)$/.test(pushedCi(f)?.config?.jobs.find((j) => j.name === 'build')?.artifacts?.expireIn ?? '') },
          docStep: 3,
          chips: 'artifacts:expire_in',
          docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'artifacts', line: 'expire_in' },
          hints: { H1: bi('Это подключ artifacts; значение пишется словами.', 'It is a sub-key of artifacts; the value is written in words.') },
        },
      ],
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
  summary: bi('Секрет живёт в настройках проекта, а не в репозитории. Окружение помнит, что туда выкачено. Одна строка when: manual отличает Continuous Delivery от Continuous Deployment.', 'A secret lives in the project settings, not in the repository. An environment remembers what was deployed to it. One line, when: manual, tells Continuous Delivery from Continuous Deployment.'),
  introduces: ['cicd.variable', 'cicd.environment', 'cicd.manual'],
  uses: ['cicd.artifact', 'cicd.job'],
  tier: 'core',
  minutes: 35,
  sources: src([S.variables, S.envs, S.fowlerCd], [S.ruCd, S.ruCi]),
  sections: [
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Выкладке нужен ключ — пароль, токен, SSH-ключ. В репозиторий его класть нельзя: всё, что попало в историю, остаётся там навсегда и видно каждому, у кого есть копия. Поэтому секреты задают в настройках проекта на forge (Settings → CI/CD → Variables, или `glab variable set`), и forge передаёт их джобе как переменные окружения. Это [[cicd.variable|переменные CI/CD]]. Рядом с ними джоба всегда получает предопределённые: `$CI_COMMIT_SHORT_SHA`, `$CI_COMMIT_BRANCH`, `$CI_DEFAULT_BRANCH`, `$CI_PIPELINE_SOURCE`.\n\nУ переменной два важных флага. **Masked**: раннер заменяет значение в логе на `[MASKED]` — но только точное значение; `echo $TOKEN | base64` выведет его в другом виде, и маска не поможет. **Protected**: переменную получают только пайплайны защищённых веток и тегов. Любой, кто может пушить ветку, может написать в ней `echo $DEPLOY_TOKEN`; защищённая переменная в такой ветке просто пуста.\n\n### Окружения и ручной шаг\n\nДжоба с `environment: staging` выкладывает в [[cicd.environment|окружение CI]], и forge ведёт его историю: какой коммит, когда, каким пайплайном выкачен. Откатиться — значит повторить старую успешную выкладку.\n\nПоследний шаг конвейера отвечает на вопрос, который вы видели в блоке методологии. Если production обновляется сам после staging — это Continuous Deployment. Если перед ним стоит [[cicd.manual|ручная джоба]] — `when: manual`, кнопка ▶ на странице пайплайна (`glab ci trigger`), — это Continuous Delivery: каждая версия готова к выпуску, а выпуск — решение человека. Разница в одной строке YAML. Ручная джоба, заданная в `rules`, держит пайплайн в состоянии **blocked**, пока её не запустят.',
        'A deployment needs a key: a password, a token, an SSH key. It must not go into the repository: whatever gets into the history stays there forever, visible to anyone who has a copy. So secrets are set in the project settings on the forge (Settings → CI/CD → Variables, or `glab variable set`), and the forge passes them to the job as environment variables. These are [[cicd.variable|CI/CD variables]]. Next to them a job always gets the predefined ones: `$CI_COMMIT_SHORT_SHA`, `$CI_COMMIT_BRANCH`, `$CI_DEFAULT_BRANCH`, `$CI_PIPELINE_SOURCE`.\n\nA variable has two important flags. **Masked**: the runner replaces the value in the log with `[MASKED]`, but only the exact value; `echo $TOKEN | base64` prints it in another form and the mask does not help. **Protected**: only pipelines of protected branches and tags get the variable. Anyone who can push a branch can write `echo $DEPLOY_TOKEN` in it; on such a branch a protected variable is simply empty.\n\n### Environments and the manual step\n\nA job with `environment: staging` deploys to a [[cicd.environment|CI environment]], and the forge keeps its history: which commit, when, by which pipeline. Rolling back means repeating an old successful deployment.\n\nThe last step of the pipeline answers a question from the methodology block. If production updates by itself after staging, it is Continuous Deployment. If a [[cicd.manual|manual job]] stands before it (`when: manual`, the ▶ button on the pipeline page, `glab ci trigger`), it is Continuous Delivery: every version is ready to release, and releasing is a human decision. The difference is one line of YAML. A manual job set in `rules` keeps the pipeline **blocked** until someone runs it.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: projectSetup({ '.gitlab-ci.yml': DEPLOY_CI }),
      intro: bi('Пайплайн выкладывает в staging и production. Скрипт `deploy.sh` требует переменную `DEPLOY_TOKEN`; токен выкладки — `edu-deploy-7Kq2`.', 'The pipeline deploys to staging and production. The `deploy.sh` script needs the `DEPLOY_TOKEN` variable; the deploy token is `edu-deploy-7Kq2`.'),
      tasks: [
        {
          id: 'secret',
          prompt: bi('Задайте `DEPLOY_TOKEN` в настройках проекта как masked и protected, отправьте коммит в main — staging должен обновиться. В логе значения токена быть не должно.', 'Set `DEPLOY_TOKEN` in the project settings as masked and protected, push a commit to main, and staging must update. The token value must not appear in the log.'),
          check: {
            when: (f) => (ci(f)?.deployments ?? []).some((d) => d.env === 'staging') && (ci(f)?.variables ?? []).some((v) => v.key === 'DEPLOY_TOKEN' && v.masked && v.protected) && !(ci(f)?.pipelines ?? []).some((p) => p.jobs.some((j) => j.log.includes('edu-deploy-7Kq2'))),
            fail: [
              { if: (f) => forge(f)?.commits.some((c) => Object.values(c.files).some((t) => t.includes('edu-deploy-7Kq2'))) ?? false, say: bi('Токен попал в коммит на forge — теперь он в истории. Уберите его из файлов, задайте переменной и считайте токен утёкшим.', 'The token got into a commit on the forge: it is in the history now. Remove it from the files, set it as a variable and treat the token as leaked.') },
              { if: (f) => (jobOf(f, 'deploy_staging')?.log ?? '').includes('DEPLOY_TOKEN is not set'), say: bi('Джоба выкладки не получила токен. Задайте переменную: glab variable set DEPLOY_TOKEN … --masked --protected.', 'The deploy job did not get the token. Set the variable: glab variable set DEPLOY_TOKEN … --masked --protected.') },
            ],
          },
          chips: 'glab variable set DEPLOY_TOKEN edu-deploy-7Kq2 --masked --protected',
          concepts: ['cicd.variable', 'cicd.environment'],
          hints: { H1: bi('Секрет — в настройки проекта, не в файл.', 'The secret goes to the project settings, not to a file.') },
        },
        {
          id: 'manual',
          prompt: bi('Сейчас production выкатывается сам — это Continuous Deployment. Сделайте Continuous Delivery: production только по кнопке. Отправьте изменение и затем сами запустите выкладку в production.', 'Right now production deploys by itself: Continuous Deployment. Make it Continuous Delivery: production only on a button press. Push the change, then run the production deployment yourself.'),
          check: {
            when: (f) => {
              const p = lastPipeline(f, { ref: 'main' });
              const job = pushedCi(f)?.config?.jobs.find((j) => j.name === 'deploy_production');
              const manualInFile = !!job && (job.when === 'manual' || (job.rules ?? []).some((r) => r.when === 'manual'));
              return manualInFile && p?.jobs.find((j) => j.name === 'deploy_production')?.status === 'success' && (p?.jobs.find((j) => j.name === 'deploy_production')?.when === 'manual');
            },
            fail: [{ if: (f) => lastPipeline(f, { ref: 'main' })?.status === 'blocked', say: bi('Пайплайн ждёт кнопку: glab ci trigger deploy_production.', 'The pipeline waits for the button: glab ci trigger deploy_production.') }],
          },
          chips: 'glab ci trigger deploy_production',
          concepts: ['cicd.manual'],
          docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'when', line: 'manual' },
          hints: { H1: bi('when: manual в правиле deploy_production.', 'when: manual in the deploy_production rule.') },
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
  title: bi('Правила и граф джоб', 'Rules and the job graph'),
  summary: bi('Один файл пайплайна ведёт себя по-разному в merge request, в main и на теге; needs позволяет джобам не ждать всю стадию.', 'One pipeline file behaves differently in a merge request, on main and on a tag; needs lets jobs skip waiting for the whole stage.'),
  introduces: ['cicd.rules', 'cicd.needs'],
  uses: ['cicd.manual', 'cicd.stage', 'git.mr'],
  tier: 'core',
  minutes: 35,
  sources: src([S.yaml, S.needs, S.mr], [S.ruFirst, S.ruActions]),
  sections: [
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Пайплайн запускается по разным событиям: push в ветку, merge request, тег версии. Какие джобы попадут в пайплайн, решают [[cicd.rules|rules]] — список условий у джобы. Правила проверяются по порядку при создании пайплайна; первое подошедшее решает, как джоба войдёт (`when: on_success`, `manual`, `never`), а если не подошло ни одно — джобы в пайплайне нет. Условие `if` — выражение над переменными: `$CI_PIPELINE_SOURCE == "merge_request_event"` (пайплайн merge request), `$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH` (push в main), `$CI_COMMIT_TAG =~ /^v\\d+\\.\\d+\\.\\d+$/` (тег версии). `changes` добавляет джобу, только если в push менялись нужные файлы. Обратите внимание: джоба вовсе без `rules` в пайплайн merge request не попадает.\n\nСтадии задают порядок грубо: джоба ждёт **всю** предыдущую стадию, даже если ей нужна одна джоба из неё. [[cicd.needs|needs]] задаёт зависимости точно: `needs: [build]` — стартовать, как только готова `build`, и скачать артефакты только от неё; `needs: []` — стартовать сразу. Пайплайн превращается из «лесенки стадий» в граф и часто заметно короче. Цена — следить за графом: `needs` на джобу, которую `rules` исключили из пайплайна, делает пайплайн невалидным.',
        'A pipeline starts on different events: a push to a branch, a merge request, a version tag. Which jobs get into the pipeline is decided by [[cicd.rules|rules]], a list of conditions on a job. Rules are checked in order when the pipeline is created; the first match decides how the job enters (`when: on_success`, `manual`, `never`), and if none matches, the job is not in the pipeline. An `if` condition is an expression over variables: `$CI_PIPELINE_SOURCE == "merge_request_event"` (a merge request pipeline), `$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH` (a push to main), `$CI_COMMIT_TAG =~ /^v\\d+\\.\\d+\\.\\d+$/` (a version tag). `changes` adds a job only if the push changed the given files. Note: a job with no `rules` at all does not get into merge request pipelines.\n\nStages set the order coarsely: a job waits for the **whole** previous stage even if it needs one job of it. [[cicd.needs|needs]] sets the dependencies exactly: `needs: [build]` means start as soon as `build` is done and download artifacts only from it; `needs: []` means start at once. The pipeline turns from a "staircase of stages" into a graph and is often noticeably shorter. The price is watching the graph: `needs` on a job that `rules` removed from the pipeline makes the pipeline invalid.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: projectSetup({ '.gitlab-ci.yml': RULES_CI }, { forge: [{ project: 'team/site', variables: [{ key: 'DEPLOY_TOKEN', value: 'edu-deploy-7Kq2', masked: true, protected: true }] }] }),
      intro: bi('Линтер идёт полторы минуты модели и тормозит тесты. Выкладка в staging запускается на любой ветке.', 'The linter takes a minute and a half of model time and holds the tests back. The staging deploy runs on any branch.'),
      tasks: [
        {
          id: 'needs',
          prompt: bi('Сделайте так, чтобы `test` стартовала сразу после `build`, не дожидаясь `lint`, и отправьте в main. Пайплайн должен пройти.', 'Make `test` start right after `build` without waiting for `lint`, and push to main. The pipeline must pass.'),
          check: {
            when: (f) => {
              const p = lastPipeline(f, { ref: 'main' });
              const b = p?.jobs.find((j) => j.name === 'build');
              const l = p?.jobs.find((j) => j.name === 'lint');
              const t = p?.jobs.find((j) => j.name === 'test');
              return p?.status === 'success' && !!b && !!l && !!t && (t.start ?? 0) >= (b.end ?? 0) && (t.start ?? 0) < (l.end ?? 0);
            },
          },
          chips: 'glab ci view',
          concepts: ['cicd.needs'],
          docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'needs', line: 'needs: ["linux:build"]' },
          hints: { H1: bi('Укажите test, что ей на самом деле нужно.', 'Tell test what it actually needs.'), H2: bi('`needs: [build]` в джобе test.', '`needs: [build]` in the test job.') },
        },
        {
          id: 'rules',
          prompt: bi('Выкладка в staging — только при push в main; в ветках и merge request её быть не должно. Проверьте: отправьте ветку `feature/menu` и откройте из неё merge request — в его пайплайне должны быть `build`, `lint` и `test`, без выкладки.', 'Staging deploys only on a push to main; never on branches and merge requests. Check it: push a branch `feature/menu` and open a merge request from it; its pipeline must have `build`, `lint` and `test`, without the deploy.'),
          check: {
            when: (f) => {
              const mrp = lastPipeline(f, { source: 'merge_request_event' });
              const names = (mrp?.jobs ?? []).map((j) => j.name).sort().join(',');
              const cfg = pushedCi(f)?.config;
              const dep = cfg?.jobs.find((j) => j.name === 'deploy_staging');
              return names === 'build,lint,test' && !!dep?.rules?.length;
            },
            fail: [
              { if: (f) => !!lastPipeline(f, { source: 'merge_request_event' }) && !(lastPipeline(f, { source: 'merge_request_event' })?.jobs.some((j) => j.name === 'test')), say: bi('В пайплайн merge request не попадают джобы без rules. Дайте build, lint и test правило для merge_request_event и для main.', 'Jobs without rules do not get into merge request pipelines. Give build, lint and test a rule for merge_request_event and for main.') },
              { if: (f) => (lastPipeline(f, { source: 'merge_request_event' })?.jobs ?? []).some((j) => j.name === 'deploy_staging'), say: bi('Выкладка всё ещё в пайплайне merge request: её правило должно проверять ветку main.', 'The deploy is still in the merge request pipeline: its rule must check for the main branch.') },
            ],
          },
          chips: 'glab mr create --fill --target-branch main',
          concepts: ['cicd.rules'],
          docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'rules', line: 'merge_request_event' },
          hints: { H1: bi('Нужны два вида правил: для проверок (MR или main) и для выкладки (только main).', 'You need two kinds of rules: for the checks (MR or main) and for the deploy (main only).'), H2: bi('Проверкам: `rules: [{if: \'$CI_PIPELINE_SOURCE == "merge_request_event"\'}, {if: \'$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\'}]`; выкладке — только второе.', 'For the checks: `rules: [{if: \'$CI_PIPELINE_SOURCE == "merge_request_event"\'}, {if: \'$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH\'}]`; for the deploy, only the second.') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Линтер стиля иногда падает на старых страницах, и команда решила: пусть его падение не блокирует пайплайн, но остаётся видимым предупреждением. Тесты при этом должны по-прежнему блокировать. В уроке этого ключа не было — найдите его в справочнике GitLab.', 'The style linter sometimes fails on old pages, and the team decided its failure must not block the pipeline but stay visible as a warning. The tests must still block. The lesson did not show this key: find it in the GitLab reference.'),
      ref: { page: 'web/docs.gitlab.com/ci/yaml' },
      terminal: {
        setup: projectSetup({ '.gitlab-ci.yml': RULES_CI, 'src/old.html': '<title>Old</title>\n<h1>Old page</h1>\n<p style="color:red">Closed for renovation</p>\n' }, { forge: [{ project: 'team/site', variables: [{ key: 'DEPLOY_TOKEN', value: 'edu-deploy-7Kq2', masked: true, protected: true }] }] }),
        task: {
          id: 'allow',
          prompt: bi('lint падает, пайплайн main проходит, test не трогали.', 'lint fails, the main pipeline passes, test is untouched.'),
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
      prompt: bi('Три джобы стоят в одной стадии test. Сделайте так, чтобы build шла раньше test, а deploy — последней, и отправьте в main.', 'Three jobs are in one stage, test. Make build run before test and deploy last, and push to main.'),
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
      prompt: bi('Джоба test в main висит в pending. Найдите причину и добейтесь зелёного пайплайна.', 'The test job on main hangs in pending. Find the cause and get a green pipeline.'),
      check: { when: (f) => mainOk(f) },
    },
  },
  { id: 'cicd.place.delivery', level: 'experienced', key: true, concepts: ['cicd.manual'], kind: 'quiz', item: { ...(quiz.find((q) => q.id === 'cicd.q.delivery') as QuizItem), id: 'cicd.place.q.delivery' } },
  { id: 'cicd.place.rules', level: 'experienced', key: true, concepts: ['cicd.rules'], kind: 'quiz', item: { ...(quiz.find((q) => q.id === 'cicd.q.rules') as QuizItem), id: 'cicd.place.q.rules' } },
];

export const block: Block = {
  id: 'cicd',
  order: 50,
  title: bi('CI/CD', 'CI/CD'),
  summary: bi('Удалённый репозиторий, merge request; пайплайн от проверки до выкладки на GitLab CI: джобы, стадии, раннеры, артефакты и кэш, секреты, окружения, ручной шаг, правила и needs.', 'The remote repository and merge requests; a pipeline from checks to deployment on GitLab CI: jobs, stages, runners, artifacts and cache, secrets, environments, the manual step, rules and needs.'),
  checklistStep: '01',
  levels: {
    beginner: bi('Знает Git по нашему блоку', 'Knows Git from our block'),
    intermediate: bi('Видел зелёные галочки CI', 'Has seen green CI ticks'),
    experienced: bi('Правил CI-файл, не строил пайплайн до выкладки', 'Has edited a CI file, never built a pipeline up to deployment'),
  },
  hours: { beginner: 19, intermediate: 13, experienced: 8 },
  lessons: lessons.map((l) => l.id),
  sources: src([S.yaml, S.runner, S.envs], [S.ruCi, S.ruCd, S.ruCacheArt]),
  docSources: ['git-help', 'docs.gitlab.com'],
  placement,
};

