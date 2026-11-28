// @vitest-environment jsdom
// The key trainer: key notation, the state check, and every sample drill
// replayed headless through applyDrill (CodeMirror 6 + the Vim layer or the
// trainer's Emacs layer in jsdom). The same applyDrill is what the trace
// builder compares with the real Vim and Emacs.

import { beforeAll, describe, expect, it } from 'vitest';
import { checkDrill } from '../src/engine/editor-drill/check';
import { DRILLS, EMACS_DRILLS, VIM_DRILLS, drillById } from '../src/engine/editor-drill/drills';
import { chordFromEvent } from '../src/engine/editor-drill/emacs';
import { parseEmacsKeys, parseVimKeys } from '../src/engine/editor-drill/keys';
import { applyDrill } from '../src/engine/editor-drill/session';

beforeAll(() => {
  // CodeMirror asks for layout boxes; jsdom has none.
  const rect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {} } as DOMRect;
  const list = Object.assign([], { item: () => null }) as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect ??= () => rect;
  Range.prototype.getClientRects ??= () => list;
  (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame ??= (fn: () => void) => setTimeout(fn, 0);
});

const d = (id: string) => drillById(id)!;
const run = (id: string, keys: string) => applyDrill(d(id).engine, d(id).start, keys);

describe('key notation', () => {
  it('splits Vim notation into handleKey keys', () => {
    expect(parseVimKeys('ci"new<Esc>')).toEqual(['c', 'i', '"', 'n', 'e', 'w', '<Esc>']);
    expect(parseVimKeys('<C-v>jjI# <Esc>')).toEqual(['<C-v>', 'j', 'j', 'I', '#', ' ', '<Esc>']);
    expect(parseVimKeys('a<lt>b<')).toEqual(['a', '<', 'b', '<']);
  });

  it('reads Emacs kbd notation: chords stay whole, words become characters', () => {
    expect(parseEmacsKeys('C-k C-k M-y')).toEqual(['C-k', 'C-k', 'M-y']);
    expect(parseEmacsKeys('C-a foo SPC RET')).toEqual(['C-a', 'f', 'o', 'o', 'SPC', 'RET']);
    expect(parseEmacsKeys('C-x r s a')).toEqual(['C-x', 'r', 's', 'a']);
  });

  it('turns browser key events into kbd chords, Option on macOS included', () => {
    const ev = (key: string, code: string, m: Partial<Record<'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey', boolean>> = {}) => ({ key, code, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...m });
    expect(chordFromEvent(ev('k', 'KeyK', { ctrlKey: true }))).toBe('C-k');
    expect(chordFromEvent(ev('ƒ', 'KeyF', { altKey: true }))).toBe('M-f');
    expect(chordFromEvent(ev('Backspace', 'Backspace', { altKey: true }))).toBe('M-DEL');
    expect(chordFromEvent(ev(' ', 'Space', { ctrlKey: true }))).toBe('C-SPC');
    expect(chordFromEvent(ev('Control', 'ControlLeft', { ctrlKey: true }))).toBeNull();
    expect(chordFromEvent(ev('r', 'KeyR', { metaKey: true }))).toBeNull();
  });
});

describe('the check reads the state, not the keys', () => {
  it('names what differs', () => {
    const v = checkDrill(d('vim.register'), { text: 'header\nbody\nfooter', cursor: { line: 0, ch: 0 }, mode: 'normal', registers: {}, killRing: [] });
    expect(v.ok).toBe(false);
    expect(v.mismatches.map((m) => m.field)).toEqual(['text', 'cursor', 'register']);
    expect(v.mismatches[0].message.ru).toContain('строке 4');
  });

  it('fails a no-arrows drill only when arrows were used', () => {
    const st = run('vim.dot', d('vim.dot').solution);
    expect(checkDrill(d('vim.dot'), st).ok).toBe(true);
    expect(checkDrill(d('vim.dot'), st, { usedArrows: true }).mismatches.map((m) => m.field)).toEqual(['arrows']);
  });
});

