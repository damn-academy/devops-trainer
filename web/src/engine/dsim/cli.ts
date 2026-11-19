// The `docker` command of the simulated shell (04 §11.3): cobra-like flag
// parsing (bundled short flags `-dit`, `--name=x` and `--name x`, repeated
// flags, flags before the image only for run/exec), Docker's tables and
// messages, and the subcommands the course uses. State changes go through
// engine.ts; output follows the real CLI so the doc ladder pages match.

import { bi } from '../../core/i18n';
import type { CmdContext, ShellCommand, SimMachineApi } from '../../core/types';
import { build } from './build';
import { composeConfig, composeContainers, composeDown, composeUp, loadProject, parsePort } from './compose';
import {
  attachMain,
  clock,
  connectNetwork,
  createContainer,
  createNetwork,
  defaultCreateOpts,
  dockerOf,
  DockerError,
  ENGINE_VERSION,
  ensureDaemon,
  execIn,
  familiar,
  findContainer,
  findImage,
  imageSize,
  killContainer,
  openContainer,
  parseRef,
  pull,
  push,
  rawManifest,
  refresh,
  removeContainer,
  startContainer,
  stopContainer,
  upperSize,
  volumeSize,
  type CreateOpts,
  type Out,
} from './engine';
import { helpText } from './help';
import { curl } from './http';
import { containerDoc, imageDoc, networkDoc, volumeDoc } from './inspect';
import { dockerDiff } from './rootfs';
import type { ContainerRec, DockerSnapshot, ImageRec, MountRec } from './state';
import { render, TemplateError } from './template';
import { ago, dockerSize, humanDuration, parseBytes, shortId, table, truncCommand } from './util';

// ── flags ─────────────────────────────────────────────────────────────────

interface FlagDef {
  short?: string;
  value?: boolean;
  multi?: boolean;
}

interface Parsed {
  flags: Record<string, string | boolean>;
  multi: Record<string, string[]>;
  args: string[];
  error?: string;
}

function parseFlags(argv: string[], defs: Record<string, FlagDef>, interspersed = true): Parsed {
  const flags: Parsed['flags'] = {};
  const multi: Parsed['multi'] = {};
  const args: string[] = [];
  const byShort = new Map(Object.entries(defs).filter(([, d]) => d.short).map(([n, d]) => [d.short!, n]));
  const set = (name: string, v: string | boolean) => {
    if (defs[name]?.multi) (multi[name] ??= []).push(String(v));
    else flags[name] = v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      args.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith('--') && a.length > 2) {
      const eq = a.indexOf('=');
      const name = eq > 0 ? a.slice(2, eq) : a.slice(2);
      const d = defs[name];
      if (!d) return { flags, multi, args, error: `unknown flag: --${name}` };
      if (d.value) {
        const v = eq > 0 ? a.slice(eq + 1) : argv[++i];
        if (v === undefined) return { flags, multi, args, error: `flag needs an argument: --${name}` };
        set(name, v);
      } else set(name, eq > 0 ? a.slice(eq + 1) !== 'false' : true);
      continue;
    }
    if (a.startsWith('-') && a.length > 1 && a !== '-') {
      for (let j = 1; j < a.length; j++) {
        const name = byShort.get(a[j]);
        if (!name) return { flags, multi, args, error: `unknown shorthand flag: '${a[j]}' in ${a}` };
        if (defs[name].value) {
          const v = a.slice(j + 1) || argv[++i];
          if (v === undefined) return { flags, multi, args, error: `flag needs an argument: '${a[j]}' in -${a[j]}` };
          set(name, v.replace(/^=/, ''));
          break;
        }
        set(name, true);
      }
      continue;
    }
    if (!interspersed) {
      args.push(...argv.slice(i));
      break;
    }
    args.push(a);
  }
  return { flags, multi, args };
}

const str = (p: Parsed, n: string) => (typeof p.flags[n] === 'string' ? (p.flags[n] as string) : undefined);
const on = (p: Parsed, n: string) => !!p.flags[n];

const RUN_FLAGS: Record<string, FlagDef> = {
  detach: { short: 'd' },
  interactive: { short: 'i' },
  tty: { short: 't' },
  rm: {},
  name: { value: true },
  publish: { short: 'p', value: true, multi: true },
  'publish-all': { short: 'P' },
  env: { short: 'e', value: true, multi: true },
  'env-file': { value: true, multi: true },
  volume: { short: 'v', value: true, multi: true },
  mount: { value: true, multi: true },
  tmpfs: { value: true, multi: true },
  network: { value: true },
  net: { value: true },
  'network-alias': { value: true, multi: true },
  hostname: { short: 'h', value: true },
  workdir: { short: 'w', value: true },
  user: { short: 'u', value: true },
  entrypoint: { value: true },
  restart: { value: true },
  memory: { short: 'm', value: true },
  'memory-swap': { value: true },
  cpus: { value: true },
  'pids-limit': { value: true },
  init: {},
  'read-only': {},
  'cap-add': { value: true, multi: true },
  'cap-drop': { value: true, multi: true },
  privileged: {},
  'security-opt': { value: true, multi: true },
  'stop-timeout': { value: true },
  'stop-signal': { value: true },
  'log-driver': { value: true },
  'log-opt': { value: true, multi: true },
  label: { short: 'l', value: true, multi: true },
  'health-cmd': { value: true },
  'health-interval': { value: true },
  'health-retries': { value: true },
  platform: { value: true },
  pull: { value: true },
  quiet: { short: 'q' },
  'add-host': { value: true, multi: true },
  sysctl: { value: true, multi: true },
  ulimit: { value: true, multi: true },
  help: {},
  // understood but not simulated (04 §5.3)
  pid: { value: true },
  ipc: { value: true },
  uts: { value: true },
  userns: { value: true },
  device: { value: true, multi: true },
  gpus: { value: true },
  dns: { value: true, multi: true },
  'shm-size': { value: true },
  'oom-kill-disable': {},
  ip: { value: true },
  expose: { value: true, multi: true },
  'cpu-shares': { short: 'c', value: true },
  cidfile: { value: true },
  attach: { short: 'a', value: true, multi: true },
  runtime: { value: true },
  'no-healthcheck': {},
};

const SIM_ONLY_NOTE = (flag: string) => `dsim: flag --${flag} is not simulated here; it works on a real Docker Engine (module m13)\n`;
const NOT_SIMULATED = ['pid', 'ipc', 'uts', 'userns', 'device', 'gpus', 'dns', 'shm-size', 'oom-kill-disable', 'ip', 'expose', 'cpu-shares', 'cidfile', 'attach', 'runtime', 'no-healthcheck'];

function fail(ctx: CmdContext, msg: string, cmd: string, code = 125): number {
  ctx.err(`docker: ${msg}\n\nRun 'docker ${cmd} --help' for more information\n`);
  return code;
}

function parseMount(spec: string, cwd: string, kind: 'v' | 'mount' | 'tmpfs'): MountRec | string {
  if (kind === 'tmpfs') return { type: 'tmpfs', source: '', target: spec.split(':')[0], ro: false };
  if (kind === 'mount') {
    const kv = Object.fromEntries(spec.split(',').map((p) => (p.includes('=') ? [p.slice(0, p.indexOf('=')), p.slice(p.indexOf('=') + 1)] : [p, 'true'])));
    const type = (kv.type ?? 'volume') as MountRec['type'];
    const target = kv.target ?? kv.destination ?? kv.dst;
    if (!target) return 'invalid argument "' + spec + '" for "--mount" flag: target is required';
    const source = kv.source ?? kv.src ?? '';
    return { type, source: type === 'bind' && !source.startsWith('/') ? `${cwd}/${source}` : source, target, ro: kv.readonly === 'true' || kv.ro === 'true' };
  }
  const parts = spec.split(':');
  if (parts.length === 1) return { type: 'volume', source: '', target: parts[0], ro: false };
  const [src, target, mode] = parts;
  if (!target?.startsWith('/')) return `invalid spec: ${spec}: invalid volume specification`;
  if (src.startsWith('/') || src.startsWith('.') || src.startsWith('~')) {
    if (src.startsWith('.')) return `invalid spec: ${spec}: create ${src}: "${src}" includes invalid characters for a local volume name, only "[a-zA-Z0-9][a-zA-Z0-9_.-]" are allowed. If you intended to pass a host directory, use absolute path`;
    return { type: 'bind', source: src.replace(/\/$/, ''), target, ro: mode === 'ro' };
  }
  return { type: 'volume', source: src, target, ro: mode === 'ro' };
}

