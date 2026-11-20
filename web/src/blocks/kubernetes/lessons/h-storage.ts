// Data that outlives a pod (05 KM07–KM08, the E5 break "PVC Pending"):
// a claim, a volume and a class of disks; dynamic provisioning by a CSI
// driver; StatefulSet for applications with data. The constructor grows by
// the storage layer here.

import { bi } from '../../../core/i18n';
import type { Facts, Lesson, QuizItem } from '../../../core/types';
import type { K8sFacts } from '../../../engine/kube-lite/facts';
import type { Obj } from '../../../engine/kube-lite/util';
import { STORAGE_LAB } from '../setups';
import { R, S, src } from '../sources';

const k8s = (f: Facts) => f.k8s as K8sFacts;
const claim = (f: Facts | undefined, name: string): Obj | undefined => (f ? k8s(f).objects.find((o) => o.kind === 'PersistentVolumeClaim' && o.metadata?.namespace === 'default' && o.metadata?.name === name) : undefined);
const podsOf = (f: Facts | undefined, app: string) => (f ? k8s(f).pods.filter((p) => p.ns === 'default' && p.labels.app === app) : []);
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
      { id: 'nosc', text: bi('В кластере нет StorageClass с таким именем', 'There is no StorageClass with this name in the cluster'), why: bi('Тогда в событии было бы написано «storageclass.storage.k8s.io "…" not found». Здесь класс найден, и в событии даже назван его провизионер, то есть программа, которая должна создать том.', 'Then the event would read "storageclass.storage.k8s.io "…" not found". Here the class was found, and the event even names its provisioner, the program that has to create the volume.') },
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
      { id: 'size', text: bi('Заявке не хватает места на три пода, и её нужно увеличить', 'The claim lacks space for three pods and must be enlarged'), why: bi('Размер тут ни при чём: ошибка в событиях пода будет «Multi-Attach error», то есть том уже подключён к другому узлу.', 'The size has nothing to do with it: the pod event will be "Multi-Attach error", that is, the volume is already attached to another node.') },
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
];

