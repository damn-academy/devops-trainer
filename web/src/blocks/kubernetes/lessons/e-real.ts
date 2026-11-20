// The real stage (05 §11, R12), part one: one real node (k3s on a VM or on
// your own machine). The kubeadm cluster on three VMs is in f-kubeadm.ts.
// The trainer guides and checks (trainer-check.sh), but does not execute:
// the commands run on your machines. Every part ends with a cleanup.

import { bi } from '../../../core/i18n';
import type { Lesson, QuizItem } from '../../../core/types';
import { S, R, src } from '../sources';

export const realQuiz: QuizItem[] = [
  {
    id: 'k8s.q.real.etcdutl',
    kind: 'mcq',
    concepts: ['k8s.kubeadm'],
    prompt: bi('Команда `etcdctl snapshot restore` в кластере с etcd 3.6 отвечает ошибкой. Почему?', '`etcdctl snapshot restore` fails in a cluster with etcd 3.6. Why?'),
    options: [
      { id: 'moved', text: bi('В etcd 3.6 восстановление из снимка перенесли в etcdutl', 'In etcd 3.6 restoring from a snapshot moved to etcdutl'), correct: true },
      { id: 'certs', text: bi('Не переданы сертификаты --cacert, --cert и --key', 'The --cacert/--cert/--key certificates were not passed'), why: bi('Сертификаты нужны, чтобы обращаться к работающему etcd, например для snapshot save. Восстановление работает с файлом, а не с сервером, и в версии 3.6 его выполняет etcdutl.', 'Certificates are needed to talk to a running etcd (snapshot save). Restoring works on a file, not a server, and in 3.6 etcdutl does it.') },
    ],
    explain: bi('Инструкции в интернете написаны для какой-то своей версии, поэтому сначала проверьте, какая версия у вас.', 'Instructions on the internet are written for their own version: check yours first.'),
  },
  {
    id: 'k8s.q.real.static',
    kind: 'mcq',
    concepts: ['k8s.static-pod'],
    prompt: bi('Как kubeadm запускает kube-apiserver, если API-сервера, который мог бы создать под, ещё нет?', 'How does kubeadm start kube-apiserver when there is no API server yet to create a pod?'),
    options: [
      { id: 'static', text: bi('Кладёт манифест в /etc/kubernetes/manifests, а такие поды kubelet запускает сам', 'It puts a manifest into /etc/kubernetes/manifests: the kubelet runs such pods by itself'), correct: true },
      { id: 'systemd', text: bi('Запускает kube-apiserver службой systemd', 'It starts kube-apiserver as a systemd service'), why: bi('Так делают некоторые установки «вручную», но kubeadm запускает управляющий слой статическими подами, и службой systemd работает только kubelet.', 'Some "the hard way" setups do, but kubeadm runs the control plane as static pods; only the kubelet is a systemd service.') },
    ],
  },
  {
    id: 'k8s.q.real.cleanup',
    kind: 'mcq',
    concepts: ['k8s.k3s'],
    prompt: bi('Вы закончили этап и закрыли ноутбук. Что будет со счётом за виртуальные машины?', 'You finished the stage and closed your laptop. What happens to the VM bill?'),
    options: [
      { id: 'grows', text: bi('Он растёт каждый час, пока машины не удалены', 'It grows every hour until the VMs are deleted'), correct: true },
      { id: 'stops', text: bi('Счёт перестанет расти, потому что машины без нагрузки бесплатны', 'It stops: idle VMs are free'), why: bi('Провайдер берёт деньги за выделенные ресурсы, а не за нагрузку, и даже остановленная машина часто стоит денег за диск и адрес.', 'A provider charges for allocated resources, not for load; a stopped VM often costs money too (the disk, the address).') },
    ],
  },
];

