// A real Linux machine (tier B, design 09 §1.4) behind the same Machine
// interface as the simulator: lessons and checks do not care which one runs.
//
// The emulator lives in its own worker. The page talks to the guest through two
// serial ports: ttyS0 is the learner's raw terminal (xterm ↔ serial, the
// guest's own line editing), ttyS1 is a service shell used for exec() and
// facts(). The first start boots the kernel, sets up the prompt marker and the
// service shell, and saves the state to OPFS; every later start restores that
// state instead of booting.
//
// Profiles (profiles.ts): `buildroot` is the small v86 demo image; `lab-node`
// and `lab-installer` are the trainer's Alpine image on a 9p root
// (scripts/build-lab-image.mjs) with OpenRC, sshd and the admin toolbox, and
// can carry blank IDE disks. An installer machine whose disk became bootable
// restarts from that disk on `reboot`, through the boot loader the learner
// installed.

import type { ExecResult, Facts, Machine, SimEvent } from '../../core/types';
import { assetUrl, IMAGE, labAssetUrl, loadLabManifest, loadManifest, wasmAssetUrl } from './assets';
import { fetchBootSnapshot, imageHash, V86_VERSION, type BootSnapshot } from './boot-snapshot';
import { cloneIdentity, type CloneIdentity } from './clone-identity';
import { editorInstances, editorProbeScript, editorScopesOf, editorStateScript, EDITOR_SCOPES, parseEditorProbe, parseEditorState, probeSignature, type EditorArea } from './editor-facts';
import { labFactsScript, parseLabFacts, scopesOf, LAB_SCOPES } from './lab-facts';
import type { BootConfig, DiskConfig, WorkerIn, WorkerOut } from './messages';
import { profile as profileOf, type DiskSpec, type MachineProfile, type ProfileId } from './profiles';
import { factsScript, filesScript, frameCommand, hideService, parseFacts, PromptTracker, ServiceParser, shq, watchedPaths, type PromptMark } from './protocol';
import type { SparseDiskData } from './sparse-disk';
import { loadState, saveCompressedState, saveState } from './state-cache';

/** Bump when the bootstrap below changes: old saved states no longer match it. */
export const BOOTSTRAP_VERSION = 4;

export interface Identity {
  hostname: string;
  /** '10.0.0.11/24' */
  ip?: string;
  /** Locally administered MAC: '02:64:74:00:00:01'. */
  mac?: string;
  /** Lab images: take the address from a DHCP server on the lab network instead of `ip`. */
  dhcp?: boolean;
  /** Lab images: default route. */
  gateway?: string;
  /** Lab images: extra /etc/hosts lines, name → address (the other lab machines). */
  hosts?: Record<string, string>;
  /** Lab images: /etc/resolv.conf nameserver. */
  dns?: string;
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
  /** Lab images: the initramfs that mounts the 9p root. */
  initrd?: string;
  /** Lab images: the 9p index of the profile and the base URL of its content files. */
  fsJson?: string;
  filesBase?: string;
  /** Kernel command line of the image (the console and debug flags are added here). */
  cmdline?: string;
  bootSnapshots?: Record<string, BootSnapshot>;
}

/** Bash expands the hostname at each prompt, including after a clone changes it. */
export function interactivePrompt(): string {
  return `"\\[$(printf '\\033')]777;dt;\\$?;\\$PWD$(printf '\\007')\\]\\u@\\$(hostname):\\w\\\\$ "`;
}

const BUILDROOT_CMDLINE = 'tsc=reliable mitigations=off random.trust_cpu=on console=ttyS0';

export async function defaultAssets(profileId: ProfileId = 'buildroot'): Promise<MachineAssets> {
  const manifest = await loadManifest();
  if (!manifest) throw new Error('v86 assets are missing in this build (run `npm run fetch:v86`)');
  const base = { wasm: wasmAssetUrl(), bios: assetUrl(IMAGE.bios), vgaBios: assetUrl(IMAGE.vgaBios) };
  const p = profileOf(profileId);
  if (p.image === 'buildroot') return { ...base, bzimage: assetUrl(IMAGE.kernel), kernelSha: manifest.files[IMAGE.kernel]?.sha256.slice(0, 12) ?? 'x' };
  const lab = await loadLabManifest();
  const fs = lab?.profiles[p.id];
  if (!lab || !fs) throw new Error('the lab image is missing in this build (run `npm run build:lab-image`)');
  return {
    ...base,
    bzimage: labAssetUrl(lab.kernel.file),
    initrd: labAssetUrl(lab.initrd.file),
    fsJson: labAssetUrl(fs.fsJson),
    filesBase: labAssetUrl(lab.filesBase),
    cmdline: lab.cmdline,
    kernelSha: await imageHash(lab, fs.fsJson),
    bootSnapshots: lab.bootSnapshots,
  };
}

