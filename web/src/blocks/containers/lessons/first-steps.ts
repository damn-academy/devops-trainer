// m05. First steps with Docker: run, ps, logs, exec, stop, rm, -e, -p (04 §4.3).

import { lastOutput } from '../../../core/check';
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
    prompt: bi('Что напечатает `docker ps` сразу после команды `docker run alpine:3.22 echo hi`?', 'What does `docker ps` print right after `docker run alpine:3.22 echo hi`?'),
    command: 'docker run alpine:3.22 echo hi > /dev/null; docker ps',
    setup: dockerHost(),
    options: [
      { id: 'header', text: bi('Только строку заголовков, потому что контейнер уже завершился', 'Only the header line: the container has already exited'), correct: true },
      { id: 'running', text: bi('Строку с контейнером alpine в состоянии Up', 'A line with the alpine container, Up'), why: bi('Команда echo напечатала «hi» и завершилась, а вместе с ней завершился и процесс контейнера. Контейнер теперь в состоянии Exited, а `docker ps` без `-a` показывает только работающие контейнеры.', 'echo printed “hi” and exited; the container process ended — the container is Exited, and `docker ps` without `-a` shows only running ones.') },
      { id: 'hi', text: 'hi', why: bi('Строку «hi» напечатала команда `docker run`, а `docker ps` выводит таблицу контейнеров.', '`docker run` printed “hi”; `docker ps` prints a table of containers.') },
    ],
    explain: bi('Контейнер работает, пока работает его главный процесс. Команда `docker ps -a` покажет этот контейнер в состоянии `Exited (0)`.', 'A container lives as long as its main process does. `docker ps -a` shows it as `Exited (0)`.'),
  },
  {
    id: 'containers.q.exit-137',
    kind: 'mcq',
    concepts: ['docker.lifecycle'],
    prompt: bi('Команда `docker stop app` ждала 10 секунд, и контейнер завершился с кодом 137. Что произошло?', '`docker stop app` waited 10 seconds and the container exited with code 137. What happened?'),
    options: [
      { id: 'kill', text: bi('Программа не завершилась по сигналу SIGTERM, и через 10 секунд Docker послал SIGKILL с номером 9, отсюда и код 137, то есть 128 + 9', 'The program did not exit on SIGTERM, so after 10 seconds Docker sent SIGKILL, number 9, hence the code 137, that is 128 + 9'), correct: true },
      { id: 'error', text: bi('Программа сама завершилась с ошибкой 137', 'The program exited with error 137'), why: bi('Код больше 128 обычно означает, что процесс завершён сигналом, номер которого равен коду минус 128. Здесь номер сигнала равен 9, а это SIGKILL.', 'Codes above 128 usually mean “killed by signal number code − 128”; 9 is SIGKILL.') },
      { id: 'ok', text: bi('Контейнер завершился нормально', 'The container exited normally'), why: bi('Если программа обработала SIGTERM и завершилась сама, код обычно равен 0, а если обработчика не было и её завершил сам сигнал SIGTERM, код равен 143. Код 137 значит, что программу пришлось завершить принудительно.', 'A normal exit after SIGTERM is 0 (or 143 if the program died from SIGTERM). 137 means it had to be killed.') },
    ],
    explain: bi('Почему программа не отреагировала на SIGTERM, мы разберём в уроке о Dockerfile. Причина связана с тем, какая программа работает в контейнере первым процессом, PID 1.', 'Why the program did not hear SIGTERM we take apart in the Dockerfile lesson: it is about PID 1.'),
  },
  {
    id: 'containers.q.run-twice',
    kind: 'mcq',
    concepts: ['docker.lifecycle'],
    prompt: bi('Вы выполнили `docker run -d nginx:1.30-alpine`, потом остановили этот контейнер командой `docker stop` и снова выполнили `docker run -d nginx:1.30-alpine`. Сколько контейнеров покажет `docker ps -a`?', 'You ran `docker run -d nginx:1.30-alpine`, then stopped that container with `docker stop` and ran `docker run -d nginx:1.30-alpine` again. How many containers does `docker ps -a` show?'),
    options: [
      { id: 'two', text: bi('Два контейнера, первый в состоянии Exited, а второй работающий', 'Two containers, the first one Exited and the second one running'), correct: true },
      { id: 'one', text: bi('Один, потому что второй `docker run` снова запустил первый контейнер', 'One, because the second `docker run` started the first container again'), why: bi('`docker run` всегда создаёт из образа новый контейнер. Снова запускает тот же контейнер другая команда, `docker start`.', '`docker run` always creates a new container from the image. Another command, `docker start`, starts the same container again.') },
      { id: 'conflict', text: bi('Ни одного нового, потому что второй запуск закончится ошибкой Conflict', 'No new one, because the second run ends with a Conflict error'), why: bi('Ошибка Conflict возникает, только когда вы даёте второму контейнеру уже занятое имя флагом `--name`. Здесь имён нет, и Docker придумывает каждому контейнеру своё.', 'A Conflict error appears only when you give a second container a taken name with `--name`. There are no names here, and Docker makes up a name for each container.') },
    ],
    explain: bi('Остановленный контейнер вместе с его файлами остаётся на машине, пока его не удалят командой `docker rm`, и запустить его снова можно командой `docker start`. Поэтому после экспериментов в `docker ps -a` копятся старые контейнеры, а флаг `--rm` удаляет контейнер сам, когда тот завершится.', 'A stopped container stays on the machine with its files until `docker rm` removes it, and `docker start` can start it again. That is why old containers pile up in `docker ps -a` after experiments, while the `--rm` flag removes a container by itself when it exits.'),
  },
  {
    id: 'containers.q.exec-exited',
    kind: 'mcq',
    concepts: ['docker.lifecycle'],
    prompt: bi('Контейнер `api` завершился через секунду после запуска с кодом 1. Вы набираете `docker exec -it api sh`, чтобы посмотреть, что у него внутри. Что произойдёт?', 'The `api` container exited a second after it started, with code 1. You type `docker exec -it api sh` to look inside. What happens?'),
    options: [
      { id: 'error', text: bi('Docker ответит ошибкой, что контейнер не работает, и оболочка не откроется', 'Docker answers with an error that the container is not running, and no shell opens'), correct: true },
      { id: 'shell', text: bi('Откроется оболочка в остановленном контейнере, где можно посмотреть файлы', 'A shell opens in the stopped container, where you can look at the files'), why: bi('`docker exec` запускает новый процесс рядом с работающими, а в завершившемся контейнере процессов нет. Файлы остановленного контейнера можно скопировать командой `docker cp`, но войти внутрь нельзя.', '`docker exec` starts a new process next to the running ones, and an exited container has no processes. The files of a stopped container can be copied with `docker cp`, but you cannot get inside.') },
      { id: 'restart', text: bi('Docker сам запустит контейнер заново и откроет в нём оболочку', 'Docker starts the container again by itself and opens a shell in it'), why: bi('Сам Docker контейнер не перезапускает. Даже если запустить его командой `docker start`, программа снова завершится через секунду с той же ошибкой.', 'Docker does not restart the container by itself. Even if you start it with `docker start`, the program exits again a second later with the same error.') },
    ],
    explain: bi('Причину завершения сначала читают в `docker logs api`. Если нужно осмотреть файлы образа, запускают рядом новый контейнер, у которого вместо программы образа работает оболочка: `docker run -it --rm ОБРАЗ sh`.', 'The reason for the exit is read first in `docker logs api`. To inspect the image’s files you start a new container next to it in which a shell runs instead of the image’s program: `docker run -it --rm IMAGE sh`.'),
  },
  {
    id: 'containers.q.socket-denied',
    kind: 'mcq',
    concepts: ['docker.lifecycle'],
    prompt: bi('Вы впервые вошли на рабочий сервер под своим пользователем и набрали `docker ps`. В ответ пришло `permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock`. Что случилось?', 'You logged in to a work server as your own user for the first time and typed `docker ps`. The answer was `permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock`. What happened?'),
    options: [
      { id: 'group', text: bi('Демон работает, но клиенту не дают открыть сокет: файл принадлежит root и группе docker, а ваш пользователь не в этой группе', 'The daemon runs, but the client may not open the socket: the file belongs to root and the docker group, and your user is not in that group'), correct: true },
      { id: 'down', text: bi('Демон dockerd на сервере не запущен, и его нужно запустить', 'The dockerd daemon is not running on the server and must be started'), why: bi('Когда демон не запущен, сообщение другое: `Cannot connect to the Docker daemon … Is the docker daemon running?`. Здесь сокет существует, и отказ пришёл из-за прав на него.', 'When the daemon is not running, the message is different: `Cannot connect to the Docker daemon … Is the docker daemon running?`. Here the socket exists, and the refusal came from its permissions.') },
      { id: 'sudo', text: bi('Docker всегда требует прав root, и к каждой команде нужно дописывать sudo', 'Docker always needs root, and every command needs sudo in front'), why: bi('С sudo команда сработает, но причина не в Docker, а в правах на файл сокета. Пользователя можно добавить в группу docker, и тогда sudo не понадобится.', 'With sudo the command works, but the cause is not Docker but the permissions on the socket file. The user can be added to the docker group, and then sudo is not needed.') },
    ],
    explain: bi('Пользователя добавляют в группу командой `sudo usermod -aG docker $USER` и входят заново. Но членство в группе docker равно правам root на этом сервере: такой пользователь может запустить `docker run -v /:/host alpine:3.22` и изменить любой файл хоста. Поэтому на общих серверах группу выдают осторожно, а о режиме rootless, в котором демон работает без root, рассказано в уроке о безопасности.', 'A user is added to the group with `sudo usermod -aG docker $USER` and then logs in again. But membership in the docker group equals root on that server: such a user can run `docker run -v /:/host alpine:3.22` and change any host file. So on shared servers the group is handed out carefully, and the rootless mode, in which the daemon runs without root, is covered in the security lesson.'),
  },
  {
    id: 'containers.q.publish-which',
    kind: 'mcq',
    concepts: ['docker.publish'],
    prompt: bi('Какое число в `-p 8080:80` означает порт хоста?', 'In `-p 8080:80`, which number is the host port?'),
    options: [
      { id: '8080', text: '8080', correct: true },
      { id: '80', text: '80', why: bi('Число 80 обозначает порт внутри контейнера, на котором слушает nginx. Во флаге `-p` всегда сначала пишут порт хоста, а потом порт контейнера.', 'The number 80 is the port inside the container that nginx listens on. In the `-p` flag the host port always comes first and the container port second.') },
    ],
    explain: bi('Пакеты, пришедшие на порт 8080 хоста, ядро перенаправляет правилом DNAT на адрес контейнера и порт 80.', 'The kernel rewrites (DNAT) a request to host port 8080 to the container’s address and port 80.'),
  },
  {
    id: 'containers.q.cmd-effect',
    kind: 'match',
    concepts: ['docker.lifecycle'],
    prompt: bi('Сопоставьте команду с тем, что она делает.', 'Match the command and what it does.'),
    pairs: [
      { id: 'psa', left: 'docker ps -a', right: bi('показать все контейнеры, включая завершившиеся', 'show all containers, including exited ones') },
      { id: 'logs', left: 'docker logs web', right: bi('показать то, что главный процесс выводил в stdout и stderr', 'show the stdout and stderr of the main process') },
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
    misconceptions: [{ match: '-p 80:8080', why: bi('Порты перепутаны. Сначала пишут порт хоста, потом порт контейнера, поэтому `-p 80:8080` ведёт порт 80 хоста на порт 8080 контейнера, а там nginx не слушает.', 'The order is HOST:CONTAINER: `-p 80:8080` leads host port 80 to container port 8080, where nginx does not listen.') }],
  },
];

