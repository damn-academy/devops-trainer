import { lang } from '../../core/i18n';
import { parseRoute } from '../../core/router';
import { registry } from '../../core/registry';
import { store } from '../../core/store';
import { sanitize } from './data';
const errors: unknown[] = [];
const terminal: string[] = [];
export function listenFeedback(): void {
  const record = (value: unknown) => { errors.push(sanitize(value)); if (errors.length > 20) errors.shift(); };
  window.addEventListener('error', e => record({ message: e.message, source: e.filename.split('?')[0], line: e.lineno, time: new Date().toISOString() }));
  window.addEventListener('unhandledrejection', e => record({ message: String(e.reason).slice(0, 2000), time: new Date().toISOString() }));
  document.addEventListener('dt:terminal', e => {
    const d = (e as CustomEvent).detail;
    terminal.push(String(sanitize(`[${d.machine ?? 'sim'}] $ ${d.line}\n${d.out}\n[exit ${d.exit}]`)).slice(-32000));
    while (terminal.join('\n').length > 32000) terminal.shift();
  });
  window.addEventListener('hashchange', () => { terminal.length = 0; });
}
export function recentErrors() { return [...errors]; }
export function transcript() { return terminal.join('\n'); }
export function collectContext(target?: Element, selected?: unknown): Record<string, unknown> {
  const route = parseRoute(location.hash);
  const lesson = route.name === 'lesson' ? registry.lessons.get(route.id) : undefined;
  const block = lesson?.block ?? (route.name === 'block' || route.name === 'exam' || route.name === 'placement' ? route.id : undefined);
  const closest = (s: string) => target?.closest<HTMLElement>(s);
  return {
    build: import.meta.env.VITE_BUILD_COMMIT ?? 'development', route: location.hash.split('?')[0],
    block, lesson: lesson?.id, section: closest('.lsec')?.id.replace(/^s-/, ''),
    task: closest('[data-task]')?.dataset.task, quiz: closest('.quiz-item')?.dataset.id,
    examCard: closest('.ex2-card')?.dataset.feedbackId,
    explainer: closest('[data-model]')?.dataset.model, step: closest('[data-model]')?.dataset.feedbackStep,
    selection: selected, language: lang(), level: block ? store.state.levels[block] ?? 'beginner' : undefined,
    viewport: { width: innerWidth, height: innerHeight }, device: matchMedia('(pointer: coarse)').matches ? 'touch' : 'desktop', browser: navigator.userAgent,
  };
}
