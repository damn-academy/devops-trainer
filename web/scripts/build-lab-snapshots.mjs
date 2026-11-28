// Boot the product in headless Chromium and store compressed, portable states.
// Gzip bytes use .bin to avoid servers transparently decoding .gz responses.
// No raw RAM dumps on disk. Re-run after build:lab-image or a v86 upgrade.
// `--only lab-editors:256[,profile:MB…]` rebuilds only these and keeps the other entries.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, appendFileSync, renameSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = `${root}public/v86/lab/`;
const manifest = JSON.parse(readFileSync(`${out}manifest.json`, 'utf8'));
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
let browser;
let temp;
let published = false;
const generated = [];
const ALL = [['lab-node', 128], ['lab-installer', 160], ['lab-node', 512], ['lab-editors', 256]];
const onlyArg = process.argv.indexOf('--only');
const only = onlyArg > 0 ? process.argv[onlyArg + 1].split(',').map((x) => { const [p, mb] = x.split(':'); return [p, Number(mb)]; }) : null;
const builds = only ?? ALL.filter(([p]) => manifest.profiles[p]);
// With --only, entries of other profiles and sizes stay as they are.
const kept = only ? Object.fromEntries(Object.entries(manifest.bootSnapshots ?? {}).filter(([key]) => !only.some(([p, mb]) => key.includes(`-${p}-`) && key.includes(`-${mb}m-`)))) : {};
const previous = Object.values(manifest.bootSnapshots ?? {}).map((entry) => entry.file).filter((f) => !Object.values(kept).some((e) => e.file === f));
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const entries = { ...kept };
  for (const [profile, memoryMB] of builds) {
    const context = await browser.newContext();
    const page = await context.newPage();
    temp = `${out}boot-${profile}-${memoryMB}.tmp`;
    writeFileSync(temp, '');
    await page.exposeFunction('saveChunk', (base64) => appendFileSync(temp, Buffer.from(base64, 'base64')));
    await page.goto(server.resolvedUrls.local[0]);
    const result = await page.evaluate(async ({ profile, memoryMB }) => {
      const { V86Machine } = await import('/src/engine/v86/machine.ts');
      const { imageHash, V86_VERSION } = await import('/src/engine/v86/boot-snapshot.ts');
      const manifest = await (await fetch('/v86/lab/manifest.json')).json();
      const m = new V86Machine({ profile, memoryMB, bootCache: false });
      try {
        const boot = await m.start();
        const { state } = await m.snapshot();
        const reader = new Blob([state]).stream().pipeThrough(new CompressionStream('gzip')).getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          await window.saveChunk(btoa(String.fromCharCode(...value)));
        }
        return { key: m.cacheKey(), imageHash: await imageHash(manifest, manifest.profiles[profile].fsJson), v86: V86_VERSION, coldMs: boot.ms };
      } finally { m.dispose(); }
    }, { profile, memoryMB });
    const bytes = readFileSync(temp);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const file = `boot-${profile}-${memoryMB}-${sha256.slice(0, 16)}.bin`;
    renameSync(temp, `${out}${file}`);
    generated.push(file);
    temp = undefined;
    entries[result.key] = { file, sha256, size: bytes.length, v86: result.v86, imageHash: result.imageHash, key: result.key };
    console.log(JSON.stringify({ profile, memoryMB, coldMs: result.coldMs, size: bytes.length }));
    await context.close();
  }
  manifest.bootSnapshots = entries;
  temp = `${out}manifest.json.tmp`;
  writeFileSync(temp, JSON.stringify(manifest, null, 2) + '\n');
  renameSync(temp, `${out}manifest.json`);
  temp = undefined;
  published = true;
  for (const file of previous) if (!generated.includes(file) && /^boot-[a-z0-9.-]+\.bin$/.test(file)) rmSync(`${out}${file}`, { force: true });
} finally {
  if (temp) rmSync(temp, { force: true });
  if (!published) for (const file of generated) if (!previous.includes(file)) rmSync(`${out}${file}`, { force: true });
  await browser?.close();
  await server.close();
}
