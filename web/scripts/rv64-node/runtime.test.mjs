import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('Node adapter: worker TS resolution, shared Wasm atomics, local Range and atomic upload', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rv64-node-test-'));
  process.env.RV64_PUBLIC = root; process.env.RV64_OUTPUT = join(root, 'out');
  await mkdir(process.env.RV64_OUTPUT);
  await writeFile(join(root, 'disk'), new Uint8Array([1, 2, 3, 4]));
  await import('./runtime.mjs');
  const worker = new Worker(new URL('./fixture.ts', import.meta.url));
  try {
    const reply = await new Promise((resolve, reject) => {
      worker.onmessage = ({ data }) => resolve(data); worker.onerror = e => reject(Error(e.message));
      worker.postMessage({ value: 42 });
    });
    assert.deepEqual(reply, { value: 42, env: '0' });
    const compiler = new Worker(new URL('../../src/engine/rv64/compiler.worker.ts', import.meta.url));
    try {
      const compiled = await new Promise((resolve, reject) => {
        compiler.onmessage = ({ data }) => resolve(data); compiler.onerror = e => reject(Error(e.message));
        compiler.postMessage({ blocks: [{ id: 0, pc: 0x80000000n, words: [0x13, 4] }],
          shared: { bytes: 32 * 1048576, ramPages: 513, generationPages: 1, granulePages: 17 } });
      });
      assert.equal(compiled.error, undefined);
      assert.ok(compiled.module instanceof WebAssembly.Module);
    } finally { await compiler.terminate(); }
    const r = await fetch('/disk', { headers: { Range: 'bytes=1-2' } });
    assert.equal(r.status, 206); assert.equal(r.headers.get('Content-Range'), 'bytes 1-2/4');
    assert.deepEqual([...new Uint8Array(await r.arrayBuffer())], [2, 3]);
    await assert.rejects(fetch('https://example.org/disk'), /External fetch/);
    await assert.rejects(fetch('/disk', { headers: { Range: 'bytes=1-8' } }), /outside/);
    await fetch('/snapshot-upload/smp.json', { method: 'POST', body: new TextEncoder().encode('{}') });
    assert.equal(await readFile(join(root, 'out/smp.json'), 'utf8'), '{}');
    // Load the complete harness import graph, stop at configuration validation.
    globalThis.document = { querySelector: () => ({ textContent: '' }) };
    globalThis.location = new URL('http://rv64.local/?memory=1');
    await import('../../src/engine/rv64/smp-kuberoot.ts');
    assert.match(globalThis.rv64Result.error, /memory must/);
  } finally { await worker.terminate(); await rm(root, { recursive: true }); }
});
