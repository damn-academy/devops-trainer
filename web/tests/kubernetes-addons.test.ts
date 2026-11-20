// Cluster add-ons in kube-lite and the layered constructor (05 §6.2): each
// add-on works only while it is installed and its pod runs, and every
// constructor scenario shows its real symptom without the component it needs.

import { describe, expect, it } from 'vitest';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import { createSimMachine, stripAnsi, type SimMachine } from '../src/engine/terminal/shell';
import kubeModule from '../src/engine/kube-lite/module';
import { ADDON_IDS, outsideHttp, type AddonId } from '../src/engine/kube-lite/addons';
import { Cluster } from '../src/engine/kube-lite/cluster';
import { k8sState } from '../src/engine/kube-lite/state';
import { ALL_LAYERS, COMPONENTS, CORE_LAYERS, SCENARIOS, WIRES, comp, componentsFrom, key, lacks, runScenario, type CanvasState } from '../src/engine/kube-lite/ui/constructor-model';

const reg = createTerminalRegistry();
for (const c of [...BUILTINS, ...BASIC_COMMANDS]) reg.commands.add(c);
for (const c of kubeModule.commands ?? []) reg.commands.add(c);
reg.setup.push(...(kubeModule.setup ?? []));

const mk = (addons: AddonId[] = ADDON_IDS, extra: Record<string, unknown> = {}) => createSimMachine({ ext: { k8s: { addons, ...extra } } }, { registry: reg });
const run = async (m: SimMachine, line: string) => {
  const r = await m.exec(line);
  return stripAnsi(r.out);
};
const file = (m: SimMachine, name: string, text: string) => {
  const u = m.users.find((x) => x.name === 'learner')!;
  m.rootFs.writeFile(`${u.home}/${name}`, text);
  m.rootFs.chown(`${u.home}/${name}`, u.uid, u.gid);
};
const without = (id: AddonId) => ADDON_IDS.filter((x) => x !== id);

const LB = `apiVersion: v1
kind: Service
metadata:
  name: lb
spec:
  type: LoadBalancer
  selector:
    app: web
  ports:
  - port: 80
`;

