// The Docker engine of the simulator: image references, the course registry
// and `pull`, containers and their lifecycle (create, start, stop with the
// PID 1 rule, kill, rm, restart policies, OOM), networks with IPAM and
// volumes. Commands (cli.ts) parse flags and print; this file changes state.

import type { SimMachineApi } from '../../core/types';
import { catalog, documentsOf, indexOf, MEDIA, type ImageVariant } from './catalog';
import { ContainerSession, containerEnv, containerHooks, openContainer, type ContainerCtx } from './cmachine';
import { merge, type Layer } from './layers';
import { resolveProgram } from './program';
import { containerView, lowerMerged } from './rootfs';
import { DockerState, type ContainerRec, type DockerSnapshot, type ImageRec, type MountRec, type NetworkRec, type PortBinding } from './state';
import { containerName, digestOf, sha256hex, shortId, sleep } from './util';

export const ENGINE_VERSION = '29.0.1';
export const HOST_ARCH = 'amd64';

export interface Out {
  out(s: string): void;
  err(s: string): void;
}

export function dockerOf(m: SimMachineApi): DockerState {
  return m.ext<DockerState>('docker', () => new DockerState());
}

export function clock(m: SimMachineApi): number {
  const n = (m as unknown as { now?: () => number }).now;
  return typeof n === 'function' ? n.call(m) : Date.now();
}

/** dockerd and containerd as host processes (they appear in `ps` on the host). */
export function ensureDaemon(m: SimMachineApi, st: DockerSnapshot): void {
  if (st.daemon.running && m.procs.get(st.daemon.dockerdPid)) return;
  st.daemon.containerdPid = m.procs.spawn({ cmd: 'containerd', argv: ['/usr/bin/containerd'], uid: 0, ppid: 1 });
  st.daemon.dockerdPid = m.procs.spawn({ cmd: 'dockerd', argv: ['/usr/bin/dockerd', '-H', 'fd://', '--containerd=/run/containerd/containerd.sock'], uid: 0, ppid: 1 });
  st.daemon.running = true;
}

// ── image references ──────────────────────────────────────────────────────

export interface Ref {
  /** docker.io, registry.lab, localhost:5000 */
  registry: string;
  /** library/nginx, learner/web */
  repo: string;
  tag: string;
  digest?: string;
}

