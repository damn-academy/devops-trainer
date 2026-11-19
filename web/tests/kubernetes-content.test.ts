import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { lintRegistry } from '../src/core/lint';
import { registry } from '../src/core/registry';
import type { ProcessModel, Section, Task } from '../src/core/types';
import { createSimMachine, stripAnsi } from '../src/engine/terminal/shell';
import { lookupOrder } from '../src/blocks/kubernetes/explainers/ndots';
import { reconcilePlan } from '../src/blocks/kubernetes/explainers/reconcile';
import { rollout } from '../src/blocks/kubernetes/explainers/rolling';
import { schedule } from '../src/blocks/kubernetes/explainers/scheduler';
import { distribution, ruleProbabilities } from '../src/blocks/kubernetes/explainers/service-path';
import { nodeDownNumbers } from '../src/blocks/kubernetes/explainers/node-down';
import { fold } from '../src/engine/explainer/geometry';

const mine = (where: string) => /k8s|kubernetes/.test(where);

describe('the Kubernetes block content', () => {
  it('has no linter errors or warnings of its own', () => {
    const issues = lintRegistry(registry).filter((i) => mine(i.where));
    expect(issues.map((i) => `${i.level} ${i.where}: ${i.msg}`).join('\n')).toBe('');
  });

  it('has at least twelve quiz items and a placement for both blocks', () => {
    const items = [...registry.quiz.values()].filter((q) => q.id.startsWith('k8s.'));
    expect(items.length).toBeGreaterThanOrEqual(12);
    expect(new Set(items.map((q) => q.kind)).size).toBeGreaterThanOrEqual(7);
    expect(registry.blocks.get('k8s-1')!.placement.length).toBeGreaterThan(0);
    expect(registry.blocks.get('k8s-2')!.placement.length).toBeGreaterThan(0);
  });

  it('runs every explainer model for every knob value within the time budget', () => {
    const models = [...registry.explainers.values()].filter((e) => e.block.startsWith('k8s')).map((e) => e.model as ProcessModel<Record<string, unknown>>);
    expect(models.length).toBeGreaterThanOrEqual(9);
    for (const m of models) {
      const base = Object.fromEntries(m.params.map((p) => [p.id, p.default]));
      const variants: Record<string, unknown>[] = [base];
      for (const p of m.params) {
        const values = p.kind === 'toggle' ? [true, false] : p.kind === 'choice' ? (p.options ?? []).map((o) => o.id) : [p.min, p.max];
        for (const v of values) variants.push({ ...base, [p.id]: p.kind === 'choice' && typeof p.default === 'number' ? Number(v) : v });
      }
      for (const v of variants) {
        for (const br of [null, ...m.breaks.map((b) => b.id)]) {
          const t0 = performance.now();
          const steps = m.run(v, new Set(br ? [br] : []));
          expect(performance.now() - t0, `${m.id} run time`).toBeLessThan(50);
          expect(steps.length, `${m.id} ${JSON.stringify(v)} ${br}`).toBeGreaterThan(0);
          for (const s of steps) expect(s.caption.ru && s.caption.en, `${m.id}/${s.id}`).toBeTruthy();
        }
      }
    }
  });
});

