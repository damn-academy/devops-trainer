// kubeadm and the cilium CLI of the "cluster from code" stand. They run on a
// managed host — through `ansible <host> -b -a "kubeadm …"` or the command
// module of a playbook — on a scratch machine that holds the host's files, so
// the preflight checks read the same /etc/fstab, sysctl.d and containerd
// config the roles wrote. What a real cluster keeps in etcd (bootstrap
// tokens, members, the CNI) the stand keeps in /srv/kcode/cluster.json of the
// control machine (stand.ts). The files kubeadm writes, the order of its
// phases and its messages follow kubeadm v1.36.

import YAML from 'yaml';
import { bi } from '../../core/i18n';
import type { CmdContext, DocPage, FsApi, ShellCommand } from '../../core/types';
import { Host } from '../iac/ans/hosts';
import { currentStand, ipForwardSet, K8S_NEXT, K8S_VERSION, readCluster, standNow, swapIsOff, writeCluster, type ClusterDb } from './stand';

// ── deterministic material ──

function hash(s: string, n: number): string {
  let out = '';
  let h1 = 0x811c9dc5;
  let i = 0;
  while (out.length < n) {
    for (const ch of `${s}#${i}`) {
      h1 ^= ch.charCodeAt(0);
      h1 = Math.imul(h1, 0x01000193) >>> 0;
    }
    out += h1.toString(16).padStart(8, '0');
    i++;
  }
  return out.slice(0, n);
}

const B36 = 'abcdefghijklmnopqrstuvwxyz0123456789';
export function tokenString(seed: string): string {
  const hex = hash(seed, 44);
  const pick = (k: number) => Array.from({ length: k }, (_, j) => B36[parseInt(hex.slice(j * 2, j * 2 + 2), 16) % 36]).join('');
  const s = pick(22);
  return `${s.slice(0, 6)}.${s.slice(6, 22)}`;
}

export function newCaHash(seed: string): string {
  return `sha256:${hash(`ca:${seed}`, 64)}`;
}

const TOKEN_RE = /^[a-z0-9]{6}\.[a-z0-9]{16}$/;

// ── files kubeadm writes ──

const PEM = (what: string, seed: string) => `-----BEGIN ${what}-----\n${btoaSafe(hash(seed, 96))}\n-----END ${what}-----\n`;
function btoaSafe(s: string): string {
  return typeof btoa === 'function' ? btoa(s) : Buffer.from(s).toString('base64');
}

const kubeconfig = (endpoint: string, user: string, seed: string) =>
  `apiVersion: v1\nclusters:\n- cluster:\n    certificate-authority-data: ${btoaSafe(hash(`ca${seed}`, 48))}\n    server: https://${endpoint}\n  name: kubernetes\ncontexts:\n- context:\n    cluster: kubernetes\n    user: ${user}\n  name: ${user}@kubernetes\ncurrent-context: ${user}@kubernetes\nkind: Config\npreferences: {}\nusers:\n- name: ${user}\n  user:\n    client-certificate-data: ${btoaSafe(hash(`crt${user}${seed}`, 48))}\n    client-key-data: ${btoaSafe(hash(`key${user}${seed}`, 48))}\n`;

const staticPod = (name: string, image: string, cmd: string[], ip: string) =>
  `apiVersion: v1\nkind: Pod\nmetadata:\n  labels:\n    component: ${name}\n    tier: control-plane\n  name: ${name}\n  namespace: kube-system\nspec:\n  containers:\n  - command:\n${cmd.map((c) => `    - ${c}`).join('\n')}\n    image: ${image}\n    name: ${name}\n  hostNetwork: true\n  priorityClassName: system-node-critical\nstatus: {}\n# advertise: ${ip}\n`;

export function initFiles(cp: string, ip: string, db: ClusterDb): Record<string, string> {
  const v = db.version;
  const seed = db.caHash;
  const files: Record<string, string> = {};
  for (const c of ['ca', 'apiserver', 'apiserver-kubelet-client', 'front-proxy-ca', 'front-proxy-client', 'etcd/ca', 'etcd/server', 'etcd/peer', 'etcd/healthcheck-client', 'apiserver-etcd-client']) {
    files[`/etc/kubernetes/pki/${c}.crt`] = PEM('CERTIFICATE', `${c}${seed}`);
    files[`/etc/kubernetes/pki/${c}.key`] = PEM('RSA PRIVATE KEY', `k${c}${seed}`);
  }
  files['/etc/kubernetes/pki/sa.key'] = PEM('RSA PRIVATE KEY', `sa${seed}`);
  files['/etc/kubernetes/pki/sa.pub'] = PEM('PUBLIC KEY', `sap${seed}`);
  for (const [f, user] of [
    ['admin.conf', 'kubernetes-admin'],
    ['super-admin.conf', 'kubernetes-super-admin'],
    ['kubelet.conf', `system:node:${cp}`],
    ['controller-manager.conf', 'system:kube-controller-manager'],
    ['scheduler.conf', 'system:kube-scheduler'],
  ])
    files[`/etc/kubernetes/${f}`] = kubeconfig(db.endpoint, user, seed);
  files['/etc/kubernetes/manifests/etcd.yaml'] = staticPod('etcd', 'registry.k8s.io/etcd:3.6.5-0', ['etcd', `--advertise-client-urls=https://${ip}:2379`, '--data-dir=/var/lib/etcd', '--cert-file=/etc/kubernetes/pki/etcd/server.crt', '--key-file=/etc/kubernetes/pki/etcd/server.key'], ip);
  files['/etc/kubernetes/manifests/kube-apiserver.yaml'] = staticPod('kube-apiserver', `registry.k8s.io/kube-apiserver:${v}`, ['kube-apiserver', `--advertise-address=${ip}`, '--etcd-servers=https://127.0.0.1:2379', '--secure-port=6443', '--service-cluster-ip-range=10.96.0.0/12', '--tls-cert-file=/etc/kubernetes/pki/apiserver.crt'], ip);
  files['/etc/kubernetes/manifests/kube-controller-manager.yaml'] = staticPod('kube-controller-manager', `registry.k8s.io/kube-controller-manager:${v}`, ['kube-controller-manager', `--cluster-cidr=${db.podSubnet}`, '--kubeconfig=/etc/kubernetes/controller-manager.conf'], ip);
  files['/etc/kubernetes/manifests/kube-scheduler.yaml'] = staticPod('kube-scheduler', `registry.k8s.io/kube-scheduler:${v}`, ['kube-scheduler', '--kubeconfig=/etc/kubernetes/scheduler.conf'], ip);
  return files;
}

export function joinFiles(db: ClusterDb): Record<string, string> {
  return {
    '/etc/kubernetes/pki/ca.crt': PEM('CERTIFICATE', `ca${db.caHash}`),
    '/etc/kubernetes/kubelet.conf': kubeconfig(db.endpoint, 'system:node', db.caHash),
  };
}

// ── helpers ──

/** The text of every *.conf file in a directory. */
function confText(fs: FsApi, dir: string): string {
  if (!fs.exists(dir)) return '';
  return fs
    .readdir(dir)
    .filter((n) => n.endsWith('.conf'))
    .map((n) => fs.readFile(`${dir}/${n}`))
    .join('\n');
}

function installed(fs: FsApi, pkg: string): boolean {
  return fs.exists(`/var/lib/dpkg/info/${pkg}.list`);
}

function standHost(ctx: CmdContext): Host | null {
  const st = currentStand();
  if (!st) return null;
  return Host.exists(st.rootFs, ctx.machine.hostname) ? new Host(st.rootFs, ctx.machine.hostname) : null;
}

function serviceRunning(ctx: CmdContext, name: string): boolean {
  const h = standHost(ctx);
  if (!h) return true;
  return h.db().services[name]?.state === 'started';
}

function hostIp(ctx: CmdContext): string {
  return standHost(ctx)?.db().meta.ip ?? '10.0.0.11';
}

