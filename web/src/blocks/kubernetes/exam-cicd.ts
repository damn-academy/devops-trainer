// The exam of block 6a "Deploying to Kubernetes from CI" (06 §3.7 A7, 10 §6):
// a release day on the CI simulator. The deploy jobs run on the forge, and
// `kubectl` in their scripts changes the kube-lite cluster of the learner's
// machine, so every check reads the state of the cluster and of the forge —
// which image runs where, which job ran and how it ended — never a log that
// merely looks right. One fault of the first card comes from a pool; the last
// card needs an annotation the lesson did not show (DL5).

import { bi } from '../../core/i18n';
import type { Exam, Facts, TerminalSetup } from '../../core/types';
import type { K8sFacts } from '../../engine/kube-lite/facts';
import type { Obj } from '../../engine/kube-lite/util';
import { parseCi } from '../git-cicd/ci/config';
import { A7_CI, A7_GOOD_CI, a7Setup } from '../git-cicd/content/cicd-k8s';
import { ci, forge, jobOf, lastPipeline } from '../git-cicd/content/common';

const IMAGE = 'registry.forge.edu/team/site';

/** The pipeline with commit tags but without a wait or a rollback: green whatever happens in the cluster. */
export const TAG_ONLY_CI = `stages: [build, deploy]

build-image:
  stage: build
  image: docker:28
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

deploy_staging:
  stage: deploy
  image: bitnami/kubectl:1.34
  environment: staging
  script:
    - kubectl set image deployment/web web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
`;

const PRODUCTION = `apiVersion: v1
kind: Namespace
metadata:
  name: production
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: ${IMAGE}:latest
          ports:
            - containerPort: 80
`;

const withProduction = (s: TerminalSetup): TerminalSetup => {
  const k = (s.ext?.k8s ?? {}) as { manifests?: string[] };
  return { ...s, ext: { ...s.ext, k8s: { ...k, manifests: [...(k.manifests ?? []), PRODUCTION] } } };
};

/** The deployer key already in the project, but as an ordinary variable instead of a File. */
const plainVariable = (s: TerminalSetup): TerminalSetup => JSON.parse(JSON.stringify(s).replace('"file":true', '"file":false')) as TerminalSetup;

export const CICD_EXAM_SETUPS = {
  noKey: a7Setup(),
  plainKey: plainVariable(a7Setup({ kubeconfigVar: true })),
  latest: a7Setup({ ci: A7_CI, kubeconfigVar: true }),
  noWait: a7Setup({ ci: TAG_ONLY_CI, kubeconfigVar: true }),
  production: withProduction(a7Setup({ ci: A7_GOOD_CI, kubeconfigVar: true })),
  cause: a7Setup({ ci: A7_GOOD_CI, kubeconfigVar: true }),
};

// ── fact helpers ──

const k8s = (f: Facts) => f.k8s as K8sFacts | undefined;
const webIn = (f: Facts, nsName: string) => k8s(f)?.deployments.find((d) => d.ns === nsName && d.name === 'web');
const webObj = (f: Facts, nsName: string): Obj | undefined => k8s(f)?.objects.find((o) => o.kind === 'Deployment' && o.metadata?.namespace === nsName && o.metadata?.name === 'web');
const mainTip = (f: Facts) => {
  const fg = forge(f);
  return fg?.commits.find((c) => c.oid === fg.branches.main);
};
const shortSha = (f: Facts) => mainTip(f)?.oid.slice(0, 8) ?? '';
const tipImage = (f: Facts) => (shortSha(f) ? `${IMAGE}:${shortSha(f)}` : '');
const leaked = (f: Facts) => forge(f)?.commits.some((c) => Object.values(c.files).some((t) => t.includes('edu-sa-deployer-'))) ?? false;
const kcVar = (f: Facts) => ci(f)?.variables.find((v) => v.key === 'KUBECONFIG');
const deployOk = (f: Facts) => jobOf(f, 'deploy_staging', { ref: 'main' })?.status === 'success';
const pushedJob = (f: Facts, name: string) => {
  const text = mainTip(f)?.files['.gitlab-ci.yml'];
  return text ? parseCi(text).config?.jobs.find((j) => j.name === name) : undefined;
};
const pipelineJob = (f: Facts, name: string) => lastPipeline(f, { ref: 'main' })?.jobs.find((j) => j.name === name);

