// Unit tests of the tier-A machine the Linux block relies on: parser and
// compound commands, PATH lookup, jobs, sessions, the kernel model
// (cgroups, namespaces, capabilities, overlay), systemd and packages; and the
// arithmetic of the six Linux process explainers.

import { describe, expect, it } from 'vitest';
import '../src/core/registry';
import { evaluateCheck } from '../src/core/check';
import { parse } from '../src/engine/terminal/parser';
import { parseControl, splitStatements } from '../src/engine/terminal/control';
import { createSimMachine, needsMore, stripAnsi, type SimMachine } from '../src/engine/terminal/shell';
import { parseUnitText, parseDuration } from '../src/engine/terminal/systemd';
import { parseBytes } from '../src/engine/terminal/kernel';
import { applyMode } from '../src/engine/terminal/commands/files';
import { runAwk, runSed, diffLines } from '../src/engine/terminal/commands/text';
import { runJq } from '../src/engine/terminal/commands/pkg';
import { execNumbers } from '../src/blocks/linux/explainers/exec';
import { pipeNumbers, makeLog } from '../src/blocks/linux/explainers/pipe';
import { decide, octalOf, symbolicOf } from '../src/blocks/linux/explainers/perm';
import { restarts, simulate } from '../src/blocks/linux/explainers/restart';
import { bootTimes } from '../src/blocks/linux/explainers/boot';
import { memoryRun } from '../src/blocks/linux/explainers/isolation';

const run = async (m: SimMachine, line: string) => {
  const r = await m.exec(line);
  return { ...r, out: stripAnsi(r.out) };
};
const out = async (m: SimMachine, line: string) => (await run(m, line)).out;

describe('parser and compound commands', () => {
  it('here-documents, quoted and not', () => {
    const r = parse("cat > f <<'EOF'\nhello $USER\nEOF");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.script[0].first.cmds[0].redirects.find((x) => x.op === '<<')?.heredoc).toEqual({ body: 'hello $USER\n', expand: false });
    expect(needsMore('cat <<EOF\nline')).toBe(true);
    expect(needsMore('if true; then')).toBe(true);
    expect(needsMore('for i in 1 2; do echo $i; done')).toBe(false);
  });

  it('splits statements on ; and newlines but not inside quotes, $( ) or { }', () => {
    expect(splitStatements('a; b\nc')).toEqual(['a', 'b', 'c']);
    expect(splitStatements("echo 'a; b'; c")).toEqual(["echo 'a; b'", 'c']);
    expect(splitStatements('x=$(a; b); c')).toEqual(['x=$(a; b)', 'c']);
    expect(splitStatements('grep q f || { echo no; exit 1; }')).toEqual(['grep q f || { echo no; exit 1; }']);
    const r = parseControl('if a; then b; elif c; then d; else e; fi');
    expect(r.ok && r.nodes[0].k).toBe('if');
  });

  it('runs if/elif/else, for, while read, arithmetic, groups and subshells', async () => {
    const m = await createSimMachine({ files: [{ path: '~/list.txt', content: 'one\ntwo\n' }] });
    expect(await out(m, 'for i in 1 2 3; do echo n$i; done')).toBe('n1\nn2\nn3\n');
    expect(await out(m, 'x=7; if [ $x -gt 10 ]; then echo big; elif [ $x -gt 5 ]; then echo mid; else echo small; fi')).toBe('mid\n');
    expect(await out(m, 'while read l; do echo "<$l>"; done < list.txt')).toBe('<one>\n<two>\n');
    expect(await out(m, 'echo $((6 * 7))')).toBe('42\n');
    expect(await out(m, 'false || { echo fixed; }')).toBe('fixed\n');
    expect(await out(m, '(cd /tmp; pwd); pwd')).toBe('/tmp\n/home/learner\n');
  });

  it('set -e stops a script, set -x traces, pipefail changes $?', async () => {
    const m = await createSimMachine({ files: [{ path: '~/s.sh', content: '#!/bin/bash\nset -e\necho one\nfalse\necho two\n', mode: '0755' }] });
    const r = await run(m, './s.sh');
    expect(r.out).toBe('one\n');
    expect(r.exit).toBe(1);
    expect(await out(m, "bash -x -c 'echo hi'")).toBe('+ echo hi\nhi\n');
    expect(await out(m, 'set -o pipefail; false | true; echo $?')).toBe('1\n');
  });

  it('a child bash sees only exported variables', async () => {
    const m = await createSimMachine();
    expect(await out(m, "A=1; bash -c 'echo [$A]'")).toBe('[]\n');
    expect(await out(m, "export A; bash -c 'echo [$A]'")).toBe('[1]\n');
    expect(await out(m, "B=2 bash -c 'echo [$B]'")).toBe('[2]\n');
  });
});

