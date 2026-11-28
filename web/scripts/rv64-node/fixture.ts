// Adapter test only: no kernel/guest/pod/browser execution.
import { atomicModule } from '../../src/engine/rv64/smp';
self.onmessage = ({ data }) => {
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
  const module = atomicModule(1);
  const instance = new WebAssembly.Instance(module, { env: { memory } });
  (instance.exports.store as (a: number, v: bigint) => void)(64, BigInt(data.value));
  self.postMessage({ value: Number((instance.exports.load as (a: number) => bigint)(64)), env: import.meta.env.VITE_RV64_SHARED_JIT });
};
