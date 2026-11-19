// Every lab of the IaC block is solvable on the simulator.

import { describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { evaluateCheck } from '../src/core/check';
import type { DocsSection, Lesson, Task, TerminalSection, TerminalSetup } from '../src/core/types';
import { createSimMachine, type SimMachine } from '../src/engine/terminal/shell';

function lab(lessonId: string, sectionId: string): { setup: TerminalSetup; tasks: Task[] } {
  const s = (registry.lessons.get(lessonId) as Lesson).sections.find((x) => x.id === sectionId)!;
  if (s.kind === 'terminal') return { setup: (s as TerminalSection).setup, tasks: (s as TerminalSection).tasks };
  const d = s as DocsSection;
  return { setup: d.terminal!.setup, tasks: [d.terminal!.task] };
}
const write = (m: SimMachine, path: string, text: string) => {
  m.rootFs.writeFile(path, text);
  m.rootFs.chown(path, 1000, 1000);
};
async function sh(m: SimMachine, ...lines: string[]): Promise<string> {
  let out = '';
  for (const l of lines) out += (await m.exec(l)).out;
  return out;
}
const passes = async (m: SimMachine, t: Task) => evaluateCheck(t.check, await m.facts()).pass;
const OPS = '/home/learner/ops';
const INFRA = '/home/learner/infra';

describe('iac labs', () => {
  it('ansible intro', async () => {
    const { setup, tasks } = lab('iac.ansible-intro', 'lab');
    const m = await createSimMachine(setup);
    write(m, `${OPS}/inventory.ini`, '[web]\nweb1\nweb2\n\n[db]\ndb1\n');
    await sh(m, 'ansible all -m ansible.builtin.ping');
    expect(await passes(m, tasks[0])).toBe(true);
    await sh(m, 'ansible web -m ansible.builtin.apt -a "name=nginx state=present"', 'ansible web -m ansible.builtin.apt -a "name=nginx state=present"');
    expect(await passes(m, tasks[1])).toBe(true);
  });

  it('playbook lab', async () => {
    const { setup, tasks } = lab('iac.playbook', 'lab');
    const m = await createSimMachine(setup);
    await sh(m, 'ansible-playbook site.yml');
    expect(await passes(m, tasks[0])).toBe(true);
    await sh(m, 'ansible-playbook site.yml');
    expect(evaluateCheck(tasks[1].check, await m.facts()).say).toBeDefined();
    const play = (await sh(m, 'cat site.yml')).replace('      ansible.builtin.shell: echo "Managed by Ansible" >> /etc/motd\n', '      ansible.builtin.lineinfile:\n        path: /etc/motd\n        regexp: "^Managed by Ansible"\n        line: Managed by Ansible\n');
    write(m, `${OPS}/site.yml`, play);
    await sh(m, 'ansible-playbook site.yml', 'ansible-playbook site.yml');
    expect(await passes(m, tasks[1])).toBe(true);
    write(m, `${OPS}/templates/cafe.conf.j2`, (await sh(m, 'cat templates/cafe.conf.j2')).replace('/var/www/cafe;', '/var/www/cafe-v2;'));
    await sh(m, 'ansible-playbook --check --diff site.yml');
    expect(await passes(m, tasks[2])).toBe(true);
    const f = lab('iac.playbook', 'findopt');
    const m2 = await createSimMachine(f.setup);
    await sh(m2, 'ansible web -m ansible.builtin.lineinfile -a "path=/etc/cafe/owner line=owner=team-cafe create=true"');
    expect(await passes(m2, f.tasks[0])).toBe(true);
    const g = lab('iac.playbook', 'forcing');
    const m3 = await createSimMachine(g.setup);
    await sh(m3, 'ansible-playbook site.yml --start-at-task "nginx is running"');
    expect(await passes(m3, g.tasks[0])).toBe(true);
  });

  it('terraform lab', async () => {
    const { setup, tasks } = lab('iac.terraform', 'lab');
    const m = await createSimMachine(setup);
    await sh(m, 'terraform init', 'terraform plan', 'echo yes | terraform apply');
    expect(await passes(m, tasks[0])).toBe(true);
    const main = (await sh(m, 'cat main.tf')) + '\nresource "edu_dns_record" "www" {\n  zone  = "site.edu"\n  name  = "www"\n  value = edu_vm.web.public_ip\n}\n\noutput "site_ip" {\n  value = edu_vm.web.public_ip\n}\n';
    write(m, `${INFRA}/main.tf`, main);
    await sh(m, 'terraform apply -auto-approve');
    expect(await passes(m, tasks[1])).toBe(true);
  });

  it('state lab and the forcing task', async () => {
    const { setup, tasks } = lab('iac.state', 'lab');
    const m = await createSimMachine(setup);
    const id = /id\s+= "(vm-[0-9a-f]+)"/.exec(await sh(m, 'terraform state show edu_vm.web'))![1];
    await sh(m, `edu vm update ${id} --cores 4`, 'terraform plan');
    expect(await passes(m, tasks[0])).toBe(true);
    write(m, `${INFRA}/main.tf`, (await sh(m, 'cat main.tf')).replace('cores      = 2', 'cores      = 4'));
    await sh(m, 'terraform plan');
    expect(await passes(m, tasks[1])).toBe(true);
    write(m, `${INFRA}/main.tf`, (await sh(m, 'cat main.tf')).replace('image      = "ubuntu-24.04"', 'image      = "debian-13"').replace('  network_id = edu_network.main.id\n}', '  network_id = edu_network.main.id\n\n  lifecycle {\n    create_before_destroy = true\n  }\n}'));
    await sh(m, 'terraform apply -auto-approve');
    expect(await passes(m, tasks[2])).toBe(true);
    const f = lab('iac.state', 'forcing');
    const m2 = await createSimMachine(f.setup);
    await sh(m2, 'terraform apply -replace=edu_vm.web -auto-approve');
    expect(await passes(m2, f.tasks[0])).toBe(true);
  });
});
