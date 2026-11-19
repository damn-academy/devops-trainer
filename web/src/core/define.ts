// Identity helpers that give content files type checking without importing
// any runtime code of the platform.

import type { BlockModule, ProcessModel } from './types';

/** Wrap the default export of a block or engine module. */
export function defineModule(m: BlockModule): BlockModule {
  return m;
}

/** Type a process model (the parameter object stays precise inside run/explainDelta). */
export function defineModel<P extends Record<string, unknown>>(m: ProcessModel<P>): ProcessModel<P> {
  return m;
}
