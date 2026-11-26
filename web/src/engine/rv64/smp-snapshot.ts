import { createSharedCompiler } from './shared-compiler';
import { sharedTable, atomicModule, HartMailboxes, RESERVATION_GRANULE } from './smp';
const host = globalThis as typeof globalThis & { rv64Result?: unknown };
const output = document.querySelector('#console')!;
const HARTS = 2;
const cleanup: Worker[] = [];
type SnapMessage = { type: string; hart?: number; blob?: Uint8Array; deviceBlob?: Uint8Array; bytes?: Uint8Array; error?: string };
try {
  const [kernel, initrd] = await Promise.all(['/rv64/vmlinuz.efi', '/rv64/alpine.cpio'].map(async u => {
    const r = await fetch(u); if (!r.ok) throw Error(`${u}: ${r.status}`); return new Uint8Array(await r.arrayBuffer());
  }));
  const bytes = 256 * 1024 * 1024, pages = bytes / 65536 + 1;
  const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
  const module = atomicModule(pages), mail = new HartMailboxes(HARTS).words.buffer;
  const generations = sharedTable(bytes / 4096 * 4), epoch = performance.timeOrigin + performance.now();
  const granules = sharedTable(Math.ceil(memory.buffer.byteLength / RESERVATION_GRANULE) * 4);
  const control = new SharedArrayBuffer(HARTS * 64), ctl = new Int32Array(control);
  for (let h = 0; h < HARTS; h++) ctl[h * 16] = 1;
  const snap = new SharedArrayBuffer((2 + HARTS) * 4), sv = new Int32Array(snap);
  const compiler = createSharedCompiler(HARTS * 256 * 1024 * 1024); cleanup.push(compiler);
  const workers: Worker[] = []; let text = '';
  const snapshots = new Map<number, { blob: Uint8Array; deviceBlob?: Uint8Array }>();
  let shellReady = false, error: string | undefined;
  compiler.onerror = e => { error = e.message; };
  for (let hart = 0; hart < HARTS; hart++) {
    const w = new Worker(new URL('./smp-cpu.worker.ts', import.meta.url), { type: 'module' }); workers.push(w); cleanup.push(w);
    w.onerror = e => { error = e.message; };
    w.onmessage = ({ data }: MessageEvent<SnapMessage>) => {
      if (data.type === 'error') error = data.error;
      if (data.type === 'console') {
        text += new TextDecoder().decode(data.bytes).replace(/\r/g, '');
        output.textContent = text.slice(-2000);
        if (text.includes('Kernel panic')) error = 'Kernel panic';
        if (text.includes('/ #') || text.includes('~ #')) shellReady = true;
      }
      if (data.type === 'resumed' && data.hart !== undefined) resumed.add(data.hart);
      if (data.type === 'snapshot' && data.hart !== undefined && data.blob) snapshots.set(data.hart, { blob: data.blob, deviceBlob: data.deviceBlob });
    };
    const compilerPort = compiler.connect(hart);
    w.postMessage({ compilerPort, hart, harts: HARTS, bytes, memory, module, mail, control, generations, granules, epoch, snap,
      kernel: hart ? undefined : kernel, initrd: hart ? undefined : initrd,
      cmdline: 'earlycon=sbi console=hvc0 rdinit=/init nokaslr initcall_blacklist=jent_mod_init rv64.epoch=' + Math.floor(Date.now() / 1000) }, [compilerPort]);
  }
  const started = performance.now();
  while (!shellReady && !error && performance.now() - started < 480000) await new Promise(r => setTimeout(r, 250));
  if (!shellReady) throw Error(error ?? 'shell did not come up');
  const snapBegin = performance.now();
  Atomics.store(sv, 0, 1);
  for (const w of workers) w.postMessage({ snapshot: 1 });
  while ([...Array(HARTS).keys()].some(h => Atomics.load(sv, 2 + h) !== 1) && !error && performance.now() - snapBegin < 120000) await new Promise(r => setTimeout(r, 100));
  if (snapshots.size !== HARTS) throw Error(error ?? `captured ${snapshots.size}/${HARTS} harts`);
  // Sparse shared-RAM image: nonzero 4 KiB pages of the guest region [64, 64+bytes).
  const view = new Uint8Array(memory.buffer, 64, bytes);
  const image = new Map<number, Uint8Array>();
  for (let p = 0; p < bytes / 4096; p++) {
    const page = view.subarray(p * 4096, p * 4096 + 4096);
    if (page.some(b => b !== 0)) image.set(p, page.slice());
  }
  // Prove the image is sufficient: wipe the whole buffer, then reinstall only the pages.
  new Uint8Array(memory.buffer).fill(0);
  for (const [p, page] of image) view.set(page, p * 4096);
  const gens = new Int32Array(generations.buffer);
  for (let i = 0; i < gens.length; i++) gens[i] = gens[i]! + 1;
  for (let h = 0; h < HARTS; h++) workers[h]!.postMessage({ restore: { blob: snapshots.get(h)!.blob, deviceBlob: snapshots.get(0)!.deviceBlob } });
  Atomics.store(sv, 1, 1); Atomics.notify(sv, 1);
  const resumeBegin = performance.now();
  let restored = false; const resumed = new Set<number>();
  while (!restored && !error && performance.now() - resumeBegin < 120000) {
    await new Promise(r => setTimeout(r, 250));
    if (!restored && resumed.size === HARTS) workers[0]!.postMessage({ input: new TextEncoder().encode('echo RESTORED_OK_$((40+2))\n') });
    if (text.includes('RESTORED_OK_42')) restored = true;
  }
  const result = { type: 'smp-snapshot', pass: restored && !error, error, imagePages: image.size, imageBytes: [...image.values()].reduce((n, p) => n + p.length, 0),
    snapWaitMs: performance.now() - snapBegin, restored, consoleTail: text.slice(-4000) };
  host.rv64Result = result;
  Atomics.store(ctl, 15, 1);
} catch (e) { host.rv64Result = { type: 'smp-snapshot', pass: false, error: String(e), console: output.textContent }; }
finally { cleanup.forEach(w => w.terminate()); }
