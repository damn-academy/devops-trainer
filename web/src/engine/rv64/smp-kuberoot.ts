import { createSharedCompiler } from './shared-compiler';
import type { SharedCodeCache } from './shared-code';
import { sha256 } from './snapshot';
import { BoundedHistory, ConsoleTail, jitCeilingBytes, hartBudget, pressureCeiling, HOST_BUDGET, MiB } from './host-memory';
import { sharedTable, atomicModule, HartMailboxes, RESERVATION_GRANULE } from './smp';
import { createRV64Network } from './network';
import { fetchSource } from '../labhost/mirror';
const host = globalThis as typeof globalThis & { rv64Result?: unknown; rv64LatestMetrics?: unknown; rv64HostMemory?: unknown; rv64PartialResult?: () => unknown };
const output = document.querySelector('#console')!;
const samples: unknown[] = [];
const params = new URLSearchParams(location.search);
const seconds = Number(params.get('seconds') ?? 900);
const startAfter = params.get('guestProfileStartAfter') ?? '';
const topologies = (params.get('harts') ?? '2,4').split(',').map(Number);
const memoryMb = Number(params.get('memory') ?? 1024);
const guestProfile = Number(params.get('guestProfile') ?? 0) || 0;
try {
  const configuredJitCeiling = jitCeilingBytes(params.get('jitBudgetMb'), import.meta.env.VITE_RV64_JIT_BUDGET_MB);
  if (!Number.isInteger(memoryMb) || memoryMb < 256 || memoryMb > 2048) throw Error('memory must be an integer from 256 to 2048 MiB');
  if (!topologies.length || topologies.some(h => h !== 2 && h !== 4)) throw Error('harts must be 2, 4 or 2,4');
  const [kernel, initrd, httpDisk] = await Promise.all([
    fetch('/rv64/slim-vmlinuz.efi').then(r => r.arrayBuffer()).then(b => new Uint8Array(b)),
    fetch('/rv64/slim-initrd.cpio').then(r => r.arrayBuffer()).then(b => new Uint8Array(b)),
    fetch(params.get('media') ?? '/rv64/slim-recovery-media.json').then(r => r.json()),
  ]);
  if (guestProfile && await sha256(kernel) !== 'db43c7264ee97779f9271ebb6c57e90df675d7ab768462e01115d84d4f7cd598') throw Error('task_comm offset requires the audited kernel');
  for (const harts of topologies) {
    const bytes = memoryMb * 1024 * 1024, pages = bytes / 65536 + 1;
    const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
    const module = atomicModule(pages), mail = new HartMailboxes(harts).words.buffer;
    const control = new SharedArrayBuffer(harts * 64), ctl = new Int32Array(control);
    const generations = sharedTable(bytes / 4096 * 4), epoch = performance.timeOrigin + performance.now();
    const granules = sharedTable(Math.ceil(memory.buffer.byteLength / RESERVATION_GRANULE) * 4);
    for (let h = 0; h < harts; h++) ctl[h * 16] = 1;
    const workers: Worker[] = [], start = performance.now();
    const compiler = createSharedCompiler(harts * Math.min(configuredJitCeiling, hartBudget(memory.buffer.byteLength + generations.buffer.byteLength + granules.buffer.byteLength, Array(harts).fill(128 * MiB))));
    let sharedJit: { ms: number; stats: ReturnType<SharedCodeCache['stats']> } | undefined;
    compiler.onmessage = ({ data }) => { sharedJit = { ms: performance.now() - start, stats: data.stats }; };
    const history = new BoundedHistory<unknown>(32 * MiB), tail = new ConsoleTail();
    const markers = new Map<string, number>();
    const latest = new Map<number, { wasmMemoryBytes: number; compiler: unknown }>();
    let memoryTimer: ReturnType<typeof setInterval> | undefined;
    let memoryBusy = false, active = true;
    let uaPending: Promise<{ bytes: number }> | undefined;
    let jitCeiling = configuredJitCeiling;
    let text = '', error: string | undefined;
    let profileStartedMs: number | null = guestProfile && !startAfter ? 0 : null;
    const capture = () => ({ sharedJit, harts, memoryMb, configuredJitCeiling, markers: Object.fromEntries(markers), metrics: history.entries, metricsDropped: history.dropped, metricsBytes: history.bytes, console: text, consoleDropped: tail.dropped, elapsedMs: performance.now() - start, profileStartedMs, profileStartAfter: startAfter, guestEpochOffsetMs: epoch - performance.timeOrigin - start, httpDisk });
    host.rv64PartialResult = () => ({ type: 'smp-kuberoot', pass: false, samples: [...samples, capture()] });
    const services = createRV64Network(fetchSource(new URL('/mirror/', location.href).href));
    services.network.addPort('smp-kuberoot', { mode: 'access' }, frame => workers[0]?.postMessage({ frame }));
    const reportMemory = async () => {
      if (memoryBusy || !active) return;
      memoryBusy = true; compiler.postMessage({ report: true });
      const shared = { ram: memory.buffer.byteLength, generations: generations.buffer.byteLength, granules: granules.buffer.byteLength };
      const perHart = Array.from({ length: harts }, (_, hart) => ({ hart, ...latest.get(hart) }));
      const privateBytes = perHart.map(h => h.wasmMemoryBytes ?? 128 * MiB);
      // Apply accounting limits without waiting for the optional UA measurement (which may wait for GC).
      const apply = (measured = 0) => {
        jitCeiling = pressureCeiling(jitCeiling, measured);
        const budget = hartBudget(shared.ram + shared.generations + shared.granules, privateBytes);
        compiler.postMessage({ budget: harts * Math.min(jitCeiling, budget) });
        workers.forEach(w => w.postMessage({ hostBudget: Math.min(jitCeiling, budget) }));
      };
      apply();
      const api = performance as Performance & { measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }> };
      let uaBytes: number | null = null, uaStatus = 'unavailable';
      let deadline: ReturnType<typeof setTimeout> | undefined;
      try {
        if (crossOriginIsolated && api.measureUserAgentSpecificMemory) {
          uaPending ??= api.measureUserAgentSpecificMemory().finally(() => { uaPending = undefined; });
          const result = await Promise.race([uaPending, new Promise<null>(resolve => { deadline = setTimeout(() => resolve(null), 5000); })]);
          uaBytes = result?.bytes ?? null; uaStatus = result ? 'ok' : 'timeout';
        }
      } catch (e) { uaStatus = String(e); }
      finally { clearTimeout(deadline); memoryBusy = false; }
      if (!active) return;
      if (uaBytes !== null) apply(uaBytes);
      const record = { type: 'host-memory', sharedJit, configuredJitCeiling, jitCeiling, ms: performance.now() - start, budgetBytes: HOST_BUDGET, uaBytes, uaStatus, shared, perHart, consoleLength: text.length, consoleDropped: tail.dropped, metricsBytes: history.bytes, metricsDropped: history.dropped };
      host.rv64HostMemory = record;
      history.push(record);
    };
    memoryTimer = setInterval(() => { void reportMemory(); }, 30000);
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error(`kuberoot ${harts}-hart timeout after ${seconds}s`)), seconds * 1000);
        compiler.onerror = e => { clearTimeout(timeout); reject(Error(e.message)); };
        for (let hart = 0; hart < harts; hart++) {
          const w = new Worker(new URL('./smp-cpu.worker.ts', import.meta.url), { type: 'module' }); workers.push(w);
          w.onerror = e => { clearTimeout(timeout); reject(Error(e.message)); };
          w.onmessage = ({ data }) => {
            if (data.type === 'error') { clearTimeout(timeout); reject(Error(data.error)); }
            if (data.type === 'net') services.network.receive('smp-kuberoot', data.frame);
            if (data.type === 'metrics') { history.push({ ms: performance.now() - start, ...data }); latest.set(data.hart, { wasmMemoryBytes: data.wasmMemoryBytes, compiler: data.compiler }); host.rv64LatestMetrics = { harts, ...data }; }
            if (data.type === 'console') {
              const chunk = new TextDecoder().decode(data.bytes).replace(/\r/g, '');
              const scan = text.slice(-256) + chunk;
              for (const match of scan.matchAll(/(?:^|\n)(RV64_[A-Z_]+)\n/g)) if (!markers.has(match[1]!)) markers.set(match[1]!, performance.now() - start);
              tail.append(chunk); text = tail.text; output.textContent = text;
              if (guestProfile && profileStartedMs === null && scan.includes('\n' + startAfter + '\n')) {
                profileStartedMs = performance.now() - start;
                workers.forEach(worker => worker.postMessage({ guestProfileStart: true }));
              }
              if (scan.includes('Kernel panic') || scan.includes('\nRV64_PROBE_FAILED\n')) { clearTimeout(timeout); reject(Error('guest failed')); }
              if (scan.includes('\nRV64_PROBE_DONE\n')) { clearTimeout(timeout); resolve(); }
            }
          };
          const compilerPort = compiler.connect(hart);
          w.postMessage({ compilerPort, hostBudget: Math.min(jitCeiling, hartBudget(memory.buffer.byteLength + generations.buffer.byteLength + granules.buffer.byteLength, Array(harts).fill(128 * MiB))), hart, harts, bytes, memory, module, mail, control, generations, granules, epoch, httpDisk, guestProfile, guestProfileDeferred: !!startAfter, guestProfileTaskCommOffset: guestProfile ? 1704 : 0,
            kernel: hart ? undefined : kernel, initrd: hart ? undefined : initrd,
            cmdline: 'earlycon=sbi console=hvc0 nokaslr initcall_blacklist=jent_mod_init kuberoot.root=PARTLABEL=KUBEROOT-MEDIA:/kuberoot/rootfs.squashfs kuberoot.verbose kuberoot.profile=emulator rv64.epoch=' + Math.floor(Date.now() / 1000) }, [compilerPort]);
        }
      });
    } catch (e) { error = String(e); }
    finally { active = false; clearInterval(memoryTimer); Atomics.store(ctl, 15, 1); workers.forEach(w => w.terminate()); compiler.terminate(); services.network.removePort('smp-kuberoot'); services.dispose(); }
    const marker = (name: string) => markers.get(name) ?? null;
    const duration = (a: string, b: string) => { const begin = marker(a), end = marker(b); return begin === null || end === null ? null : (end - begin) / 1000; };
    samples.push({ ...capture(), error, coldReadySeconds: marker('RV64_NODE_READY') === null ? null : marker('RV64_NODE_READY')! / 1000,
      restoreReadySeconds: null, firstGetPodsSeconds: duration('RV64_GET_PODS_BEGIN', 'RV64_GET_PODS_END'), podStartSeconds: duration('RV64_POD_START_BEGIN', 'RV64_POD_START_END'),
    });
  }
  host.rv64Result = { type: 'smp-kuberoot', pass: samples.every(s => !(s as { error?: string }).error), samples, restored: false };
} catch (e) { host.rv64Result = { type: 'smp-kuberoot', pass: false, samples, error: String(e) }; }