/** Parse `nginx`, `nginx:1.30-alpine`, `registry.lab/learner/web:1.0`, `alpine@sha256:…`. */
export function parseRef(s: string): Ref | null {
  const m = /^(?:([a-z0-9.-]+(?:\.[a-z0-9-]+|:\d+)|localhost(?::\d+)?)\/)?([a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*)(?::([\w][\w.-]{0,127}))?(?:@(sha256:[0-9a-f]{64}))?$/.exec(s.trim());
  if (!m) return null;
  const registry = m[1] ?? 'docker.io';
  let repo = m[2];
  if (registry === 'docker.io' && !repo.includes('/')) repo = `library/${repo}`;
  return { registry, repo, tag: m[3] ?? (m[4] ? '' : 'latest'), digest: m[4] };
}

/** The familiar name Docker prints: nginx:1.30-alpine, registry.lab/learner/web:1.0. */
export function familiar(r: Ref, withTag = true): string {
  const repo = r.registry === 'docker.io' ? r.repo.replace(/^library\//, '') : `${r.registry}/${r.repo}`;
  return withTag && r.tag ? `${repo}:${r.tag}` : repo;
}

export function fullName(r: Ref): string {
  return `${r.registry}/${r.repo}`;
}

/** Find a local image by name:tag, image ID (prefix) or name@digest. */
export function findImage(st: DockerSnapshot, ref: string): ImageRec | undefined {
  const bare = ref.replace(/^sha256:/, '');
  if (/^[0-9a-f]{4,64}$/.test(bare)) {
    const byId = st.images.filter((i) => i.id.replace(/^sha256:/, '').startsWith(bare));
    if (byId.length === 1) return byId[0];
  }
  const r = parseRef(ref);
  if (!r) return undefined;
  if (r.digest) return st.images.find((i) => i.repoDigests.includes(`${familiar(r, false)}@${r.digest}`));
  return st.images.find((i) => i.repoTags.includes(familiar(r)));
}

// ── the course registry ───────────────────────────────────────────────────

interface ResolvedManifest {
  variant: ImageVariant;
  manifestDigest: string;
  indexDigest?: string;
  platforms: string[];
}

const docCache = new Map<string, Promise<{ docs: Awaited<ReturnType<typeof documentsOf>>; v: ImageVariant }[]>>();

async function catalogEntry(r: Ref) {
  if (r.registry !== 'docker.io' && r.registry !== 'registry.lab') return null;
  const all = await catalog();
  const repo = r.registry === 'registry.lab' ? r.repo.replace(/^library\//, '') : r.repo;
  const want = r.registry === 'registry.lab' ? [`library/${repo}`, repo] : [repo];
  for (const img of all) {
    if (!want.includes(img.repo)) continue;
    const key = `${img.repo}:${img.tags.join(',')}`;
    if (!docCache.has(key)) docCache.set(key, Promise.all(img.variants.map(async (v) => ({ v, docs: await documentsOf(v) }))));
    const variants = await docCache.get(key)!;
    const index = indexOf(variants.map((x) => ({ platform: x.v.platform, digest: x.docs.manifestDigest, size: x.docs.manifest.length })));
    const indexDigest = await digestOf(index);
    if (r.digest) {
      const hit = variants.find((x) => x.docs.manifestDigest === r.digest);
      if (hit || r.digest === indexDigest) return { img, variants, index, indexDigest, exact: hit };
      continue;
    }
    if (img.tags.includes(r.tag)) return { img, variants, index, indexDigest, exact: undefined };
  }
  return null;
}

/** What `pull` will get: the manifest for the platform, through the index when there is one. */
export async function resolveManifest(st: DockerSnapshot, r: Ref, platform = `linux/${HOST_ARCH}`, explicitPlatform = false): Promise<ResolvedManifest | { error: string }> {
  const log = st.registry.log;
  const path = `/v2/${r.repo}/manifests/${r.digest ?? r.tag}`;
  log.push({ method: 'GET', path: '/v2/', status: 401 }, { method: 'GET', path: `/token?scope=repository:${r.repo}:pull`, status: 200 });
  // pushed by the learner
  const pushedRepo = st.registry.repos[fullName(r)];
  if (pushedRepo) {
    const digest = r.digest ?? pushedRepo[r.tag];
    const text = digest ? st.registry.manifests[digest] : undefined;
    if (text) {
      log.push({ method: 'HEAD', path, status: 200 }, { method: 'GET', path, status: 200 });
      const man = JSON.parse(text) as { config: { digest: string }; layers: { digest: string }[] };
      const cfgText = st.registry.manifests[man.config.digest];
      const layers = man.layers.map((l) => Object.values(st.layers).find((x) => x.digest === l.digest)).filter((x): x is Layer => !!x);
      if (cfgText && layers.length === man.layers.length) {
        const config = JSON.parse(cfgText);
        return { variant: { platform: `${config.os}/${config.architecture}`, layers, config }, manifestDigest: digest!, platforms: [`${config.os}/${config.architecture}`] };
      }
    }
  }
  const hit = await catalogEntry(r);
  if (!hit) {
    log.push({ method: 'HEAD', path, status: 404 });
    return { error: r.registry === 'docker.io' || r.registry === 'registry.lab' ? `pull access denied for ${familiar(r, false)}, repository does not exist or may require 'docker login': denied: requested access to the resource is denied` : `Get "https://${r.registry}/v2/": dial tcp: lookup ${r.registry}: no such host` };
  }
  log.push({ method: 'HEAD', path, status: 200 });
  const platforms = hit.variants.map((x) => x.v.platform);
  if (hit.exact) {
    log.push({ method: 'GET', path, status: 200 });
    return { variant: hit.exact.v, manifestDigest: hit.exact.docs.manifestDigest, platforms };
  }
  log.push({ method: 'GET', path, status: 200 });
  // a single-platform image is served as it is; Docker warns and runs it anyway
  const chosen = hit.variants.find((x) => x.v.platform === platform) ?? (hit.variants.length === 1 && !explicitPlatform ? hit.variants[0] : undefined);
  if (!chosen) return { error: `no matching manifest for ${platform} in the manifest list entries` };
  log.push({ method: 'GET', path: `/v2/${r.repo}/manifests/${chosen.docs.manifestDigest}`, status: 200 });
  return { variant: chosen.v, manifestDigest: chosen.docs.manifestDigest, indexDigest: hit.indexDigest, platforms };
}

/** The raw index or manifest JSON for `docker manifest inspect` / `buildx imagetools inspect`. */
export async function rawManifest(st: DockerSnapshot, r: Ref): Promise<string | null> {
  const pushed = st.registry.repos[fullName(r)];
  if (pushed?.[r.tag]) return st.registry.manifests[pushed[r.tag]] ?? null;
  const hit = await catalogEntry(r);
  if (!hit) return null;
  return hit.exact ? hit.exact.docs.manifest : hit.index;
}

/** `docker pull`: download what is missing, make the image, move the tag. Returns the image or null. */
export async function pull(m: SimMachineApi, st: DockerSnapshot, refText: string, io: Out, opts: { platform?: string; quiet?: boolean } = {}): Promise<ImageRec | null> {
  const r = parseRef(refText);
  if (!r) {
    io.err(`invalid reference format: repository name (${refText}) must be lowercase\n`);
    return null;
  }
  const platform = opts.platform ?? `linux/${HOST_ARCH}`;
  const res = await resolveManifest(st, r, platform, !!opts.platform);
  if ('error' in res) {
    io.err(`Error response from daemon: ${res.error}\n`);
    return null;
  }
  const say = (s: string) => {
    if (!opts.quiet) io.out(s);
  };
  say(`${r.digest ?? r.tag}: Pulling from ${r.registry === 'docker.io' ? r.repo : `${r.repo}`}\n`);
  for (const l of res.variant.layers) {
    if (st.layers[l.diffId]) say(`${shortId(l.digest)}: Already exists\n`);
    else {
      st.layers[l.diffId] = l;
      st.registry.log.push({ method: 'GET', path: `/v2/${r.repo}/blobs/${l.digest}`, status: 200 });
      say(`${shortId(l.digest)}: Pull complete\n`);
    }
  }
  if (res.variant.platform !== platform && !opts.platform) io.err(`WARNING: The requested image's platform (${res.variant.platform}) does not match the detected host platform (${platform}) and no specific platform was requested\n`);
  const id = await digestOf(canonical(res.variant.config));
  const tag = r.digest ? null : familiar(r);
  const repoDigest = `${familiar(r, false)}@${res.indexDigest ?? res.manifestDigest}`;
  let img = st.images.find((i) => i.id === id);
  const fresh = !img;
  if (!img) {
    img = { id, repoTags: [], repoDigests: [], layers: res.variant.config.rootfs.diff_ids, config: res.variant.config, platform: res.variant.platform, created: Date.parse(res.variant.config.created), manifestDigest: res.manifestDigest };
    st.images.push(img);
  }
  if (!img.repoDigests.includes(repoDigest)) img.repoDigests.push(repoDigest);
  let status = fresh ? `Downloaded newer image for ${tag ?? familiar(r, false) + '@' + r.digest}` : `Image is up to date for ${tag ?? familiar(r, false) + '@' + r.digest}`;
  if (tag) {
    for (const other of st.images) if (other !== img) other.repoTags = other.repoTags.filter((t) => t !== tag);
    if (!img.repoTags.includes(tag)) {
      if (!fresh) status = `Downloaded newer image for ${tag}`;
      img.repoTags.push(tag);
    }
  }
  say(`Digest: ${res.indexDigest ?? res.manifestDigest}\nStatus: ${status}\n`);
  if (!opts.quiet) io.out(`${r.registry}/${r.repo}${r.digest ? '@' + r.digest : ':' + r.tag}\n`);
  st.events.push({ t: clock(m), type: 'image', action: 'pull', id: tag ?? id });
  return img;
}

export function canonical(v: unknown): string {
  return JSON.stringify(sortDeep(v));
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep((v as Record<string, unknown>)[k])]));
  return v;
}

