// Browser-only host work: Rust/wasm must already have been built in rv64-dev.
import { spawn } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, renameSync } from 'node:fs';
import { chromium } from '@playwright/test';
const port = 5198;
const wasmSha256 = createHash('sha256').update(readFileSync('public/rv64/rv64_core_bg.wasm')).digest('hex');
const sourceHash = createHash('sha256');
for (const file of ['restore-clock.ts','jit-compiler.ts','jit.ts','compiler.worker.ts','worker.ts','snapshot.ts','paged-snapshot.ts','snapshot-pager.ts','snapshot-loader.worker.ts']) sourceHash.update(file).update(readFileSync(`src/engine/rv64/${file}`));
const jitSourceSha256 = sourceHash.digest('hex');
const label = process.env.RV64_RESULT_NAME;
if (label && !/^[A-Za-z0-9_-]+$/.test(label)) throw new Error('Invalid result name');
const smpKuberoot = process.argv.includes('--smp-kuberoot');
const smpTrace = process.argv.includes('--smp-trace');
const smpLinux = process.argv.includes('--smp-linux');
const smp = process.argv.includes('--smp-substrate');
const trace = process.argv.includes("--jit-trace");
const gates = process.argv.includes("--jit-gates");
const integration = process.argv.includes("--integration");
const kuberoot = process.argv.includes('--kuberoot');
const boot = process.argv.includes("--boot");
const jit = process.env.RV64_JIT_THRESHOLD ?? "50";
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, VITE_RV64: '1', RV64_MEASURE: '1' } });
let browser;
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { if (browser) await browser.close(); vite.kill(); process.exit(130); });
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
  if (process.env.RV64_POST_DIAG_FILE) {
    const command = readFileSync(process.env.RV64_POST_DIAG_FILE, 'utf8');
    await page.addInitScript(command => { globalThis.rv64PostProbeCommand = command; }, command);
  }
  if (process.env.RV64_SNAPSHOT_CAPTURE === '1' || integration) {
    const snapshotName = integration ? 'integration' : process.env.RV64_SNAPSHOT_NAME ?? 'kuberoot';
    if (!/^[A-Za-z0-9_-]+$/.test(snapshotName)) throw new Error('Invalid snapshot name');
    const destination = `public/rv64/snapshots/${snapshotName}`;
    mkdirSync(destination, { recursive: true });
    await page.route('**/snapshot-upload/*', async route => {
      const name = new URL(route.request().url()).pathname.split('/').pop();
      if (!/^(?:[a-f0-9]{64}\.bin|manifest\.json|paged\.json|certificates\.pem)$/.test(name)) return route.abort();
      if (name === 'certificates.pem') {
        const certs = [...route.request().postData().matchAll(/-----BEGIN CERTIFICATE-----[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----/g)]
          .flatMap(m => { try { return [new X509Certificate(m[0])]; } catch { return []; } })
          .filter(c => c.issuer.includes('kuberoot'));
        if (!certs.some(c => c.subject.includes('CN=kube-apiserver')) || !certs.some(c => c.subject.includes('CN=kuberoot-admin'))) return route.fulfill({ status: 422, body: 'Missing server/admin certificates' });
        const certificates = certs.map(c => ({ subject: c.subject, issuer: c.issuer, fingerprint: c.fingerprint256, validFrom: c.validFrom, validTo: c.validTo }));
        const summary = { validFrom: Math.max(...certs.map(c => Date.parse(c.validFrom))), validUntil: Math.min(...certs.map(c => Date.parse(c.validTo))), certificates };
        writeFileSync(`${destination}/certificate-validity.json`, JSON.stringify(summary, null, 2));
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(summary) });
      }
      writeFileSync(`${destination}/${name}.tmp`, route.request().postDataBuffer());
      renameSync(`${destination}/${name}.tmp`, `${destination}/${name}`);
      await route.fulfill({ status: 204 });
    });
  }
  if (gates || trace || kuberoot || smpLinux || smpKuberoot) {
    const progress = setInterval(async () => { if (kuberoot) console.error('METRICS', JSON.stringify(await page.evaluate(() => globalThis.rv64LatestMetrics).catch(() => null))); const consoleText = await page.locator("#console").textContent().catch(() => "loading"); if (kuberoot && label && consoleText) writeFileSync(`public/rv64/results/${label}-console.txt`, consoleText); console.error(consoleText?.slice(-1500)); }, 30000);
    page.once("close", () => clearInterval(progress));
  }
  let stopProfile;
  if (profile) {
    const cdp = await browser.newBrowserCDPSession();
    const events = [];
    cdp.on('Tracing.dataCollected', ({ value }) => events.push(...value));
    let started, stopped, startTimer, stopTimer;
    const stop = () => stopped ??= (async () => {
      clearTimeout(stopTimer); await started;
      const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
      await cdp.send('Tracing.end'); await complete;
      return { traceEvents: events };
    })();
    const start = () => {
      started = cdp.send('Tracing.start', { categories: '-*,disabled-by-default-v8.cpu_profiler', options: 'sampling-frequency=1000' });
      if (process.env.RV64_PROFILE_DURATION_MS) stopTimer = setTimeout(() => { stop().catch(error => console.error('Profile error', error)); }, Number(process.env.RV64_PROFILE_DURATION_MS));
    };
    if (process.env.RV64_PROFILE_DELAY_MS) startTimer = setTimeout(start, Number(process.env.RV64_PROFILE_DELAY_MS));
    else { start(); await started; }
    stopProfile = async () => { clearTimeout(startTimer); return started ? stop() : { traceEvents: events }; };
  }
  await page.goto(`http://localhost:${port}/src/engine/rv64/${smpKuberoot ? 'smp-kuberoot' : smpTrace ? 'smp-trace' : smpLinux ? 'smp-linux' : smp ? 'smp-gates' : trace ? 'jit-trace' : gates ? 'jit-gates' : kuberoot ? 'kuberoot' : integration ? "integration" : "index"}.html${boot ? `?boot=1&jit=${jit}${profile ? "&profile=1" : ""}` : kuberoot ? `?seconds=${Number(process.env.RV64_PROBE_SECONDS) || 900}&guestProfile=${Number(process.env.RV64_GUEST_PROFILE_INTERVAL) || 0}&memory=${Number(process.env.RV64_MEMORY_MB) || 768}&jit=${jit}&clock=${process.env.RV64_RESTORE_CLOCK ?? 'elapsed'}${process.env.RV64_MEDIA_MANIFEST ? `&media=${encodeURIComponent(process.env.RV64_MEDIA_MANIFEST)}` : ''}${process.env.RV64_SNAPSHOT_CAPTURE === '1' ? '&capture=1' : ''}${process.env.RV64_SNAPSHOT_RESTORE ? `&restore=${encodeURIComponent(process.env.RV64_SNAPSHOT_RESTORE)}` : ''}` : trace ? `?${process.argv.includes("--single-step") ? "single=1&" : ""}${process.argv.includes("--lazy") ? "lazy=1" : ""}` : ""}`);
  let diagnosticTimer;
  if (process.env.RV64_DIAG_FILE) {
    const command = readFileSync(process.env.RV64_DIAG_FILE, 'utf8');
    diagnosticTimer = setTimeout(async () => {
      try {
        const diagnostic = await page.evaluate(command => globalThis.rv64Machine.exec(command), command);
        writeFileSync(`public/rv64/results/${label ?? 'kuberoot'}-diagnostic.json`, JSON.stringify(diagnostic, null, 2));
      } catch (error) { console.error('DIAGNOSTIC', String(error)); }
    }, Number(process.env.RV64_DIAG_DELAY_MS) || 900000);
    page.once('close', () => clearTimeout(diagnosticTimer));
  }
  try {
    await page.waitForFunction(() => globalThis.rv64Result, undefined, { timeout: Number(process.env.RV64_TIMEOUT_MS) || (smpKuberoot ? 1830000 : smpTrace ? 250000 : smpLinux ? 1830000 : gates || trace ? 900000 : kuberoot ? 930000 : boot || integration ? 300000 : 30000) });
  } catch (error) {
    console.error(await page.locator('#console').textContent().catch(() => 'No guest console'));
    throw error;
  }
  const measured = await page.evaluate(() => ({ result: globalThis.rv64Result, isolated: crossOriginIsolated, userAgent: navigator.userAgent }));
  const result = { ...measured, wasmSha256, jitSourceSha256 };
  mkdirSync('public/rv64/results', { recursive: true });
  if (stopProfile) writeFileSync('public/rv64/results/worker-trace.json', JSON.stringify(await stopProfile()));
  writeFileSync(`public/rv64/results/${label ?? (trace ? 'jit-trace' : gates ? 'jit-gates' : kuberoot ? 'kuberoot' : integration ? "integration" : boot ? "boot" : "smoke")}.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (process.argv.includes('--speed-gate')) {
    const baseline = JSON.parse(readFileSync(`public/rv64/results/${process.env.RV64_BASELINE_RESULT}.json`, 'utf8'));
    if (baseline.wasmSha256 !== wasmSha256 || baseline.jitSourceSha256 !== jitSourceSha256) throw new Error('Speed baseline must use the same build');
    const speedup = result.result.busyMips / baseline.result.busyMips;
    if (!(speedup >= 3 && result.result.busyMips >= 250)) throw new Error(`JIT speed gate failed: ${speedup}x, ${result.result.busyMips} busy MIPS`);
  }
  if (!result.isolated || (smpKuberoot ? result.result.type !== 'smp-kuberoot' || !result.result.pass : smpTrace ? result.result.type !== 'smp-trace' || !result.result.pass : smpLinux ? result.result.type !== 'smp-linux' || !result.result.pass : smp ? result.result.type !== 'smp-substrate' || !result.result.pass : trace ? result.result.type !== "jit-trace" || !result.result.pass : gates ? result.result.type !== "jit-gates" || !result.result.pass : kuberoot ? result.result.type !== 'kuberoot' : integration ? result.result.type !== 'integration' : boot ? result.result.type !== 'boot' || !result.result.console.includes('Correct operation validated') || result.result.stimecmpWrites <= 0 : result.result.type !== 'smoke' || result.result.value !== '42' || result.result.retired !== 2)) throw new Error('RV64 smoke failed');
} finally { if (browser) await browser.close(); vite.kill(); }
