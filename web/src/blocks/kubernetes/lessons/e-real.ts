// The real stage (05 §11, R12): stage 2 — one real node (k3s on a VM or on
// your own machine); stage 3 — a kubeadm cluster on three VMs. The trainer
// guides and checks (trainer-check.sh), but does not execute: the commands
// run on your machines. Both stages end with a mandatory cleanup.

import { bi } from '../../../core/i18n';
import type { Lesson, QuizItem } from '../../../core/types';
import { S, R, src } from '../sources';

export const realQuiz: QuizItem[] = [
  {
    id: 'k8s.q.real.etcdutl',
    kind: 'mcq',
    concepts: ['k8s.kubeadm'],
    prompt: bi('`etcdctl snapshot restore` в кластере с etcd 3.6 отвечает ошибкой. Почему?', '`etcdctl snapshot restore` fails in a cluster with etcd 3.6. Why?'),
    options: [
      { id: 'moved', text: bi('В etcd 3.6 восстановление из снимка перенесено в etcdutl', 'In etcd 3.6 restoring from a snapshot moved to etcdutl'), correct: true },
      { id: 'certs', text: bi('Не переданы сертификаты --cacert/--cert/--key', 'The --cacert/--cert/--key certificates were not passed'), why: bi('Сертификаты нужны, чтобы говорить с работающим etcd (snapshot save). Восстановление работает с файлом, а не с сервером, и в 3.6 его делает etcdutl.', 'Certificates are needed to talk to a running etcd (snapshot save). Restoring works on a file, not a server, and in 3.6 etcdutl does it.') },
    ],
    explain: bi('Инструкции из интернета пишут под свою версию: сначала проверьте, какая у вас.', 'Instructions on the internet are written for their own version: check yours first.'),
  },
  {
    id: 'k8s.q.real.static',
    kind: 'mcq',
    concepts: ['k8s.static-pod'],
    prompt: bi('Как kubeadm запускает kube-apiserver, если API-сервера ещё нет, чтобы создать под?', 'How does kubeadm start kube-apiserver when there is no API server yet to create a pod?'),
    options: [
      { id: 'static', text: bi('Кладёт манифест в /etc/kubernetes/manifests: kubelet запускает такие поды сам', 'It puts a manifest into /etc/kubernetes/manifests: the kubelet runs such pods by itself'), correct: true },
      { id: 'systemd', text: bi('Запускает kube-apiserver службой systemd', 'It starts kube-apiserver as a systemd service'), why: bi('Так делают некоторые установки «по-жёсткому», но kubeadm запускает control plane статическими подами; службой systemd работает только kubelet.', 'Some "the hard way" setups do, but kubeadm runs the control plane as static pods; only the kubelet is a systemd service.') },
    ],
  },
  {
    id: 'k8s.q.real.cleanup',
    kind: 'mcq',
    concepts: ['k8s.k3s'],
    prompt: bi('Вы закончили этап и закрыли ноутбук. Что будет со счётом за ВМ?', 'You finished the stage and closed your laptop. What happens to the VM bill?'),
    options: [
      { id: 'grows', text: bi('Он растёт каждый час, пока ВМ не удалены', 'It grows every hour until the VMs are deleted'), correct: true },
      { id: 'stops', text: bi('Остановится: ВМ без нагрузки бесплатны', 'It stops: idle VMs are free'), why: bi('Провайдер берёт деньги за выделенные ресурсы, а не за нагрузку; остановленная ВМ часто тоже стоит денег (диск, адрес).', 'A provider charges for allocated resources, not for load; a stopped VM often costs money too (the disk, the address).') },
    ],
  },
];

