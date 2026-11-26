import { registerFeedbackSnapshot } from '../feedback/data';
import { snapshotForFeedback } from './feedback';
// The terminal widget: xterm.js bound to any Machine. xterm is loaded with the
// first terminal on the page (08 §3.6). The widget owns line editing
// (history, cursor keys, Ctrl+A/E/U/K/W/C/L, Tab completion, paste) and a
// less-like pager for `man`, so the machine only sees complete lines.

import { closeDoc } from '../docs/viewer';
import { bi, t } from '../../core/i18n';
import type { DocRef, ExecResult, Machine } from '../../core/types';
import { needsMore, SimMachine } from './shell';

export interface TerminalOptions {
  machine: Machine;
  rows?: number;
  /** Printed once before the first prompt. */
  banner?: string;
  onCommand?(line: string, result: ExecResult): void;
  onDoc?(ref: DocRef): void;
}

export interface TerminalHandle {
  focus(): void;
  /** Put text on the input line (from a command chip); Enter stays with the learner. */
  type(text: string): void;
  /** Run a line as if typed. */
  run(line: string): Promise<void>;
  /** Re-print a fresh prompt (after the machine was reset). */
  reset(banner?: string): void;
  dispose(): void;
}

type XTerm = import('@xterm/xterm').Terminal;

let xtermLoad: Promise<{ Terminal: typeof import('@xterm/xterm').Terminal; FitAddon: typeof import('@xterm/addon-fit').FitAddon }> | null = null;
export function loadXterm() {
  xtermLoad ??= Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit'), import('@xterm/xterm/css/xterm.css')]).then(([x, f]) => ({ Terminal: x.Terminal, FitAddon: f.FitAddon }));
  return xtermLoad;
}

/** Terminal colours from the CSS tokens (styles/tokens.css, 08 §6.5). */
export function readTheme(): Record<string, string> {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string, d: string) => cs.getPropertyValue(n).trim() || d;
  return {
    background: v('--term-bg', '#1f2126'),
    foreground: v('--term-fg', '#e6e1d6'),
    cursor: v('--term-cursor', '#e6e1d6'),
    cursorAccent: v('--term-bg', '#1f2126'),
    selectionBackground: v('--term-sel', '#4a4e5a'),
    black: v('--term-black', '#2a2c33'),
    red: v('--term-red', '#d47a6a'),
    green: v('--term-green', '#9cb88c'),
    yellow: v('--term-yellow', '#d9c49a'),
    blue: v('--term-blue', '#8fa8d6'),
    magenta: v('--term-magenta', '#a9a3e0'),
    cyan: v('--term-cyan', '#8ec3c0'),
    white: v('--term-white', '#d8d4cb'),
    brightBlack: v('--term-bright-black', '#6b6f7a'),
    brightRed: v('--term-red', '#d47a6a'),
    brightGreen: v('--term-green', '#9cb88c'),
    brightYellow: v('--term-yellow', '#d9c49a'),
    brightBlue: v('--term-blue', '#8fa8d6'),
    brightMagenta: v('--term-magenta', '#a9a3e0'),
    brightCyan: v('--term-cyan', '#8ec3c0'),
    brightWhite: v('--term-fg', '#f2eee6'),
  };
}

/**
 * On a phone a terminal of the window's width holds about 36 characters and
 * breaks every table. There it takes a smaller font and at least 80 columns,
 * and the box it sits in scrolls sideways.
 */
const NARROW_MIN_COLS = 80;
const SCROLL_HINT = bi('Терминал шире экрана: чтобы увидеть конец строки, сдвиньте его пальцем влево.', 'The terminal is wider than the screen: swipe it left to see the end of a line.');
const narrowScreen = () => window.matchMedia?.('(max-width: 600px)').matches ?? false;
export const termFontSize = () => (narrowScreen() ? 11 : 14);
export function fitTerminal(term: XTerm, fit: { fit(): void }) {
  const size = termFontSize();
  if (term.options.fontSize !== size) term.options.fontSize = size;
  fit.fit();
  const narrow = narrowScreen();
  if (narrow && term.cols < NARROW_MIN_COLS) term.resize(NARROW_MIN_COLS, term.rows);
  const box = term.element?.parentElement;
  if (box) box.style.overflowX = narrow ? 'auto' : '';
}

/**
 * On a phone the 80 columns are wider than the box: keep the cursor in view
 * while a long command is typed, shade the edge that hides columns and say
 * once, under the box, that it moves sideways. Returns the cleanup.
 */
