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
  { id: 'cicd.k8s-push', term: bi('push-выкладка', 'push deployment'), forms: { ru: ['push-выкладки', 'push-выкладку', 'push-выкладкой', 'push-модель', 'push-модели'], en: ['push deployments', 'push model'] }, short: bi('Выкладка, при которой джоба CI сама обращается к API-серверу кластера со своим ключом и меняет объекты (kubectl set image, helm upgrade).', 'A deployment where the CI job itself calls the cluster’s API server with its own key and changes objects (kubectl set image, helm upgrade).'), introducedIn: L, docRef: { url: 'https://docs.gitlab.com/user/clusters/agent/ci_cd_workflow/', label: 'docs.gitlab.com › Using GitLab CI/CD with a Kubernetes cluster' } },
  { id: 'cicd.deploy-account', term: bi('аккаунт выкладки', 'deploy account'), forms: { ru: ['аккаунта выкладки', 'аккаунтом выкладки', 'аккаунту выкладки'], en: ['deploy accounts'] }, short: bi('Сервисный аккаунт в одном namespace с ролью ровно на те глаголы, что нужны выкладке; его ключ — в защищённой File-переменной, а не cluster-admin.', 'A service account in one namespace with a role for exactly the verbs a deployment needs; its key lives in a protected File variable, not cluster-admin.'), introducedIn: L, docRef: { url: 'https://kubernetes.io/docs/reference/access-authn-authz/rbac/', label: 'kubernetes.io › Using RBAC Authorization' } },
  { id: 'cicd.immutable-tag', term: bi('неизменяемый тег', 'immutable tag'), forms: { ru: ['неизменяемого тега', 'неизменяемым тегом', 'неизменяемые теги', 'неизменяемых тегов', 'неизменяемому тегу'], en: ['immutable tags'] }, short: bi('Тег образа, который никогда не переезжает на другой образ, обычно хэш коммита. Новый тег меняет шаблон пода, и Deployment начинает выкладку; latest этого не делает.', 'An image tag that never moves to another image, usually the commit hash. A new tag changes the pod template and the Deployment starts a rollout; latest does not.'), introducedIn: L, docRef: { page: 'web/kubernetes.io/docs/concepts/workloads/controllers/deployment', anchor: 'updating-a-deployment' } },
  { id: 'cicd.rollout-wait', term: bi('ожидание выкладки', 'rollout wait'), forms: { ru: ['ожидания выкладки', 'ожиданием выкладки'] }, scan: false, short: bi('Шаг джобы, который ждёт конца выкладки и падает по таймауту: kubectl rollout status --timeout, helm upgrade --wait. Без него зелёная джоба ничего не говорит о версии в кластере.', 'A job step that waits for the rollout to end and fails on a timeout: kubectl rollout status --timeout, helm upgrade --wait. Without it a green job says nothing about the version in the cluster.'), introducedIn: L, docRef: { page: 'help/kubectl-rollout-status', anchor: 'OPTIONS', line: '--timeout' } },
  { id: 'cicd.gitops-pull', term: bi('pull-выкладка', 'pull deployment'), forms: { ru: ['pull-выкладки', 'pull-выкладку', 'pull-модель', 'pull-модели', 'GitOps'], en: ['pull model', 'GitOps'] }, short: bi('Выкладка, при которой CI только коммитит новый тег в репозиторий конфигурации, а агент внутри кластера (Argo CD, Flux) сам приводит кластер к записанному. Ключ от кластера не покидает кластер.', 'A deployment where CI only commits the new tag to a configuration repository, and an agent inside the cluster (Argo CD, Flux) brings the cluster to what is written. The cluster key never leaves the cluster.'), introducedIn: L, docRef: { url: 'https://opengitops.dev/', label: 'opengitops.dev › Principles' } },
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
  image: bitnami/kubectl:1.34
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
  image: bitnami/kubectl:1.34
  environment: staging
  script:
    - kubectl set image deployment/web web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
    - kubectl rollout status deployment/web --timeout=120s
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

rollback_staging:
  stage: rollback
  image: bitnami/kubectl:1.34
  when: on_failure
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
const deployOk = (f: Facts) => jobOf(f, 'deploy_staging', { ref: 'main' })?.status === 'success';

