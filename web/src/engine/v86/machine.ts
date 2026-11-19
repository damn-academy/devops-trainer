// A real Linux machine (tier B, design 09 §1.4) behind the same Machine
// interface as the simulator: lessons and checks do not care which one runs.
//
// The emulator lives in its own worker. The page talks to the guest through two
// serial ports: ttyS0 is the learner's raw terminal (xterm ↔ serial, the
// guest's own line editing), ttyS1 is a service shell used for exec() and
// facts(). The first start boots the kernel (about a second or two with the
// JIT), sets up the prompt marker and the service shell, and saves the state
// to OPFS; every later start restores that state instead of booting.

import type { ExecResult, Facts, Machine, SimEvent } from '../../core/types';
import { assetUrl, IMAGE, loadManifest, wasmAssetUrl } from './assets';
import type { BootConfig, WorkerIn, WorkerOut } from './messages';
import { factsScript, frameCommand, hideService, parseFacts, PromptTracker, ServiceParser, shq, watchedPaths, type PromptMark } from './protocol';
import { loadState, saveState } from './state-cache';

/** Bump when the bootstrap below changes: old saved states no longer match it. */
export const BOOTSTRAP_VERSION = 3;

export interface Identity {
  hostname: string;
  /** '10.0.0.11/24' */
  ip?: string;
  /** Locally administered MAC: '02:64:74:00:00:01'. */
  mac?: string;
}

/** How the page reaches the emulator: a dedicated worker in the browser, in-process in tests. */
export interface Transport {
  post(m: WorkerIn, transfer?: Transferable[]): void;
  terminate(): void;
}
export type TransportFactory = (onMessage: (m: WorkerOut) => void, onError: (message: string) => void, name: string) => Transport;

export const workerTransport: TransportFactory = (onMessage, onError, name) => {
  const w = new Worker(new URL('./v86.worker.ts', import.meta.url), { type: 'module', name });
  w.onmessage = (ev: MessageEvent<WorkerOut>) => onMessage(ev.data);
  w.onerror = (ev) => onError(ev.message || 'the emulator worker failed');
  return { post: (m, transfer = []) => w.postMessage(m, transfer), terminate: () => w.terminate() };
};

/** Files of the machine; by default the ones in public/v86 of this build. */
export interface MachineAssets {
  wasm: string;
  bios: string;
  vgaBios: string;
  bzimage: string;
  /** Part of the boot-snapshot key: a new kernel never restores an old state. */
  kernelSha: string;
}

export async function defaultAssets(): Promise<MachineAssets> {
  const manifest = await loadManifest();
  if (!manifest) throw new Error('v86 assets are missing in this build (run `npm run fetch:v86`)');
  return {
    wasm: wasmAssetUrl(),
    bios: assetUrl(IMAGE.bios),
    vgaBios: assetUrl(IMAGE.vgaBios),
    bzimage: assetUrl(IMAGE.kernel),
    kernelSha: manifest.files[IMAGE.kernel]?.sha256.slice(0, 12) ?? 'x',
  };
}

export interface V86MachineOptions {
  transport?: TransportFactory;
  assets?: MachineAssets;
  id?: string;
  identity?: Partial<Identity>;
  /** Guest memory; the Buildroot image is comfortable in 32 MB. */
  memoryMB?: number;
  /** Start from (and save) the boot snapshot in OPFS. Default true. */
  bootCache?: boolean;
  /** OPFS key of this lab's own saved machine: when present, the machine continues from it. */
  stateKey?: string;
  /** Printed (dimmed) between the kernel boot log and the first prompt of a cold boot. */
  bootBanner?: string;
  /** Paths whose facts are collected (also taken from check predicates with watchPredicates). */
  watch?: string[];
}

export type BootPhase = 'download' | 'boot' | 'setup' | 'ready' | 'error';

export interface BootInfo {
  /** 'cold': the kernel booted in this tab; 'restored': started from a saved state. */
  kind: 'cold' | 'restored';
  /** From pressing start to the first prompt the learner can type at. */
  ms: number;
  /** Bytes fetched from the network for this start (0 when everything was cached). */
  downloaded: number;
}

