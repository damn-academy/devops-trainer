import { BoundedHistory, ConsoleTail, MiB } from './host-memory';
import { loadSnapshot, sha256 } from './snapshot';
import { RV64Machine } from './machine';
import { createRV64Network } from './network';
import { fetchSource } from '../labhost/mirror';

const result = globalThis as typeof globalThis & { rv64Result?: unknown };
const services = createRV64Network(fetchSource(new URL('/mirror/', location.href).href));
let machine: RV64Machine | undefined;
const eventHistory = new BoundedHistory<unknown>(MiB);
const sampleHistory = new BoundedHistory<unknown>(32 * MiB);
const events = eventHistory.entries, samples = sampleHistory.entries;
const tail = new ConsoleTail();
const params = new URLSearchParams(location.search);
const memoryMB = Number(params.get('memory') ?? 768);
let text = '';
let readyMs: number | undefined;
let engineReadyMs: number | undefined;
const requestedAt = performance.now();
try {
  if (!Number.isInteger(memoryMB) || memoryMB < 32 || memoryMB > 1024) throw new Error('memory must be 32..1024 MiB');
  const [kernel, initrd, media] = await Promise.all([
    fetch('/rv64/slim-vmlinuz.efi').then(r => { if (!r.ok) throw new Error('missing kernel'); return r.arrayBuffer(); }),
    fetch('/rv64/slim-initrd.cpio').then(r => { if (!r.ok) throw new Error('missing initrd'); return r.arrayBuffer(); }),
    fetch(params.get('media') ?? (params.has('capture') || params.has('restore') ? '/rv64/slim-snapshot-media.json' : '/rv64/slim-media.json')).then(r => { if (!r.ok) throw new Error('missing media manifest'); return r.json(); }),
  ]);
  const profileKernel = Number(params.get('guestProfile')) > 0;
  if (profileKernel && await sha256(new Uint8Array(kernel)) !== 'db43c7264ee97779f9271ebb6c57e90df675d7ab768462e01115d84d4f7cd598') throw new Error('task_comm offset requires the audited kernel');
  const start = requestedAt;
  const wasmSha256 = await sha256(new Uint8Array(await (await fetch('/rv64/rv64_core_bg.wasm')).arrayBuffer()));
  const snapshotURL = params.get('restore') ?? undefined;
  const snapshot = snapshotURL && !snapshotURL.endsWith('/paged.json') ? await loadSnapshot(snapshotURL, memoryMB, wasmSha256) : undefined;
  const loadedMs = performance.now() - start;
  let saved = false;
  let savedManifest: unknown;
  let saving: Promise<void> | undefined;
  services.dhcp.on(e => eventHistory.push({ ms: performance.now() - start, dhcp: e }));
  machine = new RV64Machine({ id: 'kuberoot', kernel, initrd, memoryMB,
    guestProfileInterval: Number(params.get('guestProfile') ?? 0), guestProfileTaskCommOffset: profileKernel ? 1704 : 0, restoreClock: params.get('clock') === 'continuous' ? 'continuous' : 'elapsed', network: services.network, httpDisk: media, snapshot, snapshotURL: snapshotURL?.endsWith('/paged.json') ? snapshotURL : undefined, jitThreshold: Number(params.get('jit') ?? 50),
    cmdline: 'earlycon=sbi console=hvc0 nokaslr kuberoot.root=PARTLABEL=KUBEROOT-MEDIA:/kuberoot/rootfs.squashfs kuberoot.verbose kuberoot.profile=emulator rv64.epoch=' + Math.floor(Date.now() / 1000) });
  Object.assign(globalThis, { rv64Machine: machine });
  void machine.ready.then(() => { engineReadyMs = performance.now() - start; }, () => {});
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('kuberoot probe timeout')), Number(params.get('seconds') ?? 900) * 1000);
    machine!.on(e => {
      if (e.t === 'rv64.metrics') { sampleHistory.push(e.metrics); Object.assign(globalThis, { rv64LatestMetrics: e.metrics }); document.querySelector('#metrics')!.textContent = JSON.stringify(e.metrics, null, 2); return; }
      if (e.t === 'rv64.error') { clearTimeout(timer); reject(new Error(String(e.error))); }
      if (e.t !== 'rv64.console') return;
      const consoleStart = tail.total;
      tail.append(String(e.text)); text = tail.text;
      eventHistory.push({ ms: performance.now() - start, consoleStart, consoleEnd: tail.total });
      document.querySelector('#console')!.textContent = text;
      if (readyMs === undefined && (snapshotURL
        ? text.includes('\nRV64_RECHECK_BEGIN\n') && /\nkuberoot-\S+\s+Ready\s/.test(text)
        : text.includes('\nRV64_NODE_READY\n'))) readyMs = performance.now() - start;
      if (params.has('capture') && readyMs !== undefined && !saved) {
        saved = true;
        saving = (async () => {
          savedManifest = await machine!.exportSnapshot('/snapshot-upload/', true);
          clearTimeout(timer); resolve();
        })();
        saving.catch(error => { clearTimeout(timer); reject(error); });
      }
      if (text.includes('\nRV64_PROBE_FAILED\n')) { clearTimeout(timer); reject(new Error('kuberoot probe command failed')); }
      if (text.includes('\nRV64_PROBE_DONE\n')) { clearTimeout(timer); resolve(); }
    });
  });
  if (readyMs === undefined) throw new Error('probe completed without node readiness');
  await saving;
  if (Number(params.get('guestProfile')) > 0) await new Promise(resolve => setTimeout(resolve, 1100));
  const totalMs = performance.now() - start;
  const command = (globalThis as typeof globalThis & { rv64PostProbeCommand?: string }).rv64PostProbeCommand;
  let postProbe: unknown;
  if (command) {
    try { postProbe = await machine.exec(command); }
    catch (error) { postProbe = { error: String(error) }; }
  }
  result.rv64Result = { type: 'kuberoot', profileRequestedAt: requestedAt, memoryMB, postProbe, snapshotManifest: savedManifest, loadedMs, engineReadyMs, restored: !!snapshotURL, execution: machine.executionStats(), bootReadyMs: readyMs, restoreReadyMs: snapshotURL ? readyMs : undefined, totalMs, events, samples, eventsDropped: eventHistory.dropped, samplesDropped: sampleHistory.dropped, consoleDropped: tail.dropped, console: text };
} catch (error) { result.rv64Result = { type: 'error', profileRequestedAt: requestedAt, memoryMB, error: String(error), execution: machine?.executionStats(), bootReadyMs: readyMs, engineReadyMs, events, samples, eventsDropped: eventHistory.dropped, samplesDropped: sampleHistory.dropped, consoleDropped: tail.dropped, console: text }; }
finally { machine?.dispose(); services.dispose(); }