export interface V86MachineOptions {
  transport?: TransportFactory;
  assets?: MachineAssets;
  id?: string;
  identity?: Partial<Identity>;
  /** Which image and hardware (default `buildroot`, the first-wave machine). */
  profile?: ProfileId;
  /** Guest memory; default from the profile (Buildroot 32 MB, lab images 128–160 MB). */
  memoryMB?: number;
  /** Blank IDE disks (default from the profile; `[]` for none). */
  disks?: DiskSpec[];
  /** Start from (and save) the boot snapshot in OPFS. Default true. */
  bootCache?: boolean;
  /** OPFS key of this lab's own saved machine: when present, the machine continues from it. */
  stateKey?: string;
  /** Printed (dimmed) between the kernel boot log and the first prompt of a cold boot. */
  bootBanner?: string;
  /** Paths whose facts are collected (also taken from check predicates with watchPredicates). */
  watch?: string[];
  /** Lab fact scopes collected with every facts() call (also taken from predicates). */
  scopes?: string[];
  /** Installer machines: what `reboot` in the guest does once the disk is bootable. Default 'disk'. */
  onReboot?: 'disk' | 'media';
  /**
   * Lab images with editor agents (lab-editors): while a command runs in the
   * learner's terminal, poll the service channel for running editors and
   * their agents' stamps and emit `editor.change` when they move, so checks
   * run while a fullscreen editor is open (no prompt comes back then). Off by default.
   */
  editorWatch?: boolean;
}

/** Poll intervals of the editor watch, ms: while an editor runs, while some other command runs. */
export const EDITOR_POLL_MS = { editor: 400, busy: 1000 } as const;

export type BootPhase = 'download' | 'boot' | 'setup' | 'ready' | 'error';

export interface BootInfo {
  /** 'cold': the kernel booted in this tab; 'restored': started from a saved state; 'disk': booted from its own disk. */
  kind: 'cold' | 'restored' | 'disk';
  /** From pressing start to the first prompt the learner can type at. */
  ms: number;
  /** Bytes fetched from the network for this start (0 when everything was cached). */
  downloaded: number;
}

const enc = new TextEncoder();
const dec = () => new TextDecoder();
const MB = 1024 * 1024;

let seq = 0;

/** A blank disk as worker data. */
function blankDisk(d: DiskSpec, i: number): DiskConfig {
  return { slot: d.slot ?? (i === 0 ? 'hda' : 'hdb'), data: { byteLength: d.sizeMB * MB, index: new Uint32Array(0), data: new Uint8Array(0) } };
}

export class V86Machine implements Machine {
  readonly kind = 'v86' as const;
  readonly id: string;
  readonly identity: Identity;
  readonly memoryMB: number;
  readonly profile: MachineProfile;
  readonly disks: DiskSpec[];
  phase: BootPhase = 'download';
  boot: BootInfo | null = null;
  error: string | null = null;
  /** Where the running system came from: the kernel and root of the image, or the machine's own disk. */
  bootFrom: 'image' | 'disk' = 'image';
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
  private scopes = new Set<string>();
  private bootBuffer = '';
  private forwarding = false;
  private readyWaiter: ((text: string) => void) | null = null;
  private bootCache: boolean;
  private stateKey?: string;
  private bootBanner?: string;
  private onReboot: 'disk' | 'media';
  /** Tail of the console, for facts after a boot from disk (no service channel there). */
  private feedbackFacts: Facts | null = null;
  private consoleTail = '';
  private rebooting = false;
  /** True when start() continued the learner's own saved machine. */
  resumed = false;
  /** Settles when the boot snapshot of a cold start is stored (other machines of a lab wait for it). */
  bootSaved: Promise<void> = Promise.resolve();
  private downloaded = 0;
  private nextId = 1;
  private editorScopes = new Set<string>();
  private editorWatch: boolean;
  private editorTimer: ReturnType<typeof setTimeout> | undefined;
  private editorPolling = false;
  private editorSig = '';
  private editorAlive = false;
  private submittedAt = 0;
  private markedAt = 0;
  private disposed = false;
  /** Round trip of the last editor probe and state query on the service channel, ms (for measurements). */
  editorTiming = { probeMs: 0, stateMs: 0, focusedMs: 0 };

