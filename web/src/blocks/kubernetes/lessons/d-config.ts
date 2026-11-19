// KM05, KM06, KM11 (the idea): configuration and volumes, health and
// resources, Helm.

import { bi } from '../../../core/i18n';
import type { Lesson, QuizItem } from '../../../core/types';
import { CONFIG_LAB, HEALTH_LAB } from '../setups';
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
      { id: 'rbac', text: bi('Доступ к Secret можно ограничить правами (RBAC)', 'Access to Secrets can be restricted with permissions (RBAC)'), correct: true },
      { id: 'b64', text: bi('base64 шифрует значения', 'base64 encrypts the values'), why: bi('base64 — только способ записать байты текстом, и команда `base64 -d` вернёт исходное значение любому.', 'base64 is only a way to write bytes as text; `base64 -d` gives the original back to anyone.') },
      { id: 'file', text: bi('Secret нельзя смонтировать как файл', 'A Secret cannot be mounted as a file'), why: bi('Можно: том типа secret показывает каждый ключ отдельным файлом.', 'It can: a secret volume shows every key as a separate file.') },
    ],
    explain: bi('Шифрование данных в etcd включают отдельно (encryption at rest), а доступ к Secret ограничивают правами.', 'Encryption in etcd is enabled separately (encryption at rest), and access is restricted with permissions.'),
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
      { id: 'crash', text: 'CrashLoopBackOff', why: bi('Контейнер даже не создан: kubelet не может собрать для него окружение.', 'The container is not even created: the kubelet cannot build its environment.') },
      { id: 'pending', text: 'Pending', why: bi('Под уже назначен на узел, и застрял он на kubelet, а не на планировщике.', 'The pod is already assigned to a node; it is stuck at the kubelet, not at the scheduler.') },
    ],
  },
];

export const configLesson: Lesson = {
  id: 'k8s-1.config',
  block: 'k8s-1',
  title: bi('Конфигурация: ConfigMap, Secret и тома', 'Configuration: ConfigMaps, Secrets and volumes'),
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
          hints: { H1: bi('У команды create configmap три источника данных: значение в командной строке, файл и env-файл.', 'create configmap has three sources: a literal, a file and an env file.') },
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
          hints: { H1: bi('Вид Secret для произвольных данных называется generic.', 'The Secret kind for arbitrary data is generic.') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Сделайте ConfigMap `web-config` неизменяемым: любая попытка поменять его данные должна отклоняться API-сервером. В уроке этого поля не было.', 'Make ConfigMap `web-config` immutable: any attempt to change its data must be rejected by the API server. The lesson did not cover it.'),
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
      { id: 'lim', text: bi('1Gi — limits', '1Gi — the limits'), why: bi('limits соблюдает ядро на узле, а планировщику они не нужны.', 'The kernel on the node enforces limits; the scheduler does not need them.') },
    ],
  },
  {
    id: 'k8s.q.h.crash',
    kind: 'predict-output',
    concepts: ['k8s.crashloop'],
    prompt: bi('Контейнер падает через три секунды после запуска. Что покажет столбец STATUS через полминуты?', 'A container crashes 3 seconds after it starts. What does STATUS show half a minute later?'),
    command: 'kubectl run crash --image=trainer/web:2.0 >/dev/null; cluster ff 30s >/dev/null; kubectl get pod crash --no-headers',
    setup: { hostname: 'laptop', ext: { k8s: {} } },
    options: [
      { id: 'crash', text: 'CrashLoopBackOff', correct: true },
      { id: 'error', text: 'Error', why: bi('Error виден только в момент падения, а большую часть времени kubelet ждёт перед следующим перезапуском, и это и есть CrashLoopBackOff.', 'Error flashes at the moment of the crash; most of the time the kubelet waits before the restart — that is CrashLoopBackOff.') },
      { id: 'running', text: 'Running', why: bi('Running под показывает три секунды после каждого перезапуска, а потом контейнер снова падает.', 'Running lasts three seconds after each restart, then the container crashes again.') },
    ],
  },
];