describe('add-ons in kube-lite', () => {
  it('MetalLB gives a LoadBalancer Service an office address; without it EXTERNAL-IP stays <pending>', async () => {
    for (const [addons, want] of [
      [ADDON_IDS, '192.168.56.241'],
      [without('metallb'), '<pending>'],
    ] as const) {
      const m = await mk([...addons]);
      file(m, 'lb.yaml', LB);
      await run(m, 'kubectl apply -f lb.yaml');
      await run(m, 'cluster ff 5s');
      expect(await run(m, 'kubectl get svc lb')).toContain(want);
      m.dispose();
    }
  });

  it('a plain cluster keeps the k3s behaviour: node addresses for LoadBalancer and Ingress', async () => {
    const m = await createSimMachine({ ext: { k8s: {} } }, { registry: reg });
    file(m, 'lb.yaml', LB);
    await run(m, 'kubectl apply -f lb.yaml');
    expect(await run(m, 'kubectl get svc lb')).toContain('192.168.56.11');
    expect(await run(m, 'kubectl top pods')).toContain('Metrics API not available');
    m.dispose();
  });

  it('Traefik routes an HTTPRoute by host; without it the Gateway API kinds do not exist', async () => {
    const sc = SCENARIOS.find((s) => s.id === 'outside')!;
    const m = await mk();
    file(m, 'shop.yaml', sc.files!['shop.yaml']);
    await run(m, 'kubectl apply -f shop.yaml');
    await run(m, 'cluster ff 30s');
    expect(await run(m, 'cluster curl -sS http://shop.example/')).toMatch(/Hello from shop-/);
    expect(await run(m, 'cluster curl -sS http://other.example/')).toContain('404 page not found');
    const c = k8sState(m).cluster!;
    expect(outsideHttp(c, 'http://shop.example/').trace.join('\n')).toContain('HTTPRoute shop');
    m.dispose();
    const bare = await mk(without('traefik'));
    file(bare, 'shop.yaml', sc.files!['shop.yaml']);
    const out = await bare.exec('kubectl apply -f shop.yaml');
    expect(stripAnsi(out.out)).toContain('no matches for kind "HTTPRoute" in version "gateway.networking.k8s.io/v1"');
    bare.dispose();
  });

  it('a CSI driver binds a PVC; without a StorageClass the claim and its pod stay Pending', async () => {
    const db = SCENARIOS.find((s) => s.id === 'disk')!.files!['db.yaml'];
    const m = await mk();
    file(m, 'db.yaml', db);
    await run(m, 'kubectl apply -f db.yaml');
    await run(m, 'cluster ff 30s');
    const changedClass = await m.exec(`kubectl patch pvc data -p '{"spec":{"storageClassName":"other"}}'`);
    expect(changedClass.exit).not.toBe(0);
    expect(changedClass.out).toContain('immutable');
    expect(await run(m, 'kubectl get pvc data')).toMatch(/data\s+Bound\s+pvc-/);
    expect(await run(m, 'kubectl get pv')).toContain('default/data');
    expect(await run(m, 'kubectl get pods -l app=db')).toContain('Running');
    m.dispose();
    const bare = await mk(without('csi-hostpath'));
    file(bare, 'db.yaml', db);
    await run(bare, 'kubectl apply -f db.yaml');
    await run(bare, 'cluster ff 30s');
    expect(await run(bare, 'kubectl get pvc data')).toMatch(/data\s+Pending/);
    expect(await run(bare, 'kubectl get events')).toContain('no persistent volumes available for this claim and no storage class is set');
    expect(await run(bare, 'kubectl get events --field-selector reason=FailedScheduling')).toContain('0/3 nodes are available: pod has unbound immediate PersistentVolumeClaims. preemption: 0/3 nodes are available: 3 Preemption is not helpful for scheduling.');
    bare.dispose();
  });

  it('a StorageClass without its running driver: ExternalProvisioning, the claim waits', async () => {
    const m = await mk();
    const c = k8sState(m).cluster!;
    const d = c.get('Deployment', 'kube-system', 'csi-hostpathplugin')!;
    c.put({ ...d, spec: { ...d.spec, replicas: 0 } });
    c.advance(5000);
    file(m, 'db.yaml', SCENARIOS.find((s) => s.id === 'disk')!.files!['db.yaml']);
    await run(m, 'kubectl apply -f db.yaml');
    await run(m, 'cluster ff 30s');
    const changedClass = await m.exec(`kubectl patch pvc data -p '{"spec":{"storageClassName":"other"}}'`);
    expect(changedClass.exit).not.toBe(0);
    expect(changedClass.out).toContain('immutable');
    expect(await run(m, 'kubectl get pvc data')).toMatch(/Pending\s+csi-hostpath-sc/);
    expect(await run(m, 'kubectl get events')).toContain("Waiting for a volume to be created either by the external provisioner 'hostpath.csi.k8s.io'");
    m.dispose();
  });

  it('cert-manager issues the Gateway certificate; without it Traefik serves a self-signed one', async () => {
    const sc = SCENARIOS.find((s) => s.id === 'https')!;
    for (const addons of [ADDON_IDS, without('cert-manager')]) {
      const m = await mk(addons);
      for (const [n, t] of Object.entries(sc.files!)) file(m, n, t);
      await run(m, 'kubectl apply -f gateway-tls.yaml');
      await run(m, 'kubectl apply -f shop.yaml');
      await run(m, 'cluster ff 1m');
      const r = await m.exec('cluster curl -sS https://shop.example/');
      if (addons === ADDON_IDS) {
        expect(await run(m, 'kubectl -n traefik get certificate')).toMatch(/shop-tls\s+True\s+shop-tls/);
        expect(await run(m, 'kubectl -n traefik get secret shop-tls')).toContain('kubernetes.io/tls');
        expect(stripAnsi(r.out)).toMatch(/Hello from shop-/);
      } else {
        expect(await run(m, 'kubectl get certificate')).toContain('error: the server doesn\'t have a resource type "certificate"');
        expect(stripAnsi(r.out)).toContain('curl: (60) SSL certificate problem: self-signed certificate');
        expect(stripAnsi((await m.exec('cluster curl -sSk https://shop.example/')).out)).toMatch(/Hello from shop-/);
      }
      m.dispose();
    }
  });

  it('metrics-server serves kubectl top and lets the HPA scale; without it TARGETS is <unknown>', async () => {
    const hpa = SCENARIOS.find((s) => s.id === 'hpa')!.files!['web-hpa.yaml'];
    for (const addons of [ADDON_IDS, without('metrics-server')]) {
      const m = await mk(addons);
      file(m, 'hpa.yaml', hpa);
      await run(m, 'kubectl apply -f hpa.yaml');
      await run(m, 'cluster ff 1m');
      await run(m, 'cluster load web 250m');
      await run(m, 'cluster ff 2m');
      const top = await run(m, 'kubectl top nodes');
      const h = await run(m, 'kubectl get hpa web');
      if (addons === ADDON_IDS) {
        expect(top).toMatch(/NAME\s+CPU\(cores\)\s+CPU\(%\)\s+MEMORY\(bytes\)\s+MEMORY\(%\)/);
        expect(h).toMatch(/cpu: \d+%\/50%\s+1\s+5\s+5/);
        expect(await run(m, 'kubectl get events --field-selector reason=SuccessfulRescale')).toContain('cpu resource utilization (percentage of request) above target');
      } else {
        expect(top).toContain('error: Metrics API not available');
        expect(h).toMatch(/cpu: <unknown>\/50%\s+1\s+5\s+1/);
        expect(await run(m, 'kubectl get events')).toContain('the server could not find the requested resource (get pods.metrics.k8s.io)');
      }
      m.dispose();
    }
  });

  it('Flux applies a push, reverts manual drift and prunes what left Git; without it Git changes nothing', async () => {
    const web = SCENARIOS.find((s) => s.id === 'gitops')!.files!['web.yaml'];
    const m = await mk();
    file(m, 'web.yaml', web);
    expect(await run(m, 'cluster git push web.yaml -m "web: three replicas"')).toContain('create mode 100644 apps/web.yaml');
    await run(m, 'cluster ff 2m');
    expect(await run(m, 'kubectl get deploy web')).toMatch(/web\s+3\/3/);
    await run(m, 'kubectl scale deploy web --replicas=1');
    await run(m, 'cluster ff 6m');
    expect(await run(m, 'kubectl get deploy web')).toMatch(/web\s+3\/3/);
    expect(await run(m, 'kubectl get kustomization -n flux-system')).toMatch(/apps\s+\S+\s+True\s+Applied revision: main@sha1:[0-9a-f]{40}/);
    await run(m, 'cluster git rm web.yaml -m "web: retire"');
    await run(m, 'cluster ff 2m');
    const gone = await m.exec('kubectl get deploy web');
    expect(stripAnsi(gone.out)).toContain('deployments.apps "web" not found');
    m.dispose();
    const bare = await mk(without('flux'));
    file(bare, 'web.yaml', web);
    await run(bare, 'cluster git push web.yaml -m "web: three replicas"');
    await run(bare, 'cluster ff 2m');
    expect(await run(bare, 'kubectl get deploy web')).toContain('Error from server (NotFound): deployments.apps "web" not found');
    bare.dispose();
  });

  it('Prometheus fires KubePodCrashLooping only with kube-state-metrics; node-exporter adds node targets', async () => {
    const res: Record<string, string> = {};
    for (const [name, addons] of [
      ['all', ADDON_IDS],
      ['no-ksm', without('kube-state-metrics')],
      ['no-ne', without('node-exporter')],
    ] as const) {
      const m = await mk([...addons]);
      await run(m, 'kubectl create deployment pay --image=trainer/web:2.0');
      await run(m, 'kubectl run client --image=trainer/client:1.0');
      await run(m, 'cluster ff 20m');
      res[name] = (await run(m, 'kubectl exec client -- curl -sS http://prometheus.monitoring:9090/api/v1/alerts')) + (await run(m, 'kubectl exec client -- curl -sS http://prometheus.monitoring:9090/api/v1/targets'));
      m.dispose();
    }
    expect(res.all).toContain('"alertname":"KubePodCrashLooping"');
    expect(res.all).toContain('"state":"firing"');
    expect(res.all).toContain('"job":"node-exporter"');
    expect(res['no-ksm']).toContain('"alertname":"Watchdog"');
    expect(res['no-ksm']).not.toContain('KubePodCrashLooping');
    expect(res['no-ne']).not.toContain('"job":"node-exporter"');
  });

  it('Cilium routes Services without kube-proxy', async () => {
    const m = await mk([], { components: { 'kube-proxy': false }, proxyReplacement: true });
    await run(m, 'kubectl create deployment web --image=trainer/web:1.0 --replicas=2 --port=80');
    await run(m, 'kubectl expose deployment web --port=80');
    await run(m, 'kubectl run client --image=trainer/client:1.0');
    await run(m, 'cluster ff 30s');
    expect(await run(m, 'kubectl exec client -- curl -sS http://web')).toMatch(/Hello from web-/);
    m.dispose();
  });

  it('the add-on state survives a snapshot and restore', async () => {
    const c = new Cluster({ addons: ADDON_IDS });
    c.advance(5000);
    const snap = c.snapshot();
    const d = new Cluster();
    d.restore(snap);
    expect(d.addons?.installed).toEqual(ADDON_IDS);
    expect(d.list('Gateway').length).toBe(1);
  });
});

