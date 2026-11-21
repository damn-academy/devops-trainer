// Browser-only host work: Rust/wasm must already have been built in rv64-dev.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
const port = 5198;
const integration = process.argv.includes("--integration");
const boot = process.argv.includes("--boot");
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, VITE_RV64: '1' } });
let browser;
const profile = process.argv.includes("--profile");
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Vite startup timeout')), 15000);
    vite.stdout.on('data', d => { if (String(d).includes('Local')) { clearTimeout(timeout); resolve(); } });
    vite.on('exit', code => { clearTimeout(timeout); reject(new Error(`Vite exited ${code}`)); });
  });
  browser = await chromium.launch({ headless: true });
  if (integration) { mkdirSync('public/rv64', { recursive: true }); writeFileSync('public/rv64/integration-disk.bin', new Uint8Array(512).fill(90)); }
  const page = await browser.newPage();
  let stopProfile;
  if (profile) {
    const cdp = await browser.newBrowserCDPSession();
    const events = [];
    cdp.on('Tracing.dataCollected', ({ value }) => events.push(...value));
    await cdp.send('Tracing.start', { categories: 'disabled-by-default-v8.cpu_profiler', options: 'sampling-frequency=1000' });
    stopProfile = async () => {
      const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
      await cdp.send('Tracing.end'); await complete;
      return { traceEvents: events };
    };
  }
  await page.goto(`http://localhost:${port}/src/engine/rv64/${integration ? "integration" : "index"}.html${boot ? (profile ? "?boot=1&profile=1" : "?boot=1") : ""}`);
  try {
    await page.waitForFunction(() => globalThis.rv64Result, undefined, { timeout: Number(process.env.RV64_TIMEOUT_MS) || (boot || integration ? 300000 : 30000) });
  } catch (error) {
    console.error(await page.locator('#console').textContent().catch(() => 'No guest console'));
    throw error;
  }
  const result = await page.evaluate(() => ({ result: globalThis.rv64Result, isolated: crossOriginIsolated, userAgent: navigator.userAgent }));
  mkdirSync('public/rv64/results', { recursive: true });
  if (stopProfile) writeFileSync('public/rv64/results/worker-trace.json', JSON.stringify(await stopProfile()));
  writeFileSync(`public/rv64/results/${integration ? "integration" : boot ? "boot" : "smoke"}.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (!result.isolated || (integration ? result.result.type !== 'integration' : boot ? result.result.type !== 'boot' || !result.result.console.includes('Correct operation validated') || result.result.stimecmpWrites <= 0 : result.result.type !== 'smoke' || result.result.value !== '42' || result.result.retired !== 2)) throw new Error('RV64 smoke failed');
} finally { if (browser) await browser.close(); vite.kill(); }
