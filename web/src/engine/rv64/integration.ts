import { RV64Machine } from './machine';
import { createRV64Network } from './network';
const host = globalThis as typeof globalThis & { rv64Result?: unknown };
let machine: RV64Machine | undefined;
const services = createRV64Network(async path => path === 'probe.txt' ? { body: new TextEncoder().encode('RV64_LOCAL_HTTP_OK\n') } : null);
try {
  const [kernel, initrd] = await Promise.all(['/rv64/vmlinuz.efi', '/rv64/alpine.cpio'].map(async u => (await fetch(u)).arrayBuffer()));
  machine = new RV64Machine({ id: 'integration', kernel, initrd, network: services.network, httpDisk: { url: '/rv64/integration-disk.bin', bytes: 512, version: 'integration-5a-v1' }, cmdline: 'earlycon=sbi console=hvc0 rdinit=/init nokaslr' });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('boot timeout')), 90000);
    let text = '';
    machine!.on(e => { if (e.t === 'rv64.console') { text += e.text; document.querySelector('#console')!.textContent = text; if (text.includes('~ #') || text.includes('/ #')) {clearTimeout(timeout);resolve();} } });
  });
  const diskRead = await machine.exec('od -An -tu1 -N1 /dev/vda');
  if (!/\b90\b/.test(diskRead.out)) throw new Error(`lazy disk read failed: ${diskRead.out}`);
  const net = await machine.exec('ip link set eth0 up && udhcpc -i eth0 -n -q && ip -4 addr show eth0 && nslookup mirror.lab 10.0.0.1 && wget -qO- http://mirror.lab/probe.txt');
  if (net.exit || !net.out.includes('10.0.0.10') || !net.out.includes('RV64_LOCAL_HTTP_OK')) throw new Error(`network failed: ${net.out}`);
  await machine.exec('echo checkpoint-before > /tmp/checkpoint');
  machine.watchPaths(['/tmp/checkpoint']);
  const before = await machine.facts();
  if (before.schema !== 'dt.facts/v1' || !before.files['/tmp/checkpoint']?.text?.includes('checkpoint-before')) throw new Error(`bad facts ${JSON.stringify(before)}`);
  const snapshot = await machine.snapshot();
  snapshot.capturedAt! -= 60000; // Real suspension, not a scaled guest clock.
  await machine.exec('echo checkpoint-after > /tmp/checkpoint');
  await machine.restore(snapshot);
  await machine.restore(snapshot); // Back-to-back requests must not lose the pause flag.
  const after = await machine.facts();
  if (after.files['/tmp/checkpoint']?.text !== before.files['/tmp/checkpoint']?.text) throw new Error('restore did not restore guest file');
  const clock = await machine.exec("cat /proc/uptime");
  const uptime = Number(clock.out.match(/\n(\d+\.\d+) /)?.[1]);
  if (!(uptime >= 60)) throw new Error(`Restore clock did not advance: ${clock.out}`);
  await machine.exportSnapshot('/snapshot-upload/');
  machine.dispose();
  const restoreStart = performance.now();
  machine = new RV64Machine({ id: 'integration', kernel, initrd, network: services.network,
    httpDisk: { url: '/rv64/integration-disk.bin', bytes: 512, version: 'integration-5a-v1' },
    snapshotURL: '/rv64/snapshots/integration/paged.json', cmdline: 'earlycon=sbi console=hvc0 rdinit=/init nokaslr' });
  await machine.ready;
  const restoreInitializedMs = performance.now() - restoreStart;
  const lazy = await machine.exec('cat /tmp/checkpoint; od -An -tu1 -N1 /dev/vda; wget -qO- http://mirror.lab/probe.txt');
  if (lazy.exit || !lazy.out.includes('checkpoint-before') || !/\b90\b/.test(lazy.out) || !lazy.out.includes('RV64_LOCAL_HTTP_OK')) throw new Error(`Paged restore failed: ${lazy.out}`);
  const pagedStats = machine.executionStats();
  if (pagedStats.jitRetired <= 0) throw new Error('Snapshot startup left JIT disabled');
  host.rv64Result = { type: 'integration', restoreInitializedMs, pagedStats, restoredUptime: uptime, network: net.out, facts: before.schema, lazyDiskByte: 90, kernel: before.env.kernel, snapshotBytes: snapshot.state.length, restoredFile: after.files['/tmp/checkpoint'] };
} catch (error) { host.rv64Result = { type: 'error', error: String(error) }; }
finally { machine?.dispose(); services.dispose(); }
