/** Zstandard decoder (RFC 8878) for the published node objects
 * (objects.ts): browsers have no zstd DecompressionStream. It decodes whole
 * frames into a buffer the caller sizes for the entire content, so that
 * buffer is the window. No dictionaries; the content checksum is skipped
 * (callers verify a SHA-256 of the result). Not reentrant. */

const fail = (what: string): never => { throw new Error(`zstd: ${what}`); };
const MAGIC = 0xfd2fb528, BLOCK_MAX = 1 << 17;

/** The input, copied with zero padding so that 32-bit loads never leave it. */
let buf = new Uint8Array(1 << 16);
const load32 = (i: number) => buf[i]! | buf[i + 1]! << 8 | buf[i + 2]! << 16 | buf[i + 3]! << 24;

// Backward bit stream (sequences): bits are read from the end towards `bs`;
// `bp` is the number of bits left. A read of n <= 25 bits returns the top n.
let bs = 0, bp = 0;
function openBackward(start: number, end: number) {
  if (end <= start || !buf[end - 1]) fail('corrupted bit stream');
  bs = start; bp = (end - 1 - start) * 8 + 31 - Math.clz32(buf[end - 1]!);
}
function bits(n: number): number {
  if (n === 0) return 0;
  if (n > bp) fail('corrupted bit stream');
  bp -= n;
  return (load32(bs + (bp >>> 3)) >>> (bp & 7)) & ((1 << n) - 1);
}
/** Like bits, but reads zeros below the start, as the reference decoder does
 * at the end of the Huffman weights stream; `bp` goes negative there. */
function bitsPast(n: number): number {
  bp -= n;
  if (bp >= 0) return (load32(bs + (bp >>> 3)) >>> (bp & 7)) & ((1 << n) - 1);
  const have = n + bp;
  return have > 0 ? (load32(bs) & ((1 << have) - 1)) << (n - have) : 0;
}

/** An FSE decoding table: symbol, bits to read and base of the next state. */
class FSETable {
  log = 0;
  readonly sym: Uint8Array; readonly nb: Uint8Array; readonly base: Uint16Array;
  constructor(maxLog: number) { const n = 1 << maxLog; this.sym = new Uint8Array(n); this.nb = new Uint8Array(n); this.base = new Uint16Array(n); }
  /** Builds the table from normalized counts (-1: "less than one"). */
  build(counts: Int16Array, symbols: number, log: number): this {
    const size = 1 << log, next = new Uint16Array(symbols);
    let high = size - 1;
    for (let s = 0; s < symbols; s++) {
      if (counts[s] === -1) { this.sym[high--] = s; next[s] = 1; } else next[s] = counts[s]!;
    }
    const step = (size >>> 1) + (size >>> 3) + 3, mask = size - 1;
    let pos = 0;
    for (let s = 0; s < symbols; s++) {
      for (let i = 0; i < counts[s]!; i++) {
        this.sym[pos] = s;
        do pos = (pos + step) & mask; while (pos > high);
      }
    }
    if (pos !== 0) fail('corrupted FSE table');
    for (let u = 0; u < size; u++) {
      const state = next[this.sym[u]!]!++;
      const nb = log - (31 - Math.clz32(state));
      this.nb[u] = nb; this.base[u] = (state << nb) - size;
    }
    this.log = log;
    return this;
  }
  rle(symbol: number): this { this.sym[0] = symbol; this.nb[0] = 0; this.base[0] = 0; this.log = 0; return this; }
}

const counts = new Int16Array(256);
/** Reads an FSE table description at `at` (forward bits); returns its end. */
function readCounts(at: number, end: number, maxSymbol: number, maxLog: number, table: FSETable): number {
  let pos = at * 8;
  const peek = (n: number) => (load32(pos >>> 3) >>> (pos & 7)) & ((1 << n) - 1);
  const log = peek(4) + 5; pos += 4;
  if (log > maxLog) fail('FSE accuracy too large');
  let remaining = (1 << log) + 1, threshold = 1 << log, nbBits = log + 1, s = 0;
  while (remaining > 1 && s <= maxSymbol) {
    const max = 2 * threshold - 1 - remaining;
    let count: number;
    if (peek(nbBits - 1) < max) { count = peek(nbBits - 1); pos += nbBits - 1; }
    else { count = peek(nbBits); if (count >= threshold) count -= max; pos += nbBits; }
    count--;
    remaining -= count < 0 ? -count : count;
    counts[s++] = count;
    if (count === 0) {
      for (;;) {
        const repeat = peek(2); pos += 2;
        for (let i = 0; i < repeat; i++) { if (s > maxSymbol) fail('corrupted FSE table'); counts[s++] = 0; }
        if (repeat !== 3) break;
      }
    }
    while (remaining < threshold) { nbBits--; threshold >>>= 1; }
    if (pos > end * 8) fail('truncated FSE table');
  }
  if (remaining !== 1 || s > maxSymbol + 1) fail('corrupted FSE table');
  table.build(counts, s, log);
  return (pos + 7) >>> 3;
}

