import { JitRuntime } from './jit';
import { ByteRing, FrameRing } from './ring';
import { HTTPBlockDevice, type HTTPDisk } from './block';
// All async work finishes before entering the hart loop. Runtime input uses SAB only.
interface Core {
  metrics(): string;
  jit_retired(): number;
  jit_threshold(n: number): void;
  jit_install(id: number, slot: number, count: number): void;
  jit_clear(): void;
  jit_usage(ids: Uint32Array): number;
  jit_evict(ids: Uint32Array): void;
  jit_table(): WebAssembly.Table;
  set_mac(mac: Uint8Array): void;
  snapshot(): Uint8Array;
  restore(state: Uint8Array): void;
  ticks(): number;
  lazy_disk(bytes: number): void;
  disk_missing(): Uint32Array;
  disk_chunk(index: number, bytes: Uint8Array): void;
  run(count: number, ticks: number): number;
  net_receive(data: Uint8Array): void;
  net_take(): Uint8Array;
  disk(data: Uint8Array): void;
  free(): void;
  take_disk(): Uint8Array;
  disk_state(): Uint8Array;
  restore_disk(state: Uint8Array): void;
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
  kernel?: ArrayBuffer; initrd?: ArrayBuffer; program?: ArrayBuffer; cmdline?: string; memoryMB: number; jitThreshold?: number; mac?: Uint8Array; httpDisk?: HTTPDisk;
}
self.onmessage = async ({ data }: MessageEvent<Init>) => {
  self.onmessage = null;
  let cleanup = () => {};
  try {
    const url = new URL('/rv64/rv64_core.js', self.location.origin).href;
    const mod = await import(/* @vite-ignore */ url);
    const wasm = await mod.default();
    const threshold = data.jitThreshold ?? 50;
    let core = new mod.Engine(data.memoryMB) as Core;
    core.jit_threshold(threshold);
    const createJit = () => new JitRuntime(wasm.memory, core.jit_table(), (id, slot, count) => core.jit_install(id, slot, count), () => core.jit_clear(), wasm.jit_slow, { usage: ids => core.jit_usage(ids), evict: ids => core.jit_evict(ids) });
    let jit = createJit();
    if (data.mac) core.set_mac(data.mac);
    const disk = data.httpDisk ? new HTTPBlockDevice(data.httpDisk) : undefined;
    if (disk) core.lazy_disk(disk.image.bytes);
    if (data.disk) core.disk(new Uint8Array(data.disk));
    if (data.program) core.load_program(new Uint8Array(data.program));
    else core.boot(new Uint8Array(data.kernel!), new Uint8Array(data.initrd!), data.cmdline ?? 'earlycon=sbi console=hvc0 rdinit=/bin/sh nokaslr');
    const input = new ByteRing(data.input), output = new ByteRing(data.output);
    const control = new Int32Array(data.control);
    const netIn = data.netIn ? new FrameRing(new ByteRing(data.netIn)) : undefined;
    const netOut = data.netOut ? new FrameRing(new ByteRing(data.netOut)) : undefined;
    const entropy = new Uint8Array(4096);
    let entropyAt = -Infinity;
    let timeOffset = 0;
    let busyMicros = 0;
    let waitMs = 0, diskMs = 0, compilerYieldMs = 0, metricsAt = 0;
    const diskTasks = new Map<number, Promise<void>>();
    let diskError: unknown;
    let diskActiveStart = 0, diskActiveMs = 0;
    const settleDisk = async () => { await Promise.all(diskTasks.values()); if (diskError) throw diskError; };
    const startedAt = performance.now();
    const wait = (words: Int32Array, index: number, value: number, timeout: number) => {
      const start = performance.now(); Atomics.wait(words, index, value, timeout); waitMs += performance.now() - start;
    };
    let yieldAt = performance.now();
    const channel = new MessageChannel();
    cleanup = () => { jit.dispose(); channel.port1.close(); channel.port2.close(); };
    const yieldCompiler = () => new Promise<void>(resolve => { channel.port1.onmessage = () => resolve(); channel.port2.postMessage(0); });
    let pending: Uint8Array = new Uint8Array(0);
    self.postMessage({ type: 'ready' });
    for (;;) {
      if (performance.now() - metricsAt >= 1000) {
        metricsAt = performance.now();
        self.postMessage({ type: 'metrics', metrics: { elapsedMs: metricsAt - startedAt,
          retired: core.retired(), jitRetired: core.jit_retired(), busyMilliseconds: busyMicros / 1000,
          waitMs, diskMs, diskActiveMs: diskActiveMs + (diskTasks.size ? performance.now() - diskActiveStart : 0), diskPending: diskTasks.size, compilerYieldMs, compiler: jit.stats(), counters: JSON.parse(core.metrics()) } });
      }
      // Load the wake sequence BEFORE draining input: this closes the lost-wakeup window.
      if (Atomics.load(control, 5)) {
        const request = await new Promise<{ op: string; state?: Uint8Array; pending?: Uint8Array }>(resolve => {
          self.onmessage = ({ data }) => { self.onmessage = null; resolve(data); };
          self.postMessage({ type: 'paused' });
        });
        try {
          await settleDisk();
          if (request.op === 'snapshot') {
            const state = core.snapshot();
            self.postMessage({ type: 'checkpoint', state, pending }, [state.buffer]);
          } else {
            jit.dispose(); jit = createJit();
            core.restore(request.state!); core.jit_threshold(threshold); pending = request.pending ?? new Uint8Array(0);
            timeOffset = core.ticks() - performance.now() * 10000;
            entropyAt = -Infinity;
            self.postMessage({ type: 'restored' });
          }
        } catch (error) { self.postMessage({ type: 'checkpoint-error', error: String(error) }); }
        // Main thread copies ring state while the hart is quiescent.
        await new Promise<void>(resolve => {
          self.onmessage = () => { self.onmessage = null; resolve(); };
        });
      }
      if (performance.now() - yieldAt >= 8) {
        const yieldStart = performance.now();
        jit.flush(); await yieldCompiler(); yieldAt = performance.now(); compilerYieldMs += yieldAt - yieldStart;
        Atomics.store(control, 6, jit.compiled);
        Atomics.store(control, 7, Math.floor(core.jit_retired() / 1000));
      }
      if (diskError) throw diskError;
      const wake = Atomics.load(input.words, 2);
      if (Atomics.load(control, 0)) break;
      for (const frame of netIn?.read() ?? []) core.net_receive(frame);
      const bytes = input.read();
      if (bytes.length) core.input(bytes);
      const now = performance.now();
      if (now - entropyAt > 1000) { crypto.getRandomValues(entropy); core.entropy(entropy); entropyAt = now; }
      if (pending.length) {
        pending = pending.slice(output.write(pending));
        if (pending.length) { const seq = Atomics.load(output.words, 2); wait(output.words, 2, seq, 1); continue; }
      }
      const runStart = performance.now();
      const state = core.run(4096, now * 10000 + timeOffset);
      busyMicros += (performance.now() - runStart) * 1000;
      Atomics.store(control, 4, Math.round(busyMicros));
      if (disk) {
        // Disk completion is a device event. Let other guest tasks run while
        // HTTP is in flight; callbacks install chunks only at event-loop yields.
        for (const index of core.disk_missing()) {
          if (diskTasks.has(index)) continue;
          if (!diskTasks.size) diskActiveStart = performance.now();
          const task = disk.chunk(index).then(bytes => core.disk_chunk(index, bytes))
            .catch(error => { diskError = error; })
            .finally(() => {
              diskTasks.delete(index);
              if (!diskTasks.size) diskActiveMs += performance.now() - diskActiveStart;
            });
          diskTasks.set(index, task);
        }
      }
      pending = core.output();
      for (let frame = core.net_take(); frame.length; frame = core.net_take()) {
        if (!netOut?.write(frame)) Atomics.add(control, 2, 1);
      }
      Atomics.store(control, 3, core.stimecmp_writes());
      Atomics.store(control, 1, Math.floor(core.retired() / 1000));
      if (state === 3) {
        await settleDisk();
        const savedDisk = core.disk_state();
        jit.dispose(); jit = createJit();
        core.free(); core = new mod.Engine(data.memoryMB) as Core; core.jit_threshold(threshold);
        core.restore_disk(savedDisk);
        if (data.mac) core.set_mac(data.mac);
        timeOffset = 0;
        core.boot(new Uint8Array(data.kernel!), new Uint8Array(data.initrd!), data.cmdline ?? 'earlycon=sbi console=hvc0 rdinit=/init nokaslr');
        entropyAt = -Infinity; self.postMessage({ type: 'reset' }); continue;
      }
      if (state === 2) { self.postMessage({ type: 'stopped' }); break; }
      if (data.program && state === 1) { self.postMessage({ type: 'smoke', value: core.register(10).toString(), retired: core.retired() }); }
      if (state === 1 && !pending.length) wait(input.words, 2, wake, Math.min(core.deadline_ms(), diskTasks.size ? 1 : 1000));
    }
  } catch (error) { self.postMessage({ type: 'error', error: String(error) }); }
  finally { cleanup(); }
};
