import { beforeAll, describe, expect, it } from 'vitest';
import { BASIC_COMMANDS } from '../src/engine/terminal/commands/basic';
import { BUILTINS } from '../src/engine/terminal/commands/builtins';
import { createTerminalRegistry } from '../src/engine/terminal/registry';
import { createSimMachine, needsMore, SimMachine, stripAnsi } from '../src/engine/terminal/shell';
import { corpus } from '../src/engine/docs/corpus';
import { evaluateCheck } from '../src/core/check';

const reg = createTerminalRegistry();
for (const c of [...BUILTINS, ...BASIC_COMMANDS]) reg.commands.add(c);

beforeAll(() => {
  for (const c of reg.commands.list()) if (!corpus.get(`help/${c.name}`) && c.help) corpus.addCommand(c);
});

const mk = (setup?: Parameters<typeof createSimMachine>[0]) => createSimMachine(setup, { registry: reg });
const run = async (m: SimMachine, line: string) => {
  const r = await m.exec(line);
  return { ...r, out: stripAnsi(r.out) };
};

describe('simulated shell', () => {
  it('starts as learner in the home directory', async () => {
    const m = await mk();
    expect((await run(m, 'pwd')).out).toBe('/home/learner\n');
    expect((await run(m, 'echo $USER $HOME')).out).toBe('learner /home/learner\n');
    expect(m.prompt()).toContain('learner@trainer');
  });

  it('runs pipes, redirects and $?', async () => {
    const m = await mk({ files: [{ path: '/srv/a.conf' }, { path: '/srv/b.txt' }, { path: '/srv/c.conf' }] });
    expect((await run(m, 'ls /srv | grep conf')).out).toBe('a.conf\nc.conf\n');
    await run(m, 'echo hello > ~/greeting.txt');
    await run(m, 'echo again >> ~/greeting.txt');
    expect((await run(m, 'cat ~/greeting.txt')).out).toBe('hello\nagain\n');
    expect((await run(m, 'cat < ~/greeting.txt | grep -c a')).out).toBe('1\n');
    await run(m, 'ls /srv | grep nothing');
    expect((await run(m, 'echo $?')).out).toBe('1\n');
    expect((await run(m, 'false || echo fallback')).out).toBe('fallback\n');
    expect((await run(m, 'true && echo chained')).out).toBe('chained\n');
  });

  it('expands variables, globs, tilde and $(…)', async () => {
    const m = await mk({ files: [{ path: '~/x.log' }, { path: '~/y.log' }, { path: '~/z.txt' }] });
    expect((await run(m, 'echo *.log')).out).toBe('x.log y.log\n');
    expect((await run(m, "echo '*.log'")).out).toBe('*.log\n');
    await run(m, 'export NAME=world');
    expect((await run(m, 'echo "hi $NAME"')).out).toBe('hi world\n');
    expect((await run(m, 'echo $(pwd)/sub')).out).toBe('/home/learner/sub\n');
    expect((await run(m, 'echo ${MISSING:-default}')).out).toBe('default\n');
  });

  it('cd, mkdir -p, rm -r, touch', async () => {
    const m = await mk();
    await run(m, 'mkdir -p a/b/c');
    await run(m, 'cd a/b');
    expect((await run(m, 'pwd')).out).toBe('/home/learner/a/b\n');
    await run(m, 'cd -');
    expect((await run(m, 'pwd')).out).toBe('/home/learner\n');
    await run(m, 'touch a/b/c/f');
    expect((await run(m, 'rm a')).out).toContain("cannot remove 'a': Is a directory");
    expect((await run(m, 'rm -r a')).exit).toBe(0);
    expect((await run(m, 'ls a')).out).toContain('No such file or directory');
    expect((await run(m, 'rm -rf /')).out).toContain('dangerous');
  });

  it('enforces permissions and the sticky bit', async () => {
    const m = await mk({ users: [{ name: 'alice' }], files: [{ path: '/srv/secret', content: 'x', mode: '0600', owner: 'root' }] });
    expect((await run(m, 'cat /srv/secret')).out).toBe('cat: /srv/secret: Permission denied\n');
    expect((await run(m, 'ls /root')).out).toContain('Permission denied');
    expect((await run(m, 'touch /etc/new')).out).toContain('Permission denied');
    await run(m, 'touch /tmp/mine');
    m.switchUser('alice');
    expect((await run(m, 'rm /tmp/mine')).out).toContain('Operation not permitted');
  });

  it('runs scripts only when executable', async () => {
    const m = await mk({ files: [{ path: '~/deploy.sh', content: '#!/bin/sh\necho DEPLOY $1\nexit 3\n', mode: '0644' }] });
    expect((await run(m, './deploy.sh')).out).toBe('bash: ./deploy.sh: Permission denied\n');
    expect((await run(m, 'bash deploy.sh one')).out).toBe('DEPLOY one\n');
    m.rootFs.chmod('/home/learner/deploy.sh', 0o755);
    const r = await run(m, './deploy.sh two');
    expect(r.out).toBe('DEPLOY two\n');
    expect(r.exit).toBe(3);
  });

  it('ls -l shows inodes, modes and hard links', async () => {
    const m = await mk({ files: [{ path: '~/f', content: 'abc' }] });
    m.rootFs.link('/home/learner/f', '/home/learner/g');
    const out = (await run(m, 'ls -li')).out;
    expect(out).toMatch(/^total \d+\n/);
    const lines = out.trim().split('\n').slice(1);
    const [ino1] = lines[0].split(' ');
    const [ino2] = lines[1].split(' ');
    expect(ino1).toBe(ino2);
    expect(lines[0]).toMatch(/-rw-r--r-- 2 learner learner 3 /);
  });

  it('prints --help and man pages', async () => {
    const m = await mk();
    expect((await run(m, 'ls --help')).out).toMatch(/^Usage: ls/);
    const r = await m.exec('man ls');
    expect(r.effects?.some((e) => e.kind === 'pager')).toBe(true);
    expect(r.effects?.some((e) => e.kind === 'doc')).toBe(true);
    expect((await run(m, 'man nosuch')).out).toBe('No manual entry for nosuch\n');
    expect((await run(m, 'nosuch')).out).toBe('bash: nosuch: command not found\n');
  });

  it('produces facts for checks and snapshots/restores', async () => {
    const m = await mk();
    await run(m, 'mkdir -p ~/logs && touch ~/logs/app.log');
    const f = await m.facts();
    expect(f.files['/home/learner/logs/app.log'].type).toBe('f');
    expect(evaluateCheck({ when: "files['/home/learner/logs/app.log'].type=f" }, f).pass).toBe(true);
    expect(f.term.main.at(-1)?.exit).toBe(0);
    const snap = await m.snapshot();
    await run(m, 'rm -r ~/logs');
    expect((await m.facts()).files['/home/learner/logs']).toBeUndefined();
    await m.restore(snap);
    expect((await m.facts()).files['/home/learner/logs/app.log']).toBeDefined();
  });

  it('completes commands and paths; knows continuation', async () => {
    const m = await mk({ files: [{ path: '~/notes.txt' }] });
    expect(m.complete('ec')).toContain('echo');
    expect(m.complete('cat no')).toEqual(['notes.txt']);
    expect(needsMore("echo 'x")).toBe(true);
    expect(needsMore('echo x')).toBe(false);
  });
});
