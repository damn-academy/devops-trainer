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
    prompt: bi('Что делал диспетчер, раскладывая контейнеры руками, и что потом возьмёт на себя система? Отметьте все верные ответы.', 'What did the "dispatcher by hand" do that a system will take over? Mark everything that is true.'),
    options: [
      { id: 'place', text: bi('Выбирал для каждого контейнера сервер, на котором хватит памяти', 'Chose a server for every container, minding the memory'), correct: true },
      { id: 'watch', text: bi('Следил, чтобы всё работало, и заново запускал то, что остановилось', 'Watched that everything worked and moved what fell over'), correct: true },
      { id: 'list', text: bi('Держал список того, что должно быть запущено', 'Kept the list of what must be running'), correct: true },
      { id: 'code', text: bi('Исправлял ошибки в коде приложения', 'Fixed bugs in the application code'), why: bi('Система запускает и перезапускает программы, но код за вас не исправляет. Если программа в контейнере аварийно завершается из-за ошибки в коде, она будет завершаться так же после каждого перезапуска.', 'The system starts and restarts programs, but it does not fix your code: a container that crashes because of a bug keeps crashing.') },
    ],
    explain: bi('Выбор места, слежение за серверами и список желаемого — три работы, которые в следующих уроках получат свои имена: место выбирает планировщик, следит контроллер, а список называется желаемым состоянием.', 'Choosing a place, watching and the list of what is wanted are three jobs that get names in the next lessons: the scheduler, the controller, the desired state.'),
  },
  {
    id: 'k8s.q.why.desired',
    kind: 'mcq',
    concepts: ['k8s.desired-state'],
    prompt: bi('Ночью выключился сервер, на котором работали два контейнера. Что нужно системе, чтобы запустить их снова без вашего участия?', 'A server with two containers went dark at night. What does a system need to bring them back without you?'),
    options: [
      { id: 'list', text: bi('Записанное желаемое состояние, то есть перечень контейнеров, которые должны работать, и их количество', 'A recorded desired state: what must run and how many'), correct: true },
      { id: 'log', text: bi('Журнал команд, которыми вы запускали контейнеры', 'The log of the commands you used to start the containers'), why: bi('Журнал рассказывает, что когда-то сделали, а не что должно работать сейчас. Повторять старые команды вслепую опасно, потому что часть из них уже не нужна.', 'A log tells what was done, not what must be. Replaying old commands blindly is risky: some of them are no longer wanted.') },
      { id: 'backup', text: bi('Резервная копия выключившегося сервера', 'A backup of the server that went dark'), why: bi('Копия поможет восстановить тот же сервер, а системе нужно запустить контейнеры на других серверах. Для этого ей нужен список того, что должно работать, а не образ диска.', 'A backup helps to bring the same server back, but the system has to start the containers elsewhere — for that it needs a list, not a disk image.') },
    ],
    explain: bi('Желаемое состояние описывает, что должно работать, и ничего не приказывает. Пока описание хранится, систему можно в любой момент сравнить с ним и исправить разницу.', 'The desired state is a description, not a command. As long as it is stored, it can be compared with what is there and the difference fixed at any moment.'),
  },
];

