// Fact readers for the checks of block 9: the cluster-from-code stand
// (facts.kcode), Terraform (facts.tf), Ansible runs, kube-lite objects and
// the forge. Every check reads state, never the typed command.

import type { Facts } from '../../../core/types';
import { lastRun, runs } from '../../iac/ans/command';
import { forgeFact } from '../../git-cicd/git/setup';
import { tfDir } from '../../iac/tf/edu';
import { kc } from '../stand';
import { INFRA } from './setups';

export { kc, lastRun, runs };

export const vms = (f: Facts) => kc(f)?.vms ?? [];
export const hosts = (f: Facts) => kc(f)?.hosts ?? [];
export const host = (f: Facts, name: string) => hosts(f).find((h) => h.name === name);
export const cluster = (f: Facts) => kc(f)?.cluster;
export const readyNodes = (f: Facts) => (cluster(f)?.nodes ?? []).filter((n) => n.ready).length;
export const tf = (f: Facts) => tfDir(f, INFRA);
export const lastOut = (f: Facts) => (f.term.main ?? []).at(-1)?.out ?? '';
const clean = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

/** Three VMs named cp-1, worker-1, worker-2, all with the course label. */
export function threeNodesLabelled(f: Facts): boolean {
  const v = vms(f);
  const names = v.map((x) => x.name).sort().join(',');
  return names === 'cp-1,worker-1,worker-2' && v.every((x) => x.labels.trainer === 'devops');
}

/** The last ansible-playbook run (not --check) left every host with changed=0 and failed=0. */
export function idempotentRun(f: Facts, min = 3): boolean {
  const r = lastRun(f);
  if (!r || r.check) return false;
  const rec = Object.values(r.recap);
  return rec.length >= min && rec.every((x) => x.changed === 0 && x.failed === 0 && x.unreachable === 0);
}

/** A file on a managed host, read from the control machine. */
export const hostFile = (f: Facts, h: string, path: string) => f.files[`/srv/hosts/${h}${path}`]?.text ?? '';

export function pingedAll(f: Facts): boolean {
  const out = clean(lastOut(f));
  return ['cp-1', 'worker-1', 'worker-2'].every((h) => new RegExp(`${h} \\| SUCCESS`).test(out));
}

export function inventoryOk(f: Facts, path: string): boolean {
  const text = f.files[path]?.text ?? '';
  const cp = vms(f).find((v) => v.name === 'cp-1');
  return !!cp && /\[control_plane\][^[]*cp-1/.test(text) && /\[workers\][^[]*worker-1[^[]*worker-2/.test(text) && text.includes(`cp_endpoint=${cp.ip}:6443`);
}

export function planNoChanges(f: Facts): boolean {
  const p = tf(f)?.lastPlan;
  return !!p && p.kind === 'plan' && p.add === 0 && p.change === 0 && p.destroy === 0 && (tf(f)?.state.length ?? 0) > 0;
}

// ── kube-lite objects and GitOps ──

interface Obj {
  kind: string;
  metadata: { name: string; namespace?: string; annotations?: Record<string, string> };
  spec?: Record<string, unknown>;
  status?: Record<string, unknown>;
}

export const objects = (f: Facts) => ((f.k8s as { objects?: Obj[] } | undefined)?.objects ?? []) as Obj[];
export const obj = (f: Facts, kind: string, ns: string | undefined, name: string) => objects(f).find((o) => o.kind === kind && o.metadata.name === name && (ns === undefined || o.metadata.namespace === ns));
export const app = (f: Facts, name = 'shop') => obj(f, 'Application', 'argocd', name) as (Obj & { status?: { sync?: { status?: string; revision?: string }; health?: { status?: string }; operationState?: { phase?: string } } }) | undefined;
export const synced = (f: Facts, name = 'shop') => app(f, name)?.status?.sync?.status === 'Synced';
export const healthy = (f: Facts, name = 'shop') => app(f, name)?.status?.health?.status === 'Healthy';
export const forgeHead = (f: Facts, project = 'team/shop-deploy', branch = 'main') => forgeFact(f, project)?.branches[branch];
export const deployment = (f: Facts, ns = 'shop', name = 'shop') => obj(f, 'Deployment', ns, name) as (Obj & { spec?: { replicas?: number; template?: { spec?: { containers?: { image?: string }[] } } } }) | undefined;
export const image = (f: Facts, ns = 'shop', name = 'shop') => deployment(f, ns, name)?.spec?.template?.spec?.containers?.[0]?.image;

/** The timeline of kube-lite: did the Deployment ever have this many replicas? */
export function hadReplicas(f: Facts, n: number, name = 'shop'): boolean {
  const tl = ((f.k8s as { timeline?: { kind: string; name: string; summary?: { replicas?: number } }[] } | undefined)?.timeline ?? []);
  return tl.some((t) => t.kind === 'Deployment' && t.name === name && t.summary?.replicas === n);
}