const r1Checks = [
  { id: 'node', label: bi('Узел Ready', 'The node is Ready'), when: 'k8s.nodes[ready=true]#>=1' },
  { id: 'real', label: bi('Это настоящее ядро, а не симулятор', 'This is a real kernel, not the simulator'), when: "k8s.nodes#>=1 && k8s.nodes[kernel~'dt-sim']#=0" },
  { id: 'dns', label: bi('CoreDNS работает', 'CoreDNS is running'), when: "k8s.pods[ns=kube-system][name~'coredns'][ready=true]#>=1" },
  { id: 'traefik', label: bi('Traefik (контроллер входа k3s) работает', 'Traefik (the k3s ingress controller) is running'), when: "k8s.pods[ns=kube-system][name~'traefik'][ready=true]#>=1" },
  { id: 'gwc', label: bi('GatewayClass traefik принят', 'GatewayClass traefik is accepted'), when: "k8s.objects[kind=GatewayClass][metadata.name=traefik].status.conditions[type=Accepted].status=True", hint: bi('Включите провайдер Gateway API у встроенного Traefik (шаг 5) и подождите минуту.', 'Enable the Gateway API provider of the built-in Traefik (step 5) and wait a minute.') },
  { id: 'app', label: bi('В namespace shop есть Deployment с двумя готовыми подами', 'Namespace shop has a Deployment with two ready pods'), when: 'k8s.deployments[ns=shop][ready>=2]#>=1' },
  { id: 'svc', label: bi('У Service в shop есть готовые адреса', 'A Service in shop has ready endpoints'), when: 'k8s.services[ns=shop][endpoints>=1]#>=1' },
  { id: 'route', label: bi('HTTPRoute принят Gateway', 'An HTTPRoute is accepted by a Gateway'), when: "k8s.objects[kind=HTTPRoute].status.parents.conditions[type=Accepted].status=True", hint: bi('Проверьте parentRefs HTTPRoute и `kubectl describe httproute`.', 'Check the HTTPRoute parentRefs and `kubectl describe httproute`.') },
];

const r3Checks = [
  { id: 'nodes', label: bi('Три узла Ready', 'Three nodes are Ready'), when: 'k8s.nodes[ready=true]#>=3' },
  { id: 'real', label: bi('Настоящие ядра, не симулятор', 'Real kernels, not the simulator'), when: "k8s.nodes#>=3 && k8s.nodes[kernel~'dt-sim']#=0" },
  { id: 'cp', label: bi('Есть узел control plane', 'There is a control-plane node'), when: "k8s.nodes[roles has 'control-plane']#>=1" },
  { id: 'static', label: bi('kube-apiserver и etcd работают статическими подами', 'kube-apiserver and etcd run as static pods'), when: "k8s.pods[ns=kube-system][name~'kube-apiserver-'][ready=true]#>=1 && k8s.pods[ns=kube-system][name~'etcd-'][ready=true]#>=1" },
  { id: 'cilium', label: bi('Cilium работает на каждом узле', 'Cilium runs on every node'), when: "k8s.pods[ns=kube-system][name~'cilium-'][ready=true]#>=3", hint: bi('`cilium status --wait` на cp-1 покажет, что не так.', '`cilium status --wait` on cp-1 shows what is wrong.') },
  { id: 'dns', label: bi('CoreDNS работает', 'CoreDNS is running'), when: "k8s.pods[ns=kube-system][name~'coredns'][ready=true]#>=1" },
  { id: 'sc', label: bi('Есть StorageClass', 'There is a StorageClass'), when: 'k8s.objects[kind=StorageClass]#>=1' },
  { id: 'spread', label: bi('Deployment web: три готовых пода', 'Deployment web: three ready pods'), when: 'k8s.deployments[ns=default][name=web].ready>=3' },
];

