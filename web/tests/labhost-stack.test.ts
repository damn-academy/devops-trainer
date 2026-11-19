// The lab host's network stack over raw Ethernet frames: ARP, ping, DHCP,
// DNS, TCP and HTTP through the real dt-switch class. A second LabHost plays
// the guest where a TCP client is needed, so both directions of the TCP code
// run against each other; the other tests craft frames by hand.

import { describe, expect, it } from 'vitest';
import { LabHost } from '../src/engine/labhost/host';
import { DhcpServer, buildDhcp, parseDhcp } from '../src/engine/labhost/dhcp';
import { DnsServer, buildDns, parseDns, QTYPE } from '../src/engine/labhost/dns';
import { HttpParser, httpRequest, serveHttp, json } from '../src/engine/labhost/http';
import { L2Switch } from '../src/engine/v86/switch';
import {
  buildArp,
  buildEth,
  buildIcmp,
  buildIp4,
  buildUdp,
  ETH_ARP,
  ETH_IP4,
  ipToNum,
  numToIp,
  parseArp,
  parseEth,
  parseIp4,
  parseUdp,
  PROTO_ICMP,
  PROTO_UDP,
  utf8,
} from '../src/engine/labhost/wire';

const GUEST_MAC = '02:64:74:00:00:11';
const tick = () => new Promise((r) => setTimeout(r, 0));

function rig() {
  const sw = new L2Switch();
  const host = new LabHost();
  host.addInterface(1, ipToNum('10.0.0.1'), 24);
  host.attach(sw);
  const seen: Uint8Array[] = [];
  sw.addPort('guest', { mode: 'access', vlan: 1 }, (f) => seen.push(f));
  const send = (f: Uint8Array) => sw.receive('guest', f);
  return { sw, host, seen, send };
}

describe('lab host: L2/L3', () => {
  it('answers ARP for its address and ignores others', async () => {
    const { seen, send } = rig();
    send(buildEth('ff:ff:ff:ff:ff:ff', GUEST_MAC, ETH_ARP, buildArp({ op: 1, sha: GUEST_MAC, spa: ipToNum('10.0.0.11'), tha: '00:00:00:00:00:00', tpa: ipToNum('10.0.0.1') })));
    send(buildEth('ff:ff:ff:ff:ff:ff', GUEST_MAC, ETH_ARP, buildArp({ op: 1, sha: GUEST_MAC, spa: ipToNum('10.0.0.11'), tha: '00:00:00:00:00:00', tpa: ipToNum('10.0.0.99') })));
    await tick();
    expect(seen).toHaveLength(1);
    const e = parseEth(seen[0])!;
    const a = parseArp(e.payload)!;
    expect(a.op).toBe(2);
    expect(numToIp(a.spa)).toBe('10.0.0.1');
    expect(e.dst).toBe(GUEST_MAC);
  });

  it('answers ping', async () => {
    const { seen, send } = rig();
    const echo = buildIcmp(8, 0, Uint8Array.of(0, 1, 0, 7, 1, 2, 3, 4));
    send(buildEth('02:64:74:ff:00:01', GUEST_MAC, ETH_IP4, buildIp4({ src: ipToNum('10.0.0.11'), dst: ipToNum('10.0.0.1'), proto: PROTO_ICMP, payload: echo })));
    await tick();
    const ip = parseIp4(parseEth(seen[0])!.payload)!;
    expect(ip.proto).toBe(PROTO_ICMP);
    expect(ip.payload[0]).toBe(0);
    expect([...ip.payload.subarray(4)]).toEqual([0, 1, 0, 7, 1, 2, 3, 4]);
  });

  it('serves a VLAN on a trunk with tagged frames', async () => {
    const sw = new L2Switch();
    const host = new LabHost();
    host.addInterface(1, ipToNum('10.0.0.1'), 24);
    host.addInterface(100, ipToNum('10.10.1.1'), 24, 'net-a');
    host.attach(sw);
    const seen: Uint8Array[] = [];
    sw.addPort('g', { mode: 'access', vlan: 100 }, (f) => seen.push(f));
    sw.receive('g', buildEth('ff:ff:ff:ff:ff:ff', GUEST_MAC, ETH_ARP, buildArp({ op: 1, sha: GUEST_MAC, spa: ipToNum('10.10.1.5'), tha: '00:00:00:00:00:00', tpa: ipToNum('10.10.1.1') })));
    await tick();
    expect(seen).toHaveLength(1);
    const e = parseEth(seen[0])!;
    expect(e.vlan).toBeUndefined(); // the access port strips the tag
    expect(numToIp(parseArp(e.payload)!.spa)).toBe('10.10.1.1');
  });
});

