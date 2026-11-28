// Node >=24. No Chromium, pod creation, network access, or wall-clock deadline.
import { resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
const [publicRoot, destination] = process.argv.slice(2);
if (!publicRoot || !destination) throw Error('usage: node scripts/rv64-node/capture.mjs PUBLIC_ROOT NEW_OUTPUT_DIR');
process.env.RV64_PUBLIC = resolve(publicRoot);
process.env.RV64_OUTPUT = resolve(destination);
const media = process.env.RV64_MEDIA_MANIFEST ?? '/rv64/r16-uncompressed-no-reboot.json';
const disk = JSON.parse(await readFile(resolve(publicRoot, '.' + media)));
const hash = createHash('sha256'); let size = 0;
for await (const chunk of createReadStream(resolve(publicRoot, '.' + disk.url))) { hash.update(chunk); size += chunk.length; }
if (hash.digest('hex') !== disk.version || size !== disk.bytes) throw Error('Base medium digest/size mismatch');
await mkdir(destination); // Never overwrite an earlier capture.
await import('./runtime.mjs');
globalThis.location = new URL(`http://rv64.local/?seconds=0&harts=2&memory=1024&sharedJit=0&capture=1&media=${encodeURIComponent(media)}`);
globalThis.document = { querySelector: () => ({ textContent: '' }) };
const started = performance.now();
const guard = setInterval(() => {
  if (process.memoryUsage().rss > 1850 * 1048576) { console.error('R17 RSS guard: exceeded 1850 MiB; no completed snapshot'); process.exit(1); }
}, 1000);
const timer = setInterval(() => console.error(JSON.stringify({ elapsedSeconds: (performance.now() - started) / 1000, rss: process.memoryUsage().rss, metrics: globalThis.rv64LatestMetrics })), 30000);
try {
  await import('../../src/engine/rv64/smp-kuberoot.ts');
  await writeFile(resolve(destination, 'result.json'), JSON.stringify(globalThis.rv64Result, null, 2));
  if (!globalThis.rv64Result?.pass) throw Error(JSON.stringify(globalThis.rv64Result));
} finally { clearInterval(timer); clearInterval(guard); }
// MessageChannels in terminated machine objects need not keep the CLI alive.
process.exit(0);
