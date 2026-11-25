import type { SimScenario } from './types';
const scenarios = new Map<string, SimScenario>();
export function registerScenarios(list: readonly SimScenario[]): void {
  const ids = new Set<string>();
  for (const scenario of list) {
    if (ids.has(scenario.id) || scenarios.has(scenario.id)) throw new Error(`Duplicate department scenario: ${scenario.id}`);
    const { min, max, default: initial } = scenario.turns;
    if (![min, max, initial].every(Number.isInteger) || min < 1 || min > initial || initial > max) throw new Error(`Invalid turn bounds: ${scenario.id}`);
    ids.add(scenario.id);
  }
  for (const scenario of list) scenarios.set(scenario.id, scenario);
}
export function getScenario(id: string): SimScenario | undefined { return scenarios.get(id); }
