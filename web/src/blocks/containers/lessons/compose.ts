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
      { id: 'no', text: bi('Нет: Compose ждёт только запуска контейнера db, а не готовности базы', 'No: Compose waits only for the db container to start, not for the database to be ready'), correct: true },
      { id: 'yes', text: bi('Да, Compose ждёт, пока сервис заработает', 'Yes, Compose waits until the service works'), why: bi('Запущенный сервис и готовый сервис — разные вещи: после запуска процесса postgres ещё секунды две готовит базу.', '“Started” and “ready” are different: postgres initialises for a couple of seconds after its process starts.') },
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
      3: bi('Образ указан верно.', 'The image is right.'),
      5: bi('Образ указан верно.', 'The image is right.'),
      7: bi('Внутри контейнера api адрес `localhost` указывает на сам api. База работает в другом контейнере, и в сети проекта её имя `db`.', '`localhost` inside the api container is api itself. The database is another container; on the project network its name is `db`.'),
    },
  },
  {
    id: 'containers.q.compose-vs-run',
    kind: 'mcq',
    concepts: ['docker.compose'],
    prompt: bi('Чем `docker compose up -d` отличается от трёх команд `docker run`?', 'How does `docker compose up -d` differ from three `docker run` commands?'),
    options: [
      { id: 'decl', text: bi('Описание лежит в файле, а Compose приводит систему в соответствие с ним: создаёт сеть и тома проекта, запускает сервисы в порядке зависимостей и не трогает то, что уже совпадает с описанием', 'The description lives in a file and Compose brings the system to it: it creates the project network and volumes, starts services in dependency order and leaves alone what already matches'), correct: true },
      { id: 'vm', text: bi('Compose запускает сервисы в отдельной виртуальной машине', 'Compose runs services in a separate VM'), why: bi('Это те же контейнеры того же движка Docker, а разница только в описании и порядке запуска.', 'The same containers of the same engine; the difference is the description and the order.') },
      { id: 'loop', text: bi('Compose постоянно следит за сервисами и чинит их', 'Compose constantly watches services and repairs them'), why: bi('Команда `up` один раз приводит систему в соответствие с описанием и завершается, а перезапуском упавших контейнеров занимается политика restart движка Docker. Бесконечный цикл сверки появится уже в Kubernetes.', '`up` brings the system to the description once and returns; restarting fallen ones is the engine’s restart policy. An endless reconciliation loop is Kubernetes.') },
    ],
  },
];

