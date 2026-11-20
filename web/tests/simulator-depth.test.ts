import { PROC_COMMANDS } from '../src/engine/terminal/commands/procs';
import { TEXT_COMMANDS } from '../src/engine/terminal/commands/text';
import { describe, expect, it } from 'vitest';
import { createSimMachine, stripAnsi } from '../src/engine/terminal/shell';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import { SYSTEM_COMMANDS } from '../src/engine/terminal/commands/system';
import { SYSTEMD_COMMANDS } from '../src/engine/terminal/commands/sysd';
import netModule from '../src/engine/sim-net/module';
import { netOf } from '../src/engine/sim-net/state';
import { icmpEcho } from '../src/engine/sim-net/world';
import { GoalSources } from '../src/engine/terminal/goal-sources';
import { parseHcl } from '../src/blocks/iac/tf/hcl';
import { evaluate } from '../src/blocks/iac/tf/engine';

const registry = createTerminalRegistry();
for (const c of [...BUILTINS, ...BASIC_COMMANDS, ...SYSTEM_COMMANDS, ...SYSTEMD_COMMANDS, ...PROC_COMMANDS, ...TEXT_COMMANDS, ...(netModule.commands ?? [])]) registry.commands.add(c);
registry.setup.push(...(netModule.setup ?? []));
const machine = (preset = 'home') => createSimMachine({ user: 'root', ext: { net: { preset } } }, { registry });
const run = async (m: Awaited<ReturnType<typeof machine>>, line: string) => { const r = await m.exec(line); return { ...r, out: stripAnsi(r.out) }; };

