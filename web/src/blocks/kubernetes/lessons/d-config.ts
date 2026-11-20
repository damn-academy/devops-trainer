// KM05, KM06, KM11: configuration and volumes, health and resources, Helm
// with a training chart (repo, template, install, --set and -f, history,
// rollback; values precedence and release Secrets for the experienced).

import { bi } from '../../../core/i18n';
import type { Facts, Lesson, QuizItem } from '../../../core/types';
import { deploymentOf, releaseOf, revisionsOf } from '../rbac-facts';
import { CONFIG_LAB, HEALTH_LAB, HELM_LAB } from '../setups';
import { R, S, src } from '../sources';

// ── KM05 ────────────────────────────────────────────────────────────────────

export const configQuiz: QuizItem[] = [
  {
    id: 'k8s.q.cfg.secret',
    kind: 'multi',
    concepts: ['k8s.secret'],
    prompt: bi('Что верно про Secret? Отметьте все верные ответы.', 'What is true about Secrets? Mark everything that is true.'),
    options: [
      { id: 'plain', text: bi('По умолчанию значения хранятся в etcd незашифрованными', 'By default the values are stored unencrypted in etcd'), correct: true },
      { id: 'read', text: bi('Любой, кто может читать объекты Secret в namespace, видит их значения', 'Anyone who may read Secrets in a namespace sees the values'), correct: true },
      { id: 'rbac', text: bi('Доступ к Secret можно ограничить правами доступа (RBAC), то есть правилами, кто какие объекты может читать и менять. Подробно о них рассказывает урок о доступе к кластеру', 'Access to Secrets can be restricted with access permissions (RBAC), that is, rules saying who may read and change which objects. The lesson on cluster access covers them in detail'), correct: true },
      { id: 'b64', text: bi('base64 шифрует значения', 'base64 encrypts the values'), why: bi('base64 только записывает байты текстом, и команда `base64 -d` вернёт исходное значение любому.', 'base64 is only a way to write bytes as text; `base64 -d` gives the original back to anyone.') },
      { id: 'file', text: bi('Secret нельзя смонтировать как файл', 'A Secret cannot be mounted as a file'), why: bi('Смонтировать можно, потому что том типа secret показывает каждый ключ отдельным файлом.', 'It can: a secret volume shows every key as a separate file.') },
    ],
    explain: bi('Шифрование хранилища etcd (по-английски encryption at rest) включают отдельно, а доступ к Secret ограничивают правами доступа, которые выдают пользователям и программам.', 'Encryption of the etcd store (encryption at rest) is enabled separately, and access to Secrets is restricted with access permissions granted to users and programs.'),
  },
  {
    id: 'k8s.q.cfg.env',
    kind: 'mcq',
    concepts: ['k8s.configmap', 'k8s.volume'],
    prompt: bi('Вы поменяли значение в ConfigMap. Контейнер получает это значение и как переменную окружения, и как файл тома. Что увидит работающий под?', 'You changed a value in a ConfigMap. The container gets it both as an environment variable and as a file in a volume. What does the running pod see?'),
    options: [
      { id: 'file', text: bi('Файл через некоторое время обновится, а переменная нет, пока под не перезапустят', 'The file updates after a while, the variable does not until the pod restarts'), correct: true },
      { id: 'both', text: bi('Обновится и то, и другое', 'Both update'), why: bi('Окружение процесса задаётся при запуске и потом не меняется, так устроен Linux.', 'A process environment is set at start and does not change later — that is how Linux works.') },
      { id: 'none', text: bi('Ничего не обновится', 'Nothing updates'), why: bi('Файлы тома kubelet обновляет при очередной синхронизации.', 'The kubelet refreshes the volume files at its next sync.') },
    ],
  },
  {
    id: 'k8s.q.cfg.missing',
    kind: 'mcq',
    concepts: ['k8s.configmap'],
    prompt: bi('Под ссылается на ConfigMap `web-config`, которого нет. Какой статус покажет под?', 'A pod refers to ConfigMap `web-config`, which does not exist. What will its status be?'),
    options: [
      { id: 'cfg', text: 'CreateContainerConfigError', correct: true },
      { id: 'crash', text: 'CrashLoopBackOff', why: bi('Контейнер даже не создан, потому что kubelet не может собрать для него окружение.', 'The container is not even created: the kubelet cannot build its environment.') },
      { id: 'pending', text: 'Pending', why: bi('Под уже назначен на узел, и застрял он на kubelet, а не на планировщике.', 'The pod is already assigned to a node; it is stuck at the kubelet, not at the scheduler.') },
    ],
  },
];

