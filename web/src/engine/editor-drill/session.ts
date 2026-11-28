// A trainer session: one CodeMirror 6 view with the Vim or the Emacs key
// layer, fed keys in the editor's own notation, read back as a DrillState.
//
// How verification against the real editors plugs in (Vim course §6.4, the
// trace builder `tools/trace-vim`; Emacs course §6.2 item 14):
//
//   1. For every drill the builder starts the editor of the `lab-editors`
//      image on `drill.start` and feeds `drill.solution` unchanged:
//        cm-vim   → `vim -Nu NONE -i NONE -Es` (and `nvim --headless --clean`),
//                   buffer and cursor set from `start`, then
//                   `:exe "normal" "<keys with \<Esc> etc.>"`, then `DtState()`
//                   (§6.2.2) writes text, cursor and registers as JSON;
//        cm-emacs → `emacs -Q --batch` on a buffer with `start`, then
//                   `(execute-kbd-macro (kbd "<solution>"))`, then prints
//                   buffer text, point and `kill-ring` as JSON.
//      Real Vim reports 1-based line and byte column; the builder converts to
//      the 0-based `Cursor` of this file.
//      `:normal` cannot record a macro (`q`), so drills with `q` go through
//      typed keys instead: `vim -Nu NONE -i NONE -n --not-a-term -s keys`,
//      the keys file ending with the `DtState()` call and `:qa!`.
//   2. A Node test (vitest, jsdom) calls `applyDrill(drill.engine, drill.start,
//      drill.solution)` from this file and compares the result with the
//      editor's JSON in every field the drill's target names (a target
//      without `cursor` does not compare cursors), and both with
//      `drill.target`.
//   3. A drill whose trainer state differs from the real editor is removed
//      from the trainer's set; the reference is never edited to match the
//      trainer. A drill may only enter the set when step 2 passes.
//
// `applyDrill` needs a DOM (CodeMirror measures nothing for it, but builds
// its elements): in the browser it uses `document`, in Node a jsdom window.

import { EditorSelection, EditorState, type Extension } from '@codemirror/state';
import { EditorView, drawSelection } from '@codemirror/view';
import { history } from '@codemirror/commands';
import { getCM, vim, Vim } from '@replit/codemirror-vim';
import { EmacsMachine } from './emacs';
import { parseKeys } from './keys';
import type { Cursor, DrillEngine, DrillStart, DrillState } from './types';

export interface Session {
  readonly engine: DrillEngine;
  readonly view: EditorView;
  /** The Emacs layer, for the cm-emacs engine. */
  readonly emacs?: EmacsMachine;
  /** Feed one key in the engine's notation (`<Esc>`, `d`, `C-k`, `M-y`, `a`). */
  press(key: string): void;
  state(): DrillState;
  /** Back to the start text and cursor, with registers and kill ring emptied. */
  reset(start?: DrillStart): void;
  destroy(): void;
}

function offset(state: EditorState, c: Cursor): number {
  const line = state.doc.line(Math.min(state.doc.lines, c.line + 1));
  return line.from + Math.min(c.ch, line.length);
}

function cursorOf(view: EditorView): Cursor {
  const head = view.state.selection.main.head;
  const line = view.state.doc.lineAt(head);
  return { line: line.number - 1, ch: head - line.from };
}

interface VimRegister {
  toString(): string;
}