describe('network command gaps', () => {
  it('scans nc ranges and lists, validates ports, and preserves single-port failures', async () => {
    const m = await machine();
    const result = await run(m, 'nc -zv -w 1 198.51.100.20 21-22,80 443');
    expect(result.exit).toBe(0);
    expect(result.out).toContain('22 port');
    expect(result.out).toContain('443 port');
    expect((await run(m, 'nc -z 198.51.100.20 21')).exit).toBe(1);
    expect((await run(m, 'nc -z 198.51.100.20 65536')).exit).toBe(1);
  });
  it('keeps sysctl and proc synchronized in both directions and across restore', async () => {
    const m = await machine();
    expect((await run(m, 'sysctl -w net.ipv4.ip_forward=1')).exit).toBe(0);
    expect((await run(m, 'cat /proc/sys/net/ipv4/ip_forward')).out).toBe('1\n');
    const snap = await m.snapshot();
    await run(m, 'echo 0 > /proc/sys/net/ipv4/ip_forward');
    expect((await run(m, 'sysctl -n net.ipv4.ip_forward')).out).toBe('0\n');
    await m.restore(snap);
    expect((await run(m, 'sysctl -n net.ipv4.ip_forward')).out).toBe('1\n');
  });
  it('reports real rule counters, resets them, and increases RTT with packet size', async () => {
    const m = await machine();
    await run(m, 'iptables -A OUTPUT -p icmp -j ACCEPT');
    await run(m, 'ping -c 2 198.51.100.20');
    expect((await run(m, 'iptables -nvL OUTPUT')).out).toMatch(/2\s+168\s+ACCEPT/);
    expect((await run(m, 'iptables-save -c')).out).toContain('[2:168] -A OUTPUT');
    expect((await run(m, 'iptables -nvL INPUT')).out).toContain('2 packets, 168 bytes');
    await run(m, 'iptables -Z OUTPUT');
    expect((await run(m, 'iptables -nvL OUTPUT')).out).toMatch(/0\s+0\s+ACCEPT/);
    const st = netOf(m);
    const small = icmpEcho(st.world, st.world.local, '198.51.100.20', { size: 56 });
    const large = icmpEcho(st.world, st.world.local, '198.51.100.20', { size: 1400 });
    expect(large.rtt).toBeGreaterThan(small.rtt);
  });
  it('runs remote SSH commands and sessions on remote files only', async () => {
    const m = await machine();
    expect((await run(m, 'ssh root@198.51.100.20 hostname')).out).toContain('web1.hosting.example');
    expect((await run(m, 'ssh root@198.51.100.20')).exit).toBe(0);
    await run(m, 'echo remote > /tmp/remote-proof');
    await run(m, 'exit');
    expect(m.rootFs.exists('/tmp/remote-proof')).toBe(false);
    expect((await run(m, 'ssh root@198.51.100.20 cat /tmp/remote-proof')).out).toBe('remote\n');
    expect((await run(m, 'ssh -p 21 root@198.51.100.20 hostname')).exit).toBe(255);
  });
  it('tests self-signed TLS and time exit status', async () => {
    const m = await machine();
    expect((await run(m, 'curl https://selfsigned.example/')).exit).toBe(60);
    expect((await run(m, 'curl -k https://selfsigned.example/')).out).toContain('self-signed site');
    const r = await run(m, 'time -p false');
    expect(r.exit).toBe(1);
    expect(r.out).toContain('real ');
  });
  it('dumps leases, tests without configuring, and shows DHCP lifetimes', async () => {
    const m = await machine();
    const st = netOf(m);
    const before = JSON.stringify(st.local.ifaces);
    expect((await run(m, 'dhcpcd -T eth0')).exit).toBe(0);
    expect(JSON.stringify(st.local.ifaces)).toBe(before);
    expect((await run(m, 'dhcpcd eth0')).exit).toBe(0);
    expect((await run(m, 'dhcpcd -U eth0')).out).toContain('dhcp_lease_time=');
    expect((await run(m, 'ip addr show dev eth0')).out).toMatch(/valid_lft \d+sec/);
  });
  it('reloads nginx through either alias', async () => {
    const m = await machine('proxy');
    const svc = netOf(m).local.services.find(s => s.nginx)!;
    expect(svc).toBeDefined();
    const conf = m.rootFs.readFile(svc.nginx!.conf) + '\n# reload proof\n';
    m.rootFs.writeFile(svc.nginx!.conf, conf);
    expect((await run(m, 'systemctl reload nginx')).exit).toBe(0);
    expect(svc.nginx!.loaded).toBe(conf);
    m.rootFs.writeFile(svc.nginx!.conf, conf + '# second\n');
    expect((await run(m, 'nginx -s reload')).exit).toBe(0);
    expect(svc.nginx!.loaded).toContain('# second');
    m.rootFs.writeFile(svc.nginx!.conf, conf + '# third\n');
    expect((await run(m, 'service nginx reload')).exit).toBe(0);
    expect(svc.nginx!.loaded).toContain('# third');
  });
});

describe('explicit goal sources', () => {
  it('isolates lessons, notifies subscribers, and removes disposed sources', async () => {
    const sources = new GoalSources();
    const m = await machine();
    const initial = await m.facts();
    let calls = 0;
    const unsubscribe = sources.subscribe('lesson', 'source', () => calls++);
    const dispose = sources.register('lesson', 'source', { facts: () => m.facts(), initial });
    expect(calls).toBe(1);
    expect(sources.get('other', 'source')).toBeUndefined();
    expect(sources.get('lesson', 'source')?.initial).toBe(initial);
    sources.changed('lesson', 'source');
    expect(calls).toBe(2);
    unsubscribe(); dispose();
    expect(sources.get('lesson', 'source')).toBeUndefined();
  });
});

it('parses braces and nested quotes inside interpolated for expressions and heredocs', () => {
  const source = 'output "x" {\n value = <<-EOT\n${join(",", [for x in ["}", "{"] : "${x}"])}\nEOT\n}\n';
  const blocks = parseHcl(source, 'main.tf');
  expect(evaluate(blocks[0].attrs[0].expr, { vars: {}, locals: new Map(), resources: () => undefined })).toBe('},{\n');
  expect(() => parseHcl('output "x" { value = "${var.x" }', 'bad.tf')).toThrow();
});

