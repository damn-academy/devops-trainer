// Every lab of the Linux block is solvable: a reference solution runs on the
// simulated machine and the goal passes; some known mistakes trigger their
// targeted explanation. Placement tasks and the exam are solvable too.

import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import { registry } from '../src/core/registry';
import type { DocsSection, Lesson, Task, TerminalSection, TerminalSetup } from '../src/core/types';
import { createSimMachine, stripAnsi, type SimMachine } from '../src/engine/terminal/shell';

function lab(lessonId: string, sectionId = 'lab'): { setup: TerminalSetup; tasks: Task[] } {
  const l = registry.lessons.get(lessonId) as Lesson;
  const s = l.sections.find((x) => x.id === sectionId)!;
  if (s.kind === 'terminal') return { setup: (s as TerminalSection).setup, tasks: (s as TerminalSection).tasks };
  const d = s as DocsSection;
  return { setup: d.terminal!.setup, tasks: [d.terminal!.task] };
}

async function sh(m: SimMachine, ...lines: string[]): Promise<string> {
  let out = '';
  for (const l of lines) out += stripAnsi((await m.exec(l)).out);
  return out;
}

async function passes(m: SimMachine, t: Task): Promise<boolean> {
  return evaluateCheck(t.check, await m.facts()).pass;
}

async function says(m: SimMachine, t: Task): Promise<boolean> {
  return !!evaluateCheck(t.check, await m.facts()).say;
}

/** Run the solution and check that task `i` passes. */
async function solve(lesson: string, section: string, i: number, lines: string[], m?: SimMachine): Promise<SimMachine> {
  const { setup, tasks } = lab(lesson, section);
  const mm = m ?? (await createSimMachine(setup));
  const out = await sh(mm, ...lines);
  const ok = await passes(mm, tasks[i]);
  if (!ok) throw new Error(`${lesson}/${section}/${tasks[i].id} did not pass. Output:\n${out}`);
  return mm;
}

describe('linux block structure', () => {
  it('has the block, 19 lessons, six explainers and a quiz bank of at least 12', () => {
    const b = registry.blocks.get('linux')!;
    expect(b.lessons.length).toBe(19);
    for (const id of ['linux.exec', 'linux.pipe', 'linux.perm', 'linux.restart', 'linux.boot', 'linux.isolation']) expect(registry.explainers.has(id)).toBe(true);
    expect([...registry.quiz.keys()].filter((k) => k.startsWith('linux.')).length).toBeGreaterThanOrEqual(12);
    expect(b.placement.some((p) => p.level === 'intermediate')).toBe(true);
    expect(b.placement.some((p) => p.level === 'experienced')).toBe(true);
  });

  it('every quiz item a Linux lesson references exists in the bank', () => {
    for (const id of registry.blocks.get('linux')!.lessons) {
      for (const s of registry.lessons.get(id)!.sections) if (s.kind === 'quiz') for (const it of s.items) if (typeof it === 'string') expect(registry.quiz.has(it), it).toBe(true);
    }
  });

  it('the doc ladder climbs: DL2 finds, a DL3 task, DL4 forcing tasks without hints', () => {
    const tasks: Task[] = [];
    for (const id of registry.blocks.get('linux')!.lessons) for (const s of registry.lessons.get(id)!.sections) if (s.kind === 'docs' && s.terminal) tasks.push(s.terminal.task);
    expect(tasks.some((t) => t.docStep === 2)).toBe(true);
    expect(tasks.some((t) => t.docStep === 3)).toBe(true);
    const dl4 = tasks.filter((t) => t.docStep === 4);
    expect(dl4.length).toBeGreaterThanOrEqual(3);
    for (const t of dl4) {
      expect(t.beyond).toBe(true);
      expect(Object.keys(t.hints ?? {})).toEqual([]);
    }
  });
});