const FULL: CanvasState = { placed: COMPONENTS.map((c) => c.id), wires: WIRES.map((w) => key(w.a, w.b)), cni: 'calico' };
const drop = (ids: string[], st: CanvasState = FULL): CanvasState => ({ ...st, placed: st.placed.filter((p) => !ids.includes(p)) });

describe('the layered constructor model', () => {
  it('a layer switched off counts as removed, with its blocks still on the canvas', () => {
    expect(componentsFrom(FULL, ALL_LAYERS).missing).toEqual([]);
    const off = componentsFrom({ ...FULL, off: ['ingress'] }, ALL_LAYERS);
    expect(off.addons).not.toContain('traefik');
    expect(off.missing).toEqual(['metallb', 'traefik']);
    expect(componentsFrom({ ...FULL, off: ['cp'] }, ALL_LAYERS).components.apiserver).toBe(false);
    // The core view ignores add-ons entirely.
    expect(componentsFrom(drop(['metallb'])).missing).toEqual([]);
    expect(CORE_LAYERS).toEqual(['cp', 'node', 'net']);
  });
  it('the CNI variant decides NetworkPolicy and the kube-proxy replacement', () => {
    const flannel = componentsFrom({ ...FULL, cni: 'flannel' }, ALL_LAYERS);
    expect(flannel.components.netpol).toBe(false);
    expect(lacks(flannel, 'netpol')).toBe(true);
    const cilium = componentsFrom(drop(['kube-proxy'], { ...FULL, cni: 'cilium' }), ALL_LAYERS);
    expect(cilium.proxyReplacement).toBe(true);
    expect(lacks(cilium, 'kube-proxy')).toBe(false);
    expect(lacks(componentsFrom(drop(['kube-proxy']), ALL_LAYERS), 'kube-proxy')).toBe(true);
  });
  it('every component card has its answers and an https documentation link', () => {
    for (const c of COMPONENTS) {
      for (const f of ['what', 'who', 'talks', 'hands', 'without', 'cause'] as const) expect(c[f].ru.length, `${c.id}.${f}`).toBeGreaterThan(20);
      expect(c.doc).toMatch(/^https:\/\//);
    }
  });
});

/** Per scenario: what the output shows with everything on, and per removed component what it shows then. */
const SYMPTOMS: Record<string, { ok: RegExp; drops: [string, RegExp][] }> = {
  apply: { ok: /3\/3/, drops: [['scheduler', /Pending/], ['controller-manager', /0\/3/]] },
  delete: { ok: /Running/, drops: [['controller-manager', /No resources found|Terminating/]] },
  node: { ok: /worker-2\s+NotReady/, drops: [['kubelet', /NotReady/]] },
  service: { ok: /Hello from web-[\s\S]*Hello from web-/, drops: [['coredns', /Could not resolve host: web/], ['kube-proxy', /curl: \(28\)/]] },
  netpol: { ok: /Hello from api-[\s\S]*Connection timed out after 5002 milliseconds/, drops: [['netpol', /Hello from api-[\s\S]*\$ kubectl exec client[^\n]*\nHello from api-/]] },
  outside: { ok: /Hello from shop-/, drops: [['traefik', /no matches for kind "HTTPRoute"[\s\S]*curl: \(7\) Failed to connect to shop.example port 80/], ['metallb', /<pending>[\s\S]*curl: \(7\)/], ['scheduler', /no available server/]] },
  https: { ok: /shop-tls\s+True[\s\S]*Hello from shop-/, drops: [['cert-manager', /doesn't have a resource type "certificate"[\s\S]*curl: \(60\) SSL certificate problem: self-signed certificate/]] },
  disk: { ok: /Bound[\s\S]*Running/, drops: [['csi-hostpath', /Pending[\s\S]*no storage class is set/]] },
  hpa: { ok: /cpu: \d+%\/50%\s+1\s+5\s+5/, drops: [['metrics-server', /error: Metrics API not available[\s\S]*cpu: <unknown>\/50%/], ['controller-manager', /deployment.apps\/web created[\s\S]*web\s+0\/1/]] },
  gitops: { ok: /web\s+3\/3[\s\S]*scaled[\s\S]*web\s+3\/3/, drops: [['flux', /doesn't have a resource type "kustomization"[\s\S]*deployments.apps "web" not found/]] },
  alert: { ok: /"alertname":"KubePodCrashLooping"[^}]*}[^}]*}[^}]*"state":"firing"/, drops: [['kube-state-metrics', /"alertname":"Watchdog"(?![\s\S]*KubePodCrashLooping)/], ['prometheus', /Could not resolve host: prometheus.monitoring/]] },
};

describe('constructor scenarios', () => {
  for (const sc of SCENARIOS) {
    it(`${sc.id}: works with everything on and names the cause without each component`, async () => {
      const want = SYMPTOMS[sc.id];
      expect(want, `symptoms for ${sc.id}`).toBeTruthy();
      const ok = (await runScenario(FULL, sc, ALL_LAYERS, { registry: reg }))!;
      expect(ok.text).toMatch(want.ok);
      expect(ok.explain).toEqual([sc.ok]);
      for (const [id, symptom] of want.drops) {
        const st = id === 'netpol' ? { ...FULL, cni: 'flannel' as const } : drop([id]);
        const r = (await runScenario(st, sc, ALL_LAYERS, { registry: reg }))!;
        expect(r.text, `${sc.id} without ${id}`).toMatch(symptom);
        const cause = sc.causes?.[id] ?? (id === 'netpol' ? undefined : comp(id).cause);
        if (cause) expect(r.explain[0]).toEqual(cause);
        else expect(r.explain[0]).not.toEqual(sc.ok);
        // Russian explanations are full sentences.
        for (const e of r.explain) expect(e.ru).toMatch(/^[А-ЯЁA-Za-z].{40,}[.»]$/s);
      }
    });
  }
});
