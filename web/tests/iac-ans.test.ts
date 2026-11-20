import { describe, expect, it } from 'vitest';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import { createSimMachine, SimMachine, stripAnsi } from '../src/engine/terminal/shell';
import { ansibleCommands, ansFactsProvider, ansSetupHook, hostFact, lastRun } from '../src/blocks/iac/ans/command';
import { evalWhen, renderText } from '../src/blocks/iac/ans/jinja';
import { matchHosts, parseInventory } from '../src/blocks/iac/ans/engine';

const reg = createTerminalRegistry();
for (const c of [...BUILTINS, ...BASIC_COMMANDS, ...ansibleCommands]) reg.commands.add(c);
reg.facts.push(ansFactsProvider);
reg.setup.push(ansSetupHook);

const INV = '[web]\nweb1\nweb2\n\n[db]\ndb1\n\n[web:vars]\nhttp_port=8080\n';
const PLAY = `- name: Configure web servers
  hosts: web
  become: true
  tasks:
    - name: Install nginx
      ansible.builtin.apt:
        name: nginx
        state: present

    - name: Put the site config
      ansible.builtin.template:
        src: site.conf.j2
        dest: /etc/nginx/sites-enabled/site.conf
      notify: Reload nginx

    - name: Nginx runs
      ansible.builtin.service:
        name: nginx
        state: started

  handlers:
    - name: Reload nginx
      ansible.builtin.service:
        name: nginx
        state: reloaded
`;

const mk = (extra: { path: string; content: string }[] = []) =>
  createSimMachine(
    {
      cwd: '~/ops',
      files: [
        { path: '/home/learner/ops/inventory.ini', content: INV },
        { path: '/home/learner/ops/ansible.cfg', content: '[defaults]\ninventory = ./inventory.ini\n' },
        { path: '/home/learner/ops/site.yml', content: PLAY },
        { path: '/home/learner/ops/templates/site.conf.j2', content: 'server {\n    listen {{ http_port }};\n    server_name {{ inventory_hostname }}.site.edu;\n{% if ansible_facts.os_family == "Debian" %}\n    root /var/www/html;\n{% endif %}\n}\n' },
        ...extra,
      ],
      ext: { ans: { hosts: [{ name: 'web1' }, { name: 'web2' }, { name: 'db1' }] } },
    },
    { registry: reg },
  );
const run = async (m: SimMachine, line: string) => {
  const r = await m.exec(line);
  return { ...r, out: stripAnsi(r.out) };
};

describe('jinja and inventory', () => {
  it('renders templates and conditions', () => {
    expect(renderText('{% for u in users %}{{ u | upper }}{% if not loop.last %},{% endif %}{% endfor %}', { users: ['a', 'b'] })).toBe('A,B');
    expect(renderText('port {{ port | default(80) }}', {})).toBe('port 80');
    expect(evalWhen("ansible_facts['os_family'] == 'Debian' and x is defined", { ansible_facts: { os_family: 'Debian' }, x: 1 })).toBe(true);
    expect(evalWhen('result.changed', { result: { changed: false } })).toBe(false);
  });
  it('parses INI and YAML inventories', () => {
    const inv = parseInventory(INV);
    expect(matchHosts(inv, 'all')).toEqual(['web1', 'web2', 'db1']);
    expect(matchHosts(inv, 'web:!web2')).toEqual(['web1']);
    const y = parseInventory('all:\n  children:\n    web:\n      hosts:\n        web1:\n          ansible_host: 10.0.0.11\n', 'hosts.yml');
    expect(matchHosts(y, 'web')).toEqual(['web1']);
  });
});

