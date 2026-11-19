// A small TCP for the lab host (RFC 9293 subset), in the spirit of v86's
// fetch_network.js but with both passive and active open, a send queue that
// respects the peer's window, retransmission on timeout and an orderly close.
// No window scaling, SACK or timestamps: the host never offers them, so the
// guest's kernel does not use them either. Out-of-order segments are dropped
// and re-acknowledged (the switch delivers in order unless a lesson breaks it).

import { ACK, FIN, PSH, RST, SYN, seqDiff, type Tcp, utf8 } from './wire';

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(h: unknown): void;
}

export const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface Endpoint {
  ip: number;
  port: number;
}

export type TcpState = 'SYN_SENT' | 'SYN_RCVD' | 'ESTABLISHED' | 'CLOSE_WAIT' | 'FIN_WAIT' | 'LAST_ACK' | 'CLOSED';

/** Our receive window: data is handed to the application at once, so it never fills. */
const RCV_WND = 65535;
const MAX_INFLIGHT = 256 * 1024;
const RTO_MIN = 250;
const RTO_MAX = 4000;
const MAX_RETRIES = 12;

class ByteQueue {
  private chunks: Uint8Array[] = [];
  private head = 0;
  length = 0;

  push(b: Uint8Array) {
    if (b.length) {
      this.chunks.push(b);
      this.length += b.length;
    }
  }

  /** Copy `len` bytes starting `off` bytes after the front. */
  peek(off: number, len: number): Uint8Array {
    const out = new Uint8Array(Math.min(len, this.length - off));
    let skip = off + this.head;
    let o = 0;
    for (const c of this.chunks) {
      if (o >= out.length) break;
      if (skip >= c.length) {
        skip -= c.length;
        continue;
      }
      const n = Math.min(c.length - skip, out.length - o);
      out.set(c.subarray(skip, skip + n), o);
      o += n;
      skip = 0;
    }
    return out;
  }

  drop(n: number) {
    n = Math.min(n, this.length);
    this.length -= n;
    n += this.head;
    while (this.chunks.length && n >= this.chunks[0].length) n -= this.chunks.shift()!.length;
    this.head = n;
  }
}

export class TcpConn {
  state: TcpState;
  readonly local: Endpoint;
  readonly remote: Endpoint;
  readonly vlan: number;
  /** Bytes in each direction, for the panel. */
  rxBytes = 0;
  txBytes = 0;
  readonly openedAt: number;

  private iss: number;
  private sndUna: number;
  private sndNxt: number;
  private rcvNxt = 0;
  private peerWnd = 65535;
  private mss = 536;
  private out = new ByteQueue();
  private finQueued = false;
  private finSent = false;
  private finAcked = false;
  private peerFin = false;
  private timer: unknown = null;
  private rto = RTO_MIN;
  private retries = 0;
  private flushScheduled = false;
  private dataFns: ((b: Uint8Array) => void)[] = [];
  private endFns: (() => void)[] = [];
  private closeFns: ((err?: string) => void)[] = [];
  private openFns: ((err?: string) => void)[] = [];

  constructor(
    private o: {
      local: Endpoint;
      remote: Endpoint;
      vlan: number;
      clock: Clock;
      send: (t: Omit<Tcp, 'data'> & { data?: Uint8Array }) => void;
      onGone: (c: TcpConn) => void;
      iss?: number;
    },
    mode: 'active' | 'passive',
  ) {
    this.local = o.local;
    this.remote = o.remote;
    this.vlan = o.vlan;
    this.openedAt = o.clock.now();
    this.iss = o.iss ?? (Math.random() * 0xffffffff) >>> 0;
    this.sndUna = this.iss;
    this.sndNxt = this.iss;
    this.state = mode === 'active' ? 'SYN_SENT' : 'SYN_RCVD';
  }

  // ── application side ──

  onData(fn: (b: Uint8Array) => void): void {
    this.dataFns.push(fn);
  }
  /** The peer finished sending (FIN). */
  onEnd(fn: () => void): void {
    this.endFns.push(fn);
  }
  onClose(fn: (err?: string) => void): void {
    this.closeFns.push(fn);
  }
  /** Active open finished (or failed). */
  onOpen(fn: (err?: string) => void): void {
    this.openFns.push(fn);
  }

