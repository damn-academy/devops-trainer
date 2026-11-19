// The stable API of the "before Docker" lab (design 00 §6.13) for lessons,
// exams and the in-tab cloud: real Alpine machines on dt-switch.
//
//   const lab = new V86Lab({ nodes: [
//     { name: 'web', ip: '10.0.0.11/24' },
//     { name: 'db',  ip: '10.0.0.12/24', disks: [{ sizeMB: 512 }] },
//   ] });
//   await lab.start();                       // first machine boots or restores, the others clone its snapshot
//   await lab.exec('web', 'rc-service nginx start');
//   const facts = await lab.facts(['net', 'listen']);   // { web: Facts, db: Facts }
//   lab.link('db', false);                   // pull the cable
//   await lab.add({ name: 'vm-3', ip: '10.0.0.13/24' }); // the cloud creating a VM
//   lab.dispose();
//
// Every machine runs in its own worker; frames go through the page's
// L2Switch (switch.ts), so the lab host (engine/labhost) and the switch
// diagram see the same traffic. Addresses follow the course plan: 10.0.0.0/24,
// machine n gets 10.0.0.(10+n) and MAC 02:64:74:00:00:n unless given.

import type { Facts } from '../../core/types';
import { connectMachine, nodeMac } from './fabric';
import { V86Machine, type BootInfo, type Identity, type MachineAssets, type TransportFactory } from './machine';
import { PROFILES, type DiskSpec, type ProfileId } from './profiles';
import { L2Switch, type PortConfig } from './switch';

export interface LabNodeSpec {
  name: string;
  profile?: ProfileId;
  /** '10.0.0.11/24'; default 10.0.0.(10 + n)/24 unless `dhcp`. */
  ip?: string;
  dhcp?: boolean;
  mac?: string;
  gateway?: string;
  dns?: string;
  memoryMB?: number;
  disks?: DiskSpec[];
  /** Switch port: access VLAN or trunk (default access VLAN 1). */
  port?: PortConfig;
  /** Public keys for root's ~/.ssh/authorized_keys. */
  authorizedKeys?: string[];
  /** Root shell script run once after the machine is up (user data). */
  userData?: string;
  /** OPFS key of this machine's own saved state (the learner continues from it). */
  stateKey?: string;
}

export interface LabOptions {
  nodes?: LabNodeSpec[];
  /** Plug into an existing switch (the cloud and the lab host share one). */
  switch?: L2Switch;
  transport?: TransportFactory;
  assets?: MachineAssets;
  /** Fill /etc/hosts of every machine with the names of the others. Default true. */
  hosts?: boolean;
  bootCache?: boolean;
}

export interface LabNode {
  spec: LabNodeSpec;
  machine: V86Machine;
  boot: BootInfo | null;
  unplug: () => void;
}

/** Tab memory one lab machine takes, MiB: guest RAM plus the emulator (measured, see STATUS). */
export function labMachineMB(profile: ProfileId = 'lab-node', memoryMB = PROFILES[profile].memoryMB): number {
  return memoryMB + 60;
}

/** How many lab machines the device can take (design 00 §6.4 budgets). */
export function labCapacity(deviceMemoryGB: number | undefined): number {
  if (typeof deviceMemoryGB !== 'number') return 2;
  if (deviceMemoryGB >= 8) return 4;
  if (deviceMemoryGB >= 4) return 2;
  return 1;
}

/** Device names of a machine's blank disks in the guest (lab images boot from 9p, so hda is /dev/sda). */
export function diskDevices(disks: DiskSpec[]): string[] {
  return disks.map((d, i) => ((d.slot ?? (i === 0 ? 'hda' : 'hdb')) === 'hda' ? '/dev/sda' : '/dev/sdb'));
}

export class V86Lab {
  readonly switch: L2Switch;
  readonly nodes = new Map<string, LabNode>();
  private n = 0;
  private started = false;

  constructor(private o: LabOptions = {}) {
    this.switch = o.switch ?? new L2Switch({ agingMs: 300_000 });
  }

  get machines(): V86Machine[] {
    return [...this.nodes.values()].map((n) => n.machine);
  }

  machine(name: string): V86Machine {
    const n = this.nodes.get(name);
    if (!n) throw new Error(`no machine ${name} in the lab`);
    return n.machine;
  }

