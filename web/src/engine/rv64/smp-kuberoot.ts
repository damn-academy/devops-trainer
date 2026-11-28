import { readObject, storeObject, storeRam, validateCheckpoint, type SMPCheckpoint } from './smp-checkpoint';
import { restoreTimeOffset } from './restore-clock';
import { createSharedCompiler } from './shared-compiler';
import type { SharedCodeCache } from './shared-code';
import { sha256 } from './snapshot';
import { BoundedHistory, ConsoleTail, jitCeilingBytes, hartBudget, pressureCeiling, HOST_BUDGET, MiB } from './host-memory';
import { sharedTable, atomicModule, HartMailboxes, granuleTableBytes } from './smp';
import { createRV64Network } from './network';
import { fetchSource } from '../labhost/mirror';
const host = globalThis as typeof globalThis & { rv64Result?: unknown; rv64LatestMetrics?: unknown; rv64HostMemory?: unknown; rv64PartialResult?: () => unknown };
const output = document.querySelector('#console')!;
const samples: unknown[] = [];
const pageStarted = performance.now();
const params = new URLSearchParams(location.search);
const seconds = Number(params.get('seconds') ?? 900);
const startAfter = params.get('guestProfileStartAfter') ?? '';
const topologies = (params.get('harts') ?? '2,4').split(',').map(Number);
const memoryMb = Number(params.get('memory') ?? 1024);
const restoreURL = params.get('restore');
const capturing = params.get('capture') === '1';
const guestProfile = Number(params.get('guestProfile') ?? 0) || 0;
try {
  if ((capturing || restoreURL) && topologies.length !== 1) throw Error('checkpoint requires one topology');
  if (capturing && restoreURL) throw Error('capture and restore are exclusive');
  if (seconds < 0 || !Number.isFinite(seconds)) throw Error('invalid seconds');
  const wasmSha256 = await sha256(new Uint8Array(await (await fetch('/rv64/rv64_core_bg.wasm')).arrayBuffer()));
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
    const generations = sharedTable(bytes / 4096 * 4);
    let epoch = performance.timeOrigin + performance.now();
    let restored: SMPCheckpoint | undefined;
    const initialBlobs: Uint8Array[] = []; let initialDevice: Uint8Array | undefined;
    if (restoreURL) {
      const base = new URL(restoreURL, location.href).href;
      const response = await fetch(base); if (!response.ok) throw Error('SMP manifest unavailable');
      restored = await response.json() as SMPCheckpoint;
      validateCheckpoint(restored, harts, bytes, wasmSha256, httpDisk);
      const view = new Uint8Array(memory.buffer, 64, bytes);
      for (const chunk of restored.ram) view.set(await readObject(base, chunk.object), chunk.offset);
      new Uint8Array(control).set(await readObject(base, restored.control));
      new Uint8Array(mail).set(await readObject(base, restored.mail));
      for (const ref of restored.cpus) initialBlobs.push(await readObject(base, ref));
      initialDevice = await readObject(base, restored.device);
      const policy = params.get('clock') ?? 'continuous';
      if (policy !== 'continuous' && policy !== 'elapsed') throw Error('invalid restore clock');
      epoch = -restoreTimeOffset(restored.ticks, restored.capturedAt, policy, Date.now(), performance.timeOrigin + performance.now()) / 10000;
    }
    const snap = new SharedArrayBuffer((2 + 2 * harts) * 4), sv = new Int32Array(snap);
    const snapshots = new Map<number, { blob: Uint8Array; deviceBlob?: Uint8Array; ticks: number }>();
    let snapshotRequested = false, snapshotSaved = false;
    const write = async (name: string, data: Uint8Array) => {
      const r = await fetch('/snapshot-upload/' + name, { method: 'POST', body: data as Uint8Array<ArrayBuffer> });
      if (!r.ok) throw Error(`snapshot upload ${r.status}`);
    };
    const granules = sharedTable(granuleTableBytes(memory.buffer.byteLength));
    if (!restored) for (let h = 0; h < harts; h++) ctl[h * 16] = 1;
    const workers: Worker[] = [], start = performance.now();
    // sharedJit=0 (or VITE_RV64_SHARED_JIT=0) keeps one private compiler per hart, the R11 path.
    const shareJit = (params.get('sharedJit') ?? import.meta.env.VITE_RV64_SHARED_JIT ?? '1') !== '0';
    const compiler = shareJit ? createSharedCompiler(harts * Math.min(configuredJitCeiling, hartBudget(memory.buffer.byteLength + generations.buffer.byteLength + granules.buffer.byteLength, Array(harts).fill(128 * MiB))), harts) : undefined;
    let sharedJit: { ms: number; stats: ReturnType<SharedCodeCache['stats']> } | undefined;
    if (compiler) compiler.onmessage = ({ data }) => { sharedJit = { ms: performance.now() - start, stats: data.stats }; };
    const history = new BoundedHistory<unknown>(32 * MiB), tail = new ConsoleTail();
    const markers = new Map<string, number>();
    const latest = new Map<number, { wasmMemoryBytes: number; compiler: unknown }>();
    let memoryTimer: ReturnType<typeof setInterval> | undefined;
    let memoryBusy = false, active = true;
    let uaPending: Promise<{ bytes: number }> | undefined;
    let jitCeiling = configuredJitCeiling;
    let text = '', error: string | undefined;
    let profileStartedMs: number | null = guestProfile && !startAfter ? 0 : null;
    const capture = () => ({ snapshotSaved, restored: !!restored, restoreClock: params.get('clock') ?? 'continuous', pageElapsedMs: performance.now() - pageStarted, restoreLoadMs: start - pageStarted, sharedJit, harts, memoryMb, configuredJitCeiling, markers: Object.fromEntries(markers), metrics: history.entries, metricsDropped: history.dropped, metricsBytes: history.bytes, console: text, consoleDropped: tail.dropped, elapsedMs: performance.now() - start, profileStartedMs, profileStartAfter: startAfter, guestEpochOffsetMs: epoch - performance.timeOrigin - start, httpDisk });
    host.rv64PartialResult = () => ({ type: 'smp-kuberoot', pass: false, samples: [...samples, capture()] });
    const commandForm = document.querySelector<HTMLFormElement>('#command');
    const sendCommand = (event: Event) => {
      event.preventDefault();
      const input = document.querySelector<HTMLInputElement>('#input');
      if (input) { workers[0]?.postMessage({ input: new TextEncoder().encode(input.value + '\n') }); input.value = ''; }
    };
    commandForm?.addEventListener?.('submit', sendCommand);
    const services = createRV64Network(fetchSource(new URL('/mirror/', location.href).href));
    services.network.addPort('smp-kuberoot', { mode: 'access' }, frame => workers[0]?.postMessage({ frame }));
    const reportMemory = async () => {
      if (memoryBusy || !active) return;
      memoryBusy = true; compiler?.postMessage({ report: true });
      const shared = { ram: memory.buffer.byteLength, generations: generations.buffer.byteLength, granules: granules.buffer.byteLength };
      const perHart = Array.from({ length: harts }, (_, hart) => ({ hart, ...latest.get(hart) }));
      const privateBytes = perHart.map(h => h.wasmMemoryBytes ?? 128 * MiB);
      // Apply accounting limits without waiting for the optional UA measurement (which may wait for GC).
      const apply = (measured = 0) => {
        jitCeiling = pressureCeiling(jitCeiling, measured);
        const budget = hartBudget(shared.ram + shared.generations + shared.granules, privateBytes);
        compiler?.postMessage({ budget: harts * Math.min(jitCeiling, budget) });
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
        const timeout = seconds ? setTimeout(() => reject(Error(`kuberoot ${harts}-hart timeout after ${seconds}s`)), seconds * 1000) : undefined;
        if (compiler) compiler.onerror = e => { clearTimeout(timeout); reject(Error(e.message)); };
        for (let hart = 0; hart < harts; hart++) {
          const w = new Worker(new URL('./smp-cpu.worker.ts', import.meta.url), { type: 'module' }); workers.push(w);
          w.onerror = e => { clearTimeout(timeout); reject(Error(e.message)); };
          w.onmessage = ({ data }) => {
            if (data.type === 'snapshot') {
              snapshots.set(data.hart, data);
              if (snapshots.size === harts) void (async () => {
                const capturedAt = Date.now();
                const cpus = [];
                for (let h = 0; h < harts; h++) cpus.push(await storeObject(snapshots.get(h)!.blob, write));
                const device = await storeObject(snapshots.get(0)!.deviceBlob!, write);
                const checkpoint: SMPCheckpoint = {
                  format: 'dt.rv64.smp/v1', harts, bytes, wasmSha256, disk: httpDisk, capturedAt,
                  ticks: Math.max(...[...snapshots.values()].map(s => s.ticks)), marker: 'RV64_NODE_REGISTERED_READY', cpus, device,
                  control: await storeObject(new Uint8Array(control).slice(), write),
                  mail: await storeObject(new Uint8Array(mail).slice(), write),
                  ram: await storeRam(new Uint8Array(memory.buffer, 64, bytes), write),
                };
                validateCheckpoint(checkpoint, harts, bytes, wasmSha256, httpDisk);
                if (!active) throw Error('capture cancelled');
                await write('smp.json', new TextEncoder().encode(JSON.stringify(checkpoint)));
                snapshotSaved = true; clearTimeout(timeout); resolve();
              })().catch(e => { clearTimeout(timeout); reject(e); });
            }
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
              if (capturing && !snapshotRequested && markers.has('RV64_NODE_REGISTERED_READY')) {
                snapshotRequested = true; Atomics.store(sv, 0, 1);
                workers.forEach(worker => worker.postMessage({ snapshot: 1 }));
              }
              if (scan.includes('Kernel panic') || scan.includes('\nRV64_PROBE_FAILED\n')) { clearTimeout(timeout); reject(Error('guest failed')); }
              if (!capturing && scan.includes('\nRV64_PROBE_DONE\n')) {
                clearTimeout(timeout);
                if (params.get('keep') === '1') host.rv64Result = { type: 'smp-kuberoot', pass: true, restored: !!restored, samples: [capture()] };
                else resolve();
              }
            }
          };
          const compilerPort = shareJit ? compiler!.connect(hart) : undefined;
          w.postMessage({ snap, initialRestore: restored ? { blob: initialBlobs[hart], deviceBlob: hart === 0 ? initialDevice : undefined } : undefined, compilerPort, hostBudget: Math.min(jitCeiling, hartBudget(memory.buffer.byteLength + generations.buffer.byteLength + granules.buffer.byteLength, Array(harts).fill(128 * MiB))), hart, harts, bytes, memory, module, mail, control, generations, granules, epoch, httpDisk, guestProfile, guestProfileDeferred: !!startAfter, guestProfileTaskCommOffset: guestProfile ? 1704 : 0,
            kernel: hart ? undefined : kernel, initrd: hart ? undefined : initrd,
            cmdline: 'earlycon=sbi console=hvc0 nokaslr initcall_blacklist=jent_mod_init kuberoot.root=PARTLABEL=KUBEROOT-MEDIA:/kuberoot/rootfs.squashfs kuberoot.verbose kuberoot.profile=emulator rv64.epoch=' + Math.floor(Date.now() / 1000) }, compilerPort ? [compilerPort] : []);
        }
      });
    } catch (e) { error = String(e); }
    finally { commandForm?.removeEventListener?.('submit', sendCommand); active = false; clearInterval(memoryTimer); Atomics.store(ctl, 15, 1); workers.forEach(w => w.terminate()); compiler?.terminate(); services.network.removePort('smp-kuberoot'); services.dispose(); }
    const marker = (name: string) => markers.get(name) ?? null;
    const duration = (a: string, b: string) => { const begin = marker(a), end = marker(b); return begin === null || end === null ? null : (end - begin) / 1000; };
    samples.push({ ...capture(), error, coldReadySeconds: marker('RV64_NODE_READY') === null ? null : marker('RV64_NODE_READY')! / 1000,
      restoreReadySeconds: restored && marker('RV64_RECHECK_READY') !== null ? (marker('RV64_RECHECK_READY')! + start - pageStarted) / 1000 : null, firstGetPodsSeconds: duration('RV64_GET_PODS_BEGIN', 'RV64_GET_PODS_END'), podStartSeconds: duration('RV64_POD_START_BEGIN', 'RV64_POD_START_END'),
    });
  }
  host.rv64Result = { type: 'smp-kuberoot', pass: samples.every(s => !(s as { error?: string }).error), samples, restored: !!restoreURL };
} catch (e) { host.rv64Result = { type: 'smp-kuberoot', pass: false, samples, error: String(e) }; }
