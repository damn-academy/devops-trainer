import type { Machine, ExecResult, Facts, SimEvent, TermRecord } from '../../core/types';
import { ByteRing, FrameRing } from './ring';
import type { HTTPDisk } from './block';
import { diskIdentity, sameDiskIdentity, type RV64Snapshot } from './snapshot';
export type { RV64Snapshot } from './snapshot';
import { factsScript, parseFacts, shq, watchedPaths } from '../v86/protocol';
import { LAB_SCOPES, labFactsScript, parseLabFacts, scopesOf } from '../v86/lab-facts';
import type { L2Switch } from '../v86/switch';
export interface RV64Options { id: string; kernel: ArrayBuffer; initrd: ArrayBuffer; memoryMB?: number; jitThreshold?: number; guestProfileInterval?: number; guestProfileTaskCommOffset?: number; cmdline?: string; disk?: ArrayBuffer; network?: L2Switch; httpDisk?: HTTPDisk; snapshot?: RV64Snapshot; snapshotURL?: string; restoreClock?: 'elapsed' | 'continuous' }
/** Experimental engine: opt in with VITE_RV64=1. snapshotURL accepts the paged
 * build artifact; ready means the restored engine can execute, not a Kubernetes
 * health assertion. restoreClock='continuous' excludes suspended time; the
 * default 'elapsed' includes it. Certificate checks remain active in both modes.
 * Large Ready nodes should use exportSnapshot(), since the
 * legacy in-memory snapshot() materializes the entire serialized state. */
