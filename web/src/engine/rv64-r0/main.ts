// RV64 track, stage R0: run a fixed measurement script against TinyEMU in this
// tab. Not part of the course; driven by hand or by measure.mjs (Playwright).
// Results land in window.__r0 and in the #results block as JSON.

type Engine = 'r0' | 'r0slice' | 'bellard';
type Disk = 'alpine' | 'busybox';

interface EmuModule {
  ccall: (name: string, ret: null, types: string[], args: unknown[]) => void;
  cwrap: (name: string, ret: string | null, types: string[]) => (...a: number[]) => number;
  HEAPU8?: Uint8Array;
  wasmMemory?: WebAssembly.Memory;
}

interface R0Result {
  engine: Engine;
  disk: Disk;
  memMB: number;
  userAgent: string;
  hardwareConcurrency: number;
  crossOriginIsolated: boolean;
  steps: Record<string, unknown>;
  errors: string[];
  done: boolean;
}

declare global {
  interface Window {
    __r0?: R0Result;
    // globals the precompiled 2019 JSLinux build expects
    Module?: Record<string, unknown>;
    term?: { write(s: string): void; getSize(): [number, number] };
    update_downloading?: (flag: boolean) => void;
    net_state?: null;
    graphic_display?: null;
    createTinyEmu?: (m: Record<string, unknown>) => Promise<EmuModule>;
  }
}

const BASE = '/rv64-r0/';
const COLS = 200;
const ROWS = 50;
const resultsEl = document.getElementById('results') as HTMLPreElement;
const consoleEl = document.getElementById('console') as HTMLPreElement;

let out = '';
let pushChar: (c: number) => void = () => {};
let mod: EmuModule | null = null;
let cyclesFn: (() => number) | null = null;
let busyFn: (() => number) | null = null;
let consoleDirty = false;

function onConsole(s: string): void {
  out += s;
  if (!consoleDirty) {
    consoleDirty = true;
    requestAnimationFrame(() => {
      consoleDirty = false;
      consoleEl.textContent = out.slice(-200000);
      consoleEl.scrollTop = consoleEl.scrollHeight;
    });
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`cannot load ${src}`));
    document.head.appendChild(s);
  });
}