describe('PATH lookup, jobs and sessions', () => {
  it('finds programs through PATH, reports 127 and 126', async () => {
    const m = await createSimMachine({ files: [{ path: '~/bin/tool', content: '#!/bin/bash\necho tool $1\n', mode: '0644' }] });
    expect(await out(m, 'type ls')).toBe('ls is /usr/bin/ls\n');
    expect(await out(m, 'type cd')).toBe('cd is a shell builtin\n');
    expect((await run(m, 'tool')).exit).toBe(127);
    expect((await run(m, '~/bin/tool')).exit).toBe(126);
    await run(m, 'chmod +x ~/bin/tool');
    await run(m, 'export PATH="$HOME/bin:$PATH"');
    expect(await out(m, 'tool x')).toBe('tool x\n');
    await run(m, 'export PATH=/nowhere');
    expect(await out(m, 'ls')).toBe('bash: ls: command not found\n');
    expect(await out(m, 'echo still')).toBe('still\n');
  });

  it('background jobs: sleep, jobs, kill %1, Done notes', async () => {
    const m = await createSimMachine();
    expect(await out(m, 'sleep 100 &')).toMatch(/^\[1\] \d+\n$/);
    expect(await out(m, 'jobs')).toContain('Running');
    m.advance(101_000);
    expect(await out(m, 'true')).toContain('[1]+  Done');
    await run(m, 'yes > /dev/null &');
    expect(await out(m, 'kill %1')).toContain('Terminated');
  });

  it('nested sessions: sudo -i, su, exit; the prompt follows', async () => {
    const m = await createSimMachine({ users: [{ name: 'anna' }] });
    await run(m, 'sudo -i');
    expect(await out(m, 'whoami')).toBe('root\n');
    expect(m.prompt()).toContain('#');
    await run(m, 'su - anna');
    expect(await out(m, 'pwd')).toBe('/home/anna\n');
    await run(m, 'exit');
    await run(m, 'exit');
    expect(await out(m, 'whoami')).toBe('learner\n');
    expect(await out(m, 'su anna')).toContain('Authentication failure');
  });
});

