// m07. Dockerfile and the build: instructions, context, cache, PID 1 and signals, multi-stage (04 §4.3).

import { bi } from '../../../core/i18n';
import type { Facts, Lesson, QuizItem } from '../../../core/types';
import { dockerHost, RU, SRC, web } from '../shared';

type B = { ok: boolean; tags: string[]; steps: { text: string; cached: boolean; layer: boolean }[]; size: number };
const builds = (f: Facts) => ((f.builds as B[] | undefined) ?? []).filter((b) => b.ok);

const APP_PY = `print("hello from the image")\n`;
const STOP_APP = `import os
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = 8000


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")


print("app: listening on 0.0.0.0:8000", flush=True)
HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
`;
const MAIN_GO = `package main

import (
\t"fmt"
\t"net/http"
)

func main() {
\thttp.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, "ok") })
\thttp.ListenAndServe(":8080", nil)
}
`;

export const dockerfileQuiz: QuizItem[] = [
  {
    id: 'containers.q.bug-order',
    kind: 'bugfind',
    concepts: ['docker.build-cache'],
    prompt: bi('Каждая правка кода в этом проекте переустанавливает все зависимости. Какая строка виновата?', 'Every code edit in this project reinstalls all dependencies. Which line is to blame?'),
    code: 'FROM python:3.13-slim\nWORKDIR /app\nCOPY . .\nRUN pip install -r requirements.txt\nCMD ["python", "main.py"]',
    lang: 'dockerfile',
    bug: [3],
    why: {
      1: bi('Базовый образ с версией — правильно.', 'A versioned base image — correct.'),
      2: bi('WORKDIR только меняет config — ни на что в кэше не влияет.', 'WORKDIR only changes the config — it affects nothing in the cache.'),
      3: bi('`COPY . .` стоит до установки зависимостей: любая правка любого файла меняет его ключ, а значит, и ключ `pip install` ниже. Сначала `COPY requirements.txt .`, потом pip, потом `COPY . .`.', '`COPY . .` comes before installing dependencies: any edit of any file changes its key and so the key of `pip install` below. First `COPY requirements.txt .`, then pip, then `COPY . .`.'),
      4: bi('Сама строка верная — её губит строка выше.', 'This line is fine — the line above ruins it.'),
      5: bi('Exec-форма CMD — правильно.', 'The exec form of CMD — correct.'),
    },
  },
  {
    id: 'containers.q.meta-layers',
    kind: 'mcq',
    concepts: ['docker.dockerfile', 'docker.layer'],
    prompt: bi('Сколько слоёв создадут вместе инструкции `ENV`, `CMD` и `EXPOSE`?', 'How many layers do the `ENV`, `CMD` and `EXPOSE` instructions create together?'),
    options: [
      { id: '0', text: bi('Ни одного: они меняют только config', 'None: they change only the config'), correct: true },
      { id: '3', text: bi('Три — по слою на инструкцию', 'Three — a layer per instruction'), why: bi('Слои создают только инструкции, меняющие файлы: RUN, COPY, ADD.', 'Only instructions that change files create layers: RUN, COPY, ADD.') },
      { id: '1', text: bi('Один общий', 'One shared'), why: bi('Слоя нет ни у одной: в `docker history` у них 0B.', 'None of them has a layer: `docker history` shows 0B for them.') },
    ],
    explain: bi('`EXPOSE` к тому же ничего не публикует — это документация для того, кто будет запускать: публикует только `-p`.', '`EXPOSE` also publishes nothing — it is documentation for whoever runs the image: only `-p` publishes.'),
  },
  {
    id: 'containers.q.exec-form',
    kind: 'multi',
    key: true,
    concepts: ['docker.pid1'],
    prompt: bi('CMD переписали из shell-формы в exec-форму: `CMD ["python", "app.py"]`. Что теперь верно? Отметьте всё.', 'CMD was rewritten from the shell form into the exec form: `CMD ["python", "app.py"]`. What is true now? Mark everything.'),
    options: [
      { id: 'pid1', text: bi('PID 1 — сам python, а не /bin/sh', 'PID 1 is python itself, not /bin/sh'), correct: true },
      { id: 'notyet', text: bi('Если в программе нет обработчика SIGTERM, `docker stop` всё равно будет ждать 10 секунд: PID 1 без обработчика сигнал не получает', 'If the program has no SIGTERM handler, `docker stop` still waits 10 seconds: PID 1 without a handler does not get the signal'), correct: true },
      { id: 'always', text: bi('Контейнер теперь всегда останавливается мгновенно', 'The container now always stops instantly'), why: bi('Exec-форма — необходимое, но не достаточное условие: нужен ещё обработчик в программе, `--init` или другой сигнал остановки.', 'The exec form is necessary but not sufficient: you also need a handler in the program, `--init` or another stop signal.') },
      { id: 'env', text: bi('Переменные вида $HOME в CMD теперь раскрываются', 'Variables like $HOME in CMD are now expanded'), why: bi('Наоборот: в exec-форме нет оболочки, и $HOME никто не раскроет.', 'The opposite: the exec form has no shell, so nobody expands $HOME.') },
    ],
    refs: { explainer: 'containers.stop' },
  },
  {
    id: 'containers.q.entrypoint-cmd',
    kind: 'mcq',
    concepts: ['docker.dockerfile'],
    prompt: bi('В образе `ENTRYPOINT ["curl"]` и `CMD ["--help"]`. Что выполнит `docker run IMAGE -s https://example.com`?', 'An image has `ENTRYPOINT ["curl"]` and `CMD ["--help"]`. What does `docker run IMAGE -s https://example.com` run?'),
    options: [
      { id: 'right', text: '`curl -s https://example.com`', correct: true },
      { id: 'both', text: '`curl --help -s https://example.com`', why: bi('Аргументы `docker run` заменяют CMD целиком, а не дописываются к нему.', 'The `docker run` arguments replace CMD entirely; they are not appended to it.') },
      { id: 'cmd', text: bi('`-s https://example.com` как отдельную программу', '`-s https://example.com` as a separate program'), why: bi('ENTRYPOINT остаётся; заменяется только CMD — он идёт аргументами к ENTRYPOINT.', 'ENTRYPOINT stays; only CMD is replaced — it goes as arguments to ENTRYPOINT.') },
    ],
  },
  {
    id: 'containers.q.multistage-why',
    kind: 'mcq',
    concepts: ['docker.multistage'],
    prompt: bi('Зачем многоэтапная сборка Go-приложения, если итоговый бинарник всё равно один?', 'Why build a Go application in several stages if the final binary is one file anyway?'),
    options: [
      { id: 'size', text: bi('Компилятор и исходники (сотни мегабайт) остаются в стадии сборки; в итоговый образ попадает только бинарник', 'The compiler and sources (hundreds of megabytes) stay in the build stage; only the binary goes into the final image'), correct: true },
      { id: 'speed', text: bi('Программа в таком образе работает быстрее', 'The program runs faster in such an image'), why: bi('Скорость работы та же — меньше размер, время загрузки и поверхность атаки.', 'Run speed is the same — the size, download time and attack surface are smaller.') },
    ],
  },
];

