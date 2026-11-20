// Reference solutions for the labs added to the Kubernetes block in the second
// fix round (data, scaling, the way in through a controller), and the
// rollout lab whose broken image must leave the old pods answering.

import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { registry } from '../src/core/registry';
import type { Section, Task } from '../src/core/types';
import { createSimMachine, stripAnsi } from '../src/engine/terminal/shell';

const PATCH_CPU = `kubectl patch deployment web -p '{"spec":{"template":{"spec":{"containers":[{"name":"web","resources":{"requests":{"cpu":"100m"}}}]}}}}'`;

const SOLUTIONS: Record<string, string[]> = {
  'k8s-1.storage/lab/sc': ['kubectl get storageclass'],
  'k8s-1.storage/lab/survive': ['kubectl delete pod -l app=db', 'cluster ff 20s', 'kubectl get pods,pvc'],
  'k8s-1.storage/lab/pending': ['kubectl delete pvc reports', "sed -i 's/storageClassName: fast/storageClassName: csi-hostpath-sc/' reports.yaml", 'kubectl apply -f reports.yaml', 'cluster ff 30s'],
  'k8s-1.scaling/lab/top': ['kubectl top pods'],
  'k8s-1.scaling/lab/unknown': ['kubectl apply -f hpa.yaml', 'cluster ff 30s', PATCH_CPU, 'cluster ff 1m', 'kubectl get hpa'],
  'k8s-1.scaling/lab/load': ['kubectl apply -f hpa.yaml', PATCH_CPU, 'cluster ff 1m', 'cluster load web 300m', 'cluster ff 2m', 'kubectl get hpa,deploy'],
  'k8s-1.ingress/lab-gw/route': ['kubectl apply -f route.yaml', "sed -i 's/shop-gateway/traefik-gateway/' route.yaml", 'kubectl apply -f route.yaml', 'cluster ff 5s', 'cluster curl -sS http://shop.example/'],
  'k8s-1.ingress/lab-gw/class': ['kubectl apply -f blog.yaml', `kubectl patch ingress blog --type=merge -p '{"spec":{"ingressClassName":"traefik"}}'`, 'cluster ff 5s', 'cluster curl -sS http://blog.example/'],
  'k8s-1.deployments/lab/broken': ['kubectl apply -f web.yaml', 'cluster ff 30s', 'kubectl set image deployment/web web=trainer/web:2.0', 'cluster ff 60s', 'kubectl get rs,pods'],
};

/** Wrong ways that must not pass. */
const WRONG: Record<string, string[]> = {
  'k8s-1.storage/lab/pending': ['kubectl delete deployment reports', 'kubectl delete pvc reports', "sed -i 's/storageClassName: fast/storageClassName: csi-hostpath-sc/' reports.yaml", 'kubectl apply -f reports.yaml', 'cluster ff 30s'],
  'k8s-1.storage/lab/survive': ['kubectl delete deployment db', 'kubectl delete pvc data', 'kubectl apply -f db.yaml', 'cluster ff 30s'],
  'k8s-1.ingress/lab-gw/route': ['kubectl apply -f route.yaml', 'cluster ff 5s', 'cluster curl -sS http://shop.example/'],
};

const sections = [...registry.lessons.values()].flatMap((l) => l.sections.map((s) => ({ l, s })));
const find = (key: string) => {
  const [lessonId, sectionId, taskId] = key.split('/');
  const found = sections.find((x) => x.l.id === lessonId && x.s.id === sectionId);
  expect(found, key).toBeTruthy();
  const s = found!.s as Section & { kind: 'terminal' };
  return { s, task: s.tasks.find((t: Task) => t.id === taskId)! };
};
const run = async (key: string, lines: string[]) => {
  const { s, task } = find(key);
  const m = await createSimMachine(s.setup);
  const start = await m.facts();
  let last = '';
  for (const line of lines) last = stripAnsi((await m.exec(line)).out);
  return { r: evaluateCheck(task.check, await m.facts(), start), last };
};

describe('round-two lab reference solutions pass their checks', () => {
  for (const [key, lines] of Object.entries(SOLUTIONS))
    it(key, async () => {
      const { r, last } = await run(key, lines);
      expect(r.pass, `${key}\n${last}`).toBe(true);
    });
});

describe('round-two labs refuse the wrong ways', () => {
  for (const [key, lines] of Object.entries(WRONG))
    it(key, async () => {
      const { r, last } = await run(key, lines);
      expect(r.pass, `${key}\n${last}`).toBe(false);
    });
});

describe('the rollout lab keeps the old pods when the new image crashes', () => {
  it('stops at three old ready pods and two crashing new ones', async () => {
    const { s } = find('k8s-1.deployments/lab/broken');
    const m = await createSimMachine(s.setup);
    for (const line of ['kubectl apply -f web.yaml', 'cluster ff 30s', 'kubectl set image deployment/web web=trainer/web:2.0', 'cluster ff 90s']) await m.exec(line);
    const out = stripAnsi((await m.exec('kubectl get rs')).out);
    const rows = out.trim().split('\n').slice(1).map((l) => l.split(/\s+/));
    const ready = rows.map((r) => Number(r[3])).sort();
    expect(ready, out).toEqual([0, 3]);
  });
});

describe('the constructor grows along the stage', () => {
  const layersOf = (lessonId: string) =>
    registry.lessons.get(lessonId)!.sections.filter((s) => s.kind === 'widget' && s.widget === 'k8s.constructor').map((s) => ((s as { props?: { layers?: unknown } }).props?.layers ?? 'core'));
  it('adds traffic in, storage and metrics in their lessons and everything in the wrap-up', () => {
    expect(layersOf('k8s-1.architecture')).toEqual(['core']);
    expect(layersOf('k8s-1.ingress')).toEqual([['cp', 'node', 'net', 'ingress']]);
    expect(layersOf('k8s-1.storage')).toEqual([['cp', 'node', 'net', 'ingress', 'storage']]);
    expect(layersOf('k8s-1.scaling')).toEqual([['cp', 'node', 'net', 'ingress', 'storage', 'metrics']]);
    expect(layersOf('k8s-1.addons')).toEqual(['all']);
  });
});
