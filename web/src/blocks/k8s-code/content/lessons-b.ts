// Block 9, lessons 5–8: the cluster as code (creates, a rebuild from
// scratch), GitOps, operations from code, the real-VM track.

import { bi } from '../../../core/i18n';
import type { Facts, Lesson, Sources } from '../../../core/types';
import { app, deployment, forgeHead, hadReplicas, hostFile, idempotentRun, image, inventoryOk, kc, lastOut, lastRun, obj, readyNodes, synced, healthy } from './checks';
import { R, S } from './lessons-a';
import { APP, CONFIGMAP, clusterStand, DEPLOY_FILES, gitopsStand, HOME, noCreates, OPS, opsFiles, preparedStand, ROLE_INIT, ROLE_JOIN } from './setups';

const src = (en: { title: string; url: string }[], ru: { title: string; url: string }[]): Sources => ({ en, ru });
const inv = `${OPS}/inventory.ini`;

const vmIds = (f: Facts | undefined) => (kc(f ?? ({} as Facts))?.vms ?? []).map((v) => v.id).sort();

/** A rebuild: every VM is new (other IDs than at the start), the inventory follows them and the cluster is Ready again. */
function rebuilt(f: Facts, start?: Facts): boolean {
  const before = vmIds(start);
  const now = vmIds(f);
  return before.length === 3 && now.length === 3 && now.every((id) => !before.includes(id)) && inventoryOk(f, inv) && readyNodes(f) === 3;
}

const failedOnPreflight = (f: Facts) => (lastRun(f)?.tasks ?? []).some((t) => t.status === 'failed' && /kubeadm/.test(t.task));

// ── 5. as code ──