export const whyLesson: Lesson = {
  id: 'k8s-1.why',
  block: 'k8s-1',
  title: bi('Зачем нужна оркестрация', 'Why orchestration'),
  summary: bi('На примере пяти контейнеров на трёх серверах урок показывает, что приходится делать руками, чтобы они работали, и какие три работы возьмёт на себя система.', 'Five containers on three servers: what you have to do by hand and which three jobs a system takes over.'),
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
        'Kubernetes упоминается почти в каждой вакансии инженера DevOps, и на собеседовании одним из первых звучит вопрос, какую работу он делает за людей. Этот урок отвечает на него на простом примере. В блоке о контейнерах вы запускали `docker run` на одной машине. Теперь у компании три сервера и пять контейнеров: два экземпляра магазина, два экземпляра API и кэш, и каждому нужна своя доля памяти. Ночью один из серверов выключится, а утром выйдет новая версия магазина, которую нужно выложить так, чтобы сайт ни на минуту не перестал отвечать. В этом уроке вы сначала проделаете всё это руками и посчитаете, сколько времени уходит, а потом увидите, какую часть работы можно отдать программе.',
        'Kubernetes is mentioned in almost every DevOps engineer job posting, and one of the first interview questions is what work it does instead of people. This lesson answers it with a simple example. In the containers block you ran `docker run` on one machine. Now the company has three servers and five containers: two instances of the shop, two of the API and a cache, and each needs its share of memory. At night one of the servers will go down, and in the morning a new version of the shop comes out and has to be rolled out without the site stopping for a minute. In this lesson you first do all of it by hand and count the time it takes, then see which part of the work can be handed to a program.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как раскладывают контейнеры по серверам', 'How containers are placed on servers'),
      body: bi(
        'Схема ниже показывает работу диспетчера, то есть того, кто решает, какой контейнер на каком сервере запустить. Сначала диспетчером работаете вы сами. Слева вверху лежит список того, что должно работать: пять контейнеров и память, которая нужна каждому. Посередине стоит диспетчер, а внизу появятся три сервера, на каждом из которых для контейнеров есть 4 ГБ памяти.',
        'The diagram below shows the work of a dispatcher, whoever decides which container runs on which server. At first the dispatcher is you. Top left lies the list of what must run: five containers and the memory each needs. In the middle is the dispatcher, and at the bottom three servers will appear, each with 4 GB of memory for containers.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s.dispatch', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. На каждом шаге подсвечен один блок, тот, который работает сейчас, а облачко рядом с ним говорит, что он делает. По линиям от диспетчера к серверам движутся карточки с именами контейнеров, которые он запускает. Под схемой растёт счётчик минут, которые ушли на работу.\n\nКогда пройдёте раскладку до конца, включите в «Параметрах» ночное выключение сервера 2 и утреннюю выкладку версии 2 и пройдите схему ещё раз: посмотрите, на каком шаге уходит больше всего времени. Потом выберите в поле «Кто раскладывает контейнеры» программу и сравните счётчик. Напоследок включите в блоке «Сломать» поломку, при которой список никто не записал, и посмотрите, на каком шаге останавливается работа.', 'Press “Start from the first step”, then go on with “Step forward” above the diagram. At every step one block is highlighted, the one working now, and the callout next to it says what it does. Cards with container names travel from the dispatcher to the servers. Under the diagram a counter of minutes grows.\n\nOnce you reach the end, turn on the night failure of server 2 and the morning rollout of version 2 in “Parameters” and walk the diagram again: see which step takes most of the time. Then choose a program in “Who places the containers” and compare the counter. Finally, switch on the break in “Break it” where nobody wrote down the list, and see at which step the work stops.'), caption: bi('Посмотрите ещё раз на счётчик минут, и вы увидите, что почти всё время уходит не на сами команды, а на то, чтобы заметить сбой и вспомнить, что где должно работать. В следующем разделе эти три работы разобраны по очереди, и у каждой появится имя.', 'Look at the minute counter again: almost all the time goes not into the commands themselves but into noticing the failure and remembering what must run where. The next section takes these three jobs one by one and gives each a name.') },
    {
      id: 'explain',
      kind: 'text',
      step: 'explain',
      title: bi('Три работы диспетчера', 'The three jobs of a dispatcher'),
      body: bi(
        'Когда вы раскладывали контейнеры руками, вы делали три разные работы, хотя казалось, что одну.\n\n- **Выбирали место.** Для каждого контейнера нужно было найти сервер, на котором хватит памяти. Если ошибиться, контейнер не запустится или вытеснит соседа.\n- **Следили.** Кто-то должен заметить, что сервер выключился, и запустить его контейнеры на других серверах. Ночью этим «кем-то» становится звонок рассерженного клиента.\n- **Помнили список.** Чтобы восстановить пропавшее, нужно знать, что должно работать и в скольких экземплярах.\n\nСистема, которая делает эти три работы вместо вас, называется оркестратором, а машины, которыми она управляет как одним целым, называются [[k8s.cluster|кластером]]. Каждая машина кластера называется [[k8s.node|узлом]]. Из трёх работ важнее всего третья. Вы больше не говорите системе «запусти контейнер на втором сервере», а записываете [[k8s.desired-state|желаемое состояние]]: «магазин в двух экземплярах, каждому по 512 МБ памяти». Система сама сравнивает записанное с тем, что работает на самом деле, и исправляет разницу. Когда сервер выключается, появляется разница, и система запускает недостающие контейнеры в другом месте. Никто не отдавал системе команду, потому что команду заменило описание.\n\nСамый распространённый оркестратор контейнеров называется Kubernetes. Его создали в Google на опыте внутренней системы Borg и в 2014 году открыли его код, а с 2016 года проектом управляет фонд CNCF. В следующих уроках у трёх работ появятся имена и места в кластере: список хранит API-сервер, за порядком следят контроллеры, а место для каждого контейнера выбирает планировщик.',
        'By hand you did three different things, even though it felt like one.\n\n- **You chose a place.** For every container, a server with enough memory. Get it wrong and the container does not start or pushes out its neighbour.\n- **You watched.** Someone has to notice that a server went dark and move its containers. At night that "someone" is a customer’s phone call.\n- **You remembered the list.** To restore what disappeared you have to know what must run at all, and in how many copies.\n\nA system that does these three jobs for you is called an orchestrator, and the machines it runs as one are a [[k8s.cluster|cluster]]. Each machine of the cluster is a [[k8s.node|node]]. The most important item is the third. You no longer say "start a container on the second server". You write down the [[k8s.desired-state|desired state]] — "the shop in two copies, 512 MB each" — and the system compares it with what is there and fixes the difference. A server goes dark — a difference appears — the containers are restarted elsewhere. Nobody gave an order: a description took its place.\n\nKubernetes is the most widely used container orchestrator. Google built it on the experience of its internal system Borg and opened it in 2014; since 2016 the project has lived in the CNCF foundation. In the next lessons the three jobs get names and places: the API server keeps the list, controllers watch, the scheduler picks the place.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: whyQuiz.map((q) => q.id) },
    { id: 'note', kind: 'callout', tone: 'why', step: 'review', body: bi('Kubernetes не делает приложение надёжным сам по себе. Он только поддерживает желаемое состояние: если программа аварийно завершается из-за ошибки, Kubernetes будет терпеливо перезапускать её снова и снова, и вы заметите это по растущему счётчику перезапусков.\n\nПо той же причине Kubernetes не даёт готовой платформы. Сам он не копирует базу данных на запасной сервер, не снимает резервных копий, не выпускает сертификатов HTTPS и не следит за тем, что сайт отвечает пользователям. Каждую из этих задач решает отдельная программа, которую ставят в кластер: оператор базы данных, менеджер сертификатов, система мониторинга. Как они устроены и почему все работают по той же схеме, что и сам Kubernetes, вы увидите дальше в этом блоке.', 'Kubernetes does not make an application reliable by itself. It holds the desired state: if a program crashes because of a bug, it patiently restarts it — and you see that in a growing restart counter.\n\nFor the same reason Kubernetes does not give you a ready platform. By itself it does not copy a database to a standby server, take backups, issue HTTPS certificates or watch whether the site answers its users. Each of these jobs is done by a separate program installed into the cluster: a database operator, a certificate manager, a monitoring system. How they are built, and why they all work the same way as Kubernetes itself, you will see later in this block.') },
  ],
};

// ── KM01 ────────────────────────────────────────────────────────────────────

export const podQuiz: QuizItem[] = [
  {
    id: 'k8s.q.pod.delete',
    kind: 'mcq',
    key: true,
    concepts: ['k8s.pod'],
    prompt: bi('Вы создали под командой `kubectl run web --image=trainer/web:1.0`, а потом выполнили `kubectl delete pod web`. Что произойдёт?', 'You created a pod with `kubectl run web --image=trainer/web:1.0` and then ran `kubectl delete pod web`. What happens?'),
    options: [
      { id: 'gone', text: bi('Под исчезнет и больше не появится', 'The pod is gone for good'), correct: true },
      { id: 'back', text: bi('Kubernetes сразу создаст новый под', 'Kubernetes creates a new one at once'), why: bi('Новый под создаёт не Kubernetes как целое, а контроллер, которому под принадлежит. У пода, созданного командой `kubectl run`, хозяина нет, и восстанавливать его некому.', 'A new pod is created not by Kubernetes "in general" but by the controller that owns the pod. A lone pod has no owner.') },
      { id: 'ask', text: bi('kubectl попросит подтвердить удаление', 'kubectl asks for confirmation'), why: bi('kubectl ни о чём не переспрашивает, и команда `delete` сразу отправляет в API запрос на удаление.', 'kubectl asks nothing: delete sends the DELETE request to the API at once.') },
    ],
    explain: bi('Под может исчезнуть в любой момент, и сам он не возвращается. Чтобы правило «должно работать три пода» соблюдалось без вашего участия, нужен объект-хозяин и его контроллер, и об этом следующий урок.', 'A pod is a mortal unit. For "three pods must run" to hold by itself you need an owner object and its controller — that is the next lesson.'),
    refs: { lesson: 'k8s-1.reconcile' },
  },
  {
    id: 'k8s.q.pod.port',
    kind: 'mcq',
    concepts: ['k8s.pod'],
    prompt: bi('В одном поде два контейнера, и оба хотят слушать порт 80. Получится ли это?', 'One pod has two containers, both want to listen on port 80. Will it work?'),
    options: [
      { id: 'no', text: bi('Нет, у контейнеров одного пода общее сетевое пространство имён и общий localhost', 'No, the containers of a pod share one network namespace and one localhost'), correct: true },
      { id: 'yes', text: bi('Да, потому что у каждого контейнера свой IP-адрес', 'Yes, because every container has its own IP'), why: bi('IP-адрес принадлежит поду, а не контейнеру. Поэтому второй контейнер, который попробует занять тот же порт, получит ошибку «address already in use».', 'The IP belongs to the pod, not to the container. The second bind on the same port gets "address already in use".') },
    ],
  },
  {
    id: 'k8s.q.pod.fields',
    kind: 'match',
    concepts: ['k8s.api-object'],
    prompt: bi('Сопоставьте поле объекта API с тем, что в нём записано.', 'Match the field of an API object with what it holds.'),
    pairs: [
      { id: 'kind', left: 'kind', right: bi('вид объекта: Pod, Service и другие', 'the kind of object: Pod, Service…') },
      { id: 'meta', left: 'metadata', right: bi('имя, namespace и метки', 'name, namespace, labels') },
      { id: 'spec', left: 'spec', right: bi('чего вы хотите', 'what you want') },
      { id: 'status', left: 'status', right: bi('что есть на самом деле (это поле заполняет кластер)', 'what actually is (the cluster writes it)'), why: bi('Поле status заполняете не вы, а компоненты кластера, например kubelet на узле.', 'You do not write status: the cluster components fill it in, the kubelet for example.') },
    ],
  },
  {
    id: 'k8s.q.pod.where',
    kind: 'mcq',
    concepts: ['k8s.kubeconfig'],
    prompt: bi('Откуда kubectl знает, к какому кластеру обращаться?', 'How does kubectl know which cluster to talk to?'),
    options: [
      { id: 'kc', text: bi('Из текущего контекста в файле kubeconfig (по умолчанию ~/.kube/config)', 'From the current context in kubeconfig (~/.kube/config)'), correct: true },
      { id: 'dns', text: bi('Сам находит кластер в локальной сети', 'It finds the cluster on the local network'), why: bi('kubectl ничего не ищет в сети, потому что адрес сервера явно записан в kubeconfig.', 'kubectl looks for nothing: the server address is written in kubeconfig explicitly.') },
      { id: 'env', text: bi('Только из переменной окружения KUBERNETES_HOST', 'Only from the KUBERNETES_HOST environment variable'), why: bi('Такой переменной kubectl не читает. Переменная KUBECONFIG существует, но она только указывает другой путь к тому же файлу настроек.', 'kubectl does not read such a variable; the KUBECONFIG variable only changes the path to the same file.') },
    ],
  },
  {
    id: 'k8s.q.pod.status',
    kind: 'predict-output',
    concepts: ['k8s.pod'],
    prompt: bi('Полминуты назад создан под, у образа которого указан несуществующий тег. Что напечатает в столбце STATUS команда `kubectl get pod report`?', 'A pod with a non-existent image tag was created half a minute ago. What does STATUS show in `kubectl get pod report`?'),
    command: 'kubectl run report --image=trainer/web:typo >/dev/null; cluster ff 30s >/dev/null; kubectl get pod report --no-headers',
    setup: { hostname: 'laptop', ext: { k8s: {} } },
    options: [
      { id: 'backoff', text: 'ImagePullBackOff', correct: true },
      { id: 'pending', text: 'Pending', why: bi('Статус Pending под показывал, пока планировщик не выбрал для него узел. Здесь узел уже выбран, kubelet пытается скачать образ и между попытками ждёт.', 'Pending was before the scheduler chose a node. Here the node is chosen and the kubelet tries to pull the image — and waits before the next try.') },
      { id: 'crash', text: 'CrashLoopBackOff', why: bi('Такой статус под показывает, когда контейнер запустился и аварийно завершился. Здесь контейнер даже не запускался, потому что образа нет.', 'That status is about a container that started and crashed. Here it never started: there is no image.') },
    ],
    explain: bi('Статус ErrImagePull под показывает сразу после неудачной загрузки образа, а ImagePullBackOff — пока kubelet ждёт перед следующей попыткой. Паузы между попытками растут: 10 секунд, 20 секунд и так далее, до пяти минут. Причину покажет команда `kubectl describe pod report` в разделе Events.', 'ErrImagePull right after a failed pull, ImagePullBackOff while the kubelet waits before the next try (10 s, 20 s, … up to 5 minutes). `kubectl describe pod report`, the Events section, shows why.'),
  },
];

export const firstPodLesson: Lesson = {
  id: 'k8s-1.first-pod',
  block: 'k8s-1',
  title: bi('Первый под', 'The first pod'),
  summary: bi('Kubernetes принимает не команду, а описание. В уроке вы узнаете, что такое под и объект API, как kubectl находит кластер через kubeconfig и где смотреть status и события.', 'Kubernetes takes a description, not a command: the pod, the API object, kubectl and kubeconfig, status and events.'),
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
        'Команда `docker run -d -p 8080:80 trainer/web:1.0` — это приказ: запусти контейнер здесь и сейчас. Кластеру так не приказывают. Ему передают записку: «хочу, чтобы работал контейнер из образа trainer/web:1.0». Дальше кластер сам решает, на каком [[k8s.node|узле]] его запустить, и сам следит, чтобы записка оставалась правдой. В этом уроке вы передадите кластеру первую такую записку и посмотрите, что с ней происходит дальше.',
        '`docker run -d -p 8080:80 trainer/web:1.0` is an order: "start it here and now". You do not talk to a cluster like that. You hand it a note: "I want a container from trainer/web:1.0 running". The cluster then decides which [[k8s.node|node]] it goes to and keeps the note true. In this lesson you hand in your first such note and watch what happens to it.',
      ),
    },
    {
      id: 'pod',
      kind: 'text',
      step: 'explain',
      title: bi('Что такое под и как кластер его запускает', 'What a pod is and how the cluster starts it'),
      body: bi(
        'Kubernetes не запускает контейнеры поодиночке. Самое малое, что он умеет запускать, называется [[k8s.pod|подом]]: это один или несколько контейнеров, у которых общее сетевое пространство имён, а значит, общий IP-адрес и общий `localhost`, и которые всегда работают на одном узле. Чаще всего в поде один контейнер. Второй добавляют, когда ему нужно работать бок о бок с первым, например сборщик логов, который читает тот же каталог, куда пишет приложение.\n\nИз этого сразу следуют два вывода. Во-первых, два контейнера одного пода не могут слушать один и тот же порт, так же как не могут два процесса на одной машине. Во-вторых, под не вечен. Его можно удалить, его могут выселить с узла, сам узел может выключиться, и тогда под пропадает вместе со своим IP-адресом. Как сделать так, чтобы на месте пропавшего пода появлялся новый, вы узнаете в следующем уроке.',
        'Kubernetes does not run containers one by one. Its smallest unit is the [[k8s.pod|pod]]: one or more containers that share a network namespace — so one IP and one `localhost` — and always land on the same node. Most pods have one container; a second one is added when it has to live next to the first, for example a log collector reading the same directory.\n\nA simple consequence: two containers of one pod cannot listen on the same port, just as two processes on one machine cannot. And another: a pod is mortal. It can be deleted, evicted from its node, the node can go dark — and then the pod is gone, together with its IP. How to have a new one appear in place of a lost one is the topic of the next lesson.',
      ),
    },
    {
      id: 'object',
      kind: 'text',
      step: 'explain',
      title: bi('Записку для кластера называют объектом API', 'The note is an API object'),
      body: bi(
        'Записку для кластера пишут на языке YAML. В вашем домашнем каталоге лежит файл `pod.yaml`:\n\n```yaml\napiVersion: v1\nkind: Pod\nmetadata:\n  name: web\n  labels:\n    app: web\nspec:\n  containers:\n  - name: web\n    image: trainer/web:1.0\n    ports:\n    - containerPort: 80\n```\n\nТакая записка называется [[k8s.api-object|объектом API]], а файл, в котором она записана, инженеры называют манифестом. Дальше в курсе мы будем говорить «манифест `pod.yaml`», и это та же самая записка. У каждого объекта одни и те же части. Поля `apiVersion` и `kind` говорят, что это за объект. В `metadata` записаны его имя и метки. В `spec` записано, чего вы хотите, и в этом файле вы хотите один контейнер из образа `trainer/web:1.0`. Четвёртую часть, `status`, вы не пишете. Её заполняет кластер, и в ней сказано, что есть на самом деле: в какой фазе под, какой у него IP-адрес и в каком состоянии контейнеры. Поля `spec` и `status` в одном объекте — это те самые желаемое и фактическое состояния, о которых шла речь в прошлом уроке.\n\nЗаписку вы отправляете командой `kubectl apply -f pod.yaml`, а получает её [[k8s.apiserver|API-сервер]], единственный вход в кластер. Он проверяет, кто вы и разрешено ли вам это действие, дописывает значения по умолчанию, проверяет объект по схеме и сохраняет его. На этом работа API-сервера заканчивается, потому что сам он ничего не запускает. Кто запустит контейнер, вы увидите чуть позже.',
        'The note for the cluster is written in YAML. Your home directory has `pod.yaml`:\n\n```yaml\napiVersion: v1\nkind: Pod\nmetadata:\n  name: web\n  labels:\n    app: web\nspec:\n  containers:\n  - name: web\n    image: trainer/web:1.0\n    ports:\n    - containerPort: 80\n```\n\nSuch a note is an [[k8s.api-object|API object]], and the file it is written in is what engineers call a manifest. From here on the course says “the manifest `pod.yaml`”, and it is the same note. Every object has the same parts. `apiVersion` and `kind` say what kind of object it is. `metadata` holds the name and the labels. `spec` is what you want: here, one container from the `trainer/web:1.0` image. The fourth part, `status`, you do not write: the cluster fills it in, and it says what actually is — the pod phase, its IP, the state of the containers. `spec` and `status` side by side in one object are the desired and the actual state from the previous lesson.\n\nYou send the note with `kubectl apply -f pod.yaml`. The [[k8s.apiserver|API server]] receives it — the only door of the cluster. It checks who you are and whether you may, fills in defaults, validates the object against its schema and stores it. That is where its work ends: the API server itself starts nothing. Who starts the process, you will see a bit later.',
      ),
    },
    {
      id: 'kubeconfig',
      kind: 'text',
      step: 'explain',
      title: bi('Куда обращается kubectl', 'Where kubectl knocks'),
      body: bi(
        'Программа `kubectl` служит клиентом кластера и превращает ваши команды и файлы в HTTP-запросы к API-серверу. Адрес сервера и ключ, которым kubectl представляется серверу, записаны в файле [[k8s.kubeconfig|kubeconfig]], по умолчанию это `~/.kube/config`. В файле три списка: кластеры с их адресами, пользователи с их ключами и контексты. Контекст — это пара «кластер и пользователь», к которой можно добавить namespace по умолчанию, то есть папку для объектов кластера. Это не пространство имён Linux, о котором шла речь выше, а подробно о namespace Kubernetes рассказывает следующий урок. Команда `kubectl config view --minify` покажет текущий контекст, а ключи заменит строкой `DATA+OMITTED`.\n\nКогда кластеров станет несколько, ошибка в контексте обойдётся дорого: команда, которую вы готовили для учебного стенда, уйдёт в рабочий кластер. Поэтому опытные инженеры перед опасной командой проверяют контекст командой `kubectl config current-context`, а на экзаменах каждое задание начинается с команды `kubectl config use-context …`.',
        '`kubectl` is a client: it turns your commands and files into HTTP requests to the API server. The server address and the key kubectl introduces itself with are in the [[k8s.kubeconfig|kubeconfig]] file — `~/.kube/config` by default. It holds three lists: clusters (addresses), users (keys) and contexts — "cluster + user" pairs, optionally with a default namespace, that is, a folder for cluster objects. This is not the Linux namespace mentioned above; the next lesson covers Kubernetes namespaces in detail. `kubectl config view --minify` shows the current context and replaces the keys with `DATA+OMITTED`.\n\nOnce you have several clusters, a wrong context gets expensive: a command meant for a lab goes to production. That is why experienced people check `kubectl config current-context` before dangerous commands, and every exam task starts with `kubectl config use-context …`.',
      ),
    },
    {
      id: 'events',
      kind: 'text',
      step: 'explain',
      title: bi('Где кластер рассказывает, что произошло с объектом', 'Where the cluster tells what happened to an object'),
      body: bi(
        'Поле `status` говорит, в каком состоянии объект сейчас, но не говорит, как он к этому пришёл. Для этого компоненты кластера записывают [[k8s.events|события]], то есть короткие объекты Event с отметкой времени: «планировщик назначил под на узел», «kubelet скачивает образ», «контейнер запущен». События видны в конце вывода `kubectl describe pod web`, в разделе Events, и все сразу в выводе `kubectl get events`. У каждой строки есть столбцы Type (Normal для обычных событий и Warning для тревожных), Reason с причиной одним словом, From с именем компонента, который записал событие, и Message с подробностями. Например, строка `Normal  Scheduled  default-scheduler  Successfully assigned default/web to worker-1` значит, что планировщик default-scheduler поставил под web на узел worker-1. События хранятся около часа, поэтому разбирать сбой лучше сразу.',
        'The `status` field says what state an object is in now, but not how it got there. For that, cluster components write [[k8s.events|events]], short Event objects with a timestamp: “the scheduler assigned the pod to a node”, “the kubelet is pulling the image”, “the container started”. Events are shown at the end of `kubectl describe pod web`, in the Events section, and all at once by `kubectl get events`. Each line has the columns Type (Normal for ordinary events, Warning for alarming ones), Reason with a one-word cause, From with the component that wrote the event, and Message with the details. For example, the line `Normal  Scheduled  default-scheduler  Successfully assigned default/web to worker-1` means that the scheduler default-scheduler put pod web on node worker-1. Events are kept for about an hour, so it is best to examine a failure right away.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: FIRST_POD,
      intro: bi('Перед вами учебный кластер из трёх узлов на k3s, который работает прямо в браузере. Сломать его нельзя: если что-то пошло не так, перезагрузите страницу, и кластер вернётся в начальное состояние. Команда `cluster ff 30s` проматывает время кластера на 30 секунд вперёд. Это инструмент тренажёра, в настоящем Kubernetes такой команды нет.', 'A three-node training cluster (k3s) in the browser. You cannot break it: if something goes wrong, reload the page and the cluster returns to its initial state. `cluster ff 30s` fast-forwards cluster time — a trainer tool, not Kubernetes.'),
      tasks: [
        {
          id: 'apply',
          prompt: bi('Отправьте в кластер манифест `pod.yaml` и дождитесь, пока под `web` перейдёт в состояние Running.', 'Send the manifest `pod.yaml` to the cluster and wait until pod `web` is Running.'),
          check: {
            when: "k8s.pods[ns=default][name=web][phase=Running]#=1",
            fail: [{ if: "k8s.pods[ns=default][name=web]#=1", say: bi('Под создан, но ещё не перешёл в состояние Running: kubelet скачивает образ и запускает контейнер. Посмотрите ещё раз через пару секунд командой `kubectl get pods`.', 'The pod exists but is not Running yet: the kubelet is pulling the image and starting the container. Look again in a couple of seconds: `kubectl get pods`.') }],
          },
          chips: 'kubectl apply -f pod.yaml',
          concepts: ['k8s.pod', 'k8s.api-object'],
          docRef: { page: 'help/kubectl-apply', anchor: 'EXAMPLES', line: 'kubectl apply -f ./pod.json' },
          hints: { H1: bi('Файл передают команде флагом -f.', 'A file is passed with the -f flag.'), H2: bi('Выполните `kubectl apply -f pod.yaml`, а затем `kubectl get pods`.', '`kubectl apply -f pod.yaml`, then `kubectl get pods`.') },
        },
        {
          id: 'wide',
          prompt: bi('Выведите список подов так, чтобы в нём были видны IP-адрес пода и узел, на котором под запущен.', 'List the pods so that the pod IP and the node it was placed on are visible.'),
          check: { when: "term['main'][last].exit=0", stdout: /IP\s+NODE[\s\S]*web\s+1\/1\s+Running[\s\S]*10\.42\.\d+\.\d+\s+(cp-1|worker-\d)/ },
          chips: 'kubectl get pods -o wide',
          docRef: { page: 'help/kubectl-get', anchor: 'EXAMPLES', line: '-o wide' },
          docStep: 3,
          hints: { H1: bi('У команды get есть формат вывода с дополнительными столбцами.', 'get has an output format with extra columns.') },
        },
        {
          id: 'describe',
          prompt: bi('Посмотрите подробное описание пода и найдите в событиях, кто назначил под на узел и какой это узел.', 'Look at the detailed description of the pod and find in its events who assigned it to which node.'),
          check: { stdout: /Successfully assigned default\/web to/ },
          chips: 'kubectl describe pod web',
          concepts: ['k8s.events'],
          docRef: { page: 'help/kubectl-describe', anchor: 'EXAMPLES', line: 'kubectl describe pods/nginx' },
          hints: { H1: bi('Подробное описание пода с событиями в конце печатает команда describe.', 'describe gives the detailed description with events at the bottom.'), H2: bi('Выполните `kubectl describe pod web` и посмотрите в разделе Events строку от default-scheduler.', '`kubectl describe pod web` — look at the Events section and the default-scheduler line.') },
        },
        {
          id: 'logs',
          prompt: bi('Прочитайте, что приложение написало при запуске.', 'Read what the application printed on start.'),
          check: { stdout: /listening on :80/ },
          chips: 'kubectl logs web',
          docRef: { page: 'help/kubectl-logs', anchor: 'EXAMPLES', line: 'kubectl logs nginx' },
          hints: { H1: bi('Всё, что контейнер печатает, kubelet сохраняет на узле, а показывает этот вывод команда kubectl logs.', 'The kubelet keeps the container output on the node, and kubectl logs shows it.') },
        },
        {
          id: 'dryrun',
          prompt: bi('Ничего не создавая в кластере, получите YAML пода `api` из образа `trainer/web:1.1` и сохраните его в файл `~/api.yaml`.', 'Without creating anything in the cluster, get the YAML of a pod `api` from the image `trainer/web:1.1` and save it to `~/api.yaml`.'),
          check: {
            when: "files['/home/learner/api.yaml'].text~'kind: Pod' && files['/home/learner/api.yaml'].text~'trainer/web:1.1' && k8s.pods[name=api]#=0",
            fail: [{ if: 'k8s.pods[name=api]#=1', say: bi('Под api на самом деле создан в кластере, а нужен был только YAML. Флаг --dry-run=client говорит kubectl ничего не отправлять на сервер. Удалите под api командой kubectl delete pod api и повторите команду с этим флагом.', 'The api pod was really created in the cluster, while only the YAML was wanted. The --dry-run=client flag tells kubectl to send nothing to the server. Delete the pod with kubectl delete pod api and repeat the command with this flag.') }],
          },
          chips: 'kubectl run api --image=trainer/web:1.1 --dry-run=client -o yaml > api.yaml',
          docRef: { page: 'help/kubectl-run', anchor: 'EXAMPLES', line: '--dry-run=client' },
          hints: {
            H1: bi('Команда kubectl run умеет напечатать объект, ничего не создавая в кластере.', 'kubectl run can just print the object without creating anything.'),
            H2: bi('Нужны два флага: один включает пробный запуск на стороне клиента, другой выводит объект в YAML. Вывод сохраните в файл перенаправлением `>`.', 'You need two flags — a client dry run and YAML output — plus a `>` redirection.'),
          },
        },
        {
          id: 'delete',
          prompt: bi('Удалите под `web` и убедитесь, что его больше нет.', 'Delete pod `web` and make sure it is gone.'),
          check: { when: 'k8s.timeline[type=DELETED][kind=Pod][name=web]#>=1 && k8s.pods[ns=default][name=web]#=0' },
          chips: 'kubectl delete pod web',
          hints: { H1: bi('У kubectl глагол удаления такой же, как метод удаления в HTTP.', 'kubectl’s verb for removal is the same as in REST.') },
        },
      ],
    },
    {
      id: 'anatomy',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Команда `kubectl explain` печатает справку по полям объекта. В каком разделе этой справки перечислены вложенные поля и их типы? Нажмите на этот раздел.', '`kubectl explain` is the reference for the fields of an object. Which section of the page lists the nested fields and their types? Press it.'),
      ref: { page: 'explain/pod.spec.containers' },
      answer: 'FIELDS',
    },
    {
      id: 'findflag',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Найдите в справке `kubectl run`, как указать, что контейнер не нужно перезапускать после того, как он завершился, и запустите из образа `busybox:1.37` под `once`, который не будет перезапускаться.', 'Find in the `kubectl run` help how to say that the container must not be restarted after it exits, and run a pod `once` from `busybox:1.37` that will not be restarted.'),
      ref: { page: 'help/kubectl-run', anchor: 'OPTIONS', line: '--restart' },
      terminal: {
        setup: { hostname: 'laptop', ext: { k8s: {} } },
        task: {
          id: 'once',
          prompt: bi('Запустите под `once` из образа `busybox:1.37`, который не перезапускается.', 'Pod `once` from `busybox:1.37` that is not restarted.'),
          check: { when: "k8s.objects[kind=Pod][metadata.name=once].spec.restartPolicy=Never" },
          chips: 'kubectl run once --image=busybox:1.37 --restart=Never',
          docStep: 3,
          hints: { H1: bi('Нужный флаг задаёт политику перезапуска пода. Ищите его в разделе Options справки `kubectl run`.', 'The flag you need sets the pod’s restart policy. Look for it in the Options section of the `kubectl run` help.') },
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: podQuiz.map((q) => q.id) },
    {
      id: 'mortal',
      kind: 'callout',
      tone: 'note',
      step: 'review',
      body: bi('Удалённый под не вернулся, потому что у него не было хозяина. В рабочих кластерах поды почти никогда не создают напрямую: их создают контроллеры, и о них следующий урок.', 'The deleted pod did not come back: it had no owner. In real clusters pods are almost never created directly — controllers create them, and they are the next lesson.'),
    },
  ],
};

// ── KM02 ────────────────────────────────────────────────────────────────────

export const reconcileQuiz: QuizItem[] = [
  {
    id: 'k8s.q.rs.image',
    kind: 'mcq',
    concepts: ['k8s.replicaset', 'k8s.controller'],
    prompt: bi('В ReplicaSet, который держит три пода, образ сменили на trainer/web:1.1. Что произойдёт с работающими подами?', 'In a ReplicaSet of 3 pods the image was changed to trainer/web:1.1. What happens to the running pods?'),
    options: [
      { id: 'nothing', text: bi('Ничего не произойдёт, потому что петля ReplicaSet считает только количество подов', 'Nothing: the ReplicaSet loop counts only the number'), correct: true },
      { id: 'replace', text: bi('Их по одному заменят на новые', 'They are replaced one by one'), why: bi('Так поступает Deployment, а не ReplicaSet. ReplicaSet сравнивает число подов с полем replicas, а образ работающих подов не трогает.', 'A Deployment does that, not a ReplicaSet. A ReplicaSet compares the number of pods with replicas — it does not touch the image of live pods.') },
      { id: 'restart', text: bi('Контейнеры перезапустятся уже с новым образом', 'The containers restart with the new image'), why: bi('Шаблон пода используется только тогда, когда создаётся новый под.', 'The pod template is used only when new pods are created.') },
    ],
    explain: bi('Новый образ получат только поды, которые будут созданы после изменения, например взамен удалённых.', 'Only pods created after the change get the new image — for example, in place of deleted ones.'),
  },
  {
    id: 'k8s.q.rs.orphan',
    kind: 'mcq',
    concepts: ['k8s.owner', 'k8s.label'],
    prompt: bi('С одного из подов ReplicaSet `web` (селектор app=web, три реплики) сняли метку app. Что произойдёт?', 'The app label was removed from a pod of ReplicaSet `web` (app=web, 3 replicas). What happens?'),
    options: [
      { id: 'orphan', text: bi('Под продолжит работать без хозяина, а ReplicaSet создаст ему замену', 'The pod lives on without an owner, the ReplicaSet creates a replacement'), correct: true },
      { id: 'deleted', text: bi('ReplicaSet удалит этот под', 'The ReplicaSet deletes that pod'), why: bi('ReplicaSet удаляет только свои лишние поды, а под без нужной метки уже не его. Контроллер стирает себя из ownerReferences этого пода и больше за него не отвечает.', 'A ReplicaSet deletes only its own extra pods; a pod without the label is no longer its own — the controller removes the ownerReference and lets it go.') },
      { id: 'nothing', text: bi('Ничего не изменится', 'Nothing changes'), why: bi('Селектор больше не выбирает этот под, поэтому своих подов у ReplicaSet стало два, и одного не хватает до трёх.', 'The selector no longer picks this pod, so there are two "own" pods — a difference of +1.') },
    ],
    explain: bi('Так выводят под из работы для отладки, не останавливая его: снимают метку, и под выпадает из ReplicaSet, а как вы увидите позже, и из Service.', 'This is how a pod is taken out "for debugging" without touching the service: remove the label and the pod drops out of the ReplicaSet (and, as you will see later, out of the Service).'),
  },
  {
    id: 'k8s.q.rs.level',
    kind: 'mcq',
    concepts: ['k8s.watch', 'k8s.controller'],
    prompt: bi('Контроллер не работал минуту, и за это время под трижды удаляли и создавали заново. Что сделает контроллер, когда снова заработает?', 'The controller was stopped for a minute, and a pod was deleted and created three times meanwhile. What will the controller do when it runs again?'),
    options: [
      { id: 'once', text: bi('Один раз посмотрит на текущее состояние и сделает одно исправление', 'Look at the current state once and make one fix'), correct: true },
      { id: 'replay', text: bi('Обработает все шесть пропущенных событий по порядку', 'Replay all six events in order'), why: bi('Контроллеры Kubernetes работают по состоянию, а не по событиям (по-английски это называют level-triggered): история событий им не нужна, нужна только разница между желаемым и фактическим сейчас.', 'Kubernetes controllers are level-triggered: they need no history of events, only the current difference.') },
    ],
    explain: bi('Поэтому пропущенное событие не страшно, ведь при следующей сверке контроллер всё равно увидит, как обстоят дела на самом деле.', 'That is why a missed event does no harm: the next reconcile sees the truth anyway.'),
    refs: { explainer: 'k8s.reconcile' },
  },
  {
    id: 'k8s.q.ns.three',
    kind: 'match',
    concepts: ['k8s.namespace'],
    prompt: bi('В курсе встречались три разных «пространства имён». Сопоставьте каждое с тем, что оно делает.', 'Three different "namespaces". Match them.'),
    pairs: [
      { id: 'k8s', left: bi('namespace Kubernetes', 'a Kubernetes namespace'), right: bi('папка для объектов API, которая ничего не изолирует в ядре', 'a folder for API objects; isolates nothing in the kernel') },
      { id: 'linux', left: bi('пространство имён Linux (pid, mnt и другие)', 'a Linux namespace (pid, mnt…)'), right: bi('отдельный взгляд процесса на ресурсы ядра', 'a separate view of kernel resources for a process') },
      { id: 'net', left: bi('сетевое пространство имён', 'a network namespace'), right: bi('свои сетевые интерфейсы, маршруты и порты', 'its own interfaces, routes and ports') },
    ],
    explain: bi('Поды из разных namespace Kubernetes по умолчанию видят друг друга по сети: namespace разграничивает имена и права, а не сеть.', 'Pods in different Kubernetes namespaces see each other on the network by default: a namespace is a boundary of names and permissions, not of the network.'),
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
      9: bi('Сам селектор написан правильно и выбирает поды с меткой app=web.', 'The selector itself is fine: it looks for pods with app=web.'),
      13: bi('Поды из шаблона получат метку app=frontend, а селектор ищет app=web, так что ReplicaSet никогда не увидел бы своих подов. Поэтому API-сервер отвечает ошибкой: `selector` does not match template `labels`.', 'Pods from the template get app=frontend, but the selector looks for app=web: the ReplicaSet would never see its own pods. The API server says: `selector` does not match template `labels`.'),
      6: bi('Число реплик может быть любым неотрицательным числом.', 'The number of replicas can be any non-negative number.'),
    },
  },
];

