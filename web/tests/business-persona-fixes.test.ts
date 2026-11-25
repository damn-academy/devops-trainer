// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mountTrainer, type TrainerAi } from '../src/engine/trainers/widget';
import { loadDraft, saveDraft, clearDraft } from '../src/engine/trainers/storage';
import { governance, applicableChecks, governanceRemedies, health } from '../src/engine/trainers/oss';
import { mountOpencore, opencoreProject, OPENCORE_DEFAULTS } from '../src/blocks/product/opencore';
import { mountValuemetric } from '../src/blocks/product/valuemetric';
import { correlationModel, correlationChange } from '../src/blocks/scithink/correlation';
import { budgetWidget } from '../src/blocks/marketing/v2/budget';
import { MARKETING_V2_LESSONS } from '../src/blocks/marketing/v2';
import { externalContext } from '../src/engine/ai/external-panel';
import { packExternalPrompt } from '../src/engine/ai/external-prompt';
import { setLang } from '../src/core/i18n';
import type { Mounted, WidgetCtx } from '../src/core/types';
const mounts: Mounted[] = [];
const ctx = (): WidgetCtx => ({ level: 'beginner', complete: vi.fn(), record() {}, openDoc() {} });
const status = { configured: false, hasKey: false, locked: false, settings: null };
const service: TrainerAi = { status, ready: Promise.resolve(status), onChange: () => () => {}, stream: vi.fn() };
const host = () => { const el = document.createElement('div'); document.body.append(el); return el; };
const change = (input: HTMLInputElement | HTMLTextAreaElement, value: string) => { input.value = value; input.dispatchEvent(new Event('input')); };
function trainer(kind: Parameters<typeof mountTrainer>[0], id: string) {
  const el = host(), context = ctx();
  const mounted = mountTrainer(kind, el, { trainer: id, file: id }, context, service); mounts.push(mounted);
  return { el, context, mounted, button: (text: string) => [...el.querySelectorAll('button')].find(b => b.textContent === text)! };
}
beforeEach(() => { localStorage.clear(); setLang('en'); });
afterEach(() => { mounts.splice(0).forEach(m => m.dispose()); document.body.replaceChildren(); vi.restoreAllMocks(); });
it.each([['rubric', 'pr.crisis-statement'], ['roleplay', 'events.booth-visitor'], ['template', 'llm-panel']] as const)('restores %s drafts without a key and clears only on explicit finish', (kind, id) => {
  const a = trainer(kind, id); change(a.el.querySelector('textarea')!, 'Unsent draft'); a.mounted.dispose();
  const b = trainer(kind, id); expect(b.el.querySelector('textarea')!.value).toBe('Unsent draft');
  expect(service.stream).not.toHaveBeenCalled();
  b.el.querySelector<HTMLButtonElement>('button[data-finish]')!.click(); b.mounted.dispose();
  expect(trainer(kind, id).el.querySelector('textarea')!.value).toBe('');
});
it('isolates drafts and tolerates unavailable storage', () => {
  saveDraft('a', 'A'); saveDraft('b', 'B'); expect(loadDraft('a', '')).toBe('A');
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw Error('blocked'); });
  expect(loadDraft('a', '')).toBe(''); expect(() => { saveDraft('a', 'x'); clearDraft('a'); }).not.toThrow();
});
it('requires repository remedies and compatible choices before completing governance', () => {
  const w = trainer('governance', 'oss.governance');
  w.button('Compare with the repository').click(); expect(w.context.complete).not.toHaveBeenCalled();
  const checks = [...w.el.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
  expect(checks).toHaveLength(3); checks.forEach(c => c.click());
  w.el.querySelector<HTMLInputElement>('input[value=B]')!.click();
  w.button('Compare with the repository').click(); expect(w.context.complete).not.toHaveBeenCalled();
  w.el.querySelector<HTMLInputElement>('input[value=A]')!.click();
  w.button('Compare with the repository').click(); expect(w.context.complete).toHaveBeenCalledTimes(1);
  expect(w.el.querySelector('.tr-feedback')!.textContent).toContain(governanceRemedies[0] + ' ✓');
  for (let mask = 0; mask < 64; mask++) {
    const choices = Object.fromEntries(governance.groups.map((g,i) => [g.name, mask & 1 << i ? 'B' as const : 'A' as const]));
    expect(applicableChecks(governance, choices, { 0: true, 1: true, 2: true }).length === 0).toBe(mask === 0);
  }
});
it('renders revised health answer and restores the next question draft', () => {
  const a = trainer('health', 'oss.health'); a.button('Show analysis').click();
  expect(a.el.textContent?.replace(/\u00a0/g, ' ')).toContain(health.questions[0].answer[0].toUpperCase() + health.questions[0].answer.slice(1));
  a.button('Next').click(); change(a.el.querySelector('textarea')!, 'Second answer'); a.mounted.dispose();
  const b = trainer('health', 'oss.health'); expect(b.el.textContent).toContain('2/5'); expect(b.el.querySelector('textarea')!.value).toBe('Second answer');
});
it('restores an in-progress signal decision and revealed state', () => {
  const a = trainer('signal-feed', 'sales.signal-feed');
  a.button('Signal').click(); change(a.el.querySelector('textarea')!, 'Check evidence'); a.mounted.dispose();
  const b = trainer('signal-feed', 'sales.signal-feed'); expect(b.el.querySelector('textarea')!.value).toBe('Check evidence');
  const reveal = b.el.querySelector<HTMLButtonElement>('.quiz-item > button')!;
  reveal.click(); b.mounted.dispose();
  const c = trainer('signal-feed', 'sales.signal-feed'); expect(c.el.querySelector('textarea')!.disabled).toBe(true);
  c.button('Next').click(); expect(c.el.textContent).toContain('2/20');
});
it.each([mountOpencore, mountValuemetric])('keeps keyboard focus, labels and model inputs across mounts', mount => {
  const el = host(); const a = mount(el, {}); mounts.push(a);
  const input = el.querySelector<HTMLInputElement>('input')!; input.focus(); change(input, input.max);
  expect(document.activeElement).toBe(input); expect(input.labels!.length).toBe(1);
  const value = input.value; a.dispose(); mounts.push(mount(el, {})); expect(el.querySelector<HTMLInputElement>('input')!.value).toBe(value);
});
it('reconciles every displayed payer count with revenue', () => {
  for (const price of [1, 6, 6.5, 20]) for (const boundary of [0, .35, .8])
    opencoreProject({ ...OPENCORE_DEFAULTS, price, boundary }).rows.forEach(r => expect(r.revenue).toBe(r.paying * price));
});
it.each([10, 90])('uses change-size captions and predictions at strength %s', strength => {
  for (const [confounder, expected, caption] of [[0,'stay','почти не изменило'],[5,'stay','почти не изменило'],[70,'partial','уменьшило связь'],[100,'collapse','убрало почти всю связь']] as const) {
    const p = { strength, confounder }, base = correlationModel.run(p, new Set()), next = correlationModel.run(p, new Set(['within']));
    expect(correlationModel.breaks[0].predict.resolve(base,next)).toBe(expected);
    expect(next.at(-1)!.caption.ru).toContain(caption);
  }
  expect(correlationChange(100,20)).toBe('partial'); expect(correlationChange(100,90)).toBe('partial');
});
it('packs the Markdown task and title without inventing an error', () => {
  const c = externalContext({ lessonId: 'strategy.agents' });
  expect(c.task?.length).toBeGreaterThan(100); expect(c.lesson).toBeTruthy();
  const empty = packExternalPrompt(c); expect(empty).toContain(c.lesson!); expect(empty).toContain(c.task!.slice(0,100)); expect(empty).not.toMatch(/my mistake|я ошибся/);
  expect(packExternalPrompt({ ...c, want: 'My own question' })).toContain('My own question');
});
it('restores budget allocations and exposes the existing LLM workbook', async () => {
  const el = host(); const a = await budgetWidget.mount(el, {}, ctx()); mounts.push(a);
  change(el.querySelector('input')!, '0'); a.dispose(); el.replaceChildren();
  mounts.push(await budgetWidget.mount(el, {}, ctx())); expect(el.querySelector<HTMLInputElement>('input')!.value).toBe('0');
  expect(MARKETING_V2_LESSONS.find(l => l.id === 'marketing.search-llm')!.sections.some(s => s.kind === 'widget' && s.widget === 'template')).toBe(true);
});
it('downloads an editable document scaffold and restores learner edits', async () => {
  const { mountTaskDocument } = await import('../src/engine/trainers/document');
  const el = host(), a = mountTaskDocument(el, 'pr.press.task', 'Title', 'Authored task'); mounts.push(a);
  expect(el.querySelector('textarea')!.value).toContain('Authored task'); change(el.querySelector('textarea')!, 'My document'); a.dispose();
  mounts.push(mountTaskDocument(el, 'pr.press.task', 'Title', 'Authored task')); expect(el.querySelector('textarea')!.value).toBe('My document');
});
it('records calibration runs without confusing untouched midpoint with an answer', async () => {
  const { mountCalibration } = await import('../src/blocks/scithink/calibration');
  const el = host(); mounts.push(mountCalibration(el, {}, ctx()));
  expect(el.querySelector('output')!.textContent).toBe('—');
  el.querySelectorAll<HTMLButtonElement>('.scb-claim button').forEach(b => b.click());
  expect(el.querySelector('output')!.textContent).toBe('50%');
  el.querySelector<HTMLButtonElement>('.scb-actions button')!.click(); expect(el.querySelector('.scb-history')).toBeTruthy();
  el.querySelector<HTMLButtonElement>('.scb-actions button')!.click(); expect(el.querySelector('.scb-history')).toBeTruthy();
  expect(loadDraft<unknown[]>('scithink.calibration.history', [])).toHaveLength(1);
});
