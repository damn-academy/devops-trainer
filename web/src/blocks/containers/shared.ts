// Shared bits of the containers block: sources, terminal setups, doc refs.

import type { DocRef, SourceLink, TerminalSetup } from '../../core/types';

export const wikiRu = (title: string): SourceLink => ({ title: `${title} — Википедия`, url: `https://ru.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}` });

export const SRC = {
  whatIsContainer: { title: 'What is a container? — Docker Docs', url: 'https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/' },
  whatIsImage: { title: 'What is an image? — Docker Docs', url: 'https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image/' },
  namespaces: { title: 'namespaces(7) — Linux manual page', url: 'https://man7.org/linux/man-pages/man7/namespaces.7.html' },
  pidNs: { title: 'pid_namespaces(7) — Linux manual page', url: 'https://man7.org/linux/man-pages/man7/pid_namespaces.7.html' },
  cgroups: { title: 'cgroups(7) — Linux manual page', url: 'https://man7.org/linux/man-pages/man7/cgroups.7.html' },
  capabilities: { title: 'capabilities(7) — Linux manual page', url: 'https://man7.org/linux/man-pages/man7/capabilities.7.html' },
  overlayfs: { title: 'Overlay Filesystem — The Linux Kernel documentation', url: 'https://docs.kernel.org/filesystems/overlayfs.html' },
  runtimeSpec: { title: 'OCI Runtime Specification', url: 'https://github.com/opencontainers/runtime-spec' },
  imageSpec: { title: 'OCI Image Format Specification', url: 'https://github.com/opencontainers/image-spec' },
  distSpec: { title: 'OCI Distribution Specification', url: 'https://github.com/opencontainers/distribution-spec/blob/main/spec.md' },
  kubevirt: { title: 'KubeVirt user guide', url: 'https://kubevirt.io/user-guide/' },
  cozystack: { title: 'Cozystack documentation', url: 'https://cozystack.io/docs/' },
  run: { title: 'docker container run — Docker Docs', url: 'https://docs.docker.com/reference/cli/docker/container/run/' },
  dockerfile: { title: 'Dockerfile reference — Docker Docs', url: 'https://docs.docker.com/reference/dockerfile/' },
  cache: { title: 'Docker build cache — Docker Docs', url: 'https://docs.docker.com/build/cache/' },
  multistage: { title: 'Multi-stage builds — Docker Docs', url: 'https://docs.docker.com/build/building/multi-stage/' },
  volumes: { title: 'Volumes — Docker Docs', url: 'https://docs.docker.com/engine/storage/volumes/' },
  bind: { title: 'Bind mounts — Docker Docs', url: 'https://docs.docker.com/engine/storage/bind-mounts/' },
  bridge: { title: 'Bridge network driver — Docker Docs', url: 'https://docs.docker.com/engine/network/drivers/bridge/' },
  logging: { title: 'Configure logging drivers — Docker Docs', url: 'https://docs.docker.com/engine/logging/configure/' },
  compose: { title: 'Docker Compose — Docker Docs', url: 'https://docs.docker.com/compose/' },
  startup: { title: 'Control startup order in Compose — Docker Docs', url: 'https://docs.docker.com/compose/how-tos/startup-order/' },
  composeSpec: { title: 'The Compose Specification', url: 'https://github.com/compose-spec/compose-spec/blob/main/spec.md' },
  security: { title: 'Docker Engine security — Docker Docs', url: 'https://docs.docker.com/engine/security/' },
  rootless: { title: 'Rootless mode — Docker Docs', url: 'https://docs.docker.com/engine/security/rootless/' },
  seccomp: { title: 'Seccomp security profiles for Docker — Docker Docs', url: 'https://docs.docker.com/engine/security/seccomp/' },
  lizrice: { title: 'Liz Rice — Containers From Scratch', url: 'https://github.com/lizrice/containers-from-scratch' },
  iximiuz: { title: 'iximiuz Labs — Container filesystem from scratch', url: 'https://labs.iximiuz.com/tutorials/container-filesystem-from-scratch' },
  tini: { title: 'tini — a tiny but valid init for containers', url: 'https://github.com/krallin/tini' },
  k8sRuContainers: { title: 'Контейнеры — Kubernetes (документация на русском)', url: 'https://kubernetes.io/ru/docs/concepts/containers/' },
  k8sRuImages: { title: 'Образы — Kubernetes (документация на русском)', url: 'https://kubernetes.io/ru/docs/concepts/containers/images/' },
  habrUnshare: { title: 'Хабр: контейнер своими руками через unshare и cgroups', url: 'https://habr.com/ru/articles/880354' },
  habrPivot: { title: 'Хабр: chroot против pivot_root', url: 'https://habr.com/ru/articles/880342' },
  habrOverlay: { title: 'Хабр: OverlayFS в Docker', url: 'https://habr.com/ru/post/701950' },
  habrManifest: { title: 'Хабр (OTUS): что внутри manifest.json образа', url: 'https://habr.com/ru/companies/otus/articles/859256' },
  habrCgroups: { title: 'Хабр: cgroups v1 и v2', url: 'https://habr.com/ru/articles/858780' },
} satisfies Record<string, SourceLink>;

export const RU = {
  vm: wikiRu('Виртуальная машина'),
  hypervisor: wikiRu('Гипервизор'),
  containerisation: wikiRu('Контейнеризация'),
  docker: wikiRu('Docker'),
  sha: wikiRu('SHA-2'),
  init: wikiRu('Init'),
  zombie: wikiRu('Процесс-зомби'),
  signal: wikiRu('Сигнал (Unix)'),
};

/** A machine with Docker and the usual images already pulled, real-time waits shortened. */
export const dockerHost = (extra: Partial<TerminalSetup> = {}, docker: Record<string, unknown> = {}): TerminalSetup => ({
  hostname: 'trainer',
  ...extra,
  ext: { docker: { pull: ['alpine:3.22', 'nginx:1.30-alpine'], ...docker }, ...(extra.ext ?? {}) },
});

export const help = (sub: string, anchor = 'OPTIONS', line?: string): DocRef => ({ page: `help/docker-${sub}`, anchor, line });
export const web = (path: string, anchor?: string, line?: string): DocRef => ({ page: `web/docs.docker.com/${path}`, anchor, line });
