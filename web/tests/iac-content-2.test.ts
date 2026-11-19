// Every new lab, forcing task and exam task of the IaC block is solvable on the
// simulator, and the obvious wrong way does not pass.

import { describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { evaluateCheck } from '../src/core/check';
import { lintRegistry } from '../src/core/lint';
import type { DocsSection, Exam, Facts, Lesson, Task, TerminalSection, TerminalSetup } from '../src/core/types';
import { createSimMachine, type SimMachine } from '../src/engine/terminal/shell';

function lab(lessonId: string, sectionId: string): { setup: TerminalSetup; tasks: Task[] } {
  const s = (registry.lessons.get(lessonId) as Lesson).sections.find((x) => x.id === sectionId)!;
  if (s.kind === 'terminal') return { setup: (s as TerminalSection).setup, tasks: (s as TerminalSection).tasks };
  const d = s as DocsSection;
  return { setup: d.terminal!.setup, tasks: [d.terminal!.task] };
}
const examTask = (id: string) => {
  const t = (registry.exams.get('iac.exam') as Exam).tasks.find((x) => x.id === id)!;
  if (t.kind !== 'task') throw new Error('not a task');
  return t;
};
const write = (m: SimMachine, path: string, text: string) => {
  const dir = path.slice(0, path.lastIndexOf('/'));
  if (!m.rootFs.exists(dir)) m.rootFs.mkdir(dir, { parents: true });
  m.rootFs.writeFile(path, text);
  m.rootFs.chown(path, 1000, 1000);
};
async function sh(m: SimMachine, ...lines: string[]): Promise<string> {
  let out = '';
  for (const l of lines) out += (await m.exec(l)).out;
  return out;
}
const check = async (m: SimMachine, t: Task, start: Facts) => evaluateCheck(t.check, await m.facts(), start);
const OPS = '/home/learner/ops';
const INFRA = '/home/learner/infra';
const ROLE_TASKS = '- name: nginx is installed\n  ansible.builtin.apt:\n    name: nginx\n    state: present\n\n- name: The site config is in place\n  ansible.builtin.template:\n    src: cafe.conf.j2\n    dest: /etc/nginx/sites-enabled/cafe.conf\n  notify: Reload nginx\n\n- name: nginx is running\n  ansible.builtin.service:\n    name: nginx\n    state: started\n';
const HANDLERS = '- name: Reload nginx\n  ansible.builtin.service:\n    name: nginx\n    state: reloaded\n';
const MOD = 'variable "name" {\n  type = string\n}\n\nvariable "network_id" {\n  type = string\n}\n\nvariable "cores" {\n  type    = number\n  default = 2\n}\n\nresource "edu_vm" "this" {\n  name       = var.name\n  image      = "ubuntu-24.04"\n  cores      = var.cores\n  network_id = var.network_id\n}\n\noutput "ip" {\n  value = edu_vm.this.public_ip\n}\n';

describe('roles lesson', () => {
  it('skeleton, move into the role, override from the inventory', async () => {
    const { setup, tasks } = lab('iac.roles', 'lab');
    const m = await createSimMachine(setup);
    const start = await m.facts();
    await sh(m, 'mkdir roles', 'cd roles && ansible-galaxy role init webserver', 'cd ~/ops');
    expect((await check(m, tasks[0], start)).pass).toBe(true);
    write(m, `${OPS}/roles/webserver/tasks/main.yml`, ROLE_TASKS);
    write(m, `${OPS}/roles/webserver/handlers/main.yml`, HANDLERS);
    write(m, `${OPS}/roles/webserver/templates/cafe.conf.j2`, await sh(m, 'cat templates/cafe.conf.j2'));
    write(m, `${OPS}/site.yml`, '- name: Web servers serve the cafe site\n  hosts: web\n  become: true\n  roles:\n    - webserver\n');
    await sh(m, 'ansible-playbook site.yml');
    const noDefault = await check(m, tasks[1], start);
    expect(noDefault.pass).toBe(false);
    expect(noDefault.say?.en).toContain('defaults/main.yml');
    write(m, `${OPS}/roles/webserver/defaults/main.yml`, '---\nhttp_port: 80\n');
    await sh(m, 'ansible-playbook site.yml');
    expect((await check(m, tasks[1], start)).pass).toBe(true);
    write(m, `${OPS}/group_vars/web.yml`, 'http_port: 8080\n');
    await sh(m, 'ansible-playbook site.yml');
    expect((await check(m, tasks[2], start)).pass).toBe(false);
    await sh(m, 'ansible-playbook site.yml');
    expect((await check(m, tasks[2], start)).pass).toBe(true);
  });
  it('the forcing task: --init-path', async () => {
    const { setup, tasks } = lab('iac.roles', 'forcing');
    const m = await createSimMachine(setup);
    const start = await m.facts();
    await sh(m, 'ansible-galaxy role init --init-path roles monitoring');
    expect((await check(m, tasks[0], start)).pass).toBe(true);
  });
});

describe('modules lesson', () => {
  it('a module call, then moving web into the module with moved', async () => {
    const { setup, tasks } = lab('iac.modules', 'lab');
    const m = await createSimMachine(setup);
    const start = await m.facts();
    write(m, `${INFRA}/modules/vm/main.tf`, MOD);
    const base = await sh(m, 'cat main.tf');
    write(m, `${INFRA}/main.tf`, base + '\nmodule "api" {\n  source     = "./modules/vm"\n  name       = "api"\n  network_id = edu_network.main.id\n}\n');
    await sh(m, 'terraform apply -auto-approve');
    expect((await check(m, tasks[0], start)).say?.en).toContain('terraform init');
    await sh(m, 'terraform init', 'terraform apply -auto-approve');
    expect((await check(m, tasks[0], start)).pass).toBe(true);
    const moved = base
      .replace(/\nresource "edu_vm" "web" \{[\s\S]*?\n\}\n/, '\nmodule "web" {\n  source     = "./modules/vm"\n  name       = "web"\n  network_id = edu_network.main.id\n}\n\nmoved {\n  from = edu_vm.web\n  to   = module.web.edu_vm.this\n}\n')
      .replace('edu_vm.web.public_ip', 'module.web.ip');
    write(m, `${INFRA}/main.tf`, moved + '\nmodule "api" {\n  source     = "./modules/vm"\n  name       = "api"\n  network_id = edu_network.main.id\n}\n');
    await sh(m, 'terraform init', 'terraform apply -auto-approve');
    expect((await check(m, tasks[1], start)).pass).toBe(true);
  });
  it('moving without moved recreates the VM and is told so', async () => {
    const { setup, tasks } = lab('iac.modules', 'lab');
    const m = await createSimMachine(setup);
    const start = await m.facts();
    write(m, `${INFRA}/modules/vm/main.tf`, MOD);
    const base = await sh(m, 'cat main.tf');
    write(m, `${INFRA}/main.tf`, base.replace(/\nresource "edu_vm" "web" \{[\s\S]*?\n\}\n/, '\nmodule "web" {\n  source     = "./modules/vm"\n  name       = "web"\n  network_id = edu_network.main.id\n}\n').replace('edu_vm.web.public_ip', 'module.web.ip'));
    await sh(m, 'terraform init', 'terraform apply -auto-approve');
    const r = await check(m, tasks[1], start);
    expect(r.pass).toBe(false);
    expect(r.say?.en).toContain('moved block');
  });
  it('the forcing task: state mv', async () => {
    const { setup, tasks } = lab('iac.modules', 'forcing');
    const m = await createSimMachine(setup);
    const start = await m.facts();
    write(m, `${INFRA}/main.tf`, (await sh(m, 'cat main.tf')).replace('"edu_dns_record" "www"', '"edu_dns_record" "site"'));
    await sh(m, 'terraform state mv edu_dns_record.www edu_dns_record.site', 'terraform plan');
    expect((await check(m, tasks[0], start)).pass).toBe(true);
  });
});

describe('import lesson', () => {
  it('adopts the hand-made VM with an import block', async () => {
    const { setup, tasks } = lab('iac.import', 'lab');
    const m = await createSimMachine(setup);
    const start = await m.facts();
    const id = /^(vm-\w+)\s+legacy/m.exec(await sh(m, 'edu vm list'))![1];
    write(m, `${INFRA}/main.tf`, (await sh(m, 'cat main.tf')) + `\nimport {\n  to = edu_vm.legacy\n  id = "${id}"\n}\n\nresource "edu_vm" "legacy" {\n  name       = "legacy"\n  image      = "debian-13"\n  cores      = 1\n  network_id = edu_network.main.id\n}\n`);
    const p = await sh(m, 'terraform plan');
    expect(p).toContain('1 to import, 0 to add, 0 to change, 0 to destroy');
    await sh(m, 'terraform apply -auto-approve', 'terraform plan');
    expect((await check(m, tasks[0], start)).pass).toBe(true);
  });
  it('without import apply makes a duplicate and is told so', async () => {
    const { setup, tasks } = lab('iac.import', 'lab');
    const m = await createSimMachine(setup);
    const start = await m.facts();
    write(m, `${INFRA}/main.tf`, (await sh(m, 'cat main.tf')) + '\nresource "edu_vm" "legacy" {\n  name       = "legacy"\n  image      = "debian-13"\n  cores      = 1\n  network_id = edu_network.main.id\n}\n');
    await sh(m, 'terraform apply -auto-approve');
    const r = await check(m, tasks[0], start);
    expect(r.pass).toBe(false);
    expect(r.say?.en).toContain('three VMs');
  });
  it('refresh-only records the drift; plain apply is told off', async () => {
    const { setup, tasks } = lab('iac.import', 'lab2');
    const m = await createSimMachine(setup);
    const start = await m.facts();
    await sh(m, 'terraform plan -refresh-only', 'terraform apply -refresh-only -auto-approve');
    expect((await check(m, tasks[0], start)).pass).toBe(true);
    const m2 = await createSimMachine(setup);
    await sh(m2, 'terraform apply -auto-approve');
    expect((await check(m2, tasks[0], start)).say).toBeDefined();
  });
  it('the forcing task: -detailed-exitcode', async () => {
    const { setup, tasks } = lab('iac.import', 'forcing');
    const m = await createSimMachine(setup);
    const start = await m.facts();
    await sh(m, 'terraform plan');
    expect((await check(m, tasks[0], start)).pass).toBe(false);
    await sh(m, 'terraform plan -detailed-exitcode');
    expect((await check(m, tasks[0], start)).pass).toBe(true);
  });
});

describe('iac exam', () => {
  it('role-port: fix the role vars and the shell task', async () => {
    const t = examTask('role-port');
    const m = await createSimMachine(t.setup);
    const start = await m.facts();
    await sh(m, 'ansible-playbook site.yml', 'ansible-playbook site.yml');
    expect((await check(m, t.task, start)).pass).toBe(false);
    write(m, `${OPS}/roles/webserver/vars/main.yml`, '---\n');
    write(m, `${OPS}/roles/webserver/defaults/main.yml`, 'http_port: 80\n');
    write(m, `${OPS}/roles/webserver/tasks/main.yml`, (await sh(m, 'cat roles/webserver/tasks/main.yml')).replace('  ansible.builtin.shell: echo "Managed by Ansible" >> /etc/motd\n', '  ansible.builtin.lineinfile:\n    path: /etc/motd\n    line: Managed by Ansible\n'));
    await sh(m, 'ansible-playbook site.yml', 'ansible-playbook site.yml');
    expect((await check(m, t.task, start)).pass).toBe(true);
  });
  it('api-vm', async () => {
    const t = examTask('api-vm');
    const m = await createSimMachine(t.setup);
    const start = await m.facts();
    write(m, `${INFRA}/main.tf`, (await sh(m, 'cat main.tf')) + '\nmodule "api" {\n  source     = "./modules/vm"\n  name       = "api"\n  cores      = 4\n  network_id = edu_network.main.id\n}\n\nresource "edu_dns_record" "api" {\n  zone  = "site.edu"\n  name  = "api"\n  value = module.api.ip\n}\n');
    await sh(m, 'terraform init', 'terraform apply -auto-approve');
    expect((await check(m, t.task, start)).pass).toBe(true);
  });
  it('adopt-dns', async () => {
    const t = examTask('adopt-dns');
    const m = await createSimMachine(t.setup);
    const start = await m.facts();
    const id = /^(dns-\w+)\s+shop/m.exec(await sh(m, 'edu dns list'))![1];
    write(m, `${INFRA}/main.tf`, (await sh(m, 'cat main.tf')) + `\nimport {\n  to = edu_dns_record.shop\n  id = "${id}"\n}\n\nresource "edu_dns_record" "shop" {\n  zone  = "site.edu"\n  name  = "shop"\n  value = "203.0.113.99"\n}\n`);
    await sh(m, 'terraform apply -auto-approve', 'terraform plan');
    expect((await check(m, t.task, start)).pass).toBe(true);
  });
  it('hand-over: state rm', async () => {
    const t = examTask('hand-over');
    const m = await createSimMachine(t.setup);
    const start = await m.facts();
    write(m, `${INFRA}/main.tf`, (await sh(m, 'cat main.tf')).replace(/\nmodule "web" \{[\s\S]*?\n\}\n/, '\n'));
    await sh(m, 'terraform plan');
    expect((await check(m, t.task, start)).pass).toBe(false);
    await sh(m, 'terraform state rm module.web.edu_vm.this', 'terraform plan');
    expect((await check(m, t.task, start)).pass).toBe(true);
  });
});

describe('iac lint', () => {
  it('no errors or warnings for the iac block', () => {
    const mine = lintRegistry(registry).filter((i) => /iac/.test(i.where) && !/k8s-3/.test(i.where));
    expect(mine.map((i) => `${i.level} ${i.where}: ${i.msg}`).join('\n')).toBe('');
  });
});