export const reconcileLesson: Lesson = {
  id: 'k8s-1.reconcile',
  block: 'k8s-1',
  title: bi('Метки и цикл согласования', 'Labels and the reconcile loop'),
  summary: bi('Как метки и селекторы связывают объекты, что такое namespace, как контроллер в бесконечной петле держит число подов, где хранится желаемое и как контроллер узнаёт об изменениях. В конце вы напишете свою первую петлю.', 'Labels and selectors, namespaces, a controller and its loop, the ReplicaSet, etcd, ownerReferences and watch — and your first loop.'),
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
        'Удалённый под не вернулся. Чтобы правило «три копии магазина» выполнялось и ночью, нужен кто-то, кто всё время сравнивает «должно быть три» с «работает два» и создаёт недостающий под. В Kubernetes этим занимается не человек и не одна большая программа, а множество маленьких петель, у каждой из которых своя забота.',
        'The deleted pod did not come back. For "three copies of the shop" to stay true at night too, someone has to keep comparing "there must be three" with "there are two" and create the missing one. In Kubernetes that someone is not a person and not one big brain, but many small loops, each with its own concern.',
      ),
    },
    {
      id: 'labels',
      kind: 'text',
      step: 'explain',
      title: bi('Как объекты находят друг друга по меткам', 'Labels: how objects find each other'),
      body: bi(
        'У объекта может быть сколько угодно [[k8s.label|меток]], то есть пар `ключ=значение` в поле `metadata.labels`: `app=web`, `tier=frontend`, `env=prod`. Сами по себе метки ничего не делают, их смысл появляется в селекторах. Селектор — это запрос вида «все объекты, у которых app=web». Так в Kubernetes устроены почти все связи между объектами: не «вот список имён подов», а «все поды, которые подходят под условие». Если появился под с нужной меткой, он сразу попадает в выборку, а если метку сняли, под из неё выпадает.\n\nВ терминале метки показывает команда `kubectl get pods --show-labels`, а только подходящие поды выбирает команда `kubectl get pods -l app=web`.\n\nРядом с метками стоит [[k8s.namespace|namespace]], папка для объектов. Имена объектов уникальны внутри одного namespace, права тоже выдаются на namespace, а команда `kubectl get pods` показывает поды текущего namespace. Флаг `-n shop` выбирает другой namespace, а флаг `-A` показывает все сразу. Не путайте namespace Kubernetes с пространствами имён Linux из блока о контейнерах: у них похожие названия, но namespace Kubernetes не изолирует ни процессы, ни сеть, и поды из разных namespace по умолчанию свободно обмениваются пакетами.',
        'An object can have any number of [[k8s.label|labels]] — `key=value` pairs in `metadata.labels`: `app=web`, `tier=frontend`, `env=prod`. Labels by themselves do nothing. Their point is selectors: a selector is a query "all objects with app=web". Almost every link in Kubernetes works like that: not "here is a list of pod names" but "the pods that match a condition". A pod appears with the right label — it is in the set; the label is removed — it drops out.\n\nIn the terminal that is `kubectl get pods --show-labels` (labels as a column) and `kubectl get pods -l app=web` (only the matching ones).\n\nNext to labels lives the [[k8s.namespace|namespace]] — a folder for objects. Names are unique inside a namespace, permissions are granted per namespace, `kubectl get pods` shows the pods of the current namespace (`-n shop` another one, `-A` all of them). Mind the homonyms: a Kubernetes namespace has nothing to do with the Linux namespaces of the containers block. It isolates neither processes nor the network — pods in different namespaces see each other perfectly well by default.',
      ),
    },
    {
      id: 'loop',
      kind: 'text',
      step: 'explain',
      title: bi('Контроллер работает как петля', 'A controller is a loop'),
      body: bi(
        '[[k8s.controller|Контроллер]] — это программа, которая бесконечно повторяет одно и то же: смотрит, сколько подов должно быть, смотрит, сколько их есть, и делает один шаг, чтобы разница уменьшилась. Так работает термостат: вы задаёте 21 градус, он сравнивает заданное с температурой в комнате и включает или выключает обогреватель. Ему неважно, почему стало холодно, открыли окно или сломалась батарея: он видит только разницу.\n\nСамый простой контроллер держит число подов. Он работает с объектом [[k8s.replicaset|ReplicaSet]], в котором записаны три вещи: `replicas`, то есть сколько подов должно работать, `selector`, то есть какие поды считать своими, и `template`, то есть шаблон, по которому создавать новые поды. Если удалить под, своих подов станет на один меньше, и контроллер создаст новый по шаблону. Если появится лишний под с подходящей меткой, своих станет на один больше, и контроллер удалит один из них.',
        'A [[k8s.controller|controller]] is a program that does the same thing forever: looks at how many there should be, looks at how many there are, and takes one step to shrink the difference. Like a thermostat: you set 21 degrees, it compares with the room and switches the heating on or off. It does not care why it got cold — an open window or a broken radiator.\n\nThe simplest controller keeps a number of pods. Its object is the [[k8s.replicaset|ReplicaSet]]: `replicas` (how many), `selector` (which pods count as its own) and `template` (what to make new ones from). A pod was deleted — a difference of +1 — the controller created a new one from the template. An extra one with a matching label appeared — a difference of −1 — the controller deleted one.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как контроллер возвращает удалённый под', 'How the controller brings back a deleted pod'),
      body: bi(
        'Схема ниже показывает, что происходит в кластере после того, как вы удалили один под ReplicaSet `web`. Сначала на ней три блока: слева вверху сам ReplicaSet, в котором записано, что подов должно быть три, справа поды, которые работают на самом деле, а посередине внизу контроллер ReplicaSet. Остальные блоки появятся, когда до них дойдёт изменение: ваш терминал с kubectl, API-сервер и хранилище etcd, а между API-сервером и контроллером кэш информера и очередь ключей, через которые контроллер узнаёт о событиях.',
        'The diagram below shows what happens in the cluster after you delete one pod of ReplicaSet `web`. At first it has three blocks: top left the ReplicaSet itself, which says there must be three pods, on the right the pods that really run, and at the bottom in the middle the ReplicaSet controller. The rest appear when the change reaches them: your terminal with kubectl, the API server and etcd, and between the API server and the controller the informer cache and the work queue through which the controller learns of events.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s.reconcile', howto: bi('Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд». На каждом шаге подсвечен один блок, облачко рядом с ним говорит, что он делает, а по линиям движутся карточки: ваша команда, событие `DELETED pod`, ключ `default/web` и, наконец, запрос `create pod`. Счётчики под схемой показывают, сколько раз прошла петля и сколько подов создано и удалено.\n\nКогда увидите, как под вернулся, выберите в «Параметрах» другое вмешательство: создайте отдельный под с той же меткой, снимите с пода метку или смените образ в шаблоне. Перед каждой сменой схема спросит, что сделает контроллер. Потом поменяйте число реплик, а напоследок включите в блоке «Сломать» остановку kube-controller-manager и посмотрите, где застрянет изменение.', 'Press “Start from the first step”, then go on with “Step forward”. At every step one block is highlighted, the callout next to it says what it does, and cards travel along the lines: your command, the event `DELETED pod`, the key `default/web` and finally the request `create pod`. The counters under the diagram show how many times the loop ran and how many pods were created and deleted.\n\nOnce the pod is back, choose another intervention in “Parameters”: create a separate pod with the same label, remove a label from a pod or change the image in the template. Before each change the diagram asks what the controller will do. Then change the replica count, and finally switch on the stop of kube-controller-manager in “Break it” and see where the change gets stuck.'), caption: bi('Всё, что вы видели на схеме, контроллер ReplicaSet делает в кластере постоянно, и в лабораторной работе ниже вы проверите это на настоящих командах. Когда удалите под и увидите, что подов снова три, вспомните путь изменения: событие от API-сервера, ключ в очереди, сравнение и запрос на создание пода.', 'Everything you saw in the diagram the ReplicaSet controller does in the cluster all the time, and in the lab below you check it with real commands. When you delete a pod and see three again, recall the path of the change: an event from the API server, a key in the queue, the comparison and the request to create a pod.') },
    {
      id: 'store',
      kind: 'text',
      step: 'explain',
      title: bi('Где хранится желаемое и как контроллер отличает свои поды', 'Where the desired state lives, and who owns whom'),
      body: bi(
        'Контроллер не хранит желаемое состояние у себя. Оно лежит в [[k8s.etcd|etcd]], хранилище «ключ — значение», которое стоит за API-сервером: ваш ReplicaSet хранится там по ключу `/registry/replicasets/default/web`. Каждая правка объекта получает новый номер `resourceVersion`. Поэтому контроллер можно перезапустить или перенести на другую машину: он прочитает желаемое заново и продолжит работу. В памяти у контроллера есть только кэш, о котором рассказано ниже, и после перезапуска этот кэш заполняется заново.\n\nКак ReplicaSet отличает свои поды от чужих с той же меткой? По полю [[k8s.owner|ownerReferences]] в metadata пода, где записано: «мой хозяин — ReplicaSet web с таким-то uid». Если под подходит под селектор, но хозяина у него нет, ReplicaSet принимает его в свои и записывает себя хозяином. С пода, с которого сняли метку, ReplicaSet стирает свою запись и больше за него не отвечает. А когда удаляют сам ReplicaSet, сборщик мусора находит все объекты, у которых он записан хозяином, и удаляет их тоже, если только не указать флаг `--cascade=orphan`.\n\nКак контроллер узнаёт об изменениях, не опрашивая API-сервер каждую секунду? Он подписывается на них через [[k8s.watch|watch]]: «сообщай мне обо всех изменениях подов, начиная с resourceVersion N». По этим событиям библиотека контроллера ведёт в памяти копию объектов, которую называют информером, и кладёт в очередь ключ изменившегося объекта. Ключ лежит в очереди один раз, сколько бы событий ни пришло. Поэтому контроллер, который минуту не работал, не разбирает пропущенную историю, а один раз смотрит на то, что есть сейчас.',
        'A controller does not keep the desired state itself. It lives in [[k8s.etcd|etcd]], the key-value store behind the API server: your ReplicaSet is the record `/registry/replicasets/default/web`. Every edit of it gets a new `resourceVersion` number. The controller can be restarted or moved to another machine — it reads the desired state again and carries on. The only thing in its memory is the cache described below, and after a restart that cache is filled again.\n\nHow does a ReplicaSet tell its own pods from others with the same label? By the [[k8s.owner|ownerReferences]] field in the pod metadata: it says "my owner is ReplicaSet web, uid so-and-so". A pod without an owner that matches the selector is "adopted" — the ReplicaSet writes itself in as the owner. A pod that lost its label is let go. And when the ReplicaSet itself is deleted, the garbage collector finds everyone who lists it as their owner and deletes them too — unless you ask for `--cascade=orphan`.\n\nHow does the controller learn about changes without polling the API every second? Through [[k8s.watch|watch]]: a subscription "tell me about every change to pods starting from resourceVersion N". The controller library keeps a local cache (an informer) from these events and puts the key of the changed object into a queue — one key, however many events arrive. That is why a controller that was stopped for a minute does not work through the missed history, but looks once at what is there now.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: RS_LAB,
      intro: bi('В домашнем каталоге лежит файл `rs.yaml` с описанием ReplicaSet на три пода. Команда `cluster etcd /registry/replicasets` покажет ключ этого объекта в etcd и номер его ревизии.', 'Your home directory has `rs.yaml`, a ReplicaSet of three pods. `cluster etcd /registry/replicasets` shows the key in etcd and its revision.'),
      tasks: [
        {
          id: 'apply',
          prompt: bi('Создайте ReplicaSet из файла `rs.yaml` и дождитесь, пока все три пода будут готовы.', 'Create the ReplicaSet from `rs.yaml` and wait for three ready pods.'),
          check: { when: "k8s.pods[owner='ReplicaSet/web'][ready=true]#=3" },
          chips: 'kubectl apply -f rs.yaml',
          concepts: ['k8s.replicaset'],
          hints: { H1: bi('Это делается так же, как с подом в прошлом уроке.', 'The same way as the pod in the previous lesson.') },
        },
        {
          id: 'kill',
          prompt: bi('Удалите любой под этого ReplicaSet и убедитесь, что подов снова три.', 'Delete any pod of this ReplicaSet and make sure there are three pods again.'),
          check: { when: "k8s.timeline[type=DELETED][kind=Pod]#>=1 && k8s.pods[owner='ReplicaSet/web'][ready=true]#=3", fail: [{ if: "k8s.timeline[type=DELETED][kind=Pod]#=0", say: bi('Пока не удалён ни один под. Имена подов покажет команда `kubectl get pods`.', 'No pod has been deleted yet. `kubectl get pods` shows the pod names.') }] },
          chips: 'kubectl delete pod <name>',
          concepts: ['k8s.controller'],
          hints: { H1: bi('Имя возьмите из вывода `kubectl get pods`, оно выглядит как web-xxxxx.', 'Take the name from `kubectl get pods`: web-xxxxx.') },
        },
        {
          id: 'scale',
          prompt: bi('Измените желаемое состояние так, чтобы подов было пять.', 'Change the desired state: let there be five pods.'),
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
          hints: { H1: bi('Это флаг команды get. Ищите в разделе Options слово labels.', 'It is a flag of get; look for the word labels in Options.') },
        },
        {
          id: 'orphan',
          prompt: bi('Выньте один под из-под присмотра ReplicaSet, не удаляя его. Для этого смените ему метку на `app=debug`. Подов с меткой `app=web` при этом должно остаться пять.', 'Take one pod out of the ReplicaSet without deleting it: change its label to `app=debug`. Five `app=web` pods must remain.'),
          check: {
            when: "k8s.pods[labels.app=debug][owner='']#=1 && k8s.pods[owner='ReplicaSet/web']#=5",
            fail: [{ if: "k8s.pods[labels.app=debug]#=1 && k8s.pods[owner='ReplicaSet/web']#<5", say: bi('Подождите секунду и посмотрите `kubectl get pods`: ReplicaSet уже создаёт замену выведенному поду.', 'Wait a second and look at `kubectl get pods`: the ReplicaSet is already creating a replacement.') }],
          },
          chips: 'kubectl label pod <name> app=debug --overwrite',
          concepts: ['k8s.owner', 'k8s.label'],
          docRef: { page: 'help/kubectl-label', anchor: 'EXAMPLES', line: '--overwrite' },
          hints: { H1: bi('Метки меняет команда kubectl label, а чтобы перезаписать существующую метку, нужен отдельный флаг.', 'kubectl label changes labels; an existing label is overwritten with an explicit flag.') },
        },
        {
          id: 'ns',
          prompt: bi('Создайте namespace `team-a` и посмотрите поды сразу во всех namespace.', 'Create the namespace `team-a` and look at the pods in all namespaces at once.'),
          check: { when: 'k8s.objects[kind=Namespace][metadata.name=team-a]#=1', stdout: /NAMESPACE\s+NAME/ },
          chips: 'kubectl create namespace team-a && kubectl get pods -A',
          concepts: ['k8s.namespace'],
          hints: { H1: bi('Namespace создаёт команда create, а все namespace сразу показывает короткий флаг -A.', 'A namespace is created with create; "all namespaces" is the short flag -A.') },
        },
      ],
    },
    {
      id: 'your-loop',
      kind: 'text',
      step: 'try',
      title: bi('Ваша первая петля', 'Your first loop'),
      body: bi(
        'Теперь напишите контроллер сами. Задача построена на знакомых объектах, и требований к петле три. Во-первых, у каждого namespace с меткой `team` должен быть ConfigMap `team-info`, а в его поле `data.team` записано значение этой метки. Во-вторых, когда метку меняют, значение в ConfigMap меняется вслед за ней. В-третьих, когда метку снимают, ConfigMap удаляется. Третье требование отметка под редактором не проверяет, поэтому его можно отложить: задача будет решена и без него. Но настоящий контроллер должен убирать за собой и такой ConfigMap, и в заготовке среднего и опытного уровней это требование записано в комментарии как задача сверх цели. ConfigMap — это простая запись «ключ — значение», подробно о нём рассказывает урок о конфигурации. Функция `reconcile(ns, k)` вызывается для каждого namespace снова и снова. Объект `k` умеет пять действий: `k.get` читает объект, `k.list` читает список объектов, `k.create` создаёт объект, `k.update` записывает изменённый объект, а `k.delete` удаляет его. Запустите петлю, создайте namespace кнопкой, удалите ConfigMap руками и посмотрите, как ваша петля вернёт его на место. Задача решена, когда под редактором появится отметка о достигнутой цели: у каждого namespace с меткой team есть ConfigMap team-info с правильным значением, в том числе после кнопки «Сменить метку team-a: team=gamma».',
        'Now write a controller yourself. A task on familiar objects, with three requirements for the loop. First, every namespace with the label `team` must have a ConfigMap `team-info` whose `data.team` holds the value of the label. Second, when the label changes, the value in the ConfigMap follows it. Third, when the label is removed, the ConfigMap is deleted. The mark under the editor does not check the third requirement, so you may leave it for later: the task is solved without it. But a real controller should clean such a ConfigMap up too, and the intermediate and experienced starter has it in a comment as a task beyond the goal (a ConfigMap is a simple key-value record; the configuration lesson covers it in detail). The function `reconcile(ns, k)` is called for every namespace again and again. The object `k` can do five things: `k.get` reads an object, `k.list` reads a list of objects, `k.create` creates an object, `k.update` writes a changed object, and `k.delete` deletes it. Start the loop, create a namespace with a button, delete the ConfigMap by hand — and watch your loop bring it back. The task is done when the editor shows that the goal is reached: every namespace with a team label has a team-info ConfigMap with the right value, including after the button “Change the team-a label: team=gamma”.',
      ),
    },
    {
      id: 'your-loop-solution',
      kind: 'text',
      step: 'try',
      levels: ['beginner'],
      title: bi('Готовая петля с объяснением каждой строки', 'A ready loop with every line explained'),
      body: bi(
        'Если вы ещё не программировали, писать функцию с нуля не нужно. Скопируйте готовую петлю ниже в редактор вместо заготовки и нажмите «Запустить петлю». Строки после знаков `//` — это комментарии для человека, программа их не выполняет.\n\n```js\nfunction reconcile(ns, k) {\n  // Значение метки team у этого namespace, например alpha.\n  const team = ns.metadata.labels && ns.metadata.labels.team;\n  // Если метки нет, это не наш namespace, и делать ничего не нужно.\n  if (!team) return;\n  // 1. Прочитать, есть ли уже ConfigMap team-info в этом namespace.\n  const have = k.get(\'ConfigMap\', ns.metadata.name, \'team-info\');\n  // Желаемый ConfigMap, в котором записано имя команды.\n  const want = {\n    apiVersion: \'v1\', kind: \'ConfigMap\',\n    metadata: { name: \'team-info\', namespace: ns.metadata.name },\n    data: { team: team },\n  };\n  // 2. Сравнить и 3. действовать. Если ConfigMap нет, создать его.\n  if (!have) { k.create(want); return; }\n  // Если ConfigMap есть, но команда в нём записана другая, поправить её и записать.\n  if (have.data.team !== team) { have.data.team = team; k.update(have); }\n}\n```\n\nЗатем нажмите кнопки под редактором по порядку: «Создать namespace team-a (team=alpha)», «Удалить ConfigMap team-info в team-a» и «Сменить метку team-a: team=gamma». После каждой кнопки петля приводит ConfigMap в порядок, и отметка о достигнутой цели остаётся на месте.\n\nВся петля состоит из тех же трёх шагов, что и у контроллера ReplicaSet: прочитать фактическое, сравнить с желаемым и сделать один шаг, который убирает разницу.',
        'If you have not programmed before, you do not need to write the function from scratch. Copy the ready loop below into the editor in place of the starter and press “Start the loop”. The lines after `//` are comments for people; the program does not run them.\n\n```js\nfunction reconcile(ns, k) {\n  // The value of the team label of this namespace, for example alpha.\n  const team = ns.metadata.labels && ns.metadata.labels.team;\n  // No label: not our namespace, nothing to do.\n  if (!team) return;\n  // 1. Read: is there a team-info ConfigMap in this namespace already?\n  const have = k.get(\'ConfigMap\', ns.metadata.name, \'team-info\');\n  // The desired state: a ConfigMap with the team name in it.\n  const want = {\n    apiVersion: \'v1\', kind: \'ConfigMap\',\n    metadata: { name: \'team-info\', namespace: ns.metadata.name },\n    data: { team: team },\n  };\n  // 2. Compare and 3. act: if there is no ConfigMap, create it.\n  if (!have) { k.create(want); return; }\n  // If it exists but holds another team, fix it and write it back.\n  if (have.data.team !== team) { have.data.team = team; k.update(have); }\n}\n```\n\nThen press the buttons under the editor in order: “Create namespace team-a (team=alpha)”, “Delete ConfigMap team-info in team-a” and “Change the team-a label: team=gamma”. After each button the loop puts the ConfigMap right, and the goal mark stays.\n\nThe whole loop is the same three steps as the ReplicaSet controller: read the actual state, compare it with the desired one, and take one step that removes the difference.',
      ),
    },
    { id: 'lab-loop', kind: 'widget', step: 'practice', widget: 'k8s.controller-lab', props: { exercise: 'team-info' } },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: reconcileQuiz.map((q) => q.id) },
  ],
};
