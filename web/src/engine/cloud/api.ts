// The in-tab cloud: state, validation, quotas, operations and the REST API
// of openapi.yaml, served at api.cloud.lab. Pure TypeScript with injectable
// time and a VmBackend; the lab (lab.ts) puts it on the network.

import type { HttpRequest, HttpResponse } from '../labhost/http';
import { json } from '../labhost/http';
import { cidrOverlap, cidrToString, inCidr, ipToNum, isIp, numToIp, parseCidr, type Cidr } from '../labhost/wire';
import { sha1 } from '../labhost/git/objects';
import type { VmBackend, VmHandle, VmSpec } from './vm-backend';

export const API_VERSION = '1.0.0';
export const REGION = 'lab-1';
export const ZONE = 'lab-1a';

// ── records ──

export interface Meta {
  id: string;
  name: string;
  project: string;
  description?: string;
  labels: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  created_at: string;
}
export interface AccessKeyRec {
  id: string;
  access_key_id: string;
  /** SHA-1 of the secret: the secret itself is shown once. */
  secret_hash: string;
  description: string;
  project: string;
  created_at: string;
}
export interface Network extends Meta {
  cidr: string;
  vlan: number;
  default: boolean;
  status: 'ACTIVE';
}
export interface Subnet extends Meta {
  network_id: string;
  cidr: string;
  gateway: string;
  dhcp: boolean;
  dns_servers: string[];
  status: 'ACTIVE';
}
export interface SecurityRule {
  direction: 'ingress' | 'egress';
  protocol: 'tcp' | 'udp' | 'icmp' | 'all';
  port_min?: number;
  port_max?: number;
  cidr: string;
  description?: string;
}
export interface SecurityGroup extends Meta {
  rules: SecurityRule[];
}
export interface SshKey extends Meta {
  public_key: string;
  fingerprint: string;
}
export type VmStatus = 'PENDING' | 'PROVISIONING' | 'RUNNING' | 'STOPPING' | 'STOPPED' | 'STARTING' | 'REBOOTING' | 'DELETING' | 'ERROR';
export interface Vm extends Meta {
  hostname: string;
  flavor: string;
  image: string;
  memory_mb: number;
  subnet_id: string;
  network_id: string;
  ip: string;
  mac: string;
  fqdn: string;
  security_group_ids: string[];
  ssh_key_ids: string[];
  ssh_authorized_keys: string[];
  user_data: string;
  disk_ids: string[];
  status: VmStatus;
  status_message: string;
  boot: { kind: 'cold' | 'restored'; ms: number } | null;
  started_at: string | null;
}
export interface Disk extends Meta {
  size_mb: number;
  status: 'CREATING' | 'AVAILABLE' | 'IN_USE' | 'DELETING' | 'ERROR';
  vm_id: string | null;
  device: string | null;
}
export interface Listener {
  protocol: 'http';
  port: number;
  target_port: number;
}
export interface HealthCheck {
  path: string;
  port?: number;
  interval_s: number;
  healthy_threshold: number;
  unhealthy_threshold: number;
}
export interface LoadBalancer extends Meta {
  subnet_id: string;
  vip: string;
  fqdn: string;
  listeners: Listener[];
  target_vm_ids: string[];
  algorithm: 'round_robin' | 'least_connections';
  health_check: HealthCheck;
  status: 'PENDING' | 'ACTIVE' | 'DELETING' | 'ERROR';
}
export interface DnsZone extends Meta {}
export interface DnsRecordRec extends Meta {
  zone_id: string;
  fqdn: string;
  type: 'A' | 'CNAME' | 'TXT';
  values: string[];
  ttl: number;
}
export interface Bucket extends Meta {
  versioning: boolean;
}
export type OpStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR';
export interface Operation {
  id: string;
  kind: string;
  project: string;
  target: { type: string; id: string; name: string };
  status: OpStatus;
  progress: number;
  message: string;
  error: { code: string; message: string } | null;
  created_at: string;
  started_at: string | null;
  done_at: string | null;
}

export interface CloudState {
  v: 1;
  seq: number;
  projects: Project[];
  keys: AccessKeyRec[];
  networks: Network[];
  subnets: Subnet[];
  securityGroups: SecurityGroup[];
  sshKeys: SshKey[];
  vms: Vm[];
  disks: Disk[];
  loadBalancers: LoadBalancer[];
  zones: DnsZone[];
  records: DnsRecordRec[];
  buckets: Bucket[];
  operations: Operation[];
  /** The secret of the first key of project default, for the panel. */
  bootstrapSecret: string;
}

export const FLAVORS = [
  { name: 'lab.nano', memory_mb: 32, vcpus: 1 },
  { name: 'lab.micro', memory_mb: 64, vcpus: 1 },
  { name: 'lab.small', memory_mb: 128, vcpus: 1 },
  { name: 'lab.medium', memory_mb: 256, vcpus: 1 },
];

export interface Limits {
  vms: number;
  memory_mb: number;
  disks: number;
  disk_mb: number;
  networks: number;
  load_balancers: number;
  buckets: number;
  storage_mb: number;
}

export const DEFAULT_LIMITS: Limits = { vms: 5, memory_mb: 1024, disks: 8, disk_mb: 2048, networks: 4, load_balancers: 3, buckets: 10, storage_mb: 64 };

export type CloudEvent =
  | { t: 'change'; kind: string; id: string; what: 'create' | 'update' | 'delete' }
  | { t: 'op'; op: Operation }
  | { t: 'request'; method: string; path: string; status: number; from: string; ms: number };

/** Thrown inside handlers; becomes the Error body. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

const NAME = /^[a-z][a-z0-9-]{0,62}$/;
const ACTIVE_VM: VmStatus[] = ['PENDING', 'PROVISIONING', 'RUNNING', 'STARTING', 'REBOOTING', 'STOPPING'];
const BUSY_VM: VmStatus[] = ['PENDING', 'PROVISIONING', 'STARTING', 'REBOOTING', 'STOPPING', 'DELETING'];
const RESERVED_ZONES = ['lab', 'cloud.lab', 'git.lab', 'mirror.lab', 'vm.lab', 'lb.lab', 'ci.lab'];

export interface CloudOptions {
  backend: VmBackend;
  now?: () => number;
  /** Delays of fast simulated work (disk format, LB programming), ms. */
  delays?: { disk?: number; lb?: number; step?: number };
  limits?: Partial<Limits>;
  /** Bytes stored in object storage per project (from the S3 store). */
  storageBytes?: (project: string) => number;
  /** Deterministic secrets for tests. */
  random?: () => number;
  /** Saved state from a previous visit. */
  state?: CloudState;
}

function invalid(field: string, reason: string): never {
  throw new ApiError(400, 'InvalidArgument', `${field}: ${reason}`, { field, reason });
}

export class Cloud {
  readonly backend: VmBackend;
  state: CloudState;
  readonly limits: Limits;
  private now: () => number;
  private delays: { disk: number; lb: number; step: number };
  private fns = new Set<(e: CloudEvent) => void>();
  private handles = new Map<string, VmHandle>();
  private waiters = new Map<string, (() => void)[]>();
  private reqSeq = 0;
  private random: () => number;
  storageBytes: (project: string) => number;
  /** Set by the lab that runs the load balancers: live health of each target, shown read-only in GET. */
  onLbTargets: ((lb: LoadBalancer) => { vm_id: string; ip: string; health: 'unknown' | 'healthy' | 'unhealthy'; reason: string }[]) | null = null;

  constructor(o: CloudOptions) {
    this.backend = o.backend;
    this.now = o.now ?? (() => Date.now());
    this.delays = { disk: o.delays?.disk ?? 400, lb: o.delays?.lb ?? 600, step: o.delays?.step ?? 0 };
    this.limits = { ...DEFAULT_LIMITS, ...(o.limits ?? {}) };
    this.random = o.random ?? Math.random;
    this.storageBytes = o.storageBytes ?? (() => 0);
    if (o.state) {
      this.state = o.state;
      // Machines do not survive a reload of the tab: they come back stopped.
      for (const vm of this.state.vms)
        if (vm.status !== 'STOPPED' && vm.status !== 'ERROR') {
          vm.status = 'STOPPED';
          vm.status_message = 'the tab was reloaded; start the VM again';
          vm.boot = null;
        }
      for (const op of this.state.operations)
        if (op.status === 'PENDING' || op.status === 'RUNNING') {
          op.status = 'ERROR';
          op.error = { code: 'Aborted', message: 'the tab was reloaded during the operation' };
          op.done_at = this.iso();
        }
      for (const d of this.state.disks) if (d.status === 'CREATING' || d.status === 'DELETING') d.status = 'AVAILABLE';
      for (const lb of this.state.loadBalancers) if (lb.status === 'PENDING') lb.status = 'ACTIVE';
    } else this.state = this.bootstrap();
  }

  // ── events ──

  on(fn: (e: CloudEvent) => void): () => void {
    this.fns.add(fn);
    return () => this.fns.delete(fn);
  }

  private emit(e: CloudEvent) {
    for (const f of this.fns) f(e);
  }

  private changed(kind: string, id: string, what: 'create' | 'update' | 'delete') {
    this.emit({ t: 'change', kind, id, what });
  }

  // ── ids and time ──