export const firstStepsLesson: Lesson = {
  id: 'containers.first-steps',
  block: 'containers',
  title: bi('Первые шаги с Docker', 'First steps with Docker'),
  summary: bi('В этом уроке вы узнаете, что происходит, когда вы набираете docker run, и научитесь запускать, просматривать, останавливать и удалять контейнеры, читать их журналы, заходить внутрь, передавать переменные окружения и публиковать порты.', 'In this lesson you will learn what happens when you type docker run, and you will learn to run, list, stop and remove containers, read their logs, get inside, pass environment variables and publish ports.'),
  introduces: ['docker.lifecycle', 'docker.env', 'docker.publish'],
  uses: ['docker.container'],
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
      body: bi('В прошлом уроке вы запустили контейнер одной командой, повторив её за текстом. Теперь вы освоите её по-настоящему, ведь это самая частая команда в работе DevOps-инженера, и научитесь запускать, просматривать, чинить и удалять контейнеры. Этот урок отвечает на вопрос: **что происходит, когда я набираю `docker run`?**', 'In the last lesson you ran a container with one command, repeating it after the text. Now it is time to really learn this most frequent command of a DevOps engineer: running, inspecting, fixing and removing containers. This lesson answers the question: **what happens when I type `docker run`?**'),
    },
    {
      id: 'hello',
      kind: 'text',
      step: 'explain',
      levels: ['beginner', 'intermediate'],
      title: bi('Что печатает hello-world, строка за строкой', 'hello-world line by line'),
      body: bi(
        'Сначала о том, кто работает, когда вы набираете команду. Сама программа `docker` служит только клиентом: она передаёт вашу просьбу демону dockerd, то есть программе, которая постоянно работает на машине в фоне. Демон скачивает всё, что нужно, и просит ядро Linux создать контейнер, а уже ядро запускает в нём процесс. Получается короткая цепочка «клиент → демон → ядро», и подробно её звенья разобраны в следующем уроке.\n\nКлиент передаёт просьбы демону через сокет `/var/run/docker.sock`, то есть через особый файл, по которому две программы на одной машине обмениваются сообщениями. Как у любого файла, у сокета есть владелец и права: он принадлежит root и группе docker. Поэтому на новом сервере обычный пользователь, которого не добавили в группу docker, на любую команду получит ответ `permission denied while trying to connect to the Docker daemon socket`. Демон при этом работает, а клиенту не дают открыть файл.\n\nКоманда `docker run hello-world` печатает несколько строк, и по ним видно, как работает эта цепочка. Строка «Unable to find image ‘hello-world:latest’ locally» означает, что клиент попросил демон создать контейнер, а нужного шаблона на машине нет. Строки «Pulling from library/hello-world … Pull complete» говорят, что демон скачал шаблон из реестра Docker Hub. Затем демон создал контейнер и запустил в нём программу `/hello`, а её вывод дошёл до вас через демон. Программа напечатала текст и завершилась, и вместе с ней завершился контейнер.\n\nШаблон, из которого запускают контейнер, называется образом. Имя `nginx:1.30-alpine` состоит из имени репозитория (`nginx`) и тега (`1.30-alpine`), то есть версии. Если тег не указан, Docker подставит `latest`. Как образ устроен изнутри, мы разберём в уроке «Как устроен образ», а пока достаточно уметь читать его имя.',
        'First, who works when you type the command. The `docker` program itself is only a client: it passes your request to the dockerd daemon, a program that keeps running on the machine in the background. The daemon downloads whatever is needed and asks the Linux kernel to create a container, and the kernel starts a process in it. That makes a short chain, “client → daemon → kernel”, and the next lesson takes its links apart in detail.\n\nThe client passes requests to the daemon through the socket `/var/run/docker.sock`, a special file through which two programs on one machine exchange messages. Like any file, the socket has an owner and permissions: it belongs to root and the docker group. So on a new server an ordinary user who was not added to the docker group gets `permission denied while trying to connect to the Docker daemon socket` on every command. The daemon is running; the client simply is not allowed to open the file.\n\nThe command `docker run hello-world` prints a few lines, and they show this chain at work. “Unable to find image ‘hello-world:latest’ locally” — the client asked the daemon to create a container, and the template is not on the machine. “Pulling from library/hello-world … Pull complete” — the daemon downloaded it from the Docker Hub registry. Then the daemon created the container, started the `/hello` program, and its output came to you through the daemon. The program printed its text and exited — so the container ended too.\n\nThe template a container starts from is called an image; the name `nginx:1.30-alpine` is a repository name (`nginx`) and a tag (`1.30-alpine`) — a version. Without a tag Docker uses `latest`. How an image is built inside we take apart in the lesson “How an image is built”; for now it is enough to read the name.',
      ),
    },
    {
      id: 'lifecycle',
      kind: 'text',
      step: 'explain',
      levels: ['beginner', 'intermediate'],
      title: bi('Команды, которые ведут контейнер от запуска до удаления', 'The commands that take a container from start to removal'),
      body: bi(
        '[[docker.lifecycle|Жизненный цикл контейнера]] в Docker держится на нескольких командах.\n\n- `docker run` создаёт из образа новый контейнер и запускает его. Флаг `-d` запускает контейнер в фоне и печатает его ID, `--name web` даёт контейнеру имя, `--rm` удаляет контейнер, когда тот завершится, а `-it` подключает ваш терминал к процессу внутри. Это два флага: `-i` держит открытым стандартный ввод процесса, а `-t` выдаёт процессу терминал.\n- `docker start web` снова запускает уже существующий остановленный контейнер, тот же самый, со всеми файлами, которые он успел изменить. Этим он отличается от `docker run`, который каждый раз создаёт новый контейнер: две команды `docker run nginx:1.30-alpine` подряд дают два разных контейнера, а повторный `docker run --name web` при уже занятом имени заканчивается ошибкой Conflict.\n- `docker ps` показывает работающие контейнеры, а `docker ps -a` — все, включая завершившиеся. Состояние `Exited (0)` означает, что процесс завершился сам с кодом 0.\n- `docker logs web` показывает, что главный процесс выводил в stdout и stderr, то есть в обычный вывод и в вывод ошибок. Docker сохраняет оба потока в журнал контейнера.\n- `docker exec web ls /` запускает ещё один процесс в уже работающем контейнере, а `docker exec -it web sh` открывает в нём оболочку. В завершившийся контейнер так не войти: `docker exec` ответит, что контейнер не работает (is not running), потому что внутри не осталось ни одного процесса, рядом с которым можно запустить новый. Почему контейнер завершился, сначала читают в `docker logs`.\n- `docker stop web` посылает сигнал SIGTERM и ждёт 10 секунд, а если это не помогло, посылает SIGKILL. Программа, которая умеет корректно завершаться по SIGTERM, как nginx, выходит сама, и тогда код выхода равен 0. У каждого сигнала есть свой номер, и у SIGTERM он равен 15, а у SIGKILL 9. Если процесс завершил сигнал, Docker показывает код 128 плюс номер сигнала. Поэтому код 143 бывает, когда программа не обработала SIGTERM и её завершил сам сигнал, а код 137 означает, что программа не завершилась за 10 секунд и Docker завершил её сигналом SIGKILL.\n- `docker rm web` удаляет остановленный контейнер, а вместе с ним и все файлы, которые программа успела создать или изменить внутри него.',
        'The [[docker.lifecycle|container lifecycle]] in Docker rests on a few commands.\n\n- `docker run` creates a new container from an image and starts it. The `-d` flag sends the container to the background and prints its ID; `--name web` gives it a name; `--rm` removes the container when it exits; `-it` attaches your terminal to the process inside. These are two flags: `-i` keeps the process’s standard input open, and `-t` gives the process a terminal.\n- `docker start web` starts an existing stopped container again, the very same one, with all the files it has changed. This is what sets it apart from `docker run`, which creates a new container every time: two `docker run nginx:1.30-alpine` commands in a row give two different containers, and a repeated `docker run --name web` when the name is taken ends with a Conflict error.\n- `docker ps` shows running containers, `docker ps -a` all of them, including exited ones: `Exited (0)` means it exited by itself with code 0.\n- `docker logs web` shows what the main process wrote to stdout and stderr, that is the normal output and the error output. Docker keeps both streams in the container’s log.\n- `docker exec web ls /` starts one more process in an already running container; `docker exec -it web sh` a shell inside. You cannot get into an exited container this way: `docker exec` answers that the container is not running, because no process is left inside next to which a new one could start. Why the container exited is read first in `docker logs`.\n- `docker stop web` sends the SIGTERM signal and waits 10 seconds; if that does not help — SIGKILL. A program that knows how to exit cleanly on SIGTERM, like nginx, exits by itself, and the exit code is then 0. Code 143, that is 128 + 15, appears when the program did not handle SIGTERM and the signal itself ended it, and code 137, that is 128 + 9, means the program did not exit within 10 seconds and Docker ended it with SIGKILL.\n- `docker rm web` removes a stopped container, and with it everything it wrote into its writable layer.',
      ),
    },
    {
      id: 'env-ports',
      kind: 'text',
      step: 'explain',
      levels: ['beginner', 'intermediate'],
      title: bi('Переменные окружения и порты', 'Variables and ports'),
      body: bi(
        'Один и тот же образ работает и на ноутбуке разработчика, и на рабочем сервере; различаются только настройки. Их передают [[docker.env|переменными окружения]]: флагом `-e POSTGRES_PASSWORD=secret` или файлом `--env-file app.env`. Если программе нужна переменная, а её не передали, программа обычно сразу завершается, и причину можно прочитать в `docker logs`.\n\nКонтейнер работает в своём сетевом пространстве имён и получает свой адрес вида 172.17.0.2. Снаружи к нему не попасть, пока вы не опубликуете порт. [[docker.publish|Публикация порта]] `-p 8080:80` означает, что пакеты, пришедшие на порт 8080 хоста, ядро направляет на порт 80 контейнера. Первое число относится к хосту, второе к контейнеру. Внутри ядра публикация устроена как правило DNAT в netfilter, такое же, какое вы писали руками в блоке сетей.',
        'The same image runs on the developer’s laptop and in production; what differs is the settings. They are passed as [[docker.env|environment variables]]: `-e POSTGRES_PASSWORD=secret` or a file `--env-file app.env`. If a program needs a variable and it was not passed, it usually exits at once — and the reason is in `docker logs`.\n\nA container lives in its own network namespace with its own address like 172.17.0.2. It cannot be reached from outside until a port is published. [[docker.publish|Publishing a port]] `-p 8080:80` means: “lead port 8080 of the host to port 80 of the container”. The first number is the host, the second the container. Underneath it is a DNAT rule in netfilter, which you wrote by hand in the networks block.',
      ),
    },
    {
      id: 'cheatsheet',
      kind: 'text',
      step: 'explain',
      levels: ['experienced'],
      title: bi('Что из первых шагов чаще всего путают на работе и на собеседовании', 'What from the first steps is most often mixed up at work and in interviews'),
      body: bi(
        'Как запускать, смотреть и удалять контейнеры, вы знаете по работе, поэтому здесь собраны только подробности, на которых спотыкаются и люди с опытом, а практика ниже за несколько минут проверит, что руки помнят остальное.\n\n- `docker run` каждый раз создаёт из образа новый контейнер, а `docker start` снова запускает тот же остановленный контейнер вместе с его записываемым слоем. Отсюда ошибка Conflict при повторном `--name` и десятки забытых контейнеров в `docker ps -a`, поэтому разовые запуски делают с флагом `--rm`.\n- Контейнер работает, пока работает его первый процесс. Если контейнер сразу завершился, `docker exec` ответит, что он не работает (is not running), и разбор начинают с `docker logs --tail 50 имя` и кода выхода в `docker ps -a`.\n- Код выхода больше 128 означает, что процесс завершил сигнал с номером «код минус 128». Код 137 означает SIGKILL, который приходит и по истечении ожидания `docker stop`, и от ядра при нехватке памяти, а различить эти случаи помогает `docker inspect -f \'{{.State.OOMKilled}}\' имя`. Код 143 означает, что программу завершил сам SIGTERM, потому что обработчика у неё не было.\n- В `-p 8080:80` сначала идёт порт хоста, потом порт контейнера, и ядро исполняет эту публикацию правилом DNAT. Запись `-p 127.0.0.1:8080:80` открывает порт только для самой машины, а не для всей сети.\n- Флаги `-i` и `-t` делают разное: первый держит открытым стандартный ввод, второй выдаёт процессу терминал. В скриптах и CI оставляют только `-i`, потому что с `-t` без терминала Docker ответит `the input device is not a TTY`.\n- Пароль из `-e` виден любому, кто может выполнить `docker inspect`, а что контейнер получил на самом деле, показывает `docker inspect -f \'{{json .Config.Env}}\' имя`.',
        'You know from work how to run, inspect and remove containers, so here are only the details that trip up experienced people too, and the lab below checks in a few minutes that your hands remember the rest.\n\n- `docker run` creates a new container from the image every time, while `docker start` starts the same stopped container again together with its writable layer. Hence the Conflict error on a repeated `--name` and dozens of forgotten containers in `docker ps -a`, which is why one-off runs use the `--rm` flag.\n- A container runs as long as its first process runs. If the container exited at once, `docker exec` answers that it is not running, and the investigation starts with `docker logs --tail 50 name` and the exit code in `docker ps -a`.\n- An exit code above 128 means that a signal numbered “code minus 128” ended the process. Code 137 means SIGKILL, which arrives both when the `docker stop` grace period runs out and from the kernel when memory runs out, and `docker inspect -f \'{{.State.OOMKilled}}\' name` tells the two apart. Code 143 means SIGTERM itself ended the program, because it had no handler.\n- In `-p 8080:80` the host port comes first, then the container port, and the kernel carries out this publication with a DNAT rule. `-p 127.0.0.1:8080:80` opens the port only to the machine itself, not to the whole network.\n- The `-i` and `-t` flags do different things: the first keeps standard input open, the second gives the process a terminal. Scripts and CI keep only `-i`, because with `-t` and no terminal Docker answers `the input device is not a TTY`.\n- A password from `-e` is visible to anyone who can run `docker inspect`, and `docker inspect -f \'{{json .Config.Env}}\' name` shows what the container actually received.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: dockerHost(),
      intro: bi('На этой машине установлен Docker, а образы alpine и nginx уже скачаны. Команда `curl localhost:8080` откроет страницу так, как её увидел бы браузер.', 'A machine with Docker; the alpine and nginx images are already pulled. `curl localhost:8080` opens a page as a browser would see it.'),
      tasks: [
        {
          id: 'hello',
          prompt: bi('Запустите `hello-world` и найдите завершившийся контейнер в списке всех контейнеров.', 'Run `hello-world` and find the exited container in the list of all containers.'),
          check: { when: 'containers[image=hello-world].state=exited && containers[image=hello-world].exitCode=0', stdout: /Exited \(0\)/ },
          chips: 'docker run hello-world; docker ps -a',
          concepts: ['docker.lifecycle'],
          docRef: help('ps', 'OPTIONS', '--all'),
          hints: { H1: bi('Команда `docker ps` без флагов показывает только работающие контейнеры.', '`docker ps` without flags shows only running ones.'), H2: bi('Нужен флаг, который велит показать все контейнеры.', 'You need the “show all” flag.') },
        },
        {
          id: 'web',
          prompt: bi('Запустите nginx в фоне с именем `web` так, чтобы `curl localhost:8080` показал его стартовую страницу.', 'Run nginx in the background named `web` so that `curl localhost:8080` shows its start page.'),
          check: {
            when: "containers[name=web].state=running && containers[name=web].ports[hostPort=8080].containerPort=80 && http['localhost:8080'].status=200",
            fail: [
              { if: (f) => lastOutput(f).includes('The container name "/web" is already in use'), say: bi('Контейнер с именем `web` уже есть, и второй контейнер с тем же именем Docker не создаёт. Это обычная ситуация, а не поломка: удалите старый контейнер командой `docker rm -f web` и запустите nginx снова, уже со всеми нужными флагами.', 'A container named `web` already exists, and Docker does not create a second one with the same name. This is an ordinary situation, not a failure: remove the old container with `docker rm -f web` and start nginx again, this time with all the flags you need.'), concept: 'docker.lifecycle' },
              { if: 'containers[name=web].state=running && containers[name=web].ports#=0', say: bi('Контейнер работает, но порт не опубликован, поэтому снаружи до него не добраться. Нужен флаг `-p` с портом хоста и портом контейнера.', 'The container runs, but no port is published: it cannot be reached from outside. You need `-p HOST:CONTAINER`.'), concept: 'docker.publish' },
              { if: 'containers[name=web].ports[hostPort=80]', say: bi('Порты перепутаны местами, а первым должен идти порт хоста (8080) и только вторым порт nginx в контейнере (80).', 'The ports are swapped: the host port (8080) comes first, the nginx port in the container (80) second.'), concept: 'docker.publish' },
            ],
          },
          chips: 'docker run -d --name web -p 8080:80 nginx:1.30-alpine',
          concepts: ['docker.lifecycle', 'docker.publish'],
          docRef: web('reference/cli/docker/container/run', 'publish', 'The first number is the port on the host'),
          hints: { H1: bi('Понадобятся три флага: для запуска в фоне, для имени и для публикации порта.', 'Three flags: background, name, publishing a port.'), H2: bi('Нужны флаги `-d`, `--name web` и `-p 8080:80`.', 'You need the flags `-d`, `--name web` and `-p 8080:80`.') },
        },
        {
          id: 'page',
          prompt: bi('Зайдите в контейнер `web` и замените стартовую страницу `/usr/share/nginx/html/index.html` текстом «Hello, DevOps». Проверьте результат командой curl.', 'Get into `web` and replace the start page `/usr/share/nginx/html/index.html` with the text “Hello, DevOps”. Check with curl.'),
          check: { when: "http['localhost:8080'].body~'Hello, DevOps'" },
          chips: "docker exec web sh -c 'echo Hello, DevOps > /usr/share/nginx/html/index.html'",
          concepts: ['docker.lifecycle'],
          hints: { H1: bi('Команду внутри работающего контейнера запускает `docker exec`.', '`docker exec` runs a command inside a running container.'), H2: bi('Можно войти в контейнер оболочкой, `docker exec -it web sh`, и уже там выполнить `echo … > файл`.', 'You can enter with a shell: `docker exec -it web sh`, then `echo … > file`.') },
        },
        {
          id: 'env',
          prompt: bi('Запустите базу данных `postgres:17-alpine` в фоне с именем `db`. База сразу завершится. Узнайте из журнала почему, удалите контейнер и запустите базу правильно.', 'Run the `postgres:17-alpine` database in the background named `db`. It exits at once — find out why from the log, remove it and run it properly.'),
          check: {
            when: (f) => containers(f).some((c) => c.name === 'db' && c.state === 'running' && c.config.Env.some((e) => /^POSTGRES_PASSWORD=.+/.test(e))),
            fail: [{ if: 'containers[name=db].state=exited', say: bi('Контейнер `db` завершился. Что написано в выводе `docker logs db`?', 'The `db` container exited. What does `docker logs db` say?'), concept: 'docker.env' }],
          },
          chips: 'docker logs db; docker rm db; docker run -d --name db -e POSTGRES_PASSWORD=secret postgres:17-alpine',
          concepts: ['docker.env'],
          docRef: web('reference/cli/docker/container/run', 'env'),
          hints: { H1: bi('В журнале названа переменная, которой базе не хватает.', 'The log names the variable it needs.'), H2: bi('Переменную передают флагом `-e ИМЯ=значение`.', 'A variable is passed with `-e NAME=value`.') },
        },
        {
          id: 'interactive',
          prompt: bi('Запустите из образа alpine контейнер `box` так, чтобы он не завершился сразу, и выполните в нём `ps`.', 'Run a `box` container from alpine so that it does not exit at once, and run `ps` in it.'),
          check: { when: "containers[name=box].state=running", stdout: /PID\s+USER/ },
          chips: 'docker run -dit --name box alpine:3.22; docker exec box ps',
          concepts: ['docker.lifecycle'],
          docRef: help('run', 'OPTIONS', '--interactive'),
          hints: { H1: bi('Образ alpine по умолчанию запускает оболочку sh. Оболочка, у которой нет терминала, сразу видит конец ввода и завершается. Ей нужны открытый стандартный ввод и терминал.', 'A shell without a terminal sees the end of input at once and exits. It needs an open stdin and a terminal.'), H2: bi('Флаг `-i` держит открытым стандартный ввод, то есть канал, из которого программа читает то, что ей передают, а `-t` выдаёт процессу терминал. Это разные вещи: команда `echo hi | docker run -i alpine:3.22 cat` передаёт строку в стандартный ввод без всякого терминала. Оболочке в фоне нужны оба флага и ещё `-d`.', '`-i` keeps standard input open, the channel the program reads what it is given from, and `-t` gives the process a terminal. These are different things: `echo hi | docker run -i alpine:3.22 cat` passes a line to standard input with no terminal at all. A shell in the background needs both flags plus `-d`.') },
        },
        {
          id: 'cleanup',
          prompt: bi('Остановите и удалите все контейнеры, кроме `web`; контейнер `web` должен продолжать работать.', 'Stop and remove every container except `web`; `web` must keep running.'),
          check: {
            when: (f) => containers(f).length === 1 && containers(f)[0].name === 'web' && containers(f)[0].state === 'running',
            fail: [{ if: '!containers[name=web]', say: bi('Контейнер `web` тоже удалён. Запустите его снова, как во втором задании.', '`web` is removed too — start it again as in the second task.') }],
          },
          chips: 'docker rm -f db box; docker container prune -f',
          concepts: ['docker.lifecycle'],
          docRef: help('rm', 'OPTIONS', '--force'),
          hints: { H1: bi('Работающий контейнер команда `docker rm` без особого флага не удалит.', '`docker rm` will not remove a running container without a special flag.'), H2: bi('Посмотрите, какие флаги есть у команды, в `docker rm --help`.', 'Look at the flags in `docker rm --help`.') },
        },
      ],
    },
    {
      id: 'anatomy-help',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Справка `docker run --help` делится на части Usage, Aliases и Options. В какой из них написано, что `docker run` и `docker container run` — одна и та же команда?', '`docker run --help` is divided into parts: Usage, Aliases, Options. In which part does it say that `docker run` and `docker container run` are one command?'),
      ref: { page: 'help/docker-run' },
      answer: 'ALIASES',
    },
    {
      id: 'find-timeout',
      kind: 'docs',
      step: 'practice',
      mode: 'find',
      prompt: bi('Запустите nginx с именем `web2` так, чтобы на корректное завершение у него было 30 секунд, не меняя образ и ничего не передавая в `docker stop`. Нужный флаг найдите в справке.', 'Run nginx named `web2` so that it gets 30 seconds to exit cleanly — without changing the image and without passing anything to `docker stop`. Find the flag in the help.'),
      ref: help('run'),
      terminal: {
        setup: dockerHost(),
        task: { id: 'stop-timeout', prompt: bi('Должен работать контейнер `web2`, которому на остановку отведено 30 секунд.', 'A `web2` container with 30 seconds to stop.'), check: { when: 'containers[name=web2].hostConfig.stopTimeout=30' }, docStep: 3, chips: 'docker run --help' },
      },
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      levels: ['intermediate', 'experienced'],
      mode: 'find',
      prompt: bi('Контейнер `web` уже работает. Сделайте так, чтобы после перезагрузки машины он запускался сам, и не пересоздавайте его. В тексте урока об этом не говорилось, так что способ придётся найти самостоятельно.', 'The `web` container is already running. Make it come back by itself after the machine reboots — without re-creating it. This was not in the theory.'),
      ref: { page: 'help/docker-update' },
      terminal: {
        setup: dockerHost({}, { run: ['docker run -d --name web -p 8080:80 nginx:1.30-alpine'] }),
        task: {
          id: 'update-restart',
          prompt: bi('Должен работать тот же контейнер `web`, с тем же ID, но с политикой перезапуска.', 'The same `web` (the same ID) with a restart policy.'),
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
      title: bi('Итог урока', 'Summary'),
      body: bi('Команда `docker run` скачивает образ, если его нет на машине, создаёт контейнер и запускает в нём процесс. Контейнер работает, пока работает этот процесс. Главными инструментами служат команды `ps -a`, `logs`, `exec`, `stop` и `rm`. Настройки передают через `-e`, а доступ снаружи открывают флагом `-p` с портом хоста и портом контейнера.', '`docker run` = pull the image if missing, create a container and start the process. A container lives as long as its process. `ps -a`, `logs`, `exec`, `stop`, `rm` are the main tools; settings go through `-e`, outside access through `-p HOST:CONTAINER`.'),
    },
  ],
};
