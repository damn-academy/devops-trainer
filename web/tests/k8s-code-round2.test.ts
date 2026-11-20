// Block 9, second persona round: kubectl on the stand answers from the
// kubeadm cluster memory, a counted ping is accepted, the task-level
// environment of the cilium role gets an explanation, the system model and
// the interview section are in place.

import { describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { evaluateCheck } from '../src/core/check';
import type { Lesson, PlacementTask, QuizItem, Task, TerminalSection } from '../src/core/types';
import { createSimMachine, type SimMachine } from '../src/engine/terminal/shell';
import { INFRA, OPS, ROLE_INIT, ROLE_JOIN, TF_CP, TF_HEAD, TF_INVENTORY, TF_WORKERS } from '../src/blocks/k8s-code/content/setups';
import { humanAge, parseNodesQuery } from '../src/blocks/k8s-code/kubectl';

const lesson = (id: string) => registry.lessons.get(id) as Lesson;
const lab = (id: string, sec = 'lab') => lesson(id).sections.find((s) => s.id === sec) as TerminalSection;
const write = (m: SimMachine, path: string, text: string) => {
  const dir = path.slice(0, path.lastIndexOf('/'));
  if (!m.rootFs.exists(dir)) m.rootFs.mkdir(dir, { parents: true });
  m.rootFs.writeFile(path, text);
  m.rootFs.chown(path, 1000, 1000);
};
async function sh(m: SimMachine, ...lines: string[]): Promise<string> {
  let out = '';
  for (const l of lines) out += (await m.exec(l)).out;
  return out;
}
const check = async (m: SimMachine, t: Task) => evaluateCheck(t.check, await m.facts());
const NODES = 'ansible cp-1 -b -a "kubectl --kubeconfig /etc/kubernetes/admin.conf get nodes"';

describe('kubectl on the kubeadm stand', () => {
  it('parses only plain get nodes queries', () => {
    expect(parseNodesQuery(['get', 'nodes'])).toEqual({ wide: false, names: false, noHeaders: false, name: undefined });
    expect(parseNodesQuery(['--kubeconfig', '/x', 'get', 'no', 'cp-1', '-o', 'wide'])).toEqual({ kubeconfig: '/x', wide: true, names: false, noHeaders: false, name: 'cp-1' });
    expect(parseNodesQuery(['get', 'nodes', '-owide'])?.wide).toBe(true);
    expect(parseNodesQuery(['get', 'nodes', '-o', 'name'])?.names).toBe(true);
    expect(parseNodesQuery(['get', 'nodes', '--no-headers'])?.noHeaders).toBe(true);
    expect(parseNodesQuery(['get', 'node/worker-1'])?.name).toBe('worker-1');
    expect(parseNodesQuery(['get', 'nodes', '-o', 'yaml'])).toBeNull();
    expect(parseNodesQuery(['get', 'pods'])).toBeNull();
    expect(parseNodesQuery(['describe', 'nodes'])).toBeNull();
    expect([humanAge(5_000), humanAge(330_000), humanAge(3_600_000), humanAge(25 * 3_600_000), humanAge(3 * 86_400_000)]).toEqual(['5s', '5m30s', '60m', '25h', '3d']);
  });

  it('shows the members kubeadm recorded, not a ready-made k3s cluster', async () => {
    const t = registry.blocks.get('k8s-3')!.placement!.find((x) => x.id === 'k8s-3.place.token') as PlacementTask & { setup: never };
    const m = await createSimMachine((t as unknown as { setup: Parameters<typeof createSimMachine>[0] }).setup);
    await sh(m, 'cd ~/ops');
    let out = await sh(m, NODES);
    expect(out).toMatch(/cp-1\s+Ready\s+control-plane\s+25h\s+v1\.36\.4/);
    expect(out).not.toMatch(/worker-1|k3s|master/);
    const join = /kubeadm join[^\n]*/.exec(await sh(m, 'ansible cp-1 -b -a "kubeadm token create --print-join-command"'))![0].trim();
    await sh(m, `ansible workers -b -a "${join}"`);
    out = await sh(m, NODES);
    expect(out).toMatch(/worker-1\s+Ready\s+<none>\s+\d+s\s+v1\.36\.4/);
    expect(out).toMatch(/worker-2\s+Ready/);
    out = await sh(m, 'ansible cp-1 -b -m ansible.builtin.shell -a "KUBECONFIG=/etc/kubernetes/admin.conf kubectl get nodes -o wide"');
    expect(out).toMatch(/INTERNAL-IP[\s\S]*containerd:\/\/2\.1\.4/);
    out = await sh(m, 'ansible cp-1 -b -a "kubectl --kubeconfig /etc/kubernetes/admin.conf get node worker-9"');
    expect(out).toContain('nodes "worker-9" not found');
    out = await sh(m, 'ansible cp-1 -b -m ansible.builtin.shell -a "kubectl --kubeconfig /etc/kubernetes/admin.conf get nodes --no-headers | wc -l"');
    expect(out).toMatch(/\b3\b/);
    out = await sh(m, 'ansible cp-1 -b -a "kubectl --kubeconfig /etc/kubernetes/admin.conf get nodes -o name"');
    expect(out).toContain('node/worker-2');
  });

  it('marks nodes NotReady until the pod network is installed', async () => {
    const l = lab('k8s-3.kubeadm');
    const m = await createSimMachine(l.setup);
    await sh(m, 'cd ~/ops', 'ansible cp-1 -b -a "kubeadm init --pod-network-cidr=10.244.0.0/16"');
    expect(await sh(m, NODES)).toMatch(/cp-1\s+NotReady\s+control-plane/);
    await sh(m, 'ansible cp-1 -b -m ansible.builtin.shell -a "KUBECONFIG=/etc/kubernetes/admin.conf cilium install --version 1.18.4"');
    expect(await sh(m, NODES)).toMatch(/cp-1\s+Ready\s+control-plane/);
  });

  it('leaves kubectl of other clusters to kube-lite', async () => {
    const m = await createSimMachine({ ext: { k8s: {} } } as Parameters<typeof createSimMachine>[0]);
    expect(await sh(m, 'kubectl get nodes')).toMatch(/cp-1|NAME/);
  });
});

describe('nodes lab: a counted ping', () => {
  it('accepts ansible all -m ping | grep -c SUCCESS', async () => {
    const l = lab('k8s-3.nodes');
    const m = await createSimMachine(l.setup);
    write(m, `${INFRA}/main.tf`, TF_HEAD + TF_CP + TF_WORKERS + TF_INVENTORY);
    await sh(m, 'cd ~/infra', 'terraform init', 'terraform apply -auto-approve');
    const st = JSON.parse(m.rootFs.readFile(`${INFRA}/terraform.tfstate`)) as { outputs: Record<string, { value: string }> };
    write(m, `${OPS}/inventory.ini`, st.outputs.inventory.value);
    await sh(m, 'cd ~/ops');
    expect(await sh(m, 'ansible all -m ansible.builtin.ping | grep -c SUCCESS')).toBe('3\n');
    expect((await check(m, l.tasks[1])).pass).toBe(true);
    await sh(m, 'echo 3');
    // A bare 3 passes only because the state agrees; the state is what is checked.
    expect((await check(m, l.tasks[1])).pass).toBe(true);
  });
});

describe('as-code lab: environment on the cilium task', () => {
  it('explains how to pass KUBECONFIG on the stand', async () => {
    const l = lab('k8s-3.as-code');
    const m = await createSimMachine(l.setup);
    write(m, `${OPS}/roles/kubeadm_init/tasks/main.yml`, ROLE_INIT);
    write(m, `${OPS}/roles/kubeadm_join/tasks/main.yml`, ROLE_JOIN);
    write(m, `${OPS}/roles/cilium/tasks/main.yml`, '- name: Cilium is the pod network\n  ansible.builtin.command:\n    cmd: cilium install --version 1.18.4\n    creates: /etc/cni/net.d/05-cilium.conflist\n  environment:\n    KUBECONFIG: /etc/kubernetes/admin.conf\n');
    await sh(m, 'cd ~/ops', 'ansible-playbook site.yml');
    const r = await check(m, l.tasks[0]);
    expect(r.pass).toBe(false);
    expect(r.say?.ru).toContain('KUBECONFIG=/etc/kubernetes/admin.conf cilium install');
  });
});

describe('the whole model and the interview', () => {
  it('gitops ends with the layer model and a quiz that disarms "Terraform or Argo CD sees everything"', () => {
    const g = lesson('k8s-3.gitops');
    const model = g.sections.find((s) => s.id === 'model') as { body: { ru: string } };
    expect(model.body.ru).toContain('terraform plan` ответит No changes');
    const quiz = g.sections.find((s) => s.id === 'quiz') as { items: string[] };
    expect(quiz.items).toContain('k8s-3.q.layers');
    const q = registry.quiz.get('k8s-3.q.layers') as QuizItem & { options: { id: string; correct?: boolean }[] };
    expect(q.options.find((o) => o.correct)?.id).toBe('ansible');
  });

  it('operate has the interview questions', () => {
    const s = lesson('k8s-3.operate').sections.find((x) => x.id === 'interview') as { body: { ru: string } };
    expect(s.body.ru).toContain('serial: 1');
    expect(s.body.ru).toContain('kubeadm certs renew');
  });
});
