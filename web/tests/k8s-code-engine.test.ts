// The "cluster from code" stand: Edu Cloud VMs become Ansible hosts, kubeadm
// runs through Ansible on them, and the GitOps controller keeps a kube-lite
// cluster equal to a forge repository.

import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import '../src/core/registry';
import { createSimMachine, type SimMachine } from '../src/engine/terminal/shell';
import type { KcodeFacts } from '../src/blocks/k8s-code/stand';

const P = '/private/tmp/claude-501/-Users-tym83/eb7387cd-748a-40ee-b298-f6ea9cbddca0/scratchpad/engine.txt';
let LOG = '';
async function sh(m: SimMachine, ...lines: string[]): Promise<string> {
  let out = '';
  for (const l of lines) {
    const r = await m.exec(l);
    out += r.out;
    LOG += `$ ${l}\n${r.out}\n`;
  }
  return out;
}
const write = (m: SimMachine, path: string, text: string) => {
  const dir = path.slice(0, path.lastIndexOf('/'));
  if (!m.rootFs.exists(dir)) m.rootFs.mkdir(dir, { parents: true });
  m.rootFs.writeFile(path, text);
  m.rootFs.chown(path, 1000, 1000);
};
/** `terraform output -raw inventory > …`; until tfsim reads flags before the name, write the same text. */
export async function emitInventory(m: SimMachine, dir = '/home/learner/infra', to = '/home/learner/ops/inventory.ini'): Promise<void> {
  const back = m.cwd();
  const r = await m.exec(`cd ${dir} && terraform output -raw inventory > ${to}`);
  await m.exec(`cd ${back}`);
  if (r.exit !== 0 || !m.rootFs.readFile(to).includes('[control_plane]')) {
    const state = JSON.parse(m.rootFs.readFile(`${dir}/terraform.tfstate`)) as { outputs: Record<string, { value: string }> };
    write(m, to, state.outputs.inventory.value);
  }
}
const kc = async (m: SimMachine) => (await m.facts()).kcode as KcodeFacts;

export const MAIN_TF = `terraform {
  required_providers {
    edu = {
      source  = "edu/edu"
      version = "~> 1.4"
    }
  }
}

provider "edu" {}

resource "edu_network" "k8s" {
  name = "k8s"
  cidr = "10.0.0.0/16"
}

resource "edu_vm" "cp" {
  name       = "cp-1"
  image      = "ubuntu-24.04"
  memory_gb  = 4
  network_id = edu_network.k8s.id
  labels     = { trainer = "devops", role = "control-plane" }
}

resource "edu_vm" "worker" {
  count      = 2
  name       = "worker-\${count.index + 1}"
  image      = "ubuntu-24.04"
  memory_gb  = 4
  network_id = edu_network.k8s.id
  labels     = { trainer = "devops", role = "worker" }
}

output "inventory" {
  value = "[control_plane]\\n\${edu_vm.cp.name} ansible_host=\${edu_vm.cp.public_ip}\\n\\n[workers]\\n\${edu_vm.worker[0].name} ansible_host=\${edu_vm.worker[0].public_ip}\\n\${edu_vm.worker[1].name} ansible_host=\${edu_vm.worker[1].public_ip}\\n"
}
`;

const PREPARE = `- name: Prepare every node for kubeadm
  hosts: all
  become: true
  tasks:
    - name: Swap is off in fstab
      ansible.builtin.lineinfile:
        path: /etc/fstab
        regexp: '\\sswap\\s'
        state: absent
    - name: Kernel modules load at boot
      ansible.builtin.copy:
        dest: /etc/modules-load.d/k8s.conf
        content: "overlay\\nbr_netfilter\\n"
    - name: IPv4 forwarding is on
      ansible.builtin.copy:
        dest: /etc/sysctl.d/99-kubernetes.conf
        content: "net.ipv4.ip_forward = 1\\n"
    - name: The Kubernetes repository
      ansible.builtin.copy:
        dest: /etc/apt/sources.list.d/kubernetes.list
        content: "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.36/deb/ /\\n"
    - name: Packages
      ansible.builtin.apt:
        name: [containerd, kubelet, kubeadm, kubectl]
        state: present
    - name: containerd uses the systemd cgroup driver
      ansible.builtin.copy:
        dest: /etc/containerd/config.toml
        content: "version = 3\\n\\n[plugins.'io.containerd.cri.v1.runtime'.containerd.runtimes.runc.options]\\n  SystemdCgroup = true\\n"
      notify: Restart containerd
  handlers:
    - name: Restart containerd
      ansible.builtin.service:
        name: containerd
        state: restarted
`;

