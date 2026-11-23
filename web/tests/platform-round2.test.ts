// @vitest-environment jsdom
import { beforeAll, expect, it, vi } from 'vitest';
import { bi, pluralRu, setLang } from '../src/core/i18n';
import { MemoryBackend, store } from '../src/core/store';
import { effectiveStep } from '../src/engine/docs/ladder';
import { mountQuiz } from '../src/engine/quiz/render';
import { metricDelta } from '../src/engine/explainer/geometry';
import { createSimMachine, stripAnsi } from '../src/engine/terminal/shell';
import { durationWeeks, professionPage } from '../src/app/home';
import { readDraft, writeDraft, clearDraft } from '../src/core/draft';
import { placementPage } from '../src/app/exam-placement';
import { renderPage, docFragment } from '../src/engine/docs/viewer';
import { corpus, refLabel } from '../src/engine/docs/corpus';
import { lintQuizItem, type LintIssue } from '../src/core/lint';
beforeAll(async () => {
  await store.init(new MemoryBackend()); setLang('ru');
  window.matchMedia ??= vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} });
});
const button = (root: HTMLElement, text: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.includes(text))!;
it('bounds early documentation and respects lesson and task support', () => {
  for (const block of ['orient', 'methodology']) for (let index = 0; index < 12; index++) expect(effectiveStep({ level: 'beginner', block, index, count: 12, override: 4, lessonStep: 4, stored: { step: 4, block, streak: 9 } })).toBeLessThanOrEqual(2);
  expect(effectiveStep({ level: 'experienced', block: 'linux', index: 8, count: 12, lessonStep: 2, override: 4 })).toBe(2);
});
it('does not invent deltas for missing metrics', () => {
  const step = { id: 'a', label: 'a', focus: [], caption: bi('', '') };
  expect(metricDelta([{ ...step, metrics: { missing: 304, kept: 2 } }], [{ ...step, metrics: { added: 99, kept: 3 } }])).toEqual({ kept: 1 });
});
it('enables order submission and restarts a failed attempt', () => {
  const root = document.createElement('div');
  mountQuiz(root, { id: 'round2.order', kind: 'order', prompt: bi('Порядок', 'Order'), steps: ['a', 'b', 'c'].map(id => ({ id, text: id })) }, { context: 'lesson' });
  expect(button(root, 'Проверить').disabled).toBe(false);
  button(root, 'Проверить').click(); expect(root.textContent).not.toContain('%');
  button(root, 'Ещё раз').click(); expect(button(root, 'Проверить').disabled).toBe(false);
});
it('marks wrong pairs and clears selection on retry', () => {
  const root = document.createElement('div');
  mountQuiz(root, { id: 'round2.match', kind: 'match', prompt: bi('Пары', 'Pairs'), pairs: [{ id: 'a', left: 'a', right: 'A' }, { id: 'b', left: 'b', right: 'B' }] }, { context: 'lesson' });
  for (const select of root.querySelectorAll('select')) { select.value = 'b'; select.dispatchEvent(new Event('change')); }
  button(root, 'Проверить').click(); expect(root.querySelectorAll('.is-wrong')).toHaveLength(1);
  expect(root.querySelectorAll('.q-correction')).toHaveLength(2);
  button(root, 'Ещё раз').click(); expect([...root.querySelectorAll('select')].every(s => s.value === '')).toBe(true);
  expect(button(root, 'Проверить').disabled).toBe(true);
});
it('rejects ambiguous matching labels', () => {
  const issues: LintIssue[] = [];
  lintQuizItem({ id: 'ambiguous', kind: 'match', prompt: bi('?', '?'), pairs: [{ id: 'a', left: 'a', right: 'same' }, { id: 'b', left: 'b', right: 'same' }] }, 'q', issues);
  expect(issues.some(x => x.msg.includes('duplicate right-hand'))).toBe(true);
});
it('formats plurals and recomputes the personal pace', () => {
  expect([1, 3, 11, 22].map(n => pluralRu(n, ['задание', 'задания', 'заданий']))).toEqual(['задание', 'задания', 'заданий', 'задания']);
  expect(durationWeeks(480, 5)).toBe(96);
  const root = professionPage('devops').el; const input = root.querySelector<HTMLInputElement>('.pace input')!;
  const initial = root.querySelector('.time')!.textContent;
  input.value = '5'; input.dispatchEvent(new Event('input'));
  expect(root.querySelector('.time')!.textContent).not.toBe(initial);
});
it('persists and clears resumable drafts', () => {
  writeDraft('round2', { index: 2, started: 123 }); expect(readDraft('round2')).toEqual({ index: 2, started: 123 });
  clearDraft('round2'); expect(readDraft('round2')).toBeUndefined();
});
it('resumes placement and does not charge a completely skipped attempt', () => {
  const page = placementPage('orient'); const prior = store.state.placement.orient?.length ?? 0;
  page.el.querySelector<HTMLButtonElement>('.level-card')!.click();
  const second = placementPage('orient'); expect(second.el.querySelector('.pl-count')?.textContent).toContain('1');
  while (second.el.querySelector('.pl-count')) button(second.el, 'Пропустить').click();
  expect(store.state.placement.orient?.length ?? 0).toBe(prior);
  page.dispose?.(); second.dispose?.();
});
it('shows Russian headings and a task gloss', () => {
  const page = corpus.findMan('nproc')!;
  expect(refLabel({ page: page.id, anchor: 'DESCRIPTION' })).toBe('Справка по nproc');
  expect(renderPage(page).querySelector('.doc-map-name')!.textContent).not.toBe('NAME');
  expect(docFragment({ page: page.id, anchor: 'DESCRIPTION', gloss: bi('Число доступных процессоров.', 'Available CPUs.') })!.textContent).toContain('Число доступных процессоров');
});
it('supports CPU inspection, grep context and conventional diff ordering', async () => {
  const m = await createSimMachine({});
  expect((await m.exec('lscpu')).out).toContain('CPU(s):                   1');
  await m.exec("printf 'zero\\nhit\\ntwo\\nthree\\nhit\\n' > /tmp/lines");
  expect(stripAnsi((await m.exec('grep -n -m 1 -A 1 -B 1 hit /tmp/lines')).out)).toBe('1-zero\n2:hit\n3-two\n');
  await m.exec("printf 'old\\n' > /tmp/old; printf 'new\\n' > /tmp/new");
  const diff = await m.exec('diff -u /tmp/old /tmp/new'); expect(diff.out).toMatch(/--- \/tmp\/old\t\d{4}-/); expect(diff.out).toContain('-old\n+new'); m.dispose();
});