it('edits, saves and discards files in an interactive line editor', async () => {
  const m = await machine();
  await run(m, 'echo before > /tmp/edit-proof');
  await run(m, 'edit /tmp/edit-proof');
  await run(m, ':1 after');
  await run(m, ':wq');
  expect((await run(m, 'cat /tmp/edit-proof')).out).toBe('after\n');
  await run(m, 'edit /tmp/edit-proof');
  await run(m, ':1 discarded');
  await run(m, ':q!');
  expect((await run(m, 'cat /tmp/edit-proof')).out).toBe('after\n');
  await run(m, 'P=~/proof');
  expect((await run(m, 'echo "$P"')).out).toBe('/root/proof\n');
});

it('returns a real 404 for an unknown SimpleHTTP path', async () => {
  const m = await machine('tcp');
  const st = netOf(m);
  const host = Object.values(st.world.hosts).find(h => h.services.some(s => s.http?.server?.startsWith('SimpleHTTP')))!;
  const ip = host.ifaces.flatMap(i => i.addrs).find(a => !a.startsWith('127.'))!.split('/')[0];
  const result = await run(m, `curl -f http://${ip}:8080/missing`);
  expect(result.exit).toBe(22);
  const body = (await run(m, `curl http://${ip}:8080/missing`)).out;
  expect(body).toContain('<title>Error response</title>');
  expect(body).toContain('Message: File not found.');
});

it('shows pipeline readers in ps and allocates distinct thread IDs', async () => {
  const m = await machine();
  expect((await run(m, 'ps aux | grep grep')).out).toContain('grep grep');
  expect((await run(m, 'ps aux')).out).not.toContain('grep grep');
  await run(m, 'threads-demo 4 &');
  await run(m, 'threads-demo 3 &');
  const output = (await run(m, 'ps -eL -o tid')).out.trim().split('\n').slice(1).map(l => l.trim());
  expect(output.length).toBeGreaterThan(9);
  expect(new Set(output).size).toBe(output.length);
});

it('leaves an SSH session when the machine is restored', async () => {
  const m = await machine();
  const snap = await m.snapshot();
  await run(m, 'ssh root@198.51.100.20');
  await m.restore(snap);
  expect((await run(m, 'hostname')).out).not.toContain('web1.hosting.example');
});

it('supports quoted heredocs and multiple sed edits', async () => {
  const m = await machine();
  await run(m, "cat <<'EOF' > /tmp/script\n$HOME\nbefore\nEOF");
  expect((await run(m, 'cat /tmp/script')).out).toBe('$HOME\nbefore\n');
  await run(m, "sed -i -e 's/before/after/' -e '/HOME/d' /tmp/script");
  expect((await run(m, 'cat /tmp/script')).out).toBe('after\n');
  await run(m, "sed -i '$ a last' /tmp/script");
  expect((await run(m, 'cat /tmp/script')).out).toBe('after\nlast\n');
  await run(m, "printf 'a\\tb\\n' > /tmp/tabs");
  expect((await run(m, 'cat -A /tmp/tabs')).out).toBe('a^Ib$\n');
  expect((await run(m, 'cat -T /tmp/tabs')).out).toBe('a^Ib\n');
  expect((await run(m, 'cat -E /tmp/tabs')).out).toBe('a\tb$\n');
});

it('keeps free readable on narrow terminals and tabular in pipes', async () => {
  const m = await machine();
  m.cols = 36;
  const narrow = (await run(m, 'free -h')).out;
  expect(narrow).toContain('Mem:\n  total');
  expect(narrow.split('\n').every(l => l.length <= 36)).toBe(true);
  expect((await run(m, 'free -h | cat')).out).toMatch(/total +used +free/);
});
