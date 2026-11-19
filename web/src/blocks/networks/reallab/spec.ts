// The shape of a real-Linux network lab (design 00 §6.13) and how its facts
// are gathered. A lab is a few Alpine machines of the lab image on the page's
// switch, a setup script per machine, the probes between them and the goals.
// Goals are ordinary `Task`s judged by state: with `on` a goal sees that
// machine's facts (`net`, `fw`, `listen`, `reach[...]`…); without it, it sees
// `{ machines: { <name>: Facts }, switch: SwitchFacts }` and can compare them.
//
// The gathering is engine-independent (`LabRunner`), so the same code runs in
// the browser on V86Lab and in tests on recorded machines.

import type { Bi } from '../../../core/i18n';
import type { Facts, Task } from '../../../core/types';
import type { PortConfig } from '../../../engine/v86/switch';
import { runProbes, type ProbeResult, type ProbeSpec } from './probes';
import type { SwitchFacts } from './tap';

export type Scope = 'net' | 'listen' | 'svc' | 'fw' | 'dns' | 'mounts';

export interface NetLabMachine {
  name: string;
  role: Bi;
  /** '10.0.0.11/24' on eth0, untagged; omitted with `dhcp`. */
  ip?: string;
  dhcp?: boolean;
  mac?: string;
  gateway?: string;
  /** The switch port: access VLAN (default 1) or a trunk. */
  port?: PortConfig;
  /** Root shell lines run once after the first boot, before the learner gets the prompt. */
  setup?: string[];
}

export interface NetLabTask extends Task {
  /** The machine whose facts the check sees; without it the check sees all machines and the switch. */
  on?: string;
  /** Probe ids this goal reads (run only while the goal is open). */
  probes?: string[];
  /** Fact scopes per machine this goal reads. */
  scopes?: Partial<Record<string, Scope[]>>;
  /** Shown only at these levels. */
  levels?: ('beginner' | 'intermediate' | 'experienced')[];
}

export interface NetLabSpec {
  id: string;
  title: Bi;
  intro: Bi;
  machines: NetLabMachine[];
  probes: ProbeSpec[];
  tasks: NetLabTask[];
  /** Show the switch tap: capture, the frame list and the .pcap download. */
  capture?: boolean;
  /** Show the line knobs (loss and delay) per port. */
  line?: boolean;
  /** Collect nginx's configuration (`nginx -T`, `nginx -t`) on these machines. */
  nginx?: string[];
  /** File paths per machine whose facts are collected (`files[path].text`). */
  files?: Partial<Record<string, string[]>>;
}

/** What the gathering needs from a lab: run a root command, collect a machine's facts. */
export interface LabRunner {
  exec(machine: string, cmd: string): Promise<{ out: string; exit: number }>;
  /** `full`: also the process table and the learner's terminal (goals with `stdout`). */
  facts(machine: string, scopes: Scope[], files: string[], full?: boolean): Promise<Facts>;
  switchFacts?(): SwitchFacts;
}

export type LabFactsAll = { machines: Record<string, Facts>; switch?: SwitchFacts };

/** Which scopes, probes and files the open goals need, per machine. */
export function needs(spec: NetLabSpec, open: NetLabTask[]): { scopes: Map<string, Set<Scope>>; probes: ProbeSpec[]; files: Map<string, Set<string>>; on: Set<string>; full: Set<string> } {
  const scopes = new Map<string, Set<Scope>>(spec.machines.map((m) => [m.name, new Set<Scope>()]));
  const files = new Map<string, Set<string>>(spec.machines.map((m) => [m.name, new Set(spec.files?.[m.name] ?? [])]));
  const ids = new Set<string>();
  const on = new Set<string>(spec.nginx ?? []);
  const full = new Set<string>();
  for (const t of open) {
    if (t.on) on.add(t.on);
    if (t.on && t.check.stdout !== undefined) full.add(t.on);
    for (const [m, list] of Object.entries(t.scopes ?? {})) for (const s of list ?? []) scopes.get(m)?.add(s);
    for (const p of t.probes ?? []) ids.add(p);
  }
  return { scopes, probes: spec.probes.filter((p) => ids.has(p.id)), files, on, full };
}

const bare = (name: string): Facts => ({ schema: 'dt.facts/v1', env: { kind: 'v86', machine: name }, files: {}, procs: [], term: { main: [] } }) as unknown as Facts;

// The pid path is given so that the test works before the service ever started (OpenRC creates /run/nginx).
const NGINX = `nginx -t -g 'pid /tmp/.dt-ngx.pid;' >/tmp/.dt-ngx-t 2>&1; echo "rc=$?"; nginx -T -g 'pid /tmp/.dt-ngx.pid;' 2>/dev/null`;

