// The cloud lab: one LabHost on dt-switch serving everything the machines
// of the tab can reach by name —
//   api.cloud.lab   REST API (api.ts)            s3.cloud.lab   objects (s3.ts)
//   git.lab         Git smart HTTP (git/)        mirror.lab     packages (mirror.ts)
//   169.254.169.254 metadata (metadata.ts)       <vip>          load balancers (lb.ts)
// plus DHCP and DNS for the lab networks, and routing between subnets of a
// network. `sync()` reconciles the host with the cloud state after every
// change: interfaces per VLAN, fixed leases, VIPs and listener ports.

import openapiText from './openapi.yaml?raw';
import { DhcpServer } from '../labhost/dhcp';
import { DnsServer, fromReverse, reverseName, type DnsRecord } from '../labhost/dns';
import { GitServer, type GitServerEvent } from '../labhost/git/server';
import { GitStore, type GitPersistence } from '../labhost/git/store';
import { LabHost, type HostEvent } from '../labhost/host';
import { httpRequest, HttpMux, serveHttp, text, type HttpLogEntry, type HttpRequest } from '../labhost/http';
import { mirrorHandler, type StaticSource } from '../labhost/mirror';
import { ipToNum, numToIp, parseCidr, PROTO_ICMP, PROTO_TCP, PROTO_UDP } from '../labhost/wire';
import type { L2Switch } from '../v86/switch';
import { Cloud, type CloudState, type Limits } from './api';
import { LoadBalancers } from './lb';
import { METADATA_IP, metadataHandler } from './metadata';
import { S3Store, type S3Object, type S3Persistence } from './s3';
import type { VmBackend } from './vm-backend';

export const GATEWAY = '10.0.0.1';
export const SERVICE_NAMES = ['api.cloud.lab', 's3.cloud.lab', 'cloud.lab', 'git.lab', 'mirror.lab', 'ci.lab', 'gateway.lab', 'ns.lab'];

export interface CloudPersistence {
  load(): Promise<{ state?: CloudState; objects: { bucket: string; key: string; obj: S3Object }[] }>;
  saveState(s: CloudState): Promise<void>;
  s3: S3Persistence;
}

export interface CloudLabOptions {
  backend: VmBackend;
  mirror?: StaticSource;
  /** Names of machines that are not cloud VMs (the learner's workstation). */
  hosts?: Record<string, string>;
  limits?: Partial<Limits>;
  delays?: { disk?: number; lb?: number; step?: number };
  persist?: CloudPersistence;
  gitPersist?: GitPersistence;
  random?: () => number;
}

export interface LabLogEntry {
  at: number;
  kind: 'http' | 'dns' | 'dhcp' | 'git' | 'lb' | 'op' | 'host' | 's3' | 'mirror' | 'ci';
  text: string;
  ok: boolean;
}

export class CloudLab {
  readonly host = new LabHost();
  readonly mux = new HttpMux();
  readonly dhcp: DhcpServer;
  readonly dns: DnsServer;
  readonly cloud: Cloud;
  readonly s3: S3Store;
  readonly git: GitServer;
  readonly lbs: LoadBalancers;
  readonly log: LabLogEntry[] = [];
  private fns = new Set<(e: LabLogEntry | null) => void>();
  private hosts: Record<string, string>;
  private ports = new Map<number, () => void>();
  private leases = new Set<string>();
  private detach: (() => void) | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private offs: (() => void)[] = [];