describe('lab host: DHCP and DNS', () => {
  it('leases a fixed address and a pool address', async () => {
    const { host, seen, send } = rig();
    const dhcp = new DhcpServer(host);
    dhcp.setPool({ vlan: 1, from: ipToNum('10.0.0.100'), to: ipToNum('10.0.0.101'), prefix: 24, gateway: ipToNum('10.0.0.1'), dns: [ipToNum('10.0.0.1')], domain: 'lab' });
    dhcp.setFixed(1, GUEST_MAC, { ip: ipToNum('10.0.0.21'), prefix: 24, gateway: ipToNum('10.0.0.1'), dns: [ipToNum('10.0.0.1')], domain: 'lab', hostname: 'web-1' });
    const discover = (mac: string, type: number, req?: number) =>
      send(
        buildEth(
          'ff:ff:ff:ff:ff:ff',
          mac,
          ETH_IP4,
          buildIp4({
            src: 0,
            dst: 0xffffffff,
            proto: PROTO_UDP,
            payload: buildUdp(0, 0xffffffff, 68, 67, buildDhcp({ op: 1, xid: 42, chaddr: mac, options: [[53, Uint8Array.of(type)], ...(req ? ([[50, Uint8Array.of(req >>> 24, (req >>> 16) & 255, (req >>> 8) & 255, req & 255)]] as [number, Uint8Array][]) : [])] })),
          }),
        ),
      );
    discover(GUEST_MAC, 1);
    await tick();
    const offer = parseDhcp(parseUdp(parseIp4(parseEth(seen.at(-1)!)!.payload)!.payload)!.data)!;
    expect(numToIp(offer.yiaddr)).toBe('10.0.0.21');
    expect(offer.options.get(53)![0]).toBe(2);
    expect(new TextDecoder().decode(offer.options.get(12))).toBe('web-1');
    discover(GUEST_MAC, 3, ipToNum('10.0.0.21'));
    await tick();
    const ack = parseDhcp(parseUdp(parseIp4(parseEth(seen.at(-1)!)!.payload)!.payload)!.data)!;
    expect(ack.options.get(53)![0]).toBe(5);
    discover('02:00:00:00:00:99', 1);
    await tick();
    const pool = parseDhcp(parseUdp(parseIp4(parseEth(seen.at(-1)!)!.payload)!.payload)!.data)!;
    expect(numToIp(pool.yiaddr)).toBe('10.0.0.100');
  });

  it('answers A, CNAME, NXDOMAIN and SERVFAIL', async () => {
    const { host, seen, send } = rig();
    const zone: Record<string, { name: string; type: 'A' | 'CNAME'; ttl: number; value: string }[]> = {
      'api.cloud.lab': [{ name: 'api.cloud.lab', type: 'A', ttl: 60, value: '10.0.0.1' }],
      'www.shop.lab': [{ name: 'www.shop.lab', type: 'CNAME', ttl: 60, value: 'api.cloud.lab' }],
    };
    new DnsServer(host, (n) => zone[n] ?? []);
    const ask = async (name: string) => {
      const q = buildDns({ id: 7, flags: 0x0100, questions: [{ name, type: QTYPE.A, cls: 1 }], answers: [] });
      send(buildEth('02:64:74:ff:00:01', GUEST_MAC, ETH_IP4, buildIp4({ src: ipToNum('10.0.0.11'), dst: ipToNum('10.0.0.1'), proto: PROTO_UDP, payload: buildUdp(ipToNum('10.0.0.11'), ipToNum('10.0.0.1'), 5353, 53, q) })));
      await tick();
      const r = parseDns(parseUdp(parseIp4(parseEth(seen.at(-1)!)!.payload)!.payload)!.data)!;
      return { rcode: r.flags & 15, answers: r.answers.map((a) => a.data) };
    };
    expect(await ask('api.cloud.lab')).toEqual({ rcode: 0, answers: ['10.0.0.1'] });
    expect(await ask('WWW.shop.lab')).toEqual({ rcode: 0, answers: ['api.cloud.lab', '10.0.0.1'] });
    expect((await ask('nope.lab')).rcode).toBe(3);
    expect((await ask('example.com')).rcode).toBe(2);
  });
});

