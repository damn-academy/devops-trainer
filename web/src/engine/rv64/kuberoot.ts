import { RV64Machine } from './machine';
import { createRV64Network } from './network';
import { fetchSource } from '../labhost/mirror';

const result = globalThis as typeof globalThis & { rv64Result?: unknown };
const services = createRV64Network(fetchSource(new URL('/mirror/', location.href).href));
let machine: RV64Machine | undefined;
const events: unknown[] = [];
let text = '';
let readyMs: number | undefined;
try {
  const [kernel, initrd, media] = await Promise.all([
    fetch('/rv64/vmlinuz.efi').then(r => { if (!r.ok) throw new Error('missing kernel'); return r.arrayBuffer(); }),
    fetch('/rv64/kuberoot-initrd.cpio').then(r => { if (!r.ok) throw new Error('missing initrd'); return r.arrayBuffer(); }),
    fetch('/rv64/kuberoot-media.json').then(r => { if (!r.ok) throw new Error('missing media manifest'); return r.json(); }),
  ]);
  const start = performance.now();
  services.dhcp.on(e => events.push({ ms: performance.now() - start, dhcp: e }));
  machine = new RV64Machine({ id: 'kuberoot', kernel, initrd, memoryMB: 1024,
    network: services.network, httpDisk: media,
    cmdline: 'earlycon=sbi console=hvc0 nokaslr kuberoot.root=PARTLABEL=KUBEROOT-MEDIA:/kuberoot/rootfs.squashfs kuberoot.verbose' });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('kuberoot probe timeout')), 900000);
    machine!.on(e => {
      if (e.t === 'rv64.error') { clearTimeout(timer); reject(new Error(String(e.error))); }
      if (e.t !== 'rv64.console') return;
      text += String(e.text);
      document.querySelector('#console')!.textContent = text;
      if (readyMs === undefined && text.includes('\nRV64_NODE_READY\n')) readyMs = performance.now() - start;
      if (text.includes('\nRV64_PROBE_DONE\n')) { clearTimeout(timer); resolve(); }
    });
  });
  if (readyMs === undefined) throw new Error('probe completed without node readiness');
  result.rv64Result = { type: 'kuberoot', execution: machine.executionStats(), bootReadyMs: readyMs, totalMs: performance.now() - start, events, console: text };
} catch (error) { result.rv64Result = { type: 'error', error: String(error), execution: machine?.executionStats(), bootReadyMs: readyMs, events, console: text }; }
finally { machine?.dispose(); services.dispose(); }