export const L_ASCODE: Lesson = {
  id: 'k8s-3.as-code',
  block: 'k8s-3',
  title: bi('Кластер из кода: creates и пересоздание с нуля', 'The cluster as code: creates and a rebuild from scratch'),
  summary: bi('kubeadm превращается в роли, которые можно прогонять сколько угодно раз, а кластер — в набор команд, которые поднимают его из пустого облака.', 'kubeadm turns into roles that can be run any number of times, and the cluster into a sequence of commands that brings it up from an empty cloud.'),
  introduces: ['iac.creates'],
  uses: ['iac.role', 'iac.idempotence', 'iac.output', 'k8s.rebuildable', 'k8s.bootstrap-token', 'k8s.kubeadm-config', 'iac.module'],
  tier: 'core',
  minutes: 45,
  sources: src([S.ansCommand, S.ansRoles, S.kubeadmJoin, S.fowlerPhoenix], [R.ansibleRu, R.kubeadmRu]),
  sections: [
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'У kubeadm нет модуля Ansible, и запускать его приходится модулем `ansible.builtin.command`. Здесь и прячется ловушка. Модуль состояния сначала смотрит, как есть, и меняет только разницу; command ничего не смотрит — он запускает команду каждый раз и каждый раз отвечает changed. Для `kubeadm init` это хуже, чем просто лишняя работа: на узле, который уже control plane, init не пройдёт проверки preflight — порт 6443 занят, манифесты на месте, — и второй прогон плейбука упадёт.\n\nКоманде надо подсказать, по какому признаку её цель уже достигнута. Параметр [[iac.creates|creates]] — путь к файлу, который появляется после успешной команды: если файл есть, задача пропускается и отвечает ok.\n\n```yaml\n- name: kubeadm init, once\n  ansible.builtin.command:\n    cmd: kubeadm init --config /etc/kubeadm/init.yaml\n    creates: /etc/kubernetes/admin.conf\n```\n\nДля init признак — `admin.conf`, для join — `kubelet.conf`, для Cilium — его файл в `/etc/cni/net.d`. Признак выбирают так, чтобы он появлялся только при успехе: файл, который команда пишет в начале работы и оставляет после неудачи, обманет роль.\n\n### Как рабочие узлы узнают токен\n\nВ ручном прогоне вы копировали строку join из вывода init. В коде есть два способа.\n\n**Команда с control plane.** На `cp-1` выполняется `kubeadm token create --print-join-command` с `delegate_to: cp-1` и `run_once: true`, вывод регистрируется в переменную, и рабочие узлы выполняют его. Токен свежий, CA проверяется по хэшу — так делают на настоящих машинах.\n\n**Общий токен в переменных.** Токен заранее создан (`kubeadm token generate`) и лежит в `group_vars/all.yml`, зашифрованном ansible-vault. Он вписывается в `bootstrapTokens` конфигурации init и в `JoinConfiguration` рабочих узлов. Хэша CA до init не знает никто, поэтому join идёт с `unsafeSkipCAVerification: true`: узел поверит тому, кто ответит по адресу `cp_endpoint`. В частной сети, которую вы только что создали своим Terraform, это осознанный риск; в чужой сети — нет. Так устроены роли на стенде: в них нет передачи данных между хостами.\n\n### Пересоздание с нуля\n\nПроверка, что кластер действительно сделан из кода, — удалить его и поднять снова:\n\n```bash\ncd ~/infra && terraform destroy -auto-approve && terraform apply -auto-approve\nterraform output -raw inventory > ../ops/inventory.ini\ncd ~/ops && ansible-playbook site.yml\n```\n\nУ новых машин новые адреса. Именно поэтому инвентарь снова берут из output: старый отправил бы рабочие узлы к control plane, которого больше нет.',
        'kubeadm has no Ansible module, so it has to run through `ansible.builtin.command`. This is where the trap is. A state module first looks at how things are and changes only the difference; command looks at nothing — it runs the command every time and every time answers changed. For `kubeadm init` this is worse than extra work: on a node that is already a control plane, init does not pass the preflight checks — port 6443 is busy, the manifests are in place — and the second playbook run fails.\n\nThe command has to be told by which sign its goal is already reached. The [[iac.creates|creates]] parameter is the path of a file that appears after the command succeeds: if the file exists, the task is skipped and answers ok.\n\n```yaml\n- name: kubeadm init, once\n  ansible.builtin.command:\n    cmd: kubeadm init --config /etc/kubeadm/init.yaml\n    creates: /etc/kubernetes/admin.conf\n```\n\nFor init the sign is `admin.conf`, for join `kubelet.conf`, for Cilium its file in `/etc/cni/net.d`. The sign is chosen so that it appears only on success: a file the command writes at the start and leaves behind after a failure would fool the role.\n\n### How the workers learn the token\n\nIn the manual run you copied the join line from the init output. In code there are two ways.\n\n**A command on the control plane.** `kubeadm token create --print-join-command` runs on `cp-1` with `delegate_to: cp-1` and `run_once: true`, the output is registered into a variable, and the workers run it. The token is fresh and the CA is checked by its hash — this is how it is done on real machines.\n\n**A shared token in variables.** The token is created in advance (`kubeadm token generate`) and kept in `group_vars/all.yml`, encrypted with ansible-vault. It goes into the `bootstrapTokens` of the init configuration and into the `JoinConfiguration` of the workers. Nobody knows the CA hash before init, so join runs with `unsafeSkipCAVerification: true`: the node trusts whoever answers at the `cp_endpoint` address. In a private network you have just created with your own Terraform that is a conscious risk; in someone else’s network it is not. The roles on the stand work this way: there is no data passing between hosts in them.\n\n### A rebuild from scratch\n\nThe proof that a cluster really is made from code is to delete it and bring it up again:\n\n```bash\ncd ~/infra && terraform destroy -auto-approve && terraform apply -auto-approve\nterraform output -raw inventory > ../ops/inventory.ini\ncd ~/ops && ansible-playbook site.yml\n```\n\nThe new machines have new addresses. That is exactly why the inventory is taken from the output again: the old one would send the workers to a control plane that no longer exists.',
      ),
    },
    {
      id: 'lab-b',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      levels: ['beginner'],
      setup: preparedStand({}, opsFiles().map((x) => (x.path.endsWith('kubeadm_init/tasks/main.yml') ? { ...x, content: noCreates(ROLE_INIT) } : x.path.endsWith('kubeadm_join/tasks/main.yml') ? { ...x, content: noCreates(ROLE_JOIN) } : x))),
      intro: bi('В `~/ops` готовый проект: `site.yml`, роли и `group_vars/all.yml` с токеном. Но в ролях `kubeadm_init` и `kubeadm_join` у команд нет `creates`. Откройте `roles/kubeadm_init/tasks/main.yml` и `templates/init.yaml.j2` и прочитайте их перед запуском.', '`~/ops` holds a ready project: `site.yml`, the roles and `group_vars/all.yml` with the token. But the commands in the `kubeadm_init` and `kubeadm_join` roles have no `creates`. Open `roles/kubeadm_init/tasks/main.yml` and `templates/init.yaml.j2` and read them before running.'),
      tasks: [
        {
          id: 'up',
          prompt: bi('Поднимите кластер: `ansible-playbook site.yml`. Все три узла должны стать Ready.', 'Bring the cluster up: `ansible-playbook site.yml`. All three nodes must become Ready.'),
          check: { when: (f: Facts) => readyNodes(f) === 3 },
          chips: 'ansible-playbook site.yml',
          concepts: ['k8s.rebuildable'],
          hints: { H1: bi('Запустите плейбук и дочитайте PLAY RECAP.', 'Run the playbook and read the PLAY RECAP to the end.') },
        },
        {
          id: 'idem',
          prompt: bi('Запустите плейбук ещё раз — он упадёт на kubeadm. Добавьте `creates` в обе роли так, чтобы следующий прогон прошёл с `changed=0` на всех узлах.', 'Run the playbook again — it fails at kubeadm. Add `creates` to both roles so that the next run passes with `changed=0` on every node.'),
          check: {
            when: (f: Facts) => idempotentRun(f) && readyNodes(f) === 3,
            fail: [{ if: failedOnPreflight, say: bi('kubeadm снова запустился на готовом узле. В задаче init нужен creates: /etc/kubernetes/admin.conf, в задаче join — creates: /etc/kubernetes/kubelet.conf.', 'kubeadm ran again on a ready node. The init task needs creates: /etc/kubernetes/admin.conf, the join task creates: /etc/kubernetes/kubelet.conf.') }],
          },
          chips: 'ansible-playbook site.yml',
          concepts: ['iac.creates'],
          docRef: { page: 'ansible-doc/ansible.builtin.command', anchor: 'OPTIONS', line: 'creates' },
          hints: { H1: bi('creates — ещё один параметр модуля command, рядом с cmd.', 'creates is one more parameter of the command module, next to cmd.'), H2: bi('Строка `creates: /etc/kubernetes/admin.conf` под `cmd:` в kubeadm_init.', 'The line `creates: /etc/kubernetes/admin.conf` under `cmd:` in kubeadm_init.') },
        },
        {
          id: 'rebuild',
          prompt: bi('Пересоздайте всё с нуля: destroy и apply в `~/infra`, новый инвентарь из output, плейбук. Кластер должен снова стать Ready на новых машинах.', 'Rebuild everything from scratch: destroy and apply in `~/infra`, a new inventory from the output, the playbook. The cluster must be Ready again on new machines.'),
          check: {
            when: rebuilt,
            fail: [{ if: (f: Facts) => /connection refused/.test(lastOut(f)), say: bi('Рабочие узлы идут по старому cp_endpoint. Инвентарь после пересоздания надо снова взять из terraform output.', 'The workers go to the old cp_endpoint. After a rebuild the inventory has to be taken from terraform output again.') }],
          },
          chips: 'terraform destroy -auto-approve && terraform apply -auto-approve',
          concepts: ['k8s.rebuildable', 'iac.output'],
          hints: { H1: bi('Четыре команды из теории, в каталогах ~/infra и ~/ops.', 'The four commands from the theory, in ~/infra and ~/ops.') },
        },
      ],
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      levels: ['intermediate', 'experienced'],
      setup: preparedStand({}, opsFiles({ omit: ['init', 'join', 'cilium'] })),
      intro: bi('В `~/ops` каркас проекта: `site.yml`, готовые роли подготовки, шаблоны `init.yaml.j2` и `join.yaml.j2`, токен в `group_vars/all.yml`. Файлы задач ролей `kubeadm_init`, `cilium` и `kubeadm_join` пустые — их пишете вы.', '`~/ops` holds the project skeleton: `site.yml`, ready preparation roles, the `init.yaml.j2` and `join.yaml.j2` templates, the token in `group_vars/all.yml`. The task files of the `kubeadm_init`, `cilium` and `kubeadm_join` roles are empty — you write them.'),
      tasks: [
        {
          id: 'up',
          prompt: bi('Напишите три роли: конфигурация из шаблона и `kubeadm init --config` на control plane, `cilium install --version 1.18.4` там же, конфигурация из шаблона и `kubeadm join --config` на рабочих узлах. `ansible-playbook site.yml` должен поднять три узла Ready.', 'Write the three roles: the configuration from the template and `kubeadm init --config` on the control plane, `cilium install --version 1.18.4` there too, the configuration from the template and `kubeadm join --config` on the workers. `ansible-playbook site.yml` must bring up three Ready nodes.'),
          check: { when: (f: Facts) => readyNodes(f) === 3 },
          chips: 'ansible-playbook site.yml',
          concepts: ['k8s.kubeadm-config'],
          hints: {
            H1: bi('В каждой роли две задачи: template (src: init.yaml.j2, dest: /etc/kubeadm/init.yaml) и command с cmd.', 'Each role has two tasks: template (src: init.yaml.j2, dest: /etc/kubeadm/init.yaml) and command with cmd.'),
            H2: bi('Cilium — модулем shell, с KUBECONFIG=/etc/kubernetes/admin.conf перед командой.', 'Cilium with the shell module, with KUBECONFIG=/etc/kubernetes/admin.conf before the command.'),
          },
        },
        {
          id: 'idem',
          prompt: bi('Второй прогон `site.yml` — `changed=0` на всех трёх узлах.', 'A second run of `site.yml` — `changed=0` on all three nodes.'),
          check: {
            when: (f: Facts) => idempotentRun(f) && readyNodes(f) === 3,
            fail: [{ if: failedOnPreflight, say: bi('kubeadm запустился на готовом узле и упал на preflight. Какой файл появляется только после успешной команды?', 'kubeadm ran on a ready node and failed at preflight. Which file appears only after the command succeeds?') }],
          },
          chips: 'ansible-playbook site.yml',
          concepts: ['iac.creates'],
          docRef: { page: 'ansible-doc/ansible.builtin.command', anchor: 'OPTIONS', line: 'creates' },
          hints: { H1: bi('Три признака: admin.conf, kubelet.conf и файл Cilium в /etc/cni/net.d.', 'Three signs: admin.conf, kubelet.conf and the Cilium file in /etc/cni/net.d.') },
        },
        {
          id: 'rebuild',
          prompt: bi('Пересоздайте кластер с нуля на новых машинах: ни одного ручного шага, кроме команд Terraform, output и плейбука.', 'Rebuild the cluster from scratch on new machines: not a single manual step besides the Terraform, output and playbook commands.'),
          check: {
            when: rebuilt,
            fail: [{ if: (f: Facts) => /connection refused/.test(lastOut(f)), say: bi('join идёт по старому адресу. Что изменилось у машин после apply?', 'join goes to the old address. What changed for the machines after apply?') }],
          },
          chips: 'terraform destroy -auto-approve',
          concepts: ['k8s.rebuildable'],
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['k8s-3.q.creates', 'k8s-3.q.join-bug', 'k8s-3.q.rebuild'] },
  ],
};

