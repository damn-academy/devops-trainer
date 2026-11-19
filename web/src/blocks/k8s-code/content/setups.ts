// Stands of block 9: the Terraform code of the three nodes, the Ansible
// project with its roles, the GitOps repository — and the TerminalSetups that
// start a lab at the point the previous lessons left it.

import type { TerminalSetup } from '../../../core/types';
import type { KcodeSetup } from '../stand';

export const HOME = '/home/learner';
export const INFRA = `${HOME}/infra`;
export const OPS = `${HOME}/ops`;
export const DEPLOY_REPO = `${HOME}/shop-deploy`;
export const TOKEN = 'stand1.cl0ckw0rk0range0';

export const TF_HEAD = `terraform {
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
`;

export const TF_CP = `
resource "edu_vm" "cp" {
  name       = "cp-1"
  image      = "ubuntu-24.04"
  cores      = 2
  memory_gb  = 4
  network_id = edu_network.k8s.id
  labels     = { trainer = "devops", role = "control-plane" }
}
`;

export const TF_WORKERS = `
resource "edu_vm" "worker" {
  count      = 2
  name       = "worker-\${count.index + 1}"
  image      = "ubuntu-24.04"
  cores      = 2
  memory_gb  = 4
  network_id = edu_network.k8s.id
  labels     = { trainer = "devops", role = "worker" }
}
`;

/** The inventory Terraform hands to Ansible: groups, public addresses and the control-plane endpoint. */
export const TF_INVENTORY = `
output "inventory" {
  value = "[control_plane]\\n\${edu_vm.cp.name} ansible_host=\${edu_vm.cp.public_ip}\\n\\n[workers]\\n\${edu_vm.worker[0].name} ansible_host=\${edu_vm.worker[0].public_ip}\\n\${edu_vm.worker[1].name} ansible_host=\${edu_vm.worker[1].public_ip}\\n\\n[all:vars]\\ncp_endpoint=\${edu_vm.cp.private_ip}:6443\\n"
}
`;

export const MAIN_TF = TF_HEAD + TF_CP + TF_WORKERS + TF_INVENTORY;

/** The inventory the output above produces on a fresh Edu Cloud (addresses are handed out in order). */
export const INVENTORY = '[control_plane]\ncp-1 ansible_host=203.0.113.12\n\n[workers]\nworker-1 ansible_host=203.0.113.13\nworker-2 ansible_host=203.0.113.14\n\n[all:vars]\ncp_endpoint=10.0.0.12:6443\n';

export const ANSIBLE_CFG = '[defaults]\ninventory = ./inventory.ini\n';

// ── the roles ──

export const ROLE_PREREQ = `- name: Swap is off and stays off after a reboot
  ansible.builtin.lineinfile:
    path: /etc/fstab
    regexp: '\\sswap\\s'
    state: absent

- name: Kernel modules for containers load at boot
  ansible.builtin.copy:
    dest: /etc/modules-load.d/k8s.conf
    content: |
      overlay
      br_netfilter

- name: The node forwards IPv4 packets
  ansible.builtin.copy:
    dest: /etc/sysctl.d/99-kubernetes.conf
    content: |
      net.ipv4.ip_forward = 1
`;

export const CONTAINERD_TEMPLATE = `version = 3

[plugins.'io.containerd.cri.v1.runtime'.containerd.runtimes.runc]
  runtime_type = 'io.containerd.runc.v2'

[plugins.'io.containerd.cri.v1.runtime'.containerd.runtimes.runc.options]
  SystemdCgroup = {{ containerd_systemd_cgroup | default(true) | lower }}
`;

export const ROLE_CONTAINERD = `- name: containerd is installed
  ansible.builtin.apt:
    name: containerd
    state: present

- name: containerd uses the systemd cgroup driver
  ansible.builtin.template:
    src: config.toml.j2
    dest: /etc/containerd/config.toml
  notify: Restart containerd

- name: containerd is running
  ansible.builtin.service:
    name: containerd
    state: started
    enabled: true
`;

export const ROLE_CONTAINERD_HANDLERS = `- name: Restart containerd
  ansible.builtin.service:
    name: containerd
    state: restarted
`;

export const ROLE_PACKAGES = `- name: The Kubernetes v1.36 repository
  ansible.builtin.copy:
    dest: /etc/apt/sources.list.d/kubernetes.list
    content: |
      deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.36/deb/ /

- name: kubelet, kubeadm and kubectl of the pinned version
  ansible.builtin.apt:
    name:
      - kubelet=1.36.4-1.1
      - kubeadm=1.36.4-1.1
      - kubectl=1.36.4-1.1
    state: present
`;

