// The Linux labs on real machines, end to end on the real emulator (design 00
// §6.13): every lab boots its Alpine machines in-process (the same host as the
// browser worker), runs its setup, then a reference solution step by step, and
// after each step the goals are judged exactly as the `linux.lab` widget does
// (reallab/spec.ts goalFacts + evaluateCheck). Before the solution no goal may
// pass. It needs `npm run fetch:v86` and `npm run build:lab-image` and takes
// several minutes, so it runs only on request:
//
//   V86_LINUX=1 npx vitest run tests/linux-reallab-v86.test.ts --silent=false
//   V86_LINUX=ssh,web …   only these labs (ssh, web, disk, install, access, diskexam)
//
// It prints boot, setup and check times and the node process memory.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { ACCESS_EXAM_LAB, DISK_EXAM_LAB, DISK_LAB, INSTALL_LAB, SSH_LAB, WEB_LAB } from '../src/blocks/linux/reallab/labs';
import { goalFacts, goalMachine, goalPredicates, type RealLabProps } from '../src/blocks/linux/reallab/spec';
import { createHost } from '../src/engine/v86/host';
import { V86Lab } from '../src/engine/v86/lab';
import type { MachineAssets, TransportFactory } from '../src/engine/v86/machine';

const root = fileURLToPath(new URL('..', import.meta.url));
const lab = `${root}public/v86/lab/`;
const assets = (profile: string): MachineAssets => ({
  wasm: `${root}node_modules/v86/build/v86.wasm`,
  bios: `${root}public/v86/seabios.bin`,
  vgaBios: `${root}public/v86/vgabios.bin`,
  bzimage: `${lab}vmlinuz-virt`,
  initrd: `${lab}initramfs-lab`,
  fsJson: `${lab}${profile}.fs.json`,
  filesBase: `${lab}files/`,
  cmdline: 'rw root=host9p rootfstype=9p console=ttyS0 tsc=reliable mitigations=off random.trust_cpu=on',
  kernelSha: 'test',
});
const want = (process.env.V86_LINUX ?? '').split(',');
const enabled = !!process.env.V86_LINUX && existsSync(`${lab}lab-node.fs.json`);
const on = (name: string) => enabled && (want.includes('1') || want.includes(name));

const inProcess: TransportFactory = (onMessage) => {
  const host = createHost((m) => setTimeout(() => onMessage(m), 0));
  return { post: (m) => void host(m), terminate() {} };
};
const rss = () => Math.round(process.memoryUsage().rss / 1048576);
const cleanup: (() => void)[] = [];
afterAll(() => cleanup.forEach((f) => f()));

/** Boot the lab's machines and run its setup, as the widget does. */
async function boot(props: RealLabProps): Promise<V86Lab> {
  const profile = props.machines[0].profile ?? 'lab-node';
  const l = new V86Lab({
    transport: inProcess,
    assets: assets(profile),
    nodes: props.machines.map((m, i) => ({ name: m.name, profile: m.profile ?? 'lab-node', ip: m.ip ?? `10.0.0.${11 + i}/24`, memoryMB: m.memoryMB, disks: m.disks })),
  });
  cleanup.push(() => l.dispose());
  const t0 = performance.now();
  const r0 = rss();
  const boots = await l.start();
  const tb = performance.now();
  for (const m of props.machines) for (const cmd of m.setup ?? []) {
    const r = await l.exec(m.name, cmd);
    if (r.exit) throw new Error(`setup on ${m.name} failed (${r.exit}): ${cmd}\n${r.out}`);
  }
  for (const m of props.machines) {
    const mm = l.machine(m.name);
    mm.watchPredicates(props.tasks.filter((g) => goalMachine(props, g) === m.name).flatMap(goalPredicates));
    for (const g of props.tasks) if (goalMachine(props, g) === m.name) mm.watchPaths((props.watch?.[g.id] ?? []).filter((w) => w.startsWith('/')));
  }
  console.log(`[${props.machines.map((m) => m.name).join('+')}] boot ${Math.round(tb - t0)} ms (${Object.values(boots).map((b) => `${b?.kind} ${b?.ms}`).join(', ')}), setup ${Math.round(performance.now() - tb)} ms, rss ${r0} → ${rss()} MiB`);
  return l;
}

