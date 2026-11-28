// Runs the R0 measurement page in headless Chromium (one browser at a time) and
// saves the JSON result. Usage, from web/:
//   node src/engine/rv64-r0/measure.mjs engine=r0 disk=alpine mem=1024 k8s=1
// The renderer's resident memory is sampled from the OS while the page runs.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
const engine = args.engine ?? 'r0';
const disk = args.disk ?? 'alpine';
const mem = args.mem ?? '1024';
const k8s = args.k8s ?? '0';
const port = Number(args.port ?? 5199);
const label = args.label ?? `${engine}-${disk}-${mem}${k8s === '1' ? '-k8s' : ''}${args.only ? `-only-${args.only}` : ''}`;

const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((resolve) => vite.stdout.on('data', (d) => { if (String(d).includes('Local')) resolve(); }));

function rendererRssMB() {
  // The renderer of Playwright's own Chromium (headless shell); take the largest.
  try {
    const ps = execFileSync('ps', ['-axo', 'rss=,command=']).toString().split('\n');
    let best = 0;
    for (const l of ps) {
      const m = /^\s*(\d+)\s+(.*)$/.exec(l);
      if (m && m[2].includes('ms-playwright') && m[2].includes('--type=renderer')) best = Math.max(best, Number(m[1]));
    }
    return Math.round(best / 1024);
  } catch {
    return null;
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));
page.on('console', (m) => console.log('page:', m.text().slice(0, 300)));
const url = `http://localhost:${port}/src/engine/rv64-r0/index.html?auto=1${args.debug ? "&debug=1" : ""}&engine=${engine}&disk=${disk}&mem=${mem}&k8s=${k8s}${args.only ? `&only=${args.only}` : ''}`;
await page.goto(url);
let peakRss = 0;
const rssTrace = [];
const t0 = Date.now();
let last = '';
for (;;) {
  const r = await page.evaluate(() => window.__r0 ?? null);
  const rss = rendererRssMB();
  if (rss) { peakRss = Math.max(peakRss, rss); rssTrace.push([Math.round((Date.now() - t0) / 1000), rss]); }
  const keys = r ? Object.keys(r.steps).join(',') : '';
  if (args.debug && Math.round((Date.now() - t0) / 1000) % 10 < 2) {
    const tail = await page.evaluate(() => document.getElementById('console')?.textContent?.slice(-1500) ?? '');
    console.log('--- console tail ---\n' + tail);
  }
  if (keys !== last) { console.log(`[${Math.round((Date.now() - t0) / 1000)}s] steps: ${keys} rss=${rss}MB`); last = keys; }
  if (r?.done) {
    r.rendererPeakRssMB = peakRss;
    r.rendererRssTrace = rssTrace;
    mkdirSync('public/rv64-r0/results', { recursive: true });
    const file = `public/rv64-r0/results/${label}.json`;
    writeFileSync(file, JSON.stringify(r, null, 2));
    console.log(JSON.stringify(r, null, 2));
    console.log('saved', file);
    break;
  }
  if (Date.now() - t0 > 3_600_000) { console.error('overall timeout'); break; }
  await new Promise((res) => setTimeout(res, 2000));
}
const tail = await page.evaluate(() => document.getElementById('console')?.textContent ?? '');
writeFileSync(`public/rv64-r0/results/${label}.console.txt`, tail);
await browser.close();
vite.kill();
