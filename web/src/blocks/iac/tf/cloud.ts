// Edu Cloud: the training cloud behind the `edu` provider. Its state lives in
// the simulated machine (/srv/educloud/cloud.json), so the `edu` console CLI
// and Terraform see the same reality, and a snapshot keeps both. Changing a
// resource through the console is how drift is made.

import type { FsApi } from '../../../core/types';

export const CLOUD_PATH = '/srv/educloud/cloud.json';

export type Attrs = Record<string, unknown>;

export interface CloudResource {
  type: string;
  id: string;
  attrs: Attrs;
}

export interface CloudLog {
  at: number;
  source: 'api' | 'console';
  user: string;
  action: string;
  id: string;
  detail: string;
}

export interface CloudState {
  next: number;
  resources: Record<string, CloudResource>;
  log: CloudLog[];
  quota: { cores: number };
  /** One-shot faults for lessons: fail the Nth API create with 429. */
  faults?: { rateLimitAfter?: number };
  calls: number;
}

export const IMAGES = ['ubuntu-24.04', 'debian-13', 'alpine-3.22'];
export const ZONES = ['edu-central-1a', 'edu-central-1b'];
export const DNS_ZONES = ['site.edu', 'edu.cloud'];

export class CloudError extends Error {
  constructor(
    public status: number,
    msg: string,
  ) {
    super(msg);
  }
}

export function emptyCloud(): CloudState {
  return { next: 1, resources: {}, log: [], quota: { cores: 16 }, calls: 0 };
}

export class Cloud {
  constructor(
    private fs: FsApi,
    private clock: () => number = () => Date.now(),
  ) {}

  read(): CloudState {
    try {
      return { ...emptyCloud(), ...(JSON.parse(this.fs.readFile(CLOUD_PATH)) as CloudState) };
    } catch {
      return emptyCloud();
    }
  }

  write(s: CloudState): void {
    if (!this.fs.exists('/srv/educloud')) this.fs.mkdir('/srv/educloud', { parents: true });
    this.fs.writeFile(CLOUD_PATH, JSON.stringify(s, null, 1));
  }

  private mutate<T>(fn: (s: CloudState) => T): T {
    const s = this.read();
    const r = fn(s);
    this.write(s);
    return r;
  }

  get(id: string): CloudResource | undefined {
    return this.read().resources[id];
  }

  list(type?: string): CloudResource[] {
    return Object.values(this.read().resources).filter((r) => !type || r.type === type);
  }

  private validate(s: CloudState, type: string, a: Attrs, selfId?: string): void {
    if (type === 'edu_vm') {
      if (!IMAGES.includes(String(a.image))) throw new CloudError(400, `image "${a.image}" not found; available: ${IMAGES.join(', ')}`);
      if (!ZONES.includes(String(a.zone))) throw new CloudError(400, `zone "${a.zone}" does not exist`);
      if (![1, 2, 4, 8].includes(Number(a.cores))) throw new CloudError(400, `cores must be one of 1, 2, 4, 8 (got ${a.cores})`);
      const net = s.resources[String(a.network_id)];
      if (!net || net.type !== 'edu_network') throw new CloudError(404, `network "${a.network_id}" not found`);
      const used = Object.values(s.resources).filter((r) => r.type === 'edu_vm' && r.id !== selfId).reduce((n, r) => n + Number(r.attrs.cores ?? 0), 0);
      if (used + Number(a.cores) > s.quota.cores) throw new CloudError(403, `quota exceeded: cores ${used + Number(a.cores)} of ${s.quota.cores}`);
    }
    if (type === 'edu_dns_record') {
      if (!DNS_ZONES.includes(String(a.zone))) throw new CloudError(404, `DNS zone "${a.zone}" not found`);
      const dup = Object.values(s.resources).find((r) => r.type === 'edu_dns_record' && r.id !== selfId && r.attrs.zone === a.zone && r.attrs.name === a.name && r.attrs.type === a.type);
      if (dup) throw new CloudError(409, `record ${a.name}.${a.zone} ${a.type} already exists (${dup.id})`);
    }
    if (type === 'edu_network' && !/^\d+\.\d+\.\d+\.\d+\/\d+$/.test(String(a.cidr))) throw new CloudError(400, `invalid CIDR "${a.cidr}"`);
  }

  private throttle(s: CloudState): void {
    s.calls++;
    if (s.faults?.rateLimitAfter !== undefined && s.calls > s.faults.rateLimitAfter) {
      delete s.faults.rateLimitAfter;
      throw new CloudError(429, 'Too Many Requests: rate limit of the training API exceeded, retry later');
    }
  }

  create(type: string, a: Attrs, source: CloudLog['source'] = 'api', user = 'terraform'): CloudResource {
    return this.mutate((s) => {
      this.throttle(s);
      this.validate(s, type, a);
      const n = s.next++;
      const prefix = type === 'edu_vm' ? 'vm' : type === 'edu_network' ? 'net' : 'dns';
      const id = `${prefix}-${(0x4f10 + n * 0x2b).toString(16)}`;
      const attrs: Attrs = { ...a, id };
      if (type === 'edu_vm') {
        attrs.private_ip = `10.0.0.${10 + n}`;
        attrs.public_ip = `203.0.113.${10 + n}`;
        attrs.status = 'running';
      }
      if (type === 'edu_dns_record') attrs.fqdn = `${a.name}.${a.zone}`;
      s.resources[id] = { type, id, attrs };
      s.log.push({ at: this.clock(), source, user, action: 'create', id, detail: `${type}` });
      return s.resources[id];
    });
  }

  update(id: string, changes: Attrs, source: CloudLog['source'] = 'api', user = 'terraform'): CloudResource {
    return this.mutate((s) => {
      const r = s.resources[id];
      if (!r) throw new CloudError(404, `${id} not found`);
      this.throttle(s);
      const next = { ...r.attrs, ...changes };
      this.validate(s, r.type, next, id);
      r.attrs = next;
      if (r.type === 'edu_dns_record') r.attrs.fqdn = `${r.attrs.name}.${r.attrs.zone}`;
      s.log.push({ at: this.clock(), source, user, action: 'update', id, detail: Object.entries(changes).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ') });
      return r;
    });
  }

  delete(id: string, source: CloudLog['source'] = 'api', user = 'terraform'): void {
    this.mutate((s) => {
      const r = s.resources[id];
      if (!r) throw new CloudError(404, `${id} not found`);
      if (r.type === 'edu_network' && Object.values(s.resources).some((x) => x.type === 'edu_vm' && x.attrs.network_id === id)) throw new CloudError(409, `network ${id} is in use by VMs`);
      this.throttle(s);
      delete s.resources[id];
      s.log.push({ at: this.clock(), source, user, action: 'delete', id, detail: r.type });
    });
  }
}
