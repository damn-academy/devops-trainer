import { strings as s } from './strings';

/** TODO(prose): Replace these three placeholder company legends. */
export const legends = [
  { id: 'startup', title: s.startupTitle, text: s.startupText },
  { id: 'growth', title: s.growthTitle, text: s.growthText },
  { id: 'established', title: s.establishedTitle, text: s.establishedText },
] as const;
