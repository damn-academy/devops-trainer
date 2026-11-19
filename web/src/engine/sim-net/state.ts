// The network state attached to a simulated machine (machine.ext('net')).
// It is Snapshotable, so "reset the screen" and saved sessions bring the
// whole network back. Files of the local host live in the machine's VFS and
// are reached through FileIo.

import type { SimMachineApi, Snapshotable } from '../../core/types';
import { COURSE_DATE, emptyNf, type FileIo, type World } from './world';

export interface Probe {
  id: string;
  kind: 'icmp' | 'tcp' | 'http' | 'dns';
  /** Host id the probe runs from (default: the local host). */
  from?: string;
  /** Address or name (icmp, tcp, dns) or URL (http). */
  to: string;
  port?: number;
  count?: number;
  /** DNS: record type. */
  qtype?: string;
}

export interface ProbeResult {
  kind: Probe['kind'];
  from: string;
  to: string;
  sent?: number;
  received?: number;
  connected?: boolean;
  error?: string;
  status?: number;
  ms?: number;
  answer?: string[];
  rcode?: string;
  stage?: string;
  tlsError?: string;
}

export class NetState implements Snapshotable {
  world: World;
  probes: Probe[] = [];
  /** Index into world.capture up to which tcpdump has already printed. */
  readPos = 0;
  readonly io: FileIo;

  constructor(m: SimMachineApi) {
    this.world = defaultWorld(m.hostname);
    this.io = {
      read: (path) => {
        try {
          return m.rootFs.readFile(path);
        } catch {
          return undefined;
        }
      },
      append: (path, text) => {
        try {
          const dir = path.slice(0, path.lastIndexOf('/')) || '/';
          if (!m.rootFs.exists(dir)) m.rootFs.mkdir(dir, { parents: true });
          m.rootFs.writeFile(path, text, { append: true });
        } catch {
          /* a read-only or missing place: the log line is lost, as on a full disk */
        }
      },
    };
  }

  /** The local host (the one the terminal is on). */
  get local() {
    return this.world.hosts[this.world.local];
  }

  /**
   * Pull settings the learner may have changed through files: /proc/sys/net/ipv4/ip_forward.
   * (The shell's kernel rebuilds /proc itself; if it ever carries this file, writes to it count.)
   */
  pull(): void {
    const v = this.io.read('/proc/sys/net/ipv4/ip_forward');
    if (v !== undefined && this.local) this.local.ipForward = v.trim() === '1';
  }

  snapshot(): unknown {
    return { world: this.world, probes: this.probes, readPos: this.readPos };
  }

  restore(s: unknown): void {
    const v = s as { world: World; probes: Probe[]; readPos: number } | undefined;
    if (!v?.world) return;
    this.world = JSON.parse(JSON.stringify(v.world)) as World;
    this.probes = v.probes ?? [];
    this.readPos = v.readPos ?? 0;
  }
}

/** Get (or create) the network state of a machine. */
export function netOf(m: SimMachineApi): NetState {
  return m.ext('net', () => new NetState(m));
}

/**
 * A machine without a network lab: one interface with the address a VM gets
 * from a hypervisor's user-mode network (10.0.2.15/24, gateway 10.0.2.2), and a
 * gateway that has no way further — "this machine does not see the internet".
 */
export function defaultWorld(hostname: string): World {
  const nf = emptyNf;
  return {
    local: 'self',
    clock: COURSE_DATE,
    counter: 40,
    capture: [],
    segs: { lan: { id: 'lan', latency: 0.3, kind: 'lan' } },
    hosts: {
      self: {
        id: 'self',
        name: hostname,
        ifaces: [
          { name: 'lo', mac: '00:00:00:00:00:00', addrs: ['127.0.0.1/8'], up: true, mtu: 65536 },
          { name: 'eth0', mac: '52:54:00:12:34:56', addrs: ['10.0.2.15/24'], up: true, mtu: 1500, seg: 'lan' },
        ],
        routes: [{ dst: 'default', via: '10.0.2.2', dev: 'eth0', proto: 'dhcp' }],
        neigh: [],
        ipForward: false,
        nf: nf(),
        conntrack: [],
        services: [],
        files: {},
      },
      gw: {
        id: 'gw',
        name: 'gateway',
        ifaces: [
          { name: 'lo', mac: '00:00:00:00:00:00', addrs: ['127.0.0.1/8'], up: true, mtu: 65536 },
          { name: 'eth0', mac: '52:55:0a:00:02:02', addrs: ['10.0.2.2/24'], up: true, mtu: 1500, seg: 'lan' },
        ],
        routes: [],
        neigh: [],
        ipForward: true,
        nf: nf(),
        conntrack: [],
        services: [],
        files: {},
      },
    },
  };
}