describe('linux labs are solvable', () => {
  it('terminal', async () => {
    const m = await solve('linux.terminal', 'lab', 0, ['date']);
    await solve('linux.terminal', 'lab', 1, ['whoami'], m);
    await solve('linux.terminal', 'lab', 2, ['echo "hello,   server"'], m);
    await sh(m, 'echo hello,   server');
    expect(await says(m, lab('linux.terminal').tasks[2])).toBe(true);
    await solve('linux.terminal', 'lab', 3, ['cat /etc/os-release'], m);
  });

  it('paths', async () => {
    const m = await solve('linux.paths', 'lab', 0, ['cd /var/log/app', 'pwd']);
    await solve('linux.paths', 'lab', 1, ['cd ../../lib'], m);
    await solve('linux.paths', 'lab', 2, ['cd', 'ls -a'], m);
  });

  it('files', async () => {
    const m = await solve('linux.files', 'lab', 0, ['mkdir ~/backup', 'cp /etc/app/app.conf ~/backup/app.conf.bak']);
    await solve('linux.files', 'lab', 1, ['mkdir ~/logs', 'mv ~/inbox/*.log ~/logs/'], m);
    await solve('linux.files', 'lab', 2, ['tail -n 2 ~/logs/report-1.log'], m);
    await solve('linux.files', 'lab', 3, ['cd ~', 'tar -czf site.tar.gz site/', 'mkdir /tmp/restore', 'tar -xzf site.tar.gz -C /tmp/restore'], m);
    const m2 = await createSimMachine(lab('linux.files').setup);
    await sh(m2, 'cp /etc/app/app.conf ~/backup');
    expect(await says(m2, lab('linux.files').tasks[0])).toBe(true);
  });

  it('manual', async () => {
    await solve('linux.manual', 'find-size', 0, ['ls -S /srv/logs']);
    const m = await solve('linux.manual', 'find-builtin', 0, ['type cd']);
    await solve('linux.manual', 'find-builtin', 1, ['man -k copy'], m);
  });

  it('users', async () => {
    const m = await solve('linux.users', 'lab', 0, ['id']);
    await solve('linux.users', 'lab', 1, ['groups bob'], m);
    await solve('linux.users', 'lab', 2, ['grep anna /etc/passwd'], m);
  });

  it('permissions', async () => {
    const { setup, tasks } = lab('linux.permissions');
    const m = await createSimMachine(setup);
    expect(await sh(m, '~/bin/backup')).toContain('Permission denied');
    await solve('linux.permissions', 'lab', 0, ['chmod u+x ~/bin/backup', '~/bin/backup'], m);
    await sh(m, 'sudo chmod 770 /srv/team');
    expect(await says(m, tasks[1])).toBe(true);
    await solve('linux.permissions', 'lab', 1, ['sudo chgrp dev /srv/team', 'sudo chmod 2770 /srv/team'], m);
    await solve('linux.permissions', 'lab', 2, ['sudo head -n 1 /etc/shadow'], m);
    // the shared directory works as designed: anna creates, the file gets group dev, eve sees nothing
    m.switchUser('anna');
    await sh(m, 'touch /srv/team/plan.txt');
    expect((await m.facts()).files['/srv/team/plan.txt'].group).toBe('dev');
    m.switchUser('eve');
    expect(await sh(m, 'ls /srv/team')).toContain('Permission denied');
  });

  it('streams', async () => {
    const m = await solve('linux.streams', 'lab', 0, ["grep ' 500' access.log | cut -d' ' -f1 | sort | uniq -c | sort -rn | head -3 > ~/top.txt"]);
    await solve('linux.streams', 'lab', 1, ['ls /etc/hostname /nosuch > ~/out.txt 2> ~/err.txt'], m);
    const out = await sh(m, 'cd ~/downloads', 'sha256sum -c SHA256SUMS');
    expect(out).toMatch(/app-1\.tar\.gz: OK/);
    expect(out).toMatch(/app-2\.tar\.gz: FAILED/);
    await solve('linux.streams', 'lab', 2, ['echo app-2.tar.gz > ~/bad.txt'], m);
    await solve('linux.streams', 'word', 0, ['grep -cw GET ~/access.log']);
    // the classic mistake: uniq without sort
    const m2 = await createSimMachine(lab('linux.streams').setup);
    await sh(m2, "grep ' 500' access.log | cut -d' ' -f1 | uniq -c | sort -rn | head -3 > ~/top.txt");
    expect(await passes(m2, lab('linux.streams').tasks[0])).toBe(false);
    // awk gets the same answer
    const m3 = await createSimMachine(lab('linux.streams').setup);
    await sh(m3, "awk '$4 == 500 {print $1}' access.log | sort | uniq -c | sort -rn | head -3 > ~/top.txt");
    expect(await passes(m3, lab('linux.streams').tasks[0])).toBe(true);
  });

  it('env', async () => {
    const { setup, tasks } = lab('linux.env');
    const m = await createSimMachine(setup);
    expect(await sh(m, 'hello')).toContain('command not found');
    await solve('linux.env', 'lab', 0, ['export PATH="$HOME/bin:$PATH"', 'hello'], m);
    await solve('linux.env', 'lab', 1, [`echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc`], m);
    await sh(m, 'GREETING=hi', "bash -c 'echo $GREETING'");
    expect(await says(m, tasks[2])).toBe(true);
    await solve('linux.env', 'lab', 2, ['export GREETING=hi', "bash -c 'echo $GREETING'"], m);
    const m2 = await createSimMachine(setup);
    await sh(m2, 'export PATH=/home/learner/bin', 'hello');
    expect(await says(m2, tasks[0])).toBe(true);
  });

  it('processes', async () => {
    const { setup } = lab('linux.processes');
    const m = await createSimMachine(setup);
    const top = await sh(m, 'top -b -n 1');
    expect(top.split('\n').find((l) => /^\s+\d+ /.test(l))).toContain('burner');
    await solve('linux.processes', 'lab', 0, ['kill $(pgrep burner)'], m);
    await sh(m, 'kill $(pgrep sigdemo)');
    expect((await m.facts()).procs.some((p) => p.cmd === 'sigdemo')).toBe(true);
    expect(await sh(m, 'cat /tmp/sigdemo.log')).toContain('SIGTERM');
    await solve('linux.processes', 'lab', 1, ['kill -9 $(pgrep sigdemo)'], m);
    await solve('linux.processes', 'lab', 2, ['ls /nosuch; echo $?'], m);
    await solve('linux.processes', 'mem', 0, ['ps -eo pid,rss,comm --sort=-rss > ~/mem.txt']);
  });

  it('scripts', async () => {
    const script = '#!/bin/bash\nset -euo pipefail\nif [ $# -ne 1 ]; then\n  echo "usage: backup.sh DIR" >&2\n  exit 1\nfi\nname=$(basename "$1")\nmkdir -p ~/backups\ntar -czf ~/backups/"$name".tar.gz -C "$(dirname "$1")" "$name"\necho "saved ~/backups/$name.tar.gz"\n';
    const m = await solve('linux.scripts', 'lab', 0, [`cat > ~/bin/backup.sh <<'EOF'\n${script}EOF`, 'chmod u+x ~/bin/backup.sh', 'backup.sh ~/site']);
    expect(await sh(m, 'tar -tzf ~/backups/site.tar.gz')).toContain('site/index.html');
    await solve('linux.scripts', 'lab', 1, ['backup.sh'], m);
    const x = await solve('linux.scripts', 'xtrace', 0, ["sed -i '1a set -x' ~/bin/backup.sh"]);
    expect(await sh(x, '~/bin/backup.sh ~/site')).toContain('+ mkdir -p');
  });

  it('packages', async () => {
    const { setup, tasks } = lab('linux.packages');
    const m = await createSimMachine(setup);
    await sh(m, 'sudo apt install jq');
    expect(await says(m, tasks[0])).toBe(true);
    await solve('linux.packages', 'lab', 0, ['sudo apt update', 'sudo apt install -y jq'], m);
    await solve('linux.packages', 'lab', 1, ["jq -r '.items[].name' ~/orders.json"], m);
    await solve('linux.packages', 'files', 0, ['dpkg -L jq > ~/jq-files.txt']);
  });

  it('services', async () => {
    const { setup, tasks } = lab('linux.services');
    const m = await createSimMachine(setup);
    await sh(m, 'sleep 3');
    const status = await sh(m, 'systemctl status report');
    expect(status).toMatch(/failed|auto-restart/);
    expect(await sh(m, 'journalctl -u report')).toContain('cannot open /etc/report.conf');
    await sh(m, 'sudo touch /etc/report.conf', 'sudo systemctl start report');
    expect(await says(m, tasks[0])).toBe(true);
    await solve('linux.services', 'lab', 0, ['sudo systemctl reset-failed report', 'sudo systemctl start report'], m);
    const unit = '[Unit]\nDescription=Web demo\n\n[Service]\nExecStart=/usr/local/bin/web-demo --port 8080\nUser=learner\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n';
    await sh(m, `sudo tee /etc/systemd/system/web.service > /dev/null <<'EOF'\n${unit}EOF`, 'sudo systemctl start web');
    expect(await says(m, tasks[1])).toBe(true);
    await solve('linux.services', 'lab', 1, ['sudo systemctl daemon-reload', 'sudo systemctl enable --now web'], m);
    expect(await sh(m, 'ss -ltn')).toContain(':8080');
    await solve('linux.services', 'lab', 2, ["echo '30 2 * * * /home/learner/bin/backup.sh' | crontab -"], m);
    // enabled services come back after a reboot; report too
    await sh(m, 'sudo reboot');
    const f = await m.facts();
    expect((f.units as Record<string, { active: string }>)['web.service'].active).toBe('active');
    // the forcing task
    const lim = lab('linux.services', 'limit');
    const m2 = await createSimMachine(lim.setup);
    await sh(m2, "printf '[Unit]\\nStartLimitBurst=3\\nStartLimitIntervalSec=60\\n' | sudo systemctl edit --stdin flappy");
    expect(await passes(m2, lim.tasks[0])).toBe(true);
  });

  it('disks', async () => {
    const m = await solve('linux.disks', 'lab', 0, ['ls /data', 'sudo mkfs.ext4 /dev/sdb', 'sudo mount /dev/sdb /data']);
    expect(await sh(m, 'ls /data')).not.toContain('README');
    const uuid = /UUID="([0-9a-f-]{36})"/.exec((await sh(m, 'sudo blkid')).split('\n').find((l) => l.startsWith('/dev/sdb'))!)![1];
    await solve('linux.disks', 'lab', 1, [`echo 'UUID=${uuid} /data ext4 defaults 0 2' | sudo tee -a /etc/fstab`], m);
    await solve('linux.disks', 'lab', 2, ['ln -s releases/v2 ~/current'], m);
    await solve('linux.disks', 'lab', 3, ['sudo mkdir -p /mnt/scratch', 'sudo mount -t tmpfs -o size=16m tmpfs /mnt/scratch'], m);
    await sh(m, 'sudo umount /data');
    expect(await sh(m, 'ls /data')).toContain('README');
    await solve('linux.disks', 'inodes', 0, ["df -i --output=iavail / | tail -1 > ~/inodes.txt"]);
  });

  it('threads', async () => {
    const m = await solve('linux.threads', 'lab', 0, ['grep Threads /proc/$(pgrep threads-demo)/status', "grep Threads /proc/$(pgrep threads-demo)/status | awk '{print $2}' > ~/threads.txt"]);
    expect(await sh(m, 'ls /proc/$(pgrep threads-demo)/task | wc -l')).toBe('7\n');
    await solve('linux.threads', 'lab', 1, ['ps -eLf'], m);
  });

  it('namespaces', async () => {
    const m = await solve('linux.namespaces', 'lab', 0, ['sudo unshare --uts bash', 'hostname box', 'hostname', 'exit', 'hostname']);
    expect(m.hostname).toBe('trainer');
    await sh(m, 'sudo unshare --pid --fork --mount-proc bash');
    expect(await sh(m, 'echo $$')).toBe('1\n');
    const ps = await sh(m, 'ps');
    expect(ps.trim().split('\n').length).toBe(3);
    expect(await sh(m, 'kill -9 1; echo alive')).toContain('alive');
    await solve('linux.namespaces', 'lab', 1, ['exit'], m);
    await sh(m, 'touch /tmp/inside');
    expect(await passes(m, lab('linux.namespaces').tasks[2])).toBe(false);
    await sh(m, 'rm /tmp/inside');
    await solve('linux.namespaces', 'lab', 2, ['unshare --user --map-root-user bash', 'id', 'touch /tmp/inside', 'exit', 'ls -l /tmp/inside'], m);
    // without --fork the second command cannot fork any more
    const m2 = await createSimMachine({});
    await sh(m2, 'sudo unshare --pid bash');
    await sh(m2, 'ls');
    expect(await sh(m2, 'ls')).toContain('Cannot allocate memory');
  });

  it('cgroups', async () => {
    const m = await solve('linux.cgroups', 'lab', 0, ['sudo mkdir /sys/fs/cgroup/lab', 'echo 32M | sudo tee /sys/fs/cgroup/lab/memory.max', 'echo $$ | sudo tee /sys/fs/cgroup/lab/cgroup.procs', 'memhog 64']);
    expect(await sh(m, 'sudo dmesg | tail -1')).toContain('Memory cgroup out of memory');
    await solve('linux.cgroups', 'lab', 1, ['echo 5 | sudo tee /sys/fs/cgroup/lab/pids.max', 'spawner 10'], m);
    await solve('linux.cgroups', 'systemd-run', 0, ['sudo systemd-run --scope -p TasksMax=20 spawner 30']);
  });

  it('capabilities and seccomp', async () => {
    const { setup } = lab('linux.caps');
    const m = await solve('linux.caps', 'lab', 0, ["sudo capsh --drop=cap_dac_override,cap_dac_read_search -- -c 'cat /home/anna/notes.txt'"]);
    expect(await sh(m, 'sudo cat /home/anna/notes.txt')).toContain('private');
    expect(await sh(m, '/usr/local/bin/web-demo --port 80 &')).toContain('permission denied');
    await solve('linux.caps', 'lab', 1, ['sudo setcap cap_net_bind_service=+ep /usr/local/bin/web-demo', 'getcap /usr/local/bin/web-demo', '/usr/local/bin/web-demo --port 80 &'], m);
    await solve('linux.caps', 'lab', 2, ["grep Seccomp /proc/$(pgrep systemd-journal)/status | awk '{print $2}' > ~/seccomp.txt"], m);
    void setup;
  });

  it('chroot and overlay', async () => {
    const m = await solve('linux.rootfs', 'lab', 0, ['sudo chroot /lab/rootfs /bin/sh', 'touch /tmp/from-inside', 'ls /tmp', 'exit']);
    expect(await sh(m, 'ls /lab/rootfs/tmp')).toContain('from-inside');
    await solve('linux.rootfs', 'lab', 1, ['sudo mount -t overlay overlay -o lowerdir=/lab/lower,upperdir=/lab/upper,workdir=/lab/work /lab/merged', 'echo "edited" | sudo tee -a /lab/merged/etc/motd', 'sudo rm /lab/merged/old.txt'], m);
    expect(await sh(m, 'ls -l /lab/upper')).toMatch(/c--------- 1 root root 0, 0 .* old\.txt/);
    expect(await sh(m, 'ls /lab/merged')).not.toContain('old.txt');
  });

  it('ssh', async () => {
    const m = await solve('linux.ssh', 'lab', 0, ['sudo ss -ltnp']);
    await solve('linux.ssh', 'lab', 1, ["ssh-keygen -t ed25519 -N ''"], m);
    await sh(m, 'sudo mkdir -p /home/deploy/.ssh', 'cat ~/.ssh/id_ed25519.pub | sudo tee /home/deploy/.ssh/authorized_keys');
    expect(await says(m, lab('linux.ssh').tasks[2])).toBe(true);
    await sh(m, 'sudo chmod 666 /home/deploy/.ssh/authorized_keys');
    expect(await sh(m, 'ssh deploy@localhost whoami')).toContain('Permission denied (publickey)');
    expect(await sh(m, 'sudo journalctl -u ssh -n 3')).toContain('bad ownership or modes');
    await solve('linux.ssh', 'lab', 2, ['sudo chown -R deploy:deploy /home/deploy/.ssh', 'sudo chmod 700 /home/deploy/.ssh', 'sudo chmod 600 /home/deploy/.ssh/authorized_keys'], m);
    await solve('linux.ssh', 'lab', 3, ['ssh deploy@localhost whoami'], m);
  });
});