export const INIT_TEMPLATE = `apiVersion: kubeadm.k8s.io/v1beta4
kind: InitConfiguration
bootstrapTokens:
  - token: "{{ kubeadm_token }}"
    ttl: 24h0m0s
localAPIEndpoint:
  advertiseAddress: {{ ansible_default_ipv4.address }}
  bindPort: 6443
---
apiVersion: kubeadm.k8s.io/v1beta4
kind: ClusterConfiguration
kubernetesVersion: v1.36.4
networking:
  podSubnet: 10.244.0.0/16
`;

export const JOIN_TEMPLATE = `apiVersion: kubeadm.k8s.io/v1beta4
kind: JoinConfiguration
discovery:
  bootstrapToken:
    apiServerEndpoint: "{{ cp_endpoint }}"
    token: "{{ kubeadm_token }}"
    unsafeSkipCAVerification: true
`;

export const ROLE_INIT = `- name: The kubeadm configuration
  ansible.builtin.template:
    src: init.yaml.j2
    dest: /etc/kubeadm/init.yaml

- name: kubeadm init, once
  ansible.builtin.command:
    cmd: kubeadm init --config /etc/kubeadm/init.yaml
    creates: /etc/kubernetes/admin.conf
`;

export const ROLE_CILIUM = `- name: Cilium is the pod network
  ansible.builtin.shell:
    cmd: KUBECONFIG=/etc/kubernetes/admin.conf cilium install --version 1.18.4
    creates: /etc/cni/net.d/05-cilium.conflist
`;

export const ROLE_JOIN = `- name: The join configuration
  ansible.builtin.template:
    src: join.yaml.j2
    dest: /etc/kubeadm/join.yaml

- name: kubeadm join, once
  ansible.builtin.command:
    cmd: kubeadm join --config /etc/kubeadm/join.yaml
    creates: /etc/kubernetes/kubelet.conf
`;

export const SITE = `- name: Every node is ready for kubeadm
  hosts: all
  become: true
  roles:
    - k8s_prereq
    - containerd
    - kube_packages

- name: The control plane
  hosts: control_plane
  become: true
  roles:
    - kubeadm_init
    - cilium

- name: The workers join the cluster
  hosts: workers
  become: true
  roles:
    - kubeadm_join
`;

export const GROUP_VARS = `# The bootstrap token both kubeadm init and kubeadm join use.
# In a real project this file is encrypted with ansible-vault.
kubeadm_token: "${TOKEN}"
`;

/** The Ansible project: ansible.cfg, group_vars and the roles; `omit` leaves role task files empty for the learner. */
export function opsFiles(o: { omit?: ('init' | 'join' | 'cilium' | 'prereq' | 'containerd' | 'packages')[]; site?: boolean } = {}): NonNullable<TerminalSetup['files']> {
  const omit = new Set(o.omit ?? []);
  const f = (path: string, content: string) => ({ path: `${OPS}/${path}`, content });
  const files = [
    f('ansible.cfg', ANSIBLE_CFG),
    f('group_vars/all.yml', GROUP_VARS),
    f('roles/k8s_prereq/tasks/main.yml', omit.has('prereq') ? '' : ROLE_PREREQ),
    f('roles/containerd/tasks/main.yml', omit.has('containerd') ? '' : ROLE_CONTAINERD),
    f('roles/containerd/handlers/main.yml', ROLE_CONTAINERD_HANDLERS),
    f('roles/containerd/templates/config.toml.j2', CONTAINERD_TEMPLATE),
    f('roles/kube_packages/tasks/main.yml', omit.has('packages') ? '' : ROLE_PACKAGES),
    f('roles/kubeadm_init/templates/init.yaml.j2', INIT_TEMPLATE),
    f('roles/kubeadm_init/tasks/main.yml', omit.has('init') ? '' : ROLE_INIT),
    f('roles/cilium/tasks/main.yml', omit.has('cilium') ? '' : ROLE_CILIUM),
    f('roles/kubeadm_join/templates/join.yaml.j2', JOIN_TEMPLATE),
    f('roles/kubeadm_join/tasks/main.yml', omit.has('join') ? '' : ROLE_JOIN),
  ];
  if (o.site !== false) files.push(f('site.yml', SITE));
  return files;
}