// Huffman literals table: 2^hufLog entries of symbol | code length << 8.
const hufTable = new Uint16Array(1 << 11);
let hufLog = 0;
const weights = new Uint8Array(256), weightTable = new FSETable(6);
/** Reads a Huffman tree description at `at`; returns its end. */
function readHuffman(at: number, end: number): number {
  if (at >= end) fail('truncated Huffman tree');
  const header = buf[at]!;
  let n = 0, next: number;
  if (header >= 128) {
    n = header - 127; next = at + 1 + ((n + 1) >>> 1);
    if (next > end) fail('truncated Huffman tree');
    for (let i = 0; i < n; i++) weights[i] = i & 1 ? buf[at + 1 + (i >>> 1)]! & 15 : buf[at + 1 + (i >>> 1)]! >>> 4;
  } else {
    next = at + 1 + header;
    if (next > end || header === 0) fail('truncated Huffman tree');
    const stream = readCounts(at + 1, next, 255, 6, weightTable);
    openBackward(stream, next);
    const t = weightTable;
    let s1 = bitsPast(t.log), s2 = bitsPast(t.log);
    // Two interleaved states until the stream runs out (RFC 8878, 4.2.1.2).
    for (;;) {
      if (n > 253) fail('corrupted Huffman weights');
      weights[n++] = t.sym[s1]!; s1 = t.base[s1]! + bitsPast(t.nb[s1]!);
      if (bp < 0) { weights[n++] = t.sym[s2]!; break; }
      weights[n++] = t.sym[s2]!; s2 = t.base[s2]! + bitsPast(t.nb[s2]!);
      if (bp < 0) { weights[n++] = t.sym[s1]!; break; }
    }
  }
  let total = 0;
  for (let i = 0; i < n; i++) {
    if (weights[i]! > 11) fail('corrupted Huffman weights');
    if (weights[i]) total += 1 << (weights[i]! - 1);
  }
  if (!total) fail('corrupted Huffman weights');
  const log = 32 - Math.clz32(total), rest = (1 << log) - total;
  if (log > 11 || rest & (rest - 1)) fail('corrupted Huffman weights');
  weights[n++] = 32 - Math.clz32(rest);
  // Codes of weight 1 (the longest) first, then by weight, symbols in order.
  const start = new Uint32Array(13);
  for (let i = 0; i < n; i++) if (weights[i]) start[weights[i]!]! += 1 << (weights[i]! - 1);
  for (let w = 1, at2 = 0; w <= 12; w++) { const c = start[w]!; start[w] = at2; at2 += c; }
  for (let s = 0; s < n; s++) {
    const w = weights[s]!;
    if (!w) continue;
    const from = start[w]!, len = 1 << (w - 1);
    hufTable.fill(s | (log + 1 - w) << 8, from, from + len);
    start[w] = from + len;
  }
  hufLog = log;
  return next;
}
/** Decodes one Huffman stream [s, e) into out[o, o + n). */
function huffmanStream(out: Uint8Array, o: number, n: number, s: number, e: number) {
  if (e <= s || !buf[e - 1]) fail('corrupted literals');
  let p = (e - 1 - s) * 8 + 31 - Math.clz32(buf[e - 1]!);
  const log = hufLog, mask = (1 << log) - 1, table = hufTable, b = buf;
  const end = o + n;
  // Fast while a full code fits above the start; at most 11 + 7 bits per load.
  while (o < end && p >= log) {
    const q = p - log, i = s + (q >>> 3);
    const e = table[((b[i]! | b[i + 1]! << 8 | b[i + 2]! << 16) >>> (q & 7)) & mask]!;
    out[o++] = e; p -= e >>> 8;
  }
  while (o < end) {
    const e = table[p > 0 ? ((b[s]! | b[s + 1]! << 8) & ((1 << p) - 1)) << (log - p) : 0]!;
    out[o++] = e; p -= e >>> 8;
  }
  if (p !== 0) fail('corrupted literals');
}