function stdb(): { fs: FsApi; db: ClusterDb | null } | null {
  const st = currentStand();
  return st ? { fs: st.rootFs, db: readCluster(st.rootFs) } : null;
}

/** A token that never expires (JSON has no Infinity). */
const NEVER = 9e15;

function parseTtl(s: string): number {
  if (s === '0') return NEVER;
  let ms = 0;
  for (const [, n, u] of s.matchAll(/(\d+)([hms])/g)) ms += Number(n) * (u === 'h' ? 3_600_000 : u === 'm' ? 60_000 : 1000);
  return ms || 24 * 3_600_000;
}

function flag(args: string[], name: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === `--${name}`) return args[i + 1];
    if (args[i].startsWith(`--${name}=`)) return args[i].slice(name.length + 3);
  }
  return undefined;
}
const has = (args: string[], name: string) => args.some((a) => a === `--${name}` || a.startsWith(`--${name}=`));

const fmtDate = (ms: number) => {
  const d = new Date(ms);
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  return `${mon} ${String(d.getUTCDate()).padStart(2, '0')}, ${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
};

interface Preflight {
  errors: string[];
  warnings: string[];
}

function preflight(ctx: CmdContext, ignore: string[], join: boolean): Preflight {
  const fs = ctx.fs;
  const errors: string[] = [];
  const warnings: string[] = [];
  const add = (name: string, text: string) => (ignore.includes(name.toLowerCase()) || ignore.includes('all') ? warnings : errors).push(`[${ignore.includes(name.toLowerCase()) || ignore.includes('all') ? 'WARNING' : 'ERROR'} ${name}]: ${text}`);
  if (!installed(fs, 'containerd') || !serviceRunning(ctx, 'containerd'))
    add('CRI', 'container runtime is not running: output: time="2026-11-18T09:00:00Z" level=fatal msg="validate service connection: validate CRI v1 runtime API for endpoint \\"unix:///var/run/containerd/containerd.sock\\": rpc error: code = Unavailable desc = connection error: desc = \\"transport: Error while dialing: dial unix /var/run/containerd/containerd.sock: connect: no such file or directory\\""\n, error: exit status 1');
  if (!installed(fs, 'kubelet')) add('FileExisting-kubelet', 'kubelet not found in system path');
  if (!swapIsOff(fs.exists('/etc/fstab') ? fs.readFile('/etc/fstab') : '')) add('Swap', 'running with swap on is not supported. Please disable swap');
  const sysctl = [fs.exists('/etc/sysctl.conf') ? fs.readFile('/etc/sysctl.conf') : '', confText(fs, '/etc/sysctl.d')].join('\n');
  if (!ipForwardSet(sysctl)) add('FileContent--proc-sys-net-ipv4-ip_forward', '/proc/sys/net/ipv4/ip_forward contents are not set to 1');
  if (join) {
    if (fs.exists('/etc/kubernetes/kubelet.conf')) add('FileAvailable--etc-kubernetes-kubelet.conf', '/etc/kubernetes/kubelet.conf already exists');
    if (fs.exists('/etc/kubernetes/pki/ca.crt')) add('FileAvailable--etc-kubernetes-pki-ca.crt', '/etc/kubernetes/pki/ca.crt already exists');
    if (fs.exists('/etc/kubernetes/kubelet.conf')) add('Port-10250', 'Port 10250 is in use');
  } else if (fs.exists('/etc/kubernetes/manifests/kube-apiserver.yaml')) {
    add('Port-6443', 'Port 6443 is in use');
    add('Port-10259', 'Port 10259 is in use');
    add('Port-10257', 'Port 10257 is in use');
    for (const f of ['kube-apiserver', 'kube-controller-manager', 'kube-scheduler', 'etcd']) add(`FileAvailable--etc-kubernetes-manifests-${f}.yaml`, `/etc/kubernetes/manifests/${f}.yaml already exists`);
    add('Port-10250', 'Port 10250 is in use');
    add('Port-2379', 'Port 2379 is in use');
    add('DirAvailable--var-lib-etcd', '/var/lib/etcd is not empty');
  }
  return { errors, warnings };
}

function preflightFail(ctx: CmdContext, p: Preflight): number {
  ctx.out('[preflight] Running pre-flight checks\n');
  for (const w of p.warnings) ctx.out(`\t${w}\n`);
  ctx.err(`error execution phase preflight: [preflight] Some fatal errors occurred:\n${p.errors.map((e) => `\t${e}\n`).join('')}[preflight] If you know what you are doing, you can make a check non-fatal with \`--ignore-preflight-errors=...\`\nTo see the stack trace of this error execute with --v=5 or higher\n`);
  return 1;
}

