import { describe, expect, it } from 'vitest';
import { compile, evaluate, readsTypedText } from '../src/core/predicate';
import { evaluateCheck } from '../src/core/check';
import type { Facts } from '../src/core/types';

const facts = {
  procs: [
    { pid: 1, cmd: 'systemd', ns: { pid: 'pid:[1]' }, nspid: [1] },
    { pid: 41, cmd: 'bash', ns: { pid: 'pid:[1]' }, nspid: [41] },
    { pid: 4126, cmd: 'stress-mem', ns: { pid: 'pid:[2]' }, nspid: [4126, 12] },
  ],
  cgroups: [
    { path: '/', procs: [1, 41], cgroup: { subtree_control: ['memory', 'pids'] }, memory: { max: 'max' } },
    { path: '/box', procs: [4126], memory: { max: 20 * 1024 * 1024 }, pids: { events: { max: 2 } } },
  ],
  files: { '/etc/hosts': { exists: true, text: '127.0.0.1 localhost\n', mode: '0644' } },
  units: { 'nginx.service': { active: 'active' } },
  term: { main: [{ line: 'ls', exit: 0, out: 'a\n' }, { line: 'false', exit: 1, out: '' }] },
};

describe('predicate language (09 §2.3)', () => {
  it('existence and filters', () => {
    expect(evaluate('procs[cmd=bash]', facts).pass).toBe(true);
    expect(evaluate('procs[cmd=nginx]', facts).pass).toBe(false);
    expect(evaluate('!procs[cmd=nginx]', facts).pass).toBe(true);
  });
  it('numbers do not match by substring (PID 41 vs 4126)', () => {
    expect(evaluate('procs[pid=41].cmd=bash', facts).pass).toBe(true);
    expect(evaluate('procs[pid=412].cmd=stress-mem', facts).pass).toBe(false);
  });
  it('index and count', () => {
    expect(evaluate('procs[cmd=stress-mem].nspid[last]=12', facts).pass).toBe(true);
    expect(evaluate('procs.#=3', facts).pass).toBe(true);
    expect(evaluate('procs#>=3', facts).pass).toBe(true);
    expect(evaluate("term['main'][last].exit=1", facts).pass).toBe(true);
  });
  it('sizes and max as infinity', () => {
    expect(evaluate('cgroups[path=/box].memory.max<=20Mi', facts).pass).toBe(true);
    expect(evaluate('cgroups[path=/].memory.max<=20Mi', facts).pass).toBe(false);
    expect(evaluate('cgroups[path=/].memory.max>20Mi', facts).pass).toBe(true);
  });
  it('has, in, substring, regexp, keys', () => {
    expect(evaluate('cgroups[path=/].cgroup.subtree_control has memory', facts).pass).toBe(true);
    expect(evaluate('cgroups[path=/].cgroup.subtree_control has cpu', facts).pass).toBe(false);
    expect(evaluate("units['nginx.service'].active in [active, reloading]", facts).pass).toBe(true);
    expect(evaluate("files['/etc/hosts'].text~'localhost'", facts).pass).toBe(true);
    expect(evaluate("files['/etc/hosts'].text=~'^127\\.0'", facts).pass).toBe(true);
    expect(evaluate("files['/etc/hosts'].mode='0644'", facts).pass).toBe(true);
  });
  it('boolean logic and grouping', () => {
    expect(evaluate('procs[cmd=bash] && (procs[cmd=nope] || units)', facts).pass).toBe(true);
    expect(evaluate('procs[cmd=nope] && procs[cmd=bash]', facts).pass).toBe(false);
  });
  it('macros: @pid and @start', () => {
    expect(evaluate('cgroups[procs has @pid(stress-mem)].memory.max<=20Mi', facts).pass).toBe(true);
    const start = { procs: [{ pid: 4126, cmd: 'stress-mem' }] };
    expect(evaluate('procs[cmd=stress-mem].pid=@start.procs[cmd=stress-mem].pid', facts, start).pass).toBe(true);
  });
  it('syntax errors carry a position', () => {
    expect(() => compile('procs[cmd=')).toThrow();
    expect(() => compile('a && ')).toThrow();
  });
  it('detects typed-text predicates', () => {
    expect(readsTypedText("term['main'][last].line~'ls'")).toBe(true);
    expect(readsTypedText("term['main'][last].out~'ls'")).toBe(false);
  });
});

describe('checks', () => {
  it('uses when, stdout and the first matching fail', () => {
    const f = facts as unknown as Facts;
    expect(evaluateCheck({ when: 'procs[cmd=bash]' }, f).pass).toBe(true);
    expect(evaluateCheck({ when: "term['main'][last].exit=1", stdout: /^$/ }, f).pass).toBe(true);
    const r = evaluateCheck({ when: 'procs[cmd=nginx]', fail: [{ if: 'procs[cmd=nope]', say: { ru: 'a', en: 'a' } }, { if: '!procs[cmd=nginx]', say: { ru: 'нет nginx', en: 'no nginx' } }] }, f);
    expect(r.pass).toBe(false);
    expect(r.failIndex).toBe(1);
    expect(r.say?.en).toBe('no nginx');
  });
});
