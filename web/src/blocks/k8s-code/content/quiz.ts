// The quiz bank of block 9. Every wrong option is a recorded misconception
// with its explanation; `explain` gives the model after any answer.

import { bi } from '../../../core/i18n';
import type { QuizItem } from '../../../core/types';

export const QUIZ: QuizItem[] = [
  // ── plan ──
  {
    id: 'k8s-3.q.why-code',
    kind: 'mcq',
    concepts: ['k8s.rebuildable'],
    prompt: bi('Кластер из трёх узлов собран руками по инструкции и работает. Чем он хуже такого же кластера, поднятого кодом?', 'A three-node cluster was put together by hand from a guide and works. What makes it worse than the same cluster brought up by code?'),
    options: [
      { id: 'rebuild', text: bi('Его нельзя быстро и точно повторить: после потери машины или для второго окружения всё делается заново и чуть иначе', 'It cannot be repeated quickly and exactly: after losing a machine or for a second environment everything is done again and a little differently'), correct: true },
      { id: 'slow', text: bi('Он медленнее работает', 'It runs slower'), why: bi('Скорость работы кластера от способа установки не зависит: компоненты те же.', 'The speed of a cluster does not depend on how it was installed: the components are the same.') },
      { id: 'unsafe', text: bi('Ручная установка всегда небезопасна', 'A manual installation is always insecure'), why: bi('Ручной кластер может быть настроен так же безопасно. Беда в другом: никто не знает точно, как он настроен, и не может это повторить.', 'A manual cluster can be configured just as securely. The trouble is different: nobody knows exactly how it is configured and nobody can repeat it.') },
    ],
    explain: bi('Кластер из кода — это не быстрее с первого раза, а дешевле каждый следующий раз: пересоздание, второе окружение, восстановление после аварии.', 'A cluster from code is not faster the first time but cheaper every next time: a rebuild, a second environment, recovery after a disaster.'),
  },
  {
    id: 'k8s-3.q.chain',
    kind: 'order',
    concepts: ['k8s.rebuildable'],
    prompt: bi('Расставьте звенья подъёма кластера из кода по порядку.', 'Put the links of bringing a cluster up from code in order.'),
    steps: [
      { id: 'tf', text: bi('Terraform создаёт сеть и ВМ с метками', 'Terraform creates the network and the VMs with labels') },
      { id: 'out', text: bi('terraform output отдаёт инвентарь для Ansible', 'terraform output hands the inventory to Ansible') },
      { id: 'prep', text: bi('Ansible готовит узлы: swap, ядро, containerd, пакеты', 'Ansible prepares the nodes: swap, kernel, containerd, packages') },
      { id: 'init', text: bi('kubeadm init на control plane', 'kubeadm init on the control plane') },
      { id: 'cni', text: bi('Cilium — сеть подов', 'Cilium — the pod network') },
      { id: 'join', text: bi('kubeadm join на рабочих узлах', 'kubeadm join on the workers'), why: bi('Рабочие узлы можно присоединить и до сети подов, но Ready они станут только после неё.', 'Workers may join before the pod network too, but they become Ready only after it.') },
    ],
  },
  {
    id: 'k8s-3.q.label',
    kind: 'mcq',
    concepts: ['iac.resource-label'],
    prompt: bi('Зачем каждой ВМ курса метка `trainer=devops`?', 'Why does every VM of the course carry the `trainer=devops` label?'),
    options: [
      { id: 'find', text: bi('По ней находят, считают и удаляют всё, что создал курс, — и проверяют, что после уборки не осталось ничего', 'It is how everything the course created is found, counted and deleted — and how you check nothing is left after the cleanup'), correct: true },
      { id: 'k8s', text: bi('Kubernetes по ней понимает, что ВМ — узел кластера', 'Kubernetes uses it to know a VM is a cluster node'), why: bi('Kubernetes о метках облака не знает: узлом машину делает kubeadm join.', 'Kubernetes knows nothing about cloud labels: kubeadm join is what makes a machine a node.') },
      { id: 'price', text: bi('Облако со скидкой тарифицирует учебные ВМ', 'The cloud bills training VMs at a discount'), why: bi('Метка ничего не меняет в цене. Она нужна, чтобы забытая машина не продолжала стоить денег.', 'A label changes nothing in the price. It is there so that a forgotten machine does not keep costing money.') },
    ],
  },
  // ── nodes ──
  {
    id: 'k8s-3.q.count-addr',
    kind: 'mcq',
    concepts: ['iac.count'],
    prompt: bi('Ресурс `edu_vm "worker"` с `count = 3` и `name = "worker-${count.index + 1}"`. Какой адрес в state у машины `worker-2`?', 'The resource `edu_vm "worker"` with `count = 3` and `name = "worker-${count.index + 1}"`. What is the state address of the machine `worker-2`?'),
    options: [
      { id: 'i1', text: 'edu_vm.worker[1]', correct: true },
      { id: 'i2', text: 'edu_vm.worker[2]', why: bi('count.index начинается с нуля: worker-1 — это [0], worker-2 — [1].', 'count.index starts at zero: worker-1 is [0], worker-2 is [1].') },
      { id: 'name', text: 'edu_vm.worker-2', why: bi('Адрес строится из типа, имени в коде и номера экземпляра, а не из атрибута name.', 'The address is built from the type, the name in the code and the instance number, not from the name attribute.') },
    ],
    explain: bi('Уменьшите count до 2 — и Terraform удалит именно worker[2], последний. Поэтому для узлов с разной ролью удобнее for_each по карте: адрес тогда — ключ, а не номер.', 'Lower count to 2 and Terraform deletes exactly worker[2], the last one. That is why for nodes with different roles for_each over a map is handier: the address is then a key, not a number.'),
  },
  {
    id: 'k8s-3.q.output',
    kind: 'mcq',
    concepts: ['iac.output'],
    prompt: bi('Почему инвентарь для Ansible берут из `terraform output`, а не переписывают адреса руками?', 'Why is the Ansible inventory taken from `terraform output` instead of copying the addresses by hand?'),
    options: [
      { id: 'rebuild', text: bi('Адреса выдаёт облако, и после пересоздания они другие; output всегда отдаёт текущие', 'The cloud hands out the addresses, and after a rebuild they are different; the output always gives the current ones'), correct: true },
      { id: 'secret', text: bi('Адреса — секрет, их нельзя показывать', 'The addresses are a secret and must not be shown'), why: bi('Адреса не секрет. Дело в том, что они меняются, а рука копирует вчерашние.', 'The addresses are no secret. The point is that they change, and a hand copies yesterday’s.') },
      { id: 'fast', text: bi('Ansible быстрее читает файлы, созданные Terraform', 'Ansible reads files created by Terraform faster'), why: bi('Ansible всё равно, кто написал файл. Важно, чтобы в нём были верные адреса.', 'Ansible does not care who wrote the file. What matters is that it has the right addresses.') },
    ],
  },
  {
    id: 'k8s-3.q.no-changes',
    kind: 'mcq',
    concepts: ['iac.plan', 'k8s.rebuildable'],
    prompt: bi('Кластер поднят, вы ничего не меняли в коде. Что должен показать `terraform plan`?', 'The cluster is up and you changed nothing in the code. What should `terraform plan` show?'),
    options: [
      { id: 'none', text: 'No changes. Your infrastructure matches the configuration.', correct: true },
      { id: 'add', text: 'Plan: 3 to add, 0 to change, 0 to destroy.', why: bi('Так бывает, если потерян state: Terraform не видит своих машин и хочет создать новые.', 'This happens when the state is lost: Terraform does not see its machines and wants to create new ones.') },
      { id: 'change', text: 'Plan: 0 to add, 3 to change, 0 to destroy.', why: bi('Изменения без правки кода — признак дрейфа: кто-то менял машины в консоли облака.', 'Changes without a code edit are a sign of drift: someone changed the machines in the cloud console.') },
    ],
  },
  // ── prepare ──
  {
    id: 'k8s-3.q.prereq-why',
    kind: 'match',
    concepts: ['k8s.cgroup-driver'],
    prompt: bi('Что из подготовки узла зачем нужно?', 'What is each part of node preparation for?'),
    pairs: [
      { id: 'swap', left: bi('swap выключен и убран из fstab', 'swap is off and removed from fstab'), right: bi('kubelet по умолчанию не стартует со swap; без fstab он вернётся после перезагрузки', 'by default the kubelet does not start with swap; without the fstab edit it comes back after a reboot') },
      { id: 'fwd', left: 'net.ipv4.ip_forward = 1', right: bi('узел пересылает пакеты подов между интерфейсами', 'the node forwards pod packets between interfaces') },
      { id: 'cg', left: 'SystemdCgroup = true', right: bi('containerd и kubelet управляют cgroup одним способом — через systemd', 'containerd and the kubelet manage cgroups the same way — through systemd') },
      { id: 'pin', left: bi('репозиторий v1.36 и версия пакета в коде', 'the v1.36 repository and the package version in the code'), right: bi('обновление Kubernetes происходит по решению, а не по apt upgrade', 'a Kubernetes upgrade happens by decision, not by apt upgrade') },
    ],
  },
  {
    id: 'k8s-3.q.cgroup',
    kind: 'mcq',
    concepts: ['k8s.cgroup-driver'],
    prompt: bi('Почему на узле с systemd и kubelet, и containerd должны работать с драйвером cgroup systemd?', 'Why must both the kubelet and containerd use the systemd cgroup driver on a node with systemd?'),
    options: [
      { id: 'one', text: bi('Дерево cgroup должно иметь одного хозяина; два менеджера, которые не знают друг о друге, разойдутся во взглядах на ресурсы под нагрузкой', 'The cgroup tree must have one owner; two managers unaware of each other disagree about resources under pressure'), correct: true },
      { id: 'speed', text: bi('Драйвер systemd быстрее', 'The systemd driver is faster'), why: bi('Дело не в скорости, а в том, что systemd уже управляет cgroup всей машины.', 'It is not about speed but about systemd already managing the cgroups of the whole machine.') },
      { id: 'kubeadm', text: bi('kubeadm без этого не запустится', 'kubeadm will not run without it'), why: bi('kubeadm init может пройти и с другим драйвером: несогласованность проявится позже, под нагрузкой и при перезапусках.', 'kubeadm init may pass with another driver: the mismatch shows later, under load and on restarts.') },
    ],
  },
  {
    id: 'k8s-3.q.pin',
    kind: 'mcq',
    concepts: ['k8s.version-pin'],
    prompt: bi('Роль ставит `kubelet` без версии из репозитория `pkgs.k8s.io/core:/stable:/v1.36`. Что случится через полгода при пересоздании узла?', 'A role installs `kubelet` without a version from the `pkgs.k8s.io/core:/stable:/v1.36` repository. What happens half a year later when a node is rebuilt?'),
    options: [
      { id: 'patch', text: bi('Новый узел получит более позднюю патч-версию 1.36, чем старые: узлы кластера перестанут быть одинаковыми', 'The new node gets a later 1.36 patch version than the old ones: the cluster nodes stop being identical'), correct: true },
      { id: 'minor', text: bi('Узел получит 1.37', 'The node gets 1.37'), why: bi('Репозиторий pkgs.k8s.io разделён по минорным версиям: из ветки v1.36 1.37 не придёт.', 'The pkgs.k8s.io repository is split by minor version: 1.37 does not come from the v1.36 branch.') },
      { id: 'same', text: bi('Ничего: версия всегда та же', 'Nothing: the version is always the same'), why: bi('В ветке выходят патч-версии; без версии в коде apt поставит самую новую.', 'Patch versions keep coming out in the branch; without a version in the code apt installs the newest.') },
    ],
    explain: bi('Поэтому версия записана в коде (`kubeadm=1.36.4-1.1`), а пакет удерживается от apt upgrade: на настоящих машинах это `ansible.builtin.dpkg_selections` с `selection: hold`.', 'That is why the version is in the code (`kubeadm=1.36.4-1.1`) and the package is held against apt upgrade: on real machines it is `ansible.builtin.dpkg_selections` with `selection: hold`.'),
  },
  // ── kubeadm ──
  {
    id: 'k8s-3.q.token',
    kind: 'mcq',
    concepts: ['k8s.bootstrap-token'],
    prompt: bi('Токен присоединения `stand1.cl0ckw0rk0range0`. Какая часть — секрет?', 'The bootstrap token `stand1.cl0ckw0rk0range0`. Which part is the secret?'),
    options: [
      { id: 'secret', text: bi('Вторая, после точки: первая — открытый идентификатор токена', 'The second, after the dot: the first is the public token ID'), correct: true },
      { id: 'first', text: bi('Первая, до точки', 'The first, before the dot'), why: bi('Первая часть — ID: по ней ищут Secret bootstrap-token-<id>, её видно в kubeadm token list.', 'The first part is the ID: the Secret bootstrap-token-<id> is found by it, and kubeadm token list shows it.') },
      { id: 'none', text: bi('Никакая: токен живёт 24 часа и не секретен', 'Neither: the token lives 24 hours and is not secret'), why: bi('За 24 часа с ним можно присоединить к кластеру чужую машину. Срок жизни ограничивает ущерб, но не делает токен открытым.', 'Within 24 hours anyone with it can join a foreign machine to the cluster. The lifetime limits the damage but does not make the token public.') },
    ],
  },
  {
    id: 'k8s-3.q.init-files',
    kind: 'multi',
    concepts: ['k8s.kubeadm-config'],
    prompt: bi('Что появляется на control plane после успешного `kubeadm init`? Отметьте всё.', 'What appears on the control plane after a successful `kubeadm init`? Mark everything.'),
    options: [
      { id: 'admin', text: '/etc/kubernetes/admin.conf', correct: true },
      { id: 'pki', text: '/etc/kubernetes/pki/ca.crt', correct: true },
      { id: 'mf', text: '/etc/kubernetes/manifests/kube-apiserver.yaml', correct: true },
      { id: 'cni', text: '/etc/cni/net.d/05-cilium.conflist', why: bi('Этот файл пишет агент Cilium после установки сети подов — kubeadm сеть не ставит.', 'This file is written by the Cilium agent after the pod network is installed — kubeadm installs no network.') },
      { id: 'kubelet', text: bi('/etc/kubernetes/kubelet.conf только на рабочих узлах', '/etc/kubernetes/kubelet.conf on the workers only'), why: bi('kubelet.conf есть и на control plane: kubelet работает на каждом узле, включая управляющий.', 'kubelet.conf exists on the control plane too: the kubelet runs on every node, the control-plane one included.') },
    ],
  },
  {
    id: 'k8s-3.q.ca-hash',
    kind: 'mcq',
    concepts: ['k8s.bootstrap-token'],
    prompt: bi('Зачем `kubeadm join` передают `--discovery-token-ca-cert-hash`?', 'Why is `--discovery-token-ca-cert-hash` passed to `kubeadm join`?'),
    options: [
      { id: 'pin', text: bi('Узел проверяет, что control plane — тот самый: сверяет хэш открытого ключа его CA', 'The node checks the control plane is the right one: it compares the hash of its CA public key'), correct: true },
      { id: 'auth', text: bi('Control plane по нему проверяет узел', 'The control plane uses it to check the node'), why: bi('Узел control plane проверяет по токену. Хэш — обратное направление доверия: узел проверяет control plane.', 'The control plane checks the node by the token. The hash is trust in the other direction: the node checks the control plane.') },
      { id: 'tls', text: bi('Это ключ шифрования трафика подов', 'It is the key that encrypts pod traffic'), why: bi('Трафик подов шифрует (если вообще шифрует) сетевой плагин; к join это отношения не имеет.', 'Pod traffic is encrypted, if at all, by the network plugin; it has nothing to do with join.') },
    ],
    explain: bi('Без хэша узел доверится первому, кто ответит на этом адресе. Флаг `--discovery-token-unsafe-skip-ca-verification` и поле `unsafeSkipCAVerification` разрешают это явно — и называются unsafe не случайно.', 'Without the hash the node trusts whoever answers at that address first. The `--discovery-token-unsafe-skip-ca-verification` flag and the `unsafeSkipCAVerification` field allow this explicitly — and are not called unsafe by accident.'),
  },
  // ── as code ──
  {
    id: 'k8s-3.q.creates',
    kind: 'mcq',
    concepts: ['iac.creates'],
    prompt: bi('Задача `ansible.builtin.command: kubeadm init --config /etc/kubeadm/init.yaml` без `creates`. Что будет на втором прогоне плейбука?', 'The task `ansible.builtin.command: kubeadm init --config /etc/kubeadm/init.yaml` without `creates`. What happens on the second playbook run?'),
    options: [
      { id: 'fail', text: bi('kubeadm init запустится снова и упадёт на preflight: порты заняты, манифесты уже есть', 'kubeadm init runs again and fails at preflight: the ports are busy, the manifests exist'), correct: true },
      { id: 'ok', text: bi('Ansible поймёт, что кластер уже есть, и ответит ok', 'Ansible understands the cluster exists and answers ok'), why: bi('Модуль command не знает, что делает команда: он запускает её всегда и всегда отвечает changed — или failed.', 'The command module does not know what the command does: it always runs it and always answers changed — or failed.') },
      { id: 'reinit', text: bi('kubeadm пересоздаст кластер с нуля', 'kubeadm recreates the cluster from scratch'), why: bi('kubeadm init не затирает существующий control plane: его preflight как раз для этого.', 'kubeadm init does not overwrite an existing control plane: that is exactly what its preflight is for.') },
    ],
  },
  {
    id: 'k8s-3.q.join-bug',
    kind: 'bugfind',
    concepts: ['iac.creates'],
    prompt: bi('Роль kubeadm_join. На втором прогоне рабочие узлы падают с `[ERROR FileAvailable--etc-kubernetes-kubelet.conf]`. Найдите строку, из-за которой.', 'The kubeadm_join role. On the second run the workers fail with `[ERROR FileAvailable--etc-kubernetes-kubelet.conf]`. Find the line responsible.'),
    code: '- name: The join configuration\n  ansible.builtin.template:\n    src: join.yaml.j2\n    dest: /etc/kubeadm/join.yaml\n\n- name: kubeadm join, once\n  ansible.builtin.command:\n    cmd: kubeadm join --config /etc/kubeadm/join.yaml\n    creates: /etc/kubernetes/admin.conf',
    lang: 'yaml',
    bug: [9],
    why: {
      9: bi('На рабочем узле admin.conf не появляется никогда — его пишет только kubeadm init. Условием должен быть файл, который создаёт join: /etc/kubernetes/kubelet.conf.', 'admin.conf never appears on a worker — only kubeadm init writes it. The condition must be the file join creates: /etc/kubernetes/kubelet.conf.'),
      4: bi('Шаблон в /etc/kubeadm — нормальное место: preflight проверяет /etc/kubernetes, а не этот каталог.', 'A template in /etc/kubeadm is a fine place: preflight checks /etc/kubernetes, not this directory.'),
      8: bi('Команда верна: join по конфигурационному файлу.', 'The command is right: join from a configuration file.'),
    },
  },
  {
    id: 'k8s-3.q.rebuild',
    kind: 'order',
    concepts: ['k8s.rebuildable', 'iac.output'],
    prompt: bi('Пересоздание кластера с нуля. Расставьте команды по порядку.', 'Rebuilding the cluster from scratch. Put the commands in order.'),
    steps: [
      { id: 'destroy', text: 'terraform destroy -auto-approve' },
      { id: 'apply', text: 'terraform apply -auto-approve' },
      { id: 'out', text: 'terraform output -raw inventory > ../ops/inventory.ini', why: bi('У новых машин новые адреса: старый инвентарь отправит join к control plane, которого уже нет.', 'The new machines have new addresses: the old inventory sends join to a control plane that no longer exists.') },
      { id: 'play', text: 'ansible-playbook site.yml' },
    ],
  },
  // ── gitops ──
  {
    id: 'k8s-3.q.pull',
    kind: 'mcq',
    concepts: ['cicd.gitops-pull'],
    prompt: bi('Чем выкладка через GitOps отличается от шага `kubectl apply` в конвейере CI?', 'How does a GitOps release differ from a `kubectl apply` step in a CI pipeline?'),
    options: [
      { id: 'pull', text: bi('Агент внутри кластера сам забирает состояние из Git и постоянно поддерживает его; конвейеру не нужен доступ к кластеру', 'An agent inside the cluster pulls the state from Git itself and keeps it up all the time; the pipeline needs no cluster access'), correct: true },
      { id: 'faster', text: bi('GitOps выкатывает быстрее', 'GitOps releases faster'), why: bi('Скорость примерно та же, а с опросом раз в три минуты бывает и медленнее. Выигрыш в другом.', 'The speed is about the same, and with a three-minute poll it can be slower. The gain is elsewhere.') },
      { id: 'once', text: bi('Ничем: в обоих случаях манифесты применяются один раз', 'Nothing: in both cases the manifests are applied once'), why: bi('Конвейер применяет один раз и забывает. Контроллер GitOps сверяет снова и снова — ручную правку он заметит.', 'A pipeline applies once and forgets. A GitOps controller compares again and again — it notices a manual edit.') },
    ],
  },
  {
    id: 'k8s-3.q.selfheal',
    kind: 'mcq',
    concepts: ['k8s.sync-policy'],
    prompt: bi('У Application `automated: {}` без `selfHeal`. Коллега выполнил `kubectl scale deploy shop --replicas=5`, в Git — 2. Что будет?', 'An Application has `automated: {}` without `selfHeal`. A colleague ran `kubectl scale deploy shop --replicas=5`, Git says 2. What happens?'),
    options: [
      { id: 'stays', text: bi('Останется 5, Application OutOfSync — до следующего коммита или ручной синхронизации', 'It stays at 5 and the Application is OutOfSync — until the next commit or a manual sync'), correct: true },
      { id: 'two', text: bi('Через три минуты станет 2', 'In three minutes it becomes 2'), why: bi('Автоматическая синхронизация срабатывает на новую ревизию Git. Вернуть ручную правку без нового коммита — это работа selfHeal.', 'Automated sync fires on a new Git revision. Undoing a manual edit without a new commit is the job of selfHeal.') },
      { id: 'error', text: bi('kubectl scale будет запрещён', 'kubectl scale is forbidden'), why: bi('Argo CD не запрещает правки — он их видит и, если велено, отменяет. Запрещать — дело RBAC.', 'Argo CD does not forbid edits — it sees them and, if told to, undoes them. Forbidding is RBAC’s job.') },
    ],
  },
  {
    id: 'k8s-3.q.prune',
    kind: 'mcq',
    concepts: ['k8s.sync-policy'],
    prompt: bi('Из Git удалили `k8s/banner.yaml` (ConfigMap). У Application `automated: { prune: false }`. Что станет с ConfigMap в кластере?', '`k8s/banner.yaml` (a ConfigMap) was deleted from Git. The Application has `automated: { prune: false }`. What happens to the ConfigMap in the cluster?'),
    options: [
      { id: 'stays', text: bi('Останется; Application покажет его как требующий удаления (OutOfSync)', 'It stays; the Application shows it as requiring pruning (OutOfSync)'), correct: true },
      { id: 'gone', text: bi('Удалится при следующей синхронизации', 'It is deleted on the next sync'), why: bi('Без prune Argo CD ничего не удаляет сам: это защита от случайно удалённого файла.', 'Without prune Argo CD deletes nothing by itself: it is a safeguard against a file deleted by mistake.') },
      { id: 'error', text: bi('Синхронизация упадёт', 'The sync fails'), why: bi('Синхронизация пройдёт для остальных объектов; лишний просто останется помеченным.', 'The sync goes through for the other objects; the extra one just stays marked.') },
    ],
  },
  {
    id: 'k8s-3.q.reconcilers',
    kind: 'match',
    concepts: ['cicd.gitops-pull'],
    prompt: bi('Кто что считает желаемым состоянием?', 'What does each one take as the desired state?'),
    pairs: [
      { id: 'tf', left: 'Terraform', right: bi('файлы .tf (и state как память о созданном)', 'the .tf files (and the state as the memory of what was created)') },
      { id: 'ans', left: 'Ansible', right: bi('плейбук и роли, при каждом прогоне', 'the playbook and roles, on every run') },
      { id: 'deploy', left: bi('контроллер Deployment', 'the Deployment controller'), right: bi('spec объекта в API', 'the spec of the object in the API') },
      { id: 'argo', left: 'Argo CD', right: bi('манифесты в Git на нужной ревизии', 'the manifests in Git at the given revision') },
    ],
  },
  // ── operate ──
  {
    id: 'k8s-3.q.skew',
    kind: 'mcq',
    concepts: ['k8s.version-skew'],
    prompt: bi('Кластер на v1.36. Можно ли обновить сначала kubelet на рабочих узлах до v1.37, а control plane — потом?', 'The cluster is on v1.36. May you upgrade the kubelet on the workers to v1.37 first and the control plane later?'),
    options: [
      { id: 'no', text: bi('Нет: kubelet не может быть новее API-сервера. Сначала control plane, потом узлы', 'No: the kubelet must not be newer than the API server. The control plane first, then the nodes'), correct: true },
      { id: 'yes', text: bi('Да, порядок не важен', 'Yes, the order does not matter'), why: bi('Политика расхождения версий запрещает kubelet новее kube-apiserver.', 'The version skew policy forbids a kubelet newer than kube-apiserver.') },
      { id: 'jump', text: bi('Да, и можно сразу на v1.38', 'Yes, and straight to v1.38 too'), why: bi('kubeadm обновляет по одной минорной версии за раз.', 'kubeadm upgrades one minor version at a time.') },
    ],
  },
  {
    id: 'k8s-3.q.serial',
    kind: 'bugfind',
    concepts: ['iac.serial'],
    prompt: bi('Плей обновления рабочих узлов. Во время прогона сайт был недоступен несколько минут. Найдите строку, из-за которой.', 'The play that upgrades the workers. During the run the site was down for several minutes. Find the line responsible.'),
    code: '- name: Upgrade the workers\n  hosts: workers\n  become: true\n  serial: "100%"\n  tasks:\n    - name: Drain the node\n      ansible.builtin.command: kubectl drain {{ inventory_hostname }} --ignore-daemonsets\n      delegate_to: cp-1\n    - name: kubeadm upgrade node\n      ansible.builtin.command: kubeadm upgrade node',
    lang: 'yaml',
    bug: [4],
    why: {
      4: bi('serial: "100%" — все рабочие узлы в одной партии: drain выгоняет поды со всех сразу, и им некуда переехать. Нужно serial: 1.', 'serial: "100%" puts all workers in one batch: drain evicts the pods from all of them at once, and they have nowhere to go. It must be serial: 1.'),
      8: bi('drain выполняют там, где есть admin.conf, — на control plane. delegate_to здесь верен.', 'drain runs where admin.conf is — on the control plane. delegate_to is right here.'),
      7: bi('--ignore-daemonsets нужен: поды DaemonSet (Cilium) с узла не выселяются.', '--ignore-daemonsets is needed: DaemonSet pods (Cilium) are not evicted from a node.'),
    },
  },
  {
    id: 'k8s-3.q.certs',
    kind: 'mcq',
    concepts: ['k8s.version-skew'],
    prompt: bi('Кластер kubeadm год никто не обновлял. Что сломается первым?', 'Nobody upgraded a kubeadm cluster for a year. What breaks first?'),
    options: [
      { id: 'certs', text: bi('Истекут сертификаты control plane: kubeadm выдаёт их на год, а обновление версии их продлевает', 'The control-plane certificates expire: kubeadm issues them for a year, and a version upgrade renews them'), correct: true },
      { id: 'ca', text: bi('Истечёт CA', 'The CA expires'), why: bi('CA kubeadm выдаёт на десять лет.', 'kubeadm issues the CA for ten years.') },
      { id: 'nothing', text: bi('Ничего: кластер может работать без обновлений сколько угодно', 'Nothing: a cluster can run without upgrades forever'), why: bi('Работать может, пока не истекут сертификаты, — и это наступит ровно через год после init.', 'It can, until the certificates expire — and that comes exactly a year after init.') },
    ],
    explain: bi('Проверка — `kubeadm certs check-expiration`; ручное продление — `kubeadm certs renew all` с перезапуском статических подов. Регулярное обновление версии решает обе задачи сразу.', 'The check is `kubeadm certs check-expiration`; a manual renewal is `kubeadm certs renew all` with a restart of the static pods. Regular version upgrades solve both at once.'),
  },
];
