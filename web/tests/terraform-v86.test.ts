// End to end on the real emulator (design 00 §6.13): a workstation machine of
// the lab image runs OpenTofu with the provider `lab` from its offline
// mirror against the in-tab cloud (CloudLab on the same switch); the apply
// boots a real second v86 machine that answers ping and ssh; destroy removes
// it. In-process like tests/v86-lab-integration.test.ts; needs
// `npm run fetch:v86` and `npm run build:lab-image`, takes a few minutes:
//
//   V86_TF=1 npx vitest run tests/terraform-v86.test.ts --silent=false
//
// It prints the measured numbers (boot, tofu init/plan/apply/destroy, memory).

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { CloudLab } from '../src/engine/cloud/lab';
import type { BackendImage, VmBackend, VmHandle, VmSpec } from '../src/engine/cloud/vm-backend';
import { createHost } from '../src/engine/v86/host';
import { V86Lab } from '../src/engine/v86/lab';
import type { MachineAssets, TransportFactory } from '../src/engine/v86/machine';

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
const enabled = !!process.env.V86_TF && existsSync(assets.fsJson!);

const inProcess: TransportFactory = (onMessage) => {
  const host = createHost((m) => setTimeout(() => onMessage(m), 0));
  return { post: (m) => void host(m), terminate() {} };
};

/** VM backend over V86Lab: every cloud VM is a lab machine on the shared switch. */
function v86Backend(l: V86Lab, totalMB: number): VmBackend {
  const names = new Map<string, { name: string; mb: number }>();
  const handle = (id: string): VmHandle => ({ id, console: () => '' });
  return {
    kind: 'v86',
    images: (): BackendImage[] => [{ name: 'lab-node', description: 'Alpine Linux 3.24 x86, the lab image', minMemoryMB: 128, ssh: true, cloudInit: true }],
    capacityMB: () => totalMB - [...names.values()].reduce((n, x) => n + x.mb, 0),
    async create(spec: VmSpec, progress) {
      progress('booting the machine', 10);
      const m = await l.add({
        name: spec.hostname,
        ip: spec.ip,
        mac: spec.mac,
        gateway: spec.gateway,
        dns: spec.dns[0],
        memoryMB: spec.memoryMB,
        port: { mode: 'access', vlan: spec.vlan },
        authorizedKeys: spec.sshAuthorizedKeys,
        userData: spec.userData,
      });
      names.set(spec.id, { name: spec.hostname, mb: spec.memoryMB });
      const b = m.boot!;
      return { handle: handle(spec.id), boot: { kind: b.kind === 'cold' ? 'cold' : 'restored', ms: b.ms } };
    },
    async stop(id) {
      const n = names.get(id);
      if (n) l.remove(n.name);
    },
    async start(spec, progress) {
      return this.create(spec, progress);
    },
    async reboot() {},
    async destroy(id) {
      const n = names.get(id);
      if (n) l.remove(n.name);
      names.delete(id);
    },
  };
}

const cleanup: (() => void)[] = [];
afterAll(() => cleanup.forEach((f) => f()));
const rss = () => Math.round(process.memoryUsage().rss / 1048576);

