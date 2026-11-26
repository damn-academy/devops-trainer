// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { setLang } from '../src/core/i18n';
import { mountTrainer } from '../src/engine/trainers/widget';
import { mountTaskDocument } from '../src/engine/trainers/document';
import { roiDefaults, simulate } from '../src/engine/trainers/model';
import * as dom from '../src/core/dom';

const ctx = { level: 'beginner' as const, complete() {}, record() {}, openDoc() {} };
afterEach(() => { document.body.replaceChildren(); localStorage.clear(); setLang('ru'); vi.restoreAllMocks(); });

it('starts invited companies at contact, ignoring scan and deduplication settings', () => {
  const p = { ...roiDefaults, mode: 'invited' as const, invited: 20, scans: 0, target: 0, dedup: 0, contacted: 1, meeting: 1, opportunity: 1, winRate: 1 };
  expect(simulate(p)).toEqual({ median: 20, probability: 1 });
  expect(simulate({ ...p, contacted: 0 })).toEqual({ median: 0, probability: 0 });
  expect(simulate({ ...p, invited: 0 })).toEqual({ median: 0, probability: 0 });
  expect(simulate({ ...roiDefaults, mode: 'invited' })).toEqual(simulate(roiDefaults));
});

it.each(['ru', 'en'] as const)('switches ROI modes and validates only active fields in %s', language => {
  setLang(language);
  const host = document.createElement('div');
  const mounted = mountTrainer('events.roi', host, {}, ctx);
  const mode = host.querySelector('select')!;
  const field = (name: string) => host.querySelector<HTMLInputElement>(`[data-roi-field="${name}"]`)!;
  field('scans').value = '';
  mode.value = 'invited'; mode.dispatchEvent(new Event('change'));
  expect(field('scans').disabled).toBe(true);
  expect(field('target').parentElement!.hidden).toBe(true);
  expect(field('invited').disabled).toBe(false);
  for (const name of ['contacted','meeting','opportunity','winRate']) field(name).value = '1';
  field('invited').value = '2'; field('invited').dispatchEvent(new Event('change'));
  expect(host.textContent).toContain(language === 'ru' ? 'Уникальные целевые компании: 2' : 'Unique target companies: 2');
  expect(host.textContent).toContain('100%');
  for (const invalid of ['', '-1', '1.5', '100001']) {
    field('invited').value = invalid; field('invited').dispatchEvent(new Event('change'));
    expect(host.textContent).toContain(language === 'ru' ? 'число сканов или приглашённых компаний — целым' : 'integer scan or invited-company count');
  }
  mode.value = 'scans'; mode.dispatchEvent(new Event('change'));
  expect(field('invited').disabled).toBe(true);
  expect(field('scans').disabled).toBe(false);
  mounted.dispose();
});

it.each(['ru', 'en'] as const)('labels all CSV cards and exports main and card notes distinctly in %s', language => {
  setLang(language);
  const download = vi.spyOn(dom, 'downloadFile').mockImplementation(() => {});
  const host = document.createElement('div'); host.className = 'lesson-body';
  const task = document.createElement('div'); host.append(task);
  const mounted = mountTaskDocument(task, 'metrics.arr.task', 'ARR', 'Task');
  task.querySelector('textarea')!.value = 'MAIN';
  const cards = ['metrics-cohorts','metrics-pipeline','metrics-forecast','metrics-arr','metrics-arr-start','metrics-ab'].map(file => {
    const card = document.createElement('div'); host.append(card);
    const mount = mountTrainer('template', card, { file }, ctx);
    expect(card.querySelector('a')!.nextElementSibling!.textContent).toContain('UTF-8');
    expect(card.textContent).toContain(language === 'ru' ? '«Данные» → «Из текстового/CSV-файла»' : 'Data → From Text/CSV');
    expect(card.querySelector('label')!.textContent).toContain(language === 'ru' ? 'Расчёт по карточке:' : 'Card calculation:');
    card.querySelector('textarea')!.value = file;
    return mount;
  });
  expect(task.querySelector('label')!.textContent).toBe(language === 'ru' ? 'Основной документ' : 'Main document');
  task.querySelector('button')!.click();
  const content = download.mock.calls[0][1] as string;
  expect(content).toContain(language === 'ru' ? '# Основной документ\n\nMAIN' : '# Main document\n\nMAIN');
  expect(content.match(language === 'ru' ? /## Расчёт по карточке:/g : /## Card calculation:/g)).toHaveLength(6);
  expect(content).toContain('metrics-arr-start');
  cards.forEach(card => card.dispose()); mounted.dispose();
});

it.each(['ru', 'en'] as const)('names the document and example download in %s', language => {
  setLang(language);
  const host = document.createElement('div');
  const mounted = mountTaskDocument(host, 'aicontent.brief.task', 'Brief', 'Task');
  expect(host.querySelector('button')!.textContent).toBe(language === 'ru' ? 'Скачать документ и образец (.txt)' : 'Download document and example (.txt)');
  mounted.dispose();
});
