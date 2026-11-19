// The real-Linux network labs (design 00 §6.13): probe commands and their
// parsers on recorded output of the lab image, the switch tap (capture, the
// .pcap format, loss and delay), the lab specs against the content contract
// (machines, probes, doc pages, both languages), the goals on recorded facts
// of solved and unsolved machines, and the in-browser exam's goals.

import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { compile } from '../src/core/predicate';
import { registry } from '../src/core/registry';
import type { Facts } from '../src/core/types';
import { examBrowser, examLab, reportTimeout, siteReadTimeout } from '../src/blocks/networks/reallab/exam-lab';
import { dnsmasqLab, firewallLab, LABS, netnsLab, routerLab, vlanLab } from '../src/blocks/networks/reallab/labs';
import { parseProbe, probeCommand, runProbes, type ProbeSpec } from '../src/blocks/networks/reallab/probes';
import { allLabs } from '../src/blocks/networks/reallab/registry';
import { factsFor, gather, type LabFactsAll, type NetLabSpec } from '../src/blocks/networks/reallab/spec';
import { frameLine, SwitchTap, toPcap } from '../src/blocks/networks/reallab/tap';
import { judgeReal } from '../src/app/real/facts';
import { L2Switch, macFromString } from '../src/engine/v86/switch';

const MARK = (rc: number) => `@@DT-PROBE rc=${rc}`;

