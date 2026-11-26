// Facts from the learner's own machines (00 §6.6, tier C). The read-only
// trainer-check-host.sh prints one base64 block (gzip of JSON, schema
// dt.host-check/v1) with raw command outputs; this file turns it into
// dt.facts/v1 with the same field names the simulator uses (files[path].perm,
// users[].groupNames, units[name].active/enabled/props, cgroups[].memory.max,
// mounts[].free, reach[id]), so one predicate judges both. Pure functions:
// the exam page renders, the tests feed synthetic blocks.

import { evaluateCheck } from '../../core/check';
import type { Bi, CheckResult, Facts, RealGoal, RealMachine, RealTask } from '../../core/types';

export interface HostBlob {
  schema: 'dt.host-check/v1';
  nonce: string;
  machine: string;
  track: string;
  collectedAt: string;
  whoami: string;
  hostname: string;
  kernel: string;
  os?: string;
  raw: Record<string, string>;
  files: Record<string, { exists: boolean; type?: string; mode?: string; owner?: string; group?: string; size?: number; text?: string; target?: string }>;
  trees: Record<string, string>;
  units: Record<string, Record<string, string>>;
  probes: Record<string, Record<string, unknown>>;
}

const BEGIN = '-----BEGIN TRAINER FACTS-----';
const END = '-----END TRAINER FACTS-----';

async function gunzip(bytes: Uint8Array): Promise<string> {
  const DS = (globalThis as unknown as { DecompressionStream?: new (f: string) => TransformStream<Uint8Array, Uint8Array> }).DecompressionStream;
  if (!DS) throw new Error('this browser cannot unpack gzip (DecompressionStream is missing)');
  const stream = new Response(bytes as BodyInit).body!.pipeThrough(new DS('gzip'));
  return await new Response(stream).text();
}

/** The pasted block → the blob. Text around the BEGIN/END lines and line breaks are ignored. */
export async function decodeHostBlob(text: string): Promise<HostBlob> {
  const a = text.indexOf(BEGIN);
  const b = text.indexOf(END);
  const body = (a >= 0 && b > a ? text.slice(a + BEGIN.length, b) : text).replace(/\s+/g, '');
  if (!body) throw new Error('empty');
  let bin: string;
  try {
    bin = atob(body);
  } catch {
    throw new Error('this is not base64: copy the whole block between the BEGIN and END lines');
  }
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const json = bytes[0] === 0x1f && bytes[1] === 0x8b ? await gunzip(bytes) : new TextDecoder().decode(bytes);
  let blob: HostBlob;
  try {
    blob = JSON.parse(json) as HostBlob;
  } catch {
    throw new Error('the block is cut: copy it again, from BEGIN to END');
  }
  if (blob.schema !== 'dt.host-check/v1') throw new Error(`unknown schema "${String(blob.schema)}"`);
  return blob;
}

export function permOf(mode: number): { u: string; g: string; o: string; setuid: boolean; setgid: boolean; sticky: boolean } {
  const tri = (shift: number) => `${mode & (4 << shift) ? 'r' : '-'}${mode & (2 << shift) ? 'w' : '-'}${mode & (1 << shift) ? 'x' : '-'}`;
  return { u: tri(6), g: tri(3), o: tri(0), setuid: !!(mode & 0o4000), setgid: !!(mode & 0o2000), sticky: !!(mode & 0o1000) };
}

const lines = (s: string | undefined) => (s ?? '').split('\n').filter((l) => l.trim());

function parseJson<T>(s: string | undefined, fallback: T): T {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** `KEY=VALUE` lines (systemctl show) → a record. */
function kvLines(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of lines(s)) {
    const i = l.indexOf('=');
    if (i > 0) out[l.slice(0, i)] = l.slice(i + 1);
  }
  return out;
}

/** systemd values → bytes / numbers as the simulator reports them; 'infinity' and 'max' → 'max'. */
function limit(v: string | undefined): number | 'max' {
  if (v === undefined || v === '' || v === 'infinity' || v === 'max') return 'max';
  const n = Number(v.trim().split(/\s+/)[0]);
  return Number.isFinite(n) ? n : 'max';
}

export interface ListenFact {
  proto: string;
  addr: string;
  port: number;
  proc: string;
  pid?: number;
}

