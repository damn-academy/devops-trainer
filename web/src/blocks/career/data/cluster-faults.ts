// The faults of the review "the whole cluster map" (lesson final.cluster-map):
// one per layer of the Kubernetes constructor, in the order the layers are
// built. Each fault removes one component from an otherwise full cluster and
// runs a constructor scenario on kube-lite, so the learner reads the real
// kubectl and curl output, names the component that does not do its job and
// repairs it; the repaired run is the same scenario on the full cluster.

import { bi, type Bi } from '../../../core/i18n';
import { SCENARIOS, type LayerId, type Scenario } from '../../../engine/kube-lite/ui/constructor-model';

export interface FaultOption {
  /** A component id of the constructor, or a free id for a non-component answer. */
  id: string;
  /** Shown instead of the component label (non-component answers). */
  label?: Bi;
  /** Why this answer is wrong; absent on the right one. */
  why?: Bi;
}

export interface ClusterFault {
  id: string;
  layer: LayerId;
  scenario: Scenario;
  /** The component taken out of the full cluster. */
  broken: string;
  ticket: Bi;
  options: FaultOption[];
  /** What the output shows and why this component is the cause. */
  cause: Bi;
  /** How to check and repair it on a real cluster. */
  real: Bi;
}

const sc = (id: string): Scenario => SCENARIOS.find((s) => s.id === id)!;

/** The node layer needs `kubectl get nodes` in the output, which no constructor scenario prints after a plain apply. */
const NODES: Scenario = {
  id: 'repair-nodes',
  layer: 'node',
  label: bi('Поды и узлы', 'Pods and nodes'),
  lines: ['kubectl create deployment web --image=trainer/web:1.0 --replicas=3', 'cluster ff 30s', 'kubectl get pods -o wide', 'kubectl get nodes'],
  chain: ['apiserver', 'etcd', 'controller-manager', 'scheduler', 'kubelet', 'runtime', 'cni'],
  ok: bi('Агенты узлов сообщают, что узлы готовы, поэтому планировщик назначил подам узлы, а kubelet запустил контейнеры.', 'The node agents report the nodes ready, so the scheduler assigned the pods to nodes and the kubelet started the containers.'),
};

const RESTART_NODES: FaultOption = {
  id: 'restart',
  label: bi('Перезагрузить все узлы, ничего не выясняя, и кластер заработает', 'No need to look: reboot every node and the cluster will work'),
  why: bi(
    'Перезагрузка ничего не объясняет. Вы не узнаете, какой компонент не работает, а пока узлы перезагружаются, остановятся и те поды, которые сейчас обслуживают пользователей. Компонент, которого нет или который не запускается, после перезагрузки так же не будет работать. Сначала найдите по выводу, на каком шаге остановилась цепочка.',
    'A reboot explains nothing. You will not learn which component does not work, and while the nodes reboot the pods that serve users now stop too. A component that is missing or does not start will still not work after the reboot. First find in the output at which step the chain stopped.',
  ),
};

