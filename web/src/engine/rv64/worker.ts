import { ByteRing, FrameRing } from './ring';
// All async work finishes before entering the hart loop. Runtime input uses SAB only.
interface Core {
  run(count: number, ticks: number): number;
  net_receive(data: Uint8Array): void;
  net_take(): Uint8Array;
  disk(data: Uint8Array): void;
  free(): void;
  take_disk(): Uint8Array;
  stimecmp_writes(): number;
  input(data: Uint8Array): void;
  entropy(data: Uint8Array): void;
  output(): Uint8Array;
  deadline_ms(): number;
  retired(): number;
  register(n: number): bigint;
  boot(kernel: Uint8Array, initrd: Uint8Array, cmdline: string): void;
  load_program(program: Uint8Array): void;
}
interface Init {
  input: SharedArrayBuffer; output: SharedArrayBuffer; control: SharedArrayBuffer;
  netIn?: SharedArrayBuffer; netOut?: SharedArrayBuffer; disk?: ArrayBuffer;
  kernel?: ArrayBuffer; initrd?: ArrayBuffer; program?: ArrayBuffer; cmdline?: string; memoryMB: number;
}
self.onmessage = async ({ data }: MessageEvent<Init>) => {
  self.onmessage = null;
  try {
    const url = new URL('/rv64/rv64_core.js', self.location.origin).href;
    const mod = await import(/* @vite-ignore */ url);
    await mod.default();
    let core = new mod.Engine(data.memoryMB) as Core;
    if (data.disk) core.disk(new Uint8Array(data.disk));
    if (data.program) core.load_program(new Uint8Array(data.program));
    else core.boot(new Uint8Array(data.kernel!), new Uint8Array(data.initrd!), data.cmdline ?? 'earlycon=sbi console=hvc0 rdinit=/bin/sh nokaslr');
    const input = new ByteRing(data.input), output = new ByteRing(data.output);
    const control = new Int32Array(data.control);
    const netIn = data.netIn ? new FrameRing(new ByteRing(data.netIn)) : undefined;
    const netOut = data.netOut ? new FrameRing(new ByteRing(data.netOut)) : undefined;
    const entropy = new Uint8Array(4096);
    let entropyAt = -Infinity;
    let busyMicros = 0;
    let pending: Uint8Array = new Uint8Array(0);
    self.postMessage({ type: 'ready' });
    for (;;) {
      // Load the wake sequence BEFORE draining input: this closes the lost-wakeup window.
      const wake = Atomics.load(input.words, 2);
      if (Atomics.load(control, 0)) break;
      for (const frame of netIn?.read() ?? []) core.net_receive(frame);
      const bytes = input.read();
      if (bytes.length) core.input(bytes);
      const now = performance.now();
      if (now - entropyAt > 1000) { crypto.getRandomValues(entropy); core.entropy(entropy); entropyAt = now; }
      if (pending.length) {
        pending = pending.slice(output.write(pending));
        if (pending.length) { const seq = Atomics.load(output.words, 2); Atomics.wait(output.words, 2, seq, 1); continue; }
      }
      const runStart = performance.now();
      const state = core.run(4096, now * 10000);
      busyMicros += (performance.now() - runStart) * 1000;
      Atomics.store(control, 4, Math.round(busyMicros));
      pending = core.output();
      for (let frame = core.net_take(); frame.length; frame = core.net_take()) {
        if (!netOut?.write(frame)) Atomics.add(control, 2, 1);
      }
      Atomics.store(control, 3, core.stimecmp_writes());
      Atomics.store(control, 1, Math.floor(core.retired() / 1000));
      if (state === 3) {
        const disk = core.take_disk();
        core.free(); core = new mod.Engine(data.memoryMB) as Core;
        if (disk.length) core.disk(disk);
        core.boot(new Uint8Array(data.kernel!), new Uint8Array(data.initrd!), data.cmdline ?? 'earlycon=sbi console=hvc0 rdinit=/init nokaslr');
        entropyAt = -Infinity; self.postMessage({ type: 'reset' }); continue;
      }
      if (state === 2) { self.postMessage({ type: 'stopped' }); break; }
      if (data.program && state === 1) { self.postMessage({ type: 'smoke', value: core.register(10).toString(), retired: core.retired() }); }
      if (state === 1 && !pending.length) Atomics.wait(input.words, 2, wake, Math.min(core.deadline_ms(), 1000));
    }
  } catch (error) { self.postMessage({ type: 'error', error: String(error) }); }
};
