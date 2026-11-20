// The containers block: route data, levels, placement (04 §13) and the
// "duty" exam (04 §17.4) in the simulator.

import { bi } from '../../core/i18n';
import { ROUTE } from '../../core/route';
import type { Block, Exam, Facts, PlacementTask, Task } from '../../core/types';
import { LESSONS } from './lessons';
import { anatomyQuiz } from './lessons/anatomy';
import { MAIN_GO, STOP_APP } from './lessons/dockerfile';
import { imageQuiz } from './lessons/image';
import { interviewQuiz } from './lessons/interview';
import { securityQuiz } from './lessons/security';
import { storageQuiz } from './lessons/storage-net';
import { whyQuiz } from './lessons/why';
import { dockerHost, RU, SRC } from './shared';

const route = ROUTE.find((r) => r.id === 'containers')!;
const pick = <T extends { id: string }>(list: T[], id: string, as: string): T => ({ ...list.find((x) => x.id === id)!, id: as });

type B = { ok: boolean; tags: string[]; steps: { text: string; cached: boolean; stage?: string }[] };
type C = { name: string; state: string; networkNames: string[]; config: { Env: string[] } };
const cs = (f: Facts) => (f.containers as C[] | undefined) ?? [];
const userNet = (n: string) => !['bridge', 'host', 'none'].includes(n);

/** api and db on the default network: the name `db` does not resolve until both share a user-defined network. */
const twoOnDefault = dockerHost({}, { pull: ['alpine:3.22', 'postgres:17-alpine'], run: ['docker run -d --name api alpine:3.22 sleep 3600', 'docker run -d --name db -e POSTGRES_PASSWORD=pw postgres:17-alpine'] });
const sameUserNet: Task['check'] = {
  when: (f: Facts) => {
    const a = cs(f).find((c) => c.name === 'api');
    const d = cs(f).find((c) => c.name === 'db');
    return !!a && !!d && a.networkNames.some((n) => userNet(n) && d.networkNames.includes(n));
  },
};

