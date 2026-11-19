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
    short: bi('Кластер, который в любой момент можно удалить и поднять заново одной последовательностью команд из репозитория, без ручных шагов.', 'A cluster that can be deleted at any moment and brought up again by one sequence of commands from a repository, with no manual steps.'),
    introducedIn: 'k8s-3.plan',
  },
  {
    id: 'iac.resource-label',
    term: bi('метка ресурса', 'resource label'),
    forms: { ru: ['метки ресурса', 'меткой ресурса', 'метки ресурсов'], en: ['resource labels'] },
    short: bi('Пара «ключ = значение» на облачном ресурсе, по которой его находят, считают и удаляют: trainer=devops на всём, что создаёт курс.', 'A key = value pair on a cloud resource by which it is found, counted and deleted: trainer=devops on everything the course creates.'),
    introducedIn: 'k8s-3.plan',
  },
  {
    id: 'iac.count',
    term: bi('count', 'count'),
    scan: false,
    short: bi('Мета-аргумент ресурса Terraform: сколько одинаковых экземпляров создать; номер экземпляра — count.index, адрес — edu_vm.worker[0].', 'A meta-argument of a Terraform resource: how many identical instances to create; the instance number is count.index, the address edu_vm.worker[0].'),
    introducedIn: 'k8s-3.nodes',
    docRef: { url: 'https://developer.hashicorp.com/terraform/language/meta-arguments/count', label: 'Terraform · count' },
  },
  {
    id: 'iac.output',
    term: bi('output', 'output'),
    scan: false,
    short: bi('Выходное значение конфигурации Terraform: то, что она отдаёт наружу после apply, — адреса, имена, готовый инвентарь для Ansible.', 'An output value of a Terraform configuration: what it hands out after apply — addresses, names, a ready inventory for Ansible.'),
    introducedIn: 'k8s-3.nodes',
    docRef: { url: 'https://developer.hashicorp.com/terraform/language/values/outputs', label: 'Terraform · outputs' },
  },

  {
    id: 'k8s.version-pin',
    term: bi('закреплённая версия', 'pinned version'),
    scan: false,
    forms: { ru: ['закреплённой версии', 'закреплённую версию', 'закреплённые версии'], en: ['pinned versions'] },
    short: bi('Версия пакета, записанная в коде явно: репозиторий одной минорной ветки и удержание пакета, чтобы обновление шло только по решению человека.', 'A package version written in the code explicitly: a repository of one minor branch and a package hold, so that upgrades happen only when a person decides.'),
    introducedIn: 'k8s-3.prepare',
  },
  {
    id: 'k8s.bootstrap-token',
    term: bi('токен присоединения', 'bootstrap token'),
    scan: false,
    forms: { ru: ['токена присоединения', 'токеном присоединения', 'токены присоединения'], en: ['bootstrap tokens'] },
    short: bi('Короткоживущий секрет вида abcdef.0123456789abcdef, по которому новый узел и control plane доверяют друг другу при kubeadm join; по умолчанию живёт 24 часа.', 'A short-lived secret of the form abcdef.0123456789abcdef by which a new node and the control plane trust each other during kubeadm join; lives 24 hours by default.'),
    introducedIn: 'k8s-3.kubeadm',
    docRef: { page: 'help/kubeadm-token', anchor: 'DESCRIPTION' },
  },
  {
    id: 'k8s.kubeadm-config',
    term: bi('конфигурационный файл kubeadm', 'kubeadm configuration file'),
    forms: { ru: ['конфигурационного файла kubeadm', 'конфигурационным файлом kubeadm', 'конфигурационном файле kubeadm'], en: ['kubeadm configuration files'] },
    short: bi('YAML с объектами InitConfiguration, ClusterConfiguration и JoinConfiguration (kubeadm.k8s.io/v1beta4): те же решения, что флаги kubeadm, но в файле, который можно хранить в Git.', 'YAML with InitConfiguration, ClusterConfiguration and JoinConfiguration objects (kubeadm.k8s.io/v1beta4): the same decisions as the kubeadm flags, but in a file that can live in Git.'),
    introducedIn: 'k8s-3.kubeadm',
  },
  {
    id: 'iac.creates',
    term: bi('creates', 'creates'),
    scan: false,
    short: bi('Параметр модулей command и shell: путь к файлу, который появляется после успешной команды. Если файл есть, команда не запускается и задача ok — так команда без модуля становится идемпотентной.', 'A parameter of the command and shell modules: the path of a file that appears after the command succeeds. If the file exists, the command does not run and the task is ok — this is how a command without a module becomes idempotent.'),
    introducedIn: 'k8s-3.as-code',
    docRef: { page: 'ansible-doc/ansible.builtin.command', anchor: 'OPTIONS', line: 'creates' },
  },

  {
    id: 'k8s.argocd-app',
    term: bi('Application', 'Application'),
    scan: false,
    short: bi('Объект Argo CD (argoproj.io/v1alpha1): откуда брать манифесты (репозиторий, ревизия, путь), куда выкладывать и по какой политике синхронизировать.', 'An Argo CD object (argoproj.io/v1alpha1): where to take manifests from (repository, revision, path), where to release them and with which sync policy.'),
    introducedIn: 'k8s-3.gitops',
    docRef: { page: 'web/argo-cd.readthedocs.io/declarative-setup', anchor: 'applications' },
  },
  {
    id: 'k8s.sync-policy',
    term: bi('политика синхронизации', 'sync policy'),
    forms: { ru: ['политики синхронизации', 'политикой синхронизации', 'политику синхронизации'], en: ['sync policies'] },
    short: bi('Поле syncPolicy у Application: синхронизировать ли самому (automated), возвращать ли ручные правки (selfHeal), удалять ли то, что пропало из Git (prune).', 'The syncPolicy field of an Application: whether to sync by itself (automated), whether to undo manual edits (selfHeal), whether to delete what left Git (prune).'),
    introducedIn: 'k8s-3.gitops',
    docRef: { page: 'web/argo-cd.readthedocs.io/auto-sync', anchor: 'automated' },
  },

  {
    id: 'iac.serial',
    term: bi('serial', 'serial'),
    scan: false,
    short: bi('Ключ плея Ansible: сколько хостов проходит весь плей за раз. serial: 1 — узлы по одному, и упавший узел останавливает остальные.', 'A key of an Ansible play: how many hosts go through the whole play at a time. serial: 1 means nodes one by one, and a failed node stops the rest.'),
    introducedIn: 'k8s-3.operate',
  },
];