  private iso(): string {
    return new Date(this.now()).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  private hex(n: number): string {
    let s = '';
    for (let i = 0; i < n; i++) s += Math.floor(this.random() * 16).toString(16);
    return s;
  }

  private newId(prefix: string): string {
    this.state.seq++;
    return `${prefix}-${this.hex(8)}`;
  }

  private secret(): string {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let s = 'lab_';
    for (let i = 0; i < 32; i++) s += abc[Math.floor(this.random() * abc.length)];
    return s;
  }

  private bootstrap(): CloudState {
    this.state = { v: 1, seq: 0, projects: [], keys: [], networks: [], subnets: [], securityGroups: [], sshKeys: [], vms: [], disks: [], loadBalancers: [], zones: [], records: [], buckets: [], operations: [], bootstrapSecret: '' };
    const p = this.createProject('default');
    this.state.bootstrapSecret = this.createKey(p.id, 'created with the project').secret;
    return this.state;
  }

  createProject(name: string): Project {
    const t = this.iso();
    const p: Project = { id: this.newId('prj'), name, created_at: t };
    this.state.projects.push(p);
    const meta = (prefix: string, n: string): Meta => ({ id: this.newId(prefix), name: n, project: p.id, labels: {}, created_at: t, updated_at: t });
    const first = this.state.projects.length === 1;
    const net: Network = { ...meta('net', 'default'), cidr: first ? '10.0.0.0/16' : `10.${100 + this.state.projects.length}.0.0/16`, vlan: first ? 1 : this.freeVlan(), default: true, status: 'ACTIVE' };
    this.state.networks.push(net);
    const sub = first ? '10.0.0.0/24' : `10.${100 + this.state.projects.length}.0.0/24`;
    const c = parseCidr(sub);
    this.state.subnets.push({ ...meta('subnet', 'default'), network_id: net.id, cidr: sub, gateway: numToIp(c.net + 1), dhcp: true, dns_servers: [numToIp(c.net + 1)], status: 'ACTIVE' });
    this.state.securityGroups.push({
      ...meta('sg', 'default'),
      description: 'ssh, ping and everything from the lab networks',
      rules: [
        { direction: 'ingress', protocol: 'all', cidr: '10.0.0.0/8', description: 'the lab networks' },
        { direction: 'ingress', protocol: 'tcp', port_min: 22, port_max: 22, cidr: '0.0.0.0/0', description: 'ssh' },
        { direction: 'ingress', protocol: 'icmp', cidr: '0.0.0.0/0', description: 'ping' },
        { direction: 'egress', protocol: 'all', cidr: '0.0.0.0/0' },
      ],
    });
    return p;
  }

  createKey(project: string, description: string): AccessKeyRec & { secret: string } {
    const secret = this.secret();
    const id = this.newId('key');
    const k: AccessKeyRec = { id, access_key_id: `AKLAB${id.slice(4).toUpperCase()}`, secret_hash: sha1(new TextEncoder().encode(secret)), description, project, created_at: this.iso() };
    this.state.keys.push(k);
    return { ...k, secret };
  }

  private freeVlan(): number {
    for (let v = 100; v < 4000; v++) if (!this.state.networks.some((n) => n.vlan === v)) return v;
    throw new ApiError(403, 'QuotaExceeded', 'no free VLAN on the switch');
  }

  // ── lookups for the lab ──

  project(id: string): Project | undefined {
    return this.state.projects.find((p) => p.id === id || p.name === id);
  }

  subnetOf(vm: Vm): Subnet | undefined {
    return this.state.subnets.find((s) => s.id === vm.subnet_id);
  }

  networkOf(s: Subnet): Network | undefined {
    return this.state.networks.find((n) => n.id === s.network_id);
  }

  vmByIp(ip: string, vlan?: number): Vm | undefined {
    return this.state.vms.find((v) => v.ip === ip && (vlan === undefined || this.vlanOf(v) === vlan));
  }

  vlanOf(vm: Vm): number {
    const s = this.subnetOf(vm);
    return (s && this.networkOf(s)?.vlan) ?? 1;
  }

  handle(vmId: string): VmHandle | undefined {
    return this.handles.get(vmId);
  }

  keyBySecret(secret: string): AccessKeyRec | undefined {
    const h = sha1(new TextEncoder().encode(secret));
    return this.state.keys.find((k) => k.secret_hash === h);
  }

  keyById(accessKeyId: string): AccessKeyRec | undefined {
    return this.state.keys.find((k) => k.access_key_id === accessKeyId);
  }

  /** Does the VM's security groups let this traffic in? (No groups: everything.) */
  allows(vm: Vm, proto: 'tcp' | 'udp' | 'icmp', port: number | undefined, src: string): boolean {
    if (!vm.security_group_ids.length) return true;
    const s = ipToNum(src);
    for (const id of vm.security_group_ids) {
      const g = this.state.securityGroups.find((x) => x.id === id);
      for (const r of g?.rules ?? []) {
        if (r.direction !== 'ingress') continue;
        if (r.protocol !== 'all' && r.protocol !== proto) continue;
        if (!inCidr(s, parseCidr(r.cidr))) continue;
        if ((proto === 'tcp' || proto === 'udp') && r.protocol !== 'all' && r.port_min !== undefined && (port === undefined || port < r.port_min || port > (r.port_max ?? r.port_min))) continue;
        return true;
      }
    }
    return false;
  }

  /** iptables-restore text for a VM (empty when it has no security groups). */
  firewall(vm: Pick<Vm, 'security_group_ids'>): string {
    if (!vm.security_group_ids.length) return '';
    const rules = vm.security_group_ids.flatMap((id) => this.state.securityGroups.find((g) => g.id === id)?.rules ?? []);
    const line = (chain: string, r: SecurityRule) => {
      const parts = [`-A ${chain}`];
      if (r.protocol !== 'all') parts.push(`-p ${r.protocol}`);
      if (r.cidr !== '0.0.0.0/0') parts.push(chain === 'INPUT' ? `-s ${r.cidr}` : `-d ${r.cidr}`);
      if ((r.protocol === 'tcp' || r.protocol === 'udp') && r.port_min !== undefined) parts.push(`--dport ${r.port_min}${r.port_max && r.port_max !== r.port_min ? `:${r.port_max}` : ''}`);
      return `${parts.join(' ')} -j ACCEPT`;
    };
    const ing = rules.filter((r) => r.direction === 'ingress');
    const eg = rules.filter((r) => r.direction === 'egress');
    const egressAll = !eg.length || eg.some((r) => r.protocol === 'all' && r.cidr === '0.0.0.0/0');
    return [
      '*filter',
      ':INPUT DROP [0:0]',
      ':FORWARD ACCEPT [0:0]',
      `:OUTPUT ${egressAll ? 'ACCEPT' : 'DROP'} [0:0]`,
      '-A INPUT -i lo -j ACCEPT',
      '-A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT',
      '-A INPUT -p udp --sport 67 --dport 68 -j ACCEPT',
      ...ing.map((r) => line('INPUT', r)),
      ...(egressAll ? [] : ['-A OUTPUT -o lo -j ACCEPT', '-A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT', '-A OUTPUT -p udp --dport 53 -j ACCEPT', ...eg.map((r) => line('OUTPUT', r))]),
      'COMMIT',
      '',
    ].join('\n');
  }

  spec(vm: Vm): VmSpec {
    const s = this.subnetOf(vm)!;
    const c = parseCidr(s.cidr);
    const keys = [...vm.ssh_key_ids.map((id) => this.state.sshKeys.find((k) => k.id === id)?.public_key ?? ''), ...vm.ssh_authorized_keys].filter(Boolean);
    return {
      id: vm.id,
      name: vm.name,
      hostname: vm.hostname,
      image: vm.image,
      memoryMB: vm.memory_mb,
      mac: vm.mac,
      ip: `${vm.ip}/${c.prefix}`,
      gateway: s.gateway,
      dns: s.dns_servers,
      vlan: this.vlanOf(vm),
      domain: 'lab',
      sshAuthorizedKeys: keys,
      userData: vm.user_data,
      firewall: this.firewall(vm),
      disks: vm.disk_ids.map((id) => ({ id, sizeMB: this.state.disks.find((d) => d.id === id)?.size_mb ?? 0 })),
    };
  }

  // ── quotas ──

  usage(project: string): Record<keyof Limits, { limit: number; used: number }> {
    const vms = this.state.vms.filter((v) => v.project === project);
    const mem = vms.filter((v) => ACTIVE_VM.includes(v.status)).reduce((n, v) => n + v.memory_mb, 0);
    const allMem = this.state.vms.filter((v) => ACTIVE_VM.includes(v.status)).reduce((n, v) => n + v.memory_mb, 0);
    // The tab is shared by every project: what it can still give, plus what this project holds.
    const tabLimit = Math.max(0, Math.floor(this.backend.capacityMB()) + allMem);
    const disks = this.state.disks.filter((d) => d.project === project);
    return {
      vms: { limit: this.limits.vms, used: vms.length },
      memory_mb: { limit: Math.min(this.limits.memory_mb, tabLimit), used: mem },
      disks: { limit: this.limits.disks, used: disks.length },
      disk_mb: { limit: this.limits.disk_mb, used: disks.reduce((n, d) => n + d.size_mb, 0) },
      networks: { limit: this.limits.networks, used: this.state.networks.filter((n) => n.project === project).length },
      load_balancers: { limit: this.limits.load_balancers, used: this.state.loadBalancers.filter((l) => l.project === project).length },
      buckets: { limit: this.limits.buckets, used: this.state.buckets.filter((b) => b.project === project).length },
      storage_mb: { limit: this.limits.storage_mb, used: Math.ceil(this.storageBytes(project) / (1024 * 1024)) },
    };
  }

  private need(project: string, quota: keyof Limits, requested: number) {
    const q = this.usage(project)[quota];
    if (q.used + requested > q.limit)
      throw new ApiError(403, 'QuotaExceeded', `quota ${quota} exceeded: limit ${q.limit}, used ${q.used}, requested ${requested}`, { quota, limit: q.limit, used: q.used, requested });
  }

  // ── operations ──

  private newOp(project: string, kind: string, target: { type: string; id: string; name: string }): Operation {
    const op: Operation = { id: this.newId('op'), kind, project, target, status: 'PENDING', progress: 0, message: 'queued', error: null, created_at: this.iso(), started_at: null, done_at: null };
    this.state.operations.unshift(op);
    if (this.state.operations.length > 200) this.state.operations.length = 200;
    this.emit({ t: 'op', op });
    return op;
  }

  private opUpdate(op: Operation, patch: Partial<Operation>) {
    Object.assign(op, patch);
    if (patch.status === 'RUNNING' && !op.started_at) op.started_at = this.iso();
    if (patch.status === 'DONE' || patch.status === 'ERROR') {
      op.done_at = this.iso();
      if (patch.status === 'DONE') op.progress = 100;
      for (const w of this.waiters.get(op.id) ?? []) w();
      this.waiters.delete(op.id);
    }
    this.emit({ t: 'op', op });
  }

  private run(op: Operation, work: (progress: (message: string, pct: number) => void) => Promise<void>) {
    setTimeout(async () => {
      this.opUpdate(op, { status: 'RUNNING', message: 'started', progress: 5 });
      try {
        await work((message, pct) => this.opUpdate(op, { message, progress: Math.max(op.progress, Math.min(99, pct)) }));
        this.opUpdate(op, { status: 'DONE', message: 'done' });
      } catch (e) {
        const err = e as Error & { code?: string };
        this.opUpdate(op, { status: 'ERROR', message: 'failed', error: { code: err instanceof ApiError ? err.code : (err.code ?? 'Internal'), message: err.message } });
      }
    }, this.delays.step);
  }

  /** Resolves when the operation is finished or after `ms`. */
  waitOp(id: string, ms: number): Promise<void> {
    const op = this.state.operations.find((o) => o.id === id);
    if (!op || op.status === 'DONE' || op.status === 'ERROR' || ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      const list = this.waiters.get(id) ?? [];
      list.push(() => {
        clearTimeout(t);
        resolve();
      });
      this.waiters.set(id, list);
    });
  }

