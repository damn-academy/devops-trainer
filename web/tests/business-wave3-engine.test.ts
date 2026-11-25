// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { parse } from 'yaml';
import { setLang, t } from '../src/core/i18n';
import { registry } from '../src/core/registry';
import { documentTemplate } from '../src/engine/trainers/document-fields';
import { documentDraft } from '../src/engine/ai/context';
import { saveDraft } from '../src/engine/trainers/storage';

afterEach(() => { setLang('ru'); localStorage.clear(); });
for (const lang of ['ru', 'en'] as const) it(`exports every metric YAML field and all ten rights rows in ${lang}`, () => {
  setLang(lang);
  const lesson = registry.lessons.get('metrics.truth')!;
  const yaml = lesson.sections.flatMap(s => s.kind === 'text' ? [...t(s.body).matchAll(/```yaml\n([\s\S]*?)```/g)].map(m => m[1]) : [])[0];
  const template = documentTemplate('metrics.truth.task', 'Contract', 'Task');
  for (const key of Object.keys(parse(yaml))) expect(template).toContain(`\n${key}: `);
  expect(template).toContain(lang === 'ru' ? 'Дата начала действия' : 'Effective date');
  const rights = documentTemplate('oss.donation.task', 'Rights', 'Task');
  const rows = rights.split('\n').filter(line => line.startsWith('| '));
  expect(rows).toHaveLength(12);
  expect(rows.every(row => row.split('|').length === 8)).toBe(true);
  expect(rights).toContain(lang === 'ru' ? 'Ключи подписи выпусков' : 'Release signing keys');
  expect(rights).toContain(lang === 'ru' ? 'Документ-основание' : 'Governing document');
});
it('includes only this lesson’s template drafts, with separate headings and live clears taking precedence', () => {
  const lesson = registry.lessons.get('metrics.arr')!;
  const files = lesson.sections.flatMap(s => s.kind === 'widget' && s.widget === 'template' ? [(s.props as {file:string}).file] : []);
  expect(files.length).toBeGreaterThan(1);
  for (const file of files) saveDraft(`template.${file}`, `Draft ${file}`);
  saveDraft('template.unrelated', 'Unrelated text');
  const root = document.createElement('div');
  const input = document.createElement('textarea'); input.dataset.templateId = files[0]; input.dataset.templateTitle = 'First card'; input.value = 'Live card'; root.append(input);
  const draft = documentDraft(lesson, root)!;
  expect(draft).toContain('## First card\n\nLive card');
  expect(draft).toContain(`## ${files[1]}\n\nDraft ${files[1]}`);
  expect(draft).not.toContain('Unrelated text');
  input.value = '';
  expect(documentDraft(lesson, root)).not.toContain(`Draft ${files[0]}`);
});
