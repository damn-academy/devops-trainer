// Data that outlives a pod (05 KM07–KM08, the E5 break "PVC Pending"):
// a claim, a volume and a class of disks; dynamic provisioning by a CSI
// driver; a claim without a class; a StatefulSet with a claim per replica,
// a headless Service, stable names, scale-down that keeps the claims, and
// (intermediate and up) a partitioned update with rollout undo. The
// constructor grows by the storage layer here.

import { bi } from '../../../core/i18n';
import type { Facts, Lesson, QuizItem } from '../../../core/types';
import type { K8sFacts } from '../../../engine/kube-lite/facts';
import type { Obj } from '../../../engine/kube-lite/util';
import { claimOf, objOf, objsOf, podOf, stsOf } from '../rbac-facts';
import { NO_CLASS_LAB, STORAGE_LAB, STS_LAB, STS_RUNNING } from '../setups';
import { R, S, src } from '../sources';

const k8s = (f: Facts) => f.k8s as K8sFacts;
const claim = (f: Facts | undefined, name: string): Obj | undefined => (f ? k8s(f).objects.find((o) => o.kind === 'PersistentVolumeClaim' && o.metadata?.namespace === 'default' && o.metadata?.name === name) : undefined);
const podsOf = (f: Facts | undefined, app: string) => (f ? k8s(f).pods.filter((p) => p.ns === 'default' && p.labels.app === app) : []);
const lastOut = (f: Facts) => ((f.term as { main?: { out: string }[] } | undefined)?.main ?? []).at(-1)?.out ?? '';
/** Pod web-1 was recreated by the same StatefulSet and mounted the same claim with the same volume. */
const sameWeb1 = (f: Facts, start?: Facts) =>
  objOf(f, 'StatefulSet', 'default', 'web')?.metadata?.uid === objOf(start, 'StatefulSet', 'default', 'web')?.metadata?.uid && !!podOf(f, 'default', 'web-1')?.ready && podOf(f, 'default', 'web-1')?.uid !== podOf(start, 'default', 'web-1')?.uid && !!claimOf(f, 'default', 'data-web-1')?.spec?.volumeName && claimOf(f, 'default', 'data-web-1')?.spec?.volumeName === claimOf(start, 'default', 'data-web-1')?.spec?.volumeName && !!stsOf(f, 'default', 'web')?.ordinals.find((o) => o.name === 'web-1')?.pvcs.includes('data-web-1');
const deployUid = (f: Facts | undefined, name: string) => (f ? k8s(f).objects.find((o) => o.kind === 'Deployment' && o.metadata?.namespace === 'default' && o.metadata?.name === name)?.metadata?.uid : undefined);

