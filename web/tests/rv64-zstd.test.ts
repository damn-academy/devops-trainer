import { expect, test } from 'vitest';
import zlib from 'node:zlib';
import { zstdDecompress } from '../src/engine/rv64/zstd';
const Z = zlib.constants;
const compress = (b: Uint8Array, params: Record<number, number> = {}) => new Uint8Array(zlib.zstdCompressSync(b, { params }));
let seed = 7;
const rnd = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
/** Text, short and long repeats, runs and noise: every block and sequence kind. */
function sample(size: number) {
  const b = new Uint8Array(size), words = ['kubelet', 'containerd', ' ', '\n', '{"kind":"Pod"}', 'riscv64'];
  for (let i = 0; i < size;) {
    const k = rnd();
    if (k < 0.3) for (const c of words[Math.floor(rnd() * words.length)]!) { if (i < size) b[i++] = c.charCodeAt(0); }
    else if (k < 0.5 && i > 8) { const off = 1 + Math.floor(rnd() * Math.min(i, rnd() < 0.5 ? 16 : 100000)); for (let j = 0, n = 3 + Math.floor(rnd() * 300); j < n && i < size; j++, i++) b[i] = b[i - off]!; }
    else if (k < 0.6) { const v = Math.floor(rnd() * 256); for (let j = 0, n = Math.floor(rnd() * 500); j < n && i < size; j++) b[i++] = v; }
    else for (let j = 0, n = 1 + Math.floor(rnd() * 64); j < n && i < size; j++) b[i++] = Math.floor(rnd() * 256);
  }
  return b;
}
const decode = (z: Uint8Array, size: number) => { const out = new Uint8Array(size); return out.subarray(0, zstdDecompress(z, out)); };
test('decodes what libzstd writes at every level and setting', () => {
  const inputs = [new Uint8Array(0), Uint8Array.of(1), new Uint8Array(300000), sample(1 << 20), sample(70000), sample(2_500_000)];
  const settings = [{ [Z.ZSTD_c_compressionLevel]: 1 }, {}, { [Z.ZSTD_c_compressionLevel]: 19, [Z.ZSTD_c_checksumFlag]: 1 },
    { [Z.ZSTD_c_compressionLevel]: -5 }, { [Z.ZSTD_c_contentSizeFlag]: 0 }, { [Z.ZSTD_c_windowLog]: 10, [Z.ZSTD_c_compressionLevel]: 6 }];
  for (const input of inputs) for (const p of settings) expect(decode(compress(input, p), input.length)).toEqual(input);
});
test('concatenated and skippable frames; refuses damage and a short buffer', () => {
  const a = sample(200000), b = sample(90000), za = compress(a, { [Z.ZSTD_c_compressionLevel]: 19 });
  const skip = new Uint8Array(8 + 5); new DataView(skip.buffer).setUint32(0, 0x184d2a51, true); new DataView(skip.buffer).setUint32(4, 5, true);
  const both = new Uint8Array([...skip, ...za, ...compress(b)]);
  expect(decode(both, a.length + b.length)).toEqual(new Uint8Array([...a, ...b]));
  expect(() => zstdDecompress(za, new Uint8Array(a.length - 1))).toThrow('zstd:');
  for (const cut of [1, 5, 17, za.length >> 1, za.length - 1]) expect(() => decode(za.subarray(0, cut), a.length)).toThrow('zstd:');
  // A flipped bit either throws or decodes to other bytes (callers check a SHA-256).
  for (let i = 0; i < 200; i++) {
    const z = za.slice(); z[Math.floor(rnd() * z.length)]! ^= 1 << Math.floor(rnd() * 8);
    try { decode(z, a.length); } catch (e) { expect(String(e)).toMatch(/zstd:/); }
  }
});
