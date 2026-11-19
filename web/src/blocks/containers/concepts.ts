// Concepts the containers block introduces (04 §3.2, D01–D33 condensed).
// Namespaces, cgroups, capabilities, chroot, OverlayFS and seccomp come from
// the Linux block; veth, bridges, NAT, DNAT and DNS from the networks block.
// Everyday words that are also terms (image, layer, volume, network…) are not
// scanned; the scan watches the words that only this block may say first.

import { bi } from '../../core/i18n';
import type { Concept } from '../../core/types';

const c = (id: string, lesson: string, term: [string, string], short: [string, string], extra: Partial<Concept> = {}): Concept => ({
  id: `docker.${id}`,
  term: bi(term[0], term[1]),
  short: bi(short[0], short[1]),
  introducedIn: `containers.${lesson}`,
  scan: false,
  ...extra,
});

export const concepts: Concept[] = [
  c('env-problem', 'why', ['проблема окружений', 'environment problem'], ['Программы на одном сервере делят библиотеки и настройки, поэтому обновление для одной ломает другую: «у меня работает».', 'Programs on one server share libraries and settings, so an upgrade for one breaks another: “it works on my machine”.']),
  c('vm', 'why', ['виртуальная машина', 'virtual machine'], ['Компьютер, который гипервизор показывает программе: свои виртуальные процессоры, память, устройства и своё ядро.', 'A computer a hypervisor shows to software: its own virtual CPUs, memory, devices and its own kernel.']),
  c('container', 'why', ['контейнер', 'container'], ['Процесс хоста со своим набором файлов, в своих пространствах имён и в своей cgroup. Ядро одно на всех.', 'A host process with its own set of files, in its own namespaces and its own cgroup. One kernel for all of them.'], {
    scan: true,
    forms: { ru: ['контейнера', 'контейнеру', 'контейнером', 'контейнере', 'контейнеры', 'контейнеров', 'контейнерам', 'контейнерами', 'контейнерах', 'контейнерный', 'контейнерные', 'контейнерная', 'контейнерного', 'контейнеризация'], en: ['containers', 'containerised', 'containerized'] },
    docRef: { page: 'web/docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container', anchor: 'NAME' },
  }),
  c('vm-vs-container', 'why', ['контейнер против ВМ', 'container vs VM'], ['ВМ несёт своё ядро за гипервизором и изолирует сильнее; контейнер делит ядро хоста и стартует за доли секунды.', 'A VM carries its own kernel behind a hypervisor and isolates more strongly; a container shares the host kernel and starts in a fraction of a second.']),
  c('bundle', 'anatomy', ['OCI bundle', 'OCI bundle'], ['Контейнер на диске: каталог с `rootfs/` и `config.json` по спецификации OCI runtime-spec.', 'A container on disk: a directory with `rootfs/` and `config.json`, as the OCI runtime-spec defines it.'], { scan: true, forms: { ru: ['бандл', 'бандла', 'бандле'], en: ['bundles'] }, docRef: { url: 'https://github.com/opencontainers/runtime-spec/blob/main/bundle.md', label: 'runtime-spec › bundle.md' } }),
  c('runtime', 'anatomy', ['рантайм контейнеров', 'container runtime'], ['Цепочка программ, которая превращает «запусти» в процесс: docker CLI → dockerd → containerd → shim → runc.', 'The chain of programs that turns “run it” into a process: docker CLI → dockerd → containerd → shim → runc.']),
  c('states', 'anatomy', ['состояния контейнера', 'container states'], ['OCI: creating, created, running, stopped. Docker: created, running, paused, restarting, exited, dead.', 'OCI: creating, created, running, stopped. Docker: created, running, paused, restarting, exited, dead.']),
  c('lifecycle', 'first-steps', ['жизненный цикл контейнера', 'container lifecycle'], ['Команды run, ps, logs, exec, stop, rm и то, что каждая из них меняет.', 'The run, ps, logs, exec, stop and rm commands and what each of them changes.']),
  c('env', 'first-steps', ['переменные окружения контейнера', 'container environment variables'], ['Настройки, которые передают контейнеру при запуске: `-e KEY=value`, `--env-file`.', 'Settings passed to a container when it starts: `-e KEY=value`, `--env-file`.']),
  c('publish', 'first-steps', ['публикация порта', 'publishing a port'], ['`-p 8080:80`: порт 8080 хоста ведёт на порт 80 контейнера (правило DNAT).', '`-p 8080:80`: port 8080 of the host leads to port 80 of the container (a DNAT rule).'], { docRef: { page: 'web/docs.docker.com/reference/cli/docker/container/run', anchor: 'publish' } }),
  c('image', 'image', ['образ', 'image'], ['Шаблон контейнера: стопка слоёв файлов и config с тем, что запускать.', 'A container template: a stack of file layers and a config saying what to run.']),
  c('layer', 'image', ['слой', 'layer'], ['Архив изменений файловой системы; слои кладутся друг на друга и показываются одним деревом.', 'An archive of file-system changes; layers stack on each other and show as one tree.']),
  c('digest', 'image', ['digest', 'digest'], ['Адрес по содержимому: `sha256:` от байтов документа или слоя. Тег можно перевесить, digest — нет.', 'An address by content: `sha256:` of the bytes of a document or a layer. A tag can be moved; a digest cannot.']),
  c('registry', 'image', ['реестр', 'registry'], ['Сервер, где образы хранятся по репозиториям, тегам и digest; push кладёт, pull забирает.', 'A server that keeps images by repository, tag and digest; push puts them there, pull takes them.']),
  c('dockerfile', 'dockerfile', ['Dockerfile', 'Dockerfile'], ['Файл с инструкциями сборки образа: FROM, RUN, COPY, CMD и другие.', 'A file of instructions to build an image: FROM, RUN, COPY, CMD and others.'], { docRef: { page: 'web/docs.docker.com/reference/dockerfile', anchor: 'shell-and-exec-form' } }),
  c('build-cache', 'dockerfile', ['кэш сборки', 'build cache'], ['Повторное использование готовых слоёв: шаг берётся из кэша, если не изменились родитель, текст и копируемые файлы.', 'Reuse of finished layers: a step comes from the cache if its parent, text and copied files did not change.'], { docRef: { page: 'web/docs.docker.com/build/cache', anchor: 'how-the-cache-works' } }),
  c('pid1', 'dockerfile', ['PID 1 в контейнере', 'PID 1 in a container'], ['Первый процесс pid namespace: сигнал без обработчика ему не доставляется, и он должен забирать детей.', 'The first process of a pid namespace: a signal without a handler is not delivered to it, and it must reap children.']),
  c('multistage', 'dockerfile', ['многоэтапная сборка', 'multi-stage build'], ['Сборка в одном образе, а в итоговый уходит только результат: `COPY --from=build`.', 'Build in one image; only the result goes into the final one: `COPY --from=build`.'], { docRef: { page: 'web/docs.docker.com/build/building/multi-stage' } }),
  c('volume', 'storage-net', ['том', 'volume'], ['Хранилище, которое живёт отдельно от контейнера: именованный том, bind mount каталога хоста или tmpfs в памяти.', 'Storage that lives apart from the container: a named volume, a bind mount of a host directory or a tmpfs in memory.'], { docRef: { page: 'web/docs.docker.com/engine/storage/volumes' } }),
  c('network', 'storage-net', ['сеть Docker', 'Docker network'], ['bridge по умолчанию, host, none и пользовательские сети со встроенным DNS по именам контейнеров.', 'The default bridge, host, none and user-defined networks with embedded DNS for container names.'], { docRef: { page: 'web/docs.docker.com/engine/network/drivers/bridge', anchor: 'differences' } }),
  c('boundary', 'boundaries', ['граница контейнера', 'container boundary'], ['Одна из шести сторон, где контейнер встречается с миром: ядро, сеть, хранилище, процесс, ввод-вывод, идентичность.', 'One of the six sides where a container meets the world: kernel, network, storage, process, I/O, identity.']),
  c('logs', 'boundaries', ['журналы контейнера', 'container logs'], ['stdout и stderr процесса, которые shim передаёт драйверу журналов; их показывает `docker logs`.', 'The stdout and stderr of the process, passed by the shim to the log driver; `docker logs` shows them.'], { docRef: { page: 'web/docs.docker.com/engine/logging/configure' } }),
  c('compose', 'compose', ['Docker Compose', 'Docker Compose'], ['Описание нескольких контейнеров, их сети и томов в одном файле compose.yaml; `docker compose up` приводит систему к нему.', 'A description of several containers, their network and volumes in one compose.yaml file; `docker compose up` brings the system to it.'], { scan: true }),
  c('healthcheck', 'compose', ['проверка готовности', 'healthcheck'], ['Команда, которой Docker проверяет, что сервис готов; от неё зависят `depends_on: condition: service_healthy` и статус healthy.', 'A command Docker runs to check that a service is ready; `depends_on: condition: service_healthy` and the healthy status depend on it.'], { docRef: { page: 'web/docs.docker.com/compose/how-tos/startup-order' } }),
  c('security-profile', 'security', ['профиль безопасности контейнера', 'container security profile'], ['Что ограничивает root в контейнере: набор capabilities по умолчанию, seccomp, AppArmor, no-new-privileges; `--privileged` снимает почти всё.', 'What restricts root in a container: the default capability set, seccomp, AppArmor, no-new-privileges; `--privileged` lifts almost all of it.'], { docRef: { page: 'web/docs.docker.com/engine/security', anchor: 'capabilities' } }),
  c('userns', 'security', ['user namespace в Docker', 'user namespaces in Docker'], ['rootless Docker и userns-remap: root внутри — непривилегированный UID снаружи.', 'Rootless Docker and userns-remap: root inside is an unprivileged UID outside.']),
  c('image-security', 'security', ['безопасность образа', 'image security'], ['Не от root, минимальная база, никаких секретов в слоях, сканирование уязвимостей.', 'Not as root, a minimal base, no secrets in layers, vulnerability scanning.']),
];
