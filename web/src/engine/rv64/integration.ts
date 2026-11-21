import { RV64Machine } from './machine';
const host = globalThis as typeof globalThis & { rv64Result?: unknown };
let machine: RV64Machine | undefined;
try {
  const [kernel, initrd] = await Promise.all(['/rv64/vmlinuz.efi', '/rv64/alpine.cpio'].map(async u => (await fetch(u)).arrayBuffer()));
  machine = new RV64Machine({ id: 'integration', kernel, initrd, httpDisk: { url: '/rv64/integration-disk.bin', bytes: 512, version: 'integration-5a-v1' }, cmdline: 'earlycon=sbi console=hvc0 rdinit=/init nokaslr' });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('boot timeout')), 90000);
    let text = '';
    machine!.on(e => { if (e.t === 'rv64.console') { text += e.text; document.querySelector('#console')!.textContent = text; if (text.includes('~ #') || text.includes('/ #')) {clearTimeout(timeout);resolve();} } });
  });
  const diskRead = await machine.exec('od -An -tu1 -N1 /dev/vda');
  if (!/\b90\b/.test(diskRead.out)) throw new Error(`lazy disk read failed: ${diskRead.out}`);
  await machine.exec('echo checkpoint-before > /tmp/checkpoint');
  machine.watchPaths(['/tmp/checkpoint']);
  const before = await machine.facts();
  if (before.schema !== 'dt.facts/v1' || !before.files['/tmp/checkpoint']?.text?.includes('checkpoint-before')) throw new Error(`bad facts ${JSON.stringify(before)}`);
  const snapshot = await machine.snapshot();
  await machine.exec('echo checkpoint-after > /tmp/checkpoint');
  await machine.restore(snapshot);
  await machine.restore(snapshot); // Back-to-back requests must not lose the pause flag.
  const after = await machine.facts();
  if (after.files['/tmp/checkpoint']?.text !== before.files['/tmp/checkpoint']?.text) throw new Error('restore did not restore guest file');
  host.rv64Result = { type: 'integration', facts: before.schema, lazyDiskByte: 90, kernel: before.env.kernel, snapshotBytes: snapshot.state.length, restoredFile: after.files['/tmp/checkpoint'] };
} catch (error) { host.rv64Result = { type: 'error', error: String(error) }; }
finally { machine?.dispose(); }