/** Judge every goal now, like one check of the widget; returns the ids that pass. */
async function judge(l: V86Lab, props: RealLabProps): Promise<{ passed: Set<string>; ms: number; say: Record<string, string>; reach: Record<string, unknown> }> {
  const t0 = performance.now();
  const passed = new Set<string>();
  const say: Record<string, string> = {};
  const reach: Record<string, unknown> = {};
  for (const m of props.machines) {
    const gs = props.tasks.filter((g) => goalMachine(props, g) === m.name);
    if (!gs.length) continue;
    const f = await goalFacts(props, m.name, l.machine(m.name), gs);
    reach[m.name] = f.reach;
    for (const g of gs) {
      const r = evaluateCheck(g.check, f);
      if (r.pass) passed.add(g.id);
      else if (r.say) say[g.id] = r.say.en;
    }
  }
  return { passed, ms: Math.round(performance.now() - t0), say, reach };
}

type Step = { goal: string; on: string; cmds: string[] };

/** Run a reference solution: after each step its goal (and every earlier one) must pass. */
async function solve(l: V86Lab, props: RealLabProps, steps: Step[]): Promise<void> {
  const first = await judge(l, props);
  console.log(`  before the solution: ${[...first.passed].join(', ') || 'nothing passes'} (check ${first.ms} ms)`);
  expect([...first.passed]).toEqual([]);
  const done: string[] = [];
  for (const s of steps) {
    const t0 = performance.now();
    for (const c of s.cmds) {
      const r = await l.exec(s.on, c);
      if (r.exit) console.log(`  ! ${s.on}$ ${c} → exit ${r.exit}: ${r.out.trim().slice(-300)}`);
    }
    const ms = Math.round(performance.now() - t0);
    const j = await judge(l, props);
    done.push(s.goal);
    console.log(`  ${s.goal}: solution ${ms} ms, check ${j.ms} ms → ${done.every((g) => j.passed.has(g)) ? 'pass' : 'FAIL ' + JSON.stringify(j.say) + ' ' + JSON.stringify(j.reach).slice(0, 1500)}`);
    for (const g of done) expect(j.passed.has(g), `${s.goal}: ${g} (${j.say[g] ?? ''})`).toBe(true);
  }
}

