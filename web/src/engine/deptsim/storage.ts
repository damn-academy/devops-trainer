import type { SimGame, SimScenario } from './types';
import { validCompanyConfig } from '../../sims/companies';
import { legends } from './legends';

export const storageKey = (id: string): string => `dt.deptsim.${id}`;
export function saveGame(id: string, game: SimGame): void {
  try { localStorage.setItem(storageKey(id), JSON.stringify(game)); } catch { /* Storage is optional. */ }
}
export function loadGame(scenario: SimScenario): SimGame | null {
  try {
    const game = JSON.parse(localStorage.getItem(storageKey(scenario.id)) ?? 'null') as SimGame | null;
    if (!game || game.version !== 1 || (game.lang !== 'ru' && game.lang !== 'en') || typeof game.started !== 'boolean' || typeof game.prompt !== 'string') return null;
    const o = game.options;
    if (!o || !Number.isInteger(o.seed) || o.seed < 0 || o.seed > 0xffffffff || !Number.isInteger(o.turns) || o.turns < scenario.turns.min || o.turns > scenario.turns.max) return null;
    if (o.cncfStart !== undefined && o.cncfStart !== 'sandbox' && o.cncfStart !== 'incubating') return null;
    if (o.eventFormat !== undefined && o.eventFormat !== 'no-booth' && o.eventFormat !== 'booth') return null;
    if (o.companyMode !== undefined && o.companyMode !== 'preset' && o.companyMode !== 'custom') return null;
    if ((o.companyMode === 'custom' || o.companyConfig !== undefined) && !validCompanyConfig(o.companyConfig)) return null;
    if (!legends.some(l => l.id === o.company) || !['soft', 'like-life', 'hard'].includes(o.difficulty)) return null;
    if (!Array.isArray(game.messages) || !game.messages.every(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')) return null;
    if (game.messages.length && !game.started) return null;
    if (game.started && !game.prompt.trim()) return null;
    return game;
  } catch { return null; }
}
