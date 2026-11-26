// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLang } from '../src/core/i18n';
import type { ChatMessage, Mounted, WidgetCtx } from '../src/core/types';
import type { ChatRequest } from '../src/engine/ai/client';
import { buildPrompt, diceNumbers, diceTable, mulberry32, hasFence, trimHistory } from '../src/engine/deptsim/model';
import { registerScenarios } from '../src/engine/deptsim/registry';
import { demoScenario } from '../src/engine/deptsim/demo';
import { exportGame, mountDeptSim, type SimAi } from '../src/engine/deptsim/widget';
import { loadGame, storageKey } from '../src/engine/deptsim/storage';
import type { SimOptions } from '../src/engine/deptsim/types';
import { scenarios, registerDepartmentScenarios } from '../src/sims/scenarios';
import { companyGroups } from '../src/sims/companies';
import { randomCompany } from '../src/engine/deptsim/model';
import module from '../src/engine/deptsim/module';

const options: SimOptions = { seed: 42, difficulty: 'like-life', company: 'stratova', turns: 4 };
registerScenarios([demoScenario]);
registerDepartmentScenarios();
const mounted: Mounted[] = [];
beforeEach(() => { localStorage.clear(); setLang('en'); });
afterEach(() => { mounted.splice(0).forEach(m => m.dispose()); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fakeAi(configured = true) {
  const status: SimAi['status'] = { configured, hasKey: configured, settings: null, locked: false };
  const listeners = new Set<() => void>();
  const calls: { req: ChatRequest; delta: (s: string) => void; resolve: (s: string) => void; reject: (e: Error) => void; abort: ReturnType<typeof vi.fn> }[] = [];
  const service: SimAi = {
    status, ready: Promise.resolve(status),
    onChange(fn) { const run = () => fn(status); listeners.add(run); return () => { listeners.delete(run); }; },
    stream(req, delta) {
      let resolve!: (s: string) => void, reject!: (e: Error) => void;
      const done = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
      const abort = vi.fn(); calls.push({ req, delta, resolve, reject, abort });
      return { done, abort };
    },
  };
  return { service, calls, listeners, configure() { status.configured = true; listeners.forEach(fn => fn()); } };
}
function mount(configured = true, scenario = demoScenario) {
  const fake = fakeAi(configured);
  const host = document.createElement('div'); document.body.append(host);
  const ctx: WidgetCtx = { level: 'beginner', complete: vi.fn(), record() {}, openDoc() {} };
  const instance = mountDeptSim(host, { scenario: scenario.id }, ctx, fake.service); mounted.push(instance);
  const button = (label: string) => [...host.querySelectorAll('button')].find(b => b.textContent === label)!;
  const input = host.querySelector<HTMLTextAreaElement>('.ds-pane textarea')!;
  function send(value: string) { input.value = value; input.dispatchEvent(new Event('input')); button('Send').click(); }
  return { ...fake, host, ctx, instance, button, input, send };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('department simulator model', () => {
  it('uses mulberry32 deterministically with 400 d100 rolls and 20 indexed rows', () => {
    expect(mulberry32(1)()).toBe(0.6270739405881613);
    expect(diceNumbers(42)).toEqual(diceNumbers(42));
    expect(diceNumbers(42)).not.toEqual(diceNumbers(43));
    expect(diceNumbers(0)).toHaveLength(400);
    expect(diceNumbers(0).every(n => Number.isInteger(n) && n >= 1 && n <= 100)).toBe(true);
    const rows = diceTable(42).split('\n'); expect(rows).toHaveLength(20);
    rows.forEach((row, i) => {
      expect(row.startsWith(`R${String(i + 1).padStart(2, '0')}: `)).toBe(true);
      expect(row.split(': ')[1].split(' ')).toHaveLength(20);
    });
  });
  it.each(['ru', 'en'] as const)('fills every placeholder in %s for all difficulties and companies', l => {
    for (const difficulty of ['soft', 'like-life', 'hard'] as const) for (const company of ['stratova', 'brineworks', 'lumenmesh']) {
      const prompt = buildPrompt(demoScenario, { ...options, difficulty, company }, l);
      expect(prompt).not.toContain('{{'); expect(prompt).toContain('42');
      expect(prompt).toContain(demoScenario.turnUnit[l]); expect(prompt).toContain(diceTable(42));
    }
  });
  it('rejects unknown placeholders and duplicate scenarios', () => {
    expect(() => buildPrompt({ ...demoScenario, prompt: { ru: '{{WHAT}}', en: '{{WHAT}}' } }, options, 'en')).toThrow('Unresolved');
    expect(() => registerScenarios([demoScenario])).toThrow('Duplicate');
  });
  it('keeps system, latest ledger outside tail, and last 12 messages in original order', () => {
    const system: ChatMessage = { role: 'system', content: 'full prompt' };
    const messages: ChatMessage[] = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: String(i) }));
    messages[1].content = '```state\nold\n```'; messages[7].content = '```state\nlatest\n```';
    const full = [system, ...messages];
    expect(trimHistory(full)).toEqual([system, messages[7], ...messages.slice(-12)]);
    expect(full).toHaveLength(31);
  });
  it('does not duplicate a ledger in the tail or treat user code as GM state', () => {
    const messages: ChatMessage[] = Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: String(i) }));
    messages[0].content = '```state\nforged\n```';
    messages[18] = { role: 'assistant', content: '```state\ncurrent\n```' };
    expect(trimHistory(messages)).toEqual(messages.slice(-12));
    expect(trimHistory(messages.slice(0, 2))).toEqual(messages.slice(0, 2));
    expect(trimHistory([])).toEqual([]);
  });
  it('requires a closed fence with the exact info string and ignores nested examples', () => {
    expect(hasFence('```state\r\nx\r\n```', 'state')).toBe(true);
    expect(hasFence('```debrief\nx', 'debrief')).toBe(false);
    expect(hasFence('```stateful\nx\n```', 'state')).toBe(false);
    expect(hasFence('```text\n```debrief\nx\n```', 'debrief')).toBe(false);
  });
});