/** Build CreateOpts from `docker run/create` flags. Returns an error text on bad input. */
async function createOpts(ctx: CmdContext, p: Parsed, image: string, cmd: string[]): Promise<CreateOpts | string> {
  const o = defaultCreateOpts(image);
  o.cmd = cmd;
  o.name = str(p, 'name');
  o.tty = on(p, 'tty');
  o.interactive = on(p, 'interactive');
  o.rm = on(p, 'rm');
  o.init = on(p, 'init');
  o.readOnly = on(p, 'read-only');
  o.privileged = on(p, 'privileged');
  o.publishAll = on(p, 'publish-all');
  o.hostname = str(p, 'hostname');
  o.workdir = str(p, 'workdir');
  o.user = str(p, 'user');
  o.network = str(p, 'network') ?? str(p, 'net');
  o.aliases = p.multi['network-alias'] ?? [];
  o.platform = str(p, 'platform');
  if (str(p, 'entrypoint') !== undefined) o.entrypoint = str(p, 'entrypoint') ? [str(p, 'entrypoint')!] : [];
  o.capAdd = (p.multi['cap-add'] ?? []).map((c) => c.toUpperCase().replace(/^CAP_/, ''));
  o.capDrop = (p.multi['cap-drop'] ?? []).map((c) => c.toUpperCase().replace(/^CAP_/, ''));
  o.securityOpt = p.multi['security-opt'] ?? [];
  o.labels = Object.fromEntries((p.multi.label ?? []).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1)]));
  o.healthCmd = str(p, 'health-cmd');
  o.sysctls = Object.fromEntries((p.multi.sysctl ?? []).map((kv) => [kv.slice(0, kv.indexOf('=')), kv.slice(kv.indexOf('=') + 1)]));
  for (const e of p.multi.env ?? []) o.env.push(e.includes('=') ? e : ctx.env[e] !== undefined ? `${e}=${ctx.env[e]}` : e);
  for (const f of p.multi['env-file'] ?? []) {
    try {
      for (const line of ctx.fs.readFile(f).split('\n')) if (/^\s*[A-Za-z_]\w*=/.test(line)) o.env.push(line.trim());
    } catch {
      return `open ${f}: no such file or directory`;
    }
  }
  for (const spec of p.multi.publish ?? []) {
    const b = parsePort(spec);
    if (!b) return `invalid argument "${spec}" for "-p, --publish" flag: invalid port format`;
    o.ports.push(b);
  }
  for (const [kind, list] of [['v', p.multi.volume], ['mount', p.multi.mount], ['tmpfs', p.multi.tmpfs]] as const) {
    for (const spec of list ?? []) {
      const mt = parseMount(spec, ctx.cwd, kind);
      if (typeof mt === 'string') return mt;
      if (mt.type === 'volume' && !mt.source) mt.source = (await anonName(mt.target, spec)).slice(0, 64);
      o.mounts.push(mt);
    }
  }
  const mem = str(p, 'memory');
  if (mem) {
    const b = parseBytes(mem);
    if (!Number.isFinite(b)) return `invalid argument "${mem}" for "-m, --memory" flag: invalid size: '${mem}'`;
    if (b < 6 * 1024 * 1024) return 'Error response from daemon: Minimum memory limit allowed is 6MB';
    o.memory = b;
  }
  if (str(p, 'pids-limit')) o.pidsLimit = Number(str(p, 'pids-limit'));
  if (str(p, 'cpus')) o.cpus = Number(str(p, 'cpus'));
  if (str(p, 'stop-timeout')) o.stopTimeout = Number(str(p, 'stop-timeout'));
  if (str(p, 'stop-signal')) o.stopSignal = str(p, 'stop-signal')!;
  if (str(p, 'log-driver')) o.logDriver = str(p, 'log-driver')!;
  o.logOpts = Object.fromEntries((p.multi['log-opt'] ?? []).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1)]));
  const r = str(p, 'restart');
  if (r) {
    const [name, count] = r.split(':');
    if (!['no', 'always', 'on-failure', 'unless-stopped'].includes(name)) return `invalid restart policy ${r}`;
    o.restart = { name: name as CreateOpts['restart']['name'], maximumRetryCount: Number(count ?? 0) };
  }
  if (o.rm && o.restart.name !== 'no') return 'Conflicting options: cannot specify both --restart and --rm';
  return o;
}

async function anonName(target: string, spec: string): Promise<string> {
  const { sha256hex } = await import('./util');
  return sha256hex(`anon:${target}:${spec}:${Math.random()}`);
}

// ── formatting ────────────────────────────────────────────────────────────

function statusText(c: ContainerRec, now: number): string {
  switch (c.status) {
    case 'running':
      return `Up ${humanDuration(now - (c.startedAt ?? now))}${c.health ? ` (${c.health === 'starting' ? 'health: starting' : c.health})` : ''}`;
    case 'paused':
      return `Up ${humanDuration(now - (c.startedAt ?? now))} (Paused)`;
    case 'restarting':
      return `Restarting (${c.exitCode ?? 0}) ${ago(now - (c.finishedAt ?? now))}`;
    case 'exited':
      return `Exited (${c.exitCode ?? 0}) ${ago(now - (c.finishedAt ?? now))}`;
    case 'created':
      return 'Created';
    default:
      return c.status;
  }
}

function portsText(c: ContainerRec): string {
  const out: string[] = [];
  for (const b of c.hostConfig.portBindings) {
    if (c.status !== 'running') continue;
    out.push(`${b.hostIp || '0.0.0.0'}:${b.hostPort}->${b.containerPort}/${b.proto}`);
    if (!b.hostIp || b.hostIp === '0.0.0.0') out.push(`[::]:${b.hostPort}->${b.containerPort}/${b.proto}`);
  }
  for (const p of Object.keys(c.config.ExposedPorts ?? {})) if (!c.hostConfig.portBindings.some((b) => `${b.containerPort}/${b.proto}` === p)) out.push(p);
  return out.join(', ');
}

function commandText(c: ContainerRec): string {
  return [...(c.config.Entrypoint ?? []), ...(c.config.Cmd ?? [])].join(' ');
}

function psRow(c: ContainerRec, now: number) {
  return {
    ID: c.id.slice(0, 12),
    Image: c.image,
    Command: truncCommand(commandText(c)),
    CreatedAt: new Date(c.created).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' +0000 UTC'),
    RunningFor: ago(now - c.created),
    Ports: portsText(c),
    State: c.status,
    Status: statusText(c, now),
    Size: `${dockerSize(upperSize(c))}`,
    Names: c.name,
    Labels: Object.entries(c.labels)
      .map(([k, v]) => `${k}=${v}`)
      .join(','),
    Mounts: c.mounts.map((m) => (m.type === 'volume' ? m.source.slice(0, 15) : m.source)).join(','),
    Networks: Object.keys(c.networks).join(','),
  };
}

const PS_HEADERS: Record<string, string> = { ID: 'CONTAINER ID', Image: 'IMAGE', Command: 'COMMAND', CreatedAt: 'CREATED AT', RunningFor: 'CREATED', Ports: 'PORTS', State: 'STATE', Status: 'STATUS', Size: 'SIZE', Names: 'NAMES', Labels: 'LABELS', Mounts: 'MOUNTS', Networks: 'NETWORKS', Repository: 'REPOSITORY', Tag: 'TAG', CreatedSince: 'CREATED', Digest: 'DIGEST', Name: 'NAME', Driver: 'DRIVER', Scope: 'SCOPE' };

/** Print rows with --format: "table …", "json", a template, or the default table. */
function printRows(ctx: CmdContext, rows: Record<string, unknown>[], format: string | undefined, def: { cols: string[]; header: string[] }): number {
  try {
    if (format === 'json') {
      for (const r of rows) ctx.out(JSON.stringify(r) + '\n');
      return 0;
    }
    if (format && format !== 'table') {
      const isTable = format.startsWith('table');
      const tpl = isTable ? format.replace(/^table\s*/, '') : format;
      if (isTable) {
        const head = render(tpl.replace(/\{\{\s*\.(\w+)\s*\}\}/g, (_, f: string) => PS_HEADERS[f] ?? f.toUpperCase()), {});
        const body = rows.map((r) => render(tpl, r));
        const cells = [head, ...body].map((l) => l.split('\t'));
        ctx.out(table(cells[0], cells.slice(1)));
      } else for (const r of rows) ctx.out(render(tpl, r) + '\n');
      return 0;
    }
  } catch (e) {
    if (e instanceof TemplateError) {
      ctx.err(`${e.message}\n`);
      return 1;
    }
    throw e;
  }
  ctx.out(table(def.header, rows.map((r) => def.cols.map((c) => String(r[c] ?? '')))));
  return 0;
}

// ── subcommands ───────────────────────────────────────────────────────────

type Sub = (ctx: CmdContext, args: string[], m: SimMachineApi, st: DockerSnapshot) => Promise<number> | number;

const io = (ctx: CmdContext): Out => ({ out: ctx.out, err: ctx.err });

