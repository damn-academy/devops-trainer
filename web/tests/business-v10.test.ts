// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { lessonPage } from '../src/app/lesson';
import { registry } from '../src/core/registry';
import { setLang, t } from '../src/core/i18n';
import type { TextSection } from '../src/core/types';
import { mountTaskDocument } from '../src/engine/trainers/document';
import { documentTemplate } from '../src/engine/trainers/document-fields';

afterEach(() => { document.body.replaceChildren(); localStorage.clear(); setLang('ru'); });

const taskOf = (id: string) => registry.lessons.get(id)!.sections.filter((s): s is TextSection => s.kind === 'text' && s.step === 'practice').map(s => t(s.body)).join('\n\n');

it('gives every finance lesson its own field names, not phrases cut out of quotes', () => {
  for (const lang of ['ru', 'en'] as const) {
    setLang(lang);
    for (const id of [...registry.lessons.keys()].filter(id => id.startsWith('finance.'))) {
      const task = taskOf(id);
      if (!task) continue;
      const template = documentTemplate(`${id}.task-1`, '', task);
      expect(template, id).toMatch(/^## /);
      for (const quoted of task.matchAll(/«([^»]+)»/g)) expect(template, id).not.toContain(`## ${quoted[1]}\n`);
    }
  }
});

it('puts the required module task first in the marketing module forms', () => {
  for (const id of ['fundamentals', 'content', 'platforms', 'video', 'community', 'events', 'analytics', 'regions']) {
    setLang('ru');
    expect(documentTemplate(`marketing.${id}.practice`, '', taskOf(`marketing.${id}`)), id).toMatch(/^## Обязательное задание: /);
    expect(documentTemplate(`marketing.${id}.practice`, '', taskOf(`marketing.${id}`)), id).toContain('## Дополнительно: ');
    setLang('en');
    expect(documentTemplate(`marketing.${id}.practice`, '', taskOf(`marketing.${id}`)), id).toMatch(/^## Required task: /);
  }
});

it('keeps a task document in lessons with a department simulator', () => {
  for (const id of ['events.no-booth', 'oss.cncf-path', 'aicontent.interactive', 'marketing.blog-distribution', 'marketing.sim-quarter', 'product.signals']) {
    const view = lessonPage(id);
    expect(view.el.querySelectorAll('.task-document'), id).toHaveLength(1);
    const finish = [...view.el.querySelectorAll<HTMLButtonElement>('.deptsim button')].find(b => /самопроверку симуляции/.test(b.textContent ?? ''))!;
    expect(finish.disabled, id).toBe(true);
    view.dispose?.();
  }
});

it('says the field is empty when a finished document was cleared', () => {
  const host = document.createElement('div'); document.body.append(host);
  mountTaskDocument(host, 'sales.d100-sequence.task', 'T', 'Task', () => {}, true);
  const field = host.querySelector('textarea')!;
  field.value = ''; field.dispatchEvent(new Event('input'));
  expect(host.querySelector('[role=status]')!.textContent).toContain('поле сейчас пустое');
});