const enc = new TextEncoder();
const dec = () => new TextDecoder();

let seq = 0;

export class V86Machine implements Machine {
  readonly kind = 'v86' as const;
  readonly id: string;
  readonly identity: Identity;
  readonly memoryMB: number;
  phase: BootPhase = 'download';
  boot: BootInfo | null = null;
  error: string | null = null;
  /** Called with each Ethernet frame the guest sends (set by the switch adapter). */
  netOut: ((frame: Uint8Array) => void) | null = null;

  private worker: Transport | null = null;
  private transportFactory: TransportFactory;
  private assets?: MachineAssets;
  private tracker = new PromptTracker();
  private svc = new ServiceParser();
  private dec0 = dec();
  private dec1 = dec();
  private outListeners = new Set<(text: string) => void>();
  private phaseListeners = new Set<(p: BootPhase, detail?: string) => void>();
  private busListeners = new Set<(e: SimEvent) => void>();
  private replies = new Map<number, (r: { out: string; exit: number }) => void>();
  private workerReplies = new Map<number, (m: WorkerOut) => void>();
  private watch = new Set<string>();
  private bootBuffer = '';
  private forwarding = false;
  private readyWaiter: ((text: string) => void) | null = null;
  private bootCache: boolean;
  private stateKey?: string;
  private bootBanner?: string;
  /** True when start() continued the learner's own saved machine. */
  resumed = false;
  private downloaded = 0;
  private nextId = 1;

  constructor(o: V86MachineOptions = {}) {
    this.id = o.id ?? `v86-${++seq}`;
    this.identity = { hostname: o.identity?.hostname ?? 'linux', ip: o.identity?.ip, mac: o.identity?.mac };
    this.memoryMB = o.memoryMB ?? 32;
    this.bootCache = o.bootCache ?? true;
    this.transportFactory = o.transport ?? workerTransport;
    this.assets = o.assets;
    this.stateKey = o.stateKey;
    this.bootBanner = o.bootBanner;
    for (const p of o.watch ?? []) this.watch.add(p);
  }

  // ── events ──────────────────────────────────────────────────────────────

  /** Text for the terminal (prompt markers already removed). */
  onOutput(fn: (text: string) => void): () => void {
    this.outListeners.add(fn);
    return () => this.outListeners.delete(fn);
  }

  onPhase(fn: (p: BootPhase, detail?: string) => void): () => void {
    this.phaseListeners.add(fn);
    return () => this.phaseListeners.delete(fn);
  }

  on(fn: (ev: SimEvent) => void): () => void {
    this.busListeners.add(fn);
    return () => this.busListeners.delete(fn);
  }

  private emit(t: string, data: Record<string, unknown> = {}) {
    const ev: SimEvent = { t, at: Date.now(), machine: this.id, ...data };
    for (const fn of this.busListeners) fn(ev);
  }

  private setPhase(p: BootPhase, detail?: string) {
    this.phase = p;
    for (const fn of this.phaseListeners) fn(p, detail);
  }

  private print(text: string) {
    for (const fn of this.outListeners) fn(text);
  }

  // ── start ───────────────────────────────────────────────────────────────

  private cacheKey(): string {
    return `boot-${IMAGE.kernel}-${this.memoryMB}m-b${BOOTSTRAP_VERSION}`;
  }

