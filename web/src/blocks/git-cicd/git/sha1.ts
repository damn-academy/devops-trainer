// A small synchronous SHA-1 over UTF-8 text. Git names objects by the SHA-1 of
// "<type> <size>\0<content>", so a blob here gets the same id as in real Git.

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function sha1Bytes(data: Uint8Array): string {
  const ml = data.length * 8;
  const withOne = data.length + 1;
  const padLen = (withOne % 64 <= 56 ? 56 - (withOne % 64) : 120 - (withOne % 64)) + withOne + 8;
  const buf = new Uint8Array(padLen);
  buf.set(data);
  buf[data.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(padLen - 8, Math.floor(ml / 2 ** 32));
  view.setUint32(padLen - 4, ml >>> 0);
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);
  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (x << 1) | (x >>> 31);
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
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
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = (b << 30) | (b >>> 2);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map((x) => x.toString(16).padStart(8, '0')).join('');
}

export function sha1(text: string): string {
  return sha1Bytes(utf8(text));
}

/** Byte length of a string in UTF-8 (the size Git writes into an object header). */
export function byteLength(text: string): number {
  return utf8(text).length;
}

/** The id Git gives an object: sha1("<type> <size>\0<body>"). */
export function objectId(type: string, body: string): string {
  return sha1(`${type} ${byteLength(body)}\0${body}`);
}