function vimState(view: EditorView): DrillState {
  const cm = getCM(view) as unknown as { state: { vim?: { insertMode?: boolean; visualMode?: boolean } }; getCursor(): Cursor } | null;
  const v = cm?.state.vim;
  const regs = (Vim.getRegisterController() as unknown as { registers: Record<string, VimRegister | undefined> }).registers;
  const registers: Record<string, string> = {};
  for (const [name, r] of Object.entries(regs)) {
    const s = r?.toString() ?? '';
    if (s && /^["0-9a-z-]$/.test(name)) registers[name] = s;
  }
  // The Vim layer keeps its own cursor (`cm.getCursor()`): in visual mode the
  // CodeMirror selection head is one past the character under the block.
  const cursor = cm ? cm.getCursor() : cursorOf(view);
  return {
    text: view.state.doc.toString(),
    cursor: { line: cursor.line, ch: cursor.ch },
    mode: v?.insertMode ? 'insert' : v?.visualMode ? 'visual' : 'normal',
    registers,
    killRing: [],
  };
}

/**
 * Create a session. `parent` is where the editor goes (a detached element is
 * made when it is left out). `extensions` are added for the widget (theme,
 * key bar hooks); the key layer comes first so its keys win.
 */
export function createSession(engine: DrillEngine, start: DrillStart, opts: { parent?: HTMLElement; extensions?: Extension[]; vimStatus?: boolean } = {}): Session {
  const parent = opts.parent ?? document.createElement('div');
  const layer: Extension[] = engine === 'cm-vim' ? [vim({ status: !!opts.vimStatus })] : [];
  const make = (s: DrillStart) =>
    EditorState.create({
      doc: s.text,
      // Visual block in the Vim layer is one selection range per line.
      extensions: [...layer, history(), drawSelection(), EditorState.allowMultipleSelections.of(true), ...(opts.extensions ?? [])],
    });
  const view = new EditorView({ state: make(start), parent });
  const emacs = engine === 'cm-emacs' ? new EmacsMachine(view) : undefined;
  const place = (s: DrillStart) => {
    view.setState(make(s));
    view.dispatch({ selection: EditorSelection.cursor(offset(view.state, s.cursor)) });
    if (engine === 'cm-vim') {
      // Registers, macros and the last change are global in the Vim layer, as in one Vim process.
      Vim.resetVimGlobalState_();
      const cm = getCM(view);
      if (cm) {
        Vim.maybeInitVimState_(cm);
        cm.setCursor(s.cursor.line, s.cursor.ch);
        // Headless (Node, jsdom) there is no layout, and the Vim layer asks the
        // screen where j and k land (to step over folds). Without folds and
        // line wrapping that is the same line arithmetic as in real Vim.
        if (!opts.parent) {
          (cm as unknown as { findPosV: (cur: Cursor, amount: number) => Cursor }).findPosV = (cur, amount) => ({ line: Math.max(0, Math.min(view.state.doc.lines - 1, cur.line + amount)), ch: cur.ch });
        }
      }
    }
    emacs?.reset();
  };
  place(start);

  const pressVim = (key: string) => {
    const cm = getCM(view);
    if (!cm) return;
    const handled = Vim.handleKey(cm, key, 'user');
    const v = (cm.state as { vim?: { insertMode?: boolean } }).vim;
    if (handled || !v?.insertMode) return;
    // In insert mode the Vim layer leaves typing to the editor: do what the
    // browser's input would do, so the change is recorded for `.` and macros.
    const typed = key === '<CR>' ? '\n' : key === '<Tab>' ? '\t' : key === '<Space>' ? ' ' : key.length === 1 ? key : null;
    if (typed !== null) cm.replaceSelection(typed);
    else if (key === '<BS>') {
      const head = view.state.selection.main.head;
      if (head > 0) view.dispatch({ changes: { from: head - 1, to: head }, userEvent: 'delete.backward' });
    }
  };

  return {
    engine,
    view,
    emacs,
    press: (key) => (emacs ? emacs.press(key) : pressVim(key)),
    state: () => (emacs ? { text: view.state.doc.toString(), cursor: cursorOf(view), mode: 'normal', registers: { ...emacs.registers }, killRing: [...emacs.killRing] } : vimState(view)),
    reset: (s = start) => place(s),
    destroy: () => view.destroy(),
  };
}

/**
 * The pure entry point of the trainer: the state after feeding `keys` (in
 * the engine's notation) to `initial`. Used by the drill tests and by the
 * trace builder's comparison with the real Vim and Emacs.
 */
export function applyDrill(engine: DrillEngine, initial: DrillStart, keys: string): DrillState {
  const s = createSession(engine, initial);
  try {
    for (const k of parseKeys(engine, keys)) s.press(k);
    return s.state();
  } finally {
    s.destroy();
  }
}