// ── 6. GitOps ──

const APP_PATH = `${HOME}/app.yaml`;

export const L_GITOPS: Lesson = {
  id: 'k8s-3.gitops',
  block: 'k8s-3',
  title: bi('GitOps: кластер сам забирает приложение из Git', 'GitOps: the cluster pulls the application from Git itself'),
  summary: bi('Последнее звено цепочки: Argo CD внутри кластера постоянно приводит его к манифестам из репозитория. Выкладка — коммит, откат — revert, ручная правка — дрейф.', 'The last link of the chain: Argo CD inside the cluster keeps bringing it to the manifests from a repository. A release is a commit, a rollback a revert, a manual edit is drift.'),
  introduces: ['k8s.argocd-app', 'k8s.sync-policy'],
  uses: ['cicd.gitops-pull', 'k8s.controller', 'k8s.desired-state', 'k8s.crd', 'k8s.deployment', 'git.commit', 'git.remote', 'iac.drift', 'k8s.rebuildable'],
  tier: 'core',
  minutes: 45,
  sources: src([S.openGitops, S.argoDocs, S.argoSync, S.argoDiff], [R.gitRu, R.conceptsRu]),
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Кластер поднимается кодом, но приложение в нём пока появляется командой `kubectl apply` — с ноутбука или из конвейера, которому для этого выдан доступ к кластеру. После пересоздания кластера кто-то должен вспомнить, что и в каком порядке туда выкладывали. А если коллега ночью поправил Deployment руками, об этом знает только он.',
        'The cluster comes up from code, but the application still appears in it through `kubectl apply` — from a laptop or from a pipeline that was given cluster access for it. After a rebuild someone has to remember what was released there and in which order. And if a colleague edited a Deployment by hand at night, only that colleague knows.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        '[[cicd.gitops-pull|GitOps]] переворачивает направление выкладки. Желаемое состояние кластера лежит в Git, а внутри кластера работает агент, который сам забирает его оттуда и приводит кластер к нему — не один раз, а постоянно. Выкладка — это коммит, прошедший ревью; откат — `git revert`; история выкладок — история репозитория. Конвейеру CI больше не нужен доступ к кластеру: он собирает образ и меняет тег в репозитории манифестов, а дальше работает агент.\n\nВы уже видели такой агент много раз. [[k8s.controller|Контроллер]] Kubernetes сравнивает желаемое состояние с живым и устраняет разницу; Terraform делает то же с облаком, Ansible — с серверами. Argo CD — ещё один исполнитель того же цикла, только [[k8s.desired-state|желаемое состояние]] он читает не из API и не из файлов на ноутбуке, а из каталога репозитория на нужной ревизии.\n\n### Application\n\nArgo CD добавляет в кластер свой ресурс через [[k8s.crd|CustomResourceDefinition]]. Объект [[k8s.argocd-app|Application]] говорит контроллеру, что, куда и как:\n\n```yaml\napiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: shop\n  namespace: argocd\nspec:\n  project: default\n  source:\n    repoURL: https://forge.edu/team/shop-deploy.git\n    targetRevision: main\n    path: k8s\n  destination:\n    server: https://kubernetes.default.svc\n    namespace: shop\n  syncPolicy:\n    automated: {}\n    syncOptions:\n      - CreateNamespace=true\n```\n\n`source` — откуда брать манифесты, `destination` — в какой кластер и namespace их класть, `CreateNamespace=true` — создать namespace, если его нет. В `status` контроллер пишет два слова. Sync: **Synced**, если живые объекты совпадают с Git, и **OutOfSync**, если нет. Health: **Healthy**, **Progressing**, **Degraded** — как себя чувствуют сами объекты.\n\n### Политика синхронизации\n\n[[k8s.sync-policy|Политика синхронизации]] решает, кто устраняет разницу. Без `automated` контроллер только показывает OutOfSync, а синхронизацию запускает человек. С `automated` он применяет каждую новую ревизию Git сам. Два уточнения делают его строже: `selfHeal: true` возвращает и ручные правки в кластере — [[iac.drift|дрейф]] живёт несколько секунд; `prune: true` удаляет из кластера объекты, файлы которых удалили из Git. Без prune Argo CD ничего не удаляет сам: случайно удалённый файл не уронит прод.\n\nНастоящий Argo CD опрашивает репозиторий раз в три минуты или сразу по вебхуку. Контроллер на стенде сверяет состояние после каждой вашей команды, поэтому результат виден сразу.',
        '[[cicd.gitops-pull|GitOps]] reverses the direction of a release. The desired state of the cluster lives in Git, and inside the cluster an agent runs that pulls it from there itself and brings the cluster to it — not once, but all the time. A release is a reviewed commit; a rollback is `git revert`; the release history is the repository history. The CI pipeline no longer needs access to the cluster: it builds the image and changes the tag in the manifests repository, and the agent does the rest.\n\nYou have seen such an agent many times. A Kubernetes [[k8s.controller|controller]] compares the desired with the live and removes the difference; Terraform does the same with a cloud, Ansible with servers. Argo CD is one more executor of the same loop, only it reads the [[k8s.desired-state|desired state]] not from the API and not from files on a laptop but from a repository directory at the given revision.\n\n### Application\n\nArgo CD adds its own resource to the cluster through a [[k8s.crd|CustomResourceDefinition]]. An [[k8s.argocd-app|Application]] object tells the controller what, where and how:\n\n```yaml\napiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: shop\n  namespace: argocd\nspec:\n  project: default\n  source:\n    repoURL: https://forge.edu/team/shop-deploy.git\n    targetRevision: main\n    path: k8s\n  destination:\n    server: https://kubernetes.default.svc\n    namespace: shop\n  syncPolicy:\n    automated: {}\n    syncOptions:\n      - CreateNamespace=true\n```\n\n`source` is where to take the manifests from, `destination` which cluster and namespace to put them in, `CreateNamespace=true` creates the namespace if it is missing. In `status` the controller writes two words. Sync: **Synced** if the live objects match Git, **OutOfSync** if not. Health: **Healthy**, **Progressing**, **Degraded** — how the objects themselves are doing.\n\n### The sync policy\n\nThe [[k8s.sync-policy|sync policy]] decides who removes the difference. Without `automated` the controller only shows OutOfSync, and a person starts the sync. With `automated` it applies every new Git revision itself. Two refinements make it stricter: `selfHeal: true` undoes manual edits in the cluster too — [[iac.drift|drift]] lives a few seconds; `prune: true` deletes from the cluster the objects whose files were deleted from Git. Without prune Argo CD deletes nothing by itself: a file deleted by mistake does not bring production down.\n\nA real Argo CD polls the repository every three minutes or at once on a webhook. The controller on the stand compares after each of your commands, so you see the result at once.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s-3.gitops-loop', caption: bi('Пройдите коммит до Healthy. Затем выберите ручной kubectl scale и выключите selfHeal; потом удалите service.yaml с prune и без.', 'Step the commit through to Healthy. Then choose the manual kubectl scale and switch selfHeal off; then delete service.yaml with prune and without.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: gitopsStand({ files: DEPLOY_FILES('trainer/web:1.0', 2, { 'k8s/banner.yaml': CONFIGMAP }) }),
      intro: bi('Кластер с Argo CD (`kubectl get pods -n argocd`) и клон репозитория манифестов `~/shop-deploy`, связанный с `https://forge.edu/team/shop-deploy.git`. Приложения в кластере пока нет. Статус Application удобно смотреть так: `kubectl get application shop -n argocd -o custom-columns=SYNC:.status.sync.status,HEALTH:.status.health.status`.', 'A cluster with Argo CD (`kubectl get pods -n argocd`) and a clone of the manifests repository `~/shop-deploy`, linked to `https://forge.edu/team/shop-deploy.git`. The cluster has no application yet. The Application status is easy to read like this: `kubectl get application shop -n argocd -o custom-columns=SYNC:.status.sync.status,HEALTH:.status.health.status`.'),
      tasks: [
        {
          id: 'app',
          prompt: bi('Создайте `~/app.yaml` с Application `shop` в namespace `argocd`: каталог `k8s` ветки `main` этого репозитория, namespace назначения `shop` с созданием, автоматическая синхронизация. Примените — Application должен стать Synced и Healthy.', 'Create `~/app.yaml` with the Application `shop` in the `argocd` namespace: the `k8s` directory of the `main` branch of this repository, the destination namespace `shop` with creation, automated sync. Apply it — the Application must become Synced and Healthy.'),
          check: {
            when: (f: Facts) => synced(f) && healthy(f) && image(f) === 'trainer/web:1.0',
            fail: [{ if: (f: Facts) => !!app(f) && (app(f)?.status?.sync as { status?: string } | undefined)?.status === 'Unknown', say: bi('Argo CD не может прочитать источник: проверьте repoURL, targetRevision и path.', 'Argo CD cannot read the source: check repoURL, targetRevision and path.') }],
          },
          chips: 'kubectl apply -n argocd -f ~/app.yaml',
          concepts: ['k8s.argocd-app'],
          docRef: { page: 'web/argo-cd.readthedocs.io/declarative-setup', anchor: 'applications' },
          hints: {
            H1: bi('Образец Application — в теории выше; repoURL — адрес remote origin вашего клона (git remote -v).', 'The Application sample is in the theory above; repoURL is the address of the origin remote of your clone (git remote -v).'),
            H2: bi('Если namespace shop не появился, проверьте syncOptions: CreateNamespace=true.', 'If the shop namespace did not appear, check syncOptions: CreateNamespace=true.'),
          },
        },
        {
          id: 'release',
          prompt: bi('Выкатите версию 1.1 так, как это делают в GitOps: образ `trainer/web:1.1` в `k8s/deployment.yaml`, коммит, push. Ни одной команды kubectl для самой выкладки.', 'Roll out version 1.1 the GitOps way: the image `trainer/web:1.1` in `k8s/deployment.yaml`, a commit, a push. Not a single kubectl command for the release itself.'),
          check: {
            when: (f: Facts) => image(f) === 'trainer/web:1.1' && synced(f) && (app(f)?.status?.sync as { revision?: string } | undefined)?.revision === forgeHead(f),
            fail: [{ if: (f: Facts) => image(f) === 'trainer/web:1.1' && (app(f)?.status?.sync as { revision?: string } | undefined)?.revision !== forgeHead(f), say: bi('Образ в кластере поменяли мимо Git. Argo CD считает правдой репозиторий: измените файл и сделайте push.', 'The image in the cluster was changed behind Git’s back. Argo CD takes the repository as the truth: change the file and push.') }],
          },
          chips: 'git commit -a -m "shop 1.1" && git push',
          concepts: ['cicd.gitops-pull'],
          hints: { H1: bi('Правка файла, git commit -a -m …, git push. Потом статус Application.', 'Edit the file, git commit -a -m …, git push. Then the Application status.') },
        },
        {
          id: 'heal',
          prompt: bi('Включите в Application `selfHeal: true` и примените. Затем сыграйте коллегу: `kubectl scale deployment shop -n shop --replicas=5` — и убедитесь, что Argo CD вернул число реплик из Git.', 'Turn on `selfHeal: true` in the Application and apply it. Then play the colleague: `kubectl scale deployment shop -n shop --replicas=5` — and make sure Argo CD brought back the replica count from Git.'),
          check: {
            when: (f: Facts) => (app(f)?.spec as { syncPolicy?: { automated?: { selfHeal?: boolean } } } | undefined)?.syncPolicy?.automated?.selfHeal === true && hadReplicas(f, 5) && deployment(f)?.spec?.replicas === 2 && synced(f),
          },
          chips: 'kubectl scale deployment shop -n shop --replicas=5',
          concepts: ['k8s.sync-policy'],
          hints: { H1: bi('selfHeal — поле внутри automated.', 'selfHeal is a field inside automated.') },
        },
        {
          id: 'prune',
          prompt: bi('Распродажа кончилась: удалите `k8s/banner.yaml` из репозитория так, чтобы ConfigMap `shop-banner` исчез и из кластера, а Application остался Synced.', 'The sale is over: remove `k8s/banner.yaml` from the repository so that the ConfigMap `shop-banner` disappears from the cluster too and the Application stays Synced.'),
          check: {
            when: (f: Facts) => !obj(f, 'ConfigMap', 'shop', 'shop-banner') && synced(f) && (app(f)?.spec as { syncPolicy?: { automated?: { prune?: boolean } } } | undefined)?.syncPolicy?.automated?.prune === true,
            fail: [{ if: (f: Facts) => !!obj(f, 'ConfigMap', 'shop', 'shop-banner') && !synced(f), say: bi('Файл удалён из Git, но ConfigMap на месте и Application OutOfSync: без prune Argo CD сам ничего не удаляет.', 'The file is gone from Git, but the ConfigMap is in place and the Application is OutOfSync: without prune Argo CD deletes nothing by itself.') }],
          },
          chips: 'git rm k8s/banner.yaml',
          concepts: ['k8s.sync-policy'],
          hints: { H1: bi('git rm, commit, push — и одно поле в syncPolicy.automated.', 'git rm, commit, push — and one field in syncPolicy.automated.') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('На время распродажи команда хочет менять число реплик `shop` руками (`kubectl scale`), и Argo CD не должен их возвращать. Всё остальное selfHeal по-прежнему чинит. В уроке такого не было — найдите в документации Argo CD, как исключить одно поле из сравнения и из синхронизации. Затем поставьте 4 реплики.', 'For the sale the team wants to change the replica count of `shop` by hand (`kubectl scale`), and Argo CD must not bring it back. selfHeal still fixes everything else. The lesson did not cover this — find in the Argo CD documentation how to exclude one field from the comparison and from the sync. Then set 4 replicas.'),
      ref: { page: 'web/argo-cd.readthedocs.io/diffing' },
      terminal: {
        setup: gitopsStand({ apps: [APP({ selfHeal: true, prune: true })], extraFiles: [{ path: APP_PATH, content: APP({ selfHeal: true, prune: true }), owner: 'learner' }] }),
        task: {
          id: 'ignore',
          prompt: bi('В кластере 4 реплики shop, Application Synced, selfHeal включён.', 'The cluster has 4 shop replicas, the Application is Synced, selfHeal is on.'),
          check: { when: (f: Facts) => deployment(f)?.spec?.replicas === 4 && synced(f) && (app(f)?.spec as { syncPolicy?: { automated?: { selfHeal?: boolean } } } | undefined)?.syncPolicy?.automated?.selfHeal === true },
          docStep: 4,
          beyond: true,
          solutionTokens: ['ignoreDifferences', 'jsonPointers', 'RespectIgnoreDifferences'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['k8s-3.q.pull', 'k8s-3.q.selfheal', 'k8s-3.q.prune', 'k8s-3.q.reconcilers'] },
  ],
};

// ── 7. operate ──

export const L_OPERATE: Lesson = {
  id: 'k8s-3.operate',
  block: 'k8s-3',
  title: bi('Эксплуатация из кода: сертификаты, версии, обновление по узлу', 'Operations from code: certificates, versions, upgrading node by node'),
  summary: bi('Что стареет в кластере kubeadm, в каком порядке его обновляют и почему плей обновления узлов идёт с serial: 1.', 'What ages in a kubeadm cluster, in which order it is upgraded and why the node upgrade play runs with serial: 1.'),
  introduces: ['iac.serial'],
  uses: ['k8s.kubeadm', 'k8s.etcd', 'k8s.version-pin', 'iac.playbook', 'k8s.rebuildable', 'k8s.static-pod', 'k8s.version-skew', 'k8s.drain', 'k8s.etcd-snapshot'],
  tier: 'core',
  minutes: 35,
  sources: src([S.skew, S.upgrade, S.certs, S.serial], [R.kubeadmRu, R.kubernetesRu]),
  sections: [
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Кластер, поднятый кодом, тоже стареет, и стареет по расписанию.\n\n**Сертификаты.** kubeadm выдаёт сертификаты компонентов control plane на год, а CA — на десять лет. Ровно через год после init API-сервер перестанет принимать соединения. Сроки показывает `kubeadm certs check-expiration`; продлевает их `kubeadm certs renew` — или обновление версии, которое продлевает их само. Кластер, который регулярно обновляют, до этого срока не доживает.\n\n**Версии.** Минорная версия Kubernetes поддерживается около года, и обновляться приходится постоянно. [[k8s.version-skew|Расхождение версий]] задаёт порядок: kubelet не может быть новее API-сервера и может отставать от него не больше чем на три минорные версии, а kubeadm переходит только на одну минорную версию за раз. Поэтому сначала обновляют control plane, потом рабочие узлы, и 1.36 → 1.38 — это два обновления, а не одно.\n\n### Обновление рабочих узлов плейбуком\n\nДля каждого рабочего узла последовательность одна: `kubectl drain` выселяет поды, на узле ставятся пакеты новой закреплённой версии из репозитория новой ветки, `kubeadm upgrade node` обновляет конфигурацию kubelet, kubelet перезапускается, `kubectl uncordon` возвращает узел в работу. drain и uncordon выполняются там, где лежит `admin.conf`, — задача на узле получает `delegate_to: cp-1`.\n\nГлавное в этом плее — ключ [[iac.serial|serial]]. Без него Ansible выполняет каждую задачу на всех хостах сразу: все рабочие узлы окажутся в drain одновременно, подам будет некуда переехать, и приложение ляжет. С `serial: 1` плей проходит целиком один узел, затем следующий: поды переезжают к соседям и возвращаются. Если узел не поднялся, плей останавливается и не трогает остальные.\n\n```yaml\n- name: Upgrade the workers\n  hosts: workers\n  become: true\n  serial: 1\n  tasks:\n    - name: Drain the node\n      ansible.builtin.command: kubectl drain {{ inventory_hostname }} --ignore-daemonsets\n      delegate_to: cp-1\n    - name: kubeadm upgrade node\n      ansible.builtin.command: kubeadm upgrade node\n```\n\n**Снимок etcd.** etcd хранит весь кластер. На control plane роль ставит systemd timer, который каждую ночь делает `etcdctl snapshot save` в каталог резервных копий. Копия, восстановление из которой ни разу не проверяли, не считается копией: восстановление проверяют на отдельном кластере — и тут снова пригождается то, что кластер поднимается кодом.',
        'A cluster brought up by code ages too, and it ages on schedule.\n\n**Certificates.** kubeadm issues the control-plane component certificates for a year and the CA for ten years. Exactly a year after init the API server stops accepting connections. `kubeadm certs check-expiration` shows the expiry dates; `kubeadm certs renew` renews them — or a version upgrade, which renews them by itself. A cluster that is upgraded regularly never lives to that date.\n\n**Versions.** A Kubernetes minor version is supported for about a year, so upgrades never stop. The [[k8s.version-skew|version skew]] policy sets the order: the kubelet must not be newer than the API server and may lag behind it by at most three minor versions, and kubeadm moves only one minor version at a time. So the control plane is upgraded first, then the workers, and 1.36 → 1.38 is two upgrades, not one.\n\n### Upgrading the workers with a playbook\n\nFor every worker the sequence is the same: `kubectl drain` evicts the pods, the packages of the new pinned version from the new branch repository go onto the node, `kubeadm upgrade node` updates the kubelet configuration, the kubelet restarts, `kubectl uncordon` puts the node back into service. drain and uncordon run where `admin.conf` is — the task on the node gets `delegate_to: cp-1`.\n\nThe main thing in this play is the [[iac.serial|serial]] key. Without it Ansible runs each task on all hosts at once: all workers end up drained at the same time, the pods have nowhere to move, and the application goes down. With `serial: 1` the play goes through one node completely, then the next: the pods move to the neighbours and come back. If a node does not come up, the play stops and leaves the rest alone.\n\n```yaml\n- name: Upgrade the workers\n  hosts: workers\n  become: true\n  serial: 1\n  tasks:\n    - name: Drain the node\n      ansible.builtin.command: kubectl drain {{ inventory_hostname }} --ignore-daemonsets\n      delegate_to: cp-1\n    - name: kubeadm upgrade node\n      ansible.builtin.command: kubeadm upgrade node\n```\n\n**An etcd snapshot.** etcd holds the whole cluster. On the control plane a role installs a systemd timer that runs `etcdctl snapshot save` into the backup directory every night. A copy that was never restored from does not count as a copy: the restore is checked on a separate cluster — and here again it pays that the cluster comes up from code.',
      ),
    },
    { id: 'look', kind: 'explainer', step: 'look', explainer: 'k8s-3.from-code', params: { run: 'upgrade' }, caption: bi('Прогон «обновление узлов». Переключите serial на «все узлы сразу» и следите за счётчиком готовых реплик.', 'The “upgrading the nodes” run. Switch serial to “all nodes at once” and watch the ready replicas counter.') },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: clusterStand(),
      intro: bi('Кластер из кода работает: cp-1 и два рабочих узла, v1.36.4. Команды — через Ansible на `cp-1`.', 'The cluster from code is running: cp-1 and two workers, v1.36.4. Commands go through Ansible to `cp-1`.'),
      tasks: [
        {
          id: 'certs',
          prompt: bi('Сохраните на `cp-1` в `/root/certs.txt` таблицу сроков всех сертификатов control plane и прочитайте, сколько им осталось.', 'Save on `cp-1` into `/root/certs.txt` the table of expiry dates of every control-plane certificate and read how long they have left.'),
          check: { when: (f: Facts) => /CERTIFICATE AUTHORITY/.test(hostFile(f, 'cp-1', '/root/certs.txt')) && /apiserver/.test(hostFile(f, 'cp-1', '/root/certs.txt')) },
          chips: 'ansible cp-1 -b -m ansible.builtin.shell -a "kubeadm certs check-expiration > /root/certs.txt"',
          concepts: ['k8s.kubeadm'],
          docRef: { page: 'help/kubeadm-certs', anchor: 'AVAILABLE COMMANDS', line: 'check-expiration' },
          hints: { H1: bi('Подкоманда kubeadm certs; перенаправление вывода требует модуля shell.', 'A kubeadm certs subcommand; redirecting output needs the shell module.') },
        },
        {
          id: 'plan',
          prompt: bi('Сохраните в `/root/upgrade-plan.txt` план обновления кластера: на какую версию kubeadm предлагает перейти и какие компоненты придётся обновить вручную.', 'Save into `/root/upgrade-plan.txt` the cluster upgrade plan: which version kubeadm offers and which components have to be upgraded by hand.'),
          check: { when: (f: Facts) => /kubeadm upgrade apply v1\.37/.test(hostFile(f, 'cp-1', '/root/upgrade-plan.txt')) && /kubelet\s+worker-1/.test(hostFile(f, 'cp-1', '/root/upgrade-plan.txt')) },
          chips: 'ansible cp-1 -b -m ansible.builtin.shell -a "kubeadm upgrade plan > /root/upgrade-plan.txt"',
          concepts: ['k8s.version-skew'],
          docRef: { page: 'help/kubeadm-upgrade', anchor: 'AVAILABLE COMMANDS', line: 'plan' },
          hints: { H1: bi('kubeadm upgrade, подкоманда, которая только проверяет и ничего не меняет.', 'kubeadm upgrade, the subcommand that only checks and changes nothing.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['k8s-3.q.skew', 'k8s-3.q.serial', 'k8s-3.q.certs'] },
  ],
};

// ── 8. the real-VM track ──

const realChecks = [
  { id: 'nodes', label: bi('Три узла Ready', 'Three nodes are Ready'), when: 'k8s.nodes[ready=true]#>=3' },
  { id: 'real', label: bi('Настоящие ядра, не симулятор', 'Real kernels, not the simulator'), when: "k8s.nodes#>=3 && k8s.nodes[kernel~'dt-sim']#=0" },
  { id: 'static', label: bi('kube-apiserver и etcd — статические поды', 'kube-apiserver and etcd are static pods'), when: "k8s.pods[ns=kube-system][name~'kube-apiserver-'][ready=true]#>=1 && k8s.pods[ns=kube-system][name~'etcd-'][ready=true]#>=1" },
  { id: 'cilium', label: bi('Cilium на каждом узле', 'Cilium on every node'), when: "k8s.pods[ns=kube-system][name~'cilium-'][ready=true]#>=3", hint: bi('Роль cilium не отработала или не на всех узлах: `cilium status --wait` на cp-1.', 'The cilium role did not run or not on every node: `cilium status --wait` on cp-1.') },
  { id: 'app', label: bi('Application shop: Synced и Healthy', 'Application shop: Synced and Healthy'), when: "k8s.objects[kind=Application][metadata.name=shop].status.sync.status=Synced && k8s.objects[kind=Application][metadata.name=shop].status.health.status=Healthy", hint: bi('Argo CD не поставлен или Application смотрит не в тот репозиторий: `kubectl -n argocd get application shop -o yaml`.', 'Argo CD is not installed or the Application looks at the wrong repository: `kubectl -n argocd get application shop -o yaml`.') },
];

export const L_REAL: Lesson = {
  id: 'k8s-3.real',
  block: 'k8s-3',
  title: bi('Настоящий трек: три ВМ из кода и самопроверка', 'The real track: three VMs from code and a self-check'),
  summary: bi('Тот же код на настоящем облаке: провайдер, группа безопасности, роли, Argo CD; самопроверка по выводу команд и снимку кластера, обязательная уборка.', 'The same code on a real cloud: a provider, a security group, the roles, Argo CD; a self-check by command output and a cluster snapshot, a mandatory cleanup.'),
  introduces: [],
  uses: ['k8s.rebuildable', 'iac.resource-label', 'iac.count', 'iac.output', 'iac.creates', 'cicd.gitops-pull', 'k8s.argocd-app', 'iac.provider'],
  tier: 'core',
  minutes: 360,
  sources: src([S.hcloud, S.kubeadmCreate, S.argoInstall, S.cilium], [R.kubeadmRu, R.setupRu]),
  sections: [
    {
      id: 'intro',
      kind: 'text',
      step: 'hook',
      body: bi(
        'Всё, что вы делали на стенде, переносится на настоящее облако почти без изменений: меняется провайдер Terraform и появляются вещи, которых на стенде не было, — группа безопасности, ключи SSH, загрузка Argo CD из интернета. Тренажёр на этом этапе ничего не исполняет сам: он ведёт по шагам, считает стоимость и проверяет результат по тому, что вы вставите из своего терминала. Это самопроверка, и экран говорит так прямо. Время — один рабочий день; между занятиями машины можно удалять, потому что всё поднимается кодом.',
        'Everything you did on the stand moves to a real cloud almost unchanged: the Terraform provider changes, and things the stand did not have appear — a security group, SSH keys, downloading Argo CD from the internet. At this stage the trainer runs nothing by itself: it walks you through the steps, counts the cost and checks the result by what you paste from your terminal. It is a self-check, and the screen says so plainly. The time is one working day; between sessions the machines can be deleted, because everything comes up from code.',
      ),
    },
    { id: 'cost', kind: 'callout', tone: 'cost', step: 'hook', title: bi('Сколько это стоит', 'What it costs'), body: bi('Три ВМ по 2 vCPU и 4 ГБ, публичные адреса, диски. Впишите сегодняшнюю цену ВМ-часа своего провайдера: таблица посчитает день работы и месяц забытого стенда. Счётчик идёт с минуты создания машин до минуты, когда пустым стал список ВМ по метке.', 'Three VMs with 2 vCPU and 4 GB, public addresses, disks. Type today’s price of a VM-hour of your provider: the table counts a working day and a forgotten month. The meter runs from the minute the machines are created to the minute the VM list by label becomes empty.') },
    { id: 'cost-table', kind: 'widget', step: 'hook', widget: 'k8s.cost', props: { vms: 3, hours: 8 } },
    {
      id: 'tf',
      kind: 'text',
      step: 'practice',
      title: bi('1. Машины и сеть: Terraform', '1. Machines and the network: Terraform'),
      body: bi(
        'Пример для Hetzner Cloud (провайдер `hetznercloud/hcloud`); у Yandex Cloud, Selectel и других отличаются только типы ресурсов. Токен API передаётся переменной окружения `HCLOUD_TOKEN`, а не пишется в код.\n\n```hcl\nvariable "admin_cidr" {\n  type = string\n  validation {\n    condition     = var.admin_cidr != "0.0.0.0/0"\n    error_message = "Open SSH and the API only to your own address."\n  }\n}\n\nresource "hcloud_network" "k8s" {\n  name     = "trainer"\n  ip_range = "10.10.0.0/16"\n  labels   = { trainer = "devops" }\n}\n\nresource "hcloud_server" "worker" {\n  count       = 2\n  name        = "worker-${count.index + 1}"\n  image       = "ubuntu-24.04"\n  server_type = "cx23"\n  ssh_keys    = [hcloud_ssh_key.me.id]\n  firewall_ids = [hcloud_firewall.k8s.id]\n  labels      = { trainer = "devops", role = "worker" }\n  network { network_id = hcloud_network.k8s.id }\n}\n```\n\nГруппа безопасности (`hcloud_firewall`) снаружи открывает только 22/tcp и 6443/tcp и только с `admin_cidr`. Между узлами нужны 6443/tcp, 2379–2380/tcp (etcd, только control plane), 10250/tcp (kubelet), 4240/tcp и 8472/udp (Cilium). Output `inventory` — тот же, что на стенде, только адреса берутся из `ipv4_address` и `network[*].ip`.',
        'An example for Hetzner Cloud (the `hetznercloud/hcloud` provider); Yandex Cloud, Selectel and others differ only in the resource types. The API token comes through the `HCLOUD_TOKEN` environment variable and is not written into the code.\n\n```hcl\nvariable "admin_cidr" {\n  type = string\n  validation {\n    condition     = var.admin_cidr != "0.0.0.0/0"\n    error_message = "Open SSH and the API only to your own address."\n  }\n}\n\nresource "hcloud_network" "k8s" {\n  name     = "trainer"\n  ip_range = "10.10.0.0/16"\n  labels   = { trainer = "devops" }\n}\n\nresource "hcloud_server" "worker" {\n  count       = 2\n  name        = "worker-${count.index + 1}"\n  image       = "ubuntu-24.04"\n  server_type = "cx23"\n  ssh_keys    = [hcloud_ssh_key.me.id]\n  firewall_ids = [hcloud_firewall.k8s.id]\n  labels      = { trainer = "devops", role = "worker" }\n  network { network_id = hcloud_network.k8s.id }\n}\n```\n\nThe security group (`hcloud_firewall`) opens only 22/tcp and 6443/tcp from outside, and only from `admin_cidr`. Between the nodes you need 6443/tcp, 2379–2380/tcp (etcd, control plane only), 10250/tcp (the kubelet), 4240/tcp and 8472/udp (Cilium). The `inventory` output is the same as on the stand, only the addresses come from `ipv4_address` and `network[*].ip`.',
      ),
    },
    {
      id: 'plan-check',
      kind: 'widget',
      step: 'practice',
      widget: 'k8s.output-check',
      props: {
        where: bi('в каталоге infra после apply', 'in the infra directory after apply'),
        command: 'terraform plan -no-color',
        signs: [
          { id: 'nochanges', label: bi('Код и облако совпадают', 'The code and the cloud match'), re: 'No changes\\. Your infrastructure matches the configuration', hint: bi('План что-то предлагает: кто-то менял машины мимо кода, или код ещё не применён.', 'The plan proposes something: someone changed the machines behind the code, or the code is not applied yet.') },
        ],
      },
    },
    {
      id: 'ansible',
      kind: 'text',
      step: 'practice',
      title: bi('2. Узлы и кластер: те же роли', '2. The nodes and the cluster: the same roles'),
      body: bi(
        'Роли `k8s_prereq`, `containerd`, `kube_packages`, `kubeadm_init`, `cilium` и `kubeadm_join` переносятся со стенда. На настоящих машинах к ним добавляются четыре вещи.\n\n- `swapoff -a` задачей command с условием `when: ansible_swaptotal_mb > 0`: строка в fstab выключает swap только после перезагрузки.\n- `ansible.posix.sysctl` и `community.general.modprobe` вместо файлов: значения применяются сразу.\n- Ключ репозитория `pkgs.k8s.io` (`ansible.builtin.get_url` и `gpg --dearmor` с `creates`) и `ansible.builtin.dpkg_selections` с `selection: hold` для трёх пакетов.\n- Команда join с проверкой CA — с control plane:\n\n```yaml\n- name: A fresh join command\n  ansible.builtin.command: kubeadm token create --print-join-command\n  register: join_cmd\n  delegate_to: "{{ groups[\'control_plane\'][0] }}"\n  run_once: true\n  changed_when: false\n\n- name: kubeadm join, once\n  ansible.builtin.command:\n    cmd: "{{ join_cmd.stdout }}"\n    creates: /etc/kubernetes/kubelet.conf\n```\n\nПосле `ansible-playbook site.yml` запустите его второй раз и вставьте PLAY RECAP ниже.',
        'The `k8s_prereq`, `containerd`, `kube_packages`, `kubeadm_init`, `cilium` and `kubeadm_join` roles move over from the stand. On real machines four things are added to them.\n\n- `swapoff -a` as a command task with the condition `when: ansible_swaptotal_mb > 0`: the fstab line turns swap off only after a reboot.\n- `ansible.posix.sysctl` and `community.general.modprobe` instead of files: the values are applied at once.\n- The `pkgs.k8s.io` repository key (`ansible.builtin.get_url` and `gpg --dearmor` with `creates`) and `ansible.builtin.dpkg_selections` with `selection: hold` for the three packages.\n- A join command with the CA check — from the control plane:\n\n```yaml\n- name: A fresh join command\n  ansible.builtin.command: kubeadm token create --print-join-command\n  register: join_cmd\n  delegate_to: "{{ groups[\'control_plane\'][0] }}"\n  run_once: true\n  changed_when: false\n\n- name: kubeadm join, once\n  ansible.builtin.command:\n    cmd: "{{ join_cmd.stdout }}"\n    creates: /etc/kubernetes/kubelet.conf\n```\n\nAfter `ansible-playbook site.yml` run it a second time and paste its PLAY RECAP below.',
      ),
    },
    {
      id: 'recap-check',
      kind: 'widget',
      step: 'practice',
      widget: 'k8s.output-check',
      props: {
        where: bi('второй прогон site.yml', 'the second run of site.yml'),
        command: 'ansible-playbook site.yml',
        signs: [
          { id: 'recap', label: bi('Есть PLAY RECAP по трём узлам', 'There is a PLAY RECAP for three nodes'), re: '(?:^\\S+\\s*:\\s*ok=\\d+.*\\n?){3,}', flags: 'm' },
          { id: 'zero', label: bi('Ни одного changed', 'Not a single changed'), re: 'changed=[1-9]', absent: true, hint: bi('Какая-то задача описывает действие. Найдите её по TASK […] выше слова changed.', 'Some task describes an action. Find it by the TASK […] above the word changed.') },
          { id: 'nofail', label: bi('Ни одного failed и unreachable', 'Not a single failed or unreachable'), re: '(failed|unreachable)=[1-9]', absent: true },
        ],
      },
    },
    {
      id: 'argo',
      kind: 'text',
      step: 'practice',
      title: bi('3. Приложение: Argo CD', '3. The application: Argo CD'),
      body: bi(
        'Argo CD ставится в свой namespace манифестом выпуска; версию закрепите так же, как всё остальное:\n\n```bash\nkubectl create namespace argocd\nkubectl apply -n argocd --server-side -f https://raw.githubusercontent.com/argoproj/argo-cd/<версия>/manifests/install.yaml\nkubectl -n argocd rollout status deploy argocd-server\n```\n\nApplication `shop` смотрит в ваш публичный репозиторий манифестов (тот же вид, что на стенде). Для проверки положите в кластер одноразовый код и снимите снимок скриптом — он только читает.',
        'Argo CD goes into its own namespace from the release manifest; pin the version just like everything else:\n\n```bash\nkubectl create namespace argocd\nkubectl apply -n argocd --server-side -f https://raw.githubusercontent.com/argoproj/argo-cd/<version>/manifests/install.yaml\nkubectl -n argocd rollout status deploy argocd-server\n```\n\nThe Application `shop` looks at your public manifests repository (the same shape as on the stand). For the check, put a one-time code into the cluster and take a snapshot with the script — it only reads.',
      ),
    },
    { id: 'check', kind: 'widget', step: 'exit', widget: 'k8s.real-check', props: { track: 'r3', checks: realChecks } },
    {
      id: 'rebuild',
      kind: 'text',
      step: 'exit',
      title: bi('4. Подъём с нуля', '4. Up from scratch'),
      body: bi('Последний шаг трека — то, ради чего он: `terraform destroy`, затем `terraform apply`, новый инвентарь, `ansible-playbook site.yml` и Application. Засеките время от пустого облака до Synced: оно войдёт в протокол итогового экзамена (A8). Если понадобилась хоть одна ручная команда на узле, перенесите её в роль и пересоздайте ещё раз.', 'The last step of the track is the point of it: `terraform destroy`, then `terraform apply`, a new inventory, `ansible-playbook site.yml` and the Application. Time it from an empty cloud to Synced: it goes into the final exam protocol (A8). If you needed even one manual command on a node, move it into a role and rebuild once more.'),
    },
    {
      id: 'cleanup',
      kind: 'callout',
      tone: 'cleanup',
      step: 'review',
      title: bi('Уборка — обязательна', 'Cleanup — mandatory'),
      body: bi('Трек не засчитан без трёх вещей: `terraform destroy` с последней строкой `Destroy complete! Resources: N destroyed.`, пустой `terraform state list` и пустой список машин провайдера по метке (`hcloud server list -l trainer=devops -o json` должен напечатать `[]`). Вставьте вывод двух последних команд ниже.', 'The track does not count without three things: `terraform destroy` with the last line `Destroy complete! Resources: N destroyed.`, an empty `terraform state list` and an empty list of provider machines by label (`hcloud server list -l trainer=devops -o json` must print `[]`). Paste the output of the last two commands below.'),
    },
    {
      id: 'cleanup-check',
      kind: 'widget',
      step: 'review',
      widget: 'k8s.output-check',
      props: {
        where: bi('после terraform destroy', 'after terraform destroy'),
        command: 'terraform state list; echo "---"; hcloud server list -l trainer=devops -o json',
        signs: [
          { id: 'state', label: bi('state пуст', 'The state is empty'), re: '^\\s*(hcloud_|yandex_|edu_|aws_|module\\.)', absent: true, hint: bi('В state остались ресурсы: destroy не завершился или часть ресурсов удалили руками мимо Terraform.', 'Resources are left in the state: destroy did not finish, or some resources were deleted by hand behind Terraform’s back.') },
          { id: 'empty', label: bi('Машин с меткой trainer=devops нет', 'There are no machines labelled trainer=devops'), re: '^\\s*\\[\\s*\\]\\s*$', hint: bi('Список не пуст — машины тарифицируются. Удалите их и проверьте снова.', 'The list is not empty — the machines are being billed. Delete them and check again.') },
        ],
      },
    },
  ],
};
