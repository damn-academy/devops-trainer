// Concepts of block 9 "A cluster from code" (06 §6, 05 §11.4). The block
// builds on IaC (resources, state, playbooks, roles) and on the manual
// kubeadm track of Kubernetes stage 2 (kubeadm, static pods, the CNI).

import { bi } from '../../../core/i18n';
import type { Concept } from '../../../core/types';

export const CONCEPTS: Concept[] = [
  {
    id: 'k8s.rebuildable',
    term: bi('пересоздаваемый кластер', 'rebuildable cluster'),
    forms: { ru: ['пересоздаваемого кластера', 'пересоздаваемым кластером', 'пересоздаваемом кластере'], en: ['rebuildable clusters'] },
    short: bi('Кластер, который можно в любой момент удалить и собрать заново одной последовательностью команд из репозитория, не сделав ни одного шага руками.', 'A cluster that can be deleted at any moment and brought up again by one sequence of commands from a repository, with no manual steps.'),
    introducedIn: 'k8s-3.plan',
  },
  {
    id: 'iac.resource-label',
    term: bi('метка ресурса', 'resource label'),
    forms: { ru: ['метки ресурса', 'меткой ресурса', 'метки ресурсов'], en: ['resource labels'] },
    short: bi('Пара «ключ = значение» на облачном ресурсе, по которой этот ресурс находят, считают и удаляют. Курс ставит метку trainer=devops на всё, что создаёт.', 'A key = value pair on a cloud resource by which it is found, counted and deleted: trainer=devops on everything the course creates.'),
    introducedIn: 'k8s-3.plan',
  },
  {
    id: 'iac.count',
    term: bi('count', 'count'),
    scan: false,
    short: bi('Мета-аргумент ресурса Terraform, который говорит, сколько одинаковых экземпляров создать из одного блока. Номер экземпляра даёт выражение count.index, а в state экземпляр получает адрес вида edu_vm.worker[0].', 'A meta-argument of a Terraform resource: how many identical instances to create; the instance number is count.index, the address edu_vm.worker[0].'),
    introducedIn: 'k8s-3.nodes',
    docRef: { url: 'https://developer.hashicorp.com/terraform/language/meta-arguments/count', label: 'Terraform · count' },
  },
  {
    id: 'iac.output',
    term: bi('output', 'output'),
    scan: false,
    short: bi('Выходное значение конфигурации Terraform. Через него конфигурация после apply отдаёт наружу то, что стало известно при создании ресурсов: адреса, имена или готовый инвентарь для Ansible.', 'An output value of a Terraform configuration: what it hands out after apply — addresses, names, a ready inventory for Ansible.'),
    introducedIn: 'k8s-3.nodes',
    docRef: { url: 'https://developer.hashicorp.com/terraform/language/values/outputs', label: 'Terraform · outputs' },
  },

  {
    id: 'k8s.version-pin',
    term: bi('закреплённая версия', 'pinned version'),
    scan: false,
    forms: { ru: ['закреплённой версии', 'закреплённую версию', 'закреплённые версии'], en: ['pinned versions'] },
    short: bi('Версия пакета, которую явно записали в коде. Пакет ставят из репозитория одной минорной ветки и удерживают от обновления, чтобы новая версия приходила только по решению человека.', 'A package version written in the code explicitly: a repository of one minor branch and a package hold, so that upgrades happen only when a person decides.'),
    introducedIn: 'k8s-3.prepare',
  },
  {
    id: 'k8s.bootstrap-token',
    term: bi('токен присоединения', 'bootstrap token'),
    scan: false,
    forms: { ru: ['токена присоединения', 'токеном присоединения', 'токены присоединения'], en: ['bootstrap tokens'] },
    short: bi('Секрет вида abcdef.0123456789abcdef с коротким сроком действия. Новый узел предъявляет его control plane при kubeadm join, и по нему control plane решает, что узлу можно доверять. По умолчанию токен действует 24 часа.', 'A short-lived secret of the form abcdef.0123456789abcdef. A new node presents it to the control plane during kubeadm join, and by it the control plane decides to trust the node. By default it is valid for 24 hours.'),
    introducedIn: 'k8s-3.kubeadm',
    docRef: { page: 'help/kubeadm-token', anchor: 'DESCRIPTION' },
  },
  {
    id: 'k8s.kubeadm-config',
    term: bi('конфигурационный файл kubeadm', 'kubeadm configuration file'),
    forms: { ru: ['конфигурационного файла kubeadm', 'конфигурационным файлом kubeadm', 'конфигурационном файле kubeadm'], en: ['kubeadm configuration files'] },
    short: bi('Файл YAML с объектами InitConfiguration, ClusterConfiguration и JoinConfiguration (kubeadm.k8s.io/v1beta4). В нём записаны те же решения, что и во флагах kubeadm, но такой файл можно хранить в Git.', 'YAML with InitConfiguration, ClusterConfiguration and JoinConfiguration objects (kubeadm.k8s.io/v1beta4): the same decisions as the kubeadm flags, but in a file that can be kept in Git.'),
    introducedIn: 'k8s-3.kubeadm',
  },
  {
    id: 'iac.creates',
    term: bi('creates', 'creates'),
    scan: false,
    short: bi('Параметр модулей command и shell, в котором указан путь к файлу, появляющемуся после успешного выполнения команды. Если такой файл уже есть, команда не запускается, а задача отвечает ok. Так команда, для которой нет своего модуля, становится идемпотентной.', 'A parameter of the command and shell modules: the path of a file that appears after the command succeeds. If the file exists, the command does not run and the task is ok — this is how a command without a module becomes idempotent.'),
    introducedIn: 'k8s-3.as-code',
    docRef: { page: 'ansible-doc/ansible.builtin.command', anchor: 'OPTIONS', line: 'creates' },
  },

  {
    id: 'k8s.argocd-app',
    term: bi('Application', 'Application'),
    scan: false,
    short: bi('Объект Argo CD (argoproj.io/v1alpha1), который говорит контроллеру, откуда брать манифесты (репозиторий, ревизию и путь), куда их выкладывать и по какой политике синхронизировать.', 'An Argo CD object (argoproj.io/v1alpha1): where to take manifests from (repository, revision, path), where to release them and with which sync policy.'),
    introducedIn: 'k8s-3.gitops',
    docRef: { page: 'web/argo-cd.readthedocs.io/declarative-setup', anchor: 'applications' },
  },
  {
    id: 'k8s.sync-policy',
    term: bi('политика синхронизации', 'sync policy'),
    forms: { ru: ['политики синхронизации', 'политикой синхронизации', 'политику синхронизации'], en: ['sync policies'] },
    short: bi('Поле syncPolicy у Application. Оно решает, синхронизирует ли контроллер изменения сам (automated), возвращает ли к Git ручные правки (selfHeal) и удаляет ли объекты, пропавшие из Git (prune).', 'The syncPolicy field of an Application: whether to sync by itself (automated), whether to undo manual edits (selfHeal), whether to delete what left Git (prune).'),
    introducedIn: 'k8s-3.gitops',
    docRef: { page: 'web/argo-cd.readthedocs.io/auto-sync', anchor: 'automated' },
  },

  {
    id: 'iac.serial',
    term: bi('serial', 'serial'),
    scan: false,
    short: bi('Ключ плея Ansible, который задаёт, сколько хостов проходят весь плей за один раз. При serial: 1 узлы обрабатываются по одному, и если на одном узле плей завершился ошибкой, он останавливается и не трогает остальные.', 'A key of an Ansible play: how many hosts go through the whole play at a time. With serial: 1 the nodes go one by one, and if one fails, the play stops and leaves the rest alone.'),
    introducedIn: 'k8s-3.operate',
  },
];
