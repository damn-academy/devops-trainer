// Dev-only terminal for kube.wasm. Open /src/engine/kube-wasm/demo.html under
// `npm run dev` after copying the build output (kube.wasm, wasm_exec.js) into
// ./dist next to this file. window.kubeDemo is the hook the measuring script
// drives.

import { loadKubeWasm, splitArgs, type KubectlResult, type Loaded } from './loader';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const output = $<HTMLPreElement>('#out');
const input = $<HTMLInputElement>('#cmd');
const status = $<HTMLSpanElement>('#status');

function print(text: string, cls = '') {
  const span = document.createElement('span');
  if (cls) span.className = cls;
  span.textContent = text.endsWith('\n') || text === '' ? text : text + '\n';
  output.appendChild(span);
  output.scrollTop = output.scrollHeight;
}

interface RunResult extends KubectlResult {
  ms: number;
}

let loaded: Loaded | undefined;

/** Runs `kubectl ...`; a trailing `| wc -l` counts stdout lines. */
async function run(line: string, stdin = ''): Promise<RunResult> {
  if (!loaded) throw new Error('not loaded');
  let text = line.trim();
  let wc = false;
  const pipe = text.match(/\|\s*wc\s+-l\s*$/);
  if (pipe) {
    wc = true;
    text = text.slice(0, pipe.index).trim();
  }
  const args = splitArgs(text);
  if (args[0] === 'kubectl') args.shift();
  const t = performance.now();
  const r = await loaded.api.kubectl(args, stdin);
  const ms = performance.now() - t;
  if (wc) r.stdout = `${r.stdout.split('\n').filter((l, i, a) => l !== '' || i < a.length - 1).length}\n`;
  return { ...r, ms };
}

async function memory(): Promise<Record<string, number>> {
  const out: Record<string, number> = { wasmLinearMemory: loaded?.wasmMemoryBytes() ?? 0 };
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number; totalJSHeapSize: number };
    measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
  };
  if (perf.memory) out.usedJSHeapSize = perf.memory.usedJSHeapSize;
  if (crossOriginIsolated && perf.measureUserAgentSpecificMemory) {
    try {
      out.userAgentSpecificMemory = (await perf.measureUserAgentSpecificMemory()).bytes;
    } catch {
      // not available in this browser configuration
    }
  }
  return out;
}

async function boot() {
  const params = new URLSearchParams(location.search);
  const t0 = performance.now();
  status.textContent = 'downloading and compiling kube.wasm...';
  loaded = await loadKubeWasm({
    wasmUrl: params.get('wasm') ?? './dist/kube.wasm',
    wasmExecUrl: params.get('exec') ?? './dist/wasm_exec.js',
    onOutput: (fd, text) => {
      if (params.has('logs')) print(text, 'log');
      else (fd === 2 ? console.warn : console.log)(text);
    },
  });
  status.textContent = `compiled in ${Math.round(loaded.timings.compileMs)} ms; starting control plane...`;
  await loaded.api.start({ v: Number(params.get('v') ?? 0) });
  const phases = await loaded.api.ready();
  const total = performance.now() - t0;
  status.textContent = `apiserver ready ${Math.round(total)} ms after page start`;
  print(`# compile ${Math.round(loaded.timings.compileMs)} ms, runtime init ${Math.round(loaded.timings.initMs)} ms, ` +
    `control plane phases (ms since start()): ${JSON.stringify(phases)}`, 'log');
  input.disabled = false;
  input.focus();
  return { compileMs: loaded.timings.compileMs, initMs: loaded.timings.initMs, phases, totalMs: total };
}

const history: string[] = [];
let hpos = 0;
input.addEventListener('keydown', async (e) => {
  if (e.key === 'ArrowUp' && hpos > 0) input.value = history[--hpos];
  if (e.key === 'ArrowDown' && hpos < history.length) input.value = history[++hpos] ?? '';
  if (e.key !== 'Enter' || !input.value.trim()) return;
  const line = input.value;
  history.push(line);
  hpos = history.length;
  input.value = '';
  input.disabled = true;
  print(`$ ${line}`, 'cmd');
  const stdin = ($<HTMLTextAreaElement>('#stdin')).value;
  try {
    const r = await run(line, stdin);
    if (r.stdout) print(r.stdout);
    if (r.stderr) print(r.stderr, 'err');
    print(`# exit ${r.code}, ${Math.round(r.ms)} ms`, 'log');
  } catch (err) {
    print(String(err), 'err');
  }
  input.disabled = false;
  input.focus();
});

const booted = boot().catch((err) => {
  status.textContent = `failed: ${String(err)}`;
  throw err;
});

(window as unknown as { kubeDemo: unknown }).kubeDemo = { booted, run, memory };
