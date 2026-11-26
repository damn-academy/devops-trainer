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
const NAMES = ['Nordvia', 'Kestrel Cloud', 'Arvelo', 'Tessmark', 'Lumora', 'Brightfold', 'Quillstack', 'Veltra', 'Orsana', 'Halvik'];
/** A fictional name for a company assembled from properties, so the host and the player can refer to it. */
export function companyName(seed: number): string {
  return NAMES[(seed >>> 0) % NAMES.length];
}
export function companyText(opts: SimOptions, lang: Lang): string {
  if (opts.companyMode === 'custom') {
    if (!validCompanyConfig(opts.companyConfig) || !consistentCompanyConfig(opts.companyConfig)) throw new Error('Invalid company configuration');
    return strings.customIntro.ru.replace('{name}', companyName(opts.seed)) + '\n\n' + companyGroups.map(g => g.options.find(o => o.value === opts.companyConfig![g.key])!.text).join('\n\n');
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
    ? scenario.prompt[lang].replace(/Бюджеты, размеры команды и показатели[^\n]+/, 'Если в карточке компании указаны числа мейнтейнеров, их организаций и пользователей, берите их; если нет, берите значения из описания отдела. Не пересчитывайте эти числа под стадию компании. Записывайте те же числа в блок state и в GOVERNANCE.')
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
    .replace(/Цель на этот срок[^\n]+/, 'Цель на этот срок — подготовить проект к будущей заявке на уровень Incubating. Сверяйтесь с шаблоном заявки на Incubating: задокументированное управление проектом, не зависящее от одной компании, и записанные решения; порядок, по которому люди становятся мейнтейнерами и перестают ими быть, с примерами; текущие места работы мейнтейнеров и достаточное для объёма проекта число активных мейнтейнеров; лестница участника, публичные каналы общения и активность вклада; архитектура, дорожная карта и процесс выпусков; порядок сообщения об уязвимостях, роли при ответе на них, контроль доступа, самооценка безопасности и базовый значок OpenSSF Best Practices (passing); не меньше трёх независимых пользователей (подходит и использование в разработке и тестах), публичный список пользователей и интеграций, проверка TOC и пять–семь кандидатов на интервью; техническая проверка, проверка управления и общая проверка проекта. Отделяйте обязательные свидетельства от рекомендованных. Внешний аудит безопасности и мейнтейнеры минимум из двух организаций на этой стадии не обязательны для принятия. Источник: https://github.com/cncf/toc/blob/main/.github/ISSUE_TEMPLATE/template-incubation-application.md')
    .replace('Готовность к аудиту безопасности от 0 до 100; аудит через фонд занимает несколько месяцев, и очередь на него есть.', 'Готовность самооценки безопасности от 0 до 100; отслеживайте политику безопасности и порядок сообщения об уязвимостях.')
    .replace('включая трек мейнтейнеров', 'с доступными проекту форматами')
    .replace('для проектов уровня Incubating', 'для проектов уровня Sandbox')
    .replace('критерии уровня Graduated', 'критерии уровня Incubating');
}
