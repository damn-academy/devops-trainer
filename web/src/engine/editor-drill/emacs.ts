// The Emacs key layer of the trainer, on top of a CodeMirror 6 view.
//
// Why not @replit/codemirror-emacs (6.1.0, MIT): evaluated for this drill set
// and not taken. Its kill ring is one module-level array that is not
// exported, so a drill can neither reset nor read it, and two trainers on a
// page share it; M-f/M-b use CodeMirror's "group" motion, not Emacs words;
// there is no M-t, no registers, C-t is CodeMirror's transpose (wrong at the
// end of a line), and M-w writes to the system clipboard. It also pulls in
// @codemirror/autocomplete. The commands below are few and small, follow the
// Emacs manual and `simple.el`, and keep their state per view — which is
// what a drill check needs. Every drill is still replayed in `emacs -Q
// --batch` by the trace builder; this layer is never the reference.
//
// Not here on purpose (the course does it in the real Emacs): the
// minibuffer, modes and syntax tables (words are letters and digits, as in
// fundamental-mode), Lisp, windows, Emacs undo (C-/ is CodeMirror's linear
// undo), rectangles, search.

import { EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { undo } from '@codemirror/commands';

const isWord = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);

type Cmd = (m: EmacsMachine, n: number, hasArg: boolean) => void;

/** One Emacs layer per editor view: point and mark, kill ring, registers, prefix argument. */
export class EmacsMachine {
  killRing: string[] = [];
  registers: Record<string, string> = {};
  /** The last message, as Emacs shows in the echo area (unsupported key, nothing to yank…). */
  message = '';
  private yankPtr = 0;
  private mark: number | null = null;
  private markActive = false;
  private last = '';
  private thisCmd = '';
  private chain = '';
  private metaNext = false;
  private arg: { n: number; digits: string; uTimes: number } | null = null;
  private goalCol: number | null = null;
  private yanked: { from: number; to: number } | null = null;
  private awaitRegister: ((name: string) => void) | null = null;

  constructor(readonly view: EditorView) {}

  get point(): number {
    return this.view.state.selection.main.head;
  }

  private text() {
    return this.view.state.doc.toString();
  }

  /** Move point; with an active mark the region stays selected, as transient-mark-mode shows it. */
  goto(p: number) {
    const len = this.view.state.doc.length;
    const head = Math.max(0, Math.min(len, p));
    const anchor = this.markActive && this.mark !== null ? this.mark : head;
    this.view.dispatch({ selection: EditorSelection.single(anchor, head), scrollIntoView: true });
  }

  private replace(from: number, to: number, insert: string, point: number) {
    this.view.dispatch({ changes: { from, to, insert }, selection: EditorSelection.cursor(point), userEvent: 'input' });
    if (this.mark !== null) this.mark = this.mapPos(this.mark, from, to, insert.length);
  }

  private mapPos(p: number, from: number, to: number, ins: number) {
    if (p <= from) return p;
    if (p >= to) return p - (to - from) + ins;
    return from;
  }

  private deactivate() {
    this.markActive = false;
    this.goto(this.point);
  }

  // ── the kill ring (simple.el: kill-new, kill-append, current-kill) ──

  private kill(from: number, to: number, backward = false) {
    if (from === to) return;
    const s = this.view.state.sliceDoc(from, to);
    if (this.last === 'kill' && this.killRing.length) this.killRing[0] = backward ? s + this.killRing[0] : this.killRing[0] + s;
    else this.killRing.unshift(s);
    this.yankPtr = 0;
    this.replace(from, to, '', from);
    this.thisCmd = 'kill';
  }

  private yank(text: string) {
    const p = this.point;
    this.mark = p;
    this.markActive = false;
    this.replace(p, p, text, p + text.length);
    this.mark = p;
    this.yanked = { from: p, to: p + text.length };
    this.thisCmd = 'yank';
  }

  // ── motion helpers ──

  forwardWord(p: number, n = 1): number {
    const s = this.text();
    for (let k = 0; k < n; k++) {
      while (p < s.length && !isWord(s[p])) p++;
      while (p < s.length && isWord(s[p])) p++;
    }
    return p;
  }