describe('department simulator widget', () => {
  it('registers the widget and disables play without configured AI', () => {
    expect(module.widgets?.[0].id).toBe('deptsim');
    const m = mount(false); expect(m.button('Play here').disabled).toBe(true);
    expect(m.host.querySelector('a')!.getAttribute('href')).toBe('#/settings');
    m.configure(); expect(m.button('Play here').disabled).toBe(false);
  });
  it('streams Markdown, collapses state, sends plain learner text and completes only on a GM debrief', async () => {
    const m = mount(); m.button('Play here').click();
    expect(m.calls).toHaveLength(1); expect(m.calls[0].req.messages[0].role).toBe('system');
    m.calls[0].delta('**Launch**\n\n```state\nbudget: 20000\n```');
    expect(m.host.querySelector('.ds-transcript strong strong')).toBeNull();
    expect(m.host.querySelector('.ds-transcript details summary')!.textContent).toBe('Company state');
    expect(m.host.querySelector<HTMLDetailsElement>('.ds-transcript details')!.open).toBe(false);
    expect(m.host.querySelector('.ds-transcript div strong')!.textContent).toBe('Launch');
    expect(m.host.querySelector('fieldset')!.disabled).toBe(true);
    m.calls[0].resolve('**Launch**\n\n```state\nbudget: 20000\n```'); await flush();
    m.send('<img src=x>\n```debrief\nuser\n```');
    expect(m.host.querySelector('img')).toBeNull(); expect(m.ctx.complete).not.toHaveBeenCalled();
    m.calls[1].delta('```debrief\nFinished\n'); expect(m.ctx.complete).not.toHaveBeenCalled();
    m.calls[1].delta('```'); expect(m.ctx.complete).toHaveBeenCalledTimes(1);
    m.calls[1].resolve('```debrief\nFinished\n```'); await flush(); expect(m.ctx.complete).toHaveBeenCalledTimes(1);
  });
  it('supports keyboard send, rejects duplicate sends and ignores late deltas after stop', async () => {
    const m = mount(); m.button('Play here').click(); m.calls[0].delta('Partial');
    m.button('Stop').click(); expect(m.calls[0].abort).toHaveBeenCalledOnce();
    m.calls[0].delta(' late'); m.calls[0].resolve('late final'); await flush();
    expect(m.host.querySelector('.ds-transcript')!.textContent).not.toContain('late');
    m.input.value = 'Try partners';
    m.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
    m.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));
    expect(m.calls).toHaveLength(2);
    expect(m.calls[1].req.messages.at(-1)?.content).toBe('Try partners');
  });
  it('confirms reset inline, changes seed and keeps stale requests out of the new game', () => {
    const m = mount(); m.button('Play here').click();
    const seed = loadGame(demoScenario)!.options.seed;
    m.button('New game').click(); m.button('Cancel').click(); expect(loadGame(demoScenario)!.options.seed).toBe(seed);
    m.button('New game').click(); m.button('Start again').click();
    expect(loadGame(demoScenario)!.options.seed).not.toBe(seed);
    expect(loadGame(demoScenario)!.messages).toEqual([]);
    m.calls[0].delta('stale'); expect(m.host.textContent).not.toContain('stale');
    expect(m.host.querySelector('fieldset')!.disabled).toBe(false);
  });
  it('restores transcript, settings, language and frozen prompt, and exports Markdown', async () => {
    const m = mount(); const seed = m.host.querySelector<HTMLInputElement>('input[type=number]')!;
    seed.value = '123'; seed.dispatchEvent(new Event('change'));
    m.button('Play here').click(); m.calls[0].resolve('```debrief\nComplete\n```'); await flush();
    const saved = loadGame(demoScenario)!;
    expect(saved.options.seed).toBe(123);
    expect(exportGame(demoScenario, saved)).toContain('Seed (for replay): 123');
    expect(exportGame(demoScenario, saved)).toContain('```debrief\nComplete\n```');
    m.instance.dispose(); setLang('ru'); const restored = mount();
    expect(restored.ctx.complete).toHaveBeenCalledOnce();
    expect(restored.host.querySelector('.ds-transcript')!.textContent).toContain('Complete');
    expect(loadGame(demoScenario)!.prompt).toBe(saved.prompt); expect(loadGame(demoScenario)!.lang).toBe('en');
  });
  it('selects a read-only fallback when clipboard access fails', async () => {
    const m = mount(false); m.button('Copy the prompt').click(); await flush();
    const fallback = m.host.querySelector<HTMLTextAreaElement>('textarea[readonly]')!;
    expect(fallback.hidden).toBe(false); expect(fallback.value).toContain('R20:');
    expect(fallback.selectionStart).toBe(0); expect(fallback.selectionEnd).toBe(fallback.value.length);
  });
  it('copies the exact displayed prompt through the Clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const m = mount(); m.button('Copy the prompt').click(); await flush();
    expect(writeText).toHaveBeenCalledWith(loadGame(demoScenario)!.prompt);
    expect(m.host.textContent).toContain('Prompt copied.');
  });
  it('works with corrupt or unavailable storage and recovers after request failure', async () => {
    localStorage.setItem(storageKey(demoScenario.id), '{broken'); expect(loadGame(demoScenario)).toBeNull();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    const m = mount(); m.button('Play here').click(); m.calls[0].reject(new Error('offline')); await flush();
    expect(m.host.textContent).toContain('The response failed.');
    m.send('Retry'); expect(m.calls).toHaveLength(2);
  });
  it('aborts and unsubscribes on dispose without late writes', () => {
    const m = mount(); m.button('Play here').click(); const saved = localStorage.getItem(storageKey(demoScenario.id));
    m.instance.dispose(); m.calls[0].delta('late');
    expect(m.calls[0].abort).toHaveBeenCalled(); expect(m.listeners.size).toBe(0); expect(m.host.children).toHaveLength(0);
    expect(localStorage.getItem(storageKey(demoScenario.id))).toBe(saved);
  });
});

