// m09. Compose: a project of services, its network and volumes; readiness and restarts (04 §4.3).

import { bi } from '../../../core/i18n';
import type { Facts, Lesson, QuizItem } from '../../../core/types';
import { dockerHost, SRC, web } from '../shared';

type C = { name: string; state: string; health: string | null; compose: { project: string; service: string } | null; mounts: { type: string; source: string; target: string }[]; config: { Env: string[] } };
const cs = (f: Facts) => (f.containers as C[] | undefined) ?? [];
const svc = (f: Facts, s: string) => cs(f).find((c) => c.compose?.service === s);

const COMPOSE_RACE = `services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      - db-data:/var/lib/postgresql/data
  api:
    image: trainer/api:1.0
    environment:
      DB_HOST: db
    ports:
      - "8000:8000"
    depends_on:
      - db
volumes:
  db-data:
`;

export const composeQuiz: QuizItem[] = [
  {
    id: 'containers.q.depends-short',
    kind: 'mcq',
    key: true,
    concepts: ['docker.healthcheck'],
    prompt: bi('Гарантирует ли короткая форма `depends_on: [db]`, что к моменту запуска api база уже принимает соединения?', 'Does the short form `depends_on: [db]` guarantee that the database accepts connections when api starts?'),
    options: [
      { id: 'no', text: bi('Нет, Compose ждёт только запуска контейнера db, а не готовности базы', 'No, Compose waits only for the db container to start, not for the database to be ready'), correct: true },
      { id: 'yes', text: bi('Да, Compose ждёт, пока сервис заработает', 'Yes, Compose waits until the service works'), why: bi('Сервис может быть уже запущен, но ещё не готов, потому что после запуска процесса postgres ещё секунды две готовит базу.', '“Started” and “ready” are different: postgres initialises for a couple of seconds after its process starts.') },
    ],
    explain: bi('Готовность определяет проверка готовности (healthcheck), а ждать её велит условие `depends_on: db: condition: service_healthy`.', 'Readiness is checked by a healthcheck, and `depends_on: db: condition: service_healthy` says to wait for it.'),
  },
  {
    id: 'containers.q.down-v',
    kind: 'mcq',
    concepts: ['docker.compose'],
    prompt: bi('Что делает команда `docker compose down -v`?', 'What does `docker compose down -v` do?'),
    options: [
      { id: 'all', text: bi('Останавливает и удаляет контейнеры и сеть проекта, а благодаря `-v` удаляет ещё и тома проекта, то есть данные', 'Stops and removes the project’s containers and network, and with `-v` its volumes too — that is, the data'), correct: true },
      { id: 'verbose', text: bi('То же, что `down`, только с подробным выводом', 'The same as `down`, only with verbose output'), why: bi('Здесь `-v` означает `--volumes`, а не подробный вывод. После этой команды данных базы не останется.', '`-v` here is `--volumes`, not “verbose”. After it the database data is gone.') },
      { id: 'images', text: bi('Удаляет образы проекта', 'Removes the project’s images'), why: bi('Образы удаляет флаг `--rmi`, а флаг `-v` удаляет тома.', '`--rmi` removes images; `-v` volumes.') },
    ],
  },
  {
    id: 'containers.q.localhost-bug',
    kind: 'bugfind',
    concepts: ['docker.compose', 'docker.network'],
    prompt: bi('API не может подключиться к базе. Где ошибка?', 'The API cannot connect to the database. Where is the bug?'),
    code: 'services:\n  db:\n    image: postgres:17-alpine\n  api:\n    image: trainer/api:1.0\n    environment:\n      DB_HOST: localhost',
    lang: 'yaml',
    bug: [7],
    why: {
      3: bi('В этой строке образ указан верно.', 'The image in this line is right.'),
      5: bi('В этой строке образ указан верно.', 'The image in this line is right.'),
      7: bi('Внутри контейнера api адрес `localhost` указывает на сам api. База работает в другом контейнере, и в сети проекта её имя `db`.', '`localhost` inside the api container is api itself. The database is another container; on the project network its name is `db`.'),
    },
  },
  {
    id: 'containers.q.compose-secret',
    kind: 'mcq',
    concepts: ['docker.compose', 'docker.env'],
    prompt: bi('В compose.yaml рабочего проекта записано `POSTGRES_PASSWORD: Sup3rS3cret`. Коллега говорит, что это безопасно, потому что репозиторий закрытый. Прав ли он?', 'The compose.yaml of a real project has `POSTGRES_PASSWORD: Sup3rS3cret`. A colleague says this is safe because the repository is private. Is he right?'),
    options: [
      { id: 'no', text: bi('Нет, потому что пароль видит каждый, у кого есть доступ к коду, он навсегда остаётся в истории git и виден в `docker inspect`. Его выносят в `.env` вне репозитория или в раздел `secrets:`', 'No: everyone with access to the code sees the password, it stays in the git history forever and is visible in `docker inspect`. It is moved to an `.env` outside the repository or to the `secrets:` section'), correct: true },
      { id: 'yes', text: bi('Да, закрытого репозитория для пароля достаточно', 'Yes, a private repository is enough for a password'), why: bi('Доступ к коду есть у всех разработчиков, у CI и у каждого, кому когда-нибудь его откроют, а удалённый из файла пароль остаётся в старых коммитах.', 'All developers, CI and anyone the code is ever opened to have access to it, and a password removed from the file stays in old commits.') },
      { id: 'env', text: bi('Нет, но достаточно переименовать переменную, например в `DB_PASS`', 'No, but it is enough to rename the variable, for example to `DB_PASS`'), why: bi('Имя переменной ничего не скрывает, потому что значение по-прежнему лежит в файле открытым текстом.', 'The variable name hides nothing: the value still lies in the file in plain text.') },
    ],
  },
  {
    id: 'containers.q.extra-port',
    kind: 'bugfind',
    concepts: ['docker.compose', 'docker.publish'],
    prompt: bi('Снаружи сайт должен быть доступен только через nginx по HTTPS, но служба безопасности обнаружила, что админка API открывается по адресу `http://сервер:8000/admin` в обход nginx. Какая строка в этом виновата?', 'From outside the site must be reachable only through nginx over HTTPS, but the security team found that the API admin page opens at `http://server:8000/admin`, bypassing nginx. Which line is to blame?'),
    code: 'services:\n  nginx:\n    image: nginx:1.30-alpine\n    ports:\n      - "443:443"\n  api:\n    image: trainer/api:1.0\n    ports:\n      - "8000:8000"',
    lang: 'yaml',
    bug: [9],
    why: {
      5: bi('Порт 443 nginx публикуют намеренно, потому что через него пользователи и попадают на сайт.', 'Port 443 of nginx is published on purpose: that is how users reach the site.'),
      8: bi('Само поле `ports` не ошибка, ошибка в том, какой порт в нём опубликован.', 'The `ports` field itself is not the mistake; the mistake is which port it publishes.'),
      9: bi('Публикация `8000:8000` открывает API всей сети в обход nginx и HTTPS. Чтобы nginx дошёл до API, публиковать ничего не нужно: внутри сети проекта nginx обращается к `api:8000` по имени. Если порт нужен для отладки, его публикуют только для самой машины, записью `127.0.0.1:8000:8000`.', 'Publishing `8000:8000` opens the API to the whole network, bypassing nginx and HTTPS. nginx needs nothing published to reach the API: inside the project network nginx calls `api:8000` by name. If the port is needed for debugging, it is published only for the machine itself: `127.0.0.1:8000:8000`.'),
    },
  },
  {
    id: 'containers.q.compose-vs-run',
    kind: 'mcq',
    concepts: ['docker.compose'],
    prompt: bi('Чем `docker compose up -d` отличается от трёх команд `docker run`?', 'How does `docker compose up -d` differ from three `docker run` commands?'),
    options: [
      { id: 'decl', text: bi('Описание лежит в файле, а Compose приводит систему в соответствие с ним: создаёт сеть и тома проекта, запускает сервисы в порядке зависимостей и не трогает то, что уже совпадает с описанием', 'The description lives in a file and Compose brings the system to it: it creates the project network and volumes, starts services in dependency order and leaves alone what already matches'), correct: true },
      { id: 'vm', text: bi('Compose запускает сервисы в отдельной виртуальной машине', 'Compose runs services in a separate VM'), why: bi('Compose запускает те же контейнеры того же движка Docker, и отличается он только описанием и порядком запуска.', 'The same containers of the same engine; the difference is the description and the order.') },
      { id: 'loop', text: bi('Compose постоянно следит за сервисами и чинит их', 'Compose constantly watches services and repairs them'), why: bi('Команда `up` один раз приводит систему в соответствие с описанием и завершается, а перезапуском упавших контейнеров занимается политика restart движка Docker. Бесконечный цикл сверки появится уже в Kubernetes.', '`up` brings the system to the description once and returns; restarting fallen ones is the engine’s restart policy. An endless reconciliation loop is Kubernetes.') },
    ],
  },
];

