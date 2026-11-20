// Checks of the Linux labs that the persona walk-through found too strict or
// too lenient: a usage run checked by `echo $?` on the same line, the root
// file system's UUID written for /data, and the new quiz items in their lessons.

import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { registry } from '../src/core/registry';
import type { Lesson, Task, TerminalSection, TerminalSetup } from '../src/core/types';
import { createSimMachine, type SimMachine } from '../src/engine/terminal/shell';

function lab(lessonId: string): { setup: TerminalSetup; tasks: Task[] } {
  const s = (registry.lessons.get(lessonId) as Lesson).sections.find((x) => x.id === 'lab') as TerminalSection;
  return { setup: s.setup, tasks: s.tasks };
}

async function run(m: SimMachine, ...lines: string[]): Promise<void> {
  for (const l of lines) await m.exec(l);
}

const judge = async (m: SimMachine, t: Task) => evaluateCheck(t.check, await m.facts());

describe('linux labs after the persona walk-through', () => {
  it('the usage run passes with `echo $?` on the same line, and not with a code of 0', async () => {
    const script = '#!/bin/bash\nif [ $# -ne 1 ]; then\n  echo "usage: backup.sh DIR" >&2\n  exit 1\nfi\n';
    const { setup, tasks } = lab('linux.scripts');
    const m = await createSimMachine(setup);
    await run(m, `cat > ~/bin/backup.sh <<'EOF'\n${script}EOF`, 'chmod u+x ~/bin/backup.sh');
    await run(m, 'backup.sh; echo "code=$?"');
    expect((await judge(m, tasks[1])).pass).toBe(true);
    const bad = await createSimMachine(setup);
    await run(bad, `cat > ~/bin/backup.sh <<'EOF'\n#!/bin/bash\necho "usage: backup.sh DIR" >&2\nEOF`, 'chmod u+x ~/bin/backup.sh', 'backup.sh');
    const r = await judge(bad, tasks[1]);
    expect(r.pass).toBe(false);
    expect(r.say?.ru).toContain('exit 1');
  });

  it('fstab with the root file system’s UUID for /data does not pass and says why', async () => {
    const { setup, tasks } = lab('linux.disks');
    const m = await createSimMachine(setup);
    await run(m, 'sudo mkfs.ext4 /dev/sdb', 'sudo mount /dev/sdb /data', "echo 'UUID=3b8f6c1e-5d1a-4f6e-9a57-2c1f0e7d9a10 /data ext4 defaults 0 2' | sudo tee -a /etc/fstab");
    const r = await judge(m, tasks[1]);
    expect(r.pass).toBe(false);
    expect(r.say?.ru).toContain('/dev/sda1');
    await run(m, "sudo sed -i '/ \\/data /d' /etc/fstab");
    expect((await m.facts()).files['/etc/fstab']?.text ?? '').not.toContain('/data');
  });

  it('the new quiz items are in the bank and in their lessons', () => {
    const items: Record<string, string> = {
      'linux.q.vim-exit': 'linux.files',
      'linux.q.uid-other-machine': 'linux.users',
      'linux.q.sudo-cd': 'linux.permissions',
      'linux.q.root-denied': 'linux.permissions',
      'linux.q.inline-var': 'linux.env',
      'linux.q.loadavg': 'linux.processes',
    };
    for (const [id, lesson] of Object.entries(items)) {
      expect(registry.quiz.has(id), id).toBe(true);
      const quiz = (registry.lessons.get(lesson) as Lesson).sections.find((s) => s.kind === 'quiz');
      expect(quiz && quiz.kind === 'quiz' && quiz.items.includes(id), `${id} in ${lesson}`).toBe(true);
    }
  });

  it('`man systemd.unit` opens the page with the start rate limit', async () => {
    const m = await createSimMachine({});
    const r = await m.exec('man systemd.unit');
    expect(r.out + JSON.stringify(r)).toMatch(/StartLimitBurst/);
  });
});