  private constructor(
    o: CloudLabOptions,
    state: CloudState | undefined,
    gitStore: GitStore,
  ) {
    this.hosts = { ...(o.hosts ?? {}) };
    this.cloud = new Cloud({ backend: o.backend, limits: o.limits, delays: o.delays, state, random: o.random });
    this.s3 = new S3Store(this.cloud, o.persist?.s3);
    this.git = new GitServer(gitStore);
    this.lbs = new LoadBalancers(this.cloud, this.host);
    this.dhcp = new DhcpServer(this.host);
    this.dns = new DnsServer(this.host, (n) => this.lookup(n));
    this.git.deliver = (url, body, headers) => this.deliver(url, body, headers);

    const api = this.cloud.handleHttp;
    this.mux.add({
      hosts: ['api.cloud.lab', 'cloud.lab'],
      handler: (req) => (req.path === '/openapi.yaml' ? { status: 200, headers: { 'content-type': 'application/yaml' }, body: openapiText } : api(req)),
    });
    this.mux.add({ hosts: ['s3.cloud.lab', '*.s3.cloud.lab'], handler: this.s3.handle });
    this.mux.add({ hosts: ['git.lab'], handler: this.git.handle });
    this.mux.add({ ips: [METADATA_IP], handler: metadataHandler(this.cloud) });
    if (o.mirror) this.mux.add({ hosts: ['mirror.lab'], handler: mirrorHandler(o.mirror, (e) => this.note('mirror', `${e.from} GET ${e.path} → ${e.status}${e.bytes ? ` (${fmtBytes(e.bytes)})` : ''}`, e.status < 400)) });
    this.mux.fallback = (req) =>
      text(
        req.host && !/^\d+\.\d+\.\d+\.\d+$/.test(req.host) ? 404 : 200,
        `lab host ${GATEWAY}: the services of this tab\n\n  http://api.cloud.lab/v1      cloud API (OpenAPI: /openapi.yaml)\n  http://s3.cloud.lab/         object storage (S3)\n  http://git.lab/              Git over HTTP\n  http://mirror.lab/           package mirror\n  http://${METADATA_IP}/latest/meta-data/   metadata of a VM\n\n${req.host ? `No service is called ${req.host}.\n` : ''}`,
      );

    this.offs.push(
      this.cloud.on((e) => {
        if (e.t === 'change') {
          this.sync();
          this.scheduleSave(o.persist);
        } else if (e.t === 'op' && (e.op.status === 'DONE' || e.op.status === 'ERROR')) {
          this.note('op', `${e.op.kind} ${e.op.target.name}: ${e.op.status}${e.op.error ? ` — ${e.op.error.message}` : ''}`, e.op.status === 'DONE');
          this.scheduleSave(o.persist);
        } else if (e.t === 'request') this.note('http', `${e.from} ${e.method} api.cloud.lab${e.path} → ${e.status}`, e.status < 400);
        else this.emit(null);
      }),
      this.s3.on((e) => {
        this.note('s3', `${e.from} ${e.op} s3://${e.bucket}${e.key ? `/${e.key}` : ''} → ${e.status}`, e.status < 400);
        if (e.op === 'PUT' || e.op === 'DELETE') this.scheduleSave(o.persist);
      }),
      this.git.on((e: GitServerEvent) => this.note('git', `${e.from} ${e.t.slice(4)} ${e.repo}: ${e.detail}`, true)),
      this.dhcp.on((e) => {
        if (e.type === 'ACK' || e.type === 'NAK') this.note('dhcp', `${e.type} ${e.ip ?? ''} → ${e.mac}${e.hostname ? ` (${e.hostname})` : ''}`, e.type === 'ACK');
      }),
      this.dns.on((e) => this.note('dns', `${e.from} ${e.type} ${e.name} → ${e.rcode}${e.answers.length ? ` ${e.answers.join(', ')}` : ''}`, e.rcode === 'NOERROR')),
      this.lbs.on((e) => (e.t === 'lb.health' ? this.note('lb', `${e.lb}: ${e.vm} is ${e.health} (${e.reason})`, e.health === 'healthy') : this.note('lb', `${e.lb} → ${e.target ?? 'no target'}: ${e.status} in ${e.ms} ms`, e.status < 500))),
      this.host.on((e: HostEvent) => {
        if (e.t === 'route' && !e.ok) this.note('host', `dropped ${e.from} → ${e.to}: ${e.reason}`, false);
        if (e.t === 'drop') this.note('host', e.reason, false);
      }),
    );
    this.cloud.onLbTargets = (lb) => this.lbs.targets(lb);
    this.host.forwardFilter = (p) => {
      const vm = this.cloud.vmByIp(numToIp(p.dst));
      if (!vm) return null;
      const proto = p.proto === PROTO_TCP ? 'tcp' : p.proto === PROTO_UDP ? 'udp' : p.proto === PROTO_ICMP ? 'icmp' : null;
      if (!proto) return null;
      return this.cloud.allows(vm, proto, p.dport, numToIp(p.src)) ? null : `security groups of ${vm.name} drop ${proto}${p.dport ? `/${p.dport}` : ''} from ${numToIp(p.src)}`;
    };
  }

  static async create(o: CloudLabOptions): Promise<CloudLab> {
    const saved = o.persist ? await o.persist.load().catch(() => ({ state: undefined, objects: [] })) : { state: undefined, objects: [] };
    const store = new GitStore(o.gitPersist);
    await store.load().catch(() => undefined);
    const lab = new CloudLab(o, saved.state, store);
    for (const x of saved.objects) lab.s3.load(x.bucket, x.key, x.obj);
    lab.sync();
    return lab;
  }

  // ── log for the panel ──

  on(fn: (e: LabLogEntry | null) => void): () => void {
    this.fns.add(fn);
    return () => this.fns.delete(fn);
  }

  private emit(e: LabLogEntry | null) {
    for (const f of this.fns) f(e);
  }

  note(kind: LabLogEntry['kind'], text: string, ok: boolean): void {
    const e = { at: Date.now(), kind, text, ok };
    this.log.push(e);
    if (this.log.length > 400) this.log.splice(0, this.log.length - 400);
    this.emit(e);
  }

