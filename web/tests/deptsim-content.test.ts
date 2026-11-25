import { describe, expect, it } from 'vitest';
import { companyGroups, companyLegends, defaultCompanyConfig } from '../src/sims/companies';
import { parseCompanyConfig, parseLegends } from '../src/sims/parser';
import configSource from '../src/sims/company-config.ru.md?raw';
import legendSource from '../src/sims/legends.ru.md?raw';
import core from '../src/sims/core.ru.md?raw';
import world from '../src/sims/world.ru.md?raw';
import languageRules from '../src/sims/lang-rules.ru.md?raw';
import { scenarios, registerDepartmentScenarios } from '../src/sims/scenarios';
import { getScenario } from '../src/engine/deptsim/registry';
import { buildPrompt, compatibleCompany, companyText, diceTable, mulberry32, promptSize, randomCompany } from '../src/engine/deptsim/model';
import { strings } from '../src/engine/deptsim/strings';

const options = { seed: 42, company: 'stratova', difficulty: 'like-life' as const, turns: 6 };
describe('Markdown company content', () => {
  it('extracts all six groups, labels and all 27 nonempty options from raw Markdown', () => {
    expect(companyGroups.map(g => g.key)).toEqual(['code', 'business', 'kind', 'stage', 'home', 'segment']);
    expect(companyGroups.flatMap(g => g.options)).toHaveLength(27);
    for (const group of companyGroups) {
      expect(configSource).toContain(`group: ${group.key} | ${group.label} -->`);
      for (const option of group.options) {
        expect(configSource).toContain(`opt: ${option.value} | ${option.label} -->`);
        expect(option.text.trim()).not.toBe('');
        expect(option.text).not.toContain('<!--');
      }
    }
  });
  it('extracts three named presets without changing their prose', () => {
    expect(companyLegends.map(l => l.label)).toEqual(['Stratova', 'Brineworks', 'Lumenmesh']);
    for (const legend of companyLegends) expect(legendSource).toContain(legend.text);
  });
  it('rejects malformed, duplicate and empty blocks', () => {
    expect(() => parseCompanyConfig('<!-- opt: x | X -->\ntext')).toThrow();
    expect(() => parseCompanyConfig('<!-- group: x | X -->')).toThrow();
    expect(() => parseCompanyConfig('<!-- group: x | X -->\n<!-- opt: x | X -->')).toThrow();
    expect(() => parseCompanyConfig(configSource + configSource)).toThrow();
    expect(() => parseLegends(legendSource + legendSource)).toThrow();
    expect(() => parseLegends('<!-- legend: empty -->')).toThrow();
  });
  it('reproduces random selections from the game PRNG without consuming dice state', () => {
    const next = mulberry32(42);
    const expected = Object.fromEntries(companyGroups.map(g => [g.key, g.options[Math.floor(next() * g.options.length)].value]));
    const before = diceTable(42);
    expect(randomCompany(42)).toEqual(expected);
    expect(randomCompany(42)).toEqual(randomCompany(42));
    expect(randomCompany(43)).not.toEqual(randomCompany(42));
    expect(diceTable(42)).toBe(before);
  });
  it('assembles custom properties as paragraphs in file order', () => {
    expect(companyText({ ...options, companyMode: 'custom', companyConfig: defaultCompanyConfig() }, 'en'))
      .toBe('Игрок выбрал для компании такие свойства.\n\n' + companyGroups.map(g => g.options[0].text).join('\n\n'));
  });
});
describe('department content assembly', () => {
  it('registers all seven scenarios explicitly with the requested turn ranges', () => {
    registerDepartmentScenarios();
    expect(scenarios.map(s => [s.id, s.turns.min, s.turns.max, s.turns.default])).toEqual([
      ['marketing.quarter', 6, 8, 6], ['marketing.blog', 8, 12, 12], ['pr.crisis', 6, 12, 10],
      ['product.quarter', 4, 8, 6], ['sales.dream100', 12, 26, 16], ['events.kubecon', 10, 14, 12], ['oss.incubation', 6, 12, 12],
    ]);
    for (const scenario of scenarios) {
      expect(getScenario(scenario.id)).toBe(scenario);
      expect(scenario.department!.startsWith(scenario.premise.ru)).toBe(true);
      expect(scenario.premise.ru.match(/[.!?]/g)).toHaveLength(2);
    }
  });
  for (const scenario of scenarios) for (const lang of ['ru', 'en'] as const) for (const mode of ['preset', 'custom'] as const) {
    it(`${scenario.id}: ${lang}, ${mode} resolves every placeholder and includes each source once`, () => {
      for (const company of companyLegends) {
        const opts = { ...options, company: company.id, turns: scenario.turns.default, companyMode: mode, companyConfig: randomCompany(42) };
        if (!compatibleCompany(scenario, opts)) { expect(() => buildPrompt(scenario, opts, lang)).toThrow('Incubating'); continue; }
        const prompt = buildPrompt(scenario, opts, lang);
        if (scenario.id === 'oss.incubation') expect(company.text).toContain('на уровне Incubating');
        expect(prompt).not.toContain('{{');
        expect(prompt).toContain(world);
        if (scenario.id === 'events.kubecon') expect(prompt).toContain('Participation format: no booth');
        else expect(prompt).toContain(scenario.department);
        expect(prompt).toContain(lang === 'ru' ? languageRules : strings.langRules.en);
        expect(prompt.split('Таблица случайных чисел')).toHaveLength(2);
        expect(prompt).not.toContain(strings.diceRules[lang]);
        expect(prompt).toContain(diceTable(42));
        expect(scenario.prompt[lang]).toBe(core);
      }
    });
  }
  it('measures characters and rounds approximate token counts up', () => {
    expect(promptSize('текст')).toEqual({ characters: 5, tokens: 2 });
  });
});