/**
 * A stand: the Terraform code in ~/infra, the Ansible project in ~/ops.
 * `applied` — the VMs already exist (the inventory is written); the kcode
 * options prepare nodes, bring a cluster up or plant a fault.
 */
export function stand(o: { main?: string; ops?: NonNullable<TerminalSetup['files']>; applied?: boolean; kcode?: KcodeSetup; cwd?: string; extra?: NonNullable<TerminalSetup['files']> } = {}): TerminalSetup {
  return {
    hostname: 'ops',
    cwd: o.cwd ?? (o.applied ? '~/ops' : '~/infra'),
    files: [{ path: `${INFRA}/main.tf`, content: o.main ?? MAIN_TF }, ...(o.ops ?? [{ path: `${OPS}/ansible.cfg`, content: ANSIBLE_CFG }]), ...(o.extra ?? [])],
    ext: { tf: {}, kcode: { ...(o.applied ? { apply: INFRA, inventory: `${OPS}/inventory.ini` } : {}), ...(o.kcode ?? {}) } },
  };
}

/** Three prepared nodes and the Ansible project; the cluster may already be up. */
export const preparedStand = (kcode: KcodeSetup = {}, ops = opsFiles()) => stand({ applied: true, ops, kcode: { prepared: ['cp-1', 'worker-1', 'worker-2'], ...kcode } });

/** A running cluster made from code (cp-1 + two workers, Cilium). */
export const clusterStand = (kcode: KcodeSetup = {}, ops = opsFiles()) => preparedStand({ cluster: { cp: 'cp-1', workers: ['worker-1', 'worker-2'], cni: true, token: TOKEN }, ...kcode }, ops);

/** The Ansible project with one role's task file replaced. */
export const opsWith = (role: string, content: string) => opsFiles().map((x) => (x.path.endsWith(`roles/${role}/tasks/main.yml`) ? { ...x, content } : x));

/** A role with its creates lines removed (the classic non-idempotent command). */
export const noCreates = (role: string) => role.replace(/\n\s+creates: [^\n]+/g, '');

// ── GitOps ──

export const DEPLOYMENT = (image: string, replicas = 2) => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: shop
  labels:
    app: shop
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

export const SERVICE = `apiVersion: v1
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

export const CONFIGMAP = `apiVersion: v1
kind: ConfigMap
metadata:
  name: shop-banner
data:
  BANNER: "Black Friday: -20%"
`;

export const APP = (o: { automated?: boolean; selfHeal?: boolean; prune?: boolean; path?: string; repo?: string; extra?: string } = {}) => `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: shop
  namespace: argocd
spec:
  project: default
  source:
    repoURL: ${o.repo ?? 'https://forge.edu/team/shop-deploy.git'}
    targetRevision: main
    path: ${o.path ?? 'k8s'}
  destination:
    server: https://kubernetes.default.svc
    namespace: shop
  syncPolicy:
${o.automated === false ? '' : `    automated:\n      prune: ${o.prune ?? false}\n      selfHeal: ${o.selfHeal ?? false}\n`}    syncOptions:
      - CreateNamespace=true
${o.extra ?? ''}`;

export const DEPLOY_FILES = (image = 'trainer/web:1.0', replicas = 2, extra: Record<string, string> = {}) => ({ 'k8s/deployment.yaml': DEPLOYMENT(image, replicas), 'k8s/service.yaml': SERVICE, 'README.md': '# shop-deploy\n\nManifests of the shop. Argo CD syncs the k8s/ directory to the namespace shop.\n', ...extra });

/** A kube-lite cluster with Argo CD, the forge repository team/shop-deploy and its clone in ~/shop-deploy. */
export function gitopsStand(o: { files?: Record<string, string>; apps?: string[]; later?: { message: string; files: Record<string, string | null> }[]; extraFiles?: NonNullable<TerminalSetup['files']> } = {}): TerminalSetup {
  return {
    hostname: 'ops',
    cwd: '~/shop-deploy',
    files: o.extraFiles,
    ext: {
      k8s: {},
      git: {
        identity: { name: 'Learner', email: 'learner@forge.edu' },
        repos: [{ path: DEPLOY_REPO, commits: [{ message: 'shop: first release', files: o.files ?? DEPLOY_FILES() }, ...(o.later ?? [])], remote: 'team/shop-deploy' }],
      },
      gitops: { apps: o.apps ?? [] },
    },
  };
}
