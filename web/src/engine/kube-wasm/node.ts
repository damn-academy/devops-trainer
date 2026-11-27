// Dev page: kube.wasm (control plane, main thread) and an RV64 kuberoot
// worker node (emulator workers) in one tab. The node boots the
// r18-kubewasm-worker medium (tools/kube-wasm/node/node-media.py) with a
// Membership the control plane issued laid over the medium's placeholder,
// and reaches the apiserver at 10.0.0.1:6443 on the tab's emulated network;
// the lab host accepts those connections and bridges them into kube.wasm.
//
// Query: ?harts=2 &memory=1024 (MiB) &v=0 &auto=0 (skip the automatic
// deployment) &logs (component logs in the console pane) &emulator=0
// (control plane only)
// &goenv=GOGC=200;GOMEMLIMIT=900MiB &apiserver=--watch-cache=false
// &capture=1 (once the pod runs, save a checkpoint of the node and the
// control plane through POST /snapshot-upload/<name>) &restore=<base URL>
// (start from such a checkpoint: smp.json, kube-state.json, <sha256>.bin)

import { loadKubeWasm, splitArgs, type Loaded } from './loader';
import { createRV64Network } from '../rv64/network';
import { fetchSource } from '../labhost/mirror';
import { sharedTable, atomicModule, HartMailboxes, RESERVATION_GRANULE } from '../rv64/smp';
import { createSharedCompiler } from '../rv64/shared-compiler';
import { hartBudget, jitCeilingBytes, MiB } from '../rv64/host-memory';
import type { TcpConn } from '../labhost/tcp';
import { readObject, restoreRam, storeObject, storeRam, validateCheckpoint, type SMPCheckpoint } from '../rv64/smp-checkpoint';
import { restoreTimeOffset } from '../rv64/restore-clock';
import { sha256 } from '../rv64/snapshot';
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

const b64 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const upload = async (name: string, data: Uint8Array) => {
  const r = await fetch('/snapshot-upload/' + name, { method: 'POST', body: data as Uint8Array<ArrayBuffer> });
  if (!r.ok) throw new Error(`checkpoint upload ${name}: ${r.status}`);
};
interface SavedTcp { vlan: number; local: { ip: number; port: number }; remote: { ip: number; port: number }; snd: number; rcv: number }
interface KubeState { pki: Record<string, string>; etcd: string; tcp?: SavedTcp[] }

