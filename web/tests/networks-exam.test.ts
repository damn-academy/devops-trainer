// The block exam of Networks: the office topology works as described, every
// exam task fails at the start and passes after a reference solution, the
// tempting shortcuts are caught by targeted explanations, and the DL5 tasks
// carry no hints.

import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { registry } from '../src/core/registry';
import type { ExamTask, Task, TerminalSetup } from '../src/core/types';
import { buildPreset } from '../src/engine/sim-net/presets';
import { icmpEcho, tcpConnect } from '../src/engine/sim-net/world';
import { createSimMachine, stripAnsi, type SimMachine } from '../src/engine/terminal/shell';

const exam = registry.exams.get('networks.exam.office')!;
const task = (id: string) => {
  const t = exam.tasks.find((x) => x.id === id) as ExamTask & { kind: 'task'; setup: TerminalSetup; task: Task };
  if (!t || t.kind !== 'task') throw new Error(`no task ${id}`);
  return t;
};

const FIREWALL = [
  'iptables -A INPUT -i lo -j ACCEPT',
  'iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT',
  'iptables -A INPUT -s 10.20.0.0/24 -p tcp --dport 22 -j ACCEPT',
  'iptables -P INPUT DROP',
  'iptables -A FORWARD -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT',
  'iptables -A FORWARD -i eth0 -o eth2 -j ACCEPT',
  'iptables -A FORWARD -i eth1 -o eth2 -j ACCEPT',
  'iptables -A FORWARD -i eth0 -o eth1 -p tcp --dport 443 -j ACCEPT',
  'iptables -A FORWARD -i eth0 -o eth1 -p udp -d 10.20.1.2 --dport 53 -j ACCEPT',
  'iptables -A FORWARD -i eth2 -o eth1 -p tcp -d 10.20.1.10 --dport 443 -j ACCEPT',
  'iptables -P FORWARD DROP',
];

const SOLUTIONS: Record<string, string[]> = {
  forward: ['sysctl -w net.ipv4.ip_forward=1'],
  internet: ['iptables -t nat -A POSTROUTING -s 10.20.0.0/23 -o eth2 -j MASQUERADE'],
  publish: ['iptables -t nat -A PREROUTING -i eth2 -p tcp --dport 443 -j DNAT --to-destination 10.20.1.10:443'],
  firewall: FIREWALL,
  'fault-est': ['iptables -S FORWARD', 'iptables -I FORWARD 1 -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT', 'echo L4 > ~/layer.txt'],
  'fault-dnat': ['iptables -t nat -S PREROUTING', 'iptables -t nat -F PREROUTING', 'iptables -t nat -A PREROUTING -i eth2 -p tcp --dport 443 -j DNAT --to-destination 10.20.1.10:443', 'echo L4 > ~/layer.txt'],
  'fault-route': ['ping -c 1 198.51.100.80', 'ip route add default via 203.0.113.1', 'echo L3 > ~/layer.txt'],
  'fault-dns': ['ping -c 1 app', 'echo "search corp.lab" >> /etc/resolv.conf', 'echo DNS > ~/layer.txt'],
  'dl5-neigh': ['ip neigh', '__NEIGH__'],
  'dl5-mtu': ['ip link set dev eth2 mtu 1492'],
  'dl5-reject': ['iptables -I FORWARD 1 -i eth0 -o eth1 -p tcp --dport 8080 -j REJECT --reject-with tcp-reset'],
};

async function run(m: SimMachine, lines: string[]): Promise<string> {
  let out = '';
  for (const l0 of lines) {
    let l = l0;
    if (l === '__NEIGH__') {
      const n = ((await m.facts()).net as { neigh: { ip: string; mac: string }[] }).neigh.find((x) => x.ip === '203.0.113.1');
      l = `ip neigh replace 203.0.113.1 lladdr ${n?.mac} dev eth2 nud permanent`;
    }
    out += stripAnsi((await m.exec(l)).out);
  }
  return out;
}

