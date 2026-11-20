import { describe, expect, it } from 'vitest';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import { createSimMachine, SimMachine, stripAnsi } from '../src/engine/terminal/shell';
import { terraformCommand, formatHcl } from '../src/blocks/iac/tf/command';
import { eduCommand, tfFactsProvider, tfSetupHook, tfDir } from '../src/blocks/iac/tf/edu';
import { parseHcl, HclError } from '../src/blocks/iac/tf/hcl';
import { evaluate } from '../src/blocks/iac/tf/engine';

const reg = createTerminalRegistry();
for (const c of [...BUILTINS, ...BASIC_COMMANDS, terraformCommand, eduCommand]) reg.commands.add(c);
reg.facts.push(tfFactsProvider);
reg.setup.push(tfSetupHook);

const MAIN = `terraform {
  required_providers {
    edu = { source = "edu/edu", version = "~> 1.4" }
  }
}

provider "edu" {}

variable "cores" {
  type    = number
  default = 2
  validation {
    condition     = contains([1, 2, 4, 8], var.cores)
    error_message = "cores must be 1, 2, 4 or 8."
  }
}

resource "edu_network" "main" {
  name = "cafe"
  cidr = "10.0.0.0/16"
}

resource "edu_vm" "web" {
  name       = "web"
  image      = "ubuntu-24.04"
  cores      = var.cores
  network_id = edu_network.main.id
}

resource "edu_dns_record" "www" {
  zone  = "site.edu"
  name  = "www"
  value = edu_vm.web.public_ip
}

output "web_ip" {
  value = edu_vm.web.public_ip
}
`;

const mk = () => createSimMachine({ cwd: '~/infra', files: [{ path: '/home/learner/infra/main.tf', content: MAIN }], ext: { tf: {} } }, { registry: reg });
const run = async (m: SimMachine, line: string) => {
  const r = await m.exec(line);
  return { ...r, out: stripAnsi(r.out) };
};

describe('hcl', () => {
  it('parses blocks and expressions', () => {
    const b = parseHcl('resource "edu_vm" "web" {\n  name = "web-${var.env}"\n  cores = 2 * 2\n  tags = { a = 1 }\n}\n', 'main.tf');
    expect(b[0].labels).toEqual(['edu_vm', 'web']);
    const scope = { vars: { env: 'prod' }, locals: new Map(), resources: () => undefined };
    expect(evaluate(b[0].attrs[0].expr, scope)).toBe('web-prod');
    expect(evaluate(b[0].attrs[1].expr, scope)).toBe(4);
  });
  it('evaluates for expressions, heredoc interpolation and %{ for } directives', () => {
    const vms = [{ name: 'worker-1', public_ip: '1.1.1.1' }, { name: 'worker-2', public_ip: '2.2.2.2' }];
    const scope = { vars: {}, locals: new Map(), resources: (t: string, n: string) => (t === 'edu_vm' && n === 'worker' ? vms : undefined) };
    const src = [
      'output "a" {',
      '  value = join("\\n", [for w in edu_vm.worker : "${w.name} ansible_host=${w.public_ip}"])',
      '}',
      'output "b" {',
      '  value = <<-EOT',
      '    [workers]',
      '    %{ for w in edu_vm.worker ~}',
      '    ${w.name}',
      '    %{ endfor ~}',
      '    $${literal}',
      '    EOT',
      '}',
      'output "c" {',
      '  value = [for i, w in edu_vm.worker : i if w.name != "worker-1"]',
      '}',
      '',
    ].join('\n');
    const [a, b, c] = parseHcl(src, 'main.tf');
    expect(evaluate(a.attrs[0].expr, scope)).toBe('worker-1 ansible_host=1.1.1.1\nworker-2 ansible_host=2.2.2.2');
    expect(evaluate(b.attrs[0].expr, scope)).toBe('[workers]\nworker-1\nworker-2\n${literal}\n');
    expect(evaluate(c.attrs[0].expr, scope)).toEqual([1]);
  });
  it('reports a missing brace with the line', () => {
    try {
      parseHcl('resource "edu_vm" "web" {\n  name = "web"\n', 'main.tf');
      throw new Error('no error');
    } catch (e) {
      expect((e as HclError).diag.summary).toBe('Unclosed configuration block');
    }
  });
  it('cidrsubnet works like Terraform', () => {
    const b = parseHcl('locals {\n  a = cidrsubnet("10.0.0.0/16", 8, 2)\n}\n', 'x.tf');
    expect(evaluate(b[0].attrs[0].expr, { vars: {}, locals: new Map(), resources: () => undefined })).toBe('10.0.2.0/24');
  });
  it('fmt aligns equals', () => {
    expect(formatHcl('resource "edu_vm" "a" {\nname = "a"\n    image="x"\n}\n')).toBe('resource "edu_vm" "a" {\n  name  = "a"\n  image = "x"\n}\n');
  });
});

