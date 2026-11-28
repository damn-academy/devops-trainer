// The course route (00 §2.1) as data. A block module that delivers a block
// with one of these ids replaces the placeholder; until then the route map
// shows the placeholder so the whole course is visible from day one.
// `folder` names the src/blocks/<folder> that owns the block.

import { ROUTE_HOURS } from './route-hours';
import { bi, type Bi } from './i18n';
import type { Level } from './types';

export interface RouteEntry {
  id: string;
  order: number;
  folder: string;
  segment: string;
  title: Bi;
  summary: Bi;
  checklistStep: string | null;
  levels: Record<Level, Bi>;
  hours: Record<Level, number>;
  beginnerOnly?: boolean;
  requires?: string[];
}

export const ROUTE: RouteEntry[] = [
  {
    id: 'orient',
    order: 5,
    folder: 'orientation',
    segment: 'F',
    title: bi('Введение', 'Introduction'),
    summary: bi(
      'Двенадцать опорных понятий: компьютер, программа, файл, ОС, сеть, сервер, клиент и запрос, сборка, версия, окружения, конфигурация, совместная работа над кодом.',
      'Twelve anchor ideas: computer, program, file, OS, network, server, client and request, build, version, environments, configuration, working on code together.',
    ),
    checklistStep: null,
    beginnerOnly: true,
    levels: {
      beginner: bi('Знаете компьютер как пользователь', 'You know computers as a user'),
      intermediate: bi('Закрывается тремя вопросами', 'Closed with three questions'),
      experienced: bi('Закрывается тремя вопросами', 'Closed with three questions'),
    },
    hours: ROUTE_HOURS['orient'] ?? { beginner: 0, intermediate: 0, experienced: 0 },
  },
  {
    id: 'methodology',
    order: 10,
    folder: 'methodology',
    segment: '1',
    title: bi('Методология DevOps', 'DevOps methodology'),
    summary: bi(
      'Зачем бизнесу DevOps, поток работы от идеи до прода, Kanban, CI и CD как идея, инциденты и разбор без поиска виноватых.',
      'Why a business needs DevOps, the flow of work from idea to production, Kanban, CI and CD as ideas, incidents and blameless reviews.',
    ),
    checklistStep: '01',
    levels: {
      beginner: bi('Не работал в IT-команде', 'Never worked in an IT team'),
      intermediate: bi('Видел тикеты, релизы и доски, не различает CI и CD', 'Has seen tickets, releases and boards; does not tell CI from CD'),
      experienced: bi('Работал с пайплайном, участвовал в разборе инцидента', 'Worked with a pipeline, took part in an incident review'),
    },
    hours: ROUTE_HOURS['methodology'] ?? { beginner: 0, intermediate: 0, experienced: 0 },
  },
  {
    id: 'linux',
    order: 20,
    folder: 'linux',
    segment: '2',
    title: bi('Linux', 'Linux'),
    summary: bi(
      'Оболочка, файлы и права, процессы и сигналы, службы и журналы, диски, скрипты, изоляция и лимиты ядра, сеть с точки зрения машины, SSH и своя машина в облаке.',
      'The shell, files and permissions, processes and signals, services and logs, disks, scripts, kernel isolation and limits, the network as a machine sees it, SSH and your own cloud machine.',
    ),
    checklistStep: '02',
    levels: {
      beginner: bi('Только графический интерфейс', 'Graphical interface only'),
      intermediate: bi('Открывал терминал, ставил пакеты по инструкции', 'Has opened a terminal and installed packages by instructions'),
      experienced: bi('Пишет скрипты, не знает systemd, журналов, /proc, ядра', 'Writes scripts; does not know systemd, logs, /proc, the kernel'),
    },
    hours: ROUTE_HOURS['linux'] ?? { beginner: 0, intermediate: 0, experienced: 0 },
  },
  {
    id: 'git-yaml',
    order: 25,
    folder: 'git-cicd',
    segment: '2a',
    title: bi('Git и YAML', 'Git and YAML'),
    summary: bi(
      'Репозиторий, коммит, индекс, ветки, слияние, .gitignore; YAML и его ловушки — до контейнеров, потому что Dockerfile и манифесты живут в репозитории.',
      'Repository, commit, index, branches, merge, .gitignore; YAML and its traps — before containers, because Dockerfiles and manifests live in a repository.',
    ),
    checklistStep: null,
    levels: {
      beginner: bi('Не пользовался Git', 'Has not used Git'),
      intermediate: bi('Коммитил через IDE', 'Has committed from an IDE'),
      experienced: bi('Ветки и merge request, правил CI-файл', 'Branches and merge requests, has edited a CI file'),
    },
    hours: ROUTE_HOURS['git-yaml'] ?? { beginner: 0, intermediate: 0, experienced: 0 },
  },
  {
    id: 'networks',
    order: 30,
    folder: 'networks',
    segment: '3',
    title: bi('Сети', 'Networks'),
    summary: bi(
      'Вы проследите путь запроса через интернет, разберётесь с DNS, DHCP, HTTP, TLS и SSH, настроите маршруты и научитесь искать сетевые неисправности по уровням.',
      'A map of the internet, the layers by hand, OSI and TCP/IP envelopes, DNS, DHCP, NAT, netfilter, HTTP, TLS, SSH, proxies, VPN, networks inside one kernel and layer-by-layer troubleshooting.',
    ),
    checklistStep: '03',
    levels: {
      beginner: bi('Слова «Wi-Fi» и «IP» — бытовые', '"Wi-Fi" and "IP" are everyday words'),
      intermediate: bi('Настраивал роутер, пинговал, не знает подсетей и NAT', 'Has set up a router and pinged; does not know subnets and NAT'),
      experienced: bi('Свободно с HTTP и curl, слаб в маршрутизации, NAT, TLS', 'Fluent with HTTP and curl; weak in routing, NAT, TLS'),
    },
    hours: ROUTE_HOURS['networks'] ?? { beginner: 0, intermediate: 0, experienced: 0 },
  },
  {
    id: 'containers',
    order: 40,
    folder: 'containers',
    segment: '4',
    title: bi('Контейнеры', 'Containers'),
    summary: bi(
      'Вы соберёте контейнер своими руками из механизмов ядра, разберётесь, из каких слоёв состоит образ и как его собрать по Dockerfile, настроите сети и тома, узнаете, чем контейнер отделён от машины и как по этим признакам искать причину поломки и посмотрите, кто запускает контейнеры на узле после команды docker run. Упражнения блока идут в симуляторе Docker прямо в браузере, а в первом уроке сказано, где собрать настоящий образ.',
      'You build a container by hand from the kernel’s mechanisms, see what layers an image consists of and how to build it from a Dockerfile, set up networks and volumes, learn how a container is separated from the machine and how to find the cause of a failure by these signs and see which programs start containers on the node after the docker run command. The block’s exercises run in a Docker simulator right in the browser, and the first lesson tells where to build a real image.',
    ),
    checklistStep: '04',
    levels: {
      beginner: bi('Не запускал контейнеров', 'Has never run a container'),
      intermediate: bi('Запускал docker run по README', 'Has run docker run from a README'),
      experienced: bi('Пишет Dockerfile, не знает bundle, цепочку рантайма, PID 1', 'Writes Dockerfiles; does not know the bundle, the runtime chain, PID 1'),
    },
    hours: ROUTE_HOURS['containers'] ?? { beginner: 0, intermediate: 0, experienced: 0 },
  },
  {
    id: 'cicd',
    order: 50,
    folder: 'git-cicd',
    segment: '5',
    title: bi('CI/CD', 'CI/CD'),
    summary: bi(
      'Удалённый репозиторий, merge request, теги; пайплайн от линта до выкладки, стратегии выкладки, GitLab CI и GitHub Actions.',
      'Remote repository, merge requests, tags; a pipeline from lint to deployment, deployment strategies, GitLab CI and GitHub Actions.',
    ),
    checklistStep: '01',
    levels: {
      beginner: bi('Знает Git по нашему блоку', 'Knows Git from our block'),
      intermediate: bi('Видел зелёные галочки CI', 'Has seen green CI ticks'),
      experienced: bi('Правил CI-файл, не строил пайплайн до выкладки', 'Has edited a CI file, never built a pipeline up to deployment'),
    },
    hours: ROUTE_HOURS['cicd'] ?? { beginner: 0, intermediate: 0, experienced: 0 },
  },
  {
    id: 'k8s-1',
    order: 60,
    folder: 'kubernetes',
    segment: '6',
    title: bi('Kubernetes, этап 1', 'Kubernetes, stage 1'),
    summary: bi(
      'Kubernetes из блоков, цикл согласования, поды, Deployment, Service, сеть Kubernetes, конфигурация, хранилище и доступ — на гибридном кластере в браузере.',
      'Kubernetes from blocks, the reconcile loop, Pods, Deployments, Services, Kubernetes networking, configuration, storage and access — on a hybrid cluster in the browser.',
    ),
    checklistStep: '05',
    requires: ['containers'],
    levels: {
      beginner: bi('Уверенный Docker, кластер не видел', 'Confident with Docker, never seen a cluster'),
      intermediate: bi('kubectl apply по инструкции', 'kubectl apply by instructions'),
      experienced: bi('Сам пишет манифесты и чарты, цель — уровень CKA', 'Writes manifests and charts, aims at CKA level'),
    },
    hours: ROUTE_HOURS['k8s-1'] ?? { beginner: 0, intermediate: 0, experienced: 0 },
  },
  {
    id: 'cicd-k8s',
    order: 65,
    folder: 'git-cicd',
    segment: '6a',
    title: bi('Выкладка в Kubernetes из CI', 'Deploying to Kubernetes from CI'),
    summary: bi(
      'Пайплайн сам выкатывает версию в кластер: ключ узкого аккаунта, неизменяемый тег, ожидание и откат; push- и pull-модели.',
      'The pipeline rolls a version out to the cluster by itself: a narrow account’s key, an immutable tag, waiting and rolling back; the push and the pull model.',
    ),
    checklistStep: '05',
    levels: {
      beginner: bi('Прошёл блоки CI/CD и Kubernetes', 'Has done the CI/CD and Kubernetes blocks'),
      intermediate: bi('Выкатывал в кластер руками', 'Has rolled out to a cluster by hand'),
      experienced: bi('Писал джобы с kubectl или helm', 'Has written jobs with kubectl or helm'),
    },
    hours: ROUTE_HOURS['cicd-k8s'] ?? { beginner: 0, intermediate: 0, experienced: 0 },
    requires: ['cicd', 'k8s-1'],
  },
  {
    id: 'k8s-2',
    order: 70,
    folder: 'kubernetes',
    segment: '7',
    title: bi('Kubernetes, этап 2', 'Kubernetes, stage 2'),
    summary: bi(
      'Один настоящий узел, Helm, Gateway и Ingress, образ из настоящего registry, деплой в кластер из CI.',
      'One real node, Helm, Gateway and Ingress, an image from a real registry, deploying to the cluster from CI.',
    ),
    checklistStep: '05',
    requires: ['k8s-1'],
    levels: {
      beginner: bi('Прошёл этап 1', 'Finished stage 1'),
      intermediate: bi('Прошёл этап 1', 'Finished stage 1'),
      experienced: bi('Прошёл этап 1', 'Finished stage 1'),
    },
    hours: ROUTE_HOURS['k8s-2'] ?? { beginner: 0, intermediate: 0, experienced: 0 },
  },
  {
    id: 'iac',
    order: 80,
    folder: 'iac',
    segment: '8',
    title: bi('Инфраструктура как код на Ansible и Terraform', 'Infrastructure as code with Ansible and Terraform'),
    summary: bi(
      'Ansible: инвентарь, модули, идемпотентность, роли. Terraform: провайдеры, state, plan и apply, дрейф. Четыре исполнителя сверки.',
      'Ansible: inventory, modules, idempotence, roles. Terraform: providers, state, plan and apply, drift. Four reconcilers side by side.',
    ),
    checklistStep: '06',
    levels: {
      beginner: bi('Слышал название', 'Has heard the name'),
      intermediate: bi('Запускал готовый код', 'Has run ready-made code'),
      experienced: bi('Писал небольшие конфигурации, не знает state, ролей, идемпотентности', 'Has written small configs; does not know state, roles, idempotence'),
    },
    hours: ROUTE_HOURS['iac'] ?? { beginner: 0, intermediate: 0, experienced: 0 },
  },
  {
    id: 'k8s-3',
    order: 90,
    folder: 'k8s-code',
    segment: '9',
    title: bi('Кластер через Terraform и Ansible', 'A cluster with Terraform and Ansible'),
    summary: bi(
      'Terraform заказывает три ВМ, Ansible готовит узлы, kubeadm один раз руками, затем ролью; Cilium, хранилище, сертификаты, обновление, etcd snapshot, обязательная уборка.',
      'Terraform orders three VMs, Ansible prepares the nodes, kubeadm once by hand, then as a role; Cilium, storage, certificates, upgrades, etcd snapshots, mandatory cleanup.',
    ),
    checklistStep: '05',
    requires: ['iac', 'k8s-2'],
    levels: {
      beginner: bi('Пошаговый план с готовыми ролями', 'A step-by-step plan with ready-made roles'),
      intermediate: bi('Каркас, остальное сам', 'A skeleton, the rest on your own'),
      experienced: bi('С нуля', 'From scratch'),
    },
    hours: ROUTE_HOURS['k8s-3'] ?? { beginner: 0, intermediate: 0, experienced: 0 },
  },
  {
    id: 'monitoring',
    order: 100,
    folder: 'monitoring',
    segment: '10',
    title: bi('Мониторинг', 'Monitoring'),
    summary: bi(
      'Метрики, PromQL, Grafana, алерты и Alertmanager, логи и трейсы, SLO и burn rate, метрики Kubernetes.',
      'Metrics, PromQL, Grafana, alerts and Alertmanager, logs and traces, SLOs and burn rate, Kubernetes metrics.',
    ),
    checklistStep: '07',
    levels: {
      beginner: bi('Не видел дашбордов', 'Has never seen a dashboard'),
      intermediate: bi('Смотрел готовые дашборды', 'Has looked at ready-made dashboards'),
      experienced: bi('Писал алерты или PromQL, работал с Zabbix', 'Has written alerts or PromQL, worked with Zabbix'),
    },
    hours: ROUTE_HOURS['monitoring'] ?? { beginner: 0, intermediate: 0, experienced: 0 },
  },
  {
    id: 'final',
    order: 110,
    folder: 'career',
    segment: '11',
    title: bi('Смена дежурного и итоговый экзамен', 'On-call shift and final exam'),
    summary: bi(
      'Три инцидента с перекрытием в гибридной среде, затем итоговый экзамен на трёх настоящих ВМ: построить, починить, защитить.',
      'Three overlapping incidents in a hybrid environment, then the final exam on three real VMs: build, fix, defend.',
    ),
    checklistStep: '08',
    levels: {
      beginner: bi('Один экзамен для всех уровней', 'One exam for every level'),
      intermediate: bi('Один экзамен для всех уровней', 'One exam for every level'),
      experienced: bi('Плюс эксплуатация kubeadm', 'Plus kubeadm operations'),
    },
    hours: ROUTE_HOURS['final'] ?? { beginner: 0, intermediate: 0, experienced: 0 },
  },
  {
    id: 'career',
    order: 120,
    folder: 'career',
    segment: '12',
    title: bi('Карьера', 'Career'),
    summary: bi(
      'Идёт параллельно с первого месяца: чтение вакансии, структура ответа, резюме, самопрезентация, мок-интервью, отклики по правилу 60%.',
      'Runs in parallel from the first month: reading a vacancy, structuring an answer, the CV, self-presentation, mock interviews, applying by the 60% rule.',
    ),
    checklistStep: '09–11',
    levels: {
      beginner: bi('Не проходил собеседований в IT', 'Never had an IT interview'),
      intermediate: bi('Нетехнические IT-собеседования', 'Non-technical IT interviews'),
      experienced: bi('Технические собеседования разработчиком или админом', 'Technical interviews as a developer or admin'),
    },
    hours: ROUTE_HOURS['career'] ?? { beginner: 0, intermediate: 0, experienced: 0 },
  },
  {
    id: 'pet-projects',
    order: 130,
    folder: 'pet-projects',
    segment: '13',
    title: bi('Пет-проекты', 'Pet projects'),
    summary: bi(
      'Десять самостоятельных проектов на настоящих машинах: у каждого есть последовательный алгоритм и ссылки на уроки курса, а уровень не выбирается — начните с любого проекта и делайте следующий.',
      'Ten self-driven projects on real machines: each has a sequential algorithm and pointers back to the course lessons, with no level to choose — start with any project and take the next one.',
    ),
    checklistStep: null,
    levels: {
      beginner: bi('Проекты одинаковы для всех уровней', 'The projects are the same for every level'),
      intermediate: bi('Проекты одинаковы для всех уровней', 'The projects are the same for every level'),
      experienced: bi('Проекты одинаковы для всех уровней', 'The projects are the same for every level'),
    },
    hours: ROUTE_HOURS['pet-projects'] ?? { beginner: 0, intermediate: 0, experienced: 0 },
  },
];
