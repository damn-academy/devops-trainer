// The cloud lab of the IaC lessons end to end on the real emulator: the same
// pieces the widget wires (V86Lab + CloudLab + the v86 VM backend + the CI
// bridge on the workstation), in-process like tests/terraform-v86.test.ts.
// Needs `npm run fetch:v86` and `npm run build:lab-image`; takes minutes:
//
//   V86_CLOUDLAB=1 npx vitest run tests/iac-cloudlab-v86.test.ts --silent=false
//
// Lesson iac.cloud-api by curl (401, 202 + operation, ssh into the new VM,
// delete), then lesson iac.ci-apply: git push to git.lab → pipeline plan →
// apply of the saved plan → a real VM, with the state in s3.cloud.lab.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { v86Backend } from '../src/blocks/iac/cloudlab/backend';
import { CiBridge } from '../src/blocks/iac/cloudlab/ci';
import { apiCall, cloudLabFacts } from '../src/blocks/iac/cloudlab/runtime';
import { CloudLab } from '../src/engine/cloud/lab';
import { connectMachine } from '../src/engine/v86/fabric';
import { createHost } from '../src/engine/v86/host';
import { V86Lab } from '../src/engine/v86/lab';
import { V86Machine, type MachineAssets, type TransportFactory } from '../src/engine/v86/machine';

const root = fileURLToPath(new URL('..', import.meta.url));
const lab = `${root}public/v86/lab/`;
const assets: MachineAssets = {
  wasm: `${root}node_modules/v86/build/v86.wasm`,
  bios: `${root}public/v86/seabios.bin`,
  vgaBios: `${root}public/v86/vgabios.bin`,
  bzimage: `${lab}vmlinuz-virt`,
  initrd: `${lab}initramfs-lab`,
  fsJson: `${lab}lab-node.fs.json`,
  filesBase: `${lab}files/`,
  cmdline: 'rw root=host9p rootfstype=9p console=ttyS0 tsc=reliable mitigations=off random.trust_cpu=on',
  kernelSha: 'test',
};
const enabled = !!process.env.V86_CLOUDLAB && existsSync(assets.fsJson!);

const inProcess: TransportFactory = (onMessage) => {
  const host = createHost((m) => setTimeout(() => onMessage(m), 0));
  return { post: (m) => void host(m), terminate() {} };
};

const cleanup: (() => void)[] = [];
afterAll(() => cleanup.forEach((f) => f()));
const rss = () => Math.round(process.memoryUsage().rss / 1048576);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CI_TF = `terraform {
  required_providers {
    lab = { source = "lab/lab", version = "~> 0.1" }
  }
  backend "s3" {
    bucket                      = "tfstate"
    key                         = "ci/terraform.tfstate"
    region                      = "lab-1"
    endpoints                   = { s3 = "http://s3.cloud.lab" }
    use_path_style              = true
    use_lockfile                = true
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
  }
}

provider "lab" {}

resource "lab_vm" "app" {
  name   = "ci-app"
  flavor = "lab.small"
  image  = "lab-node"
  labels = { deployed_by = "ci" }
}
`;

const CI_YML = `stages: [plan, apply]
plan:
  stage: plan
  script:
    - tofu init -input=false -no-color
    - tofu plan -input=false -no-color -out=plan.tfplan
  artifacts:
    paths: [plan.tfplan]
apply:
  stage: apply
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script:
    - tofu init -input=false -no-color
    - tofu apply -input=false -no-color plan.tfplan
`;

