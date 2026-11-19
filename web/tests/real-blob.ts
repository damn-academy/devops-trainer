// Test helper for exams on real machines: builds the block trainer-check-host.sh
// would print (gzip + base64 of dt.host-check/v1) from parts, and judges a
// task of an exam on the decoded facts.

import { gzipSync } from 'node:zlib';
import { decodeHostBlob, hostFacts, hostProblems, judgeReal, type HostBlob, type MachinesFacts } from '../src/app/real/facts';
import type { Exam, ExamTask, RealTask } from '../src/core/types';

export const NONCE = 'k7m2qx';

export function blob(machine: string, track: string, parts: Partial<HostBlob> & { raw?: Record<string, string> }, at = '2026-11-18T12:00:00Z'): HostBlob {
  return {
    schema: 'dt.host-check/v1',
    nonce: NONCE,
    machine,
    track,
    collectedAt: at,
    whoami: 'root',
    hostname: machine,
    kernel: '6.1.0-27-cloud-amd64',
    os: 'Debian GNU/Linux 12 (bookworm)',
    files: {},
    trees: {},
    units: {},
    probes: {},
    ...parts,
    raw: { passwd: 'root:0:0:/root:/bin/bash', group: 'root:x:0:', ps: '    1     0 root     systemd         /sbin/init', ...(parts.raw ?? {}) },
  };
}

/** The text the learner pastes. */
export function printed(b: HostBlob): string {
  const body = gzipSync(Buffer.from(JSON.stringify(b))).toString('base64').replace(/(.{76})/g, '$1\n');
  return `-----BEGIN TRAINER FACTS-----\n${body}\n-----END TRAINER FACTS-----\n`;
}

/** Paste → decode → facts, the way the exam page does it; throws if the block would be refused. */
export async function machines(exam: Exam, blobs: HostBlob[]): Promise<MachinesFacts> {
  const out: MachinesFacts = {};
  for (const b of blobs) {
    const f = hostFacts(await decodeHostBlob(printed(b)));
    const problems = hostProblems(f, { nonce: NONCE, machine: b.machine, track: exam.real!.track });
    if (problems.length) throw new Error(problems.map((p) => p.en).join('; '));
    out[b.machine] = f;
  }
  return out;
}

export function realTask(exam: Exam, id: string): RealTask {
  const t = exam.tasks.find((x) => x.id === id) as ExamTask | undefined;
  if (!t || t.kind !== 'real') throw new Error(`no real task ${id}`);
  return t.real;
}

/** Ids of the goals of a task that do not hold. */
export function failing(exam: Exam, id: string, m: MachinesFacts): string[] {
  return judgeReal(realTask(exam, id), m).goals.filter((g) => !g.result?.pass).map((g) => g.goal.id);
}

/** The targeted explanation (English) a goal gives, if any. */
export function say(exam: Exam, id: string, goal: string, m: MachinesFacts): string | undefined {
  return judgeReal(realTask(exam, id), m).goals.find((g) => g.goal.id === goal)?.result?.say?.en;
}
