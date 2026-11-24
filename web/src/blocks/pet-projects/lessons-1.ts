// Pet projects 1–5: the personal site, the CI pipeline, monitoring, the
// container service and the single-node cluster. Every lesson is one
// independent project: an intro, a sequential algorithm with no recipes, a
// “where to recall” list of course links and the honest note (shared.ts).

import { bi } from '../../core/i18n';
import type { Lesson } from '../../core/types';
import { HONEST_NOTE } from './shared';

const SRC_SITE = {
  en: [
    { title: 'Let’s Encrypt — Getting Started', url: 'https://letsencrypt.org/getting-started/' },
    { title: 'nginx documentation', url: 'https://nginx.org/en/docs/' },
  ],
  ru: [
    { title: 'Let’s Encrypt — Начало работы', url: 'https://letsencrypt.org/ru/getting-started/' },
    { title: 'Документация nginx', url: 'https://nginx.org/ru/docs/' },
  ],
};

const SRC_CI = {
  en: [{ title: 'GitHub Docs — Quickstart for GitHub Actions', url: 'https://docs.github.com/en/actions/quickstart' }],
  ru: [{ title: 'Документация GitHub — Начало работы с GitHub Actions', url: 'https://docs.github.com/ru/actions/quickstart' }],
};

const SRC_MONITORING = {
  en: [
    { title: 'Prometheus — Getting started', url: 'https://prometheus.io/docs/prometheus/latest/getting_started/' },
    { title: 'Grafana documentation', url: 'https://grafana.com/docs/grafana/latest/' },
  ],
  ru: [{ title: 'Prometheus — Википедия', url: 'https://ru.wikipedia.org/wiki/Prometheus' }],
};

const SRC_COMPOSE = {
  en: [{ title: 'Docker Compose overview', url: 'https://docs.docker.com/compose/' }],
  ru: [{ title: 'Docker — Википедия', url: 'https://ru.wikipedia.org/wiki/Docker' }],
};

const SRC_K8S = {
  en: [{ title: 'K3s documentation', url: 'https://docs.k3s.io/' }],
  ru: [{ title: 'Установка Kubernetes — kubernetes.io', url: 'https://kubernetes.io/ru/docs/setup/' }],
};