export const healthLesson: Lesson = {
  id: 'k8s-1.health',
  block: 'k8s-1',
  title: bi('Здоровье и ресурсы: проверки контейнера, requests и limits', 'Health and resources: probes, requests and limits'),
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
        'Запущенный процесс ещё не означает, что приложение работает. kubelet умеет сам спрашивать его об этом, и такие вопросы называются [[k8s.probe|проверками контейнера (probes)]]: это HTTP-запрос, TCP-подключение или команда внутри контейнера.\n\n- **Проверка готовности (readinessProbe)** отвечает на вопрос, можно ли отправлять поду запросы. Если она не проходит, процесс никто не трогает: под получает `ready: false` и выпадает из EndpointSlice, и Service перестаёт отправлять ему запросы. Без этой проверки под получает запросы, как только запущен процесс, даже если приложение ещё прогревается.\n- **Проверка жизнеспособности (livenessProbe)** отвечает на вопрос, жив ли контейнер. Если она не проходит `failureThreshold` раз подряд, kubelet перезапускает контейнер. Привязывать её к внешней зависимости, например к базе данных, опасно: база перестанет отвечать, и перезапустятся все поды.\n- **Проверка запуска (startupProbe)** нужна приложениям, которые долго запускаются: пока она не прошла, остальные проверки не выполняются.\n\nКогда контейнер падает, kubelet перезапускает его, и паузы между перезапусками растут: 10 секунд, 20, 40 и так далее, до пяти минут. Пока kubelet ждёт, под показывает статус [[k8s.crashloop|CrashLoopBackOff]], а счётчик RESTARTS растёт. Причину ищут в логах **предыдущего** запуска, потому что текущий только что начался.',
        'A process that runs does not yet mean the application works. The kubelet can ask it itself: these are [[k8s.probe|probes]], an HTTP request, a TCP connection or a command inside the container.\n\n- **readinessProbe** answers "may traffic be sent". A failure does not touch the process: the pod gets `ready: false` and leaves the EndpointSlice — the Service stops sending to it. Without readiness a pod gets traffic as soon as its process starts, even if the application is still warming up.\n- **livenessProbe** asks "is it alive". `failureThreshold` failures in a row — the kubelet restarts the container. Pointing it at a dependency (a database) is dangerous: the database goes down — every pod restarts.\n- **startupProbe** is for applications that start slowly: until it passes, the other probes do not run.\n\nWhen a container crashes, the kubelet restarts it — with a growing pause of 10 s, 20 s, 40 s… up to 5 minutes. While it waits, the status is [[k8s.crashloop|CrashLoopBackOff]] and the RESTARTS counter grows. The cause is in the logs of the **previous** run: the current one has only just begun.',
      ),
    },
    {
      id: 'resources',
      kind: 'text',
      step: 'explain',
      title: bi('requests — для планировщика, limits — для ядра', 'requests for the scheduler, limits for the kernel'),
      body: bi(
        'Для каждого контейнера можно задать [[k8s.resources|requests и limits]] по процессору и памяти. Это два разных числа для двух разных потребителей.\n\n**requests** — это сколько контейнер просит. По ним работает планировщик: под попадёт на узел, только если запросы подов, которые там уже работают, вместе с запросом нового пода помещаются в память и процессор узла, отданные подам (allocatable). Ядро запрос памяти никак не ограничивает.\n\n**limits** — это потолок, и следит за ним ядро с помощью тех самых cgroup из блока Linux. `limits.memory: 256Mi` превращается в `memory.max = 268435456` в cgroup контейнера. Если контейнер превысит этот потолок, OOM killer ядра завершит процесс, и в `kubectl describe` появится `Reason: OOMKilled` и код 137. `limits.cpu: 500m` превращается в `cpu.max = 50000 100000`, то есть 50 мс процессорного времени из каждых 100 мс. Превышение по процессору процесс не завершает, а только притормаживает (throttling).\n\nИз сочетания requests и limits получается класс качества обслуживания (QoS): Guaranteed, когда requests равны limits у всех контейнеров, Burstable, когда задано хоть что-то, и BestEffort, когда не задано ничего. Когда на узле не хватает памяти, kubelet выселяет сначала поды BestEffort, а потом Burstable.',
        'Every container can have [[k8s.resources|requests and limits]] for CPU and memory. They are two different numbers for two different consumers.\n\n**requests** is how much the container asks for. The scheduler plans by them: a pod goes onto a node only if the sum of the requests of the pods already there plus its own fits into allocatable. The kernel does not limit memory by requests.\n\n**limits** is the ceiling, and the kernel enforces it — the very cgroups of the Linux block. `limits.memory: 256Mi` turns into `memory.max = 268435456` in the container cgroup. Exceed it and the OOM killer kills the process: `kubectl describe` shows `Reason: OOMKilled`, code 137. `limits.cpu: 500m` is `cpu.max = 50000 100000`: 50 ms out of every 100 ms. Exceeding CPU does not kill, it slows down (throttling).\n\nThe combination gives a QoS class: Guaranteed (requests = limits everywhere), Burstable (something is set), BestEffort (nothing). When a node runs short of memory, the kubelet evicts BestEffort first, then Burstable.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: HEALTH_LAB,
      intro: bi('В кластере работают под `crash`, который падает, и Deployment `shop` с Service `shop`, на который не идут запросы. Ещё есть файл `hog.yaml` с подом, который занимает 300 МБ памяти.', 'The cluster has: pod `crash`, which crashes; Deployment `shop` with Service `shop` that gets no traffic; the file `hog.yaml` — a pod that eats 300 MB.'),
      tasks: [
        {
          id: 'previous',
          prompt: bi('Под `crash` в состоянии CrashLoopBackOff. Найдите в справке `kubectl logs`, как прочитать вывод предыдущего запуска, и сохраните последнюю строку этого вывода в файл `~/crash.txt`.', 'Pod `crash` is in CrashLoopBackOff. Find in the `kubectl logs` help how to read the output of the previous run, and save its last line to `~/crash.txt`.'),
          check: { when: "files['/home/learner/crash.txt'].text~'panic: config not found'" },
          chips: 'kubectl logs crash --previous --tail=1 > crash.txt',
          concepts: ['k8s.crashloop'],
          docRef: { page: 'help/kubectl-logs', anchor: 'OPTIONS', line: '--previous' },
          docStep: 3,
          hints: { H1: bi('Флаг для «предыдущего экземпляра контейнера» описан в разделе Options, а одну последнюю строку оставит флаг --tail.', 'The flag for "the previous instance of the container" is in Options; --tail gives a one-line tail.') },
        },
        {
          id: 'ready',
          prompt: bi('Service `shop` не получает запросов: поды в состоянии Running, но не готовы. Найдите причину и почините Deployment так, чтобы оба пода стали готовыми.', 'Service `shop` gets no traffic: the pods are Running but not Ready. Find the cause and fix the Deployment so that both pods become ready.'),
          check: { when: 'k8s.deployments[name=shop].ready=2 && k8s.services[name=shop].endpoints=2' },
          chips: 'kubectl describe pod -l app=shop | grep Readiness',
          concepts: ['k8s.probe'],
          hints: {
            H1: bi('Посмотрите события пода: kubelet пишет туда, почему проверка не прошла.', 'Look at the pod events: the kubelet writes why the probe failed.'),
            H2: bi('Проверка обращается к порту, который приложение не слушает. Поменяйте порт проверки в шаблоне Deployment.', 'The probe knocks on a port the application does not listen on. Change the probe port in the Deployment template.'),
            H3: bi('Выполните `kubectl patch deploy shop -p \'{"spec":{"template":{"spec":{"containers":[{"name":"shop","readinessProbe":{"httpGet":{"port":80}}}]}}}}\'`: контейнеры в шаблоне сопоставляются по имени.', '`kubectl patch deploy shop -p \'{"spec":{"template":{"spec":{"containers":[{"name":"shop","readinessProbe":{"httpGet":{"port":80}}}]}}}}\'` — containers merge by name.'),
          },
        },
        {
          id: 'oom',
          prompt: bi('Запустите под из файла `hog.yaml` (он занимает 300 МБ при лимите 256Mi) и запишите в файл `~/exit.txt` код, с которым ядро завершило контейнер.', 'Run `hog.yaml` (it eats 300 MB with a 256Mi limit) and write into `~/exit.txt` the code the kernel ended the container with.'),
          check: { when: "files['/home/learner/exit.txt'].text~'137' && k8s.objects[kind=Pod][metadata.name=hog].status.containerStatuses.lastState.terminated.reason=OOMKilled" },
          chips: 'kubectl apply -f hog.yaml && kubectl describe pod hog',
          concepts: ['k8s.resources'],
          hints: { H1: bi('В выводе describe найдите Last State, а в нём Reason и Exit Code.', 'In describe look for Last State: Reason and Exit Code.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: healthQuiz.map((q) => q.id) },
  ],
};

// ── KM11 (the idea) ──────────────────────────────────────────────────────────

export const helmQuiz: QuizItem[] = [
  {
    id: 'k8s.q.helm.rollback',
    kind: 'mcq',
    concepts: ['k8s.helm'],
    prompt: bi('У релиза `blog` ревизия 1 — установка, а ревизия 2 — неудачное обновление. Что создаст команда `helm rollback blog 1`?', 'Release `blog`: revision 1 — install, revision 2 — a failed upgrade. What does `helm rollback blog 1` create?'),
    options: [
      { id: 'three', text: bi('Ревизию 3 с содержимым ревизии 1', 'Revision 3 with the contents of revision 1'), correct: true },
      { id: 'delete', text: bi('Удалит ревизию 2 и вернёт номер 1', 'Delete revision 2 and go back to number 1'), why: bi('История в Helm только растёт: откат — это новая ревизия, так же как у Deployment.', 'History in Helm only grows: a rollback is a new revision, as with a Deployment.') },
    ],
  },
  {
    id: 'k8s.q.helm.where',
    kind: 'mcq',
    concepts: ['k8s.helm', 'k8s.chart'],
    prompt: bi('Где Helm 3 хранит историю релиза?', 'Where does Helm 3 keep the history of a release?'),
    options: [
      { id: 'secret', text: bi('В объектах Secret с именами sh.helm.release.v1.<релиз>.v<N> в namespace релиза', 'In Secrets sh.helm.release.v1.<release>.v<N> in the release namespace'), correct: true },
      { id: 'tiller', text: bi('В сервере Tiller в namespace kube-system', 'In the Tiller server in kube-system'), why: bi('Tiller был в Helm 2 и удалён в Helm 3: теперь Helm — только клиент, а состояние хранится в кластере.', 'Tiller was in Helm 2 and removed in Helm 3: Helm is now only a client, and the state lives in the cluster.') },
      { id: 'local', text: bi('В каталоге ~/.helm на компьютере того, кто устанавливал релиз', 'In ~/.helm on the machine of whoever installed it'), why: bi('Тогда коллега не увидел бы вашего релиза, а история хранится в самом кластере.', 'Then a colleague would not see your release; the history is kept in the cluster itself.') },
    ],
  },
];

export const helmLesson: Lesson = {
  id: 'k8s-1.helm',
  block: 'k8s-1',
  title: bi('Helm: манифесты как пакет', 'Helm: manifests as a package'),
  summary: bi('Что такое чарт, values и релиз, как работают install, upgrade и rollback и где Helm хранит историю.', 'A chart, values and a release; install, upgrade and rollback; where Helm keeps the history.'),
  introduces: ['k8s.helm', 'k8s.chart'],
  uses: ['k8s.deployment', 'k8s.service', 'k8s.configmap', 'k8s.secret', 'k8s.revision'],
  tier: 'core',
  minutes: 20,
  sources: src([S.helm, S.helmCharts], [R.helm]),
  sections: [
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Зачем манифестам пакет', 'Why a package'),
      body: bi(
        'Ваш сервис — это уже пять или шесть объектов: Deployment, Service, ConfigMap, Secret и правило входа. Для тестового и для рабочего окружения они почти одинаковые: отличаются число реплик, домен и образ. Если копировать YAML и править его руками, окружения рано или поздно разойдутся. [[k8s.helm|Helm]] решает эту задачу так же, как пакетный менеджер.\n\n[[k8s.chart|Чарт]] — это каталог, в котором лежат `Chart.yaml` с именем и версией, `values.yaml` с параметрами по умолчанию и `templates/` с манифестами, куда подставляются значения, например `{{ .Values.replicaCount }}`. Команда `helm install blog ./chart -f prod.yaml` подставляет значения, получает обычные манифесты и отправляет их в API, а дальше работают те же контроллеры. Установленный экземпляр чарта называется релизом. Каждая команда `install`, `upgrade` и `rollback` создаёт новую ревизию релиза, и история хранится в самом кластере, в объектах Secret `sh.helm.release.v1.blog.v1`, `…v2` и так далее. Команда `helm rollback blog 1` создаёт ревизию 3 с содержимым первой, так что история только растёт.\n\nКоманда `helm template` строит манифесты, ничего не устанавливая, и так удобно проверять, что получится. Готовые чарты публикуют в репозиториях и в OCI-реестрах, и на этапе 2 вы поставите чарт курса из ghcr.io в настоящий кластер.',
        'Your service is already five or six objects: a Deployment, a Service, a ConfigMap, a Secret, an ingress rule. For test and for production they are almost the same: other replicas, another domain, another image. Copying YAML and editing it by hand leads to copies that quietly diverge. [[k8s.helm|Helm]] solves this as a package manager.\n\nA [[k8s.chart|chart]] is a directory: `Chart.yaml` (name and version), `values.yaml` (default parameters) and `templates/` (manifests with placeholders like `{{ .Values.replicaCount }}`). `helm install blog ./chart -f prod.yaml` fills in the values, gets ordinary manifests and sends them to the API — from there the same controllers work. An installed instance is called a release; every `install`, `upgrade` and `rollback` gets its own revision, and the history lives in the cluster, in the Secrets `sh.helm.release.v1.blog.v1`, `…v2`. `helm rollback blog 1` creates revision 3 with the contents of the first — the history only grows.\n\n`helm template` renders the manifests without installing anything — handy for checking what you will get. Ready charts are published in repositories and OCI registries; at stage 2 you will install the course chart from ghcr.io into a real cluster.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: helmQuiz.map((q) => q.id) },
    { id: 'next', kind: 'callout', tone: 'note', step: 'review', body: bi('Учебный кластер в браузере команду helm не выполняет, поэтому Helm вы попробуете на настоящем узле на этапе 2.', 'The browser cluster does not run helm, so you will try Helm on a real node in stage 2.') },
  ],
};