export function followCursor(term: XTerm, box: HTMLElement, hintText: string): () => void {
  const edge = document.createElement('div');
  edge.className = 'term-edge';
  edge.setAttribute('aria-hidden', 'true');
  const hint = document.createElement('p');
  hint.className = 'term-scroll-hint';
  hint.textContent = hintText;
  hint.hidden = true;
  if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
  box.append(edge);
  box.after(hint);
  const update = () => {
    const hidden = narrowScreen() && box.scrollWidth - box.clientWidth > 4;
    const right = hidden && box.scrollLeft + box.clientWidth < box.scrollWidth - 4;
    edge.hidden = !right;
    edge.style.left = `${box.scrollLeft + box.clientWidth - 24}px`;
    hint.hidden = !hidden;
  };
  const follow = () => {
    if (!narrowScreen()) return update();
    const screen = term.element?.querySelector<HTMLElement>('.xterm-screen');
    if (screen && term.cols) {
      const cell = screen.clientWidth / term.cols;
      const x = term.buffer.active.cursorX * cell + screen.offsetLeft;
      const pad = cell * 4;
      if (x + pad > box.scrollLeft + box.clientWidth) box.scrollLeft = x + pad - box.clientWidth;
      else if (x - pad < box.scrollLeft) box.scrollLeft = Math.max(0, x - pad);
    }
    update();
  };
  const moved = term.onCursorMove(follow);
  const resized = term.onResize(update);
  box.addEventListener('scroll', update, { passive: true });
  requestAnimationFrame(update);
  return () => {
    moved.dispose();
    resized.dispose();
    box.removeEventListener('scroll', update);
    edge.remove();
    hint.remove();
  };
}

const visibleLen = (s: string) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').length;