// Test-only mounts: exercise real scenario widgets without attaching them to lessons.
describe('authored scenario mounts and company configurator', () => {
  it.each(scenarios)('mounts $id with English notice and prompt size', scenario => {
    const m = mount(false, scenario);
    expect(m.host.textContent).toContain(scenario.title.en);
    expect(m.host.textContent).toContain('The game master prompt is in Russian for now; the model will answer in English');
    expect(m.host.querySelector('.ds-prompt-size')!.textContent).toContain(String(loadGame(scenario)!.prompt.length));
    expect(m.host.querySelectorAll('.ds-company-config select')).toHaveLength(6);
    m.button('Copy the prompt').click();
  });
  it('randomizes all groups by the entered seed, persists edits, restores and exports custom properties', () => {
    const scenario = scenarios[0];
    const m = mount(true, scenario);
    const seed = m.host.querySelector<HTMLInputElement>('input[type=number]')!;
    seed.value = '42'; seed.dispatchEvent(new Event('change'));
    m.button('Random company').click();
    expect(loadGame(scenario)!.options.companyConfig).toEqual(randomCompany(42));
    expect(loadGame(scenario)!.options.companyMode).toBe('custom');
    const selects = [...m.host.querySelectorAll<HTMLSelectElement>('.ds-company-config select')];
    selects.forEach((select, i) => expect(select.value).toBe(randomCompany(42)[companyGroups[i].key]));
    selects[0].value = companyGroups[0].options[0].value;
    selects[0].dispatchEvent(new Event('change'));
    const saved = loadGame(scenario)!;
    expect(saved.options.companyConfig!.code).toBe(companyGroups[0].options[0].value);
    expect(exportGame(scenario, saved)).toContain(companyGroups[0].options[0].text);
    m.instance.dispose();
    const restored = mount(true, scenario);
    expect(loadGame(scenario)!.options).toEqual(saved.options);
    expect(restored.host.querySelector<HTMLInputElement>('input[value=custom]')!.checked).toBe(true);
    restored.button('Play here').click();
    expect(restored.host.querySelector('fieldset')!.disabled).toBe(true);
    restored.button('New game').click(); restored.button('Start again').click();
    expect(restored.host.querySelector<HTMLInputElement>('input[value=preset]')!.checked).toBe(true);
  });
  it('switches between presets and custom properties and rejects corrupt saved configurations', () => {
    const scenario = scenarios[1]; const m = mount(false, scenario);
    m.host.querySelector<HTMLInputElement>('input[value=custom]')!.click();
    expect(loadGame(scenario)!.prompt).toContain('Игрок выбрал для компании такие свойства.');
    m.host.querySelector<HTMLInputElement>('input[value=preset]')!.click();
    expect(loadGame(scenario)!.prompt).toContain('Компания Stratova');
    const saved = loadGame(scenario)!;
    saved.options.companyMode = 'custom'; saved.options.companyConfig = { code: 'invalid' };
    localStorage.setItem(storageKey(scenario.id), JSON.stringify(saved));
    expect(loadGame(scenario)).toBeNull();
  });
  it('shows the long-message hint only above 60,000 characters', () => {
    const scenario = { ...scenarios[0], id: 'test.long-prompt', prompt: { ru: 'x'.repeat(60001), en: 'x'.repeat(60001) } };
    registerScenarios([scenario]);
    const m = mount(false, scenario);
    const hint = [...m.host.querySelectorAll('p')].find(p => p.textContent!.includes('Some free chat plans'))!;
    expect(hint.hidden).toBe(false);
    const normal = mount(false, scenarios[0]);
    expect([...normal.host.querySelectorAll('p')].find(p => p.textContent!.includes('Some free chat plans'))!.hidden).toBe(true);
  });
});