  private scheduleSave(p?: CloudPersistence) {
    if (!p || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void p.saveState(this.cloud.state);
    }, 300);
  }

  // ── network ──

  attach(sw: L2Switch, portId = 'labhost'): void {
    this.detach?.();
    this.detach = this.host.attach(sw, portId);
    this.sync();
  }

  setHost(name: string, ip: string | null): void {
    if (ip) this.hosts[name] = ip;
    else delete this.hosts[name];
  }

  /** Reconcile interfaces, leases, VIPs and ports with the cloud state. */
  sync(): void {
    const st = this.cloud.state;
    const want = new Map<number, { ip: number; prefix: number; group: string }[]>();
    const add = (vlan: number, ip: number, prefix: number, group: string) => {
      const l = want.get(vlan) ?? [];
      if (!l.some((x) => x.ip === ip)) l.push({ ip, prefix, group });
      want.set(vlan, l);
    };
    add(1, ipToNum(GATEWAY), 24, '');
    for (const s of st.subnets) {
      const net = st.networks.find((n) => n.id === s.network_id);
      if (!net) continue;
      add(net.vlan, ipToNum(s.gateway), parseCidr(s.cidr).prefix, net.id);
    }
    // Subnets of the default network share VLAN 1 with the lab services.
    const defaultNet = st.networks.find((n) => n.vlan === 1);
    for (const x of want.get(1) ?? []) x.group = defaultNet?.id ?? 'default';
    for (const [vlan, addrs] of want) {
      for (const a of addrs) this.host.addInterface(vlan, a.ip, a.prefix, a.group);
      this.host.addAddress(vlan, ipToNum(METADATA_IP));
    }
    for (const lb of st.loadBalancers) {
      const s = st.subnets.find((x) => x.id === lb.subnet_id);
      const vlan = s ? (st.networks.find((n) => n.id === s.network_id)?.vlan ?? 1) : 1;
      if (lb.status === 'ACTIVE') this.host.addAddress(vlan, ipToNum(lb.vip));
    }
    // Remove addresses that are no longer wanted.
    const vips = new Set(st.loadBalancers.filter((l) => l.status === 'ACTIVE').map((l) => ipToNum(l.vip)));
    for (const f of this.host.interfaces())
      for (const a of [...f.addrs]) {
        const keep = a.prefix === 32 ? a.ip === ipToNum(METADATA_IP) ? want.has(f.vlan) : vips.has(a.ip) : (want.get(f.vlan) ?? []).some((x) => x.ip === a.ip);
        if (!keep) this.host.removeAddress(f.vlan, a.ip);
      }
    this.host.syncPort?.();

    // DHCP: a pool on the default subnet, fixed leases for VMs.
    this.dhcp.setPool({ vlan: 1, from: ipToNum('10.0.0.100'), to: ipToNum('10.0.0.199'), prefix: 24, gateway: ipToNum(GATEWAY), dns: [ipToNum(GATEWAY)], domain: 'lab' });
    const leases = new Set<string>();
    for (const vm of st.vms) {
      const s = this.cloud.subnetOf(vm);
      if (!s || !s.dhcp) continue;
      const vlan = this.cloud.vlanOf(vm);
      leases.add(`${vlan}/${vm.mac}`);
      this.dhcp.setFixed(vlan, vm.mac, { ip: ipToNum(vm.ip), prefix: parseCidr(s.cidr).prefix, gateway: ipToNum(s.gateway), dns: s.dns_servers.map(ipToNum), domain: 'lab', hostname: vm.hostname });
    }
    for (const k of this.leases)
      if (!leases.has(k)) {
        const [v, mac] = k.split('/');
        this.dhcp.removeFixed(Number(v), mac);
      }
    this.leases = leases;

    // HTTP: port 80 for the services, plus the listener ports of load balancers.
    const vipPorts = new Map<number, Set<number>>();
    for (const lb of st.loadBalancers) if (lb.status === 'ACTIVE') vipPorts.set(ipToNum(lb.vip), new Set(lb.listeners.map((l) => l.port)));
    const ports = new Set([80, ...[...vipPorts.values()].flatMap((s) => [...s])]);
    const accept = (port: number) => (local: number) => {
      const lp = vipPorts.get(local);
      if (lp) return lp.has(port);
      return port === 80;
    };
    for (const p of ports)
      if (!this.ports.has(p))
        this.ports.set(
          p,
          serveHttp(this.host, p, (req) => this.serve(req), { accept: accept(p), log: (e) => this.logHttp(e) }),
        );
    for (const [p, close] of this.ports)
      if (!ports.has(p)) {
        close();
        this.ports.delete(p);
      }
    // Accept filters capture vipPorts: re-create listeners so they see the current VIPs.
    for (const [p, close] of this.ports) {
      close();
      this.ports.set(
        p,
        serveHttp(this.host, p, (req) => this.serve(req), { accept: accept(p), log: (e) => this.logHttp(e) }),
      );
    }
    this.lbs.sync();
    this.emit(null);
  }

  private logHttp(e: HttpLogEntry) {
    // The API, S3, git and the mirror log themselves with more detail.
    if (['api.cloud.lab', 'cloud.lab', 'git.lab', 'mirror.lab'].includes(e.host) || e.host.endsWith('s3.cloud.lab')) return;
    this.note('http', `${e.from} ${e.method} ${e.host}${e.target} → ${e.status}`, e.status < 400);
  }

  /** Every HTTP request that reaches the lab host. */
  serve(req: HttpRequest) {
    if (this.cloud.state.loadBalancers.some((l) => l.vip === req.local.ip && l.status === 'ACTIVE')) return this.lbs.proxy(req);
    return this.mux.handle(req);
  }

  // ── DNS ──

  lookup(name: string): DnsRecord[] {
    const A = (value: string): DnsRecord[] => [{ name, type: 'A', ttl: 30, value }];
    if (SERVICE_NAMES.includes(name) || name.endsWith('.s3.cloud.lab')) return A(GATEWAY);
    if (name === 'metadata.lab') return A(METADATA_IP);
    if (this.hosts[name]) return A(this.hosts[name]);
    const st = this.cloud.state;
    const vm = st.vms.find((v) => v.fqdn === name);
    if (vm) return A(vm.ip);
    const lb = st.loadBalancers.find((l) => l.fqdn === name && l.status !== 'DELETING');
    if (lb) return A(lb.vip);
    const recs = st.records.filter((r) => r.fqdn === name);
    const wild = recs.length ? recs : st.records.filter((r) => r.name.startsWith('*.') || r.name === '*' ? name.endsWith(`.${r.fqdn.slice(2)}`) && !name.slice(0, -(r.fqdn.length - 1)).includes('.') : false);
    if (wild.length) return wild.flatMap((r) => r.values.map((v) => ({ name, type: r.type, ttl: r.ttl, value: v })));
    const dyn = this.dhcp.hostnames().find((h) => `${h.name}.lab` === name);
    if (dyn) return A(numToIp(dyn.ip));
    const rev = fromReverse(name);
    if (rev) {
      const ptr = (v: string): DnsRecord[] => [{ name, type: 'PTR', ttl: 30, value: v }];
      if (rev === GATEWAY) return ptr('gateway.lab');
      const v = st.vms.find((x) => x.ip === rev);
      if (v) return ptr(v.fqdn);
      const l = st.loadBalancers.find((x) => x.vip === rev);
      if (l) return ptr(l.fqdn);
      const h = Object.entries(this.hosts).find(([, ip]) => ip === rev);
      if (h) return ptr(h[0]);
    }
    // A zone exists but the name does not: NXDOMAIN; a known zone apex answers NODATA.
    if (st.zones.some((z) => z.name === name) || name === 'lab') return [{ name, type: 'TXT', ttl: 30, value: 'lab zone' }];
    return [];
  }

  /** Resolve a name the way a VM would (for webhooks from the lab host). */
  resolve(host: string): string | null {
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
    for (let i = 0, n = host.toLowerCase(); i < 8; i++) {
      const r = this.lookup(n);
      const a = r.find((x) => x.type === 'A');
      if (a) return a.value;
      const c = r.find((x) => x.type === 'CNAME');
      if (!c) return null;
      n = c.value;
    }
    return null;
  }

  private async deliver(url: string, body: string, headers: Record<string, string>): Promise<number> {
    const u = new URL(url);
    const ip = this.resolve(u.hostname);
    if (!ip) throw new Error(`cannot resolve ${u.hostname}`);
    const target = `${u.pathname}${u.search}`;
    if (ip === GATEWAY || ip === METADATA_IP) {
      const r = await this.serve({ method: 'POST', target, path: u.pathname, query: u.searchParams, version: 'HTTP/1.1', headers: { ...headers, host: u.hostname }, body: new TextEncoder().encode(body), host: u.hostname, remote: { ip: GATEWAY, port: 0 }, local: { ip, port: Number(u.port || 80) }, vlan: 1 });
      return r.status;
    }
    const r = await httpRequest(this.host, { ip, port: Number(u.port || 80), method: 'POST', target, headers: { ...headers, host: u.host }, body, timeoutMs: 5000 });
    return r.status;
  }

  dispose(): void {
    this.lbs.dispose();
    for (const close of this.ports.values()) close();
    this.ports.clear();
    for (const off of this.offs) off();
    this.detach?.();
  }
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / 1024 / 1024).toFixed(1)} MiB`;
}

export { reverseName };