  constructor(o: V86MachineOptions = {}) {
    this.id = o.id ?? `v86-${++seq}`;
    this.profile = profileOf(o.profile);
    this.identity = {
      mac: '02:' + Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(16).padStart(2, '0')).join(':'),
      ...o.identity,
      hostname: o.identity?.hostname ?? this.profile.hostname,
    };
    this.memoryMB = o.memoryMB ?? this.profile.memoryMB;
    this.disks = o.disks ?? this.profile.disks;
    this.bootCache = o.bootCache ?? true;
    this.transportFactory = o.transport ?? workerTransport;
    this.assets = o.assets;
    this.stateKey = o.stateKey;
    this.bootBanner = o.bootBanner;
    this.onReboot = o.onReboot ?? 'disk';
    for (const p of o.watch ?? []) this.watch.add(p);
    for (const s of o.scopes ?? []) this.scopes.add(s);
    this.editorWatch = o.editorWatch ?? false;
  }

  private get lab(): boolean {
    return this.profile.image === 'alpine';
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

  cacheKey(): string {
    if (!this.lab) return `boot-${IMAGE.kernel}-${this.memoryMB}m-b${BOOTSTRAP_VERSION}`;
    const disks = this.disks.map((d, i) => `${d.slot ?? (i ? 'hdb' : 'hda')}${d.sizeMB}`).join('');
    return `boot-v86-${V86_VERSION}-${this.profile.id}-v${this.profile.version}-${this.memoryMB}m${disks ? '-' + disks : ''}-b${BOOTSTRAP_VERSION}`;
  }

  private diskKey(): string | undefined {
    return this.stateKey ? `${this.stateKey}-disk` : undefined;
  }

  private config(a: MachineAssets, initialState?: ArrayBuffer, fromDisk?: SparseDiskData[]): BootConfig {
    const base = { wasm: a.wasm, bios: a.bios, vgaBios: a.vgaBios, memoryMB: this.memoryMB, nic: this.profile.nic, initialState };
    if (!this.lab) return { ...base, bzimage: a.bzimage, cmdline: BUILDROOT_CMDLINE };
    const disks = fromDisk ? fromDisk.map((data, i) => ({ slot: this.diskSlot(i), data })) : this.disks.map(blankDisk);
    if (this.bootFrom === 'disk') return { ...base, cmdline: '', disks };
    return {
      ...base,
      // A restored state carries the kernel in its memory: only a cold boot downloads it.
      bzimage: initialState ? undefined : a.bzimage,
      initrd: initialState ? undefined : a.initrd,
      cmdline: a.cmdline ?? BUILDROOT_CMDLINE,
      filesystem: { basefs: a.fsJson!, baseurl: a.filesBase! },
      disks,
    };
  }

  private diskSlot(i: number): 'hda' | 'hdb' {
    return this.disks[i]?.slot ?? (i === 0 ? 'hda' : 'hdb');
  }

  async start(): Promise<BootInfo> {
    const t0 = performance.now();
    try {
      const a = this.assets ?? (await defaultAssets(this.profile.id));
      const key = `${this.cacheKey()}-${a.kernelSha}`;
      // A learner's machine that was rebooted into its own disk continues from that state.
      const diskState = this.diskKey() ? await loadState(this.diskKey()!) : null;
      if (diskState) this.bootFrom = 'disk';
      const resumed = diskState ?? (this.stateKey ? await loadState(this.stateKey) : null);
      this.resumed = !!resumed;
      let saved = resumed ?? (this.bootCache ? await loadState(key) : null);
      if (!saved && this.bootCache && a.bootSnapshots) {
        const entry = a.bootSnapshots[this.cacheKey()];
        saved = await fetchBootSnapshot(entry, this.cacheKey(), a.kernelSha, labAssetUrl, (gz) => saveCompressedState(key, gz));
        if (saved) this.downloaded += entry.size;
      }
      const ready = this.spawn(this.config(a, saved ?? undefined), saved);
      const r = await ready;
      if (this.bootFrom === 'disk') {
        this.forwarding = true;
        this.write('\r', false);
      } else if (r.restored) {
        this.setPhase('setup');
        this.forwarding = true;
        await this.afterRestore();
      } else {
        this.setPhase('boot');
        await this.waitFor(/[#$%] (\x1b\[\?2004h)?$/, 600_000);
        this.setPhase('setup');
        await this.bootstrap();
        if (this.bootCache) {
          const st = await this.saveRaw();
          this.bootSaved = saveState(key, st).then(() => undefined);
        }
        await this.applyIdentity(true);
        if (this.bootBanner) this.print(this.bootBanner);
        this.forwarding = true;
        this.write('\r');
      }
      this.boot = { kind: this.bootFrom === 'disk' ? 'disk' : r.restored ? 'restored' : 'cold', ms: Math.round(performance.now() - t0), downloaded: this.downloaded };
      this.setPhase('ready');
      this.emit('machine.ready', { boot: this.boot });
      // A resumed machine may have been saved with an editor open: look once.
      if (this.editorWatch) this.pollEditorsSoon(0, true);
      return this.boot;
    } catch (e) {
      this.fail((e as Error).message);
      throw e;
    }
  }

  /** Start the emulator worker with a config; resolves when v86 reports ready. */
  private spawn(config: BootConfig, state: ArrayBuffer | null): Promise<{ ms: number; restored: boolean }> {
    this.worker = this.transportFactory(
      (m) => this.onWorker(m),
      (msg) => this.fail(msg),
      `v86 ${this.id}`,
    );
    const ready = new Promise<{ ms: number; restored: boolean }>((resolve, reject) => {
      this.onReady = resolve;
      this.onBootFail = reject;
    });
    const transfer: Transferable[] = state ? [state] : [];
    for (const d of config.disks ?? []) if (d.data.data.byteLength) transfer.push(d.data.data.buffer, d.data.index.buffer);
    this.send({ op: 'boot', config }, transfer);
    return ready;
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
      case 'disk':
      case 'fsstats':
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
    this.consoleTail = (this.consoleTail + clean).slice(-4096);
    if (this.forwarding) {
      if (clean) this.print(clean);
      const record = this.tracker.count > before ? this.tracker.records.at(-1) : undefined;
      if (marks.length) this.markedAt = performance.now();
      for (const mk of marks) this.emit('cmd.done', { exit: mk.exit, cwd: mk.cwd, record });
      if (this.lab && /reboot: Restarting system/.test(this.consoleTail)) void this.onGuestReboot();
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
    const ps1 = interactivePrompt();
    const lines = [
      'stty -echo',
      `echo $$ > /tmp/.dt-shell; export PS1=${ps1}; cd /root 2>/dev/null || cd /`,
      `(setsid sh -c 'stty -echo -onlcr; echo $$ > /tmp/.dt-svc; PS1= exec sh' </dev/ttyS1 >/dev/ttyS1 2>&1 &)`,
      `stty echo; printf '\\036READY\\n'`,
    ];
    // Lab images log in with bash: keep the bootstrap lines out of the learner's history.
    if (this.lab) lines.unshift('set +o history 2>/dev/null');
    if (this.lab) lines.splice(lines.length - 1, 0, 'history -c 2>/dev/null; set -o history 2>/dev/null');
    this.write(lines.join('\n') + '\n', false);
    // READY is printed before bash expands PS1. Its $(hostname) can still be
    // waiting for an asynchronous 9p read, which a VM snapshot cannot resume.
    // Include the final prompt in this same wait (serial batches may contain
    // both), so the saved interactive shell is actually ready for input.
    await this.waitFor(/\x1eREADY[\s\S]*[#$%] (\x1b\[\?2004h)?$/, 60_000);
    // The service shell needs a moment to start; probe it until it answers.
    for (let i = 0; i < 50; i++) {
      const r = await Promise.race([this.svcRun('echo ok'), new Promise<null>((res) => setTimeout(() => res(null), 400))]);
      if (r && r.out.includes('ok')) return;
    }
    throw new Error('the service channel (ttyS1) did not start');
  }

  /**
   * Hostname, address and MAC of this machine, applied on every start (clones
   * share one snapshot). Lab images also get their own machine-id and SSH
   * host key, and the address goes into /etc/network/interfaces, so
   * `rc-service networking restart` keeps it.
   */
  private async applyIdentity(fresh: boolean): Promise<void> {
    const id = this.identity;
    if (!this.lab) {
      const cmds = [`hostname ${shq(id.hostname)}`];
      if (id.mac || id.ip) cmds.push('ip link set eth0 down');
      if (id.mac) cmds.push(`ip link set eth0 address ${id.mac}`);
      if (id.ip) cmds.push('ip addr flush dev eth0', `ip addr add ${id.ip} dev eth0`);
      if (id.mac || id.ip) cmds.push('ip link set eth0 up');
      await this.svcRun(cmds.join('; '));
      return;
    }
    // A cold-booted machine generated its own host key on boot; a clone of a snapshot needs a new one.
    const random = await cloneIdentity(this.profile.sshd && !fresh);
    const result = await this.svcRun(identityScript(id, { sshd: this.profile.sshd, newKeys: !fresh, random }));
    if (result.exit) throw new Error(`identity setup failed: ${result.out}`);
  }

  private async afterRestore(): Promise<void> {
    // The clock of a restored machine shows the moment of the snapshot (09 §1.4.4).
    await this.svcRun(`date -s @${Math.floor(Date.now() / 1000)} >/dev/null`);
    // A resumed lab keeps whatever the learner changed (even the hostname); a fresh clone gets its identity.
    if (!this.resumed) {
      await this.applyIdentity(false);
      // Published snapshots may contain bash's cached \h from the image host.
      // Reinstall the prompt in the interactive shell, not the service shell.
      this.forwarding = false;
      try {
        this.write(` export PS1=${interactivePrompt()}; printf '\\036PROMPT_READY\\n'\n`, false);
        await this.waitFor(/\x1ePROMPT_READY/, 60_000);
      } finally {
        this.forwarding = true;
      }
    }
    this.tracker.restore({ records: [], last: null });
    this.write('\r');
  }

  // ── reboot into the installed system ────────────────────────────────────

  private async onGuestReboot(): Promise<void> {
    if (this.rebooting) return;
    this.consoleTail = '';
    if (this.bootFrom === 'disk' || this.onReboot !== 'disk' || !this.disks.length) return;
    const disks = await this.exportDisks();
    if (!disks.some((d) => isBootable(d))) return; // v86 resets into the installer media again
    await this.bootFromDisk(disks);
  }

  /**
   * Start again from the machine's first disk, like a computer with the
   * installer media removed: SeaBIOS reads the MBR the learner's boot loader
   * wrote. The disk keeps everything; the live system of the media is gone.
   */
  async bootFromDisk(disks?: SparseDiskData[]): Promise<BootInfo> {
    this.rebooting = true;
    const t0 = performance.now();
    const data = disks ?? (await this.exportDisks());
    this.send({ op: 'destroy' });
    const old = this.worker;
    setTimeout(() => old?.terminate(), 500);
    this.bootFrom = 'disk';
    this.forwarding = true;
    this.svc = new ServiceParser();
    this.tracker = new PromptTracker();
    this.replies.clear();
    this.print('\r\n');
    const a = this.assets ?? (await defaultAssets(this.profile.id));
    this.setPhase('boot');
    await this.spawn(this.config(a, undefined, data), null);
    this.boot = { kind: 'disk', ms: Math.round(performance.now() - t0), downloaded: 0 };
    this.rebooting = false;
    this.setPhase('ready');
    this.emit('machine.reboot', { from: 'disk' });
    return this.boot;
  }

  /** Contents of the machine's disks (only written blocks). */
  async exportDisks(): Promise<SparseDiskData[]> {
    const out: SparseDiskData[] = [];
    for (let i = 0; i < this.disks.length; i++) {
      const r = await this.workerCall({ op: 'disk', id: this.nextId++, slot: this.diskSlot(i) });
      if (r.op === 'disk' && r.data) out.push(r.data);
    }
    return out;
  }

  /** Bytes of the 9p root fetched so far (what this machine downloaded beyond the boot files). */
  async rootFetched(): Promise<{ files: number; bytes: number }> {
    const r = await this.workerCall({ op: 'fsstats', id: this.nextId++ });
    return r.op === 'fsstats' ? { files: r.files, bytes: r.bytes } : { files: 0, bytes: 0 };
  }

  // ── the learner's terminal ──────────────────────────────────────────────

  /** Keystrokes from xterm to ttyS0. */
  write(data: string, track = true): void {
    if (track) this.tracker.input(data);
    this.send({ op: 'serial', port: 0, bytes: enc.encode(data) });
    if (track && data.includes('\r')) {
      this.submittedAt = performance.now();
      if (this.editorWatch) this.pollEditorsSoon(600);
    }
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

  private requireService(): void {
    if (this.bootFrom === 'disk') throw new Error('this machine runs the system installed on its disk; the trainer has no service channel into it');
  }

  /** Run a command as root in the learner's current directory, outside the learner's terminal. */
  async exec(line: string): Promise<ExecResult> {
    this.requireService();
    const r = await this.svcRun(line, this.tracker.last?.cwd);
    return { out: r.out, exit: r.exit };
  }

  /** Tell the guest the terminal size (TIOCSWINSZ on ttyS0); the shell rereads it at the next prompt. */
  resize(cols: number, rows: number): void {
    if (this.phase === 'ready' && this.bootFrom === 'image') void this.svcRun(`stty -F /dev/ttyS0 cols ${Math.max(20, cols | 0)} rows ${Math.max(5, rows | 0)}`);
  }

  /** Collect facts for these paths too. */
  watchPaths(paths: string[]): void {
    for (const p of paths) this.watch.add(p);
  }

  /** Collect the paths and lab scopes that these predicates read. */
  watchPredicates(predicates: (string | undefined)[]): void {
    this.watchPaths(watchedPaths(predicates));
    if (this.lab) for (const s of scopesOf(predicates)) this.scopes.add(s);
    if (this.lab) for (const s of editorScopesOf(predicates)) this.editorScopes.add(s);
  }

  // ── editors (lab-editors image) ─────────────────────────────────────────

  /** Turn the editor watch on or off (see V86MachineOptions.editorWatch). */
  watchEditors(on = true): void {
    this.editorWatch = on;
    if (on) this.pollEditorsSoon(0, true);
    else clearTimeout(this.editorTimer);
  }

  /** The editor area alone (no processes, users or files): cheap enough to run on every editor change. */
  async editorFacts(): Promise<EditorArea> {
    this.requireService();
    const t0 = performance.now();
    const r = await this.svcRun(editorStateScript());
    this.editorTiming.stateMs = Math.round(performance.now() - t0);
    return parseEditorState(r.out);
  }

  /**
   * Named files and the editor area in one service-channel round trip: no
   * process list (it forks per process), no lab scopes. For checks whose
   * predicates read only `files[...]` and editor facts; `procs` stays empty
   * and `user` is root (the lab's terminal user). Accounts are read with
   * shell builtins so file owners keep their names.
   */
  async focusedFacts(paths?: string[]): Promise<Facts> {
    this.requireService();
    const t0 = performance.now();
    const accounts = 'echo W; while IFS= read -r l; do echo "$l"; done < /etc/passwd; echo .; echo G; while IFS= read -r l; do echo "$l"; done < /etc/group; echo .';
    const editor = this.lab && this.editorScopes.size > 0;
    const out = (await this.svcRun([accounts, filesScript(paths ?? [...this.watch]), editor ? editorStateScript() : ''].filter(Boolean).join('\n'))).out;
    const r = parseFacts(out.split('\x1e')[0]);
    this.editorTiming.focusedMs = Math.round(performance.now() - t0);
    return {
      schema: 'dt.facts/v1',
      env: { kind: 'v86', machine: this.id, kernel: '', at: new Date().toISOString(), boot: this.boot, profile: this.profile.id, bootFrom: this.bootFrom, focused: true },
      user: { name: 'root', uid: 0, gid: 0 },
      cwd: this.tracker.last?.cwd ?? '/',
      hostname: this.identity.hostname,
      vars: { '?': String(this.tracker.last?.exit ?? 0) },
      procs: [],
      files: r.files,
      term: { main: this.tracker.snapshot().records },
      users: r.users,
      groups: r.groups,
      ...(editor ? parseEditorState(out) : {}),
    } as Facts;
  }

  /** A command runs in the learner's terminal: typed Enter, no prompt since. */
  private get foreground(): boolean {
    return this.submittedAt > this.markedAt;
  }

  private pollEditorsSoon(ms: number, force = false): void {
    if (this.disposed || !this.editorWatch) return;
    if (this.editorTimer !== undefined && !force) return;
    clearTimeout(this.editorTimer);
    this.editorTimer = setTimeout(() => {
      this.editorTimer = undefined;
      void this.pollEditors(force);
    }, ms);
  }

  private async pollEditors(force: boolean): Promise<void> {
    if (this.disposed || !this.editorWatch) return;
    if (this.phase !== 'ready' || this.bootFrom !== 'image' || this.editorPolling) return this.pollEditorsSoon(EDITOR_POLL_MS.busy);
    // Nothing runs and no editor was seen: the prompt marker (cmd.done) is the trigger.
    if (!force && !this.foreground && !this.editorAlive) return;
    this.editorPolling = true;
    try {
      const t0 = performance.now();
      const probe = parseEditorProbe((await this.svcRun(editorProbeScript())).out);
      this.editorTiming.probeMs = Math.round(performance.now() - t0);
      const sig = probeSignature(probe);
      const editors = editorInstances(probe);
      this.editorAlive = editors.length > 0;
      if (sig !== this.editorSig) {
        this.editorSig = sig;
        this.emit('editor.change', { editors, probeMs: this.editorTiming.probeMs });
      }
    } catch {
      /* the channel went away (reboot, dispose): try again later */
    } finally {
      this.editorPolling = false;
    }
    if (this.editorAlive) this.pollEditorsSoon(EDITOR_POLL_MS.editor);
    else if (this.foreground) this.pollEditorsSoon(EDITOR_POLL_MS.busy);
  }

  /**
   * Facts (dt.facts/v1). `scope` adds lab scopes (net, listen, blk, mounts,
   * fstab, lvm, svc, fw, dns, boot) to the ones the predicates asked for.
   */
  async facts(scope?: string[]): Promise<Facts> {
    if (this.bootFrom === 'disk') return this.feedbackFacts = this.diskBootFacts();
    const svcPid = Number((await this.svcRun('cat /tmp/.dt-svc')).out.trim()) || undefined;
    const scopes = this.lab ? [...new Set([...this.scopes, ...(scope ?? [])])].filter((s) => (LAB_SCOPES as readonly string[]).includes(s)) : [];
    const lab = scopes.length ? parseLabFacts((await this.svcRun(labFactsScript(scopes))).out) : {};
    const r = parseFacts((await this.svcRun(factsScript([...this.watch]))).out);
    const wantsEditor = this.lab && (this.editorScopes.size > 0 || (scope ?? []).some((s) => (EDITOR_SCOPES as readonly string[]).includes(s)));
    const editor = wantsEditor ? await this.editorFacts() : {};
    const procs = hideService(r.procs, svcPid);
    const shell = procs.find((p) => p.pid === r.shellPid);
    const uid = shell?.uid ?? 0;
    const user = r.users.find((u) => u.uid === uid) ?? { name: 'root', uid: 0, gid: 0 };
    // The service shell's own `ss` and `ps` children are not the learner's listeners.
    const hidden = new Set(r.procs.filter((p) => !procs.includes(p)).map((p) => p.pid));
    if (lab.listen) lab.listen = lab.listen.filter((l) => !l.pid || !hidden.has(l.pid));
    return this.feedbackFacts = {
      schema: 'dt.facts/v1',
      env: { kind: 'v86', machine: this.id, kernel: r.kernel, at: new Date().toISOString(), boot: this.boot, profile: this.profile.id, bootFrom: this.bootFrom },
      user: { name: user.name, uid: user.uid, gid: user.gid },
      cwd: this.tracker.last?.cwd ?? r.shellCwd ?? '/',
      hostname: r.hostname,
      vars: { '?': String(this.tracker.last?.exit ?? 0) },
      procs,
      files: r.files,
      term: { main: this.tracker.snapshot().records },
      users: r.users,
      groups: r.groups,
      ...lab,
      ...editor,
    } as Facts;
  }

  /** After a boot from its own disk the trainer sees only the console, like a monitor. */
  private diskBootFacts(): Facts {
    const screen = this.consoleTail.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '');
    return {
      schema: 'dt.facts/v1',
      env: { kind: 'v86', machine: this.id, kernel: '', at: new Date().toISOString(), boot: this.boot, profile: this.profile.id, bootFrom: 'disk' },
      user: { name: 'root', uid: 0, gid: 0 },
      cwd: '/',
      hostname: /^(\S+) login: ?$/m.exec(screen)?.[1] ?? '',
      vars: {},
      procs: [],
      files: {},
      term: { main: [] },
      console: { text: screen.slice(-2048), login: /login:\s*$/.test(screen) },
    } as Facts;
  }

  /** Feedback deliberately excludes VM memory and disk snapshots. */
  async snapshotForFeedback() {
    return { machine: this.id, phase: this.phase, history: this.tracker.snapshot().records,
      console: this.consoleTail.slice(-32000), facts: this.feedbackFacts, factsSource: 'last successful check' };
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
    if (this.bootFrom === 'image') await this.svcRun(`date -s @${Math.floor(Date.now() / 1000)} >/dev/null`);
    this.write('\r', false);
    if (this.editorWatch) this.pollEditorsSoon(300, true);
  }

  /** Save the whole machine to OPFS under this lab's key (after a passed goal, on leaving). */
  async persist(): Promise<number | null> {
    if (!this.stateKey || this.phase !== 'ready') return null;
    const key = this.bootFrom === 'disk' ? this.diskKey()! : this.stateKey;
    return saveState(key, await this.saveRaw());
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
    this.disposed = true;
    clearTimeout(this.editorTimer);
    this.send({ op: 'destroy' });
    setTimeout(() => this.worker?.terminate(), 500);
    this.outListeners.clear();
    this.busListeners.clear();
    this.phaseListeners.clear();
  }
}

/** Sector 0 of the disk ends with 55 AA: something wrote a boot record. */
export function isBootable(d: SparseDiskData): boolean {
  if (!d.index.length || d.index[0] !== 0) return false;
  return d.data[510] === 0x55 && d.data[511] === 0xaa;
}

/**
 * The identity of a lab machine as one service-channel script (pure, tested):
 * hostname and /etc/hosts, MAC, the eth0 address (static or DHCP) in
 * /etc/network/interfaces and live, machine-id and, for machines that run
 * sshd, a new Ed25519 host key so clones of one snapshot differ.
 */
export function identityScript(id: Identity, o: { sshd: boolean; newKeys: boolean; random?: CloneIdentity }): string {
  const hosts = [`127.0.0.1\t${id.hostname} localhost localhost.localdomain`, '::1\t\tlocalhost localhost.localdomain'];
  for (const [name, addr] of Object.entries(id.hosts ?? {})) if (name !== id.hostname) hosts.push(`${addr.replace(/\/\d+$/, '')}\t${name}`);
  const iface = ['auto lo', 'iface lo inet loopback', ''];
  if (id.dhcp) iface.push('auto eth0', 'iface eth0 inet dhcp');
  else if (id.ip) iface.push('auto eth0', 'iface eth0 inet static', `\taddress ${id.ip}`, ...(id.gateway ? [`\tgateway ${id.gateway}`] : []));
  const lines = [
    `hostname ${shq(id.hostname)}`,
    `echo ${shq(id.hostname)} > /etc/hostname`,
    `printf '%s\\n' ${hosts.map(shq).join(' ')} > /etc/hosts`,
    `printf '%s\\n' ${iface.map(shq).join(' ')} > /etc/network/interfaces`,
    o.random ? `printf '%s\\n' ${shq(o.random.machineId)} > /etc/machine-id` : 'cat /proc/sys/kernel/random/uuid | tr -d - > /etc/machine-id',
  ];
  if (id.dns) lines.push(`echo ${shq(`nameserver ${id.dns}`)} > /etc/resolv.conf`);
  if (id.mac || id.ip || id.dhcp) {
    lines.push('ip link set eth0 down');
    if (id.mac) lines.push(`ip link set eth0 address ${id.mac}`);
    lines.push('ip addr flush dev eth0', 'ip link set eth0 up');
    if (id.dhcp) lines.push('udhcpc -i eth0 -b -q -t 3 >/dev/null 2>&1');
    else if (id.ip) lines.push(`ip addr add ${id.ip} dev eth0`);
    if (id.gateway && !id.dhcp) lines.push(`ip route replace default via ${id.gateway} dev eth0`);
  }
  if (o.sshd && o.newKeys) {
    lines.push(
      'rm -f /etc/ssh/ssh_host_*',
      ...(o.random?.privateKey ? [
        `umask 077; printf '%s' ${shq(o.random.privateKey)} > /etc/ssh/ssh_host_ed25519_key`,
        `printf '%s\\n' ${shq(o.random.publicKey!)} > /etc/ssh/ssh_host_ed25519_key.pub`,
      ] : ["ssh-keygen -q -t ed25519 -N '' -f /etc/ssh/ssh_host_ed25519_key"]),
      // Reload only sends SIGHUP: it can return before sshd has reopened its
      // listeners. Wait for a restart before declaring the clone ready.
      'rc-service -q sshd restart >/dev/null 2>&1',
    );
  }
  return ['set -e', ...lines].join('\n');
}
