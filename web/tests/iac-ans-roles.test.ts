// ansim extensions: roles (tasks, handlers, templates, defaults, vars, meta
// dependencies) and ansible-galaxy role init / list.

import { describe, expect, it } from 'vitest';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import { createSimMachine, SimMachine, stripAnsi } from '../src/engine/terminal/shell';
import { ansibleCommands, ansFactsProvider, ansSetupHook, hostFact, lastRun } from '../src/blocks/iac/ans/command';

const reg = createTerminalRegistry();
for (const c of [...BUILTINS, ...BASIC_COMMANDS, ...ansibleCommands]) reg.commands.add(c);
reg.facts.push(ansFactsProvider);
reg.setup.push(ansSetupHook);

const OPS = '/home/learner/ops';
const mk = (files: Record<string, string>) =>
  createSimMachine(
    {
      cwd: '~/ops',
      files: [{ path: `${OPS}/ansible.cfg`, content: '[defaults]\ninventory = ./inventory.ini\n' }, { path: `${OPS}/inventory.ini`, content: '[web]\nweb1\nweb2\n\n[db]\ndb1\n' }, ...Object.entries(files).map(([p, content]) => ({ path: `${OPS}/${p}`, content }))],
      ext: { ans: { hosts: [{ name: 'web1' }, { name: 'web2' }, { name: 'db1' }] } },
    },
    { registry: reg },
  );
const run = async (m: SimMachine, line: string) => {
  const r = await m.exec(line);
  return { ...r, out: stripAnsi(r.out) };
};

const ROLE = {
  'roles/webserver/tasks/main.yml': '- name: nginx is installed\n  ansible.builtin.apt:\n    name: nginx\n    state: present\n\n- name: The site config is in place\n  ansible.builtin.template:\n    src: site.conf.j2\n    dest: /etc/nginx/sites-enabled/site.conf\n  notify: Reload nginx\n',
  'roles/webserver/handlers/main.yml': '- name: Reload nginx\n  ansible.builtin.service:\n    name: nginx\n    state: reloaded\n',
  'roles/webserver/templates/site.conf.j2': 'server {\n    listen {{ http_port }};\n    root {{ site_root }};\n}\n',
  'roles/webserver/defaults/main.yml': 'http_port: 80\nsite_root: /var/www/site\n',
  'site.yml': '- name: Web\n  hosts: web\n  become: true\n  roles:\n    - webserver\n',
};

describe('roles', () => {
  it('runs role tasks with the role prefix, templates from the role, handlers, defaults', async () => {
    const m = await mk(ROLE);
    const r = await run(m, 'ansible-playbook site.yml');
    expect(r.exit).toBe(0);
    expect(r.out).toContain('TASK [webserver : nginx is installed]');
    expect(r.out).toContain('RUNNING HANDLER [webserver : Reload nginx]');
    const f = await m.facts();
    expect(hostFact(f, 'web1')!.files['/etc/nginx/sites-enabled/site.conf']).toContain('listen 80;');
    await run(m, 'ansible-playbook site.yml');
    expect(Object.values(lastRun(await m.facts())!.recap).every((x) => x.changed === 0)).toBe(true);
  });

  it('inventory beats role defaults; role vars beat inventory; -e beats all', async () => {
    const m = await mk({ ...ROLE, 'group_vars/web.yml': 'http_port: 8080\n' });
    await run(m, 'ansible-playbook site.yml');
    expect(hostFact(await m.facts(), 'web1')!.files['/etc/nginx/sites-enabled/site.conf']).toContain('listen 8080;');
    m.rootFs.mkdir(`${OPS}/roles/webserver/vars`, { parents: true });
    m.rootFs.writeFile(`${OPS}/roles/webserver/vars/main.yml`, 'http_port: 9090\n');
    await run(m, 'ansible-playbook site.yml');
    expect(hostFact(await m.facts(), 'web1')!.files['/etc/nginx/sites-enabled/site.conf']).toContain('listen 9090;');
    await run(m, 'ansible-playbook site.yml -e http_port=7000');
    expect(hostFact(await m.facts(), 'web2')!.files['/etc/nginx/sites-enabled/site.conf']).toContain('listen 7000;');
  });

  it('role params, meta dependencies and a missing role', async () => {
    const m = await mk({
      ...ROLE,
      'roles/common/tasks/main.yml': '- name: chrony is installed\n  ansible.builtin.apt:\n    name: chrony\n',
      'roles/webserver/meta/main.yml': 'dependencies:\n  - common\n',
      'site.yml': '- hosts: web\n  roles:\n    - role: webserver\n      vars:\n        http_port: 8181\n',
    });
    const r = await run(m, 'ansible-playbook site.yml');
    expect(r.out.indexOf('TASK [common : chrony is installed]')).toBeLessThan(r.out.indexOf('TASK [webserver : nginx is installed]'));
    const f = await m.facts();
    expect(hostFact(f, 'web1')!.packages).toContain('chrony');
    expect(hostFact(f, 'web1')!.files['/etc/nginx/sites-enabled/site.conf']).toContain('listen 8181;');
    m.rootFs.writeFile(`${OPS}/site.yml`, '- hosts: web\n  roles:\n    - nosuch\n');
    const bad = await run(m, 'ansible-playbook site.yml');
    expect(bad.exit).toBe(4);
    expect(bad.out).toContain("the role 'nosuch' was not found");
  });
});

describe('ansible-galaxy', () => {
  it('role init creates the skeleton; --init-path puts it elsewhere; list shows roles', async () => {
    const m = await mk({});
    expect((await run(m, 'ansible-galaxy role init webserver')).out).toBe('- Role webserver was created successfully\n');
    for (const p of ['tasks/main.yml', 'handlers/main.yml', 'defaults/main.yml', 'vars/main.yml', 'meta/main.yml', 'README.md']) expect(m.rootFs.exists(`${OPS}/webserver/${p}`), p).toBe(true);
    expect(m.rootFs.stat(`${OPS}/webserver/templates`)?.type).toBe('d');
    expect((await run(m, 'ansible-galaxy role init webserver')).exit).toBe(1);
    await run(m, 'ansible-galaxy init --init-path roles db');
    expect(m.rootFs.exists(`${OPS}/roles/db/tasks/main.yml`)).toBe(true);
    expect((await run(m, 'ansible-galaxy role list')).out).toContain('- db, (unknown version)');
    // An empty skeleton role runs and changes nothing.
    m.rootFs.writeFile(`${OPS}/site.yml`, '- hosts: db\n  roles:\n    - db\n');
    expect((await run(m, 'ansible-playbook site.yml')).exit).toBe(0);
    expect((await run(m, 'ansible-galaxy --help')).out).toContain('--init-path');
  });
});
