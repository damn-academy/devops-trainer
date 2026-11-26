import './loader.mjs';
import { Worker as Thread, parentPort, workerData, isMainThread } from 'node:worker_threads';
import { open, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
globalThis.self = globalThis;
globalThis.__rv64Env = { VITE_RV64_SHARED_JIT: '0', VITE_RV64_JIT_BUDGET_MB: process.env.VITE_RV64_JIT_BUDGET_MB ?? '64' };
globalThis.location = new URL('http://rv64.local/');
globalThis.crossOriginIsolated = true;
globalThis.Worker = class {
  constructor(url) {
    this.thread = new Thread(new URL('./runtime.mjs', import.meta.url), { workerData: { url: url.href }, resourceLimits: { maxOldGenerationSizeMb: 96 } });
    this.thread.on('message', data => {
      if (isMainThread && data.type === 'console') process.stdout.write(data.bytes);
      this.onmessage?.({ data });
    });
    this.thread.on('error', error => this.onerror?.({ message: error.stack }));
    this.thread.on('exit', code => { if (code && !this.stopping) this.onerror?.({ message: `worker exited ${code}` }); });
  }
  postMessage(data, transfer) { this.thread.postMessage(data, transfer); }
  terminate() { this.stopping = true; return this.thread.terminate(); }
};
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(input instanceof Request ? input.url : input, location.href);
  if (url.pathname.startsWith('/snapshot-upload/')) {
    const name = url.pathname.split('/').pop();
    if (options.method !== 'POST' || !/^(?:[a-f0-9]{64}\.bin|smp\.json)$/.test(name) || !process.env.RV64_OUTPUT) throw Error('Invalid snapshot write');
    const path = resolve(process.env.RV64_OUTPUT, name);
    await writeFile(path + '.tmp', options.body); await rename(path + '.tmp', path);
    return new Response(null, { status: 204 });
  }
  if (url.protocol !== 'file:' && url.origin !== 'http://rv64.local') throw Error(`External fetch disabled: ${url}`);
  const root = resolve(process.env.RV64_PUBLIC);
  const path = url.protocol === 'file:' ? fileURLToPath(url) : resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!path.startsWith(root + sep)) throw Error('Asset outside public root');
  const range = new Headers(options.headers).get('Range');
  try {
    if (range) {
      const match = /^bytes=(\d+)-(\d+)$/.exec(range); if (!match) throw Error('Invalid Range');
      const start = Number(match[1]), end = Number(match[2]);
      const file = await open(path);
      try {
        const { size } = await file.stat();
        if (end < start || end >= size || end - start >= 1048576) throw Error('Range outside asset');
        const bytes = Buffer.alloc(end - start + 1);
        const { bytesRead } = await file.read(bytes, 0, bytes.length, start);
        if (bytesRead !== bytes.length) throw Error('Short read');
        return new Response(bytes, { status: 206, headers: { 'Content-Range': `bytes ${start}-${end}/${size}` } });
      } finally { await file.close(); }
    }
    return new Response(await readFile(path), { headers: { 'Content-Type': path.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream' } });
  } catch (e) { if (e.code === 'ENOENT') return new Response(null, { status: 404 }); throw e; }
};
if (parentPort) {
  globalThis.postMessage = (data, transfer) => parentPort.postMessage(data, transfer);
  // Install module handlers before delivering the queued initial message.
  await import(workerData.url);
  parentPort.on('message', data => globalThis.onmessage?.({ data }));
}
