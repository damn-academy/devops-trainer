// Loads kube.wasm (the Kubernetes control plane and kubectl compiled for
// GOOS=js, see tools/kube-wasm) into the current tab. Dev-only for now: the
// demo page uses it; nothing in the site imports it yet.

import { createMemFs } from './memfs';
import { fetchObject, OBJECT_CACHE, objectName, type Encoding } from '../rv64/objects';

export interface KubectlResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface StartOptions {
  /** klog verbosity of the components (default 0). */
  v?: number;
  controllers?: boolean;
  scheduler?: boolean;
  /** Extra kube-apiserver flags, e.g. ['--watch-cache=false']. */
  apiserverArgs?: string[];
  /** Extra kube-controller-manager flags. */
  controllerManagerArgs?: string[];
  /** Start from a saved state (see KubeWasm.saveState) instead of a new cluster. */
  restore?: ClusterState;
}

/** The API kube.wasm installs as globalThis.kubeWasm. */
export interface KubeWasm {
  start(opts?: StartOptions): Promise<void>;
  /** Resolves when kube-apiserver answers /readyz; returns phase timings in ms. */
  ready(): Promise<Record<string, number>>;
  timings(): Record<string, number>;
  /** Saves the PKI files and the store's contents. */
  saveState(): Promise<ClusterState>;
  /** Go heap profile in pprof format, after a collection. */
  heapProfile(): Promise<Uint8Array>;
  /** Go runtime memory statistics in bytes. */
  memStats(): { heapAlloc: number; heapSys: number; sys: number; numGC: number };
  kubectl(args: string[], stdin?: string): Promise<KubectlResult>;
  /** Opens a TCP stream to a listener inside kube.wasm, e.g. '127.0.0.1:6443'. */
  connect(addr: string, onData: (b: Uint8Array) => void, onClose: (err?: string) => void): BridgeConn;
  /** Listens inside kube.wasm; onConn gets each connection, to be started once the far side is open. Returns an error or null. */
  listen(addr: string, onConn: (c: BridgeConn & { start(onData: (b: Uint8Array) => void, onClose: (err?: string) => void): void }) => void): string | null;
  /** Creates a bootstrap token and returns a kuberoot worker Membership (JSON). */
  joinMembership(nodeName: string, nodeIP: string): Promise<string>;
}

export interface ClusterState {
  pki: Record<string, Uint8Array>;
  etcd: Uint8Array;
}

export interface BridgeConn {
  write(b: Uint8Array): void;
  /** Half-closes: no more data from this side. */
  end(): void;
  close(): void;
}

export interface LoadOptions {
  wasmUrl: string;
  /** A published kube.wasm (tools/kube-wasm/publish-node.mjs) instead of
   * wasmUrl: the object `<sha256>.<encoding>` in the directory `base`, kept
   * in Cache Storage. The encoding's own checksum (gzip: CRC-32) and the
   * WebAssembly validation catch a damaged copy; a cached one is fetched again. */
  wasmObject?: { base: string; sha256: string; bytes: number; encoding?: Encoding;
    /** Reads a whole object (zstd), e.g. in a worker; fetchObject by default. */
    read?: (base: string, ref: { sha256: string; bytes: number }, o: { encoding?: Encoding; cache?: boolean }) => Promise<Uint8Array> };
  wasmExecUrl: string;
  /** Extra environment for the Go program, e.g. GOGC or GOMEMLIMIT. */
  env?: Record<string, string>;
  /** Receives the Go process stdout (fd 1) and stderr (fd 2), line by line. */
  onOutput?: (fd: number, text: string) => void;
}

export interface Loaded {
  api: KubeWasm;
  /** Bytes of the Go linear memory right now. */
  wasmMemoryBytes(): number;
  /** Fetch + streaming compile, and instantiate + Go runtime init, in ms. */
  timings: { compileMs: number; initMs: number };
}

interface GoRuntime {
  argv: string[];
  env: Record<string, string>;
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
}

type GoGlobals = typeof globalThis & {
  Go?: new () => GoRuntime;
  fs?: unknown;
  kubeWasm?: KubeWasm;
  __kubeWasmLoaded?: () => void;
};

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`cannot load ${src}`));
    document.head.appendChild(s);
  });
}

