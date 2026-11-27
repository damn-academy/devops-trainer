// Experimental CPU-per-Worker shared-RAM interpreter. Each wasm instance owns
// only its hart state. Worker 0 owns a separate device Engine and services RPCs.
import { HTTPBlockDevice, type HTTPDisk } from './block';
import { JitRuntime } from './jit';
import { SharedHartMemory, HartMailboxes, type Amo, type FenceTicket } from './smp';
interface Init {
  hostBudget?: number;
  compilerPort?: MessagePort;
  hart: number; harts: number; bytes: number; memory: WebAssembly.Memory; module: WebAssembly.Module;
  generations: WebAssembly.Memory; granules: WebAssembly.Memory; epoch: number;
  mail: SharedArrayBuffer; control: SharedArrayBuffer; kernel?: Uint8Array; initrd?: Uint8Array;
  httpDisk?: HTTPDisk;
  program?: Uint8Array; cmdline?: string;
  trace?: { steps: number };
  /** Guest sampling profiler: interval in guest instructions (0 = off). */
  guestProfile?: number;
  guestProfileDeferred?: boolean;
  guestProfileTaskCommOffset?: number;
  /** Snapshot coordination: [0]=requestEpoch, [1]=resumeEpoch, [2+hart]=captured. */
  snap?: SharedArrayBuffer;
  initialRestore?: { blob: Uint8Array; deviceBlob?: Uint8Array };
}
self.onmessage = async ({ data: d }: MessageEvent<Init>) => {
  self.onmessage = null;
  try {
    const words = new Int32Array(d.control), wide = new BigUint64Array(d.control);
    const bus = new HartMailboxes(d.harts, d.mail), ram = new SharedHartMemory(d.memory, d.module, new Int32Array(d.generations.buffer), new Int32Array(d.granules.buffer));
    const base = d.hart * 16;
    const url = new URL('/rv64/rv64_core.js', self.location.origin).href;
    const mod = await import(/* @vite-ignore */ url); const wasm = await mod.default();
    const core = new mod.Engine(32);
    if (typeof core.smp_sfence !== 'function') throw Error('Stale RV64 WASM: rebuild with scripts/rv64-dev.sh wasm (smp_sfence missing)');
    if (core.smp_jit_abi?.() !== 9) throw Error('Stale RV64 WASM: rebuild R9 (24-field JIT frame required)');
    if (d.compilerPort && core.jit_share_abi?.() !== 12) throw Error('Stale RV64 WASM: rebuild R12 shared JIT ABI');
    core.smp_configure(d.hart, d.bytes);
    let hostBudget = d.hostBudget;
    const newJitRuntime = () => {
      const runtime = new JitRuntime(wasm.memory, core.jit_table(), (id, slot, count) => core.jit_install(id, slot, count), () => core.jit_clear(), wasm.jit_slow,
      { usage: ids => core.jit_usage(ids), evict: ids => core.jit_evict(ids) },
      { ram: d.memory, generations: d.generations, granules: d.granules, bytes: d.bytes }, d.compilerPort);
      if (hostBudget !== undefined) runtime.setHostBudget(hostBudget);
      return runtime;
    };
    let jitRuntime = newJitRuntime();
    core.jit_threshold(50);
    const profileInterval = d.guestProfile ?? 0;
    let profileActive = !!profileInterval && !d.guestProfileDeferred;
    if (profileActive) { core.profile_configure(profileInterval); core.profile_task_comm(d.guestProfileTaskCommOffset ?? 0); }
    const device = d.hart === 0 ? new mod.Engine(32) : undefined;
    device?.smp_configure(0, d.bytes);
    if (device && (d.snap || d.initialRestore) && typeof device.disk_trim_clean !== 'function') throw Error('Rebuild R17 WASM: disk_trim_clean missing');
    const disk = device && d.httpDisk ? new HTTPBlockDevice(d.httpDisk) : undefined;
    if (disk) device.lazy_disk(disk.image.bytes);
    const diskTasks = new Map<number, Promise<void>>(); let diskError: unknown;
    const access = (op: number, offset: number, size: 1 | 2 | 4 | 8, value: bigint): bigint => {
      const address = offset + 64;
      if (op === 0) return BigInt.asUintN(size * 8, ram.load(address, size));
      if (op === 1) { ram.store(address, size, value); return 0n; }
      if (op === 2) { ram.clearReservation(); return 0n; }
      if (size !== 4 && size !== 8) throw Error('invalid AMO width');
      if (op === 18) return ram.lr(address, size);
      if (op === 19) return ram.sc(address, size, value) ? 0n : 1n;
      const names: Record<number, Amo> = { 16: 'add', 17: 'swap', 20: 'xor', 24: 'or', 28: 'and', 32: 'min', 36: 'max', 40: 'minu', 44: 'maxu' };
      const name = names[op]; if (!name) throw Error('invalid AMO');
      return ram.amo(address, size, name, value);
    };
    const mmio = (write: boolean, address: bigint, size: number, value: bigint): bigint => {
      if (device) {
        if (write) { device.smp_device_write(address, Number(value & 0xffffffffn)); return 0n; }
        const shift = Number(address & 3n) * 8;
        return BigInt.asUintN(size * 8, device.smp_device_read(address & ~3n) >> BigInt(shift));
      }
      wide[base / 2 + 2] = address; wide[base / 2 + 3] = value;
      Atomics.store(words, base + 3, Number(write)); Atomics.store(words, base + 8, size);
      Atomics.store(words, base + 2, 1);
      while (Atomics.load(words, base + 2) !== 2) {
        if (Atomics.load(words, 15)) throw Error('machine stopped during MMIO');
        Atomics.wait(words, base + 2, 1, 10);
      }
      const result = wide[base / 2 + 3]!; Atomics.store(words, base + 2, 0); return result;
    };
    Object.assign(globalThis, {
      rv64SharedAccess: access,
      rv64SharedGeneration: (page: number) => Atomics.load(new Int32Array(d.generations.buffer), page) >>> 0,
      rv64SharedCas: (offset: number, expected: bigint, value: bigint) => ram.cas(offset + 64, expected, value),
      rv64SharedImage: (offset: number, bytes: Uint8Array) => new Uint8Array(d.memory.buffer, offset + 64, bytes.length).set(bytes),
      rv64SharedMmio: mmio,
      rv64SharedDmaWrite: (offset: number, bytes: Uint8Array) => ram.dmaWrite(offset + 64, bytes),
      rv64SharedDmaRead: (offset: number, bytes: Uint8Array) => ram.dmaRead(offset + 64, bytes),
    });
    const remote = { instructionRequests: 0, translationRequests: 0, ipiRequests: 0 };
    const service = () => {
      if (bus.service(d.hart, () => core.smp_fence(), () => core.smp_sfence())) core.smp_ipi();
      if (device) {
        for (let hart = 1; hart < d.harts; hart++) {
          const b = hart * 16;
          if (Atomics.load(words, b + 2) === 1) {
            wide[b / 2 + 3] = mmio(!!Atomics.load(words, b + 3), wide[b / 2 + 2]!, Atomics.load(words, b + 8), wide[b / 2 + 3]!);
            Atomics.store(words, b + 2, 2); Atomics.notify(words, b + 2);
          }
        }
        device.smp_devices();
        if (diskError) throw diskError;
        if (disk) for (const index of device.disk_missing()) {
          if (!diskTasks.has(index)) diskTasks.set(index, disk.chunk(index).then(bytes => device.disk_chunk(index, bytes)).catch(e => { diskError = e; }).finally(() => { diskTasks.delete(index); }));
        }
        for (let frame: Uint8Array = device.net_take(); frame.length; frame = device.net_take()) self.postMessage({ type: 'net', frame });
        for (let hart = 0; hart < d.harts; hart++) Atomics.store(words, hart * 16 + 1, Number(device.smp_interrupts(hart)));
        const out: Uint8Array = device.output(); if (out.length) self.postMessage({ type: 'console', hart: 0, bytes: out });
      }
    };
    if (d.initialRestore) {
      core.smp_restore(d.initialRestore.blob);
      if (device && d.initialRestore.deviceBlob) device.smp_restore(d.initialRestore.deviceBlob);
      // The restored core carries no compiled blocks and its JIT settings
      // are reset: without a fresh runtime and threshold every block stays
      // interpreted (measured: 6 MIPS, no compiled blocks, after a
      // checkpoint restore). The in-page barrier restore does the same.
      jitRuntime.dispose(); jitRuntime = newJitRuntime(); core.jit_threshold(50);
    } else if (d.hart === 0) {
      if (d.program) { core.load_program(d.program); core.smp_start(0x80000000n, 0n); }
      else core.smp_boot(d.kernel, d.initrd, d.cmdline ?? 'earlycon=sbi console=hvc0 rdinit=/init nokaslr initcall_blacklist=jent_mod_init', d.harts);
      Atomics.store(words, 0, 0); Atomics.store(words, 14, 1); Atomics.notify(words, 14);
    } else {
      while (!Atomics.load(words, 14)) Atomics.wait(words, 14, 0, 100);
    }
    self.postMessage({ type: 'ready', hart: d.hart });
    let pending: FenceTicket[] | undefined;
    let lastReport = performance.now(), lastEntropy = -Infinity;
    // All-hart snapshot barrier state: quiesce, capture, wait for the host to
    // re-install the shared image and blobs, then restore and resume.
    let snapEpoch = 0; let restore: { blob?: Uint8Array; deviceBlob?: Uint8Array } | undefined;
    const freshJit = () => { jitRuntime.dispose(); jitRuntime = newJitRuntime(); };
    // Real-boot trace capture: pure interpreter (JIT off, threshold 0) on a fixed
    // tick quantum, so guest time advances deterministically while a hart runs;
    // a waiting hart keeps advancing time without retiring instructions.
    let traced = 0, traceTicks = 0; let stream: Uint32Array | undefined;
    if (d.trace) {
      core.jit_threshold(0); core.test_trace(true);
      stream = new Uint32Array(d.trace.steps * 7);
      traceTicks = 1_000_000;
    }
    // Input messages are processed between execution batches.
    self.onmessage = ({ data }) => {
      if (typeof data.hostBudget === 'number') { hostBudget = data.hostBudget; jitRuntime.setHostBudget(data.hostBudget); }
      if (data.guestProfileStart && profileInterval && !profileActive) {
        core.profile_configure(profileInterval); core.profile_task_comm(d.guestProfileTaskCommOffset ?? 0); profileActive = true;
      }
      if (data.snapshot) snapEpoch = data.snapshot as number;
      if (data.restore) restore = data.restore;
      if (data.input && device) device.input(data.input);
      if (data.frame && device) device.net_receive(data.frame);
    };
    const channel = new MessageChannel();
    const yieldHost = () => new Promise<void>(resolve => { channel.port1.onmessage = () => resolve(); channel.port2.postMessage(0); });
    let yielded = performance.now(), lastTrim = performance.now();
    const snap = d.snap ? new Int32Array(d.snap) : undefined;
    while (!Atomics.load(words, 15)) {
      // All-hart snapshot barrier: drain outstanding work, capture this hart,
      // then wait for the host to re-install the image and blobs and resume.
      if (snap && snapEpoch > 0 && Atomics.load(snap, 0) === snapEpoch && !Atomics.load(snap, 2 + d.hart)) {
        // Stop guest execution on every hart, but continue servicing remote
        // fences/MMIO until all participants have reached the barrier.
        const deadline = performance.now() + 120000;
        while (pending) {
          service();
          if (pending.every(t => bus.completed(t))) { core.smp_reply(0n, 0n); pending = undefined; }
          if (performance.now() > deadline) throw Error('snapshot fence timeout');
          await yieldHost();
        }
        // Old in-page gate has only captured slots; persistent checkpoints use
        // separate quiescence slots so device serialization cannot race DMA.
        if (snap.length >= 2 + 2 * d.harts) {
          Atomics.store(snap, 2 + d.harts + d.hart, 1);
          while (Array.from({ length: d.harts }, (_, h) => Atomics.load(snap, 2 + d.harts + h)).some(v => !v)) {
            service();
            if (performance.now() > deadline) throw Error('snapshot quiescence timeout');
            await yieldHost();
          }
        }
        service();
        if (device) {
          do { await Promise.all(diskTasks.values()); service(); } while (diskTasks.size);
          if (typeof device.disk_trim_clean !== 'function') throw Error('Rebuild R17 WASM: disk_trim_clean missing');
          device.disk_trim_clean();
        }
        const blob = core.smp_snapshot();
        const deviceBlob = device?.smp_snapshot();
        self.postMessage({ type: 'snapshot', hart: d.hart, ticks: core.guest_ticks(), blob, deviceBlob }, [blob.buffer, deviceBlob?.buffer].filter(Boolean) as Transferable[]);
        Atomics.store(snap, 2 + d.hart, 1); Atomics.notify(snap, 2 + d.hart);
        while (Atomics.load(snap, 1) < snapEpoch) await yieldHost();
        if (restore) {
          if (restore.blob) core.smp_restore(restore.blob);
          if (device && restore.deviceBlob) device.smp_restore(restore.deviceBlob);
          restore = undefined;
          ram.clearReservation();
          freshJit();
        }
        Atomics.store(snap, 2 + d.hart, 0);
        snapEpoch = 0;
        self.postMessage({ type: 'resumed', hart: d.hart });
      }
      service();
      if (device && performance.now() - lastTrim > 1000 && diskTasks.size === 0 && device.disk_cached().length > 128) {
        if (typeof device.disk_trim_clean !== 'function') throw Error('Rebuild R17 WASM: disk_trim_clean missing');
        device.disk_trim_clean(); lastTrim = performance.now();
      }
      const state = Atomics.load(words, base);
      if (state === 2) {
        core.smp_start(wide[base / 2 + 5]!, wide[base / 2 + 6]!);
        ram.clearReservation(); Atomics.store(words, base, 0);
      }
      if (pending && pending.every(t => bus.completed(t))) { core.smp_reply(0n, 0n); pending = undefined; }
      if (Atomics.load(words, base) === 0 && !pending) {
        let status: number;
        if (stream) {
          status = core.smp_run(1, traceTicks, BigInt(Atomics.load(words, base + 1)));
          traceTicks += 10;
          if (status === 0) {
            const ev = core.test_last_trace();
            if (ev.length >= 7) {
              for (let w = 0; w < 7; w++) stream[traced * 7 + w] = Number(ev[w]);
              traced++;
              if (traced === d.trace!.steps) {
                core.jit_threshold(50); core.test_trace(false);
                self.postMessage({ type: 'trace', hart: d.hart, buffer: stream.buffer }, [stream.buffer]);
                stream = undefined;
              }
            }
          }
        } else {
          status = core.smp_run(2048, (performance.timeOrigin + performance.now() - d.epoch) * 10000, BigInt(Atomics.load(words, base + 1)));
        }
        const request: BigUint64Array = core.smp_request();
        if (request.length) {
          const [ext, fid, a, b, c] = Array.from(request) as [bigint, bigint, bigint, bigint, bigint];
          let error = 0n, value = 0n;
          try {
            if (ext === 0x48534dn) {
              if (fid === 0n) {
                const target = Number(a);
                if (a >= BigInt(d.harts)) error = -3n;
                else if ((b & 1n) || b < 0x80000000n || b >= 0x80000000n + BigInt(d.bytes)) error = -5n;
                else if (Atomics.compareExchange(words, target * 16, 1, 4) !== 1) error = -6n;
                else { wide[target * 8 + 5] = b; wide[target * 8 + 6] = c; Atomics.store(words, target * 16, 2); bus.ipi(target); }
              } else if (fid === 1n) { ram.clearReservation(); Atomics.store(words, base, 1); }
              else if (fid === 2n) { if (a >= BigInt(d.harts)) error = -3n; else { const s = Atomics.load(words, Number(a) * 16); value = BigInt(s === 4 ? 2 : s); } }
              else error = -2n;
            } else if (ext === 0x735049n && fid === 0n) { remote.ipiRequests++; bus.sendIpi(a, b); }
            else if (ext === 0x52464e43n && fid <= 2n) { remote[fid === 0n ? 'instructionRequests' : 'translationRequests']++; pending = bus.remoteFence(a, b, fid === 0n ? 'instruction' : 'translation'); }
            else if (ext >= 4n && ext <= 7n) {
              const mask = a === 0n ? (1n << BigInt(d.harts)) - 1n : access(0, Number(a - 0x80000000n), 8, 0n);
              if (ext === 4n) { remote.ipiRequests++; bus.sendIpi(mask, 0n); } else { remote[ext === 5n ? 'instructionRequests' : 'translationRequests']++; pending = bus.remoteFence(mask, 0n, ext === 5n ? 'instruction' : 'translation'); }
            } else error = -2n;
          } catch (e) { if (!(e instanceof RangeError)) throw e; error = -3n; }
          if (!pending) core.smp_reply(error, value);
        } else if (status === 2) { Atomics.store(words, 15, 1); self.postMessage({ type: 'stopped', hart: d.hart }); }
        const out: Uint8Array = core.output(); if (out.length) self.postMessage({ type: 'console', hart: d.hart, bytes: out });
      }
      if (device && performance.now() - lastEntropy > 100) { device.entropy(d.trace ? new Uint8Array(4096) : crypto.getRandomValues(new Uint8Array(4096))); lastEntropy = performance.now(); }
      if (performance.now() - lastReport > 1000) {
        self.postMessage({ type: 'metrics', hart: d.hart, wasmMemoryBytes: wasm.memory.buffer.byteLength, retired: core.retired(), jitRetired: core.jit_retired(), compiled: jitRuntime.compiled, compiler: jitRuntime.stats(), counters: JSON.parse(core.metrics()), remote: { ...remote }, pc: String(core.pc()), state: Atomics.load(words, base), guestTicks: core.guest_ticks(), hostMonotonicMs: performance.timeOrigin + performance.now(), guestProfile: profileActive ? JSON.parse(core.profile_drain()) : undefined }); lastReport = performance.now();
      }
      // Yield to host input without blocking the device server or incoming fences.
      if (performance.now() - yielded >= 8) { jitRuntime.flush(); await yieldHost(); yielded = performance.now(); }
    }
  } catch (e) { self.postMessage({ type: 'error', hart: d.hart, error: String(e) }); }
};