/** `docker push`: upload blobs the registry does not have, then the manifest. */
export async function push(st: DockerSnapshot, refText: string, io: Out): Promise<boolean> {
  const r = parseRef(refText);
  const img = findImage(st, refText);
  if (!r || !img) {
    io.err(`An image does not exist locally with the tag: ${refText.split(':')[0]}\n`);
    return false;
  }
  if (r.registry === 'docker.io') {
    io.err('denied: requested access to the resource is denied\n');
    return false;
  }
  io.out(`The push refers to repository [${fullName(r)}]\n`);
  const layers = img.layers.map((d) => st.layers[d]).filter(Boolean);
  for (const l of [...layers].reverse()) {
    const have = st.registry.blobs.includes(l.digest);
    st.registry.log.push({ method: 'HEAD', path: `/v2/${r.repo}/blobs/${l.digest}`, status: have ? 200 : 404 });
    if (have) io.out(`${shortId(l.digest)}: Layer already exists\n`);
    else {
      st.registry.log.push({ method: 'POST', path: `/v2/${r.repo}/blobs/uploads/`, status: 202 }, { method: 'PUT', path: `/v2/${r.repo}/blobs/uploads/…?digest=${l.digest}`, status: 201 });
      st.registry.blobs.push(l.digest);
      io.out(`${shortId(l.digest)}: Pushed\n`);
    }
  }
  const cfg = canonical(img.config);
  const cfgDigest = await digestOf(cfg);
  st.registry.manifests[cfgDigest] = cfg;
  if (!st.registry.blobs.includes(cfgDigest)) st.registry.blobs.push(cfgDigest);
  const manifest = JSON.stringify({ schemaVersion: 2, mediaType: MEDIA.manifest, config: { mediaType: MEDIA.config, digest: cfgDigest, size: cfg.length }, layers: layers.map((l) => ({ mediaType: MEDIA.layer, digest: l.digest, size: l.csize })) }, null, 3);
  const md = await digestOf(manifest);
  st.registry.manifests[md] = manifest;
  (st.registry.repos[fullName(r)] ??= {})[r.tag] = md;
  st.registry.log.push({ method: 'PUT', path: `/v2/${r.repo}/manifests/${r.tag}`, status: 201 });
  const rd = `${familiar(r, false)}@${md}`;
  if (!img.repoDigests.includes(rd)) img.repoDigests.push(rd);
  io.out(`${r.tag}: digest: ${md} size: ${manifest.length}\n`);
  return true;
}

export function imageSize(st: DockerSnapshot, img: ImageRec): number {
  return img.layers.reduce((n, d) => n + (st.layers[d]?.size ?? 0), 0);
}

// ── containers ────────────────────────────────────────────────────────────

