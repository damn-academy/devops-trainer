// dt-switch: an in-page Ethernet switch that connects the network cards of
// several v86 machines (design 09 §1.7). It is a real learning L2 switch, not
// a hub: it learns which MAC address sits behind which port, forgets entries
// after the aging time, floods broadcast and unknown unicast frames to every
// other port of the same VLAN, and keeps 802.1Q VLANs apart (access and trunk
// ports, tags added and removed for real). One toggle turns it into a hub for
// the lesson "why a switch learns MAC addresses".
//
// The class is pure: it knows nothing about v86 or workers. A port is a
// `deliver(frame)` callback; the machine adapter feeds received frames into
// `receive(port, frame)`. Every decision is reported on the event bus as
// `l2.frame` / `l2.learn`, with the frame decoded down to ARP and IPv4/ICMP,
// so diagrams can draw real traffic of real kernels.

export type Mac = string;

export interface PortConfig {
  /** access: one untagged VLAN; trunk: several tagged VLANs (+ a native one). */
  mode: 'access' | 'trunk';
  /** Access VLAN, or the native (untagged) VLAN of a trunk. Default 1. */
  vlan?: number;
  /** VLANs a trunk carries tagged. */
  vlans?: number[];
  /** Link state; a port that is down neither sends nor receives. Default true. */
  up?: boolean;
}

export interface FrameInfo {
  dst: Mac;
  src: Mac;
  /** Ethertype after the VLAN tag, e.g. 0x0806 ARP, 0x0800 IPv4. */
  ethertype: number;
  /** VLAN id from an 802.1Q tag, when the frame carries one. */
  tag?: number;
  broadcast: boolean;
  multicast: boolean;
  kind: 'arp' | 'ipv4' | 'ipv6' | 'other';
  arp?: { op: 'request' | 'reply' | number; senderMac: Mac; senderIp: string; targetIp: string };
  ip?: { src: string; dst: string; proto: number; ttl: number; icmp?: { type: number; code: number } };
  bytes: number;
}

export interface PortCounters {
  rx: number;
  tx: number;
  drop: number;
  rxBytes: number;
  txBytes: number;
}

export type SwitchEvent =
  | { t: 'l2.frame'; at: number; in: string; out: string[]; how: 'forward' | 'flood' | 'filter' | 'drop' | 'hub'; vlan: number; info: FrameInfo; reason?: string }
  | { t: 'l2.learn'; at: number; mac: Mac; port: string; vlan: number; moved?: string }
  | { t: 'l2.age'; at: number; mac: Mac; port: string; vlan: number };

export interface MacEntry {
  mac: Mac;
  port: string;
  vlan: number;
  /** When the entry was last refreshed (ms on the switch clock). */
  seen: number;
}

interface Port {
  id: string;
  cfg: Required<Pick<PortConfig, 'mode' | 'vlan' | 'up'>> & { vlans: number[] };
  deliver: (frame: Uint8Array) => void;
  counters: PortCounters;
}

export interface SwitchOptions {
  /** MAC aging time; IEEE 802.1D default is 300 s. */
  agingMs?: number;
  hub?: boolean;
  /** Clock, injectable for tests. */
  now?: () => number;
}

const TPID_8021Q = 0x8100;

export function macToString(b: Uint8Array, off = 0): Mac {
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) parts.push(b[off + i].toString(16).padStart(2, '0'));
  return parts.join(':');
}

export function macFromString(s: Mac): Uint8Array {
  const p = s.split(':').map((x) => parseInt(x, 16));
  if (p.length !== 6 || p.some((x) => !(x >= 0 && x <= 255))) throw new Error(`bad MAC address: ${s}`);
  return Uint8Array.from(p);
}

const ip4 = (b: Uint8Array, o: number) => `${b[o]}.${b[o + 1]}.${b[o + 2]}.${b[o + 3]}`;

