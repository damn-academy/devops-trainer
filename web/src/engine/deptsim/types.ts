import type { Bi, Lang, ChatMessage } from '../../core/types';

export interface SimScenario {
  id: string;
  dept: 'marketing' | 'pr' | 'product' | 'sales' | 'mixed';
  title: Bi;
  premise: Bi;
  turns: { min: number; max: number; default: number };
  turnUnit: Bi;
  prompt: { ru: string; en: string };
  world?: string;
  department?: string;
  russianPrompt?: boolean;
}
export type Difficulty = 'soft' | 'like-life' | 'hard';
export interface SimOptions {
  cncfStart?: 'sandbox' | 'incubating';
  eventFormat?: 'no-booth' | 'booth';
  seed: number;
  company: string;
  companyMode?: 'preset' | 'custom';
  companyConfig?: Record<string, string>;
  difficulty: Difficulty;
  turns: number;
}
export interface SimGame {
  version: 1;
  options: SimOptions;
  lang: Lang;
  /** Snapshot protects resumed games from later edits to scenario prose. */
  prompt: string;
  messages: ChatMessage[];
  started: boolean;
}