export const dockerfileLesson: Lesson = {
  id: 'containers.dockerfile',
  block: 'containers',
  title: bi('Dockerfile и сборка', 'Dockerfile and the build'),
  summary: bi('Как из исходников получается образ, почему вторая сборка быстрее первой, кто такой PID 1 и как собрать маленький образ.', 'How an image is made from sources, why the second build is faster than the first, who PID 1 is and how to build a small image.'),
  introduces: ['docker.dockerfile', 'docker.build-cache', 'docker.pid1', 'docker.multistage'],
  uses: ['docker.image', 'docker.layer', 'docker.lifecycle'],
  tier: 'core',
  minutes: 45,
  sources: {
    en: [SRC.dockerfile, SRC.cache, SRC.multistage, SRC.pidNs, SRC.tini],
    ru: [RU.init, RU.signal, RU.zombie, SRC.k8sRuImages],
  },
  sections: [
    {
      id: 'hook',
      kind: 'text',
      step: 'hook',
      body: bi('Первая сборка образа Python-сервиса шла две минуты, вторая — две секунды. А после правки одной строки кода — снова две минуты. Ведущий вопрос: **как из исходников получается образ и почему вторая сборка быстрее первой?**', 'The first build of a Python service image took two minutes, the second two seconds. And after editing one line of code — two minutes again. The leading question: **how is an image made from sources, and why is the second build faster than the first?**'),
    },
    {
      id: 'instructions',
      kind: 'text',
      step: 'explain',
      title: bi('Сборка, записанная в файл', 'A build written into a file'),
      body: bi(
        'Образ можно собрать руками: запустить контейнер, поставить пакеты, сохранить. Но такой процесс нельзя повторить, проверить на ревью и ускорить. Поэтому сборку записывают в [[docker.dockerfile|Dockerfile]] — список инструкций, который читает сборщик (BuildKit) командой `docker build -t app:1.0 .`.\n\nКаждая инструкция — шаг с результатом. Одни шаги создают слой: `RUN` выполняет команду в контейнере текущей стадии и сохраняет изменения файлов, `COPY` и `ADD` кладут файлы из контекста. Другие меняют только config: `ENV`, `WORKDIR`, `USER`, `EXPOSE`, `CMD`, `ENTRYPOINT`. `EXPOSE` ничего не публикует — это документация, публикует только `-p`.\n\nПоследний аргумент `docker build` — **контекст сборки**: каталог, который клиент целиком отправляет сборщику. Всё, что не нужно образу (`.git`, тестовые данные, файл `.env` с паролями), перечисляют в `.dockerignore`. Это вопрос и скорости, и безопасности: что попало в контекст, может попасть в слой.',
        'You could build an image by hand: run a container, install packages, save it. But such a process cannot be repeated, reviewed or sped up. So the build is written into a [[docker.dockerfile|Dockerfile]] — a list of instructions the builder (BuildKit) reads with `docker build -t app:1.0 .`.\n\nEvery instruction is a step with a result. Some steps create a layer: `RUN` executes a command in a container of the current stage and saves the file changes; `COPY` and `ADD` put files from the context. Others change only the config: `ENV`, `WORKDIR`, `USER`, `EXPOSE`, `CMD`, `ENTRYPOINT`. `EXPOSE` publishes nothing — it is documentation; only `-p` publishes.\n\nThe last argument of `docker build` is the **build context**: the directory the client sends to the builder as a whole. Whatever the image does not need (`.git`, test data, an `.env` file with passwords) is listed in `.dockerignore`. It is a matter of speed and of safety: what got into the context can get into a layer.',
      ),
    },
    {
      id: 'cache',
      kind: 'text',
      step: 'explain',
      title: bi('Кэш: с первой изменившейся инструкции и ниже', 'The cache: from the first changed instruction down'),
      body: bi(
        'Сборщик помнит результаты прошлых сборок. Ключ шага складывается из ключа предыдущего шага, текста инструкции и — для `COPY` и `ADD` — хеша содержимого копируемых файлов. Если ключ совпал, слой берётся готовым: в выводе `CACHED`. Если нет — шаг выполняется, а с ним и все шаги ниже, потому что у них изменился родитель. Это и есть [[docker.build-cache|кэш сборки]].\n\nОтсюда главное правило порядка: **сначала то, что меняется редко, потом то, что часто**. Скопируйте `requirements.txt`, поставьте зависимости, и только потом копируйте код. Тогда правка кода пересобирает один последний `COPY`, а долгий `pip install` берётся из кэша. И второе следствие: `RUN rm` отдельной строкой не уменьшает образ — файл остаётся в предыдущем слое.',
        'The builder remembers the results of earlier builds. A step’s key is made of the key of the previous step, the instruction text and — for `COPY` and `ADD` — a hash of the content of the copied files. If the key matches, the finished layer is reused: `CACHED` in the output. If not, the step runs, and so do all steps below it, because their parent changed. That is the [[docker.build-cache|build cache]].\n\nHence the main rule of order: **first what changes rarely, then what changes often**. Copy `requirements.txt`, install dependencies, and only then copy the code. Then a code edit rebuilds only the last `COPY`, and the long `pip install` comes from the cache. And a second consequence: `RUN rm` on a separate line does not shrink the image — the file stays in the previous layer.',
      ),
    },
    { id: 'look-cache', kind: 'explainer', step: 'look', explainer: 'containers.build-cache', caption: bi('Выберите, что изменилось, поменяйте порядок инструкций — и посмотрите, какие шаги пересоберутся.', 'Pick what changed, swap the order of instructions — and see which steps rebuild.') },
    {
      id: 'pid1',
      kind: 'text',
      step: 'explain',
      title: bi('Что запустится и как остановится', 'What starts and how it stops'),
      body: bi(
        '`ENTRYPOINT` — программа, `CMD` — её аргументы по умолчанию; аргументы `docker run` заменяют `CMD`. У обеих инструкций две формы. Exec-форма `CMD ["python", "app.py"]` запускает python напрямую. Shell-форма `CMD python app.py; echo exited` запускает `/bin/sh -c "…"`, и программа становится ребёнком оболочки.\n\nКто бы ни оказался первым процессом, внутри контейнера он [[docker.pid1|PID 1]] своего pid namespace. У PID 1 особое правило ядра (о нём — `pid_namespaces(7)`): сигнал, для которого у процесса нет обработчика, ему не доставляется. `docker stop` шлёт SIGTERM. Если PID 1 — оболочка sh, она его не обрабатывает и ребёнку не пересылает: через 10 секунд приходит SIGKILL, код 137. Если PID 1 — python без обработчика SIGTERM, результат тот же. Поэтому exec-форма — необходимое, но не достаточное условие корректной остановки. Достаточно одного из трёх: обработчика SIGTERM в программе, маленького init-процесса (`docker run --init` или tini в ENTRYPOINT), который передаёт сигнал программе и заодно забирает зомби, или другого сигнала остановки (`STOPSIGNAL`), который программа обрабатывает.',
        '`ENTRYPOINT` is the program and `CMD` its default arguments; the arguments of `docker run` replace `CMD`. Both instructions have two forms. The exec form `CMD ["python", "app.py"]` starts python directly. The shell form `CMD python app.py; echo exited` starts `/bin/sh -c "…"`, and the program becomes a child of the shell.\n\nWhoever ends up as the first process, inside the container it is [[docker.pid1|PID 1]] of its pid namespace. PID 1 has a special kernel rule (see `pid_namespaces(7)`): a signal the process has no handler for is not delivered to it. `docker stop` sends SIGTERM. If PID 1 is the sh shell, it does not handle it and does not pass it to the child: after 10 seconds SIGKILL arrives, code 137. If PID 1 is python without a SIGTERM handler, the result is the same. That is why the exec form is a necessary but not sufficient condition of a clean stop. One of three is enough: a SIGTERM handler in the program, a small init process (`docker run --init` or tini in ENTRYPOINT) that passes the signal on to the program and also reaps zombies, or another stop signal (`STOPSIGNAL`) the program does handle.',
      ),
    },
    { id: 'look-stop', kind: 'explainer', step: 'look', explainer: 'containers.stop', caption: bi('Меняйте то, что работает как PID 1, и время ожидания — объяснение назовёт сработавшее условие.', 'Change what runs as PID 1 and the timeout — the explanation names the condition that fired.') },
    {
      id: 'multistage',
      kind: 'text',
      step: 'explain',
      title: bi('Две стадии: собрать в одном, отдать в другом', 'Two stages: build in one, ship in another'),
      body: bi(
        'Образ Go-приложения, собранный в `golang:1.25`, весит под гигабайт: в нём компилятор, исходники и кэши. Приложению на сервере нужен только бинарник. [[docker.multistage|Многоэтапная сборка]] решает это одним Dockerfile с несколькими `FROM`: первая стадия (`FROM golang:1.25 AS build`) собирает, вторая (`FROM alpine:3.22`) получает готовый файл командой `COPY --from=build /out/app /usr/local/bin/app`. Всё, что осталось в первой стадии, в итоговый образ не попадает: он весит десяток мегабайт.\n\nПо той же причине секреты не передают через `ARG` и не копируют `.env`: всё это остаётся в истории и слоях. Для паролей в сборке есть `RUN --mount=type=secret`, а в работе — переменные при запуске.',
        'A Go application image built in `golang:1.25` weighs nearly a gigabyte: it holds the compiler, the sources and caches. The application on a server needs only the binary. A [[docker.multistage|multi-stage build]] solves this with one Dockerfile and several `FROM`s: the first stage (`FROM golang:1.25 AS build`) builds, the second (`FROM alpine:3.22`) takes the finished file with `COPY --from=build /out/app /usr/local/bin/app`. Nothing left in the first stage gets into the final image: it weighs a dozen megabytes.\n\nFor the same reason secrets are not passed through `ARG` and `.env` is not copied: all of that stays in the history and the layers. For passwords during the build there is `RUN --mount=type=secret`; at run time — variables passed when starting.',
      ),
    },
    {
      id: 'lab',
      kind: 'terminal',
      step: 'practice',
      machine: 'sim',
      setup: dockerHost(
        {
          files: [
            { path: '~/site/index.html', content: '<h1>My site</h1>\n' },
            { path: '~/app/main.py', content: APP_PY },
            { path: '~/app/requirements.txt', content: 'flask==3.1.2\n' },
            { path: '~/app/Dockerfile', content: 'FROM python:3.13-slim\nWORKDIR /app\nCOPY . .\nRUN pip install -r requirements.txt\nCMD ["python", "main.py"]\n' },
            { path: '~/stop/app.py', content: STOP_APP },
            { path: '~/stop/Dockerfile', content: 'FROM python:3.13-slim\nCOPY app.py /app/\nCMD python /app/app.py; echo "app exited"\n' },
            { path: '~/go/main.go', content: MAIN_GO },
            { path: '~/go/Dockerfile', content: 'FROM golang:1.25\nWORKDIR /src\nCOPY . .\nRUN go build -o /out/app .\nCMD ["/out/app"]\n' },
          ],
        },
        { pull: ['nginx:1.30-alpine', 'python:3.13-slim', 'alpine:3.22', 'golang:1.25'] },
      ),
      intro: bi("Проекты лежат в `~/site`, `~/app`, `~/stop` и `~/go`. Файл удобно писать целиком: `cat > Dockerfile <<'EOF'` … `EOF`, или по строке: `echo '…' >> Dockerfile`; посмотреть — `cat`.", "The projects are in `~/site`, `~/app`, `~/stop` and `~/go`. A file is easiest to write whole: `cat > Dockerfile <<'EOF'` … `EOF`, or line by line: `echo '…' >> Dockerfile`; look with `cat`."),
      tasks: [
        {
          id: 'site',
          prompt: bi('Напишите `~/site/Dockerfile` для статического сайта на `nginx:1.30-alpine` (страницы nginx лежат в `/usr/share/nginx/html`), соберите образ `site:1.0` и запустите его так, чтобы `curl localhost:8080` показал «My site».', 'Write `~/site/Dockerfile` for a static site on `nginx:1.30-alpine` (nginx pages live in `/usr/share/nginx/html`), build the `site:1.0` image and run it so that `curl localhost:8080` shows “My site”.'),
          check: { when: "images[ref='site:1.0'] && http['localhost:8080'].body~'My site'" },
          chips: "echo 'FROM nginx:1.30-alpine' > ~/site/Dockerfile && echo 'COPY index.html /usr/share/nginx/html/' >> ~/site/Dockerfile && docker build -t site:1.0 ~/site && docker run -d -p 8080:80 site:1.0",
          concepts: ['docker.dockerfile'],
          docRef: web('reference/dockerfile', 'copy'),
          hints: { H1: bi('Хватит двух инструкций: база и копирование страницы.', 'Two instructions are enough: the base and copying the page.'), H2: bi('`FROM nginx:1.30-alpine` и `COPY index.html /usr/share/nginx/html/`.', '`FROM nginx:1.30-alpine` and `COPY index.html /usr/share/nginx/html/`.') },
        },
        {
          id: 'cache',
          prompt: bi('Перепишите `~/app/Dockerfile` так, чтобы правка `main.py` не переустанавливала зависимости. Проверьте: соберите, измените `main.py`, соберите ещё раз — шаг `pip install` должен быть CACHED.', 'Rewrite `~/app/Dockerfile` so that editing `main.py` does not reinstall dependencies. Check: build, change `main.py`, build again — the `pip install` step must be CACHED.'),
          check: {
            when: (f) => {
              const bs = builds(f);
              const last = bs[bs.length - 1];
              if (!last) return false;
              const pip = last.steps.find((s) => s.text.startsWith('RUN pip install'));
              const copyCode = last.steps.find((s) => s.text === 'COPY . .' || s.text.startsWith('COPY . '));
              return !!pip?.cached && !!copyCode && !copyCode.cached;
            },
            fail: [{ if: (f) => builds(f).some((b) => b.steps.some((s) => s.text.startsWith('RUN pip') && !s.cached)) && builds(f).length >= 2, say: bi('`pip install` пересобирается: что стоит выше него? Если `COPY . .` — любая правка кода меняет ключ.', '`pip install` rebuilds: what is above it? If it is `COPY . .`, any code edit changes the key.'), concept: 'docker.build-cache' }],
          },
          chips: "echo 'FROM python:3.13-slim' > ~/app/Dockerfile; echo 'WORKDIR /app' >> ~/app/Dockerfile; echo 'COPY requirements.txt .' >> ~/app/Dockerfile; echo 'RUN pip install -r requirements.txt' >> ~/app/Dockerfile; echo 'COPY . .' >> ~/app/Dockerfile",
          concepts: ['docker.build-cache'],
          docRef: web('build/cache', 'order'),
          hints: { H1: bi('Что меняется редко — выше, что часто — ниже.', 'What changes rarely goes higher, what changes often lower.'), H2: bi('Сначала `COPY requirements.txt .` и `RUN pip install …`, потом `COPY . .`.', 'First `COPY requirements.txt .` and `RUN pip install …`, then `COPY . .`.') },
        },
        {
          id: 'stop',
          prompt: bi('Образ из `~/stop` останавливается ровно за 10 секунд. Соберите его как `stopper:1.0`, запустите контейнер `app` и исправьте так, чтобы `docker stop app` занимал меньше двух секунд.', 'The image from `~/stop` takes exactly 10 seconds to stop. Build it as `stopper:1.0`, run an `app` container and fix it so that `docker stop app` takes under two seconds.'),
          check: {
            when: 'containers[name=app].stopDurationMs<2000 && containers[name=app].exitCode in [0, 130, 143]',
            fail: [
              { if: 'containers[name=app].stopDurationMs>=2000 && containers[name=app].program.shellParent=true', say: bi('PID 1 — оболочка sh из shell-формы CMD: она не пересылает SIGTERM. Перейдите на exec-форму.', 'PID 1 is the sh shell of the shell-form CMD: it does not forward SIGTERM. Switch to the exec form.'), concept: 'docker.pid1' },
              { if: 'containers[name=app].stopDurationMs>=2000', say: bi('Exec-форма есть, а код 137: python — PID 1 без обработчика SIGTERM. Добавьте `--init`, обработчик или смените сигнал остановки.', 'The exec form is there but the code is 137: python is PID 1 without a SIGTERM handler. Add `--init`, a handler, or change the stop signal.'), concept: 'docker.pid1' },
            ],
          },
          chips: "echo 'CMD [\"python\", \"/app/app.py\"]' ...; docker run -d --init --name app stopper:1.1; docker stop app",
          concepts: ['docker.pid1'],
          docRef: web('reference/cli/docker/container/run', 'init'),
          hints: { H1: bi('Здесь два препятствия: кто PID 1 и есть ли у него обработчик.', 'There are two obstacles here: who PID 1 is, and whether it has a handler.'), H2: bi('Exec-форма CMD, и при запуске `--init`.', 'The exec form of CMD, and `--init` when running.') },
        },
        {
          id: 'small',
          prompt: bi('Образ из `~/go` весит сотни мегабайт. Перепишите Dockerfile в две стадии и соберите `goapp:small` меньше 30 МБ.', 'The image from `~/go` weighs hundreds of megabytes. Rewrite the Dockerfile in two stages and build `goapp:small` under 30 MB.'),
          check: { when: "images[ref='goapp:small'].size<30000000 && images[ref='goapp:small'].layers>=2" },
          chips: "echo 'FROM golang:1.25 AS build' > ~/go/Dockerfile; … echo 'FROM alpine:3.22' >> ~/go/Dockerfile; echo 'COPY --from=build /out/app /usr/local/bin/app' >> ~/go/Dockerfile",
          concepts: ['docker.multistage'],
          docRef: web('build/building/multi-stage', 'use-multi-stage-builds'),
          hints: { H1: bi('Первая стадия собирает, вторая берёт только бинарник.', 'The first stage builds, the second takes only the binary.'), H2: bi('`FROM golang:1.25 AS build` … `FROM alpine:3.22` и `COPY --from=build /out/app /usr/local/bin/app`, `CMD ["app"]`.', '`FROM golang:1.25 AS build` … `FROM alpine:3.22` and `COPY --from=build /out/app /usr/local/bin/app`, `CMD ["app"]`.') },
        },
      ],
    },
    {
      id: 'anatomy-dockerfile',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('В справочнике Dockerfile найдите раздел, который объясняет разницу между shell- и exec-формой. Нажмите на него.', 'In the Dockerfile reference find the section that explains the difference between the shell and exec forms. Click it.'),
      ref: web('reference/dockerfile'),
      answer: 'shell-and-exec-form',
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      levels: ['intermediate', 'experienced'],
      mode: 'find',
      prompt: bi('Python-приложение из `~/stop` не обрабатывает SIGTERM. Сделайте так, чтобы оно останавливалось быстро, не меняя код и без `--init`. В главе такого способа не было.', 'The Python application from `~/stop` does not handle SIGTERM. Make it stop fast without changing its code and without `--init`. The chapter did not show this way.'),
      ref: web('reference/dockerfile'),
      terminal: {
        setup: dockerHost({ files: [{ path: '~/stop/app.py', content: STOP_APP }, { path: '~/stop/Dockerfile', content: 'FROM python:3.13-slim\nCOPY app.py /app/\nCMD ["python", "/app/app.py"]\n' }] }, { pull: ['python:3.13-slim'] }),
        task: {
          id: 'stopsignal',
          prompt: bi('Контейнер `app` останавливается меньше чем за секунду, без `--init`.', 'The `app` container stops in under a second, without `--init`.'),
          check: { when: 'containers[name=app].stopDurationMs<1000 && containers[name=app].hostConfig.init=false' },
          docStep: 4,
          beyond: true,
          solutionTokens: ['STOPSIGNAL', 'SIGINT', '--stop-signal'],
        },
      },
    },
    { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: dockerfileQuiz.map((q) => q.id) },
    {
      id: 'summary',
      kind: 'callout',
      tone: 'why',
      step: 'review',
      title: bi('Итог', 'Summary'),
      body: bi('Dockerfile — сборка, записанная шагами: RUN/COPY дают слои, остальное — config. Кэш действует до первой изменившейся инструкции, поэтому зависимости ставят до копирования кода. PID 1 без обработчика не получает SIGTERM: exec-форма плюс обработчик, `--init` или STOPSIGNAL. Многоэтапная сборка оставляет компилятор за бортом.', 'A Dockerfile is a build written as steps: RUN/COPY make layers, the rest is config. The cache holds until the first changed instruction, so dependencies are installed before the code is copied. PID 1 without a handler does not get SIGTERM: the exec form plus a handler, `--init` or STOPSIGNAL. A multi-stage build leaves the compiler behind.'),
    },
  ],
};