describe('the Kubernetes explainers are built like the gold ones', () => {
  const models = [...registry.explainers.values()].filter((e) => e.block === 'k8s-1' || e.block === 'k8s-2').map((e) => e.model as ProcessModel<Record<string, unknown>>);
  const variantsOf = (m: ProcessModel<Record<string, unknown>>) => {
    const base = Object.fromEntries(m.params.map((p) => [p.id, p.default]));
    const out: Record<string, unknown>[] = [base];
    for (const p of m.params) {
      const values = p.kind === 'toggle' ? [true, false] : p.kind === 'choice' ? (p.options ?? []).map((o) => o.id) : [p.min, p.max];
      for (const v of values) out.push({ ...base, [p.id]: p.kind === 'choice' && typeof p.default === 'number' ? Number(v) : v });
    }
    return out;
  };
  for (const m of models) {
    it(`${m.id}: intro, legend, stop label, a small first picture and an actor with an icon at every step`, () => {
      expect(m.intro && m.legend?.length && m.stopLabel, m.id).toBeTruthy();
      const nodes = new Map(m.diagram.nodes.map((n) => [n.id, n]));
      const defaults = variantsOf(m)[0];
      const first = fold(m.run(defaults, new Set()), 0);
      expect(m.diagram.nodes.filter((n) => first.states[n.id] !== 'hidden').length, m.id).toBeLessThanOrEqual(5);
      let labelled = false;
      for (const [vi, v] of variantsOf(m).entries())
        for (const br of [null, ...m.breaks.map((b) => b.id)]) {
          const steps = m.run(v, new Set(br ? [br] : []));
          steps.forEach((st, i) => {
            const frame = fold(steps, i);
            const actors = Object.keys(st.say ?? {});
            const where = `${m.id} ${JSON.stringify(v)} ${br}/${st.id}`;
            expect(actors.length, where).toBeGreaterThan(0);
            for (const a of actors) {
              expect(nodes.get(a)?.icon, `${where}: ${a}`).toBeTruthy();
              expect(frame.states[a], `${where}: ${a} is hidden`).not.toBe('hidden');
            }
            for (const f of st.focus) expect(frame.states[f], `${where}: focus on hidden ${f}`).not.toBe('hidden');
            for (const tk of st.tokens ?? []) {
              expect(frame.states[tk.edge], `${where}: token on hidden ${tk.edge}`).not.toBe('hidden');
              if (tk.label) labelled = true;
            }
          });
          if (br && vi === 0) expect(steps.some((s) => s.broken), `${m.id} ${br}`).toBe(true);
        }
      expect(labelled, m.id).toBe(true);
    });
  }
});

describe('explainer arithmetic', () => {
  it('rolling update stays within maxUnavailable and finishes', () => {
    for (const [replicas, surge, unavailable] of [
      [4, 1, 1],
      [4, 1, 0],
      [4, 0, 1],
      [10, 3, 2],
      [1, 1, 0],
    ]) {
      const acts = rollout({ replicas, surge, unavailable, ready: 10, strategy: 'RollingUpdate', probe: true }, false);
      expect(acts[acts.length - 1].what).toBe('done');
      expect(Math.min(...acts.map((a) => a.available))).toBeGreaterThanOrEqual(replicas - unavailable);
      expect(Math.max(...acts.map((a) => a.oldR + a.newR))).toBeLessThanOrEqual(replicas + surge);
    }
    expect(rollout({ replicas: 4, surge: 0, unavailable: 0, ready: 10, strategy: 'RollingUpdate', probe: true }, false)[0].what).toBe('invalid');
    expect(Math.min(...rollout({ replicas: 4, surge: 1, unavailable: 1, ready: 10, strategy: 'Recreate', probe: true }, false).map((a) => a.available))).toBe(0);
    expect(rollout({ replicas: 4, surge: 1, unavailable: 1, ready: 10, strategy: 'RollingUpdate', probe: true }, true).pop()!.what).toBe('stuck');
  });

  it('kube-proxy probabilities give equal shares', () => {
    expect(ruleProbabilities(3).map((x) => x.toFixed(2))).toEqual(['0.33', '0.50', '1.00']);
    expect(distribution(3, false).reduce((a, b) => a + b, 0)).toBe(100);
    expect(distribution(3, true)).toEqual([100, 0, 0]);
  });

  it('ndots walks the search list before the name as is', () => {
    expect(lookupOrder('api.github.com', 5).tries).toEqual(['api.github.com.shop.svc.cluster.local', 'api.github.com.svc.cluster.local', 'api.github.com.cluster.local', 'api.github.com']);
    expect(lookupOrder('api.github.com', 2).tries).toEqual(['api.github.com']);
    expect(lookupOrder('api.github.com.', 5).tries).toEqual(['api.github.com']);
    expect(lookupOrder('web', 5).answer).toBe('web.shop.svc.cluster.local');
  });

  it('the scheduler spreads pods and reports what does not fit', () => {
    const r = schedule({ memory: 512, cpu: 250, replicas: 3, selector: false, taint: false, image: false });
    expect(new Set(r.placements).size).toBeGreaterThan(1);
    expect(schedule({ memory: 4096, cpu: 250, replicas: 1, selector: false, taint: false, image: false }).placements).toEqual([null]);
    expect(schedule({ memory: 512, cpu: 250, replicas: 1, selector: true, taint: false, image: false }).placements).toEqual(['worker-3']);
  });

  it('reconcile and node failure numbers', () => {
    expect(reconcilePlan({ replicas: 3, event: 'delete', paused: false }).created).toBe(1);
    expect(reconcilePlan({ replicas: 3, event: 'foreign', paused: false }).deleted).toBe(1);
    expect(reconcilePlan({ replicas: 3, event: 'image', paused: false }).created).toBe(0);
    expect(reconcilePlan({ replicas: 3, event: 'delete', paused: true }).reconciles).toBe(1);
    expect(nodeDownNumbers({ grace: 50, toleration: 300, back: 'never' }, false).recovered).toBe(355);
    expect(nodeDownNumbers({ grace: 20, toleration: 300, back: 'never' }, false).lost).toBeLessThan(nodeDownNumbers({ grace: 50, toleration: 300, back: 'never' }, false).lost);
  });
});

