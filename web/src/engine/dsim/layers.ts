// Layers of an image and the writable layer of a container (04 §11.1
// engine/fs.ts): a layer is a set of path entries, like the members of a tar
// archive; whiteouts mark deletions the way the OCI layer format does
// (`.wh.<name>`, `.wh..wh..opq`). Merging layers bottom-up is what OverlayFS
// shows as `merged`. Sizes are "weights": a binary can weigh 8 MB while the
// simulator stores only a short text for it.

import { canonicalJson, digestOf } from './util';

export type EntryType = 'f' | 'd' | 'l' | 'w' | 'o';

/**
 * One member of a layer.
 *  - f file, d directory, l symlink;
 *  - w whiteout: "this path is deleted in this layer" (in a tar: `.wh.<name>`);
 *  - o opaque directory: "hide everything below from lower layers" (`.wh..wh..opq`).
 */
export interface LayerEntry {
  t: EntryType;
  mode: number;
  uid: number;
  gid: number;
  /** Bytes this entry weighs in the image (defaults to the text length). */
  size: number;
  text?: string;
  target?: string;
}

export type LayerFiles = Record<string, LayerEntry>;

export interface Layer {
  /** sha256 of the uncompressed layer (config.rootfs.diff_ids). */
  diffId: string;
  /** sha256 of the compressed blob (manifest.layers[].digest). */
  digest: string;
  /** Uncompressed size. */
  size: number;
  /** Compressed size (what is downloaded). */
  csize: number;
  files: LayerFiles;
  createdBy: string;
}

export const file = (text: string, o: Partial<LayerEntry> = {}): LayerEntry => ({ t: 'f', mode: 0o644, uid: 0, gid: 0, size: o.size ?? new TextEncoder().encode(text).length, text, ...o });
export const bin = (size: number, o: Partial<LayerEntry> = {}): LayerEntry => ({ t: 'f', mode: 0o755, uid: 0, gid: 0, size, text: '\x7fELF (binary)\n', ...o });
export const dir = (o: Partial<LayerEntry> = {}): LayerEntry => ({ t: 'd', mode: 0o755, uid: 0, gid: 0, size: 0, ...o });
export const link = (target: string): LayerEntry => ({ t: 'l', mode: 0o777, uid: 0, gid: 0, size: 0, target });
export const whiteout = (): LayerEntry => ({ t: 'w', mode: 0, uid: 0, gid: 0, size: 0 });

export function parentOf(p: string): string {
  const i = p.lastIndexOf('/');
  return i <= 0 ? '/' : p.slice(0, i);
}

/** Every directory above `p`, from the root down: /usr, /usr/share for /usr/share/x. */
export function ancestors(p: string): string[] {
  const parts = p.split('/').filter(Boolean);
  const out: string[] = [];
  for (let i = 1; i < parts.length; i++) out.push('/' + parts.slice(0, i).join('/'));
  return out;
}

/** Add missing parent directories, so a layer can be listed like a tar. */
export function withParents(files: LayerFiles): LayerFiles {
  const out: LayerFiles = { ...files };
  for (const p of Object.keys(files)) for (const a of ancestors(p)) if (!out[a]) out[a] = dir();
  return out;
}

/**
 * Overlay the layers bottom-up (index 0 is the lowest), as OverlayFS does:
 * an upper entry hides the lower one; a whiteout hides it and leaves nothing;
 * an opaque directory hides everything the lower layers had below it.
 */
export function merge(layers: LayerFiles[]): LayerFiles {
  const out: LayerFiles = {};
  for (const layer of layers) {
    const paths = Object.keys(layer).sort();
    for (const p of paths) {
      const e = layer[p];
      // a whiteout, an opaque directory or a non-directory hides the whole lower subtree
      if (e.t !== 'd') for (const k of Object.keys(out)) if (k === p || k.startsWith(p + '/')) delete out[k];
      if (e.t === 'w') continue;
      if (e.t === 'o') {
        out[p] = { ...e, t: 'd' };
        continue;
      }
      out[p] = e;
    }
  }
  return out;
}