export async function mountTerminal(el: HTMLElement, o: TerminalOptions): Promise<TerminalHandle> {
  const baseline = o.machine instanceof SimMachine && !el.closest('.lab') ? await o.machine.snapshot() : null;
  const unregisterFeedback = baseline && o.machine instanceof SimMachine
    ? registerFeedbackSnapshot(el, () => snapshotForFeedback(o.machine as SimMachine, baseline)) : () => {};
  const { Terminal, FitAddon } = await loadXterm();
  const term: XTerm = new Terminal({
    fontFamily: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: termFontSize(),
    lineHeight: 1.35,
    cursorBlink: true,
    cursorStyle: 'block',
    rows: o.rows ?? 14,
    scrollback: 2000,
    theme: readTheme(),
    allowProposedApi: false,
    convertEol: false,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(el);
  const m = o.machine as Machine & { cols?: number };
  const doFit = () => {
    try {
      fitTerminal(term, fit);
      if ('cols' in m) m.cols = term.cols;
    } catch {
      /* not visible yet */
    }
  };
  requestAnimationFrame(doFit);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(doFit) : null;
  ro?.observe(el);
  const unfollow = followCursor(term, el, t(SCROLL_HINT));
  const themeObs = new MutationObserver(() => (term.options.theme = readTheme()));
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onMq = () => (term.options.theme = readTheme());
  mq.addEventListener?.('change', onMq);

  let buf = '';
  let cur = 0;
  let pending = ''; // continuation lines
  let busy = false;
  const history: string[] = [];
  let hIdx = -1;
  let draft = '';
  let lastTab = 0;
  let pager: { lines: string[]; top: number; title: string; search?: string; typing?: string; note?: string } | null = null;

  const promptStr = () => (pending ? '> ' : m.prompt());
  const write = (s: string) => term.write(s.replace(/\r?\n/g, '\r\n'));
  const redraw = () => {
    term.write('\r\x1b[K' + promptStr() + buf);
    const back = buf.length - cur;
    if (back > 0) term.write(`\x1b[${back}D`);
  };
  const prompt = () => {
    buf = '';
    cur = 0;
    term.write(promptStr());
  };

  // ── pager ──
  const pageSize = () => Math.max(3, term.rows - 1);
  const drawPager = () => {
    if (!pager) return;
    const { lines, top, title } = pager;
    let out = '\x1b[H\x1b[2J';
    out += lines.slice(top, top + pageSize()).join('\r\n');
    const end = Math.min(lines.length, top + pageSize());
    const name = /^[\w.+-]+\(\w+\)$/.test(title) ? `Manual page ${title}` : title;
    const status = pager.typing !== undefined ? `/${pager.typing}` : `\x1b[7m ${name} line ${top + 1}-${end}/${lines.length}${pager.note ? ` ${pager.note}` : ''} (q quit, space next page, / search) \x1b[0m`;
    out += `\x1b[${term.rows};1H\x1b[2K${status}`;
    term.write(out);
  };
  const openPager = (title: string, text: string) => {
    pager = { lines: /^[\w.+-]+\(\w+\)$/.test(title) ? wrapPagerText(text, term.cols) : text.replace(/\n$/, '').split('\n'), top: 0, title };
    term.write('\x1b[?1049h');
    drawPager();
  };
  const closePager = () => {
    closeDoc();
    pager = null;
    term.write('\x1b[?1049l');
    prompt();
  };
  const findNext = (from: number) => {
    if (!pager?.search) return;
    const re = pager.search.toLowerCase();
    const plain = (l: string) => l.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').toLowerCase();
    const idx = pager.lines.findIndex((l, i) => i >= from && plain(l).includes(re));
    if (idx < 0) pager.note = `(${pager.search}: pattern not found)`;
    else {
      pager.note = undefined;
      pager.top = Math.min(idx, Math.max(0, pager.lines.length - pageSize()));
    }
  };
  const pagerKey = (d: string) => {
    if (!pager) return;
    const max = Math.max(0, pager.lines.length - pageSize());
    if (pager.typing !== undefined) {
      if (d === '\r') {
        pager.search = pager.typing || pager.search;
        pager.typing = undefined;
        findNext(pager.top + 1);
      } else if (d === '\x1b' || d === '\x03') pager.typing = undefined;
      else if (d === '\x7f' || d === '\b') pager.typing = pager.typing.slice(0, -1);
      else if (!d.startsWith('\x1b')) pager.typing += d.replace(/[\x00-\x1f]/g, '');
      return drawPager();
    }
    if (d === '/') {
      pager.typing = '';
      return drawPager();
    }
    if (d === 'n') {
      findNext(pager.top + 1);
      return drawPager();
    }
    if (d === 'q' || d === 'Q' || d === '\x03') return closePager();
    if (d === ' ' || d === 'f' || d === '\x1b[6~') pager.top = Math.min(max, pager.top + pageSize());
    else if (d === 'b' || d === '\x1b[5~') pager.top = Math.max(0, pager.top - pageSize());
    else if (d === 'j' || d === '\r' || d === '\x1b[B') pager.top = Math.min(max, pager.top + 1);
    else if (d === 'k' || d === '\x1b[A') pager.top = Math.max(0, pager.top - 1);
    else if (d === 'g' || d === '\x1b[H') pager.top = 0;
    else if (d === 'G' || d === '\x1b[F') pager.top = max;
    drawPager();
  };

  // ── run ──
  const submit = async () => {
    const line = pending ? `${pending}\n${buf}` : buf;
    term.write('\r\n');
    if (needsMore(line)) {
      pending = line;
      prompt();
      return;
    }
    pending = '';
    if (line.trim()) {
      history.push(line);
      hIdx = -1;
    }
    busy = true;
    let res: ExecResult;
    try {
      res = await m.exec(line);
    } catch (e) {
      res = { out: `bash: internal error: ${(e as Error).message}\n`, exit: 1 };
    }
    busy = false;
    if (res.out) write(res.out);
    let paged = false;
    for (const ef of res.effects ?? []) {
      if (ef.kind === 'clear') term.clear();
      if (ef.kind === 'doc') o.onDoc?.(ef.ref);
      if (ef.kind === 'pager') {
        openPager(ef.title, ef.text);
        paged = true;
      }
    }
    o.onCommand?.(line, res);
    // For listeners outside the lesson (the AI tutor keeps the last terminal lines as context).
    document.dispatchEvent(new CustomEvent('dt:terminal', { detail: { machine: m.id, line, out: res.out, exit: res.exit } }));
    if (!paged) {
      if (res.effects?.some((e) => e.kind === 'clear')) term.write('\x1b[H\x1b[2J');
      prompt();
    }
  };

  const complete = () => {
    const cands = m.complete?.(buf.slice(0, cur)) ?? [];
    if (!cands.length) return;
    const word = /(\S*)$/.exec(buf.slice(0, cur))![1];
    let common = cands[0];
    for (const c of cands) while (!c.startsWith(common)) common = common.slice(0, -1);
    if (cands.length === 1) {
      const add = cands[0].slice(word.length) + (cands[0].endsWith('/') ? '' : ' ');
      buf = buf.slice(0, cur) + add + buf.slice(cur);
      cur += add.length;
      redraw();
    } else if (common.length > word.length) {
      const add = common.slice(word.length);
      buf = buf.slice(0, cur) + add + buf.slice(cur);
      cur += add.length;
      redraw();
    } else if (Date.now() - lastTab < 600) {
      term.write('\r\n' + cands.join('  ') + '\r\n');
      redraw();
    }
    lastTab = Date.now();
  };

  const insert = (s: string) => {
    buf = buf.slice(0, cur) + s + buf.slice(cur);
    cur += s.length;
    if (cur === buf.length) term.write(s);
    else redraw();
  };

  term.onData(async (d) => {
    if (pager) return pagerKey(d);
    if (busy) return;
    switch (d) {
      case '\r':
        return submit();
      case '\x7f':
      case '\b':
        if (cur > 0) {
          buf = buf.slice(0, cur - 1) + buf.slice(cur);
          cur--;
          redraw();
        }
        return;
      case '\x1b[3~':
        if (cur < buf.length) {
          buf = buf.slice(0, cur) + buf.slice(cur + 1);
          redraw();
        }
        return;
      case '\x1b[D':
        if (cur > 0) {
          cur--;
          term.write('\x1b[D');
        }
        return;
      case '\x1b[C':
        if (cur < buf.length) {
          cur++;
          term.write('\x1b[C');
        }
        return;
      case '\x1b[A':
        if (!history.length) return;
        if (hIdx === -1) {
          draft = buf;
          hIdx = history.length - 1;
        } else hIdx = Math.max(0, hIdx - 1);
        buf = history[hIdx];
        cur = buf.length;
        return redraw();
      case '\x1b[B':
        if (hIdx === -1) return;
        hIdx++;
        if (hIdx >= history.length) {
          hIdx = -1;
          buf = draft;
        } else buf = history[hIdx];
        cur = buf.length;
        return redraw();
      case '\x01':
      case '\x1b[H':
      case '\x1bOH':
        cur = 0;
        return redraw();
      case '\x05':
      case '\x1b[F':
      case '\x1bOF':
        cur = buf.length;
        return redraw();
      case '\x03':
        term.write('^C\r\n');
        pending = '';
        return prompt();
      case '\x0c':
        term.write('\x1b[H\x1b[2J');
        return redraw();
      case '\x15':
        buf = buf.slice(cur);
        cur = 0;
        return redraw();
      case '\x0b':
        buf = buf.slice(0, cur);
        return redraw();
      case '\x17': {
        const left = buf.slice(0, cur).replace(/\S+\s*$/, '');
        buf = left + buf.slice(cur);
        cur = left.length;
        return redraw();
      }
      case '\t':
        return complete();
    }
    if (d.startsWith('\x1b')) return;
    // printable text or a paste; a paste may contain several lines
    const parts = d.replace(/\r\n?/g, '\n').split('\n');
    for (let i = 0; i < parts.length; i++) {
      const text = parts[i].replace(/[\x00-\x1f]/g, '');
      if (text) insert(text);
      if (i < parts.length - 1) await submit();
    }
  });

  if (o.banner) write(o.banner + '\n');
  prompt();

  return {
    focus: () => term.focus(),
    type(text: string) {
      if (pager || busy) return;
      buf = text;
      cur = text.length;
      redraw();
      term.focus();
    },
    async run(line: string) {
      if (pager || busy) return;
      buf = line;
      cur = line.length;
      redraw();
      await submit();
    },
    reset(banner?: string) {
      pager = null;
      pending = '';
      term.write('\x1b[?1049l');
      term.reset();
      if (banner) write(banner + '\n');
      prompt();
    },
    dispose() {
      unregisterFeedback();
      ro?.disconnect();
      unfollow();
      themeObs.disconnect();
      mq.removeEventListener?.('change', onMq);
      term.dispose();
    },
  };
}

export { visibleLen };

/** Wrap prose in man pages before pagination so long lines do not hide rows. */
export function wrapPagerText(text: string, columns: number): string[] {
  const width = Math.max(10, columns);
  return text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\n$/, '').split('\n').flatMap(line => {
    const out: string[] = [];
    while (line.length > width) {
      const space = line.lastIndexOf(' ', width);
      const split = space > 0 ? space : width;
      out.push(line.slice(0, split));
      line = line.slice(split).trimStart();
    }
    out.push(line);
    return out;
  });
}