const r1Checks = [
  { id: 'node', label: bi('Узел в состоянии Ready', 'The node is Ready'), when: 'k8s.nodes[ready=true]#>=1' },
  { id: 'real', label: bi('Ядро настоящее, а не симулятор', 'This is a real kernel, not the simulator'), when: "k8s.nodes#>=1 && k8s.nodes[kernel~'dt-sim']#=0" },
  { id: 'dns', label: bi('CoreDNS работает', 'CoreDNS is running'), when: "k8s.pods[ns=kube-system][name~'coredns'][ready=true]#>=1" },
  { id: 'traefik', label: bi('Traefik, контроллер входа k3s, работает', 'Traefik (the k3s ingress controller) is running'), when: "k8s.pods[ns=kube-system][name~'traefik'][ready=true]#>=1" },
  { id: 'gwc', label: bi('GatewayClass traefik принят', 'GatewayClass traefik is accepted'), when: "k8s.objects[kind=GatewayClass][metadata.name=traefik].status.conditions[type=Accepted].status=True", hint: bi('Включите поддержку Gateway API во встроенном Traefik (шаг 5 чеклиста) и подождите минуту.', 'Enable the Gateway API provider of the built-in Traefik (step 5) and wait a minute.') },
  { id: 'app', label: bi('В namespace shop есть Deployment с двумя готовыми подами', 'Namespace shop has a Deployment with two ready pods'), when: 'k8s.deployments[ns=shop][ready>=2]#>=1' },
  { id: 'svc', label: bi('У Service в namespace shop есть готовые адреса', 'A Service in shop has ready endpoints'), when: 'k8s.services[ns=shop][endpoints>=1]#>=1' },
  { id: 'route', label: bi('Gateway принял HTTPRoute', 'An HTTPRoute is accepted by a Gateway'), when: "k8s.objects[kind=HTTPRoute].status.parents.conditions[type=Accepted].status=True", hint: bi('Проверьте поле parentRefs в HTTPRoute и вывод `kubectl describe httproute`.', 'Check the HTTPRoute parentRefs and `kubectl describe httproute`.') },
];

