// tfsim extensions: local modules, moved and import blocks, terraform import,
// plan/apply -refresh-only and -detailed-exitcode.

import { describe, expect, it } from 'vitest';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import { createSimMachine, SimMachine, stripAnsi } from '../src/engine/terminal/shell';
import { terraformCommand } from '../src/blocks/iac/tf/command';
import { eduCommand, tfFactsProvider, tfSetupHook, tfDir, type TfFacts } from '../src/blocks/iac/tf/edu';

const reg = createTerminalRegistry();
for (const c of [...BUILTINS, ...BASIC_COMMANDS, terraformCommand, eduCommand]) reg.commands.add(c);
reg.facts.push(tfFactsProvider);
reg.setup.push(tfSetupHook);

const HEAD = 'terraform {\n  required_providers {\n    edu = { source = "edu/edu", version = "~> 1.4" }\n  }\n}\n\nprovider "edu" {}\n\nresource "edu_network" "main" {\n  name = "cafe"\n  cidr = "10.0.0.0/16"\n}\n';
const VM_FLAT = '\nresource "edu_vm" "web" {\n  name       = "web"\n  image      = "ubuntu-24.04"\n  cores      = 2\n  network_id = edu_network.main.id\n}\n';
const MOD = 'variable "name" {\n  type = string\n}\n\nvariable "network_id" {\n  type = string\n}\n\nvariable "cores" {\n  type    = number\n  default = 2\n}\n\nlocals {\n  image = "ubuntu-24.04"\n}\n\nresource "edu_vm" "this" {\n  name       = var.name\n  image      = local.image\n  cores      = var.cores\n  network_id = var.network_id\n}\n\noutput "ip" {\n  value = edu_vm.this.public_ip\n}\n';
const CALLS = '\nmodule "web" {\n  source     = "./modules/vm"\n  name       = "web"\n  network_id = edu_network.main.id\n}\n\nmodule "api" {\n  source     = "./modules/vm"\n  name       = "api"\n  cores      = 4\n  network_id = edu_network.main.id\n}\n\nresource "edu_dns_record" "www" {\n  zone  = "site.edu"\n  name  = "www"\n  value = module.web.ip\n}\n';

const INFRA = '/home/learner/infra';
const mk = (main: string, mod = true) =>
  createSimMachine({ cwd: '~/infra', files: [{ path: `${INFRA}/main.tf`, content: main }, ...(mod ? [{ path: `${INFRA}/modules/vm/main.tf`, content: MOD }] : [])], ext: { tf: {} } }, { registry: reg });
const run = async (m: SimMachine, line: string) => {
  const r = await m.exec(line);
  return { ...r, out: stripAnsi(r.out) };
};
const write = (m: SimMachine, path: string, text: string) => m.rootFs.writeFile(path, text);
const facts = async (m: SimMachine) => (await m.facts()) as unknown as { tf: TfFacts };

describe('local modules', () => {
  it('init installs modules; plan addresses module resources; outputs flow out', async () => {
    const m = await mk(HEAD + CALLS);
    const early = await run(m, 'terraform plan');
    expect(early.exit).toBe(1);
    const init = await run(m, 'terraform init');
    expect(init.out).toContain('Initializing modules...');
    expect(init.out).toContain('- web in modules/vm');
    const p = await run(m, 'terraform plan');
    expect(p.exit).toBe(0);
    expect(p.out).toContain('# module.web.edu_vm.this will be created');
    expect(p.out).toContain('# module.api.edu_vm.this will be created');
    expect(p.out).toContain('Plan: 4 to add, 0 to change, 0 to destroy.');
    const a = await run(m, 'terraform apply -auto-approve');
    expect(a.out).toContain('Apply complete! Resources: 4 added');
    const f = await facts(m);
    const d = tfDir(f, INFRA)!;
    expect(d.state.map((s) => s.address).sort()).toEqual(['edu_dns_record.www', 'edu_network.main', 'module.api.edu_vm.this', 'module.web.edu_vm.this']);
    const web = f.tf.cloud.find((r) => r.attrs.name === 'web')!;
    const api = f.tf.cloud.find((r) => r.attrs.name === 'api')!;
    expect(api.attrs.cores).toBe(4);
    expect(f.tf.cloud.find((r) => r.type === 'edu_dns_record')!.attrs.value).toBe(web.attrs.public_ip);
    expect((await run(m, 'terraform plan')).out).toContain('No changes.');
    expect((await run(m, 'terraform state list')).out).toContain('module.web.edu_vm.this');
  });

  it('reports a missing module argument and an unknown output', async () => {
    const m = await mk(HEAD + '\nmodule "web" {\n  source = "./modules/vm"\n  name   = "web"\n}\n\noutput "x" {\n  value = module.web.nope\n}\n');
    await run(m, 'terraform init');
    const r = await run(m, 'terraform validate');
    expect(r.exit).toBe(1);
    expect(r.out).toContain('The argument "network_id" is required');
    expect(r.out).toContain('Unsupported attribute');
  });
});

