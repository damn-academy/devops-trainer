// Integration test of the lab image (design 00 §6.13) on the real emulator,
// in-process like tests/v86-integration.test.ts. It needs `npm run
// fetch:v86` and `npm run build:lab-image`, boots Alpine Linux several times
// and takes a few minutes, so it runs only on request:
//
//   V86_LAB=1 npx vitest run tests/v86-lab-integration.test.ts
//   V86_LAB=install …   also installs Alpine onto a blank disk and boots it
//
// It prints the measured numbers (boot, restore, latency, memory) that
// STATUS.md quotes.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
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
const installer: MachineAssets = { ...assets, fsJson: `${lab}lab-installer.fs.json` };
const enabled = !!process.env.V86_LAB && existsSync(assets.fsJson!);
const withInstall = process.env.V86_LAB === 'install';

const inProcess: TransportFactory = (onMessage) => {
  const host = createHost((m) => setTimeout(() => onMessage(m), 0));
  return { post: (m) => void host(m), terminate() {} };
};

const cleanup: (() => void)[] = [];
afterAll(() => cleanup.forEach((f) => f()));
const rss = () => Math.round(process.memoryUsage().rss / 1048576);

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t = performance.now();
  const r = await fn();
  return [r, Math.round(performance.now() - t)];
}

