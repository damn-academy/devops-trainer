import { describe, expect, it } from 'vitest';
import { globToRegExp, parse } from '../src/engine/terminal/parser';

const ok = (s: string) => {
  const r = parse(s);
  if (!r.ok) throw new Error(r.error);
  return r.script;
};

describe('command-line parser', () => {
  it('splits lists, pipes and and-or chains', () => {
    const s = ok('ls | grep a && echo yes || echo no; pwd');
    expect(s).toHaveLength(2);
    expect(s[0].first.cmds).toHaveLength(2);
    expect(s[0].rest.map((r) => r.op)).toEqual(['&&', '||']);
  });
  it('keeps quotes and marks quoted parts', () => {
    const s = ok(`echo 'a b' "c $HOME" d\\ e`);
    const words = s[0].first.cmds[0].words;
    expect(words).toHaveLength(4);
    expect(words[1][0]).toEqual({ kind: 'lit', text: 'a b', quoted: true });
    expect(words[2].some((p) => p.kind === 'var' && p.name === 'HOME' && p.quoted)).toBe(true);
  });
  it('parses redirects with fds', () => {
    const c = ok('cmd > out.txt 2>&1 < in.txt')[0].first.cmds[0];
    expect(c.redirects.map((r) => [r.fd, r.op])).toEqual([
      [1, '>'],
      [2, 'dup'],
      [0, '<'],
    ]);
    const a = ok('cmd >> log 2> err')[0].first.cmds[0];
    expect(a.redirects.map((r) => [r.fd, r.op])).toEqual([
      [1, '>>'],
      [2, '>'],
    ]);
  });
  it('recognises assignments and comments', () => {
    const c = ok('A=1 B="x y" env # comment')[0].first.cmds[0];
    expect(c.assigns.map((a) => a.name)).toEqual(['A', 'B']);
    expect(c.words).toHaveLength(1);
  });
  it('reports incomplete input for continuation', () => {
    expect(parse("echo 'open")).toMatchObject({ ok: false, incomplete: true });
    expect(parse('ls |')).toMatchObject({ ok: false, incomplete: true });
    expect(parse('ls &&')).toMatchObject({ ok: false, incomplete: true });
  });
  it('reports syntax errors', () => {
    expect(parse('| ls')).toMatchObject({ ok: false, incomplete: false });
    expect(parse('ls > ')).toMatchObject({ ok: false });
  });
  it('command substitution', () => {
    const w = ok('echo $(pwd)')[0].first.cmds[0].words[1];
    expect(w[0]).toEqual({ kind: 'sub', src: 'pwd', quoted: false });
  });
  it('globs', () => {
    expect(globToRegExp('*.conf').test('nginx.conf')).toBe(true);
    expect(globToRegExp('*.conf').test('nginx.txt')).toBe(false);
    expect(globToRegExp('f?le[0-9]').test('file7')).toBe(true);
  });
});
