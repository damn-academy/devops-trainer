import { bi, t } from '../../core/i18n';
import { registerFeedbackSnapshot } from '../feedback/data';
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

/** A previous successful start is an estimate, never a deadline. */
export function bootProgress(elapsedMs: number, previousMs?: number): { elapsed: number; remaining?: number; overdue: boolean } {
  const elapsed = Math.max(0, Math.floor(elapsedMs / 1000));
  const expected = previousMs && Number.isFinite(previousMs) && previousMs > 0 ? Math.ceil(previousMs / 1000) : undefined;
  return { elapsed, remaining: expected === undefined ? undefined : Math.max(0, expected - elapsed), overdue: expected !== undefined && elapsed > expected };
}

export async function mountConsole(el: HTMLElement, m: V86Machine, o: { rows?: number } = {}): Promise<ConsoleHandle> {
  el.dataset.feedbackLab = m.id;
  const unregisterFeedback = registerFeedbackSnapshot(el, () => m.snapshotForFeedback());
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
  const started = performance.now();
  const timingKey = `dt.v86.boot.${m.profile.id}.${m.memoryMB}`;
  let previous: number | undefined;
  try { previous = Number(localStorage.getItem(timingKey)) || undefined; } catch { /* storage may be disabled */ }
  let showBootLog = false;
  let bootLog = '';
  const progress = document.createElement('div');
  progress.className = 'v86-boot-progress';
  const label = document.createElement('span');
  label.setAttribute('role', 'status');
  const details = document.createElement('button');
  details.type = 'button';
  details.className = 'btn ghost small';
  details.textContent = t(bi('Показать журнал загрузки', 'Show boot log'));
  details.onclick = () => {
    showBootLog = !showBootLog;
    details.textContent = t(showBootLog ? bi('Скрыть журнал загрузки', 'Hide boot log') : bi('Показать журнал загрузки', 'Show boot log'));
    term.clear();
    if (showBootLog) term.write(bootLog);
  };
  progress.append(label, details);
  el.prepend(progress);
  const drawProgress = () => {
    const p = bootProgress(performance.now() - started, previous);
    const estimate = p.remaining === undefined ? '' : p.overdue
      ? t(bi(' · дольше предыдущего запуска', ' · taking longer than the previous start'))
      : t(bi(` · примерно ещё ${p.remaining} с по предыдущему запуску`, ` · about ${p.remaining} s left based on the previous start`));
    label.textContent = t(bi(`Подготовка Linux: ${p.elapsed} с`, `Preparing Linux: ${p.elapsed} s`)) + estimate;
  };
  drawProgress();
  progress.hidden = m.phase === 'ready';
  const progressTimer = window.setInterval(drawProgress, 1000);
  if (m.phase === 'ready') clearInterval(progressTimer);
  const offPhase = m.onPhase((p) => {
    if (p === 'ready') {
      progress.hidden = true;
      clearInterval(progressTimer);
      try { localStorage.setItem(timingKey, String(performance.now() - started)); } catch { /* storage may be disabled */ }
      doFit();
    } else if (p === 'error') {
      clearInterval(progressTimer);
      showBootLog = true;
      term.write(bootLog);
    }
  });
  requestAnimationFrame(doFit);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(doFit) : null;
  ro?.observe(el);
  const themeObs = new MutationObserver(() => (term.options.theme = readTheme()));
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // A serial line has no size of its own: the guest is told the xterm size with
  // `stty -F /dev/ttyS0 cols … rows …` on the service channel, so BusyBox line
  // editing wraps long lines where xterm does (phones have ~40 columns).
  const offOut = m.onOutput((text) => {
    if (m.phase !== 'ready') bootLog = (bootLog + text).slice(-100000);
    if (m.phase === 'ready' || showBootLog) term.write(text);
  });
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
      if (m.phase !== 'ready') return;
      // Ctrl+U clears what is on the line; the text is then typed into the guest's editor.
      m.write('\x15' + text);
      term.focus();
    },
    write: (text: string) => term.write(text.replace(/\r?\n/g, '\r\n')),
    dispose() {
      clearInterval(progressTimer);
      progress.remove();
      unregisterFeedback();
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