describe('linux placement and exam', () => {
  it('the experienced service task is solvable', async () => {
    const p = registry.blocks.get('linux')!.placement.find((x) => x.id === 'linux.place.service')!;
    if (p.kind !== 'task') throw new Error('expected a task');
    const m = await createSimMachine(p.setup);
    await sh(m, 'sudo chmod +x /usr/local/bin/report', 'sudo systemctl enable --now report');
    expect(evaluateCheck(p.task.check, await m.facts()).pass).toBe(true);
  });

  it('the exam tasks are solvable', async () => {
    const ex = registry.exams.get('linux.exam.service')!;
    const t = (id: string) => ex.tasks.find((x) => x.id === id)!;
    const fix = t('fix');
    if (fix.kind !== 'task') throw new Error('expected a task');
    const m = await createSimMachine(fix.setup);
    expect(await sh(m, 'systemctl status report')).toContain('203/EXEC');
    await sh(m, 'sudo chmod 755 /usr/local/bin/report', 'sudo systemctl start report');
    expect(evaluateCheck(fix.task.check, await m.facts()).pass).toBe(true);
    const boot = t('boot');
    if (boot.kind !== 'task') throw new Error('expected a task');
    const m2 = await createSimMachine(boot.setup);
    await sh(m2, "printf '[Service]\\nRestart=on-failure\\n' | sudo systemctl edit --stdin report", 'sudo systemctl enable report');
    expect(evaluateCheck(boot.task.check, await m2.facts()).pass).toBe(true);
    const j = t('journal');
    if (j.kind !== 'task') throw new Error('expected a task');
    const m3 = await createSimMachine(j.setup);
    await sh(m3, "sudo sed -i 's/^#SystemMaxUse=$/SystemMaxUse=50M/' /etc/systemd/journald.conf");
    expect(evaluateCheck(j.task.check, await m3.facts()).pass).toBe(true);
  });
});
