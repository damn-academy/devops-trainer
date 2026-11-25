// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renderMd } from '../src/core/markdown';
import { registry } from '../src/core/registry';
import { setLang, t } from '../src/core/i18n';
import { mountTaskDocument } from '../src/engine/trainers/document';
import { documentTemplate } from '../src/engine/trainers/document-fields';
import { documentDraft } from '../src/engine/ai/context';
import { externalContext, openExternalPanel } from '../src/engine/ai/external-panel';
import { packExternalPrompt } from '../src/engine/ai/external-prompt';

afterEach(() => { document.body.replaceChildren(); localStorage.clear(); vi.restoreAllMocks(); setLang('ru'); });
it('renders GFM headers, rows, alignment, inline markup and escaped pipes in a labelled focusable region', () => {
  const root = document.createElement('div');
  root.append(renderMd('Intro\n\n| Name | Value | Note |\n| :--- | ---: | :---: |\n| **A** | 1 | `x|y` |\n| B | 2 | a\\|b |\n\nAfter'));
  expect(root.querySelectorAll('table tr')).toHaveLength(3);
  expect(root.querySelectorAll('thead th[scope=col]')).toHaveLength(3);
  expect(root.querySelectorAll('tbody td')).toHaveLength(6);
  expect(root.querySelectorAll('th')[1].style.textAlign).toBe('right');
  expect(root.querySelectorAll('th')[2].style.textAlign).toBe('center');
  expect(root.querySelector('code')?.textContent).toBe('x|y');
  expect(root.querySelector('tbody tr:last-child td:last-child')?.textContent).toBe('a|b');
  expect(root.querySelector('[role=region]')?.getAttribute('tabindex')).toBe('0');
  expect(root.querySelector('[role=region]')?.getAttribute('aria-label')).toBeTruthy();
  expect(root.querySelectorAll('p')).toHaveLength(2);
});
it('renders an actual business lesson table with the authored row and column counts', () => {
  const lesson = registry.lessons.get('strategy.market-shifts')!;
  const sections = lesson.sections.filter(s => s.kind === 'text');
  let count = 0;
  for (const s of sections) {
    const source = t(s.body); const root = document.createElement('div'); root.append(renderMd(source));
    const groups = source.match(/(?:^\|.*\|\s*\n){2,}(?:\|.*\|)?/gm) ?? [];
    for (const [index, table] of [...root.querySelectorAll('table')].entries()) {
      const rows = groups[index].trim().split('\n');
      expect(table.rows.length).toBe(rows.length - 1);
      expect(table.rows[0].cells.length).toBe(rows[0].split('|').length - 2); count++;
    }
  }
  expect(count).toBeGreaterThan(0);
});
it('packs live and restored drafts with complete criteria, distinguishes untouched forms and allows clearing', () => {
  setLang('ru'); const lesson = registry.lessons.get('aicontent.brief')!;
  const task = lesson.sections.find(s => s.kind === 'text' && s.step === 'practice')!;
  if(task.kind !== 'text') throw Error('task');
  const host = document.createElement('div'); document.body.append(host);
  const id = `${lesson.id}.${task.id}`, title = t(task.title ?? lesson.title);
  const mounted = mountTaskDocument(host, id, title, t(task.body));
  const input = host.querySelector('textarea')!;
  expect(input.value).toContain('## Входные файлы');
  expect(documentDraft(lesson)).toBeUndefined();
  const draft = 'Мой бриф '.repeat(1000);
  input.value = draft; input.dispatchEvent(new Event('input'));
  const context = externalContext({ lessonId: lesson.id });
  expect(context.draft).toContain(draft.trim());
  const prompt = packExternalPrompt(context);
  expect(prompt).toContain(draft.trim()); expect(prompt).toContain(t(task.body));
  expect(prompt).toContain('Мой черновик'); expect(prompt).not.toContain('Я ещё не ответил');
  mounted.dispose(); expect(documentDraft(lesson)).toContain(draft.trim());
  mountTaskDocument(host, id, title, t(task.body));
  host.querySelector('textarea')!.value = '';
  expect(documentDraft(lesson)).toBeUndefined();
});
it('offers an editable preview, reports copy failure next to controls and downloads exactly the edited prompt', async () => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: vi.fn() });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(Error('denied')) } });
  const create = vi.fn((_blob: Blob) => 'blob:test'); Object.defineProperty(URL, 'createObjectURL', { configurable:true, value:create });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable:true, value:vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  openExternalPanel({ lessonId:'aicontent.brief' });
  const input = document.querySelector<HTMLTextAreaElement>('.external-preview')!;
  input.value = 'Edited prompt';
  const buttons = [...document.querySelectorAll('button')];
  buttons.find(b => b.textContent === 'Копировать')!.click();
  await vi.waitFor(() => expect(document.querySelector('[role=status]')?.textContent).toContain('скачайте файл'));
  buttons.find(b => b.textContent === 'Скачать запрос (.txt)')!.click();
  expect(create).toHaveBeenCalledOnce();
  expect(create.mock.calls[0][0]).toBeInstanceOf(Blob);
  expect(document.querySelector('textarea')!.value).toBe('Edited prompt');
});
it('creates nonempty field scaffolds for all AI content tasks without replacing saved prose', () => {
  for (const lesson of registry.lessons.values()) if (lesson.block === 'aicontent') for(const task of lesson.sections) if(task.kind === 'text' && task.step === 'practice') {
    const text = documentTemplate(`${lesson.id}.${task.id}`,t(task.title ?? lesson.title),t(task.body));
    expect(text.match(/^## /gm)!.length,lesson.id).toBeGreaterThan(3);
  }
});