export async function loadKubeWasm(o: LoadOptions): Promise<Loaded> {
  const g = globalThis as GoGlobals;
  if (g.kubeWasm) throw new Error('kube.wasm is already loaded in this tab');
  const out = o.onOutput ?? ((fd: number, text: string) => (fd === 2 ? console.warn : console.log)(text));

  // wasm_exec.js only installs its own stubs when these are missing. The
  // stub fs fails every call with ENOSYS; the control plane needs files.
  g.fs = createMemFs(out).fs;
  (g as unknown as { process: unknown }).process = {
    getuid: () => 0, getgid: () => 0, geteuid: () => 0, getegid: () => 0,
    getgroups: () => [0], pid: 1, ppid: 0, umask: () => 0o022,
    cwd: () => '/',
    chdir: () => { throw Object.assign(new Error('ENOSYS'), { code: 'ENOSYS' }); },
  };
  if (!g.Go) await loadScript(o.wasmExecUrl);
  const go = new g.Go!();
  go.argv = ['kube-wasm'];
  go.env = { HOME: '/root', USER: 'root', PATH: '/usr/bin', ...o.env };

  const t0 = performance.now();
  const module = o.wasmObject ? await compileObject(o.wasmObject) : await WebAssembly.compileStreaming(fetch(o.wasmUrl));
  const t1 = performance.now();
  const instance = await WebAssembly.instantiate(module, go.importObject);
  const loaded = new Promise<void>((resolve) => { g.__kubeWasmLoaded = resolve; });
  go.run(instance).then(
    () => out(2, 'kube.wasm: Go program exited'),
    (e: unknown) => out(2, `kube.wasm: Go program failed: ${String(e)}`),
  );
  await loaded;
  const t2 = performance.now();
  const mem = instance.exports.mem as WebAssembly.Memory;
  return {
    api: g.kubeWasm!,
    wasmMemoryBytes: () => mem.buffer.byteLength,
    timings: { compileMs: t1 - t0, initMs: t2 - t1 },
  };
}

async function compileObject(w: NonNullable<LoadOptions['wasmObject']>): Promise<WebAssembly.Module> {
  // zstd has no streaming decoder in the browser: decode whole, verify, compile.
  if (w.encoding === 'zstd') return WebAssembly.compile(await (w.read ?? fetchObject)(w.base, { sha256: w.sha256, bytes: w.bytes }, { encoding: w.encoding, cache: true }) as Uint8Array<ArrayBuffer>);
  const url = new URL(objectName(w.sha256, w.encoding), w.base).href;
  const cache = typeof caches !== 'undefined' ? await caches.open(OBJECT_CACHE).catch(() => undefined) : undefined;
  const encoding = w.encoding;
  const compile = (r: Response) => WebAssembly.compileStreaming(new Response(encoding ? r.body!.pipeThrough(new DecompressionStream(encoding)) : r.body,
    { headers: { 'Content-Type': 'application/wasm' } }));
  const hit = await cache?.match(url).catch(() => undefined);
  if (hit?.body) {
    try { return await compile(hit); } catch { await cache?.delete(url).catch(() => undefined); }
  }
  const r = await fetch(url, cache ? { cache: 'no-store' } : undefined);
  if (!r.ok || !r.body) throw new Error(`${url}: HTTP ${r.status}`);
  const [toCache, toCompile] = r.body.tee();
  const module = await compile(new Response(toCompile));
  // Stored only once it compiled: a damaged download never enters the cache.
  await cache?.put(url, new Response(toCache)).catch(() => undefined);
  return module;
}

/** Splits a command line like a POSIX shell would, minus expansions. */
export function splitArgs(line: string): string[] {
  const args: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  let has = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === '\\' && quote === '"' && i + 1 < line.length) cur += line[++i];
      else cur += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      has = true;
    } else if (c === '\\' && i + 1 < line.length) {
      cur += line[++i];
      has = true;
    } else if (/\s/.test(c)) {
      if (has) args.push(cur);
      cur = '';
      has = false;
    } else {
      cur += c;
      has = true;
    }
  }
  if (has) args.push(cur);
  return args;
}
