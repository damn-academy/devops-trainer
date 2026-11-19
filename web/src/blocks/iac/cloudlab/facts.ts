// Facts of the in-tab cloud for checks (design 00 §6.2, §6.13): what the
// cloud API, the object storage, git.lab and the CI bridge know, flattened
// so predicates stay short:
//
//   cloud.vms[name=web-1].status = RUNNING        cloud.requests[status=401]
//   cloud.ops[kind=vm.create].status = DONE       cloud.records[fqdn=www.shop.lab].values has 10.0.0.21
//   s3.objects[bucket=tfstate].key = lab/terraform.tfstate
//   s3.states[key='lab/terraform.tfstate'].resources[address='lab_vm.web'].id = vm-…
//   git.repos[name=infra].branches has main       ci.pipelines[last].status = success
//
// Pure: the widget passes the live objects, tests pass plain ones.

import type { CloudState } from '../../../engine/cloud/api';

export interface ApiRequestRec {
  method: string;
  path: string;
  status: number;
  from: string;
}

export interface StateResource {
  /** 'lab_vm.web', 'module.web["a"].lab_vm.this' */
  address: string;
  type: string;
  name: string;
  module?: string;
  mode: 'managed' | 'data';
  index?: string | number;
  id?: string;
  attrs: Record<string, unknown>;
}

export interface TfStateFacts {
  serial: number;
  lineage: string;
  resources: StateResource[];
  outputs: string[];
}

export interface CloudScope {
  project: string;
  vms: { id: string; name: string; hostname: string; status: string; ip: string; fqdn: string; flavor: string; image: string; memory_mb: number; labels: Record<string, string>; sgs: string[]; keys: number; user_data: boolean; boot?: string }[];
  networks: { id: string; name: string; cidr: string; vlan: number }[];
  subnets: { id: string; name: string; cidr: string; network: string }[];
  sgs: { id: string; name: string; rules: string[]; labels: Record<string, string> }[];
  sshKeys: { id: string; name: string; fingerprint: string }[];
  disks: { id: string; name: string; size_mb: number; status: string; vm?: string }[];
  lbs: { id: string; name: string; vip: string; status: string; targets: string[] }[];
  zones: { id: string; name: string }[];
  records: { id: string; zone: string; name: string; fqdn: string; type: string; values: string[] }[];
  buckets: { id: string; name: string }[];
  ops: { id: string; kind: string; target: string; status: string; error?: string }[];
  requests: ApiRequestRec[];
  keys: number;
}

export interface S3Scope {
  objects: { bucket: string; key: string; size: number; type: string }[];
  /** Objects that are OpenTofu/Terraform state files. */
  states: ({ bucket: string; key: string } & TfStateFacts)[];
}

export interface GitScope {
  repos: { name: string; branches: string[]; head: string; hooks: number; commits: number; files: string[] }[];
}

export interface CiJobFacts {
  name: string;
  stage: string;
  status: string;
  exit?: number;
  log: string;
}

export interface CiPipelineFacts {
  id: number;
  repo: string;
  ref: string;
  sha: string;
  status: string;
  jobs: CiJobFacts[];
  error?: string;
}

export interface CiScope {
  pipelines: CiPipelineFacts[];
}

/** A rule as one line, the way a person reads it: 'ingress tcp 22 0.0.0.0/0'. */
export function ruleLine(r: { direction: string; protocol: string; port_min?: number; port_max?: number; cidr: string }): string {
  const ports = r.port_min === undefined ? '' : r.port_max !== undefined && r.port_max !== r.port_min ? ` ${r.port_min}-${r.port_max}` : ` ${r.port_min}`;
  return `${r.direction} ${r.protocol}${ports} ${r.cidr}`;
}