async function cmdRun(ctx: CmdContext, args: string[], m: SimMachineApi, st: DockerSnapshot, createOnly = false): Promise<number> {
  const name = createOnly ? 'create' : 'run';
  const p = parseFlags(args, RUN_FLAGS, false);
  if (p.error) return fail(ctx, p.error, name);
  if (on(p, 'help')) {
    ctx.out(helpText(name)! + '');
    return 0;
  }
  for (const f of NOT_SIMULATED) if (p.flags[f] !== undefined || p.multi[f]) ctx.err(SIM_ONLY_NOTE(f));
  for (const f of ['add-host', 'ulimit'] as const) if (p.multi[f]) ctx.err(SIM_ONLY_NOTE(f));
  const [image, ...cmd] = p.args;
  if (!image) return fail(ctx, `'docker ${name}' requires at least 1 argument`, name);
  const o = await createOpts(ctx, p, image, cmd);
  if (typeof o === 'string') return fail(ctx, o, name);
  let img = findImage(st, image);
  if (img && o.platform && img.platform !== o.platform) img = undefined;
  if (!img || str(p, 'pull') === 'always') {
    if (str(p, 'pull') === 'never' && !img) return fail(ctx, `Error response from daemon: No such image: ${image}`, name);
    if (!img) ctx.err(`Unable to find image '${image.includes(':') || image.includes('@') ? image : image + ':latest'}' locally\n`);
    const pulled = await pull(m, st, image, { out: on(p, 'quiet') ? () => {} : ctx.out, err: ctx.err }, { platform: o.platform });
    if (!pulled) {
      ctx.err(`\nRun 'docker ${name} --help' for more information\n`);
      return 125;
    }
    img = pulled;
  }
  let c: ContainerRec;
  try {
    c = await createContainer(m, st, img, o);
  } catch (e) {
    if (e instanceof DockerError) return fail(ctx, `Error response from daemon: ${e.message}`, name, e.code);
    throw e;
  }
  if (createOnly) {
    ctx.out(`${c.id}\n`);
    return 0;
  }
  const detach = on(p, 'detach');
  const interactiveShell = o.tty && o.interactive && !detach;
  if (interactiveShell) {
    // the main process reads the terminal: start it as an idle shell and attach
    c.config.OpenStdin = true;
  }
  const r = await startContainer(m, st, c);
  if (!r.ok) {
    ctx.err(`docker: Error response from daemon: ${r.error}\n\nRun 'docker run --help' for more information\n`);
    return r.exitCode ?? 125;
  }
  if (detach) {
    ctx.out(`${c.id}\n`);
    return 0;
  }
  if (interactiveShell && c.status === 'running' && c.program?.kind === 'idle' && ['sh', 'ash', 'bash', 'dash'].includes(c.program.comm)) {
    const opened = await openContainer({ host: m, st, containerId: c.id }, c);
    attachMain(m, dockerOf(m), c, opened);
    return 0;
  }
  if (r.output) ctx.out(r.output.endsWith('\n') ? r.output : r.output + '\n');
  if (c.status === 'running') {
    ctx.err('\x1b[2mdsim: in a real terminal `docker run` without -d stays attached and streams the logs until Ctrl+C; here it returns and the container keeps running.\x1b[0m\n');
    return 0;
  }
  return r.exitCode ?? c.exitCode ?? 0;
}

const cmdPs: Sub = (ctx, args, m, st) => {
  const p = parseFlags(args, { all: { short: 'a' }, quiet: { short: 'q' }, size: { short: 's' }, latest: { short: 'l' }, last: { short: 'n', value: true }, filter: { short: 'f', value: true, multi: true }, format: { value: true }, 'no-trunc': {}, help: {} });
  if (p.error) return fail(ctx, p.error, 'ps');
  const now = clock(m);
  let list = [...st.containers].sort((a, b) => b.created - a.created);
  if (!on(p, 'all') && !on(p, 'latest') && !str(p, 'last')) list = list.filter((c) => c.status === 'running' || c.status === 'restarting' || c.status === 'paused');
  if (on(p, 'latest')) list = list.slice(0, 1);
  if (str(p, 'last')) list = list.slice(0, Number(str(p, 'last')));
  for (const f of p.multi.filter ?? []) {
    const [k, v] = [f.slice(0, f.indexOf('=')), f.slice(f.indexOf('=') + 1)];
    list = list.filter((c) => {
      if (k === 'status') return c.status === v;
      if (k === 'name') return c.name.includes(v);
      if (k === 'ancestor') return c.image === v || c.image.split(':')[0] === v;
      if (k === 'exited') return c.status === 'exited' && String(c.exitCode) === v;
      if (k === 'label') return v.includes('=') ? c.labels[v.split('=')[0]] === v.split('=')[1] : v in c.labels;
      if (k === 'network') return v in c.networks;
      if (k === 'id') return c.id.startsWith(v);
      return true;
    });
  }
  if (on(p, 'quiet')) {
    for (const c of list) ctx.out(`${on(p, 'no-trunc') ? c.id : c.id.slice(0, 12)}\n`);
    return 0;
  }
  const rows = list.map((c) => {
    const r = psRow(c, now);
    if (on(p, 'size')) r.Size = `${dockerSize(upperSize(c))} (virtual ${dockerSize(imageSize(st, st.images.find((i) => i.id === c.imageId)!) + upperSize(c))})`;
    if (on(p, 'no-trunc')) {
      r.ID = c.id;
      r.Command = `"${commandText(c)}"`;
    }
    return r;
  });
  const cols = ['ID', 'Image', 'Command', 'RunningFor', 'Status', 'Ports', 'Names', ...(on(p, 'size') ? ['Size'] : [])];
  return printRows(ctx, rows, str(p, 'format'), { cols, header: cols.map((c) => PS_HEADERS[c]) });
};

async function cmdLogs(ctx: CmdContext, args: string[], m: SimMachineApi, st: DockerSnapshot): Promise<number> {
  const p = parseFlags(args, { follow: { short: 'f' }, tail: { short: 'n', value: true }, timestamps: { short: 't' }, since: { value: true }, until: { value: true }, details: {}, help: {} });
  if (p.error) return fail(ctx, p.error, 'logs');
  const c = findContainer(st, p.args[0] ?? '');
  if (!p.args[0]) return fail(ctx, `"docker logs" requires exactly 1 argument.`, 'logs', 1);
  if (!c) {
    ctx.err(`Error response from daemon: No such container: ${p.args[0]}\n`);
    return 1;
  }
  if (c.hostConfig.logConfig.type === 'none') {
    ctx.err('Error response from daemon: configured logging driver does not support reading\n');
    return 1;
  }
  let lines = c.logs;
  const since = str(p, 'since');
  if (since) {
    const now = clock(m);
    const rel = /^(\d+)(s|m|h)$/.exec(since);
    const t = rel ? now - Number(rel[1]) * { s: 1000, m: 60000, h: 3600000 }[rel[2] as 's' | 'm' | 'h'] : Date.parse(since);
    lines = lines.filter((l) => l.t >= t);
  }
  const tail = str(p, 'tail');
  if (tail && tail !== 'all') lines = lines.slice(-Number(tail));
  for (const l of lines) {
    const text = `${on(p, 'timestamps') ? new Date(l.t).toISOString().replace(/\.(\d{3})Z$/, '.$1000000Z') + ' ' : ''}${l.line}\n`;
    if (l.s === 'stderr') ctx.err(text);
    else ctx.out(text);
  }
  if (on(p, 'follow') && c.status === 'running') ctx.err('\x1b[2mdsim: `-f` keeps following on a real engine until Ctrl+C; the simulator shows what is written so far.\x1b[0m\n');
  return 0;
}

async function cmdExec(ctx: CmdContext, args: string[], m: SimMachineApi, st: DockerSnapshot): Promise<number> {
  const p = parseFlags(args, { interactive: { short: 'i' }, tty: { short: 't' }, detach: { short: 'd' }, user: { short: 'u', value: true }, workdir: { short: 'w', value: true }, env: { short: 'e', value: true, multi: true }, privileged: {}, help: {} }, false);
  if (p.error) return fail(ctx, p.error, 'exec');
  if (on(p, 'help')) return printHelp(ctx, 'exec');
  const [name, ...cmd] = p.args;
  if (!name || !cmd.length) return fail(ctx, `'docker exec' requires at least 2 arguments`, 'exec', 1);
  const c = findContainer(st, name);
  if (!c) {
    ctx.err(`Error response from daemon: No such container: ${name}\n`);
    return 1;
  }
  if (c.status !== 'running') {
    ctx.err(`Error response from daemon: container ${c.id} is not running\n`);
    return 1;
  }
  const env = Object.fromEntries((p.multi.env ?? []).map((e) => [e.split('=')[0], e.slice(e.indexOf('=') + 1)]));
  if (on(p, 'tty') && !on(p, 'interactive')) {
    /* -t without -i: still runs, output goes to the terminal */
  }
  return execIn(m, st, c, cmd, { interactive: on(p, 'interactive'), tty: on(p, 'tty'), user: str(p, 'user'), workdir: str(p, 'workdir'), env }, io(ctx));
}