// ── quiz bank ──

export const quiz: QuizItem[] = [
  {
    id: 'cicd-k8s.q.latest',
    kind: 'mcq',
    concepts: ['cicd.immutable-tag'],
    key: true,
    prompt: bi('Джоба собирает образ `site:latest` и делает `kubectl apply -f k8s/`. Пайплайн зелёный, в логе `deployment.apps/web unchanged`, на staging старая версия. Почему?', 'The job builds `site:latest` and runs `kubectl apply -f k8s/`. The pipeline is green, the log says `deployment.apps/web unchanged`, and staging runs the old version. Why?'),
    options: [
      { id: 'template', text: bi('Текст Deployment не изменился: выкладку запускает только новый шаблон пода, а тег latest остался тем же словом', 'The Deployment text did not change: only a new pod template starts a rollout, and latest is still the same word'), correct: true },
      { id: 'pull', text: bi('Узлы не успели скачать новый образ', 'The nodes did not manage to download the new image'), why: bi('Новые поды даже не создавались: «unchanged» значит, что API-сервер не увидел разницы в объекте.', 'No new pods were even created: "unchanged" means the API server saw no difference in the object.') },
      { id: 'rbac', text: bi('У джобы нет прав на изменение Deployment', 'The job has no right to change the Deployment'), why: bi('Отказ в правах выглядел бы как Forbidden, и джоба была бы красной.', 'A refusal of rights would look like Forbidden, and the job would be red.') },
    ],
  },
  {
    id: 'cicd-k8s.q.account',
    kind: 'mcq',
    concepts: ['cicd.deploy-account'],
    key: true,
    prompt: bi('Каким ключом джоба выкладки должна входить в кластер staging?', 'With what key should the deploy job enter the staging cluster?'),
    options: [
      { id: 'sa', text: bi('Токен сервисного аккаунта deployer с ролью на Deployment и Service в namespace staging, в защищённой File-переменной', 'A token of the deployer service account with a role on Deployments and Services in the staging namespace, in a protected File variable'), correct: true },
      { id: 'admin', text: bi('kubeconfig администратора с cluster-admin: так ничего не упадёт с Forbidden', 'The administrator’s cluster-admin kubeconfig: then nothing fails with Forbidden'), why: bi('Каждый, кто может пушить в main, получит весь кластер: удалить узлы, прочитать чужие секреты. Ключ CI должен уметь ровно то, что нужно выкладке.', 'Everyone who can push to main would get the whole cluster: delete nodes, read other teams’ Secrets. The CI key must be able to do exactly what the deployment needs.') },
      { id: 'repo', text: bi('kubeconfig, закоммиченный в репозиторий рядом с манифестами', 'A kubeconfig committed to the repository next to the manifests'), why: bi('Всё, что попало в историю, видно каждому, у кого есть копия, и остаётся там навсегда.', 'Whatever gets into the history is visible to everyone with a copy and stays there forever.') },
    ],
  },
  {
    id: 'cicd-k8s.q.wait',
    kind: 'mcq',
    concepts: ['cicd.rollout-wait'],
    prompt: bi('В скрипте джобы только `kubectl set image deployment/web web=site:$CI_COMMIT_SHORT_SHA`. Новая версия падает при старте. Какого цвета будет пайплайн?', 'The job script has only `kubectl set image deployment/web web=site:$CI_COMMIT_SHORT_SHA`. The new version crashes on start. What colour will the pipeline be?'),
    options: [
      { id: 'green', text: bi('Зелёный: set image вернула 0, о подах джоба не знает', 'Green: set image returned 0, and the job knows nothing about the pods'), correct: true },
      { id: 'red', text: bi('Красный: Kubernetes сообщит раннеру о падении', 'Red: Kubernetes tells the runner about the crash'), why: bi('Кластер никому ничего не сообщает: джобе нужно самой спросить и дождаться — kubectl rollout status --timeout.', 'The cluster tells nobody anything: the job has to ask and wait itself, with kubectl rollout status --timeout.') },
    ],
  },
  {
    id: 'cicd-k8s.q.models',
    kind: 'match',
    concepts: ['cicd.k8s-push', 'cicd.gitops-pull'],
    prompt: bi('К какой модели выкладки относится каждое утверждение?', 'Which deployment model does each statement belong to?'),
    pairs: [
      { id: 'key', left: bi('Ключ от кластера хранится в настройках CI', 'The cluster key is stored in the CI settings'), right: bi('push', 'push') },
      { id: 'agent', left: bi('Агент внутри кластера сам читает репозиторий конфигурации', 'An agent inside the cluster reads the configuration repository by itself'), right: bi('pull', 'pull') },
      { id: 'history', left: bi('История выкладок — это история коммитов, откат — revert', 'The history of deployments is the history of commits; a rollback is a revert'), right: bi('pull', 'pull'), why: bi('В push-модели история выкладок живёт в окружениях forge и в ревизиях Deployment, а не в Git.', 'In the push model the history of deployments lives in the forge environments and in Deployment revisions, not in Git.') },
      { id: 'red', left: bi('Упавшая выкладка красит пайплайн, если джоба ждёт rollout status', 'A failed rollout turns the pipeline red if the job waits on rollout status'), right: bi('push', 'push') },
    ],
  },
  {
    id: 'cicd-k8s.q.file',
    kind: 'mcq',
    concepts: ['cicd.deploy-account'],
    prompt: bi('Ключ кластера положили в переменную KUBECONFIG обычного типа, и kubectl в джобе отвечает `The connection to the server localhost:8080 was refused`. Почему?', 'The cluster key was put into an ordinary KUBECONFIG variable, and kubectl in the job answers `The connection to the server localhost:8080 was refused`. Why?'),
    options: [
      { id: 'path', text: bi('kubectl ждёт в KUBECONFIG путь к файлу, а получил сам текст; нужна переменная типа File', 'kubectl expects a file path in KUBECONFIG and got the text itself; the variable must be of type File'), correct: true },
      { id: 'network', text: bi('У раннера нет сети до кластера', 'The runner has no network to the cluster'), why: bi('localhost:8080 — адрес, куда kubectl идёт, когда не нашёл никакого kubeconfig. До настоящего адреса дело не дошло.', 'localhost:8080 is where kubectl goes when it found no kubeconfig at all. It never got to the real address.') },
      { id: 'masked', text: bi('Переменную нужно было сделать Masked', 'The variable should have been Masked'), why: bi('Masked только прячет значение в логе; к тому же многострочный kubeconfig замаскировать нельзя.', 'Masked only hides the value in the log; and a multi-line kubeconfig cannot be masked anyway.') },
    ],
  },
];

