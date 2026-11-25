// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { setLang, t } from '../src/core/i18n';
import { MemoryBackend, store } from '../src/core/store';
import { templateTask } from '../src/engine/ai/context';
import { externalContext } from '../src/engine/ai/external-panel';
import { packExternalPrompt } from '../src/engine/ai/external-prompt';
import { productById } from '../src/core/products';
import { simulate, roiDefaults } from '../src/engine/trainers/model';
import { documentTemplate } from '../src/engine/trainers/document-fields';

beforeAll(async () => { await store.init(new MemoryBackend()); });
afterEach(() => { setLang('ru'); document.body.replaceChildren(); location.hash = ''; });
for (const language of ['ru', 'en'] as const) it(`uses complete sample-data criteria and actual CSV metadata in ${language}`, () => {
  setLang(language);
  for (const lesson of registry.lessons.values()) {
    if (lesson.block !== 'metrics') continue;
    for (const section of lesson.sections) {
      if (section.kind !== 'widget' || section.widget !== 'template') continue;
      const file = (section.props as { file: string }).file;
      const task = templateTask(lesson, file)!;
      const practice = lesson.sections.find(s => s.kind === 'text' && s.title?.ru === 'Практика на учебных данных');
      expect(practice?.kind).toBe('text');
      const context = externalContext({ lessonId: lesson.id, templateFile: file });
      const prompt = packExternalPrompt(context);
      expect(prompt).toContain(t(task.task.prompt));
      expect(prompt).toContain(`${file}${language === 'en' ? '-en' : ''}.csv`);
      expect(prompt).toMatch(language === 'ru' ? /Строк данных: \d+/ : /Data rows: \d+/);
      expect(prompt).toContain(t(productById('metrics')!.title));
      const main = lesson.sections.find(s => s.kind === 'text' && s.step === 'practice');
      if (main?.kind === 'text') expect(prompt).not.toContain(t(main.body));
      const input = document.createElement('textarea'); input.dataset.templateId = file; input.value = 'My CSV analysis'; document.body.append(input);
      const withDraft = packExternalPrompt(externalContext({ lessonId: lesson.id, templateFile: file }));
      expect(withDraft).toContain(t(task.task.prompt)); expect(withDraft).toContain('My CSV analysis');
      const globalPrompt = packExternalPrompt(externalContext({ lessonId: lesson.id }));
      expect(globalPrompt).toContain(t(task.task.prompt));
      if (main?.kind === 'text') expect(globalPrompt).not.toContain(t(main.body));
      input.remove();
    }
  }
  const finance = packExternalPrompt(externalContext({ lessonId: 'finance.taxes-federal' }));
  expect(finance).toContain(t(productById('finance')!.title)); expect(finance).not.toContain('DevOps Trainer');
});
it('applies every ROI transition to deduplicated companies', () => {
  const p = { ...roiDefaults, scans: 100, target: .8, dedup: .25, contacted: 1, meeting: 1, opportunity: 1, winRate: 1, cost: 21 * roiDefaults.profit };
  expect(simulate(p)).toEqual({ median: 20, probability: 0 });
  expect(simulate({ ...p, cost: 20 * p.profit })).toEqual({ median: 20, probability: 1 });
  expect(simulate({ ...p, dedup: 0 })).toEqual({ median: 0, probability: 0 });
});
it('names PQA outcomes as accounts in both languages', () => {
  setLang('ru'); expect(documentTemplate('metrics.pqa.task', '', '')).toContain('Пропущенные аккаунты со сделками');
  setLang('en'); expect(documentTemplate('metrics.pqa.task', '', '')).toContain('Missed accounts with deals');
});
