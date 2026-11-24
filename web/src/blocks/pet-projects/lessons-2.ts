// Pet projects 6–10: the machine from code, backup and restore, the network
// lab, your own Git server and the practice incident review. Same shape as
// lessons-1.ts: intro, sequential algorithm, “where to recall”, honest note.

import { bi } from '../../core/i18n';
import type { Lesson } from '../../core/types';
import { HONEST_NOTE } from './shared';

const SRC_IAC = {
  en: [{ title: 'Ansible — Getting started', url: 'https://docs.ansible.com/ansible/latest/getting_started/index.html' }],
  ru: [{ title: 'Ansible — Википедия', url: 'https://ru.wikipedia.org/wiki/Ansible' }],
};

const SRC_BACKUP = {
  en: [{ title: 'rsync', url: 'https://rsync.samba.org/' }],
  ru: [{ title: 'Rsync — Википедия', url: 'https://ru.wikipedia.org/wiki/Rsync' }],
};

const SRC_NET = {
  en: [{ title: 'WireGuard', url: 'https://www.wireguard.com/' }],
  ru: [{ title: 'Виртуальная частная сеть — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%92%D0%B8%D1%80%D1%82%D1%83%D0%B0%D0%BB%D1%8C%D0%BD%D0%B0%D1%8F_%D1%87%D0%B0%D1%81%D1%82%D0%BD%D0%B0%D1%8F_%D1%81%D0%B5%D1%82%D1%8C' }],
};

const SRC_GIT = {
  en: [{ title: 'Gitea documentation', url: 'https://docs.gitea.com/' }],
  ru: [{ title: 'Pro Git на русском языке', url: 'https://git-scm.com/book/ru/v2' }],
};

const SRC_POSTMORTEM = {
  en: [{ title: 'Google SRE Book — Postmortem Culture: Learning from Failure', url: 'https://sre.google/sre-book/postmortem-culture/' }],
  ru: [{ title: 'Постмортем — Википедия', url: 'https://ru.wikipedia.org/wiki/%D0%9F%D0%BE%D1%81%D1%82%D0%BC%D0%BE%D1%80%D1%82%D0%B5%D0%BC' }],
};