describe('moved and import', () => {
  it('moving a resource into a module without moved recreates it, with moved it does not', async () => {
    const m = await mk(HEAD + VM_FLAT);
    await run(m, 'terraform init');
    await run(m, 'terraform apply -auto-approve');
    const id = (await facts(m)).tf.cloud.find((r) => r.type === 'edu_vm')!.id;
    write(m, `${INFRA}/main.tf`, HEAD + '\nmodule "web" {\n  source     = "./modules/vm"\n  name       = "web"\n  network_id = edu_network.main.id\n}\n');
    await run(m, 'terraform init');
    const bad = await run(m, 'terraform plan');
    expect(bad.out).toContain('# edu_vm.web will be destroyed');
    expect(bad.out).toContain('# module.web.edu_vm.this will be created');
    write(m, `${INFRA}/moved.tf`, 'moved {\n  from = edu_vm.web\n  to   = module.web.edu_vm.this\n}\n');
    const good = await run(m, 'terraform plan');
    expect(good.out).toContain('# edu_vm.web has moved to module.web.edu_vm.this');
    expect(good.out).toContain('Plan: 0 to add, 0 to change, 0 to destroy.');
    await run(m, 'terraform apply -auto-approve');
    const f = await facts(m);
    expect(f.tf.cloud.find((r) => r.type === 'edu_vm')!.id).toBe(id);
    expect(tfDir(f, INFRA)!.state.some((s) => s.address === 'module.web.edu_vm.this' && s.id === id)).toBe(true);
    expect((await run(m, 'terraform plan')).out).toContain('No changes.');
  });

  it('an import block brings a hand-made VM under management', async () => {
    const m = await mk(HEAD, false);
    await run(m, 'terraform init');
    await run(m, 'terraform apply -auto-approve');
    const net = (await facts(m)).tf.cloud.find((r) => r.type === 'edu_network')!.id;
    // Someone creates a VM by hand through the API of the console.
    m.rootFs.writeFile('/tmp/x', '');
    const { Cloud } = await import('../src/blocks/iac/tf/cloud');
    const vm = new Cloud(m.rootFs).create('edu_vm', { name: 'legacy', image: 'debian-13', cores: 1, memory_gb: 2, zone: 'edu-central-1a', network_id: net, labels: {} }, 'console', 'ops-2');
    write(m, `${INFRA}/main.tf`, HEAD + `\nimport {\n  to = edu_vm.legacy\n  id = "${vm.id}"\n}\n\nresource "edu_vm" "legacy" {\n  name       = "legacy"\n  image      = "debian-13"\n  cores      = 1\n  network_id = edu_network.main.id\n}\n`);
    const p = await run(m, 'terraform plan');
    expect(p.out).toContain('# edu_vm.legacy will be imported');
    expect(p.out).toContain('Plan: 1 to import, 0 to add, 0 to change, 0 to destroy.');
    const a = await run(m, 'terraform apply -auto-approve');
    expect(a.out).toContain(`edu_vm.legacy: Importing... [id=${vm.id}]`);
    expect(a.out).toContain('Resources: 1 imported, 0 added');
    expect(tfDir(await facts(m), INFRA)!.state.some((s) => s.address === 'edu_vm.legacy' && s.id === vm.id)).toBe(true);
    expect((await run(m, 'terraform plan')).out).toContain('No changes.');
  });

  it('terraform import ADDR ID, and a wrong ID', async () => {
    const m = await mk(HEAD, false);
    await run(m, 'terraform init');
    await run(m, 'terraform apply -auto-approve');
    const net = (await facts(m)).tf.cloud.find((r) => r.type === 'edu_network')!.id;
    const { Cloud } = await import('../src/blocks/iac/tf/cloud');
    const rec = new Cloud(m.rootFs).create('edu_dns_record', { zone: 'site.edu', name: 'shop', type: 'A', ttl: 300, value: '203.0.113.7' }, 'console', 'ops-2');
    void net;
    write(m, `${INFRA}/main.tf`, HEAD + '\nresource "edu_dns_record" "shop" {\n  zone  = "site.edu"\n  name  = "shop"\n  value = "203.0.113.7"\n}\n');
    expect((await run(m, 'terraform import edu_dns_record.shop dns-0000')).exit).toBe(1);
    const r = await run(m, `terraform import edu_dns_record.shop ${rec.id}`);
    expect(r.out).toContain('Import successful!');
    expect((await run(m, 'terraform plan')).out).toContain('No changes.');
    expect((await run(m, `terraform import edu_dns_record.shop ${rec.id}`)).out).toContain('already managed');
  });
});

describe('refresh-only and detailed exit codes', () => {
  it('drift: -detailed-exitcode, refresh-only plan and apply', async () => {
    const m = await mk(HEAD + VM_FLAT, false);
    await run(m, 'terraform init');
    await run(m, 'terraform apply -auto-approve');
    expect((await run(m, 'terraform plan -detailed-exitcode')).exit).toBe(0);
    const id = (await facts(m)).tf.cloud.find((r) => r.type === 'edu_vm')!.id;
    await run(m, `edu vm update ${id} --cores 4`);
    const d = await run(m, 'terraform plan -detailed-exitcode');
    expect(d.exit).toBe(2);
    const ro = await run(m, 'terraform plan -refresh-only');
    expect(ro.out).toContain('Objects have changed outside of Terraform');
    expect(ro.out).toContain('This is a refresh-only plan');
    expect(ro.out).not.toContain('Plan:');
    const ap = await run(m, 'terraform apply -refresh-only -auto-approve');
    expect(ap.exit).toBe(0);
    const st = tfDir(await facts(m), INFRA)!.state.find((s) => s.address === 'edu_vm.web')!;
    expect(st.attrs.cores).toBe(4);
    expect((await facts(m)).tf.cloud.find((r) => r.id === id)!.attrs.cores).toBe(4);
    // The code still says 2: an ordinary plan proposes to bring the cloud back.
    expect((await run(m, 'terraform plan')).out).toContain('cores      = 4 -> 2');
  });
});