const placement: PlacementTask[] = [
  { id: 'containers.place.vm', level: 'beginner', key: true, concepts: ['docker.container'], kind: 'quiz', item: pick(whyQuiz, 'containers.q.windows', 'containers.place.q.windows') },
  {
    id: 'containers.place.web',
    level: 'intermediate',
    key: true,
    concepts: ['docker.lifecycle', 'docker.publish'],
    kind: 'task',
    setup: dockerHost(),
    task: { id: 'p-web', prompt: bi('Запустите nginx в фоне с именем `web` так, чтобы адрес `http://localhost:8080` открывал его стартовую страницу.', 'Run nginx in the background named `web` so that `http://localhost:8080` opens its start page.'), check: { when: "containers[name=web].state=running && http['localhost:8080'].status=200" } },
  },
  {
    id: 'containers.place.cache',
    level: 'intermediate',
    key: true,
    concepts: ['docker.dockerfile', 'docker.build-cache'],
    kind: 'task',
    setup: dockerHost({ files: [{ path: '~/app/Dockerfile', content: 'FROM python:3.13-slim\nCOPY . /app\nRUN pip install -r /app/requirements.txt\nCMD python /app/main.py\n' }, { path: '~/app/requirements.txt', content: 'flask==3.1.2\n' }, { path: '~/app/main.py', content: 'print("hi")\n' }] }, { pull: ['python:3.13-slim'] }),
    task: {
      id: 'p-cache',
      prompt: bi('Измените `~/app/Dockerfile` так, чтобы правка `main.py` не вызывала переустановку зависимостей. Проверкой служат две сборки, и во второй шаг `pip install` должен быть взят из кэша.', 'Change `~/app/Dockerfile` so that editing `main.py` does not reinstall dependencies: two builds, the second with `pip install` from the cache.'),
      check: {
        when: (f: Facts) => {
          const bs = ((f.builds as B[] | undefined) ?? []).filter((b) => b.ok);
          const last = bs[bs.length - 1];
          return bs.length >= 2 && !!last?.steps.find((s) => s.text.startsWith('RUN pip'))?.cached && last.steps.some((s) => s.text.startsWith('COPY') && !s.cached);
        },
      },
    },
  },
  {
    id: 'containers.place.env',
    level: 'intermediate',
    key: false,
    concepts: ['docker.env', 'docker.lifecycle'],
    kind: 'task',
    setup: dockerHost({}, { pull: ['postgres:17-alpine'], run: ['docker run -d --name db postgres:17-alpine'] }),
    task: {
      id: 'p-env',
      prompt: bi('Контейнер с базой данных `db` завершился сразу после запуска. Выясните причину и добейтесь, чтобы база с именем `db` работала.', 'The database container `db` exited right after it started. Find out why and get a database named `db` running.'),
      check: { when: (f: Facts) => cs(f).some((c) => c.name === 'db' && c.state === 'running' && c.config.Env.some((e) => /^POSTGRES_PASSWORD=.+/.test(e))) },
    },
  },
  {
    id: 'containers.place.dns',
    level: 'intermediate',
    key: false,
    concepts: ['docker.network'],
    kind: 'task',
    setup: twoOnDefault,
    task: { id: 'p-dns', prompt: bi('Контейнеры `api` и `db` уже работают, но команда `docker exec api nslookup db` не находит базу по имени. Сделайте так, чтобы `api` находил `db` по имени, не удаляя контейнеры.', 'The `api` and `db` containers are already running, but `docker exec api nslookup db` does not find the database by name. Make `api` find `db` by name without removing the containers.'), check: sameUserNet },
  },
  { id: 'containers.place.volume', level: 'intermediate', key: false, concepts: ['docker.volume'], kind: 'quiz', item: pick(storageQuiz, 'containers.q.volume-vs-bind', 'containers.place.q.volume') },
  { id: 'containers.place.137', level: 'intermediate', key: false, concepts: ['docker.pid1'], kind: 'quiz', item: pick(interviewQuiz, 'containers.q.code-137', 'containers.place.q.137') },
  { id: 'containers.place.rm', level: 'intermediate', key: false, concepts: ['docker.volume', 'docker.layer'], kind: 'quiz', item: pick(storageQuiz, 'containers.q.after-rm', 'containers.place.q.rm') },
  // Experienced: what a developer who already writes Dockerfiles does at work, checked on the machine;
  // the runtime and digest questions are not keys, a miss only opens their lessons.
  {
    id: 'containers.place.small',
    level: 'experienced',
    key: true,
    concepts: ['docker.multistage', 'docker.dockerfile'],
    kind: 'task',
    setup: dockerHost({ files: [{ path: '~/go/main.go', content: MAIN_GO }, { path: '~/go/Dockerfile', content: 'FROM golang:1.25\nWORKDIR /src\nCOPY . .\nRUN go build -o /out/app .\nCMD ["/out/app"]\n' }] }, { pull: ['golang:1.25', 'alpine:3.22'] }),
    task: {
      id: 'p-small',
      prompt: bi('Образ сервиса на Go из `~/go` весит сотни мегабайт. Перепишите `~/go/Dockerfile` и соберите образ `goapp:small` размером меньше 30 МБ, в котором нет компилятора.', 'The Go service image from `~/go` weighs hundreds of megabytes. Rewrite `~/go/Dockerfile` and build a `goapp:small` image under 30 MB with no compiler in it.'),
      check: {
        when: (f: Facts) => {
          const img = ((f.images as { ref: string; size: number }[] | undefined) ?? []).find((i) => i.ref === 'goapp:small');
          return !!img && img.size < 30_000_000 && ((f.builds as B[] | undefined) ?? []).some((b) => b.ok && b.tags.some((t) => t.endsWith('goapp:small')) && new Set(b.steps.map((x) => x.stage)).size >= 2);
        },
      },
    },
  },
  {
    id: 'containers.place.stop',
    level: 'experienced',
    key: true,
    concepts: ['docker.pid1'],
    kind: 'task',
    setup: dockerHost({ files: [{ path: '~/stop/app.py', content: STOP_APP }, { path: '~/stop/Dockerfile', content: 'FROM python:3.13-slim\nCOPY app.py /app/\nCMD python /app/app.py; echo "app exited"\n' }] }, { pull: ['python:3.13-slim'] }),
    task: {
      id: 'p-stop',
      prompt: bi('Сервис из `~/stop` при каждой выкладке останавливается ровно 10 секунд. Соберите из него образ, запустите контейнер `app` и добейтесь, чтобы `docker stop app` занимал меньше двух секунд.', 'The service from `~/stop` takes exactly 10 seconds to stop on every rollout. Build an image from it, run an `app` container and make `docker stop app` take under two seconds.'),
      check: { when: 'containers[name=app].stopDurationMs<2000 && containers[name=app].exitCode in [0, 130, 143]' },
    },
  },
  {
    id: 'containers.place.cache-x',
    level: 'experienced',
    key: false,
    concepts: ['docker.build-cache'],
    kind: 'task',
    setup: dockerHost({ files: [{ path: '~/app/Dockerfile', content: 'FROM python:3.13-slim\nCOPY . /app\nRUN pip install -r /app/requirements.txt\nCMD python /app/main.py\n' }, { path: '~/app/requirements.txt', content: 'flask==3.1.2\n' }, { path: '~/app/main.py', content: 'print("hi")\n' }] }, { pull: ['python:3.13-slim'] }),
    task: {
      id: 'p-cache-x',
      prompt: bi('Сборка `~/app` после каждой правки `main.py` заново ставит зависимости. Исправьте `~/app/Dockerfile` и соберите образ дважды, поменяв между сборками `main.py`, так, чтобы во второй сборке шаг `pip install` был взят из кэша.', 'The `~/app` build reinstalls dependencies after every edit of `main.py`. Fix `~/app/Dockerfile` and build the image twice, changing `main.py` between the builds, so that the second build takes the `pip install` step from the cache.'),
      check: {
        when: (f: Facts) => {
          const bs = ((f.builds as B[] | undefined) ?? []).filter((b) => b.ok);
          const last = bs[bs.length - 1];
          return bs.length >= 2 && !!last?.steps.find((x) => x.text.startsWith('RUN pip'))?.cached && last.steps.some((x) => x.text.startsWith('COPY') && !x.cached);
        },
      },
    },
  },
  {
    id: 'containers.place.dns-x',
    level: 'experienced',
    key: false,
    concepts: ['docker.network'],
    kind: 'task',
    setup: twoOnDefault,
    task: { id: 'p-dns-x', prompt: bi('Контейнеры `api` и `db` работают в сети по умолчанию, и `api` не находит базу по имени `db`. Почините это, не пересоздавая контейнеры.', 'The `api` and `db` containers run on the default network, and `api` does not find the database by the name `db`. Fix it without re-creating the containers.'), check: sameUserNet },
  },
  { id: 'containers.place.chain', level: 'experienced', key: false, concepts: ['docker.runtime'], kind: 'quiz', item: pick(anatomyQuiz, 'containers.q.chain-order', 'containers.place.q.chain') },
  { id: 'containers.place.hashes', level: 'experienced', key: false, concepts: ['docker.digest'], kind: 'quiz', item: pick(imageQuiz, 'containers.q.two-hashes', 'containers.place.q.hashes') },
  { id: 'containers.place.privileged', level: 'experienced', key: false, concepts: ['docker.security-profile'], kind: 'quiz', item: pick(securityQuiz, 'containers.q.privileged', 'containers.place.q.privileged') },
];