/** `ss -Htlnup` → listening sockets. */
export function parseSs(s: string | undefined): ListenFact[] {
  const out: ListenFact[] = [];
  for (const l of lines(s)) {
    const f = l.trim().split(/\s+/);
    if (f.length < 5) continue;
    const local = f[4];
    const i = local.lastIndexOf(':');
    const addr = local.slice(0, i).replace(/^\[|\]$/g, '').replace(/%.*$/, '');
    const m = /users:\(\("([^"]+)",pid=(\d+)/.exec(l);
    out.push({ proto: f[0], addr, port: Number(local.slice(i + 1)), proc: m?.[1] ?? '', pid: m ? Number(m[2]) : undefined });
  }
  return out;
}

export interface WgFacts {
  ifaces: { name: string; publicKey: string; listenPort: number }[];
  peers: { iface: string; publicKey: string; endpoint: string; allowedIps: string[]; handshake: number }[];
}

/** `wg show all dump` (keys already hidden by the script) → interfaces and peers. */
export function parseWg(s: string | undefined): WgFacts {
  const w: WgFacts = { ifaces: [], peers: [] };
  for (const l of lines(s)) {
    const f = l.split('\t');
    if (f.length === 5) w.ifaces.push({ name: f[0], publicKey: f[2], listenPort: Number(f[3]) });
    else if (f.length >= 9) w.peers.push({ iface: f[0], publicKey: f[1], endpoint: f[3], allowedIps: f[4] === '(none)' ? [] : f[4].split(','), handshake: Number(f[5]) });
  }
  return w;
}

/** `sshd -T` → lower-case keys; repeated keys keep every value, space-joined. */
export function parseSshdT(s: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of lines(s)) {
    const m = /^(\S+)\s+(.*)$/.exec(l.trim());
    if (!m) continue;
    const k = m[1].toLowerCase();
    out[k] = out[k] ? `${out[k]} ${m[2]}` : m[2];
  }
  return out;
}

/** The location blocks of an nginx configuration, as text (nested blocks included). */
export function nginxLocations(conf: string): string[] {
  const out: string[] = [];
  const clean = conf.replace(/#[^\n]*/g, '');
  const re = /\blocation\b[^{;]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < clean.length && depth > 0; i++) {
      if (clean[i] === '{') depth++;
      else if (clean[i] === '}') depth--;
    }
    out.push(clean.slice(m.index, i));
  }
  return out;
}

/** nginx time ("75s", "2m", "90") → seconds. */
export function nginxSeconds(v: string): number {
  const m = /^(\d+)(ms|s|m|h)?$/.exec(v.trim());
  if (!m) return NaN;
  const n = Number(m[1]);
  return m[2] === 'ms' ? n / 1000 : m[2] === 'm' ? n * 60 : m[2] === 'h' ? n * 3600 : n;
}

