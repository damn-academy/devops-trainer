// Fresh browser contexts: no HTTP cache, OPFS states or shared runtime cache.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const cold = process.argv.includes('--cold');
  const scenarios = cold ? [[1, 'lab-node', 128], [2, 'lab-node', 128]] : [[1, 'lab-node', 128], [2, 'lab-node', 128], [1, 'lab-installer', 160], [1, 'lab-node', 512]];
  for (const [count, profile, memoryMB] of scenarios) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', (e) => console.error(e));
    await page.goto(server.resolvedUrls.local[0]);
    const result = await page.evaluate(async ({ count, profile, memoryMB, cold }) => {
      const { V86Lab } = await import('/src/engine/v86/lab.ts');
      const { defaultAssets } = await import('/src/engine/v86/machine.ts');
      const assets = cold ? { ...await defaultAssets(profile), bootSnapshots: undefined } : undefined;
      const lab = new V86Lab({ assets, nodes: Array.from({ length: count }, (_, i) => ({ name: `node${i + 1}`, profile, memoryMB })) });
      const start = performance.now();
      const promptTimes = [];
      const promptWaiters = [];
      const onMachine = (name) => {
        const m = lab.machine(name);
        const previous = m.lastMark;
        promptWaiters.push(new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('no prompt')), 10000);
          const off = m.onOutput(() => {
            if (m.lastMark && m.lastMark !== previous) {
              promptTimes.push(performance.now() - start);
              clearTimeout(timer);
              off();
              resolve();
            }
          });
          m.write('\r');
        }));
      };
      try {
        const boots = await Promise.race([
          lab.start(onMachine),
          new Promise((_, reject) => setTimeout(() => reject(new Error(JSON.stringify(lab.machines.map((m) => ({ phase: m.phase, error: m.error }))))), 120000)),
        ]);
        // Timestamp the serial prompt as it arrives, independently of OPFS writes.
        await Promise.all(promptWaiters);
        const promptMs = Math.round(Math.max(...promptTimes));
        const identities = await Promise.all(lab.machines.map(async (m) => {
          if (!cold && m.boot.kind !== 'restored') throw new Error('prebuilt snapshot was not restored');
          return (await m.exec('hostname; cat /etc/machine-id; if test -f /etc/ssh/ssh_host_ed25519_key.pub; then cat /etc/ssh/ssh_host_ed25519_key.pub; else echo no-sshd; fi; cat /sys/class/net/eth0/address; ip -4 -o addr show eth0')).out.trim().split('\n');
        }));
        if (count === 2) {
          for (let i = 0; i < 5; i++) if (identities[0][i] === identities[1][i]) throw new Error(`cloned identity field ${i}`);
          if ((await lab.exec('node1', 'ping -c 1 -W 3 node2')).exit) throw new Error('clones cannot communicate');
        }
        const downloads = performance.getEntriesByType('resource').filter((r) => /boot-.*\.bin$/.test(r.name)).map((r) => ({ file: r.name.split('/').pop(), bytes: r.encodedBodySize }));
        return { count, profile, memoryMB, cold, promptMs, boots, downloads, identities };
      } finally { lab.dispose(); }
    }, { count, profile, memoryMB, cold });
    console.log(JSON.stringify(result));
    await context.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