export const storageQuiz: QuizItem[] = [
  {
    id: 'k8s.q.st.node',
    kind: 'mcq',
    concepts: ['k8s.pvc', 'k8s.pv'],
    prompt: bi(
      'База данных работает в Deployment с заявкой PVC `data`, а том для заявки создал драйвер сетевого хранилища облака. Узел, на котором работал под базы, выключили. Что будет с данными, когда под запустится на другом узле?',
      'A database runs in a Deployment with PVC `data`, and the volume for the claim was created by the cloud’s network storage driver. The node the database pod ran on was switched off. What happens to the data when the pod starts on another node?',
    ),
    options: [
      { id: 'same', text: bi('Новый под получит тот же том с теми же данными, потому что заявка записана в API, а том лежит в хранилище, а не на узле', 'The new pod gets the same volume with the same data, because the claim is a record in the API and the volume lives in the storage, not on the node'), correct: true },
      { id: 'node', text: bi('Данные пропадут, потому что заявка PVC хранится на узле, где её создали', 'The data is gone, because the PVC is kept on the node where it was created'), why: bi('Заявка, как и любой объект, лежит в API-сервере и ни к какому узлу не относится. К узлу бывает привязан только сам том, если это локальный диск или каталог узла, как у local-path. Сетевой том драйвер отключит от старого узла и подключит к новому.', 'A claim, like any object, sits in the API server and belongs to no node. Only the volume itself can be tied to a node, when it is a local disk or a node directory as with local-path. A network volume is detached from the old node and attached to the new one by the driver.') },
      { id: 'new', text: bi('Контроллер создаст для нового пода новый пустой том', 'The controller creates a new empty volume for the new pod'), why: bi('Новый под ссылается на ту же заявку `data`, а заявка уже связана со своим томом. Новый том появился бы только для новой заявки.', 'The new pod refers to the same claim `data`, and the claim is already bound to its volume. A new volume would appear only for a new claim.') },
    ],
  },
  {
    id: 'k8s.q.st.delete',
    kind: 'multi',
    concepts: ['k8s.pvc', 'k8s.pv', 'k8s.storageclass'],
    prompt: bi(
      'В StorageClass записано `reclaimPolicy: Delete`. Отметьте все действия, после которых данные базы пропадут.',
      'The StorageClass says `reclaimPolicy: Delete`. Mark every action after which the database data is gone.',
    ),
    options: [
      { id: 'pvc', text: bi('Удалить заявку PVC `data`', 'Delete PVC `data`'), correct: true },
      { id: 'pod', text: bi('Удалить под базы данных', 'Delete the database pod'), why: bi('Под только подключает том. Контроллер создаст новый под, и тот подключит ту же заявку с тем же томом.', 'The pod only mounts the volume. The controller creates a new pod, and it mounts the same claim with the same volume.') },
      { id: 'deploy', text: bi('Удалить Deployment базы данных', 'Delete the database Deployment'), why: bi('Заявка не принадлежит Deployment: её создали отдельным объектом, и сборщик мусора её не тронет. Поды исчезнут, а заявка и том останутся.', 'The claim does not belong to the Deployment: it was created as a separate object, and the garbage collector leaves it alone. The pods go, the claim and the volume stay.') },
      { id: 'ns', text: bi('Удалить namespace, в котором лежит заявка', 'Delete the namespace the claim is in'), correct: true },
    ],
    explain: bi('Удаление namespace удаляет все его объекты, в том числе заявки, а при `reclaimPolicy: Delete` вслед за заявкой драйвер удаляет и том. Для баз данных поэтому ставят класс с `Retain`: тогда том остаётся и после удаления заявки, и его можно подключить снова.', 'Deleting a namespace deletes all its objects, claims included, and with `reclaimPolicy: Delete` the driver deletes the volume after the claim. That is why databases get a class with `Retain`: then the volume stays after the claim is deleted and can be attached again.'),
  },
  {
    id: 'k8s.q.st.pending',
    kind: 'mcq',
    concepts: ['k8s.pvc', 'k8s.storageclass', 'k8s.csi'],
    prompt: bi(
      'Заявка PVC `data` висит в Pending, а в её событиях написано «Waiting for a volume to be created either by the external provisioner \'hostpath.csi.k8s.io\' or manually by the system administrator». Что сломано?',
      'PVC `data` stays Pending, and its events say "Waiting for a volume to be created either by the external provisioner \'hostpath.csi.k8s.io\' or manually by the system administrator". What is broken?',
    ),
    options: [
      { id: 'driver', text: bi('StorageClass есть, но не работает CSI-драйвер, который создаёт тома', 'The StorageClass exists, but the CSI driver that creates volumes is not running'), correct: true },
      { id: 'nosc', text: bi('В кластере нет StorageClass с таким именем, поэтому заявке не из чего создать том', 'There is no StorageClass with this name in the cluster, so the claim has nothing to create a volume from'), why: bi('Тогда в событии было бы написано «storageclass.storage.k8s.io "…" not found». Здесь класс найден, и в событии даже назван его провизионер, то есть программа, которая должна создать том.', 'Then the event would read "storageclass.storage.k8s.io "…" not found". Here the class was found, and the event even names its provisioner, the program that has to create the volume.') },
      { id: 'sched', text: bi('Планировщик не нашёл узла для пода базы данных', 'The scheduler found no node for the database pod'), why: bi('Планировщик том не создаёт. Наоборот, при классе с режимом Immediate он ждёт, пока заявка станет Bound, и до этого пишет в события пода «pod has unbound immediate PersistentVolumeClaims».', 'The scheduler does not create volumes. On the contrary, with an Immediate class it waits until the claim is Bound and meanwhile writes "pod has unbound immediate PersistentVolumeClaims" into the pod events.') },
    ],
  },
  {
    id: 'k8s.q.st.replicas',
    kind: 'mcq',
    concepts: ['k8s.statefulset', 'k8s.pvc'],
    prompt: bi(
      'В Deployment `db` три реплики, и все они подключают одну заявку `data` с режимом доступа ReadWriteOnce. Два пода из трёх висят в ContainerCreating. Почему, и как правильно запускать три реплики базы данных?',
      'Deployment `db` has three replicas, all mounting one claim `data` with access mode ReadWriteOnce. Two pods of three hang in ContainerCreating. Why, and what is the right way to run three database replicas?',
    ),
    options: [
      { id: 'sts', text: bi('Том ReadWriteOnce можно подключить к одному узлу, а реплики попали на разные узлы. Для базы нужен StatefulSet, который даёт каждой реплике свою заявку', 'A ReadWriteOnce volume attaches to one node, and the replicas landed on different nodes. A database needs a StatefulSet, which gives every replica its own claim'), correct: true },
      { id: 'own', text: bi('Подам Deployment нужен свой способ подключения тома, не такой, как у отдельного пода', 'Deployment pods need their own way of mounting a volume, different from a standalone pod'), why: bi('Способ один и тот же, это поле `volumes.persistentVolumeClaim` в шаблоне пода. Разница в другом: все реплики Deployment получают один шаблон, а значит, одну и ту же заявку.', 'The way is the same: `volumes.persistentVolumeClaim` in the pod template. The difference is elsewhere: all replicas of a Deployment share one template and therefore one claim.') },
      { id: 'size', text: bi('Заявке не хватает места на три пода, потому что каждая реплика пишет на один и тот же том свою полную копию базы, и заявку нужно увеличить хотя бы втрое', 'The claim lacks space for three pods, because every replica writes its own full copy of the database to the same volume, so the claim must be enlarged at least threefold'), why: bi('Размер тут ни при чём: ошибка в событиях пода будет «Multi-Attach error», то есть том уже подключён к другому узлу.', 'The size has nothing to do with it: the pod event will be "Multi-Attach error", that is, the volume is already attached to another node.') },
    ],
  },
  {
    id: 'k8s.q.st.wait',
    kind: 'mcq',
    concepts: ['k8s.storageclass'],
    prompt: bi(
      'В облаке три зоны доступности, каждый диск создаётся в одной зоне. Заявка создана по классу с `volumeBindingMode: Immediate`, и под базы висит в Pending с причиной «volume node affinity conflict». Что поменять в StorageClass?',
      'A cloud has three availability zones, and disks exist in one zone. The claim was created with a class with `volumeBindingMode: Immediate`, and the database pod is Pending with "volume node affinity conflict". What should change in the StorageClass?',
    ),
    options: [
      { id: 'wffc', text: bi('Поставить `volumeBindingMode: WaitForFirstConsumer`, чтобы диск создавался после выбора узла и в его зоне', 'Set `volumeBindingMode: WaitForFirstConsumer`, so the disk is created after the node is chosen, in its zone'), correct: true },
      { id: 'retain', text: bi('Поставить `reclaimPolicy: Retain`', 'Set `reclaimPolicy: Retain`'), why: bi('Это поле решает, что будет с томом после удаления заявки, и к выбору зоны отношения не имеет.', 'This field decides what happens to the volume after the claim is deleted and has nothing to do with the zone.') },
      { id: 'expand', text: bi('Поставить `allowVolumeExpansion: true`', 'Set `allowVolumeExpansion: true`'), why: bi('Это поле разрешает увеличивать уже созданный том, а здесь беда в том, что том создан не в той зоне.', 'This field allows enlarging an existing volume, whereas the trouble here is that the volume was created in the wrong zone.') },
    ],
  },
  {
    id: 'k8s.q.st.isdb',
    kind: 'mcq',
    concepts: ['k8s.statefulset'],
    prompt: bi(
      'Коллега предлагает: «Запустим PostgreSQL в StatefulSet на три реплики, и у нас будет кластер базы с репликацией». Что на самом деле даст StatefulSet?',
      'A colleague suggests: “Let us run PostgreSQL in a StatefulSet with three replicas, and we will have a replicated database cluster.” What will the StatefulSet really give?',
    ),
    options: [
      { id: 'names', text: bi('Три пода с постоянными именами и тремя собственными дисками. Данные между ними никто не копирует, пока репликацию не настроит сама PostgreSQL или её оператор', 'Three pods with stable names and three disks of their own. Nobody copies data between them until PostgreSQL itself or its operator sets up replication'), correct: true },
      { id: 'sync', text: bi('Три копии одних и тех же данных, которые StatefulSet держит одинаковыми', 'Three copies of the same data that the StatefulSet keeps identical'), why: bi('StatefulSet ничего не знает о том, что лежит на дисках. Он создаёт заявку для каждой реплики, а каждая заявка получает свой пустой том.', 'A StatefulSet knows nothing about what lies on the disks. It creates a claim for every replica, and every claim gets its own empty volume.') },
      { id: 'onlydb', text: bi('Ничего полезного, потому что StatefulSet умеет запускать только готовые образы баз данных', 'Nothing useful, because a StatefulSet can run only ready database images'), why: bi('StatefulSet запускает любой образ, и в лабораторной работе он запускал обычные веб-серверы. Базе он полезен именами, порядком запуска и дисками, а не знанием о базах.', 'A StatefulSet runs any image: in the lab it ran ordinary web servers. It helps a database with names, start order and disks, not with any knowledge of databases.') },
    ],
  },
  {
    id: 'k8s.q.st.move',
    kind: 'mcq',
    concepts: ['k8s.statefulset', 'k8s.pv'],
    prompt: bi(
      'Под `db-1` StatefulSet хранил данные на томе local-path, то есть в каталоге узла worker-2. Узел worker-2 выключили навсегда. Что будет с подом `db-1`?',
      'Pod `db-1` of a StatefulSet kept its data on a local-path volume, a directory of node worker-2. Node worker-2 was switched off for good. What happens to pod `db-1`?',
    ),
    options: [
      { id: 'wait', text: bi('Новый под db-1 будет висеть в Pending, потому что его заявка data-db-1 связана с томом, который есть только на worker-2', 'The new pod db-1 hangs in Pending, because its claim data-db-1 is bound to a volume that exists only on worker-2'), correct: true },
      { id: 'copy', text: bi('Kubernetes скопирует данные db-1 на другой узел и запустит под там', 'Kubernetes copies the data of db-1 to another node and starts the pod there'), why: bi('Данные никто не копирует и не переносит: ни под, ни StatefulSet, ни kubelet. Под получает том через заявку, а локальный том нельзя подключить к другому узлу.', 'Nobody copies or moves data: not the pod, not the StatefulSet, not the kubelet. A pod gets its volume through the claim, and a local volume cannot be attached to another node.') },
      { id: 'empty', text: bi('Под db-1 запустится на другом узле с новым пустым диском, потому что старая заявка data-db-1 осталась на worker-2 вместе со своим томом', 'Pod db-1 starts on another node with a new empty disk, because the old claim data-db-1 stayed behind on worker-2 together with its volume'), why: bi('Новый пустой том появился бы только для новой заявки. Заявка data-db-1 по-прежнему существует и связана со старым томом, поэтому под ждёт его. Чтобы реплика начала с пустого диска, заявку удаляют вручную.', 'A new empty volume would appear only for a new claim. Claim data-db-1 still exists and is bound to the old volume, so the pod waits for it. To let the replica start from an empty disk, the claim is deleted by hand.') },
    ],
  },
];