describe('cluster from code stand', () => {
  it('terraform → hosts → prepare → kubeadm → cilium', async () => {
    const m = await createSimMachine({ hostname: 'ops', cwd: '~/infra', files: [{ path: '/home/learner/infra/main.tf', content: MAIN_TF }, { path: '/home/learner/ops/ansible.cfg', content: '[defaults]\ninventory = ./inventory.ini\n' }], ext: { tf: {}, kcode: {} } });
    await sh(m, 'terraform init', 'terraform apply -auto-approve');
    await emitInventory(m);
    await sh(m, 'cd ../ops', 'cat inventory.ini', 'ansible all -m ansible.builtin.ping');
    let f = await kc(m);
    expect(f.vms.length).toBe(3);
    expect(f.hosts.map((h) => h.name)).toEqual(['cp-1', 'worker-1', 'worker-2']);
    expect(f.hosts.every((h) => !h.swapOff)).toBe(true);
    // kubeadm before preparation fails
    await sh(m, 'ansible cp-1 -b -a "kubeadm init"');
    write(m, '/home/learner/ops/prepare.yml', PREPARE);
    await sh(m, 'ansible-playbook prepare.yml', 'ansible-playbook prepare.yml');
    f = await kc(m);
    writeFileSync(P, LOG + JSON.stringify(f.hosts, null, 1));
    expect(f.hosts.every((h) => h.swapOff && h.ipForward && h.systemdCgroup && h.repo && h.packages.includes('kubeadm'))).toBe(true);
    await sh(m, 'ansible cp-1 -b -a "kubeadm init --pod-network-cidr=10.244.0.0/16"');
    f = await kc(m);
    expect(f.cluster.initialized).toBe(true);
    const join = (await sh(m, 'ansible cp-1 -b -a "kubeadm token create --print-join-command"')).match(/kubeadm join \S+ --token \S+ --discovery-token-ca-cert-hash \S+/)![0];
    await sh(m, `ansible workers -b -a "${join}"`);
    f = await kc(m);
    expect(f.cluster.nodes.length).toBe(3);
    expect(f.cluster.nodes.every((n) => !n.ready)).toBe(true);
    await sh(m, 'ansible cp-1 -b -m ansible.builtin.shell -a "KUBECONFIG=/etc/kubernetes/admin.conf cilium install --version 1.18.4"', 'ansible cp-1 -b -m ansible.builtin.shell -a "KUBECONFIG=/etc/kubernetes/admin.conf cilium status"');
    f = await kc(m);
    expect(f.cluster.nodes.every((n) => n.ready)).toBe(true);
    // a second init is refused by preflight, which is why the role needs creates:
    const again = await sh(m, 'ansible cp-1 -b -a "kubeadm init"');
    expect(again).toMatch(/FileAvailable--etc-kubernetes-manifests-kube-apiserver.yaml/);
    await sh(m, 'ansible cp-1 -b -a "kubeadm init" -a "creates=/etc/kubernetes/admin.conf"', 'ansible cp-1 -b -a "kubeadm certs check-expiration"', 'ansible cp-1 -b -a "kubeadm upgrade plan"');
    // destroy takes the hosts away
    await sh(m, 'cd ../infra', 'terraform destroy -auto-approve');
    f = await kc(m);
    expect(f.hosts.length).toBe(0);
    expect(f.cluster.initialized).toBe(false);
    writeFileSync(P, LOG);
  });
});

const DEPLOY = (image: string, replicas = 2) => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: shop
  template:
    metadata:
      labels:
        app: shop
    spec:
      containers:
        - name: web
          image: ${image}
          ports:
            - containerPort: 80
`;
const SVC = `apiVersion: v1
kind: Service
metadata:
  name: shop
spec:
  selector:
    app: shop
  ports:
    - port: 80
      targetPort: 80