export class RV64Machine implements Machine {
  readonly kind = 'rv64' as const;
  readonly id: string;
  readonly ready: Promise<void>;
  private worker: Worker;
  private network?: L2Switch;
  private netIn = new FrameRing(ByteRing.create());
  private netOut = new FrameRing(ByteRing.create());
  private input = ByteRing.create();
  private output = ByteRing.create();
  private control = new Int32Array(new SharedArrayBuffer(32));
  private metrics?: Record<string, unknown>;
  private decoder = new TextDecoder();
  private listeners = new Set<(event: SimEvent) => void>();
  private timer: ReturnType<typeof setInterval>;
  private disposed = false;
  private diskIdentity: string;
  private checkpoint?: { request: { op: string; state?: Uint8Array; pending?: Uint8Array; capturedAt?: number; uploadURL?: string; certificateAudit?: boolean }; resolve: (value: any) => void; reject: (error: Error) => void; restore?: RV64Snapshot };
  private frozen = false;
  private watch = new Set<string>();
  private scopes = new Set<string>();
  private history: TermRecord[] = [];
  private lastExit = 0;
  private pending?: { marker: string; out: string; resolve: (r: ExecResult) => void; reject: (e: Error) => void; timeout: ReturnType<typeof setTimeout> };
  constructor(options: RV64Options) {
    if (import.meta.env.VITE_RV64 !== '1') throw new Error('RV64 is disabled; use VITE_RV64=1');
    if (!crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') throw new Error('RV64 needs COOP/COEP and SharedArrayBuffer');
    this.id = options.id;
    if (options.snapshot && options.snapshotURL) throw new Error('Choose snapshot or snapshotURL');
    if (options.snapshot) {
      this.validateSnapshot(options.snapshot, diskIdentity(options.httpDisk));
      options.snapshot.rings.forEach((r, i) => new Uint8Array(this.rings()[i]).set(r));
      this.history = [...options.snapshot.history]; this.lastExit = options.snapshot.lastExit;
    }
    this.diskIdentity = diskIdentity(options.httpDisk);
    this.network = options.network;
    this.network?.addPort(this.id, { mode: 'access' }, frame => {
      if (this.frozen) { this.emit('rv64.net.drop'); return; }
      if (!this.netIn.write(frame)) this.emit('rv64.net.drop');
      Atomics.add(this.input.words, 2, 1); Atomics.notify(this.input.words, 2);
    });
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.ready = new Promise((resolve, reject) => {
      this.worker.onerror = (e) => { const error = new Error(e.message); reject(error); this.fail(error); };
      this.worker.onmessage = ({ data }) => {
        if (data.type === 'metrics') { this.metrics = data.metrics; this.emit('rv64.metrics', { metrics: data.metrics }); }
        if (data.type === 'ready') { if (data.history) { this.history = data.history; this.lastExit = data.lastExit; } resolve(); }
        if (data.type === 'paused' && this.checkpoint) this.worker.postMessage({ ...this.checkpoint.request,
          wrapper: { format: 'dt.rv64.snapshot/v1', rings: this.rings().map(r => new Uint8Array(r).slice()), history: [...this.history], lastExit: this.lastExit, diskIdentity: this.diskIdentity } });
        if (['checkpoint', 'exported', 'restored', 'checkpoint-error'].includes(data.type) && this.checkpoint) {
          const p = this.checkpoint; this.checkpoint = undefined;
          Atomics.store(this.control, 5, 0);
          if (data.type === 'checkpoint-error') p.reject(new Error(data.error));
          else if (data.type === 'exported') p.resolve(data.manifest);
          else if (data.type === 'checkpoint') p.resolve({ format: 'dt.rv64.snapshot/v1', state: data.state, pending: data.pending,
            rings: this.rings().map(r => new Uint8Array(r).slice()), history: [...this.history], lastExit: this.lastExit, diskIdentity: this.diskIdentity, capturedAt: data.capturedAt } satisfies RV64Snapshot);
          else {
            p.restore!.rings.forEach((r, i) => new Uint8Array(this.rings()[i]).set(r));
            this.history = [...p.restore!.history]; this.lastExit = p.restore!.lastExit;
            this.decoder = new TextDecoder(); p.resolve(undefined);
          }
          this.frozen = false; this.worker.postMessage({ op: 'resume' });
        }
        if (data.type === 'error') { const error = new Error(data.error); reject(error); this.fail(error); }
        if (data.type === 'stopped') this.emit('rv64.stopped');
      };
    });
    const { network: _network, ...boot } = options;
    let hash = 2166136261;
    for (const byte of new TextEncoder().encode(this.id)) hash = Math.imul(hash ^ byte, 16777619);
    const mac = new Uint8Array([2, 0x44, hash >>> 24, hash >>> 16, hash >>> 8, hash]);
    this.worker.postMessage({ ...boot, restoreClock: options.restoreClock, snapshotURL: options.snapshotURL ? new URL(options.snapshotURL, location.href).href : undefined, mac, netIn: this.netIn.ring.buffer, netOut: this.netOut.ring.buffer, memoryMB: options.memoryMB ?? 512, input: this.input.buffer, output: this.output.buffer, control: this.control.buffer });
    this.timer = setInterval(() => this.drain(), 8);
  }
  executionStats() {
    return { diagnostics: this.metrics, retired: Atomics.load(this.control,1)*1000, busyMilliseconds: Atomics.load(this.control,4)/1000,
      jitCompiled: Atomics.load(this.control,6), jitRetired: Atomics.load(this.control,7)*1000 };
  }
  private emit(t: string, extra: Record<string, unknown> = {}): void {
    for (const fn of this.listeners) fn({ t, at: Date.now(), machine: this.id, ...extra });
  }
  private fail(error: Error): void { this.checkpoint?.reject(error); this.checkpoint = undefined; if (this.pending) { clearTimeout(this.pending.timeout); this.pending.reject(error); this.pending = undefined; } this.emit('rv64.error', { error: error.message }); }
  private drain(): void {
    if (this.frozen) return;
    for (const frame of this.netOut.read()) this.network?.receive(this.id, frame);
    const bytes = this.output.read();
    if (!bytes.length) return;
    const text = this.decoder.decode(bytes, { stream: true }).replace(/\r/g, '');
    this.emit('rv64.console', { text });
    if (!this.pending) return;
    this.pending.out += text;
    const match = this.pending.out.match(new RegExp(`\n${this.pending.marker}:(\\d+)\n`));
    if (match) {
      const p = this.pending; this.pending = undefined; clearTimeout(p.timeout);
      p.resolve({ out: p.out.slice(0, match.index), exit: Number(match[1]) });
    }
  }
  send(text: string): void {
    if (this.disposed) throw new Error('RV64 machine is disposed');
    if (this.frozen) throw new Error('RV64 checkpoint in progress');
    const data = new TextEncoder().encode(text);
    const free = this.input.bytes.length - ((Atomics.load(this.input.words, 1) - Atomics.load(this.input.words, 0)) >>> 0);
    if (data.length > free) throw new Error('RV64 input ring is full');
    this.input.write(data);
  }
  async exec(line: string): Promise<ExecResult> {
    const result = await this.command(line);
    this.lastExit = result.exit;
    this.history.push({ line, ...result });
    this.history = this.history.slice(-20);
    return result;
  }
  private async command(line: string): Promise<ExecResult> {
    await this.ready;
    if (this.pending) throw new Error('RV64 command already running');
    // The marker is printed by printf, and cannot match the echoed command line.
    const marker = `RV64_${crypto.randomUUID().replace(/-/g, '')}`;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => this.fail(new Error('RV64 command timed out')), 120000);
      this.pending = { marker, out: '', resolve, reject, timeout };
      try { this.send(`${line}\nprintf '\\n${marker}:%s\\n' "$?"\n`); }
      catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))); }
    });
  }
  prompt(): string { return '# '; }
  watchPaths(paths: string[]): void { for (const path of paths) this.watch.add(path); }
  watchPredicates(predicates: (string | undefined)[]): void { this.watchPaths(watchedPaths(predicates)); for (const scope of scopesOf(predicates)) this.scopes.add(scope); }
  async facts(scope: string[] = []): Promise<Facts> {
    const scopes = [...new Set([...this.scopes, ...scope])].filter(s => (LAB_SCOPES as readonly string[]).includes(s));
    // Quote the multiline collector as one shell command, avoiding interactive
    // continuation prompts and echoed source being parsed as guest facts.
    const script = `echo $$ > /tmp/.dt-rv64-shell; ${factsScript([...this.watch], '/tmp/.dt-rv64-shell')}
${labFactsScript(scopes)}`;
    const result = await this.command(`eval "$(printf %s ${shq(btoa(String.fromCharCode(...new TextEncoder().encode(script))))} | base64 -d)"`);
    if (result.exit !== 0) throw new Error(`RV64 facts collector exited ${result.exit}`);
    const r = parseFacts(result.out);
    if (!r.kernel) throw new Error('RV64 facts collector returned no kernel');
    const shell = r.procs.find(p => p.pid === r.shellPid);
    const uid = shell?.uid ?? 0;
    const user = r.users.find(u => u.uid === uid);
    return { schema: 'dt.facts/v1', env: { kind: 'rv64', machine: this.id, kernel: r.kernel, at: new Date().toISOString() },
      user: { name: user?.name ?? String(uid), uid, gid: user?.gid ?? uid }, cwd: r.shellCwd ?? '/',
      hostname: r.hostname, vars: { '?': String(this.lastExit) }, procs: r.procs, files: r.files,
      users: r.users, groups: r.groups, term: { main: [...this.history] }, ...parseLabFacts(result.out) };
  }
  private rings(): SharedArrayBuffer[] { return [this.input.buffer, this.output.buffer, this.netIn.ring.buffer, this.netOut.ring.buffer]; }
  private async checkpointCall(op: string, restore?: RV64Snapshot, uploadURL?: string, certificateAudit = false): Promise<any> {
    await this.ready;
    if (this.disposed || this.pending || this.checkpoint) throw new Error('RV64 machine is busy or disposed');
    this.frozen = true;
    return new Promise((resolve, reject) => {
      this.checkpoint = { request: { op, uploadURL, certificateAudit, state: restore?.state, pending: restore?.pending, capturedAt: restore?.capturedAt }, resolve, reject, restore };
      Atomics.store(this.control, 5, 1); Atomics.add(this.input.words, 2, 1); Atomics.notify(this.input.words, 2);
    });
  }
  async exportSnapshot(uploadURL: string, certificateAudit = false): Promise<unknown> { return this.checkpointCall('export', undefined, new URL(uploadURL, location.href).href, certificateAudit); }
  async snapshot(): Promise<RV64Snapshot> { return this.checkpointCall('snapshot'); }
  async restore(snapshot: unknown): Promise<void> {
    this.validateSnapshot(snapshot, this.diskIdentity);
    await this.checkpointCall('restore', snapshot as RV64Snapshot);
  }
  private validateSnapshot(snapshot: unknown, diskIdentity: string): void {
    const s = snapshot as RV64Snapshot;
    if ((s?.capturedAt !== undefined && (!Number.isSafeInteger(s.capturedAt) || s.capturedAt <= 0 || s.capturedAt > Date.now() + 60000)) || s?.format !== 'dt.rv64.snapshot/v1' || !sameDiskIdentity(s.diskIdentity, diskIdentity) || !(s.state instanceof Uint8Array) || !(s.pending instanceof Uint8Array)
      || !Array.isArray(s.rings) || s.rings.length !== 4 || s.rings.some((r, i) => !(r instanceof Uint8Array) || r.length !== this.rings()[i].byteLength)) throw new Error('Invalid RV64 snapshot');

  }
  on(fn: (ev: SimEvent) => void): () => void { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  dispose(): void {
    if (this.disposed) return;
    this.checkpoint?.reject(new Error("RV64 machine disposed")); this.checkpoint = undefined;
    this.network?.removePort(this.id);
    this.disposed = true; Atomics.store(this.control, 0, 1); Atomics.add(this.input.words, 2, 1); Atomics.notify(this.input.words, 2);
    this.worker.terminate(); clearInterval(this.timer); this.fail(new Error('RV64 machine disposed')); this.listeners.clear();
  }
}