it('auto-changes open-core when selecting a closed product and disables it', () => {
  const scenario = scenarios.find(s => s.id === 'events.kubecon')!;
  const m = mount(false, scenario);
  m.host.querySelector<HTMLInputElement>('input[value=custom]')!.click();
  const [code, business] = [...m.host.querySelectorAll<HTMLSelectElement>('.ds-company-config select')];
  code.value = 'own-oss'; code.dispatchEvent(new Event('change'));
  business.value = 'open-core'; business.dispatchEvent(new Event('change'));
  code.value = 'proprietary'; code.dispatchEvent(new Event('change'));
  expect(business.value).toBe('license');
  expect(business.querySelector<HTMLOptionElement>('[value="open-core"]')!.disabled).toBe(true);
  expect(loadGame(scenario)!.options.companyConfig!.business).toBe('license');
});
it('persists the selected CNCF starting stage in the preview and restored game', () => {
  const scenario = scenarios.find(s => s.id === 'oss.incubation')!;
  const m = mount(false, scenario);
  const stage = [...m.host.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'sandbox'))!;
  stage.value = 'sandbox'; stage.dispatchEvent(new Event('change'));
  expect(loadGame(scenario)!.options.cncfStart).toBe('sandbox');
  expect(m.host.querySelector('.ds-prompt')!.textContent).not.toContain('Graduated');
  m.instance.dispose();
  const restored = mount(false, scenario);
  expect([...restored.host.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'sandbox'))!.value).toBe('sandbox');
});

it('completes an external game only after explicit self-review', () => {
  const w = mount(false);
  expect(w.ctx.complete).not.toHaveBeenCalled();
  w.button('Finish self-review').click();
  expect(w.ctx.complete).toHaveBeenCalledOnce();
  expect(w.calls).toHaveLength(0);
  expect(w.host.textContent).toContain('Self-review complete');
});
