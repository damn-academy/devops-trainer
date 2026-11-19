// Where the files of a real machine come from. The emulator (libv86 + wasm)
// is bundled from the `v86` npm package; BIOS and kernel are fetched into
// public/v86/ by scripts/fetch-v86.mjs and described in manifest.json.

import type { BootSnapshot } from './boot-snapshot';

import wasmUrl from 'v86/build/v86.wasm?url';

export interface AssetManifest {
  schema: 'dt.v86-assets/v1';
  v86: { npm: string; commit: string; license: string };
  files: Record<string, { size: number; sha256: string; url: string; license: string; source: string }>;
}

export const IMAGE = {
  bios: 'seabios.bin',
  vgaBios: 'vgabios.bin',
  kernel: 'buildroot-bzimage.bin',
} as const;

/** Size of v86.wasm (bytes, uncompressed) for the "how much will this download" line. */
export const WASM_BYTES = 2_007_347;
/** The emulator worker script (libv86 bundled), uncompressed. */
export const WORKER_BYTES = 360_000;

const base = () => (typeof document !== 'undefined' ? document.baseURI : 'http://localhost/');

export function assetUrl(file: string): string {
  return new URL(`v86/${file}`, base()).href;
}

export function wasmAssetUrl(): string {
  return new URL(wasmUrl, base()).href;
}

let manifest: Promise<AssetManifest | null> | null = null;

/** The manifest written by the fetch script, or null when the build has no v86 assets. */
export function loadManifest(): Promise<AssetManifest | null> {
  manifest ??= fetch(assetUrl('manifest.json'))
    .then((r) => (r.ok ? (r.json() as Promise<AssetManifest>) : null))
    .then((m) => (m && m.schema === 'dt.v86-assets/v1' && m.files[IMAGE.kernel] ? m : null))
    .catch(() => null);
  return manifest;
}

/** Bytes the learner downloads on the first start of a machine. */
export function downloadBytes(m: AssetManifest): number {
  return WASM_BYTES + WORKER_BYTES + Object.values(IMAGE).reduce((n, f) => n + (m.files[f]?.size ?? 0), 0);
}

export function formatMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1);
}

// ── the lab image (scripts/build-lab-image.mjs → public/v86/lab/) ─────────

export interface LabManifest {
  schema: 'dt.v86-lab-image/v1';
  bootSnapshots?: Record<string, BootSnapshot>;
  distro: { name: string; release: string; arch: string; mirror: string };
  kernel: { file: string; version: string; package: string };
  initrd: { file: string };
  filesBase: string;
  cmdline: string;
  store: { files: number; bytes: number };
  profiles: Record<string, { fsJson: string; packages: string[]; world: string[]; rootBytes: number; entries: number }>;
  outputs: Record<string, { size: number; sha256: string }>;
  downloads: { file: string; url: string; sha256: string; size: number; license?: string }[];
}

export function labAssetUrl(file: string): string {
  return assetUrl(`lab/${file}`);
}

let labManifest: Promise<LabManifest | null> | null = null;

/** The lab image manifest, or null when this build has no lab image (`npm run build:lab-image`). */
export function loadLabManifest(): Promise<LabManifest | null> {
  labManifest ??= fetch(labAssetUrl('manifest.json'))
    .then((r) => (r.ok ? (r.json() as Promise<LabManifest>) : null))
    .then((m) => (m && m.schema === 'dt.v86-lab-image/v1' ? m : null))
    .catch(() => null);
  return labManifest;
}

/**
 * Files read from the 9p root while a lab machine boots for the first time
 * (measured: busybox, musl, bash, OpenRC, sshd, the first-boot scripts).
 * Later starts restore the boot snapshot and fetch only what the learner opens.
 */
export const LAB_BOOT_READ_BYTES = 9 * 1024 * 1024;

/** Bytes downloaded on the first start of a lab machine. */
export function labDownloadBytes(m: LabManifest, profileId: string): number {
  const fs = m.profiles[profileId]?.fsJson;
  const out = (f?: string) => (f ? (m.outputs[f]?.size ?? 0) : 0);
  return WASM_BYTES + WORKER_BYTES + out(m.kernel.file) + out(m.initrd.file) + out(fs) + LAB_BOOT_READ_BYTES;
}