describe('lab host: TCP and HTTP', () => {
  function pair() {
    const sw = new L2Switch();
    const server = new LabHost();
    server.addInterface(1, ipToNum('10.0.0.1'), 24);
    server.attach(sw, 'server');
    const client = new LabHost({ mac: '02:64:74:00:00:50' });
    client.addInterface(1, ipToNum('10.0.0.50'), 24);
    client.attach(sw, 'client');
    return { sw, server, client };
  }

  it('serves a request, keeps the connection alive, sends a large body in segments', async () => {
    const { server, client } = pair();
    const big = new Uint8Array(300_000).map((_, i) => i & 255);
    serveHttp(server, 80, (req) => (req.path === '/big' ? { status: 200, body: big } : json(200, { path: req.path, host: req.host, body: new TextDecoder().decode(req.body) })));
    const r = await httpRequest(client, { ip: '10.0.0.1', port: 80, method: 'POST', target: '/v1/x?y=1', headers: { host: 'api.cloud.lab' }, body: 'hello' });
    expect(r.status).toBe(200);
    expect(JSON.parse(new TextDecoder().decode(r.body))).toEqual({ path: '/v1/x', host: 'api.cloud.lab', body: 'hello' });
    const t0 = performance.now();
    const b = await httpRequest(client, { ip: '10.0.0.1', port: 80, target: '/big' });
    expect(b.body.length).toBe(big.length);
    expect(b.body[299_999]).toBe(299_999 & 255);
    expect(performance.now() - t0).toBeLessThan(2000);
    await new Promise((r) => setTimeout(r, 10));
    expect(server.connections()).toHaveLength(0);
  });

  it('accepts a large upload in chunked encoding', async () => {
    const { server, client } = pair();
    let got = 0;
    serveHttp(server, 80, (req) => {
      got = req.body.length;
      return { status: 204 };
    });
    const payload = 'x'.repeat(100_000);
    const chunked = `${payload.length.toString(16)}\r\n${payload}\r\n0\r\n\r\n`;
    const c = await client.connect(ipToNum('10.0.0.1'), 80);
    const parser = new HttpParser('response');
    const res = new Promise<number>((resolve) => c.onData((d) => parser.feed(d).forEach((m) => resolve(Number(m.start[0])))));
    c.write(utf8(`PUT /x HTTP/1.1\r\nHost: s3.cloud.lab\r\nTransfer-Encoding: chunked\r\nExpect: 100-continue\r\n\r\n${chunked}`));
    expect(await res).toBe(204);
    expect(got).toBe(100_000);
  });

  it('refuses a closed port with RST', async () => {
    const { client } = pair();
    await expect(client.connect(ipToNum('10.0.0.1'), 81)).rejects.toThrow(/refused|reset/);
  });

  it('retransmits when a segment is lost', async () => {
    const sw = new L2Switch();
    const server = new LabHost();
    server.addInterface(1, ipToNum('10.0.0.1'), 24);
    server.attach(sw, 'server');
    const client = new LabHost({ mac: '02:64:74:00:00:50' });
    client.addInterface(1, ipToNum('10.0.0.50'), 24);
    // A lossy cable: drop the 5th frame from the server.
    let n = 0;
    sw.addPort('client', { mode: 'access', vlan: 1 }, (f) => {
      if (++n === 5) return;
      client.input(f);
    });
    client.output = (f) => sw.receive('client', f);
    serveHttp(server, 80, () => ({ status: 200, body: new Uint8Array(20_000) }));
    const r = await httpRequest(client, { ip: '10.0.0.1', port: 80, target: '/' });
    expect(r.body.length).toBe(20_000);
  });

  it('routes between subnets of one network and not between networks', async () => {
    const sw = new L2Switch();
    const host = new LabHost();
    host.addInterface(1, ipToNum('10.0.0.1'), 24);
    host.addInterface(100, ipToNum('10.10.1.1'), 24, 'net-a');
    host.addInterface(101, ipToNum('10.10.2.1'), 24, 'net-a');
    host.attach(sw);
    const a: Uint8Array[] = [];
    const b: Uint8Array[] = [];
    sw.addPort('a', { mode: 'access', vlan: 100 }, (f) => a.push(f));
    sw.addPort('b', { mode: 'access', vlan: 101 }, (f) => b.push(f));
    // b's address is known to the host after it talks once.
    sw.receive('b', buildEth('ff:ff:ff:ff:ff:ff', '02:00:00:00:00:0b', ETH_ARP, buildArp({ op: 1, sha: '02:00:00:00:00:0b', spa: ipToNum('10.10.2.5'), tha: '00:00:00:00:00:00', tpa: ipToNum('10.10.2.1') })));
    await tick();
    const ping = buildIp4({ src: ipToNum('10.10.1.5'), dst: ipToNum('10.10.2.5'), proto: PROTO_ICMP, payload: buildIcmp(8, 0, new Uint8Array(4)), ttl: 64 });
    sw.receive('a', buildEth('02:64:74:ff:00:01', '02:00:00:00:00:0a', ETH_IP4, ping));
    await tick();
    const fwd = parseIp4(parseEth(b.at(-1)!)!.payload)!;
    expect(numToIp(fwd.dst)).toBe('10.10.2.5');
    expect(fwd.ttl).toBe(63);
    const toDefault = buildIp4({ src: ipToNum('10.10.1.5'), dst: ipToNum('10.0.0.50'), proto: PROTO_ICMP, payload: buildIcmp(8, 0, new Uint8Array(4)) });
    sw.receive('a', buildEth('02:64:74:ff:00:01', '02:00:00:00:00:0a', ETH_IP4, toDefault));
    await tick();
    const unreachable = parseIp4(parseEth(a.at(-1)!)!.payload)!;
    expect(unreachable.payload[0]).toBe(3);
  });
});
