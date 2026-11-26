import { eventDepartment } from './events';
import type { ChatMessage, Lang } from '../../core/types';
import { companyGroups, validCompanyConfig, normalizeCompanyConfig, consistentCompanyConfig } from '../../sims/companies';
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
  return normalizeCompanyConfig(Object.fromEntries(companyGroups.map(g => [g.key, g.options[Math.floor(next() * g.options.length)].value])));
}
export function companyText(opts: SimOptions, lang: Lang): string {
  if (opts.companyMode === 'custom') {
    if (!validCompanyConfig(opts.companyConfig) || !consistentCompanyConfig(opts.companyConfig)) throw new Error('Invalid company configuration');
    return strings.customIntro.ru + '\n\n' + companyGroups.map(g => g.options.find(o => o.value === opts.companyConfig![g.key])!.text).join('\n\n');
  }
  const company = legends.find(l => l.id === opts.company);
  if (!company) throw new Error(`Unknown company: ${opts.company}`);
  return opts.cncfStart === 'sandbox' ? company.text[lang].replace('на уровне Incubating', 'на уровне Sandbox') : company.text[lang];
}
export function promptSize(prompt: string) { return { characters: prompt.length, tokens: Math.ceil(prompt.length / 3.5) }; }
export function compatibleCompany(scenario: SimScenario, opts: SimOptions): boolean {
  if (opts.companyMode === 'custom' && (!validCompanyConfig(opts.companyConfig) || !consistentCompanyConfig(opts.companyConfig))) return false;
  // This scenario has a fixed Incubating project; custom companies do not encode CNCF maturity.
  return scenario.id !== 'oss.incubation' || (opts.companyMode !== 'custom' && opts.company === 'lumenmesh');
}
export function buildPrompt(scenario: SimScenario, opts: SimOptions, lang: Lang): string {
  if (!compatibleCompany(scenario, opts)) throw new Error('Scenario requires the Incubating Lumenmesh legend');
  const values: Record<string, string> = {
    SEED: String(opts.seed >>> 0), DICE: diceTable(opts.seed), DIFFICULTY: difficultyTexts[opts.difficulty][lang],
    TURNS: String(opts.turns), TURN_UNIT: scenario.turnUnit[lang], COMPANY: companyText(opts, lang), WORLD: scenario.world ?? '', DEPARTMENT: scenario.id === 'events.kubecon' ? eventDepartment(opts) : scenario.id === 'oss.incubation' ? incubationDepartment(scenario.department ?? '', opts) : scenario.department ?? '', LANG_RULES: strings.langRules[lang],
  };
  const source = scenario.id === 'oss.incubation'
    ? scenario.prompt[lang].replace(/Бюджеты, размеры команды и показатели[^\n]+/, 'Use the company card counts whenever present; otherwise use the department defaults. Never rescale maintainer counts, affiliations or adopter counts for company stage. Record the same counts in state and GOVERNANCE.')
    : scenario.prompt[lang];
  const prompt = source.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match);
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

/** Stage-specific targets; do not relabel graduation criteria as incubation criteria. */
export function incubationDepartment(department: string, opts: SimOptions): string {
  if (opts.cncfStart !== 'sandbox') return department;
  return department
    .replace('Проект недавно перешёл с уровня Sandbox на уровень Incubating.', 'Проект находится на уровне Sandbox.')
    .replace(/Цель на этот срок[^\n]+/, 'Цель на этот срок — подготовить проект к будущей заявке на уровень Incubating. Follow the Incubation application template: documented vendor-neutral governance and decisions, maintainer lifecycle with demonstrated use, current affiliations and sufficient active maintainers for project scope; contributor ladder, public communications and contribution activity; architecture, roadmap and release process; security reporting, response roles, access controls, self-assessment and OpenSSF Best Practices passing badge; at least three independent adopters (dev/test use qualifies), public adopters and integrations, TOC verification and five to seven interview candidates; technical and governance reviews and due diligence. Separate required from suggested evidence. An external security audit and a minimum of two maintainer organisations are not admission requirements for this stage. Source: https://github.com/cncf/toc/blob/main/.github/ISSUE_TEMPLATE/template-incubation-application.md')
    .replace('Готовность к аудиту безопасности от 0 до 100; аудит через фонд занимает несколько месяцев, и очередь на него есть.', 'Security self-assessment readiness from 0 to 100; track security policy and vulnerability reporting.')
    .replace('включая трек мейнтейнеров', 'с доступными проекту форматами')
    .replace('для проектов уровня Incubating', 'для проектов уровня Sandbox')
    .replace('критерии уровня Graduated', 'критерии уровня Incubating');
}
