// V86_NETWORK=1 npx vitest run tests/v86-network-regression.test.ts
// Requires the same local v86/lab assets as terraform-v86.test.ts.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { connectMachine } from '../src/engine/v86/fabric';
import { L2Switch } from '../src/engine/v86/switch';
import { LabHost } from '../src/engine/labhost/host';
import { buildArp, buildEth, ETH_ARP, ipToNum } from '../src/engine/labhost/wire';

import { createHost } from '../src/engine/v86/host';
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
const enabled = !!process.env.V86_NETWORK && existsSync(assets.fsJson!);

const inProcess: TransportFactory = (onMessage) => {
  const host = createHost((m) => setTimeout(() => onMessage(m), 0));
  return { post: (m) => void host(m), terminate() {} };
};

const cleanup: (() => void)[] = [];
afterAll(() => cleanup.forEach(f => f()));

describe.skipIf(!enabled)('virtio on an already active switch', () => {
  it('accepts inbound SSH after cold boot and shared-snapshot restore under broadcast traffic', async () => {
    const sw = new L2Switch();
    const peer = new LabHost();
    peer.addInterface(1, ipToNum('10.0.0.1'), 24);
    cleanup.push(peer.attach(sw));
    // Other machines send broadcasts while a new NIC is still initializing.
    // The target is unused: neither guest should need to answer this traffic.
    const broadcast = buildEth('ff:ff:ff:ff:ff:ff', peer.mac, ETH_ARP, buildArp({
      op: 1, sha: peer.mac, spa: ipToNum('10.0.0.1'),
      tha: '00:00:00:00:00:00', tpa: ipToNum('10.0.0.250'),
    }));
    for (const [index, kind] of ['cold', 'restored'].entries()) {
      const ip = `10.0.0.${20 + index}`;
      const traffic = setInterval(() => sw.receive('labhost', broadcast), 20);
      try {
        const m = new V86Machine({ id: `node-${index}`, profile: 'lab-node', transport: inProcess, assets, identity: { hostname: `node-${index}`, ip: `${ip}/24` } });
        const unplug = connectMachine(sw, m, { mode: 'access', vlan: 1});
        cleanup.push(() => { unplug(); m.dispose(); });
        await m.start();
        expect(m.boot?.kind).toBe(kind);
        await m.bootSaved;
        // No guest ping/ARP warmup: initiate the first connection from outside.
        const connection = await peer.connect(ipToNum(ip), 22, { timeoutMs: 10000 });
        connection.destroy();
        expect((await m.exec('hostname')).out.trim()).toBe(`node-${index}`);
      } finally {
        clearInterval(traffic);
      }
    }
  }, 600_000);
});
