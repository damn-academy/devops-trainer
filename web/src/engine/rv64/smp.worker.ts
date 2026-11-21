// R3 substrate gate only: this Worker does not execute a RISC-V Cpu yet.
import { SharedHartMemory } from './smp';
self.onmessage = ({ data }: MessageEvent<{ memory: WebAssembly.Memory; module: WebAssembly.Module; barrier: SharedArrayBuffer; harts: number }>) => {
  try {
    const ram = new SharedHartMemory(data.memory, data.module);
    const gate = new Int32Array(data.barrier);
    Atomics.add(gate, 0, 1); Atomics.notify(gate, 0);
    for (;;) { const n = Atomics.load(gate, 0); if (n === data.harts) break; Atomics.wait(gate, 0, n, 100); }
    let retries = 0;
    for (let i = 0; i < 10000; i++) {
      ram.amo(64, 8, 'add', 1n);
      for (;;) {
        const value = ram.lr(72, 8);
        if (ram.sc(72, 8, value + 1n)) break;
        retries++;
      }
    }
    self.postMessage({ retries });
  } catch (error) { self.postMessage({ error: String(error) }); }
};
