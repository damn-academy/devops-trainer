// The terminal of a real machine: xterm.js connected byte for byte to the
// guest's serial console ttyS0. Unlike the simulator's terminal, line editing,
// history and Tab completion are the guest shell's own (BusyBox ash), exactly
// as over SSH to a server.

import { loadXterm, readTheme } from '../terminal/widget';
import type { V86Machine } from './machine';

export interface ConsoleHandle {
  focus(): void;
  /** Put text on the guest's input line (from a command chip); Enter stays with the learner. */
  type(text: string): void;
  write(text: string): void;
  dispose(): void;
}

export async function mountConsole(el: HTMLElement, m: V86Machine, o: { rows?: number } = {}): Promise<ConsoleHandle> {
  const { Terminal, FitAddon } = await loadXterm();
  const term = new Terminal({
    fontFamily: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 14,
    lineHeight: 1.35,
    cursorBlink: true,
    rows: o.rows ?? 16,
    scrollback: 4000,
    theme: readTheme(),
    convertEol: false,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.open(el);
  let sized = '';
  const doFit = () => {
    try {
      fit.fit();
    } catch {
      return; /* not visible yet */
    }
    const size = `${term.cols}x${term.rows}`;
    if (size !== sized && m.phase === 'ready') {
      sized = size;
      m.resize(term.cols, term.rows);
    }
  };
  const offPhase = m.onPhase((p) => p === 'ready' && doFit());
  requestAnimationFrame(doFit);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(doFit) : null;
  ro?.observe(el);
  const themeObs = new MutationObserver(() => (term.options.theme = readTheme()));
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // A serial line has no size of its own: the guest is told the xterm size with
  // `stty -F /dev/ttyS0 cols … rows …` on the service channel, so BusyBox line
  // editing wraps long lines where xterm does (phones have ~40 columns).
  const offOut = m.onOutput((text) => term.write(text));
  const onData = term.onData((d) => {
    if (m.phase === 'ready') m.write(d);
  });
  const offCmd = m.on((ev) => {
    if (ev.t !== 'cmd.done') return;
    const rec = ev.record as { line: string; out: string; exit: number } | undefined;
    if (rec) document.dispatchEvent(new CustomEvent('dt:terminal', { detail: { machine: m.id, line: rec.line, out: rec.out, exit: rec.exit } }));
  });

  return {
    focus: () => term.focus(),
    type(text: string) {
      // Ctrl+U clears what is on the line; the text is then typed into the guest's editor.
      m.write('\x15' + text);
      term.focus();
    },
    write: (text: string) => term.write(text.replace(/\r?\n/g, '\r\n')),
    dispose() {
      offOut();
      offPhase();
      offCmd();
      onData.dispose();
      ro?.disconnect();
      themeObs.disconnect();
      term.dispose();
    },
  };
}