/** Decode an Ethernet II frame (optionally 802.1Q-tagged) down to ARP / IPv4 / ICMP. */
export function parseFrame(f: Uint8Array): FrameInfo {
  if (f.length < 14) throw new Error(`runt frame: ${f.length} bytes`);
  const dst = macToString(f, 0);
  const src = macToString(f, 6);
  let off = 12;
  let ethertype = (f[off] << 8) | f[off + 1];
  let tag: number | undefined;
  if (ethertype === TPID_8021Q && f.length >= 18) {
    tag = ((f[14] << 8) | f[15]) & 0x0fff;
    off = 16;
    ethertype = (f[off] << 8) | f[off + 1];
  }
  const p = off + 2;
  const info: FrameInfo = {
    dst,
    src,
    ethertype,
    tag,
    broadcast: dst === 'ff:ff:ff:ff:ff:ff',
    multicast: (f[0] & 1) === 1,
    kind: 'other',
    bytes: f.length,
  };
  if (ethertype === 0x0806 && f.length >= p + 28) {
    const op = (f[p + 6] << 8) | f[p + 7];
    info.kind = 'arp';
    info.arp = { op: op === 1 ? 'request' : op === 2 ? 'reply' : op, senderMac: macToString(f, p + 8), senderIp: ip4(f, p + 14), targetIp: ip4(f, p + 24) };
  } else if (ethertype === 0x0800 && f.length >= p + 20) {
    const ihl = (f[p] & 0x0f) * 4;
    const proto = f[p + 9];
    info.kind = 'ipv4';
    info.ip = { src: ip4(f, p + 12), dst: ip4(f, p + 16), proto, ttl: f[p + 8] };
    if (proto === 1 && f.length >= p + ihl + 2) info.ip.icmp = { type: f[p + ihl], code: f[p + ihl + 1] };
  } else if (ethertype === 0x86dd) info.kind = 'ipv6';
  return info;
}

/** Insert an 802.1Q tag after the source MAC. */
export function addTag(f: Uint8Array, vlan: number): Uint8Array {
  const out = new Uint8Array(f.length + 4);
  out.set(f.subarray(0, 12), 0);
  out[12] = TPID_8021Q >> 8;
  out[13] = TPID_8021Q & 0xff;
  out[14] = (vlan >> 8) & 0x0f;
  out[15] = vlan & 0xff;
  out.set(f.subarray(12), 16);
  return out;
}

/** Remove the 802.1Q tag. */
export function stripTag(f: Uint8Array): Uint8Array {
  const out = new Uint8Array(f.length - 4);
  out.set(f.subarray(0, 12), 0);
  out.set(f.subarray(16), 12);
  return out;
}

export class L2Switch {
  private ports = new Map<string, Port>();
  private macs = new Map<string, MacEntry>();
  private listeners = new Set<(e: SwitchEvent) => void>();
  private now: () => number;
  agingMs: number;
  hub: boolean;

  constructor(o: SwitchOptions = {}) {
    this.agingMs = o.agingMs ?? 300_000;
    this.hub = o.hub ?? false;
    this.now = o.now ?? (() => Date.now());
  }