describe('the kernel model', () => {
  it('cgroup files validate writes and enforce memory.max with the OOM killer', async () => {
    const m = await createSimMachine();
    await run(m, 'sudo mkdir /sys/fs/cgroup/t');
    expect(await out(m, 'ls /sys/fs/cgroup/t')).toContain('memory.max');
    expect(await out(m, 'echo lots | sudo tee /sys/fs/cgroup/t/memory.max')).toContain('Invalid argument');
    await run(m, 'echo 20M | sudo tee /sys/fs/cgroup/t/memory.max');
    expect(await out(m, 'cat /sys/fs/cgroup/t/memory.max')).toBe('20971520\n');
    await run(m, 'echo $$ | sudo tee /sys/fs/cgroup/t/cgroup.procs');
    expect(await out(m, 'cat /proc/self/cgroup')).toBe('0::/t\n');
    const r = await run(m, 'memhog 50');
    expect(r.exit).toBe(137);
    expect(r.out).toContain('Killed');
    const f = await m.facts();
    const g = (f.cgroups as { path: string; memory: { events: Record<string, number> } }[]).find((x) => x.path === '/t')!;
    expect(g.memory.events.oom_kill).toBe(1);
    expect(evaluateCheck({ when: "cgroups[path='/t'].memory.max<=20Mi" }, f).pass).toBe(true);
    expect(await out(m, 'sudo rmdir /sys/fs/cgroup/t')).toContain('busy');
  });

  it('cpu.max caps what top shows; pids.max stops fork', async () => {
    const m = await createSimMachine({ script: ['mkdir /sys/fs/cgroup/c', 'echo 30000 > /sys/fs/cgroup/c/cpu.max'] });
    await run(m, 'echo $$ | sudo tee /sys/fs/cgroup/c/cgroup.procs');
    await run(m, 'burner &');
    expect(await out(m, "ps -o %cpu,comm -C burner")).toContain('30.0');
    await run(m, 'echo 3 | sudo tee /sys/fs/cgroup/c/pids.max');
    expect(await out(m, 'spawner 5')).toContain('Resource temporarily unavailable');
  });

  it('namespaces: uts, pid with --mount-proc, user with a uid map', async () => {
    const m = await createSimMachine();
    const hostUts = (await out(m, 'readlink /proc/$$/ns/uts')).trim();
    await run(m, 'sudo unshare --uts --pid --fork --mount-proc bash');
    expect((await out(m, 'readlink /proc/$$/ns/uts')).trim()).not.toBe(hostUts);
    expect(await out(m, 'echo $$')).toBe('1\n');
    await run(m, 'hostname inner');
    await run(m, 'exit');
    expect(await out(m, 'hostname')).toBe('trainer\n');
    await run(m, 'unshare -r bash');
    expect(await out(m, 'id -u')).toBe('0\n');
    expect(await out(m, 'cat /etc/shadow')).toContain('Permission denied');
    await run(m, 'exit');
    expect(await out(m, 'lsns -t user')).toContain('user');
  });

  it('capabilities: dropping DAC caps blocks root; setcap gives one right', async () => {
    const m = await createSimMachine({ users: [{ name: 'anna' }], files: [{ path: '/srv/p', content: 'x\n', owner: 'anna', mode: '0600' }] });
    expect(await out(m, 'sudo cat /srv/p')).toBe('x\n');
    expect(await out(m, "sudo capsh --drop=cap_dac_override,cap_dac_read_search -- -c 'cat /srv/p'")).toContain('Permission denied');
    expect(await out(m, "capsh --decode=0000000000000400")).toContain('cap_net_bind_service');
    expect(await out(m, 'web-demo --port 81')).toContain('permission denied');
    await run(m, 'sudo setcap cap_net_bind_service=+ep /usr/bin/web-demo');
    expect(await out(m, 'getcap /usr/bin/web-demo')).toBe('/usr/bin/web-demo cap_net_bind_service=ep\n');
    expect(await out(m, 'web-demo --port 81')).toContain('listening on :81');
  });

  it('overlay: copy-up on change, a whiteout on delete, lower untouched', async () => {
    const m = await createSimMachine({ files: [{ path: '/l/a.txt', content: 'A\n', owner: 'root' }, { path: '/l/b.txt', content: 'B\n', owner: 'root' }, { path: '/u', type: 'd', owner: 'root' }, { path: '/w', type: 'd', owner: 'root' }, { path: '/m', type: 'd', owner: 'root' }] });
    await run(m, 'sudo mount -t overlay overlay -o lowerdir=/l,upperdir=/u,workdir=/w /m');
    expect(await out(m, 'cat /m/a.txt')).toBe('A\n');
    await run(m, 'echo more | sudo tee -a /m/a.txt');
    await run(m, 'sudo rm /m/b.txt');
    const f = await m.facts();
    expect(f.files['/u/a.txt'].text).toBe('A\nmore\n');
    expect(f.files['/l/a.txt'].text).toBe('A\n');
    expect(f.files['/u/b.txt'].type).toBe('c');
    await run(m, 'sudo umount /m');
    expect(await out(m, 'ls /m')).toBe('');
  });

  it('mounting hides and umount reveals; tmpfs is emptied by a reboot', async () => {
    const m = await createSimMachine({ files: [{ path: '/data/old', content: 'o\n', owner: 'root' }] });
    await run(m, 'sudo mkfs.ext4 /dev/sdb');
    await run(m, 'sudo mount /dev/sdb /data');
    expect(await out(m, 'ls /data')).toBe('');
    await run(m, 'sudo touch /data/new');
    await run(m, 'sudo umount /data');
    expect(await out(m, 'ls /data')).toBe('old\n');
    await run(m, 'sudo mount /dev/sdb /data');
    expect(await out(m, 'ls /data')).toBe('new\n');
    await run(m, 'touch /tmp/scratch');
    await run(m, 'sudo reboot');
    expect(await out(m, 'ls /tmp')).toBe('');
  });

  it('procfs: status, threads, /proc/self', async () => {
    const m = await createSimMachine();
    await run(m, 'threads-demo 3 &');
    const pid = (await out(m, 'pgrep threads-demo')).trim();
    expect(await out(m, `grep Threads /proc/${pid}/status`)).toBe('Threads:\t4\n');
    expect(await out(m, `ls /proc/${pid}/task | wc -l`)).toBe('4\n');
    expect(await out(m, 'cat /proc/self/comm')).toBe('cat\n');
  });

  it('signals: TERM is handled by sigdemo, KILL is not; kill by name is an error', async () => {
    const m = await createSimMachine();
    await run(m, 'sigdemo &');
    await run(m, 'pkill sigdemo');
    expect(await out(m, 'pgrep -c sigdemo || pgrep sigdemo | wc -l')).not.toBe('0\n');
    expect(await out(m, 'kill nginx')).toBe('bash: kill: nginx: arguments must be process or job IDs\n');
    await run(m, 'pkill -9 sigdemo');
    expect((await run(m, 'pgrep sigdemo')).exit).toBe(1);
  });
});