describe('the office topology', () => {
  it('starts unconfigured: the office cannot reach the server room', () => {
    const w = buildPreset('office').world;
    expect(icmpEcho(w, 'laptop', '10.20.1.10').ok).toBe(false);
  });
  it('configured: the office reaches the portal, the internet reaches the portal, 8080 is closed from the office', () => {
    const w = buildPreset('office', { configured: true }).world;
    expect(icmpEcho(w, 'laptop', '198.51.100.80').ok).toBe(true);
    expect(tcpConnect(w, 'ext', '203.0.113.10', 443).ok).toBe(true);
    expect(tcpConnect(w, 'laptop', '10.20.1.10', 8080, { timeoutMs: 3000 }).ok).toBe(false);
    expect(tcpConnect(w, 'ext', '203.0.113.10', 22, { timeoutMs: 3000 }).ok).toBe(false);
    expect(tcpConnect(w, 'laptop', '10.20.0.1', 22).ok).toBe(true);
  });
});

describe('the networks block exam', () => {
  it('is registered and wired to the block', () => {
    expect(registry.blocks.get('networks')!.exam).toBe(exam.id);
    expect(exam.tasks.filter((t) => t.pool === 'fault-a').length).toBe(2);
    expect(exam.tasks.filter((t) => t.pool === 'fault-b').length).toBe(2);
  });

  it('has DL5 tasks beyond the course, without hints', () => {
    const dl5 = exam.tasks.filter((t) => t.kind === 'task' && t.task.docStep === 5);
    expect(dl5.length).toBeGreaterThanOrEqual(3);
    for (const t of dl5) {
      if (t.kind !== 'task') continue;
      expect(t.beyond).toBe(true);
      expect(t.task.hints).toBeUndefined();
      expect(t.task.solutionTokens?.length).toBeGreaterThan(0);
    }
  });

  for (const id of Object.keys(SOLUTIONS)) {
    it(`task ${id} fails at the start and passes after the reference solution`, async () => {
      const t = task(id);
      const m = await createSimMachine(t.setup);
      const start = await m.facts();
      expect(evaluateCheck(t.task.check, start, start).pass, `${id} passes before anything was done`).toBe(false);
      const out = await run(m, SOLUTIONS[id]);
      const r = evaluateCheck(t.task.check, await m.facts(), start);
      expect(r.pass, `${id} did not pass:\n${out}\n${JSON.stringify((await m.facts()).reach)}`).toBe(true);
    });
  }

  it('switching the firewall off does not fix the broken established rule', async () => {
    const t = task('fault-est');
    const m = await createSimMachine(t.setup);
    await run(m, ['iptables -P FORWARD ACCEPT', 'echo L4 > ~/layer.txt']);
    const r = evaluateCheck(t.task.check, await m.facts());
    expect(r.pass).toBe(false);
    expect(r.say?.en).toMatch(/must stay DROP/);
  });

  it('a firewall without the established rule is explained', async () => {
    const t = task('firewall');
    const m = await createSimMachine(t.setup);
    await run(m, FIREWALL.filter((l) => !(l.includes('FORWARD') && l.includes('ESTABLISHED'))));
    const r = evaluateCheck(t.task.check, await m.facts());
    expect(r.pass).toBe(false);
    expect(r.say?.en).toMatch(/reply traffic/);
  });

  it('/etc/hosts does not count as a fix for name resolution', async () => {
    const t = task('fault-dns');
    const m = await createSimMachine(t.setup);
    await run(m, ['echo "10.20.1.10 app" >> /etc/hosts', 'echo DNS > ~/layer.txt']);
    expect(evaluateCheck(t.task.check, await m.facts()).pass).toBe(false);
  });

  it('a plain REJECT is told apart from a TCP reset', async () => {
    const t = task('dl5-reject');
    const m = await createSimMachine(t.setup);
    await run(m, ['iptables -I FORWARD 1 -i eth0 -o eth1 -p tcp --dport 8080 -j REJECT']);
    const r = evaluateCheck(t.task.check, await m.facts());
    expect(r.pass).toBe(false);
    expect(r.say?.en).toMatch(/TCP connection itself/);
  });
});
