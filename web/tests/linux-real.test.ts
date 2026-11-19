// The Linux learning exams disk, isolation and access. Isolation runs on the
// simulator: every task fails at the start and passes after a reference
// solution, the shortcuts are explained, and the DL5 pages open with `man`.
// Disk and access run on the learner's machines: their scripts are valid
// bash, and every goal fails right after the preparation and holds in the
// solved state.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { lintRegistry } from '../src/core/lint';
import { registry } from '../src/core/registry';
import type { ExamTask, Task, TerminalSetup } from '../src/core/types';
import { ISOLATION_EXAM } from '../src/blocks/linux/exam-isolation';
import { ACCESS_EXAM, DISK_EXAM } from '../src/blocks/linux/exam-real';
import { lintExam } from '../src/engine/quiz/exam';
import { createSimMachine, stripAnsi } from '../src/engine/terminal/shell';
import { blob, failing, machines, say } from './real-blob';

const EXAMS = [DISK_EXAM, ISOLATION_EXAM, ACCESS_EXAM];

describe('Linux learning exams: the frame', () => {
  it('are registered on the Linux block and follow the exam frame', () => {
    for (const ex of EXAMS) {
      expect(registry.exams.get(ex.id)).toBe(ex);
      expect([ex.id, lintExam(ex)]).toEqual([ex.id, []]);
    }
    expect(lintRegistry(registry).filter((i) => i.level === 'error' && /linux\.exam\.(disk|isolation|access)/.test(i.where))).toEqual([]);
  });

  it('the preparation scripts are valid bash', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dt-linux-'));
    for (const s of [...(DISK_EXAM.real!.prepare ?? []), ...(ACCESS_EXAM.real!.prepare ?? [])]) {
      const p = join(dir, s.name);
      writeFileSync(p, s.text);
      expect(() => execFileSync('bash', ['-n', p]), s.name).not.toThrow();
    }
  });
});

// ── isolation, on the simulator ──

const simTask = (id: string) => {
  const t = ISOLATION_EXAM.tasks.find((x) => x.id === id) as ExamTask & { kind: 'task'; setup: TerminalSetup; task: Task };
  if (!t || t.kind !== 'task') throw new Error(`no task ${id}`);
  return t;
};

const DROPIN = (lines: string) => [`sudo mkdir -p /etc/systemd/system/batch.service.d`, `printf '[Service]\\n${lines}\\n' | sudo tee /etc/systemd/system/batch.service.d/limits.conf`, 'sudo systemctl daemon-reload', 'sudo systemctl restart batch'];

const SOLUTIONS: Record<string, string[]> = {
  mem: DROPIN('MemoryMax=64M'),
  pids: DROPIN('TasksMax=50'),
  user: ['sudo useradd --system --shell /usr/sbin/nologin batch', 'sudo sed -i s/User=root/User=batch/ /etc/systemd/system/batch.service', 'sudo systemctl daemon-reload', 'sudo systemctl restart batch'],
  weight: DROPIN('CPUWeight=20'),
  oom: ['sudo mkdir -p /etc/systemd/system/api.service.d', "printf '[Service]\\nOOMScoreAdjust=-500\\n' | sudo tee /etc/systemd/system/api.service.d/oom.conf", 'sudo systemctl daemon-reload', 'sudo systemctl restart api'],
};

async function runTask(id: string, lines: string[]) {
  const t = simTask(id);
  const m = await createSimMachine(t.setup);
  const start = await m.facts();
  const before = evaluateCheck(t.task.check, start, start);
  let out = '';
  for (const l of lines) out += stripAnsi((await m.exec(l)).out);
  return { before, after: evaluateCheck(t.task.check, await m.facts(), start), out, m };
}

