// The "cluster from code" stand (06 §6) on the existing simulators: Edu Cloud
// and tfsim make the machines, ansim configures them, and this file is the
// glue between the two plus the memory of the kubeadm cluster.
//
//  - A VM that Terraform creates in Edu Cloud becomes a managed host of the
//    Ansible simulator (/srv/hosts/<name>) with the VM's private address; a
//    destroyed VM takes its host with it, a recreated VM comes back empty.
//    That is what makes "destroy → apply → playbook" a real rebuild.
//  - The cluster's own state (the endpoint, bootstrap tokens, the CA hash,
//    members, the CNI) lives on the control machine in /srv/kcode/cluster.json,
//    the stand's etcd. kubeadm runs on a host through the command module of
//    Ansible, on a scratch machine that holds only the host's files, so it
//    reaches this state through the stand that is running the command.
//  - facts.kcode: what a check needs — VMs, hosts and their preparation,
//    the cluster and its nodes.

import type { FactsProvider, FsApi, SetupHook, SimMachineApi } from '../../core/types';
import { Host, HOSTS_ROOT, PACKAGES } from '../iac/ans/hosts';
import { Cloud } from '../iac/tf/cloud';
import { machineNow } from '../../engine/kube-lite/state';
import { initFiles, joinFiles, newCaHash, tokenString } from './kubeadm';

export const K8S_VERSION = 'v1.36.4';
export const K8S_NEXT = 'v1.37.1';
const PKG_VERSION = '1.36.4-1.1';
export const CLUSTER_PATH = '/srv/kcode/cluster.json';
const OWNED_PATH = '/srv/kcode/hosts.json';

// ── packages the node roles install (added to the simulator's repository) ──

const marker = (name: string) => ({ [`/var/lib/dpkg/info/${name}.list`]: `/usr/bin/${name}\n` });
const STAND_PACKAGES: typeof PACKAGES = {
  containerd: { version: '2.1.4-1', service: 'containerd', files: { ...marker('containerd') } },
  kubelet: { version: PKG_VERSION, service: 'kubelet', files: { ...marker('kubelet'), '/usr/lib/systemd/system/kubelet.service.d/10-kubeadm.conf': '[Service]\nEnvironment="KUBELET_KUBECONFIG_ARGS=--bootstrap-kubeconfig=/etc/kubernetes/bootstrap-kubelet.conf --kubeconfig=/etc/kubernetes/kubelet.conf"\nEnvironment="KUBELET_CONFIG_ARGS=--config=/var/lib/kubelet/config.yaml"\nExecStart=\nExecStart=/usr/bin/kubelet $KUBELET_KUBECONFIG_ARGS $KUBELET_CONFIG_ARGS $KUBELET_KUBEADM_ARGS $KUBELET_EXTRA_ARGS\n' } },
  kubeadm: { version: PKG_VERSION, files: { ...marker('kubeadm') } },
  kubectl: { version: PKG_VERSION, files: { ...marker('kubectl') } },
};
for (const [k, v] of Object.entries(STAND_PACKAGES)) if (!PACKAGES[k]) PACKAGES[k] = v;

// ── the stand that is running a command right now ──

let current: SimMachineApi | null = null;

/** The control machine of the stand whose command is running (kubeadm on a scratch host machine reads it). */
export function currentStand(): SimMachineApi | null {
  return current;
}

/** For tests and for setup: make this machine the active stand. */
export function activateStand(m: SimMachineApi | null): void {
  current = m;
}

// ── the cluster memory ──

export interface Token {
  token: string;
  expires: number;
  description?: string;
}

export interface Member {
  role: 'control-plane' | 'worker';
  ip: string;
  version: string;
  joinedAt: number;
}

export interface ClusterDb {
  cp: string;
  endpoint: string;
  caHash: string;
  version: string;
  podSubnet: string;
  initAt: number;
  tokens: Token[];
  members: Record<string, Member>;
  cni: { name: string; version: string; at: number } | null;
}

export function readCluster(fs: FsApi): ClusterDb | null {
  try {
    return JSON.parse(fs.readFile(CLUSTER_PATH)) as ClusterDb;
  } catch {
    return null;
  }
}