  on(fn: (e: SwitchEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: SwitchEvent) {
    for (const fn of this.listeners) fn(e);
  }

  addPort(id: string, cfg: PortConfig, deliver: (frame: Uint8Array) => void): void {
    if (this.ports.has(id)) throw new Error(`port ${id} already exists`);
    this.ports.set(id, { id, cfg: this.normal(cfg), deliver, counters: { rx: 0, tx: 0, drop: 0, rxBytes: 0, txBytes: 0 } });
  }

  removePort(id: string): void {
    this.ports.delete(id);
    for (const [k, e] of this.macs) if (e.port === id) this.macs.delete(k);
  }

  setPort(id: string, patch: Partial<PortConfig>): void {
    const p = this.ports.get(id);
    if (!p) throw new Error(`no port ${id}`);
    p.cfg = this.normal({ ...p.cfg, ...patch });
    // A port that goes down or changes VLAN loses what was learned behind it, as on real switches.
    for (const [k, e] of this.macs) if (e.port === id) this.macs.delete(k);
  }

  portIds(): string[] {
    return [...this.ports.keys()];
  }

  counters(id: string): PortCounters | undefined {
    const c = this.ports.get(id)?.counters;
    return c ? { ...c } : undefined;
  }

  /** The MAC address table, after expiring old entries. */
  table(): MacEntry[] {
    this.expire();
    return [...this.macs.values()].sort((a, b) => a.vlan - b.vlan || a.port.localeCompare(b.port) || a.mac.localeCompare(b.mac));
  }

  /** Forget every learned address (the "clear mac address-table" button). */
  flushTable(): void {
    this.macs.clear();
  }

  private normal(c: PortConfig): Port['cfg'] {
    return { mode: c.mode, vlan: c.vlan ?? 1, vlans: [...(c.vlans ?? [])], up: c.up ?? true };
  }

  private expire() {
    const t = this.now();
    for (const [k, e] of this.macs)
      if (t - e.seen > this.agingMs) {
        this.macs.delete(k);
        this.emit({ t: 'l2.age', at: t, mac: e.mac, port: e.port, vlan: e.vlan });
      }
  }

  private carries(p: Port, vlan: number): boolean {
    if (!p.cfg.up) return false;
    return p.cfg.mode === 'access' ? p.cfg.vlan === vlan : p.cfg.vlan === vlan || p.cfg.vlans.includes(vlan);
  }

  private send(p: Port, vlan: number, untagged: Uint8Array) {
    const tagged = p.cfg.mode === 'trunk' && vlan !== p.cfg.vlan;
    const f = tagged ? addTag(untagged, vlan) : untagged.slice();
    p.counters.tx++;
    p.counters.txBytes += f.length;
    p.deliver(f);
  }

  /**
   * A frame arrived on a port. Returns the ports it was sent to.
   * The frame buffer is not kept; every output gets its own copy.
   */
  receive(portId: string, frame: Uint8Array): string[] {
    const inPort = this.ports.get(portId);
    if (!inPort) throw new Error(`no port ${portId}`);
    const at = this.now();
    let info: FrameInfo;
    try {
      info = parseFrame(frame);
    } catch {
      inPort.counters.drop++;
      return [];
    }
    inPort.counters.rx++;
    inPort.counters.rxBytes += frame.length;
    const drop = (vlan: number, reason: string) => {
      inPort.counters.drop++;
      this.emit({ t: 'l2.frame', at, in: portId, out: [], how: 'drop', vlan, info, reason });
      return [];
    };
    if (!inPort.cfg.up) return drop(inPort.cfg.vlan, 'port down');

    if (this.hub) {
      const out: string[] = [];
      for (const p of this.ports.values())
        if (p !== inPort && p.cfg.up) {
          p.counters.tx++;
          p.counters.txBytes += frame.length;
          p.deliver(frame.slice());
          out.push(p.id);
        }
      this.emit({ t: 'l2.frame', at, in: portId, out, how: 'hub', vlan: info.tag ?? inPort.cfg.vlan, info });
      return out;
    }

    // Ingress: which VLAN does the frame belong to?
    let vlan: number;
    let untagged = frame;
    if (info.tag !== undefined) {
      if (inPort.cfg.mode === 'access') return drop(info.tag, 'tagged frame on an access port');
      if (!inPort.cfg.vlans.includes(info.tag) && info.tag !== inPort.cfg.vlan) return drop(info.tag, `VLAN ${info.tag} is not allowed on this trunk`);
      vlan = info.tag;
      untagged = stripTag(frame);
    } else vlan = inPort.cfg.vlan;

    // Learn the source address (never a multicast one).
    this.expire();
    if (!(frame[6] & 1)) {
      const key = `${vlan}/${info.src}`;
      const old = this.macs.get(key);
      this.macs.set(key, { mac: info.src, port: portId, vlan, seen: at });
      if (!old || old.port !== portId) this.emit({ t: 'l2.learn', at, mac: info.src, port: portId, vlan, moved: old?.port });
    }

    // Forward, filter or flood.
    const known = info.multicast ? undefined : this.macs.get(`${vlan}/${info.dst}`);
    if (known) {
      if (known.port === portId) {
        this.emit({ t: 'l2.frame', at, in: portId, out: [], how: 'filter', vlan, info });
        return [];
      }
      const p = this.ports.get(known.port);
      if (p && this.carries(p, vlan)) {
        this.send(p, vlan, untagged);
        this.emit({ t: 'l2.frame', at, in: portId, out: [p.id], how: 'forward', vlan, info });
        return [p.id];
      }
    }
    const out: string[] = [];
    for (const p of this.ports.values())
      if (p !== inPort && this.carries(p, vlan)) {
        this.send(p, vlan, untagged);
        out.push(p.id);
      }
    this.emit({ t: 'l2.frame', at, in: portId, out, how: 'flood', vlan, info });
    return out;
  }

  snapshot(): { macs: MacEntry[]; hub: boolean; agingMs: number; ports: Record<string, PortConfig> } {
    return {
      macs: [...this.macs.values()].map((e) => ({ ...e })),
      hub: this.hub,
      agingMs: this.agingMs,
      ports: Object.fromEntries([...this.ports.values()].map((p) => [p.id, { ...p.cfg, vlans: [...p.cfg.vlans] }])),
    };
  }

  restore(s: ReturnType<L2Switch['snapshot']>): void {
    this.hub = s.hub;
    this.agingMs = s.agingMs;
    this.macs = new Map(s.macs.map((e) => [`${e.vlan}/${e.mac}`, { ...e }]));
    for (const [id, cfg] of Object.entries(s.ports)) {
      const p = this.ports.get(id);
      if (p) p.cfg = this.normal(cfg);
    }
  }
}
