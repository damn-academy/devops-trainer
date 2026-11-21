// Browser-only host work: Rust/wasm must already have been built in rv64-dev.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
const port = 5198;
const boot = process.argv.includes("--boot");
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, VITE_RV64: '1' } });
let browser;
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Vite startup timeout')), 15000);
    vite.stdout.on('data', d => { if (String(d).includes('Local')) { clearTimeout(timeout); resolve(); } });
    vite.on('exit', code => { clearTimeout(timeout); reject(new Error(`Vite exited ${code}`)); });
  });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`http://localhost:${port}/src/engine/rv64/index.html${boot ? "?boot=1" : ""}`);
  await page.waitForFunction(() => globalThis.rv64Result, undefined, { timeout: boot ? 300000 : 30000 });
  const result = await page.evaluate(() => ({ result: globalThis.rv64Result, isolated: crossOriginIsolated, userAgent: navigator.userAgent }));
  mkdirSync('public/rv64/results', { recursive: true });
  writeFileSync(`public/rv64/results/${boot ? "boot" : "smoke"}.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (!result.isolated || (boot ? result.result.type !== 'boot' || !result.result.console.includes('Correct operation validated') : result.result.type !== 'smoke' || result.result.value !== '42' || result.result.retired !== 2)) throw new Error('RV64 smoke failed');
} finally { if (browser) await browser.close(); vite.kill(); }