const literals = new Uint8Array(BLOCK_MAX);
let litSrc: Uint8Array = literals, litAt = 0, litEnd = 0, hufReady = false;
/** Reads the literals section at `at`; returns its end. */
function readLiterals(at: number, end: number): number {
  const b0 = buf[at]!, type = b0 & 3, format = b0 >>> 2 & 3;
  if (type < 2) {
    let size: number, h: number;
    if (!(format & 1)) { size = b0 >>> 3; h = 1; }
    else if (format === 1) { size = (b0 >>> 4) + (buf[at + 1]! << 4); h = 2; }
    else { size = (b0 >>> 4) + (buf[at + 1]! << 4) + (buf[at + 2]! << 12); h = 3; }
    if (size > BLOCK_MAX) fail('literals too large');
    if (type === 0) {
      if (at + h + size > end) fail('truncated literals');
      litSrc = buf; litAt = at + h; litEnd = litAt + size;
      return at + h + size;
    }
    if (at + h >= end) fail('truncated literals');
    literals.fill(buf[at + h]!, 0, size);
    litSrc = literals; litAt = 0; litEnd = size;
    return at + h + 1;
  }
  const bitsEach = format < 2 ? 10 : format === 2 ? 14 : 18, h = format < 2 ? 3 : format === 2 ? 4 : 5;
  let header = 0;
  for (let i = h - 1; i >= 0; i--) header = header * 256 + buf[at + i]!;
  const size = Math.floor(header / 16) % (2 ** bitsEach), compressed = Math.floor(header / 2 ** (4 + bitsEach)) % (2 ** bitsEach);
  const streams = format === 0 ? 1 : 4, last = at + h + compressed;
  if (size > BLOCK_MAX || last > end) fail('corrupted literals');
  let p = at + h;
  if (type === 2) { p = readHuffman(p, last); hufReady = true; }
  else if (!hufReady) fail('treeless literals without a table');
  if (streams === 1) huffmanStream(literals, 0, size, p, last);
  else {
    if (p + 6 > last) fail('corrupted literals');
    const s1 = buf[p]! | buf[p + 1]! << 8, s2 = buf[p + 2]! | buf[p + 3]! << 8, s3 = buf[p + 4]! | buf[p + 5]! << 8;
    const part = (size + 3) >>> 2;
    let s = p + 6;
    if (s + s1 + s2 + s3 > last || part * 3 > size) fail('corrupted literals');
    huffmanStream(literals, 0, part, s, s += s1);
    huffmanStream(literals, part, part, s, s += s2);
    huffmanStream(literals, 2 * part, part, s, s += s3);
    huffmanStream(literals, 3 * part, size - 3 * part, s, last);
  }
  litSrc = literals; litAt = 0; litEnd = size;
  return last;
}

const LL_BASE = Uint32Array.of(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 40, 48, 64,
  128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536);
const LL_BITS = Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 3, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16);
const ML_BASE = Uint32Array.of(3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
  31, 32, 33, 34, 35, 37, 39, 41, 43, 47, 51, 59, 67, 83, 99, 131, 259, 515, 1027, 2051, 4099, 8195, 16387, 32771, 65539);
const ML_BITS = Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16);
const predefined = (values: number[], log: number) => new FSETable(log).build(Int16Array.from(values), values.length, log);
const LL_DEFAULT = predefined([4, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 2, 1, 1, 1, 1, 1, -1, -1, -1, -1], 6);
const ML_DEFAULT = predefined([1, 4, 3, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, -1], 6);
const OF_DEFAULT = predefined([1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1], 5);
// Per-frame state: the tables a Repeat mode refers to and the repeat offsets.
const own = [new FSETable(9), new FSETable(8), new FSETable(9)]; // literal lengths, offsets, match lengths
const MAX_SYMBOL = [35, 31, 52], MAX_LOG = [9, 8, 9], DEFAULTS = [LL_DEFAULT, OF_DEFAULT, ML_DEFAULT];
const current: (FSETable | undefined)[] = [undefined, undefined, undefined];
let rep0 = 1, rep1 = 4, rep2 = 8;