describe.skipIf(!enabled)('the cloud lab on real machines', () => {
  it('curl against the API boots a VM; a push to git.lab runs tofu apply in CI', async () => {
    const times: Record<string, number> = {};
    const t = () => performance.now();
    const l = new V86Lab({ transport: inProcess, assets, hosts: false });
    cleanup.push(() => l.dispose());
    const cl = await CloudLab.create({ backend: v86Backend(l, { totalMB: 512 }), hosts: { ws: '10.0.0.10' } });
    cl.attach(l.switch);
    const requests: { method: string; path: string; status: number; from: string }[] = [];
    cl.cloud.on((e) => {
      if (e.t === 'request') requests.push({ method: e.method, path: e.path, status: e.status, from: e.from });
    });

    let t0 = t();
    const ws = new V86Machine({ id: 'ws', profile: 'lab-node', identity: { hostname: 'ws', ip: '10.0.0.10/24', gateway: '10.0.0.1', dns: '10.0.0.1', hosts: {} }, memoryMB: 512, transport: inProcess, assets });
    cleanup.push(() => ws.dispose());
    connectMachine(l.switch, ws, { mode: 'access', vlan: 1 }, 'ws');
    const ci = new CiBridge(cl.git, () => ws, { pollMs: 1000 });
    cl.mux.add({ hosts: ['ci.lab'], handler: ci.handle });
    const boot = await ws.start();
    times.wsBoot = Math.round(t() - t0);
    const curlHelp = await ws.exec('curl --help all');
    expect(curlHelp.out).toContain('--aws-sigv4');
    expect((await ws.exec('hostname')).out.trim()).toBe('ws');
    console.log(`ws ${boot.kind} boot ${boot.ms} ms, rss ${rss()} MiB`);

    const sh = async (name: string, cmd: string, expectExit: number | null = 0) => {
      const s = t();
      const r = await ws.exec(cmd);
      times[name] = Math.round(t() - s);
      console.log(`--- ${name} (${times[name]} ms, exit ${r.exit})\n${r.out.slice(-1200)}`);
      if (expectExit !== null) expect(r.exit, `${name}: ${r.out}`).toBe(expectExit);
      return r;
    };
    const id = cl.cloud.state.keys[0].access_key_id;
    await sh('env', `mkdir -p /etc/dt && printf '%s\\n' 'export LAB_TOKEN=${cl.cloud.state.bootstrapSecret}' 'export AWS_ACCESS_KEY_ID=${id}' 'export AWS_SECRET_ACCESS_KEY=lab' > /etc/dt/cloud.env`);
    const P = '. /etc/profile >/dev/null 2>&1;';

    // ── lesson iac.cloud-api ──
    await sh('curl-public', `${P} curl -s -o /dev/null -w '%{http_code}' http://api.cloud.lab/v1/flavors`);
    await sh('curl-401', `${P} curl -s -o /dev/null -w '%{http_code}' http://api.cloud.lab/v1/whoami`);
    await sh('curl-whoami', `${P} curl -s -H "Authorization: Bearer $LAB_TOKEN" http://api.cloud.lab/v1/whoami`);
    await sh('keygen', 'ssh-keygen -q -t ed25519 -N "" -f /root/.ssh/id_ed25519 2>/dev/null || (mkdir -p /root/.ssh && ssh-keygen -q -t ed25519 -N "" -f /root/.ssh/id_ed25519)');
    t0 = t();
    const op = await sh(
      'curl-create',
      `${P} BODY=$(jq -n --arg k "$(cat ~/.ssh/id_ed25519.pub)" '{name:"api-1", flavor:"lab.small", image:"lab-node", ssh_authorized_keys:[$k]}'); curl -s -X POST -H "Authorization: Bearer $LAB_TOKEN" -H "Content-Type: application/json" -d "$BODY" http://api.cloud.lab/v1/projects/default/vms | jq -r .id`,
    );
    const opId = op.out.trim().split('\n').pop()!;
    expect(opId).toMatch(/^op-/);
    let status = '';
    for (let i = 0; i < 20 && status !== 'DONE'; i++) status = (await sh(`curl-wait-${i}`, `${P} curl -s -H "Authorization: Bearer $LAB_TOKEN" "http://api.cloud.lab/v1/operations/${opId}?wait=30" | jq -r .status`)).out.trim().split('\n').pop()!;
    times.vmCreate = Math.round(t() - t0);
    expect(status).toBe('DONE');
    expect(cl.cloud.state.vms.find((v) => v.name === 'api-1')?.status).toBe('RUNNING');
    console.log(`api-1 boot ${JSON.stringify(cl.cloud.state.vms[0].boot)} rss ${rss()} MiB`);
    await sh('ssh', 'ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=20 root@api-1.vm.lab "touch /root/hello; hostname"');
    const vmM = l.nodes.get('api-1')!.machine;
    vmM.watchPaths(['/root/hello']);
    expect((await vmM.facts()).files['/root/hello']?.type).toBe('f');
    t0 = t();
    await sh('curl-delete', `${P} curl -s -X DELETE -H "Authorization: Bearer $LAB_TOKEN" http://api.cloud.lab/v1/projects/default/vms/api-1 | jq -r .id`);
    for (let i = 0; i < 40 && cl.cloud.state.vms.length; i++) await sleep(250);
    times.vmDelete = Math.round(t() - t0);
    expect(cl.cloud.state.vms).toHaveLength(0);
    expect(requests.some((r) => r.from === '10.0.0.10' && r.status === 401)).toBe(true);

    // ── lesson iac.ci-apply ──
    await apiCall(cl, { method: 'POST', path: '/v1/projects/{project}/buckets', body: { name: 'tfstate' } });
    await sh('repo', `mkdir -p /root/infra-repo && cd /root/infra-repo && cat > main.tf <<'EOF'\n${CI_TF}EOF\ncat > .gitlab-ci.yml <<'EOF'\n${CI_YML}EOF\nprintf '.terraform/\\n*.tfplan\\n' > .gitignore`);
    await sh('init', `${P} cd /root/infra-repo && tofu init -input=false -no-color`);
    t0 = t();
    await sh('push', `cd /root/infra-repo && git config --global user.name L && git config --global user.email l@ws.lab && git init -q -b main && git add -A && git commit -qm infra && git remote add origin http://git.lab/infra.git && git push -u origin main 2>&1`);
    for (let i = 0; i < 600 && !(ci.pipelines[0] && ['success', 'failed'].includes(ci.pipelines[0].status)); i++) await sleep(500);
    times.pipeline = Math.round(t() - t0);
    const p = ci.pipelines[0];
    for (const j of p.jobs) console.log(`=== job ${j.name}: ${j.status} (${(j.finished ?? 0) - (j.started ?? 0)} ms)\n${j.log.slice(-2500)}`);
    expect(p.status).toBe('success');
    const vm = cl.cloud.state.vms.find((v) => v.name === 'ci-app');
    expect(vm?.status).toBe('RUNNING');
    const facts = cloudLabFacts(cl, requests, ci);
    expect(facts.s3.states.find((s) => s.key === 'ci/terraform.tfstate')?.resources.map((r) => r.address)).toContain('lab_vm.app');
    expect(facts.git.repos.find((r) => r.name === 'infra')?.files).toContain('.terraform.lock.hcl');
    const jobMs = Object.fromEntries(p.jobs.map((j) => [j.name, (j.finished ?? 0) - (j.started ?? 0)]));
    console.log(`times ${JSON.stringify(times)} jobs ${JSON.stringify(jobMs)} rss ${rss()} MiB`);
  }, 1_800_000);
});