describe.skipIf(!enabled)('Linux labs on the real emulator', () => {
  it.skipIf(!on('ssh'))('ssh between machines: keys, bastion, config, scp, tunnel, multiplexing', async () => {
    const l = await boot(SSH_LAB);
    const direct = await l.exec('laptop', 'ssh -o BatchMode=yes -o ConnectTimeout=3 -o StrictHostKeyChecking=no deploy@app true 2>&1');
    console.log(`  direct ssh to app: exit ${direct.exit} ${direct.out.trim()}`);
    expect(direct.out).toMatch(/timed out/);
    const pub = async () => (await l.exec('laptop', 'cat /root/.ssh/id_ed25519.pub')).out.trim();
    const authorize = async (on: string) => [`mkdir -p /home/deploy/.ssh && echo '${await pub()}' >> /home/deploy/.ssh/authorized_keys && chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys`].map((c) => ({ on, c }));
    await solve(l, SSH_LAB, [{ goal: 'keygen', on: 'laptop', cmds: ["ssh-keygen -q -t ed25519 -N '' -f /root/.ssh/id_ed25519"] }]);
    for (const x of await authorize('bastion')) await l.exec(x.on, x.c);
    for (const x of await authorize('app')) await l.exec(x.on, x.c);
    const rest: Step[] = [
      { goal: 'bastion', on: 'laptop', cmds: ['ssh-keyscan -t ed25519 bastion >> /root/.ssh/known_hosts 2>/dev/null'] },
      { goal: 'jump', on: 'laptop', cmds: ['ssh -o BatchMode=yes deploy@bastion ssh-keyscan -t ed25519 app >> /root/.ssh/known_hosts 2>/dev/null'] },
      { goal: 'config', on: 'laptop', cmds: ["printf 'Host bastion\\n    User deploy\\n\\nHost app\\n    User deploy\\n    ProxyJump bastion\\n' > /root/.ssh/config"] },
      { goal: 'scp', on: 'laptop', cmds: ['scp -q /root/release-notes.txt app:'] },
      { goal: 'tunnel', on: 'laptop', cmds: ['ssh -f -N -L 8080:localhost:8080 app'] },
      { goal: 'mux', on: 'laptop', cmds: ["printf 'Host *\\n    ControlMaster auto\\n    ControlPath ~/.ssh/cm-%%C\\n    ControlPersist 10m\\n' >> /root/.ssh/config"] },
    ];
    const t = performance.now();
    const hop = await l.exec('laptop', 'true');
    void hop;
    // keygen is already judged; continue from the next steps without the "nothing passes" check.
    const done = ['keygen'];
    for (const s of rest) {
      const t0 = performance.now();
      for (const c of s.cmds) {
        const r = await l.exec(s.on, c);
        if (r.exit) console.log(`  ! ${s.on}$ ${c} → exit ${r.exit}: ${r.out.trim().slice(-300)}`);
      }
      const ms = Math.round(performance.now() - t0);
      const j = await judge(l, SSH_LAB);
      done.push(s.goal);
      console.log(`  ${s.goal}: solution ${ms} ms, check ${j.ms} ms → ${done.every((g) => j.passed.has(g)) ? 'pass' : 'FAIL ' + JSON.stringify(j.say) + ' ' + JSON.stringify(j.reach).slice(0, 1500)}`);
      for (const g of done) expect(j.passed.has(g), `${s.goal}: ${g} (${j.say[g] ?? ''})`).toBe(true);
    }
    for (const cmd of ['ssh app hostname', 'ssh app hostname']) {
      const t0 = performance.now();
      await l.exec('laptop', cmd);
      console.log(`  ${cmd} with the master connection: ${Math.round(performance.now() - t0)} ms`);
    }
    console.log(`  ssh lab total ${Math.round(performance.now() - t)} ms, rss ${rss()} MiB`);
    l.dispose();
  }, 1_500_000);

  it.skipIf(!on('web'))('nginx for the neighbour and services on OpenRC', async () => {
    const l = await boot(WEB_LAB);
    await solve(l, WEB_LAB, [
      { goal: 'server', on: 'web', cmds: ["printf 'server {\\n listen 80;\\n server_name web;\\n root /srv/shop;\\n index index.html;\\n}\\n' > /etc/nginx/http.d/shop.conf"] },
      { goal: 'start', on: 'web', cmds: ['rc-service nginx start', 'rc-update add nginx default'] },
      { goal: 'neighbour', on: 'client', cmds: ['true'] },
      { goal: 'service', on: 'web', cmds: ["printf '#!/sbin/openrc-run\\ncommand=/usr/local/bin/report\\ncommand_background=true\\npidfile=/run/report.pid\\n' > /etc/init.d/report && chmod +x /etc/init.d/report", 'rc-service report start', 'rc-update add report default'] },
      { goal: 'respawn', on: 'web', cmds: ["sed -i -e 's/^command_background=true$/supervisor=supervise-daemon/' -e '/^pidfile=/d' /etc/init.d/report", 'rc-service report restart'] },
      { goal: 'health', on: 'web', cmds: ["printf 'server {\\n listen 80;\\n server_name web;\\n root /srv/shop;\\n index index.html;\\n location = /health { return 200 ok; }\\n}\\n' > /etc/nginx/http.d/shop.conf", 'nginx -t && rc-service nginx reload', 'sleep 1'] },
    ]);
    l.dispose();
  }, 900_000);

  it.skipIf(!on('disk'))('the partition is full: lsof, the deleted log, lvextend, tune2fs', async () => {
    const l = await boot(DISK_LAB);
    console.log(`  df before: ${(await l.exec('app', 'df -h /srv/shop | tail -1; du -sh /srv/shop')).out.trim().replace(/\n/g, ' | ')}`);
    console.log(`  lsof +L1: ${(await l.exec('app', 'lsof +L1 2>/dev/null | tail -n +2')).out.trim()}`);
    await solve(l, DISK_LAB, [
      { goal: 'culprit', on: 'app', cmds: ["lsof +L1 2>/dev/null | awk '/debug.log/{print $2; exit}' > /root/culprit.txt"] },
      { goal: 'free', on: 'app', cmds: ['rm -f /srv/shop/cache/build.bin', ': > /proc/$(pgrep -x legacy-agent)/fd/3'] },
      { goal: 'grow', on: 'app', cmds: ['lvextend -q -r -L 220M data/shop 2>&1 | tail -2'] },
      { goal: 'reserved', on: 'app', cmds: ['tune2fs -m 1 /dev/data/shop >/dev/null'] },
    ]);
    l.dispose();
  }, 900_000);

  it.skipIf(!on('diskexam'))('the disk exam in the tab: the cron job and the rest', async () => {
    const l = await boot(DISK_EXAM_LAB);
    await solve(l, DISK_EXAM_LAB, [
      { goal: 'space', on: 'app', cmds: ['rm -f /srv/shop/cache/*', ': > /proc/$(pgrep -x legacy-agent)/fd/3'] },
      { goal: 'cron', on: 'app', cmds: ["sed -i '/srv\\/shop\\/cache\\/dump/d' /etc/crontabs/root", 'rm -f /srv/shop/cache/*'] },
      { goal: 'grow', on: 'app', cmds: ['lvextend -q -r -L 220M data/shop >/dev/null 2>&1'] },
      { goal: 'reserved', on: 'app', cmds: ['tune2fs -m 1 /dev/data/shop >/dev/null'] },
    ]);
    l.dispose();
  }, 900_000);

  it.skipIf(!on('access'))('the access exam in the tab', async () => {
    const l = await boot(ACCESS_EXAM_LAB);
    await l.exec('laptop', "su - maria -c \"ssh-keygen -q -t ed25519 -N '' -f ~/.ssh/id_ed25519\"");
    const pub = (await l.exec('laptop', 'cat /home/maria/.ssh/id_ed25519.pub')).out.trim();
    await solve(l, ACCESS_EXAM_LAB, [
      { goal: 'account', on: 'server', cmds: ["adduser -D -s /bin/bash -G devs maria && sed -i 's/^maria:!:/maria:*:/' /etc/shadow", `mkdir -p /home/maria/.ssh && echo '${pub}' > /home/maria/.ssh/authorized_keys && chown -R maria /home/maria/.ssh && chmod 700 /home/maria/.ssh && chmod 600 /home/maria/.ssh/authorized_keys`] },
      { goal: 'login', on: 'laptop', cmds: ["su - maria -c 'ssh-keyscan -t ed25519 server >> ~/.ssh/known_hosts 2>/dev/null'"] },
      { goal: 'releases', on: 'server', cmds: ['mkdir -p /srv/releases && chgrp devs /srv/releases && chmod 2770 /srv/releases'] },
      { goal: 'sudo', on: 'server', cmds: ["echo 'maria ALL=(root) NOPASSWD: /sbin/rc-service orders restart' > /etc/sudoers.d/maria && chmod 440 /etc/sudoers.d/maria"] },
      { goal: 'nopass', on: 'server', cmds: ["printf 'PasswordAuthentication no\\nKbdInteractiveAuthentication no\\n' > /etc/ssh/sshd_config.d/00-keys.conf && sshd -t && rc-service sshd reload"] },
      { goal: 'offer', on: 'laptop', cmds: ['sleep 1'] },
      { goal: 'allowgroups', on: 'server', cmds: ["echo 'AllowGroups devs' >> /etc/ssh/sshd_config.d/00-keys.conf && sshd -t && rc-service sshd reload", 'sleep 1'] },
    ]);
    l.dispose();
  }, 900_000);

  it.skipIf(!on('install'))('installing Alpine onto the blank disk and booting it', async () => {
    const l = await boot(INSTALL_LAB);
    const m = l.machine('new');
    let screen = '';
    m.onOutput((t) => (screen += t));
    await solve(l, INSTALL_LAB, [
      { goal: 'gpt', on: 'new', cmds: ["printf 'label: gpt\\n,2M,21686148-6449-6E6F-744E-656564454649\\n,200M,L\\n,,V\\n' | sfdisk -q /dev/sda"] },
      { goal: 'lvm', on: 'new', cmds: ['pvcreate -q /dev/sda3 && vgcreate -q vg0 /dev/sda3 && lvcreate -q -y -L 640M -n root vg0'] },
      { goal: 'mkfs', on: 'new', cmds: ['mkfs.ext4 -q /dev/sda2 && mkfs.ext4 -q /dev/vg0/root'] },
      { goal: 'mount', on: 'new', cmds: ['mount -t ext4 /dev/vg0/root /mnt && mkdir -p /mnt/boot && mount -t ext4 /dev/sda2 /mnt/boot'] },
      { goal: 'install', on: 'new', cmds: ['BOOTLOADER=grub setup-disk -m sys /mnt >/dev/null 2>&1'] },
      { goal: 'identity', on: 'new', cmds: ["echo shop-01 > /mnt/etc/hostname && echo 'root:Lab-2026' | chpasswd -R /mnt", 'sync'] },
    ]);
    const t0 = performance.now();
    screen = '';
    m.write('reboot\r');
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no login prompt from the disk: ' + screen.slice(-600))), 300_000);
      const off = m.onOutput(() => {
        if (/shop-01 login:\s*$/.test(screen)) {
          clearTimeout(timer);
          off();
          resolve();
        }
      });
    });
    console.log(`  reboot into the installed system: ${Math.round(performance.now() - t0)} ms`);
    const j = await judge(l, INSTALL_LAB);
    console.log(`  after the reboot: ${[...j.passed].join(', ')}`);
    expect(j.passed.has('boot')).toBe(true);
    l.dispose();
  }, 1_500_000);
});

describe.skipIf(!on('bench'))('what a check costs on one lab machine', () => {
  it('facts, scopes and probes', async () => {
    const l = await boot({ ...WEB_LAB, machines: [WEB_LAB.machines[0]] });
    const m = l.machine('web');
    const time = async (what: string, fn: () => Promise<unknown>) => {
      const t0 = performance.now();
      await fn();
      console.log(`  ${what}: ${Math.round(performance.now() - t0)} ms`);
    };
    console.log((await m.exec('ls -la /etc/nginx/http.d /etc/nginx/conf.d 2>&1; ls /var/lib/nginx/html')).out);
    await time('facts (no scopes)', () => m.facts());
    await time('facts svc+listen', () => m.facts(['svc', 'listen']));
    await time('facts blk', () => m.facts(['blk']));
    await time('exec true', () => m.exec('true'));
    await time('exec nginx -t', () => m.exec("nginx -t -g 'pid /tmp/x.pid;'"));
    await time('exec pgrep', () => m.exec('pgrep -f report'));
    await time('exec df|awk', () => m.exec("df -Pk / | awk 'NR==2{print $4}'"));
    await time('exec lsof +L1', () => m.exec('lsof -nP +L1'));
    l.dispose();
  }, 600_000);
});