async function cmdStop(ctx: CmdContext, args: string[], m: SimMachineApi, st: DockerSnapshot, restart = false): Promise<number> {
  const p = parseFlags(args, { time: { short: 't', value: true }, timeout: { value: true }, signal: { short: 's', value: true }, help: {} });
  if (p.error) return fail(ctx, p.error, restart ? 'restart' : 'stop');
  if (!p.args.length) return fail(ctx, `"docker ${restart ? 'restart' : 'stop'}" requires at least 1 argument.`, restart ? 'restart' : 'stop', 1);
  const ds = dockerOf(m);
  let code = 0;
  for (const n of p.args) {
    const c = findContainer(st, n);
    if (!c) {
      ctx.err(`Error response from daemon: No such container: ${n}\n`);
      code = 1;
      continue;
    }
    const t = str(p, 'time') ?? str(p, 'timeout');
    await stopContainer(m, ds, c, { timeout: t !== undefined ? Number(t) : undefined, signal: str(p, 'signal') });
    if (restart && st.containers.includes(c)) {
      const r = await startContainer(m, st, c);
      if (!r.ok) {
        ctx.err(`Error response from daemon: ${r.error}\n`);
        code = 1;
        continue;
      }
      c.restartCount = 0;
    }
    ctx.out(`${n}\n`);
  }
  return code;
}

async function cmdStart(ctx: CmdContext, args: string[], m: SimMachineApi, st: DockerSnapshot): Promise<number> {
  const p = parseFlags(args, { attach: { short: 'a' }, interactive: { short: 'i' }, help: {} });
  if (p.error) return fail(ctx, p.error, 'start');
  let code = 0;
  for (const n of p.args) {
    const c = findContainer(st, n);
    if (!c) {
      ctx.err(`Error response from daemon: No such container: ${n}\n`);
      code = 1;
      continue;
    }
    const r = await startContainer(m, st, c);
    if (!r.ok) {
      ctx.err(`Error response from daemon: ${r.error}\nError: failed to start containers: ${n}\n`);
      code = 1;
      continue;
    }
    if (on(p, 'attach') || on(p, 'interactive')) {
      if (r.output) ctx.out(r.output);
      if (c.status === 'exited') code = c.exitCode ?? 0;
    } else ctx.out(`${n}\n`);
  }
  return code;
}

const cmdKill: Sub = (ctx, args, m, st) => {
  const p = parseFlags(args, { signal: { short: 's', value: true }, help: {} });
  if (p.error) return fail(ctx, p.error, 'kill');
  let code = 0;
  for (const n of p.args) {
    const c = findContainer(st, n);
    if (!c) {
      ctx.err(`Error response from daemon: No such container: ${n}\n`);
      code = 1;
    } else if (!killContainer(m, st, c, str(p, 'signal') ?? 'KILL')) {
      ctx.err(`Error response from daemon: cannot kill container: ${n}: container ${c.id} is not running\n`);
      code = 1;
    } else ctx.out(`${n}\n`);
  }
  return code;
};

const cmdRm: Sub = (ctx, args, m, st) => {
  const p = parseFlags(args, { force: { short: 'f' }, volumes: { short: 'v' }, link: { short: 'l' }, help: {} });
  if (p.error) return fail(ctx, p.error, 'rm');
  if (!p.args.length) return fail(ctx, `"docker rm" requires at least 1 argument.`, 'rm', 1);
  let code = 0;
  for (const n of p.args) {
    const c = findContainer(st, n);
    if (!c) {
      ctx.err(`Error response from daemon: No such container: ${n}\n`);
      code = 1;
      continue;
    }
    if ((c.status === 'running' || c.status === 'restarting' || c.status === 'paused') && !on(p, 'force')) {
      ctx.err(`Error response from daemon: cannot remove container "/${c.name}": container is ${c.status}: stop the container before removing or force remove\n`);
      code = 1;
      continue;
    }
    if (c.status === 'running') killContainer(m, st, c, 'KILL');
    removeContainer(m, st, c, { volumes: on(p, 'volumes') });
    ctx.out(`${n}\n`);
  }
  return code;
};

function imageRows(st: DockerSnapshot, m: SimMachineApi, all: boolean) {
  const now = clock(m);
  const rows: Record<string, unknown>[] = [];
  for (const img of [...st.images].sort((a, b) => b.created - a.created)) {
    const tags = img.repoTags.length ? img.repoTags : ['<none>:<none>'];
    for (const t of tags) {
      const i = t.lastIndexOf(':');
      rows.push({ Repository: t.slice(0, i), Tag: t.slice(i + 1), ID: shortId(img.id), CreatedSince: ago(now - img.created), CreatedAt: new Date(img.created).toISOString(), Size: dockerSize(imageSize(st, img)), Digest: img.repoDigests[0]?.split('@')[1] ?? '<none>' });
    }
  }
  void all;
  return rows;
}

const cmdImages: Sub = (ctx, args, m, st) => {
  const p = parseFlags(args, { all: { short: 'a' }, quiet: { short: 'q' }, digests: {}, filter: { short: 'f', value: true, multi: true }, format: { value: true }, 'no-trunc': {}, help: {} });
  if (p.error) return fail(ctx, p.error, 'images');
  let rows = imageRows(st, m, on(p, 'all'));
  if (p.args[0]) rows = rows.filter((r) => r.Repository === p.args[0].split(':')[0] && (!p.args[0].includes(':') || r.Tag === p.args[0].split(':')[1]));
  for (const f of p.multi.filter ?? []) {
    if (f === 'dangling=true') rows = rows.filter((r) => r.Repository === '<none>');
    if (f === 'dangling=false') rows = rows.filter((r) => r.Repository !== '<none>');
    if (f.startsWith('reference=')) {
      const re = new RegExp('^' + f.slice(10).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^:]*') + '$');
      rows = rows.filter((r) => re.test(`${r.Repository}:${r.Tag}`) || re.test(String(r.Repository)));
    }
  }
  if (on(p, 'quiet')) {
    for (const id of [...new Set(rows.map((r) => r.ID))]) ctx.out(`${id}\n`);
    return 0;
  }
  const cols = on(p, 'digests') ? ['Repository', 'Tag', 'Digest', 'ID', 'CreatedSince', 'Size'] : ['Repository', 'Tag', 'ID', 'CreatedSince', 'Size'];
  const header = cols.map((c) => (c === 'ID' ? 'IMAGE ID' : PS_HEADERS[c]));
  return printRows(ctx, rows, str(p, 'format'), { cols, header });
};

async function cmdPull(ctx: CmdContext, args: string[], m: SimMachineApi, st: DockerSnapshot): Promise<number> {
  const p = parseFlags(args, { platform: { value: true }, quiet: { short: 'q' }, 'all-tags': { short: 'a' }, help: {} });
  if (p.error) return fail(ctx, p.error, 'pull');
  if (!p.args[0]) return fail(ctx, `"docker pull" requires exactly 1 argument.`, 'pull', 1);
  const img = await pull(m, st, p.args[0], io(ctx), { platform: str(p, 'platform'), quiet: on(p, 'quiet') });
  if (img && on(p, 'quiet')) ctx.out(`${p.args[0]}\n`);
  return img ? 0 : 1;
}

async function cmdBuild(ctx: CmdContext, args: string[], m: SimMachineApi, st: DockerSnapshot): Promise<number> {
  const p = parseFlags(args, { tag: { short: 't', value: true, multi: true }, file: { short: 'f', value: true }, target: { value: true }, 'no-cache': {}, 'build-arg': { value: true, multi: true }, pull: {}, progress: { value: true }, quiet: { short: 'q' }, platform: { value: true }, secret: { value: true, multi: true }, load: {}, label: { value: true, multi: true }, help: {} });
  if (p.error) return fail(ctx, p.error, 'build');
  if (!p.args[0]) {
    ctx.err(`ERROR: docker: 'docker buildx build' requires 1 argument\n\nUsage:  docker buildx build [OPTIONS] PATH | URL | -\n\nRun 'docker buildx build --help' for more information\n`);
    return 1;
  }
  if (p.multi.secret) ctx.err(SIM_ONLY_NOTE('secret'));
  const buildArgs = Object.fromEntries((p.multi['build-arg'] ?? []).map((a) => [a.split('=')[0], a.slice(a.indexOf('=') + 1)]));
  const img = await build(m, st, { context: p.args[0], file: str(p, 'file'), tags: p.multi.tag ?? [], target: str(p, 'target'), noCache: on(p, 'no-cache'), buildArgs, quiet: on(p, 'quiet') }, io(ctx));
  return img ? 0 : 1;
}