/** The reference solutions of the labs: each one must pass its own check on a fresh machine. */
const SOLUTIONS: Record<string, string[]> = {
  'k8s-1.first-pod/lab/apply': ['kubectl apply -f pod.yaml', 'cluster ff 10s', 'kubectl get pods'],
  'k8s-1.first-pod/lab/dryrun': ['kubectl run api --image=trainer/web:1.1 --dry-run=client -o yaml > api.yaml'],
  'k8s-1.first-pod/lab/delete': ['kubectl apply -f pod.yaml', 'cluster ff 5s', 'kubectl delete pod web'],
  'k8s-1.deployments/lab/undo': ['kubectl apply -f web.yaml', 'cluster ff 20s', 'kubectl set image deployment/web web=trainer/web:1.1', 'kubectl rollout status deployment/web', 'kubectl set image deployment/web web=trainer/web:2.0', 'cluster ff 30s', 'kubectl rollout undo deployment/web --to-revision=2', 'kubectl rollout status deployment/web'],
  'k8s-1.reconcile/lab/orphan': ['kubectl apply -f rs.yaml', 'kubectl scale rs web --replicas=5', 'cluster ff 10s', "kubectl label pod $(kubectl get pods -o jsonpath='{.items[0].metadata.name}') app=debug --overwrite", 'cluster ff 5s'],
  'k8s-1.reconcile/lab/apply': ['kubectl apply -f rs.yaml', 'cluster ff 10s'],
  'k8s-1.reconcile/lab/scale': ['kubectl apply -f rs.yaml', 'kubectl scale rs web --replicas=5', 'cluster ff 10s'],
  'k8s-1.deployments/lab/image': ['kubectl apply -f web.yaml', 'cluster ff 20s', 'kubectl set image deployment/web web=trainer/web:1.1', 'kubectl rollout status deployment/web'],
  'k8s-1.architecture/lab/failover': ['cluster power off worker-2', 'cluster ff 6m', 'kubectl get pods -o wide'],
  'k8s-1.architecture/lab/pending': ['kubectl apply -f big.yaml', 'cluster ff 3s', 'kubectl describe pod big | grep FailedScheduling > reason.txt'],
  'k8s-1.network/lab/cidr': ["kubectl get node worker-1 -o jsonpath='{.spec.podCIDR}' > cidr.txt"],
  'k8s-1.services/lab/expose': ['kubectl expose deployment web --port=80', 'cluster ff 5s'],
  'k8s-1.services/lab/curl': ['kubectl expose deployment web --port=80', 'cluster ff 5s', 'kubectl exec client -- curl -s http://web'],
  'k8s-1.services/lab/rule': ['kubectl expose deployment web --port=80', 'cluster ff 5s', 'cluster iptables worker-1 | grep "default/web cluster IP" | grep KUBE-SERVICES > rule.txt'],
  'k8s-1.services/lab/affinity': ['kubectl expose deployment web --port=80', 'kubectl patch service web -p \'{"spec":{"sessionAffinity":"ClientIP"}}\''],
  'k8s-1.services/broken/fix': ['kubectl -n prod patch svc api -p \'{"spec":{"selector":{"app":"api-v2"}}}\'', 'cluster ff 3s'],
  'k8s-1.dns/lab/other-ns': ['kubectl -n shop exec client -- curl -s http://api.prod'],
  'k8s-1.ingress/lab/pf': ['kubectl port-forward svc/web 8080:80', 'cluster open http://localhost:8080/'],
  'k8s-1.troubleshoot/lab/web': ['kubectl -n shop patch svc web -p \'{"spec":{"ports":[{"port":80,"targetPort":80}]}}\'', 'cluster ff 3s'],
  'k8s-1.troubleshoot/lab/pay': ['kubectl -n shop label pod client role=frontend', 'cluster ff 2s'],
  'k8s-1.config/lab/cm': ['kubectl create configmap web-config --from-env-file=app.env'],
  'k8s-1.config/lab/env': ['kubectl create configmap web-config --from-env-file=app.env', 'kubectl apply -f web-env.yaml', 'cluster ff 10s', 'kubectl exec deploy/web -- printenv GREETING'],
  'k8s-1.health/lab/previous': ['cluster ff 30s', 'kubectl logs crash --previous --tail=1 > crash.txt'],
  'k8s-1.health/lab/ready': ['kubectl patch deploy shop -p \'{"spec":{"template":{"spec":{"containers":[{"name":"shop","readinessProbe":{"httpGet":{"port":80}}}]}}}}\'', 'kubectl rollout status deploy/shop', 'cluster ff 20s'],
  'k8s-1.health/lab/oom': ['kubectl apply -f hog.yaml', 'cluster ff 5s', 'echo 137 > exit.txt'],
  'k8s-1.operators/lab/crd': ['kubectl apply -f website-crd.yaml', 'kubectl apply -f blog.yaml', 'kubectl get websites'],
};