/** The blob → dt.facts/v1 of one machine. */
export function hostFacts(b: HostBlob): Facts {
  const files: Facts['files'] = {};
  for (const [path, f] of Object.entries(b.files ?? {})) {
    if (!f.exists) continue;
    const mode = parseInt(f.mode || '0', 8);
    const fact = { exists: true, type: (f.type ?? 'f') as 'f', mode: (f.mode ?? '').padStart(4, '0'), owner: f.owner, group: f.group, size: f.size ?? 0, text: f.text, target: f.target, perm: permOf(mode) };
    files[path] = fact as unknown as Facts['files'][string];
  }
  const groupsRaw = lines(b.raw?.group).map((l) => {
    const [name, , gid, members] = l.split(':');
    return { name, gid: Number(gid), members: (members ?? '').split(',').filter(Boolean) };
  });
  const users = lines(b.raw?.passwd).map((l) => {
    const [name, uid, gid, home, shell] = l.split(':');
    const primary = groupsRaw.find((g) => g.gid === Number(gid))?.name;
    const groupNames = [...new Set([primary, ...groupsRaw.filter((g) => g.members.includes(name)).map((g) => g.name)].filter((x): x is string => !!x))];
    return { name, uid: Number(uid), gid: Number(gid), home, shell, groupNames };
  });
  const groups = groupsRaw.map((g) => ({ ...g, members: [...new Set([...g.members, ...users.filter((u) => u.gid === g.gid).map((u) => u.name)])] }));
  const procs = lines(b.raw?.ps).map((l) => {
    const m = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s*(.*)$/.exec(l);
    return m ? { pid: Number(m[1]), ppid: Number(m[2]), uid: -1, user: m[3], cmd: m[4], args: m[5] } : null;
  }).filter((p): p is NonNullable<typeof p> => !!p);
  const units: Record<string, { active: string; sub: string; enabled: string; restarts: number; props: Record<string, string> }> = {};
  const cgroups: { path: string; unit: string; memory: { max: number | 'max'; events: Record<string, number> }; pids: { max: number | 'max' }; cpu: { weight: number } }[] = [];
  for (const [name, u] of Object.entries(b.units ?? {})) {
    const props = kvLines(u.show ?? '');
    units[name] = { active: props.ActiveState ?? '', sub: props.SubState ?? '', enabled: props.UnitFileState ?? '', restarts: Number(props.NRestarts ?? 0), props };
    if (u.cgroup) {
      const events: Record<string, number> = {};
      for (const l of lines(u['memory.events'])) {
        const [k, v] = l.split(/\s+/);
        events[k] = Number(v);
      }
      cgroups.push({ path: u.cgroup, unit: name, memory: { max: limit(u['memory.max']), events }, pids: { max: limit(u['pids.max']) }, cpu: { weight: Number(u['cpu.weight'] ?? 100) } });
    }
  }
  const df = lines(b.raw?.df).slice(1).map((l) => l.split(/\s+/));
  const mounts = lines(b.raw?.findmnt).map((l) => {
    const [source, target, type, options] = l.split(/\s+/).map((x) => x.replace(/\\x20/g, ' '));
    const d = df.find((r) => r[5] === target);
    return { source, target, type, options, size: d ? Number(d[1]) * 1024 : 0, used: d ? Number(d[2]) * 1024 : 0, free: d ? Number(d[3]) * 1024 : 0 };
  });
  const addrs = parseJson<{ ifname: string; mtu?: number; operstate?: string; addr_info?: { local: string; prefixlen: number; family: string }[] }[]>(b.raw?.ip_addr, []);
  const ifaces = addrs.map((a) => ({ name: a.ifname, mtu: a.mtu ?? 0, state: a.operstate ?? '', addrs: (a.addr_info ?? []).map((x) => `${x.local}/${x.prefixlen}`) }));
  const routes = parseJson<{ dst: string; gateway?: string; dev?: string }[]>(b.raw?.ip_route, []).map((r) => ({ dst: r.dst, gateway: r.gateway ?? '', dev: r.dev ?? '' }));
  const net = b.raw?.ip_addr !== undefined || b.raw?.ss !== undefined
    ? {
        ifaces,
        addrs: ifaces.flatMap((i) => i.addrs.map((a) => a.split('/')[0])),
        routes,
        forward: Number((b.raw.ip_forward ?? '0').trim() || 0),
        listen: parseSs(b.raw.ss),
        nft: b.raw.nft ?? '',
        iptables: b.raw.iptables ?? '',
        wg: parseWg(b.raw.wg),
      }
    : undefined;
  const reach: Record<string, Record<string, unknown>> = {};
  for (const [id, p] of Object.entries(b.probes ?? {})) reach[id] = { ...p, ok: p.kind === 'http' ? Number(p.status) >= 200 && Number(p.status) < 400 : p.kind === 'icmp' ? Number(p.received) > 0 : p.kind === 'ssh' ? p.exit === 0 : !!p.connected };
  const raw = b.raw ?? {};
  const sudo: Record<string, string> = {};
  const logrotate: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('sudo_l:')) sudo[k.slice(7)] = v;
    if (k.startsWith('logrotate:')) logrotate[k.slice(10)] = v;
  }
  const me = users.find((u) => u.name === b.whoami);
  const facts: Facts = {
    schema: 'dt.facts/v1',
    env: { kind: 'vm', machine: b.machine, kernel: b.kernel, at: b.collectedAt },
    user: { name: b.whoami, uid: me?.uid ?? -1, gid: me?.gid ?? -1 },
    cwd: '/',
    hostname: b.hostname,
    vars: {},
    procs: procs as unknown as Facts['procs'],
    files,
    term: { main: [] },
    users,
    groups,
    units,
    cgroups,
    mounts,
    trees: b.trees ?? {},
    reach,
    sudo,
    logrotate,
    proof: { nonce: b.nonce, machine: b.machine, track: b.track, os: b.os ?? '', collectedAt: b.collectedAt },
  };
  if (net) facts.net = net;
  if (raw.nginx_T !== undefined) facts.nginx = { config: raw.nginx_T, ok: /exit=0\s*$/.test(raw.nginx_t ?? '') };
  if (raw.sshd_T !== undefined) facts.sshd = parseSshdT(raw.sshd_T);
  if (raw.journald !== undefined) facts.journald = raw.journald;
  if (raw.visudo !== undefined) facts.sudoers = { ok: /exit=0\s*$/.test(raw.visudo), text: raw.visudo };
  return facts;
}

