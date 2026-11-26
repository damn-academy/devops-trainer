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
    prompt: bi('Кластер из трёх узлов собрали руками по инструкции, и он работает. Чем он хуже такого же кластера, собранного кодом?', 'A three-node cluster was put together by hand from a guide and works. What makes it worse than the same cluster built by code?'),
    options: [
      { id: 'rebuild', text: bi('Его нельзя быстро и точно повторить: после потери машины или для второго окружения всю работу придётся делать заново, и результат получится немного другим', 'It cannot be repeated quickly and exactly: after losing a machine or for a second environment all the work is done again, and the result comes out a little different'), correct: true },
      { id: 'slow', text: bi('Такой кластер медленнее работает', 'Such a cluster runs slower'), why: bi('Скорость кластера не зависит от способа установки, потому что компоненты в нём те же самые.', 'The speed of a cluster does not depend on how it was installed, because the components are the same.') },
      { id: 'unsafe', text: bi('Кластер, собранный руками, всегда небезопасен', 'A cluster put together by hand is always insecure'), why: bi('Кластер, собранный руками, можно настроить так же безопасно. Беда в том, что никто точно не знает, как он настроен, и никто не может повторить эту настройку.', 'A hand-made cluster can be configured just as securely. The trouble is different: nobody knows exactly how it is configured and nobody can repeat it.') },
    ],
    explain: bi('Кластер из кода выигрывает не в первый раз, а в каждый следующий: при пересоздании, при сборке второго окружения и при восстановлении после аварии.', 'A cluster from code wins not the first time but every next time: on a rebuild, for a second environment and on recovery after a disaster.'),
  },
  {
    id: 'k8s-3.q.chain',
    kind: 'order',
    concepts: ['k8s.rebuildable'],
    prompt: bi('Расставьте по порядку звенья, которые собирают кластер из кода.', 'Put the links of building a cluster from code in order.'),
    steps: [
      { id: 'tf', text: bi('Terraform создаёт сеть и ВМ с метками', 'Terraform creates the network and the VMs with labels') },
      { id: 'out', text: bi('terraform output отдаёт инвентарь для Ansible', 'terraform output hands the inventory to Ansible') },
      { id: 'prep', text: bi('Ansible готовит узлы, то есть выключает swap, настраивает ядро и containerd и ставит пакеты', 'Ansible prepares the nodes, that is turns swap off, sets up the kernel and containerd and installs the packages') },
      { id: 'init', text: bi('kubeadm init запускает control plane', 'kubeadm init starts the control plane') },
      { id: 'cni', text: bi('Cilium ставит сеть подов', 'Cilium installs the pod network') },
      { id: 'join', text: bi('kubeadm join присоединяет рабочие узлы', 'kubeadm join adds the workers'), why: bi('Рабочие узлы можно присоединить и до того, как появилась сеть подов, но в состояние Ready они перейдут только после её установки.', 'Workers may join before the pod network too, but they become Ready only after it is installed.') },
    ],
  },
  {
    id: 'k8s-3.q.label',
    kind: 'mcq',
    concepts: ['iac.resource-label'],
    prompt: bi('Зачем каждой ВМ курса ставят метку `trainer=devops`?', 'Why does every VM of the course carry the `trainer=devops` label?'),
    options: [
      { id: 'find', text: bi('По ней находят и удаляют всё, что создал курс, и проверяют, что после уборки ничего нет', 'By it everything the course created is found and deleted, and you check that nothing is left'), correct: true },
      { id: 'k8s', text: bi('По этой метке Kubernetes понимает, что ВМ стала узлом кластера и на неё уже можно ставить поды', 'By this label Kubernetes knows that a VM has become a cluster node and pods can now be placed on it'), why: bi('Kubernetes ничего не знает о метках облака. Узлом кластера машину делает команда kubeadm join.', 'Kubernetes knows nothing about cloud labels. kubeadm join is what makes a machine a node.') },
      { id: 'price', text: bi('Облако со скидкой берёт плату за учебные ВМ с такой меткой, и курс обходится дешевле обычного', 'The cloud bills training VMs with this label at a discount, so the course costs less than usual'), why: bi('Метка никак не влияет на цену. Она нужна для того, чтобы забытая машина не продолжала стоить денег.', 'A label changes nothing in the price. It is there so that a forgotten machine does not keep costing money.') },
    ],
  },
  // ── nodes ──
  {
    id: 'k8s-3.q.count-addr',
    kind: 'mcq',
    concepts: ['iac.count'],
    prompt: bi('Ресурс `edu_vm "worker"` описан с `count = 3` и `name = "worker-${count.index + 1}"`. Какой адрес в state получит машина `worker-2`?', 'The resource `edu_vm "worker"` with `count = 3` and `name = "worker-${count.index + 1}"`. What is the state address of the machine `worker-2`?'),
    options: [
      { id: 'i1', text: 'edu_vm.worker[1]', correct: true },
      { id: 'i2', text: 'edu_vm.worker[2]', why: bi('Нумерация count.index начинается с нуля, поэтому worker-1 получает адрес [0], а worker-2 получает адрес [1].', 'count.index starts at zero, so worker-1 is [0] and worker-2 is [1].') },
      { id: 'name', text: 'edu_vm.worker-2', why: bi('Адрес складывается из типа ресурса, его имени в коде и номера экземпляра, а атрибут name в нём не участвует.', 'The address is built from the type, the name in the code and the instance number; the name attribute plays no part in it.') },
    ],
    explain: bi('Если уменьшить count до 2, Terraform удалит последний экземпляр, worker[2]. Поэтому для узлов с разными ролями удобнее for_each по карте: тогда адресом экземпляра служит ключ карты, а не номер.', 'Lower count to 2 and Terraform deletes the last instance, worker[2]. That is why for nodes with different roles for_each over a map is handier: the address is then a map key, not a number.'),
  },
  {
    id: 'k8s-3.q.output',
    kind: 'mcq',
    concepts: ['iac.output'],
    prompt: bi('Почему инвентарь для Ansible берут из `terraform output`, а не переписывают адреса руками?', 'Why is the Ansible inventory taken from `terraform output` instead of copying the addresses by hand?'),
    options: [
      { id: 'rebuild', text: bi('Адреса выдаёт облако, после пересоздания они другие, а output всегда отдаёт текущие адреса', 'The cloud hands out the addresses, they change after a rebuild, and the output always gives the current ones'), correct: true },
      { id: 'secret', text: bi('Адреса машин секретны, поэтому Terraform прячет их в своём state, и показывать их в журнале нельзя', 'The machine addresses are secret, so Terraform keeps them hidden in its state, and they must never be shown in a log'), why: bi('Адреса не секретны. Дело в том, что они меняются, а человек, который копирует их руками, переносит вчерашние.', 'The addresses are no secret. The point is that they change, and a person copying them by hand carries over yesterday’s.') },
      { id: 'fast', text: bi('Ansible быстрее читает файлы, которые создал Terraform', 'Ansible reads files created by Terraform faster'), why: bi('Ansible всё равно, кто написал файл. Важно только, чтобы в нём были верные адреса.', 'Ansible does not care who wrote the file. All that matters is that it has the right addresses.') },
    ],
  },
  {
    id: 'k8s-3.q.no-changes',
    kind: 'mcq',
    concepts: ['iac.plan', 'k8s.rebuildable'],
    prompt: bi('Кластер собран, и в коде вы ничего не меняли. Что должна показать команда `terraform plan`?', 'The cluster is built and you changed nothing in the code. What should `terraform plan` show?'),
    options: [
      { id: 'none', text: 'No changes. Your infrastructure matches the configuration.', correct: true },
      { id: 'add', text: 'Plan: 3 to add, 0 to change, 0 to destroy.', why: bi('Такой план бывает, когда потерян state: Terraform не видит своих машин и хочет создать новые.', 'This plan appears when the state is lost: Terraform does not see its machines and wants to create new ones.') },
      { id: 'change', text: 'Plan: 0 to add, 3 to change, 0 to destroy.', why: bi('Если план предлагает изменения, хотя код никто не правил, это признак дрейфа: кто-то менял машины в консоли облака.', 'If the plan proposes changes although nobody edited the code, it is a sign of drift: someone changed the machines in the cloud console.') },
    ],
  },
  // ── prepare ──
  {
    id: 'k8s-3.q.prereq-why',
    kind: 'match',
    concepts: ['k8s.cgroup-driver'],
    prompt: bi('Сопоставьте каждый шаг подготовки узла с тем, зачем он нужен.', 'Match each step of node preparation with what it is for.'),
    pairs: [
      { id: 'swap', left: bi('строка swap удалена из fstab', 'the swap line is removed from fstab'), right: bi('kubelet по умолчанию не запускается со swap, а пока строка swap есть в fstab, swap снова включится после перезагрузки', 'by default the kubelet does not start with swap, and while the swap line is in fstab, swap comes back after a reboot') },
      { id: 'fwd', left: 'net.ipv4.ip_forward = 1', right: bi('узел пересылает пакеты подов между сетевыми интерфейсами', 'the node forwards pod packets between network interfaces') },
      { id: 'cg', left: 'SystemdCgroup = true', right: bi('containerd и kubelet управляют cgroup одним способом, через systemd', 'containerd and the kubelet manage cgroups the same way, through systemd') },
      { id: 'pin', left: bi('репозиторий v1.36 и версия пакета в коде', 'the v1.36 repository and the package version in the code'), right: bi('Kubernetes обновляется по решению человека, а не командой apt upgrade', 'Kubernetes is upgraded by a person’s decision, not by apt upgrade') },
    ],
  },
  {
    id: 'k8s-3.q.cgroup',
    kind: 'mcq',
    concepts: ['k8s.cgroup-driver'],
    prompt: bi('Почему на узле с systemd и kubelet, и containerd должны работать с драйвером cgroup systemd?', 'Why must both the kubelet and containerd use the systemd cgroup driver on a node with systemd?'),
    options: [
      { id: 'one', text: bi('У дерева cgroup должен быть один хозяин, а два менеджера, которые не знают друг о друге, под нагрузкой по-разному распределяют ресурсы', 'The cgroup tree must have one owner, and two managers unaware of each other share resources differently under load'), correct: true },
      { id: 'speed', text: bi('Драйвер systemd работает быстрее', 'The systemd driver is faster'), why: bi('Дело не в скорости, а в том, что systemd уже управляет cgroup всей машины.', 'It is not about speed but about systemd already managing the cgroups of the whole machine.') },
      { id: 'kubeadm', text: bi('Без этого kubeadm init не запустится: на проверках preflight он сравнивает драйверы kubelet и containerd и останавливается при расхождении', 'kubeadm init will not run without it: its preflight checks compare the drivers of the kubelet and containerd and stop on a mismatch'), why: bi('kubeadm init может пройти и с другим драйвером, а несогласованность проявится позже, под нагрузкой и при перезапусках.', 'kubeadm init may pass with another driver, and the mismatch shows later, under load and on restarts.') },
    ],
  },
  {
    id: 'k8s-3.q.pin',
    kind: 'mcq',
    concepts: ['k8s.version-pin'],
    prompt: bi('Роль ставит `kubelet` из репозитория `pkgs.k8s.io/core:/stable:/v1.36` и не указывает версию. Что случится, если через полгода пересоздать один узел?', 'A role installs `kubelet` from the `pkgs.k8s.io/core:/stable:/v1.36` repository without a version. What happens if one node is rebuilt half a year later?'),
    options: [
      { id: 'patch', text: bi('Новый узел получит более позднюю патч-версию 1.36, чем остальные', 'The new node gets a later 1.36 patch version than the others'), correct: true },
      { id: 'minor', text: bi('Узел получит версию 1.37, потому что apt ставит самую новую версию kubelet', 'The node gets version 1.37, because apt installs the newest kubelet there is'), why: bi('Репозиторий pkgs.k8s.io разделён по минорным версиям, поэтому из ветки v1.36 версия 1.37 не придёт.', 'The pkgs.k8s.io repository is split by minor version, so 1.37 does not come from the v1.36 branch.') },
      { id: 'same', text: bi('Ничего не случится, потому что версия пакета в репозитории всегда остаётся той же', 'Nothing, because the package version in the repository always stays the same'), why: bi('Внутри ветки выходят новые патч-версии, и если версия не записана в коде, apt поставит самую новую.', 'New patch versions keep coming out in the branch, and if the version is not in the code, apt installs the newest.') },
    ],
    explain: bi('Поэтому версию записывают в коде (`kubeadm=1.36.4-1.1`), а пакет удерживают от обновления командой apt upgrade. На настоящих машинах это делает модуль `ansible.builtin.dpkg_selections` с параметром `selection: hold`.', 'That is why the version is in the code (`kubeadm=1.36.4-1.1`) and the package is held against apt upgrade. On real machines the `ansible.builtin.dpkg_selections` module with `selection: hold` does it.'),
  },
  // ── kubeadm ──
  {
    id: 'k8s-3.q.token',
    kind: 'mcq',
    concepts: ['k8s.bootstrap-token'],
    prompt: bi('Дан токен присоединения `stand1.cl0ckw0rk0range0`. Какая его часть секретна?', 'The bootstrap token `stand1.cl0ckw0rk0range0`. Which part is the secret?'),
    options: [
      { id: 'secret', text: bi('Вторая часть, после точки, а первая служит открытым идентификатором', 'The second part, after the dot, while the first is the public token ID'), correct: true },
      { id: 'first', text: bi('Первая часть, до точки', 'The first part, before the dot'), why: bi('Первая часть служит идентификатором. По ней находят Secret с именем bootstrap-token-<id>, и её показывает команда kubeadm token list.', 'The first part is the ID. The Secret bootstrap-token-<id> is found by it, and kubeadm token list shows it.') },
      { id: 'none', text: bi('Ни одна, потому что токен действует всего 24 часа и секретом не считается', 'Neither, because the token is valid for only 24 hours and is not a secret'), why: bi('За 24 часа с этим токеном можно присоединить к кластеру чужую машину. Ограниченный срок уменьшает ущерб, но не делает токен открытым.', 'Within 24 hours anyone with it can join a foreign machine to the cluster. The limited lifetime reduces the damage but does not make the token public.') },
    ],
  },
  {
    id: 'k8s-3.q.init-files',
    kind: 'multi',
    concepts: ['k8s.kubeadm-config'],
    prompt: bi('Какие файлы появляются на control plane после успешного `kubeadm init`? Отметьте все подходящие.', 'Which files appear on the control plane after a successful `kubeadm init`? Mark every one.'),
    options: [
      { id: 'admin', text: '/etc/kubernetes/admin.conf', correct: true },
      { id: 'pki', text: '/etc/kubernetes/pki/ca.crt', correct: true },
      { id: 'mf', text: '/etc/kubernetes/manifests/kube-apiserver.yaml', correct: true },
      { id: 'cni', text: '/etc/cni/net.d/05-cilium.conflist', why: bi('Этот файл пишет агент Cilium, когда ставится сеть подов, а kubeadm сеть подов не ставит.', 'This file is written by the Cilium agent when the pod network is installed, and kubeadm installs no network.') },
      { id: 'kubelet', text: bi('/etc/kubernetes/kubelet.conf, но только на рабочих узлах', '/etc/kubernetes/kubelet.conf, but on the workers only'), why: bi('Файл kubelet.conf есть и на control plane, потому что kubelet работает на каждом узле, в том числе на управляющем.', 'kubelet.conf exists on the control plane too, because the kubelet runs on every node, the control-plane one included.') },
    ],
  },
  {
    id: 'k8s-3.q.ca-hash',
    kind: 'mcq',
    concepts: ['k8s.bootstrap-token'],
    prompt: bi('Зачем команде `kubeadm join` передают флаг `--discovery-token-ca-cert-hash`?', 'Why is `--discovery-token-ca-cert-hash` passed to `kubeadm join`?'),
    options: [
      { id: 'pin', text: bi('По этому хэшу узел проверяет, что обращается к control plane своего кластера, потому что сравнивает его с хэшем открытого ключа CA, полученного от control plane', 'By this hash the node checks it is talking to its own cluster’s control plane: it compares the hash of its CA public key'), correct: true },
      { id: 'auth', text: bi('По этому хэшу control plane проверяет новый узел', 'By this hash the control plane checks the new node'), why: bi('Новый узел control plane проверяет по токену. Хэш нужен для доверия в обратную сторону, потому что по нему узел проверяет control plane.', 'The control plane checks the node by the token. The hash is for trust in the other direction: by it the node checks the control plane.') },
      { id: 'tls', text: bi('Хэш служит ключом, которым шифруется трафик подов', 'It is the key that encrypts pod traffic'), why: bi('Трафик подов шифрует сетевой плагин, если его настроили на шифрование, и к join это отношения не имеет.', 'Pod traffic is encrypted by the network plugin, if at all, and it has nothing to do with join.') },
    ],
    explain: bi('Без хэша узел поверит первому, кто ответит по этому адресу. Флаг `--discovery-token-unsafe-skip-ca-verification` и поле `unsafeSkipCAVerification` явно разрешают такое доверие, и слово unsafe в их названиях стоит не случайно.', 'Without the hash the node trusts whoever answers at that address first. The `--discovery-token-unsafe-skip-ca-verification` flag and the `unsafeSkipCAVerification` field allow this explicitly, and the word unsafe in their names is there for a reason.'),
  },
  // ── as code ──
  {
    id: 'k8s-3.q.creates',
    kind: 'mcq',
    concepts: ['iac.creates'],
    prompt: bi('В плейбуке есть задача `ansible.builtin.command: kubeadm init --config /etc/kubeadm/init.yaml`, и параметра `creates` у неё нет. Что произойдёт при втором прогоне плейбука?', 'The task `ansible.builtin.command: kubeadm init --config /etc/kubeadm/init.yaml` without `creates`. What happens on the second playbook run?'),
    options: [
      { id: 'fail', text: bi('kubeadm init запустится снова и упадёт на проверках preflight: порты заняты, манифесты уже есть', 'kubeadm init runs again and fails at preflight: the ports are busy and the manifests exist'), correct: true },
      { id: 'ok', text: bi('Ansible поймёт по файлам в /etc/kubernetes, что кластер уже создан, пропустит задачу и ответит ok', 'Ansible sees from the files in /etc/kubernetes that the cluster exists, skips the task and answers ok'), why: bi('Модуль command не знает, что делает команда. Он запускает её каждый раз и отвечает changed или failed.', 'The command module does not know what the command does. It runs it every time and answers changed or failed.') },
      { id: 'reinit', text: bi('kubeadm сбросит старый control plane и пересоздаст кластер с нуля, с новыми сертификатами и токеном', 'kubeadm resets the old control plane and recreates the cluster from scratch with new certificates and a token'), why: bi('kubeadm init не затирает существующий control plane, и его проверки preflight существуют как раз для этого.', 'kubeadm init does not overwrite an existing control plane, and its preflight checks exist for exactly that.') },
    ],
  },
  {
    id: 'k8s-3.q.join-bug',
    kind: 'bugfind',
    concepts: ['iac.creates'],
    prompt: bi('Перед вами роль kubeadm_join. При втором прогоне задача join на рабочих узлах завершается ошибкой `[ERROR FileAvailable--etc-kubernetes-kubelet.conf]`. Найдите строку, которая в этом виновата.', 'The kubeadm_join role. On the second run the workers fail with `[ERROR FileAvailable--etc-kubernetes-kubelet.conf]`. Find the line responsible.'),
    code: '- name: The join configuration\n  ansible.builtin.template:\n    src: join.yaml.j2\n    dest: /etc/kubeadm/join.yaml\n\n- name: kubeadm join, once\n  ansible.builtin.command:\n    cmd: kubeadm join --config /etc/kubeadm/join.yaml\n    creates: /etc/kubernetes/admin.conf',
    lang: 'yaml',
    bug: [9],
    why: {
      9: bi('На рабочем узле файл admin.conf не появляется никогда, потому что его пишет только kubeadm init. Условием должен быть файл, который создаёт join, то есть /etc/kubernetes/kubelet.conf.', 'admin.conf never appears on a worker, because only kubeadm init writes it. The condition must be the file join creates: /etc/kubernetes/kubelet.conf.'),
      4: bi('Каталог /etc/kubeadm вполне подходит для шаблона, потому что проверки preflight смотрят в /etc/kubernetes, а не в этот каталог.', 'A template in /etc/kubeadm is a fine place, because preflight checks /etc/kubernetes, not this directory.'),
      8: bi('Команда записана верно, потому что join выполняется по конфигурационному файлу.', 'The command is right: join runs from a configuration file.'),
    },
  },
  {
    id: 'k8s-3.q.rebuild',
    kind: 'order',
    concepts: ['k8s.rebuildable', 'iac.output'],
    prompt: bi('Кластер нужно пересоздать с нуля. Расставьте команды по порядку.', 'Rebuilding the cluster from scratch. Put the commands in order.'),
    steps: [
      { id: 'destroy', text: 'terraform destroy -auto-approve' },
      { id: 'apply', text: 'terraform apply -auto-approve' },
      { id: 'out', text: 'terraform output -raw inventory > ../ops/inventory.ini', why: bi('У новых машин новые адреса, и старый инвентарь отправит join к control plane, которого уже нет.', 'The new machines have new addresses, and the old inventory sends join to a control plane that no longer exists.') },
      { id: 'play', text: 'ansible-playbook site.yml' },
    ],
  },
  // ── gitops ──
  {
    id: 'k8s-3.q.pull',
    kind: 'mcq',
    concepts: ['cicd.gitops-pull'],
    prompt: bi('Чем выкладка через GitOps отличается от шага `kubectl apply` в пайплайне CI?', 'How does a GitOps release differ from a `kubectl apply` step in a CI pipeline?'),
    options: [
      { id: 'pull', text: bi('Агент внутри кластера сам забирает состояние из Git и постоянно поддерживает его, а пайплайну не нужен доступ к кластеру', 'An agent inside the cluster pulls the state from Git itself and keeps it all the time, and the pipeline needs no cluster access'), correct: true },
      { id: 'faster', text: bi('GitOps доставляет изменения в кластер быстрее, потому что контроллер применяет коммит сразу, без очереди раннеров и стадий пайплайна', 'GitOps rolls changes out faster, because the controller applies a commit at once, without waiting for runners and pipeline stages'), why: bi('Скорость примерно одинакова, а при опросе раз в три минуты GitOps бывает даже медленнее. GitOps выигрывает тем, что кластер сам постоянно поддерживает состояние из Git.', 'The speed is about the same, and with a three-minute poll GitOps can even be slower. The gain is elsewhere.') },
      { id: 'once', text: bi('Ничем не отличается, потому что в обоих случаях манифесты применяются один раз', 'There is no difference, because in both cases the manifests are applied once'), why: bi('Пайплайн применяет манифесты один раз и больше о них не вспоминает. Контроллер GitOps сверяет состояние снова и снова и поэтому замечает ручную правку.', 'A pipeline applies the manifests once and forgets them. A GitOps controller compares again and again, and so it notices a manual edit.') },
    ],
  },
  {
    id: 'k8s-3.q.selfheal',
    kind: 'mcq',
    concepts: ['k8s.sync-policy'],
    prompt: bi('У Application задано `automated: {}` без `selfHeal`. Коллега выполнил `kubectl scale deploy shop --replicas=5`, а в Git записано две реплики. Что будет дальше?', 'An Application has `automated: {}` without `selfHeal`. A colleague ran `kubectl scale deploy shop --replicas=5`, and Git says two replicas. What happens next?'),
    options: [
      { id: 'stays', text: bi('Останется пять реплик, и Application будет OutOfSync до нового коммита или ручной синхронизации', 'Five replicas stay, and the Application is OutOfSync until a new commit or a manual sync'), correct: true },
      { id: 'two', text: bi('Через три минуты Argo CD снова опросит Git, заметит расхождение и уменьшит число реплик обратно до двух', 'In three minutes Argo CD polls Git, notices the drift and scales the replicas back down to two'), why: bi('Автоматическая синхронизация срабатывает на новую ревизию в Git. Возвращать ручную правку без нового коммита должен selfHeal.', 'Automated sync fires on a new Git revision. Undoing a manual edit without a new commit is the job of selfHeal.') },
      { id: 'error', text: bi('Argo CD запретит команду kubectl scale, потому что объектами этого приложения управляет только он', 'Argo CD forbids the kubectl scale command, because only it may manage the objects of this application'), why: bi('Argo CD не запрещает правки. Он их замечает и, если ему это разрешено, отменяет, а запрещать правки должна система прав RBAC.', 'Argo CD does not forbid edits. It notices them and, if allowed, undoes them; forbidding edits is the job of RBAC.') },
    ],
  },
  {
    id: 'k8s-3.q.prune',
    kind: 'mcq',
    concepts: ['k8s.sync-policy'],
    prompt: bi('Из Git удалили файл `k8s/banner.yaml` с ConfigMap. У Application задано `automated: { prune: false }`. Что станет с ConfigMap в кластере?', '`k8s/banner.yaml` (a ConfigMap) was deleted from Git. The Application has `automated: { prune: false }`. What happens to the ConfigMap in the cluster?'),
    options: [
      { id: 'stays', text: bi('ConfigMap останется, а Application покажет его как объект, который нужно удалить, и будет в состоянии OutOfSync', 'The ConfigMap stays, and the Application shows it as an object to be deleted and is OutOfSync'), correct: true },
      { id: 'gone', text: bi('ConfigMap удалится при следующей синхронизации', 'The ConfigMap is deleted on the next sync'), why: bi('Без prune Argo CD сам ничего не удаляет, и это защищает от случайно удалённого файла.', 'Without prune Argo CD deletes nothing by itself, which guards against a file deleted by mistake.') },
      { id: 'error', text: bi('Синхронизация завершится ошибкой', 'The sync fails'), why: bi('Синхронизация пройдёт для всех остальных объектов, а лишний объект останется в кластере с пометкой.', 'The sync goes through for all the other objects, and the extra object stays in the cluster with a mark.') },
    ],
  },
  {
    id: 'k8s-3.q.reconcilers',
    kind: 'match',
    concepts: ['cicd.gitops-pull'],
    prompt: bi('Сопоставьте каждый инструмент с тем, что он считает желаемым состоянием.', 'Match each tool with what it takes as the desired state.'),
    pairs: [
      { id: 'tf', left: 'Terraform', right: bi('файлы .tf, а state служит ему памятью о созданном', 'the .tf files, with the state as its memory of what was created') },
      { id: 'ans', left: 'Ansible', right: bi('плейбук и роли, с которыми Ansible сверяет узлы при каждом прогоне', 'the playbook and roles, on every run') },
      { id: 'deploy', left: bi('контроллер Deployment', 'the Deployment controller'), right: bi('spec объекта в API кластера', 'the spec of the object in the cluster API') },
      { id: 'argo', left: 'Argo CD', right: bi('манифесты в Git на нужной ревизии', 'the manifests in Git at the given revision') },
    ],
  },
  {
    id: 'k8s-3.q.layers',
    kind: 'mcq',
    concepts: ['cicd.gitops-pull', 'iac.idempotence'],
    prompt: bi('Кластер собран кодом, приложение выложено через Argo CD. Ночью коллега зашёл на worker-1 и руками поменял в файле `/etc/containerd/config.toml` значение SystemdCgroup на false. Что первым покажет это расхождение с кодом?', 'The cluster is built by code, the application is released through Argo CD. At night a colleague logged in to worker-1 and set SystemdCgroup to false in `/etc/containerd/config.toml` by hand. What is the first to show this difference from the code?'),
    options: [
      { id: 'ansible', text: bi('Прогон `ansible-playbook site.yml --check`, потому что роль containerd сравнит свой шаблон с файлом на узле и сообщит changed', 'A run of `ansible-playbook site.yml --check`, because the containerd role compares its template with the file on the node and reports changed'), correct: true },
      { id: 'plan', text: bi('Команда `terraform plan`, потому что она сравнивает код с облаком и найдёт изменённую машину', '`terraform plan`, because it compares the code with the cloud and finds the changed machine'), why: bi('Terraform видит машину как ресурс облака: образ, размер, сеть и метки. Файлы внутри машины он не читает, поэтому план ответит No changes.', 'Terraform sees the machine as a cloud resource: image, size, network and labels. It does not read files inside the machine, so the plan answers No changes.') },
      { id: 'argo', text: bi('Argo CD, потому что selfHeal возвращает к Git любую ручную правку в кластере', 'Argo CD, because selfHeal brings any manual edit in the cluster back to Git'), why: bi('Argo CD сравнивает только объекты Kubernetes из репозитория манифестов. Файл на узле не объект Kubernetes, и Application останется в состоянии Synced.', 'Argo CD compares only Kubernetes objects from the manifests repository. A file on a node is not a Kubernetes object, and the Application stays Synced.') },
      { id: 'nodes', text: bi('Команда `kubectl get nodes`, потому что узел сразу перейдёт в состояние NotReady', '`kubectl get nodes`, because the node turns NotReady at once'), why: bi('Узел продолжит работать и останется в состоянии Ready, потому что containerd читает свой файл конфигурации только при запуске и до перезапуска работает со старой настройкой. Поэтому такая правка опасна тем, что сработает не сейчас, а при следующей перезагрузке узла.', 'The node keeps working and stays Ready, because containerd reads its configuration file only at start and keeps the old setting until a restart. That is what makes such an edit dangerous: it takes effect not now but at the next reboot of the node.') },
    ],
    explain: bi('Каждый инструмент сверяет только свой слой: Terraform сверяет машины, Ansible сверяет то, что настроено на машинах, а Argo CD сверяет объекты в кластере. Ручную правку внутри узла найдёт только тот, кто этот узел описывает.', 'Every tool compares only its own layer: Terraform the machines, Ansible what is set up on them, Argo CD the objects in the cluster. A manual edit inside a node is found only by whoever describes that node.'),
  },
  // ── operate ──
  {
    id: 'k8s-3.q.skew',
    kind: 'mcq',
    concepts: ['k8s.version-skew'],
    prompt: bi('Кластер работает на v1.36. Можно ли сначала обновить kubelet на рабочих узлах до v1.37, а control plane обновить потом?', 'The cluster is on v1.36. May you upgrade the kubelet on the workers to v1.37 first and the control plane later?'),
    options: [
      { id: 'no', text: bi('Нельзя: kubelet не может быть новее API-сервера, поэтому control plane обновляют первым', 'No: the kubelet must not be newer than the API server, so the control plane goes first'), correct: true },
      { id: 'yes', text: bi('Можно, потому что kubelet и API-сервер договорятся о версии протокола, и порядок обновления не важен', 'Yes, because the kubelet and the API server agree on a protocol version, so the order of the upgrade does not matter'), why: bi('Правила расхождения версий запрещают kubelet, который новее kube-apiserver.', 'The version skew rules forbid a kubelet newer than kube-apiserver.') },
      { id: 'jump', text: bi('Можно, и даже сразу до v1.38, если потом за один раз обновить control plane до той же версии', 'Yes, and even straight to v1.38, if the control plane is then brought to the same version in one go'), why: bi('kubeadm обновляет кластер только на одну минорную версию за раз.', 'kubeadm upgrades a cluster only one minor version at a time.') },
    ],
  },
  {
    id: 'k8s-3.q.serial',
    kind: 'bugfind',
    concepts: ['iac.serial'],
    prompt: bi('Перед вами сценарий обновления рабочих узлов. Пока он работал, сайт несколько минут был недоступен. Найдите строку, которая в этом виновата.', 'The play that upgrades the workers. During the run the site was down for several minutes. Find the line responsible.'),
    code: '- name: Upgrade the workers\n  hosts: workers\n  become: true\n  serial: "100%"\n  tasks:\n    - name: Drain the node\n      ansible.builtin.command: kubectl drain {{ inventory_hostname }} --ignore-daemonsets\n      delegate_to: cp-1\n    - name: kubeadm upgrade node\n      ansible.builtin.command: kubeadm upgrade node',
    lang: 'yaml',
    bug: [4],
    why: {
      4: bi('Настройка `serial: "100%"` отправляет все рабочие узлы в одну партию. Команда drain выселяет поды со всех узлов сразу, и переехать им некуда, поэтому здесь нужно `serial: 1`.', '`serial: "100%"` puts all workers in one batch. drain evicts the pods from all of them at once, and they have nowhere to go, so this must be `serial: 1`.'),
      8: bi('Команду drain выполняют там, где лежит admin.conf, то есть на control plane, поэтому delegate_to здесь стоит верно.', 'drain runs where admin.conf is, that is on the control plane, so delegate_to is right here.'),
      7: bi('Флаг --ignore-daemonsets здесь нужен, потому что поды DaemonSet, например агенты Cilium, с узла не выселяются.', '--ignore-daemonsets is needed here, because DaemonSet pods such as the Cilium agents are not evicted from a node.'),
    },
  },
  {
    id: 'k8s-3.q.certs',
    kind: 'mcq',
    concepts: ['k8s.version-skew'],
    prompt: bi('Кластер kubeadm год никто не обновлял. Что сломается первым?', 'Nobody upgraded a kubeadm cluster for a year. What breaks first?'),
    options: [
      { id: 'certs', text: bi('Истекут сертификаты control plane, потому что kubeadm выдаёт их на год, а продлевает их обновление версии', 'The control-plane certificates expire, because kubeadm issues them for a year and a version upgrade renews them'), correct: true },
      { id: 'ca', text: bi('Истечёт сертификат удостоверяющего центра (CA)', 'The certificate authority (CA) expires'), why: bi('Сертификат CA kubeadm выдаёт на десять лет.', 'kubeadm issues the CA certificate for ten years.') },
      { id: 'nothing', text: bi('Ничего не сломается: кластер, в который никто не вносит изменений, может работать без обновлений версии сколько угодно', 'Nothing breaks: a cluster that nobody touches can keep running without any version upgrades for as long as you like'), why: bi('Кластер будет работать, пока не истекут сертификаты, а это случится через год после init.', 'The cluster works until the certificates expire, and that happens a year after init.') },
    ],
    explain: bi('Сроки проверяет команда `kubeadm certs check-expiration`, а вручную сертификаты продлевает `kubeadm certs renew all` с последующим перезапуском статических подов. Регулярное обновление версии решает обе задачи сразу.', '`kubeadm certs check-expiration` checks the dates; `kubeadm certs renew all` with a restart of the static pods renews them by hand. Regular version upgrades solve both at once.'),
  },
];