export const configLesson: Lesson = {
  id: 'k8s-1.config',
  block: 'k8s-1',
  title: bi('Как передать приложению настройки через ConfigMap, Secret и тома', 'Configuration: ConfigMaps, Secrets and volumes'),
  summary: bi('Как передать поду настройки отдельно от образа: переменные окружения и файлы, том emptyDir и почему base64 ничего не шифрует.', 'Settings separate from the image: environment variables and files, emptyDir, what base64 does not encrypt.'),
  introduces: ['k8s.configmap', 'k8s.secret', 'k8s.volume'],
  uses: ['k8s.pod', 'k8s.deployment', 'k8s.kubelet', 'k8s.etcd'],
  tier: 'core',
  minutes: 35,
  sources: src([S.configmap, S.secret], [R.configmap, R.secret]),
  sections: [
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Настройки отдельно от образа', 'Settings apart from the image'),
      body: bi(
        'Один и тот же образ должен работать и в тестовом, и в рабочем окружении, а меняются только настройки. В блоке о контейнерах вы передавали их флагом `-e`. В Kubernetes для этого есть [[k8s.configmap|ConfigMap]], объект «ключ — значение».\n\nПод получает ConfigMap двумя способами. Первый способ — **переменные окружения**: поле `envFrom: configMapRef` берёт все ключи сразу, а поле `env.valueFrom.configMapKeyRef` — один ключ. Второй способ — **файлы**: [[k8s.volume|том пода]] типа `configMap` показывает каждый ключ отдельным файлом в каталоге, куда вы этот том смонтировали (`volumeMounts.mountPath`). Разница важна: окружение процесса задаётся при запуске и больше не меняется, а файлы тома kubelet обновляет, когда меняется ConfigMap, с задержкой до минуты.\n\nТома бывают и другие. `emptyDir` — пустой каталог, который существует столько же, сколько под: перезапуск контейнера его не стирает, а удаление пода стирает. Это продолжение разговора о хранилище из блока о контейнерах: верхний слой overlay существует, пока существует контейнер, emptyDir — пока существует под, а данным, которые должны пережить под, нужен PersistentVolume.\n\n[[k8s.secret|Secret]] устроен так же, но предназначен для паролей и ключей. Значения в нём записаны в base64, а это **не шифрование**, а только способ записать байты текстом. По умолчанию Secret лежит в etcd в открытом виде, и от чужих глаз его защищают права на чтение и отдельно включаемое шифрование хранилища.\n\nЕсли под ссылается на ConfigMap или Secret, которого нет, kubelet не может собрать контейнер: под показывает статус `CreateContainerConfigError`, а в событиях пишется `configmap "…" not found`.',
        'The same image has to run in test and in production — only the settings change. In the containers block you passed them with `-e`. Kubernetes has a [[k8s.configmap|ConfigMap]] for them — a key-value object.\n\nA pod gets a ConfigMap in two ways. As **environment variables**: `envFrom: configMapRef` takes all the keys, `env.valueFrom.configMapKeyRef` one of them. As **files**: a [[k8s.volume|pod volume]] of type `configMap` shows each key as a separate file in the directory you mounted it at (`volumeMounts.mountPath`). The difference matters: a process environment is fixed at start, while the kubelet refreshes volume files when the ConfigMap changes (with a delay of up to a minute).\n\nThere are other volumes too. `emptyDir` is an empty directory that lives as long as the pod: a container restart does not wipe it, deleting the pod does. This continues the "storage" boundary of the containers block: the overlay upper layer lives with the container, emptyDir with the pod, and data that must outlive the pod needs a PersistentVolume.\n\nA [[k8s.secret|Secret]] works the same way, but for passwords and keys. Its values are written in base64 — that is **not encryption**, only a way to write bytes as text. By default a Secret lies in etcd in the clear; read permissions and separately enabled storage encryption protect it from other eyes.\n\nIf a pod refers to a ConfigMap or Secret that does not exist, the kubelet cannot assemble the container: the status is `CreateContainerConfigError`, and the events say `configmap "…" not found`.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: CONFIG_LAB,
      intro: bi('В файле `app.env` записаны настройки в формате KEY=value, а в файле `web-env.yaml` описан Deployment, который ждёт ConfigMap `web-config`.', '`app.env` holds settings as KEY=value; `web-env.yaml` is a Deployment that expects ConfigMap `web-config`.'),
      tasks: [
        {
          id: 'early',
          prompt: bi('Создайте Deployment из файла `web-env.yaml`, пока ConfigMap ещё не создан, и посмотрите, какой статус у пода.', 'Create the Deployment from `web-env.yaml` before the ConfigMap exists and look at the pod status.'),
          check: { stdout: /CreateContainerConfigError/ },
          chips: 'kubectl apply -f web-env.yaml && kubectl get pods',
          hints: { H1: bi('Через пару секунд kubelet сообщит о проблеме.', 'Give it a couple of seconds and the kubelet reports the problem.') },
        },
        {
          id: 'cm',
          prompt: bi('Создайте ConfigMap `web-config` из файла `app.env` так, чтобы каждая строка файла стала отдельным ключом.', 'Create ConfigMap `web-config` from the file `app.env` so that every line becomes a separate key.'),
          check: { when: "k8s.objects[kind=ConfigMap][metadata.name=web-config].data.GREETING='Привет' && k8s.objects[kind=ConfigMap][metadata.name=web-config].data.LOG_LEVEL=info", fail: [{ if: "k8s.objects[kind=ConfigMap][metadata.name=web-config].data['app.env']", say: bi('Получился один ключ app.env, в котором лежит весь файл. Нужен другой флаг, тот, что читает строки вида KEY=value.', 'You got one key app.env holding the whole file. Another flag is needed — the one that reads KEY=value lines.') }] },
          chips: 'kubectl create configmap web-config --from-env-file=app.env',
          concepts: ['k8s.configmap'],
          docRef: { page: 'help/kubectl-create-configmap', anchor: 'EXAMPLES', line: '--from-env-file' },
          hints: { H1: bi('У команды create configmap три источника данных: значение в командной строке, файл и env-файл.', 'create configmap has three sources: a literal, a file and an env file.'), H2: bi('В разделе Options справки ищите флаг, описание которого по-русски звучит так: «путь к файлу, из которого читаются строки вида ключ=значение». Флаг --from-file, наоборот, кладёт весь файл в один ключ.', 'In the Options section of the help look for the flag described as “the path to a file to read lines of key=val pairs from”. The --from-file flag, by contrast, puts the whole file into one key.') },
        },
        {
          id: 'env',
          prompt: bi('Когда под запустится, выведите изнутри него значение переменной GREETING.', 'Once the pod is running, print the value of the GREETING variable from inside it.'),
          check: { stdout: /^Привет\n?$/ },
          chips: 'kubectl exec deploy/web -- printenv GREETING',
          hints: { H1: bi('kubectl exec принимает и запись deploy/<имя>: тогда команда выполнится в одном из подов Deployment.', 'kubectl exec also takes deploy/<name> — it picks one of its pods.') },
        },
        {
          id: 'file',
          prompt: bi('Прочитайте тот же ключ как файл тома, смонтированного в каталог `/etc/web`.', 'Read the same key as a file of the volume mounted at `/etc/web`.'),
          check: { stdout: /^Привет$/ },
          chips: 'kubectl exec deploy/web -- cat /etc/web/GREETING',
          concepts: ['k8s.volume'],
          hints: { H1: bi('Каждый ключ ConfigMap становится файлом с тем же именем.', 'Every ConfigMap key is a file with the same name.') },
        },
        {
          id: 'secret',
          prompt: bi('Создайте Secret `db` с ключом `password` и значением `s3cr3t`, а потом посмотрите его в YAML: что там записано на самом деле?', 'Create Secret `db` with key `password` and value `s3cr3t`, then look at it in YAML: what is really there?'),
          check: { when: "k8s.objects[kind=Secret][metadata.name=db].data.password=czNjcjN0", stdout: /password: czNjcjN0/ },
          chips: 'kubectl create secret generic db --from-literal=password=s3cr3t && kubectl get secret db -o yaml',
          concepts: ['k8s.secret'],
          hints: { H1: bi('Вид Secret для произвольных данных называется generic.', 'The Secret kind for arbitrary data is generic.'), H2: bi('Команда записывается так: `kubectl create secret generic <имя> --from-literal=<ключ>=<значение>`, а YAML объекта напечатает команда `kubectl get secret <имя> -o yaml`.', 'The command looks like `kubectl create secret generic <name> --from-literal=<key>=<value>`, and `kubectl get secret <name> -o yaml` prints the object as YAML.') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Сделайте ConfigMap `web-config` неизменяемым, чтобы API-сервер отклонял любую попытку поменять его данные. В уроке об этом поле не рассказывали.', 'Make ConfigMap `web-config` immutable: any attempt to change its data must be rejected by the API server. The lesson did not cover it.'),
      ref: { page: 'explain/configmap' },
      terminal: {
        setup: { hostname: 'laptop', ext: { k8s: { manifests: ['apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: web-config\ndata:\n  GREETING: Привет\n'] } } },
        task: {
          id: 'immutable',
          prompt: bi('Сделайте так, чтобы ConfigMap `web-config` нельзя было изменить.', 'ConfigMap `web-config` cannot be changed.'),
          check: { when: 'k8s.objects[kind=ConfigMap][metadata.name=web-config].immutable=true' },
          docStep: 4,
          beyond: true,
          solutionTokens: ['immutable'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: configQuiz.map((q) => q.id) },
  ],
};

// ── KM06 ────────────────────────────────────────────────────────────────────

export const healthQuiz: QuizItem[] = [
  {
    id: 'k8s.q.h.both',
    kind: 'mcq',
    concepts: ['k8s.probe'],
    prompt: bi(
      'У пода настроена только проверка готовности (readiness probe) на `/ready`. Приложение зависло, то есть процесс работает, но на запросы больше не отвечает. Что сделает Kubernetes?',
      'A pod has only a readiness probe on `/ready`. The application hung: the process runs but no longer answers requests. What does Kubernetes do?',
    ),
    options: [
      { id: 'out', text: bi('Уберёт под из EndpointSlice, и запросы на него перестанут идти, но перезапускать его никто не будет, и под так и останется неготовым', 'Remove the pod from the EndpointSlice so requests stop going to it, but nobody restarts it, and the pod stays not ready'), correct: true },
      { id: 'restart', text: bi('Перезапустит контейнер, потому что проверка готовности не прошла', 'Restart the container, because the readiness probe failed'), why: bi('Проверка готовности решает только, получает ли под запросы. Перезапускает контейнер проверка жизнеспособности (liveness probe), а её здесь нет, поэтому зависшее, но «живое» приложение никто не перезапустит.', 'The readiness probe decides only whether the pod gets requests. The liveness probe restarts a container, and there is none here, so a hung but “alive” application is restarted by nobody.') },
      { id: 'enough', text: bi('Ничего особенного не случится, потому что при проверке готовности проверка жизнеспособности не нужна', 'Nothing special: with a readiness probe, a liveness probe is not needed'), why: bi('Проверки отвечают на разные вопросы. Готовность говорит, можно ли сейчас слать поду запросы, а жизнеспособность — пора ли его перезапустить. Без второй под будет висеть неготовым, пока его не удалит человек.', 'The probes answer different questions. Readiness says whether requests may go to the pod now, liveness whether it is time to restart it. Without the second the pod hangs not ready until a person deletes it.') },
    ],
  },
  {
    id: 'k8s.q.h.reason',
    kind: 'mcq',
    key: true,
    concepts: ['k8s.resources'],
    prompt: bi('Контейнер превысил limits.memory. Что будет написано в `Last State` в выводе `kubectl describe pod`?', 'A container exceeded limits.memory. What does `kubectl describe pod` show in `Last State`?'),
    options: [
      { id: 'oom', text: 'Terminated, Reason: OOMKilled, Exit Code: 137', correct: true },
      { id: 'evicted', text: 'Evicted', why: bi('Evicted пишется, когда kubelet выселяет под из-за нехватки памяти на всём узле. Здесь же ядро завершило процесс за превышение лимита его cgroup.', 'Evicted is when the kubelet evicts a pod because the whole node is short of memory. Here the kernel killed the process for exceeding its cgroup limit.') },
      { id: 'error', text: 'Error, Exit Code: 1', why: bi('Код 1 означает, что программа завершилась сама с ошибкой. Код 137 — это 128 + 9, то есть процесс завершён сигналом KILL.', 'Code 1 means the program exited by itself with an error. 137 = 128 + 9: the process was killed with signal KILL.') },
    ],
    explain: bi('limits.memory превращается в memory.max в cgroup контейнера. При превышении процесс завершает OOM killer ядра, а kubelet только видит результат и перезапускает контейнер.', 'limits.memory is memory.max in the container cgroup; exceeding it brings the kernel OOM killer, and the kubelet only sees the result and restarts the container.'),
  },
  {
    id: 'k8s.q.h.probes',
    kind: 'match',
    concepts: ['k8s.probe'],
    prompt: bi('Сопоставьте проверку контейнера с тем, что делает kubelet, когда она не проходит.', 'Match the probe with what the kubelet does when it fails.'),
    pairs: [
      { id: 'live', left: 'livenessProbe', right: bi('перезапускает контейнер', 'restarts the container') },
      { id: 'ready', left: 'readinessProbe', right: bi('убирает под из EndpointSlice, не трогая процесс', 'removes the pod from the EndpointSlice without touching the process'), why: bi('Неготовый под продолжает работать, он только не получает запросов.', 'A not-ready pod lives on — it just gets no traffic.') },
      { id: 'startup', left: 'startupProbe', right: bi('откладывает остальные проверки, пока приложение запускается', 'holds the other probes back while the application starts') },
    ],
  },
  {
    id: 'k8s.q.h.requests',
    kind: 'mcq',
    concepts: ['k8s.resources', 'k8s.scheduler'],
    prompt: bi('У пода requests.memory: 64Mi и limits.memory: 1Gi, а потребляет он 700 МБ. Какое число учтёт планировщик при выборе узла?', 'A pod has requests.memory: 64Mi, limits.memory: 1Gi, and it uses 700 MB. What does the scheduler count when picking a node?'),
    options: [
      { id: 'req', text: bi('64Mi, то есть только requests', '64Mi — only the requests'), correct: true },
      { id: 'use', text: bi('700 МБ, то есть реальное потребление', '700 MB — the real usage'), why: bi('Планировщик не смотрит на потребление, и поэтому узлы переполняются, если requests занижены.', 'The scheduler does not look at usage; that is how nodes get overfull when requests are too low.') },
      { id: 'lim', text: bi('1Gi, то есть limits', '1Gi, that is, the limits'), why: bi('limits соблюдает ядро на узле, а планировщику они не нужны.', 'The kernel on the node enforces limits; the scheduler does not need them.') },
    ],
  },
  {
    id: 'k8s.q.h.crash',
    kind: 'predict-output',
    concepts: ['k8s.crashloop'],
    prompt: bi('Контейнер аварийно завершается через три секунды после запуска. Что покажет столбец STATUS через полминуты?', 'A container crashes 3 seconds after it starts. What does STATUS show half a minute later?'),
    command: 'kubectl run crash --image=trainer/web:2.0 >/dev/null; cluster ff 30s >/dev/null; kubectl get pod crash --no-headers',
    setup: { hostname: 'laptop', ext: { k8s: {} } },
    options: [
      { id: 'crash', text: 'CrashLoopBackOff', correct: true },
      { id: 'error', text: 'Error', why: bi('Error виден только в момент падения, а большую часть времени kubelet ждёт перед следующим перезапуском, и это и есть CrashLoopBackOff.', 'Error flashes at the moment of the crash; most of the time the kubelet waits before the restart — that is CrashLoopBackOff.') },
      { id: 'running', text: 'Running', why: bi('Running под показывает три секунды после каждого перезапуска, а потом контейнер снова аварийно завершается.', 'Running lasts three seconds after each restart, then the container crashes again.') },
    ],
  },
];

export const healthLesson: Lesson = {
  id: 'k8s-1.health',
  block: 'k8s-1',
  title: bi('Как кластер проверяет здоровье контейнера и делит между контейнерами ресурсы', 'How the cluster checks a container’s health and shares resources between containers'),
  summary: bi('Проверки жизнеспособности, готовности и запуска; requests для планировщика и limits для ядра; что означают CrashLoopBackOff и OOMKilled.', 'liveness, readiness and startup; requests for the scheduler and limits for the kernel; CrashLoopBackOff and OOMKilled.'),
  introduces: ['k8s.probe', 'k8s.resources', 'k8s.crashloop'],
  uses: ['k8s.kubelet', 'k8s.scheduler', 'k8s.endpointslice', 'k8s.service'],
  tier: 'core',
  minutes: 40,
  sources: src([S.probes, S.resources, S.lifecycle], [R.probes, R.cheatsheet]),
  sections: [
    {
      id: 'probes',
      kind: 'text',
      step: 'explain',
      title: bi('Жив ли контейнер, готов ли он и запустился ли', 'Alive, ready, started'),
      body: bi(
        'Запущенный процесс ещё не означает, что приложение работает. kubelet умеет сам спрашивать его об этом, и такие вопросы называются [[k8s.probe|проверками контейнера (probes)]]: это HTTP-запрос, TCP-подключение или команда внутри контейнера.\n\n- **Проверка готовности (readinessProbe)** отвечает на вопрос, можно ли отправлять поду запросы. Если она не проходит, процесс никто не трогает: под получает `ready: false` и выпадает из EndpointSlice, и Service перестаёт отправлять ему запросы. Без этой проверки под получает запросы, как только запущен процесс, даже если приложение ещё прогревается.\n- **Проверка жизнеспособности (livenessProbe)** отвечает на вопрос, жив ли контейнер. Если она не проходит `failureThreshold` раз подряд, kubelet перезапускает контейнер. Привязывать её к внешней зависимости, например к базе данных, опасно: база перестанет отвечать, и перезапустятся все поды.\n- **Проверка запуска (startupProbe)** нужна приложениям, которые долго запускаются: пока она не прошла, остальные проверки не выполняются.\n\nКогда контейнер аварийно завершается, kubelet перезапускает его, и паузы между перезапусками растут: 10 секунд, 20, 40 и так далее, до пяти минут. Пока kubelet ждёт, под показывает статус [[k8s.crashloop|CrashLoopBackOff]], а счётчик RESTARTS растёт. Причину ищут в логах **предыдущего** запуска, потому что текущий только что начался.',
        'A process that runs does not yet mean the application works. The kubelet can ask it itself: these are [[k8s.probe|probes]], an HTTP request, a TCP connection or a command inside the container.\n\n- **readinessProbe** answers "may traffic be sent". A failure does not touch the process: the pod gets `ready: false` and leaves the EndpointSlice — the Service stops sending to it. Without readiness a pod gets traffic as soon as its process starts, even if the application is still warming up.\n- **livenessProbe** asks "is it alive". `failureThreshold` failures in a row — the kubelet restarts the container. Pointing it at a dependency (a database) is dangerous: the database goes down — every pod restarts.\n- **startupProbe** is for applications that start slowly: until it passes, the other probes do not run.\n\nWhen a container crashes, the kubelet restarts it — with a growing pause of 10 s, 20 s, 40 s… up to 5 minutes. While it waits, the status is [[k8s.crashloop|CrashLoopBackOff]] and the RESTARTS counter grows. The cause is in the logs of the **previous** run: the current one has only just begun.',
      ),
    },
    {
      id: 'resources',
      kind: 'text',
      step: 'explain',
      title: bi('requests нужны планировщику, а limits нужны ядру', 'requests serve the scheduler, limits serve the kernel'),
      body: bi(
        'Для каждого контейнера можно задать [[k8s.resources|requests и limits]] по процессору и памяти. Это два разных числа для двух разных потребителей.\n\n**requests** говорят, сколько ресурсов контейнер просит. По ним работает планировщик: под попадёт на узел, только если запросы подов, которые там уже работают, вместе с запросом нового пода помещаются в память и процессор узла, отданные подам (allocatable). Ядро запрос памяти никак не ограничивает.\n\n**limits** задают потолок, и следит за ним ядро с помощью тех самых cgroup из блока Linux. `limits.memory: 256Mi` превращается в `memory.max = 268435456` в cgroup контейнера. Если контейнер превысит этот потолок, OOM killer ядра завершит процесс, и в `kubectl describe` появится `Reason: OOMKilled` и код 137. `limits.cpu: 500m` превращается в `cpu.max = 50000 100000`, то есть 50 мс процессорного времени из каждых 100 мс. Превышение по процессору процесс не завершает, а только притормаживает (throttling).\n\nИз сочетания requests и limits получается класс качества обслуживания (QoS): Guaranteed, когда requests равны limits у всех контейнеров, Burstable, когда задано хоть что-то, и BestEffort, когда не задано ничего. Когда на узле не хватает памяти, kubelet выселяет сначала те поды, которые потребляют больше, чем запросили в requests, и учитывает их приоритет. У подов BestEffort requests нет вовсе, поэтому они обычно оказываются первыми, а поды Guaranteed последними. Подробно порядок описан на странице документации [Node-pressure Eviction](https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/).',
        'Every container can have [[k8s.resources|requests and limits]] for CPU and memory. They are two different numbers for two different consumers.\n\n**requests** is how much the container asks for. The scheduler plans by them: a pod goes onto a node only if the sum of the requests of the pods already there plus its own fits into allocatable. The kernel does not limit memory by requests.\n\n**limits** is the ceiling, and the kernel enforces it — the very cgroups of the Linux block. `limits.memory: 256Mi` turns into `memory.max = 268435456` in the container cgroup. Exceed it and the OOM killer kills the process: `kubectl describe` shows `Reason: OOMKilled`, code 137. `limits.cpu: 500m` is `cpu.max = 50000 100000`: 50 ms out of every 100 ms. Exceeding CPU does not kill, it slows down (throttling).\n\nThe combination gives a QoS class: Guaranteed (requests = limits everywhere), Burstable (something is set), BestEffort (nothing). When a node runs short of memory, the kubelet first evicts the pods that use more than they asked for in requests, and takes their priority into account. BestEffort pods have no requests at all, so they usually come first, and Guaranteed pods last. The order is described in detail on the [Node-pressure Eviction](https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/) page.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: HEALTH_LAB,
      intro: bi('В кластере работают под `crash`, контейнер которого раз за разом аварийно завершается, и Deployment `shop` с Service `shop`, на который не идут запросы. Ещё есть файл `hog.yaml` с подом, который занимает 300 МБ памяти.', 'The cluster has: pod `crash`, which crashes; Deployment `shop` with Service `shop` that gets no traffic; the file `hog.yaml` — a pod that eats 300 MB.'),
      tasks: [
        {
          id: 'previous',
          prompt: bi('Под `crash` в состоянии CrashLoopBackOff. Найдите в справке `kubectl logs`, как прочитать вывод предыдущего запуска, и сохраните последнюю строку этого вывода в файл `~/crash.txt`.', 'Pod `crash` is in CrashLoopBackOff. Find in the `kubectl logs` help how to read the output of the previous run, and save its last line to `~/crash.txt`.'),
          check: { when: "files['/home/learner/crash.txt'].text~'panic: config not found'" },
          chips: 'kubectl logs crash --previous --tail=1 > crash.txt',
          concepts: ['k8s.crashloop'],
          docRef: { page: 'help/kubectl-logs', anchor: 'OPTIONS', line: '--previous' },
          docStep: 3,
          hints: { H1: bi('Флаг для «предыдущего экземпляра контейнера» описан в разделе Options, а одну последнюю строку оставит флаг --tail.', 'The flag for "the previous instance of the container" is in Options; --tail gives a one-line tail.'), H2: bi('Нужная строка справки по-русски звучит так: «если флаг указан, напечатать журнал предыдущего экземпляра контейнера в поде». Вывод сохраните в файл перенаправлением `> ~/crash.txt`.', 'The help line you need reads: “If true, print the logs for the previous instance of the container in a pod if it exists.” Save the output to the file with the redirection `> ~/crash.txt`.') },
        },
        {
          id: 'ready',
          prompt: bi('Service `shop` не получает запросов, потому что поды находятся в состоянии Running, но не готовы. Найдите причину и почините Deployment так, чтобы оба пода стали готовыми.', 'Service `shop` gets no traffic: the pods are Running but not Ready. Find the cause and fix the Deployment so that both pods become ready.'),
          check: { when: 'k8s.deployments[name=shop].ready=2 && k8s.services[name=shop].endpoints=2' },
          chips: 'kubectl describe pod -l app=shop | grep Readiness',
          concepts: ['k8s.probe'],
          hints: {
            H1: bi('Посмотрите события пода: kubelet пишет туда, почему проверка не прошла.', 'Look at the pod events: the kubelet writes why the probe failed.'),
            H2: bi('Проверка обращается к порту 8080, а приложение слушает порт 80. Поменяйте порт проверки в шаблоне Deployment командой `kubectl patch deploy shop -p \'{"spec":{"template":{"spec":{"containers":[{"name":"shop","readinessProbe":{"httpGet":{"port":80}}}]}}}}\'`.', 'The probe knocks on port 8080, while the application listens on port 80. Change the probe port in the Deployment template with `kubectl patch deploy shop -p \'{"spec":{"template":{"spec":{"containers":[{"name":"shop","readinessProbe":{"httpGet":{"port":80}}}]}}}}\'`.'),
            H3: bi('Выполните `kubectl patch deploy shop -p \'{"spec":{"template":{"spec":{"containers":[{"name":"shop","readinessProbe":{"httpGet":{"port":80}}}]}}}}\'`: контейнеры в шаблоне сопоставляются по имени.', '`kubectl patch deploy shop -p \'{"spec":{"template":{"spec":{"containers":[{"name":"shop","readinessProbe":{"httpGet":{"port":80}}}]}}}}\'` — containers merge by name.'),
          },
        },
        {
          id: 'oom',
          prompt: bi('Запустите под из файла `hog.yaml` (он занимает 300 МБ при лимите 256Mi) и запишите в файл `~/exit.txt` код, с которым ядро завершило контейнер.', 'Run `hog.yaml` (it eats 300 MB with a 256Mi limit) and write into `~/exit.txt` the code the kernel ended the container with.'),
          check: { when: "files['/home/learner/exit.txt'].text~'137' && k8s.objects[kind=Pod][metadata.name=hog].status.containerStatuses.lastState.terminated.reason=OOMKilled" },
          chips: 'kubectl apply -f hog.yaml && kubectl describe pod hog',
          concepts: ['k8s.resources'],
          hints: { H1: bi('В выводе describe найдите Last State, а в нём Reason и Exit Code.', 'In describe look for Last State: Reason and Exit Code.'), H2: bi('Найденное число запишите в файл командой `echo <код> > ~/exit.txt`.', 'Write the number you found into the file with `echo <code> > ~/exit.txt`.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: healthQuiz.map((q) => q.id) },
  ],
};

// ── KM11 (the idea) ──────────────────────────────────────────────────────────

export const helmQuiz: QuizItem[] = [
  {
    id: 'k8s.q.helm.values',
    kind: 'mcq',
    concepts: ['k8s.helm', 'k8s.chart'],
    prompt: bi('В шаблоне чарта записано `replicas: {{ .Values.replicaCount }}`. В файле `values.yaml` стоит `replicaCount: 2`, а в файле `prod.yaml` стоит `replicaCount: 4`. Что напечатает команда `helm template blog ./chart -f prod.yaml` на месте этой строки?', 'The chart template says `replicas: {{ .Values.replicaCount }}`. `values.yaml` has `replicaCount: 2`, and `prod.yaml` has `replicaCount: 4`. What does `helm template blog ./chart -f prod.yaml` print in place of this line?'),
    options: [
      { id: 'four', text: 'replicas: 4', correct: true },
      { id: 'two', text: 'replicas: 2', why: bi('Значения из `values.yaml` служат значениями по умолчанию, а файл, переданный флагом `-f`, их перекрывает.', 'The values in `values.yaml` are the defaults, and a file passed with `-f` overrides them.') },
      { id: 'raw', text: 'replicas: {{ .Values.replicaCount }}', why: bi('Команда `helm template` для того и нужна, чтобы подставить значения и показать готовые манифесты, которые потом уйдут в API.', 'This is exactly what `helm template` is for: it fills in the values and shows the finished manifests that would go to the API.') },
    ],
    explain: bi('Helm берёт значения по умолчанию из `values.yaml`, накладывает поверх них файлы из флагов `-f` по порядку и только потом подставляет результат в шаблоны. Поэтому один чарт с разными файлами значений даёт тестовое и рабочее окружение.', 'Helm takes the defaults from `values.yaml`, lays the `-f` files over them in order, and only then fills the templates. That is why one chart with different values files gives the test and the production environment.'),
  },
  {
    id: 'k8s.q.helm.rollback',
    kind: 'mcq',
    concepts: ['k8s.helm'],
    prompt: bi('У релиза `blog` ревизия 1 соответствует установке, а ревизия 2 — неудачному обновлению. Что создаст команда `helm rollback blog 1`?', 'Release `blog`: revision 1 — install, revision 2 — a failed upgrade. What does `helm rollback blog 1` create?'),
    options: [
      { id: 'three', text: bi('Ревизию 3 с содержимым ревизии 1', 'Revision 3 with the contents of revision 1'), correct: true },
      { id: 'delete', text: bi('Удалит ревизию 2 и вернёт номер 1', 'Delete revision 2 and go back to number 1'), why: bi('История в Helm только растёт, потому что откат создаёт новую ревизию, так же как у Deployment.', 'History in Helm only grows: a rollback is a new revision, as with a Deployment.') },
    ],
  },
  {
    id: 'k8s.q.helm.where',
    kind: 'mcq',
    concepts: ['k8s.helm', 'k8s.chart'],
    prompt: bi('Где Helm 3 хранит историю релиза?', 'Where does Helm 3 keep the history of a release?'),
    options: [
      { id: 'secret', text: bi('В объектах Secret с именами sh.helm.release.v1.<релиз>.v<N> в namespace релиза', 'In Secrets sh.helm.release.v1.<release>.v<N> in the release namespace'), correct: true },
      { id: 'tiller', text: bi('В сервере Tiller в namespace kube-system', 'In the Tiller server in kube-system'), why: bi('Tiller был в Helm 2 и удалён в Helm 3. Теперь Helm работает только как клиент, а состояние хранится в кластере.', 'Tiller was in Helm 2 and removed in Helm 3: Helm is now only a client, and the state lives in the cluster.') },
      { id: 'local', text: bi('В каталоге ~/.helm на компьютере того, кто устанавливал релиз', 'In ~/.helm on the machine of whoever installed it'), why: bi('Тогда коллега не увидел бы вашего релиза, а история хранится в самом кластере.', 'Then a colleague would not see your release; the history is kept in the cluster itself.') },
    ],
  },
  {
    id: 'k8s.q.helm.undo',
    kind: 'mcq',
    concepts: ['k8s.helm-release'],
    prompt: bi('Релиз `shop` поставлен Helm, и последнее обновление до образа 2.0 сломало сайт. Дежурный вернул старую версию командой `kubectl rollout undo deployment/shop`. Что покажет `helm history shop`?', 'Release `shop` was installed by Helm, and the last upgrade to image 2.0 broke the site. The on-call engineer brought the old version back with `kubectl rollout undo deployment/shop`. What does `helm history shop` show?'),
    options: [
      { id: 'stale', text: bi('Последней ревизией по-прежнему записано обновление до 2.0, потому что kubectl изменил Deployment мимо Helm', 'The upgrade to 2.0 is still recorded as the latest revision, because kubectl changed the Deployment behind Helm’s back'), correct: true },
      { id: 'new', text: bi('Новую ревизию с описанием Rollback', 'A new revision described as Rollback'), why: bi('Ревизии записывает только сам Helm, а kubectl о релизах ничего не знает. Поэтому откатывают релиз командой `helm rollback`, иначе следующий `helm upgrade --reuse-values` снова выложит 2.0.', 'Only Helm itself writes revisions, and kubectl knows nothing of releases. That is why a release is rolled back with `helm rollback`; otherwise the next `helm upgrade --reuse-values` rolls 2.0 out again.') },
      { id: 'gone', text: bi('Ничего, потому что релиз перестал существовать', 'Nothing, because the release ceased to exist'), why: bi('Релиз хранится в Secret и никуда не делся: kubectl поменял только шаблон Deployment.', 'The release is kept in Secrets and has not gone anywhere: kubectl changed only the Deployment template.') },
    ],
  },
];

const shopRelease = (f: Facts | undefined) => releaseOf(f, 'default', 'shop');
const lastOut = (f: Facts) => ((f.term as { main?: { line: string; out: string }[] } | undefined)?.main ?? []).at(-1);

export const helmLesson: Lesson = {
  id: 'k8s-1.helm',
  block: 'k8s-1',
  title: bi('Как Helm собирает манифесты в пакет', 'Helm: manifests as a package'),
  summary: bi(
    'Что такое чарт, values и релиз. На учебном кластере вы подключите репозиторий, прочитаете манифесты командой `helm template`, установите релиз, поменяете параметры флагом `--set` и файлом `-f`, посмотрите историю ревизий и откатите неудачное обновление.',
    'What a chart, values and a release are. On the training cluster you add a repository, read the manifests with `helm template`, install a release, change parameters with `--set` and an `-f` file, look at the revision history and roll back a failed upgrade.',
  ),
  introduces: ['k8s.helm', 'k8s.chart', 'k8s.helm-values', 'k8s.helm-release'],
  uses: ['k8s.deployment', 'k8s.service', 'k8s.configmap', 'k8s.secret', 'k8s.revision', 'k8s.namespace'],
  tier: 'core',
  minutes: 40,
  sources: src([S.helm, S.helmCharts], [R.helm]),
  sections: [
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Зачем манифестам пакет', 'Why a package'),
      body: bi(
        'Ваш сервис — это уже пять или шесть объектов: Deployment, Service, ConfigMap, Secret и правило входа. Для тестового и для рабочего окружения они почти одинаковые: отличаются число реплик, домен и образ. Если копировать YAML и править его руками, окружения рано или поздно разойдутся. [[k8s.helm|Helm]] решает эту задачу так же, как пакетный менеджер.\n\n[[k8s.chart|Чарт]] — это каталог, в котором лежат `Chart.yaml` с именем и версией, `values.yaml` с параметрами по умолчанию и `templates/` с манифестами, куда подставляются значения, например `{{ .Values.replicaCount }}`. Параметры чарта называются [[k8s.helm-values|values]]. Свои значения передают файлом через флаг `-f` или по одному флагом `--set`, и Helm накладывает их поверх значений по умолчанию. Команда `helm install shop training/podinfo -f prod.yaml` подставляет значения, получает обычные манифесты и отправляет их в API, а дальше работают те же контроллеры, что и при `kubectl apply`.\n\nУстановленный экземпляр чарта называется [[k8s.helm-release|релизом]], и у релиза есть своё имя, например shop. Каждая команда `install`, `upgrade` и `rollback` создаёт новую ревизию релиза, и история хранится в самом кластере, в объектах Secret `sh.helm.release.v1.shop.v1`, `…v2` и так далее. Команда `helm rollback shop 1` создаёт новую ревизию с содержимым первой, так что история только растёт, как у Deployment. Команда `helm template` строит манифесты, ничего не устанавливая, и так удобно проверять, что получится.',
        'Your service is already five or six objects: a Deployment, a Service, a ConfigMap, a Secret, an ingress rule. For test and for production they are almost the same: other replicas, another domain, another image. Copying YAML and editing it by hand leads to copies that quietly diverge. [[k8s.helm|Helm]] solves this as a package manager.\n\nA [[k8s.chart|chart]] is a directory: `Chart.yaml` (name and version), `values.yaml` (default parameters) and `templates/` (manifests with placeholders like `{{ .Values.replicaCount }}`). The chart’s parameters are called [[k8s.helm-values|values]]. Your own values come in a file with `-f` or one by one with `--set`, and Helm lays them over the defaults. `helm install shop training/podinfo -f prod.yaml` fills in the values, gets ordinary manifests and sends them to the API; from there the same controllers work as after `kubectl apply`.\n\nAn installed instance of a chart is a [[k8s.helm-release|release]], and a release has a name of its own, such as shop. Every `install`, `upgrade` and `rollback` creates a new revision of the release, and the history lives in the cluster itself, in the Secrets `sh.helm.release.v1.shop.v1`, `…v2` and so on. `helm rollback shop 1` creates a new revision with the contents of the first, so the history only grows, as with a Deployment. `helm template` renders the manifests without installing anything, which is handy for checking what you will get.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: HELM_LAB,
      intro: bi(
        'В учебном кластере работает команда `helm`, а учебные чарты лежат в репозитории по адресу https://charts.example.test. Чарт podinfo из этого репозитория запускает веб-сервер из образа `trainer/web` с Deployment и Service. В файле `prod.yaml` записаны настройки рабочего окружения магазина. Если запутаетесь, перезагрузите страницу, и кластер вернётся в исходное состояние.',
        'The `helm` command works in the training cluster, and the training charts are in the repository at https://charts.example.test. Its podinfo chart runs a web server from the image `trainer/web` with a Deployment and a Service. `prod.yaml` holds the settings of the shop’s production environment. If you get lost, reload the page, and the cluster returns to where it started.',
      ),
      tasks: [
        {
          id: 'repo',
          prompt: bi('Подключите репозиторий учебных чартов под именем `training` и найдите в нём чарт podinfo.', 'Add the training chart repository under the name `training` and find the podinfo chart in it.'),
          check: { stdout: /training\/podinfo\s+1\.0\.0/, fail: [{ if: (f) => /repo training not found|no repositories/.test(lastOut(f)?.out ?? ''), say: bi('Репозиторий training ещё не подключён. Сначала выполните `helm repo add training https://charts.example.test`.', 'Repository training is not added yet. First run `helm repo add training https://charts.example.test`.') }] },
          chips: 'helm repo add training https://charts.example.test && helm search repo training',
          concepts: ['k8s.helm', 'k8s.chart'],
          hints: {
            H1: bi('Репозиторий подключают командой `helm repo add` с именем и адресом, а чарты в нём ищут командой `helm search repo`.', 'A repository is added with `helm repo add` with a name and an address, and its charts are found with `helm search repo`.'),
            H2: bi('Выполните `helm repo add training https://charts.example.test`, а затем `helm search repo training`. В выводе будут имена чартов вида training/podinfo и их версии.', 'Run `helm repo add training https://charts.example.test`, then `helm search repo training`. The output lists charts named like training/podinfo with their versions.'),
            H3: bi('Адрес репозитория написан над терминалом: https://charts.example.test. Имя `training` вы выбираете сами, и под этим именем Helm будет показывать чарты.', 'The repository address is written above the terminal: https://charts.example.test. You choose the name `training` yourself, and Helm shows the charts under it.'),
          },
        },
        {
          id: 'template',
          prompt: bi('Ничего не устанавливая в кластер, посмотрите, какие манифесты получатся из чарта `training/podinfo` для релиза `shop` с двумя репликами.', 'Without installing anything into the cluster, look at the manifests the chart `training/podinfo` gives for release `shop` with two replicas.'),
          check: {
            stdout: /kind: Deployment[\s\S]*name: shop[\s\S]*replicas: 2/,
            fail: [
              { if: (f) => /^helm (install|upgrade)\b/.test(lastOut(f)?.line ?? ''), say: bi('Команды install и upgrade уже отправили манифесты в кластер. Посмотреть их, ничего не меняя, позволяет `helm template`.', 'install and upgrade have already sent the manifests to the cluster. `helm template` lets you look at them without changing anything.') },
              { if: (f) => /replicas: 1\b/.test(lastOut(f)?.out ?? ''), say: bi('Манифесты получены, но с одной репликой, как в значениях по умолчанию. Передайте число реплик флагом `--set replicaCount=2`.', 'You got the manifests, but with one replica, as in the defaults. Pass the replica count with `--set replicaCount=2`.') },
            ],
          },
          chips: 'helm template shop training/podinfo --set replicaCount=2',
          concepts: ['k8s.helm-values'],
          hints: {
            H1: bi('Сначала посмотрите, какие параметры у чарта есть: `helm show values training/podinfo`. Число реплик называется replicaCount.', 'First see which parameters the chart has: `helm show values training/podinfo`. The replica count is called replicaCount.'),
            H2: bi('Выполните `helm template shop training/podinfo --set replicaCount=2`. Helm напечатает Service и Deployment, а в Deployment будет строка `replicas: 2`.', 'Run `helm template shop training/podinfo --set replicaCount=2`. Helm prints a Service and a Deployment, and the Deployment has the line `replicas: 2`.'),
            H3: bi('Если вы нечаянно выполнили `helm install`, удалите релиз командой `helm uninstall shop`, а потом повторите `helm template`.', 'If you ran `helm install` by mistake, remove the release with `helm uninstall shop`, then repeat `helm template`.'),
          },
        },
        {
          id: 'install',
          prompt: bi('Установите релиз `shop` из того же чарта с двумя репликами и дождитесь, пока оба пода будут готовы.', 'Install release `shop` from the same chart with two replicas and wait until both pods are ready.'),
          check: {
            when: (f) => shopRelease(f)?.status === 'deployed' && shopRelease(f)?.values?.replicaCount === 2 && (deploymentOf(f, 'default', 'shop')?.ready ?? 0) >= 2,
            fail: [
              { if: (f) => !shopRelease(f) && !!deploymentOf(f, 'default', 'shop'), say: bi('Deployment `shop` создан, но не через Helm, поэтому релиза нет, и Helm о нём ничего не знает. Удалите его и установите чарт командой `helm install`.', 'Deployment `shop` exists, but not through Helm, so there is no release, and Helm knows nothing of it. Delete it and install the chart with `helm install`.') },
              { if: (f) => !!shopRelease(f) && shopRelease(f)?.values?.replicaCount !== 2, say: bi('Релиз установлен, но без вашего значения replicaCount, и реплика в нём одна. Исправьте релиз командой `helm upgrade shop training/podinfo --set replicaCount=2`.', 'The release is installed, but without your replicaCount, so it has one replica. Fix it with `helm upgrade shop training/podinfo --set replicaCount=2`.') },
            ],
          },
          chips: 'helm install shop training/podinfo --set replicaCount=2',
          concepts: ['k8s.helm-release'],
          hints: {
            H1: bi('У `helm install` те же аргументы, что у `helm template`: имя релиза, чарт и значения.', '`helm install` takes the same arguments as `helm template`: the release name, the chart and the values.'),
            H2: bi('Выполните `helm install shop training/podinfo --set replicaCount=2`, а затем `kubectl get pods` и `helm list`.', 'Run `helm install shop training/podinfo --set replicaCount=2`, then `kubectl get pods` and `helm list`.'),
            H3: bi('Если Helm ответил `cannot re-use a name that is still in use`, релиз уже установлен. Тогда поправьте его командой `helm upgrade shop training/podinfo --set replicaCount=2`.', 'If Helm answered `cannot re-use a name that is still in use`, the release is installed already. Then fix it with `helm upgrade shop training/podinfo --set replicaCount=2`.'),
          },
        },
        {
          id: 'values-file',
          prompt: bi('Обновите релиз `shop` с настройками из файла `prod.yaml` и посмотрите, с какими значениями он теперь работает.', 'Upgrade release `shop` with the settings from `prod.yaml` and look at which values it runs with now.'),
          check: {
            when: (f) => (shopRelease(f)?.revision ?? 0) >= 2 && shopRelease(f)?.status === 'deployed' && shopRelease(f)?.values?.replicaCount === 3 && String(shopRelease(f)?.values?.image?.tag) === '1.1' && deploymentOf(f, 'default', 'shop')?.image === 'trainer/web:1.1' && (deploymentOf(f, 'default', 'shop')?.ready ?? 0) >= 3,
            fail: [
              { if: (f) => (shopRelease(f)?.revision ?? 0) >= 2 && String(shopRelease(f)?.values?.image?.tag) !== '1.1', say: bi('Релиз обновлён без файла, поэтому в его значениях нет образа 1.1. Передайте файл флагом `-f prod.yaml`.', 'The release was upgraded, but without the file: its values lack image 1.1. Pass the file with `-f prod.yaml`.') },
              { if: (f) => shopRelease(f)?.revision === 1, say: bi('У релиза пока одна ревизия. Новую создаёт команда `helm upgrade`.', 'The release still has one revision. `helm upgrade` creates a new one.') },
            ],
          },
          chips: 'helm upgrade shop training/podinfo -f prod.yaml && helm get values shop',
          concepts: ['k8s.helm-values', 'k8s.helm-release'],
          hints: {
            H1: bi('Файл значений передают командам `helm upgrade` и `helm install` флагом `-f`.', 'A values file is passed to `helm upgrade` and `helm install` with `-f`.'),
            H2: bi('Выполните `helm upgrade shop training/podinfo -f prod.yaml`, а затем `helm get values shop`. Обратите внимание, что значения replicaCount=2 из прошлого задания в списке нет: каждый upgrade собирает значения заново из того, что передано в этот раз.', 'Run `helm upgrade shop training/podinfo -f prod.yaml`, then `helm get values shop`. Note that replicaCount=2 from the previous task is not in the list: every upgrade gathers the values anew from what is passed this time.'),
            H3: bi('Чтобы увидеть все значения вместе со значениями чарта по умолчанию, добавьте флаг `--all`: `helm get values shop --all`.', 'To see all values together with the chart defaults, add `--all`: `helm get values shop --all`.'),
          },
        },
        {
          id: 'rollback',
          prompt: bi(
            'Коллега просит проверить версию образа 2.0. Обновите релиз с теми же настройками из `prod.yaml`, но с образом `2.0`, дождитесь, чем закончится выкладка, и средствами Helm верните последнюю работавшую ревизию.',
            'A colleague asks to try image version 2.0. Upgrade the release with the same settings from `prod.yaml` but with image `2.0`, wait to see how the rollout ends, and with Helm bring back the last revision that worked.',
          ),
          check: {
            when: (f) => revisionsOf(f, 'default', 'shop').some((r) => String(r.values?.image?.tag) === '2.0') && shopRelease(f)?.status === 'deployed' && /^Rollback to/.test(shopRelease(f)?.description ?? '') && String(shopRelease(f)?.values?.image?.tag) === '1.1' && deploymentOf(f, 'default', 'shop')?.image === 'trainer/web:1.1' && (deploymentOf(f, 'default', 'shop')?.ready ?? 0) >= 3,
            fail: [
              { if: (f) => deploymentOf(f, 'default', 'shop')?.image === 'trainer/web:1.1' && String(shopRelease(f)?.values?.image?.tag) === '2.0', say: bi('Deployment вернулся к образу 1.1, но через kubectl, и Helm об этом не знает: последней ревизией релиза по-прежнему записана версия 2.0. Следующий `helm upgrade --reuse-values` снова выложит 2.0. Откатите релиз командой `helm rollback`.', 'The Deployment is back on image 1.1, but through kubectl, and Helm does not know: the release’s latest revision still says 2.0. The next `helm upgrade --reuse-values` would roll 2.0 out again. Roll the release back with `helm rollback`.') },
              { if: (f) => /^Rollback to/.test(shopRelease(f)?.description ?? '') && String(shopRelease(f)?.values?.image?.tag) !== '1.1', say: bi('Вы откатились не к той ревизии: в ней образ 1.0 и две реплики, то есть это установка из третьего задания. Последняя работавшая ревизия — та, что создал upgrade с файлом `prod.yaml`. Номер ревизии покажет `helm history shop`.', 'You rolled back to the wrong revision: it has image 1.0 and two replicas, so it is the install from the third task. The last revision that worked is the one the upgrade with `prod.yaml` created. `helm history shop` shows its number.') },
              { if: (f) => String(shopRelease(f)?.values?.image?.tag) === '2.0', say: bi('Версия 2.0 выложена, и её поды аварийно завершаются. Посмотрите на ревизии командой `helm history shop` и верните последнюю работавшую командой `helm rollback shop <номер>`.', 'Version 2.0 is rolled out, and its pods crash. Look at the revisions with `helm history shop` and bring back the last one that worked with `helm rollback shop <number>`.') },
            ],
          },
          chips: 'helm upgrade shop training/podinfo -f prod.yaml --set image.tag=2.0 --wait --timeout 60s',
          concepts: ['k8s.helm-release', 'k8s.revision'],
          hints: {
            H1: bi('Флаг `--set` можно передать вместе с `-f`, и он перекроет значение из файла. Флаг `--wait` заставит Helm ждать, пока поды станут готовыми.', '`--set` can be passed together with `-f`, and it overrides the value from the file. `--wait` makes Helm wait until the pods are ready.'),
            H2: bi('Выполните `helm upgrade shop training/podinfo -f prod.yaml --set image.tag=2.0 --wait --timeout 60s`. Через минуту Helm сообщит `UPGRADE FAILED`, а `helm history shop` покажет ревизию со статусом failed.', 'Run `helm upgrade shop training/podinfo -f prod.yaml --set image.tag=2.0 --wait --timeout 60s`. After a minute Helm reports `UPGRADE FAILED`, and `helm history shop` shows a revision with status failed.'),
            H3: bi('Последняя работавшая ревизия — вторая, её создал upgrade с файлом. Верните её командой `helm rollback shop 2` и проверьте `helm history shop` и `kubectl get pods`.', 'The last revision that worked is the second, made by the upgrade with the file. Bring it back with `helm rollback shop 2` and check `helm history shop` and `kubectl get pods`.'),
          },
        },
      ],
    },
    {
      id: 'recipes',
      kind: 'text',
      step: 'review',
      title: bi('Что из этого понадобится в работе', 'What of this you will need at work'),
      body: bi(
        'В учебном кластере репозиторий находился сразу, а в работе к командам из лабораторной работы добавляются ещё две привычки. Версию чарта, которую вы выбрали в выводе `helm search repo --versions`, закрепляют флагом `--version`, как образ закрепляют тегом. Установку и обновление делают одной командой, которая ставит релиз, если его нет, и обновляет, если он есть:\n\n```bash\nhelm upgrade --install shop podinfo/podinfo -n shop --create-namespace -f prod.yaml --version <версия> --wait --atomic\n```\n\nФлаг `--atomic` сам откатывает неудачное обновление, то есть делает то, что вы только что сделали руками командой `helm rollback`. В Helm 4 у этого флага новое имя, `--rollback-on-failure`, а старое оставлено для совместимости.\n\nНа собеседовании часто спрашивают, чем `helm rollback` отличается от `kubectl rollout undo`. `helm rollback` возвращает весь набор объектов релиза и записывает новую ревизию в историю релиза. `kubectl rollout undo` возвращает только шаблон одного Deployment и о релизе ничего не знает, поэтому после него история Helm расходится с тем, что работает в кластере, как в одной из ошибок последнего задания.',
        'In the training cluster the repository was there at once; at work two more habits join the commands from the lab. The chart version you picked from `helm search repo --versions` is pinned with `--version`, as an image is pinned with a tag. Installing and upgrading are one command that installs the release if there is none and upgrades it if there is:\n\n```bash\nhelm upgrade --install shop podinfo/podinfo -n shop --create-namespace -f prod.yaml --version <version> --wait --atomic\n```\n\n`--atomic` rolls a failed upgrade back by itself, doing what you have just done by hand with `helm rollback`. Helm 4 renamed it to `--rollback-on-failure` and keeps the old name for compatibility.\n\nInterviews often ask how `helm rollback` differs from `kubectl rollout undo`. `helm rollback` brings back the whole set of the release’s objects and writes a new revision into the release history. `kubectl rollout undo` brings back only the template of one Deployment and knows nothing of the release, so afterwards Helm’s history disagrees with what runs in the cluster, as in one of the mistakes of the last task.',
      ),
    },
    {
      id: 'deep',
      kind: 'text',
      step: 'explain',
      levels: ['experienced'],
      title: bi('Порядок values и почему состояние релиза лежит в Secret', 'The order of values, and why release state lives in Secrets'),
      body: bi(
        'Helm собирает values в строгом порядке, и каждый следующий слой перекрывает предыдущий: сначала `values.yaml` самого чарта, затем файлы из флагов `-f` слева направо, затем флаги `--set`, `--set-string` и `--set-file`, тоже слева направо. Словари сливаются по ключам, а списки заменяются целиком, поэтому файл, где перечислен один элемент `env`, стирает весь список из чарта. Флаг `--reuse-values` берёт за основу значения прошлой ревизии вместо значений чарта, а `--reset-then-reuse-values` начинает заново со значений чарта текущей версии и накладывает поверх них значения прошлой ревизии, что безопаснее при смене версии чарта.\n\nСостояние релиза Helm 3 хранит в кластере, а не на компьютере того, кто его ставил, и тому есть три причины. Во-первых, релиз видит любой, у кого есть доступ к namespace: коллега, другой конвейер и вы на другом ноутбуке. Во-вторых, в ревизии записаны все переданные values, а среди них бывают пароли, поэтому ревизии лежат в Secret и доступ к ним ограничивают те же роли RBAC, что и доступ к остальным Secret namespace. В-третьих, у Helm 2 для этого был отдельный сервер Tiller с правами на весь кластер, и Helm 3 избавился от него: теперь каждая команда Helm выполняется с правами того, кто её запустил. Тип таких Secret — `helm.sh/release.v1`, на них стоят метки `owner=helm`, `name`, `status` и `version`, а содержимое ревизии сжато и закодировано base64. Переменная окружения `HELM_DRIVER` позволяет хранить ревизии в ConfigMap, но так делают редко, потому что тогда values с паролями открыты всем, кто читает ConfigMap.',
        'Helm gathers values in a strict order, and every layer overrides the one before: first the chart’s own `values.yaml`, then the `-f` files from left to right, then the `--set`, `--set-string` and `--set-file` flags, also left to right. Maps merge by key, and lists are replaced whole, so a file listing one `env` item wipes the chart’s whole list. `--reuse-values` starts from the previous revision’s values instead of the chart’s, and `--reset-then-reuse-values` starts again from the defaults of the current chart version and lays the previous revision’s values over them, which is safer when the chart version changes.\n\nHelm 3 keeps release state in the cluster rather than on the computer of whoever installed it, for three reasons. First, anyone with access to the namespace sees the release: a colleague, another pipeline and you on another laptop. Second, a revision records all the values passed, and some of them are passwords, so revisions live in Secrets, and the same RBAC roles that guard the namespace’s other Secrets guard them. Third, Helm 2 had a separate server, Tiller, with rights over the whole cluster for this, and Helm 3 got rid of it: every Helm command now runs with the rights of whoever started it. Such Secrets have the type `helm.sh/release.v1` and the labels `owner=helm`, `name`, `status` and `version`, and the revision content is compressed and base64-encoded. The environment variable `HELM_DRIVER` can keep revisions in ConfigMaps instead, but that is rare, because then values with passwords are open to everyone who reads ConfigMaps.',
      ),
    },
    {
      id: 'lab-deep',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      levels: ['experienced'],
      setup: HELM_LAB,
      intro: bi('Кластер чистый, а файл `prod.yaml` тот же, что в прошлой работе. Репозиторий `training` нужно подключить заново.', 'The cluster is clean, and `prod.yaml` is the same as in the previous lab. Repository `training` has to be added again.'),
      tasks: [
        {
          id: 'precedence',
          prompt: bi('Ничего не устанавливая, выясните, сколько реплик получится у релиза `shop`, если передать и файл `prod.yaml`, и флаг `--set replicaCount=5`.', 'Without installing anything, find out how many replicas release `shop` gets if both `prod.yaml` and `--set replicaCount=5` are passed.'),
          check: {
            stdout: /kind: Deployment[\s\S]*replicas: 5/,
            fail: [{ if: (f) => /replicas: 3\b/.test(lastOut(f)?.out ?? ''), say: bi('Получилось три реплики из файла, значит, флаг `--set replicaCount=5` в команду не попал. Передайте оба источника значений сразу.', 'You got three replicas from the file, so `--set replicaCount=5` did not get into the command. Pass both sources of values at once.') }],
          },
          chips: 'helm template shop training/podinfo -f prod.yaml --set replicaCount=5',
          concepts: ['k8s.helm-values'],
          hints: {
            H1: bi('Подойдёт `helm template` с обоими флагами. Порядок флагов в командной строке здесь не важен: `--set` всегда накладывается после всех файлов.', '`helm template` with both flags will do. The order of the flags on the command line does not matter here: `--set` is always laid over all the files.'),
            H2: bi('Выполните `helm repo add training https://charts.example.test`, а затем `helm template shop training/podinfo -f prod.yaml --set replicaCount=5`.', 'Run `helm repo add training https://charts.example.test`, then `helm template shop training/podinfo -f prod.yaml --set replicaCount=5`.'),
            H3: bi('В выводе ищите строку `replicas:` в манифесте Deployment. При правильной команде в ней будет 5, а не 3 из файла.', 'Look for the `replicas:` line in the Deployment manifest. With the right command it says 5, not the 3 from the file.'),
          },
        },
        {
          id: 'secrets',
          prompt: bi('Установите релиз `shop`, обновите его один раз и найдите объекты кластера, в которых Helm хранит обе ревизии.', 'Install release `shop`, upgrade it once and find the cluster objects where Helm keeps both revisions.'),
          check: {
            when: (f) => revisionsOf(f, 'default', 'shop').length >= 2,
            stdout: /sh\.helm\.release\.v1\.shop\.v1[\s\S]*sh\.helm\.release\.v1\.shop\.v2/,
            fail: [{ if: (f) => revisionsOf(f, 'default', 'shop').length < 2, say: bi('У релиза пока меньше двух ревизий. Установите его командой `helm install`, а затем обновите командой `helm upgrade`.', 'The release has fewer than two revisions yet. Install it with `helm install`, then upgrade it with `helm upgrade`.') }],
          },
          chips: 'kubectl get secrets -l owner=helm',
          concepts: ['k8s.helm-release', 'k8s.secret'],
          hints: {
            H1: bi('Ревизии лежат в Secret того же namespace, что и релиз, и на них стоит метка `owner=helm`.', 'The revisions are in Secrets of the release namespace, labelled `owner=helm`.'),
            H2: bi('После `helm install shop training/podinfo` и `helm upgrade shop training/podinfo -f prod.yaml` выполните `kubectl get secrets -l owner=helm --show-labels`, а метки status покажут, какая ревизия сейчас развёрнута.', 'After `helm install shop training/podinfo` and `helm upgrade shop training/podinfo -f prod.yaml` run `kubectl get secrets -l owner=helm --show-labels`; the status labels show which revision is deployed now.'),
            H3: bi('Имена этих Secret строятся так: `sh.helm.release.v1.<релиз>.v<номер ревизии>`. Для релиза shop после установки и обновления их будет два, v1 и v2.', 'These Secrets are named `sh.helm.release.v1.<release>.v<revision number>`. For release shop after an install and an upgrade there are two, v1 and v2.'),
          },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: helmQuiz.map((q) => q.id) },
  ],
};
