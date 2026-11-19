// zlib for the git server: a synchronous inflate (RFC 1951) that also says how
// many input bytes it consumed — a packfile is a row of zlib streams without
// lengths, so the reader must know where each one ends — and a "stored"
// deflate (no compression, valid zlib) for objects and packs we write.
// Compression is not worth it on a link inside one browser tab.

class BitReader {
  pos: number;
  private bit = 0;
  private cur = 0;
  constructor(
    private b: Uint8Array,
    start: number,
  ) {
    this.pos = start;
  }
  bits(n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) {
      if (this.bit === 0) {
        if (this.pos >= this.b.length) throw new Error('inflate: unexpected end of data');
        this.cur = this.b[this.pos++];
      }
      v |= ((this.cur >> this.bit) & 1) << i;
      this.bit = (this.bit + 1) & 7;
    }
    return v;
  }
  align() {
    this.bit = 0;
  }
  byte(): number {
    if (this.pos >= this.b.length) throw new Error('inflate: unexpected end of data');
    return this.b[this.pos++];
  }
}

interface Huff {
  counts: Uint16Array;
  symbols: Uint16Array;
}

function buildHuff(lengths: Uint8Array | number[], n: number): Huff {
  const counts = new Uint16Array(16);
  const symbols = new Uint16Array(n);
  for (let i = 0; i < n; i++) counts[lengths[i]]++;
  counts[0] = 0;
  const offs = new Uint16Array(16);
  for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + counts[i - 1];
  for (let i = 0; i < n; i++) if (lengths[i]) symbols[offs[lengths[i]]++] = i;
  return { counts, symbols };
}

function decodeSym(r: BitReader, h: Huff): number {
  let code = 0;
  let first = 0;
  let index = 0;
  for (let len = 1; len < 16; len++) {
    code |= r.bits(1);
    const count = h.counts[len];
    if (code - count < first) return h.symbols[index + (code - first)];
    index += count;
    first += count;
    first <<= 1;
    code <<= 1;
  }
  throw new Error('inflate: bad Huffman code');
}

const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CLORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

let fixed: { lit: Huff; dist: Huff } | null = null;
function fixedTables() {
  if (fixed) return fixed;
  const l = new Uint8Array(288);
  for (let i = 0; i < 144; i++) l[i] = 8;
  for (let i = 144; i < 256; i++) l[i] = 9;
  for (let i = 256; i < 280; i++) l[i] = 7;
  for (let i = 280; i < 288; i++) l[i] = 8;
  fixed = { lit: buildHuff(l, 288), dist: buildHuff(new Uint8Array(30).fill(5), 30) };
  return fixed;
}

class Out {
  buf: Uint8Array;
  len = 0;
  constructor(hint: number) {
    this.buf = new Uint8Array(Math.max(1024, hint));
  }
  ensure(n: number) {
    if (this.len + n <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.len + n) cap *= 2;
    const b = new Uint8Array(cap);
    b.set(this.buf.subarray(0, this.len));
    this.buf = b;
  }
  push(v: number) {
    this.ensure(1);
    this.buf[this.len++] = v;
  }
}

