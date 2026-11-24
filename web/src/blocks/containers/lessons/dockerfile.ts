// m07. Dockerfile and the build: instructions, context, cache, PID 1 and signals, multi-stage (04 §4.3).

import { lastOutput } from '../../../core/check';
import { bi } from '../../../core/i18n';
import type { Facts, Lesson, QuizItem } from '../../../core/types';
import { dockerHost, RU, SRC, web } from '../shared';

type B = { ok: boolean; tags: string[]; steps: { text: string; cached: boolean; layer: boolean; stage?: string }[]; size: number };
const builds = (f: Facts) => ((f.builds as B[] | undefined) ?? []).filter((b) => b.ok);

const APP_PY = `print("hello from the image")\n`;
export const STOP_APP = `import os
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
export const MAIN_GO = `package main

import (
\t"fmt"
\t"net/http"
)

func main() {
\thttp.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) { fmt.Fprint(w, "ok") })
\thttp.ListenAndServe(":8080", nil)
}
`;

/** Asked right after the instructions section: when RUN and CMD run, and which of two CMDs wins. */
export const runCmdQuiz: QuizItem[] = [
  {
    id: 'containers.q.run-vs-cmd',
    kind: 'mcq',
    concepts: ['docker.dockerfile'],
    prompt: bi('В Dockerfile две строки после `FROM alpine:3.22`: `RUN ls /etc` и `CMD ls /tmp`. Вы выполняете `docker build -t demo .`, а потом дважды `docker run demo`. Что и когда напечатается?', 'A Dockerfile has two lines after `FROM alpine:3.22`: `RUN ls /etc` and `CMD ls /tmp`. You run `docker build -t demo .` and then `docker run demo` twice. What is printed, and when?'),
    options: [
      { id: 'right', text: bi('Список /etc один раз в выводе сборки, а список /tmp при каждом из двух запусков', 'The /etc listing once in the build output, and the /tmp listing on each of the two runs'), correct: true },
      { id: 'both-build', text: bi('Оба списка в выводе сборки, а запуски ничего не напечатают', 'Both listings in the build output, and the runs print nothing'), why: bi('Сборщик команду из `CMD` не выполняет, он только записывает её в настройки образа. Выполняет её Docker при запуске контейнера.', 'The builder does not run the `CMD` command; it only writes it into the image config. Docker runs it when a container starts.') },
      { id: 'both-run', text: bi('Оба списка при каждом запуске, по одному после другого', 'Both listings on every run, one after the other'), why: bi('Команда из `RUN` выполнилась один раз во время сборки, и в образе остался только её результат, то есть файлы. При запуске контейнера её никто не повторяет.', 'The `RUN` command ran once during the build, and the image keeps only its result, the files. Nobody repeats it when a container starts.') },
    ],
    explain: bi('`RUN` работает во время сборки и меняет файлы образа, а `CMD` описывает, какую программу запустить в каждом новом контейнере.', '`RUN` works during the build and changes the image files, while `CMD` says which program to start in every new container.'),
  },
  {
    id: 'containers.q.two-cmd',
    kind: 'mcq',
    concepts: ['docker.dockerfile'],
    prompt: bi('Разработчик хочет, чтобы контейнер сначала применил миграции базы, а потом запустил сервер, и пишет в конце Dockerfile две строки: `CMD ["python", "migrate.py"]` и `CMD ["python", "server.py"]`. Что запустит `docker run`?', 'A developer wants the container to apply database migrations first and then start the server, and ends the Dockerfile with two lines: `CMD ["python", "migrate.py"]` and `CMD ["python", "server.py"]`. What does `docker run` start?'),
    options: [
      { id: 'last', text: bi('Только `server.py`, потому что вторая CMD заменила первую, и миграции не выполнятся', 'Only `server.py`, because the second CMD replaced the first, and the migrations do not run'), correct: true },
      { id: 'both', text: bi('Сначала `migrate.py`, а когда он завершится, `server.py`', 'First `migrate.py`, and when it finishes, `server.py`'), why: bi('CMD задаёт одну программу контейнера, а не список шагов. Каждая следующая CMD заменяет предыдущую, поэтому от первой строки ничего не осталось.', 'CMD sets one program for the container, not a list of steps. Each next CMD replaces the previous one, so nothing is left of the first line.') },
      { id: 'first', text: bi('Только `migrate.py`, потому что действует первая CMD', 'Only `migrate.py`, because the first CMD takes effect'), why: bi('Действует последняя CMD, а не первая: сборщик переписывает настройку образа каждый раз, когда встречает эту инструкцию.', 'The last CMD takes effect, not the first: the builder rewrites the image setting every time it meets this instruction.') },
    ],
    explain: bi('Чтобы выполнить две программы по очереди, их запускает одна: небольшой скрипт в ENTRYPOINT, который сначала применяет миграции, а потом командой `exec` заменяет себя сервером, чтобы сервер стал PID 1. Миграции часто выносят и в отдельный разовый запуск, `docker run --rm app python migrate.py`.', 'To run two programs in turn, one program starts them: a small ENTRYPOINT script that applies the migrations first and then replaces itself with the server via `exec`, so that the server becomes PID 1. Migrations are also often moved to a separate one-off run, `docker run --rm app python migrate.py`.'),
  },
];

export const dockerfileQuiz: QuizItem[] = [
  {
    id: 'containers.q.bug-order',
    kind: 'bugfind',
    concepts: ['docker.build-cache'],
    prompt: bi('В этом проекте каждая правка кода заново устанавливает все зависимости. Какая строка Dockerfile в этом виновата?', 'Every code edit in this project reinstalls all dependencies. Which line is to blame?'),
    code: 'FROM python:3.13-slim\nWORKDIR /app\nCOPY . .\nRUN pip install -r requirements.txt\nCMD ["python", "main.py"]',
    lang: 'dockerfile',
    bug: [3],
    why: {
      1: bi('Базовый образ указан с версией, и это правильно.', 'A versioned base image — correct.'),
      2: bi('WORKDIR меняет только настройки образа и лишней пересборки не вызывает.', 'WORKDIR only changes the config — it affects nothing in the cache.'),
      3: bi('Инструкция `COPY . .` стоит до установки зависимостей. Любая правка любого файла меняет её ключ, а значит, и ключ `pip install` ниже. Правильно сначала выполнить `COPY requirements.txt .`, потом установить зависимости через pip, а инструкцию `COPY . .` поставить последней.', '`COPY . .` comes before installing dependencies: any edit of any file changes its key and so the key of `pip install` below. First `COPY requirements.txt .`, then pip, then `COPY . .`.'),
      4: bi('Сама эта строка верная, а лишнюю пересборку вызывает строка выше.', 'This line is fine — the line above ruins it.'),
      5: bi('CMD записан в exec-форме, и это правильно.', 'The exec form of CMD — correct.'),
    },
  },
  {
    id: 'containers.q.meta-layers',
    kind: 'mcq',
    concepts: ['docker.dockerfile', 'docker.layer'],
    prompt: bi('Сколько слоёв создадут инструкции `ENV`, `CMD` и `EXPOSE` вместе?', 'How many layers do the `ENV`, `CMD` and `EXPOSE` instructions create together?'),
    options: [
      { id: '0', text: bi('Ни одного, потому что они меняют только настройки образа', 'None, because they change only the image config'), correct: true },
      { id: '3', text: bi('Три, по слою на каждую инструкцию', 'Three — a layer per instruction'), why: bi('Слои создают только инструкции, которые меняют файлы: RUN, COPY и ADD.', 'Only instructions that change files create layers: RUN, COPY, ADD.') },
      { id: '1', text: bi('Один общий слой', 'One shared'), why: bi('Ни одна из них слоя не создаёт, поэтому в выводе `docker history` их размер равен 0B.', 'None of them has a layer: `docker history` shows 0B for them.') },
    ],
    explain: bi('К тому же `EXPOSE` ничего не публикует, а служит пометкой для того, кто будет запускать контейнер. Публикует порт только флаг `-p`.', '`EXPOSE` also publishes nothing — it is documentation for whoever runs the image: only `-p` publishes.'),
  },
  {
    id: 'containers.q.exec-form',
    kind: 'multi',
    key: true,
    concepts: ['docker.pid1'],
    prompt: bi('Инструкцию CMD переписали из shell-формы в exec-форму, и теперь она выглядит как `CMD ["python", "app.py"]`. Какие утверждения теперь верны? Отметьте все.', 'CMD was rewritten from the shell form into the exec form: `CMD ["python", "app.py"]`. What is true now? Mark everything.'),
    options: [
      { id: 'pid1', text: bi('Первым процессом, PID 1, теперь работает сам python, а не /bin/sh', 'The first process, PID 1, is now python itself, not /bin/sh'), correct: true },
      { id: 'notyet', text: bi('Если в программе нет обработчика SIGTERM, `docker stop` всё равно будет ждать 10 секунд, потому что PID 1 без обработчика сигнал не получает', 'If the program has no SIGTERM handler, `docker stop` still waits 10 seconds, because PID 1 without a handler does not get the signal'), correct: true },
      { id: 'always', text: bi('Контейнер теперь всегда останавливается мгновенно', 'The container now always stops instantly'), why: bi('Exec-форма необходима, но её недостаточно, и нужен ещё обработчик в программе, флаг `--init` или другой сигнал остановки.', 'The exec form is necessary but not sufficient: you also need a handler in the program, `--init` or another stop signal.') },
      { id: 'env', text: bi('Переменные вроде $HOME в CMD теперь раскрываются', 'Variables like $HOME in CMD are now expanded'), why: bi('Всё наоборот, потому что в exec-форме нет оболочки и раскрывать $HOME некому.', 'The opposite: the exec form has no shell, so nobody expands $HOME.') },
    ],
    refs: { explainer: 'containers.stop' },
  },
  {
    id: 'containers.q.entrypoint-cmd',
    kind: 'mcq',
    concepts: ['docker.dockerfile'],
    prompt: bi('В образе записаны `ENTRYPOINT ["curl"]` и `CMD ["--help"]`. Что выполнит команда `docker run IMAGE -s https://example.com`?', 'An image has `ENTRYPOINT ["curl"]` and `CMD ["--help"]`. What does `docker run IMAGE -s https://example.com` run?'),
    options: [
      { id: 'right', text: 'curl -s https://example.com', correct: true },
      { id: 'both', text: 'curl --help -s https://example.com', why: bi('Аргументы `docker run` заменяют CMD целиком, а не дописываются к нему.', 'The `docker run` arguments replace CMD entirely; they are not appended to it.') },
      { id: 'cmd', text: bi('`-s https://example.com` как отдельную программу', '`-s https://example.com` as a separate program'), why: bi('ENTRYPOINT остаётся на месте, а заменяется только CMD, который передаётся ENTRYPOINT как аргументы.', 'ENTRYPOINT stays; only CMD is replaced — it goes as arguments to ENTRYPOINT.') },
    ],
  },
  {
    id: 'containers.q.multistage-why',
    kind: 'mcq',
    concepts: ['docker.multistage'],
    prompt: bi('Зачем собирать приложение на Go в несколько этапов, если итоговый исполняемый файл всё равно один?', 'Why build a Go application in several stages if the final binary is one file anyway?'),
    options: [
      { id: 'size', text: bi('Компилятор и исходники, а это сотни мегабайт, остаются в стадии сборки, а в итоговый образ попадает только исполняемый файл', 'The compiler and sources (hundreds of megabytes) stay in the build stage; only the binary goes into the final image'), correct: true },
      { id: 'speed', text: bi('Программа в таком образе работает быстрее', 'The program runs faster in such an image'), why: bi('Программа работает с той же скоростью, а меньше становятся размер образа, время его загрузки и число мест, через которые можно атаковать.', 'Run speed is the same — the size, download time and attack surface are smaller.') },
    ],
  },
];

