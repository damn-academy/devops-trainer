// KM00–KM02: why orchestration, the first pod, labels and the reconcile loop.

import { bi } from '../../../core/i18n';
import type { Lesson, QuizItem } from '../../../core/types';
import { FIRST_POD, RS_LAB } from '../setups';
import { R, S, src } from '../sources';

// ── KM00 ────────────────────────────────────────────────────────────────────

export const whyQuiz: QuizItem[] = [
  {
    id: 'k8s.q.why.three',
    kind: 'multi',
    concepts: ['k8s.desired-state'],
    prompt: bi('Что делал «диспетчер вручную» и что потом возьмёт на себя система? Отметьте всё верное.', 'What did the "dispatcher by hand" do that a system will take over? Mark everything that is true.'),
    options: [
      { id: 'place', text: bi('Выбирал сервер для каждого контейнера с учётом памяти', 'Chose a server for every container, minding the memory'), correct: true },
      { id: 'watch', text: bi('Следил, что всё работает, и перекладывал упавшее', 'Watched that everything worked and moved what fell over'), correct: true },
      { id: 'list', text: bi('Держал список того, что должно быть запущено', 'Kept the list of what must be running'), correct: true },
      { id: 'code', text: bi('Исправлял ошибки в коде приложения', 'Fixed bugs in the application code'), why: bi('Система запускает и перезапускает программы, но код за вас не чинит: упавший из-за ошибки контейнер будет падать снова.', 'The system starts and restarts programs, but it does not fix your code: a container that crashes because of a bug keeps crashing.') },
    ],
    explain: bi('Выбор места, слежение и список желаемого — три работы, которые в следующих уроках получат имена: планировщик, контроллер, желаемое состояние.', 'Choosing a place, watching and the list of what is wanted are three jobs that get names in the next lessons: the scheduler, the controller, the desired state.'),
  },
  {
    id: 'k8s.q.why.desired',
    kind: 'mcq',
    concepts: ['k8s.desired-state'],
    prompt: bi('Сервер с двумя контейнерами погас ночью. Что нужно системе, чтобы вернуть их без вашего участия?', 'A server with two containers went dark at night. What does a system need to bring them back without you?'),
    options: [
      { id: 'list', text: bi('Записанное желаемое состояние: что и в каком количестве должно работать', 'A recorded desired state: what must run and how many'), correct: true },
      { id: 'log', text: bi('Журнал команд, которыми вы запускали контейнеры', 'The log of the commands you used to start the containers'), why: bi('Журнал рассказывает, что делали, а не что должно быть. Повторять старые команды вслепую опасно: часть их уже не нужна.', 'A log tells what was done, not what must be. Replaying old commands blindly is risky: some of them are no longer wanted.') },
      { id: 'backup', text: bi('Резервная копия погасшего сервера', 'A backup of the server that went dark'), why: bi('Копия поможет поднять тот же сервер, но система должна запустить контейнеры на других — для этого ей нужен список, а не образ диска.', 'A backup helps to bring the same server back, but the system has to start the containers elsewhere — for that it needs a list, not a disk image.') },
    ],
    explain: bi('Желаемое состояние — это описание, а не команда. Пока оно хранится, его можно сравнить с тем, что есть, и исправить разницу в любой момент.', 'The desired state is a description, not a command. As long as it is stored, it can be compared with what is there and the difference fixed at any moment.'),
  },
];

export const whyLesson: Lesson = {
  id: 'k8s-1.why',
  block: 'k8s-1',
  title: bi('Зачем оркестрация', 'Why orchestration'),
  summary: bi('Пять контейнеров на трёх серверах: что приходится делать руками и какие три работы возьмёт на себя система.', 'Five containers on three servers: what you have to do by hand and which three jobs a system takes over.'),
  introduces: ['k8s.cluster', 'k8s.node', 'k8s.desired-state'],
  uses: [],
  tier: 'core',
  minutes: 20,
  sources: src([S.overview, S.components], [R.what, R.wiki]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'В блоке о контейнерах вы запускали `docker run` на одной машине. Теперь у компании три сервера и пять контейнеров: два экземпляра магазина, два — API и кэш. Каждому нужна своя доля памяти. Ночью один сервер погаснет, а утром выйдет новая версия магазина, которую надо выкатить, не уронив сайт. Попробуйте сделать это сами — и засеките, сколько уходит времени.',
        'In the containers block you ran `docker run` on one machine. Now the company has three servers and five containers: two instances of the shop, two of the API and a cache. Each needs its share of memory. At night one server will go dark, and in the morning a new version of the shop comes out and has to be rolled out without taking the site down. Try it yourself — and time how long it takes.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s.dispatch', caption: bi('Переключите «кто раскладывает», погасите сервер, выкатите версию 2. Нажмите на любой блок.', 'Switch "who places them", turn a server off, roll out version 2. Press any block.') },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Три работы диспетчера', 'The three jobs of a dispatcher'),
      body: bi(
        'Руками вы делали три разные вещи, хотя казалось, что одну.\n\n- **Выбирали место.** Для каждого контейнера — сервер, где хватит памяти. Ошибётесь — контейнер не запустится или вытеснит соседа.\n- **Следили.** Кто-то должен заметить, что сервер погас, и переложить его контейнеры. Ночью этим «кем-то» становится звонок клиента.\n- **Помнили список.** Чтобы восстановить пропавшее, надо знать, что вообще должно работать и в скольких экземплярах.\n\nСистема, которая делает эти три работы вместо вас, называется оркестратором, а машины, которыми она управляет как одной, — [[k8s.cluster|кластером]]. Каждая машина кластера — это [[k8s.node|узел]]. Самое важное в этой схеме — третий пункт. Вы больше не говорите «запусти контейнер на втором сервере». Вы записываете [[k8s.desired-state|желаемое состояние]] — «магазин в двух экземплярах, по 512 МБ» — и система сама сравнивает его с тем, что есть, и исправляет разницу. Сервер погас — разница появилась — контейнеры перезапущены в другом месте. Никто не отдавал команду: её заменило описание.\n\nKubernetes — самый распространённый оркестратор контейнеров. Его создали в Google на опыте внутренней системы Borg и в 2014 году открыли; с 2016 года проект живёт в фонде CNCF. В следующих уроках у трёх работ появятся имена и места: список хранит API-сервер, следят контроллеры, место выбирает планировщик.',
        'By hand you did three different things, even though it felt like one.\n\n- **You chose a place.** For every container, a server with enough memory. Get it wrong and the container does not start or pushes out its neighbour.\n- **You watched.** Someone has to notice that a server went dark and move its containers. At night that "someone" is a customer’s phone call.\n- **You remembered the list.** To restore what disappeared you have to know what must run at all, and in how many copies.\n\nA system that does these three jobs for you is called an orchestrator, and the machines it runs as one are a [[k8s.cluster|cluster]]. Each machine of the cluster is a [[k8s.node|node]]. The most important item is the third. You no longer say "start a container on the second server". You write down the [[k8s.desired-state|desired state]] — "the shop in two copies, 512 MB each" — and the system compares it with what is there and fixes the difference. A server goes dark — a difference appears — the containers are restarted elsewhere. Nobody gave an order: a description took its place.\n\nKubernetes is the most widely used container orchestrator. Google built it on the experience of its internal system Borg and opened it in 2014; since 2016 the project has lived in the CNCF foundation. In the next lessons the three jobs get names and places: the API server keeps the list, controllers watch, the scheduler picks the place.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: whyQuiz.map((q) => q.id) },
    { id: 'note', kind: 'callout', tone: 'why', step: 'review', body: bi('Kubernetes не делает приложение надёжным само по себе. Он держит желаемое состояние: если программа падает из-за ошибки, он будет терпеливо её перезапускать — и вы увидите это по растущему счётчику перезапусков.', 'Kubernetes does not make an application reliable by itself. It holds the desired state: if a program crashes because of a bug, it patiently restarts it — and you see that in a growing restart counter.') },
  ],
};

