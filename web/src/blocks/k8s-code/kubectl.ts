import { stringify as stringifyYaml } from 'yaml';
// kubectl on the "cluster from code" stand. kube-lite's kubectl attaches a
// cluster of its own to every machine, so on a stand host it would print three
// Ready k3s nodes whether or not kubeadm has joined them. When the kubeconfig
// kubectl reads points at the API server of the stand's kubeadm cluster,
// `kubectl get nodes` is answered from the cluster memory (stand.ts) instead:
// the members kubeadm init and join recorded, their kubeadm version, the
// control-plane role, Ready only once the CNI is in and the kubelet runs, and
// the age since they joined. Everything else goes to kube-lite unchanged.

import type { CmdContext, ShellCommand } from '../../core/types';
import { kubectlCommand } from '../../engine/kube-lite/kubectl/index';
import { Host } from '../iac/ans/hosts';
import { currentStand, readCluster, standNow, type ClusterDb } from './stand';

const base = kubectlCommand();

const NODE_KINDS = new Set(['nodes', 'node', 'no']);

interface NodesQuery {
  kubeconfig?: string;
  format?: 'json' | 'yaml';
  describe?: boolean;
  wide: boolean;
  names: boolean;
  noHeaders: boolean;
  name?: string;
}

/** `get nodes [NAME] [-o wide|name] [--no-headers] [--kubeconfig F]`, or null for anything else. */
export function parseNodesQuery(args: string[]): NodesQuery | null {
  const q: NodesQuery = { wide: false, names: false, noHeaders: false };
  const pos: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--kubeconfig') q.kubeconfig = args[++i];
    else if (a.startsWith('--kubeconfig=')) q.kubeconfig = a.slice('--kubeconfig='.length);
    else if (a === '--no-headers' || a === '--no-headers=true') q.noHeaders = true;
    else if (a === '-o' || a === '--output' || /^(-o=?|--output=)(wide|name|json|yaml)$/.test(a)) {
      const v = a === '-o' || a === '--output' ? args[++i] : a.replace(/^(-o=?|--output=)/, '');
      if (v === 'wide') q.wide = true;
      else if (v === 'name') q.names = true;
      else if (v === 'json' || v === 'yaml') q.format = v;
      else return null;
    }
    else if (a.startsWith('-')) return null;
    else pos.push(a);
  }
  const [verb, kind, name, ...rest] = pos;
  const k = kind?.split('/')[0];
  if (!['get', 'describe'].includes(verb) || !k || !NODE_KINDS.has(k) || rest.length) return null;
  if (verb === 'describe') q.describe = true;
  q.name = kind.includes('/') ? kind.split('/')[1] : name;
  return q;
}

/** kubectl's duration format: 45s, 5m30s, 42m, 3h10m, 20h, 2d4h, 9d. */
export function humanAge(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (s < 120) return `${s}s`;
  if (m < 10) return s % 60 ? `${m}m${s % 60}s` : `${m}m`;
  if (h < 3) return `${m}m`;
  if (h < 8) return m % 60 ? `${h}h${m % 60}m` : `${h}h`;
  if (h < 48) return `${h}h`;
  if (d < 8) return h % 24 ? `${d}d${h % 24}h` : `${d}d`;
  return `${d}d`;
}

function table(rows: string[][]): string {
  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  return rows.map((r) => r.map((c, i) => (i === r.length - 1 ? c : c.padEnd(w[i] + 3))).join('').trimEnd()).join('\n') + '\n';
}

