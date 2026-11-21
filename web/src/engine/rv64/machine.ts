import type { Machine, ExecResult, Facts, SimEvent } from '../../core/types';
import { ByteRing, FrameRing } from './ring';
import type { L2Switch } from '../v86/switch';
export interface RV64Options { id: string; kernel: ArrayBuffer; initrd: ArrayBuffer; memoryMB?: number; cmdline?: string; disk?: ArrayBuffer; network?: L2Switch }
/** Experimental engine: opt in with VITE_RV64=1. No lesson imports this module. */
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
  private decoder = new TextDecoder();
  private listeners = new Set<(event: SimEvent) => void>();
  private timer: ReturnType<typeof setInterval>;
  private disposed = false;
  private pending?: { marker: string; out: string; resolve: (r: ExecResult) => void; reject: (e: Error) => void; timeout: ReturnType<typeof setTimeout> };
  constructor(options: RV64Options) {
    if (import.meta.env.VITE_RV64 !== '1') throw new Error('RV64 is disabled; use VITE_RV64=1');
    if (!crossOriginIsolated || typeof SharedArrayBuffer === 'undefined') throw new Error('RV64 needs COOP/COEP and SharedArrayBuffer');
    this.id = options.id;
    this.network = options.network;
    this.network?.addPort(this.id, { mode: 'access' }, frame => {
      if (!this.netIn.write(frame)) this.emit('rv64.net.drop');
      Atomics.add(this.input.words, 2, 1); Atomics.notify(this.input.words, 2);
    });
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.ready = new Promise((resolve, reject) => {
      this.worker.onerror = (e) => { const error = new Error(e.message); reject(error); this.fail(error); };
      this.worker.onmessage = ({ data }) => {
        if (data.type === 'ready') resolve();
        if (data.type === 'error') { const error = new Error(data.error); reject(error); this.fail(error); }
        if (data.type === 'stopped') this.emit('rv64.stopped');
      };
    });
    const { network: _network, ...boot } = options;
    this.worker.postMessage({ ...boot, netIn: this.netIn.ring.buffer, netOut: this.netOut.ring.buffer, memoryMB: options.memoryMB ?? 512, input: this.input.buffer, output: this.output.buffer, control: this.control.buffer });
    this.timer = setInterval(() => this.drain(), 8);
  }
  private emit(t: string, extra: Record<string, unknown> = {}): void {
    for (const fn of this.listeners) fn({ t, at: Date.now(), machine: this.id, ...extra });
  }
  private fail(error: Error): void { if (this.pending) { clearTimeout(this.pending.timeout); this.pending.reject(error); this.pending = undefined; } this.emit('rv64.error', { error: error.message }); }
  private drain(): void {
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
    const data = new TextEncoder().encode(text);
    const free = this.input.bytes.length - ((Atomics.load(this.input.words, 1) - Atomics.load(this.input.words, 0)) >>> 0);
    if (data.length > free) throw new Error('RV64 input ring is full');
    this.input.write(data);
  }
  async exec(line: string): Promise<ExecResult> {
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
  async facts(): Promise<Facts> { throw new Error('RV64 guest facts collector is not implemented'); }
  async snapshot(): Promise<unknown> { throw new Error('RV64 snapshots are planned for R3'); }
  async restore(_snapshot: unknown): Promise<void> { throw new Error('RV64 snapshots are planned for R3'); }
  on(fn: (ev: SimEvent) => void): () => void { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  dispose(): void {
    if (this.disposed) return;
    this.network?.removePort(this.id);
    this.disposed = true; Atomics.store(this.control, 0, 1); Atomics.add(this.input.words, 2, 1); Atomics.notify(this.input.words, 2);
    this.worker.terminate(); clearInterval(this.timer); this.fail(new Error('RV64 machine disposed')); this.listeners.clear();
  }
}
