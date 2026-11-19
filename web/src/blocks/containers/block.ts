// The containers block: route data, levels, placement (04 §13) and the
// "duty" exam (04 §17.4) in the simulator.

import { bi } from '../../core/i18n';
import { ROUTE } from '../../core/route';
import type { Block, Exam, Facts, PlacementTask } from '../../core/types';
import { LESSONS } from './lessons';
import { anatomyQuiz } from './lessons/anatomy';
import { dockerfileQuiz } from './lessons/dockerfile';
import { imageQuiz } from './lessons/image';
import { interviewQuiz } from './lessons/interview';
import { securityQuiz } from './lessons/security';
import { storageQuiz } from './lessons/storage-net';
import { whyQuiz } from './lessons/why';
import { dockerHost, RU, SRC } from './shared';

const route = ROUTE.find((r) => r.id === 'containers')!;
const pick = <T extends { id: string }>(list: T[], id: string, as: string): T => ({ ...list.find((x) => x.id === id)!, id: as });

type B = { ok: boolean; steps: { text: string; cached: boolean }[] };

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
  { id: 'containers.place.dns', level: 'intermediate', key: false, concepts: ['docker.network'], kind: 'quiz', item: pick(storageQuiz, 'containers.q.dns-default', 'containers.place.q.dns') },
  { id: 'containers.place.volume', level: 'intermediate', key: false, concepts: ['docker.volume'], kind: 'quiz', item: pick(storageQuiz, 'containers.q.volume-vs-bind', 'containers.place.q.volume') },
  { id: 'containers.place.137', level: 'intermediate', key: false, concepts: ['docker.pid1'], kind: 'quiz', item: pick(interviewQuiz, 'containers.q.code-137', 'containers.place.q.137') },
  { id: 'containers.place.rm', level: 'intermediate', key: false, concepts: ['docker.volume', 'docker.layer'], kind: 'quiz', item: pick(storageQuiz, 'containers.q.after-rm', 'containers.place.q.rm') },
  { id: 'containers.place.chain', level: 'experienced', key: true, concepts: ['docker.runtime'], kind: 'quiz', item: pick(anatomyQuiz, 'containers.q.chain-order', 'containers.place.q.chain') },
  { id: 'containers.place.hashes', level: 'experienced', key: true, concepts: ['docker.digest'], kind: 'quiz', item: pick(imageQuiz, 'containers.q.two-hashes', 'containers.place.q.hashes') },
  { id: 'containers.place.privileged', level: 'experienced', key: false, concepts: ['docker.security-profile'], kind: 'quiz', item: pick(securityQuiz, 'containers.q.privileged', 'containers.place.q.privileged') },
  { id: 'containers.place.exec', level: 'experienced', key: false, concepts: ['docker.pid1'], kind: 'quiz', item: pick(dockerfileQuiz, 'containers.q.exec-form', 'containers.place.q.exec') },
];

const exam: Exam = {
  id: 'exam-docker-duty',
  block: 'containers',
  title: bi('Дежурство', 'On duty'),
  intro: bi('Вам приходят четыре сообщения из чата команды, и все они про одну машину. Для каждого сначала найдите границу контейнера, на которой сидит поломка, а потом почините её. Открыты только справка `--help` и документация docs.docker.com, а ИИ-наставник выключен.', 'Four messages “from the team chat”, one machine. For each, find the boundary first, then fix it. Only `--help` and docs.docker.com are open; the AI is off.'),
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
    beginner: bi('Вы ещё не запускали ни одного контейнера. К концу блока вы запускаете и чините контейнеры, пишете Dockerfile и compose.yaml, объясняете отличие контейнера от виртуальной машины через пространства имён и cgroup и начинаете поиск неисправности с вопроса «на какой границе?».', 'Has never run a container. Outcome: runs and fixes containers, writes a Dockerfile and compose.yaml, explains container vs VM through namespaces and cgroups and starts diagnosis with “on which boundary?”.'),
    intermediate: bi('Вы уже запускали docker run по инструкции из README. К концу блока вы понимаете кэш сборки, тома и сети, PID 1 и сигналы, собираете контейнер своими руками и решаете задания, где нужный флаг приходится искать в документации.', 'Has run docker run from a README. Outcome: understands the build cache, volumes and networks, PID 1 and signals, builds a container by hand and solves “find the flag” tasks.'),
    experienced: bi('Вы пишете Dockerfile, но не знаете, что такое бандл, цепочка рантайма и PID 1. К концу блока вы читаете спецификации OCI, видите всю цепочку запуска до runc, понимаете digest, пространства имён пользователей и профиль безопасности контейнера.', 'Writes Dockerfiles; does not know the bundle, the runtime chain, PID 1. Outcome: reads the OCI specifications, sees the chain down to runc, understands digests, user namespaces and the security profile.'),
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