describe('linux.exam.isolation on the simulator', () => {
  for (const [id, lines] of Object.entries(SOLUTIONS)) {
    it(`${id}: fails at the start, passes after the reference solution`, async () => {
      const r = await runTask(id, lines);
      expect(r.before.pass).toBe(false);
      expect([id, r.after.pass, r.out.slice(-400)]).toEqual([id, true, r.out.slice(-400)]);
    });
  }

  it('a limit written into /sys by hand does not count: systemd owns the service cgroup', async () => {
    const r = await runTask('mem', ['echo 64M | sudo tee /sys/fs/cgroup/system.slice/batch.service/memory.max', 'sudo systemctl restart batch']);
    expect(r.after.pass).toBe(false);
    expect(r.after.say?.en).toMatch(/kept in its unit file/);
  });

  it('a limit without a restart is explained', async () => {
    const r = await runTask('mem', DROPIN('MemoryMax=64M').slice(0, 3));
    expect(r.after.pass).toBe(false);
    expect(r.after.say?.en).toMatch(/daemon-reload/);
  });

  it('a user that does not exist leaves the service down, and the reason is named', async () => {
    const r = await runTask('user', ['sudo sed -i s/User=root/User=batch/ /etc/systemd/system/batch.service', 'sudo systemctl daemon-reload', 'sudo systemctl restart batch']);
    expect(r.after.pass).toBe(false);
    expect(r.after.say?.en).toMatch(/no such user/);
  });

  it('an ordinary login account does not count as a service user', async () => {
    const r = await runTask('user', ['sudo useradd -m -s /bin/bash batch', 'sudo sed -i s/User=root/User=batch/ /etc/systemd/system/batch.service', 'sudo systemctl daemon-reload', 'sudo systemctl restart batch']);
    expect(r.after.pass).toBe(false);
  });

  it('the DL5 tasks carry no hints, and their pages open with man', async () => {
    for (const id of ['weight', 'oom']) {
      const t = simTask(id).task;
      expect(t.docStep).toBe(5);
      expect(t.hints).toBeUndefined();
      expect(t.solutionTokens?.length).toBeGreaterThan(0);
    }
    const m = await createSimMachine(ISOLATION_SETUP_FOR_MAN);
    expect(stripAnsi((await m.exec('man systemd.resource-control')).out + JSON.stringify((await m.exec('man systemd.resource-control')).effects ?? []))).toMatch(/CPUWeight/);
    expect(JSON.stringify((await m.exec('man systemd.exec')).effects ?? []) + (await m.exec('man systemd.exec')).out).toMatch(/systemd\.exec|OOMScoreAdjust/);
  });
});

const ISOLATION_SETUP_FOR_MAN: TerminalSetup = {};

// ── disk, on the learner's machine ──

const df = (avail: number) => `Filesystem     1024-blocks   Used Available Capacity Mounted on\n/dev/vda1          5000000 2000000   3000000      40% /\n/dev/loop0          159564 ${159564 - avail} ${avail}      ${Math.round(((159564 - avail) / 159564) * 100)}% /srv/shop`;
const FINDMNT = '/dev/vda1 / ext4 rw,relatime\n/dev/loop0 /srv/shop ext4 rw,relatime';
const HASH = 'a'.repeat(64);
const unit = (active: string) => ({ show: `Id=x.service\nActiveState=${active}\nSubState=running\nUnitFileState=enabled\nUser=\nNRestarts=0` });
const f = (text: string, mode = '644') => ({ exists: true, type: 'f', mode, owner: 'root', group: 'root', size: text.length, text });

function diskStart() {
  return blob('app-01', 'linux-disk', {
    raw: { findmnt: FINDMNT, df: df(600), journald: '# /etc/systemd/journald.conf\n[Journal]\n#SystemMaxUse=\n' },
    trees: { '/srv/shop/lib/orders': HASH },
    files: { '/var/lib/dt-trainer/disk.start': f(`${HASH}\n`, '600'), '/etc/cron.d/legacy-dump': f('# legacy reporting: a fresh dump every two minutes\n*/2 * * * * root head -c 1M /dev/urandom > /srv/shop/backups/legacy/dump-$(date +\\%s).bin\n'), '/etc/logrotate.d/legacy': { exists: false } },
    units: { 'orders.service': unit('active'), 'legacy-agent.service': unit('active') },
  });
}

const ROTATE = '/srv/shop/log/legacy/*.log {\n    weekly\n    rotate 5\n    compress\n    missingok\n    notifempty\n    copytruncate\n}\n';