  backwardWord(p: number, n = 1): number {
    const s = this.text();
    for (let k = 0; k < n; k++) {
      while (p > 0 && !isWord(s[p - 1])) p--;
      while (p > 0 && isWord(s[p - 1])) p--;
    }
    return p;
  }

  private vertical(n: number) {
    const doc = this.view.state.doc;
    const line = doc.lineAt(this.point);
    const col = this.goalCol ?? this.point - line.from;
    const target = Math.max(1, Math.min(doc.lines, line.number + n));
    const tl = doc.line(target);
    this.goto(tl.from + Math.min(col, tl.length));
    this.goalCol = col;
    this.thisCmd = 'vertical';
  }

  // ── the command table ──

  private static readonly commands: Record<string, Cmd> = {
    'C-f': (m, n) => m.goto(m.point + n),
    'C-b': (m, n) => m.goto(m.point - n),
    'C-n': (m, n) => m.vertical(n),
    'C-p': (m, n) => m.vertical(-n),
    'C-a': (m) => m.goto(m.view.state.doc.lineAt(m.point).from),
    'C-e': (m) => m.goto(m.view.state.doc.lineAt(m.point).to),
    '<right>': (m, n) => m.goto(m.point + n),
    '<left>': (m, n) => m.goto(m.point - n),
    '<down>': (m, n) => m.vertical(n),
    '<up>': (m, n) => m.vertical(-n),
    'M-f': (m, n) => m.goto(m.forwardWord(m.point, n)),
    'M-b': (m, n) => m.goto(m.backwardWord(m.point, n)),
    'M-<': (m) => m.goto(0),
    'M->': (m) => m.goto(m.view.state.doc.length),
    'C-d': (m, n) => m.replace(m.point, Math.min(m.view.state.doc.length, m.point + n), '', m.point),
    DEL: (m, n) => {
      const from = Math.max(0, m.point - n);
      m.replace(from, m.point, '', from);
    },
    RET: (m, n) => m.insert('\n'.repeat(n)),
    TAB: (m, n) => m.insert('\t'.repeat(n)),
    'C-k': (m, n, hasArg) => {
      const doc = m.view.state.doc;
      const p = m.point;
      if (hasArg) {
        let to = p;
        for (let k = 0; k < n; k++) {
          const l = doc.lineAt(to);
          to = l.to < doc.length ? l.to + 1 : l.to;
        }
        return m.kill(p, to);
      }
      const line = doc.lineAt(p);
      const rest = doc.sliceString(p, line.to);
      // "if no nonblanks there, kill thru newline" (kill-line)
      if (/^\s*$/.test(rest)) {
        if (line.to >= doc.length && !rest) {
          m.message = 'End of buffer';
          return;
        }
        return m.kill(p, Math.min(doc.length, line.to + 1));
      }
      m.kill(p, line.to);
    },
    'M-d': (m, n) => m.kill(m.point, m.forwardWord(m.point, n)),
    'M-DEL': (m, n) => m.kill(m.backwardWord(m.point, n), m.point, true),
    'C-SPC': (m) => {
      m.mark = m.point;
      m.markActive = true;
      m.message = 'Mark set';
      m.goto(m.point);
    },
    'C-g': (m) => {
      m.arg = null;
      m.chain = '';
      m.message = 'Quit';
      m.deactivate();
    },
    'C-x C-x': (m) => {
      if (m.mark === null) return void (m.message = 'No mark set in this buffer');
      const p = m.point;
      const mk = m.mark;
      m.mark = p;
      m.markActive = true;
      m.view.dispatch({ selection: EditorSelection.single(p, mk) });
    },
    'C-x h': (m) => {
      m.mark = m.view.state.doc.length;
      m.markActive = true;
      m.view.dispatch({ selection: EditorSelection.single(m.mark, 0) });
    },
    'C-w': (m) => {
      if (m.mark === null) return void (m.message = 'The mark is not set now, so there is no region');
      const [a, b] = [Math.min(m.mark, m.point), Math.max(m.mark, m.point)];
      m.markActive = false;
      m.kill(a, b, m.point < m.mark);
    },
    'M-w': (m) => {
      if (m.mark === null) return void (m.message = 'The mark is not set now, so there is no region');
      const [a, b] = [Math.min(m.mark, m.point), Math.max(m.mark, m.point)];
      const s = m.view.state.sliceDoc(a, b);
      if (m.last === 'kill' && m.killRing.length) m.killRing[0] += s;
      else m.killRing.unshift(s);
      m.yankPtr = 0;
      m.deactivate();
    },
    'C-y': (m) => {
      if (!m.killRing.length) return void (m.message = 'Kill ring is empty');
      m.yank(m.killRing[m.yankPtr]);
    },
    'M-y': (m, n) => {
      if (m.last !== 'yank' || !m.yanked || !m.killRing.length) {
        m.message = 'M-y: the previous command was not a yank (the trainer has no minibuffer to choose from)';
        return;
      }
      m.yankPtr = (m.yankPtr + n) % m.killRing.length;
      const { from, to } = m.yanked;
      const s = m.killRing[m.yankPtr];
      m.replace(from, to, s, from + s.length);
      m.mark = from;
      m.yanked = { from, to: from + s.length };
      m.thisCmd = 'yank';
    },
    // transpose-chars: at the end of a line, the two characters before point.
    'C-t': (m) => {
      const doc = m.view.state.doc;
      let p = m.point;
      if (p === 0) return void (m.message = 'Beginning of buffer');
      if (p === doc.lineAt(p).to && p > doc.lineAt(p).from) p--;
      if (p >= doc.length) return void (m.message = 'End of buffer');
      const a = doc.sliceString(p - 1, p);
      const b = doc.sliceString(p, p + 1);
      m.replace(p - 1, p + 1, b + a, p + 1);
    },
    // transpose-words (transpose-subr with forward-word): swap the word
    // before point with the next one; point ends after the second.
    'M-t': (m) => {
      const s1 = m.backwardWord(m.point);
      const e1 = m.forwardWord(s1);
      const e2 = m.forwardWord(e1);
      const s2 = m.backwardWord(e2);
      if (s2 < e1 || e2 === e1) return void (m.message = 'Don’t have two things to transpose');
      const st = m.view.state;
      const w1 = st.sliceDoc(s1, e1);
      const mid = st.sliceDoc(e1, s2);
      const w2 = st.sliceDoc(s2, e2);
      m.replace(s1, e2, w2 + mid + w1, e2);
    },
    'C-/': (m) => void undo(m.view),
    'C-_': (m) => void undo(m.view),
    'C-x u': (m) => void undo(m.view),
    // Text registers: C-x r s R copies the region, C-x r i R inserts (point before the text).
    'C-x r s': (m) => {
      m.awaitRegister = (r) => {
        if (m.mark === null) return void (m.message = 'The mark is not set now, so there is no region');
        m.registers[r] = m.view.state.sliceDoc(Math.min(m.mark, m.point), Math.max(m.mark, m.point));
        m.deactivate();
      };
    },
    'C-x r i': (m) => {
      m.awaitRegister = (r) => {
        const s = m.registers[r];
        if (s === undefined) return void (m.message = 'Register does not contain text');
        const p = m.point;
        m.replace(p, p, s, p);
        m.mark = p + s.length;
      };
    },
  };

