import { eventDepartment } from './events';
import type { ChatMessage, Lang } from '../../core/types';
import { companyGroups, validCompanyConfig } from '../../sims/companies';
import { legends } from './legends';
import { difficultyTexts, strings } from './strings';
import type { SimOptions, SimScenario } from './types';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function diceNumbers(seed: number): number[] {
  const next = mulberry32(seed);
  return Array.from({ length: 400 }, () => 1 + Math.floor(next() * 100));
}
export function diceTable(seed: number): string {
  const numbers = diceNumbers(seed);
  return Array.from({ length: 20 }, (_, row) => `R${String(row + 1).padStart(2, '0')}: ${numbers.slice(row * 20, row * 20 + 20).map(n => String(n).padStart(2, '0')).join(' ')}`).join('\n');
}
export function randomSeed(): number {
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
}
export function randomCompany(seed: number): Record<string, string> {
  const next = mulberry32(seed);
  return Object.fromEntries(companyGroups.map(g => [g.key, g.options[Math.floor(next() * g.options.length)].value]));
}
export function companyText(opts: SimOptions, lang: Lang): string {
  if (opts.companyMode === 'custom') {
    if (!validCompanyConfig(opts.companyConfig)) throw new Error('Invalid company configuration');
    return strings.customIntro.ru + '\n\n' + companyGroups.map(g => g.options.find(o => o.value === opts.companyConfig![g.key])!.text).join('\n\n');
  }
  const company = legends.find(l => l.id === opts.company);
  if (!company) throw new Error(`Unknown company: ${opts.company}`);
  return company.text[lang];
}
export function promptSize(prompt: string) { return { characters: prompt.length, tokens: Math.ceil(prompt.length / 3.5) }; }
export function compatibleCompany(scenario: SimScenario, opts: SimOptions): boolean {
  // This scenario has a fixed Incubating project; custom companies do not encode CNCF maturity.
  return scenario.id !== 'oss.incubation' || (opts.companyMode !== 'custom' && opts.company === 'lumenmesh');
}
export function buildPrompt(scenario: SimScenario, opts: SimOptions, lang: Lang): string {
  if (!compatibleCompany(scenario, opts)) throw new Error('Scenario requires the Incubating Lumenmesh legend');
  const values: Record<string, string> = {
    SEED: String(opts.seed >>> 0), DICE: diceTable(opts.seed), DIFFICULTY: difficultyTexts[opts.difficulty][lang],
    TURNS: String(opts.turns), TURN_UNIT: scenario.turnUnit[lang], COMPANY: companyText(opts, lang), WORLD: scenario.world ?? '', DEPARTMENT: scenario.id === 'events.kubecon' ? eventDepartment(opts) : scenario.department ?? '', LANG_RULES: strings.langRules[lang],
  };
  const prompt = scenario.prompt[lang].replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match);
  if (prompt.includes('{{')) throw new Error(`Unresolved prompt placeholder in ${scenario.id}`);
  return scenario.prompt[lang].includes('Таблица случайных чисел') ? prompt : `${prompt}\n\n${strings.diceRules[lang]}`;
}

/** Match complete fences only; ignore apparent fences nested inside other code. */
export function hasFence(text: string, info: 'state' | 'debrief'): boolean {
  let open: string | null = null;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (open !== null) {
      if (/^```\s*$/.test(line)) {
        if (open === info) return true;
        open = null;
      }
    } else {
      const match = /^```(\S*)\s*$/.exec(line);
      if (match) open = match[1];
    }
  }
  return false;
}

/** Preserve system instructions, the latest complete GM ledger, and a 12-message tail. */
export function trimHistory(messages: readonly ChatMessage[]): ChatMessage[] {
  const history = messages.filter(m => m.role !== 'system');
  let ledger = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant' && hasFence(history[i].content, 'state')) { ledger = i; break; }
  }
  const tail = Math.max(0, history.length - 12);
  return [...messages.filter(m => m.role === 'system'), ...history.filter((_, i) => i === ledger || i >= tail)];
}