export function cloudScope(st: CloudState, requests: ApiRequestRec[] = []): CloudScope {
  const name = (list: { id: string; name: string }[], id: string | null | undefined) => list.find((x) => x.id === id)?.name ?? id ?? '';
  return {
    project: st.projects[0]?.name ?? 'default',
    vms: st.vms.map((v) => ({
      id: v.id,
      name: v.name,
      hostname: v.hostname,
      status: v.status,
      ip: v.ip,
      fqdn: v.fqdn,
      flavor: v.flavor,
      image: v.image,
      memory_mb: v.memory_mb,
      labels: { ...v.labels },
      sgs: v.security_group_ids.map((id) => name(st.securityGroups, id)),
      keys: v.ssh_key_ids.length + v.ssh_authorized_keys.length,
      user_data: !!v.user_data,
      boot: v.boot?.kind,
    })),
    networks: st.networks.map((n) => ({ id: n.id, name: n.name, cidr: n.cidr, vlan: n.vlan })),
    subnets: st.subnets.map((s) => ({ id: s.id, name: s.name, cidr: s.cidr, network: name(st.networks, s.network_id) })),
    sgs: st.securityGroups.map((g) => ({ id: g.id, name: g.name, rules: g.rules.map(ruleLine), labels: { ...g.labels } })),
    sshKeys: st.sshKeys.map((k) => ({ id: k.id, name: k.name, fingerprint: k.fingerprint })),
    disks: st.disks.map((d) => ({ id: d.id, name: d.name, size_mb: d.size_mb, status: d.status, vm: d.vm_id ? name(st.vms, d.vm_id) : undefined })),
    lbs: st.loadBalancers.map((l) => ({ id: l.id, name: l.name, vip: l.vip, status: l.status, targets: l.target_vm_ids.map((id) => name(st.vms, id)) })),
    zones: st.zones.map((z) => ({ id: z.id, name: z.name })),
    records: st.records.map((r) => ({ id: r.id, zone: name(st.zones, r.zone_id), name: r.name, fqdn: r.fqdn, type: r.type, values: [...r.values] })),
    buckets: st.buckets.map((b) => ({ id: b.id, name: b.name })),
    ops: st.operations.map((o) => ({ id: o.id, kind: o.kind, target: o.target.name, status: o.status, error: o.error?.code })),
    requests: requests.slice(-200),
    keys: st.keys.length,
  };
}

/** Parse a state file (format version 4); null when the bytes are not one. */
export function parseTfState(text: string): TfStateFacts | null {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    return null;
  }
  if (!j || typeof j !== 'object') return null;
  const s = j as { version?: number; serial?: number; lineage?: string; resources?: unknown[]; outputs?: Record<string, unknown> };
  if (s.version !== 4 || !Array.isArray(s.resources)) return null;
  const resources: StateResource[] = [];
  for (const r of s.resources as { mode?: string; type?: string; name?: string; module?: string; instances?: { index_key?: string | number; attributes?: Record<string, unknown> }[] }[]) {
    if (!r?.type || !r.name) continue;
    const base = `${r.module ? `${r.module}.` : ''}${r.mode === 'data' ? 'data.' : ''}${r.type}.${r.name}`;
    for (const inst of r.instances ?? []) {
      const idx = inst.index_key;
      const address = idx === undefined ? base : `${base}[${typeof idx === 'number' ? idx : JSON.stringify(idx)}]`;
      const attrs = inst.attributes ?? {};
      resources.push({ address, type: r.type, name: r.name, module: r.module, mode: r.mode === 'data' ? 'data' : 'managed', index: idx, id: typeof attrs.id === 'string' ? attrs.id : undefined, attrs });
    }
  }
  return { serial: s.serial ?? 0, lineage: s.lineage ?? '', resources, outputs: Object.keys(s.outputs ?? {}) };
}

export function s3Scope(objects: { bucket: string; key: string; body: Uint8Array; contentType: string }[]): S3Scope {
  const dec = new TextDecoder();
  const out: S3Scope = { objects: [], states: [] };
  for (const o of objects) {
    out.objects.push({ bucket: o.bucket, key: o.key, size: o.body.length, type: o.contentType });
    if (o.body.length && o.body.length < 4 * 1024 * 1024 && (o.key.endsWith('.tfstate') || o.body[0] === 0x7b)) {
      const st = parseTfState(dec.decode(o.body));
      if (st) out.states.push({ bucket: o.bucket, key: o.key, ...st });
    }
  }
  return out;
}

/** Every fact of the cloud lab in one object (the scopes next to a machine's own facts). */
export interface CloudLabFacts {
  cloud: CloudScope;
  s3: S3Scope;
  git: GitScope;
  ci: CiScope;
}