describe.skipIf(!enabled)('v86 lab image: Alpine on a 9p root', () => {
  it('two machines: boot, clone, facts, ssh with keys, nginx between them', async () => {
    const rss0 = rss();
    const l = new V86Lab({
      transport: inProcess,
      assets,
      nodes: [
        { name: 'node1', ip: '10.0.0.11/24' },
        { name: 'node2', ip: '10.0.0.12/24' },
      ],
    });
    cleanup.push(() => l.dispose());
    const boots: Record<string, unknown> = {};
    await l.start((name, b) => (boots[name] = b));
    console.log('lab boots', JSON.stringify(boots), `rss ${rss0} → ${rss()} MiB`);
    expect(l.machine('node1').boot!.kind).toBe('cold');
    expect(l.machine('node2').boot!.kind).toBe('restored');

    const n1 = l.machine('node1');
    const n2 = l.machine('node2');
    for (const cmd of ['true', 'hostname', 'ip -br addr show eth0']) {
      const [r, ms] = await timed(() => n1.exec(cmd));
      console.log(`exec ${cmd}: ${ms} ms → ${r.out.trim()}`);
    }
    expect((await n2.exec('hostname')).out.trim()).toBe('node2');
    expect((await n2.exec('cat /etc/machine-id')).out).not.toBe((await n1.exec('cat /etc/machine-id')).out);
    expect((await n1.exec('ping -c 2 -W 3 node2')).exit).toBe(0);

    // The facts a lesson checks, by state.
    n2.watchPredicates(['listen[port=22].proc=sshd', "net.addrs[dev=eth0].cidr='10.0.0.12/24'"]);
    const [f2, factsMs] = await timed(() => n2.facts(['svc', 'boot']));
    console.log(`facts with net, listen, svc, boot: ${factsMs} ms`);
    expect(evaluateCheck({ when: "listen[port=22].proc=sshd && net.addrs[dev=eth0].cidr='10.0.0.12/24' && svc[name=sshd].state=started && boot.rootfs=9p" }, f2).pass).toBe(true);

    // SSH with a key, as a learner would.
    expect((await n1.exec("ssh-keygen -q -t ed25519 -N '' -f /root/.ssh/id_ed25519")).exit).toBe(0);
    const pub = (await n1.exec('cat /root/.ssh/id_ed25519.pub')).out.trim();
    await n2.exec(`mkdir -p /root/.ssh && echo '${pub}' >> /root/.ssh/authorized_keys && chmod 700 /root/.ssh && chmod 600 /root/.ssh/authorized_keys`);
    const [ssh, sshMs] = await timed(() => n1.exec('ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes root@node2 hostname'));
    console.log(`ssh node1 → node2: ${sshMs} ms, exit ${ssh.exit}: ${ssh.out.trim()}`);
    expect(ssh.out).toContain('node2');

    // A web server on one machine, a client on the other.
    expect((await n2.exec('echo hello-from-node2 > /var/lib/nginx/html/index.html; rc-service nginx start')).exit).toBe(0);
    const [curl, curlMs] = await timed(() => n1.exec('curl -s http://node2/'));
    console.log(`curl node1 → nginx on node2: ${curlMs} ms`);
    expect(curl.out).toContain('hello-from-node2');
    const f = await n2.facts(['listen', 'svc']);
    expect(evaluateCheck({ when: 'listen[port=80].proc=nginx && svc[name=nginx].state=started' }, f).pass).toBe(true);

    const fetched = await n1.rootFetched();
    console.log(`9p root fetched by node1: ${fetched.files} files, ${(fetched.bytes / 1048576).toFixed(1)} MiB; rss ${rss()} MiB`);
  }, 900_000);

  it('a blank disk: partitions, LVM, ext4, fstab by UUID — checked by facts', async () => {
    const m = new V86Machine({ transport: inProcess, assets, profile: 'lab-node', disks: [{ sizeMB: 256 }], identity: { hostname: 'disk' } });
    cleanup.push(() => m.dispose());
    const boot = await m.start();
    console.log(`lab-node with a 256 MiB disk: ${boot.kind} ${boot.ms} ms`);
    const script = [
      "printf 'label: gpt\\n,64M\\n,\\n' | sfdisk -q /dev/sda",
      'mkfs.ext4 -q /dev/sda1',
      'pvcreate -q /dev/sda2 && vgcreate -q vg0 /dev/sda2 && lvcreate -q -y -n data -L 100M vg0',
      'mkfs.ext4 -q /dev/vg0/data',
      'mkdir -p /srv/data && echo "UUID=$(blkid -s UUID -o value /dev/vg0/data) /srv/data ext4 defaults 0 2" >> /etc/fstab',
      'mount -a',
    ].join(' && ');
    const [r, ms] = await timed(() => m.exec(script));
    console.log(`partition + LVM + mkfs + fstab: ${ms} ms, exit ${r.exit}${r.exit ? ': ' + r.out : ''}`);
    expect(r.exit).toBe(0);
    const f = await m.facts(['blk', 'mounts', 'fstab', 'lvm']);
    const goal = "mounts[target='/srv/data'].fstype=ext4 && fstab[target='/srv/data'].src~'UUID=' && lvm.lvs[name=data].vg=vg0 && blk[name=sda1].fstype=ext4";
    expect(evaluateCheck({ when: goal }, f).pass).toBe(true);
    const disks = await m.exportDisks();
    console.log(`disk in memory: ${(disks[0].data.byteLength / 1048576).toFixed(1)} MiB of 256 MiB written`);
  }, 600_000);

  it.skipIf(!withInstall)('installer media: install Alpine onto the blank disk and boot it', async () => {
    const m = new V86Machine({ transport: inProcess, assets: installer, profile: 'lab-installer', disks: [{ sizeMB: 1024 }], bootCache: false });
    cleanup.push(() => m.dispose());
    let screen = '';
    m.onOutput((t) => (screen += t));
    const boot = await m.start();
    console.log(`installer media: ${boot.kind} ${boot.ms} ms`);
    // The manual path of the Alpine handbook, from the local repository of the media.
    const steps = [
      "printf 'label: dos\\n,128M,L,*\\n,,L\\n' | sfdisk -q /dev/sda",
      'mkfs.ext4 -q /dev/sda1 && mkfs.ext4 -q /dev/sda2',
      'mount /dev/sda2 /mnt && mkdir -p /mnt/boot && mount /dev/sda1 /mnt/boot',
      'setup-disk -m sys -k virt -s 0 /mnt',
      'dd if=/usr/share/syslinux/mbr.bin of=/dev/sda bs=440 count=1 conv=notrunc',
      'sync',
    ];
    for (const s of steps) {
      const [r, ms] = await timed(() => m.exec(`BOOTLOADER=syslinux ${s} 2>&1 | tail -5`));
      console.log(`${s.slice(0, 50)}…: ${ms} ms exit ${r.exit} ${r.out.trim().split('\n').slice(-2).join(' | ')}`);
    }
    const f = await m.facts(['blk']);
    console.log(JSON.stringify(f.blk));
    screen = '';
    m.write('reboot\r');
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('no login prompt from the disk')), 600_000);
      const off = m.onOutput(() => {
        if (/login:\s*$/.test(screen)) {
          clearTimeout(t);
          off();
          resolve();
        }
      });
    });
    console.log(`booted from its disk: ${m.boot?.kind} ${m.boot?.ms} ms; screen tail: ${screen.slice(-300)}`);
    expect(m.bootFrom).toBe('disk');
    const fd = await m.facts();
    expect((fd.console as { login: boolean }).login).toBe(true);
  }, 1_800_000);
});