  get open(): boolean {
    return this.state === 'ESTABLISHED' || this.state === 'CLOSE_WAIT';
  }

  write(data: Uint8Array | string): void {
    if (this.finQueued || this.state === 'CLOSED') return;
    const b = typeof data === 'string' ? utf8(data) : data;
    this.out.push(b);
    this.scheduleFlush();
  }

  /** Send everything queued, then FIN. */
  end(): void {
    if (this.finQueued || this.state === 'CLOSED') return;
    this.finQueued = true;
    this.scheduleFlush();
  }

  /** Abort with RST. */
  destroy(reason = 'reset by the lab host'): void {
    if (this.state === 'CLOSED') return;
    if (this.state !== 'SYN_SENT') this.o.send({ sport: this.local.port, dport: this.remote.port, seq: this.sndNxt, ack: this.rcvNxt, flags: RST | ACK, window: 0 });
    this.close(reason);
  }

  // ── network side ──

  /** Active open: send SYN. */
  connect(): void {
    this.sendSyn();
  }

  private sendSyn() {
    const flags = this.state === 'SYN_SENT' ? SYN : SYN | ACK;
    this.o.send({ sport: this.local.port, dport: this.remote.port, seq: this.iss, ack: this.state === 'SYN_SENT' ? 0 : this.rcvNxt, flags, window: RCV_WND, mss: 1460 });
    this.sndNxt = (this.iss + 1) >>> 0;
    this.arm();
  }

  /** Passive open: a SYN arrived. */
  acceptSyn(t: Tcp): void {
    this.rcvNxt = (t.seq + 1) >>> 0;
    if (t.mss) this.mss = Math.min(t.mss, 1460);
    this.peerWnd = t.window;
    this.sendSyn();
  }

  segment(t: Tcp): void {
    if (this.state === 'CLOSED') return;
    if (t.flags & RST) {
      // Accept a RST only in the window (RFC 5961 lite).
      if (this.state === 'SYN_SENT' ? t.ack === this.sndNxt : seqDiff(t.seq, this.rcvNxt) >= 0 && seqDiff(t.seq, this.rcvNxt) < RCV_WND) this.close('connection reset by peer');
      return;
    }
    if (this.state === 'SYN_SENT') {
      if (t.flags & SYN && t.flags & ACK && t.ack === this.sndNxt) {
        this.rcvNxt = (t.seq + 1) >>> 0;
        this.sndUna = t.ack;
        if (t.mss) this.mss = Math.min(t.mss, 1460);
        this.peerWnd = t.window;
        this.state = 'ESTABLISHED';
        this.disarm();
        this.sendAck();
        for (const fn of this.openFns.splice(0)) fn();
        this.flush();
      }
      return;
    }
    if (t.flags & SYN) {
      // A retransmitted SYN (our SYN-ACK was lost): answer again.
      if (this.state === 'SYN_RCVD' && seqDiff(t.seq, (this.rcvNxt - 1) >>> 0) === 0) this.sendSyn();
      else this.sendAck();
      return;
    }
    if (!(t.flags & ACK)) return;

    // ACK processing.
    const acked = seqDiff(t.ack, this.sndUna);
    if (acked > 0 && seqDiff(t.ack, this.sndNxt) <= 0) {
      if (this.state === 'SYN_RCVD') {
        this.state = 'ESTABLISHED';
        this.sndUna = (this.sndUna + 1) >>> 0;
        for (const fn of this.openFns.splice(0)) fn();
      }
      const dataAcked = Math.min(seqDiff(t.ack, this.sndUna), this.out.length);
      this.out.drop(dataAcked);
      this.sndUna = t.ack;
      if (this.finSent && t.ack === this.sndNxt) this.finAcked = true;
      this.retries = 0;
      this.rto = RTO_MIN;
      if (seqDiff(this.sndNxt, this.sndUna) === 0) this.disarm();
      else this.arm(true);
    } else if (this.state === 'SYN_RCVD' && acked !== 1) return;
    this.peerWnd = t.window;

    // Data and FIN.
    let data = t.data;
    const off = seqDiff(this.rcvNxt, t.seq);
    let inOrder = off >= 0;
    if (off > 0) {
      if (off >= data.length + (t.flags & FIN ? 1 : 0)) {
        if (data.length || t.flags & FIN) this.sendAck(); // a duplicate
        inOrder = false;
      } else data = data.subarray(off);
    }
    if (inOrder) {
      if (data.length) {
        this.rcvNxt = (this.rcvNxt + data.length) >>> 0;
        this.rxBytes += data.length;
        for (const fn of this.dataFns) fn(data);
      }
      if (t.flags & FIN && !this.peerFin) {
        this.peerFin = true;
        this.rcvNxt = (this.rcvNxt + 1) >>> 0;
        if (this.state === 'ESTABLISHED') this.state = 'CLOSE_WAIT';
        this.sendAck();
        for (const fn of this.endFns) fn();
      } else if (data.length) this.sendAck();
    } else if (off < 0 && (data.length || t.flags & FIN)) this.sendAck(); // a gap: ask again
    this.flush();
    this.checkDone();
  }

