// Key notation of the drills. Each engine uses its editor's own notation, so
// a drill's solution can be pasted into the real editor unchanged:
//   cm-vim   — Vim key notation as in `:normal` / `feedkeys`: `d2w`, `ci"new<Esc>`, `<C-v>jj`.
//   cm-emacs — Emacs `kbd` notation: `C-k C-k C-n C-y`, `M-f`, `RET`, `SPC`; a word
//              of plain characters (`foo`) types those characters, as `kbd` does.

import type { DrillEngine } from './types';

/** Vim notation → the keys @replit/codemirror-vim's `Vim.handleKey` takes (`d`, `<Esc>`, `<C-v>`). */
export function parseVimKeys(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '<') {
      const end = s.indexOf('>', i + 1);
      const name = end > i ? s.slice(i + 1, end) : '';
      if (end > i + 1 && /^([CSAM]-)*[A-Za-z0-9[\]^\\-]+$|^lt$/.test(name)) {
        out.push(name === 'lt' ? '<' : `<${name}>`);
        i = end;
        continue;
      }
    }
    out.push(s[i]);
  }
  return out;
}

/** The named keys of `kbd` notation that are not typed characters. */
export const EMACS_NAMED = new Set(['RET', 'SPC', 'TAB', 'DEL', 'ESC', '<left>', '<right>', '<up>', '<down>']);

/** True when the token is a chord or a named key (`C-k`, `M-y`, `C-x`, `RET`), not plain text. */
export function isEmacsChord(tok: string): boolean {
  return EMACS_NAMED.has(tok) || /^([CMS]-)+./.test(tok);
}

/** `kbd` notation → one entry per key: chords stay whole, a plain word becomes its characters. */
export function parseEmacsKeys(s: string): string[] {
  const out: string[] = [];
  for (const tok of s.trim().split(/\s+/).filter(Boolean)) {
    if (isEmacsChord(tok)) out.push(tok);
    else out.push(...[...tok]);
  }
  return out;
}

export function parseKeys(engine: DrillEngine, s: string): string[] {
  return engine === 'cm-vim' ? parseVimKeys(s) : parseEmacsKeys(s);
}

/** Arrow keys in either notation: the only keys a drill may forbid. */
export function isArrowKey(key: string): boolean {
  return /^<(Left|Right|Up|Down|left|right|up|down)>$/.test(key);
}
