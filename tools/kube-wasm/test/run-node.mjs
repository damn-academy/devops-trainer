// Runs kube.wasm under Node.js, without a browser: starts the control plane,
// waits for /readyz, runs a few kubectl commands and exits. Used to repeat
// starts quickly on the build host (for example to reproduce a crash).
//
//   node run-node.mjs --wasm kube.wasm --exec wasm_exec.js [--memfs memfs.ts]
//                     [--apiserver-arg=--flag=value ...] [--env GODEBUG=...] [--seconds 20]
//                     [--kubectl-loop N]
//
// --memfs gives the Go program the page's in-memory file system instead of
// Node's real one (Node 22.6+ strips the TypeScript types). Exit code: 0 on
// success, 2 if the Go program died, 1 on other errors.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    wasm: { type: 'string' }, exec: { type: 'string' }, memfs: { type: 'string' },
    'apiserver-arg': { type: 'string', multiple: true, default: [] },
    seconds: { type: 'string', default: '20' },
    env: { type: 'string', multiple: true, default: [] },
    'kubectl-loop': { type: 'string', default: '0' },
  },
});
const t0 = performance.now();
const ms = () => Math.round(performance.now() - t0);

if (values.memfs) {
  const { createMemFs } = await import(path.resolve(values.memfs));
  globalThis.fs = createMemFs((fd, text) => (fd === 2 ? process.stderr : process.stdout).write(text + '\n')).fs;
} else {
  globalThis.fs = fs;
  fs.mkdirSync('/etc/kubernetes/pki', { recursive: true });
}
globalThis.path = path;
vm.runInThisContext(fs.readFileSync(values.exec, 'utf8'));

const go = new globalThis.Go();
go.argv = ['kube-wasm'];
go.env = { HOME: '/root', TMPDIR: '/tmp', ...Object.fromEntries(values.env.map((kv) => kv.split(/=(.*)/s).slice(0, 2))) };
let exited = false;
const loaded = new Promise((resolve) => { globalThis.__kubeWasmLoaded = resolve; });
const { instance } = await WebAssembly.instantiate(fs.readFileSync(values.wasm), go.importObject);
go.run(instance).then(() => { exited = true; });
await loaded;
const api = globalThis.kubeWasm;
const watchdog = setInterval(() => {
  if (exited) { console.log(`RESULT go-exited at ${ms()} ms`); process.exit(2); }
}, 100);
try {
  await api.start({ apiserverArgs: values['apiserver-arg'] });
  const phases = await api.ready();
  console.log(`ready at ${ms()} ms`, JSON.stringify(phases));
  // --kubectl-loop N: run N kubectl commands and print the live Go heap
  // (after a collection) every N/10 calls, to see what a command retains.
  const loops = Number(values['kubectl-loop']);
  for (let i = 1; i <= loops; i++) {
    const r = await api.kubectl(['get', 'ns']);
    if (r.code !== 0) throw new Error(r.stderr);
    if (i % Math.max(1, Math.floor(loops / 10)) === 0) {
      await api.heapProfile(); // collects garbage first
      const m = api.memStats();
      console.log(`kubectl ${i}: heapAlloc ${Math.round(m.heapAlloc / 2 ** 20)} MiB, goroutines ${m.goroutines}`);
      if (i === loops) fs.writeFileSync('goroutines.txt', api.goroutineProfile());
    }
  }
  const until = performance.now() + Number(values.seconds) * 1000;
  while (performance.now() < until) {
    const r = await api.kubectl(['get', 'ns']);
    if (r.code !== 0) throw new Error(r.stderr);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(`RESULT ok at ${ms()} ms`, JSON.stringify(api.memStats()));
  clearInterval(watchdog);
  process.exit(0);
} catch (e) {
  console.log(`RESULT error ${String(e)}`);
  process.exit(exited ? 2 : 1);
}