/** Inflate raw deflate data starting at `start`. Returns the data and the offset after the stream. */
export function inflateRaw(b: Uint8Array, start = 0, sizeHint = 0): { data: Uint8Array; end: number } {
  const r = new BitReader(b, start);
  const out = new Out(sizeHint);
  for (;;) {
    const last = r.bits(1);
    const type = r.bits(2);
    if (type === 0) {
      r.align();
      const len = r.byte() | (r.byte() << 8);
      r.byte();
      r.byte();
      out.ensure(len);
      for (let i = 0; i < len; i++) out.buf[out.len++] = r.byte();
    } else if (type === 1 || type === 2) {
      let lit: Huff;
      let dist: Huff;
      if (type === 1) ({ lit, dist } = fixedTables());
      else {
        const hlit = r.bits(5) + 257;
        const hdist = r.bits(5) + 1;
        const hclen = r.bits(4) + 4;
        const cl = new Uint8Array(19);
        for (let i = 0; i < hclen; i++) cl[CLORDER[i]] = r.bits(3);
        const clh = buildHuff(cl, 19);
        const lens = new Uint8Array(hlit + hdist);
        for (let i = 0; i < hlit + hdist; ) {
          const sym = decodeSym(r, clh);
          if (sym < 16) lens[i++] = sym;
          else {
            let rep = 0;
            let val = 0;
            if (sym === 16) {
              if (!i) throw new Error('inflate: repeat with no previous length');
              val = lens[i - 1];
              rep = 3 + r.bits(2);
            } else if (sym === 17) rep = 3 + r.bits(3);
            else rep = 11 + r.bits(7);
            while (rep--) lens[i++] = val;
          }
        }
        lit = buildHuff(lens.subarray(0, hlit), hlit);
        dist = buildHuff(lens.subarray(hlit), hdist);
      }
      for (;;) {
        const sym = decodeSym(r, lit);
        if (sym < 256) out.push(sym);
        else if (sym === 256) break;
        else {
          const li = sym - 257;
          if (li >= 29) throw new Error('inflate: bad length code');
          const len = LBASE[li] + r.bits(LEXT[li]);
          const di = decodeSym(r, dist);
          if (di >= 30) throw new Error('inflate: bad distance code');
          const d = DBASE[di] + r.bits(DEXT[di]);
          if (d > out.len) throw new Error('inflate: distance too far back');
          out.ensure(len);
          for (let i = 0; i < len; i++) {
            out.buf[out.len] = out.buf[out.len - d];
            out.len++;
          }
        }
      }
    } else throw new Error('inflate: bad block type');
    if (last) break;
  }
  return { data: out.buf.slice(0, out.len), end: r.pos };
}

export function adler32(b: Uint8Array): number {
  let a = 1;
  let s = 0;
  for (let i = 0; i < b.length; ) {
    const end = Math.min(b.length, i + 3800);
    for (; i < end; i++) {
      a += b[i];
      s += a;
    }
    a %= 65521;
    s %= 65521;
  }
  return ((s << 16) | a) >>> 0;
}

/** Inflate a zlib stream (2-byte header, deflate, Adler-32) at `start`. */
export function inflateZlib(b: Uint8Array, start = 0, sizeHint = 0): { data: Uint8Array; end: number } {
  if (b.length < start + 2) throw new Error('zlib: truncated header');
  const cmf = b[start];
  const flg = b[start + 1];
  if ((cmf & 15) !== 8 || ((cmf << 8) | flg) % 31 !== 0) throw new Error('zlib: bad header');
  if (flg & 0x20) throw new Error('zlib: preset dictionary not supported');
  const r = inflateRaw(b, start + 2, sizeHint);
  const end = r.end + 4;
  if (end > b.length) throw new Error('zlib: truncated checksum');
  const want = ((b[r.end] << 24) | (b[r.end + 1] << 16) | (b[r.end + 2] << 8) | b[r.end + 3]) >>> 0;
  if (adler32(r.data) !== want) throw new Error('zlib: checksum mismatch');
  return { data: r.data, end };
}

/** A zlib stream of stored (uncompressed) deflate blocks. */
export function deflateZlibStored(data: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(data.length / 65535));
  const out = new Uint8Array(2 + data.length + blocks * 5 + 4);
  out[0] = 0x78;
  out[1] = 0x01;
  let o = 2;
  for (let i = 0; i < blocks; i++) {
    const chunk = data.subarray(i * 65535, Math.min(data.length, (i + 1) * 65535));
    out[o++] = i === blocks - 1 ? 1 : 0;
    out[o++] = chunk.length & 255;
    out[o++] = chunk.length >> 8;
    out[o++] = ~chunk.length & 255;
    out[o++] = (~chunk.length >> 8) & 255;
    out.set(chunk, o);
    o += chunk.length;
  }
  const a = adler32(data);
  out[o++] = a >>> 24;
  out[o++] = (a >>> 16) & 255;
  out[o++] = (a >>> 8) & 255;
  out[o++] = a & 255;
  return out;
}

/** Gunzip (RFC 1952), for `Content-Encoding: gzip` request bodies (git sends large negotiations this way). */
export function gunzip(b: Uint8Array): Uint8Array {
  if (b.length < 18 || b[0] !== 0x1f || b[1] !== 0x8b || b[2] !== 8) throw new Error('gzip: bad header');
  const flg = b[3];
  let p = 10;
  if (flg & 4) p += 2 + (b[p] | (b[p + 1] << 8));
  if (flg & 8) while (b[p++] !== 0);
  if (flg & 16) while (b[p++] !== 0);
  if (flg & 2) p += 2;
  return inflateRaw(b, p).data;
}