const cmdHistory: Sub = (ctx, args, m, st) => {
  const p = parseFlags(args, { 'no-trunc': {}, quiet: { short: 'q' }, human: { short: 'H', value: true }, format: { value: true }, help: {} });
  if (p.error) return fail(ctx, p.error, 'history');
  const img = findImage(st, p.args[0] ?? '');
  if (!img) {
    ctx.err(`Error response from daemon: No such image: ${p.args[0] ?? ''}\n`);
    return 1;
  }
  const now = clock(m);
  const layers = [...img.layers];
  const hist = img.config.history.map((h) => ({ h, size: h.empty_layer ? 0 : (st.layers[layers.shift() ?? '']?.size ?? 0) }));
  const rows = hist.reverse().map((x, i) => {
    let by = x.h.created_by;
    if (!on(p, 'no-trunc') && [...by].length > 45) by = [...by].slice(0, 44).join('') + '…';
    return { ID: i === 0 ? shortId(img.id) : '<missing>', CreatedSince: ago(now - Date.parse(x.h.created)), CreatedBy: by, Size: dockerSize(x.size), Comment: x.h.comment ?? '' };
  });
  return printRows(ctx, rows, str(p, 'format'), { cols: ['ID', 'CreatedSince', 'CreatedBy', 'Size', 'Comment'], header: ['IMAGE', 'CREATED', 'CREATED BY', 'SIZE', 'COMMENT'] });
};

function inspectAny(ctx: CmdContext, args: string[], m: SimMachineApi, st: DockerSnapshot, kind?: 'container' | 'image' | 'network' | 'volume'): number {
  const p = parseFlags(args, { format: { short: 'f', value: true }, size: { short: 's' }, type: { value: true }, help: {} });
  if (p.error) return fail(ctx, p.error, 'inspect');
  const type = kind ?? (str(p, 'type') as typeof kind);
  const docs: Record<string, unknown>[] = [];
  let code = 0;
  for (const n of p.args) {
    let d: Record<string, unknown> | undefined;
    if (!type || type === 'container') {
      const c = findContainer(st, n);
      if (c) d = containerDoc(st, c, m);
    }
    if (!d && (!type || type === 'image')) {
      const img = findImage(st, n);
      if (img) d = imageDoc(st, img);
    }
    if (!d && (!type || type === 'network')) {
      const net = st.networks.find((x) => x.name === n || x.id.startsWith(n));
      if (net) d = networkDoc(st, net);
    }
    if (!d && (!type || type === 'volume')) {
      const v = st.volumes.find((x) => x.name === n);
      if (v) d = volumeDoc(v);
    }
    if (d) docs.push(d);
    else {
      ctx.err(`Error: No such ${type ? type : 'object'}: ${n}\n`);
      code = 1;
    }
  }
  const fmt = str(p, 'format');
  if (fmt) {
    try {
      for (const d of docs) ctx.out(render(fmt, d) + '\n');
    } catch (e) {
      if (e instanceof TemplateError) {
        ctx.err(`${e.message}\n`);
        return 1;
      }
      throw e;
    }
  } else if (docs.length || !code) ctx.out(JSON.stringify(docs, null, 4) + '\n');
  return code;
}

const cmdNetwork: Sub = async (ctx, args, m, st) => {
  const [sub, ...rest] = args;
  switch (sub) {
    case 'ls':
    case 'list': {
      const p = parseFlags(rest, { quiet: { short: 'q' }, filter: { short: 'f', value: true, multi: true }, format: { value: true }, 'no-trunc': {}, help: {} });
      if (on(p, 'help')) return printHelp(ctx, 'network ls');
      const rows = [...st.networks].sort((a, b) => a.name.localeCompare(b.name)).map((n) => ({ ID: n.id.slice(0, 12), Name: n.name, Driver: n.driver, Scope: 'local' }));
      if (on(p, 'quiet')) {
        for (const r of rows) ctx.out(`${r.ID}\n`);
        return 0;
      }
      return printRows(ctx, rows, str(p, 'format'), { cols: ['ID', 'Name', 'Driver', 'Scope'], header: ['NETWORK ID', 'NAME', 'DRIVER', 'SCOPE'] });
    }
    case 'create': {
      const p = parseFlags(rest, { driver: { short: 'd', value: true }, subnet: { value: true }, gateway: { value: true }, internal: {}, label: { value: true, multi: true }, attachable: {}, help: {} });
      if (p.error) return fail(ctx, p.error, 'network create');
      if (on(p, 'help')) return printHelp(ctx, 'network create');
      if (!p.args[0]) return fail(ctx, '"docker network create" requires exactly 1 argument.', 'network create', 1);
      if (str(p, 'driver') && str(p, 'driver') !== 'bridge') ctx.err(`dsim: only the bridge driver is simulated; created a bridge network\n`);
      try {
        const n = await createNetwork(m, st, p.args[0], { subnet: str(p, 'subnet'), internal: on(p, 'internal') });
        ctx.out(`${n.id}\n`);
        return 0;
      } catch (e) {
        if (e instanceof DockerError) {
          ctx.err(`Error response from daemon: ${e.message}\n`);
          return 1;
        }
        throw e;
      }
    }
    case 'rm':
    case 'remove': {
      let code = 0;
      for (const n of rest) {
        const net = st.networks.find((x) => x.name === n || x.id.startsWith(n));
        if (!net) {
          ctx.err(`Error response from daemon: network ${n} not found\n`);
          code = 1;
        } else if (net.builtin) {
          ctx.err(`Error response from daemon: ${n} is a pre-defined network and cannot be removed\n`);
          code = 1;
        } else if (st.containers.some((c) => c.networks[net.name] && c.status === 'running')) {
          ctx.err(`Error response from daemon: error while removing network: network ${n} id ${net.id} has active endpoints\n`);
          code = 1;
        } else {
          st.networks = st.networks.filter((x) => x !== net);
          ctx.out(`${n}\n`);
        }
      }
      return code;
    }
    case 'inspect':
      return inspectAny(ctx, rest, m, st, 'network');
    case 'connect': {
      const p = parseFlags(rest, { alias: { value: true, multi: true }, ip: { value: true }, help: {} });
      if (on(p, 'help')) return printHelp(ctx, 'network connect');
      const [netName, cname] = p.args;
      const net = st.networks.find((x) => x.name === netName || x.id.startsWith(netName ?? '-'));
      const c = findContainer(st, cname ?? '');
      if (!net || !c) {
        ctx.err(`Error response from daemon: ${!net ? `network ${netName} not found` : `No such container: ${cname}`}\n`);
        return 1;
      }
      try {
        connectNetwork(st, c, net, p.multi.alias ?? []);
      } catch (e) {
        ctx.err(`Error response from daemon: ${(e as Error).message}\n`);
        return 1;
      }
      return 0;
    }
    case 'disconnect': {
      const [netName, cname] = rest.filter((a) => !a.startsWith('-'));
      const c = findContainer(st, cname ?? '');
      if (!c || !c.networks[netName]) {
        ctx.err(`Error response from daemon: container ${cname} is not connected to network ${netName}\n`);
        return 1;
      }
      delete c.networks[netName];
      return 0;
    }
    case 'prune': {
      const unused = st.networks.filter((n) => !n.builtin && !st.containers.some((c) => c.networks[n.name]));
      st.networks = st.networks.filter((n) => !unused.includes(n));
      ctx.out(unused.length ? `Deleted Networks:\n${unused.map((n) => n.name).join('\n')}\n` : '');
      return 0;
    }
    default:
      return printHelp(ctx, 'network');
  }
};

const cmdVolume: Sub = (ctx, args, m, st) => {
  const [sub, ...rest] = args;
  switch (sub) {
    case 'ls':
    case 'list': {
      const p = parseFlags(rest, { quiet: { short: 'q' }, filter: { short: 'f', value: true, multi: true }, format: { value: true }, help: {} });
      if (on(p, 'help')) return printHelp(ctx, 'volume ls');
      let list = st.volumes;
      if ((p.multi.filter ?? []).includes('dangling=true')) list = list.filter((v) => !st.containers.some((c) => c.mounts.some((x) => x.type === 'volume' && x.source === v.name)));
      if (on(p, 'quiet')) {
        for (const v of list) ctx.out(`${v.name}\n`);
        return 0;
      }
      return printRows(ctx, list.map((v) => ({ Driver: 'local', Name: v.name })), str(p, 'format'), { cols: ['Driver', 'Name'], header: ['DRIVER', 'VOLUME NAME'] });
    }
    case 'create': {
      const p = parseFlags(rest, { driver: { short: 'd', value: true }, label: { value: true, multi: true }, opt: { short: 'o', value: true, multi: true }, help: {} });
      if (on(p, 'help')) return printHelp(ctx, 'volume create');
      const name = p.args[0] ?? shortId(String(Math.random()).replace('.', '').padEnd(64, '0'));
      if (!st.volumes.some((v) => v.name === name)) st.volumes.push({ name, created: clock(m), files: {}, labels: Object.fromEntries((p.multi.label ?? []).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1)])), populated: false });
      ctx.out(`${name}\n`);
      return 0;
    }
    case 'rm':
    case 'remove': {
      let code = 0;
      for (const n of rest.filter((a) => !a.startsWith('-'))) {
        const v = st.volumes.find((x) => x.name === n);
        const user = st.containers.find((c) => c.mounts.some((x) => x.type === 'volume' && x.source === n));
        if (!v) {
          ctx.err(`Error response from daemon: get ${n}: no such volume\n`);
          code = 1;
        } else if (user) {
          ctx.err(`Error response from daemon: remove ${n}: volume is in use - [${user.id}]\n`);
          code = 1;
        } else {
          st.volumes = st.volumes.filter((x) => x !== v);
          ctx.out(`${n}\n`);
        }
      }
      return code;
    }
    case 'inspect':
      return inspectAny(ctx, rest, m, st, 'volume');
    case 'prune': {
      const all = rest.includes('-a') || rest.includes('--all');
      const unused = st.volumes.filter((v) => !st.containers.some((c) => c.mounts.some((x) => x.type === 'volume' && x.source === v.name)) && (all || /^[0-9a-f]{64}$/.test(v.name)));
      const bytes = unused.reduce((n, v) => n + volumeSize(st, v.name), 0);
      st.volumes = st.volumes.filter((v) => !unused.includes(v));
      ctx.out(`${unused.length ? `Deleted Volumes:\n${unused.map((v) => v.name).join('\n')}\n\n` : ''}Total reclaimed space: ${dockerSize(bytes)}\n`);
      return 0;
    }
    default:
      return printHelp(ctx, 'volume');
  }
};

