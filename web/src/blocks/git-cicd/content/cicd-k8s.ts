// Block "Deploying to Kubernetes from CI" (route id cicd-k8s, 06 §3.7 A7).
// It stands after the first Kubernetes stage because it needs Deployment,
// rolling update, revisions, kubeconfig and namespaces. The deploy job runs
// on the CI simulator, and `kubectl` in its script changes the kube-lite
// cluster of the learner's machine (ci/kube.ts), so every check reads the
// state of the cluster and of the forge, not a log that merely looks right.

import YAML from 'yaml';
import { bi } from '../../../core/i18n';
import type { Block, Concept, Facts, Lesson, PlacementTask, QuizItem, Sources, TerminalSetup } from '../../../core/types';
import type { K8sFacts } from '../../../engine/kube-lite/facts';
import { parseCi } from '../ci/config';
import { registerBuiltImage } from '../ci/kube';
import { ci, forge, jobOf, projectSetup } from './common';

const S = {
  agent: { title: 'GitLab Docs — Using GitLab CI/CD with a Kubernetes cluster', url: 'https://docs.gitlab.com/user/clusters/agent/ci_cd_workflow/' },
  fileVars: { title: 'GitLab Docs — CI/CD variables: use file type variables', url: 'https://docs.gitlab.com/ci/variables/#use-file-type-cicd-variables' },
  deployment: { title: 'Kubernetes — Deployments', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/' },
  rbac: { title: 'Kubernetes — Using RBAC Authorization', url: 'https://kubernetes.io/docs/reference/access-authn-authz/rbac/' },
  rollout: { title: 'kubectl rollout status — Kubernetes reference', url: 'https://kubernetes.io/docs/reference/kubectl/generated/kubectl_rollout/kubectl_rollout_status/' },
  gitops: { title: 'OpenGitOps — GitOps principles', url: 'https://opengitops.dev/' },
  argo: { title: 'Argo CD — Declarative GitOps CD for Kubernetes', url: 'https://argo-cd.readthedocs.io/en/stable/' },
  ruDeployment: { title: 'Kubernetes на русском — Deployments', url: 'https://kubernetes.io/ru/docs/concepts/workloads/controllers/deployment/' },
  ruK8s: { title: 'Kubernetes — Википедия', url: 'https://ru.wikipedia.org/wiki/Kubernetes' },
  ruCd: { title: 'Непрерывная доставка — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%9D%D0%B5%D0%BF%D1%80%D0%B5%D1%80%D1%8B%D0%B2%D0%BD%D0%B0%D1%8F_%D0%B4%D0%BE%D1%81%D1%82%D0%B0%D0%B2%D0%BA%D0%B0' },
};
const src = (en: { title: string; url: string }[], ru: { title: string; url: string }[]): Sources => ({ en, ru });

const L = 'cicd-k8s.deploy';

export const concepts: Concept[] = [
  { id: 'cicd.k8s-push', term: bi('push-выкладка', 'push deployment'), forms: { ru: ['push-выкладки', 'push-выкладку', 'push-выкладкой', 'push-модель', 'push-модели'], en: ['push deployments', 'push model'] }, short: bi('Выкладка, при которой джоба CI сама обращается к API-серверу кластера со своим ключом и меняет объекты командами вроде kubectl set image или helm upgrade.', 'A deployment where the CI job itself calls the cluster’s API server with its own key and changes objects (kubectl set image, helm upgrade).'), introducedIn: L, docRef: { url: 'https://docs.gitlab.com/user/clusters/agent/ci_cd_workflow/', label: 'docs.gitlab.com › Using GitLab CI/CD with a Kubernetes cluster' } },
  { id: 'cicd.deploy-account', term: bi('аккаунт выкладки', 'deploy account'), forms: { ru: ['аккаунта выкладки', 'аккаунтом выкладки', 'аккаунту выкладки'], en: ['deploy accounts'] }, short: bi('Сервисный аккаунт в одном пространстве имён с ролью, в которой перечислены только те действия, которые нужны выкладке. Его ключ хранится в защищённой переменной типа File, и прав cluster-admin у него нет.', 'A service account in one namespace with a role for exactly the verbs a deployment needs; its key lives in a protected File variable, not cluster-admin.'), introducedIn: L, docRef: { url: 'https://kubernetes.io/docs/reference/access-authn-authz/rbac/', label: 'kubernetes.io › Using RBAC Authorization' } },
  { id: 'cicd.immutable-tag', term: bi('неизменяемый тег', 'immutable tag'), forms: { ru: ['неизменяемого тега', 'неизменяемым тегом', 'неизменяемые теги', 'неизменяемых тегов', 'неизменяемому тегу'], en: ['immutable tags'] }, short: bi('Тег образа, который никогда не переходит на другой образ, обычно хэш коммита. Новый тег меняет шаблон пода, и Deployment начинает выкладку, а тег latest этого не делает.', 'An image tag that never moves to another image, usually the commit hash. A new tag changes the pod template and the Deployment starts a rollout; latest does not.'), introducedIn: L, docRef: { page: 'web/kubernetes.io/docs/concepts/workloads/controllers/deployment', anchor: 'updating-a-deployment' } },
  { id: 'cicd.rollout-wait', term: bi('ожидание выкладки', 'rollout wait'), forms: { ru: ['ожидания выкладки', 'ожиданием выкладки'] }, scan: false, short: bi('Шаг джобы, который ждёт конца выкладки и завершается с ошибкой, если время ожидания истекло, например kubectl rollout status --timeout или helm upgrade --wait. Без него зелёная джоба ничего не говорит о версии в кластере.', 'A job step that waits for the rollout to end and fails on a timeout: kubectl rollout status --timeout, helm upgrade --wait. Without it a green job says nothing about the version in the cluster.'), introducedIn: L, docRef: { page: 'help/kubectl-rollout-status', anchor: 'OPTIONS', line: '--timeout' } },
  { id: 'cicd.gitops-pull', term: bi('pull-выкладка', 'pull deployment'), forms: { ru: ['pull-выкладки', 'pull-выкладку', 'pull-модель', 'pull-модели', 'GitOps'], en: ['pull model', 'GitOps'] }, short: bi('Выкладка, при которой CI только коммитит новый тег в репозиторий конфигурации, а агент внутри кластера, например Argo CD или Flux, сам приводит кластер к записанному состоянию. Ключ от кластера при этом не покидает кластер.', 'A deployment where CI only commits the new tag to a configuration repository, and an agent inside the cluster (Argo CD, Flux) brings the cluster to what is written. The cluster key never leaves the cluster.'), introducedIn: L, docRef: { url: 'https://opengitops.dev/', label: 'opengitops.dev › Principles' } },
];

// ── the training project of the lesson ──

const IMAGE = 'registry.forge.edu/team/site';
// The version that runs on staging before the lesson: deployed by hand, tagged latest.
registerBuiltImage(IMAGE, 'latest', 'trainer/web:1.0');

const TOKEN = 'edu-sa-deployer-Q7m2xV9c';
export const DEPLOYER_KUBECONFIG = YAML.stringify({
  apiVersion: 'v1',
  kind: 'Config',
  clusters: [{ name: 'edu-staging', cluster: { server: 'https://k8s.edu:6443', 'certificate-authority-data': 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUJkekNDQVIyZ0F3SUJBZ0lCQURBS0JnZ3Foa2pPUFFRREFqQWpNU0V3SHdZRFZRUUREQmhyTTNNdGMyVnkKLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo=' } }],
  users: [{ name: 'deployer', user: { token: TOKEN } }],
  contexts: [{ name: 'deployer@staging', context: { cluster: 'edu-staging', user: 'deployer', namespace: 'staging' } }],
  'current-context': 'deployer@staging',
});

const MANIFEST = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: staging
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
const CLUSTER = `apiVersion: v1
kind: Namespace
metadata:
  name: staging
---
${MANIFEST}`;

const DOCKERFILE = 'FROM trainer/web:1.1\nCOPY src/ /usr/share/web/\n';

export const A7_CI = `stages: [build, deploy]

build-image:
  stage: build
  image: docker:28
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $CI_REGISTRY_IMAGE:latest .
    - docker push $CI_REGISTRY_IMAGE:latest
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

deploy_staging:
  stage: deploy
  image: alpine/k8s:1.37.1
  environment: staging
  script:
    - kubectl apply -f k8s/
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
`;

/** The pipeline the lab ends with: commit tag, set image, wait, roll back on failure. */
export const A7_GOOD_CI = `stages: [build, deploy, rollback]

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
  image: alpine/k8s:1.37.1
  environment: staging
  script:
    - kubectl set image deployment/web web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
    - kubectl rollout status deployment/web --timeout=120s
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

rollback_staging:
  stage: rollback
  image: alpine/k8s:1.37.1
  script:
    - kubectl rollout undo deployment/web
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: on_failure
`;

export function a7Setup(o: { ci?: string; kubeconfigVar?: boolean } = {}): TerminalSetup {
  const s = projectSetup(
    { Dockerfile: DOCKERFILE, 'k8s/deployment.yaml': MANIFEST, '.gitlab-ci.yml': o.ci ?? A7_CI },
    o.kubeconfigVar ? { forge: [{ project: 'team/site', variables: [{ key: 'KUBECONFIG', value: DEPLOYER_KUBECONFIG, masked: false, protected: true, file: true }] }] } : {},
  );
  return {
    ...s,
    files: [{ path: '/home/learner/deployer.kubeconfig', content: DEPLOYER_KUBECONFIG, mode: '0600', owner: 'learner', group: 'learner' }],
    ext: { ...s.ext, k8s: { manifests: [CLUSTER], namespace: 'staging' } },
  };
}

// ── fact helpers ──

const k8s = (f: Facts) => f.k8s as K8sFacts | undefined;
const web = (f: Facts) => k8s(f)?.deployments.find((d) => d.ns === 'staging' && d.name === 'web');
const mainTip = (f: Facts) => {
  const fg = forge(f);
  return fg?.commits.find((c) => c.oid === fg.branches.main);
};
const tipImage = (f: Facts) => {
  const t = mainTip(f);
  return t ? `${IMAGE}:${t.oid.slice(0, 8)}` : '';
};
const pushedJob = (f: Facts, name: string) => {
  const text = mainTip(f)?.files['.gitlab-ci.yml'];
  return text ? parseCi(text).config?.jobs.find((j) => j.name === name) : undefined;
};
const leaked = (f: Facts) => forge(f)?.commits.some((c) => Object.values(c.files).some((t) => t.includes(TOKEN))) ?? false;
const kcVar = (f: Facts) => ci(f)?.variables.find((v) => v.key === 'KUBECONFIG');
/** deploy_staging applies the manifest that still says :latest: every run adds a revision with :latest. */
const appliesLatest = (f: Facts) => (pushedJob(f, 'deploy_staging')?.script ?? []).some((l) => /kubectl\s+apply\b/.test(l)) && Object.entries(mainTip(f)?.files ?? {}).some(([p, t]) => p.startsWith('k8s/') && t.includes(':latest'));
const deployOk = (f: Facts) => jobOf(f, 'deploy_staging', { ref: 'main' })?.status === 'success';

// ── quiz bank ──

export const quiz: QuizItem[] = [
  {
    id: 'cicd-k8s.q.latest',
    kind: 'mcq',
    concepts: ['cicd.immutable-tag'],
    key: true,
    prompt: bi('Джоба собирает образ `site:latest` и выполняет `kubectl apply -f k8s/`. Пайплайн зелёный, в журнале написано `deployment.apps/web unchanged`, а на тестовом стенде старая версия. Почему?', 'The job builds `site:latest` and runs `kubectl apply -f k8s/`. The pipeline is green, the log says `deployment.apps/web unchanged`, and staging runs the old version. Why?'),
    options: [
      { id: 'template', text: bi('Текст Deployment не изменился, потому что в нём записан тот же тег latest, а выкладку запускает только новый шаблон пода', 'The Deployment text did not change because it holds the same latest tag, and only a new pod template starts a rollout'), correct: true },
      { id: 'pull', text: bi('Узлы не успели скачать новый образ', 'The nodes did not manage to download the new image'), why: bi('Новые поды даже не создавались, потому что «unchanged» означает, что API-сервер не увидел в объекте никакой разницы.', 'No new pods were even created: "unchanged" means the API server saw no difference in the object.') },
      { id: 'rbac', text: bi('У джобы нет прав на изменение Deployment', 'The job has no right to change the Deployment'), why: bi('При отказе в правах сервер ответил бы Forbidden, и джоба была бы красной.', 'A refusal of rights would look like Forbidden, and the job would be red.') },
    ],
  },
  {
    id: 'cicd-k8s.q.account',
    kind: 'mcq',
    concepts: ['cicd.deploy-account'],
    key: true,
    prompt: bi('С каким ключом джоба выкладки должна входить в кластер тестового стенда?', 'With what key should the deploy job enter the staging cluster?'),
    options: [
      { id: 'sa', text: bi('С токеном сервисного аккаунта deployer, у которого есть роль на Deployment и Service в пространстве имён staging, в защищённой переменной типа File', 'A token of the deployer service account with a role on Deployments and Services in the staging namespace, in a protected File variable'), correct: true },
      { id: 'admin', text: bi('С kubeconfig администратора с правами cluster-admin, чтобы ни одна команда не завершилась с ошибкой Forbidden', 'The administrator’s cluster-admin kubeconfig: then nothing fails with Forbidden'), why: bi('Тогда каждый, кто может отправлять коммиты в main, получит весь кластер и сможет удалить узлы или прочитать чужие секреты. Ключ CI должен разрешать только то, что нужно выкладке.', 'Everyone who can push to main would get the whole cluster: delete nodes, read other teams’ Secrets. The CI key must be able to do exactly what the deployment needs.') },
      { id: 'repo', text: bi('С kubeconfig, закоммиченным в репозиторий рядом с манифестами', 'A kubeconfig committed to the repository next to the manifests'), why: bi('Всё, что попало в историю, видно каждому, у кого есть копия, и остаётся там навсегда.', 'Whatever gets into the history is visible to everyone with a copy and stays there forever.') },
    ],
  },
  {
    id: 'cicd-k8s.q.wait',
    kind: 'mcq',
    concepts: ['cicd.rollout-wait'],
    prompt: bi('В скрипте джобы записана только команда `kubectl set image deployment/web web=site:$CI_COMMIT_SHORT_SHA`, а новая версия аварийно завершается при старте. Какого цвета будет пайплайн?', 'The job script has only `kubectl set image deployment/web web=site:$CI_COMMIT_SHORT_SHA`. The new version crashes on start. What colour will the pipeline be?'),
    options: [
      { id: 'green', text: bi('Пайплайн будет зелёным, потому что set image вернула 0, а о подах джоба ничего не знает', 'Green: set image returned 0, and the job knows nothing about the pods'), correct: true },
      { id: 'red', text: bi('Пайплайн будет красным, потому что Kubernetes сообщит раннеру о падении', 'Red: Kubernetes tells the runner about the crash'), why: bi('Кластер сам никому ничего не сообщает, поэтому джоба должна сама спросить о результате и дождаться его командой kubectl rollout status --timeout.', 'The cluster tells nobody anything: the job has to ask and wait itself, with kubectl rollout status --timeout.') },
    ],
  },
  {
    id: 'cicd-k8s.q.models',
    kind: 'multi',
    concepts: ['cicd.k8s-push', 'cicd.gitops-pull'],
    prompt: bi('Какие утверждения верны для pull-модели выкладки, то есть для GitOps? Отметьте все такие утверждения.', 'Which statements are true of the pull deployment model, that is, GitOps? Mark them all.'),
    options: [
      { id: 'agent', text: bi('Агент внутри кластера сам читает репозиторий конфигурации и применяет разницу', 'An agent inside the cluster reads the configuration repository by itself and applies the difference'), correct: true },
      { id: 'history', text: bi('История выкладок совпадает с историей коммитов, а откат выполняют коммитом revert', 'The history of deployments is the history of commits, and a rollback is a revert commit'), correct: true },
      { id: 'drift', text: bi('Если агент исправляет расхождения, как Flux по умолчанию, ручная правка кластера командой kubectl продержится только до следующей сверки', 'If the agent undoes differences from Git, as Flux does by default, a manual change of the cluster with kubectl lasts only until the next reconciliation'), correct: true },
      { id: 'key', text: bi('Ключ от кластера хранится в настройках CI', 'The cluster key is stored in the CI settings'), why: bi('Так устроена push-модель. В pull-модели у CI ключа от кластера нет, а в кластер обращается агент изнутри под своим сервисным аккаунтом.', 'That is the push model. In the pull model CI has no cluster key; the agent goes to the cluster from inside with its own service account.') },
      { id: 'red', text: bi('Неудачная выкладка делает пайплайн красным, если джоба ждёт rollout status', 'A failed rollout turns the pipeline red if the job waits on rollout status'), why: bi('Это свойство push-модели. В pull-модели джоба только записывает тег коммитом и сразу завершается успешно, а о неудачной выкладке сообщает агент.', 'That is a property of the push model. In the pull model the job only commits the tag and turns green at once; the agent reports a failed rollout.') },
    ],
    explain: bi('В push-модели джоба сама обращается к кластеру со своим ключом и может дождаться результата. В pull-модели CI только записывает желаемое состояние в Git, а кластер подтягивает его сам.', 'In the push model the job goes to the cluster with its own key and can wait for the result. In the pull model CI only writes the desired state into Git, and the cluster pulls it in by itself.'),
  },
  {
    id: 'cicd-k8s.q.models-push',
    kind: 'mcq',
    concepts: ['cicd.k8s-push', 'cicd.gitops-pull'],
    prompt: bi('Команда переходит с push-выкладки на Flux. Что из настроек CI больше не нужно?', 'The team moves from push deployment to Flux. Which part of the CI setup is no longer needed?'),
    options: [
      { id: 'kcfg', text: bi('Переменная KUBECONFIG с ключом аккаунта deployer', 'The KUBECONFIG variable with the deployer key'), correct: true },
      { id: 'build', text: bi('Сборка образа с тегом $CI_COMMIT_SHORT_SHA', 'Building the image with the $CI_COMMIT_SHORT_SHA tag'), why: bi('Образ по-прежнему собирает CI, и неизменяемый тег нужен и Flux: агент выкладывает тот тег, который записан в репозитории конфигурации.', 'CI still builds the image, and Flux needs the immutable tag too: the agent deploys the tag written in the configuration repository.') },
      { id: 'test', text: bi('Джоба с тестами', 'The test job'), why: bi('Проверки до выкладки нужны при любой модели, потому что агент применит всё, что попало в Git.', 'Checks before a deployment are needed in either model, because the agent applies whatever gets into Git.') },
    ],
  },
  {
    id: 'cicd-k8s.q.file',
    kind: 'mcq',
    concepts: ['cicd.deploy-account'],
    prompt: bi('Ключ кластера положили в переменную KUBECONFIG обычного типа, и kubectl в джобе отвечает `The connection to the server localhost:8080 was refused`. Почему?', 'The cluster key was put into an ordinary KUBECONFIG variable, and kubectl in the job answers `The connection to the server localhost:8080 was refused`. Why?'),
    options: [
      { id: 'path', text: bi('kubectl ждёт в KUBECONFIG путь к файлу, а получил сам текст ключа, поэтому переменная должна быть типа File', 'kubectl expects a file path in KUBECONFIG and got the text itself; the variable must be of type File'), correct: true },
      { id: 'network', text: bi('У раннера нет сетевого доступа к кластеру', 'The runner has no network to the cluster'), why: bi('На адрес localhost:8080 kubectl обращается тогда, когда не нашёл никакого kubeconfig, так что до настоящего адреса кластера дело не дошло.', 'localhost:8080 is where kubectl goes when it found no kubeconfig at all. It never got to the real address.') },
      { id: 'masked', text: bi('Переменную нужно было пометить Masked', 'The variable should have been Masked'), why: bi('Флаг Masked только прячет значение в журнале, а многострочный kubeconfig к тому же замаскировать нельзя.', 'Masked only hides the value in the log; and a multi-line kubeconfig cannot be masked anyway.') },
    ],
  },
];

// ── the lesson ──

const lesson: Lesson = {
  id: L,
  block: 'cicd-k8s',
  title: bi('Выкладка в Kubernetes из CI', 'Deploying to Kubernetes from CI'),
  summary: bi('Джоба выкладки входит в кластер с ключом аккаунта, у которого есть только нужные права, меняет образ на тег коммита и ждёт, чем закончится выкладка. Есть и другой способ, при котором CI только коммитит тег, а кластер забирает его сам.', 'The deploy job enters the cluster with a narrow account’s key, changes the image to the commit tag and waits to see how the rollout ends. Otherwise CI only commits the tag and the cluster pulls it in by itself.'),
  introduces: ['cicd.k8s-push', 'cicd.deploy-account', 'cicd.immutable-tag', 'cicd.rollout-wait', 'cicd.gitops-pull'],
  uses: ['cicd.environment', 'cicd.variable', 'cicd.job', 'cicd.rules', 'cicd.manual', 'k8s.deployment', 'k8s.rolling-update', 'k8s.revision', 'k8s.replicaset', 'k8s.kubeconfig', 'k8s.namespace', 'k8s.apiserver', 'k8s.crashloop', 'k8s.helm', 'docker.registry'],
  tier: 'core',
  minutes: 50,
  sources: src([S.agent, S.fileVars, S.deployment, S.rbac, S.rollout, S.gitops, S.argo], [S.ruDeployment, S.ruK8s, S.ruCd]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В блоке CI/CD пайплайн выкладывал сайт скриптом `deploy.sh`. Теперь сайт работает в кластере: в пространстве имён `staging` стоит Deployment `web` на три реплики, и до сих пор его обновляли вручную с ноутбука администратора. Команда просит, чтобы каждый коммит в main сам попадал на тестовый стенд и чтобы зелёный пайплайн означал, что новая версия на самом деле работает. В этом уроке вы дадите джобе выкладки ключ от кластера, научите её выкладывать образ своего коммита и дожидаться результата, а потом сравните такую выкладку с моделью, в которой CI в кластер не обращается вовсе.',
        'In the CI/CD block the pipeline deployed the site with the `deploy.sh` script. Now the site runs in a cluster: the `staging` namespace has a Deployment `web` with three replicas, and so far it was updated by hand from the administrator’s laptop. The team asks that every commit to main reach staging by itself, and that a green pipeline mean the new version really works. In this lesson you give the deploy job a cluster key, teach it to deploy its own commit’s image and wait for the result, and then compare this with the model in which CI does not touch the cluster at all.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      title: bi('Четыре решения, от которых зависит выкладка', 'Four decisions of a deployment'),
      body: bi(
        'Выкладка из CI в Kubernetes устроена проще, чем кажется. [[k8s.deployment|Deployment]] уже умеет менять версию сам, и пайплайну остаётся только сообщить ему, какой образ теперь нужен. Всё остальное сводится к четырём решениям, и от каждого из них зависит, можно ли доверять зелёной отметке пайплайна.\n\n### Как джоба входит в кластер\n\nКоманды `kubectl` в скрипте джобы обращаются к [[k8s.apiserver|API-серверу]] так же, как ваш терминал, и им тоже нужен [[k8s.kubeconfig|kubeconfig]]. Схему, при которой джоба сама обращается к кластеру со своим ключом и меняет объекты, называют [[cicd.k8s-push|push-выкладкой]]. Ваш личный ключ для неё не годится, а ключ администратора тем более. Для CI заводят отдельный [[cicd.deploy-account|аккаунт выкладки]], то есть ServiceAccount `deployer` в пространстве имён `staging` с ролью, в которой перечислены только нужные действия: `get`, `list`, `watch` и `patch` для Deployment и Service, а также `get` и `list` для ReplicaSet, без которых не работают `kubectl rollout history` и `kubectl rollout undo`. Как такая роль записывается, показано в следующем разделе. Если кто-нибудь допишет в скрипт `kubectl delete nodes --all`, API-сервер ответит `Forbidden`. С kubeconfig администратора тот же скрипт удалил бы узлы, а дописать скрипт может любой, у кого есть право отправлять коммиты в main.\n\nКлюч кладут в [[cicd.variable|переменную CI/CD]] типа **File** с флагом Protected. Тип File важен потому, что раннер записывает значение во временный файл, а в переменную кладёт путь к этому файлу, и `kubectl` ищет в `$KUBECONFIG` как раз путь. Обычная переменная передала бы вместо пути сам текст ключа, и `kubectl`, не найдя файла, обратился бы на адрес `localhost:8080`. В настоящем GitLab вместо ключа в переменной часто ставят агент GitLab для Kubernetes. Он держит связь с кластером изнутри, а джоба получает готовый контекст.\n\n### Тег, который не переходит на другой образ\n\n[[k8s.rolling-update|Выкладка]] начинается тогда и только тогда, когда меняется шаблон пода. Если образ всегда собирается как `site:latest`, текст Deployment от сборки к сборке остаётся одним и тем же. Тогда `kubectl apply` отвечает `unchanged`, новых подов нет, на тестовом стенде остаётся старая версия, а джоба при этом зелёная. Поэтому образ помечают [[cicd.immutable-tag|неизменяемым тегом]], обычно `$CI_COMMIT_SHORT_SHA`, и выкладывают его командой `kubectl set image deployment/web web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA` или `helm upgrade --install web ./chart --set image.tag=$CI_COMMIT_SHORT_SHA`. Новый тег даёт новый шаблон, новый [[k8s.replicaset|ReplicaSet]] и новую [[k8s.revision|ревизию]], а по тегу на любом поде видно, из какого коммита он собран.\n\n### Как дождаться результата и откатить выкладку\n\nКоманда `kubectl set image` возвращает 0, как только API-сервер принял изменение, то есть задолго до того, как запустится хотя бы один новый под. Если новая версия аварийно завершается при старте, поды переходят в состояние [[k8s.crashloop|CrashLoopBackOff]], а пайплайн уже зелёный. Чтобы цвет джобы говорил правду, после изменения ставят [[cicd.rollout-wait|ожидание выкладки]]. Команда `kubectl rollout status deployment/web --timeout=120s` ждёт конца выкладки и завершается с ошибкой, если за две минуты выкладка не закончилась. У Helm то же самое делает `helm upgrade --wait`, а в Helm 4 флаг `--rollback-on-failure` заодно откатывает релиз.\n\nОткат с помощью `kubectl` записывают отдельной джобой в следующей стадии. Строка `when: on_failure` в правиле этой джобы запускает её, только если раньше какая-то джоба завершилась с ошибкой, и джоба выполняет `kubectl rollout undo deployment/web`. Контроллер снова увеличивает прежний ReplicaSet, и тестовый стенд возвращается к последней рабочей версии, а пайплайн остаётся красным, потому что откат не отменяет того, что выкладка не удалась.\n\n### Push-модель и pull-модель\n\nУ push-модели есть цена: ключ от кластера хранится в CI, и защищать его приходится там же. Другой путь называется [[cicd.gitops-pull|pull-выкладкой]], или GitOps. В ней у CI нет ключа от кластера вовсе. Джоба собирает образ и коммитит новый тег в отдельный репозиторий конфигурации, например в строку `tag:` файла `deploy/values.yaml`. Агент внутри кластера, Argo CD или Flux, сам замечает коммит и приводит кластер к записанному состоянию, так же как контроллер Deployment приводит поды к спецификации. История выкладок становится историей коммитов, а откат выполняют коммитом `git revert`. Взамен пайплайн не знает, чем закончилась выкладка, и о состоянии приложения сообщает уже агент.',
        'Deploying from CI to Kubernetes is simpler than it looks: a [[k8s.deployment|Deployment]] already knows how to change versions by itself, and the pipeline only has to tell it which image is desired now. Everything else is four decisions, and each one decides whether a green tick can be trusted.\n\n### How the job enters the cluster\n\nThe `kubectl` commands in a job script are a client of the [[k8s.apiserver|API server]] just like your terminal, and they need a [[k8s.kubeconfig|kubeconfig]] too. This scheme, where the job itself goes to the cluster with its own key and changes objects, is called a [[cicd.k8s-push|push deployment]]. The key for it is neither yours nor, still less, the administrator’s: CI gets its own [[cicd.deploy-account|deploy account]], a ServiceAccount `deployer` in the `staging` namespace with a role that lists exactly the verbs needed: `get`, `list`, `watch`, `patch` on Deployments and Services, plus `get` and `list` on ReplicaSets, without which `kubectl rollout history` and `kubectl rollout undo` do not work. The next section shows how such a role is written. If someone adds `kubectl delete nodes --all` to the script, the API server answers `Forbidden`. With the administrator’s kubeconfig the same script would delete the nodes, and anyone who may push to main can write the script.\n\nThe key goes into a [[cicd.variable|CI/CD variable]] of type **File** with the Protected flag. The File type matters: the runner writes the value into a temporary file and puts the path to it into the variable, and a path is exactly what `kubectl` looks for in `$KUBECONFIG`. An ordinary variable would pass the text of the key instead of a path, and `kubectl`, finding no file, would go to `localhost:8080`. In real GitLab, instead of a key in a variable, people often install the GitLab agent for Kubernetes: it keeps the connection to the cluster from inside, and the job gets a ready context.\n\n### A tag that does not move\n\nA [[k8s.rolling-update|rollout]] starts if and only if the pod template changes. If the image is always built as `site:latest`, the Deployment text is the same from build to build: `kubectl apply` answers `unchanged`, there are no new pods, staging keeps the old version, and the job is green. So the image is marked with an [[cicd.immutable-tag|immutable tag]], usually `$CI_COMMIT_SHORT_SHA`, and exactly that tag is deployed: `kubectl set image deployment/web web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA` or `helm upgrade --install web ./chart --set image.tag=$CI_COMMIT_SHORT_SHA`. A new tag gives a new template, a new [[k8s.replicaset|ReplicaSet]] and a new [[k8s.revision|revision]], and the tag on any pod tells which commit it was built from.\n\n### Wait and roll back\n\n`kubectl set image` returns 0 as soon as the API server accepted the change, long before a single new pod is up. If the new version crashes on start, the pods go into [[k8s.crashloop|CrashLoopBackOff]] while the pipeline is already green. For the job’s colour to tell the truth, the change is followed by a [[cicd.rollout-wait|rollout wait]]: `kubectl rollout status deployment/web --timeout=120s` waits for the rollout to end and fails if it did not end within two minutes. With Helm `helm upgrade --wait` does the same, and in Helm 4 the `--rollback-on-failure` flag also rolls the release back.\n\nWith `kubectl` the rollback is a separate job in the next stage: `when: on_failure` starts it only if something earlier failed, and it runs `kubectl rollout undo deployment/web`. The controller scales the previous ReplicaSet back up and staging returns to the last working version, while the pipeline stays red: a rollback is no reason to hide that the deployment failed.\n\n### Push and pull\n\nThe push model has a price: the cluster key is kept in CI and has to be protected there. The other way is a [[cicd.gitops-pull|pull deployment]], also called GitOps. In it CI has no cluster key at all: the job builds the image and commits the new tag to a separate configuration repository, say the `tag:` line in `deploy/values.yaml`. An agent inside the cluster (Argo CD or Flux) notices the commit by itself and brings the cluster to what is written, just as the Deployment controller brings pods to the spec. The history of deployments becomes the history of commits, and a rollback is a `git revert`. In exchange the pipeline does not know how the rollout ended: it is the agent that reports the application’s health.',
      ),
    },
    {
      id: 'rbac',
      kind: 'text',
      step: 'explain',
      title: bi('Как записывают аккаунт выкладки и его роль', 'How the deploy account and its role are written'),
      body: bi(
        'Аккаунт выкладки складывается из трёх объектов Kubernetes, и их держат в репозитории рядом с манифестами приложения. **ServiceAccount** служит учётной записью не человека, а программы: от его имени к API-серверу обращается джоба. **Role** перечисляет, какие действия над какими видами объектов разрешены в одном пространстве имён. **RoleBinding** связывает роль с аккаунтом, и пока привязки нет, у аккаунта нет никаких прав. Механизм, по которому работают эти объекты, называется RBAC, то есть управление доступом на основе ролей.\n\n```yaml\napiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: deployer\n  namespace: staging\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: deployer\n  namespace: staging\nrules:\n  - apiGroups: ["apps"]\n    resources: ["deployments"]\n    verbs: ["get", "list", "watch", "patch"]\n  - apiGroups: ["apps"]\n    resources: ["replicasets"]   # нужны для rollout history и rollout undo\n    verbs: ["get", "list"]\n  - apiGroups: [""]\n    resources: ["services"]\n    verbs: ["get", "list", "watch", "patch"]\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: deployer\n  namespace: staging\nsubjects:\n  - kind: ServiceAccount\n    name: deployer\n    namespace: staging\nroleRef:\n  kind: Role\n  name: deployer\n  apiGroup: rbac.authorization.k8s.io\n```\n\nRole действует только в своём пространстве имён, поэтому даже глагол `delete` в этой роли не дал бы аккаунту удалить узлы: узлы не принадлежат ни одному пространству имён, и права на них выдаёт только ClusterRole. В настоящем кластере права аккаунта проверяют командой `kubectl auth can-i patch deployments -n staging --as=system:serviceaccount:staging:deployer`, которая отвечает yes или no. Ключ, который администратор кладёт в kubeconfig для CI, выпускают для этого аккаунта командой `kubectl create token deployer -n staging --duration=168h`. Такой ключ действует неделю, после чего администратор выпускает новый и заменяет им старый в переменной CI.',
        'A deploy account is three Kubernetes objects, kept in the repository next to the application manifests. A **ServiceAccount** is an account not of a person but of a program: the job talks to the API server in its name. A **Role** lists which actions on which kinds of objects are allowed in one namespace. A **RoleBinding** ties the role to the account, and until it exists the account has no rights at all. Together these objects are called RBAC, role-based access control.\n\n```yaml\napiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: deployer\n  namespace: staging\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: deployer\n  namespace: staging\nrules:\n  - apiGroups: ["apps"]\n    resources: ["deployments"]\n    verbs: ["get", "list", "watch", "patch"]\n  - apiGroups: ["apps"]\n    resources: ["replicasets"]   # needed by rollout history and rollout undo\n    verbs: ["get", "list"]\n  - apiGroups: [""]\n    resources: ["services"]\n    verbs: ["get", "list", "watch", "patch"]\n---\napiVersion: rbac.authorization.k8s.io/v1\nkind: RoleBinding\nmetadata:\n  name: deployer\n  namespace: staging\nsubjects:\n  - kind: ServiceAccount\n    name: deployer\n    namespace: staging\nroleRef:\n  kind: Role\n  name: deployer\n  apiGroup: rbac.authorization.k8s.io\n```\n\nA Role acts only in its own namespace, so even the `delete` verb in this role would not let the account delete nodes: nodes belong to no namespace, and only a ClusterRole grants rights on them. In a real cluster you check the account’s rights with `kubectl auth can-i patch deployments -n staging --as=system:serviceaccount:staging:deployer`, which answers yes or no. The key the administrator puts into the kubeconfig for CI is issued for this account with `kubectl create token deployer -n staging --duration=168h`. Such a key is valid for a week, after which the administrator issues a new one and replaces the old one in the CI variable.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как пайплайн выкладывает версию в кластер', 'How a pipeline rolls a version out to the cluster'),
      body: bi(
        'Схема ниже показывает выкладку нового образа на тестовый стенд в двух моделях, push и pull. Слева стоят реестр образов, джоба выкладки и ключ KUBECONFIG, в середине API-сервер кластера, а справа Deployment `web` и два его ReplicaSet: старый с подами прежней версии и новый, который появится при выкладке. Внизу лежат репозиторий конфигурации и агент GitOps, которые нужны только в pull-модели. Сначала на схеме только реестр, джоба и то, что сейчас работает на тестовом стенде, а остальные блоки появляются, когда до них доходит выкладка. Под схемой счётчики показывают, сколько подов новой и прежней версии работает и зелёная ли джоба выкладки.',
        'The diagram below shows a new image being deployed to staging in two models, push and pull. On the left are the image registry, the deploy job and the KUBECONFIG key, in the middle the cluster API server, and on the right the Deployment `web` with its two ReplicaSets: the old one with the pods of the previous version and the new one that appears during the rollout. At the bottom are the configuration repository and the GitOps agent, needed only in the pull model. At first the diagram shows only the registry, the job and what runs on staging now; the other blocks appear when the rollout reaches them. Under the diagram the counters show how many pods of the new and the previous version run and whether the deploy job is green.',
      ),
    },
    {
      id: 'look',
      kind: 'explainer',
      step: 'look',
      explainer: 'cicd.k8s-deploy',
      howto: bi(
        'А дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен один блок, тот, который работает сейчас, а облачко рядом с ним говорит, что он делает. По линиям проходит карточка с тем, что передаётся дальше: тег образа, файл ключа, изменение Deployment или коммит с новым тегом. Зелёная рамка означает, что шаг прошёл, жёлтая означает, что Deployment не изменился или что новые поды аварийно завершаются, пока старые ещё работают, а красная означает, что выкладка остановилась. Легенда со всеми знаками собрана рядом со схемой.\n\nПервый проход идёт по push-модели с тегом коммита. Потом выберите в «Параметрах» тег latest и посмотрите, появятся ли новые поды, а затем выключите ожидание окончания выкладки. После этого включите в блоке «Сломать» поломку «Новая версия аварийно завершается через три секунды после старта» и сравните цвет джобы с ожиданием и без него. Напоследок переключите модель выкладки на pull и пройдите ту же поломку ещё раз.',
        'Then go on with “Step forward” above the diagram. At every step one block is highlighted, the one working now, and the callout next to it says what it does. A card travels along the lines with what is handed on: the image tag, the key file, the Deployment change or a commit with the new tag. A green outline means the step passed, a yellow one that the Deployment did not change or that the new pods crash while the old ones still run, a red one that the rollout stopped. The legend with all the marks is next to the diagram.\n\nThe first run follows the push model with the commit tag. Then choose the latest tag in “Parameters” and see whether new pods appear, and then switch off the wait for the rollout. After that switch on “The new image crashes on start” in “Break it” and compare the job’s colour with and without the wait. Finally, switch the deployment model to pull and go through the same break again.',
      ),
      caption: bi('Всё, что вы видели на схеме, встретится вам в практике ниже, только в другом порядке. Сообщение `deployment.apps/web unchanged` означает, что тег образа не изменился. Зелёная джоба при аварийно завершающихся подах означает, что джоба не ждала окончания выкладки. А сообщение `Forbidden`, которое показывает вторая поломка в блоке «Сломать», означает, что у аккаунта deployer не хватает прав.', 'Everything you saw in the diagram meets you in the practice below, in another order. `deployment.apps/web unchanged` means the image tag did not change. A green job with crashing pods means the job did not wait for the rollout. And `Forbidden`, shown by the second break in “Break it”, means the deployer account lacks a right.'),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: a7Setup(),
      intro: bi('В каталоге `~/site` лежит проект сайта с `Dockerfile` и манифестом `k8s/deployment.yaml`. Пайплайн собирает образ и выкладывает его в пространство имён `staging`, а ключ аккаунта deployer администратор кластера оставил вам в файле `~/deployer.kubeconfig`. Ваш `kubectl` обращается к тому же кластеру, что и джобы.', '`~/site` is the site project with a `Dockerfile` and the manifest `k8s/deployment.yaml`. The pipeline builds the image and deploys it into the `staging` namespace; the cluster administrator left you the deployer account’s key in `~/deployer.kubeconfig`. Your `kubectl` looks at the same cluster as the jobs.'),
      tasks: [
        {
          id: 'key',
          prompt: bi('Отправьте пустой коммит в main и прочитайте, почему `deploy_staging` завершается с ошибкой. Передайте джобе ключ deployer так, как положено передавать ключ кластера, и добейтесь зелёной выкладки. В репозиторий ключ попасть не должен.', 'Push an empty commit to main and read why `deploy_staging` fails. Give the job the deployer key the way a cluster key should be given, and get a green deployment. The key must not get into the repository.'),
          check: {
            when: (f) => deployOk(f) && !!kcVar(f)?.file && !!kcVar(f)?.protected && !leaked(f),
            fail: [
              { if: (f) => leaked(f), say: bi('Ключ deployer попал в коммит на forge и останется в истории навсегда. Уберите файл, положите ключ в переменную и попросите администратора выпустить новый ключ.', 'The deployer key got into a commit on the forge: it is in the history forever. Remove the file, put the key into a variable and ask the administrator for a new one.') },
              { if: (f) => !!kcVar(f) && !kcVar(f)?.file, say: bi('Переменная есть, но обычного типа, а kubectl ищет в $KUBECONFIG путь к файлу, поэтому нужен тип File (--type file).', 'The variable exists but is of the ordinary type: kubectl looks for a file path in $KUBECONFIG. It must be of type File (--type file).') },
              { if: (f) => !!kcVar(f)?.file && !kcVar(f)?.protected, say: bi('Ключ кластера должна получать только ветка main, поэтому пометьте переменную как Protected.', 'Only main should get the cluster key: mark the variable Protected.') },
              { if: (f) => (jobOf(f, 'deploy_staging', { ref: 'main' })?.log ?? '').includes('localhost:8080'), say: bi('kubectl не нашёл kubeconfig и обратился на localhost:8080, поэтому джобе нужен ключ в переменной KUBECONFIG.', 'kubectl found no kubeconfig and went to localhost:8080. The job needs a key: the KUBECONFIG variable.') },
            ],
          },
          chips: 'glab variable set KUBECONFIG --type file --protected < ~/deployer.kubeconfig',
          concepts: ['cicd.deploy-account'],
          hints: { H1: bi('Ключ задают в настройках проекта, как любой секрет, а тип переменной должен быть File.', 'The key goes into the project settings like a secret; the variable type is File.'), H2: bi('Выполните `glab variable set KUBECONFIG --type file --protected < ~/deployer.kubeconfig`, затем `git commit --allow-empty -m deploy` и `git push`.', '`glab variable set KUBECONFIG --type file --protected < ~/deployer.kubeconfig`, then `git commit --allow-empty -m deploy` and `git push`.') },
        },
        {
          id: 'tag',
          prompt: bi('Пайплайн зелёный, но посмотрите на вывод `kubectl get deploy,rs -o wide`: на тестовом стенде по-прежнему старая версия. Сделайте так, чтобы каждый пайплайн main выкладывал образ своего коммита. Тег коммита для этого нужен в двух местах: джоба build-image должна собирать и отправлять образ с этим тегом, а джоба deploy_staging должна выкладывать тот же образ. Отправьте изменение.', 'The pipeline is green, but look at `kubectl get deploy,rs -o wide`: staging still runs the old version. Make every main pipeline deploy the image of its own commit. The commit tag is needed in two places for that: the build-image job must build and push the image with this tag, and the deploy_staging job must deploy exactly that image. Push the change.'),
          check: {
            when: (f) => deployOk(f) && !!tipImage(f) && web(f)?.image === tipImage(f) && (ci(f)?.registry ?? []).some((r) => `${r.image}:${r.tag}` === tipImage(f)) && !appliesLatest(f),
            fail: [
              { if: (f) => deployOk(f) && appliesLatest(f), say: bi('Образ коммита выложен, но джоба сначала применяет манифест с тегом :latest. Каждый такой apply создаёт лишнюю ревизию с образом :latest, и kubectl rollout undo потом вернёт стенд на неё, а не на прошлый коммит. Уберите apply из deploy_staging или замените тег в манифесте.', 'The commit image is deployed, but the job first applies the manifest with the :latest tag. Every such apply creates an extra revision with the :latest image, and kubectl rollout undo will later return staging to it rather than to the previous commit. Remove the apply from deploy_staging or change the tag in the manifest.') },
              { if: (f) => deployOk(f) && (web(f)?.image ?? '').endsWith(':latest'), say: bi('В Deployment всё ещё записан тег :latest, а kubectl apply того же манифеста ничего не меняет. Тег коммита нужен и в сборке, и в выкладке.', 'The Deployment still says :latest: kubectl apply of the same manifest changes nothing. You need the commit tag both in the build and in the deploy.') },
              { if: (f) => (k8s(f)?.pods ?? []).some((p) => p.ns === 'staging' && /ImagePull|ErrImage/.test(p.status)), say: bi('Поды не могут скачать образ, потому что такого тега нет в реестре. Собирайте и выкладывайте один и тот же тег, $CI_COMMIT_SHORT_SHA.', 'The pods cannot pull the image: there is no such tag in the registry. Build and deploy the same tag, $CI_COMMIT_SHORT_SHA.') },
            ],
          },
          chips: 'kubectl set image deployment/web web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA',
          concepts: ['cicd.immutable-tag'],
          docRef: { page: 'web/kubernetes.io/docs/concepts/workloads/controllers/deployment', anchor: 'updating-a-deployment', line: 'if and only if' },
          hints: { H1: bi('Выкладка начинается, только когда меняется шаблон пода.', 'A rollout starts only when the pod template changes.'), H2: bi('В джобе build-image укажите `-t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA` и такой же тег в push. В deploy_staging вместо apply выполните `kubectl set image deployment/web web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA`.', 'In build-image: `-t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA` and the same push. In deploy_staging instead of apply: `kubectl set image deployment/web web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA`.') },
        },
        {
          id: 'gate',
          prompt: bi('Разработчики просят перейти на новый базовый образ, то есть записать `FROM trainer/web:2.0` в `Dockerfile`. Эта версия аварийно завершается при старте, и пусть пайплайн сам это заметит. Сначала сделайте пайплайн честным: джоба выкладки должна ждать её окончания не дольше двух минут и завершаться с ошибкой, если не дождалась, а пайплайн должен сам возвращать тестовый стенд к прежней версии. Потом отправьте смену базового образа.', 'The developers ask to move to a new base: `FROM trainer/web:2.0` in the `Dockerfile`. This version crashes on start, but let the pipeline catch it by itself. First make it honest: the deploy job waits for the rollout to end for no more than two minutes and fails if it did not, and the pipeline returns staging to the previous version by itself. Then push the base change.'),
          check: {
            when: (f) => {
              const broken = (mainTip(f)?.files.Dockerfile ?? '').includes('trainer/web:2.0');
              const img = web(f)?.image ?? '';
              return broken && jobOf(f, 'deploy_staging', { ref: 'main' })?.status === 'failed' && /:[0-9a-f]{8}$/.test(img) && img !== tipImage(f);
            },
            fail: [
              { if: (f) => (mainTip(f)?.files.Dockerfile ?? '').includes('trainer/web:2.0') && deployOk(f), say: bi('Джоба зелёная, а поды аварийно завершаются, потому что джоба закончилась сразу после set image. Добавьте kubectl rollout status с таймаутом.', 'The job is green and the pods crash: it ended right after set image. Add kubectl rollout status with a timeout.') },
              { if: (f) => jobOf(f, 'deploy_staging', { ref: 'main' })?.status === 'failed' && (web(f)?.image ?? '').endsWith(':latest'), say: bi('Откат вернул стенд на образ :latest, а не на прошлый коммит, потому что команда kubectl apply манифеста с этим тегом записала лишнюю ревизию. Посмотрите kubectl rollout history deployment/web и уберите apply из deploy_staging.', 'The rollback returned staging to the :latest image rather than to the previous commit, because kubectl apply of the manifest with that tag recorded an extra revision. Look at kubectl rollout history deployment/web and remove the apply from deploy_staging.') },
              { if: (f) => jobOf(f, 'deploy_staging', { ref: 'main' })?.status === 'failed' && web(f)?.image === tipImage(f), say: bi('Пайплайн красный, и это правильно, но на тестовом стенде осталась сломанная версия. Добавьте в следующую стадию джобу с when: on_failure, которая выполняет kubectl rollout undo.', 'The pipeline is red, which is good, but the broken version stayed on staging. Add a job in the next stage with when: on_failure that runs kubectl rollout undo.') },
            ],
          },
          chips: 'kubectl rollout status deployment/web --timeout=120s',
          concepts: ['cicd.rollout-wait'],
          docStep: 3,
          docRef: { page: 'help/kubectl-rollout-status', anchor: 'OPTIONS', line: '--timeout' },
          hints: { H1: bi('Пайплайн нужно изменить в двух местах: добавить ожидание в deploy_staging и джобу отката, которая запускается только при падении.', 'Two changes to the pipeline: a wait in deploy_staging and a rollback job that runs only on failure.'), H2: bi('Добавьте в deploy_staging строку `- kubectl rollout status deployment/web --timeout=120s`, а также стадию `rollback` и джобу с `when: on_failure` и командой `kubectl rollout undo deployment/web`.', '`- kubectl rollout status deployment/web --timeout=120s` in deploy_staging; a `rollback` stage and a job with `when: on_failure` and `kubectl rollout undo deployment/web`.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Откройте справку `kubectl rollout status --help`. В каком разделе сказано, сколько команда ждёт по умолчанию? Нажмите на этот раздел.', 'Open the help `kubectl rollout status --help`. Which section says how long the command waits by default? Click it.'),
      ref: { page: 'help/kubectl-rollout-status' },
      answer: 'OPTIONS',
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Два коммита подряд создают два пайплайна, и их джобы выкладки могут выполняться одновременно. Тогда на тестовом стенде окажется версия той джобы, которая закончила последней, а не более новая. Сделайте так, чтобы GitLab выполнял выкладки на тестовый стенд строго по одной. В уроке такого ключа не было, поэтому найдите его в справочнике GitLab.', 'Two commits in a row give two pipelines, and their deploy jobs may run at the same time: then staging gets the version whose job finished last, not the newer one. Make GitLab run deployments to staging strictly one at a time. The lesson did not show this key: find it in the GitLab reference.'),
      ref: { page: 'web/docs.gitlab.com/ci/yaml' },
      terminal: {
        setup: a7Setup({ ci: A7_GOOD_CI, kubeconfigVar: true }),
        task: {
          id: 'serial',
          prompt: bi('Выкладки на тестовый стенд не выполняются одновременно, а пайплайн main зелёный.', 'Deployments to staging never run in parallel; the main pipeline is green.'),
          check: { when: (f) => !!pushedJob(f, 'deploy_staging')?.resourceGroup && deployOk(f) && web(f)?.image === tipImage(f) },
          docStep: 4,
          beyond: true,
          solutionTokens: ['resource_group', 'resource_group: staging'],
        },
      },
    },
    {
      id: 'gitops',
      kind: 'text',
      step: 'look',
      title: bi('Как агент GitOps работает внутри кластера', 'How the GitOps agent works inside the cluster'),
      body: bi(
        'На схеме выше агент GitOps нарисован одним блоком. Чтобы увидеть, из чего он состоит и с кем разговаривает, соберите его в конструкторе кластера, который вы видели в блоке Kubernetes. Flux, один из двух распространённых агентов, ставится в кластер как обычное дополнение и работает подами в пространстве имён `flux-system`. Его source-controller через заданный промежуток времени забирает из репозитория конфигурации новые коммиты, а kustomize-controller сравнивает записанные там манифесты с объектами кластера и применяет разницу через тот же API-сервер, к которому в push-модели обращалась джоба. Права на это даёт собственный сервисный аккаунт Flux внутри кластера, поэтому CI ключ от кластера не нужен.\n\nИз такого устройства следует свойство, которое на собеседовании спрашивают чаще всего: ручная правка кластера командой `kubectl` продержится только до следующей сверки. Источником истины служит Git, и агент возвращает кластер к записанному в нём состоянию, так же как контроллер Deployment возвращает число подов к числу реплик. Поэтому в GitOps срочную правку тоже вносят коммитом, а `kubectl edit` на тестовом стенде годится только для того, чтобы что-то быстро проверить.',
        'In the diagram above the GitOps agent is drawn as one block. To see what it is made of and whom it talks to, assemble it in the cluster constructor you saw in the Kubernetes block. Flux, one of the two common agents, is installed into the cluster as an ordinary add-on and runs as pods in the `flux-system` namespace. Its source-controller fetches new commits from the configuration repository at a set interval, and its kustomize-controller compares the manifests written there with the cluster objects and applies the difference through the same API server the job talked to in the push model. Flux’s own service account inside the cluster grants the rights for that, so CI needs no cluster key.\n\nThis design leads to the property interviewers ask about most: a manual change to the cluster with `kubectl` lasts only until the next reconciliation. Git is the source of truth, and the agent returns the cluster to the state written there, just as the Deployment controller returns the pod count to the replica count. So in GitOps even an urgent fix goes in as a commit, and `kubectl edit` on staging is good only for a quick experiment.',
      ),
    },
    {
      id: 'flux-howto',
      kind: 'text',
      role: 'howto',
      step: 'look',
      body: bi(
        'В конструкторе уже собран кластер вместе со слоем «Выкладка из Git», в котором стоит Flux. Нажмите внизу кнопку сценария «Выкладка через Git». Вы увидите, как команда `cluster git push` отправляет манифест в репозиторий команды, как `kubectl get kustomization -n flux-system` показывает результат сверки и как ручной `kubectl scale` до одной реплики отменяется на следующей сверке, через пять минут, и реплик снова становится три. Затем нажмите на название слоя «Выкладка из Git» в легенде, чтобы выключить его, и запустите тот же сценарий ещё раз: коммит останется в Git, а Deployment в кластере не появится, и под результатом прогона будет сказано почему.',
        'The constructor already holds a cluster with the “GitOps” layer, which contains Flux. Press the scenario button “Deploying through Git” at the bottom. You will see `cluster git push` send a manifest to the team repository, `kubectl get kustomization -n flux-system` show the result of the reconciliation, and a manual `kubectl scale` to one replica undone at the next reconciliation five minutes later, back to three replicas. Then press the layer name “GitOps” in the legend to switch it off and run the same scenario again: the commit stays in Git, the Deployment never appears in the cluster, and the result under the run says why.',
      ),
    },
    { id: 'flux', kind: 'widget', step: 'try', widget: 'k8s.constructor', props: { preset: 'full', layers: ['cp', 'node', 'net', 'gitops'] } },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['cicd-k8s.q.latest', 'cicd-k8s.q.account', 'cicd-k8s.q.file', 'cicd-k8s.q.wait', 'cicd-k8s.q.models'] },
  ],
};

export const lessons: Lesson[] = [lesson];

const placement: PlacementTask[] = [
  { id: 'cicd-k8s.place.latest', level: 'intermediate', key: true, concepts: ['cicd.immutable-tag'], kind: 'quiz', item: { ...(quiz.find((q) => q.id === 'cicd-k8s.q.latest') as QuizItem), id: 'cicd-k8s.place.q.latest' } },
  { id: 'cicd-k8s.place.account', level: 'intermediate', key: true, concepts: ['cicd.deploy-account'], kind: 'quiz', item: { ...(quiz.find((q) => q.id === 'cicd-k8s.q.account') as QuizItem), id: 'cicd-k8s.place.q.account' } },
  {
    id: 'cicd-k8s.place.tag',
    level: 'experienced',
    key: true,
    concepts: ['cicd.immutable-tag', 'cicd.k8s-push'],
    kind: 'task',
    setup: a7Setup({ kubeconfigVar: true }),
    task: {
      id: 'p1',
      prompt: bi('Пайплайн main зелёный, а версия на тестовом стенде не меняется уже неделю. Добейтесь, чтобы пайплайн выкладывал в Deployment `web` образ своего коммита.', 'The main pipeline is green, yet the version on staging has not changed for a week. Make the pipeline deploy the image of its own commit into the Deployment `web`.'),
      check: { when: (f) => deployOk(f) && !!tipImage(f) && web(f)?.image === tipImage(f) },
    },
  },
  { id: 'cicd-k8s.place.models', level: 'experienced', key: false, concepts: ['cicd.gitops-pull'], kind: 'quiz', item: { ...(quiz.find((q) => q.id === 'cicd-k8s.q.models-push') as QuizItem), id: 'cicd-k8s.place.q.models' } },
  {
    id: 'cicd-k8s.place.wait',
    level: 'experienced',
    key: true,
    concepts: ['cicd.rollout-wait'],
    kind: 'task',
    setup: a7Setup({ kubeconfigVar: true, ci: A7_GOOD_CI.replace('    - kubectl rollout status deployment/web --timeout=120s\n', '') }),
    task: {
      id: 'p2',
      prompt: bi('Разработчики переводят сайт на базовый образ `trainer/web:2.0`, а эта версия аварийно завершается при старте. Сейчас пайплайн main в таком случае остаётся зелёным. Доработайте пайплайн, затем сами замените в Dockerfile базовый образ на `trainer/web:2.0` и отправьте коммит в main. Пайплайн этого коммита должен стать красным, а тестовый стенд должен сам вернуться к прежней версии.', 'The developers move the site to the base image `trainer/web:2.0`, and that version crashes on start. Right now the main pipeline stays green in that case. Fix the pipeline, then change the base image in the Dockerfile to `trainer/web:2.0` yourself and push a commit to main. The pipeline of that commit must turn red, and staging must return to the previous version by itself.'),
      check: {
        when: (f) => {
          const img = web(f)?.image ?? '';
          return (mainTip(f)?.files.Dockerfile ?? '').includes('trainer/web:2.0') && jobOf(f, 'deploy_staging', { ref: 'main' })?.status === 'failed' && /:[0-9a-f]{8}$/.test(img) && img !== tipImage(f);
        },
      },
    },
  },
];

export const block: Block = {
  id: 'cicd-k8s',
  order: 65,
  title: bi('Выкладка в Kubernetes из CI', 'Deploying to Kubernetes from CI'),
  summary: bi('В этом блоке вы построите пайплайн, который сам выкладывает версию в кластер. Джоба выкладки получит ключ аккаунта с узкими правами, будет выкладывать образ с неизменяемым тегом, дожидаться результата и откатываться при неудаче, а потом вы сравните push-модель с pull-моделью.', 'A pipeline that rolls a version out to the cluster by itself: a narrow account’s key, an immutable tag, waiting and rolling back; the push and the pull model.'),
  checklistStep: '05',
  levels: {
    beginner: bi('Прошёл блоки CI/CD и Kubernetes', 'Has done the CI/CD and Kubernetes blocks'),
    intermediate: bi('Выкладывал версии в кластер вручную', 'Has rolled out to a cluster by hand'),
    experienced: bi('Писал джобы с kubectl или helm', 'Has written jobs with kubectl or helm'),
  },
  hours: { beginner: 4, intermediate: 3, experienced: 2 },
  lessons: lessons.map((l) => l.id),
  sources: src([S.agent, S.deployment, S.gitops], [S.ruDeployment, S.ruCd]),
  docSources: ['help', 'docs.gitlab.com', 'kubernetes.io'],
  placement,
};