/** Decodes the sequences section at `at` and runs it into out from `op`; returns the new op. */
function sequences(out: Uint8Array, op: number, at: number, end: number): number {
  if (at >= end) fail('truncated sequences');
  let count = buf[at++]!;
  if (count >= 128) {
    if (count === 255) { count = buf[at]! + (buf[at + 1]! << 8) + 0x7f00; at += 2; }
    else { count = ((count - 128) << 8) + buf[at]!; at++; }
  }
  if (count === 0) {
    if (at !== end) fail('corrupted sequences');
    return copyLiterals(out, op, litEnd - litAt);
  }
  if (at >= end) fail('truncated sequences');
  const modes = buf[at++]!;
  if (modes & 3) fail('reserved sequence mode');
  for (let k = 0; k < 3; k++) {
    const mode = modes >>> (6 - 2 * k) & 3;
    if (mode === 0) current[k] = DEFAULTS[k];
    else if (mode === 1) {
      if (at >= end || buf[at]! > MAX_SYMBOL[k]!) fail('corrupted sequences');
      current[k] = own[k]!.rle(buf[at++]!);
    } else if (mode === 2) at = readCounts(at, end, MAX_SYMBOL[k]!, MAX_LOG[k]!, current[k] = own[k]!);
    else if (!current[k]) fail('repeat mode without a table');
    if (at > end) fail('truncated sequences');
  }
  const ll = current[0]!, of = current[1]!, ml = current[2]!;
  openBackward(at, end);
  let lls = bits(ll.log), ofs = bits(of.log), mls = bits(ml.log);
  const limit = out.length, b = buf, base = bs;
  let p = bp, w = 0, k = 0;
  // Bit reads are written out: a helper closing over p was 10 % slower.
  // `w = load at p; v = w >>> (p & 7) & mask` takes the top bits below p.
  for (let n = 1; n <= count; n++) {
    const ofCode = of.sym[ofs]!, mlCode = ml.sym[mls]!, llCode = ll.sym[lls]!;
    let offset: number;
    if (ofCode > 25) { bp = p; offset = (2 ** ofCode) + bits(ofCode - 25) * (1 << 25) + bits(25); p = bp; }
    else {
      if ((p -= ofCode) < 0) fail('corrupted bit stream');
      k = base + (p >>> 3); w = b[k]! | b[k + 1]! << 8 | b[k + 2]! << 16 | b[k + 3]! << 24;
      offset = (1 << ofCode) + ((w >>> (p & 7)) & ((1 << ofCode) - 1));
    }
    let x = ML_BITS[mlCode]!;
    if ((p -= x) < 0) fail('corrupted bit stream');
    k = base + (p >>> 3); w = b[k]! | b[k + 1]! << 8 | b[k + 2]! << 16 | b[k + 3]! << 24;
    const matchLength = ML_BASE[mlCode]! + ((w >>> (p & 7)) & ((1 << x) - 1));
    x = LL_BITS[llCode]!;
    if ((p -= x) < 0) fail('corrupted bit stream');
    k = base + (p >>> 3); w = b[k]! | b[k + 1]! << 8 | b[k + 2]! << 16 | b[k + 3]! << 24;
    const literalLength = LL_BASE[llCode]! + ((w >>> (p & 7)) & ((1 << x) - 1));
    if (offset > 3) { rep2 = rep1; rep1 = rep0; rep0 = offset -= 3; }
    else {
      const index = offset - 1 + (literalLength === 0 ? 1 : 0);
      if (index === 0) offset = rep0;
      else {
        offset = index === 1 ? rep1 : index === 2 ? rep2 : rep0 - 1;
        if (index !== 1) rep2 = rep1;
        rep1 = rep0; rep0 = offset;
      }
    }
    if (n !== count) {
      // Literal lengths first, then match lengths and offsets (at most
      // 9 + 8 bits) from one load.
      const a = ll.nb[lls]!, c = ml.nb[mls]!, d = of.nb[ofs]!;
      if ((p -= a) < 0) fail('corrupted bit stream');
      k = base + (p >>> 3); w = b[k]! | b[k + 1]! << 8 | b[k + 2]! << 16;
      lls = ll.base[lls]! + ((w >>> (p & 7)) & ((1 << a) - 1));
      if ((p -= c + d) < 0) fail('corrupted bit stream');
      k = base + (p >>> 3); w = (b[k]! | b[k + 1]! << 8 | b[k + 2]! << 16) >>> (p & 7);
      ofs = of.base[ofs]! + (w & ((1 << d) - 1));
      mls = ml.base[mls]! + ((w >>> d) & ((1 << c) - 1));
    }
    // Literals, then the match from earlier output.
    if (litAt + literalLength > litEnd) fail('corrupted sequences');
    if (op + literalLength + matchLength > limit) fail('output buffer too small');
    if (literalLength > 16) { out.set(litSrc.subarray(litAt, litAt + literalLength), op); op += literalLength; litAt += literalLength; }
    else for (const stop = op + literalLength; op < stop;) out[op++] = litSrc[litAt++]!;
    if (offset === 0 || offset > op) fail('offset beyond the output');
    let from = op - offset;
    if (matchLength <= 16) for (const stop = op + matchLength; op < stop;) out[op++] = out[from++]!;
    else if (matchLength <= offset) { out.copyWithin(op, from, from + matchLength); op += matchLength; }
    else {
      // An overlapping match repeats the last `offset` bytes: copy them, then
      // twice as many from the same start, and so on.
      for (let left = matchLength, chunk = offset; left > 0; chunk *= 2) {
        const len = chunk < left ? chunk : left;
        out.copyWithin(op, from, from + len); op += len; left -= len;
      }
    }
  }
  if (p !== 0) fail('corrupted sequences');
  return copyLiterals(out, op, litEnd - litAt);
}
function copyLiterals(out: Uint8Array, op: number, n: number): number {
  if (op + n > out.length) fail('output buffer too small');
  if (n > 32) out.set(litSrc.subarray(litAt, litAt + n), op);
  else for (let i = 0; i < n; i++) out[op + i] = litSrc[litAt + i]!;
  litAt += n;
  return op + n;
}