  /** The chords and prefixes the layer knows, for the widget's "what works here" line. */
  static supported(): string[] {
    return Object.keys(EmacsMachine.commands);
  }

  private insert(s: string) {
    const p = this.point;
    this.markActive = false;
    this.replace(p, p, s, p + s.length);
  }

  /** Feed one key in `kbd` notation: `C-k`, `M-y`, `ESC`, `RET`, or a typed character. */
  press(key: string): void {
    this.message = '';
    if (key === 'ESC') {
      this.metaNext = true;
      return;
    }
    if (this.metaNext) {
      this.metaNext = false;
      if (!key.startsWith('M-')) key = key.startsWith('C-') ? `C-M-${key.slice(2)}` : `M-${key}`;
    }
    if (key === 'C-@') key = 'C-SPC';
    if (key === 'M-<backspace>' || key === 'M-BS') key = 'M-DEL';
    if (this.awaitRegister) {
      const fn = this.awaitRegister;
      this.awaitRegister = null;
      fn(key === 'SPC' ? ' ' : key);
      this.finish();
      return;
    }
    // Prefix argument: C-u, C-u C-u, C-u 12, M-3, C-3.
    if (key === 'C-u') {
      this.arg = this.arg ? { ...this.arg, n: this.arg.n * 4, uTimes: this.arg.uTimes + 1 } : { n: 4, digits: '', uTimes: 1 };
      return;
    }
    const digit = /^(?:[CM]-)?([0-9])$/.exec(key);
    if (digit && (key.length > 1 || (this.arg && this.arg.uTimes > 0))) {
      const digits = (this.arg?.digits ?? '') + digit[1];
      this.arg = { n: Number(digits), digits, uTimes: this.arg?.uTimes ?? 0 };
      return;
    }
    const chord = this.chain ? `${this.chain} ${key}` : key;
    const cmd = EmacsMachine.commands[chord];
    if (!cmd && Object.keys(EmacsMachine.commands).some((k) => k.startsWith(chord + ' '))) {
      this.chain = chord;
      return;
    }
    this.chain = '';
    const hasArg = this.arg !== null;
    const n = this.arg?.n ?? 1;
    this.arg = null;
    if (cmd) {
      this.thisCmd = chord;
      cmd(this, n, hasArg);
    } else if (key === 'SPC' || (key.length === 1 && key >= ' ')) {
      this.thisCmd = 'self-insert';
      this.insert((key === 'SPC' ? ' ' : key).repeat(n));
    } else {
      this.message = `${chord} is not in the key trainer`;
      this.thisCmd = this.last;
    }
    this.finish();
  }