describe('ansible', () => {
  it('pings, runs a playbook idempotently, uses handlers', async () => {
    const m = await mk();
    const p = await run(m, 'ansible all -m ansible.builtin.ping');
    expect(p.out).toContain('web1 | SUCCESS => {');
    expect(p.out).toContain('"ping": "pong"');
    const r1 = await run(m, 'ansible-playbook site.yml');
    expect(r1.exit).toBe(0);
    expect(r1.out).toContain('TASK [Install nginx] ***');
    expect(r1.out).toContain('changed: [web1]');
    expect(r1.out).toContain('RUNNING HANDLER [Reload nginx]');
    expect(r1.out).toMatch(/web1\s+: ok=5\s+changed=3\s+unreachable=0\s+failed=0/);
    const f = await m.facts();
    expect(hostFact(f, 'web1')!.packages).toContain('nginx');
    expect(hostFact(f, 'web1')!.files['/etc/nginx/sites-enabled/site.conf']).toContain('listen 8080;');
    expect(hostFact(f, 'db1')!.packages).not.toContain('nginx');
    const r2 = await run(m, 'ansible-playbook site.yml');
    expect(r2.out).not.toContain('changed: [');
    expect(r2.out).not.toContain('RUNNING HANDLER');
    expect(r2.out).toMatch(/web1\s+: ok=4\s+changed=0/);
    const cat = await run(m, 'ansible web1 -a "cat /etc/nginx/sites-enabled/site.conf"');
    expect(cat.out).toContain('web1 | CHANGED | rc=0 >>');
    expect(cat.out).toContain('server_name web1.site.edu;');
  });

  it('check mode changes nothing; shell is never idempotent', async () => {
    const m = await mk([{ path: '/home/learner/ops/motd.yml', content: '- hosts: web1\n  gather_facts: false\n  tasks:\n    - name: Add a line\n      ansible.builtin.shell: echo "Managed by Ansible" >> /etc/motd\n' }]);
    const c = await run(m, 'ansible-playbook --check site.yml');
    expect(c.out).toContain('changed: [web1]');
    expect(hostFact(await m.facts(), 'web1')!.packages).not.toContain('nginx');
    expect(lastRun(await m.facts()).check).toBe(true);
    await run(m, 'ansible-playbook motd.yml');
    await run(m, 'ansible-playbook motd.yml');
    const motd = hostFact(await m.facts(), 'web1')!.files['/etc/motd'];
    expect(motd.match(/Managed by Ansible/g)!.length).toBe(2);
  });

  it('reports unreachable hosts and missing python', async () => {
    const m = await createSimMachine({ cwd: '~/ops', files: [{ path: '/home/learner/ops/inventory.ini', content: '[all]\nweb1\nweb3\nghost\n' }], ext: { ans: { hosts: [{ name: 'web1' }, { name: 'web3', python: false }] } } }, { registry: reg });
    const r = await run(m, 'ansible all -i inventory.ini -m ping');
    expect(r.out).toContain('web3 | FAILED!');
    expect(r.out).toContain('python3: not found');
    expect(r.out).toContain('ghost | UNREACHABLE!');
    expect(r.out).toContain('Could not resolve hostname ghost');
  });

  it('ansible-doc shows the module page', async () => {
    const m = await mk();
    const r = await m.exec('ansible-doc ansible.builtin.lineinfile');
    const text = r.out + ((r.effects ?? []).map((e) => (e.kind === 'pager' ? e.text : '')).join(''));
    expect(text).toContain('> MODULE ansible.builtin.lineinfile');
    expect(text).toContain('- create');
  });
});

it('templates task environment and does not leak it to the next task', async () => {
  const m = await mk([{ path: '/home/learner/ops/env.yml', content: `- hosts: web1
  vars:
    greeting: hello
  tasks:
    - shell: echo "$MESSAGE" > /tmp/greeting
      environment:
        MESSAGE: "{{ greeting }} world"
    - shell: echo "\${MESSAGE:-absent}" > /tmp/after
` }]);
  const result = await run(m, 'ansible-playbook env.yml');
  expect(result.exit, result.out).toBe(0);
  expect((await run(m, 'ansible web1 -a "cat /tmp/greeting"')).out).toContain('hello world');
  expect((await run(m, 'ansible web1 -a "cat /tmp/after"')).out).toContain('absent');
});