export const composeLesson: Lesson = {
  id: 'containers.compose',
  block: 'containers',
  title: bi('Compose: несколько контейнеров в одном файле', 'Compose: several containers in one file'),
  summary: bi('Как описать приложение из нескольких сервисов так, чтобы запускать его одной командой, и как дождаться, пока база будет готова.', 'How to describe an application of several services so it comes up with one command, and how to wait for the database to be ready.'),
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
      body: bi('Приложение из базы данных, API и веб-сервера требует сеть, том и три команды `docker run` с десятком флагов у каждой. Набирать их нужно в правильном порядке на каждой машине, и никто не помнит, с какими флагами запускали в прошлый раз. Глава отвечает на вопрос: **как описать три контейнера так, чтобы их можно было запустить одной командой?**', 'An application of a database, an API and a web server is a network, a volume and three `docker run` commands with a dozen flags each. They must be typed in the right order on every machine, and nobody remembers the flags from last time. The leading question: **how to describe three containers so they come up with one command?**'),
    },
    {
      id: 'file',
      kind: 'text',
      step: 'explain',
      title: bi('Как compose.yaml записывает команды docker run в файл', 'How compose.yaml writes docker run commands down'),
      body: bi(
        '[[docker.compose|Docker Compose]] читает файл `compose.yaml` и создаёт по нему проект. Каждый сервис в этом файле — тот же `docker run`, только записанный полями YAML: `image`, `environment` вместо `-e`, `ports` вместо `-p`, `volumes` вместо `-v` и `command` вместо аргументов. По умолчанию проект называется так же, как каталог, поэтому в `~/shop` контейнеры получат имена `shop-db-1` и `shop-api-1`.\n\nДля проекта Compose сам создаёт сеть `shop_default` и подключает к ней все сервисы, поэтому сервисы сразу находят друг друга по имени, например `DB_HOST: db`. Тома, объявленные в разделе `volumes:` верхнего уровня, получают имена вида `shop_db-data`.\n\n```yaml\nservices:\n  db:\n    image: postgres:17-alpine\n    environment:\n      POSTGRES_PASSWORD: secret\n    volumes:\n      - db-data:/var/lib/postgresql/data\n  api:\n    image: trainer/api:1.0\n    environment:\n      DB_HOST: db\n    ports:\n      - "8000:8000"\nvolumes:\n  db-data:\n```\n\nКоманда `docker compose up -d` запускает проект, `ps` показывает его контейнеры, `logs` — их журналы, а `down` удаляет контейнеры и сеть, причём с флагом `-v` ещё и тома, то есть данные. Переменные из файла `.env`, лежащего рядом, подставляются на место `${ИМЯ}`, а `docker compose config` показывает итоговое описание после подстановки.',
        '[[docker.compose|Docker Compose]] reads a `compose.yaml` file and makes a project of it. Each service is the same `docker run`, only written as YAML fields: `image`, `environment` instead of `-e`, `ports` instead of `-p`, `volumes` instead of `-v`, `command` instead of arguments. The project name is the directory name by default: in `~/shop` the containers are called `shop-db-1`, `shop-api-1`.\n\nFor the project Compose itself creates a `shop_default` network and attaches every service to it, so they find each other by service name at once — `DB_HOST: db`. Volumes declared in the top-level `volumes:` section become `shop_db-data`.\n\n```yaml\nservices:\n  db:\n    image: postgres:17-alpine\n    environment:\n      POSTGRES_PASSWORD: secret\n    volumes:\n      - db-data:/var/lib/postgresql/data\n  api:\n    image: trainer/api:1.0\n    environment:\n      DB_HOST: db\n    ports:\n      - "8000:8000"\nvolumes:\n  db-data:\n```\n\nCommands: `docker compose up -d` brings the project up, `ps` shows its containers, `logs` their logs, `down` removes the containers and the network (with `-v` the volumes too — that is, the data). Variables from an `.env` file next to it fill `${NAME}`; `docker compose config` shows the final description.',
      ),
    },
    {
      id: 'ready',
      kind: 'text',
      step: 'explain',
      title: bi('Почему запущенный сервис ещё не готов к работе', 'Why a started service is not yet ready'),
      body: bi(
        'Строка `depends_on: [db]` говорит Compose: «запусти db раньше api». Но запущенный процесс postgres ещё пару секунд создаёт файлы базы и не принимает соединений. Если API пытается подключиться к базе сразу при старте, сервис api завершается с ошибкой `Connection refused`.\n\nЧтобы ждать готовности, нужна [[docker.healthcheck|проверка готовности]], то есть команда, которой Docker периодически опрашивает сервис, и условие в `depends_on`:\n\n```yaml\n  db:\n    healthcheck:\n      test: ["CMD-SHELL", "pg_isready -U postgres"]\n      interval: 2s\n      retries: 10\n  api:\n    depends_on:\n      db:\n        condition: service_healthy\n```\n\nРядом с этим работает политика перезапуска `restart: on-failure` или `unless-stopped`: если контейнер завершился с ошибкой, Docker запустит его снова. Получается маленький местный цикл: контейнер завершился, и Docker запускает его заново. Сама команда `compose up` приводит систему в соответствие с описанием один раз и завершается, а в Kubernetes на смену такому однократному запуску придёт цикл сверки, который непрерывно сравнивает описание с тем, что на самом деле работает.',
        '`depends_on: [db]` tells Compose: “start db before api”. But a started postgres process spends another couple of seconds creating the database files and does not accept connections. An API that tries to connect right at start falls over with `Connection refused`.\n\nTo wait for readiness you need a [[docker.healthcheck|healthcheck]] — a command Docker periodically runs against the service — and a condition in `depends_on`:\n\n```yaml\n  db:\n    healthcheck:\n      test: ["CMD-SHELL", "pg_isready -U postgres"]\n      interval: 2s\n      retries: 10\n  api:\n    depends_on:\n      db:\n        condition: service_healthy\n```\n\nNext to it stands the restart policy `restart: on-failure` or `unless-stopped`: fell — bring it back. That is a small local loop “fell → start again”. `compose up` brings the system to the description once and returns; in Kubernetes this becomes a reconciliation loop that compares the desired and the actual state endlessly.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: dockerHost({ cwd: '~/shop', files: [{ path: '~/shop/compose.yaml', content: COMPOSE_RACE }] }, { pull: ['postgres:17-alpine', 'trainer/api:1.0', 'nginx:1.30-alpine', 'alpine:3.22'] }),
      intro: bi('В каталоге `~/shop` лежит compose.yaml с базой и API. Файлы удобно писать целиком: `cat > compose.yaml <<\'EOF\'` … `EOF`.', '`~/shop` holds a compose.yaml with a database and an API. Files are easiest to write whole: `cat > compose.yaml <<\'EOF\'` … `EOF`.'),
      tasks: [
        {
          id: 'up',
          prompt: bi('Запустите проект в фоне и посмотрите `docker compose ps -a`. Что стало с api? Причину покажет `docker compose logs api`.', 'Bring the project up in the background and look at `docker compose ps -a`. What happened to api? Why — in `docker compose logs api`.'),
          check: { when: "containers[name=shop-db-1].state=running && containers[name=shop-api-1]", stdout: /shop-api-1/ },
          chips: 'docker compose up -d; docker compose ps -a; docker compose logs api',
          concepts: ['docker.compose'],
          hints: { H1: bi('api запустился раньше, чем база стала готова принимать соединения.', 'api started before the database was ready.') },
        },
        {
          id: 'healthy',
          prompt: bi('Добавьте базе проверку готовности (healthcheck), а сервису api — ожидание `condition: service_healthy`. Пересоздайте проект командой `docker compose up -d --force-recreate`: api должен работать и отвечать на `curl localhost:8000`.', 'Add a healthcheck to the database and a `condition: service_healthy` wait to api. Re-create the project (`docker compose up -d --force-recreate`): api must run and answer `curl localhost:8000`.'),
          check: {
            when: (f) => svc(f, 'api')?.state === 'running' && svc(f, 'db')?.health === 'healthy',
            fail: [{ if: (f) => svc(f, 'api')?.state !== 'running' && !svc(f, 'db')?.health, say: bi('У db нет проверки готовности, поэтому Compose не знает, когда база готова, и условию `service_healthy` нечего ждать.', 'db has no healthcheck — Compose cannot tell when it is ready. Without it there is nothing for `service_healthy` to wait for.'), concept: 'docker.healthcheck' }],
          },
          chips: 'cat > compose.yaml <<EOF … EOF; docker compose up -d --force-recreate',
          concepts: ['docker.healthcheck'],
          docRef: web('compose/how-tos/startup-order'),
          hints: { H1: bi('Нужны две правки: у db блок `healthcheck`, у api длинная форма `depends_on` с условием.', 'Two edits: a `healthcheck` block for db, the long form of `depends_on` with a condition for api.') },
        },
        {
          id: 'persist',
          prompt: bi('Убедитесь, что данные базы переживают пересоздание проекта: выполните `docker compose down`, а потом снова `up -d`. Том `shop_db-data` должен остаться и снова подключиться к db.', 'Make sure the database data survives a re-create: `docker compose down` and `up -d` again. The `shop_db-data` volume must stay and be attached to db again.'),
          check: { when: (f) => !!svc(f, 'db') && svc(f, 'db')!.state === 'running' && svc(f, 'db')!.mounts.some((m) => m.source === 'shop_db-data') && ((f.docker as { events: { action: string; name: string }[] }).events.some((e) => e.action === 'destroy' && e.name === 'shop-db-1')) },
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
      title: bi('Итог главы', 'Summary'),
      body: bi('compose.yaml — это записанные в файл команды `docker run` вместе с сетью и томами проекта, а `up` один раз приводит систему в соответствие с этим описанием. Запущенный сервис ещё не обязательно готов, поэтому нужны проверка готовности и условие `condition: service_healthy`. Команда `down -v` удаляет и данные.', 'compose.yaml is `docker run` written down plus the project’s network and volumes; `up` brings the system to it once. Started does not mean ready: a healthcheck and `condition: service_healthy`. `down -v` removes the data too.'),
    },
  ],
};
