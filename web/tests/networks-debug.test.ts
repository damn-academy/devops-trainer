// Integration with the whole build: the network commands are found on the
// PATH of every lab machine (the terminal engine resolves programs through
// stubs), and they are this engine's commands, not the terminal's fallbacks.

import { describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import netMod from '../src/engine/sim-net/module';
import { createSimMachine, stripAnsi } from '../src/engine/terminal/shell';

describe('netlab inside the full build', () => {
  it('owns its command names', () => {
    for (const c of netMod.commands ?? []) expect(registry.terminal.commands.get(c.name), c.name).toBe(c);
  });
  it('every network command resolves on a lab machine, nginx included', async () => {
    const m = await createSimMachine({ user: 'root', hostname: 'lb', ext: { net: { preset: 'proxy' } } });
    for (const c of netMod.commands ?? []) {
      const r = await m.exec(`${c.name} --help`);
      expect(stripAnsi(r.out), c.name).not.toContain('command not found');
    }
    const t = await m.exec('nginx -t');
    expect(stripAnsi(t.out)).toContain('test is successful');
  });
  it('works on a machine without a network lab (the Linux block’s machines)', async () => {
    const m = await createSimMachine({ hostname: 'trainer' });
    const r = await m.exec('ip -br a');
    expect(stripAnsi(r.out)).toMatch(/eth0\s+UP\s+10\.0\.2\.15\/24/);
  });
});
