// A tap and the "cable knobs" on the lab switch (design 00 §6.4, §6.13): the
// switch keeps a copy of every frame that enters it, so the learner can save
// the lab's traffic as a .pcap and open it in Wireshark or `tcpdump -r`, and
// each port gets a line with loss and delay, as `tc netem` would give a real
// cable. The switch itself (engine/v86/switch.ts) stays untouched: the tap
// wraps its `receive`, the one entry every frame passes.
//
// Pure apart from setTimeout for the delay; the clock and the dice are
// injectable for tests.

import { parseFrame, type FrameInfo, type L2Switch } from '../../../engine/v86/switch';

export interface CapturedFrame {
  /** Milliseconds since the epoch (the pcap timestamp). */
  at: number;
  port: string;
  bytes: Uint8Array;
}

export interface LineParams {
  /** Share of frames from this port that are lost, 0–100. */
  lossPct: number;
  /** One-way delay added to frames from this port, ms. */
  delayMs: number;
}

export interface TapOptions {
  /** Frames kept in the ring buffer (default 5000). */
  capacity?: number;
  now?: () => number;
  random?: () => number;
  /** Schedules a delayed frame; default setTimeout. */
  later?: (fn: () => void, ms: number) => void;
}

export interface SwitchFacts {
  frames: number;
  capturing: boolean;
  arp: { op: string; from: string; ask: string; port: string }[];
  icmp: { src: string; dst: string; type: number; port: string; vlan?: number }[];
  lines: Record<string, LineParams>;
}

export class SwitchTap {
  private ring: CapturedFrame[] = [];
  private head = 0;
  private total = 0;
  private lines = new Map<string, LineParams>();
  private origReceive: L2Switch['receive'];
  private listeners = new Set<(f: CapturedFrame) => void>();
  capturing = false;
  readonly capacity: number;
  private now: () => number;
  private random: () => number;
  private later: (fn: () => void, ms: number) => void;

  constructor(
    private sw: L2Switch,
    o: TapOptions = {},
  ) {
    this.capacity = o.capacity ?? 5000;
    this.now = o.now ?? (() => Date.now());
    this.random = o.random ?? Math.random;
    this.later = o.later ?? ((fn, ms) => void setTimeout(fn, ms));
    this.origReceive = sw.receive.bind(sw);
    sw.receive = (port: string, frame: Uint8Array) => this.onFrame(port, frame);
  }

  private onFrame(port: string, frame: Uint8Array): string[] {
    const line = this.lines.get(port);
    if (line && line.lossPct > 0 && this.random() * 100 < line.lossPct) return [];
    if (line && line.delayMs > 0) {
      const copy = frame.slice();
      this.later(() => this.pass(port, copy), line.delayMs);
      return [];
    }
    return this.pass(port, frame);
  }

  private pass(port: string, frame: Uint8Array): string[] {
    if (this.capturing) {
      const f: CapturedFrame = { at: this.now(), port, bytes: frame.slice() };
      if (this.ring.length < this.capacity) this.ring.push(f);
      else {
        this.ring[this.head] = f;
        this.head = (this.head + 1) % this.capacity;
      }
      this.total++;
      for (const fn of this.listeners) fn(f);
    }
    return this.origReceive(port, frame);
  }

  /** Set the line of a port; zeros remove it. */
  setLine(port: string, p: Partial<LineParams>): void {
    const cur = { lossPct: 0, delayMs: 0, ...this.lines.get(port), ...p };
    cur.lossPct = Math.max(0, Math.min(100, cur.lossPct));
    cur.delayMs = Math.max(0, Math.min(5000, cur.delayMs));
    if (!cur.lossPct && !cur.delayMs) this.lines.delete(port);
    else this.lines.set(port, cur);
  }

  line(port: string): LineParams {
    return { lossPct: 0, delayMs: 0, ...this.lines.get(port) };
  }

  start(): void {
    this.capturing = true;
  }

  stop(): void {
    this.capturing = false;
  }

  clear(): void {
    this.ring = [];
    this.head = 0;
    this.total = 0;
  }

  on(fn: (f: CapturedFrame) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Captured frames, oldest first. */
  frames(): CapturedFrame[] {
    return this.ring.length < this.capacity ? [...this.ring] : [...this.ring.slice(this.head), ...this.ring.slice(0, this.head)];
  }

  /** Frames seen since the last clear (including those the ring has dropped). */
  get count(): number {
    return this.total;
  }

  /** What checks read: the ARP and ICMP the switch carried, and the line knobs. */
  facts(): SwitchFacts {
    const arp: SwitchFacts['arp'] = [];
    const icmp: SwitchFacts['icmp'] = [];
    for (const f of this.frames()) {
      const i = parseFrame(f.bytes);
      if (i.arp) arp.push({ op: String(i.arp.op), from: i.arp.senderIp, ask: i.arp.targetIp, port: f.port });
      else if (i.ip?.icmp) icmp.push({ src: i.ip.src, dst: i.ip.dst, type: i.ip.icmp.type, port: f.port, vlan: i.tag });
    }
    return { frames: this.total, capturing: this.capturing, arp, icmp, lines: Object.fromEntries(this.lines) };
  }

  /** Give the switch its own receive back. */
  dispose(): void {
    this.sw.receive = this.origReceive;
    this.listeners.clear();
  }
}

/** A classic libpcap file (LINKTYPE_ETHERNET, microsecond timestamps). */
export function toPcap(frames: CapturedFrame[], snaplen = 65535): Uint8Array {
  const size = 24 + frames.reduce((n, f) => n + 16 + Math.min(f.bytes.length, snaplen), 0);
  const out = new Uint8Array(size);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0xa1b2c3d4, true);
  v.setUint16(4, 2, true);
  v.setUint16(6, 4, true);
  v.setInt32(8, 0, true);
  v.setUint32(12, 0, true);
  v.setUint32(16, snaplen, true);
  v.setUint32(20, 1, true);
  let o = 24;
  for (const f of frames) {
    const len = Math.min(f.bytes.length, snaplen);
    v.setUint32(o, Math.floor(f.at / 1000), true);
    v.setUint32(o + 4, Math.round((f.at % 1000) * 1000), true);
    v.setUint32(o + 8, len, true);
    v.setUint32(o + 12, f.bytes.length, true);
    out.set(f.bytes.subarray(0, len), o + 16);
    o += 16 + len;
  }
  return out;
}

/** One line per frame, close to `tcpdump -n -e` (the panel's live view). */
export function frameLine(f: CapturedFrame, i: FrameInfo = parseFrame(f.bytes)): string {
  const vlan = i.tag !== undefined ? ` vlan ${i.tag}` : '';
  const head = `${f.port}${vlan} ${i.src} > ${i.dst}`;
  if (i.arp) return i.arp.op === 'request' ? `${head} ARP who-has ${i.arp.targetIp} tell ${i.arp.senderIp}` : `${head} ARP ${i.arp.senderIp} is-at ${i.arp.senderMac}`;
  if (i.ip) {
    const proto = i.ip.icmp ? `ICMP ${i.ip.icmp.type === 8 ? 'echo request' : i.ip.icmp.type === 0 ? 'echo reply' : `type ${i.ip.icmp.type}`}` : i.ip.proto === 6 ? 'TCP' : i.ip.proto === 17 ? 'UDP' : `proto ${i.ip.proto}`;
    return `${head} IP ${i.ip.src} > ${i.ip.dst}: ${proto}, ttl ${i.ip.ttl}, length ${i.bytes}`;
  }
  return `${head} ethertype 0x${i.ethertype.toString(16).padStart(4, '0')}, length ${i.bytes}`;
}