async function main() {
  const restoreBase = params.get('restore') ? new URL(params.get('restore')!, location.href).href : null;
  const capturing = params.get('capture') === '1';
  const k = await loadKubeWasm({
    wasmUrl: params.get('wasm') ?? './dist/kube.wasm', // e.g. ?wasm=./dist/kube.opt.wasm
    wasmExecUrl: './dist/wasm_exec.js',
    // e.g. ?goenv=GOGC=200;GODEBUG=gcstoptheworld=1,gcshrinkstackoff=1
    env: Object.fromEntries((params.get('goenv') ?? '').split(';').filter(Boolean).map((kv) => { const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)] as [string, string]; })),
    onOutput: (fd, text) => { if (params.has('logs')) appendConsole(`[kube] ${text}\n`); else if (fd === 2 && !/^[IW]\d/.test(text)) console.warn(text); },
  });
  const apiserverArgs: string[] = [];
  // e.g. ?apiserver=--watch-cache=false (';'-separated)
  apiserverArgs.push(...(params.get('apiserver') ?? '').split(';').filter(Boolean));
  // An emulated node posts its status minutes late at times; with the
  // default 50 s grace the node lifecycle controller marks it Unknown and
  // evicts its pods.
  const controllerManagerArgs = ['--node-monitor-grace-period=5m'];
  let restore: { pki: Record<string, Uint8Array>; etcd: Uint8Array } | undefined;
  let savedTcp: SavedTcp[] = [];
  if (restoreBase) {
    const st = await (await fetch(new URL('kube-state.json', restoreBase))).json() as KubeState;
    savedTcp = st.tcp ?? [];
    // ?resetPorts=a,b: for checkpoints saved without their connections,
    // the node's client ports (from netstat on its console). The wrong
    // sequence number draws a challenge ACK, answered with an exact reset.
    for (const port of (params.get('resetPorts') ?? '').split(',').filter(Boolean)) {
      savedTcp.push({ vlan: 1, local: { ip: ipToNum('10.0.0.1'), port: 6443 }, remote: { ip: ipToNum(NODE_IP), port: Number(port) }, snd: 0, rcv: 0 });
    }
    restore = { pki: Object.fromEntries(Object.entries(st.pki).map(([n, v]) => [n, unb64(v)])), etcd: unb64(st.etcd) };
  }
  await k.api.start({ v: Number(params.get('v') ?? 0), apiserverArgs, controllerManagerArgs, restore });
  await k.api.ready();
  mark('apiserver ready');

  const media = await (await fetch(params.get('media') ?? '/rv64/r19-kubewasm-worker.json')).json() as
    { url: string; bytes: number; version: string; join: { offset: number; bytes: number } };
  const disk = { url: media.url, bytes: media.bytes, version: media.version };
  let httpDisk: typeof disk & { overlay?: { offset: number; data: Uint8Array }[] } = disk;
  if (!restore) {
    // A restored node already has its Membership (and certificates) in RAM.
    const membership = await k.api.joinMembership(NODE_NAME, NODE_IP);
    const ticket = new TextEncoder().encode(membership);
    if (ticket.length > media.join.bytes) throw new Error('membership does not fit the placeholder');
    const data = new Uint8Array(media.join.bytes).fill(0x20); // JSON allows trailing spaces
    data.set(ticket);
    httpDisk = { ...disk, overlay: [{ offset: media.join.offset, data }] };
  }

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
  // A restored node never boots: no kernel or initrd. A booting one hands
  // them to hart 0 (transferred, not copied).
  const [kernel, initrd] = restoreBase ? [undefined, undefined] : await Promise.all(['/rv64/slim-vmlinuz.efi', '/rv64/slim-initrd.cpio']
    .map((u) => fetch(u).then((r) => r.arrayBuffer()).then((b) => new Uint8Array(b))));
  const bytes = memoryMb * MiB, pages = bytes / 65536 + 1;
  const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
  const module = atomicModule(pages), mail = new HartMailboxes(harts).words.buffer;
  const control = new SharedArrayBuffer(harts * 64), ctl = new Int32Array(control);
  const generations = sharedTable(bytes / 4096 * 4);
  const granules = sharedTable(Math.ceil(memory.buffer.byteLength / RESERVATION_GRANULE) * 4);
  const snap = new SharedArrayBuffer((2 + 2 * harts) * 4);
  const wasmSha256 = await sha256(new Uint8Array(await (await fetch('/rv64/rv64_core_bg.wasm')).arrayBuffer()));
  let checkpoint: SMPCheckpoint | undefined;
  const initialBlobs: Uint8Array[] = [];
  let initialDevice: Uint8Array | undefined;
  let epoch = performance.timeOrigin + performance.now();
  if (restoreBase) {
    checkpoint = await (await fetch(new URL('smp.json', restoreBase))).json() as SMPCheckpoint;
    validateCheckpoint(checkpoint, harts, bytes, wasmSha256, disk);
    const view = new Uint8Array(memory.buffer, 64, bytes);
    await restoreRam(restoreBase, checkpoint.ram, view);
    new Uint8Array(control).set(await readObject(restoreBase, checkpoint.control));
    new Uint8Array(mail).set(await readObject(restoreBase, checkpoint.mail));
    for (const ref of checkpoint.cpus) initialBlobs.push(await readObject(restoreBase, ref));
    initialDevice = await readObject(restoreBase, checkpoint.device);
    // ?clock=continuous (default) resumes the guest clock where it stopped,
    // so containerd and the kubelet see no jump; the node lifecycle
    // controller times node heartbeats with its own clock. ?clock=elapsed
    // moves the guest clock forward by the time the checkpoint lay unused.
    const clock = params.get('clock') === 'elapsed' ? 'elapsed' : 'continuous';
    epoch = -restoreTimeOffset(checkpoint.ticks, checkpoint.capturedAt, clock, Date.now(), performance.timeOrigin + performance.now()) / 10000;
    mark('checkpoint loaded');
  } else {
    for (let h = 0; h < harts; h++) ctl[h * 16] = 1;
  }
  const ceiling = jitCeilingBytes(params.get('jitBudgetMb'), import.meta.env.VITE_RV64_JIT_BUDGET_MB);
  const hostBudget = Math.min(ceiling, hartBudget(memory.buffer.byteLength + generations.buffer.byteLength + granules.buffer.byteLength, Array(harts).fill(128 * MiB)));
  // One code cache for all harts (blocks are shared between them, least
  // recently used ones evicted); ?compilePool=N sets its compile workers.
  const compiler = createSharedCompiler(harts * hostBudget, harts, Number(params.get('compilePool') ?? harts));
  const workers: Worker[] = [];
  services.network.addPort('kube-wasm-node', { mode: 'access' }, (frame) => workers[0]?.postMessage({ frame }));
  const snapshots = new Map<number, { blob: Uint8Array; deviceBlob?: Uint8Array; ticks: number }>();
  let captured: (() => void) | undefined;
  const decoder = new TextDecoder();
  let onConsole: ((text: string) => void) | undefined;
  const emu: Record<number, { retired: number; jit: number; host: number; ticks: number; mips?: number; jitShare?: number; clock?: number; compiled?: unknown }> = {};
  for (let hart = 0; hart < harts; hart++) {
    const w = new Worker(new URL('../rv64/smp-cpu.worker.ts', import.meta.url), { type: 'module' });
    workers.push(w);
    w.onerror = (e) => appendConsole(`\n[page] hart ${hart} worker error: ${e.message}\n`);
    w.onmessage = ({ data }) => {
      if (data.type === 'net') services.network.receive('kube-wasm-node', data.frame);
      else if (data.type === 'metrics') {
        // Emulator speed per hart: millions of guest instructions per host
        // second, the share run by compiled blocks, and guest vs host time.
        const prev = emu[data.hart];
        const now = { retired: Number(data.retired), jit: Number(data.jitRetired), host: Number(data.hostMonotonicMs), ticks: Number(data.guestTicks) };
        if (prev) {
          const dt = (now.host - prev.host) / 1000, dr = now.retired - prev.retired;
          emu[data.hart] = { ...now, mips: Math.round(dr / dt / 1e6), jitShare: dr ? Math.round((now.jit - prev.jit) / dr * 100) / 100 : 0,
            clock: Math.round((now.ticks - prev.ticks) / 1e7 / dt * 100) / 100, compiled: data.compiled };
        } else emu[data.hart] = now;
      }
      else if (data.type === 'snapshot') {
        snapshots.set(data.hart, data);
        if (snapshots.size === harts) captured?.();
      }
      else if (data.type === 'error') appendConsole(`\n[page] hart ${hart}: ${data.error}\n`);
      else if (data.type === 'console') {
        const text = decoder.decode(data.bytes).replace(/\r/g, '');
        onConsole?.(text);
        if (text.includes('RV64_KUBEWASM_JOIN')) mark('membership read');
        if (text.includes('RV64_KUBEWASM_IMAGE busybox.tar')) mark('busybox image loaded');
        if (text.includes('RV64_KUBEWASM_IMAGE_FAILED')) mark('image import failed');
        if (text.includes('RV64_KUBEWASM_IMAGES')) mark('images loaded');
        appendConsole(text);
      }
    };
    const compilerPort = compiler.connect(hart);
    w.postMessage({
      initialRestore: checkpoint ? { blob: initialBlobs[hart], deviceBlob: hart === 0 ? initialDevice : undefined } : undefined,
      snap, compilerPort, hostBudget, hart, harts, bytes, memory, module, mail, control, generations, granules, epoch, httpDisk,
      guestProfile: 0, guestProfileDeferred: false, guestProfileTaskCommOffset: 0,
      kernel: hart ? undefined : kernel, initrd: hart ? undefined : initrd,
      cmdline: 'earlycon=sbi console=hvc0 nokaslr initcall_blacklist=jent_mod_init kuberoot.root=PARTLABEL=KUBEROOT-MEDIA:/kuberoot/rootfs.squashfs kuberoot.verbose kuberoot.profile=emulator rv64.epoch=' + Math.floor(Date.now() / 1000),
    }, hart === 0 && kernel && initrd ? [compilerPort, kernel.buffer, initrd.buffer] : [compilerPort]);
  }
  mark('emulator started');
  if (savedTcp.length) {
    // Without this the restored kubelet waits on connections whose far end
    // is gone and sends nothing that would reveal it (measured: no
    // heartbeat in 10 minutes, ESTABLISHED sockets in netstat).
    setTimeout(() => {
      for (const c of savedTcp) services.host.resetPeer(c.vlan, c.local, c.remote, c.snd, c.rcv);
      mark(`reset ${savedTcp.length} saved connections`);
    }, 1000);
  }
  const leaseRenewed = async () => {
    const r = await k.api.kubectl(['get', 'lease', NODE_NAME, '-n', 'kube-node-lease', '-o', 'jsonpath={.spec.renewTime}']);
    return Date.parse(r.stdout) || 0;
  };
  let restoredHeartbeat = Infinity;
  if (restore) {
    restoredHeartbeat = await leaseRenewed();
  }

  // Save the node (all harts stopped at a barrier) and, while it stands
  // still, the control plane's state; then let the node run on.
  async function saveCheckpoint() {
    // Free guest memory still holds old data, so nearly every MiB of RAM is
    // nonzero and a restore touches all of it. Drop the page cache and
    // fill the free memory once with zeros (a tmpfs file, then removed):
    // zero MiB chunks are left out of the checkpoint and never written.
    const zeroed = new Promise<void>((resolve) => { onConsole = (t) => { if (t.includes('KUBEWASM_ZEROED')) resolve(); }; });
    workers[0].postMessage({ input: new TextEncoder().encode(
      'sync; echo 3 > /proc/sys/vm/drop_caches; ' +
      'busybox dd if=/dev/zero of=/run/kubewasm-zero bs=1M count=$(busybox awk \'/MemFree/ {print int($2/1024) - 48}\' /proc/meminfo) 2>/dev/null; ' +
      "rm -f /run/kubewasm-zero; echo KUBEWASM_ZER''OED\n") });
    await zeroed;
    onConsole = undefined;
    mark('guest memory zeroed');
    const sv = new Int32Array(snap);
    const done = new Promise<void>((resolve) => { captured = resolve; });
    Atomics.store(sv, 0, 1);
    workers.forEach((w) => w.postMessage({ snapshot: 1 }));
    await done;
    const state = await k.api.saveState();
    const capturedAt = Date.now();
    const cpus = [];
    for (let h = 0; h < harts; h++) cpus.push(await storeObject(snapshots.get(h)!.blob, upload));
    const cp: SMPCheckpoint = {
      format: 'dt.rv64.smp/v1', harts, bytes, wasmSha256, disk, capturedAt,
      ticks: Math.max(...[...snapshots.values()].map((s) => s.ticks)), marker: 'RV64_NODE_REGISTERED_READY', cpus,
      device: await storeObject(snapshots.get(0)!.deviceBlob!, upload),
      control: await storeObject(new Uint8Array(control).slice(), upload),
      mail: await storeObject(new Uint8Array(mail).slice(), upload),
      ram: await storeRam(new Uint8Array(memory.buffer, 64, bytes), upload),
    };
    validateCheckpoint(cp, harts, bytes, wasmSha256, disk);
    Atomics.store(sv, 1, 1); // resume
    // The node's connections to the lab host survive in its RAM; the next
    // tab resets them so that its clients reconnect at once (see restore).
    const tcp: SavedTcp[] = services.host.connections().map((c) => ({ vlan: c.vlan, local: c.local, remote: c.remote, ...c.sequence }));
    const kubeState: KubeState = { pki: Object.fromEntries(Object.entries(state.pki).map(([n, v]) => [n, b64(v)])), etcd: b64(state.etcd), tcp };
    await upload('kube-state.json', new TextEncoder().encode(JSON.stringify(kubeState)));
    await upload('smp.json', new TextEncoder().encode(JSON.stringify(cp)));
    mark('checkpoint saved');
  }

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
    if (restore) {
      // The restored store already says Ready: wait for the kubelet to renew
      // its node lease (its heartbeat; the Ready condition's timestamp only
      // moves with status reports, every 5 minutes). With the continuous
      // clock the guest's timestamps lag, so compare with the saved lease.
      if (await leaseRenewed() > restoredHeartbeat) mark('fresh heartbeat');
    }
    const csrs = await k.api.kubectl(['get', 'csr', '-o', 'jsonpath={range .items[?(@.spec.signerName=="kubernetes.io/kubelet-serving")]}{.metadata.name}{" "}{.status.certificate}{"\\n"}{end}']);
    for (const line of csrs.stdout.split('\n')) {
      const [name, cert] = line.split(' ');
      if (name && !cert) await kubectl(k, `certificate approve ${name}`);
    }
    if (restore) deployed = true; // the deployment came with the checkpoint
    if (restore && 'fresh heartbeat' in marks && params.get('auto') !== '0') {
      // A new workload after the restore: scheduled, started and reported
      // by the restored node.
      if (!('new deployment created' in marks)) {
        mark('new deployment created');
        await k.api.kubectl(['apply', '-f', '-'], WEB_DEPLOYMENT.replace(/\bweb\b/g, 'web2'));
      }
      const p2 = await kubectl(k, 'get pods -l app=web2 -o jsonpath={.items[*].status.phase}');
      if (p2.stdout.split(' ').includes('Running')) mark('new pod Running');
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
        if (capturing && !('checkpoint saved' in marks) && 'busybox image loaded' in marks) await saveCheckpoint();
        // Bounded, so that an unreachable kubelet cannot stop this loop.
        if (!('logs' in marks)) {
          const logs = await kubectl(k, 'logs deploy/web --tail=1 --request-timeout=30s');
          if (logs.code === 0 && logs.stdout.includes('hello')) mark('logs');
          const exec = await kubectl(k, 'exec deploy/web --request-timeout=30s -- uname -m');
          if (exec.code === 0) mark('exec');
          clusterEl.textContent += `\n$ kubectl logs deploy/web --tail=1\n${logs.stdout}${logs.stderr}\n$ kubectl exec deploy/web -- uname -m\n${exec.stdout}${exec.stderr}`;
        }
      }
    }
    // ?heapAt=120,300: upload Go heap profiles (heap-<s>.pprof) at those
    // seconds after page load, through the same endpoint as checkpoints.
    for (const at of (params.get('heapAt') ?? '').split(',').filter(Boolean).map(Number)) {
      if (performance.now() - t0 > at * 1000 && !(`heap ${at}` in marks)) {
        mark(`heap ${at}`);
        await upload(`heap-${at}.pprof`, await k.api.heapProfile());
      }
    }
    (window as unknown as { kubeNode: unknown }).kubeNode = { marks, conns, wasmMemoryBytes: k.wasmMemoryBytes(), go: k.api.memStats(), emu: Object.values(emu).map(({ mips, jitShare, clock, compiled }) => ({ mips, jitShare, clock, compiled })) };
    await new Promise((r) => setTimeout(r, 5000));
  }
}

main().catch((e) => { statusEl.textContent = `failed: ${String(e)}`; (window as unknown as { kubeNode: unknown }).kubeNode = { marks, error: String(e) }; });
