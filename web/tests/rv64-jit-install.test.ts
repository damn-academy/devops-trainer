import { expect, it } from 'vitest';
import { compileBatch } from '../src/engine/rv64/jit-compiler';
it('installs through table.init', () => {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const table = new WebAssembly.Table({ initial: 3, element: 'anyfunc' });
  const blocks = [{ id: 1, pc: 0n, words: [0x13, 4] }, { id: 2, pc: 4n, words: [0x13, 4] }];
  const i = new WebAssembly.Instance(new WebAssembly.Module(compileBatch(blocks, false, undefined, undefined, true)), { env: { memory, table } });
  expect(Object.keys(i.exports)).toEqual(['install']);
  table.grow(2); (i.exports.install as Function)(3);
  expect(table.get(3)).not.toBeNull(); expect(table.get(4)).not.toBeNull();
  (table.get(4) as Function)(0, 256);
});
