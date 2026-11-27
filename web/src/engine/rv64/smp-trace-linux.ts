import { createSharedCompiler } from './shared-compiler';
import { sharedTable, atomicModule, HartMailboxes, RESERVATION_GRANULE } from './smp';
const host = globalThis as typeof globalThis & { rv64Result?: unknown };
const output = document.querySelector('#console')!;
const TRACE_STEPS = 1_000_000;
const HARTS = 2;
type TraceMessage = { type: string; hart?: number; buffer?: ArrayBuffer; bytes?: Uint8Array; error?: string };
const fnv = (words: Uint32Array) => { let h = 0x811c9dc5; for (const w of words) { for (const b of [w & 255, w >>> 8 & 255, w >>> 16 & 255, w >>> 24]) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; } } return h >>> 0; };
try {
  const [kernel, initrd] = await Promise.all(['/rv64/vmlinuz.efi', '/rv64/alpine.cpio'].map(async u => {
    const r = await fetch(u); if (!r.ok) throw Error(`${u}: ${r.status}`); return new Uint8Array(await r.arrayBuffer());
  }));
  const runs: { ms: number; hartWords: number[]; hartFnv: number[]; consoleTail: string; ramFnv: number; broughtUp: boolean }[] = [];
  const raw: Uint32Array[][] = [];
  for (let runIndex = 0; runIndex < 2; runIndex++) {
    const bytes = 256 * 1024 * 1024, pages = bytes / 65536 + 1;
    const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
    const module = atomicModule(pages), mail = new HartMailboxes(HARTS).words.buffer;
    const generations = sharedTable(bytes / 4096 * 4), epoch = performance.timeOrigin + performance.now();
    const granules = sharedTable(Math.ceil(memory.buffer.byteLength / RESERVATION_GRANULE) * 4);
    const control = new SharedArrayBuffer(HARTS * 64), ctl = new Int32Array(control);
    for (let h = 0; h < HARTS; h++) ctl[h * 16] = 1;
    const compiler = createSharedCompiler(HARTS * 256 * 1024 * 1024, HARTS);
    const workers: Worker[] = [], start = performance.now();
    const traces = new Map<number, Uint32Array>(); let text = '', broughtUp = false;
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error(`trace run ${runIndex} timeout`)), 480000);
        compiler.onerror = e => { clearTimeout(timeout); reject(Error(e.message)); };
        for (let hart = 0; hart < HARTS; hart++) {
          const w = new Worker(new URL('./smp-cpu.worker.ts', import.meta.url), { type: 'module' }); workers.push(w);
          w.onerror = e => { clearTimeout(timeout); reject(Error(e.message)); };
          w.onmessage = ({ data }: MessageEvent<TraceMessage>) => {
            if (data.type === 'error') { clearTimeout(timeout); reject(Error(data.error ?? 'worker error')); }
            if (data.type === 'console') {
              text += new TextDecoder().decode(data.bytes).replace(/\r/g, '');
              output.textContent = text.slice(-2000);
              if (text.includes('smp: Brought up')) broughtUp = true;
              if (text.includes('Kernel panic')) { clearTimeout(timeout); reject(Error('Kernel panic')); }
            }
            if (data.type === 'trace' && data.hart !== undefined && data.buffer) {
              traces.set(data.hart, new Uint32Array(data.buffer));
              if (traces.size === HARTS && broughtUp) { clearTimeout(timeout); resolve(); }
            }
          };
          const compilerPort = compiler.connect(hart);
          w.postMessage({ compilerPort, hart, harts: HARTS, bytes, memory, module, mail, control, generations, granules, epoch, trace: { steps: TRACE_STEPS },
            kernel: hart ? undefined : kernel, initrd: hart ? undefined : initrd,
            cmdline: 'earlycon=sbi console=hvc0 rdinit=/init nokaslr initcall_blacklist=jent_mod_init rv64.epoch=1800000000' }, [compilerPort]);
        }
      });
    } finally { Atomics.store(ctl, 15, 1); workers.forEach(w => w.terminate()); compiler.terminate(); }
    const hartsTraces = Array.from({ length: HARTS }, (_, h) => traces.get(h) ?? new Uint32Array(0));
    raw.push(hartsTraces);
    runs.push({ ms: performance.now() - start, hartWords: hartsTraces.map(t => t.length), hartFnv: hartsTraces.map(fnv),
      consoleTail: text.slice(-4000), ramFnv: fnv(new Uint32Array(memory.buffer)), broughtUp });
  }
  const comparison = [];
  for (let hart = 0; hart < HARTS; hart++) {
    const a = raw[0]![hart]!, b = raw[1]![hart]!;
    const words = Math.min(a.length, b.length);
    let at = words;
    for (let i = 0; i < words; i++) if (a[i] !== b[i]) { at = i; break; }
    const event = Math.floor(at / 7), slice = (t: Uint32Array, e: number) => Array.from(t.slice(e * 7, e * 7 + 14));
    comparison.push({ hart, commonPrefixWords: at === words && a.length === b.length ? words : at,
      equalLength: a.length === b.length, firstDivergenceEvent: at === words ? null : event, runA: slice(a, event), runB: slice(b, event) });
  }
  host.rv64Result = { type: 'smp-trace-linux', pass: runs.every(r => r.broughtUp && r.hartWords.every(w => w === TRACE_STEPS * 7)), runs, comparison };
} catch (e) { host.rv64Result = { type: 'smp-trace-linux', pass: false, error: String(e), console: output.textContent }; }
