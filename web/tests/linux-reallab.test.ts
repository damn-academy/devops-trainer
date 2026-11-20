// The Linux labs on real machines (design 00 §6.13) without the emulator:
// every goal compiles and follows the task rules the linter applies to
// terminal tasks, the lessons and pages are wired, the pure judging helpers
// work, and the checks pass and fail on recorded facts of the right shape.
// The reference solutions on the real emulator: tests/linux-reallab-v86.test.ts.

import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { lintRegistry } from '../src/core/lint';
import { compile, readsTypedText } from '../src/core/predicate';
import { registry } from '../src/core/registry';
import type { Facts, WidgetSection } from '../src/core/types';
import { ACCESS_EXAM_LAB, DISK_EXAM_LAB, DISK_LAB, INSTALL_EXAM, INSTALL_LAB, LAB_PAGES, SSH_LAB, WEB_LAB } from '../src/blocks/linux/reallab/labs';
import { goalProbes, labMemoryMB, labScore, probesNamed, withProbes, type RealLabProps } from '../src/blocks/linux/reallab/spec';

const ALL: Record<string, RealLabProps> = { SSH_LAB, WEB_LAB, INSTALL_LAB, DISK_LAB, INSTALL_EXAM, DISK_EXAM_LAB, ACCESS_EXAM_LAB };

const facts = (extra: Partial<Facts> & Record<string, unknown> = {}): Facts =>
  ({ schema: 'dt.facts/v1', env: { kind: 'v86' }, user: { name: 'root', uid: 0, gid: 0 }, cwd: '/root', hostname: 'x', vars: {}, procs: [], files: {}, term: { main: [] }, users: [], groups: [], ...extra }) as Facts;
const reach = (r: Record<string, { exit?: number; out?: string }>) => ({ reach: r });