function diskSolved() {
  const b = diskStart();
  b.raw.df = df(72000);
  b.raw.journald = '# /etc/systemd/journald.conf\n[Journal]\n#SystemMaxUse=\n\n# /etc/systemd/journald.conf.d/size.conf\n[Journal]\nSystemMaxUse=50M\n';
  b.raw['logrotate:/etc/logrotate.d/legacy'] = 'reading config file /etc/logrotate.d/legacy\nHandling 1 logs\nrotating pattern: /srv/shop/log/legacy/*.log  weekly (5 rotations)\nempty log files are not rotated, old logs are removed\n';
  b.files['/etc/cron.d/legacy-dump'] = f('# legacy reporting: switched off after the incident of 18.11\n# */2 * * * * root head -c 1M /dev/urandom > /srv/shop/backups/legacy/dump-$(date +\\%s).bin\n');
  b.files['/etc/logrotate.d/legacy'] = f(ROTATE);
  return b;
}

describe('linux.exam.disk on a real machine', () => {
  it('right after the preparation every card is still to do', async () => {
    const m = await machines(DISK_EXAM, [diskStart()]);
    expect(failing(DISK_EXAM, 'free', m)).toEqual(['space']);
    expect(failing(DISK_EXAM, 'cron', m)).toEqual(['cron']);
    expect(failing(DISK_EXAM, 'rotate', m)).toEqual(['pattern', 'keep', 'truncate']);
    expect(failing(DISK_EXAM, 'journal', m)).toEqual(['max']);
  });

  it('every goal holds in the solved state', async () => {
    const m = await machines(DISK_EXAM, [diskSolved()]);
    for (const t of DISK_EXAM.tasks) if (t.kind === 'real' && t.real.goals) expect([t.id, failing(DISK_EXAM, t.id, m)]).toEqual([t.id, []]);
  });

  it('only the cache and the temporary files deleted: not enough, and the reason points at df and du', async () => {
    const b = diskStart();
    b.raw.df = df(26000);
    const m = await machines(DISK_EXAM, [b]);
    expect(say(DISK_EXAM, 'free', 'space', m)).toMatch(/`df` and `du` disagree/);
  });

  it('space freed by deleting the shop data does not count', async () => {
    const b = diskSolved();
    b.trees['/srv/shop/lib/orders'] = 'b'.repeat(64);
    const m = await machines(DISK_EXAM, [b]);
    expect(failing(DISK_EXAM, 'free', m)).toEqual(['data']);
  });

  it('a rotation that renames the open log is explained', async () => {
    const b = diskSolved();
    b.files['/etc/logrotate.d/legacy'] = f(ROTATE.replace('    copytruncate\n', ''));
    const m = await machines(DISK_EXAM, [b]);
    expect(say(DISK_EXAM, 'rotate', 'truncate', m)).toMatch(/cannot reopen/);
  });
});

// ── access, on two of the learner's machines ──

const PASSWD = 'root:0:0:/root:/bin/bash\nadmin:1000:1000:/home/admin:/bin/bash\nalex:1001:1001:/home/alex:/bin/bash';
const GROUP = 'root:x:0:\nsudo:x:27:admin\nadmin:x:1000:\nalex:x:1001:\ndevs:x:1002:alex';
const SSHD_START = 'port 22\npermitrootlogin without-password\npubkeyauthentication yes\npasswordauthentication yes\nkbdinteractiveauthentication yes\nusepam yes';
const dir = (owner: string, group: string, mode: string) => ({ exists: true, type: 'd', mode, owner, group, size: 4096 });

function accessStart() {
  return [
    blob('server', 'linux-access', { raw: { passwd: PASSWD, group: GROUP, sshd_T: SSHD_START, visudo: '/etc/sudoers: parsed OK\n/etc/sudoers.d/README: parsed OK\nexit=0', 'sudo_l:maria': 'sudo: unknown user maria' }, files: { '/home/maria/.ssh': { exists: false }, '/home/maria/.ssh/authorized_keys': { exists: false }, '/srv/releases': { exists: false } } }),
    blob('laptop', 'linux-access', { raw: { passwd: 'root:0:0:/root:/bin/bash\nmaria:1001:1001:/home/maria:/bin/bash', group: 'root:x:0:\nmaria:x:1001:' }, files: { '/home/maria/.ssh/known_hosts': { exists: false } }, probes: { keyin: { kind: 'ssh', exit: 255, methods: 'debug1: Authentications that can continue: publickey,password,keyboard-interactive' } } }),
  ];
}