const keyCheck = {
  when: (f: Facts) => deployOk(f) && !!kcVar(f)?.file && !!kcVar(f)?.protected && !leaked(f),
  fail: [
    { if: (f: Facts) => leaked(f), say: bi('Ключ deployer оказался в коммите на forge и останется в истории навсегда. Его придётся отозвать, а новый положить в переменную проекта.', 'The deployer key ended up in a commit on the forge and stays in the history forever. It has to be revoked, and a new one put into a project variable.') },
    { if: (f: Facts) => !!kcVar(f) && !kcVar(f)?.file, say: bi('Переменная KUBECONFIG обычного типа: в джобе в ней лежит сам текст, а kubectl ждёт путь к файлу. Нужен тип File.', 'The KUBECONFIG variable is of the ordinary type: in the job it holds the text itself, while kubectl expects a path to a file. It must be of type File.') },
    { if: (f: Facts) => !!kcVar(f)?.file && !kcVar(f)?.protected, say: bi('Ключ кластера получает любая ветка. Отметьте переменную Protected: ключ нужен только main.', 'Any branch gets the cluster key. Mark the variable Protected: only main needs the key.') },
  ],
};

export const cicdExam: Exam = {
  id: 'cicd-k8s.exam',
  block: 'cicd-k8s',
  title: bi('День релиза', 'Release day'),
  intro: bi(
    'Пять карточек из трекера на одном проекте `~/site`: пайплайн собирает образ и выкладывает его в кластер. Каждая карточка начинается со своего состояния проекта и кластера. Проверяется то, что получилось: какой образ работает в каком namespace, какие джобы прошли и чем кончились, где лежит ключ. Открыты `--help`, справочник GitLab и страницы kubernetes.io; наставник выключен.',
    'Five cards from the tracker on one project, `~/site`: the pipeline builds an image and deploys it to the cluster. Each card starts from its own state of the project and the cluster. What is checked is the outcome: which image runs in which namespace, which jobs ran and how they ended, where the key lives. The `--help` output, the GitLab reference and the kubernetes.io pages are open; the mentor is off.',
  ),
  story: bi(
    'Команда сайта сегодня впервые выпускает версию в production из пайплайна, а не с ноутбука администратора. До вечера нужно, чтобы выкладка на staging шла сама и честно сообщала о провале, а production обновлялся только по кнопке и тем же образом, что прошёл staging.',
    'Today the site team releases a version to production from the pipeline for the first time instead of from the administrator’s laptop. By the evening, the staging deployment must run by itself and report a failure honestly, and production must be updated only by a button and with the same image that passed staging.',
  ),
  minutes: 60,
  pass: 0.7,
  allowedDocs: ['help', 'docs.gitlab.com', 'kubernetes.io'],
  tasks: [
    {
      id: 'key-missing',
      pool: 'key',
      weight: 2,
      critical: true,
      kind: 'task',
      setup: CICD_EXAM_SETUPS.noKey,
      task: {
        id: 'x-key-missing',
        prompt: bi(
          '«Выкладка на staging красная с первого дня»: отправьте пустой коммит в main и прочитайте лог `deploy_staging`. Администратор оставил ключ сервисного аккаунта в `~/deployer.kubeconfig`. Дайте его джобе так, как положено ключу кластера, и добейтесь зелёной выкладки; в репозиторий ключ попасть не должен.',
          '“The staging deployment has been red since day one”: push an empty commit to main and read the `deploy_staging` log. The administrator left the service account’s key in `~/deployer.kubeconfig`. Give it to the job the way a cluster key should be given and get a green deployment; the key must not get into the repository.',
        ),
        check: keyCheck,
        concepts: ['cicd.deploy-account'],
      },
    },
    {
      id: 'key-plain',
      pool: 'key',
      weight: 2,
      critical: true,
      kind: 'task',
      setup: CICD_EXAM_SETUPS.plainKey,
      task: {
        id: 'x-key-plain',
        prompt: bi(
          '«Выкладка на staging красная с первого дня»: ключ сервисного аккаунта уже лежит в настройках проекта, а `deploy_staging` всё равно падает. Отправьте пустой коммит в main, прочитайте лог джобы и почините настройку так, чтобы выкладка стала зелёной. Исходный ключ — в `~/deployer.kubeconfig`.',
          '“The staging deployment has been red since day one”: the service account’s key is already in the project settings, and `deploy_staging` still fails. Push an empty commit to main, read the job’s log and fix the setting so the deployment turns green. The original key is in `~/deployer.kubeconfig`.',
        ),
        check: keyCheck,
        concepts: ['cicd.deploy-account', 'cicd.variable'],
      },
    },
    {
      id: 'tag',
      weight: 2,
      critical: true,
      kind: 'task',
      setup: CICD_EXAM_SETUPS.latest,
      task: {
        id: 'x-tag',
        prompt: bi(
          '«На staging неделю одна и та же версия»: пайплайн main каждый раз зелёный, а `kubectl get deploy,rs -o wide` показывает старый образ. Сделайте так, чтобы каждый пайплайн main выкладывал образ именно своего коммита, и отправьте изменение.',
          '“Staging has run the same version for a week”: the main pipeline is green every time, while `kubectl get deploy,rs -o wide` shows the old image. Make every main pipeline deploy the image of exactly its own commit, and push the change.',
        ),
        check: {
          when: (f) => deployOk(f) && !!tipImage(f) && webIn(f, 'staging')?.image === tipImage(f) && (ci(f)?.registry ?? []).some((r) => `${r.image}:${r.tag}` === tipImage(f)),
          fail: [{ if: (f) => deployOk(f) && (webIn(f, 'staging')?.image ?? '').endsWith(':latest'), say: bi('В Deployment по-прежнему :latest: повторный apply того же текста ничего не меняет. Тег коммита нужен и в сборке, и в выкладке.', 'The Deployment still says :latest: applying the same text again changes nothing. The commit tag is needed both in the build and in the deploy.') }],
        },
        concepts: ['cicd.immutable-tag'],
      },
    },
    {
      id: 'gate',
      weight: 2,
      critical: true,
      kind: 'task',
      setup: CICD_EXAM_SETUPS.noWait,
      task: {
        id: 'x-gate',
        prompt: bi(
          '«Зелёный пайплайн выложил сломанную версию»: разработчики переводят сайт на базу `FROM trainer/web:2.0`, а она падает при старте. Сначала сделайте пайплайн честным: выкладка ждёт результата не дольше двух минут, при неудаче пайплайн красный и сам возвращает staging к прежней версии. Потом отправьте смену базы в `Dockerfile`.',
          '“A green pipeline deployed a broken version”: the developers move the site to the base `FROM trainer/web:2.0`, and it crashes on start. First make the pipeline honest: the deployment waits for the result for no more than two minutes, on failure the pipeline is red and returns staging to the previous version by itself. Then push the base change in the `Dockerfile`.',
        ),
        check: {
          when: (f) => {
            const broken = (mainTip(f)?.files.Dockerfile ?? '').includes('trainer/web:2.0');
            const img = webIn(f, 'staging')?.image ?? '';
            return broken && jobOf(f, 'deploy_staging', { ref: 'main' })?.status === 'failed' && /:[0-9a-f]{8}$/.test(img) && img !== tipImage(f);
          },
          fail: [
            { if: (f) => (mainTip(f)?.files.Dockerfile ?? '').includes('trainer/web:2.0') && deployOk(f), say: bi('Джоба зелёная, а поды падают: она закончилась сразу после set image и ничего не дождалась.', 'The job is green and the pods crash: it ended right after set image and waited for nothing.') },
            { if: (f) => jobOf(f, 'deploy_staging', { ref: 'main' })?.status === 'failed' && webIn(f, 'staging')?.image === tipImage(f), say: bi('Пайплайн красный — это правильно, но на staging осталась сломанная версия. Откат должен запускаться сам, только при неудаче.', 'The pipeline is red, which is right, but the broken version stayed on staging. The rollback must start by itself, only on failure.') },
          ],
        },
        concepts: ['cicd.rollout-wait'],
      },
    },
    {
      id: 'production',
      weight: 2,
      kind: 'task',
      setup: CICD_EXAM_SETUPS.production,
      task: {
        id: 'x-production',
        prompt: bi(
          '«Production — только по кнопке»: в namespace `production` стоит свой Deployment `web`. Добавьте в пайплайн джобу `deploy_production` с окружением `production`, которая после staging выкладывает туда тот же образ коммита и ждёт результата, но запускается только вручную. Отправьте изменение, убедитесь, что production сам не обновился, и запустите выкладку.',
          '“Production only by a button”: namespace `production` has its own Deployment `web`. Add a job `deploy_production` with the environment `production` to the pipeline that, after staging, deploys the same commit image there and waits for the result, but starts only by hand. Push the change, make sure production did not update by itself, and start the deployment.',
        ),
        check: {
          when: (f) => {
            const job = pipelineJob(f, 'deploy_production');
            const conf = pushedJob(f, 'deploy_production');
            return !!job && job.when === 'manual' && job.status === 'success' && conf?.environment?.name === 'production' && !!tipImage(f) && webIn(f, 'production')?.image === tipImage(f) && webIn(f, 'staging')?.image === tipImage(f) && (webIn(f, 'production')?.ready ?? 0) >= 3;
          },
          fail: [
            { if: (f) => !!pipelineJob(f, 'deploy_production') && pipelineJob(f, 'deploy_production')?.when !== 'manual', say: bi('deploy_production запускается сам: production обновится от любого коммита в main. Нужен ручной запуск.', 'deploy_production starts by itself: production would update on any commit to main. It must start by hand.') },
            { if: (f) => pipelineJob(f, 'deploy_production')?.status === 'manual', say: bi('Джоба ждёт кнопки — так и задумано. Теперь запустите её.', 'The job waits for the button, as intended. Now start it.') },
            { if: (f) => pipelineJob(f, 'deploy_production')?.status === 'success' && webIn(f, 'production')?.image !== tipImage(f), say: bi('Джоба прошла, но production на прежнем образе: kubectl в джобе смотрит в namespace staging из kubeconfig. Укажите namespace явно.', 'The job passed, but production still runs the old image: kubectl in the job looks at the staging namespace from the kubeconfig. Name the namespace explicitly.') },
          ],
        },
        concepts: ['cicd.environment', 'cicd.manual', 'cicd.k8s-push'],
      },
    },
    {
      id: 'cause',
      weight: 2,
      beyond: true,
      kind: 'task',
      setup: CICD_EXAM_SETUPS.cause,
      task: {
        id: 'x-cause',
        prompt: bi(
          '«Какой коммит в какой ревизии?»: дежурный хочет видеть в `kubectl rollout history deployment/web` против каждой ревизии короткий хеш коммита, который её выложил, а не `<none>`. Сделайте так, чтобы пайплайн сам записывал эту причину при каждой выкладке, и отправьте изменение. В уроке этого не было — найдите стандартную аннотацию Kubernetes для причины изменения.',
          '“Which commit is in which revision?”: the on-call engineer wants `kubectl rollout history deployment/web` to show, against every revision, the short hash of the commit that deployed it instead of `<none>`. Make the pipeline record this cause by itself on every deployment, and push the change. The lesson did not show this: find the standard Kubernetes annotation for the cause of a change.',
        ),
        check: {
          when: (f) => {
            const sha = shortSha(f);
            const d = webObj(f, 'staging');
            const rs = (k8s(f)?.objects ?? []).find((o) => o.kind === 'ReplicaSet' && o.metadata?.namespace === 'staging' && (o.spec?.template?.spec?.containers ?? []).some((c: Obj) => c.image === tipImage(f)));
            return deployOk(f) && !!sha && webIn(f, 'staging')?.image === tipImage(f) && String(d?.metadata?.annotations?.['kubernetes.io/change-cause'] ?? '').includes(sha) && String(rs?.metadata?.annotations?.['kubernetes.io/change-cause'] ?? '').includes(sha);
          },
          fail: [{ if: (f) => String(webObj(f, 'staging')?.metadata?.annotations?.['kubernetes.io/change-cause'] ?? '').includes(shortSha(f)) && !!shortSha(f), say: bi('Причина записана в Deployment, но текущая ревизия появилась раньше неё. Записывайте причину до того, как меняете образ.', 'The cause is written on the Deployment, but the current revision appeared before it. Record the cause before you change the image.') }],
        },
        docStep: 5,
        beyond: true,
        solutionTokens: ['kubernetes.io/change-cause', 'change-cause'],
        concepts: ['k8s.revision'],
      },
    },
  ],
  explain: [
    {
      id: 'push-pull',
      prompt: bi('Чем push-выкладка из CI отличается от pull-выкладки через GitOps-агента? Что вы выиграете и что потеряете, если перейдёте на pull?', 'How does a push deployment from CI differ from a pull deployment through a GitOps agent? What do you gain and what do you lose by moving to pull?'),
      keyPoints: [
        bi('в push джоба сама ходит в API кластера с ключом, который хранится в CI', 'in push the job itself calls the cluster API with a key stored in CI'),
        bi('в pull CI только коммитит новый тег в репозиторий конфигурации, а агент в кластере приводит кластер к записанному', 'in pull CI only commits the new tag to a configuration repository, and an agent in the cluster brings the cluster to what is written'),
        bi('pull: ключ не покидает кластер, история выкладок — это история Git, дрейф исправляется сам; но провал выкладки не красит пайплайн без отдельной обратной связи', 'pull: the key never leaves the cluster, the deployment history is the Git history, drift is corrected by itself; but a failed rollout does not turn the pipeline red without separate feedback'),
      ],
    },
    {
      id: 'green',
      prompt: bi('Почему зелёная джоба с одной командой `kubectl set image` ничего не говорит о версии в кластере и что нужно, чтобы цвет пайплайна стал правдой?', 'Why does a green job with a single `kubectl set image` say nothing about the version in the cluster, and what is needed for the pipeline’s colour to tell the truth?'),
      keyPoints: [
        bi('set image только меняет объект в API и сразу возвращает 0; выкладку ведут контроллеры потом', 'set image only changes the object in the API and returns 0 at once; the controllers carry out the rollout later'),
        bi('нужно ждать: kubectl rollout status с таймаутом (или helm upgrade --wait) делает джобу красной, если поды не стали готовы', 'you have to wait: kubectl rollout status with a timeout (or helm upgrade --wait) turns the job red if the pods never become ready'),
        bi('после провала — откат отдельной джобой при неудаче или rollout undo, иначе сломанная версия остаётся', 'after a failure, a rollback in a separate on-failure job or rollout undo, or the broken version stays'),
      ],
    },
  ],
};
