// Behaviour probes of the editors lab (engine/v86/editor-probes.ts): the
// script that runs the learner's macro or config on a hidden input, and the
// facts a goal reads. The scripts themselves run on the lab-editors image
// (scripts/check-editors-lab.mjs, scripts/check-editors-page.mjs).

import { describe, expect, it } from 'vitest';
import { evaluateCheck } from '../src/core/check';
import type { Facts } from '../src/core/types';
import { EDITOR_DEMO, EDITOR_DEMO_TASKS } from '../src/engine/v86/editor-demo';
import { editorOnly } from '../src/engine/v86/editor-keys';
import { parseProbe, probeKey, probeScript, probesNamed, type EditorProbeSpec } from '../src/engine/v86/editor-probes';

const facts = (o: Record<string, unknown>) => ({ schema: 'dt.facts/v1', env: {}, procs: [], files: {}, term: { main: [] }, ...o }) as unknown as Facts;
const spec: EditorProbeSpec = { id: 'macro-a', editor: 'vim', input: 'one\ntwo\n', run: { macro: 'a' } };
const b64 = (s: string) => Buffer.from(s).toString('base64');

describe('probe scripts', () => {
  it('finds the probes a predicate names', () => {
    expect(probesNamed(["probe['macro-a'].text = 'x' && probe[\"cfg\"].ok", 'vim.mode = n'])).toEqual(['macro-a', 'cfg']);
  });

  it('runs the register from the live editor, or from the state it left on exit', () => {
    const live = facts({ vim: { running: true, reg: { a: 'A;\u001bj' }, regtype: { a: 'v' } } });
    const s = probeScript(spec, live)!;
    expect(s).toContain(b64(JSON.stringify(['A;\u001bj', 'v', 'raw'])));
    expect(s).toContain('vim -Nu NONE -i NONE -n -Es -S probe.vim in.txt');
    expect(Buffer.from(/'([^']+)' \| base64 -d > probe\.vim/.exec(s)![1], 'base64').toString()).not.toContain('silent!');
    // The key notation wins over raw bytes when the agent sends it.
    const keyed = probeScript(spec, facts({ vim: { running: true, reg: { a: '\u0080kb' }, regkeys: { a: 'A;<Esc>j' }, regtype: { a: 'v' } } }))!;
    expect(keyed).toContain(b64(JSON.stringify(['A;<Esc>j', 'v', 'keys'])));
    const gone = facts({ vim: { running: false, instrumented: false, last: { reg: { a: 'A;\u001bj' }, regtype: { a: 'v' } } } });
    expect(probeKey(spec, gone)).toBe(probeKey(spec, live));
    expect(probeScript(spec, facts({ vim: { running: true, reg: {} } }))).toBeNull();
  });

  it('Neovim runs headless, Emacs in batch, configs are loaded only when asked', () => {
    const nv = probeScript({ ...spec, editor: 'nvim' }, facts({ nvim: { running: true, reg: { a: 'x' } } }))!;
    expect(nv).toContain('nvim --headless -u NONE');
    expect(nv).toContain('loaded_clipboard_provider');
    const em = probeScript({ id: 'm', editor: 'emacs', input: 'a\n', run: { macro: 'last' } }, facts({ emacs: { running: true, macro: 'C-e ; C-n' } }))!;
    expect(em).toContain('emacs --batch -Q');
    expect(em).toContain(b64('C-e ; C-n'));
    const keys = probeScript({ id: 'k', editor: 'vim', input: 'a\n', run: { keys: 'dd' } }, facts({}))!;
    expect(keys).toContain('vim -Nu ~/.vimrc');
    expect(keys).toContain("normal! gg");
    const fn = probeScript({ id: 'f', editor: 'emacs', input: 'a\n', run: { call: 'my-tidy' } }, facts({}))!;
    expect(fn).toContain('-l ~/.emacs.d/init.el');
    expect(probeScript({ id: 'f', editor: 'emacs', input: '', run: { call: "x') (shell-command \"rm\"" } }, facts({}))).toBeNull();
  });

  it('parses the answer', () => {
    expect(parseProbe(`\x1eR 0\n${b64('one;\ntwo;\n')}\n\x1eX\n`)).toEqual({ ok: true, exit: 0, text: 'one;\ntwo;\n' });
    expect(parseProbe(`\x1eR 0\n${b64(';')}\n\x1eX\nEnd of buffer`)).toMatchObject({ ok: true, error: 'End of buffer' });
    expect(parseProbe(`\x1eR 124\n\x1eX\n`)).toMatchObject({ ok: false, exit: 124, text: '' });
    expect(parseProbe('garbage').ok).toBe(false);
  });
});

describe('the hidden-file goal of the demo', () => {
  const task = EDITOR_DEMO_TASKS.find((t) => t.id === 'vim-macro-hidden')!;
  const withProbe = (text: string) => facts({ vim: { running: true, instrumented: true, reg: { a: 'x' } }, probe: { 'macro-a': { ok: true, exit: 0, text } } });

  it('is declared with its probe and judged without the general facts', () => {
    expect(EDITOR_DEMO.probes?.map((p) => p.id)).toEqual(['macro-a']);
    expect(editorOnly(task)).toBe(true);
  });

  it('passes on the right text and explains the usual mistakes', () => {
    expect(evaluateCheck(task.check, withProbe('one;\ntwo;\nthree;\nfour;\nfive;\n')).pass).toBe(true);
    expect(evaluateCheck(task.check, withProbe('one;;;;;\ntwo\nthree\nfour\nfive\n')).say?.en).toMatch(/two semicolons/);
    expect(evaluateCheck(task.check, withProbe('one\ntwo;\nthree\nfour\nfive\n')).say?.en).toMatch(/different result/);
    expect(evaluateCheck(task.check, facts({ vim: { running: true, instrumented: true, reg: {} } })).say?.en).toMatch(/is empty/);
  });
});

describe('focused facts', () => {
  it('goals reading named files and editor facts skip the general facts', async () => {
    const { focusedOnly } = await import('../src/engine/v86/editor-keys');
    expect(EDITOR_DEMO_TASKS.every(focusedOnly)).toBe(true);
    expect(focusedOnly({ id: 'p', prompt: { ru: '', en: '' }, check: { when: "procs[cmd=vim] && files['/x'].text ~ 'y'" } })).toBe(false);
    expect(focusedOnly({ id: 'f', prompt: { ru: '', en: '' }, check: { when: () => true } })).toBe(false);
  });
});
