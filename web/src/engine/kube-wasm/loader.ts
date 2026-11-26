// Loads kube.wasm (the Kubernetes control plane and kubectl compiled for
// GOOS=js, see tools/kube-wasm) into the current tab. Dev-only for now: the
// demo page uses it; nothing in the site imports it yet.

import { createMemFs } from './memfs';

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
}

/** The API kube.wasm installs as globalThis.kubeWasm. */
export interface KubeWasm {
  start(opts?: StartOptions): Promise<void>;
  /** Resolves when kube-apiserver answers /readyz; returns phase timings in ms. */
  ready(): Promise<Record<string, number>>;
  timings(): Record<string, number>;
  kubectl(args: string[], stdin?: string): Promise<KubectlResult>;
}

export interface LoadOptions {
  wasmUrl: string;
  wasmExecUrl: string;
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
  go.env = { HOME: '/root', USER: 'root', PATH: '/usr/bin' };

  const t0 = performance.now();
  const module = await WebAssembly.compileStreaming(fetch(o.wasmUrl));
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
