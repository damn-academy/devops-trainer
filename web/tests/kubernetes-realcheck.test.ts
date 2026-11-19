import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { blobFacts, decodeBlob, realityProblems } from '../src/engine/kube-lite/checkblob';
import { Cluster } from '../src/engine/kube-lite/cluster';
import { EXERCISES, WEBSITE_CRD, applyActions, reconcileAll } from '../src/engine/kube-lite/ui/controller-lab';
import { componentsFrom, WIRES, whyNot } from '../src/engine/kube-lite/ui/constructor';
import { authorize, reconcileInProcess } from '../src/engine/kube-lite/sandbox';

/** A fake kubectl that answers like a one-node k3s cluster: enough to run the real script. */
const FAKE_KUBECTL = `#!/usr/bin/env bash
args="$*"
case "$args" in
  *"get --raw=/readyz"*) echo ok ;;
  *"api-resources -o name"*) printf 'nodes\\nnamespaces\\npods\\nservices\\ndeployments.apps\\nendpointslices.discovery.k8s.io\\ngatewayclasses.gateway.networking.k8s.io\\n' ;;
  *"version --client -o json"*) echo '{"clientVersion":{"gitVersion":"v1.37.1"}}' ;;
  *"version -o json"*) echo '{"serverVersion":{"gitVersion":"v1.37.1+k3s1"}}' ;;
  *"config current-context"*) echo default ;;
  *"get configmap trainer-proof"*) echo '{"kind":"ConfigMap","metadata":{"name":"trainer-proof","namespace":"default"},"data":{"nonce":"abc12"}}' ;;
  *"get nodes -A -o json"*) echo '{"apiVersion":"v1","kind":"List","items":[{"kind":"Node","metadata":{"name":"k3s","labels":{"node-role.kubernetes.io/control-plane":"true"}},"spec":{"podCIDR":"10.42.0.0/24"},"status":{"conditions":[{"type":"Ready","status":"True"}],"nodeInfo":{"kubeletVersion":"v1.37.1+k3s1","kernelVersion":"6.8.0-88-generic","osImage":"Ubuntu 24.04.3 LTS","containerRuntimeVersion":"containerd://2.1.4-k3s1"}}}]}' ;;
  *"get pods -A -o json"*) echo '{"apiVersion":"v1","kind":"List","items":[{"kind":"Pod","metadata":{"name":"coredns-6799fbcd5-x2k9p","namespace":"kube-system","uid":"1"},"spec":{"nodeName":"k3s","containers":[{"name":"coredns","image":"rancher/mirrored-coredns-coredns:1.12.3"}]},"status":{"phase":"Running","conditions":[{"type":"Ready","status":"True"}]}}]}' ;;
  *"get deployments.apps -A -o json"*) echo '{"kind":"List","items":[{"kind":"Deployment","metadata":{"name":"web","namespace":"shop"},"spec":{"replicas":2,"template":{"spec":{"containers":[{"image":"ghcr.io/x/web:1"}]}}},"status":{"readyReplicas":2,"availableReplicas":2,"updatedReplicas":2}}]}' ;;
  *" -A -o json"*) echo '{"kind":"List","items":[]}' ;;
  *) echo "fake kubectl: unexpected: $args" >&2; exit 1 ;;
esac
`;

describe('trainer-check.sh and the blob', () => {
  it('runs read-only against a (fake) cluster and its blob decodes into facts the checks read', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'k8s-check-'));
    writeFileSync(join(dir, 'kubectl'), FAKE_KUBECTL);
    chmodSync(join(dir, 'kubectl'), 0o755);
    const script = resolve(__dirname, '../public/check/trainer-check.sh');
    const out = execFileSync('bash', [script, '--track', 'r1', '--nonce', 'abc12'], { env: { ...process.env, PATH: `${dir}:${process.env.PATH}` }, encoding: 'utf8' });
    expect(out).toContain('-----BEGIN TRAINER CHECK-----');
    const blob = await decodeBlob(out.slice(out.indexOf('-----BEGIN')));
    expect(blob.nonce).toBe('abc12');
    expect(blob.absent).toContain('applications.argoproj.io');
    const f = blobFacts(blob);
    expect(realityProblems(f, 'abc12')).toEqual([]);
    expect(realityProblems(f, 'zzzzz').length).toBeGreaterThan(0);
    expect(evaluateCheck({ when: 'k8s.nodes[ready=true]#>=1' }, f).pass).toBe(true);
    expect(evaluateCheck({ when: "k8s.pods[ns=kube-system][name~'coredns'][ready=true]#>=1" }, f).pass).toBe(true);
    expect(evaluateCheck({ when: 'k8s.deployments[ns=shop][ready>=2]#>=1' }, f).pass).toBe(true);
    expect(evaluateCheck({ when: "k8s.pods[ns=kube-system][name~'traefik'][ready=true]#>=1" }, f).pass).toBe(false);
  });

  it('refuses a blob from the simulator', async () => {
    const c = new Cluster({ nodes: ['a'] });
    const json = JSON.stringify({ schema: 'dt.k8s-check/v1', nonce: 'n', resources: { nodes: { items: c.list('Node') } } });
    const f = blobFacts(await decodeBlob(btoa(json)));
    expect(realityProblems(f, 'n').join()).toContain('simulator');
  });
});

