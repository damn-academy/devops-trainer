// Docker Compose v2 (04 §11.3, m09): a compose.yaml is a written-down set
// of `docker run` commands plus the network and volumes of the project. `up`
// brings the system to that description once and returns; `restart:` is a
// small local loop "fell → start again"; healthchecks and `depends_on`
// conditions decide the order. The same engine functions as `docker run`.

import { parse as parseYaml, stringify } from 'yaml';
import type { SimMachineApi } from '../../core/types';
import { build } from './build';
import { clock, createContainer, createNetwork, defaultCreateOpts, dockerOf, DockerError, findImage, pull, removeContainer, startContainer, stopContainer, type CreateOpts, type Out } from './engine';
import type { ContainerRec, DockerSnapshot, MountRec, PortBinding } from './state';
import { splitWords } from './util';

export interface ComposeService {
  image?: string;
  build?: string | { context?: string; dockerfile?: string };
  command?: string | string[];
  entrypoint?: string | string[];
  environment?: Record<string, string | number | boolean | null> | string[];
  env_file?: string | string[];
  ports?: (string | number)[];
  volumes?: string[];
  networks?: string[] | Record<string, unknown>;
  depends_on?: string[] | Record<string, { condition?: string }>;
  healthcheck?: { test?: string | string[]; interval?: string; retries?: number };
  restart?: string;
  profiles?: string[];
  container_name?: string;
  user?: string;
  read_only?: boolean;
  init?: boolean;
  working_dir?: string;
  logging?: { driver?: string; options?: Record<string, string> };
}

export interface ComposeFile {
  name?: string;
  services: Record<string, ComposeService>;
  volumes?: Record<string, unknown>;
  networks?: Record<string, unknown>;
}

export interface ComposeProject {
  name: string;
  dir: string;
  file: ComposeFile;
  profiles: string[];
}

const FILES = ['compose.yaml', 'compose.yml', 'docker-compose.yaml', 'docker-compose.yml'];

