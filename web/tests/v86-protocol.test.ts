import { describe, expect, it } from 'vitest';
import { factsScript, frameCommand, hideService, modeToOctal, OSC_PREFIX, parseFacts, PromptTracker, ServiceParser, shq, watchedPaths } from '../src/engine/v86/protocol';
import type { ProcFact } from '../src/core/types';

const mark = (exit: number, cwd: string) => `${OSC_PREFIX}${exit};${cwd}\x07`;

describe('PromptTracker', () => {
  it('removes prompt markers and records line, output and exit code', () => {
    const tr = new PromptTracker();
    const first = tr.output(`${mark(0, '/root')}root@linux:~# `);
    expect(first.text).toBe('root@linux:~# ');
    expect(first.marks).toEqual([{ exit: 0, cwd: '/root' }]);
    tr.input('ls /nope\r');
    const r = tr.output(`ls /nope\r\nls: /nope: No such file or directory\r\n${mark(1, '/root')}root@linux:~# `);
    expect(r.text).not.toContain('777');
    expect(tr.records).toEqual([{ line: 'ls /nope', exit: 1, out: 'ls: /nope: No such file or directory\n' }]);
    expect(tr.last).toEqual({ exit: 1, cwd: '/root' });
  });

  it('handles a marker split across chunks', () => {
    const tr = new PromptTracker();
    tr.output(mark(0, '/'));
    tr.input('cd /tmp\r');
    const whole = `cd /tmp\r\n${mark(0, '/tmp')}# `;
    let text = '';
    for (const ch of whole.match(/.{1,3}/gs)!) text += tr.output(ch).text;
    expect(text).toBe('cd /tmp\r\n# ');
    expect(tr.last?.cwd).toBe('/tmp');
    expect(tr.records[0]).toMatchObject({ line: 'cd /tmp', exit: 0, out: '' });
  });

  it('applies backspace and Ctrl+U to the remembered line and skips empty lines', () => {
    const tr = new PromptTracker();
    tr.output(mark(0, '/'));
    tr.input('lx\x7fs\r');
    tr.output(`ls\r\nbin\r\n${mark(0, '/')}`);
    tr.input('\r');
    tr.output(`\r\n${mark(0, '/')}`);
    tr.input('junk\x15pwd\r');
    tr.output(`pwd\r\n/\r\n${mark(0, '/')}`);
    expect(tr.records.map((r) => r.line)).toEqual(['ls', 'pwd']);
    expect(tr.count).toBe(2);
  });

  it('strips colours from recorded output', () => {
    const tr = new PromptTracker();
    tr.output(mark(0, '/'));
    tr.input('ls\r');
    tr.output(`ls\r\n\x1b[1;34mbin\x1b[m\r\n${mark(0, '/')}`);
    expect(tr.records[0].out).toBe('bin\n');
  });
});

describe('service channel', () => {
  it('frames a command so a subshell cannot break the channel', () => {
    const f = frameCommand(7, 'exit 3', '/root');
    expect(f).toContain("printf '\\036B7\\n'");
    expect(f).toContain("(cd '/root' 2>/dev/null; exit 3\n)");
    expect(f.endsWith("printf '\\036E7 %d\\n' $?\n")).toBe(true);
  });

  it('parses replies and ignores prompts and noise', () => {
    const p = new ServiceParser();
    expect(p.feed("sh: can't access tty; job control turned off\n/root # \x1eB1\nhel")).toEqual([]);
    expect(p.feed('lo\n\x1eE1 0\n\x1eB2\n\x1eE2 3\n')).toEqual([
      { id: 1, out: 'hello\n', exit: 0 },
      { id: 2, out: '', exit: 3 },
    ]);
  });

  it('quotes for the shell', () => {
    expect(shq("it's")).toBe(`'it'\\''s'`);
  });
});

describe('facts', () => {
  it('converts ls mode strings to octal', () => {
    expect(modeToOctal('-rw-r--r--')).toBe('0644');
    expect(modeToOctal('drwxr-xr-x')).toBe('0755');
    expect(modeToOctal('-rwsr-xr-x')).toBe('4755');
    expect(modeToOctal('drwxrwxrwt')).toBe('1777');
    expect(modeToOctal('-rwxr-S---')).toBe('2740');
  });

  it('parses the output of the facts script', () => {
    const out = [
      'K 5.6.15',
      'H lab',
      'S 80',
      'D /root',
      'P 0 1 (init) S 0 1 1 0',
      'A 1 init',
      'P 0 80 (sh) S 1 80 80 0',
      'A 80 -/bin/sh',
      'P 1000 95 (my (odd) prog) R 80 95 80',
      'A 95 ./prog --flag',
      'W',
      'root:x:0:0:root:/root:/bin/sh',
      'learner:x:1000:1000::/home/learner:/bin/sh',
      '.',
      'G',
      'root:x:0:',
      'learner:x:1000:learner',
      '.',
      'F /root/demo',
      '   4321 drwxr-xr-x    2 0        0               40 Nov 18 17:00 /root/demo',
      'F /root/note.txt',
      '   4322 -rw-r-----    1 1000     1000             6 Nov 18 17:00 /root/note.txt',
      'C',
      btoa('hello\n'),
      '.',
      'F /root/link',
      '   4323 lrwxrwxrwx    1 0        0                8 Nov 18 17:00 /root/link -> note.txt',
      'L note.txt',
      'N /root/missing',
    ].join('\n');
    const f = parseFacts(out);
    expect(f).toMatchObject({ kernel: '5.6.15', hostname: 'lab', shellPid: 80, shellCwd: '/root' });
    expect(f.procs.find((p) => p.pid === 95)).toMatchObject({ cmd: 'my (odd) prog', state: 'R', ppid: 80, uid: 1000, user: 'learner', argv: ['./prog', '--flag'] });
    expect(f.files['/root/demo']).toMatchObject({ exists: true, type: 'd', mode: '0755', ino: 4321, nlink: 2, owner: 'root' });
    expect(f.files['/root/note.txt']).toMatchObject({ type: 'f', mode: '0640', size: 6, owner: 'learner', group: 'learner', text: 'hello\n' });
    expect(f.files['/root/link']).toMatchObject({ type: 'l', target: 'note.txt' });
    expect(f.files['/root/missing']).toEqual({ exists: false });
    expect(f.groups.find((g) => g.name === 'learner')?.members).toEqual(['learner']);
  });

  it('lists only the watched paths in the script, quoted', () => {
    const s = factsScript(["/root/it's"]);
    expect(s).toContain(`for f in '/root/it'\\''s'; do`);
    expect(factsScript([])).not.toContain('for f in');
  });

  it('hides the service shell and its children from the process list', () => {
    const p = (pid: number, ppid: number, argv: string[]): ProcFact => ({ pid, ppid, uid: 0, state: 'S', cmd: argv[0], argv });
    const procs = [p(1, 0, ['init']), p(70, 1, ['setsid', 'sh', '-c', 'x', '/dev/ttyS1']), p(71, 70, ['sh']), p(90, 71, ['sh']), p(91, 90, ['tr']), p(80, 1, ['-/bin/sh'])];
    expect(hideService(procs, 71).map((x) => x.pid)).toEqual([1, 80]);
    expect(hideService(procs, undefined)).toHaveLength(6);
  });

  it('finds the paths a check reads', () => {
    expect(watchedPaths(["files['/etc/x'].exists && files[\"~/a b\"].type=d", "@start.files['/tmp/'].size>0", undefined])).toEqual(['/etc/x', '/root/a b', '/tmp']);
  });
});
