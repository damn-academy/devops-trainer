import { loadSnapshot, sha256 } from './snapshot';
import { RV64Machine } from './machine';
import { createRV64Network } from './network';
import { fetchSource } from '../labhost/mirror';

const result = globalThis as typeof globalThis & { rv64Result?: unknown };
const services = createRV64Network(fetchSource(new URL('/mirror/', location.href).href));
let machine: RV64Machine | undefined;
const events: unknown[] = [];
const samples: unknown[] = [];
const params = new URLSearchParams(location.search);
let text = '';
let readyMs: number | undefined;
let engineReadyMs: number | undefined;
const requestedAt = performance.now();
try {
  const [kernel, initrd, media] = await Promise.all([
    fetch('/rv64/slim-vmlinuz.efi').then(r => { if (!r.ok) throw new Error('missing kernel'); return r.arrayBuffer(); }),
    fetch('/rv64/slim-initrd.cpio').then(r => { if (!r.ok) throw new Error('missing initrd'); return r.arrayBuffer(); }),
    fetch(params.has('capture') || params.has('restore') ? '/rv64/slim-snapshot-media.json' : '/rv64/slim-media.json').then(r => { if (!r.ok) throw new Error('missing media manifest'); return r.json(); }),
  ]);
  const start = requestedAt;
  const wasmSha256 = await sha256(new Uint8Array(await (await fetch('/rv64/rv64_core_bg.wasm')).arrayBuffer()));
  const snapshotURL = params.get('restore') ?? undefined;
  const snapshot = snapshotURL && !snapshotURL.endsWith('/paged.json') ? await loadSnapshot(snapshotURL, 768, wasmSha256) : undefined;
  const loadedMs = performance.now() - start;
  let saved = false;
  let savedManifest: unknown;
  let saving: Promise<void> | undefined;
  services.dhcp.on(e => events.push({ ms: performance.now() - start, dhcp: e }));
  machine = new RV64Machine({ id: 'kuberoot', kernel, initrd, memoryMB: 768,
    network: services.network, httpDisk: media, snapshot, snapshotURL: snapshotURL?.endsWith('/paged.json') ? snapshotURL : undefined, jitThreshold: Number(params.get('jit') ?? 50),
    cmdline: 'earlycon=sbi console=hvc0 nokaslr kuberoot.root=PARTLABEL=KUBEROOT-MEDIA:/kuberoot/rootfs.squashfs kuberoot.verbose kuberoot.profile=emulator rv64.epoch=' + Math.floor(Date.now() / 1000) });
  void machine.ready.then(() => { engineReadyMs = performance.now() - start; }, () => {});
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('kuberoot probe timeout')), Number(params.get('seconds') ?? 900) * 1000);
    machine!.on(e => {
      if (e.t === 'rv64.metrics') { samples.push(e.metrics); Object.assign(globalThis, { rv64LatestMetrics: e.metrics }); document.querySelector('#metrics')!.textContent = JSON.stringify(e.metrics, null, 2); return; }
      if (e.t === 'rv64.error') { clearTimeout(timer); reject(new Error(String(e.error))); }
      if (e.t !== 'rv64.console') return;
      text += String(e.text);
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
  result.rv64Result = { type: 'kuberoot', snapshotManifest: savedManifest, loadedMs, engineReadyMs, restored: !!snapshotURL, execution: machine.executionStats(), bootReadyMs: readyMs, restoreReadyMs: snapshotURL ? readyMs : undefined, totalMs: performance.now() - start, events, samples, console: text };
} catch (error) { result.rv64Result = { type: 'error', error: String(error), execution: machine?.executionStats(), bootReadyMs: readyMs, engineReadyMs, events, samples, console: text }; }
finally { machine?.dispose(); services.dispose(); }
