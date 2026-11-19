// The narrow seam between the in-tab cloud and whatever boots machines.
//
// The cloud API (api.ts) decides *what* a VM is — name, flavor, image,
// address, MAC, VLAN, keys, disks — and calls a VmBackend to make it real.
// The real backend (v86-backend.ts) boots a v86 machine and plugs it into
// dt-switch; MockVmBackend below is for unit tests and for pages where the
// emulator is not available. The platform/v86 builder may provide another
// backend (custom images, blank disks) by implementing this interface.

/** What the cloud asks the backend to boot. Everything is already validated. */
export interface VmSpec {
  /** Cloud id, e.g. 'vm-1a2b3c4d'. Also the switch port id. */
  id: string;
  name: string;
  hostname: string;
  /** Image name from VmBackend.images(). */
  image: string;
  memoryMB: number;
  /** '02:64:74:01:00:07' */
  mac: string;
  /** Address with prefix, e.g. '10.0.0.21/24'. The DHCP server leases the same one. */
  ip: string;
  gateway: string;
  dns: string[];
  /** 802.1Q VLAN of the VM's network on dt-switch (1 = the default network). */
  vlan: number;
  /** Search domain, 'lab'. */
  domain: string;
  sshAuthorizedKeys: string[];
  /** Raw user data (shell script or #cloud-config), may be empty. */
  userData: string;
  /** Firewall rules rendered as iptables-restore text for images that apply them. */
  firewall: string;
  /** Blank disks attached in this order (first one is the second disk of the machine). */
  disks: { id: string; sizeMB: number }[];
}

export interface VmBootInfo {
  kind: 'cold' | 'restored';
  ms: number;
}

/** A running machine as the cloud sees it. */
export interface VmHandle {
  readonly id: string;
  /** Last part of the serial console, for GET /vms/{id}/console. */
  console(): string;
  /** Live updates of the console text (the panel shows it). */
  onConsole?(fn: (text: string) => void): () => void;
  /** Devices of the attached disks inside the guest ('/dev/sdb'), in VmSpec.disks order. */
  diskDevices?(): string[];
  /** The underlying machine for the page (console widget); undefined in the mock. */
  machine?: unknown;
}

export interface BackendImage {
  name: string;
  description: string;
  minMemoryMB: number;
  ssh: boolean;
  cloudInit: boolean;
}

export interface VmBackend {
  /** 'v86' or 'mock' — shown in the panel. */
  readonly kind: string;
  images(): BackendImage[];
  /** Memory the tab can still give to new VMs, MiB (quota memory_mb is derived from it). */
  capacityMB(): number;
  /**
   * Boot the machine and connect it to the switch. Resolves when the guest is
   * up and the spec is applied (hostname, address, keys, user data started).
   * `progress` reports phases for the operation's message.
   */
  create(spec: VmSpec, progress: (message: string, pct: number) => void): Promise<{ handle: VmHandle; boot: VmBootInfo }>;
  /** Power off and disconnect, keeping the machine's disk state when possible. */
  stop(id: string): Promise<void>;
  /** Boot a stopped machine again (same spec, possibly changed disks). */
  start(spec: VmSpec, progress: (message: string, pct: number) => void): Promise<{ handle: VmHandle; boot: VmBootInfo }>;
  reboot(id: string): Promise<void>;
  /** Remove the machine and everything the backend kept for it. */
  destroy(id: string): Promise<void>;
  /** Firewall rules of a running VM changed. */
  updateFirewall?(id: string, firewall: string): Promise<void>;
}

/**
 * A backend without machines: boots take `bootMs` of (injectable) time and
 * every spec is recorded. Used by unit tests and when v86 is not available.
 */
export class MockVmBackend implements VmBackend {
  readonly kind = 'mock';
  readonly created: VmSpec[] = [];
  readonly running = new Map<string, VmSpec>();
  readonly log: string[] = [];
  /** Image names whose boot fails (to test ERROR states). */
  failImages = new Set<string>();

  constructor(
    private o: { totalMB?: number; bootMs?: number; sleep?: (ms: number) => Promise<void> } = {},
  ) {}

  private sleep(ms: number): Promise<void> {
    return this.o.sleep ? this.o.sleep(ms) : new Promise((r) => setTimeout(r, ms));
  }

  images(): BackendImage[] {
    return [
      { name: 'buildroot-5.6', description: 'Linux 5.6 + BusyBox (the v86 demo image)', minMemoryMB: 32, ssh: false, cloudInit: false },
      { name: 'alpine-3.20', description: 'Alpine Linux 3.20 x86 with OpenSSH', minMemoryMB: 64, ssh: true, cloudInit: true },
    ];
  }

  capacityMB(): number {
    const used = [...this.running.values()].reduce((n, s) => n + s.memoryMB, 0);
    return (this.o.totalMB ?? 512) - used;
  }

  private handle(spec: VmSpec): VmHandle {
    return {
      id: spec.id,
      console: () => `mock console of ${spec.hostname}\n${spec.hostname} login: `,
      diskDevices: () => spec.disks.map((_, i) => `/dev/sd${String.fromCharCode(98 + i)}`),
    };
  }

  async create(spec: VmSpec, progress: (message: string, pct: number) => void) {
    this.log.push(`create ${spec.id}`);
    if (this.failImages.has(spec.image)) throw new Error(`image ${spec.image} failed to boot: kernel panic`);
    this.created.push(spec);
    progress('booting', 30);
    await this.sleep(this.o.bootMs ?? 5);
    this.running.set(spec.id, spec);
    progress('applying cloud config', 90);
    return { handle: this.handle(spec), boot: { kind: 'cold' as const, ms: this.o.bootMs ?? 5 } };
  }

  async start(spec: VmSpec, progress: (message: string, pct: number) => void) {
    this.log.push(`start ${spec.id}`);
    progress('restoring', 50);
    await this.sleep(this.o.bootMs ?? 5);
    this.running.set(spec.id, spec);
    return { handle: this.handle(spec), boot: { kind: 'restored' as const, ms: this.o.bootMs ?? 5 } };
  }

  async stop(id: string) {
    this.log.push(`stop ${id}`);
    this.running.delete(id);
  }

  async reboot(id: string) {
    this.log.push(`reboot ${id}`);
    await this.sleep(this.o.bootMs ?? 5);
  }

  async destroy(id: string) {
    this.log.push(`destroy ${id}`);
    this.running.delete(id);
  }

  async updateFirewall(id: string) {
    this.log.push(`firewall ${id}`);
  }
}
