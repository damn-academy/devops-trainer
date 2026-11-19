// Compatibility and integrity checks shared by the browser and snapshot builder.
import { version as v86Version } from 'v86/package.json';
import type { LabManifest } from './assets';

export const V86_VERSION = v86Version;
export interface BootSnapshot {
  file: string;
  sha256: string;
  size: number;
  v86: string;
  imageHash: string;
  key: string;
}

export async function digest(data: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function imageHash(m: LabManifest, fs: string): Promise<string> {
  return digest(new TextEncoder().encode(JSON.stringify([
    m.outputs[m.kernel.file]?.sha256, m.outputs[m.initrd.file]?.sha256,
    m.outputs[fs]?.sha256, m.cmdline,
  ])).buffer);
}

export async function fetchBootSnapshot(entry: BootSnapshot | undefined, key: string, hash: string, url: (file: string) => string, cache?: (gzip: ArrayBuffer) => Promise<unknown>): Promise<ArrayBuffer | null> {
  if (!entry || entry.key !== key || entry.v86 !== V86_VERSION || entry.imageHash !== hash) return null;
  try {
    const response = await fetch(url(entry.file));
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== entry.size || await digest(bytes) !== entry.sha256) return null;
    const state = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    await cache?.(bytes);
    return state;
  } catch {
    return null;
  }
}