describe('terraform', () => {
  it('needs init, then plans, applies, detects drift and replaces', async () => {
    const m = await mk();
    expect((await run(m, 'terraform plan')).out).toContain('Inconsistent dependency lock file');
    expect((await run(m, 'terraform init')).out).toContain('Terraform has been successfully initialized!');
    const p = await run(m, 'terraform plan');
    expect(p.out).toContain('# edu_vm.web will be created');
    expect(p.out).toContain('+ public_ip  = (known after apply)');
    expect(p.out).toContain('Plan: 3 to add, 0 to change, 0 to destroy.');
    const noYes = await run(m, 'terraform apply');
    expect(noYes.exit).toBe(1);
    const a = await run(m, 'terraform apply -auto-approve');
    expect(a.out).toContain('Apply complete! Resources: 3 added, 0 changed, 0 destroyed.');
    expect(a.out).toMatch(/web_ip = "203\.0\.113\.\d+"/);
    expect((await run(m, 'terraform state list')).out).toBe('edu_dns_record.www\nedu_network.main\nedu_vm.web\n');
    expect((await run(m, 'terraform plan')).out).toContain('No changes.');
    // Drift: someone changes cores in the console.
    const id = tfDir(await m.facts(), '/home/learner/infra')!.state.find((s) => s.address === 'edu_vm.web')!.id;
    await run(m, `edu vm update ${id} --cores 4`);
    const d = await run(m, 'terraform plan');
    expect(d.out).toContain('Note: Objects have changed outside of Terraform');
    expect(d.out).toContain('~ cores      = 4 -> 2');
    expect(d.out).toContain('Plan: 0 to add, 1 to change, 0 to destroy.');
    // Force replacement by changing the image.
    m.rootFs.writeFile('/home/learner/infra/main.tf', MAIN.replace('ubuntu-24.04', 'debian-13'));
    const r = await run(m, 'terraform plan');
    expect(r.out).toContain('must be replaced');
    expect(r.out).toContain('# forces replacement');
    expect(r.out).toContain('Plan: 1 to add, 1 to change, 1 to destroy.');
    const ap = await run(m, 'echo yes | terraform apply');
    expect(ap.exit).toBe(0);
    expect((await run(m, 'terraform plan')).out).toContain('No changes.');
    // Validation and destroy.
    expect((await run(m, 'terraform plan -var cores=3')).out).toContain('cores must be 1, 2, 4 or 8.');
    const de = await run(m, 'terraform destroy -auto-approve');
    expect(de.out).toContain('Destroy complete! Resources: 3 destroyed.');
    expect((await m.facts()).tf).toMatchObject({ cloud: [] });
  });

  it('reports an undeclared reference with the source line', async () => {
    const m = await createSimMachine({ cwd: '~/infra', files: [{ path: '/home/learner/infra/main.tf', content: MAIN.replace('edu_network.main.id', 'edu_network.mian.id') }], ext: { tf: {} } }, { registry: reg });
    await run(m, 'terraform init');
    const r = await run(m, 'terraform validate');
    expect(r.out).toContain('Error: Reference to undeclared resource');
    expect(r.out).toContain('network_id = edu_network.mian.id');
  });
});