export const singleNodeLesson: Lesson = {
  id: 'k8s-2.single-node',
  block: 'k8s-2',
  title: bi('Один настоящий узел: k3s', 'One real node: k3s'),
  summary: bi('Этап 2: k3s на одной ВМ или на своём компьютере, kubeconfig на ноутбуке, Gateway API у встроенного Traefik, Helm-чарт, проверка агентом и уборка.', 'Stage 2: k3s on one VM or on your own machine, the kubeconfig on your laptop, the Gateway API of the built-in Traefik, a Helm chart, the agent check and the cleanup.'),
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
        'Всё, что вы делали, работало в браузере, на модели кластера. Теперь — настоящий: [[k8s.k3s|k3s]], лёгкий дистрибутив Kubernetes одним бинарником. В нём уже есть всё, что вы видели в конструкторе: control plane, kubelet и containerd, flannel, CoreDNS, Traefik как контроллер входа и local-path для томов. Адреса те же, что в тренажёре: поды `10.42.0.0/16`, Service `10.43.0.0/16`, DNS `10.43.0.10` — модель была собрана по k3s.\n\nТренажёр здесь ведёт и проверяет, но не исполняет: команды вы запускаете у себя. В конце — обязательная уборка.',
        'Everything you did so far ran in the browser, on a model of a cluster. Now a real one: [[k8s.k3s|k3s]], a light Kubernetes distribution in one binary. It already has everything you saw in the constructor: the control plane, the kubelet and containerd, flannel, CoreDNS, Traefik as the ingress controller and local-path for volumes. The addresses are the same as in the trainer: pods `10.42.0.0/16`, Services `10.43.0.0/16`, DNS `10.43.0.10` — the model was built after k3s.\n\nHere the trainer guides and checks but does not execute: you run the commands on your side. At the end there is a mandatory cleanup.',
      ),
    },
    { id: 'cost', kind: 'callout', tone: 'cost', step: 'hook', title: bi('Сколько это стоит', 'What it costs'), body: bi('Одна ВМ 2 vCPU / 4 ГБ на несколько часов — обычно меньше стоимости чашки кофе; на своём компьютере (k3d, kind, Multipass) — бесплатно. Считать начинаем с момента создания ВМ, а заканчиваем только после уборки.', 'One VM with 2 vCPU / 4 GB for a few hours usually costs less than a cup of coffee; on your own machine (k3d, kind, Multipass) it is free. The meter starts when the VM is created and stops only after the cleanup.') },
    { id: 'cost-table', kind: 'widget', step: 'hook', widget: 'k8s.cost', props: { vms: 1, hours: 4 } },
    {
      id: 'steps',
      kind: 'text',
      step: 'practice',
      title: bi('Чеклист', 'The checklist'),
      body: bi(
        '### 1. Машина\nОдна ВМ Ubuntu 24.04, 2 vCPU и 4 ГБ, с меткой `trainer=devops` — по ней потом удаляют. На своём компьютере можно `multipass launch 24.04 --name k3s --cpus 2 --memory 4G`.\n\n### 2. Межсетевой экран\nСнаружи открыты 22 (SSH) и 80/443; порт API 6443 — только с вашего IP.\n\n### 3. Установка k3s — с чтением скрипта\nНе запускайте `curl … | sh` вслепую. Скачайте скрипт и прочитайте:\n\n```bash\ncurl -sfLo install-k3s.sh https://get.k3s.io\nless install-k3s.sh\nsudo INSTALL_K3S_VERSION=<версия> sh install-k3s.sh --write-kubeconfig-mode 600 --tls-san <публичный-IP>\nsudo k3s kubectl get nodes\n```\n\nВерсию берите со страницы выпусков k3s и не меняйте её до конца этапа. Как называется переменная, которая её закрепляет, найдите в самом скрипте.\n\n### 4. Kubeconfig на свою машину\n```bash\nsudo cat /etc/rancher/k3s/k3s.yaml     # на ВМ\n```\nСкопируйте в `~/.kube/config` на ноутбуке, замените `127.0.0.1` на публичный IP ВМ и проверьте `kubectl get nodes` уже с ноутбука. Вы видите тот же вывод, что в тренажёре, — только узел один.\n\n### 5. Gateway API у встроенного Traefik\nПо умолчанию провайдер Gateway API у Traefik в k3s выключен. Включите его файлом на ВМ:\n\n```yaml\n# /var/lib/rancher/k3s/server/manifests/traefik-config.yaml\napiVersion: helm.cattle.io/v1\nkind: HelmChartConfig\nmetadata:\n  name: traefik\n  namespace: kube-system\nspec:\n  valuesContent: |-\n    providers:\n      kubernetesGateway:\n        enabled: true\n```\n\nk3s сам переустановит чарт. Проверка: `kubectl get gatewayclass` показывает `traefik` с ACCEPTED True.\n\n### 6. Приложение через Helm\n```bash\nhelm repo add podinfo https://stefanprodan.github.io/podinfo\nhelm install web podinfo/podinfo -n shop --create-namespace --set replicaCount=2\nhelm list -n shop\n```\n\n### 7. Вход через Gateway\n```yaml\napiVersion: gateway.networking.k8s.io/v1\nkind: Gateway\nmetadata:\n  name: shop\n  namespace: shop\nspec:\n  gatewayClassName: traefik\n  listeners:\n  - name: web\n    protocol: HTTP\n    port: 8000\n---\napiVersion: gateway.networking.k8s.io/v1\nkind: HTTPRoute\nmetadata:\n  name: web\n  namespace: shop\nspec:\n  parentRefs:\n  - name: shop\n  rules:\n  - backendRefs:\n    - name: web-podinfo\n      port: 9898\n```\nПорт слушателя — порт entrypoint `web` внутри Traefik (8000); снаружи его публикует Service Traefik на 80. Проверка: `curl http://<IP>/` отвечает JSON podinfo, а `kubectl -n shop describe httproute web` показывает Accepted.\n\n### 8. Образ из вашего CI\nЗамените образ на тот, что собрал ваш пайплайн в блоке CI/CD, — по digest: `kubectl -n shop set image deploy/web-podinfo podinfo=ghcr.io/<вы>/<образ>@sha256:…`. Для приватного реестра понадобится `imagePullSecrets`.',
        '### 1. A machine\nOne Ubuntu 24.04 VM, 2 vCPU and 4 GB, labelled `trainer=devops` — that label is what you delete by later. On your own machine: `multipass launch 24.04 --name k3s --cpus 2 --memory 4G`.\n\n### 2. A firewall\nFrom outside, 22 (SSH) and 80/443 are open; the API port 6443 only from your own IP.\n\n### 3. Installing k3s — reading the script\nDo not run `curl … | sh` blindly. Download the script and read it:\n\n```bash\ncurl -sfLo install-k3s.sh https://get.k3s.io\nless install-k3s.sh\nsudo INSTALL_K3S_VERSION=<version> sh install-k3s.sh --write-kubeconfig-mode 600 --tls-san <public-IP>\nsudo k3s kubectl get nodes\n```\n\nTake the version from the k3s releases page and keep it until the end of the stage. Find the name of the variable that pins it in the script itself.\n\n### 4. The kubeconfig on your machine\n```bash\nsudo cat /etc/rancher/k3s/k3s.yaml     # on the VM\n```\nCopy it to `~/.kube/config` on your laptop, replace `127.0.0.1` with the VM’s public IP and check `kubectl get nodes` from the laptop. You see the same output as in the trainer — only with one node.\n\n### 5. The Gateway API of the built-in Traefik\nBy default the Gateway API provider of Traefik in k3s is off. Turn it on with a file on the VM:\n\n```yaml\n# /var/lib/rancher/k3s/server/manifests/traefik-config.yaml\napiVersion: helm.cattle.io/v1\nkind: HelmChartConfig\nmetadata:\n  name: traefik\n  namespace: kube-system\nspec:\n  valuesContent: |-\n    providers:\n      kubernetesGateway:\n        enabled: true\n```\n\nk3s reinstalls the chart itself. Check: `kubectl get gatewayclass` shows `traefik` with ACCEPTED True.\n\n### 6. An application with Helm\n```bash\nhelm repo add podinfo https://stefanprodan.github.io/podinfo\nhelm install web podinfo/podinfo -n shop --create-namespace --set replicaCount=2\nhelm list -n shop\n```\n\n### 7. The way in through a Gateway\n```yaml\napiVersion: gateway.networking.k8s.io/v1\nkind: Gateway\nmetadata:\n  name: shop\n  namespace: shop\nspec:\n  gatewayClassName: traefik\n  listeners:\n  - name: web\n    protocol: HTTP\n    port: 8000\n---\napiVersion: gateway.networking.k8s.io/v1\nkind: HTTPRoute\nmetadata:\n  name: web\n  namespace: shop\nspec:\n  parentRefs:\n  - name: shop\n  rules:\n  - backendRefs:\n    - name: web-podinfo\n      port: 9898\n```\nThe listener port is the port of Traefik’s `web` entrypoint inside the pod (8000); outside, the Traefik Service publishes it on 80. Check: `curl http://<IP>/` answers with podinfo JSON, and `kubectl -n shop describe httproute web` shows Accepted.\n\n### 8. The image from your CI\nReplace the image with the one your pipeline built in the CI/CD block — by digest: `kubectl -n shop set image deploy/web-podinfo podinfo=ghcr.io/<you>/<image>@sha256:…`. A private registry needs `imagePullSecrets`.',
      ),
    },
    {
      id: 'findvar',
      kind: 'callout',
      tone: 'note',
      step: 'practice',
      title: bi('Найдите в скрипте', 'Find it in the script'),
      body: bi('Скрипт установки k3s — обычный sh. Найдите в нём переменную, которая закрепляет версию, и проверьте `k3s --version` после установки: версия должна совпасть с выбранной.', 'The k3s install script is plain sh. Find in it the variable that pins the version, and check `k3s --version` after the install: it must match the one you chose.'),
    },
    { id: 'check', kind: 'widget', step: 'exit', widget: 'k8s.real-check', props: { track: 'r1', checks: r1Checks } },
    {
      id: 'cleanup',
      kind: 'callout',
      tone: 'cleanup',
      step: 'review',
      title: bi('Уборка — обязательна', 'Cleanup — mandatory'),
      body: bi(
        'Этап не закончен, пока ВМ не удалена. Удаляйте по метке, а не по памяти, и проверьте, что список пуст:\n\n```bash\nhcloud server list -l trainer=devops -o json      # Hetzner: должно быть []\nhcloud server delete <имя>\nyc compute instance list --format json             # Yandex Cloud: проверьте, что ВМ с меткой trainer=devops нет\n```\n\nНа своём компьютере: `/usr/local/bin/k3s-uninstall.sh` (k3s) или `multipass delete --purge k3s`.',
        'The stage is not over until the VM is deleted. Delete by the label, not from memory, and check that the list is empty:\n\n```bash\nhcloud server list -l trainer=devops -o json      # Hetzner: must be []\nhcloud server delete <name>\nyc compute instance list --format json             # Yandex Cloud: check there is no VM labelled trainer=devops\n```\n\nOn your own machine: `/usr/local/bin/k3s-uninstall.sh` (k3s) or `multipass delete --purge k3s`.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'review', title: bi('Проверьте себя', 'Check yourself'), items: ['k8s.q.real.cleanup'] },
  ],
};

