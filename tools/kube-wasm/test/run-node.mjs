// Runs kube.wasm under Node.js, without a browser: starts the control plane,
// waits for /readyz, runs a few kubectl commands and exits. Used to repeat
// starts quickly on the build host (for example to reproduce a crash).
//
//   node run-node.mjs --wasm kube.wasm --exec wasm_exec.js [--memfs memfs.ts]
//                     [--apiserver-arg=--flag=value ...] [--seconds 20]
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
go.env = { HOME: '/root', TMPDIR: '/tmp' };
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