it('wraps manual prose before pagination and keeps words intact', async () => {
  const { wrapPagerText } = await import('../src/engine/terminal/widget');
  expect(wrapPagerText('one two three four five\n', 14)).toEqual(['one two three', 'four five']);
});
it('explains editor limitations and shell placeholder syntax', async () => {
  const m = await createSimMachine({});
  expect((await m.exec('nano /tmp/example')).out).toContain('sed');
  expect((await m.exec('ssh <IP>')).out).toContain('без скобок');
  m.dispose();
});
it('supports type-first dig and rejects oversized ping payloads', async () => {
  const m = await createSimMachine({ user: 'root', ext: { net: { preset: 'home' } } });
  const a = await m.exec('dig MX shop.example');
  const b = await m.exec('dig shop.example MX');
  expect(a.exit).toBe(b.exit);
  expect(a.out).toContain(';shop.example.');
  expect(a.out).toContain('MX');
  expect((await m.exec('ping -s 65508 127.0.0.1')).exit).toBe(2);
  m.dispose();
});
it('includes reference answers and explanations in reports', async () => {
  const { referenceAnswer } = await import('../src/engine/quiz/review');
  const node = referenceAnswer({ id: 'r', kind: 'mcq', prompt: bi('?', '?'), options: [{ id: 'right', text: bi('Верно', 'Right'), correct: true }], explain: bi('Причина связана с `PATH`.', 'It is related to `PATH`.') });
  expect(node.textContent).toContain('Верно'); expect(node.querySelector('code')?.textContent).toBe('PATH');
});
it('restores a completed placement report without recording another attempt', async () => {
  const { registry } = await import('../src/core/registry');
  const tasks = registry.blocks.get('orient')!.placement.filter(t => t.level === 'experienced');
  clearDraft('placement/orient');
  writeDraft('placement-result/orient', { claimed: 'experienced', ids: tasks.map(t => t.id), answers: tasks.map(t => ({ id: t.id, right: true, guessed: false })), ms: 125000 });
  const before = store.state.placement.orient?.length ?? 0;
  const page = placementPage('orient');
  expect(page.el.querySelector('.pl-details')).not.toBeNull();
  expect(store.state.placement.orient?.length ?? 0).toBe(before);
  page.dispose?.(); clearDraft('placement-result/orient');
});
it('retains placement lesson status in the light home manifest', async () => {
  const { registry } = await import('../src/core/registry');
  const { toManifest, fromManifest } = await import('../src/core/manifest');
  const { placementDisposition, lessonStatus, remainingShare } = await import('../src/app/status');
  const lessons = [...registry.lessons.values()].filter(l => l.block === 'orient');
  const lesson = lessons.find(l => l.introduces.length)!;
  store.record({ kind: 'level.set', block: 'orient', level: 'experienced', via: 'choice' });
  store.record({ kind: 'placement.result', block: 'orient', claimed: 'experienced', passed: true, score: 1, failed: [], concepts: lessons.flatMap(l => l.introduces), gaps: [] });
  expect(placementDisposition(lesson)).toBe('covered'); expect(lessonStatus(lesson)).toBe('done'); expect(remainingShare('orient')).toBe(0);
  const light = fromManifest(toManifest(registry)).lessons.find(l => l.id === lesson.id)!;
  expect(light.introduces).toEqual(lesson.introduces);
  store.record({ kind: 'placement.result', block: 'orient', claimed: 'experienced', passed: true, score: .9, failed: ['gap'], concepts: [], gaps: lesson.introduces });
  expect(placementDisposition(light)).toBe('required');
});
it('passes the effective documentation step to the tutor without an internal label', async () => {
  const { currentTask } = await import('../src/engine/ai/context');
  const { registry } = await import('../src/core/registry');
  const lesson = [...registry.lessons.values()].find(l => l.sections.some(s => s.kind === 'terminal' && s.tasks.length))!;
  const section = lesson.sections.find(s => s.kind === 'terminal');
  if (section?.kind !== 'terminal') throw new Error('No terminal');
  const root = document.createElement('div'); const goal = document.createElement('div');
  goal.className = 'goal current'; goal.dataset.task = section.tasks[0].id; goal.dataset.docStep = '2'; root.append(goal);
  expect(currentTask(lesson, root)?.docStep).toBe(2);
});
it('offers CNI choices with core layers and an explicit scenario list', async () => {
  const { constructorWidget } = await import('../src/engine/kube-lite/ui/constructor');
  const root = document.createElement('div');
  const mount = constructorWidget.mount(root, { preset: 'full', layers: 'core', cni: 'choice', scenarios: ['netpol'] }, { level: 'experienced', complete() {}, record() {}, openDoc() {} });
  expect(root.querySelectorAll('.kc-run')).toHaveLength(1);
  root.querySelector<HTMLButtonElement>('button[data-id="cni"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(root.textContent).toContain('Calico'); mount.dispose();
});