  private sendAck() {
    this.o.send({ sport: this.local.port, dport: this.remote.port, seq: this.sndNxt, ack: this.rcvNxt, flags: ACK, window: RCV_WND });
  }

  private scheduleFlush() {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    queueMicrotask(() => {
      this.flushScheduled = false;
      this.flush();
    });
  }

  private flush() {
    if (!this.open && this.state !== 'FIN_WAIT' && this.state !== 'LAST_ACK') return;
    const wnd = Math.min(this.peerWnd || 1, MAX_INFLIGHT);
    for (;;) {
      const sent = seqDiff(this.sndNxt, this.sndUna) - (this.finSent ? 1 : 0);
      const unsent = this.out.length - sent;
      if (unsent <= 0) break;
      const room = wnd - sent;
      if (room <= 0) break;
      const n = Math.min(unsent, this.mss, room);
      const data = this.out.peek(sent, n);
      this.o.send({ sport: this.local.port, dport: this.remote.port, seq: this.sndNxt, ack: this.rcvNxt, flags: ACK | PSH, window: RCV_WND, data });
      this.sndNxt = (this.sndNxt + n) >>> 0;
      this.txBytes += n;
      this.arm(true);
    }
    const allSent = seqDiff(this.sndNxt, this.sndUna) - (this.finSent ? 1 : 0) >= this.out.length;
    if (this.finQueued && !this.finSent && allSent) {
      this.o.send({ sport: this.local.port, dport: this.remote.port, seq: this.sndNxt, ack: this.rcvNxt, flags: FIN | ACK, window: RCV_WND });
      this.sndNxt = (this.sndNxt + 1) >>> 0;
      this.finSent = true;
      this.state = this.state === 'CLOSE_WAIT' ? 'LAST_ACK' : 'FIN_WAIT';
      this.arm(true);
    }
  }

  private arm(keep = false) {
    if (keep && this.timer !== null) return;
    this.disarm();
    this.timer = this.o.clock.setTimeout(() => this.onTimeout(), this.rto);
  }

  private disarm() {
    if (this.timer !== null) this.o.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  private onTimeout() {
    this.timer = null;
    if (this.state === 'CLOSED') return;
    if (++this.retries > MAX_RETRIES) {
      if (this.state === 'SYN_SENT') for (const fn of this.openFns.splice(0)) fn('connection timed out');
      this.destroy('connection timed out');
      return;
    }
    this.rto = Math.min(this.rto * 2, RTO_MAX);
    if (this.state === 'SYN_SENT' || this.state === 'SYN_RCVD') {
      this.sendSyn();
      return;
    }
    // Go back to the first unacknowledged byte and send again.
    const wasFin = this.finSent && !this.finAcked;
    this.sndNxt = this.sndUna;
    if (wasFin) {
      this.finSent = false;
      if (this.state === 'LAST_ACK') this.state = 'CLOSE_WAIT';
      else if (this.state === 'FIN_WAIT') this.state = 'ESTABLISHED';
    }
    this.flush();
    if (this.timer === null) this.arm();
  }

  private checkDone() {
    if (this.finAcked && this.peerFin) this.close();
  }

  private close(err?: string) {
    if (this.state === 'CLOSED') return;
    const wasOpening = this.state === 'SYN_SENT';
    this.state = 'CLOSED';
    this.disarm();
    if (wasOpening) for (const fn of this.openFns.splice(0)) fn(err ?? 'connection refused');
    this.o.onGone(this);
    for (const fn of this.closeFns) fn(err);
  }
}