export function findContainer(st: DockerSnapshot, key: string): ContainerRec | undefined {
  return st.containers.find((c) => c.name === key || c.name === key.replace(/^\//, '')) ?? (key.length >= 2 ? st.containers.filter((c) => c.id.startsWith(key)).at(0) : undefined);
}

export interface CreateOpts {
  name?: string;
  image: string;
  cmd: string[];
  entrypoint?: string[] | null;
  env: string[];
  ports: PortBinding[];
  publishAll: boolean;
  mounts: MountRec[];
  network?: string;
  aliases: string[];
  hostname?: string;
  workdir?: string;
  user?: string;
  memory: number;
  pidsLimit: number | null;
  cpus: number;
  restart: ContainerRec['hostConfig']['restartPolicy'];
  init: boolean;
  rm: boolean;
  tty: boolean;
  interactive: boolean;
  readOnly: boolean;
  capAdd: string[];
  capDrop: string[];
  privileged: boolean;
  securityOpt: string[];
  stopTimeout: number | null;
  stopSignal: string | null;
  logDriver: string;
  logOpts: Record<string, string>;
  labels: Record<string, string>;
  healthCmd?: string;
  sysctls?: Record<string, string>;
  platform?: string;
  compose?: ContainerRec['compose'];
}

export function defaultCreateOpts(image: string): CreateOpts {
  return { image, cmd: [], env: [], ports: [], publishAll: false, mounts: [], aliases: [], memory: 0, pidsLimit: null, cpus: 0, restart: { name: 'no', maximumRetryCount: 0 }, init: false, rm: false, tty: false, interactive: false, readOnly: false, capAdd: [], capDrop: [], privileged: false, securityOpt: [], stopTimeout: null, stopSignal: null, logDriver: 'json-file', logOpts: {}, labels: {} };
}

export class DockerError extends Error {
  constructor(
    msg: string,
    public code = 125,
  ) {
    super(msg);
  }
}

/** `docker create`: a container record with a writable layer, attached to its network. Does not start it. */
export async function createContainer(m: SimMachineApi, st: DockerSnapshot, img: ImageRec, o: CreateOpts): Promise<ContainerRec> {
  const name = o.name ?? uniqueName(st);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name)) throw new DockerError(`Invalid container name (${name}), only [a-zA-Z0-9][a-zA-Z0-9_.-] are allowed`);
  const clash = st.containers.find((c) => c.name === name);
  if (clash) throw new DockerError(`Conflict. The container name "/${name}" is already in use by container "${clash.id}". You have to remove (or rename) that container to be able to reuse that name.`, 125);
  st.seq++;
  const id = await sha256hex(`container:${st.seq}:${name}:${img.id}`);
  const netName = o.network ?? 'bridge';
  const net = st.networks.find((n) => n.name === netName || n.id.startsWith(netName));
  if (!net) throw new DockerError(`network ${netName} not found`);
  const cfg = img.config.config;
  const env = [...(cfg.Env ?? [])];
  for (const kv of o.env) {
    const k = kv.split('=')[0];
    const i = env.findIndex((e) => e.split('=')[0] === k);
    if (i >= 0) env[i] = kv;
    else env.push(kv);
  }
  const entrypoint = o.entrypoint !== undefined ? o.entrypoint : (cfg.Entrypoint ?? null);
  const cmd = o.cmd.length ? o.cmd : o.entrypoint !== undefined ? [] : (cfg.Cmd ?? []);
  const ports = [...o.ports];
  if (o.publishAll) for (const p of Object.keys(cfg.ExposedPorts ?? {})) ports.push({ hostIp: '0.0.0.0', hostPort: 32768 + st.seq, containerPort: Number(p.split('/')[0]), proto: 'tcp' });
  const labels = { ...(cfg.Labels ?? {}), ...o.labels };
  const c: ContainerRec = {
    id,
    name,
    image: o.image,
    imageId: img.id,
    created: clock(m),
    status: 'created',
    exitCode: null,
    startedAt: null,
    finishedAt: null,
    oomKilled: false,
    restartCount: 0,
    stopDurationMs: null,
    stoppedByUser: false,
    pid: 0,
    procs: [],
    config: { ...cfg, Env: env, Entrypoint: entrypoint, Cmd: cmd, WorkingDir: o.workdir ?? cfg.WorkingDir ?? '', User: o.user ?? cfg.User ?? '', Hostname: o.hostname ?? (net.driver === 'host' ? m.hostname : id.slice(0, 12)), Tty: o.tty, OpenStdin: o.interactive, Image: o.image, Labels: labels, ...(o.healthCmd ? { Healthcheck: { Test: ['CMD-SHELL', o.healthCmd] } } : {}) },
    hostConfig: {
      memory: o.memory,
      pidsLimit: o.pidsLimit,
      cpus: o.cpus,
      init: o.init,
      autoRemove: o.rm,
      restartPolicy: o.restart,
      portBindings: ports,
      networkMode: netName,
      readonlyRootfs: o.readOnly,
      capAdd: o.capAdd,
      capDrop: o.capDrop,
      privileged: o.privileged,
      securityOpt: o.securityOpt,
      stopTimeout: o.stopTimeout,
      stopSignal: o.stopSignal,
      user: o.user ?? '',
      logConfig: { type: o.logDriver, config: o.logOpts },
      tmpfs: o.mounts.filter((x) => x.type === 'tmpfs').map((x) => x.target),
      sysctls: o.sysctls ?? {},
    },
    networks: {},
    mounts: [],
    upper: {},
    tmpfsData: {},
    logs: [],
    program: null,
    health: null,
    compose: o.compose,
    labels,
  };
  // Volumes: named ones are created on first use; anonymous ones for VOLUME in the image.
  const mounts = [...o.mounts];
  for (const v of Object.keys(cfg.Volumes ?? {})) if (!mounts.some((x) => x.target === v)) mounts.push({ type: 'volume', source: (await sha256hex(`anon:${id}:${v}`)).slice(0, 64), target: v, ro: false });
  for (const mt of mounts) {
    if (mt.type === 'volume') {
      let vol = st.volumes.find((x) => x.name === mt.source);
      if (!vol) {
        vol = { name: mt.source, created: clock(m), files: {}, labels: {}, populated: false };
        st.volumes.push(vol);
        st.events.push({ t: clock(m), type: 'volume', action: 'create', id: vol.name });
      }
      if (!vol.populated && !Object.keys(vol.files).length) {
        // Docker copies what the image has at the mount point into a new, empty volume.
        const lower = merge(img.layers.map((d) => st.layers[d]?.files ?? {}));
        for (const [p, e] of Object.entries(lower)) if (p.startsWith(mt.target + '/')) vol.files[p.slice(mt.target.length)] = e;
        vol.populated = true;
      }
    }
    if (mt.type === 'bind' && !m.rootFs.exists(mt.source)) {
      if (o.mounts.includes(mt) && (o as { mountFlag?: boolean }).mountFlag) throw new DockerError(`invalid mount config for type "bind": bind source path does not exist: ${mt.source}`);
      m.rootFs.mkdir(mt.source, { parents: true });
    }
  }
  c.mounts = mounts;
  if (net.driver === 'bridge') c.networks[net.name] = { ip: allocIp(st, net), aliases: net.builtin ? [] : [name, id.slice(0, 12), ...o.aliases], mac: macFor(st.seq) };
  else c.networks[net.name] = { ip: '', aliases: [], mac: '' };
  st.containers.push(c);
  st.events.push({ t: clock(m), type: 'container', action: 'create', id, name });
  return c;
}

