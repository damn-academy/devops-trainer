// Dev page: kube.wasm (control plane, main thread) and an RV64 kuberoot
// worker node (emulator workers) in one tab. The node boots the
// r18-kubewasm-worker medium (tools/kube-wasm/node/node-media.py) with a
// Membership the control plane issued laid over the medium's placeholder,
// and reaches the apiserver at 10.0.0.1:6443 on the tab's emulated network;
// the lab host accepts those connections and bridges them into kube.wasm.
//
// Query: ?harts=2 &memory=1024 (MiB) &v=0 &auto=0 (skip the automatic
// deployment) &logs (component logs in the console pane) &kubeletClient=1
// (apiserver → kubelet for logs/exec) &emulator=0 (control plane only)

import { loadKubeWasm, splitArgs, type Loaded } from './loader';
import { createRV64Network } from '../rv64/network';
import { fetchSource } from '../labhost/mirror';
import { sharedTable, atomicModule, HartMailboxes, RESERVATION_GRANULE } from '../rv64/smp';
import { createSharedCompiler } from '../rv64/shared-compiler';
import { hartBudget, jitCeilingBytes, MiB } from '../rv64/host-memory';
import type { TcpConn } from '../labhost/tcp';
import { ipToNum } from '../labhost/wire';

const NODE_NAME = 'kuberoot-000001'; // kinit names the node after the last MAC bytes
const NODE_IP = '10.0.0.10'; // the first DHCP lease of the lab network
const params = new URLSearchParams(location.search);
const WEB_DEPLOYMENT = `apiVersion: apps/v1
kind: Deployment
metadata: {name: web, labels: {app: web}}
spec:
  selector: {matchLabels: {app: web}}
  template:
    metadata: {labels: {app: web}}
    spec:
      containers:
      - name: web
        image: docker.io/library/busybox:1.37.0
        imagePullPolicy: Never
        command: [/bin/sh, -c, 'while true; do echo hello from $(hostname); sleep 10; done']
`;
const harts = Number(params.get('harts') ?? 2);
const memoryMb = Number(params.get('memory') ?? 1024);
const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;
const statusEl = $<HTMLDivElement>('#status');
const clusterEl = $<HTMLPreElement>('#cluster');
const consoleEl = $<HTMLPreElement>('#console');
const t0 = performance.now();
const marks: Record<string, number> = {};
const mark = (name: string) => {
  if (!(name in marks)) marks[name] = Math.round(performance.now() - t0);
  statusEl.textContent = Object.entries(marks).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)} s`).join(' · ');
};
let consoleText = '';
const appendConsole = (s: string) => {
  consoleText = (consoleText + s).slice(-200_000);
  consoleEl.textContent = consoleText;
  consoleEl.scrollTop = consoleEl.scrollHeight;
};

/** Forwards one guest TCP connection into kube.wasm. */
function bridge(k: Loaded, c: TcpConn, target: string) {
  let open = true;
  const g = k.api.connect(target, (b) => { if (open) c.write(b); }, () => { if (open) c.end(); });
  c.onData((b) => g.write(b));
  c.onEnd(() => g.end());
  c.onClose(() => { open = false; g.close(); });
}

async function kubectl(k: Loaded, line: string, stdin = '') {
  return k.api.kubectl(splitArgs(line), stdin);
}

async function main() {
  const k = await loadKubeWasm({
    wasmUrl: './dist/kube.wasm',
    wasmExecUrl: './dist/wasm_exec.js',
    onOutput: (fd, text) => { if (params.has('logs')) appendConsole(`[kube] ${text}\n`); else if (fd === 2 && !/^[IW]\d/.test(text)) console.warn(text); },
  });
  // ?kubeletClient=1 gives the apiserver its kubelet client certificate, for
  // logs and exec; see the README about the crash it can cause.
  const apiserverArgs = params.get('kubeletClient') === '1'
    ? ['--kubelet-client-certificate=/etc/kubernetes/pki/apiserver-kubelet-client.crt', '--kubelet-client-key=/etc/kubernetes/pki/apiserver-kubelet-client.key']
    : [];
  // An emulated node posts its status minutes late at times; with the
  // default 50 s grace the node lifecycle controller marks it Unknown and
  // evicts its pods.
  const controllerManagerArgs = ['--node-monitor-grace-period=5m'];
  await k.api.start({ v: Number(params.get('v') ?? 0), apiserverArgs, controllerManagerArgs });
  await k.api.ready();
  mark('apiserver ready');

  const membership = await k.api.joinMembership(NODE_NAME, NODE_IP);
  const media = await (await fetch('/rv64/r18-kubewasm-worker.json')).json() as
    { url: string; bytes: number; version: string; join: { offset: number; bytes: number } };
  const ticket = new TextEncoder().encode(membership);
  if (ticket.length > media.join.bytes) throw new Error('membership does not fit the placeholder');
  const data = new Uint8Array(media.join.bytes).fill(0x20); // JSON allows trailing spaces
  data.set(ticket);
  const httpDisk = { url: media.url, bytes: media.bytes, version: media.version, overlay: [{ offset: media.join.offset, data }] };

  const services = createRV64Network(fetchSource(new URL('/mirror/', location.href).href));
  let conns = 0;
  services.host.listen({ port: 6443, onConn: (c) => { conns++; bridge(k, c, '127.0.0.1:6443'); } });
  // apiserver → kubelet (logs, exec): kube.wasm dials 10.0.0.10:10250, the
  // page opens that connection on the emulated network.
  const listenErr = k.api.listen(`${NODE_IP}:10250`, (g) => {
    services.host.connect(ipToNum(NODE_IP), 10250, { timeoutMs: 60000 }).then((c) => {
      let open = true;
      g.start((b) => { if (open) c.write(b); }, () => { if (open) c.end(); });
      c.onData((b) => g.write(b));
      c.onEnd(() => g.end());
      c.onClose(() => { open = false; g.close(); });
    }, () => g.close());
  });
  if (listenErr) throw new Error(`listen ${NODE_IP}:10250: ${listenErr}`);

  if (params.get('emulator') === '0') { mark('emulator skipped'); return; }
  // The emulator, as in rv64/smp-kuberoot.ts, without checkpoints or profiling.
  const [kernel, initrd] = await Promise.all(['/rv64/slim-vmlinuz.efi', '/rv64/slim-initrd.cpio']
    .map((u) => fetch(u).then((r) => r.arrayBuffer()).then((b) => new Uint8Array(b))));
  const bytes = memoryMb * MiB, pages = bytes / 65536 + 1;
  const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
  const module = atomicModule(pages), mail = new HartMailboxes(harts).words.buffer;
  const control = new SharedArrayBuffer(harts * 64), ctl = new Int32Array(control);
  const generations = sharedTable(bytes / 4096 * 4);
  const granules = sharedTable(Math.ceil(memory.buffer.byteLength / RESERVATION_GRANULE) * 4);
  const snap = new SharedArrayBuffer((2 + 2 * harts) * 4);
  for (let h = 0; h < harts; h++) ctl[h * 16] = 1;
  const ceiling = jitCeilingBytes(params.get('jitBudgetMb'), import.meta.env.VITE_RV64_JIT_BUDGET_MB);
  const hostBudget = Math.min(ceiling, hartBudget(memory.buffer.byteLength + generations.buffer.byteLength + granules.buffer.byteLength, Array(harts).fill(128 * MiB)));
  const compiler = createSharedCompiler(harts * hostBudget, harts);
  const workers: Worker[] = [];
  services.network.addPort('kube-wasm-node', { mode: 'access' }, (frame) => workers[0]?.postMessage({ frame }));
  const epoch = performance.timeOrigin + performance.now();
  const decoder = new TextDecoder();
  for (let hart = 0; hart < harts; hart++) {
    const w = new Worker(new URL('../rv64/smp-cpu.worker.ts', import.meta.url), { type: 'module' });
    workers.push(w);
    w.onerror = (e) => appendConsole(`\n[page] hart ${hart} worker error: ${e.message}\n`);
    w.onmessage = ({ data }) => {
      if (data.type === 'net') services.network.receive('kube-wasm-node', data.frame);
      else if (data.type === 'error') appendConsole(`\n[page] hart ${hart}: ${data.error}\n`);
      else if (data.type === 'console') {
        const text = decoder.decode(data.bytes).replace(/\r/g, '');
        if (text.includes('RV64_KUBEWASM_JOIN')) mark('membership read');
        if (text.includes('RV64_KUBEWASM_IMAGE busybox.tar')) mark('busybox image loaded');
        if (text.includes('RV64_KUBEWASM_IMAGE_FAILED')) mark('image import failed');
        if (text.includes('RV64_KUBEWASM_IMAGES')) mark('images loaded');
        appendConsole(text);
      }
    };
    const compilerPort = compiler.connect(hart);
    w.postMessage({
      snap, compilerPort, hostBudget, hart, harts, bytes, memory, module, mail, control, generations, granules, epoch, httpDisk,
      guestProfile: 0, guestProfileDeferred: false, guestProfileTaskCommOffset: 0,
      kernel: hart ? undefined : kernel, initrd: hart ? undefined : initrd,
      cmdline: 'earlycon=sbi console=hvc0 nokaslr initcall_blacklist=jent_mod_init kuberoot.root=PARTLABEL=KUBEROOT-MEDIA:/kuberoot/rootfs.squashfs kuberoot.verbose kuberoot.profile=emulator rv64.epoch=' + Math.floor(Date.now() / 1000),
    }, [compilerPort]);
  }
  mark('emulator started');

  $<HTMLFormElement>('#guest').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $<HTMLInputElement>('#guest-input');
    workers[0]?.postMessage({ input: new TextEncoder().encode(input.value + '\n') });
    input.value = '';
  });
  $<HTMLFormElement>('#kubectl').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $<HTMLInputElement>('#kubectl-input');
    const r = await kubectl(k, input.value.replace(/^kubectl\s+/, ''));
    $<HTMLPreElement>('#kubectl-out').textContent = `$ kubectl ${input.value}\n${r.stdout}${r.stderr}`;
  });

  // Watch the cluster; approve kubelet serving certificates (they are not
  // approved automatically) so that logs and exec can reach the kubelet.
  let deployed = false;
  for (;;) {
    const view = await kubectl(k, 'get nodes,pods -A -o wide');
    clusterEl.textContent = `${new Date().toLocaleTimeString()}  bridged connections: ${conns}\n${view.stdout}${view.stderr}`;
    const nodes = await k.api.kubectl(['get', 'nodes', '-o', 'jsonpath={range .items[*]}{.metadata.name}={.status.conditions[?(@.type=="Ready")].status}{"\\n"}{end}']);
    if (nodes.stdout.includes(NODE_NAME)) {
      mark('node registered');
      const cond = await k.api.kubectl(['get', 'node', NODE_NAME, '-o', 'jsonpath={range .status.conditions[*]}{.type}={.status} {.reason}: {.message}{"\\n"}{end}']);
      clusterEl.textContent += `\nconditions:\n${cond.stdout}`;
    }
    if (nodes.stdout.includes(`${NODE_NAME}=True`)) mark('node Ready');
    const csrs = await k.api.kubectl(['get', 'csr', '-o', 'jsonpath={range .items[?(@.spec.signerName=="kubernetes.io/kubelet-serving")]}{.metadata.name}{" "}{.status.certificate}{"\\n"}{end}']);
    for (const line of csrs.stdout.split('\n')) {
      const [name, cert] = line.split(' ');
      if (name && !cert) await kubectl(k, `certificate approve ${name}`);
    }
    if ('node Ready' in marks && !deployed && params.get('auto') !== '0') {
      deployed = true;
      mark('deployment created');
      // busybox is one of the medium's offline images; nothing can be pulled.
      await k.api.kubectl(['apply', '-f', '-'], WEB_DEPLOYMENT);
    }
    if (deployed) {
      const pods = await kubectl(k, 'get pods -l app=web -o jsonpath={.items[*].status.phase}');
      if (pods.stdout.split(' ').includes('Running')) {
        mark('pod Running');
        if (!('logs' in marks)) {
          const logs = await kubectl(k, 'logs deploy/web --tail=1');
          if (logs.code === 0 && logs.stdout.includes('hello')) mark('logs');
          const exec = await kubectl(k, 'exec deploy/web -- uname -m');
          if (exec.code === 0) mark('exec');
          clusterEl.textContent += `\n$ kubectl logs deploy/web --tail=1\n${logs.stdout}${logs.stderr}\n$ kubectl exec deploy/web -- uname -m\n${exec.stdout}${exec.stderr}`;
        }
      }
    }
    (window as unknown as { kubeNode: unknown }).kubeNode = { marks, conns, wasmMemoryBytes: k.wasmMemoryBytes(), go: k.api.memStats() };
    await new Promise((r) => setTimeout(r, 5000));
  }
}

main().catch((e) => { statusEl.textContent = `failed: ${String(e)}`; (window as unknown as { kubeNode: unknown }).kubeNode = { marks, error: String(e) }; });
