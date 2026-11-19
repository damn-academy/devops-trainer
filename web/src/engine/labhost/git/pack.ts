// Packfiles (version 2): reading what `git push` sends (with OFS_DELTA and
// REF_DELTA, including thin packs whose bases are already on the server) and
// writing what `git clone`/`fetch` receive (whole objects, stored zlib).

import { concat, put32, u32, utf8 } from '../wire';
import { hexToBytes, NUM_TYPE, objectId, sha1, TYPE_NUM, type GitObject, type GitType } from './objects';
import { deflateZlibStored, inflateZlib } from './zlib';

const OFS_DELTA = 6;
const REF_DELTA = 7;

/** Apply a git delta to a base object body. */
export function applyDelta(base: Uint8Array, delta: Uint8Array): Uint8Array {
  let i = 0;
  const varint = () => {
    let v = 0;
    let shift = 0;
    let b: number;
    do {
      b = delta[i++];
      v += (b & 0x7f) * 2 ** shift;
      shift += 7;
    } while (b & 0x80);
    return v;
  };
  const baseLen = varint();
  if (baseLen !== base.length) throw new Error(`delta base size mismatch: ${baseLen} != ${base.length}`);
  const outLen = varint();
  const out = new Uint8Array(outLen);
  let o = 0;
  while (i < delta.length) {
    const op = delta[i++];
    if (op & 0x80) {
      let off = 0;
      let size = 0;
      for (let k = 0; k < 4; k++) if (op & (1 << k)) off |= delta[i++] << (8 * k);
      for (let k = 0; k < 3; k++) if (op & (0x10 << k)) size |= delta[i++] << (8 * k);
      off >>>= 0;
      if (size === 0) size = 0x10000;
      out.set(base.subarray(off, off + size), o);
      o += size;
    } else if (op) {
      out.set(delta.subarray(i, i + op), o);
      o += op;
      i += op;
    } else throw new Error('delta: reserved opcode 0');
  }
  if (o !== outLen) throw new Error('delta: result size mismatch');
  return out;
}

export interface ParsedPack {
  objects: Map<string, GitObject>;
}

/**
 * Read a pack. `lookup` finds base objects that are not in the pack (a thin
 * pack from `git push` refers to objects the server already has).
 */
export function readPack(pack: Uint8Array, lookup: (oid: string) => GitObject | undefined): ParsedPack {
  if (pack.length < 32 || String.fromCharCode(...pack.subarray(0, 4)) !== 'PACK') throw new Error('not a packfile');
  const version = u32(pack, 4);
  if (version !== 2 && version !== 3) throw new Error(`unsupported pack version ${version}`);
  const count = u32(pack, 8);
  const trailer = Array.from(pack.subarray(pack.length - 20), (x) => x.toString(16).padStart(2, '0')).join('');
  if (sha1(pack.subarray(0, pack.length - 20)) !== trailer) throw new Error('pack checksum mismatch');

  const byOffset = new Map<number, GitObject>();
  const objects = new Map<string, GitObject>();
  const pendingRef: { at: number; base: string; delta: Uint8Array }[] = [];
  const pendingOfs: { at: number; baseAt: number; delta: Uint8Array }[] = [];
  let p = 12;
  for (let n = 0; n < count; n++) {
    const at = p;
    let b = pack[p++];
    const type = (b >> 4) & 7;
    let size = b & 15;
    let shift = 4;
    while (b & 0x80) {
      b = pack[p++];
      size += (b & 0x7f) * 2 ** shift;
      shift += 7;
    }
    if (type === OFS_DELTA) {
      b = pack[p++];
      let off = b & 0x7f;
      while (b & 0x80) {
        b = pack[p++];
        off = (off + 1) * 128 + (b & 0x7f);
      }
      const z = inflateZlib(pack, p, size);
      p = z.end;
      pendingOfs.push({ at, baseAt: at - off, delta: z.data });
    } else if (type === REF_DELTA) {
      const base = Array.from(pack.subarray(p, p + 20), (x) => x.toString(16).padStart(2, '0')).join('');
      p += 20;
      const z = inflateZlib(pack, p, size);
      p = z.end;
      pendingRef.push({ at, base, delta: z.data });
    } else {
      const t = NUM_TYPE[type];
      if (!t) throw new Error(`bad object type ${type} in pack`);
      const z = inflateZlib(pack, p, size);
      p = z.end;
      if (z.data.length !== size) throw new Error('object size mismatch in pack');
      const obj = { type: t, body: z.data };
      byOffset.set(at, obj);
      objects.set(objectId(t, z.data), obj);
    }
  }
  // Resolve deltas until nothing changes (a delta may depend on another delta).
  for (let progress = true; progress && (pendingOfs.length || pendingRef.length); ) {
    progress = false;
    for (let i = pendingOfs.length - 1; i >= 0; i--) {
      const d = pendingOfs[i];
      const base = byOffset.get(d.baseAt);
      if (!base) continue;
      const obj = { type: base.type, body: applyDelta(base.body, d.delta) };
      byOffset.set(d.at, obj);
      objects.set(objectId(obj.type, obj.body), obj);
      pendingOfs.splice(i, 1);
      progress = true;
    }
    for (let i = pendingRef.length - 1; i >= 0; i--) {
      const d = pendingRef[i];
      const base = objects.get(d.base) ?? lookup(d.base);
      if (!base) continue;
      const obj = { type: base.type, body: applyDelta(base.body, d.delta) };
      byOffset.set(d.at, obj);
      objects.set(objectId(obj.type, obj.body), obj);
      pendingRef.splice(i, 1);
      progress = true;
    }
  }
  if (pendingOfs.length || pendingRef.length) throw new Error(`pack has ${pendingOfs.length + pendingRef.length} deltas with missing bases`);
  return { objects };
}

/** Write a pack of whole objects. */
export function writePack(objs: { type: GitType; body: Uint8Array }[]): Uint8Array {
  const head = new Uint8Array(12);
  head.set(utf8('PACK'), 0);
  put32(head, 4, 2);
  put32(head, 8, objs.length);
  const parts: Uint8Array[] = [head];
  for (const o of objs) {
    let size = o.body.length;
    const hdr: number[] = [];
    let b = (TYPE_NUM[o.type] << 4) | (size & 15);
    size = Math.floor(size / 16);
    while (size > 0) {
      hdr.push(b | 0x80);
      b = size & 0x7f;
      size = Math.floor(size / 128);
    }
    hdr.push(b);
    parts.push(Uint8Array.from(hdr), deflateZlibStored(o.body));
  }
  const body = concat(parts);
  return concat([body, hexToBytes(sha1(body))]);
}