function uniqueName(st: DockerSnapshot): string {
  for (let i = st.seq + 1; ; i++) {
    const n = containerName(i);
    if (!st.containers.some((c) => c.name === n)) return n;
  }
}

function macFor(n: number): string {
  return `02:42:ac:11:00:${(n + 1).toString(16).padStart(2, '0')}`;
}

export function allocIp(st: DockerSnapshot, net: NetworkRec): string {
  const [a, b] = net.subnet.split('/')[0].split('.').map(Number);
  const used = new Set(st.containers.flatMap((c) => Object.values(c.networks).map((x) => x.ip)));
  for (let i = 2; i < 65000; i++) {
    const ip = `${a}.${b}.${Math.floor(i / 256)}.${i % 256}`;
    if (!used.has(ip)) return ip;
  }
  return `${a}.${b}.255.254`;
}

/** Which running container holds a host port (or a host program), for "port is already allocated". */
export function portHolder(st: DockerSnapshot, port: number, proto = 'tcp', except?: string): ContainerRec | 'host' | null {
  if (st.hostPortsBusy.includes(port)) return 'host';
  for (const c of st.containers) {
    if (c.id === except || (c.status !== 'running' && c.status !== 'restarting' && c.status !== 'paused')) continue;
    if (c.hostConfig.portBindings.some((p) => p.hostPort === port && p.proto === proto)) return c;
    if (c.hostConfig.networkMode === 'host' && c.program?.listens.some((l) => l.port === port)) return c;
  }
  return null;
}

const SIGNUM: Record<string, number> = { HUP: 1, INT: 2, QUIT: 3, KILL: 9, USR1: 10, USR2: 12, TERM: 15 };
export const sigName = (s: string) => s.toUpperCase().replace(/^SIG/, '');

function log(c: ContainerRec, t: number, s: 'stdout' | 'stderr', line: string): void {
  if (c.hostConfig.logConfig.type === 'none') return;
  c.logs.push({ t, s, line });
  if (c.logs.length > 2000) c.logs.splice(0, c.logs.length - 2000);
}

function addHostProcs(m: SimMachineApi, c: ContainerRec): void {
  const shim = m.procs.spawn({ cmd: 'containerd-shim-runc-v2', argv: ['/usr/bin/containerd-shim-runc-v2', '-namespace', 'moby', '-id', c.id, '-address', '/run/containerd/containerd.sock'], uid: 0, ppid: 1 });
  const prog = c.program!;
  const uid = Number(/^\d+/.exec(c.hostConfig.user || c.config.User || '0')?.[0] ?? 0);
  const procs: ContainerRec['procs'] = [];
  let nspid = 1;
  const add = (comm: string, argv: string[], ppidNs: number, ppidHost: number) => {
    const hostPid = m.procs.spawn({ cmd: comm, argv, uid, ppid: ppidHost, container: c.id.slice(0, 12), nspid: nspid, shim });
    procs.push({ nspid: nspid++, hostPid, comm, argv, ppid: ppidNs, state: 'S' });
    return hostPid;
  };
  if (c.hostConfig.init) {
    const tini = add('docker-init', ['/sbin/docker-init', '--', ...prog.argv], 0, shim);
    add(prog.comm, prog.argv, 1, tini);
  } else if (prog.shellParent) {
    const sh = add('sh', ['/bin/sh', '-c', (c.config.Cmd ?? []).slice(2).join(' ') || prog.argv.join(' ')], 0, shim);
    add(prog.argv[0].split('/').pop()!, prog.argv, 1, sh);
  } else {
    const main = add(prog.comm, prog.argv, 0, shim);
    if (prog.comm === 'nginx') {
      add('nginx', ['nginx: worker process'], 1, main);
      procs[0].argv = ['nginx: master process', ...prog.argv];
    }
  }
  c.procs = procs;
  c.pid = procs[0]?.hostPid ?? 0;
  (c as ContainerRec & { shimPid?: number }).shimPid = shim;
}

function removeHostProcs(m: SimMachineApi, c: ContainerRec): void {
  for (const p of c.procs) m.procs.kill(p.hostPid, 'KILL');
  const shim = (c as ContainerRec & { shimPid?: number }).shimPid;
  if (shim) m.procs.kill(shim, 'KILL');
  c.procs = [];
  c.pid = 0;
}

export interface StartResult {
  ok: boolean;
  /** Output of a oneshot program (for attached runs). */
  output: string;
  error?: string;
  exitCode?: number;
}