describe('probes', () => {
  it('builds one shell line per kind, with the namespace and quoting', () => {
    expect(probeCommand({ id: 'p', kind: 'ping', from: 'a', to: '10.0.0.2' })).toMatch(/^ping -n -c 1 -W 3 '10\.0\.0\.2' 2>&1; echo "@@DT-PROBE rc=\$\?"$/);
    expect(probeCommand({ id: 'p', kind: 'tcp', from: 'a', to: '10.0.0.2', port: 22, ns: 'blue' })).toContain("ip netns exec 'blue' timeout 3 bash -c 'exec 3<>/dev/tcp/10.0.0.2/22'");
    const http = probeCommand({ id: 'p', kind: 'http', from: 'a', to: "https://x/'q", curl: ['--cacert', '/root/ca/ca.crt'] });
    expect(http).toContain("'--cacert' '/root/ca/ca.crt' 'https://x/'\\''q'");
    expect(http).toContain('@@DT-ERR');
    expect(probeCommand({ id: 'p', kind: 'dns', from: 'a', to: 'web.corp.lab', server: '10.0.0.1' })).toContain("dig +short +time=3 +tries=1 @'10.0.0.1' 'web.corp.lab'");
  });

  it('parses ping: answer with rtt, silence, unreachable', () => {
    const p: ProbeSpec = { id: 'p', kind: 'ping', from: 'a', to: 'b' };
    expect(parseProbe(p, `PING b (10.0.0.52) 56(84) bytes of data.\n64 bytes from 10.0.0.52: icmp_seq=1 ttl=64 time=1.84 ms\n\n--- b ping statistics ---\n1 packets transmitted, 1 received, 0% packet loss, time 0ms\n${MARK(0)}\n`)).toEqual({ kind: 'ping', ok: true, rtt: 1.84 });
    expect(parseProbe(p, `PING b (10.0.0.52) 56(84) bytes of data.\n\n--- b ping statistics ---\n1 packets transmitted, 0 received, 100% packet loss, time 0ms\n${MARK(1)}`).error).toBe('timeout');
    expect(parseProbe(p, `From 10.0.0.1 icmp_seq=1 Destination Host Unreachable\n${MARK(1)}`).error).toBe('unreachable');
  });

  it('parses tcp: connected, dropped (timeout), refused', () => {
    const p: ProbeSpec = { id: 'p', kind: 'tcp', from: 'a', to: '10.0.0.41', port: 22 };
    expect(parseProbe(p, MARK(0))).toEqual({ kind: 'tcp', ok: true, connected: true });
    expect(parseProbe(p, MARK(124))).toMatchObject({ connected: false, error: 'timeout' });
    expect(parseProbe(p, `bash: connect: Connection refused\nbash: line 1: /dev/tcp/10.0.0.41/9100: Connection refused\n${MARK(1)}`)).toMatchObject({ connected: false, error: 'refused' });
  });

  it('parses http: status and body, a redirect, a timeout, a TLS failure', () => {
    const p: ProbeSpec = { id: 'p', kind: 'http', from: 'a', to: 'http://10.0.0.20/' };
    expect(parseProbe(p, `200\n10.0.0.1\n@@DT-ERR\n${MARK(0)}`)).toEqual({ kind: 'http', ok: true, status: 200, body: '10.0.0.1' });
    expect(parseProbe(p, `301\n<html>\n<head><title>301 Moved Permanently</title></head>\n</html>\n@@DT-ERR\n${MARK(0)}`)).toMatchObject({ ok: true, status: 301 });
    expect(parseProbe(p, `000\n\n@@DT-ERR\ncurl: (28) Connection timed out after 5002 milliseconds\n${MARK(28)}`)).toMatchObject({ ok: false, status: 0, error: 'timeout' });
    expect(parseProbe(p, `000\n\n@@DT-ERR\ncurl: (60) SSL certificate problem: unable to get local issuer certificate\n${MARK(60)}`)).toMatchObject({ error: 'tls' });
    expect(parseProbe(p, `000\n\n@@DT-ERR\ncurl: (7) Failed to connect to 10.0.0.20 port 80 after 2 ms: Could not connect to server\n${MARK(7)}`)).toMatchObject({ error: 'refused' });
    expect(parseProbe(p, `504\n<html>504 Gateway Time-out</html>\n@@DT-ERR\n${MARK(0)}`)).toMatchObject({ ok: false, status: 504 });
  });

  it('parses dns answers and failures; cmd keeps the output', () => {
    const d: ProbeSpec = { id: 'p', kind: 'dns', from: 'pc', to: 'web.corp.lab', server: '10.0.0.1' };
    expect(parseProbe(d, `10.0.0.20\n${MARK(0)}`)).toMatchObject({ ok: true, answers: ['10.0.0.20'] });
    expect(parseProbe(d, MARK(0))).toMatchObject({ ok: false, answers: [], error: 'nxdomain' });
    expect(parseProbe(d, `;; communications error to 10.0.0.1#53: timed out\n;; no servers could be reached\n${MARK(9)}`)).toMatchObject({ ok: false, error: 'timeout' });
    expect(parseProbe({ id: 'c', kind: 'cmd', from: 'h', cmd: 'ip -n blue -br addr' }, `lo DOWN\nveth-blue@if3 UP 172.16.0.2/24\n${MARK(0)}`)).toMatchObject({ ok: true, exit: 0, out: 'lo DOWN\nveth-blue@if3 UP 172.16.0.2/24' });
  });

  it('runs probes per machine, in order, and survives a failing exec', async () => {
    const seen: string[] = [];
    const r = await runProbes(
      [
        { id: 'x', kind: 'ping', from: 'a', to: '1' },
        { id: 'y', kind: 'ping', from: 'a', to: '2' },
        { id: 'z', kind: 'ping', from: 'b', to: '3' },
      ],
      async (m, c) => {
        seen.push(`${m}:${/'(\d)'/.exec(c)![1]}`);
        if (m === 'b') throw new Error('machine gone');
        return { out: MARK(0), exit: 0 };
      },
    );
    expect(seen.filter((s) => s.startsWith('a'))).toEqual(['a:1', 'a:2']);
    expect(r.a.x.ok && r.a.y.ok).toBe(true);
    expect(r.b.z).toMatchObject({ ok: false, error: 'machine gone' });
  });
});

// ── the tap ──

function arpRequest(srcMac: string, srcIp: number[], dstIp: number[]): Uint8Array {
  const f = new Uint8Array(42);
  f.set(macFromString('ff:ff:ff:ff:ff:ff'), 0);
  f.set(macFromString(srcMac), 6);
  f.set([0x08, 0x06, 0, 1, 0x08, 0, 6, 4, 0, 1], 12);
  f.set(macFromString(srcMac), 22);
  f.set(srcIp, 28);
  f.set(dstIp, 38);
  return f;
}