export const storageLesson: Lesson = {
  id: 'k8s-1.storage',
  block: 'k8s-1',
  title: bi('Как данные переживают под благодаря заявке PVC, тому и StorageClass', 'How data outlives a pod thanks to a PVC, a volume and a StorageClass'),
  summary: bi(
    'Почему файлы базы данных пропадают вместе с подом, как заявка PersistentVolumeClaim получает том от драйвера хранилища, чем PersistentVolume отличается от заявки, что решает StorageClass и класс по умолчанию, как найти причину, когда заявка висит в Pending, и как StatefulSet даёт каждой реплике постоянное имя и собственный диск, который остаётся, когда под удаляют или число реплик уменьшают.',
    'Why database files disappear with the pod, how a PersistentVolumeClaim gets a volume from a storage driver, how a PersistentVolume differs from the claim, what a StorageClass and the default class decide, how to find the cause when a claim hangs in Pending, and how a StatefulSet gives every replica a stable name and a disk of its own that stays when the pod is deleted or the replica count goes down.',
  ),
  introduces: ['k8s.pvc', 'k8s.pv', 'k8s.storageclass', 'k8s.csi', 'k8s.statefulset', 'k8s.headless-service'],
  uses: ['k8s.volume', 'k8s.pod', 'k8s.deployment', 'k8s.scheduler', 'k8s.kubelet', 'k8s.controller', 'k8s.addon', 'k8s.events', 'k8s.namespace', 'k8s.service', 'k8s.cluster-dns', 'k8s.rolling-update', 'k8s.revision'],
  tier: 'core',
  minutes: 70,
  sources: src([S.pv, S.storageClass, S.statefulset], [R.what, R.components]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Команда разработчиков переносит в кластер базу данных Redis, которая раньше работала в контейнере Docker на одном сервере. Через неделю узел перезагружают ради обновления ядра, под базы запускается на другом узле, и все данные исчезают. Сайт работает, но корзины покупателей пустые. Причина в том, что база писала файлы в том emptyDir из урока о конфигурации, а этот каталог kubelet создаёт вместе с подом и удаляет вместе с ним.\n\nЭто первое, что ломается, когда в Kubernetes приходят приложения с данными, и на собеседовании об этом спрашивают почти всегда: чем PersistentVolume отличается от PersistentVolumeClaim и что делать, если заявка висит в Pending. После урока вы ответите на оба вопроса и сами почините такую заявку.',
        'A team moves a Redis database into the cluster; before that it ran in a Docker container on one server. A week later a node is rebooted for a kernel update, the database pod starts on another node, and all the data is gone. The site works, but the shopping carts are empty. The cause is that the database wrote its files into an emptyDir volume from the configuration lesson, and the kubelet creates that directory with the pod and deletes it with the pod.\n\nThis is the first thing that breaks when applications with data come to Kubernetes, and interviews ask about it almost every time: how a PersistentVolume differs from a PersistentVolumeClaim, and what to do when a claim hangs in Pending. After the lesson you will answer both and repair such a claim yourself.',
      ),
    },
    {
      id: 'model',
      kind: 'text',
      step: 'explain',
      title: bi('Заявка, том и вид дисков', 'A claim, a volume and a kind of disk'),
      body: bi(
        'Чтобы данные пережили под, их хранят там, где под ничего не решает: на диске облака, в сетевом хранилище или хотя бы в каталоге узла, о котором знает кластер. В API это описывают три объекта, и путать их не нужно.\n\n[[k8s.pvc|PersistentVolumeClaim]], или коротко заявка, говорит, что нужно приложению: сколько места и с каким доступом, например «1 ГиБ, писать с одного узла». Заявка лежит в namespace приложения, и под ссылается на неё по имени в поле `volumes.persistentVolumeClaim.claimName`. [[k8s.pv|PersistentVolume]] — это сам том: конкретный диск или каталог с размером и адресом в хранилище. Тома не принадлежат ни одному namespace, потому что это ресурс всего кластера, как узлы. Наконец, [[k8s.storageclass|StorageClass]] описывает вид дисков: какая программа их создаёт, с какими параметрами и что делать с томом, когда заявку удалят. Один класс в кластере обычно помечен как класс по умолчанию, и он достаётся заявкам, в которых класс не указан.\n\nСоздаёт тома [[k8s.csi|CSI-драйвер]], программа хранилища, которая подключается к Kubernetes по общему протоколу Container Storage Interface. Это обычное [[k8s.addon|дополнение кластера]]: как MetalLB и Traefik из урока о входе снаружи, оно работает подами и следит за своими объектами через API-сервер. Свой драйвер есть у каждого облака и у каждой системы хранения, поэтому заявка одинаково пишется в любом кластере, а конкретный диск зависит от того, какой драйвер стоит за классом.\n\nВесь путь от заявки до файла в контейнере выглядит так. Вы создаёте заявку. Драйвер видит заявку своего класса без тома, создаёт диск и записывает объект PersistentVolume. Контроллер томов в kube-controller-manager связывает заявку и том один к одному, и заявка переходит из Pending в Bound. Планировщик ставит под на узел, с которого этот том доступен. kubelet на узле просит драйвер подключить том к машине и монтирует его в каталог, указанный в `volumeMounts` контейнера.',
        'For data to outlive a pod, it is kept where the pod decides nothing: on a cloud disk, in network storage, or at least in a node directory the cluster knows about. The API describes this with three objects, and they should not be mixed up.\n\nA [[k8s.pvc|PersistentVolumeClaim]], or just a claim, says what the application needs: how much space and what access, for example “1 GiB, written from one node”. The claim lives in the application’s namespace, and the pod refers to it by name in `volumes.persistentVolumeClaim.claimName`. A [[k8s.pv|PersistentVolume]] is the volume itself: a particular disk or directory with a size and an address in the storage. Volumes belong to no namespace, because they are a resource of the whole cluster, like nodes. Finally, a [[k8s.storageclass|StorageClass]] describes a kind of disk: which program creates them, with which parameters, and what to do with the volume when the claim is deleted. One class in a cluster is usually marked as the default, and claims without a class get it.\n\nVolumes are created by a [[k8s.csi|CSI driver]], a storage program that plugs into Kubernetes by the common Container Storage Interface protocol. It is an ordinary [[k8s.addon|cluster add-on]]: like MetalLB and Traefik from the lesson on traffic from outside, it runs as pods and watches its objects through the API server. Every cloud and every storage system has its own driver, so a claim is written the same way in any cluster, and the actual disk depends on the driver behind the class.\n\nThe whole path from the claim to a file in the container goes like this. You create the claim. The driver sees a claim of its class without a volume, creates a disk and writes a PersistentVolume object. The volume controller in kube-controller-manager binds the claim and the volume one to one, and the claim goes from Pending to Bound. The scheduler places the pod on a node from which the volume is reachable. The kubelet on the node asks the driver to attach the volume to the machine and mounts it into the directory named in the container’s `volumeMounts`.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Конструктор кластера со слоем хранилища', 'The cluster constructor with the storage layer'),
      body: bi(
        'Ниже конструктор из урока об устройстве кластера, в котором после урока о входе снаружи уже есть MetalLB и Traefik, а теперь добавлен слой хранилища: CSI-драйвер вместе со своей StorageClass. Драйвер, как и другие дополнения, подключён к API-серверу общей серой шиной справа, потому что с кластером он разговаривает так же, как они: смотрит свои заявки и записывает тома. Сценарий «База данных с диском» запускает учебный кластер из того, что включено на холсте, создаёт заявку и Deployment базы и показывает настоящий вывод kubectl. Над выводом тренажёр полным предложением объясняет, кто что сделал или из-за отсутствия какого компонента заявка осталась в Pending.',
        'Below is the constructor from the lesson on how a cluster works. After the lesson on traffic from outside it already has MetalLB and Traefik, and now the storage layer is added: a CSI driver together with its StorageClass. Like the other add-ons, the driver is wired to the API server by the grey bus on the right, because it talks to the cluster the same way: it watches its claims and writes volumes. The scenario “A database with a disk” starts the training cluster from what is switched on, creates the claim and the database Deployment and shows the real kubectl output. Above the output the trainer explains in a full sentence who did what, or which missing component left the claim in Pending.',
      ),
    },
    {
      id: 'howto',
      kind: 'text',
      role: 'howto',
      step: 'try',
      body: bi(
        'Нажмите кнопку сценария «База данных с диском», пока на холсте собрано всё, и посмотрите на столбцы STATUS и VOLUME у заявки `data`. Затем выключите слой «Хранилище», нажав на его название в легенде, и запустите сценарий ещё раз: заявка останется в Pending, а под базы не получит узла. Включите слой обратно, откройте карточку kube-controller-manager, нажмите «Убрать с холста» и сравните: том драйвер создаст, но связать его с заявкой будет некому.',
        'Press the scenario button “A database with a disk” while everything is on the canvas, and look at the STATUS and VOLUME columns of claim `data`. Then switch off the “Storage” layer by pressing its name in the legend and run the scenario again: the claim stays Pending, and the database pod gets no node. Switch the layer back on, open the kube-controller-manager card, press “Remove from the canvas” and compare: the driver will create the volume, but nobody will bind it to the claim.',
      ),
    },
    { id: 'constructor', kind: 'widget', step: 'try', widget: 'k8s.constructor', props: { preset: 'full', layers: ['cp', 'node', 'net', 'ingress', 'storage'] } },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: STORAGE_LAB,
      intro: bi(
        'В учебном кластере стоит CSI-драйвер `hostpath.csi.k8s.io` со своей StorageClass. В namespace default уже работает база данных: Deployment `db` с заявкой `data`, оба описаны в файле `db.yaml`. Рядом коллега выложил приложение отчётов из файла `reports.yaml`, и оно не запускается. Сломать здесь ничего нельзя: если запутаетесь, перезагрузите страницу, и кластер вернётся в исходное состояние.',
        'The training cluster has the CSI driver `hostpath.csi.k8s.io` with its StorageClass. A database already runs in namespace default: Deployment `db` with claim `data`, both described in `db.yaml`. Next to it a colleague rolled out a reports application from `reports.yaml`, and it does not start. You cannot break anything here: if you get lost, reload the page, and the cluster returns to where it started.',
      ),
      tasks: [
        {
          id: 'sc',
          prompt: bi('Выясните, какая StorageClass в кластере выбрана по умолчанию и какая программа создаёт её тома.', 'Find out which StorageClass is the default in the cluster and which program creates its volumes.'),
          check: { stdout: /csi-hostpath-sc \(default\)\s+hostpath\.csi\.k8s\.io/ },
          chips: 'kubectl get storageclass',
          concepts: ['k8s.storageclass', 'k8s.csi'],
          hints: { H1: bi('Классы перечисляет команда `kubectl get storageclass`, коротко `kubectl get sc`. Класс по умолчанию помечен словом (default), а программа записана в столбце PROVISIONER.', '`kubectl get storageclass`, or `kubectl get sc`, lists the classes. The default one is marked (default), and the program is in the PROVISIONER column.') },
        },
        {
          id: 'survive',
          prompt: bi('Удалите под базы данных и убедитесь, что новый под подключил ту же заявку `data` с тем же томом.', 'Delete the database pod and make sure the new pod mounted the same claim `data` with the same volume.'),
          check: {
            when: (f, start) => {
              const before = podsOf(start, 'db').map((p) => p.uid);
              const now = podsOf(f, 'db');
              const vol = claim(f, 'data')?.spec?.volumeName;
              return before.length > 0 && now.length === 1 && now[0].ready && !before.includes(now[0].uid) && !!vol && vol === claim(start, 'data')?.spec?.volumeName;
            },
            fail: [{ if: (f) => claim(f, 'data') === undefined, say: bi('Заявка `data` пропала, а вместе с ней и том базы. Удалять нужно было только под, поэтому перезагрузите страницу и попробуйте ещё раз.', 'Claim `data` is gone, and the database volume with it. Delete only the pod: reload the page and try again.') }],
          },
          chips: 'kubectl delete pod -l app=db && kubectl get pods,pvc,pv',
          concepts: ['k8s.pvc', 'k8s.pv'],
          hints: {
            H1: bi('Под можно удалить по метке командой `kubectl delete pod -l app=db`. Контроллер ReplicaSet сразу создаст новый.', 'A pod can be deleted by its label: `kubectl delete pod -l app=db`. The ReplicaSet controller creates a new one at once.'),
            H2: bi('Сравните столбец VOLUME у заявки до и после командой `kubectl get pvc data`: имя тома не изменится, а у пода будет новое имя.', 'Compare the VOLUME column of the claim before and after with `kubectl get pvc data`: the volume name stays, while the pod gets a new name.'),
          },
        },
        {
          id: 'pending',
          prompt: bi('Найдите, почему не запускается под отчётов, и почините приложение так, чтобы заработало, не удаляя Deployment `reports`.', 'Find out why the reports pod does not start and repair the application so it works, without deleting Deployment `reports`.'),
          check: {
            when: (f, start) => claim(f, 'reports')?.status?.phase === 'Bound' && podsOf(f, 'reports').some((p) => p.ready) && !!deployUid(f, 'reports') && deployUid(f, 'reports') === deployUid(start, 'reports'),
            fail: [
              { if: (f) => !deployUid(f, 'reports'), say: bi('Deployment `reports` удалили, а по условию его нужно было сохранить. Перезагрузите страницу и чините заявку, а не приложение.', 'Deployment `reports` was deleted, and the task says to keep it. Reload the page and repair the claim, not the application.') },
              { if: (f) => claim(f, 'reports')?.spec?.storageClassName === 'fast' && !k8s(f).objects.some((o) => o.kind === 'StorageClass' && o.metadata?.name === 'fast'), say: bi('Заявка по-прежнему просит класс `fast`, которого в кластере нет, поэтому драйвер её не видит. Либо создайте заявку заново с классом, который есть, либо создайте класс `fast`.', 'The claim still asks for class `fast`, which the cluster does not have, so no driver picks it up. Either create the claim again with a class that exists, or create class `fast`.') },
            ],
          },
          chips: 'kubectl describe pvc reports',
          concepts: ['k8s.pvc', 'k8s.storageclass'],
          hints: {
            H1: bi('Начните с пода и выполните `kubectl describe pod -l app=reports`. В событиях планировщик напишет, что заявка пода ещё не связана с томом, значит, следующий шаг — сама заявка и её события: `kubectl describe pvc reports`.', 'Start with the pod: `kubectl describe pod -l app=reports`. In the events the scheduler writes that the pod’s claim is not bound yet, so the next step is the claim and its events: `kubectl describe pvc reports`.'),
            H2: bi('Класс заявки у существующей заявки менять нельзя. Удалите заявку и создайте её снова с классом по умолчанию: `kubectl delete pvc reports`, затем `sed -i \'s/storageClassName: fast/storageClassName: csi-hostpath-sc/\' reports.yaml` и `kubectl apply -f reports.yaml`. Deployment останется тем же, и под подключит новую заявку.', 'The class of an existing claim cannot be changed. Delete the claim and create it again with the default class: `kubectl delete pvc reports`, then `sed -i \'s/storageClassName: fast/storageClassName: csi-hostpath-sc/\' reports.yaml` and `kubectl apply -f reports.yaml`. The Deployment stays the same, and the pod mounts the new claim.'),
          },
        },
      ],
    },
    {
      id: 'after',
      kind: 'text',
      step: 'review',
      title: bi('Как искать причину, когда заявка висит в Pending', 'How to find the cause when a claim hangs in Pending'),
      body: bi(
        'В лабораторной работе вы прошли ту же лестницу, что пригодится в настоящем кластере. Под в Pending с событием «pod has unbound immediate PersistentVolumeClaims» говорит, что дело не в узлах, а в заявке. События заявки показывают, на какой ступени остановился путь. Сообщение «storageclass.storage.k8s.io "fast" not found» означает, что класса с таким именем нет: это опечатка или класс забыли создать. Сообщение «no persistent volumes available for this claim and no storage class is set» означает, что класс в заявке не указан, а класса по умолчанию в кластере нет. Сообщение «Waiting for a volume to be created by the external provisioner» говорит о том, что класс найден, но его драйвер не работает, и тогда смотрите поды драйвера командой `kubectl get pods -A | grep csi`. А «waiting for first consumer to be created before binding» — не ошибка: класс с WaitForFirstConsumer ждёт, пока появится под, которому нужна заявка.\n\nВторое сообщение из этого списка вы сейчас получите сами. Поле `spec.storageClassName` у существующей заявки настоящий API-сервер менять не даёт, поэтому заявку с неверным классом создают заново, как в первой работе. Но заявку без класса пересоздавать не нужно: как только в кластере появляется класс по умолчанию, контроллер томов сам записывает его во все заявки, где класс не указан.',
        'In the lab you walked the same ladder you will need in a real cluster. A Pending pod with “pod has unbound immediate PersistentVolumeClaims” says the problem is not the nodes but the claim. The claim events show at which step the path stopped. “storageclass.storage.k8s.io "fast" not found” means there is no class with this name: a typo or a class nobody created. “no persistent volumes available for this claim and no storage class is set” means the claim names no class and the cluster has no default class. “Waiting for a volume to be created by the external provisioner” says the class was found but its driver does not run, and then look at the driver’s pods with `kubectl get pods -A | grep csi`. And “waiting for first consumer to be created before binding” is not an error: a WaitForFirstConsumer class waits until a pod that needs the claim appears.\n\nYou are about to get the second message of this list yourself. A real API server does not let you change `spec.storageClassName` of an existing claim, so a claim with a wrong class is created again, as in the first lab. A claim without a class, however, need not be recreated: as soon as the cluster gets a default class, the volume controller writes it into every claim that names no class.',
      ),
    },
    {
      id: 'lab-noclass',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: NO_CLASS_LAB,
      intro: bi(
        'В этом кластере CSI-драйвер `hostpath.csi.k8s.io` работает, но при переустановке администратор удалил его StorageClass, а новую не создал. Коллега создал заявку `notes` из файла `notes.yaml`, и она висит в Pending. Описание прежнего класса администратор сохранил в файле `class.yaml`.',
        'In this cluster the CSI driver `hostpath.csi.k8s.io` runs, but during a reinstall the administrator deleted its StorageClass and created no new one. A colleague created claim `notes` from `notes.yaml`, and it hangs in Pending. The administrator kept the description of the old class in `class.yaml`.',
      ),
      tasks: [
        {
          id: 'why',
          prompt: bi('Найдите в событиях заявки `notes`, почему она не получает том.', 'Find in the events of claim `notes` why it gets no volume.'),
          check: { stdout: /no persistent volumes available for this claim and no storage class is set/ },
          chips: 'kubectl describe pvc notes',
          concepts: ['k8s.pvc', 'k8s.events'],
          hints: {
            H1: bi('События любого объекта показывает команда `kubectl describe` в самом конце своего вывода.', '`kubectl describe` shows the events of any object at the very end of its output.'),
            H2: bi('Выполните `kubectl describe pvc notes` и прочитайте строку в разделе Events. Сравните её с сообщениями из раздела выше: какое из них означает, что у заявки нет класса, а класса по умолчанию в кластере нет?', 'Run `kubectl describe pvc notes` and read the line under Events. Compare it with the messages from the section above: which one means there is no class at all?'),
            H3: bi('Нужное сообщение звучит так: «no persistent volumes available for this claim and no storage class is set». Оно означает, что у заявки нет класса и в кластере нет класса по умолчанию.', 'The message you need reads “no persistent volumes available for this claim and no storage class is set”. It means the claim has no class and the cluster has no default class.'),
          },
        },
        {
          id: 'fix',
          prompt: bi(
            'Сделайте так, чтобы заявка `notes` получила том, не пересоздавая её, а будущие заявки без класса тоже получали тома от этого драйвера.',
            'Make claim `notes` get a volume without recreating it, and make future claims without a class get volumes from this driver too.',
          ),
          check: {
            when: (f, start) => claimOf(f, 'default', 'notes')?.status?.phase === 'Bound' && claimOf(f, 'default', 'notes')?.metadata?.uid === claimOf(start, 'default', 'notes')?.metadata?.uid && objsOf(f, 'StorageClass').some((s) => s.metadata?.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true'),
            fail: [
              { if: (f) => objsOf(f, 'StorageClass').length > 0 && !objsOf(f, 'StorageClass').some((s) => s.metadata?.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true'), say: bi('Класс создан, но он не помечен как класс по умолчанию, поэтому заявка без класса его не получает. Пометку ставит аннотация `storageclass.kubernetes.io/is-default-class: "true"`.', 'The class exists, but it is not marked as the default, so a claim without a class does not get it. The mark is the annotation `storageclass.kubernetes.io/is-default-class: "true"`.') },
              { if: (f) => !claimOf(f, 'default', 'notes'), say: bi('Заявки `notes` больше нет. По условию её нужно было сохранить: перезагрузите страницу и чините класс, а не заявку.', 'Claim `notes` is gone. The task says to keep it: reload the page and repair the class, not the claim.') },
              { if: (f) => claimOf(f, 'default', 'notes')?.status?.phase === 'Bound', say: bi('Заявка получила том, но это уже другая заявка с тем же именем: прежнюю вы удалили и создали заново. Перезагрузите страницу и попробуйте обойтись без этого, ведь контроллер томов сам запишет класс по умолчанию в заявку без класса.', 'The claim got a volume, but it is a different claim with the same name: you deleted the old one and created it again. Reload the page and try without that, since the volume controller writes the default class into a claim without a class by itself.') },
            ],
          },
          chips: 'kubectl apply -f class.yaml',
          concepts: ['k8s.storageclass', 'k8s.pvc'],
          hints: {
            H1: bi('Заявке без класса нужен класс по умолчанию. Посмотрите, что лежит в файле `class.yaml`, и подумайте, чего в нём не хватает, чтобы класс стал классом по умолчанию.', 'A claim without a class needs a default class. Look at what `class.yaml` holds and think what it lacks to become the default class.'),
            H2: bi('Примените файл командой `kubectl apply -f class.yaml`, а затем пометьте класс как класс по умолчанию: `kubectl annotate storageclass hostpath storageclass.kubernetes.io/is-default-class=true`.', 'Apply the file with `kubectl apply -f class.yaml`, then mark the class as the default: `kubectl annotate storageclass hostpath storageclass.kubernetes.io/is-default-class=true`.'),
            H3: bi('Через несколько секунд выполните `kubectl get pvc notes`. В столбце STORAGECLASS появится hostpath, а в столбце STATUS слово Bound.', 'After a few seconds run `kubectl get pvc notes`. The STORAGECLASS column shows hostpath, and STATUS says Bound.'),
          },
        },
      ],
    },
    {
      id: 'node-myth',
      kind: 'text',
      step: 'explain',
      title: bi('Где хранится заявка и где хранится том', 'Where the claim is kept and where the volume is'),
      body: bi(
        'Часто думают, что заявка хранится на узле. Заявка — объект API, как Deployment, и ни к какому узлу не относится. К узлу бывает привязан только сам том, и только когда это локальный диск или каталог узла. Так работает local-path в лёгких дистрибутивах: если узел пропал навсегда, данные пропали вместе с ним, и под будет ждать узла, которого больше нет. Сетевой том драйвер отключит от старого узла и подключит к новому.\n\nВторая частая ошибка состоит в том, что поды Deployment будто бы берут том иначе, чем отдельный под. Способ один и тот же, но у всех реплик Deployment один шаблон пода, а значит, и одна заявка. Большинство дисков подключаются только в режиме ReadWriteOnce, то есть к одному узлу, поэтому вторая реплика на другом узле зависнет с ошибкой «Multi-Attach error». Базе данных из трёх реплик нужен другой контроллер, о котором следующий раздел.',
        'People often think that a claim is kept on a node. A claim is an API object, like a Deployment, and belongs to no node. Only the volume itself can be tied to a node, and only when it is a local disk or a node directory. That is how local-path works in light distributions: if the node is gone for good, the data is gone with it, and the pod will wait for a node that no longer exists. A network volume is detached from the old node and attached to the new one by the driver.\n\nThe second common mistake is thinking that Deployment pods take a volume differently from a standalone pod. The way is the same, but all replicas of a Deployment share one pod template and therefore one claim. Most disks attach only in the ReadWriteOnce mode, that is, to one node, so a second replica on another node hangs with “Multi-Attach error”. A three-replica database needs another controller, the subject of the next section.',
      ),
    },
    {
      id: 'sts-explain',
      kind: 'text',
      step: 'explain',
      title: bi('Что даёт StatefulSet и чего он не даёт', 'What a StatefulSet gives and what it does not'),
      body: bi(
        '[[k8s.statefulset|StatefulSet]] — контроллер, который, как Deployment, держит заданное число подов, но обращается с каждым подом как с отдельной личностью. Поды получают постоянные имена с номерами: `web-0`, `web-1`, `web-2`. Запускаются они по порядку, и следующий под создаётся, только когда предыдущий готов, а при уменьшении числа реплик первым удаляется под с самым большим номером. Каждая реплика получает собственную заявку из шаблона `volumeClaimTemplates`, и имя заявки складывается из имени шаблона и имени пода: `data-web-0`, `data-web-1`, `data-web-2`. Пересозданный под с тем же номером снова подключает ту же заявку.\n\nЧтобы к каждой реплике можно было обратиться по имени, StatefulSet ставят в паре с [[k8s.headless-service|безголовым Service]], то есть сервисом с полем `clusterIP: None`. Своего адреса у такого сервиса нет. DNS кластера, который вы помните по уроку о DNS, отвечает на имя `web` адресами всех готовых подов сразу, а на имя `web-0.web` адресом одного пода `web-0`. Поэтому реплики базы находят друг друга по постоянным именам, даже когда поды пересоздаются и меняют IP-адреса.\n\nВажно понимать, чего StatefulSet не делает. Он не база данных и ничего не знает о данных: он даёт подам имена, порядок и диски, а что лежит на дисках, решает программа в контейнере. Три реплики PostgreSQL в StatefulSet — это три отдельные базы с тремя пустыми дисками, пока сама PostgreSQL или её оператор не настроит между ними репликацию. В лабораторной работе ниже StatefulSet запускает обычные веб-серверы, чтобы это было видно: имена и диски им достаются те же, что получила бы база.',
        'A [[k8s.statefulset|StatefulSet]] is a controller that, like a Deployment, keeps a set number of pods, but treats every pod as an individual. The pods get stable numbered names: `web-0`, `web-1`, `web-2`. They start in order, the next pod is created only when the previous one is ready, and when the replica count goes down, the pod with the highest number goes first. Every replica gets a claim of its own from the `volumeClaimTemplates` template, and the claim name is made of the template name and the pod name: `data-web-0`, `data-web-1`, `data-web-2`. A pod recreated with the same number mounts the same claim again.\n\nFor every replica to be reachable by name, a StatefulSet is paired with a [[k8s.headless-service|headless Service]], a Service with `clusterIP: None`. Such a Service has no address of its own. The cluster DNS you remember from the DNS lesson answers the name `web` with the addresses of all ready pods at once, and the name `web-0.web` with the address of the one pod `web-0`. That is how database replicas find each other by stable names even when pods are recreated and change their IP addresses.\n\nIt matters what a StatefulSet does not do. It is not a database and knows nothing about data: it gives pods names, an order and disks, and what lies on the disks is up to the program in the container. Three PostgreSQL replicas in a StatefulSet are three separate databases with three empty disks until PostgreSQL itself or its operator sets up replication between them. In the lab below the StatefulSet runs ordinary web servers to make this visible: they get the same names and disks a database would.',
      ),
    },
    {
      id: 'lab-sts',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: STS_LAB,
      intro: bi(
        'В кластере стоит CSI-драйвер со StorageClass по умолчанию, а в namespace default работает под `client`, из которого удобно обращаться к другим подам. В файле `web.yaml` описаны безголовый Service `web` и StatefulSet `web` на три реплики с шаблоном заявки `data` на 1 ГиБ, которая монтируется в каталог `/data`, и с томом emptyDir для временных файлов в каталоге `/cache`.',
        'The cluster has a CSI driver with a default StorageClass, and in namespace default runs pod `client`, handy for calling other pods. `web.yaml` describes a headless Service `web` and a StatefulSet `web` with three replicas, a claim template `data` of 1 GiB mounted at `/data` and an emptyDir volume for temporary files at `/cache`.',
      ),
      tasks: [
        {
          id: 'create',
          prompt: bi('Создайте сервис и StatefulSet из файла `web.yaml` и дождитесь, пока все три реплики будут готовы, а у каждой появится своя заявка в состоянии Bound.', 'Create the Service and the StatefulSet from `web.yaml` and wait until all three replicas are ready and each has its own claim in state Bound.'),
          check: {
            when: (f) => (stsOf(f, 'default', 'web')?.ready ?? 0) >= 3 && ['data-web-0', 'data-web-1', 'data-web-2'].every((n) => claimOf(f, 'default', n)?.status?.phase === 'Bound') && objOf(f, 'Service', 'default', 'web')?.spec?.clusterIP === 'None',
            fail: [{ if: (f) => !!stsOf(f, 'default', 'web') && (stsOf(f, 'default', 'web')?.ready ?? 0) < 3, say: bi('StatefulSet создан, но готовы ещё не все реплики. Реплики запускаются по одной, и следующий под появляется, только когда предыдущий готов. Посмотрите на это командой `kubectl get pods -w` и подождите.', 'The StatefulSet exists, but not all replicas are ready yet. They start one by one: the next pod appears when the previous one is ready. Watch it with `kubectl get pods -w` and wait.') }],
          },
          chips: 'kubectl apply -f web.yaml && kubectl get pods,pvc',
          concepts: ['k8s.statefulset', 'k8s.pvc'],
          hints: {
            H1: bi('Оба объекта лежат в одном файле, поэтому хватит одной команды `kubectl apply -f web.yaml`.', 'Both objects are in one file, so one `kubectl apply -f web.yaml` is enough.'),
            H2: bi('Затем выполните `kubectl get pods,pvc`. Поды будут называться web-0, web-1 и web-2, а заявки data-web-0, data-web-1 и data-web-2.', 'Then run `kubectl get pods,pvc`. The pods are called web-0, web-1 and web-2, and the claims data-web-0, data-web-1 and data-web-2.'),
            H3: bi('Если какая-то заявка осталась в Pending, выполните `kubectl describe pvc <имя>` и прочитайте её события, как в первой работе урока.', 'If a claim stays Pending, run `kubectl describe pvc <name>` and read its events, as in the first lab of the lesson.'),
          },
        },
        {
          id: 'dns',
          prompt: bi('Из пода `client` обратитесь к реплике `web-0` по её постоянному имени через безголовый сервис.', 'From pod `client`, call replica `web-0` by its stable name through the headless Service.'),
          check: {
            stdout: /Hello from web-0 |Name:\s+web-0\.web\.default\.svc\.cluster\.local/,
            fail: [
              { if: (f) => /Hello from web-[12] /.test(((f.term as { main?: { out: string }[] } | undefined)?.main ?? []).at(-1)?.out ?? ''), say: bi('Ответила другая реплика: вы обратились к общему имени `web`, и DNS вернул адрес любого готового пода. Добавьте к имени номер реплики, чтобы получилось `web-0.web`.', 'Another replica answered: you called the shared name `web`, and DNS returned the address of any ready pod. Put the replica number in front: `web-0.web`.') },
            ],
          },
          chips: 'kubectl exec client -- curl -s http://web-0.web',
          concepts: ['k8s.headless-service', 'k8s.cluster-dns'],
          hints: {
            H1: bi('Имя реплики складывается из имени пода и имени безголового сервиса через точку.', 'A replica’s name is the pod name and the headless Service name joined by a dot.'),
            H2: bi('Выполните `kubectl exec client -- curl -s http://web-0.web`. Веб-сервер в ответе называет имя своего пода. Вместо curl можно спросить DNS: `kubectl exec client -- nslookup web-0.web`.', 'Run `kubectl exec client -- curl -s http://web-0.web`. The web server names its pod in the answer. Instead of curl you can ask DNS: `kubectl exec client -- nslookup web-0.web`.'),
            H3: bi('Сравните с `kubectl exec client -- nslookup web`: на общее имя DNS вернёт три адреса, по одному на каждую готовую реплику.', 'Compare with `kubectl exec client -- nslookup web`: for the shared name DNS returns three addresses, one per ready replica.'),
          },
        },
      ],
    },
    {
      id: 'life-intro',
      kind: 'text',
      step: 'explain',
      title: bi('Что происходит с репликой и её диском', 'What happens to a replica and its disk'),
      body: bi(
        'Под базы данных рано или поздно удаляют: узел уходит на обслуживание, контейнер завершается аварийно, кто-то ошибается командой. В следующей работе StatefulSet `web` уже работает, и вы проверите три вещи, о которых спрашивают на собеседовании. Пересозданный под получает прежнее имя и прежнюю заявку, а с ней и файлы, которые прежний под записал на диск, тогда как файлы тома emptyDir пропадают вместе с подом. При уменьшении числа реплик поды удаляются с конца, а их заявки остаются. При увеличении реплики возвращаются к своим прежним заявкам.\n\nОбратите внимание, кто здесь что делает. Данные никто не копирует и не переносит. Новый под `web-1` получает заявку `data-web-1` потому, что имя заявки вычисляется из имени пода, а заявка по-прежнему связана со своим томом. Если бы том был каталогом на выключенном узле, под `web-1` ждал бы этого узла, а не запускался с пустым диском в другом месте.',
        'Sooner or later a database pod is deleted: a node goes into maintenance, a container crashes, someone makes a mistake with a command. In the next lab StatefulSet `web` already runs, and you will check three things interviews ask about. A recreated pod gets its old name and its old claim, and with it the files the old pod wrote to the disk, while the files of an emptyDir volume disappear with the pod. When the replica count goes down, pods are removed from the end, and their claims stay. When it goes up, the replicas return to their old claims.\n\nNotice who does what here. Nobody copies or moves the data. The new pod `web-1` gets claim `data-web-1` because the claim name is computed from the pod name, and the claim is still bound to its volume. If the volume were a directory on a switched-off node, pod `web-1` would wait for that node rather than start somewhere else with an empty disk.',
      ),
    },
    {
      id: 'lab-sts-life',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: STS_RUNNING,
      intro: bi(
        'StatefulSet `web` из прошлой работы уже запущен на три реплики, и у каждой есть своя заявка, смонтированная в каталог `/data`. Кроме того, у каждого пода есть том emptyDir, смонтированный в каталог `/cache`. Перед первым заданием посмотрите на исходное состояние командой `kubectl get pods,pvc`, чтобы потом было с чем сравнить.',
        'StatefulSet `web` from the previous lab already runs with three replicas, each with its own claim mounted at `/data`. Besides, every pod has an emptyDir volume mounted at `/cache`. Before the first task look at the starting state with `kubectl get pods,pvc`, so that you have something to compare with later.',
      ),
      tasks: [
        {
          id: 'same-name',
          prompt: bi(
            'Запишите в под `web-1` два файла: строку `order-42` в файл `/data/orders.txt` на его заявке и строку `session-7` в файл `/cache/session.txt` на томе emptyDir. Затем удалите под `web-1`, дождитесь нового пода с тем же именем и прочитайте в нём файл `/data/orders.txt`.',
            'Write two files into pod `web-1`: the line `order-42` into `/data/orders.txt` on its claim and the line `session-7` into `/cache/session.txt` on the emptyDir volume. Then delete pod `web-1`, wait for the new pod with the same name and read `/data/orders.txt` in it.',
          ),
          check: {
            when: sameWeb1,
            stdout: /^order-42\s*$/,
            fail: [
              { if: ((f: Facts, start?: Facts) => objOf(f, 'StatefulSet', 'default', 'web')?.metadata?.uid !== objOf(start, 'StatefulSet', 'default', 'web')?.metadata?.uid) as (f: Facts) => boolean, say: bi('Вы пересоздали сам StatefulSet, а нужно было удалить один под. Перезагрузите страницу и удалите только `web-1`.', 'You recreated the StatefulSet itself, and only one pod was to be deleted. Reload the page and delete only `web-1`.') },
              { if: (f) => !claimOf(f, 'default', 'data-web-1'), say: bi('Заявки `data-web-1` больше нет, а вместе с ней и тома с файлом: в классе записано `reclaimPolicy: Delete`. Удалять нужно было только под, поэтому перезагрузите страницу и попробуйте ещё раз.', 'Claim `data-web-1` is gone, and the volume with the file went with it: the class says `reclaimPolicy: Delete`. Only the pod was to be deleted, so reload the page and try again.') },
              { if: (f) => /No such file or directory/.test(lastOut(f)) && /\/data\/orders\.txt/.test(lastOut(f)), say: bi('Файла `/data/orders.txt` в поде нет. Скорее всего, его не записали до удаления пода: запишите строку командой `kubectl exec web-1 -- sh -c \'echo order-42 > /data/orders.txt\'`, удалите под ещё раз и снова прочитайте файл.', 'There is no `/data/orders.txt` in the pod. Most likely it was not written before the pod was deleted: write the line with `kubectl exec web-1 -- sh -c \'echo order-42 > /data/orders.txt\'`, delete the pod again and read the file once more.') },
            ],
          },
          chips: "kubectl exec web-1 -- sh -c 'echo order-42 > /data/orders.txt'",
          concepts: ['k8s.statefulset', 'k8s.pvc', 'k8s.volume'],
          hints: {
            H1: bi('Файл в поде записывают командой оболочки внутри контейнера: `kubectl exec web-1 -- sh -c \'echo order-42 > /data/orders.txt\'`. Так же запишите второй файл в каталог `/cache`.', 'A file is written in a pod by a shell command inside the container: `kubectl exec web-1 -- sh -c \'echo order-42 > /data/orders.txt\'`. Write the second file into `/cache` the same way.'),
            H2: bi('Затем выполните `kubectl delete pod web-1` и `kubectl get pods`: у нового `web-1` будет маленький возраст. Прочитайте файл командой `kubectl exec web-1 -- cat /data/orders.txt`.', 'Then run `kubectl delete pod web-1` and `kubectl get pods`: the new `web-1` has a small age. Read the file with `kubectl exec web-1 -- cat /data/orders.txt`.'),
            H3: bi('Строка `order-42` вернулась потому, что новый под подключил ту же заявку `data-web-1`, а заявка по-прежнему связана с тем же томом. Убедитесь в этом: столбец VOLUME у `kubectl get pvc data-web-1` остался прежним.', 'The line `order-42` came back because the new pod mounted the same claim `data-web-1`, and the claim is still bound to the same volume. Confirm it: the VOLUME column of `kubectl get pvc data-web-1` stays the same.'),
          },
        },
        {
          id: 'emptydir',
          prompt: bi('В новом поде `web-1` прочитайте файл `/cache/session.txt` и объясните себе, почему его там нет.', 'In the new pod `web-1` read `/cache/session.txt` and work out why it is not there.'),
          check: { when: sameWeb1, stdout: /can't open '\/cache\/session\.txt': No such file or directory/ },
          chips: 'kubectl exec web-1 -- cat /cache/session.txt',
          concepts: ['k8s.volume'],
          hints: {
            H1: bi('Прочитайте файл той же командой `cat`, что в прошлом задании, только с путём `/cache/session.txt`.', 'Read the file with the same `cat` as in the previous task, only with the path `/cache/session.txt`.'),
            H2: bi('Выполните `kubectl exec web-1 -- cat /cache/session.txt`. Команда ответит, что файла нет.', 'Run `kubectl exec web-1 -- cat /cache/session.txt`. The command answers that there is no such file.'),
            H3: bi('В каталог `/cache` смонтирован том emptyDir из урока о конфигурации. kubelet создаёт такой том вместе с подом и удаляет вместе с подом, поэтому новый под `web-1` получил пустой каталог, хотя имя у пода прежнее.', 'Directory `/cache` is an emptyDir volume from the configuration lesson. The kubelet creates it with the pod and deletes it with the pod, so the new pod `web-1` got an empty directory, although its name is the old one.'),
          },
        },
        {
          id: 'scale-down',
          prompt: bi('Уменьшите StatefulSet `web` до одной реплики. Выясните, какие поды удалились и что стало с их заявками.', 'Scale StatefulSet `web` down to one replica. Find out which pods went and what happened to their claims.'),
          check: {
            when: (f, start) => stsOf(f, 'default', 'web')?.replicas === 1 && !podOf(f, 'default', 'web-1') && !podOf(f, 'default', 'web-2') && !!podOf(f, 'default', 'web-0') && ['data-web-1', 'data-web-2'].every((n) => claimOf(f, 'default', n)?.status?.phase === 'Bound' && claimOf(f, 'default', n)?.spec?.volumeName === claimOf(start, 'default', n)?.spec?.volumeName),
            fail: [
              { if: (f) => stsOf(f, 'default', 'web')?.replicas === 1 && (!claimOf(f, 'default', 'data-web-1') || !claimOf(f, 'default', 'data-web-2')), say: bi('StatefulSet заявки не удаляет, значит, их удалили вручную, и тома ушли вместе с ними. Перезагрузите страницу и уменьшите число реплик, ничего больше не трогая.', 'A StatefulSet does not delete claims, so they were deleted by hand, and the volumes went with them. Reload the page and scale down without touching anything else.') },
              { if: (f) => stsOf(f, 'default', 'web')?.replicas === 1 && (!!podOf(f, 'default', 'web-1') || !!podOf(f, 'default', 'web-2')), say: bi('Число реплик уже одна, но поды завершаются по одному, начиная с самого большого номера. Подождите несколько секунд и посмотрите снова.', 'The replica count is one already, but pods terminate one by one, starting with the highest number. Wait a few seconds and look again.') },
            ],
          },
          chips: 'kubectl scale statefulset web --replicas=1 && kubectl get pods,pvc',
          concepts: ['k8s.statefulset'],
          hints: {
            H1: bi('Число реплик меняет та же команда `kubectl scale`, что и у Deployment.', 'The replica count is changed by the same `kubectl scale` as for a Deployment.'),
            H2: bi('Выполните `kubectl scale statefulset web --replicas=1`, подождите несколько секунд и выполните `kubectl get pods,pvc`. Подов останется один, а заявок по-прежнему три.', 'Run `kubectl scale statefulset web --replicas=1`, wait a few seconds and run `kubectl get pods,pvc`. One pod remains, and still three claims.'),
            H3: bi('Поды завершаются по одному, сначала `web-2`, потом `web-1`. Заявки `data-web-1` и `data-web-2` останутся в состоянии Bound со своими томами.', 'Pods terminate one by one, first `web-2`, then `web-1`. Claims `data-web-1` and `data-web-2` stay Bound with their volumes.'),
          },
        },
        {
          id: 'scale-up',
          prompt: bi('Верните StatefulSet три реплики и убедитесь, что новый под `web-2` подключил прежнюю заявку `data-web-2` с прежним томом.', 'Give the StatefulSet three replicas again and make sure the new pod `web-2` mounted the old claim `data-web-2` with the old volume.'),
          check: {
            when: (f, start) => (stsOf(f, 'default', 'web')?.ready ?? 0) >= 3 && !!podOf(f, 'default', 'web-2')?.ready && podOf(f, 'default', 'web-2')?.uid !== podOf(start, 'default', 'web-2')?.uid && !!claimOf(f, 'default', 'data-web-2')?.spec?.volumeName && claimOf(f, 'default', 'data-web-2')?.spec?.volumeName === claimOf(start, 'default', 'data-web-2')?.spec?.volumeName,
          },
          chips: 'kubectl scale statefulset web --replicas=3 && kubectl get pods,pvc',
          concepts: ['k8s.statefulset', 'k8s.pvc'],
          hints: {
            H1: bi('Нужна та же команда, что в прошлом задании, с числом 3.', 'The same command as in the previous task, with the number 3.'),
            H2: bi('После `kubectl scale statefulset web --replicas=3` сравните столбец VOLUME у заявок с тем, что вы видели до первого задания. Новых заявок не появится, и новых томов тоже.', 'After `kubectl scale statefulset web --replicas=3` compare the VOLUME column of the claims with what you saw before the first task. No new claims appear, and no new volumes.'),
            H3: bi('Целиком задание выполняется одной командой `kubectl scale statefulset web --replicas=3`. Через несколько секунд `kubectl get pods,pvc` покажет три готовых пода и те же три заявки.', 'The whole task is one command, `kubectl scale statefulset web --replicas=3`. A few seconds later `kubectl get pods,pvc` shows three ready pods and the same three claims.'),
          },
        },
      ],
    },
    {
      id: 'sts-update-intro',
      kind: 'text',
      step: 'explain',
      levels: ['intermediate', 'experienced'],
      title: bi('Как StatefulSet обновляет реплики', 'How a StatefulSet updates its replicas'),
      body: bi(
        'Когда меняется шаблон пода, StatefulSet заменяет поды по одному, начиная с самого большого номера, и переходит к следующему, только когда заменённый под готов. Поле `spec.updateStrategy.rollingUpdate.partition` останавливает замену на заданном номере: при значении 2 новую версию получат только поды с номером 2 и выше, а `web-0` и `web-1` останутся на прежней. Так выкладывают новую версию базы сначала на одну реплику и смотрят, как она себя ведёт. История шаблонов хранится в объектах ControllerRevision, и команда `kubectl rollout undo statefulset/web` возвращает предыдущий шаблон так же, как у Deployment.',
        'When the pod template changes, a StatefulSet replaces the pods one at a time, starting with the highest number, and moves on only when the replaced pod is ready. The field `spec.updateStrategy.rollingUpdate.partition` stops the replacement at a given number: with 2, only pods numbered 2 and above get the new version, and `web-0` and `web-1` stay on the old one. That is how a new database version is rolled out to one replica first to see how it behaves. The template history is kept in ControllerRevision objects, and `kubectl rollout undo statefulset/web` brings back the previous template, as for a Deployment.',
      ),
    },
    {
      id: 'lab-sts-update',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      levels: ['intermediate', 'experienced'],
      setup: STS_RUNNING,
      intro: bi('StatefulSet `web` снова работает на три реплики с образом `trainer/web:1.0`.', 'StatefulSet `web` again runs three replicas with the image `trainer/web:1.0`.'),
      tasks: [
        {
          id: 'partition',
          prompt: bi('Выложите образ `trainer/web:1.1` только на реплику `web-2`, а `web-0` и `web-1` оставьте на версии 1.0. StatefulSet не пересоздавайте.', 'Roll the image `trainer/web:1.1` out to replica `web-2` only, and keep `web-0` and `web-1` on version 1.0. Do not recreate the StatefulSet.'),
          check: {
            when: (f, start) => objOf(f, 'StatefulSet', 'default', 'web')?.metadata?.uid === objOf(start, 'StatefulSet', 'default', 'web')?.metadata?.uid && podOf(f, 'default', 'web-2')?.image === 'trainer/web:1.1' && !!podOf(f, 'default', 'web-2')?.ready && podOf(f, 'default', 'web-0')?.image === 'trainer/web:1.0' && podOf(f, 'default', 'web-1')?.image === 'trainer/web:1.0',
            fail: [{ if: (f) => podOf(f, 'default', 'web-1')?.image === 'trainer/web:1.1' || podOf(f, 'default', 'web-0')?.image === 'trainer/web:1.1', say: bi('Новую версию получили и другие реплики, потому что образ сменили раньше, чем поставили partition. Верните образ 1.0 командой `kubectl rollout undo statefulset/web` и начните с поля partition.', 'Other replicas got the new version too: the image was changed before the partition was set. Bring 1.0 back with `kubectl rollout undo statefulset/web` and start with the partition field.') }],
          },
          chips: 'kubectl set image statefulset/web web=trainer/web:1.1',
          concepts: ['k8s.statefulset', 'k8s.rolling-update'],
          hints: {
            H1: bi('Сначала поставьте partition, а уже потом меняйте образ, иначе StatefulSet успеет заменить все поды.', 'Set the partition first and change the image only then, otherwise the StatefulSet replaces all pods.'),
            H2: bi('Partition ставится так: `kubectl patch statefulset web -p \'{"spec":{"updateStrategy":{"type":"RollingUpdate","rollingUpdate":{"partition":2}}}}\'`. Затем выполните `kubectl set image statefulset/web web=trainer/web:1.1`.', 'The partition is set like this: `kubectl patch statefulset web -p \'{"spec":{"updateStrategy":{"type":"RollingUpdate","rollingUpdate":{"partition":2}}}}\'`. Then run `kubectl set image statefulset/web web=trainer/web:1.1`.'),
            H3: bi('Проверьте образы подов: `kubectl get pods -l app=web -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image`.', 'Check the pod images: `kubectl get pods -l app=web -o custom-columns=NAME:.metadata.name,IMAGE:.spec.containers[0].image`.'),
          },
        },
        {
          id: 'undo',
          prompt: bi('Новая версия на `web-2` вам не понравилась. Отмените выкладку так, чтобы все три реплики снова работали на `trainer/web:1.0`.', 'You did not like the new version on `web-2`. Undo the rollout so that all three replicas run `trainer/web:1.0` again.'),
          check: {
            when: (f, start) => ['web-0', 'web-1', 'web-2'].every((n) => podOf(f, 'default', n)?.image === 'trainer/web:1.0' && !!podOf(f, 'default', n)?.ready) && podOf(f, 'default', 'web-2')?.uid !== podOf(start, 'default', 'web-2')?.uid && objsOf(f, 'ControllerRevision', 'default').length >= 2 && objOf(f, 'StatefulSet', 'default', 'web')?.spec?.template?.spec?.containers?.[0]?.image === 'trainer/web:1.0',
          },
          chips: 'kubectl rollout undo statefulset/web',
          concepts: ['k8s.revision'],
          hints: {
            H1: bi('Откат у StatefulSet делается той же командой `kubectl rollout undo`, что у Deployment.', 'A StatefulSet is rolled back with the same `kubectl rollout undo` as a Deployment.'),
            H2: bi('Выполните `kubectl rollout history statefulset/web`, затем `kubectl rollout undo statefulset/web` и проверьте образы подов той же командой, что в прошлом задании.', 'Run `kubectl rollout history statefulset/web`, then `kubectl rollout undo statefulset/web`, and check the pod images with the same command as in the previous task.'),
            H3: bi('После отката StatefulSet заменит под `web-2`, и через несколько секунд все три пода будут работать на образе `trainer/web:1.0`.', 'After the undo the StatefulSet replaces pod `web-2`, and a few seconds later all three pods run the image `trainer/web:1.0`.'),
          },
        },
      ],
    },
    {
      id: 'sts-sample',
      kind: 'text',
      step: 'review',
      levels: ['intermediate', 'experienced'],
      title: bi('Рецепт: StatefulSet для настоящей базы', 'A recipe: a StatefulSet for a real database'),
      body: bi(
        'Для настоящей базы файл из лабораторной работы меняют в нескольких местах. Образ становится образом базы, заявка становится больше, а класс выбирают с `reclaimPolicy: Retain`, чтобы том пережил даже удаление заявки:\n\n```yaml\n  volumeClaimTemplates:\n  - metadata:\n      name: data\n    spec:\n      accessModes: [ReadWriteOnce]\n      storageClassName: retain-ssd\n      resources:\n        requests:\n          storage: 10Gi\n```\n\nНесколько вещей, о которых спрашивают на собеседовании и которые пригодятся в работе. Режим `volumeBindingMode: WaitForFirstConsumer` в классе откладывает создание диска до выбора узла, и диск появляется в зоне доступности этого узла, а при `Immediate` диск может оказаться в зоне, где у пода нет места. Поле `spec.storageClassName` у существующей заявки менять нельзя, и заявку с неверным классом создают заново. Увеличить заявку можно, если в классе стоит `allowVolumeExpansion: true`, а уменьшить нельзя никогда. При удалении StatefulSet заявки остаются, если поле `persistentVolumeClaimRetentionPolicy` не говорит иного. Репликацию между репликами настраивает сама база или её оператор, например CloudNativePG для PostgreSQL, и в рабочих кластерах базы обычно ставят так.',
        'For a real database the file from the lab changes in a few places. The image becomes the database image, the claim gets bigger, and the class is one with `reclaimPolicy: Retain`, so that the volume survives even the deletion of the claim:\n\n```yaml\n  volumeClaimTemplates:\n  - metadata:\n      name: data\n    spec:\n      accessModes: [ReadWriteOnce]\n      storageClassName: retain-ssd\n      resources:\n        requests:\n          storage: 10Gi\n```\n\nA few things interviews ask about and work needs. `volumeBindingMode: WaitForFirstConsumer` in the class delays creating the disk until the node is chosen, so the disk appears in that node’s availability zone, while with `Immediate` the disk may end up in a zone where the pod has no room. The `spec.storageClassName` of an existing claim cannot be changed, and a claim with a wrong class is created again. A claim can be enlarged when the class has `allowVolumeExpansion: true`, and never shrunk. When a StatefulSet is deleted its claims stay, unless `persistentVolumeClaimRetentionPolicy` says otherwise. Replication between the replicas is set up by the database itself or its operator, such as CloudNativePG for PostgreSQL, and production clusters usually run databases that way.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: storageQuiz.map((q) => q.id) },
  ],
};