export const singleNodeLesson: Lesson = {
  id: 'k8s-2.single-node',
  block: 'k8s-2',
  title: bi('Один настоящий узел на k3s', 'One real node: k3s'),
  summary: bi('Во втором этапе вы ставите k3s на виртуальную машину или на свой компьютер, переносите kubeconfig на ноутбук, включаете Gateway API во встроенном Traefik, ставите чарт Helm, проходите проверку сборщиком фактов и убираете за собой машины.', 'Stage 2: k3s on one VM or on your own machine, the kubeconfig on your laptop, the Gateway API of the built-in Traefik, a Helm chart, the agent check and the cleanup.'),
  introduces: ['k8s.k3s'],
  uses: ['k8s.kubeconfig', 'k8s.helm', 'k8s.gateway-api', 'k8s.service', 'k8s.deployment', 'k8s.namespace'],
  tier: 'core',
  minutes: 120,
  sources: src([S.k3s, S.k3sNetworking, S.helm, S.gatewayApi], [R.what, R.cheatsheet, R.helm]),
  sections: [
    {
      id: 'why',
      kind: 'text',
      step: 'hook',
      body: bi(
        'На собеседовании инженера DevOps почти всегда спрашивают, ставили ли вы кластер своими руками, и на этом этапе вы его поставите. Всё, что вы делали до сих пор, работало в браузере, на модели кластера. Теперь кластер будет настоящим: [[k8s.k3s|k3s]], лёгкий дистрибутив Kubernetes в одном исполняемом файле. В нём уже есть всё, что вы видели в конструкторе: управляющий слой, kubelet и containerd, flannel, CoreDNS, Traefik в роли контроллера входа и local-path для томов. Адреса те же, что в тренажёре: поды получают адреса из `10.42.0.0/16`, Service из `10.43.0.0/16`, а DNS отвечает на `10.43.0.10`, потому что модель тренажёра собрана по образцу k3s.\n\nНа этом этапе тренажёр ведёт вас и проверяет результат, но команды не выполняет: их вы запускаете у себя. Платить за это не обязательно, потому что весь этап можно пройти бесплатно на виртуальной машине на своём компьютере, и как это сделать, описано ниже по шагам. В конце этапа обязательна уборка.',
        'A DevOps engineer interview almost always asks whether you have installed a cluster with your own hands, and at this stage you will. Everything you did so far ran in the browser, on a model of a cluster. Now a real one: [[k8s.k3s|k3s]], a light Kubernetes distribution in one binary. It already has everything you saw in the constructor: the control plane, the kubelet and containerd, flannel, CoreDNS, Traefik as the ingress controller and local-path for volumes. The addresses are the same as in the trainer: pods `10.42.0.0/16`, Services `10.43.0.0/16`, DNS `10.43.0.10` — the model was built after k3s.\n\nHere the trainer guides and checks but does not execute: you run the commands on your side. You do not have to pay for it: the whole stage can be done for free on a virtual machine on your own computer, and the steps for that are below. At the end there is a mandatory cleanup.',
      ),
    },
    { id: 'cost', kind: 'callout', tone: 'cost', step: 'hook', title: bi('Сколько это стоит', 'What it costs'), body: bi('Одна виртуальная машина с двумя ядрами и 4 ГБ памяти на несколько часов обычно стоит дешевле чашки кофе, а на своём компьютере в программе Multipass, о которой рассказано ниже, всё бесплатно. Расход начинается с момента, когда вы создали машину, и заканчивается только после уборки.', 'One VM with 2 vCPU / 4 GB for a few hours usually costs less than a cup of coffee; on your own computer with Multipass, described below, it is free. The meter starts when the VM is created and stops only after the cleanup.') },
    { id: 'cost-table', kind: 'widget', step: 'hook', widget: 'k8s.cost', props: { vms: 1, hours: 4 } },
    {
      id: 'local',
      kind: 'text',
      step: 'practice',
      title: bi('Как пройти этап бесплатно на виртуальной машине своего компьютера', 'How to do the stage for free on a virtual machine of your own computer'),
      body: bi(
        'Если не хотите заводить облачный аккаунт и привязывать карту, создайте машину программой Multipass. Она бесплатна, работает на macOS и Windows 11 и одной командой создаёт виртуальную машину с Ubuntu. Испортить при этом свой компьютер нельзя: машина работает отдельно от вашей системы и удаляется одной командой.\n\n**Сначала проверьте память.** Для машины нужно 4 ГБ свободной памяти, а значит, на компьютере должно быть не меньше 8 ГБ. На Windows 11 откройте Диспетчер задач (Ctrl+Shift+Esc), вкладку «Производительность» и раздел «Память». На macOS откройте меню Apple и пункт «Об этом Mac». Если памяти ровно 8 ГБ, закройте другие программы и лишние вкладки браузера, а в команде ниже дайте машине 3 ГБ вместо 4 ГБ, то есть напишите `--memory 3G`: одному узлу k3s этого хватает.\n\n**Установите Multipass.** Скачайте установщик для своей системы со страницы [canonical.com/multipass](https://canonical.com/multipass/install) и запустите его. На Windows 11 Pro установщик сам включит встроенную виртуализацию Hyper-V, а на Windows 11 Home сначала установите бесплатную программу VirtualBox и выберите её в установщике Multipass. Чтобы проверить установку, откройте терминал своего компьютера. На Windows нажмите клавишу Win, наберите PowerShell и нажмите Enter, а на macOS нажмите Cmd+Пробел, наберите «Терминал» и нажмите Enter. В открывшемся окне выполните `multipass version`: команда должна напечатать номер версии.\n\n**Создайте машину и войдите в неё.**\n\n```bash\nmultipass launch 24.04 --name k3s --cpus 2 --memory 4G --disk 10G\nmultipass info k3s     # строка IPv4 — адрес машины\nmultipass shell k3s    # терминал внутри машины\n```\n\nПервые два пункта чеклиста ниже на этом готовы: машина создана, а межсетевой экран на своём компьютере не нужен. Поэтому идите по чеклисту с третьего пункта, выполняйте команды внутри машины и вместо публичного IP-адреса везде подставляйте адрес из `multipass info k3s`. Как удалить машину в конце, сказано в разделе об уборке.',
        'If you do not want to open a cloud account and attach a card, create the machine with Multipass. It is free, runs on macOS and Windows 11 and creates an Ubuntu virtual machine with one command. You cannot spoil your computer this way: the machine lives apart from your system and is deleted with one command.\n\n**First check the memory.** The machine needs 4 GB of free memory, so the computer should have at least 8 GB. On Windows 11 open the Task Manager (Ctrl+Shift+Esc), the Performance tab and the Memory section. On macOS open the Apple menu and About This Mac. If you have exactly 8 GB, close other programs and extra browser tabs, and in the command below give the machine 3 GB instead of 4 GB, that is, `--memory 3G`: that is enough for one k3s node.\n\n**Install Multipass.** Download the installer for your system from [canonical.com/multipass](https://canonical.com/multipass/install) and run it. On Windows 11 Pro the installer turns on the built-in Hyper-V virtualisation itself, and on Windows 11 Home first install the free VirtualBox and choose it in the Multipass installer. To check the install, open a terminal on your computer. On Windows press the Win key, type PowerShell and press Enter; on macOS press Cmd+Space, type Terminal and press Enter. In that window run `multipass version`: it must print a version number.\n\n**Create the machine and enter it.**\n\n```bash\nmultipass launch 24.04 --name k3s --cpus 2 --memory 4G --disk 10G\nmultipass info k3s     # the IPv4 line is the machine address\nmultipass shell k3s    # a terminal inside the machine\n```\n\nThe first two checklist steps below are now done: the machine exists, and no firewall is needed on your own computer. So follow the checklist from step three, run the commands inside the machine, and wherever a public IP is asked for, use the address from `multipass info k3s`. The cleanup section says how to delete the machine at the end.',
      ),
    },
    {
      id: 'steps',
      kind: 'text',
      step: 'practice',
      title: bi('Чеклист', 'The checklist'),
      body: bi(
        '### 1. Машина\nСоздайте одну виртуальную машину Ubuntu 24.04 с двумя ядрами и 4 ГБ памяти и поставьте на неё метку `trainer=devops`, потому что по этой метке машину потом удаляют. Если машина работает в Multipass на вашем компьютере, этот пункт уже выполнен командой из раздела выше, и метка не нужна.\n\n### 2. Межсетевой экран\nСнаружи откройте порты 22 (SSH), 80 и 443, а порт API 6443 откройте только для своего IP-адреса.\n\n### 3. Установка k3s с чтением скрипта\nНе запускайте `curl … | sh` вслепую. Скачайте скрипт и прочитайте его:\n\n```bash\ncurl -sfLo install-k3s.sh https://get.k3s.io\nless install-k3s.sh\nsudo INSTALL_K3S_VERSION=<версия> sh install-k3s.sh --write-kubeconfig-mode 600 --tls-san <публичный-IP>\nsudo k3s kubectl get nodes\n```\n\nВерсию возьмите со страницы выпусков k3s и не меняйте её до конца этапа. Перед установкой найдите в скрипте, что он делает с переменной `INSTALL_K3S_VERSION` и что случится, если её не задать.\n\n### 4. Kubeconfig на свой компьютер\n```bash\nsudo cat /etc/rancher/k3s/k3s.yaml     # на ВМ\n```\nСкопируйте этот файл в `~/.kube/config` на ноутбуке, замените в нём `127.0.0.1` на публичный IP-адрес машины и проверьте командой `kubectl get nodes` уже с ноутбука. Вы увидите тот же вывод, что в тренажёре, только узел будет один.\n\n### 5. Gateway API во встроенном Traefik\nПо умолчанию поддержка Gateway API у Traefik в k3s выключена. Включите её файлом на машине:\n\n```yaml\n# /var/lib/rancher/k3s/server/manifests/traefik-config.yaml\napiVersion: helm.cattle.io/v1\nkind: HelmChartConfig\nmetadata:\n  name: traefik\n  namespace: kube-system\nspec:\n  valuesContent: |-\n    providers:\n      kubernetesGateway:\n        enabled: true\n```\n\nk3s сам переустановит чарт. Чтобы проверить результат, выполните `kubectl get gatewayclass`, и в выводе должен появиться `traefik` с ACCEPTED True.\n\n### 6. Приложение через Helm\n```bash\nhelm repo add podinfo https://stefanprodan.github.io/podinfo\nhelm install web podinfo/podinfo -n shop --create-namespace --set replicaCount=2\nhelm list -n shop\n```\n\n### 7. Вход через Gateway\n```yaml\napiVersion: gateway.networking.k8s.io/v1\nkind: Gateway\nmetadata:\n  name: shop\n  namespace: shop\nspec:\n  gatewayClassName: traefik\n  listeners:\n  - name: web\n    protocol: HTTP\n    port: 8000\n---\napiVersion: gateway.networking.k8s.io/v1\nkind: HTTPRoute\nmetadata:\n  name: web\n  namespace: shop\nspec:\n  parentRefs:\n  - name: shop\n  rules:\n  - backendRefs:\n    - name: web-podinfo\n      port: 9898\n```\nПорт слушателя совпадает с портом точки входа `web` внутри Traefik (8000), а снаружи его публикует Service Traefik на порту 80. Проверка: `curl http://<IP>/` отвечает JSON-ом podinfo, а `kubectl -n shop describe httproute web` показывает Accepted.\n\n### 8. Образ из вашего пайплайна\nЕсли вы уже публиковали свой образ в реестре, например в ghcr.io, замените образ podinfo на свой и укажите его по digest: `kubectl -n shop set image deploy/web-podinfo podinfo=ghcr.io/<вы>/<образ>@sha256:…`. Для приватного реестра понадобится `imagePullSecrets`. Если своего образа в реестре нет, потому что блок CI/CD шёл на учебном сервере, соберите образ командой `docker build` и отправьте его командой `docker push`, как в блоке о контейнерах, либо пропустите этот пункт: проверка этапа его не требует.',
        '### 1. A machine\nOne Ubuntu 24.04 VM, 2 vCPU and 4 GB, labelled `trainer=devops` — that label is what you delete by later. With Multipass on your own computer this step is already done by the command in the section above, and no label is needed.\n\n### 2. A firewall\nFrom outside, 22 (SSH) and 80/443 are open; the API port 6443 only from your own IP.\n\n### 3. Installing k3s — reading the script\nDo not run `curl … | sh` blindly. Download the script and read it:\n\n```bash\ncurl -sfLo install-k3s.sh https://get.k3s.io\nless install-k3s.sh\nsudo INSTALL_K3S_VERSION=<version> sh install-k3s.sh --write-kubeconfig-mode 600 --tls-san <public-IP>\nsudo k3s kubectl get nodes\n```\n\nTake the version from the k3s releases page and keep it until the end of the stage. Before installing, find in the script what it does with `INSTALL_K3S_VERSION` and what happens if it is not set.\n\n### 4. The kubeconfig on your machine\n```bash\nsudo cat /etc/rancher/k3s/k3s.yaml     # on the VM\n```\nCopy it to `~/.kube/config` on your laptop, replace `127.0.0.1` with the VM’s public IP and check `kubectl get nodes` from the laptop. You see the same output as in the trainer — only with one node.\n\n### 5. The Gateway API of the built-in Traefik\nBy default the Gateway API provider of Traefik in k3s is off. Turn it on with a file on the VM:\n\n```yaml\n# /var/lib/rancher/k3s/server/manifests/traefik-config.yaml\napiVersion: helm.cattle.io/v1\nkind: HelmChartConfig\nmetadata:\n  name: traefik\n  namespace: kube-system\nspec:\n  valuesContent: |-\n    providers:\n      kubernetesGateway:\n        enabled: true\n```\n\nk3s reinstalls the chart itself. Check: `kubectl get gatewayclass` shows `traefik` with ACCEPTED True.\n\n### 6. An application with Helm\n```bash\nhelm repo add podinfo https://stefanprodan.github.io/podinfo\nhelm install web podinfo/podinfo -n shop --create-namespace --set replicaCount=2\nhelm list -n shop\n```\n\n### 7. The way in through a Gateway\n```yaml\napiVersion: gateway.networking.k8s.io/v1\nkind: Gateway\nmetadata:\n  name: shop\n  namespace: shop\nspec:\n  gatewayClassName: traefik\n  listeners:\n  - name: web\n    protocol: HTTP\n    port: 8000\n---\napiVersion: gateway.networking.k8s.io/v1\nkind: HTTPRoute\nmetadata:\n  name: web\n  namespace: shop\nspec:\n  parentRefs:\n  - name: shop\n  rules:\n  - backendRefs:\n    - name: web-podinfo\n      port: 9898\n```\nThe listener port is the port of Traefik’s `web` entrypoint inside the pod (8000); outside, the Traefik Service publishes it on 80. Check: `curl http://<IP>/` answers with podinfo JSON, and `kubectl -n shop describe httproute web` shows Accepted.\n\n### 8. The image from your pipeline\nIf you have already published your own image in a registry, for example ghcr.io, replace the podinfo image with yours, by digest: `kubectl -n shop set image deploy/web-podinfo podinfo=ghcr.io/<you>/<image>@sha256:…`. A private registry needs `imagePullSecrets`. If you have no image of your own in a registry, because the CI/CD block ran on the training server, build one with `docker build` and send it with `docker push`, as in the containers block, or skip this step: the stage check does not require it.',
      ),
    },
    {
      id: 'findvar',
      kind: 'callout',
      tone: 'note',
      step: 'practice',
      title: bi('Найдите в скрипте', 'Find it in the script'),
      body: bi('Скрипт установки k3s написан на обычном sh. Найдите в нём место, где он читает `INSTALL_K3S_VERSION`, и посмотрите, откуда он берёт версию, если переменная не задана: без неё скрипт сам поставит последнюю версию, и на двух машинах версии могут разойтись. После установки проверьте командой `k3s --version`, что версия совпала с выбранной.', 'The k3s install script is plain sh. Find the place where it reads `INSTALL_K3S_VERSION` and see where it takes the version from when the variable is not set: without it the script installs the latest version itself, and two machines can end up on different versions. After the install, check `k3s --version`: it must match the one you chose.'),
    },
    {
      id: 'read-script',
      kind: 'callout',
      tone: 'note',
      step: 'practice',
      levels: ['beginner'],
      title: bi('Как прочитать скрипт, если вы не пишете на sh', 'How to read the script if you do not write sh'),
      body: bi('Весь скрипт читать не нужно. Откройте его командой `less install-k3s.sh`, наберите `/INSTALL_K3S_VERSION` и нажмите Enter: less подсветит строки, где упоминается эта переменная, а клавиша n перейдёт к следующей такой строке. Ищите строку, где скрипт проверяет, пуста ли переменная, и если она пуста, сам спрашивает у сайта k3s номер последней версии. Выйти из less можно клавишей q.', 'You do not need to read the whole script. Open it with `less install-k3s.sh`, type `/INSTALL_K3S_VERSION` and press Enter: less highlights the lines that mention the variable, and the n key goes to the next one. Look for the line where the script checks whether the variable is empty and, if it is, asks the k3s site for the latest version number. Press q to leave less.'),
    },
    { id: 'check', kind: 'widget', step: 'exit', widget: 'k8s.real-check', props: { track: 'r1', checks: r1Checks } },
    {
      id: 'cleanup',
      kind: 'callout',
      tone: 'cleanup',
      step: 'review',
      title: bi('Уборка обязательна', 'Cleanup — mandatory'),
      body: bi(
        'Этап не закончен, пока виртуальная машина не удалена. Удаляйте машины по метке, а не по памяти, и проверьте, что список пуст:\n\n```bash\nhcloud server list -l trainer=devops -o json      # Hetzner: должно быть []\nhcloud server delete <имя>\nyc compute instance list --format json             # Yandex Cloud: проверьте, что ВМ с меткой trainer=devops нет\n```\n\nНа своём компьютере выполните `/usr/local/bin/k3s-uninstall.sh`, если ставили k3s прямо в систему, или `multipass delete --purge k3s`, если ставили его в машину Multipass, и проверьте, что команда `multipass list` печатает `No instances found`.',
        'The stage is not over until the VM is deleted. Delete by the label, not from memory, and check that the list is empty:\n\n```bash\nhcloud server list -l trainer=devops -o json      # Hetzner: must be []\nhcloud server delete <name>\nyc compute instance list --format json             # Yandex Cloud: check there is no VM labelled trainer=devops\n```\n\nOn your own machine run `/usr/local/bin/k3s-uninstall.sh` if you installed k3s right into the system, or `multipass delete --purge k3s` if you installed it into a Multipass machine, and check that `multipass list` prints `No instances found`.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'review', title: bi('Проверьте себя', 'Check yourself'), items: ['k8s.q.real.cleanup'] },
  ],
};