  private sleep(ms: number) {
    return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();
  }

  // ── address allocation ──

  private pools(s: Subnet): { vm: [number, number]; lb: [number, number] } {
    const c = parseCidr(s.cidr);
    const bcast = (c.net | ~c.mask) >>> 0;
    if (s.cidr === '10.0.0.0/24') return { vm: [c.net + 20, c.net + 99], lb: [c.net + 200, c.net + 249] };
    const size = bcast - c.net;
    const lbCount = Math.max(1, Math.min(10, Math.floor(size / 8)));
    return { vm: [c.net + Math.min(10, Math.floor(size / 4)), bcast - lbCount - 1], lb: [bcast - lbCount, bcast - 1] };
  }

  private usedIps(subnetId: string): Set<string> {
    const s = new Set<string>();
    for (const v of this.state.vms) if (v.subnet_id === subnetId) s.add(v.ip);
    for (const l of this.state.loadBalancers) if (l.subnet_id === subnetId) s.add(l.vip);
    return s;
  }

  private allocate(s: Subnet, kind: 'vm' | 'lb'): string {
    const [from, to] = this.pools(s)[kind];
    const used = this.usedIps(s.id);
    for (let n = from; n <= to; n++) if (!used.has(numToIp(n))) return numToIp(n);
    throw new ApiError(409, 'FailedPrecondition', `subnet ${s.name} has no free addresses for a ${kind === 'vm' ? 'VM' : 'load balancer'}`);
  }

  availableIps(s: Subnet): number {
    const [from, to] = this.pools(s).vm;
    const used = this.usedIps(s.id);
    let n = 0;
    for (let i = from; i <= to; i++) if (!used.has(numToIp(i))) n++;
    return n;
  }

  private mac(): string {
    const n = ++this.state.seq;
    return `02:64:74:01:${((n >> 8) & 255).toString(16).padStart(2, '0')}:${(n & 255).toString(16).padStart(2, '0')}`;
  }

  // ── the REST API ──

  handleHttp = async (req: HttpRequest): Promise<HttpResponse> => {
    const t0 = this.now();
    const rid = `req-${(++this.reqSeq).toString(16).padStart(8, '0')}`;
    let res: HttpResponse;
    try {
      res = await this.route(req);
    } catch (e) {
      if (e instanceof ApiError) res = json(e.status, { error: { code: e.code, message: e.message, status: e.status, request_id: rid, ...(e.details ? { details: e.details } : {}) } });
      else res = json(500, { error: { code: 'Internal', message: (e as Error).message, status: 500, request_id: rid } });
    }
    res.headers = { ...(res.headers ?? {}), 'x-request-id': rid };
    this.emit({ t: 'request', method: req.method, path: req.target, status: res.status, from: req.remote.ip, ms: this.now() - t0 });
    return res;
  };

  private auth(req: HttpRequest): AccessKeyRec {
    const h = req.headers['authorization'] ?? '';
    const m = /^Bearer\s+(\S+)$/i.exec(h);
    if (!m) throw new ApiError(401, 'Unauthenticated', 'missing header Authorization: Bearer <access key secret>');
    const k = this.keyBySecret(m[1]);
    if (!k) throw new ApiError(401, 'Unauthenticated', 'unknown or revoked access key');
    return k;
  }

  private body(req: HttpRequest): Record<string, unknown> {
    if (!req.body.length) return {};
    if (!/json/.test(req.headers['content-type'] ?? 'application/json') && !(req.headers['content-type'] ?? '').startsWith('application/x-www-form-urlencoded'))
      throw new ApiError(400, 'InvalidArgument', `Content-Type must be application/json, got ${req.headers['content-type']}`);
    let v: unknown;
    try {
      v = JSON.parse(new TextDecoder().decode(req.body));
    } catch (e) {
      throw new ApiError(400, 'InvalidArgument', `body is not valid JSON: ${(e as Error).message}`);
    }
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ApiError(400, 'InvalidArgument', 'body must be a JSON object');
    return v as Record<string, unknown>;
  }

  private list<T extends { labels?: Record<string, string> }>(req: HttpRequest, items: T[], view: (x: T) => unknown = (x) => x): HttpResponse {
    const labels = req.query.getAll('label').map((l) => l.split('='));
    let out = items.filter((x) => labels.every(([k, v]) => x.labels?.[k] === v));
    const limit = Math.min(200, Math.max(1, Number(req.query.get('limit') ?? 50) || 50));
    const start = Number(req.query.get('page_token') ?? 0) || 0;
    const page = out.slice(start, start + limit);
    const next = start + limit < out.length ? String(start + limit) : null;
    out = page;
    return json(200, { items: out.map(view), next_page_token: next });
  }

  private accepted(op: Operation): HttpResponse {
    return json(202, op, { location: `/v1/operations/${op.id}` });
  }

  private async route(req: HttpRequest): Promise<HttpResponse> {
    const path = req.path.replace(/\/+$/, '') || '/';
    if (path === '/' || path === '/v1') {
      if (req.method !== 'GET') throw new ApiError(405, 'MethodNotAllowed', `${req.method} ${path}`);
      return json(200, {
        name: 'lab-cloud',
        version: API_VERSION,
        region: REGION,
        endpoints: { api: 'http://api.cloud.lab/v1', s3: 'http://s3.cloud.lab', metadata: 'http://169.254.169.254/latest/meta-data/', git: 'http://git.lab/', mirror: 'http://mirror.lab/' },
        docs: 'http://api.cloud.lab/openapi.yaml',
      });
    }
    if (!path.startsWith('/v1/')) throw new ApiError(404, 'NotFound', `no such path: ${path} (the API lives under /v1)`);
    const seg = path.slice(4).split('/');
    const m = req.method;
    // Public catalog.
    if (seg[0] === 'flavors' && seg.length === 1) return this.list(req, FLAVORS as never[]);
    if (seg[0] === 'images' && seg.length === 1)
      return this.list(
        req,
        this.backend.images().map((i) => ({ name: i.name, description: i.description, os: 'linux', min_memory_mb: i.minMemoryMB, ssh: i.ssh, cloud_init: i.cloudInit })) as never[],
      );
    if (seg[0] === 'regions' && seg.length === 1) return json(200, { items: [{ name: REGION, zones: [ZONE] }] });

    const key = this.auth(req);
    const myProject = this.state.projects.find((p) => p.id === key.project)!;
    if (seg[0] === 'whoami') return json(200, { project: myProject, access_key_id: key.access_key_id });
    if (seg[0] === 'operations' && seg.length === 2) {
      const op = this.state.operations.find((o) => o.id === seg[1]);
      if (!op || op.project !== myProject.id) throw new ApiError(404, 'NotFound', `operation ${seg[1]} not found`);
      const wait = Math.min(60, Math.max(0, Number(req.query.get('wait') ?? 0) || 0));
      if (wait) await this.waitOp(op.id, wait * 1000);
      return json(200, op);
    }
    if (seg[0] !== 'projects') throw new ApiError(404, 'NotFound', `no such path: ${path}`);
    if (seg.length === 1) {
      if (m === 'GET') return this.list(req, [myProject] as never[]);
      if (m === 'POST') throw new ApiError(403, 'PermissionDenied', 'projects are created by the course, not by an access key');
      throw new ApiError(405, 'MethodNotAllowed', m);
    }
    const project = this.project(seg[1]);
    if (!project) throw new ApiError(404, 'NotFound', `project ${seg[1]} not found`);
    if (project.id !== myProject.id) throw new ApiError(403, 'PermissionDenied', `the access key belongs to project ${myProject.name}, not ${project.name}`);
    const pid = project.id;
    if (seg.length === 2) {
      if (m !== 'GET') throw new ApiError(405, 'MethodNotAllowed', m);
      return json(200, project);
    }
    const kind = seg[2];
    const id = seg[3];
    const action = seg[4];
    switch (kind) {
      case 'quotas':
        return json(200, this.usage(pid));
      case 'operations': {
        const st = req.query.get('status');
        return this.list(
          req,
          this.state.operations.filter((o) => o.project === pid && (!st || o.status === st)) as never[],
        );
      }
      case 'access-keys':
        return this.keysApi(req, pid, id);
      case 'networks':
        return this.networksApi(req, pid, id);
      case 'subnets':
        return this.subnetsApi(req, pid, id);
      case 'security-groups':
        return this.sgApi(req, pid, id);
      case 'ssh-keys':
        return this.sshKeysApi(req, pid, id);
      case 'vms':
        return this.vmsApi(req, pid, id, action, seg.length);
      case 'disks':
        return this.disksApi(req, pid, id, action);
      case 'load-balancers':
        return this.lbApi(req, pid, id);
      case 'dns':
        if (seg[3] !== 'zones') break;
        return this.dnsApi(req, pid, seg[4], seg[5], seg[6]);
      case 'buckets':
        return this.bucketsApi(req, pid, id);
    }
    throw new ApiError(404, 'NotFound', `no such path: ${path}`);
  }

