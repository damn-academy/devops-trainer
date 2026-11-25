// Imported explicitly by tests only; never registered with a lesson or engine module.
import type { SimScenario } from './types';
import { strings as s } from './strings';
export const demoScenario: SimScenario = {
  id: 'demo.deptsim', dept: 'marketing', title: s.demoTitle, premise: s.demoPremise,
  turns: { min: 2, max: 12, default: 4 }, turnUnit: s.demoUnit, prompt: s.demoPrompt,
};