  async start(): Promise<BootInfo> {
    const t0 = performance.now();
    try {
      const a = this.assets ?? (await defaultAssets());
      const key = `${this.cacheKey()}-${a.kernelSha}`;
      const resumed = this.stateKey ? await loadState(this.stateKey) : null;
      this.resumed = !!resumed;
      const saved = resumed ?? (this.bootCache ? await loadState(key) : null);
      const config: BootConfig = {
        wasm: a.wasm,
        bios: a.bios,
        vgaBios: a.vgaBios,
        bzimage: a.bzimage,
        cmdline: 'tsc=reliable mitigations=off random.trust_cpu=on console=ttyS0',
        memoryMB: this.memoryMB,
        nic: 'ne2k',
        initialState: saved ?? undefined,
      };
      this.worker = this.transportFactory(
        (m) => this.onWorker(m),
        (msg) => this.fail(msg),
        `v86 ${this.id}`,
      );
      const ready = new Promise<{ ms: number; restored: boolean }>((resolve, reject) => {
        this.onReady = resolve;
        this.onBootFail = reject;
      });
      this.send({ op: 'boot', config }, saved ? [saved] : []);
      const r = await ready;
      if (r.restored) {
        this.setPhase('setup');
        this.forwarding = true;
        await this.afterRestore();
      } else {
        this.setPhase('boot');
        await this.waitFor(/[#$%] $/, 120_000);
        this.setPhase('setup');
        await this.bootstrap();
        if (this.bootCache) {
          const st = await this.saveRaw();
          void saveState(key, st);
        }
        await this.applyIdentity();
        if (this.bootBanner) this.print(this.bootBanner);
        this.forwarding = true;
        this.write('\r');
      }
      this.boot = { kind: r.restored ? 'restored' : 'cold', ms: Math.round(performance.now() - t0), downloaded: this.downloaded };
      this.setPhase('ready');
      this.emit('machine.ready', { boot: this.boot });
      return this.boot;
    } catch (e) {
      this.fail((e as Error).message);
      throw e;
    }
  }

  private onReady: ((r: { ms: number; restored: boolean }) => void) | null = null;
  private onBootFail: ((e: Error) => void) | null = null;

  private fail(message: string) {
    this.error = message;
    this.setPhase('error', message);
    this.onBootFail?.(new Error(message));
    this.onBootFail = null;
    this.onReady = null;
  }

  private send(m: WorkerIn, transfer: Transferable[] = []) {
    this.worker?.post(m, transfer);
  }

  private onWorker(m: WorkerOut) {
    switch (m.op) {
      case 'progress':
        if (m.total) this.downloaded = Math.max(this.downloaded, m.loaded);
        this.setPhase('download', `${m.file} ${m.loaded}/${m.total}`);
        break;
      case 'ready':
        this.onReady?.({ ms: m.ms, restored: m.restored });
        this.onReady = null;
        this.onBootFail = null;
        break;
      case 'serial':
        if (m.port === 0) this.onTty0(this.dec0.decode(m.bytes, { stream: true }));
        else if (m.port === 1) for (const r of this.svc.feed(this.dec1.decode(m.bytes, { stream: true }))) this.replies.get(r.id)?.(r);
        break;
      case 'net':
        this.netOut?.(m.frame);
        break;
      case 'saved':
      case 'restored':
      case 'stats':
        this.workerReplies.get(m.id)?.(m);
        this.workerReplies.delete(m.id);
        break;
      case 'error':
        if (m.id !== undefined && this.workerReplies.has(m.id)) {
          this.workerReplies.get(m.id)?.(m);
          this.workerReplies.delete(m.id);
        } else this.fail(m.message);
        break;
    }
  }

  private onTty0(text: string) {
    const before = this.tracker.count;
    const { text: clean, marks } = this.tracker.output(text);
    if (this.forwarding) {
      if (clean) this.print(clean);
      const record = this.tracker.count > before ? this.tracker.records.at(-1) : undefined;
      for (const mk of marks) this.emit('cmd.done', { exit: mk.exit, cwd: mk.cwd, record });
      return;
    }
    // Before the learner gets the terminal: the kernel log is shown, the bootstrap is not.
    this.bootBuffer += clean;
    if (this.phase === 'boot' || this.phase === 'download') this.print(clean);
    this.readyWaiter?.(this.bootBuffer);
  }

  private waitFor(re: RegExp, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.readyWaiter = null;
        reject(new Error(`the machine did not answer in ${Math.round(timeout / 1000)} s`));
      }, timeout);
      const check = (buf: string) => {
        if (re.test(buf)) {
          clearTimeout(timer);
          this.readyWaiter = null;
          this.bootBuffer = '';
          resolve();
        }
      };
      this.readyWaiter = check;
      check(this.bootBuffer);
    });
  }

  /**
   * Typed once into the fresh shell with echo off, never shown: the prompt
   * marker, the service shell on ttyS1, the hostname. Control characters are
   * produced by printf inside the guest, so nothing raw goes through the line editor.
   */
  private async bootstrap(): Promise<void> {
    const ps1 = `"\\[$(printf '\\033')]777;dt;\\$?;\\$PWD$(printf '\\007')\\]\\u@\\h:\\w\\\\$ "`;
    const lines = [
      'stty -echo',
      `echo $$ > /tmp/.dt-shell; export PS1=${ps1}; cd /root 2>/dev/null || cd /`,
      `(setsid sh -c 'stty -echo -onlcr; echo $$ > /tmp/.dt-svc; PS1= exec sh' </dev/ttyS1 >/dev/ttyS1 2>&1 &)`,
      `stty echo; printf '\\036READY\\n'`,
    ];
    this.write(lines.join('\n') + '\n', false);
    await this.waitFor(/\x1eREADY/, 30_000);
    // The service shell needs a moment to start; probe it until it answers.
    for (let i = 0; i < 50; i++) {
      const r = await Promise.race([this.svcRun('echo ok'), new Promise<null>((res) => setTimeout(() => res(null), 400))]);
      if (r && r.out.includes('ok')) return;
    }
    throw new Error('the service channel (ttyS1) did not start');
  }

  /** Hostname, address and MAC of this machine, applied on every start (clones share one snapshot). */
  private async applyIdentity(): Promise<void> {
    const id = this.identity;
    const cmds = [`hostname ${shq(id.hostname)}`];
    if (id.mac || id.ip) cmds.push('ip link set eth0 down');
    if (id.mac) cmds.push(`ip link set eth0 address ${id.mac}`);
    if (id.ip) cmds.push('ip addr flush dev eth0', `ip addr add ${id.ip} dev eth0`);
    if (id.mac || id.ip) cmds.push('ip link set eth0 up');
    await this.svcRun(cmds.join('; '));
  }

  private async afterRestore(): Promise<void> {
    // The clock of a restored machine shows the moment of the snapshot (09 §1.4.4).
    await this.svcRun(`date -s @${Math.floor(Date.now() / 1000)} >/dev/null`);
    // A resumed lab keeps whatever the learner changed (even the hostname); a fresh clone gets its identity.
    if (!this.resumed) await this.applyIdentity();
    this.tracker.restore({ records: [], last: null });
    this.write('\r');
  }

  // ── the learner's terminal ──────────────────────────────────────────────

  /** Keystrokes from xterm to ttyS0. */
  write(data: string, track = true): void {
    if (track) this.tracker.input(data);
    this.send({ op: 'serial', port: 0, bytes: enc.encode(data) });
  }

  /** The guest draws its own prompt; the widget prints nothing itself. */
  prompt(): string {
    return '';
  }

  get lastMark(): PromptMark | null {
    return this.tracker.last;
  }

  // ── service channel ─────────────────────────────────────────────────────

  private svcRun(cmd: string, cwd?: string): Promise<{ out: string; exit: number }> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.replies.set(id, (r) => {
        this.replies.delete(id);
        resolve(r);
      });
      this.send({ op: 'serial', port: 1, bytes: enc.encode(frameCommand(id, cmd, cwd)) });
    });
  }

  /** Run a command as root in the learner's current directory, outside the learner's terminal. */
  async exec(line: string): Promise<ExecResult> {
    const r = await this.svcRun(line, this.tracker.last?.cwd);
    return { out: r.out, exit: r.exit };
  }

  /** Tell the guest the terminal size (TIOCSWINSZ on ttyS0); the shell rereads it at the next prompt. */
  resize(cols: number, rows: number): void {
    if (this.phase === 'ready') void this.svcRun(`stty -F /dev/ttyS0 cols ${Math.max(20, cols | 0)} rows ${Math.max(5, rows | 0)}`);
  }

  /** Collect facts for these paths too. */
  watchPaths(paths: string[]): void {
    for (const p of paths) this.watch.add(p);
  }

  /** Collect the paths that these predicates read. */
  watchPredicates(predicates: (string | undefined)[]): void {
    this.watchPaths(watchedPaths(predicates));
  }

  async facts(): Promise<Facts> {
    const svcPid = Number((await this.svcRun('cat /tmp/.dt-svc')).out.trim()) || undefined;
    const r = parseFacts((await this.svcRun(factsScript([...this.watch]))).out);
    const procs = hideService(r.procs, svcPid);
    const shell = procs.find((p) => p.pid === r.shellPid);
    const uid = shell?.uid ?? 0;
    const user = r.users.find((u) => u.uid === uid) ?? { name: 'root', uid: 0, gid: 0 };
    return {
      schema: 'dt.facts/v1',
      env: { kind: 'v86', machine: this.id, kernel: r.kernel, at: new Date().toISOString(), boot: this.boot },
      user: { name: user.name, uid: user.uid, gid: user.gid },
      cwd: this.tracker.last?.cwd ?? r.shellCwd ?? '/',
      hostname: r.hostname,
      vars: { '?': String(this.tracker.last?.exit ?? 0) },
      procs,
      files: r.files,
      term: { main: this.tracker.snapshot().records },
      users: r.users,
      groups: r.groups,
    } as Facts;
  }

  // ── snapshots ───────────────────────────────────────────────────────────

  private workerCall(m: WorkerIn & { id: number }, transfer: Transferable[] = []): Promise<WorkerOut> {
    return new Promise((resolve) => {
      this.workerReplies.set(m.id, resolve);
      this.send(m, transfer);
    });
  }

  private async saveRaw(): Promise<ArrayBuffer> {
    const r = await this.workerCall({ op: 'save', id: this.nextId++ });
    if (r.op !== 'saved') throw new Error(r.op === 'error' ? r.message : 'save failed');
    return r.state;
  }

  async snapshot(): Promise<{ state: ArrayBuffer; tracker: ReturnType<PromptTracker['snapshot']> }> {
    return { state: await this.saveRaw(), tracker: this.tracker.snapshot() };
  }

  async restore(s: unknown): Promise<void> {
    const snap = s as { state: ArrayBuffer; tracker: ReturnType<PromptTracker['snapshot']> };
    const copy = snap.state.slice(0);
    const r = await this.workerCall({ op: 'restore', id: this.nextId++, state: copy }, [copy]);
    if (r.op === 'error') throw new Error(r.message);
    this.tracker.restore(snap.tracker);
    this.svc = new ServiceParser();
    await this.svcRun(`date -s @${Math.floor(Date.now() / 1000)} >/dev/null`);
    this.write('\r', false);
  }

  /** Save the whole machine to OPFS under this lab's key (after a passed goal, on leaving). */
  async persist(): Promise<number | null> {
    if (!this.stateKey || this.phase !== 'ready') return null;
    return saveState(this.stateKey, await this.saveRaw());
  }

  /** Emulated instructions so far: shows that the CPU is really running. */
  async instructions(): Promise<number> {
    const r = await this.workerCall({ op: 'stats', id: this.nextId++ });
    return r.op === 'stats' ? r.instructions : 0;
  }

  /** An Ethernet frame for the guest's network card (from the switch). */
  netIn(frame: Uint8Array): void {
    this.send({ op: 'net', frame }, [frame.buffer]);
  }

  pause(): void {
    this.send({ op: 'pause' });
  }

  resume(): void {
    this.send({ op: 'resume' });
  }

  dispose(): void {
    this.send({ op: 'destroy' });
    setTimeout(() => this.worker?.terminate(), 500);
    this.outListeners.clear();
    this.busListeners.clear();
    this.phaseListeners.clear();
  }
}