/** `docker start`: resolve the program, check ports and limits, create processes, run oneshots. */
export async function startContainer(m: SimMachineApi, st: DockerSnapshot, c: ContainerRec, opts: { attachInteractive?: boolean } = {}): Promise<StartResult> {
  if (c.status === 'running') return { ok: true, output: '' };
  const now = clock(m);
  const img = st.images.find((i) => i.id === c.imageId);
  if (!img) return { ok: false, output: '', error: `No such image: ${c.image}` };
  // published ports must be free on the host
  for (const p of c.hostConfig.portBindings) {
    const holder = portHolder(st, p.hostPort, p.proto, c.id);
    if (holder) {
      return { ok: false, output: '', error: `failed to set up container networking: driver failed programming external connectivity on endpoint ${c.name} (${c.id.slice(0, 64)}): Bind for ${p.hostIp || '0.0.0.0'}:${p.hostPort} failed: port is already allocated` };
    }
  }
  const ctx: ContainerCtx = { host: m, st, containerId: c.id };
  const view = containerView(st, c, m.rootFs);
  const env = containerEnv(c);
  const probe = (host: string, port: number): 'ok' | 'unresolved' | 'refused' => {
    const ip = /^\d+\.\d+\.\d+\.\d+$/.test(host) ? host : containerHooks.resolve?.(ctx, host);
    if (!ip) return 'unresolved';
    const target = st.containers.find((x) => x.status === 'running' && Object.entries(x.networks).some(([n, e]) => e.ip === ip && c.networks[n]));
    const l = target?.program?.listens.find((x) => x.port === port);
    if (!target || !l || l.bind === '127.0.0.1') return 'refused';
    return now - (target.startedAt ?? now) >= (target.program?.readyAfterMs ?? 0) ? 'ok' : 'refused';
  };
  const res = resolveProgram(c, view.files, env, { arch: img.config.architecture, interactive: c.config.Tty && c.config.OpenStdin, probe });
  if (res.startError) {
    c.status = 'created';
    c.exitCode = res.startError.code;
    return { ok: false, output: '', error: res.startError.message, exitCode: res.startError.code };
  }
  c.program = res.run;
  c.startedAt = now;
  c.finishedAt = null;
  c.oomKilled = false;
  c.stoppedByUser = false;
  c.status = 'running';
  c.exitCode = null;
  c.stopDurationMs = null;
  c.health = c.config.Healthcheck ? 'starting' : null;
  c.tmpfsData = {};
  addHostProcs(m, c);
  st.events.push({ t: now, type: 'container', action: 'start', id: c.id, name: c.name });
  for (const l of res.logs) log(c, now, l.s, l.line);
  for (const w of res.writes ?? []) {
    const prev = c.upper[w.path]?.text ?? view.files[w.path]?.text ?? '';
    c.upper[w.path] = { t: 'f', mode: 0o644, uid: 0, gid: 0, size: prev.length + w.text.length, text: prev + w.text };
  }
  if (res.run.note) log(c, now, 'stderr', res.run.note);
  let output = res.logs.map((l) => l.line + '\n').join('');
  // memory: a program that needs more than the cgroup allows is killed by the OOM killer
  const limit = c.hostConfig.memory;
  if (limit > 0 && res.run.memoryMb * 1024 * 1024 > limit) {
    finish(m, st, c, 137, { oom: true });
    st.events.push({ t: now, type: 'container', action: 'oom', id: c.id, name: c.name });
    return { ok: true, output, exitCode: 137 };
  }
  if (res.run.kind === 'oneshot') {
    let code = res.run.exitCode ?? 0;
    if (res.script !== undefined && res.script !== '') {
      const opened = await openContainer(ctx, c);
      const r = await opened.cm.exec(res.script);
      opened.commit();
      for (const line of r.out.replace(/\n$/, '').split('\n')) if (r.out) log(c, now, 'stdout', line);
      output += r.out;
      code = r.exit;
    }
    finish(m, st, c, code);
    return { ok: true, output, exitCode: code };
  }
  if (res.script) {
    const opened = await openContainer(ctx, c);
    const r = await opened.cm.exec(res.script);
    opened.commit();
    for (const line of r.out.replace(/\n$/, '').split('\n')) if (r.out) log(c, now, 'stdout', line);
    output += r.out;
  }
  void opts;
  return { ok: true, output };
}

/** The main process exited: record the code, clean up, apply the restart policy, auto-remove. */
export function finish(m: SimMachineApi, st: DockerSnapshot, c: ContainerRec, code: number, o: { oom?: boolean; byUser?: boolean } = {}): void {
  const now = clock(m);
  removeHostProcs(m, c);
  c.status = 'exited';
  c.exitCode = code;
  c.finishedAt = now;
  c.oomKilled = !!o.oom;
  c.stoppedByUser = !!o.byUser;
  c.health = null;
  c.tmpfsData = {};
  st.events.push({ t: now, type: 'container', action: 'die', id: c.id, name: c.name, attrs: { exitCode: String(code) } });
  const p = c.hostConfig.restartPolicy;
  const wants = !o.byUser && (p.name === 'always' || p.name === 'unless-stopped' || (p.name === 'on-failure' && code !== 0 && (!p.maximumRetryCount || c.restartCount < p.maximumRetryCount)));
  if (wants) {
    c.status = 'restarting';
    return;
  }
  if (c.hostConfig.autoRemove) removeContainer(m, st, c);
}