describe('the controller lab', () => {
  const TEAM = `function reconcile(ns, k) {
    const team = ns.metadata.labels && ns.metadata.labels.team;
    if (!team) return;
    const have = k.get('ConfigMap', ns.metadata.name, 'team-info');
    if (!have) k.create({ apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'team-info', namespace: ns.metadata.name }, data: { team } });
    else if (have.data.team !== team) { have.data.team = team; k.update(have); }
  }`;
  const run = (code: string, o: object, w: object[]) => Promise.resolve(reconcileInProcess(code, o as never, w as never));

  it('runs a learner loop: creates, restores after deletion, follows a label change', async () => {
    const ex = EXERCISES['team-info'];
    const c = new Cluster({ nodes: ['a'] });
    ex.actions.find((a) => a.id === 'ns-a')!.run(c);
    await reconcileAll(c, ex, TEAM, run);
    expect(ex.goal(c)).toBe(true);
    ex.actions.find((a) => a.id === 'del-cm')!.run(c);
    expect(ex.goal(c)).toBe(false);
    await reconcileAll(c, ex, TEAM, run);
    expect(ex.goal(c)).toBe(true);
    ex.actions.find((a) => a.id === 'relabel')!.run(c);
    await reconcileAll(c, ex, TEAM, run);
    expect(c.get('ConfigMap', 'team-a', 'team-info')!.data.team).toBe('gamma');
  });

  it('forbids what the controller has no right to, with the API server wording', () => {
    const ex = EXERCISES['team-info'];
    const msg = authorize({ op: 'delete', kind: 'Pod', namespace: 'default', name: 'x' }, ex.grant, ex.sa);
    expect(msg).toContain('is forbidden: User "system:serviceaccount:kube-system:team-info-controller" cannot delete resource "pods"');
    const c = new Cluster({ nodes: ['a'] });
    expect(applyActions(c, ex, [{ op: 'create', obj: { apiVersion: 'v1', kind: 'Secret', metadata: { name: 's', namespace: 'default' } } }])[0]).toContain('Forbidden');
  });

  it('reports a syntax error instead of throwing', () => {
    const r = reconcileInProcess('function reconcile( {', {}, []);
    expect(r.ok).toBe(false);
  });

  it('an operator for a CRD is the same loop; ownerReferences clean up', async () => {
    const ex = EXERCISES.website;
    const c = new Cluster({ nodes: ['a', 'b'] });
    c.create(WEBSITE_CRD);
    const OP = `function reconcile(site, k) {
      const ns = site.metadata.namespace, name = site.metadata.name;
      const have = k.get('Deployment', ns, name);
      if (!have) k.create({ apiVersion: 'apps/v1', kind: 'Deployment', metadata: { name, namespace: ns, ownerReferences: [ownerRef(site)] },
        spec: { replicas: site.spec.replicas, selector: { matchLabels: { site: name } }, template: { metadata: { labels: { site: name } }, spec: { containers: [{ name: 'web', image: site.spec.image }] } } } });
      else if (have.spec.replicas !== site.spec.replicas) { have.spec.replicas = site.spec.replicas; k.update(have); }
    }`;
    ex.actions.find((a) => a.id === 'site')!.run(c);
    await reconcileAll(c, ex, OP, run);
    ex.actions.find((a) => a.id === 'scale')!.run(c);
    await reconcileAll(c, ex, OP, run);
    expect(ex.goal(c)).toBe(true);
    c.advance(10_000);
    expect(c.list('Pod', 'default').length).toBe(4);
    ex.actions.find((a) => a.id === 'del-site')!.run(c);
    c.advance(5_000);
    expect(c.get('Deployment', 'default', 'blog')).toBeUndefined();
  });
});

describe('the constructor', () => {
  it('maps what is placed and wired to kube-lite components', () => {
    const all = { placed: ['kubectl', 'apiserver', 'etcd', 'scheduler', 'controller-manager', 'kubelet', 'runtime', 'cni', 'kube-proxy', 'coredns'], wires: WIRES.map((w) => [w.a, w.b].sort().join('|')) };
    expect(componentsFrom(all).missing).toEqual([]);
    const noSched = { ...all, placed: all.placed.filter((x) => x !== 'scheduler') };
    expect(componentsFrom(noSched).components.scheduler).toBe(false);
    const unwired = { ...all, wires: all.wires.filter((w) => w !== 'cni|runtime') };
    expect(componentsFrom(unwired).components.cni).toBe(false);
  });
  it('explains why a forbidden wire does not exist', () => {
    expect(whyNot('scheduler', 'etcd').en).toContain('Only kube-apiserver talks to etcd');
    expect(whyNot('scheduler', 'kubelet').en).toContain('nodeName');
  });
});