/** Decodes every frame in src into out; returns the number of bytes written.
 * Throws if src is not valid zstd or the content does not fit in out. */
export function zstdDecompress(src: Uint8Array, out: Uint8Array): number {
  if (buf.length < src.length + 8) buf = new Uint8Array(src.length + 8 + (src.length >>> 3));
  buf.set(src); buf.fill(0, src.length, src.length + 8);
  const size = src.length;
  let at = 0, op = 0;
  while (at < size) {
    if (at + 4 > size) fail('truncated frame');
    const magic = load32(at) >>> 0;
    if ((magic & 0xfffffff0) >>> 0 === 0x184d2a50) {
      if (at + 8 > size) fail('truncated skippable frame');
      at += 8 + (load32(at + 4) >>> 0);
      if (at > size) fail('truncated skippable frame');
      continue;
    }
    if (magic !== MAGIC) fail('not a zstd frame');
    if (at + 5 > size) fail('truncated frame header');
    const fhd = buf[at + 4]!;
    const fcsFlag = fhd >>> 6, single = fhd & 32, checksum = fhd & 4, didSize = [0, 1, 2, 4][fhd & 3]!;
    if (fhd & 8) fail('reserved frame header bit');
    let h = at + 5 + (single ? 0 : 1);
    let dictionary = 0;
    for (let i = didSize - 1; i >= 0; i--) dictionary = dictionary * 256 + buf[h + i]!;
    if (dictionary) fail('dictionaries are not supported');
    h += didSize;
    const fcsSize = fcsFlag === 0 ? (single ? 1 : 0) : 1 << fcsFlag;
    let content = -1;
    if (fcsSize) {
      content = 0;
      for (let i = fcsSize - 1; i >= 0; i--) content = content * 256 + buf[h + i]!;
      if (fcsSize === 2) content += 256;
    }
    h += fcsSize;
    if (h > size) fail('truncated frame header');
    const frameStart = op;
    current[0] = current[1] = current[2] = undefined; hufReady = false; rep0 = 1; rep1 = 4; rep2 = 8;
    for (let last = 0; !last;) {
      if (h + 3 > size) fail('truncated block');
      const header = buf[h]! | buf[h + 1]! << 8 | buf[h + 2]! << 16;
      last = header & 1;
      const type = header >>> 1 & 3, blockSize = header >>> 3;
      h += 3;
      if (blockSize > BLOCK_MAX) fail('block too large');
      if (type === 0) {
        if (h + blockSize > size) fail('truncated block');
        if (op + blockSize > out.length) fail('output buffer too small');
        out.set(buf.subarray(h, h + blockSize), op); op += blockSize; h += blockSize;
      } else if (type === 1) {
        if (h >= size) fail('truncated block');
        if (op + blockSize > out.length) fail('output buffer too small');
        out.fill(buf[h]!, op, op + blockSize); op += blockSize; h++;
      } else if (type === 2) {
        const end = h + blockSize;
        if (end > size || blockSize === 0) fail('truncated block');
        const blockStart = op;
        op = sequences(out, op, readLiterals(h, end), end);
        if (op - blockStart > BLOCK_MAX) fail('block too large');
        h = end;
      } else fail('reserved block type');
    }
    if (checksum) { if (h + 4 > size) fail('truncated checksum'); h += 4; }
    if (content >= 0 && op - frameStart !== content) fail('frame content size mismatch');
    at = h;
  }
  // Do not keep a large input alive between calls.
  if (buf.length > 1 << 22) buf = new Uint8Array(1 << 16);
  return op;
}