export const storageLesson: Lesson = {
  id: 'k8s-1.storage',
  block: 'k8s-1',
  title: bi('Как данные переживают под благодаря заявке PVC, тому и StorageClass', 'How data outlives a pod thanks to a PVC, a volume and a StorageClass'),
  summary: bi(
    'Почему файлы базы данных пропадают вместе с подом, как заявка PersistentVolumeClaim получает том от драйвера хранилища, чем PersistentVolume отличается от заявки, что решает StorageClass, зачем базам StatefulSet и как найти причину, когда заявка висит в Pending.',
    'Why database files disappear with the pod, how a PersistentVolumeClaim gets a volume from a storage driver, how a PersistentVolume differs from the claim, what a StorageClass decides, why databases need a StatefulSet, and how to find the cause when a claim hangs in Pending.',
  ),
  introduces: ['k8s.pvc', 'k8s.pv', 'k8s.storageclass', 'k8s.csi', 'k8s.statefulset'],
  uses: ['k8s.volume', 'k8s.pod', 'k8s.deployment', 'k8s.scheduler', 'k8s.kubelet', 'k8s.controller', 'k8s.addon', 'k8s.events', 'k8s.namespace'],
  tier: 'core',
  minutes: 40,
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
      id: 'myths',
      kind: 'text',
      step: 'explain',
      title: bi('Три ошибки, которые часто делают с томами', 'Three common mistakes about volumes'),
      body: bi(
        'Первая ошибка состоит в том, что заявку считают хранящейся на узле. Заявка — объект API, как Deployment, и ни к какому узлу не относится. К узлу бывает привязан только сам том, и только когда это локальный диск или каталог узла. Так работает local-path в лёгких дистрибутивах: если узел пропал навсегда, данные пропали вместе с ним, и под будет ждать узла, которого больше нет. Сетевой том драйвер отключит от старого узла и подключит к новому.\n\nВторая ошибка состоит в том, что поды Deployment будто бы берут том иначе, чем отдельный под. Способ один и тот же, но у всех реплик Deployment один шаблон пода, а значит, и одна заявка. Большинство дисков подключаются только в режиме ReadWriteOnce, то есть к одному узлу, поэтому вторая реплика на другом узле зависнет с ошибкой «Multi-Attach error». Для баз данных и очередей есть [[k8s.statefulset|StatefulSet]]: он даёт каждой реплике постоянное имя `db-0`, `db-1`, `db-2` и собственную заявку `data-db-0`, `data-db-1`, `data-db-2` из шаблона `volumeClaimTemplates`. Реплики запускаются по порядку, и под `db-1`, пересозданный на другом узле, снова получит заявку `data-db-1`.\n\nТретья ошибка состоит в том, что том будто бы удаляется вместе с подом. Под только подключает том. Удалите под, как в лабораторной работе выше, и контроллер создаст новый, который подключит ту же заявку. Удалите Deployment или StatefulSet, и заявки по умолчанию останутся. Данные пропадают, когда удаляют саму заявку или весь её namespace, а в классе записано `reclaimPolicy: Delete`. Поэтому для баз данных берут класс с `Retain`, и тогда том переживает и удаление заявки.',
        'The first mistake is thinking that a claim is kept on a node. A claim is an API object, like a Deployment, and belongs to no node. Only the volume itself can be tied to a node, and only when it is a local disk or a node directory. That is how local-path works in light distributions: if the node is gone for good, the data is gone with it, and the pod will wait for a node that no longer exists. A network volume is detached from the old node and attached to the new one by the driver.\n\nThe second mistake is thinking that Deployment pods take a volume differently from a standalone pod. The way is the same, but all replicas of a Deployment share one pod template and therefore one claim. Most disks attach only in the ReadWriteOnce mode, that is, to one node, so a second replica on another node hangs with “Multi-Attach error”. For databases and queues there is the [[k8s.statefulset|StatefulSet]]: it gives every replica a stable name `db-0`, `db-1`, `db-2` and its own claim `data-db-0`, `data-db-1`, `data-db-2` from the `volumeClaimTemplates` template. Replicas start in order, and pod `db-1` recreated on another node gets claim `data-db-1` again.\n\nThe third mistake is thinking that a volume is deleted with the pod. A pod only mounts the volume. Delete the pod, as in the lab above, and the controller creates a new one that mounts the same claim. Delete the Deployment or the StatefulSet, and by default the claims stay. Data disappears when the claim itself or its whole namespace is deleted and the class says `reclaimPolicy: Delete`. That is why databases get a class with `Retain`, and then the volume survives even the deletion of the claim.',
      ),
    },
    {
      id: 'sts-sample',
      kind: 'text',
      step: 'explain',
      levels: ['intermediate', 'experienced'],
      title: bi('Рецепт: StatefulSet с собственным томом у каждой реплики', 'A recipe: a StatefulSet with a volume of its own for every replica'),
      body: bi(
        'Так выглядит минимальный StatefulSet для базы на три реплики. Поле `serviceName` называет безголовый Service (`clusterIP: None`), через который у каждой реплики появляется своё имя в DNS, например `db-0.db.shop.svc.cluster.local`. Шаблон заявок `volumeClaimTemplates` превращается в заявки `data-db-0`, `data-db-1` и `data-db-2`.\n\n```yaml\napiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: db\nspec:\n  serviceName: db\n  replicas: 3\n  selector:\n    matchLabels:\n      app: db\n  template:\n    metadata:\n      labels:\n        app: db\n    spec:\n      containers:\n      - name: redis\n        image: redis:8\n        volumeMounts:\n        - name: data\n          mountPath: /data\n  volumeClaimTemplates:\n  - metadata:\n      name: data\n    spec:\n      accessModes: [ReadWriteOnce]\n      storageClassName: retain-ssd\n      resources:\n        requests:\n          storage: 10Gi\n```\n\nНесколько вещей, о которых спрашивают на собеседовании и которые пригодятся в работе. Режим `volumeBindingMode: WaitForFirstConsumer` в классе откладывает создание диска до выбора узла, и диск появляется в зоне доступности этого узла, а при `Immediate` диск может оказаться в зоне, где у пода нет места. Поле `spec.storageClassName` у существующей заявки менять нельзя: API-сервер ответит, что спецификация неизменяема, и заявку придётся создать заново. Увеличить заявку можно, если в классе стоит `allowVolumeExpansion: true`, а уменьшить нельзя никогда. При удалении StatefulSet заявки остаются, если поле `persistentVolumeClaimRetentionPolicy` не говорит иного. Учебный кластер в браузере StatefulSet не знает, поэтому этот рецепт вы запустите на настоящем узле на этапе 2.',
        'This is a minimal StatefulSet for a three-replica database. The `serviceName` field names a headless Service (`clusterIP: None`) through which every replica gets a DNS name of its own, for example `db-0.db.shop.svc.cluster.local`. The claim template `volumeClaimTemplates` turns into claims `data-db-0`, `data-db-1` and `data-db-2`.\n\n```yaml\napiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: db\nspec:\n  serviceName: db\n  replicas: 3\n  selector:\n    matchLabels:\n      app: db\n  template:\n    metadata:\n      labels:\n        app: db\n    spec:\n      containers:\n      - name: redis\n        image: redis:8\n        volumeMounts:\n        - name: data\n          mountPath: /data\n  volumeClaimTemplates:\n  - metadata:\n      name: data\n    spec:\n      accessModes: [ReadWriteOnce]\n      storageClassName: retain-ssd\n      resources:\n        requests:\n          storage: 10Gi\n```\n\nA few things interviews ask about and work needs. `volumeBindingMode: WaitForFirstConsumer` in the class delays creating the disk until the node is chosen, so the disk appears in that node’s availability zone, while with `Immediate` the disk may end up in a zone where the pod has no room. The `spec.storageClassName` of an existing claim cannot be changed: the API server answers that the spec is immutable, and the claim has to be created again. A claim can be enlarged when the class has `allowVolumeExpansion: true`, and never shrunk. When a StatefulSet is deleted its claims stay, unless `persistentVolumeClaimRetentionPolicy` says otherwise. The browser training cluster does not know StatefulSets, so you will run this recipe on a real node in stage 2.',
      ),
    },
    {
      id: 'after',
      kind: 'text',
      step: 'review',
      title: bi('Как искать причину, когда заявка висит в Pending', 'How to find the cause when a claim hangs in Pending'),
      body: bi(
        'В лабораторной работе вы прошли ту же лестницу, что пригодится в настоящем кластере. Под в Pending с событием «pod has unbound immediate PersistentVolumeClaims» говорит, что дело не в узлах, а в заявке. События заявки показывают, на какой ступени остановился путь. Сообщение «storageclass.storage.k8s.io "fast" not found» означает, что класса с таким именем нет: это опечатка или класс забыли создать. Сообщение «no persistent volumes available for this claim and no storage class is set» означает, что класс в заявке не указан, а класса по умолчанию в кластере нет. Сообщение «Waiting for a volume to be created by the external provisioner» говорит о том, что класс найден, но его драйвер не работает, и тогда смотрите поды драйвера командой `kubectl get pods -A | grep csi`. А «waiting for first consumer to be created before binding» — не ошибка: класс с WaitForFirstConsumer ждёт, пока появится под, которому нужна заявка.\n\nУчебный тренажёр примет и правку класса у существующей заявки командой `kubectl patch`, но настоящий API-сервер её отклонит, поэтому привыкайте создавать заявку заново.',
        'In the lab you walked the same ladder you will need in a real cluster. A Pending pod with “pod has unbound immediate PersistentVolumeClaims” says the problem is not the nodes but the claim. The claim events show at which step the path stopped. “storageclass.storage.k8s.io "fast" not found” means there is no class with this name: a typo or a class nobody created. “no persistent volumes available for this claim and no storage class is set” means the claim names no class and the cluster has no default class. “Waiting for a volume to be created by the external provisioner” says the class was found but its driver does not run, and then look at the driver’s pods with `kubectl get pods -A | grep csi`. And “waiting for first consumer to be created before binding” is not an error: a WaitForFirstConsumer class waits until a pod that needs the claim appears.\n\nThe training simulator will also accept changing the class of an existing claim with `kubectl patch`, but a real API server refuses it, so get used to creating the claim again.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: storageQuiz.map((q) => q.id) },
  ],
};