async function cmdCompose(ctx: CmdContext, args: string[], m: SimMachineApi): Promise<number> {
  const g = parseFlags(args, { file: { short: 'f', value: true }, 'project-name': { short: 'p', value: true }, profile: { value: true, multi: true }, 'env-file': { value: true }, help: {} }, false);
  if (g.error) return fail(ctx, g.error, 'compose');
  const [sub, ...rest] = g.args;
  if (!sub || on(g, 'help')) return printHelp(ctx, 'compose');
  if (rest.includes('--help')) return printHelp(ctx, `compose ${sub}`);
  const proj = loadProject(m, ctx.cwd, { file: str(g, 'file'), project: str(g, 'project-name'), profiles: g.multi.profile ?? [] });
  if ('error' in proj) {
    ctx.err(`${proj.error}\n`);
    return 1;
  }
  const st = dockerOf(m).s;
  switch (sub) {
    case 'up': {
      const p = parseFlags(rest, { detach: { short: 'd' }, build: {}, 'force-recreate': {}, wait: {}, 'no-deps': {}, 'remove-orphans': {}, timeout: { short: 't', value: true } });
      if (p.error) return fail(ctx, p.error, 'compose up');
      return composeUp(m, proj, { detach: on(p, 'detach'), build: on(p, 'build'), forceRecreate: on(p, 'force-recreate'), wait: on(p, 'wait'), services: p.args }, io(ctx));
    }
    case 'down': {
      const p = parseFlags(rest, { volumes: { short: 'v' }, 'remove-orphans': {}, rmi: { value: true }, timeout: { short: 't', value: true } });
      if (p.error) return fail(ctx, p.error, 'compose down');
      return composeDown(m, proj, { volumes: on(p, 'volumes') }, io(ctx));
    }
    case 'ps': {
      const p = parseFlags(rest, { all: { short: 'a' }, quiet: { short: 'q' }, services: {}, format: { value: true } });
      const now = clock(m);
      let list = composeContainers(m, proj.name);
      if (!on(p, 'all')) list = list.filter((c) => c.status === 'running' || c.status === 'restarting');
      if (on(p, 'services')) {
        for (const c of list) ctx.out(`${c.compose!.service}\n`);
        return 0;
      }
      if (on(p, 'quiet')) {
        for (const c of list) ctx.out(`${c.id}\n`);
        return 0;
      }
      const rows = list.map((c) => ({ ...psRow(c, now), Service: c.compose!.service, Name: c.name }));
      return printRows(ctx, rows, str(p, 'format'), { cols: ['Name', 'Image', 'Command', 'Service', 'RunningFor', 'Status', 'Ports'], header: ['NAME', 'IMAGE', 'COMMAND', 'SERVICE', 'CREATED', 'STATUS', 'PORTS'] });
    }
    case 'logs': {
      const p = parseFlags(rest, { follow: { short: 'f' }, tail: { short: 'n', value: true }, timestamps: { short: 't' }, 'no-color': {} });
      const list = composeContainers(m, proj.name).filter((c) => !p.args.length || p.args.includes(c.compose!.service));
      const width = Math.max(0, ...list.map((c) => c.name.length));
      for (const c of list) for (const l of c.logs.slice(str(p, 'tail') ? -Number(str(p, 'tail')) : 0)) ctx.out(`${c.name.padEnd(width)}  | ${l.line}\n`);
      return 0;
    }
    case 'config':
      ctx.out(composeConfig(proj));
      return 0;
    case 'exec': {
      const p = parseFlags(rest, { user: { short: 'u', value: true }, workdir: { short: 'w', value: true }, env: { short: 'e', value: true, multi: true }, 'no-TTY': { short: 'T' }, detach: { short: 'd' } }, false);
      const [svc, ...cmd] = p.args;
      const c = composeContainers(m, proj.name).find((x) => x.compose!.service === svc);
      if (!c || c.status !== 'running') {
        ctx.err(`service "${svc}" is not running\n`);
        return 1;
      }
      return execIn(m, st, c, cmd, { interactive: true, tty: !on(p, 'no-TTY'), user: str(p, 'user'), workdir: str(p, 'workdir') }, io(ctx));
    }
    case 'stop':
    case 'restart':
    case 'start': {
      const ds = dockerOf(m);
      for (const c of composeContainers(m, proj.name)) {
        if (sub !== 'start') await stopContainer(m, ds, c);
        if (sub !== 'stop') await startContainer(m, st, c);
        ctx.out(` ✔ Container ${c.name}  ${sub === 'stop' ? 'Stopped' : 'Started'}\n`);
      }
      return 0;
    }
    default:
      ctx.err(`unknown docker command: "compose ${sub}"\n`);
      return 1;
  }
}

function printHelp(ctx: CmdContext, path: string): number {
  const t = helpText(path) ?? helpText(path.split(' ')[0]);
  if (!t) {
    ctx.err(`dsim: no help page for "docker ${path}"\n`);
    return 1;
  }
  ctx.out(t.endsWith('\n') ? t : t + '\n');
  return 0;
}

const cmdSystem: Sub = (ctx, args, m, st) => {
  const [sub, ...rest] = args;
  if (sub === 'df') {
    const verbose = rest.includes('-v') || rest.includes('--verbose');
    const used = new Set(st.containers.map((c) => c.imageId));
    const imgBytes = st.images.reduce((n, i) => n + imageSize(st, i), 0);
    const reclaimImg = st.images.filter((i) => !used.has(i.id)).reduce((n, i) => n + imageSize(st, i), 0);
    const cBytes = st.containers.reduce((n, c) => n + upperSize(c), 0);
    const vBytes = st.volumes.reduce((n, v) => n + volumeSize(st, v.name), 0);
    const cache = Object.values(st.buildCache).filter((x) => x.diffId).length;
    const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '0B');
    ctx.out(
      table(
        ['TYPE', 'TOTAL', 'ACTIVE', 'SIZE', 'RECLAIMABLE'],
        [
          ['Images', String(st.images.length), String(used.size), dockerSize(imgBytes), `${dockerSize(reclaimImg)} (${pct(reclaimImg, imgBytes)})`],
          ['Containers', String(st.containers.length), String(st.containers.filter((c) => c.status === 'running').length), dockerSize(cBytes), dockerSize(st.containers.filter((c) => c.status !== 'running').reduce((n, c) => n + upperSize(c), 0))],
          ['Local Volumes', String(st.volumes.length), String(st.volumes.filter((v) => st.containers.some((c) => c.mounts.some((x) => x.source === v.name))).length), dockerSize(vBytes), dockerSize(0)],
          ['Build Cache', String(cache), '0', dockerSize(cache * 1000), dockerSize(cache * 1000)],
        ],
      ),
    );
    if (verbose) {
      ctx.out('\nLocal Volumes space usage:\n\n');
      ctx.out(table(['VOLUME NAME', 'LINKS', 'SIZE'], st.volumes.map((v) => [v.name, String(st.containers.filter((c) => c.mounts.some((x) => x.source === v.name)).length), dockerSize(volumeSize(st, v.name))])));
    }
    return 0;
  }
  if (sub === 'prune') {
    const stopped = st.containers.filter((c) => c.status === 'exited' || c.status === 'created');
    for (const c of stopped) removeContainer(m, st, c);
    const dangling = st.images.filter((i) => !i.repoTags.length && !st.containers.some((c) => c.imageId === i.id));
    st.images = st.images.filter((i) => !dangling.includes(i));
    st.buildCache = {};
    ctx.out(`Deleted Containers:\n${stopped.map((c) => c.id).join('\n')}\n\nDeleted Images:\n${dangling.map((i) => `deleted: ${i.id}`).join('\n')}\n\nTotal reclaimed space: ${dockerSize(dangling.reduce((n, i) => n + imageSize(st, i), 0))}\n`);
    return 0;
  }
  ctx.err(`docker: 'system ${sub ?? ''}' is not a docker command.\n`);
  return 1;
};