describe('sample drills', () => {
  it('has six Vim drills and four Emacs drills, each tagged with its engine', () => {
    expect(VIM_DRILLS).toHaveLength(6);
    expect(EMACS_DRILLS).toHaveLength(4);
    expect(new Set(DRILLS.map((x) => x.id)).size).toBe(DRILLS.length);
    for (const x of VIM_DRILLS) expect(x.engine).toBe('cm-vim');
    for (const x of EMACS_DRILLS) expect(x.engine).toBe('cm-emacs');
  });

  for (const drill of DRILLS) {
    it(`${drill.id}: the reference solution reaches the target`, () => {
      const st = applyDrill(drill.engine, drill.start, drill.solution);
      expect(checkDrill(drill, st).mismatches.map((m) => m.message.en)).toEqual([]);
    });
  }

  it('another correct way passes too', () => {
    expect(checkDrill(d('vim.d2w'), run('vim.d2w', 'dwdw')).ok).toBe(true);
    expect(checkDrill(d('vim.d2w'), run('vim.d2w', 'dw.')).ok).toBe(true);
    expect(checkDrill(d('vim.ci-quote'), run('vim.ci-quote', 'F"lct"new<Esc>')).ok).toBe(true);
    expect(checkDrill(d('emacs.words'), run('emacs.words', 'C-f '.repeat(13))).ok).toBe(true);
    expect(checkDrill(d('emacs.words'), run('emacs.words', 'C-u 1 3 C-f')).ok).toBe(true);
  });

  it('a wrong result does not pass', () => {
    expect(checkDrill(d('vim.d2w'), run('vim.d2w', 'dw')).ok).toBe(false);
    expect(checkDrill(d('emacs.yank-pop'), run('emacs.yank-pop', 'C-k C-d C-k C-d C-k C-y M-y')).ok).toBe(false);
    // Without the C-d between them the kills append into one entry.
    expect(run('emacs.yank-pop', 'C-k C-k C-k C-k').killRing).toEqual(['one\ntwo\n']);
  });
});

describe('the trainer\'s Emacs layer', () => {
  const at = (text: string, ch = 0) => ({ text, cursor: { line: 0, ch } });

  it('kills the newline when only blanks follow point', () => {
    expect(applyDrill('cm-emacs', at('ab  \ncd', 2), 'C-k').text).toBe('abcd');
  });

  it('transposes the two characters before point at the end of a line', () => {
    const st = applyDrill('cm-emacs', at('ab', 2), 'C-t');
    expect(st.text).toBe('ba');
    expect(st.cursor.ch).toBe(2);
  });

  it('kills backwards by word and prepends to the same entry', () => {
    expect(applyDrill('cm-emacs', at('one two', 7), 'M-DEL M-DEL').killRing).toEqual(['one two']);
  });

  it('copies a region to a register and inserts it', () => {
    const st = applyDrill('cm-emacs', at('abc'), 'C-SPC C-f C-f C-x r s q C-e C-x r i q');
    expect(st.registers.q).toBe('ab');
    expect(st.text).toBe('abcab');
  });

  it('treats ESC as the Meta prefix', () => {
    expect(applyDrill('cm-emacs', at('one two'), 'ESC f').cursor.ch).toBe(3);
  });
});

// Measured against Vim 9.0 and Emacs 28.2 on 28.11.2026. These tests pin the
// trainer's side, so a library update that changes it shows up here; drills
// must not depend on any of these cases.
describe('known differences from the real editors', () => {
  it('Vim: j on the last line goes to the end of the line (real Vim stays and beeps)', () => {
    expect(applyDrill('cm-vim', { text: 'one\ntwo', cursor: { line: 1, ch: 0 } }, 'j').cursor).toEqual({ line: 1, ch: 2 });
  });

  it('Vim: k on the first line goes to its start (real Vim stays)', () => {
    expect(applyDrill('cm-vim', { text: 'one\ntwo', cursor: { line: 0, ch: 2 } }, 'k').cursor).toEqual({ line: 0, ch: 0 });
  });

  it('Vim: after a block insert the cursor is one column right of real Vim', () => {
    expect(run('vim.block', d('vim.block').solution).cursor).toEqual({ line: 0, ch: 1 });
  });

  it('Vim: a macro register holds only the commands, not the typed text', () => {
    // Real Vim: getreg('a') == "I- \x1bj". The trainer keeps the inserted text
    // aside and replays it, so the macro works, but its register reads "Ij".
    expect(run('vim.macro', d('vim.macro').solution).registers.a).toBe('Ij');
  });
});
