// Git objects as real Git stores them: SHA-1 of "<type> <size>\0<body>",
// binary trees, text commits. Enough to walk history for upload-pack and
// to read files for webhooks and CI.

import { concat, dec, utf8 } from '../wire';

export type GitType = 'commit' | 'tree' | 'blob' | 'tag';
export const TYPE_NUM: Record<GitType, number> = { commit: 1, tree: 2, blob: 3, tag: 4 };
export const NUM_TYPE: Record<number, GitType> = { 1: 'commit', 2: 'tree', 3: 'blob', 4: 'tag' };

export interface GitObject {
  type: GitType;
  body: Uint8Array;
}

// ── SHA-1 (synchronous: packs are built in one pass) ──

export function sha1(data: Uint8Array): string {
  const ml = data.length;
  const total = (((ml + 8) >> 6) + 1) << 6;
  const buf = new Uint8Array(total);
  buf.set(data);
  buf[ml] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 8, Math.floor((ml * 8) / 2 ** 32));
  view.setUint32(total - 4, (ml * 8) >>> 0);
  let h0 = 0x67452301,
    h1 = 0xefcdab89,
    h2 = 0x98badcfe,
    h3 = 0x10325476,
    h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (x << 1) | (x >>> 31);
    }
    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const t = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = t;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return b;
}

export function bytesToHex(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += x.toString(16).padStart(2, '0');
  return s;
}

export function objectId(type: GitType, body: Uint8Array): string {
  return sha1(concat([utf8(`${type} ${body.length}\0`), body]));
}

// ── trees and commits ──

export interface TreeEntry {
  mode: string;
  name: string;
  oid: string;
}

export function parseTree(body: Uint8Array): TreeEntry[] {
  const out: TreeEntry[] = [];
  for (let i = 0; i < body.length; ) {
    let sp = i;
    while (body[sp] !== 0x20) sp++;
    let nul = sp + 1;
    while (body[nul] !== 0) nul++;
    out.push({ mode: dec.decode(body.subarray(i, sp)), name: dec.decode(body.subarray(sp + 1, nul)), oid: bytesToHex(body.subarray(nul + 1, nul + 21)) });
    i = nul + 21;
  }
  return out;
}

export function serializeTree(entries: TreeEntry[]): Uint8Array {
  // Git sorts trees by name, with directories compared as if they ended in '/'.
  const key = (e: TreeEntry) => (e.mode === '40000' ? `${e.name}/` : e.name);
  const sorted = [...entries].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  return concat(sorted.flatMap((e) => [utf8(`${e.mode} ${e.name}\0`), hexToBytes(e.oid)]));
}

export interface Commit {
  tree: string;
  parents: string[];
  author: string;
  committer: string;
  message: string;
}

export function parseCommit(body: Uint8Array): Commit {
  const text = dec.decode(body);
  const end = text.indexOf('\n\n');
  const head = end < 0 ? text : text.slice(0, end);
  const c: Commit = { tree: '', parents: [], author: '', committer: '', message: end < 0 ? '' : text.slice(end + 2) };
  for (const line of head.split('\n')) {
    const sp = line.indexOf(' ');
    const k = line.slice(0, sp);
    const v = line.slice(sp + 1);
    if (k === 'tree') c.tree = v;
    else if (k === 'parent') c.parents.push(v);
    else if (k === 'author') c.author = v;
    else if (k === 'committer') c.committer = v;
  }
  return c;
}

export function serializeCommit(c: Commit): Uint8Array {
  return utf8(`tree ${c.tree}\n${c.parents.map((p) => `parent ${p}\n`).join('')}author ${c.author}\ncommitter ${c.committer}\n\n${c.message}`);
}

/** The object a tag points to. */
export function tagTarget(body: Uint8Array): string {
  return /^object ([0-9a-f]{40})/.exec(dec.decode(body.subarray(0, 60)))?.[1] ?? '';
}