function loadDocs(ctx: CmdContext, path: string): Record<string, unknown>[] | string {
  let text: string;
  try {
    text = ctx.fs.readFile(path);
  } catch {
    return `unable to read config from "${path}" : open ${path}: no such file or directory`;
  }
  try {
    const docs = YAML.parseAllDocuments(text).map((d) => d.toJS() as Record<string, unknown>).filter(Boolean);
    for (const d of docs) {
      const av = String(d.apiVersion ?? '');
      if (!/^kubeadm\.k8s\.io\/v1beta[34]$/.test(av) && !/^kubelet\.config\.k8s\.io\//.test(av) && !/^kubeproxy\.config\.k8s\.io\//.test(av)) return `no kind "${d.kind}" is registered for version "${av}" in scheme "k8s.io/kubernetes/cmd/kubeadm/app/apis/kubeadm/scheme/scheme.go:31"`;
    }
    return docs;
  } catch (e) {
    return `error converting YAML to JSON: yaml: ${(e as Error).message.split('\n')[0]}`;
  }
}

const get = (o: unknown, path: string): unknown => path.split('.').reduce<unknown>((x, k) => (x && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined), o);

// ── kubeadm init ──

function init(ctx: CmdContext, args: string[]): number {
  const ignore = (flag(args, 'ignore-preflight-errors') ?? '').toLowerCase().split(',').filter(Boolean);
  let advertise = flag(args, 'apiserver-advertise-address') ?? hostIp(ctx);
  let podSubnet = flag(args, 'pod-network-cidr') ?? '';
  let version = flag(args, 'kubernetes-version') ?? K8S_VERSION;
  let token = flag(args, 'token');
  let cpEndpoint = flag(args, 'control-plane-endpoint');
  const cfgPath = flag(args, 'config');
  if (cfgPath) {
    const docs = loadDocs(ctx, cfgPath);
    if (typeof docs === 'string') {
      ctx.err(`${docs}\nTo see the stack trace of this error execute with --v=5 or higher\n`);
      return 1;
    }
    const ic = docs.find((d) => d.kind === 'InitConfiguration');
    const cc = docs.find((d) => d.kind === 'ClusterConfiguration');
    if (!ic && !cc) {
      ctx.err(`no InitConfiguration or ClusterConfiguration kind was found in the YAML file\nTo see the stack trace of this error execute with --v=5 or higher\n`);
      return 1;
    }
    advertise = String(get(ic, 'localAPIEndpoint.advertiseAddress') ?? advertise);
    const tok = get(ic, 'bootstrapTokens') as { token?: string }[] | undefined;
    if (tok?.[0]?.token) token = String(tok[0].token);
    podSubnet = String(get(cc, 'networking.podSubnet') ?? podSubnet);
    if (get(cc, 'kubernetesVersion')) version = String(get(cc, 'kubernetesVersion')).replace(/^(\d)/, 'v$1');
    if (get(cc, 'controlPlaneEndpoint')) cpEndpoint = String(get(cc, 'controlPlaneEndpoint'));
  }
  if (token !== undefined && !TOKEN_RE.test(token)) {
    ctx.err(`bootstrapTokens[0].token: Invalid value: "${token}": the bootstrap token is invalid\nTo see the stack trace of this error execute with --v=5 or higher\n`);
    return 1;
  }
  ctx.out(`[init] Using Kubernetes version: ${version}\n`);
  const p = preflight(ctx, ignore, false);
  if (p.errors.length) return preflightFail(ctx, p);
  const st = stdb();
  const name = ctx.machine.hostname;
  const swapOn = !swapIsOff(ctx.fs.exists('/etc/fstab') ? ctx.fs.readFile('/etc/fstab') : '');
  ctx.out('[preflight] Running pre-flight checks\n');
  for (const w of p.warnings) ctx.out(`\t${w}\n`);
  ctx.out(`[preflight] Pulling images required for setting up a Kubernetes cluster\n[preflight] This might take a minute or two, depending on the speed of your internet connection\n[preflight] You can also perform this action beforehand using 'kubeadm config images pull'\n`);
  const now = standNow(currentStand());
  const endpoint = `${cpEndpoint ?? advertise}${(cpEndpoint ?? advertise).includes(':') ? '' : ':6443'}`;
  const db: ClusterDb = {
    cp: name,
    endpoint,
    caHash: newCaHash(`${name}${advertise}${now}`),
    version,
    podSubnet: podSubnet || '10.244.0.0/16',
    initAt: now,
    tokens: [{ token: token ?? tokenString(`${name}${now}`), expires: now + 24 * 3_600_000, description: "The default bootstrap token generated by 'kubeadm init'." }],
    members: {},
    cni: null,
  };
  ctx.out(`[certs] Using certificateDir folder "/etc/kubernetes/pki"\n[certs] Generating "ca" certificate and key\n[certs] Generating "apiserver" certificate and key\n[certs] apiserver serving cert is signed for DNS names [${name} kubernetes kubernetes.default kubernetes.default.svc kubernetes.default.svc.cluster.local] and IPs [10.96.0.1 ${advertise}]\n[certs] Generating "apiserver-kubelet-client" certificate and key\n[certs] Generating "front-proxy-ca" certificate and key\n[certs] Generating "front-proxy-client" certificate and key\n[certs] Generating "etcd/ca" certificate and key\n[certs] Generating "etcd/server" certificate and key\n[certs] Generating "etcd/peer" certificate and key\n[certs] Generating "etcd/healthcheck-client" certificate and key\n[certs] Generating "apiserver-etcd-client" certificate and key\n[certs] Generating "sa" key and public key\n[kubeconfig] Using kubeconfig folder "/etc/kubernetes"\n[kubeconfig] Writing "admin.conf" kubeconfig file\n[kubeconfig] Writing "super-admin.conf" kubeconfig file\n[kubeconfig] Writing "kubelet.conf" kubeconfig file\n[kubeconfig] Writing "controller-manager.conf" kubeconfig file\n[kubeconfig] Writing "scheduler.conf" kubeconfig file\n[etcd] Creating static Pod manifest for local etcd in "/etc/kubernetes/manifests"\n[control-plane] Using manifest folder "/etc/kubernetes/manifests"\n[control-plane] Creating static Pod manifest for "kube-apiserver"\n[control-plane] Creating static Pod manifest for "kube-controller-manager"\n[control-plane] Creating static Pod manifest for "kube-scheduler"\n[kubelet-start] Writing kubelet environment file with flags to file "/var/lib/kubelet/kubeadm-flags.env"\n[kubelet-start] Writing kubelet configuration to file "/var/lib/kubelet/config.yaml"\n[kubelet-start] Starting the kubelet\n[wait-control-plane] Waiting for the kubelet to boot up the control plane as static Pods from directory "/etc/kubernetes/manifests"\n[kubelet-check] Waiting for a healthy kubelet at http://127.0.0.1:10248/healthz. This can take up to 4m0s\n`);
  for (const [path, text] of Object.entries(initFiles(name, advertise, db))) {
    const dir = path.slice(0, path.lastIndexOf('/'));
    if (!ctx.fs.exists(dir)) ctx.fs.mkdir(dir, { parents: true });
    ctx.fs.writeFile(path, text);
  }
  if (swapOn || !serviceRunning(ctx, 'kubelet')) {
    ctx.out(`[kubelet-check] The kubelet is not healthy after 4m0.000870211s\n\nUnfortunately, an error has occurred, likely caused by:\n\t- The kubelet is not running\n\t- The kubelet is unhealthy due to a misconfiguration of the node in some way (required cgroups disabled)\n\nIf you are on a systemd-powered system, you can try to troubleshoot the error with the following commands:\n\t- 'systemctl status kubelet'\n\t- 'journalctl -xeu kubelet'\n\n`);
    ctx.err(`error execution phase wait-control-plane: failed while waiting for the kubelet to start: The HTTP call equal to 'curl -sSL http://127.0.0.1:10248/healthz' returned error: Get "http://127.0.0.1:10248/healthz": context deadline exceeded\nTo see the stack trace of this error execute with --v=5 or higher\n`);
    return 1;
  }
  db.members[name] = { role: 'control-plane', ip: advertise, version, joinedAt: now };
  if (st) writeCluster(st.fs, db);
  ctx.out(`[kubelet-check] The kubelet is healthy after 501.231ms\n[control-plane-check] Waiting for healthy control plane components. This can take up to 4m0s\n[control-plane-check] Checking kube-apiserver at https://${advertise}:6443/livez\n[control-plane-check] Checking kube-controller-manager at https://127.0.0.1:10257/healthz\n[control-plane-check] Checking kube-scheduler at https://127.0.0.1:10259/livez\n[control-plane-check] kube-controller-manager is healthy after 1.804s\n[control-plane-check] kube-scheduler is healthy after 2.398s\n[control-plane-check] kube-apiserver is healthy after 3.502s\n[upload-config] Storing the configuration used in ConfigMap "kubeadm-config" in the "kube-system" Namespace\n[kubelet] Creating a ConfigMap "kubelet-config" in namespace kube-system with the configuration for the kubelets in the cluster\n[upload-certs] Skipping phase. Please see --upload-certs\n[mark-control-plane] Marking the node ${name} as control-plane by adding the labels: [node-role.kubernetes.io/control-plane node.kubernetes.io/exclude-from-external-load-balancers]\n[mark-control-plane] Marking the node ${name} as control-plane by adding the taints [node-role.kubernetes.io/control-plane:NoSchedule]\n[bootstrap-token] Using token: ${db.tokens[0].token}\n[bootstrap-token] Configuring bootstrap tokens, cluster-info ConfigMap, RBAC Roles\n[bootstrap-token] Configured RBAC rules to allow Node Bootstrap tokens to get nodes\n[bootstrap-token] Configured RBAC rules to allow Node Bootstrap tokens to post CSRs in order for nodes to get long term certificate credentials\n[bootstrap-token] Configured RBAC rules to allow the csrapprover controller automatically approve CSRs from a Node Bootstrap Token\n[bootstrap-token] Configured RBAC rules to allow certificate rotation for all node client certificates in the cluster\n[bootstrap-token] Creating the "cluster-info" ConfigMap in the "kube-public" namespace\n[kubelet-finalize] Updating "/etc/kubernetes/kubelet.conf" to point to a rotatable kubelet client certificate and key\n[addons] Applied essential addon: CoreDNS\n[addons] Applied essential addon: kube-proxy\n\nYour Kubernetes control-plane has initialized successfully!\n\nTo start using your cluster, you need to run the following as a regular user:\n\n  mkdir -p $HOME/.kube\n  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config\n  sudo chown $(id -u):$(id -g) $HOME/.kube/config\n\nAlternatively, if you are the root user, you can run:\n\n  export KUBECONFIG=/etc/kubernetes/admin.conf\n\nYou should now deploy a pod network to the cluster.\nRun "kubectl apply -f [podnetwork].yaml" with one of the options listed at:\n  https://kubernetes.io/docs/concepts/cluster-administration/addons/\n\nThen you can join any number of worker nodes by running the following on each as root:\n\n${joinCommand(db, db.tokens[0].token, true)}\n`);
  return 0;
}

function joinCommand(db: ClusterDb, token: string, wrap = false): string {
  return `kubeadm join ${db.endpoint} --token ${token}${wrap ? ' \\\n\t' : ' '}--discovery-token-ca-cert-hash ${db.caHash}`;
}

// ── kubeadm join ──

function join(ctx: CmdContext, args: string[]): number {
  const ignore = (flag(args, 'ignore-preflight-errors') ?? '').toLowerCase().split(',').filter(Boolean);
  const VALUED = ['--token', '--discovery-token', '--discovery-token-ca-cert-hash', '--config', '--ignore-preflight-errors', '--node-name', '--tls-bootstrap-token', '--cri-socket'];
  let endpoint = args.find((a, i) => !a.startsWith('-') && !VALUED.includes(args[i - 1] ?? '')) ?? '';
  let token = flag(args, 'token') ?? flag(args, 'discovery-token');
  let hashes = args.flatMap((a, i) => (a === '--discovery-token-ca-cert-hash' ? [args[i + 1]] : a.startsWith('--discovery-token-ca-cert-hash=') ? [a.split('=')[1]] : []));
  let unsafe = has(args, 'discovery-token-unsafe-skip-ca-verification');
  const cfgPath = flag(args, 'config');
  if (cfgPath) {
    const docs = loadDocs(ctx, cfgPath);
    if (typeof docs === 'string') {
      ctx.err(`${docs}\nTo see the stack trace of this error execute with --v=5 or higher\n`);
      return 1;
    }
    const jc = docs.find((d) => d.kind === 'JoinConfiguration');
    if (!jc) {
      ctx.err(`no JoinConfiguration kind was found in the YAML file\nTo see the stack trace of this error execute with --v=5 or higher\n`);
      return 1;
    }
    endpoint = String(get(jc, 'discovery.bootstrapToken.apiServerEndpoint') ?? '');
    token = (get(jc, 'discovery.bootstrapToken.token') as string | undefined) ?? (get(jc, 'discovery.tlsBootstrapToken') as string | undefined);
    hashes = ((get(jc, 'discovery.bootstrapToken.caCertHashes') as string[] | undefined) ?? []).map(String);
    unsafe = get(jc, 'discovery.bootstrapToken.unsafeSkipCAVerification') === true;
  }
  if (!endpoint || !token) {
    ctx.err('discovery: Invalid value: "": bootstrapToken or file must be set\nTo see the stack trace of this error execute with --v=5 or higher\n');
    return 1;
  }
  if (!TOKEN_RE.test(token)) {
    ctx.err(`discovery.bootstrapToken.token: Invalid value: "${token}": the bootstrap token is invalid\nTo see the stack trace of this error execute with --v=5 or higher\n`);
    return 1;
  }
  if (!hashes.length && !unsafe) {
    ctx.err('discovery.bootstrapToken: Invalid value: "": using token-based discovery without caCertHashes can be unsafe. Set unsafeSkipCAVerification as true in your kubeadm config file or pass --discovery-token-unsafe-skip-ca-verification flag to continue\nTo see the stack trace of this error execute with --v=5 or higher\n');
    return 1;
  }
  const p = preflight(ctx, ignore, true);
  if (p.errors.length) return preflightFail(ctx, p);
  ctx.out('[preflight] Running pre-flight checks\n');
  for (const w of p.warnings) ctx.out(`\t${w}\n`);
  const st = stdb();
  const ep = endpoint.includes(':') ? endpoint : `${endpoint}:6443`;
  const fail = (msg: string) => {
    ctx.err(`error execution phase preflight: couldn't validate the identity of the API Server: ${msg}\nTo see the stack trace of this error execute with --v=5 or higher\n`);
    return 1;
  };
  let db = st?.db ?? null;
  if (st) {
    if (!db || db.endpoint !== ep) return fail(`failed to request the cluster-info ConfigMap: Get "https://${ep}/api/v1/namespaces/kube-public/configmaps/cluster-info?timeout=10s": dial tcp ${ep}: connect: connection refused`);
    const now = standNow(currentStand());
    const t = db.tokens.find((x) => x.token === token);
    if (!t || t.expires <= now) return fail(`could not find a JWS signature in the cluster-info ConfigMap for token ID "${token.split('.')[0]}"`);
    if (!unsafe && !hashes.includes(db.caHash)) return fail(`cluster CA found in cluster-info ConfigMap is invalid: none of the public keys "${db.caHash}" are pinned`);
  } else {
    db = { cp: 'cp-1', endpoint: ep, caHash: hashes[0] ?? newCaHash(ep), version: K8S_VERSION, podSubnet: '10.244.0.0/16', initAt: 0, tokens: [], members: {}, cni: null };
  }
  ctx.out('[preflight] Reading configuration from the "kubeadm-config" ConfigMap in namespace "kube-system"...\n[preflight] Use \'kubeadm init phase upload-config kubeadm --config your-config-file\' to re-upload it.\n[kubelet-start] Writing kubelet configuration to file "/var/lib/kubelet/config.yaml"\n[kubelet-start] Writing kubelet environment file with flags to file "/var/lib/kubelet/kubeadm-flags.env"\n[kubelet-start] Starting the kubelet\n[kubelet-check] Waiting for a healthy kubelet at http://127.0.0.1:10248/healthz. This can take up to 4m0s\n');
  for (const [path, text] of Object.entries(joinFiles(db))) {
    const dir = path.slice(0, path.lastIndexOf('/'));
    if (!ctx.fs.exists(dir)) ctx.fs.mkdir(dir, { parents: true });
    ctx.fs.writeFile(path, text);
  }
  const swapOn = !swapIsOff(ctx.fs.exists('/etc/fstab') ? ctx.fs.readFile('/etc/fstab') : '');
  if (swapOn || !serviceRunning(ctx, 'kubelet')) {
    ctx.out('[kubelet-check] The kubelet is not healthy after 4m0.001s\n');
    ctx.err('error execution phase kubelet-wait-bootstrap: The HTTP call equal to \'curl -sSL http://127.0.0.1:10248/healthz\' returned error: Get "http://127.0.0.1:10248/healthz": context deadline exceeded\nTo see the stack trace of this error execute with --v=5 or higher\n');
    return 1;
  }
  if (st && db) {
    db.members[ctx.machine.hostname] = { role: 'worker', ip: hostIp(ctx), version: db.version, joinedAt: standNow(currentStand()) };
    writeCluster(st.fs, db);
  }
  ctx.out('[kubelet-check] The kubelet is healthy after 1.002s\n[kubelet-start] Waiting for the kubelet to perform the TLS Bootstrap\n\nThis node has joined the cluster:\n* Certificate signing request was sent to apiserver and a response was received.\n* The Kubelet was informed of the new secure connection details.\n\nRun \'kubectl get nodes\' on the control-plane to see this node join the cluster.\n\n');
  return 0;
}

// ── tokens, certs, upgrade, reset, config ──

function onControlPlane(ctx: CmdContext): boolean {
  if (ctx.fs.exists('/etc/kubernetes/admin.conf')) return true;
  ctx.err('failed to load admin kubeconfig: open /etc/kubernetes/admin.conf: no such file or directory\nTo see the stack trace of this error execute with --v=5 or higher\n');
  return false;
}

function token(ctx: CmdContext, args: string[]): number {
  const sub = args[0];
  const st = stdb();
  const now = standNow(currentStand());
  if (sub === 'create') {
    if (!onControlPlane(ctx)) return 1;
    const given = args.slice(1).find((a, i, arr) => !a.startsWith('-') && !['--ttl', '--description', '--usages', '--groups'].includes(arr[i - 1] ?? ''));
    if (given && !TOKEN_RE.test(given)) {
      ctx.err(`the bootstrap token "${given}" was not of the form "[a-z0-9]{6}.[a-z0-9]{16}"\n`);
      return 1;
    }
    const tok = given ?? tokenString(`${ctx.machine.hostname}${now}${st?.db?.tokens.length ?? 0}`);
    const ttl = parseTtl(flag(args, 'ttl') ?? '24h');
    if (st?.db) {
      st.db.tokens.push({ token: tok, expires: ttl >= NEVER ? NEVER : now + ttl, description: flag(args, 'description') });
      writeCluster(st.fs, st.db);
    }
    if (has(args, 'print-join-command') && st?.db) ctx.out(`${joinCommand(st.db, tok)} \n`);
    else ctx.out(`${tok}\n`);
    return 0;
  }
  if (sub === 'list') {
    if (!onControlPlane(ctx)) return 1;
    const rows = (st?.db?.tokens ?? []).filter((t) => t.expires > now);
    ctx.out('TOKEN                     TTL         EXPIRES                USAGES                   DESCRIPTION                                                EXTRA GROUPS\n');
    for (const t of rows) {
      const left = t.expires >= NEVER ? '<forever>' : `${Math.max(1, Math.round((t.expires - now) / 3_600_000))}h`;
      const exp = t.expires >= NEVER ? '<never>' : new Date(t.expires).toISOString().replace(/\.\d+Z$/, 'Z');
      ctx.out(`${t.token.padEnd(26)}${left.padEnd(12)}${exp.padEnd(23)}authentication,signing   ${(t.description ?? '<none>').padEnd(59)}system:bootstrappers:kubeadm:default-node-token\n`);
    }
    return 0;
  }
  if (sub === 'delete') {
    if (!onControlPlane(ctx)) return 1;
    const id = args[1] ?? '';
    if (st?.db) {
      st.db.tokens = st.db.tokens.filter((t) => t.token !== id && t.token.split('.')[0] !== id);
      writeCluster(st.fs, st.db);
    }
    ctx.out(`bootstrap token "${id.split('.')[0]}" deleted\n`);
    return 0;
  }
  if (sub === 'generate') {
    ctx.out(`${tokenString(`gen${now}`)}\n`);
    return 0;
  }
  ctx.out(HELP['token']);
  return sub ? 1 : 0;
}

function certs(ctx: CmdContext, args: string[]): number {
  if (args[0] !== 'check-expiration') {
    ctx.out(HELP['certs']);
    return args[0] ? 1 : 0;
  }
  if (!ctx.fs.exists('/etc/kubernetes/pki/ca.crt') || !ctx.fs.exists('/etc/kubernetes/admin.conf')) {
    ctx.err('[check-expiration] Error reading configuration from the Cluster. Falling back to default configuration\n');
    ctx.out('\nCERTIFICATE   EXPIRES   RESIDUAL TIME   CERTIFICATE AUTHORITY   EXTERNALLY MANAGED\n\nCERTIFICATE AUTHORITY   EXPIRES   RESIDUAL TIME   EXTERNALLY MANAGED\n');
    return 0;
  }
  const st = stdb();
  const now = standNow(currentStand());
  const at = st?.db?.initAt ?? now;
  const leaf = at + 365 * 86_400_000;
  const ca = at + 3650 * 86_400_000;
  const days = (t: number) => `${Math.floor((t - now) / 86_400_000)}d`;
  const years = (t: number) => `${Math.floor((t - now) / (365 * 86_400_000))}y`;
  ctx.out('[check-expiration] Reading configuration from the "kubeadm-config" ConfigMap in namespace "kube-system"...\n[check-expiration] Use \'kubeadm init phase upload-config kubeadm --config your-config-file\' to re-upload it.\n\n');
  ctx.out('CERTIFICATE                EXPIRES                  RESIDUAL TIME   CERTIFICATE AUTHORITY   EXTERNALLY MANAGED\n');
  for (const [c, a] of [['admin.conf', 'ca'], ['apiserver', 'ca'], ['apiserver-etcd-client', 'etcd-ca'], ['apiserver-kubelet-client', 'ca'], ['controller-manager.conf', 'ca'], ['etcd-healthcheck-client', 'etcd-ca'], ['etcd-peer', 'etcd-ca'], ['etcd-server', 'etcd-ca'], ['front-proxy-client', 'front-proxy-ca'], ['scheduler.conf', 'ca'], ['super-admin.conf', 'ca']])
    ctx.out(`${c.padEnd(27)}${fmtDate(leaf).padEnd(25)}${days(leaf).padEnd(16)}${a.padEnd(24)}no\n`);
  ctx.out('\nCERTIFICATE AUTHORITY   EXPIRES                  RESIDUAL TIME   EXTERNALLY MANAGED\n');
  for (const c of ['ca', 'etcd-ca', 'front-proxy-ca']) ctx.out(`${c.padEnd(24)}${fmtDate(ca).padEnd(25)}${years(ca).padEnd(16)}no\n`);
  return 0;
}

function upgrade(ctx: CmdContext, args: string[]): number {
  if (args[0] !== 'plan') {
    ctx.out(HELP['upgrade']);
    return args[0] ? 1 : 0;
  }
  if (!onControlPlane(ctx)) return 1;
  const db = stdb()?.db;
  const cur = db?.version ?? K8S_VERSION;
  const members = Object.entries(db?.members ?? {});
  const cp = db?.cp ?? ctx.machine.hostname;
  ctx.out(`[preflight] Running pre-flight checks.\n[upgrade/config] Reading configuration from the "kubeadm-config" ConfigMap in namespace "kube-system"...\n[upgrade/config] Use 'kubeadm init phase upload-config kubeadm --config your-config-file' to re-upload it.\n[upgrade] Running cluster health checks\n[upgrade] Fetching available versions to upgrade to\n[upgrade/versions] Cluster version: ${cur.replace(/^v/, '')}\n[upgrade/versions] kubeadm version: ${K8S_VERSION}\n[upgrade/versions] Target version: ${K8S_NEXT}\n[upgrade/versions] Latest version in the ${cur.split('.').slice(0, 2).join('.')} series: ${cur}\n\nComponents that must be upgraded manually after you have upgraded the control plane with 'kubeadm upgrade apply':\nCOMPONENT   NODE       CURRENT   TARGET\n`);
  for (const [n, m] of members) ctx.out(`kubelet     ${n.padEnd(11)}${m.version.padEnd(10)}${K8S_NEXT}\n`);
  ctx.out('\nUpgrade to the latest stable version:\n\nCOMPONENT                 NODE       CURRENT    TARGET\n');
  for (const c of ['kube-apiserver', 'kube-controller-manager', 'kube-scheduler', 'kube-proxy', 'CoreDNS', 'etcd']) {
    const [from, to] = c === 'CoreDNS' ? ['v1.12.1', 'v1.12.3'] : c === 'etcd' ? ['3.6.5-0', '3.6.6-0'] : [cur, K8S_NEXT];
    ctx.out(`${c.padEnd(26)}${(c === 'kube-proxy' || c === 'CoreDNS' ? '' : cp).padEnd(11)}${from.padEnd(11)}${to}\n`);
  }
  ctx.out(`\nYou can now apply the upgrade by executing the following command:\n\n\tkubeadm upgrade apply ${K8S_NEXT}\n\nNote: Before you can perform this upgrade, you have to update kubeadm to ${K8S_NEXT}.\n\n_____________________________________________________________________\n`);
  return 0;
}

function reset(ctx: CmdContext, args: string[]): number {
  if (!has(args, 'force') && !args.includes('-f')) {
    ctx.err('[reset] Are you sure you want to proceed? [y/N]: \nerror execution phase preflight: won\'t proceed; the user didn\'t answer (Y|y) in order to continue\n');
    return 1;
  }
  const wipe = (p: string) => {
    if (!ctx.fs.exists(p)) return;
    const st = ctx.fs.lstat(p);
    if (st?.type === 'd') {
      for (const e of ctx.fs.readdir(p)) wipe(`${p}/${e}`);
      ctx.fs.rmdir(p);
    } else ctx.fs.unlink(p);
  };
  for (const p of ['/etc/kubernetes/manifests', '/etc/kubernetes/pki']) wipe(p);
  for (const f of ['admin.conf', 'super-admin.conf', 'kubelet.conf', 'bootstrap-kubelet.conf', 'controller-manager.conf', 'scheduler.conf']) wipe(`/etc/kubernetes/${f}`);
  if (!ctx.fs.exists('/etc/kubernetes/manifests')) ctx.fs.mkdir('/etc/kubernetes/manifests', { parents: true });
  const st = stdb();
  const name = ctx.machine.hostname;
  if (st?.db) {
    if (st.db.cp === name) writeCluster(st.fs, null);
    else {
      delete st.db.members[name];
      writeCluster(st.fs, st.db);
    }
  }
  ctx.out(`[preflight] Running pre-flight checks\n[reset] Deleted contents of the etcd data directory: /var/lib/etcd\n[reset] Stopping the kubelet service\n[reset] Unmounting mounted directories in "/var/lib/kubelet"\n[reset] Deleting contents of directories: [/etc/kubernetes/manifests /var/lib/kubelet /etc/kubernetes/pki]\n[reset] Deleting files: [/etc/kubernetes/admin.conf /etc/kubernetes/super-admin.conf /etc/kubernetes/kubelet.conf /etc/kubernetes/bootstrap-kubelet.conf /etc/kubernetes/controller-manager.conf /etc/kubernetes/scheduler.conf]\n\nThe reset process does not perform cleanup of CNI plugin configuration,\nnetwork filtering rules and kubeconfig files.\n`);
  return 0;
}

const INIT_DEFAULTS = `apiVersion: kubeadm.k8s.io/v1beta4
bootstrapTokens:
- groups:
  - system:bootstrappers:kubeadm:default-node-token
  token: abcdef.0123456789abcdef
  ttl: 24h0m0s
  usages:
  - signing
  - authentication
kind: InitConfiguration
localAPIEndpoint:
  advertiseAddress: 1.2.3.4
  bindPort: 6443
nodeRegistration:
  criSocket: unix:///var/run/containerd/containerd.sock
  imagePullPolicy: IfNotPresent
  imagePullSerial: true
  name: node
  taints: null
timeouts:
  controlPlaneComponentHealthCheck: 4m0s
  discovery: 5m0s
  etcdAPICall: 2m0s
  kubeletHealthCheck: 4m0s
  kubernetesAPICall: 1m0s
  tlsBootstrap: 5m0s
  upgradeManifests: 5m0s
---
apiServer: {}
apiVersion: kubeadm.k8s.io/v1beta4
caCertificateValidityPeriod: 87600h0m0s
certificateValidityPeriod: 8760h0m0s
certificatesDir: /etc/kubernetes/pki
clusterName: kubernetes
controllerManager: {}
dns: {}
encryptionAlgorithm: RSA-2048
etcd:
  local:
    dataDir: /var/lib/etcd
imageRepository: registry.k8s.io
kind: ClusterConfiguration
kubernetesVersion: 1.36.0
networking:
  dnsDomain: cluster.local
  serviceSubnet: 10.96.0.0/12
proxy: {}
scheduler: {}
`;

const JOIN_DEFAULTS = `apiVersion: kubeadm.k8s.io/v1beta4
caCertPath: /etc/kubernetes/pki/ca.crt
discovery:
  bootstrapToken:
    apiServerEndpoint: kube-apiserver:6443
    token: abcdef.0123456789abcdef
    unsafeSkipCAVerification: true
  tlsBootstrapToken: abcdef.0123456789abcdef
kind: JoinConfiguration
nodeRegistration:
  criSocket: unix:///var/run/containerd/containerd.sock
  imagePullPolicy: IfNotPresent
  imagePullSerial: true
  name: node
  taints: null
timeouts:
  controlPlaneComponentHealthCheck: 4m0s
  discovery: 5m0s
  etcdAPICall: 2m0s
  kubeletHealthCheck: 4m0s
  kubernetesAPICall: 1m0s
  tlsBootstrap: 5m0s
  upgradeManifests: 5m0s
`;

function config(ctx: CmdContext, args: string[]): number {
  if (args[0] === 'print' && args[1] === 'init-defaults') {
    ctx.out(INIT_DEFAULTS);
    return 0;
  }
  if (args[0] === 'print' && args[1] === 'join-defaults') {
    ctx.out(JOIN_DEFAULTS);
    return 0;
  }
  ctx.out(HELP['config']);
  return args[0] ? 1 : 0;
}

// ── help texts (corpus pages help/kubeadm-<sub>) ──

export const HELP: Record<string, string> = {
  '': `

    ┌──────────────────────────────────────────────────────────┐
    │ KUBEADM                                                  │
    │ Easily bootstrap a secure Kubernetes cluster             │
    └──────────────────────────────────────────────────────────┘

Example usage:

    Create a two-machine cluster with one control-plane node
    (which controls the cluster), and one worker node
    (where your workloads, like Pods and Deployments run).

    ┌──────────────────────────────────────────────────────────┐
    │ On the first machine:                                    │
    ├──────────────────────────────────────────────────────────┤
    │ control-plane# kubeadm init                              │
    └──────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────────┐
    │ On the second machine:                                   │
    ├──────────────────────────────────────────────────────────┤
    │ worker# kubeadm join <arguments-returned-from-init>      │
    └──────────────────────────────────────────────────────────┘

    You can then repeat the second step on as many other machines as you like.

Usage:
  kubeadm [command]

Available Commands:
  certs       Commands related to handling kubernetes certificates
  config      Manage configuration for a kubeadm cluster persisted in a ConfigMap in the cluster
  init        Run this command in order to set up the Kubernetes control plane
  join        Run this on any machine you wish to join an existing cluster
  reset       Performs a best effort revert of changes made to this host by 'kubeadm init' or 'kubeadm join'
  token       Manage bootstrap tokens
  upgrade     Upgrade your cluster smoothly to a newer version with this command
  version     Print the version of kubeadm

Flags:
  -h, --help   help for kubeadm

Use "kubeadm [command] --help" for more information about a command.
`,
  init: `Run this command in order to set up the Kubernetes control plane

The "init" command executes the following phases:
preflight                    Run pre-flight checks
certs                        Certificate generation
kubeconfig                   Generate all kubeconfig files necessary to establish the control plane and the admin kubeconfig file
etcd                         Generate static Pod manifest file for local etcd
control-plane                Generate all static Pod manifest files necessary to establish the control plane
kubelet-start                Write kubelet settings and (re)start the kubelet
wait-control-plane           Wait for the control plane to start
upload-config                Upload the kubeadm and kubelet configuration to a ConfigMap
mark-control-plane           Mark a node as a control-plane
bootstrap-token              Generates bootstrap tokens used to join a node to a cluster
kubelet-finalize             Updates settings relevant to the kubelet after TLS bootstrap
addon                        Install required addons for passing conformance tests

Usage:
  kubeadm init [flags]

Options:
      --apiserver-advertise-address string   The IP address the API Server will advertise it's listening on. If not set the default network interface will be used.
      --config string                        Path to a kubeadm configuration file.
      --control-plane-endpoint string        Specify a stable IP address or DNS name for the control plane.
      --ignore-preflight-errors strings      A list of checks whose errors will be shown as warnings. Example: 'IsPrivilegedUser,Swap'. Value 'all' ignores errors from all checks.
      --kubernetes-version string            Choose a specific Kubernetes version for the control plane. (default "stable-1")
      --pod-network-cidr string              Specify range of IP addresses for the pod network. If set, the control plane will automatically allocate CIDRs for every node.
      --skip-phases strings                  List of phases to be skipped
      --token string                         The token to use for establishing bidirectional trust between nodes and control-plane nodes. The format is [a-z0-9]{6}\\.[a-z0-9]{16} - e.g. abcdef.0123456789abcdef
      --token-ttl duration                   The duration before the token is automatically deleted (e.g. 1s, 2m, 3h). If set to '0', the token will never expire (default 24h0m0s)
  -h, --help                                 help for init
`,
  join: `When joining a kubeadm initialized cluster, we need to establish
bidirectional trust. This is split into discovery (having the Node
trust the Kubernetes Control Plane) and TLS bootstrap (having the
Kubernetes Control Plane trust the Node).

There are 2 main schemes for discovery. The first is to use a shared
token along with the IP address of the API server. The second is to
provide a file - a subset of the standard kubeconfig file.

If you use a shared token for discovery, you should also pass the
--discovery-token-ca-cert-hash flag to validate the public key of the
root certificate authority (CA) presented by the Kubernetes Control Plane.
The value of this flag is specified as "<hash-type>:<hex-encoded-value>",
where the supported hash type is "sha256".

The "join [api-server-endpoint]" command executes the following phases:
preflight              Run join pre-flight checks
control-plane-prepare  Prepare the machine for serving a control plane
kubelet-start          Write kubelet settings, certificates and (re)start the kubelet
control-plane-join     Join a machine as a control plane instance
wait-control-plane     Wait for the control plane to start

Usage:
  kubeadm join [api-server-endpoint] [flags]

Options:
      --config string                                   Path to a kubeadm configuration file.
      --discovery-token string                          For token-based discovery, the token used to validate cluster information fetched from the API server.
      --discovery-token-ca-cert-hash strings            For token-based discovery, validate that the root CA public key matches this hash (format: "<type>:<value>").
      --discovery-token-unsafe-skip-ca-verification     For token-based discovery, allow joining without --discovery-token-ca-cert-hash pinning.
      --ignore-preflight-errors strings                 A list of checks whose errors will be shown as warnings. Example: 'IsPrivilegedUser,Swap'. Value 'all' ignores errors from all checks.
      --node-name string                                Specify the node name.
      --token string                                    Use this token for both discovery-token and tls-bootstrap-token when those values are not provided.
  -h, --help                                            help for join
`,
  token: `This command manages bootstrap tokens. It is optional and needed only for advanced use cases.

In short, bootstrap tokens are used for establishing bidirectional trust between a client and a server.
A bootstrap token can be used when a client (for example a node that is about to join the cluster) needs
to trust the server it is talking to. Then a bootstrap token with the "signing" usage can be used.
bootstrap tokens can also function as a way to allow short-lived authentication to the API Server
(the token serves as a way for the API Server to trust the client), for example for doing the TLS Bootstrap.

What is a bootstrap token more exactly?
 - It is a Secret in the kube-system namespace of type "bootstrap.kubernetes.io/token".
 - A bootstrap token must be of the form "[a-z0-9]{6}.[a-z0-9]{16}". The former part is the public token ID,
   while the latter is the Token Secret and it must be kept private at all circumstances!
 - The name of the Secret must be named "bootstrap-token-(token-id)".

Usage:
  kubeadm token [command]

Available Commands:
  create      Create bootstrap tokens on the server
  delete      Delete bootstrap tokens on the server
  generate    Generate and print a bootstrap token, but do not create it on the server
  list        List bootstrap tokens on the server

Options:
      --print-join-command   Instead of printing only the token, print the full 'kubeadm join' flag needed to join the cluster using the token. (used by "token create")
      --ttl duration         The duration before the token is automatically deleted (e.g. 1s, 2m, 3h). If set to '0', the token will never expire (default 24h0m0s) (used by "token create")
      --description string   A human friendly description of how this token is used. (used by "token create")
  -h, --help                 help for token
`,
  certs: `Commands related to handling kubernetes certificates

Usage:
  kubeadm certs [command]

Available Commands:
  certificate-key  Generate certificate keys
  check-expiration Check certificates expiration for a Kubernetes cluster
  generate-csr     Generate keys and certificate signing requests
  renew            Renew certificates for a Kubernetes cluster

Options:
  -h, --help   help for certs
`,
  upgrade: `Upgrade your cluster smoothly to a newer version with this command

Usage:
  kubeadm upgrade [flags]
  kubeadm upgrade [command]

Available Commands:
  apply       Upgrade your Kubernetes cluster to the specified version
  diff        Show what differences would be applied to existing static pod manifests. See also: kubeadm upgrade apply --dry-run
  node        Upgrade commands for a node in the cluster
  plan        Check which versions are available to upgrade to and validate whether your current cluster is upgradeable.

Options:
  -h, --help   help for upgrade
`,
  config: `There is a ConfigMap in the kube-system namespace called "kubeadm-config" that kubeadm uses to store internal configuration about the
cluster. kubeadm CLI v1.8.0+ automatically creates this ConfigMap with the config used with 'kubeadm init'.

Usage:
  kubeadm config [flags]
  kubeadm config [command]

Available Commands:
  images      Interact with container images used by kubeadm
  migrate     Read an older version of the kubeadm configuration API types from a file, and output the similar config object for the newer version
  print       Print configuration
  validate    Read a file containing the kubeadm configuration API and report any validation problems

Examples:
  kubeadm config print init-defaults     print the default InitConfiguration and ClusterConfiguration
  kubeadm config print join-defaults     print the default JoinConfiguration

Options:
  -h, --help   help for config
`,
  reset: `Performs a best effort revert of changes made to this host by 'kubeadm init' or 'kubeadm join'

Usage:
  kubeadm reset [flags]

Options:
  -f, --force   Reset the node without prompting for confirmation.
  -h, --help    help for reset
`,
};

const HELP_URL: Record<string, string> = {
  '': 'https://kubernetes.io/docs/reference/setup-tools/kubeadm/',
  init: 'https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-init/',
  join: 'https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-join/',
  token: 'https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-token/',
  certs: 'https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-certs/',
  upgrade: 'https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-upgrade/',
  config: 'https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-config/',
  reset: 'https://kubernetes.io/docs/reference/setup-tools/kubeadm/kubeadm-reset/',
};

/** Corpus pages help/kubeadm-<sub>, built like the kubectl ones: Usage, Options, Examples become sections. */
export function kubeadmHelpPages(): DocPage[] {
  return Object.entries(HELP)
    .filter(([k]) => k)
    .map(([cmd, text]) => {
      const sections: { id: string; title: string; body: string }[] = [];
      let cur = { id: 'DESCRIPTION', title: 'Description', lines: [] as string[] };
      for (const line of text.replace(/\n$/, '').split('\n')) {
        const m = /^(Examples|Options|Usage|Available Commands):\s*$/.exec(line);
        if (m) {
          if (cur.lines.join('').trim()) sections.push({ id: cur.id, title: cur.title, body: cur.lines.join('\n').replace(/\n+$/, '') });
          cur = { id: m[1] === 'Available Commands' ? 'AVAILABLE COMMANDS' : m[1].toUpperCase(), title: m[1], lines: [] };
        } else cur.lines.push(line);
      }
      if (cur.lines.join('').trim()) sections.push({ id: cur.id, title: cur.title, body: cur.lines.join('\n').replace(/\n+$/, '') });
      return { id: `help/kubeadm-${cmd}`, source: 'help', title: `kubeadm ${cmd} --help`, url: HELP_URL[cmd], version: K8S_VERSION, license: 'Apache-2.0 (kubeadm help text)', sections };
    });
}

export const kubeadmCommand: ShellCommand = {
  name: 'kubeadm',
  summary: bi('kubeadm: поднять control plane, присоединить узел, токены, сертификаты, обновление', 'kubeadm: bring up a control plane, join a node, tokens, certificates, upgrades'),
  help: HELP[''],
  handlesHelp: true,
  complete: (args) => (args.length <= 1 ? ['init', 'join', 'token', 'certs', 'upgrade', 'config', 'reset', 'version'] : args[0] === 'token' ? ['create', 'list', 'delete', 'generate'] : args[0] === 'certs' ? ['check-expiration'] : args[0] === 'upgrade' ? ['plan'] : args[0] === 'config' ? ['print'] : []),
  run(ctx) {
    const args = ctx.argv.slice(1);
    const sub = args[0] ?? '';
    if (!installed(ctx.fs, 'kubeadm')) {
      ctx.err(`${ctx.argv[0]}: command not found\n`);
      return 127;
    }
    if (args.includes('--help') || args.includes('-h') || !sub) {
      ctx.out(HELP[sub] ?? HELP['']);
      return 0;
    }
    if (sub === 'version') {
      ctx.out(args.includes('short') || flag(args, 'output') === 'short' || args.includes('-o') ? `${K8S_VERSION}\n` : `kubeadm version: &version.Info{Major:"1", Minor:"36", EmulationMajor:"", EmulationMinor:"", MinCompatibilityMajor:"", MinCompatibilityMinor:"", GitVersion:"${K8S_VERSION}", GitCommit:"5e7c2a1b9f0d4c3e8a6b1d2f7c9e0a4b3d5f6e1c", GitTreeState:"clean", BuildDate:"2026-10-14T10:12:44Z", GoVersion:"go1.25.3", Compiler:"gc", Platform:"linux/amd64"}\n`);
      return 0;
    }
    if (ctx.user.uid !== 0 && ['init', 'join', 'reset'].includes(sub)) {
      ctx.err('[preflight] Running pre-flight checks\nerror execution phase preflight: [preflight] Some fatal errors occurred:\n\t[ERROR IsPrivilegedUser]: user is not running as root\n[preflight] If you know what you are doing, you can make a check non-fatal with `--ignore-preflight-errors=...`\n');
      return 1;
    }
    switch (sub) {
      case 'init':
        return init(ctx, args.slice(1));
      case 'join':
        return join(ctx, args.slice(1));
      case 'token':
        return token(ctx, args.slice(1));
      case 'certs':
        return certs(ctx, args.slice(1));
      case 'upgrade':
        return upgrade(ctx, args.slice(1));
      case 'reset':
        return reset(ctx, args.slice(1));
      case 'config':
        return config(ctx, args.slice(1));
      default:
        ctx.err(`unknown command "${sub}" for "kubeadm"\nTo see the stack trace of this error execute with --v=5 or higher\n`);
        return 1;
    }
  },
};

// ── the cilium CLI ──

const CILIUM_VERSION = '1.18.4';

const CILIUM_HELP = `CLI to install, manage, & troubleshooting Cilium clusters running Kubernetes.

Cilium is a CNI for transparently securing the network connectivity between application services deployed using Linux container management platforms like Docker and Kubernetes.

Examples:
# Install Cilium in current Kubernetes context
cilium install

# Check status of Cilium
cilium status

# Enable the Hubble observability layer
cilium hubble enable

# Perform a connectivity test
cilium connectivity test

Usage:
  cilium [flags]
  cilium [command]

Available Commands:
  install      Install Cilium in a Kubernetes cluster using Helm
  status       Display status
  uninstall    Uninstall Cilium using Helm
  version      Display detailed version information

Options:
      --context string             Kubernetes configuration context
  -n, --namespace string           Namespace Cilium is running in (default "kube-system")
      --version string             Cilium version to install (used by "install")
      --wait                       Wait for status to report success (no errors) (used by "status")
  -h, --help                       help for cilium
`;

export const ciliumCommand: ShellCommand = {
  name: 'cilium',
  summary: bi('cilium CLI: поставить сетевой плагин Cilium и посмотреть его состояние', 'the cilium CLI: install the Cilium network plugin and look at its status'),
  help: CILIUM_HELP,
  handlesHelp: true,
  complete: (args) => (args.length <= 1 ? ['install', 'status', 'uninstall', 'version'] : []),
  run(ctx) {
    const args = ctx.argv.slice(1);
    const sub = args[0] ?? '';
    if (!installed(ctx.fs, 'kubeadm')) {
      ctx.err(`${ctx.argv[0]}: command not found\n`);
      return 127;
    }
    if (!sub || args.includes('--help') || args.includes('-h')) {
      ctx.out(CILIUM_HELP);
      return 0;
    }
    if (sub === 'version') {
      ctx.out(`cilium-cli: v0.18.8 compiled with go1.25.3 on linux/amd64\ncilium image (default): v${CILIUM_VERSION}\n`);
      return 0;
    }
    const cfg = ctx.env.KUBECONFIG ?? `${ctx.env.HOME ?? '/root'}/.kube/config`;
    if (!ctx.fs.exists(cfg)) {
      ctx.err(`Error: Unable to create Kubernetes client: invalid configuration: no configuration has been provided, try setting KUBERNETES_MASTER environment variable\n`);
      return 1;
    }
    const st = stdb();
    const db = st?.db;
    if (!db) {
      ctx.err('Error: Unable to connect to Kubernetes cluster: Get "https://10.0.0.11:6443/version": dial tcp 10.0.0.11:6443: connect: connection refused\n');
      return 1;
    }
    if (sub === 'install') {
      if (db.cni) {
        ctx.err(`Error: Unable to install Cilium: cannot re-use a name that is still in use\n`);
        return 1;
      }
      const v = (flag(args, 'version') ?? CILIUM_VERSION).replace(/^v/, '');
      ctx.out(`ℹ️  Using Cilium version ${v}\n🔮 Auto-detected cluster name: kubernetes\n🔮 Auto-detected kube-proxy has been installed\n`);
      db.cni = { name: 'cilium', version: v, at: standNow(currentStand()) };
      writeCluster(st!.fs, db);
      return 0;
    }
    if (sub === 'uninstall') {
      db.cni = null;
      writeCluster(st!.fs, db);
      ctx.out('🔥 Deleting pods in cilium-test namespace...\n⌛ Uninstalling Cilium\n');
      return 0;
    }
    if (sub === 'status') {
      const stand = currentStand();
      const members = Object.keys(db.members);
      const ready = members.filter((n) => {
        if (!stand || !Host.exists(stand.rootFs, n)) return true;
        const s = new Host(stand.rootFs, n).db().services;
        return s.kubelet?.state === 'started' && s.containerd?.state === 'started';
      });
      if (!db.cni) {
        ctx.out(`    /¯¯\\\n /¯¯\\__/¯¯\\    Cilium:             1 errors\n \\__/¯¯\\__/    Operator:           disabled\n /¯¯\\__/¯¯\\    Envoy DaemonSet:    disabled\n \\__/¯¯\\__/    Hubble Relay:       disabled\n    \\__/       ClusterMesh:        disabled\n\nErrors:                cilium             cilium    daemonsets.apps "cilium" not found\n`);
        return 1;
      }
      const n = members.length;
      const r = ready.length;
      const ok = r === n;
      ctx.out(`    /¯¯\\\n /¯¯\\__/¯¯\\    Cilium:             ${ok ? 'OK' : `${n - r} errors`}\n \\__/¯¯\\__/    Operator:           OK\n /¯¯\\__/¯¯\\    Envoy DaemonSet:    ${ok ? 'OK' : `${n - r} errors`}\n \\__/¯¯\\__/    Hubble Relay:       disabled\n    \\__/       ClusterMesh:        disabled\n\nDaemonSet              cilium                   Desired: ${n}, Ready: ${r}/${n}, Available: ${r}/${n}\nDaemonSet              cilium-envoy             Desired: ${n}, Ready: ${r}/${n}, Available: ${r}/${n}\nDeployment             cilium-operator          Desired: 1, Ready: 1/1, Available: 1/1\nContainers:            cilium                   Running: ${r}${r < n ? `, Pending: ${n - r}` : ''}\n                       cilium-envoy             Running: ${r}${r < n ? `, Pending: ${n - r}` : ''}\n                       cilium-operator          Running: 1\nCluster Pods:          2/2 managed by Cilium\nHelm chart version:    ${db.cni.version}\nImage versions         cilium             quay.io/cilium/cilium:v${db.cni.version}: ${r}\n${ok ? '' : `Errors:                cilium             cilium    ${n - r} pods of DaemonSet cilium are not ready\n`}`);
      return ok ? 0 : 1;
    }
    ctx.err(`Error: unknown command "${sub}" for "cilium"\nRun 'cilium --help' for usage.\n`);
    return 1;
  },
};