async function cmdImageSub(ctx: CmdContext, args: string[], m: SimMachineApi, st: DockerSnapshot): Promise<number> {
  const [sub, ...rest] = args;
  switch (sub) {
    case 'ls':
    case 'list':
      return cmdImages(ctx, rest, m, st);
    case 'pull':
      return cmdPull(ctx, rest, m, st);
    case 'push':
      return push(st, rest[0] ?? '', io(ctx)).then((ok) => (ok ? 0 : 1));
    case 'inspect':
      return inspectAny(ctx, rest, m, st, 'image');
    case 'history':
      return cmdHistory(ctx, rest, m, st);
    case 'rm':
    case 'remove':
      return cmdRmi(ctx, rest, m, st);
    case 'tag':
      return cmdTag(ctx, rest, m, st);
    case 'build':
      return cmdBuild(ctx, rest, m, st);
    case 'prune': {
      const all = rest.includes('-a') || rest.includes('--all');
      const gone = st.images.filter((i) => (all || !i.repoTags.length) && !st.containers.some((c) => c.imageId === i.id));
      st.images = st.images.filter((i) => !gone.includes(i));
      ctx.out(`${gone.length ? `Deleted Images:\n${gone.map((i) => `deleted: ${i.id}`).join('\n')}\n\n` : ''}Total reclaimed space: ${dockerSize(gone.reduce((n, i) => n + imageSize(st, i), 0))}\n`);
      return 0;
    }
    default:
      ctx.err(`docker: 'image ${sub ?? ''}' is not a docker command.\n`);
      return 1;
  }
}

const cmdRmi: Sub = (ctx, args, _m, st) => {
  const force = args.includes('-f') || args.includes('--force');
  let code = 0;
  for (const n of args.filter((a) => !a.startsWith('-'))) {
    const img = findImage(st, n);
    if (!img) {
      ctx.err(`Error response from daemon: No such image: ${n}\n`);
      code = 1;
      continue;
    }
    const user = st.containers.find((c) => c.imageId === img.id);
    const tag = img.repoTags.find((t) => t === n || t === `${n}:latest`);
    if (tag && img.repoTags.length > 1) {
      img.repoTags = img.repoTags.filter((t) => t !== tag);
      ctx.out(`Untagged: ${tag}\n`);
      continue;
    }
    if (user && !force) {
      ctx.err(`Error response from daemon: conflict: unable to remove repository reference "${n}" (must force) - container ${user.id.slice(0, 12)} is using its referenced image ${shortId(img.id)}\n`);
      code = 1;
      continue;
    }
    for (const t of img.repoTags) ctx.out(`Untagged: ${t}\n`);
    st.images = st.images.filter((i) => i !== img);
    ctx.out(`Deleted: ${img.id}\n`);
  }
  return code;
};

const cmdTag: Sub = (ctx, args, _m, st) => {
  const [src, dst] = args;
  const img = findImage(st, src ?? '');
  if (!img || !dst) {
    ctx.err(`Error response from daemon: No such image: ${src ?? ''}\n`);
    return 1;
  }
  const r = parseRef(dst);
  if (!r) {
    ctx.err(`Error parsing reference: "${dst}" is not a valid repository/tag: invalid reference format\n`);
    return 1;
  }
  const tag = familiar(r);
  for (const i of st.images) i.repoTags = i.repoTags.filter((t) => t !== tag);
  img.repoTags.push(tag);
  return 0;
};

const cmdPort: Sub = (ctx, args, _m, st) => {
  const c = findContainer(st, args[0] ?? '');
  if (!c) {
    ctx.err(`Error response from daemon: No such container: ${args[0] ?? ''}\n`);
    return 1;
  }
  for (const b of c.hostConfig.portBindings) {
    if (args[1] && !`${b.containerPort}/${b.proto}`.startsWith(args[1])) continue;
    ctx.out(`${b.containerPort}/${b.proto} -> ${b.hostIp || '0.0.0.0'}:${b.hostPort}\n`);
    if (!b.hostIp || b.hostIp === '0.0.0.0') ctx.out(`${b.containerPort}/${b.proto} -> [::]:${b.hostPort}\n`);
  }
  return 0;
};

const cmdDiff: Sub = (ctx, args, _m, st) => {
  const c = findContainer(st, args[0] ?? '');
  if (!c) {
    ctx.err(`Error response from daemon: No such container: ${args[0] ?? ''}\n`);
    return 1;
  }
  for (const l of dockerDiff(st, c)) ctx.out(`${l}\n`);
  return 0;
};

const cmdTop: Sub = (ctx, args, _m, st) => {
  const c = findContainer(st, args[0] ?? '');
  if (!c || c.status !== 'running') {
    ctx.err(`Error response from daemon: ${c ? `container ${c.id} is not running` : `No such container: ${args[0] ?? ''}`}\n`);
    return 1;
  }
  ctx.out(table(['UID', 'PID', 'PPID', 'C', 'STIME', 'TTY', 'TIME', 'CMD'], c.procs.map((p) => ['root', String(p.hostPid), String(p.ppid ? c.procs.find((x) => x.nspid === p.ppid)?.hostPid ?? 0 : 0), '0', '09:00', '?', '00:00:00', p.argv.join(' ')])));
  return 0;
};

const cmdUpdate: Sub = (ctx, args, _m, st) => {
  const p = parseFlags(args, { memory: { short: 'm', value: true }, cpus: { value: true }, 'pids-limit': { value: true }, restart: { value: true }, 'memory-swap': { value: true }, help: {} });
  if (p.error) return fail(ctx, p.error, 'update');
  let code = 0;
  for (const n of p.args) {
    const c = findContainer(st, n);
    if (!c) {
      ctx.err(`Error response from daemon: No such container: ${n}\n`);
      code = 1;
      continue;
    }
    if (str(p, 'memory')) c.hostConfig.memory = parseBytes(str(p, 'memory')!);
    if (str(p, 'cpus')) c.hostConfig.cpus = Number(str(p, 'cpus'));
    if (str(p, 'pids-limit')) c.hostConfig.pidsLimit = Number(str(p, 'pids-limit'));
    if (str(p, 'restart')) {
      const [name, cnt] = str(p, 'restart')!.split(':');
      c.hostConfig.restartPolicy = { name: name as ContainerRec['hostConfig']['restartPolicy']['name'], maximumRetryCount: Number(cnt ?? 0) };
    }
    ctx.out(`${n}\n`);
  }
  return code;
};

const cmdEvents: Sub = (ctx, args, m, st) => {
  const p = parseFlags(args, { since: { value: true }, until: { value: true }, filter: { short: 'f', value: true, multi: true }, format: { value: true } });
  if (!str(p, 'since') && !str(p, 'until')) {
    ctx.err('\x1b[2mdsim: `docker events` streams until Ctrl+C on a real engine; here it prints what happened in this session (add --since 1h to filter).\x1b[0m\n');
  }
  const now = clock(m);
  const since = str(p, 'since');
  const rel = since ? /^(\d+)(s|m|h)$/.exec(since) : null;
  const t0 = rel ? now - Number(rel[1]) * { s: 1000, m: 60000, h: 3600000 }[rel[2] as 's' | 'm' | 'h'] : 0;
  for (const e of st.events) {
    if (e.t < t0) continue;
    if ((p.multi.filter ?? []).some((f) => (f.startsWith('event=') && f.slice(6) !== e.action) || (f.startsWith('type=') && f.slice(5) !== e.type) || (f.startsWith('container=') && f.slice(10) !== e.name))) continue;
    ctx.out(`${new Date(e.t).toISOString().replace('Z', '000000Z').replace(/\.(\d{3})0+Z$/, '.$1000000+00:00')} ${e.type} ${e.action} ${e.id}${e.name ? ` (name=${e.name}${e.attrs ? Object.entries(e.attrs).map(([k, v]) => `, ${k}=${v}`).join('') : ''})` : ''}\n`);
  }
  return 0;
};

const cmdVersion: Sub = (ctx) => {
  ctx.out(`Client:
 Version:           ${ENGINE_VERSION}
 API version:       1.52
 Go version:        go1.25.4
 OS/Arch:           linux/amd64
 Context:           default

Server: Docker Engine - Community (dsim, the DevOps Trainer simulator)
 Engine:
  Version:          ${ENGINE_VERSION}
  API version:      1.52 (minimum version 1.44)
  OS/Arch:          linux/amd64
 containerd:
  Version:          v2.1.5
 runc:
  Version:          1.3.3
 docker-init:
  Version:          0.19.0
`);
  return 0;
};