describe('the switch tap', () => {
  const setup = () => {
    const sw = new L2Switch();
    const got: Record<string, Uint8Array[]> = { a: [], b: [] };
    sw.addPort('a', { mode: 'access', vlan: 1 }, (f) => got.a.push(f));
    sw.addPort('b', { mode: 'access', vlan: 1 }, (f) => got.b.push(f));
    return { sw, got };
  };

  it('records every frame entering the switch, decodes ARP, writes a valid pcap', () => {
    const { sw, got } = setup();
    let now = 1_700_000_000_123;
    const tap = new SwitchTap(sw, { now: () => now });
    const req = arpRequest('02:64:74:00:00:01', [10, 0, 0, 51], [10, 0, 0, 52]);
    sw.receive('a', req); // not capturing yet
    tap.start();
    sw.receive('a', req);
    now += 1500;
    sw.receive('a', req);
    expect(got.b.length).toBe(3);
    expect(tap.count).toBe(2);
    expect(tap.facts().arp).toEqual([
      { op: 'request', from: '10.0.0.51', ask: '10.0.0.52', port: 'a' },
      { op: 'request', from: '10.0.0.51', ask: '10.0.0.52', port: 'a' },
    ]);
    expect(frameLine(tap.frames()[0])).toBe('a 02:64:74:00:00:01 > ff:ff:ff:ff:ff:ff ARP who-has 10.0.0.52 tell 10.0.0.51');
    const pcap = toPcap(tap.frames());
    const v = new DataView(pcap.buffer);
    expect(v.getUint32(0, true)).toBe(0xa1b2c3d4);
    expect(v.getUint32(20, true)).toBe(1);
    expect(pcap.length).toBe(24 + 2 * (16 + 42));
    expect(v.getUint32(24, true)).toBe(1_700_000_000);
    expect(v.getUint32(28, true)).toBe(123_000);
    expect(v.getUint32(24 + 58 + 4, true)).toBe(623_000);
    expect([...pcap.subarray(40, 46)]).toEqual([255, 255, 255, 255, 255, 255]);
    tap.dispose();
    sw.receive('a', req);
    expect(tap.count).toBe(2);
  });

  it('keeps the newest frames when the ring is full', () => {
    const { sw } = setup();
    const tap = new SwitchTap(sw, { capacity: 3 });
    tap.start();
    for (let i = 1; i <= 5; i++) sw.receive('a', arpRequest('02:64:74:00:00:01', [10, 0, 0, i], [10, 0, 0, 99]));
    expect(tap.count).toBe(5);
    expect(tap.facts().arp.map((x) => x.from)).toEqual(['10.0.0.3', '10.0.0.4', '10.0.0.5']);
  });

  it('loses and delays frames per port', () => {
    const { sw, got } = setup();
    const later: [() => void, number][] = [];
    let dice = 0;
    const tap = new SwitchTap(sw, { random: () => [0.1, 0.5, 0.9][dice++ % 3], later: (fn, ms) => later.push([fn, ms]) });
    tap.setLine('a', { lossPct: 40 });
    for (let i = 0; i < 3; i++) sw.receive('a', arpRequest('02:64:74:00:00:01', [10, 0, 0, 1], [10, 0, 0, 2]));
    expect(got.b.length).toBe(2); // 10 < 40 lost; 50 and 90 pass
    tap.setLine('a', { lossPct: 0, delayMs: 150 });
    sw.receive('a', arpRequest('02:64:74:00:00:01', [10, 0, 0, 1], [10, 0, 0, 2]));
    expect(got.b.length).toBe(2);
    expect(later.map((l) => l[1])).toEqual([150]);
    later[0][0]();
    expect(got.b.length).toBe(3);
    expect(tap.facts().lines).toEqual({ a: { lossPct: 0, delayMs: 150 } });
    tap.setLine('a', { delayMs: 0 });
    expect(tap.facts().lines).toEqual({});
  });
});

// ── the lab specs against the contract ──

const bothLangs = (o: unknown, path: string, out: string[]) => {
  if (!o || typeof o !== 'object') return;
  const r = o as Record<string, unknown>;
  if (typeof r.ru === 'string' && typeof r.en === 'string') {
    if (!r.ru.trim() || !r.en.trim()) out.push(path);
    return;
  }
  for (const [k, v] of Object.entries(r)) if (typeof v === 'object') bothLangs(v, `${path}.${k}`, out);
};

