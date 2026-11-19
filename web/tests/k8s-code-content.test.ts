// Block 9 "A cluster from code": every lab, docs task, placement task and
// exam task is solvable on the simulator, and the explainers run.

import { describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { evaluateCheck } from '../src/core/check';
import { lintRegistry } from '../src/core/lint';
import type { DocsSection, Exam, Facts, Lesson, PlacementTask, Task, TerminalSection, TerminalSetup } from '../src/core/types';
import { createSimMachine, type SimMachine } from '../src/engine/terminal/shell';
import { APP, INFRA, OPS, ROLE_CILIUM, ROLE_INIT, ROLE_JOIN, ROLE_PACKAGES, ROLE_PREREQ, TF_CP, TF_HEAD, TF_INVENTORY, TF_WORKERS, DEPLOYMENT } from '../src/blocks/k8s-code/content/setups';
import { codeModel, gitopsModel } from '../src/blocks/k8s-code/explainers';

const HOME = '/home/learner';

function lab(lessonId: string, sectionId: string): { setup: TerminalSetup; tasks: Task[] } {
  const s = (registry.lessons.get(lessonId) as Lesson).sections.find((x) => x.id === sectionId)!;
  if (s.kind === 'terminal') return { setup: (s as TerminalSection).setup, tasks: (s as TerminalSection).tasks };
  const d = s as DocsSection;
  return { setup: d.terminal!.setup, tasks: [d.terminal!.task] };
}
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
const passes = async (m: SimMachine, t: Task, start?: Facts) => evaluateCheck(t.check, await m.facts(), start).pass;

/** `terraform output -raw inventory > …` — falls back to the state while tfsim reads the name as `-raw`. */
async function inventory(m: SimMachine): Promise<void> {
  const back = m.cwd();
  const r = await m.exec(`cd ${INFRA} && terraform output -raw inventory > ${OPS}/inventory.ini`);
  await m.exec(`cd ${back}`);
  const text = m.rootFs.exists(`${OPS}/inventory.ini`) ? m.rootFs.readFile(`${OPS}/inventory.ini`) : '';
  if (r.exit !== 0 || !text.includes('[control_plane]')) {
    const st = JSON.parse(m.rootFs.readFile(`${INFRA}/terraform.tfstate`)) as { outputs: Record<string, { value: string }> };
    write(m, `${OPS}/inventory.ini`, st.outputs.inventory.value);
  }
}

describe('block 9 content', () => {
  it('lints without errors and with no warnings of its own', () => {
    const mine = lintRegistry(registry).filter((i) => /k8s-3|k8s-code/.test(i.where));
    expect(mine.map((i) => `${i.level} ${i.where}: ${i.msg}`).join('\n')).toBe('');
    expect(registry.blocks.get('k8s-3')?.lessons.length).toBe(8);
  });

  it('nodes: count, labels, the inventory output, No changes', async () => {
    const { setup, tasks } = lab('k8s-3.nodes', 'lab');
    const m = await createSimMachine(setup);
    write(m, `${INFRA}/main.tf`, TF_HEAD + TF_CP + TF_WORKERS + TF_INVENTORY);
    await sh(m, 'terraform init', 'terraform apply -auto-approve');
    expect(await passes(m, tasks[0])).toBe(true);
    await inventory(m);
    await sh(m, 'cd ../ops', 'ansible all -m ansible.builtin.ping');
    expect(await passes(m, tasks[1])).toBe(true);
    await sh(m, 'cd ../infra', 'terraform plan');
    expect(await passes(m, tasks[2])).toBe(true);
  });

  it('prepare: two roles, then changed=0', async () => {
    const { setup, tasks } = lab('k8s-3.prepare', 'lab');
    const m = await createSimMachine(setup);
    write(m, `${OPS}/roles/k8s_prereq/tasks/main.yml`, ROLE_PREREQ);
    await sh(m, 'ansible-playbook prepare.yml');
    expect(await passes(m, tasks[0])).toBe(true);
    write(m, `${OPS}/roles/kube_packages/tasks/main.yml`, ROLE_PACKAGES);
    write(m, `${OPS}/roles/containerd/defaults/main.yml`, 'containerd_systemd_cgroup: true\n');
    await sh(m, 'ansible-playbook prepare.yml');
    expect(await passes(m, tasks[1])).toBe(true);
    await sh(m, 'ansible-playbook prepare.yml');
    expect(await passes(m, tasks[2])).toBe(true);
  });

  it('kubeadm by hand: init, cilium, join; the expired token; init-defaults', async () => {
    const { setup, tasks } = lab('k8s-3.kubeadm', 'lab');
    const m = await createSimMachine(setup);
    const out = await sh(m, 'ansible cp-1 -b -a "kubeadm init --pod-network-cidr=10.244.0.0/16"');
    expect(await passes(m, tasks[0])).toBe(true);
    await sh(m, 'ansible cp-1 -b -m ansible.builtin.shell -a "KUBECONFIG=/etc/kubernetes/admin.conf cilium install --version 1.18.4"');
    expect(await passes(m, tasks[1])).toBe(true);
    const join = out.replace(/\\\n\s*/g, '').match(/kubeadm join \S+ --token \S+ ?--discovery-token-ca-cert-hash \S+/)![0];
    await sh(m, `ansible workers -b -a "${join}"`);
    expect(await passes(m, tasks[2])).toBe(true);

    const t = lab('k8s-3.kubeadm', 'token');
    const m2 = await createSimMachine(t.setup);
    const old = await sh(m2, 'ansible workers -b -a "kubeadm join 10.0.0.12:6443 --token stand1.cl0ckw0rk0range0 --discovery-token-unsafe-skip-ca-verification"');
    expect(old).toMatch(/JWS signature/);
    const fresh = (await sh(m2, 'ansible cp-1 -b -a "kubeadm token create --print-join-command"')).match(/kubeadm join \S+ --token \S+ --discovery-token-ca-cert-hash \S+/)![0];
    await sh(m2, `ansible workers -b -a "${fresh}"`);
    expect(await passes(m2, t.tasks[0])).toBe(true);

    const d = lab('k8s-3.kubeadm', 'forcing');
    const m3 = await createSimMachine(d.setup);
    await sh(m3, 'ansible cp-1 -b -m ansible.builtin.shell -a "kubeadm config print init-defaults > /root/init-defaults.yaml"');
    expect(await passes(m3, d.tasks[0])).toBe(true);
  });

  it('as code (beginner): up, fail without creates, fix, rebuild', async () => {
    const { setup, tasks } = lab('k8s-3.as-code', 'lab-b');
    const m = await createSimMachine(setup);
    const start = await m.facts();
    await sh(m, 'ansible-playbook site.yml');
    expect(await passes(m, tasks[0])).toBe(true);
    await sh(m, 'ansible-playbook site.yml');
    const r = evaluateCheck(tasks[1].check, await m.facts());
    expect(r.pass).toBe(false);
    expect(r.say).toBeDefined();
    write(m, `${OPS}/roles/kubeadm_init/tasks/main.yml`, ROLE_INIT);
    write(m, `${OPS}/roles/kubeadm_join/tasks/main.yml`, ROLE_JOIN);
    await sh(m, 'ansible-playbook site.yml');
    expect(await passes(m, tasks[1])).toBe(true);
    await sh(m, 'cd ../infra', 'terraform destroy -auto-approve', 'terraform apply -auto-approve');
    await inventory(m);
    await sh(m, 'cd ../ops', 'ansible-playbook site.yml');
    expect(await passes(m, tasks[2], start)).toBe(true);
  });

  it('as code (skeleton): three roles, changed=0, rebuild', async () => {
    const { setup, tasks } = lab('k8s-3.as-code', 'lab');
    const m = await createSimMachine(setup);
    const start = await m.facts();
    write(m, `${OPS}/roles/kubeadm_init/tasks/main.yml`, ROLE_INIT);
    write(m, `${OPS}/roles/cilium/tasks/main.yml`, ROLE_CILIUM);
    write(m, `${OPS}/roles/kubeadm_join/tasks/main.yml`, ROLE_JOIN);
    await sh(m, 'ansible-playbook site.yml');
    expect(await passes(m, tasks[0])).toBe(true);
    await sh(m, 'ansible-playbook site.yml');
    expect(await passes(m, tasks[1])).toBe(true);
    await sh(m, 'cd ../infra', 'terraform destroy -auto-approve', 'terraform apply -auto-approve');
    await sh(m, 'cd ../ops', 'ansible-playbook site.yml');
    expect(evaluateCheck(tasks[2].check, await m.facts(), start).pass).toBe(false);
    await inventory(m);
    await sh(m, 'ansible-playbook site.yml');
    expect(await passes(m, tasks[2], start)).toBe(true);
  });

  it('gitops: an Application, a release by commit, self-heal, prune; ignoreDifferences', async () => {
    const { setup, tasks } = lab('k8s-3.gitops', 'lab');
    const m = await createSimMachine(setup);
    write(m, `${HOME}/app.yaml`, APP({}));
    await sh(m, 'kubectl apply -n argocd -f ~/app.yaml', 'kubectl get pods -n shop');
    expect(await passes(m, tasks[0])).toBe(true);
    write(m, `${HOME}/shop-deploy/k8s/deployment.yaml`, DEPLOYMENT('trainer/web:1.1'));
    await sh(m, 'git commit -a -m "shop 1.1"', 'git push', 'kubectl get pods -n shop');
    expect(await passes(m, tasks[1])).toBe(true);
    write(m, `${HOME}/app.yaml`, APP({ selfHeal: true }));
    await sh(m, 'kubectl apply -n argocd -f ~/app.yaml', 'kubectl scale deployment shop -n shop --replicas=5', 'kubectl get deploy -n shop');
    expect(await passes(m, tasks[2])).toBe(true);
    write(m, `${HOME}/app.yaml`, APP({ selfHeal: true, prune: true }));
    await sh(m, 'kubectl apply -n argocd -f ~/app.yaml', 'git rm k8s/banner.yaml', 'git commit -m "no banner"', 'git push', 'kubectl get cm -n shop');
    expect(await passes(m, tasks[3])).toBe(true);

    const d = lab('k8s-3.gitops', 'forcing');
    const m2 = await createSimMachine(d.setup);
    await sh(m2, 'kubectl scale deployment shop -n shop --replicas=4', 'kubectl get deploy -n shop');
    expect(await passes(m2, d.tasks[0])).toBe(false);
    const extra = '  ignoreDifferences:\n    - group: apps\n      kind: Deployment\n      jsonPointers:\n        - /spec/replicas\n';
    write(m2, `${HOME}/app.yaml`, APP({ selfHeal: true, prune: true, extra }).replace('      - CreateNamespace=true\n', '      - CreateNamespace=true\n      - RespectIgnoreDifferences=true\n'));
    await sh(m2, 'kubectl apply -n argocd -f ~/app.yaml', 'kubectl scale deployment shop -n shop --replicas=4', 'kubectl get deploy -n shop');
    expect(await passes(m2, d.tasks[0])).toBe(true);
  });

  it('operate: certificates and the upgrade plan saved on cp-1', async () => {
    const { setup, tasks } = lab('k8s-3.operate', 'lab');
    const m = await createSimMachine(setup);
    await sh(m, 'ansible cp-1 -b -m ansible.builtin.shell -a "kubeadm certs check-expiration > /root/certs.txt"');
    expect(await passes(m, tasks[0])).toBe(true);
    await sh(m, 'ansible cp-1 -b -m ansible.builtin.shell -a "kubeadm upgrade plan > /root/upgrade-plan.txt"');
    expect(await passes(m, tasks[1])).toBe(true);
  });

  it('placement tasks are solvable', async () => {
    const pl = registry.blocks.get('k8s-3')!.placement.filter((p): p is Extract<PlacementTask, { kind: 'task' }> => p.kind === 'task');
    const by = (id: string) => pl.find((p) => p.id === id)!;
    const a = await createSimMachine(by('k8s-3.place.count').setup);
    write(a, `${INFRA}/main.tf`, TF_HEAD + TF_CP + TF_WORKERS);
    await sh(a, 'terraform init', 'terraform apply -auto-approve');
    expect(await passes(a, by('k8s-3.place.count').task)).toBe(true);

    const b = await createSimMachine(by('k8s-3.place.preflight').setup);
    expect(await sh(b, 'ansible cp-1 -b -a "kubeadm init"')).toMatch(/ERROR Swap/);
    await sh(b, "ansible cp-1 -b -m ansible.builtin.lineinfile -a \"path=/etc/fstab regexp='\\sswap\\s' state=absent\"", 'ansible cp-1 -b -m ansible.builtin.copy -a "dest=/etc/sysctl.d/99-kubernetes.conf content=\'net.ipv4.ip_forward = 1\'"', 'ansible cp-1 -b -a "kubeadm init"');
    expect(await passes(b, by('k8s-3.place.preflight').task)).toBe(true);

    const c = await createSimMachine(by('k8s-3.place.token').setup);
    const fresh = (await sh(c, 'ansible cp-1 -b -a "kubeadm token create --print-join-command"')).match(/kubeadm join \S+ --token \S+ --discovery-token-ca-cert-hash \S+/)![0];
    await sh(c, `ansible workers -b -a "${fresh}"`);
    expect(await passes(c, by('k8s-3.place.token').task)).toBe(true);

    const d = await createSimMachine(by('k8s-3.place.drift').setup);
    expect(await passes(d, by('k8s-3.place.drift').task)).toBe(false);
    write(d, `${HOME}/app.yaml`, APP({ selfHeal: true }));
    await sh(d, 'kubectl apply -n argocd -f ~/app.yaml', 'kubectl get deploy -n shop');
    expect(await passes(d, by('k8s-3.place.drift').task)).toBe(true);
  });

  it('exam tasks are solvable', async () => {
    const exam = registry.exams.get('k8s-3.exam.rebuild') as Exam;
    const t = (id: string) => exam.tasks.find((x) => x.id === id)! as Extract<Exam['tasks'][number], { kind: 'task' }>;
    const m1 = await createSimMachine(t('machines').setup);
    write(m1, `${INFRA}/main.tf`, m1.rootFs.readFile(`${INFRA}/main.tf`));
    await sh(m1, 'terraform init', 'terraform apply -auto-approve');
    await inventory(m1);
    expect(await passes(m1, t('machines').task)).toBe(true);

    const m2 = await createSimMachine(t('cluster').setup);
    await sh(m2, 'ansible-playbook site.yml');
    expect(await passes(m2, t('cluster').task)).toBe(false);
    write(m2, `${OPS}/roles/k8s_prereq/tasks/main.yml`, ROLE_PREREQ);
    await sh(m2, 'ansible-playbook site.yml');
    expect(await passes(m2, t('cluster').task)).toBe(true);

    for (const [id, role, text] of [['idem-join', 'kubeadm_join', ROLE_JOIN], ['idem-cilium', 'cilium', ROLE_CILIUM]] as const) {
      const m = await createSimMachine(t(id).setup);
      await sh(m, 'ansible-playbook site.yml');
      expect(await passes(m, t(id).task)).toBe(false);
      write(m, `${OPS}/roles/${role}/tasks/main.yml`, text);
      await sh(m, 'ansible-playbook site.yml');
      expect(await passes(m, t(id).task)).toBe(true);
    }

    const m3 = await createSimMachine(t('shop').setup);
    write(m3, `${HOME}/app.yaml`, APP({}));
    await sh(m3, 'kubectl apply -n argocd -f ~/app.yaml', 'kubectl get pods -n shop');
    expect(await passes(m3, t('shop').task)).toBe(true);

    const m4 = await createSimMachine(t('contractor').setup);
    await sh(m4, 'ansible cp-1 -b -a "kubeadm token create --ttl 2h --description contractor-node"');
    expect(await passes(m4, t('contractor').task)).toBe(true);

    const m5 = await createSimMachine(t('cleanup').setup);
    expect(await passes(m5, t('cleanup').task)).toBe(false);
    await sh(m5, 'cd ~/infra', 'terraform destroy -auto-approve');
    expect(await passes(m5, t('cleanup').task)).toBe(true);
  });

  it('explainers: every break stops the chain where the tool stops', () => {
    const d = { workers: 2, forks: 3, run: 'first', serial: '1' };
    expect(codeModel.run(d, new Set()).at(-1)?.metrics?.ready).toBe(3);
    expect(codeModel.run(d, new Set(['swap'])).find((s) => s.broken)?.broken?.message).toMatch(/ERROR Swap/);
    expect(codeModel.run({ ...d, run: 'second' }, new Set()).at(-1)?.metrics?.changed).toBe(0);
    expect(codeModel.run({ ...d, run: 'second' }, new Set(['nocreates'])).some((s) => s.broken)).toBe(true);
    expect(codeModel.run({ ...d, run: 'rebuild' }, new Set(['stale-inventory'])).find((s) => s.broken)?.broken?.at).toBe('e-join1');
    expect(Math.min(...codeModel.run({ ...d, run: 'upgrade', serial: 'all' }, new Set()).map((s) => s.metrics?.replicas ?? 9))).toBe(0);
    expect(Math.min(...codeModel.run({ ...d, run: 'upgrade', serial: '1' }, new Set()).map((s) => s.metrics?.replicas ?? 9))).toBeGreaterThan(0);
    const g = { automated: true, selfHeal: true, prune: false, event: 'commit' };
    expect(gitopsModel.run(g, new Set()).at(-1)?.id).toBe('healthy');
    expect(gitopsModel.run({ ...g, event: 'edit', selfHeal: false }, new Set()).at(-1)?.metrics?.replicas).toBe(5);
    expect(gitopsModel.run({ ...g, event: 'delete', prune: true }, new Set()).some((s) => s.id === 'pruned')).toBe(true);
    expect(gitopsModel.run(g, new Set(['repo-down'])).some((s) => s.broken)).toBe(true);
  });
});