const cmdInfo: Sub = (ctx, _a, _m, st) => {
  ctx.out(`Client:
 Version:    ${ENGINE_VERSION}
 Context:    default

Server:
 Containers: ${st.containers.length}
  Running: ${st.containers.filter((c) => c.status === 'running').length}
  Paused: 0
  Stopped: ${st.containers.filter((c) => c.status !== 'running').length}
 Images: ${st.images.length}
 Server Version: ${ENGINE_VERSION}
 Storage Driver: overlayfs
  driver-type: io.containerd.snapshotter.v1
 Logging Driver: json-file
 Cgroup Driver: systemd
 Cgroup Version: 2
 Plugins:
  Volume: local
  Network: bridge host ipvlan macvlan null overlay
 Runtimes: io.containerd.runc.v2 runc
 Default Runtime: runc
 Init Binary: docker-init
 Security Options:
  seccomp
   Profile: builtin
  cgroupns
 Kernel Version: 6.12.0-dt-sim
 Operating System: Debian GNU/Linux 13 (trixie)
 Architecture: x86_64
 Docker Root Dir: /var/lib/docker
 Insecure Registries:
  registry.lab
  ::1/128
  127.0.0.0/8
 Live Restore Enabled: false
 Firewall Backend: iptables
`);
  return 0;
};

async function cmdManifest(ctx: CmdContext, args: string[], _m: SimMachineApi, st: DockerSnapshot): Promise<number> {
  const ref = args.filter((a) => !a.startsWith('-') && a !== 'inspect' && a !== 'imagetools')[0];
  const r = ref ? parseRef(ref) : null;
  const raw = r ? await rawManifest(st, r) : null;
  if (!raw) {
    ctx.err(`no such manifest: ${ref ?? ''}\n`);
    return 1;
  }
  ctx.out(raw + '\n');
  return 0;
}

const cmdRename: Sub = (ctx, args, _m, st) => {
  const c = findContainer(st, args[0] ?? '');
  if (!c || !args[1]) {
    ctx.err(`Error response from daemon: No such container: ${args[0] ?? ''}\n`);
    return 1;
  }
  c.name = args[1];
  return 0;
};

const cmdWait: Sub = (ctx, args, _m, st) => {
  let code = 0;
  for (const n of args) {
    const c = findContainer(st, n);
    if (!c) {
      ctx.err(`Error response from daemon: No such container: ${n}\n`);
      code = 1;
    } else if (c.status === 'running') {
      ctx.err(`dsim: ${n} is still running; \`docker wait\` would block until it exits\n`);
      code = 1;
    } else ctx.out(`${c.exitCode ?? 0}\n`);
  }
  return code;
};

const cmdStats: Sub = (ctx, _a, _m, st) => {
  ctx.out(
    table(
      ['CONTAINER ID', 'NAME', 'CPU %', 'MEM USAGE / LIMIT', 'MEM %', 'NET I/O', 'BLOCK I/O', 'PIDS'],
      st.containers
        .filter((c) => c.status === 'running')
        .map((c) => {
          const used = (c.program?.memoryMb ?? 1) * 1024 * 1024;
          const limit = c.hostConfig.memory || 2 * 1024 ** 3;
          return [c.id.slice(0, 12), c.name, '0.01%', `${(used / 1024 / 1024).toFixed(2)}MiB / ${(limit / 1024 / 1024 / (limit >= 1024 ** 3 ? 1024 : 1)).toFixed(limit >= 1024 ** 3 ? 2 : 0)}${limit >= 1024 ** 3 ? 'GiB' : 'MiB'}`, `${((used / limit) * 100).toFixed(2)}%`, '1.2kB / 0B', '0B / 0B', String(c.procs.length)];
        }),
    ),
  );
  return 0;
};

const SUBS: Record<string, Sub> = {
  run: (c, a, m, s) => cmdRun(c, a, m, s),
  create: (c, a, m, s) => cmdRun(c, a, m, s, true),
  ps: cmdPs,
  logs: cmdLogs,
  exec: cmdExec,
  stop: (c, a, m, s) => cmdStop(c, a, m, s),
  restart: (c, a, m, s) => cmdStop(c, a, m, s, true),
  start: cmdStart,
  kill: cmdKill,
  rm: cmdRm,
  images: cmdImages,
  pull: cmdPull,
  push: (c, a, _m, s) => push(s, a.filter((x) => !x.startsWith('-'))[0] ?? '', io(c)).then((ok) => (ok ? 0 : 1)),
  tag: cmdTag,
  rmi: cmdRmi,
  history: cmdHistory,
  build: cmdBuild,
  inspect: (c, a, m, s) => inspectAny(c, a, m, s),
  port: cmdPort,
  diff: cmdDiff,
  top: cmdTop,
  update: cmdUpdate,
  events: cmdEvents,
  version: cmdVersion,
  info: cmdInfo,
  network: cmdNetwork,
  volume: cmdVolume,
  system: cmdSystem,
  image: cmdImageSub,
  manifest: cmdManifest,
  rename: cmdRename,
  wait: cmdWait,
  stats: cmdStats,
  compose: (c, a, m) => cmdCompose(c, a, m),
  buildx: async (c, a, m, s) => (a[0] === 'imagetools' ? cmdManifest(c, a.slice(1), m, s) : a[0] === 'build' ? cmdBuild(c, a.slice(1), m, s) : (c.err(`docker buildx: '${a[0] ?? ''}' is not simulated\n`), 1)),
  builder: (c, a, _m, s) => {
    if (a[0] === 'prune') {
      const n = Object.keys(s.buildCache).length;
      s.buildCache = {};
      c.out(`Total:\t${dockerSize(n * 1000)}\n`);
      return 0;
    }
    if (a[0] === 'build') return cmdBuild(c, a.slice(1), _m, s);
    c.err(`docker builder: '${a[0] ?? ''}' is not simulated\n`);
    return 1;
  },
  container: async (c, a, m, s) => {
    const [sub, ...rest] = a;
    const map: Record<string, string> = { ls: 'ps', list: 'ps', ps: 'ps', remove: 'rm', prune: 'container-prune' };
    const name = map[sub] ?? sub;
    if (name === 'container-prune') {
      const gone = s.containers.filter((x) => x.status === 'exited' || x.status === 'created');
      for (const x of gone) removeContainer(m, s, x);
      c.out(`${gone.length ? `Deleted Containers:\n${gone.map((x) => x.id).join('\n')}\n\n` : ''}Total reclaimed space: ${dockerSize(gone.reduce((n, x) => n + upperSize(x), 0))}\n`);
      return 0;
    }
    const f = SUBS[name];
    if (!f || name === 'container') {
      c.err(`docker: 'container ${sub ?? ''}' is not a docker command.\n`);
      return 1;
    }
    return f(c, rest, m, s);
  },
  login: (c, a) => {
    c.out(`Login Succeeded${a[0] ? ` (${a[0]})` : ''}\n`);
    return 0;
  },
  logout: (c, a) => {
    c.out(`Removing login credentials for ${a[0] ?? 'https://index.docker.io/v1/'}\n`);
    return 0;
  },
};

const HELP_PATH: Record<string, string> = { images: 'images', 'image ls': 'images', 'container ls': 'ps', 'container run': 'run', 'container rm': 'rm', 'container stop': 'stop', 'image pull': 'pull', 'image push': 'push', 'image history': 'history', 'image build': 'build', 'image rm': 'rmi', 'container exec': 'exec', 'container logs': 'logs', 'container inspect': 'inspect', 'image inspect': 'inspect' };

export const docker: ShellCommand = {
  name: 'docker',
  summary: bi('клиент Docker: запускать контейнеры, собирать и хранить образы', 'the Docker client: run containers, build and keep images'),
  help: helpText(''),
  handlesHelp: true,
  complete(args) {
    if (args.length <= 1) return Object.keys(SUBS);
    return [];
  },
  async run(ctx) {
    const m = ctx.machine;
    const ds = dockerOf(m);
    const st = ds.s;
    ensureDaemon(m, st);
    if (!m.lookup('curl') || m.lookup('curl') !== curl) m.addLocalCommand?.(curl);
    await refresh(m, st);
    const args = ctx.argv.slice(1);
    // global flags before the subcommand
    while (args[0] && /^-/.test(args[0])) {
      const g = args.shift()!;
      if (g === '-v' || g === '--version') {
        ctx.out(`Docker version ${ENGINE_VERSION}, build dsim\n`);
        return 0;
      }
      if (g === '--help' || g === '-h') return printHelp(ctx, '');
      if (g === '-H' || g === '--host' || g === '--context' || g === '-c' || g === '-l' || g === '--log-level') args.shift();
    }
    const sub = args[0];
    if (!sub) return printHelp(ctx, '');
    // `docker <sub> [<sub2>] --help`
    if (args.includes('--help') && !['run', 'create', 'exec', 'compose'].includes(sub)) {
      const two = `${sub} ${args[1] ?? ''}`.trim();
      const path = HELP_PATH[two] ?? (helpText(two) ? two : HELP_PATH[sub] ?? sub);
      return printHelp(ctx, path);
    }
    const f = SUBS[sub];
    if (!f) {
      ctx.err(`docker: unknown command: docker ${sub}\n\nRun 'docker --help' for more information\n`);
      return 1;
    }
    try {
      return await f(ctx, args.slice(1), m, st);
    } catch (e) {
      if (e instanceof DockerError) {
        ctx.err(`Error response from daemon: ${e.message}\n`);
        return e.code;
      }
      throw e;
    }
  },
};

export type { ImageRec };