/** Gather the facts the open goals need: scopes, files, probes, nginx. */
export async function gather(spec: NetLabSpec, runner: LabRunner, open: NetLabTask[] = spec.tasks): Promise<LabFactsAll> {
  const n = needs(spec, open);
  const [reach, machines] = await Promise.all([
    runProbes(n.probes, (m, c) => runner.exec(m, c)),
    Promise.all(
      spec.machines.map(async (m) => {
        const scopes = [...(n.scopes.get(m.name) ?? [])];
        const files = [...(n.files.get(m.name) ?? [])];
        // A machine no open goal reads directly needs no facts round trip: its probes are enough.
        const f = scopes.length || files.length || n.on.has(m.name) ? await runner.facts(m.name, scopes, files, n.full.has(m.name)) : bare(m.name);
        if (spec.nginx?.includes(m.name)) {
          const r = await runner.exec(m.name, NGINX);
          const ok = /^rc=0/.test(r.out.trim());
          (f as Facts & { nginx: unknown }).nginx = { ok, config: r.out.replace(/^rc=\d+\n?/, '') };
        }
        return [m.name, f] as const;
      }),
    ),
  ]);
  const all: LabFactsAll = { machines: Object.fromEntries(machines) };
  for (const [name, f] of Object.entries(all.machines)) (f as Facts & { reach: Record<string, ProbeResult> }).reach = reach[name] ?? {};
  if (runner.switchFacts) all.switch = runner.switchFacts();
  return all;
}

/** The facts one goal sees. */
export function factsFor(task: NetLabTask, all: LabFactsAll): Facts | undefined {
  if (task.on) return all.machines[task.on];
  return all as unknown as Facts;
}

// ── helpers for checks (typed reads of the lab scopes) ────────────────────

type Net = { addrs: { dev: string; family?: string; cidr: string; addr: string }[]; links: { name: string; up: boolean; state: string; kind?: string; master?: string; vlan?: number }[]; routes: { dst: string; via?: string; dev?: string }[]; forward: number; netns: string[] };
type Fw = { nft: { family: string; table: string; chain?: string; rule: string }[]; iptables: { table: string; chain: string; rule: string }[] };

export const net = (f: Facts | undefined): Net => ((f as { net?: Net } | undefined)?.net ?? { addrs: [], links: [], routes: [], forward: 0, netns: [] });
export const fw = (f: Facts | undefined): Fw => ((f as { fw?: Fw } | undefined)?.fw ?? { nft: [], iptables: [] });
export const reach = (f: Facts | undefined, id: string): ProbeResult | undefined => ((f as { reach?: Record<string, ProbeResult> } | undefined)?.reach ?? {})[id];
export const listen = (f: Facts | undefined) => ((f as { listen?: { proto: string; addr: string; port: number; proc?: string }[] } | undefined)?.listen ?? []);
export const svc = (f: Facts | undefined) => ((f as { svc?: { name: string; state: string; runlevels: string[] }[] } | undefined)?.svc ?? []);
export const dnsOf = (f: Facts | undefined) => ((f as { dns?: { nameservers: string[]; search: string[] } } | undefined)?.dns ?? { nameservers: [], search: [] });
export const fileText = (f: Facts | undefined, p: string): string => ((f?.files?.[p] as { text?: string } | undefined)?.text ?? '');
export const fileSize = (f: Facts | undefined, p: string): number => ((f?.files?.[p] as { size?: number } | undefined)?.size ?? 0);
export const on = (f: Facts | undefined, name: string): Facts | undefined => (f as unknown as LabFactsAll | undefined)?.machines?.[name];
export const sw = (f: Facts | undefined): SwitchFacts | undefined => (f as unknown as LabFactsAll | undefined)?.switch;

/** Every rule as text, nft and iptables together (iptables-nft shows up in both). */
export const rules = (f: Facts | undefined): string => [...fw(f).nft.map((r) => `${r.table} ${r.chain ?? ''} ${r.rule}`), ...fw(f).iptables.map((r) => `${r.table} ${r.chain} ${r.rule}`)].join('\n');

/** A source rewrite on the way out: masquerade or snat, by nft or iptables. */
export const hasMasquerade = (f: Facts | undefined): boolean => /\bmasquerade\b|\bsnat to\b|\bMASQUERADE\b|-j SNAT/i.test(rules(f));

/** An input chain whose policy is drop (nft), or INPUT DROP (iptables). */
export const inputDrop = (f: Facts | undefined): boolean =>
  fw(f).nft.some((r) => /hook input\b.*policy drop/.test(r.rule)) || fw(f).iptables.some((r) => r.table === 'filter' && r.chain === 'INPUT' && r.rule === 'policy DROP');

export const addrOn = (f: Facts | undefined, dev: string, cidr: string): boolean => net(f).addrs.some((a) => a.dev === dev && a.cidr === cidr);
export const hasAddr = (f: Facts | undefined, cidr: string): boolean => net(f).addrs.some((a) => a.cidr === cidr);
export const link = (f: Facts | undefined, name: string) => net(f).links.find((l) => l.name === name);

/** IPv4 as a number, for range checks. */
export const ip4 = (s: string): number => s.split('.').reduce((n, x) => n * 256 + (Number(x) & 255), 0);
