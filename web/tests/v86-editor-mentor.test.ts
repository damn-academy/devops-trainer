// The tutor's view of a fullscreen editor: the rendered screen and a compact
// editor state replace the command tail while an editor is open (ai/context.ts
// providers, editor-keys.ts mentorEditorContext). Fixtures are recorded on the
// real lab-editors image.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { clearTerminalTail, pushTerminal, registerTerminalContext, terminalTail } from '../src/engine/ai/context';
import { buildPrompt } from '../src/engine/ai/prompt';
import { parseEditorState } from '../src/engine/v86/editor-facts';
import { mentorEditorContext, mentorEditorState } from '../src/engine/v86/editor-keys';

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/editors/${name}.txt`, import.meta.url)), 'utf8');

describe('editor state for the tutor', () => {
  it('Vim: mode, buffer, cursor, lines around it, registers', () => {
    const s = mentorEditorState(parseEditorState(fixture('vimMacro')))!;
    expect(s).toMatchObject({ editor: 'vim', buffer: '/srv/train/list.txt', mode: 'n' });
    expect((s.registers as Record<string, string>).a).toContain('A;');
    expect((s.around as string[]).some((l) => /^\d+> /.test(l))).toBe(true);
  });

  it('Emacs: kill ring head and the buffer around point', () => {
    const s = mentorEditorState(parseEditorState(fixture('emacsYank')))!;
    expect(s).toMatchObject({ editor: 'emacs', buffer: '/srv/train/notes.txt', killhead: 'beta\n' });
    expect((s.around as string[]).join('\n')).toContain('gamma');
  });

  it('an editor without its agent says so and nothing else', () => {
    expect(mentorEditorState(parseEditorState(fixture('vimBare')))).toEqual({ editor: 'vim', instrumented: false });
    expect(mentorEditorState(parseEditorState(''))).toBeNull();
  });

  it('stays bounded however large the buffer and the screen are', () => {
    const big = JSON.stringify({ agent: 1, mode: 'n', cursor: { lnum: 500, col: 1 }, reg: Object.fromEntries([...'abcdefghijklmnopqrstuvwxyz'].map((r) => [r, 'x'.repeat(4000)])), buffers: [{ current: true, file: '/x', text: Array.from({ length: 2000 }, () => 'y'.repeat(500)).join('\n') }] });
    const area = parseEditorState(`P 1 (vim) S 0\nT vim.1.stamp 1\n\x1eSvim 1 socket\n${big}\n`);
    const ctx = mentorEditorContext(Array.from({ length: 200 }, () => 'z'.repeat(400)), area)!;
    expect(ctx.length).toBeLessThanOrEqual(43);
    expect(ctx.join('\n').length).toBeLessThan(10000);
  });
});

describe('terminal context providers', () => {
  afterEach(() => clearTerminalTail());

  it('an active provider replaces the command tail; an idle one leaves it', () => {
    pushTerminal('ls', 'a b', 0);
    let active = true;
    const off = registerTerminalContext(() => (active ? ['[editor screen]', 'token=sk-ant-api03-secretsecretsecretsecret', 'x'.repeat(500)] : null));
    expect(terminalTail()[0]).toBe('[editor screen]');
    expect(terminalTail().join('\n')).not.toContain('secretsecretsecret');
    expect(Math.max(...terminalTail().map((l) => l.length))).toBeLessThanOrEqual(200);
    active = false;
    expect(terminalTail()[0]).toBe('$ ls');
    off();
  });

  it('the prompt carries the editor screen inside <terminal>', () => {
    const lines = mentorEditorContext(['~', 'alpha;', '-- INSERT --'], parseEditorState(fixture('vimMacro')))!;
    const p = buildPrompt({ lang: 'en', level: 'beginner', mode: 'explain', introduced: [], terminal: lines, docTrail: [] } as never, 'why?');
    const env = p.layers.find((l) => l.id === 'environment')?.text ?? '';
    expect(env).toContain('[editor state]');
    expect(env).toContain('-- INSERT --');
  });
});