export function writeCluster(fs: FsApi, db: ClusterDb | null): void {
  if (!fs.exists('/srv/kcode')) fs.mkdir('/srv/kcode', { parents: true });
  if (db) fs.writeFile(CLUSTER_PATH, JSON.stringify(db, null, 1));
  else if (fs.exists(CLUSTER_PATH)) fs.unlink(CLUSTER_PATH);
}

export function standNow(m: SimMachineApi | null): number {
  return m ? machineNow(m) : Date.now();
}

// ── Edu Cloud VMs → Ansible hosts ──

function removeTree(fs: FsApi, path: string): void {
  const st = fs.lstat(path);
  if (!st) return;
  if (st.type === 'd') {
    for (const e of fs.readdir(path)) removeTree(fs, `${path}/${e}`);
    fs.rmdir(path);
  } else fs.unlink(path);
}

function readOwned(fs: FsApi): Record<string, string> {
  try {
    return JSON.parse(fs.readFile(OWNED_PATH)) as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Make the managed hosts follow the cloud: a running edu_vm is a host with its
 * private address; a VM that is gone or was recreated takes its host away.
 * When the control-plane VM goes, the cluster memory goes with it.
 */
export function syncHosts(m: SimMachineApi): void {
  const fs = m.rootFs;
  if (!fs.exists('/srv/educloud/cloud.json')) return;
  const vms = new Cloud(fs).list('edu_vm').filter((r) => r.attrs.status === 'running' && typeof r.attrs.name === 'string');
  const owned = readOwned(fs);
  const next: Record<string, string> = {};
  let changed = false;
  const db = readCluster(fs);
  let dbChanged = false;
  for (const [name, id] of Object.entries(owned)) {
    const vm = vms.find((v) => v.attrs.name === name);
    if (!vm || vm.id !== id) {
      removeTree(fs, `${HOSTS_ROOT}/${name}`);
      changed = true;
      if (db?.members[name]) {
        delete db.members[name];
        dbChanged = true;
      }
      if (db && db.cp === name) {
        writeCluster(fs, null);
        dbChanged = false;
      }
    }
  }
  vms.forEach((vm, i) => {
    const name = String(vm.attrs.name);
    if (owned[name] === vm.id && Host.exists(fs, name)) {
      next[name] = vm.id;
      return;
    }
    if (Host.exists(fs, name) && !(name in owned)) return; // a host the lesson made itself
    Host.create(fs, { name, ip: String(vm.attrs.private_ip) }, i);
    new Host(fs, name).write('/etc/fstab', FRESH_FSTAB);
    new Host(fs, name).write('/etc/ssh/sshd_config', SSHD_CONFIG);
    next[name] = vm.id;
    changed = true;
  });
  if (dbChanged && readCluster(fs)) writeCluster(fs, db);
  if (changed || JSON.stringify(next) !== JSON.stringify(owned)) {
    if (!fs.exists('/srv/kcode')) fs.mkdir('/srv/kcode', { parents: true });
    fs.writeFile(OWNED_PATH, JSON.stringify(next));
  }
  // The Cilium agent (a DaemonSet) writes its CNI config on every member node.
  const cur = readCluster(fs);
  for (const n of Object.keys(cur?.members ?? {})) {
    if (!Host.exists(fs, n)) continue;
    const h = new Host(fs, n);
    if (cur?.cni && !h.exists(CNI_CONF)) h.write(CNI_CONF, CNI_CONF_TEXT);
    if (!cur?.cni && h.exists(CNI_CONF)) h.remove(CNI_CONF);
  }
}

export const CNI_CONF = '/etc/cni/net.d/05-cilium.conflist';
const CNI_CONF_TEXT = '{\n  "cniVersion": "0.3.1",\n  "name": "cilium",\n  "plugins": [\n    {\n       "type": "cilium-cni",\n       "enable-debug": false,\n       "log-file": "/var/run/cilium/cilium-cni.log"\n    }\n  ]\n}\n';

// ── what a prepared node looks like (for setups that start later in the route) ──

export const CONTAINERD_TOML = (systemd: boolean) =>
  `version = 3\n\n[plugins.'io.containerd.cri.v1.runtime'.containerd.runtimes.runc]\n  runtime_type = 'io.containerd.runc.v2'\n\n[plugins.'io.containerd.cri.v1.runtime'.containerd.runtimes.runc.options]\n  SystemdCgroup = ${systemd}\n`;

export const PREP_FILES: Record<string, string> = {
  '/etc/fstab': 'UUID=4f1c2a7e-0b1d-4e55-9a51-2c4f0e9b1d10 / ext4 errors=remount-ro 0 1\n# /swap.img none swap sw 0 0\n',
  '/etc/modules-load.d/k8s.conf': 'overlay\nbr_netfilter\n',
  '/etc/sysctl.d/99-kubernetes.conf': 'net.ipv4.ip_forward = 1\n',
  '/etc/apt/sources.list.d/kubernetes.list': 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.36/deb/ /\n',
  '/etc/containerd/config.toml': CONTAINERD_TOML(true),
};

/** sshd of the VM image: keys only, as cloud images ship it. */
export const SSHD_CONFIG = 'Include /etc/ssh/sshd_config.d/*.conf\nKbdInteractiveAuthentication no\nPasswordAuthentication no\nPermitRootLogin prohibit-password\nUsePAM yes\nX11Forwarding yes\nSubsystem sftp /usr/lib/openssh/sftp-server\n';

/** The fresh image of a VM: swap is on in fstab, nothing for Kubernetes yet. */
export const FRESH_FSTAB = 'UUID=4f1c2a7e-0b1d-4e55-9a51-2c4f0e9b1d10 / ext4 errors=remount-ro 0 1\n/swap.img none swap sw 0 0\n';

export function prepareHost(fs: FsApi, name: string, o: { systemdCgroup?: boolean; skip?: string[] } = {}): void {
  const h = new Host(fs, name);
  for (const [p, text] of Object.entries(PREP_FILES)) {
    if (o.skip?.includes(p)) continue;
    h.write(p, p === '/etc/containerd/config.toml' ? CONTAINERD_TOML(o.systemdCgroup ?? true) : text);
  }
  for (const p of ['containerd', 'kubelet', 'kubeadm', 'kubectl']) h.install(p);
}

// ── the setup hook ──

export interface KcodeSetup {
  /** Run `terraform init && terraform apply` in this directory before the prompt (the VMs exist already). */
  apply?: string;
  /** Write this file from the `inventory` output after the apply. */
  inventory?: string;
  /** Hosts that are already prepared for kubeadm (the earlier lessons did it). */
  prepared?: string[];
  /** Preparation with a planted fault: host → which file is missing or wrong. */
  faults?: { host: string; kind: 'swap' | 'ipforward' | 'cgroup' | 'kubelet-stopped' | 'ssh-password' }[];
  /** Run kubeadm init on the control plane and join these workers before the prompt. */
  cluster?: { cp: string; workers?: string[]; cni?: boolean; token?: string; expiredToken?: boolean };
}

const listening = new WeakSet<SimMachineApi>();

export const kcodeSetupHook: SetupHook = {
  key: 'kcode',
  async apply(m, value) {
    const v = (value ?? {}) as KcodeSetup;
    activateStand(m);
    if (!listening.has(m)) {
      listening.add(m);
      m.on((ev) => {
        if (ev.t === 'proc.exec' || ev.t === 'cmd.done') {
          activateStand(m);
          syncHosts(m);
        }
      });
    }
    const fs = m.rootFs;
    if (v.apply) {
      await m.exec(`cd ${v.apply} && terraform init -input=false && terraform apply -auto-approve -input=false`);
      const owner = m.users.find((u) => u.name === 'learner');
      if (owner) chownTree(fs, v.apply, owner.uid, owner.gid);
      if (v.inventory) {
        const out = await m.exec(`cd ${v.apply} && terraform output -raw inventory > ${v.inventory}`);
        if (out.exit === 0) {
          if (owner) fs.chown(v.inventory, owner.uid, owner.gid);
        }
        /* no outputs yet: the lesson shows the error */
      }
    }
    syncHosts(m);
    for (const name of v.prepared ?? []) if (Host.exists(fs, name)) prepareHost(fs, name);
    if (v.cluster) await bootCluster(m, v.cluster);
    for (const f of v.faults ?? []) plantFault(fs, f.host, f.kind);
  },
};

function chownTree(fs: FsApi, path: string, uid: number, gid: number): void {
  const st = fs.lstat(path);
  if (!st) return;
  fs.chown(path, uid, gid);
  if (st.type === 'd') for (const e of fs.readdir(path)) chownTree(fs, `${path}/${e}`, uid, gid);
}

export function plantFault(fs: FsApi, host: string, kind: NonNullable<KcodeSetup['faults']>[number]['kind']): void {
  if (!Host.exists(fs, host)) return;
  const h = new Host(fs, host);
  if (kind === 'swap') h.write('/etc/fstab', FRESH_FSTAB);
  if (kind === 'ipforward') h.remove('/etc/sysctl.d/99-kubernetes.conf');
  if (kind === 'cgroup') h.write('/etc/containerd/config.toml', CONTAINERD_TOML(false));
  if (kind === 'kubelet-stopped') h.update((d) => d.services.kubelet && (d.services.kubelet.state = 'stopped'));
  if (kind === 'ssh-password') h.write('/etc/ssh/sshd_config', SSHD_CONFIG.replace('PasswordAuthentication no', 'PasswordAuthentication yes'));
}

/** kubeadm init on the control plane and join for the workers, as the playbook would leave them. */
async function bootCluster(m: SimMachineApi, c: NonNullable<KcodeSetup['cluster']>): Promise<void> {
  const fs = m.rootFs;
  const now = standNow(m);
  const cpHost = new Host(fs, c.cp);
  if (!Host.exists(fs, c.cp)) return;
  const ip = cpHost.db().meta.ip;
  const token = c.token ?? tokenString(c.cp + ip);
  // A cluster with an expired token was started yesterday: its token lived 24 hours.
  const age = c.expiredToken ? 25 * 3_600_000 : 3_600_000;
  const db: ClusterDb = {
    cp: c.cp,
    endpoint: `${ip}:6443`,
    caHash: newCaHash(c.cp + ip),
    version: K8S_VERSION,
    podSubnet: '10.244.0.0/16',
    initAt: now - age,
    tokens: [{ token, expires: now - age + 24 * 3_600_000, description: 'The default bootstrap token generated by \'kubeadm init\'.' }],
    members: { [c.cp]: { role: 'control-plane', ip, version: K8S_VERSION, joinedAt: now - age } },
    cni: c.cni ? { name: 'cilium', version: '1.18.3', at: now - age + 600_000 } : null,
  };
  for (const [p, t] of Object.entries(initFiles(c.cp, ip, db))) cpHost.write(p, t);
  for (const w of c.workers ?? []) {
    if (!Host.exists(fs, w)) continue;
    const wh = new Host(fs, w);
    for (const [p, t] of Object.entries(joinFiles(db))) wh.write(p, t);
    db.members[w] = { role: 'worker', ip: wh.db().meta.ip, version: K8S_VERSION, joinedAt: now - age + 600_000 };
  }
  writeCluster(fs, db);
}

// ── facts.kcode ──

export interface HostPrep {
  name: string;
  ip: string;
  vm: boolean;
  packages: string[];
  services: Record<string, string>;
  swapOff: boolean;
  ipForward: boolean;
  modules: string[];
  systemdCgroup: boolean;
  repo: boolean;
  initialized: boolean;
  joined: boolean;
  /** Ansible can log in and run modules there: SSH answers and Python is installed. */
  reachable: boolean;
}

export interface KcodeFacts {
  vms: { id: string; name: string; ip: string; publicIp: string; labels: Record<string, string>; cores: number; memory: number }[];
  hosts: HostPrep[];
  cluster: {
    initialized: boolean;
    cp: string | null;
    endpoint: string | null;
    version: string | null;
    cni: string | null;
    tokens: { token: string; valid: boolean; hoursLeft: number; description?: string }[];
    nodes: { name: string; role: string; ready: boolean; version: string }[];
  };
}

const allText = (h: Host, dir: string) =>
  Object.entries(h.files(dir))
    .filter(([p]) => p.endsWith('.conf'))
    .map(([, t]) => t)
    .join('\n');

export function swapIsOff(fstab: string): boolean {
  return !fstab.split('\n').some((l) => !l.trim().startsWith('#') && /\sswap\s/.test(` ${l} `));
}

export function ipForwardSet(sysctl: string): boolean {
  return sysctl.split('\n').some((l) => /^\s*net\.ipv4\.ip_forward\s*=\s*1\s*$/.test(l));
}

export function systemdCgroupSet(toml: string | null): boolean {
  return !!toml && /^\s*SystemdCgroup\s*=\s*true\s*$/m.test(toml);
}

export function hostPrep(fs: FsApi, name: string, owned: Record<string, string>, db: ClusterDb | null): HostPrep {
  const h = new Host(fs, name);
  const d = h.db();
  const modules = allText(h, '/etc/modules-load.d')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  const sysctl = [h.read('/etc/sysctl.conf') ?? '', allText(h, '/etc/sysctl.d')].join('\n');
  const repoText = Object.values(h.files('/etc/apt/sources.list.d')).join('\n');
  return {
    name,
    ip: d.meta.ip,
    vm: name in owned,
    packages: Object.keys(d.packages).sort(),
    services: Object.fromEntries(Object.entries(d.services).map(([k, s]) => [k, s.state])),
    swapOff: swapIsOff(h.read('/etc/fstab') ?? ''),
    ipForward: ipForwardSet(sysctl),
    modules,
    systemdCgroup: systemdCgroupSet(h.read('/etc/containerd/config.toml')),
    repo: /pkgs\.k8s\.io\/core:\/stable:\/v1\.36\/deb/.test(repoText),
    initialized: h.exists('/etc/kubernetes/admin.conf') && h.exists('/etc/kubernetes/manifests/kube-apiserver.yaml'),
    joined: !!db?.members[name] && h.exists('/etc/kubernetes/kubelet.conf'),
    reachable: !!d.meta.reachable && !!d.meta.python,
  };
}

export function kcodeFacts(m: SimMachineApi): KcodeFacts {
  syncHosts(m);
  const fs = m.rootFs;
  const owned = readOwned(fs);
  const db = readCluster(fs);
  const now = standNow(m);
  const vms = fs.exists('/srv/educloud/cloud.json')
    ? new Cloud(fs).list('edu_vm').map((r) => ({ id: r.id, name: String(r.attrs.name), ip: String(r.attrs.private_ip ?? ''), publicIp: String(r.attrs.public_ip ?? ''), labels: (r.attrs.labels ?? {}) as Record<string, string>, cores: Number(r.attrs.cores ?? 0), memory: Number(r.attrs.memory_gb ?? 0) }))
    : [];
  const hosts = Host.list(fs).map((n) => hostPrep(fs, n, owned, db));
  const nodes = db
    ? Object.entries(db.members).map(([name, mem]) => {
        const hp = hosts.find((x) => x.name === name);
        const ready = !!db.cni && !!hp && hp.services.kubelet === 'started' && hp.services.containerd === 'started';
        return { name, role: mem.role, ready, version: mem.version };
      })
    : [];
  return {
    vms,
    hosts,
    cluster: {
      initialized: !!db && !!hosts.find((x) => x.name === db.cp)?.initialized,
      cp: db?.cp ?? null,
      endpoint: db?.endpoint ?? null,
      version: db?.version ?? null,
      cni: db?.cni?.name ?? null,
      tokens: (db?.tokens ?? []).map((t) => ({ token: t.token, valid: t.expires > now, hoursLeft: t.expires === null || t.expires > now + 1e12 ? 1e9 : Math.round(((t.expires - now) / 3_600_000) * 10) / 10, description: t.description })),
      nodes,
    },
  };
}

export const kcodeFactsProvider: FactsProvider = { scope: 'kcode', collect: kcodeFacts };

/** Read facts.kcode in a check. */
export const kc = (f: Record<string, unknown>) => f.kcode as KcodeFacts | undefined;