function accessSolved() {
  const [server, laptop] = accessStart();
  server.raw.passwd += '\nmaria:1003:1003:/home/maria:/bin/bash';
  server.raw.group = GROUP.replace('devs:x:1002:alex', 'devs:x:1002:alex,maria,admin') + '\nmaria:x:1003:';
  server.raw.sshd_T = 'port 22\npubkeyauthentication yes\npasswordauthentication no\nkbdinteractiveauthentication no\nusepam yes\nallowgroups devs';
  server.raw['sudo_l:maria'] = 'Matching Defaults entries for maria on server:\n    env_reset, mail_badpass\n\nUser maria may run the following commands on server:\n    (root) NOPASSWD: /usr/bin/systemctl restart orders\n';
  server.files['/home/maria/.ssh'] = dir('maria', 'maria', '700');
  server.files['/home/maria/.ssh/authorized_keys'] = { ...f('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExample maria@laptop\n', '600'), owner: 'maria', group: 'maria' };
  server.files['/srv/releases'] = dir('root', 'devs', '2770');
  laptop.files['/home/maria/.ssh/known_hosts'] = { ...f('|1|abc= ssh-ed25519 AAAA\n', '644'), owner: 'maria', group: 'maria' };
  laptop.probes.keyin = { kind: 'ssh', exit: 0, methods: 'debug1: Authentications that can continue: publickey' };
  return [server, laptop];
}

describe('linux.exam.access on two real machines', () => {
  it('right after the preparation every card is still to do', async () => {
    const m = await machines(ACCESS_EXAM, accessStart());
    for (const id of ['login', 'releases', 'sudo', 'nopass', 'allowgroups']) expect(failing(ACCESS_EXAM, id, m).length, id).toBeGreaterThan(0);
  });

  it('every goal holds in the solved state', async () => {
    const m = await machines(ACCESS_EXAM, accessSolved());
    for (const t of ACCESS_EXAM.tasks) if (t.kind === 'real' && t.real.goals) expect([t.id, failing(ACCESS_EXAM, t.id, m)]).toEqual([t.id, []]);
  });

  it('full sudo through a group does not count and is named', async () => {
    const s = accessSolved();
    s[0].raw['sudo_l:maria'] = 'User maria may run the following commands on server:\n    (ALL : ALL) ALL\n';
    const m = await machines(ACCESS_EXAM, s);
    expect(say(ACCESS_EXAM, 'sudo', 'rule', m)).toMatch(/full sudo/);
  });

  it('PasswordAuthentication off with keyboard-interactive still on is the classic trap', async () => {
    const s = accessSolved();
    s[0].raw.sshd_T = s[0].raw.sshd_T.replace('kbdinteractiveauthentication no', 'kbdinteractiveauthentication yes');
    const m = await machines(ACCESS_EXAM, s);
    expect(failing(ACCESS_EXAM, 'nopass', m)).toEqual(['kbd']);
    expect(say(ACCESS_EXAM, 'nopass', 'kbd', m)).toMatch(/keyboard-interactive/);
  });

  it('a directory without the setgid bit is explained', async () => {
    const s = accessSolved();
    s[0].files['/srv/releases'] = dir('root', 'devs', '770');
    const m = await machines(ACCESS_EXAM, s);
    expect(failing(ACCESS_EXAM, 'releases', m)).toEqual(['setgid']);
  });

  it('a keys file writable by the group is refused, as sshd would', async () => {
    const s = accessSolved();
    s[0].files['/home/maria/.ssh/authorized_keys'] = { ...s[0].files['/home/maria/.ssh/authorized_keys'], mode: '664' };
    const m = await machines(ACCESS_EXAM, s);
    expect(say(ACCESS_EXAM, 'login', 'keys', m)).toMatch(/StrictModes/);
  });
});