const exam: Exam = {
  id: 'exam-docker-duty',
  block: 'containers',
  title: bi('Дежурство', 'On duty'),
  intro: bi('Вам приходят четыре сообщения из чата команды, и все они про одну машину. Для каждого сначала найдите границу контейнера, на которой находится поломка, а потом почините её. Открыты только справка `--help` и документация docs.docker.com, а ИИ-наставник выключен.', 'Four messages “from the team chat”, one machine. For each, find the boundary first, then fix it. Only `--help` and docs.docker.com are open; the AI is off.'),
  minutes: 40,
  pass: 0.75,
  allowedDocs: ['help', 'docs.docker.com', 'man'],
  tasks: [
    {
      id: 'site',
      weight: 1,
      critical: true,
      kind: 'task',
      setup: dockerHost({}, { pull: ['trainer/web:1.0'], run: ['docker run -d --name site -p 8080:8000 trainer/web:1.0'] }),
      task: { id: 'e-site', prompt: bi('«Сайт не открывается». Команда `curl localhost:8080` должна получать ответ с кодом 200.', '“The site does not open”: `curl localhost:8080` must answer 200.'), check: { when: "http['localhost:8080'].status=200" } },
    },
    {
      id: 'worker',
      weight: 1,
      critical: true,
      kind: 'task',
      setup: dockerHost({}, { pull: ['trainer/worker:1.0'], run: ['docker run -d --name worker --memory 64m --restart on-failure trainer/worker:1.0'] }),
      task: {
        id: 'e-worker',
        prompt: bi('«Контейнер worker постоянно перезапускается». Почините его, не снимая лимит памяти совсем. Сколько памяти ему нужно, написано в README образа.', '“The worker container keeps restarting”. Fix it without removing the memory limit altogether: the image README says how much it needs.'),
        check: { when: 'containers[name=worker].state=running && containers[name=worker].hostConfig.memory>=128Mi', fail: [{ if: 'containers[name=worker].hostConfig.memory=0', say: bi('Лимит не убирают, а подбирают, потому что без лимита один контейнер может занять всю память машины.', 'A limit is not removed — it is tuned: without it one container can eat the whole machine’s memory.') }] },
      },
    },
    {
      id: 'disk',
      weight: 1,
      kind: 'task',
      setup: dockerHost({}, { pull: ['alpine:3.22', 'nginx:1.30-alpine', 'postgres:17-alpine'], run: ['docker run -d --name db -e POSTGRES_PASSWORD=pw -v pgdata:/var/lib/postgresql/data postgres:17-alpine', 'docker run --name old1 alpine:3.22 true', 'docker run --name old2 nginx:1.30-alpine true'] }),
      task: {
        id: 'e-disk',
        prompt: bi('«Кончилось место на диске». Удалите остановленные контейнеры и неиспользуемые образы, не тронув базу данных и её том `pgdata`.', '“The disk is full”: remove the stopped containers and unused images without touching the database and its `pgdata` volume.'),
        check: { when: "containers[state=exited]#=0 && containers[name=db].state=running && volumes[name=pgdata] && !images[ref='nginx:1.30-alpine']" },
      },
    },
    {
      id: 'logs',
      weight: 1,
      beyond: true,
      kind: 'task',
      setup: dockerHost({}, { pull: ['nginx:1.30-alpine'] }),
      task: {
        id: 'e-logs',
        prompt: bi('«Журнал контейнера занял весь диск». Запустите nginx с именем `front` так, чтобы его журнал занимал не больше трёх файлов по 10 МБ.', '“A container log ate the disk”: run an nginx `front` whose log takes at most 3 files of 10 MB.'),
        check: { when: "containers[name=front].hostConfig.logConfig.config['max-size']=10m && containers[name=front].hostConfig.logConfig.config['max-file']=3" },
        docStep: 5,
        solutionTokens: ['--log-opt', 'max-size', 'max-file'],
      },
    },
  ],
};

