import legendSource from './legends.ru.md?raw';
import configSource from './company-config.ru.md?raw';
import { parseLegends, parseCompanyConfig } from './parser';
export const companyLegends = parseLegends(legendSource);
export const companyGroups = parseCompanyConfig(configSource);
export const defaultCompanyConfig = (): Record<string, string> => Object.fromEntries(companyGroups.map(g => [g.key, g.options[0].value]));
export function validCompanyConfig(value: unknown): value is Record<string, string> {
  return !!value && typeof value === 'object' && companyGroups.every(g => g.options.some(o => o.value === (value as Record<string, unknown>)[g.key]));
}