describe('systemd, journal, packages, cron', () => {
  it('parses unit files and durations', () => {
    const ini = parseUnitText(['[Service]\nExecStart=/a\nRestart=always\n', '[Service]\nRestart=on-failure\n']);
    expect(ini.Service.Restart).toEqual(['always', 'on-failure']);
    expect(parseDuration('1min 30s', 0)).toBe(90_000);
    expect(parseDuration('100ms', 0)).toBe(100);
    expect(parseBytes('20M')).toBe(20 * 1024 * 1024);
    expect(parseBytes('max')).toBe('max');
  });

  it('Restart=on-failure with a crashing program ends in start-limit-hit', async () => {
    const m = await createSimMachine({
      files: [
        { path: '/usr/local/bin/crash', content: '#!/bin/bash\necho boom >&2\nexit 3\n', owner: 'root', mode: '0755' },
        { path: '/etc/systemd/system/crash.service', content: '[Service]\nExecStart=/usr/local/bin/crash\nRestart=on-failure\n', owner: 'root' },
      ],
    });
    await run(m, 'sudo systemctl start crash');
    m.advance(2000);
    const st = await out(m, 'systemctl status crash');
    expect(st).toContain('start-limit-hit');
    expect(await out(m, 'systemctl show -p NRestarts --value crash')).toBe('5\n');
    expect(await out(m, 'journalctl -u crash')).toContain('Start request repeated too quickly.');
    expect(await out(m, 'sudo systemctl start crash')).toContain('reset-failed');
  });

  it('a stale unit file warns until daemon-reload; enable makes a link; journal by unit', async () => {
    const m = await createSimMachine({ files: [{ path: '/etc/systemd/system/web.service', content: '[Service]\nExecStart=/usr/bin/web-demo --port 8090\n\n[Install]\nWantedBy=multi-user.target\n', owner: 'root' }] });
    await run(m, 'sudo systemctl start web');
    await run(m, "echo 'Description=Web' | sudo tee -a /etc/systemd/system/web.service");
    expect(await out(m, 'sudo systemctl restart web')).toContain('daemon-reload');
    expect(await out(m, 'sudo systemctl enable web')).toContain("Created symlink '/etc/systemd/system/multi-user.target.wants/web.service'");
    expect(await out(m, 'systemctl is-enabled web')).toBe('enabled\n');
    expect(await out(m, 'journalctl -u web -n 1')).toContain('Started web.service');
    expect(await out(m, 'journalctl -u web')).toContain('listening on :8090');
  });

  it('kill -9 of the main process: on-failure restarts with a new pid', async () => {
    const m = await createSimMachine({ files: [{ path: '/etc/systemd/system/w.service', content: '[Service]\nExecStart=/usr/bin/web-demo --port 8091\nRestart=on-failure\n', owner: 'root' }] });
    await run(m, 'sudo systemctl start w');
    const pid1 = (await out(m, 'systemctl show -p MainPID --value w')).trim();
    await run(m, `sudo kill -9 ${pid1}`);
    m.advance(500);
    const pid2 = (await out(m, 'systemctl show -p MainPID --value w')).trim();
    expect(pid2).not.toBe(pid1);
    expect(await out(m, 'systemctl is-active w')).toBe('active\n');
  });

  it('apt needs update; install puts files and starts the service', async () => {
    const m = await createSimMachine();
    expect(await out(m, 'sudo apt install nginx')).toContain('Unable to locate package nginx');
    expect(await out(m, 'nginx -v')).toContain('command not found');
    await run(m, 'sudo apt update');
    await run(m, 'sudo apt install -y nginx');
    expect(await out(m, 'systemctl is-active nginx')).toBe('active\n');
    expect(await out(m, 'dpkg -S /usr/sbin/nginx')).toBe('nginx: /usr/sbin/nginx\n');
    expect(await out(m, 'ps -C nginx -o user,comm --no-headers')).toContain('www-data');
  });

  it('crontab validates the five fields', async () => {
    const m = await createSimMachine();
    expect(await out(m, "echo '61 2 * * * /bin/true' | crontab -")).toContain('bad minute');
    await run(m, "echo '30 2 * * * /bin/true' | crontab -");
    expect(await out(m, 'crontab -l')).toBe('30 2 * * * /bin/true\n');
  });
});