export const block: Block = {
  id: 'containers',
  order: route.order,
  title: route.title,
  summary: route.summary,
  checklistStep: route.checklistStep,
  levels: {
    beginner: bi('Вы ещё не запускали ни одного контейнера. К концу блока вы сами запускаете и чините контейнеры, пишете файлы, по которым собирают образ и запускают несколько контейнеров сразу, объясняете, чем контейнер отличается от виртуальной машины, и знаете, с какого вопроса начинать поиск, когда контейнер не работает.', 'You have never run a container. By the end of the block you run and fix containers yourself, write the files from which an image is built and several containers are started at once, explain how a container differs from a virtual machine, and know which question to start with when a container does not work.'),
    intermediate: bi('Вы уже запускали docker run по инструкции из README. К концу блока вы понимаете кэш сборки, тома и сети, PID 1 и сигналы, собираете контейнер своими руками и решаете задания, где нужный флаг приходится искать в документации.', 'You have run docker run from a README. By the end of the block you understand the build cache, volumes and networks, PID 1 and signals, build a container by hand and solve tasks where the right flag has to be found in the documentation.'),
    experienced: bi('Вы пишете Dockerfile и запускаете контейнеры на работе, но не разбирали, что происходит после `docker run`. В проверке уровня вы соберёте маленький образ, почините медленную остановку и свяжете контейнеры сетью, а темы, в которых ошибётесь, курс предложит пройти по урокам. К концу блока вы видите всю цепочку запуска до runc, понимаете digest, пространства имён пользователей и профиль безопасности контейнера и разбираете поломки по границам контейнера.', 'You write Dockerfiles and run containers at work but have not taken apart what happens after `docker run`. In the placement check you build a small image, fix a slow stop and connect containers over a network, and the course suggests lessons for the topics where you slip. By the end of the block you see the whole launch chain down to runc, understand digests, user namespaces and the container security profile, and take failures apart by the container boundaries.'),
  },
  hours: route.hours,
  placement,
  lessons: LESSONS.map((l) => l.id),
  sources: {
    en: [SRC.whatIsContainer, SRC.runtimeSpec, SRC.imageSpec, SRC.dockerfile, SRC.lizrice],
    ru: [RU.containerisation, RU.docker, SRC.k8sRuContainers, SRC.habrUnshare],
  },
  requires: ['linux', 'networks'],
  docSources: ['help', 'docs.docker.com', 'man'],
  exam: exam.id,
};

export const exams: Exam[] = [exam];