/** The same merge, but answering "which layer did each merged path come from". */
export function provenance(layers: LayerFiles[]): Record<string, number> {
  const from: Record<string, number> = {};
  layers.forEach((layer, i) => {
    for (const p of Object.keys(layer).sort()) {
      const e = layer[p];
      const prefix = p + '/';
      if (e.t !== 'd') for (const k of Object.keys(from)) if (k === p || k.startsWith(prefix)) delete from[k];
      if (e.t === 'w') continue;
      from[p] = i;
    }
  });
  return from;
}

/**
 * What changed from `base` to `next`, as a new layer: added and changed
 * entries, and whiteouts for removed paths (only the top-most removed path of
 * a removed subtree gets a whiteout, as in a real diff).
 */
export function diff(base: LayerFiles, next: LayerFiles): LayerFiles {
  const out: LayerFiles = {};
  for (const [p, e] of Object.entries(next)) {
    const b = base[p];
    if (!b || !sameEntry(b, e)) out[p] = e;
  }
  const removed = Object.keys(base).filter((p) => !(p in next)).sort();
  for (const p of removed) {
    if (removed.some((q) => q !== p && p.startsWith(q + '/'))) continue;
    out[p] = whiteout();
  }
  return out;
}

export function sameEntry(a: LayerEntry, b: LayerEntry): boolean {
  if (a.t !== b.t || a.mode !== b.mode || a.uid !== b.uid || a.gid !== b.gid || a.target !== b.target) return false;
  if (a.t === 'd') return true;
  return a.size === b.size && (a.text ?? '') === (b.text ?? '');
}

/** Apply a diff on top of a layer (the writable layer of a container accumulates changes). */
export function applyDiff(upper: LayerFiles, change: LayerFiles, lower: LayerFiles): LayerFiles {
  const out: LayerFiles = { ...upper };
  for (const [p, e] of Object.entries(change)) {
    if (e.t === 'w') {
      for (const k of Object.keys(out)) if (k === p || k.startsWith(p + '/')) delete out[k];
      // a whiteout is needed only if a lower layer still has the path
      if (p in lower || Object.keys(lower).some((k) => k.startsWith(p + '/'))) out[p] = e;
    } else out[p] = e;
  }
  return out;
}

/** The uncompressed size of a layer: the sum of entry weights. */
export function layerSize(files: LayerFiles): number {
  let n = 0;
  for (const e of Object.values(files)) n += e.t === 'f' ? e.size : 0;
  return n;
}

/**
 * The deterministic "tar" of a layer: one line per member in path order. Its
 * sha256 is the diff_id; the "compressed" blob is modelled as a second,
 * different byte stream, so the two hashes differ as they do in a real image.
 */
export function serialize(files: LayerFiles): string {
  return Object.keys(files)
    .sort()
    .map((p) => {
      const e = files[p];
      const name = e.t === 'w' ? whiteoutName(p) : e.t === 'o' ? `${p}/.wh..wh..opq` : p;
      return canonicalJson([name, e.t === 'w' || e.t === 'o' ? 'f' : e.t, e.mode.toString(8), e.uid, e.gid, e.size, e.text ?? '', e.target ?? '']);
    })
    .join('\n');
}

/** `/a/b/c` → `/a/b/.wh.c`: how a deletion is written in a tar layer. */
export function whiteoutName(p: string): string {
  const parent = parentOf(p);
  const name = p.slice(p.lastIndexOf('/') + 1);
  return `${parent === '/' ? '' : parent}/.wh.${name}`;
}

/** Compression ratio of the model: text compresses well, binaries less. */
export function compressedSize(files: LayerFiles): number {
  let n = 512;
  for (const e of Object.values(files)) if (e.t === 'f') n += e.text && e.size === e.text.length ? Math.ceil(e.size * 0.3) : Math.ceil(e.size * 0.42);
  return n;
}

export async function makeLayer(files: LayerFiles, createdBy: string): Promise<Layer> {
  const full = withParents(files);
  const tar = serialize(full);
  const diffId = await digestOf(tar);
  const digest = await digestOf(`gzip\n${tar}`);
  return { diffId, digest, size: layerSize(full), csize: compressedSize(full), files: full, createdBy };
}

/** ChainID (image-spec config.md): ChainID(L0) = DiffID(L0); ChainID(Ln) = sha256(ChainID(Ln-1) + " " + DiffID(Ln)). */
export async function chainIds(diffIds: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const d of diffIds) out.push(out.length ? await digestOf(`${out[out.length - 1]} ${d}`) : d);
  return out;
}
