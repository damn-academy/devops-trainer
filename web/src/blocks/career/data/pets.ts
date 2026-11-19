// Pet projects (10 §10): the eight projects of the checklist, plus a kubeadm
// cluster as 7b, mapped to the blocks that open them, with measurable
// acceptance criteria and defence questions. Only the structure of the
// checklist is used; the wording and criteria are ours.

import { bi, type Bi } from '../../../core/i18n';
import type { Level } from '../../../core/types';

export interface PetProject {
  id: string;
  n: string;
  title: Bi;
  what: Bi;
  /** Route block ids whose material the project needs. */
  opensAfter: string[];
  required: Level[];
  acceptance: { id: string; text: Bi }[];
  defense: Bi[];
}

const a = (id: string, ru: string, en: string) => ({ id, text: bi(ru, en) });

export const PETS: PetProject[] = [
  {
    id: 'pet1',
    n: '1',
    title: bi('Сайт-визитка в Docker с автоматической выкладкой на VPS', 'A personal site in Docker with auto-deploy to a VPS'),
    what: bi('nginx работает в контейнере, а конвейер CI/CD после каждого push в ветку main выкладывает сайт на вашу машину в облаке.', 'nginx in a container, a CI/CD pipeline, a release to your own cloud machine on every push to main.'),
    opensAfter: ['linux', 'networks', 'containers', 'cicd'],
    required: ['beginner', 'intermediate'],
    acceptance: [
      a('https', 'Сайт открывается по HTTPS с действующим сертификатом', 'The site opens over HTTPS with a valid certificate'),
      a('auto', 'После push в ветку main новая версия выкладывается меньше чем за 5 минут без ручных действий', 'A push to main releases the new version in under 5 minutes with no manual steps'),
      a('version', 'На странице виден SHA последнего коммита, и по нему видно, что на сервер попала нужная версия', 'The page shows the SHA of the last commit, proving the right version is out'),
      a('keys', 'Вход на VPS только по ключу, пароль выключен', 'Login to the VPS by key only, password login off'),
      a('branches', 'Изменения в других ветках не выкладываются', 'Other branches do not deploy'),
    ],
    defense: [bi('Что будет, если выкладка прервётся на середине?', 'What happens if a release fails halfway?'), bi('Как вы получили сертификат и что будет через 90 дней?', 'How did you get the certificate and what happens in 90 days?'), bi('Почему nginx в контейнере, а не на хосте?', 'Why is nginx in a container rather than on the host?')],
  },
  {
    id: 'pet2',
    n: '2',
    title: bi('Telegram-бот с выкладкой в публичное облако', 'A Telegram bot deployed to a public cloud'),
    what: bi('Код бота курс даёт готовым, а ваша часть — Dockerfile, конвейер и выкладка. Программирование в этом проекте не главное.', 'The course’s ready bot code; your part is the Dockerfile, the pipeline and the release. Programming is not the point here.'),
    opensAfter: ['containers', 'cicd'],
    required: [],
    acceptance: [
      a('size', 'Образ меньше 150 МБ, собран многоэтапной сборкой, и процесс работает не от root', 'The image is under 150 MB, a multi-stage build, the process does not run as root'),
      a('secret', 'Токен бота хранится не в репозитории, а в секретах конвейера или в хранилище секретов', 'The bot token is not in the repository: a pipeline secret or a secret store'),
      a('restart', 'Бот сам запускается заново после аварийного завершения', 'The bot comes back by itself after a crash'),
      a('logs', 'Журнал бота виден в облаке', 'The bot’s log is visible in the cloud'),
    ],
    defense: [bi('Где хранится токен и кто его может прочитать?', 'Where is the token stored and who can read it?'), bi('Что делает многоэтапная сборка с размером образа?', 'What does a multi-stage build do to the image size?')],
  },
  {
    id: 'pet3',
    n: '3',
    title: bi('Интерфейс, сервер приложения и база в docker compose с конвейером', 'A frontend, a backend and a database in docker compose with a pipeline'),
    what: bi('Три сервиса, которые запускаются одной командой. На этом проекте построен итоговый экзамен.', 'Three services that start with one command; this is the base of the final exam.'),
    opensAfter: ['containers', 'cicd'],
    required: ['beginner', 'intermediate', 'experienced'],
    acceptance: [
      a('up', '`docker compose up` запускает всё с нуля одной командой', '`docker compose up` brings everything up from scratch with one command'),
      a('volume', 'Данные базы сохраняются после `down` и `up`', 'Database data survives `down` and `up`'),
      a('health', 'У сервисов есть healthcheck, и сервер приложения ждёт, пока база будет готова', 'Services have healthchecks; the backend waits for the database to be ready'),
      a('ci', 'Конвейер собирает и тестирует все три образа', 'The pipeline builds and tests all three images'),
      a('stdout', 'Журналы всех сервисов идут в stdout', 'Every service logs to stdout'),
    ],
    defense: [bi('Что будет с данными, если удалить контейнер базы?', 'What happens to the data if you remove the database container?'), bi('Чем `depends_on` с условием готовности отличается от простого порядка запуска?', 'How does `depends_on` with a readiness condition differ from a plain start order?')],
  },
  {
    id: 'pet4',
    n: '4',
    title: bi('VPN-сервер на VPS: WireGuard и nftables', 'A VPN server on a VPS: WireGuard and nftables'),
    what: bi('Собственный VPN: клиент выходит в интернет через вашу машину, а на самой машине открыты только нужные порты.', 'Your own VPN: the client reaches the internet through your machine, and the machine exposes only the ports it needs.'),
    opensAfter: ['linux', 'networks'],
    required: ['beginner', 'intermediate'],
    acceptance: [
      a('connect', 'Клиент подключается, и его внешний адрес совпадает с адресом VPS', 'The client connects, and its external address equals the VPS address'),
      a('ports', 'На VPS открыты только SSH и порт VPN', 'Only SSH and the VPN port are open on the VPS'),
      a('persist', 'Правила межсетевого экрана сохраняются после перезагрузки', 'The firewall rules survive a reboot'),
      a('handshake', '`wg show` показывает свежее рукопожатие', '`wg show` shows a fresh handshake'),
    ],
    defense: [bi('Как пакет клиента попадает в интернет через VPS и какие правила NAT за это отвечают?', 'How does a client packet reach the internet through the VPS, and which NAT rules do it?'), bi('На каком уровне работает WireGuard?', 'At which layer does WireGuard work?')],
  },
  {
    id: 'pet5',
    n: '5',
    title: bi('Автоматизация: Terraform создаёт машины, Ansible их настраивает', 'Automation: Terraform creates the machines, Ansible configures them'),
    what: bi('Один запуск приводит чистую машину к состоянию проекта 1 или 3, а повторный запуск ничего не меняет.', 'A clean machine reaches the state of project 1 or 3 in one run; a second run changes nothing.'),
    opensAfter: ['iac'],
    required: ['intermediate', 'experienced'],
    acceptance: [
      a('tf', 'Машины создаёт Terraform, и повторный `terraform plan` показывает No changes', 'Terraform creates the machines; a repeated `terraform plan` says No changes'),
      a('roles', 'Плейбук с ролями приводит чистую машину к состоянию проекта 1 или 3', 'A playbook with roles brings a clean machine to the state of project 1 or 3'),
      a('idem', 'Второй запуск плейбука показывает changed=0', 'The second playbook run: changed=0'),
      a('vault', 'Секреты в ansible-vault, не открытым текстом', 'Secrets in ansible-vault, not in plain text'),
    ],
    defense: [bi('Что значит идемпотентность и где она у вас нарушалась?', 'What does idempotence mean, and where did your playbook break it?'), bi('Что вы сделаете, если кто-то поменял машину руками?', 'What do you do if someone changed the machine by hand?')],
  },
  {
    id: 'pet6',
    n: '6',
    title: bi('Мониторинг: Prometheus и Grafana', 'Monitoring: Prometheus and Grafana'),
    what: bi('Метрики и алерты для проекта 1 или 3, благодаря которым вы узнаёте о сбое раньше пользователя.', 'Metrics and alerts for project 1 or 3: users are not the first to learn about a failure.'),
    opensAfter: ['monitoring'],
    required: ['beginner', 'intermediate', 'experienced'],
    acceptance: [
      a('golden', 'Дашборд с четырьмя золотыми сигналами: задержка, трафик, ошибки, насыщение', 'A dashboard with the four golden signals: latency, traffic, errors, saturation'),
      a('node', 'node_exporter собирает метрики машины', 'node_exporter collects the machine’s metrics'),
      a('alerts', 'Алерты на долю ошибок и на заполнение диска с `for:`', 'Alerts on the error ratio and on disk filling, with `for:`'),
      a('notify', 'Алерт приходит в мессенджер', 'The alert arrives in a messenger'),
    ],
    defense: [bi('Почему алерт по симптому лучше алерта по причине?', 'Why is an alert on a symptom better than one on a cause?'), bi('Что будет, если выйдет из строя машина, на которой работает сам Prometheus?', 'What happens if the machine running Prometheus goes down?')],
  },
  {
    id: 'pet7',
    n: '7',
    title: bi('Кластер с Helm и Argo CD', 'A cluster with Helm and Argo CD'),
    what: bi('Приложение проекта 3, упакованное в Helm-чарт, работает в кластере на одной машине, а выкладывается изменением в Git.', 'Project 3’s application as a Helm chart in a single-machine cluster; a release is a change in Git.'),
    opensAfter: ['k8s-2'],
    required: ['beginner', 'intermediate', 'experienced'],
    acceptance: [
      a('chart', 'Приложение упаковано в Helm-чарт, а образ собран вашим конвейером и лежит в настоящем реестре образов', 'The application is a Helm chart; the image is built by your CI and lives in a real registry'),
      a('ingress', 'Запросы входят в кластер через Ingress или Gateway', 'Traffic comes in through an Ingress or a Gateway'),
      a('gitops', 'Argo CD синхронизирует кластер с Git, и изменение values.yaml выкладывается без kubectl', 'Argo CD syncs from Git: a change to values.yaml is released without kubectl'),
      a('probes', 'У всех контейнеров заданы проверки (probes) и ресурсы', 'Every container has probes and resources set'),
    ],
    defense: [bi('Что будет, если кто-то сделает `kubectl edit` в обход Git?', 'What happens if someone runs `kubectl edit` bypassing Git?'), bi('Как откатить выкладку?', 'How do you roll back a release?')],
  },
  {
    id: 'pet7b',
    n: '7b',
    title: bi('kubeadm-кластер своими руками', 'A kubeadm cluster by hand'),
    what: bi('Кластер из трёх машин без готового дистрибутива: всё, что за вас делал k3s, вы делаете своими руками.', 'Three machines, a cluster without a ready distribution: everything k3s did for you, by hand.'),
    opensAfter: ['k8s-3'],
    required: ['experienced'],
    acceptance: [
      a('nodes', 'Одна управляющая машина и две рабочие, все Ready', 'One control-plane machine and two workers, all Ready'),
      a('cni', 'Установлены сетевой плагин и класс хранилища', 'A network plugin and a storage class are installed'),
      a('etcd', 'Снимок etcd по расписанию и проверенное восстановление', 'A scheduled etcd snapshot and a tested restore'),
      a('upgrade', 'Обновление на следующую минорную версию', 'An upgrade to the next minor version'),
      a('cleanup', 'Машины удалены после работы', 'The machines are deleted afterwards'),
    ],
    defense: [bi('Что вы сделаете, если истёк сертификат API-сервера?', 'What do you do if the API server certificate expired?'), bi('Как восстановить etcd из снимка?', 'How do you restore etcd from a snapshot?')],
  },
  {
    id: 'pet8',
    n: '8',
    title: bi('Оператор для Kubernetes', 'A Kubernetes operator'),
    what: bi('Собственный ресурс (CRD) и контроллер, который приводит кластер к состоянию, описанному в этом ресурсе.', 'Your own resource (a CRD) and a controller that brings the cluster to the state it describes.'),
    opensAfter: ['k8s-3'],
    required: [],
    acceptance: [
      a('crd', 'CRD со схемой валидации', 'A CRD with a validation schema'),
      a('converge', 'Контроллер восстанавливает состояние после вмешательства: удалённый зависимый объект появляется снова', 'The controller converges after disturbances: a deleted dependent object comes back'),
      a('noop', 'Когда всё совпадает, контроллер ничего не делает и не создаёт дублей', 'When everything matches, the controller does nothing and creates no duplicates'),
      a('owner', 'У зависимых объектов стоят ownerReferences', 'Dependent objects carry ownerReferences'),
    ],
    defense: [bi('Почему контроллер сравнивает состояние, а не реагирует на события по одному?', 'Why does a controller compare state instead of reacting to events one by one?')],
  },
];

/** Recommended order per level (10 §10). */
export const PET_PATHS: Record<Level, string[]> = {
  beginner: ['pet1', 'pet3', 'pet4', 'pet6', 'pet7'],
  intermediate: ['pet1', 'pet3', 'pet4', 'pet5', 'pet6', 'pet7'],
  experienced: ['pet3', 'pet5', 'pet6', 'pet7', 'pet7b'],
};

/** The README every pet project carries (10 §10); "what broke" matters most at an interview. */
export const README_TEMPLATE = `# <Project name>

## What it is and why
One paragraph: what the project does and which skill it proves.

## Diagram
Boxes and arrows: what talks to what, which ports, where data lives.

## How to run
The exact commands from a clean machine.

## Decisions and why
Each choice and the alternative you rejected.

## What broke on the way and how I fixed it
The most valuable part for an interview: symptom, evidence, cause, fix.

## What I would do next
`;
