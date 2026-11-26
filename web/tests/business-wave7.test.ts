// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { setLang } from '../src/core/i18n';
import { buildPrompt } from '../src/engine/deptsim/model';
import { scenarios } from '../src/sims/scenarios';
import { mountTaskDocument } from '../src/engine/trainers/document';
import { mountTrainer } from '../src/engine/trainers/widget';
import aicontent from '../src/blocks/aicontent';
import * as dom from '../src/core/dom';
afterEach(() => { setLang('ru'); localStorage.clear(); vi.restoreAllMocks(); });
it.each(['sandbox', 'incubating'] as const)('uses stage criteria without rescaling %s counts', cncfStart => {
  const prompt = buildPrompt(scenarios.find(s => s.id === 'oss.incubation')!, { seed: 1, company: 'lumenmesh', difficulty: 'like-life', turns: 12, cncfStart }, 'ru');
  expect(prompt).toContain('Never rescale maintainer counts');
  expect(prompt).toContain('Use the company card counts whenever present');
  expect(prompt).not.toContain('пропорционально масштабируйте');
  if (cncfStart === 'sandbox') {
    expect(prompt).toContain('maintainer lifecycle with demonstrated use');
    expect(prompt).not.toContain('мейнтейнеры минимум из двух организаций');
    expect(prompt).not.toContain('Graduated');
  } else expect(prompt).toContain('мейнтейнеры минимум из двух организаций');
});
it.each(['ru', 'en'] as const)('downloads authored examples after live notes in %s', lang => {
  setLang(lang);
  const download = vi.spyOn(dom, 'downloadFile').mockImplementation(() => {});
  const host = document.createElement('div');
  const mounted = mountTaskDocument(host, 'aicontent.brief.task', 'Brief', 'Task');
  host.querySelector('textarea')!.value = 'My brief';
  host.querySelector('button')!.click();
  const content = download.mock.calls[0][1];
  expect(content).toContain(`My brief\n\n# ${lang === 'ru' ? 'Образец' : 'Example'}`);
  for (const fragment of ['source.txt', '10:05', '2026']) expect(content).toContain(fragment);
  mounted.dispose();
});
it('registers linter downloads and reproduces expected candidates', () => {
  expect(aicontent.lessons?.find(l => l.id === 'aicontent.editing')!.sections.some(s => s.kind === 'widget' && s.widget === 'template' && (s.props as {file: string}).file === 'ru-intensifiers-lint')).toBe(true);
  const output = execFileSync(process.execPath, ['public/templates/ru-intensifiers-lint.mjs', 'public/templates/ru-intensifiers-sample.txt'], { encoding: 'utf8' });
  expect(output.trim()).toBe(readFileSync('public/templates/ru-intensifiers-expected.txt', 'utf8').split('\n\n')[0]);
  const host = document.createElement('div');
  const mounted = mountTrainer('template', host, { file: 'ru-intensifiers-lint' }, { level: 'beginner', complete() {}, record() {}, openDoc() {} });
  expect(host.querySelectorAll('a[download]')).toHaveLength(3);
  mounted.dispose();
});
it('puts badge scans and deduplication before company transitions', () => {
  setLang('en');
  const host = document.createElement('div');
  const mounted = mountTrainer('events.roi', host, {}, { level: 'beginner', complete() {}, record() {}, openDoc() {} });
  const labels = [...host.querySelectorAll<HTMLElement>('.tr-fields label')].filter(label => !label.hidden);
  expect(labels[0].textContent).toBe('Number of badge scans');
  expect(labels[2].nextElementSibling?.textContent).toContain('Unique target companies: 45');
  const dedup = labels[2].querySelector('input')!;
  dedup.value = '0.5'; dedup.dispatchEvent(new Event('change'));
  expect(labels[2].nextElementSibling?.textContent).toContain('23');
  mounted.dispose();
});
