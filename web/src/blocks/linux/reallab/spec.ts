// The Linux block's labs on real machines (design 00 §6.13): the shape of a
// lab and the pure parts of judging it, kept free of the DOM so the content
// tests run them in Node.
//
// A lab is a few Alpine machines of the trainer's image on one switch
// (engine/v86/lab.ts). Goals are ordinary tasks plus `on`, the machine whose
// facts the check reads. When a goal needs something the machine's own state
// does not show — "the neighbour gets the page", "the key login works" — the
// lab runs a probe: a short root command on a machine, whose exit code and
// output land in that machine's facts as `reach['<id>']`, like the probes of
// trainer-check-host.sh on the learner's own VMs.

import type { Bi } from '../../../core/i18n';
import type { Facts, Task } from '../../../core/types';

export type LabProfile = 'lab-node' | 'lab-installer';

export interface LabMachine {
  name: string;
  /** What this machine is in the story: "Maria's laptop", "the bastion". */
  role: Bi;
  profile?: LabProfile;
  /** '10.0.0.11/24'; by default 10.0.0.(11 + index)/24. */
  ip?: string;
  memoryMB?: number;
  disks?: { sizeMB: number }[];
  /** Root commands run once after every machine of the lab is up (not on a resumed lab). */
  setup?: string[];
}

export interface LabProbe {
  id: string;
  on: string;
  /** A root command; `exit` and `out` go into `reach[id]` of that machine's facts. */
  cmd: string;
}

export interface LabGoal extends Task {
  /** The machine whose facts `check` reads (default: the first machine). */
  on?: string;
  /** Exam mode: weight in the score (default 1) and whether the exam fails without it. */
  weight?: number;
  critical?: boolean;
}

export interface RealLabProps {
  machines: LabMachine[];
  tasks: LabGoal[];
  probes?: LabProbe[];
  intro?: Bi;
  /** 'exam': no hints and chips, a soft timer, a score at the end. */
  mode?: 'lesson' | 'exam';
  /** Exam mode: id in the protocol event, minutes of the soft timer, the pass share. */
  examId?: string;
  minutes?: number;
  pass?: number;
  /** Paths whose facts function checks read (string predicates are scanned automatically). */
  watch?: Record<string, string[]>;
  autostart?: boolean;
  rows?: number;
}

/** The machine a goal runs on. */
export function goalMachine(p: RealLabProps, g: LabGoal): string {
  return g.on ?? p.machines[0].name;
}

/** Probe ids a check names in its string predicates: reach['id']. */
export function probesNamed(src: unknown): string[] {
  if (typeof src !== 'string') return [];
  return [...src.matchAll(/reach\[['"]([\w.-]+)['"]\]/g)].map((m) => m[1]);
}

/** Probes a goal needs: those named in `when` and `fail[].if`, plus `probe:<id>` ids listed in `watch`. */
export function goalProbes(p: RealLabProps, g: LabGoal): LabProbe[] {
  const ids = new Set([...probesNamed(g.check.when), ...(g.check.fail ?? []).flatMap((f) => probesNamed(f.if))]);
  for (const w of p.watch?.[g.id] ?? []) if (w.startsWith('probe:')) ids.add(w.slice(6));
  return (p.probes ?? []).filter((x) => ids.has(x.id));
}

/** String predicates of a goal (for collecting the right paths and scopes). */
export function goalPredicates(g: LabGoal): string[] {
  return [g.check.when, ...(g.check.fail ?? []).map((f) => f.if)].filter((x): x is string => typeof x === 'string');
}

/** Put probe results into a machine's facts. */
export function withProbes(f: Facts, results: Record<string, { exit: number; out: string }>): Facts {
  const reach = { ...((f.reach ?? {}) as Record<string, unknown>) };
  for (const [id, r] of Object.entries(results)) reach[id] = { exit: r.exit, out: r.out };
  return { ...f, reach } as Facts;
}

/** Exam score: the weighted share of passed goals, and whether every critical goal passed. */
export function labScore(tasks: LabGoal[], passed: ReadonlySet<string>, pass = 0.7): { score: number; critical: boolean; passed: boolean } {
  const total = tasks.reduce((n, t) => n + (t.weight ?? 1), 0) || 1;
  const got = tasks.filter((t) => passed.has(t.id)).reduce((n, t) => n + (t.weight ?? 1), 0);
  const critical = tasks.every((t) => !t.critical || passed.has(t.id));
  const score = Math.round((got / total) * 100) / 100;
  return { score, critical, passed: critical && score >= pass };
}

/** Tab memory the lab takes, MiB: guest RAM plus the emulator per machine (engine/v86 labMachineMB). */
export function labMemoryMB(p: RealLabProps): number {
  return p.machines.reduce((n, m) => n + (m.memoryMB ?? (m.profile === 'lab-installer' ? 160 : 128)) + 60, 0);
}

/** Shell-quote one word for a root command. */
export const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

/** What judging needs from a machine (V86Machine has all of it). */
export interface JudgedMachine {
  bootFrom: 'image' | 'disk';
  facts(scopes?: string[]): Promise<Facts>;
  exec(cmd: string): Promise<{ out: string; exit: number }>;
}

/**
 * A goal judged by probes alone: its string predicates read only `reach[...]`,
 * and a function check lists only probes in `watch`. Such goals skip the
 * machine's general facts (processes, users, files), which take seconds in
 * emulation, and cost only their probes.
 */
export function probeOnly(p: RealLabProps, g: LabGoal): boolean {
  const fns = [g.check.when, ...(g.check.fail ?? []).map((f) => f.if)].some((x) => typeof x === 'function');
  const watch = p.watch?.[g.id] ?? [];
  if (fns && (!watch.length || watch.some((w) => !w.startsWith('probe:')))) return false;
  return goalPredicates(g).every((src) => !/(^|[^\w.'"\]])(?!reach\b)[a-z]+(?=[[.#])/.test(src.replace(/'[^']*'|"[^"]*"/g, "''")));
}

/** Facts of one machine for these pending goals: their lab scopes, then their probes that run on it. */
export async function goalFacts(p: RealLabProps, name: string, m: JudgedMachine, pending: LabGoal[]): Promise<Facts> {
  const scopes = [...new Set(pending.flatMap((g) => (p.watch?.[g.id] ?? []).filter((w) => w.startsWith('scope:')).map((w) => w.slice(6))))];
  const light = m.bootFrom === 'image' && !scopes.length && pending.every((g) => probeOnly(p, g));
  const f = light
    ? ({ schema: 'dt.facts/v1', env: { kind: 'v86', machine: name, kernel: '', at: new Date().toISOString() }, user: { name: 'root', uid: 0, gid: 0 }, cwd: '/', hostname: name, vars: {}, procs: [], files: {}, term: { main: [] }, users: [], groups: [] } as Facts)
    : await m.facts(scopes);
  if (m.bootFrom === 'disk') return f;
  const results: Record<string, { exit: number; out: string }> = {};
  for (const probe of new Map(pending.flatMap((g) => goalProbes(p, g)).map((x) => [x.id, x])).values()) {
    if (probe.on !== name) continue;
    results[probe.id] = await m.exec(probe.cmd);
  }
  return withProbes(f, results);
}
