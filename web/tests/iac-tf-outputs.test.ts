// terraform output -raw <name>, and an apply whose only change is a new
// output (both used by the "cluster from code" labs).
import { describe, expect, it } from 'vitest';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import { createSimMachine, SimMachine, stripAnsi } from '../src/engine/terminal/shell';
import { terraformCommand } from '../src/blocks/iac/tf/command';
import { eduCommand, tfFactsProvider, tfSetupHook } from '../src/blocks/iac/tf/edu';

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

resource "edu_network" "main" {
  name = "lab"
  cidr = "10.0.0.0/16"
}
`;
const OUTPUT = `
output "net_name" {
  value = edu_network.main.name
}
`;

const mk = () => createSimMachine({ cwd: '~/infra', files: [{ path: '/home/learner/infra/main.tf', content: MAIN }], ext: { tf: {} } }, { registry: reg });
const run = async (m: SimMachine, line: string) => {
  const r = await m.exec(line);
  return { ...r, out: stripAnsi(r.out) };
};

describe('terraform outputs', () => {
  it('an output-only change is planned, applied and saved to the state', async () => {
    const m = await mk();
    await run(m, 'terraform init');
    expect((await run(m, 'terraform apply -auto-approve')).out).toContain('1 added');
    m.rootFs.writeFile('/home/learner/infra/outputs.tf', OUTPUT);
    const p = await run(m, 'terraform plan -detailed-exitcode');
    expect(p.out).toContain('Changes to Outputs:');
    expect(p.out).toContain('+ net_name = "lab"');
    expect(p.out).not.toContain('No changes.');
    expect(p.exit).toBe(2);
    const a = await run(m, 'terraform apply -auto-approve');
    expect(a.out).toContain('Apply complete! Resources: 0 added, 0 changed, 0 destroyed.');
    expect(a.out).toContain('net_name = "lab"');
    expect((await run(m, 'terraform plan')).out).toContain('No changes.');
  });

  it('-raw prints the bare value of the named output', async () => {
    const m = await mk();
    m.rootFs.writeFile('/home/learner/infra/outputs.tf', OUTPUT);
    await run(m, 'terraform init');
    await run(m, 'terraform apply -auto-approve');
    const r = await run(m, 'terraform output -raw net_name');
    expect(r.exit).toBe(0);
    expect(r.out).toBe('lab');
    expect((await run(m, 'terraform output net_name')).out).toBe('"lab"\n');
  });
});
