// Documentation pages the containers block's ladder points at (04 §5.8):
// the `docker … --help` pages (help/docker-run, …) split into Usage /
// Aliases / Options, and short offline notes of docs.docker.com pages,
// written in our own words with the address of the official page. The
// official page stays the source; the note is what the DL2 fragment shows.

import type { DocPage } from '../../core/types';
import { splitHelp } from '../docs/corpus';
import { HELP } from './help';

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

const helpPages: DocPage[] = Object.entries(HELP)
  .filter(([k]) => k !== '')
  .map(([k, text]) => ({
    id: `help/docker-${k.replace(/\s+/g, '-')}`,
    source: 'help',
    title: `docker ${k} --help`,
    url: `https://docs.docker.com/reference/cli/docker/${k.startsWith('compose') ? k.replace(/\s+/g, '/') : ['network', 'volume', 'system'].some((x) => k.startsWith(x)) ? k.replace(/\s+/g, '/') : ['images', 'pull', 'push', 'tag', 'rmi', 'history'].includes(k) ? `image/${k === 'images' ? 'ls' : k === 'rmi' ? 'rm' : k}` : k === 'build' ? 'buildx/build' : k === 'inspect' ? 'inspect' : `container/${k === 'ps' ? 'ls' : k}`}/`,
    license: 'Apache-2.0 (docker/cli)',
    version: 'Docker CLI 29',
    sections: splitHelp(stripAnsi(text)),
  }));

const web = (path: string, title: string, url: string, sections: { id: string; title?: string; body: string }[]): DocPage => ({ id: `web/docs.docker.com/${path}`, source: 'docs.docker.com', title, url, sections });