/** Let model time pass: restart backoff, health checks becoming healthy. Called before every command and fact collection. */
export async function refresh(m: SimMachineApi, st: DockerSnapshot): Promise<void> {
  const now = clock(m);
  for (const c of [...st.containers]) {
    if (c.status === 'restarting' && c.finishedAt !== null && now - c.finishedAt >= Math.min(8000, 100 * 2 ** c.restartCount)) {
      c.restartCount++;
      c.status = 'exited';
      st.events.push({ t: now, type: 'container', action: 'restart', id: c.id, name: c.name });
      await startContainer(m, st, c);
    }
    if (c.status === 'running' && c.health === 'starting' && c.startedAt !== null && now - c.startedAt >= Math.max(1000, c.program?.readyAfterMs ?? 0)) c.health = 'healthy';
  }
}

export function refreshSync(m: SimMachineApi, st: DockerSnapshot): void {
  const now = clock(m);
  for (const c of st.containers) if (c.status === 'running' && c.health === 'starting' && c.startedAt !== null && now - c.startedAt >= Math.max(1000, c.program?.readyAfterMs ?? 0)) c.health = 'healthy';
}

export interface StopOutcome {
  code: number;
  ms: number;
  /** Which of the three cases happened (for the "what happened" line and the explainer). */
  why: 'handled' | 'ignored-pid1' | 'shell-pid1' | 'init-forwarded' | 'killed';
}

/** What a stop signal does to this container: the PID 1 rule of pid_namespaces(7). */
export function stopOutcome(c: ContainerRec, signal: string, timeoutS: number): StopOutcome {
  const sig = sigName(signal);
  const prog = c.program;
  if (sig === 'KILL') return { code: 137, ms: 50, why: 'killed' };
  if (!prog) return { code: 0, ms: 0, why: 'handled' };
  const handles = prog.handles.includes(sig);
  if (c.hostConfig.init) {
    // tini is PID 1, passes the signal on; the program is not PID 1 and gets the default action if it has no handler
    return handles ? { code: 0, ms: 180, why: 'init-forwarded' } : { code: 128 + (SIGNUM[sig] ?? 15), ms: 40, why: 'init-forwarded' };
  }
  if (prog.shellParent) return { code: 137, ms: timeoutS * 1000, why: 'shell-pid1' };
  if (handles) {
    const code = /^python/.test(prog.comm) && sig === 'INT' ? 130 : 0;
    return { code, ms: prog.comm === 'postgres' ? 420 : 160, why: 'handled' };
  }
  return { code: 137, ms: timeoutS * 1000, why: 'ignored-pid1' };
}

/** `docker stop`: the stop signal, the grace period, SIGKILL. Waits (scaled) in real time. */
export async function stopContainer(m: SimMachineApi, ds: DockerState, c: ContainerRec, o: { timeout?: number; signal?: string } = {}): Promise<StopOutcome | null> {
  const st = ds.s;
  if (c.status !== 'running' && c.status !== 'paused' && c.status !== 'restarting') return null;
  if (c.status === 'restarting') {
    c.status = 'exited';
    c.stoppedByUser = true;
    return { code: c.exitCode ?? 0, ms: 0, why: 'handled' };
  }
  const signal = o.signal ?? c.hostConfig.stopSignal ?? c.config.StopSignal ?? 'SIGTERM';
  const timeout = o.timeout ?? c.hostConfig.stopTimeout ?? 10;
  const r = stopOutcome(c, signal, timeout);
  await sleep(Math.min(r.ms, 15000) * ds.timeScale);
  const now = clock(m);
  const sig = sigName(signal);
  if (r.why === 'handled' || r.why === 'init-forwarded') {
    if (c.program?.comm === 'nginx') log(c, now, 'stderr', `2026/11/18 09:00:00 [notice] 1#1: signal ${SIGNUM[sig] ?? 15} (SIG${sig}) received, ${sig === 'QUIT' ? 'shutting down' : 'exiting'}`);
    if (/^python/.test(c.program?.comm ?? '') && sig === 'TERM' && c.program?.handles.includes('TERM')) log(c, now, 'stdout', 'api: got SIGTERM, closing connections');
    if (/^python/.test(c.program?.comm ?? '') && sig === 'INT') log(c, now, 'stderr', 'KeyboardInterrupt');
    if (c.program?.comm === 'postgres') log(c, now, 'stdout', '2026-11-18 09:05:00.000 UTC [1] LOG:  received fast shutdown request');
  }
  finish(m, st, c, r.code, { byUser: true });
  c.stopDurationMs = r.ms;
  st.events.push({ t: now, type: 'container', action: 'stop', id: c.id, name: c.name });
  return r;
}

export function killContainer(m: SimMachineApi, st: DockerSnapshot, c: ContainerRec, signal = 'KILL'): boolean {
  if (c.status !== 'running' && c.status !== 'paused') return false;
  const sig = sigName(signal);
  const r = stopOutcome(c, sig, 0);
  if (sig !== 'KILL' && (r.why === 'ignored-pid1' || r.why === 'shell-pid1')) return true; // ignored by PID 1
  finish(m, st, c, sig === 'KILL' ? 137 : r.code, { byUser: true });
  st.events.push({ t: clock(m), type: 'container', action: 'kill', id: c.id, name: c.name, attrs: { signal: sig } });
  return true;
}