/** Tasks that must not pass on a fresh machine before the learner did anything. */
describe('lab checks are not true from the start', () => {
  const sections = [...registry.lessons.values()].filter((l) => l.block.startsWith('k8s')).flatMap((l) => l.sections.map((s) => ({ l, s })));
  for (const { l, s } of sections) {
    if (s.kind !== 'terminal') continue;
    it(`${l.id}/${s.id}`, async () => {
      const m = await createSimMachine(s.setup);
      const f = await m.facts();
      for (const t of s.tasks) expect(evaluateCheck(t.check, f, f).pass, `${l.id}/${s.id}/${t.id}`).toBe(false);
    });
  }
});

describe('lab reference solutions pass their checks', () => {
  const sections = [...registry.lessons.values()].flatMap((l) => l.sections.map((s) => ({ l, s })));
  for (const [key, lines] of Object.entries(SOLUTIONS)) {
    it(key, async () => {
      const [lessonId, sectionId, taskId] = key.split('/');
      const found = sections.find((x) => x.l.id === lessonId && x.s.id === sectionId);
      expect(found, key).toBeTruthy();
      const s = found!.s as Section & { kind: 'terminal' };
      const task = s.tasks.find((t: Task) => t.id === taskId)!;
      const m = await createSimMachine(s.setup);
      const start = await m.facts();
      let last = '';
      for (const line of lines) last = stripAnsi((await m.exec(line)).out);
      const r = evaluateCheck(task.check, await m.facts(), start);
      expect(r.pass, `${key}\n${last}`).toBe(true);
    });
  }
});