/** Signs that the block is not from this exam's machine: wrong code, wrong machine, the simulator. */
export function hostProblems(f: Facts, want: { nonce: string; machine: string; track: string }): Bi[] {
  const p = f.proof as { nonce?: string; machine?: string; track?: string };
  const out: Bi[] = [];
  if (p.nonce !== want.nonce) out.push({ ru: 'одноразовый код не совпадает с кодом на этой странице', en: 'the one-time code does not match the one on this page' });
  if (p.machine !== want.machine) out.push({ ru: `блок снят как «${p.machine}», а ждём «${want.machine}»`, en: `the block was taken as “${p.machine}”, expected “${want.machine}”` });
  if (want.track && p.track !== want.track) out.push({ ru: `трек «${p.track}» вместо «${want.track}»`, en: `track “${p.track}” instead of “${want.track}”` });
  if (/dt-sim/.test(f.env.kernel)) out.push({ ru: 'это ядро симулятора, а не вашей машины', en: 'this is the simulator’s kernel, not your machine’s' });
  return out;
}

/** The collector command line for a machine: its `collect` arguments with `{id}` replaced by the typed addresses. */
export function collectorCommand(m: RealMachine, opts: { nonce: string; track: string; addresses: Record<string, string>; collector?: string }): string {
  const fill = (s: string) => s.replace(/\{([a-z0-9-]+)\}/gi, (_, id: string) => opts.addresses[id]?.trim() || `${id.toUpperCase()}_ADDR`);
  const args = m.collect.map((a) => {
    const i = a.indexOf(' ');
    return i < 0 ? a : `${a.slice(0, i)} ${shellQuote(fill(a.slice(i + 1)))}`;
  });
  return [`sudo bash ${opts.collector ?? 'trainer-check-host.sh'}`, `--nonce ${opts.nonce}`, `--machine ${m.id}`, `--track ${opts.track}`, ...args].join(' \\\n    ');
}

function shellQuote(s: string): string {
  return /^[A-Za-z0-9_./:,=@%+-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}

export type MachinesFacts = Record<string, Facts>;

export interface GoalResult {
  goal: RealGoal;
  /** No facts from the machine the goal needs yet. */
  waiting: boolean;
  result?: CheckResult;
}

/** Judge a task's goals on the facts collected so far. */
export function judgeReal(task: RealTask, machines: MachinesFacts): { goals: GoalResult[]; score: number } {
  const goals = (task.goals ?? []).map((goal): GoalResult => {
    if (goal.on) {
      const f = machines[goal.on];
      return f ? { goal, waiting: false, result: evaluateCheck(goal.check, f) } : { goal, waiting: true };
    }
    if (!Object.keys(machines).length) return { goal, waiting: true };
    const all = { machines } as unknown as Facts;
    return { goal, waiting: false, result: evaluateCheck(goal.check, all) };
  });
  const passed = goals.filter((g) => g.result?.pass).length;
  return { goals, score: goals.length ? passed / goals.length : 0 };
}

/** The cleanup paste: does any accepted pattern match? */
/**
 * What `dtlab destroy` prints (lab/internal/lab/lab.go) and what `dtlab
 * status` says once the lab is gone: the cleanup of an exam taken in dtlab.
 */
export const DTLAB_CLEANUP: RegExp[] = [/VMs, their disks and the kuberoot credentials removed/, /no lab yet: dtlab check, then dtlab up/];

/** The cleanup confirmations of a real-machine exam: Terraform, an empty provider list, or dtlab. */
export const CLEANUP_ACCEPT: RegExp[] = [/Destroy complete! Resources: [1-9]\d* destroyed/, /No resources found/, /^\s*\[\s*\]\s*$/, ...DTLAB_CLEANUP];

export function judgePaste(task: RealTask, text: string): boolean {
  return !!task.paste && !!text.trim() && task.paste.accept.some((re) => re.test(text));
}

/** The text of a script wrapped as one paste-able command: write the file, then run it. */
export function heredoc(name: string, text: string): string {
  return `cat > ${name} <<'DT_EOF'\n${text.replace(/\n?$/, '\n')}DT_EOF`;
}
