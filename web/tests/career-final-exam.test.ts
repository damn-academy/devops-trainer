// Block 11: the on-call exam and the final exam on the stands are solvable,
// and every pool variant can be fixed the way its prompt asks.

import { describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { evaluateCheck } from '../src/core/check';
import { lintRegistry } from '../src/core/lint';
import type { Exam, Facts, Task } from '../src/core/types';
import { createSimMachine, type SimMachine } from '../src/engine/terminal/shell';
import { APP, DEPLOYMENT, INFRA, OPS } from '../src/blocks/k8s-code/content/setups';

const HOME = '/home/learner';
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
type TaskOf = Extract<Exam['tasks'][number], { kind: 'task' }>;
const task = (exam: string, id: string) => (registry.exams.get(exam) as Exam).tasks.find((x) => x.id === id) as TaskOf;

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

async function revertRelease(m: SimMachine): Promise<void> {
  await sh(m, 'cd ~/shop-deploy', 'git revert --no-edit HEAD', 'git push', 'kubectl get pods -n shop', 'kubectl get pods -n shop');
}

describe('block 11 exams', () => {
  it('the final block has its exams and no lint errors of its own', () => {
    const issues = lintRegistry(registry).filter((i) => i.level === 'error' && /final/.test(i.where));
    expect(issues.map((i) => `${i.where}: ${i.msg}`).join('\n')).toBe('');
    expect(registry.blocks.get('final')?.exam).toBe('final.exam.capstone');
    expect(registry.exams.get('final.exam.oncall')?.hardTimer).toBe(true);
  });

  it('on-call: the broken release is rolled back through Git, the node is brought back', async () => {
    const t = task('final.exam.oncall', 'checkout');
    const m = await createSimMachine(t.setup);
    await sh(m, 'kubectl get pods -n shop');
    expect(await passes(m, t.task)).toBe(false);
    await revertRelease(m);
    expect(await passes(m, t.task)).toBe(true);
    const n = task('final.exam.oncall', 'node');
    const m2 = await createSimMachine(n.setup);
    expect(await passes(m2, n.task)).toBe(false);
    await sh(m2, 'ansible worker-2 -b -m ansible.builtin.service -a "name=kubelet state=started"');
    expect(await passes(m2, n.task)).toBe(true);
  });

  it('capstone A: cluster from code, release, ssh, tag pin', async () => {
    const a1 = task('final.exam.capstone', 'a1-cluster');
    const m1 = await createSimMachine(a1.setup);
    await sh(m1, 'cd ~/infra', 'terraform init', 'terraform apply -auto-approve');
    await inventory(m1);
    await sh(m1, 'cd ~/ops', 'ansible-playbook site.yml', 'ansible-playbook site.yml');
    expect(await passes(m1, a1.task)).toBe(true);

    const a2 = task('final.exam.capstone', 'a2-release');
    const m2 = await createSimMachine(a2.setup);
    write(m2, `${HOME}/shop-deploy/k8s/deployment.yaml`, DEPLOYMENT('trainer/web:1.1', 3));
    await sh(m2, 'git commit -a -m "shop 1.1 x3"', 'git push', 'kubectl get pods -n shop', 'kubectl get pods -n shop');
    expect(await passes(m2, a2.task)).toBe(true);

    const a3 = task('final.exam.capstone', 'a3-ssh');
    const m3 = await createSimMachine(a3.setup);
    expect(await passes(m3, a3.task)).toBe(false);
    await sh(m3, "ansible all -b -m ansible.builtin.lineinfile -a \"path=/etc/ssh/sshd_config regexp='^PasswordAuthentication' line='PasswordAuthentication no'\"");
    expect(await passes(m3, a3.task)).toBe(true);

    const a5 = task('final.exam.capstone', 'a5-pin');
    const m5 = await createSimMachine(a5.setup);
    await sh(m5, 'git tag v1.1', 'git push origin v1.1');
    write(m5, `${HOME}/app.yaml`, APP({ selfHeal: true, prune: true }).replace('targetRevision: main', 'targetRevision: v1.1'));
    await sh(m5, 'kubectl apply -n argocd -f ~/app.yaml', 'kubectl get pods -n shop');
    expect(await passes(m5, a5.task)).toBe(true);
  });

  it('capstone B: both faults of the pool, and the cleanup', async () => {
    const b1 = task('final.exam.capstone', 'b-node');
    const m1 = await createSimMachine(b1.setup);
    expect(await passes(m1, b1.task)).toBe(false);
    await sh(m1, 'ansible workers -b -m ansible.builtin.service -a "name=kubelet state=started"');
    expect(await passes(m1, b1.task)).toBe(true);

    const b2 = task('final.exam.capstone', 'b-release');
    const m2 = await createSimMachine(b2.setup);
    expect(await passes(m2, b2.task)).toBe(false);
    await revertRelease(m2);
    expect(await passes(m2, b2.task)).toBe(true);

    const d = task('final.exam.capstone', 'd-cleanup');
    const m3 = await createSimMachine(d.setup);
    await sh(m3, 'cd ~/infra', 'terraform destroy -auto-approve');
    expect(await passes(m3, d.task)).toBe(true);
  });
});
