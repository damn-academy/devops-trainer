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
  title: bi('Как превратить kubeadm в роли и пересоздать кластер с нуля', 'How to turn kubeadm into roles and rebuild the cluster from scratch'),
  summary: bi('Как превратить kubeadm в роли, которые можно прогонять сколько угодно раз, а кластер в последовательность команд, которая собирает его из пустого облака.', 'kubeadm turns into roles that can be run any number of times, and the cluster into a sequence of commands that builds it from an empty cloud.'),
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
        'Для kubeadm в Ansible нет отдельного модуля, поэтому запускать его приходится модулем `ansible.builtin.command`, и здесь кроется ловушка. Модуль состояния, например `lineinfile` или `apt`, сначала смотрит, как обстоят дела на узле, и меняет только то, что расходится с описанием. Модуль `command` ничего не проверяет, поэтому запускает команду при каждом прогоне и каждый раз отвечает changed. Для `kubeadm init` это хуже, чем лишняя работа. На узле, который уже стал control plane, init не пройдёт проверки перед запуском (preflight), потому что порт 6443 занят, а манифесты уже лежат на месте, и повторный прогон плейбука завершится ошибкой.\n\nПоэтому команде нужно подсказать, по какому признаку видно, что её цель уже достигнута. Параметр [[iac.creates|creates]] задаёт путь к файлу, который появляется после успешного выполнения команды. Если такой файл уже есть, Ansible пропускает задачу и отвечает ok.\n\n```yaml\n- name: kubeadm init, once\n  ansible.builtin.command:\n    cmd: kubeadm init --config /etc/kubeadm/init.yaml\n    creates: /etc/kubernetes/admin.conf\n```\n\nДля init таким признаком служит файл `admin.conf`, для join файл `kubelet.conf`, а для Cilium его файл в каталоге `/etc/cni/net.d`. Признак выбирают так, чтобы он появлялся только при успехе. Файл, который команда пишет в начале работы и оставляет после неудачи, обманет роль, потому что после неудачного прогона роль решит, что работа уже сделана.\n\n### Как рабочие узлы узнают токен присоединения\n\nВ прошлом уроке вы копировали строку join из вывода init. В коде есть два способа обойтись без копирования.\n\n**Команда, полученная от control plane.** На `cp-1` выполняется `kubeadm token create --print-join-command` с параметрами `delegate_to: cp-1` и `run_once: true`. Вывод команды сохраняется в переменную, и рабочие узлы выполняют его. Токен при этом свежий, а CA проверяется по хэшу, поэтому так делают на настоящих машинах.\n\n**Общий токен в переменных.** Токен создают заранее командой `kubeadm token generate` и хранят в файле `group_vars/all.yml`, зашифрованном программой ansible-vault. Он подставляется в раздел `bootstrapTokens` конфигурации init и в `JoinConfiguration` рабочих узлов. Но хэша CA до init не знает никто, поэтому join выполняется с полем `unsafeSkipCAVerification: true`, и узел поверит тому, кто ответит по адресу `cp_endpoint`. В частной сети, которую вы только что создали своим кодом Terraform, такой риск можно принять сознательно, а в чужой сети нельзя. Роли на стенде устроены вторым способом, потому что в них хосты не передают данные друг другу.\n\n### Как пересоздать кластер с нуля\n\nУбедиться, что кластер целиком собран из кода, можно только одним способом: удалить его и собрать снова.\n\n```bash\ncd ~/infra && terraform destroy -auto-approve && terraform apply -auto-approve\nterraform output -raw inventory > ../ops/inventory.ini\ncd ~/ops && ansible-playbook site.yml\n```\n\nНовые машины получают новые адреса. Поэтому инвентарь снова берут из output, ведь старый инвентарь отправил бы рабочие узлы к control plane, которого больше нет.',
        'kubeadm has no Ansible module, so it has to run through `ansible.builtin.command`, and this is where the trap is. A state module such as `lineinfile` or `apt` first looks at how things are and changes only the difference; `command` checks nothing — it runs the command every time and every time answers changed. For `kubeadm init` this is worse than extra work: on a node that is already a control plane, init does not pass the preflight checks, because port 6443 is busy and the manifests are in place, and the second playbook run fails.\n\nSo the command has to be told by which sign its goal is already reached. The [[iac.creates|creates]] parameter is the path of a file that appears after the command succeeds: if the file exists, Ansible skips the task and answers ok.\n\n```yaml\n- name: kubeadm init, once\n  ansible.builtin.command:\n    cmd: kubeadm init --config /etc/kubeadm/init.yaml\n    creates: /etc/kubernetes/admin.conf\n```\n\nFor init the sign is `admin.conf`, for join `kubelet.conf`, for Cilium its file in `/etc/cni/net.d`. The sign is chosen so that it appears only on success: a file the command writes at the start and leaves behind after a failure would fool the role, which would then consider the job done.\n\n### How the workers learn the bootstrap token\n\nIn the previous lesson you copied the join line from the init output. In code there are two ways to do without copying.\n\n**A command from the control plane.** `kubeadm token create --print-join-command` runs on `cp-1` with `delegate_to: cp-1` and `run_once: true`, the output is saved into a variable, and the workers run it. The token is fresh and the CA is checked by its hash, which is why this is how it is done on real machines.\n\n**A shared token in variables.** The token is created in advance (`kubeadm token generate`) and kept in `group_vars/all.yml`, encrypted with ansible-vault. It goes into the `bootstrapTokens` of the init configuration and into the `JoinConfiguration` of the workers. Nobody knows the CA hash before init, so join runs with `unsafeSkipCAVerification: true`, and the node trusts whoever answers at the `cp_endpoint` address. In a private network you have just created with your own Terraform you may accept that risk consciously; in someone else’s network you may not. The roles on the stand work the second way, because their hosts pass no data to each other.\n\n### How to rebuild the cluster from scratch\n\nThere is only one way to check that a cluster really is made from code: delete it and build it again.\n\n```bash\ncd ~/infra && terraform destroy -auto-approve && terraform apply -auto-approve\nterraform output -raw inventory > ../ops/inventory.ini\ncd ~/ops && ansible-playbook site.yml\n```\n\nThe new machines get new addresses. So the inventory is taken from the output again: the old one would send the workers to a control plane that no longer exists.',
      ),
    },
    {
      id: 'lab-b',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      levels: ['beginner'],
      setup: preparedStand({}, opsFiles().map((x) => (x.path.endsWith('kubeadm_init/tasks/main.yml') ? { ...x, content: noCreates(ROLE_INIT) } : x.path.endsWith('kubeadm_join/tasks/main.yml') ? { ...x, content: noCreates(ROLE_JOIN) } : x))),
      intro: bi('В каталоге `~/ops` лежит готовый проект: плейбук `site.yml`, роли и файл `group_vars/all.yml` с токеном. Но у команд в ролях `kubeadm_init` и `kubeadm_join` нет параметра `creates`. Прежде чем запускать плейбук, откройте и прочитайте файлы `roles/kubeadm_init/tasks/main.yml` и `templates/init.yaml.j2`.', '`~/ops` holds a ready project: `site.yml`, the roles and `group_vars/all.yml` with the token. But the commands in the `kubeadm_init` and `kubeadm_join` roles have no `creates`. Open `roles/kubeadm_init/tasks/main.yml` and `templates/init.yaml.j2` and read them before running.'),
      tasks: [
        {
          id: 'up',
          prompt: bi('Соберите кластер командой `ansible-playbook site.yml`. Все три узла должны перейти в состояние Ready.', 'Build the cluster with `ansible-playbook site.yml`. All three nodes must become Ready.'),
          check: { when: (f: Facts) => readyNodes(f) === 3 },
          chips: 'ansible-playbook site.yml',
          concepts: ['k8s.rebuildable'],
          hints: { H1: bi('Запустите плейбук и дочитайте вывод до итоговой сводки PLAY RECAP.', 'Run the playbook and read the PLAY RECAP to the end.') },
        },
        {
          id: 'idem',
          prompt: bi('Запустите плейбук ещё раз, и он остановится с ошибкой на задаче kubeadm. Добавьте параметр `creates` в обе роли так, чтобы следующий прогон прошёл с `changed=0` на всех узлах.', 'Run the playbook again — it fails at kubeadm. Add `creates` to both roles so that the next run passes with `changed=0` on every node.'),
          check: {
            when: (f: Facts) => idempotentRun(f) && readyNodes(f) === 3,
            fail: [{ if: failedOnPreflight, say: bi('kubeadm снова запустился на готовом узле. В задаче init нужен параметр creates: /etc/kubernetes/admin.conf, а в задаче join нужен параметр creates: /etc/kubernetes/kubelet.conf.', 'kubeadm ran again on a ready node. The init task needs creates: /etc/kubernetes/admin.conf, the join task creates: /etc/kubernetes/kubelet.conf.') }],
          },
          chips: 'ansible-playbook site.yml',
          concepts: ['iac.creates'],
          docRef: { page: 'ansible-doc/ansible.builtin.command', anchor: 'OPTIONS', line: 'creates' },
          hints: { H1: bi('Параметр creates принадлежит модулю command и пишется рядом с параметром cmd.', 'creates is one more parameter of the command module, next to cmd.'), H2: bi('В роли kubeadm_init под строкой `cmd:` должна появиться строка `creates: /etc/kubernetes/admin.conf`.', 'The line `creates: /etc/kubernetes/admin.conf` under `cmd:` in kubeadm_init.') },
        },
        {
          id: 'rebuild',
          prompt: bi('Пересоздайте всё с нуля: выполните destroy и apply в каталоге `~/infra`, возьмите новый инвентарь из output и прогоните плейбук. Кластер должен снова стать Ready, но уже на новых машинах.', 'Rebuild everything from scratch: destroy and apply in `~/infra`, a new inventory from the output, the playbook. The cluster must be Ready again on new machines.'),
          check: {
            when: rebuilt,
            fail: [{ if: (f: Facts) => /connection refused/.test(lastOut(f)), say: bi('Рабочие узлы обращаются к control plane по старому адресу cp_endpoint. После пересоздания инвентарь нужно снова взять из terraform output.', 'The workers go to the old cp_endpoint. After a rebuild the inventory has to be taken from terraform output again.') }],
          },
          chips: 'terraform destroy -auto-approve && terraform apply -auto-approve',
          concepts: ['k8s.rebuildable', 'iac.output'],
          hints: { H1: bi('Нужны четыре команды из теории, которые выполняются в каталогах ~/infra и ~/ops.', 'The four commands from the theory, in ~/infra and ~/ops.') },
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
      intro: bi('В каталоге `~/ops` лежит каркас проекта: плейбук `site.yml`, готовые роли подготовки, шаблоны `init.yaml.j2` и `join.yaml.j2` и токен в файле `group_vars/all.yml`. Файлы задач ролей `kubeadm_init`, `cilium` и `kubeadm_join` пустые, и написать их предстоит вам.', '`~/ops` holds the project skeleton: `site.yml`, ready preparation roles, the `init.yaml.j2` and `join.yaml.j2` templates, the token in `group_vars/all.yml`. The task files of the `kubeadm_init`, `cilium` and `kubeadm_join` roles are empty — you write them.'),
      tasks: [
        {
          id: 'up',
          prompt: bi('Напишите три роли. Роль kubeadm_init кладёт на control plane конфигурацию из шаблона и запускает `kubeadm init --config`. Роль cilium там же выполняет `cilium install --version 1.18.4`. Роль kubeadm_join кладёт на рабочие узлы конфигурацию из шаблона и запускает `kubeadm join --config`. Команда `ansible-playbook site.yml` должна собрать три узла в состоянии Ready.', 'Write the three roles: the configuration from the template and `kubeadm init --config` on the control plane, `cilium install --version 1.18.4` there too, the configuration from the template and `kubeadm join --config` on the workers. `ansible-playbook site.yml` must build three Ready nodes.'),
          check: { when: (f: Facts) => readyNodes(f) === 3 },
          chips: 'ansible-playbook site.yml',
          concepts: ['k8s.kubeadm-config'],
          hints: {
            H1: bi('В каждой роли две задачи: template, который кладёт файл (src: init.yaml.j2, dest: /etc/kubeadm/init.yaml), и command с параметром cmd.', 'Each role has two tasks: template (src: init.yaml.j2, dest: /etc/kubeadm/init.yaml) and command with cmd.'),
            H2: bi('Cilium ставится модулем shell, и перед командой нужно поставить переменную KUBECONFIG=/etc/kubernetes/admin.conf.', 'Cilium with the shell module, with KUBECONFIG=/etc/kubernetes/admin.conf before the command.'),
          },
        },
        {
          id: 'idem',
          prompt: bi('Прогоните `site.yml` второй раз. На всех трёх узлах в итоговой сводке должно стоять `changed=0`.', 'A second run of `site.yml` — `changed=0` on all three nodes.'),
          check: {
            when: (f: Facts) => idempotentRun(f) && readyNodes(f) === 3,
            fail: [{ if: failedOnPreflight, say: bi('kubeadm запустился на готовом узле и остановился на проверках preflight. Подумайте, какой файл появляется только после успешной команды.', 'kubeadm ran on a ready node and failed at preflight. Which file appears only after the command succeeds?') }],
          },
          chips: 'ansible-playbook site.yml',
          concepts: ['iac.creates'],
          docRef: { page: 'ansible-doc/ansible.builtin.command', anchor: 'OPTIONS', line: 'creates' },
          hints: { H1: bi('Признаками служат три файла: admin.conf, kubelet.conf и файл Cilium в каталоге /etc/cni/net.d.', 'Three signs: admin.conf, kubelet.conf and the Cilium file in /etc/cni/net.d.') },
        },
        {
          id: 'rebuild',
          prompt: bi('Пересоздайте кластер с нуля на новых машинах. Кроме команд Terraform, команды output и плейбука, не должно понадобиться ни одного ручного шага.', 'Rebuild the cluster from scratch on new machines: not a single manual step besides the Terraform, output and playbook commands.'),
          check: {
            when: rebuilt,
            fail: [{ if: (f: Facts) => /connection refused/.test(lastOut(f)), say: bi('Команда join обращается к control plane по старому адресу. Подумайте, что изменилось у машин после apply.', 'join goes to the old address. What changed for the machines after apply?') }],
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
  title: bi('Как кластер сам забирает приложение из Git', 'How the cluster pulls the application from Git itself'),
  summary: bi('Последнее звено цепочки: Argo CD внутри кластера постоянно приводит кластер к манифестам из репозитория. Выкладкой становится коммит, откатом становится revert, а ручная правка в кластере считается дрейфом.', 'The last link of the chain: Argo CD inside the cluster keeps bringing it to the manifests from a repository. A release is a commit, a rollback a revert, a manual edit is drift.'),
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
        'Кластер теперь собирается кодом, но приложение в нём по-прежнему появляется командой `kubectl apply`, которую запускают с ноутбука или из конвейера, получившего ради этого доступ к кластеру. После пересоздания кластера кому-то придётся вспомнить, что и в каком порядке туда выкладывали. А если коллега ночью поправил Deployment руками, об этом знает только он сам.',
        'The cluster comes up from code, but the application still appears in it through `kubectl apply` — from a laptop or from a pipeline that was given cluster access for it. After a rebuild someone has to remember what was released there and in which order. And if a colleague edited a Deployment by hand at night, only that colleague knows.',
      ),
    },
    {
      id: 'theory',
      kind: 'text',
      step: 'explain',
      body: bi(
        'Подход [[cicd.gitops-pull|GitOps]], с которым вы познакомились в блоке CI/CD, переворачивает направление выкладки. Желаемое состояние кластера хранится в Git, а внутри кластера работает агент, который сам забирает это состояние из репозитория и приводит к нему кластер, причём не один раз, а постоянно. Выкладкой становится коммит, прошедший ревью, откатом становится `git revert`, а историей выкладок служит история репозитория. Конвейеру CI доступ к кластеру больше не нужен, потому что конвейер только собирает образ и меняет его тег в репозитории манифестов, а остальное делает агент.\n\nТакой агент вы видели уже много раз. [[k8s.controller|Контроллер]] Kubernetes сравнивает желаемое состояние с живым и устраняет разницу, Terraform делает то же самое с облаком, а Ansible с серверами. Argo CD работает по тому же циклу, только [[k8s.desired-state|желаемое состояние]] он читает не из API кластера и не из файлов на ноутбуке, а из каталога репозитория на нужной ревизии.\n\n### Объект Application\n\nArgo CD добавляет в кластер свой тип объектов через [[k8s.crd|CustomResourceDefinition]], расширение API Kubernetes. Объект [[k8s.argocd-app|Application]] говорит контроллеру, откуда брать манифесты, куда их применять и как синхронизировать:\n\n```yaml\napiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: shop\n  namespace: argocd\nspec:\n  project: default\n  source:\n    repoURL: https://forge.edu/team/shop-deploy.git\n    targetRevision: main\n    path: k8s\n  destination:\n    server: https://kubernetes.default.svc\n    namespace: shop\n  syncPolicy:\n    automated: {}\n    syncOptions:\n      - CreateNamespace=true\n```\n\nРаздел `source` указывает, откуда брать манифесты, раздел `destination` указывает, в какой кластер и namespace их класть, а параметр `CreateNamespace=true` просит создать namespace, если его нет. В разделе `status` контроллер пишет два слова. Первое слово сообщает, совпадает ли кластер с Git: **Synced** означает, что живые объекты совпадают с файлами, а **OutOfSync** означает, что они расходятся. Второе слово сообщает, здоровы ли сами объекты: **Healthy** означает, что они работают, **Progressing** означает, что они ещё обновляются, а **Degraded** означает, что с ними что-то не так.\n\n### Политика синхронизации\n\n[[k8s.sync-policy|Политика синхронизации]] решает, кто устраняет разницу между Git и кластером. Без поля `automated` контроллер только показывает OutOfSync, а синхронизацию запускает человек. С полем `automated` контроллер сам применяет каждую новую ревизию из Git. Ещё два поля делают политику строже. Поле `selfHeal: true` заставляет контроллер возвращать к Git и ручные правки в кластере, так что [[iac.drift|дрейф]] держится всего несколько секунд. Поле `prune: true` разрешает удалять из кластера объекты, файлы которых удалили из Git. Без prune Argo CD сам ничего не удаляет, и случайно удалённый файл не выведет из строя рабочее приложение.\n\nНастоящий Argo CD опрашивает репозиторий раз в три минуты или сразу, когда репозиторий присылает уведомление (вебхук). Контроллер на стенде сверяет состояние после каждой вашей команды, поэтому результат вы видите сразу.',
        'The [[cicd.gitops-pull|GitOps]] approach you met in the CI/CD block reverses the direction of a release. The desired state of the cluster is kept in Git, and inside the cluster an agent runs that pulls it from there itself and brings the cluster to it — not once, but all the time. A release is a reviewed commit; a rollback is `git revert`; the release history is the repository history. The CI pipeline no longer needs access to the cluster: it builds the image and changes the tag in the manifests repository, and the agent does the rest.\n\nYou have seen such an agent many times. A Kubernetes [[k8s.controller|controller]] compares the desired with the live and removes the difference; Terraform does the same with a cloud, Ansible with servers. Argo CD runs the same loop, only it reads the [[k8s.desired-state|desired state]] not from the cluster API and not from files on a laptop but from a repository directory at the given revision.\n\n### The Application object\n\nArgo CD adds its own object type to the cluster through a [[k8s.crd|CustomResourceDefinition]], an extension of the Kubernetes API. An [[k8s.argocd-app|Application]] object tells the controller where to take the manifests from, where to apply them and how to sync:\n\n```yaml\napiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: shop\n  namespace: argocd\nspec:\n  project: default\n  source:\n    repoURL: https://forge.edu/team/shop-deploy.git\n    targetRevision: main\n    path: k8s\n  destination:\n    server: https://kubernetes.default.svc\n    namespace: shop\n  syncPolicy:\n    automated: {}\n    syncOptions:\n      - CreateNamespace=true\n```\n\nThe `source` section says where to take the manifests from, `destination` which cluster and namespace to put them in, and `CreateNamespace=true` asks to create the namespace if it is missing. In `status` the controller writes two words. The first says whether the cluster matches Git: **Synced** means the live objects match the files, **OutOfSync** that they differ. The second says whether the objects themselves are healthy: **Healthy** means they work, **Progressing** that they are still updating, **Degraded** that something is wrong with them.\n\n### The sync policy\n\nThe [[k8s.sync-policy|sync policy]] decides who removes the difference between Git and the cluster. Without `automated` the controller only shows OutOfSync, and a person starts the sync. With `automated` it applies every new Git revision itself. Two more fields make it stricter. `selfHeal: true` makes the controller bring manual edits in the cluster back to Git too, so [[iac.drift|drift]] lasts only a few seconds. `prune: true` lets it delete from the cluster the objects whose files were deleted from Git. Without prune Argo CD deletes nothing by itself, and a file deleted by mistake does not bring the working application down.\n\nA real Argo CD polls the repository every three minutes or at once when the repository sends a notification (a webhook). The controller on the stand compares after each of your commands, so you see the result at once.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как Argo CD замечает изменение и приводит к нему кластер', 'How Argo CD notices a change and brings the cluster to it'),
      body: bi(
        'Схема ниже показывает цикл сверки Argo CD для приложения shop. В верхнем ряду стоят разработчик, репозиторий манифестов и контроллер Argo CD, под контроллером лежит объект Application shop с источником и политикой синхронизации. В середине работает API-сервер кластера, а в нижнем ряду живой Deployment shop и его поды. Слева внизу стоит коллега, который может поправить Deployment руками, мимо Git, и его линия нарисована пунктиром. На схеме можно разыграть три события: коммит с новым образом, ручную правку числа реплик и удаление файла из репозитория.',
        'The diagram below shows the Argo CD reconcile loop for the shop application. The top row holds the developer, the manifests repository and the Argo CD controller; under the controller is the Application shop with its source and sync policy. In the middle works the cluster API server, and the bottom row holds the live Deployment shop and its pods. At the bottom left is a colleague who may edit the Deployment by hand, behind Git’s back, and that line is dashed. The diagram plays three events: a commit with a new image, a manual edit of the replica count and deleting a file from the repository.',
      ),
    },
    {
      id: 'look',
      kind: 'explainer',
      step: 'look',
      explainer: 'k8s-3.gitops-loop',
      howto: bi(
        'Нажмите «Начать с первого шага», а дальше листайте кнопкой «Шаг вперёд» над схемой. Сначала на схеме только разработчик и репозиторий, а остальные участники появляются, когда до них доходит цикл. Облачко у подсвеченного участника говорит, что он делает, а карточка на линии показывает, что передаётся: изменение в коммите, номер новой ревизии, применённое поле манифеста. Под схемой считаются реплики в кластере, объекты, которые расходятся с Git, и минуты до совпадения. Значки и цвета объясняет легенда «Как читать схему».\n\nПройдите коммит до состояния Healthy. Затем откройте «Параметры», выберите в поле «Какое изменение произошло» ручную правку числа реплик и выключите в группе «Политика синхронизации» поле selfHeal: реплик останется пять. Потом выберите удаление service.yaml и пройдите его дважды, с выключенным и с включённым prune. Напоследок включите в блоке «Сломать» недоступный репозиторий и посмотрите, что Argo CD делает с работающим приложением.',
        'Press “Start from the first step”, then go on with “Step forward” above the diagram. At first the diagram shows only the developer and the repository; the other participants appear when the loop reaches them. The callout at the highlighted participant says what it does, and the card on the line shows what is handed on: the change in the commit, the new revision, the applied manifest field. The counters under the diagram show the replicas in the cluster, the objects that differ from Git and the minutes until they match. The “How to read the diagram” legend explains the marks and colours.\n\nStep the commit through to Healthy. Then open “Parameters”, choose the manual replica edit in “Which change happened” and switch selfHeal off in “The sync policy”: five replicas stay. Then choose deleting service.yaml and step through it twice, with prune off and on. Finally switch on the unreachable repository in “Break it” and see what Argo CD does with the running application.',
      ),
      caption: bi(
        'В лабораторной ниже вы пройдёте те же события на стенде. Сначала создадите Application shop, затем выложите версию 1.1 коммитом, сыграете роль коллеги, который выполняет `kubectl scale`, и удалите файл ConfigMap из репозитория. Состояния Synced и OutOfSync, которые вы видели на схеме, команда `kubectl get application` покажет в столбце SYNC.',
        'In the lab below you go through the same events on the stand: you create the Application shop, roll out version 1.1 with a commit, play the colleague with `kubectl scale` and delete a ConfigMap file from the repository. The Synced and OutOfSync states you saw on the diagram appear in the SYNC column of `kubectl get application`.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: gitopsStand({ files: DEPLOY_FILES('trainer/web:1.0', 2, { 'k8s/banner.yaml': CONFIGMAP }) }),
      intro: bi('На стенде работает кластер с Argo CD (его поды показывает `kubectl get pods -n argocd`), а в каталоге `~/shop-deploy` лежит клон репозитория манифестов, связанный с `https://forge.edu/team/shop-deploy.git`. Приложения в кластере пока нет. Состояние Application удобно смотреть командой `kubectl get application shop -n argocd -o custom-columns=SYNC:.status.sync.status,HEALTH:.status.health.status`.', 'A cluster with Argo CD (`kubectl get pods -n argocd`) and a clone of the manifests repository `~/shop-deploy`, linked to `https://forge.edu/team/shop-deploy.git`. The cluster has no application yet. The Application status is easy to read like this: `kubectl get application shop -n argocd -o custom-columns=SYNC:.status.sync.status,HEALTH:.status.health.status`.'),
      tasks: [
        {
          id: 'app',
          prompt: bi('Создайте файл `~/app.yaml` с объектом Application `shop` в namespace `argocd`. Он должен брать манифесты из каталога `k8s` ветки `main` этого репозитория, класть их в namespace `shop`, создавая его при необходимости, и синхронизировать изменения автоматически. Примените файл, и Application должен стать Synced и Healthy.', 'Create `~/app.yaml` with the Application `shop` in the `argocd` namespace: the `k8s` directory of the `main` branch of this repository, the destination namespace `shop` with creation, automated sync. Apply it — the Application must become Synced and Healthy.'),
          check: {
            when: (f: Facts) => synced(f) && healthy(f) && image(f) === 'trainer/web:1.0',
            fail: [{ if: (f: Facts) => !!app(f) && (app(f)?.status?.sync as { status?: string } | undefined)?.status === 'Unknown', say: bi('Argo CD не может прочитать источник. Проверьте поля repoURL, targetRevision и path.', 'Argo CD cannot read the source: check repoURL, targetRevision and path.') }],
          },
          chips: 'kubectl apply -n argocd -f ~/app.yaml',
          concepts: ['k8s.argocd-app'],
          docRef: { page: 'web/argo-cd.readthedocs.io/declarative-setup', anchor: 'applications' },
          hints: {
            H1: bi('Образец Application приведён в теории выше. В repoURL запишите адрес удалённого репозитория origin вашего клона, его показывает команда git remote -v.', 'The Application sample is in the theory above; repoURL is the address of the origin remote of your clone (git remote -v).'),
            H2: bi('Если namespace shop не появился, проверьте, есть ли в syncOptions строка CreateNamespace=true.', 'If the shop namespace did not appear, check syncOptions: CreateNamespace=true.'),
          },
        },
        {
          id: 'release',
          prompt: bi('Выложите версию 1.1 так, как это делают в GitOps: поставьте образ `trainer/web:1.1` в файле `k8s/deployment.yaml`, сделайте коммит и отправьте его командой push. Для самой выкладки не должно понадобиться ни одной команды kubectl.', 'Roll out version 1.1 the GitOps way: the image `trainer/web:1.1` in `k8s/deployment.yaml`, a commit, a push. Not a single kubectl command for the release itself.'),
          check: {
            when: (f: Facts) => image(f) === 'trainer/web:1.1' && synced(f) && (app(f)?.status?.sync as { revision?: string } | undefined)?.revision === forgeHead(f),
            fail: [{ if: (f: Facts) => image(f) === 'trainer/web:1.1' && (app(f)?.status?.sync as { revision?: string } | undefined)?.revision !== forgeHead(f), say: bi('Образ в кластере поменяли мимо Git. Argo CD считает правдой то, что записано в репозитории, поэтому измените файл и отправьте коммит.', 'The image in the cluster was changed behind Git’s back. Argo CD takes the repository as the truth: change the file and push.') }],
          },
          chips: 'git commit -a -m "shop 1.1" && git push',
          concepts: ['cicd.gitops-pull'],
          hints: { H1: bi('Поправьте файл, выполните git commit -a -m с сообщением и git push, а потом посмотрите состояние Application.', 'Edit the file, git commit -a -m …, git push. Then the Application status.') },
        },
        {
          id: 'heal',
          prompt: bi('Включите в Application поле `selfHeal: true` и примените файл. Затем сыграйте роль коллеги и выполните `kubectl scale deployment shop -n shop --replicas=5`. Убедитесь, что Argo CD вернул число реплик, записанное в Git.', 'Turn on `selfHeal: true` in the Application and apply it. Then play the colleague: `kubectl scale deployment shop -n shop --replicas=5` — and make sure Argo CD brought back the replica count from Git.'),
          check: {
            when: (f: Facts) => (app(f)?.spec as { syncPolicy?: { automated?: { selfHeal?: boolean } } } | undefined)?.syncPolicy?.automated?.selfHeal === true && hadReplicas(f, 5) && deployment(f)?.spec?.replicas === 2 && synced(f),
          },
          chips: 'kubectl scale deployment shop -n shop --replicas=5',
          concepts: ['k8s.sync-policy'],
          hints: { H1: bi('Поле selfHeal записывается внутри поля automated.', 'selfHeal is a field inside automated.') },
        },
        {
          id: 'prune',
          prompt: bi('Распродажа закончилась. Удалите файл `k8s/banner.yaml` из репозитория так, чтобы ConfigMap `shop-banner` исчез и из кластера, а Application остался в состоянии Synced.', 'The sale is over: remove `k8s/banner.yaml` from the repository so that the ConfigMap `shop-banner` disappears from the cluster too and the Application stays Synced.'),
          check: {
            when: (f: Facts) => !obj(f, 'ConfigMap', 'shop', 'shop-banner') && synced(f) && (app(f)?.spec as { syncPolicy?: { automated?: { prune?: boolean } } } | undefined)?.syncPolicy?.automated?.prune === true,
            fail: [{ if: (f: Facts) => !!obj(f, 'ConfigMap', 'shop', 'shop-banner') && !synced(f), say: bi('Файл удалён из Git, но ConfigMap остался в кластере, а Application в состоянии OutOfSync. Без prune Argo CD сам ничего не удаляет.', 'The file is gone from Git, but the ConfigMap is in place and the Application is OutOfSync: without prune Argo CD deletes nothing by itself.') }],
          },
          chips: 'git rm k8s/banner.yaml',
          concepts: ['k8s.sync-policy'],
          hints: { H1: bi('Удалите файл командой git rm, сделайте коммит и push, а в syncPolicy.automated добавьте одно поле.', 'git rm, commit, push — and one field in syncPolicy.automated.') },
        },
      ],
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('На время распродажи команда хочет менять число реплик `shop` руками командой `kubectl scale`, и Argo CD не должен возвращать их к Git, хотя всё остальное selfHeal по-прежнему чинит. Урок такого случая не разбирал, поэтому найдите в документации Argo CD, как исключить одно поле из сравнения и из синхронизации. Затем поставьте четыре реплики.', 'For the sale the team wants to change the replica count of `shop` by hand (`kubectl scale`), and Argo CD must not bring it back. selfHeal still fixes everything else. The lesson did not cover this — find in the Argo CD documentation how to exclude one field from the comparison and from the sync. Then set 4 replicas.'),
      ref: { page: 'web/argo-cd.readthedocs.io/diffing' },
      terminal: {
        setup: gitopsStand({ apps: [APP({ selfHeal: true, prune: true })], extraFiles: [{ path: APP_PATH, content: APP({ selfHeal: true, prune: true }), owner: 'learner' }] }),
        task: {
          id: 'ignore',
          prompt: bi('В кластере четыре реплики shop, Application в состоянии Synced, и selfHeal включён.', 'The cluster has 4 shop replicas, the Application is Synced, selfHeal is on.'),
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
  title: bi('Как продлевать сертификаты и обновлять кластер по одному узлу', 'How to renew certificates and upgrade the cluster node by node'),
  summary: bi('Что стареет в кластере kubeadm, в каком порядке такой кластер обновляют и почему плей обновления рабочих узлов идёт с настройкой serial: 1.', 'What ages in a kubeadm cluster, in which order it is upgraded and why the node upgrade play runs with serial: 1.'),
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
        'Кластер, собранный кодом, тоже стареет, и стареет он по расписанию.\n\n**Сертификаты истекают.** kubeadm выдаёт сертификаты компонентам control plane на год, а сертификат удостоверяющего центра (CA) на десять лет. Через год после init API-сервер перестанет принимать соединения. Сроки показывает команда `kubeadm certs check-expiration`, а продлевает сертификаты команда `kubeadm certs renew` или обновление версии, которое продлевает их само. Поэтому кластер, который регулярно обновляют, до конца срока своих сертификатов не доходит.\n\n**Версии устаревают.** Каждая минорная версия Kubernetes поддерживается около года, поэтому обновлять кластер приходится постоянно. Порядок обновления задают правила [[k8s.version-skew|расхождения версий]]. kubelet не может быть новее API-сервера и может отставать от него не больше чем на три минорные версии, а kubeadm за один раз переходит только на одну минорную версию. Поэтому сначала обновляют control plane, потом рабочие узлы, и переход с 1.36 на 1.38 требует двух обновлений, а не одного.\n\n### Как обновить рабочие узлы плейбуком\n\nДля каждого рабочего узла порядок один и тот же. Команда [[k8s.drain|kubectl drain]] выводит узел из работы и выселяет с него поды. Затем на узел ставятся пакеты новой закреплённой версии из репозитория новой ветки, команда `kubeadm upgrade node` обновляет конфигурацию kubelet, kubelet перезапускается, и команда `kubectl uncordon` возвращает узел в работу. Команды drain и uncordon выполняются там, где лежит `admin.conf`, поэтому у задачи на узле стоит `delegate_to: cp-1`.\n\nСамое важное в этом плее делает ключ [[iac.serial|serial]]. Без него Ansible выполняет каждую задачу сразу на всех хостах. Тогда все рабочие узлы окажутся выведены из работы одновременно, подам будет некуда переехать, и приложение перестанет отвечать. С `serial: 1` плей проходит один узел целиком и только потом берётся за следующий, поэтому поды переезжают на соседние узлы и возвращаются. Если узел после обновления не заработал, плей останавливается и остальные узлы не трогает.\n\n```yaml\n- name: Upgrade the workers\n  hosts: workers\n  become: true\n  serial: 1\n  tasks:\n    - name: Drain the node\n      ansible.builtin.command: kubectl drain {{ inventory_hostname }} --ignore-daemonsets\n      delegate_to: cp-1\n    - name: kubeadm upgrade node\n      ansible.builtin.command: kubeadm upgrade node\n```\n\n**Снимок etcd делают каждую ночь.** В [[k8s.etcd|etcd]] хранится всё состояние кластера. Поэтому на control plane роль ставит таймер systemd, который каждую ночь выполняет `etcdctl snapshot save` и кладёт [[k8s.etcd-snapshot|снимок]] в каталог резервных копий. Копию, из которой ни разу не пробовали восстановиться, копией считать нельзя. Восстановление проверяют на отдельном кластере, и здесь снова выручает то, что кластер собирается кодом.',
        'A cluster built by code ages too, and it ages on schedule.\n\n**Certificates.** kubeadm issues the control-plane component certificates for a year and the certificate authority (CA) for ten years. A year after init the API server stops accepting connections. `kubeadm certs check-expiration` shows the expiry dates; `kubeadm certs renew` renews them, and so does a version upgrade, by itself. So a cluster that is upgraded regularly never reaches the end of its certificates.\n\n**Versions.** Every Kubernetes minor version is supported for about a year, so upgrades never stop. The [[k8s.version-skew|version skew]] rules set the order: the kubelet must not be newer than the API server and may lag behind it by at most three minor versions, and kubeadm moves only one minor version at a time. So the control plane is upgraded first, then the workers, and 1.36 → 1.38 takes two upgrades, not one.\n\n### How to upgrade the workers with a playbook\n\nFor every worker the order is the same. [[k8s.drain|kubectl drain]] takes the node out of service and evicts its pods. Then the packages of the new pinned version from the new branch repository go onto the node, `kubeadm upgrade node` updates the kubelet configuration, the kubelet restarts, and `kubectl uncordon` puts the node back into service. drain and uncordon run where `admin.conf` is, so the task on the node has `delegate_to: cp-1`.\n\nThe main thing in this play is the [[iac.serial|serial]] key. Without it Ansible runs each task on all hosts at once: all workers end up out of service at the same time, the pods have nowhere to move, and the application stops answering. With `serial: 1` the play goes through one node completely and only then takes the next, so the pods move to the neighbours and come back. If a node does not work after the upgrade, the play stops and leaves the rest alone.\n\n```yaml\n- name: Upgrade the workers\n  hosts: workers\n  become: true\n  serial: 1\n  tasks:\n    - name: Drain the node\n      ansible.builtin.command: kubectl drain {{ inventory_hostname }} --ignore-daemonsets\n      delegate_to: cp-1\n    - name: kubeadm upgrade node\n      ansible.builtin.command: kubeadm upgrade node\n```\n\n**An etcd snapshot.** [[k8s.etcd|etcd]] holds the whole state of the cluster. So on the control plane a role installs a systemd timer that runs `etcdctl snapshot save` every night and puts the [[k8s.etcd-snapshot|snapshot]] into the backup directory. A copy nobody ever tried to restore from does not count as a copy. The restore is checked on a separate cluster, and here again it pays that the cluster is built from code.',
      ),
    },
    {
      id: 'look-intro',
      kind: 'text',
      step: 'look',
      title: bi('Как плей обновляет рабочие узлы', 'How the play upgrades the workers'),
      body: bi(
        'Схема ниже знакома вам по первому уроку блока, но теперь на ней выбран прогон «обновление рабочих узлов». Control plane на cp-1 уже обновлён до v1.37, а рабочие узлы ещё работают на v1.36. Ansible проходит рабочие узлы, выводит каждый из работы, обновляет и возвращает обратно. Под схемой следите за счётчиком готовых реплик приложения: он показывает, сколько подов отвечает пользователям в каждый момент обновления.',
        'You know the diagram below from the first lesson of the block, but now the “upgrading the workers” run is chosen. The control plane on cp-1 is already on v1.37, while the workers still run v1.36. Ansible goes over the workers, takes each out of service, upgrades it and puts it back. Under the diagram watch the ready application replicas counter: it shows how many pods answer users at every moment of the upgrade.',
      ),
    },
    {
      id: 'look',
      kind: 'explainer',
      step: 'look',
      explainer: 'k8s-3.from-code',
      params: { run: 'upgrade' },
      howto: bi(
        'Листайте шаги кнопкой «Шаг вперёд» над схемой. Узел, выведенный из работы, обведён жёлтой рамкой, а узел, который вернулся в работу на новой версии, обведён зелёной. Пройдите обновление до конца и посмотрите, сколько готовых реплик было в худший момент.\n\nЗатем откройте «Параметры» и выберите в поле «Сколько рабочих узлов обновлять одновременно» вариант «все узлы сразу». Пройдите обновление ещё раз и сравните счётчик готовых реплик с первым прогоном.',
        'Step with “Step forward” above the diagram. A node out of service has a yellow outline, and a node back in service on the new version has a green one. Step the upgrade to the end and see how many ready replicas there were at the worst moment.\n\nThen open “Parameters” and choose “all nodes at once” in “How many workers to upgrade at once”. Step through the upgrade again and compare the ready replicas counter with the first run.',
      ),
      caption: bi(
        'Когда вы будете писать плей обновления для своего кластера, помните, что ключ `serial: 1` определяет, останется ли у приложения хотя бы одна готовая реплика, и разницу вы только что видели на счётчике. В лабораторной ниже вы начнёте с того, что делают перед любым обновлением: узнаете, сколько ещё действуют сертификаты, и спросите kubeadm, на какую версию он предлагает перейти.',
        'When you write the upgrade play for your cluster, `serial: 1` decides what you just saw on the counter: whether the application keeps at least one ready replica. In the lab below you start with what comes before any upgrade: you find out how long the certificates have left and ask kubeadm which version it offers.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: clusterStand(),
      intro: bi('Кластер, собранный из кода, работает, и в нём есть узел cp-1 и два рабочих узла версии v1.36.4. Команды вы отправляете на `cp-1` через Ansible.', 'The cluster from code is running: cp-1 and two workers, v1.36.4. Commands go through Ansible to `cp-1`.'),
      tasks: [
        {
          id: 'certs',
          prompt: bi('Сохраните на `cp-1` в файл `/root/certs.txt` таблицу сроков действия всех сертификатов control plane и прочитайте, сколько им осталось.', 'Save on `cp-1` into `/root/certs.txt` the table of expiry dates of every control-plane certificate and read how long they have left.'),
          check: { when: (f: Facts) => /CERTIFICATE AUTHORITY/.test(hostFile(f, 'cp-1', '/root/certs.txt')) && /apiserver/.test(hostFile(f, 'cp-1', '/root/certs.txt')) },
          chips: 'ansible cp-1 -b -m ansible.builtin.shell -a "kubeadm certs check-expiration > /root/certs.txt"',
          concepts: ['k8s.kubeadm'],
          docRef: { page: 'help/kubeadm-certs', anchor: 'AVAILABLE COMMANDS', line: 'check-expiration' },
          hints: { H1: bi('Вам нужна подкоманда kubeadm certs, а чтобы перенаправить её вывод в файл, понадобится модуль shell.', 'A kubeadm certs subcommand; redirecting output needs the shell module.') },
        },
        {
          id: 'plan',
          prompt: bi('Сохраните в файл `/root/upgrade-plan.txt` план обновления кластера. Из него должно быть видно, на какую версию kubeadm предлагает перейти и какие компоненты придётся обновить вручную.', 'Save into `/root/upgrade-plan.txt` the cluster upgrade plan: which version kubeadm offers and which components have to be upgraded by hand.'),
          check: { when: (f: Facts) => /kubeadm upgrade apply v1\.37/.test(hostFile(f, 'cp-1', '/root/upgrade-plan.txt')) && /kubelet\s+worker-1/.test(hostFile(f, 'cp-1', '/root/upgrade-plan.txt')) },
          chips: 'ansible cp-1 -b -m ansible.builtin.shell -a "kubeadm upgrade plan > /root/upgrade-plan.txt"',
          concepts: ['k8s.version-skew'],
          docRef: { page: 'help/kubeadm-upgrade', anchor: 'AVAILABLE COMMANDS', line: 'plan' },
          hints: { H1: bi('У kubeadm upgrade есть подкоманда, которая только проверяет кластер и ничего в нём не меняет.', 'kubeadm upgrade, the subcommand that only checks and changes nothing.') },
        },
      ],
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: ['k8s-3.q.skew', 'k8s-3.q.serial', 'k8s-3.q.certs'] },
  ],
};

// ── 8. the real-VM track ──

const realChecks = [
  { id: 'nodes', label: bi('Три узла в состоянии Ready', 'Three nodes are Ready'), when: 'k8s.nodes[ready=true]#>=3' },
  { id: 'real', label: bi('Узлы работают на настоящих ядрах, а не в симуляторе', 'Real kernels, not the simulator'), when: "k8s.nodes#>=3 && k8s.nodes[kernel~'dt-sim']#=0" },
  { id: 'static', label: bi('kube-apiserver и etcd запущены статическими подами', 'kube-apiserver and etcd are static pods'), when: "k8s.pods[ns=kube-system][name~'kube-apiserver-'][ready=true]#>=1 && k8s.pods[ns=kube-system][name~'etcd-'][ready=true]#>=1" },
  { id: 'cilium', label: bi('Cilium работает на каждом узле', 'Cilium on every node'), when: "k8s.pods[ns=kube-system][name~'cilium-'][ready=true]#>=3", hint: bi('Роль cilium не отработала или отработала не на всех узлах. Проверьте это командой `cilium status --wait` на cp-1.', 'The cilium role did not run or not on every node: `cilium status --wait` on cp-1.') },
  { id: 'app', label: bi('Application shop в состоянии Synced и Healthy', 'Application shop: Synced and Healthy'), when: "k8s.objects[kind=Application][metadata.name=shop].status.sync.status=Synced && k8s.objects[kind=Application][metadata.name=shop].status.health.status=Healthy", hint: bi('Argo CD не установлен, или Application смотрит не в тот репозиторий. Проверьте это командой `kubectl -n argocd get application shop -o yaml`.', 'Argo CD is not installed or the Application looks at the wrong repository: `kubectl -n argocd get application shop -o yaml`.') },
];

export const L_REAL: Lesson = {
  id: 'k8s-3.real',
  block: 'k8s-3',
  title: bi('Как собрать кластер из кода в настоящем облаке', 'How to build a cluster from code in a real cloud'),
  summary: bi('Тот же код в настоящем облаке: провайдер Terraform, группа безопасности, роли и Argo CD. Результат вы проверяете сами по выводу команд и снимку кластера, а в конце обязательно убираете все машины.', 'The same code on a real cloud: a provider, a security group, the roles, Argo CD; a self-check by command output and a cluster snapshot, a mandatory cleanup.'),
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
        'Всё, что вы делали на стенде, переносится в настоящее облако почти без изменений. Меняется [[iac.provider|провайдер]] Terraform, и появляется то, чего на стенде не было: группа безопасности, ключи SSH и загрузка Argo CD из интернета. На этом этапе тренажёр сам ничего не выполняет. Он ведёт вас по шагам, считает стоимость и проверяет результат по тому выводу, который вы вставите из своего терминала, так что это самопроверка. На трек уходит один рабочий день, а между занятиями машины можно удалять, потому что весь кластер собирается кодом.',
        'Everything you did on the stand moves to a real cloud almost unchanged: the Terraform [[iac.provider|provider]] changes, and things the stand did not have appear — a security group, SSH keys, downloading Argo CD from the internet. At this stage the trainer runs nothing by itself: it walks you through the steps, counts the cost and checks the result by what you paste from your terminal, so this is a self-check. The track takes one working day; between sessions the machines can be deleted, because the whole cluster is built from code.',
      ),
    },
    { id: 'cost', kind: 'callout', tone: 'cost', step: 'hook', title: bi('Сколько это стоит', 'What it costs'), body: bi('Трек требует трёх машин по 2 vCPU и 4 ГБ памяти, публичных адресов и дисков. Впишите сегодняшнюю цену ВМ-часа у своего провайдера, и таблица посчитает стоимость рабочего дня и месяца, если стенд забыть. Счёт идёт с минуты, когда машины созданы, до минуты, когда список машин с меткой курса опустел.', 'Three VMs with 2 vCPU and 4 GB, public addresses, disks. Type today’s price of a VM-hour of your provider: the table counts a working day and a forgotten month. The meter runs from the minute the machines are created to the minute the VM list by label becomes empty.') },
    { id: 'cost-table', kind: 'widget', step: 'hook', widget: 'k8s.cost', props: { vms: 3, hours: 8 } },
    {
      id: 'tf',
      kind: 'text',
      step: 'practice',
      title: bi('Шаг 1. Как описать машины и сеть кодом Terraform', 'Step 1. How to describe the machines and the network in Terraform code'),
      body: bi(
        'Ниже приведён пример для Hetzner Cloud с провайдером `hetznercloud/hcloud`. У Yandex Cloud, Selectel и других облаков отличаются только типы ресурсов. Токен API передаётся через переменную окружения `HCLOUD_TOKEN` и в код не записывается.\n\n```hcl\nvariable "admin_cidr" {\n  type = string\n  validation {\n    condition     = var.admin_cidr != "0.0.0.0/0"\n    error_message = "Open SSH and the API only to your own address."\n  }\n}\n\nresource "hcloud_network" "k8s" {\n  name     = "trainer"\n  ip_range = "10.10.0.0/16"\n  labels   = { trainer = "devops" }\n}\n\nresource "hcloud_server" "worker" {\n  count       = 2\n  name        = "worker-${count.index + 1}"\n  image       = "ubuntu-24.04"\n  server_type = "cx23"\n  ssh_keys    = [hcloud_ssh_key.me.id]\n  firewall_ids = [hcloud_firewall.k8s.id]\n  labels      = { trainer = "devops", role = "worker" }\n  network { network_id = hcloud_network.k8s.id }\n}\n```\n\nГруппа безопасности (`hcloud_firewall`) открывает снаружи только порты 22/tcp и 6443/tcp и только для адресов из `admin_cidr`. Между узлами должны быть открыты порты 6443/tcp для API-сервера, 2379–2380/tcp для etcd (только на control plane), 10250/tcp для kubelet, а также 4240/tcp и 8472/udp для Cilium. Output `inventory` такой же, как на стенде, только адреса берутся из атрибутов `ipv4_address` и `network[*].ip`.',
        'An example for Hetzner Cloud (the `hetznercloud/hcloud` provider); Yandex Cloud, Selectel and others differ only in the resource types. The API token comes through the `HCLOUD_TOKEN` environment variable and is not written into the code.\n\n```hcl\nvariable "admin_cidr" {\n  type = string\n  validation {\n    condition     = var.admin_cidr != "0.0.0.0/0"\n    error_message = "Open SSH and the API only to your own address."\n  }\n}\n\nresource "hcloud_network" "k8s" {\n  name     = "trainer"\n  ip_range = "10.10.0.0/16"\n  labels   = { trainer = "devops" }\n}\n\nresource "hcloud_server" "worker" {\n  count       = 2\n  name        = "worker-${count.index + 1}"\n  image       = "ubuntu-24.04"\n  server_type = "cx23"\n  ssh_keys    = [hcloud_ssh_key.me.id]\n  firewall_ids = [hcloud_firewall.k8s.id]\n  labels      = { trainer = "devops", role = "worker" }\n  network { network_id = hcloud_network.k8s.id }\n}\n```\n\nThe security group (`hcloud_firewall`) opens only 22/tcp and 6443/tcp from outside, and only from `admin_cidr`. Between the nodes you need 6443/tcp for the API server, 2379–2380/tcp for etcd (control plane only), 10250/tcp for the kubelet, and 4240/tcp and 8472/udp for Cilium. The `inventory` output is the same as on the stand, only the addresses come from `ipv4_address` and `network[*].ip`.',
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
          { id: 'nochanges', label: bi('Код и облако совпадают', 'The code and the cloud match'), re: 'No changes\\. Your infrastructure matches the configuration', hint: bi('План что-то предлагает изменить. Значит, кто-то менял машины мимо кода или код ещё не применён.', 'The plan proposes something: someone changed the machines behind the code, or the code is not applied yet.') },
        ],
      },
    },
    {
      id: 'ansible',
      kind: 'text',
      step: 'practice',
      title: bi('Шаг 2. Как подготовить узлы и собрать кластер теми же ролями', 'Step 2. How to prepare the nodes and build the cluster with the same roles'),
      body: bi(
        'Роли `k8s_prereq`, `containerd`, `kube_packages`, `kubeadm_init`, `cilium` и `kubeadm_join` переносятся со стенда. На настоящих машинах к ним добавляются четыре вещи.\n\n- Задача command выполняет `swapoff -a` с условием `when: ansible_swaptotal_mb > 0`, потому что удалённая строка в fstab выключает swap только после перезагрузки.\n- Вместо файлов используются модули `ansible.posix.sysctl` и `community.general.modprobe`, которые применяют значения сразу.\n- Ключ репозитория `pkgs.k8s.io` скачивают модулем `ansible.builtin.get_url` и распаковывают командой `gpg --dearmor` с параметром `creates`, а три пакета удерживают от обновления модулем `ansible.builtin.dpkg_selections` с `selection: hold`.\n- Команду join с проверкой CA получают от control plane:\n\n```yaml\n- name: A fresh join command\n  ansible.builtin.command: kubeadm token create --print-join-command\n  register: join_cmd\n  delegate_to: "{{ groups[\'control_plane\'][0] }}"\n  run_once: true\n  changed_when: false\n\n- name: kubeadm join, once\n  ansible.builtin.command:\n    cmd: "{{ join_cmd.stdout }}"\n    creates: /etc/kubernetes/kubelet.conf\n```\n\nКогда `ansible-playbook site.yml` отработает, запустите его второй раз и вставьте ниже итоговую сводку PLAY RECAP.',
        'The `k8s_prereq`, `containerd`, `kube_packages`, `kubeadm_init`, `cilium` and `kubeadm_join` roles move over from the stand. On real machines four things are added to them.\n\n- A command task runs `swapoff -a` with the condition `when: ansible_swaptotal_mb > 0`, because the removed fstab line turns swap off only after a reboot.\n- `ansible.posix.sysctl` and `community.general.modprobe` are used instead of files, and they apply the values at once.\n- The `pkgs.k8s.io` repository key is downloaded with `ansible.builtin.get_url` and unpacked with `gpg --dearmor` with `creates`, and the three packages are held against upgrades with `ansible.builtin.dpkg_selections` and `selection: hold`.\n- The join command with the CA check comes from the control plane:\n\n```yaml\n- name: A fresh join command\n  ansible.builtin.command: kubeadm token create --print-join-command\n  register: join_cmd\n  delegate_to: "{{ groups[\'control_plane\'][0] }}"\n  run_once: true\n  changed_when: false\n\n- name: kubeadm join, once\n  ansible.builtin.command:\n    cmd: "{{ join_cmd.stdout }}"\n    creates: /etc/kubernetes/kubelet.conf\n```\n\nAfter `ansible-playbook site.yml` finishes, run it a second time and paste its PLAY RECAP below.',
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
          { id: 'recap', label: bi('В выводе есть сводка PLAY RECAP по трём узлам', 'There is a PLAY RECAP for three nodes'), re: '(?:^\\S+\\s*:\\s*ok=\\d+.*\\n?){3,}', flags: 'm' },
          { id: 'zero', label: bi('Ни одна задача ничего не изменила', 'Not a single changed'), re: 'changed=[1-9]', absent: true, hint: bi('Какая-то задача описывает действие, а не состояние. Найдите её по строке TASK […], которая стоит выше слова changed.', 'Some task describes an action. Find it by the TASK […] above the word changed.') },
          { id: 'nofail', label: bi('Ни одна задача не завершилась ошибкой, и все узлы доступны', 'Not a single failed or unreachable'), re: '(failed|unreachable)=[1-9]', absent: true },
        ],
      },
    },
    {
      id: 'argo',
      kind: 'text',
      step: 'practice',
      title: bi('Шаг 3. Как выложить приложение через Argo CD', 'Step 3. How to release the application through Argo CD'),
      body: bi(
        'Argo CD ставится в отдельный namespace из манифеста выпуска, и его версию нужно закрепить так же, как всё остальное:\n\n```bash\nkubectl create namespace argocd\nkubectl apply -n argocd --server-side -f https://raw.githubusercontent.com/argoproj/argo-cd/<версия>/manifests/install.yaml\nkubectl -n argocd rollout status deploy argocd-server\n```\n\nApplication `shop` должен брать манифесты из вашего публичного репозитория, устроенного так же, как на стенде. Для проверки тренажёр покажет одноразовый код. Положите этот код в кластер, как подскажет форма проверки ниже, и снимите снимок кластера скриптом: по коду тренажёр убеждается, что снимок сделан в кластере, к которому у вас есть доступ. Скрипт только читает состояние и ничего в кластере не меняет.',
        'Argo CD goes into its own namespace from the release manifest, and its version has to be pinned just like everything else:\n\n```bash\nkubectl create namespace argocd\nkubectl apply -n argocd --server-side -f https://raw.githubusercontent.com/argoproj/argo-cd/<version>/manifests/install.yaml\nkubectl -n argocd rollout status deploy argocd-server\n```\n\nThe Application `shop` must take the manifests from your public repository, laid out as on the stand. For the check the trainer shows a one-time code. Put this code into the cluster as the check form below tells you, and take a snapshot of the cluster with the script: by the code the trainer makes sure the snapshot comes from a cluster you have access to. The script only reads the state and changes nothing in the cluster.',
      ),
    },
    { id: 'check', kind: 'widget', step: 'exit', widget: 'k8s.real-check', props: { track: 'r3', checks: realChecks } },
    {
      id: 'rebuild',
      kind: 'text',
      step: 'exit',
      title: bi('Шаг 4. Как собрать кластер с нуля', 'Step 4. How to build the cluster from scratch'),
      body: bi('Последний шаг трека и есть то, ради чего он задуман. Выполните `terraform destroy`, затем `terraform apply`, возьмите новый инвентарь, прогоните `ansible-playbook site.yml` и создайте Application. Засеките время от пустого облака до состояния Synced, потому что оно войдёт в протокол итогового экзамена курса. Если на узле понадобилась хоть одна ручная команда, перенесите её в роль и пересоздайте кластер ещё раз.', 'The last step of the track is the point of it: `terraform destroy`, then `terraform apply`, a new inventory, `ansible-playbook site.yml` and the Application. Time it from an empty cloud to Synced, because it goes into the protocol of the final course exam. If you needed even one manual command on a node, move it into a role and rebuild once more.'),
    },
    {
      id: 'cleanup',
      kind: 'callout',
      tone: 'cleanup',
      step: 'review',
      title: bi('Уборка обязательна', 'Cleanup — mandatory'),
      body: bi('Трек засчитывается только при трёх условиях. Команда `terraform destroy` должна закончиться строкой `Destroy complete! Resources: N destroyed.`, команда `terraform state list` должна вернуть пустой список, и список машин провайдера с меткой курса тоже должен быть пустым: команда `hcloud server list -l trainer=devops -o json` должна напечатать `[]`. Вставьте ниже вывод двух последних команд.', 'The track does not count without three things: `terraform destroy` with the last line `Destroy complete! Resources: N destroyed.`, an empty `terraform state list` and an empty list of provider machines by label (`hcloud server list -l trainer=devops -o json` must print `[]`). Paste the output of the last two commands below.'),
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
          { id: 'state', label: bi('В state не осталось ресурсов', 'The state is empty'), re: '^\\s*(hcloud_|yandex_|edu_|aws_|module\\.)', absent: true, hint: bi('В state остались ресурсы. Значит, destroy не завершился или часть ресурсов удалили руками, мимо Terraform.', 'Resources are left in the state: destroy did not finish, or some resources were deleted by hand behind Terraform’s back.') },
          { id: 'empty', label: bi('Машин с меткой trainer=devops нет', 'There are no machines labelled trainer=devops'), re: '^\\s*\\[\\s*\\]\\s*$', hint: bi('Список не пуст, и за эти машины продолжают начислять плату. Удалите их и проверьте ещё раз.', 'The list is not empty — the machines are being billed. Delete them and check again.') },
        ],
      },
    },
  ],
};