// ── the lesson ──

const lesson: Lesson = {
  id: L,
  block: 'cicd-k8s',
  title: bi('Выкладка в Kubernetes из CI', 'Deploying to Kubernetes from CI'),
  summary: bi('Джоба выкладки входит в кластер ключом узкого аккаунта, меняет образ на тег коммита и ждёт, чем кончится выкладка. Иначе CI только коммитит тег, а кластер подтягивает его сам.', 'The deploy job enters the cluster with a narrow account’s key, changes the image to the commit tag and waits to see how the rollout ends. Otherwise CI only commits the tag and the cluster pulls it in by itself.'),
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
        'В блоке CI/CD пайплайн выкладывал сайт скриптом `deploy.sh`. Теперь сайт живёт в кластере: в namespace `staging` стоит Deployment `web` на три реплики, и обновляли его до сих пор руками, с ноутбука администратора. Команда просит, чтобы каждый коммит в main сам оказывался на staging — и чтобы зелёный пайплайн означал, что новая версия действительно работает.',
        'In the CI/CD block the pipeline deployed the site with a `deploy.sh` script. Now the site lives in a cluster: the `staging` namespace has a Deployment `web` with three replicas, and until now it was updated by hand from the administrator’s laptop. The team asks that every commit to main reach staging by itself, and that a green pipeline mean the new version really works.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'cicd.k8s-deploy', caption: bi('Пройдите шаги push-модели, затем переключите тег на latest и уберите ожидание. Сломайте образ и сравните цвет джобы в push и в pull.', 'Step through the push model, then switch the tag to latest and turn off the wait. Break the image and compare the job’s colour in push and in pull.') },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      title: bi('Четыре решения выкладки', 'Four decisions of a deployment'),
      body: bi(
        'Выкладка из CI в Kubernetes устроена проще, чем кажется: [[k8s.deployment|Deployment]] уже умеет менять версию сам, и пайплайну остаётся лишь сообщить ему, какой образ теперь желаемый. Всё остальное — четыре решения, и от каждого зависит, можно ли доверять зелёной галочке.\n\n### Как джоба входит в кластер\n\nКоманды `kubectl` в скрипте джобы — такой же клиент [[k8s.apiserver|API-сервера]], как ваш терминал, и им тоже нужен [[k8s.kubeconfig|kubeconfig]]. Такую схему, где джоба сама идёт в кластер со своим ключом и меняет объекты, называют [[cicd.k8s-push|push-выкладкой]]. Ключ для неё выдают не свой и тем более не администраторский: для CI заводят отдельный [[cicd.deploy-account|аккаунт выкладки]] — ServiceAccount `deployer` в namespace `staging` с ролью, где перечислены ровно нужные глаголы: `get`, `list`, `watch`, `patch` на Deployment и Service. Если кто-то допишет в скрипт `kubectl delete nodes --all`, API-сервер ответит `Forbidden`. С kubeconfig администратора тот же скрипт удалил бы узлы, а писать скрипт может любой, у кого есть право пушить в main.\n\nКлюч кладут в [[cicd.variable|переменную CI/CD]] типа **File** с флагом Protected. Тип File важен: раннер записывает значение во временный файл, а в переменную кладёт путь к нему, и именно путь `kubectl` ищет в `$KUBECONFIG`. Обычная переменная передала бы вместо пути сам текст ключа, и `kubectl`, не найдя файла, пошёл бы на `localhost:8080`. В настоящем GitLab вместо ключа в переменной чаще ставят агент GitLab для Kubernetes: он держит связь с кластером изнутри, а джоба получает готовый контекст.\n\n### Тег, который не переезжает\n\n[[k8s.rolling-update|Выкладка]] начинается тогда и только тогда, когда меняется шаблон пода. Если образ всегда собирается как `site:latest`, текст Deployment от сборки к сборке один и тот же: `kubectl apply` отвечает `unchanged`, новых подов нет, на staging остаётся старая версия — а джоба зелёная. Поэтому образ помечают [[cicd.immutable-tag|неизменяемым тегом]], обычно `$CI_COMMIT_SHORT_SHA`, и выкладывают именно его: `kubectl set image deployment/web web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA` или `helm upgrade --install web ./chart --set image.tag=$CI_COMMIT_SHORT_SHA`. Новый тег даёт новый шаблон, новый [[k8s.replicaset|ReplicaSet]] и новую [[k8s.revision|ревизию]], а по тегу на любом поде видно, из какого коммита он собран.\n\n### Дождаться и откатить\n\n`kubectl set image` возвращает 0, как только API-сервер принял изменение, — задолго до того, как поднимется хоть один новый под. Если новая версия падает при старте, поды уходят в [[k8s.crashloop|CrashLoopBackOff]], а пайплайн уже зелёный. Чтобы цвет джобы говорил правду, после изменения ставят [[cicd.rollout-wait|ожидание выкладки]]: `kubectl rollout status deployment/web --timeout=120s` ждёт конца выкладки и падает, если за две минуты она не закончилась. У Helm то же самое делает `helm upgrade --wait`, а в Helm 4 флаг `--rollback-on-failure` заодно откатывает релиз.\n\nОткат с `kubectl` пишут отдельной джобой в следующей стадии: `when: on_failure` запускает её, только если что-то раньше упало, и она выполняет `kubectl rollout undo deployment/web`. Контроллер снова раздувает прежний ReplicaSet, и staging возвращается к последней рабочей версии, а пайплайн остаётся красным: откат — не повод скрывать, что выкладка не удалась.\n\n### Push и pull\n\nУ push-модели есть цена: ключ от кластера хранится в CI, и защищать его приходится там же. Другой путь — [[cicd.gitops-pull|pull-выкладка]], которую называют GitOps. В ней у CI нет ключа от кластера вовсе: джоба собирает образ и коммитит новый тег в отдельный репозиторий конфигурации — например, строку `tag:` в `deploy/values.yaml`. Агент внутри кластера (Argo CD или Flux) сам замечает коммит и приводит кластер к записанному, так же как контроллер Deployment приводит поды к спецификации. История выкладок становится историей коммитов, а откат — коммитом `git revert`. Взамен пайплайн не знает, чем закончилась выкладка: о здоровье приложения сообщает уже агент.',
        'Deploying from CI to Kubernetes is simpler than it looks: a [[k8s.deployment|Deployment]] already knows how to change versions by itself, and the pipeline only has to tell it which image is desired now. Everything else is four decisions, and each one decides whether a green tick can be trusted.\n\n### How the job enters the cluster\n\nThe `kubectl` commands in a job script are a client of the [[k8s.apiserver|API server]] just like your terminal, and they need a [[k8s.kubeconfig|kubeconfig]] too. This scheme, where the job itself goes to the cluster with its own key and changes objects, is called a [[cicd.k8s-push|push deployment]]. The key for it is neither yours nor, still less, the administrator’s: CI gets its own [[cicd.deploy-account|deploy account]], a ServiceAccount `deployer` in the `staging` namespace with a role that lists exactly the verbs needed: `get`, `list`, `watch`, `patch` on Deployments and Services. If someone adds `kubectl delete nodes --all` to the script, the API server answers `Forbidden`. With the administrator’s kubeconfig the same script would delete the nodes, and anyone who may push to main can write the script.\n\nThe key goes into a [[cicd.variable|CI/CD variable]] of type **File** with the Protected flag. The File type matters: the runner writes the value into a temporary file and puts the path to it into the variable, and a path is exactly what `kubectl` looks for in `$KUBECONFIG`. An ordinary variable would pass the text of the key instead of a path, and `kubectl`, finding no file, would go to `localhost:8080`. In real GitLab, instead of a key in a variable, people often install the GitLab agent for Kubernetes: it keeps the connection to the cluster from inside, and the job gets a ready context.\n\n### A tag that does not move\n\nA [[k8s.rolling-update|rollout]] starts if and only if the pod template changes. If the image is always built as `site:latest`, the Deployment text is the same from build to build: `kubectl apply` answers `unchanged`, there are no new pods, staging keeps the old version, and the job is green. So the image is marked with an [[cicd.immutable-tag|immutable tag]], usually `$CI_COMMIT_SHORT_SHA`, and exactly that tag is deployed: `kubectl set image deployment/web web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA` or `helm upgrade --install web ./chart --set image.tag=$CI_COMMIT_SHORT_SHA`. A new tag gives a new template, a new [[k8s.replicaset|ReplicaSet]] and a new [[k8s.revision|revision]], and the tag on any pod tells which commit it was built from.\n\n### Wait and roll back\n\n`kubectl set image` returns 0 as soon as the API server accepted the change, long before a single new pod is up. If the new version crashes on start, the pods go into [[k8s.crashloop|CrashLoopBackOff]] while the pipeline is already green. For the job’s colour to tell the truth, the change is followed by a [[cicd.rollout-wait|rollout wait]]: `kubectl rollout status deployment/web --timeout=120s` waits for the rollout to end and fails if it did not end within two minutes. With Helm `helm upgrade --wait` does the same, and in Helm 4 the `--rollback-on-failure` flag also rolls the release back.\n\nWith `kubectl` the rollback is a separate job in the next stage: `when: on_failure` starts it only if something earlier failed, and it runs `kubectl rollout undo deployment/web`. The controller scales the previous ReplicaSet back up and staging returns to the last working version, while the pipeline stays red: a rollback is no reason to hide that the deployment failed.\n\n### Push and pull\n\nThe push model has a price: the cluster key is kept in CI and has to be protected there. The other way is a [[cicd.gitops-pull|pull deployment]], also called GitOps. In it CI has no cluster key at all: the job builds the image and commits the new tag to a separate configuration repository, say the `tag:` line in `deploy/values.yaml`. An agent inside the cluster (Argo CD or Flux) notices the commit by itself and brings the cluster to what is written, just as the Deployment controller brings pods to the spec. The history of deployments becomes the history of commits, and a rollback is a `git revert`. In exchange the pipeline does not know how the rollout ended: it is the agent that reports the application’s health.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: a7Setup(),
      intro: bi('`~/site` — проект сайта с `Dockerfile` и манифестом `k8s/deployment.yaml`. Пайплайн собирает образ и выкладывает его в namespace `staging`; администратор кластера оставил вам ключ аккаунта deployer в `~/deployer.kubeconfig`. Ваш `kubectl` смотрит в тот же кластер, что и джобы.', '`~/site` is the site project with a `Dockerfile` and the manifest `k8s/deployment.yaml`. The pipeline builds the image and deploys it into the `staging` namespace; the cluster administrator left you the deployer account’s key in `~/deployer.kubeconfig`. Your `kubectl` looks at the same cluster as the jobs.'),
      tasks: [
        {
          id: 'key',
          prompt: bi('Отправьте пустой коммит в main и прочитайте, почему падает `deploy_staging`. Дайте джобе ключ deployer так, как положено ключу кластера, и добейтесь зелёной выкладки. В репозиторий ключ попасть не должен.', 'Push an empty commit to main and read why `deploy_staging` fails. Give the job the deployer key the way a cluster key should be given, and get a green deployment. The key must not get into the repository.'),
          check: {
            when: (f) => deployOk(f) && !!kcVar(f)?.file && !!kcVar(f)?.protected && !leaked(f),
            fail: [
              { if: (f) => leaked(f), say: bi('Ключ deployer попал в коммит на forge — он в истории навсегда. Уберите файл, положите ключ в переменную и попросите администратора выпустить новый.', 'The deployer key got into a commit on the forge: it is in the history forever. Remove the file, put the key into a variable and ask the administrator for a new one.') },
              { if: (f) => !!kcVar(f) && !kcVar(f)?.file, say: bi('Переменная есть, но обычного типа: kubectl ищет в $KUBECONFIG путь к файлу. Нужен тип File (--type file).', 'The variable exists but is of the ordinary type: kubectl looks for a file path in $KUBECONFIG. It must be of type File (--type file).') },
              { if: (f) => !!kcVar(f)?.file && !kcVar(f)?.protected, say: bi('Ключ кластера должен получать только main: отметьте переменную Protected.', 'Only main should get the cluster key: mark the variable Protected.') },
              { if: (f) => (jobOf(f, 'deploy_staging', { ref: 'main' })?.log ?? '').includes('localhost:8080'), say: bi('kubectl не нашёл kubeconfig и пошёл на localhost:8080. Джобе нужен ключ — переменная KUBECONFIG.', 'kubectl found no kubeconfig and went to localhost:8080. The job needs a key: the KUBECONFIG variable.') },
            ],
          },
          chips: 'glab variable set KUBECONFIG --type file --protected < ~/deployer.kubeconfig',
          concepts: ['cicd.deploy-account'],
          hints: { H1: bi('Ключ — в настройки проекта, как секрет; тип переменной — File.', 'The key goes into the project settings like a secret; the variable type is File.'), H2: bi('`glab variable set KUBECONFIG --type file --protected < ~/deployer.kubeconfig`, затем `git commit --allow-empty -m deploy` и `git push`.', '`glab variable set KUBECONFIG --type file --protected < ~/deployer.kubeconfig`, then `git commit --allow-empty -m deploy` and `git push`.') },
        },
        {
          id: 'tag',
          prompt: bi('Пайплайн зелёный, но посмотрите `kubectl get deploy,rs -o wide`: на staging по-прежнему старая версия. Сделайте так, чтобы каждый пайплайн main выкладывал образ именно своего коммита, и отправьте изменение.', 'The pipeline is green, but look at `kubectl get deploy,rs -o wide`: staging still runs the old version. Make every main pipeline deploy the image of exactly its own commit, and push the change.'),
          check: {
            when: (f) => deployOk(f) && !!tipImage(f) && web(f)?.image === tipImage(f) && (ci(f)?.registry ?? []).some((r) => `${r.image}:${r.tag}` === tipImage(f)),
            fail: [
              { if: (f) => deployOk(f) && (web(f)?.image ?? '').endsWith(':latest'), say: bi('В Deployment всё ещё :latest: kubectl apply того же манифеста ничего не меняет. Нужен тег коммита и в сборке, и в выкладке.', 'The Deployment still says :latest: kubectl apply of the same manifest changes nothing. You need the commit tag both in the build and in the deploy.') },
              { if: (f) => (k8s(f)?.pods ?? []).some((p) => p.ns === 'staging' && /ImagePull|ErrImage/.test(p.status)), say: bi('Поды не могут скачать образ: такого тега нет в реестре. Собирайте и выкладывайте один и тот же тег — $CI_COMMIT_SHORT_SHA.', 'The pods cannot pull the image: there is no such tag in the registry. Build and deploy the same tag, $CI_COMMIT_SHORT_SHA.') },
            ],
          },
          chips: 'kubectl set image deployment/web web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA',
          concepts: ['cicd.immutable-tag'],
          docRef: { page: 'web/kubernetes.io/docs/concepts/workloads/controllers/deployment', anchor: 'updating-a-deployment', line: 'if and only if' },
          hints: { H1: bi('Выкладка начинается, только когда меняется шаблон пода.', 'A rollout starts only when the pod template changes.'), H2: bi('В build-image: `-t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA` и такой же push. В deploy_staging вместо apply: `kubectl set image deployment/web web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA`.', 'In build-image: `-t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA` and the same push. In deploy_staging instead of apply: `kubectl set image deployment/web web=$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA`.') },
        },
        {
          id: 'gate',
          prompt: bi('Разработчики просят перейти на новую базу: `FROM trainer/web:2.0` в `Dockerfile`. Эта версия падает при старте, но пусть пайплайн сам это поймает. Сначала сделайте его честным: джоба выкладки ждёт её конца не дольше двух минут и падает, если не дождалась, а пайплайн сам возвращает staging к прежней версии. Потом отправьте смену базы.', 'The developers ask to move to a new base: `FROM trainer/web:2.0` in the `Dockerfile`. This version crashes on start, but let the pipeline catch it by itself. First make it honest: the deploy job waits for the rollout to end for no more than two minutes and fails if it did not, and the pipeline returns staging to the previous version by itself. Then push the base change.'),
          check: {
            when: (f) => {
              const broken = (mainTip(f)?.files.Dockerfile ?? '').includes('trainer/web:2.0');
              const img = web(f)?.image ?? '';
              return broken && jobOf(f, 'deploy_staging', { ref: 'main' })?.status === 'failed' && /:[0-9a-f]{8}$/.test(img) && img !== tipImage(f);
            },
            fail: [
              { if: (f) => (mainTip(f)?.files.Dockerfile ?? '').includes('trainer/web:2.0') && deployOk(f), say: bi('Джоба зелёная, а поды падают: она закончилась сразу после set image. Добавьте kubectl rollout status с таймаутом.', 'The job is green and the pods crash: it ended right after set image. Add kubectl rollout status with a timeout.') },
              { if: (f) => jobOf(f, 'deploy_staging', { ref: 'main' })?.status === 'failed' && web(f)?.image === tipImage(f), say: bi('Пайплайн красный — хорошо, но на staging осталась сломанная версия. Добавьте следующей стадией джобу с when: on_failure, которая делает kubectl rollout undo.', 'The pipeline is red, which is good, but the broken version stayed on staging. Add a job in the next stage with when: on_failure that runs kubectl rollout undo.') },
            ],
          },
          chips: 'kubectl rollout status deployment/web --timeout=120s',
          concepts: ['cicd.rollout-wait'],
          docStep: 3,
          docRef: { page: 'help/kubectl-rollout-status', anchor: 'OPTIONS', line: '--timeout' },
          hints: { H1: bi('Два изменения пайплайна: ожидание в deploy_staging и джоба отката, которая запускается только при падении.', 'Two changes to the pipeline: a wait in deploy_staging and a rollback job that runs only on failure.'), H2: bi('`- kubectl rollout status deployment/web --timeout=120s` в deploy_staging; стадия `rollback` и джоба с `when: on_failure` и `kubectl rollout undo deployment/web`.', '`- kubectl rollout status deployment/web --timeout=120s` in deploy_staging; a `rollback` stage and a job with `when: on_failure` and `kubectl rollout undo deployment/web`.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Откройте справку `kubectl rollout status --help`. В каком разделе сказано, сколько команда ждёт по умолчанию? Нажмите на него.', 'Open the help `kubectl rollout status --help`. Which section says how long the command waits by default? Click it.'),
      ref: { page: 'help/kubectl-rollout-status' },
      answer: 'OPTIONS',
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Два коммита подряд дают два пайплайна, и их джобы выкладки могут пойти одновременно: тогда на staging окажется та версия, чья джоба закончила последней, а не та, что новее. Сделайте так, чтобы GitLab выполнял выкладки в staging строго по одной. В уроке этого ключа не было — найдите его в справочнике GitLab.', 'Two commits in a row give two pipelines, and their deploy jobs may run at the same time: then staging gets the version whose job finished last, not the newer one. Make GitLab run deployments to staging strictly one at a time. The lesson did not show this key: find it in the GitLab reference.'),
      ref: { page: 'web/docs.gitlab.com/ci/yaml' },
      terminal: {
        setup: a7Setup({ ci: A7_GOOD_CI, kubeconfigVar: true }),
        task: {
          id: 'serial',
          prompt: bi('Выкладки в staging не идут параллельно; пайплайн main зелёный.', 'Deployments to staging never run in parallel; the main pipeline is green.'),
          check: { when: (f) => !!pushedJob(f, 'deploy_staging')?.resourceGroup && deployOk(f) && web(f)?.image === tipImage(f) },
          docStep: 4,
          beyond: true,
          solutionTokens: ['resource_group', 'resource_group: staging'],
        },
      },
    },
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
      prompt: bi('Пайплайн main зелёный, а версия на staging не меняется уже неделю. Добейтесь, чтобы пайплайн выкладывал в Deployment `web` образ своего коммита.', 'The main pipeline is green, yet the version on staging has not changed for a week. Make the pipeline deploy the image of its own commit into the Deployment `web`.'),
      check: { when: (f) => deployOk(f) && !!tipImage(f) && web(f)?.image === tipImage(f) },
    },
  },
  { id: 'cicd-k8s.place.models', level: 'experienced', key: false, concepts: ['cicd.gitops-pull'], kind: 'quiz', item: { ...(quiz.find((q) => q.id === 'cicd-k8s.q.models') as QuizItem), id: 'cicd-k8s.place.q.models' } },
];

export const block: Block = {
  id: 'cicd-k8s',
  order: 65,
  title: bi('Выкладка в Kubernetes из CI', 'Deploying to Kubernetes from CI'),
  summary: bi('Пайплайн, который сам выкатывает версию в кластер: ключ узкого аккаунта, неизменяемый тег, ожидание и откат; push- и pull-модели.', 'A pipeline that rolls a version out to the cluster by itself: a narrow account’s key, an immutable tag, waiting and rolling back; the push and the pull model.'),
  checklistStep: '05',
  levels: {
    beginner: bi('Прошёл блоки CI/CD и Kubernetes', 'Has done the CI/CD and Kubernetes blocks'),
    intermediate: bi('Выкатывал в кластер руками', 'Has rolled out to a cluster by hand'),
    experienced: bi('Писал джобы с kubectl или helm', 'Has written jobs with kubectl or helm'),
  },
  hours: { beginner: 4, intermediate: 3, experienced: 2 },
  lessons: lessons.map((l) => l.id),
  sources: src([S.agent, S.deployment, S.gitops], [S.ruDeployment, S.ruCd]),
  docSources: ['help', 'docs.gitlab.com', 'kubernetes.io'],
  placement,
};
