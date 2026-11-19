// Block exams of Git and YAML and of CI/CD (10 §6.1, 06 §3.8). Each is a
// story in business words, checked by the state of the repository, the forge
// and the pipelines (any way to the state counts), with a critical task, at
// least 10% of the weight beyond the course at doc step 5 (only the listed
// documentation is open, no hints), a soft timer and two "explain" questions.

import YAML from 'yaml';
import { bi } from '../../../core/i18n';
import type { Exam, Facts } from '../../../core/types';
import { parseCi } from '../ci/config';
import { ci, forge, gitSetup, head, jobOf, lastPipeline, projectSetup, repo } from './common';

// ── Git and YAML: the café config ──

const MENU = '---\nmenu:\n  - name: espresso\n    price: 2.5\n  - name: latte\n    price: 3.5\n';
const MENU_OURS = MENU.replace('price: 2.5', 'price: 2.8');
const MENU_THEIRS = MENU.replace('    price: 2.5\n', '    price: 2.5\n    size: small\n');
const SITE_YAML = '---\nsite:\n  name: edu-cafe\n  country: NO\n  version: 1.10\n  delivery: yes\n';

const tipFile = (f: Facts, path: string) => head(f)?.files[path] ?? '';

export const GIT_YAML_EXAM: Exam = {
  id: 'git-yaml.exam.config',
  block: 'git-yaml',
  kind: 'block',
  title: bi('Экзамен Git и YAML: конфигурация кофейни', 'Git and YAML exam: the café configuration'),
  intro: bi(
    'Четыре карточки по репозиторию с настройками сайта кофейни. Проверяется состояние репозитория и файлов, а не набранные команды: подходит любой путь. Подсказок нет; открыта встроенная справка Git и `yamllint --help`.',
    'Four cards about the repository with the café site’s settings. The state of the repository and the files is checked, not the commands you type: any way works. There are no hints; the built-in Git help and `yamllint --help` are open.',
  ),
  story: bi(
    'Настройки сайта кофейни лежат в YAML-файлах в Git. Над ними работают двое — вы и бариста, который правит меню, — и за неделю в репозитории накопились недоделки. Завтра сайт переезжает на новый сервер, и администратор просит навести порядок.',
    'The café site’s settings live in YAML files in Git. Two people work on them, you and a barista who edits the menu, and in a week the repository has gathered loose ends. Tomorrow the site moves to a new server, and the administrator asks you to tidy up.',
  ),
  minutes: 40,
  pass: 0.7,
  allowedDocs: ['git-help', 'help'],
  explain: [
    {
      id: 'e1',
      prompt: bi('Администратор спрашивает: «Почему Git сам не выбрал одну из двух цен эспрессо?» Объясните.', 'The administrator asks: “Why didn’t Git pick one of the two espresso prices by itself?” Explain.'),
      keyPoints: [bi('Git сравнивает обе ветки с общим предком', 'Git compares both branches with the common ancestor'), bi('строку изменили обе стороны по-разному', 'both sides changed the line differently'), bi('какая цена верна — решение человека, а не программы', 'which price is right is a human decision, not the program’s'), bi('без пересечений Git сливает сам', 'without overlaps Git merges by itself')],
    },
    {
      id: 'e2',
      prompt: bi('«Почему `country: NO` в YAML может оказаться не строкой?»', '“Why may `country: NO` in YAML turn out not to be a string?”'),
      keyPoints: [bi('по YAML 1.1 NO, yes, on — логические значения', 'in YAML 1.1 NO, yes, on are booleans'), bi('многие инструменты читают YAML 1.1', 'many tools read YAML 1.1'), bi('кавычки делают значение строкой в любой версии', 'quotes make the value a string in any version'), bi('1.10 без кавычек становится числом 1.1', '1.10 without quotes becomes the number 1.1')],
    },
  ],
  tasks: [
    {
      id: 'prices',
      weight: 30,
      critical: true,
      kind: 'task',
      setup: gitSetup({
        repos: [
          {
            path: '~/site',
            commits: [
              { message: 'Add the menu', files: { 'menu.yaml': MENU, 'site.yaml': SITE_YAML } },
              { message: 'Add cup sizes', branch: 'sizes', files: { 'menu.yaml': MENU_THEIRS }, author: { name: 'Barista Bob', email: 'bob@example.com' } },
              { message: 'Raise the espresso price', branch: 'main', files: { 'menu.yaml': MENU_OURS } },
            ],
            checkout: 'main',
          },
        ],
      }),
      task: {
        id: 'prices',
        prompt: bi('Карточка 1. «Бариста добавил в ветке `sizes` размеры чашек, а я в main поднял цену эспрессо до 2.8. Влейте его ветку в main так, чтобы в меню были и размеры, и новая цена, и чтобы файл остался правильным YAML».', 'Card 1. “The barista added cup sizes on the `sizes` branch, and I raised the espresso price to 2.8 on main. Merge his branch into main so that the menu has both the sizes and the new price, and the file stays valid YAML.”'),
        check: {
          when: (f) => {
            const r = repo(f);
            const h = head(f);
            if (!r || r.branch !== 'main' || r.merging || !h || h.parents.length !== 2) return false;
            try {
              const m = YAML.parse(h.files['menu.yaml'] ?? '') as { menu?: { name: string; price: number; size?: string }[] };
              const esp = m.menu?.find((x) => x.name === 'espresso');
              return esp?.price === 2.8 && esp?.size === 'small' && !/^(<<<<<<<|=======|>>>>>>>)/m.test(h.files['menu.yaml']);
            } catch {
              return false;
            }
          },
          fail: [{ if: (f) => /^(<<<<<<<|>>>>>>>)/m.test(tipFile(f, 'menu.yaml')), say: bi('В закоммиченном файле остались маркеры конфликта.', 'The committed file still has conflict markers.') }],
        },
      },
    },
    {
      id: 'traps',
      weight: 25,
      kind: 'task',
      setup: gitSetup({ repos: [{ path: '~/site', commits: [{ message: 'Add the site settings', files: { 'menu.yaml': MENU, 'site.yaml': SITE_YAML } }] }] }),
      task: {
        id: 'traps',
        prompt: bi('Карточка 2. «Новый сервер читает `site.yaml` по YAML 1.1. Страна у нас — Норвегия (строка `NO`), версия сайта — строка `1.10`, доставка — включена. Исправьте файл, чтобы его поняли однозначно и yamllint не ругался, и закоммитьте».', 'Card 2. “The new server reads `site.yaml` as YAML 1.1. Our country is Norway (the string `NO`), the site version is the string `1.10`, delivery is on. Fix the file so it is read unambiguously and yamllint has no complaints, and commit it.”'),
        check: {
          when: (f) => {
            const t = tipFile(f, 'site.yaml');
            try {
              const v = YAML.parse(t) as { site?: Record<string, unknown> };
              return /country:\s*["']NO["']/.test(t) && /version:\s*["']1\.10["']/.test(t) && v.site?.delivery === true && !/:\s*(yes|no|on|off|y|n)\s*$/im.test(t) && t.startsWith('---') && v.site?.name === 'edu-cafe';
            } catch {
              return false;
            }
          },
        },
      },
    },
    {
      id: 'noff',
      weight: 30,
      kind: 'task',
      setup: gitSetup({ repos: [{ path: '~/site', commits: [{ message: 'Add the menu', files: { 'menu.yaml': MENU, 'site.yaml': SITE_YAML.replace('NO', '"NO"').replace('1.10', '"1.10"').replace('yes', 'true') } }, { message: 'Add opening hours', branch: 'feature/hours', files: { 'hours.yaml': '---\nhours:\n  weekdays: "8-20"\n  weekend: "10-18"\n' } }], checkout: 'main' }] }),
      task: {
        id: 'noff',
        prompt: bi('Карточка 3. «Влейте `feature/hours` в main. Мы договорились, что в истории main каждая влитая ветка видна отдельным коммитом слияния — даже когда Git мог бы обойтись без него».', 'Card 3. “Merge `feature/hours` into main. We agreed that in main’s history every merged branch is visible as a merge commit of its own, even when Git could do without one.”'),
        docStep: 3,
        docRef: { page: 'man/git-merge.1', anchor: 'OPTIONS', line: '--no-ff' },
        check: { when: (f) => repo(f)?.branch === 'main' && (head(f)?.parents.length ?? 0) === 2 && 'hours.yaml' in (head(f)?.files ?? {}) },
      },
    },
    {
      id: 'amend',
      weight: 15,
      beyond: true,
      kind: 'task',
      setup: gitSetup({ repos: [{ path: '~/site', commits: [{ message: 'Add the menu', files: { 'menu.yaml': MENU } }, { message: 'Updte menu prcies', files: { 'menu.yaml': MENU_OURS } }] }] }),
      task: {
        id: 'amend',
        prompt: bi('Карточка 4. «В сообщении последнего коммита две опечатки: `Updte menu prcies`. Его ещё никто не забирал. Исправьте сообщение на `Update menu prices`, не добавляя в историю нового коммита». Это задача вне курса: ответ — в справке Git.', 'Card 4. “The last commit message has two typos: `Updte menu prcies`. Nobody has pulled it yet. Fix the message to `Update menu prices` without adding a new commit to the history.” This task is beyond the course: the answer is in the Git help.'),
        docStep: 5,
        beyond: true,
        docRef: { page: 'man/git-commit.1' },
        solutionTokens: ['--amend', 'git commit --amend'],
        check: { when: (f, start) => head(f)?.message.trim() === 'Update menu prices' && head(f)?.files['menu.yaml'] === MENU_OURS && (repo(f)?.commits.length ?? 0) === (start ? (repo(start)?.commits.length ?? 0) : 2) },
      },
    },
  ],
};

// ── CI/CD: the release pipeline of the café site ──

const pushedCi = (f: Facts) => {
  const fg = forge(f);
  const text = fg?.commits.find((c) => c.oid === fg.branches.main)?.files['.gitlab-ci.yml'];
  return text ? { text, parsed: parseCi(text) } : null;
};

const BROKEN_ARTIFACT_CI = `stages: [build, deploy]

build:
  stage: build
  image: node:24-alpine
  script:
    - npm ci --cache .npm --prefer-offline
    - npm run build

deploy_staging:
  stage: deploy
  image: alpine:3.22
  script:
    - ./deploy.sh staging
  environment: staging
`;
const STUCK_CI = `stages: [build, deploy]

build:
  stage: build
  image: node:24-alpine
  tags: [dokcer]
  script:
    - npm ci --cache .npm --prefer-offline
    - npm run build
  artifacts:
    paths: [dist/]

deploy_staging:
  stage: deploy
  image: alpine:3.22
  script:
    - ./deploy.sh staging
  environment: staging
`;
const RELEASE_CI = `stages: [build, deploy]

build:
  stage: build
  image: node:24-alpine
  script:
    - npm ci --cache .npm --prefer-offline
    - npm run build
  artifacts:
    paths: [dist/]

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
const REPEAT_CI = `stages: [build, test]

build:
  stage: build
  image: node:24-alpine
  script:
    - npm ci --cache .npm --prefer-offline
    - npm run build
  artifacts:
    paths: [dist/]

lint:
  stage: test
  image: node:24-alpine
  script:
    - npm run lint

test:
  stage: test
  image: node:24-alpine
  script:
    - npm test

smoke:
  stage: test
  image: node:24-alpine
  script:
    - test -f dist/index.html
`;

const token = [{ key: 'DEPLOY_TOKEN', value: 'edu-deploy-7Kq2', masked: true, protected: true }];
const deliverOk = (f: Facts) => {
  const p = lastPipeline(f, { ref: 'main' });
  return p?.status === 'success' && p.jobs.find((j) => j.name === 'deploy_staging')?.status === 'success';
};

export const CICD_EXAM: Exam = {
  id: 'cicd.exam.release',
  block: 'cicd',
  kind: 'block',
  title: bi('Экзамен CI/CD: конвейер для сайта кофейни', 'CI/CD exam: a pipeline for the café site'),
  intro: bi(
    'Четыре карточки из трекера команды сайта. Проверяется то, что увидел forge: пайплайны, джобы, переменные, выкладки, — а не набранные команды. Подсказок нет; открыт только справочник ключевых слов GitLab CI.',
    'Four cards from the site team’s tracker. What the forge saw is checked: pipelines, jobs, variables, deployments, not the commands you type. There are no hints; only the GitLab CI keyword reference is open.',
  ),
  story: bi(
    'Сайт кофейни переехал на forge, но пайплайна у него почти нет: проверки запускают руками, выкладка падает через раз, а в production версия уходит вместе с каждым коммитом. Тимлид оставил четыре карточки и уехал на поставку зерна.',
    'The café site moved to the forge, but it has hardly any pipeline: checks are run by hand, the deployment fails every other time, and every commit goes straight to production. The team lead left four cards and went to collect a coffee delivery.',
  ),
  minutes: 60,
  pass: 0.7,
  allowedDocs: ['docs.gitlab.com'],
  explain: [
    {
      id: 'e1',
      prompt: bi('«Мы теперь делаем Continuous Delivery или Continuous Deployment? Что поменять, чтобы стало наоборот?»', '“Are we doing Continuous Delivery or Continuous Deployment now? What would we change to get the other one?”'),
      keyPoints: [bi('ручной шаг перед production — Continuous Delivery', 'a manual step before production is Continuous Delivery'), bi('каждая версия готова к выпуску, выпуск — решение человека', 'every version is ready to release; releasing is a human decision'), bi('без when: manual production обновляется сам — Continuous Deployment', 'without when: manual production updates by itself: Continuous Deployment'), bi('разница — одна строка в файле пайплайна', 'the difference is one line in the pipeline file')],
    },
    {
      id: 'e2',
      prompt: bi('«Чем ваш кэш отличается от артефакта, и что будет, если кэш пропадёт?»', '“How does your cache differ from the artifact, and what happens if the cache vanishes?”'),
      keyPoints: [bi('артефакт передаёт результат следующим джобам и обязан дойти', 'an artifact passes a result to later jobs and must arrive'), bi('кэш только ускоряет и не гарантирован', 'a cache only speeds things up and is not guaranteed'), bi('без кэша сборка проходит, только медленнее', 'without the cache the build passes, only slower'), bi('кэш лежит у раннера под ключом', 'the cache lies on the runner under a key')],
    },
  ],
  tasks: [
    {
      id: 'mr',
      weight: 25,
      critical: true,
      kind: 'task',
      setup: projectSetup(),
      task: {
        id: 'mr',
        prompt: bi('Карточка 1. «Хочу, чтобы на каждый merge request сами запускались тесты (`./test.sh`) и линтер (`./lint.sh`), и чтобы упавший тест не давал вливать. Проверьте на ветке `feature/menu` с любой правкой».', 'Card 1. “I want the tests (`./test.sh`) and the linter (`./lint.sh`) to run by themselves on every merge request, and a failed test to block merging. Check it on a branch `feature/menu` with any edit.”'),
        check: {
          when: (f) => {
            const p = lastPipeline(f, { source: 'merge_request_event' });
            if (!p || p.status !== 'success') return false;
            const runs = (cmd: string) => p.jobs.find((j) => j.log.includes(cmd) && j.status === 'success');
            const t = runs('test.sh');
            return !!t && !!runs('lint.sh') && !t.allowFailure;
          },
          fail: [{ if: (f) => (lastPipeline(f, { source: 'merge_request_event' })?.jobs ?? []).some((j) => j.log.includes('test.sh') && j.allowFailure), say: bi('allow_failure у тестов значит, что упавший тест вливать не мешает.', 'allow_failure on the tests means a failed test does not block merging.') }],
        },
      },
    },
    {
      id: 'artifact',
      weight: 20,
      pool: 'fault',
      kind: 'task',
      setup: projectSetup({ '.gitlab-ci.yml': BROKEN_ARTIFACT_CI }, { forge: [{ project: 'team/site', variables: token }] }),
      task: {
        id: 'artifact',
        prompt: bi('Карточка 2. «Выкладка на staging падает с `dist/index.html not found`, хотя сборка зелёная. Почините, не меняя скрипты джоб».', 'Card 2. “The staging deployment fails with `dist/index.html not found`, though the build is green. Fix it without changing the job scripts.”'),
        check: { when: deliverOk },
      },
    },
    {
      id: 'stuck',
      weight: 20,
      pool: 'fault',
      kind: 'task',
      setup: projectSetup({ '.gitlab-ci.yml': STUCK_CI }, { forge: [{ project: 'team/site', variables: token }] }),
      task: {
        id: 'stuck',
        prompt: bi('Карточка 2. «Пайплайн main со вчерашнего дня висит и до выкладки не доходит. Найдите причину и добейтесь выкладки на staging».', 'Card 2. “The main pipeline has been hanging since yesterday and never reaches the deployment. Find the cause and get the staging deployment through.”'),
        check: { when: deliverOk },
      },
    },
    {
      id: 'release',
      weight: 25,
      kind: 'task',
      setup: projectSetup({ '.gitlab-ci.yml': RELEASE_CI }),
      task: {
        id: 'release',
        prompt: bi('Карточка 3. «Выкладке нужен токен `edu-deploy-7Kq2` — храните его как секрет, а не в коде. Staging пусть обновляется сам из main, а production — только из тегов версии вида `v1.2.3` и только по кнопке. Выпустите `v1.0.0`, чтобы я проверил».', 'Card 3. “The deployment needs the token `edu-deploy-7Kq2`: keep it as a secret, not in the code. Let staging update by itself from main, and production only from version tags like `v1.2.3` and only on a button press. Release `v1.0.0` so I can check.”'),
        check: {
          when: (f) => {
            const v = ci(f)?.variables.find((x) => x.key === 'DEPLOY_TOKEN');
            if (!v?.masked || !v.protected) return false;
            if (forge(f)?.commits.some((c) => Object.values(c.files).some((t) => t.includes('edu-deploy-7Kq2')))) return false;
            const pipes = ci(f)?.pipelines ?? [];
            const main = [...pipes].reverse().find((p) => p.ref === 'main' && p.source === 'push' && !p.tag);
            const tagP = [...pipes].reverse().find((p) => !!p.tag && /^v\d+\.\d+\.\d+$/.test(p.tag));
            const mainOk = !!main && main.jobs.find((j) => j.name === 'deploy_staging')?.status === 'success' && !main.jobs.some((j) => j.name === 'deploy_production');
            const prod = tagP?.jobs.find((j) => j.name === 'deploy_production');
            return mainOk && !!prod && prod.when === 'manual';
          },
          fail: [{ if: (f) => !(ci(f)?.pipelines ?? []).some((p) => !!p.tag), say: bi('Тега на forge ещё нет: git tag v1.0.0 и git push origin v1.0.0.', 'There is no tag on the forge yet: git tag v1.0.0 and git push origin v1.0.0.') }],
        },
      },
    },
    {
      id: 'default',
      weight: 15,
      beyond: true,
      kind: 'task',
      setup: projectSetup({ '.gitlab-ci.yml': REPEAT_CI }),
      task: {
        id: 'default',
        prompt: bi('Карточка 4. «Во всех джобах повторяется `image: node:24-alpine`. Задайте образ в одном месте так, чтобы и новая джоба получала его сама, и чтобы пайплайн main остался зелёным». Это задача вне курса: ответ — в справочнике GitLab.', 'Card 4. “Every job repeats `image: node:24-alpine`. Set the image in one place so that a new job gets it by itself too, and keep the main pipeline green.” This task is beyond the course: the answer is in the GitLab reference.'),
        docStep: 5,
        beyond: true,
        docRef: { page: 'web/docs.gitlab.com/ci/yaml', anchor: 'default' },
        solutionTokens: ['default:', 'default'],
        check: {
          when: (f) => {
            const c = pushedCi(f);
            if (!c?.parsed.config) return false;
            const once = (c.text.match(/^\s*image:/gm) ?? []).length === 1;
            const jobs = c.parsed.config.jobs;
            return once && jobs.length >= 4 && jobs.every((j) => j.image === 'node:24-alpine') && lastPipeline(f, { ref: 'main' })?.status === 'success' && jobOf(f, 'smoke', { ref: 'main' })?.status === 'success';
          },
        },
      },
    },
  ],
};