export const PET_LESSONS_1: Lesson[] = [
  {
    id: 'pet-projects.site',
    block: 'pet-projects',
    title: bi('Личный сайт на виртуальной машине', 'A personal site on a virtual machine'),
    summary: bi(
      'Арендуйте виртуальный сервер, опубликуйте на нём небольшой сайт под собственным доменом и настройте HTTPS с автоматическим продлением сертификата.',
      'Rent a virtual server, publish a small site on it under your own domain and set up HTTPS with automatic certificate renewal.',
    ),
    introduces: ['pet.algorithm', 'pet.acceptance'],
    uses: ['linux.ssh-key', 'linux.unit', 'net.dns', 'net.tls', 'net.cert'],
    tier: 'core',
    minutes: 30,
    sources: SRC_SITE,
    sections: [
      {
        id: 'hook',
        kind: 'text',
        step: 'hook',
        body: bi(
          'Цель проекта — небольшой сайт на собственной виртуальной машине, который открывается по вашему домену по HTTPS, а сертификат продлевается без вашего участия. Результат виден каждому, кому вы дадите ссылку, поэтому проект становится первой строчкой резюме и первой историей для собеседования. Курс не даёт готового рецепта. Ниже лежит только [[pet.algorithm|последовательный алгоритм]] — порядок шагов с вопросами, которые вы решаете самостоятельно, а в конце страницы — список уроков, где можно вспомнить материал.',
          'The goal is a small site on your own virtual machine that opens at your domain over HTTPS, with the certificate renewing without your involvement. Anyone you give the link can see the result, so the project becomes the first line of your CV and your first story for an interview. The course gives no ready recipe. Below is only a [[pet.algorithm|sequential algorithm]] — an order of steps with questions you answer on your own — and at the end of the page a list of lessons where you can recall the material.',
        ),
      },
      {
        id: 'algorithm',
        kind: 'text',
        step: 'practice',
        title: bi('Порядок работы', 'The order of work'),
        body: bi(
          '1. Арендуйте недорогую виртуальную машину у облачного провайдера. Выберите дистрибутив и размер машины и запишите, чем обоснован ваш выбор.\n2. Подключитесь к машине по SSH с ключом, отключите вход по паролю и обновите системные пакеты. Продумайте, как вы не потеряете доступ, если эксперимент пойдёт не так.\n3. Установите веб-сервер и опубликуйте одну страницу с коротким рассказом о себе и ссылками на проекты. Решите, в каком каталоге будет лежать сайт и от чьего имени будет работать сервис.\n4. Зарегистрируйте домен или возьмите бесплатное имя и настройте запись DNS так, чтобы имя указывало на адрес вашей машины. Выясните, как быстро обновляется запись у вашего провайдера DNS.\n5. Выпустите сертификат и настройте HTTPS с перенаправлением всех запросов с порта 80 на порт 443. Продумайте, как сертификат будет продлеваться без вашего участия, и проверьте продление на практике.\n6. Оформите веб-сервер как службу под управлением systemd, чтобы сайт работал снова после перезагрузки машины, и найдите его журнал.\n7. Проверьте [[pet.acceptance|критерии приёмки]] с другого устройства и через мобильную сеть: сайт открывается по HTTPS, браузер не показывает предупреждения о сертификате, а после перезагрузки машины всё работает снова. Запишите в README проекта, что сломалось по дороге и как вы это чинили.',
          '1. Rent a cheap virtual machine from a cloud provider. Choose the distribution and the size, and write down what justifies your choice.\n2. Connect to the machine over SSH with a key, disable password login and update the system packages. Plan how you will keep access if an experiment goes wrong.\n3. Install a web server and publish one page with a short story about yourself and links to your projects. Decide which directory the site will live in and which account the service will run as.\n4. Register a domain or take a free name and set the DNS record so the name points at your machine. Find out how fast the record updates at your DNS provider.\n5. Issue a certificate and set up HTTPS with all requests redirected from port 80 to port 443. Plan how the certificate will be renewed without your involvement, and test the renewal for real.\n6. Declare the web server as a systemd service so the site comes back after a reboot, and find its journal.\n7. Check the [[pet.acceptance|acceptance criteria]] from another device over a mobile network: the site opens over HTTPS, the browser shows no certificate warnings, and everything works again after a reboot. Write in the project README what broke on the way and how you fixed it.',
        ),
      },
      {
        id: 'recall',
        kind: 'text',
        step: 'review',
        title: bi('Где вспомнить', 'Where to recall'),
        body: bi(
          '- [[linux.ssh-key|Пара ключей SSH]] вводится в уроке о подключении к своей машине. Вспомните, как устроен вход по ключу и почему пароль отключают.\n- [[linux.unit|Unit-файл systemd]] вводится в уроке о службах. Вернитесь к нему, чтобы сайт переживал перезагрузку машины.\n- [[net.dns|DNS]] и ресурсные записи разбираются в сетевом блоке. Там вы вспомните, как имя превращается в адрес.\n- [[net.tls|TLS]] и [[net.cert|сертификат]] объясняются в уроке о шифровании. Заодно вспомните, кто и как продлевает сертификаты.',
          '- The [[linux.ssh-key|SSH key pair]] is introduced in the lesson about connecting to your own machine. Recall how key login works and why the password is disabled.\n- The [[linux.unit|systemd unit file]] is introduced in the lesson about services. Go back to it so the site survives a reboot.\n- [[net.dns|DNS]] and resource records are covered in the networks block. There you will recall how a name turns into an address.\n- [[net.tls|TLS]] and the [[net.cert|certificate]] are explained in the lesson about encryption. While there, recall who renews certificates and how.',
        ),
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
    ],
  },
  {
    id: 'pet-projects.ci',
    block: 'pet-projects',
    title: bi('Конвейер для маленького приложения', 'A pipeline for a tiny app'),
    summary: bi(
      'Возьмите маленькое приложение с тестами и настройте конвейер, который проверяет каждый push и собирает архив с программой только после зелёных проверок.',
      'Take a tiny app with tests and set up a pipeline that checks every push and builds the program archive only after the checks go green.',
    ),
    introduces: [],
    uses: ['pet.algorithm', 'pet.acceptance', 'git.remote', 'git.mr', 'cicd.pipeline-file', 'cicd.job', 'cicd.stage'],
    tier: 'core',
    minutes: 25,
    sources: SRC_CI,
    sections: [
      {
        id: 'hook',
        kind: 'text',
        step: 'hook',
        body: bi(
          'Цель проекта — собственный конвейер непрерывной интеграции для программы, которую вы написали сами: генератора страниц, скрипта обработки файлов или чего-то ещё маленького. Результат выглядит так. После каждого отправленного коммита запускаются проверки, у последнего коммита горит зелёная или красная метка, а у принятого изменения появляется архив с готовой программой. Курс даёт [[pet.algorithm|последовательный алгоритм]] и ссылки на уроки для повторения, а команды и конфигурацию конвейера вы составляете самостоятельно.',
          'The goal is your own continuous integration pipeline for a program you wrote yourself: a page generator, a file-processing script or something equally small. The result looks like this. After every pushed commit checks run, the latest commit shows a green or red mark, and every accepted change gets an archive with the ready program. The course gives a [[pet.algorithm|sequential algorithm]] and links to lessons for review; the pipeline commands and configuration you write on your own.',
        ),
      },
      {
        id: 'algorithm',
        kind: 'text',
        step: 'practice',
        title: bi('Порядок работы', 'The order of work'),
        body: bi(
          '1. Напишите или возьмите маленькое приложение с несколькими тестами и поместите его в свой репозиторий на выбранной платформе. Решите, чем эта платформа обоснована для учебного проекта.\n2. Добавьте к репозиторию файл конвейера с двумя стадиями: проверка кода и запуск тестов на каждый push, а сборка архива с программой только после прохождения тестов. Выясните, как вторая стадия узнаёт о результатах первой.\n3. Настройте ветку, в которую изменения попадают только через [[git.mr|merge request]], и запретите слияние, пока конвейер красный.\n4. Намеренно сломайте тест, отправьте коммит и посмотрите, как конвейер сообщает о сбое и что при этом пишет платформа. Затем почините тест и убедитесь, что метка снова зелёная.\n5. Соберите архив программы как артефакт конвейера и скачайте его на чистую машину, чтобы проверить, что программа запускается без вашего ноутбука.\n6. Заполните README по шаблону: схема конвейера, как запустить проверки на своей машине, что сломалось по дороге и как вы это чинили.',
          '1. Write or take a small app with a few tests and put it in your repository on the platform you choose. Decide what makes that platform the right one for a training project.\n2. Add a pipeline file with two stages: code checks and tests on every push, and the program archive built only after the tests pass. Find out how the second stage learns the result of the first.\n3. Set up a branch that accepts changes only through a [[git.mr|merge request]], and forbid merging while the pipeline is red.\n4. Break a test on purpose, push the commit and watch how the pipeline reports the failure and what the platform prints. Then fix the test and make sure the mark is green again.\n5. Build the program archive as a pipeline artifact and download it to a clean machine to check that the program runs without your laptop.\n6. Fill in the README from the template: a pipeline diagram, how to run the checks on your own machine, what broke on the way and how you fixed it.',
        ),
      },
      {
        id: 'recall',
        kind: 'text',
        step: 'review',
        title: bi('Где вспомнить', 'Where to recall'),
        body: bi(
          '- [[git.remote|Удалённый репозиторий]] вводится в уроке о совместной работе. Вспомните, как изменения попадают с ноутбука на сервер.\n- [[git.mr|Merge request]] разбирается там же, в уроке о совместной работе. Вернитесь к защищённым веткам и правилам слияния.\n- [[cicd.pipeline-file|Файл конвейера]] и [[cicd.stage|стадии]] вводятся в блоке CI/CD. Вспомните, из каких частей состоит пайплайн.\n- [[cicd.job|Джоба]] и раннер объясняются в том же блоке. Там вы узнаете, где физически выполняются проверки.',
          '- The [[git.remote|remote repository]] is introduced in the lesson about working together. Recall how changes travel from the laptop to the server.\n- The [[git.mr|merge request]] is covered in the same lesson. Go back to protected branches and merge rules.\n- The [[cicd.pipeline-file|pipeline file]] and [[cicd.stage|stages]] are introduced in the CI/CD block. Recall what parts a pipeline consists of.\n- The [[cicd.job|job]] and the runner are explained in the same block. There you learn where the checks physically run.',
        ),
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
    ],
  },
  {
    id: 'pet-projects.monitoring',
    block: 'pet-projects',
    title: bi('Мониторинг личного сайта', 'Monitoring the personal site'),
    summary: bi(
      'Установите рядом с личным сайтом систему сбора метрик, соберите показатели машины и сайта, нарисуйте дашборд и настройте оповещения, которые приходят вам лично.',
      'Install a metrics collector next to the personal site, gather machine and site metrics, draw a dashboard and configure alerts that reach you personally.',
    ),
    introduces: [],
    uses: ['pet.algorithm', 'pet.acceptance', 'obs.scrape', 'obs.series', 'obs.gauge', 'obs.alert-rule', 'net.cert'],
    tier: 'core',
    minutes: 30,
    sources: SRC_MONITORING,
    sections: [
      {
        id: 'hook',
        kind: 'text',
        step: 'hook',
        body: bi(
          'Первый проект дал вам сайт, который работает, пока вы на него смотрите. Теперь вы узнаете о его проблемах раньше посетителей: закончилось место на диске, остановилась служба, сертификат подходит к концу срока. Результат выглядит как дашборд с графиками и сообщение в мессенджере, когда что-то идёт не так. Проект опирается на личный сайт из первого проекта, но подойдёт любая машина, которая у вас уже есть.',
          'The first project gave you a site that works while you watch it. Now you learn about its problems before the visitors do: the disk runs out of space, a service stops, the certificate nears its end. The result is a dashboard with graphs and a message to your messenger when something goes wrong. The project builds on the personal site from the first project, but any machine you already have will do.',
        ),
      },
      {
        id: 'algorithm',
        kind: 'text',
        step: 'practice',
        title: bi('Порядок работы', 'The order of work'),
        body: bi(
          '1. Решите, какие три-четыре метрики машины и сайта для вас важны, и запишите почему. Начните с очевидного: доступность сайта по сети, свободное место на диске, нагрузка на машину.\n2. Установите систему сбора метрик и настройте её так, чтобы она регулярно опрашивала вашу машину и сам сайт. Выясните, как задаётся адрес опрашиваемой цели и как часто проходит опрос.\n3. Запустите рядом систему визуализации, подключите её к собранным метрикам и соберите один дашборд, на котором состояние машины и сайта видно одним взглядом.\n4. Напишите три правила оповещения: сайт не отвечает, место на диске кончается, срок [[net.cert|сертификата]] истекает. Настройте доставку оповещений в мессенджер или на почту и проверьте каждое правило на практике.\n5. Для учебного сбоя остановите веб-сервер или заполните диск временным файлом. Засеките, сколько минут проходит от сбоя до сообщения, и запишите это время в README.\n6. Верните всё в рабочее состояние и убедитесь, что оповещение отступило. Заполните README по шаблону, включая раздел о том, что сломалось по дороге.',
          '1. Decide which three or four metrics of the machine and the site matter to you, and write down why. Start with the obvious: the site reachable over the network, free disk space, the machine load.\n2. Install a metrics collection system and configure it to poll your machine and the site itself on a schedule. Find out how the target address is set and how often the poll runs.\n3. Run a visualization system next to it, connect it to the collected metrics and build one dashboard where the state of the machine and the site is visible at a glance.\n4. Write three alert rules: the site does not answer, disk space is running out, the [[net.cert|certificate]] has expired. Set up alert delivery to a messenger or e-mail and test every rule for real.\n5. For a training failure, stop the web server or fill the disk with a temporary file. Time how many minutes pass from the failure to the message, and record that time in the README.\n6. Bring everything back to a working state and make sure the alert clears. Fill in the README from the template, including the section about what broke on the way.',
        ),
      },
      {
        id: 'recall',
        kind: 'text',
        step: 'review',
        title: bi('Где вспомнить', 'Where to recall'),
        body: bi(
          '- [[obs.scrape|Опрос метрик]] и [[obs.series|временные ряды]] вводятся в блоке мониторинга. Вспомните, как система сбора получает метрики с машины.\n- [[obs.gauge|Gauge]] и другие типы метрик разбираются в уроке о типах. Вернитесь к нему, чтобы решить, что стоит собирать.\n- [[obs.alert-rule|Правило алерта]] и маршрутизация оповещений объясняются в уроках блока мониторинга. Вспомните, из каких условий состоит алерт.\n- [[net.cert|Сертификат]] и его срок введены в сетевом блоке. Заодно вспомните, как контролируют время жизни сертификата.',
          '- [[obs.scrape|Metric scraping]] and [[obs.series|time series]] are introduced in the monitoring block. Recall how the collection system gets metrics from a machine.\n- [[obs.gauge|Gauge]] and the other metric types are covered in the lesson about types. Go back to it to decide what is worth collecting.\n- The [[obs.alert-rule|alert rule]] and alert routing are explained in the lessons of the monitoring block. Recall what conditions an alert consists of.\n- The [[net.cert|certificate]] and its lifetime are introduced in the networks block. While there, recall how the certificate lifetime is watched.',
        ),
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
    ],
  },
  {
    id: 'pet-projects.compose',
    block: 'pet-projects',
    title: bi('Сервис из контейнеров', 'A service made of containers'),
    summary: bi(
      'Соберите на своей машине сервис из двух-трёх контейнеров, соедините его части собственной сетью, сохраните данные в томах и опишите всё в одном файле Docker Compose.',
      'Assemble a service of two or three containers on your machine, connect its parts with a private network, keep the data in volumes and describe everything in one Docker Compose file.',
    ),
    introduces: [],
    uses: ['pet.algorithm', 'pet.acceptance', 'docker.compose', 'docker.volume', 'docker.network', 'docker.healthcheck'],
    tier: 'core',
    minutes: 30,
    sources: SRC_COMPOSE,
    sections: [
      {
        id: 'hook',
        kind: 'text',
        step: 'hook',
        body: bi(
          'До этого проекта контейнеры в курсе жили в песочнице. Теперь вы соберёте на своей машине сервис из двух-трёх контейнеров, например сайт с базой данных и прокси, опишете его одним файлом и научитесь обновлять его без потери данных. Результат выглядит так: весь сервис запускается одной командой, данные переживают пересоздание контейнеров, а наружу торчит один порт.',
          'Until this project the containers of the course lived in a sandbox. Now you assemble a service of two or three containers on your own machine — a site with a database and a proxy, for example — describe it in one file and learn to update it without losing data. The result looks like this: the whole service starts with one command, the data survives the containers being recreated, and a single port sticks out.',
        ),
      },
      {
        id: 'algorithm',
        kind: 'text',
        step: 'practice',
        title: bi('Порядок работы', 'The order of work'),
        body: bi(
          '1. Выберите приложение с данными, которые жалко терять, например блог, трекер привычек или подборку рецептов. Решите, из каких частей оно состоит и какая часть хранит данные.\n2. Напишите образы для частей приложения и соберите их на машине. Продумайте, как версия приложения попадает в образ.\n3. Опишите связку в файле Docker Compose: какие контейнеры запускаются, какие порты публикуются наружу, какие каталоги и тома хранят данные. Данные не должны жить внутри контейнера.\n4. Соедините контейнеры собственной сетью так, чтобы наружу был виден один прокси, а база данных слушала только внутри. Проверьте это с другой машины.\n5. Добавьте проверки готовности, чтобы контейнер, который ещё не готов к работе, не получал запросы. Выясните, чем проверка готовности отличается от проверки жизнеспособности, и запишите, какую из них вы где использовали.\n6. Обновите приложение на новую версию и верните старую, не потеряв данные. Заполните README по шаблону, включая то, что сломалось по дороге.',
          '1. Choose an app with data you would hate to lose, such as a blog, a habit tracker or a recipe collection. Decide which parts it consists of and which part stores the data.\n2. Write images for the parts of the app and build them on the machine. Plan how the app version gets into the image.\n3. Describe the bundle in a Docker Compose file: which containers start, which ports are published outside, which directories and volumes hold the data. The data must not live inside the container.\n4. Connect the containers with a private network so that only one proxy is visible from outside while the database listens inside only. Check this from another machine.\n5. Add readiness checks so a container that is not ready yet receives no requests. Find out how a readiness check differs from a liveness check, and record which one you used where.\n6. Update the app to a new version and roll back to the old one without losing data. Fill in the README from the template, including what broke on the way.',
        ),
      },
      {
        id: 'recall',
        kind: 'text',
        step: 'review',
        title: bi('Где вспомнить', 'Where to recall'),
        body: bi(
          '- [[docker.compose|Docker Compose]] вводится в блоке контейнеров. Вспомните, как один файл описывает связку целиком.\n- [[docker.volume|Том]] и хранение данных вне контейнера разбираются в уроке о хранилищах и сетях. Вернитесь к нему за устройством томов.\n- [[docker.network|Сеть Docker]] и публикация портов объясняются в том же уроке. Вспомните, как контейнеры видят друг друга.\n- [[docker.healthcheck|Проверка готовности]] вводится в уроке о Compose. Заодно вспомните, кто следит за состоянием сервисов.',
          '- [[docker.compose|Docker Compose]] is introduced in the containers block. Recall how one file describes the whole bundle.\n- The [[docker.volume|volume]] and storing data outside the container are covered in the lesson about storage and networks. Go back to it for how volumes work.\n- The [[docker.network|Docker network]] and port publishing are explained in the same lesson. Recall how containers see each other.\n- The [[docker.healthcheck|readiness check]] is introduced in the lesson about Compose. While there, recall who watches the state of the services.',
        ),
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
    ],
  },
  {
    id: 'pet-projects.kubernetes',
    block: 'pet-projects',
    title: bi('Одноузловой кластер', 'A single-node cluster'),
    summary: bi(
      'Разверните Kubernetes на одной виртуальной машине, перенесите в него приложение из контейнерного проекта и посмотрите, как кластер возвращает сервис к желаемому состоянию после поломок.',
      'Deploy Kubernetes on a single virtual machine, move the app from the containers project into it and watch the cluster bring the service back to the desired state after failures.',
    ),
    introduces: [],
    uses: ['pet.algorithm', 'pet.acceptance', 'k8s.k3s', 'k8s.deployment', 'k8s.service', 'k8s.ingress', 'k8s.probe'],
    tier: 'core',
    minutes: 35,
    sources: SRC_K8S,
    sections: [
      {
        id: 'hook',
        kind: 'text',
        step: 'hook',
        body: bi(
          'Kubernetes из курса жил в песочнице браузера. Этот проект ставит настоящий, хоть и одноузловой, кластер на вашу машину и переносит в него приложение из четвёртого проекта. Результат выглядит так: приложение описано манифестами, открывается по вашему адресу с сертификатом, а удалённый под возвращается без вашего участия. Проект опирается на сервис из контейнеров, поэтому делайте его после четвёртого.',
          'The Kubernetes of the course lived in a browser sandbox. This project installs a real — if single-node — cluster on your machine and moves the app from the fourth project into it. The result looks like this: the app is described by manifests, opens at your address with a certificate, and a deleted pod comes back without your involvement. The project builds on the service of containers, so do it after the fourth one.',
        ),
      },
      {
        id: 'algorithm',
        kind: 'text',
        step: 'practice',
        title: bi('Порядок работы', 'The order of work'),
        body: bi(
          '1. Выберите способ собрать одноузловой кластер и обоснуйте выбор: готовый дистрибутив для одного узла или ручная сборка из пакетов. Учтите объём памяти вашей машины.\n2. Соберите кластер и проверьте его состояние штатной командой. Найдите журналы его компонентов и запишите, где они лежат.\n3. Опишите приложение из четвёртого проекта объектами кластера: поды через контроллер, доступ через Service, вход через Ingress с сертификатом. Все объекты должны лежать в вашем репозитории.\n4. Выложите объекты в кластер и проверьте, что приложение отвечает по вашему адресу. Выясните, как кластер сообщает о готовности подов.\n5. Устройте две поломки. Удалите под вручную и закройте нужный порт на узле. Посмотрите, как кластер реагирует на каждую, и запишите наблюдения.\n6. Сравните затраты времени на обслуживание приложения в кластере и в Docker Compose. Заполните README по шаблону, включая вывод, когда одноузловой кластер оправдан, а когда избыточен.',
          '1. Choose how to assemble a single-node cluster and justify it: a ready distribution for one node or a manual build from packages. Take your machine’s memory into account.\n2. Assemble the cluster and check its state with the standard command. Find the journals of its components and write down where they live.\n3. Describe the app from the fourth project with cluster objects: pods through a controller, access through a Service, entry through an Ingress with a certificate. All objects must live in your repository.\n4. Apply the objects to the cluster and check that the app answers at your address. Find out how the cluster reports pod readiness.\n5. Stage two failures. Delete a pod by hand and close the needed port on the node. Watch how the cluster reacts to each and record the observations.\n6. Compare the time it takes to maintain the app in a cluster and in Docker Compose. Fill in the README from the template, including a conclusion on when a single-node cluster is justified and when it is overkill.',
        ),
      },
      {
        id: 'recall',
        kind: 'text',
        step: 'review',
        title: bi('Где вспомнить', 'Where to recall'),
        body: bi(
          '- [[k8s.k3s|k3s и одноузловые сборки]] разбираются в блоке Kubernetes. Вспомните, чем готовый дистрибутив отличается от классической сборки.\n- [[k8s.deployment|Deployment]] и [[k8s.service|Service]] вводятся на первом этапе блока. Вернитесь к желаемому состоянию и к доступу внутри кластера.\n- [[k8s.ingress|Ingress]] объясняется в блоке Kubernetes. Там вы вспомните, как устроен вход в кластер с сертификатом.\n- [[k8s.probe|Проверки контейнера]] вводятся в уроке о здоровье подов. Заодно вспомните, чем готовность отличается от жизнеспособности.',
          '- [[k8s.k3s|k3s and single-node builds]] are covered in the Kubernetes block. Recall how a ready distribution differs from a classic build.\n- [[k8s.deployment|Deployment]] and [[k8s.service|Service]] are introduced in the first stage of the block. Go back for the desired state and for access inside the cluster.\n- [[k8s.ingress|Ingress]] is explained in the Kubernetes block. There you will recall how entry into the cluster with a certificate works.\n- [[k8s.probe|Container checks]] are introduced in the lesson about pod health. While there, recall how readiness differs from liveness.',
        ),
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
    ],
  },
];
