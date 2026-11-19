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