export const PET_LESSONS_2: Lesson[] = [
  {
    id: 'pet-projects.iac',
    block: 'pet-projects',
    title: bi('Машина из кода', 'A machine from code'),
    summary: bi(
      'Пересоберите личный сайт из первого проекта средствами инфраструктуры как код: закажите машину и настройте её одной командой, а затем докажите идемпотентность повторным запуском.',
      'Rebuild the personal site from the first project with infrastructure-as-code: order the machine and configure it with one command, then prove idempotence with a second run.',
    ),
    introduces: [],
    uses: ['pet.algorithm', 'pet.acceptance', 'iac.iac', 'iac.idempotence', 'iac.inventory', 'iac.playbook', 'iac.provider', 'iac.state', 'iac.resource'],
    tier: 'core',
    minutes: 35,
    sources: SRC_IAC,
    sections: [
      {
        id: 'hook',
        kind: 'text',
        step: 'hook',
        body: bi(
          'Первый проект вы настраивали вручную, по памяти и заметкам. Теперь вы перенесёте всю настройку машины в код: заказ машины, пользователи, веб-сервер, служба и публикация сайта. Результат выглядит так: чистая машина превращается в рабочий сайт одной командой, а повторный запуск ничего не меняет. Этот проект делается поверх первого, но подойдёт любая машина, которую вы когда-то настраивали руками.',
          'In the first project you configured everything by hand, from memory and notes. Now you move the whole machine setup into code: ordering the machine, users, the web server, the service and the site publication. The result looks like this: a clean machine turns into a working site with one command, and a second run changes nothing. The project builds on the first one, but any machine you once set up by hand will do.',
        ),
      },
      {
        id: 'algorithm',
        kind: 'text',
        step: 'practice',
        title: bi('Порядок работы', 'The order of work'),
        body: bi(
          '1. Перечислите всё, что вы настраивали на машине руками в первом проекте: пользователи, пакеты, файлы, службы. Этот список станет планом переноса.\n2. Выберите инструменты и распределите роли между ними: чем заказывается машина, чем настраивается система после заказа. Обоснуйте выбор в двух предложениях.\n3. Опишите создание машины кодом и укажите размер, адрес и имя. Уничтожьте старую ручную машину только после успешной пересборки.\n4. Напишите сценарий настройки, который устанавливает веб-сервер, кладёт файлы сайта и оформляет службу. Запустите его дважды подряд и убедитесь, что второй запуск не меняет систему.\n5. Перенесите секреты и личные настройки в переменные или файлы вне репозитория. Проверьте, что в коде не осталось паролей и ключей.\n6. Соберите машину с нуля в чистом месте и проверьте критерии приёмки из первого проекта. Заполните README по шаблону, включая то, что сломалось по дороге.',
          '1. List everything you set up on the machine by hand in the first project: users, packages, files, services. This list becomes the migration plan.\n2. Choose the tools and split the roles between them: what orders the machine and what configures the system after the order. Justify the choice in two sentences.\n3. Describe the machine creation in code and specify the size, the address and the name. Destroy the old manual machine only after a successful rebuild.\n4. Write a configuration scenario that installs the web server, puts the site files in place and declares the service. Run it twice in a row and make sure the second run changes nothing in the system.\n5. Move secrets and personal settings into variables or files outside the repository. Check that no passwords or keys remain in the code.\n6. Build the machine from scratch in a clean place and check the acceptance criteria from the first project. Fill in the README from the template, including what broke on the way.',
        ),
      },
      {
        id: 'recall',
        kind: 'text',
        step: 'review',
        title: bi('Где вспомнить', 'Where to recall'),
        body: bi(
          '- [[iac.iac|Инфраструктура как код]] и [[iac.idempotence|идемпотентность]] вводятся в блоке IaC. Вспомните главное свойство повторного запуска.\n- [[iac.inventory|Инвентарь]] и [[iac.playbook|плейбук]] разбираются в уроках Ansible. Вернитесь к ним за структурой сценария.\n- [[iac.provider|Провайдер Terraform]] и [[iac.state|state]] объясняются в уроках Terraform. Там вы вспомните, как инструмент узнаёт о созданных ресурсах.\n- [[iac.resource|Облачный ресурс]] вводится в начале блока IaC. Заодно вспомните, из каких частей состоит описание ресурса.',
          '- [[iac.iac|Infrastructure as code]] and [[iac.idempotence|idempotence]] are introduced in the IaC block. Recall the main property of a repeated run.\n- The [[iac.inventory|inventory]] and the [[iac.playbook|playbook]] are covered in the Ansible lessons. Go back to them for the scenario structure.\n- The [[iac.provider|Terraform provider]] and [[iac.state|state]] are explained in the Terraform lessons. There you will recall how the tool learns about the created resources.\n- The [[iac.resource|cloud resource]] is introduced at the start of the IaC block. While there, recall what parts a resource description consists of.',
        ),
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
    ],
  },
  {
    id: 'pet-projects.backup',
    block: 'pet-projects',
    title: bi('Резервная копия и восстановление', 'Backup and restore'),
    summary: bi(
      'Настройте для своих проектов регулярное копирование в другое место и докажите на чистой машине, что по копии сервис работает снова, измерив время восстановления.',
      'Set up regular copying of your projects to another place and prove on a clean machine that the service works again from a copy, timing the restore.',
    ),
    introduces: [],
    uses: ['pet.algorithm', 'pet.acceptance', 'linux.archive', 'linux.cron', 'linux.mount', 'linux.filesystem'],
    tier: 'core',
    minutes: 30,
    sources: SRC_BACKUP,
    sections: [
      {
        id: 'hook',
        kind: 'text',
        step: 'hook',
        body: bi(
          'Пока копии нет, все ваши проекты держатся на одном диске одной машины. Этот проект добавляет копирование и главное — учебное восстановление, потому что копия, которую никто не разворачивал, считается испорченной. Результат выглядит так: раз в сутки данные уходят в другое место, а вы один раз восстановили сервис из копии на чистой машине и записали, сколько минут это заняло. Проект делается поверх любых прежних проектов, где есть данные.',
          'While there is no copy, all your projects stand on one disk of one machine. This project adds copying and, most importantly, a training restore, because a copy nobody has ever deployed is considered broken. The result looks like this: the data leaves for another place once a day, and you have restored the service from a copy on a clean machine once and recorded how many minutes it took. The project builds on any of the previous ones that hold data.',
        ),
      },
      {
        id: 'algorithm',
        kind: 'text',
        step: 'practice',
        title: bi('Порядок работы', 'The order of work'),
        body: bi(
          '1. Перечислите всё ценное в ваших проектах, от файлов сайтов и баз данных до конфигураций и ключей. Для каждого пункта решите, как часто он меняется.\n2. Напишите сценарий копирования, который собирает данные в архив и отправляет его в другое место: вторую машину или облачное хранилище. Копия не должна жить на той же машине, что и оригинал.\n3. Настройте регулярный запуск сценария по расписанию и проверку, что свежая копия появилась. Продумайте, как вы узнаете о неудачном запуске.\n4. Для учебной потери удалите на машине данные одного проекта. Восстановите их из копии на чистой машине и проверьте, что сервис работает.\n5. Измерьте два числа и запишите их в README: сколько минут длилось восстановление и сколько данных вы потеряли бы, если бы сбой случился за минуту до запуска копирования.\n6. Решите, как долго хранить старые копии, и настройте удаление устаревших. Заполните README по шаблону.',
          '1. List everything valuable in your projects, from site files and databases to configurations and keys. For each item decide how often it changes.\n2. Write a copying scenario that packs the data into an archive and sends it elsewhere: a second machine or cloud storage. The copy must not live on the same machine as the original.\n3. Set up a regular run of the scenario on a schedule and a check that a fresh copy has appeared. Plan how you will learn about a failed run.\n4. For a training loss, delete one project’s data on the machine. Restore it from the copy on a clean machine and check that the service works.\n5. Measure two numbers and record them in the README: how many minutes the restore took and how much data you would lose if the failure happened a minute before the copying run.\n6. Decide how long to keep old copies and set up the deletion of outdated ones. Fill in the README from the template.',
        ),
      },
      {
        id: 'recall',
        kind: 'text',
        step: 'review',
        title: bi('Где вспомнить', 'Where to recall'),
        body: bi(
          '- [[linux.archive|Архив]] и команды архивирования вводятся в блоке Linux. Вспомните, как собрать архив и распаковать его на другой машине.\n- [[linux.cron|Расписание cron]] разбирается в уроке о регулярных задачах. Там же лежат журналы запусков, по которым видно неудачу.\n- [[linux.mount|Монтирование]] объясняется в блоке Linux. Оно пригодится, если копия уходит на отдельный диск.\n- [[linux.filesystem|Файловая система]] вводится в уроке о дисках. Вспомните, где на диске лежат ваши данные.',
          '- The [[linux.archive|archive]] and the archiving commands are introduced in the Linux block. Recall how to pack an archive and unpack it on another machine.\n- The [[linux.cron|cron schedule]] is covered in the lesson about regular tasks. The run journals that reveal a failure live in the same lesson.\n- [[linux.mount|Mounting]] is explained in the Linux block. It helps when the copy goes to a separate disk.\n- The [[linux.filesystem|file system]] is introduced in the lesson about disks. Recall where on the disk your data lives.',
        ),
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
    ],
  },
  {
    id: 'pet-projects.network',
    block: 'pet-projects',
    title: bi('Сетевая лаборатория из двух машин', 'A network lab of two machines'),
    summary: bi(
      'Соедините две виртуальные машины частным туннелем или VPN, проведите через него настоящий сервис и закройте всё лишнее межсетевым экраном.',
      'Connect two virtual machines with a private tunnel or VPN, run a real service through it and close everything else with a firewall.',
    ),
    introduces: [],
    uses: ['pet.algorithm', 'pet.acceptance', 'net.vpn', 'linux.ssh-tunnel', 'net.subnet', 'linux.bastion'],
    tier: 'core',
    minutes: 35,
    sources: SRC_NET,
    sections: [
      {
        id: 'hook',
        kind: 'text',
        step: 'hook',
        body: bi(
          'До этого проекта ваша инфраструктура состояла из одной машины. Теперь вы свяжете две машины частным каналом через интернет и проведёте через него настоящий сервис. Результат выглядит так: сервис на второй машине доступен только по защищённому соединению с первой, лишние порты закрыты, а схема с адресами нарисована в README.',
          'Until this project your infrastructure consisted of one machine. Now you connect two machines with a private channel across the internet and run a real service through it. The result looks like this: the service on the second machine is reachable only over the protected connection from the first one, the extra ports are closed, and the diagram with addresses is drawn in the README.',
        ),
      },
      {
        id: 'algorithm',
        kind: 'text',
        step: 'practice',
        title: bi('Порядок работы', 'The order of work'),
        body: bi(
          '1. Закажите вторую недорогую машину и нарисуйте на бумаге план: какие адреса у обеих машин, какие адреса получат туннельные интерфейсы, какой сервис пойдёт по туннелю.\n2. Выберите способ соединения — VPN или туннель поверх SSH — и обоснуйте выбор для своей задачи. Учтите, что одно из решений проще в обслуживании, а другое не требует установки лишнего программного обеспечения.\n3. Соедините машины и проверьте связь по внутренним адресам туннеля. Разберитесь, что происходит с пакетами, когда адрес назначения лежит внутри туннеля.\n4. Запустите на второй машине сервис, который должен быть виден только с первой, и настройте маршрут до него по туннелю. Проверьте с первой машины, что сервис отвечает, а снаружи его не видно.\n5. Закройте на обеих машинах всё, кроме нужного порта туннеля и служебного входа. Продумайте, как вы не отключите сами себя от машин.\n6. Заполните README: схема с адресами, выбор способа соединения и его причины, что сломалось по дороге.',
          '1. Order a second cheap machine and draw the plan on paper: what addresses both machines have, what addresses the tunnel interfaces get, which service will travel through the tunnel.\n2. Choose how to connect — a VPN or a tunnel over SSH — and justify the choice for your task. Take into account that one of the options is easier to maintain and the other needs no extra software installed.\n3. Connect the machines and check the reachability over the tunnel’s internal addresses. Work out what happens to packets when the destination address lies inside the tunnel.\n4. Start a service on the second machine that must be visible only from the first one and set the route to it through the tunnel. Check from the first machine that the service answers and that it is not visible from outside.\n5. Close everything on both machines except the tunnel’s port and the service entrance. Plan how you will not lock yourself out of the machines.\n6. Fill in the README: the diagram with addresses, the choice of the connection method and its reasons, what broke on the way.',
        ),
      },
      {
        id: 'recall',
        kind: 'text',
        step: 'review',
        title: bi('Где вспомнить', 'Where to recall'),
        body: bi(
          '- [[net.vpn|VPN]] вводится в сетевом блоке. Вспомните устройство защищённого соединения между двумя машинами через интернет.\n- [[linux.ssh-tunnel|Туннель SSH]] разбирается в блоке Linux. Это второй способ решить задачу проекта.\n- [[net.subnet|Подсеть]] и адресация объясняются в сетевом блоке. Вернитесь к расчёту адресов для туннельных интерфейсов.\n- [[linux.bastion|Бастион]] и вход через посредника вводятся в уроке о SSH. Заодно вспомните, как прокладывают служебный вход в закрытую сеть.',
          '- [[net.vpn|VPN]] is introduced in the networks block. Recall how a protected connection between two machines across the internet works.\n- The [[linux.ssh-tunnel|SSH tunnel]] is covered in the Linux block. It is the second way to solve the project’s task.\n- The [[net.subnet|subnet]] and addressing are explained in the networks block. Go back to plan the addresses of the tunnel interfaces.\n- The [[linux.bastion|bastion]] and entering through an intermediary are introduced in the lesson about SSH. While there, recall how a service entrance into a closed network is laid.',
        ),
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
    ],
  },
  {
    id: 'pet-projects.gitserver',
    block: 'pet-projects',
    title: bi('Собственный сервер Git', 'Your own Git server'),
    summary: bi(
      'Установите на своей машине сервер Git с доступом по ключам и настройте автоматическую публикацию сайта при каждом принятом изменении.',
      'Install a Git server on your machine with key access and set up automatic publication of the site on every accepted change.',
    ),
    introduces: [],
    uses: ['pet.algorithm', 'pet.acceptance', 'git.repo', 'git.remote', 'linux.ssh-key', 'linux.cron'],
    tier: 'core',
    minutes: 30,
    sources: SRC_GIT,
    sections: [
      {
        id: 'hook',
        kind: 'text',
        step: 'hook',
        body: bi(
          'Все прежние проекты жили на чужих платформах. Этот проект ставит на вашу машину собственный сервер Git, принимает ваши изменения и сам публикует сайт, когда изменение принято. Результат выглядит так: вы отправляете коммит, а через минуту обновлённый сайт открывается по адресу из первого проекта.',
          'All the previous projects lived on other people’s platforms. This project installs your own Git server on your machine, accepts your pushes and publishes the site by itself once a change is accepted. The result looks like this: you push a commit, and a minute later the updated site opens at the address from the first project.',
        ),
      },
      {
        id: 'algorithm',
        kind: 'text',
        step: 'practice',
        title: bi('Порядок работы', 'The order of work'),
        body: bi(
          '1. Выберите вид сервера: голый репозиторий с серверным сценарием или готовая платформа вроде лёгкого форджа. Обоснуйте выбор объёмом обслуживания, который вы готовы нести.\n2. Установите сервер, заведите учётную запись для работы по ключу и проверьте отправку изменений из вашего репозитория с ноутбука. Старые проекты переносить не нужно. Начните с нового репозитория для сайта.\n3. Напишите серверный сценарий, который запускается при принятии изменений: он проверяет проект и копирует опубликованную версию на место сайта. Выясните, как сценарий узнаёт об отклонённой проверке и останавливается.\n4. Сделайте так, чтобы сценарий выполнялся от учётной записи с минимальными правами: доступ на запись только к месту публикации. Проверьте, что украденный ключ не даст злоумышленнику больше этого.\n5. Настройте копирование репозитория в другое место, потому что теперь у вас есть ещё одни данные, которые жалко терять. Свяжите этот шаг с проектом резервного копирования.\n6. Заполните README сервера. В нём должны быть схема, порядок добавления нового проекта и раздел о том, что сломалось по дороге.',
          '1. Choose the kind of server: a bare repository with a server-side script or a ready platform like a lightweight forge. Justify the choice by the amount of maintenance you are ready to carry.\n2. Install the server, create an account that works by key and check pushing changes from your laptop’s repository. There is no need to migrate old projects. Start a new repository for the site.\n3. Write a server-side script that runs when a change is accepted: it checks the project and copies the published version to the site’s place. Find out how the script learns about a rejected check and stops.\n4. Make the script run as an account with minimal rights: write access only to the publication place. Check that a stolen key gives an attacker nothing beyond that.\n5. Set up copying of the repository elsewhere, because you now have one more set of data you would hate to lose. Connect this step with the backup project.\n6. Fill in the server README. It should hold the diagram, how to add a new project and a section about what broke on the way.',
        ),
      },
      {
        id: 'recall',
        kind: 'text',
        step: 'review',
        title: bi('Где вспомнить', 'Where to recall'),
        body: bi(
          '- [[git.repo|Репозиторий]] вводится в самом начале блока Git. Вспомните, что хранится внутри каталога репозитория.\n- [[git.remote|Удалённый репозиторий]] объясняет модель сервера и клиента. Вернитесь к уроку о совместной работе за этой моделью.\n- [[linux.ssh-key|Пара ключей SSH]] и учётные записи с ограниченными правами вводятся в блоке Linux. Там же лежит разбор прав доступа.\n- [[linux.cron|Расписание cron]] пригодится для копирования репозитория по расписанию.',
          '- The [[git.repo|repository]] is introduced at the very start of the Git block. Recall what is stored inside the repository directory.\n- The [[git.remote|remote repository]] explains the server-and-client model. Go back to the lesson about working together for that model.\n- The [[linux.ssh-key|SSH key pair]] and accounts with limited rights are introduced in the Linux block. The breakdown of access rights lives in the same block.\n- The [[linux.cron|cron schedule]] helps when the repository is copied on a schedule.',
        ),
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
    ],
  },
  {
    id: 'pet-projects.postmortem',
    block: 'pet-projects',
    title: bi('Учебный инцидент и его разбор', 'A practice incident and its review'),
    summary: bi(
      'Устройте на своей системе управляемый сбой, пройдите его как дежурный инженер и напишите разбор без поиска виноватых, у которого каждое мероприятие получает владельца и срок.',
      'Stage a controlled failure on your own system, work through it like an on-call engineer and write a blameless review in which every action item gets an owner and a date.',
    ),
    introduces: [],
    uses: ['pet.algorithm', 'pet.acceptance', 'career.oncall', 'career.mitigate-first', 'career.status-update', 'career.blameless', 'method.postmortem'],
    tier: 'core',
    minutes: 30,
    sources: SRC_POSTMORTEM,
    sections: [
      {
        id: 'hook',
        kind: 'text',
        step: 'hook',
        body: bi(
          'Курс учил реагировать на инциденты в песочнице, а этот проект даёт настоящий сбой на вашей системе. Вы спланируете поломку и пройдёте её как дежурный. Вы заметите сбой по оповещению, вернёте сервис, напишете таймлайн и разберёте причины без поиска виноватых. Результат выглядит как документ разбора и два-три исправления в ваших проектах. Проект опирается на мониторинг из третьего проекта и подойдёт к любому сервису из прежних.',
          'The course taught you to respond to incidents in a sandbox, and this project gives you a real failure on your own system. You will plan the breakage and work through it like an on-call engineer. You will notice the failure from an alert, bring the service back, write the timeline and review the causes without hunting for the guilty. The result is a review document and two or three fixes in your projects. The project builds on the monitoring from the third project and fits any of the services you already have.',
        ),
      },
      {
        id: 'algorithm',
        kind: 'text',
        step: 'practice',
        title: bi('Порядок работы', 'The order of work'),
        body: bi(
          '1. Выберите сервис из прежних проектов и одну поломку из известных: закончилось место на диске, истёк сертификат, остановилась служба. Продумайте, как эта поломка проявится для посетителя сайта.\n2. Подготовьте наблюдаемость и убедитесь, что поломка заметна оповещением из третьего проекта. Если она не заметна, сначала исправьте это.\n3. Устройте сбой в условленное время и пройдите его по правилам: сначала верните сервис посетителям, потом разбирайтесь в причине, а о ходе работы сообщайте, даже если команда сейчас состоит из вас одного.\n4. Зафиксируйте таймлайн в тот же день, по памяти: когда пришло оповещение, когда сервис вернулся, когда найдена причина. Отметьте каждый шаг, который занял больше времени, чем мог бы.\n5. Напишите разбор без поиска виноватых: что сделала система такого, что поломка стала возможной, и какие условия позволили ей дойти до посетителей. Каждое мероприятие получает владельца и срок, иначе оно не считается.\n6. Выполните мероприятия и устройте второй сбой, чтобы проверить, что они работают. Заполните README, включая ссылку на документ разбора.',
          '1. Choose a service from your previous projects and one breakage from the known ones: the disk ran out of space, the certificate expired, a service stopped. Plan how this breakage will look to a visitor of the site.\n2. Prepare the observability and make sure the breakage is visible as an alert from the third project. If it is not visible, fix that first.\n3. Stage the failure at an agreed time and work through it by the rules: first give visitors the service back, then investigate the cause, and report on the progress even if the team is only you right now.\n4. Record the timeline the same day, from memory: when the alert arrived, when the service came back, when the cause was found. Mark every step that took longer than it could have.\n5. Write the review without hunting for the guilty: what did the system do that made the breakage possible, and which conditions let it reach the visitors. Every action item gets an owner and a date, otherwise it does not count.\n6. Carry out the action items and stage a second failure to check that they work. Fill in the README, including a link to the review document.',
        ),
      },
      {
        id: 'recall',
        kind: 'text',
        step: 'review',
        title: bi('Где вспомнить', 'Where to recall'),
        body: bi(
          '- [[career.oncall|Смена дежурного]] показывает порядок работы инцидента. Вспомните шаги от оповещения до причины.\n- [[career.mitigate-first|Сначала вернуть сервис]] — главное правило реагирования на сбой, по которому пользователям возвращают сервис раньше, чем начинают чинить причину.\n- [[career.status-update|Статус команде]] объясняет, что писать в сообщениях во время сбоя. Вернитесь к уроку о ситуационных вопросах.\n- [[career.blameless|Разбор без виноватых]] и [[method.postmortem|разбор без поиска виноватых]] вводятся в курсе дважды. Вспомните оба взгляда на один документ.',
          '- The [[career.oncall|on-call shift]] shows the order of working an incident. Recall the steps from the alert to the cause.\n- [[career.mitigate-first|Mitigate first]] is the main rule of responding to a failure: users get the service back before anyone starts fixing the cause.\n- The [[career.status-update|status update]] explains what to write in messages during a failure. Go back to the lesson about situational questions.\n- [[career.blameless|The review without the guilty]] and [[method.postmortem|the blameless postmortem]] are introduced twice in the course. Recall both views of one document.',
        ),
      },
      { id: 'honest', kind: 'callout', tone: 'note', step: 'review', body: HONEST_NOTE },
    ],
  },
];