describe('text tools', () => {
  it('chmod modes, sed, awk, jq, diff', () => {
    expect(applyMode('u+x', 0o644, false)).toBe(0o744);
    expect(applyMode('g=rw,o=', 0o755, false)).toBe(0o760);
    expect(applyMode('750', 0o2755, true)).toBe(0o2750);
    expect(applyMode('nonsense', 0o644, false)).toBeNull();
    expect(runSed('a b\nb c\n', [{ op: 's', re: /b/g, rep: 'X', global: true }], false)).toBe('a X\nX c\n');
    expect(runAwk('{s += $2} END {print s}', 'x 1\ny 2\nz 3\n', undefined)).toBe('6\n');
    expect(runAwk('$2 > 1 {print $1}', 'x 1\ny 2\nz 3\n', undefined)).toBe('y\nz\n');
    expect(runAwk('{n[$1]++} END {for (k in n) print k, n[k]}', 'a\nb\na\n', undefined)).toBe('a 2\nb 1\n');
    expect(runJq('.items[].name', '{"items":[{"name":"a"},{"name":"b"}]}', true).out).toBe('a\nb\n');
    expect(diffLines(['a', 'b'], ['a', 'c']).map((d) => d.op + d.line)).toEqual([' a', '+c', '-b']);
  });

  it('find, sort -k, cut, tr, sha256sum, tar round trip', async () => {
    const m = await createSimMachine({ files: [{ path: '~/d/a.log', content: 'b 2\na 10\n' }, { path: '~/d/b.txt', content: 'x' }] });
    expect(await out(m, "find ~/d -name '*.log'")).toBe('/home/learner/d/a.log\n');
    expect(await out(m, 'sort -k2 -n ~/d/a.log')).toBe('b 2\na 10\n');
    expect(await out(m, "cut -d' ' -f1 ~/d/a.log | tr a-z A-Z")).toBe('B\nA\n');
    expect(await out(m, "printf 'abc' | sha256sum")).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  -\n');
    await run(m, 'tar -czf d.tgz d');
    await run(m, 'mkdir out && tar -xzf d.tgz -C out');
    expect(await out(m, 'cat out/d/a.log')).toBe('b 2\na 10\n');
  });
});