  private finish() {
    if (this.thisCmd !== 'vertical') this.goalCol = null;
    if (this.thisCmd !== 'yank') this.yanked = null;
    this.last = this.thisCmd;
  }

  /** Reset the per-drill state (kill ring, registers, mark), as a fresh `emacs -Q` would have it. */
  reset() {
    this.killRing = [];
    this.registers = {};
    this.mark = null;
    this.markActive = false;
    this.last = this.thisCmd = this.chain = '';
    this.arg = null;
    this.metaNext = false;
    this.goalCol = null;
    this.yanked = null;
    this.awaitRegister = null;
    this.message = '';
  }

  /** True while a prefix (C-x, C-x r, ESC, C-u) waits for the rest of the chord. */
  pending(): string {
    if (this.metaNext) return 'ESC';
    if (this.awaitRegister) return `${this.chain || 'C-x r'} …`;
    if (this.chain) return this.chain;
    if (this.arg) return this.arg.digits ? `C-u ${this.arg.digits}` : Array(this.arg.uTimes).fill('C-u').join(' ');
    return '';
  }
}

/** A browser key event in `kbd` notation, or null for a lone modifier or a key the layer ignores. */
export function chordFromEvent(e: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey'>): string | null {
  const named: Record<string, string> = { Enter: 'RET', Backspace: 'DEL', Tab: 'TAB', Escape: 'ESC', ' ': 'SPC', ArrowLeft: '<left>', ArrowRight: '<right>', ArrowUp: '<up>', ArrowDown: '<down>' };
  if (['Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'Unidentified', 'Process', 'Dead'].includes(e.key)) return null;
  // Cmd shortcuts on macOS stay with the browser and the system.
  if (e.metaKey) return null;
  let base = named[e.key] ?? (e.key.length === 1 ? e.key : '');
  // Option on macOS turns letters into other characters (⌥f → ƒ): read the physical key.
  if (e.altKey) {
    const code = /^Key([A-Z])$/.exec(e.code)?.[1] ?? /^Digit([0-9])$/.exec(e.code)?.[1];
    const punct: Record<string, [string, string]> = { Comma: [',', '<'], Period: ['.', '>'], Slash: ['/', '?'], BracketLeft: ['[', '{'], BracketRight: [']', '}'], Space: [' ', ' '], Backspace: ['DEL', 'DEL'] };
    if (code) base = e.shiftKey && /[A-Z]/.test(code) ? code : code.toLowerCase();
    else if (punct[e.code]) base = punct[e.code][e.shiftKey ? 1 : 0];
    if (base === ' ') base = 'SPC';
  }
  if (!base) return null;
  if (e.ctrlKey && /^[A-Z]$/.test(base)) base = base.toLowerCase();
  return `${e.ctrlKey ? 'C-' : ''}${e.altKey ? 'M-' : ''}${base}`;
}
