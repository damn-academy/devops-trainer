// m05. First steps with Docker: run, ps, logs, exec, stop, rm, -e, -p (04 §4.3).

import { bi } from '../../../core/i18n';
import type { Facts, Lesson, QuizItem } from '../../../core/types';
import { dockerHost, help, RU, SRC, web } from '../shared';

type C = { name: string; state: string; id: string; config: { Env: string[] }; hostConfig: { stopTimeout: number | null; restartPolicy: string } };
const containers = (f: Facts) => (f.containers as C[] | undefined) ?? [];

export const firstQuiz: QuizItem[] = [
  {
    id: 'containers.q.ps-after-echo',
    kind: 'predict-output',
    concepts: ['docker.lifecycle'],
    prompt: bi('Что напечатает `docker ps` сразу после `docker run alpine:3.22 echo hi`?', 'What does `docker ps` print right after `docker run alpine:3.22 echo hi`?'),
    command: 'docker run alpine:3.22 echo hi > /dev/null; docker ps',
    setup: dockerHost(),
    options: [
      { id: 'header', text: bi('Только строку заголовков: контейнер уже завершился', 'Only the header line: the container has already exited'), correct: true },
      { id: 'running', text: bi('Строку с контейнером alpine в состоянии Up', 'A line with the alpine container, Up'), why: bi('echo напечатал «hi» и вышел; процесс контейнера кончился — контейнер в состоянии Exited, а `docker ps` без `-a` показывает только работающие.', 'echo printed “hi” and exited; the container process ended — the container is Exited, and `docker ps` without `-a` shows only running ones.') },
      { id: 'hi', text: 'hi', why: bi('«hi» напечатал `docker run`; `docker ps` выводит таблицу контейнеров.', '`docker run` printed “hi”; `docker ps` prints a table of containers.') },
    ],
    explain: bi('Контейнер живёт, пока живёт его главный процесс. `docker ps -a` покажет его как `Exited (0)`.', 'A container lives as long as its main process does. `docker ps -a` shows it as `Exited (0)`.'),
  },
  {
    id: 'containers.q.exit-137',
    kind: 'mcq',
    concepts: ['docker.lifecycle'],
    prompt: bi('`docker stop app` ждал 10 секунд, и контейнер завершился с кодом 137. Что произошло?', '`docker stop app` waited 10 seconds and the container exited with code 137. What happened?'),
    options: [
      { id: 'kill', text: bi('Программа не завершилась по SIGTERM, и через 10 секунд Docker послал SIGKILL: 137 = 128 + 9', 'The program did not exit on SIGTERM, so after 10 seconds Docker sent SIGKILL: 137 = 128 + 9'), correct: true },
      { id: 'error', text: bi('Программа завершилась с ошибкой 137', 'The program exited with error 137'), why: bi('Коды больше 128 обычно означают «убит сигналом номер код − 128»; 9 — SIGKILL.', 'Codes above 128 usually mean “killed by signal number code − 128”; 9 is SIGKILL.') },
      { id: 'ok', text: bi('Это нормальное завершение', 'That is a normal exit'), why: bi('Нормальное завершение после SIGTERM — 0 (или 143, если программа умерла от SIGTERM). 137 значит, что её пришлось убить.', 'A normal exit after SIGTERM is 0 (or 143 if the program died from SIGTERM). 137 means it had to be killed.') },
    ],
    explain: bi('Почему программа не услышала SIGTERM, разберём в главе о Dockerfile: дело в PID 1.', 'Why the program did not hear SIGTERM we take apart in the Dockerfile chapter: it is about PID 1.'),
  },
  {
    id: 'containers.q.publish-which',
    kind: 'mcq',
    concepts: ['docker.publish'],
    prompt: bi('В `-p 8080:80` какое число — порт хоста?', 'In `-p 8080:80`, which number is the host port?'),
    options: [
      { id: '8080', text: '8080', correct: true },
      { id: '80', text: '80', why: bi('80 — порт внутри контейнера, на котором слушает nginx. Формат: ХОСТ:КОНТЕЙНЕР.', '80 is the port inside the container that nginx listens on. The format is HOST:CONTAINER.') },
    ],
    explain: bi('Запрос на 8080 хоста ядро переписывает (DNAT) на адрес контейнера и порт 80.', 'The kernel rewrites (DNAT) a request to host port 8080 to the container’s address and port 80.'),
  },
  {
    id: 'containers.q.cmd-effect',
    kind: 'match',
    concepts: ['docker.lifecycle'],
    prompt: bi('Сопоставьте команду и то, что она делает.', 'Match the command and what it does.'),
    pairs: [
      { id: 'psa', left: 'docker ps -a', right: bi('показать все контейнеры, включая завершившиеся', 'show all containers, including exited ones') },
      { id: 'logs', left: 'docker logs web', right: bi('показать stdout и stderr главного процесса', 'show the stdout and stderr of the main process') },
      { id: 'exec', left: 'docker exec web ls /', right: bi('запустить ещё один процесс в работающем контейнере', 'start one more process in a running container') },
      { id: 'rm', left: 'docker rm web', right: bi('удалить остановленный контейнер вместе с его записываемым слоем', 'remove a stopped container together with its writable layer') },
    ],
  },
  {
    id: 'containers.q.run-web',
    kind: 'fill-command',
    concepts: ['docker.lifecycle', 'docker.publish'],
    prompt: bi('Запустите nginx в фоне с именем `web` так, чтобы его страница открывалась на порту 8080 хоста.', 'Run nginx in the background named `web` so that its page opens on host port 8080.'),
    template: 'docker run ___ nginx:1.30-alpine',
    setup: dockerHost(),
    check: { when: "containers[name=web].state=running && http['localhost:8080'].status=200" },
    misconceptions: [{ match: '-p 80:8080', why: bi('Порядок ХОСТ:КОНТЕЙНЕР: `-p 80:8080` ведёт порт 80 хоста на порт 8080 контейнера, где nginx не слушает.', 'The order is HOST:CONTAINER: `-p 80:8080` leads host port 80 to container port 8080, where nginx does not listen.') }],
  },
];