async function startEngine(engine: Engine, cfgUrl: string, memMB: number, cmdline: string): Promise<void> {
  if (engine !== 'bellard') {
    await loadScript(`${BASE}tinyemu/riscvemu64-r0${engine === 'r0slice' ? '-slice' : ''}.js`);
    const m = await window.createTinyEmu!({
      locateFile: (p: string) => `${BASE}tinyemu/${p}`,
      r0ConsoleWrite: onConsole,
      r0ConsoleSize: () => [COLS, ROWS],
      r0Debug: new URLSearchParams(location.search).has('debug'),
    });
    mod = m;
    const q = m.cwrap('console_queue_char', null, ['number']);
    pushChar = (c) => { q(c); };
    cyclesFn = m.cwrap('r0_cycles', 'number', []) as () => number;
    busyFn = m.cwrap('r0_busy_ms', 'number', []) as () => number;
    m.ccall('vm_start', null,
      ['string', 'number', 'string', 'string', 'number', 'number', 'number'],
      [cfgUrl, memMB, cmdline, null, 0, 0, 0]);
    return;
  }
  // The 2019 JSLinux build reads these globals and calls Module.preRun.
  window.term = { write: onConsole, getSize: () => [COLS, ROWS] };
  window.update_downloading = () => {};
  window.net_state = null;
  window.graphic_display = null;
  await new Promise<void>((resolve, reject) => {
    const M: Record<string, unknown> = {
      locateFile: (p: string) => `${BASE}src/jslinux-2019-12-21/${p}`,
      preRun: () => {
        const m = window.Module as unknown as EmuModule;
        mod = m;
        const q = m.cwrap('console_queue_char', null, ['number']);
        pushChar = (c) => { q(c); };
        m.ccall('vm_start', null,
          ['string', 'number', 'string', 'string', 'number', 'number', 'number', 'string'],
          [cfgUrl, memMB, cmdline, null, 0, 0, 0, '']);
        resolve();
      },
    };
    window.Module = M;
    loadScript(`${BASE}src/jslinux-2019-12-21/riscvemu64-wasm.js`).catch(reject);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(re: RegExp, from: number, timeoutMs: number): Promise<RegExpExecArray> {
  const t0 = performance.now();
  for (;;) {
    re.lastIndex = 0;
    const m = re.exec(out.slice(from));
    if (m) return m;
    if (performance.now() - t0 > timeoutMs) throw new Error(`timeout waiting for ${re}`);
    await sleep(2);
  }
}

let seq = 0;
/** Types a command, waits for its end marker; returns host wall time and output. */
async function run(cmd: string, timeoutMs = 120_000): Promise<{ ms: number; text: string; mips?: number; busyShare?: number }> {
  seq += 1;
  const n = 1000 + seq;
  // The marker is computed by the shell, so the echoed input never matches it.
  const line = `${cmd}; echo R0END-$((${n}+0))\n`;
  const from = out.length;
  const c0 = cyclesFn?.() ?? 0;
  const b0 = busyFn?.() ?? 0;
  const t0 = performance.now();
  for (const ch of line) pushChar(ch.charCodeAt(0));
  const m = await waitFor(new RegExp(`R0END-${n}\\b`), from, timeoutMs);
  const ms = performance.now() - t0;
  const text = out.slice(from, from + m.index);
  const res: { ms: number; text: string; mips?: number; busyShare?: number } = { ms: round(ms), text };
  if (cyclesFn && busyFn) {
    const dc = cyclesFn() - c0;
    const db = busyFn() - b0;
    res.mips = db > 0 ? round(dc / db / 1000) : 0;
    res.busyShare = round(db / ms);
  }
  return res;
}

const round = (x: number) => Math.round(x * 100) / 100;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function guestMs(text: string, tag = 'R0T'): number | null {
  const m = new RegExp(`${tag} \\S+ rc=(\\d+) ms=(\\d+)`).exec(text);
  return m ? Number(m[2]) : null;
}

async function memory(): Promise<Record<string, number | null>> {
  const r: Record<string, number | null> = {
    wasmHeapMB: mod?.HEAPU8 ? round(mod.HEAPU8.length / 2 ** 20) : null,
    jsHeapUsedMB: null,
    uaMemoryMB: null,
  };
  const pm = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  if (pm) r.jsHeapUsedMB = round(pm.usedJSHeapSize / 2 ** 20);
  const p = performance as unknown as { measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }> };
  if (crossOriginIsolated && p.measureUserAgentSpecificMemory) {
    try {
      r.uaMemoryMB = round((await p.measureUserAgentSpecificMemory()).bytes / 2 ** 20);
    } catch {
      r.uaMemoryMB = null;
    }
  }
  return r;
}

function blockFetches(): { count: number; MB: number } {
  const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const blk = entries.filter((e) => /\/blk\d+\.bin$/.test(e.name));
  return { count: blk.length, MB: round(blk.reduce((a, e) => a + (e.encodedBodySize || 0), 0) / 2 ** 20) };
}

async function measure(engine: Engine, disk: Disk, memMB: number, k8s: boolean, only: string | null): Promise<void> {
  performance.setResourceTimingBufferSize(100_000);
  const r: R0Result = {
    engine, disk, memMB, userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency,
    crossOriginIsolated, steps: {}, errors: [], done: false,
  };
  window.__r0 = r;
  const show = () => { resultsEl.textContent = JSON.stringify(r, null, 2); };
  const step = async (name: string, f: () => Promise<unknown>) => {
    if (only && name !== 'boot' && !only.split(',').includes(name)) return;
    try {
      r.steps[name] = await f();
    } catch (e) {
      r.errors.push(`${name}: ${(e as Error).message}`);
    }
    show();
  };

  const cfg = disk === 'alpine' ? `${BASE}alpine-r0.cfg` : `${BASE}busybox-r0.cfg`;
  const t0 = performance.now();
  // TinyEMU only fetches over HTTP when the address is absolute.
  await startEngine(engine, new URL(cfg, location.href).href, memMB, `r0epoch=${Math.floor(Date.now() / 1000)}`);
  await step('boot', async () => {
    const re = disk === 'alpine' ? /R0-BOOTED uptime=([\d.]+)/ : /~ # $/;
    const m = await waitFor(re, 0, 300_000);
    await sleep(500);
    return {
      hostMs: round(performance.now() - t0 - 500),
      guestUptimeS: m[1] ? Number(m[1]) : null,
      blocks: blockFetches(),
      ...(await memory()),
    };
  });

  await step('roundTrip', async () => {
    const xs: number[] = [];
    for (let i = 0; i < 15; i++) xs.push((await run('true')).ms);
    return { medianMs: median(xs), minMs: Math.min(...xs), maxMs: Math.max(...xs), samples: xs };
  });

  await step('shellLoop20k', async () => {
    const res = await run('i=0; while [ $i -lt 20000 ]; do i=$((i+1)); done');
    return { hostMs: res.ms, mips: res.mips, busyShare: res.busyShare };
  });

  if (disk === 'alpine') {
    await step('coremark', async () => {
      const res = await run('r0bench coremark', 600_000);
      const ips = /Iterations\/Sec\s*:\s*([\d.]+)/.exec(res.text);
      return { hostMs: res.ms, iterPerSec: ips ? Number(ips[1]) : null, mips: res.mips, busyShare: res.busyShare,
        raw: res.text.split('\n').filter((l) => /Iter|time|Correct|ERROR/.test(l)).map((l) => l.trim()) };
    });
    for (const [name, cmd, reps] of [
      ['goHello', 'r0bench hello', 3],
      ['goHeavy', 'r0bench heavy', 2],
      ['kubectlVersion', 'r0bench kubectl', 2],
    ] as const) {
      await step(name, async () => {
        const runs = [];
        for (let i = 0; i < reps; i++) {
          const res = await run(cmd, 600_000);
          runs.push({ hostMs: res.ms, guestMs: guestMs(res.text), mips: res.mips,
            text: res.text.split('\n').slice(1, 12).map((l) => l.trim()).filter(Boolean) });
        }
        return { runs, blocks: blockFetches(), ...(await memory()) };
      });
    }
    if (k8s) {
      await step('k8s', async () => {
        const res = await run('r0k8s', 1_800_000);
        const ev: Record<string, string> = {};
        for (const l of res.text.split('\n')) {
          const m = /^R0K (\S+) (.*)$/.exec(l.trim());
          if (m) ev[m[1] + (ev[m[1]] ? '#' + Object.keys(ev).length : '')] = m[2];
        }
        return { hostMs: res.ms, mips: res.mips, events: ev, blocks: blockFetches(), ...(await memory()) };
      });
    }
  }
  await step('memoryEnd', memory);
  r.done = true;
  show();
}

const form = document.getElementById('form') as HTMLFormElement;
const params = new URLSearchParams(location.search);
for (const k of ['engine', 'disk', 'mem']) {
  const v = params.get(k);
  const el = form.elements.namedItem(k) as HTMLInputElement | null;
  if (v && el) el.value = v;
}
if (params.get('k8s') === '1') (form.elements.namedItem('k8s') as HTMLInputElement).checked = true;

function go(): void {
  const fd = new FormData(form);
  form.querySelector('button')!.disabled = true;
  void measure(fd.get('engine') as Engine, fd.get('disk') as Disk, Number(fd.get('mem')), fd.get('k8s') === '1', params.get('only'));
}
form.addEventListener('submit', (e) => { e.preventDefault(); go(); });
if (params.get('auto') === '1') go();
export {};