export function removeContainer(m: SimMachineApi, st: DockerSnapshot, c: ContainerRec, o: { volumes?: boolean } = {}): void {
  removeHostProcs(m, c);
  st.containers = st.containers.filter((x) => x !== c);
  // anonymous volumes go with --rm or rm -v; named ones stay
  for (const mt of c.mounts) {
    if (mt.type === 'volume' && /^[0-9a-f]{64}$/.test(mt.source) && (o.volumes || c.hostConfig.autoRemove)) st.volumes = st.volumes.filter((v) => v.name !== mt.source);
  }
  st.events.push({ t: clock(m), type: 'container', action: 'destroy', id: c.id, name: c.name });
}

/** `docker exec`: run one command in a running container; `-it` attaches a shell session. */
export async function execIn(m: SimMachineApi, st: DockerSnapshot, c: ContainerRec, argv: string[], o: { interactive: boolean; tty: boolean; user?: string; workdir?: string; env?: Record<string, string> }, io: Out): Promise<number> {
  const ctx: ContainerCtx = { host: m, st, containerId: c.id };
  const opened = await openContainer(ctx, c, { user: o.user, workdir: o.workdir, extraEnv: o.env });
  const name = argv[0];
  const cmd = opened.cm.lookup(name.split('/').pop()!);
  if (!cmd) {
    io.err(`OCI runtime exec failed: exec failed: unable to start container process: exec: "${name}": executable file not found in $PATH: unknown\n`);
    return 126;
  }
  const isShell = ['sh', 'bash', 'ash', 'dash'].includes(name.split('/').pop()!) && !argv.includes('-c');
  if (isShell && o.interactive && o.tty && m.attach) {
    const nspid = opened.cm.procs.spawn({ cmd: name.split('/').pop()!, argv, ppid: 0 });
    const hostPid = m.procs.spawn({ cmd: name.split('/').pop()!, argv, uid: opened.cm.user().uid, ppid: c.procs[0]?.hostPid ?? 1, container: c.id.slice(0, 12), nspid });
    c.procs.push({ nspid, hostPid, comm: name.split('/').pop()!, argv, ppid: 0, state: 'S' });
    m.attach(
      new ContainerSession(opened, c, () => {
        m.procs.kill(hostPid, 'KILL');
        c.procs = c.procs.filter((p) => p.hostPid !== hostPid);
      }),
    );
    return 0;
  }
  if (isShell && !o.interactive) return 0; // a shell without stdin reads EOF and exits
  const line = argv.map((w) => (/^[\w@%+=:,./-]+$/.test(w) ? w : `'${w.replace(/'/g, `'\\''`)}'`)).join(' ');
  const r = await opened.cm.exec(line);
  opened.commit();
  io.out(r.out);
  return r.exit;
}

/** `docker run -it image sh`: the main process is the shell, attached until `exit`. */
export function attachMain(m: SimMachineApi, ds: DockerState, c: ContainerRec, opened: Awaited<ReturnType<typeof openContainer>>): void {
  const st = ds.s;
  m.attach?.(
    new ContainerSession(opened, c, (code) => {
      finish(m, st, c, code);
      if (c.hostConfig.autoRemove && st.containers.includes(c)) removeContainer(m, st, c);
    }),
  );
}

export { openContainer, lowerMerged };

// ── networks and volumes ──────────────────────────────────────────────────

export async function createNetwork(m: SimMachineApi, st: DockerSnapshot, name: string, o: { subnet?: string; internal?: boolean; driver?: string; labels?: Record<string, string> } = {}): Promise<NetworkRec> {
  if (st.networks.some((n) => n.name === name)) throw new DockerError(`network with name ${name} already exists`, 1);
  const used = new Set(st.networks.map((n) => n.subnet));
  let subnet = o.subnet;
  for (let i = 18; !subnet; i++) if (!used.has(`172.${i}.0.0/16`)) subnet = `172.${i}.0.0/16`;
  const gw = subnet.replace(/\.0\/\d+$/, '.1').replace(/\.0\.0\.1$/, '.0.1');
  const id = await sha256hex(`network:${name}:${st.seq++}`);
  const net: NetworkRec = { id, name, driver: 'bridge', subnet, gateway: gw, internal: !!o.internal, builtin: false, created: clock(m), labels: o.labels ?? {} };
  st.networks.push(net);
  st.events.push({ t: clock(m), type: 'network', action: 'create', id, name });
  return net;
}

export function connectNetwork(st: DockerSnapshot, c: ContainerRec, net: NetworkRec, aliases: string[] = []): void {
  if (c.networks[net.name]) throw new DockerError(`endpoint with name ${c.name} already exists in network ${net.name}`, 1);
  if (c.networks.none || c.networks.host) throw new DockerError(`container cannot be disconnected from host network or connected to host network`, 1);
  c.networks[net.name] = { ip: allocIp(st, net), aliases: [c.name, c.id.slice(0, 12), ...aliases], mac: macFor(st.seq + Object.keys(c.networks).length) };
}

export function volumeSize(st: DockerSnapshot, name: string): number {
  const v = st.volumes.find((x) => x.name === name);
  return v ? Object.values(v.files).reduce((n, e) => n + (e.t === 'f' ? e.size : 0), 0) : 0;
}

export { DockerState, lowerMerged as imageFiles };
export type { ContainerCtx };
export function upperSize(c: ContainerRec): number {
  return Object.values(c.upper).reduce((n, e) => n + (e.t === 'f' ? e.size : 0), 0);
}