/** Read the project: the file, `.env` interpolation, the project name. */
export function loadProject(m: SimMachineApi, cwd: string, o: { file?: string; project?: string; profiles: string[] }): ComposeProject | { error: string } {
  const fs = m.rootFs;
  const path = o.file ? (o.file.startsWith('/') ? o.file : `${cwd}/${o.file}`) : FILES.map((f) => `${cwd}/${f}`).find((p) => fs.exists(p));
  if (!path || !fs.exists(path)) return { error: 'no configuration file provided: not found' };
  const dir = path.slice(0, path.lastIndexOf('/')) || '/';
  const dotenv: Record<string, string> = {};
  if (fs.exists(`${dir}/.env`)) {
    for (const line of fs.readFile(`${dir}/.env`).split('\n')) {
      const mm = /^\s*([A-Za-z_]\w*)\s*=\s*(.*)\s*$/.exec(line);
      if (mm) dotenv[mm[1]] = mm[2].replace(/^["']|["']$/g, '');
    }
  }
  const text = fs.readFile(path).replace(/\$\{(\w+)(?::?-([^}]*))?\}|\$(\w+)/g, (_, a: string, d: string | undefined, b: string) => dotenv[a ?? b] ?? d ?? '');
  let file: ComposeFile;
  try {
    file = parseYaml(text) as ComposeFile;
  } catch (e) {
    return { error: `yaml: ${(e as Error).message.split('\n')[0]}` };
  }
  if (!file || typeof file !== 'object' || !file.services || typeof file.services !== 'object') return { error: `${path.slice(dir.length + 1)}: services must be a mapping` };
  for (const [n, s] of Object.entries(file.services)) {
    if (!s || typeof s !== 'object') return { error: `services.${n} must be a mapping` };
    if (!s.image && !s.build) return { error: `service "${n}" has neither an image nor a build context specified: invalid compose project` };
  }
  const name = (o.project ?? file.name ?? dir.slice(dir.lastIndexOf('/') + 1)).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return { name, dir, file, profiles: o.profiles };
}

export function activeServices(p: ComposeProject, only: string[] = []): string[] {
  const all = Object.entries(p.file.services)
    .filter(([, s]) => !s.profiles?.length || s.profiles.some((x) => p.profiles.includes(x)))
    .map(([n]) => n);
  const pick = only.length ? only : all;
  // dependency order: a service starts after the ones it depends on
  const out: string[] = [];
  const visit = (n: string, seen: Set<string>) => {
    if (out.includes(n) || seen.has(n)) return;
    seen.add(n);
    for (const d of deps(p.file.services[n])) if (p.file.services[d]) visit(d, seen);
    out.push(n);
  };
  for (const n of pick) visit(n, new Set());
  return out;
}

function deps(s: ComposeService | undefined): string[] {
  if (!s?.depends_on) return [];
  return Array.isArray(s.depends_on) ? s.depends_on : Object.keys(s.depends_on);
}

function condition(s: ComposeService, dep: string): string {
  if (!s.depends_on || Array.isArray(s.depends_on)) return 'service_started';
  return s.depends_on[dep]?.condition ?? 'service_started';
}

function envList(s: ComposeService, p: ComposeProject, m: SimMachineApi): string[] {
  const out: string[] = [];
  for (const f of s.env_file ? (Array.isArray(s.env_file) ? s.env_file : [s.env_file]) : []) {
    const path = f.startsWith('/') ? f : `${p.dir}/${f.replace(/^\.\//, '')}`;
    if (m.rootFs.exists(path)) for (const line of m.rootFs.readFile(path).split('\n')) if (/^\w+=/.test(line)) out.push(line.trim());
  }
  if (Array.isArray(s.environment)) out.push(...s.environment.map(String));
  else if (s.environment) for (const [k, v] of Object.entries(s.environment)) out.push(`${k}=${v ?? ''}`);
  return out;
}

export function parsePort(spec: string): PortBinding | null {
  const [main, proto = 'tcp'] = spec.split('/');
  const parts = main.split(':');
  if (parts.length === 1) return null; // only exposed, not published
  const containerPort = Number(parts.pop());
  const hostPort = Number(parts.pop());
  const hostIp = parts.pop() ?? '0.0.0.0';
  if (!Number.isFinite(containerPort) || !Number.isFinite(hostPort)) return null;
  return { hostIp, hostPort, containerPort, proto: proto === 'udp' ? 'udp' : 'tcp' };
}

function mountOf(spec: string, p: ComposeProject): MountRec {
  const [src, target, mode] = spec.split(':');
  if (target === undefined) return { type: 'volume', source: '', target: src, ro: false };
  const isPath = src.startsWith('.') || src.startsWith('/') || src.startsWith('~');
  if (isPath) return { type: 'bind', source: src.startsWith('/') ? src : `${p.dir}/${src.replace(/^\.\/?/, '')}`.replace(/\/$/, ''), target, ro: mode === 'ro' };
  return { type: 'volume', source: `${p.name}_${src}`, target, ro: mode === 'ro' };
}

function containersOf(st: DockerSnapshot, project: string): ContainerRec[] {
  return st.containers.filter((c) => c.compose?.project === project);
}

/** `docker compose up [-d] [--build] [--force-recreate] [--wait]`. */
export async function composeUp(m: SimMachineApi, p: ComposeProject, o: { detach: boolean; build: boolean; forceRecreate: boolean; wait: boolean; services: string[] }, io: Out): Promise<number> {
  const ds = dockerOf(m);
  const st = ds.s;
  const lines: string[] = [];
  const say = (s: string) => lines.push(s);
  const services = activeServices(p, o.services);
  try {
    // networks
    const declared = Object.keys(p.file.networks ?? {});
    const needDefault = services.some((n) => !p.file.services[n].networks);
    for (const n of [...(needDefault ? ['default'] : []), ...declared]) {
      const full = `${p.name}_${n}`;
      if (!st.networks.some((x) => x.name === full)) {
        await createNetwork(m, st, full, { labels: { 'com.docker.compose.project': p.name, 'com.docker.compose.network': n } });
        say(` ✔ Network ${full}  Created`);
      }
    }
    // volumes
    for (const v of Object.keys(p.file.volumes ?? {})) {
      const full = `${p.name}_${v}`;
      if (!st.volumes.some((x) => x.name === full)) {
        st.volumes.push({ name: full, created: clock(m), files: {}, labels: { 'com.docker.compose.project': p.name, 'com.docker.compose.volume': v }, populated: false });
        say(` ✔ Volume "${full}"  Created`);
      }
    }
    for (const name of services) {
      const s = p.file.services[name];
      let imageRef = s.image ?? `${p.name}-${name}`;
      if (s.build && (o.build || !findImage(st, imageRef))) {
        const b = typeof s.build === 'string' ? { context: s.build } : s.build;
        const ctx = `${p.dir}/${(b.context ?? '.').replace(/^\.\/?/, '')}`.replace(/\/$/, '');
        const img = await build(m, st, { context: ctx || '/', file: b.dockerfile, tags: [imageRef.includes(':') ? imageRef : `${imageRef}:latest`], noCache: false, buildArgs: {}, quiet: true }, { out: () => {}, err: io.err });
        if (!img) return 1;
        say(` ✔ Service ${name}  Built`);
        if (!imageRef.includes(':')) imageRef = `${imageRef}:latest`;
      }
      let img = findImage(st, imageRef);
      if (!img) {
        img = (await pull(m, st, imageRef, { out: () => {}, err: io.err }, { quiet: true })) ?? undefined;
        if (!img) return 1;
        say(` ✔ ${name} Pulled`);
      }
      const cname = s.container_name ?? `${p.name}-${name}-1`;
      const existing = st.containers.find((c) => c.name === cname);
      if (existing && !o.forceRecreate && existing.imageId === img.id) {
        if (existing.status !== 'running') await startContainer(m, st, existing);
        say(` ✔ Container ${cname}  Running`);
        continue;
      }
      if (existing) {
        await stopContainer(m, ds, existing, { timeout: 10 });
        removeContainer(m, st, existing);
        say(` ✔ Container ${cname}  Recreated`);
      }
      // wait for dependencies
      for (const d of deps(s)) {
        const dc = st.containers.find((c) => c.compose?.project === p.name && c.compose.service === d);
        if (!dc) continue;
        const cond = condition(s, d);
        if (cond === 'service_healthy') {
          if (!dc.config.Healthcheck) {
            io.err(`dependency failed to start: container ${dc.name} has no healthcheck configured\n`);
            return 1;
          }
          if (dc.status === 'running') {
            // compose polls the health status; the model fast-forwards the start period
            dc.startedAt = (dc.startedAt ?? clock(m)) - Math.max(1000, dc.program?.readyAfterMs ?? 0);
            dc.health = 'healthy';
            say(` ✔ Container ${dc.name}  Healthy`);
          } else {
            io.err(`dependency failed to start: container ${dc.name} exited (${dc.exitCode ?? 1})\n`);
            return 1;
          }
        } else if (cond === 'service_completed_successfully' && !(dc.status === 'exited' && dc.exitCode === 0)) {
          io.err(`service "${d}" didn't complete successfully: exit ${dc.exitCode ?? 1}\n`);
          return 1;
        }
      }
      const opts: CreateOpts = { ...defaultCreateOpts(imageRef), name: cname };
      opts.env = envList(s, p, m);
      if (s.command !== undefined) opts.cmd = Array.isArray(s.command) ? s.command.map(String) : splitWords(s.command);
      if (s.entrypoint !== undefined) opts.entrypoint = Array.isArray(s.entrypoint) ? s.entrypoint : splitWords(s.entrypoint);
      opts.ports = (s.ports ?? []).map((x) => parsePort(String(x))).filter((x): x is PortBinding => !!x);
      opts.mounts = (s.volumes ?? []).map((v) => mountOf(v, p));
      const nets = s.networks ? (Array.isArray(s.networks) ? s.networks : Object.keys(s.networks)) : ['default'];
      opts.network = `${p.name}_${nets[0]}`;
      opts.aliases = [name];
      opts.user = s.user;
      opts.readOnly = !!s.read_only;
      opts.init = !!s.init;
      opts.workdir = s.working_dir;
      if (s.restart) {
        const [rn, rc] = s.restart.split(':');
        opts.restart = { name: (['no', 'always', 'on-failure', 'unless-stopped'].includes(rn) ? rn : 'no') as CreateOpts['restart']['name'], maximumRetryCount: Number(rc ?? 0) };
      }
      if (s.healthcheck?.test) {
        const t = s.healthcheck.test;
        opts.healthCmd = Array.isArray(t) ? (t[0] === 'CMD-SHELL' ? t.slice(1).join(' ') : t.slice(t[0] === 'CMD' ? 1 : 0).join(' ')) : t;
      }
      if (s.logging) {
        opts.logDriver = s.logging.driver ?? 'json-file';
        opts.logOpts = s.logging.options ?? {};
      }
      opts.labels = { 'com.docker.compose.project': p.name, 'com.docker.compose.service': name, 'com.docker.compose.container-number': '1' };
      opts.compose = { project: p.name, service: name, number: 1 };
      const c = await createContainer(m, st, img, opts);
      for (const extra of nets.slice(1)) {
        const net = st.networks.find((x) => x.name === `${p.name}_${extra}`);
        if (net) c.networks[net.name] = { ip: `${net.subnet.split('.').slice(0, 2).join('.')}.0.${2 + containersOf(st, p.name).length}`, aliases: [c.name, name], mac: '02:42:ac:12:00:09' };
      }
      say(` ✔ Container ${cname}  Created`);
      const r = await startContainer(m, st, c);
      if (!r.ok) {
        io.out(`[+] Running ${lines.length}/${lines.length}\n${lines.join('\n')}\n`);
        io.err(`Error response from daemon: ${r.error}\n`);
        return 1;
      }
      say(` ✔ Container ${cname}  Started`);
    }
  } catch (e) {
    if (e instanceof DockerError) {
      io.err(`Error response from daemon: ${e.message}\n`);
      return 1;
    }
    throw e;
  }
  io.out(`[+] Running ${lines.length}/${lines.length}\n${lines.join('\n')}\n`);
  if (o.wait) {
    for (const c of containersOf(st, p.name)) {
      if (c.config.Healthcheck && c.status === 'running') {
        c.startedAt = (c.startedAt ?? clock(m)) - Math.max(1000, c.program?.readyAfterMs ?? 0);
        c.health = 'healthy';
      }
    }
    const bad = containersOf(st, p.name).find((c) => c.status !== 'running');
    if (bad) {
      io.err(`container ${bad.name} exited (${bad.exitCode})\n`);
      return 1;
    }
  }
  if (!o.detach && !o.wait) io.out('dsim: attached mode is not simulated; the project keeps running as with -d. Use `docker compose logs` to read the output.\n');
  return 0;
}

export async function composeDown(m: SimMachineApi, p: ComposeProject, o: { volumes: boolean }, io: Out): Promise<number> {
  const ds = dockerOf(m);
  const st = ds.s;
  const lines: string[] = [];
  for (const c of [...containersOf(st, p.name)].reverse()) {
    if (c.status === 'running') await stopContainer(m, ds, c, { timeout: 10 });
    removeContainer(m, st, c, { volumes: true });
    lines.push(` ✔ Container ${c.name}  Removed`);
  }
  if (o.volumes) {
    for (const v of [...st.volumes]) if (v.labels['com.docker.compose.project'] === p.name) {
      st.volumes = st.volumes.filter((x) => x !== v);
      lines.push(` ✔ Volume ${v.name}  Removed`);
    }
  }
  for (const n of [...st.networks]) if (n.labels['com.docker.compose.project'] === p.name) {
    st.networks = st.networks.filter((x) => x !== n);
    lines.push(` ✔ Network ${n.name}  Removed`);
  }
  io.out(`[+] Running ${lines.length}/${lines.length}\n${lines.join('\n')}\n`);
  return 0;
}

export function composeContainers(m: SimMachineApi, project: string): ContainerRec[] {
  return containersOf(dockerOf(m).s, project);
}

/** `docker compose config`: the file after interpolation, in canonical form. */
export function composeConfig(p: ComposeProject): string {
  const out: Record<string, unknown> = { name: p.name, services: {} as Record<string, unknown> };
  for (const n of Object.keys(p.file.services).sort()) {
    const s = { ...p.file.services[n] } as Record<string, unknown>;
    if (Array.isArray(s.environment)) s.environment = Object.fromEntries((s.environment as string[]).map((kv) => [kv.split('=')[0], kv.slice(kv.indexOf('=') + 1)]));
    if (!s.networks) s.networks = { default: null };
    (out.services as Record<string, unknown>)[n] = s;
  }
  out.networks = { default: { name: `${p.name}_default` }, ...(p.file.networks ?? {}) };
  if (p.file.volumes) out.volumes = Object.fromEntries(Object.keys(p.file.volumes).map((v) => [v, { name: `${p.name}_${v}` }]));
  return stringify(out);
}