export const dockerfileLesson: Lesson = {
  id: 'containers.dockerfile',
  block: 'containers',
  title: bi('Dockerfile и сборка образа', 'Dockerfile and the build'),
  summary: bi('В этом уроке вы узнаете, как из исходников получается образ, почему вторая сборка быстрее первой и какая программа в контейнере работает как PID 1, а также научитесь собирать маленький образ.', 'In this lesson you will learn how an image is made from sources, why the second build is faster than the first and which program in a container runs as PID 1, and you will learn to build a small image.'),
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
      body: bi('Первая сборка образа сервиса на Python заняла две минуты, вторая две секунды, а после правки одной строки кода снова две минуты. Этот урок отвечает на вопрос: **как из исходников получается образ и почему вторая сборка быстрее первой?**', 'The first build of a Python service image took two minutes, the second two seconds. And after editing one line of code — two minutes again. The leading question: **how is an image made from sources, and why is the second build faster than the first?**'),
    },
    {
      id: 'instructions',
      kind: 'text',
      step: 'explain',
      title: bi('Как сборку записывают в файл', 'How a build is written into a file'),
      body: bi(
        'Образ можно собрать и вручную: запустить контейнер, установить в нём пакеты и сохранить результат. Но такую сборку нельзя ни повторить, ни проверить на ревью, ни ускорить. Поэтому сборку записывают в [[docker.dockerfile|Dockerfile]], список инструкций, который читает сборщик BuildKit. Сборку запускают командой `docker build -t app:1.0 .`, где точка в конце обозначает текущий каталог.\n\nКаждая инструкция описывает шаг, у которого есть результат. Одни шаги создают слой: `RUN` выполняет команду в контейнере текущей стадии и сохраняет изменившиеся файлы, а `COPY` и `ADD` кладут в образ файлы из каталога проекта. Другие шаги меняют только настройки образа, и к ним относятся `ENV`, `WORKDIR`, `USER`, `EXPOSE`, `CMD` и `ENTRYPOINT`. Инструкция `EXPOSE` ничего не публикует, она служит пометкой для того, кто будет запускать контейнер, а публикует порт только флаг `-p`.\n\nНовички часто путают `RUN` и `CMD`, потому что обе инструкции содержат команду. Разница в том, когда команда выполняется. Команду из `RUN` сборщик выполняет один раз, во время `docker build`, и её вывод вы видите только в выводе сборки, а в образе остаются файлы, которые она создала. Команда из `CMD` во время сборки не выполняется вовсе: сборщик только записывает её в настройки образа, а запускает её Docker при каждом `docker run`. Поэтому `CMD` в Dockerfile бывает одна, а если их написать несколько, каждая следующая заменяет предыдущую, и действует только последняя.\n\nПоследним аргументом `docker build` передают **контекст сборки**, то есть каталог, который клиент целиком отправляет сборщику. Всё, что образу не нужно (каталог `.git`, тестовые данные, файл `.env` с паролями), перечисляют в `.dockerignore`. От этого зависят и скорость, и безопасность, потому что то, что попало в контекст, может попасть и в слой.',
        'You could build an image by hand: run a container, install packages, save it. But such a process cannot be repeated, reviewed or sped up. So the build is written into a [[docker.dockerfile|Dockerfile]] — a list of instructions the builder (BuildKit) reads. The build is started with `docker build -t app:1.0 .`, where the dot at the end means the current directory.\n\nEvery instruction is a step with a result. Some steps create a layer: `RUN` executes a command in a container of the current stage and saves the file changes; `COPY` and `ADD` put files from the context. Others change only the config: `ENV`, `WORKDIR`, `USER`, `EXPOSE`, `CMD`, `ENTRYPOINT`. `EXPOSE` publishes nothing — it is documentation; only `-p` publishes.\n\nNewcomers often mix up `RUN` and `CMD`, because both contain a command. The difference is when the command runs. The builder runs a `RUN` command once, during `docker build`, and you see its output only in the build output, while the image keeps the files it created. A `CMD` command does not run during the build at all: the builder only writes it into the image config, and Docker starts it on every `docker run`. So a Dockerfile has one `CMD`, and if you write several, each replaces the previous one and only the last takes effect.\n\nThe last argument of `docker build` is the **build context**: the directory the client sends to the builder as a whole. Whatever the image does not need (`.git`, test data, an `.env` file with passwords) is listed in `.dockerignore`. It is a matter of speed and of safety: what got into the context can get into a layer.',
      ),
    },
    { id: 'check-run-cmd', kind: 'quiz', step: 'try', title: bi('Когда выполняются RUN и CMD', 'When RUN and CMD run'), items: runCmdQuiz.map((q) => q.id) },
    {
      id: 'cache',
      kind: 'text',
      step: 'explain',
      title: bi('Как работает кэш сборки и почему всё пересобирается с первой изменившейся инструкции', 'How the build cache works and why everything rebuilds from the first changed instruction'),
      body: bi(
        'Сборщик помнит результаты прошлых сборок и для каждого шага вычисляет ключ. Ключ складывается из ключа предыдущего шага, текста инструкции и, для `COPY` и `ADD`, отпечатка содержимого копируемых файлов. Если ключ совпал с прошлым, слой берётся готовым, и в выводе сборки стоит `CACHED`. Если не совпал, шаг выполняется заново, а вместе с ним и все шаги ниже, потому что у них изменился ключ родителя. Такой механизм и называется [[docker.build-cache|кэшем сборки]].\n\nОтсюда следует главное правило порядка инструкций: **сначала идёт то, что меняется редко, а потом то, что меняется часто**. Скопируйте `requirements.txt`, установите зависимости и только после этого копируйте код. Тогда правка кода пересобирает один последний `COPY`, а долгий `pip install` берётся из кэша. Есть и второе следствие: отдельная инструкция `RUN rm` образ не уменьшает, потому что файл остаётся в предыдущем слое.',
        'The builder remembers the results of earlier builds. A step’s key is made of the key of the previous step, the instruction text and — for `COPY` and `ADD` — a hash of the content of the copied files. If the key matches, the finished layer is reused: `CACHED` in the output. If not, the step runs, and so do all steps below it, because their parent changed. That is the [[docker.build-cache|build cache]].\n\nHence the main rule of order: **first what changes rarely, then what changes often**. Copy `requirements.txt`, install dependencies, and only then copy the code. Then a code edit rebuilds only the last `COPY`, and the long `pip install` comes from the cache. And a second consequence: `RUN rm` on a separate line does not shrink the image — the file stays in the previous layer.',
      ),
    },
    { id: 'look-cache-intro', kind: 'text', step: 'look', title: bi('Как сборщик решает, что взять из кэша', 'How the builder decides what to take from the cache'), body: bi('Схема ниже показывает сборку небольшого сервиса на Python по Dockerfile из шести инструкций. Слева снизу вверх появляются инструкции в том порядке, в каком их выполняет сборщик: от `FROM` внизу до `CMD` наверху, так что образ растёт у вас на глазах слой за слоем. Справа расположены три предмета: контекст сборки, то есть каталог проекта, который получает сборщик, затем кэш сборки и, наконец, готовый образ.', 'The diagram below shows the build of a small Python service from a six-instruction Dockerfile. On the left the instructions appear from the bottom up in the order the builder runs them, from `FROM` at the bottom to `CMD` at the top, so the image literally grows layer by layer. On the right lie the build context (the project directory), the build cache and the finished image.') },
    { id: 'look-cache', kind: 'explainer', step: 'look', explainer: 'containers.build-cache', howto: bi('Сначала на схеме только контекст и пустой кэш. Переходите дальше кнопкой «Шаг вперёд». Облачко у каждой инструкции говорит, что решил сборщик: ключ совпал, и слой взят из кэша, или ключ новый, и шаг выполняется. Зелёная рамка означает слой из кэша, а жёлтая отмечает первый шаг с новым ключом, с которого начинается пересборка. Полоса в кэше заполняется по мере того, как шаги берутся из него, а под схемой растут время сборки и размер образа.\n\nНачните с правки по умолчанию, изменённого `main.py`, и посмотрите, что `pip install` взят из кэша. Потом выберите в «Параметрах» правку `requirements.txt`, а затем поставьте `COPY . .` перед `pip install` и снова поменяйте `main.py`: время сборки вырастет с долей секунды до двадцати с лишним секунд. В блоке «Сломать» удалите `.dockerignore` или удалите кэш pip отдельной инструкцией и проверьте, уменьшится ли образ.', 'At first only the context and the empty cache are shown. Go on with “Step forward”. The callout at each instruction says what the builder decided: the key matched and the layer came from the cache, or the key is new and the step runs. A green outline means a cached layer, yellow the first step with a new key, where the rebuild starts. The bar in the cache fills as steps come from it, and the build time and image size grow under the diagram.\n\nStart with the default edit, a changed `main.py`, and see that `pip install` comes from the cache. Then choose an edit of `requirements.txt` in “Parameters”, and then put `COPY . .` before `pip install` and change `main.py` again: the build time grows from a fraction of a second to over twenty seconds. In “Break it” delete `.dockerignore` or remove the pip cache in a separate instruction and check whether the image gets smaller.'), caption: bi('То же самое вы увидите в выводе `docker build`: строки с `CACHED` идут подряд до первой изменившейся инструкции, а дальше сборщик выполняет шаги и пишет время каждого. В практике ниже вы сами переставите инструкции в `~/app/Dockerfile` так, чтобы правка `main.py` не трогала `pip install`.', 'This is exactly what you see in the output of `docker build`: lines marked `CACHED` follow each other up to the first changed instruction, and from there the builder runs the steps and prints the time of each. In the lab below you will reorder `~/app/Dockerfile` yourself so that editing `main.py` leaves `pip install` alone.') },
    {
      id: 'pid1',
      kind: 'text',
      step: 'explain',
      title: bi('Какая программа запустится в контейнере и как она остановится', 'What starts and how it stops'),
      body: bi(
        '`ENTRYPOINT` задаёт программу, а `CMD` — её аргументы по умолчанию; аргументы, переданные `docker run`, заменяют `CMD`. У обеих инструкций есть две формы записи. Exec-форма `CMD ["python", "app.py"]` запускает python напрямую. Shell-форма `CMD python app.py; echo exited` запускает `/bin/sh -c "…"`, и программа становится дочерним процессом оболочки.\n\nКакая бы программа ни запустилась первой, внутри контейнера она становится [[docker.pid1|PID 1]] своего пространства имён PID. Для PID 1 в ядре действует особое правило, описанное в `pid_namespaces(7)`: сигнал, для которого у процесса нет обработчика, ему не доставляется. Команда `docker stop` посылает SIGTERM. Если первым процессом работает оболочка sh, она этот сигнал не обрабатывает и дочернему процессу не пересылает, поэтому через 10 секунд приходит SIGKILL, и контейнер завершается с кодом 137. Если первым процессом работает python без обработчика SIGTERM, результат тот же. Значит, exec-форма необходима для корректной остановки, но её недостаточно. Нужно ещё одно из трёх средств: обработчик SIGTERM в программе; маленький init-процесс (`docker run --init` или tini в ENTRYPOINT), который передаёт сигнал программе и заодно забирает коды выхода завершившихся процессов, чтобы не копились зомби; или другой сигнал остановки (`STOPSIGNAL`), который программа обрабатывает.',
        '`ENTRYPOINT` is the program and `CMD` its default arguments; the arguments of `docker run` replace `CMD`. Both instructions have two forms. The exec form `CMD ["python", "app.py"]` starts python directly. The shell form `CMD python app.py; echo exited` starts `/bin/sh -c "…"`, and the program becomes a child of the shell.\n\nWhoever ends up as the first process, inside the container it is [[docker.pid1|PID 1]] of its pid namespace. PID 1 has a special kernel rule (see `pid_namespaces(7)`): a signal the process has no handler for is not delivered to it. `docker stop` sends SIGTERM. If PID 1 is the sh shell, it does not handle it and does not pass it to the child: after 10 seconds SIGKILL arrives, code 137. If PID 1 is python without a SIGTERM handler, the result is the same. That is why the exec form is a necessary but not sufficient condition of a clean stop. One of three is enough: a SIGTERM handler in the program, a small init process (`docker run --init` or tini in ENTRYPOINT) that passes the signal on to the program and also reaps zombies, or another stop signal (`STOPSIGNAL`) the program does handle.',
      ),
    },
    { id: 'look-stop-intro', kind: 'text', step: 'look', title: bi('Как проходит docker stop', 'How docker stop runs'), body: bi('Следующая схема показывает, что происходит после команды `docker stop app`. Сигнал остановки проходит от команды через dockerd и shim к первому процессу контейнера, и карточка с именем сигнала движется по линиям. Внизу во всю ширину схемы проходит ядро, которое решает, доставить ли сигнал процессу PID 1, а справа вверху стоит таймер. Он заполняется, пока Docker ждёт, что процесс завершится сам.', 'The next diagram shows what happens after `docker stop app`. The stop signal travels from the command through dockerd and the shim to the container’s first process, and a card with the signal’s name moves along the lines. Along the bottom lies the kernel, which decides whether to deliver the signal to PID 1, and at the top right stands a timer that fills while Docker waits for the process to exit by itself.') },
    { id: 'look-stop', kind: 'explainer', step: 'look', explainer: 'containers.stop', howto: bi('Переходите дальше кнопкой «Шаг вперёд». По умолчанию первым процессом работает оболочка sh, которую запускает shell-форма CMD, и вы увидите, как сигнал пропадает, таймер заполняется до конца и контейнер завершается сигналом SIGKILL с кодом 137. Потом выберите в «Параметрах» другие варианты PID 1: python без обработчика, python с обработчиком SIGTERM и tini, запущенный флагом `--init`. Код выхода и время остановки каждый раз появляются под схемой. Попробуйте также сменить сигнал остановки на SIGINT, а в блоке «Сломать» включите PID 1, который не забирает коды выхода дочерних процессов, и посмотрите, что накопится в списке процессов.', 'Go on with “Step forward”. By default PID 1 is the sh shell of a shell-form CMD, and you will see the signal dropped, the timer fill up and the container end with SIGKILL and code 137. Then choose other PID 1 options in “Parameters”: python without a handler, python with a SIGTERM handler, and tini started by `--init`. The exit code and the stop time appear under the diagram each time. Also try changing the stop signal to SIGINT, and in “Break it” switch on a PID 1 that does not collect its children’s exit codes, and see what piles up in the process list.'), caption: bi('Когда контейнер на вашем сервере останавливается ровно за 10 секунд с кодом 137, пройдите тот же путь сами: посмотрите, в какой форме записан CMD (`docker inspect`), какая программа работает как PID 1 (`docker top`) и есть ли у неё обработчик (`grep SigCgt /proc/1/status` внутри контейнера). В практике ниже вам встретится как раз такой образ, он лежит в каталоге `~/stop`.', 'When a container on your server stops in exactly 10 seconds with code 137, walk the same path yourself: check the form of CMD (`docker inspect`), which program runs as PID 1 (`docker top`) and whether it has a handler (`grep SigCgt /proc/1/status` inside the container). The lab below has exactly such an image, in `~/stop`.') },
    {
      id: 'multistage',
      kind: 'text',
      step: 'explain',
      title: bi('Как собрать программу в отдельной стадии и взять в образ только результат', 'How to build a program in a separate stage and take only the result into the image'),
      body: bi(
        'Образ приложения на Go, собранный на основе `golang:1.25`, весит почти гигабайт, потому что в нём лежат компилятор, исходники и кэши. А приложению на сервере нужен только исполняемый файл. [[docker.multistage|Многоэтапная сборка]] решает эту задачу одним Dockerfile с несколькими инструкциями `FROM`. Первая стадия (`FROM golang:1.25 AS build`) собирает программу, а вторая (`FROM alpine:3.22`) получает готовый файл командой `COPY --from=build /out/app /usr/local/bin/app`. Всё, что осталось в первой стадии, в итоговый образ не попадает, и он весит около десяти мегабайт.\n\nКоманду сборки в первой стадии на практике пишут как `RUN CGO_ENABLED=0 go build -o /out/app .`. Переменная `CGO_ENABLED=0` велит собрать файл, который не зависит от системной библиотеки языка C. Образ golang построен на Debian с библиотекой glibc, а в Alpine стоит другая библиотека, musl, и файл, связанный с glibc, там не запустится: оболочка ответит загадочным «not found», хотя файл на месте.\n\nОтдельная осторожность нужна с паролями и ключами. Их не передают через `ARG` и не копируют в образ вместе с файлом `.env`, потому что всё это остаётся в истории образа и в его слоях. Для паролей, нужных при сборке, есть `RUN --mount=type=secret`, а при работе контейнера пароли передают переменными окружения при запуске.',
        'A Go application image built in `golang:1.25` weighs nearly a gigabyte: it holds the compiler, the sources and caches. The application on a server needs only the binary. A [[docker.multistage|multi-stage build]] solves this with one Dockerfile and several `FROM`s: the first stage (`FROM golang:1.25 AS build`) builds, the second (`FROM alpine:3.22`) takes the finished file with `COPY --from=build /out/app /usr/local/bin/app`. Nothing left in the first stage gets into the final image: it weighs a dozen megabytes.\n\nIn practice the build command of the first stage is written as `RUN CGO_ENABLED=0 go build -o /out/app .`. The variable `CGO_ENABLED=0` tells Go to build a file that does not depend on the system C library. The golang image is built on Debian with the glibc library, while Alpine has another library, musl, and a file linked against glibc will not start there: the shell answers with a puzzling “not found” although the file is in place.\n\nFor the same reason secrets are not passed through `ARG` and `.env` is not copied: all of that stays in the history and the layers. For passwords during the build there is `RUN --mount=type=secret`; at run time — variables passed when starting.',
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
      intro: bi('Проекты лежат в каталогах `~/site`, `~/app`, `~/stop` и `~/go`. Dockerfile удобно писать целиком командой `cat > Dockerfile <<\'EOF\'`, после которой вставляют текст и заканчивают его строкой `EOF`, или дописывать по одной строке командой `echo \'…\' >> Dockerfile`. Посмотреть, что получилось, можно командой `cat`.', "The projects are in `~/site`, `~/app`, `~/stop` and `~/go`. A Dockerfile is easiest to write whole with `cat > Dockerfile <<'EOF'`, after which you paste the text and end it with an `EOF` line, or to append line by line with `echo '…' >> Dockerfile`. You can look at the result with `cat`."),
      tasks: [
        {
          id: 'site',
          prompt: bi('Напишите `~/site/Dockerfile` для статического сайта на основе `nginx:1.30-alpine` (страницы nginx лежат в `/usr/share/nginx/html`), соберите образ `site:1.0` и запустите его так, чтобы `curl localhost:8080` показал «My site».', 'Write `~/site/Dockerfile` for a static site on `nginx:1.30-alpine` (nginx pages live in `/usr/share/nginx/html`), build the `site:1.0` image and run it so that `curl localhost:8080` shows “My site”.'),
          check: {
            when: "images[ref='site:1.0'] && http['localhost:8080'].body~'My site'",
            fail: [
              { if: (f) => lastOutput(f).includes('open Dockerfile: no such file or directory'), say: bi('Сборщик не нашёл Dockerfile в каталоге сборки, то есть в каталоге, который вы назвали последним аргументом `docker build`. Сначала создайте файл `~/site/Dockerfile`, а потом соберите образ из каталога `~/site` командой `docker build -t site:1.0 .`, где точка означает текущий каталог, или из любого другого места командой `docker build -t site:1.0 ~/site`.', 'The builder found no Dockerfile in the build directory, that is, in the directory you named as the last argument of `docker build`. First create `~/site/Dockerfile`, then build the image from the `~/site` directory with `docker build -t site:1.0 .`, where the dot means the current directory, or from anywhere else with `docker build -t site:1.0 ~/site`.'), concept: 'docker.dockerfile' },
            ],
          },
          chips: "echo 'FROM nginx:1.30-alpine' > ~/site/Dockerfile && echo 'COPY index.html /usr/share/nginx/html/' >> ~/site/Dockerfile && docker build -t site:1.0 ~/site && docker run -d -p 8080:80 site:1.0",
          concepts: ['docker.dockerfile'],
          docRef: web('reference/dockerfile', 'copy'),
          hints: { H1: bi('Вам хватит двух инструкций, одна из которых задаёт базовый образ, а другая копирует страницу.', 'Two instructions are enough: one sets the base image and the other copies the page.'), H2: bi('Нужны `FROM nginx:1.30-alpine` и `COPY index.html /usr/share/nginx/html/`.', '`FROM nginx:1.30-alpine` and `COPY index.html /usr/share/nginx/html/`.') },
        },
        {
          id: 'cache',
          prompt: bi('Перепишите `~/app/Dockerfile` так, чтобы правка `main.py` не переустанавливала зависимости. Проверьте это: соберите образ, измените `main.py`, соберите ещё раз, и шаг `pip install` должен оказаться CACHED.', 'Rewrite `~/app/Dockerfile` so that editing `main.py` does not reinstall dependencies. Check: build, change `main.py`, build again — the `pip install` step must be CACHED.'),
          check: {
            when: (f) => {
              const bs = builds(f);
              const last = bs[bs.length - 1];
              if (!last) return false;
              const pip = last.steps.find((s) => s.text.startsWith('RUN pip install'));
              const copyCode = last.steps.find((s) => s.text === 'COPY . .' || s.text.startsWith('COPY . '));
              return !!pip?.cached && !!copyCode && !copyCode.cached;
            },
            fail: [{ if: (f) => builds(f).some((b) => b.steps.some((s) => s.text.startsWith('RUN pip') && !s.cached)) && builds(f).length >= 2, say: bi('Шаг `pip install` выполняется заново при каждой сборке. Посмотрите, какая инструкция стоит выше него. Если это `COPY . .`, то любая правка кода меняет ключ этого шага.', '`pip install` rebuilds: what is above it? If it is `COPY . .`, any code edit changes the key.'), concept: 'docker.build-cache' }],
          },
          chips: "echo 'FROM python:3.13-slim' > ~/app/Dockerfile; echo 'WORKDIR /app' >> ~/app/Dockerfile; echo 'COPY requirements.txt .' >> ~/app/Dockerfile; echo 'RUN pip install -r requirements.txt' >> ~/app/Dockerfile; echo 'COPY . .' >> ~/app/Dockerfile",
          concepts: ['docker.build-cache'],
          docRef: web('build/cache', 'order'),
          hints: { H1: bi('То, что меняется редко, ставьте выше, а то, что часто, ниже.', 'What changes rarely goes higher, what changes often lower.'), H2: bi('Сначала идут `COPY requirements.txt .` и `RUN pip install …`, а инструкция `COPY . .` стоит после них.', 'First `COPY requirements.txt .` and `RUN pip install …`, then `COPY . .`.') },
        },
        {
          id: 'stop',
          prompt: bi('Образ из `~/stop` останавливается ровно за 10 секунд. Соберите его под именем `stopper:1.0`, запустите контейнер `app` и исправьте всё так, чтобы `docker stop app` занимал меньше двух секунд.', 'The image from `~/stop` takes exactly 10 seconds to stop. Build it as `stopper:1.0`, run an `app` container and fix it so that `docker stop app` takes under two seconds.'),
          check: {
            when: 'containers[name=app].stopDurationMs<2000 && containers[name=app].exitCode in [0, 130, 143]',
            fail: [
              { if: 'containers[name=app].stopDurationMs>=2000 && containers[name=app].program.shellParent=true', say: bi('Первым процессом здесь работает оболочка sh, которую запускает shell-форма CMD, а она не пересылает SIGTERM. Перейдите на exec-форму.', 'PID 1 is the sh shell of the shell-form CMD: it does not forward SIGTERM. Switch to the exec form.'), concept: 'docker.pid1' },
              { if: 'containers[name=app].stopDurationMs>=2000', say: bi('CMD уже записан в exec-форме, а код выхода всё равно 137, потому что python работает как PID 1 и не обрабатывает SIGTERM. Добавьте `--init` или обработчик либо смените сигнал остановки.', 'The exec form is there but the code is 137: python is PID 1 without a SIGTERM handler. Add `--init`, a handler, or change the stop signal.'), concept: 'docker.pid1' },
            ],
          },
          chips: "echo 'CMD [\"python\", \"/app/app.py\"]' ...; docker run -d --init --name app stopper:1.1; docker stop app",
          concepts: ['docker.pid1'],
          docRef: web('reference/cli/docker/container/run', 'init'),
          hints: { H1: bi('Здесь нужно разобраться с двумя вещами: какая программа работает как PID 1 и есть ли у неё обработчик сигнала.', 'There are two obstacles here: who PID 1 is, and whether it has a handler.'), H2: bi('Запишите CMD в exec-форме и запустите контейнер с флагом `--init`.', 'The exec form of CMD, and `--init` when running.') },
        },
        {
          id: 'small',
          prompt: bi('Образ из `~/go` весит сотни мегабайт. Перепишите Dockerfile в две стадии и соберите образ `goapp:small` размером меньше 30 МБ.', 'The image from `~/go` weighs hundreds of megabytes. Rewrite the Dockerfile in two stages and build `goapp:small` under 30 MB.'),
          check: {
            when: (f) => {
              const img = ((f.images as { ref: string; size: number }[] | undefined) ?? []).find((i) => i.ref === 'goapp:small');
              return !!img && img.size < 30_000_000 && builds(f).some((b) => b.tags.some((t) => t.endsWith('goapp:small')) && new Set(b.steps.map((s) => s.stage)).size >= 2);
            },
            fail: [{ if: "images[ref='goapp:small'].size>=30000000", say: bi('Образ `goapp:small` собран, но весит больше 30 МБ. Проверьте, что вторая стадия начинается со своей инструкции `FROM` с маленьким базовым образом и забирает из первой стадии только готовый файл командой `COPY --from=build`.', 'The `goapp:small` image is built but weighs more than 30 MB. Check that the second stage starts with its own `FROM` with a small base image and takes only the finished file from the first stage with `COPY --from=build`.') }],
          },
          chips: "echo 'FROM golang:1.25 AS build' > ~/go/Dockerfile; … echo 'FROM alpine:3.22' >> ~/go/Dockerfile; echo 'COPY --from=build /out/app /usr/local/bin/app' >> ~/go/Dockerfile",
          concepts: ['docker.multistage'],
          docRef: web('build/building/multi-stage', 'use-multi-stage-builds'),
          hints: { H1: bi('Первая стадия собирает программу, а вторая берёт из неё только исполняемый файл.', 'The first stage builds, the second takes only the binary.'), H2: bi('Нужны `FROM golang:1.25 AS build` … `FROM alpine:3.22`, затем `COPY --from=build /out/app /usr/local/bin/app` и `CMD ["app"]`.', '`FROM golang:1.25 AS build` … `FROM alpine:3.22` and `COPY --from=build /out/app /usr/local/bin/app`, `CMD ["app"]`.') },
        },
      ],
    },
    {
      id: 'anatomy-dockerfile',
      kind: 'docs',
      step: 'explain',
      mode: 'anatomy',
      prompt: bi('Найдите в справочнике Dockerfile раздел, который объясняет разницу между shell-формой и exec-формой, и нажмите на него.', 'In the Dockerfile reference find the section that explains the difference between the shell and exec forms. Click it.'),
      ref: web('reference/dockerfile'),
      answer: 'shell-and-exec-form',
    },
    {
      id: 'forcing',
      kind: 'docs',
      step: 'practice',
      levels: ['intermediate', 'experienced'],
      mode: 'find',
      prompt: bi('Приложение на Python из `~/stop` не обрабатывает SIGTERM. Сделайте так, чтобы оно останавливалось быстро, не меняя код и не пользуясь `--init`. Урок такого способа не показывал, поэтому найдите его в справочнике. Терминал этого задания открывает отдельную чистую машину: образов из практики выше на ней нет, а в `~/stop/Dockerfile` CMD уже записан в exec-форме, так что образ нужно собрать заново.', 'The Python application from `~/stop` does not handle SIGTERM. Make it stop fast without changing its code and without `--init`. The lesson did not show this way, so find it in the reference. This task’s terminal opens a separate clean machine: the images from the lab above are not there, and CMD in `~/stop/Dockerfile` is already in exec form, so build the image again.'),
      ref: web('reference/dockerfile'),
      terminal: {
        setup: dockerHost({ files: [{ path: '~/stop/app.py', content: STOP_APP }, { path: '~/stop/Dockerfile', content: 'FROM python:3.13-slim\nCOPY app.py /app/\nCMD ["python", "/app/app.py"]\n' }] }, { pull: ['python:3.13-slim'] }),
        task: {
          id: 'stopsignal',
          prompt: bi('Контейнер `app` должен останавливаться меньше чем за секунду, и флага `--init` у него быть не должно.', 'The `app` container stops in under a second, without `--init`.'),
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
      title: bi('Итог урока', 'Summary'),
      body: bi('Dockerfile описывает сборку по шагам. Инструкции RUN и COPY создают слои, а остальные меняют настройки образа. Кэш действует до первой изменившейся инструкции, поэтому зависимости устанавливают до того, как копируют код. PID 1 без обработчика не получает SIGTERM, поэтому нужна exec-форма вместе с обработчиком, флагом `--init` или подходящим STOPSIGNAL. Многоэтапная сборка оставляет компилятор за пределами итогового образа.', 'A Dockerfile is a build written as steps: RUN/COPY make layers, the rest is config. The cache holds until the first changed instruction, so dependencies are installed before the code is copied. PID 1 without a handler does not get SIGTERM: the exec form plus a handler, `--init` or STOPSIGNAL. A multi-stage build leaves the compiler behind.'),
    },
  ],
};