describe('lab specs', () => {
  it.each(allLabs().map((l) => [l.id, l] as const))('%s: machines, probes, scopes, goals and doc pages fit together', (_id, lab: NetLabSpec) => {
    const names = new Set(lab.machines.map((m) => m.name));
    expect(names.size).toBe(lab.machines.length);
    expect(lab.machines.length).toBeLessThanOrEqual(4);
    const probeIds = new Set(lab.probes.map((p) => p.id));
    for (const p of lab.probes) expect(names.has(p.from), `${p.id} from ${p.from}`).toBe(true);
    for (const t of lab.tasks) {
      if (t.on) expect(names.has(t.on), `${t.id} on ${t.on}`).toBe(true);
      for (const p of t.probes ?? []) expect(probeIds.has(p), `${t.id} probe ${p}`).toBe(true);
      for (const m of Object.keys(t.scopes ?? {})) expect(names.has(m), `${t.id} scope machine ${m}`).toBe(true);
      if (typeof t.check.when === 'string') expect(() => compile(t.check.when as string)).not.toThrow();
      expect(t.check.when ?? t.check.stdout).toBeDefined();
      if (t.docRef?.page) {
        const page = registry.corpus.get(t.docRef.page);
        expect(page, `${t.id}: ${t.docRef.page}`).toBeTruthy();
        const sec = page!.sections.find((s) => s.id === t.docRef!.anchor);
        expect(sec, `${t.id}: ${t.docRef.page} § ${t.docRef.anchor}`).toBeTruthy();
        if (t.docRef.line) expect(sec!.body, `${t.id}: line ${t.docRef.line}`).toContain(t.docRef.line);
      }
      if (!t.beyond) expect(t.hints?.H1, `${t.id} has an H1 hint`).toBeTruthy();
    }
    const missing: string[] = [];
    bothLangs(lab, lab.id, missing);
    expect(missing).toEqual([]);
  });

  it('every lab is reachable from a lesson section, and the widget is registered', () => {
    expect(registry.widgets.has('net.reallab')).toBe(true);
    const used = [...registry.lessons.values()].flatMap((l) => l.sections.filter((s) => s.kind === 'widget' && s.widget === 'net.reallab').map((s) => (s as { props: { lab: string } }).props.lab));
    expect(new Set(used)).toEqual(new Set(Object.keys(LABS)));
    expect(registry.exams.get('networks.exam.browser')?.inTab).toEqual({ widget: 'net.reallab', props: { lab: examLab.id } });
  });
});

// ── goals on recorded facts ──

type IpAddr = { dev: string; family: 'inet'; addr: string; prefix: number; cidr: string };
const addr = (dev: string, cidr: string): IpAddr => ({ dev, family: 'inet', addr: cidr.split('/')[0], prefix: Number(cidr.split('/')[1]), cidr });
const machine = (o: Record<string, unknown>): Facts => ({ files: {}, procs: [], term: { main: [] }, ...o }) as unknown as Facts;
const netOf = (o: { addrs?: IpAddr[]; links?: unknown[]; routes?: unknown[]; forward?: number; netns?: string[] }) => ({ addrs: [], links: [], routes: [], forward: 0, netns: [], ...o });
const nft = (rules: string[]) => ({ nft: rules.map((rule) => ({ family: 'ip', table: 'nat', chain: 'postrouting', rule })), iptables: [], nftRaw: null });
const pass = (lab: NetLabSpec, id: string, all: LabFactsAll) => {
  const t = lab.tasks.find((x) => x.id === id)!;
  return evaluateCheck(t.check, factsFor(t, all)!);
};