// ── KM01 ────────────────────────────────────────────────────────────────────

export const podQuiz: QuizItem[] = [
  {
    id: 'k8s.q.pod.delete',
    kind: 'mcq',
    key: true,
    concepts: ['k8s.pod'],
    prompt: bi('Вы создали под командой `kubectl run web --image=trainer/web:1.0`, а потом выполнили `kubectl delete pod web`. Что будет?', 'You created a pod with `kubectl run web --image=trainer/web:1.0` and then ran `kubectl delete pod web`. What happens?'),
    options: [
      { id: 'gone', text: bi('Под исчезнет навсегда', 'The pod is gone for good'), correct: true },
      { id: 'back', text: bi('Kubernetes тут же создаст новый', 'Kubernetes creates a new one at once'), why: bi('Новый под создаёт не Kubernetes «вообще», а контроллер, которому под принадлежит. У одиночного пода хозяина нет.', 'A new pod is created not by Kubernetes "in general" but by the controller that owns the pod. A lone pod has no owner.') },
      { id: 'ask', text: bi('kubectl попросит подтверждение', 'kubectl asks for confirmation'), why: bi('kubectl ничего не переспрашивает: delete сразу отправляет запрос DELETE в API.', 'kubectl asks nothing: delete sends the DELETE request to the API at once.') },
    ],
    explain: bi('Под — смертная единица. Чтобы «должно работать три пода» соблюдалось само, нужен объект-хозяин и его контроллер — это следующий урок.', 'A pod is a mortal unit. For "three pods must run" to hold by itself you need an owner object and its controller — that is the next lesson.'),
    refs: { lesson: 'k8s-1.reconcile' },
  },
  {
    id: 'k8s.q.pod.port',
    kind: 'mcq',
    concepts: ['k8s.pod'],
    prompt: bi('В одном поде два контейнера, оба хотят слушать порт 80. Получится?', 'One pod has two containers, both want to listen on port 80. Will it work?'),
    options: [
      { id: 'no', text: bi('Нет: у контейнеров пода один сетевой namespace и один localhost', 'No: the containers of a pod share one network namespace and one localhost'), correct: true },
      { id: 'yes', text: bi('Да: у каждого контейнера свой IP', 'Yes: every container has its own IP'), why: bi('IP принадлежит поду, а не контейнеру. Второй bind на тот же порт получит «address already in use».', 'The IP belongs to the pod, not to the container. The second bind on the same port gets "address already in use".') },
    ],
  },
  {
    id: 'k8s.q.pod.fields',
    kind: 'match',
    concepts: ['k8s.api-object'],
    prompt: bi('Сопоставьте поле объекта API и то, что в нём лежит.', 'Match the field of an API object with what it holds.'),
    pairs: [
      { id: 'kind', left: 'kind', right: bi('вид объекта: Pod, Service…', 'the kind of object: Pod, Service…') },
      { id: 'meta', left: 'metadata', right: bi('имя, namespace, метки', 'name, namespace, labels') },
      { id: 'spec', left: 'spec', right: bi('чего вы хотите', 'what you want') },
      { id: 'status', left: 'status', right: bi('что есть на самом деле (пишет кластер)', 'what actually is (the cluster writes it)'), why: bi('status вы не пишете: его заполняют компоненты кластера, например kubelet.', 'You do not write status: the cluster components fill it in, the kubelet for example.') },
    ],
  },
  {
    id: 'k8s.q.pod.where',
    kind: 'mcq',
    concepts: ['k8s.kubeconfig'],
    prompt: bi('Откуда kubectl знает, к какому кластеру обращаться?', 'How does kubectl know which cluster to talk to?'),
    options: [
      { id: 'kc', text: bi('Из текущего контекста в kubeconfig (~/.kube/config)', 'From the current context in kubeconfig (~/.kube/config)'), correct: true },
      { id: 'dns', text: bi('Находит кластер в локальной сети', 'It finds the cluster on the local network'), why: bi('kubectl никого не ищет: адрес сервера записан в kubeconfig явно.', 'kubectl looks for nothing: the server address is written in kubeconfig explicitly.') },
      { id: 'env', text: bi('Только из переменной окружения KUBERNETES_HOST', 'Only from the KUBERNETES_HOST environment variable'), why: bi('Такой переменной kubectl не читает; переменная KUBECONFIG лишь меняет путь к тому же файлу.', 'kubectl does not read such a variable; the KUBECONFIG variable only changes the path to the same file.') },
    ],
  },
  {
    id: 'k8s.q.pod.status',
    kind: 'predict-output',
    concepts: ['k8s.pod'],
    prompt: bi('Под с несуществующим тегом образа создан полминуты назад. Что покажет STATUS в `kubectl get pod report`?', 'A pod with a non-existent image tag was created half a minute ago. What does STATUS show in `kubectl get pod report`?'),
    command: 'kubectl run report --image=trainer/web:typo >/dev/null; cluster ff 30s >/dev/null; kubectl get pod report --no-headers',
    setup: { hostname: 'laptop', ext: { k8s: {} } },
    options: [
      { id: 'backoff', text: 'ImagePullBackOff', correct: true },
      { id: 'pending', text: 'Pending', why: bi('Pending был до того, как планировщик выбрал узел. Здесь узел выбран, kubelet пытается скачать образ — и ждёт перед новой попыткой.', 'Pending was before the scheduler chose a node. Here the node is chosen and the kubelet tries to pull the image — and waits before the next try.') },
      { id: 'crash', text: 'CrashLoopBackOff', why: bi('Этот статус — про контейнер, который запустился и упал. Здесь он даже не запускался: образа нет.', 'That status is about a container that started and crashed. Here it never started: there is no image.') },
    ],
    explain: bi('ErrImagePull — сразу после неудачной загрузки, ImagePullBackOff — пока kubelet ждёт перед следующей попыткой (10 с, 20 с, … до 5 минут). Причину покажет `kubectl describe pod report`, раздел Events.', 'ErrImagePull right after a failed pull, ImagePullBackOff while the kubelet waits before the next try (10 s, 20 s, … up to 5 minutes). `kubectl describe pod report`, the Events section, shows why.'),
  },
];