const webPages: DocPage[] = [
  web('get-started/docker-concepts/the-basics/what-is-a-container', 'What is a container?', 'https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/', [
    { id: 'NAME', title: 'What is a container?', body: 'A container is an isolated process for each of your app components.\nEach component runs in its own isolated environment, separate from everything else on the machine.' },
    { id: 'containers-vs-vms', title: 'Containers versus virtual machines (VMs)', body: 'A VM is an entire operating system with its own kernel, hardware drivers, programs and applications.\nA container is simply an isolated process with all of the files it needs to run.\nIf you run multiple containers, they all share the same kernel, allowing you to run more applications on less infrastructure.' },
  ]),
  web('reference/cli/docker/container/run', 'docker container run', 'https://docs.docker.com/reference/cli/docker/container/run/', [
    { id: 'DESCRIPTION', title: 'Description', body: 'The docker run command runs a command in a new container, pulling the image if needed and starting the container.' },
    { id: 'publish', title: 'Publish or expose port (-p, --expose)', body: '$ docker run -p 127.0.0.1:80:8080/tcp nginx:alpine\nThis binds port 8080 of the container to TCP port 80 on 127.0.0.1 of the host.\nThe first number is the port on the host, the second is the port in the container.\nIf you omit the host address, the port is published on all addresses of the host (0.0.0.0).' },
    { id: 'env', title: 'Set environment variables (-e, --env, --env-file)', body: '$ docker run --env VAR1=value1 --env VAR2=value2 ubuntu env | grep VAR\nUse -e for single variables and --env-file to read a file of KEY=value lines.' },
    { id: 'memory', title: 'Specify hard limits on memory available to containers (-m, --memory)', body: 'These parameters always set an upper limit on the memory available to the container.\nIf the container goes over the limit, the kernel kills a process in it (OOM).' },
    { id: 'init', title: 'Specify an init process (--init)', body: 'Use the --init flag to indicate that an init process should be used as the PID 1 in the container.\nSpecifying an init process ensures the usual responsibilities of an init system, such as reaping zombie processes, are performed inside the created container.' },
    { id: 'stop-timeout', title: 'Set the default stop timeout (--stop-timeout)', body: 'The --stop-timeout flag sets the number of seconds to wait for the container to stop after sending the pre-defined (see --stop-signal) system call signal.\nIf the container does not exit after the timeout elapses, it is forcibly killed with a SIGKILL signal.' },
    { id: 'restart', title: 'Restart policies (--restart)', body: 'no — do not automatically restart the container (the default)\non-failure[:max-retries] — restart if it exits with a non-zero exit status\nalways — always restart the container if it stops\nunless-stopped — like always, but not if it was stopped manually' },
  ]),
  web('reference/dockerfile', 'Dockerfile reference', 'https://docs.docker.com/reference/dockerfile/', [
    { id: 'shell-and-exec-form', title: 'Shell and exec form', body: 'RUN, CMD and ENTRYPOINT instructions all have two possible forms:\nINSTRUCTION ["executable","param1","param2"] (exec form)\nINSTRUCTION command param1 param2 (shell form)\nThe exec form makes it possible to avoid shell string munging, and to invoke commands using a specific command shell.\nIn the shell form the command runs as a child of /bin/sh -c, which does not pass signals on.' },
    { id: 'from', title: 'FROM', body: 'FROM [--platform=<platform>] <image> [AS <name>]\nThe FROM instruction initializes a new build stage and sets the base image for subsequent instructions.' },
    { id: 'run', title: 'RUN', body: 'The RUN instruction will execute any commands to create a new layer on top of the current image.\nThe added layer is used in the next step in the Dockerfile.' },
    { id: 'copy', title: 'COPY', body: 'COPY [--chown=<user>:<group>] [--from=<image|stage>] <src> ... <dest>\nThe COPY instruction copies new files or directories from <src> and adds them to the filesystem of the image at the path <dest>.' },
    { id: 'cmd', title: 'CMD', body: 'The CMD instruction sets the command to be executed when running a container from an image.\nThere can only be one CMD instruction in a Dockerfile. Arguments of docker run replace it.' },
    { id: 'entrypoint', title: 'ENTRYPOINT', body: 'An ENTRYPOINT allows you to configure a container that will run as an executable.\nCommand line arguments to docker run <image> will be appended after all elements in an exec form ENTRYPOINT, and will override all elements specified using CMD.\nThe shell form of ENTRYPOINT prevents any CMD command line arguments from being used.' },
    { id: 'stopsignal', title: 'STOPSIGNAL', body: 'STOPSIGNAL signal\nThe STOPSIGNAL instruction sets the system call signal that will be sent to the container to exit.\nThis signal can be a signal name in the format SIG<NAME>, for instance SIGKILL, or an unsigned number.\nThe default is SIGTERM if not defined.' },
    { id: 'user', title: 'USER', body: 'USER <user>[:<group>]\nThe USER instruction sets the user name (or UID) and optionally the user group (or GID) to use as the default user and group for the remainder of the current stage.' },
    { id: 'healthcheck', title: 'HEALTHCHECK', body: 'HEALTHCHECK [OPTIONS] CMD command\nThe HEALTHCHECK instruction tells Docker how to test a container to check that it is still working.\nWhen a container has a healthcheck specified, it has a health status in addition to its normal status: starting, healthy, unhealthy.' },
    { id: 'expose', title: 'EXPOSE', body: 'The EXPOSE instruction informs Docker that the container listens on the specified network ports at runtime.\nThe EXPOSE instruction does not actually publish the port. It functions as a type of documentation.' },
  ]),
  web('build/cache', 'Docker build cache', 'https://docs.docker.com/build/cache/', [
    { id: 'how-the-cache-works', title: 'How the build cache works', body: 'Each instruction in a Dockerfile translates to a layer in the final image.\nWhen you run a build, the builder attempts to reuse layers from earlier builds.\nIf a layer has changed since the last build, that layer, and all layers that follow, must be rebuilt.' },
    { id: 'order', title: 'Order your layers', body: 'Putting the commands in your Dockerfile into a logical order helps avoid unnecessary cache invalidation.\nCopy the files that list dependencies first, install them, and only then copy the rest of the source code.' },
  ]),
  web('build/building/multi-stage', 'Multi-stage builds', 'https://docs.docker.com/build/building/multi-stage/', [
    { id: 'use-multi-stage-builds', title: 'Use multi-stage builds', body: 'With multi-stage builds, you use multiple FROM statements in your Dockerfile.\nEach FROM instruction can use a different base, and each of them begins a new stage of the build.\nYou can selectively copy artifacts from one stage to another, leaving behind everything you don\'t want in the final image: COPY --from=build /bin/hello /bin/hello' },
  ]),
  web('engine/storage/volumes', 'Volumes', 'https://docs.docker.com/engine/storage/volumes/', [
    { id: 'NAME', title: 'Volumes', body: 'Volumes are persistent data stores for containers, created and managed by Docker.\nVolume contents exist outside the lifecycle of a given container: when a container is destroyed, the writable layer is destroyed with it; a volume stays.' },
    { id: 'populate', title: 'Populate a volume using a container', body: 'If you start a container which creates a new volume, and the container has files or directories in the directory to be mounted, Docker copies the directory\'s contents into the volume.' },
  ]),
  web('engine/storage/bind-mounts', 'Bind mounts', 'https://docs.docker.com/engine/storage/bind-mounts/', [
    { id: 'NAME', title: 'Bind mounts', body: 'When you use a bind mount, a file or directory on the host machine is mounted from the host into a container.\nIf you bind-mount over a non-empty directory on the container, the directory\'s existing contents are obscured by the bind mount.' },
  ]),
  web('engine/network/drivers/bridge', 'Bridge network driver', 'https://docs.docker.com/engine/network/drivers/bridge/', [
    { id: 'differences', title: 'Differences between user-defined bridges and the default bridge', body: 'User-defined bridges provide automatic DNS resolution between containers.\nContainers on the default bridge network can only access each other by IP addresses, unless you use the --link option, which is considered legacy.\nOn a user-defined bridge network, containers can resolve each other by name or alias.' },
  ]),
  web('engine/logging/configure', 'Configure logging drivers', 'https://docs.docker.com/engine/logging/configure/', [
    { id: 'NAME', title: 'Configure logging drivers', body: 'By default, Docker uses the json-file logging driver, which caches container logs as JSON internally.\nThe docker logs command shows what the container wrote to its standard output and standard error.\nBy default, no log rotation is performed: use max-size and max-file to limit the files.' },
  ]),
  web('compose/how-tos/startup-order', 'Control startup order in Compose', 'https://docs.docker.com/compose/how-tos/startup-order/', [
    { id: 'NAME', title: 'Control startup and shutdown order', body: 'Compose always starts and stops containers in dependency order, determined by depends_on.\nOn startup, Compose does not wait until a container is "ready", only until it\'s running.\nUse condition: service_healthy with a healthcheck to wait until a dependency is healthy.' },
  ]),
  web('engine/security', 'Docker Engine security', 'https://docs.docker.com/engine/security/', [
    { id: 'capabilities', title: 'Linux kernel capabilities', body: 'By default, Docker starts containers with a restricted set of capabilities.\nThis means that root within a container has much fewer privileges than the real root.\nUse --cap-drop and --cap-add to change the set; --privileged gives all capabilities and access to host devices.' },
  ]),
];

export const DSIM_DOCS: DocPage[] = [...helpPages, ...webPages];
