import { describe, expect, it } from 'vitest';
import { addTag, L2Switch, macFromString, parseFrame, stripTag, type SwitchEvent } from '../src/engine/v86/switch';

const BCAST = 'ff:ff:ff:ff:ff:ff';

function eth(dst: string, src: string, type = 0x0800, payload: number[] = []): Uint8Array {
  const f = new Uint8Array(14 + Math.max(46, payload.length));
  f.set(macFromString(dst), 0);
  f.set(macFromString(src), 6);
  f[12] = type >> 8;
  f[13] = type & 0xff;
  f.set(payload, 14);
  return f;
}

function arpRequest(src: string, sip: number[], tip: number[]): Uint8Array {
  const p = [0, 1, 8, 0, 6, 4, 0, 1, ...macFromString(src), ...sip, 0, 0, 0, 0, 0, 0, ...tip];
  return eth(BCAST, src, 0x0806, p);
}

function icmpEcho(dst: string, src: string, sip: number[], dip: number[]): Uint8Array {
  const ip = [0x45, 0, 0, 84, 0, 0, 0x40, 0, 64, 1, 0, 0, ...sip, ...dip];
  return eth(dst, src, 0x0800, [...ip, 8, 0, 0, 0]);
}

const A = '02:64:74:00:00:01';
const B = '02:64:74:00:00:02';
const C = '02:64:74:00:00:03';

function rig(opts: ConstructorParameters<typeof L2Switch>[0] = {}) {
  let now = 0;
  const sw = new L2Switch({ now: () => now, ...opts });
  const got: Record<string, Uint8Array[]> = { a: [], b: [], c: [] };
  sw.addPort('a', { mode: 'access' }, (f) => got.a.push(f));
  sw.addPort('b', { mode: 'access' }, (f) => got.b.push(f));
  sw.addPort('c', { mode: 'access' }, (f) => got.c.push(f));
  const events: SwitchEvent[] = [];
  sw.on((e) => events.push(e));
  return { sw, got, events, tick: (ms: number) => (now += ms) };
}

describe('parseFrame', () => {
  it('decodes ARP and ICMP', () => {
    const arp = parseFrame(arpRequest(A, [10, 0, 0, 11], [10, 0, 0, 12]));
    expect(arp).toMatchObject({ broadcast: true, kind: 'arp', arp: { op: 'request', senderIp: '10.0.0.11', targetIp: '10.0.0.12', senderMac: A } });
    const ping = parseFrame(icmpEcho(B, A, [10, 0, 0, 11], [10, 0, 0, 12]));
    expect(ping).toMatchObject({ kind: 'ipv4', broadcast: false, ip: { src: '10.0.0.11', dst: '10.0.0.12', proto: 1, ttl: 64, icmp: { type: 8, code: 0 } } });
  });

  it('reads and strips an 802.1Q tag', () => {
    const f = icmpEcho(B, A, [10, 0, 0, 1], [10, 0, 0, 2]);
    const tagged = addTag(f, 20);
    expect(parseFrame(tagged)).toMatchObject({ tag: 20, ethertype: 0x0800, ip: { dst: '10.0.0.2' } });
    expect([...stripTag(tagged)]).toEqual([...f]);
  });

  it('rejects runt frames', () => {
    expect(() => parseFrame(new Uint8Array(10))).toThrow(/runt/);
  });
});