export const composeLesson: Lesson = {
  id: 'containers.compose',
  block: 'containers',
  title: bi('Как описать несколько контейнеров в одном файле Compose', 'How to describe several containers in one Compose file'),
  summary: bi('В этом уроке вы научитесь описывать приложение из нескольких сервисов так, чтобы оно запускалось одной командой, и узнаете, как дождаться, пока база будет готова принимать соединения.', 'In this lesson you will learn to describe an application of several services so that it starts with one command, and how to wait until the database is ready to accept connections.'),
  introduces: ['docker.compose', 'docker.healthcheck'],
  uses: ['docker.lifecycle', 'docker.volume', 'docker.network', 'docker.env', 'docker.publish'],
  tier: 'core',
  minutes: 35,
  sources: {
    en: [SRC.compose, SRC.startup, SRC.composeSpec, { title: 'docker compose up — Docker Docs', url: 'https://docs.docker.com/reference/cli/docker/compose/up/' }],
    ru: [SRC.k8sRuContainers, { title: 'Docker Compose — Википедия', url: 'https://ru.wikipedia.org/wiki/Docker' }],
  },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Приложение из базы данных, API и веб-сервера требует сеть, том и три команды `docker run` с десятком флагов у каждой. Набирать их нужно в правильном порядке на каждой машине, и никто не помнит, с какими флагами запускали в прошлый раз. Этот урок отвечает на вопрос: **как описать три контейнера так, чтобы их можно было запустить одной командой?**', 'An application of a database, an API and a web server is a network, a volume and three `docker run` commands with a dozen flags each. They must be typed in the right order on every machine, and nobody remembers the flags from last time. The leading question: **how to describe three containers so they come up with one command?**'),
    },
    {
      id: 'file',
      kind: 'text',
      step: 'explain',
      title: bi('Как compose.yaml записывает команды docker run в файл', 'How compose.yaml writes docker run commands down'),
      body: bi(
        '[[docker.compose|Docker Compose]] читает файл `compose.yaml` и создаёт по нему проект. Каждый сервис в этом файле описывает тот же `docker run`, только записанный полями YAML: `image`, `environment` вместо `-e`, `ports` вместо `-p`, `volumes` вместо `-v` и `command` вместо аргументов. По умолчанию проект называется так же, как каталог, поэтому в `~/shop` контейнеры получат имена `shop-db-1` и `shop-api-1`.\n\nДля проекта Compose сам создаёт сеть `shop_default` и подключает к ней все сервисы, поэтому сервисы сразу находят друг друга по имени, например `DB_HOST: db`. Тома, объявленные в разделе `volumes:` верхнего уровня, получают имена вида `shop_db-data`.\n\n```yaml\nservices:\n  db:\n    image: postgres:17-alpine\n    environment:\n      POSTGRES_PASSWORD: secret\n    volumes:\n      - db-data:/var/lib/postgresql/data\n  api:\n    image: trainer/api:1.0\n    environment:\n      DB_HOST: db\n    ports:\n      - "8000:8000"\nvolumes:\n  db-data:\n```\n\nКоманда `docker compose up -d` запускает проект, `ps` показывает его контейнеры, `logs` — их журналы, а `down` удаляет контейнеры и сеть, причём с флагом `-v` ещё и тома, то есть данные. Переменные из файла `.env`, лежащего рядом, подставляются на место `${ИМЯ}`, а `docker compose config` показывает итоговое описание после подстановки.\n\nВ примере выше пароль базы записан открытым текстом в поле `environment:`, и для учебного стенда это допустимо. В рабочем проекте compose.yaml лежит в репозитории, и пароль из него увидит каждый, у кого есть доступ к коду, даже если репозиторий закрытый, а заодно и в `docker inspect`. Поэтому пароли выносят из файла. Простой способ: записать `POSTGRES_PASSWORD: ${DB_PASSWORD}` и держать значение в `.env`, который добавлен в `.gitignore`, или подключить такой файл полем `env_file:`. Способ надёжнее: раздел `secrets:`, который передаёт файл с паролем внутрь контейнера по пути `/run/secrets/имя`; у образа postgres для этого есть переменная `POSTGRES_PASSWORD_FILE`.',
        '[[docker.compose|Docker Compose]] reads a `compose.yaml` file and makes a project of it. Each service is the same `docker run`, only written as YAML fields: `image`, `environment` instead of `-e`, `ports` instead of `-p`, `volumes` instead of `-v`, `command` instead of arguments. The project name is the directory name by default: in `~/shop` the containers are called `shop-db-1`, `shop-api-1`.\n\nFor the project Compose itself creates a `shop_default` network and attaches every service to it, so they find each other by service name at once — `DB_HOST: db`. Volumes declared in the top-level `volumes:` section become `shop_db-data`.\n\n```yaml\nservices:\n  db:\n    image: postgres:17-alpine\n    environment:\n      POSTGRES_PASSWORD: secret\n    volumes:\n      - db-data:/var/lib/postgresql/data\n  api:\n    image: trainer/api:1.0\n    environment:\n      DB_HOST: db\n    ports:\n      - "8000:8000"\nvolumes:\n  db-data:\n```\n\nCommands: `docker compose up -d` brings the project up, `ps` shows its containers, `logs` their logs, `down` removes the containers and the network (with `-v` the volumes too — that is, the data). Variables from an `.env` file next to it fill `${NAME}`; `docker compose config` shows the final description.\n\nIn the example above the database password is written straight into `environment:`, which is acceptable for a training setup. In a real project compose.yaml lives in the repository, and anyone with access to the code sees the password, even if the repository is private, and so does `docker inspect`. So passwords are moved out of the file. The simple way is to write `POSTGRES_PASSWORD: ${DB_PASSWORD}` and keep the value in `.env`, listed in `.gitignore`, or attach such a file with the `env_file:` field. The more reliable way is the `secrets:` section, which passes a file with the password into the container at `/run/secrets/name`; the postgres image has the `POSTGRES_PASSWORD_FILE` variable for this.',
      ),
    },
    {
      id: 'ready',
      kind: 'text',
      step: 'explain',
      title: bi('Почему запущенный сервис ещё не готов к работе', 'Why a started service is not yet ready'),
      body: bi(
        'Строка `depends_on: [db]` говорит Compose: «запусти db раньше api». Но запущенный процесс postgres ещё пару секунд создаёт файлы базы и не принимает соединений. Если API пытается подключиться к базе сразу при старте, сервис api завершается с ошибкой `Connection refused`.\n\nЧтобы ждать готовности, нужна [[docker.healthcheck|проверка готовности]], то есть команда, которой Docker периодически опрашивает сервис, и условие в `depends_on`:\n\n```yaml\n  db:\n    healthcheck:\n      test: ["CMD-SHELL", "pg_isready -U postgres"]\n      interval: 2s\n      retries: 10\n  api:\n    depends_on:\n      db:\n        condition: service_healthy\n```\n\nРядом с этим работает политика перезапуска `restart: on-failure` или `unless-stopped`: если контейнер завершился с ошибкой, Docker запустит его снова. Так Docker сам перезапускает упавший контейнер, и это простейшая форма автоматического восстановления. Сама команда `compose up` приводит систему в соответствие с описанием один раз и завершается, а в Kubernetes на смену такому однократному запуску придёт цикл сверки, который непрерывно сравнивает описание с тем, что на самом деле работает.',
        '`depends_on: [db]` tells Compose: “start db before api”. But a started postgres process spends another couple of seconds creating the database files and does not accept connections. An API that tries to connect right at start falls over with `Connection refused`.\n\nTo wait for readiness you need a [[docker.healthcheck|healthcheck]] — a command Docker periodically runs against the service — and a condition in `depends_on`:\n\n```yaml\n  db:\n    healthcheck:\n      test: ["CMD-SHELL", "pg_isready -U postgres"]\n      interval: 2s\n      retries: 10\n  api:\n    depends_on:\n      db:\n        condition: service_healthy\n```\n\nNext to it stands the restart policy `restart: on-failure` or `unless-stopped`: fell — bring it back. That way Docker restarts a fallen container by itself, the simplest form of automatic recovery. `compose up` brings the system to the description once and returns; in Kubernetes this becomes a reconciliation loop that compares the desired and the actual state endlessly.',
      ),
    },
    {
      id: 'dev-env',
      kind: 'text',
      step: 'explain',
      title: bi('Как тот же файл даёт окружение разработчику', 'How the same file gives a developer an environment'),
      body: bi(
        'Compose часто принимают за способ запустить рядом с кодом базу данных, а сам код по-прежнему держат и запускают на ноутбуке. Тогда проблема окружений, с которой начинался блок, возвращается: на ноутбуке другая версия Python, другие библиотеки, и «у меня работает» звучит снова. Поэтому в контейнер кладут и само приложение. В файл добавляют сервис приложения, который собирается из Dockerfile проекта полем `build: .`, а каталог с кодом подключают к нему bind mount, например `volumes: - ./:/app`. Правка кода сразу видна в контейнере, сервер разработки перезапускается сам, а новый человек в команде получает всё окружение одной командой `docker compose up`. На рабочем сервере тот же образ запускают уже без bind mount, с кодом внутри образа.',
        'Compose is often taken for a way to start a database next to the code, while the code itself is still kept and run on the laptop. Then the environment problem the block started with comes back: the laptop has another Python version and other libraries, and “it works on my machine” is heard again. So the application itself goes into a container too. A service for the application is added to the file, built from the project’s Dockerfile with the field `build: .`, and the code directory is attached to it with a bind mount, for example `volumes: - ./:/app`. A code edit shows in the container at once, the development server restarts by itself, and a new person on the team gets the whole environment with one command, `docker compose up`. On a production server the same image runs without the bind mount, with the code inside the image.',
      ),
    },
    {
      id: 'backup',
      kind: 'text',
      step: 'explain',
      title: bi('Как сохранить данные базы и проверить, что они восстанавливаются', 'How to save the database data and check that it can be restored'),
      body: bi(
        'Именованный том переживает пересоздание контейнера, но резервной копией он не служит. Том лежит на том же диске, что и контейнер, его удалит неосторожный `docker compose down -v`, а файлы работающей базы, скопированные как есть, часто оказываются несогласованными. Поэтому копию базы снимают средствами самой базы. У postgres это дамп, то есть файл с командами SQL, из которых база собирается заново:\n\n```bash\ndocker compose exec -T db pg_dump -U postgres postgres > backup.sql\n```\n\nФлаг `-T` отключает терминал, чтобы в файл попал только вывод `pg_dump`, без служебных символов терминала. Дамп кладут не на тот же сервер, а в другое место, например в объектное хранилище. Восстановление выглядит так же, только в обратную сторону:\n\n```bash\ndocker compose exec -T db psql -U postgres postgres < backup.sql\n```\n\nКопия, из которой ни разу не восстанавливали базу, ничего не гарантирует. Поэтому восстановление регулярно проверяют на отдельном стенде: запускают пустую базу, загружают в неё дамп и смотрят, что таблицы и данные на месте.',
        'A named volume survives re-creating the container, but it is not a backup. The volume sits on the same disk as the container, a careless `docker compose down -v` deletes it, and the files of a running database copied as they are often turn out inconsistent. So a copy of the database is taken with the database’s own tools. For postgres that is a dump, a file of SQL commands from which the database is rebuilt:\n\n```bash\ndocker compose exec -T db pg_dump -U postgres postgres > backup.sql\n```\n\nThe `-T` flag turns the terminal off so that only the output of `pg_dump` lands in the file, with no terminal control characters. The dump is kept not on the same server but elsewhere, for example in object storage. Restoring looks the same, only the other way round:\n\n```bash\ndocker compose exec -T db psql -U postgres postgres < backup.sql\n```\n\nA copy from which the database has never been restored guarantees nothing. So restoring is checked regularly on a separate setup: start an empty database, load the dump into it and see that the tables and the data are in place.',
      ),
    },
    {
      id: 'heredoc',
      kind: 'text',
      role: 'howto',
      step: 'practice',
      levels: ['beginner'],
      title: bi('Как записать compose.yaml без редактора', 'How to write compose.yaml without an editor'),
      body: bi(
        'Редактора в терминале тренажёра нет, поэтому файл записывают целиком одной командой. Команда `cat > compose.yaml <<\'EOF\'` велит оболочке записать в файл compose.yaml всё, что вы введёте дальше, вплоть до строки из одного слова `EOF`, а старое содержимое файла при этом пропадёт. В YAML важны отступы: вложенное поле сдвигают на два пробела вправо от родительского, а табуляцию вместо пробелов ставить нельзя.\n\nДля второго задания ниже приведён готовый файл целиком. От исходного он отличается в двух местах: у сервиса db появился блок `healthcheck`, а у сервиса api короткая запись `depends_on` заменена длинной, с условием `condition: service_healthy`. Скопируйте весь блок, вставьте его в терминал и нажмите Enter, а затем выполните `docker compose up -d --force-recreate`.\n\n```bash\ncat > compose.yaml <<\'EOF\'\nservices:\n  db:\n    image: postgres:17-alpine\n    environment:\n      POSTGRES_PASSWORD: secret\n    volumes:\n      - db-data:/var/lib/postgresql/data\n    healthcheck:\n      test: [\"CMD-SHELL\", \"pg_isready -U postgres\"]\n      interval: 2s\n      retries: 10\n  api:\n    image: trainer/api:1.0\n    environment:\n      DB_HOST: db\n    ports:\n      - \"8000:8000\"\n    depends_on:\n      db:\n        condition: service_healthy\nvolumes:\n  db-data:\nEOF\n```',
        'The trainer’s terminal has no editor, so a file is written whole with one command. The command `cat > compose.yaml <<\'EOF\'` means: everything you type next, up to a line holding the single word `EOF`, write into compose.yaml instead of its old contents. Indentation matters in YAML: a nested field is shifted two spaces to the right of its parent, and tabs cannot be used instead of spaces.\n\nFor the second task the finished file is shown below in full. It differs from the original in two places: the db service got a `healthcheck` block, and the short `depends_on` of the api service is replaced with the long form, with the condition `condition: service_healthy`. Copy the whole block, paste it into the terminal and press Enter, then run `docker compose up -d --force-recreate`.\n\n```bash\ncat > compose.yaml <<\'EOF\'\nservices:\n  db:\n    image: postgres:17-alpine\n    environment:\n      POSTGRES_PASSWORD: secret\n    volumes:\n      - db-data:/var/lib/postgresql/data\n    healthcheck:\n      test: [\"CMD-SHELL\", \"pg_isready -U postgres\"]\n      interval: 2s\n      retries: 10\n  api:\n    image: trainer/api:1.0\n    environment:\n      DB_HOST: db\n    ports:\n      - \"8000:8000\"\n    depends_on:\n      db:\n        condition: service_healthy\nvolumes:\n  db-data:\nEOF\n```',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: dockerHost({ cwd: '~/shop', files: [{ path: '~/shop/compose.yaml', content: COMPOSE_RACE }] }, { pull: ['postgres:17-alpine', 'trainer/api:1.0', 'nginx:1.30-alpine', 'alpine:3.22'] }),
      intro: bi('В каталоге `~/shop` лежит compose.yaml с базой и API. Редактора на машине нет, поэтому файл удобно переписать целиком командой `cat > compose.yaml <<\'EOF\'`: после неё вставьте текст файла и закончите его строкой `EOF`. Машина учебная, и сломать её нельзя, а кнопка «Сбросить машину» вернёт исходный файл.', '`~/shop` holds a compose.yaml with a database and an API. There is no editor on the machine, so the file is easiest to rewrite whole with `cat > compose.yaml <<\'EOF\'`: after it paste the file text and end it with an `EOF` line. The machine is a training one and cannot be broken, and the “Reset this screen” button brings the original file back.'),
      tasks: [
        {
          id: 'up',
          prompt: bi('Запустите проект в фоне и посмотрите `docker compose ps -a`. Что стало с api? Причину покажет `docker compose logs api`.', 'Bring the project up in the background and look at `docker compose ps -a`. What happened to api? Why — in `docker compose logs api`.'),
          check: { when: "containers[name=shop-db-1].state=running && containers[name=shop-api-1]", stdout: /shop-api-1/ },
          chips: 'docker compose up -d; docker compose ps -a; docker compose logs api',
          concepts: ['docker.compose'],
          hints: { H1: bi('Сервис api запустился раньше, чем база стала готова принимать соединения.', 'api started before the database was ready.') },
        },
        {
          id: 'healthy',
          prompt: bi('Добавьте базе проверку готовности (healthcheck), а сервису api — ожидание `condition: service_healthy`. Пересоздайте проект командой `docker compose up -d --force-recreate`. После этого api должен работать и отвечать на `curl localhost:8000`.', 'Add a healthcheck to the database and a `condition: service_healthy` wait to api. Re-create the project (`docker compose up -d --force-recreate`): api must run and answer `curl localhost:8000`.'),
          check: {
            when: (f) => svc(f, 'api')?.state === 'running' && svc(f, 'db')?.health === 'healthy',
            fail: [{ if: (f) => svc(f, 'api')?.state !== 'running' && !svc(f, 'db')?.health, say: bi('У db нет проверки готовности, поэтому Compose не знает, когда база готова, и условию `service_healthy` нечего ждать.', 'db has no healthcheck — Compose cannot tell when it is ready. Without it there is nothing for `service_healthy` to wait for.'), concept: 'docker.healthcheck' }],
          },
          chips: 'cat > compose.yaml <<EOF … EOF; docker compose up -d --force-recreate',
          concepts: ['docker.healthcheck'],
          docRef: web('compose/how-tos/startup-order'),
          hints: { H1: bi('Нужны две правки: блок `healthcheck` у сервиса db и длинная форма `depends_on` с условием у сервиса api.', 'Two edits: a `healthcheck` block for db, the long form of `depends_on` with a condition for api.') },
        },
        {
          id: 'persist',
          prompt: bi('Убедитесь, что данные базы переживают пересоздание проекта. Для этого выполните `docker compose down`, а потом снова `up -d`. Том `shop_db-data` должен остаться и снова подключиться к db.', 'Make sure the database data survives a re-create: `docker compose down` and `up -d` again. The `shop_db-data` volume must stay and be attached to db again.'),
          check: {
            when: (f) => {
              const events = (f.docker as { events: { type: string; action: string; name: string }[] }).events;
              const networkCreated = events.filter((e) => e.type === 'network' && e.action === 'create' && e.name === 'shop_default').length;
              return !!svc(f, 'db') && svc(f, 'db')!.state === 'running' && svc(f, 'db')!.mounts.some((m) => m.source === 'shop_db-data') && networkCreated >= 2;
            },
          },
          chips: 'docker compose down && docker compose up -d && docker volume ls',
          concepts: ['docker.compose', 'docker.volume'],
          hints: { H1: bi('Команда `down` без `-v` тома не трогает.', '`down` without `-v` does not touch volumes.') },
        },
      ],
    },
    {
      id: 'find-wait',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Запустите проект и дождитесь, пока все сервисы станут здоровыми, одной командой, не вызывая `ps` в цикле. Нужный флаг найдите в справке `docker compose up`.', 'Bring the project up and wait until every service is healthy, with one command — no `ps` in a loop. Find the flag in the `docker compose up` help.'),
      ref: { page: 'help/docker-compose-up' },
      terminal: {
        setup: dockerHost({ cwd: '~/shop', files: [{ path: '~/shop/compose.yaml', content: COMPOSE_RACE.replace('    depends_on:\n      - db\n', '').replace('      - db-data:/var/lib/postgresql/data\n', '      - db-data:/var/lib/postgresql/data\n    healthcheck:\n      test: ["CMD-SHELL", "pg_isready -U postgres"]\n') }] }, { pull: ['postgres:17-alpine', 'trainer/api:1.0'] }),
        task: { id: 'wait', prompt: bi('Сервис db должен быть здоров к моменту, когда команда вернёт управление.', 'db is healthy when the command returns.'), check: { when: "containers[name=shop-db-1].health=healthy" }, docStep: 3, chips: 'docker compose up --help' },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: composeQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог урока', 'Summary'),
      body: bi('Файл compose.yaml хранит записанные команды `docker run` вместе с сетью и томами проекта, а `up` один раз приводит систему в соответствие с этим описанием. Запущенный сервис ещё не обязательно готов, поэтому нужны проверка готовности и условие `condition: service_healthy`. Команда `down -v` удаляет и данные, поэтому копию базы снимают дампом и проверяют, что из него можно восстановиться. Пароли в рабочем проекте держат вне compose.yaml.', 'compose.yaml is `docker run` written down plus the project’s network and volumes; `up` brings the system to it once. Started does not mean ready: a healthcheck and `condition: service_healthy`. `down -v` removes the data too, so a copy of the database is taken as a dump and checked by restoring from it. In a real project passwords are kept outside compose.yaml.'),
    },
  ],
};
