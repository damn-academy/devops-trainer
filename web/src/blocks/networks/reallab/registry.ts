// Every network lab the widget `net.reallab` can start, by id: the lesson
// labs and the machines of the in-browser exam.

import { examLab } from './exam-lab';
import { LABS } from './labs';
import type { NetLabSpec } from './spec';

const ALL: Record<string, NetLabSpec> = { ...LABS, [examLab.id]: examLab };

export function labSpec(id: string): NetLabSpec | undefined {
  return ALL[id];
}

export function allLabs(): NetLabSpec[] {
  return Object.values(ALL);
}