describe('lab goals judge state', () => {
  it('vlan: sub-interfaces, the bridge, the ping across', () => {
    const sw = machine({ net: netOf({ links: [{ name: 'eth0.10', up: true, state: 'UP', kind: 'vlan', vlan: 10, master: 'br0' }, { name: 'eth0.20', up: true, state: 'UP', kind: 'vlan', vlan: 20, master: 'br0' }, { name: 'br0', up: true, state: 'UP', kind: 'bridge' }] }) });
    const down = machine({ net: netOf({ links: [{ name: 'eth0.10', up: false, state: 'DOWN', kind: 'vlan', vlan: 10 }] }) });
    expect(pass(vlanLab, 'vifs', { machines: { sw } }).pass).toBe(true);
    expect(pass(vlanLab, 'vifs', { machines: { sw: down } }).say?.en).toMatch(/down/);
    expect(pass(vlanLab, 'bridge', { machines: { sw } }).pass).toBe(true);
    expect(pass(vlanLab, 'ping', { machines: { sw, a: machine({ reach: { ab: { kind: 'ping', ok: true } } }) } }).pass).toBe(true);
    expect(pass(vlanLab, 'ping', { machines: { sw: machine({ net: netOf({}) }), a: machine({ reach: { ab: { kind: 'ping', ok: false } } }) } }).say?.en).toMatch(/no bridge/);
  });

  it('router: NAT is what makes srv see 10.0.0.1; without it the reply has no way back', () => {
    const gw = (rules: string[]) => machine({ net: netOf({ forward: 1 }), fw: nft(rules) });
    const pc = (body: string | null) => machine({ reach: { web: body === null ? { kind: 'http', ok: false, status: 0, error: 'timeout' } : { kind: 'http', ok: true, status: 200, body } } });
    expect(pass(routerLab, 'nat', { machines: { gw: gw(['oifname "eth0" masquerade']), pc: pc('10.0.0.1') } }).pass).toBe(true);
    expect(pass(routerLab, 'nat', { machines: { gw: gw([]), pc: pc(null) } }).say?.en).toMatch(/no route to the office/);
    expect(pass(routerLab, 'route-back', { machines: { gw: gw([]), pc: pc('192.168.10.10'), srv: machine({ net: netOf({ routes: [{ dst: '192.168.10.0/24', via: '10.0.0.1' }] }) }) } }).pass).toBe(true);
    const iptablesMasq = machine({ net: netOf({ forward: 1 }), fw: { nft: [], iptables: [{ table: 'nat', chain: 'POSTROUTING', rule: '-s 192.168.10.0/24 -o eth0 -j MASQUERADE' }] } });
    expect(pass(routerLab, 'route-back', { machines: { gw: iptablesMasq, pc: pc('10.0.0.1'), srv: machine({ net: netOf({}) }) } }).say?.en).toMatch(/still works/);
    expect(pass(routerLab, 'forward', { machines: { gw: gw([]) } }).pass).toBe(true);
  });

  it('netns: veth inside, the way out', () => {
    const host = machine({ net: netOf({ addrs: [addr('veth-host', '172.16.0.1/24')], netns: ['blue'], forward: 1 }), fw: nft(['ip saddr 172.16.0.0/24 oifname "eth0" masquerade']), reach: { nsping: { kind: 'ping', ok: true }, nsaddr: { kind: 'cmd', ok: true, out: 'veth-blue@if3 UP 172.16.0.2/24' }, nsweb: { kind: 'http', ok: true, status: 200, body: '10.0.0.31' } } });
    expect(pass(netnsLab, 'ns', { machines: { host } }).pass).toBe(true);
    expect(pass(netnsLab, 'veth', { machines: { host } }).pass).toBe(true);
    expect(pass(netnsLab, 'out', { machines: { host } }).pass).toBe(true);
    const bare = machine({ net: netOf({ addrs: [addr('veth-host', '172.16.0.1/24')] }), reach: { nsping: { kind: 'ping', ok: false }, nsaddr: { kind: 'cmd', ok: true, out: 'lo DOWN' } } });
    expect(pass(netnsLab, 'veth', { machines: { host: bare } }).say?.en).toMatch(/no 172\.16\.0\.2/);
  });

  it('firewall: drop with the site open, ssh only from admin, silence on 9100, saved', () => {
    const srv = machine({ fw: { nft: [{ family: 'inet', table: 'filter', chain: 'input', rule: 'chain input type filter hook input policy drop' }], iptables: [] }, files: { '/etc/nftables.nft': { type: 'f', text: 'table inet filter {\n chain input { type filter hook input priority 0; policy drop;\n ip saddr 10.0.0.42 tcp dport 22 accept } }' } }, svc: [{ name: 'nftables', state: 'started', runlevels: ['default'] }] });
    const client = machine({ reach: { web: { kind: 'http', ok: true, status: 200 }, ssh: { kind: 'tcp', ok: false, connected: false, error: 'timeout' }, metrics: { kind: 'tcp', ok: false, connected: false, error: 'timeout' }, ping: { kind: 'ping', ok: true } } });
    const admin = machine({ reach: { ssh: { kind: 'tcp', ok: true, connected: true } } });
    const all = { machines: { srv, client, admin } };
    for (const id of ['drop', 'ssh', 'quiet', 'persist']) expect(pass(firewallLab, id, all).pass, id).toBe(true);
    const refused = machine({ reach: { ...(client as unknown as { reach: object }).reach, metrics: { kind: 'tcp', ok: false, connected: false, error: 'refused' } } });
    expect(pass(firewallLab, 'quiet', { machines: { srv, admin, client: refused } }).say?.en).toMatch(/reject/);
    const open = machine({ reach: { ssh: { kind: 'tcp', ok: true, connected: true } } });
    expect(pass(firewallLab, 'ssh', { machines: { srv, admin, client: open } }).say?.en).toMatch(/open to everyone/);
  });

  it('dnsmasq: listening, a lease in the range, the name, the fixed lease', () => {
    const gw = machine({ listen: [{ proto: 'udp', addr: '0.0.0.0', port: 67, proc: 'dnsmasq' }, { proto: 'udp', addr: '0.0.0.0', port: 53, proc: 'dnsmasq' }] });
    const pc = machine({ net: netOf({ addrs: [addr('eth0', '10.0.0.142/24')] }), dns: { nameservers: ['10.0.0.1'], search: [] }, reach: { name: { kind: 'dns', ok: true, answers: ['10.0.0.20'] }, site: { kind: 'http', ok: true, status: 200 } } });
    const all = { machines: { gw, pc } };
    for (const id of ['serve', 'lease', 'name']) expect(pass(dnsmasqLab, id, all).pass, id).toBe(true);
    expect(pass(dnsmasqLab, 'fixed', all).pass).toBe(false);
    expect(pass(dnsmasqLab, 'lease', { machines: { gw, pc: machine({ net: netOf({}), dns: { nameservers: [], search: [] } }) } }).say?.en).toMatch(/No lease/);
    expect(pass(dnsmasqLab, 'serve', { machines: { gw: machine({ listen: [{ proto: 'udp', addr: '0.0.0.0', port: 53, proc: 'dnsmasq' }] }), pc } }).say?.en).toMatch(/dhcp-range/);
  });

  it('gather asks each machine only for what the open goals read', async () => {
    const asked: string[] = [];
    const all = await gather(routerLab, {
      exec: async (_m, c) => ({ out: c.includes('curl') ? `200\n10.0.0.1\n@@DT-ERR\n${MARK(0)}` : MARK(0), exit: 0 }),
      facts: async (m, scopes) => {
        asked.push(`${m}:${scopes.join(',')}`);
        return machine({});
      },
    }, routerLab.tasks.filter((x) => x.id === 'nat'));
    expect(asked.sort()).toEqual(['gw:net,fw']); // pc and srv are only probed: no facts round trip
    expect((all.machines.pc as unknown as { reach: Record<string, { body: string }> }).reach.web.body).toBe('10.0.0.1');
    expect(Object.keys((all.machines.pc as unknown as { reach: object }).reach)).toEqual(['web']);
  });
});