describe('L2Switch', () => {
  it('floods unknown and broadcast frames, then forwards once it has learned', () => {
    const { sw, got, events } = rig();
    expect(sw.receive('a', arpRequest(A, [10, 0, 0, 11], [10, 0, 0, 12]))).toEqual(['b', 'c']);
    expect(got.b).toHaveLength(1);
    expect(got.c).toHaveLength(1);
    // B answers A: A was learned on port a, so only a gets it.
    expect(sw.receive('b', eth(A, B))).toEqual(['a']);
    expect(got.c).toHaveLength(1);
    // Now B is known too.
    expect(sw.receive('a', eth(B, A))).toEqual(['b']);
    expect(sw.table().map((e) => `${e.mac}@${e.port}`)).toEqual([`${A}@a`, `${B}@b`]);
    expect(events.filter((e) => e.t === 'l2.frame').map((e) => (e as { how: string }).how)).toEqual(['flood', 'forward', 'forward']);
  });

  it('filters a frame whose receiver is behind the incoming port', () => {
    const { sw } = rig();
    sw.receive('a', eth(BCAST, A));
    sw.receive('a', eth(BCAST, C)); // C also sits behind port a (another switch behind it)
    expect(sw.receive('a', eth(C, A))).toEqual([]);
  });

  it('forgets entries after the aging time and floods again', () => {
    const { sw, tick, events } = rig({ agingMs: 10_000 });
    sw.receive('b', eth(BCAST, B));
    expect(sw.receive('a', eth(B, A))).toEqual(['b']);
    tick(11_000);
    expect(sw.receive('a', eth(B, A))).toEqual(['b', 'c']);
    expect(events.some((e) => e.t === 'l2.age' && e.mac === B)).toBe(true);
  });

  it('notices a moved station', () => {
    const { sw, events } = rig();
    sw.receive('a', eth(BCAST, A));
    sw.receive('c', eth(BCAST, A));
    expect(sw.table()).toEqual([expect.objectContaining({ mac: A, port: 'c' })]);
    expect(events.find((e) => e.t === 'l2.learn' && e.moved === 'a')).toBeTruthy();
  });

  it('acts as a hub when asked: every frame to every other port, nothing learned', () => {
    const { sw } = rig({ hub: true });
    sw.receive('b', eth(BCAST, B));
    expect(sw.receive('a', eth(B, A))).toEqual(['b', 'c']);
    expect(sw.table()).toEqual([]);
  });

  it('drops frames on a port that is down and forgets what was behind it', () => {
    const { sw, got, events } = rig();
    sw.receive('b', eth(BCAST, B));
    sw.setPort('b', { up: false });
    expect(sw.table()).toEqual([]);
    expect(sw.receive('a', eth(B, A))).toEqual(['c']);
    expect(got.b).toHaveLength(0);
    expect(sw.receive('b', eth(A, B))).toEqual([]);
    expect(sw.counters('b')?.drop).toBe(1);
    expect(events.at(-1)).toMatchObject({ t: 'l2.frame', how: 'drop', reason: 'port down' });
  });

  it('keeps VLANs apart and tags frames on trunks', () => {
    const got: Record<string, Uint8Array[]> = { a: [], b: [], t: [] };
    const sw = new L2Switch();
    sw.addPort('a', { mode: 'access', vlan: 10 }, (f) => got.a.push(f));
    sw.addPort('b', { mode: 'access', vlan: 20 }, (f) => got.b.push(f));
    sw.addPort('t', { mode: 'trunk', vlan: 1, vlans: [10, 20] }, (f) => got.t.push(f));
    // A broadcast in VLAN 10 never reaches the VLAN 20 access port; the trunk gets it tagged 10.
    expect(sw.receive('a', eth(BCAST, A))).toEqual(['t']);
    expect(parseFrame(got.t[0]).tag).toBe(10);
    // A tagged frame from the trunk to VLAN 20 leaves the access port untagged.
    expect(sw.receive('t', addTag(eth(BCAST, C), 20))).toEqual(['b']);
    expect(parseFrame(got.b[0]).tag).toBeUndefined();
    // Tagged frames on access ports and VLANs a trunk does not carry are dropped.
    expect(sw.receive('a', addTag(eth(BCAST, A), 10))).toEqual([]);
    expect(sw.receive('t', addTag(eth(BCAST, C), 30))).toEqual([]);
    // The same MAC may live in two VLANs as two entries.
    sw.receive('t', addTag(eth(BCAST, A), 20));
    expect(sw.table().filter((e) => e.mac === A).map((e) => e.vlan)).toEqual([10, 20]);
  });

  it('survives a snapshot', () => {
    const { sw } = rig();
    sw.receive('a', eth(BCAST, A));
    const snap = JSON.parse(JSON.stringify(sw.snapshot()));
    sw.flushTable();
    sw.hub = true;
    sw.restore(snap);
    expect(sw.hub).toBe(false);
    expect(sw.table().map((e) => e.mac)).toEqual([A]);
  });
});
