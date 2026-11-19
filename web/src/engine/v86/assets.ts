// Where the files of a real machine come from. The emulator (libv86 + wasm)
// is bundled from the `v86` npm package; BIOS and kernel are fetched into
// public/v86/ by scripts/fetch-v86.mjs and described in manifest.json.

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