describe('linux labs on real machines: the frame', () => {
  it('the Linux block has no lint errors or warnings', () => {
    const mine = lintRegistry(registry).filter((i) => /linux\.(ssh-hops|web-openrc|install|disk-real|ssh-session|q\.(hostkey|key-not|proxyjump|tunnel|openrc|respawn|nginx|install|initramfs|bios|truncate|lvextend))/.test(i.where));
    expect(mine.map((i) => `${i.level} ${i.where}: ${i.msg}`)).toEqual([]);
  });

  for (const [name, lab] of Object.entries(ALL)) {
    it(`${name}: goals compile, never read typed text, name known machines and probes, and follow the ladder`, () => {
      const machines = new Set(lab.machines.map((m) => m.name));
      const probes = new Set((lab.probes ?? []).map((p) => p.id));
      for (const p of lab.probes ?? []) expect(machines.has(p.on), `${name} probe ${p.id}`).toBe(true);
      for (const g of lab.tasks) {
        if (g.on) expect(machines.has(g.on), `${name}.${g.id}`).toBe(true);
        for (const src of [g.check.when, ...(g.check.fail ?? []).map((f) => f.if)]) {
          if (typeof src !== 'string') continue;
          expect(() => compile(src), `${name}.${g.id}: ${src}`).not.toThrow();
          for (const id of probesNamed(src)) expect(probes.has(id), `${name}.${g.id} probe ${id}`).toBe(true);
        }
        if (typeof g.check.when === 'string') expect(readsTypedText(g.check.when), `${name}.${g.id}`).toBe(false);
        for (const w of lab.watch?.[g.id] ?? []) if (w.startsWith('probe:')) expect(probes.has(w.slice(6)), `${name}.${g.id} watch ${w}`).toBe(true);
        if (g.docStep === 4) {
          expect(g.beyond, `${name}.${g.id}`).toBe(true);
          expect(Object.keys(g.hints ?? {}).filter((k) => k !== 'H1'), `${name}.${g.id}`).toEqual([]);
          expect(g.solutionTokens?.length, `${name}.${g.id}`).toBeGreaterThan(0);
        }
        if (lab.mode === 'exam') expect(g.hints, `${name}.${g.id}: no hints in an exam`).toBeUndefined();
        if (lab.mode !== 'exam' && !g.beyond) expect(g.hints?.H1 ?? g.chips, `${name}.${g.id}: a hint or a chip`).toBeTruthy();
      }
    });
  }

  it('four lessons mount the lab widget, and the pages are registered', () => {
    const lessons = ['linux.ssh-hops', 'linux.web-openrc', 'linux.install', 'linux.disk-real'];
    for (const id of lessons) {
      const l = registry.lessons.get(id)!;
      expect(l, id).toBeTruthy();
      expect(l.sections.some((s) => s.kind === 'widget' && (s as WidgetSection).widget === 'linux.lab'), id).toBe(true);
      expect(registry.blocks.get('linux')!.lessons).toContain(id);
    }
    for (const id of Object.keys(LAB_PAGES)) expect(registry.widgets.has(`lab:${id}`), id).toBe(true);
    expect(registry.widgets.has('linux.lab')).toBe(true);
    for (const id of ['linux.ssh-session', 'linux.install']) expect(registry.explainers.has(id), id).toBe(true);
  });

  it('the exams on own machines point to their in-browser variants', () => {
    expect(registry.exams.get('linux.exam.disk')!.intro.ru).toContain('#/lab/linux-disk');
    expect(registry.exams.get('linux.exam.access')!.intro.en).toContain('#/lab/linux-access');
  });

  it('memory and score helpers', () => {
    expect(labMemoryMB(SSH_LAB)).toBe(3 * (128 + 60));
    expect(labMemoryMB(INSTALL_LAB)).toBe(160 + 60);
    const r = labScore(INSTALL_EXAM.tasks, new Set(['layout', 'volumes', 'root', 'boot']), 0.75);
    expect(r).toEqual({ score: 0.8, critical: true, passed: true });
    expect(labScore(INSTALL_EXAM.tasks, new Set(['layout', 'volumes', 'root', 'logs'])).passed).toBe(false);
    expect(goalProbes(SSH_LAB, SSH_LAB.tasks.find((t) => t.id === 'config')!).map((p) => p.id).sort()).toEqual(['app', 'cfg']);
    expect(goalProbes(SSH_LAB, SSH_LAB.tasks.find((t) => t.id === 'mux')!).map((p) => p.id)).toEqual(['cfg']);
    expect((withProbes(facts(), { a: { exit: 0, out: 'x' } }).reach as Record<string, unknown>).a).toEqual({ exit: 0, out: 'x' });
  });
});