export const CLUSTER_FAULTS: ClusterFault[] = [
  {
    id: 'cp',
    layer: 'cp',
    scenario: sc('apply'),
    broken: 'controller-manager',
    ticket: bi(
      'Разработчик создал Deployment web на три реплики. Команда `kubectl create` ответила, что Deployment создан, но прошло полминуты, а подов так и нет. Коллега в чате предлагает перезагрузить узлы.',
      'A developer created Deployment web with three replicas. `kubectl create` answered that the Deployment was created, but half a minute later there are still no pods. A colleague in the chat suggests rebooting the nodes.',
    ),
    options: [
      { id: 'controller-manager' },
      { id: 'scheduler', why: bi('Планировщик назначает узлы подам, которые уже существуют. Если бы не работал он, поды были бы в выводе со статусом Pending. Здесь подов нет вовсе, значит, их никто не создал.', 'The scheduler assigns nodes to pods that already exist. Without it the pods would be in the output as Pending. Here there are no pods at all, so nobody created them.') },
      { id: 'etcd', why: bi('Если бы не работал etcd, API-сервер не сохранил бы Deployment, и kubectl получил бы ошибку. Deployment создан и виден в выводе, значит, хранилище работает.', 'Without etcd the API server would not have stored the Deployment, and kubectl would have got an error. The Deployment is created and shown, so the store works.') },
      RESTART_NODES,
    ],
    cause: bi(
      'Не работает kube-controller-manager. Deployment сохранён, и kubectl его показывает с READY 0/3, но ReplicaSet по нему никто не создал, а без ReplicaSet нет и подов. Контроллеры Deployment и ReplicaSet, которые доводят число подов до желаемого, работают в этом процессе.',
      'kube-controller-manager does not work. The Deployment is stored, and kubectl shows it with READY 0/3, but nobody created a ReplicaSet for it, and without a ReplicaSet there are no pods. The Deployment and ReplicaSet controllers, which bring the number of pods to the desired one, run in this process.',
    ),
    real: bi(
      'В кластере kubeadm kube-controller-manager работает статическим подом на управляющем узле. Посмотрите на него командой `kubectl -n kube-system get pods -l component=kube-controller-manager` и прочитайте его журнал командой `kubectl -n kube-system logs` с именем этого пода. Если пода нет совсем, откройте на управляющем узле файл `/etc/kubernetes/manifests/kube-controller-manager.yaml`: kubelet запускает статические поды по файлам из этого каталога, и ошибка в файле не даёт поду появиться. В k3s весь управляющий слой работает внутри одного процесса k3s server, поэтому статических подов там нет, и журнал управляющего слоя читают командой `journalctl -u k3s`.',
      'In a kubeadm cluster kube-controller-manager runs as a static pod on the control-plane node. Look at it with `kubectl -n kube-system get pods -l component=kube-controller-manager` and read its log with `kubectl -n kube-system logs` and the pod name. If there is no pod at all, open `/etc/kubernetes/manifests/kube-controller-manager.yaml` on the control-plane node: the kubelet starts static pods from the files in that directory, and a mistake in the file keeps the pod from appearing. In k3s the whole control plane runs inside one k3s server process, so there are no static pods, and the control-plane log is read with `journalctl -u k3s`.',
    ),
  },
  {
    id: 'node',
    layer: 'node',
    scenario: NODES,
    broken: 'kubelet',
    ticket: bi(
      'Подов три, но все они полминуты стоят в Pending, и дежурный подозревает планировщик. Выполните команды и проверьте по выводу, прав ли дежурный.',
      'There are three pods, but all of them have been Pending for half a minute, and the on-call engineer suspects the scheduler. Check whether he is right.',
    ),
    options: [
      { id: 'kubelet' },
      { id: 'scheduler', why: bi('Здесь поды стоят в Pending, потому что им ещё не назначили узел, но вывод `kubectl get nodes` показывает, что назначать некуда: все три узла NotReady. Планировщик работает правильно и ждёт, когда появится готовый узел.', 'Here the pods are Pending because they have no node yet, but `kubectl get nodes` shows there is nowhere to put it: all three nodes are NotReady. The scheduler works correctly and waits for a ready node.') },
      { id: 'apiserver', why: bi('API-сервер ответил на каждую команду kubectl, значит, он работает. Молчат узлы.', 'The API server answered every kubectl command, so it works. It is the nodes that are silent.') },
      { id: 'coredns', why: bi('CoreDNS отвечает на имена внутри кластера и к запуску подов отношения не имеет. Он сам работает подами, и ему тоже нужен готовый узел.', 'CoreDNS answers names inside the cluster and has nothing to do with starting pods. It runs as pods itself and needs a ready node too.') },
    ],
    cause: bi(
      'Не работает kubelet, агент узла. Каждые несколько секунд он сообщает API-серверу, что узел жив, и без этих сообщений контроллер узлов помечает узлы как NotReady. На неготовые узлы планировщик поды не ставит, поэтому поды и остаются в Pending.',
      'The kubelet, the node agent, does not work. Every few seconds it tells the API server the node is alive, and without these reports the node controller marks the nodes NotReady. The scheduler puts no pods on nodes that are not ready, so the pods stay Pending.',
    ),
    real: bi(
      'kubelet работает на каждой машине как служба systemd, а не как под, поэтому через kubectl его не увидеть. Зайдите на узел по SSH и выполните `systemctl status kubelet`, а причину ищите в журнале командой `journalctl -u kubelet -n 50`. В k3s агент узла работает внутри службы k3s-agent на рабочих узлах и службы k3s на управляющем, поэтому там смотрят `systemctl status k3s-agent`. Если отказали все узлы сразу, ищите общую причину, например истёкший сертификат kubelet или изменение, которое выкатили на все машины одновременно.',
      'The kubelet runs on every machine as a systemd service, not as a pod, so kubectl cannot show it. Log in to the node over SSH and run `systemctl status kubelet`, then look for the cause in the log with `journalctl -u kubelet -n 50`. In k3s the node agent runs inside the k3s-agent service on workers and the k3s service on the server, so there you look at `systemctl status k3s-agent`. If every node failed at once, look for a common cause, such as an expired kubelet certificate or a change rolled out to all machines at the same time.',
    ),
  },
  {
    id: 'net',
    layer: 'net',
    scenario: sc('service'),
    broken: 'coredns',
    ticket: bi(
      'Приложение в поде client не может обратиться к сервису web по имени, хотя поды web работают. Разработчики пишут, что в кластере сломалась сеть, и просят перезапустить их поды.',
      'The application in pod client cannot reach Service web by name, although the web pods run. The developers write that the cluster network is broken and ask to restart their pods.',
    ),
    options: [
      { id: 'coredns' },
      { id: 'kube-proxy', why: bi('Правила kube-proxy ведут запрос с адреса ClusterIP на один из подов. Второй запрос, по адресу ClusterIP, получил ответ, значит, эти правила работают.', 'The kube-proxy rules lead a request from the ClusterIP to one of the pods. The second request, to the ClusterIP, got an answer, so these rules work.') },
      { id: 'cni', label: bi('Сетевой плагин (CNI)', 'The network plugin (CNI)'), why: bi('Сетевой плагин даёт подам адреса и связывает узлы. Ответ по адресу пришёл от пода web, значит, пакеты между подами ходят.', 'The network plugin gives pods addresses and links the nodes. The answer by address came from a web pod, so packets travel between pods.') },
      { id: 'restart', label: bi('Перезапустить поды client и web, как просят разработчики', 'Restart pods client and web, as the developers ask'), why: bi('Поды client и web работают правильно, и после перезапуска запрос по имени упадёт так же, потому что спрашивать адрес по-прежнему не у кого.', 'Pods client and web work correctly, and after a restart the request by name fails the same way, because there is still nobody to ask for the address.') },
    ],
    cause: bi(
      'Не работает CoreDNS. По адресу ClusterIP сервис отвечает, значит, сеть подов и правила kube-proxy в порядке. А запрос по имени не превращается в адрес, и curl пишет «Could not resolve host». Имя сервиса в адрес внутри кластера превращает CoreDNS.',
      'CoreDNS does not work. The Service answers at its ClusterIP, so the pod network and the kube-proxy rules are fine. But the request by name does not turn into an address, and curl says “Could not resolve host”. Inside the cluster, CoreDNS turns a Service name into an address.',
    ),
    real: bi(
      'CoreDNS работает подами в пространстве имён kube-system с меткой k8s-app=kube-dns, и посмотреть на них можно командой `kubectl -n kube-system get pods -l k8s-app=kube-dns`. Изнутри пода имя проверяют командой `nslookup web`, а адрес резолвера, к которому обращается под, записан в файле `/etc/resolv.conf` этого пода. Сравнить ответ по имени с ответом по адресу полезно всегда: так одним шагом отделяют DNS от сети.',
      'CoreDNS runs as pods in the kube-system namespace with the label k8s-app=kube-dns; look at them with `kubectl -n kube-system get pods -l k8s-app=kube-dns`. Inside a pod a name is checked with `nslookup web`, and the resolver address the pod uses is in that pod’s `/etc/resolv.conf`. Comparing the answer by name with the answer by address always pays off: it separates DNS from the network in one step.',
    ),
  },
  {
    id: 'ingress',
    layer: 'ingress',
    scenario: sc('outside'),
    broken: 'metallb',
    ticket: bi(
      'Магазин выложили, маршрут для shop.example создан, но из офиса сайт не открывается: curl не может установить соединение.',
      'The shop is released and the route for shop.example is created, but the site does not open from the office: curl cannot connect.',
    ),
    options: [
      { id: 'metallb' },
      { id: 'traefik', why: bi('У Gateway traefik-gateway в колонке PROGRAMMED стоит True, значит, контроллер входа работает и маршрут принял. Запрос не доходит до него, потому что у его сервиса нет внешнего адреса.', 'Gateway traefik-gateway shows PROGRAMMED True, so the ingress controller works and has taken the route. The request does not reach it because its Service has no external address.') },
      { id: 'coredns', why: bi('CoreDNS отвечает на имена внутри кластера, а имя shop.example для ноутбука в офисе превращает в адрес DNS офиса. К тому же curl написал «Failed to connect», а не «Could not resolve host», значит, имя в адрес превратилось.', 'CoreDNS answers names inside the cluster; for the office laptop shop.example is resolved by the office DNS. Besides, curl said “Failed to connect”, not “Could not resolve host”, so the name did turn into an address.') },
      { id: 'scheduler', why: bi('Если бы поды магазина не запустились, Traefik ответил бы 503 со словами «no available server». Здесь соединение не устанавливается вовсе, то есть запрос не дошёл даже до Traefik.', 'If the shop pods had not started, Traefik would answer 503 “no available server”. Here no connection is set up at all, so the request did not even reach Traefik.') },
    ],
    cause: bi(
      'Не работает MetalLB. У сервиса traefik тип LoadBalancer, и адрес в сети офиса такому сервису выдаёт MetalLB. Пока MetalLB нет, в колонке EXTERNAL-IP стоит «<pending>», и на адресе 192.168.56.240, куда DNS офиса направляет shop.example, никто не отвечает.',
      'MetalLB does not work. Service traefik is of type LoadBalancer, and MetalLB is what gives such a Service an address on the office network. Without MetalLB EXTERNAL-IP shows “<pending>”, and nobody answers at 192.168.56.240, where the office DNS sends shop.example.',
    ),
    real: bi(
      'Команда `kubectl -n traefik get svc traefik` покажет, есть ли у сервиса внешний адрес. Если там «<pending>», посмотрите на поды MetalLB командой `kubectl -n metallb-system get pods` и на пул адресов командой `kubectl -n metallb-system get ipaddresspools`, потому что MetalLB выдаёт адреса только из пула, который ему описали. В облаке ту же работу делает балансировщик провайдера, и «<pending>» там означает, что облако не создало балансировщик.',
      '`kubectl -n traefik get svc traefik` shows whether the Service has an external address. If it says “<pending>”, look at the MetalLB pods with `kubectl -n metallb-system get pods` and at the address pool with `kubectl -n metallb-system get ipaddresspools`, because MetalLB gives out addresses only from a pool it has been given. In a cloud the provider’s load balancer does the same work, and “<pending>” there means the cloud has not created the load balancer.',
    ),
  },
  {
    id: 'certs',
    layer: 'certs',
    scenario: sc('https'),
    broken: 'cert-manager',
    ticket: bi(
      'Для shop.example включили HTTPS, но браузеры в офисе предупреждают, что сертификат недоверенный, а curl отказывается соединяться.',
      'HTTPS was switched on for shop.example, but browsers in the office warn that the certificate is not trusted, and curl refuses to connect.',
    ),
    options: [
      { id: 'cert-manager' },
      { id: 'traefik', why: bi('Traefik отвечает по HTTPS, только сертификат у него свой, запасной. Правильный сертификат он отдал бы, если бы в Secret shop-tls было что отдавать.', 'Traefik answers over HTTPS, only with its own fallback certificate. It would present the right one if Secret shop-tls had anything in it.') },
      { id: 'metallb', why: bi('Соединение с shop.example устанавливается, а ошибка возникает на проверке сертификата. Значит, адрес у сервиса есть, и MetalLB работает.', 'The connection to shop.example is set up, and the error comes at the certificate check. So the Service has an address and MetalLB works.') },
      { id: 'ignore', label: bi('Попросить пользователей нажать «Всё равно перейти на сайт»', 'Ask users to click “Proceed to the site anyway”'), why: bi('Предупреждение браузера означает, что подлинность сайта не проверена. Если приучить к нему пользователей, они не заметят и настоящую подмену сайта. Чинить нужно выпуск сертификата.', 'The browser warning means the site’s identity is not verified. Users trained to ignore it will not notice a real impostor either. What needs fixing is the certificate issuing.') },
    ],
    cause: bi(
      'Не работает cert-manager. Кластер не знает даже типа ресурса Certificate, поэтому Secret shop-tls никто не создал. Поэтому Traefik отдаёт свой запасной самоподписанный сертификат, которому ноутбук в офисе не доверяет.',
      'cert-manager does not work. The cluster does not know the Certificate resource at all, and nobody created Secret shop-tls. So Traefik presents its fallback self-signed certificate, which the office laptop does not trust.',
    ),
    real: bi(
      'Команда `kubectl get certificate -A` покажет сертификаты и их готовность, а `kubectl -n traefik describe certificate shop-tls` расскажет, на каком шаге остановился выпуск. Если кластер отвечает, что такого типа ресурса нет, значит, cert-manager не установлен, и его поды стоит искать командой `kubectl -n cert-manager get pods`. Кто выпустил сертификат, который отдаёт сайт, и до какого числа он действует, покажет команда `openssl s_client -connect shop.example:443 -servername shop.example </dev/null | openssl x509 -noout -issuer -dates`.',
      '`kubectl get certificate -A` shows the certificates and whether they are ready, and `kubectl -n traefik describe certificate shop-tls` tells at which step issuing stopped. If the cluster answers that there is no such resource type, cert-manager is not installed; look for its pods with `kubectl -n cert-manager get pods`. Who issued the certificate the site presents and until when it is valid is shown by `openssl s_client -connect shop.example:443 -servername shop.example </dev/null | openssl x509 -noout -issuer -dates`.',
    ),
  },
  {
    id: 'storage',
    layer: 'storage',
    scenario: sc('disk'),
    broken: 'csi-hostpath',
    ticket: bi(
      'База данных db не запускается, и её под полминуты стоит в Pending. Коллега предлагает удалить заявку на диск и создать её заново.',
      'Database db does not start: its pod has been Pending for half a minute. A colleague suggests deleting the disk claim and creating it again.',
    ),
    options: [
      { id: 'csi-hostpath' },
      { id: 'scheduler', why: bi('Планировщик не ставит под, пока заявка на диск не связана с томом. Событие заявки data говорит, что том создать не из чего, и планировщик ждёт, как и должен.', 'The scheduler does not place a pod while its disk claim is not bound to a volume. The event of claim data says there is nothing to create a volume from, and the scheduler waits, as it should.') },
      { id: 'kubelet', why: bi('Если бы не работал агент узла, узлы были бы NotReady, а событие говорило бы о другом. Здесь же событие заявки говорит о диске.', 'Without the node agent the nodes would be NotReady, and the event would say something else. Here the event of the claim speaks about the disk directly.') },
      { id: 'recreate', label: bi('Удалить заявку data и создать её заново', 'Delete claim data and create it again'), why: bi('Новая заявка тоже останется в Pending по той же причине: в кластере по-прежнему нет класса хранилища, по которому можно создать том.', 'A new claim stays Pending too, for the same reason: the cluster still has no storage class to create a volume from.') },
    ],
    cause: bi(
      'В кластере нет CSI-драйвера, а вместе с ним нет и StorageClass. Под db ждёт диск, который заказан заявкой PVC data, но выполнить заявку некому, и в её событиях написано «no storage class is set». Пока диска нет, планировщик под не ставит.',
      'The cluster has no CSI driver, and with it no StorageClass. Pod db waits for the disk ordered by PVC data, but nobody can fulfil the claim, and its events say “no storage class is set”. Until the disk exists the scheduler does not place the pod.',
    ),
    real: bi(
      'Команда `kubectl get storageclass` покажет классы хранилища и тот, что стоит по умолчанию. `kubectl describe pvc data` расскажет в событиях, почему заявка не выполнена. Поды драйвера обычно работают в kube-system или в своём пространстве имён, и если они есть, но том не создаётся, причину ищите в их журналах.',
      '`kubectl get storageclass` shows the storage classes and the default one. `kubectl describe pvc data` tells in its events why the claim is not fulfilled. The driver pods usually run in kube-system or in their own namespace, and if they exist but no volume is created, look for the cause in their logs.',
    ),
  },
  {
    id: 'metrics',
    layer: 'metrics',
    scenario: sc('hpa'),
    broken: 'metrics-server',
    ticket: bi(
      'Под нагрузкой сайт тормозит. Автомасштабирование настроено так, чтобы добавлять реплики до пяти, а работает по-прежнему одна реплика.',
      'The site slows down under load. Autoscaling is set up to add replicas up to five, yet the same single one runs.',
    ),
    options: [
      { id: 'metrics-server' },
      { id: 'controller-manager', why: bi('Контроллер HPA работает внутри kube-controller-manager, но без него не было бы и самого пода web, ведь поды создаёт контроллер ReplicaSet из того же процесса. Под работает, а HPA ждёт цифр, которых нет.', 'The HPA controller runs inside kube-controller-manager, but without it there would be no web pod either, because pods are created by the ReplicaSet controller of the same process. The pod runs, and the HPA waits for numbers that are not there.') },
      { id: 'prometheus', why: bi('Для масштабирования по процессору HPA берёт цифры не у Prometheus, а у Metrics API, которое обслуживает metrics-server. Prometheus понадобится, только если масштабировать по своим метрикам через отдельный адаптер.', 'For CPU scaling the HPA takes its numbers not from Prometheus but from the Metrics API served by metrics-server. Prometheus is needed only for scaling on custom metrics through a separate adapter.') },
      { id: 'scheduler', why: bi('Планировщику нечего ставить, потому что новых подов никто не просил: HPA не увеличил число реплик, и до выбора узлов дело не дошло.', 'The scheduler has nothing to place, because nobody asked for new pods: the HPA did not raise the replica count, so choosing nodes never came up.') },
    ],
    cause: bi(
      'Не работает metrics-server. Контроллеру HPA неоткуда узнать, сколько процессора тратят поды: `kubectl top` пишет «Metrics API not available», а в колонке TARGETS стоит <unknown>. Без этих цифр HPA реплик не добавляет.',
      'metrics-server does not work. The HPA controller cannot learn how much CPU the pods use: `kubectl top` says “Metrics API not available”, and TARGETS shows <unknown>. Without these numbers the HPA adds no replicas.',
    ),
    real: bi(
      'Команда `kubectl top pods` первой покажет, отвечает ли Metrics API. Состояние самого API видно в выводе `kubectl get apiservice v1beta1.metrics.k8s.io`, а под metrics-server обычно работает в kube-system. Проверьте заодно, что у подов в манифесте заданы requests, потому что HPA считает загрузку в процентах от requests и без них тоже покажет <unknown>.',
      '`kubectl top pods` shows first whether the Metrics API answers. The state of the API itself is in `kubectl get apiservice v1beta1.metrics.k8s.io`, and the metrics-server pod usually runs in kube-system. Check too that the pods have requests in the manifest, because the HPA counts usage as a percentage of requests and shows <unknown> without them as well.',
    ),
  },
  {
    id: 'gitops',
    layer: 'gitops',
    scenario: sc('gitops'),
    broken: 'flux',
    ticket: bi(
      'Коммит с файлом web.yaml отправлен в ветку main, но в кластере Deployment web не появился. Дежурный попробовал поправить число реплик вручную, и это тоже не помогло.',
      'A commit with web.yaml went to the main branch, but Deployment web did not appear in the cluster. The on-call engineer tried to change the replica count by hand, and that did not help either.',
    ),
    options: [
      { id: 'flux' },
      { id: 'controller-manager', why: bi('Deployment web не существует вовсе, поэтому контроллерам нечего делать. Создать его в кластере должен был тот, кто забирает манифесты из Git.', 'Deployment web does not exist at all, so the controllers have nothing to do. It should have been created in the cluster by whoever fetches the manifests from Git.') },
      { id: 'git', label: bi('Сервер Git не принял коммит', 'The Git server did not accept the commit'), why: bi('Сервер Git ответил строкой «main -> main», то есть коммит принят. Проблема по другую сторону, в кластере.', 'The Git server answered “main -> main”, so the commit was accepted. The problem is on the other side, in the cluster.') },
      { id: 'apiserver', why: bi('API-сервер отвечает на каждую команду, в том числе ответом «not found». Он работает, но объекта web в нём нет.', 'The API server answers every command, including an honest “not found”. It works; there is just no web object in it.') },
    ],
    cause: bi(
      'Не работает Flux. Коммит лежит в Git, но в кластер его никто не применяет: кластер даже не знает тип ресурса Kustomization, которым Flux описывает, что и откуда забирать. Ручная правка ничего не дала, потому что объекта web в кластере нет, а если бы Flux работал, он вернул бы ручную правку к записанному в Git при следующей сверке.',
      'Flux does not work. The commit is in Git, but nobody applies it to the cluster: the cluster does not even know the Kustomization resource type with which Flux describes what to fetch and from where. The manual change did nothing because there is no web object in the cluster, and with Flux running the manual change would be reverted to what Git says at the next reconciliation.',
    ),
    real: bi(
      'Команда `flux check` проверит, что контроллеры Flux установлены и работают, `kubectl get kustomization -A` покажет, какую ревизию Git применил каждый Kustomization и были ли ошибки, а `flux logs` выведет журналы контроллеров. Если вы работаете с Argo CD, то же самое видно в колонках SYNC STATUS и HEALTH STATUS команды `kubectl -n argocd get applications`.',
      '`flux check` verifies that the Flux controllers are installed and running, `kubectl get kustomization -A` shows which Git revision each Kustomization applied and whether there were errors, and `flux logs` prints the controllers’ logs. With Argo CD the same is visible in the SYNC STATUS and HEALTH STATUS columns of `kubectl -n argocd get applications`.',
    ),
  },
  {
    id: 'obs',
    layer: 'obs',
    scenario: sc('alert'),
    broken: 'kube-state-metrics',
    ticket: bi(
      'Под pay двадцать минут перезапускается в CrashLoopBackOff, а алерт KubePodCrashLooping так и не пришёл. Prometheus при этом отвечает на запросы.',
      'Pod pay has been restarting in CrashLoopBackOff for twenty minutes, yet the KubePodCrashLooping alert never came. Prometheus answers requests meanwhile.',
    ),
    options: [
      { id: 'kube-state-metrics' },
      { id: 'prometheus', why: bi('Prometheus ответил на запрос к своему API и показал горящий алерт Watchdog, значит, сам он работает и считает правила.', 'Prometheus answered a request to its API and showed the firing Watchdog alert, so it works itself and evaluates the rules.') },
      { id: 'node-exporter', why: bi('node-exporter рассказывает о машинах, то есть о процессоре, памяти и дисках. О перезапусках контейнеров он ничего не знает, эти метрики даёт kube-state-metrics.', 'node-exporter tells about the machines, that is, CPU, memory and disks. It knows nothing about container restarts; those metrics come from kube-state-metrics.') },
      { id: 'alertmanager', label: bi('Alertmanager, который доставляет алерты', 'Alertmanager, which delivers alerts'), why: bi('Alertmanager доставляет алерты, которые Prometheus уже перевёл в состояние firing. Здесь KubePodCrashLooping нет даже в списке алертов Prometheus, значит, до доставки дело не дошло.', 'Alertmanager delivers alerts Prometheus has already moved to firing. Here KubePodCrashLooping is not even in Prometheus’s alert list, so delivery never came into it.') },
    ],
    cause: bi(
      'Не работает kube-state-metrics. Prometheus работает, и алерт Watchdog у него горит, но метрик о состоянии подов у него нет. Правило, для которого нет метрики, не выдаёт ни ошибки, ни алерта и молчит.',
      'kube-state-metrics does not work. Prometheus runs, and its Watchdog alert is firing, but it has no metrics about the state of pods. A rule without its metric raises neither an error nor an alert and stays silent.',
    ),
    real: bi(
      'Откройте в Prometheus страницу Status → Targets: цель, которая не отвечает, видна там сразу. Метрику, на которой построено правило, проверьте запросом в Prometheus, например `kube_pod_container_status_waiting_reason`. Пустой ответ значит, что поставщика этой метрики нет или Prometheus его не опрашивает. Алерт Watchdog нарочно горит всегда, и если он перестал приходить, значит, сломалась сама доставка.',
      'Open Status → Targets in Prometheus: a target that does not answer shows up there at once. Check the metric the rule is built on with a query in Prometheus, such as `kube_pod_container_status_waiting_reason`. An empty answer means the source of the metric is missing or Prometheus does not scrape it. The Watchdog alert fires all the time on purpose: if it stops arriving, the delivery itself is broken.',
    ),
  },
];