export const firstPodLesson: Lesson = {
  id: 'k8s-1.first-pod',
  block: 'k8s-1',
  title: bi('Первый под', 'The first pod'),
  summary: bi('Kubernetes принимает описание, а не команду: под, объект API, kubectl и kubeconfig, status и события.', 'Kubernetes takes a description, not a command: the pod, the API object, kubectl and kubeconfig, status and events.'),
  introduces: ['k8s.pod', 'k8s.api-object', 'k8s.apiserver', 'k8s.kubeconfig', 'k8s.events'],
  uses: ['k8s.cluster', 'k8s.node', 'k8s.desired-state'],
  tier: 'core',
  minutes: 35,
  sources: src([S.pods, S.lifecycle, S.objects, S.kubectl], [R.objects, R.cheatsheet]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        '`docker run -d -p 8080:80 trainer/web:1.0` — это команда: «запусти здесь и сейчас». Кластеру так не говорят. Ему отдают записку: «хочу, чтобы работал контейнер из trainer/web:1.0». Дальше кластер сам решает, на каком [[k8s.node|узле]], и сам следит, чтобы записка оставалась правдой. В этом уроке вы отдадите первую такую записку и посмотрите, что с ней происходит.',
        '`docker run -d -p 8080:80 trainer/web:1.0` is an order: "start it here and now". You do not talk to a cluster like that. You hand it a note: "I want a container from trainer/web:1.0 running". The cluster then decides which [[k8s.node|node]] it goes to and keeps the note true. In this lesson you hand in your first such note and watch what happens to it.',
      ),
    },
    {
      id: 'pod',
      kind: 'text',
      step: 'explain',
      title: bi('Под — то, что запускает Kubernetes', 'A pod — what Kubernetes runs'),
      body: bi(
        'Kubernetes не запускает контейнеры поодиночке. Его минимальная единица — [[k8s.pod|под]]: один или несколько контейнеров, у которых общий сетевой namespace, а значит общий IP и общий `localhost`, и которые всегда оказываются на одном узле. Чаще всего в поде один контейнер; второй добавляют, когда ему нужно жить рядом с первым — например, сборщик логов, читающий тот же каталог.\n\nОтсюда простое следствие: два контейнера одного пода не могут слушать один и тот же порт, как не могут два процесса на одной машине. И ещё одно: под смертен. Его можно удалить, его могут выселить с узла, узел может погаснуть — и тогда этот под пропал вместе с IP. Как сделать, чтобы на месте пропавшего появлялся новый, — тема следующего урока.',
        'Kubernetes does not run containers one by one. Its smallest unit is the [[k8s.pod|pod]]: one or more containers that share a network namespace — so one IP and one `localhost` — and always land on the same node. Most pods have one container; a second one is added when it has to live next to the first, for example a log collector reading the same directory.\n\nA simple consequence: two containers of one pod cannot listen on the same port, just as two processes on one machine cannot. And another: a pod is mortal. It can be deleted, evicted from its node, the node can go dark — and then the pod is gone, together with its IP. How to have a new one appear in place of a lost one is the topic of the next lesson.',
      ),
    },
    {
      id: 'object',
      kind: 'text',
      step: 'explain',
      title: bi('Записка — это объект API', 'The note is an API object'),
      body: bi(
        'Записку для кластера пишут в YAML. В вашем домашнем каталоге лежит `pod.yaml`:\n\n```yaml\napiVersion: v1\nkind: Pod\nmetadata:\n  name: web\n  labels:\n    app: web\nspec:\n  containers:\n  - name: web\n    image: trainer/web:1.0\n    ports:\n    - containerPort: 80\n```\n\nЭто [[k8s.api-object|объект API]], и у каждого объекта одни и те же части. `apiVersion` и `kind` говорят, что это за вид объекта. `metadata` — имя и метки. `spec` — чего вы хотите: здесь один контейнер из образа `trainer/web:1.0`. Четвёртую часть, `status`, вы не пишете: её заполняет кластер, и там написано, что есть на самом деле — фаза пода, его IP, состояние контейнеров. `spec` и `status` рядом в одном объекте — это желаемое и фактическое, о которых шла речь в прошлом уроке.\n\nОтправляете записку вы командой `kubectl apply -f pod.yaml`. Получает её [[k8s.apiserver|API-сервер]] — единственная дверь кластера. Он проверяет, кто вы и можно ли вам это, дописывает значения по умолчанию, проверяет объект по схеме и сохраняет. На этом его работа кончается: сам API-сервер ничего не запускает. Кто запустит процесс, вы увидите чуть позже.',
        'The note for the cluster is written in YAML. Your home directory has `pod.yaml`:\n\n```yaml\napiVersion: v1\nkind: Pod\nmetadata:\n  name: web\n  labels:\n    app: web\nspec:\n  containers:\n  - name: web\n    image: trainer/web:1.0\n    ports:\n    - containerPort: 80\n```\n\nThis is an [[k8s.api-object|API object]], and every object has the same parts. `apiVersion` and `kind` say what kind of object it is. `metadata` holds the name and the labels. `spec` is what you want: here, one container from the `trainer/web:1.0` image. The fourth part, `status`, you do not write: the cluster fills it in, and it says what actually is — the pod phase, its IP, the state of the containers. `spec` and `status` side by side in one object are the desired and the actual state from the previous lesson.\n\nYou send the note with `kubectl apply -f pod.yaml`. The [[k8s.apiserver|API server]] receives it — the only door of the cluster. It checks who you are and whether you may, fills in defaults, validates the object against its schema and stores it. That is where its work ends: the API server itself starts nothing. Who starts the process, you will see a bit later.',
      ),
    },
    {
      id: 'kubeconfig',
      kind: 'text',
      step: 'explain',
      title: bi('Куда стучится kubectl', 'Where kubectl knocks'),
      body: bi(
        '`kubectl` — клиент: он превращает ваши команды и файлы в HTTP-запросы к API-серверу. Адрес сервера и ключ, которым kubectl представляется, лежат в файле [[k8s.kubeconfig|kubeconfig]] — по умолчанию `~/.kube/config`. В нём три списка: кластеры (адреса), пользователи (ключи) и контексты — пары «кластер + пользователь», к которым можно добавить namespace по умолчанию. Команда `kubectl config view --minify` покажет текущий контекст, а ключи заменит строкой `DATA+OMITTED`.\n\nКогда у вас будет несколько кластеров, ошибка контекстом обойдётся дорого: команда, предназначенная для учебного стенда, уйдёт в рабочий. Поэтому опытные люди перед опасными командами смотрят `kubectl config current-context`, а на экзаменах в начале каждого задания стоит `kubectl config use-context …`.',
        '`kubectl` is a client: it turns your commands and files into HTTP requests to the API server. The server address and the key kubectl introduces itself with are in the [[k8s.kubeconfig|kubeconfig]] file — `~/.kube/config` by default. It holds three lists: clusters (addresses), users (keys) and contexts — "cluster + user" pairs, optionally with a default namespace. `kubectl config view --minify` shows the current context and replaces the keys with `DATA+OMITTED`.\n\nOnce you have several clusters, a wrong context gets expensive: a command meant for a lab goes to production. That is why experienced people check `kubectl config current-context` before dangerous commands, and every exam task starts with `kubectl config use-context …`.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: FIRST_POD,
      intro: bi('Учебный кластер из трёх узлов (k3s) в браузере. Команда `cluster ff 30s` проматывает время кластера вперёд — это инструмент тренажёра, а не Kubernetes.', 'A three-node training cluster (k3s) in the browser. `cluster ff 30s` fast-forwards cluster time — a trainer tool, not Kubernetes.'),
      tasks: [
        {
          id: 'apply',
          prompt: bi('Отправьте в кластер записку `pod.yaml` и дождитесь, пока под `web` будет Running.', 'Send the note `pod.yaml` to the cluster and wait until pod `web` is Running.'),
          check: {
            when: "k8s.pods[ns=default][name=web][phase=Running]#=1",
            fail: [{ if: "k8s.pods[ns=default][name=web]#=1", say: bi('Под создан, но ещё не Running: kubelet качает образ и запускает контейнер. Посмотрите ещё раз через пару секунд: `kubectl get pods`.', 'The pod exists but is not Running yet: the kubelet is pulling the image and starting the container. Look again in a couple of seconds: `kubectl get pods`.') }],
          },
          chips: 'kubectl apply -f pod.yaml',
          concepts: ['k8s.pod', 'k8s.api-object'],
          docRef: { page: 'help/kubectl-apply', anchor: 'EXAMPLES', line: 'kubectl apply -f ./pod.json' },
          hints: { H1: bi('Файл передают флагом -f.', 'A file is passed with the -f flag.'), H2: bi('`kubectl apply -f pod.yaml`, затем `kubectl get pods`.', '`kubectl apply -f pod.yaml`, then `kubectl get pods`.') },
        },
        {
          id: 'wide',
          prompt: bi('Выведите список подов так, чтобы были видны IP пода и узел, на который его поставили.', 'List the pods so that the pod IP and the node it was placed on are visible.'),
          check: { when: "term['main'][last].exit=0", stdout: /IP\s+NODE[\s\S]*web\s+1\/1\s+Running[\s\S]*10\.42\.\d+\.\d+\s+(cp-1|worker-\d)/ },
          chips: 'kubectl get pods -o wide',
          docRef: { page: 'help/kubectl-get', anchor: 'EXAMPLES', line: '-o wide' },
          docStep: 3,
          hints: { H1: bi('У get есть формат вывода с дополнительными столбцами.', 'get has an output format with extra columns.') },
        },
        {
          id: 'describe',
          prompt: bi('Посмотрите подробное описание пода и найдите в событиях, кто и на какой узел его назначил.', 'Look at the detailed description of the pod and find in its events who assigned it to which node.'),
          check: { stdout: /Successfully assigned default\/web to/ },
          chips: 'kubectl describe pod web',
          concepts: ['k8s.events'],
          docRef: { page: 'help/kubectl-describe', anchor: 'EXAMPLES', line: 'kubectl describe pods/nginx' },
          hints: { H1: bi('Подробное описание с событиями внизу даёт describe.', 'describe gives the detailed description with events at the bottom.'), H2: bi('`kubectl describe pod web` — смотрите раздел Events и строку default-scheduler.', '`kubectl describe pod web` — look at the Events section and the default-scheduler line.') },
        },
        {
          id: 'logs',
          prompt: bi('Прочитайте, что приложение написало при старте.', 'Read what the application printed on start.'),
          check: { stdout: /listening on :80/ },
          chips: 'kubectl logs web',
          docRef: { page: 'help/kubectl-logs', anchor: 'EXAMPLES', line: 'kubectl logs nginx' },
          hints: { H1: bi('Вывод контейнера kubelet сохраняет на узле, а показывает его kubectl logs.', 'The kubelet keeps the container output on the node, and kubectl logs shows it.') },
        },
        {
          id: 'dryrun',
          prompt: bi('Не создавая ничего в кластере, получите YAML пода `api` из образа `trainer/web:1.1` и сохраните его в `~/api.yaml`.', 'Without creating anything in the cluster, get the YAML of a pod `api` from the image `trainer/web:1.1` and save it to `~/api.yaml`.'),
          check: {
            when: "files['/home/learner/api.yaml'].text~'kind: Pod' && files['/home/learner/api.yaml'].text~'trainer/web:1.1' && k8s.pods[name=api]#=0",
            fail: [{ if: 'k8s.pods[name=api]#=1', say: bi('Под api создан по-настоящему. Нужен только YAML: флаг --dry-run=client говорит kubectl ничего не отправлять.', 'The api pod was really created. Only the YAML was wanted: --dry-run=client tells kubectl to send nothing.') }],
          },
          chips: 'kubectl run api --image=trainer/web:1.1 --dry-run=client -o yaml > api.yaml',
          docRef: { page: 'help/kubectl-run', anchor: 'EXAMPLES', line: '--dry-run=client' },
          hints: {
            H1: bi('kubectl run умеет только напечатать объект, ничего не создавая.', 'kubectl run can just print the object without creating anything.'),
            H2: bi('Нужны два флага: «пробный прогон на клиенте» и «вывод в YAML», плюс перенаправление `>`.', 'You need two flags — a client dry run and YAML output — plus a `>` redirection.'),
          },
        },
        {
          id: 'delete',
          prompt: bi('Удалите под `web` и убедитесь, что его больше нет.', 'Delete pod `web` and make sure it is gone.'),
          check: { when: 'k8s.timeline[type=DELETED][kind=Pod][name=web]#>=1 && k8s.pods[ns=default][name=web]#=0' },
          chips: 'kubectl delete pod web',
          hints: { H1: bi('Глагол удаления у kubectl такой же, как в REST.', 'kubectl’s verb for removal is the same as in REST.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('`kubectl explain` — справка по полям объекта. В каком разделе страницы перечислены вложенные поля и их типы? Нажмите на него.', '`kubectl explain` is the reference for the fields of an object. Which section of the page lists the nested fields and their types? Press it.'),
      ref: { page: 'explain/pod.spec.containers' },
      answer: 'FIELDS',
    },
    {
      id: 'findflag',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Найдите в справке `kubectl run`, как сказать, что контейнер не надо перезапускать после выхода, и запустите под `once` из `busybox:1.37`, который не будет перезапускаться.', 'Find in the `kubectl run` help how to say that the container must not be restarted after it exits, and run a pod `once` from `busybox:1.37` that will not be restarted.'),
      ref: { page: 'help/kubectl-run', anchor: 'OPTIONS', line: '--restart' },
      terminal: {
        setup: { hostname: 'laptop', ext: { k8s: {} } },
        task: {
          id: 'once',
          prompt: bi('Под `once` из `busybox:1.37`, который не перезапускается.', 'Pod `once` from `busybox:1.37` that is not restarted.'),
          check: { when: "k8s.objects[kind=Pod][metadata.name=once].spec.restartPolicy=Never" },
          chips: 'kubectl run once --image=busybox:1.37 --restart=Never',
          docStep: 3,
          hints: { H1: bi('Это политика перезапуска; ищите в разделе Options.', 'It is the restart policy; look in the Options section.') },
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: podQuiz.map((q) => q.id) },
    {
      id: 'mortal',
      kind: 'callout',
      tone: 'note',
      step: 'review',
      body: bi('Удалённый под не вернулся: у него не было хозяина. В рабочих кластерах поды почти никогда не создают напрямую — их создают контроллеры, о которых следующий урок.', 'The deleted pod did not come back: it had no owner. In real clusters pods are almost never created directly — controllers create them, and they are the next lesson.'),
    },
  ],
};

// ── KM02 ────────────────────────────────────────────────────────────────────

export const reconcileQuiz: QuizItem[] = [
  {
    id: 'k8s.q.rs.image',
    kind: 'mcq',
    concepts: ['k8s.replicaset', 'k8s.controller'],
    prompt: bi('В ReplicaSet на 3 пода сменили образ на trainer/web:1.1. Что произойдёт с работающими подами?', 'In a ReplicaSet of 3 pods the image was changed to trainer/web:1.1. What happens to the running pods?'),
    options: [
      { id: 'nothing', text: bi('Ничего: петля ReplicaSet считает только количество', 'Nothing: the ReplicaSet loop counts only the number'), correct: true },
      { id: 'replace', text: bi('Их по одному заменят на новые', 'They are replaced one by one'), why: bi('Так делает Deployment, а не ReplicaSet. ReplicaSet сравнивает число подов с replicas — образ живых подов он не трогает.', 'A Deployment does that, not a ReplicaSet. A ReplicaSet compares the number of pods with replicas — it does not touch the image of live pods.') },
      { id: 'restart', text: bi('Контейнеры перезапустятся с новым образом', 'The containers restart with the new image'), why: bi('Шаблон пода используется только при создании новых подов.', 'The pod template is used only when new pods are created.') },
    ],
    explain: bi('Новый образ получат только поды, созданные после изменения — например, взамен удалённых.', 'Only pods created after the change get the new image — for example, in place of deleted ones.'),
  },
  {
    id: 'k8s.q.rs.orphan',
    kind: 'mcq',
    concepts: ['k8s.owner', 'k8s.label'],
    prompt: bi('С пода ReplicaSet `web` (app=web, 3 реплики) сняли метку app. Что будет?', 'The app label was removed from a pod of ReplicaSet `web` (app=web, 3 replicas). What happens?'),
    options: [
      { id: 'orphan', text: bi('Под останется жить без хозяина, ReplicaSet создаст замену', 'The pod lives on without an owner, the ReplicaSet creates a replacement'), correct: true },
      { id: 'deleted', text: bi('ReplicaSet удалит этот под', 'The ReplicaSet deletes that pod'), why: bi('ReplicaSet удаляет только свои лишние поды; под без нужной метки больше не его — контроллер убирает ownerReference и отпускает его.', 'A ReplicaSet deletes only its own extra pods; a pod without the label is no longer its own — the controller removes the ownerReference and lets it go.') },
      { id: 'nothing', text: bi('Ничего не изменится', 'Nothing changes'), why: bi('Селектор больше не выбирает этот под, поэтому подов «своих» стало два — разница +1.', 'The selector no longer picks this pod, so there are two "own" pods — a difference of +1.') },
    ],
    explain: bi('Так снимают под «на отладку», не трогая сервис: убрать метку — и под выпадает из ReplicaSet (и, как вы увидите позже, из Service).', 'This is how a pod is taken out "for debugging" without touching the service: remove the label and the pod drops out of the ReplicaSet (and, as you will see later, out of the Service).'),
  },
  {
    id: 'k8s.q.rs.level',
    kind: 'mcq',
    concepts: ['k8s.watch', 'k8s.controller'],
    prompt: bi('Контроллер стоял минуту, за это время под удаляли и создавали трижды. Что сделает контроллер, когда снова заработает?', 'The controller was stopped for a minute, and a pod was deleted and created three times meanwhile. What will the controller do when it runs again?'),
    options: [
      { id: 'once', text: bi('Один раз посмотрит на текущее состояние и сделает одно исправление', 'Look at the current state once and make one fix'), correct: true },
      { id: 'replay', text: bi('Проиграет все шесть событий по порядку', 'Replay all six events in order'), why: bi('Контроллеры в Kubernetes работают по состоянию (level-triggered): история событий им не нужна, нужна только текущая разница.', 'Kubernetes controllers are level-triggered: they need no history of events, only the current difference.') },
    ],
    explain: bi('Поэтому пропущенное событие не страшно: следующая сверка всё равно увидит правду.', 'That is why a missed event does no harm: the next reconcile sees the truth anyway.'),
    refs: { explainer: 'k8s.reconcile' },
  },
  {
    id: 'k8s.q.ns.three',
    kind: 'match',
    concepts: ['k8s.namespace'],
    prompt: bi('Три разных «пространства имён». Сопоставьте.', 'Three different "namespaces". Match them.'),
    pairs: [
      { id: 'k8s', left: bi('namespace Kubernetes', 'a Kubernetes namespace'), right: bi('папка для объектов API; в ядре ничего не изолирует', 'a folder for API objects; isolates nothing in the kernel') },
      { id: 'linux', left: bi('пространство имён Linux (pid, mnt…)', 'a Linux namespace (pid, mnt…)'), right: bi('отдельный вид на ресурсы ядра для процесса', 'a separate view of kernel resources for a process') },
      { id: 'net', left: bi('сетевое пространство имён', 'a network namespace'), right: bi('свои интерфейсы, маршруты и порты', 'its own interfaces, routes and ports') },
    ],
    explain: bi('Поды из разных namespace Kubernetes по умолчанию видят друг друга по сети: namespace — граница имён и прав, а не сети.', 'Pods in different Kubernetes namespaces see each other on the network by default: a namespace is a boundary of names and permissions, not of the network.'),
  },
  {
    id: 'k8s.q.rs.selector',
    kind: 'bugfind',
    concepts: ['k8s.replicaset', 'k8s.label'],
    prompt: bi('API-сервер отклонил этот ReplicaSet. В какой строке ошибка?', 'The API server rejected this ReplicaSet. Which line has the bug?'),
    code: 'apiVersion: apps/v1\nkind: ReplicaSet\nmetadata:\n  name: web\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: web\n  template:\n    metadata:\n      labels:\n        app: frontend\n    spec:\n      containers:\n      - name: web\n        image: trainer/web:1.0',
    lang: 'yaml',
    bug: [13],
    why: {
      9: bi('Селектор сам по себе верный: он ищет поды app=web.', 'The selector itself is fine: it looks for pods with app=web.'),
      13: bi('Поды из шаблона получат app=frontend, а селектор ищет app=web: ReplicaSet никогда не увидел бы свои поды. API-сервер отвечает: `selector` does not match template `labels`.', 'Pods from the template get app=frontend, but the selector looks for app=web: the ReplicaSet would never see its own pods. The API server says: `selector` does not match template `labels`.'),
      6: bi('Число реплик может быть любым неотрицательным.', 'The number of replicas can be any non-negative number.'),
    },
  },
];

export const reconcileLesson: Lesson = {
  id: 'k8s-1.reconcile',
  block: 'k8s-1',
  title: bi('Метки и цикл согласования', 'Labels and the reconcile loop'),
  summary: bi('Метки и селекторы, namespace, контроллер и его петля, ReplicaSet, etcd, ownerReferences и watch — и ваша первая петля.', 'Labels and selectors, namespaces, a controller and its loop, the ReplicaSet, etcd, ownerReferences and watch — and your first loop.'),
  introduces: ['k8s.label', 'k8s.namespace', 'k8s.controller', 'k8s.replicaset', 'k8s.etcd', 'k8s.owner', 'k8s.watch'],
  uses: ['k8s.pod', 'k8s.api-object', 'k8s.apiserver', 'k8s.desired-state'],
  tier: 'core',
  minutes: 40,
  sources: src([S.labels, S.namespaces, S.controller, S.replicaset, S.owners], [R.labels, R.namespaces, R.controller]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Удалённый под не вернулся. Чтобы «три копии магазина» оставались правдой и ночью, нужен кто-то, кто постоянно сравнивает «должно быть три» с «есть два» и создаёт недостающий. Этот «кто-то» в Kubernetes — не человек и не один большой мозг, а множество маленьких петель, каждая со своей заботой.',
        'The deleted pod did not come back. For "three copies of the shop" to stay true at night too, someone has to keep comparing "there must be three" with "there are two" and create the missing one. In Kubernetes that someone is not a person and not one big brain, but many small loops, each with its own concern.',
      ),
    },
    {
      id: 'labels',
      kind: 'text',
      step: 'explain',
      title: bi('Метки: как объекты находят друг друга', 'Labels: how objects find each other'),
      body: bi(
        'У объекта может быть сколько угодно [[k8s.label|меток]] — пар `ключ=значение` в `metadata.labels`: `app=web`, `tier=frontend`, `env=prod`. Сами по себе метки ничего не делают. Их смысл — в селекторах: селектор — это запрос «все объекты, у которых app=web». Так в Kubernetes устроены почти все связи: не «вот список имён подов», а «поды, подходящие под условие». Под появился с нужной меткой — он уже в выборке; метку сняли — выпал.\n\nВ терминале это `kubectl get pods --show-labels` (метки столбцом) и `kubectl get pods -l app=web` (только подходящие).\n\nРядом с метками живёт [[k8s.namespace|namespace]] — папка для объектов. Имена уникальны внутри namespace, права выдаются на namespace, `kubectl get pods` показывает поды текущего namespace (`-n shop` — другого, `-A` — всех). Будьте внимательны с омонимами: namespace Kubernetes не имеет ничего общего с пространствами имён Linux из блока о контейнерах. Он не изолирует ни процессы, ни сеть — поды из разных namespace по умолчанию прекрасно видят друг друга.',
        'An object can have any number of [[k8s.label|labels]] — `key=value` pairs in `metadata.labels`: `app=web`, `tier=frontend`, `env=prod`. Labels by themselves do nothing. Their point is selectors: a selector is a query "all objects with app=web". Almost every link in Kubernetes works like that: not "here is a list of pod names" but "the pods that match a condition". A pod appears with the right label — it is in the set; the label is removed — it drops out.\n\nIn the terminal that is `kubectl get pods --show-labels` (labels as a column) and `kubectl get pods -l app=web` (only the matching ones).\n\nNext to labels lives the [[k8s.namespace|namespace]] — a folder for objects. Names are unique inside a namespace, permissions are granted per namespace, `kubectl get pods` shows the pods of the current namespace (`-n shop` another one, `-A` all of them). Mind the homonyms: a Kubernetes namespace has nothing to do with the Linux namespaces of the containers block. It isolates neither processes nor the network — pods in different namespaces see each other perfectly well by default.',
      ),
    },
    {
      id: 'loop',
      kind: 'text',
      step: 'explain',
      title: bi('Контроллер — петля', 'A controller is a loop'),
      body: bi(
        '[[k8s.controller|Контроллер]] — программа, которая делает одно и то же бесконечно: смотрит, сколько должно быть, смотрит, сколько есть, и делает один шаг, чтобы разница уменьшилась. Как термостат: вы задаёте 21 градус, он сравнивает с тем, что в комнате, и включает или выключает обогрев. Ему неважно, почему стало холодно — открыли окно или сломалась батарея.\n\nСамый простой контроллер держит число подов. Его объект — [[k8s.replicaset|ReplicaSet]]: в нём `replicas` (сколько), `selector` (какие поды считать своими) и `template` (из чего делать новые). Удалили под — разница +1 — контроллер создал новый по шаблону. Добавили лишний с подходящей меткой — разница −1 — контроллер удалил один.',
        'A [[k8s.controller|controller]] is a program that does the same thing forever: looks at how many there should be, looks at how many there are, and takes one step to shrink the difference. Like a thermostat: you set 21 degrees, it compares with the room and switches the heating on or off. It does not care why it got cold — an open window or a broken radiator.\n\nThe simplest controller keeps a number of pods. Its object is the [[k8s.replicaset|ReplicaSet]]: `replicas` (how many), `selector` (which pods count as its own) and `template` (what to make new ones from). A pod was deleted — a difference of +1 — the controller created a new one from the template. An extra one with a matching label appeared — a difference of −1 — the controller deleted one.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s.reconcile', caption: bi('Меняйте replicas, удаляйте под, подбрасывайте «чужой» под и снимайте метку — петля пересчитывается сразу.', 'Change replicas, delete a pod, add a "foreign" pod, remove a label — the loop is recomputed at once.') },
    {
      id: 'store',
      kind: 'text',
      step: 'explain',
      title: bi('Где лежит желаемое и кто чей', 'Where the desired state lives, and who owns whom'),
      body: bi(
        'Контроллер ничего не хранит в своей памяти. Желаемое лежит в [[k8s.etcd|etcd]] — хранилище «ключ — значение» за API-сервером: ваш ReplicaSet — это запись `/registry/replicasets/default/web`. Каждая её правка получает новый номер `resourceVersion`. Контроллер можно перезапустить, перенести на другую машину — он прочитает желаемое заново и продолжит.\n\nКак ReplicaSet отличает свои поды от чужих с той же меткой? По полю [[k8s.owner|ownerReferences]] в metadata пода: там записано «мой хозяин — ReplicaSet web, uid такой-то». Под без хозяина, подходящий под селектор, ReplicaSet «усыновляет» — дописывает себя хозяином. Под, с которого сняли метку, он отпускает. А когда удаляют сам ReplicaSet, сборщик мусора находит всех, у кого он записан хозяином, и удаляет их тоже — если не попросить `--cascade=orphan`.\n\nОткуда контроллер узнаёт об изменениях, не опрашивая API каждую секунду? Через [[k8s.watch|watch]]: подписку «сообщай мне обо всех изменениях подов, начиная с resourceVersion N». Библиотека контроллера держит по этим событиям локальный кэш (информер) и кладёт в очередь ключ изменившегося объекта — один ключ, сколько бы событий ни пришло. Поэтому контроллер, который стоял минуту, не разбирает пропущенную историю, а один раз смотрит на то, что есть сейчас.',
        'A controller keeps nothing in its memory. The desired state lives in [[k8s.etcd|etcd]], the key-value store behind the API server: your ReplicaSet is the record `/registry/replicasets/default/web`. Every edit of it gets a new `resourceVersion` number. The controller can be restarted or moved to another machine — it reads the desired state again and carries on.\n\nHow does a ReplicaSet tell its own pods from others with the same label? By the [[k8s.owner|ownerReferences]] field in the pod metadata: it says "my owner is ReplicaSet web, uid so-and-so". A pod without an owner that matches the selector is "adopted" — the ReplicaSet writes itself in as the owner. A pod that lost its label is let go. And when the ReplicaSet itself is deleted, the garbage collector finds everyone who lists it as their owner and deletes them too — unless you ask for `--cascade=orphan`.\n\nHow does the controller learn about changes without polling the API every second? Through [[k8s.watch|watch]]: a subscription "tell me about every change to pods starting from resourceVersion N". The controller library keeps a local cache (an informer) from these events and puts the key of the changed object into a queue — one key, however many events arrive. That is why a controller that was stopped for a minute does not work through the missed history, but looks once at what is there now.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: RS_LAB,
      intro: bi('В домашнем каталоге — `rs.yaml`, ReplicaSet на три пода. `cluster etcd /registry/replicasets` покажет ключ в etcd и его ревизию.', 'Your home directory has `rs.yaml`, a ReplicaSet of three pods. `cluster etcd /registry/replicasets` shows the key in etcd and its revision.'),
      tasks: [
        {
          id: 'apply',
          prompt: bi('Создайте ReplicaSet из `rs.yaml` и дождитесь трёх готовых подов.', 'Create the ReplicaSet from `rs.yaml` and wait for three ready pods.'),
          check: { when: "k8s.pods[owner='ReplicaSet/web'][ready=true]#=3" },
          chips: 'kubectl apply -f rs.yaml',
          concepts: ['k8s.replicaset'],
          hints: { H1: bi('Так же, как под в прошлом уроке.', 'The same way as the pod in the previous lesson.') },
        },
        {
          id: 'kill',
          prompt: bi('Удалите любой под этого ReplicaSet и убедитесь, что подов снова три.', 'Delete any pod of this ReplicaSet and make sure there are three pods again.'),
          check: { when: "k8s.timeline[type=DELETED][kind=Pod]#>=1 && k8s.pods[owner='ReplicaSet/web'][ready=true]#=3", fail: [{ if: "k8s.timeline[type=DELETED][kind=Pod]#=0", say: bi('Ещё ни один под не удалён. Имена подов покажет `kubectl get pods`.', 'No pod has been deleted yet. `kubectl get pods` shows the pod names.') }] },
          chips: 'kubectl delete pod <name>',
          concepts: ['k8s.controller'],
          hints: { H1: bi('Имя возьмите из `kubectl get pods`: web-xxxxx.', 'Take the name from `kubectl get pods`: web-xxxxx.') },
        },
        {
          id: 'scale',
          prompt: bi('Измените желаемое: пусть подов будет пять.', 'Change the desired state: let there be five pods.'),
          check: { when: "k8s.objects[kind=ReplicaSet][metadata.name=web].spec.replicas=5 && k8s.pods[owner='ReplicaSet/web']#=5" },
          chips: 'kubectl scale rs web --replicas=5',
          docRef: { page: 'help/kubectl-scale', anchor: 'EXAMPLES', line: 'kubectl scale --replicas=3 rs/foo' },
          hints: { H1: bi('Число реплик меняет отдельная команда kubectl.', 'A separate kubectl command changes the number of replicas.'), H2: bi('`kubectl scale … --replicas=…`', '`kubectl scale … --replicas=…`') },
        },
        {
          id: 'labels',
          prompt: bi('Выведите поды вместе со всеми их метками.', 'List the pods together with all their labels.'),
          check: { stdout: /LABELS[\s\S]*app=web/ },
          chips: 'kubectl get pods --show-labels',
          docRef: { page: 'help/kubectl-get', anchor: 'OPTIONS', line: '--show-labels' },
          docStep: 3,
          concepts: ['k8s.label'],
          hints: { H1: bi('Это флаг get; ищите в Options слово labels.', 'It is a flag of get; look for the word labels in Options.') },
        },
        {
          id: 'orphan',
          prompt: bi('Выведите один под из ReplicaSet, не удаляя его: смените ему метку на `app=debug`. Подов `app=web` должно остаться пять.', 'Take one pod out of the ReplicaSet without deleting it: change its label to `app=debug`. Five `app=web` pods must remain.'),
          check: {
            when: "k8s.pods[labels.app=debug][owner='']#=1 && k8s.pods[owner='ReplicaSet/web']#=5",
            fail: [{ if: "k8s.pods[labels.app=debug]#=1 && k8s.pods[owner='ReplicaSet/web']#<5", say: bi('Подождите секунду и посмотрите `kubectl get pods`: ReplicaSet уже создаёт замену.', 'Wait a second and look at `kubectl get pods`: the ReplicaSet is already creating a replacement.') }],
          },
          chips: 'kubectl label pod <name> app=debug --overwrite',
          concepts: ['k8s.owner', 'k8s.label'],
          docRef: { page: 'help/kubectl-label', anchor: 'EXAMPLES', line: '--overwrite' },
          hints: { H1: bi('Метки меняет kubectl label; существующую метку перезаписывают явным флагом.', 'kubectl label changes labels; an existing label is overwritten with an explicit flag.') },
        },
        {
          id: 'ns',
          prompt: bi('Создайте namespace `team-a` и посмотрите поды во всех namespace сразу.', 'Create the namespace `team-a` and look at the pods in all namespaces at once.'),
          check: { when: 'k8s.objects[kind=Namespace][metadata.name=team-a]#=1', stdout: /NAMESPACE\s+NAME/ },
          chips: 'kubectl create namespace team-a && kubectl get pods -A',
          concepts: ['k8s.namespace'],
          hints: { H1: bi('Namespace создаётся командой create; «все namespace» — короткий флаг -A.', 'A namespace is created with create; "all namespaces" is the short flag -A.') },
        },
      ],
    },
    {
      id: 'your-loop',
      kind: 'text',
      step: 'try',
      title: bi('Ваша первая петля', 'Your first loop'),
      body: bi(
        'Теперь напишите контроллер сами. Задача на знакомых объектах: у каждого namespace с меткой `team` должен быть ConfigMap `team-info` (ConfigMap — простая запись «ключ — значение»; подробно о нём урок о конфигурации). Функция `reconcile(ns, k)` вызывается для каждого namespace снова и снова: `k.get` читает, `k.create` создаёт. Запустите петлю, создайте namespace кнопкой, удалите ConfigMap руками — и посмотрите, как ваша петля вернёт его.',
        'Now write a controller yourself. A task on familiar objects: every namespace with the label `team` must have a ConfigMap `team-info` (a ConfigMap is a simple key-value record; the configuration lesson covers it in detail). The function `reconcile(ns, k)` is called for every namespace again and again: `k.get` reads, `k.create` creates. Start the loop, create a namespace with a button, delete the ConfigMap by hand — and watch your loop bring it back.',
      ),
    },
    { id: 'lab-loop', kind: 'widget', step: 'practice', widget: 'k8s.controller-lab', props: { exercise: 'team-info' } },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: reconcileQuiz.map((q) => q.id) },
  ],
};