describe('linux labs on real machines: checks on recorded facts', () => {
  const task = (lab: RealLabProps, id: string) => lab.tasks.find((t) => t.id === id)!;
  const pass = (lab: RealLabProps, id: string, f: Facts) => evaluateCheck(task(lab, id).check, f).pass;
  const say = (lab: RealLabProps, id: string, f: Facts) => evaluateCheck(task(lab, id).check, f).say?.en ?? '';

  it('ssh: the config goal reads ssh -G, the tunnel goal needs the listener and the page', () => {
    const cfg = 'user deploy\nhostname app\nproxyjump bastion\ncontrolmaster auto\ncontrolpath ~/.ssh/cm-%C\ncontrolpersist 600\n';
    expect(pass(SSH_LAB, 'config', facts(reach({ cfg: { exit: 0, out: cfg }, app: { exit: 0, out: 'app\n' } })))).toBe(true);
    expect(say(SSH_LAB, 'config', facts(reach({ cfg: { exit: 0, out: 'user root\nhostname app\n' }, app: { exit: 255, out: '' } })))).toContain('User deploy');
    expect(pass(SSH_LAB, 'mux', facts(reach({ cfg: { exit: 0, out: cfg } })))).toBe(true);
    expect(pass(SSH_LAB, 'mux', facts(reach({ cfg: { exit: 0, out: 'controlmaster auto\ncontrolpath ~/.ssh/x\ncontrolpersist no\n' } })))).toBe(false);
    const listening = { listen: [{ proto: 'tcp', addr: '127.0.0.1', port: 8080, proc: 'ssh' }] };
    expect(pass(SSH_LAB, 'tunnel', facts({ ...listening, ...reach({ tunnel: { exit: 0, out: '<h1>orders admin</h1>' } }) }))).toBe(true);
    expect(say(SSH_LAB, 'tunnel', facts({ ...listening, ...reach({ tunnel: { exit: 7, out: '' } }) }))).toContain('To the right of `-L`');
    expect(say(SSH_LAB, 'bastion', facts(reach({ bastion: { exit: 255, out: 'Host key verification failed.' } })))).toContain('host key');
  });

  it('web: start without enable is explained, and the health page needs code 200', () => {
    const started = { svc: [{ name: 'nginx', state: 'started', runlevels: [] }], listen: [{ proto: 'tcp', addr: '0.0.0.0', port: 80, proc: 'nginx' }] };
    expect(say(WEB_LAB, 'start', facts(started))).toContain('rc-update');
    expect(pass(WEB_LAB, 'start', facts({ ...started, svc: [{ name: 'nginx', state: 'started', runlevels: ['default'] }] }))).toBe(true);
    expect(pass(WEB_LAB, 'health', facts(reach({ health: { exit: 0, out: 'ok 200' } })))).toBe(true);
    expect(pass(WEB_LAB, 'health', facts(reach({ health: { exit: 0, out: '<html>404</html> 404' } })))).toBe(false);
    const notExec = facts({ files: { '/etc/init.d/report': { exists: true, type: 'f', mode: '0644' } } });
    expect(say(WEB_LAB, 'service', notExec)).toContain('chmod +x');
  });

  it('install: the partition types, the mounts, the identity and the boot from disk', () => {
    const blk = [
      { name: 'sda', path: '/dev/sda', type: 'disk', size: 2 << 30 },
      { name: 'sda1', path: '/dev/sda1', type: 'part', size: 2 << 20, parttype: 'BIOS boot' },
      { name: 'sda2', path: '/dev/sda2', type: 'part', size: 200 << 20, parttype: 'Linux filesystem', fstype: 'ext4', uuid: 'b21f' },
      { name: 'sda3', path: '/dev/sda3', type: 'part', size: 1800 << 20, parttype: 'Linux LVM', fstype: 'LVM2_member' },
      { name: 'vg0-root', path: '/dev/mapper/vg0-root', type: 'lvm', size: 640 << 20, fstype: 'ext4' },
    ];
    expect(pass(INSTALL_LAB, 'gpt', facts({ blk }))).toBe(true);
    expect(pass(INSTALL_LAB, 'mkfs', facts({ blk }))).toBe(true);
    const mounts = [
      { src: '/dev/vg0/root', target: '/mnt', fstype: 'ext4', opts: ['rw'] },
      { src: '/dev/sda2', target: '/mnt/boot', fstype: 'ext4', opts: ['rw'] },
    ];
    expect(pass(INSTALL_LAB, 'mount', facts({ mounts }))).toBe(true);
    const files = { '/mnt/etc/hostname': { exists: true, text: 'shop-01\n' }, '/mnt/etc/shadow': { exists: true, text: 'root::0:::::\n' } };
    expect(say(INSTALL_LAB, 'identity', facts({ files }))).toContain('empty password');
    expect(pass(INSTALL_LAB, 'identity', facts({ files: { ...files, '/mnt/etc/shadow': { exists: true, text: 'root:$6$abc:20000:0:::::\n' } } }))).toBe(true);
    const disk = facts({ env: { kind: 'v86', bootFrom: 'disk' } as unknown as Facts['env'], console: { text: 'Welcome to Alpine Linux 3.24\n\nshop-01 login: ', login: true } });
    expect(pass(INSTALL_LAB, 'boot', disk)).toBe(true);
    expect(say(INSTALL_LAB, 'boot', facts({ env: { kind: 'v86', bootFrom: 'disk' } as unknown as Facts['env'], console: { text: 'localhost login: ' } }))).toContain('shop-01');
  });

  it('install exam: logs by the UUID of sys-logs', () => {
    const blk = [{ name: 'sys-logs', path: '/dev/mapper/sys-logs', type: 'lvm', size: 200 << 20, fstype: 'ext4', uuid: '1111-2222' }];
    expect(pass(INSTALL_EXAM, 'logs', facts({ blk, files: { '/mnt/etc/fstab': { exists: true, text: 'UUID=1111-2222 /var/log ext4 defaults 0 2\n' } } }))).toBe(true);
    expect(pass(INSTALL_EXAM, 'logs', facts({ blk, files: { '/mnt/etc/fstab': { exists: true, text: '/dev/sys/logs /var/log ext4 defaults 0 2\n' } } }))).toBe(false);
  });

  it('disk: free space only with the agent alive and the orders intact', () => {
    const r = (free: number, agent = true, orders = 40) => facts(reach({ free: { exit: 0, out: String(free) }, agent: { exit: agent ? 0 : 1, out: agent ? '812\n' : '' }, app: { exit: 0, out: '900\n' }, orders: { exit: 0, out: `${orders}\n` } }));
    expect(pass(DISK_LAB, 'free', r(80_000))).toBe(true);
    expect(say(DISK_LAB, 'free', r(80_000, false))).toContain('agent was stopped');
    expect(say(DISK_LAB, 'free', r(40_000))).toContain('deleted log');
    expect(pass(DISK_LAB, 'free', r(80_000, true, 39))).toBe(false);
    const culprit = facts({ files: { '/root/culprit.txt': { exists: true, text: '812\n' } }, ...reach({ holders: { exit: 0, out: '812\n815\n' } }) });
    expect(pass(DISK_LAB, 'culprit', culprit)).toBe(true);
    expect(pass(DISK_LAB, 'reserved', facts(reach({ reserved: { exit: 0, out: '0.0100' } })))).toBe(true);
    expect(pass(DISK_LAB, 'reserved', facts(reach({ reserved: { exit: 0, out: '0.0500' } })))).toBe(false);
  });

  it('access exam: the sudo rule must be narrow and parse', () => {
    const narrow = 'User maria may run the following commands on server:\n    (root) NOPASSWD: /sbin/rc-service orders restart\n';
    const ok = facts(reach({ sudo: { exit: 0, out: narrow }, visudo: { exit: 0, out: '/etc/sudoers: parsed OK' } }));
    expect(pass(ACCESS_EXAM_LAB, 'sudo', ok)).toBe(true);
    expect(pass(ACCESS_EXAM_LAB, 'sudo', facts(reach({ sudo: { exit: 0, out: narrow + '    (ALL) ALL\n' }, visudo: { exit: 0, out: '' } })))).toBe(false);
    const rel = facts({ files: { '/srv/releases': { exists: true, type: 'd', mode: '2770', group: 'devs' } } });
    expect(pass(ACCESS_EXAM_LAB, 'releases', rel)).toBe(true);
    expect(pass(ACCESS_EXAM_LAB, 'releases', facts({ files: { '/srv/releases': { exists: true, type: 'd', mode: '0770', group: 'devs' } } }))).toBe(false);
  });
});

describe('linux labs on real machines: which goals skip the general facts', () => {
  it('probe-only goals are recognised', async () => {
    const { probeOnly } = await import('../src/blocks/linux/reallab/spec');
    const t = (lab: RealLabProps, id: string) => probeOnly(lab, lab.tasks.find((g) => g.id === id)!);
    expect(t(SSH_LAB, 'bastion')).toBe(true);
    expect(t(SSH_LAB, 'mux')).toBe(true);
    expect(t(SSH_LAB, 'keygen')).toBe(false);
    // the tunnel and the copied file are judged by probes from the laptop, so they pass whenever they are done, not only when current
    expect(t(SSH_LAB, 'tunnel')).toBe(true);
    expect(t(SSH_LAB, 'scp')).toBe(true);
    expect(t(WEB_LAB, 'neighbour')).toBe(true);
    expect(t(WEB_LAB, 'server')).toBe(false);
    expect(t(DISK_LAB, 'free')).toBe(true);
    expect(t(DISK_LAB, 'grow')).toBe(false);
    expect(t(DISK_LAB, 'culprit')).toBe(false);
    expect(t(INSTALL_LAB, 'boot')).toBe(false);
  });
});