describe('the Linux explainers compute their processes', () => {
  it('exec: forks, execs and exit codes follow the form and PATH', () => {
    expect(execNumbers({ form: 'ls', path: 'default' }, new Set())).toEqual({ forks: 1, execs: 1, status: 0, checked: 2 });
    expect(execNumbers({ form: 'cd', path: 'default' }, new Set()).forks).toBe(0);
    expect(execNumbers({ form: 'exec', path: 'default' }, new Set()).forks).toBe(0);
    expect(execNumbers({ form: 'ls', path: 'broken' }, new Set()).status).toBe(127);
    expect(execNumbers({ form: 'ls', path: 'mine' }, new Set()).checked).toBe(1);
    expect(execNumbers({ form: 'ls', path: 'default' }, new Set(['no-x'])).status).toBe(126);
  });

  it('pipe: uniq without sort prints more lines than distinct addresses', () => {
    const p = { lines: 400, errors: 10, sorted: true, stderr: 'tty' };
    const a = pipeNumbers(p);
    const b = pipeNumbers({ ...p, sorted: false });
    expect(a.printed).toBe(a.distinct);
    expect(b.printed).toBeGreaterThan(a.printed);
    expect(pipeNumbers({ ...p, errors: 0 }).matched).toBe(0);
    expect(makeLog(10, 50).filter((l) => l.endsWith(' 500')).length).toBe(5);
  });

  it('perm: one triad decides; root skips the check; x on the path matters', () => {
    const base = { u: 'rwx', g: 'r-x', o: '---', who: 'eve', action: 'read' };
    expect(decide(base, new Set()).allowed).toBe(false);
    expect(decide({ ...base, who: 'bob' }, new Set()).allowed).toBe(true);
    expect(decide({ ...base, who: 'anna', u: 'r--', g: 'rwx', action: 'write' }, new Set()).allowed).toBe(false);
    expect(decide({ ...base, who: 'root' }, new Set()).allowed).toBe(true);
    expect(decide({ ...base, o: 'r--' }, new Set(['no-x-srv'])).stoppedAt).toBe('srv');
    expect(octalOf(base)).toBe('750');
    expect(symbolicOf(base)).toBe('u=rwx,g=rx,o=');
  });

  it('restart: the table of systemd.service(5) and the start limit', () => {
    expect(restarts('on-failure', 'exit1')).toBe(true);
    expect(restarts('on-abnormal', 'exit1')).toBe(false);
    expect(restarts('on-abnormal', 'kill')).toBe(true);
    expect(restarts('on-failure', 'term')).toBe(false);
    expect(restarts('no', 'kill')).toBe(false);
    const fast = { restart: 'on-failure', restartSec: 0.1, burst: 5, crash: 'exit1', after: 0 };
    expect(simulate(fast, new Set()).final).toBe('start-limit-hit');
    expect(simulate(fast, new Set()).restarts).toBe(5);
    expect(simulate({ ...fast, after: 5 }, new Set()).final).not.toBe('start-limit-hit');
    expect(simulate({ ...fast, restart: 'no' }, new Set()).final).toBe('failed');
  });

  it('boot: After= delays only its dependents; isolation: limits pick the victim', () => {
    const t = bootTimes({ target: 'multi-user', slow: 20, after: true });
    expect(t.web).toBeGreaterThan(20);
    expect(bootTimes({ target: 'multi-user', slow: 20, after: false }).web).toBeLessThan(1);
    expect(t.cron).toBeLessThan(1);
    const r = memoryRun({ uts: true, pid: true, net: false, memMax: 64, grow: 8, cpu: 100 });
    expect(r.killedAt).toBe(5);
    expect(r.global).toBe(false);
    expect(memoryRun({ uts: true, pid: true, net: false, memMax: 0, grow: 8, cpu: 100 }).global).toBe(true);
  });
});