  private identity(spec: LabNodeSpec, index: number): Identity {
    const all = [...(this.o.nodes ?? []), ...[...this.nodes.values()].map((n) => n.spec)];
    const hosts: Record<string, string> = {};
    if (this.o.hosts !== false) for (const [i, s] of all.entries()) if (!s.dhcp) hosts[s.name] = s.ip ?? `10.0.0.${11 + i}/24`;
    return {
      hostname: spec.name,
      ip: spec.dhcp ? undefined : (spec.ip ?? `10.0.0.${11 + index}/24`),
      dhcp: spec.dhcp,
      mac: spec.mac ?? nodeMac(index + 1),
      gateway: spec.gateway,
      dns: spec.dns,
      hosts,
    };
  }

  /** Create, boot and plug in one machine. */
  async add(spec: LabNodeSpec): Promise<V86Machine> {
    if (this.nodes.has(spec.name)) throw new Error(`machine ${spec.name} already exists`);
    const index = this.n++;
    const m = new V86Machine({
      id: spec.name,
      profile: spec.profile ?? 'lab-node',
      identity: this.identity(spec, index),
      memoryMB: spec.memoryMB,
      disks: spec.disks,
      stateKey: spec.stateKey,
      transport: this.o.transport,
      assets: this.o.assets,
      bootCache: this.o.bootCache,
    });
    const unplug = connectMachine(this.switch, m, spec.port ?? { mode: 'access', vlan: 1 }, spec.name);
    const node: LabNode = { spec, machine: m, boot: null, unplug };
    this.nodes.set(spec.name, node);
    try {
      node.boot = await m.start();
    } catch (e) {
      unplug();
      this.nodes.delete(spec.name);
      throw e;
    }
    const keys = spec.authorizedKeys?.filter(Boolean) ?? [];
    if (keys.length) await m.exec(`mkdir -p /root/.ssh && chmod 700 /root/.ssh && printf '%s\\n' ${keys.map((k) => `'${k.replace(/'/g, `'\\''`)}'`).join(' ')} >> /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys`);
    if (spec.userData?.trim()) await m.exec(`cat > /root/.user-data <<'DT_USER_DATA'\n${spec.userData}\nDT_USER_DATA\nsh /root/.user-data > /var/log/user-data.log 2>&1`);
    return m;
  }

  /**
   * Start the machines of the options. The first one boots (or restores the
   * boot snapshot); the rest start together from that snapshot, so a lab of
   * four costs one boot.
   */
  async start(onMachine?: (name: string, boot: BootInfo) => void): Promise<Record<string, BootInfo | null>> {
    if (this.started) throw new Error('the lab is already started');
    this.started = true;
    const specs = this.o.nodes ?? [];
    if (!specs.length) return {};
    const first = await this.add(specs[0]);
    onMachine?.(specs[0].name, first.boot!);
    await first.bootSaved;
    await Promise.all(
      specs.slice(1).map(async (s) => {
        const m = await this.add(s);
        onMachine?.(s.name, m.boot!);
      }),
    );
    return Object.fromEntries([...this.nodes].map(([k, n]) => [k, n.boot]));
  }

  exec(name: string, cmd: string) {
    return this.machine(name).exec(cmd);
  }

  /** Facts of every running machine, with these lab scopes collected too. */
  async facts(scopes: string[] = []): Promise<Record<string, Facts>> {
    const out: Record<string, Facts> = {};
    await Promise.all([...this.nodes].map(async ([name, n]) => (out[name] = await n.machine.facts(scopes))));
    return out;
  }

  /** Plug or unplug a machine's cable (the port goes down; the guest sees NO-CARRIER only on its own side of the switch). */
  link(name: string, up: boolean): void {
    this.switch.setPort(name, { up });
  }

  /** Pause or resume the CPU of a machine ("power" for exercises; the state stays in memory). */
  power(name: string, on: boolean): void {
    const m = this.machine(name);
    if (on) m.resume();
    else m.pause();
  }

  /** Remove a machine: unplug, stop the emulator. */
  remove(name: string): void {
    const n = this.nodes.get(name);
    if (!n) return;
    n.unplug();
    n.machine.dispose();
    this.nodes.delete(name);
  }

  /** Save every machine that has its own state key. */
  async persist(): Promise<void> {
    await Promise.all(this.machines.map((m) => m.persist()));
  }

  dispose(): void {
    for (const name of [...this.nodes.keys()]) this.remove(name);
  }
}