/** The node rows of the stand's kubeadm cluster, as `kubectl get nodes` prints them. */
export function nodesTable(db: ClusterDb, now: number, ready: (name: string) => boolean, q: NodesQuery): { out: string; err: string; code: number } {
  let names = Object.keys(db.members).sort((a, b) => (db.members[a].role === db.members[b].role ? a.localeCompare(b) : db.members[a].role === 'control-plane' ? -1 : 1));
  if (q.name) {
    if (!db.members[q.name]) return { out: '', err: `Error from server (NotFound): nodes "${q.name}" not found\n`, code: 1 };
    names = [q.name];
  }
  if (q.format || q.describe) {
    const items = names.map(name => {
      const member = db.members[name];
      return { apiVersion: 'v1', kind: 'Node', metadata: { name, creationTimestamp: new Date(member.joinedAt).toISOString(), labels: member.role === 'control-plane' ? { 'node-role.kubernetes.io/control-plane': '' } : {} }, spec: {}, status: { addresses: [{ type: 'InternalIP', address: member.ip }, { type: 'Hostname', address: name }], nodeInfo: { kubeletVersion: member.version, containerRuntimeVersion: 'containerd://2.1.4' }, conditions: [{ type: 'Ready', status: ready(name) ? 'True' : 'False' }] } };
    });
    const value = q.name ? items[0] : { apiVersion: 'v1', kind: 'List', items };
    const out = q.describe ? items.map(n => `Name:               ${n.metadata.name}\nRoles:              ${db.members[n.metadata.name].role}\nInternalIP:         ${n.status.addresses[0].address}\nKubelet Version:    ${n.status.nodeInfo.kubeletVersion}\nConditions:\n  Ready  ${n.status.conditions[0].status}\n`).join('\n') : q.format === 'yaml' ? stringifyYaml(value) : JSON.stringify(value, null, 2) + '\n';
    return { out, err: '', code: 0 };
  }
  if (!names.length) return { out: '', err: 'No resources found\n', code: 0 };
  if (q.names) return { out: names.map((n) => `node/${n}\n`).join(''), err: '', code: 0 };
  const head = ['NAME', 'STATUS', 'ROLES', 'AGE', 'VERSION'];
  if (q.wide) head.push('INTERNAL-IP', 'EXTERNAL-IP', 'OS-IMAGE', 'KERNEL-VERSION', 'CONTAINER-RUNTIME');
  const rows = names.map((n) => {
    const mem = db.members[n];
    const r = [n, ready(n) ? 'Ready' : 'NotReady', mem.role === 'control-plane' ? 'control-plane' : '<none>', humanAge(now - mem.joinedAt), mem.version];
    if (q.wide) r.push(mem.ip, '<none>', 'Ubuntu 24.04.3 LTS', '6.8.0-88-generic', 'containerd://2.1.4');
    return r;
  });
  const out = table([head, ...rows]);
  return { out: q.noHeaders ? out.slice(out.indexOf('\n') + 1) : out, err: '', code: 0 };
}

function standNodes(ctx: CmdContext): { out: string; err: string; code: number } | null {
  const q = parseNodesQuery(ctx.argv.slice(1));
  if (!q) return null;
  const stand = currentStand();
  const db = stand ? readCluster(stand.rootFs) : null;
  if (!stand || !db) return null;
  const path = q.kubeconfig ?? ctx.env.KUBECONFIG ?? `${ctx.env.HOME ?? '/root'}/.kube/config`;
  const resolved = ctx.fs.resolve(path);
  if (!ctx.fs.exists(resolved)) return null;
  const server = /^\s*server:\s*(\S+)/m.exec(ctx.fs.readFile(resolved))?.[1];
  if (server !== `https://${db.endpoint}`) return null;
  const ready = (n: string) => {
    if (!db.cni) return false;
    if (!Host.exists(stand.rootFs, n)) return false;
    const s = new Host(stand.rootFs, n).db().services;
    return s.kubelet?.state === 'started' && s.containerd?.state === 'started';
  };
  return nodesTable(db, standNow(stand), ready, q);
}

export const kcodeKubectl: ShellCommand = {
  ...base,
  override: true,
  async run(ctx) {
    const r = standNodes(ctx);
    if (!r) return base.run(ctx);
    if (r.out) ctx.out(r.out);
    if (r.err) ctx.err(r.err);
    return r.code;
  },
};
