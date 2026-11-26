// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { setLang } from '../src/core/i18n';
import { mountTaskDocument } from '../src/engine/trainers/document';
import { documentTemplate } from '../src/engine/trainers/document-fields';
import { buildPrompt, compatibleCompany, randomCompany } from '../src/engine/deptsim/model';
import { companyGroups, defaultCompanyConfig, consistentCompanyConfig } from '../src/sims/companies';
import { scenarios } from '../src/sims/scenarios';
import { health, governance, governanceMarkdown } from '../src/engine/trainers/oss';
import * as dom from '../src/core/dom';
afterEach(() => { document.body.replaceChildren(); localStorage.clear(); setLang('ru'); vi.restoreAllMocks(); });
it('downloads live notes under headings from all cards in this lesson only', () => {
  const download = vi.spyOn(dom, 'downloadFile').mockImplementation(() => {});
  document.body.innerHTML = '<div class="lesson-body"><div id="task"></div><textarea data-template-id="a" data-template-title="Starting ARR"></textarea><textarea data-template-id="b" data-template-title="Movements"></textarea></div><textarea data-template-id="other">Do not export</textarea>';
  const host = document.querySelector<HTMLElement>('#task')!;
  mountTaskDocument(host, 'metrics.arr.task', 'ARR', 'Task');
  host.querySelector('textarea')!.value = 'Main notes';
  document.querySelector<HTMLTextAreaElement>('[data-template-id=a]')!.value = 'Opening 100';
  document.querySelector<HTMLTextAreaElement>('[data-template-id=b]')!.value = 'Closing 118';
  host.querySelector('button')!.click();
  expect(download.mock.calls[0][1]).toBe('# Основной документ\n\nMain notes\n\n## Starting ARR\n\nOpening 100\n\n## Movements\n\nClosing 118');
});
it.each(['ru','en'] as const)('exports all six rights authorities in %s', lang => {
  setLang(lang);
  const text = documentTemplate('oss.donation.task', '', '');
  for (const heading of lang === 'ru' ? ['Владеет до','Владеет после','Администрирует до','Администрирует после','Решает до','Решает после'] : ['Owns before','Owns after','Administers before','Administers after','Decides before','Decides after']) expect(text).toContain(heading);
});
it('checks every code/revenue combination for every department', () => {
  for (const scenario of scenarios) for (const code of companyGroups[0].options) for (const business of companyGroups[1].options) {
    const opts = { seed: 1, company: 'lumenmesh', companyMode: 'custom' as const, companyConfig: { ...defaultCompanyConfig(), code: code.value, business: business.value }, difficulty: 'like-life' as const, turns: scenario.turns.default };
    const valid = scenario.id !== 'oss.incubation' && !(code.value === 'proprietary' && business.value === 'open-core');
    expect(compatibleCompany(scenario, opts)).toBe(valid);
    if (!valid) expect(() => buildPrompt(scenario, opts, 'ru')).toThrow();
    else expect(buildPrompt(scenario, opts, 'ru')).not.toContain('делает открытый инфраструктурный продукт');
  }
  for(let seed=0;seed<100;seed++) expect(consistentCompanyConfig(randomCompany(seed))).toBe(true);
  const events = scenarios.find(s => s.id === 'events.kubecon')!;
  const prompt = buildPrompt(events, { seed: 1, company: 'lumenmesh', companyMode: 'custom', companyConfig: defaultCompanyConfig(), difficulty: 'like-life', turns: 12 }, 'ru');
  expect(prompt).not.toContain('Компания продаёт корпоративную версию с функциями, которых нет в открытой');
});
it('keeps the 12 maintainers and selected CNCF transition consistent', () => {
  const scenario = scenarios.find(s => s.id === 'oss.incubation')!;
  for (const cncfStart of ['sandbox','incubating'] as const) {
    const prompt = buildPrompt(scenario, { seed: 1, company: 'lumenmesh', difficulty: 'like-life', turns: 12, cncfStart }, 'ru');
    expect(prompt).toContain('Lumenmesh — 9, банк-пользователь — 2, независимый — 1; всего 12');
    expect(prompt).toContain(`на уровне ${cncfStart === 'sandbox' ? 'Sandbox' : 'Incubating'}`);
    expect(prompt).toContain(`заявке на уровень ${cncfStart === 'sandbox' ? 'Incubating' : 'Graduated'}`);
    if (cncfStart === 'sandbox') expect(prompt).not.toContain('Graduated');
  }
  expect(governanceMarkdown(governance, Object.fromEntries(governance.groups.map(g => [g.name, 'A'])))).toContain('девять из компании Lumenmesh, двое из банка-пользователя, один независимый');
});
it('supplies raw observations that reproduce the worked response-time statistics', () => {
  const times = [...health.metrics.join('\n').matchAll(/R\d+=(\d+)/g)].map(m => Number(m[1])).sort((a,b) => a-b);
  expect(times).toHaveLength(51); expect(times[25]).toBe(6); expect(times[Math.ceil(.9*times.length)-1]).toBe(21);
  expect(health.metrics.join('\n').match(/R\d+ \(/g)).toHaveLength(9);
  expect(health.questions[1].question).toContain('по ревью');
  expect(health.metrics.join('\n')).toContain('100 человек');
  expect(health.questions[2].answer).toContain('89,6 %');
});