describe.skipIf(!enabled)('OpenTofu in a lab machine creates a real VM', () => {
  it('tofu init/plan/apply boots a VM that answers ping and ssh; destroy removes it', async () => {
    const t = () => performance.now();
    const l = new V86Lab({ transport: inProcess, assets, hosts: false });
    cleanup.push(() => l.dispose());
    const cloud = await CloudLab.create({ backend: v86Backend(l, 1024), hosts: { ws: '10.0.0.10' } });
    cloud.attach(l.switch);
    const times: Record<string, number> = {};

    let t0 = t();
    const ws = await l.add({ name: 'ws', ip: '10.0.0.10/24', gateway: '10.0.0.1', dns: '10.0.0.1', memoryMB: 512 });
    times.wsBoot = Math.round(t() - t0);
    console.log(`ws boot ${JSON.stringify(ws.boot)} rss ${rss()} MiB`);

    const sh = async (name: string, cmd: string, expectExit: number | null = 0) => {
      const s = t();
      const r = await ws.exec(cmd);
      times[name] = Math.round(t() - s);
      console.log(`--- ${name} (${times[name]} ms, exit ${r.exit})\n${r.out.slice(-1500)}`);
      if (expectExit !== null) expect(r.exit, `${name}: ${r.out}`).toBe(expectExit);
      return r;
    };

    await sh('resolve', 'getent hosts api.cloud.lab && curl -s -m 5 http://api.cloud.lab/v1/ | head -c 200');
    await sh('version', 'tofu version');
    await sh('keygen', 'mkdir -p /root/.ssh && ssh-keygen -q -t ed25519 -N "" -f /root/.ssh/id_ed25519 && cat /root/.ssh/id_ed25519.pub');
    await sh(
      'write',
      `echo "export LAB_TOKEN=${cloud.cloud.state.bootstrapSecret}" > /etc/dt/cloud.env && mkdir -p /root/infra && cd /root/infra && cat > main.tf <<'EOF'
terraform {
  required_providers {
    lab = { source = "lab/lab", version = "~> 0.1" }
  }
}

provider "lab" {}

resource "lab_vm" "web" {
  name                = "web-1"
  flavor              = "lab.small"
  image               = "lab-node"
  ip                  = "10.0.0.21"
  ssh_authorized_keys = [trimspace(file("/root/.ssh/id_ed25519.pub"))]
  labels              = { trainer = "devops", "dt-track" = "iac" }
}

output "ip" { value = lab_vm.web.ip }
EOF`,
    );
    const env = '. /etc/profile.d/lab-cloud.sh; cd /root/infra; export TF_IN_AUTOMATION=1;';
    const mem = await sh('meminfo', "grep -E 'MemTotal|MemAvailable' /proc/meminfo");
    const init = await sh('init', `${env} tofu init -input=false -no-color`);
    expect(init.out).toMatch(/Installed lab\/lab v0\.1\.0/);
    const plan = await sh('plan', `${env} tofu plan -input=false -no-color -out=tfplan`);
    expect(plan.out).toMatch(/Plan: 1 to add/);
    t0 = t();
    const apply = await sh('apply', `${env} tofu apply -input=false -no-color tfplan`);
    expect(apply.out).toMatch(/Apply complete! Resources: 1 added/);
    const vm = cloud.cloud.state.vms.find((v) => v.name === 'web-1')!;
    expect(vm.status).toBe('RUNNING');
    console.log(`vm boot ${JSON.stringify(vm.boot)} rss ${rss()} MiB`);
    expect(l.nodes.has('web-1')).toBe(true);

    await sh('ping', 'ping -c 2 -W 3 10.0.0.21');
    const ssh = await sh('ssh', 'ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=20 root@10.0.0.21 "hostname; cat /etc/dt/image"');
    expect(ssh.out).toMatch(/web-1/);
    await sh('ping-name', 'ping -c 1 -W 3 web-1.vm.lab', null);
    const noop = await sh('plan-noop', `${env} tofu plan -input=false -no-color -detailed-exitcode`);
    expect(noop.out).toMatch(/No changes/);

    const destroy = await sh('destroy', `${env} tofu destroy -input=false -no-color -auto-approve`);
    expect(destroy.out).toMatch(/Destroy complete! Resources: 1 destroyed/);
    expect(cloud.cloud.state.vms).toHaveLength(0);
    expect(l.nodes.has('web-1')).toBe(false);
    await sh('ping-gone', 'ping -c 1 -W 2 10.0.0.21', 1);
    console.log(`times ${JSON.stringify(times)}\nws ${mem.out.replace(/\s+/g, ' ')} rss ${rss()} MiB`);
  }, 1_800_000);
});