export const firstStepsLesson: Lesson = {
  id: 'containers.first-steps',
  block: 'containers',
  title: bi('Первые шаги с Docker', 'First steps with Docker'),
  summary: bi('Что происходит, когда вы набираете `docker run`; запуск, просмотр, журналы, вход внутрь, остановка и удаление; переменные и порты.', 'What happens when you type `docker run`; running, listing, logs, getting inside, stopping and removing; variables and ports.'),
  introduces: ['docker.lifecycle', 'docker.env', 'docker.publish'],
  uses: ['docker.container', 'docker.runtime', 'docker.states'],
  tier: 'core',
  minutes: 40,
  sources: {
    en: [SRC.run, { title: 'docker container ls — Docker Docs', url: 'https://docs.docker.com/reference/cli/docker/container/ls/' }, { title: 'docker container logs — Docker Docs', url: 'https://docs.docker.com/reference/cli/docker/container/logs/' }, { title: 'docker container exec — Docker Docs', url: 'https://docs.docker.com/reference/cli/docker/container/exec/' }],
    ru: [RU.docker, SRC.k8sRuContainers],
  },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Теперь вы знаете, из чего сделан контейнер и кто его запускает. Время самой частой команды DevOps-инженера. Ведущий вопрос главы: **что именно произошло, когда я набрал `docker run`?**', 'Now you know what a container is made of and who starts it. Time for the most frequent command of a DevOps engineer. The leading question of the chapter: **what exactly happened when I typed `docker run`?**'),
    },
    {
      id: 'hello',
      kind: 'text',
      step: 'explain',
      title: bi('hello-world строка за строкой', 'hello-world line by line'),
      body: bi(
        'Команда `docker run hello-world` печатает несколько строк — и каждая соответствует звену цепочки из прошлой главы. «Unable to find image ‘hello-world:latest’ locally» — клиент попросил демон создать контейнер, а нужного шаблона на машине нет. «Pulling from library/hello-world … Pull complete» — демон скачал его из реестра Docker Hub. Дальше демон создал контейнер, запустил программу `/hello`, и её вывод пришёл к вам через shim и демон. Программа напечатала текст и вышла — значит, и контейнер завершился.\n\nШаблон, из которого запускают контейнер, называется образом; имя `nginx:1.30-alpine` состоит из имени репозитория (`nginx`) и тега (`1.30-alpine`) — версии. Без тега Docker подставит `latest`. Как устроен образ изнутри, разберём через одну главу; пока достаточно читать имя.',
        'The command `docker run hello-world` prints a few lines — and each matches a link of the chain from the last chapter. “Unable to find image ‘hello-world:latest’ locally” — the client asked the daemon to create a container, and the template is not on the machine. “Pulling from library/hello-world … Pull complete” — the daemon downloaded it from the Docker Hub registry. Then the daemon created the container, started the `/hello` program, and its output came to you through the shim and the daemon. The program printed its text and exited — so the container ended too.\n\nThe template a container starts from is called an image; the name `nginx:1.30-alpine` is a repository name (`nginx`) and a tag (`1.30-alpine`) — a version. Without a tag Docker uses `latest`. How an image is built inside we take apart in two chapters; for now it is enough to read the name.',
      ),
    },
    {
      id: 'lifecycle',
      kind: 'text',
      step: 'explain',
      title: bi('Жизненный цикл: шесть команд', 'The lifecycle: six commands'),
      body: bi(
        '[[docker.lifecycle|Жизненный цикл контейнера]] в Docker держится на шести командах.\n\n- `docker run` создаёт и запускает. Флаг `-d` уводит контейнер в фон и печатает его ID; `--name web` даёт имя; `--rm` удалит контейнер, когда он завершится; `-it` подключает ваш терминал к процессу внутри.\n- `docker ps` показывает работающие контейнеры, `docker ps -a` — все, включая завершившиеся: `Exited (0)` — вышел сам с кодом 0.\n- `docker logs web` показывает, что главный процесс писал в stdout и stderr — их держит shim.\n- `docker exec web ls /` запускает ещё один процесс в уже работающем контейнере; `docker exec -it web sh` — оболочку внутри.\n- `docker stop web` посылает сигнал SIGTERM и ждёт 10 секунд; не помогло — SIGKILL. Коды выхода: 0 — вышел сам; 143 = 128 + 15 — умер от SIGTERM; 137 = 128 + 9 — убит SIGKILL.\n- `docker rm web` удаляет остановленный контейнер, а с ним и всё, что он записал в свой записываемый слой.',
        'The [[docker.lifecycle|container lifecycle]] in Docker rests on six commands.\n\n- `docker run` creates and starts. The `-d` flag sends the container to the background and prints its ID; `--name web` gives it a name; `--rm` removes the container when it exits; `-it` attaches your terminal to the process inside.\n- `docker ps` shows running containers, `docker ps -a` all of them, including exited ones: `Exited (0)` means it exited by itself with code 0.\n- `docker logs web` shows what the main process wrote to stdout and stderr — the shim holds them.\n- `docker exec web ls /` starts one more process in an already running container; `docker exec -it web sh` a shell inside.\n- `docker stop web` sends the SIGTERM signal and waits 10 seconds; if that does not help — SIGKILL. Exit codes: 0 — exited by itself; 143 = 128 + 15 — died from SIGTERM; 137 = 128 + 9 — killed by SIGKILL.\n- `docker rm web` removes a stopped container, and with it everything it wrote into its writable layer.',
      ),
    },
    {
      id: 'env-ports',
      kind: 'text',
      step: 'explain',
      title: bi('Переменные и порты', 'Variables and ports'),
      body: bi(
        'Один и тот же образ работает и у разработчика, и в продакшене; различаются настройки. Их передают [[docker.env|переменными окружения]]: `-e POSTGRES_PASSWORD=secret` или файлом `--env-file app.env`. Если программе нужна переменная, а её не передали, она обычно сразу завершается — и причина видна в `docker logs`.\n\nКонтейнер живёт в своём сетевом пространстве имён со своим адресом вида 172.17.0.2. Снаружи туда не попасть, пока порт не опубликован. [[docker.publish|Публикация порта]] `-p 8080:80` значит: «порт 8080 хоста веди на порт 80 контейнера». Первое число — хост, второе — контейнер. Под капотом это правило DNAT в netfilter, которое вы писали руками в блоке сетей.',
        'The same image runs on the developer’s laptop and in production; what differs is the settings. They are passed as [[docker.env|environment variables]]: `-e POSTGRES_PASSWORD=secret` or a file `--env-file app.env`. If a program needs a variable and it was not passed, it usually exits at once — and the reason is in `docker logs`.\n\nA container lives in its own network namespace with its own address like 172.17.0.2. It cannot be reached from outside until a port is published. [[docker.publish|Publishing a port]] `-p 8080:80` means: “lead port 8080 of the host to port 80 of the container”. The first number is the host, the second the container. Underneath it is a DNAT rule in netfilter, which you wrote by hand in the networks block.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: dockerHost(),
      intro: bi('Машина с Docker; образы alpine и nginx уже скачаны. `curl localhost:8080` откроет страницу так, как её увидел бы браузер.', 'A machine with Docker; the alpine and nginx images are already pulled. `curl localhost:8080` opens a page as a browser would see it.'),
      tasks: [
        {
          id: 'hello',
          prompt: bi('Запустите `hello-world` и найдите завершившийся контейнер в списке всех контейнеров.', 'Run `hello-world` and find the exited container in the list of all containers.'),
          check: { when: 'containers[image=hello-world].state=exited && containers[image=hello-world].exitCode=0', stdout: /Exited \(0\)/ },
          chips: 'docker run hello-world; docker ps -a',
          concepts: ['docker.lifecycle'],
          docRef: help('ps', 'OPTIONS', '--all'),
          hints: { H1: bi('`docker ps` без флагов показывает только работающие.', '`docker ps` without flags shows only running ones.'), H2: bi('Нужен флаг «показать все».', 'You need the “show all” flag.') },
        },
        {
          id: 'web',
          prompt: bi('Запустите nginx в фоне с именем `web` так, чтобы `curl localhost:8080` показал его стартовую страницу.', 'Run nginx in the background named `web` so that `curl localhost:8080` shows its start page.'),
          check: {
            when: "containers[name=web].state=running && containers[name=web].ports[hostPort=8080].containerPort=80 && http['localhost:8080'].status=200",
            fail: [
              { if: 'containers[name=web].state=running && containers[name=web].ports#=0', say: bi('Контейнер работает, но порт не опубликован: снаружи до него не дойти. Нужен `-p ХОСТ:КОНТЕЙНЕР`.', 'The container runs, but no port is published: it cannot be reached from outside. You need `-p HOST:CONTAINER`.'), concept: 'docker.publish' },
              { if: 'containers[name=web].ports[hostPort=80]', say: bi('Порты перепутаны местами: первым идёт порт хоста (8080), вторым — порт nginx в контейнере (80).', 'The ports are swapped: the host port (8080) comes first, the nginx port in the container (80) second.'), concept: 'docker.publish' },
            ],
          },
          chips: 'docker run -d --name web -p 8080:80 nginx:1.30-alpine',
          concepts: ['docker.lifecycle', 'docker.publish'],
          docRef: web('reference/cli/docker/container/run', 'publish', 'The first number is the port on the host'),
          hints: { H1: bi('Три флага: фон, имя, публикация порта.', 'Three flags: background, name, publishing a port.'), H2: bi('`-d`, `--name web`, `-p 8080:80`.', '`-d`, `--name web`, `-p 8080:80`.') },
        },
        {
          id: 'page',
          prompt: bi('Зайдите в `web` и замените стартовую страницу `/usr/share/nginx/html/index.html` текстом «Hello, DevOps». Проверьте curl-ом.', 'Get into `web` and replace the start page `/usr/share/nginx/html/index.html` with the text “Hello, DevOps”. Check with curl.'),
          check: { when: "http['localhost:8080'].body~'Hello, DevOps'" },
          chips: "docker exec web sh -c 'echo Hello, DevOps > /usr/share/nginx/html/index.html'",
          concepts: ['docker.lifecycle'],
          hints: { H1: bi('Команду внутри работающего контейнера запускает `docker exec`.', '`docker exec` runs a command inside a running container.'), H2: bi('Можно войти оболочкой: `docker exec -it web sh`, и там `echo … > файл`.', 'You can enter with a shell: `docker exec -it web sh`, then `echo … > file`.') },
        },
        {
          id: 'env',
          prompt: bi('Запустите базу `postgres:17-alpine` в фоне с именем `db`. Она завершится сразу — узнайте из журнала почему, удалите её и запустите правильно.', 'Run the `postgres:17-alpine` database in the background named `db`. It exits at once — find out why from the log, remove it and run it properly.'),
          check: {
            when: (f) => containers(f).some((c) => c.name === 'db' && c.state === 'running' && c.config.Env.some((e) => /^POSTGRES_PASSWORD=.+/.test(e))),
            fail: [{ if: 'containers[name=db].state=exited', say: bi('Контейнер `db` завершился. Что написано в `docker logs db`?', 'The `db` container exited. What does `docker logs db` say?'), concept: 'docker.env' }],
          },
          chips: 'docker logs db; docker rm db; docker run -d --name db -e POSTGRES_PASSWORD=secret postgres:17-alpine',
          concepts: ['docker.env'],
          docRef: web('reference/cli/docker/container/run', 'env'),
          hints: { H1: bi('Журнал называет нужную переменную.', 'The log names the variable it needs.'), H2: bi('Переменную передают флагом `-e ИМЯ=значение`.', 'A variable is passed with `-e NAME=value`.') },
        },
        {
          id: 'interactive',
          prompt: bi('Запустите контейнер `box` из alpine так, чтобы он не завершился сразу, и выполните в нём `ps`.', 'Run a `box` container from alpine so that it does not exit at once, and run `ps` in it.'),
          check: { when: "containers[name=box].state=running", stdout: /PID\s+USER/ },
          chips: 'docker run -dit --name box alpine:3.22; docker exec box ps',
          concepts: ['docker.lifecycle'],
          docRef: help('run', 'OPTIONS', '--interactive'),
          hints: { H1: bi('Оболочка без терминала сразу видит конец ввода и выходит. Ей нужен открытый stdin и терминал.', 'A shell without a terminal sees the end of input at once and exits. It needs an open stdin and a terminal.'), H2: bi('`-i` держит stdin открытым, `-t` выделяет терминал, `-d` уводит в фон.', '`-i` keeps stdin open, `-t` allocates a terminal, `-d` sends it to the background.') },
        },
        {
          id: 'cleanup',
          prompt: bi('Остановите и удалите все контейнеры, кроме `web`; `web` должен продолжать работать.', 'Stop and remove every container except `web`; `web` must keep running.'),
          check: {
            when: (f) => containers(f).length === 1 && containers(f)[0].name === 'web' && containers(f)[0].state === 'running',
            fail: [{ if: '!containers[name=web]', say: bi('`web` тоже удалён — запустите его снова, как во втором задании.', '`web` is removed too — start it again as in the second task.') }],
          },
          chips: 'docker rm -f db box; docker container prune -f',
          concepts: ['docker.lifecycle'],
          docRef: help('rm', 'OPTIONS', '--force'),
          hints: { H1: bi('Работающий контейнер `docker rm` не удалит без особого флага.', '`docker rm` will not remove a running container without a special flag.'), H2: bi('Посмотрите флаги в `docker rm --help`.', 'Look at the flags in `docker rm --help`.') },
        },
      ],
    },
    {
      id: 'anatomy-help',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Справка `docker run --help` делится на части: Usage, Aliases, Options. В какой части написано, что `docker run` и `docker container run` — одна команда?', '`docker run --help` is divided into parts: Usage, Aliases, Options. In which part does it say that `docker run` and `docker container run` are one command?'),
      ref: { page: 'help/docker-run' },
      answer: 'ALIASES',
    },
    {
      id: 'find-timeout',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Запустите nginx с именем `web2` так, чтобы на корректное завершение у него было 30 секунд, — не меняя образ и ничего не передавая в `docker stop`. Нужный флаг найдите в справке.', 'Run nginx named `web2` so that it gets 30 seconds to exit cleanly — without changing the image and without passing anything to `docker stop`. Find the flag in the help.'),
      ref: help('run'),
      terminal: {
        setup: dockerHost(),
        task: { id: 'stop-timeout', prompt: bi('Контейнер `web2` с 30 секундами на остановку.', 'A `web2` container with 30 seconds to stop.'), check: { when: 'containers[name=web2].hostConfig.stopTimeout=30' }, docStep: 3, chips: 'docker run --help' },
      },
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      levels: ['intermediate', 'experienced'],
      mode: 'find',
      prompt: bi('Контейнер `web` уже работает. Сделайте так, чтобы после перезагрузки машины он поднимался сам, — не пересоздавая его. В теории этого не было.', 'The `web` container is already running. Make it come back by itself after the machine reboots — without re-creating it. This was not in the theory.'),
      ref: { page: 'help/docker-update' },
      terminal: {
        setup: dockerHost({}, { run: ['docker run -d --name web -p 8080:80 nginx:1.30-alpine'] }),
        task: {
          id: 'update-restart',
          prompt: bi('Тот же `web` (тот же ID) с политикой перезапуска.', 'The same `web` (the same ID) with a restart policy.'),
          check: { when: (f, s) => containers(f).some((c) => c.name === 'web' && c.hostConfig.restartPolicy !== 'no' && containers(s ?? f).some((x) => x.name === 'web' && x.id === c.id)) },
          docStep: 4,
          beyond: true,
          solutionTokens: ['update', '--restart', 'unless-stopped', 'always'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: firstQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог', 'Summary'),
      body: bi('`docker run` = скачать образ, если нет, создать контейнер и запустить процесс. Контейнер живёт, пока живёт его процесс. `ps -a`, `logs`, `exec`, `stop`, `rm` — главные инструменты; настройки — через `-e`, доступ снаружи — через `-p ХОСТ:КОНТЕЙНЕР`.', '`docker run` = pull the image if missing, create a container and start the process. A container lives as long as its process. `ps -a`, `logs`, `exec`, `stop`, `rm` are the main tools; settings go through `-e`, outside access through `-p HOST:CONTAINER`.'),
    },
  ],
};