export const kubeadmLesson: Lesson = {
  id: 'k8s-2.kubeadm',
  block: 'k8s-2',
  title: bi('Полный кластер: kubeadm на трёх ВМ', 'A full cluster: kubeadm on three VMs'),
  summary: bi('Этап 3: подготовка узлов, kubeadm init и join, Cilium, хранилище, сертификаты, снимок и восстановление etcd, обновление, поломка и починка, уборка.', 'Stage 3: preparing the nodes, kubeadm init and join, Cilium, storage, certificates, an etcd snapshot and restore, an upgrade, a break and a fix, the cleanup.'),
  introduces: ['k8s.kubeadm', 'k8s.static-pod'],
  uses: ['k8s.control-plane', 'k8s.etcd', 'k8s.kubelet', 'k8s.cni', 'k8s.k3s', 'k8s.kubeconfig'],
  tier: 'core',
  minutes: 240,
  sources: src([S.kubeadm, S.installKubeadm, S.upgrade, S.etcdRecovery, S.cilium], [R.installKubeadm, R.components]),
  sections: [
    {
      id: 'why',
      kind: 'text',
      step: 'hook',
      body: bi(
        'k3s собрал кластер за вас. Теперь вы соберёте его сами из тех же блоков, что в конструкторе, — на трёх ВМ: `cp-1` (control plane), `worker-1`, `worker-2`. Установщик — [[k8s.kubeadm|kubeadm]]: он поднимает control plane, но всё вокруг — сеть, хранилище, обновления — остаётся на вас. Тот же кластер вы позже закажете Terraform и подготовите Ansible в блоке IaC — когда боль ручного заказа трёх ВМ станет знакомой.',
        'k3s assembled the cluster for you. Now you assemble one yourself from the same blocks as in the constructor — on three VMs: `cp-1` (control plane), `worker-1`, `worker-2`. The installer is [[k8s.kubeadm|kubeadm]]: it brings up the control plane, but everything around it — the network, storage, upgrades — stays with you. You will order the same cluster with Terraform and prepare it with Ansible later, in the IaC block — once the pain of ordering three VMs by hand is familiar.',
      ),
    },
    { id: 'cost', kind: 'callout', tone: 'cost', step: 'hook', title: bi('Сколько это стоит', 'What it costs'), body: bi('Три ВМ по 2 vCPU / 4 ГБ на рабочий день. Впишите сегодняшнюю цену ВМ-часа своего провайдера: таблица посчитает этап и — крупно — месяц забытого стенда.', 'Three VMs with 2 vCPU / 4 GB for a working day. Type today’s price of a VM-hour of your provider: the table counts the stage and — in large type — a month of a forgotten lab.') },
    { id: 'cost-table', kind: 'widget', step: 'hook', widget: 'k8s.cost', props: { vms: 3, hours: 8 } },
    {
      id: 'prepare',
      kind: 'text',
      step: 'practice',
      title: bi('1–3. ВМ, сеть и подготовка узлов', '1–3. VMs, the network and node preparation'),
      body: bi(
        'Три ВМ Ubuntu 24.04 в одной частной сети (например, `10.10.1.0/24`), все с меткой `trainer=devops`. Снаружи открыты только 22 и 6443 (с вашего IP); 10250, 2379–2380 и порты Cilium (8472/udp, 4240/tcp) — только внутри частной сети.\n\nНа каждом узле — подготовка по странице *Installing kubeadm*. Прочитайте каждую строку, прежде чем запускать:\n\n```bash\nsudo swapoff -a                                    # kubelet не работает со swap по умолчанию\nsudo modprobe overlay && sudo modprobe br_netfilter\nsudo sysctl -w net.ipv4.ip_forward=1\nsudo apt-get update && sudo apt-get install -y containerd apt-transport-https ca-certificates curl gpg\ncontainerd config default | sudo tee /etc/containerd/config.toml\nsudo sed -i \'s/SystemdCgroup = false/SystemdCgroup = true/\' /etc/containerd/config.toml\nsudo systemctl restart containerd\ncurl -fsSL https://pkgs.k8s.io/core:/stable:/v1.36/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg\necho \'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.36/deb/ /\' | sudo tee /etc/apt/sources.list.d/kubernetes.list\nsudo apt-get update && sudo apt-get install -y kubelet kubeadm kubectl\nsudo apt-mark hold kubelet kubeadm kubectl\n```\n\nВерсия 1.36 выбрана нарочно: в шаге 9 вы обновите кластер до 1.37.',
        'Three Ubuntu 24.04 VMs on one private network (for example `10.10.1.0/24`), all labelled `trainer=devops`. From outside only 22 and 6443 (from your IP) are open; 10250, 2379–2380 and the Cilium ports (8472/udp, 4240/tcp) only inside the private network.\n\nOn every node, prepare it following the *Installing kubeadm* page. Read every line before running it:\n\n```bash\nsudo swapoff -a                                    # the kubelet does not work with swap by default\nsudo modprobe overlay && sudo modprobe br_netfilter\nsudo sysctl -w net.ipv4.ip_forward=1\nsudo apt-get update && sudo apt-get install -y containerd apt-transport-https ca-certificates curl gpg\ncontainerd config default | sudo tee /etc/containerd/config.toml\nsudo sed -i \'s/SystemdCgroup = false/SystemdCgroup = true/\' /etc/containerd/config.toml\nsudo systemctl restart containerd\ncurl -fsSL https://pkgs.k8s.io/core:/stable:/v1.36/deb/Release.key | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg\necho \'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.36/deb/ /\' | sudo tee /etc/apt/sources.list.d/kubernetes.list\nsudo apt-get update && sudo apt-get install -y kubelet kubeadm kubectl\nsudo apt-mark hold kubelet kubeadm kubectl\n```\n\nVersion 1.36 is chosen on purpose: in step 9 you upgrade the cluster to 1.37.',
      ),
    },
    {
      id: 'init',
      kind: 'text',
      step: 'practice',
      title: bi('4–6. Control plane, сеть, узлы', '4–6. The control plane, the network, the nodes'),
      body: bi(
        'На `cp-1`:\n\n```bash\nsudo kubeadm init --apiserver-advertise-address=10.10.1.11 --pod-network-cidr=10.244.0.0/16\nmkdir -p $HOME/.kube && sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config && sudo chown $(id -u):$(id -g) $HOME/.kube/config\nkubectl get pods -n kube-system -o wide\nls /etc/kubernetes/manifests\n```\n\nВ `/etc/kubernetes/manifests` лежат etcd, kube-apiserver, kube-controller-manager и kube-scheduler. Это [[k8s.static-pod|статические поды]]: kubelet запускает их сам, прямо из файлов, без API-сервера — так kubeadm поднимает API-сервер, которого ещё нет. Поправьте файл — kubelet перезапустит под; уберите файл из каталога — под остановится.\n\nCoreDNS пока в Pending: сети подов нет. Поставьте Cilium (CLI `cilium` — со страницы установки Cilium, версию закрепите):\n\n```bash\ncilium install --version <закреплённая> --set ipam.mode=kubernetes\ncilium status --wait\n```\n\nУзлы присоединяются командой, которую напечатал `kubeadm init`:\n\n```bash\nsudo kubeadm join 10.10.1.11:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>   # на worker-1 и worker-2\nkubectl get nodes -o wide                                                                         # на cp-1\n```\n\nТокен живёт 24 часа. Если он истёк, новый `join` найдётся в справке `kubeadm token`. Для хранилища поставьте local-path-provisioner и сделайте его StorageClass классом по умолчанию.',
        'On `cp-1`:\n\n```bash\nsudo kubeadm init --apiserver-advertise-address=10.10.1.11 --pod-network-cidr=10.244.0.0/16\nmkdir -p $HOME/.kube && sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config && sudo chown $(id -u):$(id -g) $HOME/.kube/config\nkubectl get pods -n kube-system -o wide\nls /etc/kubernetes/manifests\n```\n\n`/etc/kubernetes/manifests` holds etcd, kube-apiserver, kube-controller-manager and kube-scheduler. These are [[k8s.static-pod|static pods]]: the kubelet runs them by itself, straight from the files, without the API server — that is how kubeadm brings up an API server that does not exist yet. Edit a file and the kubelet restarts the pod; move the file out of the directory and the pod stops.\n\nCoreDNS is Pending for now: there is no pod network. Install Cilium (the `cilium` CLI comes from the Cilium install page; pin the version):\n\n```bash\ncilium install --version <pinned> --set ipam.mode=kubernetes\ncilium status --wait\n```\n\nNodes join with the command `kubeadm init` printed:\n\n```bash\nsudo kubeadm join 10.10.1.11:6443 --token <token> --discovery-token-ca-cert-hash sha256:<hash>   # on worker-1 and worker-2\nkubectl get nodes -o wide                                                                         # on cp-1\n```\n\nA token lives 24 hours. If it has expired, a new `join` is in the `kubeadm token` help. For storage install local-path-provisioner and make its StorageClass the default one.',
      ),
    },
    {
      id: 'ops',
      kind: 'text',
      step: 'practice',
      title: bi('7–10. Сертификаты, etcd, обновление, поломка', '7–10. Certificates, etcd, the upgrade, a break'),
      body: bi(
        '**Сертификаты.** `sudo kubeadm certs check-expiration` покажет сроки всех сертификатов control plane (обычно год). `sudo kubeadm certs renew apiserver` продлит один; статический под подхватит его после перезапуска (уберите манифест из каталога и верните через полминуты).\n\n**Снимок etcd.** etcd хранит весь кластер; его копия — главная страховка.\n\n```bash\nsudo mkdir -p /opt/backup\nsudo etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key snapshot save /opt/backup/etcd-$(date +%F).db\nsudo etcdutl snapshot status /opt/backup/etcd-$(date +%F).db -w table\n```\n\nВосстановление в etcd 3.6 делает `etcdutl`, а не `etcdctl`: `sudo etcdutl snapshot restore <файл> --data-dir /var/lib/etcd-restore`, затем в `/etc/kubernetes/manifests/etcd.yaml` замените `hostPath` тома данных на `/var/lib/etcd-restore`. Многие инструкции в интернете написаны для старых версий — сверяйтесь с документацией своей.\n\n**Обновление 1.36 → 1.37.** Сначала control plane, потом узлы по одному: репозиторий `v1.37`, `kubeadm` новой версии, `sudo kubeadm upgrade plan`, `sudo kubeadm upgrade apply v1.37.<x>`; затем для каждого worker: `kubectl drain worker-1 --ignore-daemonsets`, на узле `sudo kubeadm upgrade node`, новые kubelet и kubectl, `sudo systemctl restart kubelet`, `kubectl uncordon worker-1`.\n\n**Поломка и починка.** На `worker-2` выполните `sudo systemctl stop kubelet` и пронаблюдайте то, что видели в объяснении «узел упал»: через 50 секунд NotReady, через 300 — выселение. Затем почините узел и убедитесь, что поды на месте.',
        '**Certificates.** `sudo kubeadm certs check-expiration` shows the expiry of every control-plane certificate (usually a year). `sudo kubeadm certs renew apiserver` renews one; the static pod picks it up after a restart (move its manifest out of the directory and back half a minute later).\n\n**An etcd snapshot.** etcd holds the whole cluster; a copy of it is the main insurance.\n\n```bash\nsudo mkdir -p /opt/backup\nsudo etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key snapshot save /opt/backup/etcd-$(date +%F).db\nsudo etcdutl snapshot status /opt/backup/etcd-$(date +%F).db -w table\n```\n\nIn etcd 3.6 restoring is done by `etcdutl`, not `etcdctl`: `sudo etcdutl snapshot restore <file> --data-dir /var/lib/etcd-restore`, then in `/etc/kubernetes/manifests/etcd.yaml` change the `hostPath` of the data volume to `/var/lib/etcd-restore`. Many instructions on the internet are written for older versions — check against the documentation of yours.\n\n**The upgrade 1.36 → 1.37.** The control plane first, then the nodes one by one: the `v1.37` repository, `kubeadm` of the new version, `sudo kubeadm upgrade plan`, `sudo kubeadm upgrade apply v1.37.<x>`; then for every worker: `kubectl drain worker-1 --ignore-daemonsets`, on the node `sudo kubeadm upgrade node`, the new kubelet and kubectl, `sudo systemctl restart kubelet`, `kubectl uncordon worker-1`.\n\n**A break and a fix.** On `worker-2` run `sudo systemctl stop kubelet` and watch what you saw in the "a node went down" explainer: NotReady after 50 seconds, eviction after 300. Then fix the node and make sure the pods are in place.',
      ),
    },
    { id: 'web', kind: 'callout', tone: 'note', step: 'practice', body: bi('Для проверки создайте Deployment на три пода: `kubectl create deployment web --image=nginx:1.29 --replicas=3` — и посмотрите `kubectl get pods -o wide`: поды должны разойтись по узлам.', 'For the check create a Deployment of three pods: `kubectl create deployment web --image=nginx:1.29 --replicas=3` — and look at `kubectl get pods -o wide`: the pods should spread over the nodes.') },
    { id: 'check', kind: 'widget', step: 'exit', widget: 'k8s.real-check', props: { track: 'r3', checks: r3Checks } },
    {
      id: 'cleanup',
      kind: 'callout',
      tone: 'cleanup',
      step: 'review',
      title: bi('Уборка — обязательна', 'Cleanup — mandatory'),
      body: bi(
        'Три ВМ, диски и адреса тарифицируются каждый час. Удаляйте по метке и убедитесь, что список пуст:\n\n```bash\nhcloud server list -l trainer=devops -o json     # должно стать []\nhcloud server delete cp-1 worker-1 worker-2\nhcloud network delete trainer\n```\n\nВ другом облаке — то же: список по метке `trainer=devops`, удаление, повторный список.',
        'Three VMs, their disks and addresses are billed every hour. Delete by the label and make sure the list is empty:\n\n```bash\nhcloud server list -l trainer=devops -o json     # must become []\nhcloud server delete cp-1 worker-1 worker-2\nhcloud network delete trainer\n```\n\nIn another cloud the same: a list by the `trainer=devops` label, the deletion, the list again.',
      ),
    },
    { id: 'quiz', kind: 'quiz', step: 'review', title: bi('Проверьте себя', 'Check yourself'), items: ['k8s.q.real.etcdutl', 'k8s.q.real.static'] },
  ],
};