`;
const APP = `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: shop
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://forge.edu/team/shop-deploy.git
    targetRevision: main
    path: k8s
  destination:
    server: https://kubernetes.default.svc
    namespace: shop
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
`;

describe('gitops controller', () => {
  it('syncs, self-heals and prunes', async () => {
    LOG = '';
    const m = await createSimMachine({
      hostname: 'ops',
      cwd: '~',
      ext: {
        k8s: {},
        git: { identity: { name: 'Learner', email: 'learner@forge.edu' }, repos: [{ path: '/home/learner/shop-deploy', commits: [{ message: 'shop v1', files: { 'k8s/deployment.yaml': DEPLOY('trainer/web:1.0'), 'k8s/service.yaml': SVC, 'README.md': '# shop\n' } }], remote: 'team/shop-deploy' }] },
        gitops: {},
      },
    });
    write(m, '/home/learner/app.yaml', APP);
    await sh(m, 'kubectl apply -n argocd -f app.yaml', 'kubectl get applications -n argocd', 'kubectl get deploy -n shop');
    const app = async () => ((await m.facts()).k8s as { objects: { kind: string; metadata: { name: string }; status?: { sync?: { status: string; revision: string }; health?: { status: string } } }[] }).objects.find((o) => o.kind === 'Application' && o.metadata.name === 'shop')!;
    await sh(m, 'kubectl get pods -n shop', 'kubectl get crd', 'kubectl get application shop -n argocd -o yaml');
    writeFileSync(P + '.gitops', LOG);
    let a = await app();
    expect(a.status?.sync?.status).toBe('Synced');
    expect(a.status?.health?.status).toBe('Healthy');
    // Argo CD's printer columns, as kubectl shows them for the CRD.
    expect((await m.exec('kubectl get application -n argocd')).out).toMatch(/NAME\s+SYNC STATUS\s+HEALTH STATUS\nshop\s+Synced\s+Healthy/);
    expect((await m.exec('kubectl get application -n argocd -o wide')).out).toMatch(/REVISION\s+PROJECT\nshop\s+Synced\s+Healthy\s+[0-9a-f]{7,}\s+default/);
    // drift by hand is reverted
    await sh(m, 'kubectl scale deployment shop -n shop --replicas=5', 'kubectl get deploy shop -n shop');
    a = await app();
    expect(a.status?.sync?.status).toBe('Synced');
    // a new commit is rolled out; a deleted file is pruned
    write(m, '/home/learner/shop-deploy/k8s/deployment.yaml', DEPLOY('trainer/web:1.1', 3));
    await sh(m, 'cd shop-deploy', 'git rm k8s/service.yaml', 'git commit -a -m "shop v1.1"', 'git push', 'kubectl get deploy,svc -n shop', 'kubectl get application shop -n argocd -o custom-columns=SYNC:.status.sync.status,HEALTH:.status.health.status,REV:.status.sync.revision');
    writeFileSync(P + '.gitops', LOG);
    a = await app();
    expect(a.status?.sync?.status).toBe('Synced');
    const k = (await m.facts()).k8s as { deployments: { name: string; image: string; replicas: number }[]; services: { ns: string; name: string }[] };
    expect(k.deployments.find((d) => d.name === 'shop')?.image).toBe('trainer/web:1.1');
    expect(k.services.some((s) => s.ns === 'shop' && s.name === 'shop')).toBe(false);
    writeFileSync(P + '.gitops', LOG);
  });
});

import { clusterStand, opsFiles, preparedStand, stand } from '../src/blocks/k8s-code/content/setups';

describe('stands of block 9', () => {
  it('site.yml with roles brings the cluster up and is idempotent; a rebuild works', async () => {
    LOG = '';
    const m = await createSimMachine(stand({ applied: true, ops: opsFiles() }));
    try {
      await sh(m, 'cat inventory.ini', 'ansible-playbook site.yml');
      let f = await kc(m);
      expect(f.cluster.nodes.filter((n) => n.ready).length).toBe(3);
      const out = (await sh(m, 'ansible-playbook site.yml')).replace(/\x1b\[[0-9;]*m/g, '');
      expect(out).toMatch(/cp-1\s+: ok=\d+\s+changed=0/);
      expect(out).toMatch(/worker-2\s+: ok=\d+\s+changed=0/);
      await sh(m, 'cd ../infra', 'terraform destroy -auto-approve', 'terraform apply -auto-approve');
      await emitInventory(m);
      await sh(m, 'cd ../ops', 'ansible-playbook site.yml');
      f = await kc(m);
      expect(f.cluster.nodes.filter((n) => n.ready).length).toBe(3);
    } finally {
      writeFileSync(P + '.site', LOG);
    }
  });

  it('prepared and cluster stands', async () => {
    const a = await createSimMachine(preparedStand());
    let f = await kc(a);
    expect(f.hosts.every((h) => h.swapOff && h.ipForward && h.packages.includes('kubeadm'))).toBe(true);
    expect(f.cluster.initialized).toBe(false);
    const b = await createSimMachine(clusterStand());
    f = await kc(b);
    expect(f.cluster.nodes.filter((n) => n.ready).length).toBe(3);
  });
});
