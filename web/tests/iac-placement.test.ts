// The placement check of the IaC block: it follows the contract (01 §4), its
// questions are not the lesson questions again, and every practical task is
// solvable on the simulator while the obvious wrong way does not pass.

import { describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { evaluateCheck } from '../src/core/check';
import { lintPlacement } from '../src/engine/quiz/placement';
import type { Facts, PlacementTask, QuizItem } from '../src/core/types';
import { createSimMachine, type SimMachine } from '../src/engine/terminal/shell';

const OPS = '/home/learner/ops';
const INFRA = '/home/learner/infra';
const placement = () => registry.blocks.get('iac')!.placement;
const task = (id: string) => {
  const p = placement().find((x) => x.id === id)!;
  if (p.kind !== 'task') throw new Error('not a task');
  return p;
};
const write = (m: SimMachine, path: string, text: string) => {
  m.rootFs.writeFile(path, text);
  m.rootFs.chown(path, 1000, 1000);
};
async function sh(m: SimMachine, ...lines: string[]): Promise<string> {
  let out = '';
  for (const l of lines) out += (await m.exec(l)).out;
  return out;
}
const run = async (id: string, solve: (m: SimMachine) => Promise<void>) => {
  const p = task(id) as Extract<PlacementTask, { kind: 'task' }>;
  const m = await createSimMachine(p.setup);
  const start: Facts = await m.facts();
  await solve(m);
  return evaluateCheck(p.task.check, await m.facts(), start).pass;
};

describe('iac placement', () => {
  it('follows the placement contract', () => {
    expect(lintPlacement(placement())).toEqual([]);
  });

  it('asks its own questions, not the lesson ones', () => {
    const lessonPrompts = new Set(
      [...registry.lessons.values()]
        .filter((l) => l.block === 'iac')
        .flatMap((l) => l.sections.flatMap((s) => (s.kind === 'quiz' ? s.items : [])))
        .map((i) => (typeof i === 'string' ? (registry.quiz.get(i) as QuizItem | undefined) : i))
        .filter((i): i is QuizItem => !!i)
        .map((i) => i.prompt.ru),
    );
    for (const p of placement()) if (p.kind === 'quiz') expect(lessonPrompts.has(p.item.prompt.ru)).toBe(false);
  });

  it('ad-hoc chrony on db', async () => {
    expect(await run('iac.place.adhoc', async (m) => void (await sh(m, 'ansible db -m ansible.builtin.apt -a "name=chrony state=present"')))).toBe(true);
  });

  it('a dry run in check mode; a real run does not count', async () => {
    expect(await run('iac.place.dry-run', async (m) => void (await sh(m, 'ansible-playbook --check --diff site.yml')))).toBe(true);
    expect(await run('iac.place.dry-run', async (m) => void (await sh(m, 'ansible-playbook site.yml')))).toBe(false);
  });

  it('runs ready Terraform code', async () => {
    expect(await run('iac.place.tf-run', async (m) => void (await sh(m, 'terraform init', 'terraform apply -auto-approve')))).toBe(true);
    expect(await run('iac.place.tf-run', async (m) => void (await sh(m, 'terraform init', 'terraform plan')))).toBe(false);
  });

  it('adds a VM api', async () => {
    const ok = await run('iac.place.tf', async (m) => {
      write(m, `${INFRA}/main.tf`, (await sh(m, 'cat main.tf')) + '\nresource "edu_vm" "api" {\n  name       = "api"\n  image      = "ubuntu-24.04"\n  cores      = 2\n  network_id = edu_network.main.id\n}\n');
      await sh(m, 'terraform init', 'terraform apply -auto-approve');
    });
    expect(ok).toBe(true);
  });

  it('accepts the drift in the code; reverting it does not count', async () => {
    const ok = await run('iac.place.accept-drift', async (m) => {
      write(m, `${INFRA}/main.tf`, (await sh(m, 'cat main.tf')).replace(/cores\s*=\s*2/, 'cores      = 4'));
      await sh(m, 'terraform plan');
    });
    expect(ok).toBe(true);
    expect(await run('iac.place.accept-drift', async (m) => void (await sh(m, 'terraform apply -auto-approve', 'terraform plan')))).toBe(false);
  });

  it('adds a handler', async () => {
    const ok = await run('iac.place.handler', async (m) => {
      const play = (await sh(m, 'cat site.yml')).replace('dest: /etc/nginx/sites-enabled/cafe.conf\n', 'dest: /etc/nginx/sites-enabled/cafe.conf\n      notify: Reload nginx\n');
      write(m, `${OPS}/site.yml`, play + '\n  handlers:\n    - name: Reload nginx\n      ansible.builtin.service:\n        name: nginx\n        state: reloaded\n');
      await sh(m, 'ansible-playbook site.yml');
    });
    expect(ok).toBe(true);
    expect(await run('iac.place.handler', async (m) => void (await sh(m, 'ansible-playbook site.yml')))).toBe(false);
  });

  it('adopts the hand-made VM; a duplicate does not count', async () => {
    const legacy = '\nresource "edu_vm" "legacy" {\n  name       = "legacy"\n  image      = "debian-13"\n  cores      = 1\n  network_id = edu_network.main.id\n}\n';
    const ok = await run('iac.place.adopt', async (m) => {
      const id = /^(vm-\w+)\s+legacy/m.exec(await sh(m, 'edu vm list'))![1];
      write(m, `${INFRA}/main.tf`, (await sh(m, 'cat main.tf')) + `\nimport {\n  to = edu_vm.legacy\n  id = "${id}"\n}\n` + legacy);
      await sh(m, 'terraform apply -auto-approve', 'terraform plan');
    });
    expect(ok).toBe(true);
    const dup = await run('iac.place.adopt', async (m) => {
      write(m, `${INFRA}/main.tf`, (await sh(m, 'cat main.tf')) + legacy);
      await sh(m, 'terraform apply -auto-approve', 'terraform plan');
    });
    expect(dup).toBe(false);
  });
});