// ── the in-browser exam ──

describe('the in-browser part B', () => {
  const NGINX_OK = `server { listen 443 ssl; server_name www.corp.lab; ssl_certificate /etc/nginx/corp.crt; ssl_certificate_key /etc/nginx/corp.key;
  location / { proxy_pass http://10.99.0.2:8080; }
  location /report { proxy_pass http://10.99.0.2:8080; proxy_read_timeout 90s; }
}
server { listen 80; return 301 https://$host$request_uri; }`;
  const links99 = (cidr: string) => netOf({ addrs: [addr('eth0', cidr.startsWith('10.99.0.1') ? '10.0.0.11/24' : '10.0.0.12/24'), addr('eth0.99', cidr)], links: [{ name: 'eth0.99', up: true, state: 'UP', kind: 'vlan', vlan: 99 }], forward: 1, routes: [{ dst: '10.0.0.13', via: '10.99.0.1' }] });
  const drop = { nft: [{ family: 'inet', table: 'filter', chain: 'input', rule: 'chain input type filter hook input policy drop' }, { family: 'inet', table: 'filter', chain: 'input', rule: 'tcp dport 22 ct state new limit rate 5/minute accept' }, { family: 'ip', table: 'nat', chain: 'post', rule: 'oifname "eth0" masquerade' }], iptables: [] };
  const solved = {
    vm1: machine({ net: links99('10.99.0.1/24'), fw: drop, nginx: { ok: true, config: NGINX_OK }, files: { '/root/504.txt': { type: 'f', text: '2026/11/19 10:00:00 [error] 12#12: *3 upstream timed out (110: Operation timed out) while reading response header from upstream' } }, reach: { tun: { kind: 'ping', ok: true }, app: { kind: 'http', ok: true, status: 200 }, exporter: { kind: 'tcp', ok: true, connected: true } } }),
    vm2: machine({ net: links99('10.99.0.2/24'), fw: drop, listen: [{ proto: 'tcp', addr: '10.99.0.2', port: 8080, proc: 'socat' }], files: { '/etc/dt-stub/delay': { type: 'f', text: '70\n' } }, reach: { partner: { kind: 'http', ok: true, status: 200, body: '10.0.0.11\n' } } }),
    probe: machine({ reach: { portal: { kind: 'http', ok: true, status: 200 }, report: { kind: 'http', ok: true, status: 200 }, plain: { kind: 'http', ok: true, status: 301 }, ssh1: { kind: 'tcp', ok: true, connected: true }, closed1: { kind: 'tcp', ok: false, connected: false, error: 'timeout' }, ssh2: { kind: 'tcp', ok: true, connected: true }, exporter2: { kind: 'tcp', ok: false, connected: false, error: 'timeout' } } }),
  };

  it('every goal holds on the solved machines and fails on fresh ones', () => {
    for (const task of examBrowser.tasks) {
      if (task.kind !== 'real') continue;
      expect(judgeReal(task.real, solved).score, task.id).toBe(1);
      const fresh = { vm1: machine({ net: netOf({ addrs: [addr('eth0', '10.0.0.11/24')] }) }), vm2: machine({ net: netOf({}) }), probe: machine({ reach: { closed1: { kind: 'tcp', ok: false, error: 'refused' } } }) };
      expect(judgeReal(task.real, fresh).score, task.id).toBeLessThan(1);
    }
    expect(examBrowser.real?.machines.map((m) => m.id)).toEqual(['vm1', 'vm2', 'probe']);
    expect(examBrowser.tasks.some((x) => x.id === 'cleanup')).toBe(false);
  });

  it('tells the tempting mistakes apart in ticket 4', () => {
    const t = examBrowser.tasks.find((x) => x.id === 'egress')!;
    if (t.kind !== 'real') throw new Error('real');
    const seen = t.real.goals!.find((g) => g.id === 'seen')!;
    const direct = { machines: { ...solved, vm2: machine({ net: netOf({}), reach: { partner: { kind: 'http', ok: false, status: 403 } } }) } } as unknown as Facts;
    expect(evaluateCheck(seen.check, direct).say?.en).toMatch(/directly/);
    const noNat = { machines: { ...solved, vm2: machine({ net: netOf({ routes: [{ dst: '10.0.0.13', via: '10.99.0.1' }] }), reach: { partner: { kind: 'http', ok: false, status: 403 } } }) } } as unknown as Facts;
    expect(evaluateCheck(seen.check, noNat).say?.en).toMatch(/not rewritten/);
  });

  it('reads nginx timeouts per location and for the whole site', () => {
    expect(reportTimeout(NGINX_OK)).toBe(true);
    expect(siteReadTimeout(NGINX_OK)).toBe(60);
    const global = NGINX_OK.replace('location / {', 'proxy_read_timeout 2m;\n  location / {');
    expect(siteReadTimeout(global)).toBe(120);
    expect(reportTimeout('location / { proxy_read_timeout 90s; }')).toBe(false);
  });

  it('the setup scripts are valid shell', async () => {
    const { execFileSync } = await import('node:child_process');
    for (const m of examLab.machines) for (const line of m.setup ?? []) execFileSync('sh', ['-n', '-c', line]);
    for (const lab of Object.values(LABS)) for (const m of lab.machines) for (const line of m.setup ?? []) execFileSync('sh', ['-n', '-c', line]);
  });
});