  private find<T extends Meta>(list: T[], pid: string, ref: string, what: string): T {
    const x = list.find((r) => r.project === pid && (r.id === ref || r.name === ref));
    if (!x) throw new ApiError(404, 'NotFound', `${what} ${ref} not found`);
    return x;
  }

  private meta(pid: string, prefix: string, b: Record<string, unknown>, list: Meta[], what: string): Meta {
    const name = b.name;
    if (typeof name !== 'string' || !NAME.test(name)) invalid('name', 'must match ^[a-z][a-z0-9-]{0,62}$');
    if (list.some((x) => x.project === pid && x.name === name)) throw new ApiError(409, 'AlreadyExists', `${what} ${name} already exists`);
    const t = this.iso();
    return { id: this.newId(prefix), name, project: pid, description: typeof b.description === 'string' ? b.description : '', labels: this.labels(b.labels), created_at: t, updated_at: t };
  }

  private labels(v: unknown): Record<string, string> {
    if (v === undefined) return {};
    if (!v || typeof v !== 'object' || Array.isArray(v)) invalid('labels', 'must be an object of strings');
    const out: Record<string, string> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (!/^[a-z0-9][a-z0-9._/-]{0,62}$/.test(k)) invalid(`labels.${k}`, 'bad label key');
      if (typeof x !== 'string' || x.length > 63) invalid(`labels.${k}`, 'value must be a string up to 63 characters');
      out[k] = x;
    }
    return out;
  }

  private patchCommon(x: Meta, b: Record<string, unknown>, allowed: string[]) {
    for (const k of Object.keys(b)) if (!['labels', 'description', ...allowed].includes(k)) invalid(k, 'cannot be changed');
    if (b.labels !== undefined) x.labels = this.labels(b.labels);
    if (typeof b.description === 'string') x.description = b.description;
    x.updated_at = this.iso();
  }

  // access keys
  private keysApi(req: HttpRequest, pid: string, id?: string): HttpResponse {
    const view = (k: AccessKeyRec) => ({ id: k.id, access_key_id: k.access_key_id, description: k.description, project: k.project, created_at: k.created_at });
    if (!id) {
      if (req.method === 'GET') return this.list(req, this.state.keys.filter((k) => k.project === pid) as never[], view as never);
      if (req.method === 'POST') {
        const b = this.body(req);
        const k = this.createKey(pid, typeof b.description === 'string' ? b.description : '');
        this.changed('access-key', k.id, 'create');
        return json(201, { ...view(k), secret: k.secret });
      }
      throw new ApiError(405, 'MethodNotAllowed', req.method);
    }
    const k = this.state.keys.find((x) => x.project === pid && (x.id === id || x.access_key_id === id));
    if (!k) throw new ApiError(404, 'NotFound', `access key ${id} not found`);
    if (req.method === 'GET') return json(200, view(k));
    if (req.method === 'DELETE') {
      if (this.state.keys.filter((x) => x.project === pid).length === 1) throw new ApiError(409, 'FailedPrecondition', 'this is the last access key of the project; create another one first');
      this.state.keys = this.state.keys.filter((x) => x !== k);
      this.changed('access-key', k.id, 'delete');
      return { status: 204 };
    }
    throw new ApiError(405, 'MethodNotAllowed', req.method);
  }

  // networks
  private networksApi(req: HttpRequest, pid: string, id?: string): HttpResponse {
    const list = this.state.networks;
    if (!id) {
      if (req.method === 'GET') return this.list(req, list.filter((n) => n.project === pid));
      if (req.method === 'POST') {
        const b = this.body(req);
        const meta = this.meta(pid, 'net', b, list, 'network');
        this.need(pid, 'networks', 1);
        let cidr: Cidr;
        if (b.cidr === undefined) {
          let n = 10;
          while (list.some((x) => cidrOverlap(parseCidr(x.cidr), parseCidr(`10.${n}.0.0/16`)))) n++;
          cidr = parseCidr(`10.${n}.0.0/16`);
        } else {
          try {
            cidr = parseCidr(String(b.cidr));
          } catch {
            invalid('cidr', 'must be an IPv4 CIDR like 10.10.0.0/16');
          }
          if (cidr.prefix < 8 || cidr.prefix > 24) invalid('cidr', 'prefix must be between /8 and /24');
          if (!inCidr(cidr.net, parseCidr('10.0.0.0/8'))) invalid('cidr', 'must be inside 10.0.0.0/8');
          const clash = list.find((x) => cidrOverlap(parseCidr(x.cidr), cidr));
          if (clash) throw new ApiError(409, 'AlreadyExists', `cidr ${cidrToString(cidr)} overlaps network ${clash.name} (${clash.cidr})`, { field: 'cidr', conflicts_with: clash.id });
        }
        const net: Network = { ...meta, cidr: cidrToString(cidr), vlan: this.freeVlan(), default: false, status: 'ACTIVE' };
        list.push(net);
        this.changed('network', net.id, 'create');
        return json(201, net);
      }
      throw new ApiError(405, 'MethodNotAllowed', req.method);
    }
    const n = this.find(list, pid, id, 'network');
    if (req.method === 'GET') return json(200, n);
    if (req.method === 'PATCH') {
      this.patchCommon(n, this.body(req), []);
      this.changed('network', n.id, 'update');
      return json(200, n);
    }
    if (req.method === 'DELETE') {
      if (n.default) throw new ApiError(409, 'FailedPrecondition', 'the default network cannot be deleted');
      const subs = this.state.subnets.filter((s) => s.network_id === n.id);
      if (subs.length) throw new ApiError(409, 'FailedPrecondition', `network ${n.name} still has subnets: ${subs.map((s) => s.name).join(', ')}`, { in_use_by: subs.map((s) => s.id) });
      this.state.networks = list.filter((x) => x !== n);
      this.changed('network', n.id, 'delete');
      return { status: 204 };
    }
    throw new ApiError(405, 'MethodNotAllowed', req.method);
  }

  private subnetView = (s: Subnet) => ({ ...s, available_ips: this.availableIps(s) });

  private subnetsApi(req: HttpRequest, pid: string, id?: string): HttpResponse {
    const list = this.state.subnets;
    if (!id) {
      if (req.method === 'GET') return this.list(req, list.filter((n) => n.project === pid), this.subnetView as never);
      if (req.method === 'POST') {
        const b = this.body(req);
        const meta = this.meta(pid, 'subnet', b, list, 'subnet');
        if (typeof b.network_id !== 'string') invalid('network_id', 'required');
        const net = this.find(this.state.networks, pid, b.network_id, 'network');
        let c: Cidr;
        try {
          c = parseCidr(String(b.cidr));
        } catch {
          invalid('cidr', 'must be an IPv4 CIDR like 10.10.1.0/24');
        }
        if (c.prefix < 16 || c.prefix > 29) invalid('cidr', 'prefix must be between /16 and /29');
        const nc = parseCidr(net.cidr);
        if (!inCidr(c.net, nc) || c.prefix < nc.prefix) invalid('cidr', `must be inside the network ${net.name} (${net.cidr})`);
        const clash = list.find((x) => x.network_id === net.id && cidrOverlap(parseCidr(x.cidr), c));
        if (clash) throw new ApiError(409, 'AlreadyExists', `cidr ${cidrToString(c)} overlaps subnet ${clash.name} (${clash.cidr})`, { field: 'cidr', conflicts_with: clash.id });
        const gw = numToIp(c.net + 1);
        let dns = [gw];
        if (b.dns_servers !== undefined) {
          if (!Array.isArray(b.dns_servers) || !b.dns_servers.every((x) => typeof x === 'string' && isIp(x))) invalid('dns_servers', 'must be a list of IPv4 addresses');
          dns = b.dns_servers as string[];
        }
        const s: Subnet = { ...meta, network_id: net.id, cidr: cidrToString(c), gateway: gw, dhcp: b.dhcp !== false, dns_servers: dns, status: 'ACTIVE' };
        list.push(s);
        this.changed('subnet', s.id, 'create');
        return json(201, this.subnetView(s));
      }
      throw new ApiError(405, 'MethodNotAllowed', req.method);
    }
    const s = this.find(list, pid, id, 'subnet');
    if (req.method === 'GET') return json(200, this.subnetView(s));
    if (req.method === 'PATCH') {
      this.patchCommon(s, this.body(req), []);
      this.changed('subnet', s.id, 'update');
      return json(200, this.subnetView(s));
    }
    if (req.method === 'DELETE') {
      if (s.name === 'default' && this.networkOf(s)?.default) throw new ApiError(409, 'FailedPrecondition', 'the default subnet cannot be deleted');
      const users = [...this.state.vms.filter((v) => v.subnet_id === s.id).map((v) => v.id), ...this.state.loadBalancers.filter((l) => l.subnet_id === s.id).map((l) => l.id)];
      if (users.length) throw new ApiError(409, 'FailedPrecondition', `subnet ${s.name} is in use by ${users.join(', ')}`, { in_use_by: users });
      this.state.subnets = list.filter((x) => x !== s);
      this.changed('subnet', s.id, 'delete');
      return { status: 204 };
    }
    throw new ApiError(405, 'MethodNotAllowed', req.method);
  }

  private rules(v: unknown): SecurityRule[] {
    if (v === undefined) return [];
    if (!Array.isArray(v)) invalid('rules', 'must be a list');
    return v.map((r, i) => {
      const f = `rules[${i}]`;
      if (!r || typeof r !== 'object') invalid(f, 'must be an object');
      const x = r as Record<string, unknown>;
      if (x.direction !== 'ingress' && x.direction !== 'egress') invalid(`${f}.direction`, 'must be ingress or egress');
      if (!['tcp', 'udp', 'icmp', 'all'].includes(String(x.protocol))) invalid(`${f}.protocol`, 'must be tcp, udp, icmp or all');
      const out: SecurityRule = { direction: x.direction, protocol: x.protocol as SecurityRule['protocol'], cidr: '0.0.0.0/0' };
      if (x.cidr !== undefined) {
        try {
          out.cidr = cidrToString(parseCidr(String(x.cidr)));
        } catch {
          invalid(`${f}.cidr`, 'must be an IPv4 CIDR');
        }
      }
      for (const k of ['port_min', 'port_max'] as const)
        if (x[k] !== undefined) {
          if (out.protocol !== 'tcp' && out.protocol !== 'udp') invalid(`${f}.${k}`, 'ports apply only to tcp and udp');
          const n = Number(x[k]);
          if (!Number.isInteger(n) || n < 1 || n > 65535) invalid(`${f}.${k}`, 'must be 1–65535');
          out[k] = n;
        }
      if (out.port_max !== undefined && out.port_min === undefined) invalid(`${f}.port_min`, 'required with port_max');
      if (out.port_max !== undefined && out.port_min !== undefined && out.port_max < out.port_min) invalid(`${f}.port_max`, 'must be ≥ port_min');
      if (typeof x.description === 'string') out.description = x.description;
      return out;
    });
  }

  private sgApi(req: HttpRequest, pid: string, id?: string): HttpResponse {
    const list = this.state.securityGroups;
    if (!id) {
      if (req.method === 'GET') return this.list(req, list.filter((n) => n.project === pid));
      if (req.method === 'POST') {
        const b = this.body(req);
        const meta = this.meta(pid, 'sg', b, list, 'security group');
        const g: SecurityGroup = { ...meta, rules: this.rules(b.rules) };
        list.push(g);
        this.changed('security-group', g.id, 'create');
        return json(201, g);
      }
      throw new ApiError(405, 'MethodNotAllowed', req.method);
    }
    const g = this.find(list, pid, id, 'security group');
    if (req.method === 'GET') return json(200, g);
    if (req.method === 'PATCH') {
      const b = this.body(req);
      const rules = b.rules !== undefined ? this.rules(b.rules) : undefined;
      this.patchCommon(g, b, ['rules']);
      if (rules) g.rules = rules;
      this.changed('security-group', g.id, 'update');
      for (const vm of this.state.vms.filter((v) => v.security_group_ids.includes(g.id) && v.status === 'RUNNING')) void this.backend.updateFirewall?.(vm.id, this.firewall(vm));
      return json(200, g);
    }
    if (req.method === 'DELETE') {
      const users = this.state.vms.filter((v) => v.security_group_ids.includes(g.id));
      if (users.length) throw new ApiError(409, 'FailedPrecondition', `security group ${g.name} is used by ${users.map((v) => v.name).join(', ')}`, { in_use_by: users.map((v) => v.id) });
      this.state.securityGroups = list.filter((x) => x !== g);
      this.changed('security-group', g.id, 'delete');
      return { status: 204 };
    }
    throw new ApiError(405, 'MethodNotAllowed', req.method);
  }

  private sshKeysApi(req: HttpRequest, pid: string, id?: string): HttpResponse {
    const list = this.state.sshKeys;
    if (!id) {
      if (req.method === 'GET') return this.list(req, list.filter((n) => n.project === pid));
      if (req.method === 'POST') {
        const b = this.body(req);
        const meta = this.meta(pid, 'sshkey', b, list, 'ssh key');
        const pub = String(b.public_key ?? '').trim();
        const m = /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp\d+) ([A-Za-z0-9+/=]+)( .*)?$/.exec(pub);
        if (!m) invalid('public_key', 'must be an OpenSSH public key: "ssh-ed25519 AAAA… comment"');
        let fp: string;
        try {
          const raw = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
          fp = `SHA1:${sha1(raw).slice(0, 32)}`;
        } catch {
          invalid('public_key', 'the key is not valid base64');
        }
        const k: SshKey = { ...meta, public_key: pub, fingerprint: fp };
        list.push(k);
        this.changed('ssh-key', k.id, 'create');
        return json(201, k);
      }
      throw new ApiError(405, 'MethodNotAllowed', req.method);
    }
    const k = this.find(list, pid, id, 'ssh key');
    if (req.method === 'GET') return json(200, k);
    if (req.method === 'DELETE') {
      this.state.sshKeys = list.filter((x) => x !== k);
      this.changed('ssh-key', k.id, 'delete');
      return { status: 204 };
    }
    throw new ApiError(405, 'MethodNotAllowed', req.method);
  }

  // ── VMs ──

  private vmView = (v: Vm) => {
    const { user_data, ssh_authorized_keys, ...rest } = v;
    return { ...rest, ssh_authorized_keys, user_data: user_data ? `(${user_data.length} bytes)` : '' };
  };

  private vmsApi(req: HttpRequest, pid: string, id: string | undefined, action: string | undefined, depth: number): HttpResponse {
    const list = this.state.vms;
    if (!id) {
      if (req.method === 'GET') return this.list(req, list.filter((n) => n.project === pid), this.vmView as never);
      if (req.method === 'POST') return this.createVm(pid, this.body(req));
      throw new ApiError(405, 'MethodNotAllowed', req.method);
    }
    const vm = this.find(list, pid, id, 'VM');
    if (action) {
      if (depth !== 5) throw new ApiError(404, 'NotFound', 'no such path');
      if (action === 'console') {
        if (req.method !== 'GET') throw new ApiError(405, 'MethodNotAllowed', req.method);
        const text = this.handles.get(vm.id)?.console() ?? '';
        return { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' }, body: text.slice(-65536) };
      }
      if (req.method !== 'POST') throw new ApiError(405, 'MethodNotAllowed', req.method);
      if (action === 'start') return this.startVm(vm);
      if (action === 'stop') return this.stopVm(vm);
      if (action === 'reboot') return this.rebootVm(vm);
      throw new ApiError(404, 'NotFound', `no action ${action}; use start, stop or reboot`);
    }
    if (req.method === 'GET') return json(200, this.vmView(vm));
    if (req.method === 'PATCH') {
      const b = this.body(req);
      let sgs: string[] | undefined;
      if (b.security_group_ids !== undefined) sgs = this.sgIds(pid, b.security_group_ids);
      this.patchCommon(vm, b, ['security_group_ids']);
      if (sgs) {
        vm.security_group_ids = sgs;
        if (vm.status === 'RUNNING') void this.backend.updateFirewall?.(vm.id, this.firewall(vm));
      }
      this.changed('vm', vm.id, 'update');
      return json(200, this.vmView(vm));
    }
    if (req.method === 'DELETE') return this.deleteVm(vm);
    throw new ApiError(405, 'MethodNotAllowed', req.method);
  }

  private sgIds(pid: string, v: unknown): string[] {
    if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) invalid('security_group_ids', 'must be a list of ids');
    return [...new Set((v as string[]).map((x) => this.find(this.state.securityGroups, pid, x, 'security group').id))];
  }

  private createVm(pid: string, b: Record<string, unknown>): HttpResponse {
    const meta = this.meta(pid, 'vm', b, this.state.vms, 'VM');
    const flavor = FLAVORS.find((f) => f.name === b.flavor);
    if (!flavor) invalid('flavor', `unknown flavor ${String(b.flavor)}; see GET /v1/flavors (${FLAVORS.map((f) => f.name).join(', ')})`);
    const image = this.backend.images().find((i) => i.name === b.image);
    if (!image) invalid('image', `unknown image ${String(b.image)}; see GET /v1/images (${this.backend.images().map((i) => i.name).join(', ')})`);
    if (flavor.memory_mb < image.minMemoryMB) invalid('flavor', `image ${image.name} needs at least ${image.minMemoryMB} MiB; ${flavor.name} has ${flavor.memory_mb}`);
    const hostname = b.hostname === undefined ? meta.name : String(b.hostname);
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(hostname)) invalid('hostname', 'must be a valid host name');
    const subnet = b.subnet_id === undefined ? this.state.subnets.find((s) => s.project === pid && s.name === 'default' && this.networkOf(s)?.default) : this.find(this.state.subnets, pid, String(b.subnet_id), 'subnet');
    if (!subnet) throw new ApiError(404, 'NotFound', 'the project has no default subnet');
    let ip: string;
    if (b.ip !== undefined) {
      ip = String(b.ip);
      if (!isIp(ip)) invalid('ip', 'must be an IPv4 address');
      const c = parseCidr(subnet.cidr);
      const n = ipToNum(ip);
      if (!inCidr(n, c)) invalid('ip', `must be inside ${subnet.cidr}`);
      if (n === c.net || n === c.net + 1 || n === ((c.net | ~c.mask) >>> 0)) invalid('ip', 'network, gateway and broadcast addresses are reserved');
      if (subnet.cidr === '10.0.0.0/24' && (n < c.net + 20 || n >= c.net + 100)) invalid('ip', 'in the default subnet VMs use 10.0.0.20–10.0.0.99 (the rest is for the lab, DHCP and load balancers)');
      if (this.usedIps(subnet.id).has(ip)) throw new ApiError(409, 'AlreadyExists', `address ${ip} is already in use`, { field: 'ip' });
    } else ip = this.allocate(subnet, 'vm');
    const sgs = b.security_group_ids === undefined ? [this.state.securityGroups.find((g) => g.project === pid && g.name === 'default')!.id] : this.sgIds(pid, b.security_group_ids);
    let keys: string[] = [];
    if (b.ssh_key_ids !== undefined) {
      if (!Array.isArray(b.ssh_key_ids)) invalid('ssh_key_ids', 'must be a list');
      keys = (b.ssh_key_ids as unknown[]).map((k) => this.find(this.state.sshKeys, pid, String(k), 'ssh key').id);
    }
    let inline: string[] = [];
    if (b.ssh_authorized_keys !== undefined) {
      if (!Array.isArray(b.ssh_authorized_keys) || !b.ssh_authorized_keys.every((k) => typeof k === 'string' && /^(ssh-|ecdsa-)/.test(k))) invalid('ssh_authorized_keys', 'must be a list of OpenSSH public keys');
      inline = b.ssh_authorized_keys as string[];
    }
    const userData = b.user_data === undefined ? '' : String(b.user_data);
    if (userData.length > 16384) throw new ApiError(413, 'TooLarge', 'user_data is larger than 16 KiB');
    let disks: Disk[] = [];
    if (b.disk_ids !== undefined) {
      if (!Array.isArray(b.disk_ids)) invalid('disk_ids', 'must be a list');
      disks = (b.disk_ids as unknown[]).map((d) => this.find(this.state.disks, pid, String(d), 'disk'));
      for (const d of disks) if (d.status !== 'AVAILABLE') throw new ApiError(409, 'FailedPrecondition', `disk ${d.name} is ${d.status}${d.vm_id ? ` (attached to ${d.vm_id})` : ''}`);
      if (disks.length > 2) invalid('disk_ids', 'a VM takes at most 2 extra disks');
    }
    this.need(pid, 'vms', 1);
    this.need(pid, 'memory_mb', flavor.memory_mb);
    const vm: Vm = {
      ...meta,
      hostname,
      flavor: flavor.name,
      image: image.name,
      memory_mb: flavor.memory_mb,
      subnet_id: subnet.id,
      network_id: subnet.network_id,
      ip,
      mac: this.mac(),
      fqdn: `${meta.name}.vm.lab`,
      security_group_ids: sgs,
      ssh_key_ids: keys,
      ssh_authorized_keys: inline,
      user_data: userData,
      disk_ids: disks.map((d) => d.id),
      status: 'PENDING',
      status_message: 'waiting for the backend',
      boot: null,
      started_at: null,
    };
    for (const d of disks) {
      d.status = 'IN_USE';
      d.vm_id = vm.id;
    }
    this.state.vms.push(vm);
    this.changed('vm', vm.id, 'create');
    const op = this.newOp(pid, 'vm.create', { type: 'vm', id: vm.id, name: vm.name });
    this.run(op, async (progress) => {
      this.setVm(vm, 'PROVISIONING', 'booting a real machine');
      try {
        const r = await this.backend.create(this.spec(vm), progress);
        this.handles.set(vm.id, r.handle);
        const devs = r.handle.diskDevices?.() ?? [];
        vm.disk_ids.forEach((id, i) => {
          const d = this.state.disks.find((x) => x.id === id);
          if (d) d.device = devs[i] ?? null;
        });
        vm.boot = r.boot;
        vm.started_at = this.iso();
        this.setVm(vm, 'RUNNING', '');
      } catch (e) {
        this.setVm(vm, 'ERROR', (e as Error).message);
        throw new ApiError(500, 'BootFailed', `VM ${vm.name} did not boot: ${(e as Error).message}`);
      }
    });
    return this.accepted(op);
  }

  private setVm(vm: Vm, status: VmStatus, msg: string) {
    vm.status = status;
    vm.status_message = msg;
    vm.updated_at = this.iso();
    this.changed('vm', vm.id, 'update');
  }

  private busy(vm: Vm) {
    if (BUSY_VM.includes(vm.status)) throw new ApiError(409, 'Conflict', `VM ${vm.name} is ${vm.status}; wait for its operation to finish`, { status: vm.status });
  }

  private startVm(vm: Vm): HttpResponse {
    this.busy(vm);
    if (vm.status === 'RUNNING') throw new ApiError(409, 'FailedPrecondition', `VM ${vm.name} is already RUNNING`);
    this.need(vm.project, 'memory_mb', vm.memory_mb);
    const op = this.newOp(vm.project, 'vm.start', { type: 'vm', id: vm.id, name: vm.name });
    this.setVm(vm, 'STARTING', 'starting');
    this.run(op, async (progress) => {
      try {
        const r = await (vm.boot === null && !vm.started_at ? this.backend.create(this.spec(vm), progress) : this.backend.start(this.spec(vm), progress));
        this.handles.set(vm.id, r.handle);
        vm.boot = r.boot;
        vm.started_at = this.iso();
        this.setVm(vm, 'RUNNING', '');
      } catch (e) {
        this.setVm(vm, 'ERROR', (e as Error).message);
        throw e;
      }
    });
    return this.accepted(op);
  }

  private stopVm(vm: Vm): HttpResponse {
    this.busy(vm);
    if (vm.status !== 'RUNNING') throw new ApiError(409, 'FailedPrecondition', `VM ${vm.name} is ${vm.status}, not RUNNING`);
    const op = this.newOp(vm.project, 'vm.stop', { type: 'vm', id: vm.id, name: vm.name });
    this.setVm(vm, 'STOPPING', 'shutting down');
    this.run(op, async () => {
      await this.backend.stop(vm.id);
      this.handles.delete(vm.id);
      vm.boot = null;
      this.setVm(vm, 'STOPPED', '');
    });
    return this.accepted(op);
  }

  private rebootVm(vm: Vm): HttpResponse {
    this.busy(vm);
    if (vm.status !== 'RUNNING') throw new ApiError(409, 'FailedPrecondition', `VM ${vm.name} is ${vm.status}, not RUNNING`);
    const op = this.newOp(vm.project, 'vm.reboot', { type: 'vm', id: vm.id, name: vm.name });
    this.setVm(vm, 'REBOOTING', 'rebooting');
    this.run(op, async () => {
      await this.backend.reboot(vm.id);
      this.setVm(vm, 'RUNNING', '');
    });
    return this.accepted(op);
  }

  private deleteVm(vm: Vm): HttpResponse {
    if (vm.status === 'DELETING') throw new ApiError(409, 'Conflict', `VM ${vm.name} is already being deleted`);
    if (vm.status === 'PENDING' || vm.status === 'PROVISIONING' || vm.status === 'STARTING') throw new ApiError(409, 'Conflict', `VM ${vm.name} is ${vm.status}; wait for its operation to finish`);
    const op = this.newOp(vm.project, 'vm.delete', { type: 'vm', id: vm.id, name: vm.name });
    this.setVm(vm, 'DELETING', 'powering off');
    this.run(op, async () => {
      await this.backend.destroy(vm.id);
      this.handles.delete(vm.id);
      for (const d of this.state.disks)
        if (d.vm_id === vm.id) {
          d.vm_id = null;
          d.device = null;
          d.status = 'AVAILABLE';
        }
      for (const lb of this.state.loadBalancers) lb.target_vm_ids = lb.target_vm_ids.filter((x) => x !== vm.id);
      this.state.vms = this.state.vms.filter((x) => x !== vm);
      this.changed('vm', vm.id, 'delete');
    });
    return this.accepted(op);
  }

  // ── disks ──

  private disksApi(req: HttpRequest, pid: string, id?: string, action?: string): HttpResponse {
    const list = this.state.disks;
    if (!id) {
      if (req.method === 'GET') return this.list(req, list.filter((n) => n.project === pid));
      if (req.method === 'POST') {
        const b = this.body(req);
        const meta = this.meta(pid, 'disk', b, list, 'disk');
        const size = Number(b.size_mb);
        if (!Number.isInteger(size) || size < 8 || size > 1024) invalid('size_mb', 'must be an integer from 8 to 1024 (MiB: the tab is small)');
        this.need(pid, 'disks', 1);
        this.need(pid, 'disk_mb', size);
        const d: Disk = { ...meta, size_mb: size, status: 'CREATING', vm_id: null, device: null };
        list.push(d);
        this.changed('disk', d.id, 'create');
        const op = this.newOp(pid, 'disk.create', { type: 'disk', id: d.id, name: d.name });
        this.run(op, async () => {
          await this.sleep(this.delays.disk);
          d.status = 'AVAILABLE';
          this.changed('disk', d.id, 'update');
        });
        return this.accepted(op);
      }
      throw new ApiError(405, 'MethodNotAllowed', req.method);
    }
    const d = this.find(list, pid, id, 'disk');
    if (action) {
      if (req.method !== 'POST') throw new ApiError(405, 'MethodNotAllowed', req.method);
      if (action === 'attach') {
        const vm = this.find(this.state.vms, pid, String(this.body(req).vm_id ?? ''), 'VM');
        if (d.status !== 'AVAILABLE') throw new ApiError(409, 'FailedPrecondition', `disk ${d.name} is ${d.status}`);
        if (vm.status !== 'STOPPED') throw new ApiError(409, 'FailedPrecondition', `VM ${vm.name} is ${vm.status}; stop it first (machines in the tab have no disk hot-plug)`);
        if (vm.disk_ids.length >= 2) throw new ApiError(409, 'FailedPrecondition', `VM ${vm.name} already has 2 extra disks`);
        const op = this.newOp(pid, 'disk.attach', { type: 'disk', id: d.id, name: d.name });
        d.status = 'IN_USE';
        d.vm_id = vm.id;
        vm.disk_ids.push(d.id);
        this.run(op, async () => {
          this.changed('disk', d.id, 'update');
          this.changed('vm', vm.id, 'update');
        });
        return this.accepted(op);
      }
      if (action === 'detach') {
        const vm = d.vm_id ? this.state.vms.find((v) => v.id === d.vm_id) : undefined;
        if (!vm) throw new ApiError(409, 'FailedPrecondition', `disk ${d.name} is not attached`);
        if (vm.status !== 'STOPPED') throw new ApiError(409, 'FailedPrecondition', `VM ${vm.name} is ${vm.status}; stop it first`);
        const op = this.newOp(pid, 'disk.detach', { type: 'disk', id: d.id, name: d.name });
        vm.disk_ids = vm.disk_ids.filter((x) => x !== d.id);
        d.status = 'AVAILABLE';
        d.vm_id = null;
        d.device = null;
        this.run(op, async () => {
          this.changed('disk', d.id, 'update');
          this.changed('vm', vm.id, 'update');
        });
        return this.accepted(op);
      }
      throw new ApiError(404, 'NotFound', `no action ${action}; use attach or detach`);
    }
    if (req.method === 'GET') return json(200, d);
    if (req.method === 'PATCH') {
      this.patchCommon(d, this.body(req), []);
      this.changed('disk', d.id, 'update');
      return json(200, d);
    }
    if (req.method === 'DELETE') {
      if (d.status === 'IN_USE') throw new ApiError(409, 'FailedPrecondition', `disk ${d.name} is attached to ${d.vm_id}; detach it first`, { vm_id: d.vm_id });
      if (d.status !== 'AVAILABLE' && d.status !== 'ERROR') throw new ApiError(409, 'Conflict', `disk ${d.name} is ${d.status}`);
      const op = this.newOp(pid, 'disk.delete', { type: 'disk', id: d.id, name: d.name });
      d.status = 'DELETING';
      this.run(op, async () => {
        await this.sleep(this.delays.disk / 2);
        this.state.disks = this.state.disks.filter((x) => x !== d);
        this.changed('disk', d.id, 'delete');
      });
      return this.accepted(op);
    }
    throw new ApiError(405, 'MethodNotAllowed', req.method);
  }

  // ── load balancers ──

  private listeners(v: unknown): Listener[] {
    if (!Array.isArray(v) || !v.length) invalid('listeners', 'at least one listener is required');
    const seen = new Set<number>();
    return v.map((l, i) => {
      const x = (l ?? {}) as Record<string, unknown>;
      const port = Number(x.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) invalid(`listeners[${i}].port`, 'must be 1–65535');
      if (port === 53 || port === 67) invalid(`listeners[${i}].port`, 'ports 53 and 67 are used by the lab DNS and DHCP');
      if (seen.has(port)) invalid(`listeners[${i}].port`, 'duplicate port');
      seen.add(port);
      if (x.protocol !== undefined && x.protocol !== 'http') invalid(`listeners[${i}].protocol`, 'only http is supported');
      const tp = x.target_port === undefined ? port : Number(x.target_port);
      if (!Number.isInteger(tp) || tp < 1 || tp > 65535) invalid(`listeners[${i}].target_port`, 'must be 1–65535');
      return { protocol: 'http' as const, port, target_port: tp };
    });
  }

  private health(v: unknown, prev?: HealthCheck): HealthCheck {
    const x = (v ?? {}) as Record<string, unknown>;
    const h: HealthCheck = { path: '/', interval_s: 5, healthy_threshold: 2, unhealthy_threshold: 2, ...(prev ?? {}) };
    if (x.path !== undefined) {
      if (typeof x.path !== 'string' || !x.path.startsWith('/')) invalid('health_check.path', 'must start with /');
      h.path = x.path;
    }
    for (const k of ['port', 'interval_s', 'healthy_threshold', 'unhealthy_threshold'] as const)
      if (x[k] !== undefined) {
        const n = Number(x[k]);
        if (!Number.isInteger(n) || n < 1 || (k === 'interval_s' && n < 2) || (k === 'port' && n > 65535)) invalid(`health_check.${k}`, 'bad value');
        h[k] = n;
      }
    return h;
  }

  private targets(pid: string, v: unknown): string[] {
    if (v === undefined) return [];
    if (!Array.isArray(v)) invalid('target_vm_ids', 'must be a list');
    return [...new Set((v as unknown[]).map((x) => this.find(this.state.vms, pid, String(x), 'VM').id))];
  }

  private lbApi(req: HttpRequest, pid: string, id?: string): HttpResponse {
    const list = this.state.loadBalancers;
    if (!id) {
      if (req.method === 'GET') return this.list(req, list.filter((n) => n.project === pid));
      if (req.method === 'POST') {
        const b = this.body(req);
        const meta = this.meta(pid, 'lb', b, list, 'load balancer');
        const listeners = this.listeners(b.listeners);
        const subnet = b.subnet_id === undefined ? this.state.subnets.find((s) => s.project === pid && s.name === 'default' && this.networkOf(s)?.default)! : this.find(this.state.subnets, pid, String(b.subnet_id), 'subnet');
        const targets = this.targets(pid, b.target_vm_ids);
        for (const t of targets) {
          const vm = this.state.vms.find((v) => v.id === t)!;
          if (vm.network_id !== subnet.network_id) invalid('target_vm_ids', `VM ${vm.name} is in another network`);
        }
        if (b.algorithm !== undefined && b.algorithm !== 'round_robin' && b.algorithm !== 'least_connections') invalid('algorithm', 'round_robin or least_connections');
        this.need(pid, 'load_balancers', 1);
        const vip = this.allocate(subnet, 'lb');
        const lb: LoadBalancer = { ...meta, subnet_id: subnet.id, vip, fqdn: `${meta.name}.lb.lab`, listeners, target_vm_ids: targets, algorithm: (b.algorithm as LoadBalancer['algorithm']) ?? 'round_robin', health_check: this.health(b.health_check), status: 'PENDING' };
        list.push(lb);
        this.changed('load-balancer', lb.id, 'create');
        const op = this.newOp(pid, 'lb.create', { type: 'load-balancer', id: lb.id, name: lb.name });
        this.run(op, async (progress) => {
          progress('programming the virtual address', 40);
          await this.sleep(this.delays.lb);
          lb.status = 'ACTIVE';
          this.changed('load-balancer', lb.id, 'update');
        });
        return this.accepted(op);
      }
      throw new ApiError(405, 'MethodNotAllowed', req.method);
    }
    const lb = this.find(list, pid, id, 'load balancer');
    if (req.method === 'GET') return json(200, this.onLbTargets ? { ...lb, targets: this.onLbTargets(lb) } : lb);
    if (req.method === 'PATCH') {
      const b = this.body(req);
      const listeners = b.listeners !== undefined ? this.listeners(b.listeners) : undefined;
      const targets = b.target_vm_ids !== undefined ? this.targets(pid, b.target_vm_ids) : undefined;
      const hc = b.health_check !== undefined ? this.health(b.health_check, lb.health_check) : undefined;
      if (b.algorithm !== undefined && b.algorithm !== 'round_robin' && b.algorithm !== 'least_connections') invalid('algorithm', 'round_robin or least_connections');
      this.patchCommon(lb, b, ['listeners', 'target_vm_ids', 'health_check', 'algorithm']);
      if (listeners) lb.listeners = listeners;
      if (targets) lb.target_vm_ids = targets;
      if (hc) lb.health_check = hc;
      if (b.algorithm) lb.algorithm = b.algorithm as LoadBalancer['algorithm'];
      this.changed('load-balancer', lb.id, 'update');
      return json(200, lb);
    }
    if (req.method === 'DELETE') {
      if (lb.status === 'DELETING') throw new ApiError(409, 'Conflict', 'already being deleted');
      const op = this.newOp(pid, 'lb.delete', { type: 'load-balancer', id: lb.id, name: lb.name });
      lb.status = 'DELETING';
      this.changed('load-balancer', lb.id, 'update');
      this.run(op, async () => {
        await this.sleep(this.delays.lb / 2);
        this.state.loadBalancers = this.state.loadBalancers.filter((x) => x !== lb);
        this.changed('load-balancer', lb.id, 'delete');
      });
      return this.accepted(op);
    }
    throw new ApiError(405, 'MethodNotAllowed', req.method);
  }

  // ── DNS ──

  private zoneView = (z: DnsZone) => ({ ...z, records: this.state.records.filter((r) => r.zone_id === z.id).length });

  private dnsApi(req: HttpRequest, pid: string, zoneRef?: string, sub?: string, recRef?: string): HttpResponse {
    if (!zoneRef) {
      if (req.method === 'GET') return this.list(req, this.state.zones.filter((z) => z.project === pid), this.zoneView as never);
      if (req.method === 'POST') {
        const b = this.body(req);
        const name = String(b.name ?? '').toLowerCase().replace(/\.$/, '');
        if (!/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+lab$/.test(name)) invalid('name', 'must be a domain ending in .lab, like shop.lab');
        if (RESERVED_ZONES.includes(name) || RESERVED_ZONES.some((r) => r !== 'lab' && name.endsWith(`.${r}`))) invalid('name', `${name} is reserved by the lab`);
        const clash = this.state.zones.find((z) => z.name === name);
        if (clash) throw new ApiError(409, 'AlreadyExists', `zone ${name} already exists${clash.project !== pid ? ' in another project' : ''}`);
        const t = this.iso();
        const z: DnsZone = { id: this.newId('zone'), name, project: pid, description: typeof b.description === 'string' ? b.description : '', labels: this.labels(b.labels), created_at: t, updated_at: t };
        this.state.zones.push(z);
        this.changed('dns-zone', z.id, 'create');
        return json(201, this.zoneView(z));
      }
      throw new ApiError(405, 'MethodNotAllowed', req.method);
    }
    const zone = this.find(this.state.zones, pid, zoneRef, 'zone');
    if (!sub) {
      if (req.method === 'GET') return json(200, this.zoneView(zone));
      if (req.method === 'DELETE') {
        if (this.state.records.some((r) => r.zone_id === zone.id)) throw new ApiError(409, 'FailedPrecondition', `zone ${zone.name} still has records`);
        this.state.zones = this.state.zones.filter((z) => z !== zone);
        this.changed('dns-zone', zone.id, 'delete');
        return { status: 204 };
      }
      throw new ApiError(405, 'MethodNotAllowed', req.method);
    }
    if (sub !== 'records') throw new ApiError(404, 'NotFound', 'no such path');
    const recs = this.state.records;
    const values = (type: string, v: unknown): string[] => {
      if (!Array.isArray(v) || !v.length || !v.every((x) => typeof x === 'string')) invalid('values', 'a non-empty list of strings');
      const vals = v as string[];
      if (type === 'A' && !vals.every(isIp)) invalid('values', 'A records hold IPv4 addresses');
      if (type === 'CNAME' && (vals.length !== 1 || !/^[a-z0-9.-]+\.?$/i.test(vals[0]))) invalid('values', 'a CNAME holds exactly one host name');
      return type === 'CNAME' ? [vals[0].toLowerCase().replace(/\.$/, '')] : vals;
    };
    if (!recRef) {
      if (req.method === 'GET') return this.list(req, recs.filter((r) => r.zone_id === zone.id));
      if (req.method === 'POST') {
        const b = this.body(req);
        const rel = String(b.name ?? '').toLowerCase();
        if (rel !== '@' && !/^(\*|[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/.test(rel)) invalid('name', 'a host name relative to the zone, or @');
        const type = String(b.type ?? '');
        if (!['A', 'CNAME', 'TXT'].includes(type)) invalid('type', 'A, CNAME or TXT');
        const vals = values(type, b.values);
        const fqdn = rel === '@' ? zone.name : `${rel}.${zone.name}`;
        const same = recs.filter((r) => r.fqdn === fqdn);
        if (same.some((r) => r.type === type)) throw new ApiError(409, 'AlreadyExists', `${type} record ${fqdn} already exists; PATCH its values`);
        if ((type === 'CNAME' && same.length) || same.some((r) => r.type === 'CNAME')) throw new ApiError(409, 'FailedPrecondition', `a CNAME cannot coexist with other records at ${fqdn}`);
        const ttl = b.ttl === undefined ? 60 : Number(b.ttl);
        if (!Number.isInteger(ttl) || ttl < 1 || ttl > 86400) invalid('ttl', '1–86400');
        const t = this.iso();
        const r: DnsRecordRec = { id: this.newId('rec'), name: rel, project: pid, labels: this.labels(b.labels), created_at: t, updated_at: t, zone_id: zone.id, fqdn, type: type as DnsRecordRec['type'], values: vals, ttl };
        recs.push(r);
        this.changed('dns-record', r.id, 'create');
        return json(201, r);
      }
      throw new ApiError(405, 'MethodNotAllowed', req.method);
    }
    const r = recs.find((x) => x.zone_id === zone.id && (x.id === recRef || x.name === recRef));
    if (!r) throw new ApiError(404, 'NotFound', `record ${recRef} not found in ${zone.name}`);
    if (req.method === 'GET') return json(200, r);
    if (req.method === 'PATCH') {
      const b = this.body(req);
      const vals = b.values !== undefined ? values(r.type, b.values) : undefined;
      const ttl = b.ttl !== undefined ? Number(b.ttl) : undefined;
      if (ttl !== undefined && (!Number.isInteger(ttl) || ttl < 1 || ttl > 86400)) invalid('ttl', '1–86400');
      this.patchCommon(r, b, ['values', 'ttl']);
      if (vals) r.values = vals;
      if (ttl) r.ttl = ttl;
      this.changed('dns-record', r.id, 'update');
      return json(200, r);
    }
    if (req.method === 'DELETE') {
      this.state.records = recs.filter((x) => x !== r);
      this.changed('dns-record', r.id, 'delete');
      return { status: 204 };
    }
    throw new ApiError(405, 'MethodNotAllowed', req.method);
  }

  // ── buckets (metadata; objects live in the S3 store) ──

  /** Set by the S3 store: number and bytes of objects in a bucket. */
  bucketStats: (name: string) => { objects: number; bytes: number } = () => ({ objects: 0, bytes: 0 });
  /** Set by the S3 store: drop every object of a bucket. */
  bucketPurge: (name: string) => void = () => {};

  private bucketView = (b: Bucket) => ({ ...b, endpoint: `http://s3.cloud.lab/${b.name}`, ...this.bucketStats(b.name) });

  createBucket(pid: string, name: string, o: { labels?: unknown; versioning?: boolean } = {}): Bucket {
    if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(name) || name.includes('..')) invalid('name', '3–63 characters: lowercase letters, digits, dots and hyphens');
    if (this.state.buckets.some((b) => b.name === name)) throw new ApiError(409, 'AlreadyExists', `bucket ${name} already exists (bucket names are global)`);
    this.need(pid, 'buckets', 1);
    const t = this.iso();
    const b: Bucket = { id: name, name, project: pid, labels: this.labels(o.labels), created_at: t, updated_at: t, versioning: !!o.versioning };
    this.state.buckets.push(b);
    this.changed('bucket', b.id, 'create');
    return b;
  }

  deleteBucket(b: Bucket, force: boolean): void {
    if (this.bucketStats(b.name).objects && !force) throw new ApiError(409, 'FailedPrecondition', `bucket ${b.name} is not empty`);
    this.bucketPurge(b.name);
    this.state.buckets = this.state.buckets.filter((x) => x !== b);
    this.changed('bucket', b.id, 'delete');
  }

  private bucketsApi(req: HttpRequest, pid: string, id?: string): HttpResponse {
    if (!id) {
      if (req.method === 'GET') return this.list(req, this.state.buckets.filter((b) => b.project === pid), this.bucketView as never);
      if (req.method === 'POST') {
        const b = this.body(req);
        return json(201, this.bucketView(this.createBucket(pid, String(b.name ?? ''), { labels: b.labels, versioning: b.versioning === true })));
      }
      throw new ApiError(405, 'MethodNotAllowed', req.method);
    }
    const b = this.find(this.state.buckets, pid, id, 'bucket');
    if (req.method === 'GET') return json(200, this.bucketView(b));
    if (req.method === 'DELETE') {
      this.deleteBucket(b, req.query.get('force') === 'true');
      return { status: 204 };
    }
    throw new ApiError(405, 'MethodNotAllowed', req.method);
  }
}
