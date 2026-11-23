import { atomicModule, HartMailboxes, RESERVATION_GRANULE } from './smp';
import { createRV64Network } from './network';
import { fetchSource } from '../labhost/mirror';
const host = globalThis as typeof globalThis & { rv64Result?: unknown; rv64LatestMetrics?: unknown };
const output = document.querySelector('#console')!;
const samples: unknown[] = [];
const params = new URLSearchParams(location.search);
const seconds = Number(params.get('seconds') ?? 900);
try {
  const [kernel, initrd, httpDisk] = await Promise.all([
    fetch('/rv64/slim-vmlinuz.efi').then(r => r.arrayBuffer()).then(b => new Uint8Array(b)),
    fetch('/rv64/slim-initrd.cpio').then(r => r.arrayBuffer()).then(b => new Uint8Array(b)),
    fetch('/rv64/slim-recovery-media.json').then(r => r.json()),
  ]);
  for (const harts of [2, 4]) {
    const bytes = 1024 * 1024 * 1024, pages = bytes / 65536 + 1;
    const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
    const module = atomicModule(pages), mail = new HartMailboxes(harts).words.buffer;
    const control = new SharedArrayBuffer(harts * 64), ctl = new Int32Array(control);
    const generations = new SharedArrayBuffer(bytes / 4096 * 4), epoch = performance.timeOrigin + performance.now();
    const granules = new SharedArrayBuffer(Math.ceil(memory.buffer.byteLength / RESERVATION_GRANULE) * 4);
    for (let h = 0; h < harts; h++) ctl[h * 16] = 1;
    const workers: Worker[] = [], start = performance.now(), events: { ms: number; consoleEnd: number }[] = [], metrics: unknown[] = [];
    let text = '', error: string | undefined;
    const services = createRV64Network(fetchSource(new URL('/mirror/', location.href).href));
    services.network.addPort('smp-kuberoot', { mode: 'access' }, frame => workers[0]?.postMessage({ frame }));
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error(`kuberoot ${harts}-hart timeout after ${seconds}s`)), seconds * 1000);
        for (let hart = 0; hart < harts; hart++) {
          const w = new Worker(new URL('./smp-cpu.worker.ts', import.meta.url), { type: 'module' }); workers.push(w);
          w.onerror = e => { clearTimeout(timeout); reject(Error(e.message)); };
          w.onmessage = ({ data }) => {
            if (data.type === 'error') { clearTimeout(timeout); reject(Error(data.error)); }
            if (data.type === 'net') services.network.receive('smp-kuberoot', data.frame);
            if (data.type === 'metrics') { metrics.push({ ms: performance.now() - start, ...data }); host.rv64LatestMetrics = { harts, ...data }; }
            if (data.type === 'console') {
              text += new TextDecoder().decode(data.bytes).replace(/\r/g, ''); output.textContent = text;
              events.push({ ms: performance.now() - start, consoleEnd: text.length });
              if (text.includes('Kernel panic') || text.includes('\nRV64_PROBE_FAILED\n')) { clearTimeout(timeout); reject(Error('guest failed')); }
              if (text.includes('\nRV64_PROBE_DONE\n')) { clearTimeout(timeout); resolve(); }
            }
          };
          w.postMessage({ hart, harts, bytes, memory, module, mail, control, generations, granules, epoch, httpDisk,
            kernel: hart ? undefined : kernel, initrd: hart ? undefined : initrd,
            cmdline: 'earlycon=sbi console=hvc0 nokaslr initcall_blacklist=jent_mod_init kuberoot.root=PARTLABEL=KUBEROOT-MEDIA:/kuberoot/rootfs.squashfs kuberoot.verbose kuberoot.profile=emulator rv64.epoch=' + Math.floor(Date.now() / 1000) });
        }
      });
    } catch (e) { error = String(e); }
    finally { Atomics.store(ctl, 15, 1); workers.forEach(w => w.terminate()); services.network.removePort('smp-kuberoot'); services.dispose(); }
    const marker = (name: string) => { const at = text.indexOf('\n' + name + '\n'); return at < 0 ? null : events.find(e => e.consoleEnd >= at + name.length + 2)?.ms ?? null; };
    const duration = (a: string, b: string) => { const begin = marker(a), end = marker(b); return begin === null || end === null ? null : (end - begin) / 1000; };
    samples.push({ harts, error, coldReadySeconds: marker('RV64_NODE_READY') === null ? null : marker('RV64_NODE_READY')! / 1000,
      restoreReadySeconds: null, firstGetPodsSeconds: duration('RV64_GET_PODS_BEGIN', 'RV64_GET_PODS_END'), podStartSeconds: duration('RV64_POD_START_BEGIN', 'RV64_POD_START_END'),
      elapsedMs: performance.now() - start, events, metrics, console: text });
  }
  host.rv64Result = { type: 'smp-kuberoot', pass: samples.every(s => !(s as { error?: string }).error), samples, restored: false };
} catch (e) { host.rv64Result = { type: 'smp-kuberoot', pass: false, samples, error: String(e) }; }
